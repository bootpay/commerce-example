// API 서버 주소 (환경변수 또는 상대경로)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

// ========================================
// 환경별 설정 (development, stage, production)
// ========================================
const ENV_CONFIG = {
    development: {
        products: {
            basic: { product_id: '69268625d8df8fa1837cf661' },
            pro: { product_id: '692686e5d8df8fa1837cf66b' },
            enterprise: { product_id: '69268783d8df8fa1837cf675' }
        }
    },
    stage: {
        products: {
            basic: { product_id: '6927d893ff30795ff003d374' },
            pro: { product_id: '6927d8f9ff30795ff003d379' },
            enterprise: { product_id: '6927d8f9ff30795ff003d379' }
        }
    },
    production: {
        products: {
            basic: { product_id: '6927d893ff30795ff003d374' },
            pro: { product_id: '6927d8f9ff30795ff003d379' },
            enterprise: { product_id: '6927d8f9ff30795ff003d379' }
        }
    }
}

// 상품 기본 정보
const PRODUCT_INFO = {
    basic: {
        name: 'Basic 플랜',
        price: 29900,
        desc: '개인 사용자를 위한 기본 플랜'
    },
    pro: {
        name: 'Pro 플랜',
        price: 99000,
        desc: '팀과 비즈니스를 위한 프로 플랜'
    },
    enterprise: {
        name: 'Enterprise 플랜',
        price: 299000,
        desc: '대규모 조직을 위한 엔터프라이즈 솔루션'
    }
}

// 현재 환경 (localhost면 development, 아니면 production)
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
let currentEnv = isLocalDev ? 'development' : 'production'

// 현재 선택된 상품
let selectedProduct = 'basic'

// 현재 알림 방법
let notificationMethod = 'email'

// 직접 금액 입력 모드
let isCustomAmount = false

// 현재 환경의 설정 가져오기
function getCurrentConfig() {
    return ENV_CONFIG[currentEnv]
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

    console.log(`[Payment Link] 환경: ${currentEnv}`)

    // 입력 필드 이벤트 리스너 (미리보기 업데이트)
    document.getElementById('customerName').addEventListener('input', updatePreview)
    document.getElementById('customerEmail').addEventListener('input', updatePreview)
    document.getElementById('customerPhone').addEventListener('input', updatePreview)
    document.getElementById('customPrice').addEventListener('input', updatePreview)
    document.getElementById('customName').addEventListener('input', updatePreview)

    // 초기 미리보기 업데이트
    updatePreview()
})

// 환경 변경
function changeEnv() {
    const envSelect = document.getElementById('env')
    currentEnv = envSelect.value

    // 환경 저장
    localStorage.setItem('bootpay_env', currentEnv)

    console.log(`[Payment Link] 환경 변경: ${currentEnv}`)

    const envNames = {
        development: 'Development (테스트)',
        stage: 'Stage',
        production: 'Production (실서비스)'
    }
    alert(`환경이 ${envNames[currentEnv]}(으)로 변경되었습니다.`)
}

// 상품 선택
function selectProduct(element) {
    // 모든 상품 카드에서 selected 제거
    document.querySelectorAll('.product-card').forEach(card => {
        card.classList.remove('selected')
    })

    // 선택한 카드에 selected 추가
    element.classList.add('selected')

    // 선택한 상품 저장
    selectedProduct = element.dataset.product

    // 미리보기 업데이트
    updatePreview()
}

// 직접 금액 입력 토글
function toggleCustomAmount() {
    const checkbox = document.getElementById('customAmountCheck')
    const customInput = document.getElementById('customAmountInput')

    isCustomAmount = checkbox.checked

    if (isCustomAmount) {
        customInput.classList.add('show')
        // 상품 카드 선택 해제
        document.querySelectorAll('.product-card').forEach(card => {
            card.classList.remove('selected')
        })
    } else {
        customInput.classList.remove('show')
        // 첫 번째 상품 카드 선택
        const firstCard = document.querySelector('.product-card')
        if (firstCard) {
            firstCard.classList.add('selected')
            selectedProduct = firstCard.dataset.product
        }
    }

    updatePreview()
}

