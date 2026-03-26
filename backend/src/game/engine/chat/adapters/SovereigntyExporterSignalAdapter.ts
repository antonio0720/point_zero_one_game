/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT SOVEREIGNTY EXPORTER SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/SovereigntyExporterSignalAdapter.ts
 * VERSION: 2026.03.26
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates SovereigntyExporter pipeline signals —
 * pipeline completion results, proof sealing, grade assignment, artifact building,
 * ML/DL vectors, audit entries, and batch pipeline events — into authoritative
 * backend-chat ingress envelopes.
 *
 * Backend-truth question
 * ----------------------
 *   "When the SovereigntyExporter pipeline completes a run, seals a proof,
 *    assigns a grade, builds an artifact, emits an ML/DL vector, records an
 *    audit entry, or finishes a batch pipeline, what exact chat-native signal
 *    should the authoritative backend chat engine ingest to drive companion
 *    NPC coaching and reflect exporter status in the companion AI?"
 *
 * This file owns:
 * - Pipeline complete   → ChatSignalEnvelope (exporter.pipeline.complete)
 * - Proof sealed        → ChatSignalEnvelope (exporter.proof.sealed)
 * - Grade assigned      → ChatSignalEnvelope (exporter.grade.assigned)
 * - Artifact built      → ChatSignalEnvelope (exporter.artifact.built)
 * - ML vector emitted   → ChatSignalEnvelope (exporter.ml.vector_emitted)
 * - DL tensor emitted   → ChatSignalEnvelope (exporter.dl.tensor_emitted)
 * - Audit entry         → ChatSignalEnvelope (exporter.audit.entry)
 *
 * It does not own:
 * - Transcript mutation, NPC speech, rate policy, or socket fanout
 * - Replay persistence or proof chain authoring
 * - Shield layer integrity, repair scheduling, or run phase management
 * - Proof generation, CORD scoring, or replay integrity verification
 * - Grade assignment or badge management (owned by RunGradeAssigner)
 * - Any circular import from core/ — all core types mirrored structurally
 *
 * Design laws
 * -----------
 * - No circular imports from core/. All core types are mirrored as structural
 *   compat interfaces defined in this file.
 * - Callers pass real ExporterPipelineResult / ExporterMLVector /
 *   ExporterDLTensor / ExporterAuditEntry objects — they satisfy the compat
 *   interfaces structurally.
 * - Proof sealed signals are always accepted (high-value milestone).
 * - Audit entry signals with CRITICAL-equivalent severity are always accepted.
 * - ML/DL vector signals only emitted when the respective flag is enabled.
 * - All runtime functions (asUnixMs, clamp01, clamp100) are called in runtime
 *   code — never dead imports.
 *
 * Event vocabulary
 * ----------------
 *   exporter.pipeline.complete    — exporter pipeline finished processing
 *   exporter.proof.sealed         — proof hash sealed and stamped
 *   exporter.grade.assigned       — sovereignty grade assigned to run
 *   exporter.artifact.built       — export artifact constructed
 *   exporter.ml.vector_emitted    — ML feature vector (32-dim) extracted
 *   exporter.dl.tensor_emitted    — DL input tensor (48-dim) constructed
 *   exporter.audit.entry          — audit trail entry recorded
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  clamp100,
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
// Mirrors of SovereigntyExporter types — no circular import from core/
// ============================================================================

/** Mirror of ExporterPipelineResult from sovereignty/SovereigntyExporter.ts */
export interface ExporterPipelineResultCompat {
  readonly pipelineId: string;
  readonly runId: string;
  readonly userId: string;
  readonly mode: string;
  readonly outcome: 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';
  readonly proofHash: string;
  readonly grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  readonly integrityStatus: 'PENDING' | 'VERIFIED' | 'QUARANTINED' | 'UNVERIFIED';
  readonly sovereigntyScore: number;
  readonly cordScore: number;
  readonly finalNetWorth: number;
  readonly ticksSurvived: number;
  readonly badgeTier: string;
  readonly exportFormats: readonly ('JSON' | 'PDF' | 'PNG')[];
  readonly artifactCount: number;
  readonly pipelineDurationMs: number;
  readonly startedAtMs: number;
  readonly completedAtMs: number;
  readonly checksum: string;
}

/** Mirror of ExporterMLVector from sovereignty/SovereigntyExporter.ts */
export interface ExporterMLVectorCompat {
  readonly runId: string;
  readonly pipelineId: string;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly dimensionality: number;
  readonly checksum: string;
  readonly extractedAtMs: number;
}

/** Mirror of ExporterDLTensor from sovereignty/SovereigntyExporter.ts */
export interface ExporterDLTensorCompat {
  readonly runId: string;
  readonly pipelineId: string;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly dimensionality: number;
  readonly checksum: string;
  readonly shape: readonly [number, number];
  readonly policyVersion: string;
  readonly extractedAtMs: number;
}

/** Mirror of ExporterAuditEntry from sovereignty/SovereigntyExporter.ts */
export interface ExporterAuditEntryCompat {
  readonly entryId: string;
  readonly pipelineId: string;
  readonly runId: string;
  readonly eventType: string;
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly message: string;
  readonly integrityStatus: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly hmacSignature: string;
  readonly capturedAtMs: number;
}

// ============================================================================
// SECTION 2 — ADAPTER TYPES
// ============================================================================

/** Optional per-call routing context passed to adapt* methods. */
export interface ExporterSignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

/** Logger interface — implement with any backend logger or leave null. */
export interface ExporterSignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

/** Clock interface — injectable for tests. */
export interface ExporterSignalAdapterClock {
  now(): UnixMs;
}

/** Severity classification for adapter events. */
export type ExporterSignalAdapterSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'CRITICAL';

/** Full set of exporter signal event names. */
export type ExporterSignalAdapterEventName =
  | 'exporter.pipeline.complete'
  | 'exporter.proof.sealed'
  | 'exporter.grade.assigned'
  | 'exporter.artifact.built'
  | 'exporter.ml.vector_emitted'
  | 'exporter.dl.tensor_emitted'
  | 'exporter.audit.entry'
  | string;

