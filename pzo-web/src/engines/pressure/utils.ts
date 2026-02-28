/**
 * FILE: pzo-web/src/engines/pressure/utils.ts
 * Test utilities for the Pressure Engine. Not imported by production code.
 */
import { vi } from 'vitest';
import type { IEventBus } from './types';

/** Create a mock EventBus with a spy on emit(). Used in all Pressure Engine tests. */
export function createMockEventBus(): IEventBus & { emit: ReturnType<typeof vi.fn> } {
  return { emit: vi.fn() };
}
