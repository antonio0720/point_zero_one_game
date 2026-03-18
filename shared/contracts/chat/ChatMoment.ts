/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT MOMENT CONTRACTS
 * FILE: shared/contracts/chat/ChatMoment.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Chat moments are the durable, authority-safe units of dramatic significance
 * that sit between raw upstream events and authored chat scenes.
 *
 * A moment is not "just an event."
 * It is the runtime declaration that something in the run now deserves
 * witnesses, tone, timing, memory, escalation, silence, rescue, pressure,
 * or legend treatment.
 *
 * Why this file exists
 * --------------------
 * Your repo already has:
 * - strong channel contracts,
 * - a wide event grammar,
 * - multiple chat engines,
 * - scene archive / relationship / proof / rescue lanes,
 * - many mount surfaces that must feel like one living system.
 *
 * This file creates a single canonical dramatic contract that all of those
 * lanes can share without flattening repo-specific logic into generic chat DTOs.
 *
 * Design laws
 * -----------
 * 1. Moments are semantic, not transport-specific.
 * 2. Moments survive frontend/backend/server boundaries.
 * 3. Moments preserve visible vs shadow intent.
 * 4. Moments can be scored, archived, replayed, and embedded.
 * 5. Moments can trigger scenes, but moments are not scenes.
 * 6. The backend may authoritatively mint or confirm moments, but frontend
 *    lanes may stage candidates optimistically.
 * 7. Every field exists to serve real orchestration, continuity, ML/DL
 *    retrieval, proof, rescue, negotiation, or prestige logic.
 * ============================================================================
 */

import type {
  ChatChannelAudienceProfile,
  ChatChannelId,
  ChatDeliveryPriority,
  ChatInterventionId,
  ChatLegendId,
  ChatMemoryAnchorId,
  ChatMessageId,
  ChatModeScopeId,
  ChatMomentId,
  ChatMountKey,
  ChatNpcId,
  ChatOfferId,
  ChatProofHash,
  ChatRelationshipId,
  ChatReplayId,
  ChatRequestId,
  ChatRoomId,
  ChatRouteKey,
  ChatSceneId,
  ChatSessionId,
  ChatShadowChannel,
  ChatStageMood,
  ChatUiTreatment,
  ChatUserId,
  ChatVisibleChannel,
  ChatWorldEventId,
  JsonObject,
  Score01,
  Score100,
  TickNumber,
  UnixMs,
} from './ChatChannels';

import type {
  ChatAffectSnapshot,
  ChatAudienceHeat,
  ChatContinuityState,
  ChatLearningProfile,
  ChatReputationState,
  ChatRescueDecision,
} from './ChatEvents';

// ============================================================================
// MARK: Contract versioning
// ============================================================================

export const CHAT_MOMENT_CONTRACT_VERSION = '2026-03-18.1' as const;
export const CHAT_MOMENT_CONTRACT_REVISION = 1 as const;
export const CHAT_MOMENT_PUBLIC_API_VERSION = 'v1' as const;

// ============================================================================
// MARK: Core enums and discriminants
// ============================================================================

export const CHAT_MOMENT_KINDS = [
  'RUN_BOOT',
  'RUN_START',
  'RUN_END',
  'MODE_TRANSITION',
  'PRESSURE_SPIKE',
  'PRESSURE_RELIEF',
  'TIME_CRITICAL',
  'TICK_MILESTONE',
  'INCOME_SURGE',
  'INCOME_COLLAPSE',
  'SHIELD_CRACK',
  'SHIELD_BREAK',
  'CASCADE_RISK',
  'BANKRUPTCY_WARNING',
  'BANKRUPTCY_CONFIRMED',
  'COUNTERPLAY_WINDOW',
  'ATTACK_TELEGRAPH',
  'ATTACK_LANDED',
  'ATTACK_DEFLECTED',
  'RIVALRY_ESCALATION',
  'HELPER_INTERVENTION',
  'RESCUE_WINDOW',
  'RESCUE_MISSED',
  'DEAL_ROOM_TENSION',
  'NEGOTIATION_INFLECTION',
  'BLUFF_EXPOSED',
  'CROWD_SWARM',
  'PUBLIC_HUMILIATION',
  'COMEBACK',
  'SOVEREIGNTY_APPROACH',
  'SOVEREIGNTY_SECURED',
  'LEGEND_BREAKOUT',
  'LIVEOPS_INTRUSION',
  'WORLD_EVENT_PULSE',
  'CALLBACK_RECOGNITION',
  'POST_RUN_VERDICT',
  'CUSTOM',
] as const;

export type ChatMomentKind = (typeof CHAT_MOMENT_KINDS)[number];

export const CHAT_MOMENT_CATEGORIES = [
  'RUNTIME',
  'ECONOMY',
  'COMBAT',
  'PRESSURE',
  'RESCUE',
  'NEGOTIATION',
  'SOCIAL',
  'PRESTIGE',
  'LIVEOPS',
  'MEMORY',
  'POST_RUN',
] as const;

