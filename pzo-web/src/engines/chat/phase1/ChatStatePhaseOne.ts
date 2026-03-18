/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT STATE PHASE 1 EXTENSION
 * FILE: pzo-web/src/engines/chat/phase1/ChatStatePhaseOne.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Additive state slice helpers for Phase 1 novelty + episodic memory.
 * This file does not overwrite the existing ChatState model. It augments it.
 * ============================================================================
 */

import type {
  ChatEngineState,
  ChatFeatureSnapshot,
  ChatMessage,
  ChatVisibleChannel,
  UnixMs,
} from '../types';

import type {
  ChatNoveltyLedgerFatigue,
  ChatNoveltyLedgerSnapshot,
} from '../intelligence/ChatNoveltyLedger';

import type {
  ChatEpisodicMemorySnapshot,
} from '../intelligence/ChatEpisodicMemory';

export interface ChatConversationalFingerprint {
  readonly impulsive01: number;
  readonly patient01: number;
  readonly greedy01: number;
  readonly defensive01: number;
  readonly bluffHeavy01: number;
  readonly literal01: number;
  readonly comebackProne01: number;
  readonly collapseProne01: number;
  readonly publicPerformer01: number;
  readonly silentOperator01: number;
  readonly procedureAware01: number;
  readonly noveltySeeking01: number;
  readonly stabilitySeeking01: number;
  readonly updatedAt: UnixMs;
}

export interface ChatPhaseOneStateSlice {
  readonly noveltyLedger?: ChatNoveltyLedgerSnapshot;
  readonly episodicMemory?: ChatEpisodicMemorySnapshot;
  readonly semanticFatigueByChannel: Readonly<Record<ChatVisibleChannel, number>>;
  readonly conversationalFingerprint: ChatConversationalFingerprint;
  readonly unresolvedCallbackIds: readonly string[];
  readonly lastBridgeSyncAt?: UnixMs;
  readonly lastCarryoverSummary?: string;
  readonly lastNoveltyRecommendedCandidateId?: string;
}

export type ChatEngineStateWithPhaseOne = ChatEngineState & {
  readonly phaseOne?: ChatPhaseOneStateSlice;
};

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

export function createDefaultConversationalFingerprint(now: UnixMs = Date.now() as UnixMs): ChatConversationalFingerprint {
  return {
    impulsive01: 0.20,
    patient01: 0.60,
    greedy01: 0.20,
    defensive01: 0.55,
    bluffHeavy01: 0.20,
    literal01: 0.60,
    comebackProne01: 0.45,
    collapseProne01: 0.10,
    publicPerformer01: 0.40,
    silentOperator01: 0.50,
    procedureAware01: 0.50,
    noveltySeeking01: 0.50,
    stabilitySeeking01: 0.50,
    updatedAt: now,
  };
}

export function createDefaultChatPhaseOneStateSlice(now: UnixMs = Date.now() as UnixMs): ChatPhaseOneStateSlice {
  return {
    noveltyLedger: undefined,
    episodicMemory: undefined,
    semanticFatigueByChannel: {
      GLOBAL: 0,
      SYNDICATE: 0,
      DEAL_ROOM: 0,
      LOBBY: 0,
    },
    conversationalFingerprint: createDefaultConversationalFingerprint(now),
    unresolvedCallbackIds: [],
    lastBridgeSyncAt: undefined,
    lastCarryoverSummary: undefined,
    lastNoveltyRecommendedCandidateId: undefined,
  };
}

export function getPhaseOneState(state: ChatEngineStateWithPhaseOne): ChatPhaseOneStateSlice {
  return state.phaseOne ?? createDefaultChatPhaseOneStateSlice();
}

export function withPhaseOneState(
  state: ChatEngineState,
  phaseOne: ChatPhaseOneStateSlice,
): ChatEngineStateWithPhaseOne {
  return {
    ...(state as ChatEngineStateWithPhaseOne),
    phaseOne: {
      ...phaseOne,
      semanticFatigueByChannel: { ...phaseOne.semanticFatigueByChannel },
      conversationalFingerprint: { ...phaseOne.conversationalFingerprint },
      unresolvedCallbackIds: [...phaseOne.unresolvedCallbackIds],
    },
  };
}

