/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT HELPER TRUST POLICY
 * FILE: backend/src/game/engine/chat/memory/HelperTrustPolicy.ts
 * VERSION: 2026.03.18
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend policy that turns relationship memory into helper trust
 * behavior. This file is not a UI comfort layer. It is the backend authority
 * that decides how much a helper trusts the player, how personally a helper may
 * intervene, whether that intervention belongs in public or shadow/private
 * space, when a helper should hold silence instead of speaking, and whether the
 * helper should shield, guide, reframe, debrief, or temporarily step back.
 *
 * This policy complements rivalry logic. Rivalry escalation answers:
 *   "How aggressively should a rival pressure the player right now?"
 *
 * Helper trust answers:
 *   "How personally and how publicly is a helper allowed to invest in the
 *    player right now, given memory, rescue debt, present affect, room mood,
 *    pressure, humiliation risk, and learned receptivity?"
 *
 * Design doctrine
 * ---------------
 * - Does not own transcript mutation.
 * - Does not own room state mutation.
 * - Does not own message fanout or moderation.
 * - Does own deterministic trust interpretation and helper posture selection.
 * - Produces explainable assessments that upstream orchestration can audit.
 * - Preserves the existing repo split between backend authority and frontend
 *   donor experience surfaces.
 * ============================================================================
 */

import type {
  ChatRelationshipCounterpartState,
  ChatRelationshipEventDescriptor,
  ChatRelationshipEventType,
  ChatRelationshipLegacyProjection,
  ChatRelationshipNpcSignal,
  ChatRelationshipPressureBand,
  ChatRelationshipStance,
} from '../../../../../shared/contracts/chat/relationship';
import { clamp01 } from '../../../../../shared/contracts/chat/relationship';

import type {
  ChatAffectSnapshot,
  ChatAudienceHeat,
  ChatChannelId,
  ChatInferenceSnapshot,
  ChatLearningProfile,
  ChatRelationshipState,
  ChatRescueDecision,
  ChatRoomKind,
  ChatRoomStageMood,
  ChatRoomState,
  ChatSignalEnvelope,
  ChatSilenceDecision,
  ChatVisibleChannel,
  Nullable,
  Score01,
  UnixMs,
} from '../types';

// ============================================================================
// MARK: Policy surface
// ============================================================================

export type HelperTrustStage =
  | 'UNKNOWN'
  | 'DISTANT'
  | 'OBSERVING'
  | 'TENTATIVE'
  | 'INVESTED'
  | 'PROTECTIVE'
  | 'DEVOTED';

export type HelperTrustDisposition =
  | 'WITHHOLD'
  | 'WATCH'
  | 'NUDGE'
  | 'GUIDE'
  | 'REASSURE'
  | 'TRIAGE'
  | 'RESCUE'
  | 'DEBRIEF';

export type HelperTrustVisibility =
  | 'DEFER'
  | 'PUBLIC'
  | 'PRIVATE'
  | 'SHADOW';

export type HelperTrustTone =
  | 'CALM'
  | 'BLUNT'
  | 'TACTICAL'
  | 'MENTOR';

export type HelperTrustSuppressionReason =
  | 'LOW_TRUST'
  | 'HIGH_PUBLIC_HUMILIATION'
  | 'ROOM_ALREADY_SILENCED'
  | 'HELPER_BLACKOUT'
  | 'RIVAL_DOMINANCE_WINDOW'
  | 'NEGOTIATION_DECORUM'
  | 'POST_RUN_DISTANCE'
  | 'PLAYER_REJECTING_HELP'
  | 'NONE';

export type HelperTrustTriggerKind =
  | 'PLAYER_MESSAGE'
  | 'HELPER_WINDOW'
  | 'POST_COLLAPSE'
  | 'POST_COMEBACK'
  | 'POST_BREACH'
  | 'NEGOTIATION_WARNING'
  | 'SHIELD_TRIAGE'
  | 'WORLD_EVENT'
  | 'POST_RUN'
  | 'ROOM_ENTRY'
  | 'SILENCE_MAINTENANCE';

export interface HelperTrustContext {
  readonly now: UnixMs;
  readonly mode:
    | 'DEFAULT'
    | 'SCENE_COMPOSITION'
    | 'LIVE_REPLY'
    | 'REPLAY'
    | 'POST_RUN'
    | 'DEAL_ROOM'
    | 'RESCUE'
    | 'WORLD_EVENT';
  readonly trigger: HelperTrustTriggerKind;
  readonly channelId?: Nullable<ChatVisibleChannel>;
  readonly roomId?: Nullable<string>;
  readonly allowPublicSupport: boolean;
  readonly allowPrivateSupport: boolean;
  readonly allowShadowSupport: boolean;
  readonly allowSilenceWindows: boolean;
  readonly allowCallbackUse: boolean;
  readonly allowPublicRecoveryWindows: boolean;
  readonly helperBlackoutActive: boolean;
  readonly rivalDominanceWindowOpen: boolean;
  readonly negotiationWindowOpen: boolean;
  readonly postRunCooldownActive: boolean;
}

export interface HelperTrustRequest {
  readonly state: ChatRelationshipCounterpartState;
  readonly signal: ChatRelationshipNpcSignal;
  readonly legacy: ChatRelationshipLegacyProjection;
  readonly context: HelperTrustContext;
  readonly room?: Nullable<ChatRoomState>;
  readonly relationship?: Nullable<ChatRelationshipState>;
  readonly affect?: Nullable<ChatAffectSnapshot>;
  readonly audienceHeat?: Nullable<ChatAudienceHeat>;
  readonly learning?: Nullable<ChatLearningProfile>;
  readonly inference?: Nullable<ChatInferenceSnapshot>;
  readonly rescue?: Nullable<ChatRescueDecision>;
  readonly silence?: Nullable<ChatSilenceDecision>;
  readonly sourceEvent?: Nullable<ChatRelationshipEventDescriptor>;
  readonly signalEnvelope?: Nullable<ChatSignalEnvelope>;
}

export interface HelperTrustAssessment {
  readonly trustScore01: Score01;
  readonly rescueDebtWeight01: Score01;
  readonly familiarity01: Score01;
  readonly adviceObedience01: Score01;
  readonly publicSafety01: Score01;
  readonly privateNeed01: Score01;
  readonly shadowNeed01: Score01;
  readonly embarrassmentRisk01: Score01;
  readonly frustrationReliefNeed01: Score01;
  readonly intimidationReliefNeed01: Score01;
  readonly timingConfidence01: Score01;
  readonly learningReceptivity01: Score01;
  readonly relationshipContinuity01: Score01;
  readonly silenceValue01: Score01;
  readonly followupValue01: Score01;
  readonly rescueReadiness01: Score01;
  readonly publicStageFit01: Score01;
  readonly privateStageFit01: Score01;
  readonly shadowStageFit01: Score01;
  readonly negotiationDiscipline01: Score01;
  readonly helperVulnerability01: Score01;
  readonly trustStage: HelperTrustStage;
}

export interface HelperTrustDecision {
  readonly selectedDisposition: HelperTrustDisposition;
  readonly selectedVisibility: HelperTrustVisibility;
  readonly selectedTone: HelperTrustTone;
  readonly selectedScore01: Score01;
  readonly shouldIntervene: boolean;
  readonly shouldSuppressRivals: boolean;
  readonly shouldOpenRecoveryWindow: boolean;
  readonly shouldUseCallback: boolean;
  readonly shouldStaySilentFirst: boolean;
  readonly shouldFollowup: boolean;
  readonly shouldProtectPublicImage: boolean;
  readonly shouldPreferSingleLine: boolean;
  readonly preferredChannelId?: ChatVisibleChannel;
  readonly delayMs: number;
  readonly followupDelayMs: number;
  readonly silenceWindowMs: number;
  readonly suppressionReason: HelperTrustSuppressionReason;
  readonly tags: readonly string[];
  readonly notes: readonly string[];
  readonly assessment: HelperTrustAssessment;
}

