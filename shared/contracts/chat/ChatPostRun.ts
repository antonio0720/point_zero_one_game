/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT POST-RUN CONTRACTS
 * FILE: shared/contracts/chat/ChatPostRun.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared law for post-run ritual chat.
 *
 * After a run ends, the chat system should not simply fall silent or collapse
 * into a generic scoreboard footer. The post-run lane is where the emotional
 * operating system of the run resolves what just happened.
 *
 * This contract explicitly models the surfaces required to:
 * - mourn,
 * - mock,
 * - debrief,
 * - celebrate,
 * - interpret,
 * - foreshadow,
 * - assign blame,
 * - and name the turning point.
 *
 * Why this file exists
 * --------------------
 * Your repo already has event grammar, dramatic moments, scene planning,
 * rescue/recovery, legend/reward surfaces, world-event pressure, and strong
 * channel semantics. What is missing is a shared post-run language that can be
 * used by frontend, backend, and server lanes without flattening the experience
 * into one-line “gg” messages.
 *
 * Design doctrine
 * ---------------
 * 1. Post-run is first-class authored runtime, not an afterthought.
 * 2. Rituals are semantically explicit: grief, ridicule, debrief, ceremony,
 *    blame, foreshadow, and legend callbacks are modeled separately.
 * 3. The turning point must be nameable and archivable.
 * 4. Blame must be structured, not hand-wavy.
 * 5. Public and private closure are different products.
 * 6. Post-run outputs must support replay, proof, memory anchors, and future
 *    callback retrieval.
 * 7. A post-run plan can be staged optimistically on the frontend, but backend
 *    lanes may authoritatively confirm, rank, and archive it.
 * 8. This file owns shared contract law only. It does not prescribe UI widgets,
 *    socket fanout mechanics, or backend storage engines.
 *
 * Canonical authority roots
 * -------------------------
 * - /shared/contracts/chat
 * - /pzo-web/src/engines/chat/postrun
 * - /backend/src/game/engine/chat/postrun
 * - /pzo-server/src/chat
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import {
  CHAT_CONTRACT_AUTHORITIES,
  channelSupportsLegendMoments,
  channelSupportsReplay,
  channelSupportsWorldEvents,
  isChatVisibleChannel,
  type Brand,
  type ChatChannelId,
  type ChatInterventionId,
  type ChatLegendId,
  type ChatMemoryAnchorId,
  type ChatMessageId,
  type ChatModeScopeId,
  type ChatMomentId,
  type ChatMountKey,
  type ChatNpcId,
  type ChatProofHash,
  type ChatRelationshipId,
  type ChatReplayId,
  type ChatRequestId,
  type ChatRoomId,
  type ChatSceneId,
  type ChatSessionId,
  type ChatStageMood,
  type ChatUiTreatment,
  type ChatUserId,
  type ChatVisibleChannel,
  type ChatWorldEventId,
  type JsonObject,
  type JsonValue,
  type Score01,
  type Score100,
  type TickNumber,
  type UnixMs,
} from './ChatChannels';
import type {
  ChatAffectSnapshot,
  ChatAudienceHeat,
  ChatContinuityState,
  ChatLearningProfile,
  ChatPressureTier,
  ChatReputationState,
  ChatRunOutcome,
} from './ChatEvents';
import {
  chatMomentToCompactRef,
  type ChatMoment,
  type ChatMomentCompactRef,
  type ChatMomentKind,
  type ChatMomentSeverity,
} from './ChatMoment';
import type {
  ChatSceneArchiveClass,
  ChatSceneSummary,
} from './ChatScene';

// ============================================================================
// MARK: Versioning and authorities
// ============================================================================

export const CHAT_POST_RUN_CONTRACT_VERSION = '2026-03-20.1' as const;
export const CHAT_POST_RUN_CONTRACT_REVISION = 1 as const;
export const CHAT_POST_RUN_PUBLIC_API_VERSION = 'v1' as const;

export const CHAT_POST_RUN_AUTHORITIES = Object.freeze({
  ...CHAT_CONTRACT_AUTHORITIES,
  sharedContractFile: '/shared/contracts/chat/ChatPostRun.ts',
  frontendPostRunRoot: '/pzo-web/src/engines/chat/postrun',
  backendPostRunRoot: '/backend/src/game/engine/chat/postrun',
  serverPostRunRoot: '/pzo-server/src/chat',
} as const);

// ============================================================================
// MARK: Brand identifiers
// ============================================================================

export type ChatPostRunId = Brand<string, 'ChatPostRunId'>;
export type ChatPostRunBeatId = Brand<string, 'ChatPostRunBeatId'>;
export type ChatPostRunBundleId = Brand<string, 'ChatPostRunBundleId'>;
export type ChatPostRunSummaryId = Brand<string, 'ChatPostRunSummaryId'>;
export type ChatPostRunArchiveId = Brand<string, 'ChatPostRunArchiveId'>;
export type ChatTurningPointId = Brand<string, 'ChatTurningPointId'>;
export type ChatPostRunBlameId = Brand<string, 'ChatPostRunBlameId'>;
export type ChatPostRunForeshadowId = Brand<string, 'ChatPostRunForeshadowId'>;
export type ChatPostRunWitnessId = Brand<string, 'ChatPostRunWitnessId'>;
export type ChatPostRunDirectiveId = Brand<string, 'ChatPostRunDirectiveId'>;
export type ChatPostRunReceiptId = Brand<string, 'ChatPostRunReceiptId'>;
export type ChatPostRunLedgerId = Brand<string, 'ChatPostRunLedgerId'>;
export type ChatPostRunDigestId = Brand<string, 'ChatPostRunDigestId'>;
export type ChatPostRunThreadId = Brand<string, 'ChatPostRunThreadId'>;
export type ChatPostRunCardId = Brand<string, 'ChatPostRunCardId'>;
export type ChatPostRunWindowId = Brand<string, 'ChatPostRunWindowId'>;

// ============================================================================
// MARK: Core discriminants
// ============================================================================

export const CHAT_POST_RUN_KINDS = [
  'MOURNING_RITE',
  'MOCKERY_RITE',
  'DEBRIEF_RITE',
  'CELEBRATION_RITE',
  'VERDICT_RITE',
  'TURNING_POINT_REVEAL',
  'BLAME_ASSIGNMENT',
  'FORESHADOW_RITE',
  'LEGEND_RECAP',
  'RECOVERY_AUTOPSY',
  'WORLD_REACTION',
  'QUIET_EPILOGUE',
  'CUSTOM',
] as const;
export type ChatPostRunKind = (typeof CHAT_POST_RUN_KINDS)[number];

export const CHAT_POST_RUN_STAGES = [
  'CANDIDATE',
  'STAGED',
  'COMPOSED',
  'QUEUED',
  'ACTIVE',
  'SETTLED',
  'ARCHIVED',
  'CANCELLED',
] as const;
export type ChatPostRunStage = (typeof CHAT_POST_RUN_STAGES)[number];

export const CHAT_POST_RUN_CLASSES = [
  'PRIVATE_DEBRIEF',
  'PUBLIC_CEREMONY',
  'SHADOW_AUTOPSY',
  'HYBRID_EPILOGUE',
  'LEGEND_ARCHIVE',
] as const;
export type ChatPostRunClass = (typeof CHAT_POST_RUN_CLASSES)[number];

export const CHAT_POST_RUN_TONES = [
  'SOMBER',
  'CLINICAL',
  'PREDATORY',
  'TRIUMPHANT',
  'REVERENT',
  'HAUNTING',
  'CALM',
  'BITTER',
  'TENDER',
  'FOREBODING',
] as const;
export type ChatPostRunTone = (typeof CHAT_POST_RUN_TONES)[number];

export const CHAT_POST_RUN_BEAT_KINDS = [
  'SYSTEM_VERDICT',
  'WITNESS_LINE',
  'HELPER_EPITAPH',
  'RIVAL_MOCKERY',
  'CROWD_JUDGMENT',
  'DEBRIEF_FACT',
  'TURNING_POINT_CARD',
  'BLAME_CARD',
  'SUMMARY_CARD',
  'LEGEND_NOTICE',
  'REWARD_NOTICE',
  'FORESHADOW_LINE',
  'SILENCE',
  'WORLD_REACTION',
] as const;
export type ChatPostRunBeatKind = (typeof CHAT_POST_RUN_BEAT_KINDS)[number];

export const CHAT_POST_RUN_ACTOR_ROLES = [
  'SYSTEM',
  'HELPER',
  'RIVAL',
  'CROWD',
  'WITNESS',
  'PLAYER_MEMORY',
  'LIVEOPS',
  'NARRATOR',
] as const;
export type ChatPostRunActorRole = (typeof CHAT_POST_RUN_ACTOR_ROLES)[number];

export const CHAT_POST_RUN_WITNESS_STANCES = [
  'MERCY',
  'CONTEMPT',
  'RESPECT',
  'FEAR',
  'AWE',
  'ANALYSIS',
  'OPPORTUNISM',
  'GRIEF',
] as const;
export type ChatPostRunWitnessStance = (typeof CHAT_POST_RUN_WITNESS_STANCES)[number];

export const CHAT_POST_RUN_VISIBILITY_MODES = [
  'PRIVATE',
  'ROOM',
  'CHANNEL',
  'MULTI_CHANNEL',
  'SHADOW_ONLY',
  'LEGEND_ARCHIVE',
] as const;
export type ChatPostRunVisibilityMode = (typeof CHAT_POST_RUN_VISIBILITY_MODES)[number];

export const CHAT_POST_RUN_SUMMARY_CLASSES = [
  'AUTOPSY',
  'EPITAPH',
  'SCORECARD',
  'HIGHLIGHT_REEL',
  'ORACLE',
  'COURT_RECORD',
] as const;
export type ChatPostRunSummaryClass = (typeof CHAT_POST_RUN_SUMMARY_CLASSES)[number];

export const CHAT_TURNING_POINT_KINDS = [
  'SHIELD_BREAK',
  'COUNTERPLAY_MISS',
  'BANKRUPTCY_LOCK',
  'MIRACLE_SAVE',
  'LEGEND_REVERSAL',
  'DEAL_ROOM_FOLD',
  'RESCUE_ACCEPT',
  'RESCUE_MISS',
  'SOVEREIGNTY_SPIKE',
  'WORLD_EVENT_IMPACT',
  'CROWD_SWARM',
  'EMOTIONAL_TILT',
  'CUSTOM',
] as const;
export type ChatTurningPointKind = (typeof CHAT_TURNING_POINT_KINDS)[number];

export const CHAT_POST_RUN_BLAME_KINDS = [
  'PLAYER_GREED',
  'PLAYER_HESITATION',
  'RIVAL_PRESSURE',
  'CROWD_SWARM',
  'DEAL_ROOM_MISREAD',
  'HELPER_IGNORED',
  'WORLD_EVENT_INTERFERENCE',
  'SYSTEMIC_RISK',
  'NO_SINGLE_CAUSE',
  'CUSTOM',
] as const;
export type ChatPostRunBlameKind = (typeof CHAT_POST_RUN_BLAME_KINDS)[number];

