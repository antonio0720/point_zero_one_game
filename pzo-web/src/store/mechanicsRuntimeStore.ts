// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — MECHANICS RUNTIME STORE
// pzo-web/src/store/mechanicsRuntimeStore.ts
//
// Zustand store for per-mechanic runtime state tracking.
// Owned by MechanicsRouter — populated via recordActivation() after each
// mechanic fires at Step 12.5 of the Orchestrator tick.
//
// CONSUMERS:
//   ✦ MechanicsRouter — writes via recordActivation(), recordTick()
//   ✦ MechanicsBridge — reads confidence for ML mechanic weighting
//   ✦ MechanicsBridgeDevPanel (Phase 6) — reads all state for debug UI
//   ✦ useEngineStore hook — reads mechanic heat/confidence for game UI
//
// DOES NOT:
//   ✦ Import or read from engine classes directly
//   ✦ Subscribe to EventBus (MechanicsRouter handles that)
//   ✦ Persist across runs (reset() called on every orchestrator.reset())
//
// Density6 LLC · Point Zero One · Mechanics Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import type {
  MechanicActivationRecord,
  MechanicExecResult,
  MechanicRuntimeState,
  MechanicOutputs,
} from '../engines/mechanics/types';
import type { MechanicRecord, MechanicLayer } from '../data/mechanicsLoader';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum activation history entries retained (ring-buffer). */
const MAX_HISTORY_ENTRIES = 500;

/** Heat gain per mechanic activation (added to runtimeHeat). */
const HEAT_GAIN_PER_ACTIVATION = 10;

/** Heat decay per tick (applied to all mechanics each tick). */
const HEAT_DECAY_PER_TICK = 1;

/** Confidence gain per successful (fired=true) activation. */
const CONFIDENCE_GAIN_PER_SUCCESS = 0.04;

/** Confidence loss per missed (fired=false) activation check. */
const CONFIDENCE_DECAY_PER_MISS = 0.01;

/** Confidence clamp range. */
const CONFIDENCE_MIN = 0.0;
const CONFIDENCE_MAX = 1.0;

// ─────────────────────────────────────────────────────────────────────────────
// STORE STATE SHAPE
// ─────────────────────────────────────────────────────────────────────────────

export interface MechanicsRuntimeStoreState {
  // ── Per-mechanic runtime states keyed by mechanic_id ───────────────────────
  mechanics: Record<string, MechanicRuntimeState>;

  // ── Global activation history (ring-buffer, max 500 entries) ───────────────
  activationHistory: MechanicActivationRecord[];

  // ── Run-level counters ──────────────────────────────────────────────────────
  totalActivations: number;
  totalFires: number;
  totalErrors: number;
  ticksProcessed: number;

  // ── Last tick summary ───────────────────────────────────────────────────────
  lastTickIndex: number;
  lastTickMechanicsFired: number;
  lastTickExecutionMs: number;

  // ── Actions ─────────────────────────────────────────────────────────────────

  /**
   * Register a mechanic's metadata before the run starts.
   * Called by MechanicsRouter.init() for each mechanic in the active registry.
   * Idempotent — safe to call multiple times.
   */
  registerMechanic: (record: MechanicRecord) => void;

  /**
   * Record a mechanic exec result after a Step 12.5 fire.
   * Updates per-mechanic runtime state, appends history, updates counters.
   *
   * @param result - The MechanicExecResult from MechanicsRouter
   * @param tickIndex - Current tick index from the Orchestrator snapshot
   */
  recordActivation: (result: MechanicExecResult, tickIndex: number) => void;

  /**
   * Apply per-tick heat decay to all registered mechanics.
   * Called once per tick by MechanicsRouter.tickRuntime() AFTER recordActivation.
   */
  recordTick: (tickIndex: number, mechanicsFired: number, totalMs: number) => void;