export interface HelperTrustPolicyConfig {
  readonly watchFloor01: number;
  readonly nudgeFloor01: number;
  readonly guideFloor01: number;
  readonly reassureFloor01: number;
  readonly triageFloor01: number;
  readonly rescueFloor01: number;
  readonly debriefFloor01: number;
  readonly publicSafetyFloor01: number;
  readonly embarrassmentShadowFloor01: number;
  readonly privateNeedFloor01: number;
  readonly silenceValueFloor01: number;
  readonly followupValueFloor01: number;
  readonly callbackFloor01: number;
  readonly learningReceptivityFloor01: number;
  readonly obediencePenaltyFloor01: number;
  readonly rivalrySuppressionFloor01: number;
  readonly stageBiases: Readonly<Record<HelperTrustStage, number>>;
  readonly toneBiasByMood: Readonly<Record<ChatRoomStageMood, HelperTrustTone>>;
  readonly kindPublicBias: Readonly<Record<ChatRoomKind, number>>;
  readonly channelBiases: Readonly<Record<string, number>>;
  readonly pressureBiases: Readonly<Record<ChatRelationshipPressureBand, number>>;
  readonly eventHeat: Readonly<Record<ChatRelationshipEventType, number>>;
}

// ============================================================================
// MARK: Defaults
// ============================================================================

const DEFAULT_STAGE_BIASES: Readonly<Record<HelperTrustStage, number>> = Object.freeze({
  UNKNOWN: 0.10,
  DISTANT: 0.16,
  OBSERVING: 0.24,
  TENTATIVE: 0.36,
  INVESTED: 0.54,
  PROTECTIVE: 0.73,
  DEVOTED: 0.88,
});

const DEFAULT_TONE_BY_MOOD: Readonly<Record<ChatRoomStageMood, HelperTrustTone>> = Object.freeze({
  CALM: 'MENTOR',
  TENSE: 'TACTICAL',
  HOSTILE: 'BLUNT',
  CHAOTIC: 'TACTICAL',
  MOURNFUL: 'CALM',
  ASCENDANT: 'MENTOR',
});

const DEFAULT_KIND_PUBLIC_BIAS: Readonly<Record<ChatRoomKind, number>> = Object.freeze({
  GLOBAL: 0.84,
  SYNDICATE: 0.56,
  DEAL_ROOM: 0.22,
  DIRECT: 0.08,
  SPECTATOR: 0.91,
  SYSTEM: 0.44,
  LOBBY: 0.47,
});

const DEFAULT_CHANNEL_BIASES: Readonly<Record<string, number>> = Object.freeze({
  GLOBAL: 0.83,
  SYNDICATE: 0.58,
  DEAL_ROOM: 0.19,
  DIRECT: 0.06,
  SPECTATOR: 0.88,
  RESCUE_SHADOW: 0.02,
  SYSTEM: 0.41,
});

const DEFAULT_PRESSURE_BIASES: Readonly<Record<ChatRelationshipPressureBand, number>> = Object.freeze({
  LOW: 0.16,
  MEDIUM: 0.33,
  HIGH: 0.61,
  CRITICAL: 0.89,
});

const DEFAULT_EVENT_HEAT: Readonly<Record<ChatRelationshipEventType, number>> = Object.freeze({
  PLAYER_MESSAGE: 0.23,
  PLAYER_QUESTION: 0.18,
  PLAYER_ANGER: 0.47,
  PLAYER_TROLL: 0.39,
  PLAYER_FLEX: 0.41,
  PLAYER_CALM: 0.12,
  PLAYER_HESITATION: 0.35,
  PLAYER_DISCIPLINE: 0.22,
  PLAYER_GREED: 0.36,
  PLAYER_BLUFF: 0.31,
  PLAYER_OVERCONFIDENCE: 0.48,
  PLAYER_COMEBACK: 0.54,
  PLAYER_COLLAPSE: 0.66,
  PLAYER_BREACH: 0.78,
  PLAYER_PERFECT_DEFENSE: 0.42,
  PLAYER_FAILED_GAMBLE: 0.62,
  PLAYER_NEAR_SOVEREIGNTY: 0.58,
  NEGOTIATION_WINDOW: 0.34,
  MARKET_ALERT: 0.29,
  BOT_TAUNT_EMITTED: 0.28,
  BOT_RETREAT_EMITTED: 0.16,
  HELPER_RESCUE_EMITTED: 0.45,
  RIVAL_WITNESS_EMITTED: 0.30,
  ARCHIVIST_WITNESS_EMITTED: 0.17,
  AMBIENT_WITNESS_EMITTED: 0.14,
  PUBLIC_WITNESS: 0.36,
  PRIVATE_WITNESS: 0.17,
  RUN_START: 0.10,
  RUN_END: 0.26,
});

export const DEFAULT_HELPER_TRUST_POLICY_CONFIG: HelperTrustPolicyConfig = Object.freeze({
  watchFloor01: 0.12,
  nudgeFloor01: 0.24,
  guideFloor01: 0.38,
  reassureFloor01: 0.46,
  triageFloor01: 0.60,
  rescueFloor01: 0.74,
  debriefFloor01: 0.52,
  publicSafetyFloor01: 0.48,
  embarrassmentShadowFloor01: 0.57,
  privateNeedFloor01: 0.52,
  silenceValueFloor01: 0.49,
  followupValueFloor01: 0.53,
  callbackFloor01: 0.51,
  learningReceptivityFloor01: 0.32,
  obediencePenaltyFloor01: 0.34,
  rivalrySuppressionFloor01: 0.67,
  stageBiases: DEFAULT_STAGE_BIASES,
  toneBiasByMood: DEFAULT_TONE_BY_MOOD,
  kindPublicBias: DEFAULT_KIND_PUBLIC_BIAS,
  channelBiases: DEFAULT_CHANNEL_BIASES,
  pressureBiases: DEFAULT_PRESSURE_BIASES,
  eventHeat: DEFAULT_EVENT_HEAT,
});

// ============================================================================
// MARK: Small helpers
// ============================================================================

function eventTypeOr(request: HelperTrustRequest): ChatRelationshipEventType {
  return request.sourceEvent?.eventType ?? 'PLAYER_MESSAGE';
}

function pressureBandOr(request: HelperTrustRequest): ChatRelationshipPressureBand {
  return request.sourceEvent?.pressureBand ?? 'MEDIUM';
}

function channelKey(request: HelperTrustRequest): string {
  return (request.context.channelId
    ?? request.room?.activeVisibleChannel
    ?? request.state.lastChannelId
    ?? 'GLOBAL').toUpperCase();
}

function roomKindOr(request: HelperTrustRequest): ChatRoomKind {
  return request.room?.roomKind ?? 'GLOBAL';
}

function moodOr(request: HelperTrustRequest): ChatRoomStageMood {
  return request.room?.stageMood ?? 'TENSE';
}

function boolScore(value: boolean, weight = 1): number {
  return value ? weight : 0;
}

function ratio(value: number, base = 100): number {
  return clamp01(base === 0 ? 0 : value / base);
}

function rescueUrgencyScore(request: HelperTrustRequest): number {
  switch (request.rescue?.urgency ?? 'NONE') {
    case 'CRITICAL': return 0.98;
    case 'HARD': return 0.82;
    case 'MEDIUM': return 0.60;
    case 'SOFT': return 0.34;
    default: return 0;
  }
}

function eventHeatScore(request: HelperTrustRequest, config: HelperTrustPolicyConfig): number {
  return config.eventHeat[eventTypeOr(request)];
}

function pressureScore(request: HelperTrustRequest, config: HelperTrustPolicyConfig): number {
  return config.pressureBiases[pressureBandOr(request)];
}

function audienceHeatScore(request: HelperTrustRequest): number {
  return request.audienceHeat?.heat01 ?? 0.44;
}

function learningReceptivityScore(request: HelperTrustRequest): number {
  return request.learning?.helperReceptivity01
    ?? request.inference?.helperTiming01
    ?? 0.44;
}

function currentTrustFromBackend(request: HelperTrustRequest): number {
  return request.relationship?.trust01
    ?? request.legacy.trust / 100
    ?? 0;
}

function currentRivalryFromBackend(request: HelperTrustRequest): number {
  return request.relationship?.rivalry01
    ?? request.legacy.rivalryIntensity / 100
    ?? 0;
}

function rescueDebt01(request: HelperTrustRequest): number {
  return request.relationship?.rescueDebt01
    ?? request.state.vector.traumaDebt01
    ?? request.legacy.rescueDebt / 100;
}

