// Cloudflare Pages Functions - /api/orders
// Widget 예제용 주문 생성 API

import { getRawUser, listOrders, saveOrder } from '../_shared/demo-store.js'
import { createShopOrder } from '../_shared/shop-order.js'

// 상품 정보 (서버에서 관리 - 위변조 방지)
const PRODUCTS = {
    'premium_earphone': { name: '프리미엄 무선 이어폰 Pro Max', price: 4000 },
    'smart_watch': { name: '헬스케어 스마트 워치', price: 12900 },
    'desk_lamp': { name: '무드 LED 데스크 램프', price: 7900 }
}

// 쿠폰 정보
const COUPONS = {
    'WELCOME10': { name: '첫 구매 10% 할인', type: 'percent', value: 10 },
    'SAVE5000': { name: '5,000원 할인', type: 'fixed', value: 5000 },
    'SUMMER20': { name: '여름 특가 20% 할인', type: 'percent', value: 20 }
}

// CORS 헤더
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
}

// OPTIONS 요청 처리 (CORS preflight)
export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders })
}

// GET /api/orders - 전체 주문 목록 (데모용)
export async function onRequestGet() {
    return new Response(JSON.stringify({
        success: true,
        orders: listOrders()
    }), { headers: corsHeaders })
}

// POST /api/orders - 주문 생성
export async function onRequestPost(context) {
    try {
        const body = await context.request.json()

        // 쇼핑몰 데모 주문서: 여러 상품·옵션 + 배송지. 금액은 shop/catalog.js 로 서버가 계산한다.
        if (Array.isArray(body.items)) {
            const result = createShopOrder(body, getRawUser(body.user_id))
            if (!result.ok) {
                return new Response(JSON.stringify({ success: false, code: result.code, message: result.message }), { status: result.status, headers: corsHeaders })
            }
            saveOrder(result.order)
            return new Response(JSON.stringify(result.response), { headers: corsHeaders })
        }

        const { product_id, quantity, coupon_code, mileage_amount, pg, method, user_id } = body

        // 1. 상품 검증
        const product = PRODUCTS[product_id]
        if (!product) {
            return new Response(JSON.stringify({
                success: false,
                message: '존재하지 않는 상품입니다.'
            }), { status: 400, headers: corsHeaders })
        }

        // 2. 서버에서 금액 계산
        let totalPrice = product.price * (quantity || 1)

        // 3. 쿠폰 할인 적용
        if (coupon_code) {
            const coupon = COUPONS[coupon_code]
            if (coupon) {
                if (coupon.type === 'percent') {
                    totalPrice -= Math.floor(totalPrice * (coupon.value / 100))
                } else {
                    totalPrice -= coupon.value
                }
            }
        }

        // 4. 적립금 차감
        if (mileage_amount && mileage_amount > 0) {
            const maxMileage = 3000
            const appliedMileage = Math.min(mileage_amount, maxMileage)
            totalPrice -= appliedMileage
        }

        // 5. 최소 금액 보장
        totalPrice = Math.max(0, totalPrice)

        // 6. 주문 ID 생성
        const orderId = 'ORDER_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)

        saveOrder({
            order_id: orderId,
            product_id,
            product_name: product.name,
            quantity: quantity || 1,
            original_price: product.price * (quantity || 1),
            coupon_code,
            mileage_amount: mileage_amount || 0,
            total_price: totalPrice,
            pg: pg || 'nicepay',
            method: method || 'card',
            user_id: user_id || null,
            status: 'pending',
            created_at: new Date().toISOString()
        })

        return new Response(JSON.stringify({
            success: true,
            order_id: orderId,
            order_name: product.name,
            price: totalPrice,
            pg: pg || 'nicepay',
            method: method || 'card'
        }), { headers: corsHeaders })

    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            message: '주문 생성 중 오류가 발생했습니다.',
            error: error.message
        }), { status: 500, headers: corsHeaders })
    }
}
