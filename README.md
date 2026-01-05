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

### CDN 버전 (스크립트 태그)
| 예제 | URL |
|------|-----|
| Widget (결제 위젯) | http://localhost:8788/cdn/widget/widget.html |
| Plan (구독 결제) | http://localhost:8788/cdn/plan/plan.html |
| Payment Link (결제링크) | http://localhost:8788/cdn/payment-link/payment-link.html |

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
