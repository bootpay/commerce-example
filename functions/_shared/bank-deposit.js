// 무통장 입금 (뱅크알람) — server.js 와 Cloudflare Functions 가 같이 쓴다 (fetch 만 사용).
//
// 흐름:
//   1. 손님이 주문서에서 「무통장 입금」을 고르고 입금자명을 적는다.
//   2. 서버가 데모 주문을 입금대기(awaiting_deposit)로 저장하고, Commerce API
//      POST /v1/sdk/deposits 로 부트페이에 입금대기 주문을 등록한다.
//   3. 판매자 폰의 뱅크알람 앱이 은행 입금 문자·알림을 읽어 부트페이에 올리면, 부트페이가
//      금액·입금자명이 같은 입금대기 주문을 찾아 입금 확인으로 넘긴다.
//   4. 부트페이가 등록 때 넘긴 webhook_url 로 결과를 알린다. 이 서버는 웹훅 본문을 그대로
//      믿지 않고 GET /v1/sdk/deposits/:id 로 다시 조회한 값으로만 결제 완료를 적는다.
//
// 웹훅이 못 닿는 자리(localhost)도 있으므로 주문을 볼 때마다 같은 조회로 상태를 맞춘다
// (syncBankDeposit). 웹훅은 빠른 길이고, 조회가 정본이다.

const COMMERCE_API_BASE = {
    development: 'https://dev-api.bootapi.com',
    production: 'https://api.bootapi.com'
}

export const AWAITING_DEPOSIT = 'awaiting_deposit'

// Commerce 키(BOOTPAY_COMMERCE_CLIENT_KEY / BOOTPAY_COMMERCE_SECRET_KEY)는 PG 키와 다르다.
// 호스트는 PG 와 같은 모드를 따르고, BOOTPAY_COMMERCE_API_BASE 로 덮어쓸 수 있다.
export function commerceConfigFor(mode, env = {}) {
    if (!env.BOOTPAY_COMMERCE_CLIENT_KEY || !env.BOOTPAY_COMMERCE_SECRET_KEY) return null
    return {
        client_key: env.BOOTPAY_COMMERCE_CLIENT_KEY,
        secret_key: env.BOOTPAY_COMMERCE_SECRET_KEY,
        api_base: (env.BOOTPAY_COMMERCE_API_BASE || COMMERCE_API_BASE[mode] || COMMERCE_API_BASE.production).replace(/\/$/, '')
    }
}

// 계좌 목록 API(GET /v1/sdk/deposits/accounts)가 없는 서버에서만 쓰는 대체 계좌 — SHOP_BANK_* 로 가맹점이 직접 든다.
export function bankAccountFor(env = {}) {
    const account = {
        bank_name: String(env.SHOP_BANK_NAME || '').trim(),
        account_no: String(env.SHOP_BANK_ACCOUNT || '').trim(),
        holder: String(env.SHOP_BANK_HOLDER || '').trim()
    }
    return account.bank_name && account.account_no ? account : null
}

// 웹훅을 받을 공개 주소. 부트페이 서버가 localhost 로는 못 오므로 그때는 넘기지 않는다
// (주문 조회 때 상태를 맞추는 길만 남는다). SHOP_PUBLIC_URL 로 터널 주소를 줄 수 있다.
export function webhookUrlFor(origin, env = {}) {
    // 서명을 확인할 비밀값이 없으면 웹훅을 받지 않는다 — 조회로만 맞춘다 (위조 요청을 못 가린다)
    if (!env.SHOP_WEBHOOK_SECRET) return null
    const base = String(env.SHOP_PUBLIC_URL || origin || '').replace(/\/$/, '')
    if (!base || /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(base)) return null
    return `${base}/api/shop/bank-deposit/webhook`
}

