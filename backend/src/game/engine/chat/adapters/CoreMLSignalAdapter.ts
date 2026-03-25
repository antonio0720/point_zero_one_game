/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT CORE ML SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/CoreMLSignalAdapter.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Bridges the authoritative ML/DL signals emitted by `EngineOrchestrator` and
 * `EngineRuntime` (via `core/index.ts`) into backend-chat run signals.
 *
 * This adapter does NOT re-simulate or re-derive game state. It receives
 * already-scored ML summaries from the core runtime and translates their
 * urgency, cascade risk, economy health, shield health, and composite risk
 * scores into normalized `RunSnapshotCompat` payloads that the
 * `RunSignalAdapter` can consume as authoritative run-lifecycle signals.
 *
 * This is how the Core ML layer feeds the chat system at every tick:
 *
 *   OrchestratorTickResult.mlSummary
 *     -> CoreMLSignalAdapter.translateMLSummary()
 *       -> RunSnapshotCompat
 *         -> RunSignalAdapter.adaptSnapshot()
 *           -> ChatInputEnvelope (RUN_SIGNAL)
 *             -> ChatEngine ingestion
 *
 * Design laws
 * -----------
 * - Zero circular imports: this file imports only from '../types', not from
 *   any core file. The caller passes the ML summary as a plain-data object
 *   matching `CoreMLSignalInput` — a compatible subset of the core types.
 * - This adapter never owns the ML scoring logic. It only translates.
 * - Every tick ML signal is routed as a 'run.tick_ml_scored' event name so
 *   downstream chat systems can namespace it independently from lifecycle events.
 * - DL packets are translated to 'run.dl_packet' events for ML consumers.
 * ============================================================================
 */

import {
  asUnixMs,
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

// ---------------------------------------------------------------------------
// Input contracts — plain-data compatible subsets of core ML types
// These do NOT import from core/ to prevent circular imports.
// ---------------------------------------------------------------------------

/**
 * Subset of `RuntimeTickMLSummary` / `TickMLSummary` from core.
 * Callers pass the real core ML summary object — it satisfies this interface
 * structurally.
 */
export interface CoreMLSignalInput {
  readonly tick: number;
  readonly phase: string;
  readonly tier: string;
  readonly mode: string;
  readonly urgencyScore: number;
  readonly cascadeRiskScore: number;
  readonly economyHealthScore: number;
  readonly shieldHealthScore: number;
  readonly sovereigntyAlignmentScore: number;
  readonly compositeRiskScore: number;
  readonly recommendedAction: string;
  readonly mlContextVector: readonly number[];
  readonly dlInputVector: readonly number[];
}

/**
 * Subset of `RuntimeDLPacket` / `DLRoutingPacket` from core.
 */
export interface CoreDLPacketInput {
  readonly runId: string;
  readonly tick: number;
  readonly tensorShape: readonly [number, number];
  readonly inputVector: readonly number[];
  readonly featureLabels: readonly string[];
  readonly emittedAtMs: number;
}

/**
 * Context for routing a core ML signal into a chat room/channel.
 */
export interface CoreMLSignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly runId?: string | null;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface CoreMLSignalAdapterOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly dedupeWindowMs?: number;
  readonly maxHistory?: number;
  readonly urgencyThreshold?: number;
  readonly riskThreshold?: number;
}

// ---------------------------------------------------------------------------
// Severity and narrative weight maps
// ---------------------------------------------------------------------------

export type CoreMLSignalSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'CRITICAL';
export type CoreMLSignalNarrativeWeight =
  | 'AMBIENT'
  | 'TACTICAL'
  | 'RECOVERY'
  | 'CEREMONIAL'
  | 'COLLAPSE';

function classifySeverity(compositeRisk: number, urgency: number): CoreMLSignalSeverity {
  if (compositeRisk >= 0.85 || urgency >= 0.9) return 'CRITICAL';
  if (compositeRisk >= 0.6 || urgency >= 0.7) return 'WARN';
  if (compositeRisk >= 0.35 || urgency >= 0.4) return 'INFO';
  return 'DEBUG';
}

function classifyNarrativeWeight(
  recommendedAction: string,
  severity: CoreMLSignalSeverity,
): CoreMLSignalNarrativeWeight {
  if (severity === 'CRITICAL') return 'COLLAPSE';
  if (recommendedAction === 'DEFEND' || recommendedAction === 'ACCELERATE') return 'TACTICAL';
  if (recommendedAction === 'EXTEND_WINDOW' || recommendedAction === 'PLAY_CARD') return 'RECOVERY';
  if (severity === 'DEBUG') return 'AMBIENT';
  return 'CEREMONIAL';
}

// ---------------------------------------------------------------------------
// Artifact types
// ---------------------------------------------------------------------------

export interface CoreMLSignalAdapterArtifact {
  readonly eventName: string;
  readonly dedupeKey: string;
  readonly routeChannel: ChatVisibleChannel;
  readonly narrativeWeight: CoreMLSignalNarrativeWeight;
  readonly severity: CoreMLSignalSeverity;
  readonly tick: number;
  readonly urgencyScore: Score01;
  readonly compositeRiskScore: Score01;
  readonly pressure100: Score100;
  readonly recommendedAction: string;
  readonly mlContextVector: readonly number[];
  readonly envelope: ChatInputEnvelope;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface CoreMLSignalAdapterRejection {
  readonly eventName: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface CoreMLSignalAdapterReport {
  readonly accepted: readonly CoreMLSignalAdapterArtifact[];
  readonly deduped: readonly CoreMLSignalAdapterArtifact[];
  readonly rejected: readonly CoreMLSignalAdapterRejection[];
}

export interface CoreMLSignalAdapterHistoryEntry {
  readonly at: UnixMs;
  readonly eventName: string;
  readonly tick: number;
  readonly urgencyScore: Score01;
  readonly compositeRiskScore: Score01;
  readonly severity: CoreMLSignalSeverity;
  readonly dedupeKey: string;
}

export interface CoreMLSignalAdapterState {
  readonly history: readonly CoreMLSignalAdapterHistoryEntry[];
  readonly acceptedCount: number;
  readonly dedupedCount: number;
  readonly rejectedCount: number;
  readonly lastUrgency: Score01;
  readonly lastCompositeRisk: Score01;
  readonly lastTick: number;
}

// ---------------------------------------------------------------------------
// Translation helpers
// ---------------------------------------------------------------------------

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function toScore01(v: number): Score01 {
  return clamp01(v) as Score01;
}

function toScore100(v: number): Score100 {
  return Math.max(0, Math.min(100, Math.round(v * 100))) as Score100;
}

function asJsonValue(v: unknown): JsonValue {
  if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return v as JsonValue;
  }
  if (Array.isArray(v)) {
    return v.map(asJsonValue) as JsonValue;
  }
  if (typeof v === 'object') {
    const result: Record<string, JsonValue> = {};
    for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
      result[key] = asJsonValue(val);
    }
    return result as JsonValue;
  }
  return String(v) as JsonValue;
}

function buildCoreMLDedupeKey(
  runId: Nullable<string>,
  tick: number,
  recommendedAction: string,
  severity: CoreMLSignalSeverity,
): string {
  const rid = runId ?? 'unknown';
  return `core_ml:${rid}:${String(tick)}:${recommendedAction}:${severity}`;
}

function buildCoreMLEnvelope(
  eventName: string,
  signal: ChatSignalEnvelope,
  roomId: ChatRoomId | string,
  channel: ChatVisibleChannel,
  emittedAt: UnixMs,
): ChatInputEnvelope {
  return Object.freeze({
    kind: 'RUN_SIGNAL',
    roomId,
    emittedAt,
    routeChannel: channel,
    payload: signal,
    eventName,
  }) as unknown as ChatInputEnvelope;
}

function buildCoreMLSignalEnvelope(
  summary: CoreMLSignalInput,
  runId: Nullable<string>,
  severity: CoreMLSignalSeverity,
  narrativeWeight: CoreMLSignalNarrativeWeight,
): ChatSignalEnvelope {
  return Object.freeze({
    kind: 'RUN_SIGNAL',
    source: 'core.ml',
    eventName: 'run.tick_ml_scored',
    severity,
    narrativeWeight,
    tick: summary.tick,
    phase: summary.phase,
    tier: summary.tier,
    mode: summary.mode,
    runId: runId ?? null,
    urgencyScore: toScore01(summary.urgencyScore),
    cascadeRiskScore: toScore01(summary.cascadeRiskScore),
    economyHealthScore: toScore01(summary.economyHealthScore),
    shieldHealthScore: toScore01(summary.shieldHealthScore),
    sovereigntyAlignmentScore: toScore01(summary.sovereigntyAlignmentScore),
    compositeRiskScore: toScore01(summary.compositeRiskScore),
    recommendedAction: summary.recommendedAction,
    mlContextVector: [...summary.mlContextVector],
  }) as unknown as ChatSignalEnvelope;
}

function buildDLPacketSignalEnvelope(
  packet: CoreDLPacketInput,
): ChatSignalEnvelope {
  return Object.freeze({
    kind: 'RUN_SIGNAL',
    source: 'core.dl',
    eventName: 'run.dl_packet',
    tick: packet.tick,
    runId: packet.runId,
    tensorShape: [...packet.tensorShape],
    inputVector: [...packet.inputVector],
    featureCount: packet.inputVector.length,
    emittedAtMs: packet.emittedAtMs,
  }) as unknown as ChatSignalEnvelope;
}

// ---------------------------------------------------------------------------
// Main class
// ---------------------------------------------------------------------------

