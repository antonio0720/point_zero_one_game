/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/EngineContracts.ts
 *
 * Doctrine:
 * - backend is the authoritative simulation surface
 * - engines remain sovereign, step-scoped, and immutable at the boundary
 * - time ownership is delegated to Engine 1 during STEP_02_TIME
 * - all cross-engine coordination flows through the EventBus + TickContext
 * - runtime helpers here must stay deterministic and side-effect free
 */

import type { ClockSource } from './ClockSource';
import type { EventBus } from './EventBus';
import type { EngineEventMap, ModeCode } from './GamePrimitives';
import type { RunStateSnapshot } from './RunStateSnapshot';
import type { TickStep } from './TickSequence';

export type EngineId =
  | 'time'
  | 'pressure'
  | 'tension'
  | 'shield'
  | 'battle'
  | 'cascade'
  | 'sovereignty';

export type EngineHealthStatus = 'HEALTHY' | 'DEGRADED' | 'FAILED';
export type EngineSignalSeverity = 'INFO' | 'WARN' | 'ERROR';

export interface EngineSignal {
  readonly engineId: EngineId | 'mode';
  readonly severity: EngineSignalSeverity;
  readonly code: string;
  readonly message: string;
  readonly tick: number;
  readonly tags?: readonly string[];
}

export interface TickTrace {
  readonly runId: string;
  readonly tick: number;
  readonly step: TickStep;
  readonly mode: ModeCode;
  readonly phase: RunStateSnapshot['phase'];
  readonly traceId: string;
}

export interface TickContext {
  readonly step: TickStep;
  readonly nowMs: number;
  readonly clock: ClockSource;
  readonly bus: EventBus<EngineEventMap & Record<string, unknown>>;
  readonly trace: TickTrace;
}

export interface EngineHealth {
  readonly engineId: EngineId;
  readonly status: EngineHealthStatus;
  readonly updatedAt: number;
  readonly notes?: readonly string[];
}

export interface EngineTickResult {
  readonly snapshot: RunStateSnapshot;
  readonly signals?: readonly EngineSignal[];
}

export interface ModeLifecycleHooks {
  readonly mode: ModeCode;

  /**
   * Mode-specific bootstrap mutations before the first tick is run.
   * Used for:
   * - solo loadouts / handicaps / disabled bots
   * - pvp shared-deck setup
   * - coop treasury / role assignment / trust scaffolding
   * - ghost marker hydration / legend gap state
   */
  initialize(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): RunStateSnapshot;

  /**
   * Optional pre-step hook. Lets a mode mutate runtime state before an engine step.
   * Example: open PHZ windows at phase boundaries before card legality is checked.
   */
  beforeStep?(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): RunStateSnapshot;

  /**
   * Optional post-step hook. Lets a mode react after a specific engine step.
   * Example: PvP extraction cooldown trimming after battle step.
   */
  afterStep?(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): RunStateSnapshot;

  /**
   * End-of-tick reconciliation for mode-native rules.
   * Example: solo isolation tax, coop trust updates, ghost divergence gap drift.
   */
  finalizeTick?(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): RunStateSnapshot;
}

export interface SimulationEngine {
  readonly engineId: EngineId;

  /**
   * Clears volatile runtime state for replay, test harnesses, or hot reset.
   */
  reset(): void;

  /**
   * Lightweight gate for engines that should skip work for a particular
   * step, mode, or terminal outcome.
   */
  canRun?(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): boolean;

  /**
   * Executes one engine slice for one step.
   * The engine must treat the snapshot as immutable input and return
   * a fresh snapshot or a normalized EngineTickResult payload.
   */
  tick(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): RunStateSnapshot | EngineTickResult;

  /**
   * Returns health visible to orchestration / diagnostics surfaces.
   */
  getHealth(): EngineHealth;
}

export function createEngineHealth(
  engineId: EngineId,
  status: EngineHealthStatus,
  updatedAt: number,
  notes: readonly string[] = [],
): EngineHealth {
  return {
    engineId,
    status,
    updatedAt,
    notes,
  };
}

export function createEngineSignal(
  engineId: EngineId | 'mode',
  severity: EngineSignalSeverity,
  code: string,
  message: string,
  tick: number,
  tags: readonly string[] = [],
): EngineSignal {
  return {
    engineId,
    severity,
    code,
    message,
    tick,
    tags,
  };
}

function isEngineTickResult(
  value: RunStateSnapshot | EngineTickResult,
): value is EngineTickResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'snapshot' in value &&
    typeof (value as EngineTickResult).snapshot === 'object'
  );
}

export function normalizeEngineTickResult(
  engineId: EngineId,
  tick: number,
  result: RunStateSnapshot | EngineTickResult,
): EngineTickResult {
  if (isEngineTickResult(result)) {
    return {
      snapshot: result.snapshot,
      signals:
        result.signals && result.signals.length > 0
          ? result.signals
          : [
              createEngineSignal(
                engineId,
                'INFO',
                'ENGINE_TICK_OK',
                `${engineId} tick completed`,
                tick,
              ),
            ],
    };
  }

  return {
    snapshot: result,
    signals: [
      createEngineSignal(
        engineId,
        'INFO',
        'ENGINE_TICK_OK',
        `${engineId} tick completed`,
        tick,
      ),
    ],
  };
}