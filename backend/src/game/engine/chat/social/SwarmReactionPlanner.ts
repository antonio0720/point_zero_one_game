/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT SOCIAL AUTHORITY
 * ============================================================================
 * backend/src/game/engine/chat/social/SwarmReactionPlanner.ts
 *
 * This file is backend-owned runtime logic for the social pressure layer.
 * It consumes social state, reputation state, channel mood, and event metadata
 * to synthesize authored swarm behavior for the run.
 *
 * Authority: BACKEND only. No UI ownership. No socket ownership.
 * ============================================================================
 */

import type { ChatChannelId, ChatChannelMood } from '../types';
import type {
  ChatAudienceBand,
  ChatAudienceHeatSummary,
  ChatAudienceMood,
  ChatChannelHeatProfile,
  ChatSwarmRiskBand,
} from '../../../../../../shared/contracts/chat/ChatAudienceHeat';
import type {
  ChatReputationSummary,
  ChatReputationTier,
} from '../../../../../../shared/contracts/chat/ChatReputation';

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

// ============================================================================
// SWARM-LOCAL REPUTATION SHAPE
// Backend planner uses a richer reputation model than the shared contract.
// ChatReputationSummary drives the authoritative scores; this shape maps them
// into planner-specific pressure axes.
// ============================================================================

export interface SwarmActorReputation {
  readonly subjectId: string;
  /** Accumulated public exposure that can be weaponised as ridicule pressure. */
  readonly shame: number;
  /** Accumulated legend-class witness charge available as social authority. */
  readonly legendPressure: number;
  /** Fear axis: how much threat the subject radiates passively. */
  readonly fear: number;
  /** Explicit threat output from counterpart for cross-pressure calculation. */
  readonly threat: number;
  /** Volatility: how unpredictably the subject behaves under crowd pressure. */
  readonly volatility: number;
  /** Raw reputation score from the shared contract (0–100). */
  readonly rawScore: number;
  /** Reputation band from the shared contract. */
  readonly tier: string;
}

export function buildSwarmActorReputation(summary: ChatReputationSummary): SwarmActorReputation {
  const score = summary.score;
  const isLegend = summary.band === 'LEGENDARY' || summary.band === 'REVERED';
  const isAntagonist = summary.band === 'FEARED';
  const isShamed = summary.band === 'RUINED' || summary.band === 'DAMAGED';
  const isVolatile = summary.integrity === 'SHATTERED' || summary.integrity === 'FRAGILE';
  return {
    subjectId: summary.subjectId,
    shame: isShamed ? Math.min(100, score * 1.3) : isAntagonist ? score * 0.4 : score * 0.1,
    legendPressure: isLegend ? Math.min(100, score * 1.2) : score * 0.05,
    fear: isAntagonist ? Math.min(100, score * 1.1) : score * 0.08,
    threat: isAntagonist ? Math.min(100, score * 0.9) : 0,
    volatility: isVolatile ? Math.min(100, score * 0.6) : score * 0.15,
    rawScore: score,
    tier: summary.band,
  };
}

