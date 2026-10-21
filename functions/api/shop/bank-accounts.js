// GET /api/shop/bank-accounts — 주문서의 무통장 입금 은행 고르기
// 판매자가 부트페이에 등록한 계좌 목록을 은행 이름과 끝 네 자리로만 내려준다 (로그인 없이 열린다).

import { bankAccountsFor, publicBankAccounts } from '../../_shared/bank-deposit.js'
import { commerceConfigForHost } from '../../_shared/shop-order.js'

const headers = { 'Content-Type': 'application/json' }

export async function onRequestGet(context) {
    const config   = commerceConfigForHost(new URL(context.request.url).hostname, context.env)
    try {
        const accounts = await bankAccountsFor(config, context.env)
        return new Response(JSON.stringify({ success: true, accounts: publicBankAccounts(accounts) }), { headers })
    } catch (error) {
        return new Response(JSON.stringify({ success: false, code: error.code, message: error.message }), { status: error.status || 424, headers })
    }
}
