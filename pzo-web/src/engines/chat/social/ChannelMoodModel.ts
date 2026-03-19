
/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT CHANNEL MOOD MODEL
 * FILE: pzo-web/src/engines/chat/social/ChannelMoodModel.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Deterministic, frontend-owned channel mood modeling for the sovereign chat
 * runtime.
 *
 * Audience heat answers:
 *   "How intense is the room right now?"
 *
 * Reputation answers:
 *   "What does the room believe about this actor over time?"
 *
 * Channel mood answers:
 *   "What emotional weather should this channel feel like at this exact moment,
 *    given heat, reputation, silence, witnesses, relationships, and recent
 *    transcript texture?"
 *
 * This file intentionally lives in the pzo-web engine lane because it is a
 * stateful runtime model:
 * - shared contracts define the law
 * - backend owns archival truth and long-range inference
 * - frontend owns immediate pacing, perceptual continuity, and present-tense
 *   emotional experience
 *
 * Design laws
 * -----------
 * - Preserve ChatEngineState.channelMoodByChannel exactly.
 * - Read only from existing runtime truth and additive phase4 surfaces.
 * - Do not fabricate battle, finance, or server truth.
 * - Mood must be compositional, explainable, and reversible.
 * - Mood must respect channel identity:
 *   GLOBAL    -> theatrical, swarm-heavy, witness-sensitive
 *   SYNDICATE -> private, tactical, trust-sensitive
 *   DEAL_ROOM -> predatory, cold, scrutiny-heavy
 *   LOBBY     -> anticipatory, ambient, ceremonial
 * - Mood must not thrash on every frame. Hysteresis, hold windows, and
 *   transition stability are first-class.
 *
 * Relationship to nearby modules
 * ------------------------------
 * - AudienceHeatEngine.ts owns the heat vector and first-pass mood hint.
 * - ReputationAura.ts owns the persistent aura vector and standing read.
 * - ChannelMoodModel.ts owns final presentational weather for each channel,
 *   after applying continuity, silence, scene pressure, transition stability,
 *   and channel-specific laws.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import {
  CHAT_VISIBLE_CHANNELS,
  type ChatAffectSnapshot,
  type ChatAudienceHeat,
  type ChatChannelId,
  type ChatChannelMood,
  type ChatEngineState,
  type ChatMessage,
  type ChatRelationshipState,
  type ChatReputationState,
  type ChatScenePlan,
  type ChatVisibleChannel,
  type Score100,
  type UnixMs,
} from '../types';
import { cloneChatEngineState, setChannelMoodInState } from '../ChatState';
import {
  createAudienceHeatEngine,
  type AudienceHeatDerivation,
  type AudienceHeatPreview,
  type AudienceHeatSignalSummary,
} from './AudienceHeatEngine';
import {
  createReputationAura,
  type ReputationAuraDerivation,
  type ReputationAuraPreview,
} from './ReputationAura';

export interface ChannelMoodClock {
  now(): number;
}

