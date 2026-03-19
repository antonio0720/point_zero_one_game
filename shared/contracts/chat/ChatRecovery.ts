/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT RECOVERY CONTRACTS
 * FILE: shared/contracts/chat/ChatRecovery.ts
 * ============================================================================
 * Purpose
 * -------
 * Canonical shared contract surface for post-rescue stabilization,
 * one-card recovery ladders, channel cooldowns, helper-guided re-entry,
 * and recovery outcome scoring across the unified chat stack.
 * ============================================================================
 */

import type {
  Brand,
  ChatChannelId,
  ChatInterventionId,
  ChatMemoryAnchorId,
  ChatMessageId,
  ChatMomentId,
  ChatNpcId,
  ChatProofHash,
  ChatReplayId,
  ChatRequestId,
  ChatRoomId,
  ChatSceneId,
  ChatSessionId,
  ChatUserId,
  ChatVisibleChannel,
  JsonObject,
  Score01,
  Score100,
  UnixMs,
} from './ChatChannels';
import { CHAT_CONTRACT_AUTHORITIES, channelSupportsRescue } from './ChatChannels';
import type { ChatAffectSnapshot, ChatLearningProfile, ChatPressureTier, ChatReputationState, ChatRunOutcome } from './ChatEvents';
import type { ChatBossFightId, ChatBossFightKind } from './ChatBossFight';
import type { ChatCounterplayKind, ChatCounterWindowId } from './ChatCounterplay';
import type { ChatRescueAction, ChatRescueHelperPosture, ChatRescueId, ChatRescueKind, ChatRescueOffer, ChatRescueOutcome, ChatRescuePlan, ChatRescuePrompt, ChatRescueStyle, ChatRescueTrigger, ChatRescueUrgencyBand, ChatRescueWindow, ChatRescueWindowId } from './ChatRescue';
import type { SharedChatMomentType } from './scene';

export const CHAT_RECOVERY_CONTRACT_VERSION = '2026-03-19.1' as const;
export const CHAT_RECOVERY_CONTRACT_REVISION = 1 as const;
export const CHAT_RECOVERY_PUBLIC_API_VERSION = 'v1' as const;
export const CHAT_RECOVERY_AUTHORITIES = Object.freeze({
  ...CHAT_CONTRACT_AUTHORITIES,
  sharedContractFile: '/shared/contracts/chat/ChatRecovery.ts',
  frontendRecoveryRoot: '/pzo-web/src/engines/chat/rescue',
  backendRecoveryRoot: '/backend/src/game/engine/chat/rescue',
  serverRecoveryRoot: '/pzo-server/src/chat',
} as const);
export type ChatRecoveryId = Brand<string, 'ChatRecoveryId'>;
export type ChatRecoveryPlanId = Brand<string, 'ChatRecoveryPlanId'>;
export type ChatRecoveryOptionId = Brand<string, 'ChatRecoveryOptionId'>;
export type ChatRecoveryBundleId = Brand<string, 'ChatRecoveryBundleId'>;
export type ChatRecoveryCheckpointId = Brand<string, 'ChatRecoveryCheckpointId'>;
export type ChatRecoveryOutcomeId = Brand<string, 'ChatRecoveryOutcomeId'>;
export type ChatRecoveryDigestId = Brand<string, 'ChatRecoveryDigestId'>;
export type ChatRecoveryLedgerId = Brand<string, 'ChatRecoveryLedgerId'>;
export type ChatRecoverySuggestionId = Brand<string, 'ChatRecoverySuggestionId'>;
export const CHAT_RECOVERY_KINDS = [
  'ONE_CARD_RESET',
  'SHIELD_STABILIZE',
  'CROWD_COOLDOWN',
  'NEGOTIATION_EXIT',
  'HELPER_GUIDED_REENTRY',
  'SILENT_RECENTER',
  'QUICK_WIN_PATH',
  'RETRY_WITH_CONTEXT',
  'POST_COLLAPSE_DEBRIEF',
  'LEGEND_SALVAGE',
] as const;
export type ChatRecoveryKind = (typeof CHAT_RECOVERY_KINDS)[number];

export const CHAT_RECOVERY_PACES = [
  'INSTANT',
  'SHORT',
  'BREATH',
  'FULL_RESET',
  'BETWEEN_ROUNDS',
] as const;
export type ChatRecoveryPace = (typeof CHAT_RECOVERY_PACES)[number];

