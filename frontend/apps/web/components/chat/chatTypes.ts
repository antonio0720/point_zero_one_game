/**
 * chatTypes.ts — PZO Sovereign Chat · Types v4 · Self-Contained
 * ─────────────────────────────────────────────────────────────────────────────
 * UPGRADED from pzo-web/src/components/chat/chatTypes.ts
 *
 * v4 CHANGES:
 *   - Self-contained: string literal types replace engine enum imports
 *     so this works in the Next.js app without the engine package.
 *   - New channels: DM, SPECTATOR added
 *   - New message kinds: HELPER_TIP, PLAYER_RESPONSE
 *   - Cold-start ML learning profile types
 *   - Player engagement signal types for adaptive learning
 *
 * FILE LOCATION: frontend/apps/web/components/chat/chatTypes.ts
 * Density6 LLC · Point Zero One · Confidential
 */

// ─── Engine type aliases (self-contained — no engine package imports) ─────────
// These mirror the engine enums but as string literals so the chat system
// can operate independently. When the engine package is extracted, these
// can be replaced with direct imports.

export type BotId =
  | 'BOT_01_LIQUIDATOR'
  | 'BOT_02_BUREAUCRAT'
  | 'BOT_03_MANIPULATOR'
  | 'BOT_04_CRASH_PROPHET'
  | 'BOT_05_LEGACY_HEIR';

export type BotState = 'IDLE' | 'STALKING' | 'ATTACKING' | 'RETREATING' | 'NEUTRALIZED';

export type AttackType =
  | 'ASSET_STRIP'
  | 'REGULATORY_ATTACK'
  | 'FINANCIAL_SABOTAGE'
  | 'EXPENSE_INJECTION'
  | 'OPPORTUNITY_KILL';

export type PressureTier = 'CALM' | 'BUILDING' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

export type TickTier = 'SOVEREIGN' | 'STABLE' | 'COMPRESSED' | 'CRISIS' | 'COLLAPSE_IMMINENT';

export type RunOutcome = 'SOVEREIGNTY' | 'BANKRUPTCY' | 'TIMEOUT' | 'ABANDONED';

export type ShieldLayerId = 'L1' | 'L2' | 'L3' | 'L4';

export type CascadeSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL' | 'CATASTROPHIC';

// ─── Channel ─────────────────────────────────────────────────────────────────

export type ChatChannel = 'GLOBAL' | 'SYNDICATE' | 'DEAL_ROOM' | 'DM' | 'SPECTATOR';

// ─── Message kinds ────────────────────────────────────────────────────────────

export type MessageKind =
  | 'PLAYER'            // Real or NPC player message
  | 'SYSTEM'            // Phase bulletin / engine event
  | 'MARKET_ALERT'      // Regime change / pressure tier shift
  | 'ACHIEVEMENT'       // Card played / milestone
  | 'BOT_TAUNT'         // Engine-native hater bot dialogue
  | 'BOT_ATTACK'        // Bot attack event — shows layer targeted
  | 'SHIELD_EVENT'      // Layer breached / repaired / fortified
  | 'CASCADE_ALERT'     // Cascade chain triggered
  | 'DEAL_RECAP'        // Settlement hash card (Deal Room)
  | 'HELPER_TIP'        // Helper character advice (Mentor, Insider, etc.)
  | 'PLAYER_RESPONSE';  // Player message that triggered a bot reaction

// ─── Bot taunt source (engine-native) ────────────────────────────────────────

export interface BotTauntSource {
  botId:       BotId;
  botName:     string;
  botState:    BotState;
  attackType:  AttackType;
  targetLayer?: ShieldLayerId;
  dialogue:    string;
  isRetreat:   boolean;
}

// ─── Shield event metadata ────────────────────────────────────────────────────

export interface ShieldEventMeta {
  layerId:       ShieldLayerId;
  integrity:     number;
  maxIntegrity:  number;
  isBreached:    boolean;
  attackId?:     string;
}

// ─── Cascade alert metadata ───────────────────────────────────────────────────

export interface CascadeAlertMeta {
  chainId:    string;
  severity:   CascadeSeverity;
  direction:  'NEGATIVE' | 'POSITIVE';
}

