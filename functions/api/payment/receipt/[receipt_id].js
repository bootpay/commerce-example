// Cloudflare Pages Functions - /api/payment/receipt/:receipt_id
// Bootpay API를 통해 결제 정보 조회

import { withPgSecret } from '../../../_shared/pg-secret.js'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
}

// 환경별 Bootpay API 설정
const ENV_CONFIG = {
    development: {
        client_key: 'toRyMm9vThyfxw_kGmTkWg',
        api_base: 'https://dev-api.bootpay.co.kr'
    },
    stage: {
        client_key: 'dS-xBsOP9MhbxlvHVidxwQ',
        api_base: 'https://stage-api.bootpay.co.kr'
    },
    production: {
        client_key: 'dS-xBsOP9MhbxlvHVidxwQ',
        api_base: 'https://api.bootpay.co.kr'
    }
}

// secret_key 는 환경변수에서 찾는다 (functions/_shared/pg-secret.js).
function getConfig(env, vars) {
    const name = ENV_CONFIG[env] ? env : 'production'
    return withPgSecret(ENV_CONFIG[name], name, vars)
}

export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders })
}

export async function onRequestGet(context) {
    try {
        const receiptId = context.params.receipt_id
        const url = new URL(context.request.url)
        const env = url.searchParams.get('env') || 'production'

        if (!receiptId) {
            return new Response(JSON.stringify({
                success: false,
                message: '영수증 ID가 필요합니다.'
            }), { status: 400, headers: corsHeaders })
        }

        const config = getConfig(env, context.env)
        if (!config.secret_key) {
            return new Response(JSON.stringify({ success: false, message: '서버에 Bootpay PG secret_key 환경변수가 설정되지 않았습니다.' }), { status: 500, headers: corsHeaders })
        }
        const apiBase = config.api_base

        // Basic Auth 헤더 생성 (client_key:secret_key를 Base64 인코딩)
        const authHeader = 'Basic ' + btoa(`${config.client_key}:${config.secret_key}`)

        // 결제 정보 조회
        const receiptResponse = await fetch(`${apiBase}/v2/receipt/${receiptId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            }
        })

        const receiptData = await receiptResponse.json()

        return new Response(JSON.stringify({
            success: true,
            data: receiptData
        }), { headers: corsHeaders })

    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            message: '결제 조회 중 오류가 발생했습니다.',
            error: error.message
        }), { status: 500, headers: corsHeaders })
    }
}
