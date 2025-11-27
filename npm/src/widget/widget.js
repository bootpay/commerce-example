// NPM 패키지에서 import
import { BootpayWidget } from '@bootpay/client-js'

// API 서버 주소 (환경변수 또는 상대경로)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

// ========================================
// 환경별 설정 (development, stage, production)
// ========================================
const ENV_CONFIG = {
    development: {
        application_id: '692682dfb2084136e29ac1d9'
    },
    stage: {
        application_id: '6927d523472c3a791b6250cd' // Stage 환경 키 (필요시 변경)
    },
    production: {
        application_id: '6927d523472c3a791b6250cd' // Production 환경 키 (필요시 변경)
    }
}

// 현재 환경
let currentEnv = 'production'

// 현재 환경의 설정 가져오기
function getCurrentConfig() {
    return ENV_CONFIG[currentEnv]
}

// 주문 정보
const orderInfo = {
    productId: 'premium_earphone',  // 상품 ID (서버에서 가격 조회용)
    unitPrice: 4000,
    quantity: 1,
    mileageDiscount: 0,
    couponDiscount: 0,
    couponCode: null
}

// DOM 로드 후 초기화
document.addEventListener('DOMContentLoaded', function() {
    // 저장된 환경 불러오기 (기본값: production)
    const savedEnv = localStorage.getItem('bootpay_widget_env') || 'production'
    currentEnv = savedEnv

    // 환경 선택 UI 초기화
    const envSelect = document.getElementById('env')
    if (envSelect) {
        envSelect.value = currentEnv
    }

    // Widget SDK 환경 설정
    BootpayWidget.setEnvironmentMode(currentEnv)

    console.log(`[Widget] 환경: ${currentEnv}, App ID: ${getCurrentConfig().application_id}`)

    initWidget()
    bindEventListeners()
})

// ========================================
// 이벤트 리스너 바인딩
// ========================================

function bindEventListeners() {
    // 적립금 입력
    const mileageInput = document.getElementById('use-mileage')
    if (mileageInput) {
        mileageInput.addEventListener('input', function() {
            applyMileage(this.value)
        })
    }

    // 수량 변경 버튼
    document.getElementById('qty-decrease')?.addEventListener('click', () => changeQuantity(-1))
    document.getElementById('qty-increase')?.addEventListener('click', () => changeQuantity(1))

    // 쿠폰 적용/제거 버튼
    document.getElementById('coupon-apply-btn')?.addEventListener('click', applyCoupon)
    document.getElementById('coupon-remove-btn')?.addEventListener('click', removeCoupon)

    // 결제 버튼
    document.getElementById('checkout-btn')?.addEventListener('click', requestPayment)
}

// ========================================
// 환경 변경
// ========================================

function changeEnv() {
    const envSelect = document.getElementById('env')
    currentEnv = envSelect.value

    // 환경 저장
    localStorage.setItem('bootpay_widget_env', currentEnv)

    // Widget SDK 환경 변경
    BootpayWidget.setEnvironmentMode(currentEnv)

    console.log(`[Widget] 환경 변경: ${currentEnv}, App ID: ${getCurrentConfig().application_id}`)

    // 알림
    const envNames = {
        development: 'Development (테스트)',
        stage: 'Stage',
        production: 'Production (실서비스)'
    }
    showToast(`환경이 ${envNames[currentEnv]}(으)로 변경되었습니다. 위젯을 재로드합니다.`)

    // 위젯 재로드
    BootpayWidget.destroy()
    initWidget()
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

    const config = getCurrentConfig()
    const isSandbox = currentEnv === 'development' || currentEnv === 'stage'

    try {
        // ------ STEP 1. 위젯 렌더링 ------
        BootpayWidget.render('#payment-widget-area', {
            application_id: config.application_id,
            price: calculateTotalPrice(),
            sandbox: isSandbox,
            widget_key: 'default-widget',
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

const MAX_MILEAGE = 3000  // 보유 적립금

function applyMileage(value) {
    const input = document.getElementById('use-mileage')
    let amount = parseInt(value) || 0

    // 범위 제한 (0 ~ 보유 적립금)
    if (amount < 0) amount = 0
    if (amount > MAX_MILEAGE) amount = MAX_MILEAGE

    // 입력값 보정
    input.value = amount

    orderInfo.mileageDiscount = amount
    updatePriceDisplay()

    if (amount > 0) {
        showToast(`적립금 ${amount.toLocaleString()}원이 적용되었습니다.`, 'success')
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
        // ⭐ 중요: 서버에서 금액을 계산하여 위변조 방지
        // 클라이언트가 보낸 금액을 신뢰하지 않고, 상품ID/수량/쿠폰 등만 전달
        console.log('서버에 주문 생성 요청...')

        const paymentParams = BootpayWidget.currentPaymentParameters()

        const orderResponse = await fetch(`${API_BASE_URL}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                product_id: orderInfo.productId,      // 상품 ID
                quantity: orderInfo.quantity,          // 수량
                coupon_code: orderInfo.couponCode,     // 쿠폰 코드
                mileage_amount: orderInfo.mileageDiscount, // 적립금 사용액
                pg: paymentParams.pg,
                method: paymentParams.method
            })
        })

        const orderData = await orderResponse.json()

        if (!orderData.success) {
            throw new Error(orderData.message || '주문 생성 실패')
        }

        console.log('주문 생성 완료:', orderData)
        // orderData.price는 서버에서 계산한 금액!

        // 3-2. 결제 요청
        // ⭐ 서버에서 계산한 금액(orderData.price)으로 결제 진행
        await BootpayWidget.requestPayment({
            application_id: getCurrentConfig().application_id,
            pg: orderData.pg,
            method: orderData.method,
            order_id: orderData.order_id,
            order_name: orderData.order_name,
            price: orderData.price,  // 서버에서 계산한 금액 사용
            redirect_url: window.location.origin + '/src/widget/widget_result.html',
            user: {
                id: 'demo_user_' + Date.now(),
                username: '홍길동',
                phone: '01012345678',
                email: 'demo@example.com'
            }
        }) 
    } catch (error) {
        console.error('결제 실패:', error)
        showToast('결제 실패: ' + (error.message || '알 수 없는 오류'), 'error')
    } finally {
        checkoutBtn.classList.remove('loading')
        checkoutBtn.disabled = false
    }
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

// 전역 스코프에 함수 노출 (HTML에서 onclick으로 호출하기 위해)
window.toggleSettings = toggleSettings
window.changeEnv = changeEnv