export function buildSwarmChannelProfile(summary: ChatAudienceHeatSummary): ChatChannelHeatProfile {
  const totalHeat = summary.netHeat;
  const intensityBand: ChatChannelHeatProfile['intensityBand'] =
    totalHeat >= 90 ? 'MYTHIC'
    : totalHeat >= 70 ? 'INTENSE'
    : totalHeat >= 50 ? 'ELEVATED'
    : totalHeat >= 25 ? 'BUILDING'
    : 'QUIET';
  return {
    totalHeat,
    witnessDensity: summary.visibleHeat * 0.01,
    predationShare: summary.latentHeat * 0.01,
    volatilityScore: totalHeat * 0.4,
    intensityBand,
    audienceBand: summary.witnessBand,
    swarmRiskBand: summary.swarmRisk,
    mood: summary.mood,
  };
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
  readonly actorReputation?: SwarmActorReputation | null;
  readonly subjectReputation?: SwarmActorReputation | null;
  readonly counterpartReputation?: SwarmActorReputation | null;
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
    this.pushMercyBreak(steps, input, severity, generatedAtMs);
    this.pushCeremonialCrown(steps, input, severity, generatedAtMs);
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
    if (score < 64) return 'ELEVATED';
    if (score < this.config.criticalThreshold) return 'HIGH';
    return 'CRITICAL';
  }

  private triggerReason(input: SwarmPlannerInput, severity: SwarmReactionPlan['severity']): string {
    const eventType = input.eventType.toUpperCase();
    if (eventType.includes('COLLAPSE') || eventType.includes('BANKRUPT')) return 'Collapse witness convergence';
    if (eventType.includes('COMEBACK') || eventType.includes('SOVEREIGN')) return 'Legend witness convergence';
    if (input.channelId === 'DEAL_ROOM') return 'Predatory deal convergence';
    if (severity === 'CRITICAL') return 'Critical heat threshold crossed';
    if (severity === 'HIGH') return 'High swarm threshold crossed';
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
        metadata: { severity, ordinal: i, audienceBand: input.channelProfile.audienceBand },
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
        metadata: { severity, swarmRiskBand: input.channelProfile.swarmRiskBand },
      });
    }
    if (input.channelId === 'SYNDICATE') {
      out.push({
        id: `${input.channelId}:SYNDICATE_WHISPER:${generatedAtMs}`,
        channelId: input.channelId,
        function: 'SYNDICATE_WHISPER',
        line: 'The private channel is already aware.',
        delayMs: this.config.baseDelayMs + 60,
        weight: this.baseWeight(input, severity) + 5,
        visibility: 'VISIBLE',
        metadata: { severity },
      });
    }
    if (input.channelId.endsWith('SHADOW')) {
      out.push({
        id: `${input.channelId}:SHADOW_MARK:${generatedAtMs}`,
        channelId: input.channelId,
        function: 'SHADOW_MARK',
        line: 'The shadow channel marks the moment.',
        delayMs: this.config.baseDelayMs + 40,
        weight: this.baseWeight(input, severity) * this.config.shadowSwarmLeakWeight,
        visibility: 'SHADOW',
        metadata: { severity, shadow: true },
      });
    }
  }

  private pushMercyBreak(
    out: SwarmReactionStep[],
    input: SwarmPlannerInput,
    severity: SwarmReactionPlan['severity'],
    generatedAtMs: number,
  ): void {
    const isMercyContext = input.source === 'RESCUE_EVENT' || input.eventType.toUpperCase().includes('RESCUE');
    if (!isMercyContext) return;
    out.push({
      id: `${input.channelId}:MERCY_BREAK:${generatedAtMs}`,
      channelId: input.channelId,
      function: 'MERCY_BREAK',
      line: 'The room pauses. Not forgiveness. A beat.',
      delayMs: this.config.baseDelayMs + 300,
      weight: this.baseWeight(input, severity) * 0.7,
      visibility: input.channelId.endsWith('SHADOW') ? 'SHADOW' : 'VISIBLE',
      metadata: { severity, mercyContext: true },
    });
  }

  private pushCeremonialCrown(
    out: SwarmReactionStep[],
    input: SwarmPlannerInput,
    severity: SwarmReactionPlan['severity'],
    generatedAtMs: number,
  ): void {
    const isCeremonial = input.eventType.toUpperCase().includes('SOVEREIGN') || input.eventType.toUpperCase().includes('LEGEND');
    if (!isCeremonial || severity !== 'CRITICAL') return;
    out.push({
      id: `${input.channelId}:CEREMONIAL_CROWN:${generatedAtMs}`,
      channelId: input.channelId,
      function: 'CEREMONIAL_CROWN',
      line: 'The room elevates. This is the moment it was watching for.',
      delayMs: this.config.baseDelayMs + 380,
      weight: this.baseWeight(input, severity) + 8,
      visibility: 'VISIBLE',
      metadata: { severity, ceremonial: true },
    });
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
      delayMs: this.config.baseDelayMs + this.config.burstDelayMs * this.config.maxBurstSteps,
      weight: this.baseWeight(input, severity) - 1,
      visibility: input.channelId.endsWith('SHADOW') ? 'SHADOW' : 'VISIBLE',
      metadata: { severity, aftershock: true },
    });
  }

  private baseWeight(input: SwarmPlannerInput, severity: SwarmReactionPlan['severity']): number {
    const severityBoost = severity === 'CRITICAL' ? 16 : severity === 'HIGH' ? 10 : 6;
    const heatBoost = input.channelProfile.totalHeat * 0.18;
    const shameBoost = (input.subjectReputation?.shame ?? 0) * 0.12 * this.config.embarrassmentBurstWeight;
    const legendBoost = (input.actorReputation?.legendPressure ?? 0) * 0.1 * this.config.legendBurstWeight;
    const predationBoost = input.channelProfile.predationShare * 0.1 * this.config.predationBurstWeight;
    const moodBoost = this.moodEscalationBias(this.mapAudienceMoodToChannelMood(input.channelProfile.mood));
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
    const channelOverrides: Partial<Record<ChatChannelId, readonly string[]>> = {
      DEAL_ROOM: [
        'The market tightens around the moment.',
        'Deal pressure is compounding.',
        'The room has already priced this in.',
        'Predatory eyes on every side of the table.',
        'Nobody in DEAL_ROOM is pretending now.',
      ],
      GLOBAL: [
        'The signal reached everyone at once.',
        'The global room locks in.',
        'The pressure is visible at scale now.',
        'Every channel felt the shift.',
        'The crowd is no longer passive.',
      ],
      SYNDICATE: [
        'The private room convenes without announcement.',
        'Syndicate consensus is forming fast.',
        'The inner circle saw it before anyone else.',
        'No broadcast. Just weight.',
        'Trust shifts in silence.',
      ],
    };
    const defaultLines: readonly string[] = [
      'The pressure is visible now.',
      'The room starts leaning the same direction.',
      'Nobody in here is pretending not to see it.',
      'The pace changes when the crowd agrees.',
      'This is where the room stops being neutral.',
    ];
    const lines = channelOverrides[input.channelId] ?? defaultLines;
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
      case 'GLOBAL': return this.config.globalSwarmAmplifier;
      case 'DEAL_ROOM': return this.config.dealRoomSwarmAmplifier;
      case 'RIVALRY_SHADOW':
      case 'LIVEOPS_SHADOW': return this.config.shadowSwarmLeakWeight + 0.18;
      case 'SYNDICATE': return 0.94;
      case 'LOBBY': return 0.82;
      default: return 1;
    }
  }

  private mapAudienceMoodToChannelMood(mood: ChatAudienceMood): ChatChannelMood {
    switch (mood) {
      case 'PREDATORY': return 'PREDATORY';
      case 'HOSTILE': return 'HOSTILE';
      case 'MERCILESS': return 'HOSTILE';
      case 'PANICKED': return 'PANIC';
      case 'TENSE': return 'HEATED';
      case 'MOCKING': return 'HEATED';
      case 'EXCITED': return 'HEATED';
      case 'CELEBRATORY': return 'HEATED';
      case 'HYPED': return 'HEATED';
      case 'WATCHFUL': return 'WATCHFUL';
      case 'CURIOUS': return 'WATCHFUL';
      case 'CONSPIRATORIAL': return 'WATCHFUL';
      case 'JUDGMENTAL': return 'WATCHFUL';
      case 'REVERENT': return 'CEREMONIAL';
      case 'VACUUM': return 'CALM';
      case 'QUIET':
      default: return 'CALM';
    }
  }

  private moodEscalationBias(mood: ChatChannelMood): number {
    switch (mood) {
      case 'PREDATORY': return 1.24;
      case 'HOSTILE': return 1.18;
      case 'PANIC': return 1.16;
      case 'HEATED': return 1.08;
      case 'WATCHFUL': return 1.02;
      case 'CEREMONIAL': return 0.96;
      case 'CALM':
      default: return 0.9;
    }
  }

  private eventEscalationBias(eventType: string): number {
    const n = eventType.toUpperCase();
    if (n.includes('COLLAPSE') || n.includes('BANKRUPT')) return 1.28;
    if (n.includes('SOVEREIGN') || n.includes('LEGEND') || n.includes('COMEBACK')) return 1.22;
    if (n.includes('DEAL') || n.includes('BLUFF')) return 1.18;
    if (n.includes('RESCUE')) return 0.84;
    if (n.includes('LIVEOPS')) return 1.14;
    return 1;
  }

  private pressureVector(input: SwarmPlannerInput): {
    embarrassment: number; legend: number; predation: number; fear: number; volatility: number;
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
    let count = severity === 'CRITICAL' ? 5 : severity === 'HIGH' ? 3 : 2;
    if (input.channelId === 'GLOBAL') count += 1;
    if (input.channelId === 'DEAL_ROOM') count += 1;
    if (input.channelProfile.audienceBand === 'HEAVY' || input.channelProfile.audienceBand === 'SATURATED') count += 1;
    if (input.channelId.endsWith('SHADOW')) count = Math.max(2, count - 1);
    return clamp(count, 2, this.config.maxBurstSteps);
  }

  private buildGlobalSpecificSteps(
    input: SwarmPlannerInput, severity: SwarmReactionPlan['severity'], generatedAtMs: number,
  ): SwarmReactionStep[] {
    if (input.channelId !== 'GLOBAL') return [];
    const weight = this.baseWeight(input, severity) + 1;
    return [
      {
        id: `GLOBAL:ANCHOR:${generatedAtMs}`, channelId: input.channelId,
        function: 'PRESSURE_SPIKE', line: 'GLOBAL channel locks onto the moment.',
        delayMs: this.config.baseDelayMs, weight, visibility: 'VISIBLE',
        metadata: { severity, channelTag: 'GLOBAL' },
      },
      {
        id: `GLOBAL:FOLLOW:${generatedAtMs}`, channelId: input.channelId,
        function: 'OPEN_WITNESS', line: 'GLOBAL carries the pressure forward.',
        delayMs: this.config.baseDelayMs + 140, weight: weight - 1, visibility: 'VISIBLE',
        metadata: { severity, channelTag: 'GLOBAL', phase: 'follow' },
      },
    ];
  }

  private buildSyndicateSpecificSteps(
    input: SwarmPlannerInput, severity: SwarmReactionPlan['severity'], generatedAtMs: number,
  ): SwarmReactionStep[] {
    if (input.channelId !== 'SYNDICATE') return [];
    const weight = this.baseWeight(input, severity) + 2;
    return [
      {
        id: `SYNDICATE:ANCHOR:${generatedAtMs}`, channelId: input.channelId,
        function: 'PRESSURE_SPIKE', line: 'SYNDICATE locks onto the moment.',
        delayMs: this.config.baseDelayMs + 15, weight, visibility: 'VISIBLE',
        metadata: { severity, channelTag: 'SYNDICATE' },
      },
    ];
  }

  private buildDealRoomSpecificSteps(
    input: SwarmPlannerInput, severity: SwarmReactionPlan['severity'], generatedAtMs: number,
  ): SwarmReactionStep[] {
    if (input.channelId !== 'DEAL_ROOM') return [];
    const weight = this.baseWeight(input, severity) + 3;
    return [
      {
        id: `DEAL_ROOM:ANCHOR:${generatedAtMs}`, channelId: input.channelId,
        function: 'PRESSURE_SPIKE', line: 'DEAL_ROOM locks onto the moment.',
        delayMs: this.config.baseDelayMs + 30, weight, visibility: 'VISIBLE',
        metadata: { severity, channelTag: 'DEAL_ROOM' },
      },
    ];
  }

  private buildLobbySpecificSteps(
    input: SwarmPlannerInput, severity: SwarmReactionPlan['severity'], generatedAtMs: number,
  ): SwarmReactionStep[] {
    if (input.channelId !== 'LOBBY') return [];
    const weight = this.baseWeight(input, severity);
    return [
      {
        id: `LOBBY:ANCHOR:${generatedAtMs}`, channelId: input.channelId,
        function: 'PRESSURE_SPIKE', line: 'LOBBY registers the shift.',
        delayMs: this.config.baseDelayMs + 50, weight, visibility: 'VISIBLE',
        metadata: { severity, channelTag: 'LOBBY' },
      },
    ];
  }

  private buildSystemShadowSpecificSteps(
    input: SwarmPlannerInput, severity: SwarmReactionPlan['severity'], generatedAtMs: number,
  ): SwarmReactionStep[] {
    if (input.source !== 'SYSTEM_MESSAGE' && input.source !== 'ENGINE_EVENT') return [];
    const w = this.baseWeight(input, severity) * this.config.shadowSwarmLeakWeight;
    return [{
      id: `${input.channelId}:SYSTEM_SHADOW:${generatedAtMs}`, channelId: input.channelId,
      function: 'SHADOW_MARK', line: 'The system records it before the crowd does.',
      delayMs: this.config.minDelayMs + 30, weight: w, visibility: 'SHADOW',
      metadata: { severity, systemShadow: true },
    }];
  }

  private buildNpcShadowSpecificSteps(
    input: SwarmPlannerInput, severity: SwarmReactionPlan['severity'], generatedAtMs: number,
  ): SwarmReactionStep[] {
    if (input.source !== 'NPC_MESSAGE') return [];
    const w = this.baseWeight(input, severity) * this.config.shadowSwarmLeakWeight;
    return [{
      id: `${input.channelId}:NPC_SHADOW:${generatedAtMs}`, channelId: input.channelId,
      function: 'SHADOW_MARK', line: 'NPC pressure enters the shadow layer.',
      delayMs: this.config.minDelayMs + 20, weight: w, visibility: 'SHADOW',
      metadata: { severity, npcShadow: true },
    }];
  }

  private buildRivalryShadowSpecificSteps(
    input: SwarmPlannerInput, severity: SwarmReactionPlan['severity'], generatedAtMs: number,
  ): SwarmReactionStep[] {
    if (input.channelId !== 'RIVALRY_SHADOW') return [];
    const w = this.baseWeight(input, severity) * (this.config.shadowSwarmLeakWeight + 0.1);
    return [{
      id: `RIVALRY_SHADOW:ANCHOR:${generatedAtMs}`, channelId: input.channelId,
      function: 'SHADOW_MARK', line: 'Rivalry shadow tightens.',
      delayMs: this.config.baseDelayMs + 20, weight: w, visibility: 'SHADOW',
      metadata: { severity, channelTag: 'RIVALRY_SHADOW' },
    }];
  }

  private buildRescueShadowSpecificSteps(
    input: SwarmPlannerInput, severity: SwarmReactionPlan['severity'], generatedAtMs: number,
  ): SwarmReactionStep[] {
    if (input.source !== 'RESCUE_EVENT') return [];
    const w = this.baseWeight(input, severity) * 0.6;
    return [{
      id: `${input.channelId}:RESCUE_SHADOW:${generatedAtMs}`, channelId: input.channelId,
      function: 'MERCY_BREAK', line: 'Rescue context dampens the swarm signal.',
      delayMs: this.config.baseDelayMs + 100, weight: w, visibility: 'SHADOW',
      metadata: { severity, rescueShadow: true },
    }];
  }

  private buildLiveopsShadowSpecificSteps(
    input: SwarmPlannerInput, severity: SwarmReactionPlan['severity'], generatedAtMs: number,
  ): SwarmReactionStep[] {
    if (input.channelId !== 'LIVEOPS_SHADOW') return [];
    const w = this.baseWeight(input, severity) * (this.config.shadowSwarmLeakWeight + 0.08);
    return [{
      id: `LIVEOPS_SHADOW:ANCHOR:${generatedAtMs}`, channelId: input.channelId,
      function: 'SHADOW_MARK', line: 'Liveops shadow registers the event.',
      delayMs: this.config.baseDelayMs + 25, weight: w, visibility: 'SHADOW',
      metadata: { severity, channelTag: 'LIVEOPS_SHADOW' },
    }];
  }

  private severityPhraseNone(_eventType: string): string {
    return 'The room acknowledged it. Nothing more.';
  }

  private severityPhraseElevated(eventType: string): string {
    const n = eventType.toUpperCase();
    if (n.includes('DEAL')) return 'Elevated deal pressure is still in the air.';
    return 'Elevated social pressure is still present.';
  }

  private severityPhraseHigh(eventType: string): string {
    const n = eventType.toUpperCase();
    if (n.includes('COLLAPSE')) return 'High collapse pressure is still reverberating.';
    if (n.includes('COMEBACK')) return 'High comeback witness pressure remains active.';
    if (n.includes('DEAL')) return 'High deal pressure is still circulating.';
    return 'High social pressure remains active.';
  }

  private severityPhraseCritical(eventType: string): string {
    const n = eventType.toUpperCase();
    if (n.includes('COLLAPSE')) return 'Critical collapse pressure remains in the room.';
    if (n.includes('COMEBACK')) return 'Critical comeback witness pressure remains active.';
    if (n.includes('DEAL')) return 'Critical deal pressure is still circulating.';
    return 'Critical social pressure remains active.';
  }

  public previewBurstWeights(input: SwarmPlannerInput): Readonly<Record<string, number>> {
    const vector = this.pressureVector(input);
    const moodBias = this.moodEscalationBias(this.mapAudienceMoodToChannelMood(input.channelProfile.mood));
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
      `moodBias=${round2(this.moodEscalationBias(this.mapAudienceMoodToChannelMood(input.channelProfile.mood)))}`,
      `eventBias=${round2(this.eventEscalationBias(input.eventType))}`,
      `embarrassment=${vector.embarrassment}`,
      `legend=${vector.legend}`,
      `predation=${vector.predation}`,
      `fear=${vector.fear}`,
      `volatility=${vector.volatility}`,
      `audienceBand=${input.channelProfile.audienceBand}`,
      `swarmRiskBand=${input.channelProfile.swarmRiskBand}`,
    ];
  }
}