export type ChatMomentCategory = (typeof CHAT_MOMENT_CATEGORIES)[number];

export const CHAT_MOMENT_SEVERITIES = [
  'TRACE',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
  'MYTHIC',
] as const;

export type ChatMomentSeverity = (typeof CHAT_MOMENT_SEVERITIES)[number];

export const CHAT_MOMENT_STAGES = [
  'CANDIDATE',
  'STAGED',
  'CONFIRMED',
  'SCENE_PLANNED',
  'SCENE_ACTIVE',
  'ARCHIVED',
  'SUPPRESSED',
  'CANCELLED',
] as const;

export type ChatMomentStage = (typeof CHAT_MOMENT_STAGES)[number];

export const CHAT_MOMENT_TEMPORALITIES = [
  'INSTANT',
  'UNFOLDING',
  'DELAYED',
  'CALLBACK',
  'POST_RUN',
] as const;

export type ChatMomentTemporality = (typeof CHAT_MOMENT_TEMPORALITIES)[number];

export const CHAT_MOMENT_PRIVACY_CLASSES = [
  'VISIBLE_ONLY',
  'SHADOW_ONLY',
  'HYBRID',
] as const;

export type ChatMomentPrivacyClass = (typeof CHAT_MOMENT_PRIVACY_CLASSES)[number];

export const CHAT_MOMENT_WITNESS_CLASSES = [
  'SYSTEM',
  'RIVAL',
  'HELPER',
  'CROWD',
  'SYNDICATE',
  'DEAL_ROOM',
  'LIVEOPS',
  'SELF_REFLECTION',
] as const;

export type ChatMomentWitnessClass = (typeof CHAT_MOMENT_WITNESS_CLASSES)[number];

export const CHAT_MOMENT_SCENE_INTENTS = [
  'NONE',
  'SINGLE_HIT',
  'MICRO_SCENE',
  'SWARM',
  'RESCUE',
  'NEGOTIATION',
  'CEREMONY',
  'POST_RUN',
] as const;

export type ChatMomentSceneIntent = (typeof CHAT_MOMENT_SCENE_INTENTS)[number];

export const CHAT_MOMENT_AFFECT_DIRECTIONS = [
  'INTIMIDATE',
  'RELIEVE',
  'HYPE',
  'SHAME',
  'STABILIZE',
  'DOMINATE',
  'TEMPT',
  'WARN',
] as const;

export type ChatMomentAffectDirection = (typeof CHAT_MOMENT_AFFECT_DIRECTIONS)[number];

export const CHAT_MOMENT_MEMORY_POLICIES = [
  'IGNORE',
  'EPHEMERAL',
  'ANCHOR',
  'QUOTE_CANDIDATE',
  'LEGEND_CANDIDATE',
  'POST_RUN_REQUIRED',
] as const;

export type ChatMomentMemoryPolicy = (typeof CHAT_MOMENT_MEMORY_POLICIES)[number];

export const CHAT_MOMENT_TRIGGER_AUTHORITIES = [
  'UPSTREAM_GAME_EVENT',
  'CHAT_RUNTIME',
  'PLAYER_ACTION',
  'BACKEND_LEDGER',
  'LIVEOPS',
  'ML',
  'DL_RETRIEVAL',
  'MODERATOR',
] as const;

export type ChatMomentTriggerAuthority =
  (typeof CHAT_MOMENT_TRIGGER_AUTHORITIES)[number];

// ============================================================================
// MARK: Supporting subcontracts
// ============================================================================

export interface ChatMomentCauseRef {
  readonly eventType?: string;
  readonly upstreamSignalType?: string;
  readonly messageId?: ChatMessageId;
  readonly requestId?: ChatRequestId;
  readonly replayId?: ChatReplayId;
  readonly proofHash?: ChatProofHash;
  readonly worldEventId?: ChatWorldEventId;
  readonly relationshipId?: ChatRelationshipId;
  readonly interventionId?: ChatInterventionId;
  readonly offerId?: ChatOfferId;
  readonly sceneId?: ChatSceneId;
  readonly metadata?: JsonObject;
}

export interface ChatMomentTickWindow {
  readonly openedAtTick?: TickNumber;
  readonly peakTick?: TickNumber;
  readonly closesAtTick?: TickNumber;
  readonly tickBudget?: number;
  readonly urgencyRatio?: Score01;
}

export interface ChatMomentTimeWindow {
  readonly detectedAt: UnixMs;
  readonly shouldSurfaceBy?: UnixMs;
  readonly expiresAt?: UnixMs;
  readonly archiveAfter?: UnixMs;
  readonly lingerMs?: number;
}

