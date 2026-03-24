
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT CHURN RESCUE POLICY
 * FILE: backend/src/game/engine/chat/rescue/ChurnRescuePolicy.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: Antonio T. Smith Jr.
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
  createRescueWindow,
  deriveRescueDigest,
  deriveRescueRecoverability01,
  deriveRescueStateSnapshot,
  deriveRescueTilt01,
  deriveRescueTriggerCandidates,
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
  readonly audienceHeat?: ChatAudienceHeat | null;
  readonly pressureTier?: PressureTier | null;
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
  readonly recoveryBundle: ChatRecoveryBundle | null;
  readonly recoveryEntryPoint: ChatRecoveryEntryPoint | null;
  readonly recoveryVisibility: ChatRecoveryVisibility | null;
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
} as unknown as ChatFeatureSnapshot);

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

const CHANNEL_FALLBACK_ORDER: readonly ChatVisibleChannel[] = ['SYNDICATE' as ChatVisibleChannel, 'DEAL_ROOM' as ChatVisibleChannel, 'GLOBAL' as ChatVisibleChannel];

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
    silenceMs: safeNumber((input as any)?.silenceMs, safeNumber(telemetry?.silenceMs)),
    panelFlapCount: safeNumber((input as any)?.panelFlapCount, safeNumber(telemetry?.panelFlapCount)),
    channelHopCount: safeNumber((input as any)?.channelHopCount, safeNumber(telemetry?.channelHopCount)),
    abortedComposeCount: safeNumber((input as any)?.abortedComposeCount, safeNumber(telemetry?.composerAbortStreak)),
    failedActionCount: safeNumber((input as any)?.failedActionCount, safeNumber(telemetry?.failedActionChain)),
    negativeBurstCount: safeNumber((input as any)?.negativeBurstCount, safeNumber(telemetry?.negativeSendFailures)),
    crowdHostility01: score01(safeNumber((input as any)?.crowdHostility01, safeNumber(telemetry?.crowdHostility01))),
    unreadPressure01: score01(safeNumber((input as any)?.unreadPressure01, safeNumber(telemetry?.unreadPressure01))),
    directPressure01: score01(safeNumber((input as any)?.directPressure01, safeBoolean(telemetry?.counterWindowOpen) ? 0.65 : 0)),
    publicExposure01: score01(safeNumber((input as any)?.publicExposure01, safeNumber(telemetry?.dealRoomExposure01))),
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
    [safeNumber((feature as any).silenceMs) >= 12000 ? 1 : safeNumber((feature as any).silenceMs) / 12000, 0.15],
    [safeNumber((feature as any).abortedComposeCount) / 5, 0.12],
    [safeNumber((feature as any).failedActionCount) / 5, 0.12],
    [safeNumber((feature as any).panelFlapCount) / 8, 0.08],
    [safeNumber((feature as any).channelHopCount) / 6, 0.08],
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
  if (safeNumber((feature as any).publicExposure01) >= 0.55 || safeNumber(affect.socialEmbarrassment) >= 72) return 'EMBARRASSMENT_OVERLOAD';
  if (safeNumber((feature as any).failedActionCount) >= 3 || safeNumber((feature as any).abortedComposeCount) >= 3) return 'COGNITIVE_OVERLOAD';
  if (safeNumber((feature as any).channelHopCount) >= 3 && safeNumber((feature as any).publicExposure01) >= 0.4) return 'NEGOTIATION_PANIC';
  if (safeNumber((feature as any).crowdHostility01) >= 0.72) return 'CROWD_HOSTILITY_SURGE';
  if (safeNumber((feature as any).silenceMs) >= 9000) return 'PLAYER_STOPPED_ACTING';
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
  const silenceMs = safeNumber((feature as any).silenceMs);

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
  const publicExposure01 = safeNumber((feature as any).publicExposure01);
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
  const window = createRescueWindow(plan.rescueId, plan.kind, plan.urgency, openedAt);
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
  const entry: ChatRescueLedgerEntry = {
    ledgerId: (`rescue-ledger:${String(plan.rescueId)}:${Number(now)}` as any),
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
  };
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
    const humiliationHazard01 = max01(Number(publicRisk01), safeNumber(affect.socialEmbarrassment) / 100, safeNumber((feature as any).crowdHostility01));
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
        recoveryBundle: null,
        recoveryEntryPoint: null,
        recoveryVisibility: null,
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
        recoveryBundle: null,
        recoveryEntryPoint: null,
        recoveryVisibility: null,
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
      recoveryBundle: recoveryPlan.bundle,
      recoveryEntryPoint: recoveryPlan.entryPoint,
      recoveryVisibility: (recoveryPlan.bundle.options[0]?.visibility ?? null) as ChatRecoveryVisibility | null,
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

    if (safeNumber((feature as any).silenceMs) > 0) {
      reasons.push(`silence=${safeNumber((feature as any).silenceMs)}ms`);
      if (safeNumber((feature as any).silenceMs) >= this.tuning.silenceReadyMs) tags.push('silence-heavy');
    }
    if (safeNumber((feature as any).abortedComposeCount) > 0) {
      reasons.push(`abort-streak=${safeNumber((feature as any).abortedComposeCount)}`);
      if (safeNumber((feature as any).abortedComposeCount) >= this.tuning.abortReadyCount) tags.push('compose-break');
    }
    if (safeNumber((feature as any).failedActionCount) > 0) {
      reasons.push(`fail-chain=${safeNumber((feature as any).failedActionCount)}`);
      if (safeNumber((feature as any).failedActionCount) >= this.tuning.failureReadyCount) tags.push('fail-chain');
    }
    if (safeNumber((feature as any).panelFlapCount) > 0) {
      reasons.push(`panel-flap=${safeNumber((feature as any).panelFlapCount)}`);
      if (safeNumber((feature as any).panelFlapCount) >= this.tuning.panelFlapReadyCount) tags.push('panel-flap');
    }
    if (safeNumber((feature as any).channelHopCount) > 0) {
      reasons.push(`channel-hop=${safeNumber((feature as any).channelHopCount)}`);
      if (safeNumber((feature as any).channelHopCount) >= this.tuning.channelHopReadyCount) tags.push('channel-hop');
    }

    reasons.push(`embarrassment=${Number(affect.socialEmbarrassment)}`);
    reasons.push(`frustration=${Number(affect.frustration)}`);
    reasons.push(`desperation=${Number(affect.desperation)}`);
    reasons.push(`confidence=${Number(affect.confidence)}`);
    reasons.push(`crowdHostility01=${Number((feature as any).crowdHostility01).toFixed(2)}`);
    reasons.push(`publicExposure01=${Number((feature as any).publicExposure01).toFixed(2)}`);
    reasons.push(`reasonCode=${reasonCode}`);

    if (telemetry.recentCollapse) tags.push('recent-collapse');
    if (telemetry.bossFightState) tags.push('boss-fight');
    if ((telemetry as any).helperIgnoredThenReturned) tags.push('helper-return');
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
    [safeNumber((feature as any).publicExposure01), 0.34],
    [safeNumber((feature as any).crowdHostility01), 0.24],
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
  LOBBY: Object.freeze([
    'Lobby rescue must not escalate before the game context is established.',
    'Prefer silent or ambient containment until the player commits to a room.',
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

// ============================================================================
// MARK: Profile system
// ============================================================================

export type ChurnRescuePolicyProfile =
  | 'BALANCED'
  | 'HATER_HEAVY'
  | 'HELPER_PRIORITY'
  | 'NEGOTIATION_FOCUS'
  | 'LIVEOPS_RESPONSIVE'
  | 'SHADOW_HEAVY';

export interface ChurnRescuePolicyProfileConfig {
  readonly profile: ChurnRescuePolicyProfile;
  readonly tuning: Partial<ChurnRescuePolicyTuning>;
  readonly description: string;
  readonly useCases: readonly string[];
}

export const CHURN_RESCUE_POLICY_PROFILE_CONFIGS: Readonly<Record<ChurnRescuePolicyProfile, ChurnRescuePolicyProfileConfig>> = Object.freeze({
  BALANCED: Object.freeze({
    profile: 'BALANCED',
    tuning: {},
    description: 'Standard balanced thresholds for general game flow.',
    useCases: Object.freeze([
      'Default main loop rooms',
      'General narrative chambers',
      'Spectator-light areas',
    ]),
  }),
  HATER_HEAVY: Object.freeze({
    profile: 'HATER_HEAVY',
    tuning: Object.freeze({
      crowdHostilityReady01: 0.42 as Score01,
      crowdHostilityCritical01: 0.64 as Score01,
      embarrassmentReady01: 0.38 as Score01,
      embarrassmentCritical01: 0.60 as Score01,
      shadowOnlyCutoff01: 0.58 as Score01,
      criticalWindowMs: 2800,
      immediateWindowMs: 4200,
    }),
    description: 'Lower crowd-hostility and embarrassment thresholds for hater-dense environments.',
    useCases: Object.freeze([
      'Syndicate rooms with active crowd aggression',
      'Global channels with active pile-on dynamics',
    ]),
  }),
  HELPER_PRIORITY: Object.freeze({
    profile: 'HELPER_PRIORITY',
    tuning: Object.freeze({
      helperReceptivityFloor01: 0.18 as Score01,
      helperTrustFloor01: 0.16 as Score01,
      readyWindowMs: 10200,
      watchWindowMs: 14800,
    }),
    description: 'Extended windows to give helpers maximum time to act before escalation.',
    useCases: Object.freeze([
      'Helper-assigned rooms',
      'Onboarding chambers',
      'Low-pressure tutorial contexts',
    ]),
  }),
  NEGOTIATION_FOCUS: Object.freeze({
    profile: 'NEGOTIATION_FOCUS',
    tuning: Object.freeze({
      silenceReadyMs: 6500,
      silenceCriticalMs: 11000,
      abortReadyCount: 3,
      abortCriticalCount: 5,
      criticalWindowMs: 4200,
      immediateWindowMs: 6400,
      publicRiskCutoff01: 0.78 as Score01,
    }),
    description: 'Tuned for deal-room negotiation panic and high-stakes offer stalls.',
    useCases: Object.freeze([
      'Deal room chambers',
      'Counter-offer cycles',
      'High-pressure negotiation beats',
    ]),
  }),
  LIVEOPS_RESPONSIVE: Object.freeze({
    profile: 'LIVEOPS_RESPONSIVE',
    tuning: Object.freeze({
      silenceWatchMs: 3000,
      silenceReadyMs: 5500,
      criticalWindowMs: 2200,
      immediateWindowMs: 3600,
      readyWindowMs: 5800,
      watchWindowMs: 8400,
      rescueCooldownMs: 5500,
    }),
    description: 'Shortened silence and window thresholds for live event contexts with condensed time.',
    useCases: Object.freeze([
      'LiveOps world event rooms',
      'Faction surge beats',
      'Time-limited challenge sequences',
    ]),
  }),
  SHADOW_HEAVY: Object.freeze({
    profile: 'SHADOW_HEAVY',
    tuning: Object.freeze({
      shadowOnlyCutoff01: 0.38 as Score01,
      publicRiskCutoff01: 0.62 as Score01,
      embarrassmentCritical01: 0.52 as Score01,
    }),
    description: 'Aggressive shadow-only escalation. Public rescue is near-prohibited.',
    useCases: Object.freeze([
      'High-visibility public rooms where rescue must never surface',
      'Spectator-heavy events',
      'Boss fight arenas with humiliation sensitivity',
    ]),
  }),
});

// ============================================================================
// MARK: Extended diagnostic contracts
// ============================================================================

export interface ChurnRescuePolicyAuditEntry {
  readonly evaluatedAt: UnixMs;
  readonly roomId: string | null;
  readonly sessionId: string | null;
  readonly shouldIntervene: boolean;
  readonly churnRisk01: Score01;
  readonly urgency: ChatRescueUrgencyBand;
  readonly reasonCode: ChatRescueReasonCode;
  readonly suppressionReason: ChatRescueSuppressionReason | null;
  readonly rescueKind: ChatRescueKind | null;
  readonly successBand: ChatRecoverySuccessBand | null;
  readonly notes: readonly string[];
}

export interface ChurnRescuePolicyAuditReport {
  readonly generatedAt: UnixMs;
  readonly totalEvaluations: number;
  readonly interventionCount: number;
  readonly suppressionCount: number;
  readonly urgencyBreakdown: Readonly<Record<ChatRescueUrgencyBand, number>>;
  readonly reasonCodeBreakdown: Readonly<Record<string, number>>;
  readonly suppressionBreakdown: Readonly<Record<string, number>>;
  readonly averageChurnRisk01: Score01;
  readonly peakChurnRisk01: Score01;
  readonly interventionRate01: Score01;
  readonly entries: readonly ChurnRescuePolicyAuditEntry[];
}

export interface ChurnRescuePolicyDiff {
  readonly before: ChurnRescueRiskSnapshot;
  readonly after: ChurnRescueRiskSnapshot;
  readonly churnRiskDelta: number;
  readonly urgencyChanged: boolean;
  readonly reasonCodeChanged: boolean;
  readonly shouldInterveneBefore: boolean;
  readonly shouldInterveneAfter: boolean;
  readonly notes: readonly string[];
}

export interface ChurnRescuePolicyStatsSummary {
  readonly roomId: string | null;
  readonly snapshotAt: UnixMs;
  readonly evaluationCount: number;
  readonly interventionCount: number;
  readonly suppressionCount: number;
  readonly averageChurnRisk01: Score01;
  readonly peakChurnRisk01: Score01;
  readonly mostCommonUrgency: ChatRescueUrgencyBand | null;
  readonly mostCommonReasonCode: string | null;
  readonly mostCommonSuppressionReason: string | null;
}

export interface ChurnRescuePolicyBatchRequest {
  readonly requests: readonly ChurnRescuePolicyRequest[];
  readonly stopOnFirstIntervention?: boolean;
}

export interface ChurnRescuePolicyBatchResult {
  readonly decisions: readonly ChurnRescuePolicyDecision[];
  readonly interventionCount: number;
  readonly firstInterventionIndex: number | null;
  readonly allSuppressed: boolean;
  readonly highestUrgencyIndex: number | null;
  readonly highestChurnRisk01: Score01;
}

export interface ChurnRescuePolicyRiskComparison {
  readonly aIsHigherRisk: boolean;
  readonly bIsHigherRisk: boolean;
  readonly delta: number;
  readonly dominantDimension: 'CHURN' | 'HUMILIATION' | 'RECOVERABILITY' | 'HELPER' | 'TILT' | 'TIED';
  readonly urgencyMatch: boolean;
  readonly reasonCodeMatch: boolean;
}

export interface ChurnRescuePolicyRankedRequest {
  readonly index: number;
  readonly request: ChurnRescuePolicyRequest;
  readonly decision: ChurnRescuePolicyDecision;
  readonly urgencyRank: number;
  readonly churnRisk01: Score01;
}

// ============================================================================
// MARK: Batch evaluation
// ============================================================================

export function batchEvaluateChurnPolicy(
  policy: ChurnRescuePolicy,
  batch: ChurnRescuePolicyBatchRequest,
): ChurnRescuePolicyBatchResult {
  const decisions: ChurnRescuePolicyDecision[] = [];
  let interventionCount = 0;
  let firstInterventionIndex: number | null = null;
  let highestChurnRisk01: Score01 = 0 as Score01;
  let highestUrgencyIndex: number | null = null;
  const urgencyRank: Readonly<Record<ChatRescueUrgencyBand, number>> = {
    WATCH: 1,
    READY: 2,
    IMMEDIATE: 3,
    CRITICAL: 4,
  };
  let peakUrgencyRank = 0;

  for (let i = 0; i < batch.requests.length; i++) {
    const decision = policy.evaluate(batch.requests[i]);
    decisions.push(decision);

    if (Number(decision.risk.churnRisk01) > Number(highestChurnRisk01)) {
      highestChurnRisk01 = decision.risk.churnRisk01;
    }
    const rank = urgencyRank[decision.risk.urgency] ?? 0;
    if (rank > peakUrgencyRank) {
      peakUrgencyRank = rank;
      highestUrgencyIndex = i;
    }
    if (decision.shouldIntervene) {
      interventionCount++;
      if (firstInterventionIndex === null) firstInterventionIndex = i;
      if (batch.stopOnFirstIntervention) break;
    }
  }

  return Object.freeze({
    decisions: Object.freeze(decisions),
    interventionCount,
    firstInterventionIndex,
    allSuppressed: interventionCount === 0,
    highestUrgencyIndex,
    highestChurnRisk01,
  });
}

// ============================================================================
// MARK: Audit and stats
// ============================================================================

export function buildChurnPolicyAuditReport(
  decisions: readonly ChurnRescuePolicyDecision[],
  now: UnixMs,
): ChurnRescuePolicyAuditReport {
  const urgencyBreakdown: Record<ChatRescueUrgencyBand, number> = {
    WATCH: 0,
    READY: 0,
    IMMEDIATE: 0,
    CRITICAL: 0,
  };
  const reasonCodeBreakdown: Record<string, number> = {};
  const suppressionBreakdown: Record<string, number> = {};
  let totalChurnRisk = 0;
  let peakChurnRisk01: Score01 = 0 as Score01;
  let interventionCount = 0;
  let suppressionCount = 0;
  const entries: ChurnRescuePolicyAuditEntry[] = [];

  for (const decision of decisions) {
    const rc = decision.risk.reasonTrail.reasonCode;
    const sr = decision.risk.reasonTrail.suppressionReason;
    const urgency = decision.risk.urgency;

    urgencyBreakdown[urgency] = (urgencyBreakdown[urgency] ?? 0) + 1;
    reasonCodeBreakdown[rc] = (reasonCodeBreakdown[rc] ?? 0) + 1;
    if (sr) suppressionBreakdown[sr] = (suppressionBreakdown[sr] ?? 0) + 1;

    const risk01 = Number(decision.risk.churnRisk01);
    totalChurnRisk += risk01;
    if (risk01 > Number(peakChurnRisk01)) peakChurnRisk01 = decision.risk.churnRisk01;

    if (decision.shouldIntervene) interventionCount++;
    else suppressionCount++;

    entries.push(Object.freeze({
      evaluatedAt: now,
      roomId: null,
      sessionId: null,
      shouldIntervene: decision.shouldIntervene,
      churnRisk01: decision.risk.churnRisk01,
      urgency,
      reasonCode: rc,
      suppressionReason: sr ?? null,
      rescueKind: decision.rescuePlan?.kind ?? null,
      successBand: decision.predictedOutcome?.successBand ?? null,
      notes: decision.notes,
    }));
  }

  const count = decisions.length;
  return Object.freeze({
    generatedAt: now,
    totalEvaluations: count,
    interventionCount,
    suppressionCount,
    urgencyBreakdown: Object.freeze(urgencyBreakdown),
    reasonCodeBreakdown: Object.freeze(reasonCodeBreakdown),
    suppressionBreakdown: Object.freeze(suppressionBreakdown),
    averageChurnRisk01: (count > 0 ? totalChurnRisk / count : 0) as Score01,
    peakChurnRisk01,
    interventionRate01: (count > 0 ? interventionCount / count : 0) as Score01,
    entries: Object.freeze(entries),
  });
}

export function buildChurnPolicyStatsSummary(
  decisions: readonly ChurnRescuePolicyDecision[],
  roomId: string | null,
  now: UnixMs,
): ChurnRescuePolicyStatsSummary {
  if (decisions.length === 0) {
    return Object.freeze({
      roomId,
      snapshotAt: now,
      evaluationCount: 0,
      interventionCount: 0,
      suppressionCount: 0,
      averageChurnRisk01: 0 as Score01,
      peakChurnRisk01: 0 as Score01,
      mostCommonUrgency: null,
      mostCommonReasonCode: null,
      mostCommonSuppressionReason: null,
    });
  }

  const urgencyCount: Record<string, number> = {};
  const rcCount: Record<string, number> = {};
  const srCount: Record<string, number> = {};
  let totalRisk = 0;
  let peakRisk: Score01 = 0 as Score01;
  let interventionCount = 0;

  for (const d of decisions) {
    const urg = d.risk.urgency;
    urgencyCount[urg] = (urgencyCount[urg] ?? 0) + 1;
    const rc = d.risk.reasonTrail.reasonCode;
    rcCount[rc] = (rcCount[rc] ?? 0) + 1;
    const sr = d.risk.reasonTrail.suppressionReason;
    if (sr) srCount[sr] = (srCount[sr] ?? 0) + 1;
    const r = Number(d.risk.churnRisk01);
    totalRisk += r;
    if (r > Number(peakRisk)) peakRisk = d.risk.churnRisk01;
    if (d.shouldIntervene) interventionCount++;
  }

  const mostCommonUrgency = (Object.entries(urgencyCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null) as ChatRescueUrgencyBand | null;
  const mostCommonReasonCode = Object.entries(rcCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const mostCommonSuppressionReason = Object.entries(srCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return Object.freeze({
    roomId,
    snapshotAt: now,
    evaluationCount: decisions.length,
    interventionCount,
    suppressionCount: decisions.length - interventionCount,
    averageChurnRisk01: (totalRisk / decisions.length) as Score01,
    peakChurnRisk01: peakRisk,
    mostCommonUrgency,
    mostCommonReasonCode,
    mostCommonSuppressionReason,
  });
}

// ============================================================================
// MARK: Risk comparison and ranking
// ============================================================================

export function compareRiskSnapshots(
  a: ChurnRescueRiskSnapshot,
  b: ChurnRescueRiskSnapshot,
): ChurnRescuePolicyRiskComparison {
  const churnDelta = Number(a.churnRisk01) - Number(b.churnRisk01);
  const humiliationDelta = Number(a.humiliationHazard01) - Number(b.humiliationHazard01);
  const recoverabilityDelta = Number(a.recoverability01) - Number(b.recoverability01);
  const helperDelta = Number(a.helperReadiness01) - Number(b.helperReadiness01);
  const tiltDelta = Number(a.tilt01) - Number(b.tilt01);

  const absDeltas: Array<[string, number]> = [
    ['CHURN', Math.abs(churnDelta)],
    ['HUMILIATION', Math.abs(humiliationDelta)],
    ['RECOVERABILITY', Math.abs(recoverabilityDelta)],
    ['HELPER', Math.abs(helperDelta)],
    ['TILT', Math.abs(tiltDelta)],
  ];
  absDeltas.sort((x, y) => y[1] - x[1]);
  const dominantDimension = (absDeltas[0][1] < 0.02 ? 'TIED' : absDeltas[0][0]) as ChurnRescuePolicyRiskComparison['dominantDimension'];

  const urgencyRank: Record<string, number> = { WATCH: 1, READY: 2, IMMEDIATE: 3, CRITICAL: 4 };
  const aRank = urgencyRank[a.urgency] ?? 0;
  const bRank = urgencyRank[b.urgency] ?? 0;
  const aIsHigherRisk = aRank > bRank || (aRank === bRank && Number(a.churnRisk01) > Number(b.churnRisk01));

  return Object.freeze({
    aIsHigherRisk,
    bIsHigherRisk: !aIsHigherRisk && (bRank > aRank || Number(b.churnRisk01) > Number(a.churnRisk01)),
    delta: churnDelta,
    dominantDimension,
    urgencyMatch: a.urgency === b.urgency,
    reasonCodeMatch: a.reasonTrail.reasonCode === b.reasonTrail.reasonCode,
  });
}

export function computeChurnPolicyDiff(
  before: ChurnRescuePolicyDecision,
  after: ChurnRescuePolicyDecision,
): ChurnRescuePolicyDiff {
  const notes: string[] = [];
  if (before.risk.urgency !== after.risk.urgency) {
    notes.push(`urgency-changed: ${before.risk.urgency} → ${after.risk.urgency}`);
  }
  if (before.risk.reasonTrail.reasonCode !== after.risk.reasonTrail.reasonCode) {
    notes.push(`reason-code-changed: ${before.risk.reasonTrail.reasonCode} → ${after.risk.reasonTrail.reasonCode}`);
  }
  if (before.shouldIntervene !== after.shouldIntervene) {
    notes.push(`intervention-changed: ${before.shouldIntervene} → ${after.shouldIntervene}`);
  }
  return Object.freeze({
    before: before.risk,
    after: after.risk,
    churnRiskDelta: Number(after.risk.churnRisk01) - Number(before.risk.churnRisk01),
    urgencyChanged: before.risk.urgency !== after.risk.urgency,
    reasonCodeChanged: before.risk.reasonTrail.reasonCode !== after.risk.reasonTrail.reasonCode,
    shouldInterveneBefore: before.shouldIntervene,
    shouldInterveneAfter: after.shouldIntervene,
    notes: Object.freeze(notes),
  });
}

export function rankRequestsByUrgency(
  policy: ChurnRescuePolicy,
  requests: readonly ChurnRescuePolicyRequest[],
): readonly ChurnRescuePolicyRankedRequest[] {
  const urgencyRank: Record<string, number> = { WATCH: 1, READY: 2, IMMEDIATE: 3, CRITICAL: 4 };
  const ranked: ChurnRescuePolicyRankedRequest[] = requests.map((request, index) => {
    const decision = policy.evaluate(request);
    return {
      index,
      request,
      decision,
      urgencyRank: urgencyRank[decision.risk.urgency] ?? 0,
      churnRisk01: decision.risk.churnRisk01,
    };
  });
  ranked.sort((a, b) => b.urgencyRank - a.urgencyRank || Number(b.churnRisk01) - Number(a.churnRisk01));
  return Object.freeze(ranked);
}

export function analyzeRiskSnapshot(snapshot: ChurnRescueRiskSnapshot): {
  readonly riskLabel: string;
  readonly isHighRisk: boolean;
  readonly isCritical: boolean;
  readonly rescueNecessityLabel: string;
  readonly helperReady: boolean;
  readonly recommendShadowOnly: boolean;
} {
  const necessity = Number(snapshot.rescueNecessity01);
  const riskLabel = necessity >= 0.8 ? 'EXTREME'
    : necessity >= 0.6 ? 'HIGH'
    : necessity >= 0.4 ? 'MODERATE'
    : necessity >= 0.2 ? 'LOW'
    : 'MINIMAL';
  return Object.freeze({
    riskLabel,
    isHighRisk: necessity >= 0.6,
    isCritical: snapshot.urgency === 'CRITICAL',
    rescueNecessityLabel: riskLabel,
    helperReady: Number(snapshot.helperReadiness01) >= 0.35,
    recommendShadowOnly: Number(snapshot.humiliationHazard01) >= 0.62 || Number(snapshot.publicRisk01) >= 0.74,
  });
}

// ============================================================================
// MARK: Profile-aware extended factory
// ============================================================================

export interface ChurnRescuePolicyExtended {
  readonly policy: ChurnRescuePolicy;
  readonly profile: ChurnRescuePolicyProfile;
  evaluate(request: ChurnRescuePolicyRequest): ChurnRescuePolicyDecision;
  evaluateWithProfile(request: ChurnRescuePolicyRequest): ChurnRescuePolicyDecision & { readonly profile: ChurnRescuePolicyProfile };
  batchEvaluate(batch: ChurnRescuePolicyBatchRequest): ChurnRescuePolicyBatchResult;
  buildAuditReport(decisions: readonly ChurnRescuePolicyDecision[], now: UnixMs): ChurnRescuePolicyAuditReport;
  buildStatsSummary(decisions: readonly ChurnRescuePolicyDecision[], roomId: string | null, now: UnixMs): ChurnRescuePolicyStatsSummary;
  computeDiff(before: ChurnRescuePolicyDecision, after: ChurnRescuePolicyDecision): ChurnRescuePolicyDiff;
  rankRequests(requests: readonly ChurnRescuePolicyRequest[]): readonly ChurnRescuePolicyRankedRequest[];
  analyzeRisk(snapshot: ChurnRescueRiskSnapshot): ReturnType<typeof analyzeRiskSnapshot>;
  compareRisks(a: ChurnRescueRiskSnapshot, b: ChurnRescueRiskSnapshot): ChurnRescuePolicyRiskComparison;
  toJSON(): Readonly<{ profile: ChurnRescuePolicyProfile; profileConfig: ChurnRescuePolicyProfileConfig }>;
}

export function createChurnRescuePolicyFromProfile(
  profile: ChurnRescuePolicyProfile,
  extraOptions: Omit<ChurnRescuePolicyOptions, 'tuning'> = {},
): ChurnRescuePolicyExtended {
  const profileConfig = CHURN_RESCUE_POLICY_PROFILE_CONFIGS[profile];
  const policy = createChurnRescuePolicy({
    ...extraOptions,
    tuning: profileConfig.tuning,
  });
  return Object.freeze({
    policy,
    profile,
    evaluate: (request) => policy.evaluate(request),
    evaluateWithProfile: (request) => {
      const decision = policy.evaluate(request);
      return Object.freeze({ ...decision, profile });
    },
    batchEvaluate: (batch) => batchEvaluateChurnPolicy(policy, batch),
    buildAuditReport: (decisions, now) => buildChurnPolicyAuditReport(decisions, now),
    buildStatsSummary: (decisions, roomId, now) => buildChurnPolicyStatsSummary(decisions, roomId, now),
    computeDiff: (before, after) => computeChurnPolicyDiff(before, after),
    rankRequests: (requests) => rankRequestsByUrgency(policy, requests),
    analyzeRisk: (snapshot) => analyzeRiskSnapshot(snapshot),
    compareRisks: (a, b) => compareRiskSnapshots(a, b),
    toJSON: () => Object.freeze({ profile, profileConfig }),
  });
}

// ============================================================================
// MARK: Named profile factories
// ============================================================================

export function createBalancedChurnRescuePolicy(options: Omit<ChurnRescuePolicyOptions, 'tuning'> = {}): ChurnRescuePolicyExtended {
  return createChurnRescuePolicyFromProfile('BALANCED', options);
}

export function createHaterHeavyChurnRescuePolicy(options: Omit<ChurnRescuePolicyOptions, 'tuning'> = {}): ChurnRescuePolicyExtended {
  return createChurnRescuePolicyFromProfile('HATER_HEAVY', options);
}

export function createHelperPriorityChurnRescuePolicy(options: Omit<ChurnRescuePolicyOptions, 'tuning'> = {}): ChurnRescuePolicyExtended {
  return createChurnRescuePolicyFromProfile('HELPER_PRIORITY', options);
}

export function createNegotiationFocusChurnRescuePolicy(options: Omit<ChurnRescuePolicyOptions, 'tuning'> = {}): ChurnRescuePolicyExtended {
  return createChurnRescuePolicyFromProfile('NEGOTIATION_FOCUS', options);
}

export function createLiveopsResponsiveChurnRescuePolicy(options: Omit<ChurnRescuePolicyOptions, 'tuning'> = {}): ChurnRescuePolicyExtended {
  return createChurnRescuePolicyFromProfile('LIVEOPS_RESPONSIVE', options);
}

export function createShadowHeavyChurnRescuePolicy(options: Omit<ChurnRescuePolicyOptions, 'tuning'> = {}): ChurnRescuePolicyExtended {
  return createChurnRescuePolicyFromProfile('SHADOW_HEAVY', options);
}

// ============================================================================
// MARK: Urgency window helpers
// ============================================================================

export function urgencyToWindowMs(urgency: ChatRescueUrgencyBand, tuning?: Partial<ChurnRescuePolicyTuning>): number {
  const t = { ...DEFAULT_TUNING, ...(tuning ?? {}) };
  switch (urgency) {
    case 'CRITICAL': return t.criticalWindowMs;
    case 'IMMEDIATE': return t.immediateWindowMs;
    case 'READY': return t.readyWindowMs;
    case 'WATCH': return t.watchWindowMs;
  }
}

export function urgencyLabel(urgency: ChatRescueUrgencyBand): string {
  switch (urgency) {
    case 'CRITICAL': return 'Crisis — act immediately or lose the run';
    case 'IMMEDIATE': return 'High pressure — window closing fast';
    case 'READY': return 'Opportunity open — helper can engage';
    case 'WATCH': return 'Monitor — not yet intervention-ready';
  }
}

export function rescueKindForReasonCode(reasonCode: ChatRescueReasonCode): ChatRescueKind {
  switch (reasonCode) {
    case 'NEGOTIATION_PANIC': return 'DEAL_ROOM_BAILOUT';
    case 'BOSS_WINDOW_LOCK': return 'ONE_CARD_RECOVERY';
    case 'CROWD_HOSTILITY_SURGE': return 'CROWD_SHIELD';
    case 'EMBARRASSMENT_OVERLOAD': return 'CROWD_SHIELD';
    case 'POST_COLLAPSE_DISORIENTATION': return 'POST_COLLAPSE_GUIDE';
    case 'COGNITIVE_OVERLOAD': return 'BREATH_WINDOW';
    case 'HELPER_RECEPTIVE_WINDOW': return 'HELPER_HANDOFF';
    case 'PLAYER_STOPPED_ACTING': return 'HELPER_HANDOFF';
    case 'STAGED_DEESCALATION': return 'HELPER_HANDOFF';
    case 'RETENTION_RISK': return 'HELPER_HANDOFF';
    default: return 'HELPER_HANDOFF';
  }
}

export function buildRescueNotesSummary(decision: ChurnRescuePolicyDecision): string {
  const risk = decision.risk;
  const parts: string[] = [
    `risk=${Number(risk.churnRisk01).toFixed(2)}`,
    `urgency=${risk.urgency}`,
    `code=${risk.reasonTrail.reasonCode}`,
    `intervene=${decision.shouldIntervene}`,
  ];
  if (decision.rescuePlan) parts.push(`kind=${decision.rescuePlan.kind}`);
  if (decision.predictedOutcome) parts.push(`band=${decision.predictedOutcome.successBand}`);
  if (risk.reasonTrail.suppressionReason) parts.push(`suppressed=${risk.reasonTrail.suppressionReason}`);
  return parts.join(' | ');
}

// ============================================================================
// MARK: Risk threshold validators
// ============================================================================

export function isHighChurnRisk(snapshot: ChurnRescueRiskSnapshot, cutoff01: Score01 = 0.55 as Score01): boolean {
  return Number(snapshot.churnRisk01) >= Number(cutoff01);
}

export function isHumiliationDanger(snapshot: ChurnRescueRiskSnapshot, cutoff01: Score01 = 0.60 as Score01): boolean {
  return Number(snapshot.humiliationHazard01) >= Number(cutoff01);
}

export function isHelperReady(snapshot: ChurnRescueRiskSnapshot, floor01: Score01 = 0.30 as Score01): boolean {
  return Number(snapshot.helperReadiness01) >= Number(floor01);
}

export function wouldBenefitFromShieldKind(snapshot: ChurnRescueRiskSnapshot): boolean {
  return Number(snapshot.publicRisk01) >= 0.58 || Number(snapshot.humiliationHazard01) >= 0.56;
}

export function wouldBenefitFromDirectHandoff(snapshot: ChurnRescueRiskSnapshot): boolean {
  return Number(snapshot.helperReadiness01) >= 0.38 && Number(snapshot.churnRisk01) >= 0.44;
}

export function urgencyRankOf(urgency: ChatRescueUrgencyBand): number {
  switch (urgency) {
    case 'CRITICAL': return 4;
    case 'IMMEDIATE': return 3;
    case 'READY': return 2;
    case 'WATCH': return 1;
  }
}

export function rescueShouldEscalate(before: ChurnRescueRiskSnapshot, after: ChurnRescueRiskSnapshot): boolean {
  return urgencyRankOf(after.urgency) > urgencyRankOf(before.urgency) ||
    Number(after.churnRisk01) - Number(before.churnRisk01) >= 0.12;
}

export function rescueShouldDeescalate(before: ChurnRescueRiskSnapshot, after: ChurnRescueRiskSnapshot): boolean {
  return urgencyRankOf(after.urgency) < urgencyRankOf(before.urgency) ||
    Number(before.churnRisk01) - Number(after.churnRisk01) >= 0.18;
}

// ============================================================================
// MARK: Rescue feasibility pre-checks
// ============================================================================

export interface ChurnRescueFeasibilityCheck {
  readonly feasible: boolean;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly recommendedProfile: ChurnRescuePolicyProfile;
}

export function checkRescueFeasibility(request: ChurnRescuePolicyRequest): ChurnRescueFeasibilityCheck {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!request.roomId) blockers.push('roomId is required');
  if (!request.sessionId) blockers.push('sessionId is required');
  if (!request.channelId) blockers.push('channelId is required');
  if (!request.playerId) blockers.push('playerId is required');
  if (!request.state) blockers.push('ChatState is required');
  if (!request.room) blockers.push('ChatRoomState is required');
  if (!request.session) blockers.push('ChatSessionState is required');

  const telemetry = request.telemetry;
  if (telemetry?.helperAlreadyActive) warnings.push('helper already active — suppression likely');
  if (telemetry?.activeRescueId) warnings.push('rescue already open — cooldown may suppress');
  if (!request.affect) warnings.push('affect not provided — fallback affect will be used');
  if (!request.feature) warnings.push('feature not provided — fallback feature will be used');

  const affect = request.affect;
  const crowdHostility01 = Number((request.feature as any)?.crowdHostility01 ?? 0);
  const embarrassment = Number(affect?.socialEmbarrassment ?? 0) / 100;

  let recommendedProfile: ChurnRescuePolicyProfile = 'BALANCED';
  if (crowdHostility01 >= 0.52 || embarrassment >= 0.52) {
    recommendedProfile = 'HATER_HEAVY';
  } else if (request.visibleChannel === 'DEAL_ROOM') {
    recommendedProfile = 'NEGOTIATION_FOCUS';
  } else if (embarrassment >= 0.68) {
    recommendedProfile = 'SHADOW_HEAVY';
  }

  return Object.freeze({
    feasible: blockers.length === 0,
    blockers: Object.freeze(blockers),
    warnings: Object.freeze(warnings),
    recommendedProfile,
  });
}

// ============================================================================
// MARK: Rescue decision serialization
// ============================================================================

export function serializeRescueDecision(decision: ChurnRescuePolicyDecision): Readonly<Record<string, unknown>> {
  return Object.freeze({
    shouldIntervene: decision.shouldIntervene,
    churnRisk01: Number(decision.risk.churnRisk01).toFixed(3),
    tilt01: Number(decision.risk.tilt01).toFixed(3),
    publicRisk01: Number(decision.risk.publicRisk01).toFixed(3),
    recoverability01: Number(decision.risk.recoverability01).toFixed(3),
    helperReadiness01: Number(decision.risk.helperReadiness01).toFixed(3),
    rescueNecessity01: Number(decision.risk.rescueNecessity01).toFixed(3),
    humiliationHazard01: Number(decision.risk.humiliationHazard01).toFixed(3),
    urgency: decision.risk.urgency,
    style: decision.risk.style,
    bestVisibleChannel: decision.risk.bestVisibleChannel,
    reasonCode: decision.risk.reasonTrail.reasonCode,
    suppressionReason: decision.risk.reasonTrail.suppressionReason ?? null,
    rescueKind: decision.rescuePlan?.kind ?? null,
    successBand: decision.predictedOutcome?.successBand ?? null,
    noteCount: decision.notes.length,
    firstNote: decision.notes[0] ?? null,
  });
}

export function deserializeRescueDecisionPartial(raw: Readonly<Record<string, unknown>>): Partial<ChurnRescuePolicyDecision> {
  return {
    shouldIntervene: Boolean(raw.shouldIntervene),
    notes: Array.isArray(raw.notes) ? raw.notes.filter((n): n is string => typeof n === 'string') : [],
  };
}

// ============================================================================
// MARK: Extended rescue and recovery surface
// ============================================================================

export function getRescueTrigger(plan: ChatRescuePlan): ChatRescueTrigger {
  return plan.trigger;
}

export function getRescueHelperPosture(plan: ChatRescuePlan): ChatRescueHelperPosture {
  return plan.helperPosture;
}

export function getRescueSelectedOffer(plan: ChatRescuePlan): ChatRescueOffer {
  return plan.selectedOffer;
}

export function getRescueOfferActions(offer: ChatRescueOffer): readonly ChatRescueAction[] {
  return offer.actions;
}

export function getRescueGuardrail(plan: ChatRescuePlan): ChatRescueGuardrail {
  return plan.guardrail;
}

export function getRescuePlanOutcome(plan: ChatRescuePlan): ChatRescueOutcome {
  return plan.state;
}

export function computeRescueTriggerCandidates(
  feature: ChatFeatureSnapshot,
  affect: ChatAffectSnapshot,
  telemetry: ChatRescueTelemetrySnapshot,
): readonly ChatRescueSignalVector[] {
  return deriveRescueTriggerCandidates(feature, affect, telemetry);
}

export function checkRescueSuppression(input: {
  readonly publicRisk01: Score01;
  readonly recoverability01: Score01;
  readonly confidence: Score100;
  readonly silencePreferred: boolean;
  readonly helperAlreadyActive: boolean;
  readonly supportedChannel: boolean;
  readonly guardrail?: ChatRescueGuardrail;
}): ChatRescueSuppressionReason | null {
  return shouldSuppressRescue(input);
}

export function computeRecoverySuccessBand(input: {
  readonly stabilityLift01: Score01;
  readonly embarrassmentReduction01: Score01;
  readonly confidenceLift01: Score01;
}): ChatRecoverySuccessBand {
  return deriveRecoverySuccessBand(input);
}

export function rescueScore01(value: number): Score01 {
  return toRescueScore01(value);
}

export function rescueScore100(value: number): Score100 {
  return toRescueScore100(value);
}

export function recoveryScore01(value: number): Score01 {
  return toRecoveryScore01(value);
}

export function recoveryScore100(value: number): Score100 {
  return toRecoveryScore100(value);
}

// ============================================================================
// MARK: ChurnRescuePolicyModule — combined barrel export
// ============================================================================

export const ChurnRescuePolicyModule = Object.freeze({
  // Core class + factory
  ChurnRescuePolicy,
  createChurnRescuePolicy,

  // Profile system
  createFromProfile: createChurnRescuePolicyFromProfile,
  createBalanced: createBalancedChurnRescuePolicy,
  createHaterHeavy: createHaterHeavyChurnRescuePolicy,
  createHelperPriority: createHelperPriorityChurnRescuePolicy,
  createNegotiationFocus: createNegotiationFocusChurnRescuePolicy,
  createLiveopsResponsive: createLiveopsResponsiveChurnRescuePolicy,
  createShadowHeavy: createShadowHeavyChurnRescuePolicy,

  // Batch ops
  batchEvaluate: batchEvaluateChurnPolicy,

  // Audit + stats
  buildAuditReport: buildChurnPolicyAuditReport,
  buildStatsSummary: buildChurnPolicyStatsSummary,

  // Diff + comparison
  computeDiff: computeChurnPolicyDiff,
  compareRisks: compareRiskSnapshots,
  rankRequests: rankRequestsByUrgency,

  // Analysis helpers
  analyzeRisk: analyzeRiskSnapshot,
  checkFeasibility: checkRescueFeasibility,
  buildNotesSummary: buildRescueNotesSummary,
  serializeDecision: serializeRescueDecision,

  // Scoring utilities
  urgencyToWindowMs,
  urgencyLabel,
  urgencyRankOf,
  rescueKindForReasonCode,
  isHighChurnRisk,
  isHumiliationDanger,
  isHelperReady,
  wouldBenefitFromShieldKind,
  wouldBenefitFromDirectHandoff,
  rescueShouldEscalate,
  rescueShouldDeescalate,

  // Data tables
  PROFILES: CHURN_RESCUE_POLICY_PROFILE_CONFIGS,
  REASON_PRIORITY: CHURN_RESCUE_REASON_PRIORITY,
  CHANNEL_LAW: CHURN_RESCUE_CHANNEL_LAW,
  STYLE_NOTES: CHURN_RESCUE_STYLE_NOTES,

  // Rescue plan field accessors
  getRescueTrigger,
  getRescueHelperPosture,
  getRescueSelectedOffer,
  getRescueOfferActions,
  getRescueGuardrail,
  getRescuePlanOutcome,

  // Extended rescue and recovery computations
  computeRescueTriggerCandidates,
  checkRescueSuppression,
  computeRecoverySuccessBand,
  rescueScore01,
  rescueScore100,
  recoveryScore01,
  recoveryScore100,
} as const);

// ============================================================================
// MARK: Decision validation and contract checks
// ============================================================================

export function validateChurnPolicyDecision(decision: ChurnRescuePolicyDecision): readonly string[] {
  const errors: string[] = [];
  if (decision.shouldIntervene) {
    if (!decision.rescuePlan) errors.push('shouldIntervene=true but rescuePlan is null');
    if (!decision.rescueWindow) errors.push('shouldIntervene=true but rescueWindow is null');
    if (!decision.recoveryPlan) errors.push('shouldIntervene=true but recoveryPlan is null');
    if (!decision.rescueState) errors.push('shouldIntervene=true but rescueState is null');
    if (!decision.rescueDigest) errors.push('shouldIntervene=true but rescueDigest is null');
    if (!decision.recoveryDigest) errors.push('shouldIntervene=true but recoveryDigest is null');
  } else {
    if (decision.rescuePlan) errors.push('shouldIntervene=false but rescuePlan is set');
    if (decision.rescueWindow) errors.push('shouldIntervene=false but rescueWindow is set');
  }
  const churnRisk = Number(decision.risk.churnRisk01);
  if (churnRisk < 0 || churnRisk > 1) errors.push(`churnRisk01 out of range: ${churnRisk}`);
  const necessity = Number(decision.risk.rescueNecessity01);
  if (necessity < 0 || necessity > 1) errors.push(`rescueNecessity01 out of range: ${necessity}`);
  return Object.freeze(errors);
}

export function assertValidDecision(decision: ChurnRescuePolicyDecision): void {
  const errors = validateChurnPolicyDecision(decision);
  if (errors.length > 0) {
    throw new Error(`ChurnRescuePolicyDecision contract violation: ${errors.join('; ')}`);
  }
}

// ============================================================================
// MARK: Reason code signal classification
// ============================================================================

export function reasonCodeSignalClass(code: ChatRescueReasonCode): 'PANIC' | 'SOCIAL' | 'FATIGUE' | 'COMBAT' | 'BEHAVIORAL' | 'OPPORTUNITY' {
  switch (code) {
    case 'NEGOTIATION_PANIC': return 'PANIC';
    case 'POST_COLLAPSE_DISORIENTATION': return 'PANIC';
    case 'EMBARRASSMENT_OVERLOAD': return 'SOCIAL';
    case 'CROWD_HOSTILITY_SURGE': return 'SOCIAL';
    case 'COGNITIVE_OVERLOAD': return 'FATIGUE';
    case 'PLAYER_STOPPED_ACTING': return 'FATIGUE';
    case 'BOSS_WINDOW_LOCK': return 'COMBAT';
    case 'RETENTION_RISK': return 'BEHAVIORAL';
    case 'STAGED_DEESCALATION': return 'BEHAVIORAL';
    case 'HELPER_RECEPTIVE_WINDOW': return 'OPPORTUNITY';
    default: return 'BEHAVIORAL';
  }
}

export function urgencyBandIsActionable(urgency: ChatRescueUrgencyBand): boolean {
  return urgency === 'READY' || urgency === 'IMMEDIATE' || urgency === 'CRITICAL';
}

export function decisionShouldShowHelper(decision: ChurnRescuePolicyDecision): boolean {
  if (!decision.shouldIntervene) return false;
  return Number(decision.risk.helperReadiness01) >= 0.32 &&
    decision.risk.bestVisibleChannel !== 'SPECTATOR' as ChatVisibleChannel;
}

export function decisionShouldUseShieldPattern(decision: ChurnRescuePolicyDecision): boolean {
  if (!decision.shouldIntervene) return false;
  const code = decision.risk.reasonTrail.reasonCode;
  return code === 'CROWD_HOSTILITY_SURGE' || code === 'EMBARRASSMENT_OVERLOAD' ||
    Number(decision.risk.publicRisk01) >= 0.58;
}

export function estimateRescueSuccessProbability(decision: ChurnRescuePolicyDecision): Score01 {
  if (!decision.shouldIntervene || !decision.predictedOutcome) return 0 as Score01;
  const band = decision.predictedOutcome.successBand;
  switch (band) {
    case 'RUN_SAVED': return 0.92 as Score01;
    case 'STRONG_LIFT': return 0.78 as Score01;
    case 'CLEAR_LIFT': return 0.58 as Score01;
    case 'SMALL_LIFT': return 0.34 as Score01;
    case 'NO_LIFT': return 0.08 as Score01;
  }
}

// ============================================================================
// MARK: Cooldown and deduplication helpers
// ============================================================================

export function isInCooldown(
  lastRescueAt: UnixMs | null | undefined,
  now: UnixMs,
  tuning?: Partial<ChurnRescuePolicyTuning>,
): boolean {
  if (!lastRescueAt) return false;
  const cooldownMs = tuning?.rescueCooldownMs ?? DEFAULT_TUNING.rescueCooldownMs;
  return Number(now) - Number(lastRescueAt) < cooldownMs;
}

export function timeUntilCooldownExpires(
  lastRescueAt: UnixMs | null | undefined,
  now: UnixMs,
  tuning?: Partial<ChurnRescuePolicyTuning>,
): number {
  if (!lastRescueAt) return 0;
  const cooldownMs = tuning?.rescueCooldownMs ?? DEFAULT_TUNING.rescueCooldownMs;
  return Math.max(0, cooldownMs - (Number(now) - Number(lastRescueAt)));
}

export function dedupeDecisions(
  decisions: readonly ChurnRescuePolicyDecision[],
): readonly ChurnRescuePolicyDecision[] {
  const seen = new Set<string>();
  return Object.freeze(decisions.filter((d) => {
    const key = `${d.risk.urgency}:${d.risk.reasonTrail.reasonCode}:${d.shouldIntervene}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }));
}

// ============================================================================
// MARK: Tuning diff and migration helpers
// ============================================================================

export interface ChurnRescuePolicyTuningDiff {
  readonly changed: readonly string[];
  readonly before: Partial<ChurnRescuePolicyTuning>;
  readonly after: Partial<ChurnRescuePolicyTuning>;
}

export function diffTuning(
  before: Partial<ChurnRescuePolicyTuning>,
  after: Partial<ChurnRescuePolicyTuning>,
): ChurnRescuePolicyTuningDiff {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]) as Set<keyof ChurnRescuePolicyTuning>;
  const changed: string[] = [];
  for (const key of keys) {
    if (before[key] !== after[key]) changed.push(key);
  }
  return Object.freeze({ changed: Object.freeze(changed), before: Object.freeze(before), after: Object.freeze(after) });
}

export function mergeTuningWithProfile(
  base: Partial<ChurnRescuePolicyTuning>,
  profile: ChurnRescuePolicyProfile,
): Partial<ChurnRescuePolicyTuning> {
  const profileTuning = CHURN_RESCUE_POLICY_PROFILE_CONFIGS[profile].tuning;
  return Object.freeze({ ...base, ...profileTuning });
}

// ============================================================================
// MARK: Authored rescue doctrine notes
// ============================================================================

export const CHURN_RESCUE_DOCTRINE: Readonly<Record<string, readonly string[]>> = Object.freeze({
  TIMING: Object.freeze([
    'Rescue timing is authored truth, not a UI heuristic.',
    'Too early and you undermine the pressure.',
    'Too late and the player has already left in their head.',
    'Window law enforces timing budget — not urgency alone.',
  ]),
  HUMILIATION: Object.freeze([
    'Public humiliation cost is always factored before channel assignment.',
    'A rescue that embarrasses the player in front of witnesses may cause more churn than no rescue.',
    'Shadow-first is not failure; it is restraint.',
  ]),
  HELPER_TRUST: Object.freeze([
    'Helper trust is not the same as helper presence.',
    'A helper who appears before trust is established can escalate panic.',
    'Helper receptivity is the gate. Readiness is the signal.',
  ]),
  SUPPRESSION: Object.freeze([
    'Suppression is not silence.',
    'A suppressed rescue is a deliberate authored choice, not a missed event.',
    'Suppression reasons must be explainable in replay.',
  ]),
  REASON_CODES: Object.freeze([
    'Reason codes classify the dominant churn vector, not the full picture.',
    'Multiple signals can be true simultaneously.',
    'Policy resolves to the highest-priority code; reason trail captures all signals.',
  ]),
});