export const CHAT_RECOVERY_OPTION_KINDS = [
  'PLAY_SINGLE_MOVE',
  'ACCEPT_HELPER_LINE',
  'MUTE_PUBLIC',
  'SHIFT_CHANNEL',
  'OPEN_PROOF',
  'EXIT_DEAL_ROOM',
  'WAIT_AND_BREATHE',
  'REPLAY_LAST_RECEIPT',
  'TAKE_GUIDED_COUNTER',
  'END_LOOP',
] as const;
export type ChatRecoveryOptionKind = (typeof CHAT_RECOVERY_OPTION_KINDS)[number];

export const CHAT_RECOVERY_DIFFICULTY_BANDS = [
  'EASY',
  'CONTROLLED',
  'RECOVERABLE',
  'HIGH_FRICTION',
  'LAST_CHANCE',
] as const;
export type ChatRecoveryDifficultyBand = (typeof CHAT_RECOVERY_DIFFICULTY_BANDS)[number];

export const CHAT_RECOVERY_OUTCOMES = [
  'RECOVERED',
  'STABILIZED',
  'PARTIAL',
  'FAILED',
  'ABANDONED',
] as const;
export type ChatRecoveryOutcomeKind = (typeof CHAT_RECOVERY_OUTCOMES)[number];

export const CHAT_RECOVERY_ENTRY_POINTS = [
  'RESCUE_ACCEPTED',
  'RESCUE_SILENCE_SUCCESS',
  'COUNTER_MISS',
  'POST_COLLAPSE',
  'NEGOTIATION_ESCAPE',
  'HELPER_HANDOFF',
  'BOSS_WINDOW_ESCAPE',
] as const;
export type ChatRecoveryEntryPoint = (typeof CHAT_RECOVERY_ENTRY_POINTS)[number];

export const CHAT_RECOVERY_VISIBILITY = [
  'PRIVATE',
  'VISIBLE_RECEIPT',
  'SHADOW_ONLY',
] as const;
export type ChatRecoveryVisibility = (typeof CHAT_RECOVERY_VISIBILITY)[number];

export const CHAT_RECOVERY_SUGGESTION_MODES = [
  'MANUAL',
  'HELPER_ASSISTED',
  'AUTO_GUIDED',
  'SERVER_FALLBACK',
] as const;
export type ChatRecoverySuggestionMode = (typeof CHAT_RECOVERY_SUGGESTION_MODES)[number];

export const CHAT_RECOVERY_SUCCESS_BANDS = [
  'NO_LIFT',
  'SMALL_LIFT',
  'CLEAR_LIFT',
  'STRONG_LIFT',
  'RUN_SAVED',
] as const;
export type ChatRecoverySuccessBand = (typeof CHAT_RECOVERY_SUCCESS_BANDS)[number];

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const clamp100 = (value: number): number => Math.max(0, Math.min(100, value));
export function toScore01(value: number): Score01 { return clamp01(value) as Score01; }
export function toScore100(value: number): Score100 { return Math.round(clamp100(value)) as Score100; }
export function compareRecoveryPace(left: ChatRecoveryPace, right: ChatRecoveryPace): number { const rank: Record<ChatRecoveryPace, number> = { INSTANT: 0, SHORT: 1, BREATH: 2, FULL_RESET: 3, BETWEEN_ROUNDS: 4 }; return rank[left] - rank[right]; }
export function compareRecoveryDifficulty(left: ChatRecoveryDifficultyBand, right: ChatRecoveryDifficultyBand): number { const rank: Record<ChatRecoveryDifficultyBand, number> = { EASY: 0, CONTROLLED: 1, RECOVERABLE: 2, HIGH_FRICTION: 3, LAST_CHANCE: 4 }; return rank[left] - rank[right]; }
export interface ChatRecoveryOption {
  readonly optionId: ChatRecoveryOptionId;
  readonly kind: ChatRecoveryOptionKind;
  readonly label: string;
  readonly detail: string;
  readonly pace: ChatRecoveryPace;
  readonly visibility: ChatRecoveryVisibility;
  readonly difficulty: ChatRecoveryDifficultyBand;
  readonly confidence01: Score01;
  readonly expectedStabilityLift01: Score01;
  readonly expectedEmbarrassmentReduction01: Score01;
  readonly requiresHelper: boolean;
  readonly requiresCounterWindowOpen: boolean;
  readonly suggestedCounterplayKind?: ChatCounterplayKind | null;
  readonly suggestedChannel?: ChatChannelId | null;
  readonly payload?: JsonObject;
  readonly notes?: readonly string[];
}

export interface ChatRecoverySuggestion {
  readonly suggestionId: ChatRecoverySuggestionId;
  readonly mode: ChatRecoverySuggestionMode;
  readonly promptTitle: string;
  readonly promptBody: string;
  readonly primaryOptionId?: ChatRecoveryOptionId | null;
  readonly notes?: readonly string[];
}

