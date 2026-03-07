/**
 * GameEventChatBridge.ts — PZO Sovereign Chat
 * Maps engine events (EventBus) to chat messages with contextual reactions.
 * The game itself becomes a character in chat.
 *
 * WIRING:
 *   EventBus → GameEventChatBridge → ChatKernel → ChatPanel
 *
 * Density6 LLC · Point Zero One · Confidential
 */

import type { ChatMessage, ChatChannel, MessageKind, GameChatContext } from './chatTypes';
import { adaptiveDialogueEngine } from './AdaptiveDialogueEngine';
import type { IntelligenceSnapshot } from './AdaptiveDialogueEngine';

// ─── Event Types (from EventBus) ──────────────────────────────────────────────

export type GameEventType =
  | 'SHIELD_LAYER_BREACHED'
  | 'SHIELD_LAYER_REPAIRED'
  | 'SHIELD_FORTIFIED'
  | 'PRESSURE_TIER_CHANGED'
  | 'CASCADE_CHAIN_TRIGGERED'
  | 'BOT_ATTACK_FIRED'
  | 'BOT_NEUTRALIZED'
  | 'CARD_PLAYED'
  | 'CARD_FORCED'
  | 'TICK_TIER_ESCALATED'
  | 'BANKRUPTCY_WARNING'
  | 'BANKRUPTCY_TRIGGERED'
  | 'SOVEREIGNTY_ACHIEVED'
  | 'INCOME_THRESHOLD_CROSSED'
  | 'DECISION_WINDOW_OPENED'
  | 'DECISION_WINDOW_MISSED'
  | 'RUN_STARTED'
  | 'RUN_ENDED';

// ─── Event → Chat Message Factory ────────────────────────────────────────────

export interface EventChatResult {
  systemMessage:     ChatMessage;
  botReactions:      ChatMessage[];
  helperReactions:   ChatMessage[];
  npcReactions:      ChatMessage[];
}

let msgSeq = 0;
function nextId(): string { return `evt_${Date.now()}_${++msgSeq}`; }

function mkMsg(
  kind: MessageKind,
  senderId: string,
  senderName: string,
  body: string,
  channel: ChatChannel = 'GLOBAL',
  extras: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: nextId(),
    channel,
    kind,
    senderId,
    senderName,
    body,
    ts: Date.now(),
    ...extras,
  };
}

// ─── NPC reaction pool ────────────────────────────────────────────────────────

const NPC_REACTIONS = {
  SHIELD_BREACHED: [
    { name: 'BreachBreaker_99', msg: 'shields are overrated anyway 💀', rank: 'Associate' },
    { name: 'ShieldStacker_X', msg: 'rebuild ASAP. trust me on this one', rank: 'Partner' },
    { name: 'SovereignSyd', msg: 'L1 going down early is recoverable. L3? different story', rank: 'Senior Partner' },
  ],
  PRESSURE_HIGH: [
    { name: 'CashflowKing_ATL', msg: 'pressure at HIGH? time to hunker down 😬', rank: 'Partner' },
    { name: 'RatRaceEscaper', msg: 'this is where most people crack. stay focused', rank: 'Junior Partner' },
  ],
  CARD_PLAYED: [
    { name: 'ArbitrageAndy', msg: 'solid card choice', rank: 'Associate' },
    { name: 'CompoundKing_T', msg: 'interesting play. what\'s the follow-up?', rank: 'Partner' },
    { name: 'EquityElla', msg: 'I would\'ve played that differently but respect the read', rank: 'Senior Partner' },
  ],
  BANKRUPTCY_NEAR: [
    { name: 'DebtFreeDevin', msg: 'been there. you can come back from this', rank: 'Partner' },
    { name: 'FreedomFund_Z', msg: 'cut expenses NOW. every dollar matters at this stage', rank: 'Senior Partner' },
  ],
  SOVEREIGNTY: [
    { name: 'CashflowKing_ATL', msg: 'LET\'S GOOO 🔥🔥🔥', rank: 'Senior Partner' },
    { name: 'SovereignSophia', msg: 'welcome to the other side 👑', rank: 'Managing Partner' },
    { name: 'MomentumMarcus', msg: 'absolute legend. what was your strategy?', rank: 'Partner' },
    { name: 'LiquidityLord', msg: 'SOVEREIGNTY!!! 🚀🚀🚀', rank: 'Senior Partner' },
  ],
  CASCADE: [
    { name: 'LedgerLionel', msg: 'cascade chain going... this is gonna get ugly', rank: 'Associate' },
    { name: 'TreasurySam', msg: 'isolate the damage. don\'t let it spread to your income streams', rank: 'Partner' },
  ],
  TICK_ESCALATION: [
    { name: 'MomentumMarcus', msg: 'tick tier just jumped. decisions cost more now ⏰', rank: 'Associate' },
  ],
  RUN_START: [
    { name: 'CashflowKing_ATL', msg: 'welcome! good luck out there 🫡', rank: 'Partner' },
    { name: 'SovereignSyd', msg: 'another one enters the arena. let\'s see what you\'ve got', rank: 'Senior Partner' },
    { name: 'PassivePhil', msg: 'first run? focus on income cards. everything else is secondary', rank: 'Junior Partner' },
  ],
};

