/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT STATE PHASE 2 EXTENSION
 * FILE: pzo-web/src/engines/chat/phase2/ChatStatePhaseTwo.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Additive state slice helpers for Phase 2 relationship evolution.
 * This file augments the existing frontend ChatEngineState without requiring a
 * full reducer rewrite.
 * ============================================================================
 */

import type { ChatEngineState, ChatVisibleChannel, UnixMs } from '../types';

import type {
  ChatRelationshipLegacyProjection,
  ChatRelationshipSnapshot,
  ChatRelationshipSummaryView,
} from '../../../../../shared/contracts/chat/relationship';

export interface ChatPhaseTwoCounterpartProjection {
  readonly counterpartId: string;
  readonly summary: ChatRelationshipSummaryView;
  readonly legacy: ChatRelationshipLegacyProjection;
}

export interface ChatPhaseTwoStateSlice {
  readonly relationshipSnapshot?: ChatRelationshipSnapshot;
  readonly counterpartProjectionsById: Readonly<Record<string, ChatPhaseTwoCounterpartProjection>>;
  readonly focusedCounterpartByChannel: Readonly<Record<ChatVisibleChannel, string | undefined>>;
  readonly relationshipHeatByCounterpartId: Readonly<Record<string, number>>;
  readonly lastPhaseTwoSyncAt?: UnixMs;
}

export type ChatEngineStateWithPhaseTwo = ChatEngineState & {
  readonly phaseTwo?: ChatPhaseTwoStateSlice;
};

export function createDefaultChatPhaseTwoStateSlice(): ChatPhaseTwoStateSlice {
  return {
    relationshipSnapshot: undefined,
    counterpartProjectionsById: {},
    focusedCounterpartByChannel: {
      GLOBAL: undefined,
      SYNDICATE: undefined,
      DEAL_ROOM: undefined,
      LOBBY: undefined,
    },
    relationshipHeatByCounterpartId: {},
    lastPhaseTwoSyncAt: undefined,
  };
}

export function getPhaseTwoState(state: ChatEngineStateWithPhaseTwo): ChatPhaseTwoStateSlice {
  return state.phaseTwo ?? createDefaultChatPhaseTwoStateSlice();
}

export function withPhaseTwoState(
  state: ChatEngineState,
  phaseTwo: ChatPhaseTwoStateSlice,
): ChatEngineStateWithPhaseTwo {
  return {
    ...(state as ChatEngineStateWithPhaseTwo),
    phaseTwo: {
      ...phaseTwo,
      counterpartProjectionsById: { ...phaseTwo.counterpartProjectionsById },
      focusedCounterpartByChannel: { ...phaseTwo.focusedCounterpartByChannel },
      relationshipHeatByCounterpartId: { ...phaseTwo.relationshipHeatByCounterpartId },
    },
  };
}

export function setPhaseTwoRelationshipSnapshotInState(
  state: ChatEngineStateWithPhaseTwo,
  relationshipSnapshot: ChatRelationshipSnapshot | undefined,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatEngineStateWithPhaseTwo {
  const phaseTwo = getPhaseTwoState(state);
  return withPhaseTwoState(state, {
    ...phaseTwo,
    relationshipSnapshot,
    lastPhaseTwoSyncAt: syncedAt,
  });
}

export function setPhaseTwoCounterpartProjectionsInState(
  state: ChatEngineStateWithPhaseTwo,
  projections: readonly ChatPhaseTwoCounterpartProjection[],
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatEngineStateWithPhaseTwo {
  const phaseTwo = getPhaseTwoState(state);
  return withPhaseTwoState(state, {
    ...phaseTwo,
    counterpartProjectionsById: Object.fromEntries(
      projections.map((projection) => [projection.counterpartId, projection]),
    ),
    relationshipHeatByCounterpartId: Object.fromEntries(
      projections.map((projection) => [projection.counterpartId, projection.summary.intensity01]),
    ),
    lastPhaseTwoSyncAt: syncedAt,
  });
}

export function setPhaseTwoFocusedCounterpartInState(
  state: ChatEngineStateWithPhaseTwo,
  channelId: ChatVisibleChannel,
  counterpartId: string | undefined,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatEngineStateWithPhaseTwo {
  const phaseTwo = getPhaseTwoState(state);
  return withPhaseTwoState(state, {
    ...phaseTwo,
    focusedCounterpartByChannel: {
      ...phaseTwo.focusedCounterpartByChannel,
      [channelId]: counterpartId,
    },
    lastPhaseTwoSyncAt: syncedAt,
  });
}
