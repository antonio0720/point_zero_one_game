/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT SOCIAL AUTHORITY
 * ============================================================================
 * backend/src/game/engine/chat/social/CrowdSynthesisEngine.ts
 * This file is backend-owned runtime logic for the social pressure layer.
 * It is intentionally not a UI helper and not a shared-law contract.
 * It consumes social state, reputation state, channel mood, and event metadata
 * to synthesize authored crowd behavior for the run.
 *
 * Generated for repo-grounded integration work on antonio0720/point_zero_one_game.
 * ============================================================================
 */

import type { ChatChannelId } from '../types';
import type {
  ChatAudienceMood,
  ChatAudienceHeatSummary,
  ChatAudienceSwarmRisk,
  ChatAudienceWitnessDensityBand,
} from '../../../../../../shared/contracts/chat/ChatAudienceHeat';
import type {
  ChatReputationSummary,
  ChatReputationBand,
} from '../../../../../../shared/contracts/chat/ChatReputation';

type Nullable<T> = T | null;
type Optional<T> = T | undefined;

// ============================================================================
// MARK: Planner-internal types (not in shared contracts — internal computation)
// ============================================================================

/** Planner-scoped reputation tier, aliased from canonical ChatReputationBand. */
export type ChatReputationTier = ChatReputationBand;

/** Reputation pressure shape used internally by social planners. */
export interface SocialActorReputation {
  readonly shame: number;
  readonly legendPressure: number;
  readonly trust: number;
  readonly reliability: number;
  readonly respect: number;
  readonly awe: number;
  readonly fear: number;
  readonly volatility: number;
  readonly threat: number;
}

/**
 * Internal channel heat profile consumed by social planners.
 * Build via buildChannelHeatProfileFromSummary() to convert from ChatAudienceHeatSummary.
 */
export interface ChatChannelHeatProfile {
  readonly totalHeat: number;
  readonly witnessDensity: number;
  readonly predationShare: number;
  readonly volatilityScore: number;
  readonly intensityBand: 'QUIET' | 'BUILDING' | 'ELEVATED' | 'INTENSE' | 'MYTHIC';
  readonly audienceBand: ChatAudienceWitnessDensityBand;
  readonly swarmRiskBand: ChatAudienceSwarmRisk;
  readonly mood: ChatAudienceMood;
}

/** Convert a canonical ChatAudienceHeatSummary into the planner-internal ChatChannelHeatProfile. */
export function buildChannelHeatProfileFromSummary(
  summary: ChatAudienceHeatSummary,
): ChatChannelHeatProfile {
  const totalHeat = summary.netHeat;
  const witnessDensity =
    summary.witnessBand === 'SATURATED' ? 100
    : summary.witnessBand === 'HEAVY' ? 78
    : summary.witnessBand === 'MODERATE' ? 52
    : summary.witnessBand === 'LIGHT' ? 28
    : summary.witnessBand === 'TRACE' ? 10
    : 0;
  const predationShare =
    summary.swarmRisk === 'OVERWHELMING' ? 95
    : summary.swarmRisk === 'SEVERE' ? 76
    : summary.swarmRisk === 'HIGH' ? 55
    : summary.swarmRisk === 'ELEVATED' ? 34
    : summary.swarmRisk === 'LOW' ? 14
    : 0;
  const volatilityScore = Math.round(Math.abs(summary.visibleHeat - summary.netHeat) * 100) / 100;
  const intensityBand: ChatChannelHeatProfile['intensityBand'] =
    totalHeat >= 85 ? 'MYTHIC'
    : totalHeat >= 65 ? 'INTENSE'
    : totalHeat >= 45 ? 'ELEVATED'
    : totalHeat >= 25 ? 'BUILDING'
    : 'QUIET';
  return Object.freeze({
    totalHeat: Math.round(totalHeat * 100) / 100,
    witnessDensity: Math.round(witnessDensity * 100) / 100,
    predationShare: Math.round(predationShare * 100) / 100,
    volatilityScore,
    intensityBand,
    audienceBand: summary.witnessBand,
    swarmRiskBand: summary.swarmRisk,
    mood: summary.mood,
  });
}

