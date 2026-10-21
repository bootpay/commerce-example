import { cancelOrder, getOrder, requireAdmin } from '../../../../_shared/demo-store.js'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Demo-Admin-Id',
    'Content-Type': 'application/json'
}

export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders })
}

export async function onRequestPost(context) {
    try {
        const admin = requireAdmin(context.request)
        const orderId = context.params.order_id
        const order = getOrder(orderId)
        if (!order) {
            return new Response(JSON.stringify({ success: false, message: '결제내역을 찾을 수 없습니다.' }), {
                status: 404,
                headers: corsHeaders
            })
        }
        if (order.status === 'cancelled') {
            return new Response(JSON.stringify({ success: false, message: '이미 취소된 결제입니다.' }), {
                status: 409,
                headers: corsHeaders
            })
        }

        const body = await context.request.json().catch(() => ({}))
        // 무통장 입금대기 주문은 이 쇼핑몰에서만 취소한다 — 부트페이에는 입금대기 취소가 없다.
        // 취소한 뒤 늦게 들어온 입금이 부트페이에서 붙어도 이 주문은 취소로 남는다 (refreshBankOrder 가 취소 주문을 안 본다)
        const cancelled = cancelOrder(orderId, {
            reason: body.reason,
            cancel_price: body.cancel_price,
            cancelled_by: admin.id,
            mode: 'memory'
        })

        return new Response(JSON.stringify({
            success: true,
            payment: cancelled,
            message: '데모 메모리 결제내역을 취소 처리했습니다.'
        }), { headers: corsHeaders })
    } catch (error) {
        return new Response(JSON.stringify({ success: false, message: error.message }), {
            status: error.status || 400,
            headers: corsHeaders
        })
    }
}
