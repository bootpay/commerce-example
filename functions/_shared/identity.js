// 회원가입 본인인증 — Bootpay requestAuthentication 결과(receipt_id)를 서버에서 확인한다.
// server.js 와 Cloudflare Functions 가 같이 쓴다 (fetch / crypto.subtle 만 사용).
//
// 흐름 (rovel.ai adult-verification 과 같은 규칙):
//   1. 브라우저가 Bootpay.requestAuthentication() 으로 휴대폰 본인인증을 마치고 receipt_id 를 받는다.
//   2. 서버가 GET /v2/certificate/{receipt_id} 로 인증 결과를 조회한다.
//   3. status 12(인증 완료) · authenticated_at 1시간 이내 · authenticate_data.unique(CI) 존재를 확인한다.
//   4. CI 해시로 중복 가입을 막고, 가입에 쓸 일회용 verification_token 을 발급한다.

const API_BASE = {
    development: 'https://dev-api.bootpay.co.kr',
    production: 'https://api.bootpay.co.kr'
}

export const CERT_STATUS_DONE = 12 // 결제 완료(1)와 다른 값이다.
const MAX_CERT_AGE_MS = 60 * 60 * 1000
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000
const VERIFICATION_TTL_MS = 30 * 60 * 1000
const HASH_PEPPER = 'bootpay-commerce-example-identity-v1'

// PG 키(BOOTPAY_CLIENT_KEY / BOOTPAY_SECRET_KEY)와 모드(BOOTPAY_MODE)는 환경변수에서 읽는다.
// BOOTPAY_MODE 가 없으면 로컬 호스트는 development, 그 밖은 production.
// 브라우저는 /api/shop/config 로 같은 client_key·모드를 받아 결제창/인증창을 연다.
export function pgModeFor(hostname, env = {}) {
    if (env.BOOTPAY_MODE === 'development' || env.BOOTPAY_MODE === 'production') return env.BOOTPAY_MODE
    return ['localhost', '127.0.0.1'].includes(hostname) ? 'development' : 'production'
}

export function pgConfigFor(hostname, env = {}) {
    if (!env.BOOTPAY_CLIENT_KEY || !env.BOOTPAY_SECRET_KEY) return null
    const mode = pgModeFor(hostname, env)
    return {
        mode,
        client_key: env.BOOTPAY_CLIENT_KEY,
        secret_key: env.BOOTPAY_SECRET_KEY,
        api_base: API_BASE[mode]
    }
}

// 브라우저에 내려도 되는 값만 (secret_key 제외).
export function publicPgConfig(hostname, env = {}) {
    const config = pgConfigFor(hostname, env)
    return config ? { client_key: config.client_key, mode: config.mode } : null
}

export async function fetchCertificate(receiptId, config) {
    // ck/sk 키는 토큰 발급 없이 Basic 인증으로 바로 조회한다.
    const response = await fetch(`${config.api_base}/v2/certificate/${encodeURIComponent(receiptId)}`, {
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Basic ' + btoa(`${config.client_key}:${config.secret_key}`)
        }
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
        const error = new Error(data.message || '본인인증 결과를 조회하지 못했습니다.')
        error.code = data.error_code || 'CERTIFICATE_LOOKUP_FAILED'
        error.status = 502
        throw error
    }
    return data
}

function fail(code, message, status = 400) {
    const error = new Error(message)
    error.code = code
    error.status = status
    return error
}

function formatBirth(value) {
    const digits = String(value || '').replace(/\D/g, '')
    if (digits.length !== 8) return ''
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

// certificate 응답 → 가입에 쓸 신원 정보. 조건이 맞지 않으면 throw 한다.
export function parseCertificate(cert, now = Date.now()) {
    if (Number(cert?.status) !== CERT_STATUS_DONE) {
        throw fail('CERTIFICATE_NOT_DONE', '본인인증이 완료되지 않았습니다. 다시 인증해 주세요.')
    }
    const authenticatedAt = Date.parse(cert.authenticated_at)
    if (!Number.isFinite(authenticatedAt) || now - authenticatedAt > MAX_CERT_AGE_MS || authenticatedAt - now > MAX_CLOCK_SKEW_MS) {
        throw fail('CERTIFICATE_EXPIRED', '본인인증 유효 시간이 지났습니다. 다시 인증해 주세요.')
    }
    const data = cert.authenticate_data || {}
    // certificate 응답에는 원문 CI/DI 가 없고 unique 가 CI 역할을 한다.
    const unique = String(data.unique || '')
    if (!unique) throw fail('CERTIFICATE_INCOMPLETE', '본인인증 정보가 부족합니다. 다시 인증해 주세요.')
    return {
        unique,
        name: String(data.name || '').trim(),
        phone: String(data.phone || '').replace(/\D/g, ''),
        birth: formatBirth(data.birth),
        gender: data.gender === 1 || data.gender === '1' ? 'male' : data.gender === 0 || data.gender === '0' ? 'female' : '',
        foreigner: Boolean(data.foreigner),
        authenticated_at: new Date(authenticatedAt).toISOString(),
        receipt_id: cert.receipt_id || ''
    }
}

// 원문 CI 는 저장하지 않고 해시만 남긴다.
export async function hashIdentity(unique) {
    const bytes = new TextEncoder().encode(`${HASH_PEPPER}:${unique}`)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export function maskEmail(email) {
    const [local = '', domain = ''] = String(email).split('@')
    return `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`
}

// 인증은 끝났지만 아직 가입하지 않은 상태를 담는 일회용 토큰 저장소.
export function createVerificationStore(map = new Map()) {
    return {
        issue(identity, ciHash) {
            const token = crypto.randomUUID()
            map.set(token, { identity, ciHash, expiresAt: Date.now() + VERIFICATION_TTL_MS })
            return token
        },
        // 가입 성공 시에만 consume 한다. 실패하면 같은 토큰으로 다시 시도할 수 있다.
        peek(token) {
            const entry = map.get(token)
            if (!entry) return null
            if (entry.expiresAt < Date.now()) {
                map.delete(token)
                return null
            }
            return entry
        },
        consume(token) {
            map.delete(token)
        }
    }
}

// 브라우저에 돌려줄 공개 필드. unique/CI 는 내보내지 않는다.
export function publicIdentity(identity) {
    return {
        name: identity.name,
        phone: identity.phone,
        birth: identity.birth,
        gender: identity.gender,
        authenticated_at: identity.authenticated_at
    }
}
