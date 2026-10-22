// POST /api/alimtalk/webhook — 부트페이 알림톡 웹훅 (발송 결과 · 예약 취소 · 템플릿 검수 등)
//
// 서명은 ALIMTALK_WEBHOOK_SECRET(관리자 › 메시지 설정 › 웹훅의 키)으로 확인한다. 받은 웹훅은 관리자 › 알림톡 웹훅에 쌓인다.
// 규칙은 functions/_shared/alimtalk-webhook.js.

import { getAlimtalkWebhook, saveAlimtalkWebhook } from '../../_shared/demo-store.js'
import { receiveAlimtalkWebhook } from '../../_shared/alimtalk-webhook.js'

const headers = { 'Content-Type': 'application/json' }

export async function onRequestPost(context) {
    const raw = await context.request.text()
    const existing = getAlimtalkWebhook(String(context.request.headers.get('x-bootpay-delivery-id') || ''))
    const { status, body, row } = await receiveAlimtalkWebhook(raw, context.request.headers, context.env.ALIMTALK_WEBHOOK_SECRET, existing)
    if (row) saveAlimtalkWebhook(row)
    return new Response(JSON.stringify(body), { status, headers })
}
