import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Relative base so the production build also works when served from a sub-path.
export default defineConfig({
  base: './',
  plugins: [vue()],
  build: {
    target: 'es2020',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
