/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ML CONFIDENCE SWING TRACKER
 * FILE: pzo-web/src/engines/chat/intelligence/ml/ConfidenceSwingTracker.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Dedicated temporal tracker for confidence collapse, stabilization,
 * reconstruction, and comeback readiness.
 *
 * Why this is separate from EmotionScorer
 * --------------------------------------
 * EmotionScorer gives the room’s full affective state right now.
 * ConfidenceSwingTracker answers a narrower authored question:
 * “Did the player just break, recover, stabilize, or enter a comeback window?”
 *
 * That distinction matters because PZO chat is not only reactive; it is staged.
 * Confidence swing is what decides whether the world should:
 * - mock,
 * - wait,
 * - witness,
 * - rescue,
 * - counter-challenge,
 * - open ceremony,
 * - or let the player breathe.
 * ============================================================================
 */

import type {
  ChatLearningBridgeProfileState,
  ChatLearningBridgePublicSnapshot,
  ChatLearningBridgeRecommendation,
} from '../ChatLearningBridge';

import type { ChatVisibleChannel, Score01, UnixMs } from '../../types';

import {
  CHAT_EMOTION_SCORER_MODULE_NAME,
  CHAT_EMOTION_SCORER_VERSION,
  type ChatEmotionScoreResult,
  createChatEmotionScorer,
} from './EmotionScorer';

/* ========================================================================== *
 * MARK: Module constants
 * ========================================================================== */

export const CHAT_CONFIDENCE_SWING_TRACKER_MODULE_NAME =
  'PZO_CHAT_CONFIDENCE_SWING_TRACKER' as const;

export const CHAT_CONFIDENCE_SWING_TRACKER_VERSION =
  '2026.03.20-confidence-swing-tracker.v1' as const;

export const CHAT_CONFIDENCE_SWING_TRACKER_RUNTIME_LAWS = Object.freeze([
  'Confidence should fall faster than it repairs.',
  'Comeback windows require survivable embarrassment, not merely rising confidence.',
  'Celebration should remain delayed when recovery is still brittle.',
  'A hard break deserves witness or rescue before swagger rhetoric.',
  'Tracker history must stay bounded and channel-aware.',
] as const);

export const CHAT_CONFIDENCE_SWING_TRACKER_DEFAULTS = Object.freeze({
  maxHistoryPerSubject: 18,
  hardBreakDelta: -0.18,
  softBreakDelta: -0.08,
  recoveryDelta: 0.06,
  surgeDelta: 0.12,
  stableBandDelta: 0.03,
  embarrassmentCeilingForComeback: 0.42,
  ceremonyReadinessFloor: 0.56,
  celebrationReadinessFloor: 0.66,
  helperWindowThreshold: 0.56,
  holdSilenceThreshold: 0.58,
} as const);

/* ========================================================================== *
 * MARK: Public contracts
 * ========================================================================== */

export type ChatConfidenceSwingPhase =
  | 'UNSET'
  | 'STABLE'
  | 'SOFT_BREAK'
  | 'HARD_BREAK'
  | 'RECOVERING'
  | 'SURGING'
  | 'COMEBACK_READY'
  | 'CEREMONIAL';

export type ChatConfidenceSwingDirection =
  | 'FALLING_FAST'
  | 'FALLING'
  | 'FLAT'
  | 'RISING'
  | 'RISING_FAST';

export interface ChatConfidenceSwingTrackerOptions {
  readonly defaults?: Partial<typeof CHAT_CONFIDENCE_SWING_TRACKER_DEFAULTS>;
  readonly emotionScorerOptions?: Parameters<typeof createChatEmotionScorer>[0];
}

export interface ChatConfidenceSwingCheckpoint {
  readonly observedAtUnixMs: UnixMs;
  readonly confidence01: Score01;
  readonly intimidation01: Score01;
  readonly frustration01: Score01;
  readonly embarrassment01: Score01;
  readonly relief01: Score01;
  readonly trust01: Score01;
  readonly comebackReadiness01: Score01;
  readonly celebrationTolerance01: Score01;
  readonly helperUrgency01: Score01;
  readonly silenceSuitability01: Score01;
  readonly channel: ChatVisibleChannel;
  readonly operatingState: string;
}

export interface ChatConfidenceSwingBreakdown {
  readonly moduleName: typeof CHAT_CONFIDENCE_SWING_TRACKER_MODULE_NAME;
  readonly moduleVersion: typeof CHAT_CONFIDENCE_SWING_TRACKER_VERSION;
  readonly emotionModuleName: typeof CHAT_EMOTION_SCORER_MODULE_NAME;
  readonly emotionModuleVersion: typeof CHAT_EMOTION_SCORER_VERSION;
  readonly currentConfidence01: Score01;
  readonly previousConfidence01?: Score01;
  readonly delta: number;
  readonly momentum01: Score01;
  readonly volatility01: Score01;
  readonly direction: ChatConfidenceSwingDirection;
  readonly phase: ChatConfidenceSwingPhase;
  readonly narrative: string;
}