/** Construction options for SovereigntyExporterSignalAdapter. */
export interface SovereigntyExporterSignalAdapterOptions {
  /** Room all signals default to unless overridden by context. */
  readonly defaultRoomId: ChatRoomId | string;
  /** Visible channel default (default: 'GLOBAL'). */
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  /** Time window in ms within which duplicate signals are suppressed (default: 5000). */
  readonly dedupeWindowMs?: number;
  /** Maximum number of history entries retained (default: 200). */
  readonly maxHistory?: number;
  /** Always accept proof sealed signals regardless of dedupe window (default: true). */
  readonly alwaysAcceptProofSealed?: boolean;
  /** Always accept grade A/S pipeline results regardless of dedupe window (default: true). */
  readonly alwaysAcceptHighGrade?: boolean;
  /** Always accept critical audit entries regardless of dedupe window (default: true). */
  readonly alwaysAcceptCriticalAudit?: boolean;
  /** Suppress LOW priority signals to keep chat focused (default: true). */
  readonly suppressLowPrioritySignals?: boolean;
  /** Emit ML vector signals when adaptMLVector() is called (default: false). */
  readonly emitMLVectors?: boolean;
  /** Emit DL tensor signals when adaptDLTensor() is called (default: false). */
  readonly emitDLTensors?: boolean;
  /**
   * Sovereignty score at or above this threshold is treated as high-value and
   * the pipeline completion signal gets boosted priority (default: 80).
   */
  readonly highSovereigntyThreshold?: number;
  /**
   * CORD score at or above this threshold triggers high-interest acceptance
   * (default: 0.85).
   */
  readonly cordScoreAlertThreshold?: number;
  readonly logger?: ExporterSignalAdapterLogger;
  readonly clock?: ExporterSignalAdapterClock;
}

/** Cumulative stats reported by getStats(). */
export interface ExporterSignalAdapterStats {
  readonly totalAdapted: number;
  readonly totalSuppressed: number;
  readonly totalDeduped: number;
  readonly pipelinesAdapted: number;
  readonly proofsSealed: number;
  readonly gradesAssigned: number;
  readonly artifactsBuilt: number;
  readonly auditEntriesAdapted: number;
  readonly mlVectorsEmitted: number;
  readonly dlTensorsEmitted: number;
  readonly highGradeCount: number;
  readonly criticalAuditCount: number;
  readonly freedomOutcomeCount: number;
}

// ============================================================================
// SECTION 3 — MODULE CONSTANTS
// ============================================================================

const DEFAULT_DEDUPE_WINDOW_MS = 5_000;
const DEFAULT_MAX_HISTORY = 200;
const DEFAULT_HIGH_SOVEREIGNTY_THRESHOLD = 80;
const DEFAULT_CORD_ALERT_THRESHOLD = 0.85;
const ADAPTER_SOURCE_TAG = 'SovereigntyExporterSignalAdapter';

/** Priority weights by grade — used to assign envelope priority value. */
const GRADE_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  S: 100,
  A: 95,
  B: 75,
  C: 55,
  D: 40,
  F: 85,
});

/** Priority weights by integrity status. */
const INTEGRITY_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  QUARANTINED: 100,
  VERIFIED:    60,
  UNVERIFIED:  40,
  PENDING:     20,
});

/** Priority weights by audit severity. */
const AUDIT_SEVERITY_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  CRITICAL: 100,
  HIGH:     75,
  MEDIUM:   50,
  LOW:      25,
});

/** Priority weights by outcome. */
const OUTCOME_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  FREEDOM:   90,
  TIMEOUT:   50,
  BANKRUPT:  80,
  ABANDONED: 30,
});

/** Priority weights by badge tier. */
const BADGE_TIER_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  LEGENDARY: 100,
  EPIC:       85,
  RARE:       70,
  COMMON:     50,
  NONE:       30,
});

const NULL_LOGGER: ExporterSignalAdapterLogger = Object.freeze({
  debug() {},
  warn() {},
  error() {},
});

const SYSTEM_CLOCK: ExporterSignalAdapterClock = Object.freeze({
  now(): UnixMs { return asUnixMs(Date.now()); },
});

// ============================================================================
// SECTION 4 — UX MESSAGE HELPERS
// ============================================================================

/** Returns a companion-facing headline for pipeline completion. */
export function pipelineCompleteHeadline(outcome: string, grade: string): string {
  return `Exporter pipeline complete — Grade ${grade}, outcome: ${outcome}.`;
}

/** Returns a coaching message for pipeline completion. */
export function pipelineCoachingMessage(outcome: string, grade: string, sovereigntyScore: number): string {
  const scorePct = Math.round(sovereigntyScore);
  if (outcome === 'FREEDOM') {
    return `Pipeline sealed a FREEDOM proof at Grade ${grade}, ${scorePct}% sovereignty. Financial independence confirmed.`;
  }
  if (grade === 'S' || grade === 'A') {
    return `Grade ${grade} pipeline complete at ${scorePct}% sovereignty. This is the path of financial freedom.`;
  }
  if (grade === 'B' || grade === 'C') {
    return `Pipeline finished at Grade ${grade}, ${scorePct}% sovereignty. Focus on shield management and income protection.`;
  }
  return `Pipeline recorded at Grade ${grade}, ${scorePct}% sovereignty. Analyze pressure exposure and economy timing.`;
}

/** Returns a companion-facing headline for proof sealing. */
export function proofSealedHeadline(grade: string): string {
  switch (grade) {
    case 'S': return 'Proof sealed — supreme sovereignty confirmed.';
    case 'A': return 'Proof sealed — excellence verified.';
    case 'B': return 'Proof sealed — strong sovereignty standing.';
    case 'C': return 'Proof sealed — room to grow your sovereignty score.';
    case 'D': return 'Proof sealed — sovereignty performance was below par.';
    case 'F': return 'Proof sealed — sovereignty threshold not met.';
    default:  return 'Proof sealed — result recorded.';
  }
}

/** Returns a coaching message for proof sealing. */
export function proofSealedCoachingMessage(grade: string, cordScore: number): string {
  const cordFmt = cordScore.toFixed(3);
  if (grade === 'S' || grade === 'A') {
    return `Proof sealed at Grade ${grade} with CORD ${cordFmt}. Your financial discipline drove a clean sovereign proof.`;
  }
  if (grade === 'B' || grade === 'C') {
    return `Proof sealed at Grade ${grade}, CORD ${cordFmt}. Tighten your shield management to reach the top tier.`;
  }
  return `Proof sealed at Grade ${grade}, CORD ${cordFmt}. Study your tick stream for improvement signals.`;
}

/** Returns a companion-facing headline for grade assignment. */
export function gradeAssignedHeadline(grade: string): string {
  return `Sovereignty grade assigned — Grade ${grade}.`;
}

