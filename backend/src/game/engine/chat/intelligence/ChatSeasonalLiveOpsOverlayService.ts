/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT SEASONAL + LIVEOPS OVERLAY SERVICE
 * FILE: backend/src/game/engine/chat/intelligence/ChatSeasonalLiveOpsOverlayService.ts
 * ============================================================================
 */

import type {
  ChatLiveOpsOverlayContext,
  ChatLiveOpsOverlayDefinition,
  ChatLiveOpsOverlaySnapshot,
  ChatLiveOpsChannelId,
} from '../../../../../../shared/contracts/chat/liveops';
import {
  ChatSeasonalLiveOpsOverlay,
  type ChatSeasonalOverlayResolveRequest,
} from '../../../../../../pzo-web/src/engines/chat/intelligence/ChatSeasonalLiveOpsOverlay';

export class ChatSeasonalLiveOpsOverlayService {
  private readonly runtime = new ChatSeasonalLiveOpsOverlay();

  upsert(definition: ChatLiveOpsOverlayDefinition): void {
    this.runtime.upsert(definition);
  }

  upsertMany(definitions: readonly ChatLiveOpsOverlayDefinition[]): void {
    this.runtime.upsertMany(definitions);
  }

  resolveContext(input: {
    readonly now: number;
    readonly channelId: ChatLiveOpsChannelId;
    readonly botId?: string | null;
    readonly tags?: readonly string[];
  }): readonly ChatLiveOpsOverlayContext[] {
    const request: ChatSeasonalOverlayResolveRequest = input;
    return this.runtime.resolveContext(request);
  }

  getSnapshot(now = Date.now()): ChatLiveOpsOverlaySnapshot {
    return this.runtime.getSnapshot(now);
  }
}

export function createChatSeasonalLiveOpsOverlayService(): ChatSeasonalLiveOpsOverlayService {
  return new ChatSeasonalLiveOpsOverlayService();
}
