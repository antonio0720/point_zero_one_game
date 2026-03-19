/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT SOCIAL HEAT ENGINE
 * FILE: pzo-web/src/engines/chat/social/AudienceHeatEngine.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Frontend-owned audience heat runtime for the new canonical chat lane.
 *
 * This file intentionally lives in the pzo-web runtime rather than /shared
 * because it is a stateful, decision-making engine:
 * - shared contracts define the law
 * - backend owns authoritative archival and long-range inference
 * - frontend owns immediacy, pacing, and local theatrical feedback
 *
 * Design laws
 * -----------
 * - Preserve the existing ChatEngine state shape and update semantics.
 * - Do not fabricate simulation facts; react to chat/runtime truth only.
 * - Keep channel identity distinct:
 *   GLOBAL     = theatrical, swarmy, witness-heavy
 *   SYNDICATE  = intimate, tactical, credibility-sensitive
 *   DEAL_ROOM  = predatory, quiet, scrutiny-heavy
 *   LOBBY      = ambient, stage-setting, lower consequence
 * - Heat is not just one number. It is a vector:
 *   heat, hype, ridicule, scrutiny, volatility
 * - Output must fit directly into ChatEngineState.audienceHeat and
 *   ChatEngineState.channelMoodByChannel with minimal adapter glue.
 *
 * Notes
 * -----
 * This runtime is designed to be used by:
 * - ChatEngine.ts
 * - ChatBotResponseDirector.ts
 * - future social preview / HUD overlays
 * - future frontend continuity / scene / reward layers
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
  type ChatLiveOpsState,
  type ChatMessage,
  type ChatMessageKind,
  type ChatNegotiationState,
  type ChatRelationshipState,
  type ChatSceneBeatType,
  type ChatScenePlan,
  type ChatVisibleChannel,
  type Score100,
  type UnixMs,
} from '../types';
import {
  cloneChatEngineState,
  setAudienceHeatInState,
  setChannelMoodInState,
} from '../ChatState';

/* ============================================================================
 * MARK: Brands, clocks, and numeric helpers
 * ============================================================================
 */

export interface AudienceHeatClock {
  now(): number;
}

const DEFAULT_CLOCK: AudienceHeatClock = {
  now: () => Date.now(),
};

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function asUnixMs(value: number): UnixMs {
  return Math.trunc(clamp(value, 0, Number.MAX_SAFE_INTEGER)) as UnixMs;
}

function asScore100(value: number): Score100 {
  return Math.round(clamp(value, 0, 100)) as Score100;
}

function scoreToNumber(value: Score100 | number | undefined): number {
  if (typeof value !== 'number') return 0;
  return clamp(value, 0, 100);
}

function unixToNumber(value: UnixMs | number | undefined): number {
  if (typeof value !== 'number') return 0;
  return Math.max(0, Math.trunc(value));
}

function avg(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function maxOf(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((max, v) => (v > max ? v : max), values[0] ?? 0);
}

function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return ((sorted[half - 1] ?? 0) + (sorted[half] ?? 0)) / 2;
  return sorted[half] ?? 0;
}

function normalizeBody(body: string | undefined): string {
  return (body ?? '').trim();
}

