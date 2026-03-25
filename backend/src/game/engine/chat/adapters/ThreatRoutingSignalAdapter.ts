/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT THREAT ROUTING SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/ThreatRoutingSignalAdapter.ts
 * VERSION: 2026.03.25
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates ThreatRoutingService chat signals —
 * surge events, direct attacks, bot coordination detections, counter window
 * opportunities, shield targeting, ambient threat spawns, high-magnitude routes,
 * and ML/DL vector emissions — into authoritative backend-chat ingress envelopes.
 *
 * Backend-truth question
 * ----------------------
 *   "When the threat router detects a surge, a direct attack bypasses shields,
 *    bots coordinate, or the ML/DL threat vector is emitted, what exact
 *    chat-native signal should the authoritative backend chat engine ingest to
 *    preserve simulation fidelity and drive pre-emptive companion NPC coaching?"
 *
 * Design laws
 * -----------
 * - No circular imports from core/. All core types are mirrored as structural
 *   compat interfaces defined in this file.
 * - Callers pass real ThreatChatSignalPayload objects — they satisfy the compat
 *   interfaces structurally without any casting.
 * - THREAT_SURGE_DETECTED and DIRECT_ATTACK_INCOMING are always accepted and
 *   routed as CRITICAL — they represent immediate simulation threats.
 * - BOT_COORDINATION_DETECTED is always accepted as HIGH severity.
 * - THREAT_ROUTED events are suppressed by default to avoid flooding the chat
 *   engine with every routine routing tick.
 * - Counter advice is embedded in signal metadata when present.
 * - ML/DL vectors are only emitted when the respective flag is enabled.
 * - Dedupe window prevents repeated firing for the same surge/attack on
 *   consecutive ticks within the configured window.
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
// Structural compat interfaces — mirrors of core threat routing types
// ─────────────────────────────────────────────────────────────────────────────

/** Structural mirror of CounterStrategyAdvice from core/ThreatRoutingService.ts */
export interface CounterStrategyAdviceCompat {
  readonly runId: string;
  readonly tick: number;
  readonly primaryCounterCategory: string | null;
  readonly recommendedTimingClasses: readonly string[];
  readonly counterableAttackCount: number;
  readonly uncounterableAttackCount: number;
  readonly bestCounterWindowPriority: number;
  readonly urgencyScore: number;
  readonly actionPhrases: readonly string[];
  readonly countersAvailable: boolean;
}

