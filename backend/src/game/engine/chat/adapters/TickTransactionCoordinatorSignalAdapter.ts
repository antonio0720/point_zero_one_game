// backend/src/game/engine/chat/adapters/TickTransactionCoordinatorSignalAdapter.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE CHAT
 * /backend/src/game/engine/chat/adapters/TickTransactionCoordinatorSignalAdapter.ts
 * VERSION: 2026.03.28.1
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 *
 * ── PURPOSE ───────────────────────────────────────────────────────────────────
 * Translates TickTransactionCoordinator execution results from the Zero layer
 * into backend chat lane LIVEOPS_SIGNAL envelopes without creating a circular
 * dependency.
 *
 * NO direct imports from zero/ — all types are structural compat shapes.
 * This prevents the circular dependency: chat/ → zero/ → chat/.
 *
 * ── SIGNAL DOCTRINE ───────────────────────────────────────────────────────────
 * Transaction coordinator signals enter the chat lane whenever:
 *   - A TickContext is created (CONTEXT_CREATE)
 *   - A SimulationEngine executes (ENGINE_EXEC)
 *   - A synthetic reducer executes (SYNTHETIC_EXEC)
 *   - A rollback is detected (ROLLBACK)
 *   - A step is skipped (SKIP)
 *   - An abort occurs (ABORT)
 *
 * Every signal carries:
 *   - operation kind (ENGINE_EXEC / SYNTHETIC_EXEC / CONTEXT_CREATE /
 *                     ROLLBACK / SKIP / ABORT)
 *   - severity (LOW / MEDIUM / HIGH / CRITICAL)
 *   - health grade (ML-derived [0,1])
 *   - 32-dim ML feature vector for real-time inference
 *   - per-step DL row for tick profile construction
 *   - narration phrase adapted to player mode
 *   - run/tick context for downstream routing
 *   - witness trigger flag for social pressure engine activation
 *   - proof-bearing transcript eligibility
 *
 * ── CHAT SIGNAL ENVELOPE ──────────────────────────────────────────────────────
 * Each translated result produces:
 *   ChatInputEnvelope {
 *     kind: 'LIVEOPS_SIGNAL',
 *     payload: ChatSignalEnvelope {
 *       type: 'LIVEOPS',
 *       ...coordinator execution truth
 *     }
 *   }
 *
 * ── DESIGN LAWS ───────────────────────────────────────────────────────────────
 * - Imports ONLY from '../types' — never from '../../../zero/' or '../../../core/'
 * - Structural compat types mirror zero/TickTransactionCoordinator.ts shapes
 * - No mutation of upstream signals — always produce new envelope objects
 * - Rollbacks are always accepted — they represent engine truth chat must witness
 * - CRITICAL severity triggers full proof-bearing transcript activation
 * - Mode-native narration: Empire/Predator/Syndicate/Phantom language preserved
 * - Batch translation preserves insertion order for replay fidelity
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  asUnixMs,
  clamp01,
  type ChatInputEnvelope,
  type ChatRoomId,
  type ChatSignalEnvelope,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type UnixMs,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION A — Module Metadata
// ─────────────────────────────────────────────────────────────────────────────

export const TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_MODULE_VERSION =
  '2026.03.28.1' as const;
export const TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_SCHEMA =
  'coordinator-signal-adapter:v1' as const;
export const TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_READY = true as const;
export const TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_ML_FEATURE_COUNT = 32 as const;
export const TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_DL_TENSOR_SHAPE = Object.freeze(
  [13, 8] as const,
);
export const TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_MAX_HEAT = 1.0 as const;
export const TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_STEP_BUDGET_MS = 50 as const;
export const TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_MAX_BATCH = 512 as const;
export const TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_WORLD_EVENT_PREFIX =
  'coordinator.exec' as const;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION B — Structural Compat Types (mirroring zero/TickTransactionCoordinator.ts)
// ─────────────────────────────────────────────────────────────────────────────

export type CoordinatorSignalAdapterSeverityCompat = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type CoordinatorSignalAdapterOperationKindCompat =
  | 'ENGINE_EXEC'
  | 'SYNTHETIC_EXEC'
  | 'CONTEXT_CREATE'
  | 'ROLLBACK'
  | 'SKIP'
  | 'ABORT';

export type CoordinatorSignalAdapterModeCompat = 'solo' | 'pvp' | 'coop' | 'ghost';

export type CoordinatorModeCodeCompat = 'solo' | 'pvp' | 'coop' | 'ghost';

export type CoordinatorRunPhaseCompat =
  | 'PROLOGUE'
  | 'EARLY'
  | 'MID'
  | 'LATE'
  | 'ENDGAME';

export type CoordinatorPressureTierCompat = 'T1' | 'T2' | 'T3' | 'T4' | 'T5';

export type CoordinatorRunOutcomeCompat =
  | 'NONE'
  | 'FREEDOM'
  | 'CAPTURED'
  | 'ABANDONED'
  | 'TIMEOUT';

/** Structural compat shape for CoordinatorChatSignal from zero/ */
export interface CoordinatorChatSignalCompat {
  readonly type: 'LIVEOPS';
  readonly code: string;
  readonly runId: string;
  readonly tick: number;
  readonly step: string;
  readonly mode: CoordinatorModeCodeCompat;
  readonly severity: CoordinatorSignalAdapterSeverityCompat;
  readonly operationKind: CoordinatorSignalAdapterOperationKindCompat;
  readonly narration: string;
  readonly mlVector: readonly number[];
  readonly healthScore: number;
  readonly rolledBack: boolean;
  readonly skipped: boolean;
  readonly signalCount: number;
  readonly timestamp: number;
}

/** Structural compat shape for CoordinatorMLVector from zero/ */
export interface TickTxCoordinatorMLVectorCompat {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly tick: number;
  readonly step: string;
  readonly runId: string;
  readonly operationKind: CoordinatorSignalAdapterOperationKindCompat;
  readonly healthScore: number;
  readonly severity: CoordinatorSignalAdapterSeverityCompat;
  readonly rolledBack: boolean;
  readonly skipped: boolean;
}

