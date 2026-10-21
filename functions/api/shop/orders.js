// GET /api/shop/orders?user_id= — 회원 본인 주문 내역 (데모: localStorage 회원 ID 기준)

import { getOrder, getUser, listOrdersForUser, saveOrder } from '../../_shared/demo-store.js'
import { refreshBankOrder } from '../../_shared/bank-deposit.js'
import { commerceConfigForHost } from '../../_shared/shop-order.js'

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
    if (!getUser(userId)) {
        return new Response(JSON.stringify({ success: false, code: 'LOGIN_REQUIRED', message: '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.' }), { status: 401, headers: corsHeaders })
    }
    // 입금대기 주문은 부트페이에 다시 물어 상태를 맞춘다 — 웹훅이 못 닿는 자리에서도 바뀌도록
    const config = commerceConfigForHost(new URL(context.request.url).hostname, context.env)
    const orders = await Promise.all(listOrdersForUser(userId).map(order => refreshBankOrder(config, order, { read: getOrder, write: saveOrder })))
    return new Response(JSON.stringify({ success: true, orders }), { headers: corsHeaders })
}