export class CoreMLSignalAdapter {
  private readonly defaultRoomId: ChatRoomId | string;
  private readonly defaultVisibleChannel: ChatVisibleChannel;
  private readonly dedupeWindowMs: number;
  private readonly maxHistory: number;
  private readonly urgencyThreshold: number;
  private readonly riskThreshold: number;

  private readonly history: CoreMLSignalAdapterHistoryEntry[] = [];
  private readonly dedupeMap = new Map<string, UnixMs>();
  private acceptedCount = 0;
  private dedupedCount = 0;
  private rejectedCount = 0;
  private lastUrgency: Score01 = 0 as Score01;
  private lastCompositeRisk: Score01 = 0 as Score01;
  private lastTick = 0;

  public constructor(options: CoreMLSignalAdapterOptions) {
    this.defaultRoomId = options.defaultRoomId;
    this.defaultVisibleChannel = options.defaultVisibleChannel ?? 'GLOBAL';
    this.dedupeWindowMs = options.dedupeWindowMs ?? 1_000;
    this.maxHistory = options.maxHistory ?? 200;
    this.urgencyThreshold = options.urgencyThreshold ?? 0.0; // pass all by default
    this.riskThreshold = options.riskThreshold ?? 0.0;
  }

  /**
   * Adapt a core ML tick summary into a chat signal artifact.
   * Called each tick by BackendChatAdapterSuite when the orchestrator emits
   * a TickMLSummary or RuntimeTickMLSummary.
   */
  public adaptMLSummary(
    summary: CoreMLSignalInput,
    context?: CoreMLSignalAdapterContext,
  ): CoreMLSignalAdapterReport {
    const runId = context?.runId ?? null;
    const severity = classifySeverity(summary.compositeRiskScore, summary.urgencyScore);
    const narrativeWeight = classifyNarrativeWeight(summary.recommendedAction, severity);

    // Apply thresholds — suppress ambient low-signal ticks to avoid chat spam
    if (
      summary.urgencyScore < this.urgencyThreshold &&
      summary.compositeRiskScore < this.riskThreshold
    ) {
      const rejection: CoreMLSignalAdapterRejection = {
        eventName: 'run.tick_ml_scored',
        reason: 'BELOW_THRESHOLD',
        details: {
          urgencyScore: summary.urgencyScore,
          compositeRiskScore: summary.compositeRiskScore,
          urgencyThreshold: this.urgencyThreshold,
          riskThreshold: this.riskThreshold,
        },
      };
      this.rejectedCount += 1;
      return Object.freeze({ accepted: [], deduped: [], rejected: [rejection] });
    }

    const dedupeKey = buildCoreMLDedupeKey(runId, summary.tick, summary.recommendedAction, severity);
    const nowMs = asUnixMs(Date.now());

    // Dedupe check
    const lastEmittedAt = this.dedupeMap.get(dedupeKey);
    if (lastEmittedAt !== undefined && nowMs - lastEmittedAt < this.dedupeWindowMs) {
      const artifact = this.buildArtifact(summary, runId, severity, narrativeWeight, dedupeKey, context, nowMs);
      this.dedupedCount += 1;
      return Object.freeze({ accepted: [], deduped: [artifact], rejected: [] });
    }

    this.dedupeMap.set(dedupeKey, nowMs);

    const artifact = this.buildArtifact(summary, runId, severity, narrativeWeight, dedupeKey, context, nowMs);

    this.acceptedCount += 1;
    this.lastUrgency = toScore01(summary.urgencyScore);
    this.lastCompositeRisk = toScore01(summary.compositeRiskScore);
    this.lastTick = summary.tick;

    this.addToHistory({
      at: nowMs,
      eventName: 'run.tick_ml_scored',
      tick: summary.tick,
      urgencyScore: this.lastUrgency,
      compositeRiskScore: this.lastCompositeRisk,
      severity,
      dedupeKey,
    });

    return Object.freeze({ accepted: [artifact], deduped: [], rejected: [] });
  }

  /**
   * Adapt a core DL packet into a chat signal artifact.
   * Called when the orchestrator emits a DLRoutingPacket / RuntimeDLPacket.
   */
  public adaptDLPacket(
    packet: CoreDLPacketInput,
    context?: CoreMLSignalAdapterContext,
  ): CoreMLSignalAdapterReport {
    const roomId = context?.roomId ?? this.defaultRoomId;
    const channel = context?.routeChannel ?? this.defaultVisibleChannel;
    const nowMs = asUnixMs(Date.now());

    const signal = buildDLPacketSignalEnvelope(packet);
    const envelope = buildCoreMLEnvelope('run.dl_packet', signal, roomId, channel, nowMs);

    const artifact: CoreMLSignalAdapterArtifact = {
      eventName: 'run.dl_packet',
      dedupeKey: `dl_packet:${packet.runId}:${String(packet.tick)}`,
      routeChannel: channel,
      narrativeWeight: 'AMBIENT',
      severity: 'DEBUG',
      tick: packet.tick,
      urgencyScore: 0 as Score01,
      compositeRiskScore: 0 as Score01,
      pressure100: 0 as Score100,
      recommendedAction: 'HOLD',
      mlContextVector: [],
      envelope,
      details: Object.freeze({
        runId: packet.runId,
        tick: packet.tick,
        tensorShape: asJsonValue(packet.tensorShape),
        featureCount: packet.inputVector.length,
        emittedAtMs: packet.emittedAtMs,
      }),
    };

    this.acceptedCount += 1;
    this.addToHistory({
      at: nowMs,
      eventName: 'run.dl_packet',
      tick: packet.tick,
      urgencyScore: 0 as Score01,
      compositeRiskScore: 0 as Score01,
      severity: 'DEBUG',
      dedupeKey: artifact.dedupeKey,
    });

    return Object.freeze({ accepted: [artifact], deduped: [], rejected: [] });
  }

  /**
   * Translate a CoreMLSignalInput into a `RunSnapshotCompat`-compatible
   * object that can be fed directly into `RunSignalAdapter.adaptSnapshot()`.
   *
   * This is the primary bridge used by `BackendChatAdapterSuite.adaptCoreMLSignal()`.
   */
  public static translateMLSummaryToRunSnapshot(
    summary: CoreMLSignalInput,
    runId: Nullable<string>,
  ): {
    readonly pressure: { readonly score: number; readonly tier: string; readonly band: string };
    readonly economy: { readonly netWorth: number | null };
    readonly shield: { readonly integrityRatio: number };
    readonly runId: string | null;
    readonly tick: number;
    readonly phase: string;
    readonly mode: string;
    readonly outcome: null;
  } {
    const pressure100 = Math.round(summary.urgencyScore * 100);
    const compositeRisk100 = Math.round(summary.compositeRiskScore * 100);

    return Object.freeze({
      runId: runId ?? null,
      tick: summary.tick,
      phase: summary.phase,
      mode: summary.mode,
      outcome: null,
      pressure: Object.freeze({
        score: pressure100,
        tier: summary.tier,
        band: pressure100 >= 75 ? 'HIGH' : pressure100 >= 40 ? 'MID' : 'LOW',
      }),
      economy: Object.freeze({
        netWorth: null, // not available from ML summary alone
      }),
      shield: Object.freeze({
        integrityRatio: summary.shieldHealthScore,
      }),
      _mlAnnotations: Object.freeze({
        urgencyScore: summary.urgencyScore,
        cascadeRiskScore: summary.cascadeRiskScore,
        economyHealthScore: summary.economyHealthScore,
        sovereigntyAlignmentScore: summary.sovereigntyAlignmentScore,
        compositeRiskScore: compositeRisk100 / 100,
        recommendedAction: summary.recommendedAction,
        mlContextVector: [...summary.mlContextVector],
      }),
    });
  }

  public getState(): CoreMLSignalAdapterState {
    return Object.freeze({
      history: Object.freeze([...this.history]),
      acceptedCount: this.acceptedCount,
      dedupedCount: this.dedupedCount,
      rejectedCount: this.rejectedCount,
      lastUrgency: this.lastUrgency,
      lastCompositeRisk: this.lastCompositeRisk,
      lastTick: this.lastTick,
    });
  }

  public reset(): void {
    this.history.length = 0;
    this.dedupeMap.clear();
    this.acceptedCount = 0;
    this.dedupedCount = 0;
    this.rejectedCount = 0;
    this.lastUrgency = 0 as Score01;
    this.lastCompositeRisk = 0 as Score01;
    this.lastTick = 0;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildArtifact(
    summary: CoreMLSignalInput,
    runId: Nullable<string>,
    severity: CoreMLSignalSeverity,
    narrativeWeight: CoreMLSignalNarrativeWeight,
    dedupeKey: string,
    context: CoreMLSignalAdapterContext | undefined,
    nowMs: UnixMs,
  ): CoreMLSignalAdapterArtifact {
    const roomId = context?.roomId ?? this.defaultRoomId;
    const channel = context?.routeChannel ?? this.defaultVisibleChannel;

    const signal = buildCoreMLSignalEnvelope(summary, runId, severity, narrativeWeight);
    const envelope = buildCoreMLEnvelope('run.tick_ml_scored', signal, roomId, channel, nowMs);
    const pressure100 = toScore100(summary.urgencyScore);

    return Object.freeze({
      eventName: 'run.tick_ml_scored',
      dedupeKey,
      routeChannel: channel,
      narrativeWeight,
      severity,
      tick: summary.tick,
      urgencyScore: toScore01(summary.urgencyScore),
      compositeRiskScore: toScore01(summary.compositeRiskScore),
      pressure100,
      recommendedAction: summary.recommendedAction,
      mlContextVector: Object.freeze([...summary.mlContextVector]),
      envelope,
      details: Object.freeze({
        tick: summary.tick as JsonValue,
        phase: summary.phase as JsonValue,
        tier: summary.tier as JsonValue,
        mode: summary.mode as JsonValue,
        urgencyScore: summary.urgencyScore as JsonValue,
        cascadeRiskScore: summary.cascadeRiskScore as JsonValue,
        economyHealthScore: summary.economyHealthScore as JsonValue,
        shieldHealthScore: summary.shieldHealthScore as JsonValue,
        sovereigntyAlignmentScore: summary.sovereigntyAlignmentScore as JsonValue,
        compositeRiskScore: summary.compositeRiskScore as JsonValue,
        recommendedAction: summary.recommendedAction as JsonValue,
        severity: severity as JsonValue,
        narrativeWeight: narrativeWeight as JsonValue,
      }),
    });
  }

  private addToHistory(entry: CoreMLSignalAdapterHistoryEntry): void {
    this.history.push(entry);
    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory);
    }
  }
}

