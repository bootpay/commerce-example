// Cloudflare Pages Functions - /api/orders/payment-link
// 결제링크 생성 API - Bootpay Commerce REST API 직접 호출 (fetch 사용)

// 환경별 설정
const ENV_CONFIG = {
    development: {
        client_key: 'hxS-Up--5RvT6oU6QJE0JA',
        secret_key: 'r5zxvDcQJiAP2PBQ0aJjSHQtblNmYFt6uFoEMhti_mg=',
        api_base: 'https://dev-api.bootapi.com/v1'
    },
    stage: {
        client_key: 'sEN72kYZBiyMNytA8nUGxQ',
        secret_key: 'rnZLJamENRgfwTccwmI_Uu9cxsPpAV9X2W-Htg73yfU=',
        api_base: 'https://stage-api.bootapi.com/v1'
    },
    production: {
        client_key: 'sEN72kYZBiyMNytA8nUGxQ',
        secret_key: 'rnZLJamENRgfwTccwmI_Uu9cxsPpAV9X2W-Htg73yfU=',
        api_base: 'https://api.bootapi.com/v1'
    }
}

// 알림 방법 -> send_types 변환
// 1: SMS, 2: Kakao, 3: Email, 4: Push
function getSendTypes(notificationMethod) {
    switch (notificationMethod) {
        case 'email':
            return [3]
        case 'sms':
            return [1]
        case 'both':
            return [1, 3]
        default:
            return [3]
    }
}

// 공통 헤더 생성
function getCommonHeaders() {
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Charset': 'utf-8',
        'BOOTPAY-SDK-VERSION': '1.0.0',
        'BOOTPAY-API-VERSION': '1.0.0',
        'BOOTPAY-SDK-TYPE': '301',
        'BOOTPAY-ROLE': 'user'
    }
}

// Access Token 발급
async function getAccessToken(config) {
    const credentials = btoa(`${config.client_key}:${config.secret_key}`)

    const response = await fetch(`${config.api_base}/request/token`, {
        method: 'POST',
        headers: {
            ...getCommonHeaders(),
            'Authorization': `Basic ${credentials}`
        },
        body: JSON.stringify({
            client_key: config.client_key,
            secret_key: config.secret_key
        })
    })

    const data = await response.json()
    console.log('[Payment Link] Token Response:', JSON.stringify(data, null, 2))

    if (!response.ok || !data.access_token) {
        throw new Error(data.message || data.error || 'Access Token 발급 실패')
    }

    return data.access_token
}

