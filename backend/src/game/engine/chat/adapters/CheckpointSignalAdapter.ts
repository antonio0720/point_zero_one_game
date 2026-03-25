/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT CHECKPOINT SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/CheckpointSignalAdapter.ts
 * VERSION: 2026.03.25
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates RuntimeCheckpointStore signals —
 * phase crossings, rollback risk alerts, terminal checkpoints, economy decline,
 * shield critical alerts, ML vector emissions, and battle surge events — into
 * authoritative backend-chat ingress envelopes.
 *
 * Backend-truth question
 * ----------------------
 *   "When the checkpoint store writes a terminal checkpoint, detects a rollback
 *    risk above threshold, or observes the run crossing a phase boundary, what
 *    exact chat-native signal should the authoritative backend chat engine
 *    ingest to preserve simulation fidelity and drive NPC companion coaching?"
 *
 * Design laws
 * -----------
 * - No circular imports from core/. All core types are mirrored as structural
 *   compat interfaces defined in this file.
 * - Callers pass real CheckpointChatSignalPayload objects — they satisfy the
 *   compat interface structurally without any casting.
 * - ROLLBACK_RISK_CRITICAL and TERMINAL_CHECKPOINT are always accepted and
 *   routed as CRITICAL severity — they represent real simulation pressure.
 * - Routine CHECKPOINT_WRITTEN signals are suppressed by default to avoid
 *   flooding the chat engine with low-signal events.
 * - ML vector signals are only emitted when emitMLVectors is enabled.
 * - PHASE_CROSSED_AT_CHECKPOINT and TIER_CROSSED_AT_CHECKPOINT are always
 *   accepted because they mark irreversible game-state transitions.
 * - Dedupe window prevents repeated firing on the same tick/phase combination.
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
// Structural compat interfaces — mirrors of core checkpoint types
// ─────────────────────────────────────────────────────────────────────────────

