// NPM 패키지에서 import
import { BootpayCommerce } from '@bootpay/bp-commerce-sdk'

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
        membership_type: 'member',
        user_id: user.id,
        name: user.username,
        phone: user.phone || fallback.phone,
        email: user.email
    }
}

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

// 현재 선택된 플랜 (항상 하나는 선택되어 있음)
let selectedPlanKey = 'pro'

// 현재 환경 (localhost면 development, 아니면 production)
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
let currentEnv = isLocalDev ? 'development' : 'production'

// 현재 PG (빈 값이면 미적용 = 자동)
let currentPg = ''

// 게이팅 상태 — 요금제는 항상 선택되어 있으므로 methodCompleted = true 고정,
// 약관(termsCompleted)만으로 구독하기 버튼 활성화
let methodCompleted = true
let termsCompleted = false

// ========================================
// 약관 전문 (데모용 샘플 — 실제 서비스에서는 법무 검토 문구로 교체)
// ========================================
const TERMS = {
    purchase: {
        title: '구독조건 확인 및 결제진행 동의',
        sections: [
            { h: '제1조 (목적)', p: '본 약관은 회원이 CloudSync Pro(이하 "회사")의 요금제를 구독하고 정기결제를 진행함에 있어 필요한 구독조건 및 결제대행 서비스 이용에 관한 사항을 규정합니다.' },
            { h: '제2조 (구독 및 결제)', p: '① 회원은 선택한 요금제의 명칭, 결제 주기(월간/연간), 결제 금액을 확인한 후 구독을 진행합니다.\n② 결제는 부트페이(Bootpay) 결제대행 서비스를 통해 처리되며, 회원은 결제수단 정보를 정확히 입력해야 합니다.\n③ 결제 금액은 회사 서버에서 최종 검증되며, 위·변조된 금액으로의 결제는 무효 처리될 수 있습니다.' },
            { h: '제3조 (구독 갱신 및 해지)', p: '구독은 해지 전까지 선택한 주기마다 자동으로 갱신·청구됩니다. 회원은 언제든지 구독을 해지할 수 있으며, 해지 시 잔여 이용 기간 및 환불 정책은 회사의 정책에 따릅니다.' },
            { h: '제4조 (청약철회 및 환불)', p: '회원은 관련 법령에 따라 청약철회를 요청할 수 있으며, 환불은 회사의 환불 정책 및 결제수단별 처리 절차에 따라 진행됩니다.' },
            { h: '동의 확인', p: '본인은 위 구독조건을 확인하였으며 결제 진행에 동의합니다.' }
        ]
    },
    privacy: {
        title: '개인정보 수집 및 이용 동의',
        sections: [
            { h: '1. 수집 항목', p: '이름, 연락처(휴대전화번호), 이메일 주소, 결제수단 정보, 구독 및 결제 내역' },
            { h: '2. 수집 및 이용 목적', p: '본인확인, 구독 신청 및 서비스 제공, 결제 및 결제대행 처리, 고객 문의 대응, 해지·환불 처리' },
            { h: '3. 보유 및 이용 기간', p: '전자상거래 등에서의 소비자보호에 관한 법률 등 관련 법령에 따라 거래기록은 5년간 보관하며, 보유 목적 달성 시 지체 없이 파기합니다.' },
            { h: '4. 동의 거부 권리 및 불이익', p: '회원은 개인정보 수집·이용 동의를 거부할 수 있습니다. 다만 필수 항목에 동의하지 않을 경우 구독 및 결제 서비스 이용이 제한됩니다.' },
            { h: '동의 확인', p: '본인은 위 내용을 확인하였으며 개인정보 수집·이용에 동의합니다.' }
        ]
    },
    marketing: {
        title: '마케팅 정보 수신 동의 (선택)',
        sections: [
            { h: '1. 수집 및 이용 목적', p: '신규 기능 안내, 할인·프로모션 및 이벤트 정보 제공, 맞춤형 혜택 및 광고 안내' },
            { h: '2. 발송 채널', p: '이메일, SMS/MMS, 앱 푸시 알림' },
            { h: '3. 보유 및 이용 기간', p: '수신 동의 철회 시 또는 회원 탈퇴 시까지' },
            { h: '4. 선택 동의 안내', p: '본 동의는 선택 사항이며, 동의하지 않아도 구독 및 결제 이용에는 제한이 없습니다. 동의 후에도 언제든지 수신을 거부할 수 있습니다.' },
            { h: '동의 확인', p: '본인은 위 내용을 확인하였으며 마케팅 정보 수신에 동의합니다. (선택)' }
        ]
    }
}

