// backend/src/game/engine/zero/EventFlushCoordinator.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/EventFlushCoordinator.ts
 * VERSION: event-flush-coordinator.v4.2026
 *
 * Doctrine:
 * - backend core EventBus already owns emission + queue/history mechanics
 * - Engine 0 owns the tick boundary where queued envelopes are drained,
 *   canonically hashed, and reflected back into snapshot telemetry
 * - flush coordination must never invent a second bus or mutate envelope order
 * - the checksum projection must stay stable with the existing backend 15X
 *   event-seal doctrine so proof surfaces do not drift
 * - ML/DL extraction, chat signals, trend analysis, recovery forecasting,
 *   session analytics, and Merkle-chain integrity are all first-class surfaces
 *   of the flush coordinator — every flush tick is scored and narrated
 * - every event envelope drained at STEP_13_FLUSH is a data point in the
 *   user-experience curve: frequency, distribution, tagging, and sequencing
 *   all feed into ML vectors and DL tensors that drive companion commentary
 *   and liveops signal routing
 *
 * Surface summary:
 *   § 1  — Internal utility types + Mutable<T>
 *   § 2  — Module metadata + public constants
 *   § 3  — Public domain types (options, digest, result, analytics records)
 *   § 4  — ML feature label constants (32-dim)
 *   § 5  — DL tensor label constants (40×8)
 *   § 6  — Flush history ring buffer
 *   § 7  — Event distribution analyzer
 *   § 8  — ML 32-dim feature vector extraction
 *   § 9  — DL 40×8 tensor construction
 *   § 10 — Chat signal construction
 *   § 11 — Flush telemetry snapshot
 *   § 12 — Narrative generation
 *   § 13 — Flush rate controller
 *   § 14 — Tag frequency analyzer
 *   § 15 — Trend analyzer
 *   § 16 — Recovery forecaster
 *   § 17 — Session analytics
 *   § 18 — Annotation bundle
 *   § 19 — Fault boundary detection
 *   § 20 — Merkle chain coordinator
 *   § 21 — EventFlushCoordinator class (full expansion)
 *   § 22 — Well-known singletons + factories
 *   § 23 — Utility functions + public constants
 */

import {
  checksumParts,
  checksumSnapshot,
  cloneJson,
  computeTickSeal,
  createDeterministicId,
  deepFreeze,
  GENESIS_SEAL,
  MerkleChain,
  sha256,
  stableStringify,
} from '../core/Deterministic';
import type { EventBus, EventEnvelope } from '../core/EventBus';
import {
  MODE_NORMALIZED,
  PRESSURE_TIER_NORMALIZED,
  PRESSURE_TIER_URGENCY_LABEL,
  RUN_PHASE_NORMALIZED,
} from '../core/GamePrimitives';
import type { EngineEventMap, ModeCode, PressureTier, RunPhase } from '../core/GamePrimitives';
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

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

function clamp100(v: number): number {
  return clamp(v, 0, 100);
}

function safeDiv(num: number, den: number): number {
  return den === 0 ? 0 : num / den;
}

function shannonEntropy(counts: readonly number[]): number {
  const total = counts.reduce((s, c) => s + c, 0);
  if (total === 0) return 0;
  let h = 0;
  for (const c of counts) {
    if (c === 0) continue;
    const p = c / total;
    h -= p * Math.log2(p);
  }
  return h;
}

function nowMs(): number {
  return Date.now();
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — Module metadata + public constants
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical version tag for this module surface. */
export const EVENT_FLUSH_MODULE_VERSION =
  'event-flush-coordinator.v4.2026' as const;

/** Whether the module is ready for use. */
export const EVENT_FLUSH_MODULE_READY = true as const;

/** Number of ML features extracted per flush tick. */
export const EFC_ML_FEATURE_COUNT = 32 as const;

/** Number of DL tensor rows (event slots per flush history window). */
export const EFC_DL_ROWS = 40 as const;

/** Number of DL tensor columns (per-event feature dims). */
export const EFC_DL_COLS = 8 as const;

/** Maximum entries retained in the flush history ring buffer. */
export const EFC_HISTORY_MAX = 256 as const;

/** Maximum envelopes considered "hot" — high-traffic tick. */
export const EFC_HOT_FLUSH_THRESHOLD = 50 as const;

/** Minimum envelopes for a non-cold tick. */
export const EFC_COLD_FLUSH_THRESHOLD = 1 as const;

/** Rate controller window (seconds) for flush-per-second tracking. */
export const EFC_RATE_WINDOW_SEC = 60 as const;

/** Budget period in milliseconds for flush rate limiting. */
export const EFC_RATE_BUDGET_MS = EFC_RATE_WINDOW_SEC * 1000;

/** Maximum unique event types before entropy saturates. */
export const EFC_MAX_UNIQUE_EVENT_TYPES = 24 as const;

/** Minimum consecutive cold flushes to trigger recovery detection. */
export const EFC_COLD_RUN_RECOVERY_THRESHOLD = 3 as const;

/** Trend window in flush records. */
export const EFC_TREND_WINDOW = 16 as const;

/** Genesis seal value for empty Merkle chains. */
export const EFC_GENESIS_SEAL: string = GENESIS_SEAL;

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — Public domain types
// ─────────────────────────────────────────────────────────────────────────────

/** Configuration options for EventFlushCoordinator. */
export interface EventFlushCoordinatorOptions {
  /** Whether to append the state checksum to sovereignty.tickChecksums. */
  readonly appendStateChecksumToSovereignty?: boolean;

  /** Whether to increment telemetry.emittedEventCount after each flush. */
  readonly incrementTelemetryEventCount?: boolean;

  /**
   * Session identifier passed to all ML/DL surfaces.
   * Auto-generated if not provided.
   */
  readonly sessionId?: string;

  /**
   * Game mode context — used by ML vector and narrative.
   * If omitted the coordinator reads it from the snapshot.
   */
  readonly modeOverride?: ModeCode;

  /**
   * Maximum history entries kept in the internal ring buffer.
   * Defaults to EFC_HISTORY_MAX.
   */
  readonly historyMax?: number;

  /**
   * Anomaly score threshold above which a chat signal is emitted.
   * Defaults to 0.6.
   */
  readonly mlAnomalyThreshold?: number;

  /**
   * Whether to chain flush seals through a MerkleChain instance.
   * Enables flush-level proof integrity across ticks.
   * Defaults to true.
   */
  readonly enableMerkleChaining?: boolean;

  /**
   * Minimum cold flushes in a row before narrative recovery language
   * is generated.
   */
  readonly coldRunRecoveryThreshold?: number;
}

/** Digest record for a single flushed event envelope. */
export interface FlushedEventDigest {
  readonly sequence: number;
  readonly event: keyof EngineEventMap;
  readonly emittedAtTick?: number;
  readonly tags?: readonly string[];
  readonly checksum: string;
}

/** Full result of one EventFlushCoordinator.flush() call. */
export interface EventFlushResult {
  readonly snapshot: RunStateSnapshot;
  readonly drained: readonly EventEnvelope<
    keyof EngineEventMap,
    EngineEventMap[keyof EngineEventMap]
  >[];
  readonly digests: readonly FlushedEventDigest[];
  readonly drainedCount: number;
  readonly stateChecksum: string;
  readonly tickSeal: string;
  /** Merkle leaf from this flush (if chaining enabled). */
  readonly merkleLeaf?: Readonly<{ index: number; nodeHash: string; dataHash: string }>;
  /** Flush session unique identifier. */
  readonly flushSessionId: string;
  /** Monotonically increasing flush index within this coordinator's lifetime. */
  readonly flushIndex: number;
}

/** Full ML vector result for a flush tick. */
export interface FlushMLVector {
  readonly sessionId: string;
  readonly tick: number;
  readonly flushIndex: number;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly anomalyScore: number;
  readonly hotFlush: boolean;
  readonly coldFlush: boolean;
  readonly extractedAtMs: number;
}

/** Full DL tensor result for a flush tick. */
export interface FlushDLTensor {
  readonly sessionId: string;
  readonly tick: number;
  readonly rows: EFC_DL_ROWS;
  readonly cols: EFC_DL_COLS;
  readonly tensor: readonly (readonly number[])[];
  readonly rowLabels: readonly string[];
  readonly colLabels: readonly string[];
  readonly l2Norm: number;
  readonly builtAtMs: number;
}

type EFC_DL_ROWS = typeof EFC_DL_ROWS;
type EFC_DL_COLS = typeof EFC_DL_COLS;

/** Chat signal emitted from a flush coordinator for LIVEOPS routing. */
export interface FlushChatSignal {
  readonly kind: 'FLUSH_NORMAL' | 'FLUSH_HOT' | 'FLUSH_COLD' | 'FLUSH_ANOMALY' | 'FLUSH_RECOVERY';
  readonly sessionId: string;
  readonly tick: number;
  readonly flushIndex: number;
  readonly drainedCount: number;
  readonly stateChecksum: string;
  readonly anomalyScore: number;
  readonly narrativeLine: string;
  readonly pressureTier: PressureTier;
  readonly phase: RunPhase;
  readonly mode: ModeCode;
  readonly merkleRoot?: string;
  readonly emittedAtMs: number;
}

/** Telemetry snapshot for this flush tick. */
export interface FlushTelemetrySnapshot {
  readonly sessionId: string;
  readonly tick: number;
  readonly flushIndex: number;
  readonly drainedCount: number;
  readonly uniqueEventTypes: number;
  readonly taggedEventRatio: number;
  readonly stateChecksum: string;
  readonly tickSeal: string;
  readonly sovereignty_tickChecksumCount: number;
  readonly emittedEventCount: number;
  readonly merkleRootAtFlush?: string;
  readonly serialized: string;
}

/** Direction category for trend analysis. */
export type FlushTrendDirection =
  | 'STABLE'
  | 'ACCELERATING'
  | 'DECELERATING'
  | 'VOLATILE'
  | 'RECOVERING';

/** Trend snapshot across recent flush ticks. */
export interface FlushTrendSnapshot {
  readonly direction: FlushTrendDirection;
  readonly drainedCountSlope: number;
  readonly anomalyScoreSlope: number;
  readonly windowSize: number;
  readonly stdDevDrained: number;
  readonly maxDrainedInWindow: number;
  readonly minDrainedInWindow: number;
  readonly consecutiveColdFlushes: number;
  readonly consecutiveHotFlushes: number;
  readonly trendConfidence: number;
}

/** Action class for recovery forecast. */
export type FlushRecoveryAction =
  | 'MAINTAIN'
  | 'REDUCE_FLUSH_FREQUENCY'
  | 'INCREASE_FLUSH_FREQUENCY'
  | 'INVESTIGATE_HOT_SOURCES'
  | 'WAIT_FOR_RECOVERY'
  | 'ALERT_OPERATOR';

/** Recovery forecast output. */
export interface FlushRecoveryForecast {
  readonly recommendedAction: FlushRecoveryAction;
  readonly confidence: number;
  readonly estimatedRecoveryTicks: number;
  readonly riskScore: number;
  readonly notes: readonly string[];
}

/** Session-level analytics for the entire coordinator lifetime. */
export interface FlushSessionReport {
  readonly sessionId: string;
  readonly totalFlushes: number;
  readonly totalDrained: number;
  readonly hotFlushCount: number;
  readonly coldFlushCount: number;
  readonly normalFlushCount: number;
  readonly anomalyFlushCount: number;
  readonly avgDrainedPerFlush: number;
  readonly peakDrainedSingleFlush: number;
  readonly sessionDurationMs: number;
  readonly uniqueEventTypesLifetime: number;
  readonly merkleRootFinal?: string;
  readonly generatedAtMs: number;
}

/** Annotation bundle for snapshot reflection. */
export interface FlushAnnotationBundle {
  readonly tick: number;
  readonly flushIndex: number;
  readonly annotations: readonly string[];
  readonly tags: readonly string[];
  readonly riskAnnotations: readonly string[];
}

/** Single entry in the flush history ring buffer. */
export interface FlushHistoryEntry {
  readonly tick: number;
  readonly flushIndex: number;
  readonly drainedCount: number;
  readonly stateChecksum: string;
  readonly tickSeal: string;
  readonly anomalyScore: number;
  readonly hotFlush: boolean;
  readonly coldFlush: boolean;
  readonly uniqueEventTypes: number;
  readonly taggedRatio: number;
  readonly flushedAtMs: number;
}

/** Event type frequency record. */
export interface EventTypeFrequencyRecord {
  readonly eventType: string;
  readonly count: number;
  readonly ratio: number;
  readonly lastSeenTick: number;
}

/** Tag frequency record. */
export interface TagFrequencyRecord {
  readonly tag: string;
  readonly count: number;
  readonly ratio: number;
  readonly lastSeenTick: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — ML feature label constants (32-dim)
// ─────────────────────────────────────────────────────────────────────────────

export const EFC_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  /* 00 */ 'drained_count_norm',
  /* 01 */ 'checksum_appended_flag',
  /* 02 */ 'telemetry_incremented_flag',
  /* 03 */ 'sovereignty_checksum_count_norm',
  /* 04 */ 'emitted_event_count_norm',
  /* 05 */ 'unique_event_types_norm',
  /* 06 */ 'tagged_event_ratio',
  /* 07 */ 'avg_tags_per_event_norm',
  /* 08 */ 'event_type_entropy_norm',
  /* 09 */ 'sequence_span_norm',
  /* 10 */ 'max_sequence_norm',
  /* 11 */ 'state_checksum_stability',
  /* 12 */ 'tick_norm',
  /* 13 */ 'phase_ordinal_norm',
  /* 14 */ 'pressure_tier_norm',
  /* 15 */ 'mode_norm',
  /* 16 */ 'flush_index_norm',
  /* 17 */ 'session_flush_rate_norm',
  /* 18 */ 'cumulative_drained_norm',
  /* 19 */ 'is_hot_flush',
  /* 20 */ 'is_cold_flush',
  /* 21 */ 'seal_entropy_norm',
  /* 22 */ 'digest_coverage_ratio',
  /* 23 */ 'sovereignty_health_score',
  /* 24 */ 'economy_net_worth_norm',
  /* 25 */ 'battle_pressure_score',
  /* 26 */ 'cascade_health_score',
  /* 27 */ 'merkle_depth_norm',
  /* 28 */ 'card_deck_entropy_norm',
  /* 29 */ 'tension_score_norm',
  /* 30 */ 'shield_integrity_norm',
  /* 31 */ 'composite_risk_score',
]);

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — DL tensor column label constants (8-dim per event row)
// ─────────────────────────────────────────────────────────────────────────────