function pickNPCReaction(pool: typeof NPC_REACTIONS.SHIELD_BREACHED): ChatMessage | null {
  if (Math.random() > 0.6) return null; // 40% chance no NPC reacts
  const npc = pool[Math.floor(Math.random() * pool.length)];
  return mkMsg('PLAYER', `npc_${npc.name}`, npc.name, npc.msg, 'GLOBAL', { senderRank: npc.rank });
}

// ─── Bridge Class ─────────────────────────────────────────────────────────────

export class GameEventChatBridge {
  private gameChatCtx: GameChatContext = {
    tick: 0, cash: 0, regime: 'STABLE', events: [],
    netWorth: 0, income: 0, expenses: 0,
  };
  private intel: IntelligenceSnapshot | null = null;

  updateContext(ctx: Partial<GameChatContext>): void {
    this.gameChatCtx = { ...this.gameChatCtx, ...ctx };
  }

  updateIntelligence(intel: IntelligenceSnapshot): void {
    this.intel = intel;
  }

  processEvent(eventType: GameEventType, payload: Record<string, any> = {}): EventChatResult {
    const systemMessage = this.createSystemMessage(eventType, payload);
    const botReactions = this.createBotReactions(eventType, payload);
    const helperReactions = this.createHelperReactions(eventType, payload);
    const npcReactions = this.createNPCReactions(eventType);

    return { systemMessage, botReactions, helperReactions, npcReactions };
  }

  // ─── System message (always fires) ─────────────────────────────────────

  private createSystemMessage(eventType: GameEventType, payload: Record<string, any>): ChatMessage {
    const body = this.formatSystemBody(eventType, payload);
    const kind: MessageKind = this.mapEventToKind(eventType);
    return mkMsg(kind, 'SYSTEM', 'SYSTEM', body);
  }

