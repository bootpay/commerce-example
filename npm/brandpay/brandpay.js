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

// ========================================
// 환경별 설정 (development, stage, production)
// brandpay 예제는 widget 예제와 동일한 client_key를 사용
// ========================================
const ENV_CONFIG = {
    development: {
        client_key: 'toRyMm9vThyfxw_kGmTkWg'
    },
    stage: {
        client_key: 'dS-xBsOP9MhbxlvHVidxwQ'
    },
    production: {
        client_key: 'dS-xBsOP9MhbxlvHVidxwQ'
    }
}

// 현재 환경 (localhost면 development, 아니면 production)
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
let currentEnv = isLocalDev ? 'development' : 'production'
let currentUserToken = null
let currentPg = ''  // 사용자가 선택한 PG사 (빈 값이면 위젯이 고른 PG 사용)

function getCurrentConfig() {
    return ENV_CONFIG[currentEnv]
}

// 데모용 로그인 회원 정보
// ⭐ 실제 서비스에서는 가맹점의 로그인 세션에서 가져온다
const loggedInUser = getDemoCurrentUser()
const demoUser = loggedInUser ? {
    id: loggedInUser.id,
    username: loggedInUser.username,
    email: loggedInUser.email,
    phone: loggedInUser.phone || '01012345678'
} : {
    id: 'demo_user_fixed_001',  // 같은 user_id 로 발급해야 저장된 카드가 재사용됨
    username: '홍길동',
    email: 'demo@techmall.com',
    phone: '01012345678'
}