async function commerceFetch(config, path, { method = 'GET', body } = {}) {
    const response = await fetch(`${config.api_base}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Basic ' + btoa(`${config.client_key}:${config.secret_key}`)
        },
        body: body ? JSON.stringify(body) : undefined
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
        const error = new Error(data.message || `부트페이 입금 API 가 응답하지 않았습니다 (${response.status}).`)
        error.code = data.error_code || 'BANK_DEPOSIT_API_FAILED'
        error.httpStatus = response.status // 부트페이가 실제로 준 상태 (404 = 그 API 가 없는 서버)
        error.status = 424 // 502 는 Cloudflare 가 자체 오류 페이지로 바꿔 사유가 사라진다
        throw error
    }
    // 응답이 { data: {...} } 로 한 번 감싸여 올 수 있다
    return data?.data && typeof data.data === 'object' ? data.data : data
}

// 입금대기 주문을 부트페이에 등록한다. 부트페이는 이 주문의 주문자 이름을 입금자명으로 두고
// 입금 알림의 이름과 비교한다 — 한 글자만 달라도 자동으로 붙지 않는다.
export function registerBankDeposit(config, order, { webhookUrl } = {}) {
    return commerceFetch(config, '/v1/sdk/deposits', {
        method: 'POST',
        body: {
            merchant_order_id: order.order_id,
            depositor: order.bank_transfer.depositor,
            // 구매자(회원) 이름 — 입금자명과 다를 수 있다. 관리자 주문 목록에는 이 이름이 나온다
            buyer_name: order.buyer_name || undefined,
            price: order.total_price,
            order_name: order.order_name,
            buyer_phone: order.shipping?.phone || undefined,
            webhook_url: webhookUrl || undefined,
            account_id: order.bank_transfer.account_id || undefined
        }
    })
}

// 판매자가 부트페이(관리자 · 판매자 앱 뱅크알람 설정)에 등록한 입금 계좌 목록 (GET /v1/sdk/deposits/accounts).
// 첫 계좌가 대표 계좌이고, 손님이 고른 계좌의 id 를 입금대기 등록 때 account_id 로 보낸다.
// 부트페이가 「계좌 없음」이라고 답하면 그대로 빈 목록이다 — 다른 계좌로 몰래 바꾸면 손님에게 안내한
// 계좌와 부트페이가 아는 계좌가 갈린다. 그 API 가 없는 서버(반영 전)에서만 SHOP_BANK_* 하나로 대신한다.
export async function bankAccountsFor(config, env = {}) {
    if (config) {
        try {
            const data = await commerceFetch(config, '/v1/sdk/deposits/accounts')
            return (Array.isArray(data?.accounts) ? data.accounts : [])
                .map(row => ({ id: String(row?.id || ''), bank_name: String(row?.bank_name || '').trim(), account_no: String(row?.account_no || '').trim(), holder: String(row?.holder || '').trim() }))
                .filter(row => row.id && row.bank_name && row.account_no)
        } catch (error) {
            // 계좌 API 가 없는 서버(404, 반영 전)만 SHOP_BANK_* 로 대신한다. 인증 · 권한 · 서버 오류는 그대로 실패다 —
            // 키가 틀렸는데 다른 계좌로 주문을 받으면 부트페이가 모르는 계좌를 손님에게 안내하게 된다
            if (error?.httpStatus !== 404) throw error
        }
    }
    const fallback = bankAccountFor(env)
    return fallback ? [{ id: '', ...fallback }] : []
}

export function fetchBankDeposit(config, merchantOrderId) {
    return commerceFetch(config, `/v1/sdk/deposits/${encodeURIComponent(merchantOrderId)}`)
}

// 부트페이 쪽 상태를 데모 주문에 옮긴다. 바뀐 것이 없으면 null.
// - 금액이 다르면 결제 완료로 적지 않는다 — 다른 주문의 입금이 붙은 것일 수 있다 (price_mismatch).
//   판매자가 바로잡으면(되돌림 · 올바른 입금) 다시 따라간다 — 금액 확인 필요에 갇히지 않게.
// - 판매자가 입금 확인을 되돌리면(잘못 붙인 입금) 부트페이는 다시 awaiting 을 준다 — 결제 완료를 입금 대기로 되돌린다.
// - 쇼핑몰에서 취소한 주문은 건드리지 않는다. 부트페이에는 입금대기 취소가 없어서 늦게 붙은 입금도 paid 로 온다.
const BANK_FOLLOWS = [AWAITING_DEPOSIT, 'paid', 'price_mismatch']

export function applyBankDeposit(order, remote) {
    if (!remote || order?.method !== 'bank_transfer' || !BANK_FOLLOWS.includes(order.status)) return null
    if (remote.status === 'paid') {
        if (Number(remote.amount) !== Number(order.total_price)) {
            return order.status === 'price_mismatch' ? null : { ...order, status: 'price_mismatch', bank_transfer: { ...order.bank_transfer, remote } }
        }
        if (order.status === 'paid') return null
        return {
            ...order,
            status: 'paid',
            paid_at: remote.paid_at || new Date().toISOString(),
            bank_transfer: { ...order.bank_transfer, order_number: remote.order_number, deposit: remote.deposit || null, remote: undefined }
        }
    }
    if (remote.status === 'awaiting' && order.status !== AWAITING_DEPOSIT) {
        return { ...order, status: AWAITING_DEPOSIT, paid_at: null, reverted_at: new Date().toISOString(), bank_transfer: { ...order.bank_transfer, deposit: null, remote: undefined } }
    }
    return null
}

// 부트페이에 다시 물어 주문 하나를 맞춘다 — 주문 내역 · 주문 결과 · 웹훅이 같이 쓴다 (Functions · server.js 둘 다).
// read · write 는 각자의 저장소다. 조회가 끝난 뒤 **최신 주문을 다시 읽어** 그 위에 적용한다 — 조회하는 사이
// 쇼핑몰에서 취소한 주문을 조회 전 값으로 덮어 결제 완료로 되살리지 않게 (코드리뷰 2026-10-21).
// 입금 대기 · 금액 확인 필요는 늘 묻고, 결제 완료(판매자가 되돌렸을 수 있다)는 includePaid 일 때만 —
// 주문 내역은 열 때마다 · 기다리는 동안 몇 초마다 부르므로 받은 주문까지 묻으면 주문 수만큼 API 를 부른다.
// 조회 실패는 throwOnError 가 아니면 삼키고 지금 값을 돌려준다 (화면은 지금 값으로 선다).
export async function refreshBankOrder(config, order, { read, write, includePaid = false, throwOnError = false }) {
    const asks = includePaid ? BANK_FOLLOWS : [AWAITING_DEPOSIT, 'price_mismatch']
    if (!config || order?.method !== 'bank_transfer' || !asks.includes(order.status)) return order
    let remote
    try {
        remote = await fetchBankDeposit(config, order.order_id)
    } catch (error) {
        if (throwOnError) throw error
        return order
    }
    const latest = read(order.order_id) || order
    const next = applyBankDeposit(latest, remote)
    return next ? write(next) : latest
}

// 주문 전 손님에게 보여 줄 모양 — 은행과 끝 네 자리만. 전체 계좌번호는 주문을 만든 뒤 입금 안내에서 준다
// (부트페이 공개 쇼핑몰 응답이 계좌번호를 빼는 것과 같은 이유다). id 로 고른다.
export function publicBankAccounts(accounts) {
    return accounts.map(row => ({ id: row.id, bank_name: row.bank_name, tail: row.account_no.replace(/\D/g, '').slice(-4) }))
}

// 부트페이 웹훅 서명 확인 — X-Bootpay-Signature = "sha256=" + HMAC-SHA256(secret, `${timestamp}.${본문 원문}`).
// 비밀값은 POST /v1/sdk/deposits/webhook_secret 으로 받아 SHOP_WEBHOOK_SECRET 에 둔다.
// 5분보다 오래된 요청은 다시 보낸 것으로 보고 거절한다. Workers 와 Node 18+ 둘 다 있는 Web Crypto 를 쓴다.
export async function verifyWebhookSignature(rawBody, headers, secret, now = Date.now()) {
    if (!secret) return false
    const timestamp = String(headers.get('x-bootpay-timestamp') || '')
    const signature = String(headers.get('x-bootpay-signature') || '').replace(/^sha256=/, '')
    if (!timestamp || !signature) return false
    const sentAt = Number(timestamp) * (timestamp.length <= 10 ? 1000 : 1)
    if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > 5 * 60 * 1000) return false
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`))
    const expected = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('')
    if (expected.length !== signature.length) return false
    let diff = 0
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
    return diff === 0
}