/** Convert a canonical ChatReputationSummary into the planner-internal SocialActorReputation. */
export function buildSocialActorReputation(
  summary: ChatReputationSummary,
): SocialActorReputation {
  const base = summary.score;
  const isHighBand = summary.band === 'RESPECTED' || summary.band === 'FEARED' || summary.band === 'REVERED' || summary.band === 'LEGENDARY';
  const isLowBand = summary.band === 'RUINED' || summary.band === 'DAMAGED' || summary.band === 'QUESTIONED';
  return Object.freeze({
    shame: Math.round(Math.max(0, (50 - base) * 1.2) * 100) / 100,
    legendPressure: Math.round(Math.max(0, (base - 60) * 1.8) * 100) / 100,
    trust: Math.round((isHighBand ? base * 0.65 : base * 0.25) * 100) / 100,
    reliability: Math.round((summary.integrity === 'ICONIC' || summary.integrity === 'HARDENED' ? base * 0.72 : summary.integrity === 'STABLE' ? base * 0.48 : base * 0.18) * 100) / 100,
    respect: Math.round((summary.band === 'FEARED' || summary.band === 'REVERED' || summary.band === 'LEGENDARY' ? base * 0.8 : base * 0.3) * 100) / 100,
    awe: Math.round((summary.band === 'LEGENDARY' ? base * 0.92 : summary.band === 'REVERED' ? base * 0.6 : base * 0.1) * 100) / 100,
    fear: Math.round((isLowBand ? Math.max(0, 100 - base) * 0.45 : 0) * 100) / 100,
    volatility: Math.round((summary.integrity === 'FRAGILE' || summary.integrity === 'SHATTERED' ? 82 : summary.integrity === 'UNSTABLE' ? 52 : 12) * 100) / 100,
    threat: Math.round((summary.band === 'FEARED' ? base * 0.72 : summary.band === 'REVERED' ? base * 0.42 : 0) * 100) / 100,
  });
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function sum(values: readonly number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

function avg(values: readonly number[]): number {
  return values.length ? sum(values) / values.length : 0;
}

function uniq<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}


export interface CrowdSynthesisClock {
  now(): number;
}

export interface CrowdSynthesisConfig {
  readonly authority: 'BACKEND';
  readonly version: string;
  readonly maxReactionCandidates: number;
  readonly maxWitnessLines: number;
  readonly maxAmbientLines: number;
  readonly maxNarrativeWeight: number;
  readonly baseTimestampSpacingMs: number;
  readonly criticalSwarmBurstMs: number;
  readonly predatoryDealDelayMs: number;
  readonly ceremonialDelayMs: number;
  readonly rescueMercyCooldownMs: number;
  readonly globalCrowdWeight: number;
  readonly syndicatePrivacyWeight: number;
  readonly dealRoomPredationWeight: number;
  readonly shadowLeakWeight: number;
  readonly reputationAmplifier: number;
  readonly legendAmplifier: number;
  readonly shameAmplifier: number;
  readonly volatilityAmplifier: number;
  readonly witnessDensityAmplifier: number;
  readonly crowdNoiseFloor: number;
}

export interface CrowdSynthesisInput {
  readonly playerId: string;
  readonly runId?: string;
  readonly sessionId?: string;
  readonly channelId: ChatChannelId;
  readonly eventType: string;
  readonly source:
    | 'PLAYER_MESSAGE'
    | 'NPC_MESSAGE'
    | 'SYSTEM_MESSAGE'
    | 'HELPER_MESSAGE'
    | 'HATER_MESSAGE'
    | 'ENGINE_EVENT'
    | 'BATTLE_EVENT'
    | 'DEAL_EVENT'
    | 'RESCUE_EVENT'
    | 'LIVEOPS_EVENT'
    | 'POST_RUN_EVENT'
    | 'SHADOW_WRITE';
  readonly occurredAtMs?: number;
  readonly actorId?: string;
  readonly subjectId?: string;
  readonly counterpartId?: string;
  readonly messageId?: string;
  readonly messageText?: string;
  readonly heatSummary: ChatAudienceHeatSummary;
  readonly channelProfile: ChatChannelHeatProfile;
  readonly actorReputation?: SocialActorReputation | null;
  readonly subjectReputation?: SocialActorReputation | null;
  readonly counterpartReputation?: SocialActorReputation | null;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface CrowdReactionCandidate {
  readonly id: string;
  readonly channelId: ChatChannelId;
  readonly line: string;
  readonly sourceArchetype:
    | 'CROWD'
    | 'SPECTATOR'
    | 'RIVAL_CLUSTER'
    | 'DEAL_WITNESS'
    | 'SYNDICATE_WITNESS'
    | 'RESCUE_WITNESS'
    | 'LIVEOPS_WITNESS'
    | 'SHADOW_ECHO';
  readonly dramaticFunction:
    | 'AMBIENT'
    | 'VALIDATION'
    | 'RIDICULE'
    | 'HYPE'
    | 'PRESSURE'
    | 'WARNING'
    | 'PREDATION'
    | 'CEREMONY'
    | 'MERCY'
    | 'ECHO';
  readonly weight: number;
  readonly delayMs: number;
  readonly shouldReveal: boolean;
  readonly visibility: 'VISIBLE' | 'SHADOW';
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface CrowdSynthesisResult {
  readonly playerId: string;
  readonly runId: string | null;
  readonly sessionId: string | null;
  readonly channelId: ChatChannelId;
  readonly eventType: string;
  readonly generatedAtMs: number;
  readonly dominantMood: ChatAudienceMood;
  readonly dominantBand: ChatAudienceWitnessDensityBand;
  readonly swarmRiskBand: ChatAudienceSwarmRisk;
  readonly candidates: readonly CrowdReactionCandidate[];
  readonly picked: readonly CrowdReactionCandidate[];
  readonly summary: {
    readonly witnessPressure: number;
    readonly predationPressure: number;
    readonly embarrassmentPressure: number;
    readonly legendPressure: number;
    readonly mercyPressure: number;
    readonly confidencePressure: number;
  };
}

const DEFAULT_CLOCK: CrowdSynthesisClock = {
  now(): number {
    return Date.now();
  },
};

const DEFAULT_CONFIG: CrowdSynthesisConfig = Object.freeze({
  authority: 'BACKEND',
  version: '2026.03.19-crowd-synthesis',
  maxReactionCandidates: 72,
  maxWitnessLines: 12,
  maxAmbientLines: 8,
  maxNarrativeWeight: 100,
  baseTimestampSpacingMs: 350,
  criticalSwarmBurstMs: 120,
  predatoryDealDelayMs: 420,
  ceremonialDelayMs: 700,
  rescueMercyCooldownMs: 1600,
  globalCrowdWeight: 1.25,
  syndicatePrivacyWeight: 0.75,
  dealRoomPredationWeight: 1.22,
  shadowLeakWeight: 0.55,
  reputationAmplifier: 1.15,
  legendAmplifier: 1.2,
  shameAmplifier: 1.18,
  volatilityAmplifier: 1.1,
  witnessDensityAmplifier: 1.14,
  crowdNoiseFloor: 3,
});


export class CrowdSynthesisEngine {
  private readonly config: CrowdSynthesisConfig;
  private readonly clock: CrowdSynthesisClock;

  public constructor(
    config: Partial<CrowdSynthesisConfig> = {},
    clock: CrowdSynthesisClock = DEFAULT_CLOCK,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.clock = clock;
  }

  public synthesize(input: CrowdSynthesisInput): CrowdSynthesisResult {
    const generatedAtMs = input.occurredAtMs ?? this.clock.now();
    const context = this.buildPressureContext(input);
    const candidates = this.buildCandidates(input, context, generatedAtMs);
    const picked = this.pickCandidates(input, context, candidates);

    return {
      playerId: input.playerId,
      runId: input.runId ?? null,
      sessionId: input.sessionId ?? null,
      channelId: input.channelId,
      eventType: input.eventType,
      generatedAtMs,
      dominantMood: input.channelProfile.mood,
      dominantBand: input.channelProfile.audienceBand,
      swarmRiskBand: input.channelProfile.swarmRiskBand,
      candidates,
      picked,
      summary: context,
    };
  }

  private buildPressureContext(input: CrowdSynthesisInput): CrowdSynthesisResult['summary'] {
    const heat = input.channelProfile.totalHeat;
    const witness = input.channelProfile.witnessDensity * this.config.witnessDensityAmplifier;
    const predationBase = input.channelProfile.predationShare * 0.7;
    const embarrassmentBase = input.subjectReputation?.shame ?? 0;
    const legendBase = input.actorReputation?.legendPressure ?? 0;
    const trustBase = input.actorReputation?.trust ?? 0;
    const reliabilityBase = input.actorReputation?.reliability ?? 0;

    return {
      witnessPressure: round2(clamp(witness + heat * 0.18, 0, 100)),
      predationPressure: round2(clamp(predationBase + (input.channelId === 'DEAL_ROOM' ? 12 : 0), 0, 100)),
      embarrassmentPressure: round2(clamp(embarrassmentBase * this.config.shameAmplifier + heat * 0.08, 0, 100)),
      legendPressure: round2(clamp(legendBase * this.config.legendAmplifier + (input.channelProfile.intensityBand === 'MYTHIC' ? 10 : 0), 0, 100)),
      mercyPressure: round2(clamp((trustBase + reliabilityBase) * 0.3 + (input.source === 'RESCUE_EVENT' ? 18 : 0), 0, 100)),
      confidencePressure: round2(clamp((input.actorReputation?.respect ?? 0) * 0.45 + (input.actorReputation?.awe ?? 0) * 0.25 + heat * 0.06, 0, 100)),
    };
  }

  private buildCandidates(
    input: CrowdSynthesisInput,
    context: CrowdSynthesisResult['summary'],
    generatedAtMs: number,
  ): CrowdReactionCandidate[] {
    const candidates: CrowdReactionCandidate[] = [];
    this.pushAmbientCandidates(candidates, input, context, generatedAtMs);
    this.pushWitnessCandidates(candidates, input, context, generatedAtMs);
    this.pushRiskCandidates(candidates, input, context, generatedAtMs);
    this.pushMoodCandidates(candidates, input, context, generatedAtMs);
    this.pushMemoryEchoCandidates(candidates, input, context, generatedAtMs);
    return candidates
      .sort((a, b) => b.weight - a.weight || a.delayMs - b.delayMs)
      .slice(0, this.config.maxReactionCandidates);
  }

  private pickCandidates(
    input: CrowdSynthesisInput,
    context: CrowdSynthesisResult['summary'],
    candidates: readonly CrowdReactionCandidate[],
  ): CrowdReactionCandidate[] {
    const picked: CrowdReactionCandidate[] = [];
    const maxCount = this.pickCount(input, context);

    for (const candidate of candidates) {
      if (picked.length >= maxCount) break;
      if (!this.canCoexist(candidate, picked)) continue;
      picked.push(candidate);
    }
    return picked;
  }

  private pickCount(input: CrowdSynthesisInput, context: CrowdSynthesisResult['summary']): number {
    let count = 2;
    if (input.channelProfile.audienceBand === 'HEAVY' || input.channelProfile.audienceBand === 'SATURATED') count += 1;
    if (input.channelProfile.swarmRiskBand === 'HIGH' || input.channelProfile.swarmRiskBand === 'SEVERE') count += 2;
    if (context.legendPressure >= 50 || context.embarrassmentPressure >= 50) count += 1;
    if (input.channelId.endsWith('SHADOW')) count = Math.max(1, count - 1);
    return clamp(count, 1, 6);
  }

  private canCoexist(candidate: CrowdReactionCandidate, picked: readonly CrowdReactionCandidate[]): boolean {
    if (picked.some((item) => item.line === candidate.line)) return false;
    if (picked.some((item) => item.dramaticFunction === candidate.dramaticFunction && Math.abs(item.delayMs - candidate.delayMs) < 120)) {
      return false;
    }
    return true;
  }

  private pushGlobalChannelCandidates(
    out: CrowdReactionCandidate[],
    input: CrowdSynthesisInput,
    context: CrowdSynthesisResult['summary'],
    generatedAtMs: number,
  ): void {
    if (input.channelId !== 'GLOBAL') return;
    const baseWeight = this.channelWeight(input.channelId);
    const baseDelay = this.channelDelay(input.channelId);
    out.push(...this.composeFunctionCandidates(
      input,
      generatedAtMs,
      baseWeight,
      baseDelay,
      "GLOBAL",
      this.functionsForChannel(input, context),
    ));
  }

  private pushSyndicateChannelCandidates(
    out: CrowdReactionCandidate[],
    input: CrowdSynthesisInput,
    context: CrowdSynthesisResult['summary'],
    generatedAtMs: number,
  ): void {
    if (input.channelId !== 'SYNDICATE') return;
    const baseWeight = this.channelWeight(input.channelId);
    const baseDelay = this.channelDelay(input.channelId);
    out.push(...this.composeFunctionCandidates(
      input,
      generatedAtMs,
      baseWeight,
      baseDelay,
      "SYNDICATE",
      this.functionsForChannel(input, context),
    ));
  }

  private pushDealRoomChannelCandidates(
    out: CrowdReactionCandidate[],
    input: CrowdSynthesisInput,
    context: CrowdSynthesisResult['summary'],
    generatedAtMs: number,
  ): void {
    if (input.channelId !== 'DEAL_ROOM') return;
    const baseWeight = this.channelWeight(input.channelId);
    const baseDelay = this.channelDelay(input.channelId);
    out.push(...this.composeFunctionCandidates(
      input,
      generatedAtMs,
      baseWeight,
      baseDelay,
      "DEAL_ROOM",
      this.functionsForChannel(input, context),
    ));
  }

  private pushLobbyChannelCandidates(
    out: CrowdReactionCandidate[],
    input: CrowdSynthesisInput,
    context: CrowdSynthesisResult['summary'],
    generatedAtMs: number,
  ): void {
    if (input.channelId !== 'LOBBY') return;
    const baseWeight = this.channelWeight(input.channelId);
    const baseDelay = this.channelDelay(input.channelId);
    out.push(...this.composeFunctionCandidates(
      input,
      generatedAtMs,
      baseWeight,
      baseDelay,
      "LOBBY",
      this.functionsForChannel(input, context),
    ));
  }

  private pushSystemShadowChannelCandidates(
    out: CrowdReactionCandidate[],
    input: CrowdSynthesisInput,
    context: CrowdSynthesisResult['summary'],
    generatedAtMs: number,
  ): void {
    if (input.channelId !== 'SYSTEM_SHADOW') return;
    const baseWeight = this.channelWeight(input.channelId);
    const baseDelay = this.channelDelay(input.channelId);
    out.push(...this.composeFunctionCandidates(
      input,
      generatedAtMs,
      baseWeight,
      baseDelay,
      "SYSTEM_SHADOW",
      this.functionsForChannel(input, context),
    ));
  }

  private pushNpcShadowChannelCandidates(
    out: CrowdReactionCandidate[],
    input: CrowdSynthesisInput,
    context: CrowdSynthesisResult['summary'],
    generatedAtMs: number,
  ): void {
    if (input.channelId !== 'NPC_SHADOW') return;
    const baseWeight = this.channelWeight(input.channelId);
    const baseDelay = this.channelDelay(input.channelId);
    out.push(...this.composeFunctionCandidates(
      input,
      generatedAtMs,
      baseWeight,
      baseDelay,
      "NPC_SHADOW",
      this.functionsForChannel(input, context),
    ));
  }

  private pushRivalryShadowChannelCandidates(
    out: CrowdReactionCandidate[],
    input: CrowdSynthesisInput,
    context: CrowdSynthesisResult['summary'],
    generatedAtMs: number,
  ): void {
    if (input.channelId !== 'RIVALRY_SHADOW') return;
    const baseWeight = this.channelWeight(input.channelId);
    const baseDelay = this.channelDelay(input.channelId);
    out.push(...this.composeFunctionCandidates(
      input,
      generatedAtMs,
      baseWeight,
      baseDelay,
      "RIVALRY_SHADOW",
      this.functionsForChannel(input, context),
    ));
  }

  private pushRescueShadowChannelCandidates(
    out: CrowdReactionCandidate[],
    input: CrowdSynthesisInput,
    context: CrowdSynthesisResult['summary'],
    generatedAtMs: number,
  ): void {
    if (input.channelId !== 'RESCUE_SHADOW') return;
    const baseWeight = this.channelWeight(input.channelId);
    const baseDelay = this.channelDelay(input.channelId);
    out.push(...this.composeFunctionCandidates(
      input,
      generatedAtMs,
      baseWeight,
      baseDelay,
      "RESCUE_SHADOW",
      this.functionsForChannel(input, context),
    ));
  }

  private pushLiveopsShadowChannelCandidates(
    out: CrowdReactionCandidate[],
    input: CrowdSynthesisInput,
    context: CrowdSynthesisResult['summary'],
    generatedAtMs: number,
  ): void {
    if (input.channelId !== 'LIVEOPS_SHADOW') return;
    const baseWeight = this.channelWeight(input.channelId);
    const baseDelay = this.channelDelay(input.channelId);
    out.push(...this.composeFunctionCandidates(
      input,
      generatedAtMs,
      baseWeight,
      baseDelay,
      "LIVEOPS_SHADOW",
      this.functionsForChannel(input, context),
    ));
  }

  private pushAmbientCandidates(
    out: CrowdReactionCandidate[],
    input: CrowdSynthesisInput,
    context: CrowdSynthesisResult['summary'],
    generatedAtMs: number,
  ): void {
    this.pushGlobalChannelCandidates(out, input, context, generatedAtMs);
    this.pushSyndicateChannelCandidates(out, input, context, generatedAtMs);
    this.pushDealRoomChannelCandidates(out, input, context, generatedAtMs);
    this.pushLobbyChannelCandidates(out, input, context, generatedAtMs);
    this.pushSystemShadowChannelCandidates(out, input, context, generatedAtMs);
    this.pushNpcShadowChannelCandidates(out, input, context, generatedAtMs);
    this.pushRivalryShadowChannelCandidates(out, input, context, generatedAtMs);
    this.pushRescueShadowChannelCandidates(out, input, context, generatedAtMs);
    this.pushLiveopsShadowChannelCandidates(out, input, context, generatedAtMs);
  }

  private pushWitnessCandidates(
    out: CrowdReactionCandidate[],
    input: CrowdSynthesisInput,
    context: CrowdSynthesisResult['summary'],
    generatedAtMs: number,
  ): void {
    const witnessWeight = this.channelWeight(input.channelId) + context.witnessPressure * 0.35;
    if (context.witnessPressure < this.config.crowdNoiseFloor) return;
    const functions: CrowdReactionCandidate['dramaticFunction'][] = [];
    if (context.legendPressure >= 30) functions.push('CEREMONY');
    if (context.confidencePressure >= 24) functions.push('VALIDATION');
    if (context.embarrassmentPressure >= 22) functions.push('RIDICULE');
    if (!functions.length) functions.push('AMBIENT');
    out.push(...this.composeFunctionCandidates(input, generatedAtMs, witnessWeight, this.channelDelay(input.channelId), 'WITNESS', functions, 'SPECTATOR'));
  }

  private pushRiskCandidates(
    out: CrowdReactionCandidate[],
    input: CrowdSynthesisInput,
    context: CrowdSynthesisResult['summary'],
    generatedAtMs: number,
  ): void {
    if (input.channelProfile.swarmRiskBand === 'NONE') return;
    const functions: CrowdReactionCandidate['dramaticFunction'][] = ['PRESSURE'];
    if (context.predationPressure >= 24) functions.push('PREDATION');
    if (context.embarrassmentPressure >= 26) functions.push('RIDICULE');
    if (context.mercyPressure >= 30 && input.source === 'RESCUE_EVENT') functions.push('MERCY');
    out.push(...this.composeFunctionCandidates(
      input,
      generatedAtMs,
      this.channelWeight(input.channelId) + 10,
      input.channelProfile.swarmRiskBand === 'OVERWHELMING' ? this.config.criticalSwarmBurstMs : this.channelDelay(input.channelId),
      'RISK',
      functions,
      input.channelId === 'DEAL_ROOM' ? 'DEAL_WITNESS' : 'RIVAL_CLUSTER',
    ));
  }

  private pushMoodCandidates(
    out: CrowdReactionCandidate[],
    input: CrowdSynthesisInput,
    context: CrowdSynthesisResult['summary'],
    generatedAtMs: number,
  ): void {
    const mood = input.channelProfile.mood;
    const functions: CrowdReactionCandidate['dramaticFunction'][] = [];
    switch (mood) {
      case 'REVERENT':
        functions.push('CEREMONY', 'VALIDATION');
        break;
      case 'PREDATORY':
      case 'MERCILESS':
        functions.push('PREDATION', 'PRESSURE');
        break;
      case 'HOSTILE':
      case 'PANICKED':
        functions.push('PRESSURE', 'WARNING');
        break;
      case 'TENSE':
      case 'MOCKING':
        functions.push('HYPE', 'PRESSURE');
        break;
      case 'WATCHFUL':
      case 'CONSPIRATORIAL':
        functions.push('WARNING', 'AMBIENT');
        break;
      case 'QUIET':
      case 'VACUUM':
      default:
        functions.push('AMBIENT');
        break;
    }
    out.push(...this.composeFunctionCandidates(
      input,
      generatedAtMs,
      this.channelWeight(input.channelId) + 4,
      this.channelDelay(input.channelId),
      'MOOD',
      functions,
    ));
  }

  private pushMemoryEchoCandidates(
    out: CrowdReactionCandidate[],
    input: CrowdSynthesisInput,
    context: CrowdSynthesisResult['summary'],
    generatedAtMs: number,
  ): void {
    const tags = new Set(input.tags ?? []);
    const shouldEcho =
      input.channelId.endsWith('SHADOW') ||
      tags.has('callback') ||
      tags.has('receipt') ||
      input.eventType.toUpperCase().includes('COMEBACK') ||
      input.eventType.toUpperCase().includes('COLLAPSE');

    if (!shouldEcho) return;

    out.push(...this.composeFunctionCandidates(
      input,
      generatedAtMs,
      this.channelWeight(input.channelId) + 6,
      this.channelDelay(input.channelId) + 180,
      'ECHO',
      ['ECHO', context.embarrassmentPressure >= 30 ? 'RIDICULE' : 'WARNING'],
      'SHADOW_ECHO',
    ));
  }

  private functionsForChannel(
    input: CrowdSynthesisInput,
    context: CrowdSynthesisResult['summary'],
  ): CrowdReactionCandidate['dramaticFunction'][] {
    const eventType = input.eventType.toUpperCase();
    const functions: CrowdReactionCandidate['dramaticFunction'][] = ['AMBIENT'];

    if (eventType.includes('COMEBACK') || eventType.includes('SOVEREIGN') || eventType.includes('CLUTCH')) {
      functions.push('HYPE', 'VALIDATION');
    }
    if (eventType.includes('COLLAPSE') || eventType.includes('BANKRUPT') || eventType.includes('SHIELD_BREAK')) {
      functions.push('RIDICULE', 'PRESSURE');
    }
    if (eventType.includes('DEAL') || input.channelId === 'DEAL_ROOM') {
      functions.push('PREDATION');
    }
    if (eventType.includes('RESCUE') || input.source === 'RESCUE_EVENT') {
      functions.push(context.mercyPressure >= 20 ? 'MERCY' : 'WARNING');
    }
    if (eventType.includes('LIVEOPS') || input.source === 'LIVEOPS_EVENT') {
      functions.push('HYPE', 'WARNING');
    }

    return uniq(functions);
  }

  private composeFunctionCandidates(
    input: CrowdSynthesisInput,
    generatedAtMs: number,
    baseWeight: number,
    baseDelay: number,
    discriminator: string,
    functions: readonly CrowdReactionCandidate['dramaticFunction'][],
    sourceArchetypeOverride?: CrowdReactionCandidate['sourceArchetype'],
  ): CrowdReactionCandidate[] {
    const out: CrowdReactionCandidate[] = [];
    let ordinal = 0;
    for (const fn of uniq(functions)) {
      const phrases = this.phraseBank(fn);
      for (let i = 0; i < Math.min(phrases.length, 3); i += 1) {
        const line = this.decorateLine(input, fn, phrases[i]);
        out.push({
          id: `${input.channelId}:${discriminator}:${fn}:${ordinal}:${generatedAtMs}`,
          channelId: input.channelId,
          line,
          sourceArchetype: sourceArchetypeOverride ?? this.defaultArchetype(input.channelId, fn),
          dramaticFunction: fn,
          weight: round2(clamp(baseWeight + this.functionWeight(fn) + i * 0.5 + this.channelFunctionBias(input.channelId, fn), 0, this.config.maxNarrativeWeight)),
          delayMs: Math.max(0, Math.round(baseDelay + i * this.config.baseTimestampSpacingMs + this.functionDelay(fn))),
          shouldReveal: !input.channelId.endsWith('SHADOW') || fn === 'ECHO',
          visibility: input.channelId.endsWith('SHADOW') ? 'SHADOW' : 'VISIBLE',
          metadata: {
            eventType: input.eventType,
            source: input.source,
            discriminator,
            actorId: input.actorId ?? null,
            subjectId: input.subjectId ?? null,
            counterpartId: input.counterpartId ?? null,
            messageId: input.messageId ?? null,
          },
        });
        ordinal += 1;
      }
    }
    return out;
  }

  private defaultArchetype(
    channelId: ChatChannelId,
    fn: CrowdReactionCandidate['dramaticFunction'],
  ): CrowdReactionCandidate['sourceArchetype'] {
    if (channelId === 'DEAL_ROOM') return 'DEAL_WITNESS';
    if (channelId === 'SYNDICATE') return 'SYNDICATE_WITNESS';
    if (channelId === 'RESCUE_SHADOW') return 'RESCUE_WITNESS';
    if (channelId === 'LIVEOPS_SHADOW') return 'LIVEOPS_WITNESS';
    if (channelId.endsWith('SHADOW')) return 'SHADOW_ECHO';
    if (fn === 'RIDICULE' || fn === 'PRESSURE' || fn === 'PREDATION') return 'RIVAL_CLUSTER';
    return 'CROWD';
  }

  private phraseBank(fn: CrowdReactionCandidate['dramaticFunction']): readonly string[] {
    switch (fn) {
      case 'AMBIENT':
        return ["The room tilts.", "Everyone saw that.", "The board just moved.", "That landed.", "The room is paying attention now."];
      case 'VALIDATION':
        return ["They earned that.", "That was clean.", "No luck in that one.", "That changes the table.", "That was real."];
      case 'RIDICULE':
        return ["You really said that out loud.", "The room heard that and winced.", "That bluff has a pulse but not much else.", "That landed badly.", "The crowd smells blood."];
      case 'HYPE':
        return ["The room wakes up.", "That woke everybody up.", "That just changed the tempo.", "Now the crowd is alive.", "That made the table lean in."];
      case 'PRESSURE':
        return ["They are under it now.", "The pressure just became visible.", "The room is closing in.", "That is not neutral pressure anymore.", "That is the kind that lingers."];
      case 'WARNING':
        return ["This can still turn.", "That does not end here.", "The room is not done with this.", "Careful \u2014 the echo is bigger than the line.", "There is another hit hiding behind that one."];
      case 'PREDATION':
        return ["The room wants a better price.", "That weakness has a market now.", "Predators heard the hesitation.", "That opened a window.", "The table just became carnivorous."];
      case 'CEREMONY':
        return ["Witness it.", "That moment will travel.", "The room marks this one.", "This is the kind they remember.", "That crossed into ritual."];
      case 'MERCY':
        return ["Somebody needs to throw them a rope.", "That is enough for one moment.", "Let them breathe once.", "Even the room knows when to back off.", "That needs a soft landing."];
      case 'ECHO':
        return ["The shadow kept that.", "That line will come back later.", "The room filed that away.", "The echo survived the message.", "That did not vanish when it ended."];
      default:
        return ['The room moved.'];
    }
  }

  private decorateLine(
    input: CrowdSynthesisInput,
    fn: CrowdReactionCandidate['dramaticFunction'],
    base: string,
  ): string {
    const eventType = input.eventType.toUpperCase();
    if (fn === 'PREDATION' && input.channelId === 'DEAL_ROOM') {
      return `${base} The number is the wound.`;
    }
    if (fn === 'CEREMONY' && (eventType.includes('SOVEREIGN') || eventType.includes('LEGEND'))) {
      return `${base} This one goes into the record.`;
    }
    if (fn === 'RIDICULE' && eventType.includes('BLUFF')) {
      return `${base} The bluff did not survive contact.`;
    }
    if (fn === 'MERCY' && input.source === 'RESCUE_EVENT') {
      return `${base} Somebody finally cut the pressure.`;
    }
    if (fn === 'ECHO' && input.messageText) {
      return `${base} The room will remember: "${input.messageText.slice(0, 36)}"`;
    }
    return base;
  }

  private channelWeight(channelId: ChatChannelId): number {
    switch (channelId) {
      case 'GLOBAL':
        return 14 * this.config.globalCrowdWeight;
      case 'SYNDICATE':
        return 10 * this.config.syndicatePrivacyWeight;
      case 'DEAL_ROOM':
        return 12 * this.config.dealRoomPredationWeight;
      case 'LOBBY':
        return 8;
      case 'RIVALRY_SHADOW':
        return 9 * this.config.shadowLeakWeight;
      case 'RESCUE_SHADOW':
        return 7 * this.config.shadowLeakWeight;
      case 'LIVEOPS_SHADOW':
        return 11 * this.config.shadowLeakWeight;
      case 'SYSTEM_SHADOW':
      case 'NPC_SHADOW':
      default:
        return 6 * this.config.shadowLeakWeight;
    }
  }

  private channelDelay(channelId: ChatChannelId): number {
    switch (channelId) {
      case 'GLOBAL':
        return 180;
      case 'SYNDICATE':
        return 260;
      case 'DEAL_ROOM':
        return this.config.predatoryDealDelayMs;
      case 'LOBBY':
        return this.config.ceremonialDelayMs;
      case 'RIVALRY_SHADOW':
        return 120;
      case 'RESCUE_SHADOW':
        return this.config.rescueMercyCooldownMs;
      case 'LIVEOPS_SHADOW':
        return 140;
      default:
        return 200;
    }
  }

  private functionWeight(fn: CrowdReactionCandidate['dramaticFunction']): number {
    switch (fn) {
      case 'CEREMONY':
        return 11;
      case 'PREDATION':
        return 10;
      case 'PRESSURE':
        return 9;
      case 'HYPE':
        return 8;
      case 'RIDICULE':
        return 7;
      case 'WARNING':
        return 6;
      case 'MERCY':
        return 5;
      case 'VALIDATION':
        return 5;
      case 'ECHO':
        return 4;
      case 'AMBIENT':
      default:
        return 3;
    }
  }

  private functionDelay(fn: CrowdReactionCandidate['dramaticFunction']): number {
    switch (fn) {
      case 'PRESSURE':
      case 'RIDICULE':
        return 0;
      case 'PREDATION':
        return 60;
      case 'HYPE':
        return 80;
      case 'WARNING':
        return 120;
      case 'MERCY':
        return 220;
      case 'CEREMONY':
        return 320;
      case 'ECHO':
        return 410;
      case 'VALIDATION':
        return 140;
      case 'AMBIENT':
      default:
        return 180;
    }
  }

  private channelFunctionBias(channelId: ChatChannelId, fn: CrowdReactionCandidate['dramaticFunction']): number {
    if (channelId === 'DEAL_ROOM' && fn === 'PREDATION') return 5;
    if (channelId === 'GLOBAL' && (fn === 'HYPE' || fn === 'RIDICULE')) return 4;
    if (channelId === 'SYNDICATE' && fn === 'WARNING') return 3;
    if (channelId.endsWith('SHADOW') && fn === 'ECHO') return 6;
    if (channelId === 'LOBBY' && fn === 'CEREMONY') return 5;
    return 0;
  }
}

// ============================================================================
// MARK: Factory
// ============================================================================

export function createCrowdSynthesisEngine(
  config: Partial<CrowdSynthesisConfig> = {},
  clock?: CrowdSynthesisClock,
): CrowdSynthesisEngine {
  return new CrowdSynthesisEngine(config, clock);
}

// ============================================================================
// MARK: Reputation gate — uses ChatReputationTier, Nullable, Optional
// ============================================================================

/**
 * A gate that filters or amplifies crowd reaction candidates based on the
 * reputation tier of a given participant. Used to enforce prestige-tier access
 * rules on certain dramatic functions (e.g. CEREMONY only triggers at LEGEND).
 */
export interface CrowdSynthesisReputationGate {
  readonly tier: ChatReputationTier;
  readonly participantId: Nullable<string>;
  readonly channelThreshold: Optional<number>;
  readonly dramaticFunctions: readonly CrowdReactionCandidate['dramaticFunction'][];
  readonly amplifier: number;
  readonly suppressedWhenBelow: Optional<number>;
}

export function buildReputationGate(
  tier: ChatReputationTier,
  participantId: Nullable<string>,
  dramaticFunctions: readonly CrowdReactionCandidate['dramaticFunction'][],
  options?: {
    readonly channelThreshold?: number;
    readonly amplifier?: number;
    readonly suppressedWhenBelow?: number;
  },
): CrowdSynthesisReputationGate {
  return Object.freeze({
    tier,
    participantId,
    channelThreshold: options?.channelThreshold,
    dramaticFunctions,
    amplifier: options?.amplifier ?? 1,
    suppressedWhenBelow: options?.suppressedWhenBelow,
  });
}

export function applyReputationGate(
  candidates: readonly CrowdReactionCandidate[],
  gate: CrowdSynthesisReputationGate,
): readonly CrowdReactionCandidate[] {
  const threshold = gate.suppressedWhenBelow;
  if (threshold === undefined || threshold === null) return candidates;
  return candidates.filter(
    (c) => !gate.dramaticFunctions.includes(c.dramaticFunction) || c.weight >= threshold,
  );
}

export function amplifyByReputationGate(
  candidates: readonly CrowdReactionCandidate[],
  gate: CrowdSynthesisReputationGate,
): readonly CrowdReactionCandidate[] {
  if (gate.amplifier === 1) return candidates;
  return candidates.map((c) => {
    if (!gate.dramaticFunctions.includes(c.dramaticFunction)) return c;
    return Object.freeze({
      ...c,
      weight: round2(clamp(c.weight * gate.amplifier, 0, 100)),
    });
  });
}

// ============================================================================
// MARK: Pressure snapshot — uses avg()
// ============================================================================

export interface CrowdSynthesisPressureSnapshot {
  readonly generatedAtMs: number;
  readonly channelId: string;
  readonly averageWitnessPressure: number;
  readonly averagePredationPressure: number;
  readonly averageEmbarrassmentPressure: number;
  readonly averageLegendPressure: number;
  readonly averageMercyPressure: number;
  readonly averageConfidencePressure: number;
  readonly peakFunction: CrowdReactionCandidate['dramaticFunction'];
  readonly totalCandidates: number;
  readonly pickedCount: number;
  readonly shadowRatio: number;
  readonly witnessSpread: number;
}

export function buildCrowdSynthesisPressureSnapshot(
  result: CrowdSynthesisResult,
  priorResults: readonly CrowdSynthesisResult[] = [],
): CrowdSynthesisPressureSnapshot {
  const allResults = [...priorResults, result];
  const averageWitnessPressure = avg(allResults.map((r) => r.summary.witnessPressure));
  const averagePredationPressure = avg(allResults.map((r) => r.summary.predationPressure));
  const averageEmbarrassmentPressure = avg(allResults.map((r) => r.summary.embarrassmentPressure));
  const averageLegendPressure = avg(allResults.map((r) => r.summary.legendPressure));
  const averageMercyPressure = avg(allResults.map((r) => r.summary.mercyPressure));
  const averageConfidencePressure = avg(allResults.map((r) => r.summary.confidencePressure));

  const fnCounts = new Map<CrowdReactionCandidate['dramaticFunction'], number>();
  for (const r of allResults) {
    for (const c of r.picked) {
      fnCounts.set(c.dramaticFunction, (fnCounts.get(c.dramaticFunction) ?? 0) + 1);
    }
  }
  let peakFunction: CrowdReactionCandidate['dramaticFunction'] = 'AMBIENT';
  let peakCount = 0;
  for (const [fn, count] of fnCounts.entries()) {
    if (count > peakCount) { peakCount = count; peakFunction = fn; }
  }

  const shadowPicked = result.picked.filter((c) => c.visibility === 'SHADOW').length;
  const witnessWeights = result.picked.map((c) => c.weight);
  const witnessSpread = witnessWeights.length > 1
    ? round2(Math.max(...witnessWeights) - Math.min(...witnessWeights))
    : 0;

  return Object.freeze({
    generatedAtMs: result.generatedAtMs,
    channelId: result.channelId,
    averageWitnessPressure,
    averagePredationPressure,
    averageEmbarrassmentPressure,
    averageLegendPressure,
    averageMercyPressure,
    averageConfidencePressure,
    peakFunction,
    totalCandidates: result.candidates.length,
    pickedCount: result.picked.length,
    shadowRatio: result.picked.length > 0 ? round2(shadowPicked / result.picked.length) : 0,
    witnessSpread,
  });
}

// ============================================================================
// MARK: Dramatic coverage audit
// ============================================================================

export interface CrowdSynthesisCoverageReport {
  readonly channelId: string;
  readonly coveredFunctions: readonly CrowdReactionCandidate['dramaticFunction'][];
  readonly uncoveredFunctions: readonly CrowdReactionCandidate['dramaticFunction'][];
  readonly coverageRatio: number;
  readonly dominantArchetype: CrowdReactionCandidate['sourceArchetype'];
  readonly averageCandidateWeight: number;
  readonly averagePickedWeight: number;
  readonly visiblePickedCount: number;
  readonly shadowPickedCount: number;
}

const ALL_DRAMATIC_FUNCTIONS: readonly CrowdReactionCandidate['dramaticFunction'][] = [
  'AMBIENT', 'VALIDATION', 'RIDICULE', 'HYPE', 'PRESSURE',
  'WARNING', 'PREDATION', 'CEREMONY', 'MERCY', 'ECHO',
] as const;

export function auditCrowdSynthesisCoverage(result: CrowdSynthesisResult): CrowdSynthesisCoverageReport {
  const pickedFns = new Set(result.picked.map((c) => c.dramaticFunction));
  const coveredFunctions = ALL_DRAMATIC_FUNCTIONS.filter((fn) => pickedFns.has(fn));
  const uncoveredFunctions = ALL_DRAMATIC_FUNCTIONS.filter((fn) => !pickedFns.has(fn));

  const archetypeCounts = new Map<CrowdReactionCandidate['sourceArchetype'], number>();
  for (const c of result.candidates) {
    archetypeCounts.set(c.sourceArchetype, (archetypeCounts.get(c.sourceArchetype) ?? 0) + 1);
  }
  let dominantArchetype: CrowdReactionCandidate['sourceArchetype'] = 'CROWD';
  let dominantCount = 0;
  for (const [arch, count] of archetypeCounts.entries()) {
    if (count > dominantCount) { dominantCount = count; dominantArchetype = arch; }
  }

  const candidateWeights = result.candidates.map((c) => c.weight);
  const pickedWeights = result.picked.map((c) => c.weight);

  return Object.freeze({
    channelId: result.channelId,
    coveredFunctions: Object.freeze(coveredFunctions),
    uncoveredFunctions: Object.freeze(uncoveredFunctions),
    coverageRatio: round2(coveredFunctions.length / ALL_DRAMATIC_FUNCTIONS.length),
    dominantArchetype,
    averageCandidateWeight: round2(avg(candidateWeights)),
    averagePickedWeight: round2(avg(pickedWeights)),
    visiblePickedCount: result.picked.filter((c) => c.visibility === 'VISIBLE').length,
    shadowPickedCount: result.picked.filter((c) => c.visibility === 'SHADOW').length,
  });
}

// ============================================================================
// MARK: Diff
// ============================================================================

export interface CrowdSynthesisDiff {
  readonly channelId: string;
  readonly witnessPressureDelta: number;
  readonly predationPressureDelta: number;
  readonly embarrassmentPressureDelta: number;
  readonly legendPressureDelta: number;
  readonly mercyPressureDelta: number;
  readonly confidencePressureDelta: number;
  readonly candidateCountDelta: number;
  readonly pickedCountDelta: number;
  readonly newFunctions: readonly CrowdReactionCandidate['dramaticFunction'][];
  readonly droppedFunctions: readonly CrowdReactionCandidate['dramaticFunction'][];
  readonly moodChanged: boolean;
  readonly bandChanged: boolean;
  readonly swarmRiskChanged: boolean;
}

export function diffCrowdSynthesisResults(
  before: CrowdSynthesisResult,
  after: CrowdSynthesisResult,
): CrowdSynthesisDiff {
  const beforeFns = new Set(before.picked.map((c) => c.dramaticFunction));
  const afterFns = new Set(after.picked.map((c) => c.dramaticFunction));
  const newFunctions = [...afterFns].filter((fn) => !beforeFns.has(fn)) as CrowdReactionCandidate['dramaticFunction'][];
  const droppedFunctions = [...beforeFns].filter((fn) => !afterFns.has(fn)) as CrowdReactionCandidate['dramaticFunction'][];

  return Object.freeze({
    channelId: after.channelId,
    witnessPressureDelta: round2(after.summary.witnessPressure - before.summary.witnessPressure),
    predationPressureDelta: round2(after.summary.predationPressure - before.summary.predationPressure),
    embarrassmentPressureDelta: round2(after.summary.embarrassmentPressure - before.summary.embarrassmentPressure),
    legendPressureDelta: round2(after.summary.legendPressure - before.summary.legendPressure),
    mercyPressureDelta: round2(after.summary.mercyPressure - before.summary.mercyPressure),
    confidencePressureDelta: round2(after.summary.confidencePressure - before.summary.confidencePressure),
    candidateCountDelta: after.candidates.length - before.candidates.length,
    pickedCountDelta: after.picked.length - before.picked.length,
    newFunctions: Object.freeze(newFunctions),
    droppedFunctions: Object.freeze(droppedFunctions),
    moodChanged: after.dominantMood !== before.dominantMood,
    bandChanged: after.dominantBand !== before.dominantBand,
    swarmRiskChanged: after.swarmRiskBand !== before.swarmRiskBand,
  });
}

// ============================================================================
// MARK: Batch synthesis
// ============================================================================

export interface CrowdSynthesisBatchResult {
  readonly inputs: readonly CrowdSynthesisInput[];
  readonly results: readonly CrowdSynthesisResult[];
  readonly pressureSnapshots: readonly CrowdSynthesisPressureSnapshot[];
  readonly coverageReports: readonly CrowdSynthesisCoverageReport[];
  readonly batchPressureSnapshot: CrowdSynthesisPressureSnapshot;
  readonly totalCandidates: number;
  readonly totalPicked: number;
  readonly dominantMoods: readonly string[];
  readonly generatedAtMs: number;
}

export function runCrowdSynthesisBatch(
  engine: CrowdSynthesisEngine,
  inputs: readonly CrowdSynthesisInput[],
): CrowdSynthesisBatchResult {
  const results: CrowdSynthesisResult[] = [];
  for (const input of inputs) {
    results.push(engine.synthesize(input));
  }
  const pressureSnapshots = results.map((r, i) =>
    buildCrowdSynthesisPressureSnapshot(r, results.slice(0, i)),
  );
  const coverageReports = results.map((r) => auditCrowdSynthesisCoverage(r));
  const batchPressureSnapshot = buildCrowdSynthesisPressureSnapshot(
    results[results.length - 1] ?? results[0],
    results.slice(0, results.length - 1),
  );
  const dominantMoods = uniq(results.map((r) => r.dominantMood));

  return Object.freeze({
    inputs: Object.freeze([...inputs]),
    results: Object.freeze(results),
    pressureSnapshots: Object.freeze(pressureSnapshots),
    coverageReports: Object.freeze(coverageReports),
    batchPressureSnapshot,
    totalCandidates: results.reduce((sum, r) => sum + r.candidates.length, 0),
    totalPicked: results.reduce((sum, r) => sum + r.picked.length, 0),
    dominantMoods: Object.freeze(dominantMoods),
    generatedAtMs: Date.now(),
  });
}

// ============================================================================
// MARK: Channel weight matrix
// ============================================================================

export interface CrowdSynthesisChannelWeightEntry {
  readonly channelId: string;
  readonly baseWeight: number;
  readonly predationBias: number;
  readonly legendBias: number;
  readonly shadowLeakBias: number;
  readonly effectiveWeight: number;
}

export interface CrowdSynthesisChannelWeightMatrix {
  readonly config: CrowdSynthesisConfig;
  readonly channels: readonly CrowdSynthesisChannelWeightEntry[];
  readonly hottestChannel: string;
  readonly coldestChannel: string;
  readonly averageWeight: number;
}

const CHANNEL_IDS = [
  'GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY',
  'SYSTEM_SHADOW', 'NPC_SHADOW', 'RIVALRY_SHADOW', 'RESCUE_SHADOW', 'LIVEOPS_SHADOW',
] as const;

export function buildChannelWeightMatrix(config: CrowdSynthesisConfig): CrowdSynthesisChannelWeightMatrix {
  const entries: CrowdSynthesisChannelWeightEntry[] = CHANNEL_IDS.map((channelId) => {
    const base =
      channelId === 'GLOBAL' ? 14 * config.globalCrowdWeight :
      channelId === 'SYNDICATE' ? 10 * config.syndicatePrivacyWeight :
      channelId === 'DEAL_ROOM' ? 12 * config.dealRoomPredationWeight :
      channelId === 'LOBBY' ? 8 :
      channelId === 'RIVALRY_SHADOW' ? 9 * config.shadowLeakWeight :
      channelId === 'RESCUE_SHADOW' ? 7 * config.shadowLeakWeight :
      channelId === 'LIVEOPS_SHADOW' ? 11 * config.shadowLeakWeight :
      6 * config.shadowLeakWeight;

    const predationBias = channelId === 'DEAL_ROOM' ? config.dealRoomPredationWeight : 0;
    const legendBias = channelId === 'GLOBAL' ? config.legendAmplifier : 0;
    const shadowLeakBias = channelId.endsWith('SHADOW') ? config.shadowLeakWeight : 0;
    const effectiveWeight = round2(base + predationBias + legendBias * 0.5);

    return Object.freeze({ channelId, baseWeight: round2(base), predationBias, legendBias, shadowLeakBias, effectiveWeight });
  });

  const sorted = [...entries].sort((a, b) => b.effectiveWeight - a.effectiveWeight);
  const averageWeight = round2(avg(entries.map((e) => e.effectiveWeight)));

  return Object.freeze({
    config,
    channels: Object.freeze(entries),
    hottestChannel: sorted[0].channelId,
    coldestChannel: sorted[sorted.length - 1].channelId,
    averageWeight,
  });
}

// ============================================================================
// MARK: Temporal slice analysis
// ============================================================================

export interface CrowdSynthesisTemporalSlice {
  readonly windowStartMs: number;
  readonly windowEndMs: number;
  readonly results: readonly CrowdSynthesisResult[];
  readonly averageWitnessPressure: number;
  readonly averageLegendPressure: number;
  readonly peakPickedCount: number;
  readonly dominantMood: string;
  readonly swarmTriggered: boolean;
}

export function buildCrowdSynthesisTemporalSlices(
  results: readonly CrowdSynthesisResult[],
  windowMs: number = 30_000,
): readonly CrowdSynthesisTemporalSlice[] {
  if (!results.length) return Object.freeze([]);
  const minTs = Math.min(...results.map((r) => r.generatedAtMs));
  const maxTs = Math.max(...results.map((r) => r.generatedAtMs));
  const slices: CrowdSynthesisTemporalSlice[] = [];

  for (let start = minTs; start <= maxTs; start += windowMs) {
    const end = start + windowMs;
    const windowResults = results.filter((r) => r.generatedAtMs >= start && r.generatedAtMs < end);
    if (!windowResults.length) continue;

    const moodCounts = new Map<string, number>();
    for (const r of windowResults) {
      moodCounts.set(r.dominantMood, (moodCounts.get(r.dominantMood) ?? 0) + 1);
    }
    let dominantMood = 'CALM';
    let dominantMoodCount = 0;
    for (const [mood, count] of moodCounts.entries()) {
      if (count > dominantMoodCount) { dominantMoodCount = count; dominantMood = mood; }
    }

    slices.push(Object.freeze({
      windowStartMs: start,
      windowEndMs: end,
      results: Object.freeze(windowResults),
      averageWitnessPressure: round2(avg(windowResults.map((r) => r.summary.witnessPressure))),
      averageLegendPressure: round2(avg(windowResults.map((r) => r.summary.legendPressure))),
      peakPickedCount: Math.max(...windowResults.map((r) => r.picked.length)),
      dominantMood,
      swarmTriggered: windowResults.some((r) => r.swarmRiskBand === 'HIGH' || r.swarmRiskBand === 'SEVERE' || r.swarmRiskBand === 'OVERWHELMING'),
    }));
  }

  return Object.freeze(slices);
}

// ============================================================================
// MARK: Heat index
// ============================================================================

export interface CrowdSynthesisHeatIndex {
  readonly channelId: string;
  readonly witnessScore: number;
  readonly predationScore: number;
  readonly legendScore: number;
  readonly embarrassmentScore: number;
  readonly mercyScore: number;
  readonly compositeScore: number;
  readonly intensityBand: 'COLD' | 'WARM' | 'HOT' | 'BLAZING' | 'MYTHIC';
}

export function buildCrowdSynthesisHeatIndex(result: CrowdSynthesisResult): CrowdSynthesisHeatIndex {
  const { witnessPressure, predationPressure, legendPressure, embarrassmentPressure, mercyPressure, confidencePressure } = result.summary;
  const composite = round2(
    witnessPressure * 0.22 +
    predationPressure * 0.18 +
    legendPressure * 0.2 +
    embarrassmentPressure * 0.18 +
    mercyPressure * 0.1 +
    confidencePressure * 0.12,
  );
  const intensityBand: CrowdSynthesisHeatIndex['intensityBand'] =
    composite >= 80 ? 'MYTHIC' :
    composite >= 60 ? 'BLAZING' :
    composite >= 40 ? 'HOT' :
    composite >= 20 ? 'WARM' : 'COLD';

  return Object.freeze({
    channelId: result.channelId,
    witnessScore: round2(witnessPressure),
    predationScore: round2(predationPressure),
    legendScore: round2(legendPressure),
    embarrassmentScore: round2(embarrassmentPressure),
    mercyScore: round2(mercyPressure),
    compositeScore: composite,
    intensityBand,
  });
}

export function rankResultsByHeatIndex(results: readonly CrowdSynthesisResult[]): readonly CrowdSynthesisHeatIndex[] {
  return Object.freeze(
    results.map(buildCrowdSynthesisHeatIndex).sort((a, b) => b.compositeScore - a.compositeScore),
  );
}

// ============================================================================
// MARK: Decay state
// ============================================================================

export interface CrowdSynthesisDecayState {
  readonly channelId: string;
  readonly originalPickedCount: number;
  readonly decayedPickedCount: number;
  readonly decayRatio: number;
  readonly staleFunctions: readonly CrowdReactionCandidate['dramaticFunction'][];
  readonly isStale: boolean;
  readonly decayedAtMs: number;
}

export function computeCrowdSynthesisDecay(
  result: CrowdSynthesisResult,
  decayWindowMs: number = 60_000,
  now: number = Date.now(),
): CrowdSynthesisDecayState {
  const age = now - result.generatedAtMs;
  const decayFactor = clamp(age / decayWindowMs, 0, 1);
  const decayedPickedCount = Math.round(result.picked.length * (1 - decayFactor));
  const staleFunctions: CrowdReactionCandidate['dramaticFunction'][] = [];

  if (decayFactor > 0.5) {
    const lowWeightFns = result.picked
      .filter((c) => c.weight < 30)
      .map((c) => c.dramaticFunction);
    staleFunctions.push(...uniq(lowWeightFns));
  }

  return Object.freeze({
    channelId: result.channelId,
    originalPickedCount: result.picked.length,
    decayedPickedCount,
    decayRatio: round2(decayFactor),
    staleFunctions: Object.freeze(staleFunctions),
    isStale: decayFactor >= 1,
    decayedAtMs: now,
  });
}

export function listStaleSynthesisResults(
  results: readonly CrowdSynthesisResult[],
  decayWindowMs: number = 60_000,
  now: number = Date.now(),
): readonly CrowdSynthesisResult[] {
  return Object.freeze(
    results.filter((r) => computeCrowdSynthesisDecay(r, decayWindowMs, now).isStale),
  );
}

// ============================================================================
// MARK: Cross-channel comparison
// ============================================================================

export interface CrowdSynthesisCrossChannelComparison {
  readonly leftChannelId: string;
  readonly rightChannelId: string;
  readonly witnessPressureDiff: number;
  readonly predationPressureDiff: number;
  readonly legendPressureDiff: number;
  readonly dominantChannel: string;
  readonly sharedFunctions: readonly CrowdReactionCandidate['dramaticFunction'][];
  readonly uniqueToLeft: readonly CrowdReactionCandidate['dramaticFunction'][];
  readonly uniqueToRight: readonly CrowdReactionCandidate['dramaticFunction'][];
}

export function compareCrowdSynthesisChannels(
  left: CrowdSynthesisResult,
  right: CrowdSynthesisResult,
): CrowdSynthesisCrossChannelComparison {
  const leftFns = new Set(left.picked.map((c) => c.dramaticFunction));
  const rightFns = new Set(right.picked.map((c) => c.dramaticFunction));
  const sharedFunctions = [...leftFns].filter((fn) => rightFns.has(fn)) as CrowdReactionCandidate['dramaticFunction'][];
  const uniqueToLeft = [...leftFns].filter((fn) => !rightFns.has(fn)) as CrowdReactionCandidate['dramaticFunction'][];
  const uniqueToRight = [...rightFns].filter((fn) => !leftFns.has(fn)) as CrowdReactionCandidate['dramaticFunction'][];

  const leftComposite = left.summary.witnessPressure + left.summary.legendPressure + left.summary.predationPressure;
  const rightComposite = right.summary.witnessPressure + right.summary.legendPressure + right.summary.predationPressure;

  return Object.freeze({
    leftChannelId: left.channelId,
    rightChannelId: right.channelId,
    witnessPressureDiff: round2(left.summary.witnessPressure - right.summary.witnessPressure),
    predationPressureDiff: round2(left.summary.predationPressure - right.summary.predationPressure),
    legendPressureDiff: round2(left.summary.legendPressure - right.summary.legendPressure),
    dominantChannel: leftComposite >= rightComposite ? left.channelId : right.channelId,
    sharedFunctions: Object.freeze(sharedFunctions),
    uniqueToLeft: Object.freeze(uniqueToLeft),
    uniqueToRight: Object.freeze(uniqueToRight),
  });
}

// ============================================================================
// MARK: Annotation
// ============================================================================

export interface CrowdSynthesisAnnotation {
  readonly resultId: string;
  readonly channelId: string;
  readonly annotatedAtMs: number;
  readonly label: string;
  readonly notes: string;
  readonly tags: readonly string[];
  readonly flagged: boolean;
}

const _crowdAnnotationMap = new Map<string, CrowdSynthesisAnnotation>();

export function annotateCrowdSynthesisResult(
  result: CrowdSynthesisResult,
  annotation: Omit<CrowdSynthesisAnnotation, 'resultId' | 'channelId' | 'annotatedAtMs'>,
): CrowdSynthesisAnnotation {
  const id = `${result.channelId}:${result.generatedAtMs}:${result.playerId}`;
  const record = Object.freeze({
    resultId: id,
    channelId: result.channelId,
    annotatedAtMs: Date.now(),
    ...annotation,
  });
  _crowdAnnotationMap.set(id, record);
  return record;
}

export function getCrowdSynthesisAnnotation(result: CrowdSynthesisResult): CrowdSynthesisAnnotation | null {
  const id = `${result.channelId}:${result.generatedAtMs}:${result.playerId}`;
  return _crowdAnnotationMap.get(id) ?? null;
}

export function listAnnotatedCrowdResults(): readonly CrowdSynthesisAnnotation[] {
  return Object.freeze([..._crowdAnnotationMap.values()]);
}

export function listFlaggedCrowdResults(): readonly CrowdSynthesisAnnotation[] {
  return Object.freeze([..._crowdAnnotationMap.values()].filter((a) => a.flagged));
}

// ============================================================================
// MARK: Policy violation detection
// ============================================================================

export interface CrowdSynthesisPolicyViolation {
  readonly channelId: string;
  readonly violationType: 'OVERSATURATION' | 'MERCY_MISSING' | 'ECHO_FLOOD' | 'DUPLICATE_LINE' | 'WEIGHT_UNDERFLOW';
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly description: string;
  readonly candidateId?: string;
}

export function detectCrowdSynthesisPolicyViolations(
  result: CrowdSynthesisResult,
): readonly CrowdSynthesisPolicyViolation[] {
  const violations: CrowdSynthesisPolicyViolation[] = [];

  // Oversaturation: too many candidates for the channel
  if (result.candidates.length >= 70) {
    violations.push(Object.freeze({
      channelId: result.channelId,
      violationType: 'OVERSATURATION',
      severity: 'LOW',
      description: `Candidate pool of ${result.candidates.length} is near maximum capacity`,
    }));
  }

  // Mercy missing when embarrassment is high
  if (result.summary.embarrassmentPressure >= 60) {
    const hasMercy = result.picked.some((c) => c.dramaticFunction === 'MERCY');
    if (!hasMercy) {
      violations.push(Object.freeze({
        channelId: result.channelId,
        violationType: 'MERCY_MISSING',
        severity: 'MEDIUM',
        description: 'Embarrassment pressure is high but no MERCY candidate was picked',
      }));
    }
  }

  // Echo flood: too many ECHO candidates
  const echoCandidates = result.picked.filter((c) => c.dramaticFunction === 'ECHO');
  if (echoCandidates.length >= 3) {
    violations.push(Object.freeze({
      channelId: result.channelId,
      violationType: 'ECHO_FLOOD',
      severity: 'LOW',
      description: `${echoCandidates.length} ECHO candidates picked in one synthesis`,
    }));
  }

  // Duplicate lines
  const seenLines = new Set<string>();
  for (const c of result.picked) {
    if (seenLines.has(c.line)) {
      violations.push(Object.freeze({
        channelId: result.channelId,
        violationType: 'DUPLICATE_LINE',
        severity: 'HIGH',
        description: `Duplicate line detected: "${c.line.slice(0, 40)}"`,
        candidateId: c.id,
      }));
    }
    seenLines.add(c.line);
  }

  // Weight underflow
  for (const c of result.picked) {
    if (c.weight <= 0) {
      violations.push(Object.freeze({
        channelId: result.channelId,
        violationType: 'WEIGHT_UNDERFLOW',
        severity: 'HIGH',
        description: `Picked candidate ${c.id} has zero or negative weight`,
        candidateId: c.id,
      }));
    }
  }

  return Object.freeze(violations);
}

// ============================================================================
// MARK: Ledger stats
// ============================================================================

export interface CrowdSynthesisLedgerStats {
  readonly channelId: string;
  readonly totalResults: number;
  readonly totalCandidatesGenerated: number;
  readonly totalPicked: number;
  readonly averagePickedPerResult: number;
  readonly averageCandidatesPerResult: number;
  readonly functionDistribution: Readonly<Record<string, number>>;
  readonly archetypeDistribution: Readonly<Record<string, number>>;
  readonly generatedAt: number;
}

export function buildCrowdSynthesisLedgerStats(
  channelId: string,
  results: readonly CrowdSynthesisResult[],
): CrowdSynthesisLedgerStats {
  const fnDist: Record<string, number> = {};
  const archDist: Record<string, number> = {};
  let totalCandidates = 0;
  let totalPicked = 0;

  for (const r of results) {
    totalCandidates += r.candidates.length;
    totalPicked += r.picked.length;
    for (const c of r.picked) {
      fnDist[c.dramaticFunction] = (fnDist[c.dramaticFunction] ?? 0) + 1;
      archDist[c.sourceArchetype] = (archDist[c.sourceArchetype] ?? 0) + 1;
    }
  }

  return Object.freeze({
    channelId,
    totalResults: results.length,
    totalCandidatesGenerated: totalCandidates,
    totalPicked,
    averagePickedPerResult: round2(results.length > 0 ? totalPicked / results.length : 0),
    averageCandidatesPerResult: round2(results.length > 0 ? totalCandidates / results.length : 0),
    functionDistribution: Object.freeze(fnDist),
    archetypeDistribution: Object.freeze(archDist),
    generatedAt: Date.now(),
  });
}

// ============================================================================
// MARK: Profile system
// ============================================================================

export type CrowdSynthesisProfile = 'STANDARD' | 'CINEMATIC' | 'FORENSIC' | 'HIGH_VOLUME' | 'MINIMAL';

export interface CrowdSynthesisProfileDescriptor {
  readonly name: CrowdSynthesisProfile;
  readonly description: string;
  readonly configOverrides: Partial<CrowdSynthesisConfig>;
}

const CROWD_SYNTHESIS_ENGINE_PROFILE_DESCRIPTORS: readonly CrowdSynthesisProfileDescriptor[] = [
  {
    name: 'STANDARD',
    description: 'Balanced crowd synthesis for general gameplay events.',
    configOverrides: {},
  },
  {
    name: 'CINEMATIC',
    description: 'Deep candidate pools and higher legendary amplifiers for cinematic moments.',
    configOverrides: {
      maxReactionCandidates: 96,
      maxWitnessLines: 18,
      legendAmplifier: 1.5,
      reputationAmplifier: 1.3,
      ceremonialdDelay: 900,
    } as unknown as Partial<CrowdSynthesisConfig>,
  },
  {
    name: 'FORENSIC',
    description: 'Full detail audit — maximum candidates, all shadow channels amplified.',
    configOverrides: {
      maxReactionCandidates: 72,
      maxWitnessLines: 16,
      shadowLeakWeight: 0.85,
      volatilityAmplifier: 1.3,
    } as Partial<CrowdSynthesisConfig>,
  },
  {
    name: 'HIGH_VOLUME',
    description: 'Optimized for high-frequency event streams with tighter burst windows.',
    configOverrides: {
      maxReactionCandidates: 48,
      criticalSwarmBurstMs: 80,
      baseTimestampSpacingMs: 200,
    } as Partial<CrowdSynthesisConfig>,
  },
  {
    name: 'MINIMAL',
    description: 'Stripped-down crowd synthesis for low-stakes or test contexts.',
    configOverrides: {
      maxReactionCandidates: 24,
      maxWitnessLines: 6,
      maxAmbientLines: 4,
      crowdNoiseFloor: 8,
    } as Partial<CrowdSynthesisConfig>,
  },
] as const;

export const CROWD_SYNTHESIS_ENGINE_DOCTRINE = Object.freeze({
  authority: 'BACKEND' as const,
  version: '2026.03.23-crowd-synthesis-doctrine.v1',
  maxReactionCandidates: 72,
  maxPickedPerSynthesis: 6,
  decayWindowMs: 60_000,
  shadowRevealThreshold: 80,
  minWeightForPick: 0,
  supportedProfiles: ['STANDARD', 'CINEMATIC', 'FORENSIC', 'HIGH_VOLUME', 'MINIMAL'] as const,
});

// ============================================================================
// MARK: Module objects
// ============================================================================

export const ChatCrowdSynthesisEngineModule = Object.freeze({
  create: (config?: Partial<CrowdSynthesisConfig>): CrowdSynthesisEngine =>
    new CrowdSynthesisEngine(config),
  createCinematic: (): CrowdSynthesisEngine =>
    new CrowdSynthesisEngine(CROWD_SYNTHESIS_ENGINE_PROFILE_DESCRIPTORS.find((p) => p.name === 'CINEMATIC')!.configOverrides),
  createForensic: (): CrowdSynthesisEngine =>
    new CrowdSynthesisEngine(CROWD_SYNTHESIS_ENGINE_PROFILE_DESCRIPTORS.find((p) => p.name === 'FORENSIC')!.configOverrides),
  createHighVolume: (): CrowdSynthesisEngine =>
    new CrowdSynthesisEngine(CROWD_SYNTHESIS_ENGINE_PROFILE_DESCRIPTORS.find((p) => p.name === 'HIGH_VOLUME')!.configOverrides),
  createMinimal: (): CrowdSynthesisEngine =>
    new CrowdSynthesisEngine(CROWD_SYNTHESIS_ENGINE_PROFILE_DESCRIPTORS.find((p) => p.name === 'MINIMAL')!.configOverrides),
  runBatch: runCrowdSynthesisBatch,
  buildPressureSnapshot: buildCrowdSynthesisPressureSnapshot,
  auditCoverage: auditCrowdSynthesisCoverage,
  buildHeatIndex: buildCrowdSynthesisHeatIndex,
  rankByHeat: rankResultsByHeatIndex,
  diff: diffCrowdSynthesisResults,
  buildTemporalSlices: buildCrowdSynthesisTemporalSlices,
  buildChannelWeightMatrix,
  buildLedgerStats: buildCrowdSynthesisLedgerStats,
  detectViolations: detectCrowdSynthesisPolicyViolations,
  computeDecay: computeCrowdSynthesisDecay,
  listStale: listStaleSynthesisResults,
  compareChannels: compareCrowdSynthesisChannels,
  buildReputationGate,
  applyReputationGate,
  amplifyByReputationGate,
  annotate: annotateCrowdSynthesisResult,
  getAnnotation: getCrowdSynthesisAnnotation,
  listAnnotated: listAnnotatedCrowdResults,
  listFlagged: listFlaggedCrowdResults,
  doctrine: CROWD_SYNTHESIS_ENGINE_DOCTRINE,
} as const);

export const ChatCrowdSynthesisEngineProfileModule = Object.freeze({
  all: (): readonly CrowdSynthesisProfileDescriptor[] => CROWD_SYNTHESIS_ENGINE_PROFILE_DESCRIPTORS,
  byName: (name: CrowdSynthesisProfile): CrowdSynthesisProfileDescriptor | undefined =>
    CROWD_SYNTHESIS_ENGINE_PROFILE_DESCRIPTORS.find((p) => p.name === name),
  STANDARD: CROWD_SYNTHESIS_ENGINE_PROFILE_DESCRIPTORS[0],
  CINEMATIC: CROWD_SYNTHESIS_ENGINE_PROFILE_DESCRIPTORS[1],
  FORENSIC: CROWD_SYNTHESIS_ENGINE_PROFILE_DESCRIPTORS[2],
  HIGH_VOLUME: CROWD_SYNTHESIS_ENGINE_PROFILE_DESCRIPTORS[3],
  MINIMAL: CROWD_SYNTHESIS_ENGINE_PROFILE_DESCRIPTORS[4],
} as const);

// ============================================================================
// MARK: Hotspot detection
// ============================================================================

export interface CrowdSynthesisHotspot {
  readonly channelId: string;
  readonly peakGeneratedAtMs: number;
  readonly peakWitnessPressure: number;
  readonly peakLegendPressure: number;
  readonly peakEmbarrassmentPressure: number;
  readonly hotFunctions: readonly CrowdReactionCandidate['dramaticFunction'][];
  readonly hotArchetypes: readonly CrowdReactionCandidate['sourceArchetype'][];
  readonly resultCount: number;
  readonly isSwarmActive: boolean;
}

export function detectCrowdSynthesisHotspots(
  results: readonly CrowdSynthesisResult[],
  witnessThreshold: number = 40,
): readonly CrowdSynthesisHotspot[] {
  if (!results.length) return Object.freeze([]);

  const byChannel = new Map<string, CrowdSynthesisResult[]>();
  for (const r of results) {
    const existing = byChannel.get(r.channelId) ?? [];
    existing.push(r);
    byChannel.set(r.channelId, existing);
  }

  const hotspots: CrowdSynthesisHotspot[] = [];
  for (const [channelId, channelResults] of byChannel.entries()) {
    const hot = channelResults.filter((r) => r.summary.witnessPressure >= witnessThreshold);
    if (!hot.length) continue;

    const peakResult = hot.reduce((best, r) =>
      r.summary.witnessPressure > best.summary.witnessPressure ? r : best,
    );

    const hotFunctions: Set<CrowdReactionCandidate['dramaticFunction']> = new Set();
    const hotArchetypes: Set<CrowdReactionCandidate['sourceArchetype']> = new Set();
    for (const r of hot) {
      for (const c of r.picked) {
        hotFunctions.add(c.dramaticFunction);
        hotArchetypes.add(c.sourceArchetype);
      }
    }

    hotspots.push(Object.freeze({
      channelId,
      peakGeneratedAtMs: peakResult.generatedAtMs,
      peakWitnessPressure: peakResult.summary.witnessPressure,
      peakLegendPressure: peakResult.summary.legendPressure,
      peakEmbarrassmentPressure: peakResult.summary.embarrassmentPressure,
      hotFunctions: Object.freeze([...hotFunctions]),
      hotArchetypes: Object.freeze([...hotArchetypes]),
      resultCount: hot.length,
      isSwarmActive: hot.some((r) => r.swarmRiskBand === 'SEVERE' || r.swarmRiskBand === 'OVERWHELMING'),
    }));
  }

  return Object.freeze(hotspots.sort((a, b) => b.peakWitnessPressure - a.peakWitnessPressure));
}

// ============================================================================
// MARK: Forecast
// ============================================================================

export interface CrowdSynthesisForecast {
  readonly channelId: string;
  readonly forecastWindowMs: number;
  readonly predictedWitnessPressure: number;
  readonly predictedLegendPressure: number;
  readonly predictedPredationPressure: number;
  readonly predictedPeakFunction: CrowdReactionCandidate['dramaticFunction'];
  readonly swarmRiskForecast: 'NONE' | 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  readonly confidence: number;
  readonly generatedAt: number;
}

export function forecastCrowdSynthesis(
  recentResults: readonly CrowdSynthesisResult[],
  forecastWindowMs: number = 30_000,
): CrowdSynthesisForecast {
  const channelId = recentResults[0]?.channelId ?? 'UNKNOWN';
  if (!recentResults.length) {
    return Object.freeze({
      channelId,
      forecastWindowMs,
      predictedWitnessPressure: 0,
      predictedLegendPressure: 0,
      predictedPredationPressure: 0,
      predictedPeakFunction: 'AMBIENT',
      swarmRiskForecast: 'NONE',
      confidence: 0,
      generatedAt: Date.now(),
    });
  }

  const n = recentResults.length;
  const weights = recentResults.map((_, i) => (i + 1) / n);
  const weightSum = weights.reduce((a, b) => a + b, 0);

  const weightedWitness = recentResults.reduce((acc, r, i) => acc + r.summary.witnessPressure * weights[i], 0) / weightSum;
  const weightedLegend = recentResults.reduce((acc, r, i) => acc + r.summary.legendPressure * weights[i], 0) / weightSum;
  const weightedPredation = recentResults.reduce((acc, r, i) => acc + r.summary.predationPressure * weights[i], 0) / weightSum;

  const fnCounts = new Map<CrowdReactionCandidate['dramaticFunction'], number>();
  for (const r of recentResults) {
    for (const c of r.picked) { fnCounts.set(c.dramaticFunction, (fnCounts.get(c.dramaticFunction) ?? 0) + 1); }
  }
  let predictedPeakFunction: CrowdReactionCandidate['dramaticFunction'] = 'AMBIENT';
  let peakFnCount = 0;
  for (const [fn, count] of fnCounts.entries()) {
    if (count > peakFnCount) { peakFnCount = count; predictedPeakFunction = fn; }
  }

  const compositeRisk = weightedWitness * 0.4 + weightedPredation * 0.35 + weightedLegend * 0.25;
  const swarmRiskForecast: CrowdSynthesisForecast['swarmRiskForecast'] =
    compositeRisk >= 80 ? 'CRITICAL' :
    compositeRisk >= 60 ? 'HIGH' :
    compositeRisk >= 40 ? 'ELEVATED' :
    compositeRisk >= 20 ? 'LOW' : 'NONE';

  const confidence = round2(clamp(n / 10, 0, 1));

  return Object.freeze({
    channelId,
    forecastWindowMs,
    predictedWitnessPressure: round2(weightedWitness),
    predictedLegendPressure: round2(weightedLegend),
    predictedPredationPressure: round2(weightedPredation),
    predictedPeakFunction,
    swarmRiskForecast,
    confidence,
    generatedAt: Date.now(),
  });
}

// ============================================================================
// MARK: Transcript correlation
// ============================================================================

export interface CrowdSynthesisTranscriptCorrelation {
  readonly messageId: string;
  readonly channelId: string;
  readonly correlatedFunctions: readonly CrowdReactionCandidate['dramaticFunction'][];
  readonly correlatedArchetypes: readonly CrowdReactionCandidate['sourceArchetype'][];
  readonly witnessPressureAtTime: number;
  readonly predationPressureAtTime: number;
  readonly pickedLineCount: number;
}

export function buildTranscriptCorrelations(
  results: readonly CrowdSynthesisResult[],
): readonly CrowdSynthesisTranscriptCorrelation[] {
  const correlations: CrowdSynthesisTranscriptCorrelation[] = [];
  for (const r of results) {
    for (const c of r.candidates) {
      const msgId = String(c.metadata['messageId'] ?? null);
      if (!msgId || msgId === 'null') continue;
      const relatedPicked = r.picked.filter(
        (p) => String(p.metadata['messageId'] ?? null) === msgId,
      );
      correlations.push(Object.freeze({
        messageId: msgId,
        channelId: r.channelId,
        correlatedFunctions: Object.freeze(uniq(relatedPicked.map((p) => p.dramaticFunction))),
        correlatedArchetypes: Object.freeze(uniq(relatedPicked.map((p) => p.sourceArchetype))),
        witnessPressureAtTime: r.summary.witnessPressure,
        predationPressureAtTime: r.summary.predationPressure,
        pickedLineCount: relatedPicked.length,
      }));
    }
  }
  return Object.freeze(correlations);
}

// ============================================================================
// MARK: Volatility index
// ============================================================================

export interface CrowdSynthesisVolatilityIndex {
  readonly channelId: string;
  readonly pressureVariance: number;
  readonly legendVariance: number;
  readonly embarrassmentVariance: number;
  readonly isVolatile: boolean;
  readonly volatilityTier: 'STABLE' | 'FLUCTUATING' | 'VOLATILE' | 'CHAOTIC';
  readonly sampledResultCount: number;
}

function computeVariance(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = avg(values);
  return avg(values.map((v) => (v - mean) ** 2));
}

export function computeCrowdSynthesisVolatilityIndex(
  results: readonly CrowdSynthesisResult[],
): CrowdSynthesisVolatilityIndex {
  const channelId = results[0]?.channelId ?? 'UNKNOWN';
  if (results.length < 2) {
    return Object.freeze({
      channelId,
      pressureVariance: 0,
      legendVariance: 0,
      embarrassmentVariance: 0,
      isVolatile: false,
      volatilityTier: 'STABLE',
      sampledResultCount: results.length,
    });
  }

  const pressureVariance = round2(computeVariance(results.map((r) => r.summary.witnessPressure)));
  const legendVariance = round2(computeVariance(results.map((r) => r.summary.legendPressure)));
  const embarrassmentVariance = round2(computeVariance(results.map((r) => r.summary.embarrassmentPressure)));
  const composite = pressureVariance * 0.5 + legendVariance * 0.3 + embarrassmentVariance * 0.2;

  const volatilityTier: CrowdSynthesisVolatilityIndex['volatilityTier'] =
    composite >= 400 ? 'CHAOTIC' :
    composite >= 200 ? 'VOLATILE' :
    composite >= 80 ? 'FLUCTUATING' : 'STABLE';

  return Object.freeze({
    channelId,
    pressureVariance,
    legendVariance,
    embarrassmentVariance,
    isVolatile: volatilityTier === 'VOLATILE' || volatilityTier === 'CHAOTIC',
    volatilityTier,
    sampledResultCount: results.length,
  });
}

// ============================================================================
// MARK: Rebuild and audit
// ============================================================================

export interface CrowdSynthesisRebuildResult {
  readonly channelId: string;
  readonly processedCount: number;
  readonly violationCount: number;
  readonly violations: readonly CrowdSynthesisPolicyViolation[];
  readonly hotspots: readonly CrowdSynthesisHotspot[];
  readonly ledgerStats: CrowdSynthesisLedgerStats;
  readonly volatility: CrowdSynthesisVolatilityIndex;
  readonly rebuiltAtMs: number;
}

export function rebuildAndAuditCrowdSynthesis(
  channelId: string,
  results: readonly CrowdSynthesisResult[],
): CrowdSynthesisRebuildResult {
  const allViolations: CrowdSynthesisPolicyViolation[] = [];
  for (const r of results) {
    allViolations.push(...detectCrowdSynthesisPolicyViolations(r));
  }
  const hotspots = detectCrowdSynthesisHotspots(results);
  const ledgerStats = buildCrowdSynthesisLedgerStats(channelId, results);
  const volatility = computeCrowdSynthesisVolatilityIndex(results);

  return Object.freeze({
    channelId,
    processedCount: results.length,
    violationCount: allViolations.length,
    violations: Object.freeze(allViolations),
    hotspots,
    ledgerStats,
    volatility,
    rebuiltAtMs: Date.now(),
  });
}

// ============================================================================
// MARK: Serialization helpers
// ============================================================================

export interface CrowdSynthesisExportEnvelope {
  readonly channelId: string;
  readonly results: readonly CrowdSynthesisResult[];
  readonly ledgerStats: CrowdSynthesisLedgerStats;
  readonly volatility: CrowdSynthesisVolatilityIndex;
  readonly hotspots: readonly CrowdSynthesisHotspot[];
  readonly annotations: readonly CrowdSynthesisAnnotation[];
  readonly exportedAt: number;
}

export function exportCrowdSynthesisEnvelope(
  channelId: string,
  results: readonly CrowdSynthesisResult[],
): CrowdSynthesisExportEnvelope {
  return Object.freeze({
    channelId,
    results: Object.freeze([...results]),
    ledgerStats: buildCrowdSynthesisLedgerStats(channelId, results),
    volatility: computeCrowdSynthesisVolatilityIndex(results),
    hotspots: detectCrowdSynthesisHotspots(results),
    annotations: listAnnotatedCrowdResults().filter((a) => a.channelId === channelId),
    exportedAt: Date.now(),
  });
}

export function filterCrowdResultsByMood(
  results: readonly CrowdSynthesisResult[],
  mood: string,
): readonly CrowdSynthesisResult[] {
  return Object.freeze(results.filter((r) => r.dominantMood === mood));
}

export function filterCrowdResultsByBand(
  results: readonly CrowdSynthesisResult[],
  band: string,
): readonly CrowdSynthesisResult[] {
  return Object.freeze(results.filter((r) => r.dominantBand === band));
}

export function filterCrowdResultsBySwarmRisk(
  results: readonly CrowdSynthesisResult[],
  riskBand: string,
): readonly CrowdSynthesisResult[] {
  return Object.freeze(results.filter((r) => r.swarmRiskBand === riskBand));
}

export function sortCrowdResultsByWitnessPressure(
  results: readonly CrowdSynthesisResult[],
  descending = true,
): readonly CrowdSynthesisResult[] {
  return Object.freeze(
    [...results].sort((a, b) =>
      descending
        ? b.summary.witnessPressure - a.summary.witnessPressure
        : a.summary.witnessPressure - b.summary.witnessPressure,
    ),
  );
}
