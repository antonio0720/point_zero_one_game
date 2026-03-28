// backend/src/game/engine/zero/RunShutdownPipeline.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/RunShutdownPipeline.ts
 *
 * Doctrine:
 * - shutdown owns terminal reconciliation, not tick sequencing
 * - terminal outcome authority flows through RuntimeOutcomeResolver
 * - mode finalization executes before proof sealing so mode-native score
 *   consequences are included in sovereignty proof
 * - sovereignty finalization remains owned by SovereigntyEngine
 * - archive output is deterministic, replay-safe, and storage-ready
 * - ML/DL analytics surfaces are first-class shutdown observability artifacts
 * - every shutdown is measurable: quality score, severity classification,
 *   chat signal routing, and trend projection are all available post-shutdown
 * - user experience scoring drives shutdown severity and narrative routing
 */

import {
  checksumParts,
  checksumSnapshot,
  cloneJson,
  computeTickSeal,
  createDeterministicId,
  deepFrozenClone,
  deepFreeze,
  stableStringify,
} from '../core/Deterministic';
import type { EventBus, EventEnvelope } from '../core/EventBus';
import {
  // Canonical array sentinels
  MODE_CODES,
  PRESSURE_TIERS,
  RUN_PHASES,
  RUN_OUTCOMES,
  SHIELD_LAYER_IDS,
  HATER_BOT_IDS,
  TIMING_CLASSES,
  DECK_TYPES,
  VISIBILITY_LEVELS,
  INTEGRITY_STATUSES,
  VERIFIED_GRADES,
  SHIELD_LAYER_LABEL_BY_ID,
  // Tier / phase / mode scoring maps
  PRESSURE_TIER_NORMALIZED,
  PRESSURE_TIER_URGENCY_LABEL,
  PRESSURE_TIER_MIN_HOLD_TICKS,
  PRESSURE_TIER_ESCALATION_THRESHOLD,
  PRESSURE_TIER_DEESCALATION_THRESHOLD,
  RUN_PHASE_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  RUN_PHASE_TICK_BUDGET_FRACTION,
  MODE_NORMALIZED,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_TENSION_FLOOR,
  MODE_MAX_DIVERGENCE,
  // Shield maps
  SHIELD_LAYER_ABSORPTION_ORDER,
  SHIELD_LAYER_CAPACITY_WEIGHT,
  // Timing maps
  TIMING_CLASS_WINDOW_PRIORITY,
  TIMING_CLASS_URGENCY_DECAY,
  // Bot maps
  BOT_THREAT_LEVEL,
  BOT_STATE_THREAT_MULTIPLIER,
  BOT_STATE_ALLOWED_TRANSITIONS,
  // Visibility / integrity / grade maps
  VISIBILITY_CONCEALMENT_FACTOR,
  INTEGRITY_STATUS_RISK_SCORE,
  VERIFIED_GRADE_NUMERIC_SCORE,
  // Card / deck maps
  DECK_TYPE_POWER_LEVEL,
  DECK_TYPE_IS_OFFENSIVE,
  CARD_RARITY_WEIGHT,
  ATTACK_CATEGORY_BASE_MAGNITUDE,
  ATTACK_CATEGORY_IS_COUNTERABLE,
  COUNTERABILITY_RESISTANCE_SCORE,
  TARGETING_SPREAD_FACTOR,
  DIVERGENCE_POTENTIAL_NORMALIZED,
  type EngineEventMap,
  type ModeCode,
  type PressureTier,
  type RunPhase,
  type RunOutcome,
  type ShieldLayerId,
  type HaterBotId,
  type TimingClass,
  type DeckType,
  type BotState,
  type Targeting,
  type Counterability,
  type AttackCategory,
  type CardRarity,
  type VerifiedGrade,
  type VisibilityLevel,
  type DivergencePotential,
  type IntegrityStatus,
} from '../core/GamePrimitives';
import type {
  OutcomeReasonCode,
  RunStateSnapshot,
} from '../core/RunStateSnapshot';
import { RuntimeOutcomeResolver } from '../core/RuntimeOutcomeResolver';
import { DEFAULT_MODE_REGISTRY, ModeRegistry } from '../modes/ModeRegistry';
import { SovereigntyEngine } from '../sovereignty/SovereigntyEngine';

// ============================================================================
// MARK: Internal type helpers
// ============================================================================

type RuntimeEventMap = EngineEventMap & Record<string, unknown>;

type Mutable<T> =
  T extends readonly (infer U)[]
    ? Mutable<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: Mutable<T[K]> }
      : T;

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// ============================================================================
// MARK: Original interfaces — terminal reconciliation surface
// ============================================================================

export interface RunShutdownInput {
  readonly snapshot: RunStateSnapshot;
  readonly nowMs?: number;
  readonly flushEvents?: boolean;
  readonly forceOutcome?: NonNullable<RunStateSnapshot['outcome']>;
  readonly reason?: string;
  readonly reasonCode?: OutcomeReasonCode | null;
}

export interface FlushedEventDigest {
  readonly sequence: number;
  readonly event: string;
  readonly emittedAtTick?: number;
  readonly tags?: readonly string[];
  readonly checksum: string;
}

export interface RunArchiveRecord {
  readonly runId: string;
  readonly userId: string;
  readonly seed: string;
  readonly mode: RunStateSnapshot['mode'];
  readonly tick: number;
  readonly phase: RunStateSnapshot['phase'];
  readonly outcome: NonNullable<RunStateSnapshot['outcome']>;
  readonly finalNetWorth: number;
  readonly proofHash: string | null;
  readonly integrityStatus: RunStateSnapshot['sovereignty']['integrityStatus'];
  readonly sovereigntyScore: number;
  readonly verifiedGrade: string | null;
  readonly stateChecksum: string;
  readonly shutdownSeal: string;
  readonly finalizedAtMs: number;
  readonly drainedEvents: readonly FlushedEventDigest[];
  readonly auditFlags: readonly string[];
  readonly tags: readonly string[];
}

export interface RunShutdownResult {
  readonly snapshot: RunStateSnapshot;
  readonly archive: RunArchiveRecord;
  readonly drained: readonly EventEnvelope<
    keyof RuntimeEventMap,
    RuntimeEventMap[keyof RuntimeEventMap]
  >[];
  readonly didFinalizeProof: boolean;
}

export interface RunShutdownPipelineDependencies {
  readonly bus: EventBus<RuntimeEventMap>;
  readonly sovereignty: SovereigntyEngine;
  readonly modeRegistry?: ModeRegistry;
  readonly now?: () => number;
}

// ============================================================================
// MARK: Analytics types — ML/DL/chat observability surface
// ============================================================================

/** Shutdown event severity tier — drives chat routing and NPC urgency. */
export type ShutdownSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Archive operation kind — logs what the shutdown pipeline actually did. */
export type ShutdownOperationKind =
  | 'SHUTDOWN_FORCED'
  | 'SHUTDOWN_RESOLVED'
  | 'OUTCOME_COERCED_ABANDONED'
  | 'MODE_FINALIZE_RAN'
  | 'PROOF_FINALIZED'
  | 'PROOF_ALREADY_PRESENT'
  | 'EVENTS_DRAINED'
  | 'EVENTS_SKIPPED'
  | 'ARCHIVE_BUILT'
  | 'POST_PROOF_EVENTS_EMITTED';

/**
 * 32-dimensional ML feature vector extracted from a shutdown result.
 * All values are normalized to [0, 1].
 */
export interface ShutdownMLVector {
  // Tick & phase features
  tick_normalized:             number; // 0
  phase_normalized:            number; // 1
  phase_stakes:                number; // 2
  phase_tick_budget:           number; // 3
  // Mode features
  mode_normalized:             number; // 4
  mode_difficulty:             number; // 5
  mode_tension_floor:          number; // 6
  // Outcome features
  outcome_freedom:             number; // 7
  outcome_timeout:             number; // 8
  outcome_bankrupt:            number; // 9
  outcome_abandoned:           number; // 10
  // Sovereignty features
  net_worth_normalized:        number; // 11
  sovereignty_score:           number; // 12
  integrity_risk:              number; // 13
  verified_grade_score:        number; // 14
  proof_present:               number; // 15
  did_finalize_proof:          number; // 16
  forced_outcome:              number; // 17
  // Event features
  drain_count_normalized:      number; // 18
  drain_rate:                  number; // 19
  audit_flag_ratio:            number; // 20
  tag_diversity:               number; // 21
  // State features
  shield_integrity:            number; // 22
  tension_level:               number; // 23
  cascade_depth:               number; // 24
  battle_activity:             number; // 25
  // Derived features
  net_worth_per_tick:          number; // 26
  sovereignty_per_tick:        number; // 27
  run_completeness:            number; // 28
  shutdown_quality:            number; // 29
  archive_integrity:           number; // 30
  proof_quality:               number; // 31
}

/** Single row in the 6×6 DL tensor — six normalized features. */
export interface ShutdownDLTensorRow {
  readonly label: string;
  readonly values: readonly [number, number, number, number, number, number];
}

/** 6×6 DL tensor — six domain rows, six feature columns each. */
export interface ShutdownDLTensor {
  readonly shape: readonly [6, 6];
  readonly rows: readonly [
    ShutdownDLTensorRow, // OUTCOME_PROFILE
    ShutdownDLTensorRow, // SOVEREIGNTY_PROFILE
    ShutdownDLTensorRow, // ECONOMY_PROFILE
    ShutdownDLTensorRow, // EVENT_PROFILE
    ShutdownDLTensorRow, // MODE_PHASE_PROFILE
    ShutdownDLTensorRow, // HEALTH_COMPOSITE
  ];
  readonly checksum: string;
}

/** Chat-ready signal derived from a shutdown result. */
export interface ShutdownChatSignal {
  readonly runId: string;
  readonly userId: string;
  readonly outcome: NonNullable<RunStateSnapshot['outcome']>;
  readonly severity: ShutdownSeverity;
  readonly healthScore: number;
  readonly proofPresent: boolean;
  readonly didFinalizeProof: boolean;
  readonly integrityStatus: IntegrityStatus;
  readonly verifiedGrade: VerifiedGrade | null;
  readonly sovereigntyScore: number;
  readonly finalNetWorth: number;
  readonly drainedEventCount: number;
  readonly auditFlagCount: number;
  readonly shutdownSeal: string;
  readonly mlVector: ShutdownMLVector;
  readonly narrationKey: string;
  readonly emittedAtMs: number;
}

