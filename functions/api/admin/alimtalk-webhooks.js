import { listAlimtalkWebhooks, requireAdmin } from '../../_shared/demo-store.js'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Demo-Admin-Id',
    'Content-Type': 'application/json'
}

export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders })
}

// 받은 알림톡 웹훅 목록 — 비밀값을 넣었는지도 같이 준다 (화면이 「서명 확인 안 함」을 안내한다)
export async function onRequestGet(context) {
    try {
        requireAdmin(context.request)
        return new Response(JSON.stringify({
            success: true,
            secret_configured: Boolean(context.env.ALIMTALK_WEBHOOK_SECRET),
            webhooks: listAlimtalkWebhooks()
        }), { headers: corsHeaders })
    } catch (error) {
        return new Response(JSON.stringify({ success: false, message: error.message }), {
            status: error.status || 500,
            headers: corsHeaders
        })
    }
}
