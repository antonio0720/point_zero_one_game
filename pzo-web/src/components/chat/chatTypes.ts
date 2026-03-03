/**
 * chatTypes.ts — PZO Chat System Types · Engine-Integrated
 * Engine: battle/types · zero/types · pressure/types · shield/types
 * Scale: 20M concurrent
 * Density6 LLC · Point Zero One · Confidential
 */

import type { BotId, BotState, AttackType } from '../../engines/battle/types';
import type { PressureTier } from '../../engines/pressure/types';
import type { TickTier, RunOutcome } from '../../engines/zero/types';
import type { ShieldLayerId } from '../../engines/shield/types';
import type { CascadeSeverity } from '../../engines/cascade/types';

// ─── Channel ─────────────────────────────────────────────────────────────────

export type ChatChannel = 'GLOBAL' | 'SYNDICATE' | 'DEAL_ROOM';

// ─── Message kinds ────────────────────────────────────────────────────────────

export type MessageKind =
  | 'PLAYER'           // Real or NPC player message
  | 'SYSTEM'           // Phase bulletin / engine event
  | 'MARKET_ALERT'     // Regime change / pressure tier shift
  | 'ACHIEVEMENT'      // Card played / milestone
  | 'BOT_TAUNT'        // Engine-native hater bot dialogue (attackDialogue / retreatDialogue)
  | 'BOT_ATTACK'       // Bot attack event — shows layer targeted
  | 'SHIELD_EVENT'     // Layer breached / repaired / fortified
  | 'CASCADE_ALERT'    // Cascade chain triggered
  | 'DEAL_RECAP';      // Settlement hash card (Deal Room)

// ─── Bot taunt source (engine-native) ────────────────────────────────────────

export interface BotTauntSource {
  botId:      BotId;
  botName:    string;   // e.g. "THE LIQUIDATOR"
  botState:   BotState;
  attackType: AttackType;
  targetLayer?: ShieldLayerId;
  dialogue:   string;   // attackDialogue or retreatDialogue from BotProfileRegistry
  isRetreat:  boolean;
}

// ─── Shield event metadata ────────────────────────────────────────────────────

export interface ShieldEventMeta {
  layerId:    ShieldLayerId;
  integrity:  number;
  maxIntegrity: number;
  isBreached: boolean;
  attackId?:  string;
}

// ─── Cascade alert metadata ───────────────────────────────────────────────────

export interface CascadeAlertMeta {
  chainId:    string;
  severity:   CascadeSeverity;
  direction:  'NEGATIVE' | 'POSITIVE';
}

// ─── Chat message ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  id:          string;
  channel:     ChatChannel;
  kind:        MessageKind;
  senderId:    string;
  senderName:  string;
  senderRank?: string;        // "Managing Partner" | "Senior Partner" | etc.
  body:        string;
  emoji?:      string;
  ts:          number;        // Date.now()
  immutable?:  boolean;       // Deal Room transcript integrity
  proofHash?:  string;        // DEAL_RECAP only

  // Engine metadata — optional, for rich rendering
  botSource?:        BotTauntSource;
  shieldMeta?:       ShieldEventMeta;
  cascadeMeta?:      CascadeAlertMeta;
  pressureTier?:     PressureTier;
  tickTier?:         TickTier;
  runOutcome?:       RunOutcome;
}

// ─── Game context passed from App.tsx ────────────────────────────────────────

export interface GameChatContext {
  tick:          number;
  cash:          number;
  regime:        string;
  events:        string[];     // raw event log from App.tsx
  netWorth:      number;
  income:        number;
  expenses:      number;
  pressureTier?: PressureTier;
  tickTier?:     TickTier;
  haterHeat?:    number;       // 0–100 from BattleEngine
}

// ─── Sabotage event (from hater:sabotage socket + engine) ─────────────────────

export type SabotageCardType =
  | 'EMERGENCY_EXPENSE'
  | 'INCOME_SEIZURE'
  | 'DEBT_SPIRAL'
  | 'INSPECTION_NOTICE'
  | 'MARKET_CORRECTION'
  | 'TAX_AUDIT'
  | 'LAYOFF_EVENT'
  | 'RENT_HIKE'
  | 'CREDIT_DOWNGRADE'
  | 'SYSTEM_GLITCH';

export interface SabotageEvent {
  haterId:     string;
  cardType:    SabotageCardType;
  intensity:   number;
  haterName:   string;
  // Engine-native extensions
  botId?:      BotId;
  attackType?: AttackType;
  targetLayer?: ShieldLayerId;
}