/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT GAME PRIMITIVES SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/GamePrimitivesSignalAdapter.ts
 * VERSION: 2026.03.24
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates GamePrimitives engine truth —
 * pressure changes, combat events, cascade health, run experience scores,
 * legend markers, and ML feature vectors — into authoritative backend-chat
 * ingress envelopes.
 *
 * Backend-truth question
 * ----------------------
 *   "When the GamePrimitives surface emits a pressure tier change, a
 *    cinematic UX moment, a combat signal, or an ML vector, what exact
 *    chat-native signal should the authoritative backend chat engine ingest?"
 *
 * Design laws
 * -----------
 * - No circular imports from core/. All core types are mirrored as structural
 *   compat interfaces below.
 * - This adapter witnesses GamePrimitives truth; it does not simulate it.
 * - Every accepted signal must carry enough context for NPC authoring.
 * - Dedupe prevents spam across repeated pressure-tier reports.
 * - ML vectors are gated — only cinematic-threshold signals reach transcript.
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  clamp100,
  type ChatInputEnvelope,
  type ChatRoomId,
  type ChatRoomStageMood,
  type ChatSignalEnvelope,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type Score01,
  type Score100,
  type UnixMs,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Structural compat interfaces — mirrors core/ types without importing them
// ─────────────────────────────────────────────────────────────────────────────

export interface GamePrimitivesPressureCompat {
  readonly tier: string;
  readonly previousTier?: string | null;
  readonly score?: number | null;
  readonly band?: string | null;
  readonly survivedHighPressureTicks?: number | null;
  readonly lastEscalationTick?: number | null;
  readonly maxScoreSeen?: number | null;
}

export interface GamePrimitivesAttackCompat {
  readonly attackId?: string | null;
  readonly source?: string | null;
  readonly category?: string | null;
  readonly severity?: number | null;
  readonly magnitude?: number | null;
  readonly targetLayer?: string | null;
  readonly createdAtTick?: number | null;
}

export interface GamePrimitivesCascadeCompat {
  readonly activeChains?: number | null;
  readonly brokenChains?: number | null;
  readonly completedChains?: number | null;
  readonly healthRatio?: number | null;
  readonly lastResolvedTick?: number | null;
}

export interface GamePrimitivesRunExperienceCompat {
  readonly uxScore?: number | null;
  readonly riskScore?: number | null;
  readonly momentum?: number | null;
  readonly winProbability?: number | null;
  readonly isCinematic?: boolean | null;
  readonly grade?: string | null;
}

export interface GamePrimitivesLegendMarkerCompat {
  readonly markerId?: string | null;
  readonly label?: string | null;
  readonly tick?: number | null;
  readonly value?: number | null;
  readonly source?: string | null;
}

/** Structural mirror of GamePrimitivesChatSignal from core/GamePrimitives.ts */
export interface GamePrimitivesChatSignalCompat {
  readonly surface: 'game_primitives';
  readonly kind: string;
  readonly tick: number;
  readonly severity: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly pressureTier?: string | null;
  readonly previousPressureTier?: string | null;
  readonly pressureScore?: number | null;
  readonly uxScore?: number | null;
  readonly uxGrade?: string | null;
  readonly isCinematic?: boolean | null;
  readonly riskScore?: number | null;
  readonly momentum?: number | null;
  readonly mode?: string | null;
  readonly phase?: string | null;
}

/** ML vector companion */
export interface GamePrimitivesMLVectorCompat {
  readonly tick: number;
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly generatedAtMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter types
// ─────────────────────────────────────────────────────────────────────────────

export interface GamePrimitivesSignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface GamePrimitivesSignalAdapterClock {
  now(): UnixMs;
}

export interface GamePrimitivesSignalAdapterOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly dedupeWindowMs?: number;
  readonly maxHistory?: number;
  readonly cinematicUXThreshold?: number;
  readonly emitMLVectors?: boolean;
  readonly logger?: GamePrimitivesSignalAdapterLogger;
  readonly clock?: GamePrimitivesSignalAdapterClock;
}

export interface GamePrimitivesSignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export type GamePrimitivesSignalAdapterEventName =
  | 'primitives.pressure.changed'
  | 'primitives.pressure.tier_escalation'
  | 'primitives.attack.registered'
  | 'primitives.cascade.health_changed'
  | 'primitives.run.experience_scored'
  | 'primitives.run.cinematic_moment'
  | 'primitives.legend.marker_placed'
  | 'primitives.ml.vector_emitted'
  | 'primitives.snapshot.updated'
  | string;

export type GamePrimitivesSignalAdapterNarrativeWeight =
  | 'AMBIENT'
  | 'TACTICAL'
  | 'SOVEREIGN'
  | 'CINEMATIC';

export type GamePrimitivesSignalAdapterSeverity =
  | 'DEBUG'
  | 'INFO'
  | 'WARN'
  | 'CRITICAL';

