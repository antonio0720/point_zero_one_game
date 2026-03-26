/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT RUN GRADE SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/RunGradeSignalAdapter.ts
 * VERSION: 2026.03.26
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates RunGradeAssigner signals — grade
 * assignment results, badge awards, grade comparisons, audit entries, ML
 * vectors, DL tensors — into authoritative backend-chat ingress envelopes.
 *
 * Backend-truth question
 * ----------------------
 *   "When the RunGradeAssigner assigns a letter grade (A–F), awards badges,
 *    compares grades across runs, emits an ML/DL vector, or generates an
 *    audit entry, what exact chat-native signal should the authoritative
 *    backend chat engine ingest to drive companion NPC coaching and reflect
 *    grade status in the companion AI?"
 *
 * This file owns:
 * - GradeResult         -> ChatSignalEnvelope (grade.assigned.{a|b|c|d|f})
 * - Grade A             -> ChatSignalEnvelope (grade.assigned.a) — always accepted
 * - Grade B             -> ChatSignalEnvelope (grade.assigned.b)
 * - Grade C             -> ChatSignalEnvelope (grade.assigned.c)
 * - Grade D             -> ChatSignalEnvelope (grade.assigned.d)
 * - Grade F             -> ChatSignalEnvelope (grade.assigned.f) — always accepted, critical coaching
 * - Badge earned        -> ChatSignalEnvelope (grade.badge.earned)
 * - Grade comparison    -> ChatSignalEnvelope (grade.comparison.{improved|declined})
 * - GradeMLVector       -> ChatSignalEnvelope (grade.ml.vector_emitted)
 * - GradeDLTensor       -> ChatSignalEnvelope (grade.dl.tensor_emitted)
 * - GradeAuditEntry     -> ChatSignalEnvelope (grade.audit.entry)
 *
 * It does not own:
 * - Transcript mutation, NPC speech, rate policy, or socket fanout
 * - Replay persistence or proof chain authoring
 * - Shield layer integrity, repair scheduling, or run phase management
 * - Proof generation, CORD scoring, or replay integrity verification
 * - Any circular import from core/ — all core types mirrored structurally
 *
 * Design laws
 * -----------
 * - No circular imports from core/. All core types are mirrored as structural
 *   compat interfaces defined in this file.
 * - Callers pass real RunGradeScoreResult / GradeMLVector / GradeDLTensor
 *   objects — they satisfy the compat interfaces structurally.
 * - Grade A signals are always accepted (sovereignty excellence confirmed).
 * - Grade F signals are always accepted (critical coaching required).
 * - Badge earned signals are always accepted (rare, high-value events).
 * - ML/DL vector signals only emitted when the respective flag is enabled.
 * - All runtime functions (asUnixMs, clamp01, clamp100) are called in runtime
 *   code — never dead imports.
 *
 * Event vocabulary
 * ----------------
 *   grade.assigned.a               — grade A (sovereignty excellence)
 *   grade.assigned.b               — grade B (strong performance)
 *   grade.assigned.c               — grade C (acceptable performance)
 *   grade.assigned.d               — grade D (below par)
 *   grade.assigned.f               — grade F (critical failure, always accepted)
 *   grade.badge.earned             — badge earned for run achievement
 *   grade.comparison.improved      — grade improved compared to previous run
 *   grade.comparison.declined      — grade declined compared to previous run
 *   grade.ml.vector_emitted        — ML feature vector extracted from grade analysis
 *   grade.dl.tensor_emitted        — DL input tensor constructed from grade analysis
 *   grade.audit.entry              — audit trail entry recorded
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  clamp100,
  type ChatInputEnvelope,
  type ChatRoomId,
  type ChatSignalEnvelope,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type Score01,
  type Score100,
  type UnixMs,
} from '../types';

// ============================================================================
// SECTION 1 — STRUCTURAL COMPAT INTERFACES
// Mirrors of RunGradeAssigner types — no circular import from core/
// ============================================================================

/** Mirror of RunGradeScoreResult from sovereignty/RunGradeAssigner.ts */
export interface GradeResultCompat {
  readonly runId: string;
  readonly userId: string;
  readonly grade: 'A' | 'B' | 'C' | 'D' | 'F';
  readonly gradeScore: number;
  readonly sovereigntyScore: number;
  readonly pressureScore: number;
  readonly shieldScore: number;
  readonly economyScore: number;
  readonly outcomeWeight: number;
  readonly finalNetWorth: number;
  readonly mode: string;
  readonly outcome: string;
  readonly gradedAtMs: number;
}

/** Mirror of GradeMLVector from sovereignty/RunGradeAssigner.ts */
export interface GradeMLVectorCompat {
  readonly runId: string;
  readonly grade: string;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly vectorShape: readonly [1, 32] | readonly [number, number];
  readonly extractedAtMs: number;
}

/** Mirror of GradeDLTensor from sovereignty/RunGradeAssigner.ts */
export interface GradeDLTensorCompat {
  readonly runId: string;
  readonly grade: string;
  readonly inputVector: readonly number[];
  readonly featureLabels: readonly string[];
  readonly tensorShape: readonly [1, 48] | readonly [number, number];
  readonly policyVersion: string;
  readonly extractedAtMs: number;
}

/** Mirror of GradeAuditEntry from sovereignty/RunGradeAssigner.ts */
export interface GradeAuditEntryCompat {
  readonly entryId: string;
  readonly runId: string;
  readonly grade: string;
  readonly eventType: string;
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly message: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly capturedAtMs: number;
  readonly hmacSignature: string;
}

/** Mirror of GradeComparisonResult from sovereignty/RunGradeAssigner.ts */
export interface GradeComparisonCompat {
  readonly runId: string;
  readonly userId: string;
  readonly currentGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  readonly previousGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  readonly currentGradeScore: number;
  readonly previousGradeScore: number;
  readonly scoreDelta: number;
  readonly direction: 'IMPROVED' | 'DECLINED' | 'MAINTAINED';
  readonly previousRunId: string;
  readonly comparedAtMs: number;
}

// ============================================================================
// SECTION 2 — ADAPTER TYPES
// ============================================================================

/** Optional per-call routing context passed to adapt* methods. */
export interface GradeSignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