/** Returns a coaching message for grade assignment. */
export function gradeAssignedCoachingMessage(grade: string, sovereigntyScore: number): string {
  const scorePct = Math.round(sovereigntyScore);
  switch (grade) {
    case 'S': return `Supreme Grade S at ${scorePct}% sovereignty. Peak financial discipline achieved.`;
    case 'A': return `Grade A at ${scorePct}% sovereignty. Excellence confirmed — keep this trajectory.`;
    case 'B': return `Grade B at ${scorePct}% sovereignty. Strong performance — close the gap to A tier.`;
    case 'C': return `Grade C at ${scorePct}% sovereignty. Acceptable, but income protection needs tightening.`;
    case 'D': return `Grade D at ${scorePct}% sovereignty. Below par — review pressure exposure patterns.`;
    case 'F': return `Grade F at ${scorePct}% sovereignty. Critical failure — review audit trail and economy timing.`;
    default:  return `Grade result at ${scorePct}% sovereignty.`;
  }
}

/** Returns a companion-facing headline for artifact building. */
export function artifactBuiltHeadline(format: string): string {
  switch (format) {
    case 'JSON': return 'Export artifact built — JSON data file constructed.';
    case 'PDF':  return 'Export artifact built — PDF proof document constructed.';
    case 'PNG':  return 'Export artifact built — PNG visual card constructed.';
    default:     return 'Export artifact built.';
  }
}

/** Returns a coaching message for artifact building. */
export function artifactBuiltCoachingMessage(format: string, grade: string): string {
  switch (format) {
    case 'JSON':
      return `JSON artifact built for Grade ${grade} run. This data file captures your full sovereignty run.`;
    case 'PDF':
      return `PDF proof document built for Grade ${grade} run. Share this to verify your sovereignty standing.`;
    case 'PNG':
      return `PNG visual card built for Grade ${grade} run. Display your sovereignty achievement.`;
    default:
      return `Artifact built for Grade ${grade} run.`;
  }
}

/** Returns a companion headline for an audit entry. */
export function auditEntryHeadline(severity: string, eventType: string): string {
  return `Exporter audit recorded — ${severity} severity, event: ${eventType}.`;
}

/** Returns a coaching message for a critical audit entry. */
export function criticalAuditCoachingMessage(eventType: string): string {
  return `CRITICAL audit entry detected during export pipeline: ${eventType}. Proof integrity may be compromised.`;
}

// ============================================================================
// SECTION 5 — STANDALONE HELPER: buildExporterPipelinePayload
// ============================================================================

/**
 * Standalone helper that builds a base metadata payload from an
 * ExporterPipelineResultCompat. Used by multiple adapt* methods for consistency.
 *
 * All numeric values are clamped and rounded to prevent payload injection or
 * out-of-range values reaching the chat engine.
 */
export function buildExporterPipelinePayload(
  result: ExporterPipelineResultCompat,
  now: UnixMs,
  overrides?: Readonly<Record<string, JsonValue>>,
): Record<string, JsonValue> {
  const cord01   = clamp01(result.cordScore);
  const sov100   = clamp100(result.sovereigntyScore);
  const netWorth = Math.round(result.finalNetWorth);

  return {
    pipelineId:            result.pipelineId,
    runId:                 result.runId,
    userId:                result.userId,
    proofHash:             result.proofHash,
    mode:                  result.mode,
    outcome:               result.outcome,
    grade:                 result.grade,
    integrityStatus:       result.integrityStatus,
    badgeTier:             result.badgeTier,
    cordScore01:           parseFloat(cord01.toFixed(6)),
    sovereigntyScore100:   sov100,
    finalNetWorth:         netWorth,
    ticksSurvived:         result.ticksSurvived,
    artifactCount:         result.artifactCount,
    exportFormats:         result.exportFormats as unknown as JsonValue,
    pipelineDurationMs:    result.pipelineDurationMs,
    checksum:              result.checksum,
    startedAtMs:           result.startedAtMs,
    completedAtMs:         result.completedAtMs,
    adaptedAtMs:           now as unknown as number,
    pipelineHeadline:      pipelineCompleteHeadline(result.outcome, result.grade),
    pipelineCoaching:      pipelineCoachingMessage(result.outcome, result.grade, result.sovereigntyScore),
    ...(overrides ?? {}),
  };
}

// ============================================================================
// SECTION 6 — INTERNAL HELPERS
// ============================================================================

/** Determine the adapter severity level from pipeline grade. */
function gradeSeverity(grade: string): ExporterSignalAdapterSeverity {
  switch (grade) {
    case 'S': return 'INFO';
    case 'A': return 'INFO';
    case 'B': return 'INFO';
    case 'C': return 'INFO';
    case 'D': return 'WARN';
    case 'F': return 'CRITICAL';
    default:  return 'DEBUG';
  }
}

/** Determine the adapter severity from an audit entry's severity. */
function auditSeverity(severity: string): ExporterSignalAdapterSeverity {
  switch (severity) {
    case 'CRITICAL': return 'CRITICAL';
    case 'HIGH':     return 'WARN';
    case 'MEDIUM':   return 'INFO';
    case 'LOW':      return 'DEBUG';
    default:         return 'DEBUG';
  }
}

/** Compute heat multiplier for a pipeline result based on grade and outcome. */
function pipelineHeat(grade: string, outcome: string): Score01 {
  const gradeWeight   = (GRADE_PRIORITY[grade] ?? 50) / 100;
  const outcomeWeight = (OUTCOME_PRIORITY[outcome] ?? 40) / 100;
  return clamp01(gradeWeight * 0.6 + outcomeWeight * 0.4);
}

/** Compute heat multiplier for a proof sealing based on grade. */
function proofSealedHeat(grade: string): Score01 {
  const gradeWeight = (GRADE_PRIORITY[grade] ?? 50) / 100;
  return clamp01(gradeWeight * 0.8 + 0.2);
}

/** Compute heat multiplier for grade assignment. */
function gradeAssignedHeat(grade: string, sovereigntyScore: number): Score01 {
  const gradeWeight = (GRADE_PRIORITY[grade] ?? 50) / 100;
  const sovFactor   = clamp01(sovereigntyScore / 100);
  return clamp01(gradeWeight * 0.7 + (sovFactor as unknown as number) * 0.3);
}

/** Compute heat multiplier for an artifact build event. */
function artifactBuiltHeat(grade: string, badgeTier: string): Score01 {
  const gradeWeight = (GRADE_PRIORITY[grade] ?? 50) / 100;
  const badgeWeight = (BADGE_TIER_PRIORITY[badgeTier] ?? 40) / 100;
  return clamp01(gradeWeight * 0.6 + badgeWeight * 0.4);
}