function familiarity01(request: HelperTrustRequest): number {
  return request.state.vector.familiarity01;
}

function respect01(request: HelperTrustRequest): number {
  return request.state.vector.respect01;
}

function contempt01(request: HelperTrustRequest): number {
  return request.state.vector.contempt01;
}

function patience01(request: HelperTrustRequest): number {
  return request.state.vector.patience01;
}

function unfinishedBusiness01(request: HelperTrustRequest): number {
  return request.state.vector.unfinishedBusiness01;
}

function confidence01(request: HelperTrustRequest): number {
  return request.affect?.confidence01 ?? request.learning?.affect.confidence01 ?? 0.45;
}

function frustration01(request: HelperTrustRequest): number {
  return request.affect?.frustration01 ?? request.learning?.affect.frustration01 ?? 0.30;
}

function intimidation01(request: HelperTrustRequest): number {
  return request.affect?.intimidation01 ?? request.learning?.affect.intimidation01 ?? 0.24;
}

function attachment01(request: HelperTrustRequest): number {
  return request.affect?.attachment01 ?? request.learning?.affect.attachment01 ?? 0.20;
}

function embarrassment01(request: HelperTrustRequest): number {
  return request.affect?.embarrassment01 ?? request.learning?.affect.embarrassment01 ?? 0.18;
}

function relief01(request: HelperTrustRequest): number {
  return request.affect?.relief01 ?? request.learning?.affect.relief01 ?? 0.12;
}

function curiosity01(request: HelperTrustRequest): number {
  return request.affect?.curiosity01 ?? request.learning?.affect.curiosity01 ?? 0.24;
}

function channelAffinity01(request: HelperTrustRequest): number {
  const channel = channelKey(request) as ChatVisibleChannel;
  return request.learning?.channelAffinity[channel]
    ?? request.inference?.channelAffinity[channel]
    ?? 0.44;
}

function helperPersonaLockBonus01(request: HelperTrustRequest): number {
  return request.rescue?.helperPersonaId && request.state.botId && request.rescue.helperPersonaId === request.state.botId
    ? 0.16
    : 0;
}

function learningAgePenalty01(request: HelperTrustRequest): number {
  if (!request.learning) return 0.06;
  return request.learning.coldStart ? 0.09 : 0;
}

function signalHostility01(request: HelperTrustRequest): number {
  return clamp01(
    request.signal.contempt01 * 0.28 +
    request.signal.obsession01 * 0.20 +
    request.signal.unfinishedBusiness01 * 0.20 +
    request.signal.predictiveConfidence01 * 0.12 +
    request.signal.intensity01 * 0.20,
  );
}

function recentSilencePenalty01(request: HelperTrustRequest): number {
  if (!request.silence?.active) return 0;
  return request.silence.reason.startsWith('helper_intervention:') ? 0.11 : 0.06;
}

function negotiationDiscipline01(request: HelperTrustRequest): number {
  const roomIsDeal = roomKindOr(request) === 'DEAL_ROOM' || channelKey(request) === 'DEAL_ROOM';
  const aggression = request.learning?.negotiationAggression01 ?? 0.48;
  const overpay = request.signalEnvelope?.economy?.overpayRisk01 ?? 0;
  const bluff = request.signalEnvelope?.economy?.bluffRisk01 ?? 0;
  return clamp01(
    boolScore(roomIsDeal, 0.26) +
    (1 - aggression) * 0.16 +
    overpay * 0.30 +
    bluff * 0.28,
  );
}

function playerRejectingHelp01(request: HelperTrustRequest): number {
  const obedience = ratio(request.legacy.adviceObedience);
  const helperSusceptibility = request.learning?.helperReceptivity01 ?? 0.44;
  return clamp01((1 - obedience) * 0.62 + (1 - helperSusceptibility) * 0.38);
}

function callbackValue01(request: HelperTrustRequest): number {
  const callback = request.state.callbackHints[0];
  if (!callback) return 0;
  return clamp01(
    callback.weight01 * 0.58 +
    respect01(request) * 0.10 +
    familiarity01(request) * 0.17 +
    unfinishedBusiness01(request) * 0.15,
  );
}

// ============================================================================
// MARK: Trust stage inference
// ============================================================================

export function inferHelperTrustStage(request: HelperTrustRequest): HelperTrustStage {
  const trust = currentTrustFromBackend(request);
  const familiarity = familiarity01(request);
  const respect = respect01(request);
  const debt = rescueDebt01(request);
  const rejection = playerRejectingHelp01(request);

  const score = clamp01(
    trust * 0.28 +
    familiarity * 0.19 +
    respect * 0.18 +
    debt * 0.19 +
    attachment01(request) * 0.07 +
    helperPersonaLockBonus01(request) -
    rejection * 0.14,
  );

  if (score >= 0.82) return 'DEVOTED';
  if (score >= 0.68) return 'PROTECTIVE';
  if (score >= 0.54) return 'INVESTED';
  if (score >= 0.38) return 'TENTATIVE';
  if (score >= 0.24) return 'OBSERVING';
  if (score >= 0.12) return 'DISTANT';
  return 'UNKNOWN';
}

// ============================================================================
// MARK: Assessment primitives
// ============================================================================

export function assessTrustScore01(request: HelperTrustRequest): number {
  const trust = currentTrustFromBackend(request);
  const familiarity = familiarity01(request);
  const respect = respect01(request);
  const debt = rescueDebt01(request);
  const obedience = ratio(request.legacy.adviceObedience);

  return clamp01(
    trust * 0.32 +
    familiarity * 0.18 +
    respect * 0.16 +
    debt * 0.14 +
    obedience * 0.14 +
    attachment01(request) * 0.06 -
    learningAgePenalty01(request),
  );
}

export function assessAdviceObedience01(request: HelperTrustRequest): number {
  return clamp01(
    ratio(request.legacy.adviceObedience) * 0.58 +
    (request.learning?.helperReceptivity01 ?? 0.44) * 0.24 +
    patience01(request) * 0.12 +
    confidence01(request) * 0.06,
  );
}

export function assessPublicSafety01(request: HelperTrustRequest, config: HelperTrustPolicyConfig): number {
  const channelBias = config.channelBiases[channelKey(request)] ?? 0.5;
  const kindBias = config.kindPublicBias[roomKindOr(request)] ?? 0.5;
  const humiliationRisk = assessEmbarrassmentRisk01(request);
  const audience = audienceHeatScore(request);
  const trust = assessTrustScore01(request);
  const rivalry = currentRivalryFromBackend(request);

  return clamp01(
    trust * 0.21 +
    channelBias * 0.18 +
    kindBias * 0.12 +
    (1 - humiliationRisk) * 0.25 +
    (1 - rivalry) * 0.12 +
    (1 - audience * 0.35) * 0.12,
  );
}

export function assessPrivateNeed01(request: HelperTrustRequest): number {
  const humiliationRisk = assessEmbarrassmentRisk01(request);
  const frustration = frustration01(request);
  const intimidation = intimidation01(request);
  const rivalry = currentRivalryFromBackend(request);
  const dealDiscipline = negotiationDiscipline01(request);

  return clamp01(
    humiliationRisk * 0.30 +
    frustration * 0.16 +
    intimidation * 0.16 +
    rivalry * 0.14 +
    dealDiscipline * 0.14 +
    boolScore(channelKey(request) === 'DIRECT', 0.10),
  );
}

export function assessShadowNeed01(request: HelperTrustRequest): number {
  return clamp01(
    assessEmbarrassmentRisk01(request) * 0.34 +
    currentRivalryFromBackend(request) * 0.16 +
    signalHostility01(request) * 0.16 +
    boolScore(request.context.rivalDominanceWindowOpen, 0.14) +
    boolScore(request.context.helperBlackoutActive, 0.04) +
    boolScore(roomKindOr(request) === 'DEAL_ROOM', 0.16),
  );
}

export function assessEmbarrassmentRisk01(request: HelperTrustRequest): number {
  const embarrassment = embarrassment01(request);
  const audience = audienceHeatScore(request);
  const rivalry = currentRivalryFromBackend(request);
  const contempt = contempt01(request);
  const overpay = request.signalEnvelope?.economy?.overpayRisk01 ?? 0;

  return clamp01(
    embarrassment * 0.34 +
    audience * 0.16 +
    rivalry * 0.14 +
    contempt * 0.14 +
    overpay * 0.12 +
    boolScore(channelKey(request) === 'GLOBAL' || channelKey(request) === 'SPECTATOR', 0.10),
  );
}