// 알림 방법 선택
function selectNotificationMethod(method) {
    notificationMethod = method

    // UI 업데이트
    document.querySelectorAll('.notification-method').forEach(el => {
        el.classList.remove('selected')
    })
    document.querySelector(`input[value="${method}"]`).closest('.notification-method').classList.add('selected')

    // 이메일/전화번호 필드 표시/숨김
    const emailGroup = document.getElementById('emailGroup')
    const phoneGroup = document.getElementById('phoneGroup')

    if (method === 'email') {
        emailGroup.style.display = 'block'
        phoneGroup.style.display = 'none'
    } else if (method === 'sms') {
        emailGroup.style.display = 'none'
        phoneGroup.style.display = 'block'
    } else {
        // both
        emailGroup.style.display = 'block'
        phoneGroup.style.display = 'block'
    }

    updatePreview()
}

// 미리보기 업데이트
function updatePreview() {
    const previewProduct = document.getElementById('previewProduct')
    const previewPrice = document.getElementById('previewPrice')
    const previewRecipient = document.getElementById('previewRecipient')
    const previewMethod = document.getElementById('previewMethod')

    // 상품명/가격
    if (isCustomAmount) {
        const customName = document.getElementById('customName').value || '직접 입력 상품'
        const customPrice = document.getElementById('customPrice').value || 0
        previewProduct.textContent = customName
        previewPrice.textContent = `₩${Number(customPrice).toLocaleString()}`
    } else {
        const product = PRODUCT_INFO[selectedProduct]
        previewProduct.textContent = product.name
        previewPrice.textContent = `₩${product.price.toLocaleString()}`
    }

    // 수신자
    const customerName = document.getElementById('customerName').value
    const customerEmail = document.getElementById('customerEmail').value
    const customerPhone = document.getElementById('customerPhone').value

    let recipientText = customerName || '-'
    if (notificationMethod === 'email' && customerEmail) {
        recipientText = `${customerName || '-'} (${customerEmail})`
    } else if (notificationMethod === 'sms' && customerPhone) {
        recipientText = `${customerName || '-'} (${customerPhone})`
    } else if (notificationMethod === 'both') {
        const contacts = []
        if (customerEmail) contacts.push(customerEmail)
        if (customerPhone) contacts.push(customerPhone)
        if (contacts.length > 0) {
            recipientText = `${customerName || '-'} (${contacts.join(', ')})`
        }
    }
    previewRecipient.textContent = recipientText

    // 발송 방법
    const methodNames = {
        email: '이메일',
        sms: 'SMS',
        both: '이메일 + SMS'
    }
    previewMethod.textContent = methodNames[notificationMethod]
}

// 설정 패널 토글
function toggleSettings() {
    const content = document.querySelector('.settings-content')
    const toggle = document.querySelector('.settings-toggle')
    content.classList.toggle('show')
    toggle.textContent = content.classList.contains('show') ? '▼' : '▲'
}

// 입력 검증
function validateInputs() {
    const customerName = document.getElementById('customerName').value.trim()
    const customerEmail = document.getElementById('customerEmail').value.trim()
    const customerPhone = document.getElementById('customerPhone').value.trim()

    if (!customerName) {
        alert('고객명을 입력해주세요.')
        return false
    }

    if (notificationMethod === 'email' || notificationMethod === 'both') {
        if (!customerEmail) {
            alert('이메일 주소를 입력해주세요.')
            return false
        }
        // 간단한 이메일 형식 검증
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
            alert('올바른 이메일 형식을 입력해주세요.')
            return false
        }
    }

    if (notificationMethod === 'sms' || notificationMethod === 'both') {
        if (!customerPhone) {
            alert('휴대폰 번호를 입력해주세요.')
            return false
        }
        // 간단한 전화번호 형식 검증 (숫자와 하이픈만)
        if (!/^[\d-]+$/.test(customerPhone)) {
            alert('올바른 휴대폰 번호를 입력해주세요.')
            return false
        }
    }

    if (isCustomAmount) {
        const customPrice = document.getElementById('customPrice').value
        const customName = document.getElementById('customName').value.trim()

        if (!customPrice || customPrice < 100) {
            alert('결제 금액을 100원 이상 입력해주세요.')
            return false
        }
        if (!customName) {
            alert('상품명을 입력해주세요.')
            return false
        }
    }

    return true
}