/** Annotation bundle — structured commentary for downstream consumers. */
export interface ShutdownAnnotationBundle {
  readonly runId: string;
  readonly severity: ShutdownSeverity;
  readonly operationsLog: readonly ShutdownOperationKind[];
  readonly healthScore: number;
  readonly mlVector: ShutdownMLVector;
  readonly dlTensor: ShutdownDLTensor;
  readonly narrationHint: string;
  readonly actionRecommendation: string;
  readonly outcomeLabel: string;
  readonly integrityLabel: string;
  readonly gradeLabel: string;
  readonly archiveId: string;
}

/** Narration hint — single human-readable phrase for NPC or companion. */
export interface ShutdownNarrationHint {
  readonly key: string;
  readonly phrase: string;
  readonly urgency: ShutdownSeverity;
  readonly modeCode: ModeCode;
  readonly outcome: NonNullable<RunStateSnapshot['outcome']>;
}

/** Trend snapshot over a sliding window of shutdown results. */
export interface ShutdownTrendSnapshot {
  readonly windowSize: number;
  readonly avgHealthScore: number;
  readonly avgDrainCount: number;
  readonly avgSovereigntyScore: number;
  readonly forcedOutcomeRate: number;
  readonly proofFinalizedRate: number;
  readonly freedomRate: number;
  readonly bankruptcyRate: number;
  readonly abandonedRate: number;
  readonly healthTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
}

/** Session report — per-session analytics summary. */
export interface ShutdownSessionReport {
  readonly sessionId: string;
  readonly shutdownCount: number;
  readonly totalDrainedEvents: number;
  readonly forcedOutcomeCount: number;
  readonly proofFinalizedCount: number;
  readonly avgHealthScore: number;
  readonly lastOutcome: NonNullable<RunStateSnapshot['outcome']> | null;
  readonly lastSeverity: ShutdownSeverity;
  readonly startedAtMs: number;
  readonly lastShutdownAtMs: number | null;
}

/** Single entry in the shutdown event log. */
export interface ShutdownEventLogEntry {
  readonly entryId: string;
  readonly runId: string;
  readonly outcome: NonNullable<RunStateSnapshot['outcome']>;
  readonly severity: ShutdownSeverity;
  readonly healthScore: number;
  readonly drainedEventCount: number;
  readonly didFinalizeProof: boolean;
  readonly forcedOutcome: boolean;
  readonly shutdownSeal: string;
  readonly recordedAtMs: number;
  readonly checksum: string;
}

/** Inspection bundle — full-fidelity debug snapshot. */
export interface ShutdownInspectionBundle {
  readonly runId: string;
  readonly mlVector: ShutdownMLVector;
  readonly dlTensor: ShutdownDLTensor;
  readonly chatSignal: ShutdownChatSignal;
  readonly annotation: ShutdownAnnotationBundle;
  readonly narrationHint: ShutdownNarrationHint;
  readonly healthSnapshot: ShutdownHealthSnapshot;
  readonly operationKinds: readonly ShutdownOperationKind[];
  readonly inspectedAtMs: number;
}

/** Run summary — compact cross-run analytics record. */
export interface ShutdownRunSummary {
  readonly runId: string;
  readonly userId: string;
  readonly mode: ModeCode;
  readonly tick: number;
  readonly phase: RunPhase;
  readonly outcome: NonNullable<RunStateSnapshot['outcome']>;
  readonly healthScore: number;
  readonly severity: ShutdownSeverity;
  readonly sovereigntyScore: number;
  readonly finalNetWorth: number;
  readonly proofPresent: boolean;
  readonly integrityStatus: IntegrityStatus;
  readonly verifiedGrade: VerifiedGrade | null;
  readonly drainedEventCount: number;
  readonly auditFlagCount: number;
  readonly didFinalizeProof: boolean;
  readonly forcedOutcome: boolean;
  readonly archiveId: string;
  readonly shutdownSeal: string;
  readonly finalizedAtMs: number;
}

/** Health snapshot — single-moment wellness record. */
export interface ShutdownHealthSnapshot {
  readonly runId: string;
  readonly healthScore: number;
  readonly severity: ShutdownSeverity;
  readonly proofQuality: number;
  readonly sovereigntyQuality: number;
  readonly outcomeQuality: number;
  readonly archiveIntegrity: number;
  readonly overallQuality: number;
  readonly capturedAtMs: number;
}

/** Full export bundle — all analytics artifacts for a shutdown. */
export interface ShutdownExportBundle {
  readonly runId: string;
  readonly mlVector: ShutdownMLVector;
  readonly dlTensor: ShutdownDLTensor;
  readonly chatSignal: ShutdownChatSignal;
  readonly annotation: ShutdownAnnotationBundle;
  readonly runSummary: ShutdownRunSummary;
  readonly healthSnapshot: ShutdownHealthSnapshot;
  readonly sessionReport: ShutdownSessionReport;
  readonly trendSnapshot: ShutdownTrendSnapshot;
  readonly exportedAtMs: number;
}

/** Input type for standalone ML vector extraction (no full RunShutdownResult needed). */
export interface ShutdownMLVectorInput {
  readonly tick: number;
  readonly phase: RunPhase;
  readonly mode: ModeCode;
  readonly outcome: NonNullable<RunStateSnapshot['outcome']>;
  readonly netWorth: number;
  readonly sovereigntyScore: number;
  readonly integrityStatus: IntegrityStatus;
  readonly verifiedGrade: VerifiedGrade | null;
  readonly proofHash: string | null;
  readonly didFinalizeProof: boolean;
  readonly forceOutcome: boolean;
  readonly drainedEventCount: number;
  readonly auditFlagCount: number;
  readonly tagCount: number;
  readonly shieldIntegrityAvg: number;
  readonly tensionScore: number;
  readonly cascadeDepth: number;
  readonly battleIsActive: boolean;
  readonly battleRoundCount: number;
}

/** Full analytics dependencies (pipeline + analytics classes). */
export interface RunShutdownPipelineWithAnalytics {
  readonly pipeline: RunShutdownPipeline;
  readonly trendAnalyzer: ShutdownPipelineTrendAnalyzer;
  readonly sessionTracker: ShutdownPipelineSessionTracker;
  readonly eventLog: ShutdownPipelineEventLog;
  readonly annotator: ShutdownPipelineAnnotator;
  readonly inspector: ShutdownPipelineInspector;
}

// ============================================================================
// MARK: SHUTDOWN_* constant re-exports — GamePrimitives through shutdown lens
// ============================================================================

export const SHUTDOWN_MODE_CODES                            = MODE_CODES;
export const SHUTDOWN_PRESSURE_TIERS                        = PRESSURE_TIERS;
export const SHUTDOWN_RUN_PHASES                            = RUN_PHASES;
export const SHUTDOWN_RUN_OUTCOMES                          = RUN_OUTCOMES;
export const SHUTDOWN_SHIELD_LAYER_IDS                      = SHIELD_LAYER_IDS;
export const SHUTDOWN_HATER_BOT_IDS                         = HATER_BOT_IDS;
export const SHUTDOWN_TIMING_CLASSES                        = TIMING_CLASSES;
export const SHUTDOWN_DECK_TYPES                            = DECK_TYPES;
export const SHUTDOWN_VISIBILITY_LEVELS                     = VISIBILITY_LEVELS;
export const SHUTDOWN_INTEGRITY_STATUSES                    = INTEGRITY_STATUSES;
export const SHUTDOWN_VERIFIED_GRADES                       = VERIFIED_GRADES;
export const SHUTDOWN_SHIELD_LAYER_LABEL_BY_ID              = SHIELD_LAYER_LABEL_BY_ID;
export const SHUTDOWN_PRESSURE_TIER_NORMALIZED              = PRESSURE_TIER_NORMALIZED;
export const SHUTDOWN_PRESSURE_TIER_URGENCY_LABEL           = PRESSURE_TIER_URGENCY_LABEL;
export const SHUTDOWN_PRESSURE_TIER_MIN_HOLD_TICKS          = PRESSURE_TIER_MIN_HOLD_TICKS;
export const SHUTDOWN_PRESSURE_TIER_ESCALATION_THRESHOLD    = PRESSURE_TIER_ESCALATION_THRESHOLD;
export const SHUTDOWN_PRESSURE_TIER_DEESCALATION_THRESHOLD  = PRESSURE_TIER_DEESCALATION_THRESHOLD;
export const SHUTDOWN_RUN_PHASE_NORMALIZED                  = RUN_PHASE_NORMALIZED;
export const SHUTDOWN_RUN_PHASE_STAKES_MULTIPLIER           = RUN_PHASE_STAKES_MULTIPLIER;
export const SHUTDOWN_RUN_PHASE_TICK_BUDGET_FRACTION        = RUN_PHASE_TICK_BUDGET_FRACTION;
export const SHUTDOWN_MODE_NORMALIZED                       = MODE_NORMALIZED;
export const SHUTDOWN_MODE_DIFFICULTY_MULTIPLIER            = MODE_DIFFICULTY_MULTIPLIER;
export const SHUTDOWN_MODE_TENSION_FLOOR                    = MODE_TENSION_FLOOR;
export const SHUTDOWN_MODE_MAX_DIVERGENCE                   = MODE_MAX_DIVERGENCE;
export const SHUTDOWN_SHIELD_LAYER_ABSORPTION_ORDER         = SHIELD_LAYER_ABSORPTION_ORDER;
export const SHUTDOWN_SHIELD_LAYER_CAPACITY_WEIGHT          = SHIELD_LAYER_CAPACITY_WEIGHT;
export const SHUTDOWN_TIMING_CLASS_WINDOW_PRIORITY          = TIMING_CLASS_WINDOW_PRIORITY;
export const SHUTDOWN_TIMING_CLASS_URGENCY_DECAY            = TIMING_CLASS_URGENCY_DECAY;
export const SHUTDOWN_BOT_THREAT_LEVEL                      = BOT_THREAT_LEVEL;
export const SHUTDOWN_BOT_STATE_THREAT_MULTIPLIER           = BOT_STATE_THREAT_MULTIPLIER;
export const SHUTDOWN_BOT_STATE_ALLOWED_TRANSITIONS         = BOT_STATE_ALLOWED_TRANSITIONS;
export const SHUTDOWN_VISIBILITY_CONCEALMENT_FACTOR         = VISIBILITY_CONCEALMENT_FACTOR;
export const SHUTDOWN_INTEGRITY_STATUS_RISK_SCORE           = INTEGRITY_STATUS_RISK_SCORE;
export const SHUTDOWN_VERIFIED_GRADE_NUMERIC_SCORE          = VERIFIED_GRADE_NUMERIC_SCORE;
export const SHUTDOWN_CARD_RARITY_WEIGHT                    = CARD_RARITY_WEIGHT;
export const SHUTDOWN_DIVERGENCE_POTENTIAL_NORMALIZED       = DIVERGENCE_POTENTIAL_NORMALIZED;
export const SHUTDOWN_COUNTERABILITY_RESISTANCE_SCORE       = COUNTERABILITY_RESISTANCE_SCORE;
export const SHUTDOWN_TARGETING_SPREAD_FACTOR               = TARGETING_SPREAD_FACTOR;
export const SHUTDOWN_DECK_TYPE_POWER_LEVEL                 = DECK_TYPE_POWER_LEVEL;
export const SHUTDOWN_DECK_TYPE_IS_OFFENSIVE                = DECK_TYPE_IS_OFFENSIVE;
export const SHUTDOWN_ATTACK_CATEGORY_BASE_MAGNITUDE        = ATTACK_CATEGORY_BASE_MAGNITUDE;
export const SHUTDOWN_ATTACK_CATEGORY_IS_COUNTERABLE        = ATTACK_CATEGORY_IS_COUNTERABLE;

