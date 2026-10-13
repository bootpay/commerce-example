import { authenticateUser, getDemoCredentials } from '../../_shared/demo-store.js'

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
        const body = await context.request.json().catch(() => ({}))
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
