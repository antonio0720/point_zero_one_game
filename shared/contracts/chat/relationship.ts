/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT RELATIONSHIP CONTRACTS
 * FILE: shared/contracts/chat/relationship.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Shared relationship-evolution contracts for frontend + backend chat lanes.
 * These contracts are transport-safe, persistence-friendly, and deliberately
 * richer than the current legacy relationship vector so the system can evolve
 * without breaking current UI shells.
 * ============================================================================
 */

export type ChatRelationshipPressureBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ChatRelationshipCounterpartKind =
  | 'NPC'
  | 'BOT'
  | 'HELPER'
  | 'RIVAL'
  | 'ARCHIVIST'
  | 'AMBIENT'
  | 'SYSTEM';

export type ChatRelationshipAxisId =
  | 'CONTEMPT'
  | 'FASCINATION'
  | 'RESPECT'
  | 'FEAR'
  | 'OBSESSION'
  | 'PATIENCE'
  | 'FAMILIARITY'
  | 'PREDICTIVE_CONFIDENCE'
  | 'TRAUMA_DEBT'
  | 'UNFINISHED_BUSINESS';

export type ChatRelationshipEventType =
  | 'PLAYER_MESSAGE'
  | 'PLAYER_QUESTION'
  | 'PLAYER_ANGER'
  | 'PLAYER_TROLL'
  | 'PLAYER_FLEX'
  | 'PLAYER_CALM'
  | 'PLAYER_HESITATION'
  | 'PLAYER_DISCIPLINE'
  | 'PLAYER_GREED'
  | 'PLAYER_BLUFF'
  | 'PLAYER_OVERCONFIDENCE'
  | 'PLAYER_COMEBACK'
  | 'PLAYER_COLLAPSE'
  | 'PLAYER_BREACH'
  | 'PLAYER_PERFECT_DEFENSE'
  | 'PLAYER_FAILED_GAMBLE'
  | 'PLAYER_NEAR_SOVEREIGNTY'
  | 'NEGOTIATION_WINDOW'
  | 'MARKET_ALERT'
  | 'BOT_TAUNT_EMITTED'
  | 'BOT_RETREAT_EMITTED'
  | 'HELPER_RESCUE_EMITTED'
  | 'RIVAL_WITNESS_EMITTED'
  | 'ARCHIVIST_WITNESS_EMITTED'
  | 'AMBIENT_WITNESS_EMITTED'
  | 'PUBLIC_WITNESS'
  | 'PRIVATE_WITNESS'
  | 'RUN_START'
  | 'RUN_END';

export type ChatRelationshipStance =
  | 'DISMISSIVE'
  | 'CLINICAL'
  | 'PROBING'
  | 'PREDATORY'
  | 'HUNTING'
  | 'OBSESSED'
  | 'RESPECTFUL'
  | 'WOUNDED'
  | 'PROTECTIVE'
  | 'CURIOUS';

export type ChatRelationshipObjective =
  | 'HUMILIATE'
  | 'CONTAIN'
  | 'PROVOKE'
  | 'STUDY'
  | 'PRESSURE'
  | 'REPRICE'
  | 'DELAY'
  | 'WITNESS'
  | 'RESCUE'
  | 'TEST'
  | 'NEGOTIATE';

export interface ChatRelationshipVector {
  readonly contempt01: number;
  readonly fascination01: number;
  readonly respect01: number;
  readonly fear01: number;
  readonly obsession01: number;
  readonly patience01: number;
  readonly familiarity01: number;
  readonly predictiveConfidence01: number;
  readonly traumaDebt01: number;
  readonly unfinishedBusiness01: number;
}

