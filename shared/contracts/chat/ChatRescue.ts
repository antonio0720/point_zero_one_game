/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT RESCUE CONTRACTS
 * FILE: shared/contracts/chat/ChatRescue.ts
 * ============================================================================
 * Purpose
 * -------
 * Canonical shared contract surface for rescue interception, churn prevention,
 * frustration recovery staging, helper handoffs, and safe de-escalation.
 * ============================================================================
 */

import type {
  Brand,
  ChatActorKind,
  ChatChannelId,
  ChatInterventionId,
  ChatMemoryAnchorId,
  ChatMessageId,
  ChatMomentId,
  ChatMountKey,
  ChatNpcId,
  ChatProofHash,
  ChatRelationshipId,
  ChatReplayId,
  ChatRequestId,
  ChatRoomId,
  ChatRouteKey,
  ChatSceneId,
  ChatSessionId,
  ChatUserId,
  ChatVisibleChannel,
  JsonObject,
  Score01,
  Score100,
  TickNumber,
  UnixMs,
} from './ChatChannels';
import { CHAT_CONTRACT_AUTHORITIES, CHAT_CONTRACT_VERSION, channelSupportsRescue, getChatChannelDescriptor } from './ChatChannels';
import type { ChatAffectSnapshot, ChatFeatureSnapshot, ChatLearningProfile, ChatPressureTier, ChatReputationState, ChatRescueDecision, ChatRunOutcome } from './ChatEvents';
import type { ChatBossFightId, ChatBossFightKind, ChatBossFightState } from './ChatBossFight';
import type { ChatCounterplayKind, ChatCounterWindowId } from './ChatCounterplay';
import type { ChatMessageToneBand } from './ChatMessage';
import type { EpisodicMemoryEventType } from './memory';
import type { ChatRelationshipCounterpartKind, ChatRelationshipObjective, ChatRelationshipStance } from './relationship';
import type { SharedChatMomentType, SharedChatSceneArchetype, SharedChatSceneRole } from './scene';

export const CHAT_RESCUE_CONTRACT_VERSION = '2026-03-19.1' as const;
export const CHAT_RESCUE_CONTRACT_REVISION = 1 as const;
export const CHAT_RESCUE_PUBLIC_API_VERSION = 'v1' as const;
export const CHAT_RESCUE_AUTHORITIES = Object.freeze({
  ...CHAT_CONTRACT_AUTHORITIES,
  sharedContractFile: '/shared/contracts/chat/ChatRescue.ts',
  frontendRescueRoot: '/pzo-web/src/engines/chat/rescue',
  backendRescueRoot: '/backend/src/game/engine/chat/rescue',
  serverRescueRoot: '/pzo-server/src/chat',
} as const);
export type ChatRescueId = Brand<string, 'ChatRescueId'>;
export type ChatRescueTriggerId = Brand<string, 'ChatRescueTriggerId'>;
export type ChatRescuePlanId = Brand<string, 'ChatRescuePlanId'>;
export type ChatRescueWindowId = Brand<string, 'ChatRescueWindowId'>;
export type ChatRescueActionId = Brand<string, 'ChatRescueActionId'>;
export type ChatRescuePromptId = Brand<string, 'ChatRescuePromptId'>;
export type ChatRescueLedgerId = Brand<string, 'ChatRescueLedgerId'>;
export type ChatRescueOfferId = Brand<string, 'ChatRescueOfferId'>;
export type ChatRescueDigestId = Brand<string, 'ChatRescueDigestId'>;
export type ChatRescuePolicyId = Brand<string, 'ChatRescuePolicyId'>;
export type ChatRescueSignalId = Brand<string, 'ChatRescueSignalId'>;
export const CHAT_RESCUE_KINDS = [
  'RAGE_QUIT_INTERCEPT',
  'COLLAPSE_STABILIZE',
  'FAILURE_CHAIN_BREAK',
  'QUIET_RECOVERY',
  'HELPER_HANDOFF',
  'CROWD_SHIELD',
  'DEAL_ROOM_BAILOUT',
  'ONE_CARD_RECOVERY',
  'CHANNEL_COOLDOWN',
  'BREATH_WINDOW',
  'POST_COLLAPSE_GUIDE',
  'EXIT_WITH_DIGNITY',
] as const;
export type ChatRescueKind = (typeof CHAT_RESCUE_KINDS)[number];

export const CHAT_RESCUE_TRIGGER_KINDS = [
  'LONG_SILENCE',
  'FAILED_ACTION_CHAIN',
  'SENTIMENT_DROP',
  'PANEL_FLAPPING',
  'CHANNEL_HOPPING',
  'DEAL_ROOM_PANIC',
  'COMPOSER_ABORT_STREAK',
  'POST_COLLAPSE_FREEZE',
  'TELEGRAPH_LOCK',
  'SHAME_SPIKE',
  'HELPER_IGNORED_THEN_RETURNED',
  'BOSS_FIGHT_BREAKPOINT',
] as const;
export type ChatRescueTriggerKind = (typeof CHAT_RESCUE_TRIGGER_KINDS)[number];

export const CHAT_RESCUE_URGENCY_BANDS = [
  'WATCH',
  'READY',
  'IMMEDIATE',
  'CRITICAL',
] as const;
export type ChatRescueUrgencyBand = (typeof CHAT_RESCUE_URGENCY_BANDS)[number];

export const CHAT_RESCUE_STYLES = [
  'BLUNT',
  'CALM',
  'DIRECTIVE',
  'QUIET',
  'TACTICAL',
  'PROTECTIVE',
] as const;
export type ChatRescueStyle = (typeof CHAT_RESCUE_STYLES)[number];

export const CHAT_RESCUE_SURFACES = [
  'INLINE_MESSAGE',
  'BANNER',
  'MODAL',
  'SIDECARD',
  'SHADOW_ONLY',
  'SYSTEM_NOTICE',
] as const;
export type ChatRescueSurface = (typeof CHAT_RESCUE_SURFACES)[number];

export const CHAT_RESCUE_PRIVACY_CLASSES = [
  'PUBLIC',
  'PRIVATE',
  'SHADOW_ONLY',
  'HYBRID',
] as const;
export type ChatRescuePrivacyClass = (typeof CHAT_RESCUE_PRIVACY_CLASSES)[number];

export const CHAT_RESCUE_OUTCOMES = [
  'PENDING',
  'OFFERED',
  'ACCEPTED',
  'DECLINED',
  'TIMED_OUT',
  'SUPPRESSED',
  'ESCALATED',
  'RESOLVED',
  'ABANDONED',
] as const;
export type ChatRescueOutcome = (typeof CHAT_RESCUE_OUTCOMES)[number];

export const CHAT_RESCUE_ACTION_KINDS = [
  'OPEN_RECOVERY_CARD',
  'SUGGEST_EXIT_LINE',
  'MUTE_CROWD',
  'SHIFT_PRIVATE',
  'PING_HELPER',
  'START_SILENCE_BUFFER',
  'MARK_SAFE_WINDOW',
  'REVEAL_ONE_MOVE',
  'SHOW_PROOF_RECEIPT',
  'SUGGEST_NEGOTIATION_EXIT',
  'SUGGEST_SHIELD_STABILIZE',
  'CLOSE_PRESSURE_LOOP',
] as const;
export type ChatRescueActionKind = (typeof CHAT_RESCUE_ACTION_KINDS)[number];

