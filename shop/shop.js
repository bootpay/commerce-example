// 쇼핑몰 브라우저 공용 모듈 — 헤더/푸터, 장바구니 저장, 로그인 회원, 상품 일러스트.
import { MAX_CART_LINES, MAX_QUANTITY, SHOP_STORE, findShopProduct } from './catalog.js'

export const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || ''

// 결제창·본인인증창의 client_key 와 모드는 서버 환경변수가 정한다 (/api/shop/config).
// secret_key 는 Functions / server.js 에만 있다.
let pgClientPromise = null
export function loadPgClient() {
    pgClientPromise ||= api('/api/shop/config').then(({ client_key, mode }) => ({ clientKey: client_key, mode }))
        .catch(error => { pgClientPromise = null; throw error })
    return pgClientPromise
}

const USER_KEY = 'bootpay_demo_user'
const CART_KEY = 'bootpay_shop_cart'
const BUY_NOW_KEY = 'bootpay_shop_buy_now'

export function money(value) {
    return `${Number(value || 0).toLocaleString('ko-KR')}원`
}

export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
}

export async function api(path, { method = 'GET', body } = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data.success === false) {
        const error = new Error(data.message || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.')
        error.status = response.status
        error.code = data.code
        error.data = data
        throw error
    }
    return data
}

// ---------- 회원 ----------
export function currentUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') } catch { return null }
}
export function saveUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
}
export function logout() {
    localStorage.removeItem(USER_KEY)
}
// 외부 URL 로 튕겨 나가지 않도록 같은 사이트 경로만 허용한다.
export function safeNext(value, fallback = '/shop/products/index.html') {
    return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : fallback
}
export function loginPath(next = window.location.pathname + window.location.search) {
    return `/auth/login.html?${new URLSearchParams({ next })}`
}

// ---------- 장바구니 (productId / optionId / quantity 만 저장) ----------
function sanitizeLine(line) {
    const quantity = Number(line?.quantity)
    if (!line?.productId || !Number.isInteger(quantity) || quantity < 1) return null
    return { productId: String(line.productId), ...(line.optionId ? { optionId: String(line.optionId) } : {}), quantity: Math.min(quantity, MAX_QUANTITY) }
}
export function getCart() {
    try {
        const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]')
        return Array.isArray(raw) ? raw.map(sanitizeLine).filter(Boolean).slice(0, MAX_CART_LINES) : []
    } catch { return [] }
}
function saveCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items))
    window.dispatchEvent(new CustomEvent('shop:cart'))
}
const sameLine = (a, b) => a.productId === b.productId && (a.optionId || '') === (b.optionId || '')
export function addToCart(selection) {
    const items = getCart()
    const existing = items.find(item => sameLine(item, selection))
    if (existing) existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + selection.quantity)
    else {
        if (items.length >= MAX_CART_LINES) throw new Error(`장바구니에는 ${MAX_CART_LINES}종까지 담을 수 있어요.`)
        items.push(sanitizeLine(selection))
    }
    saveCart(items)
}
export function setCartQuantity(line, quantity) {
    const items = getCart()
    saveCart(quantity > 0 ? items.map(item => sameLine(item, line) ? { ...item, quantity } : item) : items.filter(item => !sameLine(item, line)))
}
// 결제 완료가 서버에서 확인된 주문의 수량만 장바구니에서 뺀다. 그 뒤 더 담은 수량은 남는다.
export function subtractFromCart(lines) {
    const items = getCart().map(item => {
        const ordered = lines.find(line => sameLine(line, item))
        return ordered ? { ...item, quantity: item.quantity - ordered.quantity } : item
    }).filter(item => item.quantity > 0)
    saveCart(items)
}
export function cartCount() {
    return getCart().reduce((sum, item) => sum + item.quantity, 0)
}
export function setBuyNow(selection) {
    sessionStorage.setItem(BUY_NOW_KEY, JSON.stringify(sanitizeLine(selection)))
}
export function getBuyNow() {
    try { return sanitizeLine(JSON.parse(sessionStorage.getItem(BUY_NOW_KEY) || 'null')) } catch { return null }
}

// ---------- 아이콘 / 상품 일러스트 ----------
const ICON_PATHS = {
    'arrow-right': 'M4 12h16M14 6l6 6-6 6',
    'arrow-left': 'M20 12H4M10 6l-6 6 6 6',
    'arrow-up-right': 'M7 17 17 7M8 7h9v9',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    check: 'm5 12.5 4.5 4.5L19 7',
    clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'
}
export function icon(name, size = 16) {
    return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${ICON_PATHS[name]}"/></svg>`
}