export interface ChatMomentSpeakerDemand {
  readonly witnessClass: ChatMomentWitnessClass;
  readonly minimumLines: number;
  readonly maximumLines: number;
  readonly allowInterruption: boolean;
  readonly allowSilenceBeforeEntry: boolean;
  readonly preferredVisibleChannels?: readonly ChatVisibleChannel[];
  readonly preferredShadowChannels?: readonly ChatShadowChannel[];
}

export interface ChatMomentTimingPolicy {
  readonly deliveryPriority: ChatDeliveryPriority;
  readonly temporality: ChatMomentTemporality;
  readonly allowImmediateSurface: boolean;
  readonly allowDelayedReveal: boolean;
  readonly minDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly cooldownKey?: string;
  readonly cooldownMs?: number;
  readonly collapseIntoExistingSceneWindowMs?: number;
}

export interface ChatMomentSuppressionPolicy {
  readonly suppressWhenMuted: boolean;
  readonly suppressWhenChannelHidden: boolean;
  readonly suppressWhenRescueActive?: boolean;
  readonly suppressWhenAnotherCriticalMomentActive?: boolean;
  readonly suppressDuplicatesWithinMs?: number;
  readonly replaceWeakerMomentKinds?: readonly ChatMomentKind[];
  readonly overshadowedByKinds?: readonly ChatMomentKind[];
}

export interface ChatMomentMemoryDirective {
  readonly policy: ChatMomentMemoryPolicy;
  readonly salience: Score100;
  readonly quoteCandidate: boolean;
  readonly callbackCandidate: boolean;
  readonly embeddingCandidate: boolean;
  readonly archiveNarrativeSummary?: string;
  readonly anchorIds?: readonly ChatMemoryAnchorId[];
}

export interface ChatMomentLegendDirective {
  readonly legendCandidate: boolean;
  readonly legendId?: ChatLegendId;
  readonly prestigeWeight: Score100;
  readonly rewardable: boolean;
  readonly replayWorthiness: Score100;
  readonly replayClipStartTick?: TickNumber;
  readonly replayClipEndTick?: TickNumber;
}

export interface ChatMomentChannelIntent {
  readonly primaryVisibleChannel?: ChatVisibleChannel;
  readonly additionalVisibleChannels?: readonly ChatVisibleChannel[];
  readonly primaryShadowChannel?: ChatShadowChannel;
  readonly additionalShadowChannels?: readonly ChatShadowChannel[];
  readonly audienceProfile?: ChatChannelAudienceProfile;
  readonly stageMood?: ChatStageMood;
  readonly uiTreatment?: ChatUiTreatment;
}

export interface ChatMomentPressureContext {
  readonly stageMood?: ChatStageMood;
  readonly pressureScore?: Score100;
  readonly timePressureScore?: Score100;
  readonly eliminationRisk?: Score100;
  readonly collapseLikelihood?: Score100;
  readonly comebackPotential?: Score100;
}

export interface ChatMomentAudienceContext {
  readonly heat?: ChatAudienceHeat;
  readonly reputation?: ChatReputationState;
  readonly socialExposure?: Score100;
  readonly humiliationRisk?: Score100;
  readonly hypePotential?: Score100;
  readonly witnessDensity?: number;
}

export interface ChatMomentAffectContext {
  readonly affect?: ChatAffectSnapshot;
  readonly primaryDirection?: ChatMomentAffectDirection;
  readonly targetIntimidationDelta?: number;
  readonly targetConfidenceDelta?: number;
  readonly targetFrustrationDelta?: number;
  readonly targetReliefDelta?: number;
  readonly targetTrustDelta?: number;
  readonly targetEmbarrassmentDelta?: number;
}

export interface ChatMomentRescueContext {
  readonly rescueDecision?: ChatRescueDecision;
  readonly rescueUrgency?: Score100;
  readonly churnRisk?: Score01;
  readonly allowQuietRescue: boolean;
  readonly allowDirectiveRescue: boolean;
}

export interface ChatMomentRelationshipContext {
  readonly relationshipId?: ChatRelationshipId;
  readonly primaryNpcId?: ChatNpcId;
  readonly counterpartUserId?: ChatUserId;
  readonly rivalryIntensity?: Score100;
  readonly trustLevel?: Score100;
  readonly contemptLevel?: Score100;
  readonly rescueDebt?: Score100;
  readonly familiarity?: Score100;
}

export interface ChatMomentContinuityContext {
  readonly continuity?: ChatContinuityState;
  readonly carriedFromSceneId?: ChatSceneId;
  readonly modeScopeId?: ChatModeScopeId;
  readonly mountKey?: ChatMountKey;
  readonly routeKey?: ChatRouteKey;
  readonly requiresCrossModeCarryover: boolean;
}

export interface ChatMomentLearningContext {
  readonly learningProfile?: ChatLearningProfile;
  readonly modelConfidence?: Score100;
  readonly retrievalHitCount?: number;
  readonly retrievedAnchorIds?: readonly ChatMemoryAnchorId[];
  readonly classificationTags?: readonly string[];
}

