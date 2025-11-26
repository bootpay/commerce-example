// NPM 패키지에서 import
import { BootpayWidget } from '@bootpay/client-js'

// 주문 정보
const orderInfo = {
    unitPrice: 39000,
    quantity: 1,
    mileageDiscount: 0,
    couponDiscount: 0,
    couponCode: null
}

// DOM 로드 후 초기화
document.addEventListener('DOMContentLoaded', function() {
    loadSettings()
    initWidget()
})

// ========================================
// 설정 관리
// ========================================

function getCacheMode() {
    try {
        const mode = window.localStorage.getItem('__widget_mode')
        return mode === undefined || mode === null ? 'development' : mode
    } catch (e) {
        return 'development'
    }
}

function getCache() {
    try {
        const env = document.getElementById('env').value
        const data = JSON.parse(window.localStorage.getItem('__widget_cache_' + env))
        return data === undefined || data === null ? {
            app_id: '692682dfb2084136e29ac1d9'
        } : data
    } catch (e) {
        return {
            app_id: '692682dfb2084136e29ac1d9'
        }
    }
}

function loadSettings() {
    document.getElementById('env').value = getCacheMode()
    const cache = getCache()
    document.getElementById('appId').value = cache.app_id
}

function saveSettings() {
    const env = document.getElementById('env').value
    const appId = document.getElementById('appId').value

    const data = {
        app_id: appId
    }

    window.localStorage.setItem('__widget_mode', env)
    window.localStorage.setItem('__widget_cache_' + env, JSON.stringify(data))

    showToast('설정이 저장되었습니다. 위젯을 재로드합니다.')

    // 위젯 재로드
    BootpayWidget.destroy()
    initWidget()
}

function changeMode() {
    window.localStorage.setItem('__widget_mode', document.getElementById('env').value)
    loadSettings()
}

function toggleSettings() {
    const content = document.querySelector('.settings-content')
    const toggle = document.querySelector('.settings-toggle')
    content.classList.toggle('show')
    toggle.textContent = content.classList.contains('show') ? '▼' : '▲'
}

// ========================================
// 결제 위젯 초기화
// ========================================

function initWidget() {
    const widgetArea = document.getElementById('payment-widget-area')
    widgetArea.className = 'loading'

    const env = document.getElementById('env').value
    const appId = document.getElementById('appId').value
    const isSandbox = env === 'development' || env === 'stage'

    try {
        BootpayWidget.setEnvironmentMode("development")
        // ------ STEP 1. 위젯 렌더링 ------
        BootpayWidget.render('#payment-widget-area', {
            application_id: appId,
            price: calculateTotalPrice(),
            sandbox: isSandbox,
            use_terms: true,
            extra: {
                hide_title: true,
            },

            hooks: {
                // 위젯 렌더링 완료
                ready: function() {
                    console.log('결제 위젯 준비 완료')
                    const area = document.getElementById('payment-widget-area')
                    area.classList.remove('loading')
                    area.classList.add('loaded')
                },
                // 모든 약관 동의 시
                allTermsAccepted: function() {
                    console.log('모든 약관 동의 완료')
                    document.getElementById('checkout-btn').disabled = false
                },
                // 결제수단 변경 시
                paymentMethodUpdated: function(data) {
                    console.log('결제수단 변경:', data)
                    document.getElementById('checkout-btn').disabled = !data.completed
                },
                // 약관 동의 상태 변경 시
                termsConsentUpdated: function() {
                    console.log('약관 동의 상태 변경')
                },
                // 위젯 크기 변경 시
                resize: function() {
                    console.log('위젯 크기 변경')
                }
            }
        })

        console.log('위젯 초기화 완료 - Sandbox:', isSandbox)
    } catch (error) {
        console.error('위젯 초기화 실패:', error)
        widgetArea.className = 'error'
        showToast('위젯 로딩에 실패했습니다: ' + error.message, 'error')
    }
}

// ========================================
// 가격 계산
// ========================================

