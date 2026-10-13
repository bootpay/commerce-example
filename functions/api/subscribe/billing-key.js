// Cloudflare Pages Functions - /api/subscribe/billing-key
// 자동결제(정기결제) — 빌링키 조회 + 첫 회차 정기결제 승인
//
// 흐름
//  1) 클라이언트가 Bootpay.requestSubscription() 으로 빌링키를 발급받고 receipt_id 를 전달
//  2) GET  /v2/subscribe/billing_key/{receipt_id}  → billing_key 조회
//  3) POST /v2/subscribe/payment                   → billing_key 로 첫 정기결제 승인
//
// 보안 포인트: 결제 금액은 클라이언트를 신뢰하지 않고 서버의 PLANS 에서 계산한다.

import { withPgSecret } from '../../_shared/pg-secret.js'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
}

// 환경별 Bootpay API 설정 (secret_key 는 절대 클라이언트로 노출하지 않을 것)
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

// 다음 결제 예정일 = 한 달 뒤 (데모용)
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
        const { receipt_id, plan_id, env } = body

        if (!receipt_id) {
            return new Response(JSON.stringify({
                success: false,
                message: 'receipt_id 가 필요합니다. (빌링키 발급 영수증)'
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

        // 1. 빌링키 조회 (클라이언트가 발급받은 receipt_id 로)
        const billingResponse = await fetch(`${apiBase}/v2/subscribe/billing_key/${receipt_id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            }
        })
        const billingData = await billingResponse.json()
        const billingKey = billingData.billing_key
        if (!billingKey) {
            return new Response(JSON.stringify({
                success: false,
                message: '빌링키 조회에 실패했습니다.',
                error: billingData
            }), { status: 400, headers: corsHeaders })
        }

        // 2. 첫 회차 정기결제 승인 (서버 가격으로 청구)
        const orderId = 'SUB_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11)
        const chargeResponse = await fetch(`${apiBase}/v2/subscribe/payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify({
                billing_key: billingKey,
                order_id: orderId,
                order_name: plan.name,
                price: plan.price
            })
        })
        const charge = await chargeResponse.json()

        // status 1 = 결제 완료
        if (charge.status !== 1) {
            return new Response(JSON.stringify({
                success: false,
                message: '첫 정기결제 승인에 실패했습니다.',
                billing_key: billingKey,
                error: charge
            }), { status: 400, headers: corsHeaders })
        }

        const card = billingData.billing_data || {}

        return new Response(JSON.stringify({
            success: true,
            billing_key: billingKey,
            card_company: card.card_company || charge.card_data?.card_company || null,
            card_no: card.card_no || charge.card_data?.card_no || null,
            subscription_id: billingData.subscription_id || null,
            billing_expire_at: billingData.billing_expire_at || null,
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
