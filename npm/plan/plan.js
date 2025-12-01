// NPM 패키지에서 import
import { BootpayCommerce } from '@bootpay/bp-commerce-sdk'

// API 서버 주소 (환경변수 또는 상대경로)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

// ========================================
// 환경별 설정 (development, stage, production)
// ========================================
const ENV_CONFIG = {
    development: {
        client_key: 'hxS-Up--5RvT6oU6QJE0JA',
        plans: {
            starter: {
                monthly_product_id: '69268625d8df8fa1837cf661',
                yearly_product_id: '692686c4d8df8fa1837cf666'
            },
            pro: {
                monthly_product_id: '692686e5d8df8fa1837cf66b',
                yearly_product_id: '69268721d8df8fa1837cf670'
            },
            enterprise: {
                monthly_product_id: '69268783d8df8fa1837cf675',
                yearly_product_id: '692687a2d8df8fa1837cf67a'
            }
        }
    },
    stage: {
        client_key: 'hxS-Up--5RvT6oU6QJE0JA', // Stage 환경 키 (필요시 변경)
        plans: {
            starter: {
                monthly_product_id: '6927d893ff30795ff003d374',
                yearly_product_id: '6927d8c310561eabadddcfae'
            },
            pro: {
                monthly_product_id: '6927d8f9ff30795ff003d379',
                yearly_product_id: '6927d9167f65277ba9ddcf71'
            },
            enterprise: {
                monthly_product_id: '6927d8f9ff30795ff003d379',
                yearly_product_id: '6927d9167f65277ba9ddcf71'
            }
        }
    },
    production: {
        client_key: 'sEN72kYZBiyMNytA8nUGxQ', // Production 환경 키 (필요시 변경)
        plans: {
            starter: {
                monthly_product_id: '6927d893ff30795ff003d374',
                yearly_product_id: '6927d8c310561eabadddcfae'
            },
            pro: {
                monthly_product_id: '6927d8f9ff30795ff003d379',
                yearly_product_id: '6927d9167f65277ba9ddcf71'
            },
            enterprise: {
                monthly_product_id: '6927d8f9ff30795ff003d379',
                yearly_product_id: '6927d9167f65277ba9ddcf71'
            }
        }
    }
    // sEN72kYZBiyMNytA8nUGxQ
    // rnZLJamENRgfwTccwmI_Uu9cxsPpAV9X2W-Htg73yfU=


    // 6927d523472c3a791b6250d0
    // FUstljVVgv2P5733quhf+ZaZZbU8tKGMptfGrcPb1jI=
}

// 플랜 기본 정보 (환경과 무관)
const PLAN_INFO = {
    starter: {
        name: 'Starter',
        monthly_price: 9900,
        yearly_price: 7900,
        features: ['5GB 클라우드 스토리지', '최대 3개 프로젝트', '기본 분석 대시보드']
    },
    pro: {
        name: 'Professional',
        monthly_price: 29900,
        yearly_price: 23900,
        features: ['100GB 클라우드 스토리지', '무제한 프로젝트', '고급 분석 및 리포트']
    },
    enterprise: {
        name: 'Enterprise',
        monthly_price: 99000,
        yearly_price: 79000,
        features: ['무제한 클라우드 스토리지', '무제한 프로젝트', '전용 계정 매니저']
    }
}

// 현재 결제 주기 상태 (월간/연간)
let isYearlyBilling = false

// 현재 환경 (localhost면 development, 아니면 production)
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
let currentEnv = isLocalDev ? 'development' : 'production'

// 현재 환경의 설정 가져오기
function getCurrentConfig() {
    return ENV_CONFIG[currentEnv]
}

// 플랜의 product_id 가져오기
function getProductId(planKey, isYearly) {
    const config = getCurrentConfig()
    const planConfig = config.plans[planKey]
    return isYearly ? planConfig.yearly_product_id : planConfig.monthly_product_id
}

// DOM이 로드된 후 초기화
document.addEventListener('DOMContentLoaded', function () {
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

    // Commerce SDK 환경 설정
    BootpayCommerce.setEnvironmentMode(currentEnv)

    console.log(`[Commerce] 환경: ${currentEnv}, Client Key: ${getCurrentConfig().client_key}`)
})

