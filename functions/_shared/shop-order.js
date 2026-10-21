// 쇼핑몰 주문서 → 주문 레코드. server.js 와 Cloudflare Functions 가 같이 쓴다.
import { quoteCart } from '../../shop/catalog.js'
import { pgConfigFor, pgModeFor } from './identity.js'
import { AWAITING_DEPOSIT, bankAccountsFor, commerceConfigFor, registerBankDeposit, webhookUrlFor } from './bank-deposit.js'

const SHIPPING_FIELDS = ['receiver', 'phone', 'zipcode', 'address1']

// rawUser: 저장소의 회원 원본(없으면 null). 반환: { ok, order, response } | { ok:false, status, code, message }
export function createShopOrder(body, rawUser) {
    if (!rawUser || rawUser.status !== 'active') {
        return { ok: false, status: 401, code: 'LOGIN_REQUIRED', message: '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.' }
    }
    if (!rawUser.identity_verified) {
        return { ok: false, status: 403, code: 'IDENTITY_REQUIRED', message: '본인인증을 마친 회원만 주문할 수 있습니다.' }
    }

    const quote = quoteCart(body.items, { couponCode: body.coupon_code || '' })
    if (!quote.ok) return { ok: false, status: 400, code: quote.code, message: quote.message }
    if (!quote.canCheckout) {
        const problem = quote.couponError || quote.lines.find(line => line.problem)?.problem || '구매할 수 없는 상품이 있습니다.'
        return { ok: false, status: 409, code: 'NOT_PURCHASABLE', message: problem }
    }

    const shipping = Object.fromEntries(['receiver', 'phone', 'zipcode', 'address1', 'address2', 'memo']
        .map(key => [key, String(body.shipping?.[key] || '').trim().slice(0, 200)]))
    const missing = SHIPPING_FIELDS.find(key => !shipping[key])
    if (missing) return { ok: false, status: 400, code: 'SHIPPING_REQUIRED', message: '배송지 정보를 모두 입력해 주세요.' }

    const orderId = 'SHOP_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11)
    const method = body.method || 'card'
    // 무통장 입금은 입금자명이 있어야 뱅크알람이 입금을 이 주문에 붙일 수 있다
    const depositor = String(body.depositor || '').trim().slice(0, 50)
    if (method === 'bank_transfer' && !depositor) {
        return { ok: false, status: 400, code: 'DEPOSITOR_REQUIRED', message: '입금자명을 입력해 주세요.' }
    }
    const order = {
        order_id: orderId,
        order_name: quote.orderName,
        product_name: quote.orderName,
        items: quote.lines.map(({ problem, ...line }) => line),
        quantity: quote.lines.reduce((sum, line) => sum + line.quantity, 0),
        original_price: quote.subtotal,
        discount_price: quote.discount,
        delivery_fee: quote.deliveryFee,
        coupon_code: quote.couponCode || null,
        total_price: quote.total,
        shipping,
        channel: body.channel === 'buy-now' ? 'buy-now' : 'cart',
        method,
        user_id: rawUser.id,
        // 구매자 이름 — 무통장 입금은 입금자명과 따로 보낸다(관리자 주문 목록의 구매자는 회원 이름이다)
        buyer_name: rawUser.username || '',
        status: method === 'bank_transfer' ? AWAITING_DEPOSIT : 'pending',
        // 손님이 고른 입금 계좌 id (GET /v1/sdk/deposits/accounts). 비면 대표 계좌다
        ...(method === 'bank_transfer' ? { bank_transfer: { depositor, account_id: String(body.bank_account || '').trim() || undefined } } : {}),
        created_at: new Date().toISOString()
    }
    return {
        ok: true,
        order,
        response: { success: true, order_id: orderId, order_name: quote.orderName, price: quote.total, method }
    }
}