export const CHAT_POST_RUN_FORESHADOW_KINDS = [
  'RIVAL_RETURN',
  'HELPER_WITHDRAWAL',
  'WORLD_EVENT_ECHO',
  'CHANNEL_REPUTATION_SHIFT',
  'DEBT_UNPAID',
  'LEGEND_CALLBACK',
  'NEGOTIATION_MARK',
  'SEASON_THREAD',
  'CUSTOM',
] as const;
export type ChatPostRunForeshadowKind = (typeof CHAT_POST_RUN_FORESHADOW_KINDS)[number];

export const CHAT_POST_RUN_DIRECTIVE_KINDS = [
  'PLAY_AGGRESSIVE',
  'PLAY_SMALL',
  'STAY_PRIVATE',
  'TRUST_HELPER',
  'IGNORE_BAIT',
  'PREPARE_COUNTERPLAY',
  'EXIT_DEAL_ROOM_EARLY',
  'WATCH_CROWD_HEAT',
  'PROTECT_SHIELD',
  'HOLD_LEGEND_LINE',
  'TAKE_A_BREATH',
  'CUSTOM',
] as const;
export type ChatPostRunDirectiveKind = (typeof CHAT_POST_RUN_DIRECTIVE_KINDS)[number];

export const CHAT_POST_RUN_CLOSURE_BANDS = [
  'OPEN_WOUND',
  'UNSETTLED',
  'PARTIAL_CLOSURE',
  'CLEAN_CLOSURE',
  'MYTHIC_LOCK',
] as const;
export type ChatPostRunClosureBand = (typeof CHAT_POST_RUN_CLOSURE_BANDS)[number];

export const CHAT_POST_RUN_ARCHIVE_POLICIES = [
  'DISCARDABLE',
  'SESSION_ONLY',
  'MEMORY_ANCHOR',
  'LEGEND_WORTHY',
  'REPLAY_REQUIRED',
] as const;
export type ChatPostRunArchivePolicy = (typeof CHAT_POST_RUN_ARCHIVE_POLICIES)[number];

// ============================================================================
// MARK: Core snapshots and evidence models
// ============================================================================

export interface ChatPostRunEvidenceSnapshot {
  readonly sessionId?: ChatSessionId;
  readonly requestId?: ChatRequestId;
  readonly roomId: ChatRoomId;
  readonly userId?: ChatUserId;
  readonly modeScopeId?: ChatModeScopeId;
  readonly mountKey?: ChatMountKey;
  readonly runOutcome: ChatRunOutcome;
  readonly endedAt: UnixMs;
  readonly finalTick?: TickNumber;
  readonly finalPressureTier?: ChatPressureTier;
  readonly affect: ChatAffectSnapshot;
  readonly reputation: ChatReputationState;
  readonly learningProfile?: ChatLearningProfile;
  readonly continuity: ChatContinuityState;
  readonly audienceHeat: Readonly<Record<ChatVisibleChannel, ChatAudienceHeat>>;
  readonly finalSceneSummary?: ChatSceneSummary;
  readonly replayId?: ChatReplayId;
  readonly proofHash?: ChatProofHash;
  readonly legendId?: ChatLegendId;
  readonly worldEventIds: readonly ChatWorldEventId[];
  readonly relatedMomentIds: readonly ChatMomentId[];
  readonly relatedMessageIds: readonly ChatMessageId[];
  readonly relatedAnchorIds: readonly ChatMemoryAnchorId[];
  readonly tags?: readonly string[];
}

export interface ChatTurningPointCandidate {
  readonly turningPointId: ChatTurningPointId;
  readonly kind: ChatTurningPointKind;
  readonly sourceMomentId?: ChatMomentId;
  readonly sourceSceneId?: ChatSceneId;
  readonly sourceMessageId?: ChatMessageId;
  readonly sourceWorldEventId?: ChatWorldEventId;
  readonly sourceNpcId?: ChatNpcId;
  readonly sourceRelationshipId?: ChatRelationshipId;
  readonly label: string;
  readonly explanation: string;
  readonly momentKind?: ChatMomentKind;
  readonly severity: ChatMomentSeverity;
  readonly visibility: ChatPostRunVisibilityMode;
  readonly shock01: Score01;
  readonly inevitability01: Score01;
  readonly reversal01: Score01;
  readonly memorySalience01: Score01;
  readonly blameWeight01: Score01;
  readonly legendLift01: Score01;
  readonly rescueDebt01: Score01;
  readonly detectedAt: UnixMs;
  readonly tags?: readonly string[];
  readonly payload?: JsonObject;
}

export interface ChatTurningPoint {
  readonly turningPointId: ChatTurningPointId;
  readonly kind: ChatTurningPointKind;
  readonly label: string;
  readonly explanation: string;
  readonly compactMoment?: ChatMomentCompactRef;
  readonly sourceSceneId?: ChatSceneId;
  readonly sourceMessageId?: ChatMessageId;
  readonly sourceWorldEventId?: ChatWorldEventId;
  readonly sourceNpcId?: ChatNpcId;
  readonly sourceRelationshipId?: ChatRelationshipId;
  readonly visibility: ChatPostRunVisibilityMode;
  readonly emphasis01: Score01;
  readonly inevitability01: Score01;
  readonly reversal01: Score01;
  readonly memorySalience01: Score01;
  readonly blameWeight01: Score01;
  readonly legendLift01: Score01;
  readonly rescueDebt01: Score01;
  readonly namedAt: UnixMs;
  readonly tags?: readonly string[];
  readonly payload?: JsonObject;
}

export interface ChatPostRunBlameVector {
  readonly blameId: ChatPostRunBlameId;
  readonly kind: ChatPostRunBlameKind;
  readonly label: string;
  readonly explanation: string;
  readonly confidence01: Score01;
  readonly playerAgency01: Score01;
  readonly rivalPressure01: Score01;
  readonly crowdPressure01: Score01;
  readonly systemicPressure01: Score01;
  readonly helperMiss01: Score01;
  readonly severity: ChatMomentSeverity;
  readonly sourceMomentIds: readonly ChatMomentId[];
  readonly sourceNpcIds: readonly ChatNpcId[];
  readonly sourceWorldEventIds: readonly ChatWorldEventId[];
  readonly tags?: readonly string[];
}

export interface ChatPostRunWitness {
  readonly witnessId: ChatPostRunWitnessId;
  readonly actorRole: ChatPostRunActorRole;
  readonly stance: ChatPostRunWitnessStance;
  readonly npcId?: ChatNpcId;
  readonly relationshipId?: ChatRelationshipId;
  readonly displayName: string;
  readonly line: string;
  readonly intensity01: Score01;
  readonly personal01: Score01;
  readonly timingMs: number;
  readonly visibleChannel?: ChatVisibleChannel | null;
  readonly proofHash?: ChatProofHash;
  readonly tags?: readonly string[];
}

export interface ChatPostRunBeat {
  readonly beatId: ChatPostRunBeatId;
  readonly kind: ChatPostRunBeatKind;
  readonly actorRole: ChatPostRunActorRole;
  readonly actorNpcId?: ChatNpcId;
  readonly tone: ChatPostRunTone;
  readonly line?: string;
  readonly summary?: string;
  readonly visibleChannel?: ChatVisibleChannel | null;
  readonly visibility: ChatPostRunVisibilityMode;
  readonly uiTreatment: ChatUiTreatment;
  readonly stageMood: ChatStageMood;
  readonly delayMs: number;
  readonly durationMs?: number;
  readonly priority: number;
  readonly turningPointId?: ChatTurningPointId;
  readonly blameId?: ChatPostRunBlameId;
  readonly foreshadowId?: ChatPostRunForeshadowId;
  readonly legendId?: ChatLegendId;
  readonly proofHash?: ChatProofHash;
  readonly replayId?: ChatReplayId;
  readonly messageId?: ChatMessageId;
  readonly sourceMomentIds: readonly ChatMomentId[];
  readonly sourceSceneIds: readonly ChatSceneId[];
  readonly tags?: readonly string[];
  readonly payload?: JsonObject;
}

export interface ChatPostRunForeshadow {
  readonly foreshadowId: ChatPostRunForeshadowId;
  readonly kind: ChatPostRunForeshadowKind;
  readonly label: string;
  readonly line: string;
  readonly confidence01: Score01;
  readonly threat01: Score01;
  readonly hope01: Score01;
  readonly tags?: readonly string[];
  readonly nextWorldEventId?: ChatWorldEventId;
  readonly callbackMomentKind?: ChatMomentKind;
  readonly callbackLegendId?: ChatLegendId;
  readonly payload?: JsonObject;
}

export interface ChatPostRunDirective {
  readonly directiveId: ChatPostRunDirectiveId;
  readonly kind: ChatPostRunDirectiveKind;
  readonly label: string;
  readonly explanation: string;
  readonly urgency01: Score01;
  readonly confidence01: Score01;
  readonly sourceTurningPointId?: ChatTurningPointId;
  readonly sourceBlameId?: ChatPostRunBlameId;
  readonly sourceMomentIds: readonly ChatMomentId[];
  readonly tags?: readonly string[];
}

export interface ChatPostRunSummaryCard {
  readonly cardId: ChatPostRunCardId;
  readonly summaryId: ChatPostRunSummaryId;
  readonly summaryClass: ChatPostRunSummaryClass;
  readonly title: string;
  readonly subtitle: string;
  readonly body: string;
  readonly closureBand: ChatPostRunClosureBand;
  readonly archivePolicy: ChatPostRunArchivePolicy;
  readonly dominantTone: ChatPostRunTone;
  readonly archiveClass?: ChatSceneArchiveClass;
  readonly turningPointId?: ChatTurningPointId;
  readonly blameIds: readonly ChatPostRunBlameId[];
  readonly directiveIds: readonly ChatPostRunDirectiveId[];
  readonly foreshadowIds: readonly ChatPostRunForeshadowId[];
  readonly legendId?: ChatLegendId;
  readonly replayId?: ChatReplayId;
  readonly proofHash?: ChatProofHash;
  readonly tags?: readonly string[];
}

export interface ChatPostRunReceipt {
  readonly receiptId: ChatPostRunReceiptId;
  readonly createdAt: UnixMs;
  readonly visibility: ChatPostRunVisibilityMode;
  readonly deliveredChannels: readonly ChatVisibleChannel[];
  readonly beatIds: readonly ChatPostRunBeatId[];
  readonly messageIds: readonly ChatMessageId[];
  readonly replayId?: ChatReplayId;
  readonly proofHash?: ChatProofHash;
  readonly legendId?: ChatLegendId;
}

export interface ChatPostRunWindow {
  readonly windowId: ChatPostRunWindowId;
  readonly opensAt: UnixMs;
  readonly closesAt?: UnixMs;
  readonly ritualMayEscalate: boolean;
  readonly rescueCarryoverOpen: boolean;
  readonly legendLockPending: boolean;
}

export interface ChatPostRunThread {
  readonly threadId: ChatPostRunThreadId;
  readonly channelId?: ChatVisibleChannel;
  readonly witnessIds: readonly ChatPostRunWitnessId[];
  readonly beatIds: readonly ChatPostRunBeatId[];
  readonly closed: boolean;
}

