import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
    server: {
        port: 5173
    },
    build: {
        rollupOptions: {
            input: {
                // NPM 버전
                main: resolve(__dirname, 'index.html'),
                authRegister: resolve(__dirname, 'auth/register.html'),
                authLogin: resolve(__dirname, 'auth/login.html'),
                adminIndex: resolve(__dirname, 'admin/index.html'),
                adminUsers: resolve(__dirname, 'admin/users/index.html'),
                adminPayments: resolve(__dirname, 'admin/payments/index.html'),
                adminAlimtalk: resolve(__dirname, 'admin/alimtalk/index.html'),
                shopProducts: resolve(__dirname, 'shop/products/index.html'),
                shopProductDetail: resolve(__dirname, 'shop/products/detail.html'),
                shopOrderNew: resolve(__dirname, 'shop/orders/new.html'),
                shopOrderComplete: resolve(__dirname, 'shop/orders/complete.html'),
                shopCart: resolve(__dirname, 'shop/cart/index.html'),
                shopAccountOrders: resolve(__dirname, 'shop/account/orders.html'),
                npmIndex: resolve(__dirname, 'npm/index.html'),
                widget: resolve(__dirname, 'npm/widget/widget.html'),
                widgetResult: resolve(__dirname, 'npm/widget/widget_result.html'),
                plan: resolve(__dirname, 'npm/plan/plan.html'),
                planResult: resolve(__dirname, 'npm/plan/plan_result.html'),
                paymentLink: resolve(__dirname, 'npm/payment-link/payment-link.html'),
                paymentLinkResult: resolve(__dirname, 'npm/payment-link/payment-link_result.html'),
                brandpay: resolve(__dirname, 'npm/brandpay/brandpay.html'),
                brandpayResult: resolve(__dirname, 'npm/brandpay/brandpay_result.html'),
                integrated: resolve(__dirname, 'npm/integrated/integrated.html'),
                integratedResult: resolve(__dirname, 'npm/integrated/integrated_result.html'),
                subscription: resolve(__dirname, 'npm/subscription/subscription.html'),
                subscriptionResult: resolve(__dirname, 'npm/subscription/subscription_result.html'),
                // CDN 버전
                cdnMain: resolve(__dirname, 'cdn/index.html'),
                cdnWidget: resolve(__dirname, 'cdn/widget/widget.html'),
                cdnWidgetResult: resolve(__dirname, 'cdn/widget/widget_result.html'),
                cdnPlan: resolve(__dirname, 'cdn/plan/plan.html'),
                cdnPlanResult: resolve(__dirname, 'cdn/plan/plan_result.html'),
                cdnPaymentLink: resolve(__dirname, 'cdn/payment-link/payment-link.html'),
                cdnPaymentLinkResult: resolve(__dirname, 'cdn/payment-link/payment-link_result.html'),
                cdnBrandpay: resolve(__dirname, 'cdn/brandpay/brandpay.html'),
                cdnBrandpayResult: resolve(__dirname, 'cdn/brandpay/brandpay_result.html'),
                cdnWalletManager: resolve(__dirname, 'cdn/brandpay/wallet-manager.html'),
                cdnIntegrated: resolve(__dirname, 'cdn/integrated/integrated.html'),
                cdnIntegratedResult: resolve(__dirname, 'cdn/integrated/integrated_result.html'),
                cdnSubscription: resolve(__dirname, 'cdn/subscription/subscription.html'),
                cdnSubscriptionResult: resolve(__dirname, 'cdn/subscription/subscription_result.html')
            }
        }
    }
})