// 전화번호 포맷팅 (하이픈 제거)
function formatPhone(phone) {
    return phone.replace(/-/g, '')
}

// 결제링크 발송
async function sendPaymentLink() {
    if (!validateInputs()) return

    const loadingOverlay = document.getElementById('loadingOverlay')
    loadingOverlay.classList.add('show')

    try {
        const config = getCurrentConfig()
        const customerName = document.getElementById('customerName').value.trim()
        const customerEmail = document.getElementById('customerEmail').value.trim()
        const customerPhone = formatPhone(document.getElementById('customerPhone').value.trim())
        const orderMemo = document.getElementById('orderMemo').value.trim()

        // 상품 정보
        let productName, price, productId

        if (isCustomAmount) {
            productName = document.getElementById('customName').value.trim()
            price = parseInt(document.getElementById('customPrice').value)
            productId = null // 직접 입력 시 product_id 없음
        } else {
            const product = PRODUCT_INFO[selectedProduct]
            productName = product.name
            price = product.price
            productId = config.products[selectedProduct].product_id
        }

        console.log(`[결제링크 발송] 환경: ${currentEnv}, 상품: ${productName}, 가격: ${price}`)

        // ========================================
        // 서버로 결제링크 생성 요청 (REST API)
        // 서버에서 Bootpay Commerce REST API를 호출하여 invoice 생성
        // ========================================
        console.log('서버에 결제링크 생성 요청...')

        const orderResponse = await fetch(`${API_BASE_URL}/api/orders/payment-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                product_id: productId,
                product_name: productName,
                price: price,
                customer_name: customerName,
                customer_email: customerEmail,
                customer_phone: customerPhone,
                notification_method: notificationMethod,
                memo: orderMemo,
                redirect_url: window.location.origin + '/npm/payment-link/payment-link_result.html',
                env: currentEnv
            })
        })

        const orderData = await orderResponse.json()

        if (!orderData.success) {
            throw new Error(orderData.message || '결제링크 생성 실패')
        }

        console.log('결제링크 생성 완료:', orderData)

        // ========================================
        // 결과 페이지로 이동
        // ========================================
        const resultParams = new URLSearchParams({
            order_id: orderData.order_id,
            product_name: productName,
            price: price,
            customer_name: customerName,
            notification_method: notificationMethod,
            env: currentEnv,
            status: 'sent'
        })

        if (customerEmail) resultParams.append('customer_email', customerEmail)
        if (customerPhone) resultParams.append('customer_phone', customerPhone)
        if (orderData.invoice_id) resultParams.append('invoice_id', orderData.invoice_id)

        window.location.href = `/npm/payment-link/payment-link_result.html?${resultParams.toString()}`

    } catch (error) {
        console.error('Payment Link Error:', error)
        alert('결제링크 발송 중 오류가 발생했습니다:\n' + error.message)
    } finally {
        loadingOverlay.classList.remove('show')
    }
}

// 전역 스코프에 함수 노출
window.selectProduct = selectProduct
window.toggleCustomAmount = toggleCustomAmount
window.selectNotificationMethod = selectNotificationMethod
window.sendPaymentLink = sendPaymentLink
window.toggleSettings = toggleSettings
window.changeEnv = changeEnv