export function assessFrustrationReliefNeed01(request: HelperTrustRequest): number {
  return clamp01(
    frustration01(request) * 0.48 +
    rescueUrgencyScore(request) * 0.17 +
    (1 - confidence01(request)) * 0.13 +
    pressureScore(request, DEFAULT_HELPER_TRUST_POLICY_CONFIG) * 0.12 +
    boolScore(request.context.trigger === 'POST_COLLAPSE', 0.10),
  );
}

export function assessIntimidationReliefNeed01(request: HelperTrustRequest): number {
  return clamp01(
    intimidation01(request) * 0.52 +
    signalHostility01(request) * 0.17 +
    pressureScore(request, DEFAULT_HELPER_TRUST_POLICY_CONFIG) * 0.15 +
    boolScore(request.context.rivalDominanceWindowOpen, 0.08) +
    boolScore(request.context.trigger === 'POST_BREACH', 0.08),
  );
}

export function assessTimingConfidence01(request: HelperTrustRequest): number {
  const inference = request.inference?.helperTiming01 ?? 0.44;
  const learning = request.learning?.helperReceptivity01 ?? 0.44;
  const eventHeat = eventHeatScore(request, DEFAULT_HELPER_TRUST_POLICY_CONFIG);
  const silencePenalty = recentSilencePenalty01(request);

  return clamp01(
    inference * 0.36 +
    learning * 0.22 +
    (1 - silencePenalty) * 0.16 +
    eventHeat * 0.10 +
    curiosity01(request) * 0.08 +
    patience01(request) * 0.08,
  );
}

export function assessLearningReceptivity01(request: HelperTrustRequest): number {
  return clamp01(
    learningReceptivityScore(request) * 0.54 +
    channelAffinity01(request) * 0.14 +
    assessAdviceObedience01(request) * 0.16 +
    (1 - request.learning?.churnRisk01 ?? 0.56) * 0.08 +
    relief01(request) * 0.08,
  );
}

export function assessRelationshipContinuity01(request: HelperTrustRequest): number {
  const callback = callbackValue01(request);
  return clamp01(
    familiarity01(request) * 0.31 +
    rescueDebt01(request) * 0.19 +
    respect01(request) * 0.13 +
    callback * 0.19 +
    helperPersonaLockBonus01(request) * 0.10 +
    ratio(request.legacy.familiarity) * 0.08,
  );
}

export function assessSilenceValue01(request: HelperTrustRequest): number {
  const shame = assessEmbarrassmentRisk01(request);
  const intimidation = intimidation01(request);
  const rivalry = currentRivalryFromBackend(request);
  const confidence = confidence01(request);
  const audience = audienceHeatScore(request);

  return clamp01(
    shame * 0.26 +
    intimidation * 0.14 +
    rivalry * 0.14 +
    audience * 0.10 +
    (1 - confidence) * 0.08 +
    boolScore(request.context.allowSilenceWindows, 0.10) +
    boolScore(request.context.rivalDominanceWindowOpen, 0.10) +
    boolScore(request.context.trigger === 'POST_COLLAPSE', 0.08),
  );
}

export function assessFollowupValue01(request: HelperTrustRequest): number {
  const rescue = rescueUrgencyScore(request);
  const frustration = frustration01(request);
  const trust = assessTrustScore01(request);
  const continuity = assessRelationshipContinuity01(request);

  return clamp01(
    rescue * 0.22 +
    frustration * 0.18 +
    trust * 0.16 +
    continuity * 0.18 +
    relief01(request) * 0.08 +
    boolScore(request.context.trigger === 'POST_RUN', 0.10) +
    boolScore(request.context.trigger === 'SHIELD_TRIAGE', 0.08),
  );
}

export function assessRescueReadiness01(request: HelperTrustRequest): number {
  return clamp01(
    rescueUrgencyScore(request) * 0.28 +
    rescueDebt01(request) * 0.21 +
    assessTrustScore01(request) * 0.16 +
    assessLearningReceptivity01(request) * 0.13 +
    assessFrustrationReliefNeed01(request) * 0.12 +
    assessIntimidationReliefNeed01(request) * 0.10,
  );
}

export function assessPublicStageFit01(request: HelperTrustRequest, config: HelperTrustPolicyConfig): number {
  const safety = assessPublicSafety01(request, config);
  const audience = audienceHeatScore(request);
  const callback = callbackValue01(request);
  const eventHeat = eventHeatScore(request, config);

  return clamp01(
    safety * 0.38 +
    audience * 0.09 +
    callback * 0.12 +
    eventHeat * 0.07 +
    config.kindPublicBias[roomKindOr(request)] * 0.16 +
    (config.channelBiases[channelKey(request)] ?? 0.5) * 0.18,
  );
}

export function assessPrivateStageFit01(request: HelperTrustRequest): number {
  return clamp01(
    assessPrivateNeed01(request) * 0.42 +
    assessTrustScore01(request) * 0.18 +
    assessLearningReceptivity01(request) * 0.10 +
    boolScore(channelKey(request) === 'DIRECT', 0.18) +
    boolScore(roomKindOr(request) === 'DEAL_ROOM', 0.12),
  );
}

export function assessShadowStageFit01(request: HelperTrustRequest): number {
  return clamp01(
    assessShadowNeed01(request) * 0.48 +
    boolScore(request.context.allowShadowSupport, 0.14) +
    assessSilenceValue01(request) * 0.12 +
    currentRivalryFromBackend(request) * 0.10 +
    signalHostility01(request) * 0.16,
  );
}

export function assessNegotiationDiscipline01(request: HelperTrustRequest): number {
  return negotiationDiscipline01(request);
}

export function assessHelperVulnerability01(request: HelperTrustRequest): number {
  return clamp01(
    (1 - assessTrustScore01(request)) * 0.22 +
    signalHostility01(request) * 0.17 +
    currentRivalryFromBackend(request) * 0.13 +
    assessEmbarrassmentRisk01(request) * 0.13 +
    playerRejectingHelp01(request) * 0.15 +
    boolScore(request.context.helperBlackoutActive, 0.10) +
    boolScore(!request.context.allowPrivateSupport && !request.context.allowShadowSupport, 0.10),
  );
}

// ============================================================================
// MARK: Whole assessment
// ============================================================================

export function assessHelperTrust(
  request: HelperTrustRequest,
  config: HelperTrustPolicyConfig = DEFAULT_HELPER_TRUST_POLICY_CONFIG,
): HelperTrustAssessment {
  const trustScore01 = assessTrustScore01(request);
  const rescueDebtWeight01 = rescueDebt01(request);
  const familiarity = familiarity01(request);
  const adviceObedience01 = assessAdviceObedience01(request);
  const publicSafety01 = assessPublicSafety01(request, config);
  const privateNeed01 = assessPrivateNeed01(request);
  const shadowNeed01 = assessShadowNeed01(request);
  const embarrassmentRisk01 = assessEmbarrassmentRisk01(request);
  const frustrationReliefNeed01 = assessFrustrationReliefNeed01(request);
  const intimidationReliefNeed01 = assessIntimidationReliefNeed01(request);
  const timingConfidence01 = assessTimingConfidence01(request);
  const learningReceptivity01 = assessLearningReceptivity01(request);
  const relationshipContinuity01 = assessRelationshipContinuity01(request);
  const silenceValue01 = assessSilenceValue01(request);
  const followupValue01 = assessFollowupValue01(request);
  const rescueReadiness01 = assessRescueReadiness01(request);
  const publicStageFit01 = assessPublicStageFit01(request, config);
  const privateStageFit01 = assessPrivateStageFit01(request);
  const shadowStageFit01 = assessShadowStageFit01(request);
  const negotiationDiscipline01 = assessNegotiationDiscipline01(request);
  const helperVulnerability01 = assessHelperVulnerability01(request);
  const trustStage = inferHelperTrustStage(request);

  return Object.freeze({
    trustScore01,
    rescueDebtWeight01,
    familiarity01: familiarity,
    adviceObedience01,
    publicSafety01,
    privateNeed01,
    shadowNeed01,
    embarrassmentRisk01,
    frustrationReliefNeed01,
    intimidationReliefNeed01,
    timingConfidence01,
    learningReceptivity01,
    relationshipContinuity01,
    silenceValue01,
    followupValue01,
    rescueReadiness01,
    publicStageFit01,
    privateStageFit01,
    shadowStageFit01,
    negotiationDiscipline01,
    helperVulnerability01,
    trustStage,
  });
}

