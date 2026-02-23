/**
 * chatTypes.ts — PZO Chat System Types
 * Shared across ChatPanel, useChatEngine, and App.tsx wire
 */

export type ChatChannel = 'GLOBAL' | 'SYNDICATE' | 'DEAL_ROOM';

export type MessageKind =
  | 'PLAYER'           // Real or NPC player message
  | 'SYSTEM'           // Phase bulletin / market event
  | 'MARKET_ALERT'     // Regime change broadcast
  | 'ACHIEVEMENT'      // Card played / big move
  | 'RIVAL_TAUNT'      // NPC rival trash talk
  | 'DEAL_RECAP';      // Settlement hash card

export interface ChatMessage {
  id:          string;
  channel:     ChatChannel;
  kind:        MessageKind;
  senderId:    string;
  senderName:  string;
  senderRank?: string;     // e.g. "Senior Partner" | "Managing Partner"
  body:        string;
  emoji?:      string;     // Lead emoji for system/alert messages
  ts:          number;     // Date.now()
  immutable?:  boolean;    // Deal Room — transcript integrity
  proofHash?:  string;     // Settlement Hash (DEAL_RECAP only)
}

/** Passed from App.tsx into ChatPanel so chat can react to game state */
export interface GameChatContext {
  tick:        number;
  cash:        number;
  regime:      string;
  events:      string[];   // raw event log from App.tsx
  netWorth:    number;
  income:      number;
  expenses:    number;
}
