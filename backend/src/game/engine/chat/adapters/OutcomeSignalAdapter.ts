/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT OUTCOME SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/OutcomeSignalAdapter.ts
 * VERSION: 2026.03.25
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates RuntimeOutcomeResolver signals —
 * narration hints, outcome proximity alerts, forecasts, ML/DL vector emissions,
 * and decision context payloads — into authoritative backend-chat ingress envelopes.
 *
 * Backend-truth question
 * ----------------------
 *   "When the outcome resolver determines the player is approaching bankruptcy,
 *    shifts its probability forecast, generates a narration hint, or emits a
 *    32/48-feature ML/DL vector, what exact chat-native signal should the
 *    authoritative backend chat engine ingest to drive companion NPC coaching
 *    and reflect real outcome proximity in the companion AI?"
 *
 * Design laws
 * -----------
 * - No circular imports from core/. All core types are mirrored as structural
 *   compat interfaces defined in this file.
 * - Callers pass real OutcomeNarrationHint / OutcomeProximity / OutcomeForecast
 *   objects — they satisfy the compat interfaces structurally.
 * - CRITICAL narration hints (urgencyLevel === 'CRITICAL') are always accepted.
 * - Forecast signals with high confidence and BANKRUPT/FREEDOM as most-likely
 *   outcome are always accepted regardless of dedupe window.
 * - LOW urgency narration hints are suppressed by default to keep chat focused.
 * - ML/DL vectors are only emitted when the respective flag is enabled.
 * - Proximity alerts for bankruptcy runway < 10 ticks are always accepted.
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
// Structural compat interfaces — mirrors of core outcome types
// ─────────────────────────────────────────────────────────────────────────────

/** Structural mirror of OutcomeNarrationHint from core/RuntimeOutcomeResolver.ts */
export interface OutcomeNarrationHintCompat {
  readonly runId: string;
  readonly tick: number;
  readonly urgencyLevel: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  readonly headline: string;
  readonly bodyText: string;
  readonly actionSuggestion: string;
  readonly tierContextMessage: string;
  readonly isWinPath: boolean;
  readonly excitementScore: number;
  readonly chatKind: 'RUN_SIGNAL' | 'BATTLE_SIGNAL';
  readonly metadata: Readonly<Record<string, unknown>>;
}

/** Structural mirror of OutcomeProximity from core/RuntimeOutcomeResolver.ts */
export interface OutcomeProximityCompat {
  readonly runId: string;
  readonly tick: number;
  readonly bankruptcyProximity: number;
  readonly freedomProximity: number;
  readonly timeoutProximity: number;
  readonly mostLikelyOutcome: string | null;
  readonly confidence: number;
  readonly bankruptcyRunwayTicks: number | null;
  readonly freedomSprintTicks: number | null;
  readonly timeoutRemainingTicks: number | null;
}

/** Structural mirror of OutcomeForecast from core/RuntimeOutcomeResolver.ts */
export interface OutcomeForecastCompat {
  readonly runId: string;
  readonly tick: number;
  readonly probabilities: {
    readonly FREEDOM: number;
    readonly TIMEOUT: number;
    readonly BANKRUPT: number;
    readonly ABANDONED: number;
  };
  readonly mostLikely: string;
  readonly confidence: number;
  readonly forecastHorizonTicks: number;
  readonly warningFlags: readonly string[];
  readonly forecastedAt: number;
}

/** Structural mirror of OutcomeMLVector from core/RuntimeOutcomeResolver.ts */
export interface OutcomeMLVectorCompat {
  readonly runId: string;
  readonly tick: number;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly vectorShape: readonly [1, 32] | readonly [number, number];
  readonly extractedAtMs: number;
}

/** Structural mirror of OutcomeDLTensor from core/RuntimeOutcomeResolver.ts */
export interface OutcomeDLTensorCompat {
  readonly runId: string;
  readonly tick: number;
  readonly inputVector: readonly number[];
  readonly featureLabels: readonly string[];
  readonly tensorShape: readonly [1, 48] | readonly [number, number];
  readonly policyVersion: string;
  readonly extractedAtMs: number;
}

