/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/RunStateInvariantGuard.ts
 *
 * Doctrine:
 * - runtime state must be provably sane at the simulation boundary
 * - invariant checks are deterministic, bounded, and serialization-safe
 * - guards should surface rich diagnostics without mutating snapshots
 * - derived-state checks must be opt-in where legacy runtime drift still exists
 *
 * Extended Doctrine (v2 upgrade — depth layer):
 * - Every GamePrimitives type guard and constant is used in validation paths
 * - ML signal generation from invariant failures drives adaptive remediation
 * - Historian tracks failure patterns across run lifetimes for trend analysis
 * - Batch inspector processes multi-snapshot audit windows deterministically
 * - Remediation advisor provides actionable suggestions for every failure class
 * - Chat signal bridge translates invariant failures into backend chat events
 * - Tick sequence validation ensures step integrity at every orchestration boundary
 */

// ============================================================================
// SECTION 1 — EXISTING CORE IMPORTS
// ============================================================================

import type { RunStateSnapshot } from './RunStateSnapshot';
import {
  checksumSnapshot,
  checksumParts,
  createDeterministicId,
} from './Deterministic';

// ============================================================================
// SECTION 2 — GAMEPRIMTIVES IMPORTS (type guards + constants + utility)
//   Every symbol imported here is actively used in guards, scoring, or analytics.
// ============================================================================

import type {
  ModeCode,
  PressureTier,
  RunPhase,
  RunOutcome,
  ShieldLayerId,
  HaterBotId,
  BotState,
  IntegrityStatus,
  VerifiedGrade,
  TimingClass,
  DeckType,
  VisibilityLevel,
  AttackSeverityClass,
  CascadeHealthClass,
} from './GamePrimitives';

import {
  // Canonical arrays — used to cross-check enum values during validation
  MODE_CODES,
  PRESSURE_TIERS,
  RUN_PHASES,
  RUN_OUTCOMES,
  SHIELD_LAYER_IDS,
  HATER_BOT_IDS,
  TIMING_CLASSES,
  DECK_TYPES,
  INTEGRITY_STATUSES,
  VERIFIED_GRADES,
  SHIELD_LAYER_LABEL_BY_ID,

  // Scoring maps — used in ML signal generation and severity calibration
  PRESSURE_TIER_NORMALIZED,
  PRESSURE_TIER_ESCALATION_THRESHOLD,
  PRESSURE_TIER_DEESCALATION_THRESHOLD,
  BOT_THREAT_LEVEL,
  BOT_STATE_THREAT_MULTIPLIER,
  INTEGRITY_STATUS_RISK_SCORE,
  VERIFIED_GRADE_NUMERIC_SCORE,
  MODE_DIFFICULTY_MULTIPLIER,
  SHIELD_LAYER_CAPACITY_WEIGHT,
  TIMING_CLASS_WINDOW_PRIORITY,

  // Type guards — used in deep enum validation across all snapshot sub-states
  isModeCode,
  isPressureTier,
  isRunPhase,
  isRunOutcome,
  isShieldLayerId,
  isHaterBotId,
  isTimingClass,
  isDeckType,
  isVisibilityLevel,
  isIntegrityStatus,
  isVerifiedGrade,

  // Utility functions — used in derived-field validation
  computePressureRiskScore,
  canEscalatePressure,
  canDeescalatePressure,
  isEndgamePhase,
  isWinOutcome,
  isLossOutcome,
  classifyAttackSeverity,
  computeEffectiveAttackDamage,
  isAttackCounterable,
  isAttackFromBot,
  scoreCascadeChainHealth,
  classifyCascadeChainHealth,
  isCascadeRecoverable,
  computeShieldIntegrityRatio,
  computeShieldLayerVulnerability,
} from './GamePrimitives';

// ============================================================================
// SECTION 3 — TICK SEQUENCE IMPORTS
//   Used in step-level invariant validation and batch inspection.
// ============================================================================

import {
  TICK_SEQUENCE,
  TICK_STEP_DESCRIPTORS,
  isTickStep,
  getTickStepIndex,
} from './TickSequence';

import type { TickStep } from './TickSequence';

// ============================================================================
// SECTION 4 — EXISTING TYPES (canonical, unchanged)
// ============================================================================

export type InvariantSeverity = 'ERROR' | 'WARN';
export type InvariantStage = 'runtime' | 'tick-finalized' | 'terminal';

export interface InvariantIssue {
  readonly severity: InvariantSeverity;
  readonly code: string;
  readonly path: string;
  readonly message: string;
  readonly expected?: unknown;
  readonly actual?: unknown;
}

export interface RunStateInvariantOptions {
  readonly stage?: InvariantStage;
  readonly requireDerivedFields?: boolean;
  readonly expectedTickChecksumMode?: 'none' | 'lte-tick' | 'eq-tick';
}

export interface RunStateTransitionOptions extends RunStateInvariantOptions {
  readonly maxTickDelta?: number;
}

export interface RunStateInvariantReport {
  readonly ok: boolean;
  readonly runId: string;
  readonly tick: number;
  readonly stage: InvariantStage;
  readonly checksum: string;
  readonly errors: readonly InvariantIssue[];
  readonly warnings: readonly InvariantIssue[];
}

// ============================================================================
// SECTION 5 — EXTENDED TYPE DEFINITIONS
// ============================================================================

/** Severity classification of an invariant failure for ML routing. */
export type InvariantMLRiskClass = 'critical' | 'high' | 'moderate' | 'nominal';

/** An ML-enriched invariant signal emitted for downstream routing. */
export interface InvariantMLSignal {
  readonly signalId: string;
  readonly runId: string;
  readonly tick: number;
  readonly stage: InvariantStage;
  readonly riskClass: InvariantMLRiskClass;
  readonly riskScore: number;          // 0.0 → 1.0
  readonly errorCount: number;
  readonly warningCount: number;
  readonly dominantErrorCode: string | null;
  readonly affectedPaths: readonly string[];
  readonly mlFeatureVector: readonly number[];
  readonly recommendedAction: InvariantRemediationAction;
  readonly emittedAtMs: number;
}

/** Recommended engine action in response to an invariant failure. */
export type InvariantRemediationAction =
  | 'ROLLBACK_CHECKPOINT'
  | 'RECOMPUTE_DERIVED_FIELDS'
  | 'ABORT_RUN'
  | 'ESCALATE_PRESSURE'
  | 'QUARANTINE_SNAPSHOT'
  | 'EMIT_AUDIT_FLAG'
  | 'NOOP';

/** A structured remediation suggestion for a specific invariant issue. */
export interface InvariantRemediationSuggestion {
  readonly issueCode: string;
  readonly issuePath: string;
  readonly severity: InvariantSeverity;
  readonly action: InvariantRemediationAction;
  readonly description: string;
  readonly engineTarget: string;
  readonly urgency: number;    // 0.0 → 1.0
  readonly autoRecoverable: boolean;
}

/** A chat signal generated from a critical invariant failure. */
export interface InvariantChatSignal {
  readonly signalId: string;
  readonly runId: string;
  readonly tick: number;
  readonly channel: 'BATTLE_SIGNAL' | 'RUN_SIGNAL' | 'SYSTEM_SIGNAL';
  readonly priority: 'INTERRUPT' | 'ELEVATED' | 'NORMAL' | 'BACKGROUND';
  readonly title: string;
  readonly body: string;
  readonly errorCodes: readonly string[];
  readonly requiresPlayerAction: boolean;
  readonly emittedAtMs: number;
}

/** A single entry in the invariant history ledger. */
export interface InvariantHistoryEntry {
  readonly entryId: string;
  readonly runId: string;
  readonly tick: number;
  readonly stage: InvariantStage;
  readonly reportChecksum: string;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly ok: boolean;
  readonly dominantErrorCode: string | null;
  readonly recordedAtMs: number;
}

/** Per-code invariant failure statistics. */
export interface InvariantCodeStats {
  readonly code: string;
  readonly hitCount: number;
  readonly firstSeenTick: number;
  readonly lastSeenTick: number;
  readonly affectedRunIds: readonly string[];
  readonly severityBreakdown: Readonly<Record<InvariantSeverity, number>>;
}

/** Full analytics summary for a run's invariant history. */
export interface InvariantAnalyticsSummary {
  readonly runId: string;
  readonly totalChecks: number;
  readonly totalErrors: number;
  readonly totalWarnings: number;
  readonly failureRate: number;
  readonly mostFrequentErrorCode: string | null;
  readonly errorCodeStats: readonly InvariantCodeStats[];
  readonly firstFailureTick: number | null;
  readonly lastFailureTick: number | null;
  readonly consecutiveCleanChecks: number;
  readonly mlRiskTrend: readonly number[];
}

/** Options for the RunStateInvariantHistorian. */
export interface InvariantHistorianOptions {
  readonly maxEntriesPerRun?: number;
  readonly maxRuns?: number;
}

/** Options for the batch inspector. */
export interface InvariantBatchInspectorOptions extends RunStateInvariantOptions {
  readonly failFast?: boolean;
  readonly maxSnapshots?: number;
}

/** Result of a batch inspection. */
export interface InvariantBatchResult {
  readonly totalSnapshots: number;
  readonly passedCount: number;
  readonly failedCount: number;
  readonly reports: readonly RunStateInvariantReport[];
  readonly aggregateChecksum: string;
  readonly overallOk: boolean;
}

/** Options for RunStateInvariantMLAdapter. */
export interface InvariantMLAdapterOptions {
  readonly criticalErrorCodes?: readonly string[];
  readonly highRiskErrorCodes?: readonly string[];
}

// ============================================================================
// SECTION 6 — INVARIANT ERROR CODE REGISTRY
// ============================================================================

/** Canonical set of all known invariant error codes, grouped by domain. */
export const INVARIANT_ERROR_CODES = Object.freeze({
  // Schema / identity
  SCHEMA_VERSION_INVALID: 'SCHEMA_VERSION_INVALID',
  IDENTITY_FIELD_EMPTY: 'IDENTITY_FIELD_EMPTY',
  IDENTITY_CHANGED_ACROSS_TRANSITION: 'IDENTITY_CHANGED_ACROSS_TRANSITION',

  // Tick
  TICK_INVALID: 'TICK_INVALID',
  TICK_DELTA_INVALID: 'TICK_DELTA_INVALID',
  TICK_CHECKSUM_COUNT_INVALID: 'TICK_CHECKSUM_COUNT_INVALID',
  TICK_CHECKSUMS_REGRESSED: 'TICK_CHECKSUMS_REGRESSED',

  // Numeric
  NON_FINITE_NUMBER: 'NON_FINITE_NUMBER',
  NUMBER_BELOW_MINIMUM: 'NUMBER_BELOW_MINIMUM',

  // Pressure
  PRESSURE_SCORE_OUT_OF_RANGE: 'PRESSURE_SCORE_OUT_OF_RANGE',
  PRESSURE_MAX_SCORE_BELOW_CURRENT: 'PRESSURE_MAX_SCORE_BELOW_CURRENT',
  PRESSURE_TIER_INVALID: 'PRESSURE_TIER_INVALID',

  // Shield
  SHIELD_LAYERS_EMPTY: 'SHIELD_LAYERS_EMPTY',
  SHIELD_LAYER_IDS_DUPLICATED: 'SHIELD_LAYER_IDS_DUPLICATED',
  SHIELD_LAYER_NON_FINITE: 'SHIELD_LAYER_NON_FINITE',
  SHIELD_LAYER_MAX_INVALID: 'SHIELD_LAYER_MAX_INVALID',
  SHIELD_LAYER_CURRENT_OUT_OF_RANGE: 'SHIELD_LAYER_CURRENT_OUT_OF_RANGE',
  SHIELD_LAYER_RATIO_DRIFT: 'SHIELD_LAYER_RATIO_DRIFT',
  SHIELD_WEAKEST_LAYER_DRIFT: 'SHIELD_WEAKEST_LAYER_DRIFT',
  SHIELD_WEAKEST_RATIO_DRIFT: 'SHIELD_WEAKEST_RATIO_DRIFT',

  // Battle / bots
  BOT_IDS_DUPLICATED: 'BOT_IDS_DUPLICATED',
  BOT_ID_UNRECOGNIZED: 'BOT_ID_UNRECOGNIZED',
  BOT_STATE_INVALID: 'BOT_STATE_INVALID',
  NEUTRALIZED_BOT_IDS_DUPLICATED: 'NEUTRALIZED_BOT_IDS_DUPLICATED',
  BATTLE_BUDGET_EXCEEDS_CAP: 'BATTLE_BUDGET_EXCEEDS_CAP',
  PENDING_ATTACK_INVALID: 'PENDING_ATTACK_INVALID',

  // Economy
  ECONOMY_NET_WORTH_DRIFT: 'ECONOMY_NET_WORTH_DRIFT',
  ECONOMY_FREEDOM_TARGET_INVALID: 'ECONOMY_FREEDOM_TARGET_INVALID',

  // Timers
  NEXT_TICK_TIMESTAMP_INVALID: 'NEXT_TICK_TIMESTAMP_INVALID',
  ACTIVE_WINDOWS_STORE_INVALID: 'ACTIVE_WINDOWS_STORE_INVALID',
  FROZEN_WINDOW_IDS_DUPLICATED: 'FROZEN_WINDOW_IDS_DUPLICATED',
  FROZEN_WINDOW_ID_MISSING: 'FROZEN_WINDOW_ID_MISSING',
  FROZEN_WINDOW_FLAG_DRIFT: 'FROZEN_WINDOW_FLAG_DRIFT',
  DECISION_WINDOW_TIMING_CLASS_INVALID: 'DECISION_WINDOW_TIMING_CLASS_INVALID',
  ELAPSED_MS_REGRESSED: 'ELAPSED_MS_REGRESSED',

  // Telemetry
  DECISION_TICK_INVALID: 'DECISION_TICK_INVALID',
  DECISION_LATENCY_INVALID: 'DECISION_LATENCY_INVALID',
  OUTCOME_REASON_CODE_MISSING: 'OUTCOME_REASON_CODE_MISSING',

  // Sovereignty
  PROOF_HASH_PRESENT_BEFORE_OUTCOME: 'PROOF_HASH_PRESENT_BEFORE_OUTCOME',
  PROOF_HASH_MUTATED: 'PROOF_HASH_MUTATED',
  INTEGRITY_STATUS_INVALID: 'INTEGRITY_STATUS_INVALID',
  VERIFIED_GRADE_INVALID: 'VERIFIED_GRADE_INVALID',

  // Terminal
  TERMINAL_OUTCOME_MUTATED: 'TERMINAL_OUTCOME_MUTATED',

  // Mode
  MODE_INVALID: 'MODE_INVALID',
  PHASE_INVALID: 'PHASE_INVALID',
  OUTCOME_INVALID: 'OUTCOME_INVALID',

  // Cascade
  CASCADE_CHAIN_HEALTH_CRITICAL: 'CASCADE_CHAIN_HEALTH_CRITICAL',

  // Cards
  DECK_TYPE_INVALID: 'DECK_TYPE_INVALID',
  CARD_TIMING_CLASS_INVALID: 'CARD_TIMING_CLASS_INVALID',
} as const);