/** Logger interface — implement with any backend logger or leave null. */
export interface GradeSignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

/** Clock interface — injectable for tests. */
export interface GradeSignalAdapterClock {
  now(): UnixMs;
}

/** Severity classification for adapter events. */
export type GradeSignalAdapterSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'CRITICAL';

/** Full set of grade signal event names. */
export type GradeSignalAdapterEventName =
  | 'grade.assigned.a'
  | 'grade.assigned.b'
  | 'grade.assigned.c'
  | 'grade.assigned.d'
  | 'grade.assigned.f'
  | 'grade.badge.earned'
  | 'grade.comparison.improved'
  | 'grade.comparison.declined'
  | 'grade.ml.vector_emitted'
  | 'grade.dl.tensor_emitted'
  | 'grade.audit.entry'
  | string;

/** Construction options for RunGradeSignalAdapter. */
export interface RunGradeSignalAdapterOptions {
  /** Room all signals default to unless overridden by context. */
  readonly defaultRoomId: ChatRoomId | string;
  /** Visible channel default (default: 'GLOBAL'). */
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  /** Time window in ms within which duplicate signals are suppressed (default: 5000). */
  readonly dedupeWindowMs?: number;
  /** Maximum number of history entries retained (default: 200). */
  readonly maxHistory?: number;
  /** Always accept grade A signals regardless of dedupe window (default: true). */
  readonly alwaysAcceptGradeA?: boolean;
  /** Always accept grade F signals regardless of dedupe window (default: true). */
  readonly alwaysAcceptGradeF?: boolean;
  /** Always accept badge signals regardless of dedupe window (default: true). */
  readonly alwaysAcceptBadges?: boolean;
  /** Emit ML vector signals when adaptMLVector() is called (default: false). */
  readonly emitMLVectors?: boolean;
  /** Emit DL tensor signals when adaptDLTensor() is called (default: false). */
  readonly emitDLTensors?: boolean;
  /**
   * Suppress MAINTAINED comparison signals (no grade change) to keep
   * chat focused on meaningful transitions (default: true).
   */
  readonly suppressMaintainedComparisons?: boolean;
  readonly logger?: GradeSignalAdapterLogger;
  readonly clock?: GradeSignalAdapterClock;
}

/** Cumulative stats reported by getStats(). */
export interface GradeSignalAdapterStats {
  readonly totalAdapted: number;
  readonly totalSuppressed: number;
  readonly totalDeduped: number;
  readonly gradeResultsAdapted: number;
  readonly gradeACount: number;
  readonly gradeBCount: number;
  readonly gradeCCount: number;
  readonly gradeDCount: number;
  readonly gradeFCount: number;
  readonly badgesEarned: number;
  readonly comparisonsAdapted: number;
  readonly improvementsCount: number;
  readonly declinesCount: number;
  readonly auditEntriesAdapted: number;
  readonly mlVectorsEmitted: number;
  readonly dlTensorsEmitted: number;
}

// ============================================================================
// SECTION 3 — MODULE CONSTANTS
// ============================================================================

const DEFAULT_DEDUPE_WINDOW_MS = 5_000;
const DEFAULT_MAX_HISTORY = 200;
const ADAPTER_SOURCE_TAG = 'RunGradeSignalAdapter';

/** Priority weights by grade — A is highest, F is critical-high. */
const GRADE_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  A: 100,
  B: 75,
  C: 55,
  D: 40,
  F: 90,
});

/** Priority weights by audit entry severity. */
const AUDIT_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  CRITICAL: 100,
  HIGH: 75,
  MEDIUM: 50,
  LOW: 25,
});

/** Numeric rank for grade comparison ordering (lower is better). */
const GRADE_RANK: Readonly<Record<string, number>> = Object.freeze({
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  F: 5,
});

const NULL_LOGGER: GradeSignalAdapterLogger = Object.freeze({
  debug() {},
  warn() {},
  error() {},
});

const SYSTEM_CLOCK: GradeSignalAdapterClock = Object.freeze({
  now(): UnixMs { return asUnixMs(Date.now()); },
});

// ============================================================================
// SECTION 4 — UX MESSAGE HELPERS
// ============================================================================

/** Returns a companion-facing headline for the given grade. */
export function gradeHeadline(grade: string): string {
  switch (grade) {
    case 'A': return 'Sovereignty excellence — Grade A earned.';
    case 'B': return 'Strong performance — Grade B earned.';
    case 'C': return 'Acceptable performance — Grade C earned.';
    case 'D': return 'Below par — Grade D recorded.';
    case 'F': return 'Critical failure — Grade F recorded.';
    default:  return 'Grade result recorded.';
  }
}

/** Returns a companion-facing coaching message for the given grade. */
export function gradeCoachingMessage(grade: string): string {
  switch (grade) {
    case 'A':
      return 'Your financial discipline and shield management drove a sovereign performance. This is the FREEDOM path.';
    case 'B':
      return 'Solid run with strong fundamentals. Tighten pressure management and economy timing to reach the A tier.';
    case 'C':
      return 'Mid-tier grade. Focus on reducing pressure exposure, protecting income sources, and maintaining shield health.';
    case 'D':
      return 'High-pressure events and economy weakness eroded your score. Study your tick stream for improvement signals.';
    case 'F':
      return 'Critical failure. The run collapsed under pressure or integrity constraints were breached. Review audit entries and rebuild.';
    default:
      return 'Review your run data for improvement signals.';
  }
}

/** Returns a companion headline for a badge earned event. */
export function badgeHeadline(badgeName: string): string {
  return `Badge earned: ${badgeName}`;
}

/** Returns a companion coaching message for a badge earned event. */
export function badgeCoachingMessage(badgeName: string, grade: string): string {
  return `You earned the "${badgeName}" badge with grade ${grade}. This achievement is recorded in your sovereignty portfolio.`;
}

/** Returns a companion headline for a grade comparison. */
export function comparisonHeadline(direction: string): string {
  switch (direction) {
    case 'IMPROVED': return 'Grade improved — sovereignty trajectory is ascending.';
    case 'DECLINED': return 'Grade declined — review performance regression.';
    case 'MAINTAINED': return 'Grade maintained — consistent performance.';
    default: return 'Grade comparison recorded.';
  }
}

