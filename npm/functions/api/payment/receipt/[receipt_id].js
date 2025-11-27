// Cloudflare Pages Functions - /api/payment/receipt/:receipt_id
// Bootpay API를 통해 결제 정보 조회

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
}

// 환경별 Bootpay API 설정
const ENV_CONFIG = {
    development: {
        application_id: '692682dfb2084136e29ac1dc',
        private_key: 'vz63xmu7p7Vs90yHNuggDiQYPFZVWkUZ8JJFwcBDPsI=',
        api_base: 'https://dev-api.bootpay.co.kr'
    },
    stage: {
        application_id: '6927d523472c3a791b6250d0', // Stage 환경 키 (필요시 변경)
        private_key: 'FUstljVVgv2P5733quhf+ZaZZbU8tKGMptfGrcPb1jI=',
        api_base: 'https://stage-api.bootpay.co.kr'
    },
    production: {
        application_id: '6927d523472c3a791b6250d0', // Production 환경 키
        private_key: 'FUstljVVgv2P5733quhf+ZaZZbU8tKGMptfGrcPb1jI=',
        api_base: 'https://api.bootpay.co.kr'
    }
}

function getConfig(env) {
    return ENV_CONFIG[env] || ENV_CONFIG.production
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

        const config = getConfig(env)
        const apiBase = config.api_base

        // Bootpay API 토큰 발급
        const tokenResponse = await fetch(`${apiBase}/v2/request/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                application_id: config.application_id,
                private_key: config.private_key
            })
        })

        const tokenData = await tokenResponse.json()

        if (!tokenData.access_token) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Bootpay API 인증 실패',
                error: tokenData
            }), { status: 500, headers: corsHeaders })
        }

        // 결제 정보 조회
        const receiptResponse = await fetch(`${apiBase}/v2/receipt/${receiptId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenData.access_token}`
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
