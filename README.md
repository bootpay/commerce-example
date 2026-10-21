# Bootpay Commerce Example

부트페이(Bootpay) 결제 및 커머스 SDK 사용 예제 프로젝트입니다.

## 키 발급 방법

부트페이 대시보드에서 API 키를 발급받는 방법입니다.

[![키 발급 방법](https://github.com/bootpay/commerce-example/raw/main/키발급.gif)](https://github.com/bootpay/commerce-example/raw/main/키발급.mp4)

> 💡 [부트페이 대시보드](https://dashboard.bootpay.co.kr)에서 회원가입 후 프로젝트를 생성하면 API 키를 발급받을 수 있습니다.

## 빠른 시작

```bash
npm install
npm run dev
```

브라우저에서 **http://localhost:8788** 로 접속합니다.

## 예제 URL

### NPM 버전 (ES6 모듈)
| 예제 | URL |
|------|-----|
| 메인 페이지 | http://localhost:8788/ |
| Widget (결제 위젯) | http://localhost:8788/npm/widget/widget.html |
| Plan (구독 결제) | http://localhost:8788/npm/plan/plan.html |
| Payment Link (결제링크) | http://localhost:8788/npm/payment-link/payment-link.html |
| Subscription (자동결제/빌링키) | http://localhost:8788/npm/subscription/subscription.html |

### CDN 버전 (스크립트 태그)
| 예제 | URL |
|------|-----|
| Widget (결제 위젯) | http://localhost:8788/cdn/widget/widget.html |
| Plan (구독 결제) | http://localhost:8788/cdn/plan/plan.html |
| Payment Link (결제링크) | http://localhost:8788/cdn/payment-link/payment-link.html |
| Subscription (자동결제/빌링키) | http://localhost:8788/cdn/subscription/subscription.html |

## 프로젝트 구조

```
bootpay-commerce-example/
├── index.html                # 메인 페이지 (NPM/CDN 선택)
├── package.json
├── vite.config.js
├── npm/                      # NPM 버전 예제 (ES6 모듈)
│   ├── widget/
│   │   ├── widget.html
│   │   ├── widget.js
│   │   └── widget_result.html
│   ├── plan/
│   │   ├── plan.html
│   │   ├── plan.js
│   │   └── plan_result.html
│   └── payment-link/
│       ├── payment-link.html
│       ├── payment-link.js
│       └── payment-link_result.html
│
├── cdn/                      # CDN 버전 예제 (스크립트 태그)
│   ├── widget/
│   │   ├── widget.html
│   │   └── widget_result.html
│   ├── plan/
│   │   ├── plan.html
│   │   └── plan_result.html
│   └── payment-link/
│       ├── payment-link.html
│       └── payment-link_result.html
│
└── functions/                # Cloudflare Pages Functions (API)
    └── api/
        ├── orders.js
        ├── orders/
        │   ├── plan.js
        │   ├── verify.js
        │   └── payment-link.js
        ├── order/
        │   └── [order_number].js
        └── payment/
            └── receipt/
                └── [receipt_id].js
```

## NPM vs CDN 방식 비교

### NPM 방식
```javascript
// ES6 모듈 import
import { BootpayCommerce } from '@bootpay/bp-commerce-sdk'
import Bootpay, { BootpayWidget } from '@bootpay/client-js'
```

### CDN 방식
```html
<!-- 결제 위젯용 (BootpayWidget) -->
<script src="https://js.bootpay.co.kr/bootpay-widget-5.2.4.min.js"></script>
<script>
  // window.BootpayWidget 전역 객체로 사용
  BootpayWidget.render('#widget-area', { ... })
</script>

<!-- 커머스 SDK용 (BootpayCommerce) -->
<script src="https://js.bootpay.co.kr/commerce/bp-commerce-sdk-1.0.2.min.js"></script>
<script>
  // window.BootpayCommerce 전역 객체로 사용
  BootpayCommerce.requestCheckout({ ... })
</script>
```

## SDK CDN 주소

| SDK | CDN URL | 전역 객체 |
|-----|---------|-----------|
| Client SDK (결제 위젯) | `https://js.bootpay.co.kr/bootpay-widget-5.2.4.min.js` | `BootpayWidget` |
| Commerce SDK (구독/청구서) | `https://js.bootpay.co.kr/commerce/bp-commerce-sdk-1.0.2.min.js` | `BootpayCommerce` |

## 사용된 NPM 패키지

| 패키지 | 설명 |
|--------|------|
| `@bootpay/client-js` | 클라이언트 결제 SDK (결제 위젯, 결제 요청) |
| `@bootpay/bp-commerce-sdk` | 커머스 SDK (청구서, 구독 결제) |
| `@bootpay/backend-js` | 백엔드 SDK (결제 검증, 취소 등) |

## 개발 서버

개발 서버는 Vite + Wrangler를 함께 사용합니다:
- **Vite** (포트 5173): 프론트엔드 빌드/HMR
- **Wrangler** (포트 8788): Cloudflare Functions API 프록시

> **중요**: 반드시 **http://localhost:8788** 로 접속해야 API가 작동합니다.

### 데모 계정

회원·주문은 서버 메모리에 든다. Cloudflare Pages 배포는 KV 바인딩 `SHOP_STORE` 가 있으면 거기에 이어 둔다(`functions/_middleware.js`) —
없으면 요청이 다른 isolate 로 갈 때 로그인 · 주문이 사라진다. 로컬 `npm run dev` 는 로컬 KV(`.wrangler/state`)를 쓴다.

| 계정 | 아이디 / 비밀번호 | 비고 |
|---|---|---|
| 관리자 | `admin@demo.local` / `admin1234` | 항상 있다. 본인인증을 안 해서 주문은 못 한다 |
| 데모 회원 | `.env.local` 의 `DEMO_MEMBER_EMAIL` / `DEMO_MEMBER_PASSWORD` (예: `demo@demo.local` / `demo1234`) | 본인인증을 마친 회원으로 만든다. 로그인 화면에 자동으로 채워지고, 주문서의 주문자·배송지도 이 회원 값(`DEMO_MEMBER_NAME` · `_PHONE` · `_ZIPCODE` · `_ADDRESS1` · `_ADDRESS2`)으로 채워진다 |

- 쇼핑몰 주문은 본인인증을 마친 회원만 할 수 있다. 실제 본인인증 없이 주문까지 시험하려면 데모 회원을 쓴다.
- 데모 회원은 `DEMO_MEMBER_*` 를 넣었을 때만 생긴다. **공개 배포에는 넣지 않는다** — 누구나 본인인증 없이 주문할 수 있게 된다.
- `DEMO_MEMBER_NAME` 이 무통장 입금자명 기본값이다. 뱅크알람은 은행 입금 알림의 이름과 이 이름을 비교하므로 실제로 입금할 사람 이름을 넣는다.

### 무통장 입금 (뱅크알람)

주문서에서 「무통장 입금」을 고르면 부트페이 Commerce API(`POST /v1/sdk/deposits`)로 입금대기 주문을 등록하고,
판매자 폰의 뱅크알람이 입금을 확인하면 주문이 결제 완료로 바뀐다. 필요한 값은 `.env.example` 의 무통장 입금 절을 본다
(`BOOTPAY_COMMERCE_CLIENT_KEY` · `BOOTPAY_COMMERCE_SECRET_KEY` · `BOOTPAY_COMMERCE_API_BASE` · `SHOP_BANK_*`).

- Commerce 키에 `supervisor:order_deposit_create` · `_detail` API Scope 가 DB 에 있어야 한다 (없으면 `401 API_ROLE_NOT_SUPPORT`).
- 웹훅 주소는 `https://<쇼핑몰 도메인>/api/shop/bank-deposit/webhook` 이다. 부트페이 관리자 개발자 설정 › 웹훅 › 뱅크알람에 넣고,
  거기서 받은 서명 키를 `SHOP_WEBHOOK_SECRET` 에 둔다. 웹훅 본문은 믿지 않고 입금 상태를 다시 조회해 반영한다.
- localhost 에는 웹훅이 못 오므로 주문 결과 · 주문 내역 화면이 입금을 기다리는 동안 다시 조회해 상태를 맞춘다.
- 부트페이에는 입금대기 취소가 없다. 쇼핑몰에서 주문을 취소해도 부트페이 쪽 입금대기는 그대로이고, 늦게 붙은 입금은 무시된다.

## 부트페이 키 설정

### CDN 예제 설정

CDN 버전 예제를 사용하려면 `cdn/config.js` 파일에 부트페이 키를 설정해야 합니다.

```bash
# 1. config 템플릿 복사
cp cdn/config.example.js cdn/config.js

# 2. cdn/config.js 파일을 열어 부트페이 키 입력
```

`cdn/config.js` 파일에서 아래 값들을 본인의 키로 변경하세요:

```javascript
window.BOOTPAY_CONFIG = {
    widget: {
        development: {
            application_id: 'YOUR_DEV_APPLICATION_ID'  // 부트페이 Application ID
        },
        // ...
    },
    plan: {
        development: {
            client_key: 'YOUR_DEV_CLIENT_KEY',  // 부트페이 Client Key
            // ...
        },
        // ...
    },
    // ...
}
```

> 키는 [부트페이 대시보드](https://admin.bootpay.co.kr) > 프로젝트 > 설정 > 앱정보에서 확인할 수 있습니다.

### 환경 변수 (.env)

NPM 버전이나 서버 측 설정은 `.env` 파일을 사용합니다.

```bash
# .env.example을 참고하여 .env 파일 생성
cp .env.example .env.development
```

## 환경 전환

각 예제 페이지 우측 하단에 **환경 설정** 패널이 있습니다:
- **development**: 테스트 환경 (실제 결제 없음)
- **stage**: 스테이지 환경
- **production**: 실서비스 환경
 

## 라이선스

MIT License
