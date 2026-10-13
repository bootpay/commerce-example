// GET /api/shop/config — 결제창·본인인증창에 쓸 client_key 와 모드 (secret_key 는 내려주지 않는다)

import { publicPgConfig } from '../../_shared/identity.js'

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
    const config = publicPgConfig(new URL(context.request.url).hostname, context.env)
    if (!config) {
        return new Response(JSON.stringify({ success: false, code: 'PG_KEY_MISSING', message: '서버에 Bootpay PG 키가 설정되지 않았습니다.' }), { status: 500, headers: corsHeaders })
    }
    return new Response(JSON.stringify({ success: true, ...config }), { headers: corsHeaders })
}
