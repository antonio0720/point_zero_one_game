/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT INTERRUPTION CONTRACTS
 * FILE: shared/contracts/chat/ChatInterruption.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical interruption law for drama orchestration, silence control,
 * preemption, rescue overrides, crowd swarms, and negotiation cut-ins.
 *
 * Why this file exists
 * --------------------
 * The repo already has scene, relationship, and runtime drama primitives, but
 * interruption policy is still scattered between runtime timing choices,
 * channel mood, presence theater, and NPC response selection. This contract
 * makes interruption a first-class shared authority so frontend, backend, and
 * transport can agree on:
 *
 * 1. who is allowed to cut in,
 * 2. what they are allowed to preempt,
 * 3. when silence must be respected,
 * 4. when rescue or system authority overrides everything else,
 * 5. how interrupted beats are deferred instead of lost.
 *
 * Design doctrine
 * ---------------
 * - Interruption is not random chatter. It is authored pressure.
 * - Silence is a real beat and may be protected.
 * - Rescue, deal-room, system, and world-event authority are explicit.
 * - Crowd reactions are abundant but weak; system directives are rare but final.
 * - Frontend may simulate, backend decides durable truth.
 * ============================================================================
 */

import {
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_VERSION,
  type ChatActorKind,
  type ChatChannelId,
  type ChatMessageId,
  type ChatMomentId,
  type ChatPolicyTag,
  type ChatRelationshipId,
  type ChatSceneId,
  type JsonObject,
  type Score01,
  type UnixMs,
  channelIsShadowSurface,
  channelSupportsCrowdHeat,
  channelSupportsNegotiation,
  isChatChannelId,
} from './ChatChannels';
import {
  CHAT_MOMENT_TYPES,
  type ChatMomentType,
} from './ChatEvents';
import { type SharedChatSceneBeatType as ChatSceneBeatType } from './scene';

// ============================================================================
// MARK: Core enums and constants
// ============================================================================

export const CHAT_INTERRUPT_PRIORITIES = [
  'LOW',
  'NORMAL',
  'HIGH',
  'CRITICAL',
  'ABSOLUTE',
] as const;

export type ChatInterruptPriority = (typeof CHAT_INTERRUPT_PRIORITIES)[number];

export const CHAT_INTERRUPTION_CAUSES = [
  'SYSTEM_OVERRIDE',
  'RESCUE_OVERRIDE',
  'NEGOTIATION_COUNTER',
  'HATER_AMBUSH',
  'HELPER_INTERVENTION',
  'CROWD_SWARM',
  'WORLD_EVENT_OVERRIDE',
  'CALLBACK_REVEAL',
  'QUOTE_RECEIPT',
  'SCENE_BRANCH',
  'SILENCE_BREAK',
] as const;

export type ChatInterruptionCause = (typeof CHAT_INTERRUPTION_CAUSES)[number];

export const CHAT_INTERRUPTION_SURFACES = [
  'SCENE_BEAT',
  'SILENCE_WINDOW',
  'REVEAL_QUEUE',
  'NEGOTIATION_WINDOW',
  'PRESENCE_THEATER',
  'POST_RUN_RITUAL',
] as const;

export type ChatInterruptionSurface = (typeof CHAT_INTERRUPTION_SURFACES)[number];

export const CHAT_INTERRUPTION_OUTCOMES = [
  'ALLOW_NOW',
  'ALLOW_AND_CANCEL_CURRENT',
  'ALLOW_AND_DEFER_CURRENT',
  'QUEUE_FOR_LATER',
  'REJECT',
] as const;

export type ChatInterruptionOutcome = (typeof CHAT_INTERRUPTION_OUTCOMES)[number];

export const CHAT_INTERRUPTION_PROTECTIONS = [
  'NONE',
  'SOFT',
  'HARD',
  'ABSOLUTE',
] as const;

export type ChatInterruptionProtection = (typeof CHAT_INTERRUPTION_PROTECTIONS)[number];