/** Error codes that are classified as critical risk by the ML adapter. */
export const INVARIANT_CRITICAL_ERROR_CODES: ReadonlySet<string> = new Set([
  INVARIANT_ERROR_CODES.SCHEMA_VERSION_INVALID,
  INVARIANT_ERROR_CODES.IDENTITY_FIELD_EMPTY,
  INVARIANT_ERROR_CODES.TICK_CHECKSUMS_REGRESSED,
  INVARIANT_ERROR_CODES.TERMINAL_OUTCOME_MUTATED,
  INVARIANT_ERROR_CODES.PROOF_HASH_MUTATED,
  INVARIANT_ERROR_CODES.INTEGRITY_STATUS_INVALID,
]);

/** Error codes that are classified as high risk. */
export const INVARIANT_HIGH_RISK_ERROR_CODES: ReadonlySet<string> = new Set([
  INVARIANT_ERROR_CODES.SHIELD_LAYERS_EMPTY,
  INVARIANT_ERROR_CODES.BATTLE_BUDGET_EXCEEDS_CAP,
  INVARIANT_ERROR_CODES.IDENTITY_CHANGED_ACROSS_TRANSITION,
  INVARIANT_ERROR_CODES.TICK_DELTA_INVALID,
  INVARIANT_ERROR_CODES.ELAPSED_MS_REGRESSED,
  INVARIANT_ERROR_CODES.PRESSURE_SCORE_OUT_OF_RANGE,
]);

// ============================================================================
// SECTION 7 — MODULE METADATA
// ============================================================================

export const INVARIANT_GUARD_MODULE_VERSION = 'invariant-guard.v2.2026' as const;
export const INVARIANT_GUARD_MODULE_READY = true as const;

/** Number of ML features in the invariant ML signal vector. */
export const INVARIANT_ML_FEATURE_COUNT = 24 as const;

/** ML feature labels for the invariant signal vector. */
export const INVARIANT_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'error_count_normalized',
  'warning_count_normalized',
  'critical_error_present',
  'high_risk_error_present',
  'schema_valid',
  'identity_valid',
  'tick_valid',
  'pressure_score_valid',
  'pressure_tier_valid',
  'shield_layers_valid',
  'bot_ids_valid',
  'economy_drift_present',
  'sovereignty_valid',
  'proof_hash_consistent',
  'timer_windows_valid',
  'decision_latency_valid',
  'mode_valid',
  'phase_valid',
  'outcome_valid',
  'cascade_health_score',
  'tick_checksum_coverage',
  'stage_is_terminal',
  'transition_identity_stable',
  'aggregate_risk_score',
] as const);

// ============================================================================
// SECTION 8 — EXISTING HELPER FUNCTIONS (unchanged)
// ============================================================================

const EPSILON = 0.001;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isUnique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function approxEqual(left: number, right: number, epsilon = EPSILON): boolean {
  return Math.abs(left - right) <= epsilon;
}

function deriveExpectedNetWorth(snapshot: RunStateSnapshot): number {
  const shieldValue = snapshot.shield.layers.reduce(
    (sum, layer) => sum + layer.current,
    0,
  );
  const recurring = Math.max(
    0,
    (snapshot.economy.incomePerTick - snapshot.economy.expensesPerTick) * 12,
  );

  return Math.round(
    (snapshot.economy.cash - snapshot.economy.debt + recurring + shieldValue) * 100,
  ) / 100;
}

function deriveWeakestLayer(snapshot: RunStateSnapshot): {
  readonly layerId: RunStateSnapshot['shield']['weakestLayerId'];
  readonly ratio: number;
} {
  const weakest = snapshot.shield.layers
    .slice()
    .sort((left, right) => left.current - right.current)[0];

  if (!weakest) {
    return {
      layerId: 'L1',
      ratio: 0,
    };
  }

  return {
    layerId: weakest.layerId,
    ratio: weakest.max <= 0 ? 0 : weakest.current / weakest.max,
  };
}

function normalizeActiveWindowStore(
  snapshot: RunStateSnapshot,
): Record<string, { readonly frozen: boolean } | null> {
  if (!isRecord(snapshot.timers.activeDecisionWindows)) {
    return {};
  }

  const normalized: Record<string, { readonly frozen: boolean } | null> = {};
  for (const [key, value] of Object.entries(snapshot.timers.activeDecisionWindows)) {
    if (isRecord(value)) {
      normalized[key] = {
        frozen: value['frozen'] === true,
      };
      continue;
    }

    normalized[key] = null;
  }

  return normalized;
}

// ============================================================================
// SECTION 9 — EXTENDED HELPER FUNCTIONS
// ============================================================================

/**
 * Computes a normalized risk score (0..1) for a set of invariant issues.
 * Uses the canonical error/warning code classification tables.
 */
function computeInvariantRiskScore(issues: readonly InvariantIssue[]): number {
  if (issues.length === 0) return 0;

  let score = 0;
  for (const issue of issues) {
    if (issue.severity === 'ERROR') {
      if (INVARIANT_CRITICAL_ERROR_CODES.has(issue.code)) {
        score += 0.30;
      } else if (INVARIANT_HIGH_RISK_ERROR_CODES.has(issue.code)) {
        score += 0.15;
      } else {
        score += 0.08;
      }
    } else {
      score += 0.02;
    }
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Classifies the ML risk class for an invariant report.
 */
function classifyInvariantMLRisk(report: RunStateInvariantReport): InvariantMLRiskClass {
  const allIssues = [...report.errors, ...report.warnings];
  const riskScore = computeInvariantRiskScore(allIssues);

  if (report.errors.some((e) => INVARIANT_CRITICAL_ERROR_CODES.has(e.code))) return 'critical';
  if (report.errors.some((e) => INVARIANT_HIGH_RISK_ERROR_CODES.has(e.code))) return 'high';
  if (riskScore >= 0.30) return 'high';
  if (riskScore >= 0.10) return 'moderate';
  return 'nominal';
}

/**
 * Returns the dominant error code (the first critical → high → any error).
 */
function getDominantErrorCode(errors: readonly InvariantIssue[]): string | null {
  if (errors.length === 0) return null;

  const critical = errors.find((e) => INVARIANT_CRITICAL_ERROR_CODES.has(e.code));
  if (critical) return critical.code;

  const high = errors.find((e) => INVARIANT_HIGH_RISK_ERROR_CODES.has(e.code));
  if (high) return high.code;

  return errors[0]?.code ?? null;
}

/**
 * Extracts the 24-feature ML vector from a RunStateInvariantReport.
 * Uses PRESSURE_TIER_NORMALIZED, INTEGRITY_STATUS_RISK_SCORE, and more.
 */
function extractInvariantMLVector(
  report: RunStateInvariantReport,
  snapshot: RunStateSnapshot,
  isTransition = false,
): readonly number[] {
  const allIssues = [...report.errors, ...report.warnings];
  const riskScore = computeInvariantRiskScore(allIssues);
  const hasCritical = report.errors.some((e) => INVARIANT_CRITICAL_ERROR_CODES.has(e.code)) ? 1.0 : 0.0;
  const hasHighRisk = report.errors.some((e) => INVARIANT_HIGH_RISK_ERROR_CODES.has(e.code)) ? 1.0 : 0.0;

  const checkPresence = (code: string): number =>
    allIssues.some((i) => i.code === code) ? 0.0 : 1.0;

  const pressureTierNorm = PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier];
  const integrityRisk = INTEGRITY_STATUS_RISK_SCORE[snapshot.sovereignty.integrityStatus];

  const cascadeHealthAvg = snapshot.cascade.activeChains.length > 0
    ? snapshot.cascade.activeChains.reduce((acc, ch) => acc + scoreCascadeChainHealth(ch), 0) / snapshot.cascade.activeChains.length
    : 1.0;

  const tickChecksumCoverage = snapshot.tick > 0
    ? Math.min(1, snapshot.sovereignty.tickChecksums.length / snapshot.tick)
    : 1.0;

  return Object.freeze([
    Math.min(1, report.errors.length / 10),                         // error_count_normalized
    Math.min(1, report.warnings.length / 20),                       // warning_count_normalized
    hasCritical,                                                     // critical_error_present
    hasHighRisk,                                                     // high_risk_error_present
    checkPresence(INVARIANT_ERROR_CODES.SCHEMA_VERSION_INVALID),    // schema_valid
    checkPresence(INVARIANT_ERROR_CODES.IDENTITY_FIELD_EMPTY),      // identity_valid
    checkPresence(INVARIANT_ERROR_CODES.TICK_INVALID),              // tick_valid
    checkPresence(INVARIANT_ERROR_CODES.PRESSURE_SCORE_OUT_OF_RANGE), // pressure_score_valid
    PRESSURE_TIERS.includes(snapshot.pressure.tier as PressureTier) ? 1.0 : 0.0, // pressure_tier_valid
    checkPresence(INVARIANT_ERROR_CODES.SHIELD_LAYERS_EMPTY),       // shield_layers_valid
    checkPresence(INVARIANT_ERROR_CODES.BOT_IDS_DUPLICATED),        // bot_ids_valid
    checkPresence(INVARIANT_ERROR_CODES.ECONOMY_NET_WORTH_DRIFT),   // economy_drift_present
    INTEGRITY_STATUSES.includes(snapshot.sovereignty.integrityStatus as IntegrityStatus) ? 1.0 : 0.0, // sovereignty_valid
    checkPresence(INVARIANT_ERROR_CODES.PROOF_HASH_MUTATED),        // proof_hash_consistent
    checkPresence(INVARIANT_ERROR_CODES.ACTIVE_WINDOWS_STORE_INVALID), // timer_windows_valid
    checkPresence(INVARIANT_ERROR_CODES.DECISION_LATENCY_INVALID),  // decision_latency_valid
    isModeCode(snapshot.mode) ? 1.0 : 0.0,                        // mode_valid
    isRunPhase(snapshot.phase) ? 1.0 : 0.0,                       // phase_valid
    snapshot.outcome === null || isRunOutcome(snapshot.outcome) ? 1.0 : 0.0, // outcome_valid
    cascadeHealthAvg,                                               // cascade_health_score
    tickChecksumCoverage,                                           // tick_checksum_coverage
    report.stage === 'terminal' ? 1.0 : 0.0,                      // stage_is_terminal
    isTransition ? 0.5 : 0.0,                                      // transition_identity_stable (partial)
    riskScore,                                                      // aggregate_risk_score
  ]);
}

/**
 * Determines the recommended remediation action for a report.
 * Uses mode difficulty, integrity status risk, and error classification.
 */
function determineRemediationAction(
  report: RunStateInvariantReport,
  snapshot: RunStateSnapshot,
): InvariantRemediationAction {
  const allIssues = [...report.errors, ...report.warnings];

  // Critical errors demand rollback or quarantine
  if (report.errors.some((e) => INVARIANT_CRITICAL_ERROR_CODES.has(e.code))) {
    const integrityRisk = INTEGRITY_STATUS_RISK_SCORE[snapshot.sovereignty.integrityStatus];
    if (integrityRisk >= 0.8) return 'QUARANTINE_SNAPSHOT';
    return 'ROLLBACK_CHECKPOINT';
  }

  // Derived field drift → recompute
  const derivedDriftCodes = new Set<string>([
    INVARIANT_ERROR_CODES.SHIELD_LAYER_RATIO_DRIFT,
    INVARIANT_ERROR_CODES.SHIELD_WEAKEST_LAYER_DRIFT,
    INVARIANT_ERROR_CODES.SHIELD_WEAKEST_RATIO_DRIFT,
    INVARIANT_ERROR_CODES.ECONOMY_NET_WORTH_DRIFT,
  ]);
  if (allIssues.every((i) => derivedDriftCodes.has(i.code))) {
    return 'RECOMPUTE_DERIVED_FIELDS';
  }

  // High-risk errors at elevated pressure
  const tierNorm = PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier];
  if (tierNorm >= 0.75 && report.errors.length >= 3) {
    return 'ABORT_RUN';
  }

  // Sovereignty issues → audit flag
  if (report.errors.some((e) =>
    e.code === INVARIANT_ERROR_CODES.INTEGRITY_STATUS_INVALID ||
    e.code === INVARIANT_ERROR_CODES.VERIFIED_GRADE_INVALID,
  )) {
    return 'EMIT_AUDIT_FLAG';
  }

  // Mode difficulty escalation for borderline cases
  const difficultyMod = MODE_DIFFICULTY_MULTIPLIER[snapshot.mode];
  if (difficultyMod >= 1.5 && report.errors.length >= 2) {
    return 'ESCALATE_PRESSURE';
  }

  return 'NOOP';
}

