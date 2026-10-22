// 데모 저장소 — 메모리에 든다. 함수는 모두 동기다.
// Cloudflare Pages 는 요청마다 다른 isolate 로 갈 수 있어서 메모리만으로는 회원 · 주문이 사라진다
// (로그인했는데 주문 내역이 401, 결과 화면이 「주문을 찾을 수 없습니다」). 그래서 KV(SHOP_STORE)가 있으면
// functions/_middleware.js 가 레코드 하나(회원 · 주문 · 본인인증 토큰)를 KV 키 하나로 이어 둔다 — records() · putRecord().
// KV 가 없으면(express server.js · 바인딩 없는 배포) 예전처럼 메모리에만 있다. @date: 2026-10-21

import { createVerificationStore } from './identity.js'
import { ALIMTALK_WEBHOOK_KEEP, sortAlimtalkWebhooks } from './alimtalk-webhook.js'

const store = globalThis.__BOOTPAY_COMMERCE_DEMO_STORE__ || {
    users: new Map(),
    orders: new Map(),
    verifications: new Map(),
    alimtalkWebhooks: new Map()
}
store.verifications ||= new Map()
store.alimtalkWebhooks ||= new Map()

globalThis.__BOOTPAY_COMMERCE_DEMO_STORE__ = store

export const verificationStore = createVerificationStore(store.verifications)

const ADMIN_EMAIL = 'admin@demo.local'
const ADMIN_PASSWORD = 'admin1234'

// 미리 넣는 계정(관리자 · 데모 회원)의 시각 — 고정이라야 새 isolate 가 뜰 때마다 「바뀐 레코드」로 KV 에 다시 쓰지 않는다
const SEED_AT = '2026-01-01T00:00:00.000Z'

function nowIso() {
    return new Date().toISOString()
}

function makeId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase()
}

function publicUser(user) {
    if (!user) return null
    const { password, ci_hash, ...safeUser } = user
    return safeUser
}

function seedAdmin() {
    const exists = Array.from(store.users.values()).some(user => user.email === ADMIN_EMAIL)
    if (exists) return

    const admin = {
        id: 'ADMIN_DEMO',
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        username: '데모 관리자',
        phone: '01000000000',
        role: 'admin',
        status: 'active',
        identity_verified: false,
        created_at: SEED_AT,
        updated_at: SEED_AT
    }
    store.users.set(admin.id, admin)
}

seedAdmin()

// 본인인증을 마친 것으로 치는 데모 회원 — 무통장 입금처럼 실제 주문까지 가 보는 로컬 시험용.
// DEMO_MEMBER_EMAIL · DEMO_MEMBER_PASSWORD 를 넣었을 때만 만든다. 이 회원은 본인인증을 건너뛰므로
// 공개 배포에는 넣지 않는다. 이름은 무통장 입금자명 기본값이 되어 은행 입금 알림의 이름과 비교된다.
export function demoMemberFrom(env = {}) {
    const email = normalizeEmail(env.DEMO_MEMBER_EMAIL)
    if (!email || !env.DEMO_MEMBER_PASSWORD) return null
    return {
        id: 'MEMBER_DEMO',
        email,
        password: String(env.DEMO_MEMBER_PASSWORD),
        username: String(env.DEMO_MEMBER_NAME || '데모 회원').trim(),
        phone: String(env.DEMO_MEMBER_PHONE || '01000000000').trim(),
        // 주문서 배송지 기본값 — 로그인하면 주문서가 이 값으로 채운다
        address: {
            zipcode: String(env.DEMO_MEMBER_ZIPCODE || '06236').trim(),
            address1: String(env.DEMO_MEMBER_ADDRESS1 || '서울 강남구 테헤란로 152').trim(),
            address2: String(env.DEMO_MEMBER_ADDRESS2 || '데모 101호').trim()
        },
        role: 'member',
        status: 'active',
        identity_verified: true,
        identity_verified_at: SEED_AT,
        birth: null,
        gender: null,
        ci_hash: null,
        created_at: SEED_AT,
        updated_at: SEED_AT
    }
}