function calculateSubtotal() {
    return orderInfo.unitPrice * orderInfo.quantity
}

function calculateTotalPrice() {
    const subtotal = calculateSubtotal()
    const total = subtotal - orderInfo.mileageDiscount - orderInfo.couponDiscount
    return Math.max(0, total)
}

function updatePriceDisplay() {
    const subtotal = calculateSubtotal()
    const total = calculateTotalPrice()

    document.getElementById('subtotal').textContent = subtotal.toLocaleString()
    document.getElementById('total-price').textContent = total.toLocaleString()
    document.getElementById('btn-price').textContent = total.toLocaleString()

    // 적립금 할인 행 표시/숨김
    const mileageRow = document.getElementById('mileage-row')
    if (orderInfo.mileageDiscount > 0) {
        mileageRow.style.display = 'flex'
        document.getElementById('mileage-discount').textContent = orderInfo.mileageDiscount.toLocaleString()
    } else {
        mileageRow.style.display = 'none'
    }

    // 쿠폰 할인 행 표시/숨김
    const couponRow = document.getElementById('coupon-row')
    if (orderInfo.couponDiscount > 0) {
        couponRow.style.display = 'flex'
        document.getElementById('coupon-discount').textContent = orderInfo.couponDiscount.toLocaleString()
    } else {
        couponRow.style.display = 'none'
    }

    // ------ STEP 2. 금액 업데이트 ------
    // 위젯에 변경된 금액 반영
    BootpayWidget.update({ price: total })
}

// ========================================
// 수량 변경
// ========================================

function changeQuantity(delta) {
    const newQuantity = orderInfo.quantity + delta
    if (newQuantity < 1 || newQuantity > 10) return

    orderInfo.quantity = newQuantity
    document.getElementById('quantity').textContent = newQuantity

    updatePriceDisplay()
}

// ========================================
// 적립금 적용
// ========================================

function toggleMileage() {
    const checkbox = document.getElementById('use-mileage')
    orderInfo.mileageDiscount = checkbox.checked ? 3000 : 0
    updatePriceDisplay()

    if (checkbox.checked) {
        showToast('적립금 3,000원이 적용되었습니다.', 'success')
    }
}

// ========================================
// 쿠폰 적용
// ========================================

const VALID_COUPONS = {
    'WELCOME10': { name: '첫 구매 10% 할인', type: 'percent', value: 10 },
    'SAVE5000': { name: '5,000원 할인', type: 'fixed', value: 5000 },
    'SUMMER20': { name: '여름 특가 20% 할인', type: 'percent', value: 20 }
}

function applyCoupon() {
    const input = document.getElementById('coupon-code')
    const code = input.value.trim().toUpperCase()

    if (!code) {
        showToast('쿠폰 코드를 입력해주세요.', 'error')
        return
    }

    const coupon = VALID_COUPONS[code]
    if (!coupon) {
        showToast('유효하지 않은 쿠폰 코드입니다.', 'error')
        return
    }

    // 쿠폰 할인 계산
    const subtotal = calculateSubtotal()
    if (coupon.type === 'percent') {
        orderInfo.couponDiscount = Math.floor(subtotal * (coupon.value / 100))
    } else {
        orderInfo.couponDiscount = coupon.value
    }
    orderInfo.couponCode = code

    // UI 업데이트
    document.getElementById('coupon-name').textContent = coupon.name
    document.getElementById('coupon-applied').classList.add('show')
    document.querySelector('.coupon-row').style.display = 'none'
    input.value = ''

    updatePriceDisplay()
    showToast(`쿠폰이 적용되었습니다: ${coupon.name}`, 'success')
}

function removeCoupon() {
    orderInfo.couponDiscount = 0
    orderInfo.couponCode = null

    document.getElementById('coupon-applied').classList.remove('show')
    document.querySelector('.coupon-row').style.display = 'flex'

    updatePriceDisplay()
    showToast('쿠폰이 제거되었습니다.')
}

// ========================================
// 결제 요청
// ========================================