// 쇼핑몰 주문은 Bootpay 영수증으로 결제 완료·금액을 확인한 뒤에만 paid 로 바꾼다.
// 반환: { ok:true } | { ok:false, status, message, orderStatus? }
export async function verifyShopReceipt(hostname, env, order, receiptId) {
    if (!receiptId) return { ok: false, status: 400, message: '영수증 ID가 없습니다.' }
    const config = pgConfigFor(hostname, env)
    if (!config) return { ok: false, status: 500, message: '서버에 Bootpay PG 키가 설정되지 않아 결제를 확인할 수 없습니다.' }
    const response = await fetch(`${config.api_base}/v2/receipt/${encodeURIComponent(receiptId)}`, {
        headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + btoa(`${config.client_key}:${config.secret_key}`) }
    })
    const receipt = await response.json().catch(() => ({}))
    if (!response.ok) return { ok: false, status: 424, message: receipt.message || '결제 정보를 조회하지 못했습니다.' }
    if (receipt.order_id && receipt.order_id !== order.order_id) return { ok: false, status: 409, message: '다른 주문의 영수증입니다.' }
    if (Number(receipt.status) !== 1) return { ok: false, status: 409, message: '결제가 완료되지 않았습니다.', orderStatus: 'pending' }
    if (Number(receipt.price) !== Number(order.total_price)) return { ok: false, status: 409, message: '결제 금액이 주문 금액과 일치하지 않습니다.', orderStatus: 'price_mismatch' }
    return { ok: true }
}

// 주문을 볼 때·웹훅을 받을 때 쓰는 Commerce 키. PG 와 같은 모드(BOOTPAY_MODE)를 따른다.
export function commerceConfigForHost(hostname, env = {}) {
    return commerceConfigFor(pgModeFor(hostname, env), env)
}

// 무통장 입금 주문을 부트페이에 입금대기로 등록하고, 손님에게 보여 줄 입금 안내를 붙인다.
// 등록이 실패하면 주문을 남기지 않는다 — 부트페이가 모르는 주문은 입금이 와도 안 붙는다.
// 반환: { ok:true, order } | { ok:false, status, code, message }
export async function startBankTransfer(order, { hostname, origin, env = {} }) {
    const config = commerceConfigForHost(hostname, env)
    if (!config) return { ok: false, status: 500, code: 'COMMERCE_KEY_MISSING', message: '서버에 Bootpay Commerce 키가 설정되지 않아 무통장 입금을 받을 수 없습니다.' }
    // 계좌 확인은 부트페이가 한다 — 고른 id 가 목록에 없으면 18129, 계좌가 하나도 없으면 18128 로 거절된다.
    // 안내할 계좌는 등록 응답의 스냅샷이 정본이고, 응답에 계좌가 없는 서버면 목록에서 고른 계좌(없으면 대표)를 쓴다
    // — 부트페이에 등록까지 해 놓고 계좌가 없다고 주문을 버리지 않게 (코드리뷰 2026-10-21)
    let accounts = []
    try {
        accounts = await bankAccountsFor(config, env)
    } catch (error) {
        return { ok: false, status: error.status || 424, code: error.code, message: error.message }
    }
    const chosen = accounts.find(row => row.id && row.id === order.bank_transfer?.account_id) || accounts[0] || null
    const webhookUrl = webhookUrlFor(origin, env)
    try {
        // 구매자 알림톡은 건당 과금이라 SHOP_DEPOSIT_NOTIFY=1 일 때만 켠다
        const notifyLink = env.SHOP_DEPOSIT_NOTIFY === '1' && origin?.startsWith('https://') ? `${origin}/shop/orders/complete.html?order_id=${encodeURIComponent(order.order_id)}` : ''
        const remote  = await registerBankDeposit(config, order, { webhookUrl, notifyLink })
        // 손님에게 안내할 계좌는 부트페이 응답의 스냅샷이다 — 판매자가 계좌를 고쳐도 이 주문의 안내는 그대로다
        const account = remote.account?.account_no ? remote.account : chosen
        if (!account) return { ok: false, status: 424, code: 'BANK_ACCOUNT_MISSING', message: '판매자 입금 계좌를 확인하지 못해 무통장 입금을 받을 수 없습니다.' }
        return {
            ok: true,
            order: { ...order, bank_transfer: { ...order.bank_transfer, account, order_number: remote.order_number || null, webhook: Boolean(webhookUrl), deadline: remote.deadline || null, deadline_label: remote.deadline_label || null } }
        }
    } catch (error) {
        return { ok: false, status: error.status || 424, code: error.code, message: error.message }
    }
}
