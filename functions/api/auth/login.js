import { authenticateUser, demoMemberFrom, getDemoCredentials, seedDemoMember } from '../../_shared/demo-store.js'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
}

export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders })
}

// 로그인 화면 자동 입력용 — 데모 회원(DEMO_MEMBER_*)을 넣었을 때만 값을 준다
export async function onRequestGet(context) {
    const member = demoMemberFrom(context.env)
    const demo = member ? { email: member.email, password: member.password } : null
    return new Response(JSON.stringify({ success: true, demo }), { headers: corsHeaders })
}

export async function onRequestPost(context) {
    try {
        const body = await context.request.json().catch(() => ({}))
        seedDemoMember(context.env)
        const user = authenticateUser(body.email, body.password)
        if (!user) {
            return new Response(JSON.stringify({
                success: false,
                message: '이메일 또는 비밀번호가 올바르지 않습니다.',
                demo: getDemoCredentials()
            }), { status: 401, headers: corsHeaders })
        }
        return new Response(JSON.stringify({ success: true, user }), { headers: corsHeaders })
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            message: error.message || '로그인 중 오류가 발생했습니다.'
        }), { status: error.code === 'INACTIVE_USER' ? 403 : 400, headers: corsHeaders })
    }
}
