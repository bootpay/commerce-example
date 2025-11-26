// NPM 패키지에서 import
import { BootpayCommerce } from '@bootpay/bp-commerce-sdk'

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
function selectPlan(planKey) {
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

    const price = isYearlyBilling ? plan.yearly_price : plan.monthly_price
    const duration = isYearlyBilling ? 12 : 1
    const billingType = isYearlyBilling ? '연간' : '월간'
    const productId = isYearlyBilling ? plan.yearly_product_id : plan.monthly_product_id

    // 결제 확인
    // if (!confirm(`${plan.name} 플랜 (${billingType} 결제)\n\n가격: ₩${price.toLocaleString()}/월\n\n구독을 시작하시겠습니까?`)) {
    //     return
    // }

    // showLoading(true)
    BootpayCommerce.setLogLevel(1)
    // Bootpay 청구서 요청
    BootpayCommerce.requestInvoice({
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
        price: price,
        redirect_url: window.location.origin + '/src/plan/plan_result.html',
        usage_api_url: 'https://dev-api.bootapi.com/v1/billing/usage',
        // use_notification: true,
        use_auto_login: true,
        request_id: `plan_${planKey}_${Date.now()}`,
        products: [
            {
                product_id: productId,
                duration: -1,
                quantity: 1,
                // price_adjustments: isYearlyBilling ? [
                //     {
                //         price_adjustment_id: 'yearly_discount',
                //         start_at: new Date().toISOString().split('T')[0] + ' 00:00:00',
                //         end_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + ' 23:59:59',
                //         name: '연간 결제 20% 할인',
                //         cycles: [
                //             {
                //                 duration: 12,
                //                 adjustment_type: 'discount_percent',
                //                 name: '연간 할인',
                //                 value: 20
                //             }
                //         ]
                //     }
                // ] : []
            }
        ],
        metadata: {
            plan_key: planKey,
            billing_type: billingType,
            selected_at: new Date().toISOString()
        },
        extra: {
            separately_confirmed: false,
            create_order_immediately: true
        }
    }).then(function (response) {
        // showLoading(false)
        console.log('Invoice Response:', response)
        alert(`${plan.name} 플랜 구독 요청이 완료되었습니다!\n\n콘솔에서 상세 응답을 확인하세요.`)
    }).catch((error) => {
        // showLoading(false)
        console.error('Invoice Error:', error)
        alert('구독 요청 중 오류가 발생했습니다:\n' + error.message)
    })
}

// 전역 스코프에 함수 노출 (HTML에서 onclick으로 호출하기 위해)
window.saveData = saveData
window.changeMode = changeMode
window.toggleBilling = toggleBilling
window.toggleSettings = toggleSettings
window.selectPlan = selectPlan
window.focusPlan = focusPlan
