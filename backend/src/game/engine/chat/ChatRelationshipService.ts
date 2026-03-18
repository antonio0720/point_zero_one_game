/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT RELATIONSHIP SERVICE
 * FILE: backend/src/game/engine/chat/ChatRelationshipService.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Thin authoritative service wrapper around the backend relationship model so
 * future session persistence, transport sync, and liveops injection can target
 * one stable dependency rather than reaching into model internals.
 * ============================================================================
 */

import type { BotId, ChatMessage, UnixMs } from './types';
import { ChatRelationshipModel } from './intelligence/ChatRelationshipModel';

export interface ChatRelationshipServiceOptions {
  readonly playerId?: string | null;
  readonly now?: UnixMs;
}

export class ChatRelationshipService {
  private readonly model: ChatRelationshipModel;

  public constructor(options: ChatRelationshipServiceOptions = {}) {
    this.model = new ChatRelationshipModel({
      playerId: options.playerId,
      now: options.now,
    });
  }

  public getModel(): ChatRelationshipModel {
    return this.model;
  }

  public notePlayerMessage(message: ChatMessage, counterpartId?: string, now: UnixMs = message.ts as UnixMs): void {
    this.model.notePlayerMessage({
      counterpartId,
      channelId: message.channel,
      messageId: message.id,
      body: message.body,
      createdAt: now,
    });
  }

  public noteNpcMessage(input: {
    readonly counterpartId: string;
    readonly actorRole?: string | null;
    readonly botId?: BotId | string | null;
    readonly channelId?: string | null;
    readonly severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    readonly body: string;
    readonly now?: UnixMs;
  }): void {
    this.model.noteNpcUtterance({
      counterpartId: input.counterpartId,
      actorRole: input.actorRole,
      botId: input.botId,
      channelId: input.channelId,
      severity: input.severity,
      body: input.body,
      emittedAt: input.now,
    });
  }

  public noteGameEvent(eventType: string, channelId?: string, counterpartId?: string, now: UnixMs = Date.now() as UnixMs): void {
    this.model.noteGameEvent({
      counterpartId,
      channelId,
      eventType,
      createdAt: now,
      summary: eventType,
    });
  }
}