let activeTermKey = null  // 현재 modal에 표시 중인 약관 키

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

    // PG 복원
    currentPg = localStorage.getItem('bootpay_pg') || ''
    const pgSelect = document.getElementById('pg')
    if (pgSelect) {
        pgSelect.value = currentPg
    }

    // Commerce SDK 환경 설정
    BootpayCommerce.setEnvironmentMode(currentEnv)

    console.log(`[Commerce] 환경: ${currentEnv}, Client Key: ${getCurrentConfig().client_key}`)

    // 기본 선택 플랜 표시 + 약관/구독 버튼 바인딩
    focusPlan(selectedPlanKey)
    bindTermsListeners()
    bindTermsModal()
    document.getElementById('checkout-btn')?.addEventListener('click', requestCheckout)
    updateCheckoutButton()
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
    showToast(`환경이 ${envNames[currentEnv]}(으)로 변경되었습니다.`)
}

// PG 변경
function changePg() {
    const pgSelect = document.getElementById('pg')
    currentPg = pgSelect.value
    localStorage.setItem('bootpay_pg', currentPg)
    console.log(`[Commerce] PG 변경: ${currentPg || '기본 (자동)'}`)
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

    // 우측 요약 갱신
    updateSummary()
}

// 플랜 선택 (좌측 카드 → 우측 요약 갱신)
function focusPlan(planKey) {
    if (!PLAN_INFO[planKey]) return
    selectedPlanKey = planKey

    // 모든 카드에서 selected 클래스 제거
    document.querySelectorAll('.pricing-card').forEach(card => {
        card.classList.remove('selected')
    })

    // 선택한 카드에 selected 클래스 추가
    const selectedCard = document.querySelector(`[data-plan="${planKey}"]`)
    if (selectedCard) {
        selectedCard.classList.add('selected')
    }

    updateSummary()
}

// 우측 구독 요약 갱신
function updateSummary() {
    const plan = PLAN_INFO[selectedPlanKey]
    if (!plan) return

    const isEnterprise = selectedPlanKey === 'enterprise'
    const billingType = isYearlyBilling ? '연간' : '월간'
    const price = isYearlyBilling ? plan.yearly_price : plan.monthly_price

    document.getElementById('summary-plan').textContent = plan.name
    document.getElementById('summary-cycle').textContent = billingType
    document.getElementById('summary-total-label').textContent = isYearlyBilling ? '연간 환산 월 금액' : '월 결제 금액'
    document.getElementById('summary-price').textContent = price.toLocaleString()
    document.getElementById('summary-price-cycle').textContent = '/ 월'

    // Enterprise 안내 표시 / 구독하기 버튼 텍스트 전환
    const summaryCard = document.getElementById('summary-card')
    const btnText = document.querySelector('#checkout-btn .btn-text')
    if (isEnterprise) {
        summaryCard.classList.add('enterprise')
        if (btnText) btnText.textContent = '영업팀 문의'
    } else {
        summaryCard.classList.remove('enterprise')
        if (btnText) btnText.textContent = '구독하기'
    }

    updateCheckoutButton()
}

// 설정 패널 토글
function toggleSettings() {
    const content = document.querySelector('.settings-content')
    const toggle = document.querySelector('.settings-toggle')
    content.classList.toggle('show')
    toggle.textContent = content.classList.contains('show') ? '▼' : '▲'
}

// ========================================
// 약관 동의 (우측 패널)
// ========================================

