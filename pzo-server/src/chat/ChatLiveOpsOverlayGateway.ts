/**
 * ============================================================================
 * POINT ZERO ONE — CHAT LIVEOPS OVERLAY GATEWAY
 * FILE: pzo-server/src/chat/ChatLiveOpsOverlayGateway.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Lightweight server-side fanout helper for seasonal/liveops chat overlays.
 *
 * This gateway is transport-agnostic. It does not know Socket.IO, ws, SSE, or
 * any specific adapter. It only knows sessions, rooms, and payload emission.
 * ============================================================================
 */

import type { ChatLiveOpsOverlaySnapshot } from '../../../shared/contracts/chat/liveops';

export interface ChatLiveOpsOverlayEmitter {
  emitToSession(sessionId: string, event: string, payload: unknown): void;
}

export interface ChatLiveOpsOverlaySessionBinding {
  readonly sessionId: string;
  readonly roomId: string;
}

export class ChatLiveOpsOverlayGateway {
  private readonly bindings = new Map<string, ChatLiveOpsOverlaySessionBinding>();

  constructor(private readonly emitter: ChatLiveOpsOverlayEmitter) {}

  bindSession(binding: ChatLiveOpsOverlaySessionBinding): void {
    this.bindings.set(binding.sessionId, binding);
  }

  unbindSession(sessionId: string): void {
    this.bindings.delete(sessionId);
  }

  publishToRoom(roomId: string, snapshot: ChatLiveOpsOverlaySnapshot): void {
    for (const binding of this.bindings.values()) {
      if (binding.roomId !== roomId) continue;
      this.emitter.emitToSession(binding.sessionId, 'chat:liveops-overlay', snapshot);
    }
  }
}