export interface ChatMomentScoringBreakdown {
  readonly severityWeight: number;
  readonly timingWeight: number;
  readonly audienceWeight: number;
  readonly affectWeight: number;
  readonly rescueWeight: number;
  readonly prestigeWeight: number;
  readonly noveltyWeight: number;
  readonly finalScore: number;
}

export interface ChatMomentWitnessPlan {
  readonly sceneIntent: ChatMomentSceneIntent;
  readonly demands: readonly ChatMomentSpeakerDemand[];
  readonly allowTimedSilence: boolean;
  readonly allowSuppressedShadowPreparation: boolean;
  readonly allowCrowdStacking: boolean;
  readonly maxVisibleLines: number;
  readonly maxShadowLines: number;
}

export interface ChatMomentPayload {
  readonly title?: string;
  readonly summary: string;
  readonly shortLabel?: string;
  readonly metadata?: JsonObject;
  readonly tags?: readonly string[];
}

export interface ChatMoment {
  readonly momentId: ChatMomentId;
  readonly kind: ChatMomentKind;
  readonly category: ChatMomentCategory;
  readonly severity: ChatMomentSeverity;
  readonly stage: ChatMomentStage;
  readonly roomId?: ChatRoomId;
  readonly sessionId?: ChatSessionId;
  readonly playerId?: ChatUserId;
  readonly npcIds?: readonly ChatNpcId[];
  readonly counterpartUserIds?: readonly ChatUserId[];
  readonly privacyClass: ChatMomentPrivacyClass;
  readonly cause: ChatMomentCauseRef;
  readonly tickWindow: ChatMomentTickWindow;
  readonly timeWindow: ChatMomentTimeWindow;
  readonly channelIntent: ChatMomentChannelIntent;
  readonly payload: ChatMomentPayload;
  readonly pressureContext?: ChatMomentPressureContext;
  readonly audienceContext?: ChatMomentAudienceContext;
  readonly affectContext?: ChatMomentAffectContext;
  readonly rescueContext?: ChatMomentRescueContext;
  readonly relationshipContext?: ChatMomentRelationshipContext;
  readonly continuityContext?: ChatMomentContinuityContext;
  readonly learningContext?: ChatMomentLearningContext;
  readonly witnessPlan: ChatMomentWitnessPlan;
  readonly timingPolicy: ChatMomentTimingPolicy;
  readonly suppressionPolicy?: ChatMomentSuppressionPolicy;
  readonly memoryDirective: ChatMomentMemoryDirective;
  readonly legendDirective?: ChatMomentLegendDirective;
  readonly scoring?: ChatMomentScoringBreakdown;
  readonly confirmedBy?: ChatMomentTriggerAuthority;
  readonly confirmedAt?: UnixMs;
  readonly archivedAt?: UnixMs;
}

export interface ChatMomentCandidate {
  readonly kind: ChatMomentKind;
  readonly cause: ChatMomentCauseRef;
  readonly roomId?: ChatRoomId;
  readonly sessionId?: ChatSessionId;
  readonly playerId?: ChatUserId;
  readonly channelIntent?: Partial<ChatMomentChannelIntent>;
  readonly payload?: Partial<ChatMomentPayload>;
  readonly tickWindow?: Partial<ChatMomentTickWindow>;
  readonly timeWindow?: Partial<ChatMomentTimeWindow>;
  readonly pressureContext?: Partial<ChatMomentPressureContext>;
  readonly audienceContext?: Partial<ChatMomentAudienceContext>;
  readonly affectContext?: Partial<ChatMomentAffectContext>;
  readonly rescueContext?: Partial<ChatMomentRescueContext>;
  readonly relationshipContext?: Partial<ChatMomentRelationshipContext>;
  readonly continuityContext?: Partial<ChatMomentContinuityContext>;
  readonly learningContext?: Partial<ChatMomentLearningContext>;
  readonly triggerAuthority?: ChatMomentTriggerAuthority;
  readonly initialScoreHint?: number;
  readonly metadata?: JsonObject;
}

export interface ChatMomentLedgerRecord {
  readonly recordId: string;
  readonly moment: ChatMoment;
  readonly emittedAt: UnixMs;
  readonly sourceAuthority: ChatMomentTriggerAuthority;
  readonly authoritative: boolean;
  readonly sceneId?: ChatSceneId;
  readonly supersededByMomentId?: ChatMomentId;
  readonly suppressedByMomentId?: ChatMomentId;
  readonly proofHash?: ChatProofHash;
}

export interface ChatMomentCompactRef {
  readonly momentId: ChatMomentId;
  readonly kind: ChatMomentKind;
  readonly severity: ChatMomentSeverity;
  readonly stage: ChatMomentStage;
  readonly detectedAt: UnixMs;
  readonly sceneId?: ChatSceneId;
  readonly visibleChannel?: ChatVisibleChannel;
}