// ─── Chat message ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  id:            string;
  channel:       ChatChannel;
  kind:          MessageKind;
  senderId:      string;
  senderName:    string;
  senderRank?:   string;
  body:          string;
  emoji?:        string;
  ts:            number;
  immutable?:    boolean;
  proofHash?:    string;

  // Engine metadata — optional, for rich rendering
  botSource?:        BotTauntSource;
  shieldMeta?:       ShieldEventMeta;
  cascadeMeta?:      CascadeAlertMeta;
  pressureTier?:     PressureTier;
  tickTier?:         TickTier;
  runOutcome?:       RunOutcome;

  // DM metadata
  recipientId?:      string;
  recipientName?:    string;

  // ML metadata — for learning pipeline
  triggeredBy?:      string;   // messageId that caused this reaction
  sentimentSignal?:  string;   // what PlayerResponseClassifier detected
  wasAdapted?:       boolean;  // true if ML influenced this message
}

// ─── Game context ─────────────────────────────────────────────────────────────

export interface GameChatContext {
  tick:           number;
  cash:           number;
  regime:         string;
  events:         string[];
  netWorth:       number;
  income:         number;
  expenses:       number;
  pressureTier?:  PressureTier;
  tickTier?:      TickTier;
  haterHeat?:     number;
}

// ─── Sabotage event ───────────────────────────────────────────────────────────

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
  haterId:      string;
  cardType:     SabotageCardType;
  intensity:    number;
  haterName:    string;
  botId?:       BotId;
  attackType?:  AttackType;
  targetLayer?: ShieldLayerId;
}

// ─── Cold-Start ML Learning Types ─────────────────────────────────────────────

/**
 * PlayerLearningProfile — persisted in localStorage per player.
 * Accumulates behavioral signals across sessions so the chat system
 * can adapt from the very first interaction and improve over time.
 */
export interface PlayerLearningProfile {
  playerId:           string;
  firstSeenAt:        number;    // timestamp of first interaction
  totalRuns:          number;
  totalMessages:      number;
  totalBotInteractions: number;

  // Sentiment distribution (normalized 0-1 over lifetime)
  angerRate:          number;    // how often they express anger
  trollRate:          number;    // how often they troll
  helpSeekRate:       number;    // how often they ask for help
  flexRate:           number;    // how often they flex/brag
  silenceRate:        number;    // how often they ignore chat entirely

  // Engagement signals
  avgMessagesPerRun:  number;
  avgResponseTimeMs:  number;    // how fast they reply to bot taunts
  chatOpenRatio:      number;    // what % of run time is chat open

  // Bot-specific affinity (which bots get the most reactions)
  botAffinityScores:  Record<string, number>;  // botId → 0-1

  // Performance correlation
  avgSovereigntyRate: number;    // what % of their runs end in sovereignty
  bestRunNetWorth:    number;
  lastRunOutcome:     RunOutcome | null;

  // Adaptive thresholds (tuned over time)
  preferredAggressionLevel: number;  // 0-1, derived from engagement data
  churnRiskBaseline:        number;  // 0-1, their baseline quit risk

  // Timestamp
  updatedAt:          number;
}

/**
 * Cold-start defaults for a brand new player.
 * Conservative: low aggression, high helper frequency,
 * moderate NPC chatter. Adapts within the first run.
 */
export function createColdStartProfile(playerId: string): PlayerLearningProfile {
  return {
    playerId,
    firstSeenAt:        Date.now(),
    totalRuns:          0,
    totalMessages:      0,
    totalBotInteractions: 0,
    angerRate:          0,
    trollRate:          0,
    helpSeekRate:       0,
    flexRate:           0,
    silenceRate:        1,  // assume silent until proven otherwise
    avgMessagesPerRun:  0,
    avgResponseTimeMs:  5000,
    chatOpenRatio:      0.3,
    botAffinityScores:  {},
    avgSovereigntyRate: 0,
    bestRunNetWorth:    0,
    lastRunOutcome:     null,
    preferredAggressionLevel: 0.4,  // conservative cold start
    churnRiskBaseline:  0.5,        // assume moderate risk
    updatedAt:          Date.now(),
  };
}

/**
 * EngagementSignal — emitted per interaction for the learning pipeline.
 */
export interface EngagementSignal {
  type:        'MESSAGE_SENT' | 'BOT_REACTED' | 'CHAT_OPENED' | 'CHAT_CLOSED' | 'BOT_MUTED' | 'BOT_UNMUTED' | 'HELP_REQUESTED';
  playerId:    string;
  tick:        number;
  ts:          number;
  metadata?:   Record<string, any>;
}
