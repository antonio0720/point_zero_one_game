
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT CHURN RESCUE POLICY
 * FILE: backend/src/game/engine/chat/rescue/ChurnRescuePolicy.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Backend law for deciding when a player is drifting toward disengagement,
 * embarrassment lock, panic, or collapse-induced silence — and for translating
 * that backend truth into a lawful rescue / recovery package using the shared
 * rescue and recovery contracts.
 *
 * This file is not a frontend comfort-copy helper.
 * This file is not a UI heuristic wrapper.
 * This file is not a loose analytics scorer.
 *
 * It exists because the backend must own:
 * - churn-risk scoring,
 * - rescue suppression law,
 * - urgency/style/kind selection,
 * - helper eligibility,
 * - public/private channel strategy,
 * - window timing hints,
 * - recovery expectation bands,
 * - and explainable reason trails.
 *
 * Design doctrine
 * ---------------
 * - Rescue should feel timely, not spammy.
 * - Silence is sometimes the correct intervention.
 * - Public humiliation cost is first-class.
 * - Deal room panic is different from crowd embarrassment.
 * - Boss-window lock must not be treated like generic frustration.
 * - Helper trust and crowd hostility are policy inputs, not cosmetic metadata.
 * - Every recommendation must be explainable after the fact.
 * ============================================================================
 */

import type {
  ChatRecoveryBundle,
  ChatRecoveryDigest,
  ChatRecoveryEntryPoint,
  ChatRecoveryOutcome,
  ChatRecoveryPlan,
  ChatRecoverySuccessBand,
  ChatRecoveryVisibility,
} from '../../../../../../shared/contracts/chat/ChatRecovery';
import {
  buildRecoveryPlan,
  createRecoveryOutcome,
  deriveRecoveryDigest,
  deriveRecoveryLiftSnapshot,
  deriveRecoverySuccessBand,
  toScore01 as toRecoveryScore01,
  toScore100 as toRecoveryScore100,
} from '../../../../../../shared/contracts/chat/ChatRecovery';
import type {
  ChatRescueAction,
  ChatRescueActor,
  ChatRescueDigest,
  ChatRescueGuardrail,
  ChatRescueHelperPosture,
  ChatRescueKind,
  ChatRescueLedgerEntry,
  ChatRescueOffer,
  ChatRescueOutcome,
  ChatRescuePlan,
  ChatRescueReasonCode,
  ChatRescueSignalVector,
  ChatRescueStateSnapshot,
  ChatRescueStyle,
  ChatRescueSuppressionReason,
  ChatRescueTelemetrySnapshot,
  ChatRescueTrigger,
  ChatRescueUrgencyBand,
  ChatRescueWindow,
} from '../../../../../../shared/contracts/chat/ChatRescue';
import {
  buildRescuePlan,
  buildRescueWindow,
  deriveRescueDigest,
  deriveRescueRecoverability01,
  deriveRescueStateSnapshot,
  deriveRescueTilt01,
  deriveRescueTriggerCandidates,
  createRescueLedgerEntry,
  shouldSuppressRescue,
  toScore01 as toRescueScore01,
  toScore100 as toRescueScore100,
} from '../../../../../../shared/contracts/chat/ChatRescue';
import type {
  ChatAffectSnapshot,
  ChatAudienceHeat,
  ChatFeatureSnapshot,
  ChatLearningProfile,
  ChatReputationState,
} from '../../../../../../shared/contracts/chat/ChatEvents';
import type { ChatBossFightState } from '../../../../../../shared/contracts/chat/ChatBossFight';

import type {
  ChatChannelId,
  ChatEventId,
  ChatMessage,
  ChatRoomId,
  ChatRoomState,
  ChatSessionId,
  ChatSessionState,
  ChatSignalEnvelope,
  ChatState,
  ChatVisibleChannel,
  JsonValue,
  PressureTier,
  Score01,
  Score100,
  UnixMs,
} from '../types';
import {
  asUnixMs,
  clamp01,
  clamp100,
  isVisibleChannelId,
} from '../types';

// ============================================================================
// MARK: Public contracts
// ============================================================================

export interface ChurnRescuePolicyClock {
  now(): number;
}