// ============================================================================
// SECTION 10 — EXISTING RunStateInvariantGuard CLASS (canonical, unchanged + extended)
// ============================================================================

export class RunStateInvariantGuard {
  public inspect(
    snapshot: RunStateSnapshot,
    options: RunStateInvariantOptions = {},
  ): RunStateInvariantReport {
    const stage = options.stage ?? 'runtime';
    const expectedTickChecksumMode =
      options.expectedTickChecksumMode ??
      (stage === 'tick-finalized' || stage === 'terminal' ? 'eq-tick' : 'lte-tick');
    const requireDerivedFields = options.requireDerivedFields ?? false;

    const errors: InvariantIssue[] = [];
    const warnings: InvariantIssue[] = [];

    const push = (issue: InvariantIssue): void => {
      if (issue.severity === 'ERROR') {
        errors.push(issue);
        return;
      }

      warnings.push(issue);
    };

    if (snapshot.schemaVersion !== 'engine-run-state.v2') {
      push({
        severity: 'ERROR',
        code: INVARIANT_ERROR_CODES.SCHEMA_VERSION_INVALID,
        path: 'schemaVersion',
        message: 'Run state schemaVersion is invalid.',
        expected: 'engine-run-state.v2',
        actual: snapshot.schemaVersion,
      });
    }

    for (const [path, value] of [
      ['runId', snapshot.runId],
      ['userId', snapshot.userId],
      ['seed', snapshot.seed],
    ] as const) {
      if (typeof value !== 'string' || value.trim().length === 0) {
        push({
          severity: 'ERROR',
          code: INVARIANT_ERROR_CODES.IDENTITY_FIELD_EMPTY,
          path,
          message: `${path} must be a non-empty string.`,
          actual: value,
        });
      }
    }

    if (!Number.isInteger(snapshot.tick) || snapshot.tick < 0) {
      push({
        severity: 'ERROR',
        code: INVARIANT_ERROR_CODES.TICK_INVALID,
        path: 'tick',
        message: 'tick must be a non-negative integer.',
        actual: snapshot.tick,
      });
    }

    const numericChecks: Array<[string, number, number | null]> = [
      ['economy.cash', snapshot.economy.cash, null],
      ['economy.debt', snapshot.economy.debt, null],
      ['economy.incomePerTick', snapshot.economy.incomePerTick, null],
      ['economy.expensesPerTick', snapshot.economy.expensesPerTick, null],
      ['economy.netWorth', snapshot.economy.netWorth, null],
      ['economy.freedomTarget', snapshot.economy.freedomTarget, 0],
      ['economy.haterHeat', snapshot.economy.haterHeat, 0],
      ['pressure.score', snapshot.pressure.score, 0],
      ['pressure.maxScoreSeen', snapshot.pressure.maxScoreSeen, 0],
      ['tension.score', snapshot.tension.score, 0],
      ['tension.anticipation', snapshot.tension.anticipation, 0],
      ['shield.weakestLayerRatio', snapshot.shield.weakestLayerRatio, 0],
      ['battle.battleBudget', snapshot.battle.battleBudget, 0],
      ['battle.battleBudgetCap', snapshot.battle.battleBudgetCap, 0],
      ['timers.seasonBudgetMs', snapshot.timers.seasonBudgetMs, 0],
      ['timers.extensionBudgetMs', snapshot.timers.extensionBudgetMs, 0],
      ['timers.elapsedMs', snapshot.timers.elapsedMs, 0],
      ['timers.currentTickDurationMs', snapshot.timers.currentTickDurationMs, 1],
      ['timers.holdCharges', snapshot.timers.holdCharges, 0],
      ['telemetry.emittedEventCount', snapshot.telemetry.emittedEventCount, 0],
    ];

    for (const [path, value, min] of numericChecks) {
      if (!isFiniteNumber(value)) {
        push({
          severity: 'ERROR',
          code: INVARIANT_ERROR_CODES.NON_FINITE_NUMBER,
          path,
          message: `${path} must be a finite number.`,
          actual: value,
        });
        continue;
      }

      if (min !== null && value < min) {
        push({
          severity: 'ERROR',
          code: INVARIANT_ERROR_CODES.NUMBER_BELOW_MINIMUM,
          path,
          message: `${path} must be greater than or equal to ${String(min)}.`,
          expected: min,
          actual: value,
        });
      }
    }

    if (snapshot.pressure.score < 0 || snapshot.pressure.score > 1) {
      push({
        severity: 'ERROR',
        code: INVARIANT_ERROR_CODES.PRESSURE_SCORE_OUT_OF_RANGE,
        path: 'pressure.score',
        message: 'pressure.score must be in the range [0, 1].',
        expected: '[0,1]',
        actual: snapshot.pressure.score,
      });
    }

    if (snapshot.pressure.maxScoreSeen + EPSILON < snapshot.pressure.score) {
      push({
        severity: 'WARN',
        code: INVARIANT_ERROR_CODES.PRESSURE_MAX_SCORE_BELOW_CURRENT,
        path: 'pressure.maxScoreSeen',
        message: 'pressure.maxScoreSeen is below the current pressure.score.',
        expected: `>= ${String(snapshot.pressure.score)}`,
        actual: snapshot.pressure.maxScoreSeen,
      });
    }

    if (snapshot.shield.layers.length === 0) {
      push({
        severity: 'ERROR',
        code: INVARIANT_ERROR_CODES.SHIELD_LAYERS_EMPTY,
        path: 'shield.layers',
        message: 'shield.layers must contain at least one layer.',
      });
    }

    const layerIds = snapshot.shield.layers.map((layer) => layer.layerId);
    if (!isUnique(layerIds)) {
      push({
        severity: 'ERROR',
        code: INVARIANT_ERROR_CODES.SHIELD_LAYER_IDS_DUPLICATED,
        path: 'shield.layers',
        message: 'shield.layers contains duplicate layerId values.',
        actual: layerIds,
      });
    }

    for (const layer of snapshot.shield.layers) {
      if (!isFiniteNumber(layer.current) || !isFiniteNumber(layer.max)) {
        push({
          severity: 'ERROR',
          code: INVARIANT_ERROR_CODES.SHIELD_LAYER_NON_FINITE,
          path: `shield.layers.${layer.layerId}`,
          message: 'Shield layer current/max must be finite numbers.',
          actual: layer,
        });
        continue;
      }

      if (layer.max <= 0) {
        push({
          severity: 'ERROR',
          code: INVARIANT_ERROR_CODES.SHIELD_LAYER_MAX_INVALID,
          path: `shield.layers.${layer.layerId}.max`,
          message: 'Shield layer max must be greater than zero.',
          actual: layer.max,
        });
      }

      if (layer.current < 0 || layer.current > layer.max + EPSILON) {
        push({
          severity: 'ERROR',
          code: INVARIANT_ERROR_CODES.SHIELD_LAYER_CURRENT_OUT_OF_RANGE,
          path: `shield.layers.${layer.layerId}.current`,
          message: 'Shield layer current must be between 0 and max.',
          expected: `[0, ${String(layer.max)}]`,
          actual: layer.current,
        });
      }

      const expectedRatio = layer.max <= 0 ? 0 : layer.current / layer.max;
      if (!approxEqual(layer.integrityRatio, expectedRatio)) {
        push({
          severity: requireDerivedFields ? 'ERROR' : 'WARN',
          code: INVARIANT_ERROR_CODES.SHIELD_LAYER_RATIO_DRIFT,
          path: `shield.layers.${layer.layerId}.integrityRatio`,
          message: 'Shield layer integrityRatio is out of sync with current/max.',
          expected: expectedRatio,
          actual: layer.integrityRatio,
        });
      }
    }

    const expectedWeakestLayer = deriveWeakestLayer(snapshot);
    if (snapshot.shield.weakestLayerId !== expectedWeakestLayer.layerId) {
      push({
        severity: requireDerivedFields ? 'ERROR' : 'WARN',
        code: INVARIANT_ERROR_CODES.SHIELD_WEAKEST_LAYER_DRIFT,
        path: 'shield.weakestLayerId',
        message: 'shield.weakestLayerId is out of sync with layer currents.',
        expected: expectedWeakestLayer.layerId,
        actual: snapshot.shield.weakestLayerId,
      });
    }

    if (!approxEqual(snapshot.shield.weakestLayerRatio, expectedWeakestLayer.ratio)) {
      push({
        severity: requireDerivedFields ? 'ERROR' : 'WARN',
        code: INVARIANT_ERROR_CODES.SHIELD_WEAKEST_RATIO_DRIFT,
        path: 'shield.weakestLayerRatio',
        message: 'shield.weakestLayerRatio is out of sync with the weakest layer.',
        expected: expectedWeakestLayer.ratio,
        actual: snapshot.shield.weakestLayerRatio,
      });
    }

    const botIds = snapshot.battle.bots.map((bot) => bot.botId);
    if (!isUnique(botIds)) {
      push({
        severity: 'ERROR',
        code: INVARIANT_ERROR_CODES.BOT_IDS_DUPLICATED,
        path: 'battle.bots',
        message: 'battle.bots contains duplicate botId values.',
        actual: botIds,
      });
    }

    if (!isUnique(snapshot.battle.neutralizedBotIds)) {
      push({
        severity: 'ERROR',
        code: INVARIANT_ERROR_CODES.NEUTRALIZED_BOT_IDS_DUPLICATED,
        path: 'battle.neutralizedBotIds',
        message: 'battle.neutralizedBotIds contains duplicates.',
        actual: snapshot.battle.neutralizedBotIds,
      });
    }

    const expectedNetWorth = deriveExpectedNetWorth(snapshot);
    if (!approxEqual(snapshot.economy.netWorth, expectedNetWorth, 0.01)) {
      push({
        severity: requireDerivedFields ? 'ERROR' : 'WARN',
        code: INVARIANT_ERROR_CODES.ECONOMY_NET_WORTH_DRIFT,
        path: 'economy.netWorth',
        message: 'economy.netWorth is out of sync with the runtime derivation formula.',
        expected: expectedNetWorth,
        actual: snapshot.economy.netWorth,
      });
    }

    if (
      snapshot.timers.nextTickAtMs !== null &&
      !isFiniteNumber(snapshot.timers.nextTickAtMs)
    ) {
      push({
        severity: 'ERROR',
        code: INVARIANT_ERROR_CODES.NEXT_TICK_TIMESTAMP_INVALID,
        path: 'timers.nextTickAtMs',
        message: 'timers.nextTickAtMs must be null or a finite number.',
        actual: snapshot.timers.nextTickAtMs,
      });
    }

    const activeWindowStore = normalizeActiveWindowStore(snapshot);
    if (!isRecord(snapshot.timers.activeDecisionWindows)) {
      push({
        severity: 'ERROR',
        code: INVARIANT_ERROR_CODES.ACTIVE_WINDOWS_STORE_INVALID,
        path: 'timers.activeDecisionWindows',
        message: 'timers.activeDecisionWindows must be an object-like store.',
        actual: snapshot.timers.activeDecisionWindows,
      });
    }

    if (!isUnique(snapshot.timers.frozenWindowIds)) {
      push({
        severity: 'ERROR',
        code: INVARIANT_ERROR_CODES.FROZEN_WINDOW_IDS_DUPLICATED,
        path: 'timers.frozenWindowIds',
        message: 'timers.frozenWindowIds contains duplicates.',
        actual: snapshot.timers.frozenWindowIds,
      });
    }

    for (const windowId of snapshot.timers.frozenWindowIds) {
      if (!(windowId in activeWindowStore)) {
        push({
          severity: 'WARN',
          code: INVARIANT_ERROR_CODES.FROZEN_WINDOW_ID_MISSING,
          path: 'timers.frozenWindowIds',
          message: 'A frozen window id is not present in activeDecisionWindows.',
          actual: windowId,
        });
        continue;
      }

      const windowState = activeWindowStore[windowId];
      if (windowState !== null && windowState.frozen !== true) {
        push({
          severity: 'WARN',
          code: INVARIANT_ERROR_CODES.FROZEN_WINDOW_FLAG_DRIFT,
          path: `timers.activeDecisionWindows.${windowId}.frozen`,
          message: 'Frozen window id exists but the stored window is not marked frozen.',
          expected: true,
          actual: windowState.frozen,
        });
      }
    }

    for (const decision of snapshot.telemetry.decisions) {
      if (!Number.isInteger(decision.tick) || decision.tick < 0) {
        push({
          severity: 'ERROR',
          code: INVARIANT_ERROR_CODES.DECISION_TICK_INVALID,
          path: 'telemetry.decisions.tick',
          message: 'Decision tick values must be non-negative integers.',
          actual: decision.tick,
        });
      }

      if (!isFiniteNumber(decision.latencyMs) || decision.latencyMs < 0) {
        push({
          severity: 'ERROR',
          code: INVARIANT_ERROR_CODES.DECISION_LATENCY_INVALID,
          path: 'telemetry.decisions.latencyMs',
          message: 'Decision latencyMs must be a finite non-negative number.',
          actual: decision.latencyMs,
        });
      }
    }

    if (expectedTickChecksumMode !== 'none') {
      const checksumCount = snapshot.sovereignty.tickChecksums.length;
      const expected = snapshot.tick;
      const valid =
        expectedTickChecksumMode === 'eq-tick'
          ? checksumCount === expected
          : checksumCount <= expected;

      if (!valid) {
        push({
          severity: expectedTickChecksumMode === 'eq-tick' ? 'ERROR' : 'WARN',
          code: INVARIANT_ERROR_CODES.TICK_CHECKSUM_COUNT_INVALID,
          path: 'sovereignty.tickChecksums',
          message:
            expectedTickChecksumMode === 'eq-tick'
              ? 'tickChecksums length must match tick at the finalized boundary.'
              : 'tickChecksums length must never exceed tick.',
          expected,
          actual: checksumCount,
        });
      }
    }

    if (snapshot.outcome !== null && snapshot.telemetry.outcomeReasonCode === null) {
      push({
        severity: 'WARN',
        code: INVARIANT_ERROR_CODES.OUTCOME_REASON_CODE_MISSING,
        path: 'telemetry.outcomeReasonCode',
        message: 'A terminal outcome exists without telemetry.outcomeReasonCode.',
        actual: snapshot.outcome,
      });
    }

    if (snapshot.sovereignty.proofHash !== null && snapshot.outcome === null) {
      push({
        severity: 'WARN',
        code: INVARIANT_ERROR_CODES.PROOF_HASH_PRESENT_BEFORE_OUTCOME,
        path: 'sovereignty.proofHash',
        message: 'proofHash is present before the run has a terminal outcome.',
        actual: snapshot.sovereignty.proofHash,
      });
    }

    const checksum = checksumSnapshot(snapshot);

    return {
      ok: errors.length === 0,
      runId: snapshot.runId,
      tick: snapshot.tick,
      stage,
      checksum,
      errors,
      warnings,
    };
  }

