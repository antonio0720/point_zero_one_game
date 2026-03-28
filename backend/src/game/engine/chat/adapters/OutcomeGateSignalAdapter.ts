// backend/src/game/engine/chat/adapters/OutcomeGateSignalAdapter.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE CHAT
 * /backend/src/game/engine/chat/adapters/OutcomeGateSignalAdapter.ts
 *
 * Translates OutcomeGate signals from the Engine Zero gate layer into
 * authoritative backend chat lane LIVEOPS_SIGNAL envelopes.
 *
 * No direct imports from zero/ — all types are structural compat shapes.
 * This prevents circular dependency: chat/ → zero/ → chat/.
 *
 * Backend-truth question
 * ----------------------
 *   "When the OutcomeGate resolves a terminal state, detects a probability
 *    shift, emits a bankruptcy runway warning, or approaches the freedom
 *    sprint finish line, what exact chat-native signal should the authoritative
 *    backend chat engine ingest to drive companion NPC coaching and deliver
 *    real outcome proximity urgency to the player?"
 *
 * Adapter modes:
 *   default  — standard LIVEOPS signal with outcome summary, proximity,
 *              and action recommendation
 *   strict   — suppresses NOMINAL and LOW urgency signals; only emits
 *              HIGH_RISK, CRITICAL_RISK, NEAR_FREEDOM, and TERMINAL events
 *   verbose  — includes gate ML vector, DL tensor, session report, and
 *              annotation bundle in the signal metadata
 *
 * All UX urgency is outcome-proximity driven:
 *   bankruptcy_runway <= 5 ticks → CRITICAL
 *   bankruptcy_runway <= 15 ticks → HIGH_RISK
 *   freedom_sprint <= 10 ticks → NEAR_FREEDOM
 *   terminal state → TERMINAL (always emitted)
 *
 * Usage:
 *   import { OUTCOME_GATE_DEFAULT_ADAPTER } from './OutcomeGateSignalAdapter';
 *   const envelope = OUTCOME_GATE_DEFAULT_ADAPTER.translate(signal);
 *
 * Singletons:
 *   OUTCOME_GATE_DEFAULT_ADAPTER
 *   OUTCOME_GATE_STRICT_ADAPTER
 *   OUTCOME_GATE_VERBOSE_ADAPTER
 */

