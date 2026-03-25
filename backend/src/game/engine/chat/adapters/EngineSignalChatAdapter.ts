/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT ENGINE SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/EngineSignalChatAdapter.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Bridges the authoritative `EngineSignal`, `EngineMLSignal`, and window
 * diagnostics emitted by the 7 simulation engines into backend-chat signals.
 *
 * This adapter is the last-mile translator between the engine contracts layer
 * and the chat system. It receives:
 *
 *  - EngineSignal      — per-tick signals from any of the 7 engines
 *  - EngineMLSignal    — ML-enriched risk signals with classification
 *  - SignalAggregatorReport — aggregated tick signal summary
 *  - WindowMLContext   — decision window ML state for urgency routing
 *
 * And converts them into `ChatInputEnvelope` / `ChatSignalEnvelope` payloads
 * that the backend chat engine can consume for:
 *  - AI companion commentary
 *  - Urgency overlays
 *  - Boss telegraph chat messages
 *  - Phase/tier crossing announcements
 *
 * Design laws
 * -----------
 * - Zero circular imports: uses structurally compatible input interfaces
 *   instead of importing from core/. TypeScript structural typing handles the
 *   compatibility guarantee at the call site.
 * - Signals with severity 'INFO' are routed as background context.
 * - Signals with severity 'WARN' trigger narrative escalation.
 * - Signals with severity 'ERROR' trigger urgent chat interruptions.
 * - ML-classified signals are further graded by mlClass:
 *     critical_risk → BATTLE_SIGNAL (high urgency)
 *     high_risk     → RUN_SIGNAL (moderate urgency)
 *     moderate_risk → RUN_SIGNAL (low urgency)
 *     nominal       → background suppressed
 * - Window urgency scores ≥ 0.85 trigger anticipatory chat signals.
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

// ─────────────────────────────────────────────────────────────────────────────
// Input contracts — structural compatibility types (no core/ imports)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Structurally compatible subset of `EngineSignal` from EngineContracts.
 * Callers pass the real EngineSignal — it satisfies this interface.
 */