  public assert(
    snapshot: RunStateSnapshot,
    options: RunStateInvariantOptions = {},
  ): RunStateSnapshot {
    const report = this.inspect(snapshot, options);
    if (!report.ok) {
      throw new Error(this.formatReport(report));
    }

    return snapshot;
  }

  public inspectTransition(
    previous: RunStateSnapshot,
    next: RunStateSnapshot,
    options: RunStateTransitionOptions = {},
  ): RunStateInvariantReport {
    const report = this.inspect(next, options);
    const errors = [...report.errors];
    const warnings = [...report.warnings];
    const maxTickDelta = Math.max(0, options.maxTickDelta ?? 1);

    const push = (issue: InvariantIssue): void => {
      if (issue.severity === 'ERROR') {
        errors.push(issue);
        return;
      }

      warnings.push(issue);
    };

    for (const field of ['runId', 'userId', 'seed', 'mode'] as const) {
      if (previous[field] !== next[field]) {
        push({
          severity: 'ERROR',
          code: INVARIANT_ERROR_CODES.IDENTITY_CHANGED_ACROSS_TRANSITION,
          path: field,
          message: `${field} cannot change across a runtime transition.`,
          expected: previous[field],
          actual: next[field],
        });
      }
    }

    const tickDelta = next.tick - previous.tick;
    if (tickDelta < 0 || tickDelta > maxTickDelta) {
      push({
        severity: 'ERROR',
        code: INVARIANT_ERROR_CODES.TICK_DELTA_INVALID,
        path: 'tick',
        message: 'tick delta across transition is invalid.',
        expected: `0..${String(maxTickDelta)}`,
        actual: tickDelta,
      });
    }

    if (next.timers.elapsedMs < previous.timers.elapsedMs) {
      push({
        severity: 'ERROR',
        code: INVARIANT_ERROR_CODES.ELAPSED_MS_REGRESSED,
        path: 'timers.elapsedMs',
        message: 'timers.elapsedMs cannot move backwards.',
        expected: `>= ${String(previous.timers.elapsedMs)}`,
        actual: next.timers.elapsedMs,
      });
    }

    if (
      next.sovereignty.tickChecksums.length < previous.sovereignty.tickChecksums.length
    ) {
      push({
        severity: 'ERROR',
        code: INVARIANT_ERROR_CODES.TICK_CHECKSUMS_REGRESSED,
        path: 'sovereignty.tickChecksums',
        message: 'tickChecksums cannot shrink across transition.',
        expected: `>= ${String(previous.sovereignty.tickChecksums.length)}`,
        actual: next.sovereignty.tickChecksums.length,
      });
    }

    if (previous.outcome !== null && next.outcome !== previous.outcome) {
      push({
        severity: 'ERROR',
        code: INVARIANT_ERROR_CODES.TERMINAL_OUTCOME_MUTATED,
        path: 'outcome',
        message: 'A terminal outcome cannot change across transition.',
        expected: previous.outcome,
        actual: next.outcome,
      });
    }

    if (
      previous.sovereignty.proofHash !== null &&
      next.sovereignty.proofHash !== previous.sovereignty.proofHash
    ) {
      push({
        severity: 'ERROR',
        code: INVARIANT_ERROR_CODES.PROOF_HASH_MUTATED,
        path: 'sovereignty.proofHash',
        message: 'proofHash cannot change once it has been materialized.',
        expected: previous.sovereignty.proofHash,
        actual: next.sovereignty.proofHash,
      });
    }

    return {
      ...report,
      ok: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Extended inspection methods — use all imported GamePrimitives utilities
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Runs a deep enum-level validation of all GamePrimitives enum fields using
   * every type guard imported from GamePrimitives.
   */
  public inspectEnums(snapshot: RunStateSnapshot): readonly InvariantIssue[] {
    const issues: InvariantIssue[] = [];

    if (!isModeCode(snapshot.mode)) {
      issues.push({ severity: 'ERROR', code: INVARIANT_ERROR_CODES.MODE_INVALID, path: 'mode',
        message: `mode '${String(snapshot.mode)}' is not a recognized ModeCode.`, actual: snapshot.mode });
    }

    if (!isRunPhase(snapshot.phase)) {
      issues.push({ severity: 'ERROR', code: INVARIANT_ERROR_CODES.PHASE_INVALID, path: 'phase',
        message: `phase '${String(snapshot.phase)}' is not a recognized RunPhase.`, actual: snapshot.phase });
    }

    if (snapshot.outcome !== null && !isRunOutcome(snapshot.outcome)) {
      issues.push({ severity: 'ERROR', code: INVARIANT_ERROR_CODES.OUTCOME_INVALID, path: 'outcome',
        message: `outcome '${String(snapshot.outcome)}' is not a recognized RunOutcome.`, actual: snapshot.outcome });
    }

    if (!isPressureTier(snapshot.pressure.tier)) {
      issues.push({ severity: 'ERROR', code: INVARIANT_ERROR_CODES.PRESSURE_TIER_INVALID,
        path: 'pressure.tier', message: `pressure.tier '${String(snapshot.pressure.tier)}' is not recognized.`,
        actual: snapshot.pressure.tier });
    }

    for (const layer of snapshot.shield.layers) {
      if (!isShieldLayerId(layer.layerId)) {
        issues.push({ severity: 'ERROR', code: INVARIANT_ERROR_CODES.SHIELD_LAYER_IDS_DUPLICATED,
          path: `shield.layers.${String(layer.layerId)}`,
          message: `shield layer id '${String(layer.layerId)}' is not a recognized ShieldLayerId.`,
          actual: layer.layerId });
      }
    }

    for (const bot of snapshot.battle.bots) {
      if (!isHaterBotId(bot.botId)) {
        issues.push({ severity: 'ERROR', code: INVARIANT_ERROR_CODES.BOT_ID_UNRECOGNIZED,
          path: `battle.bots.${String(bot.botId)}`,
          message: `botId '${String(bot.botId)}' is not a recognized HaterBotId.`,
          actual: bot.botId });
      }
    }

    if (!isIntegrityStatus(snapshot.sovereignty.integrityStatus)) {
      issues.push({ severity: 'ERROR', code: INVARIANT_ERROR_CODES.INTEGRITY_STATUS_INVALID,
        path: 'sovereignty.integrityStatus',
        message: `integrityStatus '${String(snapshot.sovereignty.integrityStatus)}' is not recognized.`,
        actual: snapshot.sovereignty.integrityStatus });
    }

    if (snapshot.sovereignty.verifiedGrade !== null && !isVerifiedGrade(snapshot.sovereignty.verifiedGrade)) {
      issues.push({ severity: 'WARN', code: INVARIANT_ERROR_CODES.VERIFIED_GRADE_INVALID,
        path: 'sovereignty.verifiedGrade',
        message: `verifiedGrade '${String(snapshot.sovereignty.verifiedGrade)}' is not recognized.`,
        actual: snapshot.sovereignty.verifiedGrade });
    }

    for (const [windowId, window] of Object.entries(snapshot.timers.activeDecisionWindows)) {
      if (!isTimingClass(window.timingClass)) {
        issues.push({ severity: 'ERROR', code: INVARIANT_ERROR_CODES.DECISION_WINDOW_TIMING_CLASS_INVALID,
          path: `timers.activeDecisionWindows.${windowId}.timingClass`,
          message: `Window timingClass '${String(window.timingClass)}' is not recognized.`,
          actual: window.timingClass });
      }
    }

    return issues;
  }

  /**
   * Inspects pressure-specific state using GamePrimitives pressure utilities.
   * Uses canEscalatePressure, canDeescalatePressure, computePressureRiskScore.
   */
  public inspectPressureSemantics(snapshot: RunStateSnapshot): readonly InvariantIssue[] {
    const issues: InvariantIssue[] = [];
    const { pressure } = snapshot;

    if (!isPressureTier(pressure.tier) || !isPressureTier(pressure.previousTier)) {
      return issues; // already caught by enum checks
    }

    const riskScore = computePressureRiskScore(pressure.tier, pressure.score);
    const tierNorm = PRESSURE_TIER_NORMALIZED[pressure.tier];
    const escalationThresh = PRESSURE_TIER_ESCALATION_THRESHOLD[pressure.tier];
    const deescalationThresh = PRESSURE_TIER_DEESCALATION_THRESHOLD[pressure.tier];

    // Compute adjacent tiers for escalation / de-escalation checks
    const tierIndex = PRESSURE_TIERS.indexOf(pressure.tier);
    const nextTier = tierIndex < PRESSURE_TIERS.length - 1
      ? PRESSURE_TIERS[tierIndex + 1]
      : null;

    // Validate escalation consistency
    if (nextTier !== null && canEscalatePressure(pressure.tier, nextTier, pressure.score, 0) && tierNorm < 0.25) {
      issues.push({
        severity: 'WARN',
        code: INVARIANT_ERROR_CODES.PRESSURE_MAX_SCORE_BELOW_CURRENT,
        path: 'pressure.tier',
        message: `Pressure can escalate but tier normalized weight is low (${tierNorm.toFixed(2)}).`,
        expected: `tier weight >= 0.25 when escalation is possible`,
        actual: tierNorm,
      });
    }

    if (isPressureTier(pressure.previousTier) && canDeescalatePressure(pressure.tier, pressure.previousTier, pressure.score) &&
        pressure.score >= escalationThresh * 0.9) {
      issues.push({
        severity: 'WARN',
        code: 'PRESSURE_DEESCALATION_SIGNAL_INCONSISTENT',
        path: 'pressure.score',
        message: `Pressure can de-escalate but score is near escalation threshold (${pressure.score.toFixed(3)} vs ${escalationThresh.toFixed(3)}).`,
        expected: `score < ${String(deescalationThresh)}`,
        actual: pressure.score,
      });
    }

    if (!Number.isFinite(riskScore) || riskScore < 0) {
      issues.push({
        severity: 'ERROR',
        code: INVARIANT_ERROR_CODES.NON_FINITE_NUMBER,
        path: 'pressure.riskScore',
        message: `Derived pressure risk score is invalid: ${String(riskScore)}.`,
        actual: riskScore,
      });
    }

    return issues;
  }

  /**
   * Inspects shield layer integrity using GamePrimitives shield utilities.
   * Uses computeShieldIntegrityRatio, computeShieldLayerVulnerability.
   */
  public inspectShieldSemantics(snapshot: RunStateSnapshot): readonly InvariantIssue[] {
    const issues: InvariantIssue[] = [];

    for (const layer of snapshot.shield.layers) {
      if (!isShieldLayerId(layer.layerId)) continue;
      if (!isFiniteNumber(layer.current) || !isFiniteNumber(layer.max)) continue;

      const derivedRatio = computeShieldIntegrityRatio([{ id: layer.layerId, current: layer.current, max: layer.max }]);
      const derivedVulnerability = computeShieldLayerVulnerability(layer.layerId, layer.current, layer.max);
      const capacityWeight = SHIELD_LAYER_CAPACITY_WEIGHT[layer.layerId];

      if (!approxEqual(layer.integrityRatio, derivedRatio, 0.005)) {
        issues.push({
          severity: 'WARN',
          code: INVARIANT_ERROR_CODES.SHIELD_LAYER_RATIO_DRIFT,
          path: `shield.layers.${layer.layerId}.integrityRatio`,
          message: `Shield layer integrityRatio drift detected. Derived: ${derivedRatio.toFixed(4)}, stored: ${layer.integrityRatio.toFixed(4)}.`,
          expected: derivedRatio,
          actual: layer.integrityRatio,
        });
      }

      // Vulnerability check: if high vulnerability on a high-weight layer, warn
      if (derivedVulnerability > 0.85 && capacityWeight >= 0.25) {
        issues.push({
          severity: 'WARN',
          code: INVARIANT_ERROR_CODES.SHIELD_LAYER_CURRENT_OUT_OF_RANGE,
          path: `shield.layers.${layer.layerId}`,
          message: `High-capacity shield layer '${layer.layerId}' (weight ${capacityWeight}) is critically vulnerable (${(derivedVulnerability * 100).toFixed(0)}%).`,
          actual: derivedVulnerability,
        });
      }
    }

    return issues;
  }

  /**
   * Inspects battle state using GamePrimitives bot threat maps and attack utilities.
   * Uses BOT_THREAT_LEVEL, BOT_STATE_THREAT_MULTIPLIER, classifyAttackSeverity, etc.
   */
  public inspectBattleSemantics(snapshot: RunStateSnapshot): readonly InvariantIssue[] {
    const issues: InvariantIssue[] = [];

    for (const bot of snapshot.battle.bots) {
      if (!isHaterBotId(bot.botId)) continue;

      const baseThreat = BOT_THREAT_LEVEL[bot.botId];
      const stateMultiplier = BOT_STATE_THREAT_MULTIPLIER[bot.state];

      if (baseThreat === undefined) {
        issues.push({
          severity: 'ERROR',
          code: INVARIANT_ERROR_CODES.BOT_ID_UNRECOGNIZED,
          path: `battle.bots.${bot.botId}`,
          message: `Bot '${bot.botId}' has no registered threat level in BOT_THREAT_LEVEL.`,
          actual: bot.botId,
        });
      }

      if (stateMultiplier === undefined) {
        issues.push({
          severity: 'ERROR',
          code: INVARIANT_ERROR_CODES.BOT_STATE_INVALID,
          path: `battle.bots.${bot.botId}.state`,
          message: `Bot '${bot.botId}' has unrecognized state '${String(bot.state)}'.`,
          actual: bot.state,
        });
      }

      if (bot.heat < 0 || !isFiniteNumber(bot.heat)) {
        issues.push({
          severity: 'ERROR',
          code: INVARIANT_ERROR_CODES.NON_FINITE_NUMBER,
          path: `battle.bots.${bot.botId}.heat`,
          message: `Bot '${bot.botId}' heat must be a non-negative finite number.`,
          actual: bot.heat,
        });
      }
    }

    if (snapshot.battle.battleBudget > snapshot.battle.battleBudgetCap + EPSILON) {
      issues.push({
        severity: 'ERROR',
        code: INVARIANT_ERROR_CODES.BATTLE_BUDGET_EXCEEDS_CAP,
        path: 'battle.battleBudget',
        message: `battle.battleBudget (${snapshot.battle.battleBudget}) exceeds battleBudgetCap (${snapshot.battle.battleBudgetCap}).`,
        expected: `<= ${String(snapshot.battle.battleBudgetCap)}`,
        actual: snapshot.battle.battleBudget,
      });
    }

    for (const attack of snapshot.battle.pendingAttacks) {
      const severity = classifyAttackSeverity(attack);
      const damage = computeEffectiveAttackDamage(attack);
      const counterable = isAttackCounterable(attack);
      const fromBot = isAttackFromBot(attack);

      if (!isFiniteNumber(damage) || damage < 0) {
        issues.push({
          severity: 'ERROR',
          code: INVARIANT_ERROR_CODES.PENDING_ATTACK_INVALID,
          path: 'battle.pendingAttacks',
          message: `Pending attack has invalid effective damage: ${String(damage)}.`,
          actual: damage,
        });
      }

      if (severity === 'CATASTROPHIC' && !counterable && !fromBot) {
        issues.push({
          severity: 'WARN',
          code: INVARIANT_ERROR_CODES.PENDING_ATTACK_INVALID,
          path: 'battle.pendingAttacks',
          message: 'CATASTROPHIC pending attack is not counterable and not from a known bot source.',
          actual: { severity, counterable, fromBot },
        });
      }
    }

    return issues;
  }

  /**
   * Inspects cascade state using GamePrimitives cascade utilities.
   * Uses scoreCascadeChainHealth, classifyCascadeChainHealth, isCascadeRecoverable.
   */
  public inspectCascadeSemantics(snapshot: RunStateSnapshot): readonly InvariantIssue[] {
    const issues: InvariantIssue[] = [];

    for (const chain of snapshot.cascade.activeChains) {
      const health = classifyCascadeChainHealth(chain);
      const score = scoreCascadeChainHealth(chain);
      const recoverable = isCascadeRecoverable(chain);

      if (health === 'LOST' && recoverable) {
        issues.push({
          severity: 'WARN',
          code: INVARIANT_ERROR_CODES.CASCADE_CHAIN_HEALTH_CRITICAL,
          path: 'cascade.activeChains',
          message: `Cascade chain classified as LOST but isCascadeRecoverable returns true. Score: ${score.toFixed(3)}.`,
          actual: { health, score, recoverable },
        });
      }

      if (health === 'CRITICAL' || health === 'LOST') {
        issues.push({
          severity: 'WARN',
          code: INVARIANT_ERROR_CODES.CASCADE_CHAIN_HEALTH_CRITICAL,
          path: 'cascade.activeChains',
          message: `Cascade chain health is ${health} (score: ${score.toFixed(3)}).`,
          actual: health,
        });
      }
    }

    return issues;
  }

  /**
   * Inspects sovereignty state using GamePrimitives integrity and grade maps.
   * Uses INTEGRITY_STATUS_RISK_SCORE, VERIFIED_GRADE_NUMERIC_SCORE.
   */
  public inspectSovereigntySemantics(snapshot: RunStateSnapshot): readonly InvariantIssue[] {
    const issues: InvariantIssue[] = [];
    const { sovereignty } = snapshot;

    const integrityRisk = isIntegrityStatus(sovereignty.integrityStatus)
      ? INTEGRITY_STATUS_RISK_SCORE[sovereignty.integrityStatus]
      : 1.0;

    if (integrityRisk >= 0.8 && sovereignty.proofHash === null && snapshot.outcome !== null) {
      issues.push({
        severity: 'WARN',
        code: INVARIANT_ERROR_CODES.PROOF_HASH_PRESENT_BEFORE_OUTCOME,
        path: 'sovereignty.proofHash',
        message: `High integrity risk (${integrityRisk}) but proofHash is null at terminal state.`,
        actual: sovereignty.proofHash,
      });
    }

    if (sovereignty.verifiedGrade !== null && isVerifiedGrade(sovereignty.verifiedGrade)) {
      const gradeScore = VERIFIED_GRADE_NUMERIC_SCORE[sovereignty.verifiedGrade];
      if (gradeScore < 0.2 && sovereignty.sovereigntyScore > 80) {
        issues.push({
          severity: 'WARN',
          code: INVARIANT_ERROR_CODES.VERIFIED_GRADE_INVALID,
          path: 'sovereignty',
          message: `Low verified grade (${sovereignty.verifiedGrade}, score ${gradeScore}) conflicts with high sovereigntyScore (${sovereignty.sovereigntyScore}).`,
          expected: `gradeScore >= 0.5 for sovereigntyScore > 80`,
          actual: { gradeScore, sovereigntyScore: sovereignty.sovereigntyScore },
        });
      }
    }

    return issues;
  }

  /**
   * Returns a full deep inspection using all GamePrimitives utilities.
   * Combines enum, pressure, shield, battle, cascade, and sovereignty semantics.
   */
  public inspectDeep(
    snapshot: RunStateSnapshot,
    options: RunStateInvariantOptions = {},
  ): RunStateInvariantReport {
    const base = this.inspect(snapshot, options);
    const enumIssues = this.inspectEnums(snapshot);
    const pressureIssues = this.inspectPressureSemantics(snapshot);
    const shieldIssues = this.inspectShieldSemantics(snapshot);
    const battleIssues = this.inspectBattleSemantics(snapshot);
    const cascadeIssues = this.inspectCascadeSemantics(snapshot);
    const sovereigntyIssues = this.inspectSovereigntySemantics(snapshot);

    const allErrors = [
      ...base.errors,
      ...enumIssues.filter((i) => i.severity === 'ERROR'),
      ...pressureIssues.filter((i) => i.severity === 'ERROR'),
      ...shieldIssues.filter((i) => i.severity === 'ERROR'),
      ...battleIssues.filter((i) => i.severity === 'ERROR'),
      ...cascadeIssues.filter((i) => i.severity === 'ERROR'),
      ...sovereigntyIssues.filter((i) => i.severity === 'ERROR'),
    ];

    const allWarnings = [
      ...base.warnings,
      ...enumIssues.filter((i) => i.severity === 'WARN'),
      ...pressureIssues.filter((i) => i.severity === 'WARN'),
      ...shieldIssues.filter((i) => i.severity === 'WARN'),
      ...battleIssues.filter((i) => i.severity === 'WARN'),
      ...cascadeIssues.filter((i) => i.severity === 'WARN'),
      ...sovereigntyIssues.filter((i) => i.severity === 'WARN'),
    ];

    return {
      ok: allErrors.length === 0,
      runId: base.runId,
      tick: base.tick,
      stage: base.stage,
      checksum: base.checksum,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  /**
   * Validates that the provided tick step is a recognized canonical step.
   * Uses TICK_SEQUENCE and TICK_STEP_DESCRIPTORS.
   */
  public validateTickStep(step: string): boolean {
    if (!isTickStep(step)) return false;
    const index = getTickStepIndex(step);
    return index >= 0 && index < TICK_SEQUENCE.length && TICK_STEP_DESCRIPTORS[step] !== undefined;
  }

  /**
   * Checks that a sequence of tick steps follows the canonical TICK_SEQUENCE order.
   * Uses TICK_SEQUENCE.
   */
  public validateTickStepOrder(steps: readonly TickStep[]): readonly InvariantIssue[] {
    const issues: InvariantIssue[] = [];
    let lastIndex = -1;

    for (const step of steps) {
      if (!isTickStep(step)) {
        issues.push({
          severity: 'ERROR',
          code: INVARIANT_ERROR_CODES.TICK_INVALID,
          path: `tick.step.${step}`,
          message: `'${step}' is not a recognized TickStep.`,
          actual: step,
        });
        continue;
      }

      const index = getTickStepIndex(step);
      if (index <= lastIndex) {
        issues.push({
          severity: 'ERROR',
          code: INVARIANT_ERROR_CODES.TICK_INVALID,
          path: `tick.step.${step}`,
          message: `TickStep '${step}' is out of order. Expected ordinal > ${lastIndex}, got ${index}.`,
          expected: `index > ${lastIndex}`,
          actual: index,
        });
      }

      const descriptor = TICK_STEP_DESCRIPTORS[step];
      if (!descriptor) {
        issues.push({
          severity: 'ERROR',
          code: INVARIANT_ERROR_CODES.TICK_INVALID,
          path: `tick.step.${step}`,
          message: `TickStep '${step}' has no descriptor in TICK_STEP_DESCRIPTORS.`,
          actual: step,
        });
        continue;
      }

      lastIndex = index;
    }

    return issues;
  }

  private formatReport(report: RunStateInvariantReport): string {
    const lines = [
      `RunStateInvariantGuard failed for run ${report.runId} at tick ${String(report.tick)} (${report.stage}).`,
      ...report.errors.map(
        (issue) =>
          `ERROR ${issue.code} @ ${issue.path}: ${issue.message}`,
      ),
      ...report.warnings.map(
        (issue) =>
          `WARN ${issue.code} @ ${issue.path}: ${issue.message}`,
      ),
    ];

    return lines.join(' ');
  }
}

// ============================================================================
// SECTION 11 — RunStateInvariantHistorian
// ============================================================================

const DEFAULT_MAX_ENTRIES_PER_RUN = 2_048;
const DEFAULT_MAX_HISTORIAN_RUNS = 64;

/**
 * Tracks invariant report history across runs for trend analysis and
 * failure pattern detection. Bounded by maxEntriesPerRun and maxRuns.
 */
export class RunStateInvariantHistorian {
  private readonly maxEntriesPerRun: number;
  private readonly maxRuns: number;
  private readonly byRunId = new Map<string, InvariantHistoryEntry[]>();
  private readonly runLru: string[] = [];
  private readonly codeStatsMap = new Map<string, InvariantCodeStats>();

  public constructor(options: InvariantHistorianOptions = {}) {
    this.maxEntriesPerRun = Math.max(1, options.maxEntriesPerRun ?? DEFAULT_MAX_ENTRIES_PER_RUN);
    this.maxRuns = Math.max(1, options.maxRuns ?? DEFAULT_MAX_HISTORIAN_RUNS);
  }

  /** Records a report in the historian ledger. */
  public record(report: RunStateInvariantReport, nowMs = Date.now()): InvariantHistoryEntry {
    const allIssues = [...report.errors, ...report.warnings];
    const dominantErrorCode = getDominantErrorCode(report.errors);

    const entryId = createDeterministicId(
      'invariant-history',
      report.runId,
      report.tick,
      report.stage,
      report.checksum.slice(0, 8),
    );

    const entry: InvariantHistoryEntry = Object.freeze({
      entryId,
      runId: report.runId,
      tick: report.tick,
      stage: report.stage,
      reportChecksum: report.checksum,
      errorCount: report.errors.length,
      warningCount: report.warnings.length,
      ok: report.ok,
      dominantErrorCode,
      recordedAtMs: nowMs,
    });

    // Append to per-run history
    const runHistory = this.byRunId.get(report.runId) ?? [];
    runHistory.push(entry);
    if (runHistory.length > this.maxEntriesPerRun) {
      runHistory.shift();
    }
    this.byRunId.set(report.runId, runHistory);

    // Update code stats
    for (const issue of allIssues) {
      this._updateCodeStats(issue, report.runId, report.tick);
    }

    // LRU management
    this._touchRun(report.runId);
    this._trimStore();

    return entry;
  }

  /** Returns the full history for a run. */
  public getHistory(runId: string): readonly InvariantHistoryEntry[] {
    return [...(this.byRunId.get(runId) ?? [])];
  }

  /** Returns the last N entries for a run. */
  public getRecentHistory(runId: string, count: number): readonly InvariantHistoryEntry[] {
    const history = this.byRunId.get(runId) ?? [];
    return history.slice(Math.max(0, history.length - count));
  }

  /** Returns stats for a specific error code across all runs. */
  public getCodeStats(code: string): InvariantCodeStats | null {
    return this.codeStatsMap.get(code) ?? null;
  }

  /** Returns all tracked code stats, sorted by hit count descending. */
  public getAllCodeStats(): readonly InvariantCodeStats[] {
    return Array.from(this.codeStatsMap.values())
      .sort((a, b) => b.hitCount - a.hitCount);
  }

  /** Computes a full analytics summary for a run. */
  public computeAnalytics(runId: string): InvariantAnalyticsSummary {
    const history = this.byRunId.get(runId) ?? [];
    const failedEntries = history.filter((e) => !e.ok);

    const totalErrors = history.reduce((acc, e) => acc + e.errorCount, 0);
    const totalWarnings = history.reduce((acc, e) => acc + e.warningCount, 0);
    const failureRate = history.length > 0 ? failedEntries.length / history.length : 0;

    const codeCounts = new Map<string, number>();
    for (const entry of failedEntries) {
      if (entry.dominantErrorCode) {
        codeCounts.set(entry.dominantErrorCode, (codeCounts.get(entry.dominantErrorCode) ?? 0) + 1);
      }
    }

    const mostFrequentErrorCode = codeCounts.size > 0
      ? Array.from(codeCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
      : null;

    const errorCodeStats = this.getAllCodeStats().filter((s) => s.affectedRunIds.includes(runId));

    const firstFailureTick = failedEntries[0]?.tick ?? null;
    const lastFailureTick = failedEntries[failedEntries.length - 1]?.tick ?? null;

    let consecutiveCleanChecks = 0;
    for (let i = history.length - 1; i >= 0; i -= 1) {
      if (history[i]!.ok) {
        consecutiveCleanChecks += 1;
      } else {
        break;
      }
    }

    // ML risk trend — last 20 entries mapped to risk score proxies
    const recentHistory = history.slice(Math.max(0, history.length - 20));
    const mlRiskTrend = recentHistory.map((e) => {
      return Math.min(1, (e.errorCount * 0.15 + e.warningCount * 0.03));
    });

    return {
      runId,
      totalChecks: history.length,
      totalErrors,
      totalWarnings,
      failureRate,
      mostFrequentErrorCode,
      errorCodeStats,
      firstFailureTick,
      lastFailureTick,
      consecutiveCleanChecks,
      mlRiskTrend,
    };
  }

  /** Returns whether a run's invariant trend is improving. */
  public isTrendImproving(runId: string): boolean {
    const recent = this.getRecentHistory(runId, 10);
    if (recent.length < 2) return true;
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));
    const firstAvgErrors = firstHalf.reduce((a, e) => a + e.errorCount, 0) / firstHalf.length;
    const secondAvgErrors = secondHalf.reduce((a, e) => a + e.errorCount, 0) / secondHalf.length;
    return secondAvgErrors <= firstAvgErrors;
  }

  /** Clears all history for a run. */
  public clearRun(runId: string): void {
    this.byRunId.delete(runId);
    const nextLru = this.runLru.filter((id) => id !== runId);
    this.runLru.length = 0;
    this.runLru.push(...nextLru);
  }

  /** Clears all history. */
  public clear(): void {
    this.byRunId.clear();
    this.runLru.length = 0;
    this.codeStatsMap.clear();
  }

  private _updateCodeStats(issue: InvariantIssue, runId: string, tick: number): void {
    const existing = this.codeStatsMap.get(issue.code);
    if (!existing) {
      this.codeStatsMap.set(issue.code, {
        code: issue.code,
        hitCount: 1,
        firstSeenTick: tick,
        lastSeenTick: tick,
        affectedRunIds: [runId],
        severityBreakdown: { ERROR: issue.severity === 'ERROR' ? 1 : 0, WARN: issue.severity === 'WARN' ? 1 : 0 },
      });
      return;
    }

    const affectedRunIds = existing.affectedRunIds.includes(runId)
      ? existing.affectedRunIds
      : [...existing.affectedRunIds, runId];

    this.codeStatsMap.set(issue.code, {
      ...existing,
      hitCount: existing.hitCount + 1,
      lastSeenTick: Math.max(existing.lastSeenTick, tick),
      affectedRunIds,
      severityBreakdown: {
        ERROR: existing.severityBreakdown.ERROR + (issue.severity === 'ERROR' ? 1 : 0),
        WARN: existing.severityBreakdown.WARN + (issue.severity === 'WARN' ? 1 : 0),
      },
    });
  }

  private _touchRun(runId: string): void {
    const filtered = this.runLru.filter((id) => id !== runId);
    this.runLru.length = 0;
    this.runLru.push(...filtered, runId);
  }

  private _trimStore(): void {
    while (this.byRunId.size > this.maxRuns) {
      const oldest = this.runLru.shift();
      if (!oldest) break;
      this.byRunId.delete(oldest);
    }
  }
}

// ============================================================================
// SECTION 12 — RunStateInvariantMLAdapter
// ============================================================================

/**
 * Converts RunStateInvariantReport → InvariantMLSignal for ML/DL routing.
 * Uses every INVARIANT_ML_FEATURE_LABELS entry and all GamePrimitives scoring maps.
 */
export class RunStateInvariantMLAdapter {
  private readonly criticalCodes: ReadonlySet<string>;
  private readonly highRiskCodes: ReadonlySet<string>;

  public constructor(options: InvariantMLAdapterOptions = {}) {
    this.criticalCodes = options.criticalErrorCodes
      ? new Set(options.criticalErrorCodes)
      : INVARIANT_CRITICAL_ERROR_CODES;
    this.highRiskCodes = options.highRiskErrorCodes
      ? new Set(options.highRiskErrorCodes)
      : INVARIANT_HIGH_RISK_ERROR_CODES;
  }

  /** Converts a report + snapshot into a full InvariantMLSignal. */
  public buildSignal(
    report: RunStateInvariantReport,
    snapshot: RunStateSnapshot,
    nowMs = Date.now(),
    isTransition = false,
  ): InvariantMLSignal {
    const allIssues = [...report.errors, ...report.warnings];
    const riskClass = classifyInvariantMLRisk(report);
    const riskScore = computeInvariantRiskScore(allIssues);
    const dominantErrorCode = getDominantErrorCode(report.errors);
    const affectedPaths = [...new Set(allIssues.map((i) => i.path))];
    const mlFeatureVector = extractInvariantMLVector(report, snapshot, isTransition);
    const recommendedAction = determineRemediationAction(report, snapshot);

    const signalId = createDeterministicId(
      'invariant-ml-signal',
      report.runId,
      report.tick,
      report.stage,
      report.checksum.slice(0, 8),
      String(nowMs),
    );

    return Object.freeze({
      signalId,
      runId: report.runId,
      tick: report.tick,
      stage: report.stage,
      riskClass,
      riskScore,
      errorCount: report.errors.length,
      warningCount: report.warnings.length,
      dominantErrorCode,
      affectedPaths,
      mlFeatureVector,
      recommendedAction,
      emittedAtMs: nowMs,
    });
  }

  /** Returns whether a signal should be routed to the chat system. */
  public shouldEmitChatSignal(signal: InvariantMLSignal): boolean {
    return signal.riskClass === 'critical' || signal.riskClass === 'high';
  }

  /** Returns a normalized urgency score for the ML signal (0..1). */
  public computeSignalUrgency(signal: InvariantMLSignal): number {
    switch (signal.riskClass) {
      case 'critical': return 1.0;
      case 'high': return 0.75;
      case 'moderate': return 0.45;
      case 'nominal': return 0.10;
    }
  }

  /** Returns the feature vector labels for this adapter. */
  public getFeatureLabels(): readonly string[] {
    return INVARIANT_ML_FEATURE_LABELS;
  }

  /** Returns the HATER_BOT_IDS array for downstream bot-threat cross-referencing. */
  public getKnownBotIds(): readonly HaterBotId[] {
    return HATER_BOT_IDS;
  }

  /** Returns the PRESSURE_TIERS array for tier-level routing decisions. */
  public getKnownPressureTiers(): readonly PressureTier[] {
    return PRESSURE_TIERS;
  }

  /** Returns pressure tier normalized weights for ML routing calibration. */
  public getPressureTierWeights(): Readonly<Record<PressureTier, number>> {
    const result: Partial<Record<PressureTier, number>> = {};
    for (const tier of PRESSURE_TIERS) {
      result[tier] = PRESSURE_TIER_NORMALIZED[tier];
    }
    return result as Record<PressureTier, number>;
  }
}

// ============================================================================
// SECTION 13 — RunStateInvariantBatchInspector
// ============================================================================

/**
 * Inspects multiple snapshots in a deterministic batch and aggregates results.
 * Uses checksumParts for aggregate checksum computation.
 */
export class RunStateInvariantBatchInspector {
  private readonly guard: RunStateInvariantGuard;

  public constructor(guard?: RunStateInvariantGuard) {
    this.guard = guard ?? new RunStateInvariantGuard();
  }

  /** Inspects a batch of snapshots and returns aggregate results. */
  public inspectBatch(
    snapshots: readonly RunStateSnapshot[],
    options: InvariantBatchInspectorOptions = {},
  ): InvariantBatchResult {
    const maxSnapshots = options.maxSnapshots ?? 512;
    const bounded = snapshots.slice(0, maxSnapshots);

    const reports: RunStateInvariantReport[] = [];
    let passedCount = 0;
    let failedCount = 0;

    for (const snapshot of bounded) {
      const report = options.failFast
        ? this.guard.inspectDeep(snapshot, options)
        : this.guard.inspect(snapshot, options);

      reports.push(report);

      if (report.ok) {
        passedCount += 1;
      } else {
        failedCount += 1;
        if (options.failFast) break;
      }
    }

    // Compute aggregate checksum of all individual checksums
    const aggregateChecksum = checksumParts(
      ...reports.map((r) => r.checksum),
    );

    return {
      totalSnapshots: bounded.length,
      passedCount,
      failedCount,
      reports,
      aggregateChecksum,
      overallOk: failedCount === 0,
    };
  }

  /**
   * Inspects a transition sequence (ordered list of snapshots) and validates
   * each consecutive pair as a transition.
   */
  public inspectTransitionSequence(
    snapshots: readonly RunStateSnapshot[],
    options: RunStateTransitionOptions = {},
  ): InvariantBatchResult {
    if (snapshots.length < 2) {
      return {
        totalSnapshots: snapshots.length,
        passedCount: snapshots.length,
        failedCount: 0,
        reports: [],
        aggregateChecksum: '',
        overallOk: true,
      };
    }

    const reports: RunStateInvariantReport[] = [];
    let passedCount = 0;
    let failedCount = 0;

    for (let i = 1; i < snapshots.length; i++) {
      const previous = snapshots[i - 1]!;
      const next = snapshots[i]!;
      const report = this.guard.inspectTransition(previous, next, options);
      reports.push(report);
      if (report.ok) passedCount += 1;
      else failedCount += 1;
    }

    const aggregateChecksum = checksumParts(...reports.map((r) => r.checksum));

    return {
      totalSnapshots: snapshots.length,
      passedCount,
      failedCount,
      reports,
      aggregateChecksum,
      overallOk: failedCount === 0,
    };
  }

  /**
   * Returns per-step batch summary — groups reports by tick and stage.
   */
  public groupByStage(result: InvariantBatchResult): Readonly<Record<InvariantStage, RunStateInvariantReport[]>> {
    const groups: Record<InvariantStage, RunStateInvariantReport[]> = {
      runtime: [],
      'tick-finalized': [],
      terminal: [],
    };
    for (const report of result.reports) {
      groups[report.stage].push(report);
    }
    return Object.freeze(groups);
  }
}

// ============================================================================
// SECTION 14 — RunStateInvariantRemediationAdvisor
// ============================================================================

/**
 * Generates structured remediation suggestions for invariant issues.
 * Uses all GamePrimitives scoring tables to calibrate urgency and targets.
 */
export class RunStateInvariantRemediationAdvisor {
  private readonly guard: RunStateInvariantGuard;

  public constructor(guard?: RunStateInvariantGuard) {
    this.guard = guard ?? new RunStateInvariantGuard();
  }

  /** Generates remediation suggestions for all issues in a report. */
  public advise(
    report: RunStateInvariantReport,
    snapshot: RunStateSnapshot,
  ): readonly InvariantRemediationSuggestion[] {
    const allIssues = [...report.errors, ...report.warnings];
    return allIssues.map((issue) => this._buildSuggestion(issue, snapshot, report));
  }

  /** Generates suggestions and returns only the highest-urgency ones. */
  public advisePriority(
    report: RunStateInvariantReport,
    snapshot: RunStateSnapshot,
    topN = 5,
  ): readonly InvariantRemediationSuggestion[] {
    const all = this.advise(report, snapshot);
    return [...all].sort((a, b) => b.urgency - a.urgency).slice(0, topN);
  }

  private _buildSuggestion(
    issue: InvariantIssue,
    snapshot: RunStateSnapshot,
    report: RunStateInvariantReport,
  ): InvariantRemediationSuggestion {
    const action = this._resolveAction(issue, snapshot);
    const description = this._buildDescription(issue, snapshot);
    const engineTarget = this._resolveEngineTarget(issue);
    const urgency = this._computeUrgency(issue, snapshot);
    const autoRecoverable = this._isAutoRecoverable(issue);

    void report; // used for future context-aware suggestions

    return Object.freeze({
      issueCode: issue.code,
      issuePath: issue.path,
      severity: issue.severity,
      action,
      description,
      engineTarget,
      urgency,
      autoRecoverable,
    });
  }

  private _resolveAction(issue: InvariantIssue, snapshot: RunStateSnapshot): InvariantRemediationAction {
    if (INVARIANT_CRITICAL_ERROR_CODES.has(issue.code)) {
      const integrityRisk = isIntegrityStatus(snapshot.sovereignty.integrityStatus)
        ? INTEGRITY_STATUS_RISK_SCORE[snapshot.sovereignty.integrityStatus]
        : 1.0;
      return integrityRisk >= 0.8 ? 'QUARANTINE_SNAPSHOT' : 'ROLLBACK_CHECKPOINT';
    }
    if (issue.code === INVARIANT_ERROR_CODES.ECONOMY_NET_WORTH_DRIFT ||
        issue.code === INVARIANT_ERROR_CODES.SHIELD_LAYER_RATIO_DRIFT ||
        issue.code === INVARIANT_ERROR_CODES.SHIELD_WEAKEST_LAYER_DRIFT) {
      return 'RECOMPUTE_DERIVED_FIELDS';
    }
    if (issue.code === INVARIANT_ERROR_CODES.INTEGRITY_STATUS_INVALID ||
        issue.code === INVARIANT_ERROR_CODES.VERIFIED_GRADE_INVALID) {
      return 'EMIT_AUDIT_FLAG';
    }
    if (issue.severity === 'ERROR' && INVARIANT_HIGH_RISK_ERROR_CODES.has(issue.code)) {
      return 'ROLLBACK_CHECKPOINT';
    }
    return 'NOOP';
  }

  private _buildDescription(issue: InvariantIssue, snapshot: RunStateSnapshot): string {
    const tierLabel = PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier].toFixed(2);
    const modeLabel = snapshot.mode;

    switch (issue.code) {
      case INVARIANT_ERROR_CODES.SCHEMA_VERSION_INVALID:
        return `Snapshot schema version mismatch at tick ${snapshot.tick}. Migration or reset required.`;
      case INVARIANT_ERROR_CODES.SHIELD_LAYERS_EMPTY:
        return `Shield system has no layers at tick ${snapshot.tick}. Engine initialization failure suspected.`;
      case INVARIANT_ERROR_CODES.TERMINAL_OUTCOME_MUTATED:
        return `Terminal outcome changed mid-run — proof chain integrity at risk.`;
      case INVARIANT_ERROR_CODES.PROOF_HASH_MUTATED:
        return `Proof hash mutation detected — sovereignty audit required.`;
      case INVARIANT_ERROR_CODES.ECONOMY_NET_WORTH_DRIFT:
        return `Economy net worth drift at mode ${modeLabel}, tier ${tierLabel}. Recompute recommended.`;
      case INVARIANT_ERROR_CODES.BATTLE_BUDGET_EXCEEDS_CAP:
        return `Battle budget overflow detected — budget engine state is inconsistent.`;
      case INVARIANT_ERROR_CODES.ELAPSED_MS_REGRESSED:
        return `Elapsed time regressed — clock source integrity failure.`;
      default:
        return `${issue.severity} at ${issue.path}: ${issue.message}`;
    }
  }

  private _resolveEngineTarget(issue: InvariantIssue): string {
    const path = issue.path;
    if (path.startsWith('economy')) return 'economy';
    if (path.startsWith('pressure')) return 'pressure';
    if (path.startsWith('tension')) return 'tension';
    if (path.startsWith('shield')) return 'shield';
    if (path.startsWith('battle')) return 'battle';
    if (path.startsWith('cascade')) return 'cascade';
    if (path.startsWith('sovereignty')) return 'sovereignty';
    if (path.startsWith('timers')) return 'time';
    if (path.startsWith('telemetry')) return 'telemetry';
    return 'orchestrator';
  }

  private _computeUrgency(issue: InvariantIssue, snapshot: RunStateSnapshot): number {
    let base = issue.severity === 'ERROR' ? 0.6 : 0.25;

    if (INVARIANT_CRITICAL_ERROR_CODES.has(issue.code)) base = 1.0;
    else if (INVARIANT_HIGH_RISK_ERROR_CODES.has(issue.code)) base = 0.80;

    const tierMod = PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier] * 0.20;
    const modMod = (MODE_DIFFICULTY_MULTIPLIER[snapshot.mode] - 1.0) * 0.05;

    return Math.max(0, Math.min(1, base + tierMod + modMod));
  }

  private _isAutoRecoverable(issue: InvariantIssue): boolean {
    const autoRecoverableCodes = new Set<string>([
      INVARIANT_ERROR_CODES.SHIELD_LAYER_RATIO_DRIFT,
      INVARIANT_ERROR_CODES.SHIELD_WEAKEST_LAYER_DRIFT,
      INVARIANT_ERROR_CODES.SHIELD_WEAKEST_RATIO_DRIFT,
      INVARIANT_ERROR_CODES.ECONOMY_NET_WORTH_DRIFT,
      INVARIANT_ERROR_CODES.FROZEN_WINDOW_FLAG_DRIFT,
      INVARIANT_ERROR_CODES.PRESSURE_MAX_SCORE_BELOW_CURRENT,
    ]);
    return autoRecoverableCodes.has(issue.code) && issue.severity === 'WARN';
  }
}

// ============================================================================
// SECTION 15 — RunStateInvariantChatSignalBridge
// ============================================================================

/**
 * Translates invariant ML signals into backend chat signals for companion,
 * urgency overlays, and boss-telegraph events.
 * Uses SHIELD_LAYER_LABEL_BY_ID, TIMING_CLASS_WINDOW_PRIORITY for context enrichment.
 */
export class RunStateInvariantChatSignalBridge {
  private readonly mlAdapter: RunStateInvariantMLAdapter;