export const CHAT_RESCUE_REASON_CODES = [
  'RETENTION_RISK',
  'EMBARRASSMENT_OVERLOAD',
  'COGNITIVE_OVERLOAD',
  'NEGOTIATION_PANIC',
  'POST_COLLAPSE_DISORIENTATION',
  'BOSS_WINDOW_LOCK',
  'CROWD_HOSTILITY_SURGE',
  'HELPER_RECEPTIVE_WINDOW',
  'PLAYER_STOPPED_ACTING',
  'STAGED_DEESCALATION',
] as const;
export type ChatRescueReasonCode = (typeof CHAT_RESCUE_REASON_CODES)[number];

export const CHAT_RESCUE_SUPPRESSION_REASONS = [
  'PLAYER_DOING_FINE',
  'NO_SUPPORTED_CHANNEL',
  'PUBLIC_INTERVENTION_TOO_COSTLY',
  'BOSS_FINISHER_IMMINENT',
  'DELIBERATE_SILENCE_PREFERRED',
  'HIGH_CONFIDENCE_RECOVERY_ALREADY_AVAILABLE',
  'HELPER_ALREADY_ACTIVE',
  'POLICY_BLOCKED',
] as const;
export type ChatRescueSuppressionReason = (typeof CHAT_RESCUE_SUPPRESSION_REASONS)[number];

export const CHAT_RESCUE_HELPER_POSTURES = [
  'NONE',
  'WATCHING',
  'READY',
  'ACTIVE',
  'OVERCOMMITTED',
] as const;
export type ChatRescueHelperPosture = (typeof CHAT_RESCUE_HELPER_POSTURES)[number];

export const CHAT_RESCUE_CHANNEL_STRATEGIES = [
  'STAY_VISIBLE',
  'SHIFT_PRIVATE',
  'SHADOW_STAGE',
  'VISIBLE_THEN_PRIVATE',
  'PRIVATE_THEN_VISIBLE_RECEIPT',
] as const;
export type ChatRescueChannelStrategy = (typeof CHAT_RESCUE_CHANNEL_STRATEGIES)[number];

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const clamp100 = (value: number): number => Math.max(0, Math.min(100, value));
export function toScore01(value: number): Score01 { return clamp01(value) as Score01; }
export function toScore100(value: number): Score100 { return Math.round(clamp100(value)) as Score100; }
export function compareRescueUrgency(left: ChatRescueUrgencyBand, right: ChatRescueUrgencyBand): number { const rank: Record<ChatRescueUrgencyBand, number> = { WATCH: 0, READY: 1, IMMEDIATE: 2, CRITICAL: 3 }; return rank[left] - rank[right]; }
export function compareRescueStyleSeverity(left: ChatRescueStyle, right: ChatRescueStyle): number { const rank: Record<ChatRescueStyle, number> = { QUIET: 0, CALM: 1, PROTECTIVE: 2, TACTICAL: 3, DIRECTIVE: 4, BLUNT: 5 }; return rank[left] - rank[right]; }
export interface ChatRescueActor {
  readonly actorId: ChatUserId | ChatNpcId;
  readonly actorKind: ChatActorKind;
  readonly counterpartKind?: ChatRelationshipCounterpartKind;
  readonly role: SharedChatSceneRole | 'PLAYER' | 'HELPER' | 'SYSTEM' | 'CROWD';
  readonly displayName: string;
  readonly relationshipId?: ChatRelationshipId | null;
  readonly relationshipStance?: ChatRelationshipStance | null;
  readonly objective?: ChatRelationshipObjective | null;
}

export interface ChatRescueTelemetrySnapshot {
  readonly sampledAt: UnixMs;
  readonly activeVisibleChannel: ChatVisibleChannel;
  readonly mountKey?: ChatMountKey | null;
  readonly routeKey?: ChatRouteKey | null;
  readonly pressureTier: ChatPressureTier;
  readonly composerLength: number;
  readonly consecutiveFailedActions: number;
  readonly composerAbortStreak: number;
  readonly panelToggleBurstCount: number;
  readonly channelHopBurstCount: number;
  readonly silenceMs: number;
  readonly recentCollapse: boolean;
  readonly dealRoomExposure01: Score01;
  readonly crowdHostility01: Score01;
  readonly readPressure01: Score01;
  readonly bossFightState?: ChatBossFightState | null;
  readonly bossFightKind?: ChatBossFightKind | null;
  readonly counterWindowId?: ChatCounterWindowId | null;
  readonly shadowOnlyAvailable: boolean;
  readonly notes?: readonly string[];
}

export interface ChatRescueSignalVector {
  readonly signalId: ChatRescueSignalId;
  readonly triggerKind: ChatRescueTriggerKind;
  readonly reasonCode: ChatRescueReasonCode;
  readonly sampledAt: UnixMs;
  readonly confidence01: Score01;
  readonly severity01: Score01;
  readonly recoverability01: Score01;
  readonly embarrassmentContribution01: Score01;
  readonly frustrationContribution01: Score01;
  readonly trustOpportunity01: Score01;
  readonly tags: readonly string[];
  readonly evidence: JsonObject;
}

export interface ChatRescueTrigger {
  readonly triggerId: ChatRescueTriggerId;
  readonly kind: ChatRescueTriggerKind;
  readonly reasonCode: ChatRescueReasonCode;
  readonly detectedAt: UnixMs;
  readonly requestId?: ChatRequestId | null;
  readonly messageId?: ChatMessageId | null;
  readonly momentId?: ChatMomentId | null;
  readonly sceneId?: ChatSceneId | null;
  readonly sourceEventType?: EpisodicMemoryEventType | null;
  readonly sourceMomentType?: SharedChatMomentType | null;
  readonly confidence01: Score01;
  readonly urgency: ChatRescueUrgencyBand;
  readonly publicRisk01: Score01;
  readonly recoverability01: Score01;
  readonly notes?: readonly string[];
}

export interface ChatRescueGuardrail {
  readonly suppressWhenPublicHumiliationWouldWorsen: boolean;
  readonly suppressWhenSilencePreferred: boolean;
  readonly suppressWhenPlayerConfidenceHealthy: boolean;
  readonly suppressWhenHelperAlreadyActive: boolean;
  readonly maxPublicOffersPerScene: number;
  readonly minMsBetweenOffers: number;
  readonly allowShadowOnlyFallback: boolean;
  readonly requiresSupportedChannel: boolean;
  readonly notes?: readonly string[];
}

export interface ChatRescuePrompt {
  readonly promptId: ChatRescuePromptId;
  readonly kind: ChatRescueKind;
  readonly style: ChatRescueStyle;
  readonly toneBand: ChatMessageToneBand;
  readonly surface: ChatRescueSurface;
  readonly privacyClass: ChatRescuePrivacyClass;
  readonly title: string;
  readonly bodyTemplate: string;
  readonly suggestedActionLabel?: string | null;
  readonly quietWindowMs?: number | null;
  readonly proofHash?: ChatProofHash | null;
  readonly replayId?: ChatReplayId | null;
  readonly notes?: readonly string[];
}

export interface ChatRescueAction {
  readonly actionId: ChatRescueActionId;
  readonly kind: ChatRescueActionKind;
  readonly label: string;
  readonly confidence01: Score01;
  readonly visibility: ChatRescuePrivacyClass;
  readonly recommendedChannel: ChatChannelId;
  readonly requiresHelper: boolean;
  readonly requiresBossWindowClosed: boolean;
  readonly requiresCounterWindowOpen: boolean;
  readonly suggestedCounterplayKind?: ChatCounterplayKind | null;
  readonly cooldownMs: number;
  readonly payload?: JsonObject;
  readonly notes?: readonly string[];
}