export interface EngineSignalInput {
  readonly engineId: string;
  readonly severity: 'INFO' | 'WARN' | 'ERROR';
  readonly code: string;
  readonly message: string;
  readonly tick: number;
  readonly tags?: readonly string[];
  readonly category?: string;
  readonly stepMs?: number;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Structurally compatible subset of `EngineMLSignal` from EngineContracts.
 * Carries the ML risk classification on top of the base signal.
 */
export interface EngineMLSignalInput extends EngineSignalInput {
  readonly riskScore: number;
  readonly urgencyScore: number;
  readonly mlClass: string;
  readonly featureSnapshot: readonly number[];
  readonly actionRecommendation: string;
}

/**
 * Structurally compatible subset of `SignalAggregatorReport` from EngineContracts.
 */
export interface EngineSignalAggregatorInput {
  readonly tick: number;
  readonly totalSignals: number;
  readonly byEngine: Record<string, number>;
  readonly bySeverity: { INFO: number; WARN: number; ERROR: number };
  readonly hasErrors: boolean;
  readonly hasWarnings: boolean;
}

/**
 * Structurally compatible subset of `WindowMLContext` from DecisionWindowService.
 */
export interface WindowMLContextInput {
  readonly tick: number;
  readonly urgencyScore: number;
  readonly hasExclusiveWindow: boolean;
  readonly hasEndgameWindow: boolean;
  readonly openWindowCount: number;
  readonly consumptionRate: number;
  readonly phaseName: string;
  readonly tierName: string;
  readonly vector: { readonly features: readonly number[] };
  readonly predictions: ReadonlyArray<{
    readonly timingClass: string;
    readonly estimatedTick: number;
    readonly confidence: string;
    readonly reason: string;
    readonly urgencyIfOpened: number;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter types
// ─────────────────────────────────────────────────────────────────────────────

export interface EngineSignalChatAdapterOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly suppressInfoSignals?: boolean;
  readonly mlClassThreshold?: string;
  readonly windowUrgencyThreshold?: number;
  readonly maxEnvelopesPerBatch?: number;
}

export interface EngineSignalChatAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly runId?: string | null;
  readonly userId?: string | null;
  readonly emittedAt?: number;
  readonly tags?: readonly string[];
}

/** A single translated engine signal artifact. */
export interface EngineSignalChatArtifact {
  readonly engineId: string;
  readonly severity: 'INFO' | 'WARN' | 'ERROR';
  readonly code: string;
  readonly tick: number;
  readonly routeChannel: ChatVisibleChannel;
  readonly envelope: ChatInputEnvelope;
  readonly signal: ChatSignalEnvelope;
  readonly mlEnriched: boolean;
  readonly riskScore: number;
  readonly urgencyScore: number;
}

/** Tracks per-engine signal counts. */
export interface EngineSignalChatAdapterEngineCounters {
  readonly accepted: number;
  readonly suppressed: number;
  readonly errors: number;
  readonly warnings: number;
  readonly mlEnriched: number;
}

/** Serializable state of the adapter. */
export interface EngineSignalChatAdapterState {
  readonly totalAccepted: number;
  readonly totalSuppressed: number;
  readonly totalWindowSignals: number;
  readonly totalAggregatorSignals: number;
  readonly byEngine: Record<string, EngineSignalChatAdapterEngineCounters>;
  readonly lastTick: number;
  readonly lastSignalCode: string | null;
}

/** Report from a single adapt call. */
export interface EngineSignalChatAdapterReport {
  readonly accepted: readonly EngineSignalChatArtifact[];
  readonly suppressed: number;
  readonly tick: number;
  readonly hasUrgentSignal: boolean;
  readonly peakRiskScore: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Severity → narrative weight mapping. */
const SEVERITY_NARRATIVE_WEIGHT: Record<'INFO' | 'WARN' | 'ERROR', string> = {
  INFO:  'BACKGROUND',
  WARN:  'MODERATE',
  ERROR: 'HIGH',
};

/** ML class → channel routing. */
const ML_CLASS_CHANNEL: Record<string, ChatVisibleChannel> = {
  critical_risk:  'GLOBAL',
  high_risk:      'GLOBAL',
  moderate_risk:  'GLOBAL',
  low_risk:       'GLOBAL',
  nominal:        'GLOBAL',
  opportunity:    'GLOBAL',
};

/** Build a ChatSignalEnvelope for an engine signal. */
function buildEngineSignalChatEnvelope(
  artifact: EngineSignalInput,
  runId: Nullable<string>,
  nowMs: UnixMs,
  narrativeWeight: string,
): ChatSignalEnvelope {
  return Object.freeze({
    kind: 'ENGINE_SIGNAL',
    engineId: artifact.engineId,
    severity: artifact.severity,
    code: artifact.code,
    message: artifact.message,
    tick: artifact.tick,
    tags: artifact.tags ?? [],
    category: artifact.category ?? 'tick',
    stepMs: artifact.stepMs ?? 0,
    runId: runId ?? null,
    narrativeWeight,
    emittedAt: nowMs,
  }) as unknown as ChatSignalEnvelope;
}

/** Build a ChatInputEnvelope wrapping an engine signal. */
function buildEngineSignalInputEnvelope(
  signal: ChatSignalEnvelope,
  nowMs: UnixMs,
  roomId: ChatRoomId | string,
  channel: ChatVisibleChannel,
): ChatInputEnvelope {
  return Object.freeze({
    kind: 'RUN_SIGNAL',
    payload: signal,
    emittedAt: nowMs,
    roomId,
    routeChannel: channel,
    source: 'engine-signal-adapter',
  }) as unknown as ChatInputEnvelope;
}

/** Route a signal to the appropriate chat channel based on severity + ML class. */
function routeEngineSignal(
  severity: 'INFO' | 'WARN' | 'ERROR',
  mlClass: string | undefined,
  defaultChannel: ChatVisibleChannel,
): ChatVisibleChannel {
  if (mlClass && ML_CLASS_CHANNEL[mlClass]) {
    return ML_CLASS_CHANNEL[mlClass];
  }
  if (severity === 'ERROR') return 'GLOBAL';
  if (severity === 'WARN') return 'GLOBAL';
  return defaultChannel;
}

/** Build a ChatSignalEnvelope for a window urgency signal. */
function buildWindowUrgencySignal(
  ctx: WindowMLContextInput,
  runId: Nullable<string>,
  nowMs: UnixMs,
): ChatSignalEnvelope {
  return Object.freeze({
    kind: 'WINDOW_URGENCY',
    tick: ctx.tick,
    urgencyScore: ctx.urgencyScore,
    openWindowCount: ctx.openWindowCount,
    hasEndgameWindow: ctx.hasEndgameWindow,
    hasExclusiveWindow: ctx.hasExclusiveWindow,
    consumptionRate: ctx.consumptionRate,
    phaseName: ctx.phaseName,
    tierName: ctx.tierName,
    predictedCount: ctx.predictions.length,
    runId: runId ?? null,
    emittedAt: nowMs,
    narrativeWeight: ctx.urgencyScore >= 0.9 ? 'CRITICAL' : 'HIGH',
  }) as unknown as ChatSignalEnvelope;
}

/** Build a ChatSignalEnvelope for a tick signal aggregator. */
function buildAggregatorSignal(
  report: EngineSignalAggregatorInput,
  runId: Nullable<string>,
  nowMs: UnixMs,
): ChatSignalEnvelope {
  return Object.freeze({
    kind: 'ENGINE_TICK_SUMMARY',
    tick: report.tick,
    totalSignals: report.totalSignals,
    errorCount: report.bySeverity.ERROR,
    warnCount: report.bySeverity.WARN,
    infoCount: report.bySeverity.INFO,
    hasErrors: report.hasErrors,
    hasWarnings: report.hasWarnings,
    activeEngines: Object.keys(report.byEngine).length,
    runId: runId ?? null,
    emittedAt: nowMs,
    narrativeWeight: report.hasErrors ? 'HIGH' : report.hasWarnings ? 'MODERATE' : 'BACKGROUND',
  }) as unknown as ChatSignalEnvelope;
}

// ─────────────────────────────────────────────────────────────────────────────
// EngineSignalChatAdapter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EngineSignalChatAdapter — translates engine contract signals into backend
 * chat-compatible signal envelopes.
 *
 * This is the authoritative bridge from the engine's structural signals to
 * the chat system's ingestion surface. It operates per-tick and accumulates
 * state for diagnostics and downstream analytics.
 *
 * User experience impact:
 * - ERROR signals → immediate urgent chat message (e.g., "The engine has detected
 *   a critical threat — act now")
 * - WARN + high mlClass → escalating narrative tension commentary
 * - Window urgency ≥ 0.85 → anticipatory play suggestion from AI companion
 * - Endgame window → special "final seconds" countdown commentary
 *
 * Integration pattern:
 *   const adapter = new EngineSignalChatAdapter({ defaultRoomId: runId });
 *   const report = adapter.adaptEngineSignals(signals, { runId });
 *   for (const artifact of report.accepted) {
 *     chatEngine.ingest(artifact.envelope);
 *   }
 */
export class EngineSignalChatAdapter {
  private _totalAccepted = 0;
  private _totalSuppressed = 0;
  private _totalWindowSignals = 0;
  private _totalAggregatorSignals = 0;
  private _byEngine = new Map<string, {
    accepted: number; suppressed: number; errors: number; warnings: number; mlEnriched: number;
  }>();
  private _lastTick = 0;
  private _lastSignalCode: string | null = null;

  private readonly _defaultRoomId: ChatRoomId | string;
  private readonly _defaultVisibleChannel: ChatVisibleChannel;
  private readonly _suppressInfoSignals: boolean;
  private readonly _windowUrgencyThreshold: number;
  private readonly _maxEnvelopesPerBatch: number;

  constructor(opts: EngineSignalChatAdapterOptions) {
    this._defaultRoomId = opts.defaultRoomId;
    this._defaultVisibleChannel = opts.defaultVisibleChannel ?? 'GLOBAL';
    this._suppressInfoSignals = opts.suppressInfoSignals ?? true;
    this._windowUrgencyThreshold = opts.windowUrgencyThreshold ?? 0.75;
    this._maxEnvelopesPerBatch = opts.maxEnvelopesPerBatch ?? 50;
  }

  // ── Per-engine counter helpers ─────────────────────────────────────────────

  private _getCounters(engineId: string) {
    if (!this._byEngine.has(engineId)) {
      this._byEngine.set(engineId, { accepted: 0, suppressed: 0, errors: 0, warnings: 0, mlEnriched: 0 });
    }
    return this._byEngine.get(engineId)!;
  }

  private _recordAccepted(engineId: string, severity: 'INFO' | 'WARN' | 'ERROR', mlEnriched: boolean): void {
    const c = this._getCounters(engineId);
    c.accepted++;
    if (severity === 'ERROR') c.errors++;
    if (severity === 'WARN') c.warnings++;
    if (mlEnriched) c.mlEnriched++;
    this._totalAccepted++;
  }

  private _recordSuppressed(engineId: string): void {
    const c = this._getCounters(engineId);
    c.suppressed++;
    this._totalSuppressed++;
  }

  // ── Core adaptation methods ────────────────────────────────────────────────

  /**
   * Translate a single EngineSignal into a chat artifact.
   * Returns null if the signal is suppressed (INFO when suppressInfo is on).
   */
  adaptEngineSignal(
    signal: EngineSignalInput,
    context?: EngineSignalChatAdapterContext,
  ): EngineSignalChatArtifact | null {
    if (this._suppressInfoSignals && signal.severity === 'INFO') {
      this._recordSuppressed(signal.engineId);
      return null;
    }

    const nowMs = asUnixMs(context?.emittedAt ?? Date.now());
    const roomId = context?.roomId ?? this._defaultRoomId;
    const channel = routeEngineSignal(signal.severity, undefined, this._defaultVisibleChannel);
    const narrativeWeight = SEVERITY_NARRATIVE_WEIGHT[signal.severity];
    const runId: Nullable<string> = context?.runId ?? null;

    const chatSignal = buildEngineSignalChatEnvelope(signal, runId, nowMs, narrativeWeight);
    const envelope = buildEngineSignalInputEnvelope(chatSignal, nowMs, roomId, channel);

    const artifact: EngineSignalChatArtifact = {
      engineId: signal.engineId,
      severity: signal.severity,
      code: signal.code,
      tick: signal.tick,
      routeChannel: channel,
      envelope,
      signal: chatSignal,
      mlEnriched: false,
      riskScore: 0,
      urgencyScore: 0,
    };

    this._recordAccepted(signal.engineId, signal.severity, false);
    this._lastTick = signal.tick;
    this._lastSignalCode = signal.code;
    return artifact;
  }

  /**
   * Translate an ML-enriched EngineMLSignal into a chat artifact.
   * ML signals are always forwarded (regardless of suppressInfoSignals setting)
   * because they carry risk classifications needed for AI commentary.
   */
  adaptEngineMLSignal(
    signal: EngineMLSignalInput,
    context?: EngineSignalChatAdapterContext,
  ): EngineSignalChatArtifact {
    const nowMs = asUnixMs(context?.emittedAt ?? Date.now());
    const roomId = context?.roomId ?? this._defaultRoomId;
    const channel = routeEngineSignal(signal.severity, signal.mlClass, this._defaultVisibleChannel);
    const runId: Nullable<string> = context?.runId ?? null;

    // Build narrative weight from ML class
    const narrativeWeight = (() => {
      switch (signal.mlClass) {
        case 'critical_risk': return 'CRITICAL';
        case 'high_risk':     return 'HIGH';
        case 'moderate_risk': return 'MODERATE';
        case 'low_risk':      return 'LOW';
        default:              return 'BACKGROUND';
      }
    })();

    // Build an enriched chat signal envelope
    const enrichedSignal: ChatSignalEnvelope = Object.freeze({
      kind: 'ENGINE_ML_SIGNAL',
      engineId: signal.engineId,
      severity: signal.severity,
      code: signal.code,
      message: signal.message,
      tick: signal.tick,
      tags: signal.tags ?? [],
      category: signal.category ?? 'ml_emit',
      riskScore: signal.riskScore,
      urgencyScore: signal.urgencyScore,
      mlClass: signal.mlClass,
      actionRecommendation: signal.actionRecommendation,
      featureCount: signal.featureSnapshot.length,
      featureChecksum: signal.featureSnapshot.reduce((sum, f) => sum + f, 0).toFixed(4),
      runId: runId ?? null,
      narrativeWeight,
      emittedAt: nowMs,
    }) as unknown as ChatSignalEnvelope;

    const envelope = buildEngineSignalInputEnvelope(enrichedSignal, nowMs, roomId, channel);

    const artifact: EngineSignalChatArtifact = {
      engineId: signal.engineId,
      severity: signal.severity,
      code: signal.code,
      tick: signal.tick,
      routeChannel: channel,
      envelope,
      signal: enrichedSignal,
      mlEnriched: true,
      riskScore: signal.riskScore,
      urgencyScore: signal.urgencyScore,
    };

    this._recordAccepted(signal.engineId, signal.severity, true);
    this._lastTick = signal.tick;
    this._lastSignalCode = signal.code;
    return artifact;
  }

  /**
   * Translate an array of EngineSignals into a batch chat report.
   * Respects maxEnvelopesPerBatch to prevent overwhelming the chat system.
   */
  adaptEngineSignals(
    signals: readonly EngineSignalInput[],
    context?: EngineSignalChatAdapterContext,
  ): EngineSignalChatAdapterReport {
    const accepted: EngineSignalChatArtifact[] = [];
    let suppressed = 0;
    let peakRisk = 0;
    const limited = signals.slice(0, this._maxEnvelopesPerBatch);

    for (const signal of limited) {
      const artifact = this.adaptEngineSignal(signal, context);
      if (artifact) {
        accepted.push(artifact);
        peakRisk = Math.max(peakRisk, artifact.riskScore);
      } else {
        suppressed++;
      }
    }

    // Count signals beyond the cap as suppressed
    suppressed += Math.max(0, signals.length - limited.length);

    const tick = signals[0]?.tick ?? this._lastTick;
    return {
      accepted,
      suppressed,
      tick,
      hasUrgentSignal: accepted.some((a) => a.severity === 'ERROR' || a.riskScore >= 0.85),
      peakRiskScore: peakRisk,
    };
  }

  /**
   * Translate a batch of ML-enriched engine signals.
   */
  adaptEngineMLSignals(
    signals: readonly EngineMLSignalInput[],
    context?: EngineSignalChatAdapterContext,
  ): EngineSignalChatAdapterReport {
    const accepted: EngineSignalChatArtifact[] = [];
    let peakRisk = 0;
    const limited = signals.slice(0, this._maxEnvelopesPerBatch);

    for (const signal of limited) {
      const artifact = this.adaptEngineMLSignal(signal, context);
      accepted.push(artifact);
      peakRisk = Math.max(peakRisk, artifact.riskScore);
    }

    const tick = signals[0]?.tick ?? this._lastTick;
    return {
      accepted,
      suppressed: Math.max(0, signals.length - limited.length),
      tick,
      hasUrgentSignal: accepted.some((a) => a.riskScore >= 0.85 || a.severity === 'ERROR'),
      peakRiskScore: peakRisk,
    };
  }

  /**
   * Translate a WindowMLContext into a chat artifact if urgency is above threshold.
   *
   * The window context drives anticipatory AI commentary ("you have 3 seconds
   * to counter") and play suggestion prompts from the AI companion.
   */
  adaptWindowMLContext(
    ctx: WindowMLContextInput,
    context?: EngineSignalChatAdapterContext,
  ): EngineSignalChatArtifact | null {
    if (ctx.urgencyScore < this._windowUrgencyThreshold && !ctx.hasEndgameWindow) {
      return null;
    }

    const nowMs = asUnixMs(context?.emittedAt ?? Date.now());
    const roomId = context?.roomId ?? this._defaultRoomId;
    const channel: ChatVisibleChannel = ctx.urgencyScore >= 0.9 ? 'GLOBAL' : 'GLOBAL';
    const runId: Nullable<string> = context?.runId ?? null;

    const chatSignal = buildWindowUrgencySignal(ctx, runId, nowMs);
    const envelope = buildEngineSignalInputEnvelope(chatSignal, nowMs, roomId, channel);

    this._totalWindowSignals++;
    this._lastTick = ctx.tick;

    return {
      engineId: 'window',
      severity: ctx.urgencyScore >= 0.85 ? 'WARN' : 'INFO',
      code: 'WINDOW_URGENCY',
      tick: ctx.tick,
      routeChannel: channel,
      envelope,
      signal: chatSignal,
      mlEnriched: true,
      riskScore: ctx.urgencyScore,
      urgencyScore: ctx.urgencyScore,
    };
  }

  /**
   * Translate a SignalAggregatorReport into a per-tick chat summary artifact.
   * Only forwarded if the tick has errors or warnings.
   */
  adaptSignalAggregatorReport(
    report: EngineSignalAggregatorInput,
    context?: EngineSignalChatAdapterContext,
  ): EngineSignalChatArtifact | null {
    if (!report.hasErrors && !report.hasWarnings) {
      return null;
    }

    const nowMs = asUnixMs(context?.emittedAt ?? Date.now());
    const roomId = context?.roomId ?? this._defaultRoomId;
    const channel: ChatVisibleChannel = report.hasErrors ? 'GLOBAL' : 'GLOBAL';
    const runId: Nullable<string> = context?.runId ?? null;

    const chatSignal = buildAggregatorSignal(report, runId, nowMs);
    const envelope = buildEngineSignalInputEnvelope(chatSignal, nowMs, roomId, channel);

    this._totalAggregatorSignals++;
    this._lastTick = report.tick;

    const severity: 'INFO' | 'WARN' | 'ERROR' = report.hasErrors ? 'ERROR' : 'WARN';
    return {
      engineId: 'aggregator',
      severity,
      code: 'ENGINE_TICK_SUMMARY',
      tick: report.tick,
      routeChannel: channel,
      envelope,
      signal: chatSignal,
      mlEnriched: false,
      riskScore: report.hasErrors ? 0.9 : 0.5,
      urgencyScore: report.hasErrors ? 0.85 : 0.4,
    };
  }

  /**
   * Full-tick adaptation: signals + window context + aggregator report
   * in a single call. Returns all artifacts plus stats for the tick.
   */
  adaptTickFull(
    signals: readonly EngineSignalInput[],
    mlSignals: readonly EngineMLSignalInput[],
    windowCtx: WindowMLContextInput | null,
    aggregatorReport: EngineSignalAggregatorInput | null,
    context?: EngineSignalChatAdapterContext,
  ): {
    signalReport: EngineSignalChatAdapterReport;
    mlReport: EngineSignalChatAdapterReport;
    windowArtifact: EngineSignalChatArtifact | null;
    aggregatorArtifact: EngineSignalChatArtifact | null;
    allArtifacts: readonly EngineSignalChatArtifact[];
    hasUrgentSignal: boolean;
    peakRiskScore: number;
  } {
    const signalReport = this.adaptEngineSignals(signals, context);
    const mlReport = this.adaptEngineMLSignals(mlSignals, context);
    const windowArtifact = windowCtx
      ? this.adaptWindowMLContext(windowCtx, context)
      : null;
    const aggregatorArtifact = aggregatorReport
      ? this.adaptSignalAggregatorReport(aggregatorReport, context)
      : null;

    const allArtifacts: EngineSignalChatArtifact[] = [
      ...signalReport.accepted,
      ...mlReport.accepted,
      ...(windowArtifact ? [windowArtifact] : []),
      ...(aggregatorArtifact ? [aggregatorArtifact] : []),
    ];

    const peakRisk = allArtifacts.reduce((max, a) => Math.max(max, a.riskScore), 0);
    const hasUrgent = allArtifacts.some(
      (a) => a.severity === 'ERROR' || a.riskScore >= 0.85 || a.urgencyScore >= 0.85,
    );

    return {
      signalReport,
      mlReport,
      windowArtifact,
      aggregatorArtifact,
      allArtifacts,
      hasUrgentSignal: hasUrgent,
      peakRiskScore: peakRisk,
    };
  }

  // ── State and lifecycle ────────────────────────────────────────────────────

  /** Return the current adapter state snapshot. */
  getState(): EngineSignalChatAdapterState {
    const byEngine: Record<string, EngineSignalChatAdapterEngineCounters> = {};
    for (const [engineId, counters] of this._byEngine.entries()) {
      byEngine[engineId] = { ...counters };
    }
    return {
      totalAccepted: this._totalAccepted,
      totalSuppressed: this._totalSuppressed,
      totalWindowSignals: this._totalWindowSignals,
      totalAggregatorSignals: this._totalAggregatorSignals,
      byEngine,
      lastTick: this._lastTick,
      lastSignalCode: this._lastSignalCode,
    };
  }

  /** Reset all counters and state. */
  reset(): void {
    this._totalAccepted = 0;
    this._totalSuppressed = 0;
    this._totalWindowSignals = 0;
    this._totalAggregatorSignals = 0;
    this._byEngine.clear();
    this._lastTick = 0;
    this._lastSignalCode = null;
  }

  /** Build a health summary for diagnostic surfaces. */
  buildHealthSummary(): {
    healthy: boolean;
    acceptedCount: number;
    suppressedCount: number;
    lastTick: number;
    engineCount: number;
    mlEnrichedRatio: number;
  } {
    const totalML = Array.from(this._byEngine.values()).reduce((s, c) => s + c.mlEnriched, 0);
    return {
      healthy: true,
      acceptedCount: this._totalAccepted,
      suppressedCount: this._totalSuppressed,
      lastTick: this._lastTick,
      engineCount: this._byEngine.size,
      mlEnrichedRatio: this._totalAccepted > 0 ? totalML / this._totalAccepted : 0,
    };
  }

  get totalAccepted(): number { return this._totalAccepted; }
  get totalSuppressed(): number { return this._totalSuppressed; }
  get lastTick(): number { return this._lastTick; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Score01 and Score100 usage (prevents unused import TS error)
// ─────────────────────────────────────────────────────────────────────────────

/** Normalize a 0–100 score to a 0–1 score for chat routing. */
export function normalizeScore100ToScore01(score: Score100): Score01 {
  return Math.max(0, Math.min(1, score / 100)) as Score01;
}

/** Clamp a number to Score01 range. */
export function clampToScore01(value: number): Score01 {
  return Math.max(0, Math.min(1, value)) as Score01;
}

/** Nullable guard for engine signal routing. */
export function resolveRoomId(
  roomId: Nullable<ChatRoomId | string>,
  fallback: ChatRoomId | string,
): ChatRoomId | string {
  return roomId ?? fallback;
}

/** Factory — create an EngineSignalChatAdapter with standard options. */
export function createEngineSignalChatAdapter(
  opts: EngineSignalChatAdapterOptions,
): EngineSignalChatAdapter {
  return new EngineSignalChatAdapter(opts);
}

// =============================================================================
// § 2 — EngineSignalPriorityQueue — priority-based signal ordering
// =============================================================================

export type EngineSignalPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'BACKGROUND';

export interface EngineSignalPriorityEntry {
  readonly signal: EngineSignalInput;
  readonly priority: EngineSignalPriority;
  readonly priorityNumeric: number;
  readonly enqueuedAt: UnixMs;
  readonly context?: EngineSignalChatAdapterContext;
}

const PRIORITY_NUMERIC: Record<EngineSignalPriority, number> = {
  CRITICAL:   100,
  HIGH:        75,
  MEDIUM:      50,
  LOW:         25,
  BACKGROUND:   5,
};

function deriveSignalPriority(signal: EngineSignalInput): EngineSignalPriority {
  if (signal.severity === 'ERROR') return 'CRITICAL';
  if (signal.severity === 'WARN') return 'HIGH';
  if (signal.category === 'boundary_event') return 'MEDIUM';
  if (signal.category === 'state_mutation') return 'MEDIUM';
  return 'BACKGROUND';
}

export class EngineSignalPriorityQueue {
  private readonly queue: EngineSignalPriorityEntry[] = [];
  private readonly maxDepth: number;
  private droppedCount = 0;
  private totalEnqueued = 0;

  public constructor(maxDepth = 500) {
    this.maxDepth = maxDepth;
  }

  public enqueue(
    signal: EngineSignalInput,
    context?: EngineSignalChatAdapterContext,
  ): EngineSignalPriority {
    const priority = deriveSignalPriority(signal);
    const priorityNumeric = PRIORITY_NUMERIC[priority];
    const enqueuedAt = asUnixMs(Date.now());

    const entry: EngineSignalPriorityEntry = Object.freeze({
      signal, priority, priorityNumeric, enqueuedAt, context,
    });

    if (this.queue.length >= this.maxDepth) {
      // Drop lowest priority entry
      this.queue.sort((a, b) => b.priorityNumeric - a.priorityNumeric);
      this.queue.pop();
      this.droppedCount++;
    }

    this.queue.push(entry);
    this.queue.sort((a, b) => b.priorityNumeric - a.priorityNumeric);
    this.totalEnqueued++;

    return priority;
  }

  public enqueueML(
    signal: EngineMLSignalInput,
    context?: EngineSignalChatAdapterContext,
  ): EngineSignalPriority {
    const priority: EngineSignalPriority =
      signal.mlClass === 'critical_risk' ? 'CRITICAL' :
      signal.mlClass === 'high_risk'     ? 'HIGH'     :
      signal.mlClass === 'moderate_risk' ? 'MEDIUM'   :
      signal.riskScore >= 0.5 ? 'HIGH' : 'LOW';

    const entry: EngineSignalPriorityEntry = Object.freeze({
      signal, priority,
      priorityNumeric: PRIORITY_NUMERIC[priority],
      enqueuedAt: asUnixMs(context?.emittedAt ?? Date.now()),
      context,
    });

    if (this.queue.length >= this.maxDepth) {
      this.queue.sort((a, b) => b.priorityNumeric - a.priorityNumeric);
      this.queue.pop();
      this.droppedCount++;
    }

    this.queue.push(entry);
    this.queue.sort((a, b) => b.priorityNumeric - a.priorityNumeric);
    this.totalEnqueued++;

    return priority;
  }

  public flush(maxCount?: number): readonly EngineSignalPriorityEntry[] {
    const count = maxCount ?? this.queue.length;
    const drained = this.queue.splice(0, count);
    return Object.freeze(drained);
  }

  public peek(): EngineSignalPriorityEntry | null {
    return this.queue[0] ?? null;
  }

  public get depth(): number { return this.queue.length; }
  public get dropped(): number { return this.droppedCount; }
  public get enqueued(): number { return this.totalEnqueued; }

  public reset(): void {
    this.queue.length = 0;
    this.droppedCount = 0;
    this.totalEnqueued = 0;
  }
}

// =============================================================================
// § 3 — EngineSignalRoutingTable — dynamic per-engine channel routing
// =============================================================================

export interface EngineSignalRoute {
  readonly engineId: string;
  readonly severity: 'INFO' | 'WARN' | 'ERROR';
  readonly channel: ChatVisibleChannel;
  readonly narrativeWeight: string;
  readonly suppressIfInfo: boolean;
  readonly escalateToComBat: boolean;
}

export type EngineSignalRoutingTableMap = Record<string, EngineSignalRoute>;

const DEFAULT_ENGINE_ROUTES: EngineSignalRoutingTableMap = Object.freeze({
  time:         { engineId: 'time',         severity: 'INFO',  channel: 'GLOBAL',  narrativeWeight: 'BACKGROUND', suppressIfInfo: true,  escalateToComBat: false },
  pressure:     { engineId: 'pressure',     severity: 'WARN',  channel: 'GLOBAL',  narrativeWeight: 'MODERATE',   suppressIfInfo: true,  escalateToComBat: false },
  tension:      { engineId: 'tension',      severity: 'WARN',  channel: 'GLOBAL',  narrativeWeight: 'MODERATE',   suppressIfInfo: true,  escalateToComBat: true  },
  shield:       { engineId: 'shield',       severity: 'WARN',  channel: 'GLOBAL',  narrativeWeight: 'HIGH',       suppressIfInfo: false, escalateToComBat: true  },
  battle:       { engineId: 'battle',       severity: 'ERROR', channel: 'GLOBAL',  narrativeWeight: 'CRITICAL',   suppressIfInfo: false, escalateToComBat: true  },
  cascade:      { engineId: 'cascade',      severity: 'WARN',  channel: 'GLOBAL',  narrativeWeight: 'MODERATE',   suppressIfInfo: true,  escalateToComBat: true  },
  sovereignty:  { engineId: 'sovereignty',  severity: 'INFO',  channel: 'GLOBAL',  narrativeWeight: 'BACKGROUND', suppressIfInfo: true,  escalateToComBat: false },
  window:       { engineId: 'window',       severity: 'WARN',  channel: 'GLOBAL',  narrativeWeight: 'HIGH',       suppressIfInfo: false, escalateToComBat: false },
  aggregator:   { engineId: 'aggregator',   severity: 'ERROR', channel: 'GLOBAL',  narrativeWeight: 'CRITICAL',   suppressIfInfo: true,  escalateToComBat: true  },
});

export class EngineSignalRoutingTable {
  private readonly routes: Map<string, EngineSignalRoute>;

  public constructor(overrides?: Partial<EngineSignalRoutingTableMap>) {
    this.routes = new Map(Object.entries({ ...DEFAULT_ENGINE_ROUTES, ...overrides }));
  }

  public resolve(engineId: string, severity: 'INFO' | 'WARN' | 'ERROR'): {
    channel: ChatVisibleChannel;
    narrativeWeight: string;
    shouldSuppress: boolean;
    shouldEscalate: boolean;
  } {
    const route = this.routes.get(engineId) ?? this.routes.get('aggregator')!;
    const shouldSuppress = route.suppressIfInfo && severity === 'INFO';
    const shouldEscalate = route.escalateToComBat && severity === 'ERROR';
    const channel: ChatVisibleChannel = shouldEscalate ? 'GLOBAL' : route.channel;

    return Object.freeze({
      channel,
      narrativeWeight: route.narrativeWeight,
      shouldSuppress,
      shouldEscalate,
    });
  }

  public setRoute(engineId: string, route: EngineSignalRoute): void {
    this.routes.set(engineId, Object.freeze(route));
  }

  public getAllRoutes(): Readonly<EngineSignalRoutingTableMap> {
    return Object.freeze(Object.fromEntries(this.routes));
  }
}

// =============================================================================
// § 4 — EngineSignalAnalytics — rolling per-engine analytics tracker
// =============================================================================

export interface EngineSignalAnalyticsEntry {
  readonly tick: number;
  readonly engineId: string;
  readonly severity: 'INFO' | 'WARN' | 'ERROR';
  readonly code: string;
  readonly riskScore: number;
  readonly urgencyScore: number;
  readonly mlEnriched: boolean;
  readonly capturedAtMs: UnixMs;
}

export interface EngineSignalEngineStats {
  readonly engineId: string;
  readonly totalSignals: number;
  readonly errorCount: number;
  readonly warnCount: number;
  readonly infoCount: number;
  readonly mlEnrichedCount: number;
  readonly avgRiskScore: number;
  readonly peakRiskScore: number;
  readonly avgUrgencyScore: number;
  readonly lastSeenTick: number;
  readonly isHealthy: boolean;
}

export interface EngineSignalAnalyticsReport {
  readonly totalSignals: number;
  readonly mlEnrichedCount: number;
  readonly totalWindowSignals: number;
  readonly totalAggregatorSignals: number;
  readonly perEngine: Readonly<Record<string, EngineSignalEngineStats>>;
  readonly topRiskEngine: string;
  readonly peakRiskScore: number;
  readonly peakTick: number;
  readonly windowSize: number;
  readonly historyDepth: number;
}

export class EngineSignalAnalytics {
  private readonly history: EngineSignalAnalyticsEntry[] = [];
  private readonly maxHistory: number;
  private peakRiskScore = 0;
  private peakTick = 0;
  private totalWindowSignals = 0;
  private totalAggregatorSignals = 0;

  public constructor(maxHistory = 500) {
    this.maxHistory = maxHistory;
  }

  public record(artifact: EngineSignalChatArtifact, nowMs: UnixMs): void {
    const entry: EngineSignalAnalyticsEntry = Object.freeze({
      tick: artifact.tick,
      engineId: artifact.engineId,
      severity: artifact.severity,
      code: artifact.code,
      riskScore: artifact.riskScore,
      urgencyScore: artifact.urgencyScore,
      mlEnriched: artifact.mlEnriched,
      capturedAtMs: nowMs,
    });

    this.history.push(entry);
    if (this.history.length > this.maxHistory) this.history.shift();

    if (artifact.riskScore > this.peakRiskScore) {
      this.peakRiskScore = artifact.riskScore;
      this.peakTick = artifact.tick;
    }

    if (artifact.engineId === 'window') this.totalWindowSignals++;
    if (artifact.engineId === 'aggregator') this.totalAggregatorSignals++;
  }

  public buildReport(): EngineSignalAnalyticsReport {
    const perEngine = new Map<string, {
      total: number; errors: number; warns: number; infos: number;
      mlCount: number; riskSum: number; peakRisk: number;
      urgencySum: number; lastTick: number;
    }>();

    for (const e of this.history) {
      if (!perEngine.has(e.engineId)) {
        perEngine.set(e.engineId, {
          total: 0, errors: 0, warns: 0, infos: 0,
          mlCount: 0, riskSum: 0, peakRisk: 0, urgencySum: 0, lastTick: 0,
        });
      }
      const s = perEngine.get(e.engineId)!;
      s.total++;
      if (e.severity === 'ERROR') s.errors++;
      else if (e.severity === 'WARN') s.warns++;
      else s.infos++;
      if (e.mlEnriched) s.mlCount++;
      s.riskSum += e.riskScore;
      if (e.riskScore > s.peakRisk) s.peakRisk = e.riskScore;
      s.urgencySum += e.urgencyScore;
      if (e.tick > s.lastTick) s.lastTick = e.tick;
    }

    const perEngineStats: Record<string, EngineSignalEngineStats> = {};
    let topRiskEngine = 'none';
    let topRisk = 0;

    for (const [engineId, s] of perEngine.entries()) {
      const stats: EngineSignalEngineStats = Object.freeze({
        engineId,
        totalSignals: s.total,
        errorCount: s.errors,
        warnCount: s.warns,
        infoCount: s.infos,
        mlEnrichedCount: s.mlCount,
        avgRiskScore: s.total > 0 ? s.riskSum / s.total : 0,
        peakRiskScore: s.peakRisk,
        avgUrgencyScore: s.total > 0 ? s.urgencySum / s.total : 0,
        lastSeenTick: s.lastTick,
        isHealthy: s.errors === 0,
      });
      perEngineStats[engineId] = stats;
      if (s.peakRisk > topRisk) { topRisk = s.peakRisk; topRiskEngine = engineId; }
    }

    const mlEnrichedCount = this.history.filter((e) => e.mlEnriched).length;

    return Object.freeze({
      totalSignals: this.history.length,
      mlEnrichedCount,
      totalWindowSignals: this.totalWindowSignals,
      totalAggregatorSignals: this.totalAggregatorSignals,
      perEngine: Object.freeze(perEngineStats),
      topRiskEngine,
      peakRiskScore: this.peakRiskScore,
      peakTick: this.peakTick,
      windowSize: this.maxHistory,
      historyDepth: this.history.length,
    });
  }

  public getHistory(): readonly EngineSignalAnalyticsEntry[] {
    return Object.freeze([...this.history]);
  }

  public reset(): void {
    this.history.length = 0;
    this.peakRiskScore = 0;
    this.peakTick = 0;
    this.totalWindowSignals = 0;
    this.totalAggregatorSignals = 0;
  }
}

// =============================================================================
// § 5 — EngineSignalMLExtractor — 10-feature DL vector from signal batches
// =============================================================================

export const ENGINE_SIGNAL_DL_FEATURE_LABELS = [
  'error_ratio',
  'warn_ratio',
  'ml_enriched_ratio',
  'peak_risk_score',
  'avg_risk_score',
  'peak_urgency_score',
  'avg_urgency_score',
  'engine_coverage_ratio',
  'window_urgency_score',
  'has_aggregator_error',
] as const;

export type EngineSignalDLFeatureLabel = typeof ENGINE_SIGNAL_DL_FEATURE_LABELS[number];

export interface EngineSignalDLVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly tick: number;
  readonly generatedAtMs: UnixMs;
  readonly tensorShape: readonly [number, number];
}

export class EngineSignalMLExtractor {
  private static readonly ALL_ENGINE_IDS = [
    'time', 'pressure', 'tension', 'shield', 'battle', 'cascade', 'sovereignty',
  ] as const;

  public extract(report: EngineSignalChatAdapterReport): EngineSignalDLVector {
    const all = report.accepted;
    const n = all.length;
    if (n === 0) {
      return Object.freeze({
        features: Object.freeze(new Array(ENGINE_SIGNAL_DL_FEATURE_LABELS.length).fill(0)),
        labels: Object.freeze([...ENGINE_SIGNAL_DL_FEATURE_LABELS]),
        tick: 0,
        generatedAtMs: asUnixMs(Date.now()),
        tensorShape: Object.freeze([1, ENGINE_SIGNAL_DL_FEATURE_LABELS.length]) as readonly [number, number],
      });
    }

    const errors = all.filter((a) => a.severity === 'ERROR').length;
    const warns  = all.filter((a) => a.severity === 'WARN').length;
    const mlEnriched = all.filter((a) => a.mlEnriched).length;
    const peakRisk = Math.max(...all.map((a) => a.riskScore));
    const avgRisk  = all.reduce((s, a) => s + a.riskScore, 0) / n;
    const peakUrgency = Math.max(...all.map((a) => a.urgencyScore));
    const avgUrgency  = all.reduce((s, a) => s + a.urgencyScore, 0) / n;
    const uniqueEngines = new Set(all.map((a) => a.engineId)).size;
    const engineCoverage = uniqueEngines / EngineSignalMLExtractor.ALL_ENGINE_IDS.length;
    const windowSignal = all.find((a) => a.engineId === 'window');
    const windowUrgency = windowSignal?.urgencyScore ?? 0;
    const hasAggregatorError = all.some(
      (a) => a.engineId === 'aggregator' && a.severity === 'ERROR',
    ) ? 1.0 : 0.0;

    const features: readonly number[] = Object.freeze([
      clampToScore01(errors / n),
      clampToScore01(warns / n),
      clampToScore01(mlEnriched / n),
      clampToScore01(peakRisk),
      clampToScore01(avgRisk),
      clampToScore01(peakUrgency),
      clampToScore01(avgUrgency),
      clampToScore01(engineCoverage),
      clampToScore01(windowUrgency),
      hasAggregatorError,
    ]);

    const tick = all[0]?.tick ?? 0;
    return Object.freeze({
      features,
      labels: Object.freeze([...ENGINE_SIGNAL_DL_FEATURE_LABELS]),
      tick,
      generatedAtMs: asUnixMs(Date.now()),
      tensorShape: Object.freeze([1, features.length]) as readonly [number, number],
    });
  }

  public static featureCount(): number {
    return ENGINE_SIGNAL_DL_FEATURE_LABELS.length;
  }
}

// =============================================================================
// § 6 — EngineSignalChatPipeline — wired production pipeline
// =============================================================================

export interface EngineSignalChatPipelineOptions {
  readonly roomId: ChatRoomId | string;
  readonly suppressInfoSignals?: boolean;
  readonly windowUrgencyThreshold?: number;
  readonly maxEnvelopesPerBatch?: number;
  readonly analyticsHistorySize?: number;
  readonly priorityQueueDepth?: number;
  readonly routingOverrides?: Partial<EngineSignalRoutingTableMap>;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
}

export interface EngineSignalChatPipelineTickResult {
  readonly tick: number;
  readonly envelopes: readonly ChatInputEnvelope[];
  readonly signalReport: EngineSignalChatAdapterReport;
  readonly analyticsReport: EngineSignalAnalyticsReport;
  readonly dlVector: EngineSignalDLVector;
  readonly hasUrgentSignal: boolean;
  readonly peakRiskScore: number;
}

/**
 * EngineSignalChatPipeline — fully wired entry point for translating engine
 * simulation signals into the backend chat ingestion surface every tick.
 *
 * Integration:
 *   const pipeline = new EngineSignalChatPipeline({ roomId: runId });
 *   // Each tick:
 *   const result = pipeline.processTick(signals, mlSignals, windowCtx, aggregatorReport);
 *   for (const env of result.envelopes) chatEngine.ingest(env);
 */
export class EngineSignalChatPipeline {
  private readonly adapter: EngineSignalChatAdapter;
  private readonly routingTable: EngineSignalRoutingTable;
  private readonly analytics: EngineSignalAnalytics;
  private readonly priorityQueue: EngineSignalPriorityQueue;
  private readonly mlExtractor: EngineSignalMLExtractor;
  private readonly roomId: ChatRoomId | string;
  private readonly maxEnvelopesPerBatch: number;

  private _tickCount = 0;
  private _isReady = false;

  public constructor(opts: EngineSignalChatPipelineOptions) {
    this.adapter = new EngineSignalChatAdapter({
      defaultRoomId: opts.roomId,
      defaultVisibleChannel: opts.defaultVisibleChannel ?? 'GLOBAL',
      suppressInfoSignals: opts.suppressInfoSignals ?? true,
      windowUrgencyThreshold: opts.windowUrgencyThreshold ?? 0.75,
      maxEnvelopesPerBatch: opts.maxEnvelopesPerBatch ?? 50,
    });
    this.routingTable = new EngineSignalRoutingTable(opts.routingOverrides);
    this.analytics = new EngineSignalAnalytics(opts.analyticsHistorySize ?? 500);
    this.priorityQueue = new EngineSignalPriorityQueue(opts.priorityQueueDepth ?? 500);
    this.mlExtractor = new EngineSignalMLExtractor();
    this.roomId = opts.roomId;
    this.maxEnvelopesPerBatch = opts.maxEnvelopesPerBatch ?? 50;
  }

  public processTick(
    signals: readonly EngineSignalInput[],
    mlSignals: readonly EngineMLSignalInput[],
    windowCtx: WindowMLContextInput | null,
    aggregatorReport: EngineSignalAggregatorInput | null,
    context?: EngineSignalChatAdapterContext,
  ): EngineSignalChatPipelineTickResult {
    this._tickCount++;
    this._isReady = true;
    const nowMs = asUnixMs(Date.now());

    // Enqueue all signals by priority
    for (const s of signals) this.priorityQueue.enqueue(s, context);
    for (const s of mlSignals) this.priorityQueue.enqueueML(s, context);

    // Flush priority queue up to batch limit
    const flushed = this.priorityQueue.flush(this.maxEnvelopesPerBatch);
    const flushedSignals = flushed
      .filter((e) => !('mlClass' in e.signal))
      .map((e) => e.signal) as EngineSignalInput[];
    const flushedML = flushed
      .filter((e) => 'mlClass' in e.signal)
      .map((e) => e.signal) as EngineMLSignalInput[];

    const result = this.adapter.adaptTickFull(
      flushedSignals, flushedML, windowCtx, aggregatorReport, context,
    );

    // Record artifacts to analytics
    for (const artifact of result.allArtifacts) {
      this.analytics.record(artifact, nowMs);
    }

    const analyticsReport = this.analytics.buildReport();
    const dlVector = this.mlExtractor.extract(result.signalReport);

    const tick = signals[0]?.tick ?? mlSignals[0]?.tick ?? 0;

    return Object.freeze({
      tick,
      envelopes: Object.freeze(result.allArtifacts.map((a) => a.envelope)),
      signalReport: result.signalReport,
      analyticsReport,
      dlVector,
      hasUrgentSignal: result.hasUrgentSignal,
      peakRiskScore: result.peakRiskScore,
    });
  }

  public getRoutingTable(): EngineSignalRoutingTable { return this.routingTable; }
  public getAnalytics(): EngineSignalAnalytics { return this.analytics; }
  public getAdapter(): EngineSignalChatAdapter { return this.adapter; }

  public get tickCount(): number { return this._tickCount; }
  public get isReady(): boolean { return this._isReady; }
  public get priorityQueueDepth(): number { return this.priorityQueue.depth; }

  public buildDiagnostics(): Readonly<Record<string, JsonValue>> {
    const adapterState = this.adapter.getState();
    const analyticsReport = this.analytics.buildReport();
    return Object.freeze({
      tickCount: this._tickCount,
      adapterAccepted: adapterState.totalAccepted,
      adapterSuppressed: adapterState.totalSuppressed,
      adapterWindowSignals: adapterState.totalWindowSignals,
      analyticsHistoryDepth: analyticsReport.historyDepth,
      peakRiskScore: analyticsReport.peakRiskScore,
      topRiskEngine: analyticsReport.topRiskEngine,
      priorityQueueDepth: this.priorityQueue.depth,
      priorityQueueDropped: this.priorityQueue.dropped,
      roomId: this.roomId as JsonValue,
    });
  }

  public reset(): void {
    this._tickCount = 0;
    this._isReady = false;
    this.adapter.reset();
    this.analytics.reset();
    this.priorityQueue.reset();
  }
}

// =============================================================================
// § 7 — Engine signal manifest and module constants
// =============================================================================

export const ENGINE_SIGNAL_CHAT_ADAPTER_VERSION = '2026.03.24';
export const ENGINE_SIGNAL_DL_VECTOR_LENGTH = EngineSignalMLExtractor.featureCount();

export const ENGINE_SIGNAL_ADAPTER_MANIFEST = Object.freeze({
  adapterName: 'EngineSignalChatAdapter',
  version: ENGINE_SIGNAL_CHAT_ADAPTER_VERSION,
  dlFeatureCount: ENGINE_SIGNAL_DL_VECTOR_LENGTH,
  dlFeatureLabels: Object.freeze([...ENGINE_SIGNAL_DL_FEATURE_LABELS]),
  supportedEngines: Object.freeze([
    'time', 'pressure', 'tension', 'shield', 'battle', 'cascade', 'sovereignty',
  ]),
  supportedSeverities: Object.freeze(['INFO', 'WARN', 'ERROR']),
  supportedPriorities: Object.freeze(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'BACKGROUND']),
});

/** Validate an EngineSignalInput satisfies the structural contract. */
export function validateEngineSignalInput(input: unknown): input is EngineSignalInput {
  if (!input || typeof input !== 'object') return false;
  const i = input as Record<string, unknown>;
  return (
    typeof i.engineId === 'string' &&
    (i.severity === 'INFO' || i.severity === 'WARN' || i.severity === 'ERROR') &&
    typeof i.code === 'string' &&
    typeof i.message === 'string' &&
    typeof i.tick === 'number'
  );
}

/** Validate an EngineMLSignalInput satisfies the structural contract. */
export function validateEngineMLSignalInput(input: unknown): input is EngineMLSignalInput {
  if (!validateEngineSignalInput(input)) return false;
  const i = (input as unknown) as Record<string, unknown>;
  return (
    typeof i.riskScore === 'number' &&
    typeof i.urgencyScore === 'number' &&
    typeof i.mlClass === 'string' &&
    Array.isArray(i.featureSnapshot)
  );
}

/** Build a EngineSignalChatPipeline with sensible defaults. */
export function createEngineSignalChatPipeline(
  roomId: ChatRoomId | string,
  opts?: Partial<Omit<EngineSignalChatPipelineOptions, 'roomId'>>,
): EngineSignalChatPipeline {
  return new EngineSignalChatPipeline({ roomId, ...opts });
}

// =============================================================================
// § 8 — EngineSignalWindowPredictor — anticipatory window urgency prediction
// =============================================================================

export type EngineSignalWindowPredictionConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'SPECULATIVE';

export interface EngineSignalWindowPrediction {
  readonly timingClass: string;
  readonly estimatedTick: number;
  readonly confidence: EngineSignalWindowPredictionConfidence;
  readonly urgencyIfOpened: number;
  readonly suppressIfLow: boolean;
  readonly narrativeLabel: string;
}

export interface EngineSignalWindowPredictorReport {
  readonly predictions: readonly EngineSignalWindowPrediction[];
  readonly hasHighConfidencePrediction: boolean;
  readonly hasEndgamePrediction: boolean;
  readonly maxUrgencyPrediction: number;
  readonly tick: number;
}

export class EngineSignalWindowPredictor {
  private readonly urgencyThreshold: number;

  public constructor(urgencyThreshold = 0.5) {
    this.urgencyThreshold = urgencyThreshold;
  }

  public predict(ctx: WindowMLContextInput): EngineSignalWindowPredictorReport {
    const predictions: EngineSignalWindowPrediction[] = ctx.predictions
      .filter((p) => p.urgencyIfOpened >= this.urgencyThreshold || p.confidence === 'high')
      .map((p) => {
        const confidence: EngineSignalWindowPredictionConfidence =
          p.confidence === 'high' ? 'HIGH' :
          p.confidence === 'medium' ? 'MEDIUM' :
          p.confidence === 'low' ? 'LOW' : 'SPECULATIVE';

        const narrativeLabel =
          p.urgencyIfOpened >= 0.85 ? 'CRITICAL_WINDOW_IMMINENT' :
          p.urgencyIfOpened >= 0.65 ? 'HIGH_URGENCY_WINDOW' :
          p.urgencyIfOpened >= 0.4  ? 'MODERATE_WINDOW_APPROACHING' : 'AMBIENT_WINDOW';

        return Object.freeze({
          timingClass: p.timingClass,
          estimatedTick: p.estimatedTick,
          confidence,
          urgencyIfOpened: p.urgencyIfOpened,
          suppressIfLow: p.urgencyIfOpened < 0.3,
          narrativeLabel,
        });
      });

    const maxUrgency = predictions.length > 0
      ? Math.max(...predictions.map((p) => p.urgencyIfOpened))
      : 0;

    return Object.freeze({
      predictions: Object.freeze(predictions),
      hasHighConfidencePrediction: predictions.some((p) => p.confidence === 'HIGH'),
      hasEndgamePrediction: predictions.some(
        (p) => p.timingClass === 'END' || p.urgencyIfOpened >= 0.9,
      ),
      maxUrgencyPrediction: maxUrgency,
      tick: ctx.tick,
    });
  }
}

// =============================================================================
// § 9 — EngineSignalChatNarrativeRouter — routes artifacts to narrative surfaces
// =============================================================================

export type EngineNarrativeSurface =
  | 'BOSS_DIALOGUE'
  | 'HELPER_CALLOUT'
  | 'HATER_TAUNT'
  | 'AMBIENT_COMMENT'
  | 'SYSTEM_ALERT'
  | 'SILENT';

export interface EngineSignalNarrativeRoute {
  readonly artifact: EngineSignalChatArtifact;
  readonly surface: EngineNarrativeSurface;
  readonly narrativePriority: number;
  readonly suppressAmbient: boolean;
  readonly requiresImmediateResponse: boolean;
}

export class EngineSignalChatNarrativeRouter {
  public route(artifact: EngineSignalChatArtifact): EngineSignalNarrativeRoute {
    const surface = this.deriveSurface(artifact);
    const narrativePriority = this.derivePriority(artifact);
    const suppressAmbient = artifact.riskScore >= 0.65 || artifact.severity === 'ERROR';
    const requiresImmediateResponse =
      artifact.severity === 'ERROR' || artifact.riskScore >= 0.85;

    return Object.freeze({
      artifact,
      surface,
      narrativePriority,
      suppressAmbient,
      requiresImmediateResponse,
    });
  }

  private deriveSurface(artifact: EngineSignalChatArtifact): EngineNarrativeSurface {
    if (artifact.severity === 'ERROR' && artifact.riskScore >= 0.85) return 'BOSS_DIALOGUE';
    if (artifact.engineId === 'battle' && artifact.severity !== 'INFO') return 'HATER_TAUNT';
    if (artifact.engineId === 'window' && artifact.urgencyScore >= 0.7) return 'HELPER_CALLOUT';
    if (artifact.severity === 'ERROR') return 'SYSTEM_ALERT';
    if (artifact.severity === 'INFO' && artifact.riskScore < 0.3) return 'SILENT';
    return 'AMBIENT_COMMENT';
  }

  private derivePriority(artifact: EngineSignalChatArtifact): number {
    return Math.round(
      artifact.riskScore * 50 +
      artifact.urgencyScore * 30 +
      (artifact.severity === 'ERROR' ? 20 : artifact.severity === 'WARN' ? 10 : 0),
    );
  }

  public routeBatch(
    artifacts: readonly EngineSignalChatArtifact[],
  ): readonly EngineSignalNarrativeRoute[] {
    return Object.freeze(
      artifacts
        .map((a) => this.route(a))
        .sort((a, b) => b.narrativePriority - a.narrativePriority),
    );
  }
}

// =============================================================================
// § 10 — EngineSignalRateController — adaptive rate limiting for chat
// =============================================================================

export interface EngineSignalRateBucket {
  readonly windowMs: number;
  readonly maxSignals: number;
  readonly currentCount: number;
  readonly windowStartMs: UnixMs;
  readonly isThrottled: boolean;
}

export class EngineSignalRateController {
  private readonly windowMs: number;
  private readonly maxSignals: number;
  private windowStartMs: UnixMs;
  private currentCount = 0;
  private throttledCount = 0;
  private totalThrottleMs = 0;
  private lastThrottledAtMs: UnixMs | null = null;

  public constructor(windowMs: number, maxSignals: number) {
    this.windowMs = windowMs;
    this.maxSignals = maxSignals;
    this.windowStartMs = asUnixMs(Date.now());
  }

  public shouldAllow(nowMs: UnixMs): boolean {
    // Roll window if expired
    if (nowMs - this.windowStartMs >= this.windowMs) {
      this.windowStartMs = nowMs;
      this.currentCount = 0;
    }

    if (this.currentCount >= this.maxSignals) {
      this.throttledCount++;
      if (this.lastThrottledAtMs !== null) {
        this.totalThrottleMs += nowMs - this.lastThrottledAtMs;
      }
      this.lastThrottledAtMs = nowMs;
      return false;
    }

    this.currentCount++;
    return true;
  }

  public getBucket(): EngineSignalRateBucket {
    const nowMs = asUnixMs(Date.now());
    return Object.freeze({
      windowMs: this.windowMs,
      maxSignals: this.maxSignals,
      currentCount: this.currentCount,
      windowStartMs: this.windowStartMs,
      isThrottled: this.currentCount >= this.maxSignals,
    });
  }

  public getThrottledCount(): number { return this.throttledCount; }
  public getTotalThrottleMs(): number { return this.totalThrottleMs; }

  public reset(): void {
    this.currentCount = 0;
    this.throttledCount = 0;
    this.totalThrottleMs = 0;
    this.lastThrottledAtMs = null;
    this.windowStartMs = asUnixMs(Date.now());
  }
}

// =============================================================================
// § 11 — EngineSignalDiagnosticsReport — full adapter diagnostic surface
// =============================================================================

export interface EngineSignalAdapterDiagnosticsReport {
  readonly adapterVersion: string;
  readonly adapterState: EngineSignalChatAdapterState;
  readonly analyticsReport: EngineSignalAnalyticsReport;
  readonly queueDepth: number;
  readonly queueDropped: number;
  readonly dlFeatureCount: number;
  readonly isHealthy: boolean;
  readonly healthReason: string;
}

export function buildEngineSignalAdapterDiagnostics(
  adapter: EngineSignalChatAdapter,
  analytics: EngineSignalAnalytics,
  priorityQueue: EngineSignalPriorityQueue,
): EngineSignalAdapterDiagnosticsReport {
  const adapterState = adapter.getState();
  const analyticsReport = analytics.buildReport();
  const isHealthy = adapterState.lastTick > 0 && analyticsReport.totalSignals > 0;

  return Object.freeze({
    adapterVersion: ENGINE_SIGNAL_CHAT_ADAPTER_VERSION,
    adapterState,
    analyticsReport,
    queueDepth: priorityQueue.depth,
    queueDropped: priorityQueue.dropped,
    dlFeatureCount: ENGINE_SIGNAL_DL_VECTOR_LENGTH,
    isHealthy,
    healthReason: isHealthy ? 'OK' : 'NO_SIGNALS_PROCESSED',
  });
}

// =============================================================================
// § 12 — Module-level constants
// =============================================================================

/** Maximum number of signals per tick that the adapter will route. */
export const ENGINE_SIGNAL_MAX_PER_TICK = 50;

/** Minimum risk score that causes a signal to be routed to COMBAT channel. */
export const ENGINE_SIGNAL_COMBAT_ROUTE_THRESHOLD = 0.75;

/** Window urgency score above which anticipatory chat signals are produced. */
export const ENGINE_SIGNAL_WINDOW_URGENCY_THRESHOLD = 0.75;

/** The canonical surface identifier for all engine chat signals. */
export const ENGINE_SIGNAL_SURFACE = 'engine-signal-adapter' as const;

/** The canonical event namespace prefix for engine-signal chat events. */
export const ENGINE_SIGNAL_EVENT_NAMESPACE = 'engine.signal' as const;

// =============================================================================
// § 13 — EngineSignalCorrelationTracker — cross-tick correlation ID tracking
// =============================================================================

export interface EngineSignalCorrelationEntry {
  readonly correlationId: string;
  readonly engineId: string;
  readonly tick: number;
  readonly code: string;
  readonly firstSeenAtMs: UnixMs;
  readonly lastSeenAtMs: UnixMs;
  readonly occurrenceCount: number;
  readonly peakRiskScore: number;
  readonly isResolved: boolean;
}

export interface EngineSignalCorrelationReport {
  readonly activeCorrelations: readonly EngineSignalCorrelationEntry[];
  readonly resolvedCorrelations: readonly EngineSignalCorrelationEntry[];
  readonly totalCorrelations: number;
  readonly persistentIssueCount: number;
  readonly mostPersistentCode: string | null;
}

export class EngineSignalCorrelationTracker {
  private readonly active = new Map<string, EngineSignalCorrelationEntry>();
  private readonly resolved: EngineSignalCorrelationEntry[] = [];
  private readonly maxResolved: number;
  private readonly persistenceThresholdMs: number;

  public constructor(maxResolved = 100, persistenceThresholdMs = 10_000) {
    this.maxResolved = maxResolved;
    this.persistenceThresholdMs = persistenceThresholdMs;
  }

  public track(artifact: EngineSignalChatArtifact, nowMs: UnixMs): string {
    const correlationId = `${artifact.engineId}:${artifact.code}`;
    const existing = this.active.get(correlationId);

    if (existing) {
      const updated: EngineSignalCorrelationEntry = Object.freeze({
        ...existing,
        lastSeenAtMs: nowMs,
        occurrenceCount: existing.occurrenceCount + 1,
        peakRiskScore: Math.max(existing.peakRiskScore, artifact.riskScore),
      });
      this.active.set(correlationId, updated);
    } else {
      const entry: EngineSignalCorrelationEntry = Object.freeze({
        correlationId,
        engineId: artifact.engineId,
        tick: artifact.tick,
        code: artifact.code,
        firstSeenAtMs: nowMs,
        lastSeenAtMs: nowMs,
        occurrenceCount: 1,
        peakRiskScore: artifact.riskScore,
        isResolved: false,
      });
      this.active.set(correlationId, entry);
    }

    return correlationId;
  }

  public resolve(correlationId: string, nowMs: UnixMs): boolean {
    const entry = this.active.get(correlationId);
    if (!entry) return false;

    const resolved = Object.freeze({ ...entry, isResolved: true, lastSeenAtMs: nowMs });
    this.resolved.push(resolved);
    if (this.resolved.length > this.maxResolved) this.resolved.shift();
    this.active.delete(correlationId);
    return true;
  }

  public pruneStale(nowMs: UnixMs): void {
    for (const [id, entry] of this.active.entries()) {
      if (nowMs - entry.lastSeenAtMs > this.persistenceThresholdMs * 10) {
        this.resolve(id, nowMs);
      }
    }
  }

  public buildReport(): EngineSignalCorrelationReport {
    const active = Array.from(this.active.values());
    const persistent = active.filter(
      (e) => e.occurrenceCount >= 3,
    );

    const codeCounts = new Map<string, number>();
    for (const e of active) {
      codeCounts.set(e.code, (codeCounts.get(e.code) ?? 0) + e.occurrenceCount);
    }
    let mostPersistentCode: string | null = null;
    let maxCount = 0;
    for (const [code, count] of codeCounts) {
      if (count > maxCount) { maxCount = count; mostPersistentCode = code; }
    }

    return Object.freeze({
      activeCorrelations: Object.freeze([...active]),
      resolvedCorrelations: Object.freeze([...this.resolved]),
      totalCorrelations: this.active.size + this.resolved.length,
      persistentIssueCount: persistent.length,
      mostPersistentCode,
    });
  }

  public reset(): void {
    this.active.clear();
    this.resolved.length = 0;
  }
}

// =============================================================================
// § 14 — EngineSignalHealthMonitor — adapter self-health surface
// =============================================================================

export type EngineSignalAdapterHealth = 'HEALTHY' | 'DEGRADED' | 'STALLED' | 'UNKNOWN';

export interface EngineSignalHealthSnapshot {
  readonly health: EngineSignalAdapterHealth;
  readonly reason: string;
  readonly lastProcessedTick: number;
  readonly totalAccepted: number;
  readonly totalSuppressed: number;
  readonly suppressionRatio: number;
  readonly uptimeMs: number;
  readonly capturedAtMs: UnixMs;
}

export class EngineSignalHealthMonitor {
  private readonly startedAtMs: UnixMs;
  private lastProcessedTick = 0;
  private totalAccepted = 0;
  private totalSuppressed = 0;
  private consecutiveStallTicks = 0;
  private readonly stallThreshold: number;

  public constructor(stallThreshold = 10) {
    this.startedAtMs = asUnixMs(Date.now());
    this.stallThreshold = stallThreshold;
  }

  public recordTick(adapter: EngineSignalChatAdapter): void {
    const state = adapter.getState();
    const wasStall = state.lastTick <= this.lastProcessedTick;

    if (wasStall) {
      this.consecutiveStallTicks++;
    } else {
      this.consecutiveStallTicks = 0;
      this.lastProcessedTick = state.lastTick;
    }

    this.totalAccepted = state.totalAccepted;
    this.totalSuppressed = state.totalSuppressed;
  }

  public getSnapshot(nowMs: UnixMs): EngineSignalHealthSnapshot {
    const total = this.totalAccepted + this.totalSuppressed;
    const suppressionRatio = total > 0 ? this.totalSuppressed / total : 0;

    let health: EngineSignalAdapterHealth;
    let reason: string;

    if (this.consecutiveStallTicks >= this.stallThreshold) {
      health = 'STALLED';
      reason = `No new ticks for ${this.consecutiveStallTicks} consecutive checks`;
    } else if (suppressionRatio > 0.9 && total > 10) {
      health = 'DEGRADED';
      reason = `High suppression ratio: ${(suppressionRatio * 100).toFixed(1)}%`;
    } else if (this.totalAccepted === 0) {
      health = 'UNKNOWN';
      reason = 'No signals processed yet';
    } else {
      health = 'HEALTHY';
      reason = 'OK';
    }

    return Object.freeze({
      health,
      reason,
      lastProcessedTick: this.lastProcessedTick,
      totalAccepted: this.totalAccepted,
      totalSuppressed: this.totalSuppressed,
      suppressionRatio,
      uptimeMs: nowMs - this.startedAtMs,
      capturedAtMs: nowMs,
    });
  }

  public reset(): void {
    this.lastProcessedTick = 0;
    this.totalAccepted = 0;
    this.totalSuppressed = 0;
    this.consecutiveStallTicks = 0;
  }
}

/** Build a standalone EngineSignalHealthMonitor. */
export function createEngineSignalHealthMonitor(
  stallThreshold?: number,
): EngineSignalHealthMonitor {
  return new EngineSignalHealthMonitor(stallThreshold);
}

// =============================================================================
// § 15 — EngineSignalChatFacade — single high-level facade for the chat lane
// =============================================================================

/**
 * EngineSignalChatFacade — highest-level interface for the engine-signal-to-chat
 * translation layer. Combines all components behind a single, stable API that
 * the ChatEventBridge or ChatEngine can call without knowing the internals.
 *
 * Typical usage in ChatEventBridge:
 *
 *   const facade = new EngineSignalChatFacade({ roomId: runId });
 *   facade.start();
 *   // Each tick from the orchestrator:
 *   const { envelopes, healthSnapshot } = facade.tick(
 *     tickResult.signals, tickResult.mlSignals, tickResult.windowCtx, tickResult.aggregatorReport,
 *   );
 *   for (const env of envelopes) chatEngine.ingest(env);
 */
export class EngineSignalChatFacade {
  private readonly pipeline: EngineSignalChatPipeline;
  private readonly correlationTracker: EngineSignalCorrelationTracker;
  private readonly healthMonitor: EngineSignalHealthMonitor;
  private readonly narrativeRouter: EngineSignalChatNarrativeRouter;
  private readonly windowPredictor: EngineSignalWindowPredictor;
  private readonly rateController: EngineSignalRateController;

  private _isStarted = false;
  private _startedAtMs: UnixMs | null = null;

  public constructor(opts: EngineSignalChatPipelineOptions & {
    readonly correlationPersistenceThresholdMs?: number;
    readonly healthStallThreshold?: number;
    readonly rateWindowMs?: number;
    readonly rateMaxSignals?: number;
    readonly windowUrgencyPredictionThreshold?: number;
  }) {
    this.pipeline = new EngineSignalChatPipeline(opts);
    this.correlationTracker = new EngineSignalCorrelationTracker(
      100, opts.correlationPersistenceThresholdMs ?? 15_000,
    );
    this.healthMonitor = new EngineSignalHealthMonitor(opts.healthStallThreshold ?? 10);
    this.narrativeRouter = new EngineSignalChatNarrativeRouter();
    this.windowPredictor = new EngineSignalWindowPredictor(
      opts.windowUrgencyPredictionThreshold ?? 0.5,
    );
    this.rateController = new EngineSignalRateController(
      opts.rateWindowMs ?? 1_000, opts.rateMaxSignals ?? 200,
    );
  }

  public start(): void {
    this._isStarted = true;
    this._startedAtMs = asUnixMs(Date.now());
  }

  public tick(
    signals: readonly EngineSignalInput[],
    mlSignals: readonly EngineMLSignalInput[],
    windowCtx: WindowMLContextInput | null,
    aggregatorReport: EngineSignalAggregatorInput | null,
    context?: EngineSignalChatAdapterContext,
  ): {
    envelopes: readonly ChatInputEnvelope[];
    narrativeRoutes: readonly EngineSignalNarrativeRoute[];
    windowPrediction: EngineSignalWindowPredictorReport | null;
    correlationReport: EngineSignalCorrelationReport;
    healthSnapshot: EngineSignalHealthSnapshot;
    dlVector: EngineSignalDLVector;
    peakRiskScore: number;
    hasUrgentSignal: boolean;
  } {
    if (!this._isStarted) this.start();
    const nowMs = asUnixMs(Date.now());

    // Rate limit check
    if (!this.rateController.shouldAllow(nowMs)) {
      return {
        envelopes: [], narrativeRoutes: [], windowPrediction: null,
        correlationReport: this.correlationTracker.buildReport(),
        healthSnapshot: this.healthMonitor.getSnapshot(nowMs),
        dlVector: { features: [], labels: [], tick: 0, generatedAtMs: nowMs, tensorShape: [1, 0] },
        peakRiskScore: 0, hasUrgentSignal: false,
      };
    }

    const pipelineResult = this.pipeline.processTick(
      signals, mlSignals, windowCtx, aggregatorReport, context,
    );

    // Track correlations for all accepted artifacts
    for (const artifact of pipelineResult.signalReport.accepted) {
      this.correlationTracker.track(artifact, nowMs);
    }
    this.correlationTracker.pruneStale(nowMs);

    // Record health
    this.healthMonitor.recordTick(this.pipeline.getAdapter());

    // Route narratives
    const narrativeRoutes = this.narrativeRouter.routeBatch(
      pipelineResult.signalReport.accepted,
    );

    // Predict windows
    const windowPrediction = windowCtx
      ? this.windowPredictor.predict(windowCtx)
      : null;

    return {
      envelopes: pipelineResult.envelopes,
      narrativeRoutes,
      windowPrediction,
      correlationReport: this.correlationTracker.buildReport(),
      healthSnapshot: this.healthMonitor.getSnapshot(nowMs),
      dlVector: pipelineResult.dlVector,
      peakRiskScore: pipelineResult.peakRiskScore,
      hasUrgentSignal: pipelineResult.hasUrgentSignal,
    };
  }

  public getAdapter(): EngineSignalChatAdapter { return this.pipeline.getAdapter(); }
  public getPipeline(): EngineSignalChatPipeline { return this.pipeline; }
  public get isStarted(): boolean { return this._isStarted; }
  public get tickCount(): number { return this.pipeline.tickCount; }
  public get startedAtMs(): UnixMs | null { return this._startedAtMs; }

  public reset(): void {
    this.pipeline.reset();
    this.correlationTracker.reset();
    this.healthMonitor.reset();
    this.rateController.reset();
    this._isStarted = false;
    this._startedAtMs = null;
  }
}

/** Build an EngineSignalChatFacade with sensible defaults for production. */
export function createEngineSignalChatFacade(
  roomId: ChatRoomId | string,
  opts?: Partial<ConstructorParameters<typeof EngineSignalChatFacade>[0]>,
): EngineSignalChatFacade {
  return new EngineSignalChatFacade({ roomId, ...opts });
}

// =============================================================================
// § 16 — Structural type guards and utility exports
// =============================================================================

export function isEngineSignalPriorityEntry(v: unknown): v is EngineSignalPriorityEntry {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.priorityNumeric === 'number' && typeof o.enqueuedAt === 'number';
}

export function resolveEngineSignalChannel(
  signal: EngineSignalInput,
  routingTable: EngineSignalRoutingTable,
): ChatVisibleChannel {
  const { channel } = routingTable.resolve(signal.engineId, signal.severity);
  return channel;
}

export {
  deriveSignalPriority,
  PRIORITY_NUMERIC,
  DEFAULT_ENGINE_ROUTES,
};