export interface ChatMomentDigest {
  readonly strongestMoment?: ChatMomentCompactRef;
  readonly activeMomentIds: readonly ChatMomentId[];
  readonly criticalMomentIds: readonly ChatMomentId[];
  readonly rescueMomentIds: readonly ChatMomentId[];
  readonly crowdMomentIds: readonly ChatMomentId[];
  readonly updatedAt: UnixMs;
}

// ============================================================================
// MARK: Defaults and ranking tables
// ============================================================================

export const CHAT_MOMENT_DEFAULT_CATEGORY_BY_KIND: Readonly<
  Record<ChatMomentKind, ChatMomentCategory>
> = Object.freeze({
  RUN_BOOT: 'RUNTIME',
  RUN_START: 'RUNTIME',
  RUN_END: 'POST_RUN',
  MODE_TRANSITION: 'RUNTIME',
  PRESSURE_SPIKE: 'PRESSURE',
  PRESSURE_RELIEF: 'PRESSURE',
  TIME_CRITICAL: 'PRESSURE',
  TICK_MILESTONE: 'RUNTIME',
  INCOME_SURGE: 'ECONOMY',
  INCOME_COLLAPSE: 'ECONOMY',
  SHIELD_CRACK: 'COMBAT',
  SHIELD_BREAK: 'COMBAT',
  CASCADE_RISK: 'COMBAT',
  BANKRUPTCY_WARNING: 'ECONOMY',
  BANKRUPTCY_CONFIRMED: 'POST_RUN',
  COUNTERPLAY_WINDOW: 'COMBAT',
  ATTACK_TELEGRAPH: 'COMBAT',
  ATTACK_LANDED: 'COMBAT',
  ATTACK_DEFLECTED: 'COMBAT',
  RIVALRY_ESCALATION: 'SOCIAL',
  HELPER_INTERVENTION: 'RESCUE',
  RESCUE_WINDOW: 'RESCUE',
  RESCUE_MISSED: 'RESCUE',
  DEAL_ROOM_TENSION: 'NEGOTIATION',
  NEGOTIATION_INFLECTION: 'NEGOTIATION',
  BLUFF_EXPOSED: 'NEGOTIATION',
  CROWD_SWARM: 'SOCIAL',
  PUBLIC_HUMILIATION: 'SOCIAL',
  COMEBACK: 'PRESTIGE',
  SOVEREIGNTY_APPROACH: 'PRESTIGE',
  SOVEREIGNTY_SECURED: 'PRESTIGE',
  LEGEND_BREAKOUT: 'PRESTIGE',
  LIVEOPS_INTRUSION: 'LIVEOPS',
  WORLD_EVENT_PULSE: 'LIVEOPS',
  CALLBACK_RECOGNITION: 'MEMORY',
  POST_RUN_VERDICT: 'POST_RUN',
  CUSTOM: 'RUNTIME',
});

export const CHAT_MOMENT_DEFAULT_SEVERITY_BY_KIND: Readonly<
  Record<ChatMomentKind, ChatMomentSeverity>
> = Object.freeze({
  RUN_BOOT: 'TRACE',
  RUN_START: 'LOW',
  RUN_END: 'MEDIUM',
  MODE_TRANSITION: 'LOW',
  PRESSURE_SPIKE: 'MEDIUM',
  PRESSURE_RELIEF: 'LOW',
  TIME_CRITICAL: 'HIGH',
  TICK_MILESTONE: 'TRACE',
  INCOME_SURGE: 'MEDIUM',
  INCOME_COLLAPSE: 'HIGH',
  SHIELD_CRACK: 'MEDIUM',
  SHIELD_BREAK: 'HIGH',
  CASCADE_RISK: 'CRITICAL',
  BANKRUPTCY_WARNING: 'CRITICAL',
  BANKRUPTCY_CONFIRMED: 'MYTHIC',
  COUNTERPLAY_WINDOW: 'MEDIUM',
  ATTACK_TELEGRAPH: 'HIGH',
  ATTACK_LANDED: 'HIGH',
  ATTACK_DEFLECTED: 'MEDIUM',
  RIVALRY_ESCALATION: 'MEDIUM',
  HELPER_INTERVENTION: 'MEDIUM',
  RESCUE_WINDOW: 'HIGH',
  RESCUE_MISSED: 'CRITICAL',
  DEAL_ROOM_TENSION: 'MEDIUM',
  NEGOTIATION_INFLECTION: 'HIGH',
  BLUFF_EXPOSED: 'HIGH',
  CROWD_SWARM: 'HIGH',
  PUBLIC_HUMILIATION: 'CRITICAL',
  COMEBACK: 'CRITICAL',
  SOVEREIGNTY_APPROACH: 'HIGH',
  SOVEREIGNTY_SECURED: 'MYTHIC',
  LEGEND_BREAKOUT: 'MYTHIC',
  LIVEOPS_INTRUSION: 'HIGH',
  WORLD_EVENT_PULSE: 'MEDIUM',
  CALLBACK_RECOGNITION: 'MEDIUM',
  POST_RUN_VERDICT: 'HIGH',
  CUSTOM: 'MEDIUM',
});