// ============================================================================
// MARK: Factory
// ============================================================================

export function createSwarmReactionPlanner(
  config: Partial<SwarmPlannerConfig> = {},
  clock?: SwarmPlannerClock,
): SwarmReactionPlanner {
  return new SwarmReactionPlanner(config, clock);
}

// ============================================================================
// MARK: Reputation gate — uses ChatReputationTier, Nullable, Optional
// ============================================================================

export interface SwarmPlannerReputationGate {
  readonly tier: ChatReputationTier;
  readonly participantId: Nullable<string>;
  readonly suppressedFunctions: readonly SwarmReactionStep['function'][];
  readonly amplifiedFunctions: readonly SwarmReactionStep['function'][];
  readonly amplifier: Optional<number>;
  readonly suppressThreshold: Optional<number>;
  readonly audienceBandFilter: Optional<ChatAudienceBand>;
  readonly swarmRiskFilter: Optional<ChatSwarmRiskBand>;
}

export function buildSwarmReputationGate(
  tier: ChatReputationTier,
  participantId: Nullable<string>,
  suppressedFunctions: readonly SwarmReactionStep['function'][],
  amplifiedFunctions: readonly SwarmReactionStep['function'][],
  options?: {
    amplifier?: number;
    suppressThreshold?: number;
    audienceBandFilter?: ChatAudienceBand;
    swarmRiskFilter?: ChatSwarmRiskBand;
  },
): SwarmPlannerReputationGate {
  return Object.freeze({
    tier,
    participantId,
    suppressedFunctions,
    amplifiedFunctions,
    amplifier: options?.amplifier,
    suppressThreshold: options?.suppressThreshold,
    audienceBandFilter: options?.audienceBandFilter,
    swarmRiskFilter: options?.swarmRiskFilter,
  });
}

export function applySwarmReputationGate(
  steps: readonly SwarmReactionStep[],
  gate: SwarmPlannerReputationGate,
): readonly SwarmReactionStep[] {
  const threshold = gate.suppressThreshold;
  const amplifier = gate.amplifier ?? 1;

  return steps
    .filter((s) => threshold === undefined || !gate.suppressedFunctions.includes(s.function) || s.weight >= threshold)
    .map((s) => {
      if (!gate.amplifiedFunctions.includes(s.function) || amplifier === 1) return s;
      return Object.freeze({ ...s, weight: round2(clamp(s.weight * amplifier, 0, 100)) });
    });
}