// =============================================================================
// § 2 — CoreMLRollingWindow — 60-tick rolling statistics window
// =============================================================================

export interface CoreMLRollingWindowEntry {
  readonly tick: number;
  readonly urgencyScore: Score01;
  readonly compositeRiskScore: Score01;
  readonly severity: CoreMLSignalSeverity;
  readonly recommendedAction: string;
  readonly capturedAtMs: UnixMs;
}

export interface CoreMLRollingWindowStats {
  readonly windowSize: number;
  readonly avgUrgency: number;
  readonly avgCompositeRisk: number;
  readonly peakUrgency: Score01;
  readonly peakCompositeRisk: Score01;
  readonly criticalCount: number;
  readonly warnCount: number;
  readonly infoCount: number;
  readonly debugCount: number;
  readonly mostCommonAction: string;
  readonly trendDirection: 'STABLE' | 'ESCALATING' | 'RECOVERING';
  readonly volatilityScore: number;
  readonly windowDurationMs: number;
}

export class CoreMLRollingWindow {
  private readonly windowSize: number;
  private readonly entries: CoreMLRollingWindowEntry[] = [];

  public constructor(windowSize = 60) {
    this.windowSize = Math.max(1, windowSize);
  }

  public push(entry: CoreMLRollingWindowEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.windowSize) {
      this.entries.shift();
    }
  }

  public getStats(): CoreMLRollingWindowStats {
    if (this.entries.length === 0) {
      return {
        windowSize: this.windowSize,
        avgUrgency: 0, avgCompositeRisk: 0,
        peakUrgency: 0 as Score01, peakCompositeRisk: 0 as Score01,
        criticalCount: 0, warnCount: 0, infoCount: 0, debugCount: 0,
        mostCommonAction: 'HOLD', trendDirection: 'STABLE',
        volatilityScore: 0, windowDurationMs: 0,
      };
    }

    let sumUrgency = 0;
    let sumRisk = 0;
    let peakUrgency = 0;
    let peakRisk = 0;
    let criticalCount = 0;
    let warnCount = 0;
    let infoCount = 0;
    let debugCount = 0;
    const actionCounts = new Map<string, number>();

    for (const e of this.entries) {
      sumUrgency += e.urgencyScore;
      sumRisk += e.compositeRiskScore;
      if (e.urgencyScore > peakUrgency) peakUrgency = e.urgencyScore;
      if (e.compositeRiskScore > peakRisk) peakRisk = e.compositeRiskScore;
      switch (e.severity) {
        case 'CRITICAL': criticalCount++; break;
        case 'WARN':     warnCount++;     break;
        case 'INFO':     infoCount++;     break;
        case 'DEBUG':    debugCount++;    break;
      }
      actionCounts.set(e.recommendedAction, (actionCounts.get(e.recommendedAction) ?? 0) + 1);
    }

    const n = this.entries.length;
    const avgUrgency = sumUrgency / n;
    const avgRisk = sumRisk / n;

    // Trend: compare first half vs second half
    const half = Math.floor(n / 2);
    let firstHalfRisk = 0;
    let secondHalfRisk = 0;
    for (let i = 0; i < half; i++) firstHalfRisk += this.entries[i].compositeRiskScore;
    for (let i = half; i < n; i++) secondHalfRisk += this.entries[i].compositeRiskScore;
    const avgFirst = half > 0 ? firstHalfRisk / half : 0;
    const avgSecond = (n - half) > 0 ? secondHalfRisk / (n - half) : 0;
    const trendDirection: 'STABLE' | 'ESCALATING' | 'RECOVERING' =
      avgSecond - avgFirst > 0.1 ? 'ESCALATING' :
      avgFirst - avgSecond > 0.1 ? 'RECOVERING' : 'STABLE';

    // Volatility: std dev of risk scores
    const variance = this.entries.reduce((acc, e) => {
      const diff = e.compositeRiskScore - avgRisk;
      return acc + diff * diff;
    }, 0) / n;
    const volatilityScore = Math.sqrt(variance);

    let mostCommonAction = 'HOLD';
    let maxActionCount = 0;
    for (const [action, count] of actionCounts) {
      if (count > maxActionCount) { maxActionCount = count; mostCommonAction = action; }
    }

    const oldestMs = this.entries[0]?.capturedAtMs ?? 0;
    const newestMs = this.entries[n - 1]?.capturedAtMs ?? 0;
    const windowDurationMs = newestMs - oldestMs;

    return Object.freeze({
      windowSize: this.windowSize,
      avgUrgency, avgCompositeRisk: avgRisk,
      peakUrgency: peakUrgency as Score01,
      peakCompositeRisk: peakRisk as Score01,
      criticalCount, warnCount, infoCount, debugCount,
      mostCommonAction, trendDirection,
      volatilityScore, windowDurationMs,
    });
  }

  public getEntries(): readonly CoreMLRollingWindowEntry[] {
    return Object.freeze([...this.entries]);
  }

  public clear(): void {
    this.entries.length = 0;
  }

  public get size(): number { return this.entries.length; }
  public get capacity(): number { return this.windowSize; }
  public get isFull(): boolean { return this.entries.length >= this.windowSize; }
}

// =============================================================================
// § 3 — CoreMLUXScorer — UX quality from ML context every tick
// =============================================================================

export type CoreMLUXGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface CoreMLUXScore {
  readonly tick: number;
  readonly rawScore: number;
  readonly grade: CoreMLUXGrade;
  readonly urgencyContribution: number;
  readonly cascadeContribution: number;
  readonly economyContribution: number;
  readonly shieldContribution: number;
  readonly sovereigntyContribution: number;
  readonly isCinematic: boolean;
  readonly isRecovery: boolean;
  readonly narrativeLabel: string;
}

const UX_GRADE_THRESHOLDS: Record<CoreMLUXGrade, number> = {
  S: 0.92, A: 0.80, B: 0.65, C: 0.50, D: 0.35, F: 0,
};

function computeUXGrade(rawScore: number): CoreMLUXGrade {
  if (rawScore >= UX_GRADE_THRESHOLDS.S) return 'S';
  if (rawScore >= UX_GRADE_THRESHOLDS.A) return 'A';
  if (rawScore >= UX_GRADE_THRESHOLDS.B) return 'B';
  if (rawScore >= UX_GRADE_THRESHOLDS.C) return 'C';
  if (rawScore >= UX_GRADE_THRESHOLDS.D) return 'D';
  return 'F';
}

function deriveCinematic(urgency: number, cascadeRisk: number, shieldHealth: number): boolean {
  // Cinematic if high urgency + low shield health or high cascade risk
  return (urgency >= 0.8 && shieldHealth <= 0.4) ||
         (cascadeRisk >= 0.85) ||
         (urgency >= 0.9 && cascadeRisk >= 0.7);
}

function deriveRecovery(
  economyHealth: number,
  shieldHealth: number,
  sovereigntyAlignment: number,
): boolean {
  return economyHealth >= 0.7 && shieldHealth >= 0.6 && sovereigntyAlignment >= 0.6;
}

export class CoreMLUXScorer {
  private readonly history: CoreMLUXScore[] = [];
  private readonly maxHistory: number;

  public constructor(maxHistory = 100) {
    this.maxHistory = maxHistory;
  }

  public scoreMLSummary(summary: CoreMLSignalInput): CoreMLUXScore {
    const urgencyContribution = Math.min(1, summary.urgencyScore * 1.2);
    const cascadeContribution = Math.min(1, summary.cascadeRiskScore * 1.1);
    const economyContribution = summary.economyHealthScore;
    const shieldContribution = summary.shieldHealthScore;
    const sovereigntyContribution = summary.sovereigntyAlignmentScore;

    // UX is high when urgency is present (tension is good) but not catastrophic
    const tensionBonus = urgencyContribution >= 0.4 && urgencyContribution <= 0.8 ? 0.05 : 0;

    // Penalties
    const cascadePenalty = cascadeContribution >= 0.7 ? (cascadeContribution - 0.7) * 0.5 : 0;
    const shieldPenalty = shieldContribution <= 0.3 ? (0.3 - shieldContribution) * 0.4 : 0;

    const rawScore = Math.max(0, Math.min(1,
      economyContribution * 0.30 +
      shieldContribution * 0.25 +
      sovereigntyContribution * 0.20 +
      (1 - cascadeContribution) * 0.15 +
      (urgencyContribution >= 0.3 && urgencyContribution <= 0.85 ? 0.10 : 0) +
      tensionBonus -
      cascadePenalty -
      shieldPenalty,
    ));

    const grade = computeUXGrade(rawScore);
    const isCinematic = deriveCinematic(
      summary.urgencyScore, summary.cascadeRiskScore, summary.shieldHealthScore,
    );
    const isRecovery = deriveRecovery(
      summary.economyHealthScore, summary.shieldHealthScore, summary.sovereigntyAlignmentScore,
    );

    const narrativeLabel = isCinematic ? 'CINEMATIC_MOMENT' :
      isRecovery ? 'RECOVERY_SEQUENCE' :
      grade === 'S' || grade === 'A' ? 'PEAK_PERFORMANCE' :
      grade === 'F' || grade === 'D' ? 'CRISIS_STATE' : 'STANDARD_PLAY';

    const score: CoreMLUXScore = Object.freeze({
      tick: summary.tick,
      rawScore,
      grade,
      urgencyContribution,
      cascadeContribution,
      economyContribution,
      shieldContribution,
      sovereigntyContribution,
      isCinematic,
      isRecovery,
      narrativeLabel,
    });

    this.history.push(score);
    if (this.history.length > this.maxHistory) this.history.shift();

    return score;
  }