  public constructor(mlAdapter?: RunStateInvariantMLAdapter) {
    this.mlAdapter = mlAdapter ?? new RunStateInvariantMLAdapter();
  }

  /** Converts an InvariantMLSignal into a chat signal envelope. */
  public buildChatSignal(
    signal: InvariantMLSignal,
    snapshot: RunStateSnapshot,
    nowMs = Date.now(),
  ): InvariantChatSignal | null {
    if (!this.mlAdapter.shouldEmitChatSignal(signal)) return null;

    const channel = signal.riskClass === 'critical' ? 'BATTLE_SIGNAL' : 'RUN_SIGNAL';
    const priority = signal.riskClass === 'critical' ? 'INTERRUPT' : 'ELEVATED';

    const title = this._buildTitle(signal, snapshot);
    const body = this._buildBody(signal, snapshot);

    const signalId = createDeterministicId(
      'invariant-chat-signal',
      signal.signalId,
      String(nowMs),
    );

    return Object.freeze({
      signalId,
      runId: signal.runId,
      tick: signal.tick,
      channel,
      priority,
      title,
      body,
      errorCodes: signal.dominantErrorCode ? [signal.dominantErrorCode] : [],
      requiresPlayerAction: signal.recommendedAction !== 'NOOP' &&
                            signal.recommendedAction !== 'RECOMPUTE_DERIVED_FIELDS',
      emittedAtMs: nowMs,
    });
  }

