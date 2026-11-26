// Cloudflare Pages Functions - /api/user-token
// 브랜드페이용 회원 토큰(user_token) 발급
//
// user_token 발급은 client_key/secret_key Basic Auth 로는 a_id(application_id) 를
// 해석하지 못해 실패한다. 따라서 REST 전용 키(application_id + private_key)로
//   1) POST /v2/request/token       → access_token
//   2) POST /v2/request/user/token  → user_token (Bearer)
// 의 legacy 흐름을 사용한다.

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
}

// 환경별 Bootpay REST 키 — Pages secret 에서 읽는다(코드에 두지 않는다. 공개 저장소다)
//   운영 · 스테이지: BOOTPAY_REST_APP_ID · BOOTPAY_REST_PRIVATE_KEY
//   개발:           BOOTPAY_REST_APP_ID_DEVELOPMENT · BOOTPAY_REST_PRIVATE_KEY_DEVELOPMENT
// application_id 는 REST 키여야 한다 (WEB/client application_id 와 다름)
const API_BASE = {
    development: 'https://dev-api.bootpay.co.kr',
    stage: 'https://stage-api.bootpay.co.kr',
    production: 'https://api.bootpay.co.kr'
}

function getConfig(env, vars) {
    const name = API_BASE[env] ? env : 'production'
    const dev = name === 'development'
    return {
        application_id: dev ? vars.BOOTPAY_REST_APP_ID_DEVELOPMENT : vars.BOOTPAY_REST_APP_ID,
        private_key: dev ? vars.BOOTPAY_REST_PRIVATE_KEY_DEVELOPMENT : vars.BOOTPAY_REST_PRIVATE_KEY,
        api_base: API_BASE[name]
    }
}

export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders })
}

export async function onRequestPost(context) {
    try {
        const body = await context.request.json().catch(() => ({}))
        const { user_id, email, username, phone, gender, env } = body

        if (!user_id) {
            return new Response(JSON.stringify({
                success: false,
                message: 'user_id 가 필요합니다.'
            }), { status: 400, headers: corsHeaders })
        }

        const config = getConfig(env, context.env || {})
        if (!config.application_id || !config.private_key) {
            return new Response(JSON.stringify({
                success: false,
                message: 'REST 키가 설정되지 않았습니다 (BOOTPAY_REST_APP_ID · BOOTPAY_REST_PRIVATE_KEY).'
            }), { status: 500, headers: corsHeaders })
        }
        const apiBase = config.api_base

        // 1. access_token 발급 (REST application_id + private_key)
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

        // 2. user_token 발급 (Bearer)
        const userTokenResponse = await fetch(`${apiBase}/v2/request/user/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenData.access_token}`
            },
            body: JSON.stringify({
                user_id,
                email,
                username,
                phone,
                gender
            })
        })
        const userTokenData = await userTokenResponse.json()

        if (!userTokenData.user_token) {
            return new Response(JSON.stringify({
                success: false,
                message: 'user_token 발급 실패',
                error: userTokenData
            }), { status: 500, headers: corsHeaders })
        }

        return new Response(JSON.stringify({
            success: true,
            user_token: userTokenData.user_token,
            expired_at: userTokenData.expired_at
        }), { headers: corsHeaders })

    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            message: 'user_token 발급 중 오류가 발생했습니다.',
            error: error.message
        }), { status: 500, headers: corsHeaders })
    }
}