  public getAverageGrade(): CoreMLUXGrade {
    if (this.history.length === 0) return 'C';
    const avg = this.history.reduce((s, e) => s + e.rawScore, 0) / this.history.length;
    return computeUXGrade(avg);
  }

  public getHistory(): readonly CoreMLUXScore[] {
    return Object.freeze([...this.history]);
  }

  public getCinematicCount(): number {
    return this.history.filter((e) => e.isCinematic).length;
  }

  public getRecoveryCount(): number {
    return this.history.filter((e) => e.isRecovery).length;
  }

  public reset(): void {
    this.history.length = 0;
  }
}

// =============================================================================
// § 4 — CoreMLThresholdTuner — adaptive threshold self-tuning
// =============================================================================

export interface CoreMLThresholdConfig {
  readonly urgencyThreshold: number;
  readonly riskThreshold: number;
  readonly dedupeWindowMs: number;
}

export interface CoreMLThresholdAdjustment {
  readonly reason: string;
  readonly field: keyof CoreMLThresholdConfig;
  readonly oldValue: number;
  readonly newValue: number;
  readonly capturedAtMs: UnixMs;
}

export class CoreMLThresholdTuner {
  private urgencyThreshold: number;
  private riskThreshold: number;
  private dedupeWindowMs: number;
  private readonly adjustmentLog: CoreMLThresholdAdjustment[] = [];
  private readonly maxLog: number;

  public constructor(initial: CoreMLThresholdConfig, maxLog = 50) {
    this.urgencyThreshold = initial.urgencyThreshold;
    this.riskThreshold = initial.riskThreshold;
    this.dedupeWindowMs = initial.dedupeWindowMs;
    this.maxLog = maxLog;
  }

  /** Call after each window stats update to adapt thresholds. */
  public tune(stats: CoreMLRollingWindowStats, nowMs: UnixMs): void {
    // If the system is ESCALATING and many criticals, lower urgency threshold
    // to let more signals through (catch escalation early)
    if (stats.trendDirection === 'ESCALATING' && stats.criticalCount >= 3) {
      this.adjust('urgencyThreshold', Math.max(0, this.urgencyThreshold - 0.05),
        'ESCALATING_TREND_WITH_CRITICALS', nowMs);
    }

    // If RECOVERING and few criticals, raise threshold to suppress ambient noise
    if (stats.trendDirection === 'RECOVERING' && stats.criticalCount === 0) {
      this.adjust('urgencyThreshold', Math.min(0.6, this.urgencyThreshold + 0.03),
        'RECOVERY_TREND_LOW_NOISE', nowMs);
    }

    // If volatility is high, shorten dedupe window (allow more events)
    if (stats.volatilityScore > 0.3 && this.dedupeWindowMs > 500) {
      this.adjust('dedupeWindowMs', Math.max(500, this.dedupeWindowMs - 200),
        'HIGH_VOLATILITY_SHORTEN_DEDUPE', nowMs);
    }

    // If volatility is low, lengthen dedupe window (suppress repetition)
    if (stats.volatilityScore < 0.05 && this.dedupeWindowMs < 5_000) {
      this.adjust('dedupeWindowMs', Math.min(5_000, this.dedupeWindowMs + 200),
        'LOW_VOLATILITY_EXTEND_DEDUPE', nowMs);
    }
  }

  private adjust(
    field: keyof CoreMLThresholdConfig,
    newValue: number,
    reason: string,
    capturedAtMs: UnixMs,
  ): void {
    const oldValue = this[field] as number;
    if (Math.abs(newValue - oldValue) < 0.001) return;
    (this as unknown as Record<string, number>)[field] = newValue;
    const adjustment: CoreMLThresholdAdjustment = Object.freeze({
      reason, field, oldValue, newValue, capturedAtMs,
    });
    this.adjustmentLog.push(adjustment);
    if (this.adjustmentLog.length > this.maxLog) this.adjustmentLog.shift();
  }

  public getCurrent(): CoreMLThresholdConfig {
    return Object.freeze({
      urgencyThreshold: this.urgencyThreshold,
      riskThreshold: this.riskThreshold,
      dedupeWindowMs: this.dedupeWindowMs,
    });
  }

  public getLog(): readonly CoreMLThresholdAdjustment[] {
    return Object.freeze([...this.adjustmentLog]);
  }

  public reset(initial: CoreMLThresholdConfig): void {
    this.urgencyThreshold = initial.urgencyThreshold;
    this.riskThreshold = initial.riskThreshold;
    this.dedupeWindowMs = initial.dedupeWindowMs;
    this.adjustmentLog.length = 0;
  }
}

// =============================================================================
// § 5 — CoreMLNarrativeClassifier — deep narrative weight from ML vector
// =============================================================================

export type CoreMLNarrativeTone =
  | 'MENACING'
  | 'DESPERATE'
  | 'TRIUMPHANT'
  | 'RESILIENT'
  | 'NEUTRAL'
  | 'ANTICIPATORY'
  | 'COLLAPSE';

export interface CoreMLNarrativeClassification {
  readonly tone: CoreMLNarrativeTone;
  readonly weight: CoreMLSignalNarrativeWeight;
  readonly urgencyLabel: string;
  readonly phaseLabel: string;
  readonly chatNarrativePriority: number;
  readonly suppressAmbientNPC: boolean;
  readonly triggerBossDialogue: boolean;
  readonly triggerHelperCallout: boolean;
  readonly featuresUsed: readonly string[];
}

const NARRATIVE_FEATURE_LABELS = [
  'urgency', 'cascade_risk', 'economy_health', 'shield_health',
  'sovereignty_alignment', 'composite_risk',
] as const;

export class CoreMLNarrativeClassifier {
  public classify(summary: CoreMLSignalInput): CoreMLNarrativeClassification {
    const { urgencyScore, cascadeRiskScore, economyHealthScore,
            shieldHealthScore, sovereigntyAlignmentScore, compositeRiskScore,
            recommendedAction, phase } = summary;

    const tone = this.deriveTone(
      urgencyScore, cascadeRiskScore, economyHealthScore,
      shieldHealthScore, sovereigntyAlignmentScore,
    );

    const weight: CoreMLSignalNarrativeWeight =
      tone === 'COLLAPSE' || tone === 'DESPERATE' ? 'COLLAPSE' :
      tone === 'MENACING' ? 'TACTICAL' :
      tone === 'TRIUMPHANT' ? 'CEREMONIAL' :
      tone === 'RESILIENT' || tone === 'ANTICIPATORY' ? 'RECOVERY' : 'AMBIENT';

    const urgencyLabel =
      urgencyScore >= 0.85 ? 'CRITICAL_URGENCY' :
      urgencyScore >= 0.65 ? 'HIGH_URGENCY' :
      urgencyScore >= 0.4  ? 'MODERATE_URGENCY' : 'LOW_URGENCY';

    const phaseLabel = `PHASE_${phase.toUpperCase()}`;

    const chatNarrativePriority = Math.round(
      compositeRiskScore * 60 + urgencyScore * 40,
    );

    const suppressAmbientNPC = urgencyScore >= 0.7 || cascadeRiskScore >= 0.7;
    const triggerBossDialogue = urgencyScore >= 0.8 && cascadeRiskScore >= 0.6;
    const triggerHelperCallout =
      (recommendedAction === 'DEFEND' || recommendedAction === 'EXTEND_WINDOW') &&
      urgencyScore >= 0.55;

    return Object.freeze({
      tone,
      weight,
      urgencyLabel,
      phaseLabel,
      chatNarrativePriority,
      suppressAmbientNPC,
      triggerBossDialogue,
      triggerHelperCallout,
      featuresUsed: Object.freeze([...NARRATIVE_FEATURE_LABELS]),
    });
  }

  private deriveTone(
    urgency: number,
    cascadeRisk: number,
    economyHealth: number,
    shieldHealth: number,
    sovereigntyAlignment: number,
  ): CoreMLNarrativeTone {
    if (urgency >= 0.9 && cascadeRisk >= 0.8) return 'COLLAPSE';
    if (urgency >= 0.75 && shieldHealth <= 0.3) return 'DESPERATE';
    if (urgency >= 0.65 && cascadeRisk >= 0.6) return 'MENACING';
    if (economyHealth >= 0.8 && sovereigntyAlignment >= 0.75) return 'TRIUMPHANT';
    if (shieldHealth >= 0.7 && economyHealth >= 0.6) return 'RESILIENT';
    if (urgency >= 0.5 && cascadeRisk <= 0.4) return 'ANTICIPATORY';
    return 'NEUTRAL';
  }

