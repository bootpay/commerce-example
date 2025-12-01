// Cloudflare Pages Functions - /api/orders/verify

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
}

export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders })
}

export async function onRequestPost(context) {
    try {
        const body = await context.request.json()
        const { receipt_id, order_id } = body

        // 실제 환경에서는:
        // 1. KV/D1에서 주문 정보 조회
        // 2. Bootpay API로 결제 정보 조회
        // 3. 금액 비교 검증

        // 데모용 응답
        return new Response(JSON.stringify({
            success: true,
            message: '결제가 정상적으로 확인되었습니다.',
            order: {
                order_id,
                receipt_id,
                status: 'paid',
                paid_at: new Date().toISOString()
            }
        }), { headers: corsHeaders })

    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            message: '결제 검증 중 오류가 발생했습니다.',
            error: error.message
        }), { status: 500, headers: corsHeaders })
    }
}
