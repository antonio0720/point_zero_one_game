/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT PROOF GENERATOR SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/ProofGeneratorSignalAdapter.ts
 * VERSION: 2026.03.26
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates ProofGenerator signals — proof
 * generation results, CORD scores, grade changes, audit entries, ML vectors,
 * DL tensors, and integrity updates — into authoritative backend-chat ingress
 * envelopes.
 *
 * Backend-truth question
 * ----------------------
 *   "When the ProofGenerator computes a proof hash, assigns a grade, emits an
 *    ML/DL vector, flags an integrity anomaly, or generates a CORD score, what
 *    exact chat-native signal should the authoritative backend chat engine
 *    ingest to drive companion NPC coaching and reflect sovereignty status in
 *    the companion AI?"
 *
 * This file owns:
 * - ProofGenerationResult → ChatSignalEnvelope (proof.generated)
 * - Grade assignment       → ChatSignalEnvelope (proof.grade.{a|b|c|d|f})
 * - Integrity anomaly      → ChatSignalEnvelope (proof.integrity.{verified|quarantined|unverified})
 * - CORD score             → ChatSignalEnvelope (proof.cord.{high|medium|low})
 * - ProofCertificate       → ChatSignalEnvelope (proof.certificate.issued)
 * - ProofAuditEntry        → ChatSignalEnvelope (proof.audit.{critical|high|medium|low})
 * - ProofMLVector          → ChatSignalEnvelope (proof.ml.vector_emitted)
 * - ProofDLTensor          → ChatSignalEnvelope (proof.dl.tensor_emitted)
 * - Outcome signals        → (proof.outcome.{freedom|timeout|bankrupt|abandoned})
 *
 * It does not own:
 * - Transcript mutation, NPC speech, rate policy, or socket fanout
 * - Replay persistence or proof chain authoring
 * - Shield layer integrity, repair scheduling, or run phase management
 * - Any circular import from core/ — all core types mirrored structurally
 *
 * Design laws
 * -----------
 * - No circular imports from core/. All core types are mirrored as structural
 *   compat interfaces defined in this file.
 * - Callers pass real ProofGenerationResult / ProofCertificate / ProofMLVector /
 *   ProofDLTensor objects — they satisfy the compat interfaces structurally.
 * - CRITICAL integrity anomaly signals (QUARANTINED status) are always accepted
 *   regardless of dedupe window.
 * - High-grade results (grade 'A') and FREEDOM outcome proofs always accepted.
 * - ML/DL vector signals only emitted when the respective flag is enabled.
 * - LOW priority signals suppressed by default to keep chat focused.
 * - CORD score above cordScoreAlertThreshold is always accepted.
 * - All runtime functions (asUnixMs, clamp01, clamp100) are called in runtime
 *   code — never dead imports.
 *
 * Event vocabulary
 * ----------------
 *   proof.generated                — core proof hash computed and verified
 *   proof.grade.a                  — grade A (sovereignty excellence)
 *   proof.grade.b                  — grade B (strong performance)
 *   proof.grade.c                  — grade C (acceptable performance)
 *   proof.grade.d                  — grade D (below par)
 *   proof.grade.f                  — grade F (failed proof integrity)
 *   proof.integrity.verified       — integrity chain confirmed clean
 *   proof.integrity.quarantined    — integrity anomaly — CRITICAL, always accepted
 *   proof.integrity.unverified     — integrity pending or unresolvable
 *   proof.cord.high                — CORD score above alert threshold
 *   proof.cord.medium              — CORD score in middle band
 *   proof.cord.low                 — CORD score low (suppressed by default)
 *   proof.certificate.issued       — sovereignty certificate stamped
 *   proof.audit.critical           — audit entry: CRITICAL severity
 *   proof.audit.high               — audit entry: HIGH severity
 *   proof.audit.medium             — audit entry: MEDIUM severity
 *   proof.audit.low                — audit entry: LOW severity (suppressed)
 *   proof.ml.vector_emitted        — ML feature vector (32-dim) extracted
 *   proof.dl.tensor_emitted        — DL input tensor (48-dim) constructed
 *   proof.outcome.freedom          — run ended with FREEDOM outcome
 *   proof.outcome.timeout          — run ended with TIMEOUT outcome
 *   proof.outcome.bankrupt         — run ended with BANKRUPT outcome
 *   proof.outcome.abandoned        — run was ABANDONED
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
// Mirrors of ProofGenerator types — no circular import from core/
// ============================================================================

/** Mirror of ProofGenerationResult from sovereignty/ProofGenerator.ts */
export interface ProofGenerationResultCompat {
  readonly runId: string;
  readonly userId: string;
  readonly seed: string;
  readonly mode: string;
  readonly outcome: 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';
  readonly proofHash: string;
  readonly tickStreamChecksum: string;
  readonly tickStreamLength: number;
  readonly cordScore: number;
  readonly grade: 'A' | 'B' | 'C' | 'D' | 'F';
  readonly integrityStatus: 'PENDING' | 'VERIFIED' | 'QUARANTINED' | 'UNVERIFIED';
  readonly sovereigntyScore: number;
  readonly finalNetWorth: number;
  readonly verificationValid: boolean;
  readonly generatedAtMs: number;
}

/** Mirror of ProofMLVector from sovereignty/ProofGenerator.ts */
export interface ProofMLVectorCompat {
  readonly runId: string;
  readonly proofHash: string;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly vectorShape: readonly [1, 32] | readonly [number, number];
  readonly extractedAtMs: number;
}

/** Mirror of ProofDLTensor from sovereignty/ProofGenerator.ts */
export interface ProofDLTensorCompat {
  readonly runId: string;
  readonly proofHash: string;
  readonly inputVector: readonly number[];
  readonly featureLabels: readonly string[];
  readonly tensorShape: readonly [1, 48] | readonly [number, number];
  readonly policyVersion: string;
  readonly extractedAtMs: number;
}