export const CHAT_MOMENT_DEFAULT_SCENE_INTENT_BY_KIND: Readonly<
  Record<ChatMomentKind, ChatMomentSceneIntent>
> = Object.freeze({
  RUN_BOOT: 'NONE',
  RUN_START: 'SINGLE_HIT',
  RUN_END: 'POST_RUN',
  MODE_TRANSITION: 'SINGLE_HIT',
  PRESSURE_SPIKE: 'MICRO_SCENE',
  PRESSURE_RELIEF: 'SINGLE_HIT',
  TIME_CRITICAL: 'MICRO_SCENE',
  TICK_MILESTONE: 'NONE',
  INCOME_SURGE: 'SINGLE_HIT',
  INCOME_COLLAPSE: 'MICRO_SCENE',
  SHIELD_CRACK: 'MICRO_SCENE',
  SHIELD_BREAK: 'MICRO_SCENE',
  CASCADE_RISK: 'SWARM',
  BANKRUPTCY_WARNING: 'SWARM',
  BANKRUPTCY_CONFIRMED: 'POST_RUN',
  COUNTERPLAY_WINDOW: 'MICRO_SCENE',
  ATTACK_TELEGRAPH: 'MICRO_SCENE',
  ATTACK_LANDED: 'MICRO_SCENE',
  ATTACK_DEFLECTED: 'SINGLE_HIT',
  RIVALRY_ESCALATION: 'MICRO_SCENE',
  HELPER_INTERVENTION: 'RESCUE',
  RESCUE_WINDOW: 'RESCUE',
  RESCUE_MISSED: 'RESCUE',
  DEAL_ROOM_TENSION: 'NEGOTIATION',
  NEGOTIATION_INFLECTION: 'NEGOTIATION',
  BLUFF_EXPOSED: 'NEGOTIATION',
  CROWD_SWARM: 'SWARM',
  PUBLIC_HUMILIATION: 'SWARM',
  COMEBACK: 'CEREMONY',
  SOVEREIGNTY_APPROACH: 'MICRO_SCENE',
  SOVEREIGNTY_SECURED: 'CEREMONY',
  LEGEND_BREAKOUT: 'CEREMONY',
  LIVEOPS_INTRUSION: 'MICRO_SCENE',
  WORLD_EVENT_PULSE: 'SINGLE_HIT',
  CALLBACK_RECOGNITION: 'SINGLE_HIT',
  POST_RUN_VERDICT: 'POST_RUN',
  CUSTOM: 'MICRO_SCENE',
});

export const CHAT_MOMENT_MEMORY_POLICY_BY_KIND: Readonly<
  Record<ChatMomentKind, ChatMomentMemoryPolicy>
> = Object.freeze({
  RUN_BOOT: 'IGNORE',
  RUN_START: 'EPHEMERAL',
  RUN_END: 'POST_RUN_REQUIRED',
  MODE_TRANSITION: 'EPHEMERAL',
  PRESSURE_SPIKE: 'ANCHOR',
  PRESSURE_RELIEF: 'EPHEMERAL',
  TIME_CRITICAL: 'ANCHOR',
  TICK_MILESTONE: 'IGNORE',
  INCOME_SURGE: 'ANCHOR',
  INCOME_COLLAPSE: 'ANCHOR',
  SHIELD_CRACK: 'ANCHOR',
  SHIELD_BREAK: 'ANCHOR',
  CASCADE_RISK: 'ANCHOR',
  BANKRUPTCY_WARNING: 'ANCHOR',
  BANKRUPTCY_CONFIRMED: 'LEGEND_CANDIDATE',
  COUNTERPLAY_WINDOW: 'QUOTE_CANDIDATE',
  ATTACK_TELEGRAPH: 'ANCHOR',
  ATTACK_LANDED: 'ANCHOR',
  ATTACK_DEFLECTED: 'QUOTE_CANDIDATE',
  RIVALRY_ESCALATION: 'QUOTE_CANDIDATE',
  HELPER_INTERVENTION: 'ANCHOR',
  RESCUE_WINDOW: 'ANCHOR',
  RESCUE_MISSED: 'ANCHOR',
  DEAL_ROOM_TENSION: 'QUOTE_CANDIDATE',
  NEGOTIATION_INFLECTION: 'QUOTE_CANDIDATE',
  BLUFF_EXPOSED: 'QUOTE_CANDIDATE',
  CROWD_SWARM: 'ANCHOR',
  PUBLIC_HUMILIATION: 'ANCHOR',
  COMEBACK: 'LEGEND_CANDIDATE',
  SOVEREIGNTY_APPROACH: 'ANCHOR',
  SOVEREIGNTY_SECURED: 'LEGEND_CANDIDATE',
  LEGEND_BREAKOUT: 'LEGEND_CANDIDATE',
  LIVEOPS_INTRUSION: 'ANCHOR',
  WORLD_EVENT_PULSE: 'ANCHOR',
  CALLBACK_RECOGNITION: 'ANCHOR',
  POST_RUN_VERDICT: 'POST_RUN_REQUIRED',
  CUSTOM: 'ANCHOR',
});