export const EFC_DL_COL_LABELS: readonly string[] = Object.freeze([
  /* col 0 */ 'sequence_norm',
  /* col 1 */ 'event_type_hash_norm',
  /* col 2 */ 'tags_count_norm',
  /* col 3 */ 'emitted_at_tick_norm',
  /* col 4 */ 'checksum_byte0_norm',
  /* col 5 */ 'is_sovereignty_event',
  /* col 6 */ 'is_pressure_event',
  /* col 7 */ 'is_battle_event',
]);

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — Flush history ring buffer
// ─────────────────────────────────────────────────────────────────────────────

class FlushHistoryBuffer {
  private readonly _entries: FlushHistoryEntry[] = [];
  private readonly _maxSize: number;

  constructor(maxSize: number = EFC_HISTORY_MAX) {
    this._maxSize = maxSize;
  }

  push(entry: FlushHistoryEntry): void {
    this._entries.push(entry);
    if (this._entries.length > this._maxSize) {
      this._entries.shift();
    }
  }

  getAll(): readonly FlushHistoryEntry[] {
    return freezeArray(this._entries);
  }

  getLast(n: number): readonly FlushHistoryEntry[] {
    return freezeArray(this._entries.slice(-Math.max(0, n)));
  }

  size(): number {
    return this._entries.length;
  }

  clear(): void {
    this._entries.length = 0;
  }

  /** Average drained count across all entries. */
  avgDrained(): number {
    if (this._entries.length === 0) return 0;
    const sum = this._entries.reduce((s, e) => s + e.drainedCount, 0);
    return sum / this._entries.length;
  }

  /** Peak drained in a single flush across all entries. */
  peakDrained(): number {
    if (this._entries.length === 0) return 0;
    return Math.max(...this._entries.map((e) => e.drainedCount));
  }

  /** Count of hot flushes across all entries. */
  hotCount(): number {
    return this._entries.filter((e) => e.hotFlush).length;
  }

  /** Count of cold flushes across all entries. */
  coldCount(): number {
    return this._entries.filter((e) => e.coldFlush).length;
  }

