// POST /api/shop/quote — 장바구니/주문서 금액 견적
// body: { items: [{ productId, optionId?, quantity }], coupon_code? }

import { quoteCart } from '../../../shop/catalog.js'

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
    const body = await context.request.json().catch(() => ({}))
    const quote = quoteCart(body.items, { couponCode: body.coupon_code || '' })
    if (!quote.ok) return new Response(JSON.stringify({ success: false, code: quote.code, message: quote.message }), { status: 400, headers: corsHeaders })
    return new Response(JSON.stringify({ success: true, quote }), { headers: corsHeaders })
}