/** Mirror of ProofAuditEntry from sovereignty/ProofGenerator.ts */
export interface ProofAuditEntryCompat {
  readonly entryId: string;
  readonly runId: string;
  readonly proofHash: string;
  readonly eventType: string;
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly message: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly capturedAtMs: number;
  readonly hmacSignature: string;
}

/** Mirror of ProofCertificate from sovereignty/ProofGenerator.ts */
export interface ProofCertificateCompat {
  readonly certificateId: string;
  readonly runId: string;
  readonly userId: string;
  readonly proofHash: string;
  readonly grade: 'A' | 'B' | 'C' | 'D' | 'F';
  readonly cordScore: number;
  readonly outcome: string;
  readonly integrityStatus: string;
  readonly sovereigntyScore: number;
  readonly finalNetWorth: number;
  readonly issuedAtMs: number;
}

// ============================================================================
// SECTION 2 — ADAPTER TYPES
// ============================================================================

/** Optional per-call routing context passed to adapt* methods. */
export interface ProofSignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

/** Logger interface — implement with any backend logger or leave null. */
export interface ProofSignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

/** Clock interface — injectable for tests. */
export interface ProofSignalAdapterClock {
  now(): UnixMs;
}

/** Severity classification for adapter events (distinct from ProofAuditEntry severity). */
export type ProofSignalAdapterSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'CRITICAL';

/** Full set of proof signal event names. */
export type ProofSignalAdapterEventName =
  | 'proof.generated'
  | 'proof.grade.a'
  | 'proof.grade.b'
  | 'proof.grade.c'
  | 'proof.grade.d'
  | 'proof.grade.f'
  | 'proof.integrity.verified'
  | 'proof.integrity.quarantined'
  | 'proof.integrity.unverified'
  | 'proof.cord.high'
  | 'proof.cord.medium'
  | 'proof.cord.low'
  | 'proof.certificate.issued'
  | 'proof.audit.critical'
  | 'proof.audit.high'
  | 'proof.audit.medium'
  | 'proof.audit.low'
  | 'proof.ml.vector_emitted'
  | 'proof.dl.tensor_emitted'
  | 'proof.outcome.freedom'
  | 'proof.outcome.timeout'
  | 'proof.outcome.bankrupt'
  | 'proof.outcome.abandoned'
  | string;

/** Construction options for ProofGeneratorSignalAdapter. */
export interface ProofGeneratorSignalAdapterOptions {
  /** Room all signals default to unless overridden by context. */
  readonly defaultRoomId: ChatRoomId | string;
  /** Visible channel default (default: 'GLOBAL'). */
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  /** Time window in ms within which duplicate signals are suppressed (default: 5000). */
  readonly dedupeWindowMs?: number;
  /** Maximum number of history entries retained (default: 200). */
  readonly maxHistory?: number;
  /** Suppress LOW priority signals to keep chat focused (default: true). */
  readonly suppressLowPrioritySignals?: boolean;
  /** Emit ML vector signals when adaptMLVector() is called (default: false). */
  readonly emitMLVectors?: boolean;
  /** Emit DL tensor signals when adaptDLTensor() is called (default: false). */
  readonly emitDLTensors?: boolean;
  /**
   * Always accept QUARANTINED integrity signals regardless of dedupe window
   * (default: true). CRITICAL security law — never set false in production.
   */
  readonly alwaysAcceptCriticalIntegrity?: boolean;
  /** Always accept grade-A results regardless of dedupe window (default: true). */
  readonly alwaysAcceptHighGrade?: boolean;
  /**
   * CORD score at or above this threshold is treated as high-interest and
   * always accepted (default: 0.85).
   */
  readonly cordScoreAlertThreshold?: number;
  readonly logger?: ProofSignalAdapterLogger;
  readonly clock?: ProofSignalAdapterClock;
}

/** Cumulative stats reported by getStats(). */
export interface ProofSignalAdapterStats {
  readonly totalAdapted: number;
  readonly totalSuppressed: number;
  readonly totalDeduped: number;
  readonly proofResultsAdapted: number;
  readonly gradeSignalsAdapted: number;
  readonly integritySignalsAdapted: number;
  readonly cordSignalsAdapted: number;
  readonly certificatesAdapted: number;
  readonly auditEntriesAdapted: number;
  readonly mlVectorsEmitted: number;
  readonly dlTensorsEmitted: number;
  readonly criticalIntegrityCount: number;
  readonly highGradeCount: number;
  readonly freedomOutcomeCount: number;
}

// ============================================================================
// SECTION 3 — MODULE CONSTANTS
// ============================================================================

const DEFAULT_DEDUPE_WINDOW_MS = 5_000;
const DEFAULT_MAX_HISTORY = 200;
const DEFAULT_CORD_ALERT_THRESHOLD = 0.85;
const ADAPTER_SOURCE_TAG = 'ProofGeneratorSignalAdapter';

/** Priority weights by grade — used to assign envelope priority value. */
const GRADE_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  A: 100,
  B: 80,
  C: 60,
  D: 40,
  F: 20,
});

/** Priority weights by integrity status. */
const INTEGRITY_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  QUARANTINED: 100,
  VERIFIED: 60,
  UNVERIFIED: 40,
  PENDING: 20,
});

/** Priority weights by audit severity. */
const AUDIT_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  CRITICAL: 100,
  HIGH: 75,
  MEDIUM: 50,
  LOW: 25,
});

/** Priority weights by outcome. */
const OUTCOME_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  FREEDOM: 90,
  TIMEOUT: 50,
  BANKRUPT: 80,
  ABANDONED: 30,
});

