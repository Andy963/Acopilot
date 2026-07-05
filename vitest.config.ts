import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'frontend/src'),
      'pinia': resolve(__dirname, 'frontend/node_modules/pinia/index.js'),
      'vue': resolve(__dirname, 'frontend/node_modules/vue/index.js'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/frontend/**'],
  },
});

