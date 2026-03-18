/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT BOT PERSONA EVOLUTION SERVICE
 * FILE: backend/src/game/engine/chat/npc/ChatBotPersonaEvolutionService.ts
 * ============================================================================
 */

import type {
  ChatPersonaEvolutionEvent,
  ChatPersonaEvolutionSignal,
  ChatPersonaEvolutionSnapshot,
} from '../../../../../../shared/contracts/chat/persona-evolution';
import type { ChatPlayerFingerprintSnapshot } from '../../../../../../shared/contracts/chat/player-fingerprint';
import type { ChatLiveOpsOverlayContext } from '../../../../../../shared/contracts/chat/liveops';
import type { ChatRelationshipSummaryView } from '../../../../../../shared/contracts/chat/relationship';
import {
  ChatBotPersonaEvolution,
  type ChatBotPersonaEvolutionProjectionRequest,
} from '../../../../../../pzo-web/src/engines/chat/npc/ChatBotPersonaEvolution';

export class ChatBotPersonaEvolutionService {
  private readonly runtime = new ChatBotPersonaEvolution();

  observe(event: ChatPersonaEvolutionEvent) {
    return this.runtime.observe(event);
  }

  project(input: {
    readonly botId: string;
    readonly playerId?: string | null;
    readonly now: number;
    readonly channelId?: string | null;
    readonly fingerprint?: ChatPlayerFingerprintSnapshot | null;
    readonly relationship?: ChatRelationshipSummaryView | null;
    readonly overlay?: ChatLiveOpsOverlayContext | null;
  }): ChatPersonaEvolutionSignal {
    const request: ChatBotPersonaEvolutionProjectionRequest = input;
    return this.runtime.project(request);
  }

  getSnapshot(now = Date.now()): ChatPersonaEvolutionSnapshot {
    return this.runtime.getSnapshot(now);
  }
}

export function createChatBotPersonaEvolutionService(): ChatBotPersonaEvolutionService {
  return new ChatBotPersonaEvolutionService();
}
