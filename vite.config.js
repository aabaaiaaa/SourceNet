import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_SHA__: JSON.stringify(process.env.GITHUB_SHA || 'dev'),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    watch: {
      ignored: [
        '**/playwright-report/**',
        '**/test-results/**',
        '**/e2e/**',
        '**/node_modules/**',
      ],
    },
  },
})