  public buildMLVector(summary: CoreMLSignalInput): readonly number[] {
    return Object.freeze([
      summary.urgencyScore,
      summary.cascadeRiskScore,
      summary.economyHealthScore,
      summary.shieldHealthScore,
      summary.sovereigntyAlignmentScore,
      summary.compositeRiskScore,
    ]);
  }

  public static featureLabels(): readonly string[] {
    return Object.freeze([...NARRATIVE_FEATURE_LABELS]);
  }
}

// =============================================================================
// § 6 — CoreMLSignalAggregator — cross-tick signal aggregation
// =============================================================================

export interface CoreMLSignalAggregatorEntry {
  readonly tick: number;
  readonly severity: CoreMLSignalSeverity;
  readonly urgencyScore: Score01;
  readonly compositeRiskScore: Score01;
  readonly narrativeWeight: CoreMLSignalNarrativeWeight;
  readonly uxGrade: CoreMLUXGrade;
  readonly capturedAtMs: UnixMs;
}

export interface CoreMLSignalAggregatorReport {
  readonly totalTicks: number;
  readonly acceptedTicks: number;
  readonly rejectedTicks: number;
  readonly dedupedTicks: number;
  readonly avgUrgency: number;
  readonly peakUrgency: Score01;
  readonly avgCompositeRisk: number;
  readonly peakCompositeRisk: Score01;
  readonly criticalCount: number;
  readonly warnCount: number;
  readonly infoCount: number;
  readonly debugCount: number;
  readonly cinématiqueCount: number;
  readonly collapseCount: number;
  readonly ceremonialeCount: number;
  readonly recoveryCount: number;
  readonly avgUXGradeNumeric: number;
  readonly bestUXGrade: CoreMLUXGrade;
  readonly worstUXGrade: CoreMLUXGrade;
  readonly windowStats: CoreMLRollingWindowStats;
  readonly thresholds: CoreMLThresholdConfig;
}

const UX_GRADE_NUMERIC: Record<CoreMLUXGrade, number> = {
  S: 6, A: 5, B: 4, C: 3, D: 2, F: 1,
};

export class CoreMLSignalAggregator {
  private readonly window: CoreMLRollingWindow;
  private readonly tuner: CoreMLThresholdTuner;
  private readonly uxScorer: CoreMLUXScorer;
  private readonly classifier: CoreMLNarrativeClassifier;

  private totalTicks = 0;
  private acceptedTicks = 0;
  private rejectedTicks = 0;
  private dedupedTicks = 0;
  private criticalCount = 0;
  private warnCount = 0;
  private infoCount = 0;
  private debugCount = 0;
  private cinématicCount = 0;
  private collapseCount = 0;
  private ceremonialeCount = 0;
  private recoveryCount = 0;
  private readonly uxGradeHistory: CoreMLUXGrade[] = [];

  public constructor(
    initialThresholds: CoreMLThresholdConfig,
    windowSize = 60,
  ) {
    this.window = new CoreMLRollingWindow(windowSize);
    this.tuner = new CoreMLThresholdTuner(initialThresholds);
    this.uxScorer = new CoreMLUXScorer(200);
    this.classifier = new CoreMLNarrativeClassifier();
  }

  public ingestMLSummary(
    summary: CoreMLSignalInput,
    adapterReport: CoreMLSignalAdapterReport,
    nowMs: UnixMs,
  ): void {
    this.totalTicks++;
    this.acceptedTicks += adapterReport.accepted.length;
    this.rejectedTicks += adapterReport.rejected.length;
    this.dedupedTicks += adapterReport.deduped.length;

    const narrative = this.classifier.classify(summary);
    const uxScore = this.uxScorer.scoreMLSummary(summary);

    // Classify by severity
    switch (narrative.weight) {
      case 'COLLAPSE': this.collapseCount++; break;
      case 'CEREMONIAL': this.ceremonialeCount++; break;
      case 'RECOVERY': this.recoveryCount++; break;
    }

    if (uxScore.isCinematic) this.cinématicCount++;

    // Classify adapter severity
    for (const artifact of adapterReport.accepted) {
      switch (artifact.severity) {
        case 'CRITICAL': this.criticalCount++; break;
        case 'WARN':     this.warnCount++;     break;
        case 'INFO':     this.infoCount++;     break;
        case 'DEBUG':    this.debugCount++;    break;
      }
    }

    this.uxGradeHistory.push(uxScore.grade);
    if (this.uxGradeHistory.length > 200) this.uxGradeHistory.shift();

    // Push to rolling window
    this.window.push({
      tick: summary.tick,
      urgencyScore: toScore01(summary.urgencyScore),
      compositeRiskScore: toScore01(summary.compositeRiskScore),
      severity: adapterReport.accepted[0]?.severity ?? 'DEBUG',
      recommendedAction: summary.recommendedAction,
      capturedAtMs: nowMs,
    });

    // Adapt thresholds from window stats
    const stats = this.window.getStats();
    this.tuner.tune(stats, nowMs);
  }

  public buildReport(): CoreMLSignalAggregatorReport {
    const windowStats = this.window.getStats();
    const thresholds = this.tuner.getCurrent();

    const uxNumericScores = this.uxGradeHistory.map((g) => UX_GRADE_NUMERIC[g]);
    const avgUXNumeric = uxNumericScores.length > 0
      ? uxNumericScores.reduce((s, v) => s + v, 0) / uxNumericScores.length
      : 3;

    const bestUXGrade = uxNumericScores.length > 0
      ? (Object.entries(UX_GRADE_NUMERIC)
          .filter(([, v]) => v === Math.max(...uxNumericScores))[0]?.[0] ?? 'C') as CoreMLUXGrade
      : 'C';
    const worstUXGrade = uxNumericScores.length > 0
      ? (Object.entries(UX_GRADE_NUMERIC)
          .filter(([, v]) => v === Math.min(...uxNumericScores))[0]?.[0] ?? 'C') as CoreMLUXGrade
      : 'C';

    return Object.freeze({
      totalTicks: this.totalTicks,
      acceptedTicks: this.acceptedTicks,
      rejectedTicks: this.rejectedTicks,
      dedupedTicks: this.dedupedTicks,
      avgUrgency: windowStats.avgUrgency,
      peakUrgency: windowStats.peakUrgency,
      avgCompositeRisk: windowStats.avgCompositeRisk,
      peakCompositeRisk: windowStats.peakCompositeRisk,
      criticalCount: this.criticalCount,
      warnCount: this.warnCount,
      infoCount: this.infoCount,
      debugCount: this.debugCount,
      cinématiqueCount: this.cinématicCount,
      collapseCount: this.collapseCount,
      ceremonialeCount: this.ceremonialeCount,
      recoveryCount: this.recoveryCount,
      avgUXGradeNumeric: avgUXNumeric,
      bestUXGrade,
      worstUXGrade,
      windowStats,
      thresholds,
    });
  }

  public getThresholds(): CoreMLThresholdConfig {
    return this.tuner.getCurrent();
  }

  public getWindowStats(): CoreMLRollingWindowStats {
    return this.window.getStats();
  }

  public getUXScorer(): CoreMLUXScorer {
    return this.uxScorer;
  }

  public getClassifier(): CoreMLNarrativeClassifier {
    return this.classifier;
  }

  public reset(): void {
    this.totalTicks = 0;
    this.acceptedTicks = 0;
    this.rejectedTicks = 0;
    this.dedupedTicks = 0;
    this.criticalCount = 0;
    this.warnCount = 0;
    this.infoCount = 0;
    this.debugCount = 0;
    this.cinématicCount = 0;
    this.collapseCount = 0;
    this.ceremonialeCount = 0;
    this.recoveryCount = 0;
    this.uxGradeHistory.length = 0;
    this.window.clear();
  }
}

// =============================================================================
// § 7 — CoreMLDLVectorBuilder — 12-feature normalized DL input for chat routing
// =============================================================================

export const CORE_ML_DL_FEATURE_LABELS = [
  'urgency_score',
  'cascade_risk_score',
  'economy_health_score',
  'shield_health_score',
  'sovereignty_alignment_score',
  'composite_risk_score',
  'tick_normalized',
  'urgency_x_cascade',
  'economy_x_shield',
  'sovereignty_x_economy',
  'pressure_band_numeric',
  'is_critical_state',
] as const;

export type CoreMLDLFeatureLabel = typeof CORE_ML_DL_FEATURE_LABELS[number];

export interface CoreMLDLVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly tick: number;
  readonly generatedAtMs: UnixMs;
  readonly tensorShape: readonly [number, number];
}

function normalizeTick(tick: number): number {
  // Normalize tick to 0-1 using a sigmoid-like curve
  return 2 / (1 + Math.exp(-tick / 500)) - 1;
}

function tierToNumeric(tier: string): number {
  switch (tier) {
    case 'T0': return 0.0;
    case 'T1': return 0.25;
    case 'T2': return 0.5;
    case 'T3': return 0.75;
    case 'T4': return 1.0;
    default: return 0.5;
  }
}

