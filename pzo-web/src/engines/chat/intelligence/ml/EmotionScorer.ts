/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ML EMOTION SCORER
 * FILE: pzo-web/src/engines/chat/intelligence/ml/EmotionScorer.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical frontend emotional operating-model scorer for the chat runtime.
 *
 * This module promotes emotion from a side-channel heuristic into a first-class,
 * low-latency authored runtime that can sit beside the existing feature,
 * engagement, helper, hater, channel, and drop-off policies already present in
 * the repo.
 *
 * Design law
 * ----------
 * - Frontend emotion is immediate, advisory, and explainable.
 * - Backend emotion will remain durable and authoritative.
 * - Emotional state must preserve room/channel/mode/mount continuity.
 * - The scorer must use existing repo scoring lanes instead of replacing them.
 * - Emotional output must be consumable by helpers, haters, crowd logic,
 *   silence logic, comeback logic, celebration restraint, rescue windows,
 *   memory systems, and future retrieval/ranking surfaces.
 *
 * What this file does in practice
 * -------------------------------
 * 1. Reads the current frontend learning bridge snapshot.
 * 2. Reuses existing compatibility scorers already present now:
 *    - EngagementScorer
 *    - HelperInterventionPolicy
 *    - HaterPersonaPolicy
 *    - ChannelRecommendationPolicy
 *    - DropOffRiskScorer
 * 3. Converts those signals plus feature/crowd/presence heuristics into the
 *    shared emotional contract.
 * 4. Produces:
 *    - shared ChatEmotionSnapshot / envelope / summary
 *    - learning EmotionSignals package
 *    - actionable recommendation metadata for the bridge / UI / directors
 *    - partial profile refinements that are safe to merge locally
 *
 * Notes
 * -----
 * This file deliberately avoids flattening your repo into a generic “sentiment”
 * layer. The vector is authored around PZO-specific pressures:
 * shield danger, public-stage pressure, helper timing, hater theater,
 * negotiation exposure, rescue urgency, comeback windows, and silence law.
 * ============================================================================
 */

import type {
  ChatLearningBridgeProfileState,
  ChatLearningBridgePublicSnapshot,
  ChatLearningBridgeRecommendation,
} from '../ChatLearningBridge';
import {
  CHAT_LEARNING_BRIDGE_CHANNEL_KEYS,
  CHAT_LEARNING_BRIDGE_DEFAULTS,
  CHAT_LEARNING_BRIDGE_MODULE_NAME,
  CHAT_LEARNING_BRIDGE_VERSION,
} from '../ChatLearningBridge';

import type { ChatLearningProfile } from '../ChatLearningProfile';

import type {
  ChatFeatureSnapshot,
  ChatModeScope,
  ChatMountTarget,
  ChatRoomId,
  ChatUserId,
  ChatVisibleChannel,
  JsonObject,
  Score01,
  UnixMs,
} from '../../types';

import {
  deriveChatFeaturePressureTier,
  deriveChatFeatureTickTier,
  summarizeChatFeatureSnapshot,
  type ChatPressureTier,
  type ChatTickTier,
} from '../../ml/FeatureExtractor';

import {
  scoreChatEngagement,
  type ChatEngagementScoreResult,
} from '../../ml/EngagementScorer';

import {
  resolveChatHelperIntervention,
  type ChatHelperInterventionDecision,
} from '../../ml/HelperInterventionPolicy';

import {
  resolveChatHaterPersona,
  type ChatHaterPersonaDecision,
} from '../../ml/HaterPersonaPolicy';

import {
  evaluateChatChannelRecommendation,
} from '../../ml/ChannelRecommendationPolicy';

import {
  evaluateChatDropOffRisk,
} from '../../ml/DropOffRiskScorer';

import type {
  ChatAuthority,
  ChatEmotionDecisionDirective,
  ChatEmotionDelta,
  ChatEmotionDriverEvidence,
  ChatEmotionEnvelope,
  ChatEmotionHelperDirective,
  ChatEmotionHaterDirective,
  ChatEmotionSnapshot,
  ChatEmotionSummary,
  ChatEmotionVector,
} from '../../../../../../shared/contracts/chat/ChatEmotion';

import {
  CHAT_EMOTION_CONTRACT_MANIFEST,
  buildEmotionDebugNotes,
  clampEmotionScalar,
  computeEmotionConfidenceBand,
  computeEmotionDerivedState,
  createEmotionEnvelope,
  createEmotionSnapshot,
  describeEmotionVector,
  emotionScore01To100,
  getDominantEmotionAxis,
  getSecondaryEmotionAxis,
  projectEmotionToAudienceMood,
  projectEmotionToAudienceSeverity,
  summarizeEmotionSnapshot,
} from '../../../../../../shared/contracts/chat/ChatEmotion';

import type {
  EmotionFeatureBag,
  EmotionRankingHint,
  EmotionSignalPreview,
  EmotionSignalReceipt,
  EmotionTrainingLabel,
} from '../../../../../../shared/contracts/chat/learning/EmotionSignals';

import {
  EMOTION_SIGNAL_CONTRACT_MANIFEST,
  buildAllEmotionSignals,
} from '../../../../../../shared/contracts/chat/learning/EmotionSignals';

/* ========================================================================== *
 * MARK: Module constants
 * ========================================================================== */

export const CHAT_EMOTION_SCORER_MODULE_NAME =
  'PZO_CHAT_EMOTION_SCORER' as const;

export const CHAT_EMOTION_SCORER_VERSION =
  '2026.03.20-frontend-emotion-scorer.v1' as const;

export const CHAT_EMOTION_SCORER_RUNTIME_LAWS = Object.freeze([
  'Emotion is gameplay pressure, not sentiment garnish.',
  'The scorer must remain merge-safe and explainable on the frontend.',
  'Emotion may influence helper timing, hater escalation, crowd heat, silence windows, comeback speeches, and celebration restraint.',
  'The scorer must reuse existing repo scoring lanes instead of replacing them.',
  'Confidence should repair slower than embarrassment spikes.',
  'Silence may be the correct recommendation when pressure is authored to linger.',
  'Public-stage pressure matters more in GLOBAL than in intimate channels.',
  'Deal-room quiet can be predatory and must not be mistaken for calm.',
  'A helper should arrive with intention, not noise.',
  'A hater should escalate with authored timing, not random spam.',
] as const);

