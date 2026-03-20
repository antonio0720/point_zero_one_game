/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ML SOCIAL EMBARRASSMENT SCORER
 * FILE: pzo-web/src/engines/chat/intelligence/ml/SocialEmbarrassmentScorer.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Specialized scorer for one of the most consequential authored emotions in the
 * PZO chat stack: public embarrassment.
 *
 * Why a dedicated module exists beside EmotionScorer
 * -----------------------------------------------
 * General emotion scoring must reason about the whole room. This scorer exists
 * because social embarrassment is disproportionately important for:
 * - hater escalation timing,
 * - helper witness / containment timing,
 * - crowd pile-on prediction,
 * - silence vs counter-speech decisions,
 * - channel retreat from GLOBAL to SYNDICATE,
 * - humiliation / legend / comeback setup,
 * - rescue surfaces before churn.
 *
 * The scorer therefore treats embarrassment as an authored battlefield rather
 * than as generic “negative sentiment.”
 * ============================================================================
 */

import type {
  ChatLearningBridgeProfileState,
  ChatLearningBridgePublicSnapshot,
  ChatLearningBridgeRecommendation,
} from '../ChatLearningBridge';

import type {
  ChatFeatureSnapshot,
  ChatVisibleChannel,
  Score01,
} from '../../types';

import {
  summarizeChatFeatureSnapshot,
} from '../../ml/FeatureExtractor';

import {
  evaluateChatChannelRecommendation,
} from '../../ml/ChannelRecommendationPolicy';

import {
  resolveChatHelperIntervention,
} from '../../ml/HelperInterventionPolicy';

import {
  resolveChatHaterPersona,
} from '../../ml/HaterPersonaPolicy';

import {
  evaluateChatDropOffRisk,
} from '../../ml/DropOffRiskScorer';

import type {
  ChatEmotionSnapshot,
  ChatEmotionSummary,
} from '../../../../../../shared/contracts/chat/ChatEmotion';

import {
  buildEmotionDebugNotes,
  clampEmotionScalar,
  emotionScore01To100,
} from '../../../../../../shared/contracts/chat/ChatEmotion';

import {
  type EmotionFeatureBag,
  buildEmotionFeatureBag,
  buildEmotionRankingHint,
} from '../../../../../../shared/contracts/chat/learning/EmotionSignals';

import {
  CHAT_EMOTION_SCORER_MODULE_NAME,
  CHAT_EMOTION_SCORER_VERSION,
  type ChatEmotionScoreResult,
  createChatEmotionScorer,
} from './EmotionScorer';

/* ========================================================================== *
 * MARK: Module constants
 * ========================================================================== */

export const CHAT_SOCIAL_EMBARRASSMENT_SCORER_MODULE_NAME =
  'PZO_CHAT_SOCIAL_EMBARRASSMENT_SCORER' as const;

export const CHAT_SOCIAL_EMBARRASSMENT_SCORER_VERSION =
  '2026.03.20-social-embarrassment-scorer.v1' as const;

export const CHAT_SOCIAL_EMBARRASSMENT_SCORER_RUNTIME_LAWS = Object.freeze([
  'Embarrassment is stage-specific and cannot be scored without channel context.',
  'GLOBAL embarrassment should react faster than private-channel embarrassment.',
  'A helper witness may calm the room even when coaching would be too loud.',
  'Silence is valid when speech would compound humiliation.',
  'Predatory delay in Deal Room is a different embarrassment surface than public ridicule.',
  'A comeback window should not open until embarrassment is survivable.',
] as const);

export const CHAT_SOCIAL_EMBARRASSMENT_SCORER_DEFAULTS = Object.freeze({
  globalStageBias: 0.1,
  syndicateBuffer: 0.08,
  dealRoomPredationBias: 0.07,
  helperContainmentThreshold: 0.54,
  helperWitnessThreshold: 0.46,
  haterExploitabilityThreshold: 0.58,
  silenceThreshold: 0.57,
  channelRetreatThreshold: 0.55,
  comebackReadinessThreshold: 0.38,
} as const);

/* ========================================================================== *
 * MARK: Public contracts
 * ========================================================================== */

export type ChatEmbarrassmentBand =
  | 'NONE'
  | 'TRACE'
  | 'LOW'
  | 'MODERATE'
  | 'HIGH'
  | 'PUBLIC_BREAK';

export interface ChatSocialEmbarrassmentScorerOptions {
  readonly defaults?: Partial<typeof CHAT_SOCIAL_EMBARRASSMENT_SCORER_DEFAULTS>;
  readonly emotionScorerOptions?: Parameters<typeof createChatEmotionScorer>[0];
}

