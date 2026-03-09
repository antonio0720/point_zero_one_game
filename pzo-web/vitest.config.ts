import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()] as any,
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'test/**/*.{test,spec}.{ts,tsx}',
      'test/unit/**/*.{test,spec}.{ts,tsx}',
    ],
    coverage: {
      reporter: ['text', 'json'],
    },
  },
});