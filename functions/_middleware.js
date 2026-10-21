// 데모 저장소(functions/_shared/demo-store.js)를 KV 에 이어 둔다 — API 요청에만.
//
// Pages 는 요청마다 다른 isolate 로 갈 수 있어 메모리만으로는 회원 · 주문이 사라진다. 그래서
//   1. 요청 앞: KV 키 목록(메타데이터에 버전)을 한 번 읽고, 이 isolate 가 가진 것보다 새 레코드만 가져온다.
//   2. 요청 뒤: 바뀐 레코드만 키 하나씩 저장한다. 저장은 응답 전에 끝낸다 — 주문 직후 결과 화면이 그 주문을 읽어야 한다.
// 레코드를 키 하나씩 두는 것은 두 isolate 가 서로 다른 주문을 동시에 고쳐도 서로를 지우지 않게 하려는 것이다.
// 같은 레코드를 둘이 고치면 저장 직전 버전을 다시 보고, 남이 먼저 고쳤으면 덮지 않고 503 으로 다시 시도하게 한다
// (웹훅은 2xx 가 아니면 부트페이가 다시 보낸다). 저장이 실패해도 503 — 못 올린 변경은 다음 요청이 다시 올린다.
// SHOP_STORE 바인딩이 없으면 아무것도 안 한다 (메모리만). @date: 2026-10-21

import { getRecord, putRecord, recordVersion, records } from './_shared/demo-store.js'

const PREFIXES = ['user:', 'order:', 'verify:']

// 키마다 이 isolate 가 KV 와 마지막으로 맞춘 값 { json, version }. 메모리 값이 이것과 다르면 아직 안 올린 변경이다
const synced = globalThis.__BOOTPAY_COMMERCE_DEMO_SYNCED__ ||= new Map()

const jsonOf = row => JSON.stringify(row)
const isDirty = key => synced.get(key)?.json !== jsonOf(getRecord(key))

async function remoteVersions(kv) {
    const versions = new Map()
    for (const prefix of PREFIXES) {
        let cursor
        do {
            const page = await kv.list({ prefix, cursor })
            for (const key of page.keys) versions.set(key.name, String(key.metadata?.v || ''))
            cursor = page.list_complete ? undefined : page.cursor
        } while (cursor)
    }
    return versions
}

// KV 키 목록은 최대 1분 늦다 — 막 만든 주문은 목록에 없어 결과 화면이 404 를 냈다(2026-10-21 실측 40초 넘게).
// 그래서 요청이 가리키는 주문 · 회원은 목록과 따로 키로 직접 읽는다. 키 하나 읽기는 쓴 곳에서 바로 보인다
function keysOfRequest(url) {
    const keys = []
    const orderId = url.pathname.match(/^\/api\/shop\/orders\/([^/]+)$/)?.[1]
    if (orderId) keys.push(`order:${decodeURIComponent(orderId)}`)
    const userId = url.searchParams.get('user_id')
    if (userId) keys.push(`user:${userId}`)
    return keys
}

async function hydrate(kv, url) {
    const versions = await remoteVersions(kv)
    await Promise.all(keysOfRequest(url).filter(key => !versions.has(key)).map(async key => {
        const { metadata } = await kv.getWithMetadata(key)
        if (metadata) versions.set(key, String(metadata.v || ''))
    }))
    await Promise.all(Array.from(versions, async ([key, version]) => {
        if (synced.get(key)?.version === version) return
        const row = await kv.get(key, 'json')
        if (!row) return
        const local = getRecord(key)
        // 이 isolate 가 아직 못 올린 더 새 변경이 있으면 그것을 둔다 — 요청 뒤에 올라간다
        if (local && isDirty(key) && recordVersion(local) > recordVersion(row)) return
        putRecord(key, row)
        synced.set(key, { json: jsonOf(row), version })
    }))
    // 다른 isolate 가 지운 키(쓴 본인인증 토큰) — 여기서 손대지 않았으면 같이 지운다.
    // 목록이 늦어 방금 쓴 키가 빠져 있을 수 있으니 키를 직접 읽어 정말 없을 때만 지운다
    await Promise.all(Array.from(synced.keys()).filter(key => !versions.has(key) && !isDirty(key)).map(async key => {
        const { metadata } = await kv.getWithMetadata(key)
        if (metadata) return
        putRecord(key, null)
        synced.delete(key)
    }))
}

// 바뀐 레코드만 올린다. 남이 먼저 고친 레코드는 덮지 않고 그 값을 받아 온 뒤 겹친 키를 돌려준다
async function persist(kv) {
    const current = records()
    const conflicts = []
    for (const [key, row] of Object.entries(current)) {
        const json = jsonOf(row)
        if (synced.get(key)?.json === json) continue
        const base = synced.get(key)?.version ?? ''
        const { value, metadata } = await kv.getWithMetadata(key, 'json')
        const remote = String(metadata?.v || '')
        // 같은 값이 이미 올라가 있으면(두 isolate 가 같은 계정을 미리 넣은 경우 등) 맞춘 것으로 친다
        if (value && jsonOf(value) === json) {
            synced.set(key, { json, version: remote })
            continue
        }
        if (value && remote !== base && remote >= recordVersion(row)) {
            putRecord(key, value)
            synced.set(key, { json: jsonOf(value), version: remote })
            conflicts.push(key)
            continue
        }
        const version = recordVersion(row)
        await kv.put(key, json, { metadata: { v: version } })
        synced.set(key, { json, version })
    }
    for (const key of Array.from(synced.keys())) {
        if (!(key in current)) {
            await kv.delete(key)
            synced.delete(key)
        }
    }
    return conflicts
}

const unavailable = message => new Response(JSON.stringify({ success: false, code: 'STORE_UNAVAILABLE', message }), {
    status: 503,
    headers: { 'Content-Type': 'application/json', 'Retry-After': '1' }
})

export async function onRequest(context) {
    const kv = context.env.SHOP_STORE
    const url = new URL(context.request.url)
    if (!kv || !url.pathname.startsWith('/api/')) return context.next()

    try {
        await hydrate(kv, url)
    } catch (error) {
        console.error('[demo-store] KV 읽기 실패', error)
        return unavailable('주문 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }
    const response = await context.next()
    try {
        const conflicts = await persist(kv)
        if (conflicts.length) {
            console.warn('[demo-store] 다른 요청과 겹쳐 저장하지 않음', conflicts)
            return unavailable('다른 요청과 겹쳐 저장하지 못했습니다. 다시 시도해 주세요.')
        }
    } catch (error) {
        console.error('[demo-store] KV 저장 실패', error)
        return unavailable('주문 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }
    return response
}
