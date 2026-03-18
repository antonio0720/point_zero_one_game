/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT SCENE CONTRACTS
 * FILE: shared/contracts/chat/ChatScene.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Chat scenes turn one or more confirmed moments into authored, adaptive,
 * interruptible sequences of chat beats.
 *
 * The scene contract is where:
 * - system notices,
 * - rival intrusions,
 * - crowd reactions,
 * - helper timing,
 * - silence,
 * - delayed reveals,
 * - continuity carryover,
 * - prestige presentation,
 * become one canonical orchestration object.
 *
 * A scene is not a transcript dump.
 * It is a plan plus runtime state plus archive shape.
 *
 * Design laws
 * -----------
 * 1. Scenes preserve visible and shadow behavior together.
 * 2. Scenes are deterministic enough for replay and proof, but expressive
 *    enough for adaptive runtime timing.
 * 3. Silence is explicit.
 * 4. Interruption is explicit.
 * 5. Reveal scheduling is explicit.
 * 6. Scene plans are shared-language objects: frontend mirrors them, backend
 *    authoritatively confirms them, server can fan them out, UI can render them.
 * 7. Scenes can be archived without losing why they mattered.
 * ============================================================================
 */

import type {
  ChatChannelId,
  ChatDeliveryPriority,
  ChatDensity,
  ChatInterventionId,
  ChatLegendId,
  ChatMemoryAnchorId,
  ChatMessageId,
  ChatMomentId,
  ChatNpcId,
  ChatProofHash,
  ChatRelationshipId,
  ChatReplayId,
  ChatRequestId,
  ChatRoomId,
  ChatSceneId,
  ChatSessionId,
  ChatShadowChannel,
  ChatStageMood,
  ChatUiTreatment,
  ChatUserId,
  JsonObject,
  Score01,
  Score100,
  TickNumber,
  UnixMs,
} from './ChatChannels';

import type {
  ChatAffectSnapshot,
  ChatAudienceHeat,
  ChatReputationState,
  ChatRescueDecision,
} from './ChatEvents';

import type {
  ChatMoment,
  ChatMomentAffectDirection,
  ChatMomentCompactRef,
  ChatMomentKind,
  ChatMomentSeverity,
  ChatMomentWitnessClass,
} from './ChatMoment';

// ============================================================================
// MARK: Contract versioning
// ============================================================================

export const CHAT_SCENE_CONTRACT_VERSION = '2026-03-18.1' as const;
export const CHAT_SCENE_CONTRACT_REVISION = 1 as const;
export const CHAT_SCENE_PUBLIC_API_VERSION = 'v1' as const;

// ============================================================================
// MARK: Core enums and discriminants
// ============================================================================

export const CHAT_SCENE_KINDS = [
  'INSTANT_REACTION',
  'MICRO_DRAMA',
  'SWARM_EVENT',
  'RESCUE_SEQUENCE',
  'NEGOTIATION_SEQUENCE',
  'CEREMONY',
  'CALLBACK_PAYOFF',
  'POST_RUN_RITUAL',
] as const;

export type ChatSceneKind = (typeof CHAT_SCENE_KINDS)[number];

export const CHAT_SCENE_STAGES = [
  'PLANNED',
  'QUEUED',
  'ACTIVE',
  'PAUSED',
  'REVEAL_PENDING',
  'COMPLETED',
  'ARCHIVED',
  'CANCELLED',
] as const;

export type ChatSceneStage = (typeof CHAT_SCENE_STAGES)[number];

export const CHAT_SCENE_BEAT_KINDS = [
  'SYSTEM_NOTICE',
  'NPC_LINE',
  'PLAYER_ECHO',
  'CROWD_REACTION',
  'HELPER_GUIDANCE',
  'DEAL_ROOM_MOVE',
  'LIVEOPS_BANNER',
  'SILENCE',
  'REVEAL',
  'CALLBACK',
  'REWARD',
] as const;

export type ChatSceneBeatKind = (typeof CHAT_SCENE_BEAT_KINDS)[number];

export const CHAT_SCENE_ACTOR_ROLES = [
  'SYSTEM',
  'RIVAL',
  'HELPER',
  'CROWD',
  'DEAL_MAKER',
  'LIVEOPS',
  'PLAYER_MEMORY',
  'PLAYER_SELF',
] as const;

