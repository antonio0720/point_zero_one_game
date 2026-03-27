/* ========================================================================
 * POINT ZERO ONE — BACKEND TENSION ENGINE BARREL (v3)
 * /backend/src/game/engine/tension/index.ts
 *
 * Canonical public surface for the Tension Engine subsystem (Engine 3 of 7).
 *
 * This barrel does four things:
 *   1. Re-exports the full public API of every tension module
 *   2. Provides factory functions and subsystem wiring helpers
 *   3. Exposes ML/DL orchestration — unified feature extraction across
 *      all tension submodules
 *   4. Self-test suite for CI and runtime integrity checks
 *
 * Doctrine:
 *   - Tension is NOT Pressure. Pressure is time scarcity; Tension is the
 *     psychological weight of known-but-unstoppable incoming threats.
 *   - The Tension Engine runs at STEP_04_TENSION in the tick sequence.
 *   - It reads threat state and pressure tier. NEVER writes game state.
 *   - All outbound signals flow via TensionUXBridge → EventBus.emit().
 *   - The Tension Score is a psychological signal with NO direct mechanical
 *     consequence. Mechanical consequences belong to Pressure/Cascade engines.
 *   - The Anticipation Pulse fires when tension >= 0.90 for PULSE_SUSTAINED_TICKS.
 *     It is a UI/audio event — NOT a game state mutation.
 *
 * Usage:
 *   import { Tension } from '../../engine';
 *   const engine = new Tension.TensionEngine();
 *   const subsystem = Tension.buildTensionSubsystem();
 *   const snapshot = engine.getRuntimeSnapshot();
 *   const mlVec = engine.extractMLVector();
 *   const narrative = engine.generateNarrative();
 *   const forecast = engine.computeRecoveryForecast();
 *   const recommendations = engine.computeMitigationRecommendations();
 *   const health = Tension.computeTensionSubsystemHealth();
 *   const selfTest = Tension.runTensionSubsystemSelfTest();
 * ====================================================================== */

import { createHash } from 'node:crypto';

// ── Types, constants, and runtime utilities ───────────────────────────────
export * from './types';

// ── AnticipationQueue — threat scheduling and lifecycle ───────────────────
export * from './AnticipationQueue';

// ── ThreatVisibilityManager — information exposure control ───────────────
export * from './ThreatVisibilityManager';

// ── TensionDecayController — score accumulation and decay math ───────────
export * from './TensionDecayController';

// ── TensionUXBridge — event broadcasting to frontend/audio ───────────────
export * from './TensionUXBridge';

// ── TensionThreatProjector — queue → ThreatEnvelope projection ───────────
export * from './TensionThreatProjector';

// ── TensionThreatSourceAdapter — snapshot → threat discovery ─────────────
export * from './TensionThreatSourceAdapter';

// ── TensionMetricsCollector — higher-order operational metrics ────────────
export * from './TensionMetricsCollector';

// ── TensionPolicyResolver — centralized policy decisions ─────────────────
export * from './TensionPolicyResolver';

// ── TensionSnapshotAdapter — runtime → RunStateSnapshot bridge ───────────
export * from './TensionSnapshotAdapter';

// ── TensionEngine v2 — core orchestrator with ML/DL/UX/analytics ─────────
export * from './TensionEngine';

// ─────────────────────────────────────────────────────────────────────────────
// RUNTIME IMPORTS — every symbol below must appear in at least one
// exported function body in this file.
// ─────────────────────────────────────────────────────────────────────────────

import {
  TENSION_CONSTANTS,
  TENSION_VISIBILITY_STATE,
  THREAT_TYPE,
  THREAT_SEVERITY,
  ENTRY_STATE,
  VISIBILITY_CONFIGS,
  PRESSURE_TENSION_AMPLIFIERS,
  THREAT_SEVERITY_WEIGHTS,
  THREAT_TYPE_DEFAULT_MITIGATIONS,
  INTERNAL_VISIBILITY_TO_ENVELOPE,
  VISIBILITY_ORDER,
  TENSION_EVENT_NAMES,
  computeFullDecayResult,
  createAnticipationEntry,
  createScoreUpdatedEvent,
  generateFullTensionNarrative,
  validateAnticipationEntry,
  validateTensionRuntimeSnapshot,
  clampTensionScore,
  computeTypeMLFeatureVector,
  runTypesSelfTest,
  severityToWeight,
  defaultMitigationsForType,
  visibilityConfig,
  pressureAmplifier,
  snapshotUrgencyTier,
  serializeAnticipationEntry,
  computeEntryChecksum,
  type AnticipationEntry,
  type QueueUpsertInput,
  type TensionRuntimeSnapshot,
  type TensionVisibilityState,
  type ThreatType,
  type ThreatSeverity,
  type EntryState,
  type DecayComputeInput,
  type DecayComputeResult,
  type DecayContributionBreakdown,
  type PressureTier,
  type ThreatEnvelope,
  type VisibilityLevel,
  type VisibilityConfig,
  type TensionScoreUpdatedEvent,
  type TensionVisibilityChangedEvent,
  type TensionPulseFiredEvent,
  type ThreatArrivedEvent,
  type ThreatMitigatedEvent,
  type ThreatExpiredEvent,
  type AnticipationQueueUpdatedEvent,
} from './types';

import { AnticipationQueue } from './AnticipationQueue';
import { ThreatVisibilityManager } from './ThreatVisibilityManager';
import { TensionDecayController } from './TensionDecayController';
import { TensionThreatProjector } from './TensionThreatProjector';
import { TensionThreatSourceAdapter } from './TensionThreatSourceAdapter';
import { TensionMetricsCollector } from './TensionMetricsCollector';
import { TensionPolicyResolver } from './TensionPolicyResolver';
import { TensionSnapshotAdapter } from './TensionSnapshotAdapter';
import { TensionEngine } from './TensionEngine';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — SUBSYSTEM VERSION AND SYSTEM-LEVEL CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical version string for the entire tension subsystem. */
export const TENSION_SUBSYSTEM_VERSION = '2026.03.26' as const;

/** Engine position in the 7-engine simulation stack. */
export const TENSION_ENGINE_POSITION = 3 as const;

/** Total engines in the simulation stack. */
export const TENSION_ENGINE_TOTAL = 7 as const;

/** Orchestrator step key for Engine 3. */
export const TENSION_ENGINE_STEP_KEY = 'STEP_04_TENSION' as const;

/**
 * Maximum number of simultaneous active threats before the system issues a
 * backlog-overflow warning. Derived from PULSE_SUSTAINED_TICKS × 2.
 */
export const TENSION_MAX_ACTIVE_THREATS =
  TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS * 2 * 4; // 24

/**
 * Score at which the tension engine begins broadcasting pulse events.
 * Mirrors TENSION_CONSTANTS.PULSE_THRESHOLD for external consumers.
 */
export const TENSION_PULSE_SCORE = TENSION_CONSTANTS.PULSE_THRESHOLD;

/**
 * The full set of event names emitted by the tension subsystem.
 * Consumers can subscribe to any of these via EventBus.on().
 */
export const TENSION_SUBSYSTEM_EVENTS = Object.freeze({
  SCORE_UPDATED: TENSION_EVENT_NAMES.SCORE_UPDATED,
  VISIBILITY_CHANGED: TENSION_EVENT_NAMES.VISIBILITY_CHANGED,
  QUEUE_UPDATED: TENSION_EVENT_NAMES.QUEUE_UPDATED,
  PULSE_FIRED: TENSION_EVENT_NAMES.PULSE_FIRED,
  THREAT_ARRIVED: TENSION_EVENT_NAMES.THREAT_ARRIVED,
  THREAT_MITIGATED: TENSION_EVENT_NAMES.THREAT_MITIGATED,
  THREAT_EXPIRED: TENSION_EVENT_NAMES.THREAT_EXPIRED,
  UPDATED_LEGACY: TENSION_EVENT_NAMES.UPDATED_LEGACY,
});

/**
 * All threat types recognized by the tension subsystem, as a frozen array
 * ordered by escalation potential (weakest → most dangerous).
 */
export const TENSION_ALL_THREAT_TYPES = Object.freeze([
  THREAT_TYPE.REPUTATION_BURN,
  THREAT_TYPE.OPPORTUNITY_KILL,
  THREAT_TYPE.HATER_INJECTION,
  THREAT_TYPE.SABOTAGE,
  THREAT_TYPE.SHIELD_PIERCE,
  THREAT_TYPE.DEBT_SPIRAL,
  THREAT_TYPE.CASCADE,
  THREAT_TYPE.SOVEREIGNTY,
]) as readonly ThreatType[];

/**
 * All threat severities ordered by weight ascending.
 */
export const TENSION_ALL_SEVERITIES = Object.freeze([
  THREAT_SEVERITY.MINOR,
  THREAT_SEVERITY.MODERATE,
  THREAT_SEVERITY.SEVERE,
  THREAT_SEVERITY.CRITICAL,
  THREAT_SEVERITY.EXISTENTIAL,
]) as readonly ThreatSeverity[];

/**
 * All visibility states ordered from lowest to highest exposure.
 */
export const TENSION_ALL_VISIBILITY_STATES = Object.freeze([
  TENSION_VISIBILITY_STATE.SHADOWED,
  TENSION_VISIBILITY_STATE.SIGNALED,
  TENSION_VISIBILITY_STATE.TELEGRAPHED,
  TENSION_VISIBILITY_STATE.EXPOSED,
]) as readonly TensionVisibilityState[];

/**
 * All pressure tiers ordered by magnitude.
 */
export const TENSION_ALL_PRESSURE_TIERS = Object.freeze([
  'T0', 'T1', 'T2', 'T3', 'T4',
]) as readonly PressureTier[];

/**
 * Pressure amplifier lookup table surfaced at the subsystem level.
 * Mirrors PRESSURE_TENSION_AMPLIFIERS for external consumers.
 */
export const TENSION_PRESSURE_AMPLIFIER_TABLE = Object.freeze({
  ...PRESSURE_TENSION_AMPLIFIERS,
}) as Readonly<Record<PressureTier, number>>;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — CORE SUBSYSTEM TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A fully wired Tension subsystem bundle. Created by buildTensionSubsystem().
 * Owns all subcomponents; callers should cache and reuse this for a given run.
 */
export interface TensionSubsystem {
  readonly engine: TensionEngine;
  readonly metricsCollector: TensionMetricsCollector;
  readonly snapshotAdapter: TensionSnapshotAdapter;
  readonly policyResolver: TensionPolicyResolver;
  readonly sourceAdapter: TensionThreatSourceAdapter;
  readonly version: string;
  readonly createdAtMs: number;
}

/**
 * Unified ML bundle produced by extractTensionMLBundle().
 * Contains feature vectors from all major tension submodules.
 */