export interface ChatPostRunPlan {
  readonly postRunId: ChatPostRunId;
  readonly bundleId: ChatPostRunBundleId;
  readonly roomId: ChatRoomId;
  readonly sessionId?: ChatSessionId;
  readonly requestId?: ChatRequestId;
  readonly userId?: ChatUserId;
  readonly kind: ChatPostRunKind;
  readonly stage: ChatPostRunStage;
  readonly class: ChatPostRunClass;
  readonly tone: ChatPostRunTone;
  readonly visibility: ChatPostRunVisibilityMode;
  readonly evidence: ChatPostRunEvidenceSnapshot;
  readonly turningPointCandidates: readonly ChatTurningPointCandidate[];
  readonly turningPoint?: ChatTurningPoint;
  readonly blameVectors: readonly ChatPostRunBlameVector[];
  readonly witnesses: readonly ChatPostRunWitness[];
  readonly beats: readonly ChatPostRunBeat[];
  readonly foreshadow: readonly ChatPostRunForeshadow[];
  readonly directives: readonly ChatPostRunDirective[];
  readonly summaryCard: ChatPostRunSummaryCard;
  readonly threads: readonly ChatPostRunThread[];
  readonly window: ChatPostRunWindow;
  readonly legendEscalationEligible: boolean;
  readonly replayRecommended: boolean;
  readonly shouldAnchorMemory: boolean;
  readonly shouldPersistShadowArchive: boolean;
  readonly createdAt: UnixMs;
  readonly authoredAt?: UnixMs;
  readonly settledAt?: UnixMs;
  readonly receipt?: ChatPostRunReceipt;
  readonly tags?: readonly string[];
  readonly payload?: JsonObject;
}

export interface ChatPostRunRuntimeState {
  readonly postRunId: ChatPostRunId;
  readonly stage: ChatPostRunStage;
  readonly activeBeatId?: ChatPostRunBeatId;
  readonly deliveredBeatIds: readonly ChatPostRunBeatId[];
  readonly acknowledgedBeatIds: readonly ChatPostRunBeatId[];
  readonly hiddenBeatIds: readonly ChatPostRunBeatId[];
  readonly deliveredChannels: readonly ChatVisibleChannel[];
  readonly openedAt?: UnixMs;
  readonly completedAt?: UnixMs;
  readonly archivedAt?: UnixMs;
  readonly error?: string;
}

export interface ChatPostRunArchiveEntry {
  readonly archiveId: ChatPostRunArchiveId;
  readonly postRunId: ChatPostRunId;
  readonly roomId: ChatRoomId;
  readonly userId?: ChatUserId;
  readonly outcome: ChatRunOutcome;
  readonly kind: ChatPostRunKind;
  readonly class: ChatPostRunClass;
  readonly tone: ChatPostRunTone;
  readonly closureBand: ChatPostRunClosureBand;
  readonly archivePolicy: ChatPostRunArchivePolicy;
  readonly summaryCard: ChatPostRunSummaryCard;
  readonly turningPoint?: ChatTurningPoint;
  readonly compactMoments: readonly ChatMomentCompactRef[];
  readonly witnessLines: readonly string[];
  readonly blameLabels: readonly string[];
  readonly foreshadowLabels: readonly string[];
  readonly directiveLabels: readonly string[];
  readonly relatedLegendId?: ChatLegendId;
  readonly replayId?: ChatReplayId;
  readonly proofHash?: ChatProofHash;
  readonly memoryAnchorIds: readonly ChatMemoryAnchorId[];
  readonly archivedAt: UnixMs;
  readonly tags?: readonly string[];
}

export interface ChatPostRunDigest {
  readonly digestId: ChatPostRunDigestId;
  readonly postRunId: ChatPostRunId;
  readonly roomId: ChatRoomId;
  readonly outcome: ChatRunOutcome;
  readonly kind: ChatPostRunKind;
  readonly class: ChatPostRunClass;
  readonly tone: ChatPostRunTone;
  readonly closureBand: ChatPostRunClosureBand;
  readonly turningPointLabel?: string;
  readonly primaryBlameLabel?: string;
  readonly primaryDirectiveLabel?: string;
  readonly primaryForeshadowLabel?: string;
  readonly witnessCount: number;
  readonly beatCount: number;
  readonly deliveredChannelCount: number;
  readonly shouldAnchorMemory: boolean;
  readonly replayRecommended: boolean;
  readonly legendEscalationEligible: boolean;
  readonly createdAt: UnixMs;
}

export interface ChatPostRunLedgerEntry {
  readonly ledgerId: ChatPostRunLedgerId;
  readonly postRunId: ChatPostRunId;
  readonly roomId: ChatRoomId;
  readonly sessionId?: ChatSessionId;
  readonly requestId?: ChatRequestId;
  readonly stage: ChatPostRunStage;
  readonly createdAt: UnixMs;
  readonly archivedAt?: UnixMs;
  readonly replayId?: ChatReplayId;
  readonly proofHash?: ChatProofHash;
  readonly memoryAnchorIds: readonly ChatMemoryAnchorId[];
  readonly tags?: readonly string[];
}

// ============================================================================
// MARK: Defaults and ranking tables
// ============================================================================

const TONE_ORDER: Readonly<Record<ChatPostRunTone, number>> = Object.freeze({
  CLINICAL: 0,
  CALM: 1,
  SOMBER: 2,
  TENDER: 3,
  BITTER: 4,
  PREDATORY: 5,
  HAUNTING: 6,
  FOREBODING: 7,
  TRIUMPHANT: 8,
  REVERENT: 9,
});

const STAGE_ORDER: Readonly<Record<ChatPostRunStage, number>> = Object.freeze({
  CANDIDATE: 0,
  STAGED: 1,
  COMPOSED: 2,
  QUEUED: 3,
  ACTIVE: 4,
  SETTLED: 5,
  ARCHIVED: 6,
  CANCELLED: 7,
});

const CLOSURE_BAND_ORDER: Readonly<Record<ChatPostRunClosureBand, number>> = Object.freeze({
  OPEN_WOUND: 0,
  UNSETTLED: 1,
  PARTIAL_CLOSURE: 2,
  CLEAN_CLOSURE: 3,
  MYTHIC_LOCK: 4,
});

const ARCHIVE_POLICY_ORDER: Readonly<Record<ChatPostRunArchivePolicy, number>> = Object.freeze({
  DISCARDABLE: 0,
  SESSION_ONLY: 1,
  MEMORY_ANCHOR: 2,
  LEGEND_WORTHY: 3,
  REPLAY_REQUIRED: 4,
});

const POST_RUN_BEAT_PRIORITY: Readonly<Record<ChatPostRunBeatKind, number>> = Object.freeze({
  SYSTEM_VERDICT: 100,
  TURNING_POINT_CARD: 95,
  BLAME_CARD: 90,
  SUMMARY_CARD: 88,
  LEGEND_NOTICE: 84,
  REWARD_NOTICE: 82,
  FORESHADOW_LINE: 80,
  HELPER_EPITAPH: 72,
  RIVAL_MOCKERY: 68,
  CROWD_JUDGMENT: 64,
  WITNESS_LINE: 60,
  WORLD_REACTION: 58,
  DEBRIEF_FACT: 55,
  SILENCE: 40,
});

const TURNING_POINT_KIND_WEIGHT: Readonly<Record<ChatTurningPointKind, number>> = Object.freeze({
  SHIELD_BREAK: 92,
  COUNTERPLAY_MISS: 86,
  BANKRUPTCY_LOCK: 94,
  MIRACLE_SAVE: 90,
  LEGEND_REVERSAL: 96,
  DEAL_ROOM_FOLD: 80,
  RESCUE_ACCEPT: 74,
  RESCUE_MISS: 78,
  SOVEREIGNTY_SPIKE: 95,
  WORLD_EVENT_IMPACT: 76,
  CROWD_SWARM: 73,
  EMOTIONAL_TILT: 70,
  CUSTOM: 65,
});

const BLAME_KIND_BASELINE: Readonly<Record<ChatPostRunBlameKind, number>> = Object.freeze({
  PLAYER_GREED: 66,
  PLAYER_HESITATION: 64,
  RIVAL_PRESSURE: 58,
  CROWD_SWARM: 54,
  DEAL_ROOM_MISREAD: 62,
  HELPER_IGNORED: 60,
  WORLD_EVENT_INTERFERENCE: 49,
  SYSTEMIC_RISK: 46,
  NO_SINGLE_CAUSE: 35,
  CUSTOM: 40,
});

// ============================================================================
// MARK: Local helpers
// ============================================================================

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const clamp100 = (value: number): number => Math.max(0, Math.min(100, value));

export function toPostRunScore01(value: number): Score01 {
  return clamp01(value) as Score01;
}

export function toPostRunScore100(value: number): Score100 {
  return Math.round(clamp100(value)) as Score100;
}

function uniqueStrings<T extends string>(values?: readonly T[] | null): readonly T[] {
  if (!values || values.length === 0) return [] as const;
  return Array.from(new Set(values));
}

function uniqueVisibleChannels(values?: readonly (ChatVisibleChannel | null | undefined)[] | null): readonly ChatVisibleChannel[] {
  const channels = new Set<ChatVisibleChannel>();
  for (const value of values ?? []) {
    if (value && isChatVisibleChannel(value)) channels.add(value);
  }
  return Array.from(channels);
}

function maxUnixMs(left: UnixMs, right: UnixMs): UnixMs {
  return (Math.max(left as unknown as number, right as unknown as number) as unknown) as UnixMs;
}

function minUnixMs(left: UnixMs, right: UnixMs): UnixMs {
  return (Math.min(left as unknown as number, right as unknown as number) as unknown) as UnixMs;
}

function pickToneWeight(tone: ChatPostRunTone): number {
  return TONE_ORDER[tone];
}

function pickBeatPriority(kind: ChatPostRunBeatKind): number {
  return POST_RUN_BEAT_PRIORITY[kind];
}

// ============================================================================
// MARK: Type guards and comparators
// ============================================================================

export function isChatPostRunTone(value: string): value is ChatPostRunTone {
  return (CHAT_POST_RUN_TONES as readonly string[]).includes(value);
}

export function isChatPostRunKind(value: string): value is ChatPostRunKind {
  return (CHAT_POST_RUN_KINDS as readonly string[]).includes(value);
}

export function isChatPostRunBeatKind(value: string): value is ChatPostRunBeatKind {
  return (CHAT_POST_RUN_BEAT_KINDS as readonly string[]).includes(value);
}

export function comparePostRunTone(left: ChatPostRunTone, right: ChatPostRunTone): number {
  return pickToneWeight(left) - pickToneWeight(right);
}

export function comparePostRunStage(left: ChatPostRunStage, right: ChatPostRunStage): number {
  return STAGE_ORDER[left] - STAGE_ORDER[right];
}

export function compareClosureBand(left: ChatPostRunClosureBand, right: ChatPostRunClosureBand): number {
  return CLOSURE_BAND_ORDER[left] - CLOSURE_BAND_ORDER[right];
}

export function compareArchivePolicy(left: ChatPostRunArchivePolicy, right: ChatPostRunArchivePolicy): number {
  return ARCHIVE_POLICY_ORDER[left] - ARCHIVE_POLICY_ORDER[right];
}

// ============================================================================
// MARK: Derivation helpers
// ============================================================================

export function derivePostRunClass(
  outcome: ChatRunOutcome,
  visibility: ChatPostRunVisibilityMode,
  tone: ChatPostRunTone,
): ChatPostRunClass {
  if (visibility === 'SHADOW_ONLY') return 'SHADOW_AUTOPSY';
  if (visibility === 'LEGEND_ARCHIVE') return 'LEGEND_ARCHIVE';
  if (visibility === 'PRIVATE' || tone === 'CALM' || tone === 'TENDER') return 'PRIVATE_DEBRIEF';
  if (outcome === 'WIN' || outcome === 'SOVEREIGN') return 'PUBLIC_CEREMONY';
  if (visibility === 'MULTI_CHANNEL') return 'HYBRID_EPILOGUE';
  return 'HYBRID_EPILOGUE';
}