export const CHAT_INTERRUPTIBLE_BEAT_TYPES = [
  'SYSTEM_NOTICE',
  'HATER_ENTRY',
  'CROWD_SWARM',
  'HELPER_INTERVENTION',
  'PLAYER_REPLY_WINDOW',
  'SILENCE',
  'REVEAL',
  'POST_BEAT_ECHO',
] as const satisfies readonly ChatSceneBeatType[];

export const CHAT_INTERRUPTION_CONTRACT_DESCRIPTOR = Object.freeze({
  file: 'shared/contracts/chat/ChatInterruption.ts',
  version: CHAT_CONTRACT_VERSION,
  authorities: CHAT_CONTRACT_AUTHORITIES,
  exports: Object.freeze({
    priorities: CHAT_INTERRUPT_PRIORITIES,
    causes: CHAT_INTERRUPTION_CAUSES,
    surfaces: CHAT_INTERRUPTION_SURFACES,
    protections: CHAT_INTERRUPTION_PROTECTIONS,
    outcomes: CHAT_INTERRUPTION_OUTCOMES,
  }),
} as const);

// ============================================================================
// MARK: Contract shapes
// ============================================================================

export interface ChatInterruptionCapability {
  readonly actorKind: ChatActorKind;
  readonly basePriority: ChatInterruptPriority;
  readonly canBreakSilence: boolean;
  readonly canPreemptCrowd: boolean;
  readonly canPreemptHelper: boolean;
  readonly canPreemptHater: boolean;
  readonly canPreemptNegotiationWindow: boolean;
  readonly canWriteShadowMarker: boolean;
  readonly protectedMoments?: readonly ChatMomentType[];
  readonly priorityByMoment?: Partial<Record<ChatMomentType, ChatInterruptPriority>>;
  readonly tags?: readonly ChatPolicyTag[];
}

export interface ChatInterruptionWindow {
  readonly windowId: string;
  readonly sceneId?: ChatSceneId;
  readonly momentId?: ChatMomentId;
  readonly channelId: ChatChannelId;
  readonly surface: ChatInterruptionSurface;
  readonly currentBeatType?: ChatSceneBeatType;
  readonly currentActorId?: string;
  readonly currentActorKind?: ChatActorKind;
  readonly opensAt: UnixMs;
  readonly closesAt?: UnixMs;
  readonly protection: ChatInterruptionProtection;
  readonly silenceProtected: boolean;
  readonly allowPlayerReply: boolean;
  readonly allowCrowdCutIn: boolean;
  readonly allowHelperCutIn: boolean;
  readonly allowHaterCutIn: boolean;
  readonly allowSystemCutIn: boolean;
  readonly metadata?: JsonObject;
  readonly tags?: readonly string[];
}

export interface ChatInterruptionCandidate {
  readonly candidateId: string;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly channelId: ChatChannelId;
  readonly requestedAt: UnixMs;
  readonly priority?: ChatInterruptPriority;
  readonly cause: ChatInterruptionCause;
  readonly summary: string;
  readonly sourceMessageId?: ChatMessageId;
  readonly sceneId?: ChatSceneId;
  readonly momentId?: ChatMomentId;
  readonly payloadRef?: string;
  readonly confidence01?: Score01;
  readonly relationshipIds?: readonly ChatRelationshipId[];
  readonly tags?: readonly string[];
  readonly metadata?: JsonObject;
}

export interface ChatInterruptionContext {
  readonly now: UnixMs;
  readonly channelId: ChatChannelId;
  readonly momentType?: ChatMomentType;
  readonly surface: ChatInterruptionSurface;
  readonly currentBeatType?: ChatSceneBeatType;
  readonly activeWindow?: ChatInterruptionWindow;
  readonly audienceHeat01?: Score01;
  readonly rescueRisk01?: Score01;
  readonly negotiationLocked?: boolean;
  readonly activeSilenceProtected?: boolean;
  readonly worldEventActive?: boolean;
  readonly branchPointActive?: boolean;
  readonly tags?: readonly string[];
}