/** Structural mirror of ThreatChatSignalPayload from core/ThreatRoutingService.ts */
export interface ThreatChatSignalCompat {
  readonly signalId: string;
  readonly runId: string;
  readonly tick: number;
  readonly urgency: 'BACKGROUND' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  readonly signalKind:
    | 'THREAT_ROUTED'
    | 'THREAT_SURGE_DETECTED'
    | 'BOT_COORDINATION_DETECTED'
    | 'COUNTER_WINDOW_OPEN'
    | 'DIRECT_ATTACK_INCOMING'
    | 'SHIELD_TARGETED'
    | 'AMBIENT_THREAT_SPAWNED'
    | 'HIGH_MAGNITUDE_ROUTE'
    | string;
  readonly companionMessage: string;
  readonly pressureTierLabel: string;
  readonly pressureTierExperience: string;
  readonly counterAdvice: CounterStrategyAdviceCompat | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/** Structural mirror of ThreatMLVector from core/ThreatRoutingService.ts */
export interface ThreatMLVectorCompat {
  readonly runId: string;
  readonly tick: number;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly vectorShape: readonly [1, 32] | readonly [number, number];
  readonly extractedAtMs: number;
}

/** Structural mirror of ThreatDLTensor from core/ThreatRoutingService.ts */
export interface ThreatDLTensorCompat {
  readonly runId: string;
  readonly tick: number;
  readonly inputVector: readonly number[];
  readonly featureLabels: readonly string[];
  readonly tensorShape: readonly [1, 48] | readonly [number, number];
  readonly policyVersion: string;
  readonly extractedAtMs: number;
}

/** Structural mirror of ThreatSurgeEvent from core/ThreatRoutingService.ts */
export interface ThreatSurgeEventCompat {
  readonly tick: number;
  readonly deltaAggregatePressure: number;
  readonly prevPressure: number;
  readonly currPressure: number;
  readonly triggeredBy: string;
}

/** Structural mirror of ThreatBotPrediction from core/ThreatRoutingService.ts */
export interface ThreatBotPredictionCompat {
  readonly botId: string;
  readonly currentState: string;
  readonly predictedNextState: string;
  readonly attackProbability: number;
  readonly estimatedAttackMagnitude: number;
  readonly ticksUntilStateChange: number | null;
  readonly confidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter types
// ─────────────────────────────────────────────────────────────────────────────

export interface ThreatRoutingSignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ThreatRoutingSignalAdapterClock {
  now(): UnixMs;
}

export interface ThreatRoutingSignalAdapterOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly dedupeWindowMs?: number;
  readonly maxHistory?: number;
  /** Suppress low-signal THREAT_ROUTED events (default: true). */
  readonly suppressRoutineRoutes?: boolean;
  /** Emit ML vector signals via adaptML() (default: false). */
  readonly emitMLVectors?: boolean;
  /** Emit DL tensor signals via adaptDL() (default: false). */
  readonly emitDLTensors?: boolean;
  /** Include counter strategy advice in signal metadata (default: true). */
  readonly includeCounterAdvice?: boolean;
  readonly logger?: ThreatRoutingSignalAdapterLogger;
  readonly clock?: ThreatRoutingSignalAdapterClock;
}

export interface ThreatRoutingSignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export type ThreatRoutingSignalAdapterEventName =
  | 'threat.routed'
  | 'threat.surge.detected'
  | 'threat.bot.coordination'
  | 'threat.counter.window_open'
  | 'threat.direct_attack.incoming'
  | 'threat.shield.targeted'
  | 'threat.ambient.spawned'
  | 'threat.route.high_magnitude'
  | 'threat.ml.vector_emitted'
  | 'threat.dl.tensor_emitted'
  | 'threat.surge.standalone'
  | 'threat.bot.prediction'
  | string;

export type ThreatRoutingSignalAdapterNarrativeWeight =
  | 'AMBIENT'
  | 'TACTICAL'
  | 'COUNTER_OPPORTUNITY'
  | 'CRITICAL'
  | 'RAID';

export type ThreatRoutingSignalAdapterSeverity =
  | 'DEBUG'
  | 'INFO'
  | 'WARN'
  | 'CRITICAL';

export interface ThreatRoutingSignalAdapterArtifact {
  readonly envelope: ChatInputEnvelope;
  readonly dedupeKey: string;
  readonly routeChannel: ChatVisibleChannel;
  readonly narrativeWeight: ThreatRoutingSignalAdapterNarrativeWeight;
  readonly severity: ThreatRoutingSignalAdapterSeverity;
  readonly eventName: ThreatRoutingSignalAdapterEventName;
  readonly tick: number;
  readonly runId: string;
  readonly urgency: ThreatChatSignalCompat['urgency'];
  readonly signalKind: string;
  readonly haterRaidActive: boolean;
  readonly counterAvailable: boolean;
  readonly pressure100: Score100;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface ThreatRoutingSignalAdapterRejection {
  readonly eventName: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface ThreatRoutingSignalAdapterDeduped {
  readonly eventName: string;
  readonly dedupeKey: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface ThreatRoutingSignalAdapterHistoryEntry {
  readonly at: UnixMs;
  readonly eventName: ThreatRoutingSignalAdapterEventName;
  readonly tick: number;
  readonly runId: string;
  readonly severity: ThreatRoutingSignalAdapterSeverity;
  readonly signalKind: string;
  readonly urgency: string;
  readonly dedupeKey: string;
}

export interface ThreatRoutingSignalAdapterReport {
  readonly accepted: readonly ThreatRoutingSignalAdapterArtifact[];
  readonly deduped: readonly ThreatRoutingSignalAdapterDeduped[];
  readonly rejected: readonly ThreatRoutingSignalAdapterRejection[];
}

export interface ThreatRoutingSignalAdapterState {
  readonly history: readonly ThreatRoutingSignalAdapterHistoryEntry[];
  readonly lastAcceptedAtByKey: Readonly<Record<string, UnixMs>>;
  readonly lastSignalKind: string;
  readonly acceptedCount: number;
  readonly dedupedCount: number;
  readonly rejectedCount: number;
  readonly surgeAlertCount: number;
  readonly directAttackCount: number;
  readonly botCoordinationCount: number;
  readonly counterWindowCount: number;
  readonly mlVectorCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_DEDUPE_WINDOW_MS = 3_000;
const DEFAULT_MAX_HISTORY = 200;

const NULL_LOGGER: ThreatRoutingSignalAdapterLogger = Object.freeze({
  debug() {},
  warn() {},
  error() {},
});

const SYSTEM_CLOCK: ThreatRoutingSignalAdapterClock = Object.freeze({
  now(): UnixMs { return asUnixMs(Date.now()); },
});

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function signalKindToEventName(kind: string): ThreatRoutingSignalAdapterEventName {
  switch (kind) {
    case 'THREAT_ROUTED': return 'threat.routed';
    case 'THREAT_SURGE_DETECTED': return 'threat.surge.detected';
    case 'BOT_COORDINATION_DETECTED': return 'threat.bot.coordination';
    case 'COUNTER_WINDOW_OPEN': return 'threat.counter.window_open';
    case 'DIRECT_ATTACK_INCOMING': return 'threat.direct_attack.incoming';
    case 'SHIELD_TARGETED': return 'threat.shield.targeted';
    case 'AMBIENT_THREAT_SPAWNED': return 'threat.ambient.spawned';
    case 'HIGH_MAGNITUDE_ROUTE': return 'threat.route.high_magnitude';
    default: return `threat.${kind.toLowerCase()}`;
  }
}

function classifySeverity(
  urgency: ThreatChatSignalCompat['urgency'],
  signalKind: string,
): ThreatRoutingSignalAdapterSeverity {
  if (
    urgency === 'CRITICAL' ||
    signalKind === 'DIRECT_ATTACK_INCOMING' ||
    signalKind === 'THREAT_SURGE_DETECTED'
  ) return 'CRITICAL';
  if (
    urgency === 'HIGH' ||
    signalKind === 'BOT_COORDINATION_DETECTED' ||
    signalKind === 'SHIELD_TARGETED' ||
    signalKind === 'HIGH_MAGNITUDE_ROUTE'
  ) return 'WARN';
  if (urgency === 'MODERATE' || signalKind === 'COUNTER_WINDOW_OPEN') return 'INFO';
  return 'DEBUG';
}

function classifyNarrativeWeight(
  signalKind: string,
  severity: ThreatRoutingSignalAdapterSeverity,
): ThreatRoutingSignalAdapterNarrativeWeight {
  if (signalKind === 'THREAT_SURGE_DETECTED' || signalKind === 'DIRECT_ATTACK_INCOMING') return 'CRITICAL';
  if (signalKind === 'BOT_COORDINATION_DETECTED') return 'RAID';
  if (signalKind === 'COUNTER_WINDOW_OPEN') return 'COUNTER_OPPORTUNITY';
  if (severity === 'WARN') return 'TACTICAL';
  return 'AMBIENT';
}

function urgencyToHeatMultiplier(urgency: string): number {
  switch (urgency) {
    case 'CRITICAL': return 1.0;
    case 'HIGH': return 0.75;
    case 'MODERATE': return 0.5;
    case 'LOW': return 0.25;
    default: return 0.1;
  }
}

function buildThreatSignalEnvelope(
  signal: ThreatChatSignalCompat,
  roomId: ChatRoomId | string | null,
  heatMultiplier: number,
  haterRaidActive: boolean,
  helperBlackout: boolean,
  counterMetadata: Record<string, JsonValue>,
  now: UnixMs,
): ChatSignalEnvelope {
  return Object.freeze({
    type: 'LIVEOPS' as const,
    emittedAt: now,
    roomId: (roomId ?? null) as Nullable<ChatRoomId>,
    liveops: Object.freeze({
      worldEventName: signalKindToEventName(signal.signalKind),
      heatMultiplier01: clamp01(heatMultiplier) as Score01,
      helperBlackout,
      haterRaidActive,
    }),
    metadata: Object.freeze({
      runId: signal.runId,
      tick: signal.tick,
      signalKind: signal.signalKind,
      urgency: signal.urgency,
      companionMessage: signal.companionMessage,
      pressureTierLabel: signal.pressureTierLabel,
      pressureTierExperience: signal.pressureTierExperience,
      heatMultiplier: parseFloat(heatMultiplier.toFixed(4)),
      ...counterMetadata,
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

function buildDedupeKey(signal: ThreatChatSignalCompat): string {
  return `${signal.runId}:${signal.signalKind}:${signal.tick}:${signal.urgency}`;
}

function extractCounterMetadata(
  counterAdvice: CounterStrategyAdviceCompat | null,
  includeCounterAdvice: boolean,
): Record<string, JsonValue> {
  if (!includeCounterAdvice || counterAdvice === null) return {};
  return {
    counterableAttackCount: counterAdvice.counterableAttackCount,
    uncounterableAttackCount: counterAdvice.uncounterableAttackCount,
    countersAvailable: counterAdvice.countersAvailable,
    primaryCounterCategory: counterAdvice.primaryCounterCategory ?? null,
    bestCounterWindowPriority: counterAdvice.bestCounterWindowPriority,
    counterUrgencyScore: parseFloat(counterAdvice.urgencyScore.toFixed(4)),
    counterActionPhrase: counterAdvice.actionPhrases[0] ?? null,
    recommendedTimingClasses: counterAdvice.recommendedTimingClasses.slice(0, 4).join(','),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ThreatRoutingSignalAdapter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adapts ThreatRoutingService chat signals into backend-chat ingress envelopes.
 *
 * Filtering policy:
 * - DIRECT_ATTACK_INCOMING and THREAT_SURGE_DETECTED: always accepted (CRITICAL)
 * - BOT_COORDINATION_DETECTED: always accepted (HIGH)
 * - COUNTER_WINDOW_OPEN: always accepted (coaching opportunity)
 * - THREAT_ROUTED: suppressed when suppressRoutineRoutes is true (default)
 * - Others: accepted, deduped within the configured window
 */
export class ThreatRoutingSignalAdapter {
  private readonly options: Required<ThreatRoutingSignalAdapterOptions>;
  private readonly logger: ThreatRoutingSignalAdapterLogger;
  private readonly clock: ThreatRoutingSignalAdapterClock;

  private readonly history: ThreatRoutingSignalAdapterHistoryEntry[] = [];
  private readonly lastAcceptedAtByKey: Map<string, UnixMs> = new Map();

  private acceptedCount = 0;
  private dedupedCount = 0;
  private rejectedCount = 0;
  private surgeAlertCount = 0;
  private directAttackCount = 0;
  private botCoordinationCount = 0;
  private counterWindowCount = 0;
  private mlVectorCount = 0;
  private lastSignalKind = 'NONE';

  public constructor(options: ThreatRoutingSignalAdapterOptions) {
    this.logger = options.logger ?? NULL_LOGGER;
    this.clock = options.clock ?? SYSTEM_CLOCK;
    this.options = Object.freeze({
      defaultRoomId: options.defaultRoomId,
      defaultVisibleChannel: options.defaultVisibleChannel ?? 'GLOBAL',
      dedupeWindowMs: options.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS,
      maxHistory: options.maxHistory ?? DEFAULT_MAX_HISTORY,
      suppressRoutineRoutes: options.suppressRoutineRoutes ?? true,
      emitMLVectors: options.emitMLVectors ?? false,
      emitDLTensors: options.emitDLTensors ?? false,
      includeCounterAdvice: options.includeCounterAdvice ?? true,
      logger: this.logger,
      clock: this.clock,
    });
  }

  /**
   * Adapt a threat chat signal payload into a ChatInputEnvelope.
   * Returns the artifact if accepted, or null if suppressed/deduped.
   */
  public adapt(
    signal: ThreatChatSignalCompat,
    ctx: ThreatRoutingSignalAdapterContext = {},
  ): ThreatRoutingSignalAdapterArtifact | null {
    const now = this.clock.now();

    // Suppress routine routing events
    if (signal.signalKind === 'THREAT_ROUTED' && this.options.suppressRoutineRoutes) {
      this.rejectedCount++;
      this.logger.debug('ThreatRoutingSignalAdapter: suppressed routine route', {
        runId: signal.runId, tick: signal.tick,
      });
      return null;
    }

    const roomId = ctx.roomId ?? this.options.defaultRoomId;
    const channel = ctx.routeChannel ?? this.options.defaultVisibleChannel;
    const eventName = signalKindToEventName(signal.signalKind);
    const dedupeKey = buildDedupeKey(signal);

    // Always-accept events (high-impact, time-sensitive)
    const isAlwaysAccept =
      signal.signalKind === 'DIRECT_ATTACK_INCOMING' ||
      signal.signalKind === 'THREAT_SURGE_DETECTED' ||
      signal.signalKind === 'BOT_COORDINATION_DETECTED' ||
      signal.signalKind === 'COUNTER_WINDOW_OPEN';

    if (!isAlwaysAccept) {
      const lastAt = this.lastAcceptedAtByKey.get(dedupeKey);
      if (lastAt !== undefined && (now - lastAt) < this.options.dedupeWindowMs) {
        this.dedupedCount++;
        this.logger.debug('ThreatRoutingSignalAdapter: deduped signal', {
          dedupeKey, runId: signal.runId, tick: signal.tick,
        });
        return null;
      }
    }

    const severity = classifySeverity(signal.urgency, signal.signalKind);
    const narrativeWeight = classifyNarrativeWeight(signal.signalKind, severity);
    const heatMultiplier = urgencyToHeatMultiplier(signal.urgency);
    const haterRaidActive = signal.signalKind === 'BOT_COORDINATION_DETECTED';
    const helperBlackout =
      signal.urgency === 'CRITICAL' &&
      signal.signalKind !== 'COUNTER_WINDOW_OPEN';

    const counterMetadata = extractCounterMetadata(
      signal.counterAdvice,
      this.options.includeCounterAdvice,
    );

    const signalEnvelope = buildThreatSignalEnvelope(
      signal, roomId as ChatRoomId | string | null,
      heatMultiplier, haterRaidActive, helperBlackout, counterMetadata, now,
    );
    const envelope = buildChatInputEnvelope(signalEnvelope, now);

    const pressure100 = clamp100(heatMultiplier * 100) as Score100;
    const counterAvailable = signal.counterAdvice?.countersAvailable ?? false;

    const artifact: ThreatRoutingSignalAdapterArtifact = Object.freeze({
      envelope,
      dedupeKey,
      routeChannel: channel as ChatVisibleChannel,
      narrativeWeight,
      severity,
      eventName,
      tick: signal.tick,
      runId: signal.runId,
      urgency: signal.urgency,
      signalKind: signal.signalKind,
      haterRaidActive,
      counterAvailable,
      pressure100,
      details: Object.freeze({
        runId: signal.runId,
        tick: signal.tick,
        signalKind: signal.signalKind,
        urgency: signal.urgency,
        companionMessage: signal.companionMessage,
        pressureTierLabel: signal.pressureTierLabel,
        haterRaidActive,
        counterAvailable,
        pressure100,
        ...counterMetadata,
        ...(ctx.metadata ?? {}),
      } as Record<string, JsonValue>),
    });

    this.lastAcceptedAtByKey.set(dedupeKey, now);
    this.acceptedCount++;
    this.lastSignalKind = signal.signalKind;

    if (signal.signalKind === 'THREAT_SURGE_DETECTED') this.surgeAlertCount++;
    if (signal.signalKind === 'DIRECT_ATTACK_INCOMING') this.directAttackCount++;
    if (signal.signalKind === 'BOT_COORDINATION_DETECTED') this.botCoordinationCount++;
    if (signal.signalKind === 'COUNTER_WINDOW_OPEN') this.counterWindowCount++;

    this.pushHistory({
      at: now,
      eventName,
      tick: signal.tick,
      runId: signal.runId,
      severity,
      signalKind: signal.signalKind,
      urgency: signal.urgency,
      dedupeKey,
    });

    this.logger.debug('ThreatRoutingSignalAdapter: accepted signal', {
      runId: signal.runId, tick: signal.tick, signalKind: signal.signalKind, severity,
    });

    return artifact;
  }

  /**
   * Adapt a standalone surge event (without a full routing result).
   * Always accepted — surge events represent real simulation pressure spikes.
   */
  public adaptSurge(
    surge: ThreatSurgeEventCompat,
    runId: string,
    ctx: ThreatRoutingSignalAdapterContext = {},
  ): ThreatRoutingSignalAdapterArtifact | null {
    const now = this.clock.now();
    const roomId = ctx.roomId ?? this.options.defaultRoomId;
    const channel = ctx.routeChannel ?? this.options.defaultVisibleChannel;
    const isCritical = surge.deltaAggregatePressure >= 0.3;
    const dedupeKey = `surge:${runId}:${surge.tick}`;

    // Surges are always accepted (no dedupe bypass needed, but short window)
    const lastAt = this.lastAcceptedAtByKey.get(dedupeKey);
    if (lastAt !== undefined && !isCritical && (now - lastAt) < 1_000) {
      this.dedupedCount++;
      return null;
    }

    const severity: ThreatRoutingSignalAdapterSeverity = isCritical ? 'CRITICAL' : 'WARN';
    const heatMultiplier = clamp01(Math.abs(surge.deltaAggregatePressure));
    const pressure100 = Math.round(heatMultiplier * 100) as Score100;

    const signalEnvelope: ChatSignalEnvelope = Object.freeze({
      type: 'LIVEOPS' as const,
      emittedAt: now,
      roomId: (roomId ?? null) as Nullable<ChatRoomId>,
      liveops: Object.freeze({
        worldEventName: 'threat.surge.standalone',
        heatMultiplier01: heatMultiplier as Score01,
        helperBlackout: isCritical,
        haterRaidActive: false,
      }),
      metadata: Object.freeze({
        runId,
        tick: surge.tick,
        deltaAggregatePressure: parseFloat(surge.deltaAggregatePressure.toFixed(4)),
        prevPressure: parseFloat(surge.prevPressure.toFixed(4)),
        currPressure: parseFloat(surge.currPressure.toFixed(4)),
        triggeredBy: surge.triggeredBy,
        isCritical,
        pressure100,
        ...(ctx.metadata ?? {}),
      } as Record<string, JsonValue>),
    });

    const envelope = buildChatInputEnvelope(signalEnvelope, now);

    const artifact: ThreatRoutingSignalAdapterArtifact = Object.freeze({
      envelope,
      dedupeKey,
      routeChannel: channel as ChatVisibleChannel,
      narrativeWeight: isCritical ? 'CRITICAL' : 'TACTICAL',
      severity,
      eventName: 'threat.surge.standalone',
      tick: surge.tick,
      runId,
      urgency: isCritical ? 'CRITICAL' : 'HIGH',
      signalKind: 'THREAT_SURGE_DETECTED',
      haterRaidActive: false,
      counterAvailable: false,
      pressure100,
      details: Object.freeze({
        runId,
        tick: surge.tick,
        deltaAggregatePressure: parseFloat(surge.deltaAggregatePressure.toFixed(4)),
        currPressure: parseFloat(surge.currPressure.toFixed(4)),
        triggeredBy: surge.triggeredBy,
        isCritical,
        pressure100,
      } as Record<string, JsonValue>),
    });

    this.lastAcceptedAtByKey.set(dedupeKey, now);
    this.acceptedCount++;
    this.surgeAlertCount++;

    this.pushHistory({
      at: now,
      eventName: 'threat.surge.standalone',
      tick: surge.tick,
      runId,
      severity,
      signalKind: 'THREAT_SURGE_DETECTED',
      urgency: isCritical ? 'CRITICAL' : 'HIGH',
      dedupeKey,
    });

    return artifact;
  }

  /**
   * Adapt a bot behavior prediction into a ChatInputEnvelope.
   * Only accepted for bots with high attack probability or imminent state change.
   */
  public adaptBotPrediction(
    prediction: ThreatBotPredictionCompat,
    runId: string,
    tick: number,
    ctx: ThreatRoutingSignalAdapterContext = {},
  ): ThreatRoutingSignalAdapterArtifact | null {
    const isImminent = prediction.attackProbability >= 0.8 ||
      (prediction.ticksUntilStateChange !== null && prediction.ticksUntilStateChange <= 3);

    if (!isImminent) {
      this.rejectedCount++;
      return null;
    }

    const now = this.clock.now();
    const roomId = ctx.roomId ?? this.options.defaultRoomId;
    const channel = ctx.routeChannel ?? this.options.defaultVisibleChannel;
    const dedupeKey = `bot:${runId}:${tick}:${prediction.botId}:${prediction.predictedNextState}`;

    const lastAt = this.lastAcceptedAtByKey.get(dedupeKey);
    if (lastAt !== undefined && (now - lastAt) < this.options.dedupeWindowMs) {
      this.dedupedCount++;
      return null;
    }

    const heatMultiplier = clamp01(prediction.attackProbability);
    const pressure100 = Math.round(heatMultiplier * 100) as Score100;
    const severity: ThreatRoutingSignalAdapterSeverity =
      prediction.attackProbability >= 0.9 ? 'CRITICAL' : 'WARN';

    const signalEnvelope: ChatSignalEnvelope = Object.freeze({
      type: 'LIVEOPS' as const,
      emittedAt: now,
      roomId: (roomId ?? null) as Nullable<ChatRoomId>,
      liveops: Object.freeze({
        worldEventName: 'threat.bot.prediction',
        heatMultiplier01: heatMultiplier as Score01,
        helperBlackout: false,
        haterRaidActive: prediction.predictedNextState === 'ATTACKING',
      }),
      metadata: Object.freeze({
        runId,
        tick,
        botId: prediction.botId,
        currentState: prediction.currentState,
        predictedNextState: prediction.predictedNextState,
        attackProbability: parseFloat(prediction.attackProbability.toFixed(4)),
        estimatedAttackMagnitude: parseFloat(prediction.estimatedAttackMagnitude.toFixed(4)),
        ticksUntilStateChange: prediction.ticksUntilStateChange ?? null,
        confidence: parseFloat(prediction.confidence.toFixed(4)),
        pressure100,
      } as Record<string, JsonValue>),
    });

    const envelope = buildChatInputEnvelope(signalEnvelope, now);

    const artifact: ThreatRoutingSignalAdapterArtifact = Object.freeze({
      envelope,
      dedupeKey,
      routeChannel: channel as ChatVisibleChannel,
      narrativeWeight: severity === 'CRITICAL' ? 'RAID' : 'TACTICAL',
      severity,
      eventName: 'threat.bot.prediction',
      tick,
      runId,
      urgency: severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      signalKind: 'BOT_PREDICTION',
      haterRaidActive: prediction.predictedNextState === 'ATTACKING',
      counterAvailable: false,
      pressure100,
      details: Object.freeze({
        runId,
        tick,
        botId: prediction.botId,
        predictedNextState: prediction.predictedNextState,
        attackProbability: parseFloat(prediction.attackProbability.toFixed(4)),
        pressure100,
      } as Record<string, JsonValue>),
    });

    this.lastAcceptedAtByKey.set(dedupeKey, now);
    this.acceptedCount++;

    this.pushHistory({
      at: now,
      eventName: 'threat.bot.prediction',
      tick,
      runId,
      severity,
      signalKind: 'BOT_PREDICTION',
      urgency: severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      dedupeKey,
    });

    return artifact;
  }

  /**
   * Adapt a threat ML vector into a ChatInputEnvelope.
   * Only accepted when emitMLVectors is true.
   */
  public adaptML(
    mlVector: ThreatMLVectorCompat,
    ctx: ThreatRoutingSignalAdapterContext = {},
  ): ThreatRoutingSignalAdapterArtifact | null {
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

    const signalEnvelope: ChatSignalEnvelope = Object.freeze({
      type: 'LIVEOPS' as const,
      emittedAt: now,
      roomId: (roomId ?? null) as Nullable<ChatRoomId>,
      liveops: Object.freeze({
        worldEventName: 'threat.ml.vector_emitted',
        heatMultiplier01: excitement,
        helperBlackout: false,
        haterRaidActive: false,
      }),
      metadata: Object.freeze({
        runId: mlVector.runId,
        tick: mlVector.tick,
        featureCount: mlVector.features.length,
        avgFeatureValue: parseFloat(avgFeature.toFixed(6)),
        vectorShape: JSON.stringify(mlVector.vectorShape),
        extractedAtMs: mlVector.extractedAtMs,
        pressure100,
        labels: mlVector.featureLabels.slice(0, 8).join(','),
      } as Record<string, JsonValue>),
    });

    const envelope = buildChatInputEnvelope(signalEnvelope, now);

    const artifact: ThreatRoutingSignalAdapterArtifact = Object.freeze({
      envelope,
      dedupeKey,
      routeChannel: channel as ChatVisibleChannel,
      narrativeWeight: 'AMBIENT',
      severity: 'DEBUG',
      eventName: 'threat.ml.vector_emitted',
      tick: mlVector.tick,
      runId: mlVector.runId,
      urgency: 'BACKGROUND',
      signalKind: 'ML_VECTOR',
      haterRaidActive: false,
      counterAvailable: false,
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
      eventName: 'threat.ml.vector_emitted',
      tick: mlVector.tick,
      runId: mlVector.runId,
      severity: 'DEBUG',
      signalKind: 'ML_VECTOR',
      urgency: 'BACKGROUND',
      dedupeKey,
    });

    return artifact;
  }

  /**
   * Adapt a threat DL tensor into a ChatInputEnvelope.
   * Only accepted when emitDLTensors is true.
   */
  public adaptDL(
    dlTensor: ThreatDLTensorCompat,
    ctx: ThreatRoutingSignalAdapterContext = {},
  ): ThreatRoutingSignalAdapterArtifact | null {
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

    const signalEnvelope: ChatSignalEnvelope = Object.freeze({
      type: 'LIVEOPS' as const,
      emittedAt: now,
      roomId: (roomId ?? null) as Nullable<ChatRoomId>,
      liveops: Object.freeze({
        worldEventName: 'threat.dl.tensor_emitted',
        heatMultiplier01: excitement,
        helperBlackout: false,
        haterRaidActive: false,
      }),
      metadata: Object.freeze({
        runId: dlTensor.runId,
        tick: dlTensor.tick,
        featureCount: dlTensor.inputVector.length,
        avgInputValue: parseFloat(avgInput.toFixed(6)),
        tensorShape: JSON.stringify(dlTensor.tensorShape),
        policyVersion: dlTensor.policyVersion,
        extractedAtMs: dlTensor.extractedAtMs,
        pressure100,
      } as Record<string, JsonValue>),
    });

    const envelope = buildChatInputEnvelope(signalEnvelope, now);

    const artifact: ThreatRoutingSignalAdapterArtifact = Object.freeze({
      envelope,
      dedupeKey,
      routeChannel: channel as ChatVisibleChannel,
      narrativeWeight: 'AMBIENT',
      severity: 'DEBUG',
      eventName: 'threat.dl.tensor_emitted',
      tick: dlTensor.tick,
      runId: dlTensor.runId,
      urgency: 'BACKGROUND',
      signalKind: 'DL_TENSOR',
      haterRaidActive: false,
      counterAvailable: false,
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
      eventName: 'threat.dl.tensor_emitted',
      tick: dlTensor.tick,
      runId: dlTensor.runId,
      severity: 'DEBUG',
      signalKind: 'DL_TENSOR',
      urgency: 'BACKGROUND',
      dedupeKey,
    });

    return artifact;
  }

  /** Batch-adapt an array of threat chat signals. */
  public adaptBatch(
    signals: readonly ThreatChatSignalCompat[],
    ctx: ThreatRoutingSignalAdapterContext = {},
  ): readonly ThreatRoutingSignalAdapterArtifact[] {
    const results: ThreatRoutingSignalAdapterArtifact[] = [];
    for (const signal of signals) {
      const artifact = this.adapt(signal, ctx);
      if (artifact !== null) results.push(artifact);
    }
    return Object.freeze(results);
  }

  /** Return the current accumulated state snapshot. */
  public state(): ThreatRoutingSignalAdapterState {
    const lastAcceptedAtByKey: Record<string, UnixMs> = {};
    for (const [k, v] of this.lastAcceptedAtByKey) {
      lastAcceptedAtByKey[k] = v;
    }
    return Object.freeze({
      history: Object.freeze([...this.history]),
      lastAcceptedAtByKey: Object.freeze(lastAcceptedAtByKey),
      lastSignalKind: this.lastSignalKind,
      acceptedCount: this.acceptedCount,
      dedupedCount: this.dedupedCount,
      rejectedCount: this.rejectedCount,
      surgeAlertCount: this.surgeAlertCount,
      directAttackCount: this.directAttackCount,
      botCoordinationCount: this.botCoordinationCount,
      counterWindowCount: this.counterWindowCount,
      mlVectorCount: this.mlVectorCount,
    });
  }

  /** Return a point-in-time report. */
  public report(): ThreatRoutingSignalAdapterReport {
    return Object.freeze({
      accepted: Object.freeze([...this.history].map((h) => ({
        envelope: {} as ChatInputEnvelope,
        dedupeKey: h.dedupeKey,
        routeChannel: 'GLOBAL' as ChatVisibleChannel,
        narrativeWeight: classifyNarrativeWeight(h.signalKind, h.severity),
        severity: h.severity,
        eventName: h.eventName,
        tick: h.tick,
        runId: h.runId,
        urgency: h.urgency as ThreatChatSignalCompat['urgency'],
        signalKind: h.signalKind,
        haterRaidActive: false,
        counterAvailable: false,
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
    this.surgeAlertCount = 0;
    this.directAttackCount = 0;
    this.botCoordinationCount = 0;
    this.counterWindowCount = 0;
    this.mlVectorCount = 0;
    this.lastSignalKind = 'NONE';
  }

  private pushHistory(entry: ThreatRoutingSignalAdapterHistoryEntry): void {
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
 * Convenience factory that creates a fully-configured ThreatRoutingSignalAdapter.
 */
export function createThreatRoutingSignalAdapter(
  options: ThreatRoutingSignalAdapterOptions,
): ThreatRoutingSignalAdapter {
  return new ThreatRoutingSignalAdapter(options);
}
