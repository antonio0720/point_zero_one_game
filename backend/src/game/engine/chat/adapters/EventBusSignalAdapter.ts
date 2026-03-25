/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT EVENT BUS SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/EventBusSignalAdapter.ts
 * VERSION: 2026.03.24
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates EventBus engine truth — analytics
 * reports, health monitor alerts, overload warnings, ML vector emissions, and
 * subscriber activity signals — into authoritative backend-chat ingress envelopes.
 *
 * Backend-truth question
 * ----------------------
 *   "When the EventBus enters an overloaded state, a subscriber fires a
 *    critical pattern, or an ML vector is emitted for downstream DL, what
 *    exact chat-native signal should the authoritative backend chat engine
 *    ingest to preserve system truth fidelity?"
 *
 * Design laws
 * -----------
 * - No circular imports from core/. All core types are mirrored as structural
 *   compat interfaces below.
 * - OVERLOADED health state is always accepted — it represents real system
 *   pressure that chat NPC commentary may need to reflect.
 * - Routine IDLE / QUIET analytics are suppressed by default.
 * - Pattern match alerts (watcher) carry WARN severity minimum.
 * - ML vector signals are only accepted when emitMLVectors is enabled.
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
// Structural compat interfaces — mirrors EventBusChatSignal
// ─────────────────────────────────────────────────────────────────────────────

/** Structural mirror of EventBusChatSignal from core/EventBus.ts */
export interface EventBusChatSignalCompat {
  readonly surface: 'event_bus';
  readonly kind: string;
  readonly severity: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly healthStatus?: string | null;
  readonly isOverloaded?: boolean | null;
  readonly totalEventsEmitted?: number | null;
  readonly uniqueEventTypes?: number | null;
  readonly activeSubscriberCount?: number | null;
  readonly queueDepth?: number | null;
  readonly processingRateHz?: number | null;
  readonly dropRatio?: number | null;
  readonly uptimeRatio?: number | null;
  readonly mlBufferDepth?: number | null;
}

export interface EventBusAnalyticsReportCompat {
  readonly healthStatus: string;
  readonly totalEventsEmitted: number;
  readonly uniqueEventTypes: number;
  readonly activeSubscribers: number;
  readonly mostFrequentEvent?: string | null;
  readonly avgProcessingRateHz?: number | null;
  readonly isOverloaded: boolean;
  readonly dropRatio?: number | null;
}

export interface EventBusHealthReportCompat {
  readonly overallHealth: string;
  readonly isHealthy: boolean;
  readonly criticalAlerts: readonly string[];
  readonly subscriberCount: number;
  readonly queueDepth?: number | null;
  readonly uptimeRatio?: number | null;
}

export interface EventBusMLVectorCompat {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly generatedAtMs: number;
  readonly busId?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter types
// ─────────────────────────────────────────────────────────────────────────────

export interface EventBusSignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface EventBusSignalAdapterClock {
  now(): UnixMs;
}

export interface EventBusSignalAdapterOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly dedupeWindowMs?: number;
  readonly maxHistory?: number;
  readonly overloadDropRatioThreshold?: number;
  readonly suppressQuietAndIdle?: boolean;
  readonly emitMLVectors?: boolean;
  readonly logger?: EventBusSignalAdapterLogger;
  readonly clock?: EventBusSignalAdapterClock;
}

export interface EventBusSignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export type EventBusSignalAdapterEventName =
  | 'eventbus.health.overloaded'
  | 'eventbus.health.degraded'
  | 'eventbus.health.recovered'
  | 'eventbus.health.report'
  | 'eventbus.analytics.report'
  | 'eventbus.watcher.pattern_matched'
  | 'eventbus.ml.vector_emitted'
  | 'eventbus.subscriber.alert'
  | 'eventbus.queue.depth_warning'
  | string;

export type EventBusSignalAdapterNarrativeWeight =
  | 'AMBIENT'
  | 'OPERATIONAL'
  | 'CRITICAL'
  | 'SYSTEM_OVERLOAD';

export type EventBusSignalAdapterSeverity =
  | 'DEBUG'
  | 'INFO'
  | 'WARN'
  | 'CRITICAL';

