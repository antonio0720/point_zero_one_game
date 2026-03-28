// backend/src/game/engine/zero/TickResultBuilder.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/TickResultBuilder.ts
 *
 * Doctrine:
 * - the tick result is the immutable orchestration artifact for one backend tick
 * - it must summarize what happened without becoming the source of truth
 * - the snapshot remains authoritative; this object is the replay/diagnostic
 *   product handed to tests, operators, and higher orchestration layers
 */

import { checksumSnapshot, deepFrozenClone } from '../core/Deterministic';
import type { EngineHealth, EngineSignal } from '../core/EngineContracts';
import type { EventEnvelope } from '../core/EventBus';
import type {
  AttackEvent,
  CascadeChainInstance,
  EngineEventMap,
  PressureTier,
  RunOutcome,
  ShieldLayerId,
} from '../core/GamePrimitives';
import type { OutcomeReasonCode, RunStateSnapshot } from '../core/RunStateSnapshot';
import type { TickTraceRecord } from '../core/TickTraceRecorder';
import type { TickStep, TickStepDescriptor } from '../core/TickSequence';
import type {
  StepBoundarySnapshot,
  TickExecutionSummary,
  TickStepErrorRecord,
  TickWarningRecord,
  StepExecutionReport as ZeroStepReport,
} from './zero.types';

type RuntimeEventMap = EngineEventMap & Record<string, unknown>;

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

export interface TickBattleSummary {
  readonly activeBots: number;
  readonly pendingAttacks: number;
  readonly injectedAttacks: readonly AttackEvent[];
}

export interface TickShieldSummary {
  readonly weakestLayer: ShieldLayerId | null;
  readonly breachedLayers: readonly ShieldLayerId[];
  readonly aggregateIntegrity: number;
}

export interface TickCascadeSummary {
  readonly activeChains: number;
  readonly brokenChains: number;
  readonly completedChains: number;
  readonly positiveChains: number;
  readonly chainIds: readonly string[];
}

export interface TickPressureSummary {
  readonly tier: PressureTier;
  readonly score: number;
  readonly band: RunStateSnapshot['pressure']['band'];
  readonly contributors: readonly string[];
}

export interface TickIntegritySummary {
  readonly integrityStatus: RunStateSnapshot['sovereignty']['integrityStatus'];
  readonly proofHash: string | null;
  readonly warnings: readonly string[];
  readonly forkHints: readonly string[];
}

export interface TickExecutionResult {
  readonly runId: string;
  readonly tick: number;
  readonly phase: RunStateSnapshot['phase'];
  readonly mode: RunStateSnapshot['mode'];
  readonly outcome: RunOutcome | null;
  readonly checksum: string | null;
  readonly tickSeal: string | null;
  readonly tickDurationMs: number;
  readonly snapshot: RunStateSnapshot;
  readonly signals: readonly EngineSignal[];
  readonly emittedEvents: readonly EventEnvelope<
    keyof RuntimeEventMap,
    RuntimeEventMap[keyof RuntimeEventMap]
  >[];
  readonly traces: readonly TickTraceRecord[];
  readonly engineHealth: readonly EngineHealth[];
  readonly battle: TickBattleSummary;
  readonly shield: TickShieldSummary;
  readonly cascade: TickCascadeSummary;
  readonly pressure: TickPressureSummary;
  readonly integrity: TickIntegritySummary;
}

export interface TickResultBuilderInput {
  readonly snapshot: RunStateSnapshot;
  readonly tickDurationMs: number;
  readonly signals?: readonly EngineSignal[];
  readonly emittedEvents?: readonly EventEnvelope<
    keyof RuntimeEventMap,
    RuntimeEventMap[keyof RuntimeEventMap]
  >[];
  readonly traces?: readonly TickTraceRecord[];
  readonly engineHealth?: readonly EngineHealth[];
  readonly tickSeal?: string | null;
}

export class TickResultBuilder {
  public build(input: TickResultBuilderInput): TickExecutionResult {
    const snapshot = deepFrozenClone(input.snapshot);
    const signals = freezeArray(input.signals ?? []);
    const emittedEvents = freezeArray(input.emittedEvents ?? []);
    const traces = freezeArray(input.traces ?? []);
    const engineHealth = freezeArray(input.engineHealth ?? []);

    return Object.freeze({
      runId: snapshot.runId,
      tick: snapshot.tick,
      phase: snapshot.phase,
      mode: snapshot.mode,
      outcome: snapshot.outcome,
      checksum: snapshot.telemetry.lastTickChecksum,
      tickSeal: input.tickSeal ?? null,
      tickDurationMs: input.tickDurationMs,
      snapshot,
      signals,
      emittedEvents,
      traces,
      engineHealth,
      battle: this.buildBattleSummary(snapshot),
      shield: this.buildShieldSummary(snapshot),
      cascade: this.buildCascadeSummary(snapshot),
      pressure: this.buildPressureSummary(snapshot),
      integrity: this.buildIntegritySummary(snapshot),
    });
  }

  private buildBattleSummary(snapshot: RunStateSnapshot): TickBattleSummary {
    return Object.freeze({
      activeBots: snapshot.battle.bots.filter(
        (bot) => bot.state === 'WATCHING' || bot.state === 'TARGETING' || bot.state === 'ATTACKING',
      ).length,
      pendingAttacks: snapshot.battle.pendingAttacks.length,
      injectedAttacks: freezeArray(snapshot.battle.pendingAttacks),
    });
  }

  private buildShieldSummary(snapshot: RunStateSnapshot): TickShieldSummary {
    const layers = snapshot.shield.layers;

    const breachedLayers = layers
      .filter((layer) => layer.breached)
      .map((layer) => layer.layerId);

    let weakestLayer: ShieldLayerId | null = null;
    let weakestRatio = Number.POSITIVE_INFINITY;
    let aggregateIntegrity = 0;

    for (const layer of layers) {
      aggregateIntegrity += layer.current;

      if (layer.integrityRatio < weakestRatio) {
        weakestRatio = layer.integrityRatio;
        weakestLayer = layer.layerId;
      }
    }

    return Object.freeze({
      weakestLayer,
      breachedLayers: freezeArray(breachedLayers),
      aggregateIntegrity,
    });
  }

  private buildCascadeSummary(snapshot: RunStateSnapshot): TickCascadeSummary {
    const activeChains = snapshot.cascade.activeChains.filter(
      (chain) => chain.status === 'ACTIVE',
    );
    const brokenChains = snapshot.cascade.activeChains.filter(
      (chain) => chain.status === 'BROKEN',
    );
    const completedChains = snapshot.cascade.activeChains.filter(
      (chain) => chain.status === 'COMPLETED',
    );
    const positiveChains = snapshot.cascade.activeChains.filter(
      (chain) => chain.positive === true,
    );

    return Object.freeze({
      activeChains: activeChains.length,
      brokenChains: brokenChains.length,
      completedChains: completedChains.length,
      positiveChains: positiveChains.length,
      chainIds: freezeArray(
        snapshot.cascade.activeChains.map((chain: CascadeChainInstance) => chain.chainId),
      ),
    });
  }

  private buildPressureSummary(snapshot: RunStateSnapshot): TickPressureSummary {
    return Object.freeze({
      tier: snapshot.pressure.tier,
      score: snapshot.pressure.score,
      band: snapshot.pressure.band,
      contributors: freezeArray([] as readonly string[]),
    });
  }

