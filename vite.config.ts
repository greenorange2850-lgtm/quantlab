import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
    resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@trading-os/shared': path.resolve(__dirname, './packages/shared/src/index.ts'),
      '@trading-os/market-data': path.resolve(__dirname, './packages/market-data/src/index.ts'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