export class CoreMLDLVectorBuilder {
  public build(summary: CoreMLSignalInput, nowMs: UnixMs): CoreMLDLVector {
    const {
      urgencyScore, cascadeRiskScore, economyHealthScore,
      shieldHealthScore, sovereigntyAlignmentScore, compositeRiskScore,
      tick, tier,
    } = summary;

    const tickNorm = normalizeTick(tick);
    const urgencyXCascade = clamp01(urgencyScore * cascadeRiskScore);
    const economyXShield = clamp01(economyHealthScore * shieldHealthScore);
    const sovereigntyXEconomy = clamp01(sovereigntyAlignmentScore * economyHealthScore);
    const pressureBandNumeric = tierToNumeric(tier);
    const isCriticalState = compositeRiskScore >= 0.75 ? 1.0 : 0.0;

    const features: readonly number[] = Object.freeze([
      clamp01(urgencyScore),
      clamp01(cascadeRiskScore),
      clamp01(economyHealthScore),
      clamp01(shieldHealthScore),
      clamp01(sovereigntyAlignmentScore),
      clamp01(compositeRiskScore),
      tickNorm,
      urgencyXCascade,
      economyXShield,
      sovereigntyXEconomy,
      pressureBandNumeric,
      isCriticalState,
    ]);

    return Object.freeze({
      features,
      labels: Object.freeze([...CORE_ML_DL_FEATURE_LABELS]),
      tick,
      generatedAtMs: nowMs as UnixMs,
      tensorShape: Object.freeze([1, features.length]) as readonly [number, number],
    });
  }

  public static featureCount(): number {
    return CORE_ML_DL_FEATURE_LABELS.length;
  }
}

// =============================================================================
// § 8 — CoreMLChatBridge — wires CoreMLSignalAdapter into the chat pipeline
// =============================================================================

export interface CoreMLChatBridgeOptions {
  readonly adapter: CoreMLSignalAdapter;
  readonly aggregator: CoreMLSignalAggregator;
  readonly uxScorer: CoreMLUXScorer;
  readonly dlVectorBuilder: CoreMLDLVectorBuilder;
  readonly narrativeClassifier: CoreMLNarrativeClassifier;
  readonly roomId: ChatRoomId | string;
  readonly emitDLVectors?: boolean;
  readonly maxEnvelopesPerTick?: number;
}

export interface CoreMLChatBridgeTickResult {
  readonly tick: number;
  readonly envelopes: readonly ChatInputEnvelope[];
  readonly uxScore: CoreMLUXScore;
  readonly dlVector: CoreMLDLVector;
  readonly narrative: CoreMLNarrativeClassification;
  readonly aggregatorReport: CoreMLSignalAggregatorReport;
  readonly hasUrgentContent: boolean;
  readonly chatNarrativePriority: number;
}

export class CoreMLChatBridge {
  private readonly adapter: CoreMLSignalAdapter;
  private readonly aggregator: CoreMLSignalAggregator;
  private readonly uxScorer: CoreMLUXScorer;
  private readonly dlVectorBuilder: CoreMLDLVectorBuilder;
  private readonly narrativeClassifier: CoreMLNarrativeClassifier;
  private readonly roomId: ChatRoomId | string;
  private readonly emitDLVectors: boolean;
  private readonly maxEnvelopesPerTick: number;

  private tickCount = 0;

  public constructor(opts: CoreMLChatBridgeOptions) {
    this.adapter = opts.adapter;
    this.aggregator = opts.aggregator;
    this.uxScorer = opts.uxScorer;
    this.dlVectorBuilder = opts.dlVectorBuilder;
    this.narrativeClassifier = opts.narrativeClassifier;
    this.roomId = opts.roomId;
    this.emitDLVectors = opts.emitDLVectors ?? false;
    this.maxEnvelopesPerTick = opts.maxEnvelopesPerTick ?? 5;
  }

  /**
   * Full-tick ingestion from the core engine ML pipeline.
   * Translates ML summary → chat envelopes + UX score + DL vector.
   */
  public processTick(
    summary: CoreMLSignalInput,
    context?: CoreMLSignalAdapterContext,
  ): CoreMLChatBridgeTickResult {
    this.tickCount++;
    const nowMs = asUnixMs(Date.now());

    const adapterReport = this.adapter.adaptMLSummary(summary, context);
    this.aggregator.ingestMLSummary(summary, adapterReport, nowMs);

    const uxScore = this.uxScorer.scoreMLSummary(summary);
    const dlVector = this.dlVectorBuilder.build(summary, nowMs);
    const narrative = this.narrativeClassifier.classify(summary);
    const aggregatorReport = this.aggregator.buildReport();

    const envelopes: ChatInputEnvelope[] = [
      ...adapterReport.accepted.map((a) => a.envelope),
    ];

    // Optionally emit DL vector as a separate envelope
    if (this.emitDLVectors && envelopes.length < this.maxEnvelopesPerTick) {
      const dlEnvelope = Object.freeze({
        kind: 'DL_VECTOR',
        roomId: this.roomId,
        emittedAt: nowMs,
        routeChannel: 'GLOBAL' as ChatVisibleChannel,
        payload: Object.freeze({
          kind: 'DL_VECTOR_SIGNAL',
          tick: summary.tick,
          features: dlVector.features,
          labels: dlVector.labels,
          tensorShape: dlVector.tensorShape,
          generatedAtMs: dlVector.generatedAtMs,
        }) as unknown as ChatSignalEnvelope,
        eventName: 'core.dl_vector',
      }) as unknown as ChatInputEnvelope;
      envelopes.push(dlEnvelope);
    }

    const hasUrgentContent = adapterReport.accepted.some(
      (a) => a.severity === 'CRITICAL' || a.severity === 'WARN',
    ) || narrative.weight === 'COLLAPSE' || narrative.triggerBossDialogue;

    return Object.freeze({
      tick: summary.tick,
      envelopes: Object.freeze(envelopes.slice(0, this.maxEnvelopesPerTick)),
      uxScore,
      dlVector,
      narrative,
      aggregatorReport,
      hasUrgentContent,
      chatNarrativePriority: narrative.chatNarrativePriority,
    });
  }

  /**
   * Process a DL packet through the bridge.
   */
  public processDLPacket(
    packet: CoreDLPacketInput,
    context?: CoreMLSignalAdapterContext,
  ): readonly ChatInputEnvelope[] {
    const report = this.adapter.adaptDLPacket(packet, context);
    return Object.freeze(report.accepted.map((a) => a.envelope));
  }

  public getTickCount(): number { return this.tickCount; }

  public buildDiagnostics(): Readonly<Record<string, JsonValue>> {
    const adapterState = this.adapter.getState();
    const aggregatorReport = this.aggregator.buildReport();
    const uxHistory = this.uxScorer.getHistory();
    const avgUXScore = uxHistory.length > 0
      ? uxHistory.reduce((s, e) => s + e.rawScore, 0) / uxHistory.length
      : 0;

    return Object.freeze({
      tickCount: this.tickCount,
      adapterAccepted: adapterState.acceptedCount,
      adapterDeduped: adapterState.dedupedCount,
      adapterRejected: adapterState.rejectedCount,
      aggregatorTotalTicks: aggregatorReport.totalTicks,
      aggregatorCriticalCount: aggregatorReport.criticalCount,
      avgUXScore: parseFloat(avgUXScore.toFixed(4)),
      uxCinematicCount: this.uxScorer.getCinematicCount(),
      uxRecoveryCount: this.uxScorer.getRecoveryCount(),
      windowTrendDirection: aggregatorReport.windowStats.trendDirection,
      windowVolatility: parseFloat(aggregatorReport.windowStats.volatilityScore.toFixed(4)),
      thresholdUrgency: aggregatorReport.thresholds.urgencyThreshold,
      thresholdRisk: aggregatorReport.thresholds.riskThreshold,
      emitDLVectors: this.emitDLVectors,
      maxEnvelopesPerTick: this.maxEnvelopesPerTick,
    });
  }

  public reset(): void {
    this.tickCount = 0;
    this.adapter.reset();
    this.aggregator.reset();
    this.uxScorer.reset();
  }
}

// =============================================================================
// § 9 — CoreMLSignalPipeline — end-to-end wired production pipeline
// =============================================================================

export interface CoreMLSignalPipelineOptions {
  readonly roomId: ChatRoomId | string;
  readonly urgencyThreshold?: number;
  readonly riskThreshold?: number;
  readonly dedupeWindowMs?: number;
  readonly rollingWindowSize?: number;
  readonly maxHistory?: number;
  readonly emitDLVectors?: boolean;
  readonly maxEnvelopesPerTick?: number;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
}

/**
 * CoreMLSignalPipeline — the single wired entry point for the core ML layer
 * feeding the backend chat system.
 *
 * Usage in backend chat orchestration:
 *
 *   const pipeline = new CoreMLSignalPipeline({ roomId: runId });
 *   // Each tick from EngineOrchestrator:
 *   const result = pipeline.processTick(orchestratorResult.mlSummary);
 *   for (const envelope of result.envelopes) {
 *     chatEngine.ingest(envelope);
 *   }
 */
export class CoreMLSignalPipeline {
  private readonly bridge: CoreMLChatBridge;
  private readonly dlVectorBuilder: CoreMLDLVectorBuilder;
  private readonly classifier: CoreMLNarrativeClassifier;

  private _isReady = false;
  private _startedAtMs: UnixMs | null = null;
  private _lastTickResult: CoreMLChatBridgeTickResult | null = null;