function bindTermsListeners() {
    const agreeAll = document.getElementById('agree-all')
    const termChecks = document.querySelectorAll('.term-check')

    // 전체 동의 토글
    agreeAll?.addEventListener('change', function() {
        termChecks.forEach(cb => { cb.checked = this.checked })
        updateTermsState()
    })

    // 개별 약관 변경 → 상태 갱신
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
// 구독하기 버튼 활성화 제어 (약관 동의만으로 게이팅)
// ========================================

function updateCheckoutButton() {
    const btn = document.getElementById('checkout-btn')
    const hint = document.getElementById('checkout-hint')
    if (!btn) return

    const isEnterprise = selectedPlanKey === 'enterprise'

    // Enterprise는 영업팀 문의 — 약관과 무관하게 항상 활성화
    if (isEnterprise) {
        btn.disabled = false
        if (hint) {
            hint.textContent = 'Enterprise는 영업팀 상담으로 진행됩니다.'
            hint.classList.remove('ready')
        }
        return
    }

    const ready = methodCompleted && termsCompleted
    btn.disabled = !ready

    if (!hint) return
    if (ready) {
        hint.textContent = '구독 준비가 완료되었습니다.'
        hint.classList.add('ready')
    } else {
        hint.textContent = '필수 약관에 동의해 주세요.'
        hint.classList.remove('ready')
    }
}

// ========================================
// 구독 요청 (현재 선택된 플랜 + 결제 주기 기준)
// ========================================
async function requestCheckout() {
    const planKey = selectedPlanKey
    const plan = PLAN_INFO[planKey]
    if (!plan) {
        showToast('알 수 없는 요금제입니다.', 'error')
        return
    }

    // Enterprise는 영업팀 문의
    if (planKey === 'enterprise') {
        alert('Enterprise 플랜은 영업팀으로 문의해 주세요.\n이메일: sales@cloudsync.example.com')
        return
    }

    if (!termsCompleted) {
        showToast('필수 약관에 동의해 주세요.', 'error')
        return
    }

    const checkoutBtn = document.getElementById('checkout-btn')
    checkoutBtn.classList.add('loading')
    checkoutBtn.disabled = true

    const config = getCurrentConfig()
    const billingType = isYearlyBilling ? '연간' : '월간'
    const productId = getProductId(planKey, isYearlyBilling)

    console.log(`[결제 요청] 환경: ${currentEnv}, 플랜: ${planKey}, 상품ID: ${productId}, PG: ${currentPg || '기본'}`)

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
                env: currentEnv,
                user_id: getDemoCurrentUser()?.id || null
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

        const payload = {
            client_key: config.client_key,
            name: `CloudSync Pro ${plan.name} 플랜`,
            memo: `${billingType} 구독 결제`,
            user: getPaymentUser({
                membership_type: 'guest',
                user_id: 'demo_user_1234',
                name: '데모 사용자',
                phone: '01040334678',
                email: 'demo@example.com'
            }),
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
        }

        // PG 지정 (비어있으면 자동)
        if (currentPg) payload.pg = currentPg

        const response = await BootpayCommerce.requestCheckout(payload)

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
                showToast(`결제 검증 실패: ${verifyResult.message}`, 'error')
                return
            }
        }

        showToast(`${plan.name} 플랜 구독 요청이 완료되었습니다!`, 'success')

    } catch (error) {
        console.error('Checkout Error:', error)
        showToast('구독 요청 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'), 'error')
    } finally {
        checkoutBtn.classList.remove('loading')
        updateCheckoutButton()
    }
}

// ========================================
// Toast 메시지
// ========================================
function showToast(message, type = '') {
    const toast = document.getElementById('toast')
    toast.textContent = message
    toast.className = 'toast show ' + type
    setTimeout(() => { toast.className = 'toast' }, 3000)
}

// 전역 스코프에 함수 노출 (HTML에서 onclick으로 호출하기 위해)
window.toggleBilling = toggleBilling
window.focusPlan = focusPlan
window.toggleSettings = toggleSettings
window.changeEnv = changeEnv
window.changePg = changePg