export interface GamePrimitivesSignalAdapterArtifact {
  readonly envelope: ChatInputEnvelope;
  readonly dedupeKey: string;
  readonly routeChannel: ChatVisibleChannel;
  readonly narrativeWeight: GamePrimitivesSignalAdapterNarrativeWeight;
  readonly severity: GamePrimitivesSignalAdapterSeverity;
  readonly eventName: GamePrimitivesSignalAdapterEventName;
  readonly tick: number;
  readonly uxScore: Score01;
  readonly pressureMomentum: Score100;
  readonly isCinematic: boolean;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface GamePrimitivesSignalAdapterRejection {
  readonly eventName: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface GamePrimitivesSignalAdapterDeduped {
  readonly eventName: string;
  readonly dedupeKey: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface GamePrimitivesSignalAdapterHistoryEntry {
  readonly at: UnixMs;
  readonly eventName: string;
  readonly tick: number;
  readonly routeChannel: ChatVisibleChannel;
  readonly narrativeWeight: GamePrimitivesSignalAdapterNarrativeWeight;
  readonly severity: GamePrimitivesSignalAdapterSeverity;
  readonly isCinematic: boolean;
  readonly uxScore: Score01;
  readonly dedupeKey: string;
}

export interface GamePrimitivesSignalAdapterReport {
  readonly accepted: readonly GamePrimitivesSignalAdapterArtifact[];
  readonly deduped: readonly GamePrimitivesSignalAdapterDeduped[];
  readonly rejected: readonly GamePrimitivesSignalAdapterRejection[];
}

export interface GamePrimitivesSignalAdapterState {
  readonly history: readonly GamePrimitivesSignalAdapterHistoryEntry[];
  readonly lastAcceptedAtByKey: Readonly<Record<string, UnixMs>>;
  readonly lastPressureTier: string;
  readonly lastUXScore: Score01;
  readonly lastTick: number;
  readonly acceptedCount: number;
  readonly dedupedCount: number;
  readonly rejectedCount: number;
  readonly cinematicCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_DEDUPE_WINDOW_MS = 3_000;
const DEFAULT_MAX_HISTORY = 200;
const DEFAULT_CINEMATIC_THRESHOLD = 0.85;

const PRESSURE_TIER_CHANNEL: Record<string, ChatVisibleChannel> = {
  T0: 'GLOBAL',
  T1: 'GLOBAL',
  T2: 'GLOBAL',
  T3: 'SYNDICATE',
  T4: 'SYNDICATE',
} as const;

const PRESSURE_TIER_MOOD: Record<string, ChatRoomStageMood> = {
  T0: 'CALM',
  T1: 'TENSE',
  T2: 'HOSTILE',
  T3: 'PREDATORY',
  T4: 'PREDATORY',
} as const;

const PRESSURE_TIER_NUMERIC: Record<string, number> = {
  T0: 0.0,
  T1: 0.25,
  T2: 0.5,
  T3: 0.75,
  T4: 1.0,
} as const;

const NULL_LOGGER: GamePrimitivesSignalAdapterLogger = Object.freeze({
  debug() {},
  warn() {},
  error() {},
});

const SYSTEM_CLOCK: GamePrimitivesSignalAdapterClock = Object.freeze({
  now(): UnixMs { return asUnixMs(Date.now()); },
});

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildDedupeKey(eventName: string, discriminator: string): string {
  return `${eventName}:${discriminator}`;
}

function pressureToMood(tier: string): ChatRoomStageMood {
  return PRESSURE_TIER_MOOD[tier] ?? 'TENSE';
}

function pressureToChannel(tier: string, defaultChannel: ChatVisibleChannel): ChatVisibleChannel {
  return PRESSURE_TIER_CHANNEL[tier] ?? defaultChannel;
}

function uxToNarrativeWeight(
  uxScore: number,
  isCinematic: boolean,
): GamePrimitivesSignalAdapterNarrativeWeight {
  if (isCinematic) return 'CINEMATIC';
  if (uxScore >= 0.75) return 'SOVEREIGN';
  if (uxScore >= 0.5) return 'TACTICAL';
  return 'AMBIENT';
}

function uxToSeverity(
  uxScore: number,
  signalSeverity: 'info' | 'warn' | 'error',
): GamePrimitivesSignalAdapterSeverity {
  if (signalSeverity === 'error' || uxScore < 0.3) return 'CRITICAL';
  if (signalSeverity === 'warn' || uxScore < 0.6) return 'WARN';
  if (uxScore >= 0.85) return 'INFO';
  return 'INFO';
}

function buildSignalEnvelope(
  signal: GamePrimitivesChatSignalCompat,
  roomId: ChatRoomId | string | null,
  now: UnixMs,
): ChatSignalEnvelope {
  const pressureTier = signal.pressureTier ?? 'T0';
  const mood = pressureToMood(pressureTier);

  return Object.freeze({
    type: 'LIVEOPS',
    emittedAt: now,
    roomId: (roomId ?? null) as Nullable<ChatRoomId>,
    liveops: Object.freeze({
      worldEventName: signal.kind,
      heatMultiplier01: clamp01(PRESSURE_TIER_NUMERIC[pressureTier] ?? 0) as Score01,
      helperBlackout: false,
      haterRaidActive: signal.severity === 'error',
    }),
    metadata: Object.freeze({
      surface: signal.surface,
      kind: signal.kind,
      tick: signal.tick,
      severity: signal.severity,
      message: signal.message,
      pressureTier,
      previousPressureTier: signal.previousPressureTier ?? null,
      pressureScore: signal.pressureScore ?? null,
      uxScore: signal.uxScore ?? null,
      uxGrade: signal.uxGrade ?? null,
      isCinematic: signal.isCinematic ?? false,
      riskScore: signal.riskScore ?? null,
      momentum: signal.momentum ?? null,
      mode: signal.mode ?? null,
      phase: signal.phase ?? null,
      stageMood: mood,
    } as Record<string, JsonValue>),
  });
}

function buildChatEnvelope(
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
// GamePrimitivesSignalAdapter
// ─────────────────────────────────────────────────────────────────────────────

export class GamePrimitivesSignalAdapter {
  private readonly options: Required<GamePrimitivesSignalAdapterOptions>;
  private readonly logger: GamePrimitivesSignalAdapterLogger;
  private readonly clock: GamePrimitivesSignalAdapterClock;

  private readonly history: GamePrimitivesSignalAdapterHistoryEntry[] = [];
  private readonly lastAcceptedAtByKey: Map<string, UnixMs> = new Map();

  private acceptedCount = 0;
  private dedupedCount = 0;
  private rejectedCount = 0;
  private cinematicCount = 0;
  private lastPressureTier = 'T0';
  private lastUXScore: Score01 = 0 as Score01;
  private lastTick = 0;

  public constructor(options: GamePrimitivesSignalAdapterOptions) {
    this.logger = options.logger ?? NULL_LOGGER;
    this.clock = options.clock ?? SYSTEM_CLOCK;
    this.options = Object.freeze({
      defaultRoomId: options.defaultRoomId,
      defaultVisibleChannel: options.defaultVisibleChannel ?? 'GLOBAL',
      dedupeWindowMs: options.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS,
      maxHistory: options.maxHistory ?? DEFAULT_MAX_HISTORY,
      cinematicUXThreshold: options.cinematicUXThreshold ?? DEFAULT_CINEMATIC_THRESHOLD,
      emitMLVectors: options.emitMLVectors ?? false,
      logger: this.logger,
      clock: this.clock,
    });
  }

  // ── Public ingestion surface ──────────────────────────────────────────────

  public ingestSignal(
    signal: GamePrimitivesChatSignalCompat,
    context?: GamePrimitivesSignalAdapterContext,
  ): GamePrimitivesSignalAdapterArtifact | GamePrimitivesSignalAdapterRejection | GamePrimitivesSignalAdapterDeduped {
    const now = this.clock.now();
    const roomId = context?.roomId ?? this.options.defaultRoomId;
    const routeChannel: ChatVisibleChannel =
      context?.routeChannel ??
      pressureToChannel(signal.pressureTier ?? 'T0', this.options.defaultVisibleChannel);

    if (!this.isSignalMeaningful(signal)) {
      const rejection: GamePrimitivesSignalAdapterRejection = Object.freeze({
        eventName: signal.kind,
        reason: 'BELOW_NARRATIVE_THRESHOLD',
        details: { tick: signal.tick, kind: signal.kind, severity: signal.severity },
      });
      this.rejectedCount++;
      this.logger.debug('[GamePrimitivesSignalAdapter] rejected', { reason: 'below-threshold', kind: signal.kind });
      return rejection;
    }

    const dedupeKey = buildDedupeKey(
      signal.kind,
      `${signal.pressureTier ?? 'T0'}:${signal.phase ?? ''}:${Math.floor(signal.tick / 10)}`,
    );

    if (this.isDuplicate(dedupeKey, now)) {
      const deduped: GamePrimitivesSignalAdapterDeduped = Object.freeze({
        eventName: signal.kind,
        dedupeKey,
        reason: 'WITHIN_DEDUPE_WINDOW',
        details: { tick: signal.tick, dedupeWindowMs: this.options.dedupeWindowMs },
      });
      this.dedupedCount++;
      return deduped;
    }

    const uxScore = clamp01((signal.uxScore ?? 0.5) as number) as Score01;
    const isCinematic = signal.isCinematic ?? uxScore >= this.options.cinematicUXThreshold;
    const pressureTier = signal.pressureTier ?? 'T0';
    const pressureNumeric = PRESSURE_TIER_NUMERIC[pressureTier] ?? 0;
    const pressureMomentum = clamp100(Math.round(pressureNumeric * 100)) as Score100;
    const narrativeWeight = uxToNarrativeWeight(uxScore, isCinematic);
    const severity = uxToSeverity(uxScore, signal.severity);

    const signalEnvelope = buildSignalEnvelope(signal, roomId as string, now);
    const envelope = buildChatEnvelope(signalEnvelope, now);

    const artifact: GamePrimitivesSignalAdapterArtifact = Object.freeze({
      envelope,
      dedupeKey,
      routeChannel,
      narrativeWeight,
      severity,
      eventName: signal.kind,
      tick: signal.tick,
      uxScore,
      pressureMomentum,
      isCinematic,
      details: Object.freeze({
        tick: signal.tick,
        kind: signal.kind,
        message: signal.message,
        pressureTier,
        uxScore,
        isCinematic,
        narrativeWeight,
        source: context?.source ?? 'game_primitives',
      } as Record<string, JsonValue>),
    });

    this.acceptArtifact(artifact, dedupeKey, now);

    if (isCinematic) {
      this.cinematicCount++;
      this.logger.debug('[GamePrimitivesSignalAdapter] cinematic moment', {
        tick: signal.tick,
        uxScore,
        kind: signal.kind,
      });
    }

    this.lastPressureTier = pressureTier;
    this.lastUXScore = uxScore;
    this.lastTick = signal.tick;

    return artifact;
  }

  public ingestPressureChange(
    pressure: GamePrimitivesPressureCompat,
    tick: number,
    context?: GamePrimitivesSignalAdapterContext,
  ): GamePrimitivesSignalAdapterArtifact | GamePrimitivesSignalAdapterRejection | GamePrimitivesSignalAdapterDeduped {
    const tierChanged = pressure.tier !== this.lastPressureTier;
    const isEscalation =
      tierChanged &&
      (PRESSURE_TIER_NUMERIC[pressure.tier] ?? 0) >
        (PRESSURE_TIER_NUMERIC[this.lastPressureTier] ?? 0);

    const signal: GamePrimitivesChatSignalCompat = {
      surface: 'game_primitives',
      kind: isEscalation ? 'primitives.pressure.tier_escalation' : 'primitives.pressure.changed',
      tick,
      severity: isEscalation ? 'warn' : 'info',
      message: isEscalation
        ? `Pressure escalated from ${pressure.previousTier ?? this.lastPressureTier} to ${pressure.tier}`
        : `Pressure updated: tier=${pressure.tier}, score=${(pressure.score ?? 0).toFixed(3)}`,
      pressureTier: pressure.tier,
      previousPressureTier: pressure.previousTier ?? this.lastPressureTier,
      pressureScore: pressure.score ?? null,
    };

    return this.ingestSignal(signal, context);
  }

  public ingestRunExperience(
    experience: GamePrimitivesRunExperienceCompat,
    tick: number,
    mode: string,
    phase: string,
    context?: GamePrimitivesSignalAdapterContext,
  ): GamePrimitivesSignalAdapterArtifact | GamePrimitivesSignalAdapterRejection | GamePrimitivesSignalAdapterDeduped {
    const uxScore = experience.uxScore ?? 0.5;
    const isCinematic = experience.isCinematic ?? uxScore >= this.options.cinematicUXThreshold;

    const signal: GamePrimitivesChatSignalCompat = {
      surface: 'game_primitives',
      kind: isCinematic ? 'primitives.run.cinematic_moment' : 'primitives.run.experience_scored',
      tick,
      severity: uxScore < 0.3 ? 'warn' : 'info',
      message: isCinematic
        ? `Cinematic moment: UX=${(uxScore * 100).toFixed(0)}%, grade=${experience.grade ?? '?'}, momentum=${(experience.momentum ?? 0).toFixed(3)}`
        : `Run experience: UX=${(uxScore * 100).toFixed(0)}%, risk=${(experience.riskScore ?? 0).toFixed(3)}, win%=${((experience.winProbability ?? 0) * 100).toFixed(0)}%`,
      uxScore,
      uxGrade: experience.grade ?? null,
      isCinematic,
      riskScore: experience.riskScore ?? null,
      momentum: experience.momentum ?? null,
      mode,
      phase,
    };

    return this.ingestSignal(signal, context);
  }

  public ingestLegendMarker(
    marker: GamePrimitivesLegendMarkerCompat,
    context?: GamePrimitivesSignalAdapterContext,
  ): GamePrimitivesSignalAdapterArtifact | GamePrimitivesSignalAdapterRejection | GamePrimitivesSignalAdapterDeduped {
    const tick = marker.tick ?? 0;

    const signal: GamePrimitivesChatSignalCompat = {
      surface: 'game_primitives',
      kind: 'primitives.legend.marker_placed',
      tick,
      severity: 'info',
      message: `Legend marker placed: ${marker.label ?? marker.markerId ?? 'unknown'} at tick ${tick} (value=${marker.value ?? 0})`,
      uxScore: 1.0,
      isCinematic: true,
    };

    return this.ingestSignal(signal, context);
  }

  public ingestMLVector(
    vector: GamePrimitivesMLVectorCompat,
    context?: GamePrimitivesSignalAdapterContext,
  ): GamePrimitivesSignalAdapterArtifact | GamePrimitivesSignalAdapterRejection | GamePrimitivesSignalAdapterDeduped {
    if (!this.options.emitMLVectors) {
      const rejection: GamePrimitivesSignalAdapterRejection = Object.freeze({
        eventName: 'primitives.ml.vector_emitted',
        reason: 'ML_VECTORS_DISABLED',
        details: { tick: vector.tick },
      });
      this.rejectedCount++;
      return rejection;
    }

    const signal: GamePrimitivesChatSignalCompat = {
      surface: 'game_primitives',
      kind: 'primitives.ml.vector_emitted',
      tick: vector.tick,
      severity: 'info',
      message: `ML vector emitted for tick ${vector.tick}: features[0..3]=[${vector.features.slice(0, 4).map((f) => f.toFixed(3)).join(',')}]`,
    };

    return this.ingestSignal(signal, context);
  }

  public ingestBatch(
    signals: readonly GamePrimitivesChatSignalCompat[],
    context?: GamePrimitivesSignalAdapterContext,
  ): GamePrimitivesSignalAdapterReport {
    const accepted: GamePrimitivesSignalAdapterArtifact[] = [];
    const deduped: GamePrimitivesSignalAdapterDeduped[] = [];
    const rejected: GamePrimitivesSignalAdapterRejection[] = [];

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

  public getState(): GamePrimitivesSignalAdapterState {
    return Object.freeze({
      history: Object.freeze([...this.history]),
      lastAcceptedAtByKey: Object.freeze(Object.fromEntries(this.lastAcceptedAtByKey)),
      lastPressureTier: this.lastPressureTier,
      lastUXScore: this.lastUXScore,
      lastTick: this.lastTick,
      acceptedCount: this.acceptedCount,
      dedupedCount: this.dedupedCount,
      rejectedCount: this.rejectedCount,
      cinematicCount: this.cinematicCount,
    });
  }

  public buildReport(): GamePrimitivesSignalAdapterReport {
    return Object.freeze({ accepted: [], deduped: [], rejected: [] });
  }

  public buildHealthDiagnostics(): Readonly<Record<string, JsonValue>> {
    const acceptRate =
      this.acceptedCount + this.dedupedCount + this.rejectedCount > 0
        ? this.acceptedCount /
          (this.acceptedCount + this.dedupedCount + this.rejectedCount)
        : 1;

    return Object.freeze({
      acceptedCount: this.acceptedCount,
      dedupedCount: this.dedupedCount,
      rejectedCount: this.rejectedCount,
      cinematicCount: this.cinematicCount,
      acceptRate: parseFloat(acceptRate.toFixed(4)),
      lastPressureTier: this.lastPressureTier,
      lastUXScore: parseFloat(this.lastUXScore.toFixed(4)),
      lastTick: this.lastTick,
      historySize: this.history.length,
    });
  }

  public reset(): void {
    this.history.length = 0;
    this.lastAcceptedAtByKey.clear();
    this.acceptedCount = 0;
    this.dedupedCount = 0;
    this.rejectedCount = 0;
    this.cinematicCount = 0;
    this.lastPressureTier = 'T0';
    this.lastUXScore = 0 as Score01;
    this.lastTick = 0;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private isSignalMeaningful(signal: GamePrimitivesChatSignalCompat): boolean {
    if (signal.severity === 'error') return true;
    if (signal.isCinematic) return true;
    if (signal.kind.includes('legend')) return true;
    const uxScore = signal.uxScore ?? 0.5;
    return uxScore >= 0.3 || signal.severity === 'warn';
  }

  private isDuplicate(dedupeKey: string, now: UnixMs): boolean {
    const lastAt = this.lastAcceptedAtByKey.get(dedupeKey);
    if (lastAt === undefined) return false;
    return now - lastAt < this.options.dedupeWindowMs;
  }

  private acceptArtifact(
    artifact: GamePrimitivesSignalAdapterArtifact,
    dedupeKey: string,
    now: UnixMs,
  ): void {
    this.acceptedCount++;
    this.lastAcceptedAtByKey.set(dedupeKey, now);

    const entry: GamePrimitivesSignalAdapterHistoryEntry = Object.freeze({
      at: now,
      eventName: artifact.eventName,
      tick: artifact.tick,
      routeChannel: artifact.routeChannel,
      narrativeWeight: artifact.narrativeWeight,
      severity: artifact.severity,
      isCinematic: artifact.isCinematic,
      uxScore: artifact.uxScore,
      dedupeKey: artifact.dedupeKey,
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

export function createGamePrimitivesSignalAdapter(
  options: GamePrimitivesSignalAdapterOptions,
): GamePrimitivesSignalAdapter {
  return new GamePrimitivesSignalAdapter(options);
}

// ─── §2 GamePrimitivesRollingWindow ───────────────────────────────────────────
/** 60-tick rolling window of pressure, UX, and cinematic metrics. */
export interface GamePrimitivesWindowSnapshot {
  readonly tick: number;
  readonly uxScore: Score01;
  readonly pressureNumeric: Score01;
  readonly pressureTier: string;
  readonly isCinematic: boolean;
  readonly momentum: number;
  readonly riskScore: Score01;
  readonly at: UnixMs;
}

export type GamePrimitivesWindowTrend = 'ESCALATING' | 'RECOVERING' | 'STABLE';

export class GamePrimitivesRollingWindow {
  private readonly capacity: number;
  private readonly snapshots: GamePrimitivesWindowSnapshot[] = [];

  public constructor(capacity = 60) {
    this.capacity = capacity;
  }

  public record(snap: GamePrimitivesWindowSnapshot): void {
    if (this.snapshots.length >= this.capacity) this.snapshots.shift();
    this.snapshots.push(snap);
  }

  public averageUXScore(): Score01 {
    if (this.snapshots.length === 0) return clamp01(0.5) as Score01;
    return clamp01(this.snapshots.reduce((s, r) => s + r.uxScore, 0) / this.snapshots.length) as Score01;
  }

  public averagePressure(): Score01 {
    if (this.snapshots.length === 0) return clamp01(0) as Score01;
    return clamp01(this.snapshots.reduce((s, r) => s + r.pressureNumeric, 0) / this.snapshots.length) as Score01;
  }

  public cinematicRate(): Score01 {
    if (this.snapshots.length === 0) return clamp01(0) as Score01;
    const ct = this.snapshots.filter(r => r.isCinematic).length;
    return clamp01(ct / this.snapshots.length) as Score01;
  }

  public dominantPressureTier(): string {
    const counts: Record<string, number> = {};
    for (const s of this.snapshots) counts[s.pressureTier] = (counts[s.pressureTier] ?? 0) + 1;
    let max = 0; let tier = 'T0';
    for (const [t, c] of Object.entries(counts)) { if (c > max) { max = c; tier = t; } }
    return tier;
  }

  public trend(): GamePrimitivesWindowTrend {
    if (this.snapshots.length < 10) return 'STABLE';
    const half = Math.floor(this.snapshots.length / 2);
    const recent = this.snapshots.slice(-half);
    const older = this.snapshots.slice(0, half);
    const recentAvg = recent.reduce((s, r) => s + r.pressureNumeric, 0) / recent.length;
    const olderAvg = older.reduce((s, r) => s + r.pressureNumeric, 0) / older.length;
    const delta = recentAvg - olderAvg;
    if (delta > 0.08) return 'ESCALATING';
    if (delta < -0.08) return 'RECOVERING';
    return 'STABLE';
  }

  public peakPressure(): Score01 {
    if (this.snapshots.length === 0) return clamp01(0) as Score01;
    return clamp01(Math.max(...this.snapshots.map(r => r.pressureNumeric))) as Score01;
  }

  public minUXScore(): Score01 {
    if (this.snapshots.length === 0) return clamp01(0) as Score01;
    return clamp01(Math.min(...this.snapshots.map(r => r.uxScore))) as Score01;
  }

  public averageMomentum(): number {
    if (this.snapshots.length === 0) return 0;
    return this.snapshots.reduce((s, r) => s + r.momentum, 0) / this.snapshots.length;
  }

  public clear(): void { this.snapshots.length = 0; }
  public size(): number { return this.snapshots.length; }
  public latest(): GamePrimitivesWindowSnapshot | undefined {
    return this.snapshots[this.snapshots.length - 1];
  }
  public all(): ReadonlyArray<GamePrimitivesWindowSnapshot> { return this.snapshots; }
}

// ─── §3 GamePrimitivesSignalAnalytics ─────────────────────────────────────────
/** Tracks per-event-kind analytics across the game primitives surface. */
export interface GamePrimitivesKindStats {
  readonly kind: string;
  readonly totalSignals: number;
  readonly cinematicCount: number;
  readonly avgUXScore: Score01;
  readonly lastUXScore: Score01;
  readonly lastSeenTick: number;
  readonly lastPressureTier: string;
  readonly cinematicRate: Score01;
}

export class GamePrimitivesSignalAnalytics {
  private readonly kindStats: Map<string, {
    totalSignals: number;
    cinematicCount: number;
    uxScoreSum: number;
    lastUXScore: number;
    lastSeenTick: number;
    lastPressureTier: string;
  }> = new Map();

  private totalProcessed = 0;
  private totalCinematic = 0;

  public record(artifact: GamePrimitivesSignalAdapterArtifact): void {
    this.totalProcessed++;
    if (artifact.isCinematic) this.totalCinematic++;

    const existing = this.kindStats.get(artifact.eventName) ?? {
      totalSignals: 0,
      cinematicCount: 0,
      uxScoreSum: 0,
      lastUXScore: artifact.uxScore,
      lastSeenTick: artifact.tick,
      lastPressureTier: 'T0',
    };

    this.kindStats.set(artifact.eventName, {
      totalSignals: existing.totalSignals + 1,
      cinematicCount: existing.cinematicCount + (artifact.isCinematic ? 1 : 0),
      uxScoreSum: existing.uxScoreSum + artifact.uxScore,
      lastUXScore: artifact.uxScore,
      lastSeenTick: artifact.tick,
      lastPressureTier: (artifact.details as Record<string, unknown>).pressureTier as string ?? 'T0',
    });
  }

  public getKindStats(kind: string): GamePrimitivesKindStats | undefined {
    const s = this.kindStats.get(kind);
    if (!s) return undefined;
    const avgUX = s.totalSignals > 0
      ? clamp01(s.uxScoreSum / s.totalSignals) as Score01
      : clamp01(0.5) as Score01;
    return Object.freeze({
      kind,
      totalSignals: s.totalSignals,
      cinematicCount: s.cinematicCount,
      avgUXScore: avgUX,
      lastUXScore: clamp01(s.lastUXScore) as Score01,
      lastSeenTick: s.lastSeenTick,
      lastPressureTier: s.lastPressureTier,
      cinematicRate: clamp01(s.totalSignals > 0 ? s.cinematicCount / s.totalSignals : 0) as Score01,
    });
  }

  public allKindStats(): ReadonlyArray<GamePrimitivesKindStats> {
    return [...this.kindStats.keys()].map(k => this.getKindStats(k)!).filter(Boolean);
  }

  public globalCinematicRate(): Score01 {
    return clamp01(this.totalProcessed > 0 ? this.totalCinematic / this.totalProcessed : 0) as Score01;
  }

  public mostActiveKind(): string | undefined {
    let max = 0; let kind: string | undefined;
    for (const [k, s] of this.kindStats) {
      if (s.totalSignals > max) { max = s.totalSignals; kind = k; }
    }
    return kind;
  }

  public reset(): void {
    this.kindStats.clear();
    this.totalProcessed = 0;
    this.totalCinematic = 0;
  }
}

// ─── §4 GamePrimitivesMLExtractor ─────────────────────────────────────────────
/** 12-feature normalized DL input tensor from game primitives history. */
export const GAME_PRIMITIVES_DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  'avgUXScore',
  'avgPressure',
  'cinematicRate',
  'peakPressure',
  'minUXScore',
  'trendScore',
  'momentum',
  'riskScore',
  'legendPresence',
  'globalCinematicRate',
  'pressureTierNumeric',
  'uxToPressureRatio',
]);

export interface GamePrimitivesDLVector {
  readonly tick: number;
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly generatedAt: UnixMs;
  readonly dominantTrend: GamePrimitivesWindowTrend;
  readonly dominantPressureTier: string;
  readonly isCinematic: boolean;
}

export class GamePrimitivesMLExtractor {
  private readonly window: GamePrimitivesRollingWindow;
  private readonly analytics: GamePrimitivesSignalAnalytics;

  public constructor(
    window: GamePrimitivesRollingWindow,
    analytics: GamePrimitivesSignalAnalytics,
  ) {
    this.window = window;
    this.analytics = analytics;
  }

  public extract(tick: number, now: UnixMs): GamePrimitivesDLVector {
    const avgUX = this.window.averageUXScore();
    const avgPressure = this.window.averagePressure();
    const cinematicRate = this.window.cinematicRate();
    const peakPressure = this.window.peakPressure();
    const minUX = this.window.minUXScore();
    const trend = this.window.trend();
    const trendScore = trend === 'RECOVERING' ? 0 : trend === 'ESCALATING' ? 1 : 0.5;
    const momentum = clamp01(this.window.averageMomentum());
    const latest = this.window.latest();
    const riskScore = clamp01(latest?.riskScore ?? 0);
    const legendPresence = this.analytics.allKindStats().some(k => k.kind.includes('legend')) ? 1 : 0;
    const globalCinematicRate = this.analytics.globalCinematicRate();
    const tierNumeric = PRESSURE_TIER_NUMERIC[this.window.dominantPressureTier()] ?? 0;
    const uxToPressureRatio = clamp01(avgPressure > 0 ? avgUX / avgPressure : 1);

    const features: number[] = [
      avgUX, avgPressure, cinematicRate, peakPressure,
      minUX, trendScore, momentum, riskScore,
      legendPresence, globalCinematicRate, tierNumeric, uxToPressureRatio,
    ];

    return Object.freeze({
      tick,
      features: Object.freeze(features),
      labels: GAME_PRIMITIVES_DL_FEATURE_LABELS,
      generatedAt: now,
      dominantTrend: trend,
      dominantPressureTier: this.window.dominantPressureTier(),
      isCinematic: cinematicRate > 0.3,
    });
  }
}

// ─── §5 GamePrimitivesPatternDetector ─────────────────────────────────────────
export type GamePrimitivesPatternKind =
  | 'PRESSURE_SURGE'
  | 'CINEMATIC_SEQUENCE'
  | 'UX_COLLAPSE'
  | 'SUSTAINED_HIGH_PRESSURE'
  | 'RECOVERY_SEQUENCE';

export interface GamePrimitivesPattern {
  readonly kind: GamePrimitivesPatternKind;
  readonly detectedAtTick: number;
  readonly severity: GamePrimitivesSignalAdapterSeverity;
  readonly description: string;
  readonly confidence: Score01;
  readonly pressureTier: string;
}

export class GamePrimitivesPatternDetector {
  private readonly history: GamePrimitivesPattern[] = [];
  private readonly maxHistory = 50;
  private sustainedHighPressureTicks = 0;

  public analyze(
    window: GamePrimitivesRollingWindow,
    analytics: GamePrimitivesSignalAnalytics,
    tick: number,
  ): ReadonlyArray<GamePrimitivesPattern> {
    const detected: GamePrimitivesPattern[] = [];
    const avgPressure = window.averagePressure();
    const avgUX = window.averageUXScore();
    const cinematicRate = window.cinematicRate();
    const trend = window.trend();
    const domTier = window.dominantPressureTier();

    if (avgPressure > 0.7 && trend === 'ESCALATING') {
      this.sustainedHighPressureTicks++;
      if (this.sustainedHighPressureTicks >= 5) {
        detected.push(this.mkPattern('SUSTAINED_HIGH_PRESSURE', tick, 'WARN',
          `Sustained T3/T4 pressure for ${this.sustainedHighPressureTicks} ticks`,
          clamp01(this.sustainedHighPressureTicks / 20) as Score01, domTier));
      }
    } else {
      this.sustainedHighPressureTicks = 0;
    }

    if (trend === 'ESCALATING' && avgPressure > window.peakPressure() * 0.8) {
      detected.push(this.mkPattern('PRESSURE_SURGE', tick, 'WARN',
        `Pressure surging to ${(avgPressure * 100).toFixed(0)}% of peak`,
        clamp01(avgPressure) as Score01, domTier));
    }

    if (cinematicRate > 0.4) {
      detected.push(this.mkPattern('CINEMATIC_SEQUENCE', tick, 'INFO',
        `${(cinematicRate * 100).toFixed(0)}% cinematic rate — UX peak sequence`,
        cinematicRate, domTier));
    }

    if (avgUX < 0.25) {
      detected.push(this.mkPattern('UX_COLLAPSE', tick, 'CRITICAL',
        `UX score collapsed to ${(avgUX * 100).toFixed(0)}%`,
        clamp01(1 - avgUX) as Score01, domTier));
    }

    if (trend === 'RECOVERING' && avgPressure < 0.3 && avgUX > 0.7) {
      detected.push(this.mkPattern('RECOVERY_SEQUENCE', tick, 'INFO',
        `Recovery sequence detected — pressure dropping, UX rising`,
        clamp01(avgUX - avgPressure) as Score01, domTier));
    }

    void analytics; // analytics used for feature extraction; pattern detector uses window

    for (const p of detected) {
      if (this.history.length >= this.maxHistory) this.history.shift();
      this.history.push(p);
    }

    return Object.freeze(detected);
  }

  private mkPattern(
    kind: GamePrimitivesPatternKind,
    tick: number,
    severity: GamePrimitivesSignalAdapterSeverity,
    description: string,
    confidence: Score01,
    pressureTier: string,
  ): GamePrimitivesPattern {
    return Object.freeze({ kind, detectedAtTick: tick, severity, description, confidence, pressureTier });
  }

  public recentPatterns(limit = 10): ReadonlyArray<GamePrimitivesPattern> {
    return this.history.slice(-limit);
  }

  public reset(): void {
    this.history.length = 0;
    this.sustainedHighPressureTicks = 0;
  }
}

// ─── §6 GamePrimitivesHealthTracker ───────────────────────────────────────────
export type GamePrimitivesHealthGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface GamePrimitivesHealthReport {
  readonly grade: GamePrimitivesHealthGrade;
  readonly avgUXScore: Score01;
  readonly avgPressure: Score01;
  readonly cinematicRate: Score01;
  readonly trend: GamePrimitivesWindowTrend;
  readonly dominantTier: string;
  readonly stageMood: ChatRoomStageMood;
  readonly isHealthy: boolean;
  readonly isCinematic: boolean;
  readonly isCritical: boolean;
  readonly description: string;
}

export class GamePrimitivesHealthTracker {
  private readonly window: GamePrimitivesRollingWindow;
  private readonly analytics: GamePrimitivesSignalAnalytics;

  public constructor(
    window: GamePrimitivesRollingWindow,
    analytics: GamePrimitivesSignalAnalytics,
  ) {
    this.window = window;
    this.analytics = analytics;
  }

  public computeGrade(): GamePrimitivesHealthGrade {
    const avgUX = this.window.averageUXScore();
    const avgPressure = this.window.averagePressure();
    // Higher pressure = harder scenario, so health is UX performance under pressure
    const composite = avgUX * 0.6 + (1 - avgPressure * 0.5) * 0.4;
    if (composite >= 0.88) return 'S';
    if (composite >= 0.76) return 'A';
    if (composite >= 0.60) return 'B';
    if (composite >= 0.44) return 'C';
    if (composite >= 0.28) return 'D';
    return 'F';
  }

  public buildReport(): GamePrimitivesHealthReport {
    const avgUXScore = this.window.averageUXScore();
    const avgPressure = this.window.averagePressure();
    const cinematicRate = this.window.cinematicRate();
    const trend = this.window.trend();
    const dominantTier = this.window.dominantPressureTier();
    const stageMood: ChatRoomStageMood = PRESSURE_TIER_MOOD[dominantTier] ?? 'TENSE';
    const grade = this.computeGrade();

    const descriptions: Record<GamePrimitivesHealthGrade, string> = {
      S: 'Perfect UX under pressure — cinematic performance at peak',
      A: 'Excellent — high UX with manageable pressure tier',
      B: 'Good — stable primitives operation with minor pressure variance',
      C: 'Moderate — elevated pressure impacting UX quality',
      D: 'Poor — high pressure causing UX degradation',
      F: 'Critical — pressure overwhelming UX, player experience at risk',
    };

    return Object.freeze({
      grade, avgUXScore, avgPressure, cinematicRate, trend,
      dominantTier, stageMood,
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

// ─── §7 GamePrimitivesNarrativeRouter ─────────────────────────────────────────
export type GamePrimitivesNarrativeChannel =
  | 'BOSS_DIALOGUE'
  | 'HELPER_CALLOUT'
  | 'HATER_TAUNT'
  | 'AMBIENT_COMMENT'
  | 'SYSTEM_ALERT'
  | 'SILENT';

export interface GamePrimitivesNarrativeRoute {
  readonly channel: GamePrimitivesNarrativeChannel;
  readonly priority: number;
  readonly reason: string;
  readonly stageMood: ChatRoomStageMood;
}

export class GamePrimitivesNarrativeRouter {
  public route(artifact: GamePrimitivesSignalAdapterArtifact): GamePrimitivesNarrativeRoute {
    const tier = (artifact.details as Record<string, unknown>).pressureTier as string ?? 'T0';
    const stageMood: ChatRoomStageMood = PRESSURE_TIER_MOOD[tier] ?? 'TENSE';

    if (artifact.isCinematic) {
      return { channel: 'HELPER_CALLOUT', priority: 95, reason: 'cinematic_moment', stageMood };
    }
    if (artifact.narrativeWeight === 'SOVEREIGN') {
      return { channel: 'BOSS_DIALOGUE', priority: 85, reason: 'sovereign_pressure', stageMood };
    }
    if (artifact.severity === 'CRITICAL') {
      return { channel: 'SYSTEM_ALERT', priority: 80, reason: 'ux_collapse_critical', stageMood };
    }
    if (artifact.narrativeWeight === 'TACTICAL') {
      return { channel: 'HATER_TAUNT', priority: 55, reason: 'tactical_pressure', stageMood };
    }
    if (artifact.uxScore > 0.85) {
      return { channel: 'SILENT', priority: 5, reason: 'high_ux_ambient_suppress', stageMood };
    }
    return { channel: 'AMBIENT_COMMENT', priority: 20, reason: 'primitives_ambient', stageMood };
  }

  public routeBatch(
    artifacts: ReadonlyArray<GamePrimitivesSignalAdapterArtifact>,
  ): ReadonlyArray<{ artifact: GamePrimitivesSignalAdapterArtifact; route: GamePrimitivesNarrativeRoute }> {
    return artifacts
      .map(a => ({ artifact: a, route: this.route(a) }))
      .sort((a, b) => b.route.priority - a.route.priority);
  }
}

// ─── §8 GamePrimitivesSignalCorrelator ────────────────────────────────────────
export interface GamePrimitivesCorrelationEntry {
  readonly correlationId: string;
  readonly eventKind: string;
  readonly pressureTier: string;
  readonly startTick: number;
  readonly lastTick: number;
  readonly signalCount: number;
  readonly hasCinematic: boolean;
  readonly maxPressure: Score01;
}

export class GamePrimitivesSignalCorrelator {
  private readonly active: Map<string, GamePrimitivesCorrelationEntry> = new Map();
  private readonly maxActive = 100;

  public correlate(artifact: GamePrimitivesSignalAdapterArtifact): string {
    const tier = (artifact.details as Record<string, unknown>).pressureTier as string ?? 'T0';
    const key = `${artifact.eventName}:${tier}`;
    const existing = this.active.get(key);
    const id = existing?.correlationId ?? `prim-${artifact.eventName}-${tier}-${artifact.tick}`;
    const prevPressure = existing?.maxPressure ?? clamp01(0) as Score01;

    this.active.set(key, Object.freeze({
      correlationId: id,
      eventKind: artifact.eventName,
      pressureTier: tier,
      startTick: existing?.startTick ?? artifact.tick,
      lastTick: artifact.tick,
      signalCount: (existing?.signalCount ?? 0) + 1,
      hasCinematic: (existing?.hasCinematic ?? false) || artifact.isCinematic,
      maxPressure: (clamp01(artifact.pressureMomentum / 100) > prevPressure
        ? clamp01(artifact.pressureMomentum / 100)
        : prevPressure) as Score01,
    }));

    if (this.active.size > this.maxActive) {
      const firstKey = this.active.keys().next().value;
      if (firstKey) this.active.delete(firstKey);
    }

    return id;
  }

  public activeCorrelations(): ReadonlyArray<GamePrimitivesCorrelationEntry> {
    return [...this.active.values()];
  }

  public reset(): void { this.active.clear(); }
}

// ─── §9 GamePrimitivesSignalBudget ────────────────────────────────────────────
export type GamePrimitivesSignalPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'BACKGROUND';

const GP_PRIORITY_NUMERIC: Record<GamePrimitivesSignalPriority, number> = {
  CRITICAL: 100, HIGH: 75, MEDIUM: 50, LOW: 25, BACKGROUND: 10,
};

export class GamePrimitivesSignalBudget {
  private readonly maxPerTick: number;
  private readonly queue: Array<{ envelope: ChatInputEnvelope; priority: GamePrimitivesSignalPriority }> = [];
  private flushedThisTick = 0;

  public constructor(maxPerTick = 10) { this.maxPerTick = maxPerTick; }

  public enqueue(envelope: ChatInputEnvelope, priority: GamePrimitivesSignalPriority): void {
    this.queue.push(Object.freeze({ envelope, priority }));
  }

  public flush(): ReadonlyArray<ChatInputEnvelope> {
    const sorted = [...this.queue].sort(
      (a, b) => GP_PRIORITY_NUMERIC[b.priority] - GP_PRIORITY_NUMERIC[a.priority],
    );
    const allowed = sorted.slice(0, this.maxPerTick);
    this.flushedThisTick = allowed.length;
    this.queue.length = 0;
    return Object.freeze(allowed.map(b => b.envelope));
  }

  public deriveSignalPriority(artifact: GamePrimitivesSignalAdapterArtifact): GamePrimitivesSignalPriority {
    if (artifact.isCinematic) return 'HIGH';
    if (artifact.severity === 'CRITICAL') return 'CRITICAL';
    if (artifact.narrativeWeight === 'SOVEREIGN') return 'HIGH';
    if (artifact.narrativeWeight === 'TACTICAL') return 'MEDIUM';
    return 'BACKGROUND';
  }

  public stats(): { flushedThisTick: number; maxPerTick: number; pendingCount: number } {
    return { flushedThisTick: this.flushedThisTick, maxPerTick: this.maxPerTick, pendingCount: this.queue.length };
  }

  public reset(): void { this.queue.length = 0; this.flushedThisTick = 0; }
}

// ─── §10 GamePrimitivesSignalPipeline ─────────────────────────────────────────
export interface GamePrimitivesSignalPipelineOptions {
  readonly roomId: ChatRoomId | string;
  readonly maxEnvelopesPerTick?: number;
  readonly dedupeWindowMs?: number;
  readonly maxHistory?: number;
  readonly emitMLVectors?: boolean;
}

export interface GamePrimitivesSignalPipelineResult {
  readonly tick: number;
  readonly envelopes: ReadonlyArray<ChatInputEnvelope>;
  readonly acceptedCount: number;
  readonly dedupedCount: number;
  readonly rejectedCount: number;
  readonly dlVector: GamePrimitivesDLVector;
  readonly healthReport: GamePrimitivesHealthReport;
  readonly patterns: ReadonlyArray<GamePrimitivesPattern>;
}

export class GamePrimitivesSignalPipeline {
  public readonly adapter: GamePrimitivesSignalAdapter;
  public readonly rollingWindow: GamePrimitivesRollingWindow;
  public readonly analytics: GamePrimitivesSignalAnalytics;
  public readonly mlExtractor: GamePrimitivesMLExtractor;
  public readonly patternDetector: GamePrimitivesPatternDetector;
  public readonly healthTracker: GamePrimitivesHealthTracker;
  public readonly narrativeRouter: GamePrimitivesNarrativeRouter;
  public readonly correlator: GamePrimitivesSignalCorrelator;
  public readonly budget: GamePrimitivesSignalBudget;
  private readonly clock: GamePrimitivesSignalAdapterClock;

  public constructor(opts: GamePrimitivesSignalPipelineOptions) {
    this.clock = SYSTEM_CLOCK;
    this.adapter = new GamePrimitivesSignalAdapter({
      defaultRoomId: opts.roomId,
      dedupeWindowMs: opts.dedupeWindowMs ?? 3_000,
      maxHistory: opts.maxHistory ?? 200,
      emitMLVectors: opts.emitMLVectors ?? false,
    });
    this.rollingWindow = new GamePrimitivesRollingWindow(60);
    this.analytics = new GamePrimitivesSignalAnalytics();
    this.mlExtractor = new GamePrimitivesMLExtractor(this.rollingWindow, this.analytics);
    this.patternDetector = new GamePrimitivesPatternDetector();
    this.healthTracker = new GamePrimitivesHealthTracker(this.rollingWindow, this.analytics);
    this.narrativeRouter = new GamePrimitivesNarrativeRouter();
    this.correlator = new GamePrimitivesSignalCorrelator();
    this.budget = new GamePrimitivesSignalBudget(opts.maxEnvelopesPerTick ?? 10);
  }

  public processTick(
    signals: ReadonlyArray<GamePrimitivesChatSignalCompat>,
    tick: number,
    experience?: GamePrimitivesRunExperienceCompat,
  ): GamePrimitivesSignalPipelineResult {
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
          this.budget.enqueue(result.envelope, priority);
        }
        this.correlator.correlate(result);
        const tier = (result.details as Record<string, unknown>).pressureTier as string ?? 'T0';
        this.rollingWindow.record({
          tick: result.tick,
          uxScore: result.uxScore,
          pressureNumeric: clamp01(PRESSURE_TIER_NUMERIC[tier] ?? 0) as Score01,
          pressureTier: tier,
          isCinematic: result.isCinematic,
          momentum: 0,
          riskScore: clamp01(0) as Score01,
          at: now,
        });
      } else if ('dedupeKey' in result) {
        deduped++;
      } else {
        rejected++;
      }
    }

    if (experience !== undefined) {
      const expResult = this.adapter.ingestRunExperience(
        experience, tick, 'AUTO', 'PIPELINE',
      );
      if ('envelope' in expResult) {
        accepted++;
        this.analytics.record(expResult);
        const priority = this.budget.deriveSignalPriority(expResult);
        this.budget.enqueue(expResult.envelope, priority);
        const latestTier = this.rollingWindow.latest()?.pressureTier ?? 'T0';
        this.rollingWindow.record({
          tick: expResult.tick,
          uxScore: expResult.uxScore,
          pressureNumeric: clamp01(PRESSURE_TIER_NUMERIC[latestTier] ?? 0) as Score01,
          pressureTier: latestTier,
          isCinematic: expResult.isCinematic,
          momentum: experience.momentum ?? 0,
          riskScore: clamp01(experience.riskScore ?? 0) as Score01,
          at: now,
        });
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

// ─── §11 GamePrimitivesSignalFacade ───────────────────────────────────────────
export class GamePrimitivesSignalFacade {
  private readonly pipeline: GamePrimitivesSignalPipeline;

  public constructor(opts: GamePrimitivesSignalPipelineOptions) {
    this.pipeline = new GamePrimitivesSignalPipeline(opts);
  }

  public onTick(
    signals: ReadonlyArray<GamePrimitivesChatSignalCompat>,
    tick: number,
    experience?: GamePrimitivesRunExperienceCompat,
  ): ReadonlyArray<ChatInputEnvelope> {
    return this.pipeline.processTick(signals, tick, experience).envelopes;
  }

  public diagnostics(): Readonly<Record<string, JsonValue>> {
    const state = this.pipeline.adapter.getState();
    const health = this.pipeline.healthTracker.buildReport();
    return Object.freeze({
      accepted: state.acceptedCount,
      deduped: state.dedupedCount,
      rejected: state.rejectedCount,
      cinematic: state.cinematicCount,
      grade: health.grade,
      trend: health.trend,
      dominantTier: health.dominantTier,
      stageMood: health.stageMood,
      isCinematic: health.isCinematic,
      isCritical: health.isCritical,
      lastTick: state.lastTick,
      lastUXScore: parseFloat(state.lastUXScore.toFixed(4)),
      avgUXScore: parseFloat(health.avgUXScore.toFixed(4)),
      avgPressure: parseFloat(health.avgPressure.toFixed(4)),
    });
  }

  public reset(): void { this.pipeline.reset(); }
}

// ─── §12 GamePrimitivesSignalAdapterSuite ─────────────────────────────────────
export class GamePrimitivesSignalAdapterSuite {
  public readonly adapter: GamePrimitivesSignalAdapter;
  public readonly pipeline: GamePrimitivesSignalPipeline;
  public readonly analytics: GamePrimitivesSignalAnalytics;
  public readonly patternDetector: GamePrimitivesPatternDetector;
  public readonly mlExtractor: GamePrimitivesMLExtractor;
  public readonly healthTracker: GamePrimitivesHealthTracker;
  public readonly correlator: GamePrimitivesSignalCorrelator;
  public readonly narrativeRouter: GamePrimitivesNarrativeRouter;
  public readonly rollingWindow: GamePrimitivesRollingWindow;
  public readonly budget: GamePrimitivesSignalBudget;
  public readonly facade: GamePrimitivesSignalFacade;

  public constructor(opts: GamePrimitivesSignalPipelineOptions) {
    this.pipeline = new GamePrimitivesSignalPipeline(opts);
    this.adapter = this.pipeline.adapter;
    this.analytics = this.pipeline.analytics;
    this.patternDetector = this.pipeline.patternDetector;
    this.mlExtractor = this.pipeline.mlExtractor;
    this.healthTracker = this.pipeline.healthTracker;
    this.correlator = this.pipeline.correlator;
    this.narrativeRouter = this.pipeline.narrativeRouter;
    this.rollingWindow = this.pipeline.rollingWindow;
    this.budget = this.pipeline.budget;
    this.facade = new GamePrimitivesSignalFacade(opts);
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
export const GAME_PRIMITIVES_SIGNAL_ADAPTER_MANIFEST = Object.freeze({
  name: 'GamePrimitivesSignalAdapter',
  version: '2.0.0',
  surface: 'game_primitives',
  dlFeatureCount: GAME_PRIMITIVES_DL_FEATURE_LABELS.length,
  maxEnvelopesPerTick: 10,
  rollingWindowCapacity: 60,
  dedupeWindowMs: DEFAULT_DEDUPE_WINDOW_MS,
  pressureTiers: ['T0', 'T1', 'T2', 'T3', 'T4'],
} as const);

export function isGamePrimitivesSignalAdapterArtifact(
  v: unknown,
): v is GamePrimitivesSignalAdapterArtifact {
  return (
    typeof v === 'object' && v !== null &&
    'envelope' in v && 'dedupeKey' in v &&
    'isCinematic' in v && 'uxScore' in v && 'pressureMomentum' in v
  );
}

export function isGamePrimitivesChatSignalCompat(
  v: unknown,
): v is GamePrimitivesChatSignalCompat {
  return (
    typeof v === 'object' && v !== null &&
    'surface' in v && (v as Record<string, unknown>).surface === 'game_primitives' &&
    'kind' in v && 'tick' in v && 'severity' in v && 'message' in v
  );
}

export function createGamePrimitivesSignalPipeline(
  opts: GamePrimitivesSignalPipelineOptions,
): GamePrimitivesSignalPipeline {
  return new GamePrimitivesSignalPipeline(opts);
}

export function createGamePrimitivesSignalFacade(
  opts: GamePrimitivesSignalPipelineOptions,
): GamePrimitivesSignalFacade {
  return new GamePrimitivesSignalFacade(opts);
}

export function createGamePrimitivesSignalAdapterSuite(
  opts: GamePrimitivesSignalPipelineOptions,
): GamePrimitivesSignalAdapterSuite {
  return new GamePrimitivesSignalAdapterSuite(opts);
}

// ─── §14 GamePrimitivesUXScorer ───────────────────────────────────────────────
export interface GamePrimitivesUXScore {
  readonly score100: Score100;
  readonly grade: GamePrimitivesHealthGrade;
  readonly isCinematic: boolean;
  readonly isRecovery: boolean;
  readonly dominantMood: ChatRoomStageMood;
  readonly description: string;
}

export class GamePrimitivesUXScorer {
  private readonly window: GamePrimitivesRollingWindow;
  private readonly analytics: GamePrimitivesSignalAnalytics;

  public constructor(
    window: GamePrimitivesRollingWindow,
    analytics: GamePrimitivesSignalAnalytics,
  ) {
    this.window = window;
    this.analytics = analytics;
  }

  public score(): GamePrimitivesUXScore {
    const avgUX = this.window.averageUXScore();
    const avgPressure = this.window.averagePressure();
    const cinematicRate = this.window.cinematicRate();
    const trend = this.window.trend();
    const domTier = this.window.dominantPressureTier();
    const dominantMood: ChatRoomStageMood = PRESSURE_TIER_MOOD[domTier] ?? 'TENSE';

    const trendBonus = trend === 'RECOVERING' ? 5 : trend === 'ESCALATING' ? -5 : 0;
    const pressurePenalty = avgPressure > 0.7 ? -8 : 0;
    const raw = avgUX * 55 + cinematicRate * 25 + this.analytics.globalCinematicRate() * 20 + trendBonus + pressurePenalty;
    const score100 = clamp100(Math.round(raw)) as Score100;

    const grade: GamePrimitivesHealthGrade =
      score100 >= 88 ? 'S' :
      score100 >= 76 ? 'A' :
      score100 >= 60 ? 'B' :
      score100 >= 44 ? 'C' :
      score100 >= 28 ? 'D' : 'F';

    const descriptions: Record<GamePrimitivesHealthGrade, string> = {
      S: 'Peak game primitives UX — cinematic sequence at full momentum',
      A: 'Excellent — high UX delivery with manageable pressure',
      B: 'Good — stable primitives driving positive UX',
      C: 'Moderate — pressure affecting UX quality',
      D: 'Poor — high pressure causing UX deterioration',
      F: 'Critical — primitives failing to sustain UX baseline',
    };

    return Object.freeze({
      score100, grade,
      isCinematic: cinematicRate > 0.3 && grade !== 'F',
      isRecovery: trend === 'RECOVERING' && avgUX > 0.6,
      dominantMood, description: descriptions[grade],
    });
  }
}

// ─── §15 Module constants ─────────────────────────────────────────────────────
export const GAME_PRIMITIVES_ADAPTER_READY = true;
export const GAME_PRIMITIVES_MODULE_VERSION = '2.0.0' as const;
export const GAME_PRIMITIVES_CINEMATIC_THRESHOLD = DEFAULT_CINEMATIC_THRESHOLD;
export const GAME_PRIMITIVES_PRESSURE_TIER_NUMERIC = PRESSURE_TIER_NUMERIC;
export const GAME_PRIMITIVES_PRESSURE_TIER_MOOD = PRESSURE_TIER_MOOD;
export const GAME_PRIMITIVES_ADAPTER_MODULE_EXPORTS = [
  'GamePrimitivesSignalAdapter',
  'GamePrimitivesSignalPipeline',
  'GamePrimitivesSignalFacade',
  'GamePrimitivesSignalAdapterSuite',
  'GamePrimitivesSignalAnalytics',
  'GamePrimitivesPatternDetector',
  'GamePrimitivesMLExtractor',
  'GamePrimitivesHealthTracker',
  'GamePrimitivesNarrativeRouter',
  'GamePrimitivesSignalCorrelator',
  'GamePrimitivesRollingWindow',
  'GamePrimitivesSignalBudget',
  'GamePrimitivesUXScorer',
] as const;

export const GAME_PRIMITIVES_SIGNAL_ADAPTER_MODULE_READY = true;

// ─── §16 GamePrimitivesDiagnosticsService ────────────────────────────────────
export interface GamePrimitivesDiagnosticsSnapshot {
  readonly version: string;
  readonly healthGrade: GamePrimitivesHealthGrade;
  readonly trend: GamePrimitivesWindowTrend;
  readonly dominantTier: string;
  readonly stageMood: ChatRoomStageMood;
  readonly totalAccepted: number;
  readonly totalDeduped: number;
  readonly totalRejected: number;
  readonly totalCinematic: number;
  readonly globalCinematicRate: Score01;
  readonly avgUXScore: Score01;
  readonly avgPressure: Score01;
  readonly cinematicRate: Score01;
  readonly activeKindCount: number;
  readonly mostActiveKind: string | undefined;
  readonly recentPatternCount: number;
  readonly dlFeatureCount: number;
  readonly rollingWindowSize: number;
  readonly budgetStats: { flushedThisTick: number; maxPerTick: number; pendingCount: number };
}

export class GamePrimitivesDiagnosticsService {
  private readonly pipeline: GamePrimitivesSignalPipeline;

  public constructor(pipeline: GamePrimitivesSignalPipeline) {
    this.pipeline = pipeline;
  }

  public snapshot(): GamePrimitivesDiagnosticsSnapshot {
    const state = this.pipeline.adapter.getState();
    const health = this.pipeline.healthTracker.buildReport();
    const patterns = this.pipeline.patternDetector.recentPatterns(5);
    const allKinds = this.pipeline.analytics.allKindStats();

    return Object.freeze({
      version: GAME_PRIMITIVES_MODULE_VERSION,
      healthGrade: health.grade,
      trend: health.trend,
      dominantTier: health.dominantTier,
      stageMood: health.stageMood,
      totalAccepted: state.acceptedCount,
      totalDeduped: state.dedupedCount,
      totalRejected: state.rejectedCount,
      totalCinematic: state.cinematicCount,
      globalCinematicRate: this.pipeline.analytics.globalCinematicRate(),
      avgUXScore: this.pipeline.rollingWindow.averageUXScore(),
      avgPressure: this.pipeline.rollingWindow.averagePressure(),
      cinematicRate: this.pipeline.rollingWindow.cinematicRate(),
      activeKindCount: allKinds.length,
      mostActiveKind: this.pipeline.analytics.mostActiveKind(),
      recentPatternCount: patterns.length,
      dlFeatureCount: GAME_PRIMITIVES_DL_FEATURE_LABELS.length,
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
      dominantTier: snap.dominantTier,
      stageMood: snap.stageMood,
      totalAccepted: snap.totalAccepted,
      totalDeduped: snap.totalDeduped,
      totalRejected: snap.totalRejected,
      totalCinematic: snap.totalCinematic,
      globalCinematicRate: parseFloat(snap.globalCinematicRate.toFixed(4)),
      avgUXScore: parseFloat(snap.avgUXScore.toFixed(4)),
      avgPressure: parseFloat(snap.avgPressure.toFixed(4)),
      cinematicRate: parseFloat(snap.cinematicRate.toFixed(4)),
      activeKindCount: snap.activeKindCount,
      mostActiveKind: snap.mostActiveKind ?? null,
      recentPatternCount: snap.recentPatternCount,
      dlFeatureCount: snap.dlFeatureCount,
      rollingWindowSize: snap.rollingWindowSize,
    });
  }
}

// ─── §17 GamePrimitivesSignalRateController ───────────────────────────────────
export class GamePrimitivesSignalRateController {
  private currentRate: number;
  private readonly minRate: number;
  private readonly maxRate: number;
  private lastAdjustedAtTick = 0;
  private adjustmentReason = 'initial';

  public constructor(minRate = 1, maxRate = 12, initial = 5) {
    this.minRate = minRate;
    this.maxRate = maxRate;
    this.currentRate = Math.max(minRate, Math.min(maxRate, initial));
  }

  public adjust(healthReport: GamePrimitivesHealthReport, tick: number): void {
    const gradeToRate: Record<GamePrimitivesHealthGrade, number> = {
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

  public shouldEmit(n: number): boolean { return n <= this.currentRate; }

  public state(): Readonly<{ currentRate: number; lastAdjustedAtTick: number; adjustmentReason: string }> {
    return Object.freeze({ currentRate: this.currentRate, lastAdjustedAtTick: this.lastAdjustedAtTick, adjustmentReason: this.adjustmentReason });
  }

  public reset(): void {
    this.currentRate = Math.floor((this.minRate + this.maxRate) / 2);
    this.lastAdjustedAtTick = 0;
    this.adjustmentReason = 'reset';
  }
}

// ─── §18 GamePrimitivesReplayBuffer ──────────────────────────────────────────
export class GamePrimitivesReplayBuffer {
  private readonly capacity: number;
  private readonly buffer: Array<{
    tick: number;
    envelopes: ReadonlyArray<ChatInputEnvelope>;
    grade: GamePrimitivesHealthGrade;
    stageMood: ChatRoomStageMood;
  }> = [];

  public constructor(capacity = 20) { this.capacity = capacity; }

  public record(
    tick: number,
    envelopes: ReadonlyArray<ChatInputEnvelope>,
    grade: GamePrimitivesHealthGrade,
    stageMood: ChatRoomStageMood,
  ): void {
    if (this.buffer.length >= this.capacity) this.buffer.shift();
    this.buffer.push({ tick, envelopes: [...envelopes], grade, stageMood });
  }

  public replay(fromTick: number): ReadonlyArray<ChatInputEnvelope> {
    return this.buffer.filter(r => r.tick >= fromTick).flatMap(r => r.envelopes);
  }

  public gradeHistory(): ReadonlyArray<GamePrimitivesHealthGrade> { return this.buffer.map(r => r.grade); }
  public moodHistory(): ReadonlyArray<ChatRoomStageMood> { return this.buffer.map(r => r.stageMood); }

  public latest(): { tick: number; envelopes: ReadonlyArray<ChatInputEnvelope>; grade: GamePrimitivesHealthGrade; stageMood: ChatRoomStageMood } | undefined {
    return this.buffer[this.buffer.length - 1];
  }

  public clear(): void { this.buffer.length = 0; }
  public size(): number { return this.buffer.length; }
}

// ─── §19 GamePrimitivesThrottleGate ──────────────────────────────────────────
export class GamePrimitivesThrottleGate {
  private readonly tokens: Map<string, number> = new Map();
  private readonly bucketMax: number;
  private readonly refillRate: number;
  private lastRefill: UnixMs = 0 as UnixMs;

  public constructor(refillRate = 4, bucketMax = 16) {
    this.refillRate = refillRate;
    this.bucketMax = bucketMax;
  }

  public shouldAllow(eventKind: string, nowMs: UnixMs): boolean {
    this.maybeRefill(nowMs);
    const current = this.tokens.get(eventKind) ?? this.bucketMax;
    if (current <= 0) return false;
    this.tokens.set(eventKind, current - 1);
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

// ─── §20 GamePrimitivesSignalExtendedSuite ───────────────────────────────────
export class GamePrimitivesSignalExtendedSuite extends GamePrimitivesSignalAdapterSuite {
  public readonly diagnosticsService: GamePrimitivesDiagnosticsService;
  public readonly rateController: GamePrimitivesSignalRateController;
  public readonly uxScorer: GamePrimitivesUXScorer;
  public readonly replayBuffer: GamePrimitivesReplayBuffer;
  public readonly throttleGate: GamePrimitivesThrottleGate;

  public constructor(opts: GamePrimitivesSignalPipelineOptions) {
    super(opts);
    this.diagnosticsService = new GamePrimitivesDiagnosticsService(this.pipeline);
    this.rateController = new GamePrimitivesSignalRateController(1, 12, 5);
    this.uxScorer = new GamePrimitivesUXScorer(this.rollingWindow, this.analytics);
    this.replayBuffer = new GamePrimitivesReplayBuffer(20);
    this.throttleGate = new GamePrimitivesThrottleGate(4, 16);
  }

  public processTickExtended(
    signals: ReadonlyArray<GamePrimitivesChatSignalCompat>,
    tick: number,
    experience?: GamePrimitivesRunExperienceCompat,
  ): GamePrimitivesSignalPipelineResult & {
    uxScore: GamePrimitivesUXScore;
    diagnostics: Readonly<Record<string, JsonValue>>;
  } {
    const result = this.pipeline.processTick(signals, tick, experience);
    const healthReport = this.healthTracker.buildReport();
    this.rateController.adjust(healthReport, tick);
    const uxScore = this.uxScorer.score();
    this.replayBuffer.record(tick, result.envelopes, healthReport.grade, healthReport.stageMood);
    const diagnostics = this.diagnosticsService.toJsonValue();
    return Object.freeze({ ...result, uxScore, diagnostics });
  }

  public override reset(): void {
    super.reset();
    this.rateController.reset();
    this.replayBuffer.clear();
    this.throttleGate.reset();
  }
}

export function createGamePrimitivesSignalExtendedSuite(
  opts: GamePrimitivesSignalPipelineOptions,
): GamePrimitivesSignalExtendedSuite {
  return new GamePrimitivesSignalExtendedSuite(opts);
}

// ─── §21 buildGamePrimitivesAdapterDiagnostics helper ────────────────────────
export function buildGamePrimitivesAdapterDiagnostics(
  adapter: GamePrimitivesSignalAdapter,
  analytics: GamePrimitivesSignalAnalytics,
  healthTracker: GamePrimitivesHealthTracker,
  patternDetector: GamePrimitivesPatternDetector,
): Readonly<Record<string, JsonValue>> {
  const state = adapter.getState();
  const health = healthTracker.buildReport();
  const patterns = patternDetector.recentPatterns(5);

  return Object.freeze({
    accepted: state.acceptedCount,
    deduped: state.dedupedCount,
    rejected: state.rejectedCount,
    cinematic: state.cinematicCount,
    lastTick: state.lastTick,
    lastPressureTier: state.lastPressureTier,
    lastUXScore: parseFloat(state.lastUXScore.toFixed(4)),
    grade: health.grade,
    trend: health.trend,
    dominantTier: health.dominantTier,
    stageMood: health.stageMood,
    avgUXScore: parseFloat(health.avgUXScore.toFixed(4)),
    avgPressure: parseFloat(health.avgPressure.toFixed(4)),
    cinematicRate: parseFloat(health.cinematicRate.toFixed(4)),
    isCinematic: health.isCinematic,
    isCritical: health.isCritical,
    isHealthy: health.isHealthy,
    mostActiveKind: analytics.mostActiveKind() ?? null,
    globalCinematicRate: parseFloat(analytics.globalCinematicRate().toFixed(4)),
    recentPatterns: patterns.map(p => p.kind),
    activeKindCount: analytics.allKindStats().length,
  });
}

// ─── §22 Final module constants ───────────────────────────────────────────────
export const GAME_PRIMITIVES_MAX_REPLAY_CAPACITY = 20 as const;
export const GAME_PRIMITIVES_THROTTLE_BUCKET_MAX = 16 as const;
export const GAME_PRIMITIVES_HEALTH_GRADE_WEIGHTS = Object.freeze({
  avgUXScore: 0.6,
  pressurePenalty: 0.4,
} as const);
export const GAME_PRIMITIVES_NARRATIVE_PRIORITY = Object.freeze({
  BOSS_DIALOGUE: 85,
  HELPER_CALLOUT: 95,
  SYSTEM_ALERT: 80,
  HATER_TAUNT: 55,
  AMBIENT_COMMENT: 20,
  SILENT: 5,
} as const);

// ─── §23 GamePrimitivesTickSummaryBuilder ─────────────────────────────────────
export interface GamePrimitivesTickSummary {
  readonly tick: number;
  readonly at: UnixMs;
  readonly accepted: number;
  readonly rejected: number;
  readonly deduped: number;
  readonly envelopesEmitted: number;
  readonly healthGrade: GamePrimitivesHealthGrade;
  readonly trend: GamePrimitivesWindowTrend;
  readonly dominantTier: string;
  readonly stageMood: ChatRoomStageMood;
  readonly avgUXScore: Score01;
  readonly avgPressure: Score01;
  readonly cinematicRate: Score01;
  readonly isCinematic: boolean;
  readonly isCritical: boolean;
}

export class GamePrimitivesTickSummaryBuilder {
  private readonly summaries: GamePrimitivesTickSummary[] = [];
  private readonly maxSummaries = 100;
  private readonly clock: GamePrimitivesSignalAdapterClock;

  public constructor(clock?: GamePrimitivesSignalAdapterClock) {
    this.clock = clock ?? SYSTEM_CLOCK;
  }

  public build(
    result: GamePrimitivesSignalPipelineResult,
    health: GamePrimitivesHealthReport,
  ): GamePrimitivesTickSummary {
    const summary: GamePrimitivesTickSummary = Object.freeze({
      tick: result.tick,
      at: this.clock.now(),
      accepted: result.acceptedCount,
      rejected: result.rejectedCount,
      deduped: result.dedupedCount,
      envelopesEmitted: result.envelopes.length,
      healthGrade: health.grade,
      trend: health.trend,
      dominantTier: health.dominantTier,
      stageMood: health.stageMood,
      avgUXScore: health.avgUXScore,
      avgPressure: health.avgPressure,
      cinematicRate: health.cinematicRate,
      isCinematic: health.isCinematic,
      isCritical: health.isCritical,
    });

    if (this.summaries.length >= this.maxSummaries) this.summaries.shift();
    this.summaries.push(summary);
    return summary;
  }

  public recent(limit = 10): ReadonlyArray<GamePrimitivesTickSummary> {
    return Object.freeze(this.summaries.slice(-limit));
  }

  public clear(): void { this.summaries.length = 0; }
}

// ─── §24 GamePrimitivesEnvelopeValidator ─────────────────────────────────────
export class GamePrimitivesEnvelopeValidator {
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

// ─── §25 Final module flag ────────────────────────────────────────────────────
export const GAME_PRIMITIVES_SIGNAL_ADAPTER_COMPLETE = true;
