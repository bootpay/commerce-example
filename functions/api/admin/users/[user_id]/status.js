import { requireAdmin, updateUserStatus } from '../../../../_shared/demo-store.js'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Demo-Admin-Id',
    'Content-Type': 'application/json'
}

export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders })
}

async function handle(context) {
    try {
        requireAdmin(context.request)
        const body = await context.request.json().catch(() => ({}))
        const user = updateUserStatus(context.params.user_id, body.status)
        if (!user) {
            return new Response(JSON.stringify({ success: false, message: '회원을 찾을 수 없습니다.' }), {
                status: 404,
                headers: corsHeaders
            })
        }
        return new Response(JSON.stringify({ success: true, user }), { headers: corsHeaders })
    } catch (error) {
        return new Response(JSON.stringify({ success: false, message: error.message }), {
            status: error.status || 400,
            headers: corsHeaders
        })
    }
}

export const onRequestPost = handle
export const onRequestPatch = handle