export function derivePostRunTone(input: {
  readonly outcome: ChatRunOutcome;
  readonly affect: Pick<ChatAffectSnapshot, 'confidence' | 'frustration' | 'socialEmbarrassment' | 'relief' | 'trust'>;
  readonly reputation: Pick<ChatReputationState, 'publicReputation' | 'privateTrust'>;
}): ChatPostRunTone {
  const confidence = Number(input.affect.confidence);
  const frustration = Number(input.affect.frustration);
  const embarrassment = Number(input.affect.socialEmbarrassment);
  const relief = Number(input.affect.relief);
  const trust = Number(input.affect.trust);
  const publicReputation = Number(input.reputation.publicReputation);

  if (input.outcome === 'SOVEREIGN') return 'REVERENT';
  if (input.outcome === 'WIN' && relief >= 55) return 'TRIUMPHANT';
  if (embarrassment >= 70 && publicReputation <= 40) return 'BITTER';
  if (frustration >= 72 && trust <= 35) return 'HAUNTING';
  if (frustration >= 70) return 'SOMBER';
  if (confidence <= 30 && embarrassment >= 55) return 'CLINICAL';
  if (relief >= 60 && trust >= 55) return 'TENDER';
  if (publicReputation <= 35 && confidence <= 35) return 'FOREBODING';
  return 'CALM';
}

export function derivePostRunVisibility(input: {
  readonly preferredChannel?: ChatVisibleChannel | null;
  readonly outcome: ChatRunOutcome;
  readonly primaryTurningPoint?: ChatTurningPointCandidate | ChatTurningPoint | null;
  readonly dominantHeat?: ChatAudienceHeat | null;
  readonly replayId?: ChatReplayId;
  readonly legendId?: ChatLegendId;
}): ChatPostRunVisibilityMode {
  if (input.legendId) return 'LEGEND_ARCHIVE';
  if (input.primaryTurningPoint && Number(input.primaryTurningPoint.legendLift01) >= 0.80 && input.replayId) {
    return 'LEGEND_ARCHIVE';
  }
  if (input.outcome === 'SOVEREIGN' || input.outcome === 'WIN') {
    if (input.preferredChannel) return 'CHANNEL';
    return 'ROOM';
  }
  if (input.dominantHeat && Number(input.dominantHeat.heatScore) >= 80) {
    return 'CHANNEL';
  }
  return input.preferredChannel ? 'ROOM' : 'PRIVATE';
}

export function derivePostRunClosureBand(input: {
  readonly outcome: ChatRunOutcome;
  readonly affect: Pick<ChatAffectSnapshot, 'frustration' | 'relief' | 'trust' | 'desperation'>;
  readonly turningPoint?: ChatTurningPoint | null;
  readonly foreshadowCount: number;
  readonly directiveCount: number;
}): ChatPostRunClosureBand {
  const frustration = Number(input.affect.frustration);
  const relief = Number(input.affect.relief);
  const trust = Number(input.affect.trust);
  const desperation = Number(input.affect.desperation);
  const turningPointStrength = input.turningPoint ? Number(input.turningPoint.emphasis01) : 0;

  if (input.outcome === 'SOVEREIGN' && turningPointStrength >= 0.80) return 'MYTHIC_LOCK';
  if (relief >= 70 && trust >= 60 && input.foreshadowCount <= 1) return 'CLEAN_CLOSURE';
  if (frustration <= 45 && desperation <= 40 && input.directiveCount >= 1) return 'PARTIAL_CLOSURE';
  if (frustration >= 75 || desperation >= 70) return 'OPEN_WOUND';
  return 'UNSETTLED';
}

export function derivePostRunArchivePolicy(input: {
  readonly closureBand: ChatPostRunClosureBand;
  readonly replayId?: ChatReplayId;
  readonly proofHash?: ChatProofHash;
  readonly legendEligible: boolean;
  readonly shouldAnchorMemory: boolean;
}): ChatPostRunArchivePolicy {
  if (input.legendEligible) return 'LEGEND_WORTHY';
  if (input.replayId && input.proofHash) return 'REPLAY_REQUIRED';
  if (input.shouldAnchorMemory) return 'MEMORY_ANCHOR';
  if (input.closureBand === 'OPEN_WOUND' || input.closureBand === 'UNSETTLED') return 'SESSION_ONLY';
  return 'DISCARDABLE';
}

export function scoreTurningPointCandidate(candidate: ChatTurningPointCandidate): Score100 {
  const base = TURNING_POINT_KIND_WEIGHT[candidate.kind] ?? TURNING_POINT_KIND_WEIGHT.CUSTOM;
  const weighted =
    base * 0.30 +
    Number(candidate.shock01) * 100 * 0.18 +
    Number(candidate.inevitability01) * 100 * 0.16 +
    Number(candidate.reversal01) * 100 * 0.14 +
    Number(candidate.memorySalience01) * 100 * 0.12 +
    Number(candidate.blameWeight01) * 100 * 0.05 +
    Number(candidate.legendLift01) * 100 * 0.05;
  return toPostRunScore100(weighted);
}

export function sortTurningPointCandidates(
  candidates: readonly ChatTurningPointCandidate[],
): readonly ChatTurningPointCandidate[] {
  return [...candidates].sort((left, right) => {
    const delta = Number(scoreTurningPointCandidate(right)) - Number(scoreTurningPointCandidate(left));
    if (delta !== 0) return delta;
    return (right.detectedAt as unknown as number) - (left.detectedAt as unknown as number);
  });
}

export function choosePrimaryTurningPoint(
  candidates: readonly ChatTurningPointCandidate[],
  moments?: readonly ChatMoment[],
): ChatTurningPoint | null {
  const primary = sortTurningPointCandidates(candidates)[0];
  if (!primary) return null;

  const compactMoment = primary.sourceMomentId
    ? moments?.find((moment) => moment.momentId === primary.sourceMomentId)
      ? chatMomentToCompactRef(moments!.find((moment) => moment.momentId === primary.sourceMomentId)!)
      : undefined
    : undefined;

  return {
    turningPointId: primary.turningPointId,
    kind: primary.kind,
    label: primary.label,
    explanation: primary.explanation,
    compactMoment,
    sourceSceneId: primary.sourceSceneId,
    sourceMessageId: primary.sourceMessageId,
    sourceWorldEventId: primary.sourceWorldEventId,
    sourceNpcId: primary.sourceNpcId,
    sourceRelationshipId: primary.sourceRelationshipId,
    visibility: primary.visibility,
    emphasis01: toPostRunScore01(Number(scoreTurningPointCandidate(primary)) / 100),
    inevitability01: primary.inevitability01,
    reversal01: primary.reversal01,
    memorySalience01: primary.memorySalience01,
    blameWeight01: primary.blameWeight01,
    legendLift01: primary.legendLift01,
    rescueDebt01: primary.rescueDebt01,
    namedAt: primary.detectedAt,
    tags: primary.tags,
    payload: primary.payload,
  };
}

export function scoreBlameVector(blame: ChatPostRunBlameVector): Score100 {
  const baseline = BLAME_KIND_BASELINE[blame.kind] ?? BLAME_KIND_BASELINE.CUSTOM;
  const weighted =
    baseline * 0.35 +
    Number(blame.confidence01) * 100 * 0.25 +
    Number(blame.playerAgency01) * 100 * 0.12 +
    Number(blame.rivalPressure01) * 100 * 0.10 +
    Number(blame.crowdPressure01) * 100 * 0.08 +
    Number(blame.systemicPressure01) * 100 * 0.06 +
    Number(blame.helperMiss01) * 100 * 0.04;
  return toPostRunScore100(weighted);
}

export function sortBlameVectors(
  blameVectors: readonly ChatPostRunBlameVector[],
): readonly ChatPostRunBlameVector[] {
  return [...blameVectors].sort(
    (left, right) => Number(scoreBlameVector(right)) - Number(scoreBlameVector(left)),
  );
}

export function choosePrimaryBlameVector(
  blameVectors: readonly ChatPostRunBlameVector[],
): ChatPostRunBlameVector | null {
  return sortBlameVectors(blameVectors)[0] ?? null;
}

export function scoreDirective(directive: ChatPostRunDirective): Score100 {
  const weighted = Number(directive.urgency01) * 100 * 0.55 + Number(directive.confidence01) * 100 * 0.45;
  return toPostRunScore100(weighted);
}

export function sortPostRunDirectives(
  directives: readonly ChatPostRunDirective[],
): readonly ChatPostRunDirective[] {
  return [...directives].sort((left, right) => Number(scoreDirective(right)) - Number(scoreDirective(left)));
}

export function choosePrimaryDirective(
  directives: readonly ChatPostRunDirective[],
): ChatPostRunDirective | null {
  return sortPostRunDirectives(directives)[0] ?? null;
}

export function scoreForeshadow(foreshadow: ChatPostRunForeshadow): Score100 {
  const weighted = Number(foreshadow.confidence01) * 100 * 0.45 + Number(foreshadow.threat01) * 100 * 0.35 + Number(foreshadow.hope01) * 100 * 0.20;
  return toPostRunScore100(weighted);
}

export function sortPostRunForeshadow(
  foreshadow: readonly ChatPostRunForeshadow[],
): readonly ChatPostRunForeshadow[] {
  return [...foreshadow].sort((left, right) => Number(scoreForeshadow(right)) - Number(scoreForeshadow(left)));
}

export function choosePrimaryForeshadow(
  foreshadow: readonly ChatPostRunForeshadow[],
): ChatPostRunForeshadow | null {
  return sortPostRunForeshadow(foreshadow)[0] ?? null;
}

export function sortPostRunBeats(
  beats: readonly ChatPostRunBeat[],
): readonly ChatPostRunBeat[] {
  return [...beats].sort((left, right) => {
    const priorityDelta = (right.priority ?? pickBeatPriority(right.kind)) - (left.priority ?? pickBeatPriority(left.kind));
    if (priorityDelta !== 0) return priorityDelta;
    return left.delayMs - right.delayMs;
  });
}

export function countPostRunBeatsByKind(
  beats: readonly ChatPostRunBeat[],
): Readonly<Record<ChatPostRunBeatKind, number>> {
  const counts: Record<ChatPostRunBeatKind, number> = {
    SYSTEM_VERDICT: 0,
    WITNESS_LINE: 0,
    HELPER_EPITAPH: 0,
    RIVAL_MOCKERY: 0,
    CROWD_JUDGMENT: 0,
    DEBRIEF_FACT: 0,
    TURNING_POINT_CARD: 0,
    BLAME_CARD: 0,
    SUMMARY_CARD: 0,
    LEGEND_NOTICE: 0,
    REWARD_NOTICE: 0,
    FORESHADOW_LINE: 0,
    SILENCE: 0,
    WORLD_REACTION: 0,
  };

  for (const beat of beats) counts[beat.kind] += 1;
  return counts;
}