export const CHAT_MOMENT_SEVERITY_RANK: Readonly<Record<ChatMomentSeverity, number>> =
  Object.freeze({
    TRACE: 0,
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
    MYTHIC: 5,
  });

// ============================================================================
// MARK: Runtime-safe helpers
// ============================================================================

function createReadonlySet<TValue extends string>(values: readonly TValue[]): ReadonlySet<string> {
  return new Set<string>(values as readonly string[]);
}

const CHAT_MOMENT_KIND_SET = createReadonlySet(CHAT_MOMENT_KINDS);
const CHAT_MOMENT_CATEGORY_SET = createReadonlySet(CHAT_MOMENT_CATEGORIES);
const CHAT_MOMENT_SEVERITY_SET = createReadonlySet(CHAT_MOMENT_SEVERITIES);
const CHAT_MOMENT_STAGE_SET = createReadonlySet(CHAT_MOMENT_STAGES);
const CHAT_MOMENT_TEMPORALITY_SET = createReadonlySet(CHAT_MOMENT_TEMPORALITIES);
const CHAT_MOMENT_PRIVACY_CLASS_SET = createReadonlySet(CHAT_MOMENT_PRIVACY_CLASSES);
const CHAT_MOMENT_WITNESS_CLASS_SET = createReadonlySet(CHAT_MOMENT_WITNESS_CLASSES);
const CHAT_MOMENT_SCENE_INTENT_SET = createReadonlySet(CHAT_MOMENT_SCENE_INTENTS);
const CHAT_MOMENT_AFFECT_DIRECTION_SET = createReadonlySet(CHAT_MOMENT_AFFECT_DIRECTIONS);
const CHAT_MOMENT_MEMORY_POLICY_SET = createReadonlySet(CHAT_MOMENT_MEMORY_POLICIES);
const CHAT_MOMENT_TRIGGER_AUTHORITY_SET =
  createReadonlySet(CHAT_MOMENT_TRIGGER_AUTHORITIES);

export function isChatMomentKind(value: string): value is ChatMomentKind {
  return CHAT_MOMENT_KIND_SET.has(value);
}

export function isChatMomentCategory(value: string): value is ChatMomentCategory {
  return CHAT_MOMENT_CATEGORY_SET.has(value);
}

export function isChatMomentSeverity(value: string): value is ChatMomentSeverity {
  return CHAT_MOMENT_SEVERITY_SET.has(value);
}

export function isChatMomentStage(value: string): value is ChatMomentStage {
  return CHAT_MOMENT_STAGE_SET.has(value);
}

export function isChatMomentTemporality(value: string): value is ChatMomentTemporality {
  return CHAT_MOMENT_TEMPORALITY_SET.has(value);
}

export function isChatMomentPrivacyClass(value: string): value is ChatMomentPrivacyClass {
  return CHAT_MOMENT_PRIVACY_CLASS_SET.has(value);
}

export function isChatMomentWitnessClass(value: string): value is ChatMomentWitnessClass {
  return CHAT_MOMENT_WITNESS_CLASS_SET.has(value);
}

export function isChatMomentSceneIntent(value: string): value is ChatMomentSceneIntent {
  return CHAT_MOMENT_SCENE_INTENT_SET.has(value);
}

export function isChatMomentAffectDirection(
  value: string,
): value is ChatMomentAffectDirection {
  return CHAT_MOMENT_AFFECT_DIRECTION_SET.has(value);
}

export function isChatMomentMemoryPolicy(value: string): value is ChatMomentMemoryPolicy {
  return CHAT_MOMENT_MEMORY_POLICY_SET.has(value);
}

export function isChatMomentTriggerAuthority(
  value: string,
): value is ChatMomentTriggerAuthority {
  return CHAT_MOMENT_TRIGGER_AUTHORITY_SET.has(value);
}

export function getDefaultMomentCategory(kind: ChatMomentKind): ChatMomentCategory {
  return CHAT_MOMENT_DEFAULT_CATEGORY_BY_KIND[kind];
}

export function getDefaultMomentSeverity(kind: ChatMomentKind): ChatMomentSeverity {
  return CHAT_MOMENT_DEFAULT_SEVERITY_BY_KIND[kind];
}

