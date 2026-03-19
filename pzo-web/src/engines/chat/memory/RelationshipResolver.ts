
/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT RELATIONSHIP RESOLVER
 * FILE: backend/src/game/engine/chat/memory/RelationshipResolver.ts
 * VERSION: 2026.03.18
 * ============================================================================
 */

import type {
  ChatRelationshipAxisId,
  ChatRelationshipCounterpartKind,
  ChatRelationshipCounterpartState,
  ChatRelationshipEventDescriptor,
  ChatRelationshipEventType,
  ChatRelationshipLegacyProjection,
  ChatRelationshipNpcSignal,
  ChatRelationshipObjective,
  ChatRelationshipPressureBand,
  ChatRelationshipSnapshot,
  ChatRelationshipStance,
  ChatRelationshipSummaryView,
} from '../../../../../shared/contracts/chat/relationship';
import { clamp01 } from '../../../../../shared/contracts/chat/relationship';
import {
  DEFAULT_RIVALRY_ESCALATION_POLICY_CONFIG,
  type RivalryEscalationAssessment,
  type RivalryEscalationDecision,
  type RivalryEscalationPolicyConfig,
  type RivalryEscalationRequest,
  RivalryEscalationPolicy,
} from './RivalryEscalationPolicy';

export type RelationshipResolverMode =
  | 'DEFAULT'
  | 'SCENE_COMPOSITION'
  | 'LIVE_REPLY'
  | 'REPLAY'
  | 'POST_RUN'
  | 'DEAL_ROOM'
  | 'RESCUE'
  | 'WORLD_EVENT';

export type RelationshipRole =
  | 'PRIMARY_AGGRESSOR'
  | 'PRIMARY_HELPER'
  | 'PRIMARY_WITNESS'
  | 'SECONDARY_WITNESS'
  | 'DELAYED_CALLBACK'
  | 'SILENT_PRESSURE'
  | 'BACKGROUND_HEAT'
  | 'OBSERVER';

export type RelationshipVisibilityClass =
  | 'PUBLIC_STAGE'
  | 'PRIVATE_CHAMBER'
  | 'BALANCED'
  | 'SUPPRESSED';

export type RelationshipCallbackTier =
  | 'NONE'
  | 'LIGHT'
  | 'MODERATE'
  | 'HARD'
  | 'RECEIPT';

export interface RelationshipResolverContext {
  readonly now: number;
  readonly playerId?: string | null;
  readonly roomId?: string | null;
  readonly channelId?: string | null;
  readonly mode?: RelationshipResolverMode;
  readonly pressureBand?: ChatRelationshipPressureBand;
  readonly sourceEvent?: ChatRelationshipEventDescriptor | null;
  readonly requestedCounterpartId?: string | null;
  readonly allowPublicSwarm?: boolean;
  readonly allowHelperIntervention?: boolean;
  readonly allowNegotiationLeakage?: boolean;
  readonly allowDelayedReveal?: boolean;
  readonly allowReceipts?: boolean;
  readonly allowRescueSuppression?: boolean;
  readonly allowCounterpartRotation?: boolean;
  readonly rescueWindowOpen?: boolean;
  readonly negotiationWindowOpen?: boolean;
  readonly shadowOnly?: boolean;
  readonly maxWitnessCount?: number;
  readonly maxCandidates?: number;
  readonly minIntensity01?: number;
  readonly tags?: readonly string[];
}

export interface RelationshipCallbackOpportunity {
  readonly tier: RelationshipCallbackTier;
  readonly callbackId?: string;
  readonly label?: string;
  readonly text?: string;
  readonly suitability01: number;
  readonly humiliationRisk01: number;
  readonly witnessValue01: number;
  readonly safeForPublic: boolean;
}

export interface RelationshipWitnessDecision {
  readonly visibleWitnessCount: number;
  readonly shadowWitnessCount: number;
  readonly visibleCounterpartIds: readonly string[];
  readonly shadowCounterpartIds: readonly string[];
  readonly audienceHeatDelta01: number;
  readonly recommendCrowdPileOn: boolean;
}

export interface RelationshipRescueWindow {
  readonly suppressHelpers: boolean;
  readonly delayHelpersMs: number;
  readonly helperUrgency01: number;
  readonly rescueDebtPressure01: number;
  readonly letPressureBreathe: boolean;
}

export interface RelationshipNegotiationAdvisory {
  readonly shouldLeakToPublic: boolean;
  readonly shouldPreferQuietPressure: boolean;
  readonly shouldForceReprice: boolean;
  readonly shouldDelayCounterOffer: boolean;
  readonly urgency01: number;
}

export interface RelationshipResolution {
  readonly counterpartId: string;
  readonly counterpartKind: ChatRelationshipCounterpartKind;
  readonly stance: ChatRelationshipStance;
  readonly objective: ChatRelationshipObjective;
  readonly role: RelationshipRole;
  readonly visibility: RelationshipVisibilityClass;
  readonly selectionScore01: number;
  readonly aggression01: number;
  readonly rescueBias01: number;
  readonly trustLeverage01: number;
  readonly embarrassmentRisk01: number;
  readonly callback: RelationshipCallbackOpportunity;
  readonly witnessWeight01: number;
  readonly recommendedTags: readonly string[];
  readonly notes: readonly string[];
  readonly escalation: RivalryEscalationDecision;
  readonly signal: ChatRelationshipNpcSignal;
  readonly legacy: ChatRelationshipLegacyProjection;
}

export interface RelationshipResolutionEnvelope {
  readonly createdAt: number;
  readonly playerId?: string | null;
  readonly roomId?: string | null;
  readonly channelId?: string | null;
  readonly mode: RelationshipResolverMode;
  readonly pressureBand: ChatRelationshipPressureBand;
  readonly primary?: RelationshipResolution;
  readonly helpers: readonly RelationshipResolution[];
  readonly rivals: readonly RelationshipResolution[];
  readonly witnesses: readonly RelationshipResolution[];
  readonly delayed: readonly RelationshipResolution[];
  readonly suppressed: readonly RelationshipResolution[];
  readonly witnessDecision: RelationshipWitnessDecision;
  readonly rescueWindow: RelationshipRescueWindow;
  readonly negotiation: RelationshipNegotiationAdvisory;
  readonly recommendedCounterpartIds: readonly string[];
  readonly summary: readonly string[];
}

export interface RelationshipResolverConfig {
  readonly minCandidateIntensity01: number;
  readonly maxCandidateCount: number;
  readonly maxVisibleWitnessCount: number;
  readonly maxShadowWitnessCount: number;
  readonly publicWitnessFloor01: number;
  readonly delayedRevealFloor01: number;
  readonly helperDominanceFloor01: number;
  readonly rivalryDominanceFloor01: number;
  readonly rescueSuppressionFloor01: number;
  readonly negotiationLeakFloor01: number;
  readonly counterpartRotationPenalty01: number;
  readonly staleCounterpartPenalty01: number;
  readonly callbackRepeatPenalty01: number;
  readonly callbackReceiptFloor01: number;
  readonly obsessivenessPublicAmplifier01: number;
  readonly confidenceEmbarrassmentAmplifier01: number;
  readonly pressureAggressionAmplifier01: number;
  readonly rescueDebtAmplifier01: number;
  readonly channelBiases: Readonly<Record<string, number>>;
  readonly modeBiases: Readonly<Record<RelationshipResolverMode, number>>;
  readonly counterpartKindBiases: Readonly<Record<ChatRelationshipCounterpartKind, number>>;
  readonly eventSeverity: Readonly<Record<ChatRelationshipEventType, number>>;
}