// ============================================================================
// MARK: Disposition, visibility, tone
// ============================================================================

export function selectDisposition(
  assessment: HelperTrustAssessment,
  request: HelperTrustRequest,
  config: HelperTrustPolicyConfig,
): HelperTrustDisposition {
  if (request.context.trigger === 'POST_RUN' && assessment.trustScore01 >= config.debriefFloor01) {
    return 'DEBRIEF';
  }

  if (assessment.rescueReadiness01 >= config.rescueFloor01) {
    return 'RESCUE';
  }

  if (
    assessment.rescueReadiness01 >= config.triageFloor01
    || request.context.trigger === 'SHIELD_TRIAGE'
    || request.context.trigger === 'POST_BREACH'
  ) {
    return 'TRIAGE';
  }

  if (assessment.frustrationReliefNeed01 >= config.reassureFloor01) {
    return 'REASSURE';
  }

  if (assessment.trustScore01 >= config.guideFloor01 && assessment.learningReceptivity01 >= config.learningReceptivityFloor01) {
    return 'GUIDE';
  }

  if (assessment.trustScore01 >= config.nudgeFloor01) {
    return 'NUDGE';
  }

  if (assessment.trustScore01 >= config.watchFloor01) {
    return 'WATCH';
  }

  return 'WITHHOLD';
}

export function selectVisibility(
  assessment: HelperTrustAssessment,
  request: HelperTrustRequest,
  config: HelperTrustPolicyConfig,
): HelperTrustVisibility {
  if (request.context.helperBlackoutActive) {
    return request.context.allowShadowSupport ? 'SHADOW' : 'DEFER';
  }

  if (
    assessment.embarrassmentRisk01 >= config.embarrassmentShadowFloor01
    || assessment.shadowNeed01 > assessment.publicStageFit01
  ) {
    if (request.context.allowShadowSupport) return 'SHADOW';
    if (request.context.allowPrivateSupport) return 'PRIVATE';
  }

  if (assessment.privateNeed01 >= config.privateNeedFloor01) {
    if (request.context.allowPrivateSupport) return 'PRIVATE';
    if (request.context.allowShadowSupport) return 'SHADOW';
  }

  if (
    request.context.allowPublicSupport
    && assessment.publicSafety01 >= config.publicSafetyFloor01
    && assessment.publicStageFit01 >= assessment.privateStageFit01
    && assessment.publicStageFit01 >= assessment.shadowStageFit01
  ) {
    return 'PUBLIC';
  }

  if (request.context.allowPrivateSupport) return 'PRIVATE';
  if (request.context.allowShadowSupport) return 'SHADOW';
  if (request.context.allowPublicSupport) return 'PUBLIC';
  return 'DEFER';
}

export function selectTone(
  assessment: HelperTrustAssessment,
  request: HelperTrustRequest,
  disposition: HelperTrustDisposition,
  config: HelperTrustPolicyConfig,
): HelperTrustTone {
  if (disposition === 'TRIAGE' || disposition === 'RESCUE') {
    if (assessment.intimidationReliefNeed01 >= 0.62) return 'CALM';
    if (roomKindOr(request) === 'DEAL_ROOM') return 'TACTICAL';
    return 'BLUNT';
  }

  if (disposition === 'DEBRIEF') {
    return 'MENTOR';
  }

  if (disposition === 'GUIDE') {
    return moodOr(request) === 'HOSTILE' ? 'TACTICAL' : 'MENTOR';
  }

  if (disposition === 'REASSURE') {
    return 'CALM';
  }

  if (disposition === 'NUDGE') {
    return config.toneBiasByMood[moodOr(request)];
  }

  if (assessment.negotiationDiscipline01 >= 0.56) {
    return 'TACTICAL';
  }

  return config.toneBiasByMood[moodOr(request)];
}

// ============================================================================
// MARK: Preferred channel
// ============================================================================

export function selectPreferredChannel(
  visibility: HelperTrustVisibility,
  request: HelperTrustRequest,
): ChatVisibleChannel | undefined {
  if (visibility === 'SHADOW') return 'RESCUE_SHADOW' as ChatVisibleChannel;
  if (visibility === 'PRIVATE') return 'DIRECT';
  if (visibility === 'PUBLIC') {
    const channel = channelKey(request);
    if (channel === 'DEAL_ROOM') return 'DEAL_ROOM';
    if (channel === 'SYNDICATE') return 'SYNDICATE';
    if (channel === 'SPECTATOR') return 'SPECTATOR';
    return 'GLOBAL';
  }
  return undefined;
}

// ============================================================================
// MARK: Suppression, callbacks, and timing
// ============================================================================

export function selectSuppressionReason(
  assessment: HelperTrustAssessment,
  request: HelperTrustRequest,
  visibility: HelperTrustVisibility,
  config: HelperTrustPolicyConfig,
): HelperTrustSuppressionReason {
  if (request.context.helperBlackoutActive && visibility === 'DEFER') return 'HELPER_BLACKOUT';
  if (request.context.rivalDominanceWindowOpen && visibility === 'PUBLIC' && assessment.silenceValue01 >= config.silenceValueFloor01) return 'RIVAL_DOMINANCE_WINDOW';
  if (request.context.negotiationWindowOpen && visibility === 'PUBLIC' && roomKindOr(request) === 'DEAL_ROOM') return 'NEGOTIATION_DECORUM';
  if (request.context.postRunCooldownActive && request.context.trigger !== 'POST_RUN') return 'POST_RUN_DISTANCE';
  if (playerRejectingHelp01(request) >= 0.72) return 'PLAYER_REJECTING_HELP';
  if (assessment.embarrassmentRisk01 >= config.embarrassmentShadowFloor01 && visibility === 'PUBLIC') return 'HIGH_PUBLIC_HUMILIATION';
  if (request.silence?.active && request.silence.reason.startsWith('helper_intervention:')) return 'ROOM_ALREADY_SILENCED';
  if (assessment.trustScore01 < config.watchFloor01) return 'LOW_TRUST';
  return 'NONE';
}

export function shouldUseCallback(
  assessment: HelperTrustAssessment,
  request: HelperTrustRequest,
  visibility: HelperTrustVisibility,
  config: HelperTrustPolicyConfig,
): boolean {
  if (!request.context.allowCallbackUse) return false;
  if (callbackValue01(request) < config.callbackFloor01) return false;
  if (visibility === 'PUBLIC' && assessment.embarrassmentRisk01 >= 0.54) return false;
  return assessment.relationshipContinuity01 >= 0.42;
}

export function shouldStaySilentFirst(
  assessment: HelperTrustAssessment,
  request: HelperTrustRequest,
  visibility: HelperTrustVisibility,
  config: HelperTrustPolicyConfig,
): boolean {
  if (!request.context.allowSilenceWindows) return false;
  if (visibility === 'PUBLIC' && request.context.rivalDominanceWindowOpen) return true;
  if (assessment.silenceValue01 < config.silenceValueFloor01) return false;
  if (assessment.rescueReadiness01 >= config.rescueFloor01 && request.context.allowPublicRecoveryWindows) return false;
  return assessment.embarrassmentRisk01 >= 0.36 || assessment.intimidationReliefNeed01 >= 0.46;
}

export function shouldFollowup(
  assessment: HelperTrustAssessment,
  disposition: HelperTrustDisposition,
  config: HelperTrustPolicyConfig,
): boolean {
  if (disposition === 'WATCH' || disposition === 'WITHHOLD') return false;
  if (disposition === 'DEBRIEF') return true;
  return assessment.followupValue01 >= config.followupValueFloor01;
}