export interface ChatEmbarrassmentContainmentPlan {
  readonly preferredChannel: ChatVisibleChannel;
  readonly shouldRetreatFromGlobal: boolean;
  readonly shouldContainCrowd: boolean;
  readonly shouldPreferWitnessHelper: boolean;
  readonly shouldPreferTacticalHelper: boolean;
  readonly shouldHoldSilence: boolean;
  readonly shouldDelayCelebration: boolean;
  readonly shouldOpenComebackWindow: boolean;
  readonly reason: string;
}

export interface ChatSocialEmbarrassmentBreakdown {
  readonly moduleName: typeof CHAT_SOCIAL_EMBARRASSMENT_SCORER_MODULE_NAME;
  readonly moduleVersion: typeof CHAT_SOCIAL_EMBARRASSMENT_SCORER_VERSION;
  readonly emotionModuleName: typeof CHAT_EMOTION_SCORER_MODULE_NAME;
  readonly emotionModuleVersion: typeof CHAT_EMOTION_SCORER_VERSION;
  readonly embarrassment01: Score01;
  readonly publicStagePressure01: Score01;
  readonly audienceHeat01: Score01;
  readonly crowdPileOnRisk01: Score01;
  readonly haterExploitability01: Score01;
  readonly helperContainmentNeed01: Score01;
  readonly silenceSuitability01: Score01;
  readonly summary: string;
}

export interface ChatSocialEmbarrassmentDecision {
  readonly embarrassment01: Score01;
  readonly embarrassmentBand: ChatEmbarrassmentBand;
  readonly publicStagePressure01: Score01;
  readonly audienceHeat01: Score01;
  readonly crowdPileOnRisk01: Score01;
  readonly haterExploitability01: Score01;
  readonly helperContainmentNeed01: Score01;
  readonly silenceSuitability01: Score01;
  readonly featureBag: EmotionFeatureBag;
  readonly rankingHint: ReturnType<typeof buildEmotionRankingHint>;
  readonly emotion: ChatEmotionScoreResult;
  readonly containmentPlan: ChatEmbarrassmentContainmentPlan;
  readonly bridgeRecommendation: ChatLearningBridgeRecommendation;
  readonly profilePatch: Partial<ChatLearningBridgeProfileState>;
  readonly breakdown: ChatSocialEmbarrassmentBreakdown;
  readonly notes: readonly string[];
}

/* ========================================================================== *
 * MARK: Helpers
 * ========================================================================== */

type LooseRecord = Record<string, unknown>;

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

function asScore01(value: number): Score01 {
  return clampEmotionScalar(value);
}

function extractFeatureSnapshot(snapshot: ChatLearningBridgePublicSnapshot): ChatFeatureSnapshot | undefined {
  const direct = (snapshot as LooseRecord).featureSnapshot;
  if (direct) return direct as ChatFeatureSnapshot;
  const features = getPath(snapshot, ['features']);
  return features as ChatFeatureSnapshot | undefined;
}

function inferChannel(snapshot: unknown): ChatVisibleChannel {
  const direct = readString(
    snapshot,
    ['activeChannel'],
    ['channelId'],
    ['featureSnapshot', 'channels', 'activeChannel'],
  );
  const upper = direct?.toUpperCase();
  switch (upper) {
    case 'GLOBAL':
    case 'SYNDICATE':
    case 'DEAL_ROOM':
    case 'LOBBY':
      return upper;
    default:
      return 'GLOBAL';
  }
}

function embarrassmentBand(value: number): ChatEmbarrassmentBand {
  const v = Math.max(0, Math.min(1, value));
  if (v < 0.08) return 'NONE';
  if (v < 0.2) return 'TRACE';
  if (v < 0.36) return 'LOW';
  if (v < 0.56) return 'MODERATE';
  if (v < 0.76) return 'HIGH';
  return 'PUBLIC_BREAK';
}

function inverse01(value: number | undefined): number {
  return 1 - Math.max(0, Math.min(1, value ?? 0));
}

function weightedMean(pairs: ReadonlyArray<readonly [number | undefined, number]>): number {
  let total = 0;
  let weight = 0;
  for (const [value, w] of pairs) {
    if (!Number.isFinite(value as number)) continue;
    total += Math.max(0, Math.min(1, value as number)) * w;
    weight += w;
  }
  return weight > 0 ? Math.max(0, Math.min(1, total / weight)) : 0;
}

