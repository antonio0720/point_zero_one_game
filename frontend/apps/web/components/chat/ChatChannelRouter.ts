/**
 * ChatChannelRouter.ts — PZO Sovereign Chat · Channel Routing
 * ─────────────────────────────────────────────────────────────────────────────
 * Routes messages to the correct channel with injection rules:
 *   - GLOBAL:    Everyone sees. Bots, NPCs, game events inject here.
 *   - SYNDICATE: Team-only (co-op mode). Private from opponents.
 *   - DM:        1:1 between two players. FULLY PRIVATE. No bot injection.
 *   - DEAL_ROOM: Negotiation channel. Immutable transcript. Proof hashes.
 *   - SPECTATOR: View-only for spectators watching a run.
 *
 * FILE LOCATION: frontend/apps/web/components/chat/ChatChannelRouter.ts
 * Density6 LLC · Point Zero One · Confidential
 */

import type { ChatChannel, ChatMessage, MessageKind } from './chatTypes';

// ─── Channel Configuration ───────────────────────────────────────────────────

interface ChannelConfig {
  id:                ChatChannel;
  label:             string;
  description:       string;
  allowPlayerMessages: boolean;
  allowBotInjection:   boolean;
  allowNPCInjection:   boolean;
  allowSystemEvents:   boolean;
  allowHelperTips:     boolean;
  isImmutable:         boolean;  // messages cannot be deleted
  requiresProofHash:   boolean;  // messages get hashed for integrity
  maxVisibleMessages:  number;
  availableInModes:    string[];  // which game modes have this channel
}

export const CHANNEL_CONFIGS: Record<ChatChannel, ChannelConfig> = {
  GLOBAL: {
    id: 'GLOBAL', label: 'GLOBAL', description: 'Everyone sees everything.',
    allowPlayerMessages: true, allowBotInjection: true, allowNPCInjection: true,
    allowSystemEvents: true, allowHelperTips: true,
    isImmutable: false, requiresProofHash: false, maxVisibleMessages: 200,
    availableInModes: ['solo', 'asymmetric-pvp', 'co-op', 'ghost'],
  },
  SYNDICATE: {
    id: 'SYNDICATE', label: 'SYNDICATE', description: 'Team-only. Private from opponents.',
    allowPlayerMessages: true, allowBotInjection: false, allowNPCInjection: true,
    allowSystemEvents: true, allowHelperTips: true,
    isImmutable: false, requiresProofHash: false, maxVisibleMessages: 150,
    availableInModes: ['co-op'],
  },
  DM: {
    id: 'DM', label: 'DM', description: 'Private messages. No bots. No game injection.',
    allowPlayerMessages: true, allowBotInjection: false, allowNPCInjection: false,
    allowSystemEvents: false, allowHelperTips: false,
    isImmutable: false, requiresProofHash: false, maxVisibleMessages: 100,
    availableInModes: ['solo', 'asymmetric-pvp', 'co-op', 'ghost'],
  },
  DEAL_ROOM: {
    id: 'DEAL_ROOM', label: 'DEAL ROOM', description: 'Negotiation. Immutable transcript.',
    allowPlayerMessages: true, allowBotInjection: false, allowNPCInjection: false,
    allowSystemEvents: true, allowHelperTips: false,
    isImmutable: true, requiresProofHash: true, maxVisibleMessages: 500,
    availableInModes: ['co-op', 'asymmetric-pvp'],
  },
  SPECTATOR: {
    id: 'SPECTATOR', label: 'SPECTATOR', description: 'View-only for spectators.',
    allowPlayerMessages: false, allowBotInjection: true, allowNPCInjection: true,
    allowSystemEvents: true, allowHelperTips: false,
    isImmutable: false, requiresProofHash: false, maxVisibleMessages: 100,
    availableInModes: ['solo', 'asymmetric-pvp', 'co-op', 'ghost'],
  },
};

// ─── Router Class ─────────────────────────────────────────────────────────────

export class ChatChannelRouter {
  private currentMode: string = 'solo';
  private activeChannels: Set<ChatChannel> = new Set(['GLOBAL']);
  private dmRecipients: Map<string, string> = new Map(); // recipientId → recipientName

  setMode(mode: string): void {
    this.currentMode = mode;
    this.activeChannels.clear();
    this.activeChannels.add('GLOBAL');

    for (const [channel, config] of Object.entries(CHANNEL_CONFIGS)) {
      if (config.availableInModes.includes(mode)) {
        this.activeChannels.add(channel as ChatChannel);
      }
    }
  }

  getAvailableChannels(): ChatChannel[] {
    return Array.from(this.activeChannels);
  }

  getChannelConfig(channel: ChatChannel): ChannelConfig {
    return CHANNEL_CONFIGS[channel];
  }

  /** Check if a message kind is allowed in a channel */
  canInject(channel: ChatChannel, kind: MessageKind): boolean {
    const config = CHANNEL_CONFIGS[channel];
    if (!config) return false;

    switch (kind) {
      case 'PLAYER':
      case 'PLAYER_RESPONSE':
        return config.allowPlayerMessages;
      case 'BOT_TAUNT':
      case 'BOT_ATTACK':
        return config.allowBotInjection;
      case 'SYSTEM':
      case 'MARKET_ALERT':
      case 'SHIELD_EVENT':
      case 'CASCADE_ALERT':
      case 'ACHIEVEMENT':
        return config.allowSystemEvents;
      case 'HELPER_TIP':
        return config.allowHelperTips;
      case 'DEAL_RECAP':
        return channel === 'DEAL_ROOM';
      default:
        return true;
    }
  }

  /** Route a message — returns the channel it should go to, or null if blocked */
  routeMessage(msg: ChatMessage): ChatChannel | null {
    if (!this.activeChannels.has(msg.channel)) return null;
    if (!this.canInject(msg.channel, msg.kind)) return null;
    return msg.channel;
  }

  /** Filter messages for a specific channel view */
  filterForChannel(messages: ChatMessage[], channel: ChatChannel): ChatMessage[] {
    return messages.filter(m => m.channel === channel);
  }

  /** Add a DM recipient */
  addDMRecipient(recipientId: string, recipientName: string): void {
    this.dmRecipients.set(recipientId, recipientName);
    this.activeChannels.add('DM');
  }

  getDMRecipients(): Map<string, string> {
    return new Map(this.dmRecipients);
  }

  /** Generate a proof hash for Deal Room messages */
  generateProofHash(message: ChatMessage): string {
    const payload = `${message.senderId}:${message.body}:${message.ts}`;
    // Simple hash for client-side — real implementation uses server-side crypto
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      const char = payload.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `pzo_${Math.abs(hash).toString(36)}_${message.ts.toString(36)}`;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const channelRouter = new ChatChannelRouter();
