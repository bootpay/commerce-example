// 쇼핑몰 데모 카탈로그 — 브라우저, server.js, Cloudflare Functions 가 같은 파일을 쓴다.
// 화면은 이 데이터로 그리고, 결제 금액은 서버가 quoteCart() 로 다시 계산한다.
// DOM/Node API 를 쓰지 않는 순수 모듈로 유지한다.

export const SHOP_STORE = {
    name: '오브제 스토어',
    description: '꽃 한 송이, 손에 익은 그릇, 제자리를 찾은 작은 물건. 일상을 채우는 취향을 모았습니다.',
    // 판매자 사업자 정보 (전자상거래법 표시 사항)
    businessName: '(주)부트페이',
    ceo: '윤태섭',
    registrationNumber: '618-87-00495',
    mailOrderNumber: '제 2022-서울구로-1854',
    address: '[08389] 서울특별시 구로구 디지털로26길 61 에이스하이엔드타워2차 1202호',
    phone: '1599-4062',
    fax: '02-6008-9760',
    email: 'pg@bootpay.co.kr'
}

export const SHOP_DELIVERY = {
    baseFee: 3000,
    freeThreshold: 30000,
    days: 2
}

export const SHOP_CATEGORIES = [
    { id: 'flower', name: '플라워' },
    { id: 'kitchen', name: '키친' },
    { id: 'living', name: '리빙' },
    { id: 'fragrance', name: '향' }
]