const ART = {
    vase: '<path d="M38 14h24v8c0 6 12 14 12 34 0 18-10 30-24 30S26 74 26 56c0-20 12-28 12-34Z"/><path d="M50 14V4M50 4c-8 2-12 8-14 12M50 4c8 2 12 8 14 12"/>',
    bouquet: '<path d="M42 92 50 50l8 42Z"/><circle cx="40" cy="30" r="10"/><circle cx="60" cy="26" r="11"/><circle cx="50" cy="44" r="9"/><path d="M50 50 40 40M50 50l10-14"/>',
    mug: '<path d="M22 30h44v42a14 14 0 0 1-14 14H36a14 14 0 0 1-14-14Z"/><path d="M66 40h6a10 10 0 0 1 0 20h-6"/><path d="M36 12c-4 6 4 8 0 14M48 12c-4 6 4 8 0 14"/>',
    towel: '<path d="M24 16h52v70H24Z"/><path d="M24 30h52M24 74h52"/><path d="M36 16v-6h28v6"/>',
    tray: '<path d="M10 52h80l-6 18H16Z"/><path d="M24 52V40h52v12"/><path d="M32 46h10M58 46h10"/>',
    basket: '<path d="M16 42h68l-8 44H24Z"/><path d="M30 42c0-18 40-18 40 0"/><path d="M22 56h56M26 70h48"/>',
    lamp: '<path d="M30 46 38 14h24l8 32Z"/><path d="M50 46v34M34 86h32"/>',
    candle: '<path d="M30 36h40v50H30Z"/><path d="M50 36v-8"/><path d="M50 26c-5-6 0-12 0-16 0 4 5 10 0 16Z"/><path d="M30 50h40"/>',
    bottle: '<path d="M38 34h24v52H38Z"/><path d="M44 34V22h12v12"/><path d="M42 14h16v8H42Z"/><path d="M38 52h24"/>'
}
export function productArt(product, { soldOut = false } = {}) {
    const body = ART[product?.shape] || ART.vase
    return `<div class="product-art${soldOut ? ' is-soldout' : ''}" style="background:${escapeHtml(product?.tone || '#ebece5')}"><svg viewBox="0 0 100 100" fill="none" stroke="#3d4236" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" role="img" aria-label="${escapeHtml(product?.name || '상품')} 일러스트">${body}</svg></div>`
}
export function artFor(productId) {
    return productArt(findShopProduct(productId))
}

// ---------- 수량 컨트롤 ----------
export function quantityHtml({ value, max = MAX_QUANTITY, label = '수량', disabled = false, id = '' }) {
    return `<div class="quantity-control" data-quantity${id ? ` data-id="${escapeHtml(id)}"` : ''}><button type="button" data-step="-1" aria-label="${escapeHtml(label)} 줄이기" ${disabled || value <= 1 ? 'disabled' : ''}>${icon('minus')}</button><input aria-label="${escapeHtml(label)}" type="number" inputmode="numeric" min="1" max="${max}" value="${value}" ${disabled ? 'disabled' : ''}><button type="button" data-step="1" aria-label="${escapeHtml(label)} 늘리기" ${disabled || value >= max ? 'disabled' : ''}>${icon('plus')}</button></div>`
}
export function bindQuantity(root, max, onChange) {
    const input = root.querySelector('input')
    const clamp = value => Math.max(1, Math.min(max, value))
    root.querySelectorAll('button[data-step]').forEach(button => button.addEventListener('click', () => onChange(clamp(Number(input.value) + Number(button.dataset.step)))))
    input.addEventListener('change', () => {
        const next = Number(input.value)
        onChange(Number.isInteger(next) ? clamp(next) : 1)
    })
}