export function collectPostRunChannels(
  plan: Pick<ChatPostRunPlan, 'beats' | 'visibility'>,
): readonly ChatVisibleChannel[] {
  if (plan.visibility === 'PRIVATE' || plan.visibility === 'SHADOW_ONLY' || plan.visibility === 'LEGEND_ARCHIVE') {
    return [] as const;
  }
  return uniqueVisibleChannels(plan.beats.map((beat) => beat.visibleChannel ?? undefined));
}

export function shouldBroadcastPostRunPublicly(
  plan: Pick<ChatPostRunPlan, 'visibility' | 'class' | 'evidence'>,
): boolean {
  if (plan.visibility === 'PRIVATE' || plan.visibility === 'SHADOW_ONLY') return false;
  if (plan.class === 'LEGEND_ARCHIVE') return true;
  return plan.evidence.runOutcome === 'WIN' || plan.evidence.runOutcome === 'SOVEREIGN';
}

export function shouldPersistPostRunReplay(plan: Pick<ChatPostRunPlan, 'evidence' | 'turningPoint' | 'kind'>): boolean {
  if (plan.evidence.replayId) return true;
  if (plan.kind === 'LEGEND_RECAP' || plan.kind === 'TURNING_POINT_REVEAL') return true;
  return Boolean(plan.turningPoint && Number(plan.turningPoint.legendLift01) >= 0.70);
}

export function shouldAnchorPostRunMemory(input: {
  readonly turningPoint?: ChatTurningPoint | null;
  readonly blameVectors: readonly ChatPostRunBlameVector[];
  readonly foreshadow: readonly ChatPostRunForeshadow[];
  readonly outcome: ChatRunOutcome;
}): boolean {
  if (input.outcome === 'SOVEREIGN') return true;
  if (input.turningPoint && Number(input.turningPoint.memorySalience01) >= 0.65) return true;
  if (input.foreshadow.length > 0) return true;
  return input.blameVectors.some((blame) => Number(blame.confidence01) >= 0.75);
}

export function shouldEscalatePostRunToLegend(input: {
  readonly turningPoint?: ChatTurningPoint | null;
  readonly outcome: ChatRunOutcome;
  readonly replayId?: ChatReplayId;
  readonly proofHash?: ChatProofHash;
}): boolean {
  if (input.outcome === 'SOVEREIGN') return true;
  if (!input.turningPoint) return false;
  return Number(input.turningPoint.legendLift01) >= 0.75 && Boolean(input.replayId || input.proofHash);
}

export function deriveSummaryClass(input: {
  readonly tone: ChatPostRunTone;
  readonly kind: ChatPostRunKind;
  readonly outcome: ChatRunOutcome;
  readonly closureBand: ChatPostRunClosureBand;
}): ChatPostRunSummaryClass {
  if (input.kind === 'LEGEND_RECAP') return 'HIGHLIGHT_REEL';
  if (input.kind === 'FORESHADOW_RITE') return 'ORACLE';
  if (input.kind === 'RECOVERY_AUTOPSY') return 'AUTOPSY';
  if (input.outcome === 'SOVEREIGN') return 'COURT_RECORD';
  if (input.closureBand === 'OPEN_WOUND') return 'EPITAPH';
  if (input.tone === 'CLINICAL') return 'AUTOPSY';
  return 'SCORECARD';
}

export function summarizeTurningPoint(turningPoint?: ChatTurningPoint | null): string | undefined {
  if (!turningPoint) return undefined;
  return `${turningPoint.label}: ${turningPoint.explanation}`;
}

export function summarizePrimaryBlame(blameVectors: readonly ChatPostRunBlameVector[]): string | undefined {
  const primary = choosePrimaryBlameVector(blameVectors);
  if (!primary) return undefined;
  return `${primary.label}: ${primary.explanation}`;
}

export function summarizePrimaryDirective(directives: readonly ChatPostRunDirective[]): string | undefined {
  const primary = choosePrimaryDirective(directives);
  if (!primary) return undefined;
  return `${primary.label}: ${primary.explanation}`;
}

export function summarizePrimaryForeshadow(foreshadow: readonly ChatPostRunForeshadow[]): string | undefined {
  const primary = choosePrimaryForeshadow(foreshadow);
  if (!primary) return undefined;
  return `${primary.label}: ${primary.line}`;
}

export function buildPostRunSummaryCard(input: {
  readonly summaryId: ChatPostRunSummaryId;
  readonly cardId: ChatPostRunCardId;
  readonly title: string;
  readonly subtitle: string;
  readonly body: string;
  readonly tone: ChatPostRunTone;
  readonly closureBand: ChatPostRunClosureBand;
  readonly kind: ChatPostRunKind;
  readonly archiveClass?: ChatSceneArchiveClass;
  readonly archivePolicy: ChatPostRunArchivePolicy;
  readonly turningPoint?: ChatTurningPoint | null;
  readonly blameVectors: readonly ChatPostRunBlameVector[];
  readonly directives: readonly ChatPostRunDirective[];
  readonly foreshadow: readonly ChatPostRunForeshadow[];
  readonly legendId?: ChatLegendId;
  readonly replayId?: ChatReplayId;
  readonly proofHash?: ChatProofHash;
  readonly tags?: readonly string[];
}): ChatPostRunSummaryCard {
  return {
    cardId: input.cardId,
    summaryId: input.summaryId,
    summaryClass: deriveSummaryClass({
      tone: input.tone,
      kind: input.kind,
      outcome: input.kind === 'CELEBRATION_RITE' ? 'WIN' : 'LOSS',
      closureBand: input.closureBand,
    }),
    title: input.title,
    subtitle: input.subtitle,
    body: input.body,
    closureBand: input.closureBand,
    archivePolicy: input.archivePolicy,
    dominantTone: input.tone,
    archiveClass: input.archiveClass,
    turningPointId: input.turningPoint?.turningPointId,
    blameIds: input.blameVectors.map((entry) => entry.blameId),
    directiveIds: input.directives.map((entry) => entry.directiveId),
    foreshadowIds: input.foreshadow.map((entry) => entry.foreshadowId),
    legendId: input.legendId,
    replayId: input.replayId,
    proofHash: input.proofHash,
    tags: input.tags,
  };
}

export function createEmptyPostRunRuntimeState(
  postRunId: ChatPostRunId,
): ChatPostRunRuntimeState {
  return {
    postRunId,
    stage: 'STAGED',
    deliveredBeatIds: [] as const,
    acknowledgedBeatIds: [] as const,
    hiddenBeatIds: [] as const,
    deliveredChannels: [] as const,
  };
}

export function createPostRunReceipt(input: {
  readonly receiptId: ChatPostRunReceiptId;
  readonly createdAt: UnixMs;
  readonly visibility: ChatPostRunVisibilityMode;
  readonly beats: readonly ChatPostRunBeat[];
  readonly messageIds?: readonly ChatMessageId[];
  readonly replayId?: ChatReplayId;
  readonly proofHash?: ChatProofHash;
  readonly legendId?: ChatLegendId;
}): ChatPostRunReceipt {
  return {
    receiptId: input.receiptId,
    createdAt: input.createdAt,
    visibility: input.visibility,
    deliveredChannels: uniqueVisibleChannels(input.beats.map((beat) => beat.visibleChannel ?? undefined)),
    beatIds: input.beats.map((beat) => beat.beatId),
    messageIds: input.messageIds ?? ([] as const),
    replayId: input.replayId,
    proofHash: input.proofHash,
    legendId: input.legendId,
  };
}

export function buildPostRunArchiveEntry(input: {
  readonly archiveId: ChatPostRunArchiveId;
  readonly plan: ChatPostRunPlan;
  readonly archivedAt: UnixMs;
  readonly memoryAnchorIds?: readonly ChatMemoryAnchorId[];
}): ChatPostRunArchiveEntry {
  return {
    archiveId: input.archiveId,
    postRunId: input.plan.postRunId,
    roomId: input.plan.roomId,
    userId: input.plan.userId,
    outcome: input.plan.evidence.runOutcome,
    kind: input.plan.kind,
    class: input.plan.class,
    tone: input.plan.tone,
    closureBand: input.plan.summaryCard.closureBand,
    archivePolicy: input.plan.summaryCard.archivePolicy,
    summaryCard: input.plan.summaryCard,
    turningPoint: input.plan.turningPoint,
    compactMoments: input.plan.turningPointCandidates
      .filter((candidate) => candidate.sourceMomentId)
      .map((candidate) => ({
        momentId: candidate.sourceMomentId!,
        kind: candidate.momentKind ?? 'CUSTOM',
        severity: candidate.severity,
        stage: 'ARCHIVED',
        detectedAt: candidate.detectedAt,
        sceneId: candidate.sourceSceneId,
        visibleChannel: input.plan.beats.find((beat) => beat.turningPointId === candidate.turningPointId)?.visibleChannel ?? undefined,
      })),
    witnessLines: input.plan.witnesses.map((witness) => witness.line),
    blameLabels: input.plan.blameVectors.map((entry) => entry.label),
    foreshadowLabels: input.plan.foreshadow.map((entry) => entry.label),
    directiveLabels: input.plan.directives.map((entry) => entry.label),
    relatedLegendId: input.plan.summaryCard.legendId,
    replayId: input.plan.summaryCard.replayId,
    proofHash: input.plan.summaryCard.proofHash,
    memoryAnchorIds: input.memoryAnchorIds ?? ([] as const),
    archivedAt: input.archivedAt,
    tags: input.plan.tags,
  };
}

export function buildPostRunDigest(
  plan: ChatPostRunPlan,
): ChatPostRunDigest {
  const primaryBlame = choosePrimaryBlameVector(plan.blameVectors);
  const primaryDirective = choosePrimaryDirective(plan.directives);
  const primaryForeshadow = choosePrimaryForeshadow(plan.foreshadow);
  const channels = collectPostRunChannels(plan);

  return {
    digestId: (`postrun:digest:${plan.postRunId}` as unknown) as ChatPostRunDigestId,
    postRunId: plan.postRunId,
    roomId: plan.roomId,
    outcome: plan.evidence.runOutcome,
    kind: plan.kind,
    class: plan.class,
    tone: plan.tone,
    closureBand: plan.summaryCard.closureBand,
    turningPointLabel: plan.turningPoint?.label,
    primaryBlameLabel: primaryBlame?.label,
    primaryDirectiveLabel: primaryDirective?.label,
    primaryForeshadowLabel: primaryForeshadow?.label,
    witnessCount: plan.witnesses.length,
    beatCount: plan.beats.length,
    deliveredChannelCount: channels.length,
    shouldAnchorMemory: plan.shouldAnchorMemory,
    replayRecommended: plan.replayRecommended,
    legendEscalationEligible: plan.legendEscalationEligible,
    createdAt: plan.createdAt,
  };
}

