// Demo-only in-memory store.
// Cloudflare Pages Functions may recycle isolates; data is intentionally non-persistent.

import { createVerificationStore } from './identity.js'

const store = globalThis.__BOOTPAY_COMMERCE_DEMO_STORE__ || {
    users: new Map(),
    orders: new Map(),
    verifications: new Map()
}
store.verifications ||= new Map()

globalThis.__BOOTPAY_COMMERCE_DEMO_STORE__ = store

export const verificationStore = createVerificationStore(store.verifications)

const ADMIN_EMAIL = 'admin@demo.local'
const ADMIN_PASSWORD = 'admin1234'

function nowIso() {
    return new Date().toISOString()
}

function makeId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase()
}

function publicUser(user) {
    if (!user) return null
    const { password, ci_hash, ...safeUser } = user
    return safeUser
}

function seedAdmin() {
    const exists = Array.from(store.users.values()).some(user => user.email === ADMIN_EMAIL)
    if (exists) return

    const admin = {
        id: 'ADMIN_DEMO',
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        username: '데모 관리자',
        phone: '01000000000',
        role: 'admin',
        status: 'active',
        identity_verified: false,
        created_at: nowIso(),
        updated_at: nowIso()
    }
    store.users.set(admin.id, admin)
}

seedAdmin()

export function findUserByCiHash(ciHash) {
    return Array.from(store.users.values()).find(user => user.ci_hash && user.ci_hash === ciHash) || null
}

// identity: 본인인증 결과({ name, phone, birth, gender, authenticated_at }) + ciHash.
// 있으면 이름·휴대폰은 인증 값으로 확정한다.
export function createUser({ email, password, username, phone, role = 'member', identity = null, ciHash = '' }) {
    const normalizedEmail = normalizeEmail(email)
    if (!normalizedEmail) throw new Error('이메일을 입력해 주세요.')
    if (!password || String(password).length < 8) throw new Error('비밀번호는 8자 이상이어야 합니다.')
    if (Array.from(store.users.values()).some(user => user.email === normalizedEmail)) {
        const error = new Error('이미 가입된 이메일입니다.')
        error.code = 'DUPLICATE_EMAIL'
        throw error
    }
    if (ciHash && findUserByCiHash(ciHash)) {
        const error = new Error('이미 본인인증으로 가입한 회원입니다.')
        error.code = 'IDENTITY_ALREADY_LINKED'
        throw error
    }

    const user = {
        id: makeId('USER'),
        email: normalizedEmail,
        password,
        username: String(identity?.name || username || normalizedEmail.split('@')[0]).trim(),
        phone: String(identity?.phone || phone || '').trim(),
        role,
        status: 'active',
        identity_verified: Boolean(identity),
        identity_verified_at: identity?.authenticated_at || null,
        birth: identity?.birth || null,
        gender: identity?.gender || null,
        ci_hash: ciHash || null,
        created_at: nowIso(),
        updated_at: nowIso()
    }
    store.users.set(user.id, user)
    return publicUser(user)
}

export function authenticateUser(email, password) {
    const normalizedEmail = normalizeEmail(email)
    const user = Array.from(store.users.values()).find(item => item.email === normalizedEmail)
    if (!user || user.password !== password) return null
    if (user.status !== 'active') {
        const error = new Error('비활성화된 회원입니다.')
        error.code = 'INACTIVE_USER'
        throw error
    }
    return publicUser(user)
}

export function listUsers() {
    return Array.from(store.users.values())
        .map(publicUser)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getUser(userId) {
    return publicUser(store.users.get(userId))
}

export function getRawUser(userId) {
    return store.users.get(userId)
}

export function updateUserStatus(userId, status) {
    if (!['active', 'suspended'].includes(status)) {
        const error = new Error('지원하지 않는 회원 상태입니다.')
        error.code = 'INVALID_STATUS'
        throw error
    }
    const user = store.users.get(userId)
    if (!user) return null
    user.status = status
    user.updated_at = nowIso()
    store.users.set(userId, user)
    return publicUser(user)
}

export function requireAdmin(request) {
    const url = new URL(request.url)
    const adminId = request.headers.get('X-Demo-Admin-Id') || url.searchParams.get('admin_id')
    const admin = store.users.get(adminId)
    if (!admin || admin.role !== 'admin' || admin.status !== 'active') {
        const error = new Error('관리자 권한이 필요합니다.')
        error.status = 403
        throw error
    }
    return publicUser(admin)
}

export function saveOrder(order) {
    const existing = store.orders.get(order.order_id) || {}
    const next = {
        ...existing,
        ...order,
        updated_at: nowIso()
    }
    store.orders.set(next.order_id, next)
    return next
}

export function getOrder(orderId) {
    return store.orders.get(orderId) || null
}

export function listOrders() {
    return Array.from(store.orders.values())
        .map(order => ({
            ...order,
            user: order.user_id ? getUser(order.user_id) : null
        }))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
}

export function listOrdersForUser(userId) {
    return Array.from(store.orders.values())
        .filter(order => userId && order.user_id === userId)
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
}

export function cancelOrder(orderId, { reason, cancel_price, cancelled_by, mode = 'memory' }) {
    const order = store.orders.get(orderId)
    if (!order) return null
    if (order.status === 'cancelled') return order

    const price = Number(cancel_price || order.total_price || order.price || 0)
    const next = {
        ...order,
        status: 'cancelled',
        cancelled_price: price,
        cancel_reason: reason || '관리자 취소',
        cancelled_by,
        cancelled_at: nowIso(),
        cancel_result_mode: mode,
        updated_at: nowIso()
    }
    store.orders.set(orderId, next)
    return next
}

export function getDemoCredentials() {
    return { admin_email: ADMIN_EMAIL, admin_password: ADMIN_PASSWORD }
}