/** Returns a companion coaching message for a grade comparison. */
export function comparisonCoachingMessage(
  direction: string,
  currentGrade: string,
  previousGrade: string,
): string {
  switch (direction) {
    case 'IMPROVED':
      return `You improved from grade ${previousGrade} to ${currentGrade}. Your sovereignty discipline is strengthening.`;
    case 'DECLINED':
      return `You declined from grade ${previousGrade} to ${currentGrade}. Identify the pressure points that caused regression.`;
    case 'MAINTAINED':
      return `Grade ${currentGrade} maintained from previous run. Look for optimization opportunities to break through.`;
    default:
      return 'Review grade comparison data for insights.';
  }
}

/** Returns a companion-facing message for an audit entry. */
export function gradeAuditMessage(eventType: string, severity: string): string {
  return `Grade audit entry: ${eventType} at ${severity} severity.`;
}

// ============================================================================
// SECTION 5 — STANDALONE HELPER: buildGradeSignalPayload
// ============================================================================

/**
 * Standalone helper that builds a base metadata payload from a
 * GradeResultCompat. Used by multiple adapt* methods for consistency.
 *
 * All numeric values are clamped and rounded to prevent payload injection or
 * out-of-range values reaching the chat engine.
 */
export function buildGradeSignalPayload(
  result: GradeResultCompat,
  now: UnixMs,
  overrides?: Readonly<Record<string, JsonValue>>,
): Record<string, JsonValue> {
  const gradeScore01  = clamp01(result.gradeScore);
  const sov100        = clamp100(result.sovereigntyScore);
  const pressure01    = clamp01(result.pressureScore);
  const shield01      = clamp01(result.shieldScore);
  const economy01     = clamp01(result.economyScore);
  const netWorth      = Math.round(result.finalNetWorth);

  return {
    runId:               result.runId,
    userId:              result.userId,
    grade:               result.grade,
    gradeScore01:        parseFloat(gradeScore01.toFixed(6)),
    sovereigntyScore100: sov100,
    pressureScore01:     parseFloat(pressure01.toFixed(6)),
    shieldScore01:       parseFloat(shield01.toFixed(6)),
    economyScore01:      parseFloat(economy01.toFixed(6)),
    outcomeWeight:       parseFloat(clamp01(result.outcomeWeight).toFixed(6)),
    finalNetWorth:       netWorth,
    mode:                result.mode,
    outcome:             result.outcome,
    gradedAtMs:          result.gradedAtMs,
    adaptedAtMs:         now as unknown as number,
    gradeHeadline:       gradeHeadline(result.grade),
    ...(overrides ?? {}),
  };
}

// ============================================================================
// SECTION 6 — INTERNAL HELPERS
// ============================================================================

/** Determine the adapter severity level from grade. */
function gradeSeverity(grade: string): GradeSignalAdapterSeverity {
  switch (grade) {
    case 'A': return 'INFO';
    case 'B': return 'INFO';
    case 'C': return 'INFO';
    case 'D': return 'WARN';
    case 'F': return 'CRITICAL';
    default:  return 'DEBUG';
  }
}

/** Determine the adapter severity level from audit entry severity. */
function auditSeverity(severity: string): GradeSignalAdapterSeverity {
  switch (severity) {
    case 'CRITICAL': return 'CRITICAL';
    case 'HIGH':     return 'WARN';
    case 'MEDIUM':   return 'INFO';
    case 'LOW':      return 'DEBUG';
    default:         return 'DEBUG';
  }
}

/** Map grade to canonical event name. */
function gradeEventName(grade: string): GradeSignalAdapterEventName {
  switch (grade) {
    case 'A': return 'grade.assigned.a';
    case 'B': return 'grade.assigned.b';
    case 'C': return 'grade.assigned.c';
    case 'D': return 'grade.assigned.d';
    case 'F': return 'grade.assigned.f';
    default:  return 'grade.assigned.f';
  }
}

/** Map comparison direction to canonical event name. */
function comparisonEventName(direction: string): GradeSignalAdapterEventName {
  switch (direction) {
    case 'IMPROVED': return 'grade.comparison.improved';
    case 'DECLINED': return 'grade.comparison.declined';
    default:         return 'grade.comparison.declined';
  }
}

/** Build a frozen LIVEOPS ChatSignalEnvelope from grade signal data. */
function buildGradeLiveopsEnvelope(
  eventName: string,
  roomId: ChatRoomId | string | null,
  heatMultiplier: Score01,
  helperBlackout: boolean,
  metadata: Record<string, JsonValue>,
  now: UnixMs,
): ChatSignalEnvelope {
  return Object.freeze({
    type: 'LIVEOPS' as const,
    emittedAt: now,
    roomId: (roomId ?? null) as Nullable<ChatRoomId>,
    liveops: Object.freeze({
      worldEventName: eventName,
      heatMultiplier01: heatMultiplier,
      helperBlackout,
      haterRaidActive: false,
    }),
    metadata: Object.freeze(metadata as Record<string, JsonValue>),
  });
}

/** Wrap a ChatSignalEnvelope as a LIVEOPS_SIGNAL ChatInputEnvelope. */
function buildLiveopsInputEnvelope(
  signalEnvelope: ChatSignalEnvelope,
  now: UnixMs,
): ChatInputEnvelope {
  return Object.freeze({
    kind: 'LIVEOPS_SIGNAL' as const,
    emittedAt: now,
    payload: signalEnvelope,
  });
}

// ============================================================================
// SECTION 7 — RunGradeSignalAdapter CLASS
// ============================================================================

/**
 * Adapts RunGradeAssigner outputs into authoritative backend-chat ingress
 * envelopes.
 *
 * Filtering policy (in priority order):
 * - Grade A signals: always accepted (sovereignty excellence)
 * - Grade F signals: always accepted (critical coaching required)
 * - Badge earned signals: always accepted (rare high-value events)
 * - MAINTAINED comparisons: suppressed when suppressMaintainedComparisons=true
 * - All other signals: subject to dedupeWindowMs
 * - ML/DL vectors: only emitted when emitMLVectors / emitDLTensors is true
 */