// ============================================================================
// MARK: Module constants
// ============================================================================

export const SHUTDOWN_ML_FEATURE_COUNT = 32 as const;
export const SHUTDOWN_DL_TENSOR_SHAPE  = [6, 6] as const;
export const SHUTDOWN_MODULE_VERSION   = '1.0.0' as const;
export const SHUTDOWN_MODULE_READY     = true as const;
export const SHUTDOWN_SCHEMA_VERSION   = 'shutdown-v1' as const;
export const SHUTDOWN_COMPLETE         = 'SHUTDOWN_COMPLETE' as const;
export const SHUTDOWN_MAX_TICK         = 300 as const;
export const SHUTDOWN_MAX_NET_WORTH    = 200_000 as const;
export const SHUTDOWN_MAX_DRAIN        = 500 as const;
export const SHUTDOWN_MAX_AUDIT_FLAGS  = 20 as const;
export const SHUTDOWN_MAX_TAGS         = 50 as const;
export const SHUTDOWN_MAX_BOT_THREAT   = 1.0 as const;

export const SHUTDOWN_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'tick_normalized',
  'phase_normalized',
  'phase_stakes',
  'phase_tick_budget',
  'mode_normalized',
  'mode_difficulty',
  'mode_tension_floor',
  'outcome_freedom',
  'outcome_timeout',
  'outcome_bankrupt',
  'outcome_abandoned',
  'net_worth_normalized',
  'sovereignty_score',
  'integrity_risk',
  'verified_grade_score',
  'proof_present',
  'did_finalize_proof',
  'forced_outcome',
  'drain_count_normalized',
  'drain_rate',
  'audit_flag_ratio',
  'tag_diversity',
  'shield_integrity',
  'tension_level',
  'cascade_depth',
  'battle_activity',
  'net_worth_per_tick',
  'sovereignty_per_tick',
  'run_completeness',
  'shutdown_quality',
  'archive_integrity',
  'proof_quality',
]);

export const SHUTDOWN_DL_ROW_LABELS: readonly string[] = Object.freeze([
  'OUTCOME_PROFILE',
  'SOVEREIGNTY_PROFILE',
  'ECONOMY_PROFILE',
  'EVENT_PROFILE',
  'MODE_PHASE_PROFILE',
  'HEALTH_COMPOSITE',
]);

export const SHUTDOWN_DL_COL_LABELS: readonly string[] = Object.freeze([
  'primary',
  'secondary',
  'tertiary',
  'context',
  'modifier',
  'composite',
]);

export const SHUTDOWN_ALL_OUTCOME_WEIGHTS: Record<NonNullable<RunStateSnapshot['outcome']>, number> = Object.freeze({
  FREEDOM:   1.0,
  TIMEOUT:   0.4,
  BANKRUPT:  0.1,
  ABANDONED: 0.0,
});

export const SHUTDOWN_SEVERITY_THRESHOLDS: Record<ShutdownSeverity, number> = Object.freeze({
  LOW:      0.75,
  MEDIUM:   0.50,
  HIGH:     0.30,
  CRITICAL: 0.0,
});

export const SHUTDOWN_MODE_NARRATION: Record<ModeCode, string> = Object.freeze({
  solo:  'Your empire stands or falls alone.',
  pvp:   'The predator who blinks first, loses.',
  coop:  'The syndicate lives or dies together.',
  ghost: 'Phantoms leave no evidence. Only outcomes.',
});

export const SHUTDOWN_OUTCOME_NARRATION: Record<NonNullable<RunStateSnapshot['outcome']>, string> = Object.freeze({
  FREEDOM:   'Freedom achieved. The run is sealed in sovereignty.',
  TIMEOUT:   'Time expired. The run closes with dignity.',
  BANKRUPT:  'Bankruptcy declared. The run is archived.',
  ABANDONED: 'Run abandoned. The archive is sealed.',
});

// Aggregate derived constants — one per analytics dimension
export const SHUTDOWN_TIMING_PRIORITY_AVG: number = (() => {
  const values = Object.values(TIMING_CLASS_WINDOW_PRIORITY);
  return values.reduce((a, b) => a + b, 0) / values.length;
})();

export const SHUTDOWN_DECK_POWER_AVG: number = (() => {
  const values = Object.values(DECK_TYPE_POWER_LEVEL);
  return values.reduce((a, b) => a + b, 0) / values.length;
})();

export const SHUTDOWN_CARD_RARITY_WEIGHT_AVG: number = (() => {
  const values = Object.values(CARD_RARITY_WEIGHT);
  return values.reduce((a, b) => a + b, 0) / values.length;
})();

export const SHUTDOWN_COUNTERABILITY_AVG: number = (() => {
  const values = Object.values(COUNTERABILITY_RESISTANCE_SCORE);
  return values.reduce((a, b) => a + b, 0) / values.length;
})();

export const SHUTDOWN_VISIBILITY_CONCEALMENT_AVG: number = (() => {
  const values = Object.values(VISIBILITY_CONCEALMENT_FACTOR);
  return values.reduce((a, b) => a + b, 0) / values.length;
})();

export const SHUTDOWN_INTEGRITY_RISK_AVG: number = (() => {
  const values = Object.values(INTEGRITY_STATUS_RISK_SCORE);
  return values.reduce((a, b) => a + b, 0) / values.length;
})();

export const SHUTDOWN_VERIFIED_GRADE_AVG: number = (() => {
  const values = Object.values(VERIFIED_GRADE_NUMERIC_SCORE);
  return values.reduce((a, b) => a + b, 0) / values.length;
})();

export const SHUTDOWN_ATTACK_MAGNITUDE_AVG: number = (() => {
  const values = Object.values(ATTACK_CATEGORY_BASE_MAGNITUDE);
  return values.reduce((a, b) => a + b, 0) / values.length;
})();

export const SHUTDOWN_TARGETING_SPREAD_AVG: number = (() => {
  const values = Object.values(TARGETING_SPREAD_FACTOR);
  return values.reduce((a, b) => a + b, 0) / values.length;
})();

export const SHUTDOWN_BOT_THREAT_MAX: number = Math.max(...Object.values(BOT_THREAT_LEVEL));

// ============================================================================
// MARK: Analytics functions — extract, build, compute, classify
// ============================================================================

/**
 * Extract a 32-dim ML feature vector from shutdown input state.
 * All values normalized to [0, 1].
 */
export function extractShutdownMLVector(input: ShutdownMLVectorInput): ShutdownMLVector {
  const {
    tick, phase, mode, outcome, netWorth, sovereigntyScore,
    integrityStatus, verifiedGrade, proofHash, didFinalizeProof,
    forceOutcome, drainedEventCount, auditFlagCount, tagCount,
    shieldIntegrityAvg, tensionScore, cascadeDepth,
    battleIsActive, battleRoundCount,
  } = input;

  const tickN          = clamp01(tick / SHUTDOWN_MAX_TICK);
  const phaseN         = RUN_PHASE_NORMALIZED[phase];
  const phaseStakes    = RUN_PHASE_STAKES_MULTIPLIER[phase];
  const phaseBudget    = RUN_PHASE_TICK_BUDGET_FRACTION[phase];
  const modeN          = MODE_NORMALIZED[mode];
  const modeDiff       = clamp01(MODE_DIFFICULTY_MULTIPLIER[mode] / 1.6);
  const modeTensFloor  = MODE_TENSION_FLOOR[mode];

  const outFreedom   = outcome === 'FREEDOM'   ? 1 : 0;
  const outTimeout   = outcome === 'TIMEOUT'   ? 1 : 0;
  const outBankrupt  = outcome === 'BANKRUPT'  ? 1 : 0;
  const outAbandoned = outcome === 'ABANDONED' ? 1 : 0;

  const nwN            = clamp01(netWorth / SHUTDOWN_MAX_NET_WORTH);
  const sovN           = clamp01(sovereigntyScore / 100);
  const intRisk        = INTEGRITY_STATUS_RISK_SCORE[integrityStatus];
  const gradeScore     = verifiedGrade !== null ? VERIFIED_GRADE_NUMERIC_SCORE[verifiedGrade] : 0;
  const proofPresentN  = proofHash !== null ? 1 : 0;
  const finalizeN      = didFinalizeProof ? 1 : 0;
  const forcedN        = forceOutcome ? 1 : 0;

  const drainN         = clamp01(drainedEventCount / SHUTDOWN_MAX_DRAIN);
  const drainRate      = clamp01(drainedEventCount / Math.max(tick, 1) / 5);
  const auditRatio     = clamp01(auditFlagCount / SHUTDOWN_MAX_AUDIT_FLAGS);
  const tagDiv         = clamp01(tagCount / SHUTDOWN_MAX_TAGS);

  const shieldN        = clamp01(shieldIntegrityAvg);
  const tensionN       = clamp01(tensionScore / 100);
  const cascadeN       = clamp01(cascadeDepth / 10);
  const battleN        = battleIsActive ? clamp01(battleRoundCount / 30) : 0;

  const nwPerTick      = clamp01(netWorth / Math.max(tick, 1) / 5000);
  const sovPerTick     = clamp01(sovereigntyScore / Math.max(tick, 1) / 5);

  const runComplete =
    phase === 'SOVEREIGNTY' ? 1.0 :
    phase === 'ESCALATION'  ? 0.67 :
                              0.33;

  const shutdownQual = clamp01(
    proofPresentN  * 0.30 +
    (1 - intRisk)  * 0.30 +
    gradeScore     * 0.20 +
    (1 - forcedN * 0.5) * 0.20,
  );

  const archiveInteg = 1.0; // archive is always fully built if we reach this point

  const proofQual = proofPresentN === 0 ? 0 :
    integrityStatus === 'VERIFIED'    ? 1.0 :
    integrityStatus === 'PENDING'     ? 0.6 :
    integrityStatus === 'UNVERIFIED'  ? 0.3 :
                                        0.05;

  return {
    tick_normalized:       tickN,
    phase_normalized:      phaseN,
    phase_stakes:          phaseStakes,
    phase_tick_budget:     phaseBudget,
    mode_normalized:       modeN,
    mode_difficulty:       modeDiff,
    mode_tension_floor:    modeTensFloor,
    outcome_freedom:       outFreedom,
    outcome_timeout:       outTimeout,
    outcome_bankrupt:      outBankrupt,
    outcome_abandoned:     outAbandoned,
    net_worth_normalized:  nwN,
    sovereignty_score:     sovN,
    integrity_risk:        intRisk,
    verified_grade_score:  gradeScore,
    proof_present:         proofPresentN,
    did_finalize_proof:    finalizeN,
    forced_outcome:        forcedN,
    drain_count_normalized: drainN,
    drain_rate:            drainRate,
    audit_flag_ratio:      auditRatio,
    tag_diversity:         tagDiv,
    shield_integrity:      shieldN,
    tension_level:         tensionN,
    cascade_depth:         cascadeN,
    battle_activity:       battleN,
    net_worth_per_tick:    nwPerTick,
    sovereignty_per_tick:  sovPerTick,
    run_completeness:      runComplete,
    shutdown_quality:      shutdownQual,
    archive_integrity:     archiveInteg,
    proof_quality:         proofQual,
  };
}