export interface ChatInterruptionDecisionTrace {
  readonly candidateId: string;
  readonly accepted: boolean;
  readonly outcome: ChatInterruptionOutcome;
  readonly reason: string;
  readonly computedPriority: ChatInterruptPriority;
}

export interface ChatInterruptionDecision {
  readonly winner?: ChatInterruptionCandidate;
  readonly outcome: ChatInterruptionOutcome;
  readonly shouldBreakSilence: boolean;
  readonly shouldCancelCurrentBeat: boolean;
  readonly shouldDeferCurrentBeat: boolean;
  readonly deferredCandidateIds: readonly string[];
  readonly rejectedCandidateIds: readonly string[];
  readonly trace: readonly ChatInterruptionDecisionTrace[];
}

export interface ChatInterruptedBeatRecord {
  readonly recordId: string;
  readonly sceneId?: ChatSceneId;
  readonly momentId?: ChatMomentId;
  readonly channelId: ChatChannelId;
  readonly interruptedAt: UnixMs;
  readonly originalBeatType?: ChatSceneBeatType;
  readonly originalActorId?: string;
  readonly originalActorKind?: ChatActorKind;
  readonly interrupterActorId: string;
  readonly interrupterActorKind: ChatActorKind;
  readonly cause: ChatInterruptionCause;
  readonly outcome: ChatInterruptionOutcome;
  readonly resumeEligible: boolean;
  readonly payloadRef?: string;
  readonly tags?: readonly string[];
}

// ============================================================================
// MARK: Default capability law
// ============================================================================

export const CHAT_DEFAULT_INTERRUPTION_CAPABILITIES = Object.freeze<
  Readonly<Record<ChatActorKind, ChatInterruptionCapability>>
