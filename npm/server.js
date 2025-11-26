import express from 'express'
import cors from 'cors'
import { Bootpay } from '@bootpay/backend-js'

const app = express()
const PORT = 3001

// ========================================
// In-Memory 주문 저장소
// 실제 환경에서는 DB(MySQL, PostgreSQL, MongoDB 등)를 사용합니다
// ========================================
const orderStore = new Map()

// ========================================
// 상품 정보 (서버에서 관리 - 위변조 방지)
// 클라이언트가 보낸 금액을 신뢰하지 않고, 서버의 상품 정보로 계산
// ========================================
const PRODUCTS = {
    // Widget 상품
    'premium_earphone': {
        name: '프리미엄 무선 이어폰 Pro Max',
        price: 39000
    },
    // Plan 상품들 (월간)
    '69268625d8df8fa1837cf661': { name: 'CloudSync Pro Starter 플랜 (월간)', price: 9900 },
    '692686e5d8df8fa1837cf66b': { name: 'CloudSync Pro Professional 플랜 (월간)', price: 29900 },
    '69268783d8df8fa1837cf675': { name: 'CloudSync Pro Enterprise 플랜 (월간)', price: 99000 },
    // Plan 상품들 (연간)
    '692686c4d8df8fa1837cf666': { name: 'CloudSync Pro Starter 플랜 (연간)', price: 7900 },
    '69268721d8df8fa1837cf670': { name: 'CloudSync Pro Professional 플랜 (연간)', price: 23900 },
    '692687a2d8df8fa1837cf67a': { name: 'CloudSync Pro Enterprise 플랜 (연간)', price: 79000 }
}

// 쿠폰 정보 (서버에서 관리)
const COUPONS = {
    'WELCOME10': { name: '첫 구매 10% 할인', type: 'percent', value: 10 },
    'SAVE5000': { name: '5,000원 할인', type: 'fixed', value: 5000 },
    'SUMMER20': { name: '여름 특가 20% 할인', type: 'percent', value: 20 }
}

// ========================================
// Middleware
// ========================================
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}))
app.use(express.json())

// ========================================
// API: 주문 생성 (Widget용)
// 결제 요청 전에 호출하여 서버에서 금액 계산 및 주문 저장
// ========================================
app.post('/api/orders', (req, res) => {
    try {
        const { product_id, quantity, coupon_code, mileage_amount, pg, method } = req.body

        // 1. 상품 검증
        const product = PRODUCTS[product_id]
        if (!product) {
            return res.status(400).json({
                success: false,
                message: '존재하지 않는 상품입니다.'
            })
        }

        // 2. 서버에서 금액 계산 (클라이언트 금액을 신뢰하지 않음!)
        let totalPrice = product.price * (quantity || 1)

        // 3. 쿠폰 할인 적용
        if (coupon_code) {
            const coupon = COUPONS[coupon_code]
            if (coupon) {
                if (coupon.type === 'percent') {
                    totalPrice -= Math.floor(totalPrice * (coupon.value / 100))
                } else {
                    totalPrice -= coupon.value
                }
            }
        }

        // 4. 적립금 차감
        if (mileage_amount && mileage_amount > 0) {
            // 실제로는 사용자의 적립금 잔액을 DB에서 확인해야 함
            const maxMileage = 3000 // 데모용 최대 적립금
            const appliedMileage = Math.min(mileage_amount, maxMileage)
            totalPrice -= appliedMileage
        }

        // 5. 최소 금액 보장
        totalPrice = Math.max(0, totalPrice)

        // 6. 주문 생성 및 저장
        const orderId = 'ORDER_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
        const order = {
            order_id: orderId,
            product_id,
            product_name: product.name,
            quantity: quantity || 1,
            original_price: product.price * (quantity || 1),
            coupon_code,
            mileage_amount: mileage_amount || 0,
            total_price: totalPrice,  // 서버에서 계산한 최종 금액
            pg: pg || 'nicepay',
            method: method || 'card',
            status: 'pending',
            created_at: new Date().toISOString()
        }

        // 메모리에 저장 (실제로는 DB에 저장)
        orderStore.set(orderId, order)

        console.log(`[주문 생성] ${orderId}: ${product.name} - ${totalPrice}원`)

        res.json({
            success: true,
            order_id: orderId,
            order_name: product.name,
            price: totalPrice,  // 클라이언트는 이 금액으로 결제 요청해야 함
            pg: order.pg,
            method: order.method
        })

    } catch (error) {
        console.error('[주문 생성 오류]', error)
        res.status(500).json({
            success: false,
            message: '주문 생성 중 오류가 발생했습니다.'
        })
    }
})

