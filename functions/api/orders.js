// Cloudflare Pages Functions - /api/orders
// Widget 예제용 주문 생성 API

// 상품 정보 (서버에서 관리 - 위변조 방지)
const PRODUCTS = {
    'premium_earphone': { name: '프리미엄 무선 이어폰 Pro Max', price: 4000 }
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
export async function onRequestGet(context) {
    // Cloudflare KV에서 주문 목록 조회 (실제 구현 시)
    // const orders = await context.env.ORDERS_KV.list()

    return new Response(JSON.stringify({
        success: true,
        message: 'Orders API is working',
        orders: []
    }), { headers: corsHeaders })
}

// POST /api/orders - 주문 생성
export async function onRequestPost(context) {
    try {
        const body = await context.request.json()
        const { product_id, quantity, coupon_code, mileage_amount, pg, method } = body

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

        // 실제 환경에서는 KV 또는 D1에 저장
        // await context.env.ORDERS_KV.put(orderId, JSON.stringify(order))

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