const DEFAULT_CLOCK: ChannelMoodClock = {
  now: () => Date.now(),
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function asScore100(value: number): Score100 {
  return Math.round(clamp(value, 0, 100)) as Score100;
}

function asUnixMs(value: number): UnixMs {
  return Math.trunc(Math.max(0, value)) as UnixMs;
}

function scoreToNumber(value: Score100 | number | undefined): number {
  if (typeof value !== 'number') return 0;
  return clamp(value, 0, 100);
}

function avg(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxOf(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((max, value) => (value > max ? value : max), values[0] ?? 0);
}

function normalizeBody(body: string | undefined): string {
  return (body ?? '').replace(/\s+/g, ' ').trim();
}

function countMatches(body: string, pattern: RegExp): number {
  const matches = body.match(pattern);
  return matches ? matches.length : 0;
}

function containsAny(body: string, terms: readonly string[]): number {
  const lower = body.toLowerCase();
  let hits = 0;
  for (const term of terms) {
    if (lower.includes(term)) hits += 1;
  }
  return hits;
}

function countAllCapsWords(body: string): number {
  const tokens = body.split(/\s+/g).filter(Boolean);
  let count = 0;
  for (const token of tokens) {
    const alpha = token.replace(/[^A-Za-z]/g, '');
    if (alpha.length >= 3 && alpha === alpha.toUpperCase()) count += 1;
  }
  return count;
}

function ratio(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return part / whole;
}

export type MoodStabilityBand = 'FRAGILE' | 'SETTLING' | 'STABLE' | 'LOCKED';
export type MoodTransitionSeverity = 'LIGHT' | 'MODERATE' | 'HEAVY' | 'CEREMONIAL';
export type MoodRiskBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type MoodPressureAxis =
  | 'HEAT'
  | 'HYPE'
  | 'RIDICULE'
  | 'SCRUTINY'
  | 'VOLATILITY'
  | 'WITNESS'
  | 'RELATIONSHIP'
  | 'REPUTATION'
  | 'AFFECT'
  | 'SCENE'
  | 'SILENCE'
  | 'LIVEOPS'
  | 'NEGOTIATION';

export interface MoodPressureRail {
  readonly axis: MoodPressureAxis;
  readonly score: number;
  readonly label: string;
  readonly description: string;
  readonly severity: MoodRiskBand;
}

export interface MoodEvidenceLine {
  readonly weight: number;
  readonly label: string;
  readonly why: string;
}

export interface MoodTransitionWindow {
  readonly from: ChatChannelMood['mood'];
  readonly to: ChatChannelMood['mood'];
  readonly changedAt: UnixMs;
  readonly severity: MoodTransitionSeverity;
  readonly reasons: readonly string[];
}

export interface ChannelMoodSummary {
  readonly channelId: ChatVisibleChannel;
  readonly dominantAxis: MoodPressureAxis;
  readonly dominantAxisScore: number;
  readonly stability: MoodStabilityBand;
  readonly transitionRisk: MoodRiskBand;
  readonly witnessPressure: number;
  readonly relationshipPressure: number;
  readonly auraPressure: number;
  readonly silencePressure: number;
  readonly scenePressure: number;
  readonly negotiationPressure: number;
  readonly localTexturePressure: number;
}

export interface ChannelMoodDerivation {
  readonly channelId: ChatVisibleChannel;
  readonly next: ChatChannelMood;
  readonly previous: ChatChannelMood;
  readonly summary: ChannelMoodSummary;
  readonly rails: readonly MoodPressureRail[];
  readonly transition?: MoodTransitionWindow;
  readonly reasons: readonly string[];
  readonly evidence: readonly MoodEvidenceLine[];
  readonly audience: AudienceHeatDerivation;
  readonly aura: ReputationAuraDerivation;
}

export interface ChannelMoodPreviewBadge {
  readonly label: string;
  readonly value: string;
  readonly severity: MoodRiskBand;
}

export interface ChannelMoodPreview {
  readonly channelId: ChatVisibleChannel;
  readonly current: ChatChannelMood;
  readonly summary: ChannelMoodSummary;
  readonly badges: readonly ChannelMoodPreviewBadge[];
  readonly rails: readonly MoodPressureRail[];
  readonly reasons: readonly string[];
  readonly auraPreview: ReputationAuraPreview;
  readonly audiencePreview: AudienceHeatPreview;
}

export interface ChannelMoodMemoEntry {
  readonly derivation: ChannelMoodDerivation;
  readonly cachedAt: UnixMs;
  readonly inputHash: string;
}

export interface ChannelMoodChannelPolicy {
  readonly holdMs: number;
  readonly hostilityBias: number;
  readonly suspicionBias: number;
  readonly ecstasyBias: number;
  readonly predatoryBias: number;
  readonly mournfulBias: number;
  readonly calmBias: number;
  readonly swingSuppression: number;
  readonly silenceMultiplier: number;
  readonly witnessMultiplier: number;
  readonly relationshipMultiplier: number;
  readonly auraMultiplier: number;
  readonly volatilityMultiplier: number;
}

export interface ChannelMoodModelConfig {
  readonly clock?: ChannelMoodClock;
  readonly memoTtlMs?: number;
  readonly messageWindowSize?: number;
  readonly moodHoldMs?: number;
  readonly sameMoodReinforcement?: number;
  readonly oppositeMoodPenalty?: number;
  readonly scenePressureWeight?: number;
  readonly silencePressureWeight?: number;
  readonly transitionBreakoutWeight?: number;
  readonly witnessPressureWeight?: number;
  readonly relationshipWeight?: number;
  readonly auraWeight?: number;
  readonly channelPolicies?: Partial<Record<ChatVisibleChannel, Partial<ChannelMoodChannelPolicy>>>;
}

export interface ChannelMoodModelApi {
  deriveChannelMood(
    state: ChatEngineState,
    channelId: ChatVisibleChannel,
  ): ChannelMoodDerivation;

  deriveStateMoodMap(
    state: ChatEngineState,
  ): Readonly<Record<ChatVisibleChannel, ChannelMoodDerivation>>;

  reconcileState(
    state: ChatEngineState,
  ): ChatEngineState;

  previewChannelMood(
    state: ChatEngineState,
    channelId: ChatVisibleChannel,
  ): ChannelMoodPreview;

  clearMemo(): void;
}

const DEFAULT_CHANNEL_POLICY: ChannelMoodChannelPolicy = Object.freeze({
  holdMs: 8_000,
  hostilityBias: 0,
  suspicionBias: 0,
  ecstasyBias: 0,
  predatoryBias: 0,
  mournfulBias: 0,
  calmBias: 0,
  swingSuppression: 0.14,
  silenceMultiplier: 1,
  witnessMultiplier: 1,
  relationshipMultiplier: 1,
  auraMultiplier: 1,
  volatilityMultiplier: 1,
});

const CHANNEL_POLICIES: Readonly<Record<ChatVisibleChannel, ChannelMoodChannelPolicy>> = Object.freeze({
  GLOBAL: {
    ...DEFAULT_CHANNEL_POLICY,
    holdMs: 7_000,
    hostilityBias: 6,
    suspicionBias: 3,
    ecstasyBias: 5,
    predatoryBias: 0,
    mournfulBias: 3,
    calmBias: -2,
    swingSuppression: 0.11,
    silenceMultiplier: 0.88,
    witnessMultiplier: 1.35,
    relationshipMultiplier: 0.92,
    auraMultiplier: 1.1,
    volatilityMultiplier: 1.18,
  },
  SYNDICATE: {
    ...DEFAULT_CHANNEL_POLICY,
    holdMs: 9_500,
    hostilityBias: 1,
    suspicionBias: 7,
    ecstasyBias: -1,
    predatoryBias: 0,
    mournfulBias: 2,
    calmBias: 1,
    swingSuppression: 0.17,
    silenceMultiplier: 1.14,
    witnessMultiplier: 0.86,
    relationshipMultiplier: 1.28,
    auraMultiplier: 1.16,
    volatilityMultiplier: 0.92,
  },
  DEAL_ROOM: {
    ...DEFAULT_CHANNEL_POLICY,
    holdMs: 10_500,
    hostilityBias: -1,
    suspicionBias: 8,
    ecstasyBias: -8,
    predatoryBias: 13,
    mournfulBias: -2,
    calmBias: -4,
    swingSuppression: 0.19,
    silenceMultiplier: 1.2,
    witnessMultiplier: 0.7,
    relationshipMultiplier: 1.1,
    auraMultiplier: 1.22,
    volatilityMultiplier: 0.84,
  },
  LOBBY: {
    ...DEFAULT_CHANNEL_POLICY,
    holdMs: 6_500,
    hostilityBias: -2,
    suspicionBias: 2,
    ecstasyBias: 3,
    predatoryBias: -5,
    mournfulBias: 1,
    calmBias: 4,
    swingSuppression: 0.13,
    silenceMultiplier: 0.94,
    witnessMultiplier: 1,
    relationshipMultiplier: 0.82,
    auraMultiplier: 0.9,
    volatilityMultiplier: 0.9,
  },
});

const NEGATIVE_TERMS = Object.freeze([
  'fraud',
  'weak',
  'broke',
  'collapse',
  'fold',
  'done',
  'clown',
  'humiliated',
  'panic',
  'liquidated',
  'exposed',
  'desperate',
  'begging',
  'failed',
  'failure',
  'pathetic',
  'bleeding',
  'trash',
  'bankrupt',
  'wrecked',
] as const);

const POSITIVE_TERMS = Object.freeze([
  'clean',
  'sharp',
  'strong',
  'recovered',
  'comeback',
  'locked in',
  'disciplined',
  'perfect',
  'brilliant',
  'elite',
  'cold',
  'winning',
  'untouchable',
  'legend',
  'survived',
  'stable',
] as const);

const SUSPICION_TERMS = Object.freeze([
  'wait',
  'watch',
  'hmm',
  'really',
  'sure',
  'prove it',
  'show me',
  'bluff',
  'something off',
  'quiet',
  'reading',
  'tracking',
  'counting',
  'checking',
] as const);

const MOURNFUL_TERMS = Object.freeze([
  'damn',
  'rough',
  'that hurt',
  'gone',
  'lost it',
  'too late',
  'could have',
  'missed it',
  'what a fall',
  'brutal',
  'rip',
] as const);

const PREDATORY_TERMS = Object.freeze([
  'price',
  'offer',
  'counter',
  'terms',
  'liability',
  'risk',
  'binding',
  'bid',
  'take it',
  'walk',
  'clock',
  'deadline',
  'exposure',
] as const);

const ECSTATIC_TERMS = Object.freeze([
  'fire',
  'monster',
  'unreal',
  'clean',
  'insane',
  'let him cook',
  'let her cook',
  'crazy',
  'wild',
  'legend',
  'ice cold',
] as const);

function bodyIntensityScore(body: string): number {
  return clamp(
    body.length * 0.18 +
      countMatches(body, /!/g) * 5 +
      countMatches(body, /\?/g) * 2.5 +
      countMatches(body, /\b[A-Z]{3,}\b/g) * 7 +
      containsAny(body, NEGATIVE_TERMS) * 4 +
      containsAny(body, POSITIVE_TERMS) * 3 +
      containsAny(body, SUSPICION_TERMS) * 2,
    0,
    100,
  );
}

function inferMessageWitnessPressure(message: ChatMessage): number {
  const body = normalizeBody(message.body);
  const senderPressure =
    message.senderId.startsWith('npc:hater:')
      ? 18
      : message.senderId.startsWith('npc:helper:')
        ? 8
        : 6;

  const proofPressure = message.proofHash ? 12 : 0;
  const replayPressure = message.replay ? 10 : 0;
  const legendPressure = message.legend ? 16 : 0;
  const readPressure = (message.readReceipts?.length ?? 0) * 2.2;
  const tagsPressure = (message.tags?.length ?? 0) * 1.3;
  const scenePressure = message.sceneId ? 8 : 0;
  const relationshipPressure = (message.relationshipIds?.length ?? 0) * 3.5;
  const quotePressure = (message.quoteIds?.length ?? 0) * 4.4;
  const textPressure = bodyIntensityScore(body) * 0.32;

  return clamp(
    senderPressure +
      proofPressure +
      replayPressure +
      legendPressure +
      readPressure +
      tagsPressure +
      scenePressure +
      relationshipPressure +
      quotePressure +
      textPressure,
    0,
    100,
  );
}

function inferTextureVector(messages: readonly ChatMessage[]): {
  readonly hostility: number;
  readonly suspicion: number;
  readonly ecstasy: number;
  readonly mournfulness: number;
  readonly predation: number;
} {
  if (!messages.length) {
    return {
      hostility: 0,
      suspicion: 0,
      ecstasy: 0,
      mournfulness: 0,
      predation: 0,
    };
  }

  const hostilityScores: number[] = [];
  const suspicionScores: number[] = [];
  const ecstasyScores: number[] = [];
  const mournScores: number[] = [];
  const predationScores: number[] = [];

  for (const message of messages) {
    const body = normalizeBody(message.body).toLowerCase();

    hostilityScores.push(
      clamp(
        containsAny(body, NEGATIVE_TERMS) * 10 +
          countMatches(body, /!/g) * 4 +
          countAllCapsWords(body) * 4 +
          (message.senderId.startsWith('npc:hater:') ? 14 : 0),
        0,
        100,
      ),
    );

    suspicionScores.push(
      clamp(
        containsAny(body, SUSPICION_TERMS) * 10 +
          countMatches(body, /\?/g) * 5 +
          (message.channel === 'DEAL_ROOM' ? 8 : 0),
        0,
        100,
      ),
    );

    ecstasyScores.push(
      clamp(
        containsAny(body, POSITIVE_TERMS) * 7 +
          containsAny(body, ECSTATIC_TERMS) * 10 +
          countMatches(body, /!/g) * 3 +
          (message.legend ? 12 : 0),
        0,
        100,
      ),
    );

    mournScores.push(
      clamp(
        containsAny(body, MOURNFUL_TERMS) * 10 +
          (message.runOutcome === 'LOSS' ? 18 : 0) +
          (message.kind === 'POST_RUN_RITUAL' ? 10 : 0),
        0,
        100,
      ),
    );

    predationScores.push(
      clamp(
        containsAny(body, PREDATORY_TERMS) * 8 +
          (message.channel === 'DEAL_ROOM' ? 12 : 0) +
          (message.kind === 'NEGOTIATION_OFFER' || message.kind === 'NEGOTIATION_COUNTER' ? 18 : 0),
        0,
        100,
      ),
    );
  }

  return {
    hostility: avg(hostilityScores),
    suspicion: avg(suspicionScores),
    ecstasy: avg(ecstasyScores),
    mournfulness: avg(mournScores),
    predation: avg(predationScores),
  };
}

function inferRelationshipPressure(
  relationshipsByCounterpartId: Readonly<Record<string, ChatRelationshipState>>,
  channelId: ChatVisibleChannel,
): {
  readonly raw: number;
  readonly respect: number;
  readonly fear: number;
  readonly contempt: number;
  readonly trust: number;
  readonly rivalry: number;
  readonly rescueDebt: number;
} {
  const relationships = Object.values(relationshipsByCounterpartId);
  if (!relationships.length) {
    return {
      raw: 0,
      respect: 0,
      fear: 0,
      contempt: 0,
      trust: 0,
      rivalry: 0,
      rescueDebt: 0,
    };
  }

  const weights = channelId === 'SYNDICATE'
    ? { trust: 1.2, fear: 0.9, contempt: 0.7, rivalry: 1.15, rescueDebt: 1.18, respect: 1.1 }
    : channelId === 'DEAL_ROOM'
      ? { trust: 0.85, fear: 1.25, contempt: 0.94, rivalry: 1.02, rescueDebt: 0.75, respect: 0.9 }
      : channelId === 'GLOBAL'
        ? { trust: 0.82, fear: 1.1, contempt: 1.18, rivalry: 1.2, rescueDebt: 0.7, respect: 1.08 }
        : { trust: 1.02, fear: 0.8, contempt: 0.7, rivalry: 0.88, rescueDebt: 0.84, respect: 0.92 };

  const respect = avg(relationships.map((item) => scoreToNumber(item.vector.respect))) * weights.respect;
  const fear = avg(relationships.map((item) => scoreToNumber(item.vector.fear))) * weights.fear;
  const contempt = avg(relationships.map((item) => scoreToNumber(item.vector.contempt))) * weights.contempt;
  const trust = avg(relationships.map((item) => scoreToNumber(item.vector.trust))) * weights.trust;
  const rivalry = avg(relationships.map((item) => scoreToNumber(item.vector.rivalryIntensity))) * weights.rivalry;
  const rescueDebt = avg(relationships.map((item) => scoreToNumber(item.vector.rescueDebt))) * weights.rescueDebt;

  const escalationPressure =
    avg(
      relationships.map((item) => {
        switch (item.escalationTier) {
          case 'OBSESSIVE':
            return 100;
          case 'ACTIVE':
            return 68;
          case 'MILD':
            return 32;
          case 'NONE':
          default:
            return 0;
        }
      }),
    ) * (channelId === 'GLOBAL' ? 1.18 : 0.92);

  const raw = clamp(
    respect * 0.08 +
      fear * 0.18 +
      contempt * 0.2 +
      trust * 0.1 +
      rivalry * 0.22 +
      rescueDebt * 0.08 +
      escalationPressure * 0.14,
    0,
    100,
  );

  return {
    raw,
    respect: clamp(respect, 0, 100),
    fear: clamp(fear, 0, 100),
    contempt: clamp(contempt, 0, 100),
    trust: clamp(trust, 0, 100),
    rivalry: clamp(rivalry, 0, 100),
    rescueDebt: clamp(rescueDebt, 0, 100),
  };
}

function inferAuraPressure(
  reputation: ChatReputationState,
  channelId: ChatVisibleChannel,
): number {
  const publicAura = scoreToNumber(reputation.publicAura);
  const syndicateCredibility = scoreToNumber(reputation.syndicateCredibility);
  const negotiationFear = scoreToNumber(reputation.negotiationFear);
  const comebackRespect = scoreToNumber(reputation.comebackRespect);
  const humiliationRisk = scoreToNumber(reputation.humiliationRisk);

  if (channelId === 'GLOBAL') {
    return clamp(
      publicAura * 0.3 +
        comebackRespect * 0.27 +
        humiliationRisk * 0.23 +
        negotiationFear * 0.08 +
        syndicateCredibility * 0.12,
      0,
      100,
    );
  }
  if (channelId === 'SYNDICATE') {
    return clamp(
      syndicateCredibility * 0.44 +
        publicAura * 0.12 +
        comebackRespect * 0.18 +
        humiliationRisk * 0.1 +
        negotiationFear * 0.16,
      0,
      100,
    );
  }
  if (channelId === 'DEAL_ROOM') {
    return clamp(
      negotiationFear * 0.5 +
        humiliationRisk * 0.15 +
        publicAura * 0.1 +
        comebackRespect * 0.08 +
        syndicateCredibility * 0.17,
      0,
      100,
    );
  }
  return clamp(
    publicAura * 0.18 +
      comebackRespect * 0.14 +
      syndicateCredibility * 0.1 +
      humiliationRisk * 0.08 +
      negotiationFear * 0.07,
    0,
    100,
  );
}

function inferAffectPressure(affect: ChatAffectSnapshot): number {
  const vector = affect.vector;
  return clamp(
    scoreToNumber(vector.intimidation) * 0.16 +
      scoreToNumber(vector.confidence) * 0.12 +
      scoreToNumber(vector.frustration) * 0.16 +
      scoreToNumber(vector.curiosity) * 0.05 +
      scoreToNumber(vector.attachment) * 0.06 +
      scoreToNumber(vector.socialEmbarrassment) * 0.18 +
      scoreToNumber(vector.relief) * 0.03 +
      scoreToNumber(vector.dominance) * 0.09 +
      scoreToNumber(vector.desperation) * 0.12 +
      scoreToNumber(vector.trust) * 0.03 +
      Math.abs(affect.confidenceSwingDelta) * 0.45,
    0,
    100,
  );
}

function inferScenePressure(
  activeScene: ChatScenePlan | undefined,
  channelId: ChatVisibleChannel,
): number {
  if (!activeScene) return 0;

  const beatPressure = avg(
    activeScene.beats
      .filter((beat) => beat.requiredChannel === channelId)
      .map((beat) => {
        const base =
          beat.beatType === 'CROWD_SWARM'
            ? 92
            : beat.beatType === 'HELPER_INTERVENTION'
              ? 58
              : beat.beatType === 'HATER_ENTRY'
                ? 80
                : beat.beatType === 'SYSTEM_NOTICE'
                  ? 32
                  : beat.beatType === 'SILENCE'
                    ? 24
                    : beat.beatType === 'REVEAL'
                      ? 66
                      : beat.beatType === 'PLAYER_REPLY_WINDOW'
                        ? 52
                        : 34;
        return base + (beat.canInterrupt ? 5 : 0) - (beat.skippable ? 6 : 0);
      }),
  );

  return clamp(
    beatPressure +
      (activeScene.summarySeverity === 'CRITICAL' ? 14 : activeScene.summarySeverity === 'HIGH' ? 8 : 0),
    0,
    100,
  );
}

function inferSilencePressure(
  silence: ChatEngineState['currentSilence'],
  channelId: ChatVisibleChannel,
  now: number,
): number {
  if (!silence) return 0;
  if (silence.channelId !== channelId) return 0;

  const msRemaining = Math.max(0, silence.until - now);
  const duration = Math.max(1, silence.until - silence.startedAt);
  const progressed = ratio(duration - msRemaining, duration);

  return clamp(
    20 +
      progressed * 55 +
      (silence.reason.includes('collapse') ? 12 : 0) +
      (silence.reason.includes('rescue') ? 8 : 0) +
      (silence.reason.includes('dramatic') ? 10 : 0),
    0,
    100,
  );
}

function inferLiveOpsPressure(
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
): number {
  const affected = state.liveOps.activeWorldEvents.filter((item) =>
    item.affectedChannels.includes(channelId),
  );

  if (!affected.length) return 0;

  return clamp(
    avg(
      affected.map((item) => {
        const severity = scoreToNumber(item.urgencyScore);
        const worldScale = item.isGlobal ? 14 : 0;
        const lock = item.restrictsComposer ? 10 : 0;
        return severity + worldScale + lock;
      }),
    ),
    0,
    100,
  );
}

function inferNegotiationPressure(state: ChatEngineState, channelId: ChatVisibleChannel): number {
  if (channelId !== 'DEAL_ROOM' || !state.offerState) return 0;
  return clamp(
    scoreToNumber(state.offerState.bluffPressure) * 0.34 +
      scoreToNumber(state.offerState.counterpartyUrgency) * 0.32 +
      scoreToNumber(state.offerState.playerUrgency) * 0.21 +
      scoreToNumber(state.offerState.exposureRisk) * 0.22,
    0,
    100,
  );
}

const MOODS: readonly ChatChannelMood['mood'][] = [
  'CALM',
  'SUSPICIOUS',
  'HOSTILE',
  'ECSTATIC',
  'PREDATORY',
  'MOURNFUL',
] as const;

function classifyRisk(score: number): MoodRiskBand {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 35) return 'MEDIUM';
  return 'LOW';
}

function classifyStability(holdRatio: number, volatility: number, transitionMagnitude: number): MoodStabilityBand {
  if (holdRatio >= 0.85 && volatility <= 22 && transitionMagnitude <= 12) return 'LOCKED';
  if (holdRatio >= 0.55 && volatility <= 42 && transitionMagnitude <= 24) return 'STABLE';
  if (holdRatio >= 0.25 && volatility <= 62) return 'SETTLING';
  return 'FRAGILE';
}

function transitionSeverity(magnitude: number, ceremonial: boolean): MoodTransitionSeverity {
  if (ceremonial || magnitude >= 42) return 'CEREMONIAL';
  if (magnitude >= 26) return 'HEAVY';
  if (magnitude >= 14) return 'MODERATE';
  return 'LIGHT';
}

function describeDominantAxis(axis: MoodPressureAxis): string {
  switch (axis) {
    case 'HEAT':
      return 'ambient crowd temperature';
    case 'HYPE':
      return 'celebratory surge';
    case 'RIDICULE':
      return 'public mockery pressure';
    case 'SCRUTINY':
      return 'social scrutiny pressure';
    case 'VOLATILITY':
      return 'swing risk and instability';
    case 'WITNESS':
      return 'witness density';
    case 'RELATIONSHIP':
      return 'relationship carryover';
    case 'REPUTATION':
      return 'standing and social memory';
    case 'AFFECT':
      return 'player affect pressure';
    case 'SCENE':
      return 'scene-authored pressure';
    case 'SILENCE':
      return 'intentional silence pressure';
    case 'LIVEOPS':
      return 'world-event pressure';
    case 'NEGOTIATION':
      return 'deal pressure';
    default:
      return 'pressure';
  }
}

function moodBaseScoresFromTexture(
  channelId: ChatVisibleChannel,
  heat: ChatAudienceHeat,
  texture: ReturnType<typeof inferTextureVector>,
  relationship: ReturnType<typeof inferRelationshipPressure>,
  auraPressure: number,
  affectPressure: number,
  scenePressure: number,
  silencePressure: number,
  liveOpsPressure: number,
  negotiationPressure: number,
  policy: ChannelMoodChannelPolicy,
): Record<ChatChannelMood['mood'], number> {
  const heatScore = scoreToNumber(heat.heat);
  const hypeScore = scoreToNumber(heat.hype);
  const ridiculeScore = scoreToNumber(heat.ridicule);
  const scrutinyScore = scoreToNumber(heat.scrutiny);
  const volatilityScore = scoreToNumber(heat.volatility);

  const calm =
    42 +
    policy.calmBias +
    (100 - heatScore) * 0.16 +
    (100 - volatilityScore) * 0.18 +
    (100 - scrutinyScore) * 0.1 -
    texture.hostility * 0.18 -
    scenePressure * 0.12 -
    negotiationPressure * 0.14;

  const suspicious =
    10 +
    policy.suspicionBias +
    scrutinyScore * 0.34 +
    texture.suspicion * 0.32 +
    silencePressure * 0.22 * policy.silenceMultiplier +
    relationship.fear * 0.08 +
    auraPressure * 0.06 +
    volatilityScore * 0.1;

  const hostile =
    6 +
    policy.hostilityBias +
    ridiculeScore * 0.33 +
    texture.hostility * 0.36 +
    relationship.contempt * 0.13 +
    relationship.rivalry * 0.12 * policy.relationshipMultiplier +
    affectPressure * 0.08 +
    liveOpsPressure * 0.08 +
    volatilityScore * 0.12 * policy.volatilityMultiplier;

  const ecstatic =
    4 +
    policy.ecstasyBias +
    hypeScore * 0.42 +
    texture.ecstasy * 0.36 +
    relationship.respect * 0.1 +
    auraPressure * 0.1 +
    (channelId === 'GLOBAL' ? scoreToNumber(heat.heat) * 0.08 : 0);

  const predatory =
    4 +
    policy.predatoryBias +
    (channelId === 'DEAL_ROOM' ? 18 : 0) +
    scrutinyScore * 0.18 +
    texture.predation * 0.42 +
    negotiationPressure * 0.34 +
    relationship.fear * 0.08 +
    volatilityScore * 0.08;

  const mournful =
    2 +
    policy.mournfulBias +
    texture.mournfulness * 0.46 +
    (100 - hypeScore) * 0.04 +
    scenePressure * 0.08 +
    silencePressure * 0.12 +
    affectPressure * 0.12 +
    scoreToNumber(heat.ridicule) * 0.05;

  return {
    CALM: clamp(calm, 0, 100),
    SUSPICIOUS: clamp(suspicious, 0, 100),
    HOSTILE: clamp(hostile, 0, 100),
    ECSTATIC: clamp(ecstatic, 0, 100),
    PREDATORY: clamp(predatory, 0, 100),
    MOURNFUL: clamp(mournful, 0, 100),
  };
}

function applyTransitionContinuity(
  previous: ChatChannelMood,
  base: Record<ChatChannelMood['mood'], number>,
  now: number,
  policy: ChannelMoodChannelPolicy,
  config: Required<Pick<ChannelMoodModelConfig, 'sameMoodReinforcement' | 'oppositeMoodPenalty' | 'moodHoldMs'>>,
): Record<ChatChannelMood['mood'], number> {
  const elapsed = Math.max(0, now - previous.updatedAt);
  const holdRatio = clamp(1 - elapsed / Math.max(1, policy.holdMs || config.moodHoldMs), 0, 1);

  const reinforced = { ...base };
  reinforced[previous.mood] = clamp(
    reinforced[previous.mood] + holdRatio * config.sameMoodReinforcement,
    0,
    100,
  );

  const oppositions: Partial<Record<ChatChannelMood['mood'], readonly ChatChannelMood['mood'][]>> = {
    CALM: ['HOSTILE', 'ECSTATIC', 'PREDATORY'],
    HOSTILE: ['CALM', 'ECSTATIC'],
    ECSTATIC: ['MOURNFUL', 'PREDATORY'],
    SUSPICIOUS: ['CALM'],
    PREDATORY: ['ECSTATIC', 'CALM'],
    MOURNFUL: ['ECSTATIC'],
  };

  for (const opposing of oppositions[previous.mood] ?? []) {
    reinforced[opposing] = clamp(
      reinforced[opposing] - holdRatio * config.oppositeMoodPenalty,
      0,
      100,
    );
  }

  return reinforced;
}

function pickDominantMood(scores: Record<ChatChannelMood['mood'], number>): ChatChannelMood['mood'] {
  let topMood: ChatChannelMood['mood'] = 'CALM';
  let topScore = -1;

  for (const mood of MOODS) {
    const score = scores[mood];
    if (score > topScore) {
      topScore = score;
      topMood = mood;
    }
  }

  return topMood;
}

function dominantAxisFromRails(rails: readonly MoodPressureRail[]): MoodPressureAxis {
  return [...rails]
    .sort((a, b) => b.score - a.score)[0]?.axis ?? 'HEAT';
}

function buildRails(
  heat: ChatAudienceHeat,
  audienceSummary: AudienceHeatSignalSummary,
  relationship: ReturnType<typeof inferRelationshipPressure>,
  auraPressure: number,
  affectPressure: number,
  scenePressure: number,
  silencePressure: number,
  liveOpsPressure: number,
  negotiationPressure: number,
): readonly MoodPressureRail[] {
  const rails: MoodPressureRail[] = [
    { axis: 'HEAT', score: scoreToNumber(heat.heat), label: 'Heat', description: 'aggregate public channel intensity', severity: classifyRisk(scoreToNumber(heat.heat)) },
    { axis: 'HYPE', score: scoreToNumber(heat.hype), label: 'Hype', description: 'celebratory and amplifying pressure', severity: classifyRisk(scoreToNumber(heat.hype)) },
    { axis: 'RIDICULE', score: scoreToNumber(heat.ridicule), label: 'Ridicule', description: 'mockery, humiliation, and swarm scorn', severity: classifyRisk(scoreToNumber(heat.ridicule)) },
    { axis: 'SCRUTINY', score: scoreToNumber(heat.scrutiny), label: 'Scrutiny', description: 'measured suspicion and watchfulness', severity: classifyRisk(scoreToNumber(heat.scrutiny)) },
    { axis: 'VOLATILITY', score: scoreToNumber(heat.volatility), label: 'Volatility', description: 'swing risk and instability', severity: classifyRisk(scoreToNumber(heat.volatility)) },
    { axis: 'WITNESS', score: audienceSummary.witnessPressure, label: 'Witness', description: 'how many eyes the room feels like it has', severity: classifyRisk(audienceSummary.witnessPressure) },
    { axis: 'RELATIONSHIP', score: relationship.raw, label: 'Relationship', description: 'carryover trust, contempt, fear, rivalry, and rescue debt', severity: classifyRisk(relationship.raw) },
    { axis: 'REPUTATION', score: auraPressure, label: 'Aura', description: 'standing and social memory pressure', severity: classifyRisk(auraPressure) },
    { axis: 'AFFECT', score: affectPressure, label: 'Affect', description: 'player emotional signal pressure', severity: classifyRisk(affectPressure) },
    { axis: 'SCENE', score: scenePressure, label: 'Scene', description: 'authored beat pressure', severity: classifyRisk(scenePressure) },
    { axis: 'SILENCE', score: silencePressure, label: 'Silence', description: 'intentional non-response pressure', severity: classifyRisk(silencePressure) },
    { axis: 'LIVEOPS', score: liveOpsPressure, label: 'LiveOps', description: 'global/world event pressure', severity: classifyRisk(liveOpsPressure) },
    { axis: 'NEGOTIATION', score: negotiationPressure, label: 'Negotiation', description: 'deal-room price pressure', severity: classifyRisk(negotiationPressure) },
  ];
  return rails;
}

function buildReasons(
  channelId: ChatVisibleChannel,
  mood: ChatChannelMood['mood'],
  dominantAxis: MoodPressureAxis,
  audience: AudienceHeatDerivation,
  aura: ReputationAuraDerivation,
  relationship: ReturnType<typeof inferRelationshipPressure>,
  scenePressure: number,
  silencePressure: number,
  negotiationPressure: number,
): readonly string[] {
  const reasons: string[] = [];
  reasons.push(`${channelId.toLowerCase()} settled into ${mood.toLowerCase()} weather`);
  reasons.push(`dominant driver: ${describeDominantAxis(dominantAxis)}`);
  reasons.push(audience.mood.reason);
  const dominantAura = aura.preview.badges[0]?.label?.toLowerCase() ?? 'aura';
  reasons.push(`aura pressure colored by ${dominantAura}`);
  if (relationship.raw >= 35) reasons.push(`relationship carryover active: fear ${Math.round(relationship.fear)}, contempt ${Math.round(relationship.contempt)}, rivalry ${Math.round(relationship.rivalry)}`);
  if (scenePressure >= 35) reasons.push(`scene pressure elevated at ${Math.round(scenePressure)}`);
  if (silencePressure >= 30) reasons.push(`intentional silence shaped the room at ${Math.round(silencePressure)}`);
  if (negotiationPressure >= 28) reasons.push(`deal pressure visible at ${Math.round(negotiationPressure)}`);
  return reasons;
}

function buildEvidence(
  rails: readonly MoodPressureRail[],
  mood: ChatChannelMood['mood'],
  previous: ChatChannelMood,
  currentScores: Record<ChatChannelMood['mood'], number>,
): readonly MoodEvidenceLine[] {
  const topRails = [...rails].sort((a, b) => b.score - a.score).slice(0, 5);

  const evidence: MoodEvidenceLine[] = topRails.map((rail) => ({
    weight: rail.score,
    label: rail.label,
    why: `${rail.label} pushed ${mood.toLowerCase()} pressure because ${rail.description}`,
  }));

  if (previous.mood !== mood) {
    evidence.push({
      weight: Math.abs((currentScores[mood] ?? 0) - (currentScores[previous.mood] ?? 0)),
      label: 'Transition',
      why: `${previous.mood.toLowerCase()} gave way to ${mood.toLowerCase()} as score delta widened`,
    });
  }

  return evidence;
}

function hashDerivationInputs(
  channelId: ChatVisibleChannel,
  state: ChatEngineState,
): string {
  const heat = state.audienceHeat[channelId];
  const mood = state.channelMoodByChannel[channelId];
  const messages = state.messagesByChannel[channelId];
  const lastMessage = messages[messages.length - 1];
  const relationshipIds = Object.keys(state.relationshipsByCounterpartId).sort();
  const worldEvents = state.liveOps.activeWorldEvents
    .filter((item) => item.affectedChannels.includes(channelId))
    .map((item) => `${item.id}:${item.urgencyScore}`)
    .join('|');

  return [
    channelId,
    heat.heat,
    heat.hype,
    heat.ridicule,
    heat.scrutiny,
    heat.volatility,
    heat.lastUpdatedAt,
    mood?.mood ?? 'NONE',
    mood?.reason ?? '',
    mood?.updatedAt ?? 0,
    state.activeScene?.sceneId ?? 'NO_SCENE',
    state.currentSilence?.channelId === channelId ? state.currentSilence.until : 0,
    state.reputation.publicAura,
    state.reputation.syndicateCredibility,
    state.reputation.negotiationFear,
    state.reputation.comebackRespect,
    state.reputation.humiliationRisk,
    state.affect.lastUpdatedAt,
    state.affect.dominantEmotion,
    state.affect.confidenceSwingDelta,
    state.learningProfile?.archetype ?? 'NO_ARCHETYPE',
    lastMessage?.id ?? 'NO_MESSAGE',
    lastMessage?.ts ?? 0,
    relationshipIds.join(','),
    worldEvents,
  ].join('::');
}

export class ChannelMoodModel implements ChannelMoodModelApi {
  private readonly clock: ChannelMoodClock;
  private readonly memoTtlMs: number;
  private readonly messageWindowSize: number;
  private readonly moodHoldMs: number;
  private readonly sameMoodReinforcement: number;
  private readonly oppositeMoodPenalty: number;
  private readonly scenePressureWeight: number;
  private readonly silencePressureWeight: number;
  private readonly transitionBreakoutWeight: number;
  private readonly witnessPressureWeight: number;
  private readonly relationshipWeight: number;
  private readonly auraWeight: number;
  private readonly audienceEngine = createAudienceHeatEngine();
  private readonly auraEngine = createReputationAura();
  private readonly memo = new Map<ChatVisibleChannel, ChannelMoodMemoEntry>();
  private readonly channelPolicies: Readonly<Record<ChatVisibleChannel, ChannelMoodChannelPolicy>>;

  public constructor(config: ChannelMoodModelConfig = {}) {
    this.clock = config.clock ?? DEFAULT_CLOCK;
    this.memoTtlMs = config.memoTtlMs ?? 2_000;
    this.messageWindowSize = config.messageWindowSize ?? 18;
    this.moodHoldMs = config.moodHoldMs ?? 8_000;
    this.sameMoodReinforcement = config.sameMoodReinforcement ?? 16;
    this.oppositeMoodPenalty = config.oppositeMoodPenalty ?? 12;
    this.scenePressureWeight = config.scenePressureWeight ?? 1;
    this.silencePressureWeight = config.silencePressureWeight ?? 1;
    this.transitionBreakoutWeight = config.transitionBreakoutWeight ?? 0.8;
    this.witnessPressureWeight = config.witnessPressureWeight ?? 1;
    this.relationshipWeight = config.relationshipWeight ?? 1;
    this.auraWeight = config.auraWeight ?? 1;

    this.channelPolicies = Object.freeze({
      GLOBAL: { ...CHANNEL_POLICIES.GLOBAL, ...(config.channelPolicies?.GLOBAL ?? {}) },
      SYNDICATE: { ...CHANNEL_POLICIES.SYNDICATE, ...(config.channelPolicies?.SYNDICATE ?? {}) },
      DEAL_ROOM: { ...CHANNEL_POLICIES.DEAL_ROOM, ...(config.channelPolicies?.DEAL_ROOM ?? {}) },
      LOBBY: { ...CHANNEL_POLICIES.LOBBY, ...(config.channelPolicies?.LOBBY ?? {}) },
    });
  }

  public clearMemo(): void {
    this.memo.clear();
  }

  public deriveChannelMood(
    state: ChatEngineState,
    channelId: ChatVisibleChannel,
  ): ChannelMoodDerivation {
    const now = this.clock.now();
    const inputHash = hashDerivationInputs(channelId, state);
    const cached = this.memo.get(channelId);

    if (cached && now - cached.cachedAt <= this.memoTtlMs && cached.inputHash === inputHash) {
      return cached.derivation;
    }

    const policy = this.channelPolicies[channelId];
    const previous = state.channelMoodByChannel[channelId];
    const audience = this.audienceEngine.deriveChannelHeat(state, channelId);
    const aura = this.auraEngine.derive(state);
    const heat = audience.next;

    const messages = state.messagesByChannel[channelId].slice(-this.messageWindowSize);
    const texture = inferTextureVector(messages);
    const relationship = inferRelationshipPressure(state.relationshipsByCounterpartId, channelId);
    const auraPressure = inferAuraPressure(aura.next, channelId) * policy.auraMultiplier * this.auraWeight;
    const affectPressure = inferAffectPressure(state.affect);
    const scenePressure = inferScenePressure(state.activeScene, channelId) * this.scenePressureWeight;
    const silencePressure = inferSilencePressure(state.currentSilence, channelId, now) * policy.silenceMultiplier * this.silencePressureWeight;
    const liveOpsPressure = inferLiveOpsPressure(state, channelId);
    const negotiationPressure = inferNegotiationPressure(state, channelId);

    const rails = buildRails(
      heat,
      audience.summary,
      relationship,
      auraPressure,
      affectPressure,
      scenePressure,
      silencePressure,
      liveOpsPressure,
      negotiationPressure,
    );

    const baseScores = moodBaseScoresFromTexture(
      channelId,
      heat,
      texture,
      relationship,
      auraPressure,
      affectPressure,
      scenePressure,
      silencePressure,
      liveOpsPressure,
      negotiationPressure,
      policy,
    );

    const reinforcedScores = applyTransitionContinuity(
      previous,
      baseScores,
      now,
      policy,
      {
        moodHoldMs: this.moodHoldMs,
        sameMoodReinforcement: this.sameMoodReinforcement,
        oppositeMoodPenalty: this.oppositeMoodPenalty,
      },
    );

    const dominantMood = pickDominantMood(reinforcedScores);
    const dominantScore = reinforcedScores[dominantMood];
    const secondBest = [...MOODS]
      .filter((mood) => mood !== dominantMood)
      .map((mood) => reinforcedScores[mood])
      .sort((a, b) => b - a)[0] ?? 0;
    const transitionMagnitude = clamp(dominantScore - secondBest, 0, 100);
    const holdRatio = clamp(1 - Math.max(0, now - previous.updatedAt) / Math.max(1, policy.holdMs), 0, 1);
    const stability = classifyStability(holdRatio, scoreToNumber(heat.volatility), transitionMagnitude);

    const next: ChatChannelMood = {
      channelId,
      mood: dominantMood,
      reason: '',
      updatedAt: asUnixMs(now),
    };

    const transition =
      previous.mood !== dominantMood
        ? {
            from: previous.mood,
            to: dominantMood,
            changedAt: asUnixMs(now),
            severity: transitionSeverity(
              transitionMagnitude * this.transitionBreakoutWeight,
              audience.summary.scenePressure >= 75 || messages.some((m) => Boolean(m.legend)),
            ),
            reasons: [
              `${previous.mood.toLowerCase()} yielded to ${dominantMood.toLowerCase()}`,
              `dominant score ${Math.round(dominantScore)} vs second ${Math.round(secondBest)}`,
            ],
          }
        : undefined;

    const dominantAxis = dominantAxisFromRails(rails);
    next.reason = buildReasons(
      channelId,
      dominantMood,
      dominantAxis,
      audience,
      aura,
      relationship,
      scenePressure,
      silencePressure,
      negotiationPressure,
    )[0] ?? `${channelId.toLowerCase()} mood stable`;

    const summary: ChannelMoodSummary = {
      channelId,
      dominantAxis,
      dominantAxisScore: [...rails].sort((a, b) => b.score - a.score)[0]?.score ?? 0,
      stability,
      transitionRisk: classifyRisk(transitionMagnitude),
      witnessPressure: audience.summary.witnessPressure,
      relationshipPressure: relationship.raw,
      auraPressure,
      silencePressure,
      scenePressure,
      negotiationPressure,
      localTexturePressure: clamp(
        texture.hostility * 0.24 +
          texture.suspicion * 0.22 +
          texture.ecstasy * 0.18 +
          texture.mournfulness * 0.12 +
          texture.predation * 0.24,
        0,
        100,
      ),
    };

    const reasons = buildReasons(
      channelId,
      dominantMood,
      dominantAxis,
      audience,
      aura,
      relationship,
      scenePressure,
      silencePressure,
      negotiationPressure,
    );

    const evidence = buildEvidence(rails, dominantMood, previous, reinforcedScores);

    const derivation: ChannelMoodDerivation = {
      channelId,
      next,
      previous,
      summary,
      rails,
      transition,
      reasons,
      evidence,
      audience,
      aura,
    };

    this.memo.set(channelId, {
      derivation,
      cachedAt: asUnixMs(now),
      inputHash,
    });

    return derivation;
  }

  public deriveStateMoodMap(
    state: ChatEngineState,
  ): Readonly<Record<ChatVisibleChannel, ChannelMoodDerivation>> {
    const entries = CHAT_VISIBLE_CHANNELS.map((channelId) => [
      channelId,
      this.deriveChannelMood(state, channelId),
    ]) as readonly (readonly [ChatVisibleChannel, ChannelMoodDerivation])[];

    return Object.freeze(
      Object.fromEntries(entries) as Record<ChatVisibleChannel, ChannelMoodDerivation>,
    );
  }

  public reconcileState(
    state: ChatEngineState,
  ): ChatEngineState {
    let next = cloneChatEngineState(state);

    for (const channelId of CHAT_VISIBLE_CHANNELS) {
      const derivation = this.deriveChannelMood(next, channelId);
      next = setChannelMoodInState(
        next,
        channelId,
        derivation.next.mood,
        derivation.reasons.join(' · '),
        derivation.next.updatedAt,
      );
    }

    return next;
  }

  public previewChannelMood(
    state: ChatEngineState,
    channelId: ChatVisibleChannel,
  ): ChannelMoodPreview {
    const derivation = this.deriveChannelMood(state, channelId);

    const badges: ChannelMoodPreviewBadge[] = [
      { label: 'Mood', value: derivation.next.mood, severity: derivation.summary.transitionRisk },
      {
        label: 'Stability',
        value: derivation.summary.stability,
        severity:
          derivation.summary.stability === 'LOCKED'
            ? 'LOW'
            : derivation.summary.stability === 'STABLE'
              ? 'MEDIUM'
              : derivation.summary.stability === 'SETTLING'
                ? 'HIGH'
                : 'CRITICAL',
      },
      { label: 'Dominant axis', value: derivation.summary.dominantAxis, severity: classifyRisk(derivation.summary.dominantAxisScore) },
      { label: 'Witness pressure', value: String(Math.round(derivation.summary.witnessPressure)), severity: classifyRisk(derivation.summary.witnessPressure) },
      { label: 'Aura pressure', value: String(Math.round(derivation.summary.auraPressure)), severity: classifyRisk(derivation.summary.auraPressure) },
      { label: 'Relationship pressure', value: String(Math.round(derivation.summary.relationshipPressure)), severity: classifyRisk(derivation.summary.relationshipPressure) },
    ];

    return {
      channelId,
      current: derivation.next,
      summary: derivation.summary,
      badges,
      rails: derivation.rails,
      reasons: derivation.reasons,
      auraPreview: this.auraEngine.preview(state),
      audiencePreview: this.audienceEngine.preview(state, channelId),
    };
  }
}

export function createChannelMoodModel(
  config: ChannelMoodModelConfig = {},
): ChannelMoodModel {
  return new ChannelMoodModel(config);
}

export function deriveChannelMood(
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
  config: ChannelMoodModelConfig = {},
): ChannelMoodDerivation {
  return createChannelMoodModel(config).deriveChannelMood(state, channelId);
}

export function deriveStateChannelMoodMap(
  state: ChatEngineState,
  config: ChannelMoodModelConfig = {},
): Readonly<Record<ChatVisibleChannel, ChannelMoodDerivation>> {
  return createChannelMoodModel(config).deriveStateMoodMap(state);
}

export function reconcileChannelMoodState(
  state: ChatEngineState,
  config: ChannelMoodModelConfig = {},
): ChatEngineState {
  return createChannelMoodModel(config).reconcileState(state);
}

export function previewChannelMood(
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
  config: ChannelMoodModelConfig = {},
): ChannelMoodPreview {
  return createChannelMoodModel(config).previewChannelMood(state, channelId);
}

export interface ChannelMoodDiagnostic {
  readonly channelId: ChatVisibleChannel;
  readonly mood: ChatChannelMood['mood'];
  readonly stability: MoodStabilityBand;
  readonly transitionRisk: MoodRiskBand;
  readonly dominantAxis: MoodPressureAxis;
  readonly dominantAxisScore: number;
  readonly topReasons: readonly string[];
  readonly railSnapshot: Readonly<Record<MoodPressureAxis, number>>;
}

export function buildChannelMoodDiagnostics(
  state: ChatEngineState,
  config: ChannelMoodModelConfig = {},
): readonly ChannelMoodDiagnostic[] {
  const model = createChannelMoodModel(config);
  return CHAT_VISIBLE_CHANNELS.map((channelId) => {
    const derivation = model.deriveChannelMood(state, channelId);
    return {
      channelId,
      mood: derivation.next.mood,
      stability: derivation.summary.stability,
      transitionRisk: derivation.summary.transitionRisk,
      dominantAxis: derivation.summary.dominantAxis,
      dominantAxisScore: derivation.summary.dominantAxisScore,
      topReasons: derivation.reasons.slice(0, 4),
      railSnapshot: derivation.rails.reduce<Partial<Record<MoodPressureAxis, number>>>(
        (acc, rail) => {
          acc[rail.axis] = rail.score;
          return acc;
        },
        {},
      ) as Readonly<Record<MoodPressureAxis, number>>,
    };
  });
}

export interface MoodPresentationPolicy {
  readonly headline: string;
  readonly body: string;
  readonly threatEdge: number;
  readonly softness: number;
  readonly allowCrowdCopy: boolean;
  readonly allowHelperCopy: boolean;
  readonly allowHaterCopy: boolean;
}

export function describeMoodPolicy(
  mood: ChatChannelMood['mood'],
  channelId: ChatVisibleChannel,
): MoodPresentationPolicy {
  switch (mood) {
    case 'HOSTILE':
      return {
        headline: `${channelId} is openly hostile`,
        body: 'Use sharper crowd framing, faster taunts, and witness-heavy copy.',
        threatEdge: 88,
        softness: 6,
        allowCrowdCopy: true,
        allowHelperCopy: true,
        allowHaterCopy: true,
      };
    case 'SUSPICIOUS':
      return {
        headline: `${channelId} is suspicious`,
        body: 'Favor watching language, delayed reads, measured scrutiny, and proof-check framing.',
        threatEdge: 58,
        softness: 18,
        allowCrowdCopy: true,
        allowHelperCopy: true,
        allowHaterCopy: true,
      };
    case 'ECSTATIC':
      return {
        headline: `${channelId} is ecstatic`,
        body: 'Push celebration, amplification, bragging rights, and momentum theater.',
        threatEdge: 20,
        softness: 42,
        allowCrowdCopy: true,
        allowHelperCopy: true,
        allowHaterCopy: false,
      };
    case 'PREDATORY':
      return {
        headline: `${channelId} is predatory`,
        body: 'Favor cold pricing language, deadline pressure, leverage posture, and quiet threat.',
        threatEdge: 74,
        softness: 8,
        allowCrowdCopy: false,
        allowHelperCopy: true,
        allowHaterCopy: true,
      };
    case 'MOURNFUL':
      return {
        headline: `${channelId} is mournful`,
        body: 'Let the room grieve the turn, explain the fall, and respect the echo.',
        threatEdge: 26,
        softness: 52,
        allowCrowdCopy: true,
        allowHelperCopy: true,
        allowHaterCopy: false,
      };
    case 'CALM':
    default:
      return {
        headline: `${channelId} is calm`,
        body: 'Keep copy measured, ambient, and low-noise. Preserve room for future pressure.',
        threatEdge: 8,
        softness: 32,
        allowCrowdCopy: true,
        allowHelperCopy: true,
        allowHaterCopy: false,
      };
  }
}

export function getChannelMoodPolicy(
  channelId: ChatVisibleChannel,
): ChannelMoodChannelPolicy {
  return CHANNEL_POLICIES[channelId];
}