export type ChatSceneActorRole = (typeof CHAT_SCENE_ACTOR_ROLES)[number];

export const CHAT_SCENE_INTERruption_PRIORITIES = [
  'LOCKED',
  'CRITICAL',
  'HIGH',
  'NORMAL',
  'LOW',
  'BACKGROUND',
] as const;

export type ChatSceneInterruptionPriority =
  (typeof CHAT_SCENE_INTERruption_PRIORITIES)[number];

export const CHAT_SCENE_SILENCE_REASONS = [
  'BUILD_PRESSURE',
  'ALLOW_REALIZATION',
  'DELAY_HELPER',
  'DEAL_ROOM_POSTURE',
  'PRESERVE_WEIGHT',
  'WAIT_FOR_UPSTREAM_CONFIRMATION',
] as const;

export type ChatSceneSilenceReason = (typeof CHAT_SCENE_SILENCE_REASONS)[number];

export const CHAT_SCENE_REVEAL_KINDS = [
  'MESSAGE',
  'PRESENCE',
  'READ_RECEIPT',
  'SHADOW_PROMOTION',
  'LEGEND_CARD',
  'POST_RUN_SUMMARY',
] as const;

export type ChatSceneRevealKind = (typeof CHAT_SCENE_REVEAL_KINDS)[number];

export const CHAT_SCENE_EXIT_REASONS = [
  'COMPLETED',
  'SUPERSEDED',
  'EXPIRED',
  'CANCELLED',
  'INTERRUPTED_BY_CRITICAL_MOMENT',
  'PLAYER_LEFT_SURFACE',
  'MODE_TRANSITION',
] as const;

export type ChatSceneExitReason = (typeof CHAT_SCENE_EXIT_REASONS)[number];

export const CHAT_SCENE_ARCHIVE_CLASSES = [
  'EPHEMERAL',
  'MEMORY',
  'LEGEND',
  'POST_RUN',
] as const;

export type ChatSceneArchiveClass = (typeof CHAT_SCENE_ARCHIVE_CLASSES)[number];

// ============================================================================
// MARK: Supporting subcontracts
// ============================================================================

export interface ChatSceneActorSlot {
  readonly slotId: string;
  readonly actorRole: ChatSceneActorRole;
  readonly npcId?: ChatNpcId;
  readonly userId?: ChatUserId;
  readonly displayName?: string;
  readonly relationshipId?: ChatRelationshipId;
  readonly witnessClass?: ChatMomentWitnessClass;
  readonly weight?: Score100;
  readonly isPrimary: boolean;
}

export interface ChatSceneInterruptionPolicy {
  readonly priority: ChatSceneInterruptionPriority;
  readonly allowSamePriorityCutoff: boolean;
  readonly allowHigherPriorityCutoff: boolean;
  readonly preserveQueuedRevealsOnCutoff: boolean;
  readonly cutoffWindowMs?: number;
}

export interface ChatSilenceDecision {
  readonly silenceId: string;
  readonly reason: ChatSceneSilenceReason;
  readonly stageMood?: ChatStageMood;
  readonly durationMs: number;
  readonly beginsAt: UnixMs;
  readonly endsAt: UnixMs;
  readonly visibleChannel?: ChatChannelId;
  readonly shadowChannel?: ChatShadowChannel;
  readonly blocksFurtherVisibleLines: boolean;
  readonly helperEntrySuppressed: boolean;
  readonly metadata?: JsonObject;
}

export interface ChatRevealSchedule {
  readonly revealId: string;
  readonly revealKind: ChatSceneRevealKind;
  readonly targetBeatId?: string;
  readonly targetMessageId?: ChatMessageId;
  readonly visibleChannel?: ChatChannelId;
  readonly shadowChannel?: ChatShadowChannel;
  readonly revealAt: UnixMs;
  readonly expiresAt?: UnixMs;
  readonly priority: ChatDeliveryPriority;
  readonly requiresAuthoritativeConfirmation: boolean;
  readonly metadata?: JsonObject;
}

export interface ChatSceneLinePresentation {
  readonly uiTreatment?: ChatUiTreatment;
  readonly density?: ChatDensity;
  readonly highlightBadge?: string;
  readonly threatScore?: Score100;
  readonly prestigeGlow?: Score100;
  readonly animationKey?: string;
}

