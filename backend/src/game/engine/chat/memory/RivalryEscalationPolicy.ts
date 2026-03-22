/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT RIVALRY ESCALATION POLICY
 * FILE: backend/src/game/engine/chat/memory/RivalryEscalationPolicy.ts
 * VERSION: 2026.03.22
 * AUTHORSHIP: Antonio T. Smith Jr. / OpenAI collaboration
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Stateful rivalry escalation doctrine for the backend chat engine.
 *
 * Design goals
 * ------------
 * 1. Preserve the canonical shared relationship contracts.
 * 2. Upgrade rivalry escalation from a scalar calculator into an operational
 *    subsystem with orchestration, replay, diagnostic, and telemetry surfaces.
 * 3. Keep the module self-contained so it can be imported by orchestration
 *    layers, memory barrels, response directors, replay systems, and tests.
 * 4. Ensure every import is genuinely exercised by runtime logic.
 * 5. Provide explicit, typed outputs for every stage of escalation:
 *    assessment -> decision -> action plan -> audit -> replay.
 * ============================================================================
 */

import type {
  ChatRelationshipCounterpartKind,
  ChatRelationshipCounterpartState,
  ChatRelationshipEventDescriptor,
  ChatRelationshipEventType,
  ChatRelationshipLegacyProjection,
  ChatRelationshipNpcSignal,
  ChatRelationshipObjective,
  ChatRelationshipPressureBand,
  ChatRelationshipStance,
  ChatRelationshipVector,
} from '../../../../../../shared/contracts/chat/relationship';
import { clamp01 } from '../../../../../../shared/contracts/chat/relationship';

// ============================================================================
// MARK: Core escalation unions
// ============================================================================

export type RivalryEscalationTier =
  | 'NONE'
  | 'GLARE'
  | 'PROBE'
  | 'PRESSURE'
  | 'HUNT'
  | 'PUBLIC_SWARM'
  | 'BOSS_WINDOW';

export type RivalrySuppressionReason =
  | 'HELPER_PROTECTION'
  | 'LOW_SIGNAL'
  | 'PRIVATE_CONTEXT'
  | 'NEGOTIATION_DECORUM'
  | 'POST_RUN_COOLDOWN'
  | 'REPLAY_ONLY'
  | 'MODE_CEILING'
  | 'PACK_COLLISION'
  | 'BOSS_SLOT_OCCUPIED'
  | 'NONE';

export type RivalryMode =
  | 'DEFAULT'
  | 'SCENE_COMPOSITION'
  | 'LIVE_REPLY'
  | 'REPLAY'
  | 'POST_RUN'
  | 'DEAL_ROOM'
  | 'RESCUE'
  | 'WORLD_EVENT'
  | 'TOURNAMENT'
  | 'ZERO_ENGINE';

export type RivalryCallbackTier = 'NONE' | 'LIGHT' | 'MODERATE' | 'HARD' | 'RECEIPT';
export type RivalryPackRole = 'POINT' | 'PRESSURE' | 'FLANK' | 'RECEIPT_CLOSER';
export type RivalryGracefulExitStyle = 'DIGNIFIED_WITHDRAWAL' | 'TACTICAL_RETREAT' | 'NONE';
export type RivalryEntranceStyle = 'DRAMATIC_PUBLIC' | 'COLD_PRIVATE';
export type RivalryOpeningMoveType = 'RECEIPT_BARRAGE' | 'PSYCHOLOGICAL_PROBE' | 'SILENCE_THEN_STRIKE';
export type RivalrySuppressionMethod = 'SHADOW' | 'REASSIGN' | 'DEFER' | 'MUTE_HELPERS' | 'DECORUM' | 'NONE';
export type RivalryActionType =
  | 'WAIT'
  | 'SETUP_GLARE'
  | 'ASK_PROBING_QUESTION'
  | 'DEPLOY_CALLBACK'
  | 'FORCE_WITNESS'
  | 'DELAY_REVEAL'
  | 'OPEN_ATTACK_WINDOW'
  | 'SUPPRESS_HELPERS'
  | 'RESERVE_BOSS_SLOT'
  | 'RETREAT'
  | 'REGROUP'
  | 'STAMP_AUDIT'
  | 'EMIT_TELEMETRY'
  | 'QUOTE_PLAYER_BACK'
  | 'HOLD_SILENCE';
export type RivalryAnomalyType =
  | 'HEAT_WITHOUT_SCORE'
  | 'SWARM_WITHOUT_WITNESSES'
  | 'BOSS_WITH_DECORUM'
  | 'HELPER_SUPPRESSION_CONTRADICTION'
  | 'PACK_COLLISION'
  | 'STALE_STATE'
  | 'RECEIPT_WITHOUT_CALLBACK'
  | 'NONE';

// ============================================================================
// MARK: Core request/response contracts
// ============================================================================

export interface RivalryEscalationContext {
  readonly now: number;
  readonly channelId?: string | null;
  readonly roomId?: string | null;
  readonly pressureBand: ChatRelationshipPressureBand;
  readonly mode: RivalryMode;
  readonly sourceEvent?: ChatRelationshipEventDescriptor | null;
  readonly allowPublicSwarm: boolean;
  readonly rescueWindowOpen: boolean;
  readonly negotiationWindowOpen: boolean;
  readonly allowDelayedReveal: boolean;
  readonly allowReceipts: boolean;
  readonly maxWitnessCount?: number;
  readonly activeRivalCount?: number;
  readonly audienceHeat01?: number;
  readonly modeId?: string | null;
  readonly personaId?: string | null;
}

export interface RivalryEscalationCallbackInput {
  readonly tier: RivalryCallbackTier;
  readonly callbackId?: string;
  readonly label?: string;
  readonly text?: string;
  readonly suitability01: number;
  readonly humiliationRisk01: number;
  readonly witnessValue01: number;
  readonly safeForPublic: boolean;
}

export interface RivalryEscalationRequest {
  readonly state: ChatRelationshipCounterpartState;
  readonly signal: ChatRelationshipNpcSignal;
  readonly legacy: ChatRelationshipLegacyProjection;
  readonly context: RivalryEscalationContext;
  readonly callback: RivalryEscalationCallbackInput;
}

export interface RivalryEscalationAssessment {
  readonly hostility01: number;
  readonly rivalry01: number;
  readonly publicStageFit01: number;
  readonly privateStageFit01: number;
  readonly obsessionHeat01: number;
  readonly witnessMagnet01: number;
  readonly rescueCounterweight01: number;
  readonly humiliationValue01: number;
  readonly negotiationDiscipline01: number;
  readonly cooldown01: number;
  readonly bossFightReadiness01: number;
  readonly silenceValue01: number;
  readonly helperSuppressionValue01: number;
  readonly packPotential01: number;
  readonly spectacleRisk01: number;
  readonly counterpartKindBias01: number;
  readonly objectiveBias01: number;
  readonly prestigeGravity01: number;
}

export interface RivalryAttackWindow {
  readonly open: boolean;
  readonly startsInMs: number;
  readonly durationMs: number;
  readonly shouldTelegraph: boolean;
  readonly telegraphStrength01: number;
  readonly revealDelayMs: number;
}

export interface RivalryWitnessPlan {
  readonly shouldForcePublicWitness: boolean;
  readonly preferredWitnessCount: number;
  readonly witnessMagnet01: number;
  readonly witnessReason: string;
  readonly preferredChannels: readonly string[];
}

export interface RivalryReceiptPlan {
  readonly shouldUseCallback: boolean;
  readonly shouldQuotePlayerBack: boolean;
  readonly callbackTier: RivalryCallbackTier;
  readonly callbackId?: string;
  readonly callbackLabel?: string;
  readonly callbackText?: string;
  readonly receiptWindowMs: number;
  readonly receiptValue01: number;
}

export interface RivalrySilencePlan {
  readonly shouldPreferSilence: boolean;
  readonly shouldDelayReveal: boolean;
  readonly silenceValue01: number;
  readonly revealDelayMs: number;
  readonly silenceReason: string;
}

export interface RivalrySuppressionPlan {
  readonly shouldSuppressHelpers: boolean;
  readonly method: RivalrySuppressionMethod;
  readonly suppressionStrength01: number;
  readonly reason: RivalrySuppressionReason;
  readonly durationMs: number;
}

export interface RivalryThreatFingerprint {
  readonly counterpartId: string;
  readonly counterpartKind: ChatRelationshipCounterpartKind;
  readonly stance: ChatRelationshipStance;
  readonly objective: ChatRelationshipObjective;
  readonly dominantAxes: readonly string[];
  readonly heatSignature01: number;
  readonly obsessionSignature01: number;
  readonly publicThreat01: number;
  readonly privateThreat01: number;
}

export interface RivalryCadenceWindow {
  readonly cadenceMs: number;
  readonly paceMultiplier: number;
  readonly tempoLabel: 'COLD' | 'MEASURED' | 'TENSE' | 'VIOLENT';
  readonly nextActionEtaMs: number;
}

export interface RivalryEscalationDecision {
  readonly selectedTier: RivalryEscalationTier;
  readonly selectedScore01: number;
  readonly shadowHeat01: number;
  readonly publicEmbarrassment01: number;
  readonly shouldUseCallback: boolean;
  readonly shouldQuotePlayerBack: boolean;
  readonly shouldPreferSilence: boolean;
  readonly shouldDelayReveal: boolean;
  readonly shouldSuppressHelpers: boolean;
  readonly shouldForcePublicWitness: boolean;
  readonly shouldEscalateToBossFight: boolean;
  readonly preferredWitnessCount: number;
  readonly suppressionReason: RivalrySuppressionReason;
  readonly attackWindow: RivalryAttackWindow;
  readonly tags: readonly string[];
  readonly notes: readonly string[];
  readonly assessment: RivalryEscalationAssessment;
  readonly witnessPlan: RivalryWitnessPlan;
  readonly receiptPlan: RivalryReceiptPlan;
  readonly silencePlan: RivalrySilencePlan;
  readonly suppressionPlan: RivalrySuppressionPlan;
  readonly threatFingerprint: RivalryThreatFingerprint;
  readonly cadenceWindow: RivalryCadenceWindow;
}

export interface RivalryEscalationPolicyConfig {
  readonly glareFloor01: number;
  readonly probeFloor01: number;
  readonly pressureFloor01: number;
  readonly huntFloor01: number;
  readonly publicSwarmFloor01: number;
  readonly bossWindowFloor01: number;
  readonly rescueSuppressionFloor01: number;
  readonly delayedRevealFloor01: number;
  readonly callbackPublicFloor01: number;
  readonly humiliationReceiptFloor01: number;
  readonly negotiationDisciplineFloor01: number;
  readonly cooldownPenalty01: number;
  readonly maxHistoryEntries: number;
  readonly maxAuditEntries: number;
  readonly maxBossReservations: number;
  readonly maxPackTracks: number;
  readonly baseAttackCadenceMs: number;
  readonly stanceBiases: Readonly<Record<ChatRelationshipStance, number>>;
  readonly channelBiases: Readonly<Record<string, number>>;
  readonly pressureBiases: Readonly<Record<ChatRelationshipPressureBand, number>>;
  readonly eventHeat: Readonly<Record<ChatRelationshipEventType, number>>;
  readonly eventPublicness: Readonly<Record<ChatRelationshipEventType, number>>;
  readonly eventHostility: Readonly<Record<ChatRelationshipEventType, number>>;
  readonly eventPrestige: Readonly<Record<ChatRelationshipEventType, number>>;
  readonly counterpartKindBiases: Readonly<Record<ChatRelationshipCounterpartKind, number>>;
  readonly objectiveBiases: Readonly<Record<ChatRelationshipObjective, number>>;
}

// ============================================================================
// MARK: Extended operational contracts
// ============================================================================

export interface RivalryStateMachineState {
  readonly currentTier: RivalryEscalationTier;
  readonly previousTier: RivalryEscalationTier;
  readonly enteredAt: number;
  readonly timeInTierMs: number;
  readonly transitionCount: number;
  readonly lastTransitionAt: number;
  readonly isValidState: boolean;
}

export interface RivalryStateTransitionResult {
  readonly success: boolean;
  readonly fromTier: RivalryEscalationTier;
  readonly toTier: RivalryEscalationTier;
  readonly reason: string;
  readonly timestamp: number;
}

export interface RivalryEscalationPrediction {
  readonly predictedTier: RivalryEscalationTier;
  readonly estimatedTicksUntil: number;
  readonly confidence01: number;
  readonly triggerConditions: readonly string[];
}

export interface PackHuntRole {
  readonly counterpartId: string;
  readonly packRole: RivalryPackRole;
  readonly escalationScore01: number;
}

export interface PackHuntAssessment {
  readonly canFormPack: boolean;
  readonly reason: string;
  readonly packSize: number;
  readonly roles: readonly PackHuntRole[];
  readonly pressureBudget01: number;
  readonly witnessDemand: number;
}

export interface DeEscalationDecision {
  readonly shouldRetreat: boolean;
  readonly shouldRegroup: boolean;
  readonly shouldConcede: boolean;
  readonly retreatReason: string;
  readonly suggestedCooldownMs: number;
  readonly gracefulExitStyle: RivalryGracefulExitStyle;
}

export interface BossFightComposition {
  readonly bossFightId: string;
  readonly counterpartId: string;
  readonly entranceStyle: RivalryEntranceStyle;
  readonly openingMoveType: RivalryOpeningMoveType;
  readonly preferredWitnessCount: number;
  readonly helperSuppressionDurationMs: number;
  readonly resolutionConditions: readonly string[];
  readonly estimatedDurationMs: number;
  readonly maxEscalationBudget: number;
  readonly requiredChannel: string;
  readonly requiredPressureBand: ChatRelationshipPressureBand;
}

export interface RivalryEscalationAuditEntry {
  readonly auditId: string;
  readonly counterpartId: string;
  readonly inputHostility01: number;
  readonly inputRivalry01: number;
  readonly inputIntensity01: number;
  readonly selectedTier: RivalryEscalationTier;
  readonly selectedScore01: number;
  readonly suppressionReason: RivalrySuppressionReason;
  readonly shouldUseCallback: boolean;
  readonly shouldQuotePlayerBack: boolean;
  readonly shouldPreferSilence: boolean;
  readonly attackWindowOpen: boolean;
  readonly timestamp: number;
  readonly contextMode: RivalryMode;
  readonly contextPressureBand: ChatRelationshipPressureBand;
  readonly tags: readonly string[];
}

export interface RivalPersonalityEscalationProfile {
  readonly personaId: string;
  readonly label: string;
  readonly preferredTierProgression: readonly RivalryEscalationTier[];
  readonly skipsTiers: boolean;
  readonly prefersSilenceBeforeStrike: boolean;
  readonly attackTimingBias01: number;
  readonly receiptPreference01: number;
  readonly humiliationPreference01: number;
  readonly psychologicalPreference01: number;
  readonly deEscalationResistance01: number;
  readonly publicStageBias01: number;
  readonly signatureOpeningStyle: string;
  readonly retreatCondition: string;
  readonly escalationPaceMs: number;
}

export interface ModeEscalationProfile {
  readonly modeId: string;
  readonly label: string;
  readonly maxSimultaneousRivals: number;
  readonly publicSwarmAllowed: boolean;
  readonly escalationPaceMultiplier: number;
  readonly silenceEmphasis01: number;
  readonly dealRoomEscalation: boolean;
  readonly teamCoordination: boolean;
  readonly preferredTierCeiling: RivalryEscalationTier;
  readonly witnessAmplification01: number;
}

export interface RivalryEscalationHistoryEntry {
  readonly timestamp: number;
  readonly tier: RivalryEscalationTier;
  readonly score01: number;
  readonly suppressed: boolean;
  readonly usedCallback: boolean;
  readonly publicEmbarrassment01: number;
  readonly cadenceMs: number;
}

export interface RivalryDiagnosticReport {
  readonly counterpartId: string;
  readonly currentStateMachineTier: RivalryEscalationTier;
  readonly decisionTier: RivalryEscalationTier;
  readonly decisionScore01: number;
  readonly assessmentHostility01: number;
  readonly assessmentRivalry01: number;
  readonly assessmentObsessionHeat01: number;
  readonly assessmentBossFightReadiness01: number;
  readonly suppressionReason: RivalrySuppressionReason;
  readonly attackWindowOpen: boolean;
  readonly shouldUseCallback: boolean;
  readonly shouldQuotePlayerBack: boolean;
  readonly deEscalationAdvised: boolean;
  readonly deEscalationReason: string;
  readonly personaId?: string;
  readonly personaLabel?: string;
  readonly personaReceiptPreference01?: number;
  readonly transitionCount: number;
  readonly contextMode: RivalryMode;
  readonly contextPressureBand: ChatRelationshipPressureBand;
  readonly cadenceLabel: RivalryCadenceWindow['tempoLabel'];
}

