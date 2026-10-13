// POST /api/auth/identity — 회원가입 전 본인인증 결과 확인
// body: { receipt_id } → { verification_token, identity }

import { fetchCertificate, hashIdentity, maskEmail, parseCertificate, pgConfigFor, publicIdentity } from '../../_shared/identity.js'
import { findUserByCiHash, verificationStore } from '../../_shared/demo-store.js'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders })

export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders })
}

export async function onRequestPost(context) {
    const body = await context.request.json().catch(() => ({}))
    const receiptId = String(body.receipt_id || body.receiptId || '').trim()
    if (!receiptId) return json({ success: false, code: 'RECEIPT_REQUIRED', message: '본인인증 영수증 ID가 없습니다.' }, 400)

    const config = pgConfigFor(new URL(context.request.url).hostname, context.env)
    if (!config) return json({ success: false, code: 'PG_KEY_MISSING', message: '서버에 Bootpay PG 키(BOOTPAY_CLIENT_KEY / BOOTPAY_SECRET_KEY)가 설정되지 않았습니다.' }, 500)

    try {
        const identity = parseCertificate(await fetchCertificate(receiptId, config))
        const ciHash = await hashIdentity(identity.unique)
        const existing = findUserByCiHash(ciHash)
        if (existing) {
            return json({ success: false, code: 'IDENTITY_ALREADY_LINKED', message: '이미 가입된 회원입니다. 기존 계정으로 로그인해 주세요.', email: maskEmail(existing.email) }, 409)
        }
        const token = verificationStore.issue(identity, ciHash)
        return json({ success: true, verification_token: token, identity: publicIdentity(identity) })
    } catch (error) {
        console.error('[본인인증 확인 실패]', error.code, error.message)
        return json({ success: false, code: error.code || 'IDENTITY_FAILED', message: error.message || '본인인증 확인에 실패했습니다.' }, error.status || 400)
    }
}