export interface ChatSceneBeatTiming {
  readonly plannedAt: UnixMs;
  readonly earliestAt?: UnixMs;
  readonly latestAt?: UnixMs;
  readonly minDelayAfterPreviousMs?: number;
  readonly maxDelayAfterPreviousMs?: number;
  readonly holdUntilRevealId?: string;
}

export interface ChatSceneBeatSource {
  readonly momentId?: ChatMomentId;
  readonly causeMessageId?: ChatMessageId;
  readonly requestId?: ChatRequestId;
  readonly proofHash?: ChatProofHash;
  readonly replayId?: ChatReplayId;
  readonly interventionId?: ChatInterventionId;
  readonly metadata?: JsonObject;
}

export interface ChatSceneBeat {
  readonly beatId: string;
  readonly kind: ChatSceneBeatKind;
  readonly actorRole: ChatSceneActorRole;
  readonly actorSlotId?: string;
  readonly channelId?: ChatChannelId;
  readonly shadowChannel?: ChatShadowChannel;
  readonly text?: string;
  readonly timing: ChatSceneBeatTiming;
  readonly presentation?: ChatSceneLinePresentation;
  readonly source?: ChatSceneBeatSource;
  readonly interruption: ChatSceneInterruptionPolicy;
  readonly silence?: ChatSilenceDecision;
  readonly reveal?: ChatRevealSchedule;
  readonly hiddenUntilReveal: boolean;
  readonly persistToTranscript: boolean;
  readonly persistToSceneArchive: boolean;
  readonly contributesToProof: boolean;
  readonly contributesToLegend: boolean;
  readonly memoryAnchorIds?: readonly ChatMemoryAnchorId[];
  readonly affectDirection?: ChatMomentAffectDirection;
  readonly metadata?: JsonObject;
}

export interface ChatSceneBeatGroup {
  readonly groupId: string;
  readonly label?: string;
  readonly beats: readonly ChatSceneBeat[];
  readonly parallel: boolean;
  readonly barrierAfterGroup: boolean;
}

export interface ChatSceneAudienceState {
  readonly primaryHeat?: ChatAudienceHeat;
  readonly reputation?: ChatReputationState;
  readonly ambientMood?: ChatStageMood;
  readonly embarrassmentPressure?: Score100;
  readonly hypePressure?: Score100;
  readonly crowdVelocity?: number;
}

export interface ChatSceneAffectState {
  readonly before?: ChatAffectSnapshot;
  readonly targetDirection?: ChatMomentAffectDirection;
  readonly projectedConfidenceShift?: number;
  readonly projectedFrustrationShift?: number;
  readonly projectedReliefShift?: number;
  readonly projectedTrustShift?: number;
}

export interface ChatSceneRescueState {
  readonly rescueDecision?: ChatRescueDecision;
  readonly quietWindowMs?: number;
  readonly shouldOfferFastExit: boolean;
  readonly shouldReduceCrowdHeat: boolean;
  readonly interventionStyle?: 'BLUNT' | 'CALM' | 'DIRECTIVE' | 'QUIET';
}

export interface ChatSceneContinuityHook {
  readonly carryoverAllowed: boolean;
  readonly carryoverSceneId?: ChatSceneId;
  readonly unresolvedActorSlotIds?: readonly string[];
  readonly postSceneMountTransfer?: boolean;
  readonly continuitySummary?: string;
}

export interface ChatSceneLegendHook {
  readonly legendCandidate: boolean;
  readonly legendId?: ChatLegendId;
  readonly archiveClass: ChatSceneArchiveClass;
  readonly prestigeWeight: Score100;
  readonly unlockTags?: readonly string[];
}

export interface ChatScenePlan {
  readonly sceneId: ChatSceneId;
  readonly kind: ChatSceneKind;
  readonly stage: ChatSceneStage;
  readonly roomId?: ChatRoomId;
  readonly sessionId?: ChatSessionId;
  readonly playerId?: ChatUserId;
  readonly primaryMomentId: ChatMomentId;
  readonly contributingMomentIds: readonly ChatMomentId[];
  readonly primaryMomentKind: ChatMomentKind;
  readonly severity: ChatMomentSeverity;
  readonly title?: string;
  readonly summary: string;
  readonly actors: readonly ChatSceneActorSlot[];
  readonly beatGroups: readonly ChatSceneBeatGroup[];
  readonly audienceState?: ChatSceneAudienceState;
  readonly affectState?: ChatSceneAffectState;
  readonly rescueState?: ChatSceneRescueState;
  readonly continuity?: ChatSceneContinuityHook;
  readonly legend?: ChatSceneLegendHook;
  readonly entersAt: UnixMs;
  readonly expiresAt?: UnixMs;
  readonly completesBy?: UnixMs;
  readonly activeVisibleChannels: readonly ChatChannelId[];
  readonly activeShadowChannels: readonly ChatShadowChannel[];
  readonly metadata?: JsonObject;
}