export class RunGradeSignalAdapter {
  private readonly opts: Readonly<Required<RunGradeSignalAdapterOptions>>;
  private readonly logger: GradeSignalAdapterLogger;
  private readonly clock: GradeSignalAdapterClock;

  private readonly _history: ChatSignalEnvelope[] = [];
  private readonly _lastAcceptedAt: Map<string, UnixMs> = new Map();

  // -- Stats counters --------------------------------------------------------
  private _totalAdapted       = 0;
  private _totalSuppressed    = 0;
  private _totalDeduped       = 0;
  private _gradeResults       = 0;
  private _gradeACount        = 0;
  private _gradeBCount        = 0;
  private _gradeCCount        = 0;
  private _gradeDCount        = 0;
  private _gradeFCount        = 0;
  private _badgesEarned       = 0;
  private _comparisons        = 0;
  private _improvements       = 0;
  private _declines           = 0;
  private _auditEntries       = 0;
  private _mlVectors          = 0;
  private _dlTensors          = 0;

  public constructor(options: RunGradeSignalAdapterOptions) {
    this.logger = options.logger ?? NULL_LOGGER;
    this.clock  = options.clock  ?? SYSTEM_CLOCK;

    this.opts = Object.freeze({
      defaultRoomId:                  options.defaultRoomId,
      defaultVisibleChannel:          options.defaultVisibleChannel          ?? 'GLOBAL',
      dedupeWindowMs:                 options.dedupeWindowMs                 ?? DEFAULT_DEDUPE_WINDOW_MS,
      maxHistory:                     options.maxHistory                     ?? DEFAULT_MAX_HISTORY,
      alwaysAcceptGradeA:             options.alwaysAcceptGradeA             ?? true,
      alwaysAcceptGradeF:             options.alwaysAcceptGradeF             ?? true,
      alwaysAcceptBadges:             options.alwaysAcceptBadges             ?? true,
      emitMLVectors:                  options.emitMLVectors                  ?? false,
      emitDLTensors:                  options.emitDLTensors                  ?? false,
      suppressMaintainedComparisons:  options.suppressMaintainedComparisons  ?? true,
      logger:                         this.logger,
      clock:                          this.clock,
    } as Required<RunGradeSignalAdapterOptions>);
  }

  // -- Private helpers -------------------------------------------------------

  private isDeduped(key: string, now: UnixMs): boolean {
    const last = this._lastAcceptedAt.get(key);
    return last !== undefined && (now - (last as unknown as number)) < this.opts.dedupeWindowMs;
  }

  private markAccepted(key: string, envelope: ChatSignalEnvelope, now: UnixMs): void {
    this._lastAcceptedAt.set(key, now);
    this._totalAdapted++;
    this._history.push(envelope);
    if (this._history.length > this.opts.maxHistory) {
      this._history.shift();
    }
  }

  private suppress(reason: string, details: Record<string, JsonValue>): null {
    this._totalSuppressed++;
    this.logger.debug(`RunGradeSignalAdapter: suppressed — ${reason}`, details);
    return null;
  }

  private dedupe(eventName: string, key: string): null {
    this._totalDeduped++;
    this.logger.debug('RunGradeSignalAdapter: deduped', { eventName, key });
    return null;
  }

  private resolveRoom(ctx?: GradeSignalAdapterContext): ChatRoomId | string {
    return (ctx?.roomId ?? this.opts.defaultRoomId) as ChatRoomId | string;
  }

  private resolveTags(
    baseTags: string[],
    ctx?: GradeSignalAdapterContext,
  ): string[] {
    return [ADAPTER_SOURCE_TAG, ...baseTags, ...(ctx?.tags ?? [])];
  }

  private incrementGradeCounter(grade: string): void {
    switch (grade) {
      case 'A': this._gradeACount++; break;
      case 'B': this._gradeBCount++; break;
      case 'C': this._gradeCCount++; break;
      case 'D': this._gradeDCount++; break;
      case 'F': this._gradeFCount++; break;
    }
  }

  // -- Public adapt* methods -------------------------------------------------