/**
 * Build the 6×6 DL tensor from a shutdown ML vector.
 */
export function buildShutdownDLTensor(
  vec: ShutdownMLVector,
  archive: RunArchiveRecord,
): ShutdownDLTensor {
  const shape = SHUTDOWN_DL_TENSOR_SHAPE;

  const outcomeRow: ShutdownDLTensorRow = {
    label: 'OUTCOME_PROFILE',
    values: [
      vec.outcome_freedom,
      vec.outcome_timeout,
      vec.outcome_bankrupt,
      vec.outcome_abandoned,
      vec.forced_outcome,
      clamp01(SHUTDOWN_ALL_OUTCOME_WEIGHTS[archive.outcome]),
    ],
  };

  const sovereigntyRow: ShutdownDLTensorRow = {
    label: 'SOVEREIGNTY_PROFILE',
    values: [
      vec.proof_present,
      1 - vec.integrity_risk,
      vec.verified_grade_score,
      vec.sovereignty_score,
      1 - vec.audit_flag_ratio,
      vec.proof_quality,
    ],
  };

  const economyRow: ShutdownDLTensorRow = {
    label: 'ECONOMY_PROFILE',
    values: [
      vec.net_worth_normalized,
      vec.phase_stakes,
      vec.net_worth_per_tick,
      vec.sovereignty_per_tick,
      vec.mode_difficulty,
      vec.tension_level,
    ],
  };

  const eventRow: ShutdownDLTensorRow = {
    label: 'EVENT_PROFILE',
    values: [
      vec.drain_count_normalized,
      vec.drain_rate,
      1 - vec.audit_flag_ratio,
      vec.tag_diversity,
      1 - vec.cascade_depth,
      1 - vec.battle_activity,
    ],
  };

  const modePhaseRow: ShutdownDLTensorRow = {
    label: 'MODE_PHASE_PROFILE',
    values: [
      vec.mode_normalized,
      1 - vec.mode_tension_floor,
      vec.phase_normalized,
      vec.phase_tick_budget,
      vec.tick_normalized,
      vec.run_completeness,
    ],
  };

  const healthRow: ShutdownDLTensorRow = {
    label: 'HEALTH_COMPOSITE',
    values: [
      vec.shutdown_quality,
      vec.archive_integrity,
      vec.proof_quality,
      vec.did_finalize_proof,
      1 - vec.integrity_risk,
      computeShutdownHealthScore(vec),
    ],
  };

  // Use labels to ensure all row/col label constants are accessed
  void SHUTDOWN_DL_ROW_LABELS;
  void SHUTDOWN_DL_COL_LABELS;

  const rows = [outcomeRow, sovereigntyRow, economyRow, eventRow, modePhaseRow, healthRow] as const;

  const checksum = checksumSnapshot({
    shape,
    rows: rows.map((r) => ({ label: r.label, values: [...r.values] })),
  });

  return Object.freeze({ shape, rows, checksum });
}

/**
 * Derive a chat signal from a shutdown result and archive.
 */
export function buildShutdownChatSignal(
  result: RunShutdownResult,
  mlVector: ShutdownMLVector,
  emittedAtMs: number,
): ShutdownChatSignal {
  const { archive, didFinalizeProof } = result;
  const severity = classifyShutdownSeverity(mlVector);
  const healthScore = computeShutdownHealthScore(mlVector);

  const narrationKey = `shutdown.${result.snapshot.mode}.${archive.outcome.toLowerCase()}`;

  return Object.freeze({
    runId:              archive.runId,
    userId:             archive.userId,
    outcome:            archive.outcome,
    severity,
    healthScore,
    proofPresent:       archive.proofHash !== null,
    didFinalizeProof,
    integrityStatus:    archive.integrityStatus as IntegrityStatus,
    verifiedGrade:      (archive.verifiedGrade as VerifiedGrade | null),
    sovereigntyScore:   archive.sovereigntyScore,
    finalNetWorth:      archive.finalNetWorth,
    drainedEventCount:  archive.drainedEvents.length,
    auditFlagCount:     archive.auditFlags.length,
    shutdownSeal:       archive.shutdownSeal,
    mlVector,
    narrationKey,
    emittedAtMs,
  });
}

/**
 * Build an annotation bundle from a shutdown result.
 */
export function buildShutdownAnnotation(
  result: RunShutdownResult,
  mlVector: ShutdownMLVector,
  dlTensor: ShutdownDLTensor,
  operations: readonly ShutdownOperationKind[],
  verbosity: 'DEFAULT' | 'STRICT' | 'VERBOSE' = 'DEFAULT',
): ShutdownAnnotationBundle {
  const { archive } = result;
  const severity    = classifyShutdownSeverity(mlVector);
  const healthScore = computeShutdownHealthScore(mlVector);
  const narration   = getShutdownNarrationHintPhrase(result.snapshot.mode as ModeCode, archive.outcome);
  const action      = getShutdownActionRecommendation(severity, archive.outcome);

  const outcomeLabel    = SHUTDOWN_OUTCOME_NARRATION[archive.outcome] ?? archive.outcome;
  const integrityLabel  = SHUTDOWN_INTEGRITY_STATUSES.includes(archive.integrityStatus as IntegrityStatus)
    ? `Integrity: ${archive.integrityStatus}`
    : 'Integrity: UNKNOWN';
  const gradeLabel      = archive.verifiedGrade ? `Grade: ${archive.verifiedGrade}` : 'Grade: UNGRADED';

  if (verbosity === 'STRICT' && severity === 'LOW') {
    return Object.freeze({
      runId: archive.runId,
      severity,
      operationsLog: operations,
      healthScore,
      mlVector,
      dlTensor,
      narrationHint:        narration,
      actionRecommendation: action,
      outcomeLabel,
      integrityLabel,
      gradeLabel,
      archiveId: archive.shutdownSeal,
    });
  }

  return Object.freeze({
    runId: archive.runId,
    severity,
    operationsLog: verbosity === 'VERBOSE' ? operations : freezeArray(operations.slice(0, 5)),
    healthScore,
    mlVector,
    dlTensor,
    narrationHint:        narration,
    actionRecommendation: action,
    outcomeLabel,
    integrityLabel,
    gradeLabel,
    archiveId: archive.shutdownSeal,
  });
}

/** Build a narration hint for the given shutdown context. */
export function buildShutdownNarrationHint(
  mode: ModeCode,
  outcome: NonNullable<RunStateSnapshot['outcome']>,
  severity: ShutdownSeverity,
): ShutdownNarrationHint {
  return Object.freeze({
    key:     `shutdown.narration.${mode}.${outcome.toLowerCase()}`,
    phrase:  getShutdownNarrationHintPhrase(mode, outcome),
    urgency: severity,
    modeCode: mode,
    outcome,
  });
}

/** Build a health snapshot from a vector. */
export function buildShutdownHealthSnapshot(
  runId: string,
  mlVector: ShutdownMLVector,
  capturedAtMs: number,
): ShutdownHealthSnapshot {
  const healthScore       = computeShutdownHealthScore(mlVector);
  const severity          = classifyShutdownSeverity(mlVector);
  const proofQuality      = mlVector.proof_quality;
  const sovereigntyQuality = mlVector.sovereignty_score;
  const outcomeQuality    = mlVector.outcome_freedom * 1.0
    + mlVector.outcome_timeout  * 0.4
    + mlVector.outcome_bankrupt * 0.1;
  const archiveIntegrity  = mlVector.archive_integrity;
  const overallQuality    = clamp01(
    proofQuality * 0.25 + sovereigntyQuality * 0.25 +
    outcomeQuality * 0.25 + archiveIntegrity * 0.25,
  );

  return Object.freeze({
    runId,
    healthScore,
    severity,
    proofQuality,
    sovereigntyQuality,
    outcomeQuality,
    archiveIntegrity,
    overallQuality,
    capturedAtMs,
  });
}

/** Build a run summary record from a shutdown result. */
export function buildShutdownRunSummary(
  result: RunShutdownResult,
  mlVector: ShutdownMLVector,
  forcedOutcome: boolean,
): ShutdownRunSummary {
  const { archive, snapshot, didFinalizeProof } = result;
  const severity    = classifyShutdownSeverity(mlVector);
  const healthScore = computeShutdownHealthScore(mlVector);

  return Object.freeze({
    runId:             archive.runId,
    userId:            archive.userId,
    mode:              snapshot.mode as ModeCode,
    tick:              archive.tick,
    phase:             archive.phase as RunPhase,
    outcome:           archive.outcome,
    healthScore,
    severity,
    sovereigntyScore:  archive.sovereigntyScore,
    finalNetWorth:     archive.finalNetWorth,
    proofPresent:      archive.proofHash !== null,
    integrityStatus:   archive.integrityStatus as IntegrityStatus,
    verifiedGrade:     archive.verifiedGrade as VerifiedGrade | null,
    drainedEventCount: archive.drainedEvents.length,
    auditFlagCount:    archive.auditFlags.length,
    didFinalizeProof,
    forcedOutcome,
    archiveId:         archive.shutdownSeal,
    shutdownSeal:      archive.shutdownSeal,
    finalizedAtMs:     archive.finalizedAtMs,
  });
}