export const CHAT_EMOTION_SCORER_DEFAULTS = Object.freeze({
  intimidationPressureWeight: 0.24,
  intimidationHaterWeight: 0.21,
  intimidationExposureWeight: 0.19,
  intimidationDropOffWeight: 0.12,
  intimidationSilenceWeight: 0.08,
  confidenceEngagementWeight: 0.22,
  confidenceLegendWeight: 0.18,
  confidenceTrustWeight: 0.14,
  frustrationFailureWeight: 0.22,
  frustrationQuietnessWeight: 0.16,
  frustrationEmbarrassmentWeight: 0.12,
  curiosityDraftCommitmentWeight: 0.16,
  curiosityReplayWeight: 0.14,
  curiosityInboundPressureWeight: 0.12,
  attachmentHelperPresenceWeight: 0.22,
  attachmentTrustWeight: 0.19,
  attachmentIntimacyWeight: 0.16,
  embarrassmentPublicStageWeight: 0.21,
  embarrassmentCrowdWeight: 0.19,
  embarrassmentShameWeight: 0.18,
  embarrassmentFailureWeight: 0.12,
  reliefRecoveryWeight: 0.24,
  reliefHelperWeight: 0.18,
  reliefTrustWeight: 0.14,
  dominanceConfidenceWeight: 0.22,
  dominanceExposureWeight: 0.14,
  dominanceEmbarrassmentInverseWeight: 0.13,
  desperationDropOffWeight: 0.24,
  desperationRescueWeight: 0.2,
  desperationPressureWeight: 0.16,
  trustHelperWeight: 0.22,
  trustIntimacyWeight: 0.18,
  trustReliefWeight: 0.12,
  windowHistoryLimit: 12,
  publicStageGlobalBias: 0.08,
  dealRoomPredationBias: 0.07,
  confidenceRecoveryDampening: 0.62,
  confidenceCollapseAmplifier: 1.16,
  helperUrgencyBridgeThreshold: 0.56,
  haterWindowBridgeThreshold: 0.58,
  silenceBridgeThreshold: 0.6,
  comebackWindowThreshold: 0.57,
  celebrationHoldThreshold: 0.48,
} as const);

/* ========================================================================== *
 * MARK: Public contracts
 * ========================================================================== */

export interface ChatEmotionScorerOptions {
  readonly defaults?: Partial<typeof CHAT_EMOTION_SCORER_DEFAULTS>;
  readonly now?: () => number;
  readonly keepPerSubjectHistory?: boolean;
  readonly includeDebugNotes?: boolean;
  readonly preferSharedAudienceProjection?: boolean;
  readonly allowEmotionDrivenProfilePatch?: boolean;
}

export interface ChatEmotionScalarBreakdown {
  readonly intimidation01: Score01;
  readonly confidence01: Score01;
  readonly frustration01: Score01;
  readonly curiosity01: Score01;
  readonly attachment01: Score01;
  readonly socialEmbarrassment01: Score01;
  readonly relief01: Score01;
  readonly dominance01: Score01;
  readonly desperation01: Score01;
  readonly trust01: Score01;
}

export interface ChatEmotionScorerEvidence {
  readonly pressureTier: ChatPressureTier | 'UNKNOWN';
  readonly tickTier: ChatTickTier | 'UNKNOWN';
  readonly activeChannel: ChatVisibleChannel;
  readonly preferredChannel: ChatVisibleChannel;
  readonly featureSummary: string;
  readonly engagementExplanation?: string;
  readonly helperExplanation?: string;
  readonly haterExplanation?: string;
  readonly channelExplanation?: string;
  readonly dropOffExplanation?: string;
  readonly dominantAxis: string;
  readonly secondaryAxis?: string;
}

export interface ChatEmotionScorerBreakdown {
  readonly moduleName: typeof CHAT_EMOTION_SCORER_MODULE_NAME;
  readonly moduleVersion: typeof CHAT_EMOTION_SCORER_VERSION;
  readonly bridgeModuleName: typeof CHAT_LEARNING_BRIDGE_MODULE_NAME;
  readonly bridgeModuleVersion: typeof CHAT_LEARNING_BRIDGE_VERSION;
  readonly vector: ChatEmotionScalarBreakdown;
  readonly evidence: ChatEmotionScorerEvidence;
  readonly directives: readonly ChatEmotionDecisionDirective[];
  readonly helperDirective: ChatEmotionHelperDirective;
  readonly haterDirective: ChatEmotionHaterDirective;
  readonly narrative: string;
}

export interface ChatEmotionRecommendationSurface {
  readonly preferredChannel: ChatVisibleChannel;
  readonly shouldPreferSilence: boolean;
  readonly shouldSummonHelper: boolean;
  readonly shouldEscalateHater: boolean;
  readonly shouldContainCrowd: boolean;
  readonly shouldAllowComebackSpeech: boolean;
  readonly shouldWithholdCelebration: boolean;
  readonly reason: string;
}

export interface ChatEmotionScoreResult {
  readonly emotionSnapshot: ChatEmotionSnapshot;
  readonly emotionEnvelope: ChatEmotionEnvelope;
  readonly emotionSummary: ChatEmotionSummary;
  readonly featureBag: EmotionFeatureBag;
  readonly rankingHint: EmotionRankingHint;
  readonly preview: EmotionSignalPreview;
  readonly receipt: EmotionSignalReceipt;
  readonly labels: readonly EmotionTrainingLabel[];
  readonly recommendation: ChatEmotionRecommendationSurface;
  readonly bridgeRecommendation: ChatLearningBridgeRecommendation;
  readonly profilePatch: Partial<ChatLearningBridgeProfileState>;
  readonly breakdown: ChatEmotionScorerBreakdown;
  readonly notes: readonly string[];
}

/* ========================================================================== *
 * MARK: Utility helpers
 * ========================================================================== */

type LooseRecord = Record<string, unknown>;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function asScore01(value: number): Score01 {
  return clampEmotionScalar(value);
}

function asUnixMs(value: number, fallback: number): UnixMs {
  if (!Number.isFinite(value)) return Math.floor(fallback) as UnixMs;
  return Math.max(0, Math.floor(value)) as UnixMs;
}

