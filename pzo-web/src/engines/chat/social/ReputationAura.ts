/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT REPUTATION AURA ENGINE
 * FILE: pzo-web/src/engines/chat/social/ReputationAura.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Frontend reputation and aura runtime for the canonical chat lane.
 *
 * Heat answers: "what does the room feel right now?"
 * Reputation answers: "what does the room think this player is?"
 *
 * This runtime stays frontend-local because it is used to:
 * - drive immediate presentation and response flavor
 * - decide how intense aura framing should feel on this client
 * - keep the local experience coherent between authoritative syncs
 *
 * Backend still owns archival truth and long-horizon memory.
 *
 * Design laws
 * -----------
 * - Preserve ChatEngineState.reputation exactly.
 * - Read only from already-present runtime truth:
 *   messages, audience heat, mood, relationship state, affect state, scene state.
 * - Never fabricate financial or battle facts.
 * - Auras must be compositional and reversible.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import {
  CHAT_VISIBLE_CHANNELS,
  type ChatAffectSnapshot,
  type ChatChannelMood,
  type ChatEngineState,
  type ChatMessage,
  type ChatMessageKind,
  type ChatRelationshipState,
  type ChatReputationState,
  type ChatVisibleChannel,
  type Score100,
  type UnixMs,
} from '../types';
import { cloneChatEngineState } from '../ChatState';
import {
  createAudienceHeatEngine,
  type AudienceHeatDerivation,
  type AudienceHeatEngineConfig,
} from './AudienceHeatEngine';

/* ============================================================================
 * MARK: Numeric helpers
 * ============================================================================
 */

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function asScore100(value: number): Score100 {
  return Math.round(clamp(value, 0, 100)) as Score100;
}

function scoreToNumber(value: Score100 | number | undefined): number {
  if (typeof value !== 'number') return 0;
  return clamp(value, 0, 100);
}

function asUnixMs(value: number): UnixMs {
  return Math.trunc(Math.max(0, value)) as UnixMs;
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
  return (body ?? '').trim();
}

