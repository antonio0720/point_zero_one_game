// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — MECHANICS LAYER TYPES
// pzo-web/src/engines/mechanics/types.ts
//
// Shared contract types for the mechanics integration layer.
// Used by: MechanicsRouter, MechanicsBridge, mechanicsRuntimeStore,
//          EngineOrchestrator (Step 12.5), mechanicsLoader.
//
// IMPORT RULES:
//   ✦ Only import from zero/types (EngineId, ShieldLayerId) and the
//     mechanicsLoader (MechanicRecord, MechanicLayer).
//   ✦ RunStateSnapshot is imported by callers — not held here to avoid
//     circular dependencies with zero/.
//
// Density6 LLC · Point Zero One · Mechanics Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import type { ShieldLayerId } from '../zero/types';
import type { MechanicRecord, MechanicLayer } from '../../data/mechanicsLoader';

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTION CONTEXT
// Passed into every mechanic exec function. All fields are read-only
// inside the mechanic — mutations go through MechanicOutputs.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subset of RunStateSnapshot fields exposed to mechanic exec functions.
 * Keeps mechanics decoupled from the full snapshot shape.
 */
export interface MechanicSnapshotView {
  // Tick
  tickIndex: number;
  ticksRemaining: number;
  seasonTickBudget: number;
  // Financial
  netWorth: number;
  cashBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  cashflow: number;
  // Pressure
  pressureScore: number;
  pressureTier: string;
  ticksWithoutIncomeGrowth: number;
  // Tension
  tensionScore: number;
  anticipationQueueDepth: number;
  // Shield
  shieldAvgIntegrityPct: number;
  shieldL1Integrity: number;
  shieldL2Integrity: number;
  shieldL3Integrity: number;
  shieldL4Integrity: number;
  // Battle
  haterHeat: number;
  activeBotCount: number;
  activeThreatCardCount: number;
  // Cascade
  activeCascadeChains: number;
  // Card
  activeDecisionWindows: number;
  holdsRemaining: number;
}

/**
 * Card play event forwarded to card_handler mechanics.
 * Contains the resolved play data from Step 1.5 of the Orchestrator.
 */
export interface CardPlayExecEvent {
  /** ID of the card played (from CardRegistry) */
  cardId: string;
  /** exec_hook ID of the mechanic triggered by this card */
  mechanicExecHook: string;
  /** Tick the card was played on */
  playedAtTick: number;
  /** Milliseconds from window open to player action */
  resolvedInMs: number;
  /** Whether the player selected the optimal choice */
  wasOptimalChoice: boolean;
  /** Speed score: 0–1 (1 = fastest possible) */
  speedScore: number;
  /** Game mode string (EMPIRE, PREDATOR, SYNDICATE, PHANTOM) */
  mode: string;
  /** Any extra payload from the card definition */
  payload?: Record<string, unknown>;
}

/**
 * Full context passed into every mechanic exec function.
 * Mechanics must be pure: read from ctx, write only through MechanicOutputs.
 */