// shape/tone 은 상품 이미지 대신 그리는 일러스트 키다 (shop/shop.js productArt).
// stock: null 은 재고 무제한, 0 은 품절.
export const SHOP_PRODUCTS = [
    {
        id: 'stone_vase',
        name: '스톤 화병 S',
        categoryId: 'flower',
        price: 18000,
        originalPrice: 22000,
        shape: 'vase',
        tone: '#d9d2c3',
        createdAt: '2026-10-01',
        description: '거친 질감을 살린 작은 화병. 한두 송이만 꽂아도 공간이 정돈됩니다.',
        detail: ['높이 14cm · 입구 지름 3cm', '유약을 바르지 않은 무광 마감으로 손자국이 남지 않습니다.', '물을 담아 사용해도 새지 않도록 내부만 방수 처리했습니다.'],
        stock: null,
        options: [
            { id: 'ivory', name: '아이보리', price: 0, stock: null },
            { id: 'charcoal', name: '차콜', price: 0, stock: 4 },
            { id: 'olive', name: '올리브', price: 2000, stock: 0 }
        ]
    },
    {
        id: 'dried_bouquet',
        name: '드라이 플라워 부케',
        categoryId: 'flower',
        price: 12900,
        originalPrice: 12900,
        shape: 'bouquet',
        tone: '#e6d5c3',
        createdAt: '2026-09-28',
        description: '물 없이 오래 두고 보는 계절 부케. 받는 날의 색이 천천히 바래 갑니다.',
        detail: ['계절에 따라 꽃 구성이 달라집니다.', '직사광선과 습기를 피하면 6개월 이상 유지됩니다.'],
        stock: null,
        options: [
            { id: 'small', name: 'S (손바닥 크기)', price: 0, stock: null },
            { id: 'medium', name: 'M (화병용)', price: 5000, stock: null }
        ]
    },
    {
        id: 'ceramic_mug',
        name: '핸드메이드 세라믹 머그',
        categoryId: 'kitchen',
        price: 9800,
        originalPrice: 9800,
        shape: 'mug',
        tone: '#cfd6c4',
        createdAt: '2026-09-25',
        description: '손으로 빚어 하나씩 모양이 다른 머그. 아침 커피 한 잔에 알맞은 300ml.',
        detail: ['용량 300ml', '식기세척기 사용 가능, 전자레인지 사용 가능', '수작업 특성상 색과 형태가 조금씩 다릅니다.'],
        stock: null,
        options: [
            { id: 'sage', name: '세이지', price: 0, stock: null },
            { id: 'sand', name: '샌드', price: 0, stock: null },
            { id: 'ink', name: '잉크', price: 1000, stock: 2 }
        ]
    },
    {
        id: 'linen_towel',
        name: '리넨 키친 타월 2P',
        categoryId: 'kitchen',
        price: 7500,
        originalPrice: 8500,
        shape: 'towel',
        tone: '#e8e2d6',
        createdAt: '2026-09-20',
        description: '빨수록 부드러워지는 리넨 100% 타월. 그릇을 닦고 빵을 덮어 두기에 좋습니다.',
        detail: ['45 × 65cm, 2장 1세트', '첫 세탁 시 3% 내외 수축이 있습니다.'],
        stock: null,
        options: []
    },
    {
        id: 'oak_tray',
        name: '오크 서빙 트레이',
        categoryId: 'kitchen',
        price: 24000,
        originalPrice: 24000,
        shape: 'tray',
        tone: '#d8c4a8',
        createdAt: '2026-09-18',
        description: '단단한 오크 원목을 깎아 만든 트레이. 찻잔 두 개와 디저트 한 접시가 넉넉히 올라갑니다.',
        detail: ['38 × 24cm', '오일 마감 — 물기는 바로 닦아 주세요.'],
        stock: 3,
        options: []
    },
    {
        id: 'rattan_basket',
        name: '라탄 수납 바구니',
        categoryId: 'living',
        price: 15900,
        originalPrice: 15900,
        shape: 'basket',
        tone: '#dccdb0',
        createdAt: '2026-09-15',
        description: '흩어진 작은 물건을 한곳에. 손잡이가 있어 옮기기 쉬운 라탄 바구니.',
        detail: ['천연 라탄을 손으로 엮었습니다.', 'S 지름 20cm · L 지름 30cm'],
        stock: null,
        options: [
            { id: 's', name: 'S', price: 0, stock: null },
            { id: 'l', name: 'L', price: 6000, stock: null }
        ]
    },
    {
        id: 'mood_lamp',
        name: '무드 테이블 램프',
        categoryId: 'living',
        price: 29000,
        originalPrice: 34000,
        shape: 'lamp',
        tone: '#e9dfc9',
        createdAt: '2026-09-10',
        description: '밤의 거실을 낮게 밝히는 테이블 램프. 3단계 밝기 조절을 지원합니다.',
        detail: ['높이 32cm, USB-C 전원', '전구색(2700K) LED 내장'],
        stock: null,
        options: []
    },
    {
        id: 'soy_candle',
        name: '소이 캔들 200g',
        categoryId: 'fragrance',
        price: 11000,
        originalPrice: 11000,
        shape: 'candle',
        tone: '#e4d9cf',
        createdAt: '2026-09-05',
        description: '천연 소이 왁스와 면 심지로 만든 캔들. 약 40시간 동안 은은하게 탑니다.',
        detail: ['연소 시간 약 40시간', '처음 켤 때는 표면 전체가 녹을 때까지 태워 주세요.'],
        stock: null,
        options: [
            { id: 'fig', name: '무화과 잎', price: 0, stock: null },
            { id: 'cedar', name: '시더우드', price: 0, stock: null },
            { id: 'linen', name: '코튼 리넨', price: 0, stock: 0 }
        ]
    },
    {
        id: 'room_spray',
        name: '룸 스프레이 100ml',
        categoryId: 'fragrance',
        price: 8900,
        originalPrice: 8900,
        shape: 'bottle',
        tone: '#d5d9d0',
        createdAt: '2026-09-01',
        description: '커튼과 침구에 가볍게 뿌리는 룸 스프레이. 다음 입고를 준비하고 있습니다.',
        detail: ['용량 100ml', '패브릭에 뿌릴 때는 30cm 이상 거리를 두세요.'],
        stock: 0,
        options: []
    }
]

// 장바구니 쿠폰 — 상품 금액(배송비 제외)에만 적용한다.
export const SHOP_COUPONS = {
    WELCOME10: { name: '첫 구매 10% 할인', type: 'percent', value: 10 },
    SAVE5000: { name: '5,000원 할인', type: 'fixed', value: 5000, minSubtotal: 20000 }
}

export const MAX_CART_LINES = 30
export const MAX_QUANTITY = 99

export function findShopProduct(productId) {
    return SHOP_PRODUCTS.find(product => product.id === productId) || null
}

export function categoryName(categoryId) {
    return SHOP_CATEGORIES.find(category => category.id === categoryId)?.name || ''
}

export function requiresOption(product) {
    return product.options.length > 0
}

export function isAvailable(product) {
    if (product.stock === 0) return false
    if (!requiresOption(product)) return true
    return product.options.some(option => option.stock !== 0)
}

