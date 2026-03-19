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


export interface SwarmPlannerClock {
  now(): number;
}

export interface SwarmPlannerConfig {
  readonly authority: 'BACKEND';
  readonly version: string;
  readonly maxSequenceSteps: number;
  readonly maxBurstSteps: number;
  readonly escalationThreshold: number;
  readonly criticalThreshold: number;
  readonly embarrassmentBurstWeight: number;
  readonly legendBurstWeight: number;
  readonly predationBurstWeight: number;
  readonly globalSwarmAmplifier: number;
  readonly dealRoomSwarmAmplifier: number;
  readonly shadowSwarmLeakWeight: number;
  readonly minDelayMs: number;
  readonly baseDelayMs: number;
  readonly burstDelayMs: number;
  readonly mercySuppressionWindowMs: number;
}

export interface SwarmPlannerInput {
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
  readonly heatSummary: ChatAudienceHeatSummary;
  readonly channelProfile: ChatChannelHeatProfile;
  readonly actorReputation?: ChatReputationSummary | null;
  readonly subjectReputation?: ChatReputationSummary | null;
  readonly counterpartReputation?: ChatReputationSummary | null;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SwarmReactionStep {
  readonly id: string;
  readonly channelId: ChatChannelId;
  readonly function:
    | 'OPEN_WITNESS'
    | 'DOGPILE'
    | 'PRESSURE_SPIKE'
    | 'DEAL_POUNCE'
    | 'SYNDICATE_WHISPER'
    | 'SHADOW_MARK'
    | 'MERCY_BREAK'
    | 'CEREMONIAL_CROWN'
    | 'AFTERSHOCK';
  readonly line: string;
  readonly delayMs: number;
  readonly weight: number;
  readonly visibility: 'VISIBLE' | 'SHADOW';
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface SwarmReactionPlan {
  readonly playerId: string;
  readonly runId: string | null;
  readonly sessionId: string | null;
  readonly channelId: ChatChannelId;
  readonly generatedAtMs: number;
  readonly triggered: boolean;
  readonly triggerReason: string;
  readonly severity: 'NONE' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  readonly steps: readonly SwarmReactionStep[];
}

const DEFAULT_CLOCK: SwarmPlannerClock = {
  now(): number {
    return Date.now();
  },
};

const DEFAULT_CONFIG: SwarmPlannerConfig = Object.freeze({
  authority: 'BACKEND',
  version: '2026.03.19-swarm-planner',
  maxSequenceSteps: 12,
  maxBurstSteps: 5,
  escalationThreshold: 58,
  criticalThreshold: 76,
  embarrassmentBurstWeight: 1.22,
  legendBurstWeight: 1.16,
  predationBurstWeight: 1.18,
  globalSwarmAmplifier: 1.2,
  dealRoomSwarmAmplifier: 1.24,
  shadowSwarmLeakWeight: 0.52,
  minDelayMs: 90,
  baseDelayMs: 220,
  burstDelayMs: 120,
  mercySuppressionWindowMs: 1800,
});


export class SwarmReactionPlanner {
  private readonly config: SwarmPlannerConfig;
  private readonly clock: SwarmPlannerClock;

  public constructor(
    config: Partial<SwarmPlannerConfig> = {},
    clock: SwarmPlannerClock = DEFAULT_CLOCK,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.clock = clock;
  }

  public plan(input: SwarmPlannerInput): SwarmReactionPlan {
    const generatedAtMs = input.occurredAtMs ?? this.clock.now();
    const severity = this.resolveSeverity(input);
    if (severity === 'NONE') {
      return {
        playerId: input.playerId,
        runId: input.runId ?? null,
        sessionId: input.sessionId ?? null,
        channelId: input.channelId,
        generatedAtMs,
        triggered: false,
        triggerReason: 'Heat below swarm threshold',
        severity,
        steps: [],
      };
    }

    const steps: SwarmReactionStep[] = [];
    this.pushWitnessOpen(steps, input, severity, generatedAtMs);
    this.pushPressureSpikes(steps, input, severity, generatedAtMs);
    this.pushFunctionSpecificBursts(steps, input, severity, generatedAtMs);
    steps.push(...this.buildGlobalSpecificSteps(input, severity, generatedAtMs));
    steps.push(...this.buildSyndicateSpecificSteps(input, severity, generatedAtMs));
    steps.push(...this.buildDealRoomSpecificSteps(input, severity, generatedAtMs));
    steps.push(...this.buildLobbySpecificSteps(input, severity, generatedAtMs));
    steps.push(...this.buildSystemShadowSpecificSteps(input, severity, generatedAtMs));
    steps.push(...this.buildNpcShadowSpecificSteps(input, severity, generatedAtMs));
    steps.push(...this.buildRivalryShadowSpecificSteps(input, severity, generatedAtMs));
    steps.push(...this.buildRescueShadowSpecificSteps(input, severity, generatedAtMs));
    steps.push(...this.buildLiveopsShadowSpecificSteps(input, severity, generatedAtMs));
    this.pushAftershock(steps, input, severity, generatedAtMs);

    return {
      playerId: input.playerId,
      runId: input.runId ?? null,
      sessionId: input.sessionId ?? null,
      channelId: input.channelId,
      generatedAtMs,
      triggered: true,
      triggerReason: this.triggerReason(input, severity),
      severity,
      steps: steps
        .sort((a, b) => a.delayMs - b.delayMs || b.weight - a.weight)
        .slice(0, this.config.maxSequenceSteps),
    };
  }

  private resolveSeverity(input: SwarmPlannerInput): SwarmReactionPlan['severity'] {
    const heat = input.channelProfile.totalHeat;
    const embarrassment = input.subjectReputation?.shame ?? 0;
    const predation = input.channelProfile.predationShare;
    const legend = input.actorReputation?.legendPressure ?? 0;
    const score = heat + embarrassment * 0.35 + predation * 0.28 + legend * 0.16;

    if (score < this.config.escalationThreshold) return 'NONE';
    if (score < this.config.criticalThreshold) return 'HIGH';
    if (score < 92) return 'CRITICAL';
    return 'CRITICAL';
  }

  private triggerReason(input: SwarmPlannerInput, severity: SwarmReactionPlan['severity']): string {
    const eventType = input.eventType.toUpperCase();
    if (eventType.includes('COLLAPSE') || eventType.includes('BANKRUPT')) return 'Collapse witness convergence';
    if (eventType.includes('COMEBACK') || eventType.includes('SOVEREIGN')) return 'Legend witness convergence';
    if (input.channelId === 'DEAL_ROOM') return 'Predatory deal convergence';
    if (severity === 'CRITICAL') return 'Critical heat threshold crossed';
    return 'Swarm threshold crossed';
  }

  private pushWitnessOpen(
    out: SwarmReactionStep[],
    input: SwarmPlannerInput,
    severity: SwarmReactionPlan['severity'],
    generatedAtMs: number,
  ): void {
    out.push({
      id: `${input.channelId}:OPEN_WITNESS:${generatedAtMs}`,
      channelId: input.channelId,
      function: 'OPEN_WITNESS',
      line: this.witnessLine(input),
      delayMs: this.config.minDelayMs,
      weight: this.baseWeight(input, severity) + 4,
      visibility: input.channelId.endsWith('SHADOW') ? 'SHADOW' : 'VISIBLE',
      metadata: { severity, eventType: input.eventType },
    });
  }

  private pushPressureSpikes(
    out: SwarmReactionStep[],
    input: SwarmPlannerInput,
    severity: SwarmReactionPlan['severity'],
    generatedAtMs: number,
  ): void {
    const steps = this.channelSpecificStepCount(input, severity);
    for (let i = 0; i < steps; i += 1) {
      out.push({
        id: `${input.channelId}:PRESSURE_SPIKE:${generatedAtMs}:${i}`,
        channelId: input.channelId,
        function: 'PRESSURE_SPIKE',
        line: this.pressureLine(input, i),
        delayMs: this.config.baseDelayMs + i * this.config.burstDelayMs,
        weight: this.baseWeight(input, severity) + (steps - i),
        visibility: input.channelId.endsWith('SHADOW') ? 'SHADOW' : 'VISIBLE',
        metadata: { severity, ordinal: i },
      });
    }
  }

  private pushFunctionSpecificBursts(
    out: SwarmReactionStep[],
    input: SwarmPlannerInput,
    severity: SwarmReactionPlan['severity'],
    generatedAtMs: number,
  ): void {
    if (input.channelId === 'DEAL_ROOM') {
      out.push({
        id: `${input.channelId}:DEAL_POUNCE:${generatedAtMs}`,
        channelId: input.channelId,
        function: 'DEAL_POUNCE',
        line: 'The room sees weakness as a spread now.',
        delayMs: this.config.baseDelayMs + 80,
        weight: this.baseWeight(input, severity) + 6,
        visibility: 'VISIBLE',
        metadata: { severity, mode: 'deal' },
      });
    }

    if (input.channelId === 'SYNDICATE') {
      out.push({
        id: `${input.channelId}:SYNDICATE_WHISPER:${generatedAtMs}`,
        channelId: input.channelId,
        function: 'SYNDICATE_WHISPER',
        line: 'The private room does not forgive the obvious.',
        delayMs: this.config.baseDelayMs + 180,
        weight: this.baseWeight(input, severity) + 3,
        visibility: 'VISIBLE',
        metadata: { severity, mode: 'syndicate' },
      });
    }

    if (input.channelId.endsWith('SHADOW')) {
      out.push({
        id: `${input.channelId}:SHADOW_MARK:${generatedAtMs}`,
        channelId: input.channelId,
        function: 'SHADOW_MARK',
        line: 'The mark stays even after the room moves on.',
        delayMs: this.config.baseDelayMs + 240,
        weight: this.baseWeight(input, severity) + 5,
        visibility: 'SHADOW',
        metadata: { severity, mode: 'shadow' },
      });
    }

    const eventType = input.eventType.toUpperCase();
    if (eventType.includes('RESCUE') && (input.actorReputation?.trust ?? 0) > 38) {
      out.push({
        id: `${input.channelId}:MERCY_BREAK:${generatedAtMs}`,
        channelId: input.channelId,
        function: 'MERCY_BREAK',
        line: 'The pile hesitates. Someone bought a breath.',
        delayMs: this.config.mercySuppressionWindowMs,
        weight: this.baseWeight(input, severity) - 2,
        visibility: input.channelId.endsWith('SHADOW') ? 'SHADOW' : 'VISIBLE',
        metadata: { severity, mode: 'mercy' },
      });
    }

    if (eventType.includes('COMEBACK') || eventType.includes('SOVEREIGN') || eventType.includes('LEGEND')) {
      out.push({
        id: `${input.channelId}:CEREMONIAL_CROWN:${generatedAtMs}`,
        channelId: input.channelId,
        function: 'CEREMONIAL_CROWN',
        line: 'The swarm flips from hunger to witness.',
        delayMs: this.config.baseDelayMs + 300,
        weight: this.baseWeight(input, severity) + 7,
        visibility: input.channelId.endsWith('SHADOW') ? 'SHADOW' : 'VISIBLE',
        metadata: { severity, mode: 'legend' },
      });
    }

    if ((input.subjectReputation?.shame ?? 0) >= 40) {
      out.push({
        id: `${input.channelId}:DOGPILE:${generatedAtMs}`,
        channelId: input.channelId,
        function: 'DOGPILE',
        line: 'The room found the bruise and kept pressing.',
        delayMs: this.config.baseDelayMs + 40,
        weight: this.baseWeight(input, severity) + 8,
        visibility: input.channelId.endsWith('SHADOW') ? 'SHADOW' : 'VISIBLE',
        metadata: { severity, mode: 'shame' },
      });
    }
  }

  private pushAftershock(
    out: SwarmReactionStep[],
    input: SwarmPlannerInput,
    severity: SwarmReactionPlan['severity'],
    generatedAtMs: number,
  ): void {
    out.push({
      id: `${input.channelId}:AFTERSHOCK:${generatedAtMs}`,
      channelId: input.channelId,
      function: 'AFTERSHOCK',
      line: this.aftershockLine(input, severity),
      delayMs: this.config.baseDelayMs + this.config.burstDelayMs * 4,
      weight: this.baseWeight(input, severity),
      visibility: input.channelId.endsWith('SHADOW') ? 'SHADOW' : 'VISIBLE',
      metadata: { severity, band: input.channelProfile.audienceBand },
    });
  }

  private baseWeight(input: SwarmPlannerInput, severity: SwarmReactionPlan['severity']): number {
    const severityBoost = severity === 'CRITICAL' ? 16 : severity === 'HIGH' ? 10 : 6;
    const heatBoost = input.channelProfile.totalHeat * 0.18;
    const shameBoost = (input.subjectReputation?.shame ?? 0) * 0.12 * this.config.embarrassmentBurstWeight;
    const legendBoost = (input.actorReputation?.legendPressure ?? 0) * 0.1 * this.config.legendBurstWeight;
    const predationBoost = input.channelProfile.predationShare * 0.1 * this.config.predationBurstWeight;
    const moodBoost = this.moodEscalationBias(input.channelProfile.mood);
    const eventBoost = this.eventEscalationBias(input.eventType);
    const channelBoost = this.channelEscalationBias(input.channelId);
    return round2((severityBoost + heatBoost + shameBoost + legendBoost + predationBoost) * channelBoost * moodBoost * eventBoost);
  }

  private witnessLine(input: SwarmPlannerInput): string {
    if (input.channelId === 'DEAL_ROOM') return 'Every eye in the room just recalculated.';
    if (input.channelId === 'SYNDICATE') return 'The private room noticed before anyone said it.';
    if (input.channelId.endsWith('SHADOW')) return 'The hidden room opened its eyes.';
    return 'The room shifted from watching to participating.';
  }

  private pressureLine(input: SwarmPlannerInput, ordinal: number): string {
    const lines = [
      'The pressure is visible now.',
      'The room starts leaning the same direction.',
      'Nobody in here is pretending not to see it.',
      'The pace changes when the crowd agrees.',
      'This is where the room stops being neutral.',
    ];
    return lines[ordinal % lines.length];
  }

  private aftershockLine(input: SwarmPlannerInput, severity: SwarmReactionPlan['severity']): string {
    if (severity === 'CRITICAL') return `${this.severityPhraseCritical(input.eventType)} The echo stays dangerous.`;
    if (severity === 'HIGH') return `${this.severityPhraseHigh(input.eventType)} The room is slower, not clean.`;
    if (severity === 'ELEVATED') return this.severityPhraseElevated(input.eventType);
    if (input.channelId.endsWith('SHADOW')) return 'The echo is quieter, not gone.';
    return this.severityPhraseNone(input.eventType);
  }

  private channelEscalationBias(channelId: ChatChannelId): number {
    switch (channelId) {
      case 'GLOBAL':
        return this.config.globalSwarmAmplifier;
      case 'DEAL_ROOM':
        return this.config.dealRoomSwarmAmplifier;
      case 'RIVALRY_SHADOW':
      case 'LIVEOPS_SHADOW':
        return this.config.shadowSwarmLeakWeight + 0.18;
      case 'SYNDICATE':
        return 0.94;
      case 'LOBBY':
        return 0.82;
      default:
        return 1;
    }
  }

  private moodEscalationBias(mood: ChatChannelMood): number {
    switch (mood) {
      case 'PREDATORY':
        return 1.24;
      case 'HOSTILE':
        return 1.18;
      case 'PANIC':
        return 1.16;
      case 'HEATED':
        return 1.08;
      case 'WATCHFUL':
        return 1.02;
      case 'CEREMONIAL':
        return 0.96;
      case 'CALM':
      default:
        return 0.9;
    }
  }

  private eventEscalationBias(eventType: string): number {
    const normalized = eventType.toUpperCase();
    if (normalized.includes('COLLAPSE') || normalized.includes('BANKRUPT')) return 1.28;
    if (normalized.includes('SOVEREIGN') || normalized.includes('LEGEND') || normalized.includes('COMEBACK')) return 1.22;
    if (normalized.includes('DEAL') || normalized.includes('BLUFF')) return 1.18;
    if (normalized.includes('RESCUE')) return 0.84;
    if (normalized.includes('LIVEOPS')) return 1.14;
    return 1;
  }

  private pressureVector(input: SwarmPlannerInput): {
    embarrassment: number;
    legend: number;
    predation: number;
    fear: number;
    volatility: number;
  } {
    return {
      embarrassment: round2((input.subjectReputation?.shame ?? 0) * this.config.embarrassmentBurstWeight),
      legend: round2((input.actorReputation?.legendPressure ?? 0) * this.config.legendBurstWeight),
      predation: round2(input.channelProfile.predationShare * this.config.predationBurstWeight),
      fear: round2((input.subjectReputation?.fear ?? 0) + (input.counterpartReputation?.threat ?? 0) * 0.5),
      volatility: round2((input.subjectReputation?.volatility ?? 0) + input.channelProfile.volatilityScore),
    };
  }

  private channelSpecificStepCount(input: SwarmPlannerInput, severity: SwarmReactionPlan['severity']): number {
    let count = severity === 'CRITICAL' ? 5 : 3;
    if (input.channelId === 'GLOBAL') count += 1;
    if (input.channelId === 'DEAL_ROOM') count += 1;
    if (input.channelId.endsWith('SHADOW')) count = Math.max(2, count - 1);
    return clamp(count, 2, this.config.maxBurstSteps);
  }


  private buildGlobalSpecificSteps(
    input: SwarmPlannerInput,
    severity: SwarmReactionPlan['severity'],
    generatedAtMs: number,
  ): SwarmReactionStep[] {
    if (input.channelId !== 'GLOBAL') return [];
    const weight = this.baseWeight(input, severity) + 1;
    const steps: SwarmReactionStep[] = [];
    steps.push({
      id: `${input.channelId}:GLOBAL:ANCHOR:${generatedAtMs}`,
      channelId: input.channelId,
      function: 'PRESSURE_SPIKE',
      line: "GLOBAL channel locks onto the moment.",
      delayMs: this.config.baseDelayMs + 0,
      weight,
      visibility: 'VISIBLE',
      metadata: { severity, channelTag: "GLOBAL" },
    });
    steps.push({
      id: `${input.channelId}:GLOBAL:FOLLOW:${generatedAtMs}`,
      channelId: input.channelId,
      function: 'OPEN_WITNESS',
      line: "GLOBAL carries the pressure forward.",
      delayMs: this.config.baseDelayMs + 140,
      weight: weight - 1,
      visibility: 'VISIBLE',
      metadata: { severity, channelTag: "GLOBAL", phase: 'follow' },
    });
    return steps;
  }

  private buildSyndicateSpecificSteps(
    input: SwarmPlannerInput,
    severity: SwarmReactionPlan['severity'],
    generatedAtMs: number,
  ): SwarmReactionStep[] {
    if (input.channelId !== 'SYNDICATE') return [];
    const weight = this.baseWeight(input, severity) + 2;
    const steps: SwarmReactionStep[] = [];
    steps.push({
      id: `${input.channelId}:SYNDICATE:ANCHOR:${generatedAtMs}`,
      channelId: input.channelId,
      function: 'PRESSURE_SPIKE',
      line: "SYNDICATE channel locks onto the moment.",
      delayMs: this.config.baseDelayMs + 15,
      weight,
      visibility: 'VISIBLE',
      metadata: { severity, channelTag: "SYNDICATE" },
    });
    steps.push({
      id: `${input.channelId}:SYNDICATE:FOLLOW:${generatedAtMs}`,
      channelId: input.channelId,
      function: 'OPEN_WITNESS',
      line: "SYNDICATE carries the pressure forward.",
      delayMs: this.config.baseDelayMs + 155,
      weight: weight - 1,
      visibility: 'VISIBLE',
      metadata: { severity, channelTag: "SYNDICATE", phase: 'follow' },
    });
    return steps;
  }

  private buildDealRoomSpecificSteps(
    input: SwarmPlannerInput,
    severity: SwarmReactionPlan['severity'],
    generatedAtMs: number,
  ): SwarmReactionStep[] {
    if (input.channelId !== 'DEAL_ROOM') return [];
    const weight = this.baseWeight(input, severity) + 3;
    const steps: SwarmReactionStep[] = [];
    steps.push({
      id: `${input.channelId}:DEAL_ROOM:ANCHOR:${generatedAtMs}`,
      channelId: input.channelId,
      function: 'PRESSURE_SPIKE',
      line: "DEAL_ROOM channel locks onto the moment.",
      delayMs: this.config.baseDelayMs + 30,
      weight,
      visibility: 'VISIBLE',
      metadata: { severity, channelTag: "DEAL_ROOM" },
    });
    steps.push({
      id: `${input.channelId}:DEAL_ROOM:FOLLOW:${generatedAtMs}`,
      channelId: input.channelId,
      function: 'OPEN_WITNESS',
      line: "DEAL_ROOM carries the pressure forward.",
      delayMs: this.config.baseDelayMs + 170,
      weight: weight - 1,
      visibility: 'VISIBLE',
      metadata: { severity, channelTag: "DEAL_ROOM", phase: 'follow' },
    });
    return steps;
  }

  private buildLobbySpecificSteps(
    input: SwarmPlannerInput,
    severity: SwarmReactionPlan['severity'],
    generatedAtMs: number,
  ): SwarmReactionStep[] {
    if (input.channelId !== 'LOBBY') return [];
    const weight = this.baseWeight(input, severity) + 4;
    const steps: SwarmReactionStep[] = [];
    steps.push({
      id: `${input.channelId}:LOBBY:ANCHOR:${generatedAtMs}`,
      channelId: input.channelId,
      function: 'PRESSURE_SPIKE',
      line: "LOBBY channel locks onto the moment.",
      delayMs: this.config.baseDelayMs + 45,
      weight,
      visibility: 'VISIBLE',
      metadata: { severity, channelTag: "LOBBY" },
    });
    steps.push({
      id: `${input.channelId}:LOBBY:FOLLOW:${generatedAtMs}`,
      channelId: input.channelId,
      function: 'OPEN_WITNESS',
      line: "LOBBY carries the pressure forward.",
      delayMs: this.config.baseDelayMs + 185,
      weight: weight - 1,
      visibility: 'VISIBLE',
      metadata: { severity, channelTag: "LOBBY", phase: 'follow' },
    });
    return steps;
  }

  private buildSystemShadowSpecificSteps(
    input: SwarmPlannerInput,
    severity: SwarmReactionPlan['severity'],
    generatedAtMs: number,
  ): SwarmReactionStep[] {
    if (input.channelId !== 'SYSTEM_SHADOW') return [];
    const weight = this.baseWeight(input, severity) + 5;
    const steps: SwarmReactionStep[] = [];
    steps.push({
      id: `${input.channelId}:SYSTEM_SHADOW:ANCHOR:${generatedAtMs}`,
      channelId: input.channelId,
      function: 'SHADOW_MARK',
      line: "SYSTEM_SHADOW channel locks onto the moment.",
      delayMs: this.config.baseDelayMs + 60,
      weight,
      visibility: 'SHADOW',
      metadata: { severity, channelTag: "SYSTEM_SHADOW" },
    });
    steps.push({
      id: `${input.channelId}:SYSTEM_SHADOW:FOLLOW:${generatedAtMs}`,
      channelId: input.channelId,
      function: 'AFTERSHOCK',
      line: "SYSTEM_SHADOW carries the pressure forward.",
      delayMs: this.config.baseDelayMs + 200,
      weight: weight - 1,
      visibility: 'SHADOW',
      metadata: { severity, channelTag: "SYSTEM_SHADOW", phase: 'follow' },
    });
    return steps;
  }

  private buildNpcShadowSpecificSteps(
    input: SwarmPlannerInput,
    severity: SwarmReactionPlan['severity'],
    generatedAtMs: number,
  ): SwarmReactionStep[] {
    if (input.channelId !== 'NPC_SHADOW') return [];
    const weight = this.baseWeight(input, severity) + 6;
    const steps: SwarmReactionStep[] = [];
    steps.push({
      id: `${input.channelId}:NPC_SHADOW:ANCHOR:${generatedAtMs}`,
      channelId: input.channelId,
      function: 'SHADOW_MARK',
      line: "NPC_SHADOW channel locks onto the moment.",
      delayMs: this.config.baseDelayMs + 75,
      weight,
      visibility: 'SHADOW',
      metadata: { severity, channelTag: "NPC_SHADOW" },
    });
    steps.push({
      id: `${input.channelId}:NPC_SHADOW:FOLLOW:${generatedAtMs}`,
      channelId: input.channelId,
      function: 'AFTERSHOCK',
      line: "NPC_SHADOW carries the pressure forward.",
      delayMs: this.config.baseDelayMs + 215,
      weight: weight - 1,
      visibility: 'SHADOW',
      metadata: { severity, channelTag: "NPC_SHADOW", phase: 'follow' },
    });
    return steps;
  }

  private buildRivalryShadowSpecificSteps(
    input: SwarmPlannerInput,
    severity: SwarmReactionPlan['severity'],
    generatedAtMs: number,
  ): SwarmReactionStep[] {
    if (input.channelId !== 'RIVALRY_SHADOW') return [];
    const weight = this.baseWeight(input, severity) + 7;
    const steps: SwarmReactionStep[] = [];
    steps.push({
      id: `${input.channelId}:RIVALRY_SHADOW:ANCHOR:${generatedAtMs}`,
      channelId: input.channelId,
      function: 'SHADOW_MARK',
      line: "RIVALRY_SHADOW channel locks onto the moment.",
      delayMs: this.config.baseDelayMs + 90,
      weight,
      visibility: 'SHADOW',
      metadata: { severity, channelTag: "RIVALRY_SHADOW" },
    });
    steps.push({
      id: `${input.channelId}:RIVALRY_SHADOW:FOLLOW:${generatedAtMs}`,
      channelId: input.channelId,
      function: 'AFTERSHOCK',
      line: "RIVALRY_SHADOW carries the pressure forward.",
      delayMs: this.config.baseDelayMs + 230,
      weight: weight - 1,
      visibility: 'SHADOW',
      metadata: { severity, channelTag: "RIVALRY_SHADOW", phase: 'follow' },
    });
    return steps;
  }

  private buildRescueShadowSpecificSteps(
    input: SwarmPlannerInput,
    severity: SwarmReactionPlan['severity'],
    generatedAtMs: number,
  ): SwarmReactionStep[] {
    if (input.channelId !== 'RESCUE_SHADOW') return [];
    const weight = this.baseWeight(input, severity) + 8;
    const steps: SwarmReactionStep[] = [];
    steps.push({
      id: `${input.channelId}:RESCUE_SHADOW:ANCHOR:${generatedAtMs}`,
      channelId: input.channelId,
      function: 'SHADOW_MARK',
      line: "RESCUE_SHADOW channel locks onto the moment.",
      delayMs: this.config.baseDelayMs + 105,
      weight,
      visibility: 'SHADOW',
      metadata: { severity, channelTag: "RESCUE_SHADOW" },
    });
    steps.push({
      id: `${input.channelId}:RESCUE_SHADOW:FOLLOW:${generatedAtMs}`,
      channelId: input.channelId,
      function: 'AFTERSHOCK',
      line: "RESCUE_SHADOW carries the pressure forward.",
      delayMs: this.config.baseDelayMs + 245,
      weight: weight - 1,
      visibility: 'SHADOW',
      metadata: { severity, channelTag: "RESCUE_SHADOW", phase: 'follow' },
    });
    return steps;
  }

  private buildLiveopsShadowSpecificSteps(
    input: SwarmPlannerInput,
    severity: SwarmReactionPlan['severity'],
    generatedAtMs: number,
  ): SwarmReactionStep[] {
    if (input.channelId !== 'LIVEOPS_SHADOW') return [];
    const weight = this.baseWeight(input, severity) + 9;
    const steps: SwarmReactionStep[] = [];
    steps.push({
      id: `${input.channelId}:LIVEOPS_SHADOW:ANCHOR:${generatedAtMs}`,
      channelId: input.channelId,
      function: 'SHADOW_MARK',
      line: "LIVEOPS_SHADOW channel locks onto the moment.",
      delayMs: this.config.baseDelayMs + 120,
      weight,
      visibility: 'SHADOW',
      metadata: { severity, channelTag: "LIVEOPS_SHADOW" },
    });
    steps.push({
      id: `${input.channelId}:LIVEOPS_SHADOW:FOLLOW:${generatedAtMs}`,
      channelId: input.channelId,
      function: 'AFTERSHOCK',
      line: "LIVEOPS_SHADOW carries the pressure forward.",
      delayMs: this.config.baseDelayMs + 260,
      weight: weight - 1,
      visibility: 'SHADOW',
      metadata: { severity, channelTag: "LIVEOPS_SHADOW", phase: 'follow' },
    });
    return steps;
  }

  private severityPhraseNone(eventType: string): string {
    const normalized = eventType.toUpperCase();
    if (normalized.includes('COLLAPSE')) return "None collapse pressure remains in the room.";
    if (normalized.includes('COMEBACK')) return "None comeback witness pressure remains active.";
    if (normalized.includes('DEAL')) return "None deal pressure is still circulating.";
    return "None social pressure remains active.";
  }

  private severityPhraseElevated(eventType: string): string {
    const normalized = eventType.toUpperCase();
    if (normalized.includes('COLLAPSE')) return "Elevated collapse pressure remains in the room.";
    if (normalized.includes('COMEBACK')) return "Elevated comeback witness pressure remains active.";
    if (normalized.includes('DEAL')) return "Elevated deal pressure is still circulating.";
    return "Elevated social pressure remains active.";
  }

  private severityPhraseHigh(eventType: string): string {
    const normalized = eventType.toUpperCase();
    if (normalized.includes('COLLAPSE')) return "High collapse pressure remains in the room.";
    if (normalized.includes('COMEBACK')) return "High comeback witness pressure remains active.";
    if (normalized.includes('DEAL')) return "High deal pressure is still circulating.";
    return "High social pressure remains active.";
  }

  private severityPhraseCritical(eventType: string): string {
    const normalized = eventType.toUpperCase();
    if (normalized.includes('COLLAPSE')) return "Critical collapse pressure remains in the room.";
    if (normalized.includes('COMEBACK')) return "Critical comeback witness pressure remains active.";
    if (normalized.includes('DEAL')) return "Critical deal pressure is still circulating.";
    return "Critical social pressure remains active.";
  }

  public previewBurstWeights(input: SwarmPlannerInput): Readonly<Record<string, number>> {
    const vector = this.pressureVector(input);
    const moodBias = this.moodEscalationBias(input.channelProfile.mood);
    const eventBias = this.eventEscalationBias(input.eventType);
    const channelBias = this.channelEscalationBias(input.channelId);

    return {
      embarrassment: round2(vector.embarrassment * moodBias * eventBias),
      legend: round2(vector.legend * channelBias),
      predation: round2(vector.predation * channelBias * eventBias),
      fear: round2(vector.fear * moodBias),
      volatility: round2(vector.volatility * channelBias),
    };
  }

  public explainPlan(input: SwarmPlannerInput): readonly string[] {
    const severity = this.resolveSeverity(input);
    const vector = this.pressureVector(input);
    return [
      `severity=${severity}`,
      `channelBias=${round2(this.channelEscalationBias(input.channelId))}`,
      `moodBias=${round2(this.moodEscalationBias(input.channelProfile.mood))}`,
      `eventBias=${round2(this.eventEscalationBias(input.eventType))}`,
      `embarrassment=${vector.embarrassment}`,
      `legend=${vector.legend}`,
      `predation=${vector.predation}`,
      `fear=${vector.fear}`,
      `volatility=${vector.volatility}`,
    ];
  }
}
