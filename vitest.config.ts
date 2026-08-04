import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: false,
    include: [
      'src/**/*.test.ts',
      'server/src/**/*.test.ts',
      'packages/*/src/**/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@trading-os/shared': path.resolve(__dirname, './packages/shared/src/index.ts'),
      '@trading-os/market-data': path.resolve(__dirname, './packages/market-data/src/index.ts'),
    },
  },
})