// ========================================
// API: 주문 생성 (Plan/구독용)
// Commerce SDK 사용 시 invoice 요청 전에 호출
// ========================================
app.post('/api/orders/plan', (req, res) => {
    try {
        const { product_id, plan_key, billing_type } = req.body

        // 1. 상품 검증
        const product = PRODUCTS[product_id]
        if (!product) {
            return res.status(400).json({
                success: false,
                message: '존재하지 않는 플랜입니다.'
            })
        }

        // 2. 주문 생성
        const orderId = 'PLAN_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
        const order = {
            order_id: orderId,
            product_id,
            product_name: product.name,
            plan_key,
            billing_type,
            total_price: product.price,  // 서버에서 관리하는 가격
            status: 'pending',
            created_at: new Date().toISOString()
        }

        orderStore.set(orderId, order)

        console.log(`[플랜 주문 생성] ${orderId}: ${product.name} - ${product.price}원`)

        res.json({
            success: true,
            order_id: orderId,
            order_name: product.name,
            price: product.price,
            product_id
        })

    } catch (error) {
        console.error('[플랜 주문 생성 오류]', error)
        res.status(500).json({
            success: false,
            message: '플랜 주문 생성 중 오류가 발생했습니다.'
        })
    }
})

// ========================================
// API: 결제 검증
// 결제 완료 후 호출하여 금액 일치 여부 확인
// ========================================
app.post('/api/orders/verify', async (req, res) => {
    try {
        const { receipt_id, order_id } = req.body

        // 1. 저장된 주문 조회
        const order = orderStore.get(order_id)
        if (!order) {
            return res.status(404).json({
                success: false,
                message: '주문을 찾을 수 없습니다.'
            })
        }

        // 2. Bootpay API로 실제 결제 정보 조회
        // 주의: 실제 환경에서는 환경변수로 관리해야 합니다
        Bootpay.setConfiguration({
            application_id: process.env.BOOTPAY_APPLICATION_ID || '692682dfb2084136e29ac1d9',
            private_key: process.env.BOOTPAY_PRIVATE_KEY || 'your-private-key-here'
        })

        let paymentInfo
        try {
            // Bootpay 토큰 발급
            await Bootpay.getAccessToken()

            // 결제 정보 조회
            paymentInfo = await Bootpay.receiptPayment(receipt_id)
            console.log('[Bootpay 결제 조회]', paymentInfo)
        } catch (bootpayError) {
            console.error('[Bootpay API 오류]', bootpayError)

            // 데모 모드: Bootpay API 실패 시 Mock 응답
            // 실제 환경에서는 반드시 실패 처리해야 함!
            if (process.env.NODE_ENV !== 'production') {
                console.log('[데모 모드] Mock 결제 정보 사용')
                paymentInfo = {
                    status: 1,  // 결제 완료
                    price: order.total_price  // 주문 금액과 동일하다고 가정
                }
            } else {
                return res.status(500).json({
                    success: false,
                    message: '결제 정보 조회에 실패했습니다.'
                })
            }
        }

        // 3. 결제 상태 확인
        if (paymentInfo.status !== 1) {
            return res.json({
                success: false,
                message: '결제가 완료되지 않았습니다.',
                status: paymentInfo.status
            })
        }

        // 4. ⭐ 핵심: 금액 일치 여부 검증 ⭐
        // 클라이언트에서 위변조된 금액으로 결제했는지 확인
        if (paymentInfo.price !== order.total_price) {
            console.error(`[금액 불일치!] 주문: ${order.total_price}원, 실제 결제: ${paymentInfo.price}원`)

            // 금액 불일치 시 자동 환불 처리 권장
            // await Bootpay.cancel({ receipt_id, ... })

            order.status = 'price_mismatch'
            orderStore.set(order_id, order)

            return res.json({
                success: false,
                message: '결제 금액이 주문 금액과 일치하지 않습니다. 위변조가 감지되었습니다.',
                expected: order.total_price,
                actual: paymentInfo.price
            })
        }

        // 5. 검증 성공 - 주문 상태 업데이트
        order.status = 'paid'
        order.receipt_id = receipt_id
        order.paid_at = new Date().toISOString()
        orderStore.set(order_id, order)

        console.log(`[결제 검증 성공] ${order_id}: ${order.total_price}원`)

        res.json({
            success: true,
            message: '결제가 정상적으로 확인되었습니다.',
            order
        })

    } catch (error) {
        console.error('[결제 검증 오류]', error)
        res.status(500).json({
            success: false,
            message: '결제 검증 중 오류가 발생했습니다.'
        })
    }
})

// ========================================
// API: 주문 조회 (디버깅용)
// ========================================
app.get('/api/orders/:orderId', (req, res) => {
    const order = orderStore.get(req.params.orderId)
    if (!order) {
        return res.status(404).json({ success: false, message: '주문을 찾을 수 없습니다.' })
    }
    res.json({ success: true, order })
})

// ========================================
// API: 전체 주문 목록 (디버깅용)
// ========================================
app.get('/api/orders', (_req, res) => {
    const orders = Array.from(orderStore.values())
    res.json({ success: true, orders })
})

// ========================================
// 서버 시작
// ========================================
app.listen(PORT, () => {
    console.log(`
========================================
  Bootpay Commerce Example Server
========================================
  Server running at http://localhost:${PORT}

  API Endpoints:
  - POST /api/orders        : 주문 생성 (Widget)
  - POST /api/orders/plan   : 플랜 주문 생성 (Commerce)
  - POST /api/orders/verify : 결제 검증
  - GET  /api/orders        : 전체 주문 조회
  - GET  /api/orders/:id    : 개별 주문 조회

  ⚠️  주의: 메모리 기반 저장소 사용 중
      서버 재시작 시 모든 주문 데이터가 초기화됩니다.
========================================
`)
})
