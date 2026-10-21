// POST /api/shop/bank-deposit/webhook — 부트페이 입금 웹훅 (뱅크알람이 입금을 주문에 붙였을 때)
//
// 본문은 { event, idempotency_key, data: { merchant_order_id, order_number, status, amount, account, ... } } 이다.
// 먼저 X-Bootpay-Signature 를 확인한다 — 비밀값은 POST /v1/sdk/deposits/webhook_secret 으로 받아 SHOP_WEBHOOK_SECRET 에 둔다.
// 본문을 그대로 믿지 않는다 — merchant_order_id 만 꺼내 GET /v1/sdk/deposits/:id 로 다시 조회하고,
// 그 값으로만 주문을 바꾼다. 같은 웹훅이 여러 번 와도 결과가 같다 (이미 바뀐 주문은 그대로 둔다).
// 부트페이는 2xx 가 아니면 다시 보내므로, 우리 주문이 아닌 것은 200 으로 받고 끝내고
// 다시 조회가 실패했을 때만 500 으로 답해 재전송을 받는다.

import { getOrder, saveOrder } from '../../../_shared/demo-store.js'
import { refreshBankOrder, verifyWebhookSignature } from '../../../_shared/bank-deposit.js'
import { commerceConfigForHost } from '../../../_shared/shop-order.js'

const headers = { 'Content-Type': 'application/json' }

export async function onRequestPost(context) {
    // 서명 · 시각부터 본다 (SHOP_WEBHOOK_SECRET). 통과해도 본문은 믿지 않고 아래에서 부트페이에 다시 묻는다
    const raw = await context.request.text()
    if (!(await verifyWebhookSignature(raw, context.request.headers, context.env.SHOP_WEBHOOK_SECRET))) {
        return new Response(JSON.stringify({ success: false, message: '웹훅 서명이 맞지 않습니다.' }), { status: 401, headers })
    }
    const body = (() => { try { return JSON.parse(raw) } catch { return {} } })()
    const order = getOrder(String(body?.data?.merchant_order_id || ''))
    if (!order) return new Response(JSON.stringify({ success: true, ignored: true }), { headers })

    const config = commerceConfigForHost(new URL(context.request.url).hostname, context.env)
    if (!config) return new Response(JSON.stringify({ success: false, message: 'Commerce 키가 없습니다.' }), { status: 500, headers })
    try {
        const saved = await refreshBankOrder(config, order, { read: getOrder, write: saveOrder, includePaid: true, throwOnError: true })
        return new Response(JSON.stringify({ success: true, status: saved.status }), { headers })
    } catch (error) {
        // 다시 조회하지 못했으면 실패로 답한다 — 부트페이가 다시 보낸다
        return new Response(JSON.stringify({ success: false, message: error.message }), { status: 500, headers })
    }
}