export interface EventBusSignalAdapterArtifact {
  readonly envelope: ChatInputEnvelope;
  readonly dedupeKey: string;
  readonly routeChannel: ChatVisibleChannel;
  readonly narrativeWeight: EventBusSignalAdapterNarrativeWeight;
  readonly severity: EventBusSignalAdapterSeverity;
  readonly eventName: EventBusSignalAdapterEventName;
  readonly isOverloaded: boolean;
  readonly uptimeRatio: Score01;
  readonly loadPressure: Score100;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface EventBusSignalAdapterRejection {
  readonly eventName: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface EventBusSignalAdapterDeduped {
  readonly eventName: string;
  readonly dedupeKey: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface EventBusSignalAdapterHistoryEntry {
  readonly at: UnixMs;
  readonly eventName: string;
  readonly severity: EventBusSignalAdapterSeverity;
  readonly isOverloaded: boolean;
  readonly uptimeRatio: Score01;
  readonly dedupeKey: string;
}

export interface EventBusSignalAdapterReport {
  readonly accepted: readonly EventBusSignalAdapterArtifact[];
  readonly deduped: readonly EventBusSignalAdapterDeduped[];
  readonly rejected: readonly EventBusSignalAdapterRejection[];
}

export interface EventBusSignalAdapterState {
  readonly history: readonly EventBusSignalAdapterHistoryEntry[];
  readonly lastAcceptedAtByKey: Readonly<Record<string, UnixMs>>;
  readonly lastHealthStatus: string;
  readonly acceptedCount: number;
  readonly dedupedCount: number;
  readonly rejectedCount: number;
  readonly overloadAlertCount: number;
  readonly mlVectorCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_DEDUPE_WINDOW_MS = 4_000;
const DEFAULT_MAX_HISTORY = 200;
const DEFAULT_OVERLOAD_DROP_RATIO = 0.05;

const NULL_LOGGER: EventBusSignalAdapterLogger = Object.freeze({
  debug() {},
  warn() {},
  error() {},
});

const SYSTEM_CLOCK: EventBusSignalAdapterClock = Object.freeze({
  now(): UnixMs { return asUnixMs(Date.now()); },
});

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function healthStatusToUptimeRatio(status: string | null | undefined): number {
  switch (status) {
    case 'HEALTHY': return 1.0;
    case 'OVERLOADED': return 0.5;
    case 'QUIET': return 0.85;
    case 'IDLE': return 0.9;
    default: return 0.7;
  }
}

function computeLoadPressure(signal: EventBusChatSignalCompat): number {
  if (signal.isOverloaded) return 1.0;
  const dropRatio = signal.dropRatio ?? 0;
  const queuePressure = Math.min(1, (signal.queueDepth ?? 0) / 1000);
  return Math.min(1, dropRatio * 2 + queuePressure);
}

function buildEventBusSignalEnvelope(
  signal: EventBusChatSignalCompat,
  roomId: ChatRoomId | string | null,
  uptimeRatio: number,
  loadPressure: number,
  now: UnixMs,
): ChatSignalEnvelope {
  return Object.freeze({
    type: 'LIVEOPS',
    emittedAt: now,
    roomId: (roomId ?? null) as Nullable<ChatRoomId>,
    liveops: Object.freeze({
      worldEventName: signal.kind,
      heatMultiplier01: clamp01(loadPressure) as Score01,
      helperBlackout: signal.isOverloaded === true,
      haterRaidActive: false,
    }),
    metadata: Object.freeze({
      surface: signal.surface,
      kind: signal.kind,
      severity: signal.severity,
      message: signal.message,
      healthStatus: signal.healthStatus ?? null,
      isOverloaded: signal.isOverloaded ?? false,
      totalEventsEmitted: signal.totalEventsEmitted ?? null,
      uniqueEventTypes: signal.uniqueEventTypes ?? null,
      activeSubscriberCount: signal.activeSubscriberCount ?? null,
      queueDepth: signal.queueDepth ?? null,
      processingRateHz: signal.processingRateHz ?? null,
      dropRatio: signal.dropRatio ?? null,
      uptimeRatio: parseFloat(uptimeRatio.toFixed(4)),
      loadPressure: parseFloat(loadPressure.toFixed(4)),
      mlBufferDepth: signal.mlBufferDepth ?? null,
    } as Record<string, JsonValue>),
  });
}

function buildEventBusChatEnvelope(
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
// EventBusSignalAdapter
// ─────────────────────────────────────────────────────────────────────────────

export class EventBusSignalAdapter {
  private readonly options: Required<EventBusSignalAdapterOptions>;
  private readonly logger: EventBusSignalAdapterLogger;
  private readonly clock: EventBusSignalAdapterClock;

  private readonly history: EventBusSignalAdapterHistoryEntry[] = [];
  private readonly lastAcceptedAtByKey: Map<string, UnixMs> = new Map();

  private acceptedCount = 0;
  private dedupedCount = 0;
  private rejectedCount = 0;
  private overloadAlertCount = 0;
  private mlVectorCount = 0;
  private lastHealthStatus = 'HEALTHY';

  public constructor(options: EventBusSignalAdapterOptions) {
    this.logger = options.logger ?? NULL_LOGGER;
    this.clock = options.clock ?? SYSTEM_CLOCK;
    this.options = Object.freeze({
      defaultRoomId: options.defaultRoomId,
      defaultVisibleChannel: options.defaultVisibleChannel ?? 'GLOBAL',
      dedupeWindowMs: options.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS,
      maxHistory: options.maxHistory ?? DEFAULT_MAX_HISTORY,
      overloadDropRatioThreshold: options.overloadDropRatioThreshold ?? DEFAULT_OVERLOAD_DROP_RATIO,
      suppressQuietAndIdle: options.suppressQuietAndIdle ?? true,
      emitMLVectors: options.emitMLVectors ?? false,
      logger: this.logger,
      clock: this.clock,
    });
  }

  // ── Public ingestion surface ──────────────────────────────────────────────

  public ingestSignal(
    signal: EventBusChatSignalCompat,
    context?: EventBusSignalAdapterContext,
  ): EventBusSignalAdapterArtifact | EventBusSignalAdapterRejection | EventBusSignalAdapterDeduped {
    const now = this.clock.now();
    const roomId = context?.roomId ?? this.options.defaultRoomId;
    const routeChannel: ChatVisibleChannel = context?.routeChannel ?? this.options.defaultVisibleChannel;

    const isOverloaded = signal.isOverloaded === true;
    const uptimeRatio = healthStatusToUptimeRatio(signal.healthStatus);
    const loadPressure = computeLoadPressure(signal);

    if (!isOverloaded && !this.isSignalMeaningful(signal, loadPressure)) {
      const rejection: EventBusSignalAdapterRejection = Object.freeze({
        eventName: signal.kind,
        reason: 'SUPPRESSED_QUIET_OR_AMBIENT',
        details: { kind: signal.kind, healthStatus: signal.healthStatus ?? null, loadPressure },
      });
      this.rejectedCount++;
      return rejection;
    }

    const dedupeKey = `${signal.kind}:${signal.healthStatus ?? 'ok'}:${isOverloaded ? '1' : '0'}`;

    if (!isOverloaded && this.isDuplicate(dedupeKey, now)) {
      const deduped: EventBusSignalAdapterDeduped = Object.freeze({
        eventName: signal.kind,
        dedupeKey,
        reason: 'WITHIN_DEDUPE_WINDOW',
        details: { kind: signal.kind, dedupeWindowMs: this.options.dedupeWindowMs },
      });
      this.dedupedCount++;
      return deduped;
    }

    const severity = this.computeAdapterSeverity(signal, isOverloaded, loadPressure);
    const narrativeWeight = this.computeNarrativeWeight(signal, isOverloaded, loadPressure);
    const uptimeRatioClamped = clamp01(uptimeRatio) as Score01;
    const loadPressure100 = clamp100(Math.round(loadPressure * 100)) as Score100;

    const signalEnvelope = buildEventBusSignalEnvelope(signal, roomId as string, uptimeRatio, loadPressure, now);
    const envelope = buildEventBusChatEnvelope(signalEnvelope, now);

    const artifact: EventBusSignalAdapterArtifact = Object.freeze({
      envelope,
      dedupeKey,
      routeChannel,
      narrativeWeight,
      severity,
      eventName: signal.kind as EventBusSignalAdapterEventName,
      isOverloaded,
      uptimeRatio: uptimeRatioClamped,
      loadPressure: loadPressure100,
      details: Object.freeze({
        kind: signal.kind,
        message: signal.message,
        healthStatus: signal.healthStatus ?? null,
        isOverloaded,
        uptimeRatio: parseFloat(uptimeRatio.toFixed(4)),
        loadPressure: parseFloat(loadPressure.toFixed(4)),
        dropRatio: signal.dropRatio ?? null,
        queueDepth: signal.queueDepth ?? null,
        source: context?.source ?? 'event_bus',
      } as Record<string, JsonValue>),
    });

    this.acceptArtifact(artifact, dedupeKey, now, isOverloaded, uptimeRatioClamped);

    if (isOverloaded) {
      this.overloadAlertCount++;
      this.logger.warn('[EventBusSignalAdapter] bus overloaded', {
        dropRatio: signal.dropRatio ?? 0,
        queueDepth: signal.queueDepth ?? 0,
      });
    }

    this.lastHealthStatus = signal.healthStatus ?? this.lastHealthStatus;

    return artifact;
  }

  public ingestAnalyticsReport(
    report: EventBusAnalyticsReportCompat,
    context?: EventBusSignalAdapterContext,
  ): EventBusSignalAdapterArtifact | EventBusSignalAdapterRejection | EventBusSignalAdapterDeduped {
    const signal: EventBusChatSignalCompat = {
      surface: 'event_bus',
      kind: report.isOverloaded ? 'eventbus.health.overloaded' : 'eventbus.analytics.report',
      severity: report.isOverloaded ? 'error' :
                (report.dropRatio ?? 0) > this.options.overloadDropRatioThreshold ? 'warn' : 'info',
      message: `EventBus analytics: status=${report.healthStatus}, events=${report.totalEventsEmitted}, ` +
               `types=${report.uniqueEventTypes}, subscribers=${report.activeSubscribers}, ` +
               `drop=${((report.dropRatio ?? 0) * 100).toFixed(1)}%`,
      healthStatus: report.healthStatus,
      isOverloaded: report.isOverloaded,
      totalEventsEmitted: report.totalEventsEmitted,
      uniqueEventTypes: report.uniqueEventTypes,
      activeSubscriberCount: report.activeSubscribers,
      processingRateHz: report.avgProcessingRateHz ?? null,
      dropRatio: report.dropRatio ?? null,
    };

    return this.ingestSignal(signal, context);
  }

  public ingestHealthReport(
    report: EventBusHealthReportCompat,
    context?: EventBusSignalAdapterContext,
  ): EventBusSignalAdapterArtifact | EventBusSignalAdapterRejection | EventBusSignalAdapterDeduped {
    const isCritical = !report.isHealthy || report.criticalAlerts.length > 0;

    const signal: EventBusChatSignalCompat = {
      surface: 'event_bus',
      kind: isCritical ? 'eventbus.health.degraded' : 'eventbus.health.recovered',
      severity: isCritical ? (report.criticalAlerts.length > 1 ? 'error' : 'warn') : 'info',
      message: `EventBus health: ${report.overallHealth}, subscribers=${report.subscriberCount}, ` +
               `criticalAlerts=${report.criticalAlerts.length}, uptime=${(report.uptimeRatio ?? 1).toFixed(3)}`,
      healthStatus: report.overallHealth,
      isOverloaded: report.overallHealth === 'OVERLOADED',
      activeSubscriberCount: report.subscriberCount,
      queueDepth: report.queueDepth ?? null,
      uptimeRatio: report.uptimeRatio ?? null,
    };

    return this.ingestSignal(signal, context);
  }

  public ingestMLVector(
    vector: EventBusMLVectorCompat,
    context?: EventBusSignalAdapterContext,
  ): EventBusSignalAdapterArtifact | EventBusSignalAdapterRejection | EventBusSignalAdapterDeduped {
    if (!this.options.emitMLVectors) {
      const rejection: EventBusSignalAdapterRejection = Object.freeze({
        eventName: 'eventbus.ml.vector_emitted',
        reason: 'ML_VECTORS_DISABLED',
        details: { busId: vector.busId ?? null },
      });
      this.rejectedCount++;
      return rejection;
    }

    this.mlVectorCount++;

    const signal: EventBusChatSignalCompat = {
      surface: 'event_bus',
      kind: 'eventbus.ml.vector_emitted',
      severity: 'info',
      message: `EventBus ML vector: features[0..3]=[${vector.features.slice(0, 4).map((f) => f.toFixed(3)).join(',')}]`,
      mlBufferDepth: null,
    };

    return this.ingestSignal(signal, context);
  }

  public ingestBatch(
    signals: readonly EventBusChatSignalCompat[],
    context?: EventBusSignalAdapterContext,
  ): EventBusSignalAdapterReport {
    const accepted: EventBusSignalAdapterArtifact[] = [];
    const deduped: EventBusSignalAdapterDeduped[] = [];
    const rejected: EventBusSignalAdapterRejection[] = [];

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

  public getState(): EventBusSignalAdapterState {
    return Object.freeze({
      history: Object.freeze([...this.history]),
      lastAcceptedAtByKey: Object.freeze(Object.fromEntries(this.lastAcceptedAtByKey)),
      lastHealthStatus: this.lastHealthStatus,
      acceptedCount: this.acceptedCount,
      dedupedCount: this.dedupedCount,
      rejectedCount: this.rejectedCount,
      overloadAlertCount: this.overloadAlertCount,
      mlVectorCount: this.mlVectorCount,
    });
  }

  public buildReport(): EventBusSignalAdapterReport {
    return Object.freeze({ accepted: [], deduped: [], rejected: [] });
  }

  public buildHealthDiagnostics(): Readonly<Record<string, JsonValue>> {
    return Object.freeze({
      acceptedCount: this.acceptedCount,
      dedupedCount: this.dedupedCount,
      rejectedCount: this.rejectedCount,
      overloadAlertCount: this.overloadAlertCount,
      mlVectorCount: this.mlVectorCount,
      lastHealthStatus: this.lastHealthStatus,
      historySize: this.history.length,
    });
  }

  public reset(): void {
    this.history.length = 0;
    this.lastAcceptedAtByKey.clear();
    this.acceptedCount = 0;
    this.dedupedCount = 0;
    this.rejectedCount = 0;
    this.overloadAlertCount = 0;
    this.mlVectorCount = 0;
    this.lastHealthStatus = 'HEALTHY';
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private isSignalMeaningful(signal: EventBusChatSignalCompat, loadPressure: number): boolean {
    if (signal.severity !== 'info') return true;
    if (loadPressure > 0.3) return true;
    if (this.options.suppressQuietAndIdle &&
        (signal.healthStatus === 'IDLE' || signal.healthStatus === 'QUIET')) {
      return false;
    }
    return loadPressure > 0.1;
  }

  private isDuplicate(dedupeKey: string, now: UnixMs): boolean {
    const lastAt = this.lastAcceptedAtByKey.get(dedupeKey);
    if (lastAt === undefined) return false;
    return now - lastAt < this.options.dedupeWindowMs;
  }

  private computeAdapterSeverity(
    signal: EventBusChatSignalCompat,
    isOverloaded: boolean,
    loadPressure: number,
  ): EventBusSignalAdapterSeverity {
    if (isOverloaded || signal.severity === 'error') return 'CRITICAL';
    if (signal.severity === 'warn' || loadPressure > 0.5) return 'WARN';
    return 'INFO';
  }

  private computeNarrativeWeight(
    signal: EventBusChatSignalCompat,
    isOverloaded: boolean,
    loadPressure: number,
  ): EventBusSignalAdapterNarrativeWeight {
    if (isOverloaded) return 'SYSTEM_OVERLOAD';
    if (signal.severity === 'error') return 'CRITICAL';
    if (loadPressure > 0.4 || signal.severity === 'warn') return 'OPERATIONAL';
    return 'AMBIENT';
  }

  private acceptArtifact(
    artifact: EventBusSignalAdapterArtifact,
    dedupeKey: string,
    now: UnixMs,
    isOverloaded: boolean,
    uptimeRatio: Score01,
  ): void {
    this.acceptedCount++;
    this.lastAcceptedAtByKey.set(dedupeKey, now);

    const entry: EventBusSignalAdapterHistoryEntry = Object.freeze({
      at: now,
      eventName: artifact.eventName,
      severity: artifact.severity,
      isOverloaded,
      uptimeRatio,
      dedupeKey,
    });

    this.history.push(entry);
    if (this.history.length > this.options.maxHistory) {
      this.history.shift();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

export function createEventBusSignalAdapter(
  options: EventBusSignalAdapterOptions,
): EventBusSignalAdapter {
  return new EventBusSignalAdapter(options);
}

// =============================================================================
// § 2 — EventBusPatternDetector — detect signal patterns across ingestion history
// =============================================================================

export type EventBusPatternKind =
  | 'OVERLOAD_SPIKE'
  | 'DROP_RATIO_ESCALATION'
  | 'SUBSCRIBER_CHURN'
  | 'PROCESSING_SLOWDOWN'
  | 'QUEUE_BUILDUP'
  | 'ML_VECTOR_BURST'
  | 'HEALTH_DEGRADATION';

export interface EventBusPatternMatch {
  readonly kind: EventBusPatternKind;
  readonly detectedAtMs: UnixMs;
  readonly severity: EventBusSignalAdapterSeverity;
  readonly message: string;
  readonly signals: readonly string[];
  readonly confidenceScore: number;
}

export interface EventBusPatternDetectorOptions {
  readonly overloadSpikeThreshold?: number;
  readonly dropRatioEscalationRate?: number;
  readonly processingSlowdownHz?: number;
  readonly queueBuildup?: number;
  readonly windowMs?: number;
}

export class EventBusPatternDetector {
  private readonly windowMs: number;
  private readonly overloadSpikeThreshold: number;
  private readonly dropRatioEscalationRate: number;
  private readonly processingSlowdownHz: number;
  private readonly queueBuildup: number;

  private readonly matches: EventBusPatternMatch[] = [];
  private readonly maxMatches = 100;

  public constructor(opts: EventBusPatternDetectorOptions = {}) {
    this.windowMs = opts.windowMs ?? 30_000;
    this.overloadSpikeThreshold = opts.overloadSpikeThreshold ?? 3;
    this.dropRatioEscalationRate = opts.dropRatioEscalationRate ?? 0.05;
    this.processingSlowdownHz = opts.processingSlowdownHz ?? 5;
    this.queueBuildup = opts.queueBuildup ?? 500;
  }

  public analyze(history: readonly EventBusSignalAdapterHistoryEntry[], nowMs: UnixMs): void {
    const window = history.filter((e) => nowMs - e.at <= this.windowMs);
    if (window.length < 2) return;

    // Pattern: overload spike
    const overloads = window.filter((e) => e.isOverloaded);
    if (overloads.length >= this.overloadSpikeThreshold) {
      this.recordMatch({
        kind: 'OVERLOAD_SPIKE',
        detectedAtMs: nowMs,
        severity: 'CRITICAL',
        message: `EventBus overloaded ${overloads.length}x in the last ${this.windowMs}ms`,
        signals: overloads.map((e) => e.eventName),
        confidenceScore: Math.min(1, overloads.length / this.overloadSpikeThreshold),
      });
    }

    // Pattern: health degradation
    const degraded = window.filter((e) => e.uptimeRatio < 0.7);
    if (degraded.length >= 2) {
      this.recordMatch({
        kind: 'HEALTH_DEGRADATION',
        detectedAtMs: nowMs,
        severity: 'WARN',
        message: `EventBus uptime ratio below 70% for ${degraded.length} signals`,
        signals: degraded.map((e) => e.eventName),
        confidenceScore: Math.min(1, degraded.length / window.length),
      });
    }
  }

  private recordMatch(match: EventBusPatternMatch): void {
    this.matches.push(Object.freeze(match));
    if (this.matches.length > this.maxMatches) this.matches.shift();
  }

  public getMatches(): readonly EventBusPatternMatch[] {
    return Object.freeze([...this.matches]);
  }

  public getRecentMatches(windowMs: number, nowMs: UnixMs): readonly EventBusPatternMatch[] {
    return Object.freeze(this.matches.filter((m) => nowMs - m.detectedAtMs <= windowMs));
  }

  public getCriticalMatches(): readonly EventBusPatternMatch[] {
    return Object.freeze(this.matches.filter((m) => m.severity === 'CRITICAL'));
  }

  public reset(): void { this.matches.length = 0; }
}

// =============================================================================
// § 3 — EventBusSignalAnalytics — rolling analytics over ingestion history
// =============================================================================

export interface EventBusSignalAnalyticsReport {
  readonly totalAccepted: number;
  readonly totalDeduped: number;
  readonly totalRejected: number;
  readonly overloadAlertCount: number;
  readonly mlVectorCount: number;
  readonly avgUptimeRatio: number;
  readonly minUptimeRatio: Score01;
  readonly peakLoadPressure: Score100;
  readonly criticalCount: number;
  readonly warnCount: number;
  readonly infoCount: number;
  readonly debugCount: number;
  readonly healthStatusDistribution: Readonly<Record<string, number>>;
  readonly eventNameDistribution: Readonly<Record<string, number>>;
  readonly overloadRatio: number;
  readonly historyDepth: number;
}

export class EventBusSignalAnalytics {
  private readonly history: EventBusSignalAdapterHistoryEntry[] = [];
  private readonly maxHistory: number;
  private totalAccepted = 0;
  private totalDeduped = 0;
  private totalRejected = 0;
  private overloadAlertCount = 0;
  private mlVectorCount = 0;
  private peakLoad: Score100 = 0 as Score100;

  public constructor(maxHistory = 400) {
    this.maxHistory = maxHistory;
  }

  public recordAccepted(artifact: EventBusSignalAdapterArtifact, now: UnixMs): void {
    this.totalAccepted++;
    if (artifact.isOverloaded) this.overloadAlertCount++;
    if ((artifact.loadPressure as number) > (this.peakLoad as number)) {
      this.peakLoad = artifact.loadPressure;
    }
    this.history.push(Object.freeze({
      at: now,
      eventName: artifact.eventName,
      severity: artifact.severity,
      isOverloaded: artifact.isOverloaded,
      uptimeRatio: artifact.uptimeRatio,
      dedupeKey: artifact.dedupeKey,
    }));
    if (this.history.length > this.maxHistory) this.history.shift();
  }

  public recordDeduped(): void { this.totalDeduped++; }
  public recordRejected(): void { this.totalRejected++; }
  public recordMLVector(): void { this.mlVectorCount++; }

  public buildReport(): EventBusSignalAnalyticsReport {
    if (this.history.length === 0) {
      return Object.freeze({
        totalAccepted: this.totalAccepted, totalDeduped: this.totalDeduped,
        totalRejected: this.totalRejected, overloadAlertCount: this.overloadAlertCount,
        mlVectorCount: this.mlVectorCount, avgUptimeRatio: 1, minUptimeRatio: 1 as Score01,
        peakLoadPressure: 0 as Score100, criticalCount: 0, warnCount: 0,
        infoCount: 0, debugCount: 0, healthStatusDistribution: {},
        eventNameDistribution: {}, overloadRatio: 0, historyDepth: 0,
      });
    }

    let sumUptime = 0, minUptime = 1, critCount = 0, warnCount = 0, infoCount = 0, debugCount = 0;
    const healthDist: Record<string, number> = {};
    const eventDist: Record<string, number> = {};

    for (const e of this.history) {
      sumUptime += e.uptimeRatio;
      if ((e.uptimeRatio as number) < minUptime) minUptime = e.uptimeRatio as number;
      if (e.isOverloaded) critCount++;
      else if (e.severity === 'CRITICAL') critCount++;
      else if (e.severity === 'WARN') warnCount++;
      else if (e.severity === 'INFO') infoCount++;
      else debugCount++;
      eventDist[e.eventName] = (eventDist[e.eventName] ?? 0) + 1;
    }

    const overloadCount = this.history.filter((e) => e.isOverloaded).length;

    return Object.freeze({
      totalAccepted: this.totalAccepted,
      totalDeduped: this.totalDeduped,
      totalRejected: this.totalRejected,
      overloadAlertCount: this.overloadAlertCount,
      mlVectorCount: this.mlVectorCount,
      avgUptimeRatio: sumUptime / this.history.length,
      minUptimeRatio: clamp01(minUptime) as Score01,
      peakLoadPressure: this.peakLoad,
      criticalCount: critCount,
      warnCount,
      infoCount,
      debugCount,
      healthStatusDistribution: Object.freeze(healthDist),
      eventNameDistribution: Object.freeze(eventDist),
      overloadRatio: overloadCount / this.history.length,
      historyDepth: this.history.length,
    });
  }

  public getHistory(): readonly EventBusSignalAdapterHistoryEntry[] {
    return Object.freeze([...this.history]);
  }

  public reset(): void {
    this.history.length = 0;
    this.totalAccepted = 0;
    this.totalDeduped = 0;
    this.totalRejected = 0;
    this.overloadAlertCount = 0;
    this.mlVectorCount = 0;
    this.peakLoad = 0 as Score100;
  }
}

// =============================================================================
// § 4 — EventBusMLExtractor — DL feature vector from EventBus analytics
// =============================================================================

export const EVENT_BUS_DL_FEATURE_LABELS = [
  'overload_ratio',
  'avg_uptime_ratio',
  'min_uptime_ratio',
  'drop_ratio_normalized',
  'queue_depth_normalized',
  'ml_vector_ratio',
  'critical_ratio',
  'warn_ratio',
  'event_type_diversity',
  'processing_rate_normalized',
] as const;

export type EventBusDLFeatureLabel = typeof EVENT_BUS_DL_FEATURE_LABELS[number];

export interface EventBusDLVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly generatedAtMs: UnixMs;
  readonly tensorShape: readonly [number, number];
}

export class EventBusMLExtractor {
  public extract(
    report: EventBusSignalAnalyticsReport,
    currentSignal?: EventBusChatSignalCompat,
  ): EventBusDLVector {
    const n = report.historyDepth;
    const totalSignals = report.totalAccepted + report.totalRejected;

    const dropRatioNorm = clamp01(currentSignal?.dropRatio ?? 0);
    const queueDepthNorm = clamp01((currentSignal?.queueDepth ?? 0) / 2000);
    const mlVectorRatio = totalSignals > 0 ? clamp01(report.mlVectorCount / totalSignals) : 0;
    const criticalRatio = n > 0 ? clamp01(report.criticalCount / n) : 0;
    const warnRatio = n > 0 ? clamp01(report.warnCount / n) : 0;
    const eventTypeDiversity = clamp01(
      Object.keys(report.eventNameDistribution).length / 10,
    );
    const processingRateNorm = clamp01(
      (currentSignal?.processingRateHz ?? 0) / 1000,
    );

    const features: readonly number[] = Object.freeze([
      clamp01(report.overloadRatio),
      clamp01(report.avgUptimeRatio),
      clamp01(report.minUptimeRatio as number),
      dropRatioNorm,
      queueDepthNorm,
      mlVectorRatio,
      criticalRatio,
      warnRatio,
      eventTypeDiversity,
      processingRateNorm,
    ]);

    return Object.freeze({
      features,
      labels: Object.freeze([...EVENT_BUS_DL_FEATURE_LABELS]),
      generatedAtMs: asUnixMs(Date.now()),
      tensorShape: Object.freeze([1, features.length]) as readonly [number, number],
    });
  }

  public static featureCount(): number {
    return EVENT_BUS_DL_FEATURE_LABELS.length;
  }
}

// =============================================================================
// § 5 — EventBusSignalPipeline — wired production pipeline
// =============================================================================

export interface EventBusSignalPipelineOptions {
  readonly roomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly dedupeWindowMs?: number;
  readonly maxHistory?: number;
  readonly overloadDropRatioThreshold?: number;
  readonly suppressQuietAndIdle?: boolean;
  readonly emitMLVectors?: boolean;
  readonly analyticsHistorySize?: number;
  readonly patternWindowMs?: number;
  readonly logger?: EventBusSignalAdapterLogger;
  readonly clock?: EventBusSignalAdapterClock;
}

export interface EventBusSignalPipelineTickResult {
  readonly envelopes: readonly ChatInputEnvelope[];
  readonly analyticsReport: EventBusSignalAnalyticsReport;
  readonly dlVector: EventBusDLVector;
  readonly patternMatches: readonly EventBusPatternMatch[];
  readonly hasOverloadSignal: boolean;
  readonly hasPatternAlert: boolean;
}

export class EventBusSignalPipeline {
  private readonly adapter: EventBusSignalAdapter;
  private readonly analytics: EventBusSignalAnalytics;
  private readonly patternDetector: EventBusPatternDetector;
  private readonly mlExtractor: EventBusMLExtractor;

  private _tickCount = 0;
  private _isReady = false;

  public constructor(opts: EventBusSignalPipelineOptions) {
    this.adapter = new EventBusSignalAdapter({
      defaultRoomId: opts.roomId,
      defaultVisibleChannel: opts.defaultVisibleChannel ?? 'GLOBAL',
      dedupeWindowMs: opts.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS,
      maxHistory: opts.maxHistory ?? DEFAULT_MAX_HISTORY,
      overloadDropRatioThreshold: opts.overloadDropRatioThreshold ?? DEFAULT_OVERLOAD_DROP_RATIO,
      suppressQuietAndIdle: opts.suppressQuietAndIdle ?? true,
      emitMLVectors: opts.emitMLVectors ?? false,
      logger: opts.logger,
      clock: opts.clock,
    });
    this.analytics = new EventBusSignalAnalytics(opts.analyticsHistorySize ?? 400);
    this.patternDetector = new EventBusPatternDetector({
      windowMs: opts.patternWindowMs ?? 30_000,
    });
    this.mlExtractor = new EventBusMLExtractor();
  }

  public ingestSignal(
    signal: EventBusChatSignalCompat,
    context?: EventBusSignalAdapterContext,
  ): EventBusSignalPipelineTickResult {
    this._tickCount++;
    this._isReady = true;
    const now = asUnixMs(Date.now());

    const result = this.adapter.ingestSignal(signal, context);
    const envelopes: ChatInputEnvelope[] = [];

    if ('envelope' in result) {
      envelopes.push(result.envelope);
      this.analytics.recordAccepted(result, now);
    } else if ('dedupeKey' in result) {
      this.analytics.recordDeduped();
    } else {
      this.analytics.recordRejected();
    }

    const analyticsReport = this.analytics.buildReport();
    this.patternDetector.analyze(this.analytics.getHistory(), now);
    const dlVector = this.mlExtractor.extract(analyticsReport, signal);
    const patternMatches = this.patternDetector.getRecentMatches(60_000, now);

    return Object.freeze({
      envelopes: Object.freeze(envelopes),
      analyticsReport,
      dlVector,
      patternMatches,
      hasOverloadSignal: signal.isOverloaded === true,
      hasPatternAlert: patternMatches.some((p) => p.severity === 'CRITICAL'),
    });
  }

  public ingestBatch(
    signals: readonly EventBusChatSignalCompat[],
    context?: EventBusSignalAdapterContext,
  ): EventBusSignalPipelineTickResult {
    let hasOverload = false;
    const allEnvelopes: ChatInputEnvelope[] = [];
    const now = asUnixMs(Date.now());

    for (const signal of signals) {
      const result = this.adapter.ingestSignal(signal, context);
      if ('envelope' in result) {
        allEnvelopes.push(result.envelope);
        this.analytics.recordAccepted(result, now);
      } else if ('dedupeKey' in result) {
        this.analytics.recordDeduped();
      } else {
        this.analytics.recordRejected();
      }
      if (signal.isOverloaded) hasOverload = true;
    }

    const analyticsReport = this.analytics.buildReport();
    this.patternDetector.analyze(this.analytics.getHistory(), now);
    const dlVector = this.mlExtractor.extract(analyticsReport);
    const patternMatches = this.patternDetector.getRecentMatches(60_000, now);

    this._tickCount++;
    return Object.freeze({
      envelopes: Object.freeze(allEnvelopes),
      analyticsReport,
      dlVector,
      patternMatches,
      hasOverloadSignal: hasOverload,
      hasPatternAlert: patternMatches.some((p) => p.severity === 'CRITICAL'),
    });
  }

  public ingestMLVector(
    vector: EventBusMLVectorCompat,
    context?: EventBusSignalAdapterContext,
  ): readonly ChatInputEnvelope[] {
    const result = this.adapter.ingestMLVector(vector, context);
    this.analytics.recordMLVector();
    if ('envelope' in result) return Object.freeze([result.envelope]);
    return Object.freeze([]);
  }

  public ingestAnalyticsReport(
    report: EventBusAnalyticsReportCompat,
    context?: EventBusSignalAdapterContext,
  ): readonly ChatInputEnvelope[] {
    const result = this.adapter.ingestAnalyticsReport(report, context);
    if ('envelope' in result) {
      this.analytics.recordAccepted(result, asUnixMs(Date.now()));
      return Object.freeze([result.envelope]);
    }
    return Object.freeze([]);
  }

  public ingestHealthReport(
    report: EventBusHealthReportCompat,
    context?: EventBusSignalAdapterContext,
  ): readonly ChatInputEnvelope[] {
    const result = this.adapter.ingestHealthReport(report, context);
    if ('envelope' in result) {
      this.analytics.recordAccepted(result, asUnixMs(Date.now()));
      return Object.freeze([result.envelope]);
    }
    return Object.freeze([]);
  }

  public getAdapter(): EventBusSignalAdapter { return this.adapter; }
  public getAnalytics(): EventBusSignalAnalytics { return this.analytics; }
  public getPatternDetector(): EventBusPatternDetector { return this.patternDetector; }

  public get tickCount(): number { return this._tickCount; }
  public get isReady(): boolean { return this._isReady; }

  public buildDiagnostics(): Readonly<Record<string, JsonValue>> {
    const adapterState = this.adapter.getState();
    const report = this.analytics.buildReport();
    return Object.freeze({
      tickCount: this._tickCount,
      adapterAccepted: adapterState.acceptedCount,
      adapterDeduped: adapterState.dedupedCount,
      adapterRejected: adapterState.rejectedCount,
      overloadAlertCount: adapterState.overloadAlertCount,
      mlVectorCount: adapterState.mlVectorCount,
      analyticsHistoryDepth: report.historyDepth,
      avgUptimeRatio: report.avgUptimeRatio,
      overloadRatio: report.overloadRatio,
      criticalPatterns: this.patternDetector.getCriticalMatches().length,
    });
  }

  public reset(): void {
    this._tickCount = 0;
    this._isReady = false;
    this.adapter.reset();
    this.analytics.reset();
    this.patternDetector.reset();
  }
}

// =============================================================================
// § 6 — EventBusWatcherSignalAdapter — ingest watcher/subscriber pattern alerts
// =============================================================================

export interface EventBusWatcherAlertCompat {
  readonly watcherId: string;
  readonly patternName: string;
  readonly matchCount: number;
  readonly severity: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly payload?: Record<string, JsonValue>;
}

export class EventBusWatcherSignalAdapter {
  private readonly defaultRoomId: ChatRoomId | string;
  private readonly defaultChannel: ChatVisibleChannel;
  private readonly alertHistory: Array<{
    watcherId: string; patternName: string; severity: string; capturedAtMs: UnixMs;
  }> = [];
  private readonly maxHistory: number;

  public constructor(
    defaultRoomId: ChatRoomId | string,
    defaultChannel: ChatVisibleChannel = 'GLOBAL',
    maxHistory = 100,
  ) {
    this.defaultRoomId = defaultRoomId;
    this.defaultChannel = defaultChannel;
    this.maxHistory = maxHistory;
  }

  public adaptWatcherAlert(
    alert: EventBusWatcherAlertCompat,
    context?: EventBusSignalAdapterContext,
  ): ChatInputEnvelope {
    const nowMs = asUnixMs(context?.emittedAt ?? Date.now());
    const roomId = context?.roomId ?? this.defaultRoomId;
    const channel = context?.routeChannel ?? this.defaultChannel;
    const severity = alert.severity === 'error' ? 'CRITICAL' :
                     alert.severity === 'warn'  ? 'WARN' : 'INFO';

    const signalEnvelope: ChatSignalEnvelope = Object.freeze({
      type: 'LIVEOPS',
      emittedAt: nowMs,
      roomId: (roomId ?? null) as Nullable<ChatRoomId>,
      liveops: Object.freeze({
        worldEventName: `eventbus.watcher.${alert.patternName}`,
        heatMultiplier01: clamp01(alert.matchCount / 10) as Score01,
        helperBlackout: false,
        haterRaidActive: alert.severity === 'error',
      }),
      metadata: Object.freeze({
        watcherId: alert.watcherId,
        patternName: alert.patternName,
        matchCount: alert.matchCount,
        severity,
        message: alert.message,
        ...(alert.payload ?? {}),
      } as Record<string, JsonValue>),
    });

    const envelope = Object.freeze({
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: nowMs,
      roomId,
      routeChannel: channel,
      payload: signalEnvelope,
    }) as unknown as ChatInputEnvelope;

    this.alertHistory.push({
      watcherId: alert.watcherId,
      patternName: alert.patternName,
      severity,
      capturedAtMs: nowMs,
    });
    if (this.alertHistory.length > this.maxHistory) this.alertHistory.shift();

    return envelope;
  }

  public getAlertHistory() { return Object.freeze([...this.alertHistory]); }
  public reset(): void { this.alertHistory.length = 0; }
}

// =============================================================================
// § 7 — Module constants and exports
// =============================================================================

export const EVENT_BUS_ADAPTER_VERSION = '2026.03.24';
export const EVENT_BUS_DL_VECTOR_LENGTH = EventBusMLExtractor.featureCount();

export const EVENT_BUS_ADAPTER_MANIFEST = Object.freeze({
  adapterName: 'EventBusSignalAdapter',
  version: EVENT_BUS_ADAPTER_VERSION,
  dlFeatureCount: EVENT_BUS_DL_VECTOR_LENGTH,
  dlFeatureLabels: Object.freeze([...EVENT_BUS_DL_FEATURE_LABELS]),
  supportedPatternKinds: Object.freeze([
    'OVERLOAD_SPIKE', 'DROP_RATIO_ESCALATION', 'SUBSCRIBER_CHURN',
    'PROCESSING_SLOWDOWN', 'QUEUE_BUILDUP', 'ML_VECTOR_BURST', 'HEALTH_DEGRADATION',
  ]),
  supportedSeverities: Object.freeze(['DEBUG', 'INFO', 'WARN', 'CRITICAL']),
  supportedNarrativeWeights: Object.freeze([
    'AMBIENT', 'OPERATIONAL', 'CRITICAL', 'SYSTEM_OVERLOAD',
  ]),
});

export function createEventBusSignalPipeline(
  roomId: ChatRoomId | string,
  opts?: Partial<Omit<EventBusSignalPipelineOptions, 'roomId'>>,
): EventBusSignalPipeline {
  return new EventBusSignalPipeline({ roomId, ...opts });
}

export function createEventBusWatcherSignalAdapter(
  defaultRoomId: ChatRoomId | string,
  defaultChannel?: ChatVisibleChannel,
): EventBusWatcherSignalAdapter {
  return new EventBusWatcherSignalAdapter(defaultRoomId, defaultChannel);
}

/** Validate an EventBusChatSignalCompat satisfies the structural contract. */
export function validateEventBusChatSignalCompat(
  input: unknown,
): input is EventBusChatSignalCompat {
  if (!input || typeof input !== 'object') return false;
  const i = input as Record<string, unknown>;
  return (
    i.surface === 'event_bus' &&
    typeof i.kind === 'string' &&
    typeof i.severity === 'string' &&
    typeof i.message === 'string'
  );
}

// =============================================================================
// § 8 — EventBusSignalFacade — high-level facade for the chat bridge lane
// =============================================================================

export interface EventBusSignalFacadeOptions {
  readonly roomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly dedupeWindowMs?: number;
  readonly maxHistory?: number;
  readonly suppressQuietAndIdle?: boolean;
  readonly emitMLVectors?: boolean;
  readonly logger?: EventBusSignalAdapterLogger;
  readonly clock?: EventBusSignalAdapterClock;
}

/**
 * EventBusSignalFacade — single stable API for the EventBus → chat adapter lane.
 * Used by ChatEventBridge to ingest EventBus signals without knowing internals.
 *
 * Integration:
 *   const facade = new EventBusSignalFacade({ roomId: runId });
 *   // On EventBus health report:
 *   const envelopes = facade.ingestHealth(healthReport);
 *   // On analytics flush:
 *   const { envelopes, dlVector } = facade.ingestAnalytics(analyticsReport);
 */
export class EventBusSignalFacade {
  private readonly pipeline: EventBusSignalPipeline;
  private readonly watcherAdapter: EventBusWatcherSignalAdapter;
  private _startedAtMs: UnixMs | null = null;

  public constructor(opts: EventBusSignalFacadeOptions) {
    this.pipeline = new EventBusSignalPipeline({
      roomId: opts.roomId,
      defaultVisibleChannel: opts.defaultVisibleChannel,
      dedupeWindowMs: opts.dedupeWindowMs,
      maxHistory: opts.maxHistory,
      suppressQuietAndIdle: opts.suppressQuietAndIdle,
      emitMLVectors: opts.emitMLVectors,
      logger: opts.logger,
      clock: opts.clock,
    });
    this.watcherAdapter = new EventBusWatcherSignalAdapter(
      opts.roomId,
      opts.defaultVisibleChannel ?? 'GLOBAL',
    );
    this._startedAtMs = asUnixMs(Date.now());
  }

  public ingestSignal(
    signal: EventBusChatSignalCompat,
    context?: EventBusSignalAdapterContext,
  ): EventBusSignalPipelineTickResult {
    return this.pipeline.ingestSignal(signal, context);
  }

  public ingestBatch(
    signals: readonly EventBusChatSignalCompat[],
    context?: EventBusSignalAdapterContext,
  ): EventBusSignalPipelineTickResult {
    return this.pipeline.ingestBatch(signals, context);
  }

  public ingestHealth(
    report: EventBusHealthReportCompat,
    context?: EventBusSignalAdapterContext,
  ): readonly ChatInputEnvelope[] {
    return this.pipeline.ingestHealthReport(report, context);
  }

  public ingestAnalytics(
    report: EventBusAnalyticsReportCompat,
    context?: EventBusSignalAdapterContext,
  ): {
    envelopes: readonly ChatInputEnvelope[];
    dlVector: EventBusDLVector;
    analyticsReport: EventBusSignalAnalyticsReport;
  } {
    const envelopes = this.pipeline.ingestAnalyticsReport(report, context);
    const analyticsReport = this.pipeline.getAnalytics().buildReport();
    const dlVector = new EventBusMLExtractor().extract(analyticsReport);
    return { envelopes, dlVector, analyticsReport };
  }

  public ingestMLVector(
    vector: EventBusMLVectorCompat,
    context?: EventBusSignalAdapterContext,
  ): readonly ChatInputEnvelope[] {
    return this.pipeline.ingestMLVector(vector, context);
  }

  public ingestWatcherAlert(
    alert: EventBusWatcherAlertCompat,
    context?: EventBusSignalAdapterContext,
  ): ChatInputEnvelope {
    return this.watcherAdapter.adaptWatcherAlert(alert, context);
  }

  public getState(): EventBusSignalAdapterState {
    return this.pipeline.getAdapter().getState();
  }

  public buildDiagnostics(): Readonly<Record<string, JsonValue>> {
    return Object.freeze({
      ...this.pipeline.buildDiagnostics(),
      startedAtMs: this._startedAtMs,
      watcherAlertCount: this.watcherAdapter.getAlertHistory().length,
    });
  }

  public reset(): void {
    this.pipeline.reset();
    this.watcherAdapter.reset();
  }
}

// =============================================================================
// § 9 — EventBusSignalRollingWindow — time-windowed overload detection
// =============================================================================

export interface EventBusRollingWindowEntry {
  readonly kind: string;
  readonly isOverloaded: boolean;
  readonly uptimeRatio: number;
  readonly loadPressure: number;
  readonly capturedAtMs: UnixMs;
}

export interface EventBusRollingWindowStats {
  readonly windowSizeMs: number;
  readonly entryCount: number;
  readonly overloadCount: number;
  readonly overloadRatio: number;
  readonly avgUptimeRatio: number;
  readonly avgLoadPressure: number;
  readonly peakLoadPressure: number;
  readonly trendDirection: 'STABLE' | 'ESCALATING' | 'RECOVERING';
}

export class EventBusSignalRollingWindow {
  private readonly entries: EventBusRollingWindowEntry[] = [];
  private readonly windowMs: number;
  private readonly maxEntries: number;

  public constructor(windowMs = 60_000, maxEntries = 1000) {
    this.windowMs = windowMs;
    this.maxEntries = maxEntries;
  }

  public push(entry: EventBusRollingWindowEntry): void {
    this.entries.push(Object.freeze(entry));
    const cutoff = entry.capturedAtMs - this.windowMs;
    while (this.entries.length > 0 && (this.entries[0]?.capturedAtMs ?? 0) < cutoff) {
      this.entries.shift();
    }
    if (this.entries.length > this.maxEntries) this.entries.shift();
  }

  public getStats(): EventBusRollingWindowStats {
    if (this.entries.length === 0) {
      return Object.freeze({
        windowSizeMs: this.windowMs, entryCount: 0, overloadCount: 0, overloadRatio: 0,
        avgUptimeRatio: 1, avgLoadPressure: 0, peakLoadPressure: 0, trendDirection: 'STABLE',
      });
    }

    const n = this.entries.length;
    let overloadCount = 0, sumUptime = 0, sumLoad = 0, peakLoad = 0;
    for (const e of this.entries) {
      if (e.isOverloaded) overloadCount++;
      sumUptime += e.uptimeRatio;
      sumLoad += e.loadPressure;
      if (e.loadPressure > peakLoad) peakLoad = e.loadPressure;
    }

    const half = Math.floor(n / 2);
    const firstHalfLoad = this.entries.slice(0, half).reduce((s, e) => s + e.loadPressure, 0);
    const secondHalfLoad = this.entries.slice(half).reduce((s, e) => s + e.loadPressure, 0);
    const avgFirst = half > 0 ? firstHalfLoad / half : 0;
    const avgSecond = (n - half) > 0 ? secondHalfLoad / (n - half) : 0;
    const trendDirection =
      avgSecond - avgFirst > 0.1 ? 'ESCALATING' :
      avgFirst - avgSecond > 0.1 ? 'RECOVERING' : 'STABLE';

    return Object.freeze({
      windowSizeMs: this.windowMs,
      entryCount: n,
      overloadCount,
      overloadRatio: overloadCount / n,
      avgUptimeRatio: sumUptime / n,
      avgLoadPressure: sumLoad / n,
      peakLoadPressure: peakLoad,
      trendDirection,
    });
  }

  public getEntries(): readonly EventBusRollingWindowEntry[] {
    return Object.freeze([...this.entries]);
  }

  public clear(): void { this.entries.length = 0; }
  public get size(): number { return this.entries.length; }
}

// =============================================================================
// § 10 — EventBusSignalBudget — per-flush envelope budget enforcement
// =============================================================================

export interface EventBusSignalBudgetPolicy {
  readonly maxEnvelopesPerFlush: number;
  readonly criticalAlwaysPass: boolean;
  readonly warnPriorityBoost: number;
}

export const DEFAULT_EVENT_BUS_BUDGET_POLICY: EventBusSignalBudgetPolicy = Object.freeze({
  maxEnvelopesPerFlush: 10,
  criticalAlwaysPass: true,
  warnPriorityBoost: 20,
});

export class EventBusSignalBudget {
  private readonly policy: EventBusSignalBudgetPolicy;
  private totalEmitted = 0;
  private totalDropped = 0;

  public constructor(policy: EventBusSignalBudgetPolicy = DEFAULT_EVENT_BUS_BUDGET_POLICY) {
    this.policy = policy;
  }

  public filter(
    artifacts: readonly EventBusSignalAdapterArtifact[],
  ): readonly EventBusSignalAdapterArtifact[] {
    // Critical signals always pass
    const criticals = this.policy.criticalAlwaysPass
      ? artifacts.filter((a) => a.severity === 'CRITICAL')
      : [];
    const rest = this.policy.criticalAlwaysPass
      ? artifacts.filter((a) => a.severity !== 'CRITICAL')
      : artifacts;

    const budget = Math.max(0, this.policy.maxEnvelopesPerFlush - criticals.length);
    const selected = rest
      .map((a) => ({
        artifact: a,
        score: (a.severity === 'WARN' ? this.policy.warnPriorityBoost : 0) +
               (a.isOverloaded ? 50 : 0) +
               Math.round((a.uptimeRatio as number) * 10),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, budget)
      .map((e) => e.artifact);

    const dropped = rest.length - selected.length;
    this.totalDropped += dropped;
    this.totalEmitted += criticals.length + selected.length;

    return Object.freeze([...criticals, ...selected]);
  }

  public get emitted(): number { return this.totalEmitted; }
  public get dropped(): number { return this.totalDropped; }

  public reset(): void {
    this.totalEmitted = 0;
    this.totalDropped = 0;
  }
}

// =============================================================================
// § 11 — Module-level constants
// =============================================================================

export const EVENT_BUS_MAX_OVERLOAD_ALERTS_PER_WINDOW = 10;
export const EVENT_BUS_CRITICAL_DROP_RATIO = 0.1;
export const EVENT_BUS_SIGNAL_SURFACE = 'event_bus' as const;
export const EVENT_BUS_CHAT_NAMESPACE = 'eventbus' as const;

/** Build an EventBusSignalFacade with sensible defaults. */
export function createEventBusSignalFacade(
  roomId: ChatRoomId | string,
  opts?: Partial<Omit<EventBusSignalFacadeOptions, 'roomId'>>,
): EventBusSignalFacade {
  return new EventBusSignalFacade({ roomId, ...opts });
}

// =============================================================================
// § 12 — EventBusSignalHealthTracker — rolling health per bus instance
// =============================================================================

export type EventBusHealthGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface EventBusHealthGradeEntry {
  readonly capturedAtMs: UnixMs;
  readonly grade: EventBusHealthGrade;
  readonly uptimeRatio: number;
  readonly loadPressure: number;
  readonly isOverloaded: boolean;
}

export interface EventBusHealthTrackerReport {
  readonly currentGrade: EventBusHealthGrade;
  readonly avgGradeNumeric: number;
  readonly gradeHistory: readonly EventBusHealthGradeEntry[];
  readonly totalEntries: number;
  readonly sGradeCount: number;
  readonly fGradeCount: number;
  readonly consecutiveOverloads: number;
  readonly isAtRisk: boolean;
}

const EVENTBUS_GRADE_NUMERIC: Record<EventBusHealthGrade, number> = {
  S: 6, A: 5, B: 4, C: 3, D: 2, F: 1,
};

function computeEventBusGrade(uptimeRatio: number, loadPressure: number): EventBusHealthGrade {
  const score = uptimeRatio * 0.7 + (1 - loadPressure) * 0.3;
  if (score >= 0.92) return 'S';
  if (score >= 0.80) return 'A';
  if (score >= 0.65) return 'B';
  if (score >= 0.50) return 'C';
  if (score >= 0.35) return 'D';
  return 'F';
}

export class EventBusSignalHealthTracker {
  private readonly history: EventBusHealthGradeEntry[] = [];
  private readonly maxHistory: number;
  private consecutiveOverloads = 0;

  public constructor(maxHistory = 200) {
    this.maxHistory = maxHistory;
  }

  public record(signal: EventBusChatSignalCompat, nowMs: UnixMs): void {
    const uptimeRatio = healthStatusToUptimeRatio(signal.healthStatus);
    const loadPressure = computeLoadPressure(signal);
    const grade = computeEventBusGrade(uptimeRatio, loadPressure);
    const isOverloaded = signal.isOverloaded === true;

    if (isOverloaded) {
      this.consecutiveOverloads++;
    } else {
      this.consecutiveOverloads = 0;
    }

    this.history.push(Object.freeze({
      capturedAtMs: nowMs,
      grade,
      uptimeRatio,
      loadPressure,
      isOverloaded,
    }));
    if (this.history.length > this.maxHistory) this.history.shift();
  }

  public buildReport(): EventBusHealthTrackerReport {
    const n = this.history.length;
    if (n === 0) {
      return Object.freeze({
        currentGrade: 'S', avgGradeNumeric: 6, gradeHistory: [],
        totalEntries: 0, sGradeCount: 0, fGradeCount: 0,
        consecutiveOverloads: 0, isAtRisk: false,
      });
    }

    const numericScores = this.history.map((e) => EVENTBUS_GRADE_NUMERIC[e.grade]);
    const avgNumeric = numericScores.reduce((s, v) => s + v, 0) / n;
    const sCount = this.history.filter((e) => e.grade === 'S').length;
    const fCount = this.history.filter((e) => e.grade === 'F').length;
    const currentGrade = this.history[n - 1]?.grade ?? 'S';
    const isAtRisk = this.consecutiveOverloads >= 3 || fCount > n * 0.2;

    return Object.freeze({
      currentGrade,
      avgGradeNumeric: avgNumeric,
      gradeHistory: Object.freeze([...this.history]),
      totalEntries: n,
      sGradeCount: sCount,
      fGradeCount: fCount,
      consecutiveOverloads: this.consecutiveOverloads,
      isAtRisk,
    });
  }

  public reset(): void {
    this.history.length = 0;
    this.consecutiveOverloads = 0;
  }
}

// =============================================================================
// § 13 — EventBusSignalAdapterDiagnostics — full diagnostic surface
// =============================================================================

export interface EventBusAdapterDiagnosticsReport {
  readonly adapterVersion: string;
  readonly adapterState: EventBusSignalAdapterState;
  readonly analyticsReport: EventBusSignalAnalyticsReport;
  readonly healthTrackerReport: EventBusHealthTrackerReport;
  readonly patternMatches: readonly EventBusPatternMatch[];
  readonly dlVectorLength: number;
  readonly isHealthy: boolean;
  readonly healthReason: string;
}

export function buildEventBusAdapterDiagnostics(
  adapter: EventBusSignalAdapter,
  analytics: EventBusSignalAnalytics,
  healthTracker: EventBusSignalHealthTracker,
  patternDetector: EventBusPatternDetector,
): EventBusAdapterDiagnosticsReport {
  const adapterState = adapter.getState();
  const analyticsReport = analytics.buildReport();
  const healthTrackerReport = healthTracker.buildReport();
  const patternMatches = patternDetector.getCriticalMatches();

  const isHealthy =
    !healthTrackerReport.isAtRisk &&
    analyticsReport.overloadRatio < 0.2 &&
    patternMatches.length === 0;

  const healthReason = !isHealthy
    ? healthTrackerReport.isAtRisk ? 'AT_RISK_OF_OVERLOAD' :
      analyticsReport.overloadRatio >= 0.2 ? 'HIGH_OVERLOAD_RATIO' :
      'CRITICAL_PATTERNS_DETECTED'
    : 'OK';

  return Object.freeze({
    adapterVersion: EVENT_BUS_ADAPTER_VERSION,
    adapterState,
    analyticsReport,
    healthTrackerReport,
    patternMatches,
    dlVectorLength: EVENT_BUS_DL_VECTOR_LENGTH,
    isHealthy,
    healthReason,
  });
}

// =============================================================================
// § 14 — Type guards and structural validators
// =============================================================================

export function isEventBusSignalAdapterArtifact(
  v: unknown,
): v is EventBusSignalAdapterArtifact {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.dedupeKey === 'string' &&
    typeof o.isOverloaded === 'boolean' &&
    typeof o.eventName === 'string'
  );
}

export function isEventBusAnalyticsReportCompat(
  v: unknown,
): v is EventBusAnalyticsReportCompat {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.healthStatus === 'string' &&
    typeof o.totalEventsEmitted === 'number' &&
    typeof o.isOverloaded === 'boolean'
  );
}

export function isEventBusHealthReportCompat(
  v: unknown,
): v is EventBusHealthReportCompat {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.overallHealth === 'string' &&
    typeof o.isHealthy === 'boolean' &&
    Array.isArray(o.criticalAlerts)
  );
}

// =============================================================================
// § 15 — EventBusNarrativeRouter — routes EventBus signals to NPC surfaces
// =============================================================================

export type EventBusNarrativeSurface =
  | 'SYSTEM_ALERT'
  | 'BOSS_COMMENTARY'
  | 'AMBIENT_SYSTEM'
  | 'SILENT';

export interface EventBusNarrativeRoute {
  readonly surface: EventBusNarrativeSurface;
  readonly suppressAmbientNPC: boolean;
  readonly requiresImmediateResponse: boolean;
  readonly chatNarrativePriority: number;
  readonly narrativeLabel: string;
}

export class EventBusNarrativeRouter {
  public route(artifact: EventBusSignalAdapterArtifact): EventBusNarrativeRoute {
    const isOverloaded = artifact.isOverloaded;
    const severity = artifact.severity;
    const loadPressure = artifact.loadPressure as number;

    const surface: EventBusNarrativeSurface =
      severity === 'CRITICAL' || isOverloaded ? 'SYSTEM_ALERT' :
      severity === 'WARN' ? 'BOSS_COMMENTARY' :
      loadPressure > 0.5 ? 'AMBIENT_SYSTEM' : 'SILENT';

    const suppressAmbientNPC = severity === 'CRITICAL' || isOverloaded;
    const requiresImmediateResponse = isOverloaded || severity === 'CRITICAL';

    const chatNarrativePriority = Math.round(
      (loadPressure as number) * 40 +
      (isOverloaded ? 60 : 0) +
      (severity === 'CRITICAL' ? 30 : severity === 'WARN' ? 15 : 0),
    );

    const narrativeLabel =
      isOverloaded ? 'EVENTBUS_OVERLOAD_CRISIS' :
      severity === 'CRITICAL' ? 'EVENTBUS_SYSTEM_CRITICAL' :
      severity === 'WARN' ? 'EVENTBUS_DEGRADED' : 'EVENTBUS_AMBIENT';

    return Object.freeze({
      surface, suppressAmbientNPC, requiresImmediateResponse,
      chatNarrativePriority, narrativeLabel,
    });
  }

  public routeBatch(
    artifacts: readonly EventBusSignalAdapterArtifact[],
  ): readonly EventBusNarrativeRoute[] {
    return Object.freeze(
      artifacts
        .map((a) => this.route(a))
        .sort((a, b) => b.chatNarrativePriority - a.chatNarrativePriority),
    );
  }
}

// =============================================================================
// § 16 — EventBusSignalCorrelator — dedup EventBus signals cross-window
// =============================================================================

export interface EventBusSignalCorrelationEntry {
  readonly key: string;
  readonly firstSeenAtMs: UnixMs;
  readonly lastSeenAtMs: UnixMs;
  readonly occurrenceCount: number;
  readonly isOverloaded: boolean;
  readonly maxLoadPressure: number;
}

export class EventBusSignalCorrelator {
  private readonly correlations = new Map<string, EventBusSignalCorrelationEntry>();
  private readonly maxEntries: number;
  private readonly expiryMs: number;

  public constructor(maxEntries = 200, expiryMs = 60_000) {
    this.maxEntries = maxEntries;
    this.expiryMs = expiryMs;
  }

  public track(artifact: EventBusSignalAdapterArtifact, nowMs: UnixMs): void {
    const key = artifact.dedupeKey;
    const existing = this.correlations.get(key);

    if (existing) {
      this.correlations.set(key, Object.freeze({
        ...existing,
        lastSeenAtMs: nowMs,
        occurrenceCount: existing.occurrenceCount + 1,
        maxLoadPressure: Math.max(existing.maxLoadPressure, artifact.loadPressure as number),
        isOverloaded: existing.isOverloaded || artifact.isOverloaded,
      }));
    } else {
      if (this.correlations.size >= this.maxEntries) {
        // Remove oldest entry
        const oldestKey = Array.from(this.correlations.entries())
          .sort((a, b) => a[1].lastSeenAtMs - b[1].lastSeenAtMs)[0]?.[0];
        if (oldestKey) this.correlations.delete(oldestKey);
      }
      this.correlations.set(key, Object.freeze({
        key,
        firstSeenAtMs: nowMs,
        lastSeenAtMs: nowMs,
        occurrenceCount: 1,
        isOverloaded: artifact.isOverloaded,
        maxLoadPressure: artifact.loadPressure as number,
      }));
    }
  }

  public pruneExpired(nowMs: UnixMs): void {
    for (const [key, entry] of this.correlations.entries()) {
      if (nowMs - entry.lastSeenAtMs > this.expiryMs) {
        this.correlations.delete(key);
      }
    }
  }

  public getPersistentCorrelations(minOccurrences: number): readonly EventBusSignalCorrelationEntry[] {
    return Object.freeze(
      Array.from(this.correlations.values()).filter((e) => e.occurrenceCount >= minOccurrences),
    );
  }

  public reset(): void { this.correlations.clear(); }
  public get size(): number { return this.correlations.size; }
}

export function createEventBusNarrativeRouter(): EventBusNarrativeRouter {
  return new EventBusNarrativeRouter();
}

export function createEventBusSignalCorrelator(
  maxEntries?: number,
  expiryMs?: number,
): EventBusSignalCorrelator {
  return new EventBusSignalCorrelator(maxEntries, expiryMs);
}

export function createEventBusSignalHealthTracker(
  maxHistory?: number,
): EventBusSignalHealthTracker {
  return new EventBusSignalHealthTracker(maxHistory);
}

// =============================================================================
// § 17 — EventBusSignalAdapterSuite — composable adapter suite
// =============================================================================

/**
 * EventBusSignalAdapterSuite — bundles every EventBus adapter component into
 * one composable object. Used when the caller wants fine-grained access to the
 * internal components for testing, instrumentation, or custom orchestration.
 */
export class EventBusSignalAdapterSuite {
  public readonly adapter: EventBusSignalAdapter;
  public readonly pipeline: EventBusSignalPipeline;
  public readonly analytics: EventBusSignalAnalytics;
  public readonly patternDetector: EventBusPatternDetector;
  public readonly mlExtractor: EventBusMLExtractor;
  public readonly healthTracker: EventBusSignalHealthTracker;
  public readonly correlator: EventBusSignalCorrelator;
  public readonly narrativeRouter: EventBusNarrativeRouter;
  public readonly rollingWindow: EventBusSignalRollingWindow;
  public readonly budget: EventBusSignalBudget;

  public constructor(opts: EventBusSignalPipelineOptions) {
    this.adapter = new EventBusSignalAdapter({
      defaultRoomId: opts.roomId,
      defaultVisibleChannel: opts.defaultVisibleChannel,
      dedupeWindowMs: opts.dedupeWindowMs,
      maxHistory: opts.maxHistory,
      overloadDropRatioThreshold: opts.overloadDropRatioThreshold,
      suppressQuietAndIdle: opts.suppressQuietAndIdle,
      emitMLVectors: opts.emitMLVectors,
      logger: opts.logger,
      clock: opts.clock,
    });
    this.pipeline = new EventBusSignalPipeline(opts);
    this.analytics = new EventBusSignalAnalytics(opts.analyticsHistorySize ?? 400);
    this.patternDetector = new EventBusPatternDetector({ windowMs: opts.patternWindowMs });
    this.mlExtractor = new EventBusMLExtractor();
    this.healthTracker = new EventBusSignalHealthTracker();
    this.correlator = new EventBusSignalCorrelator();
    this.narrativeRouter = new EventBusNarrativeRouter();
    this.rollingWindow = new EventBusSignalRollingWindow();
    this.budget = new EventBusSignalBudget();
  }

  public buildFullDiagnostics(): EventBusAdapterDiagnosticsReport {
    return buildEventBusAdapterDiagnostics(
      this.adapter, this.analytics, this.healthTracker, this.patternDetector,
    );
  }

  public reset(): void {
    this.adapter.reset();
    this.pipeline.reset();
    this.analytics.reset();
    this.patternDetector.reset();
    this.healthTracker.reset();
    this.correlator.reset();
    this.rollingWindow.clear();
    this.budget.reset();
  }
}

export function createEventBusSignalAdapterSuite(
  opts: EventBusSignalPipelineOptions,
): EventBusSignalAdapterSuite {
  return new EventBusSignalAdapterSuite(opts);
}

// Module-level flag
export const EVENT_BUS_ADAPTER_READY = true;

// ─── §18 EventBusSignalReplayBuffer ───────────────────────────────────────────
/** Stores the last N processed envelopes for replay / debugging purposes. */
export class EventBusSignalReplayBuffer {
  private readonly capacity: number;
  private readonly buffer: Array<{ tick: number; envelopes: ReadonlyArray<ChatInputEnvelope> }> = [];

  public constructor(capacity: number = 20) {
    this.capacity = capacity;
  }

  public record(tick: number, envelopes: ReadonlyArray<ChatInputEnvelope>): void {
    if (this.buffer.length >= this.capacity) this.buffer.shift();
    this.buffer.push({ tick, envelopes: [...envelopes] });
  }

  public replay(fromTick: number): ReadonlyArray<ChatInputEnvelope> {
    return this.buffer
      .filter(r => r.tick >= fromTick)
      .flatMap(r => r.envelopes);
  }

  public latest(): ReadonlyArray<ChatInputEnvelope> {
    return this.buffer.length > 0 ? this.buffer[this.buffer.length - 1].envelopes : [];
  }

  public clear(): void { this.buffer.length = 0; }
  public size(): number { return this.buffer.length; }
}

// ─── §19 EventBusSignalThrottleGate ───────────────────────────────────────────
/** Per-channel token-bucket throttle gate to prevent burst flooding. */
export class EventBusSignalThrottleGate {
  private readonly tokens: Map<string, number> = new Map();
  private readonly refillRate: number;
  private readonly bucketMax: number;
  private lastRefill: UnixMs = 0 as UnixMs;

  public constructor(refillRate: number = 5, bucketMax: number = 20) {
    this.refillRate = refillRate;
    this.bucketMax = bucketMax;
  }

  public shouldAllow(channel: string, nowMs: UnixMs): boolean {
    this.maybeRefill(nowMs);
    const current = this.tokens.get(channel) ?? this.bucketMax;
    if (current <= 0) return false;
    this.tokens.set(channel, current - 1);
    return true;
  }

  private maybeRefill(nowMs: UnixMs): void {
    const elapsed = nowMs - this.lastRefill;
    if (elapsed < 1000) return;
    const ticks = Math.floor(elapsed / 1000);
    for (const [ch, val] of this.tokens) {
      this.tokens.set(ch, Math.min(this.bucketMax, val + ticks * this.refillRate));
    }
    this.lastRefill = nowMs;
  }

  public reset(): void { this.tokens.clear(); this.lastRefill = 0 as UnixMs; }
}

// ─── §20 EventBusSignalEnvelopeValidator ──────────────────────────────────────
/** Validates that envelopes are well-formed before emission. */
export class EventBusSignalEnvelopeValidator {
  private validated = 0;
  private rejected = 0;

  public validate(envelope: ChatInputEnvelope): boolean {
    // Do not assume ChatInputEnvelope has top-level roomId/channel (some variants do not).
    const e = envelope as unknown as Record<string, unknown>;
    const hasEmittedAt = e.emittedAt !== undefined;
    const hasPayload = e.payload !== undefined && e.payload !== null;

    // If payload is a LIVEOPS ChatSignalEnvelope, ensure payload.roomId exists.
    let liveopsRoomOk = true;
    if (hasPayload && typeof e.payload === 'object') {
      const p = e.payload as Record<string, unknown>;
      if (p.type === 'LIVEOPS') {
        liveopsRoomOk = p.roomId !== undefined && p.roomId !== null;
      }
    }

    const ok = hasEmittedAt && hasPayload && liveopsRoomOk;
    if (ok) this.validated++; else this.rejected++;
    return ok;
  }

  public filterValid(envelopes: ReadonlyArray<ChatInputEnvelope>): ChatInputEnvelope[] {
    return envelopes.filter(e => this.validate(e));
  }

  public stats(): { validated: number; rejected: number; passRate: Score01 } {
    const total = this.validated + this.rejected;
    return {
      validated: this.validated,
      rejected: this.rejected,
      passRate: clamp01(total > 0 ? this.validated / total : 1),
    };
  }

  public reset(): void { this.validated = 0; this.rejected = 0; }
}

// ─── §21 Module exports summary ───────────────────────────────────────────────
export const EVENT_BUS_MODULE_VERSION = '2.0.0' as const;
export const EVENT_BUS_MAX_REPLAY_TICKS = 20 as const;
export const EVENT_BUS_THROTTLE_REFILL_RATE = 5 as const;
export const EVENT_BUS_ADAPTER_MODULE_EXPORTS = [
  'EventBusSignalAdapter',
  'EventBusSignalPipeline',
  'EventBusSignalAnalytics',
  'EventBusPatternDetector',
  'EventBusMLExtractor',
  'EventBusWatcherSignalAdapter',
  'EventBusSignalFacade',
  'EventBusSignalRollingWindow',
  'EventBusSignalBudget',
  'EventBusSignalHealthTracker',
  'EventBusSignalCorrelator',
  'EventBusNarrativeRouter',
  'EventBusSignalAdapterSuite',
  'EventBusSignalReplayBuffer',
  'EventBusSignalThrottleGate',
  'EventBusSignalEnvelopeValidator',
] as const;