  /** Consecutive cold flushes at the end of the buffer. */
  consecutiveColdAtEnd(): number {
    let count = 0;
    for (let i = this._entries.length - 1; i >= 0; i--) {
      if (this._entries[i].coldFlush) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  /** Consecutive hot flushes at the end of the buffer. */
  consecutiveHotAtEnd(): number {
    let count = 0;
    for (let i = this._entries.length - 1; i >= 0; i--) {
      if (this._entries[i].hotFlush) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  /** Standard deviation of drained counts. */
  stdDevDrained(): number {
    if (this._entries.length < 2) return 0;
    const avg = this.avgDrained();
    const variance =
      this._entries.reduce((s, e) => s + Math.pow(e.drainedCount - avg, 2), 0) /
      this._entries.length;
    return Math.sqrt(variance);
  }

  /** Slope of drained count trend (positive = increasing). */
  drainedSlope(windowSize: number = EFC_TREND_WINDOW): number {
    const window = this.getLast(windowSize);
    if (window.length < 2) return 0;
    const n = window.length;
    const indices = window.map((_, i) => i);
    const values = window.map((e) => e.drainedCount);
    const sumX = indices.reduce((s, x) => s + x, 0);
    const sumY = values.reduce((s, y) => s + y, 0);
    const sumXY = indices.reduce((s, x, i) => s + x * (values[i] ?? 0), 0);
    const sumX2 = indices.reduce((s, x) => s + x * x, 0);
    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return 0;
    return (n * sumXY - sumX * sumY) / denominator;
  }

  /** Slope of anomaly score trend. */
  anomalySlope(windowSize: number = EFC_TREND_WINDOW): number {
    const window = this.getLast(windowSize);
    if (window.length < 2) return 0;
    const n = window.length;
    const indices = window.map((_, i) => i);
    const values = window.map((e) => e.anomalyScore);
    const sumX = indices.reduce((s, x) => s + x, 0);
    const sumY = values.reduce((s, y) => s + y, 0);
    const sumXY = indices.reduce((s, x, i) => s + x * (values[i] ?? 0), 0);
    const sumX2 = indices.reduce((s, x) => s + x * x, 0);
    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return 0;
    return (n * sumXY - sumX * sumY) / denominator;
  }

  /** Total drained across all entries. */
  totalDrained(): number {
    return this._entries.reduce((s, e) => s + e.drainedCount, 0);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — Event distribution analyzer
// ─────────────────────────────────────────────────────────────────────────────

class EventDistributionAnalyzer {
  private readonly _eventCounts = new Map<string, number>();
  private readonly _eventLastTick = new Map<string, number>();
  private readonly _tagCounts = new Map<string, number>();
  private readonly _tagLastTick = new Map<string, number>();
  private _totalEvents = 0;
  private _totalTagOccurrences = 0;

  ingest(
    digests: readonly FlushedEventDigest[],
    tick: number,
  ): void {
    for (const digest of digests) {
      const key = String(digest.event);
      this._eventCounts.set(key, (this._eventCounts.get(key) ?? 0) + 1);
      this._eventLastTick.set(key, tick);
      this._totalEvents += 1;

      if (digest.tags) {
        for (const tag of digest.tags) {
          this._tagCounts.set(tag, (this._tagCounts.get(tag) ?? 0) + 1);
          this._tagLastTick.set(tag, tick);
          this._totalTagOccurrences += 1;
        }
      }
    }
  }

  getEventFrequencies(): readonly EventTypeFrequencyRecord[] {
    const records: EventTypeFrequencyRecord[] = [];
    for (const [eventType, count] of this._eventCounts.entries()) {
      records.push({
        eventType,
        count,
        ratio: safeDiv(count, this._totalEvents),
        lastSeenTick: this._eventLastTick.get(eventType) ?? 0,
      });
    }
    return freezeArray(records.sort((a, b) => b.count - a.count));
  }

  getTagFrequencies(): readonly TagFrequencyRecord[] {
    const records: TagFrequencyRecord[] = [];
    for (const [tag, count] of this._tagCounts.entries()) {
      records.push({
        tag,
        count,
        ratio: safeDiv(count, this._totalTagOccurrences),
        lastSeenTick: this._tagLastTick.get(tag) ?? 0,
      });
    }
    return freezeArray(records.sort((a, b) => b.count - a.count));
  }

  uniqueEventTypeCount(): number {
    return this._eventCounts.size;
  }

  totalEvents(): number {
    return this._totalEvents;
  }

  entropy(): number {
    const counts = Array.from(this._eventCounts.values());
    return shannonEntropy(counts);
  }

  computeEventTypeHashNorm(eventType: string): number {
    // Use sha256 of event name, take first two hex chars as a byte value
    const hex = sha256(eventType);
    const byte0 = parseInt(hex.substring(0, 2), 16);
    return byte0 / 255;
  }

  reset(): void {
    this._eventCounts.clear();
    this._eventLastTick.clear();
    this._tagCounts.clear();
    this._tagLastTick.clear();
    this._totalEvents = 0;
    this._totalTagOccurrences = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — ML 32-dim feature vector extraction
// ─────────────────────────────────────────────────────────────────────────────

export interface FlushMLContext {
  readonly snapshot: RunStateSnapshot;
  readonly drainedCount: number;
  readonly digests: readonly FlushedEventDigest[];
  readonly stateChecksum: string;
  readonly tickSeal: string;
  readonly flushIndex: number;
  readonly cumulativeDrained: number;
  readonly sessionStartMs: number;
  readonly previousChecksum: string | null;
  readonly merkleDepth: number;
  readonly options: Required<EventFlushCoordinatorOptions>;
}

function _extractFlushMLFeatures(ctx: FlushMLContext): readonly number[] {
  const {
    snapshot,
    drainedCount,
    digests,
    stateChecksum,
    flushIndex,
    cumulativeDrained,
    sessionStartMs,
    previousChecksum,
    merkleDepth,
    options,
  } = ctx;

  // Sequence analytics
  const sequences = digests.map((d) => d.sequence);
  const maxSeq = sequences.length > 0 ? Math.max(...sequences) : 0;
  const minSeq = sequences.length > 0 ? Math.min(...sequences) : 0;
  const seqSpan = maxSeq - minSeq;

  // Tag analytics
  const taggedCount = digests.filter((d) => d.tags && d.tags.length > 0).length;
  const totalTags = digests.reduce((s, d) => s + (d.tags?.length ?? 0), 0);
  const taggedRatio = safeDiv(taggedCount, drainedCount);
  const avgTagsPerEvent = safeDiv(totalTags, drainedCount);

  // Event type analytics
  const eventTypeCounts = new Map<string, number>();
  for (const d of digests) {
    const k = String(d.event);
    eventTypeCounts.set(k, (eventTypeCounts.get(k) ?? 0) + 1);
  }
  const uniqueEventTypes = eventTypeCounts.size;
  const typeCounts = Array.from(eventTypeCounts.values());
  const entropy = shannonEntropy(typeCounts);
  const maxEntropy = uniqueEventTypes > 1 ? Math.log2(uniqueEventTypes) : 1;
  const entropyNorm = safeDiv(entropy, maxEntropy);

  // Checksum stability
  const checksumStability = previousChecksum === stateChecksum ? 1 : 0;

  // Sovereignty score: normalize by count cap
  const sovChecksumCount = snapshot.sovereignty.tickChecksums.length;
  const sovHealthRaw = snapshot.sovereignty.sovereigntyScore;
  const sovHealthNorm = clamp01(sovHealthRaw / 100);

  // Seal entropy: use first byte of tickSeal as entropy proxy
  const sealByte0 = parseInt(ctx.tickSeal.substring(0, 2), 16);
  const sealEntropyNorm = sealByte0 / 255;

  // Session flush rate
  const sessionElapsedSec = Math.max(1, (nowMs() - sessionStartMs) / 1000);
  const flushesPerSec = safeDiv(flushIndex + 1, sessionElapsedSec);
  const flushRateNorm = clamp01(flushesPerSec / 10); // saturates at 10/sec

  // Economy / game state
  const netWorthNorm = clamp01(snapshot.economy.netWorth / 1_000_000);
  const battlePressure = clamp01(snapshot.battle.pendingAttacks.length / 10);
  const cascadeHealth = clamp01(1 - safeDiv(snapshot.cascade.activeChains.length, 10));
  const deckEntropyNorm = clamp01(snapshot.cards.deckEntropy);
  const tensionNorm = clamp01(snapshot.tension.score);
  const shieldNorm = clamp01(snapshot.shield.weakestLayerRatio);

  // Composite risk score: weighted combination
  const compositeRisk = clamp01(
    0.2 * PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier] +
    0.15 * battlePressure +
    0.1 * (1 - cascadeHealth) +
    0.1 * tensionNorm +
    0.1 * (1 - shieldNorm) +
    0.1 * (1 - sovHealthNorm) +
    0.1 * clamp01(options.mlAnomalyThreshold) +
    0.15 * (1 - checksumStability),
  );

  const features: number[] = [
    /* 00 */ clamp01(drainedCount / 100),
    /* 01 */ options.appendStateChecksumToSovereignty ? 1 : 0,
    /* 02 */ options.incrementTelemetryEventCount ? 1 : 0,
    /* 03 */ clamp01(sovChecksumCount / 200),
    /* 04 */ clamp01(snapshot.telemetry.emittedEventCount / 10_000),
    /* 05 */ clamp01(uniqueEventTypes / EFC_MAX_UNIQUE_EVENT_TYPES),
    /* 06 */ clamp01(taggedRatio),
    /* 07 */ clamp01(avgTagsPerEvent / 5),
    /* 08 */ clamp01(entropyNorm),
    /* 09 */ clamp01(seqSpan / 1_000),
    /* 10 */ clamp01(maxSeq / 100_000),
    /* 11 */ checksumStability,
    /* 12 */ clamp01(snapshot.tick / 1_000),
    /* 13 */ clamp01(RUN_PHASE_NORMALIZED[snapshot.phase]),
    /* 14 */ clamp01(PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier]),
    /* 15 */ clamp01(MODE_NORMALIZED[snapshot.mode]),
    /* 16 */ clamp01(flushIndex / 1_000),
    /* 17 */ flushRateNorm,
    /* 18 */ clamp01(cumulativeDrained / 100_000),
    /* 19 */ drainedCount >= EFC_HOT_FLUSH_THRESHOLD ? 1 : 0,
    /* 20 */ drainedCount < EFC_COLD_FLUSH_THRESHOLD ? 1 : 0,
    /* 21 */ sealEntropyNorm,
    /* 22 */ clamp01(safeDiv(digests.length, drainedCount || 1)),
    /* 23 */ sovHealthNorm,
    /* 24 */ netWorthNorm,
    /* 25 */ battlePressure,
    /* 26 */ cascadeHealth,
    /* 27 */ clamp01(merkleDepth / 1_000),
    /* 28 */ deckEntropyNorm,
    /* 29 */ tensionNorm,
    /* 30 */ shieldNorm,
    /* 31 */ compositeRisk,
  ];

  return Object.freeze(features);
}

function _computeAnomalyScore(features: readonly number[]): number {
  // Anomaly = deviation from "quiet, stable flush" baseline
  // Quiet baseline: drainedCount near 0, no hot/cold extremes, low risk
  const hotFlag = features[19] ?? 0;
  const coldFlag = features[20] ?? 0;
  const checksumInstability = 1 - (features[11] ?? 1);
  const compositeRisk = features[31] ?? 0;
  const entropyNorm = features[8] ?? 0;
  const tensionNorm = features[29] ?? 0;

  return clamp01(
    0.25 * (hotFlag + coldFlag) +
    0.2 * checksumInstability +
    0.25 * compositeRisk +
    0.15 * entropyNorm +
    0.15 * tensionNorm,
  );
}

/**
 * Extract the canonical 32-dim ML feature vector for a flush tick.
 * Suitable for online inference, liveops scoring, and chat routing.
 */
export function extractEventFlushMLVector(ctx: FlushMLContext): FlushMLVector {
  const features = _extractFlushMLFeatures(ctx);
  const anomalyScore = _computeAnomalyScore(features);
  return {
    sessionId: ctx.options.sessionId ?? 'unknown',
    tick: ctx.snapshot.tick,
    flushIndex: ctx.flushIndex,
    features,
    featureLabels: EFC_ML_FEATURE_LABELS,
    anomalyScore,
    hotFlush: ctx.drainedCount >= EFC_HOT_FLUSH_THRESHOLD,
    coldFlush: ctx.drainedCount < EFC_COLD_FLUSH_THRESHOLD,
    extractedAtMs: nowMs(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — DL 40×8 tensor construction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a 40×8 DL input tensor from the most recent flush event digests.
 *
 * Each row encodes one event envelope:
 *   col 0: normalized sequence number
 *   col 1: event type hash (normalized first byte of sha256)
 *   col 2: normalized tag count
 *   col 3: normalized emitted-at tick
 *   col 4: normalized first byte of checksum
 *   col 5: is sovereignty-related event (0/1)
 *   col 6: is pressure-related event (0/1)
 *   col 7: is battle-related event (0/1)
 *
 * Rows beyond the number of actual digests are zero-padded.
 */
export function buildEventFlushDLTensor(
  digests: readonly FlushedEventDigest[],
  snapshot: RunStateSnapshot,
  sessionId: string,
  flushIndex: number,
  maxSeqHint = 100_000,
): FlushDLTensor {
  const rows: number[][] = [];

  // Populate up to EFC_DL_ROWS from the tail of digests (most recent)
  const tail = digests.slice(-EFC_DL_ROWS);

  for (let r = 0; r < EFC_DL_ROWS; r++) {
    const digest = tail[r];
    if (digest === undefined) {
      rows.push([0, 0, 0, 0, 0, 0, 0, 0]);
      continue;
    }

    const eventKey = String(digest.event);
    const eventHashHex = sha256(eventKey);
    const eventHashByte = parseInt(eventHashHex.substring(0, 2), 16);
    const checksumByte = parseInt(digest.checksum.substring(0, 2), 16);
    const isSovereignty = eventKey.startsWith('sovereignty.') ? 1 : 0;
    const isPressure = eventKey.startsWith('pressure.') ? 1 : 0;
    const isBattle = eventKey.startsWith('battle.') || eventKey.startsWith('attack.') ? 1 : 0;

    rows.push([
      clamp01(digest.sequence / maxSeqHint),        // col 0
      eventHashByte / 255,                           // col 1
      clamp01((digest.tags?.length ?? 0) / 10),     // col 2
      clamp01((digest.emittedAtTick ?? 0) / 1_000), // col 3
      checksumByte / 255,                            // col 4
      isSovereignty,                                 // col 5
      isPressure,                                    // col 6
      isBattle,                                      // col 7
    ]);
  }

  // Zero-pad if fewer digests than EFC_DL_ROWS
  while (rows.length < EFC_DL_ROWS) {
    rows.push([0, 0, 0, 0, 0, 0, 0, 0]);
  }

  const frozenRows = Object.freeze(rows.map((r) => Object.freeze(r) as readonly number[]));

  // Compute l2 norm of flattened tensor
  let sumSq = 0;
  for (const row of frozenRows) {
    for (const v of row) {
      sumSq += v * v;
    }
  }
  const l2Norm = Math.sqrt(sumSq);

  // Row labels: event type or 'empty'
  const rowLabels: string[] = [];
  for (let r = 0; r < EFC_DL_ROWS; r++) {
    const digest = tail[r];
    rowLabels.push(digest ? String(digest.event) : 'empty');
  }

  return {
    sessionId,
    tick: snapshot.tick,
    rows: EFC_DL_ROWS,
    cols: EFC_DL_COLS,
    tensor: frozenRows,
    rowLabels: Object.freeze(rowLabels),
    colLabels: EFC_DL_COL_LABELS,
    l2Norm,
    builtAtMs: nowMs(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 10 — Chat signal construction
// ─────────────────────────────────────────────────────────────────────────────

function _resolveFlushChatSignalKind(
  drainedCount: number,
  anomalyScore: number,
  anomalyThreshold: number,
  consecutiveCold: number,
  coldRecoveryThreshold: number,
): FlushChatSignal['kind'] {
  if (drainedCount >= EFC_HOT_FLUSH_THRESHOLD) return 'FLUSH_HOT';
  if (drainedCount < EFC_COLD_FLUSH_THRESHOLD) {
    if (consecutiveCold >= coldRecoveryThreshold) return 'FLUSH_RECOVERY';
    return 'FLUSH_COLD';
  }
  if (anomalyScore >= anomalyThreshold) return 'FLUSH_ANOMALY';
  return 'FLUSH_NORMAL';
}

/**
 * Build the canonical FlushChatSignal for LIVEOPS routing.
 * This is consumed by EventFlushSignalAdapter → ChatInputEnvelope.
 */
export function buildFlushChatSignal(
  snapshot: RunStateSnapshot,
  result: EventFlushResult,
  mlVector: FlushMLVector,
  narrativeLine: string,
  consecutiveCold: number,
  coldRecoveryThreshold: number,
  anomalyThreshold: number,
  merkleRoot?: string,
): FlushChatSignal {
  const kind = _resolveFlushChatSignalKind(
    result.drainedCount,
    mlVector.anomalyScore,
    anomalyThreshold,
    consecutiveCold,
    coldRecoveryThreshold,
  );

  return {
    kind,
    sessionId: result.flushSessionId,
    tick: snapshot.tick,
    flushIndex: result.flushIndex,
    drainedCount: result.drainedCount,
    stateChecksum: result.stateChecksum,
    anomalyScore: mlVector.anomalyScore,
    narrativeLine,
    pressureTier: snapshot.pressure.tier,
    phase: snapshot.phase,
    mode: snapshot.mode,
    merkleRoot,
    emittedAtMs: nowMs(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 11 — Flush telemetry snapshot
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a serializable telemetry snapshot for a flush tick.
 * Suitable for liveops dashboards, audit logs, and replay verification.
 */
export function buildFlushTelemetrySnapshot(
  snapshot: RunStateSnapshot,
  result: EventFlushResult,
  uniqueEventTypes: number,
  taggedRatio: number,
  merkleRoot?: string,
): FlushTelemetrySnapshot {
  const record: FlushTelemetrySnapshot = {
    sessionId: result.flushSessionId,
    tick: snapshot.tick,
    flushIndex: result.flushIndex,
    drainedCount: result.drainedCount,
    uniqueEventTypes,
    taggedEventRatio: taggedRatio,
    stateChecksum: result.stateChecksum,
    tickSeal: result.tickSeal,
    sovereignty_tickChecksumCount: snapshot.sovereignty.tickChecksums.length,
    emittedEventCount: snapshot.telemetry.emittedEventCount,
    merkleRootAtFlush: merkleRoot,
    serialized: '',
  };

  // Serialize the record (excluding itself for recursion safety)
  const withoutSerialized: Omit<FlushTelemetrySnapshot, 'serialized'> = record;
  const serialized = stableStringify(withoutSerialized);

  return { ...record, serialized };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 12 — Narrative generation
// ─────────────────────────────────────────────────────────────────────────────

export type FlushNarrativeUrgency = 'calm' | 'notable' | 'elevated' | 'critical';

export interface FlushNarrativeOutput {
  readonly urgency: FlushNarrativeUrgency;
  readonly headline: string;
  readonly detail: string;
  readonly fullLine: string;
}

class FlushNarrativeEngine {
  generateNarrative(
    snapshot: RunStateSnapshot,
    drainedCount: number,
    anomalyScore: number,
    consecutiveCold: number,
    trend: FlushTrendDirection,
  ): FlushNarrativeOutput {
    const tier = snapshot.pressure.tier;
    const phase = snapshot.phase;
    const tierLabel = PRESSURE_TIER_URGENCY_LABEL[tier];
    const urgency = this._resolveUrgency(anomalyScore, tier);

    let headline: string;
    let detail: string;

    if (drainedCount === 0 && consecutiveCold >= 3) {
      headline = `System quiet — ${consecutiveCold} clean ticks`;
      detail = `No events drained. ${phase} phase holding steady under ${tierLabel} pressure.`;
    } else if (drainedCount >= EFC_HOT_FLUSH_THRESHOLD) {
      headline = `High-volume flush — ${drainedCount} events at tick ${snapshot.tick}`;
      detail = `Elevated event traffic during ${phase} phase. Pressure: ${tierLabel}. Trend: ${trend}.`;
    } else if (anomalyScore >= 0.8) {
      headline = `Anomalous flush detected — score ${anomalyScore.toFixed(2)}`;
      detail = `Flush pattern deviates from baseline. ${phase} / ${tierLabel}. Investigate event sources.`;
    } else if (trend === 'RECOVERING') {
      headline = `Flush pattern recovering after cold streak`;
      detail = `${drainedCount} events drained. ${phase} phase, ${tierLabel} pressure. Momentum returning.`;
    } else if (trend === 'ACCELERATING') {
      headline = `Flush acceleration detected — ${drainedCount} events`;
      detail = `Event volume rising. ${phase} phase. ${tierLabel} pressure band.`;
    } else {
      headline = `Normal flush — ${drainedCount} events at tick ${snapshot.tick}`;
      detail = `${phase} phase, ${tierLabel} pressure, trend ${trend}.`;
    }

    const fullLine = `[FLUSH §${snapshot.tick}] ${headline} | ${detail}`;
    return { urgency, headline, detail, fullLine };
  }

  private _resolveUrgency(anomalyScore: number, tier: PressureTier): FlushNarrativeUrgency {
    if (anomalyScore >= 0.8 || tier === 'T4') return 'critical';
    if (anomalyScore >= 0.6 || tier === 'T3') return 'elevated';
    if (anomalyScore >= 0.3 || tier === 'T2') return 'notable';
    return 'calm';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 13 — Flush rate controller
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tracks flush events per second over a rolling window.
 * Used to detect runaway flush loops (e.g., EventBus not draining properly).
 */
class FlushRateController {
  private readonly _timestamps: number[] = [];
  private readonly _windowMs: number;

  constructor(windowMs: number = EFC_RATE_BUDGET_MS) {
    this._windowMs = windowMs;
  }

  record(): void {
    const now = nowMs();
    this._timestamps.push(now);
    // Evict entries outside the window
    const cutoff = now - this._windowMs;
    while (this._timestamps.length > 0 && (this._timestamps[0] ?? 0) < cutoff) {
      this._timestamps.shift();
    }
  }

  flushesInWindow(): number {
    return this._timestamps.length;
  }

  flushesPerSecond(): number {
    return safeDiv(this._timestamps.length, this._windowMs / 1_000);
  }

  isOverloaded(threshold: number = 20): boolean {
    return this.flushesPerSecond() > threshold;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 14 — Tag frequency analyzer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tracks tag frequency across flush ticks.
 * Identifies which tags are most common, correlates tags with hot flushes.
 */
class TagFrequencyAnalyzer {
  private readonly _tagCounts = new Map<string, number>();
  private readonly _tagHotFlushCounts = new Map<string, number>();
  private _totalTagsSeen = 0;
  private _hotFlushTagsSeen = 0;

  ingestDigests(digests: readonly FlushedEventDigest[], isHotFlush: boolean): void {
    for (const digest of digests) {
      if (!digest.tags) continue;
      for (const tag of digest.tags) {
        this._tagCounts.set(tag, (this._tagCounts.get(tag) ?? 0) + 1);
        this._totalTagsSeen += 1;
        if (isHotFlush) {
          this._tagHotFlushCounts.set(tag, (this._tagHotFlushCounts.get(tag) ?? 0) + 1);
          this._hotFlushTagsSeen += 1;
        }
      }
    }
  }

  getTopTags(n: number = 10): readonly TagFrequencyRecord[] {
    const records: TagFrequencyRecord[] = [];
    for (const [tag, count] of this._tagCounts.entries()) {
      records.push({
        tag,
        count,
        ratio: safeDiv(count, this._totalTagsSeen),
        lastSeenTick: 0, // not tracked here for brevity
      });
    }
    return freezeArray(
      records.sort((a, b) => b.count - a.count).slice(0, n),
    );
  }

  hotFlushTagCorrelation(tag: string): number {
    const hotCount = this._tagHotFlushCounts.get(tag) ?? 0;
    const totalCount = this._tagCounts.get(tag) ?? 0;
    return safeDiv(hotCount, totalCount);
  }

  uniqueTagCount(): number {
    return this._tagCounts.size;
  }

  totalTagsSeen(): number {
    return this._totalTagsSeen;
  }

  hotFlushTagsSeen(): number {
    return this._hotFlushTagsSeen;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 15 — Trend analyzer
// ─────────────────────────────────────────────────────────────────────────────

class FlushTrendAnalyzer {
  computeTrend(history: FlushHistoryBuffer): FlushTrendSnapshot {
    const window = history.getLast(EFC_TREND_WINDOW);
    const drainedSlope = history.drainedSlope(EFC_TREND_WINDOW);
    const anomalySlope = history.anomalySlope(EFC_TREND_WINDOW);
    const stdDev = history.stdDevDrained();
    const consecutiveCold = history.consecutiveColdAtEnd();
    const consecutiveHot = history.consecutiveHotAtEnd();

    const maxInWindow =
      window.length > 0 ? Math.max(...window.map((e) => e.drainedCount)) : 0;
    const minInWindow =
      window.length > 0 ? Math.min(...window.map((e) => e.drainedCount)) : 0;

    let direction: FlushTrendDirection;
    if (consecutiveCold >= EFC_COLD_RUN_RECOVERY_THRESHOLD && drainedSlope > 0.5) {
      direction = 'RECOVERING';
    } else if (stdDev > 20 && window.length >= 4) {
      direction = 'VOLATILE';
    } else if (drainedSlope > 1.0) {
      direction = 'ACCELERATING';
    } else if (drainedSlope < -1.0) {
      direction = 'DECELERATING';
    } else {
      direction = 'STABLE';
    }

    const trendConfidence = clamp01(
      Math.min(window.length, EFC_TREND_WINDOW) / EFC_TREND_WINDOW,
    );

    return {
      direction,
      drainedCountSlope: drainedSlope,
      anomalyScoreSlope: anomalySlope,
      windowSize: window.length,
      stdDevDrained: stdDev,
      maxDrainedInWindow: maxInWindow,
      minDrainedInWindow: minInWindow,
      consecutiveColdFlushes: consecutiveCold,
      consecutiveHotFlushes: consecutiveHot,
      trendConfidence,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 16 — Recovery forecaster
// ─────────────────────────────────────────────────────────────────────────────

class FlushRecoveryForecaster {
  computeForecast(
    trend: FlushTrendSnapshot,
    snapshot: RunStateSnapshot,
    anomalyScore: number,
  ): FlushRecoveryForecast {
    const notes: string[] = [];
    let action: FlushRecoveryAction = 'MAINTAIN';
    let riskScore = 0;
    let estimatedRecoveryTicks = 0;

    if (trend.consecutiveColdFlushes >= EFC_COLD_RUN_RECOVERY_THRESHOLD * 2) {
      action = 'WAIT_FOR_RECOVERY';
      riskScore += 0.3;
      estimatedRecoveryTicks = Math.ceil(trend.consecutiveColdFlushes / 2);
      notes.push(`Extended cold streak: ${trend.consecutiveColdFlushes} consecutive cold flushes.`);
    }

    if (trend.consecutiveHotFlushes >= 5) {
      action = 'INVESTIGATE_HOT_SOURCES';
      riskScore += 0.4;
      notes.push(`${trend.consecutiveHotFlushes} consecutive hot flushes — investigate event sources.`);
    }

    if (anomalyScore >= 0.8) {
      action = 'ALERT_OPERATOR';
      riskScore += 0.5;
      notes.push(`Critical anomaly score (${anomalyScore.toFixed(2)}) — operator attention needed.`);
    }

    if (trend.direction === 'VOLATILE') {
      riskScore += 0.2;
      notes.push('Volatile flush pattern detected. Monitor for stability.');
    }

    if (snapshot.pressure.tier === 'T4') {
      riskScore += 0.15;
      notes.push('Apex pressure — flush coordinator operating under maximum load.');
    }

    if (trend.drainedCountSlope < -2.0) {
      action = 'REDUCE_FLUSH_FREQUENCY';
      riskScore += 0.1;
      notes.push('Declining event volume — consider reducing flush frequency.');
    } else if (trend.drainedCountSlope > 5.0) {
      action = 'INCREASE_FLUSH_FREQUENCY';
      riskScore += 0.1;
      notes.push('Rising event volume — increase flush frequency to prevent queue buildup.');
    }

    const confidence = clamp01(trend.trendConfidence);

    return {
      recommendedAction: action,
      confidence,
      estimatedRecoveryTicks,
      riskScore: clamp01(riskScore),
      notes: freezeArray(notes),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 17 — Session analytics
// ─────────────────────────────────────────────────────────────────────────────

class FlushSessionAnalytics {
  private readonly _sessionId: string;
  private readonly _startMs: number;
  private _totalFlushes = 0;
  private _totalDrained = 0;
  private _hotFlushCount = 0;
  private _coldFlushCount = 0;
  private _anomalyFlushCount = 0;
  private _peakDrained = 0;
  private _uniqueEventTypesLifetime = new Set<string>();

  constructor(sessionId: string) {
    this._sessionId = sessionId;
    this._startMs = nowMs();
  }

  record(
    entry: FlushHistoryEntry,
    eventTypes: readonly string[],
    anomalyScore: number,
    anomalyThreshold: number,
  ): void {
    this._totalFlushes += 1;
    this._totalDrained += entry.drainedCount;
    if (entry.hotFlush) this._hotFlushCount += 1;
    if (entry.coldFlush) this._coldFlushCount += 1;
    if (anomalyScore >= anomalyThreshold) this._anomalyFlushCount += 1;
    if (entry.drainedCount > this._peakDrained) {
      this._peakDrained = entry.drainedCount;
    }
    for (const et of eventTypes) {
      this._uniqueEventTypesLifetime.add(et);
    }
  }

  buildReport(merkleRoot?: string): FlushSessionReport {
    const sessionDurationMs = nowMs() - this._startMs;
    const normalFlushCount =
      this._totalFlushes - this._hotFlushCount - this._coldFlushCount;
    return {
      sessionId: this._sessionId,
      totalFlushes: this._totalFlushes,
      totalDrained: this._totalDrained,
      hotFlushCount: this._hotFlushCount,
      coldFlushCount: this._coldFlushCount,
      normalFlushCount: Math.max(0, normalFlushCount),
      anomalyFlushCount: this._anomalyFlushCount,
      avgDrainedPerFlush: safeDiv(this._totalDrained, this._totalFlushes),
      peakDrainedSingleFlush: this._peakDrained,
      sessionDurationMs,
      uniqueEventTypesLifetime: this._uniqueEventTypesLifetime.size,
      merkleRootFinal: merkleRoot,
      generatedAtMs: nowMs(),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 18 — Annotation bundle
// ─────────────────────────────────────────────────────────────────────────────

function buildFlushAnnotationBundle(
  snapshot: RunStateSnapshot,
  flushIndex: number,
  drainedCount: number,
  anomalyScore: number,
  trend: FlushTrendSnapshot,
): FlushAnnotationBundle {
  const annotations: string[] = [];
  const tags: string[] = [];
  const riskAnnotations: string[] = [];

  // Core flush annotations
  annotations.push(
    `flush:tick=${snapshot.tick}`,
    `flush:index=${flushIndex}`,
    `flush:drained=${drainedCount}`,
    `flush:phase=${snapshot.phase}`,
    `flush:pressure=${snapshot.pressure.tier}`,
  );

  // Tags derived from state
  tags.push(`phase:${snapshot.phase}`, `tier:${snapshot.pressure.tier}`);
  if (drainedCount >= EFC_HOT_FLUSH_THRESHOLD) tags.push('hot');
  if (drainedCount < EFC_COLD_FLUSH_THRESHOLD) tags.push('cold');
  if (anomalyScore >= 0.6) tags.push('anomaly');
  if (trend.direction !== 'STABLE') tags.push(`trend:${trend.direction.toLowerCase()}`);

  // Risk annotations
  if (anomalyScore >= 0.8) {
    riskAnnotations.push(`critical_anomaly:score=${anomalyScore.toFixed(2)}`);
  }
  if (trend.consecutiveColdFlushes >= EFC_COLD_RUN_RECOVERY_THRESHOLD) {
    riskAnnotations.push(`cold_streak:count=${trend.consecutiveColdFlushes}`);
  }
  if (snapshot.pressure.tier === 'T4') {
    riskAnnotations.push('apex_pressure');
  }
  if (snapshot.sovereignty.integrityStatus === 'QUARANTINED') {
    riskAnnotations.push('sovereignty_quarantined');
  }

  return {
    tick: snapshot.tick,
    flushIndex,
    annotations: freezeArray(annotations),
    tags: freezeArray(tags),
    riskAnnotations: freezeArray(riskAnnotations),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 19 — Fault boundary detection
// ─────────────────────────────────────────────────────────────────────────────

export type FlushFaultKind =
  | 'EMPTY_BUS_FLUSH'
  | 'CHECKSUM_UNCHANGED'
  | 'SEAL_COLLISION'
  | 'SOVEREIGNTY_OVERFLOW'
  | 'RATE_OVERLOAD'
  | 'MERKLE_DEPTH_EXCEEDED';

export interface FlushFaultRecord {
  readonly kind: FlushFaultKind;
  readonly tick: number;
  readonly flushIndex: number;
  readonly detail: string;
  readonly detectedAtMs: number;
}

class FlushFaultBoundary {
  private readonly _faults: FlushFaultRecord[] = [];

  detect(
    snapshot: RunStateSnapshot,
    drainedCount: number,
    flushIndex: number,
    previousChecksum: string | null,
    stateChecksum: string,
    tickSeal: string,
    previousSeal: string | null,
    merkleDepth: number,
    rateController: FlushRateController,
  ): readonly FlushFaultRecord[] {
    const detected: FlushFaultRecord[] = [];
    const tick = snapshot.tick;
    const ms = nowMs();

    if (drainedCount === 0 && flushIndex > 0) {
      detected.push({
        kind: 'EMPTY_BUS_FLUSH',
        tick,
        flushIndex,
        detail: 'EventBus queue drained 0 envelopes — possible underutilization.',
        detectedAtMs: ms,
      });
    }

    if (previousChecksum !== null && stateChecksum === previousChecksum) {
      detected.push({
        kind: 'CHECKSUM_UNCHANGED',
        tick,
        flushIndex,
        detail: `State checksum unchanged from previous flush: ${stateChecksum.substring(0, 8)}...`,
        detectedAtMs: ms,
      });
    }

    if (previousSeal !== null && tickSeal === previousSeal) {
      detected.push({
        kind: 'SEAL_COLLISION',
        tick,
        flushIndex,
        detail: `Tick seal collided with previous seal: ${tickSeal.substring(0, 8)}...`,
        detectedAtMs: ms,
      });
    }

    if (snapshot.sovereignty.tickChecksums.length > 5_000) {
      detected.push({
        kind: 'SOVEREIGNTY_OVERFLOW',
        tick,
        flushIndex,
        detail: `sovereignty.tickChecksums has ${snapshot.sovereignty.tickChecksums.length} entries — trim recommended.`,
        detectedAtMs: ms,
      });
    }

    if (rateController.isOverloaded()) {
      detected.push({
        kind: 'RATE_OVERLOAD',
        tick,
        flushIndex,
        detail: `Flush rate ${rateController.flushesPerSecond().toFixed(1)}/sec exceeds overload threshold.`,
        detectedAtMs: ms,
      });
    }

    if (merkleDepth > 10_000) {
      detected.push({
        kind: 'MERKLE_DEPTH_EXCEEDED',
        tick,
        flushIndex,
        detail: `MerkleChain depth ${merkleDepth} exceeds safe threshold.`,
        detectedAtMs: ms,
      });
    }

    for (const f of detected) {
      this._faults.push(f);
    }
    return freezeArray(detected);
  }

  getFaults(): readonly FlushFaultRecord[] {
    return freezeArray(this._faults);
  }

  faultCount(): number {
    return this._faults.length;
  }

  clearFaults(): void {
    this._faults.length = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 20 — Merkle chain coordinator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wraps a MerkleChain to chain flush checksums across ticks.
 * Produces a tamper-evident proof log of all flush seals within a session.
 */
class FlushMerkleChainCoordinator {
  private readonly _chain: MerkleChain;
  private _depth = 0;
  private _enabled: boolean;

  constructor(enabled: boolean) {
    this._chain = new MerkleChain('flush-seal');
    this._enabled = enabled;
  }

  append(seal: string, tick: number): { nodeHash: string; index: number; dataHash: string } | null {
    if (!this._enabled) return null;
    const leaf = this._chain.append({ seal, tick }, `tick-${tick}`);
    this._depth += 1;
    return { nodeHash: leaf.nodeHash, index: leaf.index, dataHash: leaf.dataHash };
  }

  root(): string {
    return this._enabled ? this._chain.root() : EFC_GENESIS_SEAL;
  }

  depth(): number {
    return this._depth;
  }

  isEnabled(): boolean {
    return this._enabled;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 21 — EventFlushCoordinator class (full expansion)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Required<EventFlushCoordinatorOptions> = {
  appendStateChecksumToSovereignty: true,
  incrementTelemetryEventCount: true,
  sessionId: '',
  modeOverride: 'solo',
  historyMax: EFC_HISTORY_MAX,
  mlAnomalyThreshold: 0.6,
  enableMerkleChaining: true,
  coldRunRecoveryThreshold: EFC_COLD_RUN_RECOVERY_THRESHOLD,
};

/**
 * EventFlushCoordinator — authoritative tick-boundary flush surface for Engine 0.
 *
 * Responsibilities:
 * - Drain the EventBus queue at STEP_13_FLUSH
 * - Compute canonical state checksums and tick seals
 * - Decorate the RunStateSnapshot with checksum + telemetry updates
 * - Extract 32-dim ML feature vectors per flush tick
 * - Build 40×8 DL input tensors from event digest history
 * - Emit FlushChatSignal for LIVEOPS routing via EventFlushSignalAdapter
 * - Chain flush seals through an internal MerkleChain for proof integrity
 * - Track session-level analytics, trend direction, and recovery forecasts
 * - Detect flush faults (empty bus, checksum collision, rate overload, etc.)
 * - Generate context-aware narrative lines for companion commentary
 */
export class EventFlushCoordinator {
  private readonly _options: Required<EventFlushCoordinatorOptions>;
  private readonly _history: FlushHistoryBuffer;
  private readonly _distribution: EventDistributionAnalyzer;
  private readonly _rateController: FlushRateController;
  private readonly _tagAnalyzer: TagFrequencyAnalyzer;
  private readonly _trendAnalyzer: FlushTrendAnalyzer;
  private readonly _recoveryForecaster: FlushRecoveryForecaster;
  private readonly _sessionAnalytics: FlushSessionAnalytics;
  private readonly _narrativeEngine: FlushNarrativeEngine;
  private readonly _faultBoundary: FlushFaultBoundary;
  private readonly _merkleCoordinator: FlushMerkleChainCoordinator;

  private _flushIndex = 0;
  private _cumulativeDrained = 0;
  private _previousChecksum: string | null = null;
  private _previousSeal: string | null = null;
  private _sessionStartMs: number;
  private _lastMLVector: FlushMLVector | null = null;
  private _lastDLTensor: FlushDLTensor | null = null;
  private _lastChatSignal: FlushChatSignal | null = null;
  private _lastTelemetry: FlushTelemetrySnapshot | null = null;
  private _lastTrend: FlushTrendSnapshot | null = null;
  private _lastForecast: FlushRecoveryForecast | null = null;
  private _lastAnnotationBundle: FlushAnnotationBundle | null = null;
  private _lastFaults: readonly FlushFaultRecord[] = [];
  private _lastNarrative: FlushNarrativeOutput | null = null;

  public constructor(options: EventFlushCoordinatorOptions = {}) {
    const sessionId =
      options.sessionId ??
      createDeterministicId('efc', String(nowMs()));

    this._options = {
      ...DEFAULT_OPTIONS,
      ...options,
      sessionId,
    };

    this._history = new FlushHistoryBuffer(this._options.historyMax);
    this._distribution = new EventDistributionAnalyzer();
    this._rateController = new FlushRateController();
    this._tagAnalyzer = new TagFrequencyAnalyzer();
    this._trendAnalyzer = new FlushTrendAnalyzer();
    this._recoveryForecaster = new FlushRecoveryForecaster();
    this._sessionAnalytics = new FlushSessionAnalytics(this._options.sessionId);
    this._narrativeEngine = new FlushNarrativeEngine();
    this._faultBoundary = new FlushFaultBoundary();
    this._merkleCoordinator = new FlushMerkleChainCoordinator(
      this._options.enableMerkleChaining,
    );
    this._sessionStartMs = nowMs();
  }

  // ── Primary flush surface ─────────────────────────────────────────────────

  /**
   * Drain the EventBus queue, compute canonical checksums, decorate the
   * snapshot, and update all internal analytics surfaces.
   *
   * This is the authoritative STEP_13_FLUSH implementation.
   * Must be called once per tick at the flush boundary.
   */
  public flush(
    snapshot: RunStateSnapshot,
    bus: EventBus<EngineEventMap & Record<string, unknown>>,
    step: TickStep = 'STEP_13_FLUSH',
  ): EventFlushResult {
    // 1. Drain the bus
    const drained = bus.flush() as Array<
      EventEnvelope<keyof EngineEventMap, EngineEventMap[keyof EngineEventMap]>
    >;

    // 2. Build digests
    const digests = freezeArray(drained.map((entry) => this._digestEnvelope(entry)));

    // 3. Compute state checksum
    const stateChecksum = this.computeStateChecksum(snapshot);

    // 4. Compute tick seal
    const tickSeal = computeTickSeal({
      runId: snapshot.runId,
      tick: snapshot.tick,
      step,
      stateChecksum,
      eventChecksums: digests.map((entry) => entry.checksum),
    });

    // 5. Append to MerkleChain
    const merkleLeaf = this._merkleCoordinator.append(tickSeal, snapshot.tick) ?? undefined;

    // 6. Decorate snapshot
    const next = this._decorateSnapshot(snapshot, stateChecksum, drained.length);

    // 7. Update distribution analyzer
    this._distribution.ingest(digests, snapshot.tick);

    // 8. Build flush result
    const flushIndex = this._flushIndex;
    const flushSessionId = this._options.sessionId;
    this._flushIndex += 1;
    this._cumulativeDrained += drained.length;

    const result: EventFlushResult = {
      snapshot: next,
      drained: freezeArray(drained),
      digests,
      drainedCount: drained.length,
      stateChecksum,
      tickSeal,
      merkleLeaf: merkleLeaf
        ? Object.freeze({
            index: merkleLeaf.index,
            nodeHash: merkleLeaf.nodeHash,
            dataHash: merkleLeaf.dataHash,
          })
        : undefined,
      flushSessionId,
      flushIndex,
    };

    // 9. Rate tracking
    this._rateController.record();

    // 10. Fault detection
    this._lastFaults = this._faultBoundary.detect(
      snapshot,
      drained.length,
      flushIndex,
      this._previousChecksum,
      stateChecksum,
      tickSeal,
      this._previousSeal,
      this._merkleCoordinator.depth(),
      this._rateController,
    );

    // 11. Extract ML vector
    const mlContext: FlushMLContext = {
      snapshot,
      drainedCount: drained.length,
      digests,
      stateChecksum,
      tickSeal,
      flushIndex,
      cumulativeDrained: this._cumulativeDrained,
      sessionStartMs: this._sessionStartMs,
      previousChecksum: this._previousChecksum,
      merkleDepth: this._merkleCoordinator.depth(),
      options: this._options,
    };
    this._lastMLVector = extractEventFlushMLVector(mlContext);

    // 12. Build DL tensor
    const eventTypes = digests.map((d) => String(d.event));
    this._lastDLTensor = buildEventFlushDLTensor(
      digests,
      snapshot,
      flushSessionId,
      flushIndex,
    );

    // 13. Tag analyzer
    this._tagAnalyzer.ingestDigests(digests, drained.length >= EFC_HOT_FLUSH_THRESHOLD);

    // 14. Trend + forecast
    const historyEntry: FlushHistoryEntry = {
      tick: snapshot.tick,
      flushIndex,
      drainedCount: drained.length,
      stateChecksum,
      tickSeal,
      anomalyScore: this._lastMLVector.anomalyScore,
      hotFlush: this._lastMLVector.hotFlush,
      coldFlush: this._lastMLVector.coldFlush,
      uniqueEventTypes: this._distribution.uniqueEventTypeCount(),
      taggedRatio: safeDiv(
        digests.filter((d) => d.tags && d.tags.length > 0).length,
        Math.max(1, drained.length),
      ),
      flushedAtMs: nowMs(),
    };
    this._history.push(historyEntry);
    this._lastTrend = this._trendAnalyzer.computeTrend(this._history);
    this._lastForecast = this._recoveryForecaster.computeForecast(
      this._lastTrend,
      snapshot,
      this._lastMLVector.anomalyScore,
    );

    // 15. Narrative
    this._lastNarrative = this._narrativeEngine.generateNarrative(
      snapshot,
      drained.length,
      this._lastMLVector.anomalyScore,
      this._lastTrend.consecutiveColdFlushes,
      this._lastTrend.direction,
    );

    // 16. Chat signal
    const merkleRoot = this._merkleCoordinator.root();
    this._lastChatSignal = buildFlushChatSignal(
      snapshot,
      result,
      this._lastMLVector,
      this._lastNarrative.fullLine,
      this._lastTrend.consecutiveColdFlushes,
      this._options.coldRunRecoveryThreshold,
      this._options.mlAnomalyThreshold,
      merkleRoot,
    );

    // 17. Telemetry snapshot
    this._lastTelemetry = buildFlushTelemetrySnapshot(
      snapshot,
      result,
      this._distribution.uniqueEventTypeCount(),
      historyEntry.taggedRatio,
      merkleRoot,
    );

    // 18. Annotation bundle
    this._lastAnnotationBundle = buildFlushAnnotationBundle(
      snapshot,
      flushIndex,
      drained.length,
      this._lastMLVector.anomalyScore,
      this._lastTrend,
    );

    // 19. Session analytics
    this._sessionAnalytics.record(
      historyEntry,
      eventTypes,
      this._lastMLVector.anomalyScore,
      this._options.mlAnomalyThreshold,
    );

    // 20. Update previous state pointers
    this._previousChecksum = stateChecksum;
    this._previousSeal = tickSeal;

    return result;
  }

  // ── flushAndSeal — TickExecutor compatibility surface ─────────────────────

  /**
   * Drain the EventBus and return a canonical seal object.
   *
   * This is a simplified flush surface used by TickExecutor at STEP_13_FLUSH
   * when a full snapshot context is not available. It drains the bus and
   * computes a composite checksum from the drained envelope sequence and
   * payload checksums.
   *
   * For the full analytics-instrumented flush with snapshot decoration,
   * ML/DL extraction, and chat signals, use flush() instead.
   */
  public flushAndSeal(
    bus: EventBus<EngineEventMap & Record<string, unknown>>,
  ): {
    readonly drained: readonly EventEnvelope<
      keyof EngineEventMap,
      EngineEventMap[keyof EngineEventMap]
    >[];
    readonly seal: { readonly checksum: string };
  } {
    const drained = bus.flush() as Array<
      EventEnvelope<keyof EngineEventMap, EngineEventMap[keyof EngineEventMap]>
    >;
    const envelopeChecksums = drained.map((env) =>
      checksumParts(
        env.sequence,
        env.event,
        env.emittedAtTick ?? null,
        env.tags ?? [],
        env.payload,
      ),
    );
    const checksum = checksumParts(...envelopeChecksums);
    return {
      drained: freezeArray(drained),
      seal: { checksum },
    };
  }

  // ── Checksum surface ──────────────────────────────────────────────────────

  /**
   * Compute a canonical state checksum from the current snapshot.
   * Stable, deterministic, and replay-safe.
   */
  public computeStateChecksum(snapshot: RunStateSnapshot): string {
    return checksumSnapshot({
      tick: snapshot.tick,
      phase: snapshot.phase,
      economy: snapshot.economy,
      pressure: snapshot.pressure,
      tension: snapshot.tension,
      shield: snapshot.shield,
      battle: {
        ...snapshot.battle,
        pendingAttacks: snapshot.battle.pendingAttacks.map((attack) => attack.attackId),
      },
      cascade: snapshot.cascade.activeChains.map((chain) => ({
        chainId: chain.chainId,
        status: chain.status,
        links: chain.links.map((link) => link.linkId),
      })),
    });
  }

  // ── ML/DL entry points ───────────────────────────────────────────────────

  /**
   * Extract the last computed 32-dim ML feature vector.
   * Returns null if flush() has not been called yet.
   */
  public extractMLVector(): FlushMLVector | null {
    return this._lastMLVector;
  }

  /**
   * Build and return the most recent 40×8 DL input tensor.
   * Returns null if flush() has not been called yet.
   */
  public buildDLTensor(): FlushDLTensor | null {
    return this._lastDLTensor;
  }

  // ── Chat signal ──────────────────────────────────────────────────────────

  /**
   * Return the last FlushChatSignal emitted by flush().
   * This is consumed by EventFlushSignalAdapter for LIVEOPS routing.
   */
  public buildChatSignal(): FlushChatSignal | null {
    return this._lastChatSignal;
  }

  // ── Telemetry + trend + forecast ─────────────────────────────────────────

  /** Return the most recent flush telemetry snapshot. */
  public getTelemetry(): FlushTelemetrySnapshot | null {
    return this._lastTelemetry;
  }

  /** Return the most recent trend snapshot across recent flush ticks. */
  public getTrend(): FlushTrendSnapshot | null {
    return this._lastTrend;
  }

  /** Return the most recent recovery forecast. */
  public getRecoveryForecast(): FlushRecoveryForecast | null {
    return this._lastForecast;
  }

  /** Return the most recent annotation bundle. */
  public getAnnotationBundle(): FlushAnnotationBundle | null {
    return this._lastAnnotationBundle;
  }

  /** Return the most recent narrative output. */
  public getNarrative(): FlushNarrativeOutput | null {
    return this._lastNarrative;
  }

  // ── Session surface ───────────────────────────────────────────────────────

  /** Return the full session report for this coordinator's lifetime. */
  public getSessionReport(): FlushSessionReport {
    return this._sessionAnalytics.buildReport(this._merkleCoordinator.root());
  }

  /** Return the current Merkle chain root hash. */
  public getMerkleRoot(): string {
    return this._merkleCoordinator.root();
  }

  /** Return the current Merkle chain depth (number of appended seals). */
  public getMerkleDepth(): number {
    return this._merkleCoordinator.depth();
  }

  // ── Distribution surface ─────────────────────────────────────────────────

  /** Return current event type frequency distribution. */
  public getEventFrequencies(): readonly EventTypeFrequencyRecord[] {
    return this._distribution.getEventFrequencies();
  }

  /** Return top N tags by frequency. */
  public getTopTags(n?: number): readonly TagFrequencyRecord[] {
    return this._tagAnalyzer.getTopTags(n);
  }

  /** Return all flush history entries. */
  public getHistory(): readonly FlushHistoryEntry[] {
    return this._history.getAll();
  }

  // ── Fault surface ─────────────────────────────────────────────────────────

  /** Return all detected fault records since the coordinator was created. */
  public getFaults(): readonly FlushFaultRecord[] {
    return this._faultBoundary.getFaults();
  }

  /** Return faults detected in the most recent flush() call. */
  public getLastFlushFaults(): readonly FlushFaultRecord[] {
    return this._lastFaults;
  }

  /** Clear the fault record. */
  public clearFaults(): void {
    this._faultBoundary.clearFaults();
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private _digestEnvelope(
    entry: EventEnvelope<keyof EngineEventMap, EngineEventMap[keyof EngineEventMap]>,
  ): FlushedEventDigest {
    return {
      sequence: entry.sequence,
      event: entry.event,
      emittedAtTick: entry.emittedAtTick,
      tags: entry.tags === undefined ? undefined : freezeArray(entry.tags),
      checksum: checksumParts(
        entry.sequence,
        entry.event,
        entry.emittedAtTick ?? null,
        entry.tags ?? [],
        entry.payload,
      ),
    };
  }

  private _decorateSnapshot(
    snapshot: RunStateSnapshot,
    stateChecksum: string,
    drainedCount: number,
  ): RunStateSnapshot {
    if (
      this._options.appendStateChecksumToSovereignty !== true &&
      this._options.incrementTelemetryEventCount !== true &&
      snapshot.telemetry.lastTickChecksum === stateChecksum
    ) {
      return snapshot;
    }

    const next = cloneJson(snapshot) as Mutable<RunStateSnapshot>;

    next.telemetry.lastTickChecksum = stateChecksum;

    if (this._options.incrementTelemetryEventCount === true) {
      next.telemetry.emittedEventCount =
        next.telemetry.emittedEventCount + drainedCount;
    }

    if (this._options.appendStateChecksumToSovereignty === true) {
      const existing = next.sovereignty.tickChecksums;
      const alreadyPresent =
        existing.length > 0 && existing[existing.length - 1] === stateChecksum;

      if (!alreadyPresent) {
        next.sovereignty.tickChecksums = Object.freeze([
          ...existing,
          stateChecksum,
        ]) as string[];
      }
    }

    return deepFreeze(next) as RunStateSnapshot;
  }

  // ── Metadata ─────────────────────────────────────────────────────────────

  /** Return the session identifier. */
  public get sessionId(): string {
    return this._options.sessionId;
  }

  /** Return the total number of flush() calls made. */
  public get totalFlushes(): number {
    return this._flushIndex;
  }

  /** Return cumulative drained envelope count across all flush calls. */
  public get totalDrained(): number {
    return this._cumulativeDrained;
  }

  /** Return all configured options (resolved with defaults). */
  public get resolvedOptions(): Readonly<Required<EventFlushCoordinatorOptions>> {
    return this._options;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 22 — Well-known singletons + factories
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical shared EventFlushCoordinator for the default Engine 0 runtime.
 *
 * Import via:
 *   import { Zero } from '../../engine';
 *   Zero.DEFAULT_EVENT_FLUSH_COORDINATOR.flush(snapshot, bus);
 */
export const DEFAULT_EVENT_FLUSH_COORDINATOR = new EventFlushCoordinator({
  appendStateChecksumToSovereignty: true,
  incrementTelemetryEventCount: true,
  enableMerkleChaining: true,
  sessionId: createDeterministicId('efc-default', 'singleton'),
});

/**
 * Create a fully instrumented EventFlushCoordinator with all analytics wired.
 *
 * Returns the coordinator + companion surfaces for immediate access:
 *   coordinator  — the EventFlushCoordinator instance
 *   sessionId    — canonical session identifier
 *
 * Usage:
 *   const { coordinator, sessionId } = createEventFlushCoordinatorWithAnalytics('solo');
 *   const result = coordinator.flush(snapshot, bus);
 *   const mlVec  = coordinator.extractMLVector();
 *   const tensor = coordinator.buildDLTensor();
 *   const signal = coordinator.buildChatSignal();
 *   const trend  = coordinator.getTrend();
 *   const fore   = coordinator.getRecoveryForecast();
 *   const report = coordinator.getSessionReport();
 */
export function createEventFlushCoordinatorWithAnalytics(
  modeOverride: ModeCode = 'solo',
  extraOptions: Omit<EventFlushCoordinatorOptions, 'modeOverride'> = {},
): {
  coordinator: EventFlushCoordinator;
  sessionId: string;
} {
  const sessionId = createDeterministicId('efc', modeOverride, String(nowMs()));

  const coordinator = new EventFlushCoordinator({
    appendStateChecksumToSovereignty: true,
    incrementTelemetryEventCount: true,
    enableMerkleChaining: true,
    mlAnomalyThreshold: 0.6,
    coldRunRecoveryThreshold: EFC_COLD_RUN_RECOVERY_THRESHOLD,
    historyMax: EFC_HISTORY_MAX,
    modeOverride,
    sessionId,
    ...extraOptions,
  });

  return { coordinator, sessionId };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 23 — Utility functions + public constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a supplemental event-level identifier for diagnostics.
 * Stable across identical envelopes (same sequence + event + tick).
 */
export function computeFlushEnvelopeId(
  runId: string,
  tick: number,
  sequence: number,
  event: string,
): string {
  return checksumParts(runId, tick, sequence, event);
}

/**
 * Build a compact flush summary string suitable for logging and liveops dashboards.
 * Format: [tick/flushIdx] drained=N checksum=XXXX seal=YYYY
 */
export function formatFlushSummary(result: EventFlushResult): string {
  const checksumShort = result.stateChecksum.substring(0, 8);
  const sealShort = result.tickSeal.substring(0, 8);
  return (
    `[tick=${result.snapshot.tick}/flush=${result.flushIndex}] ` +
    `drained=${result.drainedCount} checksum=${checksumShort}... seal=${sealShort}...`
  );
}

/**
 * Verify that a flush result's tick seal is consistent with its inputs.
 * Returns true if the seal matches a recomputed value.
 *
 * Uses computeTickSeal internally so proof surfaces remain aligned.
 */
export function verifyFlushResultSeal(
  result: EventFlushResult,
  step: TickStep = 'STEP_13_FLUSH',
): boolean {
  const recomputed = computeTickSeal({
    runId: result.snapshot.runId,
    tick: result.snapshot.tick,
    step,
    stateChecksum: result.stateChecksum,
    eventChecksums: result.digests.map((d) => d.checksum),
  });
  return recomputed === result.tickSeal;
}

/**
 * Extract a compact serializable snapshot from a FlushMLVector.
 * Suitable for liveops telemetry ingestion and A/B metrics.
 */
export function serializeFlushMLVector(vec: FlushMLVector): string {
  return stableStringify({
    sessionId: vec.sessionId,
    tick: vec.tick,
    flushIndex: vec.flushIndex,
    features: vec.features,
    anomalyScore: vec.anomalyScore,
    hotFlush: vec.hotFlush,
    coldFlush: vec.coldFlush,
    extractedAtMs: vec.extractedAtMs,
  });
}

/**
 * Given a FlushChatSignal, return a human-readable severity label for
 * companion commentary and liveops dashboards.
 */
export function resolveFlushChatSeverity(
  signal: FlushChatSignal,
): 'low' | 'medium' | 'high' | 'critical' {
  if (signal.kind === 'FLUSH_HOT' && signal.anomalyScore >= 0.8) return 'critical';
  if (signal.kind === 'FLUSH_ANOMALY') return 'high';
  if (signal.kind === 'FLUSH_HOT') return 'medium';
  if (signal.kind === 'FLUSH_COLD') return 'low';
  if (signal.kind === 'FLUSH_RECOVERY') return 'medium';
  return 'low';
}

/**
 * Predicate: true if a FlushTrendSnapshot indicates the system is under
 * elevated liveops risk (volatile or accelerating with high anomaly).
 */
export function isFlushTrendUnderRisk(
  trend: FlushTrendSnapshot,
  mlVector: FlushMLVector,
): boolean {
  return (
    (trend.direction === 'VOLATILE' || trend.direction === 'ACCELERATING') &&
    mlVector.anomalyScore >= 0.5
  );
}

/**
 * Build a minimal FlushFaultSummary string for logging.
 */
export function formatFlushFaults(faults: readonly FlushFaultRecord[]): string {
  if (faults.length === 0) return 'no_faults';
  return faults.map((f) => `${f.kind}@tick${f.tick}`).join(',');
}

/**
 * Compute the normalized 32-dim ML feature vector directly from a snapshot
 * and digest list — without requiring a full EventFlushCoordinator instance.
 *
 * Useful for replay verification, offline analytics, and test fixtures.
 */
export function computeStandaloneFlushMLVector(
  snapshot: RunStateSnapshot,
  digests: readonly FlushedEventDigest[],
  stateChecksum: string,
  tickSeal: string,
  flushIndex: number,
  sessionId: string,
): FlushMLVector {
  const ctx: FlushMLContext = {
    snapshot,
    drainedCount: digests.length,
    digests,
    stateChecksum,
    tickSeal,
    flushIndex,
    cumulativeDrained: digests.length,
    sessionStartMs: nowMs(),
    previousChecksum: null,
    merkleDepth: 0,
    options: {
      ...DEFAULT_OPTIONS,
      sessionId,
    },
  };
  return extractEventFlushMLVector(ctx);
}

/**
 * Compute the l2 norm of a FlushMLVector.
 * Used by EventFlushSignalAdapter to threshold DL tensor emission.
 */
export function computeFlushMLVectorL2Norm(vec: FlushMLVector): number {
  let sum = 0;
  for (const f of vec.features) {
    sum += f * f;
  }
  return Math.sqrt(sum);
}

/**
 * Compute the cosine similarity between two FlushMLVectors.
 * Used for replay comparison and A/B test drift detection.
 */
export function computeFlushMLVectorCosineSim(
  vecA: FlushMLVector,
  vecB: FlushMLVector,
): number {
  const a = vecA.features;
  const b = vecB.features;
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    normA += (a[i] ?? 0) ** 2;
    normB += (b[i] ?? 0) ** 2;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Return the flush history entries that qualify as anomalous
 * (anomalyScore >= threshold) from a history array.
 */
export function filterAnomalousFlushHistory(
  history: readonly FlushHistoryEntry[],
  threshold = 0.6,
): readonly FlushHistoryEntry[] {
  return freezeArray(history.filter((e) => e.anomalyScore >= threshold));
}

/**
 * Build a pressure-aware flush policy summary string.
 * Useful for liveops debug output and chat adapter signal enrichment.
 */
export function buildFlushPolicySummary(
  snapshot: RunStateSnapshot,
  options: Readonly<Required<EventFlushCoordinatorOptions>>,
): string {
  const tierLabel = PRESSURE_TIER_URGENCY_LABEL[snapshot.pressure.tier];
  const phaseLabel = snapshot.phase;
  const modeLabel = options.modeOverride;
  const checksumPolicy = options.appendStateChecksumToSovereignty
    ? 'sovereignty:append'
    : 'sovereignty:skip';
  const telemetryPolicy = options.incrementTelemetryEventCount
    ? 'telemetry:increment'
    : 'telemetry:skip';
  const merklePolicy = options.enableMerkleChaining
    ? 'merkle:chained'
    : 'merkle:disabled';

  return [
    `mode=${modeLabel}`,
    `phase=${phaseLabel}`,
    `pressure=${tierLabel}`,
    checksumPolicy,
    telemetryPolicy,
    merklePolicy,
    `anomalyThreshold=${options.mlAnomalyThreshold}`,
  ].join(' | ');
}

/**
 * Summarize a FlushSessionReport into a compact one-line string.
 * Used by liveops dashboards and companion commentary hooks.
 */
export function summarizeFlushSession(report: FlushSessionReport): string {
  const avgFmt = report.avgDrainedPerFlush.toFixed(1);
  const durationSec = (report.sessionDurationMs / 1000).toFixed(1);
  return (
    `session=${report.sessionId.substring(0, 8)}... ` +
    `flushes=${report.totalFlushes} ` +
    `drained=${report.totalDrained} ` +
    `avg=${avgFmt} ` +
    `peak=${report.peakDrainedSingleFlush} ` +
    `hot=${report.hotFlushCount} cold=${report.coldFlushCount} ` +
    `anomalies=${report.anomalyFlushCount} ` +
    `duration=${durationSec}s`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § 24 — Re-exports for clarity
// ─────────────────────────────────────────────────────────────────────────────

// No re-exports needed from this module — all surfaces are exported directly.
// EventFlushSignalAdapter (in ../chat/adapters/) consumes this module via
// structural compat interfaces to avoid circular imports.

// Type re-export for consumers that want the TickStep type
export type { TickStep };

// Type re-export for consumers that want the RunStateSnapshot type
export type { RunStateSnapshot };

// Type re-export for consumers that want the ModeCode / PressureTier / RunPhase types
export type { ModeCode, PressureTier, RunPhase };