// ============================================================================
// MARK: Pressure snapshot — uses avg()
// ============================================================================

export interface SwarmPressureSnapshot {
  readonly generatedAtMs: number;
  readonly channelId: string;
  readonly audienceBand: ChatAudienceBand;
  readonly swarmRiskBand: ChatSwarmRiskBand;
  readonly averageEmbarrassment: number;
  readonly averageLegend: number;
  readonly averagePredation: number;
  readonly averageFear: number;
  readonly averageVolatility: number;
  readonly averageBaseWeight: number;
  readonly peakFunction: SwarmReactionStep['function'];
  readonly totalSteps: number;
  readonly shadowStepCount: number;
  readonly shadowRatio: number;
}

export function buildSwarmPressureSnapshot(
  plan: SwarmReactionPlan,
  priorPlans: readonly SwarmReactionPlan[] = [],
  channelProfile?: ChatChannelHeatProfile,
): SwarmPressureSnapshot {
  const allPlans = [...priorPlans, plan];
  const triggered = allPlans.filter((p) => p.triggered);
  const allSteps = triggered.flatMap((p) => [...p.steps]);
  const weights = allSteps.map((s) => s.weight);
  const averageBaseWeight = avg(weights);

  const fnCounts = new Map<SwarmReactionStep['function'], number>();
  for (const s of allSteps) { fnCounts.set(s.function, (fnCounts.get(s.function) ?? 0) + 1); }
  let peakFunction: SwarmReactionStep['function'] = 'OPEN_WITNESS';
  let peakCount = 0;
  for (const [fn, count] of fnCounts.entries()) {
    if (count > peakCount) { peakCount = count; peakFunction = fn; }
  }

  const shadowSteps = plan.steps.filter((s) => s.visibility === 'SHADOW');
  const shadowRatio = plan.steps.length > 0 ? round2(shadowSteps.length / plan.steps.length) : 0;
  const severityScore = plan.severity === 'CRITICAL' ? 90 : plan.severity === 'HIGH' ? 65 : plan.severity === 'ELEVATED' ? 40 : 0;

  return Object.freeze({
    generatedAtMs: plan.generatedAtMs,
    channelId: plan.channelId,
    audienceBand: (channelProfile?.audienceBand ?? 'NONE') as ChatAudienceBand,
    swarmRiskBand: (channelProfile?.swarmRiskBand ?? 'NONE') as ChatSwarmRiskBand,
    averageEmbarrassment: round2(severityScore * 0.35),
    averageLegend: round2(severityScore * 0.2),
    averagePredation: round2(severityScore * 0.25),
    averageFear: round2(severityScore * 0.12),
    averageVolatility: round2(severityScore * 0.08),
    averageBaseWeight: round2(averageBaseWeight),
    peakFunction,
    totalSteps: plan.steps.length,
    shadowStepCount: shadowSteps.length,
    shadowRatio,
  });
}

// ============================================================================
// MARK: Plan audit
// ============================================================================

export interface SwarmPlanAudit {
  readonly channelId: string;
  readonly generatedAtMs: number;
  readonly triggered: boolean;
  readonly severity: SwarmReactionPlan['severity'];
  readonly stepCount: number;
  readonly coveredFunctions: readonly SwarmReactionStep['function'][];
  readonly uncoveredFunctions: readonly SwarmReactionStep['function'][];
  readonly hasMercyBreak: boolean;
  readonly hasCeremonialCrown: boolean;
  readonly hasAfterShock: boolean;
  readonly duplicateLines: readonly string[];
  readonly weightUnderflow: boolean;
  readonly shadowRatio: number;
  readonly uniqueFunctionCount: number;
}

const ALL_SWARM_FUNCTIONS: readonly SwarmReactionStep['function'][] = [
  'OPEN_WITNESS', 'DOGPILE', 'PRESSURE_SPIKE', 'DEAL_POUNCE', 'SYNDICATE_WHISPER',
  'SHADOW_MARK', 'MERCY_BREAK', 'CEREMONIAL_CROWN', 'AFTERSHOCK',
] as const;

export function auditSwarmReactionPlan(plan: SwarmReactionPlan): SwarmPlanAudit {
  const coveredFns = new Set(plan.steps.map((s) => s.function));
  const coveredFunctions = ALL_SWARM_FUNCTIONS.filter((fn) => coveredFns.has(fn));
  const uncoveredFunctions = ALL_SWARM_FUNCTIONS.filter((fn) => !coveredFns.has(fn));
  const uniqueFunctions = uniq(plan.steps.map((s) => s.function));

  const seenLines = new Set<string>();
  const duplicateLines: string[] = [];
  for (const s of plan.steps) {
    if (seenLines.has(s.line)) duplicateLines.push(s.line);
    seenLines.add(s.line);
  }

  const shadowSteps = plan.steps.filter((s) => s.visibility === 'SHADOW');

  return Object.freeze({
    channelId: plan.channelId,
    generatedAtMs: plan.generatedAtMs,
    triggered: plan.triggered,
    severity: plan.severity,
    stepCount: plan.steps.length,
    coveredFunctions: Object.freeze(coveredFunctions),
    uncoveredFunctions: Object.freeze(uncoveredFunctions),
    hasMercyBreak: plan.steps.some((s) => s.function === 'MERCY_BREAK'),
    hasCeremonialCrown: plan.steps.some((s) => s.function === 'CEREMONIAL_CROWN'),
    hasAfterShock: plan.steps.some((s) => s.function === 'AFTERSHOCK'),
    duplicateLines: Object.freeze(duplicateLines),
    weightUnderflow: plan.steps.some((s) => s.weight <= 0),
    shadowRatio: plan.steps.length > 0 ? round2(shadowSteps.length / plan.steps.length) : 0,
    uniqueFunctionCount: uniqueFunctions.length,
  });
}

// ============================================================================
// MARK: Timeline
// ============================================================================

export interface SwarmTimelineSlice {
  readonly windowStartMs: number;
  readonly windowEndMs: number;
  readonly planCount: number;
  readonly triggeredCount: number;
  readonly averageStepCount: number;
  readonly peakSeverity: SwarmReactionPlan['severity'];
  readonly shadowStepCount: number;
  readonly dominantFunctions: readonly SwarmReactionStep['function'][];
}

export interface SwarmTimeline {
  readonly channelId: string;
  readonly windowMs: number;
  readonly slices: readonly SwarmTimelineSlice[];
  readonly triggeredCount: number;
  readonly totalStepCount: number;
  readonly averageSeverityScore: number;
  readonly allChannelIds: readonly string[];
}

function severityScore(s: SwarmReactionPlan['severity']): number {
  return s === 'CRITICAL' ? 3 : s === 'HIGH' ? 2 : s === 'ELEVATED' ? 1 : 0;
}

export function buildSwarmTimeline(
  plans: readonly SwarmReactionPlan[],
  windowMs: number = 30_000,
): SwarmTimeline {
  const channelId = plans[0]?.channelId ?? 'UNKNOWN';
  const allChannelIds = uniq(plans.map((p) => p.channelId));
  if (!plans.length) {
    return Object.freeze({ channelId, windowMs, slices: Object.freeze([]), triggeredCount: 0, totalStepCount: 0, averageSeverityScore: 0, allChannelIds: Object.freeze(allChannelIds) });
  }

  const minTs = Math.min(...plans.map((p) => p.generatedAtMs));
  const maxTs = Math.max(...plans.map((p) => p.generatedAtMs));
  const slices: SwarmTimelineSlice[] = [];

  for (let start = minTs; start <= maxTs; start += windowMs) {
    const end = start + windowMs;
    const window = plans.filter((p) => p.generatedAtMs >= start && p.generatedAtMs < end);
    if (!window.length) continue;

    const triggered = window.filter((p) => p.triggered);
    const allSteps = window.flatMap((p) => [...p.steps]);
    const shadowSteps = allSteps.filter((s) => s.visibility === 'SHADOW');
    const peakSeverity: SwarmReactionPlan['severity'] = window.reduce(
      (best, p) => severityScore(p.severity) > severityScore(best) ? p.severity : best,
      'NONE' as SwarmReactionPlan['severity'],
    );

    const fnCounts = new Map<SwarmReactionStep['function'], number>();
    for (const s of allSteps) { fnCounts.set(s.function, (fnCounts.get(s.function) ?? 0) + 1); }
    const dominantFunctions = uniq(
      [...fnCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([fn]) => fn),
    );

    slices.push(Object.freeze({
      windowStartMs: start, windowEndMs: end,
      planCount: window.length, triggeredCount: triggered.length,
      averageStepCount: round2(avg(window.map((p) => p.steps.length))),
      peakSeverity, shadowStepCount: shadowSteps.length,
      dominantFunctions: Object.freeze(dominantFunctions),
    }));
  }

  const avgSeverity = round2(avg(plans.map((p) => severityScore(p.severity))));
  return Object.freeze({
    channelId,
    windowMs,
    slices: Object.freeze(slices),
    triggeredCount: plans.filter((p) => p.triggered).length,
    totalStepCount: plans.reduce((acc, p) => acc + p.steps.length, 0),
    averageSeverityScore: avgSeverity,
    allChannelIds: Object.freeze(allChannelIds),
  });
}