export function summarizePostRunPlan(plan: ChatPostRunPlan): JsonObject {
  const primaryBlame = choosePrimaryBlameVector(plan.blameVectors);
  const primaryDirective = choosePrimaryDirective(plan.directives);
  const primaryForeshadow = choosePrimaryForeshadow(plan.foreshadow);
  const beatCounts = countPostRunBeatsByKind(plan.beats);

  return {
    postRunId: plan.postRunId,
    roomId: plan.roomId,
    kind: plan.kind,
    class: plan.class,
    stage: plan.stage,
    tone: plan.tone,
    visibility: plan.visibility,
    outcome: plan.evidence.runOutcome,
    turningPointId: plan.turningPoint?.turningPointId ?? null,
    turningPointLabel: plan.turningPoint?.label ?? null,
    primaryBlameId: primaryBlame?.blameId ?? null,
    primaryBlameLabel: primaryBlame?.label ?? null,
    primaryDirectiveId: primaryDirective?.directiveId ?? null,
    primaryDirectiveLabel: primaryDirective?.label ?? null,
    primaryForeshadowId: primaryForeshadow?.foreshadowId ?? null,
    primaryForeshadowLabel: primaryForeshadow?.label ?? null,
    beatCount: plan.beats.length,
    witnessCount: plan.witnesses.length,
    replayRecommended: plan.replayRecommended,
    shouldAnchorMemory: plan.shouldAnchorMemory,
    legendEscalationEligible: plan.legendEscalationEligible,
    deliveredChannels: collectPostRunChannels(plan),
    beatKinds: beatCounts as unknown as JsonValue,
    createdAt: plan.createdAt,
    settledAt: plan.settledAt ?? null,
  };
}

export function postRunPlanSupportsReplay(
  plan: Pick<ChatPostRunPlan, 'visibility' | 'summaryCard' | 'evidence'>,
): boolean {
  if (!plan.summaryCard.replayId && !plan.evidence.replayId) return false;
  const channels = plan.visibility === 'CHANNEL' || plan.visibility === 'MULTI_CHANNEL';
  return Boolean(plan.summaryCard.replayId || plan.evidence.replayId) && (channels || plan.visibility === 'LEGEND_ARCHIVE');
}

export function postRunPlanSupportsWorldEcho(
  plan: Pick<ChatPostRunPlan, 'evidence' | 'foreshadow'>,
): boolean {
  if (plan.evidence.worldEventIds.length > 0) return true;
  return plan.foreshadow.some((entry) => entry.kind === 'WORLD_EVENT_ECHO');
}

export function derivePrimaryWitnessStance(
  witnesses: readonly ChatPostRunWitness[],
): ChatPostRunWitnessStance | undefined {
  const primary = [...witnesses].sort((left, right) => Number(right.intensity01) - Number(left.intensity01))[0];
  return primary?.stance;
}

export function deriveDominantVisibleChannel(
  beats: readonly ChatPostRunBeat[],
): ChatVisibleChannel | undefined {
  const counts = new Map<ChatVisibleChannel, number>();
  for (const beat of beats) {
    if (!beat.visibleChannel) continue;
    counts.set(beat.visibleChannel, (counts.get(beat.visibleChannel) ?? 0) + 1);
  }

  let dominant: ChatVisibleChannel | undefined;
  let maxCount = -1;
  for (const [channel, count] of counts.entries()) {
    if (count > maxCount) {
      dominant = channel;
      maxCount = count;
    }
  }
  return dominant;
}

export function projectPostRunThread(
  plan: Pick<ChatPostRunPlan, 'beats' | 'witnesses' | 'visibility'>,
): ChatPostRunThread {
  const channel = deriveDominantVisibleChannel(plan.beats);
  return {
    threadId: (`postrun:thread:${channel ?? 'private'}` as unknown) as ChatPostRunThreadId,
    channelId: plan.visibility === 'PRIVATE' || plan.visibility === 'SHADOW_ONLY' ? undefined : channel,
    witnessIds: plan.witnesses.map((entry) => entry.witnessId),
    beatIds: plan.beats.map((entry) => entry.beatId),
    closed: false,
  };
}

export function derivePostRunWindow(input: {
  readonly openedAt: UnixMs;
  readonly outcome: ChatRunOutcome;
  readonly replayId?: ChatReplayId;
  readonly legendEligible: boolean;
}): ChatPostRunWindow {
  const base = input.openedAt as unknown as number;
  const durationMs = input.outcome === 'SOVEREIGN' ? 60_000 : input.outcome === 'WIN' ? 45_000 : 30_000;
  return {
    windowId: (`postrun:window:${base}` as unknown) as ChatPostRunWindowId,
    opensAt: input.openedAt,
    closesAt: ((base + durationMs) as unknown) as UnixMs,
    ritualMayEscalate: input.legendEligible,
    rescueCarryoverOpen: input.outcome === 'LOSS' || input.outcome === 'BANKRUPT',
    legendLockPending: Boolean(input.legendEligible && input.replayId),
  };
}

export function inferDirectiveKind(input: {
  readonly outcome: ChatRunOutcome;
  readonly affect: Pick<ChatAffectSnapshot, 'confidence' | 'frustration' | 'socialEmbarrassment' | 'trust' | 'desperation'>;
  readonly heat?: ChatAudienceHeat | null;
}): ChatPostRunDirectiveKind {
  if (Number(input.affect.frustration) >= 75 || Number(input.affect.desperation) >= 70) return 'TAKE_A_BREATH';
  if (input.heat && Number(input.heat.humiliationPressure) >= 65) return 'STAY_PRIVATE';
  if (input.heat && Number(input.heat.hypePressure) >= 65 && input.outcome !== 'LOSS') return 'HOLD_LEGEND_LINE';
  if (Number(input.affect.trust) >= 60) return 'TRUST_HELPER';
  if (Number(input.affect.socialEmbarrassment) >= 60) return 'IGNORE_BAIT';
  if (input.outcome === 'LOSS' || input.outcome === 'BANKRUPT') return 'PROTECT_SHIELD';
  return 'WATCH_CROWD_HEAT';
}

export function buildDefaultDirective(input: {
  readonly directiveId: ChatPostRunDirectiveId;
  readonly outcome: ChatRunOutcome;
  readonly affect: Pick<ChatAffectSnapshot, 'confidence' | 'frustration' | 'socialEmbarrassment' | 'trust' | 'desperation'>;
  readonly heat?: ChatAudienceHeat | null;
  readonly sourceTurningPointId?: ChatTurningPointId;
  readonly sourceBlameId?: ChatPostRunBlameId;
  readonly sourceMomentIds?: readonly ChatMomentId[];
}): ChatPostRunDirective {
  const kind = inferDirectiveKind({
    outcome: input.outcome,
    affect: input.affect,
    heat: input.heat,
  });

  const labelByKind: Record<ChatPostRunDirectiveKind, string> = {
    PLAY_AGGRESSIVE: 'Push earlier next run',
    PLAY_SMALL: 'Shrink the risk surface',
    STAY_PRIVATE: 'Reduce public exposure',
    TRUST_HELPER: 'Take the helper line sooner',
    IGNORE_BAIT: 'Do not answer the swarm',
    PREPARE_COUNTERPLAY: 'Hold a counter window',
    EXIT_DEAL_ROOM_EARLY: 'Leave the deal room earlier',
    WATCH_CROWD_HEAT: 'Watch the crowd temperature',
    PROTECT_SHIELD: 'Protect shield before tempo',
    HOLD_LEGEND_LINE: 'Preserve the legend posture',
    TAKE_A_BREATH: 'Pause before re-entry',
    CUSTOM: 'Carry the right lesson forward',
  };

  const explanationByKind: Record<ChatPostRunDirectiveKind, string> = {
    PLAY_AGGRESSIVE: 'The run rewarded pressure earlier than your current rhythm.',
    PLAY_SMALL: 'The board punished wide exposure and overextension.',
    STAY_PRIVATE: 'Public witness pressure is currently amplifying mistakes.',
    TRUST_HELPER: 'Helper guidance is outperforming your isolated recovery path.',
    IGNORE_BAIT: 'The swarm is feeding on visible embarrassment, not substance.',
    PREPARE_COUNTERPLAY: 'The loss surface opened when no counter window was reserved.',
    EXIT_DEAL_ROOM_EARLY: 'Negotiation drag increased pressure faster than value capture.',
    WATCH_CROWD_HEAT: 'Social atmosphere is now a first-class threat axis.',
    PROTECT_SHIELD: 'The run cracked once shield integrity fell below safe recovery range.',
    HOLD_LEGEND_LINE: 'Your win condition now includes protecting perceived dominance.',
    TAKE_A_BREATH: 'Immediate re-entry would compound tilt and lower-quality decisions.',
    CUSTOM: 'Preserve what mattered and discard what was noise.',
  };

  const urgency =
    kind === 'TAKE_A_BREATH'
      ? 0.95
      : kind === 'PROTECT_SHIELD' || kind === 'STAY_PRIVATE'
        ? 0.85
        : 0.65;

  const confidence =
    kind === 'TRUST_HELPER'
      ? Number(input.affect.trust) / 100
      : 0.72;

  return {
    directiveId: input.directiveId,
    kind,
    label: labelByKind[kind],
    explanation: explanationByKind[kind],
    urgency01: toPostRunScore01(urgency),
    confidence01: toPostRunScore01(confidence),
    sourceTurningPointId: input.sourceTurningPointId,
    sourceBlameId: input.sourceBlameId,
    sourceMomentIds: input.sourceMomentIds ?? ([] as const),
  };
}

export function buildDefaultBlameVector(input: {
  readonly blameId: ChatPostRunBlameId;
  readonly outcome: ChatRunOutcome;
  readonly turningPoint?: ChatTurningPointCandidate | ChatTurningPoint | null;
  readonly affect: Pick<ChatAffectSnapshot, 'frustration' | 'socialEmbarrassment' | 'desperation' | 'trust'>;
  readonly heat?: ChatAudienceHeat | null;
  readonly sourceMomentIds?: readonly ChatMomentId[];
}): ChatPostRunBlameVector {
  let kind: ChatPostRunBlameKind = 'NO_SINGLE_CAUSE';

  if (input.turningPoint?.kind === 'DEAL_ROOM_FOLD') kind = 'DEAL_ROOM_MISREAD';
  else if (input.turningPoint?.kind === 'RESCUE_MISS') kind = 'HELPER_IGNORED';
  else if (input.turningPoint?.kind === 'CROWD_SWARM') kind = 'CROWD_SWARM';
  else if (input.turningPoint?.kind === 'WORLD_EVENT_IMPACT') kind = 'WORLD_EVENT_INTERFERENCE';
  else if (input.turningPoint?.kind === 'BANKRUPTCY_LOCK') kind = 'SYSTEMIC_RISK';
  else if (Number(input.affect.desperation) >= 70) kind = 'PLAYER_HESITATION';
  else if (Number(input.affect.socialEmbarrassment) >= 60) kind = 'PLAYER_GREED';

  const labelByKind: Record<ChatPostRunBlameKind, string> = {
    PLAYER_GREED: 'Exposure outran discipline',
    PLAYER_HESITATION: 'Delay became damage',
    RIVAL_PRESSURE: 'Rival timing dictated the pace',
    CROWD_SWARM: 'The crowd accelerated collapse',
    DEAL_ROOM_MISREAD: 'The deal room posture was misread',
    HELPER_IGNORED: 'The escape lane was ignored',
    WORLD_EVENT_INTERFERENCE: 'The world state bent the run',
    SYSTEMIC_RISK: 'The run died under structural pressure',
    NO_SINGLE_CAUSE: 'No single actor owned the collapse',
    CUSTOM: 'The collapse needs a custom reading',
  };

  const explanationByKind: Record<ChatPostRunBlameKind, string> = {
    PLAYER_GREED: 'The run kept exposing itself after the board had already signaled danger.',
    PLAYER_HESITATION: 'You waited through the decisive window and paid the late price.',
    RIVAL_PRESSURE: 'External pressure forced your tempo and narrowed your options.',
    CROWD_SWARM: 'Social witness pressure amplified embarrassment and reduced clean decision quality.',
    DEAL_ROOM_MISREAD: 'Negotiation psychology was interpreted as value instead of threat.',
    HELPER_IGNORED: 'A viable rescue or reset lane was present and left unused.',
    WORLD_EVENT_INTERFERENCE: 'The run was materially altered by a world-scale overlay condition.',
    SYSTEMIC_RISK: 'No isolated mistake caused the fall; the entire stack became unstable.',
    NO_SINGLE_CAUSE: 'The end state emerged from multiple smaller failures rather than one fatal cut.',
    CUSTOM: 'The collapse requires bespoke diagnosis beyond standard blame categories.',
  };

  return {
    blameId: input.blameId,
    kind,
    label: labelByKind[kind],
    explanation: explanationByKind[kind],
    confidence01: toPostRunScore01(
      kind === 'NO_SINGLE_CAUSE'
        ? 0.45
        : 0.68 + (Number(input.turningPoint?.blameWeight01 ?? 0 as Score01) * 0.18),
    ),
    playerAgency01: toPostRunScore01(kind === 'PLAYER_GREED' || kind === 'PLAYER_HESITATION' ? 0.72 : 0.28),
    rivalPressure01: toPostRunScore01(kind === 'RIVAL_PRESSURE' ? 0.78 : 0.18),
    crowdPressure01: toPostRunScore01(kind === 'CROWD_SWARM' ? 0.82 : (input.heat ? Number(input.heat.humiliationPressure) / 100 : 0.14)),
    systemicPressure01: toPostRunScore01(kind === 'SYSTEMIC_RISK' || kind === 'WORLD_EVENT_INTERFERENCE' ? 0.80 : 0.20),
    helperMiss01: toPostRunScore01(kind === 'HELPER_IGNORED' ? 0.86 : Math.max(0, 0.50 - Number(input.affect.trust) / 200)),
    severity: input.turningPoint?.compactMoment?.severity ?? input.turningPoint?.severity ?? 'MEDIUM',
    sourceMomentIds: input.sourceMomentIds ?? ([] as const),
    sourceNpcIds: [] as const,
    sourceWorldEventIds: input.turningPoint?.sourceWorldEventId ? [input.turningPoint.sourceWorldEventId] : ([] as const),
  };
}

