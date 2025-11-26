import { defineConfig } from 'vite'
import { Bootpay } from '@bootpay/backend-js'

// Bootpay 일반 결제 서버 설정
const BOOTPAY_CONFIG = {
    application_id: '692682dfb2084136e29ac1dc',  // REST API Application ID
    private_key: 'vz63xmu7p7Vs90yHNuggDiQYPFZVWkUZ8JJFwcBDPsI='  // Private Key
}

// Bootpay Commerce 서버 설정
const COMMERCE_CONFIG = {
    client_key: 'hxS-Up--5RvT6oU6QJE0JA',
    secret_key: 'r5zxvDcQJiAP2PBQ0aJjSHQtblNmYFt6uFoEMhti_mg=',
    mode: 'development'  // 'development' | 'stage' | 'production'
}

// Commerce API Helper
const CommerceAPI = {
    baseUrls: {
        development: 'https://dev-api.bootapi.com/v1',
        stage: 'https://stage-api.bootapi.com/v1',
        production: 'https://api.bootapi.com/v1'
    },
    token: null,

    getBaseUrl() {
        return this.baseUrls[COMMERCE_CONFIG.mode] || this.baseUrls.production
    },

    getBasicAuthHeader() {
        const credentials = `${COMMERCE_CONFIG.client_key}:${COMMERCE_CONFIG.secret_key}`
        return `Basic ${Buffer.from(credentials).toString('base64')}`
    },

    async getAccessToken() {
        const response = await fetch(`${this.getBaseUrl()}/request/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': this.getBasicAuthHeader()
            },
            body: JSON.stringify({
                server_key: COMMERCE_CONFIG.client_key,
                private_key: COMMERCE_CONFIG.secret_key
            })
        })
        const result = await response.json()
        if (result.access_token) {
            this.token = result.access_token
        }
        return result
    },

    async orderDetail(orderNumber) {
        if (!this.token) {
            await this.getAccessToken()
        }

        const response = await fetch(`${this.getBaseUrl()}/orders/${orderNumber}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`,
                'BOOTPAY-ROLE': 'user'
            }
        })

        if (!response.ok) {
            throw new Error(`Order lookup failed: ${response.status}`)
        }

        return await response.json()
    }
}

export default defineConfig({
    server: {
        port: 5173
    },
    plugins: [
        {
            name: 'api-server',
            configureServer(server) {
                // JSON 파싱 미들웨어
                server.middlewares.use((req, res, next) => {
                    if (req.method === 'POST' && req.headers['content-type']?.includes('application/json')) {
                        let body = ''
                        req.on('data', chunk => body += chunk)
                        req.on('end', () => {
                            try {
                                req.body = JSON.parse(body)
                            } catch (e) {
                                req.body = {}
                            }
                            next()
                        })
                    } else {
                        next()
                    }
                })

                // 결제 검증 API
                server.middlewares.use('/api/payment/verify', async (req, res) => {
                    if (req.method !== 'POST') {
                        res.statusCode = 405
                        res.end(JSON.stringify({ success: false, message: 'Method not allowed' }))
                        return
                    }

                    const { receipt_id } = req.body || {}

                    if (!receipt_id) {
                        res.statusCode = 400
                        res.setHeader('Content-Type', 'application/json')
                        res.end(JSON.stringify({ success: false, message: 'receipt_id is required' }))
                        return
                    }

                    try {
                        Bootpay.setConfiguration(BOOTPAY_CONFIG)
                        await Bootpay.getAccessToken()
                        const response = await Bootpay.receiptPayment(receipt_id)

                        res.setHeader('Content-Type', 'application/json')
                        res.end(JSON.stringify({
                            success: true,
                            data: response
                        }))
                    } catch (error) {
                        res.statusCode = 500
                        res.setHeader('Content-Type', 'application/json')
                        res.end(JSON.stringify({
                            success: false,
                            message: error.message || 'Payment verification failed'
                        }))
                    }
                })

                // Commerce 주문 조회 API (order_number 기반)
                server.middlewares.use('/api/order/lookup', async (req, res) => {
                    if (req.method !== 'POST') {
                        res.statusCode = 405
                        res.end(JSON.stringify({ success: false, message: 'Method not allowed' }))
                        return
                    }

                    const { order_number, receipt_id } = req.body || {}

                    // receipt_id가 있으면 일반 결제 조회
                    if (receipt_id) {
                        try {
                            Bootpay.setConfiguration(BOOTPAY_CONFIG)
                            await Bootpay.getAccessToken()
                            const response = await Bootpay.receiptPayment(receipt_id)

                            res.setHeader('Content-Type', 'application/json')
                            res.end(JSON.stringify({
                                success: true,
                                data: response
                            }))
                            return
                        } catch (error) {
                            res.statusCode = 500
                            res.setHeader('Content-Type', 'application/json')
                            res.end(JSON.stringify({
                                success: false,
                                message: error.message || 'Order lookup failed'
                            }))
                            return
                        }
                    }

                    // order_number가 있으면 Commerce API로 주문 조회
                    if (order_number) {
                        try {
                            console.log('[Commerce API] Looking up order:', order_number)
                            const orderData = await CommerceAPI.orderDetail(order_number)
                            console.log('[Commerce API] Order detail response:', orderData)

                            res.setHeader('Content-Type', 'application/json')
                            res.end(JSON.stringify({
                                success: true,
                                data: orderData
                            }))
                            return
                        } catch (error) {
                            console.error('[Commerce API] Order lookup error:', error)
                            res.statusCode = 500
                            res.setHeader('Content-Type', 'application/json')
                            res.end(JSON.stringify({
                                success: false,
                                message: error.message || 'Commerce order lookup failed'
                            }))
                            return
                        }
                    }

                    res.statusCode = 400
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify({
                        success: false,
                        message: 'order_number or receipt_id is required'
                    }))
                })
            }
        }
    ]
})