export interface ChatRescueOffer {
  readonly offerId: ChatRescueOfferId;
  readonly kind: ChatRescueKind;
  readonly style: ChatRescueStyle;
  readonly surface: ChatRescueSurface;
  readonly privacyClass: ChatRescuePrivacyClass;
  readonly urgency: ChatRescueUrgencyBand;
  readonly visibleChannel: ChatVisibleChannel;
  readonly preferredChannelStrategy: ChatRescueChannelStrategy;
  readonly prompt: ChatRescuePrompt;
  readonly actions: readonly ChatRescueAction[];
  readonly expiresAt?: UnixMs | null;
  readonly notes?: readonly string[];
}

export interface ChatRescueWindow {
  readonly windowId: ChatRescueWindowId;
  readonly rescueId: ChatRescueId;
  readonly openedAt: UnixMs;
  readonly closesAt: UnixMs;
  readonly urgency: ChatRescueUrgencyBand;
  readonly kind: ChatRescueKind;
  readonly allowSilenceAsSuccess: boolean;
  readonly allowHelperAutoAccept: boolean;
  readonly extendOnPanelReopen: boolean;
  readonly extendOnCounterMiss: boolean;
  readonly shadowEscalationAt?: UnixMs | null;
  readonly notes?: readonly string[];
}

export interface ChatRescuePlan {
  readonly rescuePlanId: ChatRescuePlanId;
  readonly rescueId: ChatRescueId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly visibleChannel: ChatVisibleChannel;
  readonly sessionId?: ChatSessionId | null;
  readonly requestId?: ChatRequestId | null;
  readonly sceneId?: ChatSceneId | null;
  readonly momentId?: ChatMomentId | null;
  readonly bossFightId?: ChatBossFightId | null;
  readonly kind: ChatRescueKind;
  readonly trigger: ChatRescueTrigger;
  readonly urgency: ChatRescueUrgencyBand;
  readonly style: ChatRescueStyle;
  readonly helperPosture: ChatRescueHelperPosture;
  readonly helperActor?: ChatRescueActor | null;
  readonly player: ChatRescueActor;
  readonly selectedOffer: ChatRescueOffer;
  readonly fallbackOffers: readonly ChatRescueOffer[];
  readonly channelStrategy: ChatRescueChannelStrategy;
  readonly guardrail: ChatRescueGuardrail;
  readonly state: ChatRescueOutcome;
  readonly createdAt: UnixMs;
  readonly offeredAt?: UnixMs | null;
  readonly resolvedAt?: UnixMs | null;
  readonly memoryAnchorId?: ChatMemoryAnchorId | null;
  readonly relatedInterventionId?: ChatInterventionId | null;
  readonly relatedDecision?: ChatRescueDecision | null;
  readonly notes?: readonly string[];
}

export interface ChatRescueStateSnapshot {
  readonly rescueId: ChatRescueId;
  readonly outcome: ChatRescueOutcome;
  readonly urgency: ChatRescueUrgencyBand;
  readonly style: ChatRescueStyle;
  readonly visibleChannel: ChatVisibleChannel;
  readonly helperPosture: ChatRescueHelperPosture;
  readonly activeWindowId?: ChatRescueWindowId | null;
  readonly activeOfferId?: ChatRescueOfferId | null;
  readonly publicRisk01: Score01;
  readonly recoverability01: Score01;
  readonly playerTilt01: Score01;
  readonly embarrassment01: Score01;
  readonly frustration01: Score01;
  readonly trustOpportunity01: Score01;
  readonly updatedAt: UnixMs;
}

export interface ChatRescueLedgerEntry {
  readonly ledgerId: ChatRescueLedgerId;
  readonly rescueId: ChatRescueId;
  readonly rescuePlanId: ChatRescuePlanId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly visibleChannel: ChatVisibleChannel;
  readonly outcome: ChatRescueOutcome;
  readonly reasonCode: ChatRescueReasonCode;
  readonly urgency: ChatRescueUrgencyBand;
  readonly style: ChatRescueStyle;
  readonly createdAt: UnixMs;
  readonly updatedAt: UnixMs;
  readonly acceptedActionId?: ChatRescueActionId | null;
  readonly acceptedOfferId?: ChatRescueOfferId | null;
  readonly winningHelperId?: ChatNpcId | null;
  readonly replayId?: ChatReplayId | null;
  readonly notes?: readonly string[];
}

export interface ChatRescueDigest {
  readonly digestId: ChatRescueDigestId;
  readonly updatedAt: UnixMs;
  readonly activeRescueIds: readonly ChatRescueId[];
  readonly criticalRescueIds: readonly ChatRescueId[];
  readonly shadowRescueIds: readonly ChatRescueId[];
  readonly acceptedRescueIds: readonly ChatRescueId[];
  readonly strongestOutcome?: ChatRescueOutcome;
  readonly strongestUrgency?: ChatRescueUrgencyBand;
}
export const DEFAULT_CHAT_RESCUE_GUARDRAIL = Object.freeze<ChatRescueGuardrail>({ suppressWhenPublicHumiliationWouldWorsen: true, suppressWhenSilencePreferred: true, suppressWhenPlayerConfidenceHealthy: true, suppressWhenHelperAlreadyActive: true, maxPublicOffersPerScene: 1, minMsBetweenOffers: 6000, allowShadowOnlyFallback: true, requiresSupportedChannel: true, notes: ['Default repo-safe rescue guardrail.'], });
export const CHAT_RESCUE_STYLE_BY_TRIGGER = Object.freeze<Record<ChatRescueTriggerKind, ChatRescueStyle>>({
  LONG_SILENCE: 'QUIET',
  FAILED_ACTION_CHAIN: 'DIRECTIVE',
  SENTIMENT_DROP: 'CALM',
  PANEL_FLAPPING: 'TACTICAL',
  CHANNEL_HOPPING: 'TACTICAL',
  DEAL_ROOM_PANIC: 'DIRECTIVE',
  COMPOSER_ABORT_STREAK: 'CALM',
  POST_COLLAPSE_FREEZE: 'PROTECTIVE',
  TELEGRAPH_LOCK: 'DIRECTIVE',
  SHAME_SPIKE: 'QUIET',
  HELPER_IGNORED_THEN_RETURNED: 'CALM',
  BOSS_FIGHT_BREAKPOINT: 'BLUNT',
});
export const CHAT_RESCUE_KIND_BY_TRIGGER = Object.freeze<Record<ChatRescueTriggerKind, ChatRescueKind>>({
  LONG_SILENCE: 'BREATH_WINDOW',
  FAILED_ACTION_CHAIN: 'FAILURE_CHAIN_BREAK',
  SENTIMENT_DROP: 'QUIET_RECOVERY',
  PANEL_FLAPPING: 'CHANNEL_COOLDOWN',
  CHANNEL_HOPPING: 'CHANNEL_COOLDOWN',
  DEAL_ROOM_PANIC: 'DEAL_ROOM_BAILOUT',
  COMPOSER_ABORT_STREAK: 'RAGE_QUIT_INTERCEPT',
  POST_COLLAPSE_FREEZE: 'POST_COLLAPSE_GUIDE',
  TELEGRAPH_LOCK: 'ONE_CARD_RECOVERY',
  SHAME_SPIKE: 'CROWD_SHIELD',
  HELPER_IGNORED_THEN_RETURNED: 'HELPER_HANDOFF',
  BOSS_FIGHT_BREAKPOINT: 'COLLAPSE_STABILIZE',
});
export const CHAT_RESCUE_REASON_BY_TRIGGER = Object.freeze<Record<ChatRescueTriggerKind, ChatRescueReasonCode>>({
  LONG_SILENCE: 'PLAYER_STOPPED_ACTING',
  FAILED_ACTION_CHAIN: 'COGNITIVE_OVERLOAD',
  SENTIMENT_DROP: 'RETENTION_RISK',
  PANEL_FLAPPING: 'POST_COLLAPSE_DISORIENTATION',
  CHANNEL_HOPPING: 'STAGED_DEESCALATION',
  DEAL_ROOM_PANIC: 'NEGOTIATION_PANIC',
  COMPOSER_ABORT_STREAK: 'RETENTION_RISK',
  POST_COLLAPSE_FREEZE: 'POST_COLLAPSE_DISORIENTATION',
  TELEGRAPH_LOCK: 'BOSS_WINDOW_LOCK',
  SHAME_SPIKE: 'EMBARRASSMENT_OVERLOAD',
  HELPER_IGNORED_THEN_RETURNED: 'HELPER_RECEPTIVE_WINDOW',
  BOSS_FIGHT_BREAKPOINT: 'BOSS_WINDOW_LOCK',
});
export function createChatRescueId(seed: string): ChatRescueId { return (`rescue:${seed}`) as ChatRescueId; }
export function createChatRescueTriggerId(seed: string): ChatRescueTriggerId { return (`rescue-trigger:${seed}`) as ChatRescueTriggerId; }
export function createChatRescuePlanId(seed: string): ChatRescuePlanId { return (`rescue-plan:${seed}`) as ChatRescuePlanId; }
export function createChatRescueWindowId(seed: string): ChatRescueWindowId { return (`rescue-window:${seed}`) as ChatRescueWindowId; }
export function createChatRescueActionId(seed: string): ChatRescueActionId { return (`rescue-action:${seed}`) as ChatRescueActionId; }
export function createChatRescuePromptId(seed: string): ChatRescuePromptId { return (`rescue-prompt:${seed}`) as ChatRescuePromptId; }
export function createChatRescueOfferId(seed: string): ChatRescueOfferId { return (`rescue-offer:${seed}`) as ChatRescueOfferId; }
export function deriveRescueUrgencyBand(input: {
  readonly silenceMs: number;
  readonly frustration: Score100;
  readonly embarrassment: Score100;
  readonly desperation: Score100;
  readonly trustOpportunity?: Score100;
  readonly bossFightState?: ChatBossFightState | null;
  readonly recentCollapse?: boolean;
}): ChatRescueUrgencyBand {
  const silencePressure = Math.min(30, input.silenceMs / 1000);
  const base =
    Number(input.frustration) * 0.35 +
    Number(input.embarrassment) * 0.25 +
    Number(input.desperation) * 0.30 +
    Number(input.trustOpportunity ?? (0 as Score100)) * 0.10 +
    silencePressure +
    (input.recentCollapse ? 18 : 0) +
    (input.bossFightState === 'WINDOW_OPEN' || input.bossFightState === 'ESCALATING' ? 12 : 0);
  if (base >= 115) return 'CRITICAL';
  if (base >= 88) return 'IMMEDIATE';
  if (base >= 58) return 'READY';
  return 'WATCH';
}