/** Compute a [0, 1] health score from a shutdown ML vector. */
export function computeShutdownHealthScore(vec: ShutdownMLVector): number {
  return clamp01(
    vec.shutdown_quality        * 0.30 +
    vec.proof_quality           * 0.20 +
    vec.sovereignty_score       * 0.15 +
    (1 - vec.integrity_risk)    * 0.15 +
    vec.net_worth_normalized    * 0.10 +
    vec.run_completeness        * 0.10,
  );
}

/** Classify the severity of a shutdown based on its ML vector. */
export function classifyShutdownSeverity(vec: ShutdownMLVector): ShutdownSeverity {
  const score = computeShutdownHealthScore(vec);
  if (score >= SHUTDOWN_SEVERITY_THRESHOLDS.LOW)      return 'LOW';
  if (score >= SHUTDOWN_SEVERITY_THRESHOLDS.MEDIUM)   return 'MEDIUM';
  if (score >= SHUTDOWN_SEVERITY_THRESHOLDS.HIGH)     return 'HIGH';
  return 'CRITICAL';
}

/** Get a recommended follow-up action based on severity and outcome. */
export function getShutdownActionRecommendation(
  severity: ShutdownSeverity,
  outcome: NonNullable<RunStateSnapshot['outcome']>,
): string {
  if (severity === 'CRITICAL' || outcome === 'BANKRUPT') {
    return 'Conduct immediate forensic audit. Review sovereignty proof integrity.';
  }
  if (severity === 'HIGH' || outcome === 'ABANDONED') {
    return 'Review run archive. Investigate abandonment trigger. Monitor next session.';
  }
  if (severity === 'MEDIUM' || outcome === 'TIMEOUT') {
    return 'Analyze tick budget usage. Consider pacing adjustments for next run.';
  }
  return 'Archive accepted. Run quality is solid. No immediate action required.';
}

/** Get the narration phrase for a given mode and outcome. */
export function getShutdownNarrationHintPhrase(
  mode: ModeCode,
  outcome: NonNullable<RunStateSnapshot['outcome']>,
): string {
  const modePhrase = SHUTDOWN_MODE_NARRATION[mode];
  const outcomePhrase = SHUTDOWN_OUTCOME_NARRATION[outcome];
  return `${modePhrase} ${outcomePhrase}`;
}

/** Compute the outcome quality weight for a given outcome. */
export function computeShutdownOutcomeWeight(
  outcome: NonNullable<RunStateSnapshot['outcome']>,
): number {
  return SHUTDOWN_ALL_OUTCOME_WEIGHTS[outcome] ?? 0;
}

/** Compute shutdown mode weight (difficulty × stakes). */
export function computeShutdownModeWeight(mode: ModeCode, phase: RunPhase): number {
  return clamp01(MODE_DIFFICULTY_MULTIPLIER[mode] * RUN_PHASE_STAKES_MULTIPLIER[phase] / 1.6);
}

/** Compute max divergence score for a mode. */
export function computeShutdownDivergenceScore(mode: ModeCode): number {
  return DIVERGENCE_POTENTIAL_NORMALIZED[MODE_MAX_DIVERGENCE[mode]];
}

/** Compute bot threat aggregate for a given pressure tier. */
export function computeShutdownBotThreatScore(tier: PressureTier): number {
  const tierN = PRESSURE_TIER_NORMALIZED[tier];
  return clamp01(
    HATER_BOT_IDS.reduce(
      (acc, id) => acc + BOT_THREAT_LEVEL[id] * BOT_STATE_THREAT_MULTIPLIER['ATTACKING'] * tierN,
      0,
    ) / HATER_BOT_IDS.length,
  );
}

/** Get allowed transitions for a given bot state. */
export function getShutdownBotTransitions(state: BotState): readonly BotState[] {
  return BOT_STATE_ALLOWED_TRANSITIONS[state];
}

/** Get concealment factor for a visibility level. */
export function getShutdownVisibilityConcealment(level: VisibilityLevel): number {
  return VISIBILITY_CONCEALMENT_FACTOR[level];
}

/** Get counterability resistance score. */
export function getShutdownCounterabilityScore(c: Counterability): number {
  return COUNTERABILITY_RESISTANCE_SCORE[c];
}

/** Get targeting spread factor. */
export function getShutdownTargetingSpread(t: Targeting): number {
  return TARGETING_SPREAD_FACTOR[t];
}

/** Get divergence potential normalized value. */
export function getShutdownDivergenceNorm(d: DivergencePotential): number {
  return DIVERGENCE_POTENTIAL_NORMALIZED[d];
}

/** Get deck type power level. */
export function getShutdownDeckPower(d: DeckType): number {
  return DECK_TYPE_POWER_LEVEL[d];
}

/** Get card rarity weight. */
export function getShutdownCardRarityWeight(r: CardRarity): number {
  return CARD_RARITY_WEIGHT[r];
}

/** Get attack category base magnitude. */
export function getShutdownAttackMagnitude(cat: AttackCategory): number {
  return ATTACK_CATEGORY_BASE_MAGNITUDE[cat];
}

/** Whether an attack category is counterable. */
export function isShutdownAttackCounterable(cat: AttackCategory): boolean {
  return ATTACK_CATEGORY_IS_COUNTERABLE[cat];
}

/** Get timing class priority. */
export function getShutdownTimingPriority(tc: TimingClass): number {
  return TIMING_CLASS_WINDOW_PRIORITY[tc];
}

/** Get timing class urgency decay. */
export function getShutdownTimingUrgencyDecay(tc: TimingClass): number {
  return TIMING_CLASS_URGENCY_DECAY[tc];
}

/** Get shield layer capacity weight. */
export function getShutdownShieldCapacityWeight(layer: ShieldLayerId): number {
  return SHIELD_LAYER_CAPACITY_WEIGHT[layer];
}

/** Get verified grade numeric score. */
export function getShutdownVerifiedGradeScore(grade: VerifiedGrade): number {
  return VERIFIED_GRADE_NUMERIC_SCORE[grade];
}

/** Get integrity status risk score. */
export function getShutdownIntegrityRiskScore(status: IntegrityStatus): number {
  return INTEGRITY_STATUS_RISK_SCORE[status];
}

/** Get shield layer label. */
export function getShutdownShieldLayerLabel(layer: ShieldLayerId): string {
  return SHIELD_LAYER_LABEL_BY_ID[layer];
}

/** Get hater bot threat level. */
export function getShutdownBotThreatLevel(botId: HaterBotId): number {
  return BOT_THREAT_LEVEL[botId];
}

// ============================================================================
// MARK: Vector utilities
// ============================================================================

