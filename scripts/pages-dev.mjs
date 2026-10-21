// wrangler pages dev 래퍼 — .env.development(+ .env.local 덮어쓰기)의 Bootpay PG 키를 Functions 바인딩으로 넘긴다.
// (wrangler 4.97 의 pages dev 는 --env-file 값을 바인딩으로 넣지 않는다.)
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

// .env.local 은 gitignore 대상이다 (bootpay-mcp 로 발급한 프로젝트 키 등). 뒤에 읽은 파일이 이긴다.
const ENV_FILES = ['.env.development', '.env.local']
const KEYS = ['BOOTPAY_CLIENT_KEY', 'BOOTPAY_SECRET_KEY', 'BOOTPAY_MODE', 'BOOTPAY_SECRET_KEY_DEVELOPMENT', 'BOOTPAY_SECRET_KEY_STAGE', 'BOOTPAY_SECRET_KEY_PRODUCTION',
    // 무통장 입금(뱅크알람) — Commerce 키 · 판매자 계좌 · 웹훅을 받을 공개 주소
    'BOOTPAY_COMMERCE_CLIENT_KEY', 'BOOTPAY_COMMERCE_SECRET_KEY', 'BOOTPAY_COMMERCE_API_BASE', 'SHOP_BANK_NAME', 'SHOP_BANK_ACCOUNT', 'SHOP_BANK_HOLDER', 'SHOP_PUBLIC_URL', 'SHOP_WEBHOOK_SECRET',
    // 본인인증을 건너뛴 데모 회원 (로컬 시험용)
    'DEMO_MEMBER_EMAIL', 'DEMO_MEMBER_PASSWORD', 'DEMO_MEMBER_NAME', 'DEMO_MEMBER_PHONE',
    'DEMO_MEMBER_ZIPCODE', 'DEMO_MEMBER_ADDRESS1', 'DEMO_MEMBER_ADDRESS2']

const fileEnv = Object.assign({}, ...ENV_FILES.filter(existsSync).map(file => parseEnv(readFileSync(file, 'utf8'))))
const bindings = KEYS.filter(key => fileEnv[key]).flatMap(key => ['--binding', `${key}=${fileEnv[key]}`])
if (!fileEnv.BOOTPAY_CLIENT_KEY || !fileEnv.BOOTPAY_SECRET_KEY) console.warn(`[pages-dev] ${ENV_FILES.join(' / ')} 에 BOOTPAY_CLIENT_KEY / BOOTPAY_SECRET_KEY 가 없어 본인인증·결제 확인 API 가 동작하지 않습니다.`)
console.log(`[pages-dev] Bootpay 모드: ${fileEnv.BOOTPAY_MODE || 'development (로컬 기본값)'}`)

// SHOP_STORE — 데모 회원 · 주문을 담는 KV (functions/_middleware.js). 로컬은 .wrangler/state 에 남아 dev 서버를 다시 띄워도 주문이 그대로다
const child = spawn('wrangler', ['pages', 'dev', '--port', '8788', '--proxy', '5173', '--compatibility-date=2026-06-01', '--kv', 'SHOP_STORE', ...bindings], { stdio: 'inherit', shell: process.platform === 'win32' })
child.on('exit', code => process.exit(code ?? 0))