/** Structural mirror of CheckpointChatSignalPayload from core/RuntimeCheckpointStore.ts */
export interface CheckpointChatSignalCompat {
  readonly signalId: string;
  readonly runId: string;
  readonly tick: number;
  readonly capturedAtMs: number;
  readonly urgency: 'BACKGROUND' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  readonly signalKind:
    | 'CHECKPOINT_WRITTEN'
    | 'ROLLBACK_RISK_ELEVATED'
    | 'ROLLBACK_RISK_CRITICAL'
    | 'PHASE_CROSSED_AT_CHECKPOINT'
    | 'TIER_CROSSED_AT_CHECKPOINT'
    | 'TERMINAL_CHECKPOINT'
    | 'ECONOMY_DECLINING'
    | 'SHIELD_CRITICAL'
    | 'BATTLE_SURGE'
    | string;
  readonly companionMessage: string;
  readonly pressureTierLabel: string;
  readonly pressureTierExperience: string;
  readonly outcomeExcitement: number;
  readonly isWinPath: boolean;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/** Structural mirror of CheckpointMLVector from core/RuntimeCheckpointStore.ts */
export interface CheckpointMLVectorCompat {
  readonly runId: string;
  readonly tick: number;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly vectorShape: readonly [1, 24] | readonly [number, number];
  readonly extractedAtMs: number;
}

/** Structural mirror of CheckpointDLTensor from core/RuntimeCheckpointStore.ts */
export interface CheckpointDLTensorCompat {
  readonly runId: string;
  readonly tick: number;
  readonly inputVector: readonly number[];
  readonly featureLabels: readonly string[];
  readonly tensorShape: readonly [1, 48] | readonly [number, number];
  readonly policyVersion: string;
  readonly extractedAtMs: number;
}

/** Structural mirror of CheckpointRollbackRisk from core/RuntimeCheckpointStore.ts */
export interface CheckpointRollbackRiskCompat {
  readonly runId: string;
  readonly tick: number;
  readonly overallRiskScore: number;
  readonly economicRiskContribution: number;
  readonly shieldRiskContribution: number;
  readonly battleRiskContribution: number;
  readonly trajectoryRiskContribution: number;
  readonly dominantRiskFactor: string;
  readonly isAboveThreshold: boolean;
  readonly suggestedAction: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter types
// ─────────────────────────────────────────────────────────────────────────────

export interface CheckpointSignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface CheckpointSignalAdapterClock {
  now(): UnixMs;
}

export interface CheckpointSignalAdapterOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly dedupeWindowMs?: number;
  readonly maxHistory?: number;
  /** Suppress low-signal CHECKPOINT_WRITTEN events (default: true). */
  readonly suppressRoutineWrites?: boolean;
  /** Emit ML vector signals via adaptML() (default: false). */
  readonly emitMLVectors?: boolean;
  /** Emit DL tensor signals via adaptDL() (default: false). */
  readonly emitDLTensors?: boolean;
  /** Minimum rollback risk score to accept ROLLBACK_RISK_ELEVATED events (default: 0.5). */
  readonly rollbackRiskElevatedThreshold?: number;
  readonly logger?: CheckpointSignalAdapterLogger;
  readonly clock?: CheckpointSignalAdapterClock;
}

export interface CheckpointSignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export type CheckpointSignalAdapterEventName =
  | 'checkpoint.written'
  | 'checkpoint.rollback_risk.elevated'
  | 'checkpoint.rollback_risk.critical'
  | 'checkpoint.phase.crossed'
  | 'checkpoint.tier.crossed'
  | 'checkpoint.terminal'
  | 'checkpoint.economy.declining'
  | 'checkpoint.shield.critical'
  | 'checkpoint.battle.surge'
  | 'checkpoint.ml.vector_emitted'
  | 'checkpoint.dl.tensor_emitted'
  | string;

export type CheckpointSignalAdapterNarrativeWeight =
  | 'AMBIENT'
  | 'TACTICAL'
  | 'PHASE_TRANSITION'
  | 'CRITICAL'
  | 'TERMINAL';

export type CheckpointSignalAdapterSeverity =
  | 'DEBUG'
  | 'INFO'
  | 'WARN'
  | 'CRITICAL';

export interface CheckpointSignalAdapterArtifact {
  readonly envelope: ChatInputEnvelope;
  readonly dedupeKey: string;
  readonly routeChannel: ChatVisibleChannel;
  readonly narrativeWeight: CheckpointSignalAdapterNarrativeWeight;
  readonly severity: CheckpointSignalAdapterSeverity;
  readonly eventName: CheckpointSignalAdapterEventName;
  readonly tick: number;
  readonly runId: string;
  readonly urgency: CheckpointChatSignalCompat['urgency'];
  readonly signalKind: string;
  readonly outcomeExcitement: Score01;
  readonly isWinPath: boolean;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface CheckpointSignalAdapterRejection {
  readonly eventName: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface CheckpointSignalAdapterDeduped {
  readonly eventName: string;
  readonly dedupeKey: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface CheckpointSignalAdapterHistoryEntry {
  readonly at: UnixMs;
  readonly eventName: CheckpointSignalAdapterEventName;
  readonly tick: number;
  readonly runId: string;
  readonly severity: CheckpointSignalAdapterSeverity;
  readonly signalKind: string;
  readonly urgency: string;
  readonly dedupeKey: string;
}

export interface CheckpointSignalAdapterReport {
  readonly accepted: readonly CheckpointSignalAdapterArtifact[];
  readonly deduped: readonly CheckpointSignalAdapterDeduped[];
  readonly rejected: readonly CheckpointSignalAdapterRejection[];
}

export interface CheckpointSignalAdapterState {
  readonly history: readonly CheckpointSignalAdapterHistoryEntry[];
  readonly lastAcceptedAtByKey: Readonly<Record<string, UnixMs>>;
  readonly lastSignalKind: string;
  readonly acceptedCount: number;
  readonly dedupedCount: number;
  readonly rejectedCount: number;
  readonly terminalCheckpointCount: number;
  readonly rollbackRiskAlertCount: number;
  readonly phaseCrossingCount: number;
  readonly mlVectorCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_DEDUPE_WINDOW_MS = 5_000;
const DEFAULT_MAX_HISTORY = 200;
const DEFAULT_ROLLBACK_RISK_ELEVATED_THRESHOLD = 0.5;

const NULL_LOGGER: CheckpointSignalAdapterLogger = Object.freeze({
  debug() {},
  warn() {},
  error() {},
});

const SYSTEM_CLOCK: CheckpointSignalAdapterClock = Object.freeze({
  now(): UnixMs { return asUnixMs(Date.now()); },
});

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function signalKindToEventName(kind: string): CheckpointSignalAdapterEventName {
  switch (kind) {
    case 'CHECKPOINT_WRITTEN': return 'checkpoint.written';
    case 'ROLLBACK_RISK_ELEVATED': return 'checkpoint.rollback_risk.elevated';
    case 'ROLLBACK_RISK_CRITICAL': return 'checkpoint.rollback_risk.critical';
    case 'PHASE_CROSSED_AT_CHECKPOINT': return 'checkpoint.phase.crossed';
    case 'TIER_CROSSED_AT_CHECKPOINT': return 'checkpoint.tier.crossed';
    case 'TERMINAL_CHECKPOINT': return 'checkpoint.terminal';
    case 'ECONOMY_DECLINING': return 'checkpoint.economy.declining';
    case 'SHIELD_CRITICAL': return 'checkpoint.shield.critical';
    case 'BATTLE_SURGE': return 'checkpoint.battle.surge';
    default: return `checkpoint.${kind.toLowerCase()}`;
  }
}

function classifySeverity(
  urgency: CheckpointChatSignalCompat['urgency'],
  signalKind: string,
): CheckpointSignalAdapterSeverity {
  if (urgency === 'CRITICAL' || signalKind === 'TERMINAL_CHECKPOINT' || signalKind === 'ROLLBACK_RISK_CRITICAL') {
    return 'CRITICAL';
  }
  if (urgency === 'HIGH' || signalKind === 'ROLLBACK_RISK_ELEVATED' || signalKind === 'SHIELD_CRITICAL') {
    return 'WARN';
  }
  if (urgency === 'MODERATE' || signalKind === 'PHASE_CROSSED_AT_CHECKPOINT' || signalKind === 'TIER_CROSSED_AT_CHECKPOINT') {
    return 'INFO';
  }
  return 'DEBUG';
}

function classifyNarrativeWeight(
  signalKind: string,
  severity: CheckpointSignalAdapterSeverity,
): CheckpointSignalAdapterNarrativeWeight {
  if (signalKind === 'TERMINAL_CHECKPOINT') return 'TERMINAL';
  if (severity === 'CRITICAL') return 'CRITICAL';
  if (signalKind === 'PHASE_CROSSED_AT_CHECKPOINT' || signalKind === 'TIER_CROSSED_AT_CHECKPOINT') {
    return 'PHASE_TRANSITION';
  }
  if (severity === 'WARN') return 'TACTICAL';
  return 'AMBIENT';
}

function buildCheckpointSignalEnvelope(
  signal: CheckpointChatSignalCompat,
  roomId: ChatRoomId | string | null,
  excitement: number,
  now: UnixMs,
): ChatSignalEnvelope {
  const heatMultiplier = clamp01(excitement) as Score01;
  return Object.freeze({
    type: 'LIVEOPS' as const,
    emittedAt: now,
    roomId: (roomId ?? null) as Nullable<ChatRoomId>,
    liveops: Object.freeze({
      worldEventName: signalKindToEventName(signal.signalKind),
      heatMultiplier01: heatMultiplier,
      helperBlackout: signal.urgency === 'CRITICAL' && !signal.isWinPath,
      haterRaidActive: signal.signalKind === 'BATTLE_SURGE',
    }),
    metadata: Object.freeze({
      runId: signal.runId,
      tick: signal.tick,
      signalKind: signal.signalKind,
      urgency: signal.urgency,
      companionMessage: signal.companionMessage,
      pressureTierLabel: signal.pressureTierLabel,
      pressureTierExperience: signal.pressureTierExperience,
      outcomeExcitement: parseFloat(excitement.toFixed(4)),
      isWinPath: signal.isWinPath,
      capturedAtMs: signal.capturedAtMs,
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

function buildDedupeKey(signal: CheckpointChatSignalCompat): string {
  return `${signal.runId}:${signal.signalKind}:${signal.tick}:${signal.pressureTierLabel}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CheckpointSignalAdapter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adapts RuntimeCheckpointStore chat signals into backend-chat ingress envelopes.
 *
 * Filtering policy:
 * - TERMINAL_CHECKPOINT and ROLLBACK_RISK_CRITICAL: always accepted
 * - PHASE_CROSSED_AT_CHECKPOINT, TIER_CROSSED_AT_CHECKPOINT: always accepted
 * - ROLLBACK_RISK_ELEVATED: accepted only if risk score meets threshold
 * - CHECKPOINT_WRITTEN: suppressed when suppressRoutineWrites is true (default)
 * - All others: accepted, deduped within the window
 */
export class CheckpointSignalAdapter {
  private readonly options: Required<CheckpointSignalAdapterOptions>;
  private readonly logger: CheckpointSignalAdapterLogger;
  private readonly clock: CheckpointSignalAdapterClock;

  private readonly history: CheckpointSignalAdapterHistoryEntry[] = [];
  private readonly lastAcceptedAtByKey: Map<string, UnixMs> = new Map();

  private acceptedCount = 0;
  private dedupedCount = 0;
  private rejectedCount = 0;
  private terminalCheckpointCount = 0;
  private rollbackRiskAlertCount = 0;
  private phaseCrossingCount = 0;
  private mlVectorCount = 0;
  private lastSignalKind = 'NONE';

  public constructor(options: CheckpointSignalAdapterOptions) {
    this.logger = options.logger ?? NULL_LOGGER;
    this.clock = options.clock ?? SYSTEM_CLOCK;
    this.options = Object.freeze({
      defaultRoomId: options.defaultRoomId,
      defaultVisibleChannel: options.defaultVisibleChannel ?? 'GLOBAL',
      dedupeWindowMs: options.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS,
      maxHistory: options.maxHistory ?? DEFAULT_MAX_HISTORY,
      suppressRoutineWrites: options.suppressRoutineWrites ?? true,
      emitMLVectors: options.emitMLVectors ?? false,
      emitDLTensors: options.emitDLTensors ?? false,
      rollbackRiskElevatedThreshold: options.rollbackRiskElevatedThreshold ?? DEFAULT_ROLLBACK_RISK_ELEVATED_THRESHOLD,
      logger: this.logger,
      clock: this.clock,
    });
  }

  /**
   * Adapt a checkpoint chat signal into a ChatInputEnvelope.
   * Returns the artifact if accepted, or null if suppressed/deduped.
   */
  public adapt(
    signal: CheckpointChatSignalCompat,
    ctx: CheckpointSignalAdapterContext = {},
  ): CheckpointSignalAdapterArtifact | null {
    const now = this.clock.now();
    const roomId = ctx.roomId ?? this.options.defaultRoomId;
    const channel = ctx.routeChannel ?? this.options.defaultVisibleChannel;
    const dedupeKey = buildDedupeKey(signal);
    const eventName = signalKindToEventName(signal.signalKind);

    // Suppression filter for routine writes
    if (signal.signalKind === 'CHECKPOINT_WRITTEN' && this.options.suppressRoutineWrites) {
      this.rejectedCount++;
      this.logger.debug('CheckpointSignalAdapter: suppressed routine write', {
        runId: signal.runId, tick: signal.tick,
      });
      return null;
    }

    // Rejection filter for below-threshold rollback risk elevated
    if (
      signal.signalKind === 'ROLLBACK_RISK_ELEVATED' &&
      (signal.metadata['overallRiskScore'] as number ?? 0) < this.options.rollbackRiskElevatedThreshold
    ) {
      this.rejectedCount++;
      this.logger.debug('CheckpointSignalAdapter: rollback risk below threshold', {
        runId: signal.runId, tick: signal.tick,
      });
      return null;
    }

    // Dedupe check — except for terminal/critical (always fire)
    const isAlwaysAccept =
      signal.signalKind === 'TERMINAL_CHECKPOINT' ||
      signal.signalKind === 'ROLLBACK_RISK_CRITICAL' ||
      signal.signalKind === 'PHASE_CROSSED_AT_CHECKPOINT' ||
      signal.signalKind === 'TIER_CROSSED_AT_CHECKPOINT';

    if (!isAlwaysAccept) {
      const lastAt = this.lastAcceptedAtByKey.get(dedupeKey);
      if (lastAt !== undefined && (now - lastAt) < this.options.dedupeWindowMs) {
        this.dedupedCount++;
        this.logger.debug('CheckpointSignalAdapter: deduped signal', { dedupeKey, runId: signal.runId });
        return null;
      }
    }

    const severity = classifySeverity(signal.urgency, signal.signalKind);
    const narrativeWeight = classifyNarrativeWeight(signal.signalKind, severity);
    const excitement = clamp01(signal.outcomeExcitement);

    const signalEnvelope = buildCheckpointSignalEnvelope(signal, roomId as ChatRoomId | string | null, excitement, now);
    const envelope = buildChatInputEnvelope(signalEnvelope, now);

    const artifact: CheckpointSignalAdapterArtifact = Object.freeze({
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
      outcomeExcitement: excitement as Score01,
      isWinPath: signal.isWinPath,
      details: Object.freeze({
        runId: signal.runId,
        tick: signal.tick,
        signalKind: signal.signalKind,
        urgency: signal.urgency,
        companionMessage: signal.companionMessage,
        pressureTierLabel: signal.pressureTierLabel,
        isWinPath: signal.isWinPath,
        outcomeExcitement: excitement,
        ...ctx.metadata,
      } as Record<string, JsonValue>),
    });

    this.lastAcceptedAtByKey.set(dedupeKey, now);
    this.acceptedCount++;
    this.lastSignalKind = signal.signalKind;

    if (signal.signalKind === 'TERMINAL_CHECKPOINT') this.terminalCheckpointCount++;
    if (signal.signalKind === 'ROLLBACK_RISK_ELEVATED' || signal.signalKind === 'ROLLBACK_RISK_CRITICAL') {
      this.rollbackRiskAlertCount++;
    }
    if (signal.signalKind === 'PHASE_CROSSED_AT_CHECKPOINT' || signal.signalKind === 'TIER_CROSSED_AT_CHECKPOINT') {
      this.phaseCrossingCount++;
    }

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

    this.logger.debug('CheckpointSignalAdapter: accepted signal', {
      runId: signal.runId, tick: signal.tick, signalKind: signal.signalKind, severity,
    });

    return artifact;
  }

  /**
   * Adapt a checkpoint ML vector into a ChatInputEnvelope.
   * Only accepted when emitMLVectors is true.
   */
  public adaptML(
    mlVector: CheckpointMLVectorCompat,
    ctx: CheckpointSignalAdapterContext = {},
  ): CheckpointSignalAdapterArtifact | null {
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

    const featureNorm = mlVector.features.length > 0
      ? mlVector.features.reduce((a, b) => a + b, 0) / mlVector.features.length
      : 0;
    const excitement = clamp01(featureNorm) as Score01;
    const pressure100 = Math.round(featureNorm * 100) as Score100;

    const signalEnvelope: ChatSignalEnvelope = Object.freeze({
      type: 'LIVEOPS' as const,
      emittedAt: now,
      roomId: (roomId ?? null) as Nullable<ChatRoomId>,
      liveops: Object.freeze({
        worldEventName: 'checkpoint.ml.vector_emitted',
        heatMultiplier01: excitement,
        helperBlackout: false,
        haterRaidActive: false,
      }),
      metadata: Object.freeze({
        runId: mlVector.runId,
        tick: mlVector.tick,
        featureCount: mlVector.features.length,
        avgFeatureValue: parseFloat(featureNorm.toFixed(6)),
        vectorShape: JSON.stringify(mlVector.vectorShape),
        extractedAtMs: mlVector.extractedAtMs,
        pressure100,
        labels: mlVector.featureLabels.slice(0, 8).join(','),
      } as Record<string, JsonValue>),
    });

    const envelope = buildChatInputEnvelope(signalEnvelope, now);

    const artifact: CheckpointSignalAdapterArtifact = Object.freeze({
      envelope,
      dedupeKey,
      routeChannel: channel as ChatVisibleChannel,
      narrativeWeight: 'AMBIENT',
      severity: 'DEBUG',
      eventName: 'checkpoint.ml.vector_emitted',
      tick: mlVector.tick,
      runId: mlVector.runId,
      urgency: 'BACKGROUND',
      signalKind: 'ML_VECTOR',
      outcomeExcitement: excitement,
      isWinPath: false,
      details: Object.freeze({
        runId: mlVector.runId,
        tick: mlVector.tick,
        featureCount: mlVector.features.length,
        avgFeatureValue: parseFloat(featureNorm.toFixed(6)),
        pressure100,
      } as Record<string, JsonValue>),
    });

    this.lastAcceptedAtByKey.set(dedupeKey, now);
    this.acceptedCount++;
    this.mlVectorCount++;

    this.pushHistory({
      at: now,
      eventName: 'checkpoint.ml.vector_emitted',
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
   * Adapt a checkpoint DL tensor into a ChatInputEnvelope.
   * Only accepted when emitDLTensors is true.
   */
  public adaptDL(
    dlTensor: CheckpointDLTensorCompat,
    ctx: CheckpointSignalAdapterContext = {},
  ): CheckpointSignalAdapterArtifact | null {
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
    const pressure100 = Math.round(avgInput * 100) as Score100;

    const signalEnvelope: ChatSignalEnvelope = Object.freeze({
      type: 'LIVEOPS' as const,
      emittedAt: now,
      roomId: (roomId ?? null) as Nullable<ChatRoomId>,
      liveops: Object.freeze({
        worldEventName: 'checkpoint.dl.tensor_emitted',
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

    const artifact: CheckpointSignalAdapterArtifact = Object.freeze({
      envelope,
      dedupeKey,
      routeChannel: channel as ChatVisibleChannel,
      narrativeWeight: 'AMBIENT',
      severity: 'DEBUG',
      eventName: 'checkpoint.dl.tensor_emitted',
      tick: dlTensor.tick,
      runId: dlTensor.runId,
      urgency: 'BACKGROUND',
      signalKind: 'DL_TENSOR',
      outcomeExcitement: excitement,
      isWinPath: false,
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
      eventName: 'checkpoint.dl.tensor_emitted',
      tick: dlTensor.tick,
      runId: dlTensor.runId,
      severity: 'DEBUG',
      signalKind: 'DL_TENSOR',
      urgency: 'BACKGROUND',
      dedupeKey,
    });

    return artifact;
  }

  /**
   * Adapt a rollback risk report into a ChatInputEnvelope.
   * Only fires when isAboveThreshold is true.
   */
  public adaptRollbackRisk(
    risk: CheckpointRollbackRiskCompat,
    ctx: CheckpointSignalAdapterContext = {},
  ): CheckpointSignalAdapterArtifact | null {
    if (!risk.isAboveThreshold) return null;

    const now = this.clock.now();
    const roomId = ctx.roomId ?? this.options.defaultRoomId;
    const channel = ctx.routeChannel ?? this.options.defaultVisibleChannel;
    const isCritical = risk.overallRiskScore >= 0.85;
    const dedupeKey = `rollback:${risk.runId}:${risk.tick}:${isCritical ? 'CRITICAL' : 'ELEVATED'}`;

    const lastAt = this.lastAcceptedAtByKey.get(dedupeKey);
    if (lastAt !== undefined && !isCritical && (now - lastAt) < this.options.dedupeWindowMs) {
      this.dedupedCount++;
      return null;
    }

    const excitement = clamp01(risk.overallRiskScore) as Score01;
    const pressure100 = Math.round(risk.overallRiskScore * 100) as Score100;
    const urgency = isCritical ? 'CRITICAL' : 'HIGH';
    const signalKind = isCritical ? 'ROLLBACK_RISK_CRITICAL' : 'ROLLBACK_RISK_ELEVATED';
    const eventName = isCritical ? 'checkpoint.rollback_risk.critical' : 'checkpoint.rollback_risk.elevated';
    const severity: CheckpointSignalAdapterSeverity = isCritical ? 'CRITICAL' : 'WARN';

    const signalEnvelope: ChatSignalEnvelope = Object.freeze({
      type: 'LIVEOPS' as const,
      emittedAt: now,
      roomId: (roomId ?? null) as Nullable<ChatRoomId>,
      liveops: Object.freeze({
        worldEventName: eventName,
        heatMultiplier01: excitement,
        helperBlackout: isCritical,
        haterRaidActive: false,
      }),
      metadata: Object.freeze({
        runId: risk.runId,
        tick: risk.tick,
        overallRiskScore: parseFloat(risk.overallRiskScore.toFixed(4)),
        dominantRiskFactor: risk.dominantRiskFactor,
        economicRiskContribution: parseFloat(risk.economicRiskContribution.toFixed(4)),
        shieldRiskContribution: parseFloat(risk.shieldRiskContribution.toFixed(4)),
        battleRiskContribution: parseFloat(risk.battleRiskContribution.toFixed(4)),
        trajectoryRiskContribution: parseFloat(risk.trajectoryRiskContribution.toFixed(4)),
        suggestedAction: risk.suggestedAction,
        isCritical,
        pressure100,
      } as Record<string, JsonValue>),
    });

    const envelope = buildChatInputEnvelope(signalEnvelope, now);

    const artifact: CheckpointSignalAdapterArtifact = Object.freeze({
      envelope,
      dedupeKey,
      routeChannel: channel as ChatVisibleChannel,
      narrativeWeight: isCritical ? 'CRITICAL' : 'TACTICAL',
      severity,
      eventName: eventName as CheckpointSignalAdapterEventName,
      tick: risk.tick,
      runId: risk.runId,
      urgency: urgency as CheckpointChatSignalCompat['urgency'],
      signalKind,
      outcomeExcitement: excitement,
      isWinPath: false,
      details: Object.freeze({
        runId: risk.runId,
        tick: risk.tick,
        overallRiskScore: parseFloat(risk.overallRiskScore.toFixed(4)),
        dominantRiskFactor: risk.dominantRiskFactor,
        suggestedAction: risk.suggestedAction,
        isCritical,
        pressure100,
      } as Record<string, JsonValue>),
    });

    this.lastAcceptedAtByKey.set(dedupeKey, now);
    this.acceptedCount++;
    this.rollbackRiskAlertCount++;

    this.pushHistory({
      at: now,
      eventName: eventName as CheckpointSignalAdapterEventName,
      tick: risk.tick,
      runId: risk.runId,
      severity,
      signalKind,
      urgency,
      dedupeKey,
    });

    return artifact;
  }

  /** Batch-adapt an array of checkpoint signals. */
  public adaptBatch(
    signals: readonly CheckpointChatSignalCompat[],
    ctx: CheckpointSignalAdapterContext = {},
  ): readonly CheckpointSignalAdapterArtifact[] {
    const results: CheckpointSignalAdapterArtifact[] = [];
    for (const signal of signals) {
      const artifact = this.adapt(signal, ctx);
      if (artifact !== null) results.push(artifact);
    }
    return Object.freeze(results);
  }

  /** Return the current accumulated state snapshot. */
  public state(): CheckpointSignalAdapterState {
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
      terminalCheckpointCount: this.terminalCheckpointCount,
      rollbackRiskAlertCount: this.rollbackRiskAlertCount,
      phaseCrossingCount: this.phaseCrossingCount,
      mlVectorCount: this.mlVectorCount,
    });
  }

  /** Return a point-in-time report of accepted/deduped/rejected counts. */
  public report(): CheckpointSignalAdapterReport {
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
        urgency: h.urgency as CheckpointChatSignalCompat['urgency'],
        signalKind: h.signalKind,
        outcomeExcitement: 0 as Score01,
        isWinPath: false,
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
    this.terminalCheckpointCount = 0;
    this.rollbackRiskAlertCount = 0;
    this.phaseCrossingCount = 0;
    this.mlVectorCount = 0;
    this.lastSignalKind = 'NONE';
  }

  private pushHistory(entry: CheckpointSignalAdapterHistoryEntry): void {
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
 * Convenience factory that creates a fully-configured CheckpointSignalAdapter.
 * Mirrors the factory pattern used by RegistrySignalAdapter, EventBusSignalAdapter, etc.
 */
export function createCheckpointSignalAdapter(
  options: CheckpointSignalAdapterOptions,
): CheckpointSignalAdapter {
  return new CheckpointSignalAdapter(options);
}