const DEFAULT_CHANNEL_BIASES: Readonly<Record<string, number>> = Object.freeze({
  GLOBAL: 0.94,
  SYNDICATE: 0.72,
  DEAL_ROOM: 0.58,
  DIRECT: 0.36,
  SPECTATOR: 0.87,
  SYSTEM: 0.51,
});

const DEFAULT_MODE_BIASES: Readonly<Record<RelationshipResolverMode, number>> = Object.freeze({
  DEFAULT: 0.55,
  SCENE_COMPOSITION: 0.88,
  LIVE_REPLY: 0.74,
  REPLAY: 0.45,
  POST_RUN: 0.63,
  DEAL_ROOM: 0.66,
  RESCUE: 0.49,
  WORLD_EVENT: 0.77,
});

const DEFAULT_COUNTERPART_KIND_BIASES: Readonly<Record<ChatRelationshipCounterpartKind, number>> = Object.freeze({
  NPC: 0.54,
  BOT: 0.67,
  HELPER: 0.59,
  RIVAL: 0.82,
  ARCHIVIST: 0.31,
  AMBIENT: 0.24,
  SYSTEM: 0.21,
});

const DEFAULT_EVENT_SEVERITY: Readonly<Record<ChatRelationshipEventType, number>> = Object.freeze({
  'PLAYER_MESSAGE': 0.26,
  'PLAYER_QUESTION': 0.24,
  'PLAYER_ANGER': 0.54,
  'PLAYER_TROLL': 0.58,
  'PLAYER_FLEX': 0.61,
  'PLAYER_CALM': 0.19,
  'PLAYER_HESITATION': 0.33,
  'PLAYER_DISCIPLINE': 0.42,
  'PLAYER_GREED': 0.57,
  'PLAYER_BLUFF': 0.52,
  'PLAYER_OVERCONFIDENCE': 0.68,
  'PLAYER_COMEBACK': 0.76,
  'PLAYER_COLLAPSE': 0.72,
  'PLAYER_BREACH': 0.81,
  'PLAYER_PERFECT_DEFENSE': 0.73,
  'PLAYER_FAILED_GAMBLE': 0.66,
  'PLAYER_NEAR_SOVEREIGNTY': 0.88,
  'NEGOTIATION_WINDOW': 0.44,
  'MARKET_ALERT': 0.39,
  'BOT_TAUNT_EMITTED': 0.37,
  'BOT_RETREAT_EMITTED': 0.41,
  'HELPER_RESCUE_EMITTED': 0.63,
  'RIVAL_WITNESS_EMITTED': 0.47,
  'ARCHIVIST_WITNESS_EMITTED': 0.29,
  'AMBIENT_WITNESS_EMITTED': 0.25,
  'PUBLIC_WITNESS': 0.48,
  'PRIVATE_WITNESS': 0.27,
  'RUN_START': 0.22,
  'RUN_END': 0.51,
});
const EVENT_PUBLICNESS: Readonly<Record<ChatRelationshipEventType, number>> = Object.freeze({
  'PLAYER_MESSAGE': 0.42,
  'PLAYER_QUESTION': 0.34,
  'PLAYER_ANGER': 0.77,
  'PLAYER_TROLL': 0.82,
  'PLAYER_FLEX': 0.86,
  'PLAYER_CALM': 0.31,
  'PLAYER_HESITATION': 0.38,
  'PLAYER_DISCIPLINE': 0.44,
  'PLAYER_GREED': 0.66,
  'PLAYER_BLUFF': 0.71,
  'PLAYER_OVERCONFIDENCE': 0.85,
  'PLAYER_COMEBACK': 0.93,
  'PLAYER_COLLAPSE': 0.91,
  'PLAYER_BREACH': 0.89,
  'PLAYER_PERFECT_DEFENSE': 0.88,
  'PLAYER_FAILED_GAMBLE': 0.79,
  'PLAYER_NEAR_SOVEREIGNTY': 0.95,
  'NEGOTIATION_WINDOW': 0.51,
  'MARKET_ALERT': 0.57,
  'BOT_TAUNT_EMITTED': 0.73,
  'BOT_RETREAT_EMITTED': 0.49,
  'HELPER_RESCUE_EMITTED': 0.58,
  'RIVAL_WITNESS_EMITTED': 0.69,
  'ARCHIVIST_WITNESS_EMITTED': 0.41,
  'AMBIENT_WITNESS_EMITTED': 0.45,
  'PUBLIC_WITNESS': 0.92,
  'PRIVATE_WITNESS': 0.12,
  'RUN_START': 0.54,
  'RUN_END': 0.74,
});
const EVENT_HOSTILITY: Readonly<Record<ChatRelationshipEventType, number>> = Object.freeze({
  'PLAYER_MESSAGE': 0.12,
  'PLAYER_QUESTION': 0.07,
  'PLAYER_ANGER': 0.63,
  'PLAYER_TROLL': 0.79,
  'PLAYER_FLEX': 0.74,
  'PLAYER_CALM': 0.02,
  'PLAYER_HESITATION': 0.1,
  'PLAYER_DISCIPLINE': 0.11,
  'PLAYER_GREED': 0.35,
  'PLAYER_BLUFF': 0.29,
  'PLAYER_OVERCONFIDENCE': 0.58,
  'PLAYER_COMEBACK': 0.44,
  'PLAYER_COLLAPSE': 0.18,
  'PLAYER_BREACH': 0.5,
  'PLAYER_PERFECT_DEFENSE': 0.31,
  'PLAYER_FAILED_GAMBLE': 0.23,
  'PLAYER_NEAR_SOVEREIGNTY': 0.69,
  'NEGOTIATION_WINDOW': 0.17,
  'MARKET_ALERT': 0.09,
  'BOT_TAUNT_EMITTED': 0.46,
  'BOT_RETREAT_EMITTED': 0.12,
  'HELPER_RESCUE_EMITTED': 0.03,
  'RIVAL_WITNESS_EMITTED': 0.26,
  'ARCHIVIST_WITNESS_EMITTED': 0.0,
  'AMBIENT_WITNESS_EMITTED': 0.05,
  'PUBLIC_WITNESS': 0.21,
  'PRIVATE_WITNESS': 0.04,
  'RUN_START': 0.0,
  'RUN_END': 0.14,
});
const EVENT_PRESTIGE: Readonly<Record<ChatRelationshipEventType, number>> = Object.freeze({
  'PLAYER_MESSAGE': 0.16,
  'PLAYER_QUESTION': 0.14,
  'PLAYER_ANGER': 0.36,
  'PLAYER_TROLL': 0.33,
  'PLAYER_FLEX': 0.41,
  'PLAYER_CALM': 0.11,
  'PLAYER_HESITATION': 0.09,
  'PLAYER_DISCIPLINE': 0.48,
  'PLAYER_GREED': 0.18,
  'PLAYER_BLUFF': 0.37,
  'PLAYER_OVERCONFIDENCE': 0.34,
  'PLAYER_COMEBACK': 0.86,
  'PLAYER_COLLAPSE': 0.41,
  'PLAYER_BREACH': 0.69,
  'PLAYER_PERFECT_DEFENSE': 0.81,
  'PLAYER_FAILED_GAMBLE': 0.22,
  'PLAYER_NEAR_SOVEREIGNTY': 0.97,
  'NEGOTIATION_WINDOW': 0.31,
  'MARKET_ALERT': 0.17,
  'BOT_TAUNT_EMITTED': 0.2,
  'BOT_RETREAT_EMITTED': 0.42,
  'HELPER_RESCUE_EMITTED': 0.63,
  'RIVAL_WITNESS_EMITTED': 0.29,
  'ARCHIVIST_WITNESS_EMITTED': 0.26,
  'AMBIENT_WITNESS_EMITTED': 0.22,
  'PUBLIC_WITNESS': 0.38,
  'PRIVATE_WITNESS': 0.15,
  'RUN_START': 0.12,
  'RUN_END': 0.58,
});