// 환경 변경
function changeEnv() {
    const envSelect = document.getElementById('env')
    currentEnv = envSelect.value

    // 환경 저장
    localStorage.setItem('bootpay_env', currentEnv)

    // Commerce SDK 환경 변경
    BootpayCommerce.setEnvironmentMode(currentEnv)

    console.log(`[Commerce] 환경 변경: ${currentEnv}, Client Key: ${getCurrentConfig().client_key}`)

    // 알림
    const envNames = {
        development: 'Development (테스트)',
        stage: 'Stage',
        production: 'Production (실서비스)'
    }
    alert(`환경이 ${envNames[currentEnv]}(으)로 변경되었습니다.`)
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

// 플랜 선택 및 결제 요청
async function selectPlan(planKey) {
    const plan = PLAN_INFO[planKey]
    if (!plan) {
        alert('알 수 없는 요금제입니다.')
        return
    }

    // Enterprise는 영업팀 문의
    if (planKey === 'enterprise') {
        alert('Enterprise 플랜은 영업팀으로 문의해 주세요.\n이메일: sales@cloudsync.example.com')
        return
    }

    const config = getCurrentConfig()
    const billingType = isYearlyBilling ? '연간' : '월간'
    const productId = getProductId(planKey, isYearlyBilling)

    console.log(`[결제 요청] 환경: ${currentEnv}, 플랜: ${planKey}, 상품ID: ${productId}`)

    try {
        // ========================================
        // STEP 1: 서버에 주문 생성 (위변조 방지)
        // ========================================
        console.log('서버에 플랜 주문 생성 요청...')

        const orderResponse = await fetch(`${API_BASE_URL}/api/orders/plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                product_id: productId,
                plan_key: planKey,
                billing_type: billingType,
                env: currentEnv
            })
        })

        const orderData = await orderResponse.json()

        if (!orderData.success) {
            throw new Error(orderData.message || '주문 생성 실패')
        }

        console.log('플랜 주문 생성 완료:', orderData)

        // ========================================
        // STEP 2: Bootpay Commerce 주문서 요청
        // ========================================
        BootpayCommerce.setLogLevel(1)

        const response = await BootpayCommerce.requestCheckout({
            client_key: config.client_key,
            name: `CloudSync Pro ${plan.name} 플랜`,
            memo: `${billingType} 구독 결제`,
            user: {
                membership_type: 'guest',
                user_id: 'demo_user_1234',
                name: '데모 사용자',
                phone: '01040334678',
                email: 'demo@example.com'
            },
            price: orderData.price,
            redirect_url: window.location.origin + '/npm/plan/plan_result.html',
            usage_api_url: currentEnv === 'production'
                ? 'https://api.bootapi.com/v1/billing/usage'
                : 'https://dev-api.bootapi.com/v1/billing/usage',
            use_auto_login: true,
            request_id: orderData.order_id,
            use_notification: true,
            products: [
                {
                    product_id: productId,
                    duration: -1,
                    quantity: 1
                }
            ],
            metadata: {
                order_id: orderData.order_id,
                plan_key: planKey,
                billing_type: billingType,
                env: currentEnv,
                selected_at: new Date().toISOString()
            },
            extra: {
                separately_confirmed: false,
                create_order_immediately: true
            }
        })

        console.log('Checkout Response:', response)

        // ========================================
        // STEP 3: 결제 완료 후 서버 검증
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

        alert(`${plan.name} 플랜 구독 요청이 완료되었습니다!\n\n콘솔에서 상세 응답을 확인하세요.`)

    } catch (error) {
        console.error('Checkout Error:', error)
        alert('구독 요청 중 오류가 발생했습니다:\n' + error.message)
    }
}

// 전역 스코프에 함수 노출 (HTML에서 onclick으로 호출하기 위해)
window.toggleBilling = toggleBilling
window.selectPlan = selectPlan
window.focusPlan = focusPlan
window.toggleSettings = toggleSettings
window.changeEnv = changeEnv