export interface ChatSceneRuntimeState {
  readonly currentGroupIndex: number;
  readonly revealedBeatIds: readonly string[];
  readonly suppressedBeatIds: readonly string[];
  readonly deliveredMessageIds: readonly ChatMessageId[];
  readonly activeSilence?: ChatSilenceDecision;
  readonly pendingReveals: readonly ChatRevealSchedule[];
  readonly pausedAt?: UnixMs;
  readonly completedAt?: UnixMs;
  readonly exitReason?: ChatSceneExitReason;
}

export interface ChatSceneArchiveRecord {
  readonly archiveId: string;
  readonly scene: ChatScenePlan;
  readonly runtime: ChatSceneRuntimeState;
  readonly compactMoments: readonly ChatMomentCompactRef[];
  readonly archivedAt: UnixMs;
  readonly transcriptMessageIds: readonly ChatMessageId[];
  readonly proofHash?: ChatProofHash;
  readonly replayId?: ChatReplayId;
  readonly postRunSummary?: string;
}

export interface ChatSceneSummary {
  readonly sceneId: ChatSceneId;
  readonly kind: ChatSceneKind;
  readonly severity: ChatMomentSeverity;
  readonly startedAt: UnixMs;
  readonly completedAt?: UnixMs;
  readonly archiveClass?: ChatSceneArchiveClass;
  readonly visibleBeatCount: number;
  readonly shadowBeatCount: number;
  readonly revealCount: number;
  readonly silenceBudgetMs: number;
  readonly primaryActorRole?: ChatSceneActorRole;
  readonly primaryMomentKind: ChatMomentKind;
}

// ============================================================================
// MARK: Defaults and ranking tables
// ============================================================================

export const CHAT_SCENE_KIND_BY_MOMENT_KIND: Readonly<Record<ChatMomentKind, ChatSceneKind>> =
  Object.freeze({
    RUN_BOOT: 'INSTANT_REACTION',
    RUN_START: 'INSTANT_REACTION',
    RUN_END: 'POST_RUN_RITUAL',
    MODE_TRANSITION: 'INSTANT_REACTION',
    PRESSURE_SPIKE: 'MICRO_DRAMA',
    PRESSURE_RELIEF: 'INSTANT_REACTION',
    TIME_CRITICAL: 'MICRO_DRAMA',
    TICK_MILESTONE: 'INSTANT_REACTION',
    INCOME_SURGE: 'INSTANT_REACTION',
    INCOME_COLLAPSE: 'MICRO_DRAMA',
    SHIELD_CRACK: 'MICRO_DRAMA',
    SHIELD_BREAK: 'MICRO_DRAMA',
    CASCADE_RISK: 'SWARM_EVENT',
    BANKRUPTCY_WARNING: 'SWARM_EVENT',
    BANKRUPTCY_CONFIRMED: 'POST_RUN_RITUAL',
    COUNTERPLAY_WINDOW: 'MICRO_DRAMA',
    ATTACK_TELEGRAPH: 'MICRO_DRAMA',
    ATTACK_LANDED: 'MICRO_DRAMA',
    ATTACK_DEFLECTED: 'INSTANT_REACTION',
    RIVALRY_ESCALATION: 'MICRO_DRAMA',
    HELPER_INTERVENTION: 'RESCUE_SEQUENCE',
    RESCUE_WINDOW: 'RESCUE_SEQUENCE',
    RESCUE_MISSED: 'RESCUE_SEQUENCE',
    DEAL_ROOM_TENSION: 'NEGOTIATION_SEQUENCE',
    NEGOTIATION_INFLECTION: 'NEGOTIATION_SEQUENCE',
    BLUFF_EXPOSED: 'NEGOTIATION_SEQUENCE',
    CROWD_SWARM: 'SWARM_EVENT',
    PUBLIC_HUMILIATION: 'SWARM_EVENT',
    COMEBACK: 'CEREMONY',
    SOVEREIGNTY_APPROACH: 'MICRO_DRAMA',
    SOVEREIGNTY_SECURED: 'CEREMONY',
    LEGEND_BREAKOUT: 'CEREMONY',
    LIVEOPS_INTRUSION: 'MICRO_DRAMA',
    WORLD_EVENT_PULSE: 'INSTANT_REACTION',
    CALLBACK_RECOGNITION: 'CALLBACK_PAYOFF',
    POST_RUN_VERDICT: 'POST_RUN_RITUAL',
    CUSTOM: 'MICRO_DRAMA',
  });