function summarizeContainmentPlan(plan: ChatEmbarrassmentContainmentPlan): string {
  return [
    `channel=${plan.preferredChannel}`,
    plan.shouldRetreatFromGlobal ? 'retreat-from-global' : undefined,
    plan.shouldContainCrowd ? 'contain-crowd' : undefined,
    plan.shouldPreferWitnessHelper ? 'prefer-witness-helper' : undefined,
    plan.shouldPreferTacticalHelper ? 'prefer-tactical-helper' : undefined,
    plan.shouldHoldSilence ? 'hold-silence' : undefined,
    plan.shouldDelayCelebration ? 'delay-celebration' : undefined,
    plan.shouldOpenComebackWindow ? 'open-comeback-window' : undefined,
  ].filter(Boolean).join(' | ');
}

/* ========================================================================== *
 * MARK: Scorer
 * ========================================================================== */

export class ChatSocialEmbarrassmentScorer {
  private readonly defaults: typeof CHAT_SOCIAL_EMBARRASSMENT_SCORER_DEFAULTS;
  private readonly emotionScorer: ReturnType<typeof createChatEmotionScorer>;

  public constructor(options: ChatSocialEmbarrassmentScorerOptions = {}) {
    this.defaults = Object.freeze({
      ...CHAT_SOCIAL_EMBARRASSMENT_SCORER_DEFAULTS,
      ...(options.defaults ?? {}),
    });
    this.emotionScorer = createChatEmotionScorer(options.emotionScorerOptions);
  }