>({
  PLAYER: {
    actorKind: 'PLAYER',
    basePriority: 'NORMAL',
    canBreakSilence: false,
    canPreemptCrowd: false,
    canPreemptHelper: false,
    canPreemptHater: false,
    canPreemptNegotiationWindow: false,
    canWriteShadowMarker: false,
    protectedMoments: ['WORLD_EVENT'],
    priorityByMoment: {
      DEAL_TENSION: 'HIGH',
      HELPER_RESCUE: 'HIGH',
    },
  },
  SYSTEM: {
    actorKind: 'SYSTEM',
    basePriority: 'ABSOLUTE',
    canBreakSilence: true,
    canPreemptCrowd: true,
    canPreemptHelper: true,
    canPreemptHater: true,
    canPreemptNegotiationWindow: true,
    canWriteShadowMarker: true,
    priorityByMoment: Object.fromEntries(
      CHAT_MOMENT_TYPES.map((moment) => [moment, 'ABSOLUTE']),
    ) as Partial<Record<ChatMomentType, ChatInterruptPriority>>,
  },
  HATER: {
    actorKind: 'HATER',
    basePriority: 'HIGH',
    canBreakSilence: false,
    canPreemptCrowd: true,
    canPreemptHelper: false,
    canPreemptHater: false,
    canPreemptNegotiationWindow: false,
    canWriteShadowMarker: true,
    protectedMoments: ['HELPER_RESCUE'],
    priorityByMoment: {
      HATER_SWARM: 'CRITICAL',
      SHIELD_BREAK: 'CRITICAL',
      PRESSURE_SPIKE: 'HIGH',
      COMEBACK: 'HIGH',
      DEAL_TENSION: 'HIGH',
    } as Partial<Record<ChatMomentType, ChatInterruptPriority>>,
  },
  HELPER: {
    actorKind: 'HELPER',
    basePriority: 'HIGH',
    canBreakSilence: true,
    canPreemptCrowd: true,
    canPreemptHelper: false,
    canPreemptHater: true,
    canPreemptNegotiationWindow: false,
    canWriteShadowMarker: true,
    priorityByMoment: {
      HELPER_RESCUE: 'ABSOLUTE',
      SHIELD_BREAK: 'CRITICAL',
      HATER_SWARM: 'CRITICAL',
      RUN_END: 'HIGH',
      POST_RUN: 'HIGH',
    } as Partial<Record<ChatMomentType, ChatInterruptPriority>>,
  },
  AMBIENT_NPC: {
    actorKind: 'AMBIENT_NPC',
    basePriority: 'NORMAL',
    canBreakSilence: false,
    canPreemptCrowd: false,
    canPreemptHelper: false,
    canPreemptHater: false,
    canPreemptNegotiationWindow: false,
    canWriteShadowMarker: false,
    priorityByMoment: {
      RUN_START: 'NORMAL',
      RUN_END: 'NORMAL',
      WORLD_EVENT: 'HIGH',
    } as Partial<Record<ChatMomentType, ChatInterruptPriority>>,
  },
  CROWD: {
    actorKind: 'CROWD',
    basePriority: 'LOW',
    canBreakSilence: false,
    canPreemptCrowd: false,
    canPreemptHelper: false,
    canPreemptHater: false,
    canPreemptNegotiationWindow: false,
    canWriteShadowMarker: false,
    priorityByMoment: {
      COMEBACK: 'NORMAL',
      WORLD_EVENT: 'HIGH',
      SOVEREIGNTY_ACHIEVED: 'HIGH',
    } as Partial<Record<ChatMomentType, ChatInterruptPriority>>,
  },
  DEAL_AGENT: {
    actorKind: 'DEAL_AGENT',
    basePriority: 'HIGH',
    canBreakSilence: true,
    canPreemptCrowd: true,
    canPreemptHelper: false,
    canPreemptHater: true,
    canPreemptNegotiationWindow: true,
    canWriteShadowMarker: true,
    priorityByMoment: {
      DEAL_TENSION: 'ABSOLUTE',
      PRESSURE_SPIKE: 'HIGH',
      COMEBACK: 'NORMAL',
    } as Partial<Record<ChatMomentType, ChatInterruptPriority>>,
  },
  LIVEOPS: {
    actorKind: 'LIVEOPS',
    basePriority: 'CRITICAL',
    canBreakSilence: true,
    canPreemptCrowd: true,
    canPreemptHelper: true,
    canPreemptHater: true,
    canPreemptNegotiationWindow: true,
    canWriteShadowMarker: true,
    priorityByMoment: {
      WORLD_EVENT: 'ABSOLUTE',
      RUN_START: 'HIGH',
      RUN_END: 'HIGH',
      POST_RUN: 'CRITICAL',
    } as Partial<Record<ChatMomentType, ChatInterruptPriority>>,
  },
} as const);

// ============================================================================
// MARK: Priority helpers
// ============================================================================

const INTERRUPT_PRIORITY_RANK: Readonly<Record<ChatInterruptPriority, number>> =
  Object.freeze({
    LOW: 1,
    NORMAL: 2,
    HIGH: 3,
    CRITICAL: 4,
    ABSOLUTE: 5,
  });

function priorityRank(priority: ChatInterruptPriority): number {
  return INTERRUPT_PRIORITY_RANK[priority];
}

function clampScore01(value: number | undefined): Score01 {
  if (value == null || Number.isNaN(value)) {
    return 0 as Score01;
  }
  if (value <= 0) return 0 as Score01;
  if (value >= 1) return 1 as Score01;
  return Number(value.toFixed(6)) as Score01;
}

export function normalizeInterruptPriority(
  value: string | ChatInterruptPriority | undefined,
): ChatInterruptPriority {
  if (!value) return 'NORMAL';
  return (CHAT_INTERRUPT_PRIORITIES as readonly string[]).includes(value)
    ? (value as ChatInterruptPriority)
    : 'NORMAL';
}