// ---------- 헤더 / 푸터 ----------
export function renderShell(active = '') {
    const user = currentUser()
    const header = document.getElementById('shop-header')
    const footer = document.getElementById('shop-footer')
    const current = key => active === key ? ' aria-current="page"' : ''
    if (header) {
        header.innerHTML = `
            <a class="skip-link" href="#main-content">본문으로 바로가기</a>
            <div class="announcement">3만원 이상 구매 시 무료배송 · 본인인증 회원 전용 스토어</div>
            <header class="site-header">
                <a href="/shop/products/index.html" class="wordmark" aria-label="${escapeHtml(SHOP_STORE.name)} 홈"><span>objet<i>store</i></span><small>${escapeHtml(SHOP_STORE.name)}</small></a>
                <nav class="main-nav" aria-label="주 메뉴"><a href="/shop/products/index.html#collection"${current('products')}>모든 상품</a><a href="/shop/products/index.html?category=flower#collection">플라워</a><a href="/shop/products/index.html?category=kitchen#collection">키친</a></nav>
                <nav class="utility-nav" aria-label="내 쇼핑">
                    ${user ? `<a href="/shop/account/orders.html"${current('orders')}>주문 내역</a><button type="button" id="shop-logout" title="${escapeHtml(user.email || '')}">${escapeHtml(user.username || '회원')}님 · 로그아웃</button>` : `<a href="${loginPath()}"${current('login')}>로그인</a><a href="/auth/register.html"${current('register')}>회원가입</a>`}
                    <a href="/shop/cart/index.html" class="cart-link"${current('cart')}><svg width="19" height="21" viewBox="0 0 20 22" fill="none" aria-hidden="true"><path d="M3 7h14l1 13H2L3 7Z" stroke="currentColor" stroke-width="1.6"/><path d="M6.5 8V5a3.5 3.5 0 0 1 7 0v3" stroke="currentColor" stroke-width="1.6"/></svg><span>장바구니</span><span id="cart-count-slot"></span></a>
                </nav>
            </header>`
        header.querySelector('#shop-logout')?.addEventListener('click', () => {
            logout()
            window.location.href = '/shop/products/index.html'
        })
        const paintCount = () => {
            const count = cartCount()
            header.querySelector('#cart-count-slot').outerHTML = count > 0
                ? `<span id="cart-count-slot" class="cart-count" aria-label="${count}개 담김">${count > 99 ? '99+' : count}</span>`
                : '<span id="cart-count-slot" class="sr-only">비어 있음</span>'
        }
        paintCount()
        window.addEventListener('shop:cart', paintCount)
        window.addEventListener('storage', paintCount)
    }
    if (footer) {
        footer.innerHTML = `
            <footer class="site-footer">
                <div class="footer-top">
                    <div><p class="eyebrow">OBJECTS FOR EVERYDAY</p><p class="footer-statement">조금 더 좋아지는,<br>매일의 풍경.</p></div>
                    <div class="footer-about"><p>${escapeHtml(SHOP_STORE.description)}</p></div>
                    <div class="footer-contact"><p class="eyebrow">CUSTOMER CENTER</p><a href="tel:${escapeHtml(SHOP_STORE.phone)}">${escapeHtml(SHOP_STORE.phone)}</a><a href="mailto:${escapeHtml(SHOP_STORE.email)}">${escapeHtml(SHOP_STORE.email)}</a><a href="/shop/cart/index.html">장바구니</a></div>
                </div>
                <div class="footer-bottom"><div><strong>${escapeHtml(SHOP_STORE.businessName)}</strong><span>대표자 ${escapeHtml(SHOP_STORE.ceo)}</span><span>사업자등록번호 ${escapeHtml(SHOP_STORE.registrationNumber)}</span><span>통신판매업신고 ${escapeHtml(SHOP_STORE.mailOrderNumber)}</span><span>${escapeHtml(SHOP_STORE.address)}</span><span>전화 ${escapeHtml(SHOP_STORE.phone)}</span><span>팩스 ${escapeHtml(SHOP_STORE.fax)}</span><span>이메일 ${escapeHtml(SHOP_STORE.email)}</span></div><p>© ${new Date().getFullYear()} ${escapeHtml(SHOP_STORE.name)}</p></div>
            </footer>`
    }
}

export function errorHtml(message, retryId = '') {
    return `<div class="error-notice" role="alert"><p>${escapeHtml(message)}</p>${retryId ? `<button class="text-link" type="button" id="${retryId}">다시 시도하기</button>` : ''}</div>`
}
export function loadingHtml(text = '불러오고 있습니다.') {
    return `<div class="loading-state" role="status"><span class="loading-mark" aria-hidden="true"></span>${escapeHtml(text)}</div>`
}

// ---------- 본인인증 ----------
// 다날 휴대폰 본인인증. Bootpay 관리자에서 해당 PG 의 본인인증이 켜져 있어야 창이 열린다.
export const IDENTITY_PG = 'danal'