// 주문 정보
const orderInfo = {
    productId: 'premium_earphone',
    unitPrice: 4000,
    quantity: 1
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
document.addEventListener('DOMContentLoaded', async function() {
    if (isLocalDev) {
        currentEnv = 'development'
    } else {
        currentEnv = localStorage.getItem('bootpay_env') || 'production'
    }

    const envSelect = document.getElementById('env')
    if (envSelect) envSelect.value = currentEnv

    // PG 선택 UI 초기화 (저장된 값 복원)
    currentPg = localStorage.getItem('bootpay_pg') || ''
    const pgSelect = document.getElementById('pg')
    if (pgSelect) pgSelect.value = currentPg

    BootpayWidget.setEnvironmentMode(currentEnv)

    console.log(`[Brandpay] 환경: ${currentEnv}, Client Key: ${getCurrentConfig().client_key}`)

    document.getElementById('user-name').textContent = demoUser.username
    document.getElementById('user-email').textContent = demoUser.email

    bindEventListeners()
    await loadUserTokenAndRender()
})

// ========================================
// 이벤트 리스너 바인딩
// ========================================
function bindEventListeners() {
    document.getElementById('qty-decrease')?.addEventListener('click', () => changeQuantity(-1))
    document.getElementById('qty-increase')?.addEventListener('click', () => changeQuantity(1))

    // 약관 동의 (우측 패널)
    bindTermsListeners()

    // 약관 modal
    bindTermsModal()

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
// user_token 발급 → 위젯 렌더링
// ========================================
async function loadUserTokenAndRender() {
    try {
        setTokenStatus('user_token 발급 중...', false)
        currentUserToken = await fetchUserToken()
        setTokenStatus(`user_token 발급 완료 (${currentUserToken.slice(0, 16)}…)`, true)
        initWidget()
    } catch (error) {
        console.error('user_token 발급 실패:', error)
        setTokenStatus('user_token 발급 실패: ' + error.message, false)
        showToast('user_token 발급 실패: ' + error.message, 'error')
        document.getElementById('payment-widget-area').className = 'error'
    }
}

async function fetchUserToken() {
    const response = await fetch(`${API_BASE_URL}/api/user-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: demoUser.id,
            email: demoUser.email,
            username: demoUser.username,
            phone: demoUser.phone,
            env: currentEnv
        })
    })
    const data = await response.json()
    if (!data.success || !data.user_token) {
        throw new Error(data.message || 'user_token 발급 실패')
    }
    return data.user_token
}

function setTokenStatus(text, ready) {
    const el = document.getElementById('token-status')
    el.textContent = text
    el.classList.toggle('ready', ready)
}

// ========================================
// 환경 변경
// ========================================
async function changeEnv() {
    const envSelect = document.getElementById('env')
    currentEnv = envSelect.value

    localStorage.setItem('bootpay_env', currentEnv)
    BootpayWidget.setEnvironmentMode(currentEnv)

    console.log(`[Brandpay] 환경 변경: ${currentEnv}`)

    const envNames = {
        development: 'Development (테스트)',
        stage: 'Stage',
        production: 'Production (실서비스)'
    }
    showToast(`환경이 ${envNames[currentEnv]}(으)로 변경되었습니다. 위젯을 재로드합니다.`)

    BootpayWidget.destroy()
    await loadUserTokenAndRender()
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
// 결제 위젯 초기화 (브랜드페이 활성화)
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
        // ------ STEP 1. 위젯 렌더링 (user_token 전달이 핵심) ------
        // use_terms: false — 약관 동의는 위젯이 아니라 우측 패널에서 직접 처리한다.
        BootpayWidget.render('#payment-widget-area', {
            client_key: config.client_key,
            price: calculateTotalPrice(),
            sandbox: isSandbox,
            widget_key: 'default-widget',
            use_terms: false,
            user_token: currentUserToken,   // ⭐ 이 한 줄로 브랜드페이 활성화
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
                    console.log('브랜드페이 위젯 준비 완료')
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
                brandpayWalletUpdated: function(wallets) {
                    console.log('저장된 결제수단 업데이트:', wallets)
                },
                brandpayManagerWindowReady: function(data) {
                    console.log('브랜드페이 매니저 열림:', data)
                },
                brandpayManagerWindowClosed: function() {
                    console.log('브랜드페이 매니저 닫힘')
                }
            }
        })

        console.log('브랜드페이 위젯 초기화 완료 - Sandbox:', isSandbox)
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
    return Math.max(0, calculateSubtotal())
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

    BootpayWidget.update({ price: total })
}

function changeQuantity(delta) {
    const newQuantity = orderInfo.quantity + delta
    if (newQuantity < 1 || newQuantity > 10) return

    orderInfo.quantity = newQuantity
    document.getElementById('quantity').textContent = newQuantity
    updatePriceDisplay()
}

// ========================================
// 결제 요청
// ========================================
async function requestPayment() {
    const checkoutBtn = document.getElementById('checkout-btn')
    checkoutBtn.classList.add('loading')
    checkoutBtn.disabled = true

    try {
        console.log('서버에 주문 생성 요청...')
        const paymentParams = BootpayWidget.currentPaymentParameters()

        const orderResponse = await fetch(`${API_BASE_URL}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                product_id: orderInfo.productId,
                quantity: orderInfo.quantity,
                pg: currentPg || paymentParams.pg,
                method: paymentParams.method,
                user_id: demoUser.id
            })
        })
        const orderData = await orderResponse.json()
        if (!orderData.success) throw new Error(orderData.message || '주문 생성 실패')

        console.log('주문 생성 완료:', orderData)

        // ------ STEP 2. 결제 요청 ------
        // user_token이 위젯 렌더링 시 전달됐으므로, 저장된 결제수단으로 원클릭 결제
        await BootpayWidget.requestPayment({
            client_key: getCurrentConfig().client_key,
            pg: currentPg || orderData.pg,
            method: orderData.method,
            order_id: orderData.order_id,
            order_name: orderData.order_name,
            price: orderData.price,
            redirect_url: window.location.origin + '/npm/brandpay/brandpay_result.html',
            user: {
                id: demoUser.id,
                username: demoUser.username,
                phone: demoUser.phone,
                email: demoUser.email
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
window.changePg = changePg
