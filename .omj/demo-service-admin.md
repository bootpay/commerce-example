---
status: done
created: 2026-07-01
updated: 2026-07-01
iteration: 1
---

## Why
데모 서비스를 결제 예제 모음이 아니라 회원 가입, 관리자, 결제내역 관리까지 보여줄 수 있는 서비스 형태로 만든다.

## What
- [validated] 회원가입/로그인 개념을 메모리 저장소 기반 API와 화면으로 제공한다.
- [validated] 관리자는 메모리 저장소의 회원 목록을 조회하고 상태를 변경할 수 있다.
- [validated] 관리자는 메모리 저장소의 결제/주문 내역을 조회하고 결제 취소를 요청할 수 있다.
- [validated] 기존 결제 예제의 주문 생성/검증 흐름은 관리자 결제내역에 남도록 연결한다.
- [validated] 쇼핑몰 데모 진입은 회원가입이 아니라 상품리스트에서 시작하고, 상품상세를 거쳐 주문서로 이동한다.
- [validated] 주문서의 CTA는 주문 생성이 아니라 `결제하기`이며 Bootpay 결제창을 호출한다.

## Not
- 영구 DB, 실서비스 인증/인가, 비밀번호 암호화, 세션 쿠키까지 구현하지 않는다.
- 기존 결제 SDK 연동 방식을 대규모로 재작성하지 않는다.

## Context
- 데모 저장소는 서버 프로세스/Cloudflare Functions isolate 메모리에만 유지한다.
- 기본 관리자 계정은 데모용으로 seed 한다.
- 관리자 UI는 route-first 원칙에 따라 회원 목록과 결제내역 목록을 별도 페이지로 둔다.

## Footprint
- Added memory-backed demo auth/admin API in `server.js` and Cloudflare Functions under `functions/api/auth`, `functions/api/admin`, and `functions/_shared/demo-store.js`.
- Connected order creation/verification to the in-memory order store so admin payment history can list demo orders.
- Added routed UI pages: `/auth/register.html`, `/auth/login.html`, `/admin/users/index.html`, `/admin/payments/index.html`.
- Linked logged-in demo users from payment examples via `localStorage.bootpay_demo_user`.
- Added service demo entry point on `/` and Vite build inputs for the new routes.
- Added shopping mall route flow: `/shop/products/index.html` → `/shop/products/detail.html` → `/shop/orders/new.html`.
- Changed the root service demo card to enter the product list instead of registration.
- Expanded demo products accepted by `/api/orders` so the new order page creates pending orders visible in admin payments.
- Updated `/shop/orders/new.html` to call `Bootpay.requestPayment()` and redirect to `/shop/orders/complete.html` after payment.
- Replaced internal/demo wording in shop-facing pages with customer-facing ecommerce copy.
- Added `/shop/orders/complete.html` and Vite input for payment completion.
