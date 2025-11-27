// Cloudflare Pages Functions - /api/orders/plan

// 환경별 상품 정보
const ENV_PRODUCTS = {
    development: {
        '69268625d8df8fa1837cf661': { name: 'CloudSync Pro Starter 플랜 (월간)', price: 9900 },
        '692686e5d8df8fa1837cf66b': { name: 'CloudSync Pro Professional 플랜 (월간)', price: 29900 },
        '69268783d8df8fa1837cf675': { name: 'CloudSync Pro Enterprise 플랜 (월간)', price: 99000 },
        '692686c4d8df8fa1837cf666': { name: 'CloudSync Pro Starter 플랜 (연간)', price: 7900 },
        '69268721d8df8fa1837cf670': { name: 'CloudSync Pro Professional 플랜 (연간)', price: 23900 },
        '692687a2d8df8fa1837cf67a': { name: 'CloudSync Pro Enterprise 플랜 (연간)', price: 79000 }
    },
    stage: {
        '6927d893ff30795ff003d374': { name: 'CloudSync Pro Starter 플랜 (월간)', price: 9900 },
        '6927d8f9ff30795ff003d379': { name: 'CloudSync Pro Professional 플랜 (월간)', price: 29900 },
        '6927d8c310561eabadddcfae': { name: 'CloudSync Pro Starter 플랜 (연간)', price: 7900 },
        '6927d9167f65277ba9ddcf71': { name: 'CloudSync Pro Professional 플랜 (연간)', price: 23900 }
    },
    production: {
        '6927d893ff30795ff003d374': { name: 'CloudSync Pro Starter 플랜 (월간)', price: 9900 },
        '6927d8f9ff30795ff003d379': { name: 'CloudSync Pro Professional 플랜 (월간)', price: 29900 },
        '6927d8c310561eabadddcfae': { name: 'CloudSync Pro Starter 플랜 (연간)', price: 7900 },
        '6927d9167f65277ba9ddcf71': { name: 'CloudSync Pro Professional 플랜 (연간)', price: 23900 }
    }
}

function getProducts(env) {
    return ENV_PRODUCTS[env] || ENV_PRODUCTS.production
}

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
        const { product_id, plan_key, billing_type, env = 'production' } = body

        const products = getProducts(env)
        const product = products[product_id]
        if (!product) {
            return new Response(JSON.stringify({
                success: false,
                message: '존재하지 않는 플랜입니다.',
                debug: { product_id, env, available_ids: Object.keys(products) }
            }), { status: 400, headers: corsHeaders })
        }

        const orderId = 'PLAN_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)

        return new Response(JSON.stringify({
            success: true,
            order_id: orderId,
            order_name: product.name,
            price: product.price,
            product_id
        }), { headers: corsHeaders })

    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            message: '플랜 주문 생성 중 오류가 발생했습니다.',
            error: error.message
        }), { status: 500, headers: corsHeaders })
    }
}