function countMatches(body: string, pattern: RegExp): number {
  const matches = body.match(pattern);
  return matches ? matches.length : 0;
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

function countExclamations(body: string): number {
  return countMatches(body, /!/g);
}

function countQuestions(body: string): number {
  return countMatches(body, /\?/g);
}

function countEllipses(body: string): number {
  return countMatches(body, /\.{3,}/g);
}

function countEmojiLike(body: string): number {
  return countMatches(body, /[\u2190-\u2BFF\u{1F000}-\u{1FAFF}]/gu);
}

function bodyLengthScore(body: string): number {
  const len = body.length;
  if (len <= 0) return 0;
  if (len <= 24) return 15;
  if (len <= 60) return 30;
  if (len <= 120) return 45;
  if (len <= 240) return 60;
  return 72;
}

function recentlyUpdated(now: number, lastUpdatedAt?: UnixMs, withinMs = 12_000): boolean {
  if (!lastUpdatedAt) return false;
  return now - unixToNumber(lastUpdatedAt) <= withinMs;
}

function saturate01(value: number): number {
  return clamp(value, 0, 1);
}

function addClamped(base: number, delta: number): number {
  return clamp(base + delta, 0, 100);
}

/* ============================================================================
 * MARK: Engine public types
 * ============================================================================
 */

export interface AudienceHeatVectorPatch {
  readonly heat?: number;
  readonly hype?: number;
  readonly ridicule?: number;
  readonly scrutiny?: number;
  readonly volatility?: number;
}

export interface AudienceHeatSignalSummary {
  readonly channelId: ChatVisibleChannel;
  readonly transcriptDensity: number;
  readonly haterPressure: number;
  readonly helperPresence: number;
  readonly crowdPresence: number;
  readonly witnessPressure: number;
  readonly scenePressure: number;
  readonly silencePressure: number;
  readonly liveOpsPressure: number;
  readonly negotiationPressure: number;
  readonly relationshipPressure: number;
  readonly affectPressure: number;
  readonly momentum: number;
}

export interface AudienceHeatDerivation {
  readonly channelId: ChatVisibleChannel;
  readonly next: ChatAudienceHeat;
  readonly mood: ChatChannelMood;
  readonly summary: AudienceHeatSignalSummary;
  readonly patch: AudienceHeatVectorPatch;
  readonly reasons: readonly string[];
}

export interface AudienceHeatPreviewRail {
  readonly channelId: ChatVisibleChannel;
  readonly label: string;
  readonly numericScore: number;
  readonly description: string;
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface AudienceHeatPreview {
  readonly channelId: ChatVisibleChannel;
  readonly heatState: ChatAudienceHeat;
  readonly mood: ChatChannelMood;
  readonly rails: readonly AudienceHeatPreviewRail[];
  readonly reasons: readonly string[];
}

export interface AudienceHeatChannelTuning {
  readonly baseHeat: number;
  readonly baseHype: number;
  readonly baseRidicule: number;
  readonly baseScrutiny: number;
  readonly baseVolatility: number;
  readonly transcriptMultiplier: number;
  readonly witnessMultiplier: number;
  readonly haterMultiplier: number;
  readonly helperMultiplier: number;
  readonly sceneMultiplier: number;
  readonly liveOpsMultiplier: number;
  readonly negotiationMultiplier: number;
  readonly relationshipMultiplier: number;
  readonly affectMultiplier: number;
  readonly decayPerSecond: number;
  readonly volatilityDecayPerSecond: number;
}

export interface AudienceHeatEngineConfig {
  readonly clock?: AudienceHeatClock;
  readonly transcriptWindowSize: number;
  readonly burstWindowMs: number;
  readonly witnessFreshnessMs: number;
  readonly decayTickMs: number;
  readonly channels: Readonly<Record<ChatVisibleChannel, AudienceHeatChannelTuning>>;
}

export interface AudienceHeatMemoEntry {
  readonly channelId: ChatVisibleChannel;
  readonly derivedAt: UnixMs;
  readonly derivation: AudienceHeatDerivation;
}

export interface AudienceHeatEngineApi {
  readonly config: AudienceHeatEngineConfig;
  warmState(state: ChatEngineState): void;
  deriveForChannel(state: ChatEngineState, channelId: ChatVisibleChannel): AudienceHeatDerivation;
  deriveAll(state: ChatEngineState): Readonly<Record<ChatVisibleChannel, AudienceHeatDerivation>>;
  applyToState(state: ChatEngineState): ChatEngineState;
  previewChannel(state: ChatEngineState, channelId: ChatVisibleChannel): AudienceHeatPreview;
  previewAll(state: ChatEngineState): readonly AudienceHeatPreview[];
  nudgeFromMessage(
    state: ChatEngineState,
    channelId: ChatVisibleChannel,
    message: ChatMessage,
  ): ChatEngineState;
  getMemo(channelId: ChatVisibleChannel): AudienceHeatMemoEntry | undefined;
  clearMemo(): void;
}

/* ============================================================================
 * MARK: Static tuning tables
 * ============================================================================
 */

const DEFAULT_CHANNEL_TUNING: Readonly<Record<ChatVisibleChannel, AudienceHeatChannelTuning>> = {
  GLOBAL: {
    baseHeat: 18,
    baseHype: 14,
    baseRidicule: 10,
    baseScrutiny: 18,
    baseVolatility: 16,
    transcriptMultiplier: 1.2,
    witnessMultiplier: 1.4,
    haterMultiplier: 1.3,
    helperMultiplier: 0.8,
    sceneMultiplier: 1.15,
    liveOpsMultiplier: 1.4,
    negotiationMultiplier: 0.5,
    relationshipMultiplier: 0.75,
    affectMultiplier: 0.85,
    decayPerSecond: 0.02,
    volatilityDecayPerSecond: 0.03,
  },
  SYNDICATE: {
    baseHeat: 10,
    baseHype: 8,
    baseRidicule: 4,
    baseScrutiny: 16,
    baseVolatility: 9,
    transcriptMultiplier: 0.95,
    witnessMultiplier: 0.65,
    haterMultiplier: 0.7,
    helperMultiplier: 1.05,
    sceneMultiplier: 0.95,
    liveOpsMultiplier: 0.65,
    negotiationMultiplier: 0.35,
    relationshipMultiplier: 1.3,
    affectMultiplier: 1.15,
    decayPerSecond: 0.025,
    volatilityDecayPerSecond: 0.035,
  },
  DEAL_ROOM: {
    baseHeat: 12,
    baseHype: 3,
    baseRidicule: 7,
    baseScrutiny: 28,
    baseVolatility: 11,
    transcriptMultiplier: 0.75,
    witnessMultiplier: 0.5,
    haterMultiplier: 0.55,
    helperMultiplier: 0.5,
    sceneMultiplier: 0.85,
    liveOpsMultiplier: 0.45,
    negotiationMultiplier: 1.45,
    relationshipMultiplier: 1,
    affectMultiplier: 0.75,
    decayPerSecond: 0.018,
    volatilityDecayPerSecond: 0.03,
  },
  LOBBY: {
    baseHeat: 8,
    baseHype: 7,
    baseRidicule: 3,
    baseScrutiny: 7,
    baseVolatility: 6,
    transcriptMultiplier: 0.65,
    witnessMultiplier: 0.45,
    haterMultiplier: 0.35,
    helperMultiplier: 0.35,
    sceneMultiplier: 0.55,
    liveOpsMultiplier: 0.8,
    negotiationMultiplier: 0.15,
    relationshipMultiplier: 0.3,
    affectMultiplier: 0.35,
    decayPerSecond: 0.03,
    volatilityDecayPerSecond: 0.04,
  },
};

const DEFAULT_CONFIG: AudienceHeatEngineConfig = {
  clock: DEFAULT_CLOCK,
  transcriptWindowSize: 22,
  burstWindowMs: 10_000,
  witnessFreshnessMs: 15_000,
  decayTickMs: 1_000,
  channels: DEFAULT_CHANNEL_TUNING,
};

const MESSAGE_KIND_AUDIENCE_PATCH: Readonly<Record<ChatMessageKind, AudienceHeatVectorPatch>> = {
  PLAYER: { heat: 1, scrutiny: 2 },
  SYSTEM: { scrutiny: 1 },
  MARKET_ALERT: { heat: 5, scrutiny: 7, volatility: 6 },
  ACHIEVEMENT: { hype: 7, heat: 4 },
  BOT_TAUNT: { heat: 8, ridicule: 8, volatility: 6 },
  BOT_ATTACK: { heat: 10, scrutiny: 6, volatility: 8 },
  SHIELD_EVENT: { heat: 7, scrutiny: 8, volatility: 7 },
  CASCADE_ALERT: { heat: 7, scrutiny: 9, volatility: 10 },
  DEAL_RECAP: { scrutiny: 5, volatility: 3 },
  NPC_AMBIENT: { heat: 2 },
  HELPER_PROMPT: { scrutiny: 2, volatility: -1 },
  HELPER_RESCUE: { scrutiny: 3, volatility: -2, ridicule: -1 },
  HATER_TELEGRAPH: { heat: 8, scrutiny: 6, volatility: 7 },
  HATER_PUNISH: { heat: 10, ridicule: 10, volatility: 8 },
  CROWD_REACTION: { heat: 8, hype: 5, ridicule: 5, volatility: 6 },
  RELATIONSHIP_CALLBACK: { scrutiny: 8, heat: 5, volatility: 4 },
  QUOTE_CALLBACK: { scrutiny: 10, ridicule: 7, heat: 4 },
  NEGOTIATION_OFFER: { scrutiny: 8, volatility: 5 },
  NEGOTIATION_COUNTER: { scrutiny: 10, volatility: 7, heat: 4 },
  LEGEND_MOMENT: { heat: 12, hype: 15, scrutiny: 8, volatility: 5 },
  POST_RUN_RITUAL: { scrutiny: 6, heat: 3 },
  WORLD_EVENT: { heat: 9, scrutiny: 7, volatility: 7, hype: 4 },
  SYSTEM_SHADOW_MARKER: {},
};

const MESSAGE_KIND_MOOD_HINTS: Readonly<Record<ChatMessageKind, ChatChannelMood['mood']>> = {
  PLAYER: 'CALM',
  SYSTEM: 'CALM',
  MARKET_ALERT: 'SUSPICIOUS',
  ACHIEVEMENT: 'ECSTATIC',
  BOT_TAUNT: 'HOSTILE',
  BOT_ATTACK: 'HOSTILE',
  SHIELD_EVENT: 'HOSTILE',
  CASCADE_ALERT: 'SUSPICIOUS',
  DEAL_RECAP: 'PREDATORY',
  NPC_AMBIENT: 'CALM',
  HELPER_PROMPT: 'CALM',
  HELPER_RESCUE: 'CALM',
  HATER_TELEGRAPH: 'HOSTILE',
  HATER_PUNISH: 'HOSTILE',
  CROWD_REACTION: 'ECSTATIC',
  RELATIONSHIP_CALLBACK: 'SUSPICIOUS',
  QUOTE_CALLBACK: 'SUSPICIOUS',
  NEGOTIATION_OFFER: 'PREDATORY',
  NEGOTIATION_COUNTER: 'PREDATORY',
  LEGEND_MOMENT: 'ECSTATIC',
  POST_RUN_RITUAL: 'MOURNFUL',
  WORLD_EVENT: 'SUSPICIOUS',
  SYSTEM_SHADOW_MARKER: 'SUSPICIOUS',
};

const SCENE_BEAT_PATCHES: Readonly<Record<ChatSceneBeatType, AudienceHeatVectorPatch>> = {
  SYSTEM_NOTICE: { scrutiny: 4, heat: 2 },
  HATER_ENTRY: { heat: 7, ridicule: 5, volatility: 6 },
  HELPER_INTERVENTION: { scrutiny: 4, volatility: -1 },
  CROWD_SWARM: { heat: 10, ridicule: 9, hype: 4, volatility: 8 },
  DEAL_PIVOT: { scrutiny: 9, volatility: 5 },
  LEGEND_STAMP: { hype: 10, heat: 6, scrutiny: 4 },
  POST_RUN_WITNESS: { scrutiny: 6, heat: 3 },
};

const LIVEOPS_HEAT_PRESSURE_CODES = [
  'DOUBLE_HEAT',
  'WHISPER_ONLY',
  'FACTION_SURGE',
  'MARKET_RUMOR',
  'HATER_RAID',
  'HELPER_BLACKOUT',
] as const;

type LiveOpsPressureCode = (typeof LIVEOPS_HEAT_PRESSURE_CODES)[number];

const LIVEOPS_PATCHES: Readonly<Record<LiveOpsPressureCode, AudienceHeatVectorPatch>> = {
  DOUBLE_HEAT: { heat: 18, hype: 9, scrutiny: 10, volatility: 10 },
  WHISPER_ONLY: { scrutiny: 12, heat: -3, volatility: 4 },
  FACTION_SURGE: { heat: 12, hype: 7, volatility: 9 },
  MARKET_RUMOR: { scrutiny: 10, volatility: 8, heat: 4 },
  HATER_RAID: { heat: 14, ridicule: 12, volatility: 10 },
  HELPER_BLACKOUT: { scrutiny: 8, volatility: 7, heat: 5 },
};

const POSITIVE_SIGNAL_WORDS = [
  'win',
  'won',
  'survive',
  'survived',
  'clean',
  'hold',
  'stable',
  'recover',
  'recovered',
  'break',
  'comeback',
  'sovereignty',
  'legend',
  'proof',
  'locked',
  'disciplined',
  'precision',
] as const;

const NEGATIVE_SIGNAL_WORDS = [
  'collapse',
  'broke',
  'bankrupt',
  'panic',
  'failed',
  'bleeding',
  'trapped',
  'baited',
  'humiliated',
  'loss',
  'dead',
  'finished',
  'fold',
  'fraud',
  'weak',
  'caught',
  'exposed',
  'overpaid',
] as const;

const WITNESS_TRIGGER_TAGS = [
  'legend',
  'proof',
  'receipt',
  'witnessed',
  'everybody',
  'all saw',
  'the room',
  'global',
  'syndicate',
  'deal room',
  'quote',
  'remember',
] as const;

/* ============================================================================
 * MARK: Merge helpers and small derivation utilities
 * ============================================================================
 */

function mergeChannelTuning(
  base: AudienceHeatChannelTuning,
  override?: Partial<AudienceHeatChannelTuning>,
): AudienceHeatChannelTuning {
  if (!override) return base;
  return {
    baseHeat: override.baseHeat ?? base.baseHeat,
    baseHype: override.baseHype ?? base.baseHype,
    baseRidicule: override.baseRidicule ?? base.baseRidicule,
    baseScrutiny: override.baseScrutiny ?? base.baseScrutiny,
    baseVolatility: override.baseVolatility ?? base.baseVolatility,
    transcriptMultiplier: override.transcriptMultiplier ?? base.transcriptMultiplier,
    witnessMultiplier: override.witnessMultiplier ?? base.witnessMultiplier,
    haterMultiplier: override.haterMultiplier ?? base.haterMultiplier,
    helperMultiplier: override.helperMultiplier ?? base.helperMultiplier,
    sceneMultiplier: override.sceneMultiplier ?? base.sceneMultiplier,
    liveOpsMultiplier: override.liveOpsMultiplier ?? base.liveOpsMultiplier,
    negotiationMultiplier: override.negotiationMultiplier ?? base.negotiationMultiplier,
    relationshipMultiplier: override.relationshipMultiplier ?? base.relationshipMultiplier,
    affectMultiplier: override.affectMultiplier ?? base.affectMultiplier,
    decayPerSecond: override.decayPerSecond ?? base.decayPerSecond,
    volatilityDecayPerSecond:
      override.volatilityDecayPerSecond ?? base.volatilityDecayPerSecond,
  };
}

function mergeConfig(config?: Partial<AudienceHeatEngineConfig>): AudienceHeatEngineConfig {
  const base = DEFAULT_CONFIG;
  const nextChannels: Record<ChatVisibleChannel, AudienceHeatChannelTuning> = {
    GLOBAL: mergeChannelTuning(base.channels.GLOBAL, config?.channels?.GLOBAL),
    SYNDICATE: mergeChannelTuning(base.channels.SYNDICATE, config?.channels?.SYNDICATE),
    DEAL_ROOM: mergeChannelTuning(base.channels.DEAL_ROOM, config?.channels?.DEAL_ROOM),
    LOBBY: mergeChannelTuning(base.channels.LOBBY, config?.channels?.LOBBY),
  };

  return {
    clock: config?.clock ?? base.clock,
    transcriptWindowSize: config?.transcriptWindowSize ?? base.transcriptWindowSize,
    burstWindowMs: config?.burstWindowMs ?? base.burstWindowMs,
    witnessFreshnessMs: config?.witnessFreshnessMs ?? base.witnessFreshnessMs,
    decayTickMs: config?.decayTickMs ?? base.decayTickMs,
    channels: nextChannels,
  };
}

function emptyPatch(): Required<AudienceHeatVectorPatch> {
  return {
    heat: 0,
    hype: 0,
    ridicule: 0,
    scrutiny: 0,
    volatility: 0,
  };
}

function addPatch(
  base: Required<AudienceHeatVectorPatch>,
  patch: AudienceHeatVectorPatch | undefined,
  multiplier = 1,
): Required<AudienceHeatVectorPatch> {
  if (!patch) return base;
  return {
    heat: base.heat + (patch.heat ?? 0) * multiplier,
    hype: base.hype + (patch.hype ?? 0) * multiplier,
    ridicule: base.ridicule + (patch.ridicule ?? 0) * multiplier,
    scrutiny: base.scrutiny + (patch.scrutiny ?? 0) * multiplier,
    volatility: base.volatility + (patch.volatility ?? 0) * multiplier,
  };
}

function messageKindPatch(kind: ChatMessageKind): AudienceHeatVectorPatch {
  return MESSAGE_KIND_AUDIENCE_PATCH[kind] ?? {};
}

function containsAny(body: string, terms: readonly string[]): number {
  const lower = body.toLowerCase();
  let count = 0;
  for (const term of terms) {
    if (lower.includes(term)) count += 1;
  }
  return count;
}

function bodySentimentTilt(body: string): number {
  const positive = containsAny(body, POSITIVE_SIGNAL_WORDS);
  const negative = containsAny(body, NEGATIVE_SIGNAL_WORDS);
  return positive - negative;
}

function bodyWitnessScore(body: string): number {
  const termHits = containsAny(body, WITNESS_TRIGGER_TAGS) * 12;
  const exclam = countExclamations(body) * 2;
  const caps = countAllCapsWords(body) * 3;
  return clamp(termHits + exclam + caps, 0, 100);
}

function bodyIntensityScore(body: string): number {
  const length = bodyLengthScore(body);
  const exclam = countExclamations(body) * 4;
  const questions = countQuestions(body) * 2;
  const caps = countAllCapsWords(body) * 5;
  const emoji = countEmojiLike(body) * 3;
  const ellipses = countEllipses(body) * 2;
  return clamp(length + exclam + questions + caps + emoji + ellipses, 0, 100);
}

function inferMessageWitnessPressure(message: ChatMessage): number {
  const body = normalizeBody(message.body);
  let score = bodyWitnessScore(body);
  if (message.kind === 'LEGEND_MOMENT') score += 40;
  if (message.kind === 'QUOTE_CALLBACK') score += 35;
  if (message.kind === 'RELATIONSHIP_CALLBACK') score += 20;
  if (message.proofHash || message.proof) score += 10;
  if (message.legend?.unlocksReward) score += 15;
  if (message.replay?.legendEligible) score += 12;
  return clamp(score, 0, 100);
}

function inferCrowdPressure(message: ChatMessage): number {
  const kindWeight = message.kind === 'CROWD_REACTION' ? 30 : 0;
  const body = normalizeBody(message.body);
  const swarmTerms = containsAny(body, [
    'everyone',
    'everybody',
    'the room',
    'all saw',
    'global',
    'crowd',
    'watching',
    'witnessed',
    'clip it',
    'archive it',
  ]) * 9;
  return clamp(kindWeight + swarmTerms + bodyIntensityScore(body) * 0.25, 0, 100);
}

function inferHelperPressure(message: ChatMessage): number {
  if (message.kind === 'HELPER_PROMPT') return 45;
  if (message.kind === 'HELPER_RESCUE') return 65;
  const body = normalizeBody(message.body).toLowerCase();
  const helperTerms = containsAny(body, [
    'breathe',
    'hold',
    'steady',
    'recover',
    'precision',
    'read the state',
    'survival',
    'clean decision',
    'stay calm',
  ]) * 8;
  return clamp(helperTerms, 0, 100);
}

function inferHaterPressure(message: ChatMessage): number {
  if (message.kind === 'BOT_ATTACK') return 85;
  if (message.kind === 'BOT_TAUNT') return 65;
  if (message.kind === 'HATER_TELEGRAPH') return 72;
  if (message.kind === 'HATER_PUNISH') return 90;
  const body = normalizeBody(message.body).toLowerCase();
  const haterTerms = containsAny(body, [
    'collapse',
    'exposed',
    'weak',
    'finished',
    'fraud',
    'humiliated',
    'dead',
    'bleeding',
    'baited',
    'punish',
    'trap',
  ]) * 9;
  return clamp(haterTerms + bodyIntensityScore(body) * 0.2, 0, 100);
}

function inferNegotiationPressure(message: ChatMessage): number {
  if (message.kind === 'NEGOTIATION_OFFER') return 68;
  if (message.kind === 'NEGOTIATION_COUNTER') return 74;
  if (message.kind === 'DEAL_RECAP') return 45;
  const body = normalizeBody(message.body).toLowerCase();
  const terms = containsAny(body, [
    'offer',
    'counter',
    'final',
    'take it',
    'expires',
    'deadline',
    'overpay',
    'concession',
    'price',
    'bid',
    'fold',
  ]) * 8;
  return clamp(terms, 0, 100);
}

function inferRidiculePressure(message: ChatMessage): number {
  const body = normalizeBody(message.body).toLowerCase();
  const terms = containsAny(body, [
    'lol',
    'lmao',
    'weak',
    'fraud',
    'exposed',
    'humiliated',
    'easy',
    'pathetic',
    'clipped',
    'caught',
    'dragged',
  ]) * 8;
  let bonus = 0;
  if (message.kind === 'BOT_TAUNT') bonus += 25;
  if (message.kind === 'HATER_PUNISH') bonus += 28;
  if (message.kind === 'QUOTE_CALLBACK') bonus += 14;
  return clamp(terms + bonus + countExclamations(body) * 2, 0, 100);
}

function inferScenePressure(scene?: ChatScenePlan): number {
  if (!scene) return 0;
  let score = 0;
  for (const beat of scene.beats) {
    const patch = SCENE_BEAT_PATCHES[beat.beatType] ?? {};
    score +=
      (patch.heat ?? 0) * 0.6 +
      (patch.scrutiny ?? 0) * 0.8 +
      (patch.volatility ?? 0) * 0.7 +
      (patch.ridicule ?? 0) * 0.5 +
      (patch.hype ?? 0) * 0.4;
    if (beat.canInterrupt) score += 4;
    if (!beat.skippable) score += 3;
  }
  return clamp(score, 0, 100);
}

function inferSilencePressure(state: ChatEngineState, now: number): number {
  const silence = state.currentSilence;
  if (!silence?.enforced) return 0;
  const breakCount = silence.breakConditions.length;
  const duration = silence.durationMs;
  let base = 15 + Math.min(30, duration / 50);
  if (silence.reason === 'DREAD') base += 18;
  if (silence.reason === 'SCENE_COMPOSITION') base += 8;
  if (breakCount <= 1) base += 10;
  if (state.pendingReveals.length > 0) base += 8;
  if (recentlyUpdated(now, state.activeScene?.startsAt as UnixMs | undefined, 2_000)) base += 6;
  return clamp(base, 0, 100);
}

function inferLiveOpsPressure(
  liveOps: ChatLiveOpsState,
  channelId: ChatVisibleChannel,
  now: number,
): number {
  let score = 0;
  for (const event of liveOps.activeWorldEvents) {
    const affectsChannel = event.affectedChannels.includes(channelId);
    if (!affectsChannel) continue;
    score += scoreToNumber(event.intensity) * 0.6;
    const code = String(event.code).toUpperCase() as LiveOpsPressureCode;
    const patch = LIVEOPS_PATCHES[code];
    if (patch) {
      score +=
        (patch.heat ?? 0) * 0.35 +
        (patch.scrutiny ?? 0) * 0.4 +
        (patch.volatility ?? 0) * 0.35 +
        (patch.hype ?? 0) * 0.3;
    }
    if (recentlyUpdated(now, event.startsAt, 20_000)) score += 4;
  }
  if (liveOps.boostedCrowdChannels.includes(channelId)) score += 12;
  if (liveOps.suppressedHelperChannels.includes(channelId)) score += 8;
  return clamp(score, 0, 100);
}

function inferNegotiationStatePressure(offerState?: ChatNegotiationState): number {
  if (!offerState) return 0;
  let score = 0;
  if (offerState.readPressureActive) score += 18;
  score += scoreToNumber(offerState.inferredOpponentUrgency) * 0.35;
  score += scoreToNumber(offerState.inferredOpponentConfidence) * 0.15;
  switch (offerState.stance) {
    case 'PUSHING':
      score += 18;
      break;
    case 'CLOSING':
      score += 22;
      break;
    case 'STALLING':
      score += 9;
      break;
    case 'PROBING':
      score += 8;
      break;
    case 'FOLDING':
      score += 6;
      break;
  }
  return clamp(score, 0, 100);
}

function inferRelationshipPressure(
  relationships: readonly ChatRelationshipState[],
  channelId: ChatVisibleChannel,
): number {
  if (!relationships.length) return 0;
  const scores = relationships.map((relationship) => {
    const v = relationship.vector;
    let score =
      scoreToNumber(v.rivalryIntensity) * 0.28 +
      scoreToNumber(v.fascination) * 0.12 +
      scoreToNumber(v.fear) * 0.18 +
      scoreToNumber(v.rescueDebt) * 0.1 +
      scoreToNumber(v.trust) * (channelId === 'SYNDICATE' ? 0.18 : 0.04) +
      scoreToNumber(v.contempt) * 0.18 +
      scoreToNumber(v.respect) * (channelId === 'GLOBAL' ? 0.08 : 0.14);

    if (relationship.escalationTier === 'OBSESSIVE') score += 24;
    else if (relationship.escalationTier === 'ACTIVE') score += 14;
    else if (relationship.escalationTier === 'MILD') score += 6;

    if (relationship.callbacksAvailable.length > 0) {
      score += Math.min(14, relationship.callbacksAvailable.length * 2);
    }

    return clamp(score, 0, 100);
  });

  return clamp(avg(scores), 0, 100);
}

function inferAffectPressure(affect: ChatAffectSnapshot): number {
  const vector = affect.vector;
  return clamp(
    scoreToNumber(vector.intimidation) * 0.18 +
      scoreToNumber(vector.frustration) * 0.17 +
      scoreToNumber(vector.socialEmbarrassment) * 0.22 +
      scoreToNumber(vector.desperation) * 0.22 +
      scoreToNumber(vector.dominance) * 0.08 +
      scoreToNumber(vector.confidence) * 0.05 -
      scoreToNumber(vector.relief) * 0.1 -
      scoreToNumber(vector.trust) * 0.04,
    0,
    100,
  );
}

function inferTranscriptDensity(messages: readonly ChatMessage[], now: number, burstWindowMs: number): number {
  if (!messages.length) return 0;

  const recent = messages.filter((message) => now - message.ts <= burstWindowMs);
  const recentCount = recent.length;
  const fullCount = messages.length;
  const witnessScores = recent.map(inferMessageWitnessPressure);
  const intensityScores = recent.map((message) => bodyIntensityScore(normalizeBody(message.body)));
  const maxBurst = maxOf(intensityScores);
  const medianWitness = median(witnessScores);

  return clamp(recentCount * 6 + fullCount * 1.2 + maxBurst * 0.22 + medianWitness * 0.18, 0, 100);
}

function inferMomentum(messages: readonly ChatMessage[]): number {
  if (messages.length < 2) return 0;
  const recent = messages.slice(-8);
  const sentiments = recent.map((message) => bodySentimentTilt(normalizeBody(message.body)));
  return clamp(avg(sentiments) * 10 + maxOf(sentiments) * 6, -100, 100);
}

function buildMoodFromVector(channelId: ChatChannelId, heat: number, hype: number, ridicule: number, scrutiny: number, volatility: number): ChatChannelMood['mood'] {
  if (channelId === 'DEAL_ROOM') {
    if (scrutiny >= 55 || volatility >= 52) return 'PREDATORY';
    if (heat >= 42 && scrutiny >= 40) return 'SUSPICIOUS';
    return 'CALM';
  }
  if (hype >= 68 && heat >= 40) return 'ECSTATIC';
  if (ridicule >= 55 || (heat >= 52 && volatility >= 48)) return 'HOSTILE';
  if (scrutiny >= 48) return 'SUSPICIOUS';
  if (heat <= 10 && hype <= 10 && ridicule <= 8) return 'CALM';
  return 'CALM';
}

function buildMoodReason(
  channelId: ChatVisibleChannel,
  summary: AudienceHeatSignalSummary,
  vector: ChatAudienceHeat,
): string {
  const top = [
    ['witness pressure', summary.witnessPressure],
    ['hater pressure', summary.haterPressure],
    ['scene pressure', summary.scenePressure],
    ['liveops pressure', summary.liveOpsPressure],
    ['negotiation pressure', summary.negotiationPressure],
    ['relationship pressure', summary.relationshipPressure],
    ['affect pressure', summary.affectPressure],
    ['crowd pressure', summary.crowdPresence],
    ['helper pressure', summary.helperPresence],
  ].sort((a, b) => b[1] - a[1])[0];

  const axis =
    vector.hype >= vector.ridicule && vector.hype >= vector.scrutiny
      ? 'hype'
      : vector.ridicule >= vector.scrutiny
        ? 'ridicule'
        : 'scrutiny';

  return `${channelId.toLowerCase()} mood driven by ${top?.[0] ?? 'baseline'} with ${axis} dominant`;
}

function buildAudienceHeat(
  channelId: ChatVisibleChannel,
  base: ChatAudienceHeat,
  patch: Required<AudienceHeatVectorPatch>,
  now: number,
): ChatAudienceHeat {
  return {
    channelId,
    heat: asScore100(addClamped(scoreToNumber(base.heat), patch.heat)),
    hype: asScore100(addClamped(scoreToNumber(base.hype), patch.hype)),
    ridicule: asScore100(addClamped(scoreToNumber(base.ridicule), patch.ridicule)),
    scrutiny: asScore100(addClamped(scoreToNumber(base.scrutiny), patch.scrutiny)),
    volatility: asScore100(addClamped(scoreToNumber(base.volatility), patch.volatility)),
    lastUpdatedAt: asUnixMs(now),
  };
}

function buildMood(
  channelId: ChatVisibleChannel,
  mood: ChatChannelMood['mood'],
  reason: string,
  now: number,
): ChatChannelMood {
  return {
    channelId,
    mood,
    reason,
    updatedAt: asUnixMs(now),
  };
}

function deriveRails(summary: AudienceHeatSignalSummary, next: ChatAudienceHeat, reasons: readonly string[]): readonly AudienceHeatPreviewRail[] {
  const makeSeverity = (value: number): AudienceHeatPreviewRail['severity'] => {
    if (value >= 75) return 'CRITICAL';
    if (value >= 55) return 'HIGH';
    if (value >= 30) return 'MEDIUM';
    return 'LOW';
  };

  return [
    {
      channelId: summary.channelId,
      label: 'Heat',
      numericScore: scoreToNumber(next.heat),
      description: `Raw social temperature (${reasons[0] ?? 'baseline'})`,
      severity: makeSeverity(scoreToNumber(next.heat)),
    },
    {
      channelId: summary.channelId,
      label: 'Witness',
      numericScore: summary.witnessPressure,
      description: 'How strongly the room feels like it is watching',
      severity: makeSeverity(summary.witnessPressure),
    },
    {
      channelId: summary.channelId,
      label: 'Ridicule',
      numericScore: scoreToNumber(next.ridicule),
      description: 'How likely the room is to weaponize embarrassment',
      severity: makeSeverity(scoreToNumber(next.ridicule)),
    },
    {
      channelId: summary.channelId,
      label: 'Scrutiny',
      numericScore: scoreToNumber(next.scrutiny),
      description: 'How tightly the channel is reading for tells',
      severity: makeSeverity(scoreToNumber(next.scrutiny)),
    },
    {
      channelId: summary.channelId,
      label: 'Volatility',
      numericScore: scoreToNumber(next.volatility),
      description: 'How rapidly the atmosphere can turn',
      severity: makeSeverity(scoreToNumber(next.volatility)),
    },
  ] as const;
}

function messageWindowForChannel(
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
  max: number,
): readonly ChatMessage[] {
  const window = state.messagesByChannel[channelId] ?? [];
  return window.length <= max ? window : window.slice(-max);
}

function relationshipsForChannel(
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
): readonly ChatRelationshipState[] {
  const values = Object.values(state.relationshipsByCounterpartId);
  if (!values.length) return values;
  if (channelId === 'GLOBAL') {
    return values.filter((relationship) =>
      relationship.counterpartKind === 'HATER' ||
      relationship.counterpartKind === 'CROWD' ||
      relationship.counterpartKind === 'AMBIENT_NPC',
    );
  }
  if (channelId === 'SYNDICATE') {
    return values.filter((relationship) =>
      relationship.counterpartKind === 'HELPER',
    );
  }
  if (channelId === 'DEAL_ROOM') {
    return values.filter((relationship) =>
      relationship.counterpartKind === 'DEAL_AGENT' ||
      relationship.counterpartKind === 'HATER',
    );
  }
  return values;
}

/* ============================================================================
 * MARK: Core engine
 * ============================================================================
 */

export class AudienceHeatEngine implements AudienceHeatEngineApi {
  public readonly config: AudienceHeatEngineConfig;
  private readonly clock: AudienceHeatClock;
  private readonly memo = new Map<ChatVisibleChannel, AudienceHeatMemoEntry>();

  public constructor(config?: Partial<AudienceHeatEngineConfig>) {
    this.config = mergeConfig(config);
    this.clock = this.config.clock ?? DEFAULT_CLOCK;
  }

  public warmState(state: ChatEngineState): void {
    const derivations = this.deriveAll(state);
    for (const channelId of CHAT_VISIBLE_CHANNELS) {
      this.memo.set(channelId, {
        channelId,
        derivedAt: asUnixMs(this.clock.now()),
        derivation: derivations[channelId],
      });
    }
  }

  public clearMemo(): void {
    this.memo.clear();
  }

  public getMemo(channelId: ChatVisibleChannel): AudienceHeatMemoEntry | undefined {
    return this.memo.get(channelId);
  }

  public deriveAll(
    state: ChatEngineState,
  ): Readonly<Record<ChatVisibleChannel, AudienceHeatDerivation>> {
    return {
      GLOBAL: this.deriveForChannel(state, 'GLOBAL'),
      SYNDICATE: this.deriveForChannel(state, 'SYNDICATE'),
      DEAL_ROOM: this.deriveForChannel(state, 'DEAL_ROOM'),
      LOBBY: this.deriveForChannel(state, 'LOBBY'),
    };
  }

  public deriveForChannel(
    state: ChatEngineState,
    channelId: ChatVisibleChannel,
  ): AudienceHeatDerivation {
    const now = this.clock.now();
    const tuning = this.config.channels[channelId];
    const transcript = messageWindowForChannel(state, channelId, this.config.transcriptWindowSize);
    const recent = transcript.filter((message) => now - message.ts <= this.config.burstWindowMs);

    const transcriptDensity = inferTranscriptDensity(transcript, now, this.config.burstWindowMs);

    const haterPressure = clamp(avg(recent.map(inferHaterPressure)), 0, 100);
    const helperPresence = clamp(avg(recent.map(inferHelperPressure)), 0, 100);
    const crowdPresence = clamp(avg(recent.map(inferCrowdPressure)), 0, 100);
    const witnessPressure = clamp(avg(recent.map(inferMessageWitnessPressure)), 0, 100);
    const scenePressure = inferScenePressure(state.activeScene);
    const silencePressure = inferSilencePressure(state, now);
    const liveOpsPressure = inferLiveOpsPressure(state.liveOps, channelId, now);
    const negotiationPressure =
      channelId === 'DEAL_ROOM' ? inferNegotiationStatePressure(state.offerState) : 0;
    const relationshipPressure = inferRelationshipPressure(
      relationshipsForChannel(state, channelId),
      channelId,
    );
    const affectPressure = inferAffectPressure(state.affect);
    const momentum = inferMomentum(recent);

    const summary: AudienceHeatSignalSummary = {
      channelId,
      transcriptDensity,
      haterPressure,
      helperPresence,
      crowdPresence,
      witnessPressure,
      scenePressure,
      silencePressure,
      liveOpsPressure,
      negotiationPressure,
      relationshipPressure,
      affectPressure,
      momentum,
    };

    const reasons: string[] = [];

    let patch = emptyPatch();

    patch = addPatch(patch, {
      heat: (tuning.baseHeat - scoreToNumber(state.audienceHeat[channelId].heat)) * 0.08,
      hype: (tuning.baseHype - scoreToNumber(state.audienceHeat[channelId].hype)) * 0.08,
      ridicule: (tuning.baseRidicule - scoreToNumber(state.audienceHeat[channelId].ridicule)) * 0.08,
      scrutiny: (tuning.baseScrutiny - scoreToNumber(state.audienceHeat[channelId].scrutiny)) * 0.08,
      volatility:
        (tuning.baseVolatility - scoreToNumber(state.audienceHeat[channelId].volatility)) * 0.08,
    });

    if (transcriptDensity > 0) {
      reasons.push('transcript density');
      patch = addPatch(patch, {
        heat: transcriptDensity * 0.16,
        hype: Math.max(0, momentum) * 0.11,
        ridicule: Math.max(0, -momentum) * 0.09,
        scrutiny: transcriptDensity * 0.18,
        volatility: transcriptDensity * 0.12,
      }, tuning.transcriptMultiplier);
    }

    if (witnessPressure > 0) {
      reasons.push('witness pressure');
      patch = addPatch(patch, {
        heat: witnessPressure * 0.12,
        hype: witnessPressure * 0.05,
        scrutiny: witnessPressure * 0.22,
        volatility: witnessPressure * 0.08,
      }, tuning.witnessMultiplier);
    }

    if (crowdPresence > 0) {
      reasons.push('crowd presence');
      patch = addPatch(patch, {
        heat: crowdPresence * 0.16,
        hype: crowdPresence * 0.08,
        ridicule: crowdPresence * 0.12,
        volatility: crowdPresence * 0.14,
      }, channelId === 'GLOBAL' ? 1.15 : 0.65);
    }

    if (haterPressure > 0) {
      reasons.push('hater pressure');
      patch = addPatch(patch, {
        heat: haterPressure * 0.18,
        ridicule: haterPressure * 0.14,
        scrutiny: haterPressure * 0.08,
        volatility: haterPressure * 0.16,
      }, tuning.haterMultiplier);
    }

    if (helperPresence > 0) {
      reasons.push('helper presence');
      patch = addPatch(patch, {
        scrutiny: helperPresence * 0.06,
        volatility: -helperPresence * 0.07,
        ridicule: -helperPresence * 0.05,
        hype: helperPresence * (channelId === 'SYNDICATE' ? 0.05 : 0.02),
      }, tuning.helperMultiplier);
    }

    if (scenePressure > 0) {
      reasons.push('scene pressure');
      patch = addPatch(patch, {
        heat: scenePressure * 0.11,
        hype: scenePressure * 0.04,
        ridicule: scenePressure * 0.05,
        scrutiny: scenePressure * 0.15,
        volatility: scenePressure * 0.12,
      }, tuning.sceneMultiplier);
    }

    if (silencePressure > 0) {
      reasons.push('silence pressure');
      patch = addPatch(patch, {
        heat: silencePressure * 0.06,
        scrutiny: silencePressure * 0.14,
        volatility: silencePressure * 0.08,
      });
    }

    if (liveOpsPressure > 0) {
      reasons.push('liveops pressure');
      patch = addPatch(patch, {
        heat: liveOpsPressure * 0.14,
        hype: liveOpsPressure * 0.08,
        ridicule: liveOpsPressure * 0.05,
        scrutiny: liveOpsPressure * 0.12,
        volatility: liveOpsPressure * 0.12,
      }, tuning.liveOpsMultiplier);
    }

    if (negotiationPressure > 0) {
      reasons.push('negotiation pressure');
      patch = addPatch(patch, {
        heat: negotiationPressure * 0.04,
        ridicule: negotiationPressure * 0.04,
        scrutiny: negotiationPressure * 0.18,
        volatility: negotiationPressure * 0.11,
      }, tuning.negotiationMultiplier);
    }

    if (relationshipPressure > 0) {
      reasons.push('relationship pressure');
      patch = addPatch(patch, {
        heat: relationshipPressure * 0.08,
        hype: relationshipPressure * 0.02,
        ridicule: relationshipPressure * 0.06,
        scrutiny: relationshipPressure * 0.09,
        volatility: relationshipPressure * 0.07,
      }, tuning.relationshipMultiplier);
    }

    if (affectPressure > 0) {
      reasons.push('affect pressure');
      patch = addPatch(patch, {
        heat: affectPressure * 0.09,
        ridicule: affectPressure * 0.08,
        scrutiny: affectPressure * 0.09,
        volatility: affectPressure * 0.11,
      }, tuning.affectMultiplier);
    }

    const lastUpdatedAt = unixToNumber(state.audienceHeat[channelId].lastUpdatedAt);
    const elapsedSec = Math.max(0, (now - lastUpdatedAt) / 1_000);
    const decayWeight = Math.min(1, elapsedSec / 10);

    patch = addPatch(patch, {
      heat: -scoreToNumber(state.audienceHeat[channelId].heat) * tuning.decayPerSecond * decayWeight,
      hype: -scoreToNumber(state.audienceHeat[channelId].hype) * (tuning.decayPerSecond * 0.9) * decayWeight,
      ridicule: -scoreToNumber(state.audienceHeat[channelId].ridicule) * (tuning.decayPerSecond * 0.75) * decayWeight,
      scrutiny: -scoreToNumber(state.audienceHeat[channelId].scrutiny) * (tuning.decayPerSecond * 0.55) * decayWeight,
      volatility: -scoreToNumber(state.audienceHeat[channelId].volatility) * tuning.volatilityDecayPerSecond * decayWeight,
    });

    const next = buildAudienceHeat(channelId, state.audienceHeat[channelId], patch, now);

    const mood = buildMood(
      channelId,
      buildMoodFromVector(
        channelId,
        scoreToNumber(next.heat),
        scoreToNumber(next.hype),
        scoreToNumber(next.ridicule),
        scoreToNumber(next.scrutiny),
        scoreToNumber(next.volatility),
      ),
      buildMoodReason(channelId, summary, next),
      now,
    );

    const derivation: AudienceHeatDerivation = {
      channelId,
      next,
      mood,
      summary,
      patch,
      reasons,
    };

    this.memo.set(channelId, {
      channelId,
      derivedAt: asUnixMs(now),
      derivation,
    });

    return derivation;
  }

  public applyToState(state: ChatEngineState): ChatEngineState {
    let next = cloneChatEngineState(state);
    for (const channelId of CHAT_VISIBLE_CHANNELS) {
      const derivation = this.deriveForChannel(next, channelId);
      next = setAudienceHeatInState(next, channelId, derivation.next);
      next = setChannelMoodInState(
        next,
        channelId,
        derivation.mood.mood,
        derivation.mood.reason,
        derivation.mood.updatedAt,
      );
    }
    return next;
  }

  public previewChannel(
    state: ChatEngineState,
    channelId: ChatVisibleChannel,
  ): AudienceHeatPreview {
    const derivation = this.deriveForChannel(state, channelId);
    return {
      channelId,
      heatState: derivation.next,
      mood: derivation.mood,
      rails: deriveRails(derivation.summary, derivation.next, derivation.reasons),
      reasons: derivation.reasons,
    };
  }

  public previewAll(state: ChatEngineState): readonly AudienceHeatPreview[] {
    return CHAT_VISIBLE_CHANNELS.map((channelId) => this.previewChannel(state, channelId));
  }

  public nudgeFromMessage(
    state: ChatEngineState,
    channelId: ChatVisibleChannel,
    message: ChatMessage,
  ): ChatEngineState {
    const current = state.audienceHeat[channelId];
    const patch = addPatch(emptyPatch(), messageKindPatch(message.kind));

    const body = normalizeBody(message.body);
    patch.heat += bodyIntensityScore(body) * 0.04;
    patch.scrutiny += inferMessageWitnessPressure(message) * 0.05;
    patch.ridicule += inferRidiculePressure(message) * 0.04;
    patch.volatility += inferCrowdPressure(message) * 0.03;
    patch.hype += Math.max(0, bodySentimentTilt(body)) * 2;

    const now = this.clock.now();
    let next = setAudienceHeatInState(state, channelId, {
      heat: asScore100(addClamped(scoreToNumber(current.heat), patch.heat)),
      hype: asScore100(addClamped(scoreToNumber(current.hype), patch.hype)),
      ridicule: asScore100(addClamped(scoreToNumber(current.ridicule), patch.ridicule)),
      scrutiny: asScore100(addClamped(scoreToNumber(current.scrutiny), patch.scrutiny)),
      volatility: asScore100(addClamped(scoreToNumber(current.volatility), patch.volatility)),
      lastUpdatedAt: asUnixMs(now),
    });

    const hintedMood = MESSAGE_KIND_MOOD_HINTS[message.kind];
    next = setChannelMoodInState(
      next,
      channelId,
      hintedMood,
      `${message.kind.toLowerCase()} mood hint`,
      asUnixMs(now),
    );

    this.deriveForChannel(next, channelId);
    return next;
  }
}

/* ============================================================================
 * MARK: Stateless convenience exports
 * ============================================================================
 */

export function createAudienceHeatEngine(
  config?: Partial<AudienceHeatEngineConfig>,
): AudienceHeatEngine {
  return new AudienceHeatEngine(config);
}

export function deriveAudienceHeatForChannel(
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
  config?: Partial<AudienceHeatEngineConfig>,
): AudienceHeatDerivation {
  return new AudienceHeatEngine(config).deriveForChannel(state, channelId);
}

export function deriveAudienceHeatForState(
  state: ChatEngineState,
  config?: Partial<AudienceHeatEngineConfig>,
): Readonly<Record<ChatVisibleChannel, AudienceHeatDerivation>> {
  return new AudienceHeatEngine(config).deriveAll(state);
}

export function reconcileAudienceHeatState(
  state: ChatEngineState,
  config?: Partial<AudienceHeatEngineConfig>,
): ChatEngineState {
  return new AudienceHeatEngine(config).applyToState(state);
}

export function previewAudienceHeatState(
  state: ChatEngineState,
  config?: Partial<AudienceHeatEngineConfig>,
): readonly AudienceHeatPreview[] {
  return new AudienceHeatEngine(config).previewAll(state);
}

export function nudgeAudienceHeatFromMessage(
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
  message: ChatMessage,
  config?: Partial<AudienceHeatEngineConfig>,
): ChatEngineState {
  return new AudienceHeatEngine(config).nudgeFromMessage(state, channelId, message);
}

/* ============================================================================
 * MARK: Channel-specific policy helpers
 * ============================================================================
 */

export interface AudienceHeatChannelPolicy {
  readonly channelId: ChatVisibleChannel;
  readonly shouldShowWitnessBadge: boolean;
  readonly shouldPreferSwarmCopy: boolean;
  readonly shouldPreferQuietPredatorCopy: boolean;
  readonly shouldPreferRescuePrivacy: boolean;
  readonly shouldPreferLegendAmplification: boolean;
  readonly shouldPreferRidiculeSuppression: boolean;
}

export const AUDIENCE_HEAT_CHANNEL_POLICY: Readonly<Record<ChatVisibleChannel, AudienceHeatChannelPolicy>> = {
  GLOBAL: {
    channelId: 'GLOBAL',
    shouldShowWitnessBadge: true,
    shouldPreferSwarmCopy: true,
    shouldPreferQuietPredatorCopy: false,
    shouldPreferRescuePrivacy: false,
    shouldPreferLegendAmplification: true,
    shouldPreferRidiculeSuppression: false,
  },
  SYNDICATE: {
    channelId: 'SYNDICATE',
    shouldShowWitnessBadge: false,
    shouldPreferSwarmCopy: false,
    shouldPreferQuietPredatorCopy: false,
    shouldPreferRescuePrivacy: true,
    shouldPreferLegendAmplification: false,
    shouldPreferRidiculeSuppression: true,
  },
  DEAL_ROOM: {
    channelId: 'DEAL_ROOM',
    shouldShowWitnessBadge: false,
    shouldPreferSwarmCopy: false,
    shouldPreferQuietPredatorCopy: true,
    shouldPreferRescuePrivacy: true,
    shouldPreferLegendAmplification: false,
    shouldPreferRidiculeSuppression: true,
  },
  LOBBY: {
    channelId: 'LOBBY',
    shouldShowWitnessBadge: true,
    shouldPreferSwarmCopy: false,
    shouldPreferQuietPredatorCopy: false,
    shouldPreferRescuePrivacy: false,
    shouldPreferLegendAmplification: false,
    shouldPreferRidiculeSuppression: true,
  },
};

export function getAudienceHeatChannelPolicy(
  channelId: ChatVisibleChannel,
): AudienceHeatChannelPolicy {
  return AUDIENCE_HEAT_CHANNEL_POLICY[channelId];
}

/* ============================================================================
 * MARK: Debug diagnostics
 * ============================================================================
 */

export interface AudienceHeatDiagnostic {
  readonly channelId: ChatVisibleChannel;
  readonly heat: number;
  readonly hype: number;
  readonly ridicule: number;
  readonly scrutiny: number;
  readonly volatility: number;
  readonly mood: ChatChannelMood['mood'];
  readonly reasons: readonly string[];
  readonly summary: AudienceHeatSignalSummary;
}

export function buildAudienceHeatDiagnostics(
  state: ChatEngineState,
  config?: Partial<AudienceHeatEngineConfig>,
): readonly AudienceHeatDiagnostic[] {
  const engine = new AudienceHeatEngine(config);
  return CHAT_VISIBLE_CHANNELS.map((channelId) => {
    const derivation = engine.deriveForChannel(state, channelId);
    return {
      channelId,
      heat: scoreToNumber(derivation.next.heat),
      hype: scoreToNumber(derivation.next.hype),
      ridicule: scoreToNumber(derivation.next.ridicule),
      scrutiny: scoreToNumber(derivation.next.scrutiny),
      volatility: scoreToNumber(derivation.next.volatility),
      mood: derivation.mood.mood,
      reasons: derivation.reasons,
      summary: derivation.summary,
    };
  });
}

/* ============================================================================
 * MARK: Minimal integration helpers for future ChatEngine wiring
 * ============================================================================
 */

export interface AudienceHeatIntegrationResult {
  readonly nextState: ChatEngineState;
  readonly derivations: Readonly<Record<ChatVisibleChannel, AudienceHeatDerivation>>;
}

export function integrateAudienceHeat(
  state: ChatEngineState,
  config?: Partial<AudienceHeatEngineConfig>,
): AudienceHeatIntegrationResult {
  const engine = new AudienceHeatEngine(config);
  const derivations = engine.deriveAll(state);
  const nextState = engine.applyToState(state);
  return {
    nextState,
    derivations,
  };
}