export interface TensionUnifiedMLBundle {
  readonly engineVector: readonly number[];
  readonly engineLabels: readonly string[];
  readonly featureCount: number;
  readonly tickNumber: number;
  readonly timestamp: number;
  readonly subsystemVersion: string;
  readonly signature: string;
}

/**
 * Tension system health report produced by computeTensionSubsystemHealth().
 */
export interface TensionSubsystemHealth {
  readonly subsystemVersion: string;
  readonly engineStep: string;
  readonly enginePosition: number;
  readonly constantsIntact: boolean;
  readonly pulseScopeValid: boolean;
  readonly visibilityOrderValid: boolean;
  readonly pressureAmplifiersValid: boolean;
  readonly severityWeightsValid: boolean;
  readonly defaultMitigationsValid: boolean;
  readonly envelopeMappingValid: boolean;
  readonly eventNamesValid: boolean;
  readonly entryStatesValid: boolean;
  readonly maxThreatCountValid: boolean;
  readonly overallHealthy: boolean;
  readonly checkedAt: number;
}

/**
 * Session aggregate produced by aggregateTensionSessionMetrics().
 */
export interface TensionSessionAggregate {
  readonly snapshotCount: number;
  readonly peakScore: number;
  readonly troughScore: number;
  readonly averageScore: number;
  readonly totalPulseTicks: number;
  readonly totalArrivals: number;
  readonly totalExpirations: number;
  readonly totalMitigations: number;
  readonly dominantVisibilityState: TensionVisibilityState;
  readonly escalationRatio: number;
  readonly averageQueueLength: number;
  readonly maxQueueLength: number;
  readonly scoreVolatility: number;
  readonly averageAmplifiedDelta: number;
  readonly subsystemVersion: string;
}

/**
 * A single threat recommendation entry produced by computeSubsystemRecommendations().
 */
export interface TensionThreatRecommendation {
  readonly entryId: string;
  readonly threatType: ThreatType;
  readonly threatSeverity: ThreatSeverity;
  readonly severityWeight: number;
  readonly urgencyScore: number;
  readonly recommendedMitigations: readonly string[];
  readonly isArrived: boolean;
  readonly ticksUntilArrival: number | null;
  readonly worstCaseOutcome: string;
  readonly visibilityLevel: VisibilityLevel;
  readonly chatPrompt: string;
}

/**
 * Full tension subsystem self-test result.
 */
export interface TensionSubsystemSelfTestResult {
  readonly passed: boolean;
  readonly checks: readonly string[];
  readonly failures: readonly string[];
  readonly durationMs: number;
  readonly subsystemVersion: string;
  readonly typesTestPassed: boolean;
  readonly constantsTestPassed: boolean;
  readonly factoriesTestPassed: boolean;
  readonly mlOrchestrationTestPassed: boolean;
  readonly healthTestPassed: boolean;
}

/**
 * Export bundle for external persistence/analytics consumers.
 */
export interface TensionSubsystemExportBundle {
  readonly subsystemVersion: string;
  readonly exportedAtMs: number;
  readonly health: TensionSubsystemHealth;
  readonly constantsSnapshot: {
    readonly queuedPerTick: number;
    readonly arrivedPerTick: number;
    readonly expiredGhostPerTick: number;
    readonly mitigationDecayPerTick: number;
    readonly nullifyDecayPerTick: number;
    readonly emptyQueueDecay: number;
    readonly sovereigntyBonusDecay: number;
    readonly pulseThreshold: number;
    readonly pulseSustainedTicks: number;
    readonly maxActiveThreats: number;
  };
  readonly signature: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — FACTORY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new TensionEngine instance with default configuration.
 * The engine is ready to receive tick() calls immediately.
 */
export function createTensionEngine(): TensionEngine {
  return new TensionEngine();
}

/**
 * Creates a new AnticipationQueue instance.
 */
export function createAnticipationQueue(): AnticipationQueue {
  return new AnticipationQueue();
}

/**
 * Creates a new ThreatVisibilityManager instance.
 */
export function createThreatVisibilityManager(): ThreatVisibilityManager {
  return new ThreatVisibilityManager();
}

/**
 * Creates a new TensionDecayController instance.
 */
export function createTensionDecayController(): TensionDecayController {
  return new TensionDecayController();
}

/**
 * Creates a new TensionThreatProjector instance.
 */
export function createTensionThreatProjector(): TensionThreatProjector {
  return new TensionThreatProjector();
}

/**
 * Creates a new TensionThreatSourceAdapter instance.
 */
export function createTensionThreatSourceAdapter(): TensionThreatSourceAdapter {
  return new TensionThreatSourceAdapter();
}

/**
 * Creates a new TensionMetricsCollector instance with optional history capacity.
 * Defaults to METRICS_HISTORY_CAPACITY if no capacity provided.
 */
export function createTensionMetricsCollector(capacity?: number): TensionMetricsCollector {
  return new TensionMetricsCollector(capacity);
}

/**
 * Creates a new TensionPolicyResolver instance.
 */
export function createTensionPolicyResolver(): TensionPolicyResolver {
  return new TensionPolicyResolver();
}

/**
 * Creates a new TensionSnapshotAdapter instance.
 */
export function createTensionSnapshotAdapter(): TensionSnapshotAdapter {
  return new TensionSnapshotAdapter();
}

/**
 * Builds a fully wired TensionSubsystem bundle.
 *
 * The returned bundle is the canonical way to access Engine 3 capabilities
 * in the orchestrator tick sequence. All subcomponents share no state by
 * default — they coordinate only through the RunStateSnapshot passed at
 * each tick boundary.
 *
 * @returns {TensionSubsystem} A fully initialized tension subsystem.
 */
export function buildTensionSubsystem(): TensionSubsystem {
  const engine = createTensionEngine();
  const metricsCollector = createTensionMetricsCollector();
  const snapshotAdapter = createTensionSnapshotAdapter();
  const policyResolver = createTensionPolicyResolver();
  const sourceAdapter = createTensionThreatSourceAdapter();

  return Object.freeze({
    engine,
    metricsCollector,
    snapshotAdapter,
    policyResolver,
    sourceAdapter,
    version: TENSION_SUBSYSTEM_VERSION,
    createdAtMs: Date.now(),
  }) as TensionSubsystem;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — ML/DL ORCHESTRATION LAYER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the feature signature SHA-256 checksum for a set of ML feature values.
 * Used to detect stale or corrupted feature vectors in persistence pipelines.
 *
 * @param features - The numeric feature vector to hash.
 * @returns A 16-character hex signature derived from SHA-256 of the features.
 */
export function computeTensionFeatureSignature(features: readonly number[]): string {
  const payload = features.map((v) => v.toFixed(8)).join(',');
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

/**
 * Merges multiple 32-dimensional ML feature vectors into a single ensemble
 * by computing the element-wise mean. Produces a stable representation
 * across submodule contributions.
 *
 * @param vectors - Array of feature vectors; each must have the same length.
 * @returns Element-wise mean vector.
 */
export function mergeTensionMLVectors(vectors: readonly (readonly number[])[]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0]!.length;
  const result = new Array<number>(dim).fill(0);
  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      result[i]! += (vec[i] ?? 0) / vectors.length;
    }
  }
  return result;
}

/**
 * Computes feature importance scores by measuring the absolute deviation
 * of each feature from the ensemble mean. High-deviation features carry
 * more discriminative signal for downstream ML.
 *
 * @param vectors - Array of feature vectors from multiple submodules.
 * @returns Per-feature importance scores (0 = uniform, higher = more varied).
 */
export function computeTensionFeatureImportance(
  vectors: readonly (readonly number[])[],
): number[] {
  if (vectors.length === 0) return [];
  const mean = mergeTensionMLVectors(vectors);
  const dim = mean.length;
  const importance = new Array<number>(dim).fill(0);
  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      importance[i]! += Math.abs((vec[i] ?? 0) - (mean[i] ?? 0));
    }
  }
  return importance.map((v) => v / vectors.length);
}

/**
 * Builds a unified ML bundle from a runtime snapshot and active entries.
 * Uses TENSION_CONSTANTS, VISIBILITY_ORDER, and PRESSURE_TENSION_AMPLIFIERS
 * in the feature construction.
 *
 * @param snapshot - The current tension runtime snapshot.
 * @param entries - Active anticipation queue entries.
 * @param tier - Current pressure tier for amplification.
 * @returns A TensionUnifiedMLBundle.
 */
export function buildTensionUnifiedMLBundle(
  snapshot: TensionRuntimeSnapshot,
  entries: readonly AnticipationEntry[],
  tier: PressureTier,
): TensionUnifiedMLBundle {
  const visOrdinal = VISIBILITY_ORDER.indexOf(snapshot.visibilityState) / 3;
  const ampValue = PRESSURE_TENSION_AMPLIFIERS[tier];
  const engineVector = computeTypeMLFeatureVector([...entries], snapshot.score, snapshot.visibilityState);
  const tickNumber = snapshot.tickNumber;
  const now = snapshot.timestamp;

  // Append pressure and visibility columns derived from constants
  const extendedVector = [
    ...engineVector,
    clampTensionScore(snapshot.score),
    ampValue,
    visOrdinal,
    snapshot.isPulseActive ? 1 : 0,
    snapshot.arrivedCount / Math.max(1, TENSION_MAX_ACTIVE_THREATS),
    TENSION_CONSTANTS.PULSE_THRESHOLD,
  ];

  const signature = computeTensionFeatureSignature(extendedVector);

  return Object.freeze({
    engineVector: Object.freeze(extendedVector),
    engineLabels: Object.freeze(
      engineVector.map((_, i) => `tension_unified_f${i}`),
    ),
    featureCount: extendedVector.length,
    tickNumber,
    timestamp: now,
    subsystemVersion: TENSION_SUBSYSTEM_VERSION,
    signature,
  });
}

/**
 * Computes a 16×8 DL sequence tensor from a rolling history of snapshots.
 * Each row covers one historical tick; each column maps to a canonical
 * tension feature per TENSION_DL_COLUMN_LABELS.
 *
 * @param history - Ordered list of runtime snapshots (most recent last).
 * @param tier - Current pressure tier.
 * @returns A 2D number array (rows × 8 cols).
 */
export function buildTensionDLSequenceTensor(
  history: readonly TensionRuntimeSnapshot[],
  tier: PressureTier,
): number[][] {
  const ROWS = 16;
  const COLS = 8;
  const amp = PRESSURE_TENSION_AMPLIFIERS[tier];

  const rows: number[][] = [];
  const padded = history.slice(-ROWS);
  while (rows.length < ROWS - padded.length) {
    rows.push(new Array<number>(COLS).fill(0));
  }

  for (const snap of padded) {
    const visOrdinal = VISIBILITY_ORDER.indexOf(snap.visibilityState) / 3;
    rows.push([
      clampTensionScore(snap.score),
      snap.amplifiedDelta,
      snap.queueLength / Math.max(1, TENSION_MAX_ACTIVE_THREATS),
      snap.arrivedCount / Math.max(1, TENSION_MAX_ACTIVE_THREATS),
      visOrdinal,
      snap.isPulseActive ? 1 : 0,
      snap.contributionBreakdown.arrivedThreats,
      amp,
    ]);
  }

  return rows;
}

