/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT PHASE 2 BRIDGE
 * FILE: pzo-web/src/engines/chat/phase2/ChatNpcDirectorPhaseTwoBridge.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Bridge between the existing frontend ChatEngine / ChatNpcDirector flow and
 * the new Phase 2 relationship stack.
 *
 * Safe seams:
 * - hydrate from cached state
 * - note committed player message
 * - note emitted NPC message / plan
 * - note game-event context
 * - sync snapshot + legacy projections back into ChatEngineState
 * ============================================================================
 */

import type { ChatEngineState, ChatMessage, ChatVisibleChannel, UnixMs } from '../types';
import { upsertRelationshipInState } from '../ChatState';
import type { ChatNpcContext, ChatNpcPlan } from '../ChatNpcDirector';

import { ChatRelationshipModel } from '../intelligence/ChatRelationshipModel';

import {
  type ChatEngineStateWithPhaseTwo,
  type ChatPhaseTwoCounterpartProjection,
  getPhaseTwoState,
  setPhaseTwoCounterpartProjectionsInState,
  setPhaseTwoFocusedCounterpartInState,
  setPhaseTwoRelationshipSnapshotInState,
} from './ChatStatePhaseTwo';

export interface ChatNpcDirectorPhaseTwoBridgeOptions {
  readonly playerId?: string | null;
  readonly now?: UnixMs;
}

export class ChatNpcDirectorPhaseTwoBridge {
  private readonly relationshipModel: ChatRelationshipModel;
  private readonly playerId?: string | null;
  private hydrated = false;

  public constructor(options: ChatNpcDirectorPhaseTwoBridgeOptions = {}) {
    this.playerId = options.playerId ?? null;
    this.relationshipModel = new ChatRelationshipModel({
      playerId: this.playerId,
      now: options.now,
    });
  }

  public hydrateFromState(state: ChatEngineStateWithPhaseTwo): void {
    const phaseTwo = getPhaseTwoState(state);
    if (phaseTwo.relationshipSnapshot) {
      this.relationshipModel.restore(phaseTwo.relationshipSnapshot);
    }
    this.hydrated = true;
  }

  public ensureHydrated(state: ChatEngineStateWithPhaseTwo): void {
    if (this.hydrated) return;
    this.hydrateFromState(state);
  }

  public notePlayerMessage(
    state: ChatEngineStateWithPhaseTwo,
    message: ChatMessage,
    focusedCounterpartId?: string,
    now: UnixMs = message.ts as UnixMs,
  ): ChatEngineStateWithPhaseTwo {
    this.ensureHydrated(state);
    this.relationshipModel.notePlayerMessage({
      counterpartId: focusedCounterpartId,
      channelId: message.channel,
      messageId: message.id,
      body: message.body,
      createdAt: now,
    });
    return this.syncIntoState(state, now, message.channel, focusedCounterpartId);
  }

  public noteNpcPlan(
    state: ChatEngineStateWithPhaseTwo,
    plan: Pick<ChatNpcPlan, 'actorId' | 'actorRole' | 'channel' | 'body' | 'severity' | 'context' | 'metadata'>,
    now: UnixMs = Date.now() as UnixMs,
  ): ChatEngineStateWithPhaseTwo {
    this.ensureHydrated(state);
    this.relationshipModel.noteNpcUtterance({
      counterpartId: plan.actorId,
      actorRole: plan.actorRole,
      channelId: plan.channel,
      severity: plan.severity,
      body: plan.body,
      emittedAt: now,
    });
    return this.syncIntoState(state, now, plan.channel, plan.actorId);
  }

  public noteGameContext(
    state: ChatEngineStateWithPhaseTwo,
    context: ChatNpcContext | string,
    channelId?: ChatVisibleChannel,
    counterpartId?: string,
    now: UnixMs = Date.now() as UnixMs,
  ): ChatEngineStateWithPhaseTwo {
    this.ensureHydrated(state);
    this.relationshipModel.noteGameEvent({
      counterpartId,
      channelId,
      eventType: context,
      createdAt: now,
      summary: context,
    });
    return this.syncIntoState(state, now, channelId, counterpartId);
  }

  public syncIntoState(
    state: ChatEngineStateWithPhaseTwo,
    now: UnixMs = Date.now() as UnixMs,
    channelId?: ChatVisibleChannel,
    focusedCounterpartId?: string,
  ): ChatEngineStateWithPhaseTwo {
    this.ensureHydrated(state);

    const snapshot = this.relationshipModel.snapshot(now);
    const projections = this.relationshipModel.summaries().map((summary) => ({
      counterpartId: summary.counterpartId,
      summary,
      legacy: summary.legacy,
    })) as readonly ChatPhaseTwoCounterpartProjection[];

    let next = state;
    next = setPhaseTwoRelationshipSnapshotInState(next, snapshot, now);
    next = setPhaseTwoCounterpartProjectionsInState(next, projections, now);
    if (channelId) {
      next = setPhaseTwoFocusedCounterpartInState(
        next,
        channelId,
        focusedCounterpartId ?? this.relationshipModel.selectCounterpartFocus(channelId),
        now,
      );
    }

    for (const projection of projections) {
      next = upsertRelationshipInState(next as unknown as ChatEngineState, {
        relationshipId: `phase2:${projection.counterpartId}` as never,
        playerId: (this.playerId ?? 'player-local') as never,
        counterpartId: projection.counterpartId,
        counterpartKind: 'NPC' as never,
        vector: {
          respect: Math.round(projection.legacy.respect) as never,
          fear: Math.round(projection.legacy.fear) as never,
          contempt: Math.round(projection.legacy.contempt) as never,
          fascination: Math.round(projection.legacy.fascination) as never,
          trust: Math.round(projection.legacy.trust) as never,
          familiarity: Math.round(projection.legacy.familiarity) as never,
          rivalryIntensity: Math.round(projection.legacy.rivalryIntensity) as never,
          rescueDebt: Math.round(projection.legacy.rescueDebt) as never,
          adviceObedience: Math.round(projection.legacy.adviceObedience) as never,
        },
        lastMeaningfulShiftAt: now as never,
        callbacksAvailable: [] as never,
        escalationTier: projection.legacy.escalationTier as never,
      });
    }

    return next;
  }
}