  public constructor(opts: CoreMLSignalPipelineOptions) {
    const adapterOpts: CoreMLSignalAdapterOptions = {
      defaultRoomId: opts.roomId,
      defaultVisibleChannel: opts.defaultVisibleChannel ?? 'GLOBAL',
      dedupeWindowMs: opts.dedupeWindowMs ?? 1_000,
      maxHistory: opts.maxHistory ?? 200,
      urgencyThreshold: opts.urgencyThreshold ?? 0,
      riskThreshold: opts.riskThreshold ?? 0,
    };
    const adapter = new CoreMLSignalAdapter(adapterOpts);

    const thresholds: CoreMLThresholdConfig = {
      urgencyThreshold: opts.urgencyThreshold ?? 0,
      riskThreshold: opts.riskThreshold ?? 0,
      dedupeWindowMs: opts.dedupeWindowMs ?? 1_000,
    };
    const aggregator = new CoreMLSignalAggregator(thresholds, opts.rollingWindowSize ?? 60);
    const uxScorer = new CoreMLUXScorer(200);
    this.dlVectorBuilder = new CoreMLDLVectorBuilder();
    this.classifier = new CoreMLNarrativeClassifier();

    this.bridge = new CoreMLChatBridge({
      adapter,
      aggregator,
      uxScorer,
      dlVectorBuilder: this.dlVectorBuilder,
      narrativeClassifier: this.classifier,
      roomId: opts.roomId,
      emitDLVectors: opts.emitDLVectors ?? false,
      maxEnvelopesPerTick: opts.maxEnvelopesPerTick ?? 5,
    });
  }

  public start(): void {
    this._isReady = true;
    this._startedAtMs = asUnixMs(Date.now());
  }

  public processTick(
    summary: CoreMLSignalInput,
    context?: CoreMLSignalAdapterContext,
  ): CoreMLChatBridgeTickResult {
    if (!this._isReady) this.start();
    this._lastTickResult = this.bridge.processTick(summary, context);
    return this._lastTickResult;
  }

  public processDLPacket(
    packet: CoreDLPacketInput,
    context?: CoreMLSignalAdapterContext,
  ): readonly ChatInputEnvelope[] {
    return this.bridge.processDLPacket(packet, context);
  }

  public getLastTickResult(): CoreMLChatBridgeTickResult | null {
    return this._lastTickResult;
  }

  public buildDiagnostics(): Readonly<Record<string, JsonValue>> {
    const bridgeDiagnostics = this.bridge.buildDiagnostics();
    return Object.freeze({
      ...bridgeDiagnostics,
      isReady: this._isReady,
      startedAtMs: this._startedAtMs ?? null,
      hasLastResult: this._lastTickResult !== null,
    });
  }

  public reset(): void {
    this.bridge.reset();
    this._isReady = false;
    this._startedAtMs = null;
    this._lastTickResult = null;
  }

  public get isReady(): boolean { return this._isReady; }
  public get tickCount(): number { return this.bridge.getTickCount(); }
  public get dlVectorFeatureCount(): number { return CoreMLDLVectorBuilder.featureCount(); }
}

// =============================================================================
// § 10 — Utility exports and factory functions
// =============================================================================

/** Clamp to [0..1] — safe for use in ML feature vectors. */
export function coreMLClamp01(v: number): Score01 {
  return Math.max(0, Math.min(1, v)) as Score01;
}

/** Clamp to [0..100] — safe for use in score100 surfaces. */
export function coreMLClamp100(v: number): Score100 {
  return Math.max(0, Math.min(100, Math.round(v))) as Score100;
}

/** Build a CoreMLSignalPipeline with sensible defaults. */
export function createCoreMLSignalPipeline(
  roomId: ChatRoomId | string,
  opts?: Partial<Omit<CoreMLSignalPipelineOptions, 'roomId'>>,
): CoreMLSignalPipeline {
  return new CoreMLSignalPipeline({ roomId, ...opts });
}

/** Build a CoreMLChatBridge from explicit component instances. */
export function createCoreMLChatBridge(
  opts: CoreMLChatBridgeOptions,
): CoreMLChatBridge {
  return new CoreMLChatBridge(opts);
}

/** Extract a normalized DL vector from a CoreMLSignalInput. */
export function extractCoreMLDLVector(
  summary: CoreMLSignalInput,
  nowMs?: number,
): CoreMLDLVector {
  const builder = new CoreMLDLVectorBuilder();
  return builder.build(summary, asUnixMs(nowMs ?? Date.now()));
}

/** Classify a CoreMLSignalInput narrative weight. */
export function classifyCoreMLNarrative(
  summary: CoreMLSignalInput,
): CoreMLNarrativeClassification {
  return new CoreMLNarrativeClassifier().classify(summary);
}

/** Score the UX quality of a CoreMLSignalInput. */
export function scoreCoreMLUX(summary: CoreMLSignalInput): CoreMLUXScore {
  return new CoreMLUXScorer().scoreMLSummary(summary);
}

/** Build a rolling window aggregated from a sequence of ML summaries. */
export function buildCoreMLRollingWindowStats(
  summaries: readonly CoreMLSignalInput[],
  windowSize?: number,
): CoreMLRollingWindowStats {
  const window = new CoreMLRollingWindow(windowSize ?? summaries.length);
  const nowMs = asUnixMs(Date.now());
  for (const s of summaries) {
    window.push({
      tick: s.tick,
      urgencyScore: coreMLClamp01(s.urgencyScore),
      compositeRiskScore: coreMLClamp01(s.compositeRiskScore),
      severity: classifySeverity(s.compositeRiskScore, s.urgencyScore),
      recommendedAction: s.recommendedAction,
      capturedAtMs: nowMs,
    });
  }
  return window.getStats();
}

/** Build a full CoreMLSignalAggregatorReport from a sequence of ML summaries. */
export function buildCoreMLAggregatorReport(
  summaries: readonly CoreMLSignalInput[],
  adapterOpts?: Partial<CoreMLSignalAdapterOptions>,
  thresholds?: Partial<CoreMLThresholdConfig>,
): CoreMLSignalAggregatorReport {
  const roomId = adapterOpts?.defaultRoomId ?? 'diagnostics';
  const opts: CoreMLSignalAdapterOptions = {
    defaultRoomId: roomId,
    defaultVisibleChannel: adapterOpts?.defaultVisibleChannel ?? 'GLOBAL',
    dedupeWindowMs: adapterOpts?.dedupeWindowMs ?? 0,
    maxHistory: adapterOpts?.maxHistory ?? 200,
    urgencyThreshold: adapterOpts?.urgencyThreshold ?? 0,
    riskThreshold: adapterOpts?.riskThreshold ?? 0,
  };
  const adapter = new CoreMLSignalAdapter(opts);
  const config: CoreMLThresholdConfig = {
    urgencyThreshold: thresholds?.urgencyThreshold ?? 0,
    riskThreshold: thresholds?.riskThreshold ?? 0,
    dedupeWindowMs: thresholds?.dedupeWindowMs ?? 0,
  };
  const aggregator = new CoreMLSignalAggregator(config, summaries.length || 1);
  const nowMs = asUnixMs(Date.now());

  for (const summary of summaries) {
    const report = adapter.adaptMLSummary(summary);
    aggregator.ingestMLSummary(summary, report, nowMs);
  }

  return aggregator.buildReport();
}

// Expose feature labels at module level
export const CORE_ML_NARRATIVE_FEATURE_LABELS = CoreMLNarrativeClassifier.featureLabels();
export const CORE_ML_DL_VECTOR_FEATURE_COUNT = CoreMLDLVectorBuilder.featureCount();

// =============================================================================
// § 11 — CoreMLDiagnosticsService — runtime health and diagnostics surface
// =============================================================================

export interface CoreMLDiagnosticsEntry {
  readonly capturedAtMs: UnixMs;
  readonly tick: number;
  readonly urgency: number;
  readonly risk: number;
  readonly narrativeTone: CoreMLNarrativeTone;
  readonly uxGrade: CoreMLUXGrade;
  readonly isCinematic: boolean;
  readonly envelopeCount: number;
  readonly thresholds: CoreMLThresholdConfig;
}

export interface CoreMLDiagnosticsReport {
  readonly entryCount: number;
  readonly avgUrgency: number;
  readonly avgRisk: number;
  readonly cinematicRatio: number;
  readonly toneDistribution: Readonly<Record<CoreMLNarrativeTone, number>>;
  readonly gradeDistribution: Readonly<Record<CoreMLUXGrade, number>>;
  readonly firstCapturedAtMs: UnixMs | null;
  readonly lastCapturedAtMs: UnixMs | null;
  readonly totalEnvelopes: number;
  readonly avgEnvelopesPerTick: number;
}

export class CoreMLDiagnosticsService {
  private readonly history: CoreMLDiagnosticsEntry[] = [];
  private readonly maxHistory: number;

  public constructor(maxHistory = 300) {
    this.maxHistory = maxHistory;
  }

  public record(
    result: CoreMLChatBridgeTickResult,
    nowMs: UnixMs,
    summary: CoreMLSignalInput,
  ): void {
    const narrative = result.narrative;
    const entry: CoreMLDiagnosticsEntry = Object.freeze({
      capturedAtMs: nowMs,
      tick: result.tick,
      urgency: summary.urgencyScore,
      risk: summary.compositeRiskScore,
      narrativeTone: narrative.tone,
      uxGrade: result.uxScore.grade,
      isCinematic: result.uxScore.isCinematic,
      envelopeCount: result.envelopes.length,
      thresholds: result.aggregatorReport.thresholds,
    });

    this.history.push(entry);
    if (this.history.length > this.maxHistory) this.history.shift();
  }