function containsAny(body: string, terms: readonly string[]): number {
  const lower = body.toLowerCase();
  let hits = 0;
  for (const term of terms) {
    if (lower.includes(term)) hits += 1;
  }
  return hits;
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

function bodyIntensityScore(body: string): number {
  return clamp(
    body.length * 0.22 +
      countMatches(body, /!/g) * 4 +
      countMatches(body, /\?/g) * 2 +
      countAllCapsWords(body) * 5,
    0,
    100,
  );
}

/* ============================================================================
 * MARK: Public runtime types
 * ============================================================================
 */

export type ReputationAuraAxis =
  | 'PUBLIC_AURA'
  | 'SYNDICATE_CREDIBILITY'
  | 'NEGOTIATION_FEAR'
  | 'COMEBACK_RESPECT'
  | 'HUMILIATION_RISK';

export interface ReputationAuraClock {
  now(): number;
}

export interface ReputationAuraVectorPatch {
  readonly publicAura?: number;
  readonly syndicateCredibility?: number;
  readonly negotiationFear?: number;
  readonly comebackRespect?: number;
  readonly humiliationRisk?: number;
}

export interface ReputationEvidenceSummary {
  readonly visibleMessageCount: number;
  readonly playerMessageCount: number;
  readonly systemMessageCount: number;
  readonly haterPressure: number;
  readonly helperSupport: number;
  readonly crowdWitness: number;
  readonly proofDensity: number;
  readonly legendDensity: number;
  readonly dealRoomExposure: number;
  readonly ridiculePressure: number;
  readonly respectPressure: number;
  readonly relationshipTrust: number;
  readonly relationshipRivalry: number;
  readonly socialEmbarrassment: number;
  readonly confidence: number;
  readonly momentum: number;
}

export interface ReputationAuraDerivation {
  readonly next: ChatReputationState;
  readonly patch: ReputationAuraVectorPatch;
  readonly reasons: readonly string[];
  readonly summary: ReputationEvidenceSummary;
  readonly dominantAura: ReputationAuraAxis;
  readonly channelDerivations: Readonly<Record<ChatVisibleChannel, AudienceHeatDerivation>>;
}

export interface ReputationAuraPreviewBadge {
  readonly axis: ReputationAuraAxis;
  readonly label: string;
  readonly score: number;
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly tone: 'POSITIVE' | 'NEGATIVE' | 'MIXED';
  readonly description: string;
}

export interface ReputationAuraPreview {
  readonly state: ChatReputationState;
  readonly dominantAura: ReputationAuraAxis;
  readonly reasons: readonly string[];
  readonly badges: readonly ReputationAuraPreviewBadge[];
}

export interface ReputationAuraMemoEntry {
  readonly derivedAt: UnixMs;
  readonly derivation: ReputationAuraDerivation;
}

export interface ReputationAuraConfig {
  readonly clock?: ReputationAuraClock;
  readonly transcriptWindowSize: number;
  readonly channelInfluence: Readonly<Record<ChatVisibleChannel, number>>;
  readonly heatInfluence: number;
  readonly relationshipInfluence: number;
  readonly affectInfluence: number;
  readonly proofInfluence: number;
  readonly legendInfluence: number;
  readonly dealRoomInfluence: number;
}

export interface ReputationAuraApi {
  readonly config: ReputationAuraConfig;
  warmState(state: ChatEngineState): void;
  derive(state: ChatEngineState): ReputationAuraDerivation;
  applyToState(state: ChatEngineState): ChatEngineState;
  preview(state: ChatEngineState): ReputationAuraPreview;
  nudgeFromMessage(state: ChatEngineState, message: ChatMessage): ChatEngineState;
  clearMemo(): void;
  getMemo(): ReputationAuraMemoEntry | undefined;
}

/* ============================================================================
 * MARK: Policy tables
 * ============================================================================
 */

const POSITIVE_WORDS = [
  'clean',
  'held',
  'hold',
  'stable',
  'precision',
  'recovered',
  'recover',
  'survive',
  'survived',
  'won',
  'win',
  'proof',
  'legend',
  'sovereignty',
  'locked',
  'disciplined',
  'finish',
  'comeback',
] as const;

const NEGATIVE_WORDS = [
  'panic',
  'collapse',
  'bankrupt',
  'failed',
  'exposed',
  'bleeding',
  'baited',
  'fraud',
  'humiliated',
  'weak',
  'overpaid',
  'dead',
  'caught',
  'folded',
  'broke',
  'spiral',
] as const;

const FEAR_WORDS = [
  'fear',
  'don’t blink',
  "don't blink",
  'finish him',
  'watching',
  'silent',
  'deadline',
  'final',
  'fold',
  'trap',
  'window',
  'close now',
] as const;

const RIDICULE_WORDS = [
  'lol',
  'lmao',
  'weak',
  'pathetic',
  'fraud',
  'easy',
  'dragged',
  'clipped',
  'exposed',
  'humiliated',
  'caught',
] as const;

const RESPECT_WORDS = [
  'respect',
  'steady',
  'disciplined',
  'clean',
  'precise',
  'comeback',
  'finish',
  'survive',
  'proof',
  'earned',
] as const;

const SYNDICATE_WORDS = [
  'formation',
  'clean',
  'team',
  'syndicate',
  'leak',
  'hold',
  'read',
  'calm',
  'discipline',
  'signal',
] as const;

const NEGOTIATION_WORDS = [
  'offer',
  'counter',
  'price',
  'bid',
  'deadline',
  'expiring',
  'expires',
  'concession',
  'take it',
  'leave it',
  'final',
] as const;

const MESSAGE_KIND_REPUTATION_PATCH: Readonly<Record<ChatMessageKind, ReputationAuraVectorPatch>> = {
  PLAYER: { publicAura: 1 },
  SYSTEM: {},
  MARKET_ALERT: { negotiationFear: 1 },
  ACHIEVEMENT: { publicAura: 7, comebackRespect: 5 },
  BOT_TAUNT: { humiliationRisk: 6, negotiationFear: 2 },
  BOT_ATTACK: { humiliationRisk: 5, negotiationFear: 4 },
  SHIELD_EVENT: { humiliationRisk: 4 },
  CASCADE_ALERT: { humiliationRisk: 5, publicAura: -1 },
  DEAL_RECAP: { negotiationFear: 3, syndicateCredibility: 1 },
  NPC_AMBIENT: {},
  HELPER_PROMPT: { syndicateCredibility: 1 },
  HELPER_RESCUE: { publicAura: -1, comebackRespect: 2 },
  HATER_TELEGRAPH: { negotiationFear: 3, humiliationRisk: 3 },
  HATER_PUNISH: { humiliationRisk: 8, publicAura: -4 },
  CROWD_REACTION: { publicAura: 3, humiliationRisk: 2 },
  RELATIONSHIP_CALLBACK: { publicAura: 2, syndicateCredibility: 2, humiliationRisk: 2 },
  QUOTE_CALLBACK: { humiliationRisk: 7, publicAura: -2 },
  NEGOTIATION_OFFER: { negotiationFear: 5 },
  NEGOTIATION_COUNTER: { negotiationFear: 7, publicAura: 1 },
  LEGEND_MOMENT: { publicAura: 12, comebackRespect: 12, humiliationRisk: -10 },
  POST_RUN_RITUAL: { publicAura: 1, comebackRespect: 2 },
  WORLD_EVENT: { publicAura: 2, negotiationFear: 1 },
  SYSTEM_SHADOW_MARKER: {},
};

const DEFAULT_CONFIG: ReputationAuraConfig = {
  clock: { now: () => Date.now() },
  transcriptWindowSize: 30,
  channelInfluence: {
    GLOBAL: 1,
    SYNDICATE: 0.95,
    DEAL_ROOM: 1.15,
    LOBBY: 0.55,
  },
  heatInfluence: 0.75,
  relationshipInfluence: 0.9,
  affectInfluence: 0.85,
  proofInfluence: 1,
  legendInfluence: 1.2,
  dealRoomInfluence: 1.1,
};

/* ============================================================================
 * MARK: Low-level signal extraction
 * ============================================================================
 */

function sentimentTilt(body: string): number {
  return containsAny(body, POSITIVE_WORDS) - containsAny(body, NEGATIVE_WORDS);
}

function witnessScore(message: ChatMessage): number {
  const body = normalizeBody(message.body);
  let score = 0;
  if (message.proofHash || message.proof) score += 18;
  if (message.legend?.unlocksReward) score += 24;
  if (message.replay?.legendEligible) score += 12;
  if (message.kind === 'LEGEND_MOMENT') score += 30;
  if (message.kind === 'QUOTE_CALLBACK') score += 18;
  score += containsAny(body, [
    'the room',
    'everyone',
    'everybody',
    'witnessed',
    'all saw',
    'archive this',
    'quote this',
    'remember this',
  ]) * 8;
  return clamp(score + bodyIntensityScore(body) * 0.2, 0, 100);
}

function proofScore(message: ChatMessage): number {
  let score = 0;
  if (message.proofHash) score += 20;
  if (message.proof) score += 16;
  if (message.kind === 'LEGEND_MOMENT') score += 30;
  if (message.kind === 'ACHIEVEMENT') score += 12;
  return clamp(score, 0, 100);
}

function ridiculeScore(message: ChatMessage): number {
  const body = normalizeBody(message.body).toLowerCase();
  let score = containsAny(body, RIDICULE_WORDS) * 9;
  if (message.kind === 'BOT_TAUNT') score += 18;
  if (message.kind === 'HATER_PUNISH') score += 24;
  if (message.kind === 'QUOTE_CALLBACK') score += 16;
  return clamp(score + countMatches(body, /!/g) * 2, 0, 100);
}

function respectScore(message: ChatMessage): number {
  const body = normalizeBody(message.body).toLowerCase();
  let score = containsAny(body, RESPECT_WORDS) * 8;
  if (message.kind === 'ACHIEVEMENT') score += 10;
  if (message.kind === 'LEGEND_MOMENT') score += 20;
  return clamp(score, 0, 100);
}

function fearScore(message: ChatMessage): number {
  const body = normalizeBody(message.body).toLowerCase();
  let score = containsAny(body, FEAR_WORDS) * 8;
  if (message.kind === 'NEGOTIATION_COUNTER') score += 12;
  if (message.kind === 'BOT_ATTACK') score += 14;
  return clamp(score, 0, 100);
}

function syndicateCredScore(message: ChatMessage): number {
  const body = normalizeBody(message.body).toLowerCase();
  let score = containsAny(body, SYNDICATE_WORDS) * 7;
  if (message.channel === 'SYNDICATE') score += 8;
  if (message.kind === 'HELPER_PROMPT') score += 6;
  if (message.kind === 'RELATIONSHIP_CALLBACK') score += 5;
  return clamp(score, 0, 100);
}

function negotiationExposureScore(message: ChatMessage): number {
  const body = normalizeBody(message.body).toLowerCase();
  let score = containsAny(body, NEGOTIATION_WORDS) * 8;
  if (message.channel === 'DEAL_ROOM') score += 12;
  if (message.kind === 'NEGOTIATION_OFFER') score += 14;
  if (message.kind === 'NEGOTIATION_COUNTER') score += 18;
  return clamp(score, 0, 100);
}

function relationshipTrustScore(relationships: readonly ChatRelationshipState[]): number {
  if (!relationships.length) return 0;
  return clamp(
    avg(
      relationships.map((relationship) => {
        const v = relationship.vector;
        return (
          scoreToNumber(v.trust) * 0.35 +
          scoreToNumber(v.respect) * 0.2 +
          scoreToNumber(v.familiarity) * 0.15 +
          scoreToNumber(v.adviceObedience) * 0.2 -
          scoreToNumber(v.contempt) * 0.1
        );
      }),
    ),
    0,
    100,
  );
}

function relationshipRivalryScore(relationships: readonly ChatRelationshipState[]): number {
  if (!relationships.length) return 0;
  return clamp(
    avg(
      relationships.map((relationship) => {
        const v = relationship.vector;
        let score =
          scoreToNumber(v.rivalryIntensity) * 0.42 +
          scoreToNumber(v.fear) * 0.16 +
          scoreToNumber(v.contempt) * 0.22 +
          scoreToNumber(v.fascination) * 0.12;
        if (relationship.escalationTier === 'OBSESSIVE') score += 18;
        else if (relationship.escalationTier === 'ACTIVE') score += 10;
        return clamp(score, 0, 100);
      }),
    ),
    0,
    100,
  );
}

function affectSupport(affect: ChatAffectSnapshot): { embarrassment: number; confidence: number } {
  return {
    embarrassment: scoreToNumber(affect.vector.socialEmbarrassment),
    confidence: scoreToNumber(affect.vector.confidence),
  };
}

function determineDominantAura(reputation: ChatReputationState): ReputationAuraAxis {
  const candidates: Array<[ReputationAuraAxis, number]> = [
    ['PUBLIC_AURA', scoreToNumber(reputation.publicAura)],
    ['SYNDICATE_CREDIBILITY', scoreToNumber(reputation.syndicateCredibility)],
    ['NEGOTIATION_FEAR', scoreToNumber(reputation.negotiationFear)],
    ['COMEBACK_RESPECT', scoreToNumber(reputation.comebackRespect)],
    ['HUMILIATION_RISK', scoreToNumber(reputation.humiliationRisk)],
  ];
  candidates.sort((a, b) => b[1] - a[1]);
  return candidates[0]?.[0] ?? 'PUBLIC_AURA';
}

function mergeConfig(config?: Partial<ReputationAuraConfig>): ReputationAuraConfig {
  if (!config) return DEFAULT_CONFIG;
  return {
    clock: config.clock ?? DEFAULT_CONFIG.clock,
    transcriptWindowSize: config.transcriptWindowSize ?? DEFAULT_CONFIG.transcriptWindowSize,
    channelInfluence: {
      GLOBAL: config.channelInfluence?.GLOBAL ?? DEFAULT_CONFIG.channelInfluence.GLOBAL,
      SYNDICATE: config.channelInfluence?.SYNDICATE ?? DEFAULT_CONFIG.channelInfluence.SYNDICATE,
      DEAL_ROOM: config.channelInfluence?.DEAL_ROOM ?? DEFAULT_CONFIG.channelInfluence.DEAL_ROOM,
      LOBBY: config.channelInfluence?.LOBBY ?? DEFAULT_CONFIG.channelInfluence.LOBBY,
    },
    heatInfluence: config.heatInfluence ?? DEFAULT_CONFIG.heatInfluence,
    relationshipInfluence: config.relationshipInfluence ?? DEFAULT_CONFIG.relationshipInfluence,
    affectInfluence: config.affectInfluence ?? DEFAULT_CONFIG.affectInfluence,
    proofInfluence: config.proofInfluence ?? DEFAULT_CONFIG.proofInfluence,
    legendInfluence: config.legendInfluence ?? DEFAULT_CONFIG.legendInfluence,
    dealRoomInfluence: config.dealRoomInfluence ?? DEFAULT_CONFIG.dealRoomInfluence,
  };
}

function addPatch(
  base: Required<ReputationAuraVectorPatch>,
  patch: ReputationAuraVectorPatch | undefined,
  multiplier = 1,
): Required<ReputationAuraVectorPatch> {
  if (!patch) return base;
  return {
    publicAura: base.publicAura + (patch.publicAura ?? 0) * multiplier,
    syndicateCredibility:
      base.syndicateCredibility + (patch.syndicateCredibility ?? 0) * multiplier,
    negotiationFear: base.negotiationFear + (patch.negotiationFear ?? 0) * multiplier,
    comebackRespect: base.comebackRespect + (patch.comebackRespect ?? 0) * multiplier,
    humiliationRisk: base.humiliationRisk + (patch.humiliationRisk ?? 0) * multiplier,
  };
}

function emptyPatch(): Required<ReputationAuraVectorPatch> {
  return {
    publicAura: 0,
    syndicateCredibility: 0,
    negotiationFear: 0,
    comebackRespect: 0,
    humiliationRisk: 0,
  };
}

function applyPatch(base: ChatReputationState, patch: Required<ReputationAuraVectorPatch>): ChatReputationState {
  return {
    publicAura: asScore100(scoreToNumber(base.publicAura) + patch.publicAura),
    syndicateCredibility: asScore100(
      scoreToNumber(base.syndicateCredibility) + patch.syndicateCredibility,
    ),
    negotiationFear: asScore100(scoreToNumber(base.negotiationFear) + patch.negotiationFear),
    comebackRespect: asScore100(scoreToNumber(base.comebackRespect) + patch.comebackRespect),
    humiliationRisk: asScore100(scoreToNumber(base.humiliationRisk) + patch.humiliationRisk),
  };
}

function flattenVisibleMessages(
  state: ChatEngineState,
  maxPerChannel: number,
): readonly ChatMessage[] {
  const all = CHAT_VISIBLE_CHANNELS.flatMap((channel) => {
    const list = state.messagesByChannel[channel] ?? [];
    return list.length <= maxPerChannel ? list : list.slice(-maxPerChannel);
  });
  return all.sort((a, b) => a.ts - b.ts);
}

function badgeSeverity(value: number): ReputationAuraPreviewBadge['severity'] {
  if (value >= 75) return 'CRITICAL';
  if (value >= 55) return 'HIGH';
  if (value >= 30) return 'MEDIUM';
  return 'LOW';
}

function positiveToneFor(axis: ReputationAuraAxis): ReputationAuraPreviewBadge['tone'] {
  if (axis === 'HUMILIATION_RISK') return 'NEGATIVE';
  if (axis === 'NEGOTIATION_FEAR') return 'MIXED';
  return 'POSITIVE';
}

/* ============================================================================
 * MARK: Core runtime
 * ============================================================================
 */

export class ReputationAura implements ReputationAuraApi {
  public readonly config: ReputationAuraConfig;
  private readonly clock: ReputationAuraClock;
  private memo?: ReputationAuraMemoEntry;

  public constructor(config?: Partial<ReputationAuraConfig>) {
    this.config = mergeConfig(config);
    this.clock = this.config.clock ?? { now: () => Date.now() };
  }

  public clearMemo(): void {
    this.memo = undefined;
  }

  public getMemo(): ReputationAuraMemoEntry | undefined {
    return this.memo;
  }

  public warmState(state: ChatEngineState): void {
    this.memo = {
      derivedAt: asUnixMs(this.clock.now()),
      derivation: this.derive(state),
    };
  }

  public derive(state: ChatEngineState): ReputationAuraDerivation {
    const now = this.clock.now();
    const channelDerivations = createAudienceHeatEngine().deriveAll(state);
    const transcript = flattenVisibleMessages(state, this.config.transcriptWindowSize);
    const relationships = Object.values(state.relationshipsByCounterpartId);

    const visibleMessageCount = transcript.length;
    const playerMessageCount = transcript.filter((message) => message.kind === 'PLAYER').length;
    const systemMessageCount = transcript.filter((message) => message.kind === 'SYSTEM').length;
    const haterPressure = avg(
      transcript.map((message) => {
        if (message.kind === 'BOT_ATTACK') return 85;
        if (message.kind === 'BOT_TAUNT') return 70;
        if (message.kind === 'HATER_TELEGRAPH') return 74;
        if (message.kind === 'HATER_PUNISH') return 90;
        return 0;
      }),
    );
    const helperSupport = avg(
      transcript.map((message) => {
        if (message.kind === 'HELPER_RESCUE') return 80;
        if (message.kind === 'HELPER_PROMPT') return 52;
        return 0;
      }),
    );
    const crowdWitness = avg(transcript.map(witnessScore));
    const proofDensity = avg(transcript.map(proofScore));
    const legendDensity = avg(
      transcript.map((message) => (message.kind === 'LEGEND_MOMENT' ? 100 : 0)),
    );
    const dealRoomExposure = avg(transcript.map(negotiationExposureScore));
    const ridiculePressure = avg(transcript.map(ridiculeScore));
    const respectPressure = avg(transcript.map(respectScore));
    const relationshipTrust = relationshipTrustScore(relationships);
    const relationshipRivalry = relationshipRivalryScore(relationships);
    const { embarrassment: socialEmbarrassment, confidence } = affectSupport(state.affect);
    const momentum = avg(
      transcript.map((message) => sentimentTilt(normalizeBody(message.body))),
    ) * 12;

    const summary: ReputationEvidenceSummary = {
      visibleMessageCount,
      playerMessageCount,
      systemMessageCount,
      haterPressure,
      helperSupport,
      crowdWitness,
      proofDensity,
      legendDensity,
      dealRoomExposure,
      ridiculePressure,
      respectPressure,
      relationshipTrust,
      relationshipRivalry,
      socialEmbarrassment,
      confidence,
      momentum,
    };

    const reasons: string[] = [];
    let patch = emptyPatch();

    for (const message of transcript) {
      const body = normalizeBody(message.body).toLowerCase();
      const intensity = bodyIntensityScore(body);
      const channelWeight = this.config.channelInfluence[message.channel];
      const basePatch = MESSAGE_KIND_REPUTATION_PATCH[message.kind] ?? {};
      const dynamicPatch = emptyPatch();

      dynamicPatch.publicAura += witnessScore(message) * 0.03;
      dynamicPatch.publicAura += proofScore(message) * 0.04 * this.config.proofInfluence;
      dynamicPatch.publicAura += respectScore(message) * 0.03;
      dynamicPatch.publicAura -= ridiculeScore(message) * 0.04;

      dynamicPatch.syndicateCredibility += syndicateCredScore(message) * 0.05;
      dynamicPatch.syndicateCredibility += respectScore(message) * 0.02;
      dynamicPatch.syndicateCredibility -= ridiculeScore(message) * 0.02;

      dynamicPatch.negotiationFear += negotiationExposureScore(message) * 0.05 * this.config.dealRoomInfluence;
      dynamicPatch.negotiationFear += fearScore(message) * 0.04;
      dynamicPatch.negotiationFear += witnessScore(message) * 0.01;

      dynamicPatch.comebackRespect += respectScore(message) * 0.05;
      dynamicPatch.comebackRespect += Math.max(0, sentimentTilt(body)) * 0.8;
      if (message.kind === 'LEGEND_MOMENT' || message.kind === 'ACHIEVEMENT') {
        dynamicPatch.comebackRespect += 8 * this.config.legendInfluence;
      }

      dynamicPatch.humiliationRisk += ridiculeScore(message) * 0.05;
      dynamicPatch.humiliationRisk += Math.max(0, -sentimentTilt(body)) * 1.1;
      dynamicPatch.humiliationRisk += countAllCapsWords(body) * 1.5;
      if (message.kind === 'HATER_PUNISH') dynamicPatch.humiliationRisk += 7;

      patch = addPatch(patch, basePatch, channelWeight);
      patch = addPatch(patch, dynamicPatch, 1 + intensity / 300);
    }

    if (crowdWitness > 0) {
      reasons.push('crowd witness');
      patch.publicAura += crowdWitness * 0.1 * this.config.heatInfluence;
      patch.humiliationRisk += crowdWitness * 0.07 * this.config.heatInfluence;
    }

    if (proofDensity > 0) {
      reasons.push('proof density');
      patch.publicAura += proofDensity * 0.12 * this.config.proofInfluence;
      patch.comebackRespect += proofDensity * 0.08 * this.config.proofInfluence;
      patch.humiliationRisk -= proofDensity * 0.05 * this.config.proofInfluence;
    }

    if (legendDensity > 0) {
      reasons.push('legend density');
      patch.publicAura += legendDensity * 0.18 * this.config.legendInfluence;
      patch.comebackRespect += legendDensity * 0.16 * this.config.legendInfluence;
      patch.humiliationRisk -= legendDensity * 0.12 * this.config.legendInfluence;
    }

    if (relationshipTrust > 0) {
      reasons.push('relationship trust');
      patch.syndicateCredibility += relationshipTrust * 0.12 * this.config.relationshipInfluence;
      patch.comebackRespect += relationshipTrust * 0.05 * this.config.relationshipInfluence;
      patch.humiliationRisk -= relationshipTrust * 0.08 * this.config.relationshipInfluence;
    }

    if (relationshipRivalry > 0) {
      reasons.push('relationship rivalry');
      patch.publicAura += relationshipRivalry * 0.04;
      patch.negotiationFear += relationshipRivalry * 0.06;
      patch.humiliationRisk += relationshipRivalry * 0.08;
    }

    if (socialEmbarrassment > 0) {
      reasons.push('social embarrassment');
      patch.publicAura -= socialEmbarrassment * 0.08 * this.config.affectInfluence;
      patch.humiliationRisk += socialEmbarrassment * 0.16 * this.config.affectInfluence;
    }

    if (confidence > 0) {
      reasons.push('confidence');
      patch.publicAura += confidence * 0.05 * this.config.affectInfluence;
      patch.comebackRespect += confidence * 0.08 * this.config.affectInfluence;
      patch.negotiationFear += confidence * 0.02 * this.config.affectInfluence;
    }

    if (helperSupport > 0) {
      reasons.push('helper support');
      patch.syndicateCredibility += helperSupport * 0.05;
      patch.comebackRespect += helperSupport * 0.04;
      patch.humiliationRisk -= helperSupport * 0.05;
    }

    if (haterPressure > 0) {
      reasons.push('hater pressure');
      patch.negotiationFear += haterPressure * 0.07;
      patch.humiliationRisk += haterPressure * 0.05;
    }

    if (dealRoomExposure > 0) {
      reasons.push('deal room exposure');
      patch.negotiationFear += dealRoomExposure * 0.1 * this.config.dealRoomInfluence;
      patch.publicAura += dealRoomExposure * 0.03;
    }

    patch.publicAura += scoreToNumber(channelDerivations.GLOBAL.next.hype) * 0.05;
    patch.publicAura -= scoreToNumber(channelDerivations.GLOBAL.next.ridicule) * 0.06;
    patch.syndicateCredibility += scoreToNumber(channelDerivations.SYNDICATE.next.scrutiny) * 0.025;
    patch.syndicateCredibility -= scoreToNumber(channelDerivations.SYNDICATE.next.ridicule) * 0.02;
    patch.negotiationFear += scoreToNumber(channelDerivations.DEAL_ROOM.next.scrutiny) * 0.08;
    patch.negotiationFear += scoreToNumber(channelDerivations.DEAL_ROOM.next.volatility) * 0.04;
    patch.comebackRespect += scoreToNumber(channelDerivations.GLOBAL.next.hype) * 0.04;
    patch.humiliationRisk += scoreToNumber(channelDerivations.GLOBAL.next.ridicule) * 0.09;
    patch.humiliationRisk += scoreToNumber(channelDerivations.GLOBAL.next.scrutiny) * 0.05;

    if (momentum > 0) {
      reasons.push('positive momentum');
      patch.publicAura += momentum * 0.22;
      patch.comebackRespect += momentum * 0.28;
      patch.humiliationRisk -= momentum * 0.15;
    } else if (momentum < 0) {
      reasons.push('negative momentum');
      patch.publicAura += momentum * 0.18;
      patch.humiliationRisk += Math.abs(momentum) * 0.28;
    }

    const next = applyPatch(state.reputation, patch);
    const dominantAura = determineDominantAura(next);

    const derivation: ReputationAuraDerivation = {
      next,
      patch,
      reasons,
      summary,
      dominantAura,
      channelDerivations,
    };

    this.memo = {
      derivedAt: asUnixMs(now),
      derivation,
    };

    return derivation;
  }

  public applyToState(state: ChatEngineState): ChatEngineState {
    const derivation = this.derive(state);
    const next = cloneChatEngineState(state);
    return {
      ...next,
      reputation: {
        ...derivation.next,
      },
    };
  }

  public preview(state: ChatEngineState): ReputationAuraPreview {
    const derivation = this.derive(state);
    const next = derivation.next;
    const badges: ReputationAuraPreviewBadge[] = [
      {
        axis: 'PUBLIC_AURA',
        label: 'Public Aura',
        score: scoreToNumber(next.publicAura),
        severity: badgeSeverity(scoreToNumber(next.publicAura)),
        tone: positiveToneFor('PUBLIC_AURA'),
        description: 'How strong the player appears in the public room',
      },
      {
        axis: 'SYNDICATE_CREDIBILITY',
        label: 'Syndicate Credibility',
        score: scoreToNumber(next.syndicateCredibility),
        severity: badgeSeverity(scoreToNumber(next.syndicateCredibility)),
        tone: positiveToneFor('SYNDICATE_CREDIBILITY'),
        description: 'How trustworthy and composed the player looks to allies',
      },
      {
        axis: 'NEGOTIATION_FEAR',
        label: 'Negotiation Fear',
        score: scoreToNumber(next.negotiationFear),
        severity: badgeSeverity(scoreToNumber(next.negotiationFear)),
        tone: positiveToneFor('NEGOTIATION_FEAR'),
        description: 'How much deal-room pressure the player projects',
      },
      {
        axis: 'COMEBACK_RESPECT',
        label: 'Comeback Respect',
        score: scoreToNumber(next.comebackRespect),
        severity: badgeSeverity(scoreToNumber(next.comebackRespect)),
        tone: positiveToneFor('COMEBACK_RESPECT'),
        description: 'How much earned resilience the room now attributes',
      },
      {
        axis: 'HUMILIATION_RISK',
        label: 'Humiliation Risk',
        score: scoreToNumber(next.humiliationRisk),
        severity: badgeSeverity(scoreToNumber(next.humiliationRisk)),
        tone: positiveToneFor('HUMILIATION_RISK'),
        description: 'How vulnerable the player is to social weaponization',
      },
    ];

    return {
      state: next,
      dominantAura: derivation.dominantAura,
      reasons: derivation.reasons,
      badges,
    };
  }

  public nudgeFromMessage(state: ChatEngineState, message: ChatMessage): ChatEngineState {
    const body = normalizeBody(message.body).toLowerCase();
    const base = MESSAGE_KIND_REPUTATION_PATCH[message.kind] ?? {};
    const dynamic = emptyPatch();

    dynamic.publicAura += witnessScore(message) * 0.03;
    dynamic.publicAura += respectScore(message) * 0.02;
    dynamic.publicAura -= ridiculeScore(message) * 0.03;
    dynamic.syndicateCredibility += syndicateCredScore(message) * 0.04;
    dynamic.negotiationFear += negotiationExposureScore(message) * 0.05 + fearScore(message) * 0.03;
    dynamic.comebackRespect += respectScore(message) * 0.04 + Math.max(0, sentimentTilt(body)) * 0.4;
    dynamic.humiliationRisk += ridiculeScore(message) * 0.05 + Math.max(0, -sentimentTilt(body)) * 0.45;

    const patch = addPatch(addPatch(emptyPatch(), base), dynamic);
    const next = applyPatch(state.reputation, patch);

    const cloned = cloneChatEngineState(state);
    return {
      ...cloned,
      reputation: { ...next },
    };
  }
}

/* ============================================================================
 * MARK: Stateless exports
 * ============================================================================
 */

export function createReputationAura(
  config?: Partial<ReputationAuraConfig>,
): ReputationAura {
  return new ReputationAura(config);
}

export function deriveReputationAura(
  state: ChatEngineState,
  config?: Partial<ReputationAuraConfig>,
): ReputationAuraDerivation {
  return new ReputationAura(config).derive(state);
}

export function reconcileReputationAuraState(
  state: ChatEngineState,
  config?: Partial<ReputationAuraConfig>,
): ChatEngineState {
  return new ReputationAura(config).applyToState(state);
}

export function previewReputationAura(
  state: ChatEngineState,
  config?: Partial<ReputationAuraConfig>,
): ReputationAuraPreview {
  return new ReputationAura(config).preview(state);
}

export function nudgeReputationAuraFromMessage(
  state: ChatEngineState,
  message: ChatMessage,
  config?: Partial<ReputationAuraConfig>,
): ChatEngineState {
  return new ReputationAura(config).nudgeFromMessage(state, message);
}

/* ============================================================================
 * MARK: Diagnostics
 * ============================================================================
 */

export interface ReputationAuraDiagnostic {
  readonly derivedAt: UnixMs;
  readonly publicAura: number;
  readonly syndicateCredibility: number;
  readonly negotiationFear: number;
  readonly comebackRespect: number;
  readonly humiliationRisk: number;
  readonly dominantAura: ReputationAuraAxis;
  readonly reasons: readonly string[];
  readonly summary: ReputationEvidenceSummary;
  readonly channelHeat: Readonly<Record<ChatVisibleChannel, number>>;
}

export function buildReputationAuraDiagnostic(
  state: ChatEngineState,
  heatConfig?: Partial<AudienceHeatEngineConfig>,
  reputationConfig?: Partial<ReputationAuraConfig>,
): ReputationAuraDiagnostic {
  const heatDerivations = createAudienceHeatEngine(heatConfig).deriveAll(state);
  const aura = new ReputationAura(reputationConfig);
  const derivation = aura.derive(state);
  const now = reputationConfig?.clock?.now?.() ?? Date.now();

  return {
    derivedAt: asUnixMs(now),
    publicAura: scoreToNumber(derivation.next.publicAura),
    syndicateCredibility: scoreToNumber(derivation.next.syndicateCredibility),
    negotiationFear: scoreToNumber(derivation.next.negotiationFear),
    comebackRespect: scoreToNumber(derivation.next.comebackRespect),
    humiliationRisk: scoreToNumber(derivation.next.humiliationRisk),
    dominantAura: derivation.dominantAura,
    reasons: derivation.reasons,
    summary: derivation.summary,
    channelHeat: {
      GLOBAL: scoreToNumber(heatDerivations.GLOBAL.next.heat),
      SYNDICATE: scoreToNumber(heatDerivations.SYNDICATE.next.heat),
      DEAL_ROOM: scoreToNumber(heatDerivations.DEAL_ROOM.next.heat),
      LOBBY: scoreToNumber(heatDerivations.LOBBY.next.heat),
    },
  };
}

export interface PublicAuraPresentationPolicy {
  readonly axis: ReputationAuraAxis;
  readonly label: string;
  readonly positiveCopy: readonly string[];
  readonly negativeCopy: readonly string[];
  readonly mixedCopy: readonly string[];
}

export const PUBLIC_AURA_PRESENTATION_POLICY: PublicAuraPresentationPolicy = {
  axis: 'PUBLIC_AURA',
  label: 'Public Aura',
  positiveCopy: [
    'Public Aura signal is rising.',
    'The room is starting to encode this identity.',
    'Visible evidence is reinforcing this axis.',
    'Recent witness lines support this aura.',
    'Current social reading keeps leaning in this direction.',
  ],
  negativeCopy: [
    'Public Aura is decaying under pressure.',
    'Recent visible evidence is weakening this axis.',
    'The room is no longer granting this aura freely.',
    'Counter-signals are eating into this reputation layer.',
    'Momentum is cutting against this axis.',
  ],
  mixedCopy: [
    'Public Aura is contested.',
    'Evidence for this aura is mixed across channels.',
    'The room is split on this read.',
    'Local heat and reputation are not fully aligned here.',
    'This axis is active, but not settled.',
  ],
};


export interface SyndicateCredibilityPresentationPolicy {
  readonly axis: ReputationAuraAxis;
  readonly label: string;
  readonly positiveCopy: readonly string[];
  readonly negativeCopy: readonly string[];
  readonly mixedCopy: readonly string[];
}

export const SYNDICATE_CREDIBILITY_PRESENTATION_POLICY: SyndicateCredibilityPresentationPolicy = {
  axis: 'SYNDICATE_CREDIBILITY',
  label: 'Syndicate Credibility',
  positiveCopy: [
    'Syndicate Credibility signal is rising.',
    'The room is starting to encode this identity.',
    'Visible evidence is reinforcing this axis.',
    'Recent witness lines support this aura.',
    'Current social reading keeps leaning in this direction.',
  ],
  negativeCopy: [
    'Syndicate Credibility is decaying under pressure.',
    'Recent visible evidence is weakening this axis.',
    'The room is no longer granting this aura freely.',
    'Counter-signals are eating into this reputation layer.',
    'Momentum is cutting against this axis.',
  ],
  mixedCopy: [
    'Syndicate Credibility is contested.',
    'Evidence for this aura is mixed across channels.',
    'The room is split on this read.',
    'Local heat and reputation are not fully aligned here.',
    'This axis is active, but not settled.',
  ],
};


export interface NegotiationFearPresentationPolicy {
  readonly axis: ReputationAuraAxis;
  readonly label: string;
  readonly positiveCopy: readonly string[];
  readonly negativeCopy: readonly string[];
  readonly mixedCopy: readonly string[];
}

export const NEGOTIATION_FEAR_PRESENTATION_POLICY: NegotiationFearPresentationPolicy = {
  axis: 'NEGOTIATION_FEAR',
  label: 'Negotiation Fear',
  positiveCopy: [
    'Negotiation Fear signal is rising.',
    'The room is starting to encode this identity.',
    'Visible evidence is reinforcing this axis.',
    'Recent witness lines support this aura.',
    'Current social reading keeps leaning in this direction.',
  ],
  negativeCopy: [
    'Negotiation Fear is decaying under pressure.',
    'Recent visible evidence is weakening this axis.',
    'The room is no longer granting this aura freely.',
    'Counter-signals are eating into this reputation layer.',
    'Momentum is cutting against this axis.',
  ],
  mixedCopy: [
    'Negotiation Fear is contested.',
    'Evidence for this aura is mixed across channels.',
    'The room is split on this read.',
    'Local heat and reputation are not fully aligned here.',
    'This axis is active, but not settled.',
  ],
};


export interface ComebackRespectPresentationPolicy {
  readonly axis: ReputationAuraAxis;
  readonly label: string;
  readonly positiveCopy: readonly string[];
  readonly negativeCopy: readonly string[];
  readonly mixedCopy: readonly string[];
}

export const COMEBACK_RESPECT_PRESENTATION_POLICY: ComebackRespectPresentationPolicy = {
  axis: 'COMEBACK_RESPECT',
  label: 'Comeback Respect',
  positiveCopy: [
    'Comeback Respect signal is rising.',
    'The room is starting to encode this identity.',
    'Visible evidence is reinforcing this axis.',
    'Recent witness lines support this aura.',
    'Current social reading keeps leaning in this direction.',
  ],
  negativeCopy: [
    'Comeback Respect is decaying under pressure.',
    'Recent visible evidence is weakening this axis.',
    'The room is no longer granting this aura freely.',
    'Counter-signals are eating into this reputation layer.',
    'Momentum is cutting against this axis.',
  ],
  mixedCopy: [
    'Comeback Respect is contested.',
    'Evidence for this aura is mixed across channels.',
    'The room is split on this read.',
    'Local heat and reputation are not fully aligned here.',
    'This axis is active, but not settled.',
  ],
};


export interface HumiliationRiskPresentationPolicy {
  readonly axis: ReputationAuraAxis;
  readonly label: string;
  readonly positiveCopy: readonly string[];
  readonly negativeCopy: readonly string[];
  readonly mixedCopy: readonly string[];
}

export const HUMILIATION_RISK_PRESENTATION_POLICY: HumiliationRiskPresentationPolicy = {
  axis: 'HUMILIATION_RISK',
  label: 'Humiliation Risk',
  positiveCopy: [
    'Humiliation Risk signal is rising.',
    'The room is starting to encode this identity.',
    'Visible evidence is reinforcing this axis.',
    'Recent witness lines support this aura.',
    'Current social reading keeps leaning in this direction.',
  ],
  negativeCopy: [
    'Humiliation Risk is decaying under pressure.',
    'Recent visible evidence is weakening this axis.',
    'The room is no longer granting this aura freely.',
    'Counter-signals are eating into this reputation layer.',
    'Momentum is cutting against this axis.',
  ],
  mixedCopy: [
    'Humiliation Risk is contested.',
    'Evidence for this aura is mixed across channels.',
    'The room is split on this read.',
    'Local heat and reputation are not fully aligned here.',
    'This axis is active, but not settled.',
  ],
};


export const REPUTATION_AURA_PRESENTATION_POLICIES = {
  PUBLIC_AURA: PUBLIC_AURA_PRESENTATION_POLICY,
  SYNDICATE_CREDIBILITY: SYNDICATE_CREDIBILITY_PRESENTATION_POLICY,
  NEGOTIATION_FEAR: NEGOTIATION_FEAR_PRESENTATION_POLICY,
  COMEBACK_RESPECT: COMEBACK_RESPECT_PRESENTATION_POLICY,
  HUMILIATION_RISK: HUMILIATION_RISK_PRESENTATION_POLICY,
} as const;

export function describeReputationAxis(
  axis: ReputationAuraAxis,
  score: number,
): string {
  const policy = REPUTATION_AURA_PRESENTATION_POLICIES[axis];
  if (score >= 65) return policy.positiveCopy[0] ?? policy.label;
  if (score <= 25) return policy.negativeCopy[0] ?? policy.label;
  return policy.mixedCopy[0] ?? policy.label;
}

export function describeDominantAura(
  derivation: ReputationAuraDerivation,
): string {
  const dominant = derivation.dominantAura;
  switch (dominant) {
    case 'PUBLIC_AURA':
      return describeReputationAxis(dominant, derivation.next.publicAura);
    case 'SYNDICATE_CREDIBILITY':
      return describeReputationAxis(dominant, derivation.next.syndicateCredibility);
    case 'NEGOTIATION_FEAR':
      return describeReputationAxis(dominant, derivation.next.negotiationFear);
    case 'COMEBACK_RESPECT':
      return describeReputationAxis(dominant, derivation.next.comebackRespect);
    case 'HUMILIATION_RISK':
      return describeReputationAxis(dominant, derivation.next.humiliationRisk);
    default:
      return 'Aura is unresolved.';
  }
}