// ============================================================================
// MARK: Batch planning
// ============================================================================

export interface SwarmBatchResult {
  readonly inputs: readonly SwarmPlannerInput[];
  readonly plans: readonly SwarmReactionPlan[];
  readonly pressureSnapshots: readonly SwarmPressureSnapshot[];
  readonly audits: readonly SwarmPlanAudit[];
  readonly timeline: SwarmTimeline;
  readonly triggeredCount: number;
  readonly criticalCount: number;
  readonly highCount: number;
  readonly generatedAt: number;
  readonly channelIds: readonly string[];
}

export function runSwarmBatch(
  planner: SwarmReactionPlanner,
  inputs: readonly SwarmPlannerInput[],
  windowMs: number = 30_000,
): SwarmBatchResult {
  const plans: SwarmReactionPlan[] = inputs.map((input) => planner.plan(input));
  const pressureSnapshots = plans.map((p, i) =>
    buildSwarmPressureSnapshot(p, plans.slice(0, i), inputs[i]?.channelProfile),
  );
  const audits = plans.map((p) => auditSwarmReactionPlan(p));
  const timeline = buildSwarmTimeline(plans, windowMs);
  const channelIds = uniq(plans.map((p) => p.channelId));

  return Object.freeze({
    inputs: Object.freeze([...inputs]),
    plans: Object.freeze(plans),
    pressureSnapshots: Object.freeze(pressureSnapshots),
    audits: Object.freeze(audits),
    timeline,
    triggeredCount: plans.filter((p) => p.triggered).length,
    criticalCount: plans.filter((p) => p.severity === 'CRITICAL').length,
    highCount: plans.filter((p) => p.severity === 'HIGH').length,
    generatedAt: Date.now(),
    channelIds: Object.freeze(channelIds),
  });
}

// ============================================================================
// MARK: Diff
// ============================================================================

export interface SwarmReactionPlanDiff {
  readonly channelId: string;
  readonly severityChanged: boolean;
  readonly beforeSeverity: SwarmReactionPlan['severity'];
  readonly afterSeverity: SwarmReactionPlan['severity'];
  readonly stepCountDelta: number;
  readonly newFunctions: readonly SwarmReactionStep['function'][];
  readonly droppedFunctions: readonly SwarmReactionStep['function'][];
  readonly triggeredChanged: boolean;
  readonly weightDelta: number;
}

export function diffSwarmReactionPlans(
  before: SwarmReactionPlan,
  after: SwarmReactionPlan,
): SwarmReactionPlanDiff {
  const beforeFns = new Set(before.steps.map((s) => s.function));
  const afterFns = new Set(after.steps.map((s) => s.function));
  const newFunctions = [...afterFns].filter((fn) => !beforeFns.has(fn)) as SwarmReactionStep['function'][];
  const droppedFunctions = [...beforeFns].filter((fn) => !afterFns.has(fn)) as SwarmReactionStep['function'][];
  const beforeAvgWeight = avg(before.steps.map((s) => s.weight));
  const afterAvgWeight = avg(after.steps.map((s) => s.weight));

  return Object.freeze({
    channelId: after.channelId,
    severityChanged: after.severity !== before.severity,
    beforeSeverity: before.severity,
    afterSeverity: after.severity,
    stepCountDelta: after.steps.length - before.steps.length,
    newFunctions: Object.freeze(newFunctions),
    droppedFunctions: Object.freeze(droppedFunctions),
    triggeredChanged: after.triggered !== before.triggered,
    weightDelta: round2(afterAvgWeight - beforeAvgWeight),
  });
}

// ============================================================================
// MARK: Policy violation detection
// ============================================================================

export interface SwarmPolicyViolation {
  readonly channelId: string;
  readonly violationType: 'STEP_OVERFLOW' | 'AFTERSHOCK_MISSING' | 'MERCY_UNBALANCED' | 'WEIGHT_UNDERFLOW' | 'DUPLICATE_LINE';
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly description: string;
  readonly stepId?: string;
}

export function detectSwarmPolicyViolations(plan: SwarmReactionPlan): readonly SwarmPolicyViolation[] {
  const violations: SwarmPolicyViolation[] = [];

  if (plan.steps.length > 12) {
    violations.push(Object.freeze({ channelId: plan.channelId, violationType: 'STEP_OVERFLOW', severity: 'LOW', description: `Plan has ${plan.steps.length} steps (max 12)` }));
  }
  if (plan.triggered && !plan.steps.some((s) => s.function === 'AFTERSHOCK')) {
    violations.push(Object.freeze({ channelId: plan.channelId, violationType: 'AFTERSHOCK_MISSING', severity: 'MEDIUM', description: 'Triggered plan has no AFTERSHOCK step' }));
  }
  if (plan.severity === 'CRITICAL' && plan.steps.filter((s) => s.function === 'MERCY_BREAK').length > 2) {
    violations.push(Object.freeze({ channelId: plan.channelId, violationType: 'MERCY_UNBALANCED', severity: 'LOW', description: 'Multiple MERCY_BREAK steps in a CRITICAL plan' }));
  }
  for (const s of plan.steps) {
    if (s.weight <= 0) {
      violations.push(Object.freeze({ channelId: plan.channelId, violationType: 'WEIGHT_UNDERFLOW', severity: 'HIGH', description: `Step ${s.id} has zero or negative weight`, stepId: s.id }));
    }
  }
  const seenLines = new Set<string>();
  for (const s of plan.steps) {
    if (seenLines.has(s.line)) {
      violations.push(Object.freeze({ channelId: plan.channelId, violationType: 'DUPLICATE_LINE', severity: 'HIGH', description: `Duplicate line: "${s.line.slice(0, 40)}"`, stepId: s.id }));
    }
    seenLines.add(s.line);
  }
  return Object.freeze(violations);
}

// ============================================================================
// MARK: Ledger stats
// ============================================================================

export interface SwarmLedgerStats {
  readonly channelId: string;
  readonly totalPlans: number;
  readonly triggeredPlans: number;
  readonly triggerRate: number;
  readonly criticalCount: number;
  readonly highCount: number;
  readonly elevatedCount: number;
  readonly averageStepCount: number;
  readonly functionDistribution: Readonly<Record<string, number>>;
  readonly topFunction: string;
  readonly shadowStepRatio: number;
  readonly generatedAt: number;
}

export function buildSwarmLedgerStats(
  channelId: string,
  plans: readonly SwarmReactionPlan[],
): SwarmLedgerStats {
  const triggered = plans.filter((p) => p.triggered);
  const fnDist: Record<string, number> = {};
  let totalSteps = 0;
  let totalShadow = 0;
  for (const p of plans) {
    for (const s of p.steps) {
      fnDist[s.function] = (fnDist[s.function] ?? 0) + 1;
      totalSteps += 1;
      if (s.visibility === 'SHADOW') totalShadow += 1;
    }
  }
  const topFunction = Object.entries(fnDist).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'NONE';

  return Object.freeze({
    channelId,
    totalPlans: plans.length,
    triggeredPlans: triggered.length,
    triggerRate: round2(plans.length > 0 ? triggered.length / plans.length : 0),
    criticalCount: plans.filter((p) => p.severity === 'CRITICAL').length,
    highCount: plans.filter((p) => p.severity === 'HIGH').length,
    elevatedCount: plans.filter((p) => p.severity === 'ELEVATED').length,
    averageStepCount: round2(avg(plans.map((p) => p.steps.length))),
    functionDistribution: Object.freeze(fnDist),
    topFunction,
    shadowStepRatio: round2(totalSteps > 0 ? totalShadow / totalSteps : 0),
    generatedAt: Date.now(),
  });
}

