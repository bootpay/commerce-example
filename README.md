# Bootpay Commerce Example

부트페이(Bootpay) 결제 및 커머스 SDK 사용 예제 프로젝트입니다.

## 부트페이란?

[부트페이](https://bootpay.co.kr)는 온라인 결제 서비스를 쉽게 연동할 수 있게 해주는 결제 대행 서비스(PG 연동 서비스)입니다. 카드결제, 계좌이체, 휴대폰 결제, 간편결제(카카오페이, 네이버페이 등) 등 다양한 결제 수단을 하나의 API로 연동할 수 있습니다.

### 주요 특징
- **간편한 연동**: 몇 줄의 코드로 결제 기능 구현
- **다양한 결제 수단**: 신용카드, 계좌이체, 간편결제 등 통합 지원
- **구독 결제**: SaaS 서비스를 위한 정기결제/구독 기능
- **테스트 환경**: 실제 결제 없이 개발 및 테스트 가능

## 프로젝트 구조

```
bootpay-commerce-example/
├── cdn/                          # CDN 방식 예제
│   └── bootShop.example.html     # BootpayStore 렌더링 예제
│
├── npm/                          # NPM 패키지 방식 예제
│   ├── index.html                # 메인 랜딩 페이지
│   ├── package.json              # 의존성 정의
│   ├── vite.config.js            # Vite 설정
│   └── src/
│       ├── widget.html           # 결제 위젯 예제 (주문서)
│       ├── widget.js             # 결제 위젯 로직
│       ├── plan.html             # 주문연동 예제 (SaaS 플랜 선택)
│       ├── plan.js               # 주문연동 로직
│       └── result.html           # 결제 결과 페이지
│
└── README.md
```

## 예제 설명

### 1. CDN 방식 - BootpayStore

`cdn/bootShop.example.html`

스크립트 태그로 부트페이 SDK를 불러와서 바로 사용하는 방식입니다.

```html
<script src="https://js.bootpay.co.kr/bootpay-store-5.1.4.min.js"></script>
<script src="https://js.bootpay.co.kr/bootpay-5.1.4.min.js"></script>

<script>
  window.BootpayStore.render('#bootpay-shop', {
    client_key: "YOUR_CLIENT_KEY",
    hooks: {
      onReady: () => {
        console.log('렌더링 완료');
      }
    }
  });
</script>
```

### 2. NPM 방식 - 결제 위젯

`npm/src/widget.html` + `npm/src/widget.js`

NPM 패키지를 사용한 결제 위젯 예제입니다. 실제 쇼핑몰의 주문서 페이지처럼 구현되어 있습니다.

**주요 기능:**
- 결제 위젯 렌더링 (`BootpayWidget.render()`)
- 금액 변경 시 위젯 업데이트 (`widget.update()`)
- 결제 요청 (`Bootpay.requestPayment()`)
- 적립금/쿠폰 할인 적용

```javascript
import Bootpay, { BootpayWidget } from '@bootpay/client-js'

// 위젯 렌더링
const widget = BootpayWidget.render('#payment-widget-area', {
  application_id: 'YOUR_APP_ID',
  price: 4000,
  sandbox: true,  // 테스트 모드
  hooks: {
    ready: () => console.log('위젯 준비 완료'),
    allTermsAccepted: () => console.log('약관 동의 완료')
  }
})

// 결제 요청
const result = await Bootpay.requestPayment({
  application_id: 'YOUR_APP_ID',
  order_id: 'ORDER_123',
  order_name: '프리미엄 무선 이어폰',
  price: 4000,
  user: {
    username: '홍길동',
    phone: '01012345678'
  }
})
```

### 3. NPM 방식 - 주문연동 (구독 결제)

`npm/src/plan.html` + `npm/src/plan.js`

SaaS 서비스의 요금제 선택 및 구독 결제 예제입니다.

**주요 기능:**
- 월간/연간 결제 주기 선택
- 플랜별 상품 ID 관리
- 청구서 요청 (`BootpayCommerce.requestInvoice()`)

```javascript
import { BootpayCommerce } from '@bootpay/bp-commerce-sdk'

// 환경 설정
BootpayCommerce.setEnvironmentMode('development')

// 청구서 요청
BootpayCommerce.requestInvoice({
  client_key: 'YOUR_CLIENT_KEY',
  name: 'Pro 플랜 구독',
  price: 29900,
  user: {
    user_id: 'user_123',
    name: '홍길동',
    email: 'user@example.com'
  },
  products: [{
    product_id: 'PRODUCT_ID',
    duration: -1,  // 무기한 구독
    quantity: 1
  }],
  redirect_url: 'https://yoursite.com/result'
})
```

## 시작하기

### NPM 방식 실행

```bash
# 의존성 설치
cd npm
yarn install  # 또는 npm install

# 개발 서버 실행
yarn dev  # 또는 npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속합니다.

### CDN 방식 실행

`cdn/bootShop.example.html` 파일을 브라우저에서 직접 열거나, 로컬 웹서버로 서빙합니다.

```bash
# Python 간이 서버 예시
cd cdn
python -m http.server 8080
```

## 사용된 패키지

| 패키지 | 설명 |
|--------|------|
| `@bootpay/client-js` | 클라이언트 결제 SDK (결제 위젯, 결제 요청) |
| `@bootpay/bp-commerce-sdk` | 커머스 SDK (청구서, 구독 결제) |
| `@bootpay/backend-js` | 백엔드 SDK (결제 검증, 취소 등) |

## 개발자 설정

각 예제 페이지 우측 하단에 **개발자 설정** 패널이 있습니다:

- **Environment**: `development`(테스트), `stage`, `production`(실서비스) 선택
- **Application ID / Client Key**: 부트페이 대시보드에서 발급받은 키 입력

> 테스트 시에는 `development` 환경을 사용하세요. 실제 결제가 이루어지지 않습니다.

## 테스트 쿠폰 코드

결제 위젯 예제에서 사용 가능한 테스트 쿠폰:

| 코드 | 할인 |
|------|------|
| `WELCOME10` | 첫 구매 10% 할인 |
| `SAVE5000` | 5,000원 할인 |
| `SUMMER20` | 여름 특가 20% 할인 |

## 참고 자료

- [부트페이 공식 문서](https://docs.bootpay.co.kr)
- [부트페이 GitHub](https://github.com/bootpay)
- [부트페이 대시보드](https://dashboard.bootpay.co.kr)

## 라이선스

MIT License