export interface ChatRecoveryBundle {
  readonly bundleId: ChatRecoveryBundleId;
  readonly kind: ChatRecoveryKind;
  readonly entryPoint: ChatRecoveryEntryPoint;
  readonly visibility: ChatRecoveryVisibility;
  readonly options: readonly ChatRecoveryOption[];
  readonly suggestion: ChatRecoverySuggestion;
  readonly createdAt: UnixMs;
  readonly expiresAt?: UnixMs | null;
  readonly notes?: readonly string[];
}

export interface ChatRecoveryCheckpoint {
  readonly checkpointId: ChatRecoveryCheckpointId;
  readonly label: string;
  readonly sequence: number;
  readonly requiredStability01: Score01;
  readonly allowsSkip: boolean;
  readonly grantsVisibleReceipt: boolean;
  readonly notes?: readonly string[];
}

export interface ChatRecoveryPlan {
  readonly recoveryPlanId: ChatRecoveryPlanId;
  readonly recoveryId: ChatRecoveryId;
  readonly rescueId?: ChatRescueId | null;
  readonly roomId: ChatRoomId;
  readonly visibleChannel: ChatVisibleChannel;
  readonly sessionId?: ChatSessionId | null;
  readonly requestId?: ChatRequestId | null;
  readonly sceneId?: ChatSceneId | null;
  readonly momentId?: ChatMomentId | null;
  readonly bossFightId?: ChatBossFightId | null;
  readonly kind: ChatRecoveryKind;
  readonly entryPoint: ChatRecoveryEntryPoint;
  readonly helperPosture: ChatRescueHelperPosture;
  readonly sourceRescueKind?: ChatRescueKind | null;
  readonly sourceRescueStyle?: ChatRescueStyle | null;
  readonly activeWindowId?: ChatRescueWindowId | null;
  readonly bundle: ChatRecoveryBundle;
  readonly checkpoints: readonly ChatRecoveryCheckpoint[];
  readonly createdAt: UnixMs;
  readonly recommendedAt: UnixMs;
  readonly resolvedAt?: UnixMs | null;
  readonly notes?: readonly string[];
}

export interface ChatRecoveryOutcome {
  readonly outcomeId: ChatRecoveryOutcomeId;
  readonly recoveryId: ChatRecoveryId;
  readonly kind: ChatRecoveryOutcomeKind;
  readonly successBand: ChatRecoverySuccessBand;
  readonly acceptedOptionId?: ChatRecoveryOptionId | null;
  readonly stabilityLift01: Score01;
  readonly embarrassmentReduction01: Score01;
  readonly confidenceLift01: Score01;
  readonly trustLift01: Score01;
  readonly updatedAt: UnixMs;
  readonly notes?: readonly string[];
}

export interface ChatRecoveryLedgerEntry {
  readonly ledgerId: ChatRecoveryLedgerId;
  readonly recoveryId: ChatRecoveryId;
  readonly recoveryPlanId: ChatRecoveryPlanId;
  readonly visibleChannel: ChatVisibleChannel;
  readonly entryPoint: ChatRecoveryEntryPoint;
  readonly outcomeKind: ChatRecoveryOutcomeKind;
  readonly successBand: ChatRecoverySuccessBand;
  readonly createdAt: UnixMs;
  readonly updatedAt: UnixMs;
  readonly replayId?: ChatReplayId | null;
  readonly acceptedOptionId?: ChatRecoveryOptionId | null;
  readonly notes?: readonly string[];
}

export interface ChatRecoveryDigest {
  readonly digestId: ChatRecoveryDigestId;
  readonly updatedAt: UnixMs;
  readonly activeRecoveryIds: readonly ChatRecoveryId[];
  readonly successfulRecoveryIds: readonly ChatRecoveryId[];
  readonly failedRecoveryIds: readonly ChatRecoveryId[];
  readonly strongestSuccessBand?: ChatRecoverySuccessBand;
  readonly strongestOutcomeKind?: ChatRecoveryOutcomeKind;
}
export const CHAT_RECOVERY_KIND_FROM_RESCUE_KIND = Object.freeze<Record<ChatRescueKind, ChatRecoveryKind>>({
  RAGE_QUIT_INTERCEPT: 'SILENT_RECENTER',
  COLLAPSE_STABILIZE: 'SHIELD_STABILIZE',
  FAILURE_CHAIN_BREAK: 'ONE_CARD_RESET',
  QUIET_RECOVERY: 'SILENT_RECENTER',
  HELPER_HANDOFF: 'HELPER_GUIDED_REENTRY',
  CROWD_SHIELD: 'CROWD_COOLDOWN',
  DEAL_ROOM_BAILOUT: 'NEGOTIATION_EXIT',
  ONE_CARD_RECOVERY: 'ONE_CARD_RESET',
  CHANNEL_COOLDOWN: 'CROWD_COOLDOWN',
  BREATH_WINDOW: 'SILENT_RECENTER',
  POST_COLLAPSE_GUIDE: 'POST_COLLAPSE_DEBRIEF',
  EXIT_WITH_DIGNITY: 'QUICK_WIN_PATH',
});
export function createChatRecoveryId(seed: string): ChatRecoveryId { return (`recovery:${seed}`) as ChatRecoveryId; }
export function createChatRecoveryPlanId(seed: string): ChatRecoveryPlanId { return (`recovery-plan:${seed}`) as ChatRecoveryPlanId; }
export function createChatRecoveryOptionId(seed: string): ChatRecoveryOptionId { return (`recovery-option:${seed}`) as ChatRecoveryOptionId; }
export function createChatRecoveryBundleId(seed: string): ChatRecoveryBundleId { return (`recovery-bundle:${seed}`) as ChatRecoveryBundleId; }
export function createChatRecoveryCheckpointId(seed: string): ChatRecoveryCheckpointId { return (`recovery-checkpoint:${seed}`) as ChatRecoveryCheckpointId; }
export function createChatRecoveryOutcomeId(seed: string): ChatRecoveryOutcomeId { return (`recovery-outcome:${seed}`) as ChatRecoveryOutcomeId; }
export function deriveRecoveryDifficulty(input: {
  readonly confidence: Score100;
  readonly frustration: Score100;
  readonly embarrassment: Score100;
  readonly desperation: Score100;
  readonly helperReceptivity?: Score100;
}): ChatRecoveryDifficultyBand {
  const burden =
    (1 - Number(input.confidence) / 100) * 0.30 +
    Number(input.frustration) / 100 * 0.30 +
    Number(input.embarrassment) / 100 * 0.20 +
    Number(input.desperation) / 100 * 0.15 +
    (1 - Number(input.helperReceptivity ?? (50 as Score100)) / 100) * 0.05;

  if (burden >= 0.86) return 'LAST_CHANCE';
  if (burden >= 0.68) return 'HIGH_FRICTION';
  if (burden >= 0.48) return 'RECOVERABLE';
  if (burden >= 0.26) return 'CONTROLLED';
  return 'EASY';
}

export function deriveRecoveryEntryPoint(input: {
  readonly rescuePlan?: ChatRescuePlan | null;
  readonly rescueOutcome?: ChatRescueOutcome | null;
  readonly recentCollapse?: boolean;
  readonly inDealRoom?: boolean;
  readonly counterWindowId?: ChatCounterWindowId | null;
}): ChatRecoveryEntryPoint {
  if (input.inDealRoom && input.rescuePlan?.kind === 'DEAL_ROOM_BAILOUT') return 'NEGOTIATION_ESCAPE';
  if (input.counterWindowId) return 'BOSS_WINDOW_ESCAPE';
  if (input.recentCollapse) return 'POST_COLLAPSE';
  if (input.rescueOutcome === 'ACCEPTED') return 'RESCUE_ACCEPTED';
  if (input.rescuePlan?.kind === 'HELPER_HANDOFF') return 'HELPER_HANDOFF';
  return 'RESCUE_SILENCE_SUCCESS';
}

export function deriveRecoveryKindFromRescue(
  rescueKind: ChatRescueKind,
): ChatRecoveryKind {
  return CHAT_RECOVERY_KIND_FROM_RESCUE_KIND[rescueKind];
}

export function shouldOfferOneCardRecovery(input: {
  readonly rescuePlan?: ChatRescuePlan | null;
  readonly confidence: Score100;
  readonly frustration: Score100;
  readonly bossFightId?: ChatBossFightId | null;
  readonly counterWindowId?: ChatCounterWindowId | null;
}): boolean {
  if (input.rescuePlan?.kind === 'ONE_CARD_RECOVERY') return true;
  if (input.counterWindowId && Number(input.confidence) <= 42) return true;
  return Boolean(input.bossFightId) && Number(input.frustration) >= 60;
}

export function buildRecoveryOption(
  optionIdSeed: string,
  kind: ChatRecoveryOptionKind,
  label: string,
  detail: string,
  pace: ChatRecoveryPace,
  visibility: ChatRecoveryVisibility,
  difficulty: ChatRecoveryDifficultyBand,
  confidence01: number,
  stabilityLift01: number,
  embarrassmentReduction01: number,
  extras: Partial<Pick<ChatRecoveryOption, 'requiresHelper' | 'requiresCounterWindowOpen' | 'suggestedCounterplayKind' | 'suggestedChannel' | 'payload' | 'notes'>> = {},
): ChatRecoveryOption {
  return {
    optionId: createChatRecoveryOptionId(optionIdSeed),
    kind,
    label,
    detail,
    pace,
    visibility,
    difficulty,
    confidence01: toScore01(confidence01),
    expectedStabilityLift01: toScore01(stabilityLift01),
    expectedEmbarrassmentReduction01: toScore01(embarrassmentReduction01),
    requiresHelper: extras.requiresHelper ?? false,
    requiresCounterWindowOpen: extras.requiresCounterWindowOpen ?? false,
    suggestedCounterplayKind: extras.suggestedCounterplayKind ?? null,
    suggestedChannel: extras.suggestedChannel ?? null,
    payload: extras.payload,
    notes: extras.notes,
  };
}
export function buildRecoveryBundle(input: {
  readonly kind: ChatRecoveryKind;
  readonly entryPoint: ChatRecoveryEntryPoint;
  readonly visibleChannel: ChatVisibleChannel;
  readonly difficulty: ChatRecoveryDifficultyBand;
  readonly now: UnixMs;
}): ChatRecoveryBundle {
  const privateChannel: ChatChannelId = input.visibleChannel === 'GLOBAL' ? 'SYNDICATE' : input.visibleChannel;
  const options: ChatRecoveryOption[] = [
    buildRecoveryOption(
      `${input.kind.toLowerCase()}:single-move`,
      'PLAY_SINGLE_MOVE',
      'Take one safe move',
      'Reduce the decision surface to one high-confidence action.',
      input.kind === 'SILENT_RECENTER' ? 'BREATH' : 'SHORT',
      'PRIVATE',
      input.difficulty,
      0.84,
      0.62,
      0.44,
      { suggestedChannel: privateChannel },
    ),
    buildRecoveryOption(
      `${input.kind.toLowerCase()}:mute-public`,
      'MUTE_PUBLIC',
      'Mute public pressure',
      'Remove the crowd from the decision loop temporarily.',
      'INSTANT',
      'PRIVATE',
      input.difficulty === 'LAST_CHANCE' ? 'CONTROLLED' : input.difficulty,
      0.76,
      0.38,
      0.71,
      { suggestedChannel: privateChannel },
    ),
  ];

  if (input.kind === 'ONE_CARD_RESET') {
    options.push(
      buildRecoveryOption(
        `${input.kind.toLowerCase()}:guided-counter`,
        'TAKE_GUIDED_COUNTER',
        'Take the guided counter',
        'Use a helper-guided response to convert panic into one authored move.',
        'SHORT',
        'PRIVATE',
        input.difficulty,
        0.88,
        0.73,
        0.48,
        {
          requiresHelper: true,
          requiresCounterWindowOpen: true,
          suggestedCounterplayKind: 'HELPER_ASSIST',
          suggestedChannel: privateChannel,
        },
      ),
    );
  }

  if (input.kind === 'NEGOTIATION_EXIT') {
    options.push(
      buildRecoveryOption(
        `${input.kind.toLowerCase()}:deal-exit`,
        'EXIT_DEAL_ROOM',
        'Exit the negotiation squeeze',
        'Back out cleanly and preserve leverage for a re-entry.',
        'INSTANT',
        'PRIVATE',
        'CONTROLLED',
        0.89,
        0.69,
        0.52,
        {
          suggestedCounterplayKind: 'NEGOTIATION_ESCAPE',
          suggestedChannel: 'DEAL_ROOM',
        },
      ),
    );
  }

  if (input.kind === 'POST_COLLAPSE_DEBRIEF') {
    options.push(
      buildRecoveryOption(
        `${input.kind.toLowerCase()}:replay-receipt`,
        'REPLAY_LAST_RECEIPT',
        'Replay the last turning point',
        'See the exact break instead of guessing what went wrong.',
        'BREATH',
        'PRIVATE',
        'CONTROLLED',
        0.72,
        0.45,
        0.55,
        { suggestedChannel: privateChannel },
      ),
    );
  }

  const suggestion: ChatRecoverySuggestion = {
    suggestionId: (`recovery-suggestion:${input.kind.toLowerCase()}:${Number(input.now)}`) as ChatRecoverySuggestionId,
    mode: input.kind === 'ONE_CARD_RESET' ? 'HELPER_ASSISTED' : input.kind === 'SILENT_RECENTER' ? 'AUTO_GUIDED' : 'MANUAL',
    promptTitle:
      input.kind === 'NEGOTIATION_EXIT'
        ? 'Exit first. Reprice later.'
        : input.kind === 'ONE_CARD_RESET'
          ? 'Take one move, not ten.'
          : 'Recover the run shape.',
    promptBody:
      input.kind === 'SILENT_RECENTER'
        ? 'Give the pressure loop no new fuel. Reset before you speak again.'
        : input.kind === 'HELPER_GUIDED_REENTRY'
          ? 'Let the helper narrow the path and keep the dignity intact.'
          : 'Choose the smallest move that restores control.',
    primaryOptionId: options[0]?.optionId ?? null,
  };

  return {
    bundleId: createChatRecoveryBundleId(`${input.kind.toLowerCase()}:${Number(input.now)}`),
    kind: input.kind,
    entryPoint: input.entryPoint,
    visibility: input.kind === 'SILENT_RECENTER' ? 'SHADOW_ONLY' : 'PRIVATE',
    options,
    suggestion,
    createdAt: input.now,
    expiresAt: ((Number(input.now) + 15000) as UnixMs),
    notes: [],
  };
}

export function createDefaultRecoveryCheckpoints(
  kind: ChatRecoveryKind,
): readonly ChatRecoveryCheckpoint[] {
  const checkpoints: ChatRecoveryCheckpoint[] = [
    {
      checkpointId: createChatRecoveryCheckpointId(`${kind.toLowerCase()}:stabilize`),
      label: 'Stabilize',
      sequence: 0,
      requiredStability01: toScore01(0.30),
      allowsSkip: false,
      grantsVisibleReceipt: false,
    },
    {
      checkpointId: createChatRecoveryCheckpointId(`${kind.toLowerCase()}:act`),
      label: 'Act',
      sequence: 1,
      requiredStability01: toScore01(0.52),
      allowsSkip: false,
      grantsVisibleReceipt: false,
    },
    {
      checkpointId: createChatRecoveryCheckpointId(`${kind.toLowerCase()}:restore`),
      label: 'Restore',
      sequence: 2,
      requiredStability01: toScore01(0.72),
      allowsSkip: true,
      grantsVisibleReceipt: kind === 'LEGEND_SALVAGE' || kind === 'QUICK_WIN_PATH',
    },
  ];
  return checkpoints;
}
export function buildRecoveryPlan(input: {
  readonly roomId: ChatRoomId;
  readonly visibleChannel: ChatVisibleChannel;
  readonly sessionId?: ChatSessionId | null;
  readonly requestId?: ChatRequestId | null;
  readonly sceneId?: ChatSceneId | null;
  readonly momentId?: ChatMomentId | null;
  readonly bossFightId?: ChatBossFightId | null;
  readonly rescuePlan?: ChatRescuePlan | null;
  readonly rescueOutcome?: ChatRescueOutcome | null;
  readonly helperPosture: ChatRescueHelperPosture;
  readonly affect: ChatAffectSnapshot;
  readonly learning: ChatLearningProfile;
  readonly inDealRoom?: boolean;
  readonly recentCollapse?: boolean;
  readonly counterWindowId?: ChatCounterWindowId | null;
  readonly now: UnixMs;
}): ChatRecoveryPlan {
  const kind = input.rescuePlan
    ? deriveRecoveryKindFromRescue(input.rescuePlan.kind)
    : shouldOfferOneCardRecovery({
        rescuePlan: input.rescuePlan,
        confidence: input.affect.confidence,
        frustration: input.affect.frustration,
        bossFightId: input.bossFightId ?? null,
        counterWindowId: input.counterWindowId ?? null,
      })
      ? 'ONE_CARD_RESET'
      : 'SILENT_RECENTER';

  const entryPoint = deriveRecoveryEntryPoint({
    rescuePlan: input.rescuePlan ?? null,
    rescueOutcome: input.rescueOutcome ?? null,
    recentCollapse: input.recentCollapse,
    inDealRoom: input.inDealRoom,
    counterWindowId: input.counterWindowId ?? null,
  });

  const difficulty = deriveRecoveryDifficulty({
    confidence: input.affect.confidence,
    frustration: input.affect.frustration,
    embarrassment: input.affect.socialEmbarrassment,
    desperation: input.affect.desperation,
    helperReceptivity: input.learning.helperReceptivity,
  });

  const bundle = buildRecoveryBundle({
    kind,
    entryPoint,
    visibleChannel: input.visibleChannel,
    difficulty,
    now: input.now,
  });

  const recoveryId = createChatRecoveryId(`${kind.toLowerCase()}:${Number(input.now)}`);

  return {
    recoveryPlanId: createChatRecoveryPlanId(`${String(recoveryId)}:plan`),
    recoveryId,
    rescueId: input.rescuePlan?.rescueId ?? null,
    roomId: input.roomId,
    visibleChannel: input.visibleChannel,
    sessionId: input.sessionId ?? null,
    requestId: input.requestId ?? null,
    sceneId: input.sceneId ?? null,
    momentId: input.momentId ?? null,
    bossFightId: input.bossFightId ?? null,
    kind,
    entryPoint,
    helperPosture: input.helperPosture,
    sourceRescueKind: input.rescuePlan?.kind ?? null,
    sourceRescueStyle: input.rescuePlan?.style ?? null,
    activeWindowId: null,
    bundle,
    checkpoints: createDefaultRecoveryCheckpoints(kind),
    createdAt: input.now,
    recommendedAt: input.now,
    resolvedAt: null,
    notes: [],
  };
}

export function deriveRecoverySuccessBand(input: {
  readonly stabilityLift01: Score01;
  readonly embarrassmentReduction01: Score01;
  readonly confidenceLift01: Score01;
}): ChatRecoverySuccessBand {
  const score =
    Number(input.stabilityLift01) * 0.45 +
    Number(input.embarrassmentReduction01) * 0.25 +
    Number(input.confidenceLift01) * 0.30;

  if (score >= 0.86) return 'RUN_SAVED';
  if (score >= 0.66) return 'STRONG_LIFT';
  if (score >= 0.46) return 'CLEAR_LIFT';
  if (score >= 0.24) return 'SMALL_LIFT';
  return 'NO_LIFT';
}

export function createRecoveryOutcome(input: {
  readonly recoveryId: ChatRecoveryId;
  readonly acceptedOptionId?: ChatRecoveryOptionId | null;
  readonly stabilityLift01: number;
  readonly embarrassmentReduction01: number;
  readonly confidenceLift01: number;
  readonly trustLift01: number;
  readonly updatedAt: UnixMs;
}): ChatRecoveryOutcome {
  const stabilityLift01 = toScore01(input.stabilityLift01);
  const embarrassmentReduction01 = toScore01(input.embarrassmentReduction01);
  const confidenceLift01 = toScore01(input.confidenceLift01);
  const trustLift01 = toScore01(input.trustLift01);

  const successBand = deriveRecoverySuccessBand({
    stabilityLift01,
    embarrassmentReduction01,
    confidenceLift01,
  });

  const kind: ChatRecoveryOutcomeKind =
    successBand === 'RUN_SAVED' || successBand === 'STRONG_LIFT'
      ? 'RECOVERED'
      : successBand === 'CLEAR_LIFT'
        ? 'STABILIZED'
        : successBand === 'SMALL_LIFT'
          ? 'PARTIAL'
          : 'FAILED';

  return {
    outcomeId: createChatRecoveryOutcomeId(`${String(input.recoveryId)}:${Number(input.updatedAt)}`),
    recoveryId: input.recoveryId,
    kind,
    successBand,
    acceptedOptionId: input.acceptedOptionId ?? null,
    stabilityLift01,
    embarrassmentReduction01,
    confidenceLift01,
    trustLift01,
    updatedAt: input.updatedAt,
    notes: [],
  };
}

export function deriveRecoveryDigest(
  entries: readonly ChatRecoveryLedgerEntry[],
  updatedAt: UnixMs,
): ChatRecoveryDigest {
  const activeRecoveryIds: ChatRecoveryId[] = [];
  const successfulRecoveryIds: ChatRecoveryId[] = [];
  const failedRecoveryIds: ChatRecoveryId[] = [];
  let strongestSuccessBand: ChatRecoverySuccessBand | undefined;
  let strongestOutcomeKind: ChatRecoveryOutcomeKind | undefined;

  const successRank: Record<ChatRecoverySuccessBand, number> = {
    NO_LIFT: 0,
    SMALL_LIFT: 1,
    CLEAR_LIFT: 2,
    STRONG_LIFT: 3,
    RUN_SAVED: 4,
  };

  for (const entry of entries) {
    if (entry.outcomeKind === 'PARTIAL') activeRecoveryIds.push(entry.recoveryId);
    if (entry.outcomeKind === 'RECOVERED' || entry.outcomeKind === 'STABILIZED') {
      successfulRecoveryIds.push(entry.recoveryId);
    }
    if (entry.outcomeKind === 'FAILED' || entry.outcomeKind === 'ABANDONED') {
      failedRecoveryIds.push(entry.recoveryId);
    }
    if (
      !strongestSuccessBand ||
      successRank[entry.successBand] > successRank[strongestSuccessBand]
    ) {
      strongestSuccessBand = entry.successBand;
      strongestOutcomeKind = entry.outcomeKind;
    }
  }

  return {
    digestId: (`recovery-digest:${Number(updatedAt)}`) as ChatRecoveryDigestId,
    updatedAt,
    activeRecoveryIds,
    successfulRecoveryIds,
    failedRecoveryIds,
    strongestSuccessBand,
    strongestOutcomeKind,
  };
}