export interface ChatConfidenceSwingPlan {
  readonly shouldHoldSilence: boolean;
  readonly shouldSummonHelper: boolean;
  readonly shouldInviteWitness: boolean;
  readonly shouldDelayCelebration: boolean;
  readonly shouldOpenComebackWindow: boolean;
  readonly preferredChannel: ChatVisibleChannel;
  readonly reason: string;
}

export interface ChatConfidenceSwingDecision {
  readonly emotion: ChatEmotionScoreResult;
  readonly current: ChatConfidenceSwingCheckpoint;
  readonly previous?: ChatConfidenceSwingCheckpoint;
  readonly historyDepth: number;
  readonly delta: number;
  readonly momentum01: Score01;
  readonly volatility01: Score01;
  readonly direction: ChatConfidenceSwingDirection;
  readonly phase: ChatConfidenceSwingPhase;
  readonly plan: ChatConfidenceSwingPlan;
  readonly bridgeRecommendation: ChatLearningBridgeRecommendation;
  readonly profilePatch: Partial<ChatLearningBridgeProfileState>;
  readonly breakdown: ChatConfidenceSwingBreakdown;
  readonly notes: readonly string[];
}

/* ========================================================================== *
 * MARK: Helpers
 * ========================================================================== */

type LooseRecord = Record<string, unknown>;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function asScore01(value: number): Score01 {
  return clamp01(value) as Score01;
}

function inferChannel(snapshot: unknown): ChatVisibleChannel {
  const direct =
    (snapshot as LooseRecord).activeChannel ??
    ((snapshot as LooseRecord).featureSnapshot as LooseRecord | undefined)?.channels;
  if (typeof direct === 'string') {
    const upper = direct.toUpperCase();
    if (
      upper === 'GLOBAL' ||
      upper === 'SYNDICATE' ||
      upper === 'DEAL_ROOM' ||
      upper === 'LOBBY'
    ) {
      return upper;
    }
  }
  return 'GLOBAL';
}

function directionFromDelta(delta: number): ChatConfidenceSwingDirection {
  if (delta <= -0.12) return 'FALLING_FAST';
  if (delta < -0.03) return 'FALLING';
  if (delta >= 0.12) return 'RISING_FAST';
  if (delta > 0.03) return 'RISING';
  return 'FLAT';
}

function mean(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return mean(values.map((value) => (value - m) ** 2));
}

function safeParts(parts: ReadonlyArray<string | undefined | null | false>): string {
  return parts.filter(Boolean).join(' | ');
}

/* ========================================================================== *
 * MARK: Tracker
 * ========================================================================== */

export class ChatConfidenceSwingTracker {
  private readonly defaults: typeof CHAT_CONFIDENCE_SWING_TRACKER_DEFAULTS;
  private readonly emotionScorer: ReturnType<typeof createChatEmotionScorer>;
  private readonly historyBySubject = new Map<string, ChatConfidenceSwingCheckpoint[]>();

  public constructor(options: ChatConfidenceSwingTrackerOptions = {}) {
    this.defaults = Object.freeze({
      ...CHAT_CONFIDENCE_SWING_TRACKER_DEFAULTS,
      ...(options.defaults ?? {}),
    });
    this.emotionScorer = createChatEmotionScorer(options.emotionScorerOptions);
  }