export function getDefaultMomentSceneIntent(kind: ChatMomentKind): ChatMomentSceneIntent {
  return CHAT_MOMENT_DEFAULT_SCENE_INTENT_BY_KIND[kind];
}

export function getDefaultMomentMemoryPolicy(kind: ChatMomentKind): ChatMomentMemoryPolicy {
  return CHAT_MOMENT_MEMORY_POLICY_BY_KIND[kind];
}

export function compareMomentSeverity(
  left: ChatMomentSeverity,
  right: ChatMomentSeverity,
): number {
  return CHAT_MOMENT_SEVERITY_RANK[left] - CHAT_MOMENT_SEVERITY_RANK[right];
}

export function isMomentMoreSevere(
  candidate: ChatMomentSeverity,
  baseline: ChatMomentSeverity,
): boolean {
  return compareMomentSeverity(candidate, baseline) > 0;
}

export function shouldMomentPreferVisibleSurface(moment: Pick<ChatMoment, 'privacyClass'>): boolean {
  return moment.privacyClass !== 'SHADOW_ONLY';
}

export function shouldMomentPreferShadowSurface(moment: Pick<ChatMoment, 'privacyClass'>): boolean {
  return moment.privacyClass !== 'VISIBLE_ONLY';
}

export function chatMomentToCompactRef(moment: ChatMoment): ChatMomentCompactRef {
  return {
    momentId: moment.momentId,
    kind: moment.kind,
    severity: moment.severity,
    stage: moment.stage,
    detectedAt: moment.timeWindow.detectedAt,
    sceneId: moment.cause.sceneId,
    visibleChannel: moment.channelIntent.primaryVisibleChannel,
  };
}

export function deriveMomentDigest(
  moments: readonly ChatMoment[],
  updatedAt: UnixMs,
): ChatMomentDigest {
  const activeMomentIds: ChatMomentId[] = [];
  const criticalMomentIds: ChatMomentId[] = [];
  const rescueMomentIds: ChatMomentId[] = [];
  const crowdMomentIds: ChatMomentId[] = [];

  let strongestMoment: ChatMomentCompactRef | undefined;

  for (const moment of moments) {
    if (moment.stage !== 'SUPPRESSED' && moment.stage !== 'CANCELLED') {
      activeMomentIds.push(moment.momentId);
    }
    if (moment.severity === 'CRITICAL' || moment.severity === 'MYTHIC') {
      criticalMomentIds.push(moment.momentId);
    }
    if (
      moment.kind === 'HELPER_INTERVENTION' ||
      moment.kind === 'RESCUE_WINDOW' ||
      moment.kind === 'RESCUE_MISSED'
    ) {
      rescueMomentIds.push(moment.momentId);
    }
    if (
      moment.kind === 'CROWD_SWARM' ||
      moment.kind === 'PUBLIC_HUMILIATION' ||
      moment.kind === 'COMEBACK'
    ) {
      crowdMomentIds.push(moment.momentId);
    }

    if (!strongestMoment) {
      strongestMoment = chatMomentToCompactRef(moment);
      continue;
    }

    const strongestSeverity = strongestMoment.severity;
    if (isMomentMoreSevere(moment.severity, strongestSeverity)) {
      strongestMoment = chatMomentToCompactRef(moment);
      continue;
    }

    if (
      moment.severity === strongestSeverity &&
      moment.timeWindow.detectedAt > strongestMoment.detectedAt
    ) {
      strongestMoment = chatMomentToCompactRef(moment);
    }
  }

  return {
    strongestMoment,
    activeMomentIds,
    criticalMomentIds,
    rescueMomentIds,
    crowdMomentIds,
    updatedAt,
  };
}

// ============================================================================
// MARK: Contract descriptor
// ============================================================================

export const CHAT_MOMENT_CONTRACT = Object.freeze({
  version: CHAT_MOMENT_CONTRACT_VERSION,
  revision: CHAT_MOMENT_CONTRACT_REVISION,
  publicApiVersion: CHAT_MOMENT_PUBLIC_API_VERSION,
  kinds: CHAT_MOMENT_KINDS,
  categories: CHAT_MOMENT_CATEGORIES,
  severities: CHAT_MOMENT_SEVERITIES,
  stages: CHAT_MOMENT_STAGES,
  temporalities: CHAT_MOMENT_TEMPORALITIES,
  privacyClasses: CHAT_MOMENT_PRIVACY_CLASSES,
  witnessClasses: CHAT_MOMENT_WITNESS_CLASSES,
  sceneIntents: CHAT_MOMENT_SCENE_INTENTS,
  affectDirections: CHAT_MOMENT_AFFECT_DIRECTIONS,
  memoryPolicies: CHAT_MOMENT_MEMORY_POLICIES,
  triggerAuthorities: CHAT_MOMENT_TRIGGER_AUTHORITIES,
} as const);