/**
 * Computes a tensor summary fingerprint by SHA-256 hashing the DL tensor rows.
 * Used for caching and change-detection in the persistence pipeline.
 *
 * @param tensor - A 2D DL sequence tensor.
 * @returns A 16-char hex fingerprint.
 */
export function computeTensionDLTensorChecksum(tensor: readonly (readonly number[])[]): string {
  const flat = tensor.flatMap((row) => row).map((v) => v.toFixed(6)).join(',');
  return createHash('sha256').update(flat).digest('hex').slice(0, 16);
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — HEALTH AND DIAGNOSTICS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates that all tension system constants are structurally intact.
 * Any corruption here would indicate a code-bundling or tree-shaking error.
 *
 * @returns true if every constant has its expected shape.
 */
export function areTensionConstantsIntact(): boolean {
  // TENSION_CONSTANTS checks
  if (TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK !== 0.12) return false;
  if (TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK !== 0.2) return false;
  if (TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK !== 0.08) return false;
  if (TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK !== 0.08) return false;
  if (TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK !== 0.04) return false;
  if (TENSION_CONSTANTS.EMPTY_QUEUE_DECAY !== 0.05) return false;
  if (TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY !== 0.15) return false;
  if (TENSION_CONSTANTS.PULSE_THRESHOLD !== 0.9) return false;
  if (TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS !== 3) return false;
  if (TENSION_CONSTANTS.MIN_SCORE !== 0) return false;
  if (TENSION_CONSTANTS.MAX_SCORE !== 1) return false;
  return true;
}

/**
 * Validates that the VISIBILITY_ORDER array and VISIBILITY_CONFIGS map
 * agree with each other and with TENSION_VISIBILITY_STATE.
 */
export function isVisibilityOrderValid(): boolean {
  if (VISIBILITY_ORDER.length !== 4) return false;
  const states = Object.values(TENSION_VISIBILITY_STATE);
  for (const state of states) {
    if (!VISIBILITY_ORDER.includes(state)) return false;
    if (!(state in VISIBILITY_CONFIGS)) return false;
  }
  return true;
}

/**
 * Validates that PRESSURE_TENSION_AMPLIFIERS covers all five pressure tiers
 * and all values are between 1.0 and 2.0.
 */
export function arePressureAmplifiersValid(): boolean {
  const tiers: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
  for (const tier of tiers) {
    const amp = PRESSURE_TENSION_AMPLIFIERS[tier];
    if (typeof amp !== 'number') return false;
    if (amp < 1.0 || amp > 2.0) return false;
  }
  return true;
}

/**
 * Validates that THREAT_SEVERITY_WEIGHTS covers all five severities
 * and all weights are in [0, 1].
 */
export function areSeverityWeightsValid(): boolean {
  const severities = Object.values(THREAT_SEVERITY);
  for (const sev of severities) {
    const w = THREAT_SEVERITY_WEIGHTS[sev];
    if (typeof w !== 'number') return false;
    if (w < 0 || w > 1) return false;
  }
  return true;
}

/**
 * Validates that THREAT_TYPE_DEFAULT_MITIGATIONS covers all eight threat types
 * and each has at least one mitigation option.
 */
export function areDefaultMitigationsValid(): boolean {
  const types = Object.values(THREAT_TYPE);
  for (const type of types) {
    const mitigations = THREAT_TYPE_DEFAULT_MITIGATIONS[type];
    if (!Array.isArray(mitigations) && !Array.isArray([...mitigations])) return false;
    const arr = [...mitigations];
    if (arr.length === 0) return false;
  }
  return true;
}

/**
 * Validates that INTERNAL_VISIBILITY_TO_ENVELOPE covers all four internal
 * visibility states and maps each to a valid VisibilityLevel.
 */
export function isEnvelopeMappingValid(): boolean {
  const validLevels: VisibilityLevel[] = ['HIDDEN', 'SILHOUETTE', 'PARTIAL', 'EXPOSED'];
  const states = Object.values(TENSION_VISIBILITY_STATE);
  for (const state of states) {
    const level = INTERNAL_VISIBILITY_TO_ENVELOPE[state];
    if (!validLevels.includes(level)) return false;
  }
  return true;
}

/**
 * Validates that TENSION_EVENT_NAMES has all required event keys.
 */
export function areEventNamesValid(): boolean {
  const required = [
    'UPDATED_LEGACY', 'SCORE_UPDATED', 'VISIBILITY_CHANGED',
    'QUEUE_UPDATED', 'PULSE_FIRED', 'THREAT_ARRIVED',
    'THREAT_MITIGATED', 'THREAT_EXPIRED',
  ];
  for (const key of required) {
    if (!(key in TENSION_EVENT_NAMES)) return false;
  }
  return true;
}

/**
 * Validates that ENTRY_STATE covers all required lifecycle states.
 */
export function areEntryStatesValid(): boolean {
  const required = ['QUEUED', 'ARRIVED', 'MITIGATED', 'EXPIRED', 'NULLIFIED'];
  for (const state of required) {
    if (!(state in ENTRY_STATE)) return false;
  }
  return true;
}

/**
 * Computes the full TensionSubsystemHealth report by running all validation
 * checks in sequence. Zero allocation — pure computation.
 *
 * @returns A frozen TensionSubsystemHealth object.
 */
export function computeTensionSubsystemHealth(): TensionSubsystemHealth {
  const constantsIntact = areTensionConstantsIntact();
  const pulseScopeValid = TENSION_CONSTANTS.PULSE_THRESHOLD >= 0.5 &&
    TENSION_CONSTANTS.PULSE_THRESHOLD <= 1.0;
  const visibilityOrderValid = isVisibilityOrderValid();
  const pressureAmplifiersValid = arePressureAmplifiersValid();
  const severityWeightsValid = areSeverityWeightsValid();
  const defaultMitigationsValid = areDefaultMitigationsValid();
  const envelopeMappingValid = isEnvelopeMappingValid();
  const eventNamesValid = areEventNamesValid();
  const entryStatesValid = areEntryStatesValid();
  const maxThreatCountValid = TENSION_MAX_ACTIVE_THREATS > 0;

  const overallHealthy =
    constantsIntact &&
    pulseScopeValid &&
    visibilityOrderValid &&
    pressureAmplifiersValid &&
    severityWeightsValid &&
    defaultMitigationsValid &&
    envelopeMappingValid &&
    eventNamesValid &&
    entryStatesValid &&
    maxThreatCountValid;

  return Object.freeze({
    subsystemVersion: TENSION_SUBSYSTEM_VERSION,
    engineStep: TENSION_ENGINE_STEP_KEY,
    enginePosition: TENSION_ENGINE_POSITION,
    constantsIntact,
    pulseScopeValid,
    visibilityOrderValid,
    pressureAmplifiersValid,
    severityWeightsValid,
    defaultMitigationsValid,
    envelopeMappingValid,
    eventNamesValid,
    entryStatesValid,
    maxThreatCountValid,
    overallHealthy,
    checkedAt: Date.now(),
  }) as TensionSubsystemHealth;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — QUEUE MANAGEMENT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a stable threat entry ID from runId + sourceKey using SHA-256.
 * Deterministic — same inputs always produce the same ID.
 *
 * @param runId - The active run identifier.
 * @param sourceKey - The unique source key for the threat.
 * @returns A 32-char hex ID string.
 */
export function computeThreatEntryId(runId: string, sourceKey: string): string {
  return createHash('sha256')
    .update(`${runId}::${sourceKey}`)
    .digest('hex')
    .slice(0, 32);
}

/**
 * Checks if the given score crosses the pulse threshold defined in
 * TENSION_CONSTANTS. Use this guard before broadcasting pulse events.
 */
export function isTensionPulseActive(score: number): boolean {
  return clampTensionScore(score) >= TENSION_CONSTANTS.PULSE_THRESHOLD;
}

/**
 * Returns the tension pressure amplifier for the given tier, reading
 * directly from PRESSURE_TENSION_AMPLIFIERS.
 */
export function getTensionAmplifier(tier: PressureTier): number {
  return pressureAmplifier(tier);
}

/**
 * Returns the visibility configuration for a given tension visibility state.
 */
export function getTensionVisibilityConfig(state: TensionVisibilityState): VisibilityConfig {
  return visibilityConfig(state);
}

/**
 * Returns the severity weight for a given ThreatSeverity.
 */
export function getThreatSeverityWeight(severity: ThreatSeverity): number {
  return severityToWeight(severity);
}

/**
 * Returns the default mitigation card types for a given ThreatType.
 */
export function getThreatDefaultMitigations(type: ThreatType): readonly string[] {
  return defaultMitigationsForType(type);
}

/**
 * Builds a sorted list of threat recommendations from active queue entries.
 * Sorted by urgency score descending (highest-risk threats first).
 *
 * @param entries - Active anticipation queue entries.
 * @param visibilityState - Current visibility state.
 * @param currentTick - Current simulation tick number.
 * @returns Sorted array of TensionThreatRecommendation.
 */
export function computeSubsystemRecommendations(
  entries: readonly AnticipationEntry[],
  visibilityState: TensionVisibilityState,
  currentTick: number,
): TensionThreatRecommendation[] {
  const config = VISIBILITY_CONFIGS[visibilityState];
  const envelopeLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[visibilityState];

  const recommendations: TensionThreatRecommendation[] = entries
    .filter((e) => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED)
    .map((entry) => {
      const severityWeight = THREAT_SEVERITY_WEIGHTS[entry.threatSeverity];
      const ticksUntil =
        entry.state === ENTRY_STATE.QUEUED
          ? Math.max(0, entry.arrivalTick - currentTick)
          : null;
      const progress =
        entry.arrivalTick > entry.enqueuedAtTick
          ? Math.min(
              1,
              (currentTick - entry.enqueuedAtTick) /
                (entry.arrivalTick - entry.enqueuedAtTick),
            )
          : 1;
      const urgencyScore = severityWeight * (0.5 + 0.5 * progress);

      const recommendedMitigations =
        config.showsMitigationPath
          ? [
              ...entry.mitigationCardTypes,
              ...THREAT_TYPE_DEFAULT_MITIGATIONS[entry.threatType],
            ].filter((v, i, arr) => arr.indexOf(v) === i)
          : entry.mitigationCardTypes;

      const chatPrompt = generateThreatChatPrompt(entry, visibilityState, currentTick);

      return {
        entryId: entry.entryId,
        threatType: entry.threatType,
        threatSeverity: entry.threatSeverity,
        severityWeight,
        urgencyScore,
        recommendedMitigations: Object.freeze(recommendedMitigations),
        isArrived: entry.isArrived,
        ticksUntilArrival: ticksUntil,
        worstCaseOutcome:
          config.showsWorstCase ? entry.worstCaseOutcome : '[REDACTED]',
        visibilityLevel: envelopeLevel,
        chatPrompt,
      };
    })
    .sort((a, b) => b.urgencyScore - a.urgencyScore);

  return recommendations;
}

/**
 * Generates a chat prompt string for a specific threat entry given the
 * current visibility state. The depth of information in the prompt is
 * gated by the visibility config (information asymmetry doctrine).
 *
 * @param entry - The anticipation entry.
 * @param visState - Current tension visibility state.
 * @param tick - Current simulation tick.
 * @returns A human-readable chat prompt string.
 */
export function generateThreatChatPrompt(
  entry: AnticipationEntry,
  visState: TensionVisibilityState,
  tick: number,
): string {
  const config = VISIBILITY_CONFIGS[visState];
  const parts: string[] = [];

  parts.push(`Threat detected [${entry.entryId.slice(0, 8)}]:`);

  if (config.showsThreatType) {
    parts.push(`Type: ${entry.threatType}`);
    parts.push(`Severity: ${entry.threatSeverity}`);
    parts.push(`Weight: ${(THREAT_SEVERITY_WEIGHTS[entry.threatSeverity] * 100).toFixed(0)}%`);
  } else {
    parts.push('Type: [SHADOWED — insufficient visibility]');
  }

  if (config.showsArrivalTick) {
    const eta = Math.max(0, entry.arrivalTick - tick);
    parts.push(`ETA: ${eta} tick${eta !== 1 ? 's' : ''}`);
  }

  if (config.showsMitigationPath) {
    const mitigations = [
      ...entry.mitigationCardTypes,
      ...THREAT_TYPE_DEFAULT_MITIGATIONS[entry.threatType],
    ].filter((v, i, arr) => arr.indexOf(v) === i);
    parts.push(`Mitigations: ${mitigations.join(', ')}`);
  }

  if (config.showsWorstCase) {
    parts.push(`Worst case: ${entry.worstCaseOutcome}`);
  }

  if (entry.isCascadeTriggered) {
    parts.push('⚠️ CASCADE-triggered threat — priority escalated');
  }

  return parts.join(' | ');
}

/**
 * Serializes a set of active queue entries to a compact JSON string
 * suitable for persistence or transport. Each entry is individually
 * checksummed using computeEntryChecksum().
 *
 * @param entries - Active queue entries to serialize.
 * @returns A JSON string of checksummed entries.
 */
export function serializeActiveQueue(entries: readonly AnticipationEntry[]): string {
  const payload = entries.map((entry) => ({
    data: JSON.parse(serializeAnticipationEntry(entry)) as AnticipationEntry,
    checksum: computeEntryChecksum(entry),
  }));
  return JSON.stringify(payload);
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — DECAY PIPELINE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a full decay result and returns both the result and a human-
 * readable narrative summary. This is the primary entry point for the
 * orchestrator's decay step.
 *
 * @param input - The decay compute input.
 * @returns { result, narrative } tuple.
 */
export function computeDecayWithNarrative(
  input: DecayComputeInput,
): { result: DecayComputeResult; narrative: string } {
  const result = computeFullDecayResult(input);
  const allEntries = [
    ...input.activeEntries,
    ...input.expiredEntries,
    ...input.relievedEntries,
  ];
  const fakeSnapshot = buildFakeSnapshotForNarrative(
    0.5,
    result,
    input,
    allEntries,
  );
  const narrative = generateFullTensionNarrative(fakeSnapshot, allEntries);
  return { result, narrative };
}

/**
 * Builds a minimal TensionRuntimeSnapshot-compatible object for narrative
 * generation purposes without requiring a full engine tick. Uses VISIBILITY_ORDER
 * and TENSION_CONSTANTS to derive visibility state from decay state.
 */
function buildFakeSnapshotForNarrative(
  currentScore: number,
  decayResult: DecayComputeResult,
  input: DecayComputeInput,
  allEntries: readonly AnticipationEntry[],
): TensionRuntimeSnapshot {
  const visibilityIdx = Math.min(
    3,
    Math.floor(currentScore / 0.25),
  );
  const visibilityState = VISIBILITY_ORDER[visibilityIdx] ?? TENSION_VISIBILITY_STATE.SHADOWED;
  const arrivedEntries = input.activeEntries.filter((e) => e.state === ENTRY_STATE.ARRIVED);
  const queuedEntries = input.activeEntries.filter((e) => e.state === ENTRY_STATE.QUEUED);
  const score = clampTensionScore(currentScore + decayResult.amplifiedDelta);
  const isPulse = score >= TENSION_CONSTANTS.PULSE_THRESHOLD;

  const visibleThreats: ThreatEnvelope[] = allEntries
    .filter((e) => e.state === ENTRY_STATE.ARRIVED || e.state === ENTRY_STATE.QUEUED)
    .map((e) => ({
      threatId: e.threatId,
      source: e.source,
      etaTicks: Math.max(0, e.arrivalTick),
      severity: THREAT_SEVERITY_WEIGHTS[e.threatSeverity],
      visibleAs: INTERNAL_VISIBILITY_TO_ENVELOPE[visibilityState],
      summary: e.summary,
    }));

  return {
    score,
    previousScore: currentScore,
    rawDelta: decayResult.rawDelta,
    amplifiedDelta: decayResult.amplifiedDelta,
    visibilityState,
    queueLength: allEntries.length,
    arrivedCount: arrivedEntries.length,
    queuedCount: queuedEntries.length,
    expiredCount: input.expiredEntries.length,
    relievedCount: input.relievedEntries.length,
    visibleThreats: Object.freeze(visibleThreats),
    isPulseActive: isPulse,
    pulseTicksActive: isPulse ? 1 : 0,
    isEscalating: decayResult.amplifiedDelta > 0,
    dominantEntryId: allEntries[0]?.entryId ?? null,
    lastSpikeTick: null,
    tickNumber: 0,
    timestamp: Date.now(),
    contributionBreakdown: decayResult.contributionBreakdown,
  };
}

/**
 * Applies the PRESSURE_TENSION_AMPLIFIERS to a raw decay delta for the given
 * pressure tier. Exported for use by external orchestrators that need the
 * amplification step without running a full decay computation.
 *
 * @param rawDelta - Raw decay delta (from computeRawDecayDelta).
 * @param tier - Current pressure tier.
 * @returns Amplified delta.
 */
export function amplifyDecayDelta(rawDelta: number, tier: PressureTier): number {
  return rawDelta * PRESSURE_TENSION_AMPLIFIERS[tier];
}

/**
 * Estimates how many ticks the system can sustain the current threat load
 * before reaching the pulse threshold, given the current score and pressure tier.
 *
 * @param currentScore - Current tension score [0, 1].
 * @param netDeltaPerTick - Expected net tension change per tick.
 * @param tier - Current pressure tier.
 * @returns Estimated ticks until pulse (or 0 if already pulsing).
 */
export function estimateTicksToPulse(
  currentScore: number,
  netDeltaPerTick: number,
  tier: PressureTier,
): number {
  const threshold = TENSION_CONSTANTS.PULSE_THRESHOLD;
  if (currentScore >= threshold) return 0;
  const amplified = amplifyDecayDelta(netDeltaPerTick, tier);
  if (amplified <= 0) return Infinity;
  return Math.ceil((threshold - currentScore) / amplified);
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — NARRATIVE ORCHESTRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a prioritized, ordered set of narrative messages for the current
 * tension state. Uses TENSION_CONSTANTS.PULSE_THRESHOLD and VISIBILITY_CONFIGS
 * to gate which information is surfaced.
 *
 * @param snapshot - Current tension runtime snapshot.
 * @param entries - Active queue entries.
 * @returns Array of narrative strings ordered by urgency (most urgent first).
 */
export function generateTensionSystemNarrative(
  snapshot: TensionRuntimeSnapshot,
  entries: readonly AnticipationEntry[],
): string[] {
  const lines: string[] = [];
  const config = VISIBILITY_CONFIGS[snapshot.visibilityState];

  // Pulse alert (highest priority)
  if (snapshot.isPulseActive) {
    lines.push(
      `🔴 ANTICIPATION PULSE ACTIVE — tension at ${(snapshot.score * 100).toFixed(0)}%` +
        ` (threshold: ${(TENSION_CONSTANTS.PULSE_THRESHOLD * 100).toFixed(0)}%)`,
    );
  }

  // Escalation warning
  if (snapshot.isEscalating) {
    const amp = PRESSURE_TENSION_AMPLIFIERS['T0']; // baseline reference
    lines.push(
      `⚠️ Tension escalating — amplified delta: ${snapshot.amplifiedDelta.toFixed(4)} ` +
        `(baseline amp: ${amp})`,
    );
  }

  // Arrived threats
  if (snapshot.arrivedCount > 0 && config.showsThreatType) {
    const arrived = entries.filter((e) => e.state === ENTRY_STATE.ARRIVED);
    for (const e of arrived) {
      const weight = THREAT_SEVERITY_WEIGHTS[e.threatSeverity];
      lines.push(
        `💀 ${e.threatType} [${e.threatSeverity}] has ARRIVED — ` +
          `weight ${(weight * 100).toFixed(0)}%, source: ${e.source}`,
      );
    }
  }

  // Queued threats (if visible)
  if (snapshot.queuedCount > 0 && config.showsThreatCount) {
    lines.push(
      `📋 ${snapshot.queuedCount} threat${snapshot.queuedCount !== 1 ? 's' : ''} in anticipation queue`,
    );
  }

  // Decay breakdown narrative
  const b = snapshot.contributionBreakdown;
  if (Math.abs(b.emptyQueueBonus) > 0 || Math.abs(b.sovereigntyBonus) > 0) {
    const bonuses: string[] = [];
    if (b.emptyQueueBonus > 0)
      bonuses.push(
        `empty-queue relief: ${(b.emptyQueueBonus * 100).toFixed(1)}%` +
          ` (cap: ${(TENSION_CONSTANTS.EMPTY_QUEUE_DECAY * 100).toFixed(0)}%)`,
      );
    if (b.sovereigntyBonus > 0)
      bonuses.push(
        `sovereignty bonus: ${(b.sovereigntyBonus * 100).toFixed(1)}%` +
          ` (cap: ${(TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY * 100).toFixed(0)}%)`,
      );
    lines.push(`✅ Recovery bonuses active: ${bonuses.join(', ')}`);
  }

  // Urgency tier (uses snapshotUrgencyTier from types.ts)
  const urgency = snapshotUrgencyTier(snapshot);
  lines.push(
    `Urgency tier: ${urgency} | Visibility: ${snapshot.visibilityState} | ` +
      `Score: ${(snapshot.score * 100).toFixed(1)}%`,
  );

  // Full narrative from types module
  lines.push(generateFullTensionNarrative(snapshot, [...entries]));

  return lines;
}

/**
 * Generates a compact single-line tension status string suitable for
 * UI status bars, tooltips, and debug overlays. Uses VISIBILITY_CONFIGS
 * to determine information depth.
 *
 * @param snapshot - Current tension runtime snapshot.
 * @returns A compact status string.
 */
export function generateTensionStatusLine(snapshot: TensionRuntimeSnapshot): string {
  const config = VISIBILITY_CONFIGS[snapshot.visibilityState];
  const pct = (snapshot.score * 100).toFixed(0);
  const pulse = snapshot.isPulseActive
    ? ` [PULSE×${snapshot.pulseTicksActive}]`
    : '';
  const arrived = config.showsThreatCount ? ` | arrived:${snapshot.arrivedCount}` : '';
  const queued = config.showsThreatCount ? ` queued:${snapshot.queuedCount}` : '';
  const vis = snapshot.visibilityState;
  return `TENSION:${pct}%${pulse}${arrived}${queued} [${vis}]`;
}

/**
 * Generates a per-threat-type narrative summary showing what threats are
 * currently active and their individual contribution to tension. Uses
 * THREAT_TYPE_DEFAULT_MITIGATIONS and THREAT_SEVERITY_WEIGHTS.
 *
 * @param entries - All known anticipation entries.
 * @returns Array of per-type narrative strings.
 */
export function generateThreatTypeBreakdownNarrative(
  entries: readonly AnticipationEntry[],
): string[] {
  const activeTypes = Object.values(THREAT_TYPE).filter((type) =>
    entries.some((e) => e.threatType === type && (e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED)),
  );

  return activeTypes.map((type) => {
    const typeEntries = entries.filter((e) => e.threatType === type);
    const maxSev = typeEntries.reduce<ThreatSeverity | null>((acc, e) => {
      if (!acc) return e.threatSeverity;
      return THREAT_SEVERITY_WEIGHTS[e.threatSeverity] >
        THREAT_SEVERITY_WEIGHTS[acc]
        ? e.threatSeverity
        : acc;
    }, null) ?? THREAT_SEVERITY.MINOR;

    const defaultMitigations = THREAT_TYPE_DEFAULT_MITIGATIONS[type];
    return (
      `${type} ×${typeEntries.length} | max severity: ${maxSev}` +
      ` (${(THREAT_SEVERITY_WEIGHTS[maxSev] * 100).toFixed(0)}%)` +
      ` | default mitigations: [${[...defaultMitigations].join(', ')}]`
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — SESSION ANALYTICS AGGREGATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregates a session's worth of TensionRuntimeSnapshots into a compact
 * summary suitable for end-of-run reporting, ML training, and leaderboard
 * ranking.
 *
 * @param snapshots - Ordered array of runtime snapshots for the session.
 * @returns A TensionSessionAggregate.
 */
export function aggregateTensionSessionMetrics(
  snapshots: readonly TensionRuntimeSnapshot[],
): TensionSessionAggregate {
  if (snapshots.length === 0) {
    return Object.freeze({
      snapshotCount: 0,
      peakScore: 0,
      troughScore: 0,
      averageScore: 0,
      totalPulseTicks: 0,
      totalArrivals: 0,
      totalExpirations: 0,
      totalMitigations: 0,
      dominantVisibilityState: TENSION_VISIBILITY_STATE.SHADOWED,
      escalationRatio: 0,
      averageQueueLength: 0,
      maxQueueLength: 0,
      scoreVolatility: 0,
      averageAmplifiedDelta: 0,
      subsystemVersion: TENSION_SUBSYSTEM_VERSION,
    }) as TensionSessionAggregate;
  }

  let peakScore: number = TENSION_CONSTANTS.MIN_SCORE;
  let troughScore: number = TENSION_CONSTANTS.MAX_SCORE;
  let scoreSum = 0;
  let pulseTicks = 0;
  let arrivals = 0;
  let expirations = 0;
  let mitigations = 0;
  let escalatingTicks = 0;
  let queueLengthSum = 0;
  let maxQueueLength = 0;
  let amplifiedDeltaSum = 0;
  const scores: number[] = [];
  const visStateCounts: Record<TensionVisibilityState, number> = {
    [TENSION_VISIBILITY_STATE.SHADOWED]: 0,
    [TENSION_VISIBILITY_STATE.SIGNALED]: 0,
    [TENSION_VISIBILITY_STATE.TELEGRAPHED]: 0,
    [TENSION_VISIBILITY_STATE.EXPOSED]: 0,
  };

  for (const snap of snapshots) {
    const score = clampTensionScore(snap.score);
    peakScore = Math.max(peakScore, score);
    troughScore = Math.min(troughScore, score);
    scoreSum += score;
    scores.push(score);

    if (snap.isPulseActive) pulseTicks++;
    arrivals += snap.arrivedCount;
    expirations += snap.expiredCount;
    mitigations += snap.relievedCount;
    if (snap.isEscalating) escalatingTicks++;
    queueLengthSum += snap.queueLength;
    maxQueueLength = Math.max(maxQueueLength, snap.queueLength);
    amplifiedDeltaSum += snap.amplifiedDelta;
    visStateCounts[snap.visibilityState]++;
  }

  const n = snapshots.length;
  const averageScore = scoreSum / n;

  // Volatility = mean absolute deviation from average
  const mad =
    scores.reduce((sum, s) => sum + Math.abs(s - averageScore), 0) / n;

  // Dominant visibility state = whichever state had the most ticks
  const dominantVisibilityState = (
    Object.entries(visStateCounts) as [TensionVisibilityState, number][]
  ).reduce((best, [state, count]) =>
    count > visStateCounts[best] ? state : best,
  TENSION_VISIBILITY_STATE.SHADOWED as TensionVisibilityState);

  return Object.freeze({
    snapshotCount: n,
    peakScore,
    troughScore,
    averageScore,
    totalPulseTicks: pulseTicks,
    totalArrivals: arrivals,
    totalExpirations: expirations,
    totalMitigations: mitigations,
    dominantVisibilityState,
    escalationRatio: escalatingTicks / n,
    averageQueueLength: queueLengthSum / n,
    maxQueueLength,
    scoreVolatility: mad,
    averageAmplifiedDelta: amplifiedDeltaSum / n,
    subsystemVersion: TENSION_SUBSYSTEM_VERSION,
  }) as TensionSessionAggregate;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 10 — VALIDATION SUITE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a fully-assembled TensionSubsystem bundle for structural integrity.
 * Checks that all subcomponents are present and the version matches.
 *
 * @param subsystem - The tension subsystem bundle to validate.
 * @returns { valid: boolean; errors: string[] }
 */
export function validateTensionSubsystem(
  subsystem: TensionSubsystem,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!subsystem.engine || typeof subsystem.engine.tick !== 'function') {
    errors.push('engine: missing or invalid TensionEngine instance');
  }
  if (!subsystem.metricsCollector) {
    errors.push('metricsCollector: missing TensionMetricsCollector instance');
  }
  if (!subsystem.snapshotAdapter) {
    errors.push('snapshotAdapter: missing TensionSnapshotAdapter instance');
  }
  if (!subsystem.policyResolver) {
    errors.push('policyResolver: missing TensionPolicyResolver instance');
  }
  if (!subsystem.sourceAdapter) {
    errors.push('sourceAdapter: missing TensionThreatSourceAdapter instance');
  }
  if (subsystem.version !== TENSION_SUBSYSTEM_VERSION) {
    errors.push(
      `version mismatch: expected ${TENSION_SUBSYSTEM_VERSION}, got ${subsystem.version}`,
    );
  }
  if (typeof subsystem.createdAtMs !== 'number' || subsystem.createdAtMs <= 0) {
    errors.push('createdAtMs: must be a positive epoch timestamp');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates that a TensionSessionAggregate has all expected fields within
 * valid ranges.
 *
 * @param aggregate - The session aggregate to validate.
 * @returns { valid: boolean; errors: string[] }
 */
export function validateTensionSessionAggregate(
  aggregate: TensionSessionAggregate,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (aggregate.snapshotCount < 0) errors.push('snapshotCount must be >= 0');
  if (aggregate.peakScore < TENSION_CONSTANTS.MIN_SCORE || aggregate.peakScore > TENSION_CONSTANTS.MAX_SCORE) {
    errors.push(`peakScore ${aggregate.peakScore} out of range [${TENSION_CONSTANTS.MIN_SCORE}, ${TENSION_CONSTANTS.MAX_SCORE}]`);
  }
  if (aggregate.troughScore < TENSION_CONSTANTS.MIN_SCORE || aggregate.troughScore > TENSION_CONSTANTS.MAX_SCORE) {
    errors.push(`troughScore out of range`);
  }
  if (aggregate.escalationRatio < 0 || aggregate.escalationRatio > 1) {
    errors.push('escalationRatio must be in [0, 1]');
  }
  if (!Object.values(TENSION_VISIBILITY_STATE).includes(aggregate.dominantVisibilityState)) {
    errors.push('dominantVisibilityState is not a valid TensionVisibilityState');
  }
  if (aggregate.scoreVolatility < 0) errors.push('scoreVolatility must be >= 0');
  return { valid: errors.length === 0, errors };
}

/**
 * Validates a TensionSubsystemHealth report to ensure it was computed
 * from the correct version and all checks are structurally valid.
 *
 * @param health - The health report to validate.
 * @returns { valid: boolean; errors: string[] }
 */
export function validateTensionSubsystemHealth(
  health: TensionSubsystemHealth,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (health.subsystemVersion !== TENSION_SUBSYSTEM_VERSION) {
    errors.push(
      `subsystemVersion mismatch: expected ${TENSION_SUBSYSTEM_VERSION}`,
    );
  }
  if (health.enginePosition !== TENSION_ENGINE_POSITION) {
    errors.push(`enginePosition must be ${TENSION_ENGINE_POSITION}`);
  }
  if (health.engineStep !== TENSION_ENGINE_STEP_KEY) {
    errors.push(`engineStep must be ${TENSION_ENGINE_STEP_KEY}`);
  }
  if (typeof health.checkedAt !== 'number' || health.checkedAt <= 0) {
    errors.push('checkedAt must be a valid epoch timestamp');
  }
  return { valid: errors.length === 0, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 11 — EXPORT BUNDLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a full TensionSubsystemExportBundle for persistence, auditing,
 * and external analytics consumers.
 *
 * @returns A complete, frozen export bundle.
 */
export function buildTensionSubsystemExportBundle(): TensionSubsystemExportBundle {
  const health = computeTensionSubsystemHealth();
  const constantsSnapshot = Object.freeze({
    queuedPerTick: TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK,
    arrivedPerTick: TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK,
    expiredGhostPerTick: TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK,
    mitigationDecayPerTick: TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK,
    nullifyDecayPerTick: TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK,
    emptyQueueDecay: TENSION_CONSTANTS.EMPTY_QUEUE_DECAY,
    sovereigntyBonusDecay: TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY,
    pulseThreshold: TENSION_CONSTANTS.PULSE_THRESHOLD,
    pulseSustainedTicks: TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS,
    maxActiveThreats: TENSION_MAX_ACTIVE_THREATS,
  });

  const signaturePayload = JSON.stringify({
    version: TENSION_SUBSYSTEM_VERSION,
    constants: constantsSnapshot,
    eventCount: Object.keys(TENSION_EVENT_NAMES).length,
    threatTypeCount: Object.keys(THREAT_TYPE).length,
    severityCount: Object.keys(THREAT_SEVERITY).length,
    visibilityCount: Object.keys(TENSION_VISIBILITY_STATE).length,
    entryStateCount: Object.keys(ENTRY_STATE).length,
  });
  const signature = createHash('sha256')
    .update(signaturePayload)
    .digest('hex')
    .slice(0, 32);

  return Object.freeze({
    subsystemVersion: TENSION_SUBSYSTEM_VERSION,
    exportedAtMs: Date.now(),
    health,
    constantsSnapshot,
    signature,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// § 12 — RUNTIME SNAPSHOT UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a TensionRuntimeSnapshot against all known constraints.
 * Delegates to validateTensionRuntimeSnapshot from types.ts and adds
 * additional cross-field consistency checks.
 *
 * @param snapshot - The snapshot to validate.
 * @returns { valid: boolean; errors: string[] }
 */
export function validateSubsystemSnapshot(
  snapshot: TensionRuntimeSnapshot,
): { valid: boolean; errors: string[] } {
  const base = validateTensionRuntimeSnapshot(snapshot);
  const extraErrors: string[] = [];

  // Cross-field: arrivedCount + queuedCount + expiredCount must not exceed queueLength significantly
  const totalTracked = snapshot.arrivedCount + snapshot.queuedCount + snapshot.expiredCount;
  if (totalTracked > snapshot.queueLength * 3) {
    extraErrors.push(
      `arrivedCount + queuedCount + expiredCount (${totalTracked}) exceeds plausible queue size`,
    );
  }

  // Pulse consistency: if isPulseActive, score must be >= PULSE_THRESHOLD
  if (snapshot.isPulseActive && snapshot.score < TENSION_CONSTANTS.PULSE_THRESHOLD) {
    extraErrors.push(
      `isPulseActive=true but score ${snapshot.score} < PULSE_THRESHOLD ${TENSION_CONSTANTS.PULSE_THRESHOLD}`,
    );
  }

  // Visibility state must be in VISIBILITY_ORDER
  if (!VISIBILITY_ORDER.includes(snapshot.visibilityState)) {
    extraErrors.push(`visibilityState ${snapshot.visibilityState} not in VISIBILITY_ORDER`);
  }

  return {
    valid: base.valid && extraErrors.length === 0,
    errors: [...base.errors, ...extraErrors],
  };
}

/**
 * Converts a TensionRuntimeSnapshot into a compact ThreatEnvelope array
 * filtered by the visibility doctrine. Only threats visible at the current
 * visibility state are included.
 *
 * @param snapshot - Current tension runtime snapshot.
 * @returns Array of ThreatEnvelope objects filtered by visibility.
 */
export function extractVisibleThreatEnvelopes(
  snapshot: TensionRuntimeSnapshot,
): readonly ThreatEnvelope[] {
  const config = VISIBILITY_CONFIGS[snapshot.visibilityState];
  if (!config.showsThreatCount) return Object.freeze([]);
  return snapshot.visibleThreats;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 13 — ANTICIPATION ENTRY BATCH HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a batch of AnticipationEntry objects from an array of QueueUpsertInputs.
 * Each entry gets a deterministic ID computed from runId + sourceKey.
 *
 * @param inputs - Array of upsert inputs.
 * @returns Array of created AnticipationEntry objects.
 */
export function batchCreateAnticipationEntries(
  inputs: readonly QueueUpsertInput[],
): AnticipationEntry[] {
  return inputs.map((input) => {
    const entryId = computeThreatEntryId(input.runId, input.sourceKey);
    return createAnticipationEntry(input, entryId);
  });
}

/**
 * Filters an entry array to only include entries that would contribute
 * to the tension score at the current tick. Active entries are QUEUED
 * or ARRIVED state; decaying entries have decayTicksRemaining > 0.
 *
 * Uses ENTRY_STATE and TENSION_CONSTANTS to classify each entry.
 */
export function filterScoreContributingEntries(
  entries: readonly AnticipationEntry[],
): readonly AnticipationEntry[] {
  return entries.filter((e) => {
    if (e.state === ENTRY_STATE.QUEUED) return true;
    if (e.state === ENTRY_STATE.ARRIVED) return true;
    if (
      (e.state === ENTRY_STATE.MITIGATED || e.state === ENTRY_STATE.EXPIRED || e.state === ENTRY_STATE.NULLIFIED) &&
      e.decayTicksRemaining > 0
    ) return true;
    return false;
  });
}

/**
 * Groups entries by their threat type and returns a map of type → entries.
 * Uses all THREAT_TYPE values as keys, ensuring all types are always present.
 */
export function groupEntriesByThreatType(
  entries: readonly AnticipationEntry[],
): Record<ThreatType, AnticipationEntry[]> {
  const groups: Record<ThreatType, AnticipationEntry[]> = {
    [THREAT_TYPE.DEBT_SPIRAL]: [],
    [THREAT_TYPE.SABOTAGE]: [],
    [THREAT_TYPE.HATER_INJECTION]: [],
    [THREAT_TYPE.CASCADE]: [],
    [THREAT_TYPE.SOVEREIGNTY]: [],
    [THREAT_TYPE.OPPORTUNITY_KILL]: [],
    [THREAT_TYPE.REPUTATION_BURN]: [],
    [THREAT_TYPE.SHIELD_PIERCE]: [],
  };
  for (const entry of entries) {
    groups[entry.threatType].push(entry);
  }
  return groups;
}

/**
 * Groups entries by their threat severity.
 */
export function groupEntriesBySeverity(
  entries: readonly AnticipationEntry[],
): Record<ThreatSeverity, AnticipationEntry[]> {
  const groups: Record<ThreatSeverity, AnticipationEntry[]> = {
    [THREAT_SEVERITY.MINOR]: [],
    [THREAT_SEVERITY.MODERATE]: [],
    [THREAT_SEVERITY.SEVERE]: [],
    [THREAT_SEVERITY.CRITICAL]: [],
    [THREAT_SEVERITY.EXISTENTIAL]: [],
  };
  for (const entry of entries) {
    groups[entry.threatSeverity].push(entry);
  }
  return groups;
}

/**
 * Computes the weighted threat burden of an entry set — the sum of
 * THREAT_SEVERITY_WEIGHTS[entry.threatSeverity] for all active entries.
 * Higher burden = greater psychological pressure on the player.
 */
export function computeWeightedThreatBurden(
  entries: readonly AnticipationEntry[],
): number {
  return entries
    .filter(
      (e) =>
        e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED,
    )
    .reduce(
      (sum, e) => sum + THREAT_SEVERITY_WEIGHTS[e.threatSeverity],
      0,
    );
}

/**
 * Checks whether the current threat load has exceeded the maximum active
 * threshold defined by TENSION_MAX_ACTIVE_THREATS. When true, the system
 * should broadcast a backlog-overflow warning.
 */
export function isThreatQueueOverloaded(
  entries: readonly AnticipationEntry[],
): boolean {
  const activeCount = entries.filter(
    (e) => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED,
  ).length;
  return activeCount >= TENSION_MAX_ACTIVE_THREATS;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 14 — THREAT EVENT SCORING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a priority score for a ThreatArrivedEvent. Higher = more urgent.
 * Used by chat adapters to determine message priority and urgency tier.
 *
 * Score = THREAT_SEVERITY_WEIGHTS[severity] × (isCascade ? 1.5 : 1.0)
 *
 * @param event - The threat arrived event.
 * @returns Priority score in [0, 1.5].
 */
export function scoreThreatArrivedEvent(event: ThreatArrivedEvent): number {
  const weight = THREAT_SEVERITY_WEIGHTS[event.threatSeverity];
  const cascadeBonus =
    THREAT_TYPE[event.threatType] === THREAT_TYPE.CASCADE ||
    THREAT_TYPE[event.threatType] === THREAT_TYPE.SOVEREIGNTY
      ? 1.5
      : 1.0;
  return weight * cascadeBonus;
}

/**
 * Computes a relief score for a ThreatMitigatedEvent. Higher = more relief.
 * Used by chat adapters to calibrate positive reinforcement messaging.
 *
 * @param event - The threat mitigated event.
 * @param entry - The mitigated entry (for severity context).
 * @returns Relief score in [0, 1].
 */
export function scoreThreatMitigatedEvent(
  event: ThreatMitigatedEvent,
  entry: AnticipationEntry,
): number {
  // Use TENSION_CONSTANTS to scale relief by decay rate
  const decayFactor =
    TENSION_CONSTANTS.MITIGATION_DECAY_TICKS / TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS;
  return THREAT_SEVERITY_WEIGHTS[entry.threatSeverity] * decayFactor;
}

/**
 * Computes a damage score for a ThreatExpiredEvent. Higher = worse outcome.
 *
 * Score = THREAT_SEVERITY_WEIGHTS[severity] × (1 + ticksOverdue / 10)
 */
export function scoreThreatExpiredEvent(event: ThreatExpiredEvent): number {
  const base = THREAT_SEVERITY_WEIGHTS[event.threatSeverity];
  const overdueMultiplier = 1 + event.ticksOverdue / 10;
  return Math.min(1, base * overdueMultiplier);
}

/**
 * Computes an urgency rating for a TensionPulseFiredEvent. Returns a
 * normalized [0, 1] score based on how long the pulse has been sustained.
 */
export function scorePulseFiredEvent(event: TensionPulseFiredEvent): number {
  const maxSustained = TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS * 4;
  return Math.min(1, event.pulseTicksActive / maxSustained);
}

/**
 * Computes an escalation rating for a TensionScoreUpdatedEvent. Returns
 * the amplified delta normalized by the ARRIVED_TENSION_PER_TICK cap.
 */
export function scoreScoreUpdatedEvent(event: TensionScoreUpdatedEvent): number {
  return Math.min(
    1,
    Math.abs(event.amplifiedDelta) / TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK,
  );
}

/**
 * Computes a visibility-change impact score. Upgrades (increasing exposure)
 * score positive; downgrades (decreasing exposure) score negative.
 */
export function scoreVisibilityChangedEvent(event: TensionVisibilityChangedEvent): number {
  const fromOrdinal = VISIBILITY_ORDER.indexOf(event.from);
  const toOrdinal = VISIBILITY_ORDER.indexOf(event.to);
  return (toOrdinal - fromOrdinal) / (VISIBILITY_ORDER.length - 1);
}

/**
 * Computes an updated queue impact score from an AnticipationQueueUpdatedEvent.
 * Uses TENSION_CONSTANTS and ENTRY_STATE presence to normalize.
 */
export function scoreQueueUpdatedEvent(event: AnticipationQueueUpdatedEvent): number {
  const activeLoad = (event.arrivedCount + event.queuedCount) / TENSION_MAX_ACTIVE_THREATS;
  const expirationStress = event.expiredCount / Math.max(1, event.queueLength);
  return Math.min(1, 0.7 * activeLoad + 0.3 * expirationStress);
}

// ─────────────────────────────────────────────────────────────────────────────
// § 15 — SUBSYSTEM CONSTANTS SNAPSHOT EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a frozen snapshot of all tension subsystem constants.
 * Useful for deterministic replay validation and constant-drift detection.
 */
export function getTensionConstantsSnapshot(): Readonly<{
  QUEUED_TENSION_PER_TICK: number;
  ARRIVED_TENSION_PER_TICK: number;
  EXPIRED_GHOST_PER_TICK: number;
  MITIGATION_DECAY_PER_TICK: number;
  MITIGATION_DECAY_TICKS: number;
  NULLIFY_DECAY_PER_TICK: number;
  NULLIFY_DECAY_TICKS: number;
  EMPTY_QUEUE_DECAY: number;
  SOVEREIGNTY_BONUS_DECAY: number;
  PULSE_THRESHOLD: number;
  PULSE_SUSTAINED_TICKS: number;
  MIN_SCORE: number;
  MAX_SCORE: number;
  pressureAmplifiers: Readonly<Record<PressureTier, number>>;
  severityWeights: Readonly<Record<ThreatSeverity, number>>;
  visibilityOrder: readonly TensionVisibilityState[];
  eventNames: Readonly<typeof TENSION_EVENT_NAMES>;
}> {
  return Object.freeze({
    ...TENSION_CONSTANTS,
    pressureAmplifiers: Object.freeze({ ...PRESSURE_TENSION_AMPLIFIERS }),
    severityWeights: Object.freeze({ ...THREAT_SEVERITY_WEIGHTS }),
    visibilityOrder: VISIBILITY_ORDER,
    eventNames: Object.freeze({ ...TENSION_EVENT_NAMES }),
  });
}

/**
 * Returns the number of threat types in the subsystem.
 * Useful for ML dimension sanity checks.
 */
export function getTensionThreatTypeCount(): number {
  return Object.keys(THREAT_TYPE).length;
}

/**
 * Returns the number of threat severities in the subsystem.
 */
export function getTensionSeverityCount(): number {
  return Object.keys(THREAT_SEVERITY).length;
}

/**
 * Returns the number of visibility states in the subsystem.
 */
export function getTensionVisibilityStateCount(): number {
  return Object.keys(TENSION_VISIBILITY_STATE).length;
}

/**
 * Returns the number of entry states in the subsystem.
 */
export function getTensionEntryStateCount(): number {
  return Object.keys(ENTRY_STATE).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 16 — SELF-TEST HARNESS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs a comprehensive self-test of the entire tension subsystem barrel.
 *
 * Checks:
 *   1.  Types self-test (from types.ts runTypesSelfTest)
 *   2.  All tension constants intact
 *   3.  Factory functions produce valid instances
 *   4.  buildTensionSubsystem produces a valid, validatable bundle
 *   5.  ML orchestration (mergeTensionMLVectors, buildTensionUnifiedMLBundle)
 *   6.  DL tensor construction
 *   7.  Health report computation and validation
 *   8.  Session aggregate with mock snapshots
 *   9.  Threat recommendations
 *   10. Narrative generation
 *   11. Event scoring
 *   12. Batch entry creation
 *   13. Queue overload detection
 *   14. Export bundle construction
 *   15. Constants snapshot integrity
 *
 * @returns TensionSubsystemSelfTestResult with passed=true if all checks pass.
 */
export function runTensionSubsystemSelfTest(): TensionSubsystemSelfTestResult {
  const checks: string[] = [];
  const failures: string[] = [];
  const start = Date.now();

  function check(label: string, condition: boolean): void {
    checks.push(label);
    if (!condition) failures.push(label);
  }

  // ── 1. Types self-test ──────────────────────────────────────────────────
  let typesTestPassed = false;
  try {
    const typesResult = runTypesSelfTest();
    check('types.runTypesSelfTest() returns passed=true', typesResult.passed);
    check('types.runTypesSelfTest() has zero failures', typesResult.failures.length === 0);
    check('types.runTypesSelfTest() ran checks', typesResult.checks.length > 0);
    typesTestPassed = typesResult.passed;
  } catch (e) {
    failures.push(`types.runTypesSelfTest() threw: ${String(e)}`);
  }

  // ── 2. Constants integrity ──────────────────────────────────────────────
  let constantsTestPassed = false;
  try {
    check('TENSION_CONSTANTS intact', areTensionConstantsIntact());
    check('VISIBILITY_ORDER valid', isVisibilityOrderValid());
    check('PRESSURE_AMPLIFIERS valid', arePressureAmplifiersValid());
    check('SEVERITY_WEIGHTS valid', areSeverityWeightsValid());
    check('DEFAULT_MITIGATIONS valid', areDefaultMitigationsValid());
    check('ENVELOPE_MAPPING valid', isEnvelopeMappingValid());
    check('EVENT_NAMES valid', areEventNamesValid());
    check('ENTRY_STATES valid', areEntryStatesValid());
    check('TENSION_PULSE_SCORE correct', TENSION_PULSE_SCORE === TENSION_CONSTANTS.PULSE_THRESHOLD);
    check('TENSION_MAX_ACTIVE_THREATS positive', TENSION_MAX_ACTIVE_THREATS > 0);
    check('TENSION_ENGINE_POSITION is 3', TENSION_ENGINE_POSITION === 3);
    check('TENSION_ENGINE_STEP_KEY correct', TENSION_ENGINE_STEP_KEY === 'STEP_04_TENSION');
    check('getTensionThreatTypeCount() is 8', getTensionThreatTypeCount() === 8);
    check('getTensionSeverityCount() is 5', getTensionSeverityCount() === 5);
    check('getTensionVisibilityStateCount() is 4', getTensionVisibilityStateCount() === 4);
    check('getTensionEntryStateCount() is 5', getTensionEntryStateCount() === 5);
    constantsTestPassed = failures.length === 0;
  } catch (e) {
    failures.push(`constants self-test threw: ${String(e)}`);
  }

  // ── 3. Factory functions ────────────────────────────────────────────────
  let factoriesTestPassed = false;
  try {
    const engine = createTensionEngine();
    check('createTensionEngine() returns instance', engine instanceof TensionEngine);

    const queue = createAnticipationQueue();
    check('createAnticipationQueue() returns instance', queue instanceof AnticipationQueue);

    const visManager = createThreatVisibilityManager();
    check('createThreatVisibilityManager() returns instance', visManager instanceof ThreatVisibilityManager);

    const decayCtrl = createTensionDecayController();
    check('createTensionDecayController() returns instance', decayCtrl instanceof TensionDecayController);

    const projector = createTensionThreatProjector();
    check('createTensionThreatProjector() returns instance', projector instanceof TensionThreatProjector);

    const sourceAdapter = createTensionThreatSourceAdapter();
    check('createTensionThreatSourceAdapter() returns instance', sourceAdapter instanceof TensionThreatSourceAdapter);

    const metricsCollector = createTensionMetricsCollector();
    check('createTensionMetricsCollector() returns instance', metricsCollector instanceof TensionMetricsCollector);

    const policyResolver = createTensionPolicyResolver();
    check('createTensionPolicyResolver() returns instance', policyResolver instanceof TensionPolicyResolver);

    const snapshotAdapter = createTensionSnapshotAdapter();
    check('createTensionSnapshotAdapter() returns instance', snapshotAdapter instanceof TensionSnapshotAdapter);

    const subsystem = buildTensionSubsystem();
    const subsystemValidation = validateTensionSubsystem(subsystem);
    check('buildTensionSubsystem() validates clean', subsystemValidation.valid);
    check('subsystem version correct', subsystem.version === TENSION_SUBSYSTEM_VERSION);
    factoriesTestPassed = failures.filter((f) => f.startsWith('create') || f.startsWith('build')).length === 0;
  } catch (e) {
    failures.push(`factory self-test threw: ${String(e)}`);
  }

  // ── 4. ML/DL orchestration ──────────────────────────────────────────────
  let mlOrchestrationTestPassed = false;
  try {
    const vec1 = [0.1, 0.2, 0.3];
    const vec2 = [0.3, 0.4, 0.5];
    const merged = mergeTensionMLVectors([vec1, vec2]);
    check('mergeTensionMLVectors length', merged.length === 3);
    check('mergeTensionMLVectors[0] ~= 0.2', Math.abs(merged[0]! - 0.2) < 0.001);

    const sig = computeTensionFeatureSignature([0.1, 0.2, 0.3]);
    check('computeTensionFeatureSignature length 16', sig.length === 16);

    const importance = computeTensionFeatureImportance([[0.1, 0.5], [0.9, 0.5]]);
    check('computeTensionFeatureImportance length', importance.length === 2);

    const mockInput: QueueUpsertInput = {
      runId: 'self-test-run',
      sourceKey: 'st-source-1',
      threatId: 'st-threat-1',
      source: 'SELF_TEST',
      threatType: THREAT_TYPE.DEBT_SPIRAL,
      threatSeverity: THREAT_SEVERITY.MODERATE,
      currentTick: 5,
      arrivalTick: 10,
      isCascadeTriggered: false,
      cascadeTriggerEventId: null,
      worstCaseOutcome: 'Self-test worst case',
      mitigationCardTypes: Object.freeze(['REFINANCE']),
      summary: 'Self-test entry',
    };
    const entryId = computeThreatEntryId('self-test-run', 'st-source-1');
    const entry = createAnticipationEntry(mockInput, entryId);
    const validation = validateAnticipationEntry(entry);
    check('createAnticipationEntry validates clean', validation.valid);

    const mockSnap: TensionRuntimeSnapshot = {
      score: 0.4,
      previousScore: 0.35,
      rawDelta: 0.05,
      amplifiedDelta: 0.055,
      visibilityState: TENSION_VISIBILITY_STATE.SIGNALED,
      queueLength: 1,
      arrivedCount: 0,
      queuedCount: 1,
      expiredCount: 0,
      relievedCount: 0,
      visibleThreats: Object.freeze([]),
      isPulseActive: false,
      pulseTicksActive: 0,
      isEscalating: true,
      dominantEntryId: entry.entryId,
      lastSpikeTick: null,
      tickNumber: 5,
      timestamp: Date.now(),
      contributionBreakdown: {
        queuedThreats: 0.05,
        arrivedThreats: 0,
        expiredGhosts: 0,
        mitigationDecay: 0,
        nullifyDecay: 0,
        emptyQueueBonus: 0,
        visibilityBonus: 0,
        sovereigntyBonus: 0,
      },
    };

    const bundle = buildTensionUnifiedMLBundle(mockSnap, [entry], 'T1' as PressureTier);
    check('buildTensionUnifiedMLBundle featureCount > 0', bundle.featureCount > 0);
    check('buildTensionUnifiedMLBundle signature length 16', bundle.signature.length === 16);

    const tensor = buildTensionDLSequenceTensor([mockSnap], 'T1' as PressureTier);
    check('buildTensionDLSequenceTensor rows = 16', tensor.length === 16);
    check('buildTensionDLSequenceTensor cols = 8', tensor[0]!.length === 8);

    const tensorChecksum = computeTensionDLTensorChecksum(tensor);
    check('computeTensionDLTensorChecksum length 16', tensorChecksum.length === 16);

    mlOrchestrationTestPassed = true;
  } catch (e) {
    failures.push(`ML orchestration self-test threw: ${String(e)}`);
    mlOrchestrationTestPassed = false;
  }

  // ── 5. Health report ────────────────────────────────────────────────────
  let healthTestPassed = false;
  try {
    const health = computeTensionSubsystemHealth();
    check('computeTensionSubsystemHealth() overall healthy', health.overallHealthy);
    const healthValidation = validateTensionSubsystemHealth(health);
    check('validateTensionSubsystemHealth() valid', healthValidation.valid);
    healthTestPassed = health.overallHealthy && healthValidation.valid;
  } catch (e) {
    failures.push(`health self-test threw: ${String(e)}`);
  }

  // ── 6. Session aggregate ────────────────────────────────────────────────
  try {
    const mockSnap2: TensionRuntimeSnapshot = {
      score: 0.6,
      previousScore: 0.5,
      rawDelta: 0.1,
      amplifiedDelta: 0.12,
      visibilityState: TENSION_VISIBILITY_STATE.TELEGRAPHED,
      queueLength: 2,
      arrivedCount: 1,
      queuedCount: 1,
      expiredCount: 0,
      relievedCount: 0,
      visibleThreats: Object.freeze([]),
      isPulseActive: false,
      pulseTicksActive: 0,
      isEscalating: true,
      dominantEntryId: null,
      lastSpikeTick: 3,
      tickNumber: 8,
      timestamp: Date.now(),
      contributionBreakdown: {
        queuedThreats: 0.06,
        arrivedThreats: 0.1,
        expiredGhosts: 0,
        mitigationDecay: 0,
        nullifyDecay: 0,
        emptyQueueBonus: 0,
        visibilityBonus: VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.TELEGRAPHED].tensionAwarenessBonus,
        sovereigntyBonus: 0,
      },
    };
    const aggregate = aggregateTensionSessionMetrics([mockSnap2]);
    check('aggregateTensionSessionMetrics snapshotCount', aggregate.snapshotCount === 1);
    check('aggregateTensionSessionMetrics peakScore', aggregate.peakScore === mockSnap2.score);
    const aggValidation = validateTensionSessionAggregate(aggregate);
    check('validateTensionSessionAggregate valid', aggValidation.valid);
  } catch (e) {
    failures.push(`session aggregate self-test threw: ${String(e)}`);
  }

  // ── 7. Event scoring ────────────────────────────────────────────────────
  try {
    const now = Date.now();
    const arrivedEvt: ThreatArrivedEvent = {
      eventType: 'THREAT_ARRIVED',
      entryId: 'evt-1',
      threatType: THREAT_TYPE.CASCADE,
      threatSeverity: THREAT_SEVERITY.CRITICAL,
      source: 'SELF_TEST',
      worstCaseOutcome: 'chain reaction',
      mitigationCardTypes: Object.freeze(['STABILIZE']),
      tickNumber: 5,
      timestamp: now,
    };
    const arrivedScore = scoreThreatArrivedEvent(arrivedEvt);
    check('scoreThreatArrivedEvent > 0', arrivedScore > 0);

    const expiredEvt: ThreatExpiredEvent = {
      eventType: 'THREAT_EXPIRED',
      entryId: 'evt-2',
      threatType: THREAT_TYPE.DEBT_SPIRAL,
      threatSeverity: THREAT_SEVERITY.SEVERE,
      ticksOverdue: 3,
      tickNumber: 10,
      timestamp: now,
    };
    const expiredScore = scoreThreatExpiredEvent(expiredEvt);
    check('scoreThreatExpiredEvent > 0', expiredScore > 0);

    const pulseEvt: TensionPulseFiredEvent = {
      eventType: 'TENSION_PULSE_FIRED',
      score: TENSION_CONSTANTS.PULSE_THRESHOLD + 0.01,
      queueLength: 3,
      pulseTicksActive: TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS,
      tickNumber: 12,
      timestamp: now,
    };
    const pulseScore = scorePulseFiredEvent(pulseEvt);
    check('scorePulseFiredEvent in [0,1]', pulseScore >= 0 && pulseScore <= 1);

    const visEvt: TensionVisibilityChangedEvent = {
      eventType: 'TENSION_VISIBILITY_CHANGED',
      from: TENSION_VISIBILITY_STATE.SHADOWED,
      to: TENSION_VISIBILITY_STATE.EXPOSED,
      tickNumber: 7,
      timestamp: now,
    };
    const visScore = scoreVisibilityChangedEvent(visEvt);
    check('scoreVisibilityChangedEvent positive on upgrade', visScore > 0);
  } catch (e) {
    failures.push(`event scoring self-test threw: ${String(e)}`);
  }

  // ── 8. Batch entry helpers ──────────────────────────────────────────────
  try {
    const inputs: QueueUpsertInput[] = [
      {
        runId: 'batch-run',
        sourceKey: 'b-source-1',
        threatId: 'b-threat-1',
        source: 'BATCH_TEST',
        threatType: THREAT_TYPE.SABOTAGE,
        threatSeverity: THREAT_SEVERITY.MINOR,
        currentTick: 1,
        arrivalTick: 5,
        isCascadeTriggered: false,
        cascadeTriggerEventId: null,
        worstCaseOutcome: 'sabotage outcome',
        mitigationCardTypes: Object.freeze(['COUNTER_PLAY']),
        summary: 'Batch test entry 1',
      },
      {
        runId: 'batch-run',
        sourceKey: 'b-source-2',
        threatId: 'b-threat-2',
        source: 'BATCH_TEST',
        threatType: THREAT_TYPE.CASCADE,
        threatSeverity: THREAT_SEVERITY.EXISTENTIAL,
        currentTick: 1,
        arrivalTick: 3,
        isCascadeTriggered: true,
        cascadeTriggerEventId: 'trigger-evt-1',
        worstCaseOutcome: 'total cascade',
        mitigationCardTypes: Object.freeze(['STABILIZE', 'PATCH']),
        summary: 'Batch test entry 2 cascade',
      },
    ];

    const entries = batchCreateAnticipationEntries(inputs);
    check('batchCreateAnticipationEntries length', entries.length === 2);
    check('batch entry[0] type correct', entries[0]!.threatType === THREAT_TYPE.SABOTAGE);
    check('batch entry[1] cascade', entries[1]!.isCascadeTriggered === true);

    const burden = computeWeightedThreatBurden(entries);
    check('computeWeightedThreatBurden > 0', burden > 0);

    const grouped = groupEntriesByThreatType(entries);
    check('groupEntriesByThreatType CASCADE length 1', grouped[THREAT_TYPE.CASCADE].length === 1);

    const bySeverity = groupEntriesBySeverity(entries);
    check('groupEntriesBySeverity EXISTENTIAL length 1', bySeverity[THREAT_SEVERITY.EXISTENTIAL].length === 1);

    const contributing = filterScoreContributingEntries(entries);
    check('filterScoreContributingEntries length 2', contributing.length === 2);

    const overloaded = isThreatQueueOverloaded(entries);
    check('isThreatQueueOverloaded false for 2 entries', !overloaded);
  } catch (e) {
    failures.push(`batch entry self-test threw: ${String(e)}`);
  }

  // ── 9. Export bundle ────────────────────────────────────────────────────
  try {
    const bundle = buildTensionSubsystemExportBundle();
    check('export bundle version correct', bundle.subsystemVersion === TENSION_SUBSYSTEM_VERSION);
    check('export bundle signature length 32', bundle.signature.length === 32);
    check('export bundle health healthy', bundle.health.overallHealthy);
    check('export bundle constants match', bundle.constantsSnapshot.pulseThreshold === TENSION_CONSTANTS.PULSE_THRESHOLD);
  } catch (e) {
    failures.push(`export bundle self-test threw: ${String(e)}`);
  }

  // ── 10. Constants snapshot ──────────────────────────────────────────────
  try {
    const snap = getTensionConstantsSnapshot();
    check('constants snapshot QUEUED_TENSION_PER_TICK', snap.QUEUED_TENSION_PER_TICK === TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK);
    check('constants snapshot PULSE_THRESHOLD', snap.PULSE_THRESHOLD === TENSION_CONSTANTS.PULSE_THRESHOLD);
    check('constants snapshot T4 amplifier', snap.pressureAmplifiers['T4'] === PRESSURE_TENSION_AMPLIFIERS['T4']);
    check('constants snapshot visibilityOrder length 4', snap.visibilityOrder.length === 4);
    check('constants snapshot eventNames has SCORE_UPDATED', 'SCORE_UPDATED' in snap.eventNames);
  } catch (e) {
    failures.push(`constants snapshot self-test threw: ${String(e)}`);
  }

  const durationMs = Date.now() - start;
  const passed = failures.length === 0;

  return Object.freeze({
    passed,
    checks: Object.freeze(checks),
    failures: Object.freeze(failures),
    durationMs,
    subsystemVersion: TENSION_SUBSYSTEM_VERSION,
    typesTestPassed,
    constantsTestPassed,
    factoriesTestPassed,
    mlOrchestrationTestPassed,
    healthTestPassed,
  }) as TensionSubsystemSelfTestResult;
}