async function requestPayment() {
    const checkoutBtn = document.getElementById('checkout-btn')
    checkoutBtn.classList.add('loading')
    checkoutBtn.disabled = true

    try {
        // ------ STEP 3. 결제 요청 ------

        // 3-1. 가맹점 서버 호출 (주문 생성)
        // 실제 환경에서는 서버 API를 호출하여 주문을 생성합니다.
        // 서버에서 금액을 직접 계산하여 위변조를 방지합니다.
        console.log('서버에 주문 생성 요청...')

        // 데모를 위한 모의 서버 응답
        const orderData = await mockCreateOrder({
            order_name: '프리미엄 무선 이어폰 Pro Max',
            quantity: orderInfo.quantity,
            mileage_amount: orderInfo.mileageDiscount,
            coupon_code: orderInfo.couponCode,
            payment_method: BootpayWidget.currentPaymentParameters()
        })

        console.log('주문 생성 완료:', orderData)

        // 3-2. 결제 요청
        // 서버에서 생성한 주문 정보로 결제 진행
        const paymentResult = await BootpayWidget.requestPayment({
            application_id: document.getElementById('appId').value,
            pg: orderData.pg,
            method: orderData.method,
            order_id: orderData.order_id,
            order_name: orderData.order_name,
            price: orderData.price,
            redirect_url: window.location.origin + '/src/widget/widget_result.html',
            user: {
                id: 'demo_user_' + Date.now(),
                username: '홍길동',
                phone: '01012345678',
                email: 'demo@example.com'
            }
        })

        console.log('결제 완료:', paymentResult)

        // 3-3. 결제 완료 후 서버 검증 요청
        const verifyResult = await mockVerifyPayment({
            receipt_id: paymentResult.receipt_id,
            order_id: orderData.order_id
        })

        if (verifyResult.success) {
            showToast('결제가 완료되었습니다!', 'success')

            // 결제 완료 페이지로 이동
            setTimeout(() => {
                window.location.href = `/src/widget/widget_result.html?order_id=${orderData.order_id}&receipt_id=${paymentResult.receipt_id}`
            }, 1500)
        } else {
            showToast('결제 검증 실패: ' + verifyResult.message, 'error')
        }

    } catch (error) {
        console.error('결제 실패:', error)
        showToast('결제 실패: ' + (error.message || '알 수 없는 오류'), 'error')
    } finally {
        checkoutBtn.classList.remove('loading')
        checkoutBtn.disabled = false
    }
}

// ========================================
// 모의 서버 함수 (데모용)
// ========================================

async function mockCreateOrder(params) {
    // 실제 환경에서는 fetch('/api/payment/prepare', {...})를 사용합니다.
    await delay(500)

    const paymentParams = params.payment_method || {}

    return {
        order_id: 'ORDER_' + Date.now(),
        order_name: params.order_name,
        price: calculateTotalPrice(),
        pg: paymentParams.pg || 'nicepay',
        method: paymentParams.method || 'card'
    }
}

async function mockVerifyPayment(_params) {
    // 실제 환경에서는 fetch('/api/payment/verify', {...})를 사용합니다.
    // 서버에서 receipt_id로 부트페이 결제 조회 API를 호출하여
    // 실제 결제 금액과 DB의 주문 금액을 대조합니다.
    // _params: { receipt_id, order_id }
    await delay(300)

    return {
        success: true,
        message: '결제 검증 완료'
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// ========================================
// Toast 메시지
// ========================================

function showToast(message, type = '') {
    const toast = document.getElementById('toast')
    toast.textContent = message
    toast.className = 'toast show ' + type

    setTimeout(() => {
        toast.className = 'toast'
    }, 3000)
}

// ========================================
// 전역 함수 노출
// ========================================

window.changeQuantity = changeQuantity
window.toggleMileage = toggleMileage
window.applyCoupon = applyCoupon
window.removeCoupon = removeCoupon
window.requestPayment = requestPayment
window.saveSettings = saveSettings
window.changeMode = changeMode
window.toggleSettings = toggleSettings