// Functions 는 env 를 요청마다 받으므로 모듈 로드가 아니라 요청 때 넣는다 (isolate 가 바뀌어도 다시 선다)
export function seedDemoMember(env) {
    if (store.users.has('MEMBER_DEMO')) return
    const member = demoMemberFrom(env)
    if (member) store.users.set(member.id, member)
}

export function findUserByCiHash(ciHash) {
    return Array.from(store.users.values()).find(user => user.ci_hash && user.ci_hash === ciHash) || null
}

// identity: 본인인증 결과({ name, phone, birth, gender, authenticated_at }) + ciHash.
// 있으면 이름·휴대폰은 인증 값으로 확정한다.
export function createUser({ email, password, username, phone, role = 'member', identity = null, ciHash = '' }) {
    const normalizedEmail = normalizeEmail(email)
    if (!normalizedEmail) throw new Error('이메일을 입력해 주세요.')
    if (!password || String(password).length < 8) throw new Error('비밀번호는 8자 이상이어야 합니다.')
    if (Array.from(store.users.values()).some(user => user.email === normalizedEmail)) {
        const error = new Error('이미 가입된 이메일입니다.')
        error.code = 'DUPLICATE_EMAIL'
        throw error
    }
    if (ciHash && findUserByCiHash(ciHash)) {
        const error = new Error('이미 본인인증으로 가입한 회원입니다.')
        error.code = 'IDENTITY_ALREADY_LINKED'
        throw error
    }

    const user = {
        id: makeId('USER'),
        email: normalizedEmail,
        password,
        username: String(identity?.name || username || normalizedEmail.split('@')[0]).trim(),
        phone: String(identity?.phone || phone || '').trim(),
        role,
        status: 'active',
        identity_verified: Boolean(identity),
        identity_verified_at: identity?.authenticated_at || null,
        birth: identity?.birth || null,
        gender: identity?.gender || null,
        ci_hash: ciHash || null,
        created_at: nowIso(),
        updated_at: nowIso()
    }
    store.users.set(user.id, user)
    return publicUser(user)
}

export function authenticateUser(email, password) {
    const normalizedEmail = normalizeEmail(email)
    const user = Array.from(store.users.values()).find(item => item.email === normalizedEmail)
    if (!user || user.password !== password) return null
    if (user.status !== 'active') {
        const error = new Error('비활성화된 회원입니다.')
        error.code = 'INACTIVE_USER'
        throw error
    }
    return publicUser(user)
}

