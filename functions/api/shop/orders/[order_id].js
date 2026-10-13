// GET /api/shop/orders/:order_id?user_id= — 본인 주문 1건 (결제 완료 화면용)

import { getOrder } from '../../../_shared/demo-store.js'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
}

export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders })
}

export async function onRequestGet(context) {
    const userId = new URL(context.request.url).searchParams.get('user_id')
    const order = getOrder(context.params.order_id)
    // 다른 회원의 주문은 존재 여부도 알려주지 않는다.
    if (!order || !userId || order.user_id !== userId) {
        return new Response(JSON.stringify({ success: false, code: 'ORDER_NOT_FOUND', message: '주문을 찾을 수 없습니다.' }), { status: 404, headers: corsHeaders })
    }
    return new Response(JSON.stringify({ success: true, order }), { headers: corsHeaders })
}