/** Validate that all 32 features are finite numbers in [0, 1]. */
export function validateShutdownMLVector(vec: ShutdownMLVector): boolean {
  return (Object.values(vec) as number[]).every(
    (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1,
  );
}

/** Flatten the vector to a plain number array (index-stable). */
export function flattenShutdownMLVector(vec: ShutdownMLVector): readonly number[] {
  return Object.freeze(SHUTDOWN_ML_FEATURE_LABELS.map((k) => (vec as unknown as Record<string, number>)[k] ?? 0));
}

/** Flatten the DL tensor to a [6][6] number array. */
export function flattenShutdownDLTensor(tensor: ShutdownDLTensor): readonly (readonly number[])[] {
  return Object.freeze(tensor.rows.map((r) => Object.freeze([...r.values])));
}

/** Build a named feature map from a vector. */
export function buildShutdownMLNamedMap(vec: ShutdownMLVector): Readonly<Record<string, number>> {
  const map: Record<string, number> = {};
  for (const k of SHUTDOWN_ML_FEATURE_LABELS) {
    map[k] = (vec as unknown as Record<string, number>)[k] ?? 0;
  }
  return Object.freeze(map);
}

/** Extract a specific column across all DL tensor rows. */
export function extractShutdownDLColumn(
  tensor: ShutdownDLTensor,
  colIndex: number,
): readonly number[] {
  return Object.freeze(tensor.rows.map((r) => r.values[colIndex] ?? 0));
}

/** Compute cosine similarity between two ML vectors. */
export function computeShutdownMLSimilarity(a: ShutdownMLVector, b: ShutdownMLVector): number {
  const fa = flattenShutdownMLVector(a) as number[];
  const fb = flattenShutdownMLVector(b) as number[];
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < fa.length; i++) {
    dot  += fa[i]! * fb[i]!;
    magA += fa[i]! * fa[i]!;
    magB += fb[i]! * fb[i]!;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : clamp01(dot / denom);
}

/** Get the top-N features by absolute value. */
export function getTopShutdownFeatures(
  vec: ShutdownMLVector,
  topN: number = 5,
): readonly { label: string; value: number }[] {
  const pairs = SHUTDOWN_ML_FEATURE_LABELS.map((k) => ({
    label: k,
    value: (vec as unknown as Record<string, number>)[k] ?? 0,
  }));
  pairs.sort((a, b) => b.value - a.value);
  return Object.freeze(pairs.slice(0, topN));
}

/** Serialize a vector to a stable JSON string. */
export function serializeShutdownMLVector(vec: ShutdownMLVector): string {
  return stableStringify(buildShutdownMLNamedMap(vec));
}

/** Serialize a DL tensor to a stable JSON string. */
export function serializeShutdownDLTensor(tensor: ShutdownDLTensor): string {
  return stableStringify(flattenShutdownDLTensor(tensor));
}

/** Deep clone a vector. */
export function cloneShutdownMLVector(vec: ShutdownMLVector): ShutdownMLVector {
  return cloneJson(vec) as ShutdownMLVector;
}

// ============================================================================
// MARK: Type guards
// ============================================================================

export function isShutdownSeverity(v: unknown): v is ShutdownSeverity {
  return v === 'LOW' || v === 'MEDIUM' || v === 'HIGH' || v === 'CRITICAL';
}

export function isShutdownOperationKind(v: unknown): v is ShutdownOperationKind {
  return (
    v === 'SHUTDOWN_FORCED' ||
    v === 'SHUTDOWN_RESOLVED' ||
    v === 'OUTCOME_COERCED_ABANDONED' ||
    v === 'MODE_FINALIZE_RAN' ||
    v === 'PROOF_FINALIZED' ||
    v === 'PROOF_ALREADY_PRESENT' ||
    v === 'EVENTS_DRAINED' ||
    v === 'EVENTS_SKIPPED' ||
    v === 'ARCHIVE_BUILT' ||
    v === 'POST_PROOF_EVENTS_EMITTED'
  );
}

export function isShutdownOutcome(v: unknown): v is NonNullable<RunStateSnapshot['outcome']> {
  return v === 'FREEDOM' || v === 'TIMEOUT' || v === 'BANKRUPT' || v === 'ABANDONED';
}

// ============================================================================
// MARK: Analytics classes
// ============================================================================

/** Sliding-window trend analysis over recent shutdown health scores. */
export class ShutdownPipelineTrendAnalyzer {
  private readonly windowSize: number;
  private readonly healthWindow: number[] = [];
  private readonly drainWindow: number[] = [];
  private readonly sovWindow: number[] = [];
  private forcedCount = 0;
  private proofCount = 0;
  private freedomCount = 0;
  private bankruptCount = 0;
  private abandonedCount = 0;
  private totalCount = 0;

  public constructor(windowSize: number = 20) {
    this.windowSize = Math.max(2, windowSize);
  }

  public record(summary: ShutdownRunSummary): void {
    this.totalCount++;
    this._push(this.healthWindow, summary.healthScore);
    this._push(this.drainWindow,  summary.drainedEventCount / SHUTDOWN_MAX_DRAIN);
    this._push(this.sovWindow,    summary.sovereigntyScore / 100);
    if (summary.forcedOutcome)    this.forcedCount++;
    if (summary.didFinalizeProof) this.proofCount++;
    if (summary.outcome === 'FREEDOM')   this.freedomCount++;
    if (summary.outcome === 'BANKRUPT')  this.bankruptCount++;
    if (summary.outcome === 'ABANDONED') this.abandonedCount++;
  }

  public snapshot(): ShutdownTrendSnapshot {
    const n = this.totalCount || 1;
    const avgH = this._avg(this.healthWindow);
    const trend = this._healthTrend();

    return Object.freeze({
      windowSize:          this.windowSize,
      avgHealthScore:      avgH,
      avgDrainCount:       this._avg(this.drainWindow) * SHUTDOWN_MAX_DRAIN,
      avgSovereigntyScore: this._avg(this.sovWindow) * 100,
      forcedOutcomeRate:   clamp01(this.forcedCount / n),
      proofFinalizedRate:  clamp01(this.proofCount  / n),
      freedomRate:         clamp01(this.freedomCount / n),
      bankruptcyRate:      clamp01(this.bankruptCount / n),
      abandonedRate:       clamp01(this.abandonedCount / n),
      healthTrend:         trend,
    });
  }

  public reset(): void {
    this.healthWindow.length = 0;
    this.drainWindow.length = 0;
    this.sovWindow.length = 0;
    this.forcedCount = 0;
    this.proofCount  = 0;
    this.freedomCount = 0;
    this.bankruptCount = 0;
    this.abandonedCount = 0;
    this.totalCount = 0;
  }

  private _push(arr: number[], v: number): void {
    arr.push(clamp01(v));
    if (arr.length > this.windowSize) arr.shift();
  }

  private _avg(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private _healthTrend(): 'IMPROVING' | 'STABLE' | 'DEGRADING' {
    const w = this.healthWindow;
    if (w.length < 4) return 'STABLE';
    const half = Math.floor(w.length / 2);
    const earlyAvg = w.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const lateAvg  = w.slice(half).reduce((a, b) => a + b, 0) / (w.length - half);
    const delta = lateAvg - earlyAvg;
    if (delta >  0.05) return 'IMPROVING';
    if (delta < -0.05) return 'DEGRADING';
    return 'STABLE';
  }
}

/** Per-session tracking — persists across multiple shutdowns in the same session. */
export class ShutdownPipelineSessionTracker {
  private readonly sessionId: string;
  private readonly startedAtMs: number;
  private shutdownCount = 0;
  private totalDrainedEvents = 0;
  private forcedOutcomeCount = 0;
  private proofFinalizedCount = 0;
  private healthScoreSum = 0;
  private lastOutcome: NonNullable<RunStateSnapshot['outcome']> | null = null;
  private lastSeverity: ShutdownSeverity = 'LOW';
  private lastShutdownAtMs: number | null = null;

  public constructor(nowMs: number = Date.now()) {
    this.sessionId   = createDeterministicId('shutdown-session', nowMs.toString());
    this.startedAtMs = nowMs;
  }

  public record(summary: ShutdownRunSummary, nowMs: number = Date.now()): void {
    this.shutdownCount++;
    this.totalDrainedEvents += summary.drainedEventCount;
    if (summary.forcedOutcome)    this.forcedOutcomeCount++;
    if (summary.didFinalizeProof) this.proofFinalizedCount++;
    this.healthScoreSum      += summary.healthScore;
    this.lastOutcome          = summary.outcome;
    this.lastSeverity         = summary.severity;
    this.lastShutdownAtMs     = nowMs;
  }

  public report(): ShutdownSessionReport {
    return Object.freeze({
      sessionId:          this.sessionId,
      shutdownCount:      this.shutdownCount,
      totalDrainedEvents: this.totalDrainedEvents,
      forcedOutcomeCount: this.forcedOutcomeCount,
      proofFinalizedCount: this.proofFinalizedCount,
      avgHealthScore:     this.shutdownCount > 0
                            ? clamp01(this.healthScoreSum / this.shutdownCount)
                            : 0,
      lastOutcome:        this.lastOutcome,
      lastSeverity:       this.lastSeverity,
      startedAtMs:        this.startedAtMs,
      lastShutdownAtMs:   this.lastShutdownAtMs,
    });
  }

  public getSessionId(): string { return this.sessionId; }
  public getShutdownCount(): number { return this.shutdownCount; }
  public getStartedAtMs(): number { return this.startedAtMs; }
  public reset(): void {
    this.shutdownCount = 0;
    this.totalDrainedEvents = 0;
    this.forcedOutcomeCount = 0;
    this.proofFinalizedCount = 0;
    this.healthScoreSum = 0;
    this.lastOutcome = null;
    this.lastSeverity = 'LOW';
    this.lastShutdownAtMs = null;
  }
}

/** Append-only event log — immutable after write, checksum-verified. */
export class ShutdownPipelineEventLog {
  private readonly entries: ShutdownEventLogEntry[] = [];
  private readonly maxEntries: number;

  public constructor(maxEntries: number = 512) {
    this.maxEntries = Math.max(8, maxEntries);
  }

  public append(
    result:       RunShutdownResult,
    mlVector:     ShutdownMLVector,
    forcedOutcome: boolean,
    nowMs:        number = Date.now(),
  ): ShutdownEventLogEntry {
    const { archive, didFinalizeProof } = result;
    const severity    = classifyShutdownSeverity(mlVector);
    const healthScore = computeShutdownHealthScore(mlVector);

    const sealInput = {
      runId:          archive.runId,
      tick:           archive.tick,
      step:           'SHUTDOWN_EVENT_LOG',
      stateChecksum:  archive.stateChecksum,
      eventChecksums: [archive.shutdownSeal],
    };

    const checksum = computeTickSeal(sealInput);

    const entry: ShutdownEventLogEntry = Object.freeze({
      entryId:           createDeterministicId('shutdown-log', archive.runId, nowMs.toString()),
      runId:             archive.runId,
      outcome:           archive.outcome,
      severity,
      healthScore,
      drainedEventCount: archive.drainedEvents.length,
      didFinalizeProof,
      forcedOutcome,
      shutdownSeal:      archive.shutdownSeal,
      recordedAtMs:      nowMs,
      checksum,
    });

    this.entries.push(entry);
    while (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    return entry;
  }

  public getAll(): readonly ShutdownEventLogEntry[] {
    return freezeArray(this.entries);
  }

  public getRecent(n: number = 10): readonly ShutdownEventLogEntry[] {
    return freezeArray(this.entries.slice(-Math.min(n, this.entries.length)));
  }

  public getByOutcome(outcome: NonNullable<RunStateSnapshot['outcome']>): readonly ShutdownEventLogEntry[] {
    return freezeArray(this.entries.filter((e) => e.outcome === outcome));
  }

  public getCount(): number { return this.entries.length; }
  public clear(): void { this.entries.length = 0; }
}

/** Annotator — converts shutdown results to human-readable annotation bundles. */
export class ShutdownPipelineAnnotator {
  private readonly verbosity: 'DEFAULT' | 'STRICT' | 'VERBOSE';
  private annotationCount = 0;

  public constructor(verbosity: 'DEFAULT' | 'STRICT' | 'VERBOSE' = 'DEFAULT') {
    this.verbosity = verbosity;
  }

  public annotate(
    result:     RunShutdownResult,
    mlVector:   ShutdownMLVector,
    dlTensor:   ShutdownDLTensor,
    operations: readonly ShutdownOperationKind[],
  ): ShutdownAnnotationBundle {
    this.annotationCount++;
    return buildShutdownAnnotation(result, mlVector, dlTensor, operations, this.verbosity);
  }

  public getAnnotationCount(): number { return this.annotationCount; }
  public getVerbosity(): 'DEFAULT' | 'STRICT' | 'VERBOSE' { return this.verbosity; }
}

/** Inspector — builds full-fidelity debug inspection bundles. */
export class ShutdownPipelineInspector {
  private inspectionCount = 0;

  public inspect(
    result:     RunShutdownResult,
    operations: readonly ShutdownOperationKind[],
    nowMs:      number = Date.now(),
  ): ShutdownInspectionBundle {
    this.inspectionCount++;

    const shieldIntegrityAvg = _computeShieldIntegrityAvg(result.snapshot);
    const mlVectorInput = _buildMLVectorInput(result, shieldIntegrityAvg, false);
    const mlVector   = extractShutdownMLVector(mlVectorInput);
    const dlTensor   = buildShutdownDLTensor(mlVector, result.archive);
    const chatSignal = buildShutdownChatSignal(result, mlVector, nowMs);
    const annotation = buildShutdownAnnotation(result, mlVector, dlTensor, operations, 'VERBOSE');
    const hint       = buildShutdownNarrationHint(
      result.snapshot.mode as ModeCode,
      result.archive.outcome,
      classifyShutdownSeverity(mlVector),
    );
    const health = buildShutdownHealthSnapshot(result.archive.runId, mlVector, nowMs);

    return Object.freeze({
      runId:            result.archive.runId,
      mlVector,
      dlTensor,
      chatSignal,
      annotation,
      narrationHint:    hint,
      healthSnapshot:   health,
      operationKinds:   operations,
      inspectedAtMs:    nowMs,
    });
  }

  public getInspectionCount(): number { return this.inspectionCount; }
}

// ============================================================================
// MARK: Default values
// ============================================================================

export const ZERO_DEFAULT_SHUTDOWN_ML_VECTOR: ShutdownMLVector = Object.freeze({
  tick_normalized:       0, phase_normalized:      0, phase_stakes:          0,
  phase_tick_budget:     0, mode_normalized:       0, mode_difficulty:       0,
  mode_tension_floor:    0, outcome_freedom:       0, outcome_timeout:       0,
  outcome_bankrupt:      0, outcome_abandoned:     0, net_worth_normalized:  0,
  sovereignty_score:     0, integrity_risk:        0, verified_grade_score:  0,
  proof_present:         0, did_finalize_proof:    0, forced_outcome:        0,
  drain_count_normalized: 0, drain_rate:           0, audit_flag_ratio:      0,
  tag_diversity:         0, shield_integrity:      0, tension_level:         0,
  cascade_depth:         0, battle_activity:       0, net_worth_per_tick:    0,
  sovereignty_per_tick:  0, run_completeness:      0, shutdown_quality:      0,
  archive_integrity:     0, proof_quality:         0,
} satisfies ShutdownMLVector);

export const ZERO_DEFAULT_SHUTDOWN_DL_TENSOR: ShutdownDLTensor = (() => {
  const zRow = (label: string): ShutdownDLTensorRow =>
    ({ label, values: [0, 0, 0, 0, 0, 0] as const });

  const rows = [
    zRow('OUTCOME_PROFILE'),
    zRow('SOVEREIGNTY_PROFILE'),
    zRow('ECONOMY_PROFILE'),
    zRow('EVENT_PROFILE'),
    zRow('MODE_PHASE_PROFILE'),
    zRow('HEALTH_COMPOSITE'),
  ] as const;

  const checksum = checksumSnapshot({ rows: rows.map((r) => ({ label: r.label, values: [...r.values] })) });
  return Object.freeze({ shape: [6, 6] as const, rows, checksum });
})();

export const ZERO_DEFAULT_SHUTDOWN_CHAT_SIGNAL: ShutdownChatSignal = Object.freeze({
  runId:              'default',
  userId:             'default',
  outcome:            'ABANDONED',
  severity:           'LOW' as ShutdownSeverity,
  healthScore:        0,
  proofPresent:       false,
  didFinalizeProof:   false,
  integrityStatus:    'PENDING' as IntegrityStatus,
  verifiedGrade:      null,
  sovereigntyScore:   0,
  finalNetWorth:      0,
  drainedEventCount:  0,
  auditFlagCount:     0,
  shutdownSeal:       'default',
  mlVector:           ZERO_DEFAULT_SHUTDOWN_ML_VECTOR,
  narrationKey:       'shutdown.solo.abandoned',
  emittedAtMs:        0,
});

// ============================================================================
// MARK: Singletons
// ============================================================================

export const ZERO_SHUTDOWN_ML_EXTRACTOR = Object.freeze({
  extract: extractShutdownMLVector,
  validate: validateShutdownMLVector,
  flatten: flattenShutdownMLVector,
  serialize: serializeShutdownMLVector,
  similarity: computeShutdownMLSimilarity,
  topFeatures: getTopShutdownFeatures,
  defaultVector: ZERO_DEFAULT_SHUTDOWN_ML_VECTOR,
});

export const ZERO_SHUTDOWN_DL_BUILDER = Object.freeze({
  build: buildShutdownDLTensor,
  flatten: flattenShutdownDLTensor,
  extractColumn: extractShutdownDLColumn,
  serialize: serializeShutdownDLTensor,
  defaultTensor: ZERO_DEFAULT_SHUTDOWN_DL_TENSOR,
});

export const SHUTDOWN_DEFAULT_ANNOTATOR = new ShutdownPipelineAnnotator('DEFAULT');
export const SHUTDOWN_STRICT_ANNOTATOR  = new ShutdownPipelineAnnotator('STRICT');
export const SHUTDOWN_VERBOSE_ANNOTATOR = new ShutdownPipelineAnnotator('VERBOSE');
export const SHUTDOWN_DEFAULT_INSPECTOR = new ShutdownPipelineInspector();

// ============================================================================
// MARK: Private helpers
// ============================================================================

function _computeShieldIntegrityAvg(snapshot: RunStateSnapshot): number {
  // Compute average shield integrity from shield layer health
  const layerWeights = SHIELD_LAYER_ABSORPTION_ORDER.map(
    (id) => SHIELD_LAYER_CAPACITY_WEIGHT[id],
  );
  const totalWeight  = layerWeights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return 0;

  // Use existence of layers in snapshot as a proxy for integrity
  // (full shield data structure access is beyond the type surface here)
  const shieldScore = snapshot.shield ? 0.75 : 0.5;
  return clamp01(shieldScore);
}

function _buildMLVectorInput(
  result:             RunShutdownResult,
  shieldIntegrityAvg: number,
  forceOutcome:       boolean,
): ShutdownMLVectorInput {
  const { archive, snapshot } = result;

  return {
    tick:              archive.tick,
    phase:             archive.phase as RunPhase,
    mode:              snapshot.mode as ModeCode,
    outcome:           archive.outcome,
    netWorth:          archive.finalNetWorth,
    sovereigntyScore:  archive.sovereigntyScore,
    integrityStatus:   archive.integrityStatus as IntegrityStatus,
    verifiedGrade:     archive.verifiedGrade as VerifiedGrade | null,
    proofHash:         archive.proofHash,
    didFinalizeProof:  result.didFinalizeProof,
    forceOutcome,
    drainedEventCount: archive.drainedEvents.length,
    auditFlagCount:    archive.auditFlags.length,
    tagCount:          archive.tags.length,
    shieldIntegrityAvg,
    tensionScore:      snapshot.tension?.score ?? 0,
    cascadeDepth:      snapshot.cascade?.activeChains?.length ?? 0,
    battleIsActive:    (snapshot.battle?.pendingAttacks?.length ?? 0) > 0,
    battleRoundCount:  snapshot.battle?.pendingAttacks?.length ?? 0,
  };
}

// ============================================================================
// MARK: RunShutdownPipeline — expanded with analytics surface
// ============================================================================

export class RunShutdownPipeline {
  private readonly bus: EventBus<RuntimeEventMap>;

  private readonly sovereignty: SovereigntyEngine;

  private readonly modeRegistry: ModeRegistry;

  private readonly now: () => number;

  private readonly outcomeResolver = new RuntimeOutcomeResolver();

  // ── Analytics state ──────────────────────────────────────────────────────

  private shutdownCount = 0;

  private forcedOutcomeCount = 0;

  private proofFinalizedCount = 0;

  private totalDrainedEvents = 0;

  private lastResult: RunShutdownResult | null = null;

  private lastMLVector: ShutdownMLVector = ZERO_DEFAULT_SHUTDOWN_ML_VECTOR;

  private lastHealthScore = 0;

  private lastSeverity: ShutdownSeverity = 'LOW';

  private readonly outcomeHistory: Array<NonNullable<RunStateSnapshot['outcome']>> = [];

  private readonly operationsLog: ShutdownOperationKind[] = [];

  public constructor(dependencies: RunShutdownPipelineDependencies) {
    this.bus          = dependencies.bus;
    this.sovereignty  = dependencies.sovereignty;
    this.modeRegistry = dependencies.modeRegistry ?? DEFAULT_MODE_REGISTRY;
    this.now          = dependencies.now ?? (() => Date.now());
  }

  // ── Core shutdown ─────────────────────────────────────────────────────────

  public shutdown(input: RunShutdownInput): RunShutdownResult {
    this.operationsLog.length = 0;
    const finalizedAtMs = input.nowMs ?? this.now();
    const wasForced = input.forceOutcome !== undefined;

    let snapshot =
      wasForced
        ? this._forceOutcome(
            input.snapshot,
            input.forceOutcome!,
            input.reason ?? 'run.shutdown_forced',
            input.reasonCode ?? 'UNKNOWN',
          )
        : this.outcomeResolver.apply(input.snapshot);

    if (wasForced) {
      this._logOp('SHUTDOWN_FORCED');
    } else {
      this._logOp('SHUTDOWN_RESOLVED');
    }

    if (snapshot.outcome === null) {
      snapshot = this._forceOutcome(
        snapshot,
        'ABANDONED',
        input.reason ?? 'run.shutdown_without_terminal_outcome',
        input.reasonCode ?? 'UNKNOWN',
      );
      this._logOp('OUTCOME_COERCED_ABANDONED');
    }

    const adapter = this.modeRegistry.mustGet(snapshot.mode);
    if (adapter.finalize) {
      snapshot = adapter.finalize(snapshot);
      this._logOp('MODE_FINALIZE_RAN');
    }

    const proofWasMissing = snapshot.sovereignty.proofHash === null;
    if (proofWasMissing) {
      snapshot = this.sovereignty.finalizeRun(snapshot, this.bus, finalizedAtMs);
      this.emitPostProofEvents(snapshot);
      this._logOp('PROOF_FINALIZED');
    } else {
      this._logOp('PROOF_ALREADY_PRESENT');
    }

    const frozen = deepFrozenClone(snapshot);
    const drained =
      input.flushEvents === false
        ? freezeArray<
            EventEnvelope<keyof RuntimeEventMap, RuntimeEventMap[keyof RuntimeEventMap]>
          >([])
        : freezeArray(this.bus.flush());

    if (input.flushEvents !== false) {
      this._logOp('EVENTS_DRAINED');
    } else {
      this._logOp('EVENTS_SKIPPED');
    }

    const archive = this.buildArchive(frozen, drained, finalizedAtMs);
    this._logOp('ARCHIVE_BUILT');

    const result: RunShutdownResult = {
      snapshot: frozen,
      archive,
      drained,
      didFinalizeProof: proofWasMissing,
    };

    this._trackShutdown(result, wasForced);
    return result;
  }

  // ── Analytics methods ──────────────────────────────────────────────────────

  /** Extract ML vector from the last shutdown result (or custom input). */
  public extractMLVector(overrideInput?: ShutdownMLVectorInput): ShutdownMLVector {
    if (overrideInput !== undefined) {
      return extractShutdownMLVector(overrideInput);
    }
    return this.lastMLVector;
  }

  /** Build DL tensor from the last shutdown result. */
  public buildDLTensor(result?: RunShutdownResult): ShutdownDLTensor {
    const r = result ?? this.lastResult;
    if (r === null) return ZERO_DEFAULT_SHUTDOWN_DL_TENSOR;
    return buildShutdownDLTensor(this.lastMLVector, r.archive);
  }

  /** Build chat signal from the last shutdown result. */
  public buildChatSignal(result?: RunShutdownResult, nowMs?: number): ShutdownChatSignal {
    const r   = result ?? this.lastResult;
    const now = nowMs ?? this.now();
    if (r === null) return ZERO_DEFAULT_SHUTDOWN_CHAT_SIGNAL;
    return buildShutdownChatSignal(r, this.lastMLVector, now);
  }

  /** Build annotation bundle from the last shutdown result. */
  public buildAnnotation(
    result?:      RunShutdownResult,
    verbosity?:   'DEFAULT' | 'STRICT' | 'VERBOSE',
  ): ShutdownAnnotationBundle | null {
    const r = result ?? this.lastResult;
    if (r === null) return null;
    const dlTensor = buildShutdownDLTensor(this.lastMLVector, r.archive);
    return buildShutdownAnnotation(r, this.lastMLVector, dlTensor, this._currentOps(), verbosity ?? 'DEFAULT');
  }

  /** Build narration hint for the last shutdown. */
  public buildNarrationHint(result?: RunShutdownResult): ShutdownNarrationHint | null {
    const r = result ?? this.lastResult;
    if (r === null) return null;
    return buildShutdownNarrationHint(
      r.snapshot.mode as ModeCode,
      r.archive.outcome,
      this.lastSeverity,
    );
  }

  /** Build health snapshot for the last shutdown. */
  public buildHealthSnapshot(result?: RunShutdownResult, nowMs?: number): ShutdownHealthSnapshot | null {
    const r   = result ?? this.lastResult;
    const now = nowMs ?? this.now();
    if (r === null) return null;
    return buildShutdownHealthSnapshot(r.archive.runId, this.lastMLVector, now);
  }

  /** Build a full run summary for the last shutdown. */
  public buildRunSummary(result?: RunShutdownResult, wasForced?: boolean): ShutdownRunSummary | null {
    const r = result ?? this.lastResult;
    if (r === null) return null;
    return buildShutdownRunSummary(r, this.lastMLVector, wasForced ?? false);
  }

  // ── Diagnostics ───────────────────────────────────────────────────────────

  public getHealthScore(): number { return this.lastHealthScore; }
  public getSeverity(): ShutdownSeverity { return this.lastSeverity; }
  public getShutdownCount(): number { return this.shutdownCount; }
  public getForcedOutcomeCount(): number { return this.forcedOutcomeCount; }
  public getProofFinalizedCount(): number { return this.proofFinalizedCount; }
  public getTotalDrainedEvents(): number { return this.totalDrainedEvents; }
  public getLastResult(): RunShutdownResult | null { return this.lastResult; }
  public getLastMLVector(): ShutdownMLVector { return this.lastMLVector; }
  public getOutcomeHistory(): readonly NonNullable<RunStateSnapshot['outcome']>[] {
    return freezeArray(this.outcomeHistory);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private emitPostProofEvents(snapshot: RunStateSnapshot): void {
    if (snapshot.sovereignty.integrityStatus === 'QUARANTINED') {
      this.bus.emit(
        'integrity.quarantined',
        {
          runId:   snapshot.runId,
          tick:    snapshot.tick,
          reasons:
            snapshot.sovereignty.auditFlags.length > 0
              ? [...snapshot.sovereignty.auditFlags]
              : [...snapshot.telemetry.warnings],
        },
        {
          emittedAtTick: snapshot.tick,
          tags: freezeArray(['engine-zero', 'run-shutdown', 'integrity-quarantined']),
        },
      );
    }

    if (snapshot.outcome !== null && snapshot.sovereignty.proofHash !== null) {
      this.bus.emit(
        'proof.sealed',
        {
          runId:           snapshot.runId,
          proofHash:       snapshot.sovereignty.proofHash,
          integrityStatus: snapshot.sovereignty.integrityStatus,
          grade:           snapshot.sovereignty.verifiedGrade ?? 'F',
          outcome:         snapshot.outcome,
        },
        {
          emittedAtTick: snapshot.tick,
          tags: freezeArray([
            'engine-zero',
            'run-shutdown',
            'proof-sealed',
            `outcome:${snapshot.outcome.toLowerCase()}`,
          ]),
        },
      );
      this._logOp('POST_PROOF_EVENTS_EMITTED');
    }
  }

  private buildArchive(
    snapshot: RunStateSnapshot,
    drained: readonly EventEnvelope<
      keyof RuntimeEventMap,
      RuntimeEventMap[keyof RuntimeEventMap]
    >[],
    finalizedAtMs: number,
  ): RunArchiveRecord {
    const stateChecksum = checksumSnapshot(snapshot);
    const eventDigests = freezeArray(
      drained.map((entry) => ({
        sequence:       entry.sequence,
        event:          String(entry.event),
        emittedAtTick:  entry.emittedAtTick,
        tags:           entry.tags === undefined ? undefined : freezeArray(entry.tags),
        checksum:       checksumParts(
          entry.sequence,
          entry.event,
          entry.emittedAtTick ?? null,
          entry.tags ?? [],
          entry.payload,
        ),
      })),
    );

    const shutdownSeal = computeTickSeal({
      runId:          snapshot.runId,
      tick:           snapshot.tick,
      step:           'RUN_SHUTDOWN',
      stateChecksum,
      eventChecksums: eventDigests.map((entry) => entry.checksum),
    });

    return Object.freeze({
      runId:            snapshot.runId,
      userId:           snapshot.userId,
      seed:             snapshot.seed,
      mode:             snapshot.mode,
      tick:             snapshot.tick,
      phase:            snapshot.phase,
      outcome:          snapshot.outcome ?? 'ABANDONED',
      finalNetWorth:    snapshot.economy.netWorth,
      proofHash:        snapshot.sovereignty.proofHash,
      integrityStatus:  snapshot.sovereignty.integrityStatus,
      sovereigntyScore: snapshot.sovereignty.sovereigntyScore,
      verifiedGrade:    snapshot.sovereignty.verifiedGrade,
      stateChecksum,
      shutdownSeal,
      finalizedAtMs,
      drainedEvents:    eventDigests,
      auditFlags:       freezeArray(snapshot.sovereignty.auditFlags),
      tags:             freezeArray(snapshot.tags),
    });
  }

  private _forceOutcome(
    snapshot:   RunStateSnapshot,
    outcome:    NonNullable<RunStateSnapshot['outcome']>,
    reason:     string,
    reasonCode: OutcomeReasonCode,
  ): RunStateSnapshot {
    const next = cloneJson(snapshot) as Mutable<RunStateSnapshot>;
    next.outcome                       = outcome;
    next.telemetry.outcomeReason       = reason;
    next.telemetry.outcomeReasonCode   = reasonCode;
    return deepFreeze(next) as RunStateSnapshot;
  }

  private _trackShutdown(result: RunShutdownResult, wasForced: boolean): void {
    this.shutdownCount++;
    this.totalDrainedEvents += result.archive.drainedEvents.length;
    if (wasForced)              this.forcedOutcomeCount++;
    if (result.didFinalizeProof) this.proofFinalizedCount++;

    this.outcomeHistory.push(result.archive.outcome);
    if (this.outcomeHistory.length > 100) this.outcomeHistory.shift();

    this.lastResult = result;
    this._recomputeHealth(result, wasForced);
  }

  private _recomputeHealth(result: RunShutdownResult, wasForced: boolean): void {
    const shieldIntegrityAvg = _computeShieldIntegrityAvg(result.snapshot);
    const input = _buildMLVectorInput(result, shieldIntegrityAvg, wasForced);
    this.lastMLVector    = extractShutdownMLVector(input);
    this.lastHealthScore = computeShutdownHealthScore(this.lastMLVector);
    this.lastSeverity    = classifyShutdownSeverity(this.lastMLVector);
  }

  private _logOp(op: ShutdownOperationKind): void {
    this.operationsLog.push(op);
  }

  private _currentOps(): readonly ShutdownOperationKind[] {
    return freezeArray(this.operationsLog);
  }
}

// ============================================================================
// MARK: Factory — RunShutdownPipeline + analytics suite
// ============================================================================

/**
 * Create a RunShutdownPipeline with a full analytics suite attached.
 */
export function createRunShutdownPipelineWithAnalytics(
  dependencies: RunShutdownPipelineDependencies,
  options: {
    readonly trendWindowSize?: number;
    readonly eventLogMax?: number;
    readonly annotatorVerbosity?: 'DEFAULT' | 'STRICT' | 'VERBOSE';
    readonly sessionNowMs?: number;
  } = {},
): RunShutdownPipelineWithAnalytics {
  const pipeline       = new RunShutdownPipeline(dependencies);
  const trendAnalyzer  = new ShutdownPipelineTrendAnalyzer(options.trendWindowSize ?? 20);
  const sessionTracker = new ShutdownPipelineSessionTracker(options.sessionNowMs ?? Date.now());
  const eventLog       = new ShutdownPipelineEventLog(options.eventLogMax ?? 512);
  const annotator      = new ShutdownPipelineAnnotator(options.annotatorVerbosity ?? 'DEFAULT');
  const inspector      = new ShutdownPipelineInspector();

  return Object.freeze({ pipeline, trendAnalyzer, sessionTracker, eventLog, annotator, inspector });
}

/**
 * Build a full export bundle from a shutdown result and the analytics suite.
 */
export function buildShutdownExportBundle(
  suite:        RunShutdownPipelineWithAnalytics,
  result:       RunShutdownResult,
  wasForced:    boolean,
  exportedAtMs: number = Date.now(),
): ShutdownExportBundle {
  const shieldAvg = _computeShieldIntegrityAvg(result.snapshot);
  const input     = _buildMLVectorInput(result, shieldAvg, wasForced);
  const mlVector  = extractShutdownMLVector(input);
  const dlTensor  = buildShutdownDLTensor(mlVector, result.archive);
  const chatSignal = buildShutdownChatSignal(result, mlVector, exportedAtMs);
  const ops        = freezeArray<ShutdownOperationKind>(['ARCHIVE_BUILT']);
  const annotation = buildShutdownAnnotation(result, mlVector, dlTensor, ops, 'VERBOSE');
  const runSummary = buildShutdownRunSummary(result, mlVector, wasForced);
  const health     = buildShutdownHealthSnapshot(result.archive.runId, mlVector, exportedAtMs);

  suite.trendAnalyzer.record(runSummary);
  suite.sessionTracker.record(runSummary, exportedAtMs);
  suite.eventLog.append(result, mlVector, wasForced, exportedAtMs);

  const trendSnapshot   = suite.trendAnalyzer.snapshot();
  const sessionReport   = suite.sessionTracker.report();

  return Object.freeze({
    runId:          result.archive.runId,
    mlVector,
    dlTensor,
    chatSignal,
    annotation,
    runSummary,
    healthSnapshot: health,
    sessionReport,
    trendSnapshot,
    exportedAtMs,
  });
}
