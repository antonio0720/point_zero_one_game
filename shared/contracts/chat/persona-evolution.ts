/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT PERSONA EVOLUTION CONTRACTS
 * FILE: shared/contracts/chat/persona-evolution.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Shared persona-evolution contracts for frontend runtime, backend authority,
 * and transport-facing chat liveops lanes.
 *
 * This module models how a named bot voice matures over long horizons without
 * losing authored identity. It does not author lines. It authorizes posture,
 * transform bias, aggression pacing, callback appetite, and season-aware drift.
 * ============================================================================
 */

export type ChatPersonaStageId =
  | 'INTRODUCTORY'
  | 'ESTABLISHED'
  | 'PERSONAL'
  | 'RIVALRIC'
  | 'MYTHIC';

export type ChatPersonaEvolutionEventType =
  | 'RUN_START'
  | 'RUN_END'
  | 'PLAYER_COLLAPSE'
  | 'PLAYER_COMEBACK'
  | 'PLAYER_BREACH'
  | 'PLAYER_PERFECT_DEFENSE'
  | 'PLAYER_GREED'
  | 'PLAYER_DISCIPLINE'
  | 'PLAYER_BLUFF'
  | 'PLAYER_OVERCONFIDENCE'
  | 'PLAYER_HESITATION'
  | 'PLAYER_ANGER'
  | 'BOT_TAUNT_EMITTED'
  | 'BOT_RETREAT_EMITTED'
  | 'BOT_CALLBACK_USED'
  | 'PUBLIC_WITNESS'
  | 'PRIVATE_WITNESS'
  | 'SEASONAL_WORLD_EVENT'
  | 'LIVEOPS_INTRUSION';

export type ChatPersonaSplitMode = 'PUBLIC' | 'PRIVATE' | 'BALANCED';

export type ChatPersonaTemperament =
  | 'COLD'
  | 'CALCULATED'
  | 'PREDATORY'
  | 'SARDONIC'
  | 'CEREMONIAL'
  | 'HUNTING'
  | 'ADMIRING';

export type ChatPersonaTransformBias =
  | 'SHORTER_COLDER'
  | 'LONGER_CEREMONIAL'
  | 'MORE_DIRECT'
  | 'MORE_MOCKING'
  | 'MORE_INTIMATE'
  | 'MORE_PUBLIC'
  | 'MORE_POST_EVENT'
  | 'MORE_PRE_EVENT'
  | 'PRESSURE_REWRITE'
  | 'CALLBACK_REWRITE'
  | 'PERSONAL_HISTORY_REWRITE';

export interface ChatPersonaEvolutionEvent {
  readonly eventId: string;
  readonly playerId?: string | null;
  readonly botId: string;
  readonly eventType: ChatPersonaEvolutionEventType;
  readonly createdAt: number;
  readonly intensity01?: number;
  readonly publicWitness01?: number;
  readonly pressureBand?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly tags?: readonly string[];
  readonly summary?: string;
}

export interface ChatPersonaStageProfile {
  readonly stageId: ChatPersonaStageId;
  readonly minimumCareerRuns: number;
  readonly minimumMeaningfulEvents: number;
  readonly callbackAggressionFloor01: number;
  readonly vocabularyWidening01: number;
  readonly publicPressureBias01: number;
  readonly privatePressureBias01: number;
  readonly mythicWeight01: number;
}

export interface ChatPersonaEvolutionVector {
  readonly toneHardening01: number;
  readonly vocabularyWidening01: number;
  readonly callbackAggression01: number;
  readonly patienceShift01: number;
  readonly publicPressureBias01: number;
  readonly privatePressureBias01: number;
  readonly playerSpecificity01: number;
  readonly seasonalAbsorption01: number;
  readonly intimacyEscalation01: number;
  readonly prophecyCadence01: number;
}

export interface ChatPersonaEvolutionProfile {
  readonly playerId?: string | null;
  readonly botId: string;
  readonly stage: ChatPersonaStageId;
  readonly splitMode: ChatPersonaSplitMode;
  readonly temperament: ChatPersonaTemperament;
  readonly vector: ChatPersonaEvolutionVector;
  readonly activeTransformBiases: readonly ChatPersonaTransformBias[];
  readonly careerRuns: number;
  readonly meaningfulEvents: number;
  readonly collapseWitnessCount: number;
  readonly comebackWitnessCount: number;
  readonly callbackUsageCount: number;
  readonly lastEvolvedAt: number;
  readonly lastMeaningfulEventAt?: number;
  readonly lastSeasonId?: string | null;
  readonly eventTail: readonly ChatPersonaEvolutionEvent[];
}

