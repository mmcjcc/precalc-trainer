import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: false,
        // Plays Container Apps sign-in; server/dev-mock.mjs allows exactly this account (and makes it a parent).
        headers: { 'X-MS-CLIENT-PRINCIPAL-NAME': 'dev@localhost.test' },
      },
    },
  },
  build: { chunkSizeWarningLimit: 1500 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'server/src/**/*.test.ts'],
    setupFiles: ['./src/test-setup.ts'],
  },
})