function isRecord(value: unknown): value is LooseRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function getPath(root: unknown, path: readonly string[]): unknown {
  let current = root;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function readNumber(root: unknown, ...paths: readonly string[][]): number | undefined {
  for (const path of paths) {
    const value = getPath(root, path);
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

function readString(root: unknown, ...paths: readonly string[][]): string | undefined {
  for (const path of paths) {
    const value = getPath(root, path);
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

function readBoolean(root: unknown, ...paths: readonly string[][]): boolean | undefined {
  for (const path of paths) {
    const value = getPath(root, path);
    if (typeof value === 'boolean') return value;
  }
  return undefined;
}

function weightedMean(pairs: ReadonlyArray<readonly [number | undefined, number]>): number {
  let weight = 0;
  let total = 0;
  for (const [value, w] of pairs) {
    if (!Number.isFinite(value as number)) continue;
    total += clamp01(value as number) * w;
    weight += w;
  }
  if (weight <= 0) return 0;
  return clamp01(total / weight);
}

function invert01(value: number | undefined): number {
  return 1 - clamp01(value ?? 0);
}

function normalizeChannel(
  value: unknown,
  fallback: ChatVisibleChannel,
): ChatVisibleChannel {
  if (typeof value !== 'string') return fallback;
  const upper = value.toUpperCase();
  const matched = CHAT_LEARNING_BRIDGE_CHANNEL_KEYS.find((item) => item === upper);
  return (matched ?? fallback) as ChatVisibleChannel;
}

function safeNarrative(parts: ReadonlyArray<string | undefined | null | false>): string {
  return parts.filter(Boolean).join(' | ');
}

function asAuthority(value: unknown): ChatAuthority {
  return (typeof value === 'string' && value.trim()
    ? value
    : 'PZO_FRONTEND_ENGINE') as ChatAuthority;
}

function inferRoomId(snapshot: unknown): ChatRoomId {
  return (
    readString(snapshot, ['roomId'], ['context', 'roomId'], ['meta', 'roomId']) ??
    'global-room'
  ) as ChatRoomId;
}

function inferChannel(snapshot: unknown): ChatVisibleChannel {
  return normalizeChannel(
    readString(
      snapshot,
      ['activeChannel'],
      ['channelId'],
      ['channel', 'active'],
      ['featureSnapshot', 'channels', 'activeChannel'],
    ),
    'GLOBAL' as ChatVisibleChannel,
  );
}

function inferPreferredChannel(snapshot: unknown): ChatVisibleChannel {
  return normalizeChannel(
    readString(
      snapshot,
      ['preferredChannel'],
      ['channel', 'preferred'],
      ['featureSnapshot', 'channels', 'preferredChannel'],
    ),
    inferChannel(snapshot),
  );
}

function inferMountTarget(snapshot: unknown): ChatMountTarget | undefined {
  return readString(snapshot, ['mountTarget'], ['context', 'mountTarget']) as ChatMountTarget | undefined;
}

function inferModeScope(snapshot: unknown): ChatModeScope | undefined {
  return readString(snapshot, ['modeScope'], ['context', 'modeScope']) as ChatModeScope | undefined;
}

function inferUserId(snapshot: unknown): ChatUserId | undefined {
  return readString(snapshot, ['userId'], ['playerUserId'], ['context', 'playerUserId']) as ChatUserId | undefined;
}

function extractFeatureSnapshot(
  snapshot: ChatLearningBridgePublicSnapshot,
): ChatFeatureSnapshot | undefined {
  const direct = (snapshot as LooseRecord).featureSnapshot;
  if (direct) return direct as ChatFeatureSnapshot;
  const alternate = getPath(snapshot, ['features']);
  if (alternate) return alternate as ChatFeatureSnapshot;
  return undefined;
}

function extractProfile(snapshot: ChatLearningBridgePublicSnapshot): ChatLearningProfile | LooseRecord | undefined {
  const profile = (snapshot as LooseRecord).profile;
  if (profile && isRecord(profile)) return profile as ChatLearningProfile;
  const state = (snapshot as LooseRecord).profileState;
  if (state && isRecord(state)) return state;
  return undefined;
}

function featureScalar(featureSnapshot: ChatFeatureSnapshot | undefined, key: string): number | undefined {
  return readNumber(featureSnapshot, ['scalar', key]);
}

function featureSocial(featureSnapshot: ChatFeatureSnapshot | undefined, key: string): number | undefined {
  return readNumber(featureSnapshot, ['social', key]);
}

function featureMessage(featureSnapshot: ChatFeatureSnapshot | undefined, key: string): number | undefined {
  return readNumber(featureSnapshot, ['messages', key], ['message', key]);
}

function featureDropOff(featureSnapshot: ChatFeatureSnapshot | undefined, key: string): number | undefined {
  return readNumber(featureSnapshot, ['dropOff', key], ['dropoff', key]);
}

function featureChannel(featureSnapshot: ChatFeatureSnapshot | undefined, key: string): number | undefined {
  return readNumber(featureSnapshot, ['channels', key]);
}

function profileNumber(profile: unknown, ...paths: readonly string[][]): number | undefined {
  return readNumber(profile, ...paths);
}

function profilePersonaMean(profile: unknown, key: string): number | undefined {
  const value = getPath(profile, [key]);
  if (!isRecord(value)) return undefined;
  const entries = Object.values(value).filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
  if (!entries.length) return undefined;
  return clamp01(entries.reduce((sum, item) => sum + item, 0) / entries.length);
}

function buildDriver(
  driver: ChatEmotionDriverEvidence['driver'],
  label: string,
  reason: string,
  value: number,
  snapshot: ChatLearningBridgePublicSnapshot,
  authority: ChatAuthority,
): ChatEmotionDriverEvidence {
  const roomId = inferRoomId(snapshot);
  const channelId = inferChannel(snapshot) as unknown as string;
  const nowIso = new Date().toISOString();
  return {
    driverId: `${driver.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` as ChatEmotionDriverEvidence['driverId'],
    driver,
    sourceKind:
      driver === 'HELPER_PRESENCE'
        ? 'HELPER_MESSAGE'
        : driver === 'RIVALRY_TAUNT' || driver === 'HATER_STALK'
        ? 'HATER_MESSAGE'
        : driver === 'CROWD_SWARM'
        ? 'CROWD_REACTION'
        : driver === 'NEGOTIATION_STALL'
        ? 'DEAL_ROOM'
        : driver === 'SILENCE_WINDOW'
        ? 'SCENE'
        : 'PLAYER_ACTION',
    sourceAuthority: authority,
    sourceWeight: clamp01(value),
    salience: asScore01(value),
    confidence: asScore01(Math.max(0.35, value)),
    confidenceBand: computeEmotionConfidenceBand(value),
    label,
    reason,
    channelId: channelId as any,
    roomId,
    mountTarget: inferMountTarget(snapshot),
    modeScope: inferModeScope(snapshot),
    actorUserId: inferUserId(snapshot),
    happenedAt: nowIso,
    metadata: undefined,
  };
}

/* ========================================================================== *
 * MARK: Result surface helpers
 * ========================================================================== */

function buildProfilePatch(
  emotionSnapshot: ChatEmotionSnapshot,
  summary: ChatEmotionSummary,
  recommendation: ChatEmotionRecommendationSurface,
  includeEmotionPatch: boolean,
): Partial<ChatLearningBridgeProfileState> {
  if (!includeEmotionPatch) return {};
  const patch: LooseRecord = {
    lastEmotionEnvelope: createEmotionEnvelope(emotionSnapshot),
    lastEmotionSummary: summary,
    dominantEmotionAxis: emotionSnapshot.derived.dominantAxis,
    secondaryEmotionAxis: emotionSnapshot.derived.secondaryAxis,
    helperUrgency01: emotionSnapshot.derived.helperUrgency,
    haterOpportunity01: emotionSnapshot.derived.haterOpportunity,
    silenceSuitability01: emotionSnapshot.derived.silenceSuitability,
    crowdPileOnRisk01: emotionSnapshot.derived.crowdPileOnRisk,
    preferredEmotionChannel: recommendation.preferredChannel,
    emotionOperatingState: emotionSnapshot.derived.operatingState,
    emotionConfidenceBand: emotionSnapshot.derived.confidenceBand,
  };
  return patch as Partial<ChatLearningBridgeProfileState>;
}

function buildBridgeRecommendation(
  recommendation: ChatEmotionRecommendationSurface,
  summary: ChatEmotionSummary,
  featureBag: EmotionFeatureBag,
): ChatLearningBridgeRecommendation {
  const payload: LooseRecord = {
    kind: 'EMOTION_RUNTIME',
    recommendedChannel: recommendation.preferredChannel,
    explanation: recommendation.reason,
    confidence01: Math.max(
      summary.helperUrgency,
      summary.haterOpportunity,
      summary.silenceSuitability,
    ),
    dominantEmotionAxis: summary.dominantAxis,
    secondaryEmotionAxis: summary.secondaryAxis,
    operatingState: summary.operatingState,
    featureVectorId: featureBag.featureVectorId,
    shouldPreferSilence: recommendation.shouldPreferSilence,
    shouldSummonHelper: recommendation.shouldSummonHelper,
    shouldEscalateHater: recommendation.shouldEscalateHater,
    shouldContainCrowd: recommendation.shouldContainCrowd,
    shouldAllowComebackSpeech: recommendation.shouldAllowComebackSpeech,
    shouldWithholdCelebration: recommendation.shouldWithholdCelebration,
  };
  return payload as ChatLearningBridgeRecommendation;
}

/* ========================================================================== *
 * MARK: Scorer class
 * ========================================================================== */

export class ChatEmotionScorer {
  private readonly defaults: typeof CHAT_EMOTION_SCORER_DEFAULTS;
  private readonly now: () => number;
  private readonly keepPerSubjectHistory: boolean;
  private readonly includeDebugNotes: boolean;
  private readonly preferSharedAudienceProjection: boolean;
  private readonly allowEmotionDrivenProfilePatch: boolean;
  private readonly historyBySubject = new Map<string, ChatEmotionSnapshot[]>();

  public constructor(options: ChatEmotionScorerOptions = {}) {
    this.defaults = Object.freeze({
      ...CHAT_EMOTION_SCORER_DEFAULTS,
      ...(options.defaults ?? {}),
    });
    this.now = options.now ?? (() => Date.now());
    this.keepPerSubjectHistory = options.keepPerSubjectHistory ?? true;
    this.includeDebugNotes = options.includeDebugNotes ?? true;
    this.preferSharedAudienceProjection =
      options.preferSharedAudienceProjection ?? true;
    this.allowEmotionDrivenProfilePatch =
      options.allowEmotionDrivenProfilePatch ?? true;
  }

  public score(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): ChatEmotionScoreResult {
    const authority = asAuthority(
      readString(snapshot, ['authority'], ['context', 'authority']) ??
        'PZO_FRONTEND_ENGINE',
    );
    const featureSnapshot = extractFeatureSnapshot(snapshot);
    const profile = extractProfile(snapshot);
    const activeChannel = inferChannel(snapshot);
    const preferredChannelHint = inferPreferredChannel(snapshot);
    const roomId = inferRoomId(snapshot);
    const mountTarget = inferMountTarget(snapshot);
    const modeScope = inferModeScope(snapshot);
    const playerUserId = inferUserId(snapshot);

    const engagement = this.safeEngagement(snapshot);
    const helperDecision = this.safeHelper(snapshot);
    const haterDecision = this.safeHater(snapshot);
    const channelDecision = this.safeChannelDecision(snapshot);
    const dropOffDecision = this.safeDropOff(snapshot);

    const previous = this.readPreviousSnapshot(roomId, playerUserId, activeChannel);
    const vector = this.composeVector({
      snapshot,
      featureSnapshot,
      profile,
      engagement,
      helperDecision,
      haterDecision,
      channelDecision,
      dropOffDecision,
      activeChannel,
      preferredChannelHint,
      previous,
    });

    const drivers = this.composeDrivers({
      snapshot,
      authority,
      vector,
      engagement,
      helperDecision,
      haterDecision,
      channelDecision,
      dropOffDecision,
      featureSnapshot,
    });

    const emotionSnapshot = createEmotionSnapshot({
      authority,
      context: {
        roomId,
        channelId: activeChannel as any,
        modeScope,
        mountTarget,
        playerUserId,
        sourceAuthority: authority,
        audienceMood: this.preferSharedAudienceProjection
          ? projectEmotionToAudienceMood(vector)
          : undefined,
        audienceSeverity: this.preferSharedAudienceProjection
          ? projectEmotionToAudienceSeverity(vector)
          : undefined,
      },
      vector,
      previousVector: previous?.vector,
      drivers,
      notes: this.includeDebugNotes
        ? this.composeNotes({
            featureSnapshot,
            engagement,
            helperDecision,
            haterDecision,
            channelDecision,
            dropOffDecision,
            vector,
          })
        : undefined,
      observedAtUnixMs: asUnixMs(this.now(), Date.now()),
      updatedAt: new Date(this.now()).toISOString(),
      createdAt: previous?.createdAt ?? new Date(this.now()).toISOString(),
      traceId: previous?.traceId,
    });

    if (this.keepPerSubjectHistory) {
      this.writeHistory(roomId, playerUserId, activeChannel, emotionSnapshot);
    }

    const emotionEnvelope = createEmotionEnvelope(emotionSnapshot);
    const emotionSummary = summarizeEmotionSnapshot(emotionSnapshot);
    const signalPackage = buildAllEmotionSignals(emotionSnapshot);

    const recommendation = this.composeRecommendation({
      emotionSnapshot,
      activeChannel,
      preferredChannelHint,
      channelDecision,
      helperDecision,
      haterDecision,
    });

    const profilePatch = buildProfilePatch(
      emotionSnapshot,
      emotionSummary,
      recommendation,
      this.allowEmotionDrivenProfilePatch,
    );

    const bridgeRecommendation = buildBridgeRecommendation(
      recommendation,
      emotionSummary,
      signalPackage.featureBag,
    );

    const breakdown: ChatEmotionScorerBreakdown = {
      moduleName: CHAT_EMOTION_SCORER_MODULE_NAME,
      moduleVersion: CHAT_EMOTION_SCORER_VERSION,
      bridgeModuleName: CHAT_LEARNING_BRIDGE_MODULE_NAME,
      bridgeModuleVersion: CHAT_LEARNING_BRIDGE_VERSION,
      vector: {
        intimidation01: emotionSnapshot.vector.intimidation,
        confidence01: emotionSnapshot.vector.confidence,
        frustration01: emotionSnapshot.vector.frustration,
        curiosity01: emotionSnapshot.vector.curiosity,
        attachment01: emotionSnapshot.vector.attachment,
        socialEmbarrassment01: emotionSnapshot.vector.socialEmbarrassment,
        relief01: emotionSnapshot.vector.relief,
        dominance01: emotionSnapshot.vector.dominance,
        desperation01: emotionSnapshot.vector.desperation,
        trust01: emotionSnapshot.vector.trust,
      },
      evidence: {
        pressureTier: featureSnapshot ? deriveChatFeaturePressureTier(featureSnapshot) : 'UNKNOWN',
        tickTier: featureSnapshot ? deriveChatFeatureTickTier(featureSnapshot) : 'UNKNOWN',
        activeChannel,
        preferredChannel: recommendation.preferredChannel,
        featureSummary: featureSnapshot
          ? summarizeChatFeatureSnapshot(featureSnapshot)
          : 'No feature snapshot attached; used bridge-compatible heuristics.',
        engagementExplanation: readString(engagement, ['explanation']),
        helperExplanation: readString(helperDecision, ['plan', 'explanation']),
        haterExplanation: readString(haterDecision, ['score', 'explanation']),
        channelExplanation: readString(channelDecision, ['explanation']),
        dropOffExplanation: readString(dropOffDecision, ['explanation']),
        dominantAxis: emotionSnapshot.derived.dominantAxis,
        secondaryAxis: emotionSnapshot.derived.secondaryAxis,
      },
      directives: emotionSnapshot.directives,
      helperDirective: emotionSnapshot.helperDirective,
      haterDirective: emotionSnapshot.haterDirective,
      narrative: safeNarrative([
        `vector=${describeEmotionVector(emotionSnapshot.vector)}`,
        `dominant=${emotionSnapshot.derived.dominantAxis}`,
        emotionSnapshot.derived.secondaryAxis
          ? `secondary=${emotionSnapshot.derived.secondaryAxis}`
          : undefined,
        `state=${emotionSnapshot.derived.operatingState}`,
        `helper=${emotionScore01To100(emotionSnapshot.derived.helperUrgency)}`,
        `hater=${emotionScore01To100(emotionSnapshot.derived.haterOpportunity)}`,
        `crowd=${emotionScore01To100(emotionSnapshot.derived.crowdPileOnRisk)}`,
        `silence=${emotionScore01To100(emotionSnapshot.derived.silenceSuitability)}`,
      ]),
    };

    return {
      emotionSnapshot,
      emotionEnvelope,
      emotionSummary,
      featureBag: signalPackage.featureBag,
      rankingHint: signalPackage.rankingHint,
      preview: signalPackage.preview,
      receipt: signalPackage.receipt,
      labels: signalPackage.labels,
      recommendation,
      bridgeRecommendation,
      profilePatch,
      breakdown,
      notes: Object.freeze(buildEmotionDebugNotes(emotionSnapshot)),
    };
  }

  public recommend(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): ChatLearningBridgeRecommendation {
    return this.score(snapshot).bridgeRecommendation;
  }

  public refineProfile(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): Partial<ChatLearningBridgeProfileState> {
    return this.score(snapshot).profilePatch;
  }

  public summarize(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): ChatEmotionSummary {
    return this.score(snapshot).emotionSummary;
  }

  public clearHistory(): void {
    this.historyBySubject.clear();
  }

  private composeVector(input: {
    readonly snapshot: ChatLearningBridgePublicSnapshot;
    readonly featureSnapshot?: ChatFeatureSnapshot;
    readonly profile?: ChatLearningProfile | LooseRecord;
    readonly engagement?: ChatEngagementScoreResult;
    readonly helperDecision?: ChatHelperInterventionDecision;
    readonly haterDecision?: ChatHaterPersonaDecision;
    readonly channelDecision?: LooseRecord;
    readonly dropOffDecision?: LooseRecord;
    readonly activeChannel: ChatVisibleChannel;
    readonly preferredChannelHint: ChatVisibleChannel;
    readonly previous?: ChatEmotionSnapshot;
  }): ChatEmotionVector {
    const {
      featureSnapshot,
      profile,
      engagement,
      helperDecision,
      haterDecision,
      channelDecision,
      dropOffDecision,
      activeChannel,
      previous,
    } = input;

    const socialExposure01 =
      featureScalar(featureSnapshot, 'socialExposure01') ??
      featureChannel(featureSnapshot, 'channelViewShare01') ??
      readNumber(input.snapshot, ['socialExposure01']) ??
      (activeChannel === ('GLOBAL' as ChatVisibleChannel) ? 0.78 : 0.34);

    const audienceHeat01 =
      featureSocial(featureSnapshot, 'audienceHeat01') ??
      readNumber(input.snapshot, ['audienceHeat01'], ['crowd', 'heat01']) ??
      (activeChannel === ('GLOBAL' as ChatVisibleChannel) ? 0.72 : 0.28);

    const embarrassmentRisk01 =
      featureSocial(featureSnapshot, 'embarrassmentRisk01') ??
      readNumber(input.snapshot, ['embarrassmentRisk01']) ??
      0;

    const publicStagePressure01 =
      clamp01(
        (featureSocial(featureSnapshot, 'publicStagePressure01') ?? 0) +
          (activeChannel === ('GLOBAL' as ChatVisibleChannel)
            ? this.defaults.publicStageGlobalBias
            : 0),
      );

    const intimacy01 =
      featureSocial(featureSnapshot, 'intimacy01') ??
      (activeChannel === ('SYNDICATE' as ChatVisibleChannel) ? 0.7 : 0.18);

    const negotiationExposure01 =
      clamp01(
        (featureSocial(featureSnapshot, 'negotiationExposure01') ?? 0) +
          (activeChannel === ('DEAL_ROOM' as ChatVisibleChannel)
            ? this.defaults.dealRoomPredationBias
            : 0),
      );

    const helperPresence01 =
      featureScalar(featureSnapshot, 'helperPresence01') ??
      readNumber(helperDecision, ['plan', 'timing', 'urgency01']) ??
      0;

    const haterPresence01 =
      featureScalar(featureSnapshot, 'haterPresence01') ??
      readNumber(haterDecision, ['score', 'score01']) ??
      0;

    const pressure01 =
      featureScalar(featureSnapshot, 'mountPressure01') ??
      featureScalar(featureSnapshot, 'failurePressure01') ??
      readNumber(input.snapshot, ['pressure01']) ??
      0;

    const rescueNeed01 =
      featureScalar(featureSnapshot, 'rescueNeed01') ??
      readNumber(dropOffDecision, ['risk01']) ??
      readNumber(dropOffDecision, ['decision', 'risk01']) ??
      0;

    const quietness01 =
      featureScalar(featureSnapshot, 'quietness01') ??
      featureDropOff(featureSnapshot, 'quietness01') ??
      0;

    const engagement01 =
      readNumber(engagement, ['vector', 'engagement01']) ??
      featureScalar(featureSnapshot, 'engagement01') ??
      0;

    const confidenceSeed01 =
      readNumber(engagement, ['vector', 'confidence01']) ??
      featureScalar(featureSnapshot, 'confidence01') ??
      0;

    const shameSensitivity01 =
      readNumber(engagement, ['vector', 'shameSensitivity01']) ??
      featureScalar(featureSnapshot, 'shameSensitivity01') ??
      0;

    const legendMomentum01 =
      readNumber(engagement, ['vector', 'legendMomentum01']) ??
      featureScalar(featureSnapshot, 'legendMomentum01') ??
      0;

    const replayInterest01 =
      featureScalar(featureSnapshot, 'replayInterest01') ??
      0;

    const draftCommitment01 =
      featureMessage(featureSnapshot, 'estimatedDraftCommitment01') ??
      featureScalar(featureSnapshot, 'composerCommitment01') ??
      0;

    const inboundPressure01 =
      featureMessage(featureSnapshot, 'estimatedInboundPressure01') ??
      featureScalar(featureSnapshot, 'responseUrgency01') ??
      pressure01;

    const trustMean01 =
      profilePersonaMean(profile, 'helperTrustByPersona') ??
      profileNumber(profile, ['emotionBaseline', 'trust']) ??
      0;

    const helperTrustBoost01 = clamp01((trustMean01 + helperPresence01 + intimacy01) / 3);

    const intimidation01 = weightedMean([
      [pressure01, this.defaults.intimidationPressureWeight],
      [haterPresence01, this.defaults.intimidationHaterWeight],
      [socialExposure01, this.defaults.intimidationExposureWeight],
      [rescueNeed01, this.defaults.intimidationDropOffWeight],
      [quietness01, this.defaults.intimidationSilenceWeight],
    ]) as Score01;

    let confidence01Value = weightedMean([
      [confidenceSeed01, this.defaults.confidenceEngagementWeight],
      [engagement01, 0.18],
      [legendMomentum01, this.defaults.confidenceLegendWeight],
      [helperTrustBoost01, this.defaults.confidenceTrustWeight],
      [invert01(embarrassmentRisk01), 0.14],
      [invert01(rescueNeed01), 0.14],
    ]);

    const previousConfidence = previous?.vector.confidence ?? (0 as Score01);
    if (confidence01Value < previousConfidence) {
      confidence01Value = clamp01(
        confidence01Value * this.defaults.confidenceCollapseAmplifier,
      );
    } else {
      confidence01Value = clamp01(
        previousConfidence +
          (confidence01Value - previousConfidence) * this.defaults.confidenceRecoveryDampening,
      );
    }

    const frustration01 = weightedMean([
      [featureScalar(featureSnapshot, 'failurePressure01'), this.defaults.frustrationFailureWeight],
      [quietness01, this.defaults.frustrationQuietnessWeight],
      [embarrassmentRisk01, this.defaults.frustrationEmbarrassmentWeight],
      [featureDropOff(featureSnapshot, 'churnPressure01'), 0.18],
      [readNumber(dropOffDecision, ['risk01']), 0.14],
      [invert01(legendMomentum01), 0.1],
    ]) as Score01;

    const curiosity01 = weightedMean([
      [draftCommitment01, this.defaults.curiosityDraftCommitmentWeight],
      [replayInterest01, this.defaults.curiosityReplayWeight],
      [inboundPressure01, this.defaults.curiosityInboundPressureWeight],
      [engagement01, 0.16],
      [featureMessage(featureSnapshot, 'estimatedOutboundIntent01'), 0.14],
    ]) as Score01;

    const attachment01 = weightedMean([
      [helperPresence01, this.defaults.attachmentHelperPresenceWeight],
      [helperTrustBoost01, this.defaults.attachmentTrustWeight],
      [intimacy01, this.defaults.attachmentIntimacyWeight],
      [readNumber(helperDecision, ['plan', 'score01']), 0.16],
      [readNumber(profile, ['emotionBaseline', 'attachment']), 0.1],
    ]) as Score01;

    const socialEmbarrassment01 = weightedMean([
      [publicStagePressure01, this.defaults.embarrassmentPublicStageWeight],
      [audienceHeat01, this.defaults.embarrassmentCrowdWeight],
      [shameSensitivity01, this.defaults.embarrassmentShameWeight],
      [featureScalar(featureSnapshot, 'failurePressure01'), this.defaults.embarrassmentFailureWeight],
      [embarrassmentRisk01, 0.18],
      [haterPresence01, 0.12],
    ]) as Score01;

    const relief01 = weightedMean([
      [featureScalar(featureSnapshot, 'recoveryPressure01'), this.defaults.reliefRecoveryWeight],
      [helperPresence01, this.defaults.reliefHelperWeight],
      [helperTrustBoost01, this.defaults.reliefTrustWeight],
      [invert01(rescueNeed01), 0.12],
      [invert01(pressure01), 0.14],
    ]) as Score01;

    const dominance01 = weightedMean([
      [confidence01Value, this.defaults.dominanceConfidenceWeight],
      [socialExposure01, this.defaults.dominanceExposureWeight],
      [invert01(socialEmbarrassment01), this.defaults.dominanceEmbarrassmentInverseWeight],
      [legendMomentum01, 0.16],
      [readNumber(haterDecision, ['score', 'respectOpportunity01']), 0.12],
      [invert01(intimidation01), 0.12],
    ]) as Score01;

    const desperation01 = weightedMean([
      [readNumber(dropOffDecision, ['risk01']), this.defaults.desperationDropOffWeight],
      [rescueNeed01, this.defaults.desperationRescueWeight],
      [pressure01, this.defaults.desperationPressureWeight],
      [featureScalar(featureSnapshot, 'queuePressure01'), 0.14],
      [negotiationExposure01, 0.1],
      [quietness01, 0.1],
    ]) as Score01;

    const trust01 = weightedMean([
      [helperPresence01, this.defaults.trustHelperWeight],
      [intimacy01, this.defaults.trustIntimacyWeight],
      [relief01, this.defaults.trustReliefWeight],
      [trustMean01, 0.2],
      [invert01(haterPresence01), 0.12],
      [invert01(negotiationExposure01), 0.12],
    ]) as Score01;

    return {
      intimidation: intimidation01,
      confidence: asScore01(confidence01Value),
      frustration: frustration01,
      curiosity: curiosity01,
      attachment: attachment01,
      socialEmbarrassment: socialEmbarrassment01,
      relief: relief01,
      dominance: dominance01,
      desperation: desperation01,
      trust: trust01,
    };
  }

  private composeDrivers(input: {
    readonly snapshot: ChatLearningBridgePublicSnapshot;
    readonly authority: ChatAuthority;
    readonly vector: ChatEmotionVector;
    readonly engagement?: ChatEngagementScoreResult;
    readonly helperDecision?: ChatHelperInterventionDecision;
    readonly haterDecision?: ChatHaterPersonaDecision;
    readonly channelDecision?: LooseRecord;
    readonly dropOffDecision?: LooseRecord;
    readonly featureSnapshot?: ChatFeatureSnapshot;
  }): readonly ChatEmotionDriverEvidence[] {
    const drivers: ChatEmotionDriverEvidence[] = [];

    const helperWeight = Math.max(
      input.vector.attachment,
      input.vector.trust,
      input.vector.relief,
    );
    if (helperWeight >= 0.4) {
      drivers.push(
        buildDriver(
          'HELPER_PRESENCE',
          'Helper presence carried weight',
          readString(input.helperDecision, ['plan', 'explanation']) ??
            'Helper timing strongly influenced the emotional room.',
          helperWeight,
          input.snapshot,
          input.authority,
        ),
      );
    }

    const haterWeight = Math.max(
      input.vector.intimidation,
      input.vector.socialEmbarrassment,
      readNumber(input.haterDecision, ['score', 'score01']) ?? 0,
    );
    if (haterWeight >= 0.42) {
      drivers.push(
        buildDriver(
          'RIVALRY_TAUNT',
          'Hater theater carried weight',
          readString(input.haterDecision, ['score', 'explanation']) ??
            'Hater pressure materially shifted the room.',
          haterWeight,
          input.snapshot,
          input.authority,
        ),
      );
    }

    const crowdWeight = Math.max(
      featureSocial(input.featureSnapshot, 'audienceHeat01') ?? 0,
      featureSocial(input.featureSnapshot, 'publicStagePressure01') ?? 0,
      input.vector.socialEmbarrassment,
    );
    if (crowdWeight >= 0.44) {
      drivers.push(
        buildDriver(
          'CROWD_SWARM',
          'Crowd pressure carried weight',
          'Public stage exposure made the moment socially loud.',
          crowdWeight,
          input.snapshot,
          input.authority,
        ),
      );
    }

    const negotiationWeight = Math.max(
      featureSocial(input.featureSnapshot, 'negotiationExposure01') ?? 0,
      readNumber(input.channelDecision, ['scores', 'DEAL_ROOM']) ?? 0,
    );
    if (negotiationWeight >= 0.45) {
      drivers.push(
        buildDriver(
          'NEGOTIATION_STALL',
          'Deal-room exposure carried weight',
          'Predatory quiet or negotiation exposure changed the emotional posture.',
          negotiationWeight,
          input.snapshot,
          input.authority,
        ),
      );
    }

    const silenceWeight = Math.max(
      featureScalar(input.featureSnapshot, 'quietness01') ?? 0,
      readNumber(input.dropOffDecision, ['risk01']) ?? 0,
    );
    if (silenceWeight >= 0.45) {
      drivers.push(
        buildDriver(
          'SILENCE_WINDOW',
          'Silence carried authored weight',
          'Silence, hesitation, or read-lag materially altered the moment.',
          silenceWeight,
          input.snapshot,
          input.authority,
        ),
      );
    }

    const performanceWeight = Math.max(
      readNumber(input.engagement, ['vector', 'legendMomentum01']) ?? 0,
      readNumber(input.engagement, ['vector', 'confidence01']) ?? 0,
      featureScalar(input.featureSnapshot, 'failurePressure01') ?? 0,
    );
    if (performanceWeight >= 0.4) {
      drivers.push(
        buildDriver(
          'PERFORMANCE_SWING',
          'Performance swing carried weight',
          readString(input.engagement, ['explanation']) ??
            'Recent performance changed confidence and risk posture.',
          performanceWeight,
          input.snapshot,
          input.authority,
        ),
      );
    }

    return Object.freeze(drivers);
  }

  private composeRecommendation(input: {
    readonly emotionSnapshot: ChatEmotionSnapshot;
    readonly activeChannel: ChatVisibleChannel;
    readonly preferredChannelHint: ChatVisibleChannel;
    readonly channelDecision?: LooseRecord;
    readonly helperDecision?: ChatHelperInterventionDecision;
    readonly haterDecision?: ChatHaterPersonaDecision;
  }): ChatEmotionRecommendationSurface {
    const { emotionSnapshot, activeChannel, preferredChannelHint } = input;
    const preferredFromPolicy = normalizeChannel(
      readString(input.channelDecision, ['recommendedChannel']),
      preferredChannelHint,
    );

    let preferredChannel = preferredFromPolicy;
    const shouldContainCrowd = emotionSnapshot.derived.crowdPileOnRisk >= 0.56;
    if (shouldContainCrowd && activeChannel === ('GLOBAL' as ChatVisibleChannel)) {
      preferredChannel = ('SYNDICATE' as ChatVisibleChannel);
    }
    if (
      emotionSnapshot.derived.helperUrgency >= 0.58 &&
      activeChannel === ('DEAL_ROOM' as ChatVisibleChannel)
    ) {
      preferredChannel = ('SYNDICATE' as ChatVisibleChannel);
    }

    const shouldPreferSilence = emotionSnapshot.silenceDirective.preferSilence;
    const shouldSummonHelper =
      emotionSnapshot.derived.helperUrgency >=
      this.defaults.helperUrgencyBridgeThreshold;
    const shouldEscalateHater =
      emotionSnapshot.derived.haterOpportunity >=
      this.defaults.haterWindowBridgeThreshold;
    const shouldAllowComebackSpeech =
      emotionSnapshot.derived.comebackReadiness >=
      this.defaults.comebackWindowThreshold;
    const shouldWithholdCelebration =
      emotionSnapshot.derived.celebrationTolerance <=
      this.defaults.celebrationHoldThreshold;

    return {
      preferredChannel,
      shouldPreferSilence,
      shouldSummonHelper,
      shouldEscalateHater,
      shouldContainCrowd,
      shouldAllowComebackSpeech,
      shouldWithholdCelebration,
      reason: safeNarrative([
        `dominant=${emotionSnapshot.derived.dominantAxis}`,
        `state=${emotionSnapshot.derived.operatingState}`,
        shouldContainCrowd ? 'crowd containment recommended' : undefined,
        shouldSummonHelper ? 'helper window open' : undefined,
        shouldEscalateHater ? 'hater escalation window open' : undefined,
        shouldPreferSilence ? 'silence holds authored value' : undefined,
        shouldAllowComebackSpeech ? 'comeback rhetoric now fits' : undefined,
        shouldWithholdCelebration ? 'celebration should remain restrained' : undefined,
      ]),
    };
  }

  private composeNotes(input: {
    readonly featureSnapshot?: ChatFeatureSnapshot;
    readonly engagement?: ChatEngagementScoreResult;
    readonly helperDecision?: ChatHelperInterventionDecision;
    readonly haterDecision?: ChatHaterPersonaDecision;
    readonly channelDecision?: LooseRecord;
    readonly dropOffDecision?: LooseRecord;
    readonly vector: ChatEmotionVector;
  }): readonly string[] {
    const notes = new Set<string>();
    if (input.featureSnapshot) {
      notes.add(summarizeChatFeatureSnapshot(input.featureSnapshot));
    } else {
      notes.add('Feature extractor payload missing; scorer used bridge-compatible fallback heuristics.');
    }
    if (readString(input.engagement, ['explanation'])) {
      notes.add(readString(input.engagement, ['explanation'])!);
    }
    if (readString(input.helperDecision, ['plan', 'explanation'])) {
      notes.add(readString(input.helperDecision, ['plan', 'explanation'])!);
    }
    if (readString(input.haterDecision, ['score', 'explanation'])) {
      notes.add(readString(input.haterDecision, ['score', 'explanation'])!);
    }
    if (readString(input.channelDecision, ['explanation'])) {
      notes.add(readString(input.channelDecision, ['explanation'])!);
    }
    if (readString(input.dropOffDecision, ['explanation'])) {
      notes.add(readString(input.dropOffDecision, ['explanation'])!);
    }
    notes.add(`vector=${describeEmotionVector(input.vector)}`);
    notes.add(`dominant=${getDominantEmotionAxis(input.vector)}`);
    const secondary = getSecondaryEmotionAxis(input.vector);
    if (secondary) {
      notes.add(`secondary=${secondary}`);
    }
    return Object.freeze([...notes]);
  }

  private readPreviousSnapshot(
    roomId: ChatRoomId,
    userId: ChatUserId | undefined,
    channel: ChatVisibleChannel,
  ): ChatEmotionSnapshot | undefined {
    const key = this.subjectKey(roomId, userId, channel);
    const history = this.historyBySubject.get(key);
    return history?.[history.length - 1];
  }

  private writeHistory(
    roomId: ChatRoomId,
    userId: ChatUserId | undefined,
    channel: ChatVisibleChannel,
    snapshot: ChatEmotionSnapshot,
  ): void {
    const key = this.subjectKey(roomId, userId, channel);
    const next = [...(this.historyBySubject.get(key) ?? []), snapshot];
    while (next.length > this.defaults.windowHistoryLimit) {
      next.shift();
    }
    this.historyBySubject.set(key, next);
  }

  private subjectKey(
    roomId: ChatRoomId,
    userId: ChatUserId | undefined,
    channel: ChatVisibleChannel,
  ): string {
    return `${roomId}::${userId ?? 'anonymous'}::${channel}`;
  }

  private safeEngagement(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): ChatEngagementScoreResult | undefined {
    try {
      return scoreChatEngagement(snapshot);
    } catch {
      return undefined;
    }
  }

  private safeHelper(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): ChatHelperInterventionDecision | undefined {
    try {
      return resolveChatHelperIntervention(snapshot);
    } catch {
      return undefined;
    }
  }

  private safeHater(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): ChatHaterPersonaDecision | undefined {
    try {
      return resolveChatHaterPersona(snapshot);
    } catch {
      return undefined;
    }
  }

  private safeChannelDecision(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): LooseRecord | undefined {
    try {
      return evaluateChatChannelRecommendation(snapshot) as unknown as LooseRecord;
    } catch {
      return undefined;
    }
  }

  private safeDropOff(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): LooseRecord | undefined {
    try {
      return evaluateChatDropOffRisk(snapshot) as unknown as LooseRecord;
    } catch {
      return undefined;
    }
  }
}

/* ========================================================================== *
 * MARK: Public helpers
 * ========================================================================== */

export function createChatEmotionScorer(
  options: ChatEmotionScorerOptions = {},
): ChatEmotionScorer {
  return new ChatEmotionScorer(options);
}

export function scoreChatEmotion(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatEmotionScorerOptions = {},
): ChatEmotionScoreResult {
  return createChatEmotionScorer(options).score(snapshot);
}

export function summarizeChatEmotion(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatEmotionScorerOptions = {},
): ChatEmotionSummary {
  return createChatEmotionScorer(options).summarize(snapshot);
}

export function recommendChatEmotionIntervention(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatEmotionScorerOptions = {},
): ChatLearningBridgeRecommendation {
  return createChatEmotionScorer(options).recommend(snapshot);
}

export function refineChatEmotionProfileState(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatEmotionScorerOptions = {},
): Partial<ChatLearningBridgeProfileState> {
  return createChatEmotionScorer(options).refineProfile(snapshot);
}

export const CHAT_EMOTION_SCORER_NAMESPACE = Object.freeze({
  moduleName: CHAT_EMOTION_SCORER_MODULE_NAME,
  version: CHAT_EMOTION_SCORER_VERSION,
  runtimeLaws: CHAT_EMOTION_SCORER_RUNTIME_LAWS,
  defaults: CHAT_EMOTION_SCORER_DEFAULTS,
  bridge: {
    moduleName: CHAT_LEARNING_BRIDGE_MODULE_NAME,
    version: CHAT_LEARNING_BRIDGE_VERSION,
    defaults: CHAT_LEARNING_BRIDGE_DEFAULTS,
    channelKeys: CHAT_LEARNING_BRIDGE_CHANNEL_KEYS,
  },
  shared: {
    emotion: CHAT_EMOTION_CONTRACT_MANIFEST,
    emotionSignals: EMOTION_SIGNAL_CONTRACT_MANIFEST,
  },
  create: createChatEmotionScorer,
  score: scoreChatEmotion,
  summarize: summarizeChatEmotion,
  recommend: recommendChatEmotionIntervention,
  refineProfile: refineChatEmotionProfileState,
} as const);

export const CHAT_EMOTION_SCORER_EXPORT_NAMES = Object.freeze([
  'CHAT_EMOTION_SCORER_MODULE_NAME',
  'CHAT_EMOTION_SCORER_VERSION',
  'CHAT_EMOTION_SCORER_RUNTIME_LAWS',
  'CHAT_EMOTION_SCORER_DEFAULTS',
  'ChatEmotionScorer',
  'createChatEmotionScorer',
  'scoreChatEmotion',
  'summarizeChatEmotion',
  'recommendChatEmotionIntervention',
  'refineChatEmotionProfileState',
  'CHAT_EMOTION_SCORER_NAMESPACE',
] as const);