export function scoreRecoveryOption(option: ChatRecoveryOption): Score100 {
  const score =
    Number(option.confidence01) * 45 +
    Number(option.expectedStabilityLift01) * 35 +
    Number(option.expectedEmbarrassmentReduction01) * 20 -
    (option.requiresHelper ? 6 : 0) -
    (option.requiresCounterWindowOpen ? 8 : 0);
  return toScore100(score);
}

export function sortRecoveryOptions(
  options: readonly ChatRecoveryOption[],
): readonly ChatRecoveryOption[] {
  return [...options].sort((left, right) => {
    const scoreDelta = Number(scoreRecoveryOption(right)) - Number(scoreRecoveryOption(left));
    if (scoreDelta !== 0) return scoreDelta;
    return compareRecoveryDifficulty(left.difficulty, right.difficulty);
  });
}

export function choosePrimaryRecoveryOption(
  options: readonly ChatRecoveryOption[],
): ChatRecoveryOption | null {
  return sortRecoveryOptions(options)[0] ?? null;
}

export function shouldGrantVisibleRecoveryReceipt(
  outcome: ChatRecoveryOutcome,
  plan: ChatRecoveryPlan,
): boolean {
  return (
    (outcome.kind === 'RECOVERED' || outcome.kind === 'STABILIZED') &&
    plan.checkpoints.some((checkpoint) => checkpoint.grantsVisibleReceipt)
  );
}

export function deriveRecoveryLiftSnapshot(input: {
  readonly before: Pick<ChatAffectSnapshot, 'confidence' | 'frustration' | 'socialEmbarrassment' | 'trust'>;
  readonly after: Pick<ChatAffectSnapshot, 'confidence' | 'frustration' | 'socialEmbarrassment' | 'trust'>;
}): Pick<ChatRecoveryOutcome, 'stabilityLift01' | 'embarrassmentReduction01' | 'confidenceLift01' | 'trustLift01'> {
  return {
    stabilityLift01: toScore01(
      clamp01(
        (Number(input.after.confidence) - Number(input.before.confidence)) / 100 * 0.60 +
        (Number(input.before.frustration) - Number(input.after.frustration)) / 100 * 0.40,
      ),
    ),
    embarrassmentReduction01: toScore01(
      clamp01((Number(input.before.socialEmbarrassment) - Number(input.after.socialEmbarrassment)) / 100),
    ),
    confidenceLift01: toScore01(
      clamp01((Number(input.after.confidence) - Number(input.before.confidence)) / 100),
    ),
    trustLift01: toScore01(
      clamp01((Number(input.after.trust) - Number(input.before.trust)) / 100),
    ),
  };
}

export function recoveryPlanSupportsChannel(
  plan: Pick<ChatRecoveryPlan, 'visibleChannel'>,
): boolean {
  return channelSupportsRescue(plan.visibleChannel);
}

export function summarizeRecoveryPlan(plan: ChatRecoveryPlan): JsonObject {
  const primary = choosePrimaryRecoveryOption(plan.bundle.options);
  return {
    recoveryId: plan.recoveryId,
    kind: plan.kind,
    entryPoint: plan.entryPoint,
    visibleChannel: plan.visibleChannel,
    helperPosture: plan.helperPosture,
    optionCount: plan.bundle.options.length,
    primaryOptionId: primary?.optionId ?? null,
    primaryOptionKind: primary?.kind ?? null,
    checkpointCount: plan.checkpoints.length,
    createdAt: plan.createdAt,
  };
}

export const CHAT_RECOVERY_CONTRACT = Object.freeze({
  version: CHAT_RECOVERY_CONTRACT_VERSION,
  revision: CHAT_RECOVERY_CONTRACT_REVISION,
  publicApiVersion: CHAT_RECOVERY_PUBLIC_API_VERSION,
  authorities: CHAT_RECOVERY_AUTHORITIES,
  kinds: CHAT_RECOVERY_KINDS,
  paces: CHAT_RECOVERY_PACES,
  optionKinds: CHAT_RECOVERY_OPTION_KINDS,
  difficultyBands: CHAT_RECOVERY_DIFFICULTY_BANDS,
  outcomes: CHAT_RECOVERY_OUTCOMES,
  entryPoints: CHAT_RECOVERY_ENTRY_POINTS,
  visibility: CHAT_RECOVERY_VISIBILITY,
  suggestionModes: CHAT_RECOVERY_SUGGESTION_MODES,
  successBands: CHAT_RECOVERY_SUCCESS_BANDS,
} as const);
export const CHAT_RECOVERY_CONTRACT_DESCRIPTOR = CHAT_RECOVERY_CONTRACT;