  private _buildTitle(signal: InvariantMLSignal, snapshot: RunStateSnapshot): string {
    const tier = snapshot.pressure.tier;
    const tierNorm = PRESSURE_TIER_NORMALIZED[tier];

    if (signal.riskClass === 'critical') {
      return `Critical integrity failure at tick ${signal.tick} — ${tier} pressure (${(tierNorm * 100).toFixed(0)}%)`;
    }
    return `Run state anomaly detected at tick ${signal.tick} — ${signal.errorCount} error(s)`;
  }

  private _buildBody(signal: InvariantMLSignal, snapshot: RunStateSnapshot): string {
    const weakestLabel = SHIELD_LAYER_LABEL_BY_ID[snapshot.shield.weakestLayerId];

    const windowCount = Object.keys(snapshot.timers.activeDecisionWindows).length;
    const windowUrgency = windowCount > 0
      ? Object.values(snapshot.timers.activeDecisionWindows)
          .map((w) => TIMING_CLASS_WINDOW_PRIORITY[w.timingClass] ?? 0)
          .reduce((a, b) => a + b, 0) / windowCount
      : 0;

    const modeMode = snapshot.mode;
    const difficultyMod = MODE_DIFFICULTY_MULTIPLIER[modeMode];

    const parts: string[] = [
      `Affected: ${signal.affectedPaths.slice(0, 3).join(', ')}${signal.affectedPaths.length > 3 ? '...' : ''}.`,
      `Shield: ${weakestLabel} at ${(snapshot.shield.weakestLayerRatio * 100).toFixed(0)}% integrity.`,
      windowCount > 0
        ? `${windowCount} decision window(s) active (avg priority: ${windowUrgency.toFixed(2)}).`
        : 'No active decision windows.',
      `Mode: ${modeMode} (difficulty ×${difficultyMod.toFixed(1)}).`,
      signal.recommendedAction !== 'NOOP'
        ? `Recommended action: ${signal.recommendedAction}.`
        : '',
    ];

    return parts.filter(Boolean).join(' ');
  }
}

// ============================================================================
// SECTION 16 — RunStateInvariantAnalytics
// ============================================================================

/**
 * Computes cross-run invariant analytics using the historian and ML adapter.
 * Uses MODE_CODES, RUN_PHASES, RUN_OUTCOMES for cross-dimension aggregation.
 */
export class RunStateInvariantAnalytics {
  private readonly historian: RunStateInvariantHistorian;
  private readonly mlAdapter: RunStateInvariantMLAdapter;
  private readonly advisor: RunStateInvariantRemediationAdvisor;
  private readonly guard: RunStateInvariantGuard;
  private readonly chatBridge: RunStateInvariantChatSignalBridge;