export function deriveRescuePublicRisk01(input: {
  readonly visibleChannel: ChatVisibleChannel;
  readonly embarrassment: Score100;
  readonly crowdHostility01: Score01;
  readonly publicExposure01?: Score01;
}): Score01 {
  const channelDescriptor = getChatChannelDescriptor(input.visibleChannel);
  const audienceProfile = channelDescriptor.audienceProfile;
  const channelExposure =
    audienceProfile === 'PUBLIC_ARENA'
      ? 0.95
      : audienceProfile === 'PREDATORY_TABLE'
        ? 0.75
        : audienceProfile === 'TRUST_CIRCLE'
          ? 0.48
          : 0.25;

  const raw =
    channelExposure * 0.40 +
    Number(input.embarrassment) / 100 * 0.30 +
    Number(input.crowdHostility01) * 0.20 +
    Number(input.publicExposure01 ?? (0 as Score01)) * 0.10;

  return toScore01(raw);
}

export function deriveRescueRecoverability01(input: {
  readonly confidence: Score100;
  readonly relief: Score100;
  readonly trust: Score100;
  readonly frustration: Score100;
  readonly desperation: Score100;
  readonly helperReceptivity?: Score100;
}): Score01 {
  const raw =
    Number(input.confidence) / 100 * 0.30 +
    Number(input.relief) / 100 * 0.10 +
    Number(input.trust) / 100 * 0.20 +
    Number(input.helperReceptivity ?? (0 as Score100)) / 100 * 0.20 +
    (1 - Number(input.frustration) / 100) * 0.10 +
    (1 - Number(input.desperation) / 100) * 0.10;

  return toScore01(raw);
}

