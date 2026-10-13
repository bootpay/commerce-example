// NPM 패키지에서 import
import { BootpayWidget } from '@bootpay/client-js'

// API 서버 주소 (환경변수 또는 상대경로)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

function getDemoCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('bootpay_demo_user') || 'null')
    } catch (_error) {
        return null
    }
}

function getPaymentUser(fallback) {
    const user = getDemoCurrentUser()
    if (!user) return fallback
    return {
        id: user.id,
        username: user.username,
        phone: user.phone || fallback.phone,
        email: user.email
    }
}

// ========================================
// 환경별 설정 (development, stage, production)
// ========================================
const ENV_CONFIG = {
    development: {
        client_key: 'toRyMm9vThyfxw_kGmTkWg'
    },
    stage: {
        client_key: 'dS-xBsOP9MhbxlvHVidxwQ' // Stage 환경 키 (필요시 변경)
    },
    production: {
        client_key: 'dS-xBsOP9MhbxlvHVidxwQ' // Production 환경 키 (필요시 변경)
    }
}

// 현재 환경 (localhost면 development, 아니면 production)
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
let currentEnv = isLocalDev ? 'development' : 'production'
let currentPg = ''  // 사용자가 선택한 PG사 (빈 값이면 위젯이 고른 PG 사용)

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

// 결제 버튼 활성화 조건 — 위젯 결제수단 선택 + 우측 약관 동의 모두 충족
let methodCompleted = false  // 위젯에서 결제수단 선택 완료 여부
let termsCompleted = false   // 우측 패널 필수 약관 동의 여부

// ========================================
// 약관 전문 (데모용 샘플 — 실제 서비스에서는 법무 검토 문구로 교체)
// ========================================
const TERMS = {
    purchase: {
        title: '구매조건 확인 및 결제진행 동의',
        sections: [
            { h: '제1조 (목적)', p: '본 약관은 회원이 TechMall(이하 "회사")에서 상품을 주문하고 결제를 진행함에 있어 필요한 구매조건 및 결제대행 서비스 이용에 관한 사항을 규정합니다.' },
            { h: '제2조 (주문 및 결제)', p: '① 회원은 주문 상품의 명칭, 수량, 최종 결제 금액을 확인한 후 결제를 진행합니다.\n② 결제는 부트페이(Bootpay) 결제대행 서비스를 통해 처리되며, 회원은 결제수단 정보를 정확히 입력해야 합니다.\n③ 결제 금액은 회사 서버에서 최종 검증되며, 위·변조된 금액으로의 결제는 무효 처리될 수 있습니다.' },
            { h: '제3조 (청약철회)', p: '회원은 관련 법령에 따라 상품 수령일로부터 7일 이내에 청약철회를 요청할 수 있습니다. 다만 상품의 훼손·사용, 시간 경과로 재판매가 곤란한 상품 등 법령상 제한 사유에 해당하는 경우 청약철회가 제한될 수 있습니다.' },
            { h: '제4조 (결제 취소 및 환불)', p: '결제 취소·환불은 회사의 환불 정책 및 결제수단별 처리 절차에 따라 진행되며, 환불 시점은 결제수단에 따라 달라질 수 있습니다.' },
            { h: '동의 확인', p: '본인은 위 구매조건을 확인하였으며 결제 진행에 동의합니다.' }
        ]
    },
    privacy: {
        title: '개인정보 수집 및 이용 동의',
        sections: [
            { h: '1. 수집 항목', p: '이름, 연락처(휴대전화번호), 이메일 주소, 결제수단 정보, 주문 및 결제 내역' },
            { h: '2. 수집 및 이용 목적', p: '본인확인, 주문 접수 및 상품 배송, 결제 및 결제대행 처리, 고객 문의 대응, 환불·교환 처리' },
            { h: '3. 보유 및 이용 기간', p: '전자상거래 등에서의 소비자보호에 관한 법률 등 관련 법령에 따라 거래기록은 5년간 보관하며, 보유 목적 달성 시 지체 없이 파기합니다.' },
            { h: '4. 동의 거부 권리 및 불이익', p: '회원은 개인정보 수집·이용 동의를 거부할 수 있습니다. 다만 필수 항목에 동의하지 않을 경우 주문 및 결제 서비스 이용이 제한됩니다.' },
            { h: '동의 확인', p: '본인은 위 내용을 확인하였으며 개인정보 수집·이용에 동의합니다.' }
        ]
    },
    marketing: {
        title: '마케팅 정보 수신 동의 (선택)',
        sections: [
            { h: '1. 수집 및 이용 목적', p: '신상품 안내, 할인·프로모션 및 이벤트 정보 제공, 맞춤형 혜택 및 광고 안내' },
            { h: '2. 발송 채널', p: '이메일, SMS/MMS, 앱 푸시 알림' },
            { h: '3. 보유 및 이용 기간', p: '수신 동의 철회 시 또는 회원 탈퇴 시까지' },
            { h: '4. 선택 동의 안내', p: '본 동의는 선택 사항이며, 동의하지 않아도 상품 주문 및 결제 이용에는 제한이 없습니다. 동의 후에도 언제든지 수신을 거부할 수 있습니다.' },
            { h: '동의 확인', p: '본인은 위 내용을 확인하였으며 마케팅 정보 수신에 동의합니다. (선택)' }
        ]
    }
}

