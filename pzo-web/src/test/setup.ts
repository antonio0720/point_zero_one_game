/**
 * PZO_FE_T0149 — P17_TESTING_STORYBOOK_QA: global test setup
 * Manually authored — executor failure recovery
 */
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Silence expected React act() warnings in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('act(')) return;
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});

// Mock socket.io-client globally — no real WS connections in unit tests
vi.mock('socket.io-client', () => ({
  default: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  })),
  io: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  })),
}));

// Mock import.meta.env
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_API_URL: 'http://localhost:3001',
    MODE: 'test',
    DEV: false,
    PROD: false,
  },
  writable: true,
});
