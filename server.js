import express from 'express'
import cors from 'cors'
import { Bootpay } from '@bootpay/backend-js'
import { quoteCart } from './shop/catalog.js'
import { createVerificationStore, fetchCertificate, hashIdentity, maskEmail, parseCertificate, pgConfigFor, publicIdentity, publicPgConfig } from './functions/_shared/identity.js'
import { commerceConfigForHost, createShopOrder, startBankTransfer, verifyShopReceipt } from './functions/_shared/shop-order.js'
import { AWAITING_DEPOSIT, bankAccountsFor, publicBankAccounts, refreshBankOrder, verifyWebhookSignature } from './functions/_shared/bank-deposit.js'
import { demoMemberFrom } from './functions/_shared/demo-store.js'

const app = express()
const PORT = 3001

// ========================================
// In-Memory 주문 저장소
// 실제 환경에서는 DB(MySQL, PostgreSQL, MongoDB 등)를 사용합니다
// ========================================
const orderStore = new Map()
const memberStore = new Map()
const verificationStore = createVerificationStore()

const DEMO_ADMIN = {
    id: 'ADMIN_DEMO',
    email: 'admin@demo.local',
    password: 'admin1234',
    username: '데모 관리자',
    phone: '01000000000',
    role: 'admin',
    status: 'active',
    identity_verified: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
}
memberStore.set(DEMO_ADMIN.id, DEMO_ADMIN)
// 본인인증을 건너뛴 데모 회원 — DEMO_MEMBER_EMAIL · DEMO_MEMBER_PASSWORD 가 있을 때만 (functions/_shared/demo-store.js)
const DEMO_MEMBER = demoMemberFrom(process.env)
if (DEMO_MEMBER) memberStore.set(DEMO_MEMBER.id, DEMO_MEMBER)

function toPublicUser(user) {
    if (!user) return null
    const { password, ci_hash, ...safeUser } = user
    return safeUser
}

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase()
}

function getCurrentUserFromBody(body) {
    const userId = body?.user_id
    return userId ? toPublicUser(memberStore.get(userId)) : null
}

function requireAdmin(req, res) {
    const adminId = req.get('X-Demo-Admin-Id') || req.query.admin_id
    const admin = memberStore.get(adminId)
    if (!admin || admin.role !== 'admin' || admin.status !== 'active') {
        res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' })
        return null
    }
    return admin
}

function getBootpayConfig() {
    if (process.env.BOOTPAY_CLIENT_KEY && process.env.BOOTPAY_SECRET_KEY) {
        return {
            client_key: process.env.BOOTPAY_CLIENT_KEY,
            secret_key: process.env.BOOTPAY_SECRET_KEY
        }
    }
    if (process.env.BOOTPAY_REST_APP_ID && process.env.BOOTPAY_PRIVATE_KEY) {
        return {
            application_id: process.env.BOOTPAY_REST_APP_ID,
            private_key: process.env.BOOTPAY_PRIVATE_KEY
        }
    }
    if (process.env.BOOTPAY_APPLICATION_ID && process.env.BOOTPAY_PRIVATE_KEY) {
        return {
            application_id: process.env.BOOTPAY_APPLICATION_ID,
            private_key: process.env.BOOTPAY_PRIVATE_KEY
        }
    }
    return null
}

async function tryCancelBootpayPayment(order, body, admin) {
    if (!order.receipt_id) {
        return { mode: 'memory', message: 'receipt_id가 없어 데모 메모리에서만 취소 처리했습니다.' }
    }

    const config = getBootpayConfig()
    if (!config) {
        return { mode: 'memory', message: 'Bootpay 서버 키가 없어 데모 메모리에서만 취소 처리했습니다.' }
    }

    Bootpay.setConfiguration(config)
    await Bootpay.getAccessToken()
    const response = await Bootpay.cancelPayment({
        receipt_id: order.receipt_id,
        cancel_price: Number(body.cancel_price || order.total_price || 0),
        cancel_username: admin.username || '데모 관리자',
        cancel_message: body.reason || '관리자 취소'
    })
    return { mode: 'bootpay', response }
}