const PRESSURE_AGGRESSION_BIAS: Readonly<Record<ChatRelationshipPressureBand, number>> = Object.freeze({
  LOW: 0.14,
  MEDIUM: 0.33,
  HIGH: 0.61,
  CRITICAL: 0.86,
});

const PRESSURE_RESCUE_BIAS: Readonly<Record<ChatRelationshipPressureBand, number>> = Object.freeze({
  LOW: 0.18,
  MEDIUM: 0.32,
  HIGH: 0.58,
  CRITICAL: 0.84,
});

export const DEFAULT_RELATIONSHIP_RESOLVER_CONFIG: RelationshipResolverConfig = Object.freeze({
  minCandidateIntensity01: 0.08,
  maxCandidateCount: 8,
  maxVisibleWitnessCount: 3,
  maxShadowWitnessCount: 6,
  publicWitnessFloor01: 0.41,
  delayedRevealFloor01: 0.53,
  helperDominanceFloor01: 0.57,
  rivalryDominanceFloor01: 0.49,
  rescueSuppressionFloor01: 0.56,
  negotiationLeakFloor01: 0.61,
  counterpartRotationPenalty01: 0.08,
  staleCounterpartPenalty01: 0.12,
  callbackRepeatPenalty01: 0.07,
  callbackReceiptFloor01: 0.66,
  obsessivenessPublicAmplifier01: 0.16,
  confidenceEmbarrassmentAmplifier01: 0.15,
  pressureAggressionAmplifier01: 0.18,
  rescueDebtAmplifier01: 0.17,
  channelBiases: DEFAULT_CHANNEL_BIASES,
  modeBiases: DEFAULT_MODE_BIASES,
  counterpartKindBiases: DEFAULT_COUNTERPART_KIND_BIASES,
  eventSeverity: DEFAULT_EVENT_SEVERITY,
});

function valueOr<T>(value: T | null | undefined, fallback: T): T { return value ?? fallback; }
function pressureOr(value?: ChatRelationshipPressureBand): ChatRelationshipPressureBand { return value ?? 'MEDIUM'; }
function modeOr(value?: RelationshipResolverMode): RelationshipResolverMode { return value ?? 'DEFAULT'; }
function isHelper(kind: ChatRelationshipCounterpartKind): boolean { return kind === 'HELPER'; }
function isRival(kind: ChatRelationshipCounterpartKind): boolean { return kind === 'RIVAL' || kind === 'BOT'; }
function isWitnessLike(kind: ChatRelationshipCounterpartKind): boolean { return kind === 'ARCHIVIST' || kind === 'AMBIENT' || kind === 'SYSTEM'; }

function agePenalty01(now: number, lastTouchedAt: number): number {
  const ageMs = Math.max(0, now - lastTouchedAt);
  if (ageMs <= 15_000) return 0;
  if (ageMs <= 60_000) return 0.03;
  if (ageMs <= 180_000) return 0.08;
  if (ageMs <= 600_000) return 0.14;
  if (ageMs <= 1_800_000) return 0.22;
  return 0.30;
}

function legacyTrustLeverage01(legacy: ChatRelationshipLegacyProjection): number {
  return clamp01((legacy.trust / 100) * 0.62 + (legacy.familiarity / 100) * 0.38);
}

function legacyEmbarrassmentRisk01(legacy: ChatRelationshipLegacyProjection): number {
  return clamp01((legacy.rivalryIntensity / 100) * 0.46 + (legacy.contempt / 100) * 0.31 + (legacy.fascination / 100) * 0.23);
}

function dominantAxisBonus01(axes: readonly ChatRelationshipAxisId[]): number {
  if (axes.includes('OBSESSION')) return 0.18;
  if (axes.includes('UNFINISHED_BUSINESS')) return 0.15;
  if (axes.includes('CONTEMPT')) return 0.12;
  if (axes.includes('RESPECT')) return 0.08;
  if (axes.includes('TRAUMA_DEBT')) return 0.10;
  return 0.04;
}

function buildNpcSignalFromState(state: ChatRelationshipCounterpartState): ChatRelationshipNpcSignal {
  const vector = state.vector;
  return {
    counterpartId: state.counterpartId,
    stance: state.stance,
    objective: state.objective,
    intensity01: state.intensity01,
    volatility01: state.volatility01,
    selectionWeight01: clamp01(state.intensity01 * 0.46 + vector.fascination01 * 0.14 + vector.unfinishedBusiness01 * 0.18 + vector.obsession01 * 0.22),
    publicPressureBias01: state.publicPressureBias01,
    privatePressureBias01: state.privatePressureBias01,
    predictiveConfidence01: vector.predictiveConfidence01,
    obsession01: vector.obsession01,
    unfinishedBusiness01: vector.unfinishedBusiness01,
    respect01: vector.respect01,
    fear01: vector.fear01,
    contempt01: vector.contempt01,
    familiarity01: vector.familiarity01,
    callbackHint: state.callbackHints[0],
    notes: state.dominantAxes,
  };
}

function buildLegacyProjection(state: ChatRelationshipCounterpartState): ChatRelationshipLegacyProjection {
  const vector = state.vector;
  return {
    counterpartId: state.counterpartId,
    respect: Math.round(vector.respect01 * 100),
    fear: Math.round(vector.fear01 * 100),
    contempt: Math.round(vector.contempt01 * 100),
    fascination: Math.round(vector.fascination01 * 100),
    trust: Math.round(clamp01(vector.familiarity01 * 0.52 + vector.patience01 * 0.48) * 100),
    familiarity: Math.round(vector.familiarity01 * 100),
    rivalryIntensity: Math.round(clamp01(vector.contempt01 * 0.58 + vector.unfinishedBusiness01 * 0.42) * 100),
    rescueDebt: Math.round(vector.traumaDebt01 * 100),
    adviceObedience: Math.round(clamp01(vector.respect01 * 0.61 + vector.familiarity01 * 0.39) * 100),
    escalationTier: state.intensity01 >= 0.82 ? 'OBSESSIVE' : state.intensity01 >= 0.58 ? 'ACTIVE' : state.intensity01 >= 0.30 ? 'MILD' : 'NONE',
  };
}

