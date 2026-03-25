/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT ENGINE REGISTRY SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/RegistrySignalAdapter.ts
 * VERSION: 2026.03.24
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates EngineRegistry truth — engine
 * registrations, health alerts, capability coverage reports, watchdog
 * alerts, and ML registry vectors — into authoritative backend-chat ingress
 * envelopes.
 *
 * Backend-truth question
 * ----------------------
 *   "When the EngineRegistry detects a health degradation, a capability gap,
 *    a watchdog alert, or an engine registration event, what exact chat-native
 *    signal should the authoritative backend chat engine ingest?"
 *
 * Design laws
 * -----------
 * - No circular imports from core/. All core types are mirrored as structural
 *   compat interfaces below.
 * - Critical health failures are always accepted; no deduplication.
 * - Registry validation errors produce WARN-level signals.
 * - Engine ID and capability state must be preserved in signal metadata.
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
// Structural compat interfaces — mirrors EngineRegistryChatSignal
// ─────────────────────────────────────────────────────────────────────────────

export interface RegistryEngineHealthCompat {
  readonly engineId: string;
  readonly status: 'HEALTHY' | 'DEGRADED' | 'FAILED' | string;
  readonly consecutiveFailures?: number | null;
  readonly updatedAt?: number | null;
  readonly notes?: readonly string[] | null;
}

export interface RegistryCapabilityReportCompat {
  readonly registryFillRatio?: number | null;
  readonly healthyRatio?: number | null;
  readonly failedRatio?: number | null;
  readonly uptimeRatio?: number | null;
  readonly dependencySatisfaction?: number | null;
  readonly capabilityCoverage?: number | null;
  readonly executionPlanValid?: boolean | null;
  readonly missingCritical?: readonly string[] | null;
}

/** Structural mirror of EngineRegistryChatSignal from core/EngineRegistry.ts */
export interface RegistryChatSignalCompat {
  readonly surface: 'engine_registry';
  readonly kind: string;
  readonly severity: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly engineId?: string | null;
  readonly tick?: number | null;
  readonly healthStatus?: string | null;
  readonly registryFillRatio?: number | null;
  readonly healthyRatio?: number | null;
  readonly uptimeRatio?: number | null;
  readonly capabilityCoverage?: number | null;
  readonly executionPlanValid?: boolean | null;
  readonly missingCritical?: readonly string[] | null;
  readonly consecutiveFailures?: number | null;
}

/** ML vector compat */
export interface RegistryMLVectorCompat {
  readonly tick: number;
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly generatedAtMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter types
// ─────────────────────────────────────────────────────────────────────────────

export interface RegistrySignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface RegistrySignalAdapterClock {
  now(): UnixMs;
}

export interface RegistrySignalAdapterOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly dedupeWindowMs?: number;
  readonly maxHistory?: number;
  readonly suppressInfoBelowUptimeRatio?: number;
  readonly alwaysEmitOnFailure?: boolean;
  readonly logger?: RegistrySignalAdapterLogger;
  readonly clock?: RegistrySignalAdapterClock;
}

export interface RegistrySignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export type RegistrySignalAdapterEventName =
  | 'registry.engine.registered'
  | 'registry.engine.health_alert'
  | 'registry.engine.failed'
  | 'registry.engine.recovered'
  | 'registry.capability.gap'
  | 'registry.validation.error'
  | 'registry.watchdog.alert'
  | 'registry.health.report'
  | 'registry.ml.vector_emitted'
  | string;

export type RegistrySignalAdapterNarrativeWeight =
  | 'AMBIENT'
  | 'OPERATIONAL'
  | 'CRITICAL'
  | 'SYSTEM_FAILURE';

export type RegistrySignalAdapterSeverity =
  | 'DEBUG'
  | 'INFO'
  | 'WARN'
  | 'CRITICAL';