export function deriveRescueTilt01(
  affect: Pick<ChatAffectSnapshot, 'frustration' | 'socialEmbarrassment' | 'desperation' | 'confidence'>,
): Score01 {
  const raw =
    Number(affect.frustration) / 100 * 0.40 +
    Number(affect.socialEmbarrassment) / 100 * 0.30 +
    Number(affect.desperation) / 100 * 0.25 +
    (1 - Number(affect.confidence) / 100) * 0.05;
  return toScore01(raw);
}
export function deriveRescueTriggerCandidates(feature: ChatFeatureSnapshot, affect: ChatAffectSnapshot, telemetry: ChatRescueTelemetrySnapshot): readonly ChatRescueSignalVector[] {
  const signals: ChatRescueSignalVector[] = [];
  if (telemetry.silenceMs >= 9000) {
    signals.push({
      signalId: (`signal:long-silence:${telemetry.sampledAt}`) as ChatRescueSignalId,
      triggerKind: 'LONG_SILENCE',
      reasonCode: 'PLAYER_STOPPED_ACTING',
      sampledAt: telemetry.sampledAt,
      confidence01: toScore01(Math.min(1, telemetry.silenceMs / 16000)),
      severity01: toScore01(Math.min(1, telemetry.silenceMs / 18000)),
      recoverability01: toScore01(1 - Number(affect.desperation) / 100 * 0.5),
      embarrassmentContribution01: toScore01(Number(affect.socialEmbarrassment) / 100 * 0.3),
      frustrationContribution01: toScore01(Number(affect.frustration) / 100 * 0.6),
      trustOpportunity01: toScore01(Number(affect.trust) / 100 * 0.5),
      tags: ['silence','stall','watch'],
      evidence: { silenceMs: telemetry.silenceMs, activeVisibleChannel: telemetry.activeVisibleChannel },
    });
  }
  if (telemetry.consecutiveFailedActions >= 2) {
    signals.push({
      signalId: (`signal:failed-chain:${telemetry.sampledAt}`) as ChatRescueSignalId,
      triggerKind: 'FAILED_ACTION_CHAIN',
      reasonCode: 'COGNITIVE_OVERLOAD',
      sampledAt: telemetry.sampledAt,
      confidence01: toScore01(Math.min(1, telemetry.consecutiveFailedActions / 4)),
      severity01: toScore01(Math.min(1, telemetry.consecutiveFailedActions / 5)),
      recoverability01: toScore01(0.65 - Number(affect.desperation) / 100 * 0.20),
      embarrassmentContribution01: toScore01(Number(affect.socialEmbarrassment) / 100 * 0.20),
      frustrationContribution01: toScore01(Number(affect.frustration) / 100 * 0.70),
      trustOpportunity01: toScore01(Number(affect.trust) / 100 * 0.35),
      tags: ['failure-chain','directive'],
      evidence: { consecutiveFailedActions: telemetry.consecutiveFailedActions },
    });
  }
  if (Number(feature.frustrationScore ?? (0 as Score100)) >= 72) {
    signals.push({
      signalId: (`signal:sentiment-drop:${telemetry.sampledAt}`) as ChatRescueSignalId,
      triggerKind: 'SENTIMENT_DROP',
      reasonCode: 'RETENTION_RISK',
      sampledAt: telemetry.sampledAt,
      confidence01: toScore01(Number(feature.churnRisk ?? (0 as Score01)) * 0.75 + 0.20),
      severity01: toScore01(Number(feature.frustrationScore ?? (0 as Score100)) / 100),
      recoverability01: toScore01(Number(affect.trust) / 100 * 0.45 + Number(affect.confidence) / 100 * 0.20),
      embarrassmentContribution01: toScore01(Number(affect.socialEmbarrassment) / 100 * 0.40),
      frustrationContribution01: toScore01(Number(affect.frustration) / 100 * 0.80),
      trustOpportunity01: toScore01(Number(affect.trust) / 100 * 0.60),
      tags: ['sentiment','churn-risk'],
      evidence: { frustrationScore: Number(feature.frustrationScore ?? (0 as Score100)), churnRisk: Number(feature.churnRisk ?? (0 as Score01)) },
    });
  }
  if (telemetry.panelToggleBurstCount >= 4) {
    signals.push({
      signalId: (`signal:panel-flap:${telemetry.sampledAt}`) as ChatRescueSignalId,
      triggerKind: 'PANEL_FLAPPING',
      reasonCode: 'POST_COLLAPSE_DISORIENTATION',
      sampledAt: telemetry.sampledAt,
      confidence01: toScore01(Math.min(1, telemetry.panelToggleBurstCount / 6)),
      severity01: toScore01(Math.min(1, telemetry.panelToggleBurstCount / 8)),
      recoverability01: toScore01(0.72),
      embarrassmentContribution01: toScore01(Number(affect.socialEmbarrassment) / 100 * 0.15),
      frustrationContribution01: toScore01(Number(affect.frustration) / 100 * 0.45),
      trustOpportunity01: toScore01(Number(affect.trust) / 100 * 0.30),
      tags: ['ui-instability','re-entry'],
      evidence: { panelToggleBurstCount: telemetry.panelToggleBurstCount },
    });
  }
  if (telemetry.channelHopBurstCount >= 3) {
    signals.push({
      signalId: (`signal:channel-hop:${telemetry.sampledAt}`) as ChatRescueSignalId,
      triggerKind: 'CHANNEL_HOPPING',
      reasonCode: 'STAGED_DEESCALATION',
      sampledAt: telemetry.sampledAt,
      confidence01: toScore01(Math.min(1, telemetry.channelHopBurstCount / 5)),
      severity01: toScore01(Math.min(1, telemetry.channelHopBurstCount / 6)),
      recoverability01: toScore01(0.68),
      embarrassmentContribution01: toScore01(Number(affect.socialEmbarrassment) / 100 * 0.25),
      frustrationContribution01: toScore01(Number(affect.frustration) / 100 * 0.35),
      trustOpportunity01: toScore01(Number(affect.trust) / 100 * 0.22),
      tags: ['channel-hopping','cooldown'],
      evidence: { channelHopBurstCount: telemetry.channelHopBurstCount },
    });
  }
  if (telemetry.dealRoomExposure01 >= (0.65 as Score01) && Number(affect.desperation) >= 72) {
    signals.push({
      signalId: (`signal:dealroom-panic:${telemetry.sampledAt}`) as ChatRescueSignalId,
      triggerKind: 'DEAL_ROOM_PANIC',
      reasonCode: 'NEGOTIATION_PANIC',
      sampledAt: telemetry.sampledAt,
      confidence01: toScore01(Number(telemetry.dealRoomExposure01) * 0.8 + 0.15),
      severity01: toScore01(Number(affect.desperation) / 100 * 0.75 + Number(telemetry.dealRoomExposure01) * 0.25),
      recoverability01: toScore01(Number(affect.trust) / 100 * 0.25 + 0.30),
      embarrassmentContribution01: toScore01(Number(affect.socialEmbarrassment) / 100 * 0.20),
      frustrationContribution01: toScore01(Number(affect.frustration) / 100 * 0.25),
      trustOpportunity01: toScore01(Number(affect.trust) / 100 * 0.40),
      tags: ['deal-room','panic','exit'],
      evidence: { dealRoomExposure01: Number(telemetry.dealRoomExposure01), desperation: Number(affect.desperation) },
    });
  }
  if (telemetry.composerAbortStreak >= 3) {
    signals.push({
      signalId: (`signal:composer-abort:${telemetry.sampledAt}`) as ChatRescueSignalId,
      triggerKind: 'COMPOSER_ABORT_STREAK',
      reasonCode: 'RETENTION_RISK',
      sampledAt: telemetry.sampledAt,
      confidence01: toScore01(Math.min(1, telemetry.composerAbortStreak / 5)),
      severity01: toScore01(Math.min(1, telemetry.composerAbortStreak / 6)),
      recoverability01: toScore01(0.58 + Number(affect.trust) / 100 * 0.10),
      embarrassmentContribution01: toScore01(Number(affect.socialEmbarrassment) / 100 * 0.35),
      frustrationContribution01: toScore01(Number(affect.frustration) / 100 * 0.50),
      trustOpportunity01: toScore01(Number(affect.trust) / 100 * 0.35),
      tags: ['abort','hesitation'],
      evidence: { composerAbortStreak: telemetry.composerAbortStreak },
    });
  }
  if (telemetry.recentCollapse) {
    signals.push({
      signalId: (`signal:collapse-freeze:${telemetry.sampledAt}`) as ChatRescueSignalId,
      triggerKind: 'POST_COLLAPSE_FREEZE',
      reasonCode: 'POST_COLLAPSE_DISORIENTATION',
      sampledAt: telemetry.sampledAt,
      confidence01: toScore01(0.82),
      severity01: toScore01(Number(affect.socialEmbarrassment) / 100 * 0.45 + Number(affect.frustration) / 100 * 0.20),
      recoverability01: toScore01(Number(affect.trust) / 100 * 0.30 + 0.35),
      embarrassmentContribution01: toScore01(Number(affect.socialEmbarrassment) / 100 * 0.65),
      frustrationContribution01: toScore01(Number(affect.frustration) / 100 * 0.35),
      trustOpportunity01: toScore01(Number(affect.trust) / 100 * 0.55),
      tags: ['collapse','freeze'],
      evidence: { recentCollapse: telemetry.recentCollapse, bossFightState: telemetry.bossFightState ?? null },
    });
  }
  if (Boolean(telemetry.counterWindowId) && telemetry.bossFightState === 'WINDOW_OPEN' && Number(affect.confidence) <= 34) {
    signals.push({
      signalId: (`signal:telegraph-lock:${telemetry.sampledAt}`) as ChatRescueSignalId,
      triggerKind: 'TELEGRAPH_LOCK',
      reasonCode: 'BOSS_WINDOW_LOCK',
      sampledAt: telemetry.sampledAt,
      confidence01: toScore01(0.86),
      severity01: toScore01(Number(affect.desperation) / 100 * 0.40 + 0.35),
      recoverability01: toScore01(0.55 + Number(affect.trust) / 100 * 0.15),
      embarrassmentContribution01: toScore01(Number(affect.socialEmbarrassment) / 100 * 0.25),
      frustrationContribution01: toScore01(Number(affect.frustration) / 100 * 0.30),
      trustOpportunity01: toScore01(Number(affect.trust) / 100 * 0.38),
      tags: ['boss-window','telegraph','one-card'],
      evidence: { counterWindowId: String(telemetry.counterWindowId), bossFightState: telemetry.bossFightState },
    });
  }
  if (Number(affect.socialEmbarrassment) >= 78 && telemetry.crowdHostility01 >= (0.6 as Score01)) {
    signals.push({
      signalId: (`signal:shame-spike:${telemetry.sampledAt}`) as ChatRescueSignalId,
      triggerKind: 'SHAME_SPIKE',
      reasonCode: 'EMBARRASSMENT_OVERLOAD',
      sampledAt: telemetry.sampledAt,
      confidence01: toScore01(0.78),
      severity01: toScore01(Number(affect.socialEmbarrassment) / 100 * 0.8),
      recoverability01: toScore01(0.45 + Number(affect.trust) / 100 * 0.20),
      embarrassmentContribution01: toScore01(Number(affect.socialEmbarrassment) / 100 * 0.80),
      frustrationContribution01: toScore01(Number(affect.frustration) / 100 * 0.25),
      trustOpportunity01: toScore01(Number(affect.trust) / 100 * 0.25),
      tags: ['crowd','shame'],
      evidence: { crowdHostility01: Number(telemetry.crowdHostility01), embarrassment: Number(affect.socialEmbarrassment) },
    });
  }
  if (Number(affect.trust) >= 62 && Number(affect.frustration) >= 45 && Number(affect.frustration) <= 80) {
    signals.push({
      signalId: (`signal:helper-returned:${telemetry.sampledAt}`) as ChatRescueSignalId,
      triggerKind: 'HELPER_IGNORED_THEN_RETURNED',
      reasonCode: 'HELPER_RECEPTIVE_WINDOW',
      sampledAt: telemetry.sampledAt,
      confidence01: toScore01(0.66),
      severity01: toScore01(0.42),
      recoverability01: toScore01(0.80),
      embarrassmentContribution01: toScore01(0.15),
      frustrationContribution01: toScore01(0.32),
      trustOpportunity01: toScore01(0.75),
      tags: ['helper','receptive-window'],
      evidence: { trust: Number(affect.trust), frustration: Number(affect.frustration) },
    });
  }
  if (telemetry.bossFightState === 'BREAKPOINT' || telemetry.pressureTier === 'BREAKPOINT') {
    signals.push({
      signalId: (`signal:boss-breakpoint:${telemetry.sampledAt}`) as ChatRescueSignalId,
      triggerKind: 'BOSS_FIGHT_BREAKPOINT',
      reasonCode: 'BOSS_WINDOW_LOCK',
      sampledAt: telemetry.sampledAt,
      confidence01: toScore01(0.81),
      severity01: toScore01(0.76),
      recoverability01: toScore01(0.52 + Number(affect.trust) / 100 * 0.12),
      embarrassmentContribution01: toScore01(Number(affect.socialEmbarrassment) / 100 * 0.18),
      frustrationContribution01: toScore01(Number(affect.frustration) / 100 * 0.42),
      trustOpportunity01: toScore01(Number(affect.trust) / 100 * 0.45),
      tags: ['boss','breakpoint'],
      evidence: { bossFightState: telemetry.bossFightState ?? null, pressureTier: telemetry.pressureTier },
    });
  }
  return signals;
}
export function choosePrimaryRescueSignal(
  signals: readonly ChatRescueSignalVector[],
): ChatRescueSignalVector | null {
  if (!signals.length) return null;
  const ordered = [...signals].sort((left, right) => {
    const leftScore =
      Number(left.confidence01) * 0.45 +
      Number(left.severity01) * 0.35 +
      Number(left.trustOpportunity01) * 0.20;
    const rightScore =
      Number(right.confidence01) * 0.45 +
      Number(right.severity01) * 0.35 +
      Number(right.trustOpportunity01) * 0.20;
    return rightScore - leftScore;
  });
  return ordered[0] ?? null;
}