export interface ChatPersonaEvolutionSignal {
  readonly botId: string;
  readonly playerId?: string | null;
  readonly stage: ChatPersonaStageId;
  readonly splitMode: ChatPersonaSplitMode;
  readonly temperament: ChatPersonaTemperament;
  readonly transformBiases: readonly ChatPersonaTransformBias[];
  readonly selectionBias01: number;
  readonly callbackAggression01: number;
  readonly publicPressureBias01: number;
  readonly privatePressureBias01: number;
  readonly prophecyCadence01: number;
  readonly playerSpecificity01: number;
  readonly seasonalAbsorption01: number;
  readonly notes: readonly string[];
}

export interface ChatPersonaEvolutionSnapshot {
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly profiles: readonly ChatPersonaEvolutionProfile[];
}

export const CHAT_PERSONA_STAGE_PROFILES: readonly ChatPersonaStageProfile[] = [
  {
    stageId: 'INTRODUCTORY',
    minimumCareerRuns: 0,
    minimumMeaningfulEvents: 0,
    callbackAggressionFloor01: 0.05,
    vocabularyWidening01: 0.10,
    publicPressureBias01: 0.38,
    privatePressureBias01: 0.18,
    mythicWeight01: 0.02,
  },
  {
    stageId: 'ESTABLISHED',
    minimumCareerRuns: 6,
    minimumMeaningfulEvents: 16,
    callbackAggressionFloor01: 0.14,
    vocabularyWidening01: 0.22,
    publicPressureBias01: 0.44,
    privatePressureBias01: 0.22,
    mythicWeight01: 0.06,
  },
  {
    stageId: 'PERSONAL',
    minimumCareerRuns: 18,
    minimumMeaningfulEvents: 40,
    callbackAggressionFloor01: 0.24,
    vocabularyWidening01: 0.38,
    publicPressureBias01: 0.40,
    privatePressureBias01: 0.32,
    mythicWeight01: 0.14,
  },
  {
    stageId: 'RIVALRIC',
    minimumCareerRuns: 40,
    minimumMeaningfulEvents: 90,
    callbackAggressionFloor01: 0.40,
    vocabularyWidening01: 0.56,
    publicPressureBias01: 0.36,
    privatePressureBias01: 0.46,
    mythicWeight01: 0.24,
  },
  {
    stageId: 'MYTHIC',
    minimumCareerRuns: 90,
    minimumMeaningfulEvents: 180,
    callbackAggressionFloor01: 0.58,
    vocabularyWidening01: 0.72,
    publicPressureBias01: 0.34,
    privatePressureBias01: 0.52,
    mythicWeight01: 0.42,
  },
] as const;

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

export function resolvePersonaStage(
  careerRuns: number,
  meaningfulEvents: number,
): ChatPersonaStageId {
  let resolved: ChatPersonaStageId = 'INTRODUCTORY';
  for (const profile of CHAT_PERSONA_STAGE_PROFILES) {
    if (
      careerRuns >= profile.minimumCareerRuns &&
      meaningfulEvents >= profile.minimumMeaningfulEvents
    ) {
      resolved = profile.stageId;
    }
  }
  return resolved;
}

export function buildDefaultPersonaEvolutionProfile(
  botId: string,
  now: number,
  playerId?: string | null,
): ChatPersonaEvolutionProfile {
  return {
    playerId: playerId ?? null,
    botId,
    stage: 'INTRODUCTORY',
    splitMode: 'BALANCED',
    temperament: 'CALCULATED',
    vector: {
      toneHardening01: 0.16,
      vocabularyWidening01: 0.10,
      callbackAggression01: 0.05,
      patienceShift01: 0.28,
      publicPressureBias01: 0.35,
      privatePressureBias01: 0.18,
      playerSpecificity01: 0.08,
      seasonalAbsorption01: 0.10,
      intimacyEscalation01: 0.06,
      prophecyCadence01: 0.04,
    },
    activeTransformBiases: ['MORE_DIRECT'],
    careerRuns: 0,
    meaningfulEvents: 0,
    collapseWitnessCount: 0,
    comebackWitnessCount: 0,
    callbackUsageCount: 0,
    lastEvolvedAt: now,
    lastMeaningfulEventAt: undefined,
    lastSeasonId: null,
    eventTail: [],
  };
}
