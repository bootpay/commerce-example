// 알림톡 웹훅 수신 — server.js 와 Cloudflare Functions 가 같이 쓴다.
//
// 부트페이는 알림톡 발송 결과(성공 · 실패 · 예약 취소 · 템플릿 검수 등)를 관리자 › 메시지 설정 › 웹훅에 적은 주소로 보낸다.
// 본문은 { event, event_code, occurred_at, data: { receipt_id, ref_id, to, template_code, status, error_code, ... } } 이고
// 헤더에 X-Bootpay-Delivery-Id · X-Bootpay-Timestamp · X-Bootpay-Signature 가 붙는다. 서명 규칙은 입금 웹훅과 같다
// (verifyWebhookSignature). 비밀값은 입금 웹훅과 **다른 키**다 — 알림톡 웹훅 설정의 키를 ALIMTALK_WEBHOOK_SECRET 에 둔다.
//
// 이 데모는 받은 웹훅을 그대로 쌓아 관리자 › 알림톡 웹훅에서 보여 준다. 같은 전송을 다시 보내면(부트페이 재시도)
// 같은 Delivery-Id 이므로 한 줄로 두고 받은 횟수만 늘린다.

import { verifyWebhookSignature } from './bank-deposit.js'

// 받은 웹훅을 이만큼만 남긴다 — 공개 주소라 누가 계속 보내도 저장소가 끝없이 늘지 않게
export const ALIMTALK_WEBHOOK_KEEP = 200

// 받은 요청을 확인해 저장할 행과 응답을 만든다. 저장은 호출하는 쪽 저장소가 한다.
//   서명이 맞으면 verified, 비밀값을 아직 안 넣었으면 unverified 로 받고 200 — 키를 넣기 전에도 웹훅이 오는지 볼 수 있게.
//   (비밀값이 없을 때 실패로 답하면 부트페이가 재시도 끝에 연속 실패로 세어 웹훅을 자동으로 끈다)
//   서명이 틀리면 저장하지 않고 401.
export async function receiveAlimtalkWebhook(rawBody, headers, secret, existing = null) {
    const verified = secret ? await verifyWebhookSignature(rawBody, headers, secret) : false
    if (secret && !verified) {
        return { status: 401, body: { success: false, message: '웹훅 서명이 맞지 않습니다.' }, row: null }
    }
    const payload = (() => { try { return JSON.parse(rawBody) } catch { return {} } })()
    const now = new Date().toISOString()
    const id = String(headers.get('x-bootpay-delivery-id') || '') || `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const row = {
        id,
        event: String(payload?.event || headers.get('x-bootpay-webhook-event') || ''),
        event_code: payload?.event_code ?? null,
        occurred_at: payload?.occurred_at || null,
        data: payload?.data && typeof payload.data === 'object' ? payload.data : {},
        verification: verified ? 'verified' : 'unverified',
        attempts: Number(existing?.attempts || 0) + 1,
        received_at: existing?.received_at || now,
        updated_at: now
    }
    return { status: 200, body: { success: true }, row }
}

// 관리자 목록 — 최근 받은 순
export function sortAlimtalkWebhooks(rows) {
    return rows.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
}