export interface RivalryCounterpartExposure {
  readonly counterpartId: string;
  readonly exposure01: number;
  readonly publicExposure01: number;
  readonly privateExposure01: number;
  readonly instability01: number;
}

export interface RivalryTrajectorySnapshot {
  readonly counterpartId: string;
  readonly timestamp: number;
  readonly tier: RivalryEscalationTier;
  readonly score01: number;
  readonly hostility01: number;
  readonly rivalry01: number;
  readonly publicStageFit01: number;
  readonly privateStageFit01: number;
  readonly pressureBand: ChatRelationshipPressureBand;
}

export interface RivalryScenarioDescriptor {
  readonly channelId: string;
  readonly pressureBand: ChatRelationshipPressureBand;
  readonly publicBias01: number;
  readonly pressureBias01: number;
}

export interface RivalryChannelProfile {
  readonly channelId: string;
  readonly description: string;
  readonly publicGravity01: number;
  readonly decorum01: number;
  readonly spectacleBias01: number;
  readonly silenceBias01: number;
}

export interface RivalryOrchestrationAction {
  readonly actionType: RivalryActionType;
  readonly counterpartId: string;
  readonly priority01: number;
  readonly executeAfterMs: number;
  readonly payload: Readonly<Record<string, string | number | boolean | null | readonly string[]>>;
}

export interface RivalryOrchestrationPlan {
  readonly counterpartId: string;
  readonly selectedTier: RivalryEscalationTier;
  readonly actions: readonly RivalryOrchestrationAction[];
  readonly totalPriority01: number;
  readonly estimatedCompletionMs: number;
  readonly witnessPlan: RivalryWitnessPlan;
  readonly receiptPlan: RivalryReceiptPlan;
  readonly silencePlan: RivalrySilencePlan;
  readonly suppressionPlan: RivalrySuppressionPlan;
}

export interface RivalryDecisionEnvelope {
  readonly counterpartId: string;
  readonly decision: RivalryEscalationDecision;
  readonly orchestration: RivalryOrchestrationPlan;
  readonly audit: RivalryEscalationAuditEntry;
  readonly telemetry: RivalryTelemetryFrame;
  readonly replay: RivalryReplayFrame;
  readonly anomalies: readonly RivalryAnomalySignal[];
  readonly stateTransition: RivalryStateTransitionResult;
}

export interface RivalryTelemetryFrame {
  readonly counterpartId: string;
  readonly channelId: string;
  readonly mode: RivalryMode;
  readonly selectedTier: RivalryEscalationTier;
  readonly score01: number;
  readonly hostility01: number;
  readonly rivalry01: number;
  readonly spectacleRisk01: number;
  readonly witnessDemand: number;
  readonly tags: readonly string[];
}

export interface RivalryReplayFrame {
  readonly counterpartId: string;
  readonly timestamp: number;
  readonly tier: RivalryEscalationTier;
  readonly notes: readonly string[];
  readonly actions: readonly string[];
}

export interface RivalryBossWindowReservation {
  readonly reservationId: string;
  readonly counterpartId: string;
  readonly channelId: string;
  readonly reservedAt: number;
  readonly expiresAt: number;
}

export interface RivalryPackTrack {
  readonly trackId: string;
  readonly createdAt: number;
  readonly counterpartIds: readonly string[];
  readonly leadCounterpartId: string;
  readonly witnessDemand: number;
  readonly pressureBudget01: number;
}

export interface RivalryAnomalySignal {
  readonly type: RivalryAnomalyType;
  readonly severity01: number;
  readonly description: string;
}

export interface RivalryEventPreset {
  readonly eventType: ChatRelationshipEventType;
  readonly severity01: number;
  readonly publicness01: number;
  readonly hostility01: number;
  readonly prestige01: number;
}

export interface RivalryTierNarrativeNote {
  readonly tier: RivalryEscalationTier;
  readonly note: string;
}

// ============================================================================
// MARK: Static doctrine tables
// ============================================================================

const DEFAULT_STANCE_BIASES: Readonly<Record<ChatRelationshipStance, number>> = Object.freeze({
  DISMISSIVE: 0.08,
  CLINICAL: 0.17,
  PROBING: 0.32,
  PREDATORY: 0.54,
  HUNTING: 0.72,
  OBSESSED: 0.88,
  RESPECTFUL: 0.21,
  WOUNDED: 0.28,
  PROTECTIVE: 0.14,
  CURIOUS: 0.19,
});

const DEFAULT_CHANNEL_BIASES: Readonly<Record<string, number>> = Object.freeze({
  GLOBAL: 0.90,
  SYNDICATE: 0.65,
  DEAL_ROOM: 0.40,
  DIRECT: 0.25,
  SPECTATOR: 0.90,
  SYSTEM: 0.10,
});

const DEFAULT_PRESSURE_BIASES: Readonly<Record<ChatRelationshipPressureBand, number>> = Object.freeze({
  LOW: 0.12,
  MEDIUM: 0.33,
  HIGH: 0.63,
  CRITICAL: 0.91,
});