// ============================================================================
// MARK: Annotation system
// ============================================================================

export interface SwarmAnnotation {
  readonly id: string;
  readonly planId: string;
  readonly channelId: string;
  readonly annotationType: 'ESCALATION_NOTE' | 'MERCY_OVERRIDE' | 'AUDIT_FLAG' | 'MANUAL_REVIEW' | 'SEVERITY_CORRECTION';
  readonly body: string;
  readonly authorId: Nullable<string>;
  readonly createdAtMs: number;
  readonly severity: Optional<SwarmReactionPlan['severity']>;
}

export function createSwarmAnnotation(
  planId: string,
  channelId: string,
  annotationType: SwarmAnnotation['annotationType'],
  body: string,
  options?: { authorId?: string; severity?: SwarmReactionPlan['severity'] },
): SwarmAnnotation {
  return Object.freeze({
    id: `annotation:${channelId}:${Date.now()}`,
    planId,
    channelId,
    annotationType,
    body,
    authorId: options?.authorId ?? null,
    createdAtMs: Date.now(),
    severity: options?.severity,
  });
}

export function filterAnnotationsByType(
  annotations: readonly SwarmAnnotation[],
  annotationType: SwarmAnnotation['annotationType'],
): readonly SwarmAnnotation[] {
  return annotations.filter((a) => a.annotationType === annotationType);
}

export function sortAnnotationsByTime(
  annotations: readonly SwarmAnnotation[],
  direction: 'ASC' | 'DESC' = 'DESC',
): readonly SwarmAnnotation[] {
  return [...annotations].sort((a, b) =>
    direction === 'DESC' ? b.createdAtMs - a.createdAtMs : a.createdAtMs - b.createdAtMs,
  );
}

// ============================================================================
// MARK: Forecast
// ============================================================================

export interface SwarmForecast {
  readonly channelId: string;
  readonly generatedAtMs: number;
  readonly windowMs: number;
  readonly predictedTriggerCount: number;
  readonly predictedPeakSeverity: SwarmReactionPlan['severity'];
  readonly predictedCriticalProbability: number;
  readonly predictedAverageStepCount: number;
  readonly momentum: 'RISING' | 'STABLE' | 'FALLING';
  readonly confidenceScore: number;
}

export function forecastSwarmActivity(
  plans: readonly SwarmReactionPlan[],
  windowMs: number = 30_000,
): SwarmForecast {
  const channelId = plans[0]?.channelId ?? 'UNKNOWN';
  if (!plans.length) {
    return Object.freeze({
      channelId, generatedAtMs: Date.now(), windowMs,
      predictedTriggerCount: 0, predictedPeakSeverity: 'NONE',
      predictedCriticalProbability: 0, predictedAverageStepCount: 0,
      momentum: 'STABLE', confidenceScore: 0,
    });
  }

  const recentMs = Date.now() - windowMs;
  const recent = plans.filter((p) => p.generatedAtMs >= recentMs);
  const older = plans.filter((p) => p.generatedAtMs < recentMs);

  const recentRate = recent.length / Math.max(windowMs / 1000, 1);
  const olderRate = older.length > 0 ? older.filter((p) => p.triggered).length / older.length : 0;
  const recentTriggered = recent.filter((p) => p.triggered);
  const criticalCount = recentTriggered.filter((p) => p.severity === 'CRITICAL').length;
  const criticalProbability = round2(recentTriggered.length > 0 ? criticalCount / recentTriggered.length : 0);

  const currentRate = recentTriggered.length / Math.max(recent.length, 1);
  const momentum: SwarmForecast['momentum'] =
    currentRate > olderRate * 1.1 ? 'RISING'
    : currentRate < olderRate * 0.9 ? 'FALLING'
    : 'STABLE';

  const peakSeverity: SwarmReactionPlan['severity'] = recentTriggered.reduce(
    (best, p) => severityScore(p.severity) > severityScore(best) ? p.severity : best,
    'NONE' as SwarmReactionPlan['severity'],
  );

  return Object.freeze({
    channelId, generatedAtMs: Date.now(), windowMs,
    predictedTriggerCount: Math.round(recentRate * (windowMs / 1000)),
    predictedPeakSeverity: peakSeverity,
    predictedCriticalProbability: criticalProbability,
    predictedAverageStepCount: round2(avg(recentTriggered.map((p) => p.steps.length))),
    momentum,
    confidenceScore: round2(Math.min(1, recent.length / 10)),
  });
}

// ============================================================================
// MARK: Volatility index
// ============================================================================

export interface SwarmVolatilityIndex {
  readonly channelId: string;
  readonly generatedAtMs: number;
  readonly severityVariance: number;
  readonly stepCountVariance: number;
  readonly triggerRateVariance: number;
  readonly compositeVolatility: number;
  readonly classification: 'STABLE' | 'MODERATE' | 'VOLATILE' | 'EXTREME';
}

function computeVariance(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = avg(values);
  return avg(values.map((v) => (v - mean) ** 2));
}

export function computeSwarmVolatility(
  channelId: string,
  plans: readonly SwarmReactionPlan[],
): SwarmVolatilityIndex {
  if (plans.length < 2) {
    return Object.freeze({ channelId, generatedAtMs: Date.now(), severityVariance: 0, stepCountVariance: 0, triggerRateVariance: 0, compositeVolatility: 0, classification: 'STABLE' });
  }

  const scores = plans.map((p) => severityScore(p.severity));
  const stepCounts = plans.map((p) => p.steps.length);
  const severityVariance = round2(computeVariance(scores));
  const stepCountVariance = round2(computeVariance(stepCounts));
  const triggerRateVariance = round2(computeVariance(plans.map((p) => p.triggered ? 1 : 0)));
  const compositeVolatility = round2((severityVariance + stepCountVariance * 0.3 + triggerRateVariance * 0.5) / 1.8);
  const classification: SwarmVolatilityIndex['classification'] =
    compositeVolatility >= 4 ? 'EXTREME'
    : compositeVolatility >= 2 ? 'VOLATILE'
    : compositeVolatility >= 0.8 ? 'MODERATE'
    : 'STABLE';

  return Object.freeze({ channelId, generatedAtMs: Date.now(), severityVariance, stepCountVariance, triggerRateVariance, compositeVolatility, classification });
}

// ============================================================================
// MARK: Hotspot detection
// ============================================================================

export interface SwarmHotspot {
  readonly channelId: string;
  readonly windowStartMs: number;
  readonly windowEndMs: number;
  readonly planCount: number;
  readonly triggeredCount: number;
  readonly criticalCount: number;
  readonly hotIntensity: number;
  readonly dominantSeverity: SwarmReactionPlan['severity'];
}

export function detectSwarmHotspots(
  plans: readonly SwarmReactionPlan[],
  windowMs: number = 10_000,
  hotThreshold: number = 0.5,
): readonly SwarmHotspot[] {
  if (!plans.length) return Object.freeze([]);

  const minTs = Math.min(...plans.map((p) => p.generatedAtMs));
  const maxTs = Math.max(...plans.map((p) => p.generatedAtMs));
  const hotspots: SwarmHotspot[] = [];

  for (let start = minTs; start <= maxTs; start += windowMs) {
    const end = start + windowMs;
    const window = plans.filter((p) => p.generatedAtMs >= start && p.generatedAtMs < end);
    if (!window.length) continue;

    const triggered = window.filter((p) => p.triggered);
    const criticals = triggered.filter((p) => p.severity === 'CRITICAL');
    const triggerRate = triggered.length / window.length;
    const hotIntensity = round2(triggerRate * (1 + criticals.length * 0.3));

    if (hotIntensity < hotThreshold) continue;

    const dominantSeverity: SwarmReactionPlan['severity'] = window.reduce(
      (best, p) => severityScore(p.severity) > severityScore(best) ? p.severity : best,
      'NONE' as SwarmReactionPlan['severity'],
    );

    hotspots.push(Object.freeze({
      channelId: window[0].channelId,
      windowStartMs: start, windowEndMs: end,
      planCount: window.length, triggeredCount: triggered.length,
      criticalCount: criticals.length, hotIntensity, dominantSeverity,
    }));
  }

  return Object.freeze(hotspots);
}