function callbackOpportunity(state: ChatRelationshipCounterpartState, context: RelationshipResolverContext, config: RelationshipResolverConfig): RelationshipCallbackOpportunity {
  const hint = state.callbackHints[0];
  if (!hint || context.allowReceipts === false) {
    return { tier: 'NONE', suitability01: 0, humiliationRisk01: 0, witnessValue01: 0, safeForPublic: false };
  }
  const embarrassment = clamp01(state.vector.contempt01 * 0.38 + state.vector.predictiveConfidence01 * config.confidenceEmbarrassmentAmplifier01 + state.vector.unfinishedBusiness01 * 0.19 + hint.weight01 * 0.18);
  const suitability = clamp01(hint.weight01 * 0.28 + state.vector.fascination01 * 0.16 + state.vector.obsession01 * 0.16 + state.intensity01 * 0.14 + state.vector.predictiveConfidence01 * 0.12 + (context.sourceEvent ? EVENT_PRESTIGE[context.sourceEvent.eventType] * 0.14 : 0));
  const safeForPublic = embarrassment < 0.84;
  const tier = suitability >= config.callbackReceiptFloor01 && embarrassment >= 0.62 ? 'RECEIPT' : suitability >= 0.72 ? 'HARD' : suitability >= 0.54 ? 'MODERATE' : suitability >= 0.36 ? 'LIGHT' : 'NONE';
  return { tier, callbackId: tier === 'NONE' ? undefined : hint.callbackId, label: tier === 'NONE' ? undefined : hint.label, text: tier === 'NONE' ? undefined : hint.text, suitability01: suitability, humiliationRisk01: embarrassment, witnessValue01: clamp01(suitability * 0.54 + embarrassment * 0.46), safeForPublic };
}

function publicStageBias01(state: ChatRelationshipCounterpartState, context: RelationshipResolverContext, config: RelationshipResolverConfig): number {
  const channelBias = config.channelBiases[valueOr(context.channelId, 'GLOBAL')] ?? 0.55;
  const eventType = context.sourceEvent?.eventType ?? 'PLAYER_MESSAGE';
  return clamp01(state.publicPressureBias01 * 0.52 + channelBias * 0.21 + EVENT_PUBLICNESS[eventType] * 0.17 + state.vector.obsession01 * config.obsessivenessPublicAmplifier01 + (context.allowPublicSwarm === false ? -0.18 : 0));
}

function privateStageBias01(state: ChatRelationshipCounterpartState, context: RelationshipResolverContext): number {
  const directBias = valueOr(context.channelId, '').toUpperCase() === 'DIRECT' ? 0.22 : 0;
  const dealBias = valueOr(context.channelId, '').toUpperCase() === 'DEAL_ROOM' ? 0.11 : 0;
  return clamp01(state.privatePressureBias01 * 0.68 + state.vector.familiarity01 * 0.18 + directBias + dealBias);
}

function helperRescueBias01(state: ChatRelationshipCounterpartState, context: RelationshipResolverContext, config: RelationshipResolverConfig): number {
  return clamp01((isHelper(state.counterpartKind) ? 0.26 : 0) + state.vector.traumaDebt01 * config.rescueDebtAmplifier01 + state.vector.familiarity01 * 0.18 + state.vector.respect01 * 0.12 + PRESSURE_RESCUE_BIAS[pressureOr(context.pressureBand)] * 0.22 + (context.rescueWindowOpen ? 0.09 : 0));
}

function aggression01(state: ChatRelationshipCounterpartState, context: RelationshipResolverContext, config: RelationshipResolverConfig): number {
  const eventType = context.sourceEvent?.eventType ?? 'PLAYER_MESSAGE';
  return clamp01(state.vector.contempt01 * 0.31 + state.vector.obsession01 * 0.19 + state.vector.unfinishedBusiness01 * 0.17 + EVENT_HOSTILITY[eventType] * 0.11 + PRESSURE_AGGRESSION_BIAS[pressureOr(context.pressureBand)] * config.pressureAggressionAmplifier01 + (isRival(state.counterpartKind) ? 0.09 : 0));
}

function chooseVisibility(state: ChatRelationshipCounterpartState, context: RelationshipResolverContext, config: RelationshipResolverConfig, callback: RelationshipCallbackOpportunity): RelationshipVisibilityClass {
  if (context.shadowOnly) return 'SUPPRESSED';
  const publicBias = publicStageBias01(state, context, config);
  const privateBias = privateStageBias01(state, context);
  if (callback.tier === 'RECEIPT' && !callback.safeForPublic) return 'PRIVATE_CHAMBER';
  if (publicBias >= 0.66 && publicBias > privateBias + 0.05) return 'PUBLIC_STAGE';
  if (privateBias >= 0.61 && privateBias > publicBias + 0.05) return 'PRIVATE_CHAMBER';
  if (publicBias < 0.24 && privateBias < 0.24) return 'SUPPRESSED';
  return 'BALANCED';
}

function recommendedRole(state: ChatRelationshipCounterpartState, visibility: RelationshipVisibilityClass, agg01: number, rescue01: number, callback: RelationshipCallbackOpportunity): RelationshipRole {
  if (visibility === 'SUPPRESSED' && callback.tier !== 'NONE') return 'DELAYED_CALLBACK';
  if (visibility === 'SUPPRESSED') return 'SILENT_PRESSURE';
  if (isHelper(state.counterpartKind) && rescue01 >= 0.56) return 'PRIMARY_HELPER';
  if (isRival(state.counterpartKind) && agg01 >= 0.48) return 'PRIMARY_AGGRESSOR';
  if (callback.tier === 'RECEIPT' || callback.tier === 'HARD') return 'PRIMARY_WITNESS';
  if (isWitnessLike(state.counterpartKind)) return 'SECONDARY_WITNESS';
  if (agg01 >= 0.34) return 'BACKGROUND_HEAT';
  return 'OBSERVER';
}

function selectionScore01(state: ChatRelationshipCounterpartState, context: RelationshipResolverContext, config: RelationshipResolverConfig, agg01: number, rescue01: number, callback: RelationshipCallbackOpportunity): number {
  const modeBias = config.modeBiases[modeOr(context.mode)] ?? 0.55;
  const kindBias = config.counterpartKindBiases[state.counterpartKind] ?? 0.5;
  const requestedBoost = context.requestedCounterpartId === state.counterpartId ? 0.17 : 0;
  const stalePenalty = agePenalty01(context.now, state.lastTouchedAt) * config.staleCounterpartPenalty01 * 2.4;
  return clamp01(state.intensity01 * 0.26 + agg01 * 0.18 + rescue01 * 0.13 + callback.suitability01 * 0.12 + state.vector.predictiveConfidence01 * 0.09 + state.vector.fascination01 * 0.08 + dominantAxisBonus01(state.dominantAxes) * 0.24 + modeBias * 0.07 + kindBias * 0.07 + PRESSURE_AGGRESSION_BIAS[pressureOr(context.pressureBand)] * 0.09 + requestedBoost - stalePenalty);
}

function recommendedTags(state: ChatRelationshipCounterpartState, callback: RelationshipCallbackOpportunity, role: RelationshipRole, visibility: RelationshipVisibilityClass, escalation: RivalryEscalationDecision): readonly string[] {
  const tags = new Set<string>();
  tags.add(`kind:${state.counterpartKind.toLowerCase()}`);
  tags.add(`stance:${state.stance.toLowerCase()}`);
  tags.add(`objective:${state.objective.toLowerCase()}`);
  tags.add(`role:${role.toLowerCase()}`);
  tags.add(`visibility:${visibility.toLowerCase()}`);
  if (callback.tier !== 'NONE') tags.add(`callback:${callback.tier.toLowerCase()}`);
  if (state.vector.obsession01 >= 0.62) tags.add('obsession:hot');
  if (state.vector.unfinishedBusiness01 >= 0.58) tags.add('unfinished:open');
  if (state.vector.traumaDebt01 >= 0.54) tags.add('rescue:debt');
  if (state.vector.respect01 >= 0.64) tags.add('respect:elevated');
  if (state.vector.contempt01 >= 0.64) tags.add('contempt:elevated');
  if (escalation.selectedTier !== 'NONE') tags.add(`rivalry:${escalation.selectedTier.toLowerCase()}`);
  return Object.freeze([...tags]);
}

