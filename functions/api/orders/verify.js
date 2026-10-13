// Cloudflare Pages Functions - /api/orders/verify

import { getOrder, saveOrder } from '../../_shared/demo-store.js'
import { verifyShopReceipt } from '../../_shared/shop-order.js'

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

        const shopOrder = getOrder(order_id)
        if (shopOrder?.order_id?.startsWith('SHOP_')) {
            if (shopOrder.status === 'paid') return new Response(JSON.stringify({ success: true, order: shopOrder }), { headers: corsHeaders })
            const result = await verifyShopReceipt(new URL(context.request.url).hostname, context.env, shopOrder, receipt_id)
            if (!result.ok) {
                if (result.orderStatus) saveOrder({ ...shopOrder, receipt_id, status: result.orderStatus })
                return new Response(JSON.stringify({ success: false, message: result.message }), { status: result.status, headers: corsHeaders })
            }
            const order = saveOrder({ ...shopOrder, receipt_id, status: 'paid', paid_at: new Date().toISOString() })
            return new Response(JSON.stringify({ success: true, message: '결제가 정상적으로 확인되었습니다.', order }), { headers: corsHeaders })
        }

        const existingOrder = getOrder(order_id) || {
            order_id,
            total_price: null,
            status: 'pending',
            created_at: new Date().toISOString()
        }
        const order = saveOrder({
            ...existingOrder,
            receipt_id,
            status: 'paid',
            paid_at: new Date().toISOString()
        })

        return new Response(JSON.stringify({
            success: true,
            message: '결제가 정상적으로 확인되었습니다.',
            order
        }), { headers: corsHeaders })

    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            message: '결제 검증 중 오류가 발생했습니다.',
            error: error.message
        }), { status: 500, headers: corsHeaders })
    }
}