  private formatSystemBody(eventType: GameEventType, p: Record<string, any>): string {
    switch (eventType) {
      case 'SHIELD_LAYER_BREACHED':
        return `⚠️ SHIELD BREACH — ${p.layerId ?? 'L1'} compromised. Integrity: ${p.integrity ?? 0}%`;
      case 'SHIELD_LAYER_REPAIRED':
        return `🛡️ Shield ${p.layerId ?? 'L1'} repaired → ${p.integrity ?? 100}%`;
      case 'SHIELD_FORTIFIED':
        return `🏰 SHIELDS FORTIFIED — All layers reinforced`;
      case 'PRESSURE_TIER_CHANGED':
        return `🔺 Pressure → ${p.newTier ?? 'ELEVATED'}. Market regime shifting.`;
      case 'CASCADE_CHAIN_TRIGGERED':
        return `⛓️ CHAIN REACTION — Severity: ${p.severity ?? 'MAJOR'}. Systems cascading.`;
      case 'BOT_ATTACK_FIRED':
        return `🎯 ${p.botName ?? 'BOT'} fired ${p.attackType ?? 'ATTACK'} → targeting ${p.targetLayer ?? 'shields'}`;
      case 'BOT_NEUTRALIZED':
        return `✅ ${p.botName ?? 'BOT'} neutralized. Retreating.`;
      case 'CARD_PLAYED':
        return `🃏 Card played: ${p.cardName ?? 'Unknown'}${p.effect ? ` (${p.effect})` : ''}`;
      case 'CARD_FORCED':
        return `⚡ FORCED CARD: ${p.cardName ?? 'Unknown'} — no choice. This is how life works.`;
      case 'TICK_TIER_ESCALATED':
        return `⏰ Time tier → ${p.newTier ?? 'T2'}. Decisions now cost more.`;
      case 'BANKRUPTCY_WARNING':
        return `💀 BANKRUPTCY WARNING — Net worth critically low. Shields failing.`;
      case 'BANKRUPTCY_TRIGGERED':
        return `☠️ BANKRUPTCY. Run ended. But the lessons are real.`;
      case 'SOVEREIGNTY_ACHIEVED':
        return `👑 SOVEREIGNTY ACHIEVED. Income > Expenses. Shields intact. You are free.`;
      case 'INCOME_THRESHOLD_CROSSED':
        return `📈 Income crossed ${p.threshold ?? '$5K'}/mo. Cashflow positive.`;
      case 'DECISION_WINDOW_OPENED':
        return `⏳ Decision window open — ${p.timeMs ?? 10000}ms to act.`;
      case 'DECISION_WINDOW_MISSED':
        return `❌ Decision window MISSED. The market moved without you.`;
      case 'RUN_STARTED':
        return `▶ RUN STARTED — ${p.mode ?? 'Empire'} Mode${p.goal ? ` · ${p.goal}` : ''}${p.archetype ? ` · ${p.archetype}` : ''}`;
      case 'RUN_ENDED':
        return `⏹ RUN ENDED — Outcome: ${p.outcome ?? 'UNKNOWN'}`;
      default:
        return `📢 Event: ${eventType}`;
    }
  }

  private mapEventToKind(eventType: GameEventType): MessageKind {
    switch (eventType) {
      case 'SHIELD_LAYER_BREACHED':
      case 'SHIELD_LAYER_REPAIRED':
      case 'SHIELD_FORTIFIED':
        return 'SHIELD_EVENT';
      case 'BOT_ATTACK_FIRED':
        return 'BOT_ATTACK';
      case 'CASCADE_CHAIN_TRIGGERED':
        return 'CASCADE_ALERT';
      case 'PRESSURE_TIER_CHANGED':
        return 'MARKET_ALERT';
      case 'SOVEREIGNTY_ACHIEVED':
      case 'INCOME_THRESHOLD_CROSSED':
        return 'ACHIEVEMENT';
      default:
        return 'SYSTEM';
    }
  }

  // ─── Bot reactions (ML-driven) ──────────────────────────────────────────

  private createBotReactions(eventType: GameEventType, payload: Record<string, any>): ChatMessage[] {
    const contextMap: Partial<Record<GameEventType, import('./HaterDialogueTrees').DialogueContext>> = {
      SHIELD_LAYER_BREACHED:  'PLAYER_SHIELD_BREAK',
      PRESSURE_TIER_CHANGED:  'TIME_PRESSURE',
      CASCADE_CHAIN_TRIGGERED:'CASCADE_CHAIN',
      CARD_PLAYED:            'PLAYER_CARD_PLAY',
      BANKRUPTCY_WARNING:     'PLAYER_NEAR_BANKRUPTCY',
      BANKRUPTCY_TRIGGERED:   'PLAYER_LOST',
      SOVEREIGNTY_ACHIEVED:   'NEAR_SOVEREIGNTY',
      INCOME_THRESHOLD_CROSSED:'PLAYER_INCOME_UP',
      TICK_TIER_ESCALATED:    'TIME_PRESSURE',
      RUN_STARTED:            'GAME_START',
      BOT_NEUTRALIZED:        'BOT_DEFEATED',
    };

    const dialogueCtx = contextMap[eventType];
    if (!dialogueCtx) return [];

    const messages: ChatMessage[] = [];
    // Pick 1-2 bots to react (not all 5)
    const botIds = ['BOT_01_LIQUIDATOR', 'BOT_02_BUREAUCRAT', 'BOT_03_MANIPULATOR', 'BOT_04_CRASH_PROPHET', 'BOT_05_LEGACY_HEIR'];
    const shuffled = botIds.sort(() => Math.random() - 0.5);
    const reactors = shuffled.slice(0, Math.random() > 0.5 ? 2 : 1);

    for (const botId of reactors) {
      const decision = adaptiveDialogueEngine.selectForGameEvent(
        botId as any,
        dialogueCtx,
        this.gameChatCtx,
        this.intel ?? undefined,
      );
      if (decision) {
        const emoji = BOT_EMOJI[botId] ?? '🔱';
        messages.push(mkMsg(
          'BOT_TAUNT',
          botId,
          BOT_DISPLAY_NAMES[botId] ?? botId,
          decision.text,
          'GLOBAL',
          { emoji },
        ));
      }
    }

    return messages;
  }