export function deriveRescueStyle(
  triggerKind: ChatRescueTriggerKind,
  urgency: ChatRescueUrgencyBand,
): ChatRescueStyle {
  const base = CHAT_RESCUE_STYLE_BY_TRIGGER[triggerKind];
  if (urgency === 'CRITICAL' && base === 'QUIET') return 'DIRECTIVE';
  if (urgency === 'CRITICAL' && base === 'CALM') return 'BLUNT';
  return base;
}

export function deriveRescueKind(triggerKind: ChatRescueTriggerKind): ChatRescueKind {
  return CHAT_RESCUE_KIND_BY_TRIGGER[triggerKind];
}

export function pickRescueVisibleChannel(
  preferred: ChatVisibleChannel,
  profile: ChatLearningProfile,
): ChatVisibleChannel {
  const candidates: ChatVisibleChannel[] = ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'];
  const viable = candidates.filter((channel) => channelSupportsRescue(channel));
  let winner = preferred;
  let score = Number(profile.channelAffinity[preferred] ?? (0 as Score100));

  for (const candidate of viable) {
    const next = Number(profile.channelAffinity[candidate] ?? (0 as Score100));
    if (next > score) {
      winner = candidate;
      score = next;
    }
  }

  return winner;
}

export function shouldSuppressRescue(input: {
  readonly publicRisk01: Score01;
  readonly recoverability01: Score01;
  readonly confidence: Score100;
  readonly silencePreferred: boolean;
  readonly helperAlreadyActive: boolean;
  readonly supportedChannel: boolean;
  readonly guardrail?: ChatRescueGuardrail;
}): ChatRescueSuppressionReason | null {
  const guardrail = input.guardrail ?? DEFAULT_CHAT_RESCUE_GUARDRAIL;

  if (!input.supportedChannel && guardrail.requiresSupportedChannel) {
    return 'NO_SUPPORTED_CHANNEL';
  }
  if (guardrail.suppressWhenSilencePreferred && input.silencePreferred) {
    return 'DELIBERATE_SILENCE_PREFERRED';
  }
  if (guardrail.suppressWhenHelperAlreadyActive && input.helperAlreadyActive) {
    return 'HELPER_ALREADY_ACTIVE';
  }
  if (
    guardrail.suppressWhenPlayerConfidenceHealthy &&
    Number(input.confidence) >= 72 &&
    Number(input.recoverability01) >= 0.70
  ) {
    return 'PLAYER_DOING_FINE';
  }
  if (
    guardrail.suppressWhenPublicHumiliationWouldWorsen &&
    Number(input.publicRisk01) >= 0.82 &&
    Number(input.recoverability01) <= 0.35
  ) {
    return 'PUBLIC_INTERVENTION_TOO_COSTLY';
  }
  return null;
}
export function createRescuePrompt(
  kind: ChatRescueKind,
  style: ChatRescueStyle,
  visibleChannel: ChatVisibleChannel,
): ChatRescuePrompt {
  const quietWindowMs = kind === 'BREATH_WINDOW' || style === 'QUIET' ? 2500 : null;
  const title =
    kind === 'ONE_CARD_RECOVERY'
      ? 'One move. Reset the spiral.'
      : kind === 'DEAL_ROOM_BAILOUT'
        ? 'Back out cleanly.'
        : kind === 'CROWD_SHIELD'
          ? 'Take the crowd out of the loop.'
          : 'Stabilize first.';

  const bodyTemplate =
    kind === 'QUIET_RECOVERY'
      ? 'Pause. Do not feed the pressure loop. Pick one safe action.'
      : kind === 'FAILURE_CHAIN_BREAK'
        ? 'You do not need a perfect reply. Take the next high-confidence action only.'
        : kind === 'DEAL_ROOM_BAILOUT'
          ? 'Exit the squeeze, then re-enter on your terms.'
          : 'This is a recovery window, not a surrender cue.';

  return {
    promptId: createChatRescuePromptId(
      `${kind.toLowerCase()}:${style.toLowerCase()}:${visibleChannel.toLowerCase()}`,
    ),
    kind,
    style,
    toneBand:
      style === 'BLUNT'
        ? 'INTENSE'
        : style === 'DIRECTIVE'
          ? 'FIRM'
          : style === 'TACTICAL'
            ? 'COOL'
            : style === 'PROTECTIVE'
              ? 'WARM'
              : 'NEUTRAL',
    surface: style === 'QUIET' ? 'SIDECARD' : style === 'BLUNT' ? 'INLINE_MESSAGE' : 'BANNER',
    privacyClass:
      kind === 'CROWD_SHIELD' || kind === 'DEAL_ROOM_BAILOUT'
        ? 'PRIVATE'
        : style === 'QUIET'
          ? 'HYBRID'
          : 'PRIVATE',
    title,
    bodyTemplate,
    suggestedActionLabel:
      kind === 'ONE_CARD_RECOVERY'
        ? 'Show one move'
        : kind === 'DEAL_ROOM_BAILOUT'
          ? 'Exit cleanly'
          : 'Stabilize',
    quietWindowMs,
    proofHash: null,
    replayId: null,
    notes: [`visibleChannel=${visibleChannel}`],
  };
}

