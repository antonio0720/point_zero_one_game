/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT TICK TRANSACTION SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/TickTransactionSignalAdapter.ts
 * VERSION: 2026.03.24
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates EngineTickTransaction truth —
 * transaction commits, rollbacks, budget violations, UX quality reports, and
 * ML transaction vectors — into authoritative backend-chat ingress envelopes.
 *
 * Backend-truth question
 * ----------------------
 *   "When a tick transaction rolls back, overshoots its budget, or scores a
 *    cinematic UX grade, what exact chat-native signal should the authoritative
 *    backend chat engine ingest to preserve user experience fidelity?"
 *
 * Design laws
 * -----------
 * - No circular imports from core/. All core types are mirrored as structural
 *   compat interfaces below.
 * - Rollbacks are always accepted — they represent engine truth that chat
 *   must witness and potentially surface to NPC commentary.
 * - UX drops below grade C trigger WARN-level chat signals.
 * - Cinematic ticks produce narrative-weight CINEMATIC signals.
 * - Budget violations beyond 3x produce CRITICAL signals.
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

// ─────────────────────────────────────────────────────────────────────────────
// Structural compat interfaces — mirrors TickTransactionChatSignal
// ─────────────────────────────────────────────────────────────────────────────

/** Structural mirror of TickTransactionChatSignal from core/EngineTickTransaction.ts */
export interface TickTransactionChatSignalCompat {
  readonly surface: 'tick_transaction';
  readonly kind: string;
  readonly engineId: string;
  readonly tick: number;
  readonly step: string;
  readonly severity: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly uxScore?: number | null;
  readonly uxGrade?: string | null;
  readonly durationMs?: number | null;
  readonly budgetMs?: number | null;
  readonly errorCount?: number | null;
  readonly signalWeightTotal?: number | null;
  readonly outcomeNumeric?: number | null;
  readonly snapshotChanged?: boolean | null;
  readonly systemHealthGrade?: string | null;
}

export interface TickTransactionUXReportCompat {
  readonly tick: number;
  readonly avgUXScore: number;
  readonly experienceGrade: string;
  readonly criticalDrops: number;
  readonly isCinematicTick: boolean;
  readonly scores?: readonly { step: string; uxScore: number; grade: string }[];
}

export interface TickTransactionHealthReportCompat {
  readonly overallHealth: string;
  readonly systemUptimeRatio: number;
  readonly criticalEngines: readonly string[];
  readonly degradedEngines: readonly string[];
  readonly healthyEngines: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter types
// ─────────────────────────────────────────────────────────────────────────────

export interface TickTransactionSignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface TickTransactionSignalAdapterClock {
  now(): UnixMs;
}

export interface TickTransactionSignalAdapterOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly dedupeWindowMs?: number;
  readonly maxHistory?: number;
  readonly uxWarnThreshold?: number;
  readonly budgetCriticalMultiplier?: number;
  readonly alwaysEmitOnRollback?: boolean;
  readonly logger?: TickTransactionSignalAdapterLogger;
  readonly clock?: TickTransactionSignalAdapterClock;
}

export interface TickTransactionSignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export type TickTransactionSignalAdapterEventName =
  | 'transaction.committed'
  | 'transaction.rolled_back'
  | 'transaction.budget_exceeded'
  | 'transaction.ux_report'
  | 'transaction.cinematic_tick'
  | 'transaction.health_alert'
  | 'transaction.analytics_summary'
  | 'transaction.ml_vector'
  | string;

export type TickTransactionSignalAdapterNarrativeWeight =
  | 'AMBIENT'
  | 'OPERATIONAL'
  | 'CRITICAL'
  | 'CINEMATIC';

export type TickTransactionSignalAdapterSeverity =
  | 'DEBUG'
  | 'INFO'
  | 'WARN'
  | 'CRITICAL';