export interface ChatRelationshipEventDescriptor {
  readonly eventId: string;
  readonly eventType: ChatRelationshipEventType;
  readonly counterpartId: string;
  readonly counterpartKind: ChatRelationshipCounterpartKind;
  readonly playerId?: string | null;
  readonly botId?: string | null;
  readonly actorRole?: string | null;
  readonly channelId?: string | null;
  readonly roomId?: string | null;
  readonly sourceMessageId?: string | null;
  readonly sourcePlanId?: string | null;
  readonly sceneId?: string | null;
  readonly pressureBand?: ChatRelationshipPressureBand;
  readonly publicWitness01?: number;
  readonly intensity01?: number;
  readonly summary?: string;
  readonly rawText?: string | null;
  readonly tags?: readonly string[];
  readonly createdAt: number;
}

export interface ChatRelationshipCallbackHint {
  readonly callbackId: string;
  readonly label: string;
  readonly text: string;
  readonly weight01: number;
}

export interface ChatRelationshipCounterpartState {
  readonly counterpartId: string;
  readonly counterpartKind: ChatRelationshipCounterpartKind;
  readonly playerId?: string | null;
  readonly botId?: string | null;
  readonly actorRole?: string | null;
  readonly lastChannelId?: string | null;
  readonly vector: ChatRelationshipVector;
  readonly stance: ChatRelationshipStance;
  readonly objective: ChatRelationshipObjective;
  readonly intensity01: number;
  readonly volatility01: number;
  readonly publicPressureBias01: number;
  readonly privatePressureBias01: number;
  readonly callbackHints: readonly ChatRelationshipCallbackHint[];
  readonly eventHistoryTail: readonly ChatRelationshipEventDescriptor[];
  readonly dominantAxes: readonly ChatRelationshipAxisId[];
  readonly lastTouchedAt: number;
}

export interface ChatRelationshipLegacyProjection {
  readonly counterpartId: string;
  readonly respect: number;
  readonly fear: number;
  readonly contempt: number;
  readonly fascination: number;
  readonly trust: number;
  readonly familiarity: number;
  readonly rivalryIntensity: number;
  readonly rescueDebt: number;
  readonly adviceObedience: number;
  readonly escalationTier: 'NONE' | 'MILD' | 'ACTIVE' | 'OBSESSIVE';
}

export interface ChatRelationshipNpcSignal {
  readonly counterpartId: string;
  readonly stance: ChatRelationshipStance;
  readonly objective: ChatRelationshipObjective;
  readonly intensity01: number;
  readonly volatility01: number;
  readonly selectionWeight01: number;
  readonly publicPressureBias01: number;
  readonly privatePressureBias01: number;
  readonly predictiveConfidence01: number;
  readonly obsession01: number;
  readonly unfinishedBusiness01: number;
  readonly respect01: number;
  readonly fear01: number;
  readonly contempt01: number;
  readonly familiarity01: number;
  readonly callbackHint?: ChatRelationshipCallbackHint;
  readonly notes: readonly string[];
}

export interface ChatRelationshipSnapshot {
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly playerId?: string | null;
  readonly counterparts: readonly ChatRelationshipCounterpartState[];
  readonly totalEventCount: number;
  readonly focusedCounterpartByChannel: Readonly<Record<string, string | undefined>>;
}

export interface ChatRelationshipSummaryView {
  readonly counterpartId: string;
  readonly stance: ChatRelationshipStance;
  readonly objective: ChatRelationshipObjective;
  readonly intensity01: number;
  readonly volatility01: number;
  readonly obsession01: number;
  readonly predictiveConfidence01: number;
  readonly unfinishedBusiness01: number;
  readonly respect01: number;
  readonly fear01: number;
  readonly contempt01: number;
  readonly familiarity01: number;
  readonly callbackCount: number;
  readonly legacy: ChatRelationshipLegacyProjection;
}

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

export function weightedBlend(current: number, delta: number, weight = 0.5): number {
  const next = current + delta * weight;
  return clamp01(next);
}

export function emptyRelationshipVector(): ChatRelationshipVector {
  return {
    contempt01: 0.15,
    fascination01: 0.25,
    respect01: 0.20,
    fear01: 0.12,
    obsession01: 0.08,
    patience01: 0.45,
    familiarity01: 0.10,
    predictiveConfidence01: 0.20,
    traumaDebt01: 0.05,
    unfinishedBusiness01: 0.12,
  };
}
