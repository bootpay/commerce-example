// 쇼핑몰 주문서 → 주문 레코드. server.js 와 Cloudflare Functions 가 같이 쓴다.
import { quoteCart } from '../../shop/catalog.js'
import { pgConfigFor } from './identity.js'

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
        status: 'pending',
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
