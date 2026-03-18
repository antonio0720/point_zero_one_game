/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT PHASE 2 BRIDGE
 * FILE: backend/src/game/engine/chat/phase2/ChatEnginePhaseTwoBridge.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative backend bridge for relationship evolution. The backend owns the
 * truth, updates the relationship model on normalized events, and can project a
 * legacy-compatible relationship vector for existing clients while preserving a
 * richer Phase 2 snapshot for future transport.
 * ============================================================================
 */

import type { BotId, ChatMessage, ChatState, UnixMs } from '../types';

import { ChatRelationshipModel } from '../intelligence/ChatRelationshipModel';

import type { ChatEngineStateWithPhaseTwo } from './ChatStatePhaseTwo';
import {
  setPhaseTwoCounterpartProjectionsInState,
  setPhaseTwoRelationshipSnapshotInState,
} from './ChatStatePhaseTwo';

export interface ChatEnginePhaseTwoBridgeOptions {
  readonly playerId?: string | null;
  readonly now?: UnixMs;
}

export class ChatEnginePhaseTwoBridge {
  private readonly relationshipModel: ChatRelationshipModel;
  private hydrated = false;

  public constructor(options: ChatEnginePhaseTwoBridgeOptions = {}) {
    this.relationshipModel = new ChatRelationshipModel({
      playerId: options.playerId,
      now: options.now,
    });
  }

  public hydrateFromSnapshot(snapshot: ReturnType<ChatRelationshipModel['snapshot']>): void {
    this.relationshipModel.restore(snapshot);
    this.hydrated = true;
  }

  public notePlayerMessage(message: ChatMessage, counterpartId?: string, now: UnixMs = message.ts as UnixMs): void {
    this.relationshipModel.notePlayerMessage({
      counterpartId,
      channelId: message.channel,
      messageId: message.id,
      body: message.body,
      createdAt: now,
    });
  }

  public noteNpcMessage(
    input: {
      readonly counterpartId: string;
      readonly actorRole?: string | null;
      readonly botId?: BotId | string | null;
      readonly channelId?: string | null;
      readonly severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      readonly body: string;
    },
    now: UnixMs = Date.now() as UnixMs,
  ): void {
    this.relationshipModel.noteNpcUtterance({
      counterpartId: input.counterpartId,
      actorRole: input.actorRole,
      botId: input.botId,
      channelId: input.channelId,
      severity: input.severity,
      body: input.body,
      emittedAt: now,
    });
  }

  public noteGameEvent(eventType: string, channelId?: string, counterpartId?: string, now: UnixMs = Date.now() as UnixMs): void {
    this.relationshipModel.noteGameEvent({
      counterpartId,
      channelId,
      eventType,
      createdAt: now,
      summary: eventType,
    });
  }

  public buildSignal(counterpartId: string, actorRole?: string | null, channelId?: string | null, now: UnixMs = Date.now() as UnixMs) {
    return this.relationshipModel.buildNpcSignal({
      counterpartId,
      actorRole,
      channelId,
      now,
    });
  }

  public snapshot(now: UnixMs = Date.now() as UnixMs) {
    return this.relationshipModel.snapshot(now);
  }

  public syncIntoFrontendCompatibleState<T extends ChatEngineStateWithPhaseTwo>(state: T, now: UnixMs = Date.now() as UnixMs): T {
    const snapshot = this.relationshipModel.snapshot(now);
    const projections = this.relationshipModel.summaries().map((summary) => ({
      counterpartId: summary.counterpartId,
      summary,
      legacy: summary.legacy,
    }));

    let next = state;
    next = setPhaseTwoRelationshipSnapshotInState(next, snapshot, now) as T;
    next = setPhaseTwoCounterpartProjectionsInState(next, projections, now) as T;
    return next;
  }
}