export interface RegistrySignalAdapterArtifact {
  readonly envelope: ChatInputEnvelope;
  readonly dedupeKey: string;
  readonly routeChannel: ChatVisibleChannel;
  readonly narrativeWeight: RegistrySignalAdapterNarrativeWeight;
  readonly severity: RegistrySignalAdapterSeverity;
  readonly eventName: RegistrySignalAdapterEventName;
  readonly tick: number;
  readonly engineId: string;
  readonly healthScore: Score01;
  readonly uptimeRatio: Score01;
  readonly isFailure: boolean;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface RegistrySignalAdapterRejection {
  readonly eventName: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface RegistrySignalAdapterDeduped {
  readonly eventName: string;
  readonly dedupeKey: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface RegistrySignalAdapterHistoryEntry {
  readonly at: UnixMs;
  readonly eventName: string;
  readonly tick: number;
  readonly engineId: string;
  readonly severity: RegistrySignalAdapterSeverity;
  readonly isFailure: boolean;
  readonly healthScore: Score01;
  readonly dedupeKey: string;
}

export interface RegistrySignalAdapterReport {
  readonly accepted: readonly RegistrySignalAdapterArtifact[];
  readonly deduped: readonly RegistrySignalAdapterDeduped[];
  readonly rejected: readonly RegistrySignalAdapterRejection[];
}

export interface RegistrySignalAdapterState {
  readonly history: readonly RegistrySignalAdapterHistoryEntry[];
  readonly lastAcceptedAtByKey: Readonly<Record<string, UnixMs>>;
  readonly lastHealthyEngines: readonly string[];
  readonly lastFailedEngines: readonly string[];
  readonly lastTick: number;
  readonly acceptedCount: number;
  readonly dedupedCount: number;
  readonly rejectedCount: number;
  readonly failureAlertCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_DEDUPE_WINDOW_MS = 5_000;
const DEFAULT_MAX_HISTORY = 200;
const DEFAULT_SUPPRESS_INFO_THRESHOLD = 0.8;

const NULL_LOGGER: RegistrySignalAdapterLogger = Object.freeze({
  debug() {},
  warn() {},
  error() {},
});

const SYSTEM_CLOCK: RegistrySignalAdapterClock = Object.freeze({
  now(): UnixMs { return asUnixMs(Date.now()); },
});

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function healthStatusToScore(status: string): number {
  switch (status) {
    case 'HEALTHY': return 1.0;
    case 'DEGRADED': return 0.5;
    case 'FAILED': return 0.0;
    default: return 0.7;
  }
}

function severityToAdapterSeverity(
  severity: 'info' | 'warn' | 'error',
  isFailure: boolean,
): RegistrySignalAdapterSeverity {
  if (isFailure || severity === 'error') return 'CRITICAL';
  if (severity === 'warn') return 'WARN';
  return 'INFO';
}

function narrativeWeightFromSignal(
  signal: RegistryChatSignalCompat,
  isFailure: boolean,
): RegistrySignalAdapterNarrativeWeight {
  if (isFailure) return 'SYSTEM_FAILURE';
  if (signal.severity === 'error' || (signal.consecutiveFailures ?? 0) >= 2) return 'CRITICAL';
  if (signal.severity === 'warn') return 'OPERATIONAL';
  return 'AMBIENT';
}

function buildRegistrySignalEnvelope(
  signal: RegistryChatSignalCompat,
  roomId: ChatRoomId | string | null,
  healthScore: number,
  now: UnixMs,
): ChatSignalEnvelope {
  return Object.freeze({
    type: 'LIVEOPS',
    emittedAt: now,
    roomId: (roomId ?? null) as Nullable<ChatRoomId>,
    liveops: Object.freeze({
      worldEventName: signal.kind,
      heatMultiplier01: clamp01(1 - healthScore) as Score01,
      helperBlackout: signal.healthStatus === 'FAILED',
      haterRaidActive: false,
    }),
    metadata: Object.freeze({
      surface: signal.surface,
      kind: signal.kind,
      severity: signal.severity,
      message: signal.message,
      engineId: signal.engineId ?? 'system',
      tick: signal.tick ?? 0,
      healthStatus: signal.healthStatus ?? null,
      registryFillRatio: signal.registryFillRatio ?? null,
      healthyRatio: signal.healthyRatio ?? null,
      uptimeRatio: signal.uptimeRatio ?? null,
      capabilityCoverage: signal.capabilityCoverage ?? null,
      executionPlanValid: signal.executionPlanValid ?? null,
      consecutiveFailures: signal.consecutiveFailures ?? null,
    } as Record<string, JsonValue>),
  });
}

function buildRegistryChatEnvelope(
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
// RegistrySignalAdapter
// ─────────────────────────────────────────────────────────────────────────────

export class RegistrySignalAdapter {
  private readonly options: Required<RegistrySignalAdapterOptions>;
  private readonly logger: RegistrySignalAdapterLogger;
  private readonly clock: RegistrySignalAdapterClock;

  private readonly history: RegistrySignalAdapterHistoryEntry[] = [];
  private readonly lastAcceptedAtByKey: Map<string, UnixMs> = new Map();
  private readonly lastHealthyEngines: Set<string> = new Set();
  private readonly lastFailedEngines: Set<string> = new Set();

  private acceptedCount = 0;
  private dedupedCount = 0;
  private rejectedCount = 0;
  private failureAlertCount = 0;
  private lastTick = 0;

  public constructor(options: RegistrySignalAdapterOptions) {
    this.logger = options.logger ?? NULL_LOGGER;
    this.clock = options.clock ?? SYSTEM_CLOCK;
    this.options = Object.freeze({
      defaultRoomId: options.defaultRoomId,
      defaultVisibleChannel: options.defaultVisibleChannel ?? 'GLOBAL',
      dedupeWindowMs: options.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS,
      maxHistory: options.maxHistory ?? DEFAULT_MAX_HISTORY,
      suppressInfoBelowUptimeRatio: options.suppressInfoBelowUptimeRatio ?? DEFAULT_SUPPRESS_INFO_THRESHOLD,
      alwaysEmitOnFailure: options.alwaysEmitOnFailure ?? true,
      logger: this.logger,
      clock: this.clock,
    });
  }

  // ── Public ingestion surface ──────────────────────────────────────────────

  public ingestSignal(
    signal: RegistryChatSignalCompat,
    context?: RegistrySignalAdapterContext,
  ): RegistrySignalAdapterArtifact | RegistrySignalAdapterRejection | RegistrySignalAdapterDeduped {
    const now = this.clock.now();
    const roomId = context?.roomId ?? this.options.defaultRoomId;
    const routeChannel: ChatVisibleChannel = context?.routeChannel ?? this.options.defaultVisibleChannel;
    const tick = signal.tick ?? 0;

    const healthScore = signal.healthStatus
      ? healthStatusToScore(signal.healthStatus)
      : signal.healthyRatio ?? 1.0;

    const isFailure =
      signal.healthStatus === 'FAILED' ||
      signal.severity === 'error' ||
      (signal.consecutiveFailures ?? 0) >= 3;

    if (!isFailure && !this.isSignalMeaningful(signal, healthScore)) {
      const rejection: RegistrySignalAdapterRejection = Object.freeze({
        eventName: signal.kind,
        reason: 'BELOW_OPERATIONAL_THRESHOLD',
        details: { tick, kind: signal.kind, healthScore },
      });
      this.rejectedCount++;
      return rejection;
    }

    const dedupeKey = `${signal.kind}:${signal.engineId ?? 'system'}:${signal.healthStatus ?? 'ok'}`;

    if (!isFailure && this.isDuplicate(dedupeKey, now)) {
      const deduped: RegistrySignalAdapterDeduped = Object.freeze({
        eventName: signal.kind,
        dedupeKey,
        reason: 'WITHIN_DEDUPE_WINDOW',
        details: { tick, dedupeWindowMs: this.options.dedupeWindowMs },
      });
      this.dedupedCount++;
      return deduped;
    }

    const narrativeWeight = narrativeWeightFromSignal(signal, isFailure);
    const adapterSeverity = severityToAdapterSeverity(signal.severity, isFailure);
    const uptimeRatio = clamp01(signal.uptimeRatio ?? healthScore) as Score01;
    const healthScoreClamped = clamp01(healthScore) as Score01;
    const pressureMomentum = clamp100(Math.round((1 - healthScore) * 100)) as Score100;

    const signalEnvelope = buildRegistrySignalEnvelope(signal, roomId as string, healthScore, now);
    const envelope = buildRegistryChatEnvelope(signalEnvelope, now);

    const artifact: RegistrySignalAdapterArtifact = Object.freeze({
      envelope,
      dedupeKey,
      routeChannel,
      narrativeWeight,
      severity: adapterSeverity,
      eventName: signal.kind as RegistrySignalAdapterEventName,
      tick,
      engineId: signal.engineId ?? 'system',
      healthScore: healthScoreClamped,
      uptimeRatio,
      isFailure,
      details: Object.freeze({
        tick,
        kind: signal.kind,
        message: signal.message,
        engineId: signal.engineId ?? 'system',
        healthStatus: signal.healthStatus ?? null,
        healthScore: parseFloat(healthScore.toFixed(4)),
        uptimeRatio: parseFloat(uptimeRatio.toFixed(4)),
        pressureMomentum,
        source: context?.source ?? 'engine_registry',
      } as Record<string, JsonValue>),
    });

    this.acceptArtifact(artifact, dedupeKey, now, isFailure);

    if (isFailure) {
      this.failureAlertCount++;
      this.lastFailedEngines.add(signal.engineId ?? 'system');
      this.logger.warn('[RegistrySignalAdapter] engine failure', {
        engineId: signal.engineId ?? 'system',
        tick,
        healthStatus: signal.healthStatus ?? 'UNKNOWN',
      });
    } else {
      this.lastHealthyEngines.add(signal.engineId ?? 'system');
    }

    this.lastTick = tick;

    return artifact;
  }

  public ingestHealthReport(
    report: RegistryCapabilityReportCompat,
    tick: number,
    context?: RegistrySignalAdapterContext,
  ): RegistrySignalAdapterArtifact | RegistrySignalAdapterRejection | RegistrySignalAdapterDeduped {
    const healthyRatio = report.healthyRatio ?? 1;
    const failedRatio = report.failedRatio ?? 0;
    const isCritical = failedRatio > 0.3 || (report.missingCritical?.length ?? 0) > 0;

    const signal: RegistryChatSignalCompat = {
      surface: 'engine_registry',
      kind: 'registry.health.report',
      severity: isCritical ? 'error' : failedRatio > 0 ? 'warn' : 'info',
      message: `Registry health: fill=${(report.registryFillRatio ?? 0).toFixed(2)}, healthy=${(healthyRatio * 100).toFixed(0)}%, uptime=${(report.uptimeRatio ?? 1).toFixed(3)}, plan=${report.executionPlanValid ?? true}`,
      tick,
      healthStatus: failedRatio > 0.5 ? 'FAILED' : failedRatio > 0 ? 'DEGRADED' : 'HEALTHY',
      registryFillRatio: report.registryFillRatio ?? null,
      healthyRatio,
      uptimeRatio: report.uptimeRatio ?? null,
      capabilityCoverage: report.capabilityCoverage ?? null,
      executionPlanValid: report.executionPlanValid ?? null,
      missingCritical: report.missingCritical ?? null,
    };

    return this.ingestSignal(signal, context);
  }

  public ingestEngineHealth(
    health: RegistryEngineHealthCompat,
    tick: number,
    context?: RegistrySignalAdapterContext,
  ): RegistrySignalAdapterArtifact | RegistrySignalAdapterRejection | RegistrySignalAdapterDeduped {
    const signal: RegistryChatSignalCompat = {
      surface: 'engine_registry',
      kind: health.status === 'FAILED'
        ? 'registry.engine.failed'
        : health.status === 'DEGRADED'
          ? 'registry.engine.health_alert'
          : 'registry.engine.recovered',
      severity: health.status === 'FAILED' ? 'error' :
                health.status === 'DEGRADED' ? 'warn' : 'info',
      message: `Engine ${health.engineId} health: ${health.status}${(health.consecutiveFailures ?? 0) > 0 ? `, consecutive failures: ${health.consecutiveFailures}` : ''}`,
      engineId: health.engineId,
      tick,
      healthStatus: health.status,
      consecutiveFailures: health.consecutiveFailures ?? null,
    };

    return this.ingestSignal(signal, context);
  }

  public ingestBatch(
    signals: readonly RegistryChatSignalCompat[],
    context?: RegistrySignalAdapterContext,
  ): RegistrySignalAdapterReport {
    const accepted: RegistrySignalAdapterArtifact[] = [];
    const deduped: RegistrySignalAdapterDeduped[] = [];
    const rejected: RegistrySignalAdapterRejection[] = [];

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

  public getState(): RegistrySignalAdapterState {
    return Object.freeze({
      history: Object.freeze([...this.history]),
      lastAcceptedAtByKey: Object.freeze(Object.fromEntries(this.lastAcceptedAtByKey)),
      lastHealthyEngines: Object.freeze([...this.lastHealthyEngines]),
      lastFailedEngines: Object.freeze([...this.lastFailedEngines]),
      lastTick: this.lastTick,
      acceptedCount: this.acceptedCount,
      dedupedCount: this.dedupedCount,
      rejectedCount: this.rejectedCount,
      failureAlertCount: this.failureAlertCount,
    });
  }

  public buildReport(): RegistrySignalAdapterReport {
    return Object.freeze({ accepted: [], deduped: [], rejected: [] });
  }

  public buildHealthDiagnostics(): Readonly<Record<string, JsonValue>> {
    return Object.freeze({
      acceptedCount: this.acceptedCount,
      dedupedCount: this.dedupedCount,
      rejectedCount: this.rejectedCount,
      failureAlertCount: this.failureAlertCount,
      lastTick: this.lastTick,
      failedEngines: [...this.lastFailedEngines],
      healthyEngines: [...this.lastHealthyEngines],
    });
  }

  public reset(): void {
    this.history.length = 0;
    this.lastAcceptedAtByKey.clear();
    this.lastHealthyEngines.clear();
    this.lastFailedEngines.clear();
    this.acceptedCount = 0;
    this.dedupedCount = 0;
    this.rejectedCount = 0;
    this.failureAlertCount = 0;
    this.lastTick = 0;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private isSignalMeaningful(signal: RegistryChatSignalCompat, healthScore: number): boolean {
    if (signal.severity !== 'info') return true;
    const uptime = signal.uptimeRatio ?? healthScore;
    return uptime < this.options.suppressInfoBelowUptimeRatio;
  }

  private isDuplicate(dedupeKey: string, now: UnixMs): boolean {
    const lastAt = this.lastAcceptedAtByKey.get(dedupeKey);
    if (lastAt === undefined) return false;
    return now - lastAt < this.options.dedupeWindowMs;
  }

  private acceptArtifact(
    artifact: RegistrySignalAdapterArtifact,
    dedupeKey: string,
    now: UnixMs,
    isFailure: boolean,
  ): void {
    this.acceptedCount++;
    this.lastAcceptedAtByKey.set(dedupeKey, now);

    const entry: RegistrySignalAdapterHistoryEntry = Object.freeze({
      at: now,
      eventName: artifact.eventName,
      tick: artifact.tick,
      engineId: artifact.engineId,
      severity: artifact.severity,
      isFailure,
      healthScore: artifact.healthScore,
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

export function createRegistrySignalAdapter(
  options: RegistrySignalAdapterOptions,
): RegistrySignalAdapter {
  return new RegistrySignalAdapter(options);
}

// ─── §2 RegistrySignalRollingWindow ───────────────────────────────────────────
/** Tracks a 60-tick rolling window of registry health metrics. */
export interface RegistryWindowSnapshot {
  readonly tick: number;
  readonly healthScore: Score01;
  readonly failedCount: number;
  readonly degradedCount: number;
  readonly fillRatio: Score01;
  readonly uptimeRatio: Score01;
  readonly capabilityCoverage: Score01;
  readonly at: UnixMs;
}

export type RegistryWindowTrend = 'DEGRADING' | 'RECOVERING' | 'STABLE';

export class RegistrySignalRollingWindow {
  private readonly capacity: number;
  private readonly snapshots: RegistryWindowSnapshot[] = [];

  public constructor(capacity: number = 60) {
    this.capacity = capacity;
  }

  public record(snap: RegistryWindowSnapshot): void {
    if (this.snapshots.length >= this.capacity) this.snapshots.shift();
    this.snapshots.push(snap);
  }

  public averageHealthScore(): Score01 {
    if (this.snapshots.length === 0) return clamp01(1) as Score01;
    const sum = this.snapshots.reduce((s, r) => s + r.healthScore, 0);
    return clamp01(sum / this.snapshots.length) as Score01;
  }

  public averageUptimeRatio(): Score01 {
    if (this.snapshots.length === 0) return clamp01(1) as Score01;
    const sum = this.snapshots.reduce((s, r) => s + r.uptimeRatio, 0);
    return clamp01(sum / this.snapshots.length) as Score01;
  }

  public totalFailures(): number {
    return this.snapshots.reduce((s, r) => s + r.failedCount, 0);
  }

  public trend(): RegistryWindowTrend {
    if (this.snapshots.length < 10) return 'STABLE';
    const half = Math.floor(this.snapshots.length / 2);
    const recentHalf = this.snapshots.slice(-half);
    const olderHalf = this.snapshots.slice(0, half);
    const recentAvg = recentHalf.reduce((s, r) => s + r.healthScore, 0) / recentHalf.length;
    const olderAvg = olderHalf.reduce((s, r) => s + r.healthScore, 0) / olderHalf.length;
    const delta = recentAvg - olderAvg;
    if (delta < -0.05) return 'DEGRADING';
    if (delta > 0.05) return 'RECOVERING';
    return 'STABLE';
  }

  public peakFailureCount(): number {
    if (this.snapshots.length === 0) return 0;
    return Math.max(...this.snapshots.map(r => r.failedCount));
  }

  public minHealthScore(): Score01 {
    if (this.snapshots.length === 0) return clamp01(1) as Score01;
    return clamp01(Math.min(...this.snapshots.map(r => r.healthScore))) as Score01;
  }

  public clear(): void { this.snapshots.length = 0; }
  public size(): number { return this.snapshots.length; }
  public latest(): RegistryWindowSnapshot | undefined {
    return this.snapshots[this.snapshots.length - 1];
  }
  public all(): ReadonlyArray<RegistryWindowSnapshot> { return this.snapshots; }
}

// ─── §3 RegistrySignalAnalytics ───────────────────────────────────────────────
/** Per-engine analytics tracker for registry signals. */
export interface RegistryEngineStats {
  readonly engineId: string;
  readonly totalSignals: number;
  readonly failureCount: number;
  readonly degradedCount: number;
  readonly recoveryCount: number;
  readonly avgHealthScore: Score01;
  readonly lastHealthScore: Score01;
  readonly lastSeenTick: number;
  readonly lastStatus: string;
  readonly failureRate: Score01;
}

export class RegistrySignalAnalytics {
  private readonly engineStats: Map<string, {
    totalSignals: number;
    failureCount: number;
    degradedCount: number;
    recoveryCount: number;
    healthScoreSum: number;
    lastHealthScore: number;
    lastSeenTick: number;
    lastStatus: string;
  }> = new Map();

  private totalProcessed = 0;
  private totalFailures = 0;

  public record(artifact: RegistrySignalAdapterArtifact): void {
    this.totalProcessed++;
    const existing = this.engineStats.get(artifact.engineId) ?? {
      totalSignals: 0,
      failureCount: 0,
      degradedCount: 0,
      recoveryCount: 0,
      healthScoreSum: 0,
      lastHealthScore: artifact.healthScore,
      lastSeenTick: artifact.tick,
      lastStatus: 'HEALTHY',
    };

    const isFailure = artifact.isFailure;
    const isDegraded = artifact.severity === 'WARN' && !isFailure;
    const isRecovery = artifact.eventName.includes('recovered');

    if (isFailure) this.totalFailures++;

    this.engineStats.set(artifact.engineId, {
      totalSignals: existing.totalSignals + 1,
      failureCount: existing.failureCount + (isFailure ? 1 : 0),
      degradedCount: existing.degradedCount + (isDegraded ? 1 : 0),
      recoveryCount: existing.recoveryCount + (isRecovery ? 1 : 0),
      healthScoreSum: existing.healthScoreSum + artifact.healthScore,
      lastHealthScore: artifact.healthScore,
      lastSeenTick: artifact.tick,
      lastStatus: artifact.isFailure ? 'FAILED' : isDegraded ? 'DEGRADED' : 'HEALTHY',
    });
  }

  public getEngineStats(engineId: string): RegistryEngineStats | undefined {
    const s = this.engineStats.get(engineId);
    if (!s) return undefined;
    const avgHealth = s.totalSignals > 0
      ? clamp01(s.healthScoreSum / s.totalSignals) as Score01
      : clamp01(1) as Score01;
    return Object.freeze({
      engineId,
      totalSignals: s.totalSignals,
      failureCount: s.failureCount,
      degradedCount: s.degradedCount,
      recoveryCount: s.recoveryCount,
      avgHealthScore: avgHealth,
      lastHealthScore: clamp01(s.lastHealthScore) as Score01,
      lastSeenTick: s.lastSeenTick,
      lastStatus: s.lastStatus,
      failureRate: clamp01(s.totalSignals > 0 ? s.failureCount / s.totalSignals : 0) as Score01,
    });
  }

  public allEngineStats(): ReadonlyArray<RegistryEngineStats> {
    return [...this.engineStats.keys()]
      .map(id => this.getEngineStats(id)!)
      .filter(Boolean);
  }

  public globalFailureRate(): Score01 {
    return clamp01(this.totalProcessed > 0 ? this.totalFailures / this.totalProcessed : 0) as Score01;
  }

  public mostUnhealthyEngine(): string | undefined {
    let worst: string | undefined;
    let worstScore = 1;
    for (const [id, s] of this.engineStats) {
      const avg = s.totalSignals > 0 ? s.healthScoreSum / s.totalSignals : 1;
      if (avg < worstScore) { worstScore = avg; worst = id; }
    }
    return worst;
  }

  public reset(): void {
    this.engineStats.clear();
    this.totalProcessed = 0;
    this.totalFailures = 0;
  }
}

// ─── §4 RegistryMLExtractor ───────────────────────────────────────────────────
/** Extracts a normalized 12-feature DL input tensor from registry signal history. */
export const REGISTRY_DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  'healthScore',
  'uptimeRatio',
  'fillRatio',
  'failureRate',
  'degradedRate',
  'recoveryRate',
  'capabilityCoverage',
  'consecutiveFailureNorm',
  'criticalGapPresence',
  'executionPlanValid',
  'failedEngineRatio',
  'trendScore',
]);

export interface RegistryDLVector {
  readonly tick: number;
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly generatedAt: UnixMs;
  readonly engineCount: number;
  readonly dominantTrend: RegistryWindowTrend;
}

export class RegistryMLExtractor {
  private readonly rollingWindow: RegistrySignalRollingWindow;
  private readonly analytics: RegistrySignalAnalytics;

  public constructor(
    rollingWindow: RegistrySignalRollingWindow,
    analytics: RegistrySignalAnalytics,
  ) {
    this.rollingWindow = rollingWindow;
    this.analytics = analytics;
  }

  public extract(tick: number, now: UnixMs): RegistryDLVector {
    const avgHealth = this.rollingWindow.averageHealthScore();
    const avgUptime = this.rollingWindow.averageUptimeRatio();
    const latest = this.rollingWindow.latest();
    const fillRatio = clamp01(latest?.fillRatio ?? 1);
    const capCoverage = clamp01(latest?.capabilityCoverage ?? 1);
    const failureRate = this.analytics.globalFailureRate();
    const allStats = this.analytics.allEngineStats();
    const totalEngines = allStats.length;
    const failedEngines = allStats.filter(s => s.lastStatus === 'FAILED').length;
    const degradedEngines = allStats.filter(s => s.lastStatus === 'DEGRADED').length;
    const recoveredEngines = allStats.filter(s => s.recoveryCount > 0).length;
    const trend = this.rollingWindow.trend();
    const trendScore = trend === 'DEGRADING' ? 0 : trend === 'RECOVERING' ? 1 : 0.5;
    const consecutiveMax = Math.max(0, ...allStats.map(() => 0));
    const criticalGap = (latest?.failedCount ?? 0) > 2 ? 1 : 0;
    const planValid = latest ? 1 : 0;

    const features: number[] = [
      avgHealth,
      avgUptime,
      fillRatio,
      failureRate,
      clamp01(totalEngines > 0 ? degradedEngines / totalEngines : 0),
      clamp01(totalEngines > 0 ? recoveredEngines / totalEngines : 0),
      capCoverage,
      clamp01(consecutiveMax / 10),
      criticalGap,
      planValid,
      clamp01(totalEngines > 0 ? failedEngines / totalEngines : 0),
      trendScore,
    ];

    return Object.freeze({
      tick,
      features: Object.freeze(features),
      labels: REGISTRY_DL_FEATURE_LABELS,
      generatedAt: now,
      engineCount: totalEngines,
      dominantTrend: trend,
    });
  }
}

// ─── §5 RegistryWatchdogPatternDetector ───────────────────────────────────────
/** Detects cross-tick registry patterns: cascading failures, capacity shrink, etc. */
export type RegistryPatternKind =
  | 'CASCADING_FAILURE'
  | 'CAPACITY_SHRINK'
  | 'RECOVERY_STALL'
  | 'INTERMITTENT_FLAP'
  | 'CAPABILITY_GAP_GROWTH';

export interface RegistryDetectedPattern {
  readonly kind: RegistryPatternKind;
  readonly detectedAtTick: number;
  readonly severity: RegistrySignalAdapterSeverity;
  readonly description: string;
  readonly affectedEngines: readonly string[];
  readonly confidence: Score01;
}

export class RegistryWatchdogPatternDetector {
  private readonly history: RegistryDetectedPattern[] = [];
  private readonly maxHistory = 50;
  private readonly failureStreak: Map<string, number> = new Map();
  private lastFillRatio = 1;
  private lastFailedCount = 0;

  public analyze(
    analytics: RegistrySignalAnalytics,
    window: RegistrySignalRollingWindow,
    tick: number,
  ): ReadonlyArray<RegistryDetectedPattern> {
    const detected: RegistryDetectedPattern[] = [];
    const allStats = analytics.allEngineStats();
    const latest = window.latest();
    const fillRatio = latest?.fillRatio ?? 1;
    const failedCount = latest?.failedCount ?? 0;

    // CASCADING_FAILURE — multiple engines failing at once
    const nowFailed = allStats.filter(s => s.lastStatus === 'FAILED');
    if (nowFailed.length >= 3) {
      detected.push(this.buildPattern(
        'CASCADING_FAILURE', tick, 'CRITICAL',
        `${nowFailed.length} engines simultaneously failed`,
        nowFailed.map(s => s.engineId),
        clamp01(nowFailed.length / Math.max(allStats.length, 1)) as Score01,
      ));
    }

    // CAPACITY_SHRINK — fill ratio dropping
    if (fillRatio < this.lastFillRatio - 0.15) {
      detected.push(this.buildPattern(
        'CAPACITY_SHRINK', tick, 'WARN',
        `Registry fill dropped from ${this.lastFillRatio.toFixed(2)} to ${fillRatio.toFixed(2)}`,
        [],
        clamp01(this.lastFillRatio - fillRatio) as Score01,
      ));
    }

    // INTERMITTENT_FLAP — engines that have both failed and recovered multiple times
    for (const stat of allStats) {
      if (stat.failureCount >= 2 && stat.recoveryCount >= 2) {
        const prev = this.failureStreak.get(stat.engineId) ?? 0;
        if (stat.failureCount > prev) {
          detected.push(this.buildPattern(
            'INTERMITTENT_FLAP', tick, 'WARN',
            `Engine ${stat.engineId} is flapping (${stat.failureCount} failures, ${stat.recoveryCount} recoveries)`,
            [stat.engineId],
            clamp01(Math.min(stat.failureCount, 5) / 5) as Score01,
          ));
        }
      }
      this.failureStreak.set(stat.engineId, stat.failureCount);
    }

    // CAPABILITY_GAP_GROWTH — failed count increasing
    if (failedCount > this.lastFailedCount + 1) {
      detected.push(this.buildPattern(
        'CAPABILITY_GAP_GROWTH', tick, 'WARN',
        `Failed engine count grew from ${this.lastFailedCount} to ${failedCount}`,
        [],
        clamp01((failedCount - this.lastFailedCount) / 5) as Score01,
      ));
    }

    this.lastFillRatio = fillRatio;
    this.lastFailedCount = failedCount;

    for (const p of detected) {
      if (this.history.length >= this.maxHistory) this.history.shift();
      this.history.push(p);
    }

    return Object.freeze(detected);
  }

  private buildPattern(
    kind: RegistryPatternKind,
    tick: number,
    severity: RegistrySignalAdapterSeverity,
    description: string,
    affectedEngines: string[],
    confidence: Score01,
  ): RegistryDetectedPattern {
    return Object.freeze({ kind, detectedAtTick: tick, severity, description, affectedEngines, confidence });
  }

  public recentPatterns(limit = 10): ReadonlyArray<RegistryDetectedPattern> {
    return this.history.slice(-limit);
  }

  public reset(): void {
    this.history.length = 0;
    this.failureStreak.clear();
    this.lastFillRatio = 1;
    this.lastFailedCount = 0;
  }
}

// ─── §6 RegistrySignalHealthTracker ───────────────────────────────────────────
/** Computes UX health grade (S/A/B/C/D/F) from registry metrics. */
export type RegistryHealthGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface RegistryHealthReport {
  readonly grade: RegistryHealthGrade;
  readonly healthScore: Score01;
  readonly uptimeRatio: Score01;
  readonly fillRatio: Score01;
  readonly failureRate: Score01;
  readonly trend: RegistryWindowTrend;
  readonly isHealthy: boolean;
  readonly isCritical: boolean;
  readonly description: string;
}

export class RegistrySignalHealthTracker {
  private readonly window: RegistrySignalRollingWindow;
  private readonly analytics: RegistrySignalAnalytics;

  public constructor(
    window: RegistrySignalRollingWindow,
    analytics: RegistrySignalAnalytics,
  ) {
    this.window = window;
    this.analytics = analytics;
  }

  public computeGrade(): RegistryHealthGrade {
    const health = this.window.averageHealthScore();
    const uptime = this.window.averageUptimeRatio();
    const failureRate = this.analytics.globalFailureRate();
    const composite = health * 0.5 + uptime * 0.3 + (1 - failureRate) * 0.2;
    if (composite >= 0.97) return 'S';
    if (composite >= 0.90) return 'A';
    if (composite >= 0.75) return 'B';
    if (composite >= 0.55) return 'C';
    if (composite >= 0.35) return 'D';
    return 'F';
  }

  public buildReport(): RegistryHealthReport {
    const healthScore = this.window.averageHealthScore();
    const uptimeRatio = this.window.averageUptimeRatio();
    const latest = this.window.latest();
    const fillRatio = clamp01(latest?.fillRatio ?? 1) as Score01;
    const failureRate = this.analytics.globalFailureRate();
    const trend = this.window.trend();
    const grade = this.computeGrade();
    const isCritical = grade === 'F' || grade === 'D';
    const isHealthy = grade === 'S' || grade === 'A' || grade === 'B';

    const descriptions: Record<RegistryHealthGrade, string> = {
      S: 'Registry operating at peak capacity — all engines healthy',
      A: 'Registry healthy with minor operational variance',
      B: 'Registry stable but showing some degradation signals',
      C: 'Registry under strain — multiple engines degraded',
      D: 'Registry critically impaired — capability gaps present',
      F: 'Registry failure state — cascading engine failures detected',
    };

    return Object.freeze({
      grade, healthScore, uptimeRatio, fillRatio, failureRate,
      trend, isHealthy, isCritical, description: descriptions[grade],
    });
  }

  public reset(): void {
    this.window.clear();
    this.analytics.reset();
  }
}

// ─── §7 RegistryNarrativeRouter ───────────────────────────────────────────────
/** Routes registry artifacts to appropriate NPC narrative channels. */
export type RegistryNarrativeChannel =
  | 'BOSS_DIALOGUE'
  | 'HELPER_CALLOUT'
  | 'SYSTEM_ALERT'
  | 'AMBIENT_COMMENT'
  | 'SILENT';

export interface RegistryNarrativeRoute {
  readonly channel: RegistryNarrativeChannel;
  readonly priority: number;
  readonly reason: string;
}

export class RegistryNarrativeRouter {
  public route(artifact: RegistrySignalAdapterArtifact): RegistryNarrativeRoute {
    if (artifact.isFailure) {
      return { channel: 'BOSS_DIALOGUE', priority: 100, reason: 'engine_failure_critical' };
    }
    if (artifact.narrativeWeight === 'CRITICAL') {
      return { channel: 'SYSTEM_ALERT', priority: 80, reason: 'registry_critical_weight' };
    }
    if (artifact.narrativeWeight === 'OPERATIONAL') {
      return { channel: 'HELPER_CALLOUT', priority: 50, reason: 'registry_operational_notice' };
    }
    if (artifact.severity === 'INFO' && artifact.healthScore > 0.85) {
      return { channel: 'SILENT', priority: 5, reason: 'healthy_info_suppressed' };
    }
    return { channel: 'AMBIENT_COMMENT', priority: 20, reason: 'registry_ambient' };
  }

  public routeBatch(
    artifacts: ReadonlyArray<RegistrySignalAdapterArtifact>,
  ): ReadonlyArray<{ artifact: RegistrySignalAdapterArtifact; route: RegistryNarrativeRoute }> {
    return artifacts
      .map(a => ({ artifact: a, route: this.route(a) }))
      .sort((a, b) => b.route.priority - a.route.priority);
  }
}

// ─── §8 RegistrySignalCorrelator ──────────────────────────────────────────────
/** Tracks cross-tick correlation IDs for registry signal chains. */
export interface RegistryCorrelationEntry {
  readonly correlationId: string;
  readonly engineId: string;
  readonly startTick: number;
  readonly lastTick: number;
  readonly signalCount: number;
  readonly maxSeverity: RegistrySignalAdapterSeverity;
}

export class RegistrySignalCorrelator {
  private readonly active: Map<string, RegistryCorrelationEntry> = new Map();
  private readonly maxActive = 100;

  public correlate(artifact: RegistrySignalAdapterArtifact): string {
    const key = `${artifact.engineId}:${artifact.eventName}`;
    const existing = this.active.get(key);
    const id = existing?.correlationId ?? `reg-${artifact.engineId}-${artifact.tick}`;

    const severityRank: Record<RegistrySignalAdapterSeverity, number> = {
      DEBUG: 0, INFO: 1, WARN: 2, CRITICAL: 3,
    };

    const maxSev = existing
      ? (severityRank[artifact.severity] > severityRank[existing.maxSeverity]
        ? artifact.severity
        : existing.maxSeverity)
      : artifact.severity;

    this.active.set(key, Object.freeze({
      correlationId: id,
      engineId: artifact.engineId,
      startTick: existing?.startTick ?? artifact.tick,
      lastTick: artifact.tick,
      signalCount: (existing?.signalCount ?? 0) + 1,
      maxSeverity: maxSev,
    }));

    if (this.active.size > this.maxActive) {
      const firstKey = this.active.keys().next().value;
      if (firstKey) this.active.delete(firstKey);
    }

    return id;
  }

  public activeCorrelations(): ReadonlyArray<RegistryCorrelationEntry> {
    return [...this.active.values()];
  }

  public reset(): void { this.active.clear(); }
}

// ─── §9 RegistrySignalBudget ──────────────────────────────────────────────────
/** Per-tick envelope budget with priority ordering for registry signals. */
export type RegistrySignalPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'BACKGROUND';

export interface RegistryBudgetedEnvelope {
  readonly envelope: ChatInputEnvelope;
  readonly priority: RegistrySignalPriority;
  readonly engineId: string;
}

const REGISTRY_PRIORITY_NUMERIC: Record<RegistrySignalPriority, number> = {
  CRITICAL: 100,
  HIGH: 75,
  MEDIUM: 50,
  LOW: 25,
  BACKGROUND: 10,
};

export class RegistrySignalBudget {
  private readonly maxPerTick: number;
  private readonly queue: RegistryBudgetedEnvelope[] = [];
  private flushedThisTick = 0;

  public constructor(maxPerTick: number = 8) {
    this.maxPerTick = maxPerTick;
  }

  public enqueue(
    envelope: ChatInputEnvelope,
    priority: RegistrySignalPriority,
    engineId: string,
  ): void {
    this.queue.push(Object.freeze({ envelope, priority, engineId }));
  }

  public flush(): ReadonlyArray<ChatInputEnvelope> {
    const sorted = [...this.queue].sort(
      (a, b) => REGISTRY_PRIORITY_NUMERIC[b.priority] - REGISTRY_PRIORITY_NUMERIC[a.priority],
    );
    const allowed = sorted.slice(0, this.maxPerTick);
    this.flushedThisTick = allowed.length;
    this.queue.length = 0;
    return Object.freeze(allowed.map(b => b.envelope));
  }

  public deriveSignalPriority(artifact: RegistrySignalAdapterArtifact): RegistrySignalPriority {
    if (artifact.isFailure) return 'CRITICAL';
    if (artifact.severity === 'WARN') return 'HIGH';
    if (artifact.narrativeWeight === 'OPERATIONAL') return 'MEDIUM';
    if (artifact.severity === 'INFO') return 'LOW';
    return 'BACKGROUND';
  }

  public stats(): { flushedThisTick: number; maxPerTick: number; pendingCount: number } {
    return { flushedThisTick: this.flushedThisTick, maxPerTick: this.maxPerTick, pendingCount: this.queue.length };
  }

  public reset(): void { this.queue.length = 0; this.flushedThisTick = 0; }
}

// ─── §10 RegistrySignalPipeline ───────────────────────────────────────────────
/** End-to-end wired pipeline: ingest → analytics → budget → flush. */
export interface RegistrySignalPipelineOptions {
  readonly roomId: ChatRoomId | string;
  readonly maxEnvelopesPerTick?: number;
  readonly dedupeWindowMs?: number;
  readonly maxHistory?: number;
}

export interface RegistrySignalPipelineResult {
  readonly tick: number;
  readonly envelopes: ReadonlyArray<ChatInputEnvelope>;
  readonly acceptedCount: number;
  readonly dedupedCount: number;
  readonly rejectedCount: number;
  readonly dlVector: RegistryDLVector;
  readonly healthReport: RegistryHealthReport;
  readonly patterns: ReadonlyArray<RegistryDetectedPattern>;
}

export class RegistrySignalPipeline {
  public readonly adapter: RegistrySignalAdapter;
  public readonly rollingWindow: RegistrySignalRollingWindow;
  public readonly analytics: RegistrySignalAnalytics;
  public readonly mlExtractor: RegistryMLExtractor;
  public readonly patternDetector: RegistryWatchdogPatternDetector;
  public readonly healthTracker: RegistrySignalHealthTracker;
  public readonly narrativeRouter: RegistryNarrativeRouter;
  public readonly correlator: RegistrySignalCorrelator;
  public readonly budget: RegistrySignalBudget;
  private readonly clock: RegistrySignalAdapterClock;

  public constructor(opts: RegistrySignalPipelineOptions) {
    this.clock = SYSTEM_CLOCK;
    this.adapter = new RegistrySignalAdapter({
      defaultRoomId: opts.roomId,
      dedupeWindowMs: opts.dedupeWindowMs ?? 5_000,
      maxHistory: opts.maxHistory ?? 200,
      alwaysEmitOnFailure: true,
    });
    this.rollingWindow = new RegistrySignalRollingWindow(60);
    this.analytics = new RegistrySignalAnalytics();
    this.mlExtractor = new RegistryMLExtractor(this.rollingWindow, this.analytics);
    this.patternDetector = new RegistryWatchdogPatternDetector();
    this.healthTracker = new RegistrySignalHealthTracker(this.rollingWindow, this.analytics);
    this.narrativeRouter = new RegistryNarrativeRouter();
    this.correlator = new RegistrySignalCorrelator();
    this.budget = new RegistrySignalBudget(opts.maxEnvelopesPerTick ?? 8);
  }

  public processTick(
    signals: ReadonlyArray<RegistryChatSignalCompat>,
    tick: number,
    report?: RegistryCapabilityReportCompat,
  ): RegistrySignalPipelineResult {
    const now = this.clock.now();
    let accepted = 0;
    let deduped = 0;
    let rejected = 0;

    // Ingest all signals
    for (const signal of signals) {
      const result = this.adapter.ingestSignal(signal, { roomId: null, source: 'pipeline' });
      if ('envelope' in result) {
        accepted++;
        this.analytics.record(result);
        const route = this.narrativeRouter.route(result);
        if (route.channel !== 'SILENT') {
          const priority = this.budget.deriveSignalPriority(result);
          this.budget.enqueue(result.envelope, priority, result.engineId);
        }
        this.correlator.correlate(result);
      } else if ('dedupeKey' in result) {
        deduped++;
      } else {
        rejected++;
      }
    }

    // Ingest health report if provided
    if (report !== undefined) {
      const rptResult = this.adapter.ingestHealthReport(report, tick);
      if ('envelope' in rptResult) {
        accepted++;
        this.analytics.record(rptResult);
        const priority = this.budget.deriveSignalPriority(rptResult);
        this.budget.enqueue(rptResult.envelope, priority, rptResult.engineId);
      }
    }

    // Record rolling window snapshot
    const latest = this.rollingWindow.latest();
    const fillRatio = clamp01(report?.registryFillRatio ?? latest?.fillRatio ?? 1) as Score01;
    const capCoverage = clamp01(report?.capabilityCoverage ?? latest?.capabilityCoverage ?? 1) as Score01;
    const allStats = this.analytics.allEngineStats();
    this.rollingWindow.record({
      tick,
      healthScore: this.analytics.allEngineStats().length > 0
        ? clamp01(allStats.reduce((s, a) => s + a.lastHealthScore, 0) / allStats.length) as Score01
        : clamp01(1) as Score01,
      failedCount: allStats.filter(s => s.lastStatus === 'FAILED').length,
      degradedCount: allStats.filter(s => s.lastStatus === 'DEGRADED').length,
      fillRatio,
      uptimeRatio: this.rollingWindow.averageUptimeRatio(),
      capabilityCoverage: capCoverage,
      at: now,
    });

    const dlVector = this.mlExtractor.extract(tick, now);
    const healthReport = this.healthTracker.buildReport();
    const patterns = this.patternDetector.analyze(this.analytics, this.rollingWindow, tick);
    const envelopes = this.budget.flush();

    return Object.freeze({
      tick,
      envelopes,
      acceptedCount: accepted,
      dedupedCount: deduped,
      rejectedCount: rejected,
      dlVector,
      healthReport,
      patterns,
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

// ─── §11 RegistrySignalFacade ─────────────────────────────────────────────────
/** High-level facade for ChatEventBridge integration. */
export class RegistrySignalFacade {
  private readonly pipeline: RegistrySignalPipeline;

  public constructor(opts: RegistrySignalPipelineOptions) {
    this.pipeline = new RegistrySignalPipeline(opts);
  }

  public onTick(
    signals: ReadonlyArray<RegistryChatSignalCompat>,
    tick: number,
    report?: RegistryCapabilityReportCompat,
  ): ReadonlyArray<ChatInputEnvelope> {
    return this.pipeline.processTick(signals, tick, report).envelopes;
  }

  public diagnostics(): Readonly<Record<string, JsonValue>> {
    const state = this.pipeline.adapter.getState();
    const healthReport = this.pipeline.healthTracker.buildReport();
    return Object.freeze({
      accepted: state.acceptedCount,
      deduped: state.dedupedCount,
      rejected: state.rejectedCount,
      failures: state.failureAlertCount,
      grade: healthReport.grade,
      trend: healthReport.trend,
      lastTick: state.lastTick,
      healthScore: parseFloat(healthReport.healthScore.toFixed(4)),
      uptimeRatio: parseFloat(healthReport.uptimeRatio.toFixed(4)),
    });
  }

  public reset(): void { this.pipeline.reset(); }
}

// ─── §12 RegistrySignalAdapterSuite ───────────────────────────────────────────
/** All components bundled together for test/dev usage. */
export class RegistrySignalAdapterSuite {
  public readonly adapter: RegistrySignalAdapter;
  public readonly pipeline: RegistrySignalPipeline;
  public readonly analytics: RegistrySignalAnalytics;
  public readonly patternDetector: RegistryWatchdogPatternDetector;
  public readonly mlExtractor: RegistryMLExtractor;
  public readonly healthTracker: RegistrySignalHealthTracker;
  public readonly correlator: RegistrySignalCorrelator;
  public readonly narrativeRouter: RegistryNarrativeRouter;
  public readonly rollingWindow: RegistrySignalRollingWindow;
  public readonly budget: RegistrySignalBudget;
  public readonly facade: RegistrySignalFacade;

  public constructor(opts: RegistrySignalPipelineOptions) {
    this.pipeline = new RegistrySignalPipeline(opts);
    this.adapter = this.pipeline.adapter;
    this.analytics = this.pipeline.analytics;
    this.patternDetector = this.pipeline.patternDetector;
    this.mlExtractor = this.pipeline.mlExtractor;
    this.healthTracker = this.pipeline.healthTracker;
    this.correlator = this.pipeline.correlator;
    this.narrativeRouter = this.pipeline.narrativeRouter;
    this.rollingWindow = this.pipeline.rollingWindow;
    this.budget = this.pipeline.budget;
    this.facade = new RegistrySignalFacade(opts);
  }

  public diagnostics(): Readonly<Record<string, JsonValue>> {
    return this.facade.diagnostics();
  }

  public reset(): void {
    this.pipeline.reset();
    this.facade.reset();
  }
}

// ─── §13 Manifest, constants, type guards, factories ──────────────────────────

export const REGISTRY_SIGNAL_ADAPTER_MANIFEST = Object.freeze({
  name: 'RegistrySignalAdapter',
  version: '2.0.0',
  surface: 'engine_registry',
  dlFeatureCount: REGISTRY_DL_FEATURE_LABELS.length,
  maxEnvelopesPerTick: 8,
  rollingWindowCapacity: 60,
  dedupeWindowMs: DEFAULT_DEDUPE_WINDOW_MS,
  exports: [
    'RegistrySignalAdapter',
    'RegistrySignalPipeline',
    'RegistrySignalFacade',
    'RegistrySignalAdapterSuite',
    'RegistrySignalAnalytics',
    'RegistryWatchdogPatternDetector',
    'RegistryMLExtractor',
    'RegistrySignalHealthTracker',
    'RegistryNarrativeRouter',
    'RegistrySignalCorrelator',
    'RegistrySignalRollingWindow',
    'RegistrySignalBudget',
  ],
} as const);

export function isRegistrySignalAdapterArtifact(
  v: unknown,
): v is RegistrySignalAdapterArtifact {
  return (
    typeof v === 'object' && v !== null &&
    'envelope' in v && 'dedupeKey' in v && 'engineId' in v &&
    'isFailure' in v && 'healthScore' in v
  );
}

export function isRegistryCapabilityReportCompat(
  v: unknown,
): v is RegistryCapabilityReportCompat {
  return typeof v === 'object' && v !== null && !('surface' in v);
}

export function isRegistryChatSignalCompat(
  v: unknown,
): v is RegistryChatSignalCompat {
  return (
    typeof v === 'object' && v !== null &&
    'surface' in v && (v as Record<string, unknown>).surface === 'engine_registry' &&
    'kind' in v && 'severity' in v && 'message' in v
  );
}

export function createRegistrySignalPipeline(
  opts: RegistrySignalPipelineOptions,
): RegistrySignalPipeline {
  return new RegistrySignalPipeline(opts);
}

export function createRegistrySignalFacade(
  opts: RegistrySignalPipelineOptions,
): RegistrySignalFacade {
  return new RegistrySignalFacade(opts);
}

export function createRegistrySignalAdapterSuite(
  opts: RegistrySignalPipelineOptions,
): RegistrySignalAdapterSuite {
  return new RegistrySignalAdapterSuite(opts);
}

// ─── §14 RegistrySignalReplayBuffer ───────────────────────────────────────────
/** Stores last N tick results for replay and debugging. */
export class RegistrySignalReplayBuffer {
  private readonly capacity: number;
  private readonly buffer: Array<{
    tick: number;
    envelopes: ReadonlyArray<ChatInputEnvelope>;
    grade: RegistryHealthGrade;
  }> = [];

  public constructor(capacity: number = 20) { this.capacity = capacity; }

  public record(tick: number, envelopes: ReadonlyArray<ChatInputEnvelope>, grade: RegistryHealthGrade): void {
    if (this.buffer.length >= this.capacity) this.buffer.shift();
    this.buffer.push({ tick, envelopes: [...envelopes], grade });
  }

  public replay(fromTick: number): ReadonlyArray<ChatInputEnvelope> {
    return this.buffer.filter(r => r.tick >= fromTick).flatMap(r => r.envelopes);
  }

  public latest(): { tick: number; envelopes: ReadonlyArray<ChatInputEnvelope>; grade: RegistryHealthGrade } | undefined {
    return this.buffer[this.buffer.length - 1];
  }

  public gradeHistory(): ReadonlyArray<RegistryHealthGrade> {
    return this.buffer.map(r => r.grade);
  }

  public clear(): void { this.buffer.length = 0; }
  public size(): number { return this.buffer.length; }
}

// ─── §15 RegistrySignalThrottleGate ───────────────────────────────────────────
/** Token-bucket throttle gate per engine channel. */
export class RegistrySignalThrottleGate {
  private readonly tokens: Map<string, number> = new Map();
  private readonly bucketMax: number;
  private readonly refillRate: number;
  private lastRefill: UnixMs = 0 as UnixMs;

  public constructor(refillRate: number = 4, bucketMax: number = 16) {
    this.refillRate = refillRate;
    this.bucketMax = bucketMax;
  }

  public shouldAllow(engineId: string, nowMs: UnixMs): boolean {
    this.maybeRefill(nowMs);
    const current = this.tokens.get(engineId) ?? this.bucketMax;
    if (current <= 0) return false;
    this.tokens.set(engineId, current - 1);
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

// ─── §16 Module constants ─────────────────────────────────────────────────────
export const REGISTRY_ADAPTER_READY = true;
export const REGISTRY_MODULE_VERSION = '2.0.0' as const;
export const REGISTRY_MAX_REPLAY_CAPACITY = 20 as const;
export const REGISTRY_THROTTLE_BUCKET_MAX = 16 as const;
export const REGISTRY_WATCHDOG_CASCADING_THRESHOLD = 3 as const;
export const REGISTRY_HEALTH_GRADE_COMPOSITE_WEIGHTS = Object.freeze({
  healthScore: 0.5,
  uptimeRatio: 0.3,
  failureRateInverse: 0.2,
} as const);

// ─── §17 RegistrySignalDiagnosticsService ─────────────────────────────────────
/** Aggregates full diagnostics across the pipeline suite for observability. */
export interface RegistryDiagnosticsSnapshot {
  readonly version: string;
  readonly healthGrade: RegistryHealthGrade;
  readonly trend: RegistryWindowTrend;
  readonly totalAccepted: number;
  readonly totalDeduped: number;
  readonly totalRejected: number;
  readonly totalFailureAlerts: number;
  readonly globalFailureRate: Score01;
  readonly avgHealthScore: Score01;
  readonly avgUptimeRatio: Score01;
  readonly activeEngineCount: number;
  readonly failedEngineCount: number;
  readonly recentPatternCount: number;
  readonly dlFeatureCount: number;
  readonly rollingWindowSize: number;
  readonly correlationCount: number;
  readonly budgetStats: { flushedThisTick: number; maxPerTick: number; pendingCount: number };
  readonly mostUnhealthyEngine: string | undefined;
  readonly engineStats: ReadonlyArray<RegistryEngineStats>;
}

export class RegistrySignalDiagnosticsService {
  private readonly pipeline: RegistrySignalPipeline;

  public constructor(pipeline: RegistrySignalPipeline) {
    this.pipeline = pipeline;
  }

  public snapshot(): RegistryDiagnosticsSnapshot {
    const state = this.pipeline.adapter.getState();
    const healthReport = this.pipeline.healthTracker.buildReport();
    const allStats = this.pipeline.analytics.allEngineStats();
    const failedCount = allStats.filter(s => s.lastStatus === 'FAILED').length;
    const recentPatterns = this.pipeline.patternDetector.recentPatterns(5);

    return Object.freeze({
      version: REGISTRY_MODULE_VERSION,
      healthGrade: healthReport.grade,
      trend: healthReport.trend,
      totalAccepted: state.acceptedCount,
      totalDeduped: state.dedupedCount,
      totalRejected: state.rejectedCount,
      totalFailureAlerts: state.failureAlertCount,
      globalFailureRate: this.pipeline.analytics.globalFailureRate(),
      avgHealthScore: this.pipeline.rollingWindow.averageHealthScore(),
      avgUptimeRatio: this.pipeline.rollingWindow.averageUptimeRatio(),
      activeEngineCount: allStats.length,
      failedEngineCount: failedCount,
      recentPatternCount: recentPatterns.length,
      dlFeatureCount: REGISTRY_DL_FEATURE_LABELS.length,
      rollingWindowSize: this.pipeline.rollingWindow.size(),
      correlationCount: this.pipeline.correlator.activeCorrelations().length,
      budgetStats: this.pipeline.budget.stats(),
      mostUnhealthyEngine: this.pipeline.analytics.mostUnhealthyEngine(),
      engineStats: allStats,
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
      totalFailureAlerts: snap.totalFailureAlerts,
      globalFailureRate: parseFloat(snap.globalFailureRate.toFixed(4)),
      avgHealthScore: parseFloat(snap.avgHealthScore.toFixed(4)),
      avgUptimeRatio: parseFloat(snap.avgUptimeRatio.toFixed(4)),
      activeEngineCount: snap.activeEngineCount,
      failedEngineCount: snap.failedEngineCount,
      recentPatternCount: snap.recentPatternCount,
      dlFeatureCount: snap.dlFeatureCount,
      rollingWindowSize: snap.rollingWindowSize,
      correlationCount: snap.correlationCount,
      mostUnhealthyEngine: snap.mostUnhealthyEngine ?? null,
    });
  }
}

// ─── §18 RegistrySignalRateController ─────────────────────────────────────────
/** Adaptive rate controller that adjusts emission rate based on registry health. */
export interface RegistryRateControllerState {
  readonly currentRate: number;
  readonly minRate: number;
  readonly maxRate: number;
  readonly lastAdjustedAtTick: number;
  readonly adjustmentReason: string;
}

export class RegistrySignalRateController {
  private currentRate: number;
  private readonly minRate: number;
  private readonly maxRate: number;
  private lastAdjustedAtTick = 0;
  private adjustmentReason = 'initial';

  public constructor(minRate: number = 1, maxRate: number = 10, initial: number = 5) {
    this.minRate = minRate;
    this.maxRate = maxRate;
    this.currentRate = Math.max(minRate, Math.min(maxRate, initial));
  }

  public adjust(healthReport: RegistryHealthReport, tick: number): void {
    const gradeToRate: Record<RegistryHealthGrade, number> = {
      S: 2,
      A: 3,
      B: 4,
      C: 6,
      D: 8,
      F: 10,
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

  public state(): RegistryRateControllerState {
    return Object.freeze({
      currentRate: this.currentRate,
      minRate: this.minRate,
      maxRate: this.maxRate,
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

// ─── §19 RegistrySignalEnvelopeValidator ──────────────────────────────────────
/** Validates registry envelopes before emission. */
export class RegistrySignalEnvelopeValidator {
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

// ─── §20 RegistrySignalUXScorer ───────────────────────────────────────────────
/** Computes a 0-100 UX quality score for the registry's chat signal output. */
export interface RegistryUXScore {
  readonly score100: Score100;
  readonly grade: RegistryHealthGrade;
  readonly isCinematic: boolean;
  readonly isRecovery: boolean;
  readonly description: string;
}

export class RegistrySignalUXScorer {
  private readonly window: RegistrySignalRollingWindow;
  private readonly analytics: RegistrySignalAnalytics;

  public constructor(
    window: RegistrySignalRollingWindow,
    analytics: RegistrySignalAnalytics,
  ) {
    this.window = window;
    this.analytics = analytics;
  }

  public score(): RegistryUXScore {
    const avgHealth = this.window.averageHealthScore();
    const avgUptime = this.window.averageUptimeRatio();
    const failureRate = this.analytics.globalFailureRate();
    const trend = this.window.trend();

    const trendBonus = trend === 'RECOVERING' ? 5 : trend === 'DEGRADING' ? -10 : 0;
    const raw = (avgHealth * 50 + avgUptime * 30 + (1 - failureRate) * 20 + trendBonus);
    const score100 = clamp100(Math.round(raw)) as Score100;

    const grade: RegistryHealthGrade =
      score100 >= 97 ? 'S' :
      score100 >= 90 ? 'A' :
      score100 >= 75 ? 'B' :
      score100 >= 55 ? 'C' :
      score100 >= 35 ? 'D' : 'F';

    const isCinematic = grade === 'S' && trend === 'RECOVERING';
    const isRecovery = trend === 'RECOVERING' && avgHealth > 0.8;

    const descriptions: Record<RegistryHealthGrade, string> = {
      S: 'Perfect registry UX — all systems green',
      A: 'Excellent registry UX — minimal disruption',
      B: 'Good registry UX — minor engine variance',
      C: 'Moderate registry UX — degraded engines visible',
      D: 'Poor registry UX — critical capacity issues',
      F: 'Registry failure — player experience severely impacted',
    };

    return Object.freeze({ score100, grade, isCinematic, isRecovery, description: descriptions[grade] });
  }
}

// ─── §21 buildRegistryAdapterDiagnostics helper ────────────────────────────────
export function buildRegistryAdapterDiagnostics(
  adapter: RegistrySignalAdapter,
  analytics: RegistrySignalAnalytics,
  healthTracker: RegistrySignalHealthTracker,
  patternDetector: RegistryWatchdogPatternDetector,
): Readonly<Record<string, JsonValue>> {
  const state = adapter.getState();
  const health = healthTracker.buildReport();
  const patterns = patternDetector.recentPatterns(5);

  return Object.freeze({
    accepted: state.acceptedCount,
    deduped: state.dedupedCount,
    rejected: state.rejectedCount,
    failures: state.failureAlertCount,
    lastTick: state.lastTick,
    grade: health.grade,
    healthScore: parseFloat(health.healthScore.toFixed(4)),
    uptimeRatio: parseFloat(health.uptimeRatio.toFixed(4)),
    trend: health.trend,
    isCritical: health.isCritical,
    isHealthy: health.isHealthy,
    globalFailureRate: parseFloat(analytics.globalFailureRate().toFixed(4)),
    recentPatterns: patterns.map(p => p.kind),
    activeEngineCount: analytics.allEngineStats().length,
    mostUnhealthyEngine: analytics.mostUnhealthyEngine() ?? null,
  });
}

// ─── §22 Full extended suite with diagnostics ─────────────────────────────────
export class RegistrySignalExtendedSuite extends RegistrySignalAdapterSuite {
  public readonly diagnosticsService: RegistrySignalDiagnosticsService;
  public readonly rateController: RegistrySignalRateController;
  public readonly validator: RegistrySignalEnvelopeValidator;
  public readonly uxScorer: RegistrySignalUXScorer;
  public readonly replayBuffer: RegistrySignalReplayBuffer;
  public readonly throttleGate: RegistrySignalThrottleGate;

  public constructor(opts: RegistrySignalPipelineOptions) {
    super(opts);
    this.diagnosticsService = new RegistrySignalDiagnosticsService(this.pipeline);
    this.rateController = new RegistrySignalRateController(1, 10, 5);
    this.validator = new RegistrySignalEnvelopeValidator();
    this.uxScorer = new RegistrySignalUXScorer(this.rollingWindow, this.analytics);
    this.replayBuffer = new RegistrySignalReplayBuffer(20);
    this.throttleGate = new RegistrySignalThrottleGate(4, 16);
  }

  public processTickExtended(
    signals: ReadonlyArray<RegistryChatSignalCompat>,
    tick: number,
    report?: RegistryCapabilityReportCompat,
  ): RegistrySignalPipelineResult & { uxScore: RegistryUXScore; diagnostics: Readonly<Record<string, JsonValue>> } {
    const result = this.pipeline.processTick(signals, tick, report);
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
    this.throttleGate.reset();
  }
}

export function createRegistrySignalExtendedSuite(
  opts: RegistrySignalPipelineOptions,
): RegistrySignalExtendedSuite {
  return new RegistrySignalExtendedSuite(opts);
}

// ─── §23 RegistrySignalChannelMapper ──────────────────────────────────────────
/** Maps registry event names to authoritative chat visible channels. */
export const REGISTRY_EVENT_CHANNEL_MAP: Readonly<Record<RegistrySignalAdapterEventName, ChatVisibleChannel>> = Object.freeze({
  'registry.engine.registered': 'GLOBAL',
  'registry.engine.health_alert': 'GLOBAL',
  'registry.engine.failed': 'GLOBAL',
  'registry.engine.recovered': 'GLOBAL',
  'registry.capability.gap': 'GLOBAL',
  'registry.validation.error': 'GLOBAL',
  'registry.watchdog.alert': 'GLOBAL',
  'registry.health.report': 'GLOBAL',
  'registry.ml.vector_emitted': 'GLOBAL',
} as Record<RegistrySignalAdapterEventName, ChatVisibleChannel>);

export function mapRegistryEventToChannel(
  eventName: RegistrySignalAdapterEventName,
): ChatVisibleChannel {
  return REGISTRY_EVENT_CHANNEL_MAP[eventName] ?? ('GLOBAL' as ChatVisibleChannel);
}

// ─── §24 RegistrySignalEventClassifier ────────────────────────────────────────
/** Classifies registry signals into operational event categories. */
export type RegistryEventCategory =
  | 'ENGINE_LIFECYCLE'
  | 'HEALTH_MONITORING'
  | 'CAPABILITY_MANAGEMENT'
  | 'VALIDATION'
  | 'ML_TELEMETRY';

export function classifyRegistryEvent(kind: RegistrySignalAdapterEventName): RegistryEventCategory {
  if (kind.includes('engine.registered') || kind.includes('engine.failed') || kind.includes('engine.recovered')) {
    return 'ENGINE_LIFECYCLE';
  }
  if (kind.includes('health')) return 'HEALTH_MONITORING';
  if (kind.includes('capability') || kind.includes('watchdog')) return 'CAPABILITY_MANAGEMENT';
  if (kind.includes('validation')) return 'VALIDATION';
  if (kind.includes('ml')) return 'ML_TELEMETRY';
  return 'HEALTH_MONITORING';
}

/** Per-category signal count tracker. */
export class RegistryEventCategoryCounter {
  private readonly counts: Map<RegistryEventCategory, number> = new Map();

  public record(kind: RegistrySignalAdapterEventName): void {
    const category = classifyRegistryEvent(kind);
    this.counts.set(category, (this.counts.get(category) ?? 0) + 1);
  }

  public countFor(category: RegistryEventCategory): number {
    return this.counts.get(category) ?? 0;
  }

  public dominantCategory(): RegistryEventCategory | undefined {
    let max = 0;
    let dominant: RegistryEventCategory | undefined;
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

// ─── §25 RegistrySignalTickSummary ────────────────────────────────────────────
/** Compact per-tick summary of registry signal processing for observability. */
export interface RegistryTickSummary {
  readonly tick: number;
  readonly at: UnixMs;
  readonly accepted: number;
  readonly rejected: number;
  readonly deduped: number;
  readonly envelopesEmitted: number;
  readonly healthGrade: RegistryHealthGrade;
  readonly trend: RegistryWindowTrend;
  readonly dominantCategory: RegistryEventCategory | undefined;
  readonly avgHealthScore: Score01;
  readonly globalFailureRate: Score01;
}

export class RegistrySignalTickSummaryBuilder {
  private readonly summaries: RegistryTickSummary[] = [];
  private readonly maxSummaries = 100;
  private readonly clock: RegistrySignalAdapterClock;

  public constructor(clock?: RegistrySignalAdapterClock) {
    this.clock = clock ?? SYSTEM_CLOCK;
  }

  public build(
    result: RegistrySignalPipelineResult,
    health: RegistryHealthReport,
    analytics: RegistrySignalAnalytics,
    categoryCounter: RegistryEventCategoryCounter,
  ): RegistryTickSummary {
    const summary: RegistryTickSummary = Object.freeze({
      tick: result.tick,
      at: this.clock.now(),
      accepted: result.acceptedCount,
      rejected: result.rejectedCount,
      deduped: result.dedupedCount,
      envelopesEmitted: result.envelopes.length,
      healthGrade: health.grade,
      trend: health.trend,
      dominantCategory: categoryCounter.dominantCategory(),
      avgHealthScore: analytics.allEngineStats().length > 0
        ? clamp01(analytics.allEngineStats().reduce((s, a) => s + a.avgHealthScore, 0) / analytics.allEngineStats().length) as Score01
        : clamp01(1) as Score01,
      globalFailureRate: analytics.globalFailureRate(),
    });

    if (this.summaries.length >= this.maxSummaries) this.summaries.shift();
    this.summaries.push(summary);
    return summary;
  }

  public recent(limit: number = 10): ReadonlyArray<RegistryTickSummary> {
    return Object.freeze(this.summaries.slice(-limit));
  }

  public clear(): void { this.summaries.length = 0; }
}

// ─── §26 Final module flag ────────────────────────────────────────────────────
export const REGISTRY_SIGNAL_ADAPTER_MODULE_READY = true;
export const REGISTRY_ADAPTER_MODULE_EXPORTS = [
  'RegistrySignalAdapter',
  'RegistrySignalPipeline',
  'RegistrySignalFacade',
  'RegistrySignalAdapterSuite',
  'RegistrySignalExtendedSuite',
  'RegistrySignalAnalytics',
  'RegistryWatchdogPatternDetector',
  'RegistryMLExtractor',
  'RegistrySignalHealthTracker',
  'RegistryNarrativeRouter',
  'RegistrySignalCorrelator',
  'RegistrySignalRollingWindow',
  'RegistrySignalBudget',
  'RegistrySignalDiagnosticsService',
  'RegistrySignalRateController',
  'RegistrySignalUXScorer',
  'RegistrySignalReplayBuffer',
  'RegistrySignalThrottleGate',
  'RegistryEventCategoryCounter',
  'RegistrySignalTickSummaryBuilder',
] as const;
