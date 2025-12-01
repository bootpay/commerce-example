// Cloudflare Pages Functions - /api/order/:order_number
// Commerce API를 통해 주문 정보 조회

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
}

// 환경별 Commerce API 설정
const ENV_CONFIG = {
    development: {
        client_key: 'hxS-Up--5RvT6oU6QJE0JA',
        secret_key: 'r5zxvDcQJiAP2PBQ0aJjSHQtblNmYFt6uFoEMhti_mg=',
        api_base: 'https://dev-api.bootapi.com/v1'
    },
    stage: {
        client_key: 'sEN72kYZBiyMNytA8nUGxQ', // Stage 환경 키 (필요시 변경)
        secret_key: 'rnZLJamENRgfwTccwmI_Uu9cxsPpAV9X2W-Htg73yfU=',
        api_base: 'https://stage-api.bootapi.com/v1'
    },
    production: {
        client_key: 'sEN72kYZBiyMNytA8nUGxQ', // Production 환경 키
        secret_key: 'rnZLJamENRgfwTccwmI_Uu9cxsPpAV9X2W-Htg73yfU=',
        api_base: 'https://api.bootapi.com/v1'
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
        const orderNumber = context.params.order_number
        const url = new URL(context.request.url)
        const env = url.searchParams.get('env') || 'production'

        if (!orderNumber) {
            return new Response(JSON.stringify({
                success: false,
                message: '주문번호가 필요합니다.'
            }), { status: 400, headers: corsHeaders })
        }

        const config = getConfig(env)
        const apiBase = config.api_base

        // Basic Auth 헤더 생성 (client_key:secret_key를 Base64 인코딩)
        const credentials = `${config.client_key}:${config.secret_key}`
        const basicAuth = btoa(credentials)

        // Commerce API 토큰 발급 (Basic Auth 사용)
        const tokenResponse = await fetch(`${apiBase}/request/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Basic ${basicAuth}`,
                'BOOTPAY-SDK-TYPE': '301',
                'BOOTPAY-ROLE': 'user'
            },
            body: JSON.stringify({
                client_key: config.client_key,
                secret_key: config.secret_key
            })
        })

        const tokenText = await tokenResponse.text()
        let tokenData
        try {
            tokenData = JSON.parse(tokenText)
        } catch (e) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Commerce API 토큰 응답 파싱 실패',
                raw: tokenText.substring(0, 500)
            }), { status: 500, headers: corsHeaders })
        }

        if (!tokenData.access_token) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Commerce API 인증 실패',
                error: tokenData
            }), { status: 500, headers: corsHeaders })
        }

        // 주문 정보 조회 (orders/{orderId} 엔드포인트)
        const orderResponse = await fetch(`${apiBase}/orders/${orderNumber}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${tokenData.access_token}`,
                'BOOTPAY-SDK-TYPE': '301',
                'BOOTPAY-ROLE': 'user'
            }
        })

        const orderText = await orderResponse.text()
        let orderData
        try {
            orderData = JSON.parse(orderText)
        } catch (e) {
            return new Response(JSON.stringify({
                success: false,
                message: '주문 정보 응답 파싱 실패',
                raw: orderText.substring(0, 500)
            }), { status: 500, headers: corsHeaders })
        }

        return new Response(JSON.stringify({
            success: true,
            data: orderData
        }), { headers: corsHeaders })

    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            message: '주문 조회 중 오류가 발생했습니다.',
            error: error.message
        }), { status: 500, headers: corsHeaders })
    }
}