  public track(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): ChatConfidenceSwingDecision {
    const emotion = this.emotionScorer.score(snapshot);
    const current = this.createCheckpoint(snapshot, emotion);
    const key = this.subjectKey(snapshot, emotion);
    const history = [...(this.historyBySubject.get(key) ?? [])];
    const previous = history[history.length - 1];
    const delta = current.confidence01 - (previous?.confidence01 ?? current.confidence01);

    history.push(current);
    while (history.length > this.defaults.maxHistoryPerSubject) {
      history.shift();
    }
    this.historyBySubject.set(key, history);

    const confidenceSeries = history.map((item) => item.confidence01 as number);
    const momentum01 = asScore01(
      clamp01(
        Math.max(0, delta) * 0.62 +
          Math.max(0, current.relief01 - current.frustration01) * 0.2 +
          current.comebackReadiness01 * 0.18,
      ),
    );
    const volatility01 = asScore01(Math.sqrt(variance(confidenceSeries)));
    const direction = directionFromDelta(delta);
    const phase = this.resolvePhase(current, previous, delta);
    const plan = this.buildPlan(current, phase, direction);

    const bridgeRecommendation = {
      kind: 'CONFIDENCE_SWING_RUNTIME',
      phase,
      direction,
      recommendedChannel: plan.preferredChannel,
      explanation: plan.reason,
      confidence01: current.confidence01,
      delta,
      momentum01,
      volatility01,
      shouldHoldSilence: plan.shouldHoldSilence,
      shouldSummonHelper: plan.shouldSummonHelper,
      shouldInviteWitness: plan.shouldInviteWitness,
      shouldDelayCelebration: plan.shouldDelayCelebration,
      shouldOpenComebackWindow: plan.shouldOpenComebackWindow,
    } as ChatLearningBridgeRecommendation;

    const profilePatch = {
      confidenceSwingPhase: phase,
      confidenceSwingDirection: direction,
      lastConfidence01: current.confidence01,
      previousConfidence01: previous?.confidence01,
      confidenceDelta: delta,
      confidenceMomentum01: momentum01,
      confidenceVolatility01: volatility01,
      confidencePreferredChannel: plan.preferredChannel,
    } as Partial<ChatLearningBridgeProfileState>;

    const breakdown: ChatConfidenceSwingBreakdown = {
      moduleName: CHAT_CONFIDENCE_SWING_TRACKER_MODULE_NAME,
      moduleVersion: CHAT_CONFIDENCE_SWING_TRACKER_VERSION,
      emotionModuleName: CHAT_EMOTION_SCORER_MODULE_NAME,
      emotionModuleVersion: CHAT_EMOTION_SCORER_VERSION,
      currentConfidence01: current.confidence01,
      previousConfidence01: previous?.confidence01,
      delta,
      momentum01,
      volatility01,
      direction,
      phase,
      narrative: safeParts([
        `current=${current.confidence01.toFixed(3)}`,
        previous ? `previous=${previous.confidence01.toFixed(3)}` : undefined,
        `delta=${delta.toFixed(3)}`,
        `phase=${phase}`,
        `direction=${direction}`,
        `channel=${current.channel}`,
      ]),
    };

    return {
      emotion,
      current,
      previous,
      historyDepth: history.length,
      delta,
      momentum01,
      volatility01,
      direction,
      phase,
      plan,
      bridgeRecommendation,
      profilePatch,
      breakdown,
      notes: Object.freeze([
        ...emotion.notes,
        breakdown.narrative,
        plan.reason,
      ]),
    };
  }

  public recommend(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): ChatLearningBridgeRecommendation {
    return this.track(snapshot).bridgeRecommendation;
  }

  public refineProfile(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): Partial<ChatLearningBridgeProfileState> {
    return this.track(snapshot).profilePatch;
  }

  public clearHistory(): void {
    this.historyBySubject.clear();
  }

  private createCheckpoint(
    snapshot: ChatLearningBridgePublicSnapshot,
    emotion: ChatEmotionScoreResult,
  ): ChatConfidenceSwingCheckpoint {
    const now = Date.now() as UnixMs;
    return {
      observedAtUnixMs: now,
      confidence01: emotion.emotionSnapshot.vector.confidence,
      intimidation01: emotion.emotionSnapshot.vector.intimidation,
      frustration01: emotion.emotionSnapshot.vector.frustration,
      embarrassment01: emotion.emotionSnapshot.vector.socialEmbarrassment,
      relief01: emotion.emotionSnapshot.vector.relief,
      trust01: emotion.emotionSnapshot.vector.trust,
      comebackReadiness01: emotion.emotionSnapshot.derived.comebackReadiness,
      celebrationTolerance01: emotion.emotionSnapshot.derived.celebrationTolerance,
      helperUrgency01: emotion.emotionSnapshot.derived.helperUrgency,
      silenceSuitability01: emotion.emotionSnapshot.derived.silenceSuitability,
      channel: inferChannel(snapshot),
      operatingState: emotion.emotionSnapshot.derived.operatingState,
    };
  }

  private resolvePhase(
    current: ChatConfidenceSwingCheckpoint,
    previous: ChatConfidenceSwingCheckpoint | undefined,
    delta: number,
  ): ChatConfidenceSwingPhase {
    if (!previous) return 'UNSET';

    if (delta <= this.defaults.hardBreakDelta) {
      return 'HARD_BREAK';
    }
    if (delta <= this.defaults.softBreakDelta) {
      return 'SOFT_BREAK';
    }
    if (
      delta >= this.defaults.surgeDelta &&
      current.embarrassment01 <= this.defaults.embarrassmentCeilingForComeback &&
      current.comebackReadiness01 >= 0.56
    ) {
      return 'COMEBACK_READY';
    }
    if (
      delta >= this.defaults.recoveryDelta &&
      current.confidence01 > previous.confidence01
    ) {
      return 'RECOVERING';
    }
    if (
      delta >= this.defaults.surgeDelta &&
      current.celebrationTolerance01 >= this.defaults.celebrationReadinessFloor
    ) {
      return 'CEREMONIAL';
    }
    if (Math.abs(delta) <= this.defaults.stableBandDelta) {
      return 'STABLE';
    }
    if (delta > this.defaults.stableBandDelta) {
      return 'SURGING';
    }
    return 'STABLE';
  }