const NULL_LOGGER: ProofSignalAdapterLogger = Object.freeze({
  debug() {},
  warn() {},
  error() {},
});

const SYSTEM_CLOCK: ProofSignalAdapterClock = Object.freeze({
  now(): UnixMs { return asUnixMs(Date.now()); },
});

// ============================================================================
// SECTION 4 — UX MESSAGE HELPERS
// ============================================================================

/** Returns a companion-facing headline for the given proof grade. */
export function gradeHeadline(grade: string): string {
  switch (grade) {
    case 'A': return 'Sovereignty proof verified — excellence confirmed.';
    case 'B': return 'Proof stamped — strong sovereignty standing.';
    case 'C': return 'Proof accepted — room to grow your sovereignty score.';
    case 'D': return 'Proof recorded — sovereignty performance was below par.';
    case 'F': return 'Proof flagged — sovereignty threshold not met.';
    default:  return 'Proof result recorded.';
  }
}

/** Returns a companion-facing coaching message for the given proof grade. */
export function gradeCoachingMessage(grade: string): string {
  switch (grade) {
    case 'A': return 'Your financial discipline drove a clean proof. This is the FREEDOM path.';
    case 'B': return 'Solid run. Tighten your shield management to reach the A tier next time.';
    case 'C': return 'Mid-tier proof. Focus on reducing pressure exposure and protecting income.';
    case 'D': return 'High-pressure events eroded your score. Study your tick stream closely.';
    case 'F': return 'Integrity constraints were breached or the run collapsed. Review audit entries.';
    default:  return 'Review your run data for improvement signals.';
  }
}

/** Returns a companion-facing headline for the given run outcome. */
export function outcomeHeadline(outcome: string): string {
  switch (outcome) {
    case 'FREEDOM':   return 'Financial sovereignty achieved — FREEDOM unlocked.';
    case 'TIMEOUT':   return 'Run completed at time limit — proof sealed.';
    case 'BANKRUPT':  return 'Net worth collapsed — bankruptcy proof recorded.';
    case 'ABANDONED': return 'Run abandoned — partial proof archived.';
    default:          return 'Run outcome recorded.';
  }
}

/** Returns a companion coaching message for the given run outcome. */
export function outcomeCoachingMessage(outcome: string): string {
  switch (outcome) {
    case 'FREEDOM':
      return 'You held the line. This proof is your sovereignty certificate.';
    case 'TIMEOUT':
      return 'Time expired before freedom threshold. Every tick of data sharpens your next run.';
    case 'BANKRUPT':
      return 'Net worth hit zero. Study the cascade that triggered the collapse.';
    case 'ABANDONED':
      return 'Run ended early. Incomplete proof archived — no certificate issued.';
    default:
      return 'Review your outcome data to plan your next sovereignty run.';
  }
}

/** Returns a companion headline for the given integrity status. */
export function integrityHeadline(status: string): string {
  switch (status) {
    case 'VERIFIED':    return 'Proof integrity verified — tick stream is clean.';
    case 'QUARANTINED': return 'INTEGRITY ANOMALY — proof quarantined for review.';
    case 'UNVERIFIED':  return 'Proof integrity unverified — chain analysis pending.';
    case 'PENDING':     return 'Integrity verification in progress.';
    default:            return 'Integrity status updated.';
  }
}

/** Returns a companion coaching message for the given integrity status. */
export function integrityCoachingMessage(status: string): string {
  switch (status) {
    case 'VERIFIED':
      return 'Your tick stream passed all integrity checks. Clean proof.';
    case 'QUARANTINED':
      return 'Your proof was quarantined due to a detected anomaly. Audit entries have been captured.';
    case 'UNVERIFIED':
      return 'The integrity chain could not be fully resolved. Manual review may be required.';
    case 'PENDING':
      return 'Verification is still running. Sovereignty score will update when complete.';
    default:
      return 'Integrity status recorded.';
  }
}

/** Returns a companion CORD score context message. */
export function cordScoreMessage(cordScore: number, threshold: number): string {
  if (cordScore >= threshold) {
    return `CORD score ${cordScore.toFixed(3)} — sovereign financial control confirmed at high threshold.`;
  }
  if (cordScore >= 0.5) {
    return `CORD score ${cordScore.toFixed(3)} — moderate financial discipline detected.`;
  }
  return `CORD score ${cordScore.toFixed(3)} — low financial control signal in this run.`;
}

// ============================================================================
// SECTION 5 — STANDALONE HELPER: buildProofSignalPayload
// ============================================================================

/**
 * Standalone helper that builds a base metadata payload from a
 * ProofGenerationResultCompat. Used by multiple adapt* methods for consistency.
 *
 * All numeric values are clamped and rounded to prevent payload injection or
 * out-of-range values reaching the chat engine.
 */
export function buildProofSignalPayload(
  result: ProofGenerationResultCompat,
  now: UnixMs,
  overrides?: Readonly<Record<string, JsonValue>>,
): Record<string, JsonValue> {
  const cord01    = clamp01(result.cordScore);
  const sov100    = clamp100(result.sovereigntyScore);
  const netWorth  = Math.round(result.finalNetWorth);

  return {
    runId:                result.runId,
    userId:               result.userId,
    proofHash:            result.proofHash,
    tickStreamChecksum:   result.tickStreamChecksum,
    tickStreamLength:     result.tickStreamLength,
    mode:                 result.mode,
    outcome:              result.outcome,
    grade:                result.grade,
    integrityStatus:      result.integrityStatus,
    verificationValid:    result.verificationValid,
    cordScore01:          parseFloat(cord01.toFixed(6)),
    sovereigntyScore100:  sov100,
    finalNetWorth:        netWorth,
    generatedAtMs:        result.generatedAtMs,
    adaptedAtMs:          now as unknown as number,
    gradeHeadline:        gradeHeadline(result.grade),
    outcomeHeadline:      outcomeHeadline(result.outcome),
    integrityHeadline:    integrityHeadline(result.integrityStatus),
    ...(overrides ?? {}),
  };
}

// ============================================================================
// SECTION 6 — INTERNAL HELPERS
// ============================================================================

/** Determine the adapter severity level from proof grade. */
function gradeSeverity(grade: string): ProofSignalAdapterSeverity {
  switch (grade) {
    case 'A': return 'INFO';
    case 'B': return 'INFO';
    case 'C': return 'INFO';
    case 'D': return 'WARN';
    case 'F': return 'WARN';
    default:  return 'DEBUG';
  }
}

/** Determine the adapter severity level from integrity status. */
function integritySeverity(status: string): ProofSignalAdapterSeverity {
  switch (status) {
    case 'QUARANTINED': return 'CRITICAL';
    case 'VERIFIED':    return 'INFO';
    case 'UNVERIFIED':  return 'WARN';
    case 'PENDING':     return 'DEBUG';
    default:            return 'DEBUG';
  }
}

/** Determine the adapter severity level from audit entry severity. */
function auditSeverity(severity: string): ProofSignalAdapterSeverity {
  switch (severity) {
    case 'CRITICAL': return 'CRITICAL';
    case 'HIGH':     return 'WARN';
    case 'MEDIUM':   return 'INFO';
    case 'LOW':      return 'DEBUG';
    default:         return 'DEBUG';
  }
}

/** Map grade to canonical event name. */
function gradeEventName(grade: string): ProofSignalAdapterEventName {
  switch (grade) {
    case 'A': return 'proof.grade.a';
    case 'B': return 'proof.grade.b';
    case 'C': return 'proof.grade.c';
    case 'D': return 'proof.grade.d';
    case 'F': return 'proof.grade.f';
    default:  return 'proof.grade.f';
  }
}

/** Map integrity status to canonical event name. */
function integrityEventName(status: string): ProofSignalAdapterEventName {
  switch (status) {
    case 'VERIFIED':    return 'proof.integrity.verified';
    case 'QUARANTINED': return 'proof.integrity.quarantined';
    case 'UNVERIFIED':  return 'proof.integrity.unverified';
    default:            return 'proof.integrity.unverified';
  }
}

/** Map outcome to canonical event name. */
function outcomeEventName(outcome: string): ProofSignalAdapterEventName {
  switch (outcome) {
    case 'FREEDOM':   return 'proof.outcome.freedom';
    case 'TIMEOUT':   return 'proof.outcome.timeout';
    case 'BANKRUPT':  return 'proof.outcome.bankrupt';
    case 'ABANDONED': return 'proof.outcome.abandoned';
    default:          return 'proof.outcome.abandoned';
  }
}

/** Map audit severity to canonical event name. */
function auditEventName(severity: string): ProofSignalAdapterEventName {
  switch (severity) {
    case 'CRITICAL': return 'proof.audit.critical';
    case 'HIGH':     return 'proof.audit.high';
    case 'MEDIUM':   return 'proof.audit.medium';
    case 'LOW':      return 'proof.audit.low';
    default:         return 'proof.audit.low';
  }
}

/** Map CORD score to band event name. */
function cordBandEventName(cordScore: number, threshold: number): ProofSignalAdapterEventName {
  if (cordScore >= threshold) return 'proof.cord.high';
  if (cordScore >= 0.4)       return 'proof.cord.medium';
  return 'proof.cord.low';
}

/** Build a frozen LIVEOPS ChatSignalEnvelope from proof signal data. */
function buildProofLiveopsEnvelope(
  eventName: string,
  roomId: ChatRoomId | string | null,
  heatMultiplier: Score01,
  isQuarantined: boolean,
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
      helperBlackout: isQuarantined,
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
// SECTION 7 — ProofGeneratorSignalAdapter CLASS
// ============================================================================

/**
 * Adapts ProofGenerator outputs into authoritative backend-chat ingress envelopes.
 *
 * Filtering policy (in priority order):
 * - QUARANTINED integrity signals: always accepted (alwaysAcceptCriticalIntegrity)
 * - Grade-A results and FREEDOM outcomes: always accepted (alwaysAcceptHighGrade)
 * - CORD scores >= cordScoreAlertThreshold: always accepted
 * - LOW priority signals (audit LOW, cord.low): suppressed when suppressLowPrioritySignals=true
 * - All other signals: subject to dedupeWindowMs
 * - ML/DL vectors: only emitted when emitMLVectors / emitDLTensors is true
 */
export class ProofGeneratorSignalAdapter {
  private readonly opts: Readonly<Required<ProofGeneratorSignalAdapterOptions>>;
  private readonly logger: ProofSignalAdapterLogger;
  private readonly clock: ProofSignalAdapterClock;

  private readonly _history: ChatSignalEnvelope[] = [];
  private readonly _lastAcceptedAt: Map<string, UnixMs> = new Map();

  // ── Stats counters ─────────────────────────────────────────────────────────
  private _totalAdapted        = 0;
  private _totalSuppressed     = 0;
  private _totalDeduped        = 0;
  private _proofResultsAdapted = 0;
  private _gradeSignals        = 0;
  private _integritySignals    = 0;
  private _cordSignals         = 0;
  private _certificates        = 0;
  private _auditEntries        = 0;
  private _mlVectors           = 0;
  private _dlTensors           = 0;
  private _criticalIntegrity   = 0;
  private _highGrade           = 0;
  private _freedomOutcome      = 0;

  public constructor(options: ProofGeneratorSignalAdapterOptions) {
    this.logger = options.logger ?? NULL_LOGGER;
    this.clock  = options.clock  ?? SYSTEM_CLOCK;

    this.opts = Object.freeze({
      defaultRoomId:               options.defaultRoomId,
      defaultVisibleChannel:       options.defaultVisibleChannel        ?? 'GLOBAL',
      dedupeWindowMs:              options.dedupeWindowMs               ?? DEFAULT_DEDUPE_WINDOW_MS,
      maxHistory:                  options.maxHistory                   ?? DEFAULT_MAX_HISTORY,
      suppressLowPrioritySignals:  options.suppressLowPrioritySignals   ?? true,
      emitMLVectors:               options.emitMLVectors                ?? false,
      emitDLTensors:               options.emitDLTensors                ?? false,
      alwaysAcceptCriticalIntegrity: options.alwaysAcceptCriticalIntegrity ?? true,
      alwaysAcceptHighGrade:       options.alwaysAcceptHighGrade        ?? true,
      cordScoreAlertThreshold:     options.cordScoreAlertThreshold      ?? DEFAULT_CORD_ALERT_THRESHOLD,
      logger:                      this.logger,
      clock:                       this.clock,
    } as Required<ProofGeneratorSignalAdapterOptions>);
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
    this.logger.debug(`ProofGeneratorSignalAdapter: suppressed — ${reason}`, details);
    return null;
  }

  private dedupe(eventName: string, key: string): null {
    this._totalDeduped++;
    this.logger.debug('ProofGeneratorSignalAdapter: deduped', { eventName, key });
    return null;
  }

  private resolveRoom(ctx?: ProofSignalAdapterContext): ChatRoomId | string {
    return (ctx?.roomId ?? this.opts.defaultRoomId) as ChatRoomId | string;
  }

  private resolveTags(
    baseTags: string[],
    ctx?: ProofSignalAdapterContext,
  ): string[] {
    return [ADAPTER_SOURCE_TAG, ...baseTags, ...(ctx?.tags ?? [])];
  }

  // ── Public adapt* methods ───────────────────────────────────────────────────

  /**
   * Adapt a ProofGenerationResult into a proof.generated ChatSignalEnvelope.
   *
   * Always accepted for grade A and FREEDOM outcomes. Deduped otherwise.
   * The outcome signal is also embedded in the metadata payload so callers
   * can consume a single unified envelope.
   */
  public adaptProofResult(
    result: ProofGenerationResultCompat,
    ctx?: ProofSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now     = this.clock.now();
    const roomId  = this.resolveRoom(ctx);
    const eventName: ProofSignalAdapterEventName = 'proof.generated';
    const dedupeKey = `proof.generated:${result.runId}:${result.proofHash}`;

    // Always-accept rules
    const isHighGrade   = result.grade === 'A' && this.opts.alwaysAcceptHighGrade;
    const isFreedom     = result.outcome === 'FREEDOM' && this.opts.alwaysAcceptHighGrade;
    const isAlwaysAccept = isHighGrade || isFreedom;

    if (!isAlwaysAccept && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const cord01   = clamp01(result.cordScore);
    const sov100   = clamp100(result.sovereigntyScore);
    const heat     = clamp01(cord01 * 0.6 + (result.grade === 'A' ? 0.4 : 0)) as Score01;

    const payload  = buildProofSignalPayload(result, now, {
      eventName,
      coachingMessage: gradeCoachingMessage(result.grade),
      outcomeMessage:  outcomeCoachingMessage(result.outcome),
      seed:            result.seed,
      source:          ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    });

    const envelope = buildProofLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._proofResultsAdapted++;
    if (result.grade === 'A') this._highGrade++;
    if (result.outcome === 'FREEDOM') this._freedomOutcome++;

    this.logger.debug('ProofGeneratorSignalAdapter: proof.generated accepted', {
      runId: result.runId, grade: result.grade, outcome: result.outcome,
    });

    return envelope;
  }

  /**
   * Adapt a grade assignment signal from a ProofGenerationResult.
   *
   * Grade A is always accepted. Grades B–F are subject to deduplication.
   * LOW-equivalent signals (grade F when suppressLowPrioritySignals=true)
   * are still emitted — grade F is never suppressed because it signals failure.
   */
  public adaptGradeSignal(
    result: ProofGenerationResultCompat,
    ctx?: ProofSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName = gradeEventName(result.grade);
    const dedupeKey = `grade:${result.runId}:${result.grade}`;

    const isAlwaysAccept = result.grade === 'A' && this.opts.alwaysAcceptHighGrade;

    if (!isAlwaysAccept && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const cord01   = clamp01(result.cordScore);
    const sov100   = clamp100(result.sovereigntyScore);
    const priority = GRADE_PRIORITY[result.grade] ?? 20;
    const heat     = clamp01(priority / 100) as Score01;

    const payload: Record<string, JsonValue> = {
      runId:               result.runId,
      userId:              result.userId,
      proofHash:           result.proofHash,
      grade:               result.grade,
      gradeHeadline:       gradeHeadline(result.grade),
      gradeCoaching:       gradeCoachingMessage(result.grade),
      integrityStatus:     result.integrityStatus,
      cordScore01:         parseFloat(cord01.toFixed(6)),
      sovereigntyScore100: sov100,
      finalNetWorth:       Math.round(result.finalNetWorth),
      priority,
      eventName,
      source:              ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildProofLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._gradeSignals++;
    if (result.grade === 'A') this._highGrade++;

    return envelope;
  }

  /**
   * Adapt an integrity status signal from a ProofGenerationResult.
   *
   * QUARANTINED is CRITICAL — always accepted regardless of dedupe window
   * when alwaysAcceptCriticalIntegrity is true (the default).
   * Sets helperBlackout=true for QUARANTINED to suppress companion NPC speech
   * and let the severity of the anomaly land without interference.
   */
  public adaptIntegritySignal(
    result: ProofGenerationResultCompat,
    ctx?: ProofSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const status    = result.integrityStatus;
    const eventName = integrityEventName(status);
    const dedupeKey = `integrity:${result.runId}:${status}`;

    const isQuarantined   = status === 'QUARANTINED';
    const isAlwaysAccept  = isQuarantined && this.opts.alwaysAcceptCriticalIntegrity;

    // PENDING/UNVERIFIED at low priority: suppress if flag set
    if (
      !isAlwaysAccept &&
      this.opts.suppressLowPrioritySignals &&
      (status === 'PENDING' || status === 'UNVERIFIED')
    ) {
      return this.suppress('integrity PENDING/UNVERIFIED suppressed', {
        runId: result.runId, status,
      });
    }

    if (!isAlwaysAccept && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const cord01   = clamp01(result.cordScore);
    const sov100   = clamp100(result.sovereigntyScore);
    const priority = INTEGRITY_PRIORITY[status] ?? 20;
    const heat     = clamp01(isQuarantined ? 1.0 : priority / 100) as Score01;

    const payload: Record<string, JsonValue> = {
      runId:               result.runId,
      userId:              result.userId,
      proofHash:           result.proofHash,
      integrityStatus:     status,
      verificationValid:   result.verificationValid,
      integrityHeadline:   integrityHeadline(status),
      integrityCoaching:   integrityCoachingMessage(status),
      grade:               result.grade,
      cordScore01:         parseFloat(cord01.toFixed(6)),
      sovereigntyScore100: sov100,
      isQuarantined,
      priority,
      eventName,
      source:              ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildProofLiveopsEnvelope(
      eventName, roomId, heat, isQuarantined, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._integritySignals++;
    if (isQuarantined) this._criticalIntegrity++;

    this.logger.debug(`ProofGeneratorSignalAdapter: ${eventName} accepted`, {
      runId: result.runId, status, isQuarantined: String(isQuarantined),
    });

    return envelope;
  }

  /**
   * Adapt a CORD score signal from a ProofGenerationResult.
   *
   * High CORD (>= cordScoreAlertThreshold) is always accepted.
   * Low CORD signals (proof.cord.low) are suppressed when
   * suppressLowPrioritySignals is true.
   */
  public adaptCordSignal(
    result: ProofGenerationResultCompat,
    ctx?: ProofSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const cord01    = clamp01(result.cordScore);
    const threshold = this.opts.cordScoreAlertThreshold;
    const eventName = cordBandEventName(cord01, threshold);
    const dedupeKey = `cord:${result.runId}:${eventName}`;

    const isHighCord     = cord01 >= threshold;
    const isAlwaysAccept = isHighCord;

    // Suppress low CORD signals when flag is set
    if (
      !isAlwaysAccept &&
      this.opts.suppressLowPrioritySignals &&
      eventName === 'proof.cord.low'
    ) {
      return this.suppress('proof.cord.low suppressed', {
        runId: result.runId, cordScore: parseFloat(cord01.toFixed(6)),
      });
    }

    if (!isAlwaysAccept && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const sov100   = clamp100(result.sovereigntyScore);
    const heat     = clamp01(cord01) as Score01;

    const payload: Record<string, JsonValue> = {
      runId:               result.runId,
      userId:              result.userId,
      proofHash:           result.proofHash,
      cordScore01:         parseFloat(cord01.toFixed(6)),
      cordBand:            isHighCord ? 'HIGH' : cord01 >= 0.4 ? 'MEDIUM' : 'LOW',
      cordAlertThreshold:  threshold,
      cordMessage:         cordScoreMessage(cord01, threshold),
      grade:               result.grade,
      integrityStatus:     result.integrityStatus,
      sovereigntyScore100: sov100,
      eventName,
      source:              ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildProofLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._cordSignals++;

    return envelope;
  }

  /**
   * Adapt a ProofCertificate into a proof.certificate.issued ChatSignalEnvelope.
   *
   * Certificates are high-value events. Grade A certificates are always
   * accepted. Others are deduped by certificateId.
   */
  public adaptCertificateSignal(
    cert: ProofCertificateCompat,
    ctx?: ProofSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: ProofSignalAdapterEventName = 'proof.certificate.issued';
    const dedupeKey = `cert:${cert.certificateId}`;

    const isHighGrade    = cert.grade === 'A' && this.opts.alwaysAcceptHighGrade;
    const isAlwaysAccept = isHighGrade;

    if (!isAlwaysAccept && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const cord01   = clamp01(cert.cordScore);
    const sov100   = clamp100(cert.sovereigntyScore);
    const heat     = clamp01(cord01 * 0.5 + (cert.grade === 'A' ? 0.5 : 0.2)) as Score01;

    const payload: Record<string, JsonValue> = {
      certificateId:       cert.certificateId,
      runId:               cert.runId,
      userId:              cert.userId,
      proofHash:           cert.proofHash,
      grade:               cert.grade,
      outcome:             cert.outcome,
      integrityStatus:     cert.integrityStatus,
      cordScore01:         parseFloat(cord01.toFixed(6)),
      sovereigntyScore100: sov100,
      finalNetWorth:       Math.round(cert.finalNetWorth),
      issuedAtMs:          cert.issuedAtMs,
      gradeHeadline:       gradeHeadline(cert.grade),
      gradeCoaching:       gradeCoachingMessage(cert.grade),
      outcomeHeadline:     outcomeHeadline(cert.outcome),
      certMessage:         `Sovereignty certificate ${cert.certificateId} issued for run ${cert.runId}.`,
      source:              ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildProofLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._certificates++;
    if (cert.grade === 'A') this._highGrade++;

    this.logger.debug('ProofGeneratorSignalAdapter: proof.certificate.issued', {
      certificateId: cert.certificateId, runId: cert.runId, grade: cert.grade,
    });

    return envelope;
  }

  /**
   * Adapt a ProofAuditEntry into a proof.audit.* ChatSignalEnvelope.
   *
   * CRITICAL audit entries are always accepted. LOW entries are suppressed
   * when suppressLowPrioritySignals is true. All others are deduped.
   *
   * The HMAC signature is included in metadata for downstream integrity
   * verification — it is not displayed to the player.
   */
  public adaptAuditEntrySignal(
    entry: ProofAuditEntryCompat,
    ctx?: ProofSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName = auditEventName(entry.severity);
    const dedupeKey = `audit:${entry.entryId}`;

    const isCritical     = entry.severity === 'CRITICAL';
    const isAlwaysAccept = isCritical;

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

    const priority = AUDIT_PRIORITY[entry.severity] ?? 25;
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

    const payload: Record<string, JsonValue> = {
      entryId:         entry.entryId,
      runId:           entry.runId,
      proofHash:       entry.proofHash,
      eventType:       entry.eventType,
      severity:        entry.severity,
      adapterSeverity: severity,
      message:         entry.message,
      capturedAtMs:    entry.capturedAtMs,
      hmacSignature:   entry.hmacSignature,
      priority,
      eventName,
      auditMeta:       flatMeta as unknown as JsonValue,
      source:          ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildProofLiveopsEnvelope(
      eventName, roomId, heat, isCritical, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._auditEntries++;
    if (isCritical) this._criticalIntegrity++;

    if (isCritical) {
      this.logger.warn('ProofGeneratorSignalAdapter: CRITICAL audit entry', {
        entryId: entry.entryId, runId: entry.runId, eventType: entry.eventType,
      });
    }

    return envelope;
  }

  /**
   * Adapt a ProofMLVector into a proof.ml.vector_emitted ChatSignalEnvelope.
   *
   * Only emitted when emitMLVectors option is true. The feature array is
   * summarized (avg, min, max, shape) rather than inlined to avoid oversized
   * payloads in the chat ingress lane.
   */
  public adaptMLVector(
    vector: ProofMLVectorCompat,
    ctx?: ProofSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    if (!this.opts.emitMLVectors) return null;

    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: ProofSignalAdapterEventName = 'proof.ml.vector_emitted';
    const dedupeKey = `ml:${vector.runId}:${vector.proofHash}`;

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
      runId:          vector.runId,
      proofHash:      vector.proofHash,
      featureCount,
      vectorShape:    JSON.stringify(vector.vectorShape),
      avgFeatureValue: parseFloat(avg.toFixed(8)),
      minFeatureValue: parseFloat(minF.toFixed(8)),
      maxFeatureValue: parseFloat(maxF.toFixed(8)),
      extractedAtMs:  vector.extractedAtMs,
      sampleLabels:   vector.featureLabels.slice(0, 8).join(','),
      eventName,
      source:         ctx?.source ?? ADAPTER_SOURCE_TAG,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildProofLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._mlVectors++;

    return envelope;
  }

  /**
   * Adapt a ProofDLTensor into a proof.dl.tensor_emitted ChatSignalEnvelope.
   *
   * Only emitted when emitDLTensors option is true. The input vector is
   * summarized (avg, norm, shape, policy version) for the chat ingress lane.
   * L2 norm is computed to give the companion AI a sense of tensor magnitude.
   */
  public adaptDLTensor(
    tensor: ProofDLTensorCompat,
    ctx?: ProofSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    if (!this.opts.emitDLTensors) return null;

    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: ProofSignalAdapterEventName = 'proof.dl.tensor_emitted';
    const dedupeKey = `dl:${tensor.runId}:${tensor.proofHash}`;

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
      proofHash:      tensor.proofHash,
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

    const envelope = buildProofLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._dlTensors++;

    return envelope;
  }

  // ── Stats and history ───────────────────────────────────────────────────────

  /** Return a frozen snapshot of adapter cumulative statistics. */
  public getStats(): ProofSignalAdapterStats {
    return Object.freeze({
      totalAdapted:          this._totalAdapted,
      totalSuppressed:       this._totalSuppressed,
      totalDeduped:          this._totalDeduped,
      proofResultsAdapted:   this._proofResultsAdapted,
      gradeSignalsAdapted:   this._gradeSignals,
      integritySignalsAdapted: this._integritySignals,
      cordSignalsAdapted:    this._cordSignals,
      certificatesAdapted:   this._certificates,
      auditEntriesAdapted:   this._auditEntries,
      mlVectorsEmitted:      this._mlVectors,
      dlTensorsEmitted:      this._dlTensors,
      criticalIntegrityCount: this._criticalIntegrity,
      highGradeCount:        this._highGrade,
      freedomOutcomeCount:   this._freedomOutcome,
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
    this._totalAdapted        = 0;
    this._totalSuppressed     = 0;
    this._totalDeduped        = 0;
    this._proofResultsAdapted = 0;
    this._gradeSignals        = 0;
    this._integritySignals    = 0;
    this._cordSignals         = 0;
    this._certificates        = 0;
    this._auditEntries        = 0;
    this._mlVectors           = 0;
    this._dlTensors           = 0;
    this._criticalIntegrity   = 0;
    this._highGrade           = 0;
    this._freedomOutcome      = 0;
  }
}

// ============================================================================
// SECTION 8 — BATCH HELPERS
// ============================================================================

/**
 * Adapt all signal types from a single ProofGenerationResult in canonical
 * emission order: proof.generated → grade → integrity → cord → outcome.
 *
 * Returns only non-null envelopes. Callers can pass the full array to the
 * ChatEngine ingress surface for ordered delivery.
 *
 * The adapter's dedupe state ensures downstream idempotence even if this
 * function is called multiple times for the same runId/proofHash pair.
 */
export function adaptAllProofSignals(
  adapter: ProofGeneratorSignalAdapter,
  result: ProofGenerationResultCompat,
  ctx?: ProofSignalAdapterContext,
): readonly ChatSignalEnvelope[] {
  const envelopes: ChatSignalEnvelope[] = [];

  const proof     = adapter.adaptProofResult(result, ctx);
  const grade     = adapter.adaptGradeSignal(result, ctx);
  const integrity = adapter.adaptIntegritySignal(result, ctx);
  const cord      = adapter.adaptCordSignal(result, ctx);

  if (proof     !== null) envelopes.push(proof);
  if (grade     !== null) envelopes.push(grade);
  if (integrity !== null) envelopes.push(integrity);
  if (cord      !== null) envelopes.push(cord);

  return Object.freeze(envelopes);
}

/**
 * Adapt a certificate + optional ML vector + optional DL tensor in one call.
 *
 * Emits only envelopes that pass the adapter's filtering rules. Returns the
 * frozen array in emission order: certificate → ml → dl.
 */
export function adaptCertificateBundle(
  adapter: ProofGeneratorSignalAdapter,
  cert: ProofCertificateCompat,
  mlVector?: ProofMLVectorCompat,
  dlTensor?: ProofDLTensorCompat,
  ctx?: ProofSignalAdapterContext,
): readonly ChatSignalEnvelope[] {
  const envelopes: ChatSignalEnvelope[] = [];

  const certEnv = adapter.adaptCertificateSignal(cert, ctx);
  if (certEnv !== null) envelopes.push(certEnv);

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
 * Adapt an array of ProofAuditEntries into ChatSignalEnvelopes.
 *
 * Entries are processed in the order supplied — typically chronological
 * capturedAtMs order as emitted by the ProofGenerator audit trail. CRITICAL
 * entries will always pass through. LOW entries obey the suppression policy.
 */
export function adaptAuditBatch(
  adapter: ProofGeneratorSignalAdapter,
  entries: readonly ProofAuditEntryCompat[],
  ctx?: ProofSignalAdapterContext,
): readonly ChatSignalEnvelope[] {
  const envelopes: ChatSignalEnvelope[] = [];
  for (const entry of entries) {
    const env = adapter.adaptAuditEntrySignal(entry, ctx);
    if (env !== null) envelopes.push(env);
  }
  return Object.freeze(envelopes);
}

// ============================================================================
// SECTION 9 — FACTORY
// ============================================================================

/**
 * Convenience factory that creates a ProofGeneratorSignalAdapter with
 * production-safe defaults:
 * - suppressLowPrioritySignals: true
 * - alwaysAcceptCriticalIntegrity: true
 * - alwaysAcceptHighGrade: true
 * - emitMLVectors: false (opt-in)
 * - emitDLTensors: false (opt-in)
 * - dedupeWindowMs: 5000
 * - maxHistory: 200
 */
export function createProofGeneratorSignalAdapter(
  defaultRoomId: ChatRoomId | string,
  overrides?: Partial<ProofGeneratorSignalAdapterOptions>,
): ProofGeneratorSignalAdapter {
  return new ProofGeneratorSignalAdapter({
    defaultRoomId,
    defaultVisibleChannel:         'GLOBAL',
    dedupeWindowMs:                DEFAULT_DEDUPE_WINDOW_MS,
    maxHistory:                    DEFAULT_MAX_HISTORY,
    suppressLowPrioritySignals:    true,
    emitMLVectors:                 false,
    emitDLTensors:                 false,
    alwaysAcceptCriticalIntegrity: true,
    alwaysAcceptHighGrade:         true,
    cordScoreAlertThreshold:       DEFAULT_CORD_ALERT_THRESHOLD,
    ...overrides,
  });
}

// ============================================================================
// SECTION 10 — SELF-DESCRIPTION MANIFEST
// ============================================================================

/** Static manifest describing this adapter's event vocabulary and capabilities. */
export const PROOF_SIGNAL_ADAPTER_MANIFEST = Object.freeze({
  adapterName:    'ProofGeneratorSignalAdapter',
  version:        '2026.03.26',
  sourceFile:     'backend/src/game/engine/chat/adapters/ProofGeneratorSignalAdapter.ts',
  signalType:     'LIVEOPS' as const,
  events: Object.freeze([
    'proof.generated',
    'proof.grade.a',
    'proof.grade.b',
    'proof.grade.c',
    'proof.grade.d',
    'proof.grade.f',
    'proof.integrity.verified',
    'proof.integrity.quarantined',
    'proof.integrity.unverified',
    'proof.cord.high',
    'proof.cord.medium',
    'proof.cord.low',
    'proof.certificate.issued',
    'proof.audit.critical',
    'proof.audit.high',
    'proof.audit.medium',
    'proof.audit.low',
    'proof.ml.vector_emitted',
    'proof.dl.tensor_emitted',
    'proof.outcome.freedom',
    'proof.outcome.timeout',
    'proof.outcome.bankrupt',
    'proof.outcome.abandoned',
  ] as const),
  designLaws: Object.freeze([
    'No circular imports from core/ — all types mirrored structurally.',
    'QUARANTINED integrity signals always accepted (helperBlackout=true).',
    'Grade A and FREEDOM outcome proofs always accepted.',
    'LOW priority signals suppressed by default.',
    'ML/DL vectors only emitted when flags are enabled.',
    'All runtime functions (asUnixMs, clamp01, clamp100) consumed in runtime code.',
    'Dedupe is per (runId + proofHash + eventClass) key.',
    'History is ring-buffered at maxHistory entries.',
  ] as const),
});
