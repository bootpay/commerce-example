import { cancelOrder, getOrder, requireAdmin } from '../../../../_shared/demo-store.js'
import { closeBankDepositOnCancel } from '../../../../_shared/bank-deposit.js'
import { commerceConfigForHost } from '../../../../_shared/shop-order.js'

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
        // 무통장 입금대기는 부트페이 입금대기도 닫는다. 이미 입금됐으면 여기서 멈춘다
        const bank = await closeBankDepositOnCancel(commerceConfigForHost(new URL(context.request.url).hostname, context.env), order)
        const cancelled = cancelOrder(orderId, {
            reason: body.reason,
            cancel_price: body.cancel_price,
            cancelled_by: admin.id,
            mode: bank?.mode || 'memory'
        })

        return new Response(JSON.stringify({
            success: true,
            payment: cancelled,
            message: bank?.message || '데모 메모리 결제내역을 취소 처리했습니다.'
        }), { headers: corsHeaders })
    } catch (error) {
        return new Response(JSON.stringify({ success: false, message: error.message }), {
            status: error.status || 400,
            headers: corsHeaders
        })
    }
}