export function shouldSuppressRivals(
  assessment: HelperTrustAssessment,
  request: HelperTrustRequest,
  disposition: HelperTrustDisposition,
  config: HelperTrustPolicyConfig,
): boolean {
  if (disposition === 'RESCUE' || disposition === 'TRIAGE') {
    return clamp01(
      assessment.rescueReadiness01 * 0.42 +
      assessment.embarrassmentRisk01 * 0.18 +
      assessment.publicSafety01 * 0.12 +
      boolScore(request.context.rivalDominanceWindowOpen, 0.10) +
      rescueDebt01(request) * 0.18
    ) >= config.rivalrySuppressionFloor01;
  }
  return false;
}

export function shouldOpenRecoveryWindow(
  assessment: HelperTrustAssessment,
  request: HelperTrustRequest,
  disposition: HelperTrustDisposition,
): boolean {
  if (request.rescue?.shouldOpenRecoveryWindow) return true;
  if (disposition === 'RESCUE' || disposition === 'TRIAGE') return true;
  return assessment.frustrationReliefNeed01 >= 0.67 && assessment.learningReceptivity01 >= 0.32;
}

export function shouldPreferSingleLine(
  assessment: HelperTrustAssessment,
  visibility: HelperTrustVisibility,
): boolean {
  return visibility === 'PUBLIC' || assessment.timingConfidence01 < 0.48 || assessment.helperVulnerability01 >= 0.62;
}

export function delayMsFor(
  assessment: HelperTrustAssessment,
  disposition: HelperTrustDisposition,
  visibility: HelperTrustVisibility,
): number {
  const urgency = assessment.rescueReadiness01;
  if (disposition === 'RESCUE') return visibility === 'SHADOW' ? 240 : 420;
  if (disposition === 'TRIAGE') return visibility === 'PUBLIC' ? 540 : 680;
  if (urgency >= 0.74) return 600;
  if (urgency >= 0.58) return 840;
  if (disposition === 'DEBRIEF') return 1_200;
  return visibility === 'PUBLIC' ? 980 : 1_240;
}

export function followupDelayMsFor(
  assessment: HelperTrustAssessment,
  disposition: HelperTrustDisposition,
): number {
  if (disposition === 'DEBRIEF') return 2_600;
  if (assessment.rescueReadiness01 >= 0.74) return 1_800;
  if (assessment.rescueReadiness01 >= 0.58) return 2_300;
  return 3_100;
}

export function silenceWindowMsFor(
  assessment: HelperTrustAssessment,
  request: HelperTrustRequest,
  disposition: HelperTrustDisposition,
): number {
  if (disposition === 'RESCUE') return 2_600;
  if (disposition === 'TRIAGE') return 3_200;
  if (request.context.rivalDominanceWindowOpen) return 4_200;
  if (assessment.silenceValue01 >= 0.74) return 3_800;
  if (assessment.silenceValue01 >= 0.58) return 2_900;
  return 0;
}

// ============================================================================
// MARK: Scoring / decision assembly
// ============================================================================

export function dispositionScore01(
  disposition: HelperTrustDisposition,
  assessment: HelperTrustAssessment,
  request: HelperTrustRequest,
): number {
  switch (disposition) {
    case 'DEBRIEF':
      return clamp01(
        assessment.trustScore01 * 0.22 +
        assessment.relationshipContinuity01 * 0.24 +
        assessment.followupValue01 * 0.19 +
        boolScore(request.context.trigger === 'POST_RUN', 0.25) +
        assessment.learningReceptivity01 * 0.10,
      );
    case 'RESCUE':
      return clamp01(
        assessment.rescueReadiness01 * 0.38 +
        assessment.trustScore01 * 0.18 +
        assessment.frustrationReliefNeed01 * 0.12 +
        assessment.intimidationReliefNeed01 * 0.12 +
        assessment.learningReceptivity01 * 0.10 +
        assessment.publicSafety01 * 0.10,
      );
    case 'TRIAGE':
      return clamp01(
        assessment.rescueReadiness01 * 0.30 +
        assessment.publicSafety01 * 0.11 +
        assessment.privateNeed01 * 0.11 +
        assessment.shadowNeed01 * 0.10 +
        assessment.timingConfidence01 * 0.12 +
        assessment.learningReceptivity01 * 0.10 +
        assessment.trustScore01 * 0.16,
      );
    case 'REASSURE':
      return clamp01(
        assessment.frustrationReliefNeed01 * 0.29 +
        assessment.intimidationReliefNeed01 * 0.18 +
        assessment.trustScore01 * 0.18 +
        assessment.learningReceptivity01 * 0.17 +
        assessment.silenceValue01 * 0.10 +
        assessment.publicSafety01 * 0.08,
      );
    case 'GUIDE':
      return clamp01(
        assessment.trustScore01 * 0.28 +
        assessment.learningReceptivity01 * 0.23 +
        assessment.adviceObedience01 * 0.16 +
        assessment.negotiationDiscipline01 * 0.09 +
        assessment.timingConfidence01 * 0.14 +
        assessment.relationshipContinuity01 * 0.10,
      );
    case 'NUDGE':
      return clamp01(
        assessment.trustScore01 * 0.26 +
        assessment.timingConfidence01 * 0.20 +
        assessment.learningReceptivity01 * 0.18 +
        assessment.publicSafety01 * 0.10 +
        assessment.privateNeed01 * 0.08 +
        assessment.relationshipContinuity01 * 0.18,
      );
    case 'WATCH':
      return clamp01(
        assessment.trustScore01 * 0.18 +
        (1 - assessment.helperVulnerability01) * 0.16 +
        assessment.silenceValue01 * 0.18 +
        assessment.timingConfidence01 * 0.12 +
        assessment.relationshipContinuity01 * 0.16 +
        assessment.learningReceptivity01 * 0.20,
      );
    case 'WITHHOLD':
    default:
      return clamp01(
        (1 - assessment.trustScore01) * 0.18 +
        assessment.helperVulnerability01 * 0.22 +
        playerRejectingHelp01(request) * 0.24 +
        (1 - assessment.learningReceptivity01) * 0.18 +
        recentSilencePenalty01(request) * 0.18,
      );
  }
}

function buildNotes(
  assessment: HelperTrustAssessment,
  request: HelperTrustRequest,
  disposition: HelperTrustDisposition,
  visibility: HelperTrustVisibility,
  tone: HelperTrustTone,
): readonly string[] {
  const notes: string[] = [];

  notes.push(`stage:${assessment.trustStage}`);
  notes.push(`disposition:${disposition}`);
  notes.push(`visibility:${visibility}`);
  notes.push(`tone:${tone}`);
  notes.push(`trigger:${request.context.trigger}`);
  notes.push(`mode:${request.context.mode}`);
  notes.push(`channel:${channelKey(request)}`);
  notes.push(`room_kind:${roomKindOr(request)}`);
  notes.push(`mood:${moodOr(request)}`);

  if (assessment.rescueReadiness01 >= 0.74) notes.push('high_rescue_readiness');
  if (assessment.embarrassmentRisk01 >= 0.58) notes.push('high_embarrassment_risk');
  if (assessment.negotiationDiscipline01 >= 0.54) notes.push('deal_discipline_context');
  if (assessment.relationshipContinuity01 >= 0.52) notes.push('continuity_available');
  if (request.context.rivalDominanceWindowOpen) notes.push('rival_dominance_window');
  if (request.context.helperBlackoutActive) notes.push('helper_blackout_active');
  if (request.rescue?.triggered) notes.push('rescue_requested');
  if (request.sourceEvent?.summary) notes.push(`event:${request.sourceEvent.summary.slice(0, 64)}`);

  return Object.freeze(notes);
}

function buildTags(
  assessment: HelperTrustAssessment,
  request: HelperTrustRequest,
  disposition: HelperTrustDisposition,
  visibility: HelperTrustVisibility,
): readonly string[] {
  const tags = new Set<string>();
  tags.add('helper_trust_policy');
  tags.add(`stage:${assessment.trustStage.toLowerCase()}`);
  tags.add(`disposition:${disposition.toLowerCase()}`);
  tags.add(`visibility:${visibility.toLowerCase()}`);
  tags.add(`trigger:${request.context.trigger.toLowerCase()}`);
  tags.add(`mode:${request.context.mode.toLowerCase()}`);

  if (assessment.rescueReadiness01 >= 0.74) tags.add('rescue_ready');
  if (assessment.followupValue01 >= 0.53) tags.add('followup_candidate');
  if (assessment.silenceValue01 >= 0.49) tags.add('silence_first');
  if (assessment.embarrassmentRisk01 >= 0.57) tags.add('protect_public_image');
  if (assessment.negotiationDiscipline01 >= 0.54) tags.add('dealroom_discipline');
  if (callbackValue01(request) >= 0.51) tags.add('callback_available');
  if (request.context.rivalDominanceWindowOpen) tags.add('rival_pressure_active');

  return Object.freeze([...tags]);
}

// ============================================================================
// MARK: Class
// ============================================================================

export class HelperTrustPolicy {
  public readonly config: HelperTrustPolicyConfig;

  public constructor(config: Partial<HelperTrustPolicyConfig> = {}) {
    this.config = Object.freeze({
      ...DEFAULT_HELPER_TRUST_POLICY_CONFIG,
      ...config,
      stageBiases: Object.freeze({
        ...DEFAULT_HELPER_TRUST_POLICY_CONFIG.stageBiases,
        ...(config.stageBiases ?? {}),
      }),
      toneBiasByMood: Object.freeze({
        ...DEFAULT_HELPER_TRUST_POLICY_CONFIG.toneBiasByMood,
        ...(config.toneBiasByMood ?? {}),
      }),
      kindPublicBias: Object.freeze({
        ...DEFAULT_HELPER_TRUST_POLICY_CONFIG.kindPublicBias,
        ...(config.kindPublicBias ?? {}),
      }),
      channelBiases: Object.freeze({
        ...DEFAULT_HELPER_TRUST_POLICY_CONFIG.channelBiases,
        ...(config.channelBiases ?? {}),
      }),
      pressureBiases: Object.freeze({
        ...DEFAULT_HELPER_TRUST_POLICY_CONFIG.pressureBiases,
        ...(config.pressureBiases ?? {}),
      }),
      eventHeat: Object.freeze({
        ...DEFAULT_HELPER_TRUST_POLICY_CONFIG.eventHeat,
        ...(config.eventHeat ?? {}),
      }),
    });
  }

  public assess(request: HelperTrustRequest): HelperTrustAssessment {
    return assessHelperTrust(request, this.config);
  }

  public decide(request: HelperTrustRequest): HelperTrustDecision {
    const assessment = this.assess(request);
    const disposition = selectDisposition(assessment, request, this.config);
    const visibility = selectVisibility(assessment, request, this.config);
    const tone = selectTone(assessment, request, disposition, this.config);
    const suppressionReason = selectSuppressionReason(assessment, request, visibility, this.config);
    const shouldIntervene =
      disposition !== 'WITHHOLD'
      && visibility !== 'DEFER'
      && suppressionReason !== 'LOW_TRUST'
      && suppressionReason !== 'HELPER_BLACKOUT';
    const shouldSuppressRivalsFlag = shouldIntervene && shouldSuppressRivals(assessment, request, disposition, this.config);
    const openRecoveryWindow = shouldIntervene && shouldOpenRecoveryWindow(assessment, request, disposition);
    const useCallback = shouldIntervene && shouldUseCallback(assessment, request, visibility, this.config);
    const silentFirst = shouldIntervene && shouldStaySilentFirst(assessment, request, visibility, this.config);
    const followup = shouldIntervene && shouldFollowup(assessment, disposition, this.config);
    const protectPublicImage = visibility !== 'PUBLIC' || assessment.embarrassmentRisk01 >= this.config.embarrassmentShadowFloor01;
    const singleLine = shouldPreferSingleLine(assessment, visibility);
    const preferredChannelId = shouldIntervene ? selectPreferredChannel(visibility, request) : undefined;
    const delayMs = shouldIntervene ? delayMsFor(assessment, disposition, visibility) : 0;
    const followupDelayMs = followup ? followupDelayMsFor(assessment, disposition) : 0;
    const silenceWindowMs = silentFirst ? silenceWindowMsFor(assessment, request, disposition) : 0;
    const selectedScore01 = dispositionScore01(disposition, assessment, request);
    const tags = buildTags(assessment, request, disposition, visibility);
    const notes = buildNotes(assessment, request, disposition, visibility, tone);

    return Object.freeze({
      selectedDisposition: disposition,
      selectedVisibility: visibility,
      selectedTone: tone,
      selectedScore01,
      shouldIntervene,
      shouldSuppressRivals: shouldSuppressRivalsFlag,
      shouldOpenRecoveryWindow: openRecoveryWindow,
      shouldUseCallback: useCallback,
      shouldStaySilentFirst: silentFirst,
      shouldFollowup: followup,
      shouldProtectPublicImage: protectPublicImage,
      shouldPreferSingleLine: singleLine,
      preferredChannelId,
      delayMs,
      followupDelayMs,
      silenceWindowMs,
      suppressionReason: shouldIntervene ? 'NONE' : suppressionReason,
      tags,
      notes,
      assessment,
    });
  }
}

// ============================================================================
// MARK: Pure convenience exports
// ============================================================================

export function createHelperTrustPolicy(
  config: Partial<HelperTrustPolicyConfig> = {},
): HelperTrustPolicy {
  return new HelperTrustPolicy(config);
}

export function evaluateHelperTrust(
  request: HelperTrustRequest,
  config: Partial<HelperTrustPolicyConfig> = {},
): HelperTrustDecision {
  return new HelperTrustPolicy(config).decide(request);
}

// ============================================================================
// MARK: Diagnostic helpers
// ============================================================================

export interface HelperTrustDiagnosticRow {
  readonly key: string;
  readonly value01: number;
  readonly note: string;
}

export function toDiagnosticRows(
  decision: HelperTrustDecision,
): readonly HelperTrustDiagnosticRow[] {
  const a = decision.assessment;
  return Object.freeze([
    { key: 'trustScore01', value01: a.trustScore01, note: 'aggregate helper trust toward player' },
    { key: 'rescueDebtWeight01', value01: a.rescueDebtWeight01, note: 'helper debt created by prior rescues' },
    { key: 'familiarity01', value01: a.familiarity01, note: 'relationship familiarity' },
    { key: 'adviceObedience01', value01: a.adviceObedience01, note: 'player tendency to accept helper input' },
    { key: 'publicSafety01', value01: a.publicSafety01, note: 'how safe public help is right now' },
    { key: 'privateNeed01', value01: a.privateNeed01, note: 'how much the situation wants private support' },
    { key: 'shadowNeed01', value01: a.shadowNeed01, note: 'how much the rescue should hide' },
    { key: 'embarrassmentRisk01', value01: a.embarrassmentRisk01, note: 'public humiliation risk' },
    { key: 'frustrationReliefNeed01', value01: a.frustrationReliefNeed01, note: 'need for emotional de-escalation' },
    { key: 'intimidationReliefNeed01', value01: a.intimidationReliefNeed01, note: 'need for calm under threat' },
    { key: 'timingConfidence01', value01: a.timingConfidence01, note: 'confidence that helper timing is correct' },
    { key: 'learningReceptivity01', value01: a.learningReceptivity01, note: 'learned readiness to hear help' },
    { key: 'relationshipContinuity01', value01: a.relationshipContinuity01, note: 'memory continuity / callback readiness' },
    { key: 'silenceValue01', value01: a.silenceValue01, note: 'value of waiting before speaking' },
    { key: 'followupValue01', value01: a.followupValue01, note: 'value of multi-beat helper support' },
    { key: 'rescueReadiness01', value01: a.rescueReadiness01, note: 'global helper rescue readiness' },
    { key: 'publicStageFit01', value01: a.publicStageFit01, note: 'fit for visible intervention' },
    { key: 'privateStageFit01', value01: a.privateStageFit01, note: 'fit for direct/private intervention' },
    { key: 'shadowStageFit01', value01: a.shadowStageFit01, note: 'fit for shadow/rescue lane' },
    { key: 'negotiationDiscipline01', value01: a.negotiationDiscipline01, note: 'deal room caution pressure' },
    { key: 'helperVulnerability01', value01: a.helperVulnerability01, note: 'risk of helper overexposure or rejection' },
    { key: 'selectedScore01', value01: decision.selectedScore01, note: 'final disposition score' },
  ]);
}

// ============================================================================
// MARK: Deterministic policy examples (non-test helpers)
// ============================================================================

export function exampleCriticalRescueRequest(now: UnixMs): HelperTrustRequest {
  const state: ChatRelationshipCounterpartState = {
    counterpartId: 'npc:helper:anchor',
    counterpartKind: 'HELPER',
    playerId: 'player:example',
    botId: 'persona:helper:anchor',
    actorRole: 'HELPER',
    lastChannelId: 'GLOBAL',
    vector: {
      contempt01: 0.02,
      fascination01: 0.38,
      respect01: 0.71,
      fear01: 0.09,
      obsession01: 0.18,
      patience01: 0.64,
      familiarity01: 0.73,
      predictiveConfidence01: 0.58,
      traumaDebt01: 0.62,
      unfinishedBusiness01: 0.18,
    },
    stance: 'PROTECTIVE',
    objective: 'RESCUE',
    intensity01: 0.69,
    volatility01: 0.22,
    publicPressureBias01: 0.18,
    privatePressureBias01: 0.82,
    callbackHints: Object.freeze([
      {
        callbackId: 'cb:anchor:1',
        label: 'shield broke before',
        text: 'Last time you answered too fast after the breach.',
        weight01: 0.66,
      },
    ]),
    eventHistoryTail: Object.freeze([]),
    dominantAxes: Object.freeze(['FAMILIARITY', 'RESPECT', 'TRAUMA_DEBT']),
    lastTouchedAt: now,
  };

  const signal: ChatRelationshipNpcSignal = {
    counterpartId: state.counterpartId,
    stance: state.stance,
    objective: state.objective,
    intensity01: state.intensity01,
    volatility01: state.volatility01,
    selectionWeight01: 0.81,
    publicPressureBias01: state.publicPressureBias01,
    privatePressureBias01: state.privatePressureBias01,
    predictiveConfidence01: state.vector.predictiveConfidence01,
    obsession01: state.vector.obsession01,
    unfinishedBusiness01: state.vector.unfinishedBusiness01,
    respect01: state.vector.respect01,
    fear01: state.vector.fear01,
    contempt01: state.vector.contempt01,
    familiarity01: state.vector.familiarity01,
    callbackHint: state.callbackHints[0],
    notes: state.dominantAxes,
  };

  const legacy: ChatRelationshipLegacyProjection = {
    counterpartId: state.counterpartId,
    respect: 71,
    fear: 9,
    contempt: 2,
    fascination: 38,
    trust: 72,
    familiarity: 73,
    rivalryIntensity: 9,
    rescueDebt: 62,
    adviceObedience: 66,
    escalationTier: 'MILD',
  };

  return Object.freeze({
    state,
    signal,
    legacy,
    context: {
      now,
      mode: 'RESCUE',
      trigger: 'POST_BREACH',
      channelId: 'GLOBAL',
      roomId: 'room:example',
      allowPublicSupport: true,
      allowPrivateSupport: true,
      allowShadowSupport: true,
      allowSilenceWindows: true,
      allowCallbackUse: true,
      allowPublicRecoveryWindows: false,
      helperBlackoutActive: false,
      rivalDominanceWindowOpen: true,
      negotiationWindowOpen: false,
      postRunCooldownActive: false,
    },
    room: {
      roomId: 'room:example',
      roomKind: 'GLOBAL',
      title: 'Example Room',
      createdAt: now,
      lastActivityAt: now,
      activeVisibleChannel: 'GLOBAL',
      allowedVisibleChannels: Object.freeze(['GLOBAL', 'DIRECT', 'RESCUE_SHADOW']),
      stageMood: 'HOSTILE',
      collapsed: false,
      unreadByChannel: Object.freeze({
        GLOBAL: 0,
        SYNDICATE: 0,
        DEAL_ROOM: 0,
        DIRECT: 0,
        SPECTATOR: 0,
      }),
      activeSceneId: null,
      activeMomentId: null,
      activeLegendId: null,
    },
    relationship: {
      id: 'rel:example:helper',
      roomId: 'room:example',
      userId: 'player:example',
      actorId: 'npc:helper:anchor',
      trust01: 0.72,
      fear01: 0.09,
      contempt01: 0.02,
      fascination01: 0.38,
      rivalry01: 0.10,
      rescueDebt01: 0.62,
      updatedAt: now,
    },
    affect: {
      confidence01: 0.18,
      frustration01: 0.84,
      intimidation01: 0.68,
      attachment01: 0.41,
      curiosity01: 0.21,
      embarrassment01: 0.72,
      relief01: 0.09,
    },
    audienceHeat: {
      roomId: 'room:example',
      channelId: 'GLOBAL',
      heat01: 0.88,
      swarmDirection: 'NEGATIVE',
      updatedAt: now,
    },
    learning: {
      userId: 'player:example',
      createdAt: now,
      updatedAt: now,
      coldStart: false,
      engagementBaseline01: 0.62,
      helperReceptivity01: 0.69,
      haterSusceptibility01: 0.48,
      negotiationAggression01: 0.31,
      channelAffinity: Object.freeze({
        GLOBAL: 0.62,
        SYNDICATE: 0.35,
        DEAL_ROOM: 0.22,
        DIRECT: 0.71,
        SPECTATOR: 0.18,
      }),
      rescueHistoryCount: 4,
      churnRisk01: 0.61,
      salienceAnchorIds: Object.freeze([]),
      affect: {
        confidence01: 0.18,
        frustration01: 0.84,
        intimidation01: 0.68,
        attachment01: 0.41,
        curiosity01: 0.21,
        embarrassment01: 0.72,
        relief01: 0.09,
      },
    },
    inference: {
      inferenceId: 'inf:example',
      source: 'HEURISTIC',
      generatedAt: now,
      userId: 'player:example',
      roomId: 'room:example',
      engagement01: 0.52,
      helperTiming01: 0.81,
      haterTargeting01: 0.67,
      channelAffinity: Object.freeze({
        GLOBAL: 0.61,
        SYNDICATE: 0.32,
        DEAL_ROOM: 0.22,
        DIRECT: 0.76,
        SPECTATOR: 0.18,
      }),
      toxicityRisk01: 0.23,
      churnRisk01: 0.61,
      interventionPolicy: 'HARD_HELPER',
    },
    rescue: {
      triggered: true,
      urgency: 'CRITICAL',
      reason: 'breach + embarrassment spike',
      helperPersonaId: 'persona:helper:anchor' as any,
      shouldOpenRecoveryWindow: true,
    },
    silence: null,
    sourceEvent: {
      eventId: 'evt:example',
      eventType: 'PLAYER_BREACH',
      counterpartId: state.counterpartId,
      counterpartKind: 'HELPER',
      playerId: 'player:example',
      botId: 'persona:helper:anchor',
      actorRole: 'HELPER',
      channelId: 'GLOBAL',
      roomId: 'room:example',
      sourceMessageId: null,
      sourcePlanId: null,
      sceneId: null,
      pressureBand: 'CRITICAL',
      publicWitness01: 0.92,
      intensity01: 0.88,
      summary: 'Player suffered a visible breach.',
      rawText: null,
      tags: Object.freeze(['breach', 'public']),
      createdAt: now,
    },
    signalEnvelope: {
      type: 'BATTLE',
      emittedAt: now,
      roomId: 'room:example',
      battle: {
        tickNumber: 100,
        pressureTier: 'CRITICAL' as any,
        activeAttackType: 'SABOTAGE' as any,
        activeBotId: 'BOT_01' as any,
        hostileMomentum: 84 as any,
        rescueWindowOpen: true,
        shieldIntegrity01: 0.09,
        lastAttackAt: now,
      },
      metadata: Object.freeze({}),
    },
  });
}

export function examplePostRunDebriefRequest(now: UnixMs): HelperTrustRequest {
  const req = exampleCriticalRescueRequest(now);
  return Object.freeze({
    ...req,
    context: {
      ...req.context,
      mode: 'POST_RUN',
      trigger: 'POST_RUN',
      rivalDominanceWindowOpen: false,
      allowPublicRecoveryWindows: true,
    },
    rescue: {
      ...req.rescue!,
      urgency: 'SOFT',
      reason: 'post run debrief',
      shouldOpenRecoveryWindow: false,
    },
    sourceEvent: {
      ...req.sourceEvent!,
      eventType: 'RUN_END',
      pressureBand: 'LOW',
      summary: 'Run ended after a difficult collapse sequence.',
    },
  });
}
