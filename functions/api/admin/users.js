import { listUsers, requireAdmin } from '../../_shared/demo-store.js'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Demo-Admin-Id',
    'Content-Type': 'application/json'
}

export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders })
}

export async function onRequestGet(context) {
    try {
        requireAdmin(context.request)
        return new Response(JSON.stringify({ success: true, users: listUsers() }), { headers: corsHeaders })
    } catch (error) {
        return new Response(JSON.stringify({ success: false, message: error.message }), {
            status: error.status || 500,
            headers: corsHeaders
        })
    }
}