  // ─── Helper reactions (Mentor etc.) ─────────────────────────────────────

  private createHelperReactions(eventType: GameEventType, payload: Record<string, any>): ChatMessage[] {
    const helperEvents: GameEventType[] = [
      'SHIELD_LAYER_BREACHED', 'BANKRUPTCY_WARNING', 'SOVEREIGNTY_ACHIEVED',
      'RUN_STARTED', 'INCOME_THRESHOLD_CROSSED',
    ];
    if (!helperEvents.includes(eventType)) return [];

    const contextMap: Partial<Record<GameEventType, import('./HaterDialogueTrees').DialogueContext>> = {
      SHIELD_LAYER_BREACHED:  'PLAYER_SHIELD_BREAK',
      BANKRUPTCY_WARNING:     'PLAYER_NEAR_BANKRUPTCY',
      SOVEREIGNTY_ACHIEVED:   'NEAR_SOVEREIGNTY',
      RUN_STARTED:            'GAME_START',
      INCOME_THRESHOLD_CROSSED:'PLAYER_INCOME_UP',
    };

    const ctx = contextMap[eventType];
    if (!ctx) return [];

    const decision = adaptiveDialogueEngine.selectForGameEvent(
      'MENTOR',
      ctx,
      this.gameChatCtx,
      this.intel ?? undefined,
    );

    if (!decision) return [];

    return [mkMsg('SYSTEM', 'MENTOR', 'THE MENTOR', decision.text, 'GLOBAL', { emoji: '🧭' })];
  }

  // ─── NPC reactions ──────────────────────────────────────────────────────

  private createNPCReactions(eventType: GameEventType): ChatMessage[] {
    const poolMap: Partial<Record<GameEventType, typeof NPC_REACTIONS.SHIELD_BREACHED>> = {
      SHIELD_LAYER_BREACHED:    NPC_REACTIONS.SHIELD_BREACHED,
      PRESSURE_TIER_CHANGED:    NPC_REACTIONS.PRESSURE_HIGH,
      CARD_PLAYED:              NPC_REACTIONS.CARD_PLAYED,
      BANKRUPTCY_WARNING:       NPC_REACTIONS.BANKRUPTCY_NEAR,
      SOVEREIGNTY_ACHIEVED:     NPC_REACTIONS.SOVEREIGNTY,
      CASCADE_CHAIN_TRIGGERED:  NPC_REACTIONS.CASCADE,
      TICK_TIER_ESCALATED:      NPC_REACTIONS.TICK_ESCALATION,
      RUN_STARTED:              NPC_REACTIONS.RUN_START,
    };

    const pool = poolMap[eventType];
    if (!pool) return [];

    const msg = pickNPCReaction(pool);
    return msg ? [msg] : [];
  }
}

// ─── Bot metadata ─────────────────────────────────────────────────────────────

const BOT_DISPLAY_NAMES: Record<string, string> = {
  BOT_01_LIQUIDATOR:   'THE LIQUIDATOR',
  BOT_02_BUREAUCRAT:   'THE BUREAUCRAT',
  BOT_03_MANIPULATOR:  'THE MANIPULATOR',
  BOT_04_CRASH_PROPHET:'THE CRASH PROPHET',
  BOT_05_LEGACY_HEIR:  'THE LEGACY HEIR',
};

const BOT_EMOJI: Record<string, string> = {
  BOT_01_LIQUIDATOR:   '🔱',
  BOT_02_BUREAUCRAT:   '📋',
  BOT_03_MANIPULATOR:  '🕸️',
  BOT_04_CRASH_PROPHET:'🌪️',
  BOT_05_LEGACY_HEIR:  '👑',
};

// ─── Singleton ────────────────────────────────────────────────────────────────

export const gameEventChatBridge = new GameEventChatBridge();
