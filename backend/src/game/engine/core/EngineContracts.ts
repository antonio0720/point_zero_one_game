/*
 * POINT ZERO ONE — BACKEND ENGINE 15X GENERATOR
 * Generated at: 2026-03-10T01:00:08.825776+00:00
 *
 * Doctrine:
 * - backend becomes the authoritative simulation surface
 * - seven engines remain distinct
 * - mode-native rules are enforced at runtime
 * - cards are backend-validated, not UI-trusted
 * - proof / integrity / CORD remain backend-owned
 */

import type { EngineEventMap } from './GamePrimitives';
import type { RunStateSnapshot } from './RunStateSnapshot';
import type { ClockSource } from './ClockSource';
import type { TickStep } from './TickSequence';
import type { EventBus } from './EventBus';

export type EngineId = 'time' | 'pressure' | 'tension' | 'shield' | 'battle' | 'cascade' | 'sovereignty';

export interface TickContext {
  step: TickStep;
  nowMs: number;
  clock: ClockSource;
  bus: EventBus<EngineEventMap>;
}

export interface EngineHealth {
  engineId: EngineId;
  status: 'HEALTHY' | 'DEGRADED' | 'FAILED';
  updatedAt: number;
  notes?: string[];
}

export interface SimulationEngine {
  readonly engineId: EngineId;
  reset(): void;
  tick(snapshot: RunStateSnapshot, context: TickContext): RunStateSnapshot;
  getHealth(): EngineHealth;
}