export function buildDefaultForeshadow(input: {
  readonly foreshadowId: ChatPostRunForeshadowId;
  readonly outcome: ChatRunOutcome;
  readonly turningPoint?: ChatTurningPoint | null;
  readonly dominantHeat?: ChatAudienceHeat | null;
  readonly legendId?: ChatLegendId;
  readonly nextWorldEventId?: ChatWorldEventId;
}): ChatPostRunForeshadow | null {
  let kind: ChatPostRunForeshadowKind = 'SEASON_THREAD';
  let label = 'The next run will remember this.';
  let line = 'This result is not closed. It has already started shaping the next room.';
  let confidence = 0.60;
  let threat = 0.45;
  let hope = 0.30;

  if (input.legendId) {
    kind = 'LEGEND_CALLBACK';
    label = 'The legend will call back later.';
    line = 'What happened here is now durable enough to return with witnesses.';
    confidence = 0.78;
    threat = 0.40;
    hope = 0.58;
  } else if (input.nextWorldEventId) {
    kind = 'WORLD_EVENT_ECHO';
    label = 'The world state is not done with you.';
    line = 'This run ended, but the larger operational weather is still moving.';
    confidence = 0.76;
    threat = 0.68;
    hope = 0.18;
  } else if (input.turningPoint?.kind === 'RESCUE_MISS') {
    kind = 'DEBT_UNPAID';
    label = 'An unpaid rescue debt remains.';
    line = 'The lane you refused will cost more next time.';
    confidence = 0.73;
    threat = 0.62;
    hope = 0.20;
  } else if (input.dominantHeat && Number(input.dominantHeat.humiliationPressure) >= 65) {
    kind = 'CHANNEL_REPUTATION_SHIFT';
    label = 'The channel mood has shifted.';
    line = 'The room will not greet you the same way on re-entry.';
    confidence = 0.70;
    threat = 0.66;
    hope = 0.15;
  } else if (input.outcome === 'WIN' || input.outcome === 'SOVEREIGN') {
    kind = 'RIVAL_RETURN';
    label = 'Winning made you louder.';
    line = 'This performance will attract a sharper answer next run.';
    confidence = 0.71;
    threat = 0.56;
    hope = 0.48;
  }

  return {
    foreshadowId: input.foreshadowId,
    kind,
    label,
    line,
    confidence01: toPostRunScore01(confidence),
    threat01: toPostRunScore01(threat),
    hope01: toPostRunScore01(hope),
    nextWorldEventId: input.nextWorldEventId,
    callbackMomentKind: input.turningPoint?.compactMoment?.kind,
    callbackLegendId: input.legendId,
  };
}

export function buildDefaultPostRunWitness(input: {
  readonly witnessId: ChatPostRunWitnessId;
  readonly actorRole: ChatPostRunActorRole;
  readonly stance: ChatPostRunWitnessStance;
  readonly displayName: string;
  readonly line: string;
  readonly intensity01?: number;
  readonly personal01?: number;
  readonly timingMs?: number;
  readonly visibleChannel?: ChatVisibleChannel | null;
  readonly npcId?: ChatNpcId;
  readonly relationshipId?: ChatRelationshipId;
  readonly proofHash?: ChatProofHash;
  readonly tags?: readonly string[];
}): ChatPostRunWitness {
  return {
    witnessId: input.witnessId,
    actorRole: input.actorRole,
    stance: input.stance,
    npcId: input.npcId,
    relationshipId: input.relationshipId,
    displayName: input.displayName,
    line: input.line,
    intensity01: toPostRunScore01(input.intensity01 ?? 0.6),
    personal01: toPostRunScore01(input.personal01 ?? 0.4),
    timingMs: input.timingMs ?? 0,
    visibleChannel: input.visibleChannel,
    proofHash: input.proofHash,
    tags: input.tags,
  };
}

export function buildDefaultPostRunBeat(input: {
  readonly beatId: ChatPostRunBeatId;
  readonly kind: ChatPostRunBeatKind;
  readonly actorRole: ChatPostRunActorRole;
  readonly tone: ChatPostRunTone;
  readonly line?: string;
  readonly summary?: string;
  readonly visibleChannel?: ChatVisibleChannel | null;
  readonly visibility: ChatPostRunVisibilityMode;
  readonly uiTreatment?: ChatUiTreatment;
  readonly stageMood?: ChatStageMood;
  readonly delayMs?: number;
  readonly durationMs?: number;
  readonly priority?: number;
  readonly turningPointId?: ChatTurningPointId;
  readonly blameId?: ChatPostRunBlameId;
  readonly foreshadowId?: ChatPostRunForeshadowId;
  readonly legendId?: ChatLegendId;
  readonly proofHash?: ChatProofHash;
  readonly replayId?: ChatReplayId;
  readonly messageId?: ChatMessageId;
  readonly sourceMomentIds?: readonly ChatMomentId[];
  readonly sourceSceneIds?: readonly ChatSceneId[];
  readonly tags?: readonly string[];
  readonly payload?: JsonObject;
}): ChatPostRunBeat {
  return {
    beatId: input.beatId,
    kind: input.kind,
    actorRole: input.actorRole,
    tone: input.tone,
    line: input.line,
    summary: input.summary,
    visibleChannel: input.visibleChannel,
    visibility: input.visibility,
    uiTreatment:
      input.uiTreatment ??
      (input.kind === 'LEGEND_NOTICE' || input.kind === 'SUMMARY_CARD' ? 'CEREMONIAL' : input.visibility === 'SHADOW_ONLY' ? 'SHADOW' : 'PRIMARY'),
    stageMood:
      input.stageMood ??
      (input.kind === 'RIVAL_MOCKERY'
        ? 'HOSTILE'
        : input.kind === 'HELPER_EPITAPH'
          ? 'SUPPORTIVE'
          : input.kind === 'SUMMARY_CARD'
            ? 'CEREMONIAL'
            : 'TENSE'),
    delayMs: input.delayMs ?? 0,
    durationMs: input.durationMs,
    priority: input.priority ?? pickBeatPriority(input.kind),
    turningPointId: input.turningPointId,
    blameId: input.blameId,
    foreshadowId: input.foreshadowId,
    legendId: input.legendId,
    proofHash: input.proofHash,
    replayId: input.replayId,
    messageId: input.messageId,
    sourceMomentIds: input.sourceMomentIds ?? ([] as const),
    sourceSceneIds: input.sourceSceneIds ?? ([] as const),
    tags: input.tags,
    payload: input.payload,
  };
}