export function setPhaseOneNoveltyLedgerInState(
  state: ChatEngineStateWithPhaseOne,
  noveltyLedger: ChatNoveltyLedgerSnapshot | undefined,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatEngineStateWithPhaseOne {
  const phaseOne = getPhaseOneState(state);
  const next = {
    ...phaseOne,
    noveltyLedger,
    semanticFatigueByChannel: noveltyLedger
      ? mergeFatigueByChannel(phaseOne.semanticFatigueByChannel, noveltyLedger.fatigueByChannel)
      : phaseOne.semanticFatigueByChannel,
    lastBridgeSyncAt: syncedAt,
  };
  return withPhaseOneState(state, next);
}

export function setPhaseOneEpisodicMemoryInState(
  state: ChatEngineStateWithPhaseOne,
  episodicMemory: ChatEpisodicMemorySnapshot | undefined,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatEngineStateWithPhaseOne {
  const phaseOne = getPhaseOneState(state);
  const next = {
    ...phaseOne,
    episodicMemory,
    unresolvedCallbackIds: episodicMemory?.unresolvedMemoryIds ?? phaseOne.unresolvedCallbackIds,
    lastCarryoverSummary: episodicMemory?.lastCarryoverSummary ?? phaseOne.lastCarryoverSummary,
    lastBridgeSyncAt: syncedAt,
  };
  return withPhaseOneState(state, next);
}

export function setPhaseOneRecommendedCandidateIdInState(
  state: ChatEngineStateWithPhaseOne,
  candidateId?: string,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatEngineStateWithPhaseOne {
  const phaseOne = getPhaseOneState(state);
  return withPhaseOneState(state, {
    ...phaseOne,
    lastNoveltyRecommendedCandidateId: candidateId,
    lastBridgeSyncAt: syncedAt,
  });
}

export function setSemanticFatigueInState(
  state: ChatEngineStateWithPhaseOne,
  channelId: ChatVisibleChannel,
  fatigue01: number,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatEngineStateWithPhaseOne {
  const phaseOne = getPhaseOneState(state);
  return withPhaseOneState(state, {
    ...phaseOne,
    semanticFatigueByChannel: {
      ...phaseOne.semanticFatigueByChannel,
      [channelId]: clamp01(fatigue01),
    },
    lastBridgeSyncAt: syncedAt,
  });
}

export function applyConversationalFingerprintDeltaInState(
  state: ChatEngineStateWithPhaseOne,
  delta: Partial<Omit<ChatConversationalFingerprint, 'updatedAt'>>,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatEngineStateWithPhaseOne {
  const phaseOne = getPhaseOneState(state);
  const current = phaseOne.conversationalFingerprint;
  const nextFingerprint: ChatConversationalFingerprint = {
    impulsive01: clamp01(delta.impulsive01 ?? current.impulsive01),
    patient01: clamp01(delta.patient01 ?? current.patient01),
    greedy01: clamp01(delta.greedy01 ?? current.greedy01),
    defensive01: clamp01(delta.defensive01 ?? current.defensive01),
    bluffHeavy01: clamp01(delta.bluffHeavy01 ?? current.bluffHeavy01),
    literal01: clamp01(delta.literal01 ?? current.literal01),
    comebackProne01: clamp01(delta.comebackProne01 ?? current.comebackProne01),
    collapseProne01: clamp01(delta.collapseProne01 ?? current.collapseProne01),
    publicPerformer01: clamp01(delta.publicPerformer01 ?? current.publicPerformer01),
    silentOperator01: clamp01(delta.silentOperator01 ?? current.silentOperator01),
    procedureAware01: clamp01(delta.procedureAware01 ?? current.procedureAware01),
    noveltySeeking01: clamp01(delta.noveltySeeking01 ?? current.noveltySeeking01),
    stabilitySeeking01: clamp01(delta.stabilitySeeking01 ?? current.stabilitySeeking01),
    updatedAt: syncedAt,
  };

  return withPhaseOneState(state, {
    ...phaseOne,
    conversationalFingerprint: nextFingerprint,
    lastBridgeSyncAt: syncedAt,
  });
}

export function notePhaseOneCarryoverSummaryInState(
  state: ChatEngineStateWithPhaseOne,
  summary: string | undefined,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatEngineStateWithPhaseOne {
  const phaseOne = getPhaseOneState(state);
  return withPhaseOneState(state, {
    ...phaseOne,
    lastCarryoverSummary: summary,
    lastBridgeSyncAt: syncedAt,
  });
}

export function phaseOneFeatureOverlay(
  state: ChatEngineStateWithPhaseOne,
  base: ChatFeatureSnapshot,
): ChatFeatureSnapshot & {
  readonly semanticFatigue01: number;
  readonly unresolvedCallbacks: number;
  readonly noveltySeeking01: number;
  readonly stabilitySeeking01: number;
} {
  const phaseOne = getPhaseOneState(state);
  return {
    ...base,
    semanticFatigue01: phaseOne.semanticFatigueByChannel[base.activeChannel as ChatVisibleChannel] ?? 0,
    unresolvedCallbacks: phaseOne.unresolvedCallbackIds.length,
    noveltySeeking01: phaseOne.conversationalFingerprint.noveltySeeking01,
    stabilitySeeking01: phaseOne.conversationalFingerprint.stabilitySeeking01,
  };
}

export function serializePhaseOneStateSlice(
  state: ChatEngineStateWithPhaseOne,
): ChatPhaseOneStateSlice | undefined {
  const phaseOne = state.phaseOne;
  if (!phaseOne) return undefined;
  return {
    ...phaseOne,
    noveltyLedger: phaseOne.noveltyLedger
      ? {
          ...phaseOne.noveltyLedger,
          recentEvents: phaseOne.noveltyLedger.recentEvents.map((item) => ({ ...item })),
          lineCounters: [...phaseOne.noveltyLedger.lineCounters],
          motifCounters: [...phaseOne.noveltyLedger.motifCounters],
          rhetoricalCounters: [...phaseOne.noveltyLedger.rhetoricalCounters],
          semanticCounters: [...phaseOne.noveltyLedger.semanticCounters],
          sceneRoleCounters: [...phaseOne.noveltyLedger.sceneRoleCounters],
          counterpartCounters: [...phaseOne.noveltyLedger.counterpartCounters],
          callbackCounters: [...phaseOne.noveltyLedger.callbackCounters],
          channelCounters: [...phaseOne.noveltyLedger.channelCounters],
          fatigueByChannel: [...phaseOne.noveltyLedger.fatigueByChannel],
        }
      : undefined,
    episodicMemory: phaseOne.episodicMemory
      ? {
          ...phaseOne.episodicMemory,
          activeMemories: phaseOne.episodicMemory.activeMemories.map((item) => ({ ...item, callbackVariants: [...item.callbackVariants] })),
          archivedMemories: phaseOne.episodicMemory.archivedMemories.map((item) => ({ ...item, callbackVariants: [...item.callbackVariants] })),
          unresolvedMemoryIds: [...phaseOne.episodicMemory.unresolvedMemoryIds],
        }
      : undefined,
    semanticFatigueByChannel: { ...phaseOne.semanticFatigueByChannel },
    conversationalFingerprint: { ...phaseOne.conversationalFingerprint },
    unresolvedCallbackIds: [...phaseOne.unresolvedCallbackIds],
  };
}

export function hydratePhaseOneStateSlice(
  raw: unknown,
  now: UnixMs = Date.now() as UnixMs,
): ChatPhaseOneStateSlice {
  if (!raw || typeof raw !== 'object') return createDefaultChatPhaseOneStateSlice(now);
  const value = raw as Partial<ChatPhaseOneStateSlice>;
  return {
    noveltyLedger: value.noveltyLedger,
    episodicMemory: value.episodicMemory,
    semanticFatigueByChannel: {
      GLOBAL: clamp01(value.semanticFatigueByChannel?.GLOBAL ?? 0),
      SYNDICATE: clamp01(value.semanticFatigueByChannel?.SYNDICATE ?? 0),
      DEAL_ROOM: clamp01(value.semanticFatigueByChannel?.DEAL_ROOM ?? 0),
      LOBBY: clamp01(value.semanticFatigueByChannel?.LOBBY ?? 0),
    },
    conversationalFingerprint: {
      ...createDefaultConversationalFingerprint(now),
      ...(value.conversationalFingerprint ?? {}),
      updatedAt: value.conversationalFingerprint?.updatedAt ?? now,
    },
    unresolvedCallbackIds: [...(value.unresolvedCallbackIds ?? [])],
    lastBridgeSyncAt: value.lastBridgeSyncAt,
    lastCarryoverSummary: value.lastCarryoverSummary,
    lastNoveltyRecommendedCandidateId: value.lastNoveltyRecommendedCandidateId,
  };
}

function mergeFatigueByChannel(
  base: Readonly<Record<ChatVisibleChannel, number>>,
  fatigueByChannel: readonly ChatNoveltyLedgerFatigue[],
): Readonly<Record<ChatVisibleChannel, number>> {
  const next: Record<ChatVisibleChannel, number> = {
    GLOBAL: base.GLOBAL ?? 0,
    SYNDICATE: base.SYNDICATE ?? 0,
    DEAL_ROOM: base.DEAL_ROOM ?? 0,
    LOBBY: base.LOBBY ?? 0,
  };

  for (const fatigue of fatigueByChannel) {
    if (fatigue.channelId === 'GLOBAL' || fatigue.channelId === 'SYNDICATE' || fatigue.channelId === 'DEAL_ROOM' || fatigue.channelId === 'LOBBY') {
      next[fatigue.channelId] = clamp01(fatigue.fatigue01);
    }
  }

  return next;
}