function resolutionNotes(state: ChatRelationshipCounterpartState, context: RelationshipResolverContext, visibility: RelationshipVisibilityClass, role: RelationshipRole, callback: RelationshipCallbackOpportunity, agg01: number, rescue01: number): readonly string[] {
  const notes = [
    `dominant_axes=${state.dominantAxes.join(',') || 'none'}`,
    `visibility=${visibility}`,
    `role=${role}`,
    `aggression=${agg01.toFixed(3)}`,
    `rescue_bias=${rescue01.toFixed(3)}`,
    `pressure=${pressureOr(context.pressureBand)}`,
  ];
  if (callback.tier !== 'NONE') notes.push(`callback=${callback.tier}:${callback.label ?? 'latest'}`);
  if (context.sourceEvent) notes.push(`source_event=${context.sourceEvent.eventType}`, `event_publicness=${EVENT_PUBLICNESS[context.sourceEvent.eventType].toFixed(3)}`);
  if (context.requestedCounterpartId === state.counterpartId) notes.push('requested_counterpart=true');
  return Object.freeze(notes);
}

function witnessDecision(resolutions: readonly RelationshipResolution[], context: RelationshipResolverContext, config: RelationshipResolverConfig): RelationshipWitnessDecision {
  const visible = resolutions.filter((item) => item.visibility !== 'SUPPRESSED' && item.witnessWeight01 >= config.publicWitnessFloor01).slice(0, context.maxWitnessCount ?? config.maxVisibleWitnessCount);
  const shadow = resolutions.filter((item) => item.visibility === 'SUPPRESSED' || item.role === 'SILENT_PRESSURE' || item.role === 'DELAYED_CALLBACK').slice(0, config.maxShadowWitnessCount);
  const audienceHeatDelta01 = clamp01(visible.reduce((sum, item) => sum + item.witnessWeight01, 0) / Math.max(1, visible.length) * 0.61 + shadow.reduce((sum, item) => sum + item.escalation.shadowHeat01, 0) / Math.max(1, shadow.length) * 0.39);
  return { visibleWitnessCount: visible.length, shadowWitnessCount: shadow.length, visibleCounterpartIds: Object.freeze(visible.map((item) => item.counterpartId)), shadowCounterpartIds: Object.freeze(shadow.map((item) => item.counterpartId)), audienceHeatDelta01, recommendCrowdPileOn: context.allowPublicSwarm !== false && audienceHeatDelta01 >= 0.58 };
}

function rescueWindow(helpers: readonly RelationshipResolution[], rivals: readonly RelationshipResolution[], context: RelationshipResolverContext, config: RelationshipResolverConfig): RelationshipRescueWindow {
  const topHelper = helpers[0];
  const topRival = rivals[0];
  const helperUrgency01 = topHelper ? topHelper.rescueBias01 : 0;
  const rivalPressure01 = topRival ? topRival.aggression01 : 0;
  const suppressHelpers = context.allowHelperIntervention === false ? true : context.allowRescueSuppression === false ? false : rivalPressure01 >= config.rescueSuppressionFloor01 && helperUrgency01 < rivalPressure01 + 0.08;
  return { suppressHelpers, delayHelpersMs: suppressHelpers ? Math.round(650 + rivalPressure01 * 950) : Math.round(120 + (1 - helperUrgency01) * 260), helperUrgency01, rescueDebtPressure01: clamp01((topHelper?.legacy.rescueDebt ?? 0) / 100), letPressureBreathe: suppressHelpers && rivalPressure01 >= 0.62 };
}

function negotiationAdvisory(resolutions: readonly RelationshipResolution[], context: RelationshipResolverContext, config: RelationshipResolverConfig): RelationshipNegotiationAdvisory {
  const pressureActors = resolutions.filter((item) => item.visibility !== 'SUPPRESSED');
  const leakPressure = pressureActors.length === 0 ? 0 : pressureActors.reduce((sum, item) => sum + item.embarrassmentRisk01, 0) / pressureActors.length;
  const urgency = clamp01(leakPressure * 0.36 + (context.negotiationWindowOpen ? 0.25 : 0) + (valueOr(context.channelId, '').toUpperCase() === 'DEAL_ROOM' ? 0.21 : 0));
  return { shouldLeakToPublic: context.allowNegotiationLeakage !== false && leakPressure >= config.negotiationLeakFloor01, shouldPreferQuietPressure: urgency >= 0.44 && leakPressure < config.negotiationLeakFloor01, shouldForceReprice: urgency >= 0.58, shouldDelayCounterOffer: urgency >= 0.52 && (context.tags ?? []).includes('stall'), urgency01: urgency };
}

function summarizeEnvelope(envelope: Omit<RelationshipResolutionEnvelope, 'summary'>): readonly string[] {
  const summary: string[] = [];
  if (envelope.primary) summary.push(`primary=${envelope.primary.counterpartId}:${envelope.primary.role}:${envelope.primary.visibility}:${envelope.primary.selectionScore01.toFixed(3)}`);
  if (envelope.helpers[0]) summary.push(`helper=${envelope.helpers[0].counterpartId}:${envelope.helpers[0].rescueBias01.toFixed(3)}`);
  if (envelope.rivals[0]) summary.push(`rival=${envelope.rivals[0].counterpartId}:${envelope.rivals[0].aggression01.toFixed(3)}`);
  summary.push(`witnesses=${envelope.witnessDecision.visibleWitnessCount}/${envelope.witnessDecision.shadowWitnessCount}`);
  summary.push(`crowd_pile_on=${String(envelope.witnessDecision.recommendCrowdPileOn)}`);
  summary.push(`rescue_suppressed=${String(envelope.rescueWindow.suppressHelpers)}`);
  summary.push(`negotiation_urgency=${envelope.negotiation.urgency01.toFixed(3)}`);
  return Object.freeze(summary);
}

export class RelationshipResolver {
  private readonly config: RelationshipResolverConfig;
  private readonly rivalryEscalationPolicy: RivalryEscalationPolicy;

  public constructor(config: Partial<RelationshipResolverConfig> = {}, rivalryEscalationConfig: Partial<RivalryEscalationPolicyConfig> = {}) {
    this.config = Object.freeze({
      ...DEFAULT_RELATIONSHIP_RESOLVER_CONFIG,
      ...config,
      channelBiases: Object.freeze({ ...DEFAULT_RELATIONSHIP_RESOLVER_CONFIG.channelBiases, ...(config.channelBiases ?? {}) }),
      modeBiases: Object.freeze({ ...DEFAULT_RELATIONSHIP_RESOLVER_CONFIG.modeBiases, ...(config.modeBiases ?? {}) }),
      counterpartKindBiases: Object.freeze({ ...DEFAULT_RELATIONSHIP_RESOLVER_CONFIG.counterpartKindBiases, ...(config.counterpartKindBiases ?? {}) }),
      eventSeverity: Object.freeze({ ...DEFAULT_RELATIONSHIP_RESOLVER_CONFIG.eventSeverity, ...(config.eventSeverity ?? {}) }),
    });
    this.rivalryEscalationPolicy = new RivalryEscalationPolicy({ ...DEFAULT_RIVALRY_ESCALATION_POLICY_CONFIG, ...rivalryEscalationConfig });
  }

