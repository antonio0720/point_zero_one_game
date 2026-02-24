/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * PZO_FE_T0148 — P17_TESTING_STORYBOOK_QA: vitest config
 * Fixed: include both __tests__/ (pre-built tests) AND src/components/ (co-located tests
 * from executor — ThreatRadarPanel, BattleHUD, ReplayTimeline, AidContractComposer etc.)
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: [
      // Pre-built test suite (AuthGate, CardHand, ChatPanel, etc.)
      'src/__tests__/**/*.test.tsx',
      'src/__tests__/**/*.test.ts',
      // Co-located component tests (ThreatRadarPanel, BattleHUD, ReplayTimeline, etc.)
      'src/components/**/*.test.tsx',
      'src/components/**/*.test.ts',
      // Engine / hook tests co-located
      'src/engine/**/*.test.ts',
      'src/hooks/**/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.stories.*',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/components/**', 'src/hooks/**', 'src/engine/**'],
      exclude: ['**/*.stories.*', '**/*.bak'],
    },
  },
});