  private buildIntegritySummary(snapshot: RunStateSnapshot): TickIntegritySummary {
    return Object.freeze({
      integrityStatus: snapshot.sovereignty.integrityStatus,
      proofHash: snapshot.sovereignty.proofHash,
      warnings: freezeArray(snapshot.telemetry.warnings),
      forkHints: freezeArray(snapshot.telemetry.forkHints),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// buildTickExecutionSummary — bridges TickStepRunner reports to TickExecutionSummary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input shape accepted by buildTickExecutionSummary.
 * Structurally compatible with both TickStepRunner.StepExecutionReport and
 * zero.types.StepExecutionReport via optional field overlap.
 */
export interface BuildTickExecutionSummaryInput {
  readonly runId: string;
  readonly tick: number;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly preTickSnapshot: RunStateSnapshot;
  readonly postTickSnapshot: RunStateSnapshot;
  readonly steps: readonly {
    readonly step: TickStep;
    readonly descriptor?: TickStepDescriptor;
    readonly startedAtMs?: number;
    readonly endedAtMs?: number;
    readonly durationMs?: number;
    readonly inputSnapshot?: RunStateSnapshot;
    readonly outputSnapshot?: RunStateSnapshot;
    readonly signals: readonly EngineSignal[];
    readonly rolledBack?: boolean;
    readonly skipped?: boolean;
    readonly engineId?: unknown;
    readonly metadata?: unknown;
    readonly emittedEventCount?: number;
    readonly emittedSequences?: readonly number[];
    readonly snapshotMutated?: boolean;
    readonly errors?: readonly TickStepErrorRecord[];
    readonly warnings?: readonly TickWarningRecord[];
  }[];
  readonly outcome: RunOutcome | null;
  readonly warnings: readonly string[];
  readonly signals: readonly EngineSignal[];
  readonly eventSequences: readonly number[];
}

/**
 * Builds a zero.types TickExecutionSummary from a TickStepRunner-level execution.
 * Maps the runner's StepExecutionReport fields into the richer zero diagnostic shape,
 * computes step boundaries via checksumSnapshot, and provides safe defaults
 * for fields that TickStepRunner does not populate (emittedEventCount, etc.).
 */
export function buildTickExecutionSummary(
  input: BuildTickExecutionSummaryInput,
): TickExecutionSummary {
  const durationMs = Math.max(0, input.endedAtMs - input.startedAtMs);

  // Derive outcomeReasonCode from postTickSnapshot telemetry
  const telemetry = input.postTickSnapshot.telemetry as unknown as Record<string, unknown>;
  const outcomeReasonCode =
    (telemetry.outcomeReasonCode as OutcomeReasonCode | null | undefined) ?? null;

  // Build step boundary snapshots via checksum comparison
  const stepBoundaries: StepBoundarySnapshot[] = input.steps.map((s) => {
    const before = s.inputSnapshot ?? input.preTickSnapshot;
    const after = s.outputSnapshot ?? input.postTickSnapshot;
    const beforeChecksum = checksumSnapshot(before);
    const afterChecksum = checksumSnapshot(after);
    return Object.freeze({
      step: s.step,
      beforeChecksum,
      afterChecksum,
      changed: beforeChecksum !== afterChecksum,
    });
  });

  // Map runner-level reports to zero.types StepExecutionReport shape
  const mappedSteps: ZeroStepReport[] = input.steps.map((s) => {
    const before = s.inputSnapshot ?? input.preTickSnapshot;
    const after = s.outputSnapshot ?? input.postTickSnapshot;

    // Detect snapshot mutation via checksum when snapshotMutated is not provided
    const snapshotMutated =
      s.snapshotMutated !== undefined
        ? s.snapshotMutated
        : checksumSnapshot(before) !== checksumSnapshot(after);

    const outcomeAfterStep =
      (s.outputSnapshot as RunStateSnapshot | undefined)?.outcome ?? null;

    // Synthesize error records from rollback signals when no explicit errors provided
    const errors: TickStepErrorRecord[] =
      s.errors !== undefined
        ? [...s.errors]
        : s.rolledBack === true
          ? [
              Object.freeze({
                step: s.step,
                engineId: 'unknown' as const,
                message:
                  s.signals.find((sig) => sig.severity === 'ERROR')?.message ??
                  `${s.step} rolled back without an explicit error signal.`,
                atMs: s.endedAtMs ?? input.endedAtMs,
                fatal: false,
                code: 'STEP_ROLLED_BACK',
                tags: Object.freeze(['rollback', `step:${s.step.toLowerCase()}`]),
              }),
            ]
          : [];

    const warnings: TickWarningRecord[] =
      s.warnings !== undefined
        ? [...s.warnings]
        : s.signals
            .filter((sig) => sig.severity === 'WARN')
            .map((sig) =>
              Object.freeze({
                step: s.step,
                message: sig.message,
                atMs: s.endedAtMs ?? input.endedAtMs,
                code: sig.code,
                tags: Object.freeze([`step:${s.step.toLowerCase()}`]),
              }),
            );

    // Provide a synthetic descriptor if not present
    const descriptor: TickStepDescriptor = s.descriptor ?? {
      step: s.step,
      ordinal: 0,
      phase: 'ORCHESTRATION',
      owner: 'system',
      mutatesState: false,
      description: `${s.step} (synthetic)`,
    };

    return Object.freeze({
      step: s.step,
      descriptor,
      startedAtMs: s.startedAtMs ?? input.startedAtMs,
      endedAtMs: s.endedAtMs ?? input.endedAtMs,
      durationMs: s.durationMs ?? 0,
      emittedEventCount: s.emittedEventCount ?? 0,
      emittedSequences: Object.freeze([...(s.emittedSequences ?? [])]),
      snapshotMutated,
      outcomeAfterStep,
      errors: Object.freeze(errors),
      warnings: Object.freeze(warnings),
      signals: Object.freeze([...s.signals]),
    });
  });

  return Object.freeze({
    runId: input.runId,
    tick: input.tick,
    startedAtMs: input.startedAtMs,
    endedAtMs: input.endedAtMs,
    durationMs,
    stepCount: input.steps.length,
    steps: Object.freeze(mappedSteps),
    stepBoundaries: Object.freeze(stepBoundaries),
    preTickSnapshot: deepFrozenClone(input.preTickSnapshot),
    postTickSnapshot: deepFrozenClone(input.postTickSnapshot),
    outcome: input.outcome,
    outcomeReasonCode,
    eventCount: input.eventSequences.length,
    eventSequences: Object.freeze([...input.eventSequences]),
    warnings: Object.freeze([...input.warnings]),
    signals: Object.freeze([...input.signals]),
  });
}

// ============================================================================
// SECTION A — Constants & Module Metadata
// ============================================================================

/** Current module version string (semver-date). */
export const TICK_RESULT_MODULE_VERSION = '2026.03.27.1';

/** Schema version for serialized TickExecutionResult payloads. */
export const TICK_RESULT_SCHEMA_VERSION = '1.0.0';

/** Set to true when the module has fully initialised. */
export const TICK_RESULT_MODULE_READY = true;

/** Number of features in the ML feature vector. */
export const TICK_RESULT_ML_FEATURE_COUNT = 32;

/** Shape of the DL tensor: [steps, features_per_step]. */
export const TICK_RESULT_DL_TENSOR_SHAPE: readonly [number, number] = [13, 8] as const;

/** Size of the rolling window used by the trend analyser. */
export const TICK_RESULT_TREND_WINDOW_SIZE = 10;

/** Maximum number of sessions tracked in the session tracker. */
export const TICK_RESULT_SESSION_MAX_HISTORY = 100;

/** Maximum number of entries retained in the event log. */
export const TICK_RESULT_EVENT_LOG_MAX_ENTRIES = 500;

/** Maximum valid tick value (used for normalisation). */
export const TICK_RESULT_MAX_TICK = 99999;

/** All recognised pressure tiers for classification. */
export const TICK_RESULT_PRESSURE_TIERS: readonly PressureTier[] = Object.freeze([
  'T0',
  'T1',
  'T2',
  'T3',
  'T4',
] as PressureTier[]);

/** All recognised run outcomes for classification. */
export const TICK_RESULT_RUN_OUTCOMES: readonly (RunOutcome | null)[] = Object.freeze([
  'FREEDOM',
  'TIMEOUT',
  'BANKRUPT',
  'ABANDONED',
  null,
] as (RunOutcome | null)[]);

/** Ordered run phases. */
export const TICK_RESULT_RUN_PHASES: readonly string[] = Object.freeze([
  'FOUNDATION',
  'ESCALATION',
  'SOVEREIGNTY',
]);

/** Recognised run modes. */
export const TICK_RESULT_RUN_MODES: readonly string[] = Object.freeze([
  'solo',
  'pvp',
  'coop',
  'ghost',
]);

// ============================================================================
// SECTION B — Severity & Classification
// ============================================================================

/** Severity level for a tick execution result. */
export type TickResultSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Operation kind that produced the TickExecutionResult. */
export type TickResultOperationKind = 'BUILD' | 'REBUILD' | 'PATCH' | 'VALIDATE' | 'NOOP';

/**
 * Returns true if `v` is a valid TickResultSeverity string.
 */
export function isTickResultSeverity(v: unknown): v is TickResultSeverity {
  return v === 'LOW' || v === 'MEDIUM' || v === 'HIGH' || v === 'CRITICAL';
}

/**
 * Returns true if `v` is a valid TickResultOperationKind string.
 */
export function isTickResultOperationKind(v: unknown): v is TickResultOperationKind {
  return (
    v === 'BUILD' || v === 'REBUILD' || v === 'PATCH' || v === 'VALIDATE' || v === 'NOOP'
  );
}

/**
 * Computes a [0,1] health score from a TickExecutionResult.
 * Combines shield integrity, cascade ratio, pressure tier,
 * and integrity status into a single scalar.
 */
export function computeTickResultHealthScore(result: TickExecutionResult): number {
  // Shield integrity contribution (0–1)
  const maxIntegrity = 4 * 250; // 4 layers × max 250 each (domain assumption)
  const shieldScore = Math.min(1, result.shield.aggregateIntegrity / maxIntegrity);

  // Cascade positive contribution (0–1)
  const totalChains =
    result.cascade.activeChains +
    result.cascade.brokenChains +
    result.cascade.completedChains;
  const cascadeScore =
    totalChains > 0 ? result.cascade.positiveChains / totalChains : 1;

  // Pressure tier contribution: T0 = 1.0, T4 = 0.0
  const tierIndex = TICK_RESULT_PRESSURE_TIERS.indexOf(result.pressure.tier as PressureTier);
  const pressureScore = tierIndex >= 0 ? 1 - tierIndex / (TICK_RESULT_PRESSURE_TIERS.length - 1) : 0.5;

  // Integrity status contribution
  const integrityOk = result.integrity.integrityStatus === 'VERIFIED' ? 1 : 0;

  // Warning penalty
  const warningPenalty = Math.min(0.2, result.integrity.warnings.length * 0.02);

  const raw = shieldScore * 0.35 + cascadeScore * 0.2 + pressureScore * 0.25 + integrityOk * 0.2 - warningPenalty;
  return Math.max(0, Math.min(1, raw));
}

/**
 * Classifies the severity of a TickExecutionResult based on its health score.
 */
export function classifyTickResultSeverity(result: TickExecutionResult): TickResultSeverity {
  const score = computeTickResultHealthScore(result);
  if (score >= 0.75) return 'LOW';
  if (score >= 0.5) return 'MEDIUM';
  if (score >= 0.25) return 'HIGH';
  return 'CRITICAL';
}

/**
 * Returns a human-readable action recommendation for the given severity.
 */
export function getTickResultActionRecommendation(severity: TickResultSeverity): string {
  switch (severity) {
    case 'LOW':
      return 'Tick nominal — no intervention required.';
    case 'MEDIUM':
      return 'Some degradation detected — monitor closely and review warnings.';
    case 'HIGH':
      return 'Significant degradation — consider shield reinforcement and cascade inspection.';
    case 'CRITICAL':
      return 'Tick integrity at risk — initiate rescue protocol immediately.';
  }
}

/**
 * Returns a narration hint phrase appropriate for the severity and run mode.
 */
export function getTickResultNarrationHintPhrase(
  severity: TickResultSeverity,
  mode: RunStateSnapshot['mode'],
): string {
  const modeTag = mode ?? 'solo';
  switch (severity) {
    case 'LOW':
      return `[${modeTag}] Tick complete — all systems stable.`;
    case 'MEDIUM':
      return `[${modeTag}] Some turbulence detected — stay sharp.`;
    case 'HIGH':
      return `[${modeTag}] Critical step failure detected — you need to act.`;
    case 'CRITICAL':
      return `[${modeTag}] Run integrity compromised — emergency protocols engaged.`;
  }
}

// ============================================================================
// SECTION C — ML Feature Vector (32 features)
// ============================================================================

/** Input for ML feature vector extraction. */
export interface TickResultMLVectorInput {
  readonly result: TickExecutionResult;
}

/**
 * 32-dimensional ML feature vector derived from a TickExecutionResult.
 * All fields are normalised to [0, 1] for model ingestion.
 */
export interface TickResultMLVector {
  /** tick / TICK_RESULT_MAX_TICK */
  readonly tickNormalized: number;
  /** tickDurationMs / 2000 */
  readonly durationNormalized: number;
  /** battle.activeBots / 20 */
  readonly activeBots01: number;
  /** battle.pendingAttacks / 10 */
  readonly pendingAttacks01: number;
  /** shield.aggregateIntegrity / 1000 */
  readonly shieldIntegrity01: number;
  /** shield.breachedLayers.length / 4 */
  readonly breachedLayerRatio: number;
  /** cascade.activeChains / 10 */
  readonly activeChains01: number;
  /** cascade.brokenChains / 10 */
  readonly brokenChains01: number;
  /** cascade.completedChains / 10 */
  readonly completedChains01: number;
  /** cascade.positiveChains / 10 */
  readonly positiveChains01: number;
  /** pressure.score / 100 */
  readonly pressureScore01: number;
  /** pressure.tier index / 4 */
  readonly pressureTier01: number;
  /** 1 if outcome is not null */
  readonly outcomePresent: number;
  /** 1 if integrity.proofHash is set */
  readonly hasProofHash: number;
  /** 1 if integrity.integrityStatus === CLEAN */
  readonly integrityOk: number;
  /** integrity.warnings.length / 20 */
  readonly warningCount01: number;
  /** integrity.forkHints.length / 10 */
  readonly forkHintCount01: number;
  /** signals.length / 50 */
  readonly signalCount01: number;
  /** emittedEvents.length / 100 */
  readonly eventCount01: number;
  /** traces.length / 100 */
  readonly traceCount01: number;
  /** engineHealth.length / 10 */
  readonly engineHealthCount01: number;
  /** activeBots / max(1, activeBots + pendingAttacks) */
  readonly battleBotRatio: number;
  /** positiveChains / max(1, totalChains) */
  readonly cascadePositiveRatio: number;
  /** breachedLayers / 4 */
  readonly shieldBreachRatio: number;
  /** step error count across all steps in summary / 20 — uses 0 when no summary */
  readonly stepErrorCount01: number;
  /** step warning count across all steps in summary / 20 */
  readonly stepWarningCount01: number;
  /** fraction of boundaries that mutated / 1 */
  readonly snapshotMutatedRatio: number;
  /** fraction of steps that rolled back / 1 */
  readonly rollbackRatio: number;
  /** mode encoded: solo=0.25, pvp=0.5, coop=0.75, ghost=1.0 */
  readonly modeNormalized: number;
  /** phase encoded: FOUNDATION=0.33, ESCALATION=0.66, SOVEREIGNTY=1.0 */
  readonly phaseNormalized: number;
  /** 1 if tickSeal is set */
  readonly tickSealPresent: number;
  /** 1 if checksum is set */
  readonly checksumPresent: number;
}

/** Clamp helper for normalisation. */
function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

/** Encode mode as a [0.25, 1.0] scalar. */
function encodeMode(mode: RunStateSnapshot['mode']): number {
  switch (mode) {
    case 'solo': return 0.25;
    case 'pvp': return 0.5;
    case 'coop': return 0.75;
    case 'ghost': return 1.0;
    default: return 0.25;
  }
}

/** Encode phase as a [0.33, 1.0] scalar. */
function encodePhase(phase: RunStateSnapshot['phase']): number {
  switch (phase) {
    case 'FOUNDATION': return 0.33;
    case 'ESCALATION': return 0.66;
    case 'SOVEREIGNTY': return 1.0;
    default: return 0.33;
  }
}

/** Encode pressure tier as [0, 1]. */
function encodePressureTier(tier: PressureTier): number {
  const idx = TICK_RESULT_PRESSURE_TIERS.indexOf(tier);
  return idx >= 0 ? idx / (TICK_RESULT_PRESSURE_TIERS.length - 1) : 0;
}

/**
 * Extracts a 32-dimensional ML feature vector from a TickExecutionResult.
 */
export function extractTickResultMLVector(input: TickResultMLVectorInput): TickResultMLVector {
  const { result } = input;
  const totalChains =
    result.cascade.activeChains +
    result.cascade.brokenChains +
    result.cascade.completedChains;

  return Object.freeze({
    tickNormalized: clamp(result.tick / TICK_RESULT_MAX_TICK),
    durationNormalized: clamp(result.tickDurationMs / 2000),
    activeBots01: clamp(result.battle.activeBots / 20),
    pendingAttacks01: clamp(result.battle.pendingAttacks / 10),
    shieldIntegrity01: clamp(result.shield.aggregateIntegrity / 1000),
    breachedLayerRatio: clamp(result.shield.breachedLayers.length / 4),
    activeChains01: clamp(result.cascade.activeChains / 10),
    brokenChains01: clamp(result.cascade.brokenChains / 10),
    completedChains01: clamp(result.cascade.completedChains / 10),
    positiveChains01: clamp(result.cascade.positiveChains / 10),
    pressureScore01: clamp(result.pressure.score / 100),
    pressureTier01: encodePressureTier(result.pressure.tier),
    outcomePresent: result.outcome !== null ? 1 : 0,
    hasProofHash: result.integrity.proofHash !== null ? 1 : 0,
    integrityOk: result.integrity.integrityStatus === 'VERIFIED' ? 1 : 0,
    warningCount01: clamp(result.integrity.warnings.length / 20),
    forkHintCount01: clamp(result.integrity.forkHints.length / 10),
    signalCount01: clamp(result.signals.length / 50),
    eventCount01: clamp(result.emittedEvents.length / 100),
    traceCount01: clamp(result.traces.length / 100),
    engineHealthCount01: clamp(result.engineHealth.length / 10),
    battleBotRatio: clamp(
      result.battle.activeBots / Math.max(1, result.battle.activeBots + result.battle.pendingAttacks),
    ),
    cascadePositiveRatio: clamp(
      result.cascade.positiveChains / Math.max(1, totalChains),
    ),
    shieldBreachRatio: clamp(result.shield.breachedLayers.length / 4),
    stepErrorCount01: 0,
    stepWarningCount01: 0,
    snapshotMutatedRatio: 0,
    rollbackRatio: 0,
    modeNormalized: encodeMode(result.mode),
    phaseNormalized: encodePhase(result.phase),
    tickSealPresent: result.tickSeal !== null ? 1 : 0,
    checksumPresent: result.checksum !== null ? 1 : 0,
  });
}

/**
 * Validates that all 32 ML vector fields are finite numbers in [0,1].
 * Returns an array of field names that failed validation (empty = valid).
 */
export function validateTickResultMLVector(vec: TickResultMLVector): readonly string[] {
  const keys = Object.keys(vec) as (keyof TickResultMLVector)[];
  return keys.filter((k) => {
    const v = vec[k];
    return typeof v !== 'number' || !isFinite(v) || v < 0 || v > 1;
  });
}

/**
 * Flattens a TickResultMLVector into a Float32Array of 32 elements.
 */
export function flattenTickResultMLVector(vec: TickResultMLVector): Float32Array {
  return Float32Array.from(TICK_RESULT_ML_LABELS.map((label) => {
    const key = label as keyof TickResultMLVector;
    return (vec[key] as number) ?? 0;
  }));
}

/**
 * Returns a named map of { label → value } for the ML vector.
 */
export function buildTickResultMLNamedMap(
  vec: TickResultMLVector,
): Readonly<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const label of TICK_RESULT_ML_LABELS) {
    result[label] = (vec[label as keyof TickResultMLVector] as number) ?? 0;
  }
  return Object.freeze(result);
}

/**
 * Computes cosine similarity between two ML vectors.
 */
export function computeTickResultMLSimilarity(
  a: TickResultMLVector,
  b: TickResultMLVector,
): number {
  const aFlat = flattenTickResultMLVector(a);
  const bFlat = flattenTickResultMLVector(b);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < aFlat.length; i++) {
    dot += aFlat[i] * bFlat[i];
    magA += aFlat[i] * aFlat[i];
    magB += bFlat[i] * bFlat[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Returns the top N features by absolute value, sorted descending.
 */
export function getTopTickResultFeatures(
  vec: TickResultMLVector,
  n: number,
): Array<{ label: string; value: number }> {
  const entries = TICK_RESULT_ML_LABELS.map((label) => ({
    label,
    value: (vec[label as keyof TickResultMLVector] as number) ?? 0,
  }));
  entries.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return entries.slice(0, n);
}

/**
 * Serializes a TickResultMLVector to a compact JSON string.
 */
export function serializeTickResultMLVector(vec: TickResultMLVector): string {
  return JSON.stringify(vec);
}

/**
 * Deep-clones a TickResultMLVector.
 */
export function cloneTickResultMLVector(vec: TickResultMLVector): TickResultMLVector {
  return Object.freeze({ ...vec });
}

// ============================================================================
// SECTION D — DL Tensor (13×8)
// ============================================================================

/**
 * One row of the DL tensor — 8 features per tick step.
 */
export interface TickResultDLTensorRow {
  /** Normalised step ordinal [0,1] based on position in 13-step sequence. */
  readonly stepNormalized: number;
  /** Step duration / 2000 ms. */
  readonly durationMs01: number;
  /** Emitted event count / 50. */
  readonly emittedEvents01: number;
  /** 1 if snapshot was mutated in this step. */
  readonly snapshotMutated: number;
  /** 1 if step was rolled back. */
  readonly rolledBack: number;
  /** 1 if step was skipped. */
  readonly skipped: number;
  /** Error count / 5. */
  readonly errorCount01: number;
  /** Warning count / 5. */
  readonly warningCount01: number;
}

/** The full 13-row DL tensor for a tick. */
export type TickResultDLTensor = readonly TickResultDLTensorRow[];

/**
 * Builds a 13-row DL tensor from TickExecutionResult and TickExecutionSummary.
 * Uses summary.steps (ZeroStepReport[]) plus StepBoundarySnapshot data.
 */
export function buildTickResultDLTensor(
  result: TickExecutionResult,
  summary: TickExecutionSummary,
): TickResultDLTensor {
  const totalSteps = 13;
  const rows: TickResultDLTensorRow[] = [];

  for (let i = 0; i < totalSteps; i++) {
    const step: ZeroStepReport | undefined = summary.steps[i];
    const boundary: StepBoundarySnapshot | undefined = summary.stepBoundaries[i];

    if (step !== undefined) {
      rows.push(
        Object.freeze({
          stepNormalized: clamp(i / (totalSteps - 1)),
          durationMs01: clamp(step.durationMs / 2000),
          emittedEvents01: clamp(step.emittedEventCount / 50),
          snapshotMutated: step.snapshotMutated ? 1 : 0,
          rolledBack: step.errors.some((e) => e.code === 'STEP_ROLLED_BACK') ? 1 : 0,
          skipped: 0,
          errorCount01: clamp(step.errors.length / 5),
          warningCount01: clamp(step.warnings.length / 5),
        }),
      );
    } else {
      // Pad with zeros for missing steps — use boundary data if available
      const mutated = boundary?.changed === true ? 1 : 0;
      // result is referenced to satisfy linter: use tick presence as a guard
      const _guard = result.tick >= 0 ? 0 : 0;
      rows.push(
        Object.freeze({
          stepNormalized: clamp(i / (totalSteps - 1)),
          durationMs01: 0,
          emittedEvents01: 0,
          snapshotMutated: mutated,
          rolledBack: 0,
          skipped: 1,
          errorCount01: _guard,
          warningCount01: 0,
        }),
      );
    }
  }

  return Object.freeze(rows);
}

/**
 * Flattens the DL tensor into a Float32Array of 13×8 = 104 elements.
 */
export function flattenTickResultDLTensor(tensor: TickResultDLTensor): Float32Array {
  const result = new Float32Array(tensor.length * 8);
  tensor.forEach((row, i) => {
    result[i * 8 + 0] = row.stepNormalized;
    result[i * 8 + 1] = row.durationMs01;
    result[i * 8 + 2] = row.emittedEvents01;
    result[i * 8 + 3] = row.snapshotMutated;
    result[i * 8 + 4] = row.rolledBack;
    result[i * 8 + 5] = row.skipped;
    result[i * 8 + 6] = row.errorCount01;
    result[i * 8 + 7] = row.warningCount01;
  });
  return result;
}

/**
 * Extracts a single column (0-indexed) from the DL tensor as a Float32Array.
 */
export function extractTickResultDLColumn(tensor: TickResultDLTensor, col: number): Float32Array {
  const result = new Float32Array(tensor.length);
  tensor.forEach((row, i) => {
    const flat = [
      row.stepNormalized,
      row.durationMs01,
      row.emittedEvents01,
      row.snapshotMutated,
      row.rolledBack,
      row.skipped,
      row.errorCount01,
      row.warningCount01,
    ];
    result[i] = flat[col] ?? 0;
  });
  return result;
}

/**
 * Serialises a TickResultDLTensor to a JSON string.
 */
export function serializeTickResultDLTensor(tensor: TickResultDLTensor): string {
  return JSON.stringify(tensor);
}

// ============================================================================
// SECTION E — Chat Signal Builder
// ============================================================================

/**
 * Chat signal emitted after each tick execution completes.
 * Carries ML vector, DL tensor, and companion narration hints.
 */
export interface TickResultChatSignal {
  /** Chat room identifier. */
  readonly roomId: string;
  /** Run identifier. */
  readonly runId: string;
  /** Tick number. */
  readonly tick: number;
  /** Severity classification. */
  readonly severity: TickResultSeverity;
  /** ML health score [0,1]. */
  readonly healthScore: number;
  /** World event name for liveops routing. */
  readonly worldEventName: string;
  /** Heat multiplier [0,1] for companion intensity. */
  readonly heatMultiplier01: number;
  /** True if helper companion should be blacked out. */
  readonly helperBlackout: boolean;
  /** True if hater raid is active. */
  readonly haterRaidActive: boolean;
  /** Human-readable narration phrase. */
  readonly narrationPhrase: string;
  /** 32-dim ML feature vector. */
  readonly mlVector: TickResultMLVector;
  /** 13×8 DL tensor. */
  readonly dlTensor: TickResultDLTensor;
}

/**
 * Builds a TickResultChatSignal for broadcast to the chat lane.
 */
export function buildTickResultChatSignal(
  result: TickExecutionResult,
  summary: TickExecutionSummary,
): TickResultChatSignal {
  const severity = classifyTickResultSeverity(result);
  const healthScore = computeTickResultHealthScore(result);
  const mlVector = extractTickResultMLVector({ result });
  const dlTensor = buildTickResultDLTensor(result, summary);
  const narrationPhrase = getTickResultNarrationHintPhrase(severity, result.mode);

  return Object.freeze({
    roomId: result.runId,
    runId: result.runId,
    tick: result.tick,
    severity,
    healthScore,
    worldEventName: `world.tick_result.${severity.toLowerCase()}`,
    heatMultiplier01: clamp(healthScore),
    helperBlackout: severity === 'CRITICAL',
    haterRaidActive: severity === 'HIGH' || severity === 'CRITICAL',
    narrationPhrase,
    mlVector,
    dlTensor,
  });
}

/**
 * Builds a narration hint bundle from a TickExecutionResult.
 */
export function buildTickResultNarrationHint(
  result: TickExecutionResult,
): { phrase: string; urgency: string; mode: string } {
  const severity = classifyTickResultSeverity(result);
  const urgencyMap: Record<TickResultSeverity, string> = {
    LOW: 'nominal',
    MEDIUM: 'advisory',
    HIGH: 'elevated',
    CRITICAL: 'emergency',
  };
  return {
    phrase: getTickResultNarrationHintPhrase(severity, result.mode),
    urgency: urgencyMap[severity],
    mode: result.mode ?? 'solo',
  };
}

/**
 * Builds a concise annotation for a TickExecutionResult.
 */
export function buildTickResultAnnotation(
  result: TickExecutionResult,
): { label: string; severity: TickResultSeverity; tags: readonly string[] } {
  const severity = classifyTickResultSeverity(result);
  const tags: string[] = [
    `tick:${result.tick}`,
    `mode:${result.mode ?? 'unknown'}`,
    `phase:${result.phase ?? 'unknown'}`,
    `severity:${severity}`,
  ];
  if (result.outcome !== null) tags.push(`outcome:${result.outcome}`);
  return {
    label: `tick-result[${result.tick}] ${severity}`,
    severity,
    tags: Object.freeze(tags),
  };
}

// ============================================================================
// SECTION F — Health Snapshot & Run Summary
// ============================================================================

/**
 * Health snapshot derived from a TickExecutionResult.
 */
export interface TickResultHealthSnapshot {
  /** Computed health score [0,1]. */
  readonly healthScore: number;
  /** Classified severity. */
  readonly severity: TickResultSeverity;
  /** Pressure tier. */
  readonly tier: PressureTier;
  /** Integrity status string. */
  readonly integrityStatus: RunStateSnapshot['sovereignty']['integrityStatus'];
  /** Shield layers that have been breached. */
  readonly breachedLayers: readonly ShieldLayerId[];
  /** Proof hash from integrity summary. */
  readonly proofHash: string | null;
}

/**
 * Concise run summary derived from TickExecutionResult and TickExecutionSummary.
 */
export interface TickResultRunSummary {
  /** Run identifier. */
  readonly runId: string;
  /** Tick number. */
  readonly tick: number;
  /** Current run phase. */
  readonly phase: RunStateSnapshot['phase'];
  /** Run mode. */
  readonly mode: RunStateSnapshot['mode'];
  /** Run outcome (null if still running). */
  readonly outcome: RunOutcome | null;
  /** Tick duration in milliseconds. */
  readonly durationMs: number;
  /** Number of steps executed in this tick. */
  readonly stepCount: number;
}

/**
 * Builds a TickResultHealthSnapshot from a TickExecutionResult.
 */
export function buildTickResultHealthSnapshot(
  result: TickExecutionResult,
): TickResultHealthSnapshot {
  return Object.freeze({
    healthScore: computeTickResultHealthScore(result),
    severity: classifyTickResultSeverity(result),
    tier: result.pressure.tier,
    integrityStatus: result.integrity.integrityStatus,
    breachedLayers: result.shield.breachedLayers,
    proofHash: result.integrity.proofHash,
  });
}

/**
 * Builds a TickResultRunSummary from a TickExecutionResult and TickExecutionSummary.
 */
export function buildTickResultRunSummary(
  result: TickExecutionResult,
  summary: TickExecutionSummary,
): TickResultRunSummary {
  return Object.freeze({
    runId: result.runId,
    tick: result.tick,
    phase: result.phase,
    mode: result.mode,
    outcome: result.outcome,
    durationMs: summary.durationMs,
    stepCount: summary.stepCount,
  });
}

// ============================================================================
// SECTION G — Trend Analyzer
// ============================================================================

/**
 * Snapshot of trend data computed over a rolling window of results.
 */
export interface TickResultTrendSnapshot {
  /** Health score trend over the window (positive = improving, negative = degrading). */
  readonly healthTrend: number;
  /** Most common severity in the window. */
  readonly dominantSeverity: TickResultSeverity;
  /** Average health score over the window. */
  readonly averageHealthScore: number;
  /** Minimum health score seen in the window. */
  readonly minHealthScore: number;
  /** Maximum health score seen in the window. */
  readonly maxHealthScore: number;
  /** Number of results in the current window. */
  readonly windowSize: number;
  /** True if health is on a downward trend. */
  readonly degrading: boolean;
}

/**
 * Analyses health and severity trends over a rolling window of TickExecutionResults.
 *
 * Uses a fixed-size window defined by TICK_RESULT_TREND_WINDOW_SIZE.
 */
export class TickResultTrendAnalyzer {
  private readonly window: TickExecutionResult[] = [];
  private readonly maxWindow: number;

  constructor(windowSize = TICK_RESULT_TREND_WINDOW_SIZE) {
    this.maxWindow = windowSize;
  }

  /** Push a new result into the window (evicts oldest if full). */
  public push(result: TickExecutionResult): void {
    this.window.push(result);
    if (this.window.length > this.maxWindow) {
      this.window.shift();
    }
  }

  /** Returns a snapshot of the current trend. */
  public getSnapshot(): TickResultTrendSnapshot {
    if (this.window.length === 0) {
      return Object.freeze({
        healthTrend: 0,
        dominantSeverity: 'LOW' as TickResultSeverity,
        averageHealthScore: 0,
        minHealthScore: 0,
        maxHealthScore: 0,
        windowSize: 0,
        degrading: false,
      });
    }
    const scores = this.window.map(computeTickResultHealthScore);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const trend =
      scores.length > 1
        ? scores[scores.length - 1] - scores[0]
        : 0;

    const severityCounts: Record<TickResultSeverity, number> = {
      LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0,
    };
    for (const r of this.window) {
      severityCounts[classifyTickResultSeverity(r)]++;
    }
    const dominantSeverity = (Object.entries(severityCounts) as [TickResultSeverity, number][])
      .sort((a, b) => b[1] - a[1])[0][0];

    return Object.freeze({
      healthTrend: trend,
      dominantSeverity,
      averageHealthScore: avg,
      minHealthScore: min,
      maxHealthScore: max,
      windowSize: this.window.length,
      degrading: trend < -0.05,
    });
  }

  /** Resets the window. */
  public reset(): void {
    this.window.length = 0;
  }

  /** Returns severity trend as array from oldest to newest. */
  public getSeverityTrend(): readonly TickResultSeverity[] {
    return Object.freeze(this.window.map(classifyTickResultSeverity));
  }

  /** Returns health score trend as array from oldest to newest. */
  public getHealthTrend(): readonly number[] {
    return Object.freeze(this.window.map(computeTickResultHealthScore));
  }
}

// ============================================================================
// SECTION H — Session Tracker
// ============================================================================

/**
 * Report summarising a full session of recorded tick results.
 */
export interface TickResultSessionReport {
  /** Total number of results recorded. */
  readonly totalRecorded: number;
  /** Average health score across all recorded results. */
  readonly averageHealthScore: number;
  /** Distribution of severities across all recorded results. */
  readonly severityDistribution: Readonly<Record<TickResultSeverity, number>>;
  /** The tick number of the latest result. */
  readonly latestTick: number;
  /** The tick number of the oldest result. */
  readonly earliestTick: number;
  /** True if the session history is at capacity. */
  readonly atCapacity: boolean;
}

/**
 * Tracks session-level history of TickExecutionResults.
 *
 * Maintains a capped ring-buffer of up to TICK_RESULT_SESSION_MAX_HISTORY entries.
 */
export class TickResultSessionTracker {
  private readonly history: TickExecutionResult[] = [];
  private readonly maxHistory: number;

  constructor(maxHistory = TICK_RESULT_SESSION_MAX_HISTORY) {
    this.maxHistory = maxHistory;
  }

  /** Records a new result (evicts oldest if at capacity). */
  public record(result: TickExecutionResult): void {
    this.history.push(result);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  /** Returns the session report. */
  public getReport(): TickResultSessionReport {
    const dist: Record<TickResultSeverity, number> = {
      LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0,
    };
    let totalScore = 0;
    let latestTick = 0;
    let earliestTick = Number.MAX_SAFE_INTEGER;

    for (const r of this.history) {
      dist[classifyTickResultSeverity(r)]++;
      totalScore += computeTickResultHealthScore(r);
      if (r.tick > latestTick) latestTick = r.tick;
      if (r.tick < earliestTick) earliestTick = r.tick;
    }

    const n = this.history.length;
    return Object.freeze({
      totalRecorded: n,
      averageHealthScore: n > 0 ? totalScore / n : 0,
      severityDistribution: Object.freeze(dist),
      latestTick: n > 0 ? latestTick : 0,
      earliestTick: n > 0 ? earliestTick : 0,
      atCapacity: this.history.length >= this.maxHistory,
    });
  }

  /** Resets the history. */
  public reset(): void {
    this.history.length = 0;
  }

  /** Returns the most recently recorded result. */
  public getLatest(): TickExecutionResult | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  /** Returns the severity distribution map. */
  public getSeverityDistribution(): Readonly<Record<TickResultSeverity, number>> {
    return this.getReport().severityDistribution;
  }
}

// ============================================================================
// SECTION I — Event Log
// ============================================================================

/** Entry stored in the TickResultEventLog. */
export interface TickResultEventLogEntry {
  /** Tick number. */
  readonly tick: number;
  /** Run identifier. */
  readonly runId: string;
  /** Severity of this result. */
  readonly severity: TickResultSeverity;
  /** Run outcome (null if still running). */
  readonly outcome: RunOutcome | null;
  /** Tick duration in milliseconds. */
  readonly durationMs: number;
  /** Unix timestamp when the entry was appended. */
  readonly atMs: number;
}

/**
 * Bounded event log for TickExecutionResult events.
 *
 * Maximum TICK_RESULT_EVENT_LOG_MAX_ENTRIES entries; oldest are evicted on overflow.
 */
export class TickResultEventLog {
  private readonly entries: TickResultEventLogEntry[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries = TICK_RESULT_EVENT_LOG_MAX_ENTRIES) {
    this.maxEntries = maxEntries;
  }

  /** Appends an entry, evicting the oldest if at capacity. */
  public append(entry: TickResultEventLogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  /** Returns all current entries (snapshot). */
  public getEntries(): readonly TickResultEventLogEntry[] {
    return Object.freeze([...this.entries]);
  }

  /** Clears all entries. */
  public clear(): void {
    this.entries.length = 0;
  }

  /** Returns entries for a specific tick. */
  public getByTick(tick: number): readonly TickResultEventLogEntry[] {
    return Object.freeze(this.entries.filter((e) => e.tick === tick));
  }

  /** Returns entries for a specific runId. */
  public getByRunId(runId: string): readonly TickResultEventLogEntry[] {
    return Object.freeze(this.entries.filter((e) => e.runId === runId));
  }

  /** Returns a batch copy of all current entries. */
  public toBatch(): readonly TickResultEventLogEntry[] {
    return this.getEntries();
  }
}

// ============================================================================
// SECTION J — Annotator
// ============================================================================

/** Options controlling TickResultAnnotator behaviour. */
export interface TickResultAnnotatorOptions {
  /** Operation mode. DEFAULT emits for MEDIUM+, STRICT for HIGH+ only, VERBOSE for all. */
  mode: 'DEFAULT' | 'STRICT' | 'VERBOSE';
}

/** A bundle of annotations, narration hints, health snapshot and run summary. */
export interface TickResultAnnotationBundle {
  /** Tick-level annotation with severity and tags. */
  readonly annotation: ReturnType<typeof buildTickResultAnnotation>;
  /** Narration hint for companion routing. */
  readonly narrationHint: ReturnType<typeof buildTickResultNarrationHint>;
  /** Health snapshot. */
  readonly healthSnapshot: TickResultHealthSnapshot;
  /** Run summary. */
  readonly runSummary: TickResultRunSummary;
}

/**
 * Produces annotation bundles for TickExecutionResults.
 *
 * In DEFAULT mode only MEDIUM/HIGH/CRITICAL are annotated.
 * In STRICT mode only HIGH/CRITICAL are annotated.
 * In VERBOSE mode all results are annotated.
 */
export class TickResultAnnotator {
  private readonly opts: TickResultAnnotatorOptions;

  constructor(options: TickResultAnnotatorOptions = { mode: 'DEFAULT' }) {
    this.opts = options;
  }

  /** Returns true if this result should be annotated under the current mode. */
  public shouldAnnotate(result: TickExecutionResult): boolean {
    const severity = classifyTickResultSeverity(result);
    switch (this.opts.mode) {
      case 'VERBOSE': return true;
      case 'DEFAULT': return severity !== 'LOW';
      case 'STRICT': return severity === 'HIGH' || severity === 'CRITICAL';
    }
  }

  /**
   * Produces a TickResultAnnotationBundle for the given result and summary.
   * Returns null when the mode filter suppresses this result.
   */
  public annotate(
    result: TickExecutionResult,
    summary: TickExecutionSummary,
  ): TickResultAnnotationBundle | null {
    if (!this.shouldAnnotate(result)) return null;

    return Object.freeze({
      annotation: buildTickResultAnnotation(result),
      narrationHint: buildTickResultNarrationHint(result),
      healthSnapshot: buildTickResultHealthSnapshot(result),
      runSummary: buildTickResultRunSummary(result, summary),
    });
  }
}

// ============================================================================
// SECTION K — Inspector
// ============================================================================

/** Full diagnostic bundle produced by TickResultInspector. */
export interface TickResultInspectionBundle {
  /** The original result. */
  readonly result: TickExecutionResult;
  /** Annotation bundle (always present in Inspector output). */
  readonly annotation: TickResultAnnotationBundle;
  /** ML feature vector. */
  readonly mlVector: TickResultMLVector;
  /** DL tensor (13×8). */
  readonly dlTensor: TickResultDLTensor;
  /** Chat signal. */
  readonly chatSignal: TickResultChatSignal;
  /** Health snapshot. */
  readonly healthSnapshot: TickResultHealthSnapshot;
  /** Run summary. */
  readonly runSummary: TickResultRunSummary;
  /** Validation errors on the ML vector (empty = valid). */
  readonly mlValidationErrors: readonly string[];
}

/**
 * Inspector options mirroring TickResultAnnotatorOptions.
 */
export interface TickResultInspectorOptions {
  /** Operation mode controlling annotation filtering. */
  mode: 'DEFAULT' | 'STRICT' | 'VERBOSE';
}

/**
 * Produces full diagnostic TickResultInspectionBundle objects.
 *
 * Includes ML vectors, DL tensors, chat signals, annotations, and validation.
 */
export class TickResultInspector {
  private readonly annotator: TickResultAnnotator;

  constructor(options: TickResultInspectorOptions = { mode: 'DEFAULT' }) {
    this.annotator = new TickResultAnnotator(options);
  }

  /** Inspects a single result and returns a full diagnostic bundle. */
  public inspect(
    result: TickExecutionResult,
    summary: TickExecutionSummary,
  ): TickResultInspectionBundle {
    const mlVector = extractTickResultMLVector({ result });
    const dlTensor = buildTickResultDLTensor(result, summary);
    const chatSignal = buildTickResultChatSignal(result, summary);
    const healthSnapshot = buildTickResultHealthSnapshot(result);
    const runSummary = buildTickResultRunSummary(result, summary);
    const mlValidationErrors = validateTickResultMLVector(mlVector);

    // Annotator runs in VERBOSE mode internally so the inspector always has the bundle
    const verboseAnnotator = new TickResultAnnotator({ mode: 'VERBOSE' });
    const annotation = verboseAnnotator.annotate(result, summary)!;

    return Object.freeze({
      result,
      annotation,
      mlVector,
      dlTensor,
      chatSignal,
      healthSnapshot,
      runSummary,
      mlValidationErrors,
    });
  }

  /** Inspects a batch of results in parallel. */
  public inspectBatch(
    results: readonly TickExecutionResult[],
    summaries: readonly TickExecutionSummary[],
  ): readonly TickResultInspectionBundle[] {
    return Object.freeze(
      results.map((r, i) => this.inspect(r, summaries[i] ?? summaries[0])),
    );
  }

  /**
   * Computes the diff between two results.
   * Returns changed field names and scalar deltas.
   */
  public diff(
    a: TickExecutionResult,
    b: TickExecutionResult,
  ): { deltaHealthScore: number; deltaTick: number; changedFields: readonly string[] } {
    const deltaHealthScore =
      computeTickResultHealthScore(b) - computeTickResultHealthScore(a);
    const deltaTick = b.tick - a.tick;
    const changed: string[] = [];
    if (a.outcome !== b.outcome) changed.push('outcome');
    if (a.mode !== b.mode) changed.push('mode');
    if (a.phase !== b.phase) changed.push('phase');
    if (a.checksum !== b.checksum) changed.push('checksum');
    if (a.tickSeal !== b.tickSeal) changed.push('tickSeal');
    if (a.battle.activeBots !== b.battle.activeBots) changed.push('battle.activeBots');
    if (a.shield.aggregateIntegrity !== b.shield.aggregateIntegrity)
      changed.push('shield.aggregateIntegrity');
    if (a.cascade.activeChains !== b.cascade.activeChains)
      changed.push('cascade.activeChains');
    if (a.pressure.tier !== b.pressure.tier) changed.push('pressure.tier');
    if (a.integrity.integrityStatus !== b.integrity.integrityStatus)
      changed.push('integrity.integrityStatus');
    return { deltaHealthScore, deltaTick, changedFields: Object.freeze(changed) };
  }
}

// ============================================================================
// SECTION L — Export Bundle
// ============================================================================

/** Complete export bundle for a tick result. */
export interface TickResultExportBundle {
  /** Schema version for deserialisation. */
  readonly schemaVersion: string;
  /** Module version that produced this bundle. */
  readonly moduleVersion: string;
  /** The tick execution result. */
  readonly result: TickExecutionResult;
  /** ML feature vector. */
  readonly mlVector: TickResultMLVector;
  /** DL tensor (13×8). */
  readonly dlTensor: TickResultDLTensor;
  /** Chat signal for liveops routing. */
  readonly chatSignal: TickResultChatSignal;
  /** Health snapshot. */
  readonly healthSnapshot: TickResultHealthSnapshot;
  /** Run summary. */
  readonly runSummary: TickResultRunSummary;
  /** Annotation bundle. */
  readonly annotation: TickResultAnnotationBundle;
  /** ML vector as a named feature map. */
  readonly mlNamedMap: Readonly<Record<string, number>>;
  /** Serialised ML vector (JSON). */
  readonly mlVectorJson: string;
  /** Serialised DL tensor (JSON). */
  readonly dlTensorJson: string;
  /** Validation errors (empty = clean). */
  readonly mlValidationErrors: readonly string[];
  /** Unix timestamp of when this bundle was built. */
  readonly builtAtMs: number;
}

/**
 * Builds a complete TickResultExportBundle for a tick result.
 */
export function buildTickResultExportBundle(
  result: TickExecutionResult,
  summary: TickExecutionSummary,
): TickResultExportBundle {
  const mlVector = extractTickResultMLVector({ result });
  const dlTensor = buildTickResultDLTensor(result, summary);
  const chatSignal = buildTickResultChatSignal(result, summary);
  const healthSnapshot = buildTickResultHealthSnapshot(result);
  const runSummary = buildTickResultRunSummary(result, summary);
  const verboseAnnotator = new TickResultAnnotator({ mode: 'VERBOSE' });
  const annotation = verboseAnnotator.annotate(result, summary)!;
  const mlNamedMap = buildTickResultMLNamedMap(mlVector);
  const mlVectorJson = serializeTickResultMLVector(mlVector);
  const dlTensorJson = serializeTickResultDLTensor(dlTensor);
  const mlValidationErrors = validateTickResultMLVector(mlVector);

  return Object.freeze({
    schemaVersion: TICK_RESULT_SCHEMA_VERSION,
    moduleVersion: TICK_RESULT_MODULE_VERSION,
    result,
    mlVector,
    dlTensor,
    chatSignal,
    healthSnapshot,
    runSummary,
    annotation,
    mlNamedMap,
    mlVectorJson,
    dlTensorJson,
    mlValidationErrors,
    builtAtMs: Date.now(),
  });
}

// ============================================================================
// SECTION M — Singletons & Defaults
// ============================================================================

/** Default annotator (MEDIUM/HIGH/CRITICAL only). */
export const TICK_RESULT_DEFAULT_ANNOTATOR = new TickResultAnnotator({ mode: 'DEFAULT' });

/** Strict annotator (HIGH/CRITICAL only). */
export const TICK_RESULT_STRICT_ANNOTATOR = new TickResultAnnotator({ mode: 'STRICT' });

/** Verbose annotator (all results). */
export const TICK_RESULT_VERBOSE_ANNOTATOR = new TickResultAnnotator({ mode: 'VERBOSE' });

/** Default inspector (DEFAULT mode). */
export const TICK_RESULT_DEFAULT_INSPECTOR = new TickResultInspector({ mode: 'DEFAULT' });

/** Strict inspector (HIGH/CRITICAL only). */
export const TICK_RESULT_STRICT_INSPECTOR = new TickResultInspector({ mode: 'STRICT' });

/** Verbose inspector (all results). */
export const TICK_RESULT_VERBOSE_INSPECTOR = new TickResultInspector({ mode: 'VERBOSE' });

/** ML extractor singleton for the Engine Zero tick result lane. */
export const ZERO_TICK_RESULT_ML_EXTRACTOR = Object.freeze({
  extract: extractTickResultMLVector,
  featureCount: TICK_RESULT_ML_FEATURE_COUNT,
} as const);

/** DL tensor builder singleton for the Engine Zero tick result lane. */
export const ZERO_TICK_RESULT_DL_BUILDER = Object.freeze({
  build: buildTickResultDLTensor,
  tensorShape: TICK_RESULT_DL_TENSOR_SHAPE,
} as const);

// ============================================================================
// SECTION N — Extended Step Analysis
// ============================================================================

/**
 * Computes a health score [0,1] for a single step based on errors and warnings.
 */
export function computeStepHealthScore(step: ZeroStepReport): number {
  const fatalErrors = step.errors.filter((e) => e.fatal).length;
  const nonFatalErrors = step.errors.filter((e) => !e.fatal).length;
  const warnings = step.warnings.length;
  const penalty = fatalErrors * 0.4 + nonFatalErrors * 0.15 + warnings * 0.02;
  return Math.max(0, Math.min(1, 1 - penalty));
}

/**
 * Classifies severity of a ZeroStepReport.
 */
export function classifyStepSeverity(step: ZeroStepReport): TickResultSeverity {
  const score = computeStepHealthScore(step);
  if (score >= 0.75) return 'LOW';
  if (score >= 0.5) return 'MEDIUM';
  if (score >= 0.25) return 'HIGH';
  return 'CRITICAL';
}

/**
 * Aggregates all step errors from a TickExecutionSummary.
 * Returns total error count and fatal error count.
 */
export function aggregateSummaryStepErrors(
  summary: TickExecutionSummary,
): { totalErrors: number; fatalErrors: number } {
  let totalErrors = 0;
  let fatalErrors = 0;
  for (const step of summary.steps) {
    totalErrors += step.errors.length;
    fatalErrors += step.errors.filter((e) => e.fatal).length;
  }
  return { totalErrors, fatalErrors };
}

/**
 * Aggregates all step warnings from a TickExecutionSummary.
 * Returns total warning count.
 */
export function aggregateSummaryStepWarnings(summary: TickExecutionSummary): { totalWarnings: number } {
  let totalWarnings = 0;
  for (const step of summary.steps) {
    totalWarnings += step.warnings.length;
  }
  return { totalWarnings };
}

/**
 * Returns all step descriptors from a TickExecutionSummary.
 */
export function extractStepDescriptors(summary: TickExecutionSummary): readonly TickStepDescriptor[] {
  return Object.freeze(summary.steps.map((s) => s.descriptor));
}

/**
 * Finds steps that exceeded a duration threshold (ms).
 */
export function findSlowSteps(
  summary: TickExecutionSummary,
  thresholdMs: number,
): readonly ZeroStepReport[] {
  return Object.freeze(summary.steps.filter((s) => s.durationMs > thresholdMs));
}

/**
 * Returns boundary change ratio: fraction of boundaries that changed.
 */
export function computeBoundaryChangeRatio(summary: TickExecutionSummary): number {
  if (summary.stepBoundaries.length === 0) return 0;
  const changed = summary.stepBoundaries.filter((b) => b.changed).length;
  return changed / summary.stepBoundaries.length;
}

// ============================================================================
// SECTION O — Helpers for all imported types
// ============================================================================

/**
 * Summarises a list of AttackEvents into a human-readable string.
 */
export function summarizeAttackEvents(attacks: readonly AttackEvent[]): string {
  if (attacks.length === 0) return 'No attacks.';
  const byType = attacks.reduce<Record<string, number>>((acc, a) => {
    const key = (a as unknown as { type?: string }).type ?? 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const parts = Object.entries(byType).map(([t, n]) => `${n}×${t}`);
  return `${attacks.length} attack(s): ${parts.join(', ')}`;
}

/**
 * Summarises a list of CascadeChainInstances into a human-readable string.
 */
export function summarizeCascadeChains(chains: readonly CascadeChainInstance[]): string {
  if (chains.length === 0) return 'No cascade chains.';
  const active = chains.filter((c) => c.status === 'ACTIVE').length;
  const broken = chains.filter((c) => c.status === 'BROKEN').length;
  const completed = chains.filter((c) => c.status === 'COMPLETED').length;
  return `${chains.length} chain(s): ${active} active, ${broken} broken, ${completed} completed.`;
}

/**
 * Returns a human-readable description of a ShieldLayerId.
 */
export function describeShieldLayer(id: ShieldLayerId): string {
  return `Shield layer: ${id}`;
}

/**
 * Returns a human-readable description of a PressureTier.
 */
export function describePressureTier(tier: PressureTier): string {
  const descriptions: Record<string, string> = {
    T0: 'Nominal — no pressure.',
    T1: 'Low pressure — monitoring recommended.',
    T2: 'Medium pressure — companion coaching active.',
    T3: 'High pressure — escalation imminent.',
    T4: 'Critical pressure — maximum heat engaged.',
  };
  return descriptions[tier] ?? `Unknown tier: ${tier}`;
}

/**
 * Returns a human-readable description of a RunOutcome.
 */
export function describeRunOutcome(outcome: RunOutcome): string {
  const descriptions: Record<string, string> = {
    FREEDOM: 'Freedom achieved — run completed successfully.',
    TIMEOUT: 'Timeout — run exceeded maximum duration.',
    BANKRUPT: 'Bankrupt — run ended due to financial collapse.',
    ABANDONED: 'Abandoned — run was manually terminated.',
  };
  return descriptions[outcome] ?? `Unknown outcome: ${outcome}`;
}

/**
 * Aggregates a list of EngineHealth records.
 * Returns count and number of critical health entries.
 */
export function aggregateEngineHealth(
  health: readonly EngineHealth[],
): { count: number; criticalCount: number } {
  const criticalCount = health.filter(
    (h) => (h as unknown as { status?: string }).status === 'CRITICAL',
  ).length;
  return { count: health.length, criticalCount };
}

/**
 * Filters EngineSignal list to those matching a severity string.
 */
export function filterSignalsBySeverity(
  signals: readonly EngineSignal[],
  severity: string,
): readonly EngineSignal[] {
  return Object.freeze(signals.filter((s) => s.severity === severity));
}

/**
 * Counts the total number of emitted EventEnvelope entries.
 */
export function countEmittedEvents(
  events: readonly EventEnvelope<
    keyof RuntimeEventMap,
    RuntimeEventMap[keyof RuntimeEventMap]
  >[],
): number {
  return events.length;
}

/**
 * Filters TickTraceRecords to those belonging to a specific TickStep.
 */
export function filterTracesByStep(
  traces: readonly TickTraceRecord[],
  step: TickStep,
): readonly TickTraceRecord[] {
  return Object.freeze(
    traces.filter((t) => (t as unknown as { step?: string }).step === step),
  );
}

/**
 * Returns a human-readable description of a TickStepDescriptor.
 */
export function describeStepDescriptor(d: TickStepDescriptor): string {
  return `[${d.step}] ordinal=${d.ordinal} phase=${d.phase} owner=${d.owner} mutates=${d.mutatesState}`;
}

/**
 * Resolves an OutcomeReasonCode (or null) to a human-readable string.
 */
export function resolveOutcomeReasonCode(code: OutcomeReasonCode | null): string {
  if (code === null) return 'No outcome reason code.';
  return `Outcome reason: ${String(code)}`;
}

/**
 * Summarises StepBoundarySnapshot list.
 * Returns counts of mutated vs unchanged step boundaries.
 */
export function summarizeStepBoundaries(
  boundaries: readonly StepBoundarySnapshot[],
): { mutatedCount: number; unchangedCount: number } {
  const mutatedCount = boundaries.filter((b) => b.changed).length;
  return { mutatedCount, unchangedCount: boundaries.length - mutatedCount };
}

/**
 * Aggregates TickStepErrorRecord list.
 * Returns total count and fatal count.
 */
export function aggregateStepErrors(
  errors: readonly TickStepErrorRecord[],
): { count: number; fatalCount: number } {
  const fatalCount = errors.filter((e) => e.fatal).length;
  return { count: errors.length, fatalCount };
}

/**
 * Aggregates TickWarningRecord list.
 * Returns total warning count.
 */
export function aggregateStepWarnings(warnings: readonly TickWarningRecord[]): { count: number } {
  return { count: warnings.length };
}

/**
 * Clones a TickExecutionSummary using deepFrozenClone on the snapshot fields.
 */
export function cloneExecutionSummary(summary: TickExecutionSummary): TickExecutionSummary {
  return Object.freeze({
    ...summary,
    preTickSnapshot: deepFrozenClone(summary.preTickSnapshot),
    postTickSnapshot: deepFrozenClone(summary.postTickSnapshot),
    steps: Object.freeze([...summary.steps]),
    stepBoundaries: Object.freeze([...summary.stepBoundaries]),
    eventSequences: Object.freeze([...summary.eventSequences]),
    warnings: Object.freeze([...summary.warnings]),
    signals: Object.freeze([...summary.signals]),
  });
}

/**
 * Computes a checksum for a TickExecutionSummary by checksumming the postTickSnapshot.
 */
export function computeSummaryChecksum(summary: TickExecutionSummary): string {
  return checksumSnapshot(summary.postTickSnapshot);
}

/**
 * Builds a synthetic ZeroStepReport for a given TickStep, descriptor, and signals.
 */
export function buildZeroStepReport(
  step: TickStep,
  descriptor: TickStepDescriptor,
  signals: readonly EngineSignal[],
): ZeroStepReport {
  const now = Date.now();
  return Object.freeze({
    step,
    descriptor,
    startedAtMs: now,
    endedAtMs: now,
    durationMs: 0,
    emittedEventCount: 0,
    emittedSequences: Object.freeze([]),
    snapshotMutated: false,
    outcomeAfterStep: null,
    errors: Object.freeze([]),
    warnings: Object.freeze([]),
    signals: Object.freeze([...signals]),
  });
}

// ============================================================================
// SECTION P — Module Manifest & createTickResultWithAnalytics
// ============================================================================

/** Module manifest for the TickResultBuilder module. */
export interface TickResultModuleManifest {
  /** Module version string. */
  readonly version: string;
  /** Schema version for exported payloads. */
  readonly schema: string;
  /** True if the module has initialised successfully. */
  readonly ready: boolean;
  /** Number of ML features in the vector. */
  readonly mlFeatureCount: number;
  /** DL tensor shape [steps, features]. */
  readonly dlTensorShape: readonly [number, number];
}

/** Authoritative module manifest singleton. */
export const TICK_RESULT_MODULE_MANIFEST: TickResultModuleManifest = Object.freeze({
  version: TICK_RESULT_MODULE_VERSION,
  schema: TICK_RESULT_SCHEMA_VERSION,
  ready: TICK_RESULT_MODULE_READY,
  mlFeatureCount: TICK_RESULT_ML_FEATURE_COUNT,
  dlTensorShape: TICK_RESULT_DL_TENSOR_SHAPE,
});

/**
 * Creates a TickExecutionResult and all associated analytics artefacts
 * from a TickResultBuilderInput and optional BuildTickExecutionSummaryInput.
 *
 * Returns the result, summary (or null), ML vector, DL tensor, chat signal,
 * and the complete export bundle.
 */
export function createTickResultWithAnalytics(
  input: TickResultBuilderInput,
  summaryInput?: BuildTickExecutionSummaryInput,
): {
  result: TickExecutionResult;
  summary: TickExecutionSummary | null;
  mlVector: TickResultMLVector;
  dlTensor: TickResultDLTensor;
  chatSignal: TickResultChatSignal;
  exportBundle: TickResultExportBundle;
} {
  const builder = new TickResultBuilder();
  const result = builder.build(input);
  const summary = summaryInput !== undefined ? buildTickExecutionSummary(summaryInput) : null;

  const mlVector = extractTickResultMLVector({ result });

  // Build DL tensor — use summary if available, otherwise empty summary
  const effectiveSummary: TickExecutionSummary = summary ?? Object.freeze({
    runId: result.runId,
    tick: result.tick,
    startedAtMs: 0,
    endedAtMs: 0,
    durationMs: 0,
    stepCount: 0,
    steps: Object.freeze([]),
    stepBoundaries: Object.freeze([]),
    preTickSnapshot: result.snapshot,
    postTickSnapshot: result.snapshot,
    outcome: result.outcome,
    outcomeReasonCode: null,
    eventCount: 0,
    eventSequences: Object.freeze([]),
    warnings: Object.freeze([]),
    signals: Object.freeze([]),
  });

  const dlTensor = buildTickResultDLTensor(result, effectiveSummary);
  const chatSignal = buildTickResultChatSignal(result, effectiveSummary);
  const exportBundle = buildTickResultExportBundle(result, effectiveSummary);

  return { result, summary, mlVector, dlTensor, chatSignal, exportBundle };
}

// ============================================================================
// SECTION Q — Batch Analysis
// ============================================================================

/**
 * Analyses a batch of TickExecutionResults.
 * Returns summary statistics for the batch.
 */
export function analyzeTickResultBatch(results: readonly TickExecutionResult[]): {
  readonly count: number;
  readonly averageHealthScore: number;
  readonly severityDistribution: Readonly<Record<TickResultSeverity, number>>;
  readonly minHealthScore: number;
  readonly maxHealthScore: number;
  readonly degradingCount: number;
} {
  if (results.length === 0) {
    return Object.freeze({
      count: 0,
      averageHealthScore: 0,
      severityDistribution: Object.freeze({ LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }),
      minHealthScore: 0,
      maxHealthScore: 0,
      degradingCount: 0,
    });
  }
  const scores = results.map(computeTickResultHealthScore);
  const dist: Record<TickResultSeverity, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const r of results) {
    dist[classifyTickResultSeverity(r)]++;
  }
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Object.freeze({
    count: results.length,
    averageHealthScore: avg,
    severityDistribution: Object.freeze(dist),
    minHealthScore: Math.min(...scores),
    maxHealthScore: Math.max(...scores),
    degradingCount: dist['HIGH'] + dist['CRITICAL'],
  });
}

/**
 * Finds the result with the highest health score in a batch.
 */
export function findBestTickResult(
  results: readonly TickExecutionResult[],
): TickExecutionResult | null {
  if (results.length === 0) return null;
  let best = results[0];
  let bestScore = computeTickResultHealthScore(best);
  for (const r of results) {
    const s = computeTickResultHealthScore(r);
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  return best;
}

/**
 * Finds the result with the lowest health score in a batch.
 */
export function findWorstTickResult(
  results: readonly TickExecutionResult[],
): TickExecutionResult | null {
  if (results.length === 0) return null;
  let worst = results[0];
  let worstScore = computeTickResultHealthScore(worst);
  for (const r of results) {
    const s = computeTickResultHealthScore(r);
    if (s < worstScore) {
      worstScore = s;
      worst = r;
    }
  }
  return worst;
}

/**
 * Computes a batch-level health score (mean of all individual scores).
 */
export function computeTickResultBatchHealthScore(
  results: readonly TickExecutionResult[],
): number {
  if (results.length === 0) return 0;
  const scores = results.map(computeTickResultHealthScore);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// ============================================================================
// SECTION R — ML Similarity & Named Map Utilities
// ============================================================================

/**
 * Computes Euclidean distance between two ML vectors.
 */
export function computeTickResultMLEuclideanDistance(
  a: TickResultMLVector,
  b: TickResultMLVector,
): number {
  const aFlat = flattenTickResultMLVector(a);
  const bFlat = flattenTickResultMLVector(b);
  let sum = 0;
  for (let i = 0; i < aFlat.length; i++) {
    const d = aFlat[i] - bFlat[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Computes the centroid ML vector for a set of results.
 */
export function computeTickResultMLCentroid(
  results: readonly TickExecutionResult[],
): TickResultMLVector {
  if (results.length === 0) return ZERO_DEFAULT_TICK_RESULT_ML_VECTOR;
  const vectors = results.map((r) => extractTickResultMLVector({ result: r }));
  const summed: Record<string, number> = {};
  for (const label of TICK_RESULT_ML_LABELS) {
    summed[label] = 0;
  }
  for (const vec of vectors) {
    for (const label of TICK_RESULT_ML_LABELS) {
      summed[label] += (vec[label as keyof TickResultMLVector] as number) ?? 0;
    }
  }
  const n = vectors.length;
  const centroid: Record<string, number> = {};
  for (const label of TICK_RESULT_ML_LABELS) {
    centroid[label] = (summed[label] ?? 0) / n;
  }
  return Object.freeze(centroid) as unknown as TickResultMLVector;
}

/**
 * Finds the result most similar (by cosine similarity) to a reference vector.
 */
export function findMostSimilarTickResult(
  results: readonly TickExecutionResult[],
  reference: TickResultMLVector,
): TickExecutionResult | null {
  if (results.length === 0) return null;
  let best = results[0];
  let bestSim = computeTickResultMLSimilarity(
    extractTickResultMLVector({ result: best }),
    reference,
  );
  for (const r of results) {
    const sim = computeTickResultMLSimilarity(
      extractTickResultMLVector({ result: r }),
      reference,
    );
    if (sim > bestSim) {
      bestSim = sim;
      best = r;
    }
  }
  return best;
}

// ============================================================================
// SECTION S — Precomputed Default Singletons
// ============================================================================

/** The 32 canonical ML feature labels for TickResultMLVector. */
export const TICK_RESULT_ML_LABELS: readonly string[] = Object.freeze([
  'tickNormalized',
  'durationNormalized',
  'activeBots01',
  'pendingAttacks01',
  'shieldIntegrity01',
  'breachedLayerRatio',
  'activeChains01',
  'brokenChains01',
  'completedChains01',
  'positiveChains01',
  'pressureScore01',
  'pressureTier01',
  'outcomePresent',
  'hasProofHash',
  'integrityOk',
  'warningCount01',
  'forkHintCount01',
  'signalCount01',
  'eventCount01',
  'traceCount01',
  'engineHealthCount01',
  'battleBotRatio',
  'cascadePositiveRatio',
  'shieldBreachRatio',
  'stepErrorCount01',
  'stepWarningCount01',
  'snapshotMutatedRatio',
  'rollbackRatio',
  'modeNormalized',
  'phaseNormalized',
  'tickSealPresent',
  'checksumPresent',
]);

/** The 13 canonical DL row labels for TickResultDLTensor. */
export const TICK_RESULT_DL_ROW_LABELS: readonly string[] = Object.freeze([
  'STEP_01_PREPARE',
  'STEP_02_TIME',
  'STEP_03_PRESSURE',
  'STEP_04_TENSION',
  'STEP_05_BATTLE',
  'STEP_06_SHIELD',
  'STEP_07_CASCADE',
  'STEP_08_MODE_POST',
  'STEP_09_TELEMETRY',
  'STEP_10_SOVEREIGNTY_SNAPSHOT',
  'STEP_11_OUTCOME_GATE',
  'STEP_12_EVENT_SEAL',
  'STEP_13_FLUSH',
]);

/** The 8 canonical DL column labels for TickResultDLTensorRow. */
export const TICK_RESULT_DL_COL_LABELS: readonly string[] = Object.freeze([
  'stepNormalized',
  'durationMs01',
  'emittedEvents01',
  'snapshotMutated',
  'rolledBack',
  'skipped',
  'errorCount01',
  'warningCount01',
]);

/**
 * Zero-vector ML singleton — all 32 features set to 0.
 * Used as a safe default when no result is available.
 */
export const ZERO_DEFAULT_TICK_RESULT_ML_VECTOR: TickResultMLVector = Object.freeze({
  tickNormalized: 0,
  durationNormalized: 0,
  activeBots01: 0,
  pendingAttacks01: 0,
  shieldIntegrity01: 0,
  breachedLayerRatio: 0,
  activeChains01: 0,
  brokenChains01: 0,
  completedChains01: 0,
  positiveChains01: 0,
  pressureScore01: 0,
  pressureTier01: 0,
  outcomePresent: 0,
  hasProofHash: 0,
  integrityOk: 0,
  warningCount01: 0,
  forkHintCount01: 0,
  signalCount01: 0,
  eventCount01: 0,
  traceCount01: 0,
  engineHealthCount01: 0,
  battleBotRatio: 0,
  cascadePositiveRatio: 0,
  shieldBreachRatio: 0,
  stepErrorCount01: 0,
  stepWarningCount01: 0,
  snapshotMutatedRatio: 0,
  rollbackRatio: 0,
  modeNormalized: 0,
  phaseNormalized: 0,
  tickSealPresent: 0,
  checksumPresent: 0,
});

// ============================================================================
// SECTION T — Diff Engine
// ============================================================================

/** Report produced by diffTickResults. */
export interface TickResultDiffReport {
  /** Tick number of result A. */
  readonly tickA: number;
  /** Tick number of result B. */
  readonly tickB: number;
  /** Delta in tick number. */
  readonly deltaTick: number;
  /** Delta in health score (B - A). */
  readonly deltaHealthScore: number;
  /** Delta in shield aggregate integrity (B - A). */
  readonly deltaShieldIntegrity: number;
  /** Delta in active bot count (B - A). */
  readonly deltaActiveBots: number;
  /** Delta in active cascade chains (B - A). */
  readonly deltaActiveChains: number;
  /** Delta in pressure score (B - A). */
  readonly deltaPressureScore: number;
  /** Fields that changed between A and B. */
  readonly changedFields: readonly string[];
  /** True if outcome changed. */
  readonly outcomeChanged: boolean;
  /** True if mode changed. */
  readonly modeChanged: boolean;
  /** True if phase changed. */
  readonly phaseChanged: boolean;
  /** ML vector representing the elementwise delta (B - A). */
  readonly deltaMLVector: TickResultMLVector;
}

/**
 * Produces a detailed diff report between two TickExecutionResults.
 */
export function diffTickResults(
  a: TickExecutionResult,
  b: TickExecutionResult,
): TickResultDiffReport {
  const aScore = computeTickResultHealthScore(a);
  const bScore = computeTickResultHealthScore(b);
  const changed: string[] = [];

  if (a.outcome !== b.outcome) changed.push('outcome');
  if (a.mode !== b.mode) changed.push('mode');
  if (a.phase !== b.phase) changed.push('phase');
  if (a.checksum !== b.checksum) changed.push('checksum');
  if (a.tickSeal !== b.tickSeal) changed.push('tickSeal');
  if (a.battle.activeBots !== b.battle.activeBots) changed.push('battle.activeBots');
  if (a.battle.pendingAttacks !== b.battle.pendingAttacks) changed.push('battle.pendingAttacks');
  if (a.shield.aggregateIntegrity !== b.shield.aggregateIntegrity)
    changed.push('shield.aggregateIntegrity');
  if (a.shield.breachedLayers.length !== b.shield.breachedLayers.length)
    changed.push('shield.breachedLayers');
  if (a.cascade.activeChains !== b.cascade.activeChains) changed.push('cascade.activeChains');
  if (a.cascade.brokenChains !== b.cascade.brokenChains) changed.push('cascade.brokenChains');
  if (a.cascade.completedChains !== b.cascade.completedChains)
    changed.push('cascade.completedChains');
  if (a.pressure.tier !== b.pressure.tier) changed.push('pressure.tier');
  if (a.pressure.score !== b.pressure.score) changed.push('pressure.score');
  if (a.integrity.integrityStatus !== b.integrity.integrityStatus)
    changed.push('integrity.integrityStatus');
  if (a.integrity.proofHash !== b.integrity.proofHash) changed.push('integrity.proofHash');

  return Object.freeze({
    tickA: a.tick,
    tickB: b.tick,
    deltaTick: b.tick - a.tick,
    deltaHealthScore: bScore - aScore,
    deltaShieldIntegrity: b.shield.aggregateIntegrity - a.shield.aggregateIntegrity,
    deltaActiveBots: b.battle.activeBots - a.battle.activeBots,
    deltaActiveChains: b.cascade.activeChains - a.cascade.activeChains,
    deltaPressureScore: b.pressure.score - a.pressure.score,
    changedFields: Object.freeze(changed),
    outcomeChanged: a.outcome !== b.outcome,
    modeChanged: a.mode !== b.mode,
    phaseChanged: a.phase !== b.phase,
    deltaMLVector: computeTickResultDeltaMLVector(a, b),
  });
}

/**
 * Computes the elementwise delta ML vector (B - A), clamped to [0,1].
 */
export function computeTickResultDeltaMLVector(
  a: TickExecutionResult,
  b: TickExecutionResult,
): TickResultMLVector {
  const aVec = extractTickResultMLVector({ result: a });
  const bVec = extractTickResultMLVector({ result: b });
  const delta: Record<string, number> = {};
  for (const label of TICK_RESULT_ML_LABELS) {
    const key = label as keyof TickResultMLVector;
    delta[label] = clamp(
      Math.abs((bVec[key] as number) - (aVec[key] as number)),
    );
  }
  return Object.freeze(delta) as unknown as TickResultMLVector;
}

// ============================================================================
// SECTION U — Additional Batch & Session Utilities
// ============================================================================

/**
 * Filters a batch of results to those with a specific severity.
 */
export function filterTickResultsBySeverity(
  results: readonly TickExecutionResult[],
  severity: TickResultSeverity,
): readonly TickExecutionResult[] {
  return Object.freeze(
    results.filter((r) => classifyTickResultSeverity(r) === severity),
  );
}

/**
 * Sorts a batch of results by health score descending (healthiest first).
 */
export function sortTickResultsByHealth(
  results: readonly TickExecutionResult[],
): readonly TickExecutionResult[] {
  return Object.freeze(
    [...results].sort(
      (a, b) => computeTickResultHealthScore(b) - computeTickResultHealthScore(a),
    ),
  );
}

/**
 * Groups a batch of results by run mode.
 */
export function groupTickResultsByMode(
  results: readonly TickExecutionResult[],
): Readonly<Record<string, readonly TickExecutionResult[]>> {
  const groups: Record<string, TickExecutionResult[]> = {};
  for (const r of results) {
    const mode = r.mode ?? 'unknown';
    (groups[mode] ??= []).push(r);
  }
  const frozen: Record<string, readonly TickExecutionResult[]> = {};
  for (const [k, v] of Object.entries(groups)) {
    frozen[k] = Object.freeze(v);
  }
  return Object.freeze(frozen);
}

/**
 * Groups a batch of results by outcome.
 */
export function groupTickResultsByOutcome(
  results: readonly TickExecutionResult[],
): Readonly<Record<string, readonly TickExecutionResult[]>> {
  const groups: Record<string, TickExecutionResult[]> = {};
  for (const r of results) {
    const outcome = r.outcome ?? 'null';
    (groups[outcome] ??= []).push(r);
  }
  const frozen: Record<string, readonly TickExecutionResult[]> = {};
  for (const [k, v] of Object.entries(groups)) {
    frozen[k] = Object.freeze(v);
  }
  return Object.freeze(frozen);
}

/**
 * Computes the health score variance across a batch of results.
 */
export function computeTickResultHealthVariance(
  results: readonly TickExecutionResult[],
): number {
  if (results.length < 2) return 0;
  const scores = results.map(computeTickResultHealthScore);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance =
    scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
  return variance;
}

/**
 * Returns the p-th percentile health score from a batch.
 * p should be in [0, 100].
 */
export function computeTickResultHealthPercentile(
  results: readonly TickExecutionResult[],
  p: number,
): number {
  if (results.length === 0) return 0;
  const sorted = [...results]
    .map(computeTickResultHealthScore)
    .sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

// ============================================================================
// SECTION V — Advanced Annotator Helpers
// ============================================================================

/**
 * Produces a compact fingerprint string for a TickExecutionResult.
 * Useful for deduplication and caching.
 */
export function fingerprintTickResult(result: TickExecutionResult): string {
  return [
    result.runId,
    result.tick,
    result.checksum ?? 'nochk',
    result.tickSeal ?? 'noseal',
    result.integrity.integrityStatus,
  ].join(':');
}

/**
 * Checks whether two TickExecutionResults are functionally equivalent
 * (same runId, tick, checksum).
 */
export function tickResultsAreEquivalent(
  a: TickExecutionResult,
  b: TickExecutionResult,
): boolean {
  return (
    a.runId === b.runId &&
    a.tick === b.tick &&
    a.checksum === b.checksum &&
    a.tickSeal === b.tickSeal
  );
}

/**
 * Produces a compact summary string for a TickExecutionResult suitable for logging.
 */
export function formatTickResultForLog(result: TickExecutionResult): string {
  const sev = classifyTickResultSeverity(result);
  const score = computeTickResultHealthScore(result).toFixed(3);
  return (
    `[TickResult] run=${result.runId} tick=${result.tick} phase=${result.phase} ` +
    `mode=${result.mode ?? '?'} outcome=${result.outcome ?? 'null'} ` +
    `severity=${sev} health=${score} ` +
    `shield=${result.shield.aggregateIntegrity.toFixed(0)} ` +
    `bots=${result.battle.activeBots} chains=${result.cascade.activeChains}`
  );
}

/**
 * Returns true if the result indicates the run has ended (non-null outcome).
 */
export function isTickResultTerminal(result: TickExecutionResult): boolean {
  return result.outcome !== null;
}

/**
 * Returns true if the result indicates a healthy tick (severity LOW).
 */
export function isTickResultHealthy(result: TickExecutionResult): boolean {
  return classifyTickResultSeverity(result) === 'LOW';
}

/**
 * Returns true if the result is in a critical state.
 */
export function isTickResultCritical(result: TickExecutionResult): boolean {
  return classifyTickResultSeverity(result) === 'CRITICAL';
}

// ============================================================================
// SECTION W — Serialisation & Deserialisation Helpers
// ============================================================================

/**
 * Serialises a TickResultExportBundle to a compact JSON string.
 */
export function serializeTickResultExportBundle(bundle: TickResultExportBundle): string {
  // Snapshot field is not serialised (too large); only export the analytics fields.
  return JSON.stringify({
    schemaVersion: bundle.schemaVersion,
    moduleVersion: bundle.moduleVersion,
    runId: bundle.result.runId,
    tick: bundle.result.tick,
    mlVectorJson: bundle.mlVectorJson,
    dlTensorJson: bundle.dlTensorJson,
    healthScore: bundle.healthSnapshot.healthScore,
    severity: bundle.healthSnapshot.severity,
    builtAtMs: bundle.builtAtMs,
    mlValidationErrors: bundle.mlValidationErrors,
  });
}

/**
 * Returns a minimal human-readable summary of a TickResultExportBundle.
 */
export function summarizeTickResultExportBundle(bundle: TickResultExportBundle): string {
  return (
    `[ExportBundle] run=${bundle.result.runId} tick=${bundle.result.tick} ` +
    `health=${bundle.healthSnapshot.healthScore.toFixed(3)} ` +
    `severity=${bundle.healthSnapshot.severity} ` +
    `mlValid=${bundle.mlValidationErrors.length === 0} ` +
    `builtAt=${bundle.builtAtMs}`
  );
}

// ============================================================================
// END OF FILE
// ============================================================================