  public resolveSnapshot(snapshot: ChatRelationshipSnapshot, context: RelationshipResolverContext): RelationshipResolutionEnvelope {
    const candidates = this.rankSnapshot(snapshot, context);
    const helpers = candidates.filter((item) => item.role === 'PRIMARY_HELPER' || item.counterpartKind === 'HELPER');
    const rivals = candidates.filter((item) => item.role === 'PRIMARY_AGGRESSOR' || isRival(item.counterpartKind));
    const witnesses = candidates.filter((item) => item.role === 'PRIMARY_WITNESS' || item.role === 'SECONDARY_WITNESS');
    const delayed = candidates.filter((item) => item.role === 'DELAYED_CALLBACK');
    const suppressed = candidates.filter((item) => item.role === 'SILENT_PRESSURE' || item.visibility === 'SUPPRESSED');
    const witness = witnessDecision(candidates, context, this.config);
    const rescue = rescueWindow(helpers, rivals, context, this.config);
    const negotiation = negotiationAdvisory(candidates, context, this.config);
    const primary = candidates.find((item) => item.role === 'PRIMARY_AGGRESSOR') ?? candidates.find((item) => item.role === 'PRIMARY_HELPER') ?? candidates[0];
    const core: Omit<RelationshipResolutionEnvelope, 'summary'> = { createdAt: context.now, playerId: snapshot.playerId ?? context.playerId ?? null, roomId: context.roomId ?? context.sourceEvent?.roomId ?? null, channelId: context.channelId ?? context.sourceEvent?.channelId ?? null, mode: modeOr(context.mode), pressureBand: pressureOr(context.pressureBand ?? context.sourceEvent?.pressureBand), primary, helpers: Object.freeze(helpers), rivals: Object.freeze(rivals), witnesses: Object.freeze(witnesses), delayed: Object.freeze(delayed), suppressed: Object.freeze(suppressed), witnessDecision: witness, rescueWindow: rescue, negotiation, recommendedCounterpartIds: Object.freeze(candidates.map((item) => item.counterpartId)) };
    return Object.freeze({ ...core, summary: summarizeEnvelope(core) });
  }

  public resolveCounterpart(state: ChatRelationshipCounterpartState, context: RelationshipResolverContext): RelationshipResolution {
    const callback = callbackOpportunity(state, context, this.config);
    const agg = aggression01(state, context, this.config);
    const rescue = helperRescueBias01(state, context, this.config);
    const visibility = chooseVisibility(state, context, this.config, callback);
    const role = recommendedRole(state, visibility, agg, rescue, callback);
    const signal = buildNpcSignalFromState(state);
    const legacy = buildLegacyProjection(state);
    const escalationRequest: RivalryEscalationRequest = { state, signal, legacy, context: { now: context.now, channelId: context.channelId ?? state.lastChannelId ?? null, roomId: context.roomId ?? context.sourceEvent?.roomId ?? null, pressureBand: pressureOr(context.pressureBand ?? context.sourceEvent?.pressureBand), mode: modeOr(context.mode), sourceEvent: context.sourceEvent ?? null, allowPublicSwarm: context.allowPublicSwarm !== false, rescueWindowOpen: !!context.rescueWindowOpen, negotiationWindowOpen: !!context.negotiationWindowOpen, allowDelayedReveal: context.allowDelayedReveal !== false, allowReceipts: context.allowReceipts !== false }, callback };
    const escalation = this.rivalryEscalationPolicy.resolve(escalationRequest);
    const trustLeverage = legacyTrustLeverage01(legacy);
    const embarrassment = clamp01(legacyEmbarrassmentRisk01(legacy) * 0.64 + callback.humiliationRisk01 * 0.20 + escalation.publicEmbarrassment01 * 0.16);
    const score = selectionScore01(state, context, this.config, agg, rescue, callback);
    return Object.freeze({ counterpartId: state.counterpartId, counterpartKind: state.counterpartKind, stance: state.stance, objective: state.objective, role, visibility, selectionScore01: score, aggression01: agg, rescueBias01: rescue, trustLeverage01: trustLeverage, embarrassmentRisk01: embarrassment, callback, witnessWeight01: clamp01(score * 0.32 + callback.witnessValue01 * 0.24 + escalation.shadowHeat01 * 0.19 + publicStageBias01(state, context, this.config) * 0.25), recommendedTags: recommendedTags(state, callback, role, visibility, escalation), notes: resolutionNotes(state, context, visibility, role, callback, agg, rescue), escalation, signal, legacy });
  }

  public rankSnapshot(snapshot: ChatRelationshipSnapshot, context: RelationshipResolverContext): readonly RelationshipResolution[] {
    const minimum = context.minIntensity01 ?? this.config.minCandidateIntensity01;
    const max = context.maxCandidates ?? this.config.maxCandidateCount;
    return Object.freeze(snapshot.counterparts.filter((state) => state.intensity01 >= minimum || context.requestedCounterpartId === state.counterpartId).map((state) => this.resolveCounterpart(state, context)).sort((a, b) => { if (b.selectionScore01 !== a.selectionScore01) return b.selectionScore01 - a.selectionScore01; if (b.escalation.selectedScore01 !== a.escalation.selectedScore01) return b.escalation.selectedScore01 - a.escalation.selectedScore01; return a.counterpartId.localeCompare(b.counterpartId); }).slice(0, max));
  }

  public pickFocusedCounterpart(snapshot: ChatRelationshipSnapshot, context: RelationshipResolverContext): RelationshipResolution | undefined {
    const focusId = context.requestedCounterpartId ?? (context.channelId ? snapshot.focusedCounterpartByChannel[context.channelId] : undefined);
    if (!focusId) return this.rankSnapshot(snapshot, context)[0];
    const state = snapshot.counterparts.find((item) => item.counterpartId === focusId);
    return state ? this.resolveCounterpart(state, context) : this.rankSnapshot(snapshot, context)[0];
  }

  public summarizeSnapshot(snapshot: ChatRelationshipSnapshot): readonly ChatRelationshipSummaryView[] {
    return snapshot.counterparts.map((state) => ({ counterpartId: state.counterpartId, stance: state.stance, objective: state.objective, intensity01: state.intensity01, volatility01: state.volatility01, obsession01: state.vector.obsession01, predictiveConfidence01: state.vector.predictiveConfidence01, unfinishedBusiness01: state.vector.unfinishedBusiness01, respect01: state.vector.respect01, fear01: state.vector.fear01, contempt01: state.vector.contempt01, familiarity01: state.vector.familiarity01, callbackCount: state.callbackHints.length, legacy: buildLegacyProjection(state) })).sort((a, b) => b.intensity01 - a.intensity01 || a.counterpartId.localeCompare(b.counterpartId));
  }

  public inspectEscalation(state: ChatRelationshipCounterpartState, context: RelationshipResolverContext): RivalryEscalationAssessment {
    return this.resolveCounterpart(state, context).escalation.assessment;
  }
}

// MARK: Presets

export const RELATIONSHIP_MODE_PRESET_DEFAULT = Object.freeze({
  mode: 'DEFAULT' as const,
  defaultWitnessCount: 1,
  prefersPublicSwarm: false,
  prefersDelayedReveal: false,
  prefersReceipts: false,
});