  private buildPlan(
    current: ChatConfidenceSwingCheckpoint,
    phase: ChatConfidenceSwingPhase,
    direction: ChatConfidenceSwingDirection,
  ): ChatConfidenceSwingPlan {
    const shouldHoldSilence =
      current.silenceSuitability01 >= this.defaults.holdSilenceThreshold &&
      (phase === 'HARD_BREAK' || phase === 'SOFT_BREAK');

    const shouldSummonHelper =
      current.helperUrgency01 >= this.defaults.helperWindowThreshold &&
      (phase === 'HARD_BREAK' || phase === 'SOFT_BREAK' || phase === 'RECOVERING');

    const shouldInviteWitness =
      phase === 'COMEBACK_READY' ||
      (phase === 'RECOVERING' && current.embarrassment01 <= 0.4 && current.trust01 >= 0.42);

    const shouldDelayCelebration =
      phase !== 'CEREMONIAL' || current.celebrationTolerance01 < this.defaults.celebrationReadinessFloor;

    const shouldOpenComebackWindow =
      phase === 'COMEBACK_READY' ||
      (phase === 'SURGING' && current.embarrassment01 <= 0.34 && current.relief01 >= 0.44);

    const preferredChannel: ChatVisibleChannel =
      phase === 'HARD_BREAK' && current.channel === 'GLOBAL'
        ? 'SYNDICATE'
        : phase === 'RECOVERING' && current.channel === 'GLOBAL'
        ? 'SYNDICATE'
        : current.channel;

    return {
      shouldHoldSilence,
      shouldSummonHelper,
      shouldInviteWitness,
      shouldDelayCelebration,
      shouldOpenComebackWindow,
      preferredChannel,
      reason: safeParts([
        `phase=${phase}`,
        `direction=${direction}`,
        shouldHoldSilence ? 'hold-silence' : undefined,
        shouldSummonHelper ? 'summon-helper' : undefined,
        shouldInviteWitness ? 'invite-witness' : undefined,
        shouldDelayCelebration ? 'delay-celebration' : undefined,
        shouldOpenComebackWindow ? 'open-comeback-window' : undefined,
        preferredChannel !== current.channel ? `shift=${preferredChannel}` : undefined,
      ]),
    };
  }

  private subjectKey(
    snapshot: ChatLearningBridgePublicSnapshot,
    emotion: ChatEmotionScoreResult,
  ): string {
    const roomId = (emotion.emotionSummary.roomId as unknown as string) || 'global-room';
    const playerId = (emotion.emotionSnapshot.context.playerUserId as unknown as string) || 'anonymous';
    const channel = inferChannel(snapshot);
    return `${roomId}::${playerId}::${channel}`;
  }
}

/* ========================================================================== *
 * MARK: Public helpers
 * ========================================================================== */

export function createChatConfidenceSwingTracker(
  options: ChatConfidenceSwingTrackerOptions = {},
): ChatConfidenceSwingTracker {
  return new ChatConfidenceSwingTracker(options);
}

export function trackChatConfidenceSwing(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatConfidenceSwingTrackerOptions = {},
): ChatConfidenceSwingDecision {
  return createChatConfidenceSwingTracker(options).track(snapshot);
}

export function recommendConfidenceSwingAction(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatConfidenceSwingTrackerOptions = {},
): ChatLearningBridgeRecommendation {
  return createChatConfidenceSwingTracker(options).recommend(snapshot);
}

export function refineConfidenceSwingProfileState(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatConfidenceSwingTrackerOptions = {},
): Partial<ChatLearningBridgeProfileState> {
  return createChatConfidenceSwingTracker(options).refineProfile(snapshot);
}

export const CHAT_CONFIDENCE_SWING_TRACKER_NAMESPACE = Object.freeze({
  moduleName: CHAT_CONFIDENCE_SWING_TRACKER_MODULE_NAME,
  version: CHAT_CONFIDENCE_SWING_TRACKER_VERSION,
  runtimeLaws: CHAT_CONFIDENCE_SWING_TRACKER_RUNTIME_LAWS,
  defaults: CHAT_CONFIDENCE_SWING_TRACKER_DEFAULTS,
  create: createChatConfidenceSwingTracker,
  track: trackChatConfidenceSwing,
  recommend: recommendConfidenceSwingAction,
  refineProfile: refineConfidenceSwingProfileState,
} as const);