  public evaluate(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): ChatSocialEmbarrassmentDecision {
    const emotion = this.emotionScorer.score(snapshot);
    const emotionSnapshot = emotion.emotionSnapshot;
    const featureSnapshot = extractFeatureSnapshot(snapshot);
    const activeChannel = inferChannel(snapshot);

    const audienceHeat01 = weightedMean([
      [readNumber(featureSnapshot, ['social', 'audienceHeat01']), 0.42],
      [emotionSnapshot.derived.crowdPileOnRisk, 0.32],
      [emotionSnapshot.vector.socialEmbarrassment, 0.26],
    ]);

    const publicStagePressure01 = weightedMean([
      [readNumber(featureSnapshot, ['social', 'publicStagePressure01']), 0.52],
      [activeChannel === 'GLOBAL' ? 1 : activeChannel === 'DEAL_ROOM' ? 0.62 : 0.22, 0.18],
      [emotionSnapshot.vector.socialEmbarrassment, 0.14],
      [emotionSnapshot.vector.intimidation, 0.16],
    ]);

    const helperPlan = this.safeHelper(snapshot);
    const haterPlan = this.safeHater(snapshot);
    const channelPlan = this.safeChannel(snapshot);
    const dropOffPlan = this.safeDropOff(snapshot);

    const embarrassment01 = asScore01(weightedMean([
      [emotionSnapshot.vector.socialEmbarrassment, 0.28],
      [publicStagePressure01, 0.22],
      [audienceHeat01, 0.16],
      [emotionSnapshot.vector.frustration, 0.14],
      [emotionSnapshot.vector.intimidation, 0.1],
      [readNumber(featureSnapshot, ['social', 'embarrassmentRisk01']), 0.1],
    ]));

    const crowdPileOnRisk01 = asScore01(weightedMean([
      [emotionSnapshot.derived.crowdPileOnRisk, 0.42],
      [audienceHeat01, 0.24],
      [publicStagePressure01, 0.18],
      [embarrassment01, 0.16],
    ]));

    const haterExploitability01 = asScore01(weightedMean([
      [emotionSnapshot.derived.haterOpportunity, 0.36],
      [embarrassment01, 0.24],
      [publicStagePressure01, 0.14],
      [readNumber(haterPlan, ['score', 'score01']), 0.14],
      [inverse01(emotionSnapshot.vector.trust), 0.12],
    ]));

    const helperContainmentNeed01 = asScore01(weightedMean([
      [emotionSnapshot.derived.helperUrgency, 0.34],
      [embarrassment01, 0.22],
      [crowdPileOnRisk01, 0.16],
      [readNumber(helperPlan, ['plan', 'score01']), 0.14],
      [readNumber(dropOffPlan, ['risk01']), 0.14],
    ]));

    const silenceSuitability01 = asScore01(weightedMean([
      [emotionSnapshot.derived.silenceSuitability, 0.42],
      [embarrassment01, 0.18],
      [audienceHeat01, 0.12],
      [readNumber(dropOffPlan, ['risk01']), 0.14],
      [inverse01(emotionSnapshot.vector.curiosity), 0.14],
    ]));

    const preferredFromChannel = readString(channelPlan, ['recommendedChannel']);
    const preferredChannel: ChatVisibleChannel =
      embarrassment01 >= this.defaults.channelRetreatThreshold && activeChannel === 'GLOBAL'
        ? 'SYNDICATE'
        : preferredFromChannel === 'GLOBAL' ||
          preferredFromChannel === 'SYNDICATE' ||
          preferredFromChannel === 'DEAL_ROOM' ||
          preferredFromChannel === 'LOBBY'
        ? preferredFromChannel
        : activeChannel;

    const containmentPlan: ChatEmbarrassmentContainmentPlan = {
      preferredChannel,
      shouldRetreatFromGlobal:
        activeChannel === 'GLOBAL' && embarrassment01 >= this.defaults.channelRetreatThreshold,
      shouldContainCrowd: crowdPileOnRisk01 >= this.defaults.helperContainmentThreshold,
      shouldPreferWitnessHelper:
        helperContainmentNeed01 >= this.defaults.helperWitnessThreshold &&
        embarrassment01 >= 0.34,
      shouldPreferTacticalHelper:
        helperContainmentNeed01 >= this.defaults.helperContainmentThreshold &&
        activeChannel === 'DEAL_ROOM',
      shouldHoldSilence: silenceSuitability01 >= this.defaults.silenceThreshold,
      shouldDelayCelebration:
        emotionSnapshot.derived.celebrationTolerance < 0.5 || embarrassment01 >= 0.42,
      shouldOpenComebackWindow:
        embarrassment01 <= this.defaults.comebackReadinessThreshold &&
        emotionSnapshot.derived.comebackReadiness >= 0.5,
      reason: summarizeContainmentPlan({
        preferredChannel,
        shouldRetreatFromGlobal:
          activeChannel === 'GLOBAL' && embarrassment01 >= this.defaults.channelRetreatThreshold,
        shouldContainCrowd: crowdPileOnRisk01 >= this.defaults.helperContainmentThreshold,
        shouldPreferWitnessHelper:
          helperContainmentNeed01 >= this.defaults.helperWitnessThreshold && embarrassment01 >= 0.34,
        shouldPreferTacticalHelper:
          helperContainmentNeed01 >= this.defaults.helperContainmentThreshold && activeChannel === 'DEAL_ROOM',
        shouldHoldSilence: silenceSuitability01 >= this.defaults.silenceThreshold,
        shouldDelayCelebration:
          emotionSnapshot.derived.celebrationTolerance < 0.5 || embarrassment01 >= 0.42,
        shouldOpenComebackWindow:
          embarrassment01 <= this.defaults.comebackReadinessThreshold &&
          emotionSnapshot.derived.comebackReadiness >= 0.5,
        reason: '',
      }),
    };

    const featureBag = buildEmotionFeatureBag(emotionSnapshot, 'SHORT');
    const rankingHint = buildEmotionRankingHint(emotionSnapshot);

    const bridgeRecommendation = {
      kind: 'SOCIAL_EMBARRASSMENT_RUNTIME',
      recommendedChannel: containmentPlan.preferredChannel,
      explanation: containmentPlan.reason,
      embarrassment01,
      crowdPileOnRisk01,
      haterExploitability01,
      helperContainmentNeed01,
      shouldHoldSilence: containmentPlan.shouldHoldSilence,
      shouldContainCrowd: containmentPlan.shouldContainCrowd,
      shouldPreferWitnessHelper: containmentPlan.shouldPreferWitnessHelper,
      shouldDelayCelebration: containmentPlan.shouldDelayCelebration,
      shouldOpenComebackWindow: containmentPlan.shouldOpenComebackWindow,
    } as ChatLearningBridgeRecommendation;

    const profilePatch = {
      lastEmbarrassmentBand: embarrassmentBand(embarrassment01),
      lastEmbarrassment01: embarrassment01,
      lastCrowdPileOnRisk01: crowdPileOnRisk01,
      lastContainmentChannel: containmentPlan.preferredChannel,
      lastContainmentPlan: containmentPlan,
    } as Partial<ChatLearningBridgeProfileState>;

    const breakdown: ChatSocialEmbarrassmentBreakdown = {
      moduleName: CHAT_SOCIAL_EMBARRASSMENT_SCORER_MODULE_NAME,
      moduleVersion: CHAT_SOCIAL_EMBARRASSMENT_SCORER_VERSION,
      emotionModuleName: CHAT_EMOTION_SCORER_MODULE_NAME,
      emotionModuleVersion: CHAT_EMOTION_SCORER_VERSION,
      embarrassment01,
      publicStagePressure01: asScore01(publicStagePressure01),
      audienceHeat01: asScore01(audienceHeat01),
      crowdPileOnRisk01,
      haterExploitability01,
      helperContainmentNeed01,
      silenceSuitability01,
      summary: [
        `embarrassment=${emotionScore01To100(embarrassment01)}`,
        `band=${embarrassmentBand(embarrassment01)}`,
        `channel=${activeChannel}`,
        `preferred=${containmentPlan.preferredChannel}`,
        containmentPlan.shouldHoldSilence ? 'silence' : undefined,
        containmentPlan.shouldContainCrowd ? 'contain-crowd' : undefined,
        containmentPlan.shouldPreferWitnessHelper ? 'witness-helper' : undefined,
      ].filter(Boolean).join(' | '),
    };

    const notes = new Set<string>();
    if (featureSnapshot) {
      notes.add(summarizeChatFeatureSnapshot(featureSnapshot));
    }
    notes.add(...buildEmotionDebugNotes(emotionSnapshot));
    notes.add(containmentPlan.reason);
    if (emotion.emotionSummary) {
      notes.add(emotion.emotionSummary.narrative);
    }

    return {
      embarrassment01,
      embarrassmentBand: embarrassmentBand(embarrassment01),
      publicStagePressure01: asScore01(publicStagePressure01),
      audienceHeat01: asScore01(audienceHeat01),
      crowdPileOnRisk01,
      haterExploitability01,
      helperContainmentNeed01,
      silenceSuitability01,
      featureBag,
      rankingHint,
      emotion,
      containmentPlan,
      bridgeRecommendation,
      profilePatch,
      breakdown,
      notes: Object.freeze([...notes]),
    };
  }

