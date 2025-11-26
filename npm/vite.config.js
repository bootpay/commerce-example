import { defineConfig } from 'vite'
import { Bootpay } from '@bootpay/backend-js'

// Bootpay 서버 설정
const BOOTPAY_CONFIG = {
    application_id: '692682dfb2084136e29ac1dc',  // REST API Application ID
    private_key: 'vz63xmu7p7Vs90yHNuggDiQYPFZVWkUZ8JJFwcBDPsI='  // Private Key
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

                    // receipt_id가 있으면 결제 조회
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

                    // order_number만 있는 경우 - URL 파라미터 정보만 반환
                    if (order_number) {
                        res.setHeader('Content-Type', 'application/json')
                        res.end(JSON.stringify({
                            success: true,
                            data: {
                                order_number: order_number,
                                message: 'Order information from URL parameters'
                            }
                        }))
                        return
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