let activeTermKey = null  // 현재 modal에 표시 중인 약관 키

// DOM 로드 후 초기화
document.addEventListener('DOMContentLoaded', function() {
    // localhost면 development 강제, 아니면 저장된 환경 사용
    if (isLocalDev) {
        currentEnv = 'development'
    } else {
        currentEnv = localStorage.getItem('bootpay_env') || 'production'
    }

    // 환경 선택 UI 초기화
    const envSelect = document.getElementById('env')
    if (envSelect) {
        envSelect.value = currentEnv
    }

    // PG 선택 UI 초기화 (저장된 값 복원)
    currentPg = localStorage.getItem('bootpay_pg') || ''
    const pgSelect = document.getElementById('pg')
    if (pgSelect) {
        pgSelect.value = currentPg
    }

    // Widget SDK 환경 설정
    BootpayWidget.setEnvironmentMode(currentEnv)

    console.log(`[Widget] 환경: ${currentEnv}, Client Key: ${getCurrentConfig().client_key}`)

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

    // 약관 동의 (우측 패널)
    bindTermsListeners()

    // 약관 modal
    bindTermsModal()

    // 결제 버튼
    document.getElementById('checkout-btn')?.addEventListener('click', requestPayment)
}

// ========================================
// 약관 동의 (우측 패널) — 위젯 외부에서 직접 처리
// ========================================

function bindTermsListeners() {
    const agreeAll = document.getElementById('agree-all')
    const termChecks = document.querySelectorAll('.term-check')

    // 전체 동의 토글
    agreeAll?.addEventListener('change', function() {
        termChecks.forEach(cb => { cb.checked = this.checked })
        updateTermsState()
    })

    // 개별 약관 변경 → 상태 갱신 (전체 동의 동기화는 updateTermsState에서 처리)
    termChecks.forEach(cb => {
        cb.addEventListener('change', updateTermsState)
    })
}

// 필수 약관이 모두 체크되면 termsCompleted = true
function updateTermsState() {
    const requiredChecks = document.querySelectorAll('.term-check[data-required="true"]')
    termsCompleted = Array.from(requiredChecks).every(cb => cb.checked)

    // 전체 동의 체크박스 동기화
    const agreeAll = document.getElementById('agree-all')
    const termChecks = document.querySelectorAll('.term-check')
    if (agreeAll) agreeAll.checked = Array.from(termChecks).every(c => c.checked)

    updateCheckoutButton()
}

// ========================================
// 약관 Modal — '보기' 클릭 시 약관 전문 표시
// ========================================

function bindTermsModal() {
    // 각 약관의 '보기' 버튼
    document.querySelectorAll('.term-view').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault()
            e.stopPropagation()  // label 클릭으로 체크박스가 토글되지 않도록
            openTermsModal(this.dataset.term)
        })
    })

    // 닫기 (×, 닫기 버튼, 오버레이 클릭)
    document.getElementById('terms-modal-close')?.addEventListener('click', closeTermsModal)
    document.getElementById('terms-modal-cancel')?.addEventListener('click', closeTermsModal)
    document.getElementById('terms-modal')?.addEventListener('click', function(e) {
        if (e.target === this) closeTermsModal()
    })

    // '동의하고 닫기' → 해당 약관 체크 + 닫기
    document.getElementById('terms-modal-agree')?.addEventListener('click', function() {
        if (activeTermKey) {
            const cb = document.querySelector(`.term-check[data-term="${activeTermKey}"]`)
            if (cb) {
                cb.checked = true
                updateTermsState()
            }
        }
        closeTermsModal()
    })

    // ESC 로 닫기
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeTermsModal()
    })
}

function openTermsModal(key) {
    const term = TERMS[key]
    if (!term) return
    activeTermKey = key

    document.getElementById('terms-modal-title').textContent = term.title
    document.getElementById('terms-modal-body').innerHTML = term.sections
        .map(s => `<h4>${escapeHtml(s.h)}</h4><p>${escapeHtml(s.p)}</p>`)
        .join('')

    document.getElementById('terms-modal').classList.add('show')
}

function closeTermsModal() {
    document.getElementById('terms-modal')?.classList.remove('show')
    activeTermKey = null
}

