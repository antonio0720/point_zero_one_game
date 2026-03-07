/**
 * event-bus.ts — Re-export shim
 * PZOEventType and PressureEventInterface are defined in ./types.ts.
 * This file exists because EventBus.ts imports from './event-bus'.
 */
export type { PZOEventType } from './types';

// PressureEventInterface is used as a generic constraint.
// Broadened to object in EventBus.ts v3, so we export a compatible type.
export interface PressureEventInterface {
  [key: string]: unknown;
}