/** Structural compat shape for CoordinatorDLTensorRow from zero/ */
export interface TickTxCoordinatorDLTensorRowCompat {
  readonly step: string;
  readonly ordinal: number;
  readonly cols: readonly number[];
  readonly tick: number;
  readonly runId: string;
}

/** Structural compat shape for CoordinatorDLTensor from zero/ */
export interface TickTxCoordinatorDLTensorCompat {
  readonly rows: readonly TickTxCoordinatorDLTensorRowCompat[];
  readonly tick: number;
  readonly runId: string;
  readonly shape: readonly [number, number];
  readonly colLabels: readonly string[];
  readonly rowLabels: readonly string[];
}

/** Structural compat shape for CoordinatorNarrationHint from zero/ */
export interface CoordinatorNarrationHintCompat {
  readonly phrase: string;
  readonly mode: CoordinatorModeCodeCompat;
  readonly step: string;
  readonly severity: CoordinatorSignalAdapterSeverityCompat;
  readonly operationKind: CoordinatorSignalAdapterOperationKindCompat;
  readonly tick: number;
  readonly rolledBack: boolean;
  readonly skipped: boolean;
  readonly witnessTrigger: boolean;
}

/** Structural compat shape for CoordinatorAnnotationBundle from zero/ */
export interface CoordinatorAnnotationBundleCompat {
  readonly runId: string;
  readonly tick: number;
  readonly step: string;
  readonly operationKind: CoordinatorSignalAdapterOperationKindCompat;
  readonly severity: CoordinatorSignalAdapterSeverityCompat;
  readonly healthBefore: number;
  readonly healthAfter: number;
  readonly healthDelta: number;
  readonly rolledBack: boolean;
  readonly skipped: boolean;
  readonly signalCount: number;
  readonly errorCount: number;
  readonly warnCount: number;
  readonly infoCount: number;
  readonly signalCodes: readonly string[];
  readonly traceId: string;
  readonly nowMs: number;
  readonly executionMs: number;
  readonly budgetExceeded: boolean;
}

/** Structural compat shape for CoordinatorHealthSnapshot from zero/ */
export interface CoordinatorHealthSnapshotCompat {
  readonly runId: string;
  readonly tick: number;
  readonly step: string;
  readonly healthScore: number;
  readonly severity: CoordinatorSignalAdapterSeverityCompat;
  readonly statusBefore?: string;
  readonly statusAfter?: string;
  readonly rolledBack: boolean;
  readonly consecutiveFailures: number;
  readonly lastSuccessfulTick: number;
  readonly recommendation: string;
}

/** A minimal signal compat for batch/partial translation paths. */
export interface MinimalCoordinatorSignalCompat {
  readonly runId: string;
  readonly tick: number;
  readonly step: string;
  readonly operationKind: CoordinatorSignalAdapterOperationKindCompat;
  readonly rolledBack: boolean;
  readonly skipped: boolean;
  readonly signalCount: number;
  readonly healthScore: number;
  readonly severity: CoordinatorSignalAdapterSeverityCompat;
  readonly timestamp: number;
}

/** Score result compat for health grade classification. */
export interface CoordinatorScoreResultCompat {
  readonly healthScore: number;
  readonly severity: CoordinatorSignalAdapterSeverityCompat;
  readonly witnessTrigger: boolean;
  readonly proofTranscriptEligible: boolean;
  readonly recommendation: string;
}

/** Trend snapshot compat for rolling window analytics. */
export interface CoordinatorTrendSnapshotCompat {
  readonly window: number;
  readonly avgHealthScore: number;
  readonly minHealthScore: number;
  readonly maxHealthScore: number;
  readonly rollbackRate: number;
  readonly skipRate: number;
  readonly abortRate: number;
  readonly severityDistribution: Record<CoordinatorSignalAdapterSeverityCompat, number>;
  readonly trendDirection: 'IMPROVING' | 'STABLE' | 'DECLINING';
}