export const RELATIONSHIP_MODE_PRESET_SCENE_COMPOSITION = Object.freeze({
  mode: 'SCENE_COMPOSITION' as const,
  defaultWitnessCount: 3,
  prefersPublicSwarm: true,
  prefersDelayedReveal: true,
  prefersReceipts: true,
});

export const RELATIONSHIP_MODE_PRESET_LIVE_REPLY = Object.freeze({
  mode: 'LIVE_REPLY' as const,
  defaultWitnessCount: 2,
  prefersPublicSwarm: false,
  prefersDelayedReveal: false,
  prefersReceipts: true,
});

export const RELATIONSHIP_MODE_PRESET_REPLAY = Object.freeze({
  mode: 'REPLAY' as const,
  defaultWitnessCount: 1,
  prefersPublicSwarm: false,
  prefersDelayedReveal: false,
  prefersReceipts: false,
});

export const RELATIONSHIP_MODE_PRESET_POST_RUN = Object.freeze({
  mode: 'POST_RUN' as const,
  defaultWitnessCount: 3,
  prefersPublicSwarm: true,
  prefersDelayedReveal: true,
  prefersReceipts: true,
});

export const RELATIONSHIP_MODE_PRESET_DEAL_ROOM = Object.freeze({
  mode: 'DEAL_ROOM' as const,
  defaultWitnessCount: 2,
  prefersPublicSwarm: false,
  prefersDelayedReveal: false,
  prefersReceipts: false,
});

export const RELATIONSHIP_MODE_PRESET_RESCUE = Object.freeze({
  mode: 'RESCUE' as const,
  defaultWitnessCount: 1,
  prefersPublicSwarm: false,
  prefersDelayedReveal: false,
  prefersReceipts: false,
});

export const RELATIONSHIP_MODE_PRESET_WORLD_EVENT = Object.freeze({
  mode: 'WORLD_EVENT' as const,
  defaultWitnessCount: 3,
  prefersPublicSwarm: true,
  prefersDelayedReveal: true,
  prefersReceipts: false,
});

export const RELATIONSHIP_OBJECTIVE_NOTES: Readonly<Record<ChatRelationshipObjective, string>> = Object.freeze({
  'HUMILIATE': 'Use public shame, receipts, and witnessed failure framing.',
  'CONTAIN': 'Reduce volatility and keep the player boxed into narrow options.',
  'PROVOKE': 'Invite a bad reply and convert it into transcript leverage.',
  'STUDY': 'Prefer questions, read pressure, and predictive inference.',
  'PRESSURE': 'Sustain heat without overcommitting the counterpart too early.',
  'REPRICE': 'Turn recent player behavior into harsher negotiation terms.',
  'DELAY': 'Use silence, typing theater, and deferred reveals.',
  'WITNESS': 'Frame the moment as observed, archived, and socially meaningful.',
  'RESCUE': 'Interrupt collapse without making the game feel soft.',
  'TEST': 'Probe competence, nerve, or honesty under pressure.',
  'NEGOTIATE': 'Use leverage, not noise, to move terms.',
});

