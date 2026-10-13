// GET /api/shop/orders?user_id= — 회원 본인 주문 내역 (데모: localStorage 회원 ID 기준)

import { getUser, listOrdersForUser } from '../../_shared/demo-store.js'

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
    return new Response(JSON.stringify({ success: true, orders: listOrdersForUser(userId) }), { headers: corsHeaders })
}
