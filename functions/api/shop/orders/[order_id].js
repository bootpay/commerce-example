// GET /api/shop/orders/:order_id?user_id= — 본인 주문 1건 (결제 완료 화면용)

import { getOrder, saveOrder } from '../../../_shared/demo-store.js'
import { refreshBankOrder } from '../../../_shared/bank-deposit.js'
import { commerceConfigForHost } from '../../../_shared/shop-order.js'

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
    // 입금대기면 부트페이에 다시 물어 상태를 맞춘다 (완료 화면이 몇 초마다 이 길을 부른다)
    const config = commerceConfigForHost(new URL(context.request.url).hostname, context.env)
    const synced = await refreshBankOrder(config, order, { read: getOrder, write: saveOrder, includePaid: true })
    return new Response(JSON.stringify({ success: true, order: synced }), { headers: corsHeaders })
}