export function listUsers() {
    return Array.from(store.users.values())
        .map(publicUser)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getUser(userId) {
    return publicUser(store.users.get(userId))
}

export function getRawUser(userId) {
    return store.users.get(userId)
}

export function updateUserStatus(userId, status) {
    if (!['active', 'suspended'].includes(status)) {
        const error = new Error('지원하지 않는 회원 상태입니다.')
        error.code = 'INVALID_STATUS'
        throw error
    }
    const user = store.users.get(userId)
    if (!user) return null
    user.status = status
    user.updated_at = nowIso()
    store.users.set(userId, user)
    return publicUser(user)
}

export function requireAdmin(request) {
    const url = new URL(request.url)
    const adminId = request.headers.get('X-Demo-Admin-Id') || url.searchParams.get('admin_id')
    const admin = store.users.get(adminId)
    if (!admin || admin.role !== 'admin' || admin.status !== 'active') {
        const error = new Error('관리자 권한이 필요합니다.')
        error.status = 403
        throw error
    }
    return publicUser(admin)
}

export function saveOrder(order) {
    const existing = store.orders.get(order.order_id) || {}
    const next = {
        ...existing,
        ...order,
        updated_at: nowIso()
    }
    store.orders.set(next.order_id, next)
    return next
}

export function getOrder(orderId) {
    return store.orders.get(orderId) || null
}

export function listOrders() {
    return Array.from(store.orders.values())
        .map(order => ({
            ...order,
            user: order.user_id ? getUser(order.user_id) : null
        }))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
}

export function listOrdersForUser(userId) {
    return Array.from(store.orders.values())
        .filter(order => userId && order.user_id === userId)
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
}

export function cancelOrder(orderId, { reason, cancel_price, cancelled_by, mode = 'memory' }) {
    const order = store.orders.get(orderId)
    if (!order) return null
    if (order.status === 'cancelled') return order

    const price = Number(cancel_price || order.total_price || order.price || 0)
    const next = {
        ...order,
        status: 'cancelled',
        cancelled_price: price,
        cancel_reason: reason || '관리자 취소',
        cancelled_by,
        cancelled_at: nowIso(),
        cancel_result_mode: mode,
        updated_at: nowIso()
    }
    store.orders.set(orderId, next)
    return next
}

// 받은 알림톡 웹훅 (functions/_shared/alimtalk-webhook.js) — Delivery-Id 하나에 한 줄, 최근 ALIMTALK_WEBHOOK_KEEP 건만 남긴다
export function getAlimtalkWebhook(id) {
    return store.alimtalkWebhooks.get(id) || null
}

export function saveAlimtalkWebhook(row) {
    store.alimtalkWebhooks.set(row.id, row)
    const rows = sortAlimtalkWebhooks(Array.from(store.alimtalkWebhooks.values()))
    for (const old of rows.slice(ALIMTALK_WEBHOOK_KEEP)) store.alimtalkWebhooks.delete(old.id)
    return row
}

export function listAlimtalkWebhooks() {
    return sortAlimtalkWebhooks(Array.from(store.alimtalkWebhooks.values()))
}

// ---------- 영속 (functions/_middleware.js) ----------
// 레코드 하나 = KV 키 하나. 통째 한 덩어리로 두면 두 isolate 가 같은 덩어리를 따로 고쳐 저장할 때 나중 것이
// 앞 것의 다른 주문까지 지운다 (코드리뷰 2026-10-21). 키를 나누면 서로 다른 주문은 서로를 못 지운다.
// 버전은 회원 · 주문의 updated_at, 본인인증 토큰의 expiresAt 이다 — KV 메타데이터에 같이 둬서 목록 한 번으로 바뀐 것만 읽는다.
const RECORD_MAPS = { user: () => store.users, order: () => store.orders, verify: () => store.verifications, alimtalk: () => store.alimtalkWebhooks }

export function recordVersion(row) {
    return String(row?.updated_at || row?.expiresAt || '')
}

// 지금 메모리의 모든 레코드 { 'order:SHOP_1': row, ... }. 끝난 본인인증 토큰은 뺀다
export function records() {
    const now = Date.now()
    const out = {}
    for (const [prefix, map] of Object.entries(RECORD_MAPS)) {
        for (const [id, row] of map()) {
            if (prefix === 'verify' && !(row?.expiresAt > now)) continue
            out[`${prefix}:${id}`] = row
        }
    }
    return out
}

export function getRecord(key) {
    const [prefix, ...rest] = key.split(':')
    return RECORD_MAPS[prefix]?.().get(rest.join(':'))
}

// KV 에서 읽은 레코드를 메모리에 넣는다. row 가 null 이면 지운다 (쓴 본인인증 토큰)
export function putRecord(key, row) {
    const [prefix, ...rest] = key.split(':')
    const map = RECORD_MAPS[prefix]?.()
    if (!map) return
    if (row == null) map.delete(rest.join(':'))
    else map.set(rest.join(':'), row)
}

export function getDemoCredentials() {
    return { admin_email: ADMIN_EMAIL, admin_password: ADMIN_PASSWORD }
}