/** Structural mirror of OutcomeDecisionContext from core/RuntimeOutcomeResolver.ts */
export interface OutcomeDecisionContextCompat {
  readonly decision: { readonly outcome: string | null; readonly runId: string; readonly tick: number };
  readonly proximity: OutcomeProximityCompat;
  readonly forecast: OutcomeForecastCompat;
  readonly narrationHint: OutcomeNarrationHintCompat;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter types
// ─────────────────────────────────────────────────────────────────────────────

export interface OutcomeSignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface OutcomeSignalAdapterClock {
  now(): UnixMs;
}

export interface OutcomeSignalAdapterOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly dedupeWindowMs?: number;
  readonly maxHistory?: number;
  /** Suppress NONE and LOW urgency narration hints (default: true). */
  readonly suppressLowUrgencyHints?: boolean;
  /** Emit ML vector signals via adaptML() (default: false). */
  readonly emitMLVectors?: boolean;
  /** Emit DL tensor signals via adaptDL() (default: false). */
  readonly emitDLTensors?: boolean;
  /** Minimum confidence level for forecast signals to be accepted (default: 0.6). */
  readonly forecastConfidenceThreshold?: number;
  /** Minimum bankruptcy proximity to trigger proximity alert (default: 0.7). */
  readonly bankruptcyProximityAlertThreshold?: number;
  readonly logger?: OutcomeSignalAdapterLogger;
  readonly clock?: OutcomeSignalAdapterClock;
}

export interface OutcomeSignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export type OutcomeSignalAdapterEventName =
  | 'outcome.narration.critical'
  | 'outcome.narration.high'
  | 'outcome.narration.moderate'
  | 'outcome.narration.low'
  | 'outcome.narration.battle'
  | 'outcome.proximity.bankruptcy_alert'
  | 'outcome.proximity.freedom_sprint'
  | 'outcome.proximity.timeout_warning'
  | 'outcome.forecast.bankrupt'
  | 'outcome.forecast.freedom'
  | 'outcome.forecast.shift'
  | 'outcome.ml.vector_emitted'
  | 'outcome.dl.tensor_emitted'
  | 'outcome.decision.context'
  | string;

export type OutcomeSignalAdapterNarrativeWeight =
  | 'AMBIENT'
  | 'TACTICAL'
  | 'WIN_PATH'
  | 'CRITICAL'
  | 'TERMINAL';

export type OutcomeSignalAdapterSeverity =
  | 'DEBUG'
  | 'INFO'
  | 'WARN'
  | 'CRITICAL';

