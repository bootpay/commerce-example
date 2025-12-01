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
                npmIndex: resolve(__dirname, 'npm/index.html'),
                widget: resolve(__dirname, 'npm/widget/widget.html'),
                widgetResult: resolve(__dirname, 'npm/widget/widget_result.html'),
                plan: resolve(__dirname, 'npm/plan/plan.html'),
                planResult: resolve(__dirname, 'npm/plan/plan_result.html'),
                paymentLink: resolve(__dirname, 'npm/payment-link/payment-link.html'),
                paymentLinkResult: resolve(__dirname, 'npm/payment-link/payment-link_result.html'),
                // CDN 버전
                cdnMain: resolve(__dirname, 'cdn/index.html'),
                cdnWidget: resolve(__dirname, 'cdn/widget/widget.html'),
                cdnWidgetResult: resolve(__dirname, 'cdn/widget/widget_result.html'),
                cdnPlan: resolve(__dirname, 'cdn/plan/plan.html'),
                cdnPlanResult: resolve(__dirname, 'cdn/plan/plan_result.html'),
                cdnPaymentLink: resolve(__dirname, 'cdn/payment-link/payment-link.html'),
                cdnPaymentLinkResult: resolve(__dirname, 'cdn/payment-link/payment-link_result.html')
            }
        }
    }
})