/** Build a frozen LIVEOPS ChatSignalEnvelope from exporter signal data. */
function buildExporterLiveopsEnvelope(
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

// ============================================================================
// SECTION 7 — SovereigntyExporterSignalAdapter CLASS
// ============================================================================

/**
 * Adapts SovereigntyExporter pipeline outputs into authoritative backend-chat
 * ingress envelopes.
 *
 * Filtering policy (in priority order):
 * - Proof sealed signals: always accepted (alwaysAcceptProofSealed)
 * - Grade A/S pipeline results and FREEDOM outcomes: always accepted (alwaysAcceptHighGrade)
 * - Critical audit entries: always accepted (alwaysAcceptCriticalAudit)
 * - LOW priority signals: suppressed when suppressLowPrioritySignals=true
 * - All other signals: subject to dedupeWindowMs
 * - ML/DL vectors: only emitted when emitMLVectors / emitDLTensors is true
 */
export class SovereigntyExporterSignalAdapter {
  private readonly opts: Readonly<Required<SovereigntyExporterSignalAdapterOptions>>;
  private readonly logger: ExporterSignalAdapterLogger;
  private readonly clock: ExporterSignalAdapterClock;

  private readonly _history: ChatSignalEnvelope[] = [];
  private readonly _lastAcceptedAt: Map<string, UnixMs> = new Map();

  // ── Stats counters ─────────────────────────────────────────────────────────
  private _totalAdapted       = 0;
  private _totalSuppressed    = 0;
  private _totalDeduped       = 0;
  private _pipelinesAdapted   = 0;
  private _proofsSealed       = 0;
  private _gradesAssigned     = 0;
  private _artifactsBuilt     = 0;
  private _auditEntries       = 0;
  private _mlVectors          = 0;
  private _dlTensors          = 0;
  private _highGradeCount     = 0;
  private _criticalAuditCount = 0;
  private _freedomOutcomes    = 0;

  public constructor(options: SovereigntyExporterSignalAdapterOptions) {
    this.logger = options.logger ?? NULL_LOGGER;
    this.clock  = options.clock  ?? SYSTEM_CLOCK;

    this.opts = Object.freeze({
      defaultRoomId:             options.defaultRoomId,
      defaultVisibleChannel:     options.defaultVisibleChannel      ?? 'GLOBAL',
      dedupeWindowMs:            options.dedupeWindowMs             ?? DEFAULT_DEDUPE_WINDOW_MS,
      maxHistory:                options.maxHistory                 ?? DEFAULT_MAX_HISTORY,
      alwaysAcceptProofSealed:   options.alwaysAcceptProofSealed    ?? true,
      alwaysAcceptHighGrade:     options.alwaysAcceptHighGrade      ?? true,
      alwaysAcceptCriticalAudit: options.alwaysAcceptCriticalAudit  ?? true,
      suppressLowPrioritySignals: options.suppressLowPrioritySignals ?? true,
      emitMLVectors:             options.emitMLVectors              ?? false,
      emitDLTensors:             options.emitDLTensors              ?? false,
      highSovereigntyThreshold:  options.highSovereigntyThreshold   ?? DEFAULT_HIGH_SOVEREIGNTY_THRESHOLD,
      cordScoreAlertThreshold:   options.cordScoreAlertThreshold    ?? DEFAULT_CORD_ALERT_THRESHOLD,
      logger:                    this.logger,
      clock:                     this.clock,
    } as Required<SovereigntyExporterSignalAdapterOptions>);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

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
    this.logger.debug(`SovereigntyExporterSignalAdapter: suppressed — ${reason}`, details);
    return null;
  }

  private dedupe(eventName: string, key: string): null {
    this._totalDeduped++;
    this.logger.debug('SovereigntyExporterSignalAdapter: deduped', { eventName, key });
    return null;
  }

  private resolveRoom(ctx?: ExporterSignalAdapterContext): ChatRoomId | string {
    return (ctx?.roomId ?? this.opts.defaultRoomId) as ChatRoomId | string;
  }

  private resolveTags(
    baseTags: string[],
    ctx?: ExporterSignalAdapterContext,
  ): string[] {
    return [ADAPTER_SOURCE_TAG, ...baseTags, ...(ctx?.tags ?? [])];
  }

  // ── Public adapt* methods ───────────────────────────────────────────────────

  /**
   * Adapt an ExporterPipelineResult into an exporter.pipeline.complete
   * ChatSignalEnvelope.
   *
   * Always accepted for grade A/S and FREEDOM outcomes. Deduped otherwise.
   * High sovereignty scores (>= threshold) boost priority. The pipeline
   * completion signal is the primary event for a completed exporter run.
   */
  public adaptExportPipeline(
    result: ExporterPipelineResultCompat,
    ctx?: ExporterSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: ExporterSignalAdapterEventName = 'exporter.pipeline.complete';
    const dedupeKey = `exporter.pipeline:${result.runId}:${result.pipelineId}`;

    // Always-accept rules
    const isHighGrade    = (result.grade === 'A' || result.grade === 'S') && this.opts.alwaysAcceptHighGrade;
    const isFreedom      = result.outcome === 'FREEDOM' && this.opts.alwaysAcceptHighGrade;
    const isAlwaysAccept = isHighGrade || isFreedom;

    if (!isAlwaysAccept && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const cord01   = clamp01(result.cordScore);
    const sov100   = clamp100(result.sovereigntyScore);
    const heat     = pipelineHeat(result.grade, result.outcome);
    const isHighSov = sov100 >= this.opts.highSovereigntyThreshold;
    const basePriority = GRADE_PRIORITY[result.grade] ?? 55;

    const payload = buildExporterPipelinePayload(result, now, {
      eventName,
      channel:             (ctx?.routeChannel ?? this.opts.defaultVisibleChannel) as unknown as string,
      priority:            isHighSov ? Math.min(basePriority + 10, 100) : basePriority,
      adapterSeverity:     gradeSeverity(result.grade),
      isHighGrade:         result.grade === 'A' || result.grade === 'S',
      isHighSovereignty:   isHighSov,
      source:              ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:                this.resolveTags(['pipeline', result.outcome.toLowerCase()], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    });

    const isGradeF = result.grade === 'F';
    const envelope = buildExporterLiveopsEnvelope(
      eventName, roomId, heat, isGradeF, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._pipelinesAdapted++;
    if (result.grade === 'A' || result.grade === 'S') this._highGradeCount++;
    if (result.outcome === 'FREEDOM') this._freedomOutcomes++;

    this.logger.debug('SovereigntyExporterSignalAdapter: exporter.pipeline.complete accepted', {
      runId: result.runId, pipelineId: result.pipelineId, grade: result.grade, outcome: result.outcome,
    });

    return envelope;
  }

  /**
   * Adapt a proof sealing event from an ExporterPipelineResult into an
   * exporter.proof.sealed ChatSignalEnvelope.
   *
   * Always accepted when alwaysAcceptProofSealed is true (the default) — proof
   * sealing is a high-value milestone that deserves companion coaching.
   * Sets helperBlackout=true when integrity is QUARANTINED to let the severity
   * land without companion NPC interference.
   */
  public adaptProofSealed(
    result: ExporterPipelineResultCompat,
    ctx?: ExporterSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: ExporterSignalAdapterEventName = 'exporter.proof.sealed';
    const dedupeKey = `exporter.proof:${result.runId}:${result.proofHash}`;

    const isAlwaysAccept = this.opts.alwaysAcceptProofSealed;

    if (!isAlwaysAccept && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const cord01   = clamp01(result.cordScore);
    const sov100   = clamp100(result.sovereigntyScore);
    const heat     = proofSealedHeat(result.grade);
    const isQuarantined = result.integrityStatus === 'QUARANTINED';

    const payload: Record<string, JsonValue> = {
      pipelineId:            result.pipelineId,
      runId:                 result.runId,
      userId:                result.userId,
      proofHash:             result.proofHash,
      grade:                 result.grade,
      outcome:               result.outcome,
      integrityStatus:       result.integrityStatus,
      cordScore01:           parseFloat(cord01.toFixed(6)),
      sovereigntyScore100:   sov100,
      finalNetWorth:         Math.round(result.finalNetWorth),
      ticksSurvived:         result.ticksSurvived,
      badgeTier:             result.badgeTier,
      checksum:              result.checksum,
      completedAtMs:         result.completedAtMs,
      adaptedAtMs:           now as unknown as number,
      eventName,
      channel:               (ctx?.routeChannel ?? this.opts.defaultVisibleChannel) as unknown as string,
      priority:              GRADE_PRIORITY[result.grade] ?? 55,
      proofSealedHeadline:   proofSealedHeadline(result.grade),
      proofSealedCoaching:   proofSealedCoachingMessage(result.grade, result.cordScore),
      adapterSeverity:       gradeSeverity(result.grade),
      isQuarantined,
      source:                ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:                  this.resolveTags(['proof', result.grade.toLowerCase()], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildExporterLiveopsEnvelope(
      eventName, roomId, heat, isQuarantined, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._proofsSealed++;

    this.logger.debug('SovereigntyExporterSignalAdapter: exporter.proof.sealed accepted', {
      runId: result.runId, proofHash: result.proofHash, grade: result.grade,
    });

    return envelope;
  }

  /**
   * Adapt a grade assignment event from an ExporterPipelineResult into an
   * exporter.grade.assigned ChatSignalEnvelope.
   *
   * Grade A/S is always accepted when alwaysAcceptHighGrade is true.
   * Grades B-F are subject to deduplication. Grade F is never suppressed
   * because it signals critical failure.
   */
  public adaptGradeAssigned(
    result: ExporterPipelineResultCompat,
    ctx?: ExporterSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: ExporterSignalAdapterEventName = 'exporter.grade.assigned';
    const dedupeKey = `exporter.grade:${result.runId}:${result.grade}`;

    const isHighGrade    = (result.grade === 'A' || result.grade === 'S') && this.opts.alwaysAcceptHighGrade;
    const isAlwaysAccept = isHighGrade;

    if (!isAlwaysAccept && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const cord01   = clamp01(result.cordScore);
    const sov100   = clamp100(result.sovereigntyScore);
    const heat     = gradeAssignedHeat(result.grade, result.sovereigntyScore);
    const priority = GRADE_PRIORITY[result.grade] ?? 55;

    const payload: Record<string, JsonValue> = {
      pipelineId:            result.pipelineId,
      runId:                 result.runId,
      userId:                result.userId,
      proofHash:             result.proofHash,
      grade:                 result.grade,
      outcome:               result.outcome,
      integrityStatus:       result.integrityStatus,
      cordScore01:           parseFloat(cord01.toFixed(6)),
      sovereigntyScore100:   sov100,
      finalNetWorth:         Math.round(result.finalNetWorth),
      badgeTier:             result.badgeTier,
      adaptedAtMs:           now as unknown as number,
      eventName,
      channel:               (ctx?.routeChannel ?? this.opts.defaultVisibleChannel) as unknown as string,
      priority,
      gradeHeadline:         gradeAssignedHeadline(result.grade),
      gradeCoaching:         gradeAssignedCoachingMessage(result.grade, result.sovereigntyScore),
      adapterSeverity:       gradeSeverity(result.grade),
      source:                ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:                  this.resolveTags(['grade', result.grade.toLowerCase()], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };

    const isGradeF = result.grade === 'F';
    const envelope = buildExporterLiveopsEnvelope(
      eventName, roomId, heat, isGradeF, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._gradesAssigned++;
    if (result.grade === 'A' || result.grade === 'S') this._highGradeCount++;

    this.logger.debug('SovereigntyExporterSignalAdapter: exporter.grade.assigned accepted', {
      runId: result.runId, grade: result.grade, sovereigntyScore: sov100 as unknown as number,
    });

    return envelope;
  }

  /**
   * Adapt an artifact build event from an ExporterPipelineResult into an
   * exporter.artifact.built ChatSignalEnvelope.
   *
   * One envelope per format is emitted. High sovereignty scores boost priority.
   * Subject to normal deduplication unless grade A/S.
   */
  public adaptArtifactBuilt(
    result: ExporterPipelineResultCompat,
    format: 'JSON' | 'PDF' | 'PNG',
    ctx?: ExporterSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: ExporterSignalAdapterEventName = 'exporter.artifact.built';
    const dedupeKey = `exporter.artifact:${result.runId}:${result.pipelineId}:${format}`;

    const isHighGrade    = (result.grade === 'A' || result.grade === 'S') && this.opts.alwaysAcceptHighGrade;
    const isAlwaysAccept = isHighGrade;

    if (!isAlwaysAccept && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const sov100   = clamp100(result.sovereigntyScore);
    const heat     = artifactBuiltHeat(result.grade, result.badgeTier);
    const isHighSov = sov100 >= this.opts.highSovereigntyThreshold;
    const basePriority = GRADE_PRIORITY[result.grade] ?? 55;

    const payload: Record<string, JsonValue> = {
      pipelineId:            result.pipelineId,
      runId:                 result.runId,
      userId:                result.userId,
      proofHash:             result.proofHash,
      format,
      grade:                 result.grade,
      outcome:               result.outcome,
      badgeTier:             result.badgeTier,
      integrityStatus:       result.integrityStatus,
      sovereigntyScore100:   sov100,
      finalNetWorth:         Math.round(result.finalNetWorth),
      checksum:              result.checksum,
      adaptedAtMs:           now as unknown as number,
      eventName,
      channel:               (ctx?.routeChannel ?? this.opts.defaultVisibleChannel) as unknown as string,
      priority:              isHighSov ? Math.min(basePriority + 10, 100) : basePriority,
      artifactHeadline:      artifactBuiltHeadline(format),
      artifactCoaching:      artifactBuiltCoachingMessage(format, result.grade),
      adapterSeverity:       gradeSeverity(result.grade),
      isHighSovereignty:     isHighSov,
      source:                ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:                  this.resolveTags(['artifact', format.toLowerCase()], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };

    const isGradeF = result.grade === 'F';
    const envelope = buildExporterLiveopsEnvelope(
      eventName, roomId, heat, isGradeF, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._artifactsBuilt++;
    if (result.grade === 'A' || result.grade === 'S') this._highGradeCount++;

    this.logger.debug('SovereigntyExporterSignalAdapter: exporter.artifact.built accepted', {
      runId: result.runId, format, grade: result.grade,
    });

    return envelope;
  }

  /**
   * Adapt an ExporterMLVector into an exporter.ml.vector_emitted ChatSignalEnvelope.
   *
   * Gated — only emitted when emitMLVectors is true. ML vectors are diagnostic
   * signals for offline analytics and model training, not for companion coaching.
   * The feature array is summarized (avg, min, max, shape) rather than inlined
   * to avoid oversized payloads in the chat ingress lane.
   */
  public adaptMLVector(
    vector: ExporterMLVectorCompat,
    ctx?: ExporterSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    if (!this.opts.emitMLVectors) {
      return this.suppress('ML vectors disabled', { dimensionality: vector.dimensionality });
    }

    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: ExporterSignalAdapterEventName = 'exporter.ml.vector_emitted';
    const dedupeKey = `exporter.ml.vector:${vector.runId}:${vector.checksum}`;

    if (this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const featureCount = vector.features.length;
    const sum  = featureCount > 0 ? vector.features.reduce((a, b) => a + b, 0) : 0;
    const avg  = featureCount > 0 ? sum / featureCount : 0;
    const minF = featureCount > 0 ? Math.min(...vector.features) : 0;
    const maxF = featureCount > 0 ? Math.max(...vector.features) : 0;

    // Clamp the average to [0,1] as a heat signal — feature values may exceed unit range
    const heat = clamp01(Math.abs(avg)) as Score01;

    const payload: Record<string, JsonValue> = {
      runId:              vector.runId,
      pipelineId:         vector.pipelineId,
      featureCount,
      dimensionality:     vector.dimensionality,
      avgFeatureValue:    parseFloat(avg.toFixed(8)),
      minFeatureValue:    parseFloat(minF.toFixed(8)),
      maxFeatureValue:    parseFloat(maxF.toFixed(8)),
      checksum:           vector.checksum,
      extractedAtMs:      vector.extractedAtMs,
      adaptedAtMs:        now as unknown as number,
      sampleLabels:       vector.featureLabels.slice(0, 8).join(','),
      eventName,
      channel:            (ctx?.routeChannel ?? this.opts.defaultVisibleChannel) as unknown as string,
      priority:           30,
      source:             ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:               this.resolveTags(['ml', 'vector'], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildExporterLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._mlVectors++;

    this.logger.debug('SovereigntyExporterSignalAdapter: exporter.ml.vector_emitted accepted', {
      runId: vector.runId, dimensionality: vector.dimensionality, featureCount,
    });

    return envelope;
  }

  /**
   * Adapt an ExporterDLTensor into an exporter.dl.tensor_emitted ChatSignalEnvelope.
   *
   * Gated — only emitted when emitDLTensors is true. DL tensors are deep-learning
   * input vectors for offline model training, not for companion coaching.
   * L2 norm is computed to give the companion AI a sense of tensor magnitude.
   */
  public adaptDLTensor(
    tensor: ExporterDLTensorCompat,
    ctx?: ExporterSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    if (!this.opts.emitDLTensors) {
      return this.suppress('DL tensors disabled', { dimensionality: tensor.dimensionality });
    }

    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: ExporterSignalAdapterEventName = 'exporter.dl.tensor_emitted';
    const dedupeKey = `exporter.dl.tensor:${tensor.runId}:${tensor.checksum}`;

    if (this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const inputCount = tensor.features.length;
    const sum    = inputCount > 0 ? tensor.features.reduce((a, b) => a + b, 0) : 0;
    const avg    = inputCount > 0 ? sum / inputCount : 0;
    const sumSq  = inputCount > 0 ? tensor.features.reduce((a, b) => a + b * b, 0) : 0;
    const l2norm = inputCount > 0 ? Math.sqrt(sumSq) : 0;

    // Clamp avg to [0,1] for heat — tensor inputs span arbitrary range
    const heat = clamp01(Math.abs(avg)) as Score01;

    const payload: Record<string, JsonValue> = {
      runId:              tensor.runId,
      pipelineId:         tensor.pipelineId,
      policyVersion:      tensor.policyVersion,
      inputCount,
      dimensionality:     tensor.dimensionality,
      tensorShape:        JSON.stringify(tensor.shape),
      avgInputValue:      parseFloat(avg.toFixed(8)),
      l2norm:             parseFloat(l2norm.toFixed(8)),
      checksum:           tensor.checksum,
      extractedAtMs:      tensor.extractedAtMs,
      adaptedAtMs:        now as unknown as number,
      sampleLabels:       tensor.featureLabels.slice(0, 8).join(','),
      eventName,
      channel:            (ctx?.routeChannel ?? this.opts.defaultVisibleChannel) as unknown as string,
      priority:           25,
      source:             ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:               this.resolveTags(['dl', 'tensor'], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildExporterLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._dlTensors++;

    this.logger.debug('SovereigntyExporterSignalAdapter: exporter.dl.tensor_emitted accepted', {
      runId: tensor.runId, dimensionality: tensor.dimensionality, inputCount,
    });

    return envelope;
  }

  /**
   * Adapt an ExporterAuditEntry into an exporter.audit.entry ChatSignalEnvelope.
   *
   * CRITICAL audit entries are always accepted when alwaysAcceptCriticalAudit is
   * true. LOW entries are suppressed when suppressLowPrioritySignals is true.
   * All other entries are subject to deduplication.
   *
   * The HMAC signature is included in metadata for downstream integrity
   * verification — it is not displayed to the player.
   */
  public adaptAuditEntry(
    entry: ExporterAuditEntryCompat,
    ctx?: ExporterSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: ExporterSignalAdapterEventName = 'exporter.audit.entry';
    const dedupeKey = `exporter.audit:${entry.entryId}`;

    const isCritical     = entry.severity === 'CRITICAL';
    const isAlwaysAccept = isCritical && this.opts.alwaysAcceptCriticalAudit;

    // Suppress LOW audit signals
    if (
      !isAlwaysAccept &&
      this.opts.suppressLowPrioritySignals &&
      entry.severity === 'LOW'
    ) {
      return this.suppress('audit LOW suppressed', {
        entryId: entry.entryId, runId: entry.runId, eventType: entry.eventType,
      });
    }

    if (!isAlwaysAccept && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const priority = AUDIT_SEVERITY_PRIORITY[entry.severity] ?? 25;
    const heat     = clamp01(priority / 100) as Score01;
    const severity = auditSeverity(entry.severity);

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

    const isQuarantined = entry.integrityStatus === 'QUARANTINED';

    const payload: Record<string, JsonValue> = {
      entryId:             entry.entryId,
      pipelineId:          entry.pipelineId,
      runId:               entry.runId,
      eventType:           entry.eventType,
      severity:            entry.severity,
      adapterSeverity:     severity,
      message:             entry.message,
      integrityStatus:     entry.integrityStatus,
      capturedAtMs:        entry.capturedAtMs,
      hmacSignature:       entry.hmacSignature,
      adaptedAtMs:         now as unknown as number,
      priority,
      eventName,
      isQuarantined,
      isCritical,
      auditHeadline:       auditEntryHeadline(entry.severity, entry.eventType),
      auditMeta:           flatMeta as unknown as JsonValue,
      source:              ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:                this.resolveTags(['audit', entry.severity.toLowerCase()], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildExporterLiveopsEnvelope(
      eventName, roomId, heat, isQuarantined, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._auditEntries++;
    if (isCritical) this._criticalAuditCount++;

    if (isCritical) {
      this.logger.warn('SovereigntyExporterSignalAdapter: CRITICAL audit entry', {
        entryId: entry.entryId, runId: entry.runId, eventType: entry.eventType,
      });
    } else {
      this.logger.debug('SovereigntyExporterSignalAdapter: exporter.audit.entry accepted', {
        entryId: entry.entryId, severity: entry.severity,
      });
    }

    return envelope;
  }

  // ── State query methods ────────────────────────────────────────────────────

  /** Returns cumulative adapter stats. */
  public getStats(): ExporterSignalAdapterStats {
    return Object.freeze({
      totalAdapted:          this._totalAdapted,
      totalSuppressed:       this._totalSuppressed,
      totalDeduped:          this._totalDeduped,
      pipelinesAdapted:      this._pipelinesAdapted,
      proofsSealed:          this._proofsSealed,
      gradesAssigned:        this._gradesAssigned,
      artifactsBuilt:        this._artifactsBuilt,
      auditEntriesAdapted:   this._auditEntries,
      mlVectorsEmitted:      this._mlVectors,
      dlTensorsEmitted:      this._dlTensors,
      highGradeCount:        this._highGradeCount,
      criticalAuditCount:    this._criticalAuditCount,
      freedomOutcomeCount:   this._freedomOutcomes,
    });
  }

  /** Returns the history ring buffer (most recent entries last). */
  public getHistory(): readonly ChatSignalEnvelope[] {
    return Object.freeze([...this._history]);
  }

  /** Clears the history buffer. Does not reset stats. */
  public clearHistory(): void {
    this._history.length = 0;
    this._lastAcceptedAt.clear();
    this.logger.debug('SovereigntyExporterSignalAdapter: history cleared', {});
  }

  /** Resets all stats counters to zero. Does not clear history. */
  public resetStats(): void {
    this._totalAdapted       = 0;
    this._totalSuppressed    = 0;
    this._totalDeduped       = 0;
    this._pipelinesAdapted   = 0;
    this._proofsSealed       = 0;
    this._gradesAssigned     = 0;
    this._artifactsBuilt     = 0;
    this._auditEntries       = 0;
    this._mlVectors          = 0;
    this._dlTensors          = 0;
    this._highGradeCount     = 0;
    this._criticalAuditCount = 0;
    this._freedomOutcomes    = 0;
    this.logger.debug('SovereigntyExporterSignalAdapter: stats reset', {});
  }
}

// ============================================================================
// SECTION 8 — BATCH HELPERS
// ============================================================================

/**
 * Adapt all signal types from a single ExporterPipelineResult in canonical
 * emission order: pipeline.complete → proof.sealed → grade.assigned → artifacts.
 *
 * Returns only non-null envelopes. Callers can pass the full array to the
 * ChatEngine ingress surface for ordered delivery.
 *
 * The adapter's dedupe state ensures downstream idempotence even if this
 * function is called multiple times for the same runId/pipelineId pair.
 */
export function adaptAllExporterSignals(
  adapter: SovereigntyExporterSignalAdapter,
  result: ExporterPipelineResultCompat,
  ctx?: ExporterSignalAdapterContext,
): readonly ChatSignalEnvelope[] {
  const envelopes: ChatSignalEnvelope[] = [];

  const pipeline = adapter.adaptExportPipeline(result, ctx);
  const proof    = adapter.adaptProofSealed(result, ctx);
  const grade    = adapter.adaptGradeAssigned(result, ctx);

  if (pipeline !== null) envelopes.push(pipeline);
  if (proof    !== null) envelopes.push(proof);
  if (grade    !== null) envelopes.push(grade);

  // Emit artifact-built for each export format in the pipeline result
  for (const format of result.exportFormats) {
    const artifactEnv = adapter.adaptArtifactBuilt(result, format, ctx);
    if (artifactEnv !== null) envelopes.push(artifactEnv);
  }

  return Object.freeze(envelopes);
}

/**
 * Adapt a pipeline result + optional ML vector + optional DL tensor in one call.
 *
 * Emits only envelopes that pass the adapter's filtering rules. Returns the
 * frozen array in emission order:
 *   pipeline → proof → grade → artifacts → ml → dl
 */
export function adaptExporterBundle(
  adapter: SovereigntyExporterSignalAdapter,
  result: ExporterPipelineResultCompat,
  mlVector?: ExporterMLVectorCompat,
  dlTensor?: ExporterDLTensorCompat,
  auditEntries?: readonly ExporterAuditEntryCompat[],
  ctx?: ExporterSignalAdapterContext,
): readonly ChatSignalEnvelope[] {
  const envelopes: ChatSignalEnvelope[] = [];

  // Core signals
  const coreSignals = adaptAllExporterSignals(adapter, result, ctx);
  for (const env of coreSignals) {
    envelopes.push(env);
  }

  // ML vector
  if (mlVector !== undefined) {
    const ml = adapter.adaptMLVector(mlVector, ctx);
    if (ml !== null) envelopes.push(ml);
  }

  // DL tensor
  if (dlTensor !== undefined) {
    const dl = adapter.adaptDLTensor(dlTensor, ctx);
    if (dl !== null) envelopes.push(dl);
  }

  // Audit entries
  if (auditEntries !== undefined) {
    for (const entry of auditEntries) {
      const auditEnv = adapter.adaptAuditEntry(entry, ctx);
      if (auditEnv !== null) envelopes.push(auditEnv);
    }
  }

  return Object.freeze(envelopes);
}

/**
 * Adapt an array of ExporterAuditEntries into ChatSignalEnvelopes.
 *
 * Entries are processed in the order supplied — typically chronological
 * capturedAtMs order as emitted by the SovereigntyExporter audit trail.
 * CRITICAL entries will always pass through. LOW entries obey the suppression
 * policy.
 */
export function adaptExporterAuditBatch(
  adapter: SovereigntyExporterSignalAdapter,
  entries: readonly ExporterAuditEntryCompat[],
  ctx?: ExporterSignalAdapterContext,
): readonly ChatSignalEnvelope[] {
  const envelopes: ChatSignalEnvelope[] = [];
  for (const entry of entries) {
    const env = adapter.adaptAuditEntry(entry, ctx);
    if (env !== null) envelopes.push(env);
  }
  return Object.freeze(envelopes);
}

/**
 * Adapt multiple ML vectors from a pipeline batch into ChatSignalEnvelopes.
 *
 * Only emits envelopes when emitMLVectors is true. Returns the frozen array.
 */
export function adaptExporterMLBatch(
  adapter: SovereigntyExporterSignalAdapter,
  vectors: readonly ExporterMLVectorCompat[],
  ctx?: ExporterSignalAdapterContext,
): readonly ChatSignalEnvelope[] {
  const envelopes: ChatSignalEnvelope[] = [];
  for (const vector of vectors) {
    const env = adapter.adaptMLVector(vector, ctx);
    if (env !== null) envelopes.push(env);
  }
  return Object.freeze(envelopes);
}

/**
 * Adapt multiple DL tensors from a pipeline batch into ChatSignalEnvelopes.
 *
 * Only emits envelopes when emitDLTensors is true. Returns the frozen array.
 */
export function adaptExporterDLBatch(
  adapter: SovereigntyExporterSignalAdapter,
  tensors: readonly ExporterDLTensorCompat[],
  ctx?: ExporterSignalAdapterContext,
): readonly ChatSignalEnvelope[] {
  const envelopes: ChatSignalEnvelope[] = [];
  for (const tensor of tensors) {
    const env = adapter.adaptDLTensor(tensor, ctx);
    if (env !== null) envelopes.push(env);
  }
  return Object.freeze(envelopes);
}

// ============================================================================
// SECTION 9 — FACTORY
// ============================================================================

/**
 * Convenience factory that creates a SovereigntyExporterSignalAdapter with
 * production-safe defaults:
 * - alwaysAcceptProofSealed: true
 * - alwaysAcceptHighGrade: true
 * - alwaysAcceptCriticalAudit: true
 * - suppressLowPrioritySignals: true
 * - emitMLVectors: false (opt-in)
 * - emitDLTensors: false (opt-in)
 * - dedupeWindowMs: 5000
 * - maxHistory: 200
 * - highSovereigntyThreshold: 80
 * - cordScoreAlertThreshold: 0.85
 */
export function createSovereigntyExporterSignalAdapter(
  defaultRoomId: ChatRoomId | string,
  overrides?: Partial<SovereigntyExporterSignalAdapterOptions>,
): SovereigntyExporterSignalAdapter {
  return new SovereigntyExporterSignalAdapter({
    defaultRoomId,
    defaultVisibleChannel:      'GLOBAL',
    dedupeWindowMs:             DEFAULT_DEDUPE_WINDOW_MS,
    maxHistory:                 DEFAULT_MAX_HISTORY,
    alwaysAcceptProofSealed:    true,
    alwaysAcceptHighGrade:      true,
    alwaysAcceptCriticalAudit:  true,
    suppressLowPrioritySignals: true,
    emitMLVectors:              false,
    emitDLTensors:              false,
    highSovereigntyThreshold:   DEFAULT_HIGH_SOVEREIGNTY_THRESHOLD,
    cordScoreAlertThreshold:    DEFAULT_CORD_ALERT_THRESHOLD,
    ...overrides,
  });
}

// ============================================================================
// SECTION 10 — SELF-DESCRIPTION MANIFEST
// ============================================================================

/** Static manifest describing this adapter's event vocabulary and capabilities. */
export const EXPORTER_SIGNAL_ADAPTER_MANIFEST = Object.freeze({
  adapterName:    'SovereigntyExporterSignalAdapter',
  version:        '2026.03.26',
  sourceFile:     'backend/src/game/engine/chat/adapters/SovereigntyExporterSignalAdapter.ts',
  signalType:     'LIVEOPS' as const,
  events: Object.freeze([
    'exporter.pipeline.complete',
    'exporter.proof.sealed',
    'exporter.grade.assigned',
    'exporter.artifact.built',
    'exporter.ml.vector_emitted',
    'exporter.dl.tensor_emitted',
    'exporter.audit.entry',
  ] as const),
  designLaws: Object.freeze([
    'No circular imports from core/ — all types mirrored structurally.',
    'Proof sealed signals always accepted (high-value milestones).',
    'Grade A/S pipeline results and FREEDOM outcomes always accepted.',
    'CRITICAL audit entries always accepted (helperBlackout=true for QUARANTINED).',
    'LOW priority signals suppressed by default.',
    'ML/DL vectors only emitted when flags are enabled.',
    'All runtime functions (asUnixMs, clamp01, clamp100) consumed in runtime code.',
    'Dedupe is per (runId + pipelineId + eventClass) key.',
    'History is ring-buffered at maxHistory entries.',
  ] as const),
});