// ============================================================================
// MARK: Decay state
// ============================================================================

export interface SwarmDecayState {
  readonly channelId: string;
  readonly lastTriggeredAtMs: Nullable<number>;
  readonly millisSinceLastTrigger: Nullable<number>;
  readonly decayPhase: 'ACTIVE' | 'COOLING' | 'DORMANT' | 'RESET';
  readonly residualPressure: number;
  readonly estimatedCooldownRemainingMs: Nullable<number>;
}

export function computeSwarmDecayState(
  channelId: string,
  plans: readonly SwarmReactionPlan[],
  nowMs: number = Date.now(),
  cooldownWindowMs: number = 60_000,
): SwarmDecayState {
  const triggered = plans.filter((p) => p.triggered).sort((a, b) => b.generatedAtMs - a.generatedAtMs);
  const lastTriggered = triggered[0] ?? null;
  const lastTriggeredAtMs = lastTriggered?.generatedAtMs ?? null;
  const millisSinceLastTrigger = lastTriggeredAtMs !== null ? nowMs - lastTriggeredAtMs : null;

  let decayPhase: SwarmDecayState['decayPhase'] = 'DORMANT';
  let residualPressure = 0;
  let estimatedCooldownRemainingMs: Nullable<number> = null;

  if (millisSinceLastTrigger !== null) {
    const ratio = millisSinceLastTrigger / cooldownWindowMs;
    residualPressure = round2(Math.max(0, 1 - ratio) * 100);
    decayPhase = ratio < 0.15 ? 'ACTIVE' : ratio < 0.5 ? 'COOLING' : ratio < 1 ? 'DORMANT' : 'RESET';
    estimatedCooldownRemainingMs = ratio < 1 ? Math.round((1 - ratio) * cooldownWindowMs) : 0;
  }

  return Object.freeze({ channelId, lastTriggeredAtMs, millisSinceLastTrigger, decayPhase, residualPressure, estimatedCooldownRemainingMs });
}

// ============================================================================
// MARK: Export envelope
// ============================================================================

export interface SwarmExportEnvelope {
  readonly exportedAtMs: number;
  readonly channelId: string;
  readonly plans: readonly SwarmReactionPlan[];
  readonly ledgerStats: SwarmLedgerStats;
  readonly timeline: SwarmTimeline;
  readonly volatilityIndex: SwarmVolatilityIndex;
  readonly forecast: SwarmForecast;
  readonly hotspots: readonly SwarmHotspot[];
  readonly decayState: SwarmDecayState;
  readonly annotations: readonly SwarmAnnotation[];
  readonly planCount: number;
  readonly triggeredCount: number;
}

export function buildSwarmExportEnvelope(
  channelId: string,
  plans: readonly SwarmReactionPlan[],
  annotations: readonly SwarmAnnotation[] = [],
  windowMs: number = 30_000,
): SwarmExportEnvelope {
  return Object.freeze({
    exportedAtMs: Date.now(),
    channelId,
    plans: Object.freeze([...plans]),
    ledgerStats: buildSwarmLedgerStats(channelId, plans),
    timeline: buildSwarmTimeline(plans, windowMs),
    volatilityIndex: computeSwarmVolatility(channelId, plans),
    forecast: forecastSwarmActivity(plans, windowMs),
    hotspots: detectSwarmHotspots(plans, windowMs / 3),
    decayState: computeSwarmDecayState(channelId, plans),
    annotations: Object.freeze([...annotations]),
    planCount: plans.length,
    triggeredCount: plans.filter((p) => p.triggered).length,
  });
}

// ============================================================================
// MARK: Rebuild & audit
// ============================================================================

export interface SwarmRebuildResult {
  readonly channelId: string;
  readonly rebuiltAtMs: number;
  readonly planCount: number;
  readonly triggeredCount: number;
  readonly violationCount: number;
  readonly violations: readonly SwarmPolicyViolation[];
  readonly auditSummaries: readonly SwarmPlanAudit[];
  readonly ledgerStats: SwarmLedgerStats;
}

export function rebuildAndAuditSwarm(
  planner: SwarmReactionPlanner,
  channelId: string,
  inputs: readonly SwarmPlannerInput[],
): SwarmRebuildResult {
  const plans = inputs.map((input) => planner.plan(input));
  const auditSummaries = plans.map((p) => auditSwarmReactionPlan(p));
  const allViolations = plans.flatMap((p) => [...detectSwarmPolicyViolations(p)]);
  const ledgerStats = buildSwarmLedgerStats(channelId, plans);

  return Object.freeze({
    channelId,
    rebuiltAtMs: Date.now(),
    planCount: plans.length,
    triggeredCount: plans.filter((p) => p.triggered).length,
    violationCount: allViolations.length,
    violations: Object.freeze(allViolations),
    auditSummaries: Object.freeze(auditSummaries),
    ledgerStats,
  });
}

// ============================================================================
// MARK: Channel weight matrix
// ============================================================================

export interface SwarmChannelWeightMatrix {
  readonly generatedAtMs: number;
  readonly entries: readonly SwarmChannelWeightEntry[];
  readonly totalWeight: number;
  readonly dominantChannel: ChatChannelId;
}

export interface SwarmChannelWeightEntry {
  readonly channelId: ChatChannelId;
  readonly planCount: number;
  readonly triggeredCount: number;
  readonly totalWeight: number;
  readonly averageWeight: number;
  readonly triggerRate: number;
}

export function buildSwarmChannelWeightMatrix(
  plans: readonly SwarmReactionPlan[],
): SwarmChannelWeightMatrix {
  const byChannel = new Map<ChatChannelId, SwarmReactionPlan[]>();
  for (const p of plans) {
    const list = byChannel.get(p.channelId) ?? [];
    list.push(p);
    byChannel.set(p.channelId, list);
  }

  const entries: SwarmChannelWeightEntry[] = [];
  for (const [channelId, channelPlans] of byChannel.entries()) {
    const triggered = channelPlans.filter((p) => p.triggered);
    const allSteps = channelPlans.flatMap((p) => [...p.steps]);
    const totalWeight = round2(sum(allSteps.map((s) => s.weight)));
    entries.push(Object.freeze({
      channelId,
      planCount: channelPlans.length,
      triggeredCount: triggered.length,
      totalWeight,
      averageWeight: round2(allSteps.length > 0 ? totalWeight / allSteps.length : 0),
      triggerRate: round2(channelPlans.length > 0 ? triggered.length / channelPlans.length : 0),
    }));
  }

  entries.sort((a, b) => b.totalWeight - a.totalWeight);
  const dominantChannel = entries[0]?.channelId ?? 'GLOBAL';
  const totalWeight = round2(sum(entries.map((e) => e.totalWeight)));

  return Object.freeze({
    generatedAtMs: Date.now(),
    entries: Object.freeze(entries),
    totalWeight,
    dominantChannel,
  });
}

// ============================================================================
// MARK: Sorting and filtering helpers
// ============================================================================

export function sortPlansBySeverity(
  plans: readonly SwarmReactionPlan[],
  direction: 'ASC' | 'DESC' = 'DESC',
): readonly SwarmReactionPlan[] {
  return [...plans].sort((a, b) =>
    direction === 'DESC' ? severityScore(b.severity) - severityScore(a.severity) : severityScore(a.severity) - severityScore(b.severity),
  );
}

export function filterPlansByChannel(
  plans: readonly SwarmReactionPlan[],
  channelId: ChatChannelId,
): readonly SwarmReactionPlan[] {
  return plans.filter((p) => p.channelId === channelId);
}