export const CHAT_SCENE_ARCHIVE_CLASS_BY_KIND: Readonly<
  Record<ChatSceneKind, ChatSceneArchiveClass>
> = Object.freeze({
  INSTANT_REACTION: 'EPHEMERAL',
  MICRO_DRAMA: 'MEMORY',
  SWARM_EVENT: 'MEMORY',
  RESCUE_SEQUENCE: 'MEMORY',
  NEGOTIATION_SEQUENCE: 'MEMORY',
  CEREMONY: 'LEGEND',
  CALLBACK_PAYOFF: 'MEMORY',
  POST_RUN_RITUAL: 'POST_RUN',
});

export const CHAT_SCENE_INTERRUPT_RANK: Readonly<
  Record<ChatSceneInterruptionPriority, number>
> = Object.freeze({
  LOCKED: 5,
  CRITICAL: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
  BACKGROUND: 0,
});

// ============================================================================
// MARK: Runtime-safe helpers
// ============================================================================

function createReadonlySet<TValue extends string>(values: readonly TValue[]): ReadonlySet<string> {
  return new Set<string>(values as readonly string[]);
}

const CHAT_SCENE_KIND_SET = createReadonlySet(CHAT_SCENE_KINDS);
const CHAT_SCENE_STAGE_SET = createReadonlySet(CHAT_SCENE_STAGES);
const CHAT_SCENE_BEAT_KIND_SET = createReadonlySet(CHAT_SCENE_BEAT_KINDS);
const CHAT_SCENE_ACTOR_ROLE_SET = createReadonlySet(CHAT_SCENE_ACTOR_ROLES);
const CHAT_SCENE_INTERRUPT_SET = createReadonlySet(CHAT_SCENE_INTERruption_PRIORITIES);
const CHAT_SCENE_SILENCE_REASON_SET = createReadonlySet(CHAT_SCENE_SILENCE_REASONS);
const CHAT_SCENE_REVEAL_KIND_SET = createReadonlySet(CHAT_SCENE_REVEAL_KINDS);
const CHAT_SCENE_EXIT_REASON_SET = createReadonlySet(CHAT_SCENE_EXIT_REASONS);
const CHAT_SCENE_ARCHIVE_CLASS_SET = createReadonlySet(CHAT_SCENE_ARCHIVE_CLASSES);

export function isChatSceneKind(value: string): value is ChatSceneKind {
  return CHAT_SCENE_KIND_SET.has(value);
}

export function isChatSceneStage(value: string): value is ChatSceneStage {
  return CHAT_SCENE_STAGE_SET.has(value);
}

export function isChatSceneBeatKind(value: string): value is ChatSceneBeatKind {
  return CHAT_SCENE_BEAT_KIND_SET.has(value);
}

export function isChatSceneActorRole(value: string): value is ChatSceneActorRole {
  return CHAT_SCENE_ACTOR_ROLE_SET.has(value);
}

export function isChatSceneInterruptionPriority(
  value: string,
): value is ChatSceneInterruptionPriority {
  return CHAT_SCENE_INTERRUPT_SET.has(value);
}

export function isChatSceneSilenceReason(value: string): value is ChatSceneSilenceReason {
  return CHAT_SCENE_SILENCE_REASON_SET.has(value);
}

export function isChatSceneRevealKind(value: string): value is ChatSceneRevealKind {
  return CHAT_SCENE_REVEAL_KIND_SET.has(value);
}

export function isChatSceneExitReason(value: string): value is ChatSceneExitReason {
  return CHAT_SCENE_EXIT_REASON_SET.has(value);
}

