import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
    server: {
        port: 5173
    },
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                widget: resolve(__dirname, 'src/widget/widget.html'),
                widgetResult: resolve(__dirname, 'src/widget/widget_result.html'),
                plan: resolve(__dirname, 'src/plan/plan.html'),
                planResult: resolve(__dirname, 'src/plan/plan_result.html')
            }
        }
    }
})