export function createRescueActions(
  kind: ChatRescueKind,
  visibleChannel: ChatVisibleChannel,
): readonly ChatRescueAction[] {
  const privateChannel: ChatChannelId = visibleChannel === 'GLOBAL' ? 'SYNDICATE' : visibleChannel;

  const base: ChatRescueAction[] = [
    {
      actionId: createChatRescueActionId(`${kind.toLowerCase()}:open-recovery-card`),
      kind: 'OPEN_RECOVERY_CARD',
      label: 'Open recovery card',
      confidence01: toScore01(0.82),
      visibility: 'PRIVATE',
      recommendedChannel: privateChannel,
      requiresHelper: false,
      requiresBossWindowClosed: false,
      requiresCounterWindowOpen: false,
      suggestedCounterplayKind: null,
      cooldownMs: 1200,
    },
    {
      actionId: createChatRescueActionId(`${kind.toLowerCase()}:mute-crowd`),
      kind: 'MUTE_CROWD',
      label: 'Mute crowd pressure',
      confidence01: toScore01(0.74),
      visibility: 'PRIVATE',
      recommendedChannel: privateChannel,
      requiresHelper: false,
      requiresBossWindowClosed: false,
      requiresCounterWindowOpen: false,
      suggestedCounterplayKind: null,
      cooldownMs: 800,
    },
  ];

  if (kind === 'ONE_CARD_RECOVERY') {
    base.push({
      actionId: createChatRescueActionId(`${kind.toLowerCase()}:reveal-one-move`),
      kind: 'REVEAL_ONE_MOVE',
      label: 'Reveal one move',
      confidence01: toScore01(0.90),
      visibility: 'PRIVATE',
      recommendedChannel: privateChannel,
      requiresHelper: true,
      requiresBossWindowClosed: false,
      requiresCounterWindowOpen: true,
      suggestedCounterplayKind: 'HELPER_ASSIST',
      cooldownMs: 600,
    });
  }

  if (kind === 'DEAL_ROOM_BAILOUT') {
    base.push({
      actionId: createChatRescueActionId(`${kind.toLowerCase()}:negotiation-exit`),
      kind: 'SUGGEST_NEGOTIATION_EXIT',
      label: 'Exit the squeeze',
      confidence01: toScore01(0.88),
      visibility: 'PRIVATE',
      recommendedChannel: 'DEAL_ROOM',
      requiresHelper: false,
      requiresBossWindowClosed: false,
      requiresCounterWindowOpen: false,
      suggestedCounterplayKind: 'NEGOTIATION_ESCAPE',
      cooldownMs: 600,
    });
  }

  if (kind === 'COLLAPSE_STABILIZE' || kind === 'POST_COLLAPSE_GUIDE') {
    base.push({
      actionId: createChatRescueActionId(`${kind.toLowerCase()}:shield-stabilize`),
      kind: 'SUGGEST_SHIELD_STABILIZE',
      label: 'Stabilize shield first',
      confidence01: toScore01(0.84),
      visibility: 'PRIVATE',
      recommendedChannel: privateChannel,
      requiresHelper: true,
      requiresBossWindowClosed: false,
      requiresCounterWindowOpen: false,
      suggestedCounterplayKind: 'SHIELD_STABILIZE',
      cooldownMs: 900,
    });
  }

  return base;
}

export function createRescueOffer(
  kind: ChatRescueKind,
  style: ChatRescueStyle,
  urgency: ChatRescueUrgencyBand,
  visibleChannel: ChatVisibleChannel,
  now: UnixMs,
): ChatRescueOffer {
  const prompt = createRescuePrompt(kind, style, visibleChannel);

  return {
    offerId: createChatRescueOfferId(`${kind.toLowerCase()}:${style.toLowerCase()}:${Number(now)}`),
    kind,
    style,
    surface: prompt.surface,
    privacyClass: prompt.privacyClass,
    urgency,
    visibleChannel,
    preferredChannelStrategy:
      kind === 'CROWD_SHIELD'
        ? 'SHIFT_PRIVATE'
        : style === 'QUIET'
          ? 'VISIBLE_THEN_PRIVATE'
          : 'SHIFT_PRIVATE',
    prompt,
    actions: createRescueActions(kind, visibleChannel),
    expiresAt: ((Number(now) + (urgency === 'CRITICAL' ? 4500 : urgency === 'IMMEDIATE' ? 6500 : 9000)) as UnixMs),
    notes: [],
  };
}