import {
  asUnixMs,
  clamp01,
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
// STRUCTURAL COMPAT TYPES — mirrors zero/OutcomeGate without circular imports
// ─────────────────────────────────────────────────────────────────────────────

/** Structural compat for EngineSignalSeverity (from EngineContracts). */
type GateSeverityCompat = 'INFO' | 'WARN' | 'ERROR';

/** Structural compat for EngineSignalCategory (from EngineContracts). */
type GateCategoryCompat =
  | 'tick'
  | 'state_mutation'
  | 'boundary_event'
  | 'error'
  | 'ml_emit'
  | 'mode_hook'
  | 'health_change'
  | 'contract_violation'
  | 'timing';

/** Structural compat for MLSignalClass (from EngineContracts). */
type GateMLClassCompat =
  | 'critical_risk'
  | 'high_risk'
  | 'moderate_risk'
  | 'low_risk'
  | 'nominal'
  | 'opportunity';

/** Structural compat for OutcomeGateTrendDirection (from OutcomeGate). */
type GateTrendDirectionCompat = 'RISING' | 'STABLE' | 'FALLING';

/**
 * Structural compat for OutcomeGateChatSignal (from zero/OutcomeGate).
 * Callers pass real OutcomeGateChatSignal objects — structural duck-typing.
 */
export interface OutcomeGateChatSignalCompat {
  readonly sessionId: string;
  readonly runId: string;
  readonly tick: number;
  readonly generatedAtMs: number;
  readonly severity: GateSeverityCompat;
  readonly category: GateCategoryCompat;
  readonly headline: string;
  readonly bodyText: string;
  readonly actionSuggestion: string;
  readonly mlClass: GateMLClassCompat;
  readonly riskScore: number;
  readonly urgencyScore: number;
  readonly isTerminal: boolean;
  readonly outcomeEncoded: number;
  readonly bankruptcyProximity: number;
  readonly freedomProximity: number;
  readonly mlSignal: {
    readonly riskScore: number;
    readonly urgencyScore: number;
    readonly mlClass: GateMLClassCompat;
    readonly featureSnapshot: readonly number[];
    readonly actionRecommendation: string;
  };
  readonly composite: {
    readonly tick: number;
    readonly signalCount: number;
    readonly peakRisk: number;
    readonly peakUrgency: number;
    readonly meanRisk: number;
    readonly dominantClass: GateMLClassCompat;
    readonly actionRecommendation: string;
  };
}

/**
 * Structural compat for OutcomeGateMLVector (32-dim gate ML vector).
 */
export interface OutcomeGateMLVectorCompat {
  readonly runId: string;
  readonly tick: number;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly vectorShape: readonly [1, 32];
  readonly extractedAtMs: number;
  readonly mlClass: GateMLClassCompat;
  readonly riskScore: number;
  readonly urgencyScore: number;
  readonly gateMetadata: {
    readonly didChangeOutcome: boolean;
    readonly shouldFinalize: boolean;
    readonly signalCount: number;
  };
}

/**
 * Structural compat for OutcomeGateDLTensor (48-dim gate DL tensor).
 */
export interface OutcomeGateDLTensorCompat {
  readonly runId: string;
  readonly tick: number;
  readonly inputVector: readonly number[];
  readonly featureLabels: readonly string[];
  readonly tensorShape: readonly [1, 48];
  readonly policyVersion: string;
  readonly extractedAtMs: number;
  readonly baseMLVector: OutcomeGateMLVectorCompat;
}

/**
 * Structural compat for OutcomeGateTrendSnapshot.
 */
export interface OutcomeGateTrendSnapshotCompat {
  readonly tick: number;
  readonly capturedAtMs: number;
  readonly bankruptcyTrend: GateTrendDirectionCompat;
  readonly freedomTrend: GateTrendDirectionCompat;
  readonly bankruptcyProximity: number;
  readonly freedomProximity: number;
  readonly shiftEventFired: boolean;
  readonly shiftReason: string | null;
  readonly entryCount: number;
}

/**
 * Structural compat for OutcomeGateSessionReport.
 */
export interface OutcomeGateSessionReportCompat {
  readonly sessionId: string;
  readonly startedAtMs: number;
  readonly capturedAtMs: number;
  readonly totalResolutions: number;
  readonly terminalResolutions: number;
  readonly terminalRate: number;
  readonly winRate: number;
  readonly bankruptRate: number;
  readonly timeoutRate: number;
  readonly abandonedRate: number;
  readonly avgRemainingBudgetRatio: number;
  readonly forcedOutcomeCount: number;
  readonly batchResolutionCount: number;
}

/**
 * Structural compat for OutcomeGateAnnotationBundle.
 */
export interface OutcomeGateAnnotationBundleCompat {
  readonly runId: string;
  readonly tick: number;
  readonly annotatedAtMs: number;
  readonly checksum: string;
  readonly urgencyLabel: string;
  readonly primaryMessage: string;
  readonly secondaryMessage: string;
  readonly actionRecommendation: string;
  readonly isNearBankruptcy: boolean;
  readonly isNearFreedom: boolean;
  readonly isCritical: boolean;
  readonly warningTags: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

/** Adapter operating mode. */
export type OutcomeGateAdapterMode = 'default' | 'strict' | 'verbose';

/** Configuration for the OutcomeGateSignalAdapter. */
export interface OutcomeGateSignalAdapterConfig {
  /** Operating mode — controls suppression and verbosity. */
  readonly mode: OutcomeGateAdapterMode;
  /** Dedupe window in ms — signals within this window are suppressed unless CRITICAL. */
  readonly dedupeWindowMs: number;
  /** Whether to include ML vector features in verbose metadata. */
  readonly includeMLFeatures: boolean;
  /** Whether to include DL tensor in verbose metadata. */
  readonly includeDLTensor: boolean;
  /** Whether to include session report in metadata. */
  readonly includeSessionReport: boolean;
  /** Whether to include annotation bundle in metadata. */
  readonly includeAnnotations: boolean;
  /** Minimum urgency score (0-1) required to emit a signal. */
  readonly minUrgencyScore: number;
  /** Whether to suppress NOMINAL/LOW urgency signals. */
  readonly suppressLowUrgency: boolean;
}

const DEFAULT_CONFIG: OutcomeGateSignalAdapterConfig = {
  mode: 'default',
  dedupeWindowMs: 3_000,
  includeMLFeatures: false,
  includeDLTensor: false,
  includeSessionReport: false,
  includeAnnotations: false,
  minUrgencyScore: 0.0,
  suppressLowUrgency: false,
};

const STRICT_CONFIG: OutcomeGateSignalAdapterConfig = {
  mode: 'strict',
  dedupeWindowMs: 1_000,
  includeMLFeatures: false,
  includeDLTensor: false,
  includeSessionReport: false,
  includeAnnotations: false,
  minUrgencyScore: 0.6,
  suppressLowUrgency: true,
};

const VERBOSE_CONFIG: OutcomeGateSignalAdapterConfig = {
  mode: 'verbose',
  dedupeWindowMs: 5_000,
  includeMLFeatures: true,
  includeDLTensor: true,
  includeSessionReport: true,
  includeAnnotations: true,
  minUrgencyScore: 0.0,
  suppressLowUrgency: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER OUTPUT TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** The kind of signal produced by this adapter. */
export type OutcomeGateSignalKind =
  | 'OUTCOME_TERMINAL'
  | 'OUTCOME_BANKRUPT_CRITICAL'
  | 'OUTCOME_BANKRUPT_HIGH'
  | 'OUTCOME_FREEDOM_NEAR'
  | 'OUTCOME_RISK_SHIFT'
  | 'OUTCOME_ML_EMIT'
  | 'OUTCOME_NOMINAL';

/** Payload shape produced by the adapter. */
export interface OutcomeGateChatPayload {
  readonly kind: OutcomeGateSignalKind;
  readonly sessionId: string;
  readonly runId: string;
  readonly tick: number;
  readonly headline: string;
  readonly bodyText: string;
  readonly actionSuggestion: string;
  readonly mlClass: GateMLClassCompat;
  readonly riskScore: number;
  readonly urgencyScore: number;
  readonly isTerminal: boolean;
  readonly bankruptcyProximity: number;
  readonly freedomProximity: number;
  readonly outcomeEncoded: number;
  readonly dominantMLClass: GateMLClassCompat;
  readonly peakRisk: number;
  readonly peakUrgency: number;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

/** Full adapter translation result. */
export interface OutcomeGateTranslationResult {
  readonly accepted: boolean;
  readonly suppressedReason: string | null;
  readonly kind: OutcomeGateSignalKind;
  readonly inputEnvelope: ChatInputEnvelope | null;
  readonly signalEnvelope: ChatSignalEnvelope | null;
  readonly payload: OutcomeGateChatPayload;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Bankruptcy runway thresholds (mirrors zero/OutcomeGate constants). */
const GATE_BANKRUPTCY_CRITICAL_TICKS = 5 as const;
const GATE_BANKRUPTCY_HIGH_TICKS = 15 as const;
const GATE_FREEDOM_NEAR_TICKS = 10 as const;

function gateSignalKind(signal: OutcomeGateChatSignalCompat): OutcomeGateSignalKind {
  if (signal.isTerminal) return 'OUTCOME_TERMINAL';

  // Infer runway ticks from bankruptcy proximity inverse
  // (actual runway ticks not surfaced in the compat type directly,
  //  so we use proximity thresholds as proxy)
  if (signal.bankruptcyProximity >= 0.92) return 'OUTCOME_BANKRUPT_CRITICAL';
  if (signal.bankruptcyProximity >= 0.75) return 'OUTCOME_BANKRUPT_HIGH';
  if (signal.freedomProximity >= 0.90) return 'OUTCOME_FREEDOM_NEAR';

  if (signal.mlClass === 'critical_risk' || signal.mlClass === 'high_risk') {
    return 'OUTCOME_RISK_SHIFT';
  }
  if (signal.urgencyScore >= 0.5) return 'OUTCOME_ML_EMIT';
  return 'OUTCOME_NOMINAL';
}

function gateSeverityToChat(severity: GateSeverityCompat): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' {
  switch (severity) {
    case 'ERROR': return 'CRITICAL';
    case 'WARN':  return 'HIGH';
    case 'INFO':  return 'INFO';
  }
}

function shouldSuppress(
  signal: OutcomeGateChatSignalCompat,
  kind: OutcomeGateSignalKind,
  config: OutcomeGateSignalAdapterConfig,
): string | null {
  // Terminal signals are NEVER suppressed
  if (signal.isTerminal) return null;

  // CRITICAL bankruptcy is NEVER suppressed
  if (kind === 'OUTCOME_BANKRUPT_CRITICAL') return null;

  // Strict mode: suppress anything below HIGH_RISK
  if (config.suppressLowUrgency) {
    if (kind === 'OUTCOME_NOMINAL') {
      return 'strict_mode:nominal_suppressed';
    }
    if (signal.urgencyScore < config.minUrgencyScore) {
      return `strict_mode:urgency_below_threshold:${signal.urgencyScore.toFixed(3)}`;
    }
    if (signal.mlClass === 'low_risk' || signal.mlClass === 'nominal' || signal.mlClass === 'opportunity') {
      return `strict_mode:low_risk_class:${signal.mlClass}`;
    }
  }

  // General min urgency check
  if (signal.urgencyScore < config.minUrgencyScore) {
    return `urgency_below_threshold:${signal.urgencyScore.toFixed(3)}`;
  }

  return null;
}

function buildMetadata(
  signal: OutcomeGateChatSignalCompat,
  config: OutcomeGateSignalAdapterConfig,
  mlVector?: OutcomeGateMLVectorCompat | null,
  dlTensor?: OutcomeGateDLTensorCompat | null,
  sessionReport?: OutcomeGateSessionReportCompat | null,
  annotation?: OutcomeGateAnnotationBundleCompat | null,
  trend?: OutcomeGateTrendSnapshotCompat | null,
): Readonly<Record<string, JsonValue>> {
  const base: Record<string, JsonValue> = {
    sessionId: signal.sessionId,
    runId: signal.runId,
    tick: signal.tick,
    isTerminal: signal.isTerminal,
    outcomeEncoded: signal.outcomeEncoded,
    mlClass: signal.mlClass,
    riskScore: parseFloat(signal.riskScore.toFixed(4)),
    urgencyScore: parseFloat(signal.urgencyScore.toFixed(4)),
    bankruptcyProximity: parseFloat(signal.bankruptcyProximity.toFixed(4)),
    freedomProximity: parseFloat(signal.freedomProximity.toFixed(4)),
    composite_dominantClass: signal.composite.dominantClass,
    composite_peakRisk: parseFloat(signal.composite.peakRisk.toFixed(4)),
    composite_peakUrgency: parseFloat(signal.composite.peakUrgency.toFixed(4)),
    composite_meanRisk: parseFloat(signal.composite.meanRisk.toFixed(4)),
    composite_signalCount: signal.composite.signalCount,
    actionRecommendation: signal.composite.actionRecommendation,
  };

  if (config.includeMLFeatures && mlVector != null) {
    base['ml_runId'] = mlVector.runId;
    base['ml_tick'] = mlVector.tick;
    base['ml_featureCount'] = mlVector.features.length;
    base['ml_riskScore'] = parseFloat(mlVector.riskScore.toFixed(4));
    base['ml_urgencyScore'] = parseFloat(mlVector.urgencyScore.toFixed(4));
    base['ml_mlClass'] = mlVector.mlClass;
    base['ml_didChangeOutcome'] = mlVector.gateMetadata.didChangeOutcome;
    base['ml_shouldFinalize'] = mlVector.gateMetadata.shouldFinalize;
    base['ml_signalCount'] = mlVector.gateMetadata.signalCount;
    // First 8 features for compact inspection
    base['ml_features_8'] = mlVector.features.slice(0, 8).map((f) => parseFloat(f.toFixed(4))) as unknown as JsonValue;
  }

  if (config.includeDLTensor && dlTensor != null) {
    base['dl_policyVersion'] = dlTensor.policyVersion;
    base['dl_featureCount'] = dlTensor.inputVector.length;
    base['dl_tensorShape'] = `${dlTensor.tensorShape[0]}x${dlTensor.tensorShape[1]}`;
    // First 8 extended features
    base['dl_extended_8'] = dlTensor.inputVector.slice(32, 40).map((f) => parseFloat(f.toFixed(4))) as unknown as JsonValue;
  }

  if (config.includeSessionReport && sessionReport != null) {
    base['sess_totalResolutions'] = sessionReport.totalResolutions;
    base['sess_terminalRate'] = parseFloat(sessionReport.terminalRate.toFixed(4));
    base['sess_winRate'] = parseFloat(sessionReport.winRate.toFixed(4));
    base['sess_bankruptRate'] = parseFloat(sessionReport.bankruptRate.toFixed(4));
    base['sess_timeoutRate'] = parseFloat(sessionReport.timeoutRate.toFixed(4));
    base['sess_forcedCount'] = sessionReport.forcedOutcomeCount;
    base['sess_batchCount'] = sessionReport.batchResolutionCount;
    base['sess_avgRemainingBudgetRatio'] = parseFloat(sessionReport.avgRemainingBudgetRatio.toFixed(4));
  }

  if (config.includeAnnotations && annotation != null) {
    base['ann_urgencyLabel'] = annotation.urgencyLabel;
    base['ann_isNearBankruptcy'] = annotation.isNearBankruptcy;
    base['ann_isNearFreedom'] = annotation.isNearFreedom;
    base['ann_isCritical'] = annotation.isCritical;
    base['ann_warningTags'] = annotation.warningTags as unknown as JsonValue;
    base['ann_primaryMessage'] = annotation.primaryMessage;
    base['ann_checksum'] = annotation.checksum;
  }

  if (trend != null) {
    base['trend_bankruptcyTrend'] = trend.bankruptcyTrend;
    base['trend_freedomTrend'] = trend.freedomTrend;
    base['trend_shiftEventFired'] = trend.shiftEventFired;
    base['trend_shiftReason'] = trend.shiftReason ?? null;
    base['trend_entryCount'] = trend.entryCount;
    base['trend_bankruptcyProximity'] = parseFloat(trend.bankruptcyProximity.toFixed(4));
    base['trend_freedomProximity'] = parseFloat(trend.freedomProximity.toFixed(4));
  }

  return Object.freeze(base);
}

// ─────────────────────────────────────────────────────────────────────────────
// OutcomeGateSignalAdapter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical adapter: OutcomeGate → backend chat LIVEOPS_SIGNAL lane.
 *
 * Three modes:
 *   default  — standard outcome proximity signals with action guidance
 *   strict   — suppresses low urgency; only emits HIGH_RISK+ and TERMINAL
 *   verbose  — includes full ML vector, DL tensor, session, annotations
 *
 * Every translation produces:
 *   1. ChatInputEnvelope (kind: 'LIVEOPS_SIGNAL') — for the chat ingress lane
 *   2. ChatSignalEnvelope (type: 'LIVEOPS') — for the fanout surface
 *   3. OutcomeGateChatPayload — structured payload for downstream consumers
 *
 * Proximity thresholds (always accepted, never suppressed):
 *   - bankruptcy proximity >= 0.92 (critical runway)
 *   - terminal outcome decisions
 *   - freedom proximity >= 0.90 (near-freedom sprint)
 */
export class OutcomeGateSignalAdapter {
  private readonly config: OutcomeGateSignalAdapterConfig;
  private readonly dedupeCache = new Map<string, number>();

  public constructor(config: OutcomeGateSignalAdapterConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  /**
   * Translate an OutcomeGateChatSignal into a full chat translation result.
   */
  public translate(
    signal: OutcomeGateChatSignalCompat,
    roomId?: string,
    mlVector?: OutcomeGateMLVectorCompat | null,
    dlTensor?: OutcomeGateDLTensorCompat | null,
    sessionReport?: OutcomeGateSessionReportCompat | null,
    annotation?: OutcomeGateAnnotationBundleCompat | null,
    trend?: OutcomeGateTrendSnapshotCompat | null,
  ): OutcomeGateTranslationResult {
    const kind = gateSignalKind(signal);
    const suppressedReason = this.checkSuppression(signal, kind);

    const metadata = buildMetadata(
      signal, this.config, mlVector, dlTensor, sessionReport, annotation, trend,
    );

    const payload = this.buildPayload(signal, kind, metadata);

    if (suppressedReason !== null) {
      return {
        accepted: false,
        suppressedReason,
        kind,
        inputEnvelope: null,
        signalEnvelope: null,
        payload,
      };
    }

    const inputEnvelope = this.buildInputEnvelope(signal, kind, payload, roomId);
    const signalEnvelope = this.buildSignalEnvelope(signal, kind, payload);

    return {
      accepted: true,
      suppressedReason: null,
      kind,
      inputEnvelope,
      signalEnvelope,
      payload,
    };
  }

  /**
   * Translate only the ML vector into a chat signal (verbose mode).
   */
  public translateMLVector(
    signal: OutcomeGateChatSignalCompat,
    mlVector: OutcomeGateMLVectorCompat,
    roomId?: string,
  ): OutcomeGateTranslationResult {
    return this.translate(signal, roomId, mlVector, null, null, null, null);
  }

  /**
   * Translate only the DL tensor into a chat signal (verbose mode).
   */
  public translateDLTensor(
    signal: OutcomeGateChatSignalCompat,
    dlTensor: OutcomeGateDLTensorCompat,
    roomId?: string,
  ): OutcomeGateTranslationResult {
    return this.translate(signal, roomId, null, dlTensor, null, null, null);
  }

  /**
   * Translate a trend snapshot into a chat signal.
   */
  public translateTrend(
    signal: OutcomeGateChatSignalCompat,
    trend: OutcomeGateTrendSnapshotCompat,
    roomId?: string,
  ): OutcomeGateTranslationResult {
    return this.translate(signal, roomId, null, null, null, null, trend);
  }

  /**
   * Translate a session report into a chat signal.
   */
  public translateSession(
    signal: OutcomeGateChatSignalCompat,
    sessionReport: OutcomeGateSessionReportCompat,
    roomId?: string,
  ): OutcomeGateTranslationResult {
    return this.translate(signal, roomId, null, null, sessionReport, null, null);
  }

  /**
   * Translate an annotation bundle into a chat signal.
   */
  public translateAnnotation(
    signal: OutcomeGateChatSignalCompat,
    annotation: OutcomeGateAnnotationBundleCompat,
    roomId?: string,
  ): OutcomeGateTranslationResult {
    return this.translate(signal, roomId, null, null, null, annotation, null);
  }

  /**
   * Translate a full bundle (all surfaces) into a chat signal.
   * Used by the verbose adapter.
   */
  public translateFull(
    signal: OutcomeGateChatSignalCompat,
    mlVector: OutcomeGateMLVectorCompat,
    dlTensor: OutcomeGateDLTensorCompat,
    sessionReport: OutcomeGateSessionReportCompat,
    annotation: OutcomeGateAnnotationBundleCompat,
    trend: OutcomeGateTrendSnapshotCompat | null,
    roomId?: string,
  ): OutcomeGateTranslationResult {
    return this.translate(signal, roomId, mlVector, dlTensor, sessionReport, annotation, trend);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private checkSuppression(
    signal: OutcomeGateChatSignalCompat,
    kind: OutcomeGateSignalKind,
  ): string | null {
    // Rule 1: check signal-level suppression
    const suppressed = shouldSuppress(signal, kind, this.config);
    if (suppressed !== null) return suppressed;

    // Rule 2: dedupe within window
    const dedupeKey = `${signal.runId}:${kind}:${Math.round(signal.bankruptcyProximity * 10)}`;
    const lastEmit = this.dedupeCache.get(dedupeKey);
    const nowMs = Date.now();

    if (
      lastEmit !== undefined &&
      nowMs - lastEmit < this.config.dedupeWindowMs &&
      kind !== 'OUTCOME_TERMINAL' &&
      kind !== 'OUTCOME_BANKRUPT_CRITICAL'
    ) {
      return `deduped:window_${this.config.dedupeWindowMs}ms`;
    }

    this.dedupeCache.set(dedupeKey, nowMs);
    return null;
  }

  private buildPayload(
    signal: OutcomeGateChatSignalCompat,
    kind: OutcomeGateSignalKind,
    metadata: Readonly<Record<string, JsonValue>>,
  ): OutcomeGateChatPayload {
    return {
      kind,
      sessionId: signal.sessionId,
      runId: signal.runId,
      tick: signal.tick,
      headline: signal.headline,
      bodyText: signal.bodyText,
      actionSuggestion: signal.actionSuggestion,
      mlClass: signal.mlClass,
      riskScore: signal.riskScore,
      urgencyScore: signal.urgencyScore,
      isTerminal: signal.isTerminal,
      bankruptcyProximity: signal.bankruptcyProximity,
      freedomProximity: signal.freedomProximity,
      outcomeEncoded: signal.outcomeEncoded,
      dominantMLClass: signal.composite.dominantClass,
      peakRisk: signal.composite.peakRisk,
      peakUrgency: signal.composite.peakUrgency,
      metadata,
    };
  }

  private buildInputEnvelope(
    signal: OutcomeGateChatSignalCompat,
    kind: OutcomeGateSignalKind,
    payload: OutcomeGateChatPayload,
    roomId?: string,
  ): ChatInputEnvelope {
    const urgencyScore = clamp01(signal.urgencyScore) as Score01;
    const riskScore = clamp01(signal.riskScore) as unknown as Score100;

    void urgencyScore; // exposed via payload
    void riskScore;

    return {
      kind: 'LIVEOPS_SIGNAL',
      type: 'OUTCOME_GATE',
      runId: signal.runId,
      tick: signal.tick,
      roomId: (roomId ?? `run:${signal.runId}`) as ChatRoomId,
      ts: asUnixMs(signal.generatedAtMs),
      payload: payload as unknown as Record<string, JsonValue>,
      severity: signal.severity,
      headline: `[${kind}] ${signal.headline}`,
      bodyText: signal.bodyText,
      actionCode: signal.composite.actionRecommendation,
      isTerminal: signal.isTerminal,
      proximityFlags: {
        bankruptcyProximity: signal.bankruptcyProximity,
        freedomProximity: signal.freedomProximity,
        mlClass: signal.mlClass,
        urgencyScore: signal.urgencyScore,
      } as unknown as Record<string, JsonValue>,
    } as unknown as ChatInputEnvelope;
  }

  private buildSignalEnvelope(
    signal: OutcomeGateChatSignalCompat,
    kind: OutcomeGateSignalKind,
    payload: OutcomeGateChatPayload,
  ): ChatSignalEnvelope {
    const chatSeverity = gateSeverityToChat(signal.severity);

    return {
      type: 'LIVEOPS',
      subtype: kind,
      runId: signal.runId,
      tick: signal.tick,
      ts: asUnixMs(signal.generatedAtMs) as UnixMs,
      severity: chatSeverity,
      channel: 'GAME_SIGNAL' as ChatVisibleChannel,
      headline: signal.headline,
      bodyText: signal.bodyText,
      actionCode: signal.composite.actionRecommendation,
      payload: payload as unknown as Nullable<Record<string, JsonValue>>,
      sessionId: signal.sessionId,
      isTerminal: signal.isTerminal,
      mlClass: signal.mlClass,
      riskScore: signal.riskScore,
      urgencyScore: signal.urgencyScore,
    } as unknown as ChatSignalEnvelope;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTENDED ADAPTER UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify the outcome gate signal kind from a chat signal compat object.
 * Utility for downstream consumers building custom routing logic.
 */
export function classifyOutcomeGateSignalKind(
  signal: OutcomeGateChatSignalCompat,
): OutcomeGateSignalKind {
  return gateSignalKind(signal);
}

/**
 * Check whether a gate signal should fire the CRITICAL chat escalation.
 * CRITICAL = terminal OR bankruptcy_proximity >= 0.92 OR mlClass === 'critical_risk'.
 */
export function isOutcomeGateSignalCritical(
  signal: OutcomeGateChatSignalCompat,
): boolean {
  return (
    signal.isTerminal ||
    signal.bankruptcyProximity >= 0.92 ||
    signal.mlClass === 'critical_risk'
  );
}

/**
 * Compute a chat urgency tier from a gate signal.
 * Drives companion NPC urgency escalation in the chat system.
 */
export function computeOutcomeGateChatUrgency(
  signal: OutcomeGateChatSignalCompat,
): 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
  if (signal.isTerminal) return 'CRITICAL';
  if (signal.bankruptcyProximity >= 0.92) return 'CRITICAL';
  if (signal.bankruptcyProximity >= 0.75 || signal.mlClass === 'critical_risk') return 'HIGH';
  if (signal.bankruptcyProximity >= 0.50 || signal.mlClass === 'high_risk') return 'HIGH';
  if (signal.freedomProximity >= 0.90) return 'HIGH'; // near-freedom is high urgency
  if (signal.urgencyScore >= 0.6) return 'MODERATE';
  if (signal.urgencyScore >= 0.3) return 'LOW';
  return 'NONE';
}

/**
 * Compute a 0-1 score from an OutcomeGateChatSignalCompat for ranking/sorting.
 */
export function scoreOutcomeGateChatSignal(
  signal: OutcomeGateChatSignalCompat,
): number {
  const terminalBonus = signal.isTerminal ? 0.5 : 0.0;
  const riskWeight = signal.riskScore * 0.3;
  const urgencyWeight = signal.urgencyScore * 0.2;
  return Math.min(1.0, terminalBonus + riskWeight + urgencyWeight);
}

/**
 * Check if a gate signal represents a bankruptcy runway warning.
 * Uses proximity thresholds that mirror OUTCOME_GATE_BANKRUPTCY_*_TICKS.
 */
export function isOutcomeGateBankruptcyWarning(
  signal: OutcomeGateChatSignalCompat,
): boolean {
  // bankruptcy_proximity >= 0.75 corresponds to HIGH_TICKS threshold (15 ticks)
  return (
    !signal.isTerminal &&
    signal.bankruptcyProximity >= 0.75
  );
}

/**
 * Check if a gate signal represents a near-freedom sprint.
 * Uses freedom proximity threshold mirroring OUTCOME_GATE_FREEDOM_NEAR_TICKS.
 */
export function isOutcomeGateFreedomSprint(
  signal: OutcomeGateChatSignalCompat,
): boolean {
  return (
    !signal.isTerminal &&
    signal.freedomProximity >= 0.90
  );
}

/**
 * Build a compact signal summary string for logging/tracing.
 */
export function summarizeOutcomeGateChatSignal(
  signal: OutcomeGateChatSignalCompat,
): string {
  const kind = gateSignalKind(signal);
  const termStr = signal.isTerminal ? ' [TERMINAL]' : '';
  const riskStr = `risk:${signal.riskScore.toFixed(2)}`;
  const urgStr = `urgency:${signal.urgencyScore.toFixed(2)}`;
  const proxStr = `bankrupt:${signal.bankruptcyProximity.toFixed(2)}/freedom:${signal.freedomProximity.toFixed(2)}`;
  return `[OutcomeGate:${kind}] ${signal.headline}${termStr} | ${riskStr} | ${urgStr} | ${proxStr} | action:${signal.actionSuggestion}`;
}

/**
 * Validate that an OutcomeGateChatSignalCompat has all required fields.
 * Returns null if valid, or a string describing the validation failure.
 */
export function validateOutcomeGateChatSignal(
  signal: unknown,
): string | null {
  if (typeof signal !== 'object' || signal === null) {
    return 'signal must be an object';
  }
  const s = signal as Record<string, unknown>;
  if (typeof s['runId'] !== 'string' || s['runId'].length === 0) {
    return 'runId must be a non-empty string';
  }
  if (typeof s['tick'] !== 'number') return 'tick must be a number';
  if (typeof s['riskScore'] !== 'number') return 'riskScore must be a number';
  if (typeof s['urgencyScore'] !== 'number') return 'urgencyScore must be a number';
  if (typeof s['isTerminal'] !== 'boolean') return 'isTerminal must be a boolean';
  if (typeof s['bankruptcyProximity'] !== 'number') return 'bankruptcyProximity must be a number';
  if (typeof s['freedomProximity'] !== 'number') return 'freedomProximity must be a number';
  return null;
}

/**
 * Compute the implied bankruptcy runway tier from a proximity score.
 * Mirrors the thresholds defined in OutcomeGate constants.
 *
 * Note: GATE_BANKRUPTCY_CRITICAL_TICKS and GATE_BANKRUPTCY_HIGH_TICKS are
 * inverted to proximity space (higher proximity = fewer ticks remaining).
 */
export function classifyBankruptcyRunwayTier(
  bankruptcyProximity: number,
): 'NONE' | 'HIGH' | 'CRITICAL' {
  // These constants mirror the gate layer thresholds
  void GATE_BANKRUPTCY_CRITICAL_TICKS; // 5 ticks → ~0.95 proximity
  void GATE_BANKRUPTCY_HIGH_TICKS;    // 15 ticks → ~0.85 proximity
  void GATE_FREEDOM_NEAR_TICKS;       // 10 ticks → 0.90 freedom proximity

  if (bankruptcyProximity >= 0.95) return 'CRITICAL';
  if (bankruptcyProximity >= 0.85) return 'HIGH';
  return 'NONE';
}

/**
 * Format a gate ML vector as a named map for display/logging.
 */
export function formatOutcomeGateMLVector(
  mlVector: OutcomeGateMLVectorCompat,
): Readonly<Record<string, number>> {
  const map: Record<string, number> = {};
  mlVector.featureLabels.forEach((label, i) => {
    map[label] = parseFloat((mlVector.features[i] ?? 0).toFixed(4));
  });
  return Object.freeze(map);
}

/**
 * Compute cosine similarity between two gate ML vectors.
 */
export function computeGateMLVectorSimilarity(
  a: OutcomeGateMLVectorCompat,
  b: OutcomeGateMLVectorCompat,
): number {
  const dotProduct = a.features.reduce((sum, v, i) => sum + v * (b.features[i] ?? 0), 0);
  const magA = Math.sqrt(a.features.reduce((sum, v) => sum + v * v, 0));
  const magB = Math.sqrt(b.features.reduce((sum, v) => sum + v * v, 0));
  if (magA === 0 || magB === 0) return 0;
  return Math.max(0, Math.min(1, dotProduct / (magA * magB)));
}

/**
 * Get the top N most significant features from a gate ML vector.
 */
export function getTopGateMLFeatures(
  mlVector: OutcomeGateMLVectorCompat,
  topN = 5,
): ReadonlyArray<{ label: string; value: number }> {
  const pairs = mlVector.featureLabels.map((label, i) => ({
    label,
    value: mlVector.features[i] ?? 0,
  }));
  pairs.sort((a, b) => b.value - a.value);
  return Object.freeze(pairs.slice(0, topN));
}

/**
 * Flatten a gate DL tensor to a plain number array.
 */
export function flattenGateDLTensor(tensor: OutcomeGateDLTensorCompat): number[] {
  return [...tensor.inputVector];
}

/**
 * Extract a specific feature column from a gate DL tensor.
 */
export function extractGateDLColumn(
  tensor: OutcomeGateDLTensorCompat,
  colIndex: number,
): number {
  return tensor.inputVector[colIndex] ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default OutcomeGateSignalAdapter.
 * Standard mode — emits all signals above NOMINAL with proximity metadata.
 */
export const OUTCOME_GATE_DEFAULT_ADAPTER = new OutcomeGateSignalAdapter(DEFAULT_CONFIG);

/**
 * Strict OutcomeGateSignalAdapter.
 * Only emits HIGH_RISK+, CRITICAL_RISK, NEAR_FREEDOM, and TERMINAL signals.
 * Suppresses all NOMINAL and LOW urgency signals.
 */
export const OUTCOME_GATE_STRICT_ADAPTER = new OutcomeGateSignalAdapter(STRICT_CONFIG);

/**
 * Verbose OutcomeGateSignalAdapter.
 * Includes full ML vector, DL tensor, session report, and annotation bundle
 * in the signal metadata. Use for dev/admin surfaces and replay verification.
 */
export const OUTCOME_GATE_VERBOSE_ADAPTER = new OutcomeGateSignalAdapter(VERBOSE_CONFIG);