/** Session entry compat for session history tracking. */
export interface CoordinatorSessionEntryCompat {
  readonly runId: string;
  readonly tick: number;
  readonly step: string;
  readonly operationKind: CoordinatorSignalAdapterOperationKindCompat;
  readonly healthScore: number;
  readonly severity: CoordinatorSignalAdapterSeverityCompat;
  readonly rolledBack: boolean;
  readonly skipped: boolean;
  readonly nowMs: UnixMs;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION C — Adapter Options and Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface CoordinatorSignalAdapterOptions {
  readonly mode: CoordinatorModeCodeCompat;
  readonly roomId?: Nullable<ChatRoomId>;
  readonly channel?: ChatVisibleChannel; // defaults to 'GLOBAL'
  readonly includeMLVector: boolean;
  readonly includeDLRow: boolean;
  readonly includeNarration: boolean;
  readonly verbose: boolean;
  readonly dedupeWindowTicks: number;
  readonly maxBatchSize: number;
  readonly proofTranscriptThreshold: CoordinatorSignalAdapterSeverityCompat;
  readonly witnessThreshold: CoordinatorSignalAdapterSeverityCompat;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION D — Translation Result Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CoordinatorSignalTranslationResult {
  readonly accepted: boolean;
  readonly envelope: Nullable<ChatInputEnvelope>;
  readonly signalCompat: CoordinatorChatSignalCompat;
  readonly narrationHint: CoordinatorNarrationHintCompat;
  readonly mlVector: Nullable<TickTxCoordinatorMLVectorCompat>;
  readonly dlRow: Nullable<TickTxCoordinatorDLTensorRowCompat>;
  readonly scoreResult: CoordinatorScoreResultCompat;
  readonly witnessTrigger: boolean;
  readonly proofTranscriptEligible: boolean;
  readonly rejectionReason: Nullable<string>;
}

export interface CoordinatorSignalBatchResult {
  readonly accepted: readonly CoordinatorSignalTranslationResult[];
  readonly rejected: readonly CoordinatorSignalTranslationResult[];
  readonly totalIn: number;
  readonly totalAccepted: number;
  readonly totalRejected: number;
  readonly witnessCount: number;
  readonly proofTranscriptCount: number;
  readonly rollbackCount: number;
  readonly batchHealthScore: number;
  readonly batchSeverity: CoordinatorSignalAdapterSeverityCompat;
}

export interface CoordinatorSignalAdapterManifest {
  readonly module: string;
  readonly version: string;
  readonly schema: string;
  readonly mlFeatureCount: number;
  readonly dlTensorShape: readonly [number, number];
  readonly maxBatchSize: number;
  readonly stepBudgetMs: number;
  readonly operationKinds: readonly string[];
  readonly severityLevels: readonly string[];
  readonly modeCodes: readonly string[];
  readonly ready: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION E — Pure Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function clamp01Compat(v: number): number {
  return Math.min(1, Math.max(0, isFinite(v) ? v : 0));
}

function scoreCoordinatorHealthGrade(
  healthScore: number,
  rolledBack: boolean,
  errorCount: number,
): number {
  let score = clamp01Compat(healthScore);
  if (rolledBack) score = Math.max(0, score - 0.3);
  if (errorCount > 0) score = Math.max(0, score - errorCount * 0.1);
  return clamp01Compat(score);
}

function classifyCoordinatorSignalSeverity(
  score: number,
): CoordinatorSignalAdapterSeverityCompat {
  if (score >= 0.75) return 'LOW';
  if (score >= 0.5) return 'MEDIUM';
  if (score >= 0.25) return 'HIGH';
  return 'CRITICAL';
}

function buildCoordinatorNarrationByMode(
  mode: CoordinatorModeCodeCompat,
  operationKind: CoordinatorSignalAdapterOperationKindCompat,
  severity: CoordinatorSignalAdapterSeverityCompat,
  rolledBack: boolean,
  skipped: boolean,
): string {
  const narrationMap: Record<
    CoordinatorModeCodeCompat,
    Record<string, string>
  > = {
    solo: {
      ENGINE_EXEC: 'Your engine ran clean. Keep moving.',
      SYNTHETIC_EXEC: 'System step executed. Path stays open.',
      ROLLBACK: 'That move failed. The system rolled back.',
      SKIP: 'Step skipped — engine held its breath.',
      ABORT: 'Abort. Engine collapsed. You are exposed.',
      CONTEXT_CREATE: 'Context locked. Execution window open.',
      LOW: 'Clean execution. No resistance.',
      MEDIUM: 'Execution stress. Observer is watching.',
      HIGH: 'Execution critical. Witness activated.',
      CRITICAL: 'Execution collapsed. Full transcript triggered.',
    },
    pvp: {
      ENGINE_EXEC: 'Engine fired. Opponent has no idea yet.',
      SYNTHETIC_EXEC: 'Synthetic move processed. Edge preserved.',
      ROLLBACK: 'Rollback. Your opponent just got a window.',
      SKIP: 'Step skipped. Predator watching.',
      ABORT: 'Abort signal. You just lost momentum.',
      CONTEXT_CREATE: 'Context armed. Head-to-head window live.',
      LOW: 'Clean execution. Stay aggressive.',
      MEDIUM: 'Your engine is slipping. Fix it before they see.',
      HIGH: 'Engine stress detected. Opponent may exploit.',
      CRITICAL: 'Engine failed. Head-to-head just got harder.',
    },
    coop: {
      ENGINE_EXEC: 'Step executed. Team is holding.',
      SYNTHETIC_EXEC: 'Syndicate step processed. Unity intact.',
      ROLLBACK: 'Rollback. The team needs to cover this.',
      SKIP: 'Step skipped. Hold formation.',
      ABORT: 'Abort. Notify the team immediately.',
      CONTEXT_CREATE: 'Context built. Syndicate ready.',
      LOW: 'Clean execution. The syndicate is strong.',
      MEDIUM: 'Engine strain showing. Team support needed.',
      HIGH: 'Engine critical. Syndicate at risk.',
      CRITICAL: 'Engine failure. The syndicate is endangered.',
    },
    ghost: {
      ENGINE_EXEC: 'The legend executed this step clean.',
      SYNTHETIC_EXEC: "Phantom step — following the ghost's path.",
      ROLLBACK: 'The ghost never rolled back here. You did.',
      SKIP: 'Phantom skipped this. So should you.',
      ABORT: 'The ghost did not abort here. You are off-path.',
      CONTEXT_CREATE: "Ghost context active. Follow the legend's line.",
      LOW: "On the ghost's line. Keep chasing.",
      MEDIUM: "Falling behind the ghost's execution pace.",
      HIGH: "Ghost never had this much engine stress.",
      CRITICAL: "The ghost's engine never failed here. Yours did.",
    },
  };

  const modeMap = narrationMap[mode] ?? narrationMap.solo;

  if (rolledBack) return modeMap['ROLLBACK'] ?? 'Rollback detected.';
  if (skipped) return modeMap['SKIP'] ?? 'Step skipped.';
  if (severity === 'CRITICAL') return modeMap['CRITICAL'] ?? 'Critical execution failure.';
  if (severity === 'HIGH') return modeMap['HIGH'] ?? 'High execution stress.';

  return (
    modeMap[operationKind] ??
    modeMap['ENGINE_EXEC'] ??
    'Execution processed.'
  );
}

function buildCoordinatorActionRecommendation(
  severity: CoordinatorSignalAdapterSeverityCompat,
): string {
  switch (severity) {
    case 'LOW':
      return 'Continue execution. No immediate intervention required.';
    case 'MEDIUM':
      return 'Monitor closely. Consider applying a recovery card next opportunity.';
    case 'HIGH':
      return 'Act now. Engine is stressed. Recovery or mitigation required.';
    case 'CRITICAL':
      return 'Emergency response required. Rollback may have caused cascading state drift.';
  }
}

function resolveCoordinatorChatChannel(
  severity: CoordinatorSignalAdapterSeverityCompat,
  rolledBack: boolean,
  defaultChannel: ChatVisibleChannel = 'GLOBAL',
): ChatVisibleChannel {
  if (rolledBack || severity === 'CRITICAL') return 'GLOBAL';
  if (severity === 'HIGH') return 'GLOBAL';
  return defaultChannel;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION F — Narration Hint Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a mode-native narration hint for a coordinator chat signal.
 */
export function buildCoordinatorSignalNarrationHint(
  signalCompat: CoordinatorChatSignalCompat,
): CoordinatorNarrationHintCompat {
  const { mode, step, severity, operationKind, tick, rolledBack, skipped } = signalCompat;
  const phrase = buildCoordinatorNarrationByMode(
    mode,
    operationKind,
    severity,
    rolledBack,
    skipped,
  );
  const witnessTrigger = severity === 'HIGH' || severity === 'CRITICAL' || rolledBack;

  return Object.freeze({
    phrase,
    mode,
    step,
    severity,
    operationKind,
    tick,
    rolledBack,
    skipped,
    witnessTrigger,
  });
}

/**
 * Build a narration hint from raw parts without a full signal object.
 */
export function buildCoordinatorSignalNarrationHintFromParts(
  step: string,
  mode: CoordinatorModeCodeCompat,
  severity: CoordinatorSignalAdapterSeverityCompat,
  operationKind: CoordinatorSignalAdapterOperationKindCompat,
  tick: number,
  rolledBack: boolean,
  skipped: boolean,
): CoordinatorNarrationHintCompat {
  const phrase = buildCoordinatorNarrationByMode(
    mode,
    operationKind,
    severity,
    rolledBack,
    skipped,
  );
  const witnessTrigger = severity === 'HIGH' || severity === 'CRITICAL' || rolledBack;

  return Object.freeze({
    phrase,
    mode,
    step,
    severity,
    operationKind,
    tick,
    rolledBack,
    skipped,
    witnessTrigger,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION G — ML Vector Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a 32-dim ML vector compat from coordinator signal fields.
 * All values are clamped to [0,1].
 */
export function buildTickTxCoordinatorMLVectorCompat(
  signalCompat: CoordinatorChatSignalCompat,
): TickTxCoordinatorMLVectorCompat {
  const mlFeatureLabels = [
    'step_ordinal', 'operation_kind', 'rolled_back', 'skipped',
    'signal_count', 'health_before_score', 'health_after_score', 'health_delta',
    'execution_budget_ratio', 'mode_normalized', 'pressure_tier_normalized', 'tick_normalized',
    'engine_id_encoded', 'has_error_signal', 'has_warn_signal', 'error_signal_ratio',
    'warn_signal_ratio', 'rollback_tag_present', 'owner_is_system', 'trace_tag_count',
    'economy_net_worth', 'pressure_score', 'tension_score', 'sovereignty_verified_tick',
    'phase_normalized', 'outcome_present', 'budget_exceeded', 'trace_tick_normalized',
    'synthetic_owner_encoded', 'run_id_hash', 'now_ms_normalized', 'signal_severity_weighted',
  ] as const;

  const STEP_ORDINAL_MAP: Record<string, number> = {
    STEP_01_PREPARE: 0, STEP_02_TIME: 1 / 12, STEP_03_PRESSURE: 2 / 12,
    STEP_04_TENSION: 3 / 12, STEP_05_BATTLE: 4 / 12, STEP_06_SHIELD: 5 / 12,
    STEP_07_CASCADE: 6 / 12, STEP_08_MODE_POST: 7 / 12, STEP_09_TELEMETRY: 8 / 12,
    STEP_10_SOVEREIGNTY_SNAPSHOT: 9 / 12, STEP_11_OUTCOME_GATE: 10 / 12,
    STEP_12_EVENT_SEAL: 11 / 12, STEP_13_FLUSH: 1,
  };
  const OPERATION_ENCODED: Record<string, number> = {
    CONTEXT_CREATE: 0, ENGINE_EXEC: 0.2, SYNTHETIC_EXEC: 0.4,
    ROLLBACK: 0.6, SKIP: 0.8, ABORT: 1.0,
  };
  const MODE_ENCODED: Record<string, number> = {
    solo: 0.25, pvp: 0.5, coop: 0.75, ghost: 1.0,
  };

  const h = signalCompat.healthScore;

  // djb2-lite: map string to normalized [0,1]
  const strNorm = (s: string): number => {
    let hash = 5381;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) + hash) ^ s.charCodeAt(i);
      hash = hash >>> 0;
    }
    return hash / 0xffffffff;
  };

  const features: readonly number[] = Object.freeze([
    /* 00 */ clamp01Compat(STEP_ORDINAL_MAP[signalCompat.step] ?? 0.5),
    /* 01 */ clamp01Compat(OPERATION_ENCODED[signalCompat.operationKind] ?? 0),
    /* 02 */ signalCompat.rolledBack ? 1 : 0,
    /* 03 */ signalCompat.skipped ? 1 : 0,
    /* 04 */ clamp01Compat(signalCompat.signalCount / 64),
    /* 05 */ h,
    /* 06 */ h,
    /* 07 */ 0.5, // health_delta: not available from signal alone
    /* 08 */ 0,   // execution_budget_ratio: not available without timing
    /* 09 */ clamp01Compat(MODE_ENCODED[signalCompat.mode] ?? 0.25),
    /* 10 */ 0.2, // pressure_tier_normalized: default T1
    /* 11 */ clamp01Compat(signalCompat.tick / 9999),
    /* 12 */ 0,   // engine_id_encoded: not available in signal
    /* 13 */ signalCompat.severity === 'CRITICAL' || signalCompat.severity === 'HIGH' ? 1 : 0,
    /* 14 */ signalCompat.severity === 'MEDIUM' ? 1 : 0,
    /* 15 */ signalCompat.rolledBack ? 1 : 0,
    /* 16 */ signalCompat.severity === 'MEDIUM' ? 0.5 : 0,
    /* 17 */ signalCompat.rolledBack ? 1 : 0,
    /* 18 */ signalCompat.operationKind === 'SYNTHETIC_EXEC' ? 0.5 : 0,
    /* 19 */ 0, // trace_tag_count: not available in signal
    /* 20 */ 0, // economy_net_worth: not available in signal
    /* 21 */ 0, // pressure_score: not available in signal
    /* 22 */ 0, // tension_score: not available in signal
    /* 23 */ 0, // sovereignty_verified_tick: not available in signal
    /* 24 */ 0, // phase_normalized: not available in signal
    /* 25 */ 0, // outcome_present: not available in signal
    /* 26 */ 0, // budget_exceeded: not available without timing
    /* 27 */ clamp01Compat(signalCompat.tick / 9999),
    /* 28 */ strNorm(signalCompat.operationKind),
    /* 29 */ strNorm(signalCompat.runId),
    /* 30 */ clamp01Compat(signalCompat.timestamp / 3_600_000),
    /* 31 */ h * 0.5,
  ]);

  return Object.freeze({
    features,
    labels: mlFeatureLabels,
    tick: signalCompat.tick,
    step: signalCompat.step,
    runId: signalCompat.runId,
    operationKind: signalCompat.operationKind,
    healthScore: signalCompat.healthScore,
    severity: signalCompat.severity,
    rolledBack: signalCompat.rolledBack,
    skipped: signalCompat.skipped,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION H — DL Row Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a DL tensor row compat from a coordinator chat signal.
 */
export function buildCoordinatorDLRowCompat(
  signalCompat: CoordinatorChatSignalCompat,
): TickTxCoordinatorDLTensorRowCompat {
  const STEP_ORDINAL_MAP: Record<string, number> = {
    STEP_01_PREPARE: 0, STEP_02_TIME: 1 / 12, STEP_03_PRESSURE: 2 / 12,
    STEP_04_TENSION: 3 / 12, STEP_05_BATTLE: 4 / 12, STEP_06_SHIELD: 5 / 12,
    STEP_07_CASCADE: 6 / 12, STEP_08_MODE_POST: 7 / 12, STEP_09_TELEMETRY: 8 / 12,
    STEP_10_SOVEREIGNTY_SNAPSHOT: 9 / 12, STEP_11_OUTCOME_GATE: 10 / 12,
    STEP_12_EVENT_SEAL: 11 / 12, STEP_13_FLUSH: 1,
  };
  const MODE_ENCODED: Record<string, number> = {
    solo: 0.25, pvp: 0.5, coop: 0.75, ghost: 1.0,
  };

  const cols: readonly number[] = Object.freeze([
    /* 0 */ signalCompat.skipped ? 0 : 1,
    /* 1 */ signalCompat.rolledBack ? 1 : 0,
    /* 2 */ signalCompat.skipped ? 1 : 0,
    /* 3 */ clamp01Compat(signalCompat.signalCount / 64),
    /* 4 */ clamp01Compat(signalCompat.healthScore),
    /* 5 */ 0, // budget_ratio: not available from signal alone
    /* 6 */ clamp01Compat(MODE_ENCODED[signalCompat.mode] ?? 0.25),
    /* 7 */ signalCompat.severity === 'CRITICAL' ? 1 : signalCompat.severity === 'HIGH' ? 0.5 : 0,
  ]);

  return Object.freeze({
    step: signalCompat.step,
    ordinal: STEP_ORDINAL_MAP[signalCompat.step] ?? 0.5,
    cols,
    tick: signalCompat.tick,
    runId: signalCompat.runId,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION I — Score Result Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a score result from coordinator signal compat.
 */
export function scoreCoordinatorSignalHealth(
  signalCompat: CoordinatorChatSignalCompat,
): CoordinatorScoreResultCompat {
  const healthScore = scoreCoordinatorHealthGrade(
    signalCompat.healthScore,
    signalCompat.rolledBack,
    signalCompat.severity === 'CRITICAL' ? 3 : signalCompat.severity === 'HIGH' ? 1 : 0,
  );
  const severity = classifyCoordinatorSignalSeverity(healthScore);
  const witnessTrigger = severity === 'HIGH' || severity === 'CRITICAL' || signalCompat.rolledBack;
  const proofTranscriptEligible =
    severity === 'CRITICAL' || (severity === 'HIGH' && signalCompat.rolledBack);
  const recommendation = buildCoordinatorActionRecommendation(severity);

  return Object.freeze({
    healthScore,
    severity,
    witnessTrigger,
    proofTranscriptEligible,
    recommendation,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION J — Minimal Signal Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a minimal signal compat for batch/partial translation paths.
 */
export function buildMinimalCoordinatorSignalCompat(
  runId: string,
  tick: number,
  step: string,
  operationKind: CoordinatorSignalAdapterOperationKindCompat,
  rolledBack: boolean,
  skipped: boolean,
  signalCount: number,
  healthScore: number,
  nowMs: number,
): MinimalCoordinatorSignalCompat {
  const severity = classifyCoordinatorSignalSeverity(healthScore);
  return Object.freeze({
    runId,
    tick,
    step,
    operationKind,
    rolledBack,
    skipped,
    signalCount,
    healthScore,
    severity,
    timestamp: nowMs,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION K — Chat Envelope Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wrap a coordinator chat signal compat into a full ChatInputEnvelope.
 * Uses the real ChatSignalEnvelope shape: type + emittedAt + roomId + liveops + metadata.
 */
function wrapCoordinatorSignalInEnvelope(
  signalCompat: CoordinatorChatSignalCompat,
  narrationHint: CoordinatorNarrationHintCompat,
  roomId: Nullable<ChatRoomId>,
  _channel: ChatVisibleChannel,
  nowMs: number,
): ChatInputEnvelope {
  const metadata: Record<string, JsonValue> = {
    code: signalCompat.code as JsonValue,
    runId: signalCompat.runId as JsonValue,
    tick: signalCompat.tick as JsonValue,
    step: signalCompat.step as JsonValue,
    mode: signalCompat.mode as JsonValue,
    severity: signalCompat.severity as JsonValue,
    operationKind: signalCompat.operationKind as JsonValue,
    narration: narrationHint.phrase as JsonValue,
    healthScore: signalCompat.healthScore as JsonValue,
    rolledBack: signalCompat.rolledBack as JsonValue,
    skipped: signalCompat.skipped as JsonValue,
    signalCount: signalCompat.signalCount as JsonValue,
    witnessTrigger: narrationHint.witnessTrigger as JsonValue,
  };

  const chatSignalEnvelope: ChatSignalEnvelope = {
    type: 'LIVEOPS',
    emittedAt: asUnixMs(nowMs),
    roomId: roomId ?? null,
    liveops: {
      worldEventName: `${TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_WORLD_EVENT_PREFIX}.${signalCompat.step.toLowerCase()}` as string | null,
      heatMultiplier01: clamp01(1 - signalCompat.healthScore),
      helperBlackout: signalCompat.severity === 'CRITICAL',
      haterRaidActive: signalCompat.rolledBack && signalCompat.severity === 'CRITICAL',
    },
    metadata,
  };

  return {
    kind: 'LIVEOPS_SIGNAL',
    emittedAt: asUnixMs(nowMs),
    payload: chatSignalEnvelope,
  } satisfies ChatInputEnvelope;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION L — TickTransactionCoordinatorSignalAdapter Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TickTransactionCoordinatorSignalAdapter
 *
 * Translates CoordinatorChatSignalCompat payloads from the Zero layer into
 * authoritative LIVEOPS_SIGNAL envelopes for the backend chat lane.
 *
 * Design laws:
 * - Imports ONLY from '../types'
 * - All types are structural compat shapes (no zero/ imports)
 * - Rollbacks always accepted and witnessed
 * - CRITICAL severity triggers proof-bearing transcript flag
 * - Batch translation preserves insertion order
 */
export class TickTransactionCoordinatorSignalAdapter {
  public readonly options: CoordinatorSignalAdapterOptions;

  private readonly sessionHistory: CoordinatorSessionEntryCompat[];
  private readonly dedupeCache: Map<string, number>;

  constructor(options: Partial<CoordinatorSignalAdapterOptions> = {}) {
    this.options = Object.freeze({
      mode: options.mode ?? 'solo',
      roomId: options.roomId ?? null,
      channel: options.channel ?? 'GLOBAL',
      includeMLVector: options.includeMLVector ?? false,
      includeDLRow: options.includeDLRow ?? false,
      includeNarration: options.includeNarration ?? true,
      verbose: options.verbose ?? false,
      dedupeWindowTicks: options.dedupeWindowTicks ?? 3,
      maxBatchSize: options.maxBatchSize ?? TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_MAX_BATCH,
      proofTranscriptThreshold: options.proofTranscriptThreshold ?? 'CRITICAL',
      witnessThreshold: options.witnessThreshold ?? 'HIGH',
    });
    this.sessionHistory = [];
    this.dedupeCache = new Map();
  }

  // ── Single Translation ─────────────────────────────────────────────────────

  /**
   * Translate a single CoordinatorChatSignalCompat into a full translation result.
   */
  public translate(
    signalCompat: CoordinatorChatSignalCompat,
    nowMs: number,
  ): CoordinatorSignalTranslationResult {
    // Dedupe check
    const dedupeKey = `${signalCompat.runId}:${signalCompat.tick}:${signalCompat.step}:${signalCompat.operationKind}`;
    const lastTick = this.dedupeCache.get(dedupeKey);
    if (
      lastTick !== undefined &&
      signalCompat.tick - lastTick <= this.options.dedupeWindowTicks &&
      !signalCompat.rolledBack
    ) {
      const narrationHint = buildCoordinatorSignalNarrationHint(signalCompat);
      const scoreResult = scoreCoordinatorSignalHealth(signalCompat);
      return Object.freeze({
        accepted: false,
        envelope: null,
        signalCompat,
        narrationHint,
        mlVector: null,
        dlRow: null,
        scoreResult,
        witnessTrigger: false,
        proofTranscriptEligible: false,
        rejectionReason: 'DEDUPED',
      });
    }
    this.dedupeCache.set(dedupeKey, signalCompat.tick);

    // Prune old dedupe entries
    if (this.dedupeCache.size > 1_000) {
      const firstKey = this.dedupeCache.keys().next().value;
      if (firstKey !== undefined) this.dedupeCache.delete(firstKey);
    }

    const narrationHint = buildCoordinatorSignalNarrationHint(signalCompat);
    const scoreResult = scoreCoordinatorSignalHealth(signalCompat);

    const proofTranscriptEligible =
      scoreResult.severity === this.options.proofTranscriptThreshold ||
      (scoreResult.severity === 'CRITICAL') ||
      (scoreResult.severity === 'HIGH' && signalCompat.rolledBack);

    const witnessTrigger =
      scoreResult.severity === this.options.witnessThreshold ||
      scoreResult.severity === 'CRITICAL' ||
      signalCompat.rolledBack;

    const channel = resolveCoordinatorChatChannel(
      scoreResult.severity,
      signalCompat.rolledBack,
      this.options.channel,
    );

    const envelope = wrapCoordinatorSignalInEnvelope(
      signalCompat,
      narrationHint,
      this.options.roomId ?? null,
      channel,
      nowMs,
    );

    const mlVector = this.options.includeMLVector
      ? buildTickTxCoordinatorMLVectorCompat(signalCompat)
      : null;

    const dlRow = this.options.includeDLRow
      ? buildCoordinatorDLRowCompat(signalCompat)
      : null;

    // Record in session history
    this.sessionHistory.push(
      Object.freeze({
        runId: signalCompat.runId,
        tick: signalCompat.tick,
        step: signalCompat.step,
        operationKind: signalCompat.operationKind,
        healthScore: scoreResult.healthScore,
        severity: scoreResult.severity,
        rolledBack: signalCompat.rolledBack,
        skipped: signalCompat.skipped,
        nowMs: asUnixMs(nowMs),
      }),
    );
    if (this.sessionHistory.length > 2_048) {
      this.sessionHistory.shift();
    }

    return Object.freeze({
      accepted: true,
      envelope,
      signalCompat,
      narrationHint,
      mlVector,
      dlRow,
      scoreResult,
      witnessTrigger,
      proofTranscriptEligible,
      rejectionReason: null,
    });
  }

  // ── Batch Translation ──────────────────────────────────────────────────────

  /**
   * Translate a batch of CoordinatorChatSignalCompat payloads.
   * Preserves insertion order. Enforces maxBatchSize limit.
   */
  public translateBatch(
    signals: readonly CoordinatorChatSignalCompat[],
    nowMs: number,
  ): CoordinatorSignalBatchResult {
    const limited = signals.slice(0, this.options.maxBatchSize);
    const results: CoordinatorSignalTranslationResult[] = [];

    for (const signal of limited) {
      results.push(this.translate(signal, nowMs));
    }

    const accepted = results.filter((r) => r.accepted);
    const rejected = results.filter((r) => !r.accepted);

    const healthScores = accepted.map((r) => r.scoreResult.healthScore);
    const batchHealthScore =
      healthScores.length > 0
        ? healthScores.reduce((a, b) => a + b, 0) / healthScores.length
        : 1.0;
    const batchSeverity = classifyCoordinatorSignalSeverity(batchHealthScore);

    return Object.freeze({
      accepted: Object.freeze(accepted),
      rejected: Object.freeze(rejected),
      totalIn: limited.length,
      totalAccepted: accepted.length,
      totalRejected: rejected.length,
      witnessCount: accepted.filter((r) => r.witnessTrigger).length,
      proofTranscriptCount: accepted.filter((r) => r.proofTranscriptEligible).length,
      rollbackCount: accepted.filter((r) => r.signalCompat.rolledBack).length,
      batchHealthScore: clamp01Compat(batchHealthScore),
      batchSeverity,
    });
  }

  // ── Domain-Specific Translate Methods ─────────────────────────────────────

  /**
   * Translate a rollback signal — always accepted, always witness-triggered.
   */
  public translateRollback(
    signalCompat: CoordinatorChatSignalCompat,
    nowMs: number,
  ): CoordinatorSignalTranslationResult {
    const forcedRollback = { ...signalCompat, rolledBack: true };
    return this.translate(forcedRollback, nowMs);
  }

  /**
   * Translate an engine execution signal with full ML/DL enrichment.
   */
  public translateEngineExec(
    signalCompat: CoordinatorChatSignalCompat,
    nowMs: number,
  ): CoordinatorSignalTranslationResult {
    const forcedKind = { ...signalCompat, operationKind: 'ENGINE_EXEC' as const };
    return this.translate(forcedKind, nowMs);
  }

  /**
   * Translate a synthetic execution signal.
   */
  public translateSyntheticExec(
    signalCompat: CoordinatorChatSignalCompat,
    nowMs: number,
  ): CoordinatorSignalTranslationResult {
    const forcedKind = {
      ...signalCompat,
      operationKind: 'SYNTHETIC_EXEC' as const,
    };
    return this.translate(forcedKind, nowMs);
  }

  /**
   * Translate an abort signal — always CRITICAL severity.
   */
  public translateAbort(
    signalCompat: CoordinatorChatSignalCompat,
    nowMs: number,
  ): CoordinatorSignalTranslationResult {
    const forcedAbort = {
      ...signalCompat,
      operationKind: 'ABORT' as const,
      severity: 'CRITICAL' as const,
      healthScore: Math.min(signalCompat.healthScore, 0.2),
    };
    return this.translate(forcedAbort, nowMs);
  }

  // ── Session Analytics ──────────────────────────────────────────────────────

  /**
   * Return the full session history of translated entries.
   */
  public getSessionHistory(): readonly CoordinatorSessionEntryCompat[] {
    return Object.freeze([...this.sessionHistory]);
  }

  /**
   * Build a trend snapshot from recent session history.
   */
  public getSessionTrend(windowSize = 12): CoordinatorTrendSnapshotCompat {
    const window = this.sessionHistory.slice(-Math.max(1, windowSize));
    const n = window.length;

    if (n === 0) {
      return Object.freeze({
        window: 0,
        avgHealthScore: 1.0,
        minHealthScore: 1.0,
        maxHealthScore: 1.0,
        rollbackRate: 0,
        skipRate: 0,
        abortRate: 0,
        severityDistribution: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
        trendDirection: 'STABLE' as const,
      });
    }

    const scores = window.map((e) => e.healthScore);
    const avgHealthScore = scores.reduce((a, b) => a + b, 0) / n;
    const severityDistribution: Record<CoordinatorSignalAdapterSeverityCompat, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    for (const e of window) severityDistribution[e.severity]++;

    const half = Math.floor(n / 2);
    const firstAvg =
      half > 0 ? scores.slice(0, half).reduce((a, b) => a + b, 0) / half : avgHealthScore;
    const secondAvg =
      half > 0 ? scores.slice(half).reduce((a, b) => a + b, 0) / (n - half) : avgHealthScore;

    const trendDirection =
      secondAvg > firstAvg + 0.05
        ? ('IMPROVING' as const)
        : secondAvg < firstAvg - 0.05
          ? ('DECLINING' as const)
          : ('STABLE' as const);

    return Object.freeze({
      window: n,
      avgHealthScore: clamp01Compat(avgHealthScore),
      minHealthScore: Math.min(...scores),
      maxHealthScore: Math.max(...scores),
      rollbackRate: window.filter((e) => e.rolledBack).length / n,
      skipRate: window.filter((e) => e.skipped).length / n,
      abortRate:
        window.filter(
          (e) => !e.rolledBack && !e.skipped && e.severity === 'CRITICAL',
        ).length / n,
      severityDistribution: Object.freeze(severityDistribution),
      trendDirection,
    });
  }

  public clearSession(): void {
    this.sessionHistory.length = 0;
    this.dedupeCache.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION M — Type Guards
// ─────────────────────────────────────────────────────────────────────────────

export function isCoordinatorSignalAdapterSeverity(
  v: unknown,
): v is CoordinatorSignalAdapterSeverityCompat {
  return v === 'LOW' || v === 'MEDIUM' || v === 'HIGH' || v === 'CRITICAL';
}

export function isCoordinatorSignalAdapterMode(
  v: unknown,
): v is CoordinatorModeCodeCompat {
  return v === 'solo' || v === 'pvp' || v === 'coop' || v === 'ghost';
}

export function isCoordinatorSignalAdapterOperationKind(
  v: unknown,
): v is CoordinatorSignalAdapterOperationKindCompat {
  return (
    v === 'ENGINE_EXEC' ||
    v === 'SYNTHETIC_EXEC' ||
    v === 'CONTEXT_CREATE' ||
    v === 'ROLLBACK' ||
    v === 'SKIP' ||
    v === 'ABORT'
  );
}

export function isRollbackSignalCompat(
  v: CoordinatorChatSignalCompat,
): boolean {
  return v.rolledBack;
}

export function isAbortSignalCompat(
  v: CoordinatorChatSignalCompat,
): boolean {
  return v.operationKind === 'ABORT' || v.severity === 'CRITICAL';
}

export function isCriticalCoordinatorSignal(
  v: CoordinatorChatSignalCompat,
): boolean {
  return v.severity === 'CRITICAL';
}

export function isWitnessTriggerCompat(
  v: CoordinatorChatSignalCompat,
): boolean {
  return v.severity === 'HIGH' || v.severity === 'CRITICAL' || v.rolledBack;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION N — Singletons and Manifest
// ─────────────────────────────────────────────────────────────────────────────

/** Default adapter — minimal, narration-enabled, solo mode. */
export const TICK_TRANSACTION_COORDINATOR_DEFAULT_SIGNAL_ADAPTER =
  new TickTransactionCoordinatorSignalAdapter({
    verbose: false,
    includeMLVector: false,
    includeDLRow: false,
    includeNarration: true,
    mode: 'solo',
    dedupeWindowTicks: 3,
  });

/** Strict adapter — verbose, all surfaces, solo mode. */
export const TICK_TRANSACTION_COORDINATOR_STRICT_SIGNAL_ADAPTER =
  new TickTransactionCoordinatorSignalAdapter({
    verbose: true,
    includeMLVector: true,
    includeDLRow: true,
    includeNarration: true,
    mode: 'solo',
    dedupeWindowTicks: 1,
    proofTranscriptThreshold: 'HIGH',
    witnessThreshold: 'MEDIUM',
  });

/** Verbose adapter — all surfaces, ghost mode narration. */
export const TICK_TRANSACTION_COORDINATOR_VERBOSE_SIGNAL_ADAPTER =
  new TickTransactionCoordinatorSignalAdapter({
    verbose: true,
    includeMLVector: true,
    includeDLRow: true,
    includeNarration: true,
    mode: 'ghost',
    dedupeWindowTicks: 0,
    proofTranscriptThreshold: 'MEDIUM',
    witnessThreshold: 'LOW',
  });

/** Module manifest for registry and diagnostics discovery. */
export const TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_MANIFEST: CoordinatorSignalAdapterManifest =
  Object.freeze({
    module: 'TickTransactionCoordinatorSignalAdapter',
    version: TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_MODULE_VERSION,
    schema: TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_SCHEMA,
    mlFeatureCount: TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
    dlTensorShape: TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_DL_TENSOR_SHAPE,
    maxBatchSize: TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_MAX_BATCH,
    stepBudgetMs: TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_STEP_BUDGET_MS,
    operationKinds: Object.freeze([
      'ENGINE_EXEC',
      'SYNTHETIC_EXEC',
      'CONTEXT_CREATE',
      'ROLLBACK',
      'SKIP',
      'ABORT',
    ]),
    severityLevels: Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    modeCodes: Object.freeze(['solo', 'pvp', 'coop', 'ghost']),
    ready: TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_READY,
  });

/** Full adapter bundle for runtime use. */
export const TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_BUNDLE = Object.freeze({
  defaultAdapter: TICK_TRANSACTION_COORDINATOR_DEFAULT_SIGNAL_ADAPTER,
  strictAdapter: TICK_TRANSACTION_COORDINATOR_STRICT_SIGNAL_ADAPTER,
  verboseAdapter: TICK_TRANSACTION_COORDINATOR_VERBOSE_SIGNAL_ADAPTER,
  manifest: TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_MANIFEST,
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION O — Per-Mode Factory
// ─────────────────────────────────────────────────────────────────────────────

/** Per-mode adapter instances for runtime dispatch. */
export const COORDINATOR_SIGNAL_ADAPTER_BY_MODE: Readonly<
  Record<CoordinatorModeCodeCompat, TickTransactionCoordinatorSignalAdapter>
> = Object.freeze({
  solo: new TickTransactionCoordinatorSignalAdapter({
    mode: 'solo',
    includeMLVector: false,
    includeDLRow: false,
    includeNarration: true,
  }),
  pvp: new TickTransactionCoordinatorSignalAdapter({
    mode: 'pvp',
    includeMLVector: true,
    includeDLRow: false,
    includeNarration: true,
    witnessThreshold: 'MEDIUM',
  }),
  coop: new TickTransactionCoordinatorSignalAdapter({
    mode: 'coop',
    includeMLVector: false,
    includeDLRow: false,
    includeNarration: true,
  }),
  ghost: new TickTransactionCoordinatorSignalAdapter({
    mode: 'ghost',
    includeMLVector: true,
    includeDLRow: true,
    includeNarration: true,
    verbose: true,
    witnessThreshold: 'LOW',
    proofTranscriptThreshold: 'MEDIUM',
  }),
});

/**
 * Resolve the correct per-mode adapter at runtime.
 */
export function getCoordinatorSignalAdapterForMode(
  mode: CoordinatorModeCodeCompat,
): TickTransactionCoordinatorSignalAdapter {
  return (
    COORDINATOR_SIGNAL_ADAPTER_BY_MODE[mode] ??
    TICK_TRANSACTION_COORDINATOR_DEFAULT_SIGNAL_ADAPTER
  );
}