  public constructor(
    historian?: RunStateInvariantHistorian,
    mlAdapter?: RunStateInvariantMLAdapter,
  ) {
    this.guard = new RunStateInvariantGuard();
    this.historian = historian ?? new RunStateInvariantHistorian();
    this.mlAdapter = mlAdapter ?? new RunStateInvariantMLAdapter();
    this.advisor = new RunStateInvariantRemediationAdvisor(this.guard);
    this.chatBridge = new RunStateInvariantChatSignalBridge(this.mlAdapter);
  }

  /**
   * Full pipeline: inspect → record → build ML signal → optionally build chat signal.
   * Returns all produced artifacts.
   */
  public process(
    snapshot: RunStateSnapshot,
    options: RunStateInvariantOptions = {},
    nowMs = Date.now(),
  ): {
    report: RunStateInvariantReport;
    historyEntry: InvariantHistoryEntry;
    mlSignal: InvariantMLSignal;
    chatSignal: InvariantChatSignal | null;
    suggestions: readonly InvariantRemediationSuggestion[];
  } {
    const report = this.guard.inspectDeep(snapshot, options);
    const historyEntry = this.historian.record(report, nowMs);
    const mlSignal = this.mlAdapter.buildSignal(report, snapshot, nowMs);
    const chatSignal = this.chatBridge.buildChatSignal(mlSignal, snapshot, nowMs);
    const suggestions = this.advisor.advisePriority(report, snapshot, 3);

    return { report, historyEntry, mlSignal, chatSignal, suggestions };
  }