export function compareInterruptPriority(
  left: ChatInterruptPriority,
  right: ChatInterruptPriority,
): number {
  return priorityRank(left) - priorityRank(right);
}

export function getInterruptionCapability(
  actorKind: ChatActorKind,
): ChatInterruptionCapability {
  return CHAT_DEFAULT_INTERRUPTION_CAPABILITIES[actorKind];
}

export function getInterruptionPriorityForMoment(input: {
  readonly actorKind: ChatActorKind;
  readonly momentType?: ChatMomentType;
  readonly fallback?: ChatInterruptPriority;
}): ChatInterruptPriority {
  const capability = getInterruptionCapability(input.actorKind);
  if (input.momentType && capability.priorityByMoment?.[input.momentType]) {
    return capability.priorityByMoment[input.momentType]!;
  }
  return input.fallback ?? capability.basePriority;
}

// ============================================================================
// MARK: Validation and eligibility
// ============================================================================

export function validateInterruptionWindow(
  window: ChatInterruptionWindow,
): readonly string[] {
  const issues: string[] = [];

  if (!isChatChannelId(window.channelId)) {
    issues.push(`Invalid channelId: ${window.channelId}`);
  }

  if (window.closesAt != null && window.closesAt < window.opensAt) {
    issues.push('closesAt cannot be earlier than opensAt.');
  }

  if (
    window.currentBeatType &&
    !(CHAT_INTERRUPTIBLE_BEAT_TYPES as readonly string[]).includes(window.currentBeatType)
  ) {
    issues.push(`Unsupported currentBeatType: ${window.currentBeatType}`);
  }

  return issues;
}

export function canCandidateInterrupt(input: {
  readonly candidate: ChatInterruptionCandidate;
  readonly context: ChatInterruptionContext;
  readonly window?: ChatInterruptionWindow;
}): boolean {
  const { candidate, context, window } = input;
  const capability = getInterruptionCapability(candidate.actorKind);

  if (!isChatChannelId(candidate.channelId)) return false;
  if (candidate.channelId !== context.channelId) return false;

  if (window) {
    if (window.channelId !== candidate.channelId) return false;
    if (window.protection === 'ABSOLUTE' && candidate.actorKind !== 'SYSTEM') {
      return false;
    }
    if (window.protection === 'HARD' && capability.basePriority !== 'ABSOLUTE') {
      if (candidate.actorKind !== 'SYSTEM' && candidate.actorKind !== 'LIVEOPS') {
        return false;
      }
    }
    if (window.silenceProtected && !capability.canBreakSilence) {
      return false;
    }
    if (window.surface === 'NEGOTIATION_WINDOW') {
      if (!capability.canPreemptNegotiationWindow && candidate.actorKind !== 'PLAYER') {
        return false;
      }
      if (!channelSupportsNegotiation(candidate.channelId)) {
        return false;
      }
    }
    if (!window.allowCrowdCutIn && candidate.actorKind === 'CROWD') return false;
    if (!window.allowHelperCutIn && candidate.actorKind === 'HELPER') return false;
    if (!window.allowHaterCutIn && candidate.actorKind === 'HATER') return false;
    if (!window.allowSystemCutIn && candidate.actorKind === 'SYSTEM') return false;
  }

  if (context.negotiationLocked && candidate.actorKind === 'CROWD') return false;
  if (context.activeSilenceProtected && !capability.canBreakSilence) return false;
  if (context.surface === 'PRESENCE_THEATER' && candidate.actorKind === 'CROWD') return false;

  if (channelIsShadowSurface(candidate.channelId) && !capability.canWriteShadowMarker) {
    return false;
  }

  if (candidate.actorKind === 'CROWD' && !channelSupportsCrowdHeat(candidate.channelId)) {
    return false;
  }

  if (
    candidate.actorKind === 'HELPER' &&
    context.momentType &&
    capability.protectedMoments?.includes(context.momentType) &&
    context.rescueRisk01 != null &&
    Number(context.rescueRisk01) < 0.25
  ) {
    return false;
  }

  return true;
}