export function listShopProducts({ keyword = '', categoryId = '', sort = 'newest' } = {}) {
    const term = String(keyword).trim().toLowerCase()
    const items = SHOP_PRODUCTS.filter(product => {
        if (categoryId && product.categoryId !== categoryId) return false
        if (!term) return true
        return `${product.name} ${product.description}`.toLowerCase().includes(term)
    })
    const sorters = {
        newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
        price_asc: (a, b) => a.price - b.price,
        price_desc: (a, b) => b.price - a.price
    }
    return items.sort(sorters[sort] || sorters.newest)
}

export function deliveryFeeFor(subtotal) {
    if (subtotal <= 0) return 0
    return subtotal >= SHOP_DELIVERY.freeThreshold ? 0 : SHOP_DELIVERY.baseFee
}

// 한 줄의 구매 가능 여부. 문제가 없으면 '' 를 돌려준다.
export function lineProblem(product, option, quantity, optionId) {
    if (!product) return '지금 판매하지 않는 상품이에요. 삭제해 주세요.'
    if (!isAvailable(product)) return '품절된 상품이에요. 삭제해 주세요.'
    if (requiresOption(product) && !option) {
        return optionId ? '선택했던 옵션이 더 이상 없어요. 다시 담아 주세요.' : '옵션을 선택해야 하는 상품이에요. 다시 담아 주세요.'
    }
    if (!requiresOption(product) && optionId) return '선택했던 옵션이 더 이상 없어요. 다시 담아 주세요.'
    if (option && option.stock === 0) return '선택한 옵션이 품절되었어요.'
    const stock = option ? option.stock : product.stock
    if (stock !== null && stock < quantity) return `남은 수량이 ${stock}개예요. 수량을 줄여 주세요.`
    return ''
}

// 서버 금액 계산의 단일 진입점. 클라이언트가 보낸 가격은 받지 않는다.
// items: [{ productId, optionId?, quantity }]
export function quoteCart(rawItems, { couponCode = '' } = {}) {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return { ok: false, code: 'EMPTY_CART', message: '주문할 상품이 없습니다.' }
    }
    if (rawItems.length > MAX_CART_LINES) {
        return { ok: false, code: 'TOO_MANY_LINES', message: `한 번에 ${MAX_CART_LINES}종까지 주문할 수 있습니다.` }
    }

    const seen = new Set()
    const lines = []
    for (const raw of rawItems) {
        const productId = String(raw?.productId || '')
        const optionId = raw?.optionId ? String(raw.optionId) : ''
        const quantity = Number(raw?.quantity)
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
            return { ok: false, code: 'INVALID_QUANTITY', message: `수량은 1~${MAX_QUANTITY}개 사이여야 합니다.` }
        }
        const key = `${productId}:${optionId}`
        if (seen.has(key)) return { ok: false, code: 'DUPLICATE_LINE', message: '같은 상품·옵션이 중복되었습니다.' }
        seen.add(key)

        const product = findShopProduct(productId)
        const option = product?.options.find(item => item.id === optionId) || null
        const unitPrice = product ? product.price + (option?.price || 0) : 0
        lines.push({
            productId,
            optionId: optionId || null,
            name: product?.name || '판매 종료 상품',
            optionName: option?.name || '',
            unitPrice,
            quantity,
            subtotal: unitPrice * quantity,
            problem: lineProblem(product, option, quantity, optionId)
        })
    }

    const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0)
    const coupon = couponCode ? SHOP_COUPONS[couponCode] : null
    let discount = 0
    let couponError = ''
    if (couponCode && !coupon) couponError = '사용할 수 없는 쿠폰입니다.'
    else if (coupon && coupon.minSubtotal && subtotal < coupon.minSubtotal) {
        couponError = `${coupon.minSubtotal.toLocaleString()}원 이상 구매 시 사용할 수 있습니다.`
    } else if (coupon) {
        discount = coupon.type === 'percent' ? Math.floor(subtotal * coupon.value / 100) : Math.min(coupon.value, subtotal)
    }

    const deliveryFee = deliveryFeeFor(subtotal)
    const canCheckout = lines.every(line => !line.problem) && !couponError
    const first = lines[0]
    const orderName = lines.length > 1 ? `${first.name} 외 ${lines.length - 1}건` : first.name

    return {
        ok: true,
        lines,
        subtotal,
        discount,
        couponCode: coupon && !couponError ? couponCode : '',
        couponError,
        deliveryFee,
        total: subtotal - discount + deliveryFee,
        canCheckout,
        orderName
    }
}