export function buildMinimalPostRunPlan(input: {
  readonly postRunId: ChatPostRunId;
  readonly bundleId: ChatPostRunBundleId;
  readonly roomId: ChatRoomId;
  readonly kind: ChatPostRunKind;
  readonly evidence: ChatPostRunEvidenceSnapshot;
  readonly turningPointCandidates?: readonly ChatTurningPointCandidate[];
  readonly moments?: readonly ChatMoment[];
  readonly witnesses?: readonly ChatPostRunWitness[];
  readonly blameVectors?: readonly ChatPostRunBlameVector[];
  readonly directives?: readonly ChatPostRunDirective[];
  readonly foreshadow?: readonly ChatPostRunForeshadow[];
  readonly beats?: readonly ChatPostRunBeat[];
  readonly createdAt?: UnixMs;
  readonly payload?: JsonObject;
}): ChatPostRunPlan {
  const primaryTurningPoint = choosePrimaryTurningPoint(input.turningPointCandidates ?? [], input.moments);
  const dominantChannel = primaryTurningPoint?.compactMoment?.visibleChannel;
  const dominantHeat = dominantChannel ? input.evidence.audienceHeat[dominantChannel] : undefined;
  const tone = derivePostRunTone({
    outcome: input.evidence.runOutcome,
    affect: input.evidence.affect,
    reputation: input.evidence.reputation,
  });
  const visibility = derivePostRunVisibility({
    preferredChannel: dominantChannel,
    outcome: input.evidence.runOutcome,
    primaryTurningPoint,
    dominantHeat,
    replayId: input.evidence.replayId,
    legendId: input.evidence.legendId,
  });
  const className = derivePostRunClass(input.evidence.runOutcome, visibility, tone);
  const shouldAnchorMemory = shouldAnchorPostRunMemory({
    turningPoint: primaryTurningPoint,
    blameVectors: input.blameVectors ?? [],
    foreshadow: input.foreshadow ?? [],
    outcome: input.evidence.runOutcome,
  });
  const legendEscalationEligible = shouldEscalatePostRunToLegend({
    turningPoint: primaryTurningPoint,
    outcome: input.evidence.runOutcome,
    replayId: input.evidence.replayId,
    proofHash: input.evidence.proofHash,
  });
  const directives = input.directives && input.directives.length > 0
    ? input.directives
    : [
        buildDefaultDirective({
          directiveId: (`postrun:directive:${input.postRunId}` as unknown) as ChatPostRunDirectiveId,
          outcome: input.evidence.runOutcome,
          affect: input.evidence.affect,
          heat: dominantHeat,
          sourceTurningPointId: primaryTurningPoint?.turningPointId,
          sourceBlameId: input.blameVectors?.[0]?.blameId,
          sourceMomentIds: primaryTurningPoint?.compactMoment ? [primaryTurningPoint.compactMoment.momentId] : [],
        }),
      ];
  const blameVectors = input.blameVectors && input.blameVectors.length > 0
    ? input.blameVectors
    : [
        buildDefaultBlameVector({
          blameId: (`postrun:blame:${input.postRunId}` as unknown) as ChatPostRunBlameId,
          outcome: input.evidence.runOutcome,
          turningPoint: primaryTurningPoint,
          affect: input.evidence.affect,
          heat: dominantHeat,
          sourceMomentIds: primaryTurningPoint?.compactMoment ? [primaryTurningPoint.compactMoment.momentId] : [],
        }),
      ];
  const foreshadow = input.foreshadow && input.foreshadow.length > 0
    ? input.foreshadow
    : (() => {
        const candidate = buildDefaultForeshadow({
          foreshadowId: (`postrun:foreshadow:${input.postRunId}` as unknown) as ChatPostRunForeshadowId,
          outcome: input.evidence.runOutcome,
          turningPoint: primaryTurningPoint,
          dominantHeat,
          legendId: input.evidence.legendId,
          nextWorldEventId: input.evidence.worldEventIds[0],
        });
        return candidate ? [candidate] as const : ([] as const);
      })();
  const closureBand = derivePostRunClosureBand({
    outcome: input.evidence.runOutcome,
    affect: input.evidence.affect,
    turningPoint: primaryTurningPoint,
    foreshadowCount: foreshadow.length,
    directiveCount: directives.length,
  });
  const archivePolicy = derivePostRunArchivePolicy({
    closureBand,
    replayId: input.evidence.replayId,
    proofHash: input.evidence.proofHash,
    legendEligible: legendEscalationEligible,
    shouldAnchorMemory,
  });

  const summaryCard = buildPostRunSummaryCard({
    summaryId: (`postrun:summary:${input.postRunId}` as unknown) as ChatPostRunSummaryId,
    cardId: (`postrun:card:${input.postRunId}` as unknown) as ChatPostRunCardId,
    title:
      input.evidence.runOutcome === 'SOVEREIGN'
        ? 'The room remembers the ascent.'
        : input.evidence.runOutcome === 'WIN'
          ? 'The run closed with witnesses.'
          : 'The run ended, but the meaning did not.',
    subtitle: summarizeTurningPoint(primaryTurningPoint) ?? 'No single turn outweighed the total pressure.',
    body: [
      summarizePrimaryBlame(blameVectors),
      summarizePrimaryDirective(directives),
      summarizePrimaryForeshadow(foreshadow),
    ].filter(Boolean).join(' '),
    tone,
    closureBand,
    kind: input.kind,
    archiveClass: input.evidence.finalSceneSummary?.archiveClass,
    archivePolicy,
    turningPoint: primaryTurningPoint,
    blameVectors,
    directives,
    foreshadow,
    legendId: input.evidence.legendId,
    replayId: input.evidence.replayId,
    proofHash: input.evidence.proofHash,
  });

  const beats = input.beats && input.beats.length > 0
    ? input.beats
    : sortPostRunBeats([
        buildDefaultPostRunBeat({
          beatId: (`postrun:beat:verdict:${input.postRunId}` as unknown) as ChatPostRunBeatId,
          kind: 'SYSTEM_VERDICT',
          actorRole: 'SYSTEM',
          tone,
          summary: summaryCard.title,
          line: summaryCard.subtitle,
          visibleChannel: visibility === 'CHANNEL' || visibility === 'MULTI_CHANNEL' ? dominantChannel ?? null : null,
          visibility,
          replayId: input.evidence.replayId,
          proofHash: input.evidence.proofHash,
          sourceMomentIds: primaryTurningPoint?.compactMoment ? [primaryTurningPoint.compactMoment.momentId] : [],
        }),
        buildDefaultPostRunBeat({
          beatId: (`postrun:beat:turn:${input.postRunId}` as unknown) as ChatPostRunBeatId,
          kind: 'TURNING_POINT_CARD',
          actorRole: 'NARRATOR',
          tone,
          line: summarizeTurningPoint(primaryTurningPoint),
          visibleChannel: visibility === 'CHANNEL' || visibility === 'MULTI_CHANNEL' ? dominantChannel ?? null : null,
          visibility,
          delayMs: 500,
          turningPointId: primaryTurningPoint?.turningPointId,
          replayId: input.evidence.replayId,
          proofHash: input.evidence.proofHash,
          sourceMomentIds: primaryTurningPoint?.compactMoment ? [primaryTurningPoint.compactMoment.momentId] : [],
        }),
        buildDefaultPostRunBeat({
          beatId: (`postrun:beat:blame:${input.postRunId}` as unknown) as ChatPostRunBeatId,
          kind: 'BLAME_CARD',
          actorRole: 'SYSTEM',
          tone,
          line: summarizePrimaryBlame(blameVectors),
          visibleChannel: visibility === 'CHANNEL' || visibility === 'MULTI_CHANNEL' ? dominantChannel ?? null : null,
          visibility,
          delayMs: 900,
          blameId: choosePrimaryBlameVector(blameVectors)?.blameId,
        }),
        buildDefaultPostRunBeat({
          beatId: (`postrun:beat:summary:${input.postRunId}` as unknown) as ChatPostRunBeatId,
          kind: 'SUMMARY_CARD',
          actorRole: 'NARRATOR',
          tone,
          line: summaryCard.body,
          summary: summaryCard.subtitle,
          visibleChannel: visibility === 'CHANNEL' || visibility === 'MULTI_CHANNEL' ? dominantChannel ?? null : null,
          visibility,
          delayMs: 1200,
          replayId: input.evidence.replayId,
          proofHash: input.evidence.proofHash,
          legendId: input.evidence.legendId,
        }),
      ] as const);

  const witnesses = input.witnesses ?? ([] as const);
  const createdAt = input.createdAt ?? input.evidence.endedAt;
  const window = derivePostRunWindow({
    openedAt: createdAt,
    outcome: input.evidence.runOutcome,
    replayId: input.evidence.replayId,
    legendEligible: legendEscalationEligible,
  });

  const plan: ChatPostRunPlan = {
    postRunId: input.postRunId,
    bundleId: input.bundleId,
    roomId: input.roomId,
    kind: input.kind,
    stage: 'COMPOSED',
    class: className,
    tone,
    visibility,
    evidence: input.evidence,
    turningPointCandidates: input.turningPointCandidates ?? ([] as const),
    turningPoint: primaryTurningPoint ?? undefined,
    blameVectors,
    witnesses,
    beats,
    foreshadow,
    directives,
    summaryCard,
    threads: [projectPostRunThread({ beats, witnesses, visibility })],
    window,
    legendEscalationEligible,
    replayRecommended: shouldPersistPostRunReplay({
      evidence: input.evidence,
      turningPoint: primaryTurningPoint ?? undefined,
      kind: input.kind,
    }),
    shouldAnchorMemory,
    shouldPersistShadowArchive: visibility === 'SHADOW_ONLY' || shouldAnchorMemory,
    createdAt,
    tags: input.payload?.tags && Array.isArray(input.payload.tags)
      ? input.payload.tags.filter((value): value is string => typeof value === 'string')
      : undefined,
    payload: input.payload,
  };

  return plan;
}

export function derivePostRunLedgerEntry(input: {
  readonly ledgerId: ChatPostRunLedgerId;
  readonly plan: ChatPostRunPlan;
  readonly archivedAt?: UnixMs;
  readonly memoryAnchorIds?: readonly ChatMemoryAnchorId[];
}): ChatPostRunLedgerEntry {
  return {
    ledgerId: input.ledgerId,
    postRunId: input.plan.postRunId,
    roomId: input.plan.roomId,
    sessionId: input.plan.sessionId,
    requestId: input.plan.requestId,
    stage: input.archivedAt ? 'ARCHIVED' : input.plan.stage,
    createdAt: input.plan.createdAt,
    archivedAt: input.archivedAt,
    replayId: input.plan.summaryCard.replayId,
    proofHash: input.plan.summaryCard.proofHash,
    memoryAnchorIds: input.memoryAnchorIds ?? ([] as const),
    tags: input.plan.tags,
  };
}

export function validatePostRunChannels(
  channels: readonly ChatVisibleChannel[],
): readonly ChatVisibleChannel[] {
  return channels.filter(
    (channel) => channelSupportsReplay(channel) || channelSupportsLegendMoments(channel) || channelSupportsWorldEvents(channel),
  );
}

export function normalizePostRunPlan(plan: ChatPostRunPlan): ChatPostRunPlan {
  const normalizedBeats = sortPostRunBeats(plan.beats).map((beat) => ({
    ...beat,
    visibleChannel:
      beat.visibleChannel && isChatVisibleChannel(beat.visibleChannel)
        ? beat.visibleChannel
        : undefined,
    tags: uniqueStrings(beat.tags),
  }));

  const deliveredChannels = validatePostRunChannels(collectPostRunChannels({ beats: normalizedBeats, visibility: plan.visibility }));
  const receipt = plan.receipt
    ? {
        ...plan.receipt,
        deliveredChannels,
      }
    : plan.receipt;

  return {
    ...plan,
    beats: normalizedBeats,
    witnesses: plan.witnesses.map((witness) => ({
      ...witness,
      tags: uniqueStrings(witness.tags),
    })),
    blameVectors: sortBlameVectors(plan.blameVectors),
    foreshadow: sortPostRunForeshadow(plan.foreshadow),
    directives: sortPostRunDirectives(plan.directives),
    receipt,
    tags: uniqueStrings(plan.tags),
  };
}

// ============================================================================
// MARK: Contract descriptor
// ============================================================================

export const CHAT_POST_RUN_CONTRACT = Object.freeze({
  version: CHAT_POST_RUN_CONTRACT_VERSION,
  revision: CHAT_POST_RUN_CONTRACT_REVISION,
  publicApiVersion: CHAT_POST_RUN_PUBLIC_API_VERSION,
  authorities: CHAT_POST_RUN_AUTHORITIES,
  kinds: CHAT_POST_RUN_KINDS,
  stages: CHAT_POST_RUN_STAGES,
  classes: CHAT_POST_RUN_CLASSES,
  tones: CHAT_POST_RUN_TONES,
  beatKinds: CHAT_POST_RUN_BEAT_KINDS,
  actorRoles: CHAT_POST_RUN_ACTOR_ROLES,
  witnessStances: CHAT_POST_RUN_WITNESS_STANCES,
  visibilityModes: CHAT_POST_RUN_VISIBILITY_MODES,
  summaryClasses: CHAT_POST_RUN_SUMMARY_CLASSES,
  turningPointKinds: CHAT_TURNING_POINT_KINDS,
  blameKinds: CHAT_POST_RUN_BLAME_KINDS,
  foreshadowKinds: CHAT_POST_RUN_FORESHADOW_KINDS,
  directiveKinds: CHAT_POST_RUN_DIRECTIVE_KINDS,
  closureBands: CHAT_POST_RUN_CLOSURE_BANDS,
  archivePolicies: CHAT_POST_RUN_ARCHIVE_POLICIES,
} as const);

export const CHAT_POST_RUN_CONTRACT_DESCRIPTOR = CHAT_POST_RUN_CONTRACT;
