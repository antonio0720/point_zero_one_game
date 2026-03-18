/** Thin shell kernel delegating to package runtime + shell adaptors. */
import type { ChatMessage, GameEventType } from './chatTypes';
import { buildAdaptiveMessages } from './AdaptiveDialogueEngine';
import { bridgeEventToMessages } from './GameEventChatBridge';

type Listener = (messages: ChatMessage[]) => void;

class SovereignChatKernel {
  private listeners = new Set<Listener>();

  onMessages(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(messages: ChatMessage[]) {
    if (!messages.length) return;
    for (const listener of this.listeners) listener(messages);
  }

  processPlayerMessage(body: string) {
    this.emit(buildAdaptiveMessages(body));
  }

  processGameEvent(type: GameEventType, payload: Record<string, unknown> = {}) {
    this.emit(bridgeEventToMessages(type, payload));
  }

  trackChatOpen() {}
  trackChatClose() {}
  updateGameContext(_context: unknown) {}
  getProfile() {
    return { dominantTone: 'UNKNOWN', messagesSent: 0, recentPressureMentions: 0, recentMoneyMentions: 0, recentBotMentions: 0 };
  }
}

export const chatKernel = new SovereignChatKernel();