export interface RelationshipEventSemanticProfile {
  readonly eventType: ChatRelationshipEventType;
  readonly prefersHelpers: boolean;
  readonly prefersRivals: boolean;
  readonly prefersWitnesses: boolean;
  readonly suggestsCallback: boolean;
  readonly suggestsSilence: boolean;
}
export const RELATIONSHIP_EVENT_SEMANTICS: Readonly<Record<ChatRelationshipEventType, RelationshipEventSemanticProfile>> = Object.freeze({
  'PLAYER_MESSAGE': { eventType: 'PLAYER_MESSAGE', prefersHelpers: false, prefersRivals: false, prefersWitnesses: false, suggestsCallback: false, suggestsSilence: false },
  'PLAYER_QUESTION': { eventType: 'PLAYER_QUESTION', prefersHelpers: false, prefersRivals: false, prefersWitnesses: false, suggestsCallback: false, suggestsSilence: false },
  'PLAYER_ANGER': { eventType: 'PLAYER_ANGER', prefersHelpers: false, prefersRivals: false, prefersWitnesses: false, suggestsCallback: false, suggestsSilence: false },
  'PLAYER_TROLL': { eventType: 'PLAYER_TROLL', prefersHelpers: false, prefersRivals: true, prefersWitnesses: false, suggestsCallback: false, suggestsSilence: false },
  'PLAYER_FLEX': { eventType: 'PLAYER_FLEX', prefersHelpers: false, prefersRivals: true, prefersWitnesses: false, suggestsCallback: true, suggestsSilence: false },
  'PLAYER_CALM': { eventType: 'PLAYER_CALM', prefersHelpers: false, prefersRivals: false, prefersWitnesses: false, suggestsCallback: false, suggestsSilence: false },
  'PLAYER_HESITATION': { eventType: 'PLAYER_HESITATION', prefersHelpers: false, prefersRivals: false, prefersWitnesses: false, suggestsCallback: false, suggestsSilence: true },
  'PLAYER_DISCIPLINE': { eventType: 'PLAYER_DISCIPLINE', prefersHelpers: false, prefersRivals: false, prefersWitnesses: false, suggestsCallback: false, suggestsSilence: false },
  'PLAYER_GREED': { eventType: 'PLAYER_GREED', prefersHelpers: false, prefersRivals: true, prefersWitnesses: false, suggestsCallback: false, suggestsSilence: false },
  'PLAYER_BLUFF': { eventType: 'PLAYER_BLUFF', prefersHelpers: false, prefersRivals: false, prefersWitnesses: false, suggestsCallback: false, suggestsSilence: false },
  'PLAYER_OVERCONFIDENCE': { eventType: 'PLAYER_OVERCONFIDENCE', prefersHelpers: false, prefersRivals: true, prefersWitnesses: false, suggestsCallback: true, suggestsSilence: false },
  'PLAYER_COMEBACK': { eventType: 'PLAYER_COMEBACK', prefersHelpers: false, prefersRivals: false, prefersWitnesses: true, suggestsCallback: true, suggestsSilence: false },
  'PLAYER_COLLAPSE': { eventType: 'PLAYER_COLLAPSE', prefersHelpers: true, prefersRivals: false, prefersWitnesses: true, suggestsCallback: true, suggestsSilence: false },
  'PLAYER_BREACH': { eventType: 'PLAYER_BREACH', prefersHelpers: true, prefersRivals: false, prefersWitnesses: true, suggestsCallback: true, suggestsSilence: false },
  'PLAYER_PERFECT_DEFENSE': { eventType: 'PLAYER_PERFECT_DEFENSE', prefersHelpers: false, prefersRivals: false, prefersWitnesses: false, suggestsCallback: false, suggestsSilence: false },
  'PLAYER_FAILED_GAMBLE': { eventType: 'PLAYER_FAILED_GAMBLE', prefersHelpers: false, prefersRivals: false, prefersWitnesses: false, suggestsCallback: false, suggestsSilence: false },
  'PLAYER_NEAR_SOVEREIGNTY': { eventType: 'PLAYER_NEAR_SOVEREIGNTY', prefersHelpers: false, prefersRivals: true, prefersWitnesses: true, suggestsCallback: false, suggestsSilence: false },
  'NEGOTIATION_WINDOW': { eventType: 'NEGOTIATION_WINDOW', prefersHelpers: false, prefersRivals: false, prefersWitnesses: false, suggestsCallback: false, suggestsSilence: false },
  'MARKET_ALERT': { eventType: 'MARKET_ALERT', prefersHelpers: false, prefersRivals: false, prefersWitnesses: false, suggestsCallback: false, suggestsSilence: false },
  'BOT_TAUNT_EMITTED': { eventType: 'BOT_TAUNT_EMITTED', prefersHelpers: false, prefersRivals: true, prefersWitnesses: false, suggestsCallback: false, suggestsSilence: false },
  'BOT_RETREAT_EMITTED': { eventType: 'BOT_RETREAT_EMITTED', prefersHelpers: false, prefersRivals: false, prefersWitnesses: false, suggestsCallback: false, suggestsSilence: false },
  'HELPER_RESCUE_EMITTED': { eventType: 'HELPER_RESCUE_EMITTED', prefersHelpers: true, prefersRivals: false, prefersWitnesses: false, suggestsCallback: false, suggestsSilence: false },
  'RIVAL_WITNESS_EMITTED': { eventType: 'RIVAL_WITNESS_EMITTED', prefersHelpers: false, prefersRivals: false, prefersWitnesses: false, suggestsCallback: false, suggestsSilence: false },
  'ARCHIVIST_WITNESS_EMITTED': { eventType: 'ARCHIVIST_WITNESS_EMITTED', prefersHelpers: false, prefersRivals: false, prefersWitnesses: false, suggestsCallback: false, suggestsSilence: false },
  'AMBIENT_WITNESS_EMITTED': { eventType: 'AMBIENT_WITNESS_EMITTED', prefersHelpers: false, prefersRivals: false, prefersWitnesses: false, suggestsCallback: false, suggestsSilence: false },
  'PUBLIC_WITNESS': { eventType: 'PUBLIC_WITNESS', prefersHelpers: false, prefersRivals: false, prefersWitnesses: true, suggestsCallback: false, suggestsSilence: false },
  'PRIVATE_WITNESS': { eventType: 'PRIVATE_WITNESS', prefersHelpers: false, prefersRivals: false, prefersWitnesses: false, suggestsCallback: false, suggestsSilence: true },
  'RUN_START': { eventType: 'RUN_START', prefersHelpers: false, prefersRivals: false, prefersWitnesses: false, suggestsCallback: false, suggestsSilence: true },
  'RUN_END': { eventType: 'RUN_END', prefersHelpers: true, prefersRivals: false, prefersWitnesses: true, suggestsCallback: false, suggestsSilence: false },
});
export const RELATIONSHIP_RESOLVER_NOTE_001 = 'resolver doctrinal note 001: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_002 = 'resolver doctrinal note 002: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_003 = 'resolver doctrinal note 003: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_004 = 'resolver doctrinal note 004: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_005 = 'resolver doctrinal note 005: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_006 = 'resolver doctrinal note 006: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_007 = 'resolver doctrinal note 007: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_008 = 'resolver doctrinal note 008: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_009 = 'resolver doctrinal note 009: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_010 = 'resolver doctrinal note 010: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_011 = 'resolver doctrinal note 011: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_012 = 'resolver doctrinal note 012: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_013 = 'resolver doctrinal note 013: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_014 = 'resolver doctrinal note 014: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_015 = 'resolver doctrinal note 015: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_016 = 'resolver doctrinal note 016: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_017 = 'resolver doctrinal note 017: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_018 = 'resolver doctrinal note 018: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_019 = 'resolver doctrinal note 019: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_020 = 'resolver doctrinal note 020: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_021 = 'resolver doctrinal note 021: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_022 = 'resolver doctrinal note 022: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_023 = 'resolver doctrinal note 023: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_024 = 'resolver doctrinal note 024: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_025 = 'resolver doctrinal note 025: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_026 = 'resolver doctrinal note 026: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_027 = 'resolver doctrinal note 027: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_028 = 'resolver doctrinal note 028: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_029 = 'resolver doctrinal note 029: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_030 = 'resolver doctrinal note 030: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_031 = 'resolver doctrinal note 031: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_032 = 'resolver doctrinal note 032: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_033 = 'resolver doctrinal note 033: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_034 = 'resolver doctrinal note 034: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_035 = 'resolver doctrinal note 035: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_036 = 'resolver doctrinal note 036: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_037 = 'resolver doctrinal note 037: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_038 = 'resolver doctrinal note 038: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_039 = 'resolver doctrinal note 039: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_040 = 'resolver doctrinal note 040: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_041 = 'resolver doctrinal note 041: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_042 = 'resolver doctrinal note 042: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_043 = 'resolver doctrinal note 043: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_044 = 'resolver doctrinal note 044: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_045 = 'resolver doctrinal note 045: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_046 = 'resolver doctrinal note 046: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_047 = 'resolver doctrinal note 047: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_048 = 'resolver doctrinal note 048: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_049 = 'resolver doctrinal note 049: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_050 = 'resolver doctrinal note 050: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_051 = 'resolver doctrinal note 051: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_052 = 'resolver doctrinal note 052: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_053 = 'resolver doctrinal note 053: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_054 = 'resolver doctrinal note 054: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_055 = 'resolver doctrinal note 055: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_056 = 'resolver doctrinal note 056: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_057 = 'resolver doctrinal note 057: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_058 = 'resolver doctrinal note 058: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_059 = 'resolver doctrinal note 059: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_060 = 'resolver doctrinal note 060: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_061 = 'resolver doctrinal note 061: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_062 = 'resolver doctrinal note 062: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_063 = 'resolver doctrinal note 063: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_064 = 'resolver doctrinal note 064: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_065 = 'resolver doctrinal note 065: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_066 = 'resolver doctrinal note 066: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_067 = 'resolver doctrinal note 067: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_068 = 'resolver doctrinal note 068: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_069 = 'resolver doctrinal note 069: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_070 = 'resolver doctrinal note 070: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_071 = 'resolver doctrinal note 071: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_072 = 'resolver doctrinal note 072: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_073 = 'resolver doctrinal note 073: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_074 = 'resolver doctrinal note 074: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_075 = 'resolver doctrinal note 075: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_076 = 'resolver doctrinal note 076: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_077 = 'resolver doctrinal note 077: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_078 = 'resolver doctrinal note 078: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_079 = 'resolver doctrinal note 079: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_080 = 'resolver doctrinal note 080: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_081 = 'resolver doctrinal note 081: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_082 = 'resolver doctrinal note 082: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_083 = 'resolver doctrinal note 083: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_084 = 'resolver doctrinal note 084: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_085 = 'resolver doctrinal note 085: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_086 = 'resolver doctrinal note 086: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_087 = 'resolver doctrinal note 087: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_088 = 'resolver doctrinal note 088: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_089 = 'resolver doctrinal note 089: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_090 = 'resolver doctrinal note 090: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_091 = 'resolver doctrinal note 091: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_092 = 'resolver doctrinal note 092: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_093 = 'resolver doctrinal note 093: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_094 = 'resolver doctrinal note 094: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_095 = 'resolver doctrinal note 095: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_096 = 'resolver doctrinal note 096: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_097 = 'resolver doctrinal note 097: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_098 = 'resolver doctrinal note 098: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_099 = 'resolver doctrinal note 099: preserve relationship continuity, do not flatten authored pressure.';
export const RELATIONSHIP_RESOLVER_NOTE_100 = 'resolver doctrinal note 100: preserve relationship continuity, do not flatten authored pressure.';