export function filterPlansBySeverity(
  plans: readonly SwarmReactionPlan[],
  severity: SwarmReactionPlan['severity'],
): readonly SwarmReactionPlan[] {
  return plans.filter((p) => p.severity === severity);
}

export function filterTriggeredPlans(
  plans: readonly SwarmReactionPlan[],
): readonly SwarmReactionPlan[] {
  return plans.filter((p) => p.triggered);
}

export function topPlansByWeight(
  plans: readonly SwarmReactionPlan[],
  limit: number = 10,
): readonly SwarmReactionPlan[] {
  return [...plans]
    .sort((a, b) => sum(b.steps.map((s) => s.weight)) - sum(a.steps.map((s) => s.weight)))
    .slice(0, limit);
}

export function collectUniqueFunctions(
  plans: readonly SwarmReactionPlan[],
): readonly SwarmReactionStep['function'][] {
  return uniq(plans.flatMap((p) => p.steps.map((s) => s.function)));
}

// ============================================================================
// MARK: Coverage report
// ============================================================================

export interface SwarmCoverageReport {
  readonly channelId: string;
  readonly generatedAtMs: number;
  readonly totalFunctions: number;
  readonly coveredFunctionCount: number;
  readonly coveredFunctions: readonly SwarmReactionStep['function'][];
  readonly uncoveredFunctions: readonly SwarmReactionStep['function'][];
  readonly coverageRatio: number;
  readonly shadowCoverageRatio: number;
}

export function buildSwarmCoverageReport(
  channelId: string,
  plans: readonly SwarmReactionPlan[],
): SwarmCoverageReport {
  const allSteps = plans.flatMap((p) => [...p.steps]);
  const coveredFns = new Set(allSteps.map((s) => s.function));
  const coveredFunctions = ALL_SWARM_FUNCTIONS.filter((fn) => coveredFns.has(fn));
  const uncoveredFunctions = ALL_SWARM_FUNCTIONS.filter((fn) => !coveredFns.has(fn));
  const shadowSteps = allSteps.filter((s) => s.visibility === 'SHADOW');
  const shadowCoverageRatio = round2(allSteps.length > 0 ? shadowSteps.length / allSteps.length : 0);

  return Object.freeze({
    channelId, generatedAtMs: Date.now(),
    totalFunctions: ALL_SWARM_FUNCTIONS.length,
    coveredFunctionCount: coveredFunctions.length,
    coveredFunctions: Object.freeze(coveredFunctions),
    uncoveredFunctions: Object.freeze(uncoveredFunctions),
    coverageRatio: round2(coveredFunctions.length / ALL_SWARM_FUNCTIONS.length),
    shadowCoverageRatio,
  });
}

// ============================================================================
// MARK: Profile system
// ============================================================================

export type SwarmPlannerProfile = 'STANDARD' | 'AGGRESSIVE' | 'CONSERVATIVE' | 'HIGH_VOLUME' | 'CINEMATIC';

export interface SwarmPlannerProfileDescriptor {
  readonly name: SwarmPlannerProfile;
  readonly description: string;
  readonly configOverrides: Partial<SwarmPlannerConfig>;
}

const SWARM_PLANNER_PROFILE_DESCRIPTORS: readonly SwarmPlannerProfileDescriptor[] = [
  { name: 'STANDARD', description: 'Balanced swarm planning for general gameplay.', configOverrides: {} },
  {
    name: 'AGGRESSIVE',
    description: 'Lower thresholds and higher amplifiers for intense experiences.',
    configOverrides: { escalationThreshold: 42, criticalThreshold: 60, embarrassmentBurstWeight: 1.35, predationBurstWeight: 1.32 } as Partial<SwarmPlannerConfig>,
  },
  {
    name: 'CONSERVATIVE',
    description: 'Higher thresholds and lower amplifiers for calmer contexts.',
    configOverrides: { escalationThreshold: 70, criticalThreshold: 88, maxSequenceSteps: 8 } as Partial<SwarmPlannerConfig>,
  },
  {
    name: 'HIGH_VOLUME',
    description: 'Optimized for high-frequency event streams.',
    configOverrides: { maxSequenceSteps: 8, maxBurstSteps: 3, burstDelayMs: 80 } as Partial<SwarmPlannerConfig>,
  },
  {
    name: 'CINEMATIC',
    description: 'Maximum steps with ceremonial emphasis for cinematic moments.',
    configOverrides: { maxSequenceSteps: 12, maxBurstSteps: 6, legendBurstWeight: 1.35 } as Partial<SwarmPlannerConfig>,
  },
] as const;

export const SWARM_PLANNER_DOCTRINE = Object.freeze({
  authority: 'BACKEND' as const,
  version: '2026.03.23-swarm-planner-doctrine.v2',
  maxSequenceSteps: 12,
  maxBurstSteps: 5,
  supportedProfiles: ['STANDARD', 'AGGRESSIVE', 'CONSERVATIVE', 'HIGH_VOLUME', 'CINEMATIC'] as const,
  channelMoods: ['CALM', 'WATCHFUL', 'HEATED', 'HOSTILE', 'PANIC', 'PREDATORY', 'CEREMONIAL'] as const satisfies readonly ChatChannelMood[],
});

// ============================================================================
// MARK: Module objects
// ============================================================================

export const ChatSwarmReactionPlannerModule = Object.freeze({
  create: (config?: Partial<SwarmPlannerConfig>): SwarmReactionPlanner => new SwarmReactionPlanner(config),
  createAggressive: (): SwarmReactionPlanner => new SwarmReactionPlanner(SWARM_PLANNER_PROFILE_DESCRIPTORS[1].configOverrides),
  createConservative: (): SwarmReactionPlanner => new SwarmReactionPlanner(SWARM_PLANNER_PROFILE_DESCRIPTORS[2].configOverrides),
  createHighVolume: (): SwarmReactionPlanner => new SwarmReactionPlanner(SWARM_PLANNER_PROFILE_DESCRIPTORS[3].configOverrides),
  createCinematic: (): SwarmReactionPlanner => new SwarmReactionPlanner(SWARM_PLANNER_PROFILE_DESCRIPTORS[4].configOverrides),
  runBatch: runSwarmBatch,
  buildPressureSnapshot: buildSwarmPressureSnapshot,
  auditPlan: auditSwarmReactionPlan,
  buildTimeline: buildSwarmTimeline,
  diff: diffSwarmReactionPlans,
  detectViolations: detectSwarmPolicyViolations,
  buildLedgerStats: buildSwarmLedgerStats,
  buildReputationGate: buildSwarmReputationGate,
  applyReputationGate: applySwarmReputationGate,
  buildExportEnvelope: buildSwarmExportEnvelope,
  rebuildAndAudit: rebuildAndAuditSwarm,
  buildChannelWeightMatrix: buildSwarmChannelWeightMatrix,
  buildCoverageReport: buildSwarmCoverageReport,
  forecast: forecastSwarmActivity,
  computeVolatility: computeSwarmVolatility,
  detectHotspots: detectSwarmHotspots,
  computeDecayState: computeSwarmDecayState,
  buildActorReputation: buildSwarmActorReputation,
  buildChannelProfile: buildSwarmChannelProfile,
  doctrine: SWARM_PLANNER_DOCTRINE,
} as const);

export const ChatSwarmReactionPlannerProfileModule = Object.freeze({
  all: (): readonly SwarmPlannerProfileDescriptor[] => SWARM_PLANNER_PROFILE_DESCRIPTORS,
  byName: (name: SwarmPlannerProfile): SwarmPlannerProfileDescriptor | undefined =>
    SWARM_PLANNER_PROFILE_DESCRIPTORS.find((p) => p.name === name),
  STANDARD: SWARM_PLANNER_PROFILE_DESCRIPTORS[0],
  AGGRESSIVE: SWARM_PLANNER_PROFILE_DESCRIPTORS[1],
  CONSERVATIVE: SWARM_PLANNER_PROFILE_DESCRIPTORS[2],
  HIGH_VOLUME: SWARM_PLANNER_PROFILE_DESCRIPTORS[3],
  CINEMATIC: SWARM_PLANNER_PROFILE_DESCRIPTORS[4],
} as const);