export interface OutcomeSignalAdapterArtifact {
  readonly envelope: ChatInputEnvelope;
  readonly dedupeKey: string;
  readonly routeChannel: ChatVisibleChannel;
  readonly narrativeWeight: OutcomeSignalAdapterNarrativeWeight;
  readonly severity: OutcomeSignalAdapterSeverity;
  readonly eventName: OutcomeSignalAdapterEventName;
  readonly tick: number;
  readonly runId: string;
  readonly excitementScore: Score01;
  readonly isWinPath: boolean;
  readonly pressure100: Score100;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface OutcomeSignalAdapterRejection {
  readonly eventName: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface OutcomeSignalAdapterDeduped {
  readonly eventName: string;
  readonly dedupeKey: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface OutcomeSignalAdapterHistoryEntry {
  readonly at: UnixMs;
  readonly eventName: OutcomeSignalAdapterEventName;
  readonly tick: number;
  readonly runId: string;
  readonly severity: OutcomeSignalAdapterSeverity;
  readonly urgencyLevel: string;
  readonly isWinPath: boolean;
  readonly dedupeKey: string;
}

export interface OutcomeSignalAdapterReport {
  readonly accepted: readonly OutcomeSignalAdapterArtifact[];
  readonly deduped: readonly OutcomeSignalAdapterDeduped[];
  readonly rejected: readonly OutcomeSignalAdapterRejection[];
}

export interface OutcomeSignalAdapterState {
  readonly history: readonly OutcomeSignalAdapterHistoryEntry[];
  readonly lastAcceptedAtByKey: Readonly<Record<string, UnixMs>>;
  readonly lastUrgencyLevel: string;
  readonly acceptedCount: number;
  readonly dedupedCount: number;
  readonly rejectedCount: number;
  readonly criticalNarrationCount: number;
  readonly bankruptcyAlertCount: number;
  readonly forecastShiftCount: number;
  readonly mlVectorCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_DEDUPE_WINDOW_MS = 4_000;
const DEFAULT_MAX_HISTORY = 200;
const DEFAULT_FORECAST_CONFIDENCE_THRESHOLD = 0.6;
const DEFAULT_BANKRUPTCY_PROXIMITY_THRESHOLD = 0.7;

const NULL_LOGGER: OutcomeSignalAdapterLogger = Object.freeze({
  debug() {},
  warn() {},
  error() {},
});

const SYSTEM_CLOCK: OutcomeSignalAdapterClock = Object.freeze({
  now(): UnixMs { return asUnixMs(Date.now()); },
});

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function urgencyToSeverity(urgencyLevel: string): OutcomeSignalAdapterSeverity {
  switch (urgencyLevel) {
    case 'CRITICAL': return 'CRITICAL';
    case 'HIGH': return 'WARN';
    case 'MODERATE': return 'INFO';
    default: return 'DEBUG';
  }
}

function urgencyToEventName(
  hint: OutcomeNarrationHintCompat,
): OutcomeSignalAdapterEventName {
  if (hint.chatKind === 'BATTLE_SIGNAL') return 'outcome.narration.battle';
  switch (hint.urgencyLevel) {
    case 'CRITICAL': return 'outcome.narration.critical';
    case 'HIGH': return 'outcome.narration.high';
    case 'MODERATE': return 'outcome.narration.moderate';
    default: return 'outcome.narration.low';
  }
}

function classifyNarrativeWeight(
  urgencyLevel: string,
  isWinPath: boolean,
  severity: OutcomeSignalAdapterSeverity,
): OutcomeSignalAdapterNarrativeWeight {
  if (urgencyLevel === 'CRITICAL' && !isWinPath) return 'TERMINAL';
  if (urgencyLevel === 'CRITICAL' && isWinPath) return 'WIN_PATH';
  if (severity === 'CRITICAL') return 'CRITICAL';
  if (isWinPath && urgencyLevel === 'HIGH') return 'WIN_PATH';
  if (severity === 'WARN') return 'TACTICAL';
  return 'AMBIENT';
}

function buildOutcomeSignalEnvelope(
  eventName: string,
  runId: string,
  tick: number,
  excitement: number,
  helperBlackout: boolean,
  roomId: ChatRoomId | string | null,
  metadata: Record<string, JsonValue>,
  now: UnixMs,
): ChatSignalEnvelope {
  return Object.freeze({
    type: 'LIVEOPS' as const,
    emittedAt: now,
    roomId: (roomId ?? null) as Nullable<ChatRoomId>,
    liveops: Object.freeze({
      worldEventName: eventName,
      heatMultiplier01: clamp01(excitement) as Score01,
      helperBlackout,
      haterRaidActive: false,
    }),
    metadata: Object.freeze({
      runId,
      tick,
      ...metadata,
    } as Record<string, JsonValue>),
  });
}

function buildChatInputEnvelope(
  signalEnvelope: ChatSignalEnvelope,
  now: UnixMs,
): ChatInputEnvelope {
  return Object.freeze({
    kind: 'LIVEOPS_SIGNAL' as const,
    emittedAt: now,
    payload: signalEnvelope,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// OutcomeSignalAdapter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adapts RuntimeOutcomeResolver signals into backend-chat ingress envelopes.
 *
 * Filtering policy:
 * - CRITICAL narration hints: always accepted
 * - NONE/LOW narration hints: suppressed when suppressLowUrgencyHints is true (default)
 * - Forecasts: accepted only when confidence >= forecastConfidenceThreshold
 * - Proximity alerts: only when bankruptcy proximity >= threshold
 * - ML/DL vectors: only when respective flags are enabled
 */
export class OutcomeSignalAdapter {
  private readonly options: Required<OutcomeSignalAdapterOptions>;
  private readonly logger: OutcomeSignalAdapterLogger;
  private readonly clock: OutcomeSignalAdapterClock;

  private readonly history: OutcomeSignalAdapterHistoryEntry[] = [];
  private readonly lastAcceptedAtByKey: Map<string, UnixMs> = new Map();

  private acceptedCount = 0;
  private dedupedCount = 0;
  private rejectedCount = 0;
  private criticalNarrationCount = 0;
  private bankruptcyAlertCount = 0;
  private forecastShiftCount = 0;
  private mlVectorCount = 0;
  private lastUrgencyLevel = 'NONE';

  public constructor(options: OutcomeSignalAdapterOptions) {
    this.logger = options.logger ?? NULL_LOGGER;
    this.clock = options.clock ?? SYSTEM_CLOCK;
    this.options = Object.freeze({
      defaultRoomId: options.defaultRoomId,
      defaultVisibleChannel: options.defaultVisibleChannel ?? 'GLOBAL',
      dedupeWindowMs: options.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS,
      maxHistory: options.maxHistory ?? DEFAULT_MAX_HISTORY,
      suppressLowUrgencyHints: options.suppressLowUrgencyHints ?? true,
      emitMLVectors: options.emitMLVectors ?? false,
      emitDLTensors: options.emitDLTensors ?? false,
      forecastConfidenceThreshold: options.forecastConfidenceThreshold ?? DEFAULT_FORECAST_CONFIDENCE_THRESHOLD,
      bankruptcyProximityAlertThreshold: options.bankruptcyProximityAlertThreshold ?? DEFAULT_BANKRUPTCY_PROXIMITY_THRESHOLD,
      logger: this.logger,
      clock: this.clock,
    });
  }

  /**
   * Adapt a narration hint into a ChatInputEnvelope.
   * CRITICAL hints are always accepted. NONE/LOW hints are suppressed by default.
   */
  public adapt(
    hint: OutcomeNarrationHintCompat,
    ctx: OutcomeSignalAdapterContext = {},
  ): OutcomeSignalAdapterArtifact | null {
    const now = this.clock.now();

    // Suppress low-urgency hints
    if (
      this.options.suppressLowUrgencyHints &&
      (hint.urgencyLevel === 'NONE' || hint.urgencyLevel === 'LOW')
    ) {
      this.rejectedCount++;
      this.logger.debug('OutcomeSignalAdapter: suppressed low urgency hint', {
        runId: hint.runId, tick: hint.tick, urgencyLevel: hint.urgencyLevel,
      });
      return null;
    }

    const roomId = ctx.roomId ?? this.options.defaultRoomId;
    const channel = ctx.routeChannel ?? this.options.defaultVisibleChannel;
    const eventName = urgencyToEventName(hint);
    const dedupeKey = `narration:${hint.runId}:${hint.tick}:${hint.urgencyLevel}:${hint.chatKind}`;

    // Critical hints always fire, others are deduped
    const isAlwaysAccept = hint.urgencyLevel === 'CRITICAL';

    if (!isAlwaysAccept) {
      const lastAt = this.lastAcceptedAtByKey.get(dedupeKey);
      if (lastAt !== undefined && (now - lastAt) < this.options.dedupeWindowMs) {
        this.dedupedCount++;
        return null;
      }
    }

    const severity = urgencyToSeverity(hint.urgencyLevel);
    const narrativeWeight = classifyNarrativeWeight(hint.urgencyLevel, hint.isWinPath, severity);
    const excitement = clamp01(hint.excitementScore) as Score01;
    const pressure100 = Math.round(excitement * 100) as Score100;
    const helperBlackout = hint.urgencyLevel === 'CRITICAL' && !hint.isWinPath;

    const signalEnvelope = buildOutcomeSignalEnvelope(
      eventName, hint.runId, hint.tick, excitement, helperBlackout,
      roomId as ChatRoomId | string | null,
      {
        urgencyLevel: hint.urgencyLevel,
        headline: hint.headline,
        bodyText: hint.bodyText,
        actionSuggestion: hint.actionSuggestion,
        tierContextMessage: hint.tierContextMessage,
        isWinPath: hint.isWinPath,
        chatKind: hint.chatKind,
        excitementScore: parseFloat(excitement.toFixed(4)),
        pressure100,
        ...(ctx.metadata ?? {}),
      },
      now,
    );

    const envelope = buildChatInputEnvelope(signalEnvelope, now);

    const artifact: OutcomeSignalAdapterArtifact = Object.freeze({
      envelope,
      dedupeKey,
      routeChannel: channel as ChatVisibleChannel,
      narrativeWeight,
      severity,
      eventName,
      tick: hint.tick,
      runId: hint.runId,
      excitementScore: excitement,
      isWinPath: hint.isWinPath,
      pressure100,
      details: Object.freeze({
        runId: hint.runId,
        tick: hint.tick,
        urgencyLevel: hint.urgencyLevel,
        headline: hint.headline,
        actionSuggestion: hint.actionSuggestion,
        isWinPath: hint.isWinPath,
        chatKind: hint.chatKind,
        excitementScore: parseFloat(excitement.toFixed(4)),
      } as Record<string, JsonValue>),
    });

    this.lastAcceptedAtByKey.set(dedupeKey, now);
    this.acceptedCount++;
    this.lastUrgencyLevel = hint.urgencyLevel;
    if (hint.urgencyLevel === 'CRITICAL') this.criticalNarrationCount++;

    this.pushHistory({
      at: now,
      eventName,
      tick: hint.tick,
      runId: hint.runId,
      severity,
      urgencyLevel: hint.urgencyLevel,
      isWinPath: hint.isWinPath,
      dedupeKey,
    });

    return artifact;
  }

  /**
   * Adapt an outcome proximity report into a ChatInputEnvelope.
   * Only fires when bankruptcy proximity exceeds the configured threshold,
   * or when bankruptcy runway ticks are critically low.
   */
  public adaptProximity(
    prox: OutcomeProximityCompat,
    ctx: OutcomeSignalAdapterContext = {},
  ): OutcomeSignalAdapterArtifact | null {
    const now = this.clock.now();

    // Select which proximity alert to emit
    const isBankruptcyAlert = prox.bankruptcyProximity >= this.options.bankruptcyProximityAlertThreshold;
    const isCriticalRunway = prox.bankruptcyRunwayTicks !== null && prox.bankruptcyRunwayTicks <= 5;
    const isFreedomSprint = prox.freedomProximity >= 0.8 && prox.freedomSprintTicks !== null && prox.freedomSprintTicks <= 15;
    const isTimeoutWarning = prox.timeoutProximity >= 0.85;

    if (!isBankruptcyAlert && !isCriticalRunway && !isFreedomSprint && !isTimeoutWarning) {
      this.rejectedCount++;
      return null;
    }

    const roomId = ctx.roomId ?? this.options.defaultRoomId;
    const channel = ctx.routeChannel ?? this.options.defaultVisibleChannel;

    let eventName: OutcomeSignalAdapterEventName;
    let severity: OutcomeSignalAdapterSeverity;
    let excitement: number;

    if (isBankruptcyAlert || isCriticalRunway) {
      eventName = 'outcome.proximity.bankruptcy_alert';
      severity = isCriticalRunway ? 'CRITICAL' : 'WARN';
      excitement = prox.bankruptcyProximity;
    } else if (isFreedomSprint) {
      eventName = 'outcome.proximity.freedom_sprint';
      severity = 'INFO';
      excitement = prox.freedomProximity;
    } else {
      eventName = 'outcome.proximity.timeout_warning';
      severity = 'WARN';
      excitement = prox.timeoutProximity;
    }

    const dedupeKey = `proximity:${prox.runId}:${prox.tick}:${eventName}`;
    const isAlwaysAccept = isCriticalRunway || severity === 'CRITICAL';

    if (!isAlwaysAccept) {
      const lastAt = this.lastAcceptedAtByKey.get(dedupeKey);
      if (lastAt !== undefined && (now - lastAt) < this.options.dedupeWindowMs) {
        this.dedupedCount++;
        return null;
      }
    }

    const score = clamp01(excitement) as Score01;
    const pressure100 = Math.round(score * 100) as Score100;
    const narrativeWeight = classifyNarrativeWeight(
      severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      isFreedomSprint,
      severity,
    );

    const signalEnvelope = buildOutcomeSignalEnvelope(
      eventName, prox.runId, prox.tick, score, severity === 'CRITICAL',
      roomId as ChatRoomId | string | null,
      {
        bankruptcyProximity: parseFloat(prox.bankruptcyProximity.toFixed(4)),
        freedomProximity: parseFloat(prox.freedomProximity.toFixed(4)),
        timeoutProximity: parseFloat(prox.timeoutProximity.toFixed(4)),
        mostLikelyOutcome: prox.mostLikelyOutcome ?? null,
        confidence: parseFloat(prox.confidence.toFixed(4)),
        bankruptcyRunwayTicks: prox.bankruptcyRunwayTicks ?? null,
        freedomSprintTicks: prox.freedomSprintTicks ?? null,
        timeoutRemainingTicks: prox.timeoutRemainingTicks ?? null,
        pressure100,
      },
      now,
    );

    const envelope = buildChatInputEnvelope(signalEnvelope, now);

    const artifact: OutcomeSignalAdapterArtifact = Object.freeze({
      envelope,
      dedupeKey,
      routeChannel: channel as ChatVisibleChannel,
      narrativeWeight,
      severity,
      eventName,
      tick: prox.tick,
      runId: prox.runId,
      excitementScore: score,
      isWinPath: isFreedomSprint,
      pressure100,
      details: Object.freeze({
        runId: prox.runId,
        tick: prox.tick,
        bankruptcyProximity: parseFloat(prox.bankruptcyProximity.toFixed(4)),
        freedomProximity: parseFloat(prox.freedomProximity.toFixed(4)),
        mostLikelyOutcome: prox.mostLikelyOutcome ?? null,
        bankruptcyRunwayTicks: prox.bankruptcyRunwayTicks ?? null,
        pressure100,
      } as Record<string, JsonValue>),
    });

    this.lastAcceptedAtByKey.set(dedupeKey, now);
    this.acceptedCount++;
    if (isBankruptcyAlert || isCriticalRunway) this.bankruptcyAlertCount++;

    this.pushHistory({
      at: now,
      eventName,
      tick: prox.tick,
      runId: prox.runId,
      severity,
      urgencyLevel: severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      isWinPath: isFreedomSprint,
      dedupeKey,
    });

    return artifact;
  }

  /**
   * Adapt an outcome forecast into a ChatInputEnvelope.
   * Only accepted when confidence >= forecastConfidenceThreshold.
   * BANKRUPT and FREEDOM forecasts are always flagged when confidence is high.
   */
  public adaptForecast(
    forecast: OutcomeForecastCompat,
    ctx: OutcomeSignalAdapterContext = {},
  ): OutcomeSignalAdapterArtifact | null {
    if (forecast.confidence < this.options.forecastConfidenceThreshold) {
      this.rejectedCount++;
      return null;
    }

    const now = this.clock.now();
    const roomId = ctx.roomId ?? this.options.defaultRoomId;
    const channel = ctx.routeChannel ?? this.options.defaultVisibleChannel;

    const isHighStakes = forecast.mostLikely === 'BANKRUPT' || forecast.mostLikely === 'FREEDOM';
    const eventName: OutcomeSignalAdapterEventName =
      forecast.mostLikely === 'BANKRUPT' ? 'outcome.forecast.bankrupt' :
      forecast.mostLikely === 'FREEDOM' ? 'outcome.forecast.freedom' :
      'outcome.forecast.shift';

    const dedupeKey = `forecast:${forecast.runId}:${forecast.tick}:${forecast.mostLikely}`;
    const isAlwaysAccept = isHighStakes && forecast.confidence >= 0.8;

    if (!isAlwaysAccept) {
      const lastAt = this.lastAcceptedAtByKey.get(dedupeKey);
      if (lastAt !== undefined && (now - lastAt) < this.options.dedupeWindowMs) {
        this.dedupedCount++;
        return null;
      }
    }

    const severity: OutcomeSignalAdapterSeverity =
      forecast.mostLikely === 'BANKRUPT' && forecast.confidence >= 0.8 ? 'CRITICAL' :
      isHighStakes ? 'WARN' : 'INFO';

    const excitement = clamp01(forecast.confidence) as Score01;
    const pressure100 = clamp100(forecast.probabilities.BANKRUPT * 100) as Score100;
    const narrativeWeight = classifyNarrativeWeight(
      severity === 'CRITICAL' ? 'CRITICAL' : severity === 'WARN' ? 'HIGH' : 'MODERATE',
      forecast.mostLikely === 'FREEDOM',
      severity,
    );

    const signalEnvelope = buildOutcomeSignalEnvelope(
      eventName, forecast.runId, forecast.tick, excitement,
      severity === 'CRITICAL',
      roomId as ChatRoomId | string | null,
      {
        mostLikely: forecast.mostLikely,
        confidence: parseFloat(forecast.confidence.toFixed(4)),
        forecastHorizonTicks: forecast.forecastHorizonTicks,
        probabilityFreedom: parseFloat(forecast.probabilities.FREEDOM.toFixed(4)),
        probabilityBankrupt: parseFloat(forecast.probabilities.BANKRUPT.toFixed(4)),
        probabilityTimeout: parseFloat(forecast.probabilities.TIMEOUT.toFixed(4)),
        warningFlagCount: forecast.warningFlags.length,
        warningFlags: forecast.warningFlags.slice(0, 3).join('; '),
        pressure100,
      },
      now,
    );

    const envelope = buildChatInputEnvelope(signalEnvelope, now);

    const artifact: OutcomeSignalAdapterArtifact = Object.freeze({
      envelope,
      dedupeKey,
      routeChannel: channel as ChatVisibleChannel,
      narrativeWeight,
      severity,
      eventName,
      tick: forecast.tick,
      runId: forecast.runId,
      excitementScore: excitement,
      isWinPath: forecast.mostLikely === 'FREEDOM',
      pressure100,
      details: Object.freeze({
        runId: forecast.runId,
        tick: forecast.tick,
        mostLikely: forecast.mostLikely,
        confidence: parseFloat(forecast.confidence.toFixed(4)),
        forecastHorizonTicks: forecast.forecastHorizonTicks,
        isHighStakes,
        warningFlagCount: forecast.warningFlags.length,
        pressure100,
      } as Record<string, JsonValue>),
    });

    this.lastAcceptedAtByKey.set(dedupeKey, now);
    this.acceptedCount++;
    this.forecastShiftCount++;

    this.pushHistory({
      at: now,
      eventName,
      tick: forecast.tick,
      runId: forecast.runId,
      severity,
      urgencyLevel: severity === 'CRITICAL' ? 'CRITICAL' : isHighStakes ? 'HIGH' : 'MODERATE',
      isWinPath: forecast.mostLikely === 'FREEDOM',
      dedupeKey,
    });

    return artifact;
  }

  /**
   * Adapt a full decision context into a ChatInputEnvelope.
   * Delegates to adapt() using the embedded narration hint, but augments with
   * forecast and proximity metadata for maximum companion signal richness.
   */
  public adaptDecisionContext(
    ctx_in: OutcomeDecisionContextCompat,
    ctx: OutcomeSignalAdapterContext = {},
  ): OutcomeSignalAdapterArtifact | null {
    // Augment the narration hint metadata with forecast and proximity
    const augmentedCtx: OutcomeSignalAdapterContext = {
      ...ctx,
      metadata: {
        ...(ctx.metadata ?? {}),
        decision: ctx_in.decision.outcome ?? 'PENDING',
        bankruptcyProximity: parseFloat(ctx_in.proximity.bankruptcyProximity.toFixed(4)),
        freedomProximity: parseFloat(ctx_in.proximity.freedomProximity.toFixed(4)),
        forecastMostLikely: ctx_in.forecast.mostLikely,
        forecastConfidence: parseFloat(ctx_in.forecast.confidence.toFixed(4)),
      } as Record<string, JsonValue>,
    };
    return this.adapt(ctx_in.narrationHint, augmentedCtx);
  }

  /**
   * Adapt an outcome ML vector into a ChatInputEnvelope.
   * Only accepted when emitMLVectors is true.
   */
  public adaptML(
    mlVector: OutcomeMLVectorCompat,
    ctx: OutcomeSignalAdapterContext = {},
  ): OutcomeSignalAdapterArtifact | null {
    if (!this.options.emitMLVectors) return null;

    const now = this.clock.now();
    const roomId = ctx.roomId ?? this.options.defaultRoomId;
    const channel = ctx.routeChannel ?? this.options.defaultVisibleChannel;
    const dedupeKey = `ml:${mlVector.runId}:${mlVector.tick}`;

    const lastAt = this.lastAcceptedAtByKey.get(dedupeKey);
    if (lastAt !== undefined && (now - lastAt) < this.options.dedupeWindowMs) {
      this.dedupedCount++;
      return null;
    }

    const avgFeature = mlVector.features.length > 0
      ? mlVector.features.reduce((a, b) => a + b, 0) / mlVector.features.length
      : 0;
    const excitement = clamp01(avgFeature) as Score01;
    const pressure100 = Math.round(excitement * 100) as Score100;

    const signalEnvelope = buildOutcomeSignalEnvelope(
      'outcome.ml.vector_emitted', mlVector.runId, mlVector.tick, excitement, false,
      roomId as ChatRoomId | string | null,
      {
        featureCount: mlVector.features.length,
        avgFeatureValue: parseFloat(avgFeature.toFixed(6)),
        vectorShape: JSON.stringify(mlVector.vectorShape),
        extractedAtMs: mlVector.extractedAtMs,
        pressure100,
        labels: mlVector.featureLabels.slice(0, 8).join(','),
      },
      now,
    );

    const envelope = buildChatInputEnvelope(signalEnvelope, now);

    const artifact: OutcomeSignalAdapterArtifact = Object.freeze({
      envelope,
      dedupeKey,
      routeChannel: channel as ChatVisibleChannel,
      narrativeWeight: 'AMBIENT',
      severity: 'DEBUG',
      eventName: 'outcome.ml.vector_emitted',
      tick: mlVector.tick,
      runId: mlVector.runId,
      excitementScore: excitement,
      isWinPath: false,
      pressure100,
      details: Object.freeze({
        runId: mlVector.runId,
        tick: mlVector.tick,
        featureCount: mlVector.features.length,
        avgFeatureValue: parseFloat(avgFeature.toFixed(6)),
        pressure100,
      } as Record<string, JsonValue>),
    });

    this.lastAcceptedAtByKey.set(dedupeKey, now);
    this.acceptedCount++;
    this.mlVectorCount++;

    this.pushHistory({
      at: now,
      eventName: 'outcome.ml.vector_emitted',
      tick: mlVector.tick,
      runId: mlVector.runId,
      severity: 'DEBUG',
      urgencyLevel: 'NONE',
      isWinPath: false,
      dedupeKey,
    });

    return artifact;
  }

  /**
   * Adapt an outcome DL tensor into a ChatInputEnvelope.
   * Only accepted when emitDLTensors is true.
   */
  public adaptDL(
    dlTensor: OutcomeDLTensorCompat,
    ctx: OutcomeSignalAdapterContext = {},
  ): OutcomeSignalAdapterArtifact | null {
    if (!this.options.emitDLTensors) return null;

    const now = this.clock.now();
    const roomId = ctx.roomId ?? this.options.defaultRoomId;
    const channel = ctx.routeChannel ?? this.options.defaultVisibleChannel;
    const dedupeKey = `dl:${dlTensor.runId}:${dlTensor.tick}`;

    const lastAt = this.lastAcceptedAtByKey.get(dedupeKey);
    if (lastAt !== undefined && (now - lastAt) < this.options.dedupeWindowMs) {
      this.dedupedCount++;
      return null;
    }

    const avgInput = dlTensor.inputVector.length > 0
      ? dlTensor.inputVector.reduce((a, b) => a + b, 0) / dlTensor.inputVector.length
      : 0;
    const excitement = clamp01(avgInput) as Score01;
    const pressure100 = Math.round(excitement * 100) as Score100;

    const signalEnvelope = buildOutcomeSignalEnvelope(
      'outcome.dl.tensor_emitted', dlTensor.runId, dlTensor.tick, excitement, false,
      roomId as ChatRoomId | string | null,
      {
        featureCount: dlTensor.inputVector.length,
        avgInputValue: parseFloat(avgInput.toFixed(6)),
        tensorShape: JSON.stringify(dlTensor.tensorShape),
        policyVersion: dlTensor.policyVersion,
        extractedAtMs: dlTensor.extractedAtMs,
        pressure100,
      },
      now,
    );

    const envelope = buildChatInputEnvelope(signalEnvelope, now);

    const artifact: OutcomeSignalAdapterArtifact = Object.freeze({
      envelope,
      dedupeKey,
      routeChannel: channel as ChatVisibleChannel,
      narrativeWeight: 'AMBIENT',
      severity: 'DEBUG',
      eventName: 'outcome.dl.tensor_emitted',
      tick: dlTensor.tick,
      runId: dlTensor.runId,
      excitementScore: excitement,
      isWinPath: false,
      pressure100,
      details: Object.freeze({
        runId: dlTensor.runId,
        tick: dlTensor.tick,
        featureCount: dlTensor.inputVector.length,
        avgInputValue: parseFloat(avgInput.toFixed(6)),
        policyVersion: dlTensor.policyVersion,
        pressure100,
      } as Record<string, JsonValue>),
    });

    this.lastAcceptedAtByKey.set(dedupeKey, now);
    this.acceptedCount++;

    this.pushHistory({
      at: now,
      eventName: 'outcome.dl.tensor_emitted',
      tick: dlTensor.tick,
      runId: dlTensor.runId,
      severity: 'DEBUG',
      urgencyLevel: 'NONE',
      isWinPath: false,
      dedupeKey,
    });

    return artifact;
  }

  /** Batch-adapt an array of narration hints. */
  public adaptBatch(
    hints: readonly OutcomeNarrationHintCompat[],
    ctx: OutcomeSignalAdapterContext = {},
  ): readonly OutcomeSignalAdapterArtifact[] {
    const results: OutcomeSignalAdapterArtifact[] = [];
    for (const hint of hints) {
      const artifact = this.adapt(hint, ctx);
      if (artifact !== null) results.push(artifact);
    }
    return Object.freeze(results);
  }

  /** Return the current accumulated state snapshot. */
  public state(): OutcomeSignalAdapterState {
    const lastAcceptedAtByKey: Record<string, UnixMs> = {};
    for (const [k, v] of this.lastAcceptedAtByKey) {
      lastAcceptedAtByKey[k] = v;
    }
    return Object.freeze({
      history: Object.freeze([...this.history]),
      lastAcceptedAtByKey: Object.freeze(lastAcceptedAtByKey),
      lastUrgencyLevel: this.lastUrgencyLevel,
      acceptedCount: this.acceptedCount,
      dedupedCount: this.dedupedCount,
      rejectedCount: this.rejectedCount,
      criticalNarrationCount: this.criticalNarrationCount,
      bankruptcyAlertCount: this.bankruptcyAlertCount,
      forecastShiftCount: this.forecastShiftCount,
      mlVectorCount: this.mlVectorCount,
    });
  }

  /** Return a point-in-time report of accepted/deduped/rejected entries. */
  public report(): OutcomeSignalAdapterReport {
    return Object.freeze({
      accepted: Object.freeze([...this.history].map((h) => ({
        envelope: {} as ChatInputEnvelope,
        dedupeKey: h.dedupeKey,
        routeChannel: 'GLOBAL' as ChatVisibleChannel,
        narrativeWeight: classifyNarrativeWeight(h.urgencyLevel, h.isWinPath, h.severity),
        severity: h.severity,
        eventName: h.eventName,
        tick: h.tick,
        runId: h.runId,
        excitementScore: 0 as Score01,
        isWinPath: h.isWinPath,
        pressure100: 0 as Score100,
        details: Object.freeze({}) as Readonly<Record<string, JsonValue>>,
      }))),
      deduped: Object.freeze([]),
      rejected: Object.freeze([]),
    });
  }

  /** Reset adapter state (call between sessions/runs). */
  public reset(): void {
    this.history.length = 0;
    this.lastAcceptedAtByKey.clear();
    this.acceptedCount = 0;
    this.dedupedCount = 0;
    this.rejectedCount = 0;
    this.criticalNarrationCount = 0;
    this.bankruptcyAlertCount = 0;
    this.forecastShiftCount = 0;
    this.mlVectorCount = 0;
    this.lastUrgencyLevel = 'NONE';
  }

  private pushHistory(entry: OutcomeSignalAdapterHistoryEntry): void {
    this.history.push(entry);
    if (this.history.length > this.options.maxHistory) {
      this.history.shift();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convenience factory that creates a fully-configured OutcomeSignalAdapter.
 */
export function createOutcomeSignalAdapter(
  options: OutcomeSignalAdapterOptions,
): OutcomeSignalAdapter {
  return new OutcomeSignalAdapter(options);
}
