// NPM 패키지에서 import
import { BootpayCommerce } from '@bootpay/bp-commerce-sdk'

// API 서버 주소
const API_BASE_URL = 'http://localhost:3001'

// 플랜 정보 정의
const PLANS = {
    starter: {
        name: 'Starter',
        monthly_product_id: '69268625d8df8fa1837cf661',
        yearly_product_id: '692686c4d8df8fa1837cf666',
        monthly_price: 9900,
        yearly_price: 7900,
        features: ['5GB 클라우드 스토리지', '최대 3개 프로젝트', '기본 분석 대시보드']
    },
    pro: {
        name: 'Professional',
        monthly_product_id: '692686e5d8df8fa1837cf66b',
        yearly_product_id: '69268721d8df8fa1837cf670',
        monthly_price: 29900,
        yearly_price: 23900,
        features: ['100GB 클라우드 스토리지', '무제한 프로젝트', '고급 분석 및 리포트']
    },
    enterprise: {
        name: 'Enterprise',
        monthly_product_id: '69268783d8df8fa1837cf675',
        yearly_product_id: '692687a2d8df8fa1837cf67a',
        monthly_price: 99000,
        yearly_price: 79000,
        features: ['무제한 클라우드 스토리지', '무제한 프로젝트', '전용 계정 매니저']
    }
}

// 현재 결제 주기 상태 (월간/연간)
let isYearlyBilling = false

// DOM이 로드된 후 초기화
document.addEventListener('DOMContentLoaded', function () {
    setSaveData()  // 내부에서 setEnvironmentMode() 호출됨
})

function getCacheMode() {
    try {
        const mode = window.localStorage.getItem('__mode_ex')
        return mode === undefined || mode === null ? 'development' : mode
    } catch (e) {
        return 'development'
    }
}

function getCache() {
    try {
        const data = JSON.parse(window.localStorage.getItem('__cache_ex' + document.getElementsByName('env')[0].value))
        return data === undefined || data === null ? {
            client_key: 'Dk9vJPvUr0j_lsEwwFoG7Q'
        } : data
    } catch (e) {
        return {
            client_key: 'Dk9vJPvUr0j_lsEwwFoG7Q'
        }
    }
}

function saveData() {
    let data = getCache()

    data.env = document.getElementsByName('env')[0].value
    data.client_key = document.getElementsByName('clientKey')[0].value

    window.localStorage.setItem('__mode_ex', document.getElementsByName('env')[0].value)
    window.localStorage.setItem('__cache_ex' + document.getElementsByName('env')[0].value, JSON.stringify(data))
    setSaveData()
    alert('설정이 저장되었습니다.')
}

function setSaveData() {
    document.getElementsByName('env')[0].value = getCacheMode()
    const cache = getCache()
    document.getElementsByName('clientKey')[0].value = cache.client_key
    BootpayCommerce.setEnvironmentMode(document.getElementsByName('env')[0].value)
}

function changeMode() {
    window.localStorage.setItem('__mode', document.getElementsByName('env')[0].value)
    setSaveData()
}

// 결제 주기 토글 (월간/연간)
function toggleBilling() {
    isYearlyBilling = !isYearlyBilling
    const toggle = document.getElementById('billingToggle')
    const monthlyLabel = document.querySelector('.monthly-label')
    const yearlyLabel = document.querySelector('.yearly-label')
    const originalPrices = document.querySelectorAll('.original-price')
    const discountBadges = document.querySelectorAll('.discount-badge')

    if (isYearlyBilling) {
        toggle.classList.add('active')
        monthlyLabel.classList.remove('active')
        yearlyLabel.classList.add('active')
    } else {
        toggle.classList.remove('active')
        monthlyLabel.classList.add('active')
        yearlyLabel.classList.remove('active')
    }

    // 가격 업데이트
    document.querySelectorAll('.price-value').forEach(el => {
        const monthly = el.dataset.monthly
        const yearly = el.dataset.yearly
        el.textContent = isYearlyBilling ? yearly : monthly
    })

    // 원래 가격 및 할인 배지 표시 (연간 결제 시)
    originalPrices.forEach(el => {
        if (isYearlyBilling) {
            el.classList.add('show')
        } else {
            el.classList.remove('show')
        }
    })
    discountBadges.forEach(el => {
        if (isYearlyBilling) {
            el.classList.add('show')
        } else {
            el.classList.remove('show')
        }
    })
}

// 플랜 포커스 (선택 상태 표시)
function focusPlan(planKey) {
    // 모든 카드에서 selected 클래스 제거
    document.querySelectorAll('.pricing-card').forEach(card => {
        card.classList.remove('selected')
    })

    // 선택한 카드에 selected 클래스 추가
    const selectedCard = document.querySelector(`[data-plan="${planKey}"]`)
    if (selectedCard) {
        selectedCard.classList.add('selected')
    }
}