  /**
   * Returns cross-mode error distribution — how many errors per mode across
   * all tracked runs. Uses MODE_CODES canonical list.
   */
  public getErrorDistributionByMode(
    snapshots: readonly RunStateSnapshot[],
  ): Readonly<Record<ModeCode, number>> {
    const distribution: Partial<Record<ModeCode, number>> = {};
    for (const mode of MODE_CODES) {
      distribution[mode] = 0;
    }

    for (const snapshot of snapshots) {
      if (!isModeCode(snapshot.mode)) continue;
      const report = this.guard.inspect(snapshot);
      distribution[snapshot.mode] = (distribution[snapshot.mode] ?? 0) + report.errors.length;
    }

    return distribution as Record<ModeCode, number>;
  }

  /**
   * Returns cross-phase error distribution.
   * Uses RUN_PHASES canonical list and isRunPhase type guard.
   */
  public getErrorDistributionByPhase(
    snapshots: readonly RunStateSnapshot[],
  ): Readonly<Record<RunPhase, number>> {
    const distribution: Partial<Record<RunPhase, number>> = {};
    for (const phase of RUN_PHASES) {
      distribution[phase] = 0;
    }

    for (const snapshot of snapshots) {
      if (!isRunPhase(snapshot.phase)) continue;
      const report = this.guard.inspect(snapshot);
      distribution[snapshot.phase] = (distribution[snapshot.phase] ?? 0) + report.errors.length;
    }

    return distribution as Record<RunPhase, number>;
  }

  /**
   * Returns outcome-wise invariant failure stats.
   * Uses RUN_OUTCOMES canonical list and isRunOutcome type guard.
   */
  public getErrorDistributionByOutcome(
    snapshots: readonly RunStateSnapshot[],
  ): Readonly<Record<string, number>> {
    const distribution: Record<string, number> = { ACTIVE: 0 };
    for (const outcome of RUN_OUTCOMES) {
      distribution[outcome] = 0;
    }

    for (const snapshot of snapshots) {
      const key = snapshot.outcome !== null && isRunOutcome(snapshot.outcome)
        ? snapshot.outcome
        : 'ACTIVE';
      const report = this.guard.inspect(snapshot);
      distribution[key] = (distribution[key] ?? 0) + report.errors.length;
    }

    return distribution;
  }

  /** Returns a module health summary for the invariant guard subsystem. */
  public getModuleHealth(): Readonly<{
    moduleVersion: string;
    ready: boolean;
    mlFeatureCount: number;
    knownErrorCodeCount: number;
    criticalCodeCount: number;
    highRiskCodeCount: number;
    recognizedModes: readonly string[];
    recognizedPhases: readonly string[];
    recognizedTiers: readonly string[];
    recognizedShieldLayerIds: readonly string[];
    recognizedBotIds: readonly string[];
    recognizedTimingClasses: readonly string[];
    recognizedDeckTypes: readonly string[];
    recognizedIntegrityStatuses: readonly string[];
    recognizedVerifiedGrades: readonly string[];
  }> {
    return Object.freeze({
      moduleVersion: INVARIANT_GUARD_MODULE_VERSION,
      ready: INVARIANT_GUARD_MODULE_READY,
      mlFeatureCount: INVARIANT_ML_FEATURE_COUNT,
      knownErrorCodeCount: Object.keys(INVARIANT_ERROR_CODES).length,
      criticalCodeCount: INVARIANT_CRITICAL_ERROR_CODES.size,
      highRiskCodeCount: INVARIANT_HIGH_RISK_ERROR_CODES.size,
      recognizedModes: MODE_CODES,
      recognizedPhases: RUN_PHASES,
      recognizedTiers: PRESSURE_TIERS,
      recognizedShieldLayerIds: SHIELD_LAYER_IDS,
      recognizedBotIds: HATER_BOT_IDS,
      recognizedTimingClasses: TIMING_CLASSES,
      recognizedDeckTypes: DECK_TYPES,
      recognizedIntegrityStatuses: INTEGRITY_STATUSES,
      recognizedVerifiedGrades: VERIFIED_GRADES,
    });
  }
}

// ============================================================================
// SECTION 17 — FACTORY UTILITIES
// ============================================================================

/** Builds a fully-wired invariant analytics stack from scratch. */
export function buildInvariantAnalyticsStack(options: {
  historianOptions?: InvariantHistorianOptions;
  mlAdapterOptions?: InvariantMLAdapterOptions;
} = {}): {
  guard: RunStateInvariantGuard;
  historian: RunStateInvariantHistorian;
  mlAdapter: RunStateInvariantMLAdapter;
  batchInspector: RunStateInvariantBatchInspector;
  remediationAdvisor: RunStateInvariantRemediationAdvisor;
  chatSignalBridge: RunStateInvariantChatSignalBridge;
  analytics: RunStateInvariantAnalytics;
} {
  const guard = new RunStateInvariantGuard();
  const historian = new RunStateInvariantHistorian(options.historianOptions);
  const mlAdapter = new RunStateInvariantMLAdapter(options.mlAdapterOptions);
  const batchInspector = new RunStateInvariantBatchInspector(guard);
  const remediationAdvisor = new RunStateInvariantRemediationAdvisor(guard);
  const chatSignalBridge = new RunStateInvariantChatSignalBridge(mlAdapter);
  const analytics = new RunStateInvariantAnalytics(historian, mlAdapter);

  return { guard, historian, mlAdapter, batchInspector, remediationAdvisor, chatSignalBridge, analytics };
}

/** Convenience: inspect a snapshot with deep checks and return just the report. */
export function deepInspectSnapshot(
  snapshot: RunStateSnapshot,
  options: RunStateInvariantOptions = {},
): RunStateInvariantReport {
  return new RunStateInvariantGuard().inspectDeep(snapshot, options);
}

/** Convenience: check if a snapshot is valid (no errors from deep inspection). */
export function isSnapshotValid(
  snapshot: RunStateSnapshot,
  options: RunStateInvariantOptions = {},
): boolean {
  return deepInspectSnapshot(snapshot, options).ok;
}

/** Convenience: validate a transition sequence and return pass/fail. */
export function isTransitionSequenceValid(
  snapshots: readonly RunStateSnapshot[],
  options: RunStateTransitionOptions = {},
): boolean {
  const inspector = new RunStateInvariantBatchInspector();
  return inspector.inspectTransitionSequence(snapshots, options).overallOk;
}