export interface MechanicExecContext {
  /** Frozen snapshot view for this tick */
  readonly snapshot: MechanicSnapshotView;
  /** The mechanic's own metadata record */
  readonly mechanic: MechanicRecord;
  /** Used ONLY for emitting telemetry events — NOT for reading state */
  readonly eventBusEmit: (event: string, payload: Record<string, unknown>) => void;
  /** Populated only when layer === 'card_handler' */
  readonly cardEvent?: CardPlayExecEvent;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTION OUTPUTS
// ─────────────────────────────────────────────────────────────────────────────

/** Cascade link to be scheduled by the CascadeEngine. */
export interface CascadeLinkSpec {
  linkId: string;
  delayTicks: number;
  magnitude: number;
  chainType: string;
}

/**
 * Canonical output shape for any mechanic execution.
 * All fields optional — mechanics only set what they affect.
 * MechanicsBridge translates these into EventBus events and store mutations.
 */
export interface MechanicOutputs {
  /** Monthly income change. Positive = gain, negative = reduction. */
  incomeDelta?: number;
  /** Monthly expense change. Positive = more expenses, negative = savings. */
  expenseDelta?: number;
  /** Immediate cash lump sum. Positive = receipt, negative = payment. */
  cashDelta?: number;
  /** Net worth adjustment (non-cash, e.g. equity revaluation). */
  netWorthDelta?: number;
  /** Per-layer shield integrity delta. Positive = repair, negative = damage. */
  shieldDelta?: Partial<Record<ShieldLayerId, number>>;
  /** Hater heat change. Positive = more heat, negative = cooled. */
  heatDelta?: number;
  /** Pressure score direct adjustment (supplemental to engine compute). */
  pressureDelta?: number;
  /** Tension score direct adjustment. */
  tensionDelta?: number;
  /** CORD score delta fed to SovereigntyEngine proof pipeline. */
  cordDelta?: number;
  /** Ticks to freeze the time engine (decision window extension). */
  freezeTicks?: number;
  /** Cascade links to schedule into CascadeEngine. */
  cascadeLinks?: CascadeLinkSpec[];
  /** Mechanic-specific structured payload (mode overlays, card effects, etc.). */
  customPayload?: Record<string, unknown>;
}

/**
 * Result returned by every mechanic exec function.
 * MechanicsRouter collects these and passes to MechanicsBridge for translation.
 */
export interface MechanicExecResult {
  mechanicId: string;
  execHook: string;
  /** Whether the mechanic logic evaluated a condition and chose to fire. */
  fired: boolean;
  outputs: MechanicOutputs;
  /** Names of telemetry EventBus events emitted during execution. */
  telemetryEvents: string[];
  /** Present if the exec function threw or returned an error state. */
  errorMessage?: string;
  /** Wall-clock execution time in milliseconds. */
  executionMs: number;
}

/**
 * Signature all pzo_engine mechanic exec functions must implement.
 * Both sync and async mechanics are supported — async is for ML mechanics.
 */
export type MechanicExecFn =
  | ((ctx: MechanicExecContext) => MechanicExecResult)
  | ((ctx: MechanicExecContext) => Promise<MechanicExecResult>);

// ─────────────────────────────────────────────────────────────────────────────
// ROUTER OUTPUTS
// ─────────────────────────────────────────────────────────────────────────────

/** Aggregated result of one MechanicsRouter.tickRuntime() call. */
export interface MechanicTickResult {
  tickIndex: number;
  mechanicsFired: number;
  mechanicsSkipped: number;
  mechanicsErrored: number;
  results: MechanicExecResult[];
  /** Aggregated outputs merged across all fired mechanics. */
  aggregatedOutputs: MechanicOutputs;
  totalExecutionMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// RUNTIME STORE TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Activation history entry stored in mechanicsRuntimeStore. */
export interface MechanicActivationRecord {
  mechanicId: string;
  execHook: string;
  tickIndex: number;
  fired: boolean;
  outputs: MechanicOutputs;
  executionMs: number;
  timestamp: number;
}

/**
 * Per-mechanic runtime state tracked across the run.
 * Heat, confidence, and activation stats feed the debug panel and
 * the ML mechanics' own confidence weighting.
 */
export interface MechanicRuntimeState {
  mechanicId: string;
  layer: MechanicLayer;
  activationCount: number;
  firedCount: number;
  lastActivationTick: number | null;
  totalExecutionMs: number;
  averageExecutionMs: number;
  lastOutputs: MechanicOutputs | null;
  errorCount: number;
  lastError: string | null;
  /**
   * Runtime heat: 0–100. Rises +10 per activation, decays -1 per tick.
   * High heat = mechanic is very active this run.
   */
  runtimeHeat: number;
  /**
   * Confidence: 0–1. Rises with successful (fired=true) activations.
   * Used by ML mechanics to weight their own signal.
   */
  confidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// BRIDGE TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Translated EventBus event produced by MechanicsBridge from a MechanicExecResult.
 * Each EventBus event type maps to a specific store mutation or engine action.
 */
export interface MechanicBridgeEvent {
  eventName: string;
  payload: Record<string, unknown>;
  /** Whether this event requires an immediate bus flush (not deferred). */
  immediate: boolean;
}

/**
 * A registered exec hook entry in MechanicsBridge's internal registry.
 */
export interface ExecHookEntry {
  mechanicId: string;
  execHook: string;
  fn: MechanicExecFn;
  isStub: boolean;
}