const DEFAULT_EVENT_HEAT: Readonly<Record<ChatRelationshipEventType, number>> = Object.freeze({
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

const DEFAULT_EVENT_PUBLICNESS: Readonly<Record<ChatRelationshipEventType, number>> = Object.freeze({
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

const DEFAULT_EVENT_HOSTILITY: Readonly<Record<ChatRelationshipEventType, number>> = Object.freeze({
  'PLAYER_MESSAGE': 0.12,
  'PLAYER_QUESTION': 0.07,
  'PLAYER_ANGER': 0.63,
  'PLAYER_TROLL': 0.79,
  'PLAYER_FLEX': 0.74,
  'PLAYER_CALM': 0.02,
  'PLAYER_HESITATION': 0.10,
  'PLAYER_DISCIPLINE': 0.11,
  'PLAYER_GREED': 0.35,
  'PLAYER_BLUFF': 0.29,
  'PLAYER_OVERCONFIDENCE': 0.58,
  'PLAYER_COMEBACK': 0.44,
  'PLAYER_COLLAPSE': 0.18,
  'PLAYER_BREACH': 0.50,
  'PLAYER_PERFECT_DEFENSE': 0.31,
  'PLAYER_FAILED_GAMBLE': 0.23,
  'PLAYER_NEAR_SOVEREIGNTY': 0.69,
  'NEGOTIATION_WINDOW': 0.17,
  'MARKET_ALERT': 0.09,
  'BOT_TAUNT_EMITTED': 0.46,
  'BOT_RETREAT_EMITTED': 0.12,
  'HELPER_RESCUE_EMITTED': 0.03,
  'RIVAL_WITNESS_EMITTED': 0.26,
  'ARCHIVIST_WITNESS_EMITTED': 0.00,
  'AMBIENT_WITNESS_EMITTED': 0.05,
  'PUBLIC_WITNESS': 0.21,
  'PRIVATE_WITNESS': 0.04,
  'RUN_START': 0.00,
  'RUN_END': 0.14,
});

const DEFAULT_EVENT_PRESTIGE: Readonly<Record<ChatRelationshipEventType, number>> = Object.freeze({
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
  'BOT_TAUNT_EMITTED': 0.20,
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

const DEFAULT_COUNTERPART_KIND_BIASES: Readonly<Record<ChatRelationshipCounterpartKind, number>> = Object.freeze({
  'NPC': 0.48,
  'BOT': 0.56,
  'HELPER': 0.18,
  'RIVAL': 0.92,
  'ARCHIVIST': 0.31,
  'AMBIENT': 0.14,
  'SYSTEM': 0.08,
});

const DEFAULT_OBJECTIVE_BIASES: Readonly<Record<ChatRelationshipObjective, number>> = Object.freeze({
  'HUMILIATE': 0.88,
  'CONTAIN': 0.52,
  'PROVOKE': 0.73,
  'STUDY': 0.44,
  'PRESSURE': 0.61,
  'REPRICE': 0.57,
  'DELAY': 0.38,
  'WITNESS': 0.49,
  'RESCUE': 0.16,
  'TEST': 0.41,
  'NEGOTIATE': 0.22,
});

export const DEFAULT_RIVALRY_ESCALATION_POLICY_CONFIG: RivalryEscalationPolicyConfig = Object.freeze({
  glareFloor01: 0.18,
  probeFloor01: 0.29,
  pressureFloor01: 0.44,
  huntFloor01: 0.59,
  publicSwarmFloor01: 0.72,
  bossWindowFloor01: 0.84,
  rescueSuppressionFloor01: 0.57,
  delayedRevealFloor01: 0.53,
  callbackPublicFloor01: 0.49,
  humiliationReceiptFloor01: 0.67,
  negotiationDisciplineFloor01: 0.54,
  cooldownPenalty01: 0.18,
  maxHistoryEntries: 128,
  maxAuditEntries: 256,
  maxBossReservations: 8,
  maxPackTracks: 24,
  baseAttackCadenceMs: 1800,
  stanceBiases: DEFAULT_STANCE_BIASES,
  channelBiases: DEFAULT_CHANNEL_BIASES,
  pressureBiases: DEFAULT_PRESSURE_BIASES,
  eventHeat: DEFAULT_EVENT_HEAT,
  eventPublicness: DEFAULT_EVENT_PUBLICNESS,
  eventHostility: DEFAULT_EVENT_HOSTILITY,
  eventPrestige: DEFAULT_EVENT_PRESTIGE,
  counterpartKindBiases: DEFAULT_COUNTERPART_KIND_BIASES,
  objectiveBiases: DEFAULT_OBJECTIVE_BIASES,
});

export const RIVALRY_EVENT_PRESETS: Readonly<Record<ChatRelationshipEventType, RivalryEventPreset>> = Object.freeze({
  'PLAYER_MESSAGE': {
    eventType: 'PLAYER_MESSAGE',
    severity01: 0.26,
    publicness01: 0.42,
    hostility01: 0.12,
    prestige01: 0.16,
  },
  'PLAYER_QUESTION': {
    eventType: 'PLAYER_QUESTION',
    severity01: 0.24,
    publicness01: 0.34,
    hostility01: 0.07,
    prestige01: 0.14,
  },
  'PLAYER_ANGER': {
    eventType: 'PLAYER_ANGER',
    severity01: 0.54,
    publicness01: 0.77,
    hostility01: 0.63,
    prestige01: 0.36,
  },
  'PLAYER_TROLL': {
    eventType: 'PLAYER_TROLL',
    severity01: 0.58,
    publicness01: 0.82,
    hostility01: 0.79,
    prestige01: 0.33,
  },
  'PLAYER_FLEX': {
    eventType: 'PLAYER_FLEX',
    severity01: 0.61,
    publicness01: 0.86,
    hostility01: 0.74,
    prestige01: 0.41,
  },
  'PLAYER_CALM': {
    eventType: 'PLAYER_CALM',
    severity01: 0.19,
    publicness01: 0.31,
    hostility01: 0.02,
    prestige01: 0.11,
  },
  'PLAYER_HESITATION': {
    eventType: 'PLAYER_HESITATION',
    severity01: 0.33,
    publicness01: 0.38,
    hostility01: 0.10,
    prestige01: 0.09,
  },
  'PLAYER_DISCIPLINE': {
    eventType: 'PLAYER_DISCIPLINE',
    severity01: 0.42,
    publicness01: 0.44,
    hostility01: 0.11,
    prestige01: 0.48,
  },
  'PLAYER_GREED': {
    eventType: 'PLAYER_GREED',
    severity01: 0.57,
    publicness01: 0.66,
    hostility01: 0.35,
    prestige01: 0.18,
  },
  'PLAYER_BLUFF': {
    eventType: 'PLAYER_BLUFF',
    severity01: 0.52,
    publicness01: 0.71,
    hostility01: 0.29,
    prestige01: 0.37,
  },
  'PLAYER_OVERCONFIDENCE': {
    eventType: 'PLAYER_OVERCONFIDENCE',
    severity01: 0.68,
    publicness01: 0.85,
    hostility01: 0.58,
    prestige01: 0.34,
  },
  'PLAYER_COMEBACK': {
    eventType: 'PLAYER_COMEBACK',
    severity01: 0.76,
    publicness01: 0.93,
    hostility01: 0.44,
    prestige01: 0.86,
  },
  'PLAYER_COLLAPSE': {
    eventType: 'PLAYER_COLLAPSE',
    severity01: 0.72,
    publicness01: 0.91,
    hostility01: 0.18,
    prestige01: 0.41,
  },
  'PLAYER_BREACH': {
    eventType: 'PLAYER_BREACH',
    severity01: 0.81,
    publicness01: 0.89,
    hostility01: 0.50,
    prestige01: 0.69,
  },
  'PLAYER_PERFECT_DEFENSE': {
    eventType: 'PLAYER_PERFECT_DEFENSE',
    severity01: 0.73,
    publicness01: 0.88,
    hostility01: 0.31,
    prestige01: 0.81,
  },
  'PLAYER_FAILED_GAMBLE': {
    eventType: 'PLAYER_FAILED_GAMBLE',
    severity01: 0.66,
    publicness01: 0.79,
    hostility01: 0.23,
    prestige01: 0.22,
  },
  'PLAYER_NEAR_SOVEREIGNTY': {
    eventType: 'PLAYER_NEAR_SOVEREIGNTY',
    severity01: 0.88,
    publicness01: 0.95,
    hostility01: 0.69,
    prestige01: 0.97,
  },
  'NEGOTIATION_WINDOW': {
    eventType: 'NEGOTIATION_WINDOW',
    severity01: 0.44,
    publicness01: 0.51,
    hostility01: 0.17,
    prestige01: 0.31,
  },
  'MARKET_ALERT': {
    eventType: 'MARKET_ALERT',
    severity01: 0.39,
    publicness01: 0.57,
    hostility01: 0.09,
    prestige01: 0.17,
  },
  'BOT_TAUNT_EMITTED': {
    eventType: 'BOT_TAUNT_EMITTED',
    severity01: 0.37,
    publicness01: 0.73,
    hostility01: 0.46,
    prestige01: 0.20,
  },
  'BOT_RETREAT_EMITTED': {
    eventType: 'BOT_RETREAT_EMITTED',
    severity01: 0.41,
    publicness01: 0.49,
    hostility01: 0.12,
    prestige01: 0.42,
  },
  'HELPER_RESCUE_EMITTED': {
    eventType: 'HELPER_RESCUE_EMITTED',
    severity01: 0.63,
    publicness01: 0.58,
    hostility01: 0.03,
    prestige01: 0.63,
  },
  'RIVAL_WITNESS_EMITTED': {
    eventType: 'RIVAL_WITNESS_EMITTED',
    severity01: 0.47,
    publicness01: 0.69,
    hostility01: 0.26,
    prestige01: 0.29,
  },
  'ARCHIVIST_WITNESS_EMITTED': {
    eventType: 'ARCHIVIST_WITNESS_EMITTED',
    severity01: 0.29,
    publicness01: 0.41,
    hostility01: 0.00,
    prestige01: 0.26,
  },
  'AMBIENT_WITNESS_EMITTED': {
    eventType: 'AMBIENT_WITNESS_EMITTED',
    severity01: 0.25,
    publicness01: 0.45,
    hostility01: 0.05,
    prestige01: 0.22,
  },
  'PUBLIC_WITNESS': {
    eventType: 'PUBLIC_WITNESS',
    severity01: 0.48,
    publicness01: 0.92,
    hostility01: 0.21,
    prestige01: 0.38,
  },
  'PRIVATE_WITNESS': {
    eventType: 'PRIVATE_WITNESS',
    severity01: 0.27,
    publicness01: 0.12,
    hostility01: 0.04,
    prestige01: 0.15,
  },
  'RUN_START': {
    eventType: 'RUN_START',
    severity01: 0.22,
    publicness01: 0.54,
    hostility01: 0.00,
    prestige01: 0.12,
  },
  'RUN_END': {
    eventType: 'RUN_END',
    severity01: 0.51,
    publicness01: 0.74,
    hostility01: 0.14,
    prestige01: 0.58,
  },
});

export const RIVALRY_EVENT_NOTES: Readonly<Record<ChatRelationshipEventType, string>> = Object.freeze({
  'PLAYER_MESSAGE': 'baseline conversational signal; use as low-volatility anchor for cadence smoothing',
  'PLAYER_QUESTION': 'probing surface; raises study/test bias before overt aggression',
  'PLAYER_ANGER': 'emotionally loud move; amplifies humiliation opportunity and public-stage fit',
  'PLAYER_TROLL': 'disrespectful provocation; increases contempt-led theatrics and callback readiness',
  'PLAYER_FLEX': 'status display; invites receipts, witness capture, and re-pricing',
  'PLAYER_CALM': 'control signal; suppresses premature swarm escalation',
  'PLAYER_HESITATION': 'uncertainty leak; favors probing and predictive read-building',
  'PLAYER_DISCIPLINE': 'competence reveal; often increases respect even inside rivalry',
  'PLAYER_GREED': 'extractive tell; widens contempt and re-price vectors',
  'PLAYER_BLUFF': 'ambiguity play; strengthens study, pressure, and predictive loops',
  'PLAYER_OVERCONFIDENCE': 'hubris signal; sharpens hunt windows',
  'PLAYER_COMEBACK': 'prestige spike; may force witnessed rebuttal',
  'PLAYER_COLLAPSE': 'failure reveal; can attract pack pressure but sometimes lowers social cost',
  'PLAYER_BREACH': 'boundary violation; strong unfinished-business escalator',
  'PLAYER_PERFECT_DEFENSE': 'clean resistance; can trigger obsession instead of contempt',
  'PLAYER_FAILED_GAMBLE': 'self-inflicted exposure; good receipt opportunity',
  'PLAYER_NEAR_SOVEREIGNTY': 'critical threat to rival hierarchy; near-max boss readiness input',
  'NEGOTIATION_WINDOW': 'decorum lane; escalations must account for discipline penalty',
  'MARKET_ALERT': 'external volatility driver; useful for cadence shifts without direct blame',
  'BOT_TAUNT_EMITTED': 'rival already committed to heat; callback quoting becomes more plausible',
  'BOT_RETREAT_EMITTED': 'temporary release valve; raises retreat/reprice branches',
  'HELPER_RESCUE_EMITTED': 'strong anti-bullying counterweight that can suppress swarm',
  'RIVAL_WITNESS_EMITTED': 'social proof injection by hostile lane actor',
  'ARCHIVIST_WITNESS_EMITTED': 'record-keeping witness with low direct hostility',
  'AMBIENT_WITNESS_EMITTED': 'background audience signal; mild public pressure support',
  'PUBLIC_WITNESS': 'broad visibility event; amplifies embarrassment risk',
  'PRIVATE_WITNESS': 'contained observation; pushes silence and direct-channel tactics',
  'RUN_START': 'fresh context; keep escalation ramp measured unless legacy already hot',
  'RUN_END': 'closure window; can crystallize unfinished business or dignified retreat',
});

export const RIVALRY_PERSONA_PROFILES: Readonly<Record<string, RivalPersonalityEscalationProfile>> = Object.freeze({
  'THE_LIQUIDATOR': {
    personaId: 'THE_LIQUIDATOR',
    label: 'The Liquidator',
    preferredTierProgression: ['GLARE', 'PROBE', 'PRESSURE', 'HUNT', 'PUBLIC_SWARM', 'BOSS_WINDOW'] as RivalryEscalationTier[],
    skipsTiers: false,
    prefersSilenceBeforeStrike: true,
    attackTimingBias01: 0.45,
    receiptPreference01: 0.82,
    humiliationPreference01: 0.68,
    psychologicalPreference01: 0.55,
    deEscalationResistance01: 0.72,
    publicStageBias01: 0.60,
    signatureOpeningStyle: 'METHODICAL_APPROACH',
    retreatCondition: 'NEVER_UNLESS_FORCED',
    escalationPaceMs: 8000,
  },
  'THE_BUREAUCRAT': {
    personaId: 'THE_BUREAUCRAT',
    label: 'The Bureaucrat',
    preferredTierProgression: ['GLARE', 'PROBE', 'PROBE', 'PRESSURE', 'PRESSURE', 'HUNT'] as RivalryEscalationTier[],
    skipsTiers: false,
    prefersSilenceBeforeStrike: false,
    attackTimingBias01: 0.30,
    receiptPreference01: 0.92,
    humiliationPreference01: 0.45,
    psychologicalPreference01: 0.78,
    deEscalationResistance01: 0.50,
    publicStageBias01: 0.40,
    signatureOpeningStyle: 'PROCEDURAL_CITATION',
    retreatCondition: 'WHEN_OUTPROCEDURED',
    escalationPaceMs: 12000,
  },
  'THE_MANIPULATOR': {
    personaId: 'THE_MANIPULATOR',
    label: 'The Manipulator',
    preferredTierProgression: ['PROBE', 'PRESSURE', 'HUNT', 'BOSS_WINDOW'] as RivalryEscalationTier[],
    skipsTiers: true,
    prefersSilenceBeforeStrike: true,
    attackTimingBias01: 0.72,
    receiptPreference01: 0.58,
    humiliationPreference01: 0.85,
    psychologicalPreference01: 0.92,
    deEscalationResistance01: 0.35,
    publicStageBias01: 0.75,
    signatureOpeningStyle: 'PSYCHOLOGICAL_TRAP',
    retreatCondition: 'WHEN_EXPOSED',
    escalationPaceMs: 5000,
  },
  'CRASH_PROPHET': {
    personaId: 'CRASH_PROPHET',
    label: 'Crash Prophet',
    preferredTierProgression: ['PRESSURE', 'PUBLIC_SWARM', 'BOSS_WINDOW'] as RivalryEscalationTier[],
    skipsTiers: true,
    prefersSilenceBeforeStrike: false,
    attackTimingBias01: 0.88,
    receiptPreference01: 0.42,
    humiliationPreference01: 0.72,
    psychologicalPreference01: 0.38,
    deEscalationResistance01: 0.25,
    publicStageBias01: 0.92,
    signatureOpeningStyle: 'DRAMATIC_PROPHECY',
    retreatCondition: 'WHEN_PROVEN_WRONG',
    escalationPaceMs: 3000,
  },
  'LEGACY_HEIR': {
    personaId: 'LEGACY_HEIR',
    label: 'Legacy Heir',
    preferredTierProgression: ['GLARE', 'GLARE', 'PROBE', 'PRESSURE', 'HUNT', 'PUBLIC_SWARM'] as RivalryEscalationTier[],
    skipsTiers: false,
    prefersSilenceBeforeStrike: true,
    attackTimingBias01: 0.35,
    receiptPreference01: 0.75,
    humiliationPreference01: 0.58,
    psychologicalPreference01: 0.62,
    deEscalationResistance01: 0.82,
    publicStageBias01: 0.55,
    signatureOpeningStyle: 'INHERITED_CONTEMPT',
    retreatCondition: 'WHEN_OUTCLASSED',
    escalationPaceMs: 10000,
  },
  'THE_ARCHIVIST': {
    personaId: 'THE_ARCHIVIST',
    label: 'The Archivist',
    preferredTierProgression: ['GLARE', 'PROBE', 'PRESSURE'] as RivalryEscalationTier[],
    skipsTiers: false,
    prefersSilenceBeforeStrike: true,
    attackTimingBias01: 0.28,
    receiptPreference01: 0.94,
    humiliationPreference01: 0.22,
    psychologicalPreference01: 0.81,
    deEscalationResistance01: 0.41,
    publicStageBias01: 0.26,
    signatureOpeningStyle: 'DOCUMENTED_RECEIPT',
    retreatCondition: 'WHEN_RECORD_IS_COMPLETE',
    escalationPaceMs: 14000,
  },
  'THE_SPECTACLE': {
    personaId: 'THE_SPECTACLE',
    label: 'The Spectacle',
    preferredTierProgression: ['PRESSURE', 'HUNT', 'PUBLIC_SWARM', 'BOSS_WINDOW'] as RivalryEscalationTier[],
    skipsTiers: true,
    prefersSilenceBeforeStrike: false,
    attackTimingBias01: 0.91,
    receiptPreference01: 0.73,
    humiliationPreference01: 0.87,
    psychologicalPreference01: 0.46,
    deEscalationResistance01: 0.64,
    publicStageBias01: 0.97,
    signatureOpeningStyle: 'CROWD_HARVEST',
    retreatCondition: 'WHEN_AUDIENCE_TURNS',
    escalationPaceMs: 2600,
  },
});

export const RIVALRY_MODE_ESCALATION_PROFILES: Readonly<Record<string, ModeEscalationProfile>> = Object.freeze({
  'GO_ALONE': {
    modeId: 'GO_ALONE',
    label: 'Empire',
    maxSimultaneousRivals: 1,
    publicSwarmAllowed: false,
    escalationPaceMultiplier: 1.30,
    silenceEmphasis01: 0.65,
    dealRoomEscalation: false,
    teamCoordination: false,
    preferredTierCeiling: 'HUNT' as RivalryEscalationTier,
    witnessAmplification01: 0.40,
  },
  'HEAD_TO_HEAD': {
    modeId: 'HEAD_TO_HEAD',
    label: 'Predator',
    maxSimultaneousRivals: 1,
    publicSwarmAllowed: false,
    escalationPaceMultiplier: 0.80,
    silenceEmphasis01: 0.35,
    dealRoomEscalation: true,
    teamCoordination: false,
    preferredTierCeiling: 'BOSS_WINDOW' as RivalryEscalationTier,
    witnessAmplification01: 0.60,
  },
  'TEAM_UP': {
    modeId: 'TEAM_UP',
    label: 'Syndicate',
    maxSimultaneousRivals: 3,
    publicSwarmAllowed: true,
    escalationPaceMultiplier: 1.00,
    silenceEmphasis01: 0.25,
    dealRoomEscalation: false,
    teamCoordination: true,
    preferredTierCeiling: 'PUBLIC_SWARM' as RivalryEscalationTier,
    witnessAmplification01: 0.85,
  },
  'CHASE_A_LEGEND': {
    modeId: 'CHASE_A_LEGEND',
    label: 'Phantom',
    maxSimultaneousRivals: 2,
    publicSwarmAllowed: false,
    escalationPaceMultiplier: 1.60,
    silenceEmphasis01: 0.88,
    dealRoomEscalation: false,
    teamCoordination: false,
    preferredTierCeiling: 'HUNT' as RivalryEscalationTier,
    witnessAmplification01: 0.20,
  },
  'TOURNAMENT': {
    modeId: 'TOURNAMENT',
    label: 'Tournament',
    maxSimultaneousRivals: 4,
    publicSwarmAllowed: true,
    escalationPaceMultiplier: 0.92,
    silenceEmphasis01: 0.28,
    dealRoomEscalation: false,
    teamCoordination: true,
    preferredTierCeiling: 'PUBLIC_SWARM' as RivalryEscalationTier,
    witnessAmplification01: 0.90,
  },
  'ZERO_MODE': {
    modeId: 'ZERO_MODE',
    label: 'Zero Engine',
    maxSimultaneousRivals: 2,
    publicSwarmAllowed: false,
    escalationPaceMultiplier: 1.18,
    silenceEmphasis01: 0.71,
    dealRoomEscalation: true,
    teamCoordination: false,
    preferredTierCeiling: 'BOSS_WINDOW' as RivalryEscalationTier,
    witnessAmplification01: 0.34,
  },
  'STORY_RUN': {
    modeId: 'STORY_RUN',
    label: 'Story Run',
    maxSimultaneousRivals: 2,
    publicSwarmAllowed: false,
    escalationPaceMultiplier: 0.74,
    silenceEmphasis01: 0.77,
    dealRoomEscalation: true,
    teamCoordination: false,
    preferredTierCeiling: 'PRESSURE' as RivalryEscalationTier,
    witnessAmplification01: 0.18,
  },
});

export const RIVALRY_CHANNEL_PROFILES: Readonly<Record<string, RivalryChannelProfile>> = Object.freeze({
  'GLOBAL': {
    channelId: 'GLOBAL',
    description: 'Open arena with broad witness potential.',
    publicGravity01: 0.92,
    decorum01: 0.18,
    spectacleBias01: 0.84,
    silenceBias01: 0.66,
  },
  'SYNDICATE': {
    channelId: 'SYNDICATE',
    description: 'Semi-public tactical lane with pack behavior.',
    publicGravity01: 0.63,
    decorum01: 0.24,
    spectacleBias01: 0.62,
    silenceBias01: 0.58,
  },
  'DEAL_ROOM': {
    channelId: 'DEAL_ROOM',
    description: 'Negotiation-sensitive lane that penalizes theatrics.',
    publicGravity01: 0.38,
    decorum01: 0.71,
    spectacleBias01: 0.29,
    silenceBias01: 0.48,
  },
  'DIRECT': {
    channelId: 'DIRECT',
    description: 'Private lane favoring silence, precision, and callback memory.',
    publicGravity01: 0.29,
    decorum01: 0.64,
    spectacleBias01: 0.18,
    silenceBias01: 0.31,
  },
  'SPECTATOR': {
    channelId: 'SPECTATOR',
    description: 'Performance surface driven by witness density.',
    publicGravity01: 0.86,
    decorum01: 0.11,
    spectacleBias01: 0.91,
    silenceBias01: 0.72,
  },
  'SYSTEM': {
    channelId: 'SYSTEM',
    description: 'Meta/system lane with low public gravity.',
    publicGravity01: 0.18,
    decorum01: 0.44,
    spectacleBias01: 0.07,
    silenceBias01: 0.22,
  },
});

export const RIVALRY_SCENARIO_GLOBAL_LOW = Object.freeze({
  channelId: 'GLOBAL' as const,
  pressureBand: 'LOW' as const,
  publicBias01: 0.90,
  pressureBias01: 0.12,
});
export const RIVALRY_SCENARIO_GLOBAL_MEDIUM = Object.freeze({
  channelId: 'GLOBAL' as const,
  pressureBand: 'MEDIUM' as const,
  publicBias01: 0.90,
  pressureBias01: 0.33,
});
export const RIVALRY_SCENARIO_GLOBAL_HIGH = Object.freeze({
  channelId: 'GLOBAL' as const,
  pressureBand: 'HIGH' as const,
  publicBias01: 0.90,
  pressureBias01: 0.63,
});
export const RIVALRY_SCENARIO_GLOBAL_CRITICAL = Object.freeze({
  channelId: 'GLOBAL' as const,
  pressureBand: 'CRITICAL' as const,
  publicBias01: 0.90,
  pressureBias01: 0.91,
});
export const RIVALRY_SCENARIO_SYNDICATE_LOW = Object.freeze({
  channelId: 'SYNDICATE' as const,
  pressureBand: 'LOW' as const,
  publicBias01: 0.65,
  pressureBias01: 0.12,
});
export const RIVALRY_SCENARIO_SYNDICATE_MEDIUM = Object.freeze({
  channelId: 'SYNDICATE' as const,
  pressureBand: 'MEDIUM' as const,
  publicBias01: 0.65,
  pressureBias01: 0.33,
});
export const RIVALRY_SCENARIO_SYNDICATE_HIGH = Object.freeze({
  channelId: 'SYNDICATE' as const,
  pressureBand: 'HIGH' as const,
  publicBias01: 0.65,
  pressureBias01: 0.63,
});
export const RIVALRY_SCENARIO_SYNDICATE_CRITICAL = Object.freeze({
  channelId: 'SYNDICATE' as const,
  pressureBand: 'CRITICAL' as const,
  publicBias01: 0.65,
  pressureBias01: 0.91,
});
export const RIVALRY_SCENARIO_DEAL_ROOM_LOW = Object.freeze({
  channelId: 'DEAL_ROOM' as const,
  pressureBand: 'LOW' as const,
  publicBias01: 0.40,
  pressureBias01: 0.12,
});
export const RIVALRY_SCENARIO_DEAL_ROOM_MEDIUM = Object.freeze({
  channelId: 'DEAL_ROOM' as const,
  pressureBand: 'MEDIUM' as const,
  publicBias01: 0.40,
  pressureBias01: 0.33,
});
export const RIVALRY_SCENARIO_DEAL_ROOM_HIGH = Object.freeze({
  channelId: 'DEAL_ROOM' as const,
  pressureBand: 'HIGH' as const,
  publicBias01: 0.40,
  pressureBias01: 0.63,
});
export const RIVALRY_SCENARIO_DEAL_ROOM_CRITICAL = Object.freeze({
  channelId: 'DEAL_ROOM' as const,
  pressureBand: 'CRITICAL' as const,
  publicBias01: 0.40,
  pressureBias01: 0.91,
});
export const RIVALRY_SCENARIO_DIRECT_LOW = Object.freeze({
  channelId: 'DIRECT' as const,
  pressureBand: 'LOW' as const,
  publicBias01: 0.25,
  pressureBias01: 0.12,
});
export const RIVALRY_SCENARIO_DIRECT_MEDIUM = Object.freeze({
  channelId: 'DIRECT' as const,
  pressureBand: 'MEDIUM' as const,
  publicBias01: 0.25,
  pressureBias01: 0.33,
});
export const RIVALRY_SCENARIO_DIRECT_HIGH = Object.freeze({
  channelId: 'DIRECT' as const,
  pressureBand: 'HIGH' as const,
  publicBias01: 0.25,
  pressureBias01: 0.63,
});
export const RIVALRY_SCENARIO_DIRECT_CRITICAL = Object.freeze({
  channelId: 'DIRECT' as const,
  pressureBand: 'CRITICAL' as const,
  publicBias01: 0.25,
  pressureBias01: 0.91,
});
export const RIVALRY_SCENARIO_SPECTATOR_LOW = Object.freeze({
  channelId: 'SPECTATOR' as const,
  pressureBand: 'LOW' as const,
  publicBias01: 0.90,
  pressureBias01: 0.12,
});
export const RIVALRY_SCENARIO_SPECTATOR_MEDIUM = Object.freeze({
  channelId: 'SPECTATOR' as const,
  pressureBand: 'MEDIUM' as const,
  publicBias01: 0.90,
  pressureBias01: 0.33,
});
export const RIVALRY_SCENARIO_SPECTATOR_HIGH = Object.freeze({
  channelId: 'SPECTATOR' as const,
  pressureBand: 'HIGH' as const,
  publicBias01: 0.90,
  pressureBias01: 0.63,
});
export const RIVALRY_SCENARIO_SPECTATOR_CRITICAL = Object.freeze({
  channelId: 'SPECTATOR' as const,
  pressureBand: 'CRITICAL' as const,
  publicBias01: 0.90,
  pressureBias01: 0.91,
});
export const RIVALRY_SCENARIO_SYSTEM_LOW = Object.freeze({
  channelId: 'SYSTEM' as const,
  pressureBand: 'LOW' as const,
  publicBias01: 0.10,
  pressureBias01: 0.12,
});
export const RIVALRY_SCENARIO_SYSTEM_MEDIUM = Object.freeze({
  channelId: 'SYSTEM' as const,
  pressureBand: 'MEDIUM' as const,
  publicBias01: 0.10,
  pressureBias01: 0.33,
});
export const RIVALRY_SCENARIO_SYSTEM_HIGH = Object.freeze({
  channelId: 'SYSTEM' as const,
  pressureBand: 'HIGH' as const,
  publicBias01: 0.10,
  pressureBias01: 0.63,
});
export const RIVALRY_SCENARIO_SYSTEM_CRITICAL = Object.freeze({
  channelId: 'SYSTEM' as const,
  pressureBand: 'CRITICAL' as const,
  publicBias01: 0.10,
  pressureBias01: 0.91,
});

export const RIVALRY_SCENARIO_CATALOG: readonly RivalryScenarioDescriptor[] = Object.freeze([
  RIVALRY_SCENARIO_GLOBAL_LOW,
  RIVALRY_SCENARIO_GLOBAL_MEDIUM,
  RIVALRY_SCENARIO_GLOBAL_HIGH,
  RIVALRY_SCENARIO_GLOBAL_CRITICAL,
  RIVALRY_SCENARIO_SYNDICATE_LOW,
  RIVALRY_SCENARIO_SYNDICATE_MEDIUM,
  RIVALRY_SCENARIO_SYNDICATE_HIGH,
  RIVALRY_SCENARIO_SYNDICATE_CRITICAL,
  RIVALRY_SCENARIO_DEAL_ROOM_LOW,
  RIVALRY_SCENARIO_DEAL_ROOM_MEDIUM,
  RIVALRY_SCENARIO_DEAL_ROOM_HIGH,
  RIVALRY_SCENARIO_DEAL_ROOM_CRITICAL,
  RIVALRY_SCENARIO_DIRECT_LOW,
  RIVALRY_SCENARIO_DIRECT_MEDIUM,
  RIVALRY_SCENARIO_DIRECT_HIGH,
  RIVALRY_SCENARIO_DIRECT_CRITICAL,
  RIVALRY_SCENARIO_SPECTATOR_LOW,
  RIVALRY_SCENARIO_SPECTATOR_MEDIUM,
  RIVALRY_SCENARIO_SPECTATOR_HIGH,
  RIVALRY_SCENARIO_SPECTATOR_CRITICAL,
  RIVALRY_SCENARIO_SYSTEM_LOW,
  RIVALRY_SCENARIO_SYSTEM_MEDIUM,
  RIVALRY_SCENARIO_SYSTEM_HIGH,
  RIVALRY_SCENARIO_SYSTEM_CRITICAL,
]);

export const RIVALRY_TIER_NOTES: Readonly<Record<RivalryEscalationTier, RivalryTierNarrativeNote>> = Object.freeze({
  'NONE': { tier: 'NONE', note: 'No meaningful escalation. Keep heat latent or defer.' },
  'GLARE': { tier: 'GLARE', note: 'The counterpart notices and projects low-grade menace.' },
  'PROBE': { tier: 'PROBE', note: 'Questions, nudges, and setup lines try to expose weakness.' },
  'PRESSURE': { tier: 'PRESSURE', note: 'The counterpart actively corners the player in language.' },
  'HUNT': { tier: 'HUNT', note: 'The counterpart commits to multi-step persecution logic.' },
  'PUBLIC_SWARM': { tier: 'PUBLIC_SWARM', note: 'The moment becomes social and witnessed.' },
  'BOSS_WINDOW': { tier: 'BOSS_WINDOW', note: 'Language itself becomes a combat window.' },
});

const TIER_ORDER: readonly RivalryEscalationTier[] = Object.freeze([
  'NONE',
  'GLARE',
  'PROBE',
  'PRESSURE',
  'HUNT',
  'PUBLIC_SWARM',
  'BOSS_WINDOW',
]);

const VALID_TRANSITIONS: Readonly<Record<RivalryEscalationTier, readonly RivalryEscalationTier[]>> = Object.freeze({
  NONE: ['GLARE', 'PROBE'],
  GLARE: ['NONE', 'PROBE', 'PRESSURE'],
  PROBE: ['GLARE', 'PRESSURE', 'HUNT'],
  PRESSURE: ['PROBE', 'HUNT', 'PUBLIC_SWARM'],
  HUNT: ['PRESSURE', 'PUBLIC_SWARM', 'BOSS_WINDOW'],
  PUBLIC_SWARM: ['HUNT', 'BOSS_WINDOW', 'NONE'],
  BOSS_WINDOW: ['NONE', 'HUNT'],
});

// ============================================================================
// MARK: Primitive helpers
// ============================================================================

function safe01(value: number | undefined | null): number {
  return clamp01(typeof value === 'number' ? value : 0);
}

function roundMs(value: number): number {
  return Math.max(0, Math.round(value));
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function freezeStringArray(values: Iterable<string>): readonly string[] {
  return Object.freeze([...values]);
}

function tierOrdinal(tier: RivalryEscalationTier): number {
  return TIER_ORDER.indexOf(tier);
}

function tierAtOrBelow(tier: RivalryEscalationTier, ceiling: RivalryEscalationTier): RivalryEscalationTier {
  return tierOrdinal(tier) <= tierOrdinal(ceiling) ? tier : ceiling;
}

function eventTypeOr(request: RivalryEscalationRequest): ChatRelationshipEventType {
  return request.context.sourceEvent?.eventType ?? 'PLAYER_MESSAGE';
}

function channelKey(request: RivalryEscalationRequest): string {
  return (request.context.channelId ?? request.state.lastChannelId ?? 'GLOBAL').toUpperCase();
}

function counterpartKindOf(request: RivalryEscalationRequest): ChatRelationshipCounterpartKind {
  return request.state.counterpartKind;
}

function objectiveOf(request: RivalryEscalationRequest): ChatRelationshipObjective {
  return request.state.objective;
}

function isPrivateChannel(channelId: string): boolean {
  return channelId === 'DIRECT';
}

function isDealRoom(channelId: string): boolean {
  return channelId === 'DEAL_ROOM';
}

function isPublicArena(channelId: string): boolean {
  return channelId === 'GLOBAL' || channelId === 'SPECTATOR' || channelId === 'SYNDICATE';
}

function modeIdOr(request: RivalryEscalationRequest): string {
  return request.context.modeId ?? 'GO_ALONE';
}

function personaIdOr(request: RivalryEscalationRequest): string | undefined {
  return request.context.personaId ?? undefined;
}

function eventPreset(eventType: ChatRelationshipEventType): RivalryEventPreset {
  return RIVALRY_EVENT_PRESETS[eventType];
}

function eventHeatFor(request: RivalryEscalationRequest, config: RivalryEscalationPolicyConfig): number {
  return config.eventHeat[eventTypeOr(request)] ?? eventPreset(eventTypeOr(request)).severity01;
}

function eventPublicnessFor(request: RivalryEscalationRequest, config: RivalryEscalationPolicyConfig): number {
  return config.eventPublicness[eventTypeOr(request)] ?? eventPreset(eventTypeOr(request)).publicness01;
}

function eventHostilityFor(request: RivalryEscalationRequest, config: RivalryEscalationPolicyConfig): number {
  return config.eventHostility[eventTypeOr(request)] ?? eventPreset(eventTypeOr(request)).hostility01;
}

function eventPrestigeFor(request: RivalryEscalationRequest, config: RivalryEscalationPolicyConfig): number {
  return config.eventPrestige[eventTypeOr(request)] ?? eventPreset(eventTypeOr(request)).prestige01;
}

function counterpartKindBiasFor(request: RivalryEscalationRequest, config: RivalryEscalationPolicyConfig): number {
  return config.counterpartKindBiases[counterpartKindOf(request)] ?? 0.5;
}

function objectiveBiasFor(request: RivalryEscalationRequest, config: RivalryEscalationPolicyConfig): number {
  return config.objectiveBiases[objectiveOf(request)] ?? 0.5;
}

function channelProfile(channelId: string): RivalryChannelProfile {
  return RIVALRY_CHANNEL_PROFILES[channelId] ?? {
    channelId,
    description: 'Unknown channel; treat as mixed public/private surface.',
    publicGravity01: 0.50,
    decorum01: 0.50,
    spectacleBias01: 0.50,
    silenceBias01: 0.50,
  };
}

function scenarioFor(channelId: string, pressureBand: ChatRelationshipPressureBand): RivalryScenarioDescriptor {
  const found = RIVALRY_SCENARIO_CATALOG.find((entry) => entry.channelId === channelId && entry.pressureBand === pressureBand);
  if (found) return found;
  return {
    channelId,
    pressureBand,
    publicBias01: DEFAULT_CHANNEL_BIASES[channelId] ?? 0.50,
    pressureBias01: DEFAULT_PRESSURE_BIASES[pressureBand],
  };
}

function legacyTrust01(legacy: ChatRelationshipLegacyProjection): number {
  return clamp01(legacy.trust / 100);
}

function legacyRivalry01(legacy: ChatRelationshipLegacyProjection): number {
  return clamp01(legacy.rivalryIntensity / 100);
}

function legacyContempt01(legacy: ChatRelationshipLegacyProjection): number {
  return clamp01(legacy.contempt / 100);
}

function legacyFascination01(legacy: ChatRelationshipLegacyProjection): number {
  return clamp01(legacy.fascination / 100);
}

function vectorPublicThreat01(vector: ChatRelationshipVector): number {
  return clamp01(
    vector.contempt01 * 0.28 +
    vector.obsession01 * 0.22 +
    vector.unfinishedBusiness01 * 0.18 +
    vector.predictiveConfidence01 * 0.16 +
    vector.fear01 * 0.06 +
    vector.fascination01 * 0.10,
  );
}

function vectorPrivateThreat01(vector: ChatRelationshipVector): number {
  return clamp01(
    vector.familiarity01 * 0.24 +
    vector.predictiveConfidence01 * 0.19 +
    vector.patience01 * 0.16 +
    vector.obsession01 * 0.18 +
    vector.fascination01 * 0.14 +
    vector.traumaDebt01 * 0.09,
  );
}

function baseCadenceMultiplier(request: RivalryEscalationRequest): number {
  const profile = RIVALRY_MODE_ESCALATION_PROFILES[modeIdOr(request)] ?? RIVALRY_MODE_ESCALATION_PROFILES.GO_ALONE;
  const persona = personaIdOr(request) ? RIVALRY_PERSONA_PROFILES[personaIdOr(request)!] : undefined;
  return clamp01(
    0.35 +
    profile.escalationPaceMultiplier * 0.35 +
    (persona?.attackTimingBias01 ?? 0.50) * 0.20 +
    safe01(request.context.audienceHeat01) * 0.10,
  );
}

// ============================================================================
// MARK: Assessment math
// ============================================================================

function hostility01(request: RivalryEscalationRequest, config: RivalryEscalationPolicyConfig): number {
  const state = request.state;
  const signal = request.signal;
  return clamp01(
    state.vector.contempt01 * 0.23 +
    state.vector.obsession01 * 0.16 +
    state.vector.unfinishedBusiness01 * 0.17 +
    signal.predictiveConfidence01 * 0.08 +
    eventHeatFor(request, config) * 0.09 +
    eventHostilityFor(request, config) * 0.09 +
    config.stanceBiases[state.stance] * 0.10 +
    counterpartKindBiasFor(request, config) * 0.05 +
    objectiveBiasFor(request, config) * 0.03,
  );
}

function rivalry01(request: RivalryEscalationRequest): number {
  const state = request.state;
  return clamp01(
    state.intensity01 * 0.30 +
    state.vector.contempt01 * 0.15 +
    state.vector.fascination01 * 0.10 +
    state.vector.obsession01 * 0.15 +
    state.vector.unfinishedBusiness01 * 0.18 +
    state.vector.predictiveConfidence01 * 0.12,
  );
}

function publicStageFit01(request: RivalryEscalationRequest, config: RivalryEscalationPolicyConfig): number {
  const channel = channelKey(request);
  const channelBias = config.channelBiases[channel] ?? 0.50;
  const channelDoc = channelProfile(channel);
  const scenario = scenarioFor(channel, request.context.pressureBand);
  return clamp01(
    request.state.publicPressureBias01 * 0.28 +
    request.callback.witnessValue01 * 0.12 +
    request.signal.obsession01 * 0.06 +
    eventPublicnessFor(request, config) * 0.12 +
    eventPrestigeFor(request, config) * 0.08 +
    channelBias * 0.14 +
    channelDoc.publicGravity01 * 0.10 +
    scenario.publicBias01 * 0.10,
  );
}

function privateStageFit01(request: RivalryEscalationRequest): number {
  const channel = channelKey(request);
  const channelDoc = channelProfile(channel);
  return clamp01(
    request.state.privatePressureBias01 * 0.41 +
    request.state.vector.familiarity01 * 0.12 +
    request.state.vector.predictiveConfidence01 * 0.10 +
    request.state.vector.patience01 * 0.08 +
    (isPrivateChannel(channel) ? 0.18 : 0) +
    (isDealRoom(channel) ? 0.10 : 0) +
    channelDoc.silenceBias01 * 0.11,
  );
}

function rescueCounterweight01(request: RivalryEscalationRequest): number {
  const state = request.state;
  return clamp01(
    state.vector.traumaDebt01 * 0.28 +
    state.vector.familiarity01 * 0.19 +
    state.vector.respect01 * 0.16 +
    legacyTrust01(request.legacy) * 0.12 +
    (request.context.rescueWindowOpen ? 0.17 : 0) +
    (state.counterpartKind === 'HELPER' ? 0.08 : 0),
  );
}

function humiliationValue01(request: RivalryEscalationRequest): number {
  return clamp01(
    request.callback.humiliationRisk01 * 0.29 +
    request.callback.suitability01 * 0.12 +
    legacyRivalry01(request.legacy) * 0.18 +
    legacyContempt01(request.legacy) * 0.13 +
    legacyFascination01(request.legacy) * 0.08 +
    request.state.vector.contempt01 * 0.10 +
    request.state.vector.unfinishedBusiness01 * 0.10,
  );
}

function negotiationDiscipline01(request: RivalryEscalationRequest): number {
  const channel = channelKey(request);
  const doc = channelProfile(channel);
  return clamp01(
    (isDealRoom(channel) ? 0.28 : 0) +
    request.state.vector.predictiveConfidence01 * 0.17 +
    request.state.vector.patience01 * 0.16 +
    request.state.vector.familiarity01 * 0.08 +
    doc.decorum01 * 0.18 +
    (request.context.negotiationWindowOpen ? 0.13 : 0),
  );
}

function cooldown01(request: RivalryEscalationRequest, config: RivalryEscalationPolicyConfig): number {
  const ageMs = Math.max(0, request.context.now - request.state.lastTouchedAt);
  const base =
    ageMs <= 5_000 ? config.cooldownPenalty01 :
    ageMs <= 20_000 ? config.cooldownPenalty01 * 0.78 :
    ageMs <= 60_000 ? config.cooldownPenalty01 * 0.42 : 0;
  return clamp01(base + (request.context.mode === 'POST_RUN' ? 0.09 : 0));
}

function obsessionHeat01(request: RivalryEscalationRequest): number {
  return clamp01(
    request.state.vector.obsession01 * 0.54 +
    request.state.vector.fascination01 * 0.16 +
    request.state.vector.unfinishedBusiness01 * 0.14 +
    request.signal.obsession01 * 0.10 +
    request.signal.unfinishedBusiness01 * 0.06,
  );
}

function witnessMagnet01(request: RivalryEscalationRequest, publicFit: number, config: RivalryEscalationPolicyConfig): number {
  const channel = channelKey(request);
  const profile = channelProfile(channel);
  return clamp01(
    publicFit * 0.43 +
    request.callback.witnessValue01 * 0.18 +
    eventPublicnessFor(request, config) * 0.11 +
    profile.spectacleBias01 * 0.16 +
    safe01(request.context.audienceHeat01) * 0.12,
  );
}

function silenceValue01(request: RivalryEscalationRequest, privateFit: number, publicFit: number): number {
  const channel = channelKey(request);
  const profile = channelProfile(channel);
  return clamp01(
    (privateFit > publicFit ? 0.16 : 0) +
    profile.silenceBias01 * 0.24 +
    request.state.vector.predictiveConfidence01 * 0.15 +
    request.state.vector.fascination01 * 0.08 +
    request.state.vector.patience01 * 0.12 +
    (isPrivateChannel(channel) ? 0.15 : 0) +
    (isDealRoom(channel) ? 0.10 : 0),
  );
}

function helperSuppressionValue01(request: RivalryEscalationRequest, rescueCounterweight: number, publicFit: number): number {
  return clamp01(
    request.state.vector.contempt01 * 0.18 +
    request.state.vector.obsession01 * 0.17 +
    publicFit * 0.12 +
    request.signal.intensity01 * 0.11 +
    (request.context.rescueWindowOpen ? 0.08 : 0) +
    (1 - rescueCounterweight) * 0.19 +
    request.state.intensity01 * 0.15,
  );
}

function packPotential01(request: RivalryEscalationRequest, witnessMagnet: number, hostility: number): number {
  const rivals = Math.max(0, request.context.activeRivalCount ?? 0);
  return clamp01(
    hostility * 0.24 +
    witnessMagnet * 0.22 +
    request.state.publicPressureBias01 * 0.12 +
    (rivals >= 2 ? 0.16 : 0) +
    (channelKey(request) === 'SYNDICATE' ? 0.13 : 0) +
    (channelKey(request) === 'SPECTATOR' ? 0.08 : 0) +
    Math.min(0.12, rivals * 0.03),
  );
}

function spectacleRisk01(request: RivalryEscalationRequest, publicFit: number, witnessMagnet: number, config: RivalryEscalationPolicyConfig): number {
  return clamp01(
    publicFit * 0.32 +
    witnessMagnet * 0.24 +
    eventPrestigeFor(request, config) * 0.14 +
    eventPublicnessFor(request, config) * 0.10 +
    safe01(request.context.audienceHeat01) * 0.10 +
    request.state.vector.obsession01 * 0.10,
  );
}

function prestigeGravity01(request: RivalryEscalationRequest, config: RivalryEscalationPolicyConfig): number {
  return clamp01(
    eventPrestigeFor(request, config) * 0.36 +
    request.state.vector.respect01 * 0.16 +
    request.state.vector.fear01 * 0.08 +
    request.state.intensity01 * 0.14 +
    request.signal.selectionWeight01 * 0.10 +
    request.signal.predictiveConfidence01 * 0.08 +
    request.state.vector.fascination01 * 0.08,
  );
}

function bossFightReadiness01(
  request: RivalryEscalationRequest,
  hostility: number,
  rivalry: number,
  publicFit: number,
  witnessMagnet: number,
  config: RivalryEscalationPolicyConfig,
): number {
  return clamp01(
    hostility * 0.19 +
    rivalry * 0.19 +
    request.state.vector.obsession01 * 0.15 +
    request.state.vector.predictiveConfidence01 * 0.09 +
    request.state.vector.unfinishedBusiness01 * 0.12 +
    publicFit * 0.11 +
    witnessMagnet * 0.07 +
    prestigeGravity01(request, config) * 0.08,
  );
}

function buildAssessment(request: RivalryEscalationRequest, config: RivalryEscalationPolicyConfig): RivalryEscalationAssessment {
  const host = hostility01(request, config);
  const rivalry = rivalry01(request);
  const publicFit = publicStageFit01(request, config);
  const privateFit = privateStageFit01(request);
  const rescue = rescueCounterweight01(request);
  const humiliation = humiliationValue01(request);
  const discipline = negotiationDiscipline01(request);
  const cool = cooldown01(request, config);
  const obsession = obsessionHeat01(request);
  const witnessMagnet = witnessMagnet01(request, publicFit, config);
  const silenceValue = silenceValue01(request, privateFit, publicFit);
  const helperSuppression = helperSuppressionValue01(request, rescue, publicFit);
  const packPotential = packPotential01(request, witnessMagnet, host);
  const spectacleRisk = spectacleRisk01(request, publicFit, witnessMagnet, config);
  const counterpartKindBias = counterpartKindBiasFor(request, config);
  const objectiveBias = objectiveBiasFor(request, config);
  const prestigeGravity = prestigeGravity01(request, config);
  return {
    hostility01: host,
    rivalry01: rivalry,
    publicStageFit01: publicFit,
    privateStageFit01: privateFit,
    obsessionHeat01: obsession,
    witnessMagnet01: witnessMagnet,
    rescueCounterweight01: rescue,
    humiliationValue01: humiliation,
    negotiationDiscipline01: discipline,
    cooldown01: cool,
    bossFightReadiness01: bossFightReadiness01(request, host, rivalry, publicFit, witnessMagnet, config),
    silenceValue01: silenceValue,
    helperSuppressionValue01: helperSuppression,
    packPotential01: packPotential,
    spectacleRisk01: spectacleRisk,
    counterpartKindBias01: counterpartKindBias,
    objectiveBias01: objectiveBias,
    prestigeGravity01: prestigeGravity,
  };
}

function selectedScore01(request: RivalryEscalationRequest, assessment: RivalryEscalationAssessment, config: RivalryEscalationPolicyConfig): number {
  const pressureBias = config.pressureBiases[request.context.pressureBand];
  const publicBoost = request.context.allowPublicSwarm ? assessment.publicStageFit01 * 0.07 : 0;
  const receiptBoost = request.callback.tier === 'RECEIPT' && request.context.allowReceipts ? 0.06 : 0;
  return clamp01(
    assessment.hostility01 * 0.21 +
    assessment.rivalry01 * 0.15 +
    assessment.obsessionHeat01 * 0.10 +
    assessment.humiliationValue01 * 0.08 +
    assessment.bossFightReadiness01 * 0.08 +
    pressureBias * 0.08 +
    assessment.counterpartKindBias01 * 0.04 +
    assessment.objectiveBias01 * 0.04 +
    assessment.prestigeGravity01 * 0.05 +
    publicBoost +
    receiptBoost -
    assessment.rescueCounterweight01 * 0.07 -
    assessment.negotiationDiscipline01 * 0.06 -
    assessment.cooldown01 * 0.06,
  );
}

function chooseTier(
  request: RivalryEscalationRequest,
  assessment: RivalryEscalationAssessment,
  score: number,
  config: RivalryEscalationPolicyConfig,
): RivalryEscalationTier {
  const channel = channelKey(request);
  if (
    score >= config.bossWindowFloor01 &&
    assessment.bossFightReadiness01 >= config.bossWindowFloor01 &&
    !request.context.rescueWindowOpen &&
    !isDealRoom(channel)
  ) return 'BOSS_WINDOW';
  if (
    request.context.allowPublicSwarm &&
    assessment.publicStageFit01 >= config.publicSwarmFloor01 &&
    score >= config.publicSwarmFloor01 &&
    isPublicArena(channel)
  ) return 'PUBLIC_SWARM';
  if (score >= config.huntFloor01) return 'HUNT';
  if (score >= config.pressureFloor01) return 'PRESSURE';
  if (score >= config.probeFloor01) return 'PROBE';
  if (score >= config.glareFloor01) return 'GLARE';
  return 'NONE';
}

function suppressionReason(
  request: RivalryEscalationRequest,
  assessment: RivalryEscalationAssessment,
  tier: RivalryEscalationTier,
  config: RivalryEscalationPolicyConfig,
): RivalrySuppressionReason {
  if (tier !== 'NONE') return 'NONE';
  if (request.context.mode === 'REPLAY') return 'REPLAY_ONLY';
  if (request.context.mode === 'POST_RUN') return 'POST_RUN_COOLDOWN';
  if (assessment.rescueCounterweight01 >= config.rescueSuppressionFloor01) return 'HELPER_PROTECTION';
  if (assessment.negotiationDiscipline01 >= config.negotiationDisciplineFloor01) return 'NEGOTIATION_DECORUM';
  if (assessment.publicStageFit01 < 0.18 && assessment.privateStageFit01 < 0.18) return 'PRIVATE_CONTEXT';
  return 'LOW_SIGNAL';
}

function attackWindow(
  request: RivalryEscalationRequest,
  tier: RivalryEscalationTier,
  assessment: RivalryEscalationAssessment,
  config: RivalryEscalationPolicyConfig,
): RivalryAttackWindow {
  const immediate = tier === 'PUBLIC_SWARM' || tier === 'BOSS_WINDOW';
  const cadence = roundMs(
    config.baseAttackCadenceMs *
    (1.22 - baseCadenceMultiplier(request)) *
    (1.12 - assessment.hostility01 * 0.22),
  );
  const startsInMs = !request.context.allowDelayedReveal
    ? 0
    : immediate
      ? roundMs(50 + assessment.cooldown01 * 80)
      : roundMs(280 + (1 - assessment.hostility01) * 520 + assessment.cooldown01 * 320);
  const durationMs =
    tier === 'BOSS_WINDOW' ? 3800 :
    tier === 'PUBLIC_SWARM' ? 2600 :
    tier === 'HUNT' ? 2200 :
    tier === 'PRESSURE' ? 1600 :
    tier === 'PROBE' ? 1200 :
    tier === 'GLARE' ? 900 : 0;
  return {
    open: tier !== 'NONE',
    startsInMs,
    durationMs: roundMs(durationMs + cadence * 0.12),
    shouldTelegraph: tier === 'HUNT' || tier === 'PUBLIC_SWARM' || tier === 'BOSS_WINDOW',
    telegraphStrength01: clamp01(
      (tier === 'BOSS_WINDOW' ? 0.88 : tier === 'PUBLIC_SWARM' ? 0.76 : tier === 'HUNT' ? 0.58 : 0.24) +
      assessment.obsessionHeat01 * 0.12,
    ),
    revealDelayMs: tier === 'NONE'
      ? 0
      : tier === 'GLARE'
        ? roundMs(220 + assessment.cooldown01 * 200)
        : tier === 'PROBE'
          ? roundMs(340 + assessment.cooldown01 * 260)
          : roundMs(120 + assessment.cooldown01 * 120),
  };
}

function shouldUseCallback(
  request: RivalryEscalationRequest,
  assessment: RivalryEscalationAssessment,
  config: RivalryEscalationPolicyConfig,
): boolean {
  if (!request.context.allowReceipts) return false;
  if (request.callback.tier === 'NONE') return false;
  if (request.callback.tier === 'RECEIPT') return assessment.humiliationValue01 >= config.humiliationReceiptFloor01;
  return request.callback.suitability01 >= config.callbackPublicFloor01 || assessment.privateStageFit01 >= 0.52;
}

function buildWitnessPlan(
  request: RivalryEscalationRequest,
  tier: RivalryEscalationTier,
  assessment: RivalryEscalationAssessment,
): RivalryWitnessPlan {
  const shouldForcePublicWitness =
    request.context.allowPublicSwarm &&
    (tier === 'PUBLIC_SWARM' || tier === 'BOSS_WINDOW' || assessment.witnessMagnet01 >= 0.72);
  const maxWitness = Math.max(0, request.context.maxWitnessCount ?? 3);
  const preferredWitnessCount = tier === 'BOSS_WINDOW'
    ? Math.min(3, maxWitness)
    : tier === 'PUBLIC_SWARM'
      ? Math.min(3, maxWitness)
      : tier === 'HUNT'
        ? Math.min(2, maxWitness)
        : tier === 'PRESSURE'
          ? Math.min(1, maxWitness)
          : 0;
  const channel = channelKey(request);
  return Object.freeze({
    shouldForcePublicWitness,
    preferredWitnessCount,
    witnessMagnet01: assessment.witnessMagnet01,
    witnessReason:
      shouldForcePublicWitness
        ? `force_public_witness:${channel}`
        : assessment.publicStageFit01 > assessment.privateStageFit01
          ? 'public_fit_exceeds_private_fit'
          : 'no_forced_witness',
    preferredChannels: freezeArray(
      shouldForcePublicWitness
        ? [channel, channel === 'DIRECT' ? 'GLOBAL' : 'SPECTATOR', 'GLOBAL']
        : [channel],
    ),
  });
}

function buildReceiptPlan(
  request: RivalryEscalationRequest,
  tier: RivalryEscalationTier,
  assessment: RivalryEscalationAssessment,
  config: RivalryEscalationPolicyConfig,
): RivalryReceiptPlan {
  const use = shouldUseCallback(request, assessment, config);
  return Object.freeze({
    shouldUseCallback: use,
    shouldQuotePlayerBack: use && (request.callback.tier === 'HARD' || request.callback.tier === 'RECEIPT'),
    callbackTier: request.callback.tier,
    callbackId: request.callback.callbackId,
    callbackLabel: request.callback.label,
    callbackText: request.callback.text,
    receiptWindowMs: tier === 'BOSS_WINDOW' ? 900 : tier === 'PUBLIC_SWARM' ? 1100 : 1400,
    receiptValue01: clamp01(
      assessment.humiliationValue01 * 0.44 +
      request.callback.suitability01 * 0.24 +
      request.callback.witnessValue01 * 0.10 +
      (request.callback.safeForPublic ? 0.08 : 0) +
      (use ? 0.14 : 0),
    ),
  });
}

function buildSilencePlan(
  request: RivalryEscalationRequest,
  tier: RivalryEscalationTier,
  assessment: RivalryEscalationAssessment,
): RivalrySilencePlan {
  const shouldDelayReveal =
    request.context.allowDelayedReveal &&
    (tier === 'GLARE' || tier === 'PROBE' || (tier === 'PRESSURE' && assessment.cooldown01 >= 0.07));
  const shouldPreferSilence =
    tier === 'NONE' ||
    assessment.privateStageFit01 > assessment.publicStageFit01 + 0.18 ||
    assessment.silenceValue01 >= 0.62;
  return Object.freeze({
    shouldPreferSilence,
    shouldDelayReveal,
    silenceValue01: assessment.silenceValue01,
    revealDelayMs: shouldDelayReveal ? roundMs(assessment.cooldown01 * 480 + 220) : 0,
    silenceReason:
      shouldPreferSilence
        ? (isPrivateChannel(channelKey(request)) ? 'private_channel_precision' : 'silence_has_more_value_than_spectacle')
        : 'overt_action_preferred',
  });
}

function buildSuppressionPlan(
  request: RivalryEscalationRequest,
  tier: RivalryEscalationTier,
  assessment: RivalryEscalationAssessment,
  config: RivalryEscalationPolicyConfig,
): RivalrySuppressionPlan {
  const shouldSuppress =
    request.context.rescueWindowOpen &&
    assessment.helperSuppressionValue01 >= config.rescueSuppressionFloor01 &&
    tier !== 'NONE';
  const method: RivalrySuppressionMethod =
    !shouldSuppress ? 'NONE' :
    tier === 'BOSS_WINDOW' ? 'MUTE_HELPERS' :
    tier === 'PUBLIC_SWARM' ? 'SHADOW' :
    isDealRoom(channelKey(request)) ? 'DECORUM' : 'REASSIGN';
  const reason =
    !shouldSuppress ? 'NONE' :
    request.context.rescueWindowOpen ? 'HELPER_PROTECTION' : 'NONE';
  return Object.freeze({
    shouldSuppressHelpers: shouldSuppress,
    method,
    suppressionStrength01: shouldSuppress ? assessment.helperSuppressionValue01 : 0,
    reason,
    durationMs: shouldSuppress ? (tier === 'BOSS_WINDOW' ? 12_000 : 7_500) : 0,
  });
}

function buildThreatFingerprint(request: RivalryEscalationRequest, assessment: RivalryEscalationAssessment): RivalryThreatFingerprint {
  return Object.freeze({
    counterpartId: request.state.counterpartId,
    counterpartKind: request.state.counterpartKind,
    stance: request.state.stance,
    objective: request.state.objective,
    dominantAxes: freezeArray(request.state.dominantAxes),
    heatSignature01: clamp01(assessment.hostility01 * 0.45 + assessment.obsessionHeat01 * 0.25 + assessment.spectacleRisk01 * 0.12 + assessment.humiliationValue01 * 0.18),
    obsessionSignature01: request.state.vector.obsession01,
    publicThreat01: vectorPublicThreat01(request.state.vector),
    privateThreat01: vectorPrivateThreat01(request.state.vector),
  });
}

function buildCadenceWindow(
  request: RivalryEscalationRequest,
  tier: RivalryEscalationTier,
  assessment: RivalryEscalationAssessment,
  config: RivalryEscalationPolicyConfig,
): RivalryCadenceWindow {
  const modeProfile = RIVALRY_MODE_ESCALATION_PROFILES[modeIdOr(request)] ?? RIVALRY_MODE_ESCALATION_PROFILES.GO_ALONE;
  const persona = personaIdOr(request) ? RIVALRY_PERSONA_PROFILES[personaIdOr(request)!] : undefined;
  const paceMultiplier = clamp01(
    0.28 +
    modeProfile.escalationPaceMultiplier * 0.34 +
    (persona?.attackTimingBias01 ?? 0.50) * 0.18 +
    assessment.hostility01 * 0.12 +
    assessment.cooldown01 * 0.08,
  );
  const cadenceMs = roundMs(
    config.baseAttackCadenceMs *
    (1.35 - paceMultiplier) *
    (1.08 - assessment.obsessionHeat01 * 0.20) *
    (tier === 'BOSS_WINDOW' ? 0.74 : tier === 'PUBLIC_SWARM' ? 0.82 : tier === 'HUNT' ? 0.88 : 1.00),
  );
  const tempoLabel =
    paceMultiplier >= 0.82 ? 'VIOLENT' :
    paceMultiplier >= 0.62 ? 'TENSE' :
    paceMultiplier >= 0.44 ? 'MEASURED' : 'COLD';
  return Object.freeze({
    cadenceMs,
    paceMultiplier,
    tempoLabel,
    nextActionEtaMs: roundMs(cadenceMs * (1.04 - assessment.cooldown01 * 0.24)),
  });
}

function computeShadowHeat01(
  assessment: RivalryEscalationAssessment,
  silencePlan: RivalrySilencePlan,
  witnessPlan: RivalryWitnessPlan,
): number {
  return clamp01(
    assessment.hostility01 * 0.32 +
    assessment.obsessionHeat01 * 0.18 +
    assessment.witnessMagnet01 * 0.12 +
    assessment.cooldown01 * 0.04 +
    assessment.silenceValue01 * 0.10 +
    assessment.spectacleRisk01 * 0.08 +
    (silencePlan.shouldDelayReveal ? 0.10 : 0) +
    (silencePlan.shouldPreferSilence ? 0.06 : 0),
  );
}

function computePublicEmbarrassment01(
  assessment: RivalryEscalationAssessment,
  witnessPlan: RivalryWitnessPlan,
  receiptPlan: RivalryReceiptPlan,
): number {
  return clamp01(
    assessment.humiliationValue01 * 0.44 +
    assessment.publicStageFit01 * 0.20 +
    assessment.spectacleRisk01 * 0.12 +
    (witnessPlan.shouldForcePublicWitness ? 0.12 : 0) +
    (receiptPlan.shouldUseCallback && receiptPlan.callbackTier === 'RECEIPT' ? 0.12 : 0),
  );
}

function tags(request: RivalryEscalationRequest, tier: RivalryEscalationTier, assessment: RivalryEscalationAssessment): readonly string[] {
  const out = new Set<string>();
  out.add(`tier:${tier.toLowerCase()}`);
  out.add(`stance:${request.state.stance.toLowerCase()}`);
  out.add(`objective:${request.state.objective.toLowerCase()}`);
  out.add(`channel:${channelKey(request).toLowerCase()}`);
  out.add(`pressure:${request.context.pressureBand.toLowerCase()}`);
  out.add(`kind:${request.state.counterpartKind.toLowerCase()}`);
  if (assessment.obsessionHeat01 >= 0.62) out.add('obsession:hot');
  if (assessment.humiliationValue01 >= 0.61) out.add('humiliation:valuable');
  if (assessment.rescueCounterweight01 >= 0.57) out.add('rescue:counterweight');
  if (request.callback.tier !== 'NONE') out.add(`callback:${request.callback.tier.toLowerCase()}`);
  if (assessment.packPotential01 >= 0.64) out.add('pack:ready');
  if (assessment.silenceValue01 >= 0.62) out.add('silence:preferred');
  if (assessment.bossFightReadiness01 >= 0.84) out.add('boss:near');
  return freezeStringArray(out);
}

function notes(
  request: RivalryEscalationRequest,
  assessment: RivalryEscalationAssessment,
  score: number,
  tier: RivalryEscalationTier,
): readonly string[] {
  const lines = [
    `tier=${tier}`,
    `score=${score.toFixed(3)}`,
    `hostility=${assessment.hostility01.toFixed(3)}`,
    `rivalry=${assessment.rivalry01.toFixed(3)}`,
    `public_fit=${assessment.publicStageFit01.toFixed(3)}`,
    `private_fit=${assessment.privateStageFit01.toFixed(3)}`,
    `boss_readiness=${assessment.bossFightReadiness01.toFixed(3)}`,
    `cooldown=${assessment.cooldown01.toFixed(3)}`,
    `event=${eventTypeOr(request)}`,
    `event_note=${RIVALRY_EVENT_NOTES[eventTypeOr(request)]}`,
  ];
  if (request.callback.tier !== 'NONE') lines.push(`callback=${request.callback.tier}:${request.callback.label ?? 'latest'}`);
  if (tier !== 'NONE') lines.push(`tier_note=${RIVALRY_TIER_NOTES[tier].note}`);
  return freezeArray(lines);
}

function createDefaultStateMachineState(): RivalryStateMachineState {
  return Object.freeze({
    currentTier: 'NONE',
    previousTier: 'NONE',
    enteredAt: 0,
    timeInTierMs: 0,
    transitionCount: 0,
    lastTransitionAt: 0,
    isValidState: true,
  });
}

function transitionAllowed(fromTier: RivalryEscalationTier, toTier: RivalryEscalationTier): boolean {
  return (VALID_TRANSITIONS[fromTier] ?? []).includes(toTier);
}

function classifyAnomalies(decision: RivalryEscalationDecision, request: RivalryEscalationRequest): readonly RivalryAnomalySignal[] {
  const anomalies: RivalryAnomalySignal[] = [];
  if (decision.shadowHeat01 >= 0.70 && decision.selectedScore01 < 0.20) {
    anomalies.push({ type: 'HEAT_WITHOUT_SCORE', severity01: 0.56, description: 'shadow heat is high but selected score stayed low' });
  }
  if (decision.selectedTier === 'PUBLIC_SWARM' && decision.preferredWitnessCount === 0) {
    anomalies.push({ type: 'SWARM_WITHOUT_WITNESSES', severity01: 0.78, description: 'public swarm selected without witness demand' });
  }
  if (decision.selectedTier === 'BOSS_WINDOW' && decision.assessment.negotiationDiscipline01 >= 0.70) {
    anomalies.push({ type: 'BOSS_WITH_DECORUM', severity01: 0.62, description: 'boss window is open while decorum remains high' });
  }
  if (decision.shouldSuppressHelpers && !request.context.rescueWindowOpen) {
    anomalies.push({ type: 'HELPER_SUPPRESSION_CONTRADICTION', severity01: 0.66, description: 'helper suppression engaged without rescue window' });
  }
  if (decision.receiptPlan.shouldUseCallback && !decision.receiptPlan.callbackId) {
    anomalies.push({ type: 'RECEIPT_WITHOUT_CALLBACK', severity01: 0.44, description: 'receipt plan wants callback but no callback id is available' });
  }
  if (anomalies.length === 0) {
    anomalies.push({ type: 'NONE', severity01: 0, description: 'no anomalies detected' });
  }
  return freezeArray(anomalies);
}

function buildTelemetryFrame(request: RivalryEscalationRequest, decision: RivalryEscalationDecision): RivalryTelemetryFrame {
  return Object.freeze({
    counterpartId: request.state.counterpartId,
    channelId: channelKey(request),
    mode: request.context.mode,
    selectedTier: decision.selectedTier,
    score01: decision.selectedScore01,
    hostility01: decision.assessment.hostility01,
    rivalry01: decision.assessment.rivalry01,
    spectacleRisk01: decision.assessment.spectacleRisk01,
    witnessDemand: decision.preferredWitnessCount,
    tags: decision.tags,
  });
}

function buildReplayFrame(request: RivalryEscalationRequest, decision: RivalryEscalationDecision, actions: readonly RivalryOrchestrationAction[]): RivalryReplayFrame {
  return Object.freeze({
    counterpartId: request.state.counterpartId,
    timestamp: request.context.now,
    tier: decision.selectedTier,
    notes: decision.notes,
    actions: freezeArray(actions.map((action) => `${action.actionType}@${action.executeAfterMs}`)),
  });
}

function buildOrchestrationActions(
  request: RivalryEscalationRequest,
  decision: RivalryEscalationDecision,
): readonly RivalryOrchestrationAction[] {
  const actions: RivalryOrchestrationAction[] = [];
  const counterpartId = request.state.counterpartId;

  actions.push({
    actionType: 'STAMP_AUDIT',
    counterpartId,
    priority01: 0.99,
    executeAfterMs: 0,
    payload: Object.freeze({ tier: decision.selectedTier, score01: decision.selectedScore01 }),
  });

  actions.push({
    actionType: 'EMIT_TELEMETRY',
    counterpartId,
    priority01: 0.98,
    executeAfterMs: 0,
    payload: Object.freeze({ mode: request.context.mode, channelId: channelKey(request), pressureBand: request.context.pressureBand }),
  });

  if (decision.silencePlan.shouldPreferSilence) {
    actions.push({
      actionType: 'HOLD_SILENCE',
      counterpartId,
      priority01: clamp01(0.52 + decision.silencePlan.silenceValue01 * 0.28),
      executeAfterMs: 0,
      payload: Object.freeze({ reason: decision.silencePlan.silenceReason }),
    });
  }

  if (decision.selectedTier === 'GLARE') {
    actions.push({
      actionType: 'SETUP_GLARE',
      counterpartId,
      priority01: clamp01(0.40 + decision.selectedScore01 * 0.22),
      executeAfterMs: decision.silencePlan.revealDelayMs,
      payload: Object.freeze({ telegraph01: decision.attackWindow.telegraphStrength01 }),
    });
  }

  if (decision.selectedTier === 'PROBE') {
    actions.push({
      actionType: 'ASK_PROBING_QUESTION',
      counterpartId,
      priority01: clamp01(0.50 + decision.selectedScore01 * 0.20),
      executeAfterMs: decision.silencePlan.revealDelayMs,
      payload: Object.freeze({ questionWeight01: decision.assessment.privateStageFit01 }),
    });
  }

  if (decision.receiptPlan.shouldUseCallback) {
    actions.push({
      actionType: 'DEPLOY_CALLBACK',
      counterpartId,
      priority01: clamp01(0.58 + decision.receiptPlan.receiptValue01 * 0.24),
      executeAfterMs: decision.receiptPlan.receiptWindowMs,
      payload: Object.freeze({
        callbackId: decision.receiptPlan.callbackId ?? null,
        label: decision.receiptPlan.callbackLabel ?? null,
        quotePlayerBack: decision.receiptPlan.shouldQuotePlayerBack,
      }),
    });
  }

  if (decision.receiptPlan.shouldQuotePlayerBack) {
    actions.push({
      actionType: 'QUOTE_PLAYER_BACK',
      counterpartId,
      priority01: clamp01(0.62 + decision.receiptPlan.receiptValue01 * 0.22),
      executeAfterMs: decision.receiptPlan.receiptWindowMs,
      payload: Object.freeze({ callbackText: decision.receiptPlan.callbackText ?? null }),
    });
  }

  if (decision.witnessPlan.shouldForcePublicWitness) {
    actions.push({
      actionType: 'FORCE_WITNESS',
      counterpartId,
      priority01: clamp01(0.60 + decision.assessment.witnessMagnet01 * 0.25),
      executeAfterMs: 0,
      payload: Object.freeze({
        channels: decision.witnessPlan.preferredChannels,
        witnessCount: decision.witnessPlan.preferredWitnessCount,
      }),
    });
  }

  if (decision.silencePlan.shouldDelayReveal) {
    actions.push({
      actionType: 'DELAY_REVEAL',
      counterpartId,
      priority01: clamp01(0.47 + decision.assessment.silenceValue01 * 0.20),
      executeAfterMs: 0,
      payload: Object.freeze({ revealDelayMs: decision.silencePlan.revealDelayMs }),
    });
  }

  if (decision.attackWindow.open) {
    actions.push({
      actionType: 'OPEN_ATTACK_WINDOW',
      counterpartId,
      priority01: clamp01(0.68 + decision.selectedScore01 * 0.18),
      executeAfterMs: decision.attackWindow.startsInMs,
      payload: Object.freeze({
        durationMs: decision.attackWindow.durationMs,
        shouldTelegraph: decision.attackWindow.shouldTelegraph,
      }),
    });
  }

  if (decision.suppressionPlan.shouldSuppressHelpers) {
    actions.push({
      actionType: 'SUPPRESS_HELPERS',
      counterpartId,
      priority01: clamp01(0.44 + decision.suppressionPlan.suppressionStrength01 * 0.30),
      executeAfterMs: 0,
      payload: Object.freeze({
        method: decision.suppressionPlan.method,
        durationMs: decision.suppressionPlan.durationMs,
      }),
    });
  }

  if (decision.selectedTier === 'BOSS_WINDOW') {
    actions.push({
      actionType: 'RESERVE_BOSS_SLOT',
      counterpartId,
      priority01: 0.96,
      executeAfterMs: 0,
      payload: Object.freeze({
        requiredChannel: channelKey(request),
        requiredPressureBand: request.context.pressureBand,
      }),
    });
  }

  if (decision.selectedTier === 'NONE' && decision.assessment.cooldown01 >= 0.22) {
    actions.push({
      actionType: 'WAIT',
      counterpartId,
      priority01: 0.35,
      executeAfterMs: roundMs(decision.cadenceWindow.cadenceMs * 0.8),
      payload: Object.freeze({ untilCooldownDrops: true }),
    });
  }

  return freezeArray(actions.sort((a, b) => b.priority01 - a.priority01 || a.executeAfterMs - b.executeAfterMs));
}

function buildOrchestrationPlan(
  request: RivalryEscalationRequest,
  decision: RivalryEscalationDecision,
): RivalryOrchestrationPlan {
  const actions = buildOrchestrationActions(request, decision);
  const totalPriority01 = clamp01(actions.reduce((sum, action) => sum + action.priority01 * 0.12, 0));
  const estimatedCompletionMs = roundMs(actions.reduce((max, action) => Math.max(max, action.executeAfterMs), 0) + decision.attackWindow.durationMs);
  return Object.freeze({
    counterpartId: request.state.counterpartId,
    selectedTier: decision.selectedTier,
    actions,
    totalPriority01,
    estimatedCompletionMs,
    witnessPlan: decision.witnessPlan,
    receiptPlan: decision.receiptPlan,
    silencePlan: decision.silencePlan,
    suppressionPlan: decision.suppressionPlan,
  });
}

function buildDecision(request: RivalryEscalationRequest, config: RivalryEscalationPolicyConfig): RivalryEscalationDecision {
  const assessment = buildAssessment(request, config);
  const score = selectedScore01(request, assessment, config);
  const tier = chooseTier(request, assessment, score, config);
  const suppression = suppressionReason(request, assessment, tier, config);
  const attack = attackWindow(request, tier, assessment, config);
  const witnessPlan = buildWitnessPlan(request, tier, assessment);
  const receiptPlan = buildReceiptPlan(request, tier, assessment, config);
  const silencePlan = buildSilencePlan(request, tier, assessment);
  const suppressionPlan = buildSuppressionPlan(request, tier, assessment, config);
  const threatFingerprint = buildThreatFingerprint(request, assessment);
  const cadenceWindow = buildCadenceWindow(request, tier, assessment, config);

  return Object.freeze({
    selectedTier: tier,
    selectedScore01: score,
    shadowHeat01: computeShadowHeat01(assessment, silencePlan, witnessPlan),
    publicEmbarrassment01: computePublicEmbarrassment01(assessment, witnessPlan, receiptPlan),
    shouldUseCallback: receiptPlan.shouldUseCallback,
    shouldQuotePlayerBack: receiptPlan.shouldQuotePlayerBack,
    shouldPreferSilence: silencePlan.shouldPreferSilence,
    shouldDelayReveal: silencePlan.shouldDelayReveal,
    shouldSuppressHelpers: suppressionPlan.shouldSuppressHelpers,
    shouldForcePublicWitness: witnessPlan.shouldForcePublicWitness,
    shouldEscalateToBossFight: tier === 'BOSS_WINDOW',
    preferredWitnessCount: witnessPlan.preferredWitnessCount,
    suppressionReason: suppressionPlan.reason === 'NONE' ? suppression : suppressionPlan.reason,
    attackWindow: attack,
    tags: tags(request, tier, assessment),
    notes: notes(request, assessment, score, tier),
    assessment,
    witnessPlan,
    receiptPlan,
    silencePlan,
    suppressionPlan,
    threatFingerprint,
    cadenceWindow,
  });
}

// ============================================================================
// MARK: Public class
// ============================================================================

export class RivalryEscalationPolicy {
  private readonly config: RivalryEscalationPolicyConfig;
  private readonly escalationStates = new Map<string, RivalryStateMachineState>();
  private readonly escalationHistory = new Map<string, RivalryEscalationHistoryEntry[]>();
  private readonly trajectoryHistory = new Map<string, RivalryTrajectorySnapshot[]>();
  private readonly auditTrail = new Map<string, RivalryEscalationAuditEntry[]>();
  private readonly bossReservations = new Map<string, RivalryBossWindowReservation>();
  private readonly packTracks = new Map<string, RivalryPackTrack>();

  public constructor(config: Partial<RivalryEscalationPolicyConfig> = {}) {
    this.config = Object.freeze({
      ...DEFAULT_RIVALRY_ESCALATION_POLICY_CONFIG,
      ...config,
      stanceBiases: Object.freeze({
        ...DEFAULT_RIVALRY_ESCALATION_POLICY_CONFIG.stanceBiases,
        ...(config.stanceBiases ?? {}),
      }),
      channelBiases: Object.freeze({
        ...DEFAULT_RIVALRY_ESCALATION_POLICY_CONFIG.channelBiases,
        ...(config.channelBiases ?? {}),
      }),
      pressureBiases: Object.freeze({
        ...DEFAULT_RIVALRY_ESCALATION_POLICY_CONFIG.pressureBiases,
        ...(config.pressureBiases ?? {}),
      }),
      eventHeat: Object.freeze({
        ...DEFAULT_RIVALRY_ESCALATION_POLICY_CONFIG.eventHeat,
        ...(config.eventHeat ?? {}),
      }),
      eventPublicness: Object.freeze({
        ...DEFAULT_RIVALRY_ESCALATION_POLICY_CONFIG.eventPublicness,
        ...(config.eventPublicness ?? {}),
      }),
      eventHostility: Object.freeze({
        ...DEFAULT_RIVALRY_ESCALATION_POLICY_CONFIG.eventHostility,
        ...(config.eventHostility ?? {}),
      }),
      eventPrestige: Object.freeze({
        ...DEFAULT_RIVALRY_ESCALATION_POLICY_CONFIG.eventPrestige,
        ...(config.eventPrestige ?? {}),
      }),
      counterpartKindBiases: Object.freeze({
        ...DEFAULT_RIVALRY_ESCALATION_POLICY_CONFIG.counterpartKindBiases,
        ...(config.counterpartKindBiases ?? {}),
      }),
      objectiveBiases: Object.freeze({
        ...DEFAULT_RIVALRY_ESCALATION_POLICY_CONFIG.objectiveBiases,
        ...(config.objectiveBiases ?? {}),
      }),
    });
  }

  private counterpartKey(playerId: string, counterpartId: string): string {
    return `${playerId}:${counterpartId}`;
  }

  private createReservationKey(channelId: string, counterpartId: string): string {
    return `${channelId}:${counterpartId}`;
  }

  private pruneBoundedEntries<T>(items: T[], maxEntries: number): T[] {
    if (items.length <= maxEntries) return items;
    items.splice(0, items.length - maxEntries);
    return items;
  }

  public assess(request: RivalryEscalationRequest): RivalryEscalationAssessment {
    return buildAssessment(request, this.config);
  }

  public resolve(request: RivalryEscalationRequest): RivalryEscalationDecision {
    return buildDecision(request, this.config);
  }

  public getEscalationState(playerId: string, counterpartId: string): RivalryStateMachineState {
    return this.escalationStates.get(this.counterpartKey(playerId, counterpartId)) ?? createDefaultStateMachineState();
  }

  public transitionEscalation(
    playerId: string,
    counterpartId: string,
    targetTier: RivalryEscalationTier,
    at: number,
  ): RivalryStateTransitionResult {
    const key = this.counterpartKey(playerId, counterpartId);
    const current = this.getEscalationState(playerId, counterpartId);
    if (!transitionAllowed(current.currentTier, targetTier)) {
      return {
        success: false,
        fromTier: current.currentTier,
        toTier: targetTier,
        reason: `invalid_transition_${current.currentTier}_to_${targetTier}`,
        timestamp: at,
      };
    }
    const next: RivalryStateMachineState = Object.freeze({
      currentTier: targetTier,
      previousTier: current.currentTier,
      enteredAt: at,
      timeInTierMs: 0,
      transitionCount: current.transitionCount + 1,
      lastTransitionAt: at,
      isValidState: true,
    });
    this.escalationStates.set(key, next);
    return {
      success: true,
      fromTier: current.currentTier,
      toTier: targetTier,
      reason: 'valid_transition',
      timestamp: at,
    };
  }

  public recordEscalationDecision(
    playerId: string,
    counterpartId: string,
    decision: RivalryEscalationDecision,
    at: number,
  ): void {
    const key = this.counterpartKey(playerId, counterpartId);
    const entries = [...(this.escalationHistory.get(key) ?? [])];
    entries.push(Object.freeze({
      timestamp: at,
      tier: decision.selectedTier,
      score01: decision.selectedScore01,
      suppressed: decision.suppressionReason !== 'NONE',
      usedCallback: decision.shouldUseCallback,
      publicEmbarrassment01: decision.publicEmbarrassment01,
      cadenceMs: decision.cadenceWindow.cadenceMs,
    }));
    this.pruneBoundedEntries(entries, this.config.maxHistoryEntries);
    this.escalationHistory.set(key, entries);
  }

  public getEscalationHistory(playerId: string, counterpartId: string): readonly RivalryEscalationHistoryEntry[] {
    return freezeArray(this.escalationHistory.get(this.counterpartKey(playerId, counterpartId)) ?? []);
  }

  public averageEscalationIntensity(playerId: string, counterpartId: string): number {
    const history = this.getEscalationHistory(playerId, counterpartId);
    if (history.length === 0) return 0;
    const total = history.reduce((sum, entry) => sum + tierOrdinal(entry.tier), 0);
    return total / history.length / (TIER_ORDER.length - 1);
  }

  public isEscalationAccelerating(playerId: string, counterpartId: string): boolean {
    const history = this.getEscalationHistory(playerId, counterpartId);
    if (history.length < 4) return false;
    const recent = history.slice(-4);
    const deltas = recent.slice(1).map((entry, index) => tierOrdinal(entry.tier) - tierOrdinal(recent[index]!.tier));
    return deltas.every((delta) => delta > 0);
  }

  public recordTrajectorySnapshot(request: RivalryEscalationRequest, decision: RivalryEscalationDecision): RivalryTrajectorySnapshot {
    const key = this.counterpartKey(request.state.playerId ?? 'GLOBAL', request.state.counterpartId);
    const entries = [...(this.trajectoryHistory.get(key) ?? [])];
    const snapshot: RivalryTrajectorySnapshot = Object.freeze({
      counterpartId: request.state.counterpartId,
      timestamp: request.context.now,
      tier: decision.selectedTier,
      score01: decision.selectedScore01,
      hostility01: decision.assessment.hostility01,
      rivalry01: decision.assessment.rivalry01,
      publicStageFit01: decision.assessment.publicStageFit01,
      privateStageFit01: decision.assessment.privateStageFit01,
      pressureBand: request.context.pressureBand,
    });
    entries.push(snapshot);
    this.pruneBoundedEntries(entries, this.config.maxHistoryEntries);
    this.trajectoryHistory.set(key, entries);
    return snapshot;
  }

  public getTrajectoryHistory(playerId: string, counterpartId: string): readonly RivalryTrajectorySnapshot[] {
    return freezeArray(this.trajectoryHistory.get(this.counterpartKey(playerId, counterpartId)) ?? []);
  }

  public predictNextEscalation(
    playerId: string,
    counterpartId: string,
    history: readonly RivalryEscalationDecision[],
  ): RivalryEscalationPrediction {
    const current = this.getEscalationState(playerId, counterpartId);
    if (history.length < 2) {
      return {
        predictedTier: current.currentTier,
        estimatedTicksUntil: -1,
        confidence01: 0.10,
        triggerConditions: freezeArray(['insufficient_history']),
      };
    }

    const recentTiers = history.slice(-6).map((entry) => entry.selectedTier);
    const escalationRate =
      recentTiers.filter((tier, index) => index > 0 && tierOrdinal(tier) > tierOrdinal(recentTiers[index - 1]!)).length /
      Math.max(1, recentTiers.length - 1);
    const allowed = VALID_TRANSITIONS[current.currentTier] ?? [];
    const nextUp = allowed.find((tier) => tierOrdinal(tier) > tierOrdinal(current.currentTier));

    return {
      predictedTier: nextUp ?? current.currentTier,
      estimatedTicksUntil: escalationRate > 0.50 ? 3 : escalationRate > 0.25 ? 8 : 20,
      confidence01: clamp01(escalationRate * 0.70 + (history.length / 20) * 0.30),
      triggerConditions: freezeArray(
        escalationRate > 0.50 ? ['high_escalation_rate', 'recent_momentum'] : ['moderate_pattern'],
      ),
    };
  }

  public assessPackFormation(
    rivals: readonly { counterpartId: string; escalation: RivalryEscalationDecision }[],
    context: RivalryEscalationContext,
  ): PackHuntAssessment {
    if (rivals.length < 2) {
      return {
        canFormPack: false,
        reason: 'insufficient_rivals',
        packSize: 0,
        roles: freezeArray([]),
        pressureBudget01: 0,
        witnessDemand: 0,
      };
    }

    const huntReady = rivals.filter((rival) =>
      rival.escalation.selectedTier === 'HUNT' ||
      rival.escalation.selectedTier === 'PUBLIC_SWARM' ||
      rival.escalation.selectedTier === 'BOSS_WINDOW',
    );
    if (huntReady.length < 2) {
      return {
        canFormPack: false,
        reason: 'insufficient_hunt_ready',
        packSize: 0,
        roles: freezeArray([]),
        pressureBudget01: 0,
        witnessDemand: 0,
      };
    }

    const sorted = [...huntReady].sort((a, b) => b.escalation.selectedScore01 - a.escalation.selectedScore01);
    const roles: PackHuntRole[] = sorted.slice(0, 4).map((rival, index) => ({
      counterpartId: rival.counterpartId,
      packRole: index === 0 ? 'POINT' : index === 1 ? 'PRESSURE' : index === 2 ? 'FLANK' : 'RECEIPT_CLOSER',
      escalationScore01: rival.escalation.selectedScore01,
    }));
    const pressureBudget01 = clamp01(sorted.reduce((sum, entry) => sum + entry.escalation.selectedScore01 * 0.18, 0));
    const witnessDemand = Math.min(
      context.maxWitnessCount ?? 4,
      sorted.reduce((sum, entry) => sum + entry.escalation.preferredWitnessCount, 0),
    );

    return {
      canFormPack: true,
      reason: 'pack_ready',
      packSize: roles.length,
      roles: freezeArray(roles),
      pressureBudget01,
      witnessDemand,
    };
  }

  public registerPackTrack(counterpartIds: readonly string[], leadCounterpartId: string, createdAt: number, witnessDemand: number, pressureBudget01: number): RivalryPackTrack {
    const track: RivalryPackTrack = Object.freeze({
      trackId: `pack:${leadCounterpartId}:${createdAt}`,
      createdAt,
      counterpartIds: freezeArray(counterpartIds),
      leadCounterpartId,
      witnessDemand,
      pressureBudget01: clamp01(pressureBudget01),
    });
    this.packTracks.set(track.trackId, track);
    if (this.packTracks.size > this.config.maxPackTracks) {
      const oldestKey = [...this.packTracks.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0]?.[0];
      if (oldestKey) this.packTracks.delete(oldestKey);
    }
    return track;
  }

  public listPackTracks(): readonly RivalryPackTrack[] {
    return freezeArray([...this.packTracks.values()].sort((a, b) => b.createdAt - a.createdAt));
  }

  public assessDeEscalation(request: RivalryEscalationRequest): DeEscalationDecision {
    const assessment = this.assess(request);
    const shouldRetreat =
      assessment.rescueCounterweight01 >= 0.60 ||
      (assessment.cooldown01 >= 0.50 && assessment.hostility01 < 0.40);
    const shouldRegroup = assessment.hostility01 >= 0.50 && assessment.cooldown01 >= 0.30 && !shouldRetreat;
    const shouldConcede = assessment.negotiationDiscipline01 >= 0.70 && assessment.publicStageFit01 < 0.30;

    return Object.freeze({
      shouldRetreat,
      shouldRegroup,
      shouldConcede,
      retreatReason:
        shouldRetreat ? (assessment.rescueCounterweight01 >= 0.60 ? 'helper_intervention' : 'cooldown_period') : 'none',
      suggestedCooldownMs: shouldRetreat ? 15_000 : shouldRegroup ? 8_000 : 0,
      gracefulExitStyle:
        shouldConcede ? 'DIGNIFIED_WITHDRAWAL' : shouldRetreat ? 'TACTICAL_RETREAT' : 'NONE',
    });
  }

  public reserveBossWindow(channelId: string, counterpartId: string, reservedAt: number, durationMs = 8_000): RivalryBossWindowReservation {
    const reservation: RivalryBossWindowReservation = Object.freeze({
      reservationId: `boss:${channelId}:${counterpartId}:${reservedAt}`,
      counterpartId,
      channelId,
      reservedAt,
      expiresAt: reservedAt + durationMs,
    });
    this.bossReservations.set(this.createReservationKey(channelId, counterpartId), reservation);
    const reservations = [...this.bossReservations.entries()].sort((a, b) => a[1].reservedAt - b[1].reservedAt);
    if (reservations.length > this.config.maxBossReservations) {
      const [oldestKey] = reservations[0];
      this.bossReservations.delete(oldestKey);
    }
    return reservation;
  }

  public isBossWindowReserved(channelId: string, now: number): boolean {
    for (const reservation of this.bossReservations.values()) {
      if (reservation.channelId === channelId && reservation.expiresAt > now) return true;
    }
    return false;
  }

  public sweepExpiredBossReservations(now: number): void {
    for (const [key, reservation] of this.bossReservations.entries()) {
      if (reservation.expiresAt <= now) this.bossReservations.delete(key);
    }
  }

  public listBossReservations(): readonly RivalryBossWindowReservation[] {
    return freezeArray([...this.bossReservations.values()].sort((a, b) => b.reservedAt - a.reservedAt));
  }

  public composeBossFight(request: RivalryEscalationRequest, decision: RivalryEscalationDecision): BossFightComposition {
    const assessment = decision.assessment;
    return Object.freeze({
      bossFightId: `bossfight:${request.state.counterpartId}:${request.context.now}`,
      counterpartId: request.state.counterpartId,
      entranceStyle: assessment.witnessMagnet01 >= 0.70 ? 'DRAMATIC_PUBLIC' : 'COLD_PRIVATE',
      openingMoveType: assessment.humiliationValue01 >= 0.60 ? 'RECEIPT_BARRAGE' : assessment.silenceValue01 >= 0.62 ? 'SILENCE_THEN_STRIKE' : 'PSYCHOLOGICAL_PROBE',
      preferredWitnessCount: decision.preferredWitnessCount,
      helperSuppressionDurationMs: decision.shouldSuppressHelpers ? 12_000 : 0,
      resolutionConditions: freezeArray(['PLAYER_CAPITULATES', 'PLAYER_COUNTER_WINS', 'MUTUAL_DESTRUCTION', 'STALEMATE_TIMEOUT']),
      estimatedDurationMs: 25_000,
      maxEscalationBudget: 5,
      requiredChannel: channelKey(request),
      requiredPressureBand: request.context.pressureBand,
    });
  }

  public generateAuditEntry(request: RivalryEscalationRequest, decision: RivalryEscalationDecision): RivalryEscalationAuditEntry {
    return Object.freeze({
      auditId: `audit:escalation:${request.state.counterpartId}:${request.context.now}`,
      counterpartId: request.state.counterpartId,
      inputHostility01: decision.assessment.hostility01,
      inputRivalry01: decision.assessment.rivalry01,
      inputIntensity01: request.state.intensity01,
      selectedTier: decision.selectedTier,
      selectedScore01: decision.selectedScore01,
      suppressionReason: decision.suppressionReason,
      shouldUseCallback: decision.shouldUseCallback,
      shouldQuotePlayerBack: decision.shouldQuotePlayerBack,
      shouldPreferSilence: decision.shouldPreferSilence,
      attackWindowOpen: decision.attackWindow.open,
      timestamp: request.context.now,
      contextMode: request.context.mode,
      contextPressureBand: request.context.pressureBand,
      tags: decision.tags,
    });
  }

  public appendAudit(playerId: string, counterpartId: string, audit: RivalryEscalationAuditEntry): void {
    const key = this.counterpartKey(playerId, counterpartId);
    const audits = [...(this.auditTrail.get(key) ?? [])];
    audits.push(audit);
    this.pruneBoundedEntries(audits, this.config.maxAuditEntries);
    this.auditTrail.set(key, audits);
  }

  public getAuditTrail(playerId: string, counterpartId: string): readonly RivalryEscalationAuditEntry[] {
    return freezeArray(this.auditTrail.get(this.counterpartKey(playerId, counterpartId)) ?? []);
  }

  public getLatestAudit(playerId: string, counterpartId: string): RivalryEscalationAuditEntry | undefined {
    return this.getAuditTrail(playerId, counterpartId).slice(-1)[0];
  }

  public getPersonaProfile(personaId: string): RivalPersonalityEscalationProfile | undefined {
    return RIVALRY_PERSONA_PROFILES[personaId];
  }

  public getModeEscalationProfile(modeId: string | undefined): ModeEscalationProfile {
    return RIVALRY_MODE_ESCALATION_PROFILES[modeId ?? ''] ?? RIVALRY_MODE_ESCALATION_PROFILES.GO_ALONE;
  }

  public getScenario(channelId: string, pressureBand: ChatRelationshipPressureBand): RivalryScenarioDescriptor {
    return scenarioFor(channelId, pressureBand);
  }

  public getChannelProfile(channelId: string): RivalryChannelProfile {
    return channelProfile(channelId);
  }

  public resolveWithPersona(request: RivalryEscalationRequest, personaId: string): RivalryEscalationDecision {
    const base = this.resolve(request);
    const persona = this.getPersonaProfile(personaId);
    if (!persona) return base;

    const adjustedScore = clamp01(base.selectedScore01 * (0.70 + persona.attackTimingBias01 * 0.30));
    const shouldUseCallback = base.shouldUseCallback || persona.receiptPreference01 >= 0.70;
    const shouldPreferSilence = persona.prefersSilenceBeforeStrike && (base.selectedTier === 'GLARE' || base.selectedTier === 'PROBE');

    return Object.freeze({
      ...base,
      selectedScore01: adjustedScore,
      shouldUseCallback,
      shouldQuotePlayerBack: shouldUseCallback && (base.shouldQuotePlayerBack || persona.receiptPreference01 >= 0.80),
      shouldPreferSilence: shouldPreferSilence || base.shouldPreferSilence,
      receiptPlan: Object.freeze({
        ...base.receiptPlan,
        shouldUseCallback,
        shouldQuotePlayerBack: shouldUseCallback && (base.receiptPlan.shouldQuotePlayerBack || persona.receiptPreference01 >= 0.80),
        receiptValue01: clamp01(base.receiptPlan.receiptValue01 * (0.78 + persona.receiptPreference01 * 0.22)),
      }),
      silencePlan: Object.freeze({
        ...base.silencePlan,
        shouldPreferSilence: shouldPreferSilence || base.silencePlan.shouldPreferSilence,
        silenceValue01: clamp01(base.silencePlan.silenceValue01 * (0.76 + (persona.prefersSilenceBeforeStrike ? 0.24 : 0.10))),
      }),
      cadenceWindow: Object.freeze({
        ...base.cadenceWindow,
        cadenceMs: roundMs(base.cadenceWindow.cadenceMs * (1.15 - persona.attackTimingBias01 * 0.25)),
      }),
      notes: freezeArray([...base.notes, `persona=${persona.label}`]),
    });
  }

  public resolveWithMode(request: RivalryEscalationRequest, modeId: string): RivalryEscalationDecision {
    const base = this.resolve(request);
    const profile = this.getModeEscalationProfile(modeId);
    const limitedTier = tierAtOrBelow(base.selectedTier, profile.preferredTierCeiling);
    if (limitedTier !== base.selectedTier) {
      return Object.freeze({
        ...base,
        selectedTier: limitedTier,
        shouldEscalateToBossFight: limitedTier === 'BOSS_WINDOW',
        shouldForcePublicWitness: limitedTier === 'PUBLIC_SWARM' || limitedTier === 'BOSS_WINDOW' ? base.shouldForcePublicWitness : false,
        suppressionReason: 'MODE_CEILING',
        notes: freezeArray([...base.notes, `mode_ceiling_enforced=${profile.label}`]),
      });
    }
    return base;
  }

  public buildOrchestrationPlan(request: RivalryEscalationRequest, decision: RivalryEscalationDecision): RivalryOrchestrationPlan {
    return buildOrchestrationPlan(request, decision);
  }

  public buildTelemetryFrame(request: RivalryEscalationRequest, decision: RivalryEscalationDecision): RivalryTelemetryFrame {
    return buildTelemetryFrame(request, decision);
  }

  public buildReplayFrame(request: RivalryEscalationRequest, decision: RivalryEscalationDecision, plan?: RivalryOrchestrationPlan): RivalryReplayFrame {
    const orchestration = plan ?? this.buildOrchestrationPlan(request, decision);
    return buildReplayFrame(request, decision, orchestration.actions);
  }

  public generateDiagnostic(request: RivalryEscalationRequest, personaId?: string): RivalryDiagnosticReport {
    const assessment = this.assess(request);
    const decision = personaId ? this.resolveWithPersona(request, personaId) : this.resolve(request);
    const state = this.getEscalationState(request.state.playerId ?? 'GLOBAL', request.state.counterpartId);
    const deEsc = this.assessDeEscalation(request);
    const persona = personaId ? this.getPersonaProfile(personaId) : undefined;

    return Object.freeze({
      counterpartId: request.state.counterpartId,
      currentStateMachineTier: state.currentTier,
      decisionTier: decision.selectedTier,
      decisionScore01: decision.selectedScore01,
      assessmentHostility01: assessment.hostility01,
      assessmentRivalry01: assessment.rivalry01,
      assessmentObsessionHeat01: assessment.obsessionHeat01,
      assessmentBossFightReadiness01: assessment.bossFightReadiness01,
      suppressionReason: decision.suppressionReason,
      attackWindowOpen: decision.attackWindow.open,
      shouldUseCallback: decision.shouldUseCallback,
      shouldQuotePlayerBack: decision.shouldQuotePlayerBack,
      deEscalationAdvised: deEsc.shouldRetreat || deEsc.shouldConcede,
      deEscalationReason: deEsc.retreatReason,
      personaId: persona?.personaId,
      personaLabel: persona?.label,
      personaReceiptPreference01: persona?.receiptPreference01,
      transitionCount: state.transitionCount,
      contextMode: request.context.mode,
      contextPressureBand: request.context.pressureBand,
      cadenceLabel: decision.cadenceWindow.tempoLabel,
    });
  }

  public buildDiagnosticLines(request: RivalryEscalationRequest, personaId?: string): readonly string[] {
    const report = this.generateDiagnostic(request, personaId);
    const lines: string[] = [];
    lines.push(`counterpart=${report.counterpartId}|tier=${report.decisionTier}|score=${report.decisionScore01.toFixed(3)}`);
    lines.push(`hostility=${report.assessmentHostility01.toFixed(3)}|rivalry=${report.assessmentRivalry01.toFixed(3)}|obsession=${report.assessmentObsessionHeat01.toFixed(3)}`);
    lines.push(`bossFightReady=${report.assessmentBossFightReadiness01.toFixed(3)}|suppression=${report.suppressionReason}`);
    lines.push(`attackWindow=${report.attackWindowOpen}|callback=${report.shouldUseCallback}|quoteBack=${report.shouldQuotePlayerBack}`);
    lines.push(`deEscAdvised=${report.deEscalationAdvised}|reason=${report.deEscalationReason}`);
    if (report.personaId) lines.push(`persona=${report.personaLabel}|receiptPref=${report.personaReceiptPreference01?.toFixed(2)}`);
    lines.push(`stateMachine=${report.currentStateMachineTier}|transitions=${report.transitionCount}`);
    lines.push(`mode=${report.contextMode}|pressure=${report.contextPressureBand}|tempo=${report.cadenceLabel}`);
    return freezeArray(lines);
  }

  public buildThreatFingerprint(request: RivalryEscalationRequest): RivalryThreatFingerprint {
    const decision = this.resolve(request);
    return decision.threatFingerprint;
  }

  public estimateExposure(request: RivalryEscalationRequest): RivalryCounterpartExposure {
    const assessment = this.assess(request);
    return Object.freeze({
      counterpartId: request.state.counterpartId,
      exposure01: clamp01(assessment.publicStageFit01 * 0.32 + assessment.privateStageFit01 * 0.18 + assessment.humiliationValue01 * 0.16 + assessment.spectacleRisk01 * 0.16 + assessment.hostility01 * 0.18),
      publicExposure01: clamp01(assessment.publicStageFit01 * 0.48 + assessment.witnessMagnet01 * 0.22 + assessment.spectacleRisk01 * 0.20 + assessment.humiliationValue01 * 0.10),
      privateExposure01: clamp01(assessment.privateStageFit01 * 0.46 + assessment.silenceValue01 * 0.18 + assessment.obsessionHeat01 * 0.20 + assessment.negotiationDiscipline01 * 0.16),
      instability01: clamp01(assessment.hostility01 * 0.22 + assessment.cooldown01 * 0.18 + assessment.packPotential01 * 0.20 + assessment.helperSuppressionValue01 * 0.18 + assessment.obsessionHeat01 * 0.22),
    });
  }

  public rankThreats(requests: readonly RivalryEscalationRequest[]): readonly { counterpartId: string; score01: number; tier: RivalryEscalationTier }[] {
    const ranked = requests.map((request) => {
      const decision = this.resolve(request);
      return {
        counterpartId: request.state.counterpartId,
        score01: decision.selectedScore01,
        tier: decision.selectedTier,
      };
    });
    return freezeArray(ranked.sort((a, b) => b.score01 - a.score01 || tierOrdinal(b.tier) - tierOrdinal(a.tier)));
  }

  public resolveEnvelope(
    request: RivalryEscalationRequest,
    playerId = request.state.playerId ?? 'GLOBAL',
  ): RivalryDecisionEnvelope {
    this.sweepExpiredBossReservations(request.context.now);

    let decision = this.resolve(request);

    const modeProfile = this.getModeEscalationProfile(modeIdOr(request));
    if (decision.selectedTier !== tierAtOrBelow(decision.selectedTier, modeProfile.preferredTierCeiling)) {
      decision = this.resolveWithMode(request, modeIdOr(request));
    }

    if (personaIdOr(request)) {
      decision = this.resolveWithPersona(request, personaIdOr(request)!);
    }

    if (decision.selectedTier === 'BOSS_WINDOW' && this.isBossWindowReserved(channelKey(request), request.context.now)) {
      decision = Object.freeze({
        ...decision,
        selectedTier: 'HUNT',
        shouldEscalateToBossFight: false,
        suppressionReason: 'BOSS_SLOT_OCCUPIED',
        notes: freezeArray([...decision.notes, 'boss_slot_occupied']),
      });
    }

    const stateTransition = this.transitionEscalation(playerId, request.state.counterpartId, decision.selectedTier, request.context.now);
    this.recordEscalationDecision(playerId, request.state.counterpartId, decision, request.context.now);
    this.recordTrajectorySnapshot(request, decision);
    const audit = this.generateAuditEntry(request, decision);
    this.appendAudit(playerId, request.state.counterpartId, audit);

    if (decision.selectedTier === 'BOSS_WINDOW') {
      this.reserveBossWindow(channelKey(request), request.state.counterpartId, request.context.now);
    }

    const orchestration = this.buildOrchestrationPlan(request, decision);
    const telemetry = this.buildTelemetryFrame(request, decision);
    const replay = this.buildReplayFrame(request, decision, orchestration);
    const anomalies = classifyAnomalies(decision, request);

    return Object.freeze({
      counterpartId: request.state.counterpartId,
      decision,
      orchestration,
      audit,
      telemetry,
      replay,
      anomalies,
      stateTransition,
    });
  }

  public clearCounterpart(playerId: string, counterpartId: string): void {
    const key = this.counterpartKey(playerId, counterpartId);
    this.escalationStates.delete(key);
    this.escalationHistory.delete(key);
    this.trajectoryHistory.delete(key);
    this.auditTrail.delete(key);
  }

  public clearAll(): void {
    this.escalationStates.clear();
    this.escalationHistory.clear();
    this.trajectoryHistory.clear();
    this.auditTrail.clear();
    this.bossReservations.clear();
    this.packTracks.clear();
  }
}

// ============================================================================
// MARK: Exported helper functions
// ============================================================================

export function createRivalryEscalationPolicy(config: Partial<RivalryEscalationPolicyConfig> = {}): RivalryEscalationPolicy {
  return new RivalryEscalationPolicy(config);
}

export function computeReceiptDeploymentWindow(
  personaProfile: RivalPersonalityEscalationProfile,
  currentTier: RivalryEscalationTier,
  audienceHeat01: number,
): { shouldDeploy: boolean; optimalDelayMs: number; reason: string } {
  if (personaProfile.receiptPreference01 < 0.40) {
    return { shouldDeploy: false, optimalDelayMs: 0, reason: 'persona_low_receipt_preference' };
  }
  const tierIdx = tierOrdinal(currentTier);
  if (tierIdx < 3) {
    return { shouldDeploy: false, optimalDelayMs: 0, reason: 'too_early_in_escalation' };
  }
  const baseDelay = personaProfile.escalationPaceMs;
  const audienceBonus = clamp01(audienceHeat01) * 2_000;
  const optimalDelayMs = roundMs(baseDelay + audienceBonus);
  return { shouldDeploy: true, optimalDelayMs, reason: `tier_${currentTier}_receipt_ready` };
}

export function shouldDissolvePackHunt(
  assessment: PackHuntAssessment,
  helperInterventionActive: boolean,
  playerIsRecovering: boolean,
): boolean {
  if (!assessment.canFormPack) return true;
  if (helperInterventionActive && assessment.packSize <= 2) return true;
  if (playerIsRecovering && assessment.packSize <= 3) return true;
  return false;
}

export function estimateRivalSocialCost01(
  tier: RivalryEscalationTier,
  audienceHeat01: number,
  helperPresent: boolean,
): number {
  const tierCost: Readonly<Record<RivalryEscalationTier, number>> = Object.freeze({
    NONE: 0.00,
    GLARE: 0.02,
    PROBE: 0.05,
    PRESSURE: 0.12,
    HUNT: 0.22,
    PUBLIC_SWARM: 0.38,
    BOSS_WINDOW: 0.55,
  });
  return clamp01(
    tierCost[tier] +
    clamp01(audienceHeat01) * 0.26 +
    (helperPresent ? 0.10 : 0),
  );
}

export function inferPersonaFromState(state: ChatRelationshipCounterpartState): string {
  const vector = state.vector;
  if (vector.predictiveConfidence01 >= 0.72 && vector.contempt01 >= 0.62) return 'THE_BUREAUCRAT';
  if (vector.obsession01 >= 0.78 && vector.fascination01 >= 0.56) return 'THE_MANIPULATOR';
  if (state.counterpartKind === 'ARCHIVIST') return 'THE_ARCHIVIST';
  if (state.publicPressureBias01 >= 0.78) return 'THE_SPECTACLE';
  if (vector.contempt01 >= 0.70 && vector.unfinishedBusiness01 >= 0.62) return 'THE_LIQUIDATOR';
  return 'LEGACY_HEIR';
}

export function describeTierEscalation(tier: RivalryEscalationTier): string {
  return RIVALRY_TIER_NOTES[tier].note;
}

export function explainEventHeat(eventType: ChatRelationshipEventType): string {
  return RIVALRY_EVENT_NOTES[eventType];
}

export function projectRivalryScenario(channelId: string, pressureBand: ChatRelationshipPressureBand): RivalryScenarioDescriptor {
  return scenarioFor(channelId, pressureBand);
}

export function computeEscalationVector(decision: RivalryEscalationDecision): readonly number[] {
  return freezeArray([
    decision.assessment.hostility01,
    decision.assessment.rivalry01,
    decision.assessment.publicStageFit01,
    decision.assessment.privateStageFit01,
    decision.assessment.obsessionHeat01,
    decision.assessment.witnessMagnet01,
    decision.assessment.humiliationValue01,
    decision.assessment.bossFightReadiness01,
  ]);
}

export function summarizeDecision(decision: RivalryEscalationDecision): string {
  return [
    `tier=${decision.selectedTier}`,
    `score=${decision.selectedScore01.toFixed(3)}`,
    `public=${decision.assessment.publicStageFit01.toFixed(3)}`,
    `private=${decision.assessment.privateStageFit01.toFixed(3)}`,
    `boss=${decision.assessment.bossFightReadiness01.toFixed(3)}`,
  ].join('|');
}