// Invoice 생성
async function createInvoice(config, accessToken, invoiceParams) {
    const response = await fetch(`${config.api_base}/invoices`, {
        method: 'POST',
        headers: {
            ...getCommonHeaders(),
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(invoiceParams)
    })

    const text = await response.text()
    console.log('[Payment Link] Invoice Raw Response:', text)

    let data
    try {
        data = JSON.parse(text)
    } catch (e) {
        throw new Error(`Invoice API 응답 파싱 실패: ${text.substring(0, 200)}`)
    }

    if (!response.ok) {
        throw new Error(data.message || data.error || 'Invoice 생성 실패')
    }

    return data
}

// Invoice 알림 발송
async function notifyInvoice(config, accessToken, invoiceId, sendTypes) {
    const response = await fetch(`${config.api_base}/invoices/${invoiceId}/notify`, {
        method: 'POST',
        headers: {
            ...getCommonHeaders(),
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ send_types: sendTypes })
    })

    const text = await response.text()
    let data
    try {
        data = JSON.parse(text)
    } catch (e) {
        console.warn('[Payment Link] Notify 응답 파싱 실패:', text)
        return {}
    }
    return data
}

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
        const body = await context.request.json()
        const {
            product_id,
            product_name,
            price,
            customer_name,
            customer_email,
            customer_phone,
            notification_method,
            memo,
            redirect_url,
            env = 'production'
        } = body

        // 필수 값 검증
        if (!customer_name) {
            return new Response(JSON.stringify({
                success: false,
                message: '고객명은 필수입니다.'
            }), { status: 400, headers: corsHeaders })
        }

        if (!price || price < 100) {
            return new Response(JSON.stringify({
                success: false,
                message: '결제 금액은 100원 이상이어야 합니다.'
            }), { status: 400, headers: corsHeaders })
        }

        if (!product_name) {
            return new Response(JSON.stringify({
                success: false,
                message: '상품명은 필수입니다.'
            }), { status: 400, headers: corsHeaders })
        }

        // 알림 방법에 따른 연락처 검증
        if (notification_method === 'email' || notification_method === 'both') {
            if (!customer_email) {
                return new Response(JSON.stringify({
                    success: false,
                    message: '이메일 발송을 위해 이메일 주소가 필요합니다.'
                }), { status: 400, headers: corsHeaders })
            }
        }

        if (notification_method === 'sms' || notification_method === 'both') {
            if (!customer_phone) {
                return new Response(JSON.stringify({
                    success: false,
                    message: 'SMS 발송을 위해 휴대폰 번호가 필요합니다.'
                }), { status: 400, headers: corsHeaders })
            }
        }

        // 환경별 설정 가져오기
        const config = ENV_CONFIG[env] || ENV_CONFIG.production

        // 주문 ID 생성
        const orderId = 'LINK_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11)

        console.log('[Payment Link] 환경:', env)
        console.log('[Payment Link] 주문 ID:', orderId)

        // ========================================
        // Bootpay Commerce REST API 호출 (fetch 사용)
        // ========================================

        // 1. Access Token 발급
        const accessToken = await getAccessToken(config)
        console.log('[Payment Link] Access Token 발급 완료')

        // 2. Invoice 생성 파라미터
        // 주의: extra, metadata 등을 빈 객체 {}로 보내면 Bootpay API에서 to_unsafe_h 에러 발생
        // 필요없는 파라미터는 아예 보내지 않는 것이 좋음
        const invoiceParams = {
            name: product_name,
            title: product_name,
            memo: memo || `결제링크 요청 - ${product_name}`,
            price: price,
            request_id: orderId,
            redirect_url: redirect_url,
            use_redirect: true,
            send_types: getSendTypes(notification_method)
        }

        // product_id가 있으면 추가
        if (product_id) {
            invoiceParams.product_ids = [product_id]
        }

        // 사용자 정보
        if (customer_email) {
            invoiceParams.use_editable_email = false
        }
        if (customer_phone) {
            invoiceParams.use_editable_phone = false
        }

        console.log('[Payment Link] Invoice 생성 요청:', JSON.stringify(invoiceParams, null, 2))

        // 3. Invoice 생성
        const invoiceResponse = await createInvoice(config, accessToken, invoiceParams)
        console.log('[Payment Link] Invoice 생성 응답:', JSON.stringify(invoiceResponse, null, 2))

        // 4. 알림 발송 (Invoice 생성 후)
        if (invoiceResponse.invoice_id) {
            try {
                const notifyResponse = await notifyInvoice(
                    config,
                    accessToken,
                    invoiceResponse.invoice_id,
                    getSendTypes(notification_method)
                )
                console.log('[Payment Link] 알림 발송 응답:', JSON.stringify(notifyResponse, null, 2))
            } catch (notifyError) {
                console.warn('[Payment Link] 알림 발송 실패 (무시):', notifyError.message)
            }
        }

        return new Response(JSON.stringify({
            success: true,
            order_id: orderId,
            invoice_id: invoiceResponse.invoice_id,
            order_name: product_name,
            price: price,
            customer_name: customer_name,
            notification_method: notification_method,
            created_at: new Date().toISOString()
        }), { headers: corsHeaders })

    } catch (error) {
        console.error('[Payment Link] 오류:', error)
        return new Response(JSON.stringify({
            success: false,
            message: '결제링크 생성 중 오류가 발생했습니다.',
            error: error.message
        }), { status: 500, headers: corsHeaders })
    }
}
