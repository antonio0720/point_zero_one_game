// backend/src/game/engine/zero/ErrorBoundary.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/ErrorBoundary.ts
 * VERSION: error-boundary.v4.2026
 *
 * Doctrine:
 * - Engine 0 must catch per-step faults without flattening engine ownership.
 * - Errors are converted into deterministic records + signals + snapshot
 *   annotations. Fatality does not directly mutate outcome — it annotates
 *   telemetry so the core RuntimeOutcomeResolver / OutcomeGate can convert
 *   ENGINE_ABORT into ABANDONED.
 * - This boundary is reusable for engine steps, mode hooks, and zero-owned
 *   steps.
 * - Every failure record is traceable through ML vectors, DL tensors, chat
 *   signals, trend analysis, recovery forecasts, and session analytics.
 * - No silent failures. Every fault is classified, scored, and emitted.
 *
 * Surface summary:
 *   § 1  — Internal utility types + Mutable<T>
 *   § 2  — Public error domain types (owner, options, meta, record, result)
 *   § 3  — Error code registry + classification
 *   § 4  — Error budget tracking
 *   § 5  — ML 32-dim feature vector extraction
 *   § 6  — DL 40×6 tensor construction
 *   § 7  — Chat signal construction
 *   § 8  — Telemetry snapshot
 *   § 9  — Narrative generation
 *   § 10 — Rate controller
 *   § 11 — Error histogram
 *   § 12 — Trend analyzer
 *   § 13 — Recovery forecaster
 *   § 14 — Session analytics
 *   § 15 — Annotation bundle
 *   § 16 — Circuit breaker
 *   § 17 — Quarantine manager
 *   § 18 — ErrorBoundary class (core + all ML/DL/chat surfaces)
 *   § 19 — Well-known singletons + factories
 *   § 20 — Utility functions + public constants
 */

import { cloneJson, deepFreeze } from '../core/Deterministic';
import {
  createEngineSignal,
  type EngineId,
  type EngineSignal,
} from '../core/EngineContracts';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { TickStep } from '../core/TickSequence';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — Internal utility types
// ─────────────────────────────────────────────────────────────────────────────

type Mutable<T> =
  T extends readonly (infer U)[]
    ? Mutable<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: Mutable<T[K]> }
      : T;

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function uniqueAppend<T>(items: readonly T[], value: T): readonly T[] {
  return items.includes(value) ? freezeArray(items) : freezeArray([...items, value]);
}

function uniqueAppendMany<T>(items: readonly T[], values: readonly T[]): readonly T[] {
  const next = [...items];
  for (const value of values) {
    if (!next.includes(value)) {
      next.push(value);
    }
  }
  return freezeArray(next);
}

function normalizeMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  if (typeof error === 'string' && error.length > 0) {
    return error;
  }
  return 'Unknown runtime error.';
}

function normalizeStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function clamp100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function isoNow(): string {
  return new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — Public error domain types
// ─────────────────────────────────────────────────────────────────────────────

export const ERROR_BOUNDARY_VERSION = 'error-boundary.v4.2026' as const;

export type ErrorBoundaryOwner = EngineId | 'mode' | 'system';

export interface ErrorBoundaryOptions {
  /** Maximum consecutive failures before `fatal` is set. Default: 5. */
  readonly maxConsecutiveFailures?: number;
  /** Whether to annotate the run snapshot on failure. Default: true. */
  readonly annotateSnapshot?: boolean;
  /** Whether to enable circuit-breaker protection. Default: true. */
  readonly enableCircuitBreaker?: boolean;
  /** Whether to enable quarantine tracking. Default: true. */
  readonly enableQuarantine?: boolean;
  /** ML anomaly score threshold [0–1] above which ML vectors are emitted. Default: 0.55. */
  readonly mlAnomalyThreshold?: number;
  /** DL tensor anomaly threshold [0–1]. Default: 0.60. */
  readonly dlAnomalyThreshold?: number;
}

export interface ErrorBoundaryCaptureMeta {
  readonly owner: ErrorBoundaryOwner;
  readonly step: TickStep;
  readonly tick: number;
  readonly signalOwner?: EngineId | 'mode';
  readonly code?: string;
  readonly tags?: readonly string[];
  readonly snapshot?: RunStateSnapshot | null;
}

export interface ErrorBoundaryRecord {
  readonly owner: ErrorBoundaryOwner;
  readonly signalOwner: EngineId | 'mode';
  readonly step: TickStep;
  readonly tick: number;
  readonly code: string;
  readonly message: string;
  readonly severity: EngineSignal['severity'];
  readonly fatal: boolean;
  readonly tags: readonly string[];
  readonly stack?: string;
  readonly occurredAtMs: number;
  readonly consecutiveFailures: number;
  /** Error category derived from the code. */
  readonly category: ErrorCategory;
  /** ML anomaly score [0–1] derived from failure context. */
  readonly mlAnomalyScore: number;
  /**
   * Internal trend sentinel — undefined for real error records; set to true
   * only on synthetic success-reset markers injected by TrendAnalyzer.
   */
  readonly ok_marker?: boolean;
}

export interface ErrorBoundaryResult<T> {
  readonly ok: boolean;
  readonly value: T;
  readonly fatal: boolean;
  readonly record: ErrorBoundaryRecord | null;
  readonly signal: EngineSignal | null;
  readonly snapshot: RunStateSnapshot | null;
}

const DEFAULT_OPTIONS: Required<ErrorBoundaryOptions> = {
  maxConsecutiveFailures: 5,
  annotateSnapshot: true,
  enableCircuitBreaker: true,
  enableQuarantine: true,
  mlAnomalyThreshold: 0.55,
  dlAnomalyThreshold: 0.60,
};

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — Error code registry + classification
// ─────────────────────────────────────────────────────────────────────────────

/** Functional category that classifies the nature of a boundary error. */
export type ErrorCategory =
  | 'engine_step'
  | 'mode_hook'
  | 'state_mutation'
  | 'timeout'
  | 'invariant'
  | 'determinism'
  | 'resource'
  | 'system'
  | 'unknown';

export const ERROR_BOUNDARY_CODE_REGISTRY: Readonly<Record<string, ErrorCategory>> = Object.freeze({
  ENGINE_STEP_FATAL:        'engine_step',
  ENGINE_STEP_FAILED:       'engine_step',
  ENGINE_STEP_TIMEOUT:      'timeout',
  MODE_HOOK_FAILED:         'mode_hook',
  MODE_HOOK_TIMEOUT:        'timeout',
  STATE_MUTATION_REJECTED:  'state_mutation',
  INVARIANT_VIOLATION:      'invariant',
  DETERMINISM_FAULT:        'determinism',
  RESOURCE_EXHAUSTED:       'resource',
  SYSTEM_FAULT:             'system',
  CIRCUIT_OPEN:             'engine_step',
  QUARANTINE_TRIGGERED:     'engine_step',
});

export function classifyErrorCode(code: string): ErrorCategory {
  return ERROR_BOUNDARY_CODE_REGISTRY[code] ?? 'unknown';
}

export const ALL_ERROR_CATEGORIES: readonly ErrorCategory[] = Object.freeze([
  'engine_step',
  'mode_hook',
  'state_mutation',
  'timeout',
  'invariant',
  'determinism',
  'resource',
  'system',
  'unknown',
]);

/** Per-category severity weights used for ML scoring. */
export const ERROR_CATEGORY_SEVERITY_WEIGHT: Readonly<Record<ErrorCategory, number>> = Object.freeze({
  engine_step:      0.8,
  mode_hook:        0.5,
  state_mutation:   0.9,
  timeout:          0.6,
  invariant:        1.0,
  determinism:      1.0,
  resource:         0.7,
  system:           0.9,
  unknown:          0.4,
});

/** Ordinal index of each category for DL tensor encoding. */
export const ERROR_CATEGORY_ORDINAL: Readonly<Record<ErrorCategory, number>> = Object.freeze({
  engine_step:      0,
  mode_hook:        1,
  state_mutation:   2,
  timeout:          3,
  invariant:        4,
  determinism:      5,
  resource:         6,
  system:           7,
  unknown:          8,
});

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — Error budget tracking
// ─────────────────────────────────────────────────────────────────────────────

export interface ErrorBoundaryBudget {
  /** Total errors permitted before hard-stop. */
  readonly totalBudget: number;
  /** Errors consumed in the current session. */
  readonly consumed: number;
  /** Remaining error budget. */
  readonly remaining: number;
  /** Budget utilization ratio [0–1]. */
  readonly utilizationRatio: number;
  /** Whether the budget is exhausted. */
  readonly exhausted: boolean;
}

export class ErrorBoundaryBudgetTracker {
  private consumed = 0;

  public constructor(private readonly totalBudget: number = 20) {}

  public consume(): void {
    this.consumed = Math.min(this.consumed + 1, this.totalBudget + 1);
  }

  public reset(): void {
    this.consumed = 0;
  }

  public getBudget(): ErrorBoundaryBudget {
    const remaining = Math.max(0, this.totalBudget - this.consumed);
    return {
      totalBudget: this.totalBudget,
      consumed: this.consumed,
      remaining,
      utilizationRatio: clamp01(this.consumed / Math.max(1, this.totalBudget)),
      exhausted: this.consumed >= this.totalBudget,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — ML 32-dim feature vector extraction
// ─────────────────────────────────────────────────────────────────────────────

export const ERROR_BOUNDARY_ML_FEATURE_COUNT = 32 as const;

export const ERROR_BOUNDARY_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  /* 0  */ 'consecutive_failures_norm',
  /* 1  */ 'max_failures_utilized_ratio',
  /* 2  */ 'is_fatal',
  /* 3  */ 'is_recoverable',
  /* 4  */ 'severity_warn',
  /* 5  */ 'severity_error',
  /* 6  */ 'category_engine_step',
  /* 7  */ 'category_mode_hook',
  /* 8  */ 'category_state_mutation',
  /* 9  */ 'category_timeout',
  /* 10 */ 'category_invariant',
  /* 11 */ 'category_determinism',
  /* 12 */ 'category_resource',
  /* 13 */ 'category_system',
  /* 14 */ 'category_unknown',
  /* 15 */ 'owner_time',
  /* 16 */ 'owner_pressure',
  /* 17 */ 'owner_tension',
  /* 18 */ 'owner_shield',
  /* 19 */ 'owner_battle',
  /* 20 */ 'owner_cascade',
  /* 21 */ 'owner_sovereignty',
  /* 22 */ 'owner_mode',
  /* 23 */ 'owner_system',
  /* 24 */ 'tick_norm',
  /* 25 */ 'has_stack_trace',
  /* 26 */ 'budget_utilization_ratio',
  /* 27 */ 'circuit_breaker_open',
  /* 28 */ 'in_quarantine',
  /* 29 */ 'tag_count_norm',
  /* 30 */ 'message_length_norm',
  /* 31 */ 'anomaly_score',
]);

export interface ErrorBoundaryMLVector {
  /** 32 normalized features in canonical label order. */
  readonly features: readonly number[];
  /** Mirrors ERROR_BOUNDARY_ML_FEATURE_LABELS. */
  readonly featureLabels: readonly string[];
  /** Composite anomaly score [0–1] derived from weighted feature sum. */
  readonly anomalyScore: number;
  /** Whether the anomaly score exceeds the configured threshold. */
  readonly isAnomalous: boolean;
  /** ISO-8601 extraction timestamp. */
  readonly extractedAt: string;
  /** Tick at extraction. */
  readonly tick: number;
  /** Owner at extraction. */
  readonly owner: ErrorBoundaryOwner;
}

export function extractErrorBoundaryMLVector(
  record: ErrorBoundaryRecord,
  maxConsecutive: number,
  budgetUtilization: number,
  circuitBreakerOpen: boolean,
  inQuarantine: boolean,
  anomalyThreshold: number,
): ErrorBoundaryMLVector {
  const catOrd = ERROR_CATEGORY_ORDINAL[record.category] ?? 8;
  const ownerIndex = ownerOrdinal(record.owner);
  const tagCountNorm = clamp01((record.tags.length) / 10);
  const msgLenNorm   = clamp01(record.message.length / 512);
  const tickNorm     = clamp01(record.tick / 1000);
  const consNorm     = clamp01(record.consecutiveFailures / Math.max(1, maxConsecutive));
  const maxRatio     = clamp01(record.consecutiveFailures / Math.max(1, maxConsecutive));

  const features: number[] = new Array<number>(ERROR_BOUNDARY_ML_FEATURE_COUNT).fill(0);
  features[0]  = consNorm;
  features[1]  = maxRatio;
  features[2]  = record.fatal ? 1 : 0;
  features[3]  = record.fatal ? 0 : 1;
  features[4]  = record.severity === 'WARN' ? 1 : 0;
  features[5]  = record.severity === 'ERROR' ? 1 : 0;
  // category one-hot (indices 6–14 = categories 0–8)
  if (catOrd >= 0 && catOrd <= 8) {
    features[6 + catOrd] = 1;
  }
  // owner one-hot (indices 15–23 = owners 0–8)
  if (ownerIndex >= 0 && ownerIndex <= 8) {
    features[15 + ownerIndex] = 1;
  }
  features[24] = tickNorm;
  features[25] = record.stack !== undefined ? 1 : 0;
  features[26] = clamp01(budgetUtilization);
  features[27] = circuitBreakerOpen ? 1 : 0;
  features[28] = inQuarantine ? 1 : 0;
  features[29] = tagCountNorm;
  features[30] = msgLenNorm;

  // Anomaly score: weighted sum of key risk features
  const categoryWeight = ERROR_CATEGORY_SEVERITY_WEIGHT[record.category] ?? 0.4;
  const anomalyScore = clamp01(
    0.25 * features[2] +        // is_fatal
    0.20 * categoryWeight +      // category risk
    0.15 * features[5] +         // severity_error
    0.15 * maxRatio +            // failure concentration
    0.10 * features[27] +        // circuit open
    0.10 * features[28] +        // quarantine
    0.05 * features[26],         // budget stress
  );
  features[31] = anomalyScore;

  return {
    features: Object.freeze(features),
    featureLabels: ERROR_BOUNDARY_ML_FEATURE_LABELS,
    anomalyScore,
    isAnomalous: anomalyScore >= anomalyThreshold,
    extractedAt: isoNow(),
    tick: record.tick,
    owner: record.owner,
  };
}

function ownerOrdinal(owner: ErrorBoundaryOwner): number {
  switch (owner) {
    case 'time':         return 0;
    case 'pressure':     return 1;
    case 'tension':      return 2;
    case 'shield':       return 3;
    case 'battle':       return 4;
    case 'cascade':      return 5;
    case 'sovereignty':  return 6;
    case 'mode':         return 7;
    case 'system':       return 8;
    default:             return 8;
  }
}

export function getErrorBoundaryMLFeatureLabel(index: number): string {
  return ERROR_BOUNDARY_ML_FEATURE_LABELS[index] ?? `feature_${index}`;
}

export function getErrorBoundaryMLFeatureIndex(label: string): number {
  const idx = ERROR_BOUNDARY_ML_FEATURE_LABELS.indexOf(label);
  return idx >= 0 ? idx : -1;
}

export function isErrorBoundaryMLFeatureAnomalous(
  vector: ErrorBoundaryMLVector,
  featureLabel: string,
  threshold = 0.5,
): boolean {
  const idx = getErrorBoundaryMLFeatureIndex(featureLabel);
  if (idx < 0) return false;
  return (vector.features[idx] ?? 0) >= threshold;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — DL 40×6 tensor construction
// ─────────────────────────────────────────────────────────────────────────────

export const ERROR_BOUNDARY_DL_ROWS    = 40 as const;
export const ERROR_BOUNDARY_DL_COLS    = 6  as const;
export const ERROR_BOUNDARY_DL_FEATURE_COUNT = ERROR_BOUNDARY_DL_ROWS * ERROR_BOUNDARY_DL_COLS;

export interface ErrorBoundaryDLTensor {
  /** Flat row-major array of length ROWS×COLS. */
  readonly flat: readonly number[];
  /** Number of rows. */
  readonly rows: number;
  /** Number of columns. */
  readonly cols: number;
  /** Maximum absolute value (for normalization diagnostics). */
  readonly maxAbsValue: number;
  /** ISO-8601 construction timestamp. */
  readonly constructedAt: string;
  /** Tick at construction. */
  readonly tick: number;
}

/**
 * Builds a 40×6 DL input tensor from a history of ErrorBoundaryRecord entries.
 *
 * Each row encodes one historical error record (most recent last, zero-padded
 * if fewer than 40 records exist). Each column encodes:
 *   col 0 — consecutive_failures_norm at time of record
 *   col 1 — is_fatal
 *   col 2 — category_ordinal_norm
 *   col 3 — owner_ordinal_norm
 *   col 4 — severity_norm (WARN=0.5, ERROR=1.0)
 *   col 5 — anomaly_score
 */
export function buildErrorBoundaryDLTensor(
  history: readonly ErrorBoundaryRecord[],
  maxConsecutive: number,
  tick: number,
): ErrorBoundaryDLTensor {
  const flat = new Array<number>(ERROR_BOUNDARY_DL_ROWS * ERROR_BOUNDARY_DL_COLS).fill(0);

  const recent = history.slice(-ERROR_BOUNDARY_DL_ROWS);
  const offset = ERROR_BOUNDARY_DL_ROWS - recent.length;

  for (let i = 0; i < recent.length; i++) {
    const rec = recent[i]!;
    const row = offset + i;
    const base = row * ERROR_BOUNDARY_DL_COLS;
    flat[base + 0] = clamp01(rec.consecutiveFailures / Math.max(1, maxConsecutive));
    flat[base + 1] = rec.fatal ? 1 : 0;
    flat[base + 2] = clamp01((ERROR_CATEGORY_ORDINAL[rec.category] ?? 8) / 8);
    flat[base + 3] = clamp01(ownerOrdinal(rec.owner) / 8);
    flat[base + 4] = rec.severity === 'ERROR' ? 1.0 : 0.5;
    flat[base + 5] = clamp01(rec.mlAnomalyScore);
  }

  const maxAbsValue = Math.max(...flat.map(Math.abs), 0);
  return {
    flat: Object.freeze(flat),
    rows: ERROR_BOUNDARY_DL_ROWS,
    cols: ERROR_BOUNDARY_DL_COLS,
    maxAbsValue,
    constructedAt: isoNow(),
    tick,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — Chat signal construction
// ─────────────────────────────────────────────────────────────────────────────

export type ErrorBoundarySignalKind =
  | 'STEP_ERROR'
  | 'STEP_FATAL'
  | 'CIRCUIT_OPEN'
  | 'QUARANTINE_TRIGGERED'
  | 'BUDGET_EXHAUSTED'
  | 'RECOVERY_DETECTED';

export type ErrorBoundarySignalSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export interface ErrorBoundaryChatSignal {
  readonly surface: 'error_boundary';
  readonly kind: ErrorBoundarySignalKind;
  readonly owner: ErrorBoundaryOwner;
  readonly step: TickStep;
  readonly tick: number;
  readonly code: string;
  readonly message: string;
  readonly fatal: boolean;
  readonly consecutiveFailures: number;
  readonly maxConsecutiveFailures: number;
  readonly category: ErrorCategory;
  readonly mlAnomalyScore: number;
  readonly isAnomalous: boolean;
  readonly budgetUtilization: number;
  readonly circuitBreakerOpen: boolean;
  readonly tags: readonly string[];
  readonly severity: ErrorBoundarySignalSeverity;
  readonly emittedAt: string;
}

export function buildErrorBoundaryChatSignal(
  record: ErrorBoundaryRecord,
  maxConsecutive: number,
  budgetUtilization: number,
  circuitBreakerOpen: boolean,
  anomalyThreshold: number,
): ErrorBoundaryChatSignal {
  const isAnomalous = record.mlAnomalyScore >= anomalyThreshold;
  const kind: ErrorBoundarySignalKind = record.fatal ? 'STEP_FATAL' : 'STEP_ERROR';
  const severity: ErrorBoundarySignalSeverity =
    record.fatal || circuitBreakerOpen ? 'CRITICAL' :
    record.severity === 'ERROR' ? 'WARN' :
    'INFO';

  return {
    surface: 'error_boundary',
    kind,
    owner: record.owner,
    step: record.step,
    tick: record.tick,
    code: record.code,
    message: record.message,
    fatal: record.fatal,
    consecutiveFailures: record.consecutiveFailures,
    maxConsecutiveFailures: maxConsecutive,
    category: record.category,
    mlAnomalyScore: record.mlAnomalyScore,
    isAnomalous,
    budgetUtilization,
    circuitBreakerOpen,
    tags: record.tags,
    severity,
    emittedAt: isoNow(),
  };
}

export function buildErrorBoundaryRecoverySignal(
  owner: ErrorBoundaryOwner,
  step: TickStep,
  tick: number,
  priorConsecutiveFailures: number,
): ErrorBoundaryChatSignal {
  return {
    surface: 'error_boundary',
    kind: 'RECOVERY_DETECTED',
    owner,
    step,
    tick,
    code: 'ENGINE_STEP_RECOVERED',
    message: `[${step}] Owner '${owner}' recovered after ${priorConsecutiveFailures} consecutive failures.`,
    fatal: false,
    consecutiveFailures: 0,
    maxConsecutiveFailures: 0,
    category: 'engine_step',
    mlAnomalyScore: 0,
    isAnomalous: false,
    budgetUtilization: 0,
    circuitBreakerOpen: false,
    tags: freezeArray(['engine-zero', 'error-boundary', 'recovery', `owner:${owner}`, `step:${step.toLowerCase()}`]),
    severity: 'INFO',
    emittedAt: isoNow(),
  };
}

export function buildErrorBoundaryBudgetExhaustedSignal(
  owner: ErrorBoundaryOwner,
  step: TickStep,
  tick: number,
  budget: ErrorBoundaryBudget,
): ErrorBoundaryChatSignal {
  return {
    surface: 'error_boundary',
    kind: 'BUDGET_EXHAUSTED',
    owner,
    step,
    tick,
    code: 'ENGINE_ERROR_BUDGET_EXHAUSTED',
    message: `[${step}] Error budget exhausted for '${owner}' (${budget.consumed}/${budget.totalBudget}).`,
    fatal: true,
    consecutiveFailures: budget.consumed,
    maxConsecutiveFailures: budget.totalBudget,
    category: 'system',
    mlAnomalyScore: 1.0,
    isAnomalous: true,
    budgetUtilization: budget.utilizationRatio,
    circuitBreakerOpen: true,
    tags: freezeArray(['engine-zero', 'error-boundary', 'budget-exhausted', `owner:${owner}`]),
    severity: 'CRITICAL',
    emittedAt: isoNow(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — Telemetry snapshot
// ─────────────────────────────────────────────────────────────────────────────

export interface ErrorBoundaryTelemetrySnapshot {
  readonly owner: ErrorBoundaryOwner;
  readonly tick: number;
  readonly consecutiveFailures: number;
  readonly totalSessionErrors: number;
  readonly fatalCount: number;
  readonly recoverableCount: number;
  readonly budgetUtilization: number;
  readonly budgetExhausted: boolean;
  readonly circuitBreakerOpen: boolean;
  readonly inQuarantine: boolean;
  readonly mlVector: ErrorBoundaryMLVector | null;
  readonly dlTensor: ErrorBoundaryDLTensor | null;
  readonly chatSignal: ErrorBoundaryChatSignal | null;
  readonly topCategory: ErrorCategory | null;
  readonly topCode: string | null;
  readonly notes: readonly string[];
  readonly emittedAt: string;
}

export function buildErrorBoundaryTelemetrySnapshot(
  owner: ErrorBoundaryOwner,
  tick: number,
  consecutiveFailures: number,
  sessionErrors: readonly ErrorBoundaryRecord[],
  budget: ErrorBoundaryBudget,
  circuitBreakerOpen: boolean,
  inQuarantine: boolean,
  mlVector: ErrorBoundaryMLVector | null,
  dlTensor: ErrorBoundaryDLTensor | null,
  latestSignal: ErrorBoundaryChatSignal | null,
): ErrorBoundaryTelemetrySnapshot {
  const fatalCount = sessionErrors.filter(r => r.fatal).length;
  const recoverableCount = sessionErrors.length - fatalCount;

  const categoryCount = new Map<ErrorCategory, number>();
  for (const rec of sessionErrors) {
    categoryCount.set(rec.category, (categoryCount.get(rec.category) ?? 0) + 1);
  }
  let topCategory: ErrorCategory | null = null;
  let topCategoryCount = 0;
  for (const [cat, count] of categoryCount.entries()) {
    if (count > topCategoryCount) {
      topCategoryCount = count;
      topCategory = cat;
    }
  }

  const codeCount = new Map<string, number>();
  for (const rec of sessionErrors) {
    codeCount.set(rec.code, (codeCount.get(rec.code) ?? 0) + 1);
  }
  let topCode: string | null = null;
  let topCodeCount = 0;
  for (const [code, count] of codeCount.entries()) {
    if (count > topCodeCount) {
      topCodeCount = count;
      topCode = code;
    }
  }

  const notes: string[] = [];
  if (budget.exhausted) notes.push('Error budget exhausted — boundary forcing abort.');
  if (circuitBreakerOpen) notes.push('Circuit breaker open — step execution blocked.');
  if (inQuarantine) notes.push('Owner in quarantine — recovery wait active.');
  if (consecutiveFailures >= 3) notes.push(`High consecutive failure count: ${consecutiveFailures}.`);
  if (mlVector?.isAnomalous) notes.push(`ML anomaly detected (score=${mlVector.anomalyScore.toFixed(3)}).`);

  return {
    owner,
    tick,
    consecutiveFailures,
    totalSessionErrors: sessionErrors.length,
    fatalCount,
    recoverableCount,
    budgetUtilization: budget.utilizationRatio,
    budgetExhausted: budget.exhausted,
    circuitBreakerOpen,
    inQuarantine,
    mlVector,
    dlTensor,
    chatSignal: latestSignal,
    topCategory,
    topCode,
    notes: freezeArray(notes),
    emittedAt: isoNow(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — Narrative generation
// ─────────────────────────────────────────────────────────────────────────────

export interface ErrorBoundaryNarrative {
  readonly headline: string;
  readonly detail: string;
  readonly uxHint: string;
  readonly recoveryAdvice: string;
  readonly severity: ErrorBoundarySignalSeverity;
  readonly generatedAt: string;
}

export function generateErrorBoundaryNarrative(
  record: ErrorBoundaryRecord,
  maxConsecutive: number,
  circuitBreakerOpen: boolean,
): ErrorBoundaryNarrative {
  const ownerLabel = record.owner.toUpperCase();
  const stepLabel  = record.step;

  let headline: string;
  let detail: string;
  let uxHint: string;
  let recoveryAdvice: string;
  let severity: ErrorBoundarySignalSeverity;

  if (record.fatal) {
    headline = `${ownerLabel} engine fatal at ${stepLabel}`;
    detail   = `Engine 0 caught a fatal fault from '${record.owner}' during ${stepLabel}. ` +
               `Code: ${record.code}. Message: ${record.message}`;
    uxHint   = 'The run encountered a critical engine fault. Your progress is safe — the system is recovering.';
    recoveryAdvice = 'Circuit breaker will engage. Future ticks will skip this step until the boundary resets.';
    severity = 'CRITICAL';
  } else if (circuitBreakerOpen) {
    headline = `${ownerLabel} circuit open — step blocked`;
    detail   = `The circuit breaker for '${record.owner}' at ${stepLabel} is open after ${record.consecutiveFailures}/${maxConsecutive} consecutive failures.`;
    uxHint   = 'The system is protecting itself from a degraded engine step.';
    recoveryAdvice = 'The circuit breaker will half-open after a cooldown period. No user action needed.';
    severity = 'CRITICAL';
  } else if (record.consecutiveFailures >= Math.ceil(maxConsecutive / 2)) {
    headline = `${ownerLabel} degraded — ${record.consecutiveFailures}/${maxConsecutive} failures`;
    detail   = `'${record.owner}' has accumulated ${record.consecutiveFailures} consecutive failures at ${stepLabel}.`;
    uxHint   = 'The engine is degraded but still running. Your session continues.';
    recoveryAdvice = `${maxConsecutive - record.consecutiveFailures} more failures before circuit opens.`;
    severity = 'WARN';
  } else {
    headline = `${ownerLabel} step error at ${stepLabel}`;
    detail   = `'${record.owner}' encountered a recoverable fault at ${stepLabel}. Code: ${record.code}.`;
    uxHint   = 'A minor engine fault was caught and contained. Your session is unaffected.';
    recoveryAdvice = 'No action needed. The boundary will reset on the next successful tick.';
    severity = 'INFO';
  }

  return {
    headline,
    detail,
    uxHint,
    recoveryAdvice,
    severity,
    generatedAt: isoNow(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 10 — Rate controller
// ─────────────────────────────────────────────────────────────────────────────

export interface ErrorBoundaryRateControllerConfig {
  /** Maximum error records emitted per window. Default: 10. */
  readonly maxPerWindow: number;
  /** Window size in milliseconds. Default: 5000 (5 s). */
  readonly windowMs: number;
}

export const ERROR_BOUNDARY_RATE_CONTROLLER_DEFAULT_CONFIG: Readonly<ErrorBoundaryRateControllerConfig> =
  Object.freeze({
    maxPerWindow: 10,
    windowMs: 5_000,
  });

export interface ErrorBoundaryRateControllerState {
  readonly tokenCount: number;
  readonly windowStart: number;
  readonly totalAllowed: number;
  readonly totalThrottled: number;
}

export class ErrorBoundaryRateController {
  private tokenCount = 0;
  private windowStart = Date.now();
  private totalAllowed = 0;
  private totalThrottled = 0;

  public constructor(
    private readonly config: ErrorBoundaryRateControllerConfig = ERROR_BOUNDARY_RATE_CONTROLLER_DEFAULT_CONFIG,
  ) {}

  public tryConsume(): boolean {
    const nowMs = Date.now();
    if (nowMs - this.windowStart >= this.config.windowMs) {
      this.tokenCount = 0;
      this.windowStart = nowMs;
    }
    if (this.tokenCount < this.config.maxPerWindow) {
      this.tokenCount += 1;
      this.totalAllowed += 1;
      return true;
    }
    this.totalThrottled += 1;
    return false;
  }

  public reset(): void {
    this.tokenCount = 0;
    this.windowStart = Date.now();
  }

  public getState(): ErrorBoundaryRateControllerState {
    return {
      tokenCount: this.tokenCount,
      windowStart: this.windowStart,
      totalAllowed: this.totalAllowed,
      totalThrottled: this.totalThrottled,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 11 — Error histogram
// ─────────────────────────────────────────────────────────────────────────────

export interface ErrorBoundaryHistogramBucket {
  readonly key: string;
  readonly count: number;
  readonly fatalCount: number;
  readonly lastSeenMs: number;
  readonly owners: readonly ErrorBoundaryOwner[];
}

export interface ErrorBoundaryHistogramReport {
  readonly byCode: readonly ErrorBoundaryHistogramBucket[];
  readonly byCategory: readonly ErrorBoundaryHistogramBucket[];
  readonly byOwner: readonly ErrorBoundaryHistogramBucket[];
  readonly byStep: readonly ErrorBoundaryHistogramBucket[];
  readonly totalErrors: number;
  readonly totalFatal: number;
  readonly snapshotAt: string;
}

export class ErrorBoundaryHistogram {
  private readonly codeMap    = new Map<string, ErrorBoundaryHistogramBucket>();
  private readonly categoryMap = new Map<string, ErrorBoundaryHistogramBucket>();
  private readonly ownerMap   = new Map<string, ErrorBoundaryHistogramBucket>();
  private readonly stepMap    = new Map<string, ErrorBoundaryHistogramBucket>();

  private totalErrors = 0;
  private totalFatal  = 0;

  public record(rec: ErrorBoundaryRecord): void {
    this.totalErrors += 1;
    if (rec.fatal) this.totalFatal += 1;
    this.updateBucket(this.codeMap,     rec.code,          rec);
    this.updateBucket(this.categoryMap, rec.category,      rec);
    this.updateBucket(this.ownerMap,    rec.owner,         rec);
    this.updateBucket(this.stepMap,     rec.step,          rec);
  }

  public reset(): void {
    this.codeMap.clear();
    this.categoryMap.clear();
    this.ownerMap.clear();
    this.stepMap.clear();
    this.totalErrors = 0;
    this.totalFatal  = 0;
  }

  public getReport(): ErrorBoundaryHistogramReport {
    return {
      byCode:      this.sortBuckets(this.codeMap),
      byCategory:  this.sortBuckets(this.categoryMap),
      byOwner:     this.sortBuckets(this.ownerMap),
      byStep:      this.sortBuckets(this.stepMap),
      totalErrors: this.totalErrors,
      totalFatal:  this.totalFatal,
      snapshotAt:  isoNow(),
    };
  }

  private updateBucket(
    map: Map<string, ErrorBoundaryHistogramBucket>,
    key: string,
    rec: ErrorBoundaryRecord,
  ): void {
    const existing = map.get(key);
    const owners = existing
      ? uniqueAppend(existing.owners, rec.owner)
      : freezeArray([rec.owner]);
    map.set(key, {
      key,
      count:       (existing?.count ?? 0) + 1,
      fatalCount:  (existing?.fatalCount ?? 0) + (rec.fatal ? 1 : 0),
      lastSeenMs:  rec.occurredAtMs,
      owners,
    });
  }

  private sortBuckets(
    map: Map<string, ErrorBoundaryHistogramBucket>,
  ): readonly ErrorBoundaryHistogramBucket[] {
    return Object.freeze(
      [...map.values()].sort((a, b) => b.count - a.count),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 12 — Trend analyzer
// ─────────────────────────────────────────────────────────────────────────────

export type ErrorBoundaryTrendDirection = 'IMPROVING' | 'STABLE' | 'DEGRADING' | 'CRITICAL';

export interface ErrorBoundaryTrendSnapshot {
  readonly direction: ErrorBoundaryTrendDirection;
  readonly consecutiveFailuresNow: number;
  readonly consecutiveFailuresPrior: number;
  readonly recentErrorRate: number;
  readonly errorVelocity: number;
  readonly dominantCategory: ErrorCategory | null;
  readonly dominantOwner: ErrorBoundaryOwner | null;
  readonly trendScore: number;
  readonly assessedAt: string;
}

export class ErrorBoundaryTrendAnalyzer {
  private readonly window: ErrorBoundaryRecord[] = [];
  private readonly maxWindow = 32;

  public add(rec: ErrorBoundaryRecord): void {
    this.window.push(rec);
    if (this.window.length > this.maxWindow) {
      this.window.shift();
    }
  }

  public reset(): void {
    this.window.length = 0;
  }

  public snapshot(
    consecutiveFailures: number,
    priorConsecutiveFailures: number,
  ): ErrorBoundaryTrendSnapshot {
    const recent = this.window.slice(-8);
    const prior  = this.window.slice(-16, -8);

    const recentErrorRate = recent.filter(r => !r.ok_marker).length / Math.max(1, recent.length);
    const priorErrorRate  = prior.filter(r => !r.ok_marker).length / Math.max(1, prior.length);
    const errorVelocity   = recentErrorRate - priorErrorRate;

    const catCounts = new Map<ErrorCategory, number>();
    const ownerCounts = new Map<ErrorBoundaryOwner, number>();
    for (const rec of recent) {
      catCounts.set(rec.category, (catCounts.get(rec.category) ?? 0) + 1);
      ownerCounts.set(rec.owner, (ownerCounts.get(rec.owner) ?? 0) + 1);
    }

    const dominantCategory = maxMapKey(catCounts);
    const dominantOwner    = maxMapKey(ownerCounts);

    let direction: ErrorBoundaryTrendDirection;
    const trendScore = clamp01(0.4 * recentErrorRate + 0.3 * clamp01(consecutiveFailures / 5) + 0.3 * Math.max(0, errorVelocity));

    if (consecutiveFailures === 0 && priorConsecutiveFailures > 0) {
      direction = 'IMPROVING';
    } else if (trendScore >= 0.8 || consecutiveFailures >= 4) {
      direction = 'CRITICAL';
    } else if (errorVelocity > 0.1 || consecutiveFailures >= 2) {
      direction = 'DEGRADING';
    } else {
      direction = 'STABLE';
    }

    return {
      direction,
      consecutiveFailuresNow:   consecutiveFailures,
      consecutiveFailuresPrior: priorConsecutiveFailures,
      recentErrorRate,
      errorVelocity,
      dominantCategory:  dominantCategory as ErrorCategory | null,
      dominantOwner:     dominantOwner    as ErrorBoundaryOwner | null,
      trendScore,
      assessedAt: isoNow(),
    };
  }
}

function maxMapKey<K>(map: Map<K, number>): K | null {
  let maxKey: K | null = null;
  let maxVal = -1;
  for (const [k, v] of map.entries()) {
    if (v > maxVal) {
      maxVal = v;
      maxKey = k;
    }
  }
  return maxKey;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 13 — Recovery forecaster
// ─────────────────────────────────────────────────────────────────────────────

export interface ErrorBoundaryRecoveryForecast {
  /** Estimated probability of recovery within the next tick [0–1]. */
  readonly recoveryProbabilityNextTick: number;
  /** Estimated probability of recovery within 5 ticks [0–1]. */
  readonly recoveryProbability5Ticks: number;
  /** Whether immediate recovery is expected. */
  readonly immediateRecoveryExpected: boolean;
  /** Recommended action for the orchestrator. */
  readonly recommendation: 'CONTINUE' | 'WARN' | 'HALF_OPEN' | 'ABORT';
  /** Confidence in the forecast [0–1]. */
  readonly confidence: number;
  /** ISO-8601 forecast timestamp. */
  readonly forecastAt: string;
}

export class ErrorBoundaryRecoveryForecaster {
  private priorSuccessStreak = 0;
  private priorFailureStreak = 0;

  public recordSuccess(): void {
    this.priorSuccessStreak += 1;
    this.priorFailureStreak = 0;
  }

  public recordFailure(): void {
    this.priorFailureStreak += 1;
    this.priorSuccessStreak = 0;
  }

  public reset(): void {
    this.priorSuccessStreak = 0;
    this.priorFailureStreak = 0;
  }

  public forecast(
    consecutiveFailures: number,
    maxConsecutive: number,
    circuitBreakerOpen: boolean,
  ): ErrorBoundaryRecoveryForecast {
    // Base probability driven by consecutive failures
    const failurePressure = clamp01(consecutiveFailures / Math.max(1, maxConsecutive));
    const successBonus    = clamp01(this.priorSuccessStreak / 10);

    const recoveryProbabilityNextTick = circuitBreakerOpen
      ? 0.05
      : clamp01((1 - failurePressure) * 0.7 + successBonus * 0.3);

    const recoveryProbability5Ticks = circuitBreakerOpen
      ? clamp01(0.05 + 5 * 0.10)
      : clamp01(1 - Math.pow(1 - recoveryProbabilityNextTick, 5));

    const immediateRecoveryExpected = recoveryProbabilityNextTick >= 0.7;

    let recommendation: ErrorBoundaryRecoveryForecast['recommendation'];
    if (circuitBreakerOpen) {
      recommendation = 'HALF_OPEN';
    } else if (consecutiveFailures >= maxConsecutive) {
      recommendation = 'ABORT';
    } else if (consecutiveFailures >= Math.ceil(maxConsecutive * 0.6)) {
      recommendation = 'WARN';
    } else {
      recommendation = 'CONTINUE';
    }

    const confidence = clamp01(0.5 + 0.3 * successBonus - 0.2 * failurePressure);

    return {
      recoveryProbabilityNextTick,
      recoveryProbability5Ticks,
      immediateRecoveryExpected,
      recommendation,
      confidence,
      forecastAt: isoNow(),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 14 — Session analytics
// ─────────────────────────────────────────────────────────────────────────────

export interface ErrorBoundarySessionReport {
  readonly owner: ErrorBoundaryOwner;
  readonly totalErrors: number;
  readonly totalFatal: number;
  readonly totalRecoverable: number;
  readonly maxConsecutiveFailuresReached: number;
  readonly circuitBreakerOpenCount: number;
  readonly quarantineCount: number;
  readonly categoryBreakdown: Readonly<Record<ErrorCategory, number>>;
  readonly stepBreakdown: Readonly<Partial<Record<TickStep, number>>>;
  readonly budgetUtilizationPeak: number;
  readonly errorRatePeak: number;
  readonly mlAnomalyCount: number;
  readonly sessionStartMs: number;
  readonly sessionDurationMs: number;
  readonly reportAt: string;
}

export class ErrorBoundarySessionAnalytics {
  private readonly sessionStartMs = Date.now();
  private totalErrors = 0;
  private totalFatal  = 0;
  private maxConsecutiveReached = 0;
  private circuitBreakerOpenCount = 0;
  private quarantineCount = 0;
  private budgetUtilizationPeak = 0;
  private errorRatePeak = 0;
  private mlAnomalyCount = 0;

  private readonly categoryBreakdown = new Map<ErrorCategory, number>();
  private readonly stepBreakdown     = new Map<TickStep, number>();

  public constructor(private readonly owner: ErrorBoundaryOwner) {}

  public recordError(
    rec: ErrorBoundaryRecord,
    budgetUtilization: number,
    circuitBreakerJustOpened: boolean,
    justQuarantined: boolean,
  ): void {
    this.totalErrors += 1;
    if (rec.fatal) this.totalFatal += 1;
    if (rec.consecutiveFailures > this.maxConsecutiveReached) {
      this.maxConsecutiveReached = rec.consecutiveFailures;
    }
    if (circuitBreakerJustOpened) this.circuitBreakerOpenCount += 1;
    if (justQuarantined)          this.quarantineCount += 1;
    if (budgetUtilization > this.budgetUtilizationPeak) {
      this.budgetUtilizationPeak = budgetUtilization;
    }
    if (rec.mlAnomalyScore >= 0.55) this.mlAnomalyCount += 1;

    this.categoryBreakdown.set(
      rec.category,
      (this.categoryBreakdown.get(rec.category) ?? 0) + 1,
    );
    this.stepBreakdown.set(
      rec.step,
      (this.stepBreakdown.get(rec.step) ?? 0) + 1,
    );
  }

  public recordErrorRateSample(errorRate: number): void {
    if (errorRate > this.errorRatePeak) this.errorRatePeak = errorRate;
  }

  public reset(): void {
    this.totalErrors = 0;
    this.totalFatal  = 0;
    this.maxConsecutiveReached = 0;
    this.circuitBreakerOpenCount = 0;
    this.quarantineCount = 0;
    this.budgetUtilizationPeak = 0;
    this.errorRatePeak = 0;
    this.mlAnomalyCount = 0;
    this.categoryBreakdown.clear();
    this.stepBreakdown.clear();
  }

  public getReport(): ErrorBoundarySessionReport {
    const catBreakdown: Record<string, number> = {};
    for (const cat of ALL_ERROR_CATEGORIES) {
      catBreakdown[cat] = this.categoryBreakdown.get(cat) ?? 0;
    }
    const stepBreakdown: Partial<Record<TickStep, number>> = {};
    for (const [step, count] of this.stepBreakdown.entries()) {
      stepBreakdown[step] = count;
    }
    return {
      owner: this.owner,
      totalErrors: this.totalErrors,
      totalFatal: this.totalFatal,
      totalRecoverable: this.totalErrors - this.totalFatal,
      maxConsecutiveFailuresReached: this.maxConsecutiveReached,
      circuitBreakerOpenCount: this.circuitBreakerOpenCount,
      quarantineCount: this.quarantineCount,
      categoryBreakdown: catBreakdown as Readonly<Record<ErrorCategory, number>>,
      stepBreakdown: stepBreakdown as Readonly<Partial<Record<TickStep, number>>>,
      budgetUtilizationPeak: this.budgetUtilizationPeak,
      errorRatePeak: this.errorRatePeak,
      mlAnomalyCount: this.mlAnomalyCount,
      sessionStartMs: this.sessionStartMs,
      sessionDurationMs: Date.now() - this.sessionStartMs,
      reportAt: isoNow(),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 15 — Annotation bundle
// ─────────────────────────────────────────────────────────────────────────────

export interface ErrorBoundaryAnnotationBundle {
  /** Owner that produced the error. */
  readonly owner: ErrorBoundaryOwner;
  /** Step where the fault occurred. */
  readonly step: TickStep;
  /** Tick index at fault time. */
  readonly tick: number;
  /** The canonical error code. */
  readonly code: string;
  /** Error message. */
  readonly message: string;
  /** Whether the fault was fatal. */
  readonly fatal: boolean;
  /** Category classification. */
  readonly category: ErrorCategory;
  /** All tags attached to the record. */
  readonly tags: readonly string[];
  /** The engine signal derived from the record. */
  readonly signal: EngineSignal;
  /** ML vector at time of fault. */
  readonly mlVector: ErrorBoundaryMLVector | null;
  /** Narrative describing the fault for UX. */
  readonly narrative: ErrorBoundaryNarrative | null;
  /** Chat signal for backend-chat ingestion. */
  readonly chatSignal: ErrorBoundaryChatSignal | null;
  /** Recovery forecast at time of fault. */
  readonly forecast: ErrorBoundaryRecoveryForecast | null;
  /** ISO-8601 bundle construction timestamp. */
  readonly bundledAt: string;
}

export function buildErrorBoundaryAnnotationBundle(
  record: ErrorBoundaryRecord,
  signal: EngineSignal,
  mlVector: ErrorBoundaryMLVector | null,
  narrative: ErrorBoundaryNarrative | null,
  chatSignal: ErrorBoundaryChatSignal | null,
  forecast: ErrorBoundaryRecoveryForecast | null,
): ErrorBoundaryAnnotationBundle {
  return {
    owner: record.owner,
    step: record.step,
    tick: record.tick,
    code: record.code,
    message: record.message,
    fatal: record.fatal,
    category: record.category,
    tags: record.tags,
    signal,
    mlVector,
    narrative,
    chatSignal,
    forecast,
    bundledAt: isoNow(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 16 — Circuit breaker
// ─────────────────────────────────────────────────────────────────────────────

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerStatus {
  readonly state: CircuitBreakerState;
  readonly failureCount: number;
  readonly successCount: number;
  readonly openedAt: number | null;
  readonly halfOpenAt: number | null;
  readonly lastTransitionAt: number;
  readonly cooldownRemainingMs: number;
}

export class ErrorBoundaryCircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private openedAt: number | null = null;
  private halfOpenAt: number | null = null;
  private lastTransitionAt = Date.now();

  public constructor(
    private readonly failureThreshold: number = 5,
    private readonly cooldownMs: number = 10_000,
    private readonly halfOpenSuccessThreshold: number = 2,
  ) {}

  public recordFailure(): boolean {
    if (this.state === 'OPEN') return true;
    if (this.state === 'HALF_OPEN') {
      this.transitionTo('OPEN');
      return true;
    }
    this.failureCount += 1;
    if (this.failureCount >= this.failureThreshold) {
      this.transitionTo('OPEN');
      return true;
    }
    return false;
  }

  public recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount += 1;
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        this.transitionTo('CLOSED');
      }
    } else if (this.state === 'CLOSED') {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  public isOpen(): boolean {
    this.maybeTransitionToHalfOpen();
    return this.state === 'OPEN';
  }

  public isHalfOpen(): boolean {
    this.maybeTransitionToHalfOpen();
    return this.state === 'HALF_OPEN';
  }

  public getState(): CircuitBreakerState {
    this.maybeTransitionToHalfOpen();
    return this.state;
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.openedAt = null;
    this.halfOpenAt = null;
    this.lastTransitionAt = Date.now();
  }

  public getStatus(): CircuitBreakerStatus {
    this.maybeTransitionToHalfOpen();
    const nowMs = Date.now();
    const cooldownRemainingMs =
      this.state === 'OPEN' && this.openedAt !== null
        ? Math.max(0, this.cooldownMs - (nowMs - this.openedAt))
        : 0;
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      openedAt: this.openedAt,
      halfOpenAt: this.halfOpenAt,
      lastTransitionAt: this.lastTransitionAt,
      cooldownRemainingMs,
    };
  }

  private transitionTo(next: CircuitBreakerState): void {
    const nowMs = Date.now();
    this.state = next;
    this.lastTransitionAt = nowMs;
    if (next === 'OPEN') {
      this.openedAt = nowMs;
      this.successCount = 0;
    } else if (next === 'HALF_OPEN') {
      this.halfOpenAt = nowMs;
      this.successCount = 0;
    } else {
      this.failureCount = 0;
      this.successCount = 0;
    }
  }

  private maybeTransitionToHalfOpen(): void {
    if (
      this.state === 'OPEN' &&
      this.openedAt !== null &&
      Date.now() - this.openedAt >= this.cooldownMs
    ) {
      this.transitionTo('HALF_OPEN');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 17 — Quarantine manager
// ─────────────────────────────────────────────────────────────────────────────

export interface ErrorBoundaryQuarantineEntry {
  readonly owner: ErrorBoundaryOwner;
  readonly step: TickStep;
  readonly code: string;
  readonly quarantinedAt: number;
  readonly reason: string;
  readonly releaseAfterMs: number;
}

export class ErrorBoundaryQuarantineManager {
  private readonly entries = new Map<string, ErrorBoundaryQuarantineEntry>();

  public quarantine(
    owner: ErrorBoundaryOwner,
    step: TickStep,
    code: string,
    reason: string,
    releaseAfterMs = 30_000,
  ): void {
    const key = `${owner}:${step}`;
    this.entries.set(key, {
      owner,
      step,
      code,
      quarantinedAt: Date.now(),
      reason,
      releaseAfterMs,
    });
  }

  public isQuarantined(owner: ErrorBoundaryOwner, step: TickStep): boolean {
    const key = `${owner}:${step}`;
    const entry = this.entries.get(key);
    if (entry === undefined) return false;
    if (Date.now() - entry.quarantinedAt >= entry.releaseAfterMs) {
      this.entries.delete(key);
      return false;
    }
    return true;
  }

  public release(owner: ErrorBoundaryOwner, step: TickStep): void {
    this.entries.delete(`${owner}:${step}`);
  }

  public releaseAll(): void {
    this.entries.clear();
  }

  public getActiveEntries(): readonly ErrorBoundaryQuarantineEntry[] {
    const nowMs = Date.now();
    const active: ErrorBoundaryQuarantineEntry[] = [];
    for (const [key, entry] of this.entries.entries()) {
      if (nowMs - entry.quarantinedAt < entry.releaseAfterMs) {
        active.push(entry);
      } else {
        this.entries.delete(key);
      }
    }
    return Object.freeze(active);
  }

  public getEntryCount(): number {
    return this.entries.size;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 18 — ErrorBoundary class (core + all ML/DL/chat surfaces)
// ─────────────────────────────────────────────────────────────────────────────

export class ErrorBoundary {
  // ── Core state ──────────────────────────────────────────────────────────────
  private readonly options: Required<ErrorBoundaryOptions>;
  private consecutiveFailures = 0;
  private priorConsecutiveFailures = 0;
  private lastError: ErrorBoundaryRecord | null = null;

  // ── Error history (bounded ring) ────────────────────────────────────────────
  private readonly history: ErrorBoundaryRecord[] = [];
  private readonly maxHistorySize = 128;

  // ── Sub-systems ─────────────────────────────────────────────────────────────
  private readonly budgetTracker: ErrorBoundaryBudgetTracker;
  private readonly rateController: ErrorBoundaryRateController;
  private readonly histogram: ErrorBoundaryHistogram;
  private readonly trendAnalyzer: ErrorBoundaryTrendAnalyzer;
  private readonly recoveryForecaster: ErrorBoundaryRecoveryForecaster;
  private readonly sessionAnalytics: ErrorBoundarySessionAnalytics;
  private readonly circuitBreaker: ErrorBoundaryCircuitBreaker;
  private readonly quarantineManager: ErrorBoundaryQuarantineManager;

  // ── Chat / ML state ─────────────────────────────────────────────────────────
  private lastMLVector: ErrorBoundaryMLVector | null = null;
  private lastDLTensor: ErrorBoundaryDLTensor | null = null;
  private lastChatSignal: ErrorBoundaryChatSignal | null = null;
  private lastTelemetry: ErrorBoundaryTelemetrySnapshot | null = null;
  private lastNarrative: ErrorBoundaryNarrative | null = null;

  public constructor(
    options: ErrorBoundaryOptions = {},
    private readonly owner: ErrorBoundaryOwner = 'system',
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.budgetTracker    = new ErrorBoundaryBudgetTracker(this.options.maxConsecutiveFailures * 4);
    this.rateController   = new ErrorBoundaryRateController();
    this.histogram        = new ErrorBoundaryHistogram();
    this.trendAnalyzer    = new ErrorBoundaryTrendAnalyzer();
    this.recoveryForecaster = new ErrorBoundaryRecoveryForecaster();
    this.sessionAnalytics = new ErrorBoundarySessionAnalytics(owner);
    this.circuitBreaker   = new ErrorBoundaryCircuitBreaker(
      this.options.maxConsecutiveFailures,
      10_000,
      2,
    );
    this.quarantineManager = new ErrorBoundaryQuarantineManager();
  }

  // ── Public API: reset ───────────────────────────────────────────────────────

  public reset(): void {
    this.priorConsecutiveFailures = this.consecutiveFailures;
    this.consecutiveFailures = 0;
    this.lastError = null;
    this.recoveryForecaster.recordSuccess();
    this.circuitBreaker.recordSuccess();
  }

  // ── Public API: introspection ───────────────────────────────────────────────

  public getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  public getLastError(): ErrorBoundaryRecord | null {
    return this.lastError;
  }

  public getHistory(): readonly ErrorBoundaryRecord[] {
    return Object.freeze([...this.history]);
  }

  public getCircuitBreakerStatus(): CircuitBreakerStatus {
    return this.circuitBreaker.getStatus();
  }

  public getActiveQuarantineEntries(): readonly ErrorBoundaryQuarantineEntry[] {
    return this.quarantineManager.getActiveEntries();
  }

  public getBudget(): ErrorBoundaryBudget {
    return this.budgetTracker.getBudget();
  }

  public getRateControllerState(): ErrorBoundaryRateControllerState {
    return this.rateController.getState();
  }

  public getHistogramReport(): ErrorBoundaryHistogramReport {
    return this.histogram.getReport();
  }

  public getSessionReport(): ErrorBoundarySessionReport {
    return this.sessionAnalytics.getReport();
  }

  // ── Public API: ML/DL extraction ────────────────────────────────────────────

  public extractMLVector(tick = 0): ErrorBoundaryMLVector | null {
    if (this.lastError === null) return null;
    const budget = this.budgetTracker.getBudget();
    const circuitOpen = this.circuitBreaker.isOpen();
    const inQuar = this.quarantineManager.isQuarantined(this.lastError.owner, this.lastError.step);
    const vec = extractErrorBoundaryMLVector(
      this.lastError,
      this.options.maxConsecutiveFailures,
      budget.utilizationRatio,
      circuitOpen,
      inQuar,
      this.options.mlAnomalyThreshold,
    );
    this.lastMLVector = vec;
    return vec;
  }

  public buildDLTensor(tick = 0): ErrorBoundaryDLTensor {
    const tensor = buildErrorBoundaryDLTensor(
      this.history,
      this.options.maxConsecutiveFailures,
      tick,
    );
    this.lastDLTensor = tensor;
    return tensor;
  }

  public getLastMLVector(): ErrorBoundaryMLVector | null {
    return this.lastMLVector;
  }

  public getLastDLTensor(): ErrorBoundaryDLTensor | null {
    return this.lastDLTensor;
  }

  // ── Public API: chat signals ─────────────────────────────────────────────────

  public buildChatSignal(): ErrorBoundaryChatSignal | null {
    if (this.lastError === null) return null;
    const budget = this.budgetTracker.getBudget();
    const circuitOpen = this.circuitBreaker.isOpen();
    const sig = buildErrorBoundaryChatSignal(
      this.lastError,
      this.options.maxConsecutiveFailures,
      budget.utilizationRatio,
      circuitOpen,
      this.options.mlAnomalyThreshold,
    );
    this.lastChatSignal = sig;
    return sig;
  }

  public getLastChatSignal(): ErrorBoundaryChatSignal | null {
    return this.lastChatSignal;
  }

  // ── Public API: telemetry ────────────────────────────────────────────────────

  public buildTelemetrySnapshot(tick = 0): ErrorBoundaryTelemetrySnapshot {
    const budget = this.budgetTracker.getBudget();
    const circuitOpen = this.circuitBreaker.isOpen();
    const inQuar = this.lastError
      ? this.quarantineManager.isQuarantined(this.lastError.owner, this.lastError.step)
      : false;

    const mlVector  = this.extractMLVector(tick);
    const dlTensor  = this.buildDLTensor(tick);
    const chatSig   = this.buildChatSignal();

    const snap = buildErrorBoundaryTelemetrySnapshot(
      this.owner,
      tick,
      this.consecutiveFailures,
      this.history,
      budget,
      circuitOpen,
      inQuar,
      mlVector,
      dlTensor,
      chatSig,
    );
    this.lastTelemetry = snap;
    return snap;
  }

  public getLastTelemetry(): ErrorBoundaryTelemetrySnapshot | null {
    return this.lastTelemetry;
  }

  // ── Public API: narrative ────────────────────────────────────────────────────

  public generateNarrative(): ErrorBoundaryNarrative | null {
    if (this.lastError === null) return null;
    const circuitOpen = this.circuitBreaker.isOpen();
    const narrative = generateErrorBoundaryNarrative(
      this.lastError,
      this.options.maxConsecutiveFailures,
      circuitOpen,
    );
    this.lastNarrative = narrative;
    return narrative;
  }

  public getLastNarrative(): ErrorBoundaryNarrative | null {
    return this.lastNarrative;
  }

  // ── Public API: trend + recovery ─────────────────────────────────────────────

  public getTrend(): ErrorBoundaryTrendSnapshot {
    return this.trendAnalyzer.snapshot(
      this.consecutiveFailures,
      this.priorConsecutiveFailures,
    );
  }

  public getRecoveryForecast(): ErrorBoundaryRecoveryForecast {
    return this.recoveryForecaster.forecast(
      this.consecutiveFailures,
      this.options.maxConsecutiveFailures,
      this.circuitBreaker.isOpen(),
    );
  }

  // ── Public API: annotation bundle ───────────────────────────────────────────

  public buildAnnotationBundle(tick = 0): ErrorBoundaryAnnotationBundle | null {
    if (this.lastError === null) return null;
    const signal = this.toSignal(this.lastError);
    const mlVector = this.extractMLVector(tick);
    const narrative = this.generateNarrative();
    const chatSignal = this.buildChatSignal();
    const forecast = this.getRecoveryForecast();
    return buildErrorBoundaryAnnotationBundle(
      this.lastError,
      signal,
      mlVector,
      narrative,
      chatSignal,
      forecast,
    );
  }

  // ── Public API: quarantine ───────────────────────────────────────────────────

  public quarantine(
    owner: ErrorBoundaryOwner,
    step: TickStep,
    code: string,
    reason: string,
    releaseAfterMs?: number,
  ): void {
    if (!this.options.enableQuarantine) return;
    this.quarantineManager.quarantine(owner, step, code, reason, releaseAfterMs);
  }

  public releaseQuarantine(owner: ErrorBoundaryOwner, step: TickStep): void {
    this.quarantineManager.release(owner, step);
  }

  // ── Public API: snapshot annotation ─────────────────────────────────────────

  public annotateSnapshot(
    snapshot: RunStateSnapshot,
    record: ErrorBoundaryRecord,
  ): RunStateSnapshot {
    if (this.options.annotateSnapshot !== true) {
      return snapshot;
    }

    const next = cloneJson(snapshot) as Mutable<RunStateSnapshot>;
    const warning = `[${record.step}] ${record.message}`;

    next.telemetry.warnings = [...uniqueAppend(next.telemetry.warnings, warning)];
    next.tags = [...uniqueAppendMany(next.tags, freezeArray([
      'engine-zero:error-boundary',
      `step:${record.step.toLowerCase()}`,
      `owner:${record.owner}`,
    ]))];

    if (record.fatal) {
      next.telemetry.outcomeReason = 'runtime.engine_abort';
      next.telemetry.outcomeReasonCode = 'ENGINE_ABORT';
      next.tags = [...uniqueAppend(next.tags, 'run:engine-abort')];
    }

    return deepFreeze(next) as RunStateSnapshot;
  }

  // ── Public API: capture (sync) ───────────────────────────────────────────────

  public capture<T>(
    meta: ErrorBoundaryCaptureMeta,
    execute: () => T,
    fallback: T,
  ): ErrorBoundaryResult<T> {
    // Circuit breaker guard
    if (this.options.enableCircuitBreaker && this.circuitBreaker.isOpen()) {
      return this.handleCircuitOpen(meta, fallback);
    }

    // Quarantine guard
    if (
      this.options.enableQuarantine &&
      this.quarantineManager.isQuarantined(meta.owner, meta.step)
    ) {
      return this.handleQuarantined(meta, fallback);
    }

    try {
      const value = execute();
      this.priorConsecutiveFailures = this.consecutiveFailures;
      this.consecutiveFailures = 0;
      this.recoveryForecaster.recordSuccess();
      this.circuitBreaker.recordSuccess();
      return {
        ok: true,
        value,
        fatal: false,
        record: null,
        signal: null,
        snapshot: meta.snapshot ?? null,
      };
    } catch (error) {
      return this.handleFailure(meta, error, fallback);
    }
  }

  // ── Public API: capture (async) ──────────────────────────────────────────────

  public async captureAsync<T>(
    meta: ErrorBoundaryCaptureMeta,
    execute: () => Promise<T>,
    fallback: T,
  ): Promise<ErrorBoundaryResult<T>> {
    // Circuit breaker guard
    if (this.options.enableCircuitBreaker && this.circuitBreaker.isOpen()) {
      return this.handleCircuitOpen(meta, fallback);
    }

    // Quarantine guard
    if (
      this.options.enableQuarantine &&
      this.quarantineManager.isQuarantined(meta.owner, meta.step)
    ) {
      return this.handleQuarantined(meta, fallback);
    }

    try {
      const value = await execute();
      this.priorConsecutiveFailures = this.consecutiveFailures;
      this.consecutiveFailures = 0;
      this.recoveryForecaster.recordSuccess();
      this.circuitBreaker.recordSuccess();
      return {
        ok: true,
        value,
        fatal: false,
        record: null,
        signal: null,
        snapshot: meta.snapshot ?? null,
      };
    } catch (error) {
      return this.handleFailure(meta, error, fallback);
    }
  }

  // ── Private: circuit-open short-circuit ──────────────────────────────────────

  private handleCircuitOpen<T>(
    meta: ErrorBoundaryCaptureMeta,
    fallback: T,
  ): ErrorBoundaryResult<T> {
    const record = this.createRecord(
      meta,
      new Error(`Circuit breaker OPEN for owner '${meta.owner}' at step ${meta.step}.`),
      true,
    );
    const overrideRecord: ErrorBoundaryRecord = {
      ...record,
      code: 'CIRCUIT_OPEN',
    };
    const signal = this.toSignal(overrideRecord);
    this.lastError = overrideRecord;
    this.notifySubSystems(overrideRecord, false, false);
    return {
      ok: false,
      value: fallback,
      fatal: true,
      record: overrideRecord,
      signal,
      snapshot:
        meta.snapshot === undefined || meta.snapshot === null
          ? null
          : this.annotateSnapshot(meta.snapshot, overrideRecord),
    };
  }

  // ── Private: quarantine short-circuit ─────────────────────────────────────

  private handleQuarantined<T>(
    meta: ErrorBoundaryCaptureMeta,
    fallback: T,
  ): ErrorBoundaryResult<T> {
    const record = this.createRecord(
      meta,
      new Error(`Owner '${meta.owner}' is quarantined at step ${meta.step}.`),
      false,
    );
    const overrideRecord: ErrorBoundaryRecord = {
      ...record,
      code: 'QUARANTINE_TRIGGERED',
    };
    const signal = this.toSignal(overrideRecord);
    this.lastError = overrideRecord;
    this.notifySubSystems(overrideRecord, false, false);
    return {
      ok: false,
      value: fallback,
      fatal: false,
      record: overrideRecord,
      signal,
      snapshot:
        meta.snapshot === undefined || meta.snapshot === null
          ? null
          : this.annotateSnapshot(meta.snapshot, overrideRecord),
    };
  }

  // ── Private: failure handler ──────────────────────────────────────────────

  private handleFailure<T>(
    meta: ErrorBoundaryCaptureMeta,
    error: unknown,
    fallback: T,
  ): ErrorBoundaryResult<T> {
    this.priorConsecutiveFailures = this.consecutiveFailures;
    this.consecutiveFailures += 1;

    const fatal = this.consecutiveFailures >= this.options.maxConsecutiveFailures;
    const record = this.createRecord(meta, error, fatal);

    // Circuit breaker
    const circuitJustOpened = this.options.enableCircuitBreaker
      ? this.circuitBreaker.recordFailure()
      : false;

    // Budget
    this.budgetTracker.consume();
    const budget = this.budgetTracker.getBudget();

    // Quarantine on fatal
    let justQuarantined = false;
    if (fatal && this.options.enableQuarantine) {
      this.quarantineManager.quarantine(
        meta.owner,
        meta.step,
        record.code,
        `Fatal fault after ${this.consecutiveFailures} consecutive failures.`,
      );
      justQuarantined = true;
    }

    this.lastError = record;
    this.recoveryForecaster.recordFailure();
    this.notifySubSystems(record, circuitJustOpened, justQuarantined);
    this.sessionAnalytics.recordError(
      record,
      budget.utilizationRatio,
      circuitJustOpened,
      justQuarantined,
    );
    this.sessionAnalytics.recordErrorRateSample(
      this.consecutiveFailures / Math.max(1, this.options.maxConsecutiveFailures),
    );

    const signal = this.toSignal(record);

    return {
      ok: false,
      value: fallback,
      fatal,
      record,
      signal,
      snapshot:
        meta.snapshot === undefined || meta.snapshot === null
          ? null
          : this.annotateSnapshot(meta.snapshot, record),
    };
  }

  // ── Private: notify sub-systems ──────────────────────────────────────────────

  private notifySubSystems(
    record: ErrorBoundaryRecord,
    circuitJustOpened: boolean,
    justQuarantined: boolean,
  ): void {
    this.addToHistory(record);
    this.histogram.record(record);
    this.trendAnalyzer.add(record);

    if (this.rateController.tryConsume()) {
      const budget    = this.budgetTracker.getBudget();
      const circuitOpen = this.circuitBreaker.isOpen();
      const inQuar    = this.quarantineManager.isQuarantined(record.owner, record.step);

      const mlVector = extractErrorBoundaryMLVector(
        record,
        this.options.maxConsecutiveFailures,
        budget.utilizationRatio,
        circuitOpen || circuitJustOpened,
        inQuar || justQuarantined,
        this.options.mlAnomalyThreshold,
      );
      this.lastMLVector = mlVector;

      const chatSignal = buildErrorBoundaryChatSignal(
        record,
        this.options.maxConsecutiveFailures,
        budget.utilizationRatio,
        circuitOpen || circuitJustOpened,
        this.options.mlAnomalyThreshold,
      );
      this.lastChatSignal = chatSignal;

      const narrative = generateErrorBoundaryNarrative(
        record,
        this.options.maxConsecutiveFailures,
        circuitOpen || circuitJustOpened,
      );
      this.lastNarrative = narrative;
    }
  }

  // ── Private: record construction ─────────────────────────────────────────────

  private createRecord(
    meta: ErrorBoundaryCaptureMeta,
    error: unknown,
    fatal: boolean,
  ): ErrorBoundaryRecord {
    const signalOwner =
      meta.signalOwner ??
      (meta.owner === 'system' ? 'mode' : meta.owner);

    const message = normalizeMessage(error);
    const category = classifyErrorCode(
      meta.code ?? (fatal ? 'ENGINE_STEP_FATAL' : 'ENGINE_STEP_FAILED'),
    );

    const tags = uniqueAppendMany(
      meta.tags ?? [],
      freezeArray([
        'engine-zero',
        'error-boundary',
        `step:${meta.step.toLowerCase()}`,
        `owner:${meta.owner}`,
        fatal ? 'fatal' : 'recoverable',
        `category:${category}`,
      ]),
    );

    const budget    = this.budgetTracker.getBudget();
    const circuitOpen = this.circuitBreaker.isOpen();
    const inQuar    = this.quarantineManager.isQuarantined(meta.owner, meta.step);

    // Compute anomaly score inline (lightweight — no full vector extraction)
    const categoryWeight = ERROR_CATEGORY_SEVERITY_WEIGHT[category] ?? 0.4;
    const failurePressure = clamp01(this.consecutiveFailures / Math.max(1, this.options.maxConsecutiveFailures));
    const mlAnomalyScore = clamp01(
      0.25 * (fatal ? 1 : 0) +
      0.20 * categoryWeight +
      0.15 * (fatal ? 1 : 0.5) +
      0.15 * failurePressure +
      0.10 * (circuitOpen ? 1 : 0) +
      0.10 * (inQuar ? 1 : 0) +
      0.05 * budget.utilizationRatio,
    );

    return {
      owner: meta.owner,
      signalOwner,
      step: meta.step,
      tick: meta.tick,
      code: meta.code ?? (fatal ? 'ENGINE_STEP_FATAL' : 'ENGINE_STEP_FAILED'),
      message,
      severity: fatal ? 'ERROR' : 'WARN',
      fatal,
      tags,
      stack: normalizeStack(error),
      occurredAtMs: Date.now(),
      consecutiveFailures: this.consecutiveFailures,
      category,
      mlAnomalyScore,
    };
  }

  // ── Private: history management ───────────────────────────────────────────────

  private addToHistory(record: ErrorBoundaryRecord): void {
    this.history.push(record);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  // ── Private: signal construction ─────────────────────────────────────────────

  private toSignal(record: ErrorBoundaryRecord): EngineSignal {
    return createEngineSignal(
      record.signalOwner,
      record.severity,
      record.code,
      `[${record.step}] ${record.message}`,
      record.tick,
      record.tags,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 19 — Well-known singletons + factories
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Singleton ErrorBoundary for Engine 0's own orchestration steps.
 * Use this boundary when capturing faults in STEP_01, STEP_11, STEP_12, STEP_13.
 */
export const ENGINE_ZERO_BOUNDARY = new ErrorBoundary(
  {
    maxConsecutiveFailures: 5,
    annotateSnapshot: true,
    enableCircuitBreaker: true,
    enableQuarantine: true,
    mlAnomalyThreshold: 0.55,
    dlAnomalyThreshold: 0.60,
  },
  'system',
);

/**
 * Singleton ErrorBoundary for mode hook steps.
 * Use this boundary for STEP_01_PREPARE, STEP_08_MODE_POST, STEP_09_TELEMETRY,
 * STEP_11_OUTCOME_GATE, STEP_12_EVENT_SEAL, STEP_13_FLUSH.
 */
export const MODE_BOUNDARY = new ErrorBoundary(
  {
    maxConsecutiveFailures: 3,
    annotateSnapshot: true,
    enableCircuitBreaker: true,
    enableQuarantine: false,
    mlAnomalyThreshold: 0.50,
    dlAnomalyThreshold: 0.55,
  },
  'mode',
);

/**
 * Creates a fresh ErrorBoundary with default options.
 * Use for per-run or per-step-isolated boundaries.
 */
export function createErrorBoundary(
  owner: ErrorBoundaryOwner = 'system',
  options: ErrorBoundaryOptions = {},
): ErrorBoundary {
  return new ErrorBoundary(options, owner);
}

/**
 * Creates a fresh ErrorBoundary with analytics sub-systems fully wired.
 * The returned boundary has ML, DL, chat, telemetry, and narrative surfaces
 * all immediately callable without further wiring.
 */
export function createErrorBoundaryWithAnalytics(
  owner: ErrorBoundaryOwner = 'system',
  options: ErrorBoundaryOptions = {},
): {
  readonly boundary: ErrorBoundary;
  readonly extractMLVector: (tick?: number) => ErrorBoundaryMLVector | null;
  readonly buildDLTensor: (tick?: number) => ErrorBoundaryDLTensor;
  readonly buildChatSignal: () => ErrorBoundaryChatSignal | null;
  readonly buildTelemetry: (tick?: number) => ErrorBoundaryTelemetrySnapshot;
  readonly generateNarrative: () => ErrorBoundaryNarrative | null;
  readonly getRecoveryForecast: () => ErrorBoundaryRecoveryForecast;
  readonly getTrend: () => ErrorBoundaryTrendSnapshot;
  readonly getAnnotationBundle: (tick?: number) => ErrorBoundaryAnnotationBundle | null;
  readonly getSessionReport: () => ErrorBoundarySessionReport;
  readonly getHistogramReport: () => ErrorBoundaryHistogramReport;
  readonly getBudget: () => ErrorBoundaryBudget;
  readonly getCircuitBreakerStatus: () => CircuitBreakerStatus;
  readonly getActiveQuarantineEntries: () => readonly ErrorBoundaryQuarantineEntry[];
} {
  const boundary = new ErrorBoundary(options, owner);
  return {
    boundary,
    extractMLVector:         (tick = 0) => boundary.extractMLVector(tick),
    buildDLTensor:           (tick = 0) => boundary.buildDLTensor(tick),
    buildChatSignal:         ()         => boundary.buildChatSignal(),
    buildTelemetry:          (tick = 0) => boundary.buildTelemetrySnapshot(tick),
    generateNarrative:       ()         => boundary.generateNarrative(),
    getRecoveryForecast:     ()         => boundary.getRecoveryForecast(),
    getTrend:                ()         => boundary.getTrend(),
    getAnnotationBundle:     (tick = 0) => boundary.buildAnnotationBundle(tick),
    getSessionReport:        ()         => boundary.getSessionReport(),
    getHistogramReport:      ()         => boundary.getHistogramReport(),
    getBudget:               ()         => boundary.getBudget(),
    getCircuitBreakerStatus: ()         => boundary.getCircuitBreakerStatus(),
    getActiveQuarantineEntries: ()      => boundary.getActiveQuarantineEntries(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 20 — Utility functions + public constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if an error record represents a fully terminal engine failure —
 * fatal AND in the engine_step, invariant, determinism, or state_mutation
 * categories.
 */
export function isEngineStepFatal(record: ErrorBoundaryRecord): boolean {
  if (!record.fatal) return false;
  return (
    record.category === 'engine_step' ||
    record.category === 'invariant' ||
    record.category === 'determinism' ||
    record.category === 'state_mutation'
  );
}

/**
 * Computes a [0–1] risk score from a consecutive failure count and threshold.
 * At 0 failures → 0.0; at threshold → 1.0; above threshold → capped at 1.0.
 */
export function computeConsecutiveFailureRisk(
  consecutiveFailures: number,
  maxConsecutiveFailures: number,
): number {
  return clamp01(consecutiveFailures / Math.max(1, maxConsecutiveFailures));
}

/**
 * Formats an ErrorBoundaryRecord into a single-line log string.
 * Format: [OWNER][STEP][CODE] message (tick=N, consecutive=N, category=C)
 */
export function formatErrorRecord(record: ErrorBoundaryRecord): string {
  return (
    `[${record.owner.toUpperCase()}][${record.step}][${record.code}] ` +
    `${record.message} ` +
    `(tick=${record.tick}, consecutive=${record.consecutiveFailures}, ` +
    `category=${record.category}, fatal=${String(record.fatal)}, ` +
    `anomaly=${record.mlAnomalyScore.toFixed(3)})`
  );
}

/**
 * Merges an array of ErrorBoundaryRecord arrays into a single chronological
 * array sorted by occurredAtMs ascending.
 */
export function mergeErrorBoundaryRecords(
  ...recordSets: readonly (readonly ErrorBoundaryRecord[])[]
): readonly ErrorBoundaryRecord[] {
  const merged: ErrorBoundaryRecord[] = [];
  for (const set of recordSets) {
    for (const rec of set) {
      merged.push(rec);
    }
  }
  merged.sort((a, b) => a.occurredAtMs - b.occurredAtMs);
  return Object.freeze(merged);
}

/**
 * Returns the most anomalous record from a set, or null if the set is empty.
 */
export function findMostAnomalousRecord(
  records: readonly ErrorBoundaryRecord[],
): ErrorBoundaryRecord | null {
  if (records.length === 0) return null;
  let best = records[0]!;
  for (let i = 1; i < records.length; i++) {
    const rec = records[i]!;
    if (rec.mlAnomalyScore > best.mlAnomalyScore) {
      best = rec;
    }
  }
  return best;
}

/**
 * Returns only the fatal records from a set.
 */
export function filterFatalRecords(
  records: readonly ErrorBoundaryRecord[],
): readonly ErrorBoundaryRecord[] {
  return Object.freeze(records.filter(r => r.fatal));
}

/**
 * Returns only the records matching a given category.
 */
export function filterRecordsByCategory(
  records: readonly ErrorBoundaryRecord[],
  category: ErrorCategory,
): readonly ErrorBoundaryRecord[] {
  return Object.freeze(records.filter(r => r.category === category));
}

/**
 * Returns only the records matching a given owner.
 */
export function filterRecordsByOwner(
  records: readonly ErrorBoundaryRecord[],
  owner: ErrorBoundaryOwner,
): readonly ErrorBoundaryRecord[] {
  return Object.freeze(records.filter(r => r.owner === owner));
}

/**
 * Computes a [0–100] health score from a set of records.
 * 100 = no errors; 0 = all fatal errors.
 */
export function computeErrorBoundaryHealthScore(
  records: readonly ErrorBoundaryRecord[],
): number {
  if (records.length === 0) return 100;
  const fatalCount = records.filter(r => r.fatal).length;
  const fatalRatio = fatalCount / records.length;
  const totalRatio = clamp01(records.length / 20);
  const score = clamp100(100 - fatalRatio * 60 - totalRatio * 40);
  return Math.round(score);
}

/**
 * Type guard: returns true if a value is a valid ErrorBoundaryRecord.
 */
export function isErrorBoundaryRecord(value: unknown): value is ErrorBoundaryRecord {
  if (typeof value !== 'object' || value === null) return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec['owner']              === 'string' &&
    typeof rec['step']               === 'string' &&
    typeof rec['tick']               === 'number' &&
    typeof rec['code']               === 'string' &&
    typeof rec['message']            === 'string' &&
    typeof rec['fatal']              === 'boolean' &&
    typeof rec['category']           === 'string' &&
    typeof rec['mlAnomalyScore']     === 'number'
  );
}

/**
 * Type guard: returns true if a value is an ErrorBoundaryChatSignal.
 */
export function isErrorBoundaryChatSignal(value: unknown): value is ErrorBoundaryChatSignal {
  if (typeof value !== 'object' || value === null) return false;
  const sig = value as Record<string, unknown>;
  return (
    sig['surface'] === 'error_boundary' &&
    typeof sig['kind']  === 'string' &&
    typeof sig['tick']  === 'number' &&
    typeof sig['owner'] === 'string'
  );
}

/**
 * Type guard: returns true if a value is an ErrorBoundaryMLVector.
 */
export function isErrorBoundaryMLVector(value: unknown): value is ErrorBoundaryMLVector {
  if (typeof value !== 'object' || value === null) return false;
  const vec = value as Record<string, unknown>;
  return (
    Array.isArray(vec['features']) &&
    typeof vec['anomalyScore'] === 'number' &&
    typeof vec['tick']         === 'number'
  );
}

/** Well-known singleton: boundary used for determinism and invariant faults. */
export const DETERMINISM_BOUNDARY = new ErrorBoundary(
  {
    maxConsecutiveFailures: 1,
    annotateSnapshot: true,
    enableCircuitBreaker: true,
    enableQuarantine: true,
    mlAnomalyThreshold: 0.4,
    dlAnomalyThreshold: 0.5,
  },
  'system',
);

/** Well-known singleton: boundary used for resource exhaustion faults. */
export const RESOURCE_BOUNDARY = new ErrorBoundary(
  {
    maxConsecutiveFailures: 10,
    annotateSnapshot: false,
    enableCircuitBreaker: false,
    enableQuarantine: false,
    mlAnomalyThreshold: 0.65,
    dlAnomalyThreshold: 0.70,
  },
  'system',
);

/** All well-known boundary singletons, keyed for enumeration. */
export const WELL_KNOWN_BOUNDARIES: Readonly<Record<string, ErrorBoundary>> = Object.freeze({
  ENGINE_ZERO:   ENGINE_ZERO_BOUNDARY,
  MODE:          MODE_BOUNDARY,
  DETERMINISM:   DETERMINISM_BOUNDARY,
  RESOURCE:      RESOURCE_BOUNDARY,
});

/** Returns the well-known boundary for a given owner key, or creates a new one. */
export function getOrCreateBoundary(
  ownerKey: string,
  options?: ErrorBoundaryOptions,
): ErrorBoundary {
  const existing = WELL_KNOWN_BOUNDARIES[ownerKey];
  if (existing !== undefined) return existing;
  return createErrorBoundary(ownerKey as ErrorBoundaryOwner, options);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public re-exports for convenience
// ─────────────────────────────────────────────────────────────────────────────

export {
  clamp01 as clampScore01,
  clamp100 as clampScore100,
};

export const ERROR_BOUNDARY_MODULE_READY = true as const;
