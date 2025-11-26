import { defineConfig } from 'vite'
import { Bootpay } from '@bootpay/backend-js'
import { BootpayCommerce } from '@bootpay/backend-js'

// Bootpay 일반 결제 서버 설정
const BOOTPAY_CONFIG = {
    application_id: '692682dfb2084136e29ac1dc',
    private_key: 'vz63xmu7p7Vs90yHNuggDiQYPFZVWkUZ8JJFwcBDPsI=',
    mode: 'development'
}

// Bootpay Commerce 서버 설정
const COMMERCE_CONFIG = {
    client_key: 'hxS-Up--5RvT6oU6QJE0JA',
    secret_key: 'r5zxvDcQJiAP2PBQ0aJjSHQtblNmYFt6uFoEMhti_mg=',
    mode: 'development'
}

export default defineConfig({
    server: {
        port: 5173
    },
    plugins: [
        {
            name: 'api-server',
            configureServer(server) {
                // 1. 결제 조회 API - widget_result.html용
                // GET /api/payment/receipt/:receipt_id
                server.middlewares.use((req, res, next) => {
                    const match = req.url.match(/^\/api\/payment\/receipt\/([^/?]+)/)
                    if (!match) {
                        next()
                        return
                    }

                    const receipt_id = match[1]

                    ;(async () => {
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
                                message: error.message || 'Payment lookup failed'
                            }))
                        }
                    })()
                })

                // 2. 주문 조회 API - plan_result.html용
                // GET /api/order/:order_number
                server.middlewares.use((req, res, next) => {
                    const match = req.url.match(/^\/api\/order\/([^/?]+)/)
                    if (!match) {
                        next()
                        return
                    }

                    const order_number = match[1]

                    ;(async () => {
                        try {
                            const commerce = new BootpayCommerce(COMMERCE_CONFIG)
                            await commerce.getAccessToken()
                            const response = await commerce.order.detail(order_number)

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
                                message: error.message || 'Order lookup failed'
                            }))
                        }
                    })()
                })
            }
        }
    ]
})
