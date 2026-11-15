import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// GitHub Actions builds under the repository sub-path; local builds stay relative.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/orbital-express/' : './',
  plugins: [vue()],
  build: {
    target: 'es2020',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