  /**
   * Read a single mechanic's runtime state.
   * Returns undefined if mechanicId is not registered.
   */
  getMechanicState: (mechanicId: string) => MechanicRuntimeState | undefined;

  /**
   * Returns the top-N mechanics by runtimeHeat, descending.
   * Used by DevPanel to show most active mechanics.
   */
  getTopByHeat: (n: number) => MechanicRuntimeState[];

  /**
   * Returns the top-N mechanics by activationCount, descending.
   */
  getTopByActivations: (n: number) => MechanicRuntimeState[];

  /**
   * Returns the confidence value for a mechanic (0–1).
   * Used by ML mechanics to weight their own signal.
   * Returns 0.5 (neutral) if mechanic is not registered.
   */
  getConfidence: (mechanicId: string) => number;

  /**
   * Reset all state to initial values.
   * Called by orchestrator.reset() before a new run.
   */
  reset: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function buildInitialMechanicState(record: MechanicRecord): MechanicRuntimeState {
  return {
    mechanicId:          record.mechanic_id,
    layer:               record.layer,
    activationCount:     0,
    firedCount:          0,
    lastActivationTick:  null,
    totalExecutionMs:    0,
    averageExecutionMs:  0,
    lastOutputs:         null,
    errorCount:          0,
    lastError:           null,
    runtimeHeat:         0,
    confidence:          0.5, // start neutral
  };
}

function clampConfidence(v: number): number {
  return v < CONFIDENCE_MIN ? CONFIDENCE_MIN : v > CONFIDENCE_MAX ? CONFIDENCE_MAX : v;
}

function clampHeat(v: number): number {
  return v < 0 ? 0 : v > 100 ? 100 : v;
}

const EMPTY_OUTPUTS: MechanicOutputs = Object.freeze({});

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  mechanics:                {} as Record<string, MechanicRuntimeState>,
  activationHistory:        [] as MechanicActivationRecord[],
  totalActivations:         0,
  totalFires:               0,
  totalErrors:              0,
  ticksProcessed:           0,
  lastTickIndex:            -1,
  lastTickMechanicsFired:   0,
  lastTickExecutionMs:      0,
};