// ============================================================================
// MARK: Selection
// ============================================================================

function computeCandidatePriority(input: {
  readonly candidate: ChatInterruptionCandidate;
  readonly context: ChatInterruptionContext;
}): ChatInterruptPriority {
  const explicit = normalizeInterruptPriority(input.candidate.priority);
  const momentPriority = getInterruptionPriorityForMoment({
    actorKind: input.candidate.actorKind,
    momentType: input.context.momentType,
    fallback: explicit,
  });

  if (priorityRank(explicit) > priorityRank(momentPriority)) {
    return explicit;
  }

  if (
    input.candidate.cause === 'RESCUE_OVERRIDE' &&
    input.context.rescueRisk01 != null &&
    Number(input.context.rescueRisk01) >= 0.7
  ) {
    return 'ABSOLUTE';
  }

  if (
    input.candidate.cause === 'WORLD_EVENT_OVERRIDE' &&
    input.context.worldEventActive
  ) {
    return 'ABSOLUTE';
  }

  return momentPriority;
}

function sortCandidates(
  candidates: readonly ChatInterruptionCandidate[],
  context: ChatInterruptionContext,
): readonly ChatInterruptionCandidate[] {
  return [...candidates].sort((left, right) => {
    const leftPriority = priorityRank(computeCandidatePriority({ candidate: left, context }));
    const rightPriority = priorityRank(computeCandidatePriority({ candidate: right, context }));
    if (leftPriority !== rightPriority) return rightPriority - leftPriority;

    const leftConfidence = Number(clampScore01(left.confidence01 as number | undefined));
    const rightConfidence = Number(clampScore01(right.confidence01 as number | undefined));
    if (leftConfidence !== rightConfidence) return rightConfidence - leftConfidence;

    if (left.requestedAt !== right.requestedAt) {
      return Number(left.requestedAt) - Number(right.requestedAt);
    }

    return left.candidateId.localeCompare(right.candidateId);
  });
}

export function resolveInterruptionDecision(input: {
  readonly candidates: readonly ChatInterruptionCandidate[];
  readonly context: ChatInterruptionContext;
  readonly window?: ChatInterruptionWindow;
}): ChatInterruptionDecision {
  const trace: ChatInterruptionDecisionTrace[] = [];
  const rejected: string[] = [];
  const deferred: string[] = [];

  const eligible = input.candidates.filter((candidate) => {
    const allowed = canCandidateInterrupt({
      candidate,
      context: input.context,
      window: input.window,
    });
    if (!allowed) {
      rejected.push(candidate.candidateId);
      trace.push({
        candidateId: candidate.candidateId,
        accepted: false,
        outcome: 'REJECT',
        reason: 'Candidate failed interruption eligibility law.',
        computedPriority: computeCandidatePriority({
          candidate,
          context: input.context,
        }),
      });
    }
    return allowed;
  });

  if (eligible.length === 0) {
    return {
      outcome: 'REJECT',
      shouldBreakSilence: false,
      shouldCancelCurrentBeat: false,
      shouldDeferCurrentBeat: false,
      deferredCandidateIds: deferred,
      rejectedCandidateIds: rejected,
      trace,
    };
  }

  const ranked = sortCandidates(eligible, input.context);
  const winner = ranked[0];
  const winnerPriority = computeCandidatePriority({
    candidate: winner,
    context: input.context,
  });

  for (const candidate of ranked) {
    const computedPriority = computeCandidatePriority({
      candidate,
      context: input.context,
    });
    const isWinner = candidate.candidateId === winner.candidateId;
    const outcome: ChatInterruptionOutcome = isWinner
      ? determineWinningOutcome({
          candidate,
          computedPriority,
          context: input.context,
          window: input.window,
        })
      : 'QUEUE_FOR_LATER';

    trace.push({
      candidateId: candidate.candidateId,
      accepted: isWinner,
      outcome,
      reason: isWinner
        ? 'Candidate won interruption arbitration.'
        : 'Candidate lost to a higher-ranked interrupter and was deferred.',
      computedPriority,
    });

    if (!isWinner) {
      deferred.push(candidate.candidateId);
    }
  }

  const winningOutcome = determineWinningOutcome({
    candidate: winner,
    computedPriority: winnerPriority,
    context: input.context,
    window: input.window,
  });

  return {
    winner,
    outcome: winningOutcome,
    shouldBreakSilence:
      Boolean(input.context.activeSilenceProtected) &&
      getInterruptionCapability(winner.actorKind).canBreakSilence,
    shouldCancelCurrentBeat:
      winningOutcome === 'ALLOW_AND_CANCEL_CURRENT' ||
      winningOutcome === 'ALLOW_NOW',
    shouldDeferCurrentBeat: winningOutcome === 'ALLOW_AND_DEFER_CURRENT',
    deferredCandidateIds: deferred,
    rejectedCandidateIds: rejected,
    trace,
  };
}

function determineWinningOutcome(input: {
  readonly candidate: ChatInterruptionCandidate;
  readonly computedPriority: ChatInterruptPriority;
  readonly context: ChatInterruptionContext;
  readonly window?: ChatInterruptionWindow;
}): ChatInterruptionOutcome {
  const capability = getInterruptionCapability(input.candidate.actorKind);

  if (
    input.computedPriority === 'ABSOLUTE' ||
    input.candidate.cause === 'SYSTEM_OVERRIDE' ||
    input.candidate.cause === 'WORLD_EVENT_OVERRIDE'
  ) {
    return 'ALLOW_AND_CANCEL_CURRENT';
  }

  if (
    input.window?.surface === 'NEGOTIATION_WINDOW' &&
    capability.canPreemptNegotiationWindow
  ) {
    return 'ALLOW_AND_CANCEL_CURRENT';
  }

  if (
    input.window?.currentBeatType === 'CROWD_SWARM' &&
    capability.canPreemptCrowd
  ) {
    return 'ALLOW_AND_CANCEL_CURRENT';
  }

  if (
    input.window?.currentBeatType === 'HELPER_INTERVENTION' &&
    capability.canPreemptHelper
  ) {
    return 'ALLOW_AND_CANCEL_CURRENT';
  }

  if (
    input.window?.currentBeatType === 'HATER_ENTRY' &&
    capability.canPreemptHater
  ) {
    return 'ALLOW_AND_CANCEL_CURRENT';
  }

  if (
    input.context.activeSilenceProtected &&
    capability.canBreakSilence
  ) {
    return 'ALLOW_AND_DEFER_CURRENT';
  }

  return 'ALLOW_NOW';
}

// ============================================================================
// MARK: Utility constructors
// ============================================================================

export function createInterruptionWindow(
  input: Omit<ChatInterruptionWindow, 'windowId'> & {
    readonly windowId?: string;
  },
): ChatInterruptionWindow {
  return Object.freeze({
    ...input,
    windowId:
      input.windowId ??
      [
        'interrupt-window',
        input.channelId,
        Number(input.opensAt),
        input.sceneId ?? 'no-scene',
        input.surface,
      ].join(':'),
  });
}

export function createInterruptedBeatRecord(
  input: Omit<ChatInterruptedBeatRecord, 'recordId'> & {
    readonly recordId?: string;
  },
): ChatInterruptedBeatRecord {
  return Object.freeze({
    ...input,
    recordId:
      input.recordId ??
      [
        'interrupt-record',
        input.channelId,
        Number(input.interruptedAt),
        input.interrupterActorId,
      ].join(':'),
  });
}

// ============================================================================
// MARK: End
// ============================================================================
