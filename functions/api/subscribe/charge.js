// Cloudflare Pages Functions - /api/subscribe/charge
// 자동결제(정기결제) — 저장된 빌링키로 다음 회차 결제
//
// 최초 등록(빌링키 발급) 이후에는 카드 입력 없이 billing_key 만으로 반복 청구할 수 있다.
// 실서비스에서는 이 호출을 스케줄러(cron)가 결제 주기마다 자동 실행한다.
//   POST /v2/subscribe/payment  { billing_key, order_id, order_name, price }

import { withPgSecret } from '../../_shared/pg-secret.js'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
}

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

// 멤버십 플랜 (서버에서 가격 관리 - 위변조 방지)
const PLANS = {
    membership_basic: { name: 'TechMall 멤버십 Basic (월 자동결제)', price: 9900 },
    membership_pro: { name: 'TechMall 멤버십 Pro (월 자동결제)', price: 19900 },
    membership_premium: { name: 'TechMall 멤버십 Premium (월 자동결제)', price: 29900 }
}

// secret_key 는 환경변수에서 찾는다 (functions/_shared/pg-secret.js).
function getConfig(env, vars) {
    const name = ENV_CONFIG[env] ? env : 'production'
    return withPgSecret(ENV_CONFIG[name], name, vars)
}

function nextBillingDate() {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    return d.toISOString()
}

export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders })
}

export async function onRequestPost(context) {
    try {
        const body = await context.request.json().catch(() => ({}))
        const { billing_key, plan_id, env } = body

        if (!billing_key) {
            return new Response(JSON.stringify({
                success: false,
                message: 'billing_key 가 필요합니다.'
            }), { status: 400, headers: corsHeaders })
        }

        const plan = PLANS[plan_id]
        if (!plan) {
            return new Response(JSON.stringify({
                success: false,
                message: '존재하지 않는 플랜입니다.'
            }), { status: 400, headers: corsHeaders })
        }

        const config = getConfig(env, context.env)
        if (!config.secret_key) {
            return new Response(JSON.stringify({ success: false, message: '서버에 Bootpay PG secret_key 환경변수가 설정되지 않았습니다.' }), { status: 500, headers: corsHeaders })
        }
        const apiBase = config.api_base

        // Basic Auth 헤더 생성 (client_key:secret_key를 Base64 인코딩)
        const authHeader = 'Basic ' + btoa(`${config.client_key}:${config.secret_key}`)

        // 빌링키로 정기결제 승인 (카드 재입력 없음)
        const orderId = 'SUB_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11)
        const chargeResponse = await fetch(`${apiBase}/v2/subscribe/payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify({
                billing_key,
                order_id: orderId,
                order_name: plan.name,
                price: plan.price
            })
        })
        const charge = await chargeResponse.json()

        if (charge.status !== 1) {
            return new Response(JSON.stringify({
                success: false,
                message: '정기결제 승인에 실패했습니다.',
                error: charge
            }), { status: 400, headers: corsHeaders })
        }

        return new Response(JSON.stringify({
            success: true,
            receipt_id: charge.receipt_id,
            order_id: charge.order_id || orderId,
            order_name: plan.name,
            price: charge.price ?? plan.price,
            plan_id,
            status: charge.status,
            purchased_at: charge.purchased_at || null,
            next_billing_at: nextBillingDate()
        }), { headers: corsHeaders })

    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            message: '정기결제 처리 중 오류가 발생했습니다.',
            error: error.message
        }), { status: 500, headers: corsHeaders })
    }
}