export function isChatSceneArchiveClass(value: string): value is ChatSceneArchiveClass {
  return CHAT_SCENE_ARCHIVE_CLASS_SET.has(value);
}

export function getDefaultSceneKindForMoment(kind: ChatMomentKind): ChatSceneKind {
  return CHAT_SCENE_KIND_BY_MOMENT_KIND[kind];
}

export function getDefaultArchiveClassForSceneKind(
  kind: ChatSceneKind,
): ChatSceneArchiveClass {
  return CHAT_SCENE_ARCHIVE_CLASS_BY_KIND[kind];
}

export function compareSceneInterruptionPriority(
  left: ChatSceneInterruptionPriority,
  right: ChatSceneInterruptionPriority,
): number {
  return CHAT_SCENE_INTERRUPT_RANK[left] - CHAT_SCENE_INTERRUPT_RANK[right];
}

export function countSceneVisibleBeats(scene: Pick<ChatScenePlan, 'beatGroups'>): number {
  let count = 0;
  for (const group of scene.beatGroups) {
    for (const beat of group.beats) {
      if (beat.channelId && !beat.hiddenUntilReveal && beat.kind !== 'SILENCE') {
        count += 1;
      }
    }
  }
  return count;
}

export function countSceneShadowBeats(scene: Pick<ChatScenePlan, 'beatGroups'>): number {
  let count = 0;
  for (const group of scene.beatGroups) {
    for (const beat of group.beats) {
      if (beat.shadowChannel) {
        count += 1;
      }
    }
  }
  return count;
}

export function countSceneReveals(scene: Pick<ChatScenePlan, 'beatGroups'>): number {
  let count = 0;
  for (const group of scene.beatGroups) {
    for (const beat of group.beats) {
      if (beat.reveal) {
        count += 1;
      }
    }
  }
  return count;
}

export function getSceneSilenceBudgetMs(scene: Pick<ChatScenePlan, 'beatGroups'>): number {
  let total = 0;
  for (const group of scene.beatGroups) {
    for (const beat of group.beats) {
      if (beat.silence) {
        total += beat.silence.durationMs;
      }
    }
  }
  return total;
}

export function getScenePrimaryActorRole(
  scene: Pick<ChatScenePlan, 'actors'>,
): ChatSceneActorRole | undefined {
  const primary = scene.actors.find((actor) => actor.isPrimary);
  return primary?.actorRole;
}

export function sceneContainsKind(
  scene: Pick<ChatScenePlan, 'kind'>,
  kind: ChatSceneKind,
): boolean {
  return scene.kind === kind;
}

export function deriveChatSceneSummary(
  scene: ChatScenePlan,
  runtime: Pick<ChatSceneRuntimeState, 'completedAt'>,
): ChatSceneSummary {
  return {
    sceneId: scene.sceneId,
    kind: scene.kind,
    severity: scene.severity,
    startedAt: scene.entersAt,
    completedAt: runtime.completedAt,
    archiveClass: scene.legend?.archiveClass,
    visibleBeatCount: countSceneVisibleBeats(scene),
    shadowBeatCount: countSceneShadowBeats(scene),
    revealCount: countSceneReveals(scene),
    silenceBudgetMs: getSceneSilenceBudgetMs(scene),
    primaryActorRole: getScenePrimaryActorRole(scene),
    primaryMomentKind: scene.primaryMomentKind,
  };
}

// ============================================================================
// MARK: Contract descriptor
// ============================================================================

export const CHAT_SCENE_CONTRACT = Object.freeze({
  version: CHAT_SCENE_CONTRACT_VERSION,
  revision: CHAT_SCENE_CONTRACT_REVISION,
  publicApiVersion: CHAT_SCENE_PUBLIC_API_VERSION,
  kinds: CHAT_SCENE_KINDS,
  stages: CHAT_SCENE_STAGES,
  beatKinds: CHAT_SCENE_BEAT_KINDS,
  actorRoles: CHAT_SCENE_ACTOR_ROLES,
  interruptionPriorities: CHAT_SCENE_INTERruption_PRIORITIES,
  silenceReasons: CHAT_SCENE_SILENCE_REASONS,
  revealKinds: CHAT_SCENE_REVEAL_KINDS,
  exitReasons: CHAT_SCENE_EXIT_REASONS,
  archiveClasses: CHAT_SCENE_ARCHIVE_CLASSES,
} as const);