export interface ChurnRescuePolicyLogger {
  debug(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChurnRescuePolicyTuning {
  readonly silenceWatchMs: number;
  readonly silenceReadyMs: number;
  readonly silenceCriticalMs: number;
  readonly abortReadyCount: number;
  readonly abortCriticalCount: number;
  readonly failureReadyCount: number;
  readonly failureCriticalCount: number;
  readonly panelFlapReadyCount: number;
  readonly channelHopReadyCount: number;
  readonly crowdHostilityReady01: Score01;
  readonly crowdHostilityCritical01: Score01;
  readonly embarrassmentReady01: Score01;
  readonly embarrassmentCritical01: Score01;
  readonly frustrationReady01: Score01;
  readonly frustrationCritical01: Score01;
  readonly desperationReady01: Score01;
  readonly desperationCritical01: Score01;
  readonly confidenceFloor01: Score01;
  readonly helperReceptivityFloor01: Score01;
  readonly helperTrustFloor01: Score01;
  readonly publicRiskCutoff01: Score01;
  readonly hardSuppressConfidence01: Score01;
  readonly hardSuppressRecoverability01: Score01;
  readonly rescueCooldownMs: number;
  readonly shadowOnlyCutoff01: Score01;
  readonly criticalWindowMs: number;
  readonly immediateWindowMs: number;
  readonly readyWindowMs: number;
  readonly watchWindowMs: number;
}

export interface ChurnRescuePolicyOptions {
  readonly clock?: ChurnRescuePolicyClock;
  readonly logger?: ChurnRescuePolicyLogger;
  readonly tuning?: Partial<ChurnRescuePolicyTuning>;
}

export interface ChurnRescueTelemetryFrame {
  readonly now?: UnixMs;
  readonly silenceMs?: number;
  readonly composerAbortStreak?: number;
  readonly failedActionChain?: number;
  readonly panelFlapCount?: number;
  readonly channelHopCount?: number;
  readonly dealRoomExposure01?: Score01;
  readonly crowdHostility01?: Score01;
  readonly unreadPressure01?: Score01;
  readonly helperAlreadyActive?: boolean;
  readonly helperIgnoredThenReturned?: boolean;
  readonly recentCollapse?: boolean;
  readonly negativeSendFailures?: number;
  readonly counterWindowOpen?: boolean;
  readonly bossFightState?: ChatBossFightState | null;
  readonly lastRescueAt?: UnixMs | null;
  readonly activeRescueId?: string | null;
  readonly notes?: readonly string[];
}

export interface ChurnRescuePolicyRequest {
  readonly state: ChatState;
  readonly room: ChatRoomState;
  readonly session: ChatSessionState;
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId;
  readonly channelId: ChatChannelId;
  readonly visibleChannel: ChatVisibleChannel | null;
  readonly playerId: string;
  readonly requestId?: string | null;
  readonly causeEventId?: ChatEventId | null;
  readonly sourceMessage?: ChatMessage | null;
  readonly signal?: ChatSignalEnvelope | null;
  readonly affect?: Partial<ChatAffectSnapshot> | null;
  readonly feature?: Partial<ChatFeatureSnapshot> | null;
  readonly learning?: Partial<ChatLearningProfile> | null;
  readonly reputation?: Partial<ChatReputationState> | null;
  readonly telemetry?: ChurnRescueTelemetryFrame | null;
  readonly helperActor?: Partial<ChatRescueActor> | null;
  readonly notes?: readonly string[];
}

export interface ChurnRescuePolicyReasonTrail {
  readonly reasons: readonly string[];
  readonly reasonCode: ChatRescueReasonCode;
  readonly suppressionReason?: ChatRescueSuppressionReason | null;
  readonly tags: readonly string[];
}

export interface ChurnRescueRiskSnapshot {
  readonly churnRisk01: Score01;
  readonly tilt01: Score01;
  readonly publicRisk01: Score01;
  readonly recoverability01: Score01;
  readonly helperReadiness01: Score01;
  readonly rescueNecessity01: Score01;
  readonly humiliationHazard01: Score01;
  readonly stabilityLiftEstimate01: Score01;
  readonly confidenceDebt01: Score01;
  readonly urgency: ChatRescueUrgencyBand;
  readonly style: ChatRescueStyle;
  readonly bestVisibleChannel: ChatVisibleChannel;
  readonly reasonTrail: ChurnRescuePolicyReasonTrail;
}

export interface ChurnRescuePolicyDecision {
  readonly shouldIntervene: boolean;
  readonly risk: ChurnRescueRiskSnapshot;
  readonly rescuePlan: ChatRescuePlan | null;
  readonly rescueWindow: ChatRescueWindow | null;
  readonly rescueState: ChatRescueStateSnapshot | null;
  readonly recoveryPlan: ChatRecoveryPlan | null;
  readonly predictedOutcome: ChatRecoveryOutcome | null;
  readonly rescueDigest: ChatRescueDigest | null;
  readonly recoveryDigest: ChatRecoveryDigest | null;
  readonly notes: readonly string[];
}

// ============================================================================
// MARK: Defaults
// ============================================================================

const DEFAULT_TUNING: ChurnRescuePolicyTuning = Object.freeze({
  silenceWatchMs: 4500,
  silenceReadyMs: 8500,
  silenceCriticalMs: 14500,
  abortReadyCount: 2,
  abortCriticalCount: 4,
  failureReadyCount: 2,
  failureCriticalCount: 4,
  panelFlapReadyCount: 4,
  channelHopReadyCount: 3,
  crowdHostilityReady01: 0.56 as Score01,
  crowdHostilityCritical01: 0.78 as Score01,
  embarrassmentReady01: 0.48 as Score01,
  embarrassmentCritical01: 0.76 as Score01,
  frustrationReady01: 0.52 as Score01,
  frustrationCritical01: 0.80 as Score01,
  desperationReady01: 0.46 as Score01,
  desperationCritical01: 0.74 as Score01,
  confidenceFloor01: 0.34 as Score01,
  helperReceptivityFloor01: 0.28 as Score01,
  helperTrustFloor01: 0.24 as Score01,
  publicRiskCutoff01: 0.86 as Score01,
  hardSuppressConfidence01: 0.79 as Score01,
  hardSuppressRecoverability01: 0.82 as Score01,
  rescueCooldownMs: 9500,
  shadowOnlyCutoff01: 0.74 as Score01,
  criticalWindowMs: 3500,
  immediateWindowMs: 5400,
  readyWindowMs: 7900,
  watchWindowMs: 11800,
});

const DEFAULT_CLOCK: ChurnRescuePolicyClock = Object.freeze({ now: () => Date.now() });
const DEFAULT_LOGGER: ChurnRescuePolicyLogger = Object.freeze({
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
});

const EMPTY_AFFECT: ChatAffectSnapshot = Object.freeze({
  intimidation: 0 as Score100,
  confidence: 50 as Score100,
  frustration: 0 as Score100,
  curiosity: 10 as Score100,
  attachment: 0 as Score100,
  socialEmbarrassment: 0 as Score100,
  relief: 0 as Score100,
  dominance: 0 as Score100,
  desperation: 0 as Score100,
  trust: 10 as Score100,
} as ChatAffectSnapshot);

const EMPTY_FEATURE: ChatFeatureSnapshot = Object.freeze({
  silenceMs: 0,
  panelFlapCount: 0,
  channelHopCount: 0,
  abortedComposeCount: 0,
  failedActionCount: 0,
  negativeBurstCount: 0,
  crowdHostility01: 0 as Score01,
  unreadPressure01: 0 as Score01,
  directPressure01: 0 as Score01,
  publicExposure01: 0 as Score01,
} as ChatFeatureSnapshot);

const EMPTY_LEARNING: ChatLearningProfile = Object.freeze({
  helperReceptivity: 45 as Score100,
  haterTolerance: 50 as Score100,
  crowdTolerance: 45 as Score100,
  dealRoomComposure: 50 as Score100,
  preferredVisibleChannel: 'GLOBAL' as ChatVisibleChannel,
  preferredHelperStyle: 'CALM',
} as unknown as ChatLearningProfile);

const EMPTY_REPUTATION: ChatReputationState = Object.freeze({
  rescueNeediness: 0 as Score100,
  crowdTargetingRisk: 0 as Score100,
  syndicateTrust: 45 as Score100,
  dealRoomComposure: 50 as Score100,
} as unknown as ChatReputationState);

const CHANNEL_FALLBACK_ORDER: readonly ChatVisibleChannel[] = ['DIRECT', 'SYNDICATE', 'DEAL_ROOM', 'GLOBAL', 'SPECTATOR'];

// ============================================================================
// MARK: Utility helpers
// ============================================================================

function score01(value: number): Score01 {
  return clamp01(value) as Score01;
}

function score100(value: number): Score100 {
  return Math.round(clamp100(value)) as Score100;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asArray(value: readonly string[] | null | undefined): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function unix(now: number | UnixMs): UnixMs {
  return asUnixMs(Number(now));
}

function weightedAverage(pairs: readonly [number, number][], fallback = 0): number {
  let numerator = 0;
  let denominator = 0;
  for (const [value, weight] of pairs) {
    numerator += value * weight;
    denominator += weight;
  }
  return denominator <= 0 ? fallback : numerator / denominator;
}

function max01(...values: readonly number[]): Score01 {
  return score01(Math.max(...values, 0));
}

function min01(...values: readonly number[]): Score01 {
  return score01(Math.min(...values, 1));
}

function preferChannel(requested: ChatVisibleChannel | null | undefined, learning: ChatLearningProfile): ChatVisibleChannel {
  if (requested && isVisibleChannelId(requested)) return requested;
  const preferred = (learning as any).preferredVisibleChannel;
  if (preferred && isVisibleChannelId(preferred)) return preferred;
  return 'GLOBAL';
}

function buildPlayerActor(request: ChurnRescuePolicyRequest): ChatRescueActor {
  return {
    actorId: request.playerId as any,
    actorKind: 'PLAYER' as any,
    role: 'PLAYER',
    displayName: 'Player',
    relationshipStance: 'NEUTRAL' as any,
    objective: 'SURVIVE' as any,
    notes: asArray(request.notes),
  } as ChatRescueActor;
}

function buildHelperActor(request: ChurnRescuePolicyRequest, learning: ChatLearningProfile, risk: number): ChatRescueActor | null {
  const helper = request.helperActor;
  const helperReceptivity = safeNumber((learning as any).helperReceptivity, 45) / 100;
  if (!helper && helperReceptivity < 0.20 && risk < 0.55) return null;

  const actorId = helper?.actorId ?? ('npc:rescue-helper' as any);
  const actorKind = helper?.actorKind ?? ('NPC' as any);
  const displayName = (helper as any)?.displayName ?? (risk >= 0.72 ? 'Nyra' : 'Kade');
  const stance = (helper as any)?.relationshipStance ?? ('SUPPORTIVE' as any);

  return {
    actorId: actorId as any,
    actorKind: actorKind as any,
    role: 'HELPER',
    displayName,
    relationshipStance: stance,
    objective: 'STABILIZE' as any,
    notes: ['backend-helper-selection'],
  } as ChatRescueActor;
}

function mergeAffect(input: Partial<ChatAffectSnapshot> | null | undefined): ChatAffectSnapshot {
  return {
    ...EMPTY_AFFECT,
    ...(input ?? {}),
    intimidation: score100(safeNumber(input?.intimidation, EMPTY_AFFECT.intimidation)),
    confidence: score100(safeNumber(input?.confidence, EMPTY_AFFECT.confidence)),
    frustration: score100(safeNumber(input?.frustration, EMPTY_AFFECT.frustration)),
    curiosity: score100(safeNumber(input?.curiosity, EMPTY_AFFECT.curiosity)),
    attachment: score100(safeNumber(input?.attachment, EMPTY_AFFECT.attachment)),
    socialEmbarrassment: score100(safeNumber(input?.socialEmbarrassment, EMPTY_AFFECT.socialEmbarrassment)),
    relief: score100(safeNumber(input?.relief, EMPTY_AFFECT.relief)),
    dominance: score100(safeNumber(input?.dominance, EMPTY_AFFECT.dominance)),
    desperation: score100(safeNumber(input?.desperation, EMPTY_AFFECT.desperation)),
    trust: score100(safeNumber(input?.trust, EMPTY_AFFECT.trust)),
  } as ChatAffectSnapshot;
}

function mergeFeature(input: Partial<ChatFeatureSnapshot> | null | undefined, telemetry: ChurnRescueTelemetryFrame | null | undefined): ChatFeatureSnapshot {
  return {
    ...EMPTY_FEATURE,
    ...(input ?? {}),
    silenceMs: safeNumber(input?.silenceMs, safeNumber(telemetry?.silenceMs)),
    panelFlapCount: safeNumber(input?.panelFlapCount, safeNumber(telemetry?.panelFlapCount)),
    channelHopCount: safeNumber(input?.channelHopCount, safeNumber(telemetry?.channelHopCount)),
    abortedComposeCount: safeNumber(input?.abortedComposeCount, safeNumber(telemetry?.composerAbortStreak)),
    failedActionCount: safeNumber(input?.failedActionCount, safeNumber(telemetry?.failedActionChain)),
    negativeBurstCount: safeNumber(input?.negativeBurstCount, safeNumber(telemetry?.negativeSendFailures)),
    crowdHostility01: score01(safeNumber(input?.crowdHostility01, safeNumber(telemetry?.crowdHostility01))),
    unreadPressure01: score01(safeNumber(input?.unreadPressure01, safeNumber(telemetry?.unreadPressure01))),
    directPressure01: score01(safeNumber(input?.directPressure01, safeBoolean(telemetry?.counterWindowOpen) ? 0.65 : 0)),
    publicExposure01: score01(safeNumber(input?.publicExposure01, safeNumber(telemetry?.dealRoomExposure01))),
  } as ChatFeatureSnapshot;
}

function mergeLearning(input: Partial<ChatLearningProfile> | null | undefined): ChatLearningProfile {
  return {
    ...EMPTY_LEARNING,
    ...(input ?? {}),
    helperReceptivity: score100(safeNumber((input as any)?.helperReceptivity, (EMPTY_LEARNING as any).helperReceptivity)),
    haterTolerance: score100(safeNumber((input as any)?.haterTolerance, (EMPTY_LEARNING as any).haterTolerance)),
    crowdTolerance: score100(safeNumber((input as any)?.crowdTolerance, (EMPTY_LEARNING as any).crowdTolerance)),
    dealRoomComposure: score100(safeNumber((input as any)?.dealRoomComposure, (EMPTY_LEARNING as any).dealRoomComposure)),
    preferredVisibleChannel: preferChannel((input as any)?.preferredVisibleChannel, EMPTY_LEARNING),
  } as ChatLearningProfile;
}

function mergeReputation(input: Partial<ChatReputationState> | null | undefined): ChatReputationState {
  return {
    ...EMPTY_REPUTATION,
    ...(input ?? {}),
    rescueNeediness: score100(safeNumber((input as any)?.rescueNeediness, (EMPTY_REPUTATION as any).rescueNeediness)),
    crowdTargetingRisk: score100(safeNumber((input as any)?.crowdTargetingRisk, (EMPTY_REPUTATION as any).crowdTargetingRisk)),
    syndicateTrust: score100(safeNumber((input as any)?.syndicateTrust, (EMPTY_REPUTATION as any).syndicateTrust)),
    dealRoomComposure: score100(safeNumber((input as any)?.dealRoomComposure, (EMPTY_REPUTATION as any).dealRoomComposure)),
  } as ChatReputationState;
}

function buildTelemetry(input: ChurnRescuePolicyRequest, affect: ChatAffectSnapshot): ChatRescueTelemetrySnapshot {
  const telemetry = input.telemetry ?? null;
  const bossState = telemetry?.bossFightState ?? null;
  return {
    silenceMs: safeNumber(telemetry?.silenceMs),
    failedActionChain: safeNumber(telemetry?.failedActionChain),
    panelFlapCount: safeNumber(telemetry?.panelFlapCount),
    channelHopCount: safeNumber(telemetry?.channelHopCount),
    crowdHostility01: score01(safeNumber(telemetry?.crowdHostility01)),
    dealRoomExposure01: score01(safeNumber(telemetry?.dealRoomExposure01)),
    recentCollapse: safeBoolean(telemetry?.recentCollapse),
    helperIgnoredThenReturned: safeBoolean(telemetry?.helperIgnoredThenReturned),
    bossFightState: bossState as any,
    activeRescueId: telemetry?.activeRescueId ?? null,
    composerAbortStreak: safeNumber(telemetry?.composerAbortStreak),
    unreadPressure01: score01(safeNumber(telemetry?.unreadPressure01)),
    trustOpportunity01: score01(Number(affect.trust) / 100),
    publicEmbarrassment01: score01(Number(affect.socialEmbarrassment) / 100),
  } as any;
}

function computeHelperReadiness(learning: ChatLearningProfile, affect: ChatAffectSnapshot, telemetry: ChurnRescueTelemetryFrame | null | undefined): Score01 {
  return score01(weightedAverage([
    [safeNumber((learning as any).helperReceptivity, 45) / 100, 0.40],
    [safeNumber(affect.trust, 10) / 100, 0.25],
    [1 - safeNumber(affect.socialEmbarrassment, 0) / 100, 0.10],
    [safeBoolean(telemetry?.helperAlreadyActive) ? 0.85 : 0.35, 0.25],
  ], 0.35));
}

function computeChurnRisk(feature: ChatFeatureSnapshot, affect: ChatAffectSnapshot, reputation: ChatReputationState, telemetry: ChurnRescueTelemetryFrame | null | undefined): Score01 {
  const risk = weightedAverage([
    [safeNumber(feature.silenceMs) >= 12000 ? 1 : safeNumber(feature.silenceMs) / 12000, 0.15],
    [safeNumber(feature.abortedComposeCount) / 5, 0.12],
    [safeNumber(feature.failedActionCount) / 5, 0.12],
    [safeNumber(feature.panelFlapCount) / 8, 0.08],
    [safeNumber(feature.channelHopCount) / 6, 0.08],
    [safeNumber(affect.frustration) / 100, 0.12],
    [safeNumber(affect.socialEmbarrassment) / 100, 0.12],
    [safeNumber(affect.desperation) / 100, 0.10],
    [(100 - safeNumber(affect.confidence)) / 100, 0.07],
    [safeNumber((reputation as any).rescueNeediness, 0) / 100, 0.04],
  ], 0);

  const bossBonus = safeBoolean(telemetry?.counterWindowOpen) || telemetry?.bossFightState ? 0.08 : 0;
  return score01(Math.min(1, risk + bossBonus));
}

function classifyReasonCode(feature: ChatFeatureSnapshot, affect: ChatAffectSnapshot, telemetry: ChurnRescueTelemetryFrame | null | undefined): ChatRescueReasonCode {
  if (safeBoolean(telemetry?.counterWindowOpen) || telemetry?.bossFightState) return 'BOSS_WINDOW_LOCK';
  if (safeBoolean(telemetry?.recentCollapse)) return 'POST_COLLAPSE_DISORIENTATION';
  if (safeNumber(feature.publicExposure01) >= 0.55 || safeNumber(affect.socialEmbarrassment) >= 72) return 'EMBARRASSMENT_OVERLOAD';
  if (safeNumber(feature.failedActionCount) >= 3 || safeNumber(feature.abortedComposeCount) >= 3) return 'COGNITIVE_OVERLOAD';
  if (safeNumber(feature.channelHopCount) >= 3 && safeNumber(feature.publicExposure01) >= 0.4) return 'NEGOTIATION_PANIC';
  if (safeNumber(feature.crowdHostility01) >= 0.72) return 'CROWD_HOSTILITY_SURGE';
  if (safeNumber(feature.silenceMs) >= 9000) return 'PLAYER_STOPPED_ACTING';
  return 'RETENTION_RISK';
}

function classifySuppressionReason(
  confidence01: Score01,
  recoverability01: Score01,
  publicRisk01: Score01,
  helperAlreadyActive: boolean,
  supportedChannel: boolean,
  silencePreferred: boolean,
): ChatRescueSuppressionReason | null {
  if (!supportedChannel) return 'NO_SUPPORTED_CHANNEL';
  if (helperAlreadyActive) return 'HELPER_ALREADY_ACTIVE';
  if (silencePreferred) return 'DELIBERATE_SILENCE_PREFERRED';
  if (Number(publicRisk01) >= 0.92) return 'PUBLIC_INTERVENTION_TOO_COSTLY';
  if (Number(confidence01) >= 0.80 && Number(recoverability01) >= 0.82) return 'PLAYER_DOING_FINE';
  return null;
}

function deriveUrgency(churnRisk01: Score01, affect: ChatAffectSnapshot, feature: ChatFeatureSnapshot, tuning: ChurnRescuePolicyTuning): ChatRescueUrgencyBand {
  const embarrassment01 = safeNumber(affect.socialEmbarrassment) / 100;
  const frustration01 = safeNumber(affect.frustration) / 100;
  const desperation01 = safeNumber(affect.desperation) / 100;
  const silenceMs = safeNumber(feature.silenceMs);

  if (
    Number(churnRisk01) >= 0.83 ||
    embarrassment01 >= Number(tuning.embarrassmentCritical01) ||
    frustration01 >= Number(tuning.frustrationCritical01) ||
    desperation01 >= Number(tuning.desperationCritical01) ||
    silenceMs >= tuning.silenceCriticalMs
  ) {
    return 'CRITICAL';
  }

  if (
    Number(churnRisk01) >= 0.66 ||
    embarrassment01 >= Number(tuning.embarrassmentReady01) + 0.14 ||
    frustration01 >= Number(tuning.frustrationReady01) + 0.12 ||
    desperation01 >= Number(tuning.desperationReady01) + 0.10 ||
    silenceMs >= tuning.silenceReadyMs
  ) {
    return 'IMMEDIATE';
  }

  if (
    Number(churnRisk01) >= 0.45 ||
    embarrassment01 >= Number(tuning.embarrassmentReady01) ||
    frustration01 >= Number(tuning.frustrationReady01) ||
    desperation01 >= Number(tuning.desperationReady01) ||
    silenceMs >= tuning.silenceWatchMs
  ) {
    return 'READY';
  }

  return 'WATCH';
}

function deriveStyle(reasonCode: ChatRescueReasonCode, urgency: ChatRescueUrgencyBand, affect: ChatAffectSnapshot): ChatRescueStyle {
  if (reasonCode === 'EMBARRASSMENT_OVERLOAD') return urgency === 'CRITICAL' ? 'PROTECTIVE' : 'QUIET';
  if (reasonCode === 'NEGOTIATION_PANIC') return 'DIRECTIVE';
  if (reasonCode === 'BOSS_WINDOW_LOCK') return urgency === 'CRITICAL' ? 'BLUNT' : 'DIRECTIVE';
  if (reasonCode === 'CROWD_HOSTILITY_SURGE') return 'TACTICAL';
  if (safeNumber(affect.trust) >= 60 && urgency !== 'CRITICAL') return 'CALM';
  return urgency === 'CRITICAL' ? 'BLUNT' : 'CALM';
}

function deriveVisibleChannel(base: ChatVisibleChannel, feature: ChatFeatureSnapshot, reputation: ChatReputationState, affect: ChatAffectSnapshot, helperReadiness01: Score01): ChatVisibleChannel {
  const embarrassment01 = safeNumber(affect.socialEmbarrassment) / 100;
  const publicExposure01 = safeNumber(feature.publicExposure01);
  const crowdRisk01 = safeNumber((reputation as any).crowdTargetingRisk, 0) / 100;
  const helperReady = Number(helperReadiness01) >= 0.35;

  if (base === 'DEAL_ROOM' && (publicExposure01 >= 0.42 || embarrassment01 >= 0.58)) {
    return helperReady ? 'DIRECT' as ChatVisibleChannel : 'DEAL_ROOM';
  }
  if (base === 'GLOBAL' && (embarrassment01 >= 0.62 || crowdRisk01 >= 0.58)) {
    return helperReady ? 'DIRECT' as ChatVisibleChannel : 'SYNDICATE';
  }
  if (!isVisibleChannelId(base)) return CHANNEL_FALLBACK_ORDER[0];
  return base;
}

function estimateStabilityLift(churnRisk01: Score01, helperReadiness01: Score01, recoverability01: Score01, urgency: ChatRescueUrgencyBand): Score01 {
  const urgencyBonus = urgency === 'CRITICAL' ? 0.04 : urgency === 'IMMEDIATE' ? 0.06 : urgency === 'READY' ? 0.08 : 0.03;
  return score01(weightedAverage([
    [1 - Number(churnRisk01), 0.35],
    [Number(helperReadiness01), 0.25],
    [Number(recoverability01), 0.40],
  ], 0.30) + urgencyBonus);
}

function createRescueWindowForUrgency(plan: ChatRescuePlan, openedAt: UnixMs, tuning: ChurnRescuePolicyTuning): ChatRescueWindow {
  const window = buildRescueWindow(plan.rescueId, plan.kind, plan.urgency, openedAt);
  const closesAt = plan.urgency === 'CRITICAL'
    ? unix(Number(openedAt) + tuning.criticalWindowMs)
    : plan.urgency === 'IMMEDIATE'
      ? unix(Number(openedAt) + tuning.immediateWindowMs)
      : plan.urgency === 'READY'
        ? unix(Number(openedAt) + tuning.readyWindowMs)
        : unix(Number(openedAt) + tuning.watchWindowMs);
  return {
    ...window,
    closesAt,
    shadowEscalationAt: unix(Number(openedAt) + Math.floor((Number(closesAt) - Number(openedAt)) * 0.65)),
    notes: [...(window.notes ?? []), `policy-window=${plan.urgency}`],
  };
}

function createRescueDigestFromPlan(plan: ChatRescuePlan, now: UnixMs): ChatRescueDigest {
  const entry = createRescueLedgerEntry({
    rescueId: plan.rescueId,
    rescuePlanId: plan.rescuePlanId,
    roomId: plan.roomId,
    channelId: plan.channelId,
    visibleChannel: plan.visibleChannel,
    outcome: plan.state,
    reasonCode: plan.trigger.reasonCode,
    urgency: plan.urgency,
    style: plan.style,
    createdAt: now,
    updatedAt: now,
  } as any);
  return deriveRescueDigest([entry], now);
}

function createRecoveryDigestFromOutcome(plan: ChatRecoveryPlan, outcome: ChatRecoveryOutcome | null, now: UnixMs): ChatRecoveryDigest {
  if (!outcome) return deriveRecoveryDigest([], now);
  return deriveRecoveryDigest([
    {
      ledgerId: (`recovery-ledger:${Number(now)}` as any),
      recoveryId: plan.recoveryId,
      recoveryPlanId: plan.recoveryPlanId,
      visibleChannel: plan.visibleChannel,
      entryPoint: plan.entryPoint,
      outcomeKind: outcome.kind,
      successBand: outcome.successBand,
      createdAt: now,
      updatedAt: now,
      acceptedOptionId: outcome.acceptedOptionId ?? null,
      replayId: null,
      notes: ['predicted'],
    },
  ], now);
}

// ============================================================================
// MARK: ChurnRescuePolicy
// ============================================================================

export class ChurnRescuePolicy {
  private readonly clock: ChurnRescuePolicyClock;
  private readonly logger: ChurnRescuePolicyLogger;
  private readonly tuning: ChurnRescuePolicyTuning;

  public constructor(options: ChurnRescuePolicyOptions = {}) {
    this.clock = options.clock ?? DEFAULT_CLOCK;
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.tuning = Object.freeze({ ...DEFAULT_TUNING, ...(options.tuning ?? {}) });
  }

  public evaluate(request: ChurnRescuePolicyRequest): ChurnRescuePolicyDecision {
    const now = request.telemetry?.now ?? unix(this.clock.now());
    const affect = mergeAffect(request.affect);
    const feature = mergeFeature(request.feature, request.telemetry);
    const learning = mergeLearning(request.learning);
    const reputation = mergeReputation(request.reputation);
    const telemetry = buildTelemetry(request, affect);
    const helperReadiness01 = computeHelperReadiness(learning, affect, request.telemetry);
    const churnRisk01 = computeChurnRisk(feature, affect, reputation, request.telemetry);
    const publicRisk01 = deriveRescuePublicRisk01Fallback(feature, affect, reputation);
    const recoverability01 = deriveRescueRecoverability01({
      confidence: affect.confidence,
      relief: affect.relief,
      trust: affect.trust,
      frustration: affect.frustration,
      desperation: affect.desperation,
      helperReceptivity: (learning as any).helperReceptivity,
    } as any);
    const confidenceDebt01 = score01(1 - safeNumber(affect.confidence) / 100);
    const tilt01 = deriveRescueTilt01(affect);
    const humiliationHazard01 = max01(Number(publicRisk01), safeNumber(affect.socialEmbarrassment) / 100, safeNumber(feature.crowdHostility01));
    const urgency = deriveUrgency(churnRisk01, affect, feature, this.tuning);
    const reasonCode = classifyReasonCode(feature, affect, request.telemetry);
    const style = deriveStyle(reasonCode, urgency, affect);
    const bestVisibleChannel = deriveVisibleChannel(
      preferChannel(request.visibleChannel, learning),
      feature,
      reputation,
      affect,
      helperReadiness01,
    );
    const stabilityLiftEstimate01 = estimateStabilityLift(churnRisk01, helperReadiness01, recoverability01, urgency);

    const suppressionReason = classifySuppressionReason(
      score01(safeNumber(affect.confidence) / 100),
      recoverability01,
      publicRisk01,
      safeBoolean(request.telemetry?.helperAlreadyActive),
      isVisibleChannelId(bestVisibleChannel),
      reasonCode === 'EMBARRASSMENT_OVERLOAD' && Number(humiliationHazard01) >= Number(this.tuning.shadowOnlyCutoff01),
    );

    const shouldIntervene = !suppressionReason && (
      Number(churnRisk01) >= 0.38 ||
      urgency === 'READY' ||
      urgency === 'IMMEDIATE' ||
      urgency === 'CRITICAL'
    );

    const helperActor = buildHelperActor(request, learning, Number(churnRisk01));
    const risk: ChurnRescueRiskSnapshot = Object.freeze({
      churnRisk01,
      tilt01,
      publicRisk01,
      recoverability01,
      helperReadiness01,
      rescueNecessity01: max01(Number(churnRisk01), Number(tilt01), Number(humiliationHazard01)),
      humiliationHazard01,
      stabilityLiftEstimate01,
      confidenceDebt01,
      urgency,
      style,
      bestVisibleChannel,
      reasonTrail: this.buildReasonTrail(feature, affect, telemetry, reasonCode, suppressionReason),
    });

    if (!shouldIntervene) {
      this.logger.debug('chat.rescue.policy.suppressed', {
        roomId: request.roomId as any,
        sessionId: request.sessionId as any,
        reasonCode,
        suppressionReason: suppressionReason ?? 'NONE',
        churnRisk01,
        urgency,
      });
      return {
        shouldIntervene: false,
        risk,
        rescuePlan: null,
        rescueWindow: null,
        rescueState: null,
        recoveryPlan: null,
        predictedOutcome: null,
        rescueDigest: null,
        recoveryDigest: null,
        notes: risk.reasonTrail.reasons,
      };
    }

    const player = buildPlayerActor(request);
    const rescuePlan = buildRescuePlan({
      roomId: request.roomId,
      channelId: request.channelId,
      visibleChannel: bestVisibleChannel,
      sessionId: request.sessionId,
      requestId: (request.requestId as any) ?? null,
      sceneId: null,
      momentId: null,
      bossFightId: null,
      player,
      helperActor,
      feature,
      affect,
      reputation,
      learning,
      telemetry,
      now,
    } as any);

    if (!rescuePlan) {
      this.logger.warn('chat.rescue.policy.build-null', {
        roomId: request.roomId as any,
        sessionId: request.sessionId as any,
        urgency,
        reasonCode,
      });
      return {
        shouldIntervene: false,
        risk,
        rescuePlan: null,
        rescueWindow: null,
        rescueState: null,
        recoveryPlan: null,
        predictedOutcome: null,
        rescueDigest: null,
        recoveryDigest: null,
        notes: [...risk.reasonTrail.reasons, 'shared rescue contract suppressed or returned null'],
      };
    }

    const rescueWindow = createRescueWindowForUrgency(rescuePlan, now, this.tuning);
    const rescueState = deriveRescueStateSnapshot(rescuePlan, affect, now, rescueWindow.windowId);
    const recoveryPlan = buildRecoveryPlan({
      roomId: request.roomId,
      visibleChannel: rescuePlan.visibleChannel,
      sessionId: request.sessionId,
      requestId: (request.requestId as any) ?? null,
      sceneId: null,
      momentId: null,
      bossFightId: null,
      rescuePlan,
      rescueOutcome: rescuePlan.state,
      helperPosture: rescuePlan.helperPosture,
      affect,
      learning,
      inDealRoom: rescuePlan.visibleChannel === 'DEAL_ROOM',
      recentCollapse: safeBoolean(request.telemetry?.recentCollapse),
      counterWindowId: null,
      now,
    } as any);

    const lift = deriveRecoveryLiftSnapshot({
      recoveryPlan,
      affect,
      trust: affect.trust,
      helperPosture: rescuePlan.helperPosture,
      embarrassment: affect.socialEmbarrassment,
      frustration: affect.frustration,
      confidence: affect.confidence,
      publicRisk01,
    } as any);

    const predictedOutcome = createRecoveryOutcome({
      recoveryId: recoveryPlan.recoveryId,
      acceptedOptionId: recoveryPlan.bundle.options[0]?.optionId ?? null,
      stabilityLift01: Number((lift as any).stabilityLift01 ?? stabilityLiftEstimate01),
      embarrassmentReduction01: Number((lift as any).embarrassmentReduction01 ?? score01(Number(humiliationHazard01) * 0.45)),
      confidenceLift01: Number((lift as any).confidenceLift01 ?? score01(Number(stabilityLiftEstimate01) * 0.55)),
      trustLift01: Number((lift as any).trustLift01 ?? score01(Number(helperReadiness01) * 0.35)),
      updatedAt: now,
    });

    const rescueDigest = createRescueDigestFromPlan(rescuePlan, now);
    const recoveryDigest = createRecoveryDigestFromOutcome(recoveryPlan, predictedOutcome, now);

    this.logger.info('chat.rescue.policy.generated', {
      roomId: request.roomId as any,
      sessionId: request.sessionId as any,
      rescueId: rescuePlan.rescueId as any,
      recoveryId: recoveryPlan.recoveryId as any,
      urgency: rescuePlan.urgency,
      style: rescuePlan.style,
      visibleChannel: rescuePlan.visibleChannel,
      churnRisk01,
      successBand: predictedOutcome.successBand,
    });

    return {
      shouldIntervene: true,
      risk,
      rescuePlan,
      rescueWindow,
      rescueState,
      recoveryPlan,
      predictedOutcome,
      rescueDigest,
      recoveryDigest,
      notes: [...risk.reasonTrail.reasons, ...(rescuePlan.notes ?? []), ...(predictedOutcome.notes ?? [])],
    };
  }

  public scoreOnly(request: ChurnRescuePolicyRequest): ChurnRescueRiskSnapshot {
    return this.evaluate(request).risk;
  }

  public shouldOpenWindow(request: ChurnRescuePolicyRequest): boolean {
    return this.evaluate(request).shouldIntervene;
  }

  public predictRecoverySuccessBand(request: ChurnRescuePolicyRequest): ChatRecoverySuccessBand {
    const decision = this.evaluate(request);
    return decision.predictedOutcome?.successBand ?? 'NO_LIFT';
  }

  private buildReasonTrail(
    feature: ChatFeatureSnapshot,
    affect: ChatAffectSnapshot,
    telemetry: ChatRescueTelemetrySnapshot,
    reasonCode: ChatRescueReasonCode,
    suppressionReason: ChatRescueSuppressionReason | null,
  ): ChurnRescuePolicyReasonTrail {
    const reasons: string[] = [];
    const tags: string[] = [];

    if (safeNumber(feature.silenceMs) > 0) {
      reasons.push(`silence=${safeNumber(feature.silenceMs)}ms`);
      if (safeNumber(feature.silenceMs) >= this.tuning.silenceReadyMs) tags.push('silence-heavy');
    }
    if (safeNumber(feature.abortedComposeCount) > 0) {
      reasons.push(`abort-streak=${safeNumber(feature.abortedComposeCount)}`);
      if (safeNumber(feature.abortedComposeCount) >= this.tuning.abortReadyCount) tags.push('compose-break');
    }
    if (safeNumber(feature.failedActionCount) > 0) {
      reasons.push(`fail-chain=${safeNumber(feature.failedActionCount)}`);
      if (safeNumber(feature.failedActionCount) >= this.tuning.failureReadyCount) tags.push('fail-chain');
    }
    if (safeNumber(feature.panelFlapCount) > 0) {
      reasons.push(`panel-flap=${safeNumber(feature.panelFlapCount)}`);
      if (safeNumber(feature.panelFlapCount) >= this.tuning.panelFlapReadyCount) tags.push('panel-flap');
    }
    if (safeNumber(feature.channelHopCount) > 0) {
      reasons.push(`channel-hop=${safeNumber(feature.channelHopCount)}`);
      if (safeNumber(feature.channelHopCount) >= this.tuning.channelHopReadyCount) tags.push('channel-hop');
    }

    reasons.push(`embarrassment=${Number(affect.socialEmbarrassment)}`);
    reasons.push(`frustration=${Number(affect.frustration)}`);
    reasons.push(`desperation=${Number(affect.desperation)}`);
    reasons.push(`confidence=${Number(affect.confidence)}`);
    reasons.push(`crowdHostility01=${Number(feature.crowdHostility01).toFixed(2)}`);
    reasons.push(`publicExposure01=${Number(feature.publicExposure01).toFixed(2)}`);
    reasons.push(`reasonCode=${reasonCode}`);

    if (telemetry.recentCollapse) tags.push('recent-collapse');
    if (telemetry.bossFightState) tags.push('boss-fight');
    if (telemetry.helperIgnoredThenReturned) tags.push('helper-return');
    if (suppressionReason) reasons.push(`suppressed=${suppressionReason}`);

    return Object.freeze({
      reasons: Object.freeze(reasons),
      reasonCode,
      suppressionReason,
      tags: Object.freeze(tags),
    });
  }
}

export function createChurnRescuePolicy(options: ChurnRescuePolicyOptions = {}): ChurnRescuePolicy {
  return new ChurnRescuePolicy(options);
}

// ============================================================================
// MARK: Lightweight fallback computations
// ============================================================================

function deriveRescuePublicRisk01Fallback(
  feature: ChatFeatureSnapshot,
  affect: ChatAffectSnapshot,
  reputation: ChatReputationState,
): Score01 {
  return score01(weightedAverage([
    [safeNumber(feature.publicExposure01), 0.34],
    [safeNumber(feature.crowdHostility01), 0.24],
    [safeNumber(affect.socialEmbarrassment) / 100, 0.24],
    [safeNumber((reputation as any).crowdTargetingRisk, 0) / 100, 0.18],
  ], 0));
}

// ============================================================================
// MARK: Data tables for authored backend law
// ============================================================================

export const CHURN_RESCUE_REASON_PRIORITY: Readonly<Record<ChatRescueReasonCode, number>> = Object.freeze({
  RETENTION_RISK: 10,
  EMBARRASSMENT_OVERLOAD: 90,
  COGNITIVE_OVERLOAD: 74,
  NEGOTIATION_PANIC: 82,
  POST_COLLAPSE_DISORIENTATION: 87,
  BOSS_WINDOW_LOCK: 91,
  CROWD_HOSTILITY_SURGE: 78,
  HELPER_RECEPTIVE_WINDOW: 42,
  PLAYER_STOPPED_ACTING: 60,
  STAGED_DEESCALATION: 26,
});

export const CHURN_RESCUE_CHANNEL_LAW: Readonly<Record<ChatVisibleChannel, readonly string[]>> = Object.freeze({
  GLOBAL: Object.freeze([
    'Public rescue must justify its cost.',
    'Favor witness-calming or crowd-shield patterns, not pleading.',
    'If embarrassment is high, shift private unless helper trust is weak.',
  ]),
  SYNDICATE: Object.freeze([
    'Syndicate rescue can be visible if it protects competence.',
    'Use tactical language more than soothing language.',
  ]),
  DEAL_ROOM: Object.freeze([
    'Deal room rescue should prevent panic leakage.',
    'Private repricing is usually better than public explanation.',
  ]),
  DIRECT: Object.freeze([
    'Direct rescue may be quieter and more specific.',
    'Use helper handoff aggressively when trust allows it.',
  ]),
  SPECTATOR: Object.freeze([
    'Spectator rescue should rarely become public story.',
    'Default to quiet containment.',
  ]),
});

export const CHURN_RESCUE_STYLE_NOTES: Readonly<Record<ChatRescueStyle, readonly string[]>> = Object.freeze({
  BLUNT: Object.freeze(['Use when time is gone and a move is required.']),
  CALM: Object.freeze(['Use when the player is still reachable without force.']),
  DIRECTIVE: Object.freeze(['Use when composure exists but choice paralysis is present.']),
  QUIET: Object.freeze(['Use when humiliation cost is high.']),
  TACTICAL: Object.freeze(['Use when the move must preserve face and tempo.']),
  PROTECTIVE: Object.freeze(['Use when the system must reduce witness pressure.']),
});