export const mechanicsRuntimeStore = create<MechanicsRuntimeStoreState>((set, get) => ({
  ...INITIAL_STATE,

  // ── registerMechanic ───────────────────────────────────────────────────────
  registerMechanic(record: MechanicRecord): void {
    set((state) => {
      if (state.mechanics[record.mechanic_id]) return state; // idempotent
      return {
        mechanics: {
          ...state.mechanics,
          [record.mechanic_id]: buildInitialMechanicState(record),
        },
      };
    });
  },

  // ── recordActivation ──────────────────────────────────────────────────────
  recordActivation(result: MechanicExecResult, tickIndex: number): void {
    set((state) => {
      const existing = state.mechanics[result.mechanicId];

      // Build updated mechanic state
      const newActivationCount = (existing?.activationCount ?? 0) + 1;
      const newFiredCount      = (existing?.firedCount ?? 0) + (result.fired ? 1 : 0);
      const newErrorCount      = (existing?.errorCount ?? 0) + (result.errorMessage ? 1 : 0);
      const newTotalMs         = (existing?.totalExecutionMs ?? 0) + result.executionMs;
      const newAvgMs           = newTotalMs / newActivationCount;
      const newHeat            = clampHeat((existing?.runtimeHeat ?? 0) + (result.fired ? HEAT_GAIN_PER_ACTIVATION : 0));
      const newConfidence      = clampConfidence(
        (existing?.confidence ?? 0.5) +
        (result.fired ? CONFIDENCE_GAIN_PER_SUCCESS : -CONFIDENCE_DECAY_PER_MISS),
      );

      const updatedState: MechanicRuntimeState = {
        mechanicId:         result.mechanicId,
        layer:              existing?.layer ?? 'tick_engine',
        activationCount:    newActivationCount,
        firedCount:         newFiredCount,
        lastActivationTick: tickIndex,
        totalExecutionMs:   newTotalMs,
        averageExecutionMs: newAvgMs,
        lastOutputs:        result.fired ? result.outputs : (existing?.lastOutputs ?? null),
        errorCount:         newErrorCount,
        lastError:          result.errorMessage ?? existing?.lastError ?? null,
        runtimeHeat:        newHeat,
        confidence:         newConfidence,
      };

      // Build history entry
      const historyEntry: MechanicActivationRecord = {
        mechanicId:  result.mechanicId,
        execHook:    result.execHook,
        tickIndex,
        fired:       result.fired,
        outputs:     result.fired ? result.outputs : EMPTY_OUTPUTS,
        executionMs: result.executionMs,
        timestamp:   Date.now(),
      };

      // Ring-buffer the history
      const history = state.activationHistory.length >= MAX_HISTORY_ENTRIES
        ? [...state.activationHistory.slice(1), historyEntry]
        : [...state.activationHistory, historyEntry];

      return {
        mechanics: {
          ...state.mechanics,
          [result.mechanicId]: updatedState,
        },
        activationHistory: history,
        totalActivations:  state.totalActivations + 1,
        totalFires:        state.totalFires + (result.fired ? 1 : 0),
        totalErrors:       state.totalErrors + (result.errorMessage ? 1 : 0),
      };
    });
  },

  // ── recordTick ────────────────────────────────────────────────────────────
  recordTick(tickIndex: number, mechanicsFired: number, totalMs: number): void {
    set((state) => {
      // Apply heat decay to all mechanics
      const decayed: Record<string, MechanicRuntimeState> = {};
      for (const [id, ms] of Object.entries(state.mechanics)) {
        decayed[id] = {
          ...ms,
          runtimeHeat: clampHeat(ms.runtimeHeat - HEAT_DECAY_PER_TICK),
        };
      }

      return {
        mechanics:              decayed,
        ticksProcessed:         state.ticksProcessed + 1,
        lastTickIndex:          tickIndex,
        lastTickMechanicsFired: mechanicsFired,
        lastTickExecutionMs:    totalMs,
      };
    });
  },

  // ── getMechanicState ──────────────────────────────────────────────────────
  getMechanicState(mechanicId: string): MechanicRuntimeState | undefined {
    return get().mechanics[mechanicId];
  },

  // ── getTopByHeat ──────────────────────────────────────────────────────────
  getTopByHeat(n: number): MechanicRuntimeState[] {
    return Object.values(get().mechanics)
      .sort((a, b) => b.runtimeHeat - a.runtimeHeat)
      .slice(0, n);
  },

  // ── getTopByActivations ───────────────────────────────────────────────────
  getTopByActivations(n: number): MechanicRuntimeState[] {
    return Object.values(get().mechanics)
      .sort((a, b) => b.activationCount - a.activationCount)
      .slice(0, n);
  },

  // ── getConfidence ─────────────────────────────────────────────────────────
  getConfidence(mechanicId: string): number {
    return get().mechanics[mechanicId]?.confidence ?? 0.5;
  },

  // ── reset ─────────────────────────────────────────────────────────────────
  reset(): void {
    set(() => ({ ...INITIAL_STATE, mechanics: {}, activationHistory: [] }));
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// CONVENIENCE SELECTORS (non-hook, callable outside React)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Non-hook read of a mechanic's confidence.
 * MechanicsBridge calls this to weight ML mechanic signal.
 */
export function getConfidenceSync(mechanicId: string): number {
  return mechanicsRuntimeStore.getState().getConfidence(mechanicId);
}

/**
 * Non-hook snapshot of all runtime states.
 * Used by DevPanel serialization.
 */
export function getAllMechanicStates(): MechanicRuntimeState[] {
  return Object.values(mechanicsRuntimeStore.getState().mechanics);
}