/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT SOVEREIGNTY EXPORT SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/SovereigntyExportSignalAdapter.ts
 * VERSION: 2026.03.26
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates SovereigntyExportAdapter signals —
 * artifact generation, proof card creation, leaderboard projections, explorer
 * cards, grade narratives, ML/DL vectors, audit entries, and batch completion
 * events — into authoritative backend-chat ingress envelopes.
 *
 * Backend-truth question
 * ----------------------
 *   "When the SovereigntyExportAdapter generates an export artifact, stamps a
 *    proof card, projects a leaderboard, emits an ML/DL vector, records an
 *    audit entry, or completes a batch export, what exact chat-native signal
 *    should the authoritative backend chat engine ingest to drive companion
 *    NPC coaching and reflect export status in the companion AI?"
 *
 * This file owns:
 * - Artifact export      → ChatSignalEnvelope (export.artifact.{json|pdf|png})
 * - Proof card generated → ChatSignalEnvelope (export.proof_card.generated)
 * - Leaderboard updated  → ChatSignalEnvelope (export.leaderboard.updated)
 * - Grade narrative      → ChatSignalEnvelope (export.grade.narrative)
 * - ML vector emitted    → ChatSignalEnvelope (export.ml.vector_emitted)
 * - DL tensor emitted    → ChatSignalEnvelope (export.dl.tensor_emitted)
 * - Audit entry          → ChatSignalEnvelope (export.audit.entry)
 * - Batch complete       → ChatSignalEnvelope (export.batch.complete)
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
 * - Callers pass real SovereigntyExportArtifact / SovereigntyProofCard /
 *   ExportMLVector / ExportDLTensor / ExportAuditEntry / ExportLeaderboardProjection
 *   objects — they satisfy the compat interfaces structurally.
 * - Proof card generated signals are always accepted (high-value milestone).
 * - Audit entry signals with CRITICAL-equivalent severity are always accepted.
 * - ML/DL vector signals only emitted when the respective flag is enabled.
 * - All runtime functions (asUnixMs, clamp01, clamp100) are called in runtime
 *   code — never dead imports.
 *
 * Event vocabulary
 * ----------------
 *   export.artifact.json           — JSON artifact generated
 *   export.artifact.pdf            — PDF artifact generated
 *   export.artifact.png            — PNG artifact generated
 *   export.proof_card.generated    — proof card stamped and ready
 *   export.leaderboard.updated     — leaderboard projection refreshed
 *   export.grade.narrative         — grade narrative text generated
 *   export.ml.vector_emitted       — ML feature vector (32-dim) extracted
 *   export.dl.tensor_emitted       — DL input tensor (48-dim) constructed
 *   export.audit.entry             — audit trail entry recorded
 *   export.batch.complete          — batch export operation completed
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
// Mirrors of SovereigntyExportAdapter types — no circular import from core/
// ============================================================================

/** Mirror of SovereigntyExportArtifact from sovereignty/SovereigntyExportAdapter.ts */
export interface ExportArtifactCompat {
  readonly contractVersion: string;
  readonly artifactId: string;
  readonly runId: string;
  readonly proofHash: string;
  readonly format: 'JSON' | 'PDF' | 'PNG';
  readonly mimeType: string;
  readonly fileName: string;
  readonly exportUrl?: string;
  readonly badgeTier: string;
  readonly generatedAtMs: number;
  readonly checksum: string;
  readonly summary: ProofCardCompat;
  readonly payload: Readonly<{
    readonly run: Readonly<Record<string, unknown>>;
    readonly tickTimeline: readonly Readonly<Record<string, unknown>>[];
    readonly generatedAtMs: number;
    readonly format: 'JSON' | 'PDF' | 'PNG';
  }>;
}

/** Mirror of SovereigntyProofCard from sovereignty/contracts.ts */
export interface ProofCardCompat {
  readonly contractVersion: string;
  readonly runId: string;
  readonly proofHash: string;
  readonly playerHandle: string;
  readonly mode: string;
  readonly outcome: string;
  readonly integrityStatus: string;
  readonly grade: string;
  readonly badgeTier: string;
  readonly sovereigntyScore: number;
  readonly ticksSurvived: number;
  readonly finalNetWorth: number;
  readonly shieldAverageIntegrityPct: number;
  readonly haterBlockRate: number;
  readonly cascadeBreakRate: number;
  readonly decisionSpeedScore: number;
  readonly proofBadges: readonly string[];
  readonly generatedAtMs: number;
}

/** Mirror of ExportMLVector from sovereignty/SovereigntyExportAdapter.ts */
export interface ExportMLVectorCompat {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly dimensionality: number;
  readonly checksum: string;
  readonly extractedAtMs: number;
}

/** Mirror of ExportDLTensor from sovereignty/SovereigntyExportAdapter.ts */
export interface ExportDLTensorCompat {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly dimensionality: number;
  readonly checksum: string;
  readonly shape: readonly [number, number];
  readonly extractedAtMs: number;
}

/** Mirror of ExportAuditEntry from sovereignty/SovereigntyExportAdapter.ts */
export interface ExportAuditEntryCompat {
  readonly schemaVersion: string;
  readonly entryId: string;
  readonly runId: string;
  readonly artifactId: string;
  readonly format: 'JSON' | 'PDF' | 'PNG';
  readonly grade: string;
  readonly integrityStatus: string;
  readonly proofHash: string;
  readonly exportChecksum: string;
  readonly exportSizeBytes: number;
  readonly hmacSignature: string;
  readonly createdAtMs: number;
}

/** Mirror of ExportLeaderboardProjection from sovereignty/SovereigntyExportAdapter.ts */
export interface LeaderboardProjectionCompat {
  readonly entries: readonly Readonly<Record<string, unknown>>[];
  readonly totalEntries: number;
  readonly gradeDistribution: Readonly<Record<string, number>>;
  readonly averageCordScore: number;
  readonly topScore: number;
  readonly bottomScore: number;
  readonly generatedAtMs: number;
}

/** Mirror of ExplorerCard from sovereignty/contracts.ts */
export interface ExplorerCardCompat {
  readonly runId: string;
  readonly mode: string;
  readonly outcome: string;
  readonly grade: string;
  readonly badgeTier: string;
  readonly cordScore: number;
  readonly sovereigntyScore: number;
  readonly ticksSurvived: number;
  readonly finalNetWorth: number;
  readonly integrityVerified: boolean;
  readonly completedAtMs: number;
  readonly gradeLabel: string;
  readonly badgeDescription: string;
  readonly modeLabel: string;
  readonly outcomeLabel: string;
}

/** Grade narrative payload — companion-facing narrative text for a grade. */
export interface GradeNarrativeCompat {
  readonly runId: string;
  readonly grade: string;
  readonly sovereigntyScore: number;
  readonly narrativeText: string;
  readonly gradeLabel: string;
  readonly improvementHints: readonly string[];
  readonly generatedAtMs: number;
}

// ============================================================================
// SECTION 2 — ADAPTER TYPES
// ============================================================================

/** Optional per-call routing context passed to adapt* methods. */
export interface ExportSignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

/** Logger interface — implement with any backend logger or leave null. */
export interface ExportSignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

/** Clock interface — injectable for tests. */
export interface ExportSignalAdapterClock {
  now(): UnixMs;
}

/** Severity classification for adapter events. */
export type ExportSignalAdapterSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'CRITICAL';

/** Full set of export signal event names. */
export type ExportSignalAdapterEventName =
  | 'export.artifact.json'
  | 'export.artifact.pdf'
  | 'export.artifact.png'
  | 'export.proof_card.generated'
  | 'export.leaderboard.updated'
  | 'export.grade.narrative'
  | 'export.ml.vector_emitted'
  | 'export.dl.tensor_emitted'
  | 'export.audit.entry'
  | 'export.batch.complete'
  | string;

/** Construction options for SovereigntyExportSignalAdapter. */
export interface SovereigntyExportSignalAdapterOptions {
  /** Room all signals default to unless overridden by context. */
  readonly defaultRoomId: ChatRoomId | string;
  /** Visible channel default (default: 'GLOBAL'). */
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  /** Time window in ms within which duplicate signals are suppressed (default: 5000). */
  readonly dedupeWindowMs?: number;
  /** Maximum number of history entries retained (default: 200). */
  readonly maxHistory?: number;
  /** Always accept proof card signals regardless of dedupe window (default: true). */
  readonly alwaysAcceptProofCards?: boolean;
  /** Always accept grade-A artifact exports regardless of dedupe window (default: true). */
  readonly alwaysAcceptHighGradeExports?: boolean;
  /** Always accept critical audit entries regardless of dedupe window (default: true). */
  readonly alwaysAcceptCriticalAudit?: boolean;
  /** Emit ML vector signals when adaptMLVector() is called (default: false). */
  readonly emitMLVectors?: boolean;
  /** Emit DL tensor signals when adaptDLTensor() is called (default: false). */
  readonly emitDLTensors?: boolean;
  /**
   * Sovereignty score at or above this threshold is treated as high-value and
   * the artifact export signal gets boosted priority (default: 80).
   */
  readonly highSovereigntyThreshold?: number;
  readonly logger?: ExportSignalAdapterLogger;
  readonly clock?: ExportSignalAdapterClock;
}

/** Cumulative stats reported by getStats(). */
export interface ExportSignalAdapterStats {
  readonly totalAdapted: number;
  readonly totalSuppressed: number;
  readonly totalDeduped: number;
  readonly artifactsAdapted: number;
  readonly jsonArtifacts: number;
  readonly pdfArtifacts: number;
  readonly pngArtifacts: number;
  readonly proofCardsAdapted: number;
  readonly leaderboardUpdates: number;
  readonly gradeNarrativesAdapted: number;
  readonly auditEntriesAdapted: number;
  readonly mlVectorsEmitted: number;
  readonly dlTensorsEmitted: number;
  readonly batchCompletions: number;
  readonly highGradeExportCount: number;
}

// ============================================================================
// SECTION 3 — MODULE CONSTANTS
// ============================================================================

const DEFAULT_DEDUPE_WINDOW_MS = 5_000;
const DEFAULT_MAX_HISTORY = 200;
const DEFAULT_HIGH_SOVEREIGNTY_THRESHOLD = 80;
const ADAPTER_SOURCE_TAG = 'SovereigntyExportSignalAdapter';

/** Priority weights by artifact format. */
const FORMAT_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  JSON: 60,
  PDF:  75,
  PNG:  70,
});

/** Priority weights by grade. */
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

/** Priority weights by badge tier. */
const BADGE_TIER_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  LEGENDARY:  100,
  EPIC:        85,
  RARE:        70,
  COMMON:      50,
  NONE:        30,
});

const NULL_LOGGER: ExportSignalAdapterLogger = Object.freeze({
  debug() {},
  warn() {},
  error() {},
});

const SYSTEM_CLOCK: ExportSignalAdapterClock = Object.freeze({
  now(): UnixMs { return asUnixMs(Date.now()); },
});

// ============================================================================
// SECTION 4 — UX MESSAGE HELPERS
// ============================================================================

/** Returns a companion-facing headline for an artifact export by format. */
export function artifactFormatHeadline(format: string): string {
  switch (format) {
    case 'JSON': return 'Sovereignty artifact exported as JSON data file.';
    case 'PDF':  return 'Sovereignty artifact exported as PDF proof document.';
    case 'PNG':  return 'Sovereignty artifact exported as PNG visual card.';
    default:     return 'Sovereignty artifact exported.';
  }
}

/** Returns a coaching message for an artifact export. */
export function artifactCoachingMessage(format: string, grade: string): string {
  const gradeNote = gradeExportNote(grade);
  switch (format) {
    case 'JSON':
      return `JSON export complete. ${gradeNote} This data file captures your full run for external analysis.`;
    case 'PDF':
      return `PDF proof document ready. ${gradeNote} Share this certificate to verify your sovereignty standing.`;
    case 'PNG':
      return `PNG visual card generated. ${gradeNote} Display your run results and sovereignty achievement.`;
    default:
      return `Export complete. ${gradeNote}`;
  }
}

/** Returns a grade-specific note for export context. */
export function gradeExportNote(grade: string): string {
  switch (grade) {
    case 'S': return 'Supreme sovereignty — this export represents peak financial discipline.';
    case 'A': return 'Grade A sovereignty — excellence confirmed in this export.';
    case 'B': return 'Grade B — strong performance captured.';
    case 'C': return 'Grade C — acceptable performance logged.';
    case 'D': return 'Grade D — below par. Study this export for improvement signals.';
    case 'F': return 'Grade F — critical failure recorded. Review audit trail carefully.';
    default:  return 'Grade result captured.';
  }
}

/** Returns a companion headline for a proof card generation. */
export function proofCardHeadline(grade: string, outcome: string): string {
  return `Proof card generated — Grade ${grade}, outcome: ${outcome}.`;
}

/** Returns a coaching message for a proof card. */
export function proofCardCoachingMessage(grade: string, sovereigntyScore: number): string {
  const scorePct = Math.round(sovereigntyScore);
  if (grade === 'S' || grade === 'A') {
    return `Your proof card shows Grade ${grade} at ${scorePct}% sovereignty. This is the path of financial freedom.`;
  }
  if (grade === 'B' || grade === 'C') {
    return `Proof card stamped at Grade ${grade}, ${scorePct}% sovereignty. Tighten financial discipline for a higher grade.`;
  }
  return `Proof card recorded at Grade ${grade}, ${scorePct}% sovereignty. Analyze pressure exposure and economy timing.`;
}

/** Returns a companion headline for a leaderboard update. */
export function leaderboardHeadline(totalEntries: number): string {
  return `Leaderboard updated — ${totalEntries} runs ranked.`;
}

/** Returns a coaching message for a leaderboard update. */
export function leaderboardCoachingMessage(averageCordScore: number, topScore: number): string {
  const avgFmt = averageCordScore.toFixed(3);
  const topFmt = topScore.toFixed(1);
  return `Leaderboard refreshed. Average CORD score: ${avgFmt}. Top sovereignty score: ${topFmt}. Study the leaders to sharpen your strategy.`;
}

/** Returns a companion headline for a grade narrative. */
export function gradeNarrativeHeadline(grade: string): string {
  return `Grade ${grade} narrative generated — review your performance story.`;
}

/** Returns a companion headline for an audit entry. */
export function auditEntryHeadline(format: string, grade: string): string {
  return `Export audit recorded — ${format} artifact, Grade ${grade}.`;
}

/** Returns a companion headline for batch export completion. */
export function batchCompleteHeadline(batchSize: number): string {
  return `Batch export complete — ${batchSize} artifacts processed.`;
}

/** Returns a coaching message for batch completion. */
export function batchCompleteCoachingMessage(batchSize: number): string {
  if (batchSize >= 10) {
    return `Large batch of ${batchSize} exports completed. Review the batch summary for aggregate sovereignty performance.`;
  }
  if (batchSize >= 5) {
    return `Batch of ${batchSize} exports finished. Compare runs side-by-side for trend analysis.`;
  }
  return `Batch of ${batchSize} exports processed. Each artifact is now available for review.`;
}

// ============================================================================
// SECTION 5 — STANDALONE HELPER: buildExportSignalPayload
// ============================================================================

/**
 * Standalone helper that builds a base metadata payload from an
 * ExportArtifactCompat. Used by multiple adapt* methods for consistency.
 *
 * All numeric values are clamped and rounded to prevent payload injection or
 * out-of-range values reaching the chat engine.
 */
export function buildExportSignalPayload(
  artifact: ExportArtifactCompat,
  now: UnixMs,
  overrides?: Readonly<Record<string, JsonValue>>,
): Record<string, JsonValue> {
  const card = artifact.summary;
  const sov100 = clamp100(card.sovereigntyScore);
  const shieldPct = clamp100(card.shieldAverageIntegrityPct);
  const blockRate01 = clamp01(card.haterBlockRate);
  const cascadeRate01 = clamp01(card.cascadeBreakRate);
  const decisionSpeed01 = clamp01(card.decisionSpeedScore);
  const netWorth = Math.round(card.finalNetWorth);

  return {
    artifactId:               artifact.artifactId,
    runId:                    artifact.runId,
    proofHash:                artifact.proofHash,
    format:                   artifact.format,
    mimeType:                 artifact.mimeType,
    fileName:                 artifact.fileName,
    badgeTier:                artifact.badgeTier,
    checksum:                 artifact.checksum,
    grade:                    card.grade,
    outcome:                  card.outcome,
    mode:                     card.mode,
    integrityStatus:          card.integrityStatus,
    sovereigntyScore100:      sov100,
    finalNetWorth:            netWorth,
    ticksSurvived:            card.ticksSurvived,
    shieldIntegrityPct:       shieldPct,
    haterBlockRate01:         parseFloat(blockRate01.toFixed(6)),
    cascadeBreakRate01:       parseFloat(cascadeRate01.toFixed(6)),
    decisionSpeedScore01:     parseFloat(decisionSpeed01.toFixed(6)),
    proofBadges:              card.proofBadges as unknown as JsonValue,
    generatedAtMs:            artifact.generatedAtMs,
    adaptedAtMs:              now as unknown as number,
    artifactHeadline:         artifactFormatHeadline(artifact.format),
    gradeNote:                gradeExportNote(card.grade),
    ...(overrides ?? {}),
  };
}

/**
 * Standalone helper that builds a proof card metadata payload.
 */
export function buildProofCardPayload(
  card: ProofCardCompat,
  now: UnixMs,
  overrides?: Readonly<Record<string, JsonValue>>,
): Record<string, JsonValue> {
  const sov100 = clamp100(card.sovereigntyScore);
  const shieldPct = clamp100(card.shieldAverageIntegrityPct);
  const blockRate01 = clamp01(card.haterBlockRate);
  const cascadeRate01 = clamp01(card.cascadeBreakRate);
  const decisionSpeed01 = clamp01(card.decisionSpeedScore);
  const netWorth = Math.round(card.finalNetWorth);

  return {
    runId:                    card.runId,
    proofHash:                card.proofHash,
    playerHandle:             card.playerHandle,
    mode:                     card.mode,
    outcome:                  card.outcome,
    grade:                    card.grade,
    badgeTier:                card.badgeTier,
    integrityStatus:          card.integrityStatus,
    sovereigntyScore100:      sov100,
    finalNetWorth:            netWorth,
    ticksSurvived:            card.ticksSurvived,
    shieldIntegrityPct:       shieldPct,
    haterBlockRate01:         parseFloat(blockRate01.toFixed(6)),
    cascadeBreakRate01:       parseFloat(cascadeRate01.toFixed(6)),
    decisionSpeedScore01:     parseFloat(decisionSpeed01.toFixed(6)),
    proofBadges:              card.proofBadges as unknown as JsonValue,
    generatedAtMs:            card.generatedAtMs,
    adaptedAtMs:              now as unknown as number,
    proofCardHeadline:        proofCardHeadline(card.grade, card.outcome),
    proofCardCoaching:        proofCardCoachingMessage(card.grade, card.sovereigntyScore),
    ...(overrides ?? {}),
  };
}

// ============================================================================
// SECTION 6 — INTERNAL HELPERS
// ============================================================================

/** Determine the adapter severity level from grade. */
function gradeSeverity(grade: string): ExportSignalAdapterSeverity {
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

/** Determine the adapter severity from an audit entry's integrity status. */
function auditSeverity(integrityStatus: string): ExportSignalAdapterSeverity {
  switch (integrityStatus) {
    case 'QUARANTINED': return 'CRITICAL';
    case 'UNVERIFIED':  return 'WARN';
    case 'VERIFIED':    return 'INFO';
    default:            return 'DEBUG';
  }
}

/** Map artifact format to canonical event name. */
function artifactEventName(format: string): ExportSignalAdapterEventName {
  switch (format) {
    case 'JSON': return 'export.artifact.json';
    case 'PDF':  return 'export.artifact.pdf';
    case 'PNG':  return 'export.artifact.png';
    default:     return 'export.artifact.json';
  }
}

/** Compute heat multiplier for an artifact export based on grade and format. */
function artifactHeat(grade: string, format: string): Score01 {
  const gradeWeight = (GRADE_PRIORITY[grade] ?? 50) / 100;
  const formatWeight = (FORMAT_PRIORITY[format] ?? 60) / 100;
  return clamp01(gradeWeight * 0.7 + formatWeight * 0.3);
}

/** Compute heat multiplier for a proof card based on grade. */
function proofCardHeat(grade: string): Score01 {
  const gradeWeight = (GRADE_PRIORITY[grade] ?? 50) / 100;
  return clamp01(gradeWeight * 0.8 + 0.2);
}

/** Compute heat multiplier for a leaderboard update based on entry count. */
function leaderboardHeat(totalEntries: number): Score01 {
  const entryFactor = Math.min(totalEntries / 100, 1.0);
  return clamp01(0.4 + entryFactor * 0.4);
}

/** Build a frozen LIVEOPS ChatSignalEnvelope from export signal data. */
function buildExportLiveopsEnvelope(
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
// SECTION 7 — SovereigntyExportSignalAdapter CLASS
// ============================================================================

/**
 * Adapts SovereigntyExportAdapter outputs into authoritative backend-chat
 * ingress envelopes.
 *
 * Filtering policy (in priority order):
 * - Proof card generated signals: always accepted (alwaysAcceptProofCards)
 * - Grade A/S artifact exports: always accepted (alwaysAcceptHighGradeExports)
 * - Critical audit entries (QUARANTINED integrity): always accepted
 * - All other signals: subject to dedupeWindowMs
 * - ML/DL vectors: only emitted when emitMLVectors / emitDLTensors is true
 */
export class SovereigntyExportSignalAdapter {
  private readonly opts: Readonly<Required<SovereigntyExportSignalAdapterOptions>>;
  private readonly logger: ExportSignalAdapterLogger;
  private readonly clock: ExportSignalAdapterClock;

  private readonly _history: ChatSignalEnvelope[] = [];
  private readonly _lastAcceptedAt: Map<string, UnixMs> = new Map();

  // ── Stats counters ─────────────────────────────────────────────────────────
  private _totalAdapted        = 0;
  private _totalSuppressed     = 0;
  private _totalDeduped        = 0;
  private _artifactsAdapted    = 0;
  private _jsonArtifacts       = 0;
  private _pdfArtifacts        = 0;
  private _pngArtifacts        = 0;
  private _proofCards          = 0;
  private _leaderboardUpdates  = 0;
  private _gradeNarratives     = 0;
  private _auditEntries        = 0;
  private _mlVectors           = 0;
  private _dlTensors           = 0;
  private _batchCompletions    = 0;
  private _highGradeExports    = 0;

  public constructor(options: SovereigntyExportSignalAdapterOptions) {
    this.logger = options.logger ?? NULL_LOGGER;
    this.clock  = options.clock  ?? SYSTEM_CLOCK;

    this.opts = Object.freeze({
      defaultRoomId:               options.defaultRoomId,
      defaultVisibleChannel:       options.defaultVisibleChannel        ?? 'GLOBAL',
      dedupeWindowMs:              options.dedupeWindowMs               ?? DEFAULT_DEDUPE_WINDOW_MS,
      maxHistory:                  options.maxHistory                   ?? DEFAULT_MAX_HISTORY,
      alwaysAcceptProofCards:      options.alwaysAcceptProofCards       ?? true,
      alwaysAcceptHighGradeExports: options.alwaysAcceptHighGradeExports ?? true,
      alwaysAcceptCriticalAudit:   options.alwaysAcceptCriticalAudit    ?? true,
      emitMLVectors:               options.emitMLVectors                ?? false,
      emitDLTensors:               options.emitDLTensors                ?? false,
      highSovereigntyThreshold:    options.highSovereigntyThreshold     ?? DEFAULT_HIGH_SOVEREIGNTY_THRESHOLD,
      logger:                      this.logger,
      clock:                       this.clock,
    } as Required<SovereigntyExportSignalAdapterOptions>);
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
    this.logger.debug(`SovereigntyExportSignalAdapter: suppressed — ${reason}`, details);
    return null;
  }

  private dedupe(eventName: string, key: string): null {
    this._totalDeduped++;
    this.logger.debug('SovereigntyExportSignalAdapter: deduped', { eventName, key });
    return null;
  }

  private resolveRoom(ctx?: ExportSignalAdapterContext): ChatRoomId | string {
    return (ctx?.roomId ?? this.opts.defaultRoomId) as ChatRoomId | string;
  }

  private resolveTags(
    baseTags: string[],
    ctx?: ExportSignalAdapterContext,
  ): string[] {
    return [ADAPTER_SOURCE_TAG, ...baseTags, ...(ctx?.tags ?? [])];
  }

  private incrementFormatCounter(format: string): void {
    switch (format) {
      case 'JSON': this._jsonArtifacts++; break;
      case 'PDF':  this._pdfArtifacts++;  break;
      case 'PNG':  this._pngArtifacts++;  break;
    }
  }

  // ── Public adapt* methods ───────────────────────────────────────────────────

  /**
   * Adapt an ExportArtifact into the appropriate export.artifact.* ChatSignalEnvelope.
   *
   * Grade A/S exports are always accepted when alwaysAcceptHighGradeExports is
   * true. High sovereignty scores (>= threshold) boost priority. All other
   * artifact exports are subject to deduplication.
   */
  public adaptArtifactExport(
    artifact: ExportArtifactCompat,
    ctx?: ExportSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const grade     = artifact.summary.grade;
    const eventName = artifactEventName(artifact.format);
    const dedupeKey = `export.artifact:${artifact.runId}:${artifact.artifactId}:${artifact.format}`;

    const isHighGrade    = (grade === 'A' || grade === 'S') && this.opts.alwaysAcceptHighGradeExports;
    const isAlwaysAccept = isHighGrade;

    if (!isAlwaysAccept && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const sov100   = clamp100(artifact.summary.sovereigntyScore);
    const heat     = artifactHeat(grade, artifact.format);
    const priority = GRADE_PRIORITY[grade] ?? 55;
    const isHighSov = sov100 >= this.opts.highSovereigntyThreshold;

    const payload = buildExportSignalPayload(artifact, now, {
      eventName,
      channel:         (ctx?.routeChannel ?? this.opts.defaultVisibleChannel) as unknown as string,
      priority:        isHighSov ? Math.min(priority + 10, 100) : priority,
      coachingMessage: artifactCoachingMessage(artifact.format, grade),
      adapterSeverity: gradeSeverity(grade),
      isHighGrade:     grade === 'A' || grade === 'S',
      isHighSovereignty: isHighSov,
      source:          ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:            this.resolveTags(['artifact', artifact.format.toLowerCase()], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    });

    const isGradeF = grade === 'F';
    const envelope = buildExportLiveopsEnvelope(
      eventName, roomId, heat, isGradeF, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._artifactsAdapted++;
    this.incrementFormatCounter(artifact.format);
    if (grade === 'A' || grade === 'S') this._highGradeExports++;

    this.logger.debug(`SovereigntyExportSignalAdapter: ${eventName} accepted`, {
      runId: artifact.runId, format: artifact.format, grade,
    });

    return envelope;
  }

  /**
   * Adapt a ProofCard into a export.proof_card.generated ChatSignalEnvelope.
   *
   * Always accepted when alwaysAcceptProofCards is true (the default) — proof
   * cards are high-value milestone events that deserve companion coaching.
   */
  public adaptProofCardGenerated(
    card: ProofCardCompat,
    ctx?: ExportSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: ExportSignalAdapterEventName = 'export.proof_card.generated';
    const dedupeKey = `export.proof_card:${card.runId}:${card.proofHash}`;

    const isAlwaysAccept = this.opts.alwaysAcceptProofCards;

    if (!isAlwaysAccept && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const sov100 = clamp100(card.sovereigntyScore);
    const heat   = proofCardHeat(card.grade);

    const payload = buildProofCardPayload(card, now, {
      eventName,
      channel:         (ctx?.routeChannel ?? this.opts.defaultVisibleChannel) as unknown as string,
      priority:        GRADE_PRIORITY[card.grade] ?? 55,
      adapterSeverity: gradeSeverity(card.grade),
      source:          ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:            this.resolveTags(['proof_card', card.grade.toLowerCase()], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    });

    const isGradeF = card.grade === 'F';
    const envelope = buildExportLiveopsEnvelope(
      eventName, roomId, heat, isGradeF, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._proofCards++;

    this.logger.debug('SovereigntyExportSignalAdapter: export.proof_card.generated accepted', {
      runId: card.runId, grade: card.grade, sovereigntyScore: sov100 as unknown as number,
    });

    return envelope;
  }

  /**
   * Adapt a LeaderboardProjection into an export.leaderboard.updated ChatSignalEnvelope.
   *
   * Subject to normal deduplication. Leaderboard refreshes inform the
   * companion about competitive context.
   */
  public adaptLeaderboardUpdate(
    projection: LeaderboardProjectionCompat,
    ctx?: ExportSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: ExportSignalAdapterEventName = 'export.leaderboard.updated';
    const dedupeKey = `export.leaderboard:${projection.totalEntries}:${projection.generatedAtMs}`;

    if (this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const avgCord01 = clamp01(projection.averageCordScore);
    const topScore100 = clamp100(projection.topScore);
    const heat = leaderboardHeat(projection.totalEntries);

    const payload: Record<string, JsonValue> = {
      eventName,
      totalEntries:         projection.totalEntries,
      gradeDistribution:    projection.gradeDistribution as unknown as JsonValue,
      averageCordScore01:   parseFloat(avgCord01.toFixed(6)),
      topScore100,
      bottomScore:          projection.bottomScore,
      generatedAtMs:        projection.generatedAtMs,
      adaptedAtMs:          now as unknown as number,
      channel:              (ctx?.routeChannel ?? this.opts.defaultVisibleChannel) as unknown as string,
      priority:             65,
      leaderboardHeadline:  leaderboardHeadline(projection.totalEntries),
      leaderboardCoaching:  leaderboardCoachingMessage(projection.averageCordScore, projection.topScore),
      source:               ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:                 this.resolveTags(['leaderboard'], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildExportLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._leaderboardUpdates++;

    this.logger.debug('SovereigntyExportSignalAdapter: export.leaderboard.updated accepted', {
      totalEntries: projection.totalEntries,
      averageCordScore: parseFloat(avgCord01.toFixed(6)),
    });

    return envelope;
  }

  /**
   * Adapt a grade narrative into an export.grade.narrative ChatSignalEnvelope.
   *
   * Grade narratives provide companion-facing storytelling about run performance.
   * Subject to normal deduplication.
   */
  public adaptGradeNarrative(
    narrative: GradeNarrativeCompat,
    ctx?: ExportSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: ExportSignalAdapterEventName = 'export.grade.narrative';
    const dedupeKey = `export.grade.narrative:${narrative.runId}:${narrative.grade}`;

    if (this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const sov100  = clamp100(narrative.sovereigntyScore);
    const heat    = clamp01((GRADE_PRIORITY[narrative.grade] ?? 50) / 100);
    const priority = GRADE_PRIORITY[narrative.grade] ?? 55;

    const payload: Record<string, JsonValue> = {
      eventName,
      runId:                 narrative.runId,
      grade:                 narrative.grade,
      sovereigntyScore100:   sov100,
      gradeLabel:            narrative.gradeLabel,
      narrativeText:         narrative.narrativeText,
      improvementHints:      narrative.improvementHints as unknown as JsonValue,
      generatedAtMs:         narrative.generatedAtMs,
      adaptedAtMs:           now as unknown as number,
      channel:               (ctx?.routeChannel ?? this.opts.defaultVisibleChannel) as unknown as string,
      priority,
      narrativeHeadline:     gradeNarrativeHeadline(narrative.grade),
      gradeNote:             gradeExportNote(narrative.grade),
      adapterSeverity:       gradeSeverity(narrative.grade),
      source:                ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:                  this.resolveTags(['narrative', narrative.grade.toLowerCase()], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildExportLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._gradeNarratives++;

    this.logger.debug('SovereigntyExportSignalAdapter: export.grade.narrative accepted', {
      runId: narrative.runId, grade: narrative.grade,
    });

    return envelope;
  }

  /**
   * Adapt an ExportMLVector into an export.ml.vector_emitted ChatSignalEnvelope.
   *
   * Gated — only emitted when emitMLVectors is true. ML vectors are diagnostic
   * signals for offline analytics and model training, not for companion coaching.
   */
  public adaptMLVector(
    vector: ExportMLVectorCompat,
    ctx?: ExportSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    if (!this.opts.emitMLVectors) {
      return this.suppress('ML vectors disabled', { dimensionality: vector.dimensionality });
    }

    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: ExportSignalAdapterEventName = 'export.ml.vector_emitted';
    const dedupeKey = `export.ml.vector:${vector.checksum}`;

    if (this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const featureCount = vector.features.length;
    const featureMean  = featureCount > 0
      ? clamp01(vector.features.reduce((sum, v) => sum + v, 0) / featureCount)
      : clamp01(0);
    const heat = clamp01(0.3);

    const payload: Record<string, JsonValue> = {
      eventName,
      dimensionality:    vector.dimensionality,
      featureCount,
      featureMean01:     parseFloat(featureMean.toFixed(6)),
      checksum:          vector.checksum,
      extractedAtMs:     vector.extractedAtMs,
      adaptedAtMs:       now as unknown as number,
      channel:           (ctx?.routeChannel ?? this.opts.defaultVisibleChannel) as unknown as string,
      priority:          30,
      source:            ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:              this.resolveTags(['ml', 'vector'], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildExportLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._mlVectors++;

    this.logger.debug('SovereigntyExportSignalAdapter: export.ml.vector_emitted accepted', {
      dimensionality: vector.dimensionality, featureCount,
    });

    return envelope;
  }

  /**
   * Adapt an ExportDLTensor into an export.dl.tensor_emitted ChatSignalEnvelope.
   *
   * Gated — only emitted when emitDLTensors is true. DL tensors are deep-learning
   * input vectors for offline model training, not for companion coaching.
   */
  public adaptDLTensor(
    tensor: ExportDLTensorCompat,
    ctx?: ExportSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    if (!this.opts.emitDLTensors) {
      return this.suppress('DL tensors disabled', { dimensionality: tensor.dimensionality });
    }

    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: ExportSignalAdapterEventName = 'export.dl.tensor_emitted';
    const dedupeKey = `export.dl.tensor:${tensor.checksum}`;

    if (this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const featureCount = tensor.features.length;
    const featureMean  = featureCount > 0
      ? clamp01(tensor.features.reduce((sum, v) => sum + v, 0) / featureCount)
      : clamp01(0);
    const heat = clamp01(0.25);

    const payload: Record<string, JsonValue> = {
      eventName,
      dimensionality:    tensor.dimensionality,
      featureCount,
      featureMean01:     parseFloat(featureMean.toFixed(6)),
      checksum:          tensor.checksum,
      shape:             tensor.shape as unknown as JsonValue,
      extractedAtMs:     tensor.extractedAtMs,
      adaptedAtMs:       now as unknown as number,
      channel:           (ctx?.routeChannel ?? this.opts.defaultVisibleChannel) as unknown as string,
      priority:          25,
      source:            ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:              this.resolveTags(['dl', 'tensor'], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildExportLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._dlTensors++;

    this.logger.debug('SovereigntyExportSignalAdapter: export.dl.tensor_emitted accepted', {
      dimensionality: tensor.dimensionality, featureCount,
    });

    return envelope;
  }

  /**
   * Adapt an ExportAuditEntry into an export.audit.entry ChatSignalEnvelope.
   *
   * Audit entries with QUARANTINED integrity status are always accepted when
   * alwaysAcceptCriticalAudit is true. All other entries are subject to
   * deduplication.
   */
  public adaptAuditEntry(
    entry: ExportAuditEntryCompat,
    ctx?: ExportSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: ExportSignalAdapterEventName = 'export.audit.entry';
    const dedupeKey = `export.audit:${entry.entryId}`;

    const isCritical     = entry.integrityStatus === 'QUARANTINED' && this.opts.alwaysAcceptCriticalAudit;
    const isAlwaysAccept = isCritical;

    if (!isAlwaysAccept && this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const severity = auditSeverity(entry.integrityStatus);
    const priority = INTEGRITY_PRIORITY[entry.integrityStatus] ?? 40;
    const heat     = clamp01(priority / 100);

    const payload: Record<string, JsonValue> = {
      eventName,
      entryId:             entry.entryId,
      runId:               entry.runId,
      artifactId:          entry.artifactId,
      format:              entry.format,
      grade:               entry.grade,
      integrityStatus:     entry.integrityStatus,
      proofHash:           entry.proofHash,
      exportChecksum:      entry.exportChecksum,
      exportSizeBytes:     entry.exportSizeBytes,
      hmacSignature:       entry.hmacSignature,
      createdAtMs:         entry.createdAtMs,
      adaptedAtMs:         now as unknown as number,
      channel:             (ctx?.routeChannel ?? this.opts.defaultVisibleChannel) as unknown as string,
      priority,
      adapterSeverity:     severity,
      isQuarantined:       entry.integrityStatus === 'QUARANTINED',
      auditHeadline:       auditEntryHeadline(entry.format, entry.grade),
      source:              ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:                this.resolveTags(['audit', entry.integrityStatus.toLowerCase()], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };

    const isQuarantined = entry.integrityStatus === 'QUARANTINED';
    const envelope = buildExportLiveopsEnvelope(
      eventName, roomId, heat, isQuarantined, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._auditEntries++;

    this.logger.debug('SovereigntyExportSignalAdapter: export.audit.entry accepted', {
      entryId: entry.entryId, integrityStatus: entry.integrityStatus,
    });

    return envelope;
  }

  /**
   * Adapt a batch export completion into an export.batch.complete ChatSignalEnvelope.
   *
   * Subject to normal deduplication. Batch completions are informational signals
   * that help the companion convey export pipeline status.
   */
  public adaptBatchExportComplete(
    batchSize: number,
    ctx?: ExportSignalAdapterContext,
  ): ChatSignalEnvelope | null {
    const now       = this.clock.now();
    const roomId    = this.resolveRoom(ctx);
    const eventName: ExportSignalAdapterEventName = 'export.batch.complete';
    const dedupeKey = `export.batch:${batchSize}:${now as unknown as number}`;

    if (this.isDeduped(dedupeKey, now)) {
      return this.dedupe(eventName, dedupeKey);
    }

    const clampedBatchSize = Math.max(0, Math.round(batchSize));
    const heat = clamp01(Math.min(clampedBatchSize / 20, 1.0) * 0.6 + 0.2);
    const priority = clampedBatchSize >= 10 ? 70 : clampedBatchSize >= 5 ? 55 : 40;

    const payload: Record<string, JsonValue> = {
      eventName,
      batchSize:            clampedBatchSize,
      adaptedAtMs:          now as unknown as number,
      channel:              (ctx?.routeChannel ?? this.opts.defaultVisibleChannel) as unknown as string,
      priority,
      batchHeadline:        batchCompleteHeadline(clampedBatchSize),
      batchCoaching:        batchCompleteCoachingMessage(clampedBatchSize),
      source:               ctx?.source ?? ADAPTER_SOURCE_TAG,
      tags:                 this.resolveTags(['batch'], ctx) as unknown as JsonValue,
      ...(ctx?.metadata ?? {}),
    };

    const envelope = buildExportLiveopsEnvelope(
      eventName, roomId, heat, false, payload, now,
    );

    this.markAccepted(dedupeKey, envelope, now);
    this._batchCompletions++;

    this.logger.debug('SovereigntyExportSignalAdapter: export.batch.complete accepted', {
      batchSize: clampedBatchSize,
    });

    return envelope;
  }

  // ── State query methods ────────────────────────────────────────────────────

  /** Returns cumulative adapter stats. */
  public getStats(): ExportSignalAdapterStats {
    return Object.freeze({
      totalAdapted:           this._totalAdapted,
      totalSuppressed:        this._totalSuppressed,
      totalDeduped:           this._totalDeduped,
      artifactsAdapted:       this._artifactsAdapted,
      jsonArtifacts:          this._jsonArtifacts,
      pdfArtifacts:           this._pdfArtifacts,
      pngArtifacts:           this._pngArtifacts,
      proofCardsAdapted:      this._proofCards,
      leaderboardUpdates:     this._leaderboardUpdates,
      gradeNarrativesAdapted: this._gradeNarratives,
      auditEntriesAdapted:    this._auditEntries,
      mlVectorsEmitted:       this._mlVectors,
      dlTensorsEmitted:       this._dlTensors,
      batchCompletions:       this._batchCompletions,
      highGradeExportCount:   this._highGradeExports,
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
    this.logger.debug('SovereigntyExportSignalAdapter: history cleared', {});
  }

  /** Resets all stats counters to zero. Does not clear history. */
  public resetStats(): void {
    this._totalAdapted      = 0;
    this._totalSuppressed   = 0;
    this._totalDeduped      = 0;
    this._artifactsAdapted  = 0;
    this._jsonArtifacts     = 0;
    this._pdfArtifacts      = 0;
    this._pngArtifacts      = 0;
    this._proofCards        = 0;
    this._leaderboardUpdates = 0;
    this._gradeNarratives   = 0;
    this._auditEntries      = 0;
    this._mlVectors         = 0;
    this._dlTensors         = 0;
    this._batchCompletions  = 0;
    this._highGradeExports  = 0;
    this.logger.debug('SovereigntyExportSignalAdapter: stats reset', {});
  }
}

// ============================================================================
// SECTION 8 — BATCH HELPERS
// ============================================================================

/**
 * Adapt all signal types from a single ExportArtifact in canonical emission
 * order: artifact → proof card → audit entry → ml → dl.
 *
 * Returns only non-null envelopes. Callers can pass the full array to the
 * ChatEngine ingress surface for ordered delivery.
 *
 * The adapter's dedupe state ensures downstream idempotence even if this
 * function is called multiple times for the same artifact.
 */
export function adaptAllExportSignals(
  adapter: SovereigntyExportSignalAdapter,
  artifact: ExportArtifactCompat,
  auditEntry?: ExportAuditEntryCompat,
  mlVector?: ExportMLVectorCompat,
  dlTensor?: ExportDLTensorCompat,
  ctx?: ExportSignalAdapterContext,
): readonly ChatSignalEnvelope[] {
  const envelopes: ChatSignalEnvelope[] = [];

  const artifactEnv = adapter.adaptArtifactExport(artifact, ctx);
  if (artifactEnv !== null) envelopes.push(artifactEnv);

  const proofCardEnv = adapter.adaptProofCardGenerated(artifact.summary, ctx);
  if (proofCardEnv !== null) envelopes.push(proofCardEnv);

  if (auditEntry !== undefined) {
    const auditEnv = adapter.adaptAuditEntry(auditEntry, ctx);
    if (auditEnv !== null) envelopes.push(auditEnv);
  }

  if (mlVector !== undefined) {
    const mlEnv = adapter.adaptMLVector(mlVector, ctx);
    if (mlEnv !== null) envelopes.push(mlEnv);
  }

  if (dlTensor !== undefined) {
    const dlEnv = adapter.adaptDLTensor(dlTensor, ctx);
    if (dlEnv !== null) envelopes.push(dlEnv);
  }

  return Object.freeze(envelopes);
}

/**
 * Adapt a complete export bundle — artifact, proof card, leaderboard,
 * narrative, audit entry, ML vector, DL tensor — in one call.
 *
 * Emits only envelopes that pass the adapter's filtering rules. Returns the
 * frozen array in emission order:
 *   artifact → proof card → leaderboard → narrative → audit → ml → dl
 */
export function adaptExportBundle(
  adapter: SovereigntyExportSignalAdapter,
  artifact: ExportArtifactCompat,
  leaderboard?: LeaderboardProjectionCompat,
  narrative?: GradeNarrativeCompat,
  auditEntry?: ExportAuditEntryCompat,
  mlVector?: ExportMLVectorCompat,
  dlTensor?: ExportDLTensorCompat,
  ctx?: ExportSignalAdapterContext,
): readonly ChatSignalEnvelope[] {
  const envelopes: ChatSignalEnvelope[] = [];

  const artifactEnv = adapter.adaptArtifactExport(artifact, ctx);
  if (artifactEnv !== null) envelopes.push(artifactEnv);

  const proofCardEnv = adapter.adaptProofCardGenerated(artifact.summary, ctx);
  if (proofCardEnv !== null) envelopes.push(proofCardEnv);

  if (leaderboard !== undefined) {
    const lbEnv = adapter.adaptLeaderboardUpdate(leaderboard, ctx);
    if (lbEnv !== null) envelopes.push(lbEnv);
  }

  if (narrative !== undefined) {
    const narEnv = adapter.adaptGradeNarrative(narrative, ctx);
    if (narEnv !== null) envelopes.push(narEnv);
  }

  if (auditEntry !== undefined) {
    const auditEnv = adapter.adaptAuditEntry(auditEntry, ctx);
    if (auditEnv !== null) envelopes.push(auditEnv);
  }

  if (mlVector !== undefined) {
    const mlEnv = adapter.adaptMLVector(mlVector, ctx);
    if (mlEnv !== null) envelopes.push(mlEnv);
  }

  if (dlTensor !== undefined) {
    const dlEnv = adapter.adaptDLTensor(dlTensor, ctx);
    if (dlEnv !== null) envelopes.push(dlEnv);
  }

  return Object.freeze(envelopes);
}

/**
 * Adapt an array of ExportAuditEntries into ChatSignalEnvelopes.
 *
 * Entries are processed in the order supplied — typically chronological
 * createdAtMs order as emitted by the SovereigntyExportAdapter audit trail.
 * QUARANTINED entries will always pass through when alwaysAcceptCriticalAudit
 * is true.
 */
export function adaptExportAuditBatch(
  adapter: SovereigntyExportSignalAdapter,
  entries: readonly ExportAuditEntryCompat[],
  ctx?: ExportSignalAdapterContext,
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
 * Convenience factory that creates a SovereigntyExportSignalAdapter with
 * production-safe defaults:
 * - alwaysAcceptProofCards: true
 * - alwaysAcceptHighGradeExports: true
 * - alwaysAcceptCriticalAudit: true
 * - emitMLVectors: false (opt-in)
 * - emitDLTensors: false (opt-in)
 * - dedupeWindowMs: 5000
 * - maxHistory: 200
 * - highSovereigntyThreshold: 80
 */
export function createSovereigntyExportSignalAdapter(
  defaultRoomId: ChatRoomId | string,
  overrides?: Partial<SovereigntyExportSignalAdapterOptions>,
): SovereigntyExportSignalAdapter {
  return new SovereigntyExportSignalAdapter({
    defaultRoomId,
    defaultVisibleChannel:       'GLOBAL',
    dedupeWindowMs:              DEFAULT_DEDUPE_WINDOW_MS,
    maxHistory:                  DEFAULT_MAX_HISTORY,
    alwaysAcceptProofCards:      true,
    alwaysAcceptHighGradeExports: true,
    alwaysAcceptCriticalAudit:   true,
    emitMLVectors:               false,
    emitDLTensors:               false,
    highSovereigntyThreshold:    DEFAULT_HIGH_SOVEREIGNTY_THRESHOLD,
    ...overrides,
  });
}

// ============================================================================
// SECTION 10 — SELF-DESCRIPTION MANIFEST
// ============================================================================

/** Static manifest describing this adapter's event vocabulary and capabilities. */
export const EXPORT_SIGNAL_ADAPTER_MANIFEST = Object.freeze({
  adapterName:    'SovereigntyExportSignalAdapter',
  version:        '2026.03.26',
  sourceFile:     'backend/src/game/engine/chat/adapters/SovereigntyExportSignalAdapter.ts',
  signalType:     'LIVEOPS' as const,
  events: Object.freeze([
    'export.artifact.json',
    'export.artifact.pdf',
    'export.artifact.png',
    'export.proof_card.generated',
    'export.leaderboard.updated',
    'export.grade.narrative',
    'export.ml.vector_emitted',
    'export.dl.tensor_emitted',
    'export.audit.entry',
    'export.batch.complete',
  ] as const),
  designLaws: Object.freeze([
    'No circular imports from core/ — all types mirrored structurally.',
    'Proof card generated signals always accepted (high-value milestones).',
    'Grade A/S artifact exports always accepted (sovereignty excellence).',
    'QUARANTINED audit entries always accepted (helperBlackout=true).',
    'ML/DL vectors only emitted when flags are enabled.',
    'All runtime functions (asUnixMs, clamp01, clamp100) consumed in runtime code.',
    'Dedupe is per (runId + artifactId + eventClass) key.',
    'History is ring-buffered at maxHistory entries.',
  ] as const),
});