export interface TickTransactionSignalAdapterArtifact {
  readonly envelope: ChatInputEnvelope;
  readonly dedupeKey: string;
  readonly routeChannel: ChatVisibleChannel;
  readonly narrativeWeight: TickTransactionSignalAdapterNarrativeWeight;
  readonly severity: TickTransactionSignalAdapterSeverity;
  readonly eventName: TickTransactionSignalAdapterEventName;
  readonly tick: number;
  readonly step: string;
  readonly engineId: string;
  readonly uxScore: Score01;
  readonly uxGrade: string;
  readonly isCinematic: boolean;
  readonly isRollback: boolean;
  readonly budgetRatio: Score01;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface TickTransactionSignalAdapterRejection {
  readonly eventName: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface TickTransactionSignalAdapterDeduped {
  readonly eventName: string;
  readonly dedupeKey: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface TickTransactionSignalAdapterHistoryEntry {
  readonly at: UnixMs;
  readonly eventName: string;
  readonly tick: number;
  readonly step: string;
  readonly engineId: string;
  readonly severity: TickTransactionSignalAdapterSeverity;
  readonly isRollback: boolean;
  readonly isCinematic: boolean;
  readonly uxScore: Score01;
  readonly dedupeKey: string;
}

export interface TickTransactionSignalAdapterReport {
  readonly accepted: readonly TickTransactionSignalAdapterArtifact[];
  readonly deduped: readonly TickTransactionSignalAdapterDeduped[];
  readonly rejected: readonly TickTransactionSignalAdapterRejection[];
}

export interface TickTransactionSignalAdapterState {
  readonly history: readonly TickTransactionSignalAdapterHistoryEntry[];
  readonly lastAcceptedAtByKey: Readonly<Record<string, UnixMs>>;
  readonly lastTick: number;
  readonly lastUXGrade: string;
  readonly acceptedCount: number;
  readonly dedupedCount: number;
  readonly rejectedCount: number;
  readonly rollbackCount: number;
  readonly cinematicCount: number;
  readonly budgetViolationCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_DEDUPE_WINDOW_MS = 2_000;
const DEFAULT_MAX_HISTORY = 300;
const DEFAULT_UX_WARN_THRESHOLD = 0.45;
const DEFAULT_BUDGET_CRITICAL_MULTIPLIER = 3.0;

const UX_GRADE_SCORE: Record<string, number> = {
  S: 1.0, A: 0.85, B: 0.7, C: 0.55, D: 0.35, F: 0.0,
} as const;

const NULL_LOGGER: TickTransactionSignalAdapterLogger = Object.freeze({
  debug() {},
  warn() {},
  error() {},
});

const SYSTEM_CLOCK: TickTransactionSignalAdapterClock = Object.freeze({
  now(): UnixMs { return asUnixMs(Date.now()); },
});

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function gradeToScore(grade: string | null | undefined): number {
  return UX_GRADE_SCORE[grade ?? 'B'] ?? 0.7;
}

function buildTransactionSignalEnvelope(
  signal: TickTransactionChatSignalCompat,
  roomId: ChatRoomId | string | null,
  uxScore: number,
  now: UnixMs,
): ChatSignalEnvelope {
  const budgetMs = signal.budgetMs ?? 10;
  const durationMs = signal.durationMs ?? 0;
  const budgetRatio = budgetMs > 0 ? durationMs / budgetMs : 0;

  return Object.freeze({
    type: 'LIVEOPS',
    emittedAt: now,
    roomId: (roomId ?? null) as Nullable<ChatRoomId>,
    liveops: Object.freeze({
      worldEventName: signal.kind,
      heatMultiplier01: clamp01(1 - uxScore) as Score01,
      helperBlackout: signal.kind === 'transaction.rolled_back' && signal.severity === 'error',
      haterRaidActive: false,
    }),
    metadata: Object.freeze({
      surface: signal.surface,
      kind: signal.kind,
      severity: signal.severity,
      message: signal.message,
      engineId: signal.engineId,
      tick: signal.tick,
      step: signal.step,
      uxScore: signal.uxScore ?? null,
      uxGrade: signal.uxGrade ?? null,
      durationMs: signal.durationMs ?? null,
      budgetMs: signal.budgetMs ?? null,
      budgetRatio: parseFloat(budgetRatio.toFixed(4)),
      errorCount: signal.errorCount ?? null,
      signalWeightTotal: signal.signalWeightTotal ?? null,
      outcomeNumeric: signal.outcomeNumeric ?? null,
      snapshotChanged: signal.snapshotChanged ?? null,
      systemHealthGrade: signal.systemHealthGrade ?? null,
    } as Record<string, JsonValue>),
  });
}

function buildTransactionChatEnvelope(
  signalEnvelope: ChatSignalEnvelope,
  now: UnixMs,
): ChatInputEnvelope {
  return Object.freeze({
    kind: 'LIVEOPS_SIGNAL',
    emittedAt: now,
    payload: signalEnvelope,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TickTransactionSignalAdapter
// ─────────────────────────────────────────────────────────────────────────────

export class TickTransactionSignalAdapter {
  private readonly options: Required<TickTransactionSignalAdapterOptions>;
  private readonly logger: TickTransactionSignalAdapterLogger;
  private readonly clock: TickTransactionSignalAdapterClock;

  private readonly history: TickTransactionSignalAdapterHistoryEntry[] = [];
  private readonly lastAcceptedAtByKey: Map<string, UnixMs> = new Map();

  private acceptedCount = 0;
  private dedupedCount = 0;
  private rejectedCount = 0;
  private rollbackCount = 0;
  private cinematicCount = 0;
  private budgetViolationCount = 0;
  private lastTick = 0;
  private lastUXGrade = 'B';

  public constructor(options: TickTransactionSignalAdapterOptions) {
    this.logger = options.logger ?? NULL_LOGGER;
    this.clock = options.clock ?? SYSTEM_CLOCK;
    this.options = Object.freeze({
      defaultRoomId: options.defaultRoomId,
      defaultVisibleChannel: options.defaultVisibleChannel ?? 'GLOBAL',
      dedupeWindowMs: options.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS,
      maxHistory: options.maxHistory ?? DEFAULT_MAX_HISTORY,
      uxWarnThreshold: options.uxWarnThreshold ?? DEFAULT_UX_WARN_THRESHOLD,
      budgetCriticalMultiplier: options.budgetCriticalMultiplier ?? DEFAULT_BUDGET_CRITICAL_MULTIPLIER,
      alwaysEmitOnRollback: options.alwaysEmitOnRollback ?? true,
      logger: this.logger,
      clock: this.clock,
    });
  }

  // ── Public ingestion surface ──────────────────────────────────────────────

  public ingestSignal(
    signal: TickTransactionChatSignalCompat,
    context?: TickTransactionSignalAdapterContext,
  ): TickTransactionSignalAdapterArtifact | TickTransactionSignalAdapterRejection | TickTransactionSignalAdapterDeduped {
    const now = this.clock.now();
    const roomId = context?.roomId ?? this.options.defaultRoomId;
    const routeChannel: ChatVisibleChannel = context?.routeChannel ?? this.options.defaultVisibleChannel;

    const isRollback = signal.kind === 'transaction.rolled_back' || signal.kind === 'transaction_rolled_back';
    const uxScore = clamp01(
      signal.uxScore ?? gradeToScore(signal.uxGrade ?? null),
    ) as Score01;

    const budgetMs = signal.budgetMs ?? 10;
    const durationMs = signal.durationMs ?? 0;
    const budgetRatio = budgetMs > 0 ? durationMs / budgetMs : 0;
    const isBudgetCritical = budgetRatio >= this.options.budgetCriticalMultiplier;
    const isCinematic = signal.kind.includes('cinematic') || uxScore >= 0.88;

    if (!isRollback && !this.isSignalMeaningful(signal, uxScore, budgetRatio)) {
      const rejection: TickTransactionSignalAdapterRejection = Object.freeze({
        eventName: signal.kind,
        reason: 'BELOW_UX_THRESHOLD',
        details: { tick: signal.tick, step: signal.step, uxScore, budgetRatio },
      });
      this.rejectedCount++;
      return rejection;
    }

    const dedupeKey = `${signal.kind}:${signal.engineId}:${signal.step}:${Math.floor(signal.tick / 5)}`;

    if (!isRollback && this.isDuplicate(dedupeKey, now)) {
      const deduped: TickTransactionSignalAdapterDeduped = Object.freeze({
        eventName: signal.kind,
        dedupeKey,
        reason: 'WITHIN_DEDUPE_WINDOW',
        details: { tick: signal.tick, step: signal.step, dedupeWindowMs: this.options.dedupeWindowMs },
      });
      this.dedupedCount++;
      return deduped;
    }

    const severity = this.computeAdapterSeverity(signal, uxScore, isRollback, isBudgetCritical);
    const narrativeWeight = this.computeNarrativeWeight(signal, uxScore, isRollback, isCinematic);
    const uxGrade = signal.uxGrade ?? this.scoreToGrade(uxScore);
    const budgetRatioClamped = clamp01(Math.min(1, budgetRatio / this.options.budgetCriticalMultiplier)) as Score01;

    const signalEnvelope = buildTransactionSignalEnvelope(signal, roomId as string, uxScore, now);
    const envelope = buildTransactionChatEnvelope(signalEnvelope, now);

    const artifact: TickTransactionSignalAdapterArtifact = Object.freeze({
      envelope,
      dedupeKey,
      routeChannel,
      narrativeWeight,
      severity,
      eventName: signal.kind as TickTransactionSignalAdapterEventName,
      tick: signal.tick,
      step: signal.step,
      engineId: signal.engineId,
      uxScore,
      uxGrade,
      isCinematic,
      isRollback,
      budgetRatio: budgetRatioClamped,
      details: Object.freeze({
        tick: signal.tick,
        step: signal.step,
        engineId: signal.engineId,
        kind: signal.kind,
        message: signal.message,
        uxScore: parseFloat(uxScore.toFixed(4)),
        uxGrade,
        isCinematic,
        isRollback,
        budgetRatio: parseFloat(budgetRatio.toFixed(4)),
        durationMs: signal.durationMs ?? null,
        budgetMs: signal.budgetMs ?? null,
        errorCount: signal.errorCount ?? null,
        source: context?.source ?? 'tick_transaction',
      } as Record<string, JsonValue>),
    });

    this.acceptArtifact(artifact, dedupeKey, now, isRollback, isCinematic, budgetRatio > 1);

    if (isRollback) {
      this.rollbackCount++;
      this.logger.warn('[TickTransactionSignalAdapter] transaction rollback', {
        engineId: signal.engineId,
        step: signal.step,
        tick: signal.tick,
      });
    }

    if (isCinematic) {
      this.cinematicCount++;
    }

    if (budgetRatio > 1) {
      this.budgetViolationCount++;
    }

    this.lastTick = signal.tick;
    this.lastUXGrade = uxGrade;

    return artifact;
  }

  public ingestUXReport(
    report: TickTransactionUXReportCompat,
    context?: TickTransactionSignalAdapterContext,
  ): TickTransactionSignalAdapterArtifact | TickTransactionSignalAdapterRejection | TickTransactionSignalAdapterDeduped {
    const signal: TickTransactionChatSignalCompat = {
      surface: 'tick_transaction',
      kind: report.isCinematicTick ? 'transaction.cinematic_tick' : 'transaction.ux_report',
      engineId: 'system',
      tick: report.tick,
      step: 'TICK_SUMMARY',
      severity: report.criticalDrops > 0 ? 'warn' : 'info',
      message: `Tick ${report.tick} UX: grade=${report.experienceGrade}, avgScore=${report.avgUXScore.toFixed(3)}, cinematic=${report.isCinematicTick}, drops=${report.criticalDrops}`,
      uxScore: report.avgUXScore,
      uxGrade: report.experienceGrade,
    };

    return this.ingestSignal(signal, context);
  }

  public ingestHealthReport(
    health: TickTransactionHealthReportCompat,
    tick: number,
    context?: TickTransactionSignalAdapterContext,
  ): TickTransactionSignalAdapterArtifact | TickTransactionSignalAdapterRejection | TickTransactionSignalAdapterDeduped {
    const isFailed = health.overallHealth === 'FAILED';
    const isDegraded = health.overallHealth === 'DEGRADED';

    const signal: TickTransactionChatSignalCompat = {
      surface: 'tick_transaction',
      kind: 'transaction.health_alert',
      engineId: 'system',
      tick,
      step: 'HEALTH_SUMMARY',
      severity: isFailed ? 'error' : isDegraded ? 'warn' : 'info',
      message: `Transaction health: ${health.overallHealth}, uptime=${health.systemUptimeRatio.toFixed(3)}, failed=${health.criticalEngines.length}`,
      systemHealthGrade: health.overallHealth,
      uxScore: health.systemUptimeRatio,
    };

    return this.ingestSignal(signal, context);
  }

  public ingestBatch(
    signals: readonly TickTransactionChatSignalCompat[],
    context?: TickTransactionSignalAdapterContext,
  ): TickTransactionSignalAdapterReport {
    const accepted: TickTransactionSignalAdapterArtifact[] = [];
    const deduped: TickTransactionSignalAdapterDeduped[] = [];
    const rejected: TickTransactionSignalAdapterRejection[] = [];

    for (const signal of signals) {
      const result = this.ingestSignal(signal, context);
      if ('envelope' in result) {
        accepted.push(result);
      } else if ('dedupeKey' in result) {
        deduped.push(result);
      } else {
        rejected.push(result);
      }
    }

    return Object.freeze({ accepted, deduped, rejected });
  }

  // ── State and diagnostics ─────────────────────────────────────────────────

  public getState(): TickTransactionSignalAdapterState {
    return Object.freeze({
      history: Object.freeze([...this.history]),
      lastAcceptedAtByKey: Object.freeze(Object.fromEntries(this.lastAcceptedAtByKey)),
      lastTick: this.lastTick,
      lastUXGrade: this.lastUXGrade,
      acceptedCount: this.acceptedCount,
      dedupedCount: this.dedupedCount,
      rejectedCount: this.rejectedCount,
      rollbackCount: this.rollbackCount,
      cinematicCount: this.cinematicCount,
      budgetViolationCount: this.budgetViolationCount,
    });
  }

  public buildReport(): TickTransactionSignalAdapterReport {
    return Object.freeze({ accepted: [], deduped: [], rejected: [] });
  }

  public buildHealthDiagnostics(): Readonly<Record<string, JsonValue>> {
    return Object.freeze({
      acceptedCount: this.acceptedCount,
      dedupedCount: this.dedupedCount,
      rejectedCount: this.rejectedCount,
      rollbackCount: this.rollbackCount,
      cinematicCount: this.cinematicCount,
      budgetViolationCount: this.budgetViolationCount,
      lastTick: this.lastTick,
      lastUXGrade: this.lastUXGrade,
    });
  }

  public reset(): void {
    this.history.length = 0;
    this.lastAcceptedAtByKey.clear();
    this.acceptedCount = 0;
    this.dedupedCount = 0;
    this.rejectedCount = 0;
    this.rollbackCount = 0;
    this.cinematicCount = 0;
    this.budgetViolationCount = 0;
    this.lastTick = 0;
    this.lastUXGrade = 'B';
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private isSignalMeaningful(
    signal: TickTransactionChatSignalCompat,
    uxScore: number,
    budgetRatio: number,
  ): boolean {
    if (signal.severity !== 'info') return true;
    if (budgetRatio > 1.5) return true;
    if (signal.kind.includes('cinematic')) return true;
    if (signal.kind.includes('analytics')) return uxScore < 0.7;
    return uxScore < this.options.uxWarnThreshold;
  }

  private isDuplicate(dedupeKey: string, now: UnixMs): boolean {
    const lastAt = this.lastAcceptedAtByKey.get(dedupeKey);
    if (lastAt === undefined) return false;
    return now - lastAt < this.options.dedupeWindowMs;
  }

  private computeAdapterSeverity(
    signal: TickTransactionChatSignalCompat,
    uxScore: number,
    isRollback: boolean,
    isBudgetCritical: boolean,
  ): TickTransactionSignalAdapterSeverity {
    if (isRollback || signal.severity === 'error' || isBudgetCritical) return 'CRITICAL';
    if (signal.severity === 'warn' || uxScore < this.options.uxWarnThreshold) return 'WARN';
    return 'INFO';
  }

  private computeNarrativeWeight(
    signal: TickTransactionChatSignalCompat,
    uxScore: number,
    isRollback: boolean,
    isCinematic: boolean,
  ): TickTransactionSignalAdapterNarrativeWeight {
    if (isCinematic) return 'CINEMATIC';
    if (isRollback || signal.severity === 'error') return 'CRITICAL';
    if (uxScore < this.options.uxWarnThreshold) return 'OPERATIONAL';
    return 'AMBIENT';
  }

  private scoreToGrade(score: number): string {
    if (score >= 0.90) return 'S';
    if (score >= 0.75) return 'A';
    if (score >= 0.60) return 'B';
    if (score >= 0.45) return 'C';
    if (score >= 0.30) return 'D';
    return 'F';
  }

  private acceptArtifact(
    artifact: TickTransactionSignalAdapterArtifact,
    dedupeKey: string,
    now: UnixMs,
    isRollback: boolean,
    isCinematic: boolean,
    budgetExceeded: boolean,
  ): void {
    this.acceptedCount++;
    this.lastAcceptedAtByKey.set(dedupeKey, now);

    const entry: TickTransactionSignalAdapterHistoryEntry = Object.freeze({
      at: now,
      eventName: artifact.eventName,
      tick: artifact.tick,
      step: artifact.step,
      engineId: artifact.engineId,
      severity: artifact.severity,
      isRollback,
      isCinematic,
      uxScore: artifact.uxScore,
      dedupeKey,
    });

    this.history.push(entry);
    if (this.history.length > this.options.maxHistory) {
      this.history.shift();
    }

    void budgetExceeded; // tracked via budgetViolationCount externally
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

export function createTickTransactionSignalAdapter(
  options: TickTransactionSignalAdapterOptions,
): TickTransactionSignalAdapter {
  return new TickTransactionSignalAdapter(options);
}

// ─── §2 TickTransactionRollingWindow ──────────────────────────────────────────
/** 60-tick rolling window of UX and budget metrics. */
export interface TickTransactionWindowSnapshot {
  readonly tick: number;
  readonly uxScore: Score01;
  readonly budgetRatio: Score01;
  readonly isRollback: boolean;
  readonly isCinematic: boolean;
  readonly grade: string;
  readonly durationMs: number;
  readonly at: UnixMs;
}

export type TickTransactionWindowTrend = 'ESCALATING' | 'RECOVERING' | 'STABLE';

export class TickTransactionRollingWindow {
  private readonly capacity: number;
  private readonly snapshots: TickTransactionWindowSnapshot[] = [];

  public constructor(capacity: number = 60) {
    this.capacity = capacity;
  }

  public record(snap: TickTransactionWindowSnapshot): void {
    if (this.snapshots.length >= this.capacity) this.snapshots.shift();
    this.snapshots.push(snap);
  }

  public averageUXScore(): Score01 {
    if (this.snapshots.length === 0) return clamp01(0.7) as Score01;
    return clamp01(this.snapshots.reduce((s, r) => s + r.uxScore, 0) / this.snapshots.length) as Score01;
  }

  public averageBudgetRatio(): Score01 {
    if (this.snapshots.length === 0) return clamp01(0.5) as Score01;
    return clamp01(this.snapshots.reduce((s, r) => s + r.budgetRatio, 0) / this.snapshots.length) as Score01;
  }

  public rollbackRate(): Score01 {
    if (this.snapshots.length === 0) return clamp01(0) as Score01;
    const rollbacks = this.snapshots.filter(r => r.isRollback).length;
    return clamp01(rollbacks / this.snapshots.length) as Score01;
  }

  public cinematicRate(): Score01 {
    if (this.snapshots.length === 0) return clamp01(0) as Score01;
    const cinematics = this.snapshots.filter(r => r.isCinematic).length;
    return clamp01(cinematics / this.snapshots.length) as Score01;
  }

  public trend(): TickTransactionWindowTrend {
    if (this.snapshots.length < 10) return 'STABLE';
    const half = Math.floor(this.snapshots.length / 2);
    const recent = this.snapshots.slice(-half);
    const older = this.snapshots.slice(0, half);
    const recentAvg = recent.reduce((s, r) => s + r.uxScore, 0) / recent.length;
    const olderAvg = older.reduce((s, r) => s + r.uxScore, 0) / older.length;
    const delta = recentAvg - olderAvg;
    if (delta > 0.05) return 'RECOVERING';
    if (delta < -0.05) return 'ESCALATING';
    return 'STABLE';
  }

  public minUXScore(): Score01 {
    if (this.snapshots.length === 0) return clamp01(0) as Score01;
    return clamp01(Math.min(...this.snapshots.map(r => r.uxScore))) as Score01;
  }

  public peakBudgetRatio(): number {
    if (this.snapshots.length === 0) return 0;
    return Math.max(...this.snapshots.map(r => r.budgetRatio));
  }

  public clear(): void { this.snapshots.length = 0; }
  public size(): number { return this.snapshots.length; }
  public latest(): TickTransactionWindowSnapshot | undefined {
    return this.snapshots[this.snapshots.length - 1];
  }
  public all(): ReadonlyArray<TickTransactionWindowSnapshot> { return this.snapshots; }
}

// ─── §3 TickTransactionSignalAnalytics ────────────────────────────────────────
/** Per-step analytics tracker for transaction signals. */
export interface TickTransactionStepStats {
  readonly step: string;
  readonly totalSignals: number;
  readonly rollbackCount: number;
  readonly cinematicCount: number;
  readonly budgetViolations: number;
  readonly avgUXScore: Score01;
  readonly lastUXScore: Score01;
  readonly lastSeenTick: number;
  readonly lastGrade: string;
  readonly rollbackRate: Score01;
}

export class TickTransactionSignalAnalytics {
  private readonly stepStats: Map<string, {
    totalSignals: number;
    rollbackCount: number;
    cinematicCount: number;
    budgetViolations: number;
    uxScoreSum: number;
    lastUXScore: number;
    lastSeenTick: number;
    lastGrade: string;
  }> = new Map();

  private totalProcessed = 0;
  private totalRollbacks = 0;
  private totalCinematic = 0;

  public record(artifact: TickTransactionSignalAdapterArtifact): void {
    this.totalProcessed++;
    if (artifact.isRollback) this.totalRollbacks++;
    if (artifact.isCinematic) this.totalCinematic++;

    const existing = this.stepStats.get(artifact.step) ?? {
      totalSignals: 0,
      rollbackCount: 0,
      cinematicCount: 0,
      budgetViolations: 0,
      uxScoreSum: 0,
      lastUXScore: artifact.uxScore,
      lastSeenTick: artifact.tick,
      lastGrade: artifact.uxGrade,
    };

    this.stepStats.set(artifact.step, {
      totalSignals: existing.totalSignals + 1,
      rollbackCount: existing.rollbackCount + (artifact.isRollback ? 1 : 0),
      cinematicCount: existing.cinematicCount + (artifact.isCinematic ? 1 : 0),
      budgetViolations: existing.budgetViolations + (artifact.budgetRatio > 0.7 ? 1 : 0),
      uxScoreSum: existing.uxScoreSum + artifact.uxScore,
      lastUXScore: artifact.uxScore,
      lastSeenTick: artifact.tick,
      lastGrade: artifact.uxGrade,
    });
  }

  public getStepStats(step: string): TickTransactionStepStats | undefined {
    const s = this.stepStats.get(step);
    if (!s) return undefined;
    const avgUX = s.totalSignals > 0
      ? clamp01(s.uxScoreSum / s.totalSignals) as Score01
      : clamp01(0.7) as Score01;
    return Object.freeze({
      step,
      totalSignals: s.totalSignals,
      rollbackCount: s.rollbackCount,
      cinematicCount: s.cinematicCount,
      budgetViolations: s.budgetViolations,
      avgUXScore: avgUX,
      lastUXScore: clamp01(s.lastUXScore) as Score01,
      lastSeenTick: s.lastSeenTick,
      lastGrade: s.lastGrade,
      rollbackRate: clamp01(s.totalSignals > 0 ? s.rollbackCount / s.totalSignals : 0) as Score01,
    });
  }

  public allStepStats(): ReadonlyArray<TickTransactionStepStats> {
    return [...this.stepStats.keys()]
      .map(s => this.getStepStats(s)!)
      .filter(Boolean);
  }

  public globalRollbackRate(): Score01 {
    return clamp01(this.totalProcessed > 0 ? this.totalRollbacks / this.totalProcessed : 0) as Score01;
  }

  public globalCinematicRate(): Score01 {
    return clamp01(this.totalProcessed > 0 ? this.totalCinematic / this.totalProcessed : 0) as Score01;
  }

  public mostProblematicStep(): string | undefined {
    let worst: string | undefined;
    let worstRate = 0;
    for (const [step, s] of this.stepStats) {
      const rate = s.totalSignals > 0 ? s.rollbackCount / s.totalSignals : 0;
      if (rate > worstRate) { worstRate = rate; worst = step; }
    }
    return worst;
  }

  public reset(): void {
    this.stepStats.clear();
    this.totalProcessed = 0;
    this.totalRollbacks = 0;
    this.totalCinematic = 0;
  }
}

// ─── §4 TickTransactionMLExtractor ────────────────────────────────────────────
/** Extracts a 12-feature normalized DL input tensor from transaction history. */
export const TICK_TRANSACTION_DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  'avgUXScore',
  'avgBudgetRatio',
  'rollbackRate',
  'cinematicRate',
  'budgetViolationRate',
  'trendScore',
  'minUXScore',
  'peakBudgetRatioNorm',
  'stepHealthScore',
  'globalFailurePresence',
  'uxDropFrequency',
  'recoveryMomentum',
]);

export interface TickTransactionDLVector {
  readonly tick: number;
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly generatedAt: UnixMs;
  readonly dominantTrend: TickTransactionWindowTrend;
  readonly isCritical: boolean;
}

export class TickTransactionMLExtractor {
  private readonly window: TickTransactionRollingWindow;
  private readonly analytics: TickTransactionSignalAnalytics;

  public constructor(
    window: TickTransactionRollingWindow,
    analytics: TickTransactionSignalAnalytics,
  ) {
    this.window = window;
    this.analytics = analytics;
  }

  public extract(tick: number, now: UnixMs): TickTransactionDLVector {
    const avgUX = this.window.averageUXScore();
    const avgBudget = this.window.averageBudgetRatio();
    const rollbackRate = this.window.rollbackRate();
    const cinematicRate = this.window.cinematicRate();
    const trend = this.window.trend();
    const trendScore = trend === 'RECOVERING' ? 1 : trend === 'ESCALATING' ? 0 : 0.5;
    const minUX = this.window.minUXScore();
    const peakBudget = clamp01(this.window.peakBudgetRatio() / 5);
    const allSteps = this.analytics.allStepStats();
    const budgetViolRate = clamp01(
      allSteps.length > 0
        ? allSteps.reduce((s, st) => s + st.budgetViolations, 0) /
          Math.max(1, allSteps.reduce((s, st) => s + st.totalSignals, 0))
        : 0,
    );
    const stepHealth = clamp01(
      allSteps.length > 0
        ? allSteps.reduce((s, st) => s + st.avgUXScore, 0) / allSteps.length
        : 0.7,
    );
    const globalFailure = this.analytics.globalRollbackRate() > 0.1 ? 1 : 0;
    const uxDropFreq = clamp01(rollbackRate + budgetViolRate * 0.5);
    const recoveryMomentum = trend === 'RECOVERING' ? clamp01(avgUX - 0.5) : 0;

    const features: number[] = [
      avgUX, avgBudget, rollbackRate, cinematicRate,
      budgetViolRate, trendScore, minUX, peakBudget,
      stepHealth, globalFailure, uxDropFreq, recoveryMomentum,
    ];

    return Object.freeze({
      tick,
      features: Object.freeze(features),
      labels: TICK_TRANSACTION_DL_FEATURE_LABELS,
      generatedAt: now,
      dominantTrend: trend,
      isCritical: rollbackRate > 0.2 || avgUX < 0.35,
    });
  }
}

// ─── §5 TickTransactionPatternDetector ────────────────────────────────────────
/** Detects cross-tick patterns: UX collapse, budget runaway, recovery stall, etc. */
export type TickTransactionPatternKind =
  | 'UX_COLLAPSE'
  | 'BUDGET_RUNAWAY'
  | 'ROLLBACK_STORM'
  | 'CINEMATIC_SEQUENCE'
  | 'RECOVERY_STALL';

export interface TickTransactionPattern {
  readonly kind: TickTransactionPatternKind;
  readonly detectedAtTick: number;
  readonly severity: TickTransactionSignalAdapterSeverity;
  readonly description: string;
  readonly confidence: Score01;
}

export class TickTransactionPatternDetector {
  private readonly history: TickTransactionPattern[] = [];
  private readonly maxHistory = 50;

  public analyze(
    window: TickTransactionRollingWindow,
    analytics: TickTransactionSignalAnalytics,
    tick: number,
  ): ReadonlyArray<TickTransactionPattern> {
    const detected: TickTransactionPattern[] = [];
    const avgUX = window.averageUXScore();
    const rollbackRate = window.rollbackRate();
    const avgBudget = window.averageBudgetRatio();
    const trend = window.trend();

    if (avgUX < 0.3) {
      detected.push(this.mkPattern('UX_COLLAPSE', tick, 'CRITICAL',
        `Average UX score collapsed to ${avgUX.toFixed(2)}`,
        clamp01(1 - avgUX) as Score01));
    }

    if (avgBudget > 0.8) {
      detected.push(this.mkPattern('BUDGET_RUNAWAY', tick, 'CRITICAL',
        `Average budget ratio at ${avgBudget.toFixed(2)} — execution overrunning`,
        clamp01(avgBudget) as Score01));
    }

    if (rollbackRate > 0.3) {
      detected.push(this.mkPattern('ROLLBACK_STORM', tick, 'CRITICAL',
        `${(rollbackRate * 100).toFixed(0)}% of transactions rolling back`,
        clamp01(rollbackRate) as Score01));
    }

    if (window.cinematicRate() > 0.4) {
      detected.push(this.mkPattern('CINEMATIC_SEQUENCE', tick, 'INFO',
        `${(window.cinematicRate() * 100).toFixed(0)}% cinematic tick rate — high UX quality streak`,
        window.cinematicRate()));
    }

    if (trend === 'ESCALATING' && avgUX < 0.5 && analytics.globalRollbackRate() > 0.1) {
      detected.push(this.mkPattern('RECOVERY_STALL', tick, 'WARN',
        'UX escalating downward with elevated rollbacks — recovery stalled',
        clamp01(0.5 + analytics.globalRollbackRate()) as Score01));
    }

    for (const p of detected) {
      if (this.history.length >= this.maxHistory) this.history.shift();
      this.history.push(p);
    }

    return Object.freeze(detected);
  }

  private mkPattern(
    kind: TickTransactionPatternKind,
    tick: number,
    severity: TickTransactionSignalAdapterSeverity,
    description: string,
    confidence: Score01,
  ): TickTransactionPattern {
    return Object.freeze({ kind, detectedAtTick: tick, severity, description, confidence });
  }

  public recentPatterns(limit = 10): ReadonlyArray<TickTransactionPattern> {
    return this.history.slice(-limit);
  }

  public reset(): void { this.history.length = 0; }
}

// ─── §6 TickTransactionHealthTracker ─────────────────────────────────────────
export type TickTransactionHealthGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface TickTransactionHealthReport {
  readonly grade: TickTransactionHealthGrade;
  readonly avgUXScore: Score01;
  readonly rollbackRate: Score01;
  readonly cinematicRate: Score01;
  readonly trend: TickTransactionWindowTrend;
  readonly isHealthy: boolean;
  readonly isCinematic: boolean;
  readonly isCritical: boolean;
  readonly description: string;
}

export class TickTransactionHealthTracker {
  private readonly window: TickTransactionRollingWindow;
  private readonly analytics: TickTransactionSignalAnalytics;

  public constructor(
    window: TickTransactionRollingWindow,
    analytics: TickTransactionSignalAnalytics,
  ) {
    this.window = window;
    this.analytics = analytics;
  }

  public computeGrade(): TickTransactionHealthGrade {
    const avgUX = this.window.averageUXScore();
    const rollbackRate = this.window.rollbackRate();
    const composite = avgUX * 0.6 + (1 - rollbackRate) * 0.4;
    if (composite >= 0.92) return 'S';
    if (composite >= 0.82) return 'A';
    if (composite >= 0.68) return 'B';
    if (composite >= 0.50) return 'C';
    if (composite >= 0.32) return 'D';
    return 'F';
  }

  public buildReport(): TickTransactionHealthReport {
    const avgUXScore = this.window.averageUXScore();
    const rollbackRate = this.window.rollbackRate();
    const cinematicRate = this.window.cinematicRate();
    const trend = this.window.trend();
    const grade = this.computeGrade();

    const descriptions: Record<TickTransactionHealthGrade, string> = {
      S: 'Transaction UX at peak — high cinematic rate, zero rollbacks',
      A: 'Excellent transaction health — minimal rollback activity',
      B: 'Good transaction health — occasional budget variance',
      C: 'Moderate health — elevated rollback or budget pressure',
      D: 'Poor health — frequent rollbacks degrading UX',
      F: 'Transaction system in failure state — cascading rollbacks',
    };

    return Object.freeze({
      grade,
      avgUXScore,
      rollbackRate,
      cinematicRate,
      trend,
      isHealthy: grade === 'S' || grade === 'A' || grade === 'B',
      isCinematic: cinematicRate > 0.3 && grade !== 'F',
      isCritical: grade === 'F' || grade === 'D',
      description: descriptions[grade],
    });
  }

  public reset(): void {
    this.window.clear();
    this.analytics.reset();
  }
}

// ─── §7 TickTransactionNarrativeRouter ────────────────────────────────────────
export type TickTransactionNarrativeChannel =
  | 'BOSS_DIALOGUE'
  | 'HELPER_CALLOUT'
  | 'HATER_TAUNT'
  | 'AMBIENT_COMMENT'
  | 'SYSTEM_ALERT'
  | 'SILENT';

export interface TickTransactionNarrativeRoute {
  readonly channel: TickTransactionNarrativeChannel;
  readonly priority: number;
  readonly reason: string;
}

export class TickTransactionNarrativeRouter {
  public route(artifact: TickTransactionSignalAdapterArtifact): TickTransactionNarrativeRoute {
    if (artifact.isRollback && artifact.severity === 'CRITICAL') {
      return { channel: 'BOSS_DIALOGUE', priority: 100, reason: 'rollback_critical' };
    }
    if (artifact.isCinematic) {
      return { channel: 'HELPER_CALLOUT', priority: 90, reason: 'cinematic_ux' };
    }
    if (artifact.severity === 'CRITICAL') {
      return { channel: 'SYSTEM_ALERT', priority: 80, reason: 'budget_critical' };
    }
    if (artifact.narrativeWeight === 'OPERATIONAL') {
      return { channel: 'HATER_TAUNT', priority: 50, reason: 'performance_pressure' };
    }
    if (artifact.uxScore > 0.85) {
      return { channel: 'SILENT', priority: 5, reason: 'high_ux_ambient_suppress' };
    }
    return { channel: 'AMBIENT_COMMENT', priority: 20, reason: 'transaction_ambient' };
  }

  public routeBatch(
    artifacts: ReadonlyArray<TickTransactionSignalAdapterArtifact>,
  ): ReadonlyArray<{ artifact: TickTransactionSignalAdapterArtifact; route: TickTransactionNarrativeRoute }> {
    return artifacts
      .map(a => ({ artifact: a, route: this.route(a) }))
      .sort((a, b) => b.route.priority - a.route.priority);
  }
}

// ─── §8 TickTransactionSignalCorrelator ───────────────────────────────────────
export interface TickTransactionCorrelationEntry {
  readonly correlationId: string;
  readonly step: string;
  readonly engineId: string;
  readonly startTick: number;
  readonly lastTick: number;
  readonly signalCount: number;
  readonly hasRollback: boolean;
  readonly hasCinematic: boolean;
}

export class TickTransactionSignalCorrelator {
  private readonly active: Map<string, TickTransactionCorrelationEntry> = new Map();
  private readonly maxActive = 100;

  public correlate(artifact: TickTransactionSignalAdapterArtifact): string {
    const key = `${artifact.engineId}:${artifact.step}`;
    const existing = this.active.get(key);
    const id = existing?.correlationId ?? `tx-${artifact.engineId}-${artifact.step}-${artifact.tick}`;

    this.active.set(key, Object.freeze({
      correlationId: id,
      step: artifact.step,
      engineId: artifact.engineId,
      startTick: existing?.startTick ?? artifact.tick,
      lastTick: artifact.tick,
      signalCount: (existing?.signalCount ?? 0) + 1,
      hasRollback: (existing?.hasRollback ?? false) || artifact.isRollback,
      hasCinematic: (existing?.hasCinematic ?? false) || artifact.isCinematic,
    }));

    if (this.active.size > this.maxActive) {
      const firstKey = this.active.keys().next().value;
      if (firstKey) this.active.delete(firstKey);
    }

    return id;
  }

  public activeCorrelations(): ReadonlyArray<TickTransactionCorrelationEntry> {
    return [...this.active.values()];
  }

  public reset(): void { this.active.clear(); }
}

// ─── §9 TickTransactionSignalBudget ───────────────────────────────────────────
export type TickTransactionSignalPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'BACKGROUND';

export interface TickTransactionBudgetedEnvelope {
  readonly envelope: ChatInputEnvelope;
  readonly priority: TickTransactionSignalPriority;
  readonly step: string;
}

const TX_PRIORITY_NUMERIC: Record<TickTransactionSignalPriority, number> = {
  CRITICAL: 100, HIGH: 75, MEDIUM: 50, LOW: 25, BACKGROUND: 10,
};

export class TickTransactionSignalBudget {
  private readonly maxPerTick: number;
  private readonly queue: TickTransactionBudgetedEnvelope[] = [];
  private flushedThisTick = 0;

  public constructor(maxPerTick: number = 10) {
    this.maxPerTick = maxPerTick;
  }

  public enqueue(
    envelope: ChatInputEnvelope,
    priority: TickTransactionSignalPriority,
    step: string,
  ): void {
    this.queue.push(Object.freeze({ envelope, priority, step }));
  }

  public flush(): ReadonlyArray<ChatInputEnvelope> {
    const sorted = [...this.queue].sort(
      (a, b) => TX_PRIORITY_NUMERIC[b.priority] - TX_PRIORITY_NUMERIC[a.priority],
    );
    const allowed = sorted.slice(0, this.maxPerTick);
    this.flushedThisTick = allowed.length;
    this.queue.length = 0;
    return Object.freeze(allowed.map(b => b.envelope));
  }

  public deriveSignalPriority(artifact: TickTransactionSignalAdapterArtifact): TickTransactionSignalPriority {
    if (artifact.isRollback || artifact.severity === 'CRITICAL') return 'CRITICAL';
    if (artifact.isCinematic) return 'HIGH';
    if (artifact.severity === 'WARN') return 'MEDIUM';
    if (artifact.uxScore > 0.85) return 'LOW';
    return 'BACKGROUND';
  }

  public stats(): { flushedThisTick: number; maxPerTick: number; pendingCount: number } {
    return { flushedThisTick: this.flushedThisTick, maxPerTick: this.maxPerTick, pendingCount: this.queue.length };
  }

  public reset(): void { this.queue.length = 0; this.flushedThisTick = 0; }
}

// ─── §10 TickTransactionSignalPipeline ────────────────────────────────────────
export interface TickTransactionSignalPipelineOptions {
  readonly roomId: ChatRoomId | string;
  readonly maxEnvelopesPerTick?: number;
  readonly dedupeWindowMs?: number;
  readonly maxHistory?: number;
}

export interface TickTransactionSignalPipelineResult {
  readonly tick: number;
  readonly envelopes: ReadonlyArray<ChatInputEnvelope>;
  readonly acceptedCount: number;
  readonly dedupedCount: number;
  readonly rejectedCount: number;
  readonly dlVector: TickTransactionDLVector;
  readonly healthReport: TickTransactionHealthReport;
  readonly patterns: ReadonlyArray<TickTransactionPattern>;
}

export class TickTransactionSignalPipeline {
  public readonly adapter: TickTransactionSignalAdapter;
  public readonly rollingWindow: TickTransactionRollingWindow;
  public readonly analytics: TickTransactionSignalAnalytics;
  public readonly mlExtractor: TickTransactionMLExtractor;
  public readonly patternDetector: TickTransactionPatternDetector;
  public readonly healthTracker: TickTransactionHealthTracker;
  public readonly narrativeRouter: TickTransactionNarrativeRouter;
  public readonly correlator: TickTransactionSignalCorrelator;
  public readonly budget: TickTransactionSignalBudget;
  private readonly clock: TickTransactionSignalAdapterClock;

  public constructor(opts: TickTransactionSignalPipelineOptions) {
    this.clock = SYSTEM_CLOCK;
    this.adapter = new TickTransactionSignalAdapter({
      defaultRoomId: opts.roomId,
      dedupeWindowMs: opts.dedupeWindowMs ?? 2_000,
      maxHistory: opts.maxHistory ?? 300,
      alwaysEmitOnRollback: true,
    });
    this.rollingWindow = new TickTransactionRollingWindow(60);
    this.analytics = new TickTransactionSignalAnalytics();
    this.mlExtractor = new TickTransactionMLExtractor(this.rollingWindow, this.analytics);
    this.patternDetector = new TickTransactionPatternDetector();
    this.healthTracker = new TickTransactionHealthTracker(this.rollingWindow, this.analytics);
    this.narrativeRouter = new TickTransactionNarrativeRouter();
    this.correlator = new TickTransactionSignalCorrelator();
    this.budget = new TickTransactionSignalBudget(opts.maxEnvelopesPerTick ?? 10);
  }

  public processTick(
    signals: ReadonlyArray<TickTransactionChatSignalCompat>,
    tick: number,
    uxReport?: TickTransactionUXReportCompat,
  ): TickTransactionSignalPipelineResult {
    const now = this.clock.now();
    let accepted = 0;
    let deduped = 0;
    let rejected = 0;

    for (const signal of signals) {
      const result = this.adapter.ingestSignal(signal);
      if ('envelope' in result) {
        accepted++;
        this.analytics.record(result);
        const route = this.narrativeRouter.route(result);
        if (route.channel !== 'SILENT') {
          const priority = this.budget.deriveSignalPriority(result);
          this.budget.enqueue(result.envelope, priority, result.step);
        }
        this.correlator.correlate(result);
        this.rollingWindow.record({
          tick: result.tick,
          uxScore: result.uxScore,
          budgetRatio: result.budgetRatio,
          isRollback: result.isRollback,
          isCinematic: result.isCinematic,
          grade: result.uxGrade,
          durationMs: (result.details as Record<string, unknown>).durationMs as number ?? 0,
          at: now,
        });
      } else if ('dedupeKey' in result) {
        deduped++;
      } else {
        rejected++;
      }
    }

    if (uxReport !== undefined) {
      const rptResult = this.adapter.ingestUXReport(uxReport);
      if ('envelope' in rptResult) {
        accepted++;
        this.analytics.record(rptResult);
        const priority = this.budget.deriveSignalPriority(rptResult);
        this.budget.enqueue(rptResult.envelope, priority, rptResult.step);
      }
    }

    const dlVector = this.mlExtractor.extract(tick, now);
    const healthReport = this.healthTracker.buildReport();
    const patterns = this.patternDetector.analyze(this.rollingWindow, this.analytics, tick);
    const envelopes = this.budget.flush();

    return Object.freeze({
      tick, envelopes, acceptedCount: accepted, dedupedCount: deduped,
      rejectedCount: rejected, dlVector, healthReport, patterns,
    });
  }

  public reset(): void {
    this.adapter.reset();
    this.rollingWindow.clear();
    this.analytics.reset();
    this.patternDetector.reset();
    this.correlator.reset();
    this.budget.reset();
  }
}

// ─── §11 TickTransactionSignalFacade ─────────────────────────────────────────
export class TickTransactionSignalFacade {
  private readonly pipeline: TickTransactionSignalPipeline;

  public constructor(opts: TickTransactionSignalPipelineOptions) {
    this.pipeline = new TickTransactionSignalPipeline(opts);
  }

  public onTick(
    signals: ReadonlyArray<TickTransactionChatSignalCompat>,
    tick: number,
    uxReport?: TickTransactionUXReportCompat,
  ): ReadonlyArray<ChatInputEnvelope> {
    return this.pipeline.processTick(signals, tick, uxReport).envelopes;
  }

  public diagnostics(): Readonly<Record<string, JsonValue>> {
    const state = this.pipeline.adapter.getState();
    const health = this.pipeline.healthTracker.buildReport();
    return Object.freeze({
      accepted: state.acceptedCount,
      deduped: state.dedupedCount,
      rejected: state.rejectedCount,
      rollbacks: state.rollbackCount,
      cinematic: state.cinematicCount,
      budgetViolations: state.budgetViolationCount,
      grade: health.grade,
      trend: health.trend,
      isCinematic: health.isCinematic,
      isCritical: health.isCritical,
      lastTick: state.lastTick,
      lastUXGrade: state.lastUXGrade,
      avgUXScore: parseFloat(health.avgUXScore.toFixed(4)),
      rollbackRate: parseFloat(health.rollbackRate.toFixed(4)),
    });
  }

  public reset(): void { this.pipeline.reset(); }
}

// ─── §12 TickTransactionSignalAdapterSuite ────────────────────────────────────
export class TickTransactionSignalAdapterSuite {
  public readonly adapter: TickTransactionSignalAdapter;
  public readonly pipeline: TickTransactionSignalPipeline;
  public readonly analytics: TickTransactionSignalAnalytics;
  public readonly patternDetector: TickTransactionPatternDetector;
  public readonly mlExtractor: TickTransactionMLExtractor;
  public readonly healthTracker: TickTransactionHealthTracker;
  public readonly correlator: TickTransactionSignalCorrelator;
  public readonly narrativeRouter: TickTransactionNarrativeRouter;
  public readonly rollingWindow: TickTransactionRollingWindow;
  public readonly budget: TickTransactionSignalBudget;
  public readonly facade: TickTransactionSignalFacade;

  public constructor(opts: TickTransactionSignalPipelineOptions) {
    this.pipeline = new TickTransactionSignalPipeline(opts);
    this.adapter = this.pipeline.adapter;
    this.analytics = this.pipeline.analytics;
    this.patternDetector = this.pipeline.patternDetector;
    this.mlExtractor = this.pipeline.mlExtractor;
    this.healthTracker = this.pipeline.healthTracker;
    this.correlator = this.pipeline.correlator;
    this.narrativeRouter = this.pipeline.narrativeRouter;
    this.rollingWindow = this.pipeline.rollingWindow;
    this.budget = this.pipeline.budget;
    this.facade = new TickTransactionSignalFacade(opts);
  }

  public diagnostics(): Readonly<Record<string, JsonValue>> {
    return this.facade.diagnostics();
  }

  public reset(): void {
    this.pipeline.reset();
    this.facade.reset();
  }
}

// ─── §13 Manifest, constants, type guards, factories ─────────────────────────
export const TICK_TRANSACTION_SIGNAL_ADAPTER_MANIFEST = Object.freeze({
  name: 'TickTransactionSignalAdapter',
  version: '2.0.0',
  surface: 'tick_transaction',
  dlFeatureCount: TICK_TRANSACTION_DL_FEATURE_LABELS.length,
  maxEnvelopesPerTick: 10,
  rollingWindowCapacity: 60,
  dedupeWindowMs: DEFAULT_DEDUPE_WINDOW_MS,
} as const);

export function isTickTransactionSignalAdapterArtifact(
  v: unknown,
): v is TickTransactionSignalAdapterArtifact {
  return (
    typeof v === 'object' && v !== null &&
    'envelope' in v && 'dedupeKey' in v &&
    'isRollback' in v && 'isCinematic' in v && 'uxScore' in v
  );
}

export function isTickTransactionChatSignalCompat(
  v: unknown,
): v is TickTransactionChatSignalCompat {
  return (
    typeof v === 'object' && v !== null &&
    'surface' in v && (v as Record<string, unknown>).surface === 'tick_transaction' &&
    'kind' in v && 'engineId' in v && 'tick' in v && 'step' in v
  );
}

export function createTickTransactionSignalPipeline(
  opts: TickTransactionSignalPipelineOptions,
): TickTransactionSignalPipeline {
  return new TickTransactionSignalPipeline(opts);
}

export function createTickTransactionSignalFacade(
  opts: TickTransactionSignalPipelineOptions,
): TickTransactionSignalFacade {
  return new TickTransactionSignalFacade(opts);
}

export function createTickTransactionSignalAdapterSuite(
  opts: TickTransactionSignalPipelineOptions,
): TickTransactionSignalAdapterSuite {
  return new TickTransactionSignalAdapterSuite(opts);
}

// ─── §14 TickTransactionUXScorer ─────────────────────────────────────────────
export interface TickTransactionUXScoreResult {
  readonly score100: Score100;
  readonly grade: TickTransactionHealthGrade;
  readonly isCinematic: boolean;
  readonly isRecovery: boolean;
  readonly description: string;
}

export class TickTransactionUXScorer {
  private readonly window: TickTransactionRollingWindow;
  private readonly analytics: TickTransactionSignalAnalytics;

  public constructor(
    window: TickTransactionRollingWindow,
    analytics: TickTransactionSignalAnalytics,
  ) {
    this.window = window;
    this.analytics = analytics;
  }

  public score(): TickTransactionUXScoreResult {
    const avgUX = this.window.averageUXScore();
    const rollbackRate = this.window.rollbackRate();
    const cinematicRate = this.window.cinematicRate();
    const trend = this.window.trend();

    const trendBonus = trend === 'RECOVERING' ? 5 : trend === 'ESCALATING' ? -10 : 0;
    const raw = avgUX * 60 + (1 - rollbackRate) * 25 + cinematicRate * 15 + trendBonus;
    const score100 = clamp100(Math.round(raw)) as Score100;

    const grade: TickTransactionHealthGrade =
      score100 >= 92 ? 'S' :
      score100 >= 82 ? 'A' :
      score100 >= 68 ? 'B' :
      score100 >= 50 ? 'C' :
      score100 >= 32 ? 'D' : 'F';

    const isCinematic = cinematicRate > 0.3 && grade !== 'F';
    const isRecovery = trend === 'RECOVERING' && avgUX > 0.6;

    const descriptions: Record<TickTransactionHealthGrade, string> = {
      S: 'Perfect transaction UX — cinematic flow, zero rollbacks',
      A: 'Excellent — high UX score with minimal disruption',
      B: 'Good — stable transaction execution with minor variance',
      C: 'Moderate — rollbacks or budget overruns visible to player',
      D: 'Poor — frequent transaction failures degrading UX',
      F: 'Transaction UX failure — severe rollback storm active',
    };

    return Object.freeze({ score100, grade, isCinematic, isRecovery, description: descriptions[grade] });
  }
}

// ─── §15 Module constants ─────────────────────────────────────────────────────
export const TICK_TRANSACTION_ADAPTER_READY = true;
export const TICK_TRANSACTION_MODULE_VERSION = '2.0.0' as const;
export const TICK_TRANSACTION_ROLLBACK_ALERT_THRESHOLD = 0.2 as const;
export const TICK_TRANSACTION_CINEMATIC_THRESHOLD = 0.88 as const;
export const TICK_TRANSACTION_BUDGET_CRITICAL_MULTIPLIER = DEFAULT_BUDGET_CRITICAL_MULTIPLIER;
export const TICK_TRANSACTION_UX_WARN_THRESHOLD = DEFAULT_UX_WARN_THRESHOLD;
export const TICK_TRANSACTION_ADAPTER_MODULE_EXPORTS = [
  'TickTransactionSignalAdapter',
  'TickTransactionSignalPipeline',
  'TickTransactionSignalFacade',
  'TickTransactionSignalAdapterSuite',
  'TickTransactionSignalAnalytics',
  'TickTransactionPatternDetector',
  'TickTransactionMLExtractor',
  'TickTransactionHealthTracker',
  'TickTransactionNarrativeRouter',
  'TickTransactionSignalCorrelator',
  'TickTransactionRollingWindow',
  'TickTransactionSignalBudget',
  'TickTransactionUXScorer',
] as const;

// ─── §16 TickTransactionDiagnosticsService ────────────────────────────────────
export interface TickTransactionDiagnosticsSnapshot {
  readonly version: string;
  readonly healthGrade: TickTransactionHealthGrade;
  readonly trend: TickTransactionWindowTrend;
  readonly totalAccepted: number;
  readonly totalDeduped: number;
  readonly totalRejected: number;
  readonly totalRollbacks: number;
  readonly totalCinematic: number;
  readonly totalBudgetViolations: number;
  readonly globalRollbackRate: Score01;
  readonly globalCinematicRate: Score01;
  readonly avgUXScore: Score01;
  readonly avgBudgetRatio: Score01;
  readonly activeStepCount: number;
  readonly mostProblematicStep: string | undefined;
  readonly recentPatternCount: number;
  readonly dlFeatureCount: number;
  readonly rollingWindowSize: number;
  readonly budgetStats: { flushedThisTick: number; maxPerTick: number; pendingCount: number };
}

export class TickTransactionDiagnosticsService {
  private readonly pipeline: TickTransactionSignalPipeline;

  public constructor(pipeline: TickTransactionSignalPipeline) {
    this.pipeline = pipeline;
  }

  public snapshot(): TickTransactionDiagnosticsSnapshot {
    const state = this.pipeline.adapter.getState();
    const health = this.pipeline.healthTracker.buildReport();
    const allStats = this.pipeline.analytics.allStepStats();
    const patterns = this.pipeline.patternDetector.recentPatterns(5);

    return Object.freeze({
      version: TICK_TRANSACTION_MODULE_VERSION,
      healthGrade: health.grade,
      trend: health.trend,
      totalAccepted: state.acceptedCount,
      totalDeduped: state.dedupedCount,
      totalRejected: state.rejectedCount,
      totalRollbacks: state.rollbackCount,
      totalCinematic: state.cinematicCount,
      totalBudgetViolations: state.budgetViolationCount,
      globalRollbackRate: this.pipeline.analytics.globalRollbackRate(),
      globalCinematicRate: this.pipeline.analytics.globalCinematicRate(),
      avgUXScore: this.pipeline.rollingWindow.averageUXScore(),
      avgBudgetRatio: this.pipeline.rollingWindow.averageBudgetRatio(),
      activeStepCount: allStats.length,
      mostProblematicStep: this.pipeline.analytics.mostProblematicStep(),
      recentPatternCount: patterns.length,
      dlFeatureCount: TICK_TRANSACTION_DL_FEATURE_LABELS.length,
      rollingWindowSize: this.pipeline.rollingWindow.size(),
      budgetStats: this.pipeline.budget.stats(),
    });
  }

  public toJsonValue(): Readonly<Record<string, JsonValue>> {
    const snap = this.snapshot();
    return Object.freeze({
      version: snap.version,
      healthGrade: snap.healthGrade,
      trend: snap.trend,
      totalAccepted: snap.totalAccepted,
      totalDeduped: snap.totalDeduped,
      totalRejected: snap.totalRejected,
      totalRollbacks: snap.totalRollbacks,
      totalCinematic: snap.totalCinematic,
      totalBudgetViolations: snap.totalBudgetViolations,
      globalRollbackRate: parseFloat(snap.globalRollbackRate.toFixed(4)),
      globalCinematicRate: parseFloat(snap.globalCinematicRate.toFixed(4)),
      avgUXScore: parseFloat(snap.avgUXScore.toFixed(4)),
      avgBudgetRatio: parseFloat(snap.avgBudgetRatio.toFixed(4)),
      activeStepCount: snap.activeStepCount,
      mostProblematicStep: snap.mostProblematicStep ?? null,
      recentPatternCount: snap.recentPatternCount,
      dlFeatureCount: snap.dlFeatureCount,
      rollingWindowSize: snap.rollingWindowSize,
    });
  }
}

// ─── §17 TickTransactionSignalRateController ──────────────────────────────────
export interface TickTransactionRateState {
  readonly currentRate: number;
  readonly lastAdjustedAtTick: number;
  readonly adjustmentReason: string;
}

export class TickTransactionSignalRateController {
  private currentRate: number;
  private readonly minRate: number;
  private readonly maxRate: number;
  private lastAdjustedAtTick = 0;
  private adjustmentReason = 'initial';

  public constructor(minRate = 1, maxRate = 12, initial = 6) {
    this.minRate = minRate;
    this.maxRate = maxRate;
    this.currentRate = Math.max(minRate, Math.min(maxRate, initial));
  }

  public adjust(healthReport: TickTransactionHealthReport, tick: number): void {
    const gradeToRate: Record<TickTransactionHealthGrade, number> = {
      S: 2, A: 3, B: 5, C: 7, D: 10, F: 12,
    };
    const target = gradeToRate[healthReport.grade];
    const clamped = Math.max(this.minRate, Math.min(this.maxRate, target));
    if (clamped !== this.currentRate) {
      this.adjustmentReason = `grade_${healthReport.grade}_trend_${healthReport.trend}`;
      this.lastAdjustedAtTick = tick;
    }
    this.currentRate = clamped;
  }

  public shouldEmit(signalNumber: number): boolean {
    return signalNumber <= this.currentRate;
  }

  public state(): TickTransactionRateState {
    return Object.freeze({
      currentRate: this.currentRate,
      lastAdjustedAtTick: this.lastAdjustedAtTick,
      adjustmentReason: this.adjustmentReason,
    });
  }

  public reset(): void {
    this.currentRate = Math.floor((this.minRate + this.maxRate) / 2);
    this.lastAdjustedAtTick = 0;
    this.adjustmentReason = 'reset';
  }
}

// ─── §18 TickTransactionReplayBuffer ──────────────────────────────────────────
export class TickTransactionReplayBuffer {
  private readonly capacity: number;
  private readonly buffer: Array<{
    tick: number;
    envelopes: ReadonlyArray<ChatInputEnvelope>;
    grade: TickTransactionHealthGrade;
  }> = [];

  public constructor(capacity = 20) { this.capacity = capacity; }

  public record(
    tick: number,
    envelopes: ReadonlyArray<ChatInputEnvelope>,
    grade: TickTransactionHealthGrade,
  ): void {
    if (this.buffer.length >= this.capacity) this.buffer.shift();
    this.buffer.push({ tick, envelopes: [...envelopes], grade });
  }

  public replay(fromTick: number): ReadonlyArray<ChatInputEnvelope> {
    return this.buffer.filter(r => r.tick >= fromTick).flatMap(r => r.envelopes);
  }

  public gradeHistory(): ReadonlyArray<TickTransactionHealthGrade> {
    return this.buffer.map(r => r.grade);
  }

  public latest(): { tick: number; envelopes: ReadonlyArray<ChatInputEnvelope>; grade: TickTransactionHealthGrade } | undefined {
    return this.buffer[this.buffer.length - 1];
  }

  public clear(): void { this.buffer.length = 0; }
  public size(): number { return this.buffer.length; }
}

// ─── §19 TickTransactionEnvelopeValidator ────────────────────────────────────
export class TickTransactionEnvelopeValidator {
  private validated = 0;
  private rejected = 0;

  public validate(envelope: ChatInputEnvelope): boolean {
    const ok = !!envelope.payload;
    if (ok) this.validated++; else this.rejected++;
    return ok;
  }

  public filterValid(envelopes: ReadonlyArray<ChatInputEnvelope>): ChatInputEnvelope[] {
    return envelopes.filter(e => this.validate(e));
  }

  public passRate(): Score01 {
    const total = this.validated + this.rejected;
    return clamp01(total > 0 ? this.validated / total : 1) as Score01;
  }

  public stats(): { validated: number; rejected: number; passRate: Score01 } {
    return { validated: this.validated, rejected: this.rejected, passRate: this.passRate() };
  }

  public reset(): void { this.validated = 0; this.rejected = 0; }
}

// ─── §20 TickTransactionSignalExtendedSuite ───────────────────────────────────
export class TickTransactionSignalExtendedSuite extends TickTransactionSignalAdapterSuite {
  public readonly diagnosticsService: TickTransactionDiagnosticsService;
  public readonly rateController: TickTransactionSignalRateController;
  public readonly validator: TickTransactionEnvelopeValidator;
  public readonly uxScorer: TickTransactionUXScorer;
  public readonly replayBuffer: TickTransactionReplayBuffer;

  public constructor(opts: TickTransactionSignalPipelineOptions) {
    super(opts);
    this.diagnosticsService = new TickTransactionDiagnosticsService(this.pipeline);
    this.rateController = new TickTransactionSignalRateController(1, 12, 6);
    this.validator = new TickTransactionEnvelopeValidator();
    this.uxScorer = new TickTransactionUXScorer(this.rollingWindow, this.analytics);
    this.replayBuffer = new TickTransactionReplayBuffer(20);
  }

  public processTickExtended(
    signals: ReadonlyArray<TickTransactionChatSignalCompat>,
    tick: number,
    uxReport?: TickTransactionUXReportCompat,
  ): TickTransactionSignalPipelineResult & {
    uxScore: TickTransactionUXScoreResult;
    diagnostics: Readonly<Record<string, JsonValue>>;
  } {
    const result = this.pipeline.processTick(signals, tick, uxReport);
    const healthReport = this.healthTracker.buildReport();
    this.rateController.adjust(healthReport, tick);
    const valid = this.validator.filterValid(result.envelopes as ChatInputEnvelope[]);
    const uxScore = this.uxScorer.score();
    this.replayBuffer.record(tick, valid, healthReport.grade);
    const diagnostics = this.diagnosticsService.toJsonValue();
    return Object.freeze({ ...result, uxScore, diagnostics });
  }

  public override reset(): void {
    super.reset();
    this.rateController.reset();
    this.validator.reset();
    this.replayBuffer.clear();
  }
}

export function createTickTransactionSignalExtendedSuite(
  opts: TickTransactionSignalPipelineOptions,
): TickTransactionSignalExtendedSuite {
  return new TickTransactionSignalExtendedSuite(opts);
}

// ─── §21 buildTickTransactionAdapterDiagnostics helper ───────────────────────
export function buildTickTransactionAdapterDiagnostics(
  adapter: TickTransactionSignalAdapter,
  analytics: TickTransactionSignalAnalytics,
  healthTracker: TickTransactionHealthTracker,
  patternDetector: TickTransactionPatternDetector,
): Readonly<Record<string, JsonValue>> {
  const state = adapter.getState();
  const health = healthTracker.buildReport();
  const patterns = patternDetector.recentPatterns(5);

  return Object.freeze({
    accepted: state.acceptedCount,
    deduped: state.dedupedCount,
    rejected: state.rejectedCount,
    rollbacks: state.rollbackCount,
    cinematic: state.cinematicCount,
    budgetViolations: state.budgetViolationCount,
    lastTick: state.lastTick,
    lastUXGrade: state.lastUXGrade,
    grade: health.grade,
    trend: health.trend,
    avgUXScore: parseFloat(health.avgUXScore.toFixed(4)),
    rollbackRate: parseFloat(health.rollbackRate.toFixed(4)),
    cinematicRate: parseFloat(health.cinematicRate.toFixed(4)),
    isCinematic: health.isCinematic,
    isCritical: health.isCritical,
    isHealthy: health.isHealthy,
    globalRollbackRate: parseFloat(analytics.globalRollbackRate().toFixed(4)),
    globalCinematicRate: parseFloat(analytics.globalCinematicRate().toFixed(4)),
    mostProblematicStep: analytics.mostProblematicStep() ?? null,
    recentPatterns: patterns.map(p => p.kind),
    activeStepCount: analytics.allStepStats().length,
  });
}

// ─── §22 TickTransactionEventCategoryCounter ──────────────────────────────────
export type TickTransactionEventCategory =
  | 'COMMIT'
  | 'ROLLBACK'
  | 'BUDGET'
  | 'UX_REPORTING'
  | 'CINEMATIC'
  | 'HEALTH'
  | 'ML_TELEMETRY';

export function classifyTickTransactionEvent(
  kind: TickTransactionSignalAdapterEventName,
): TickTransactionEventCategory {
  if (kind.includes('committed')) return 'COMMIT';
  if (kind.includes('rolled_back') || kind.includes('rollback')) return 'ROLLBACK';
  if (kind.includes('budget')) return 'BUDGET';
  if (kind.includes('cinematic')) return 'CINEMATIC';
  if (kind.includes('ux_report') || kind.includes('analytics')) return 'UX_REPORTING';
  if (kind.includes('health')) return 'HEALTH';
  if (kind.includes('ml')) return 'ML_TELEMETRY';
  return 'UX_REPORTING';
}

export class TickTransactionEventCategoryCounter {
  private readonly counts: Map<TickTransactionEventCategory, number> = new Map();

  public record(kind: TickTransactionSignalAdapterEventName): void {
    const cat = classifyTickTransactionEvent(kind);
    this.counts.set(cat, (this.counts.get(cat) ?? 0) + 1);
  }

  public countFor(cat: TickTransactionEventCategory): number {
    return this.counts.get(cat) ?? 0;
  }

  public dominantCategory(): TickTransactionEventCategory | undefined {
    let max = 0;
    let dominant: TickTransactionEventCategory | undefined;
    for (const [cat, count] of this.counts) {
      if (count > max) { max = count; dominant = cat; }
    }
    return dominant;
  }

  public toRecord(): Readonly<Record<string, number>> {
    return Object.freeze(Object.fromEntries(this.counts));
  }

  public reset(): void { this.counts.clear(); }
}

// ─── §23 TickTransactionTickSummaryBuilder ────────────────────────────────────
export interface TickTransactionTickSummary {
  readonly tick: number;
  readonly at: UnixMs;
  readonly accepted: number;
  readonly rejected: number;
  readonly deduped: number;
  readonly envelopesEmitted: number;
  readonly healthGrade: TickTransactionHealthGrade;
  readonly trend: TickTransactionWindowTrend;
  readonly avgUXScore: Score01;
  readonly rollbackRate: Score01;
  readonly cinematicRate: Score01;
  readonly isCinematic: boolean;
  readonly isCritical: boolean;
}

export class TickTransactionTickSummaryBuilder {
  private readonly summaries: TickTransactionTickSummary[] = [];
  private readonly maxSummaries = 100;
  private readonly clock: TickTransactionSignalAdapterClock;

  public constructor(clock?: TickTransactionSignalAdapterClock) {
    this.clock = clock ?? SYSTEM_CLOCK;
  }

  public build(
    result: TickTransactionSignalPipelineResult,
    health: TickTransactionHealthReport,
  ): TickTransactionTickSummary {
    const summary: TickTransactionTickSummary = Object.freeze({
      tick: result.tick,
      at: this.clock.now(),
      accepted: result.acceptedCount,
      rejected: result.rejectedCount,
      deduped: result.dedupedCount,
      envelopesEmitted: result.envelopes.length,
      healthGrade: health.grade,
      trend: health.trend,
      avgUXScore: health.avgUXScore,
      rollbackRate: health.rollbackRate,
      cinematicRate: health.cinematicRate,
      isCinematic: health.isCinematic,
      isCritical: health.isCritical,
    });

    if (this.summaries.length >= this.maxSummaries) this.summaries.shift();
    this.summaries.push(summary);
    return summary;
  }

  public recent(limit = 10): ReadonlyArray<TickTransactionTickSummary> {
    return Object.freeze(this.summaries.slice(-limit));
  }

  public clear(): void { this.summaries.length = 0; }
}

// ─── §24 TickTransactionChannelMapper ────────────────────────────────────────
export const TICK_TRANSACTION_EVENT_CHANNEL_MAP: Readonly<Record<string, ChatVisibleChannel>> = Object.freeze({
  'transaction.committed': 'GLOBAL' as ChatVisibleChannel,
  'transaction.rolled_back': 'GLOBAL' as ChatVisibleChannel,
  'transaction.budget_exceeded': 'GLOBAL' as ChatVisibleChannel,
  'transaction.ux_report': 'GLOBAL' as ChatVisibleChannel,
  'transaction.cinematic_tick': 'GLOBAL' as ChatVisibleChannel,
  'transaction.health_alert': 'GLOBAL' as ChatVisibleChannel,
  'transaction.analytics_summary': 'GLOBAL' as ChatVisibleChannel,
  'transaction.ml_vector': 'GLOBAL' as ChatVisibleChannel,
});

export function mapTickTransactionEventToChannel(
  eventName: TickTransactionSignalAdapterEventName,
): ChatVisibleChannel {
  return TICK_TRANSACTION_EVENT_CHANNEL_MAP[eventName] ?? ('GLOBAL' as ChatVisibleChannel);
}

// ─── §25 TickTransactionThrottleGate ─────────────────────────────────────────
/** Token-bucket throttle gate per transaction step. */
export class TickTransactionThrottleGate {
  private readonly tokens: Map<string, number> = new Map();
  private readonly bucketMax: number;
  private readonly refillRate: number;
  private lastRefill: UnixMs = 0 as UnixMs;

  public constructor(refillRate = 5, bucketMax = 20) {
    this.refillRate = refillRate;
    this.bucketMax = bucketMax;
  }

  public shouldAllow(step: string, nowMs: UnixMs): boolean {
    this.maybeRefill(nowMs);
    const current = this.tokens.get(step) ?? this.bucketMax;
    if (current <= 0) return false;
    this.tokens.set(step, current - 1);
    return true;
  }

  private maybeRefill(nowMs: UnixMs): void {
    const elapsed = nowMs - this.lastRefill;
    if (elapsed < 1000) return;
    const ticks = Math.floor(elapsed / 1000);
    for (const [k, v] of this.tokens) {
      this.tokens.set(k, Math.min(this.bucketMax, v + ticks * this.refillRate));
    }
    this.lastRefill = nowMs;
  }

  public reset(): void { this.tokens.clear(); this.lastRefill = 0 as UnixMs; }
}

// ─── §26 Final module flag ────────────────────────────────────────────────────
export const TICK_TRANSACTION_SIGNAL_ADAPTER_MODULE_READY = true;
export const TICK_TRANSACTION_MAX_REPLAY_CAPACITY = 20 as const;
export const TICK_TRANSACTION_THROTTLE_BUCKET_MAX = 20 as const;
export const TICK_TRANSACTION_HEALTH_GRADE_WEIGHTS = Object.freeze({
  avgUXScore: 0.6,
  rollbackRateInverse: 0.4,
} as const);
export const TICK_TRANSACTION_NARRATIVE_CHANNEL_PRIORITY = Object.freeze({
  BOSS_DIALOGUE: 100,
  HELPER_CALLOUT: 90,
  SYSTEM_ALERT: 80,
  HATER_TAUNT: 50,
  AMBIENT_COMMENT: 20,
  SILENT: 5,
} as const);