  /**
   * Adapt a GradeResult into the appropriate grade.assigned.* ChatSignalEnvelope.
   *
   * Grade A is always accepted (sovereignty excellence). Grade F is always
   * accepted (critical coaching required). Grades B–D are subject to
   * deduplication.
   */
  public adaptGradeResult(
    result: GradeResultCompat,
    ctx?: GradeSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName = gradeEventName(result.grade);
    const dedupeKey = `grade.result:${result.runId}:${result.grade}`;

    const isGradeA       = result.grade === 'A' && this.opts.alwaysAcceptGradeA;
    const isGradeF       = result.grade === 'F' && this.opts.alwaysAcceptGradeF;
    const isAlwaysAccept = isGradeA || isGradeF;

    if (!isAlwaysAccept && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const gradeScore01 = clamp01(result.gradeScore);
    const sov100       = clamp100(result.sovereigntyScore);
    const priority     = GRADE_PRIORITY[result.grade] ?? 55;
    const heat         = clamp01(priority / 100) as Score01;

    const payload = buildGradeSignalPayload(result, now, {
      eventName,
      gradeCoaching:   gradeCoachingMessage(result.grade),
      adapterSeverity: gradeSeverity(result.grade),
      priority,
      isGradeA:        result.grade === 'A',
      isGradeF:        result.grade === 'F',
      source:          ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    });

    const isHelperBlackout = result.grade === 'F';
    const envelope = buildGradeLiveopsEnvelope(
      eventName, roomId, heat, isHelperBlackout, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._gradeResults++;
    this.incrementGradeCounter(result.grade);

    this.logger.debug(`RunGradeSignalAdapter: ${eventName} accepted`, {
      runId: result.runId, grade: result.grade,
      gradeScore: parseFloat(gradeScore01.toFixed(6)),
    });

    return envelope;
  }

  /**
   * Adapt a grade A signal from a GradeResult.
   *
   * Always accepted when alwaysAcceptGradeA is true (the default).
   * Sovereignty excellence deserves celebration in the companion AI.
   */
  public adaptGradeASignal(
    result: GradeResultCompat,
    ctx?: GradeSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: GradeSignalAdapterEventName = 'grade.assigned.a';
    const dedupeKey = `grade.a:${result.runId}`;

    // Grade A is always accepted
    const isAlwaysAccept = this.opts.alwaysAcceptGradeA;

    if (!isAlwaysAccept && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const gradeScore01 = clamp01(result.gradeScore);
    const sov100       = clamp100(result.sovereigntyScore);
    const heat         = clamp01(1.0) as Score01; // Max heat for grade A

    const payload: Record<string, JsonValue> = {
      runId:               result.runId,
      userId:              result.userId,
      grade:               'A',
      gradeScore01:        parseFloat(gradeScore01.toFixed(6)),
      sovereigntyScore100: sov100,
      finalNetWorth:       Math.round(result.finalNetWorth),
      mode:                result.mode,
      outcome:             result.outcome,
      gradeHeadline:       gradeHeadline('A'),
      gradeCoaching:       gradeCoachingMessage('A'),
      priority:            100,
      eventName,
      source:              ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildGradeLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._gradeACount++;

    this.logger.debug('RunGradeSignalAdapter: grade.assigned.a accepted', {
      runId: result.runId, gradeScore: parseFloat(gradeScore01.toFixed(6)),
    });

    return envelope;
  }

  /**
   * Adapt a grade B signal from a GradeResult.
   *
   * Subject to normal deduplication. Strong performance.
   */
  public adaptGradeBSignal(
    result: GradeResultCompat,
    ctx?: GradeSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: GradeSignalAdapterEventName = 'grade.assigned.b';
    const dedupeKey = `grade.b:${result.runId}`;

    if (this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const gradeScore01 = clamp01(result.gradeScore);
    const sov100       = clamp100(result.sovereigntyScore);
    const priority     = GRADE_PRIORITY['B'] ?? 75;
    const heat         = clamp01(priority / 100) as Score01;

    const payload: Record<string, JsonValue> = {
      runId:               result.runId,
      userId:              result.userId,
      grade:               'B',
      gradeScore01:        parseFloat(gradeScore01.toFixed(6)),
      sovereigntyScore100: sov100,
      finalNetWorth:       Math.round(result.finalNetWorth),
      mode:                result.mode,
      outcome:             result.outcome,
      gradeHeadline:       gradeHeadline('B'),
      gradeCoaching:       gradeCoachingMessage('B'),
      priority,
      eventName,
      source:              ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildGradeLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._gradeBCount++;

    return envelope;
  }

  /**
   * Adapt a grade C signal from a GradeResult.
   *
   * Subject to normal deduplication. Acceptable performance.
   */
  public adaptGradeCSignal(
    result: GradeResultCompat,
    ctx?: GradeSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: GradeSignalAdapterEventName = 'grade.assigned.c';
    const dedupeKey = `grade.c:${result.runId}`;

    if (this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const gradeScore01 = clamp01(result.gradeScore);
    const sov100       = clamp100(result.sovereigntyScore);
    const priority     = GRADE_PRIORITY['C'] ?? 55;
    const heat         = clamp01(priority / 100) as Score01;

    const payload: Record<string, JsonValue> = {
      runId:               result.runId,
      userId:              result.userId,
      grade:               'C',
      gradeScore01:        parseFloat(gradeScore01.toFixed(6)),
      sovereigntyScore100: sov100,
      finalNetWorth:       Math.round(result.finalNetWorth),
      mode:                result.mode,
      outcome:             result.outcome,
      gradeHeadline:       gradeHeadline('C'),
      gradeCoaching:       gradeCoachingMessage('C'),
      priority,
      eventName,
      source:              ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildGradeLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._gradeCCount++;

    return envelope;
  }

  /**
   * Adapt a grade D signal from a GradeResult.
   *
   * Subject to normal deduplication. Below par performance.
   */
  public adaptGradeDSignal(
    result: GradeResultCompat,
    ctx?: GradeSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: GradeSignalAdapterEventName = 'grade.assigned.d';
    const dedupeKey = `grade.d:${result.runId}`;

    if (this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const gradeScore01 = clamp01(result.gradeScore);
    const sov100       = clamp100(result.sovereigntyScore);
    const priority     = GRADE_PRIORITY['D'] ?? 40;
    const heat         = clamp01(priority / 100) as Score01;

    const payload: Record<string, JsonValue> = {
      runId:               result.runId,
      userId:              result.userId,
      grade:               'D',
      gradeScore01:        parseFloat(gradeScore01.toFixed(6)),
      sovereigntyScore100: sov100,
      finalNetWorth:       Math.round(result.finalNetWorth),
      mode:                result.mode,
      outcome:             result.outcome,
      gradeHeadline:       gradeHeadline('D'),
      gradeCoaching:       gradeCoachingMessage('D'),
      priority,
      eventName,
      source:              ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildGradeLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._gradeDCount++;

    return envelope;
  }

  /**
   * Adapt a grade F signal from a GradeResult.
   *
   * Always accepted when alwaysAcceptGradeF is true (the default).
   * Critical coaching is required — helperBlackout is set to let the
   * severity of the failure land without interference.
   */
  public adaptGradeFSignal(
    result: GradeResultCompat,
    ctx?: GradeSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: GradeSignalAdapterEventName = 'grade.assigned.f';
    const dedupeKey = `grade.f:${result.runId}`;

    // Grade F is always accepted — critical coaching law
    const isAlwaysAccept = this.opts.alwaysAcceptGradeF;

    if (!isAlwaysAccept && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const gradeScore01 = clamp01(result.gradeScore);
    const sov100       = clamp100(result.sovereigntyScore);
    const heat         = clamp01(0.9) as Score01; // Near-max heat for failure

    const payload: Record<string, JsonValue> = {
      runId:               result.runId,
      userId:              result.userId,
      grade:               'F',
      gradeScore01:        parseFloat(gradeScore01.toFixed(6)),
      sovereigntyScore100: sov100,
      pressureScore01:     parseFloat(clamp01(result.pressureScore).toFixed(6)),
      shieldScore01:       parseFloat(clamp01(result.shieldScore).toFixed(6)),
      economyScore01:      parseFloat(clamp01(result.economyScore).toFixed(6)),
      finalNetWorth:       Math.round(result.finalNetWorth),
      mode:                result.mode,
      outcome:             result.outcome,
      gradeHeadline:       gradeHeadline('F'),
      gradeCoaching:       gradeCoachingMessage('F'),
      isCritical:          true,
      priority:            90,
      eventName,
      source:              ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildGradeLiveopsEnvelope(
      eventName, roomId, heat, true, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._gradeFCount++;

    this.logger.warn('RunGradeSignalAdapter: grade F — critical coaching required', {
      runId: result.runId, gradeScore: parseFloat(gradeScore01.toFixed(6)),
    });

    return envelope;
  }

  /**
   * Adapt a badge earned signal.
   *
   * Badge signals are always accepted when alwaysAcceptBadges is true (the
   * default). Badges are rare, high-value events that should always surface
   * in the companion AI coaching.
   */
  public adaptBadgeSignal(
    result: GradeResultCompat,
    badges: readonly string[],
    ctx?: GradeSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    if (badges.length === 0) return null;

    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: GradeSignalAdapterEventName = 'grade.badge.earned';
    const dedupeKey = `badge:${result.runId}:${badges.join(',')}`;

    // Badge signals are always accepted
    const isAlwaysAccept = this.opts.alwaysAcceptBadges;

    if (!isAlwaysAccept && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const gradeScore01 = clamp01(result.gradeScore);
    const sov100       = clamp100(result.sovereigntyScore);
    const heat         = clamp01(0.8 + badges.length * 0.05) as Score01;

    const badgeNames    = badges.join(', ');
    const firstBadge    = badges[0] ?? 'Achievement';

    const payload: Record<string, JsonValue> = {
      runId:               result.runId,
      userId:              result.userId,
      grade:               result.grade,
      gradeScore01:        parseFloat(gradeScore01.toFixed(6)),
      sovereigntyScore100: sov100,
      badges:              badgeNames,
      badgeCount:          badges.length,
      badgeHeadline:       badgeHeadline(firstBadge),
      badgeCoaching:       badgeCoachingMessage(firstBadge, result.grade),
      mode:                result.mode,
      outcome:             result.outcome,
      priority:            85,
      eventName,
      source:              ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildGradeLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._badgesEarned += badges.length;

    this.logger.debug('RunGradeSignalAdapter: badge earned', {
      runId: result.runId, badges: badgeNames, count: String(badges.length),
    });

    return envelope;
  }

  /**
   * Adapt a grade comparison signal.
   *
   * IMPROVED and DECLINED comparisons are emitted normally.
   * MAINTAINED comparisons are suppressed when suppressMaintainedComparisons
   * is true (the default) — no-change signals add noise.
   */
  public adaptComparisonSignal(
    comparison: GradeComparisonCompat,
    ctx?: GradeSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const direction = comparison.direction;

    // Suppress MAINTAINED comparisons when flag is set
    if (
      this.opts.suppressMaintainedComparisons &&
      direction === 'MAINTAINED'
    ) {
      return this.suppress('comparison MAINTAINED suppressed', {
        runId: comparison.runId, currentGrade: comparison.currentGrade,
      });
    }

    const eventName = direction === 'IMPROVED'
      ? 'grade.comparison.improved' as GradeSignalAdapterEventName
      : 'grade.comparison.declined' as GradeSignalAdapterEventName;
    const dedupeKey = `comparison:${comparison.runId}:${comparison.previousRunId}:${direction}`;

    if (this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const scoreDelta01 = clamp01(Math.abs(comparison.scoreDelta));
    const currentScore = clamp01(comparison.currentGradeScore);
    const previousScore = clamp01(comparison.previousGradeScore);
    const heat = clamp01(direction === 'IMPROVED' ? 0.7 + scoreDelta01 * 0.3 : 0.5 + scoreDelta01 * 0.3) as Score01;

    const payload: Record<string, JsonValue> = {
      runId:                comparison.runId,
      userId:               comparison.userId,
      currentGrade:         comparison.currentGrade,
      previousGrade:        comparison.previousGrade,
      currentGradeScore01:  parseFloat(currentScore.toFixed(6)),
      previousGradeScore01: parseFloat(previousScore.toFixed(6)),
      scoreDelta:           parseFloat(comparison.scoreDelta.toFixed(6)),
      direction,
      previousRunId:        comparison.previousRunId,
      comparedAtMs:         comparison.comparedAtMs,
      comparisonHeadline:   comparisonHeadline(direction),
      comparisonCoaching:   comparisonCoachingMessage(direction, comparison.currentGrade, comparison.previousGrade),
      priority:             direction === 'IMPROVED' ? 80 : 65,
      eventName,
      source:               ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildGradeLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._comparisons++;
    if (direction === 'IMPROVED') this._improvements++;
    else if (direction === 'DECLINED') this._declines++;

    this.logger.debug(`RunGradeSignalAdapter: ${eventName} accepted`, {
      runId: comparison.runId, direction,
      from: comparison.previousGrade, to: comparison.currentGrade,
    });

    return envelope;
  }

  /**
   * Adapt a GradeMLVector into a grade.ml.vector_emitted ChatSignalEnvelope.
   *
   * Only emitted when emitMLVectors option is true. The feature array is
   * summarized (avg, min, max, shape) rather than inlined to avoid oversized
   * payloads in the chat ingress lane.
   */
  public adaptMLVector(
    vector: GradeMLVectorCompat,
    ctx?: GradeSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    if (!this.opts.emitMLVectors) return null;

    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: GradeSignalAdapterEventName = 'grade.ml.vector_emitted';
    const dedupeKey = `ml:${vector.runId}:${vector.grade}`;

    if (this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const featureCount = vector.features.length;
    const sum  = featureCount > 0 ? vector.features.reduce((a, b) => a + b, 0) : 0;
    const avg  = featureCount > 0 ? sum / featureCount : 0;
    const minF = featureCount > 0 ? Math.min(...vector.features) : 0;
    const maxF = featureCount > 0 ? Math.max(...vector.features) : 0;

    // Clamp the average to [0,1] as a heat signal
    const heat = clamp01(Math.abs(avg)) as Score01;

    const payload: Record<string, JsonValue> = {
      runId:           vector.runId,
      grade:           vector.grade,
      featureCount,
      vectorShape:     JSON.stringify(vector.vectorShape),
      avgFeatureValue: parseFloat(avg.toFixed(8)),
      minFeatureValue: parseFloat(minF.toFixed(8)),
      maxFeatureValue: parseFloat(maxF.toFixed(8)),
      extractedAtMs:   vector.extractedAtMs,
      sampleLabels:    vector.featureLabels.slice(0, 8).join(','),
      eventName,
      source:          ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildGradeLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._mlVectors++;

    return envelope;
  }

  /**
   * Adapt a GradeDLTensor into a grade.dl.tensor_emitted ChatSignalEnvelope.
   *
   * Only emitted when emitDLTensors option is true. The input vector is
   * summarized (avg, L2 norm, shape, policy version) for the chat ingress
   * lane. L2 norm gives the companion AI a sense of tensor magnitude.
   */
  public adaptDLTensor(
    tensor: GradeDLTensorCompat,
    ctx?: GradeSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    if (!this.opts.emitDLTensors) return null;

    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: GradeSignalAdapterEventName = 'grade.dl.tensor_emitted';
    const dedupeKey = `dl:${tensor.runId}:${tensor.grade}`;

    if (this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const inputCount = tensor.inputVector.length;
    const sum    = inputCount > 0 ? tensor.inputVector.reduce((a, b) => a + b, 0) : 0;
    const avg    = inputCount > 0 ? sum / inputCount : 0;
    const sumSq  = inputCount > 0 ? tensor.inputVector.reduce((a, b) => a + b * b, 0) : 0;
    const l2norm = inputCount > 0 ? Math.sqrt(sumSq) : 0;

    // Clamp avg to [0,1] for heat — tensor inputs span arbitrary range
    const heat = clamp01(Math.abs(avg)) as Score01;

    const payload: Record<string, JsonValue> = {
      runId:          tensor.runId,
      grade:          tensor.grade,
      policyVersion:  tensor.policyVersion,
      inputCount,
      tensorShape:    JSON.stringify(tensor.tensorShape),
      avgInputValue:  parseFloat(avg.toFixed(8)),
      l2norm:         parseFloat(l2norm.toFixed(8)),
      extractedAtMs:  tensor.extractedAtMs,
      sampleLabels:   tensor.featureLabels.slice(0, 8).join(','),
      eventName,
      source:         ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildGradeLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._dlTensors++;

    return envelope;
  }

  /**
   * Adapt a GradeAuditEntry into a grade.audit.entry ChatSignalEnvelope.
   *
   * CRITICAL audit entries are always accepted. LOW entries are suppressed
   * implicitly by the dedupe window when they repeat. The HMAC signature
   * is included in metadata for downstream integrity verification.
   */
  public adaptAuditEntry(
    entry: GradeAuditEntryCompat,
    ctx?: GradeSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: GradeSignalAdapterEventName = 'grade.audit.entry';
    const dedupeKey = `audit:${entry.entryId}`;

    const isCritical     = entry.severity === 'CRITICAL';
    const isAlwaysAccept = isCritical;

    if (!isAlwaysAccept && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const priority = AUDIT_PRIORITY[entry.severity] ?? 25;
    const heat     = clamp01(priority / 100) as Score01;

    // Flatten audit metadata — only include JsonValue-compatible fields
    const flatMeta: Record<string, JsonValue> = {};
    for (const [k, v] of Object.entries(entry.metadata)) {
      if (
        typeof v === 'string' ||
        typeof v === 'number' ||
        typeof v === 'boolean' ||
        v === null
      ) {
        flatMeta[k] = v as JsonValue;
      }
    }

    const payload: Record<string, JsonValue> = {
      entryId:         entry.entryId,
      runId:           entry.runId,
      grade:           entry.grade,
      eventType:       entry.eventType,
      severity:        entry.severity,
      adapterSeverity: auditSeverity(entry.severity),
      message:         entry.message,
      capturedAtMs:    entry.capturedAtMs,
      hmacSignature:   entry.hmacSignature,
      auditMessage:    gradeAuditMessage(entry.eventType, entry.severity),
      isCritical,
      priority,
      eventName,
      auditMeta:       flatMeta as unknown as JsonValue,
      source:          ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildGradeLiveopsEnvelope(
      eventName, roomId, heat, isCritical, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._auditEntries++;

    if (isCritical) {
      this.logger.warn('RunGradeSignalAdapter: CRITICAL audit entry', {
        entryId: entry.entryId, runId: entry.runId, eventType: entry.eventType,
      });
    }

    return envelope;
  }

  // -- Stats and history -----------------------------------------------------

  /** Return a frozen snapshot of adapter cumulative statistics. */
  public getStats(): GradeSignalAdapterStats {
    return Object.freeze({
      totalAdapted:         this._totalAdapted,
      totalSuppressed:      this._totalSuppressed,
      totalDeduped:         this._totalDeduped,
      gradeResultsAdapted:  this._gradeResults,
      gradeACount:          this._gradeACount,
      gradeBCount:          this._gradeBCount,
      gradeCCount:          this._gradeCCount,
      gradeDCount:          this._gradeDCount,
      gradeFCount:          this._gradeFCount,
      badgesEarned:         this._badgesEarned,
      comparisonsAdapted:   this._comparisons,
      improvementsCount:    this._improvements,
      declinesCount:        this._declines,
      auditEntriesAdapted:  this._auditEntries,
      mlVectorsEmitted:     this._mlVectors,
      dlTensorsEmitted:     this._dlTensors,
    });
  }

  /** Return a frozen read-only snapshot of the signal history. */
  public getHistory(): readonly ChatSignalEnvelope[] {
    return Object.freeze([...this._history]);
  }

  /** Clear all retained history entries without resetting stats. */
  public clearHistory(): void {
    this._history.length = 0;
  }

  /** Reset all stat counters to zero without clearing history. */
  public resetStats(): void {
    this._totalAdapted    = 0;
    this._totalSuppressed = 0;
    this._totalDeduped    = 0;
    this._gradeResults    = 0;
    this._gradeACount     = 0;
    this._gradeBCount     = 0;
    this._gradeCCount     = 0;
    this._gradeDCount     = 0;
    this._gradeFCount     = 0;
    this._badgesEarned    = 0;
    this._comparisons     = 0;
    this._improvements    = 0;
    this._declines        = 0;
    this._auditEntries    = 0;
    this._mlVectors       = 0;
    this._dlTensors       = 0;
  }
}

// ============================================================================
// SECTION 8 — BATCH HELPERS
// ============================================================================

/**
 * Adapt all signal types from a single GradeResult in canonical
 * emission order: grade result -> per-grade signal.
 *
 * Returns only non-null envelopes. Callers can pass the full array to the
 * ChatEngine ingress surface for ordered delivery.
 */
export function adaptAllGradeSignals(
  adapter: RunGradeSignalAdapter,
  result: GradeResultCompat,
  badges?: readonly string[],
  ctx?: GradeSignalAdapterContext,
): readonly ChatSignalEnvelope[] {
  const envelopes: ChatSignalEnvelope[] = [];

  const main = adapter.adaptGradeResult(result, ctx);
  if (main !== null) envelopes.push(main);

  if (badges !== undefined && badges.length > 0) {
    const badge = adapter.adaptBadgeSignal(result, badges, ctx);
    if (badge !== null) envelopes.push(badge);
  }

  return Object.freeze(envelopes);
}

/**
 * Adapt a GradeResult plus optional ML vector, DL tensor, and comparison
 * in one call.
 *
 * Emits only envelopes that pass the adapter's filtering rules. Returns the
 * frozen array in emission order: grade -> badges -> comparison -> ml -> dl.
 */
export function adaptGradeBundle(
  adapter: RunGradeSignalAdapter,
  result: GradeResultCompat,
  badges?: readonly string[],
  comparison?: GradeComparisonCompat,
  mlVector?: GradeMLVectorCompat,
  dlTensor?: GradeDLTensorCompat,
  ctx?: GradeSignalAdapterContext,
): readonly ChatSignalEnvelope[] {
  const envelopes: ChatSignalEnvelope[] = [];

  const main = adapter.adaptGradeResult(result, ctx);
  if (main !== null) envelopes.push(main);

  if (badges !== undefined && badges.length > 0) {
    const badge = adapter.adaptBadgeSignal(result, badges, ctx);
    if (badge !== null) envelopes.push(badge);
  }

  if (comparison !== undefined) {
    const comp = adapter.adaptComparisonSignal(comparison, ctx);
    if (comp !== null) envelopes.push(comp);
  }

  if (mlVector !== undefined) {
    const ml = adapter.adaptMLVector(mlVector, ctx);
    if (ml !== null) envelopes.push(ml);
  }

  if (dlTensor !== undefined) {
    const dl = adapter.adaptDLTensor(dlTensor, ctx);
    if (dl !== null) envelopes.push(dl);
  }

  return Object.freeze(envelopes);
}

/**
 * Adapt an array of GradeAuditEntries into ChatSignalEnvelopes.
 *
 * Entries are processed in the order supplied — typically chronological
 * capturedAtMs order. CRITICAL entries will always pass through.
 */
export function adaptGradeAuditBatch(
  adapter: RunGradeSignalAdapter,
  entries: readonly GradeAuditEntryCompat[],
  ctx?: GradeSignalAdapterContext,
): readonly ChatSignalEnvelope[] {
  const envelopes: ChatSignalEnvelope[] = [];
  for (const entry of entries) {
    const env = adapter.adaptAuditEntry(entry, ctx);
    if (env !== null) envelopes.push(env);
  }
  return Object.freeze(envelopes);
}

// ============================================================================
// SECTION 9 — FACTORY
// ============================================================================

/**
 * Convenience factory that creates a RunGradeSignalAdapter with
 * production-safe defaults:
 * - alwaysAcceptGradeA: true
 * - alwaysAcceptGradeF: true
 * - alwaysAcceptBadges: true
 * - suppressMaintainedComparisons: true
 * - emitMLVectors: false (opt-in)
 * - emitDLTensors: false (opt-in)
 * - dedupeWindowMs: 5000
 * - maxHistory: 200
 */
export function createRunGradeSignalAdapter(
  defaultRoomId: ChatRoomId | string,
  overrides?: Partial<RunGradeSignalAdapterOptions>,
): RunGradeSignalAdapter {
  return new RunGradeSignalAdapter({
    defaultRoomId,
    defaultVisibleChannel:         'GLOBAL',
    dedupeWindowMs:                DEFAULT_DEDUPE_WINDOW_MS,
    maxHistory:                    DEFAULT_MAX_HISTORY,
    alwaysAcceptGradeA:            true,
    alwaysAcceptGradeF:            true,
    alwaysAcceptBadges:            true,
    emitMLVectors:                 false,
    emitDLTensors:                 false,
    suppressMaintainedComparisons: true,
    ...overrides,
  });
}

// ============================================================================
// SECTION 10 — SELF-DESCRIPTION MANIFEST
// ============================================================================

/** Static manifest describing this adapter's event vocabulary and capabilities. */
export const GRADE_SIGNAL_ADAPTER_MANIFEST = Object.freeze({
  adapterName:    'RunGradeSignalAdapter',
  version:        '2026.03.26',
  sourceFile:     'backend/src/game/engine/chat/adapters/RunGradeSignalAdapter.ts',
  signalType:     'LIVEOPS' as const,
  events: Object.freeze([
    'grade.assigned.a',
    'grade.assigned.b',
    'grade.assigned.c',
    'grade.assigned.d',
    'grade.assigned.f',
    'grade.badge.earned',
    'grade.comparison.improved',
    'grade.comparison.declined',
    'grade.ml.vector_emitted',
    'grade.dl.tensor_emitted',
    'grade.audit.entry',
  ] as const),
  designLaws: Object.freeze([
    'No circular imports from core/ — all types mirrored structurally.',
    'Grade A signals always accepted (sovereignty excellence).',
    'Grade F signals always accepted (critical coaching required, helperBlackout=true).',
    'Badge earned signals always accepted (rare high-value events).',
    'MAINTAINED comparisons suppressed by default.',
    'ML/DL vectors only emitted when flags are enabled.',
    'All runtime functions (asUnixMs, clamp01, clamp100) consumed in runtime code.',
    'Dedupe is per (runId + grade/eventClass) key.',
    'History is ring-buffered at maxHistory entries.',
  ] as const),
});