  public recommend(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): ChatLearningBridgeRecommendation {
    return this.evaluate(snapshot).bridgeRecommendation;
  }

  public refineProfile(
    snapshot: ChatLearningBridgePublicSnapshot,
  ): Partial<ChatLearningBridgeProfileState> {
    return this.evaluate(snapshot).profilePatch;
  }

  private safeHelper(snapshot: ChatLearningBridgePublicSnapshot): LooseRecord | undefined {
    try {
      return resolveChatHelperIntervention(snapshot) as unknown as LooseRecord;
    } catch {
      return undefined;
    }
  }

  private safeHater(snapshot: ChatLearningBridgePublicSnapshot): LooseRecord | undefined {
    try {
      return resolveChatHaterPersona(snapshot) as unknown as LooseRecord;
    } catch {
      return undefined;
    }
  }

  private safeChannel(snapshot: ChatLearningBridgePublicSnapshot): LooseRecord | undefined {
    try {
      return evaluateChatChannelRecommendation(snapshot) as unknown as LooseRecord;
    } catch {
      return undefined;
    }
  }

  private safeDropOff(snapshot: ChatLearningBridgePublicSnapshot): LooseRecord | undefined {
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

export function createChatSocialEmbarrassmentScorer(
  options: ChatSocialEmbarrassmentScorerOptions = {},
): ChatSocialEmbarrassmentScorer {
  return new ChatSocialEmbarrassmentScorer(options);
}

export function evaluateChatSocialEmbarrassment(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatSocialEmbarrassmentScorerOptions = {},
): ChatSocialEmbarrassmentDecision {
  return createChatSocialEmbarrassmentScorer(options).evaluate(snapshot);
}

export function recommendEmbarrassmentContainment(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatSocialEmbarrassmentScorerOptions = {},
): ChatLearningBridgeRecommendation {
  return createChatSocialEmbarrassmentScorer(options).recommend(snapshot);
}

export function refineEmbarrassmentProfileState(
  snapshot: ChatLearningBridgePublicSnapshot,
  options: ChatSocialEmbarrassmentScorerOptions = {},
): Partial<ChatLearningBridgeProfileState> {
  return createChatSocialEmbarrassmentScorer(options).refineProfile(snapshot);
}

export const CHAT_SOCIAL_EMBARRASSMENT_SCORER_NAMESPACE = Object.freeze({
  moduleName: CHAT_SOCIAL_EMBARRASSMENT_SCORER_MODULE_NAME,
  version: CHAT_SOCIAL_EMBARRASSMENT_SCORER_VERSION,
  runtimeLaws: CHAT_SOCIAL_EMBARRASSMENT_SCORER_RUNTIME_LAWS,
  defaults: CHAT_SOCIAL_EMBARRASSMENT_SCORER_DEFAULTS,
  create: createChatSocialEmbarrassmentScorer,
  evaluate: evaluateChatSocialEmbarrassment,
  recommend: recommendEmbarrassmentContainment,
  refineProfile: refineEmbarrassmentProfileState,
} as const);