export function createRescueWindow(
  rescueId: ChatRescueId,
  kind: ChatRescueKind,
  urgency: ChatRescueUrgencyBand,
  openedAt: UnixMs,
): ChatRescueWindow {
  const duration =
    urgency === 'CRITICAL'
      ? 3500
      : urgency === 'IMMEDIATE'
        ? 5500
        : urgency === 'READY'
          ? 8000
          : 12000;

  return {
    windowId: createChatRescueWindowId(`${String(rescueId)}:${Number(openedAt)}`),
    rescueId,
    openedAt,
    closesAt: ((Number(openedAt) + duration) as UnixMs),
    urgency,
    kind,
    allowSilenceAsSuccess: kind === 'BREATH_WINDOW' || kind === 'QUIET_RECOVERY',
    allowHelperAutoAccept: urgency === 'CRITICAL',
    extendOnPanelReopen: true,
    extendOnCounterMiss: true,
    shadowEscalationAt: ((Number(openedAt) + Math.floor(duration * 0.65)) as UnixMs),
    notes: [],
  };
}
export function buildRescuePlan(input: {
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly visibleChannel: ChatVisibleChannel;
  readonly sessionId?: ChatSessionId | null;
  readonly requestId?: ChatRequestId | null;
  readonly sceneId?: ChatSceneId | null;
  readonly momentId?: ChatMomentId | null;
  readonly bossFightId?: ChatBossFightId | null;
  readonly player: ChatRescueActor;
  readonly helperActor?: ChatRescueActor | null;
  readonly feature: ChatFeatureSnapshot;
  readonly affect: ChatAffectSnapshot;
  readonly reputation: ChatReputationState;
  readonly learning: ChatLearningProfile;
  readonly telemetry: ChatRescueTelemetrySnapshot;
  readonly now: UnixMs;
}): ChatRescuePlan | null {
  const signals = deriveRescueTriggerCandidates(input.feature, input.affect, input.telemetry);
  const primary = choosePrimaryRescueSignal(signals);
  if (!primary) return null;

  const triggerId = createChatRescueTriggerId(`${primary.triggerKind.toLowerCase()}:${Number(input.now)}`);
  const urgency = deriveRescueUrgencyBand({
    silenceMs: input.telemetry.silenceMs,
    frustration: input.affect.frustration,
    embarrassment: input.affect.socialEmbarrassment,
    desperation: input.affect.desperation,
    trustOpportunity: toScore100(Number(primary.trustOpportunity01) * 100),
    bossFightState: input.telemetry.bossFightState ?? null,
    recentCollapse: input.telemetry.recentCollapse,
  });

  const visibleChannel = pickRescueVisibleChannel(input.visibleChannel, input.learning);
  const publicRisk01 = deriveRescuePublicRisk01({
    visibleChannel,
    embarrassment: input.affect.socialEmbarrassment,
    crowdHostility01: input.telemetry.crowdHostility01,
    publicExposure01: input.telemetry.dealRoomExposure01,
  });

  const recoverability01 = deriveRescueRecoverability01({
    confidence: input.affect.confidence,
    relief: input.affect.relief,
    trust: input.affect.trust,
    frustration: input.affect.frustration,
    desperation: input.affect.desperation,
    helperReceptivity: input.learning.helperReceptivity,
  });

  const suppression = shouldSuppressRescue({
    publicRisk01,
    recoverability01,
    confidence: input.affect.confidence,
    silencePreferred: primary.triggerKind === 'LONG_SILENCE' && Number(input.affect.socialEmbarrassment) >= 65,
    helperAlreadyActive: Boolean(input.helperActor),
    supportedChannel: channelSupportsRescue(visibleChannel),
  });

  if (suppression) return null;

  const trigger: ChatRescueTrigger = {
    triggerId,
    kind: primary.triggerKind,
    reasonCode: primary.reasonCode,
    detectedAt: primary.sampledAt,
    requestId: input.requestId ?? null,
    messageId: null,
    momentId: input.momentId ?? null,
    sceneId: input.sceneId ?? null,
    sourceEventType: null,
    sourceMomentType: null,
    confidence01: primary.confidence01,
    urgency,
    publicRisk01,
    recoverability01,
    notes: primary.tags,
  };

  const rescueId = createChatRescueId(`${primary.triggerKind.toLowerCase()}:${Number(input.now)}`);
  const kind = deriveRescueKind(primary.triggerKind);
  const style = deriveRescueStyle(primary.triggerKind, urgency);
  const offer = createRescueOffer(kind, style, urgency, visibleChannel, input.now);

  return {
    rescuePlanId: createChatRescuePlanId(`${String(rescueId)}:plan`),
    rescueId,
    roomId: input.roomId,
    channelId: input.channelId,
    visibleChannel,
    sessionId: input.sessionId ?? null,
    requestId: input.requestId ?? null,
    sceneId: input.sceneId ?? null,
    momentId: input.momentId ?? null,
    bossFightId: input.bossFightId ?? null,
    kind,
    trigger,
    urgency,
    style,
    helperPosture: input.helperActor ? 'READY' : 'NONE',
    helperActor: input.helperActor ?? null,
    player: input.player,
    selectedOffer: offer,
    fallbackOffers: [
      createRescueOffer('QUIET_RECOVERY', style === 'BLUNT' ? 'CALM' : style, urgency, visibleChannel, input.now),
    ],
    channelStrategy: offer.preferredChannelStrategy,
    guardrail: DEFAULT_CHAT_RESCUE_GUARDRAIL,
    state: 'PENDING',
    createdAt: input.now,
    offeredAt: null,
    resolvedAt: null,
    memoryAnchorId: null,
    relatedInterventionId: null,
    relatedDecision: null,
    notes: [`reputation=${Number(input.reputation.rescueNeediness)}`, `trigger=${primary.triggerKind}`],
  };
}

export function deriveRescueStateSnapshot(
  plan: ChatRescuePlan,
  affect: ChatAffectSnapshot,
  updatedAt: UnixMs,
  activeWindowId?: ChatRescueWindowId | null,
): ChatRescueStateSnapshot {
  return {
    rescueId: plan.rescueId,
    outcome: plan.state,
    urgency: plan.urgency,
    style: plan.style,
    visibleChannel: plan.visibleChannel,
    helperPosture: plan.helperPosture,
    activeWindowId: activeWindowId ?? null,
    activeOfferId: plan.selectedOffer.offerId,
    publicRisk01: plan.trigger.publicRisk01,
    recoverability01: plan.trigger.recoverability01,
    playerTilt01: deriveRescueTilt01(affect),
    embarrassment01: toScore01(Number(affect.socialEmbarrassment) / 100),
    frustration01: toScore01(Number(affect.frustration) / 100),
    trustOpportunity01: toScore01(Number(affect.trust) / 100),
    updatedAt,
  };
}

export function deriveRescueDigest(
  entries: readonly ChatRescueLedgerEntry[],
  updatedAt: UnixMs,
): ChatRescueDigest {
  const activeRescueIds: ChatRescueId[] = [];
  const criticalRescueIds: ChatRescueId[] = [];
  const shadowRescueIds: ChatRescueId[] = [];
  const acceptedRescueIds: ChatRescueId[] = [];
  let strongestOutcome: ChatRescueOutcome | undefined;
  let strongestUrgency: ChatRescueUrgencyBand | undefined;

  for (const entry of entries) {
    if (entry.outcome === 'PENDING' || entry.outcome === 'OFFERED' || entry.outcome === 'ESCALATED') {
      activeRescueIds.push(entry.rescueId);
    }
    if (entry.urgency === 'CRITICAL') {
      criticalRescueIds.push(entry.rescueId);
    }
    if (entry.outcome === 'ACCEPTED') {
      acceptedRescueIds.push(entry.rescueId);
    }
    if (entry.style === 'QUIET') {
      shadowRescueIds.push(entry.rescueId);
    }
    if (!strongestUrgency || compareRescueUrgency(entry.urgency, strongestUrgency) > 0) {
      strongestUrgency = entry.urgency;
    }
    if (!strongestOutcome) {
      strongestOutcome = entry.outcome;
    }
  }

  return {
    digestId: (`rescue-digest:${Number(updatedAt)}`) as ChatRescueDigestId,
    updatedAt,
    activeRescueIds,
    criticalRescueIds,
    shadowRescueIds,
    acceptedRescueIds,
    strongestOutcome,
    strongestUrgency,
  };
}
export const CHAT_RESCUE_CONTRACT = Object.freeze({
  version: CHAT_RESCUE_CONTRACT_VERSION,
  revision: CHAT_RESCUE_CONTRACT_REVISION,
  publicApiVersion: CHAT_RESCUE_PUBLIC_API_VERSION,
  authorities: CHAT_RESCUE_AUTHORITIES,
  kinds: CHAT_RESCUE_KINDS,
  triggerKinds: CHAT_RESCUE_TRIGGER_KINDS,
  urgencyBands: CHAT_RESCUE_URGENCY_BANDS,
  styles: CHAT_RESCUE_STYLES,
  surfaces: CHAT_RESCUE_SURFACES,
  privacyClasses: CHAT_RESCUE_PRIVACY_CLASSES,
  outcomes: CHAT_RESCUE_OUTCOMES,
  actionKinds: CHAT_RESCUE_ACTION_KINDS,
  reasonCodes: CHAT_RESCUE_REASON_CODES,
  suppressionReasons: CHAT_RESCUE_SUPPRESSION_REASONS,
  helperPostures: CHAT_RESCUE_HELPER_POSTURES,
  channelStrategies: CHAT_RESCUE_CHANNEL_STRATEGIES,
} as const);
export const CHAT_RESCUE_CONTRACT_DESCRIPTOR = CHAT_RESCUE_CONTRACT;