// HTML 이스케이프 (약관 본문 안전 렌더링)
function escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
}

// ========================================
// 결제 버튼 활성화 제어 (결제수단 + 약관 동시 충족 시)
// ========================================

function updateCheckoutButton() {
    const btn = document.getElementById('checkout-btn')
    const hint = document.getElementById('checkout-hint')
    if (!btn) return

    const ready = methodCompleted && termsCompleted
    btn.disabled = !ready

    if (!hint) return
    if (ready) {
        hint.textContent = '결제 준비가 완료되었습니다.'
        hint.classList.add('ready')
    } else if (!methodCompleted && !termsCompleted) {
        hint.textContent = '결제 수단 선택과 약관 동의를 완료해 주세요.'
        hint.classList.remove('ready')
    } else if (!methodCompleted) {
        hint.textContent = '결제 수단을 선택해 주세요.'
        hint.classList.remove('ready')
    } else {
        hint.textContent = '필수 약관에 동의해 주세요.'
        hint.classList.remove('ready')
    }
}

// ========================================
// 환경 변경
// ========================================

function changeEnv() {
    const envSelect = document.getElementById('env')
    currentEnv = envSelect.value

    // 환경 저장
    localStorage.setItem('bootpay_env', currentEnv)

    // Widget SDK 환경 변경
    BootpayWidget.setEnvironmentMode(currentEnv)

    console.log(`[Widget] 환경 변경: ${currentEnv}, Client Key: ${getCurrentConfig().client_key}`)

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

// ========================================
// PG 변경
// ========================================

function changePg() {
    currentPg = document.getElementById('pg').value
    localStorage.setItem('bootpay_pg', currentPg)

    const pgNames = {
        '': '기본 (자동)',
        nicepay: '나이스페이',
        tosspayments: '토스페이먼츠',
        kcp: 'KCP',
        inicis: '이니시스',
        kakaopay: '카카오페이',
        payco: '페이코',
        tosspay: '토스페이'
    }
    showToast(`PG사가 ${pgNames[currentPg] || currentPg}(으)로 설정되었습니다.`)
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

    // 위젯 재로드 시 결제수단 선택 상태 초기화
    methodCompleted = false
    updateCheckoutButton()

    const config = getCurrentConfig()
    const isSandbox = currentEnv === 'development' || currentEnv === 'stage'

    try {
        // ------ STEP 1. 위젯 렌더링 ------
        // use_terms: false — 약관 동의는 위젯이 아니라 우측 패널에서 직접 처리한다.
        BootpayWidget.render('#payment-widget-area', {
            client_key: config.client_key,
            price: calculateTotalPrice(),
            sandbox: isSandbox,
            widget_key: 'default-widget',
            use_terms: false,
            extra: {
                hide_title: true,
                // 위젯 외부(컨테이너) 패딩 0 — 관리자 설정에 의존하지 않고 코드에서 강제
                inline_styles: {
                    pc: {
                        containerStyle: {
                            'padding-top': '0px',
                            'padding-bottom': '0px',
                            'padding-left': '0px',
                            'padding-right': '0px'
                        }
                    },
                    mobile: {
                        containerStyle: {
                            'padding-top': '0px',
                            'padding-bottom': '0px',
                            'padding-left': '0px',
                            'padding-right': '0px'
                        }
                    }
                }
            },

            hooks: {
                // 위젯 렌더링 완료
                ready: function() {
                    console.log('결제 위젯 준비 완료')
                    const area = document.getElementById('payment-widget-area')
                    area.classList.remove('loading')
                    area.classList.add('loaded')
                },
                // 결제수단 변경 시 — 선택 완료 여부를 버튼 활성화 조건에 반영
                paymentMethodUpdated: function(data) {
                    console.log('결제수단 변경:', data)
                    methodCompleted = !!data.completed
                    updateCheckoutButton()
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

    // 우측 최종 결제 정보의 수량 표시 동기화
    const summaryQty = document.getElementById('summary-qty')
    if (summaryQty) summaryQty.textContent = orderInfo.quantity

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
                pg: currentPg || paymentParams.pg,
                method: paymentParams.method,
                user_id: getDemoCurrentUser()?.id || null
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
            client_key: getCurrentConfig().client_key,
            pg: currentPg || orderData.pg,
            method: orderData.method,
            order_id: orderData.order_id,
            order_name: orderData.order_name,
            price: orderData.price,  // 서버에서 계산한 금액 사용
            redirect_url: window.location.origin + '/npm/widget/widget_result.html',
            user: getPaymentUser({
                id: 'demo_user_' + Date.now(),
                username: '홍길동',
                phone: '01012345678',
                email: 'demo@example.com'
            })
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
window.changePg = changePg
