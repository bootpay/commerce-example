---
status: active  # 본인인증 실결제 경로는 Bootpay 관리자 PG 설정 대기
created: 2026-10-12
updated: 2026-10-12
iteration: 1
---

## Why
기존 쇼핑몰 데모(상품 3개·단일 상품 주문서)를 storefront-next 수준의 쇼핑 흐름으로 올리고, 회원가입을 본인인증 기반으로 바꿔 실제 서비스에 가까운 가입·구매 경험을 보여준다.

## What
- [validated] storefront-next 디자인(웜 페이퍼·차콜·올리브, 플랫 보더)과 정보구조로 shop 화면을 재구성한다: 카탈로그(카테고리·검색·정렬) → 상세(옵션·수량·배송 안내) → 장바구니 → 주문서 → 결제 완료 → 주문 내역.
- [validated] 상품·옵션·배송비 카탈로그는 한 파일(`shop/catalog.js`)을 브라우저·express·CF Functions 가 같이 쓰고, 금액은 서버가 다시 계산한다.
- [validated] 장바구니는 브라우저 localStorage 에 productId/optionId/quantity 만 저장하고, 가격·배송비는 서버 견적 API 로 받는다.
- [validated] 주문은 회원 전용이다. 비로그인 사용자는 로그인/회원가입으로 보내고 돌아오면 구매 의도를 보존한다.
- [validated] 회원가입은 Bootpay 본인인증(`requestAuthentication`)을 먼저 통과해야 하고, 서버가 `receipt_id` 로 인증 결과를 조회해 이름·휴대폰을 확정한다. 같은 사람(CI/unique) 중복 가입을 막는다.
- [validated] 관리자 회원 목록에 본인인증 여부·인증일을 표시한다.

## Not
- Commerce V1 API(실상품·호스팅 주문서) 연동은 하지 않는다 — 이 저장소는 메모리 데모 + PG 결제창 예제다.
- 영구 DB, 실서비스 세션/암호화는 기존 의도(demo-service-admin)와 같이 범위 밖.

## Context
- 참고: `multi-manager/projects/storefront-next` (Next.js, Commerce V1 BFF), `~/sideProjects/rovel.ai` (본인인증 가입).
- 서버는 express(`server.js`)와 CF Pages Functions 두 벌이고 `npm run dev` 는 Functions 경로다. 두 벌을 같이 맞춘다.

## Footprint
- `shop/catalog.js` 공유 카탈로그·견적(quoteCart), `shop/shop.js`·`shop/shop.css` 공용 셸/스타일.
- 화면: products(index·detail) · cart · orders(new·complete) · account/orders · auth(register·login) 재작성.
- 서버: `functions/_shared/identity.js`(certificate 조회·검증·CI 해시·일회용 토큰), `functions/_shared/shop-order.js`(주문 생성·영수증 검증), Functions `api/auth/identity`, `api/shop/{quote,orders,orders/[order_id]}`, `api/orders` items 분기, `api/orders/verify` SHOP_ 주문 실검증. server.js 동일 엔드포인트.
- `npm run dev` 를 `scripts/pages-dev.mjs` 로 교체(호환일 고정 + .env.development PG 키 바인딩).
- 미검증: 실제 본인인증 완료 → 가입 → 결제 성공 경로. dev 앱(toRyMm…)에 본인인증 PG(KCP/다날)가 꺼져 있어 창이 거절됨.
