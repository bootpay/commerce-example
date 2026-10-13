// POST /api/auth/register — 본인인증을 마친 사용자만 가입한다.
// body: { verification_token, email, password }

import { createUser, verificationStore } from '../../_shared/demo-store.js'

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
    const verification = verificationStore.peek(String(body.verification_token || ''))
    if (!verification) {
        return json({ success: false, code: 'VERIFICATION_REQUIRED', message: '본인인증이 필요하거나 인증 시간이 지났습니다. 다시 인증해 주세요.' }, 400)
    }
    try {
        const user = createUser({ email: body.email, password: body.password, identity: verification.identity, ciHash: verification.ciHash })
        verificationStore.consume(body.verification_token)
        return json({ success: true, user })
    } catch (error) {
        const status = error.code === 'DUPLICATE_EMAIL' || error.code === 'IDENTITY_ALREADY_LINKED' ? 409 : 400
        return json({ success: false, code: error.code, message: error.message || '회원가입 중 오류가 발생했습니다.' }, status)
    }
}
