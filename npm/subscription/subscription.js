// NPM 패키지에서 import — 자동결제(정기결제)는 Bootpay.requestSubscription() 사용
import { Bootpay } from '@bootpay/client-js'

// API 서버 주소 (환경변수 또는 상대경로)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

// ========================================
// 환경별 설정 (development, stage, production)
// requestSubscription 은 client_key 사용 (통합결제와 동일)
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

const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
let currentEnv = isLocalDev ? 'development' : 'production'
let currentPg = ''   // 빈 값 = 기본(자동) = 현행 동작 유지

function getCurrentConfig() {
    return ENV_CONFIG[currentEnv]
}

const subscriptionInfo = {
    planId: 'membership_pro',
    planName: 'Pro',
    price: 19900
}

document.addEventListener('DOMContentLoaded', function() {
    if (isLocalDev) {
        currentEnv = 'development'
    } else {
        currentEnv = localStorage.getItem('bootpay_env') || 'production'
    }

    const envSelect = document.getElementById('env')
    if (envSelect) envSelect.value = currentEnv

    currentPg = localStorage.getItem('bootpay_pg') || ''
    const pgSelect = document.getElementById('pg')
    if (pgSelect) pgSelect.value = currentPg

    Bootpay.setEnvironmentMode(currentEnv)

    console.log(`[Subscription] 환경: ${currentEnv}, Client Key: ${getCurrentConfig().client_key}`)

    bindEventListeners()
    updateSummary()
})

function bindEventListeners() {
    document.getElementById('checkout-btn')?.addEventListener('click', startSubscription)

    document.querySelectorAll('.plan-card').forEach(card => {
        card.addEventListener('click', function() {
            document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('active'))
            this.classList.add('active')
            subscriptionInfo.planId = this.dataset.plan
            subscriptionInfo.planName = this.querySelector('.plan-name').textContent.trim().split(' ')[0]
            subscriptionInfo.price = parseInt(this.dataset.price)
            updateSummary()
        })
    })
}

function updateSummary() {
    document.getElementById('summary-plan').textContent = subscriptionInfo.planName
    document.getElementById('total-price').textContent = subscriptionInfo.price.toLocaleString()
    document.getElementById('btn-price').textContent = subscriptionInfo.price.toLocaleString()
}

function changeEnv() {
    const envSelect = document.getElementById('env')
    currentEnv = envSelect.value
    localStorage.setItem('bootpay_env', currentEnv)
    Bootpay.setEnvironmentMode(currentEnv)
    console.log(`[Subscription] 환경 변경: ${currentEnv}`)
    const envNames = { development: 'Development (테스트)', stage: 'Stage', production: 'Production (실서비스)' }
    showToast(`환경이 ${envNames[currentEnv]}(으)로 변경되었습니다.`)
}

function changePg() {
    currentPg = document.getElementById('pg').value
    localStorage.setItem('bootpay_pg', currentPg)
    console.log(`[Subscription] PG 변경: ${currentPg || '기본 (자동)'}`)
    showToast(currentPg ? `PG사가 ${currentPg}(으)로 지정되었습니다.` : 'PG사를 기본(자동)으로 변경했습니다.')
}

function toggleSettings() {
    const content = document.querySelector('.settings-content')
    const toggle = document.querySelector('.settings-toggle')
    content.classList.toggle('show')
    toggle.textContent = content.classList.contains('show') ? '▼' : '▲'
}

// ========================================
// 구독 시작 — 빌링키 발급(클라이언트) → 정기결제 승인(서버)
// ========================================
async function startSubscription() {
    const checkoutBtn = document.getElementById('checkout-btn')
    checkoutBtn.classList.add('loading')
    checkoutBtn.disabled = true

    try {
        // STEP 1. Bootpay.requestSubscription() 으로 빌링키 발급
        // 카드 등록 창이 열리고, 완료되면 빌링키 영수증(receipt_id)이 반환된다.
        // subscription_id 는 숫자 timestamp 형식이어야 한다 (Bootpay 정기결제 규격)
        const subscriptionId = Date.now()

        const payload = {
            client_key: getCurrentConfig().client_key,
            order_name: subscriptionInfo.planName + ' 멤버십 (월 자동결제)',
            subscription_id: subscriptionId,
            price: subscriptionInfo.price,
            tax_free: 0,
            user: {
                id: 'demo_user_' + Date.now(),
                username: '홍길동',
                phone: '01012345678',
                email: 'demo@example.com'
            },
            extra: {
                open_type: 'iframe'
            }
        }
        // 정기결제(requestSubscription)는 pg 가 필수. 글로벌 PG 미선택 시 기본 빌링 PG로 폴백
        payload.pg = currentPg || 'nicepay'

        const response = await Bootpay.requestSubscription(payload)

        console.log('빌링키 발급 결과:', response)

        if (response.event !== 'done' && response.event !== 'issued' && response.event !== 'confirm') {
            throw new Error('빌링키 발급이 완료되지 않았습니다.')
        }

        // STEP 2. 서버로 receipt_id 전달 → 빌링키 조회 + 첫 정기결제 승인
        console.log('서버에 정기결제 승인 요청...')
        const billingResponse = await fetch(`${API_BASE_URL}/api/subscribe/billing-key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                receipt_id: response.receipt_id,
                plan_id: subscriptionInfo.planId,
                env: currentEnv
            })
        })
        const result = await billingResponse.json()
        if (!result.success) throw new Error(result.message || '정기결제 승인 실패')

        console.log('정기결제 승인 완료:', result)

        // STEP 3. 결과 페이지로 이동
        const params = new URLSearchParams({
            receipt_id: result.receipt_id,
            billing_key: result.billing_key,
            plan_id: result.plan_id,
            order_name: result.order_name,
            price: result.price,
            card_company: result.card_company || '',
            card_no: result.card_no || '',
            next_billing_at: result.next_billing_at || '',
            status: '1',
            env: currentEnv
        })
        window.location.href = '/npm/subscription/subscription_result.html?' + params.toString()
    } catch (error) {
        console.error('구독 실패:', error)
        if (error?.event === 'cancel') {
            showToast('카드 등록을 취소했습니다.', 'error')
        } else {
            showToast('구독 실패: ' + (error.message || error.error_message || '알 수 없는 오류'), 'error')
        }
    } finally {
        checkoutBtn.classList.remove('loading')
        checkoutBtn.disabled = false
    }
}

function showToast(message, type = '') {
    const toast = document.getElementById('toast')
    toast.textContent = message
    toast.className = 'toast show ' + type
    setTimeout(() => { toast.className = 'toast' }, 3000)
}

// 인라인 onclick 핸들러용 전역 노출
window.toggleSettings = toggleSettings
window.changeEnv = changeEnv
window.changePg = changePg
