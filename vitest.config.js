import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // The React plugin gives component test files the automatic JSX runtime
  // (so they don't need an explicit `import React`).
  plugins: [react()],
  test: {
    // jsdom for component tests; pure-logic tests run fine under it too.
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
  },
});
