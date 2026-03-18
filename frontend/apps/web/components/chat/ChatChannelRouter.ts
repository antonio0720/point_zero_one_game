/** Platform-shell channel policy. */
import type { ChatChannel } from './chatTypes';

class ChatChannelRouter {
  private mode = 'solo';
  setMode(mode: string) { this.mode = mode; }
  getAvailableChannels(isLobby = false): ChatChannel[] {
    const upper = this.mode.toUpperCase();
    if (isLobby) return ['GLOBAL', 'DIRECT', 'SPECTATOR'];
    if (upper.includes('SYNDICATE') || upper.includes('TEAM')) return ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'DIRECT'];
    if (upper.includes('PREDATOR') || upper.includes('HEAD')) return ['GLOBAL', 'DEAL_ROOM', 'DIRECT', 'SPECTATOR'];
    if (upper.includes('PHANTOM') || upper.includes('LEGEND')) return ['GLOBAL', 'DIRECT', 'SPECTATOR'];
    return ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'DIRECT', 'SPECTATOR'];
  }
}

export const channelRouter = new ChatChannelRouter();