// 설정 패널 토글
function toggleSettings() {
    const content = document.querySelector('.settings-content')
    const toggle = document.querySelector('.settings-toggle')
    content.classList.toggle('show')
    toggle.textContent = content.classList.contains('show') ? '▼' : '▲'
}

// 로딩 오버레이 표시/숨김
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay')
    if (show) {
        overlay.classList.add('show')
    } else {
        overlay.classList.remove('show')
    }
}

// 플랜 선택 및 결제 요청
async function selectPlan(planKey) {
    const plan = PLANS[planKey]
    if (!plan) {
        alert('알 수 없는 요금제입니다.')
        return
    }

    // Enterprise는 영업팀 문의
    if (planKey === 'enterprise') {
        alert('Enterprise 플랜은 영업팀으로 문의해 주세요.\n이메일: sales@cloudsync.example.com')
        return
    }

    const billingType = isYearlyBilling ? '연간' : '월간'
    const productId = isYearlyBilling ? plan.yearly_product_id : plan.monthly_product_id

    showLoading(true)

    try {
        // ========================================
        // STEP 1: 서버에 주문 생성 (위변조 방지)
        // ⭐ 클라이언트의 금액을 신뢰하지 않고, 서버에서 상품ID로 금액 조회
        // ========================================
        console.log('서버에 플랜 주문 생성 요청...')

        const orderResponse = await fetch(`${API_BASE_URL}/api/orders/plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                product_id: productId,
                plan_key: planKey,
                billing_type: billingType
            })
        })

        const orderData = await orderResponse.json()

        if (!orderData.success) {
            throw new Error(orderData.message || '주문 생성 실패')
        }

        console.log('플랜 주문 생성 완료:', orderData)
        // orderData.price는 서버에서 조회한 금액!

        // ========================================
        // STEP 2: Bootpay Commerce 청구서 요청
        // ⭐ 서버에서 받은 금액(orderData.price)으로 결제 요청
        // ========================================
        BootpayCommerce.setLogLevel(1)

        const response = await BootpayCommerce.requestInvoice({
            client_key: document.getElementsByName('clientKey')[0].value,
            name: `CloudSync Pro ${plan.name} 플랜`,
            memo: `${billingType} 구독 결제`,
            user: {
                membership_type: 'guest',
                user_id: 'demo_user_1234',
                name: '데모 사용자',
                phone: '01012345678',
                email: 'demo@example.com'
            },
            price: orderData.price,  // ⭐ 서버에서 계산한 금액 사용
            redirect_url: window.location.origin + '/src/plan/plan_result.html',
            usage_api_url: 'https://dev-api.bootapi.com/v1/billing/usage',
            use_auto_login: true,
            request_id: orderData.order_id,  // 서버에서 생성한 주문 ID
            products: [
                {
                    product_id: productId,
                    duration: -1,
                    quantity: 1
                }
            ],
            metadata: {
                order_id: orderData.order_id,  // 검증용 주문 ID 저장
                plan_key: planKey,
                billing_type: billingType,
                selected_at: new Date().toISOString()
            },
            extra: {
                separately_confirmed: false,
                create_order_immediately: true
            }
        })

        console.log('Invoice Response:', response)

        // ========================================
        // STEP 3: 결제 완료 후 서버 검증
        // ⭐ Commerce SDK의 경우 결제 완료 webhook 또는
        //    redirect_url에서 receipt_id를 받아 검증
        // ========================================
        if (response.receipt_id) {
            console.log('결제 검증 요청...')
            const verifyResponse = await fetch(`${API_BASE_URL}/api/orders/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    receipt_id: response.receipt_id,
                    order_id: orderData.order_id
                })
            })

            const verifyResult = await verifyResponse.json()
            console.log('검증 결과:', verifyResult)

            if (!verifyResult.success) {
                alert(`결제 검증 실패: ${verifyResult.message}`)
                return
            }
        }

        showLoading(false)
        alert(`${plan.name} 플랜 구독 요청이 완료되었습니다!\n\n콘솔에서 상세 응답을 확인하세요.`)

    } catch (error) {
        showLoading(false)
        console.error('Invoice Error:', error)
        alert('구독 요청 중 오류가 발생했습니다:\n' + error.message)
    }
}

// 전역 스코프에 함수 노출 (HTML에서 onclick으로 호출하기 위해)
window.saveData = saveData
window.changeMode = changeMode
window.toggleBilling = toggleBilling
window.toggleSettings = toggleSettings
window.selectPlan = selectPlan
window.focusPlan = focusPlan
