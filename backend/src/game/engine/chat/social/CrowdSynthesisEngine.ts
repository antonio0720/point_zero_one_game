/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT SOCIAL AUTHORITY
 * ============================================================================
 *
 * This file is backend-owned runtime logic for the social pressure layer.
 * It is intentionally not a UI helper and not a shared-law contract.
 * It consumes social state, reputation state, channel mood, and event metadata
 * to synthesize authored crowd behavior for the run.
 *
 * Generated for repo-grounded integration work on antonio0720/point_zero_one_game.
 * ============================================================================
 */

import type { ChatChannelId, ChatChannelMood } from '../types';
import type {
  ChatAudienceBand,
  ChatAudienceHeatSummary,
  ChatChannelHeatProfile,
  ChatSwarmRiskBand,
} from '../../../../../shared/contracts/chat/ChatAudienceHeat';
import type {
  ChatReputationSummary,
  ChatReputationTier,
} from '../../../../../shared/contracts/chat/ChatReputation';

type Nullable<T> = T | null;
type Optional<T> = T | undefined;

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
  readonly actorReputation?: ChatReputationSummary | null;
  readonly subjectReputation?: ChatReputationSummary | null;
  readonly counterpartReputation?: ChatReputationSummary | null;
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
  readonly dominantMood: ChatChannelMood;
  readonly dominantBand: ChatAudienceBand;
  readonly swarmRiskBand: ChatSwarmRiskBand;
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
    if (input.channelProfile.audienceBand === 'LOUD' || input.channelProfile.audienceBand === 'SWARMING') count += 1;
    if (input.channelProfile.swarmRiskBand === 'HIGH' || input.channelProfile.swarmRiskBand === 'CRITICAL') count += 2;
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
      input.channelProfile.swarmRiskBand === 'CRITICAL' ? this.config.criticalSwarmBurstMs : this.channelDelay(input.channelId),
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
      case 'CEREMONIAL':
        functions.push('CEREMONY', 'VALIDATION');
        break;
      case 'PREDATORY':
        functions.push('PREDATION', 'PRESSURE');
        break;
      case 'HOSTILE':
      case 'PANIC':
        functions.push('PRESSURE', 'WARNING');
        break;
      case 'HEATED':
        functions.push('HYPE', 'PRESSURE');
        break;
      case 'WATCHFUL':
        functions.push('WARNING', 'AMBIENT');
        break;
      case 'CALM':
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