  public buildReport(): CoreMLDiagnosticsReport {
    if (this.history.length === 0) {
      const emptyTones = {} as Record<CoreMLNarrativeTone, number>;
      const emptyGrades = {} as Record<CoreMLUXGrade, number>;
      return Object.freeze({
        entryCount: 0, avgUrgency: 0, avgRisk: 0, cinematicRatio: 0,
        toneDistribution: emptyTones, gradeDistribution: emptyGrades,
        firstCapturedAtMs: null, lastCapturedAtMs: null,
        totalEnvelopes: 0, avgEnvelopesPerTick: 0,
      });
    }

    let sumUrgency = 0, sumRisk = 0, cinematicCount = 0, totalEnvelopes = 0;
    const toneCounts: Partial<Record<CoreMLNarrativeTone, number>> = {};
    const gradeCounts: Partial<Record<CoreMLUXGrade, number>> = {};

    for (const e of this.history) {
      sumUrgency += e.urgency;
      sumRisk += e.risk;
      if (e.isCinematic) cinematicCount++;
      totalEnvelopes += e.envelopeCount;
      toneCounts[e.narrativeTone] = (toneCounts[e.narrativeTone] ?? 0) + 1;
      gradeCounts[e.uxGrade] = (gradeCounts[e.uxGrade] ?? 0) + 1;
    }

    const n = this.history.length;
    return Object.freeze({
      entryCount: n,
      avgUrgency: sumUrgency / n,
      avgRisk: sumRisk / n,
      cinematicRatio: cinematicCount / n,
      toneDistribution: Object.freeze({ ...toneCounts }) as Readonly<Record<CoreMLNarrativeTone, number>>,
      gradeDistribution: Object.freeze({ ...gradeCounts }) as Readonly<Record<CoreMLUXGrade, number>>,
      firstCapturedAtMs: this.history[0]?.capturedAtMs ?? null,
      lastCapturedAtMs: this.history[n - 1]?.capturedAtMs ?? null,
      totalEnvelopes,
      avgEnvelopesPerTick: totalEnvelopes / n,
    });
  }

  public getHistory(): readonly CoreMLDiagnosticsEntry[] {
    return Object.freeze([...this.history]);
  }

  public clear(): void {
    this.history.length = 0;
  }
}

// =============================================================================
// § 12 — CoreMLAdapterSuiteManifest — stable metadata for the adapter subtree
// =============================================================================

export interface CoreMLAdapterSuiteManifest {
  readonly adapterName: 'CoreMLSignalAdapter';
  readonly version: string;
  readonly dlFeatureCount: number;
  readonly narrativeFeatureLabels: readonly string[];
  readonly dlFeatureLabels: readonly string[];
  readonly supportedGrades: readonly CoreMLUXGrade[];
  readonly supportedTones: readonly CoreMLNarrativeTone[];
  readonly supportedSeverities: readonly CoreMLSignalSeverity[];
  readonly supportedNarrativeWeights: readonly CoreMLSignalNarrativeWeight[];
}

export const CORE_ML_ADAPTER_MANIFEST: CoreMLAdapterSuiteManifest = Object.freeze({
  adapterName: 'CoreMLSignalAdapter',
  version: '2026.03.24',
  dlFeatureCount: CORE_ML_DL_VECTOR_FEATURE_COUNT,
  narrativeFeatureLabels: CORE_ML_NARRATIVE_FEATURE_LABELS,
  dlFeatureLabels: Object.freeze([...CORE_ML_DL_FEATURE_LABELS]),
  supportedGrades: Object.freeze(['S', 'A', 'B', 'C', 'D', 'F'] as const),
  supportedTones: Object.freeze([
    'MENACING', 'DESPERATE', 'TRIUMPHANT', 'RESILIENT',
    'NEUTRAL', 'ANTICIPATORY', 'COLLAPSE',
  ] as const),
  supportedSeverities: Object.freeze(['CRITICAL', 'WARN', 'INFO', 'DEBUG'] as const),
  supportedNarrativeWeights: Object.freeze([
    'AMBIENT', 'TACTICAL', 'RECOVERY', 'CEREMONIAL', 'COLLAPSE',
  ] as const),
}) satisfies CoreMLAdapterSuiteManifest;

/** Read-only accessor for the adapter manifest. */
export function getCoreMLAdapterManifest(): CoreMLAdapterSuiteManifest {
  return CORE_ML_ADAPTER_MANIFEST;
}

/** Validate a CoreMLSignalInput satisfies the structural contract. */
export function validateCoreMLSignalInput(input: unknown): input is CoreMLSignalInput {
  if (!input || typeof input !== 'object') return false;
  const i = input as Record<string, unknown>;
  return (
    typeof i.tick === 'number' &&
    typeof i.phase === 'string' &&
    typeof i.tier === 'string' &&
    typeof i.mode === 'string' &&
    typeof i.urgencyScore === 'number' &&
    typeof i.cascadeRiskScore === 'number' &&
    typeof i.economyHealthScore === 'number' &&
    typeof i.shieldHealthScore === 'number' &&
    typeof i.sovereigntyAlignmentScore === 'number' &&
    typeof i.compositeRiskScore === 'number' &&
    typeof i.recommendedAction === 'string' &&
    Array.isArray(i.mlContextVector) &&
    Array.isArray(i.dlInputVector)
  );
}

/** Validate a CoreDLPacketInput satisfies the structural contract. */
export function validateCoreDLPacketInput(input: unknown): input is CoreDLPacketInput {
  if (!input || typeof input !== 'object') return false;
  const i = input as Record<string, unknown>;
  return (
    typeof i.runId === 'string' &&
    typeof i.tick === 'number' &&
    Array.isArray(i.tensorShape) &&
    Array.isArray(i.inputVector) &&
    Array.isArray(i.featureLabels) &&
    typeof i.emittedAtMs === 'number'
  );
}

// =============================================================================
// § 13 — CoreMLSignalBudget — per-tick envelope budget management
// =============================================================================

export interface CoreMLSignalBudgetPolicy {
  readonly maxEnvelopesPerTick: number;
  readonly priorityCritical: number;
  readonly priorityWarn: number;
  readonly priorityInfo: number;
  readonly priorityDebug: number;
}

export const DEFAULT_CORE_ML_BUDGET_POLICY: CoreMLSignalBudgetPolicy = Object.freeze({
  maxEnvelopesPerTick: 5,
  priorityCritical: 100,
  priorityWarn: 60,
  priorityInfo: 30,
  priorityDebug: 5,
});

export interface CoreMLBudgetEntry {
  readonly envelope: ChatInputEnvelope;
  readonly priority: number;
  readonly severity: CoreMLSignalSeverity;
  readonly tick: number;
}

/**
 * CoreMLSignalBudget — enforces per-tick envelope caps with priority queuing.
 * Critical signals are always emitted first; debug signals are dropped when
 * the budget is exhausted.
 */
export class CoreMLSignalBudget {
  private readonly policy: CoreMLSignalBudgetPolicy;
  private readonly queue: CoreMLBudgetEntry[] = [];
  private droppedCount = 0;
  private totalEmitted = 0;

  public constructor(policy: CoreMLSignalBudgetPolicy = DEFAULT_CORE_ML_BUDGET_POLICY) {
    this.policy = policy;
  }

  public enqueue(
    envelope: ChatInputEnvelope,
    severity: CoreMLSignalSeverity,
    tick: number,
  ): void {
    const priority =
      severity === 'CRITICAL' ? this.policy.priorityCritical :
      severity === 'WARN'     ? this.policy.priorityWarn     :
      severity === 'INFO'     ? this.policy.priorityInfo     :
      this.policy.priorityDebug;

    this.queue.push({ envelope, priority, severity, tick });
    // Keep sorted by priority descending
    this.queue.sort((a, b) => b.priority - a.priority);
  }

  public flush(): readonly ChatInputEnvelope[] {
    const budget = this.policy.maxEnvelopesPerTick;
    const emitted = this.queue.splice(0, budget);
    const dropped = this.queue.splice(0); // everything over budget is dropped

    this.totalEmitted += emitted.length;
    this.droppedCount += dropped.length;
    this.queue.length = 0;

    return Object.freeze(emitted.map((e) => e.envelope));
  }

  public get totalDropped(): number { return this.droppedCount; }
  public get totalEmittedCount(): number { return this.totalEmitted; }
  public get queueDepth(): number { return this.queue.length; }

  public reset(): void {
    this.queue.length = 0;
    this.droppedCount = 0;
    this.totalEmitted = 0;
  }
}

/** Build a CoreMLSignalBudget with a custom max envelope count. */
export function createCoreMLSignalBudget(
  maxEnvelopesPerTick: number,
  overrides?: Partial<CoreMLSignalBudgetPolicy>,
): CoreMLSignalBudget {
  return new CoreMLSignalBudget({
    ...DEFAULT_CORE_ML_BUDGET_POLICY,
    maxEnvelopesPerTick,
    ...overrides,
  });
}

// =============================================================================
// § 14 — Module-level constants for downstream consumers
// =============================================================================

/** Maximum ticks a core ML signal can sit in a dedupe window before expiry. */
export const CORE_ML_MAX_DEDUPE_WINDOW_MS = 10_000;

/** Minimum urgency score that guarantees a CRITICAL severity classification. */
export const CORE_ML_CRITICAL_URGENCY_THRESHOLD = 0.85;

/** Minimum composite risk score for COLLAPSE narrative weight. */
export const CORE_ML_COLLAPSE_RISK_THRESHOLD = 0.9;

/** Recommended rolling window size for stable trend detection. */
export const CORE_ML_RECOMMENDED_WINDOW_SIZE = 60;

/** DL input vector length: must match CORE_ML_DL_FEATURE_LABELS.length. */
export const CORE_ML_DL_INPUT_VECTOR_LENGTH = CORE_ML_DL_VECTOR_FEATURE_COUNT;

/**
 * Surface identifier used in ChatSignalEnvelope.source for all core ML signals.
 * Downstream chat moderation can filter on this constant.
 */
export const CORE_ML_SIGNAL_SURFACE = 'core.ml' as const;
