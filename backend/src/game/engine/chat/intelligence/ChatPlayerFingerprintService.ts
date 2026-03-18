/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT PLAYER FINGERPRINT SERVICE
 * FILE: backend/src/game/engine/chat/intelligence/ChatPlayerFingerprintService.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Durable backend authority for player fingerprint aggregation.
 * ============================================================================
 */

import {
  type ChatPlayerCounterplayHint,
  type ChatPlayerFingerprintEvent,
  type ChatPlayerFingerprintSnapshot,
} from '../../../../../../shared/contracts/chat/player-fingerprint';
import {
  ChatPlayerFingerprintModel,
} from '../../../../../../pzo-web/src/engines/chat/intelligence/ChatPlayerFingerprintModel';

export class ChatPlayerFingerprintService {
  private readonly model = new ChatPlayerFingerprintModel({ tailSize: 160 });

  observe(event: ChatPlayerFingerprintEvent): ChatPlayerFingerprintSnapshot {
    return this.model.observe(event);
  }

  getSnapshot(playerId: string): ChatPlayerFingerprintSnapshot {
    return this.model.getSnapshot(playerId);
  }

  getCounterplayHint(playerId: string): ChatPlayerCounterplayHint {
    return this.model.getCounterplayHint(playerId);
  }
}

export function createChatPlayerFingerprintService(): ChatPlayerFingerprintService {
  return new ChatPlayerFingerprintService();
}