// ========================================
// 상품 정보 (서버에서 관리 - 위변조 방지)
// 클라이언트가 보낸 금액을 신뢰하지 않고, 서버의 상품 정보로 계산
// ========================================
const PRODUCTS = {
    // 쇼핑몰 데모 상품
    'premium_earphone': {
        name: '프리미엄 무선 이어폰 Pro Max',
        price: 4000
    },
    'smart_watch': {
        name: '헬스케어 스마트 워치',
        price: 12900
    },
    'desk_lamp': {
        name: '무드 LED 데스크 램프',
        price: 7900
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
// 부트페이 웹훅 서명은 본문 원문으로 확인한다 — 파싱 전 원문을 req.rawBody 에 남긴다
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8') } }))

// ========================================
// API: 주문 생성 (Widget용)
// 결제 요청 전에 호출하여 서버에서 금액 계산 및 주문 저장
// ========================================
app.post('/api/orders', async (req, res) => {
    try {
        // 쇼핑몰 데모 주문서: 여러 상품·옵션 + 배송지. 금액은 shop/catalog.js 로 서버가 계산한다.
        if (Array.isArray(req.body.items)) {
            let result = createShopOrder(req.body, memberStore.get(req.body.user_id) || null)
            if (result.ok && result.order.method === 'bank_transfer') {
                const started = await startBankTransfer(result.order, { hostname: req.hostname, origin: `${req.protocol}://${req.get('host')}`, env: process.env })
                result = started.ok ? { ...result, order: started.order } : started
            }
            if (!result.ok) return res.status(result.status).json({ success: false, code: result.code, message: result.message })
            orderStore.set(result.order.order_id, result.order)
            console.log(`[쇼핑몰 주문 생성] ${result.order.order_id}: ${result.order.order_name} - ${result.order.total_price}원`)
            return res.json(result.response)
        }

        const { product_id, quantity, coupon_code, mileage_amount, pg, method, user_id } = req.body

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
            user_id: user_id || null,
            user: getCurrentUserFromBody(req.body),
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
        const { product_id, plan_key, billing_type, user_id } = req.body

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
            user_id: user_id || null,
            user: getCurrentUserFromBody(req.body),
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
// API: 회원 토큰 발급 (브랜드페이용)
// 클라이언트에서 회원 정보를 보내면 Bootpay user_token을 발급해 반환
// ========================================
app.post('/api/user-token', async (req, res) => {
    try {
        const { user_id, email, username, phone, gender } = req.body

        if (!user_id) {
            return res.status(400).json({
                success: false,
                message: 'user_id 가 필요합니다.'
            })
        }

        Bootpay.setConfiguration({
            application_id: process.env.BOOTPAY_APPLICATION_ID || '692682dfb2084136e29ac1dc',
            private_key: process.env.BOOTPAY_PRIVATE_KEY || 'vz63xmu7p7Vs90yHNuggDiQYPFZVWkUZ8JJFwcBDPsI='
        })

        await Bootpay.getAccessToken()
        const tokenResponse = await Bootpay.requestUserToken({
            user_id,
            email,
            username,
            phone,
            gender
        })

        console.log(`[user_token 발급] user_id=${user_id}`)

        res.json({
            success: true,
            user_token: tokenResponse.user_token,
            expired_at: tokenResponse.expired_at
        })

    } catch (error) {
        console.error('[user_token 발급 오류]', error)
        res.status(500).json({
            success: false,
            message: 'user_token 발급 중 오류가 발생했습니다.',
            error: error.message
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

        // 쇼핑몰 주문은 Mock 없이 Bootpay 영수증으로만 결제 완료를 확인한다.
        const shopOrder = orderStore.get(order_id)
        if (shopOrder?.order_id?.startsWith('SHOP_')) {
            if (shopOrder.status === 'paid') return res.json({ success: true, order: shopOrder })
            const result = await verifyShopReceipt(req.hostname, process.env, shopOrder, receipt_id)
            if (!result.ok) {
                if (result.orderStatus) orderStore.set(order_id, { ...shopOrder, receipt_id, status: result.orderStatus })
                return res.status(result.status).json({ success: false, message: result.message })
            }
            const paidOrder = { ...shopOrder, receipt_id, status: 'paid', paid_at: new Date().toISOString() }
            orderStore.set(order_id, paidOrder)
            return res.json({ success: true, message: '결제가 정상적으로 확인되었습니다.', order: paidOrder })
        }

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
// API: 데모 회원가입 / 로그인
// 메모리 기반 데모 인증입니다. 실서비스 인증으로 사용하지 마세요.
// ========================================
function findUserByCiHash(ciHash) {
    return Array.from(memberStore.values()).find(user => user.ci_hash && user.ci_hash === ciHash) || null
}

// 회원가입 전 본인인증 결과 확인 — receipt_id 로 Bootpay 인증 결과를 조회하고 일회용 토큰을 발급한다.
app.post('/api/auth/identity', async (req, res) => {
    const receiptId = String(req.body.receipt_id || req.body.receiptId || '').trim()
    if (!receiptId) return res.status(400).json({ success: false, code: 'RECEIPT_REQUIRED', message: '본인인증 영수증 ID가 없습니다.' })

    const config = pgConfigFor(req.hostname, process.env)
    if (!config) return res.status(500).json({ success: false, code: 'PG_KEY_MISSING', message: '서버에 Bootpay PG 키(BOOTPAY_CLIENT_KEY / BOOTPAY_SECRET_KEY)가 설정되지 않았습니다.' })

    try {
        const identity = parseCertificate(await fetchCertificate(receiptId, config))
        const ciHash = await hashIdentity(identity.unique)
        const existing = findUserByCiHash(ciHash)
        if (existing) {
            return res.status(409).json({ success: false, code: 'IDENTITY_ALREADY_LINKED', message: '이미 가입된 회원입니다. 기존 계정으로 로그인해 주세요.', email: maskEmail(existing.email) })
        }
        res.json({ success: true, verification_token: verificationStore.issue(identity, ciHash), identity: publicIdentity(identity) })
    } catch (error) {
        console.error('[본인인증 확인 실패]', error.code, error.message)
        res.status(error.status || 400).json({ success: false, code: error.code || 'IDENTITY_FAILED', message: error.message || '본인인증 확인에 실패했습니다.' })
    }
})

// 본인인증을 마친 사용자만 가입한다. 이름·휴대폰은 인증 결과로 확정한다.
app.post('/api/auth/register', (req, res) => {
    try {
        const verification = verificationStore.peek(String(req.body.verification_token || ''))
        if (!verification) {
            return res.status(400).json({ success: false, code: 'VERIFICATION_REQUIRED', message: '본인인증이 필요하거나 인증 시간이 지났습니다. 다시 인증해 주세요.' })
        }
        const email = normalizeEmail(req.body.email)
        const { password } = req.body
        if (!email) return res.status(400).json({ success: false, message: '이메일을 입력해 주세요.' })
        if (!password || String(password).length < 8) return res.status(400).json({ success: false, message: '비밀번호는 8자 이상이어야 합니다.' })
        if (Array.from(memberStore.values()).some(user => user.email === email)) {
            return res.status(409).json({ success: false, code: 'DUPLICATE_EMAIL', message: '이미 가입된 이메일입니다.' })
        }
        if (findUserByCiHash(verification.ciHash)) {
            return res.status(409).json({ success: false, code: 'IDENTITY_ALREADY_LINKED', message: '이미 본인인증으로 가입한 회원입니다.' })
        }

        const { identity } = verification
        const user = {
            id: 'USER_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            email,
            password,
            username: identity.name || email.split('@')[0],
            phone: identity.phone,
            role: 'member',
            status: 'active',
            identity_verified: true,
            identity_verified_at: identity.authenticated_at,
            birth: identity.birth || null,
            gender: identity.gender || null,
            ci_hash: verification.ciHash,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }
        memberStore.set(user.id, user)
        verificationStore.consume(req.body.verification_token)

        res.json({ success: true, user: toPublicUser(user) })
    } catch (error) {
        console.error('[회원가입 오류]', error)
        res.status(500).json({ success: false, message: '회원가입 중 오류가 발생했습니다.' })
    }
})

// ========================================
// API: 쇼핑몰 데모 — 견적 / 회원 주문 내역
// ========================================
// 결제창·본인인증창에 쓸 client_key 와 모드 (secret_key 는 내려주지 않는다)
app.get('/api/shop/config', (req, res) => {
    const config = publicPgConfig(req.hostname, process.env)
    if (!config) return res.status(500).json({ success: false, code: 'PG_KEY_MISSING', message: '서버에 Bootpay PG 키가 설정되지 않았습니다.' })
    res.json({ success: true, ...config })
})

// 주문서의 무통장 입금 은행 고르기 — 은행 이름과 끝 네 자리만 (functions/api/shop/bank-accounts.js 와 같다)
app.get('/api/shop/bank-accounts', async (req, res) => {
    try {
        const accounts = await bankAccountsFor(commerceConfigForHost(req.hostname, process.env), process.env)
        res.json({ success: true, accounts: publicBankAccounts(accounts) })
    } catch (error) {
        res.status(error.status || 424).json({ success: false, code: error.code, message: error.message })
    }
})

app.post('/api/shop/quote', (req, res) => {
    const quote = quoteCart(req.body.items, { couponCode: req.body.coupon_code || '' })
    if (!quote.ok) return res.status(400).json({ success: false, code: quote.code, message: quote.message })
    res.json({ success: true, quote })
})

// 무통장 주문은 부트페이에 다시 물어 상태를 맞춘다 — 웹훅이 못 닿는 자리(localhost)에서도 바뀌도록 (functions 와 같은 refreshBankOrder)
const readShopOrder  = id => orderStore.get(id)
const writeShopOrder = order => {
    orderStore.set(order.order_id, { ...order, updated_at: new Date().toISOString() })
    return orderStore.get(order.order_id)
}
function syncShopOrder(req, order, options = {}) {
    return refreshBankOrder(commerceConfigForHost(req.hostname, process.env), order, { read: readShopOrder, write: writeShopOrder, ...options })
}

app.get('/api/shop/orders', async (req, res) => {
    const userId = req.query.user_id
    if (!memberStore.has(userId)) return res.status(401).json({ success: false, code: 'LOGIN_REQUIRED', message: '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.' })
    const orders = await Promise.all(Array.from(orderStore.values())
        .filter(order => order.user_id === userId)
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        .map(order => syncShopOrder(req, order)))
    res.json({ success: true, orders })
})

app.get('/api/shop/orders/:orderId', async (req, res) => {
    const order = orderStore.get(req.params.orderId)
    // 다른 회원의 주문은 존재 여부도 알려주지 않는다.
    if (!order || !req.query.user_id || order.user_id !== req.query.user_id) {
        return res.status(404).json({ success: false, code: 'ORDER_NOT_FOUND', message: '주문을 찾을 수 없습니다.' })
    }
    res.json({ success: true, order: await syncShopOrder(req, order, { includePaid: true }) })
})

// 부트페이 입금 웹훅 — 본문은 믿지 않고 merchant_order_id 로 다시 조회한 값만 쓴다
// (functions/api/shop/bank-deposit/webhook.js 와 같은 규칙)
app.post('/api/shop/bank-deposit/webhook', async (req, res) => {
    // 서명 · 시각부터 본다. 통과해도 본문은 믿지 않고 아래에서 부트페이에 다시 묻는다
    if (!(await verifyWebhookSignature(req.rawBody || '', new Headers(req.headers), process.env.SHOP_WEBHOOK_SECRET))) {
        return res.status(401).json({ success: false, message: '웹훅 서명이 맞지 않습니다.' })
    }
    const order = orderStore.get(String(req.body?.data?.merchant_order_id || ''))
    if (!order) return res.json({ success: true, ignored: true })
    const config = commerceConfigForHost(req.hostname, process.env)
    if (!config) return res.status(500).json({ success: false, message: 'Commerce 키가 없습니다.' })
    try {
        const saved = await refreshBankOrder(config, order, { read: readShopOrder, write: writeShopOrder, includePaid: true, throwOnError: true })
        res.json({ success: true, status: saved.status })
    } catch (error) {
        // 다시 조회하지 못했으면 실패로 답한다 — 부트페이가 다시 보낸다
        res.status(500).json({ success: false, message: error.message })
    }
})

// 로그인 화면 자동 입력용 — 데모 회원(DEMO_MEMBER_*)을 넣었을 때만 값을 준다 (로컬 시험용)
app.get('/api/auth/login', (req, res) => {
    res.json({ success: true, demo: DEMO_MEMBER ? { email: DEMO_MEMBER.email, password: DEMO_MEMBER.password } : null })
})

app.post('/api/auth/login', (req, res) => {
    try {
        const email = normalizeEmail(req.body.email)
        const user = Array.from(memberStore.values()).find(item => item.email === email)
        if (!user || user.password !== req.body.password) {
            return res.status(401).json({
                success: false,
                message: '이메일 또는 비밀번호가 올바르지 않습니다.',
                demo: { admin_email: DEMO_ADMIN.email, admin_password: DEMO_ADMIN.password }
            })
        }
        if (user.status !== 'active') {
            return res.status(403).json({ success: false, message: '비활성화된 회원입니다.' })
        }

        res.json({ success: true, user: toPublicUser(user) })
    } catch (error) {
        console.error('[로그인 오류]', error)
        res.status(500).json({ success: false, message: '로그인 중 오류가 발생했습니다.' })
    }
})

// ========================================
// API: 데모 관리자 - 회원 / 결제내역 관리
// ========================================
app.get('/api/admin/users', (req, res) => {
    const admin = requireAdmin(req, res)
    if (!admin) return

    const users = Array.from(memberStore.values())
        .map(toPublicUser)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
    res.json({ success: true, users })
})

app.patch('/api/admin/users/:userId/status', (req, res) => {
    const admin = requireAdmin(req, res)
    if (!admin) return

    const user = memberStore.get(req.params.userId)
    if (!user) {
        return res.status(404).json({ success: false, message: '회원을 찾을 수 없습니다.' })
    }
    if (!['active', 'suspended'].includes(req.body.status)) {
        return res.status(400).json({ success: false, message: '지원하지 않는 회원 상태입니다.' })
    }

    user.status = req.body.status
    user.updated_at = new Date().toISOString()
    memberStore.set(user.id, user)
    res.json({ success: true, user: toPublicUser(user) })
})


app.get('/api/admin/payments', (req, res) => {
    const admin = requireAdmin(req, res)
    if (!admin) return

    const payments = Array.from(orderStore.values())
        .map(order => ({
            ...order,
            user: order.user_id ? toPublicUser(memberStore.get(order.user_id)) : null
        }))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    res.json({ success: true, payments })
})

app.post('/api/admin/payments/:orderId/cancel', async (req, res) => {
    const admin = requireAdmin(req, res)
    if (!admin) return

    const order = orderStore.get(req.params.orderId)
    if (!order) {
        return res.status(404).json({ success: false, message: '결제내역을 찾을 수 없습니다.' })
    }
    if (order.status === 'cancelled') {
        return res.status(409).json({ success: false, message: '이미 취소된 결제입니다.' })
    }

    let cancelResult
    try {
        // 무통장 입금대기 주문은 이 쇼핑몰에서만 취소한다 — 부트페이에는 입금대기 취소가 없다
        cancelResult = await tryCancelBootpayPayment(order, req.body, admin)
    } catch (error) {
        if (process.env.NODE_ENV === 'production') {
            console.error('[Bootpay 결제 취소 오류]', error)
            return res.status(502).json({ success: false, message: 'Bootpay 결제 취소에 실패했습니다.', error: error.message })
        }
        cancelResult = { mode: 'memory', message: `Bootpay 취소 실패로 데모 메모리에서만 처리했습니다: ${error.message}` }
    }

    order.status = 'cancelled'
    order.cancelled_price = Number(req.body.cancel_price || order.total_price || 0)
    order.cancel_reason = req.body.reason || '관리자 취소'
    order.cancelled_by = admin.id
    order.cancelled_at = new Date().toISOString()
    order.cancel_result_mode = cancelResult.mode
    order.cancel_result = cancelResult.response || cancelResult.message
    orderStore.set(order.order_id, order)

    res.json({ success: true, payment: order, message: cancelResult.message || '결제가 취소되었습니다.' })
})

// ========================================
// API: 주문 조회 (디버깅용)
// ========================================
// 주문에 입금 계좌 · 입금자명 · 배송지가 들어 있어 데모 관리자만 본다 (손님은 /api/shop/orders/:id)
app.get('/api/orders/:orderId', (req, res) => {
    if (!requireAdmin(req, res)) return
    const order = orderStore.get(req.params.orderId)
    if (!order) {
        return res.status(404).json({ success: false, message: '주문을 찾을 수 없습니다.' })
    }
    res.json({ success: true, order })
})

// ========================================
// API: 전체 주문 목록 (디버깅용)
// ========================================
app.get('/api/orders', (req, res) => {
    if (!requireAdmin(req, res)) return
    const orders = Array.from(orderStore.values()).map(order => ({
        ...order,
        user: order.user_id ? toPublicUser(memberStore.get(order.user_id)) : null
    }))
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
  - POST /api/user-token    : 회원 토큰 발급 (Brandpay)
  - POST /api/auth/register : 데모 회원가입
  - POST /api/auth/login    : 데모 로그인
  - GET  /api/admin/users   : 관리자 회원 목록
  - GET  /api/admin/payments: 관리자 결제내역
  - GET  /api/orders        : 전체 주문 조회
  - GET  /api/orders/:id    : 개별 주문 조회

  ⚠️  주의: 메모리 기반 저장소 사용 중
      서버 재시작 시 모든 주문 데이터가 초기화됩니다.
========================================
`)
})
