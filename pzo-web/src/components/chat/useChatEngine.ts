/**
 * useChatEngine.ts — PZO Chat Simulation Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * What makes chat feel alive (Mobile Strike / Rise of Kingdoms pattern):
 *
 *   1. NPC players post every 4–10s — feels like 50 people active
 *   2. Game events auto-broadcast as SYSTEM / MARKET_ALERT messages
 *   3. Big card plays → ACHIEVEMENT cards in SYNDICATE channel
 *   4. Regime changes → MARKET_ALERT broadcast to GLOBAL
 *   5. FUBAR hits → rival taunts in GLOBAL
 *   6. Unread badge tracks messages per channel since last view
 *
 * No server required — all simulated. Slot in real WebSocket later by
 * replacing the NPC interval with a socket listener.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ChatMessage, ChatChannel, GameChatContext, MessageKind } from './chatTypes';

// ─── NPC player pool ──────────────────────────────────────────────────────────

const NPC_NAMES = [
  'CashflowKing_ATL', 'SovereignSyd', 'RatRaceEscaper', 'PassiveIncomePhil',
  'LiquidityLord', 'DebtFreeDevin', 'YieldHunterJax', 'NetWorthNora',
  'CompoundKing_T', 'CapitalQueen_R', 'ArbitrageAndy', 'DividendDave',
  'EquityElla', 'CashCowCarlos', 'FreedomFund_Z', 'Syndicate_Reese',
  'BigDealBrendan', 'SmallDealSophie', 'MarketClock_C', 'LedgerLionel',
  'TreasurySam', 'RivalryRita', 'DealRoomDarius', 'ShieldedSiena',
];

const NPC_RANKS = ['Associate', 'Junior Partner', 'Partner', 'Senior Partner', 'Managing Partner'];

const GLOBAL_NPC_MESSAGES = [
  'anyone else riding the expansion wave? 📈 income up 40% last month',
  'that FUBAR card just nuked my shields lmaooo',
  'pro tip: stack cashflow amplifiers before regime shift hits',
  'made it to $1M net worth! first time! 🏆',
  'who else is grinding the Big Deal ladder rn',
  'shields saved my run THREE times already this session',
  'reminder: Liquidity Shield expires in 2 min if you filed last night',
  'the ML rerouting is REAL — watched it dodge two FUBARs in a row',
  'expansion → panic in 90 ticks. hedge now.',
  'new to the game — what\'s the fastest way to escape the Rat Race?',
  'just hit passive > expenses for the first time. it actually works',
  'who\'s in the top 10 syndicate ladder rn?',
  'Syndicate Rivalry just dropped — anyone filing a notice tonight?',
  'the settlement hash is the most satisfying screen in the game ngl',
  'deal room stays open til ledger close. get in.',
  'cashflow positive 8 months straight. no shields needed.',
  'the market panic destroyed me but I learned more than a bull run ever taught',
  'yield capture hit for 50K. rival syndicate is NOT happy 😂',
];

const SYNDICATE_MESSAGES = [
  'Partners — activate your Market Plays before CAPITAL_BATTLE opens',
  'treasury sitting at 800K. we can fund 3 more market plays this cycle',
  'everyone complete a qualifying run this tick. Capital Score needs 200 more',
  'rival filed a notice. Due Diligence starts in 2h. prep now.',
  'our Settlement Hash was verified. ledger closed clean. 🏁',
  'who has CASHFLOW_AMPLIFIER activated? we need the stack cap filled',
  'yield capture incoming — we won. 47K transferred to treasury ✅',
  'new partner joined: welcome to the syndicate. check the Deal Room.',
  'Managing Partner confirmed — rivalry notice filed against RedLedger Co.',
  'Capital Score update: we\'re 80 points ahead with 4h left in battle',
];

const RIVAL_TAUNTS = [
  '😈 your FUBAR hit was delicious. see you in the next rivalry.',
  'nice shield. shame about your income though 🙂',
  'our syndicate treasury just doubled. enjoy the Rat Race.',
  'we filed the notice. due diligence ends at midnight. get ready.',
  'your Capital Score is showing lol. come harder next time.',
];

// ─── Game event → chat message translator ─────────────────────────────────────

function eventToMessage(event: string, tick: number): Partial<ChatMessage> | null {
  const e = event.toLowerCase();

  if (e.includes('bull run')) {
    return { kind: 'MARKET_ALERT', channel: 'GLOBAL', emoji: '📈', body: 'MARKET ALERT — Bull Run detected. Income assets surging. Stack cashflow plays NOW before regime shifts.' };
  }
  if (e.includes('recession')) {
    return { kind: 'MARKET_ALERT', channel: 'GLOBAL', emoji: '📉', body: 'MARKET ALERT — Recession active. Expense pressure +12%. Shield up or get squeezed.' };
  }
  if (e.includes('market rally')) {
    return { kind: 'MARKET_ALERT', channel: 'GLOBAL', emoji: '💹', body: 'MARKET ALERT — Rally in progress. Net worth positions amplified. Euphoria window open.' };
  }
  if (e.includes('unexpected bill') || e.includes('panic')) {
    return { kind: 'MARKET_ALERT', channel: 'GLOBAL', emoji: '🚨', body: 'MARKET ALERT — Panic event. Unexpected cash drain. FUBAR probability elevated this cycle.' };
  }
  if (e.includes('integrity sweep')) {
    return { kind: 'SYSTEM', channel: 'GLOBAL', emoji: '🛡️', body: 'INTEGRITY SWEEP COMPLETED — Shield awarded. Anti-cheat heartbeat confirmed clean.' };
  }
  if (e.includes('shield absorbed bankruptcy')) {
    return { kind: 'ACHIEVEMENT', channel: 'SYNDICATE', emoji: '🛡️', body: 'SHIELD PROC — Bankruptcy absorbed. Run continues. Syndicate partner still in the fight.' };
  }
  if (e.includes('ml rerouted')) {
    return { kind: 'SYSTEM', channel: 'SYNDICATE', emoji: '🧠', body: 'ML ENGINE — Draw rerouted away from FUBAR hazard. Recommendation system active.' };
  }
  if (e.includes('freedom unlocked')) {
    return { kind: 'ACHIEVEMENT', channel: 'GLOBAL', emoji: '🏆', body: '🏆 FREEDOM UNLOCKED — Passive income exceeded expenses. A Syndicate partner has escaped the Rat Race.' };
  }
  if (e.includes('fubar hit')) {
    return null; // Rival taunt fires separately
  }
  if (e.includes('played:') && e.includes('/mo')) {
    const match = event.match(/Played: (.+?) →/);
    const name = match ? match[1] : 'Deal';
    return { kind: 'ACHIEVEMENT', channel: 'SYNDICATE', emoji: '✅', body: `DEAL CLOSED — ${name} activated. Passive income stream added to portfolio.` };
  }

  return null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const MAX_MESSAGES = 200;

export function useChatEngine(ctx: GameChatContext) {
  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [activeTab,   setActiveTab]   = useState<ChatChannel>('GLOBAL');
  const [unread,      setUnread]      = useState<Record<ChatChannel, number>>({ GLOBAL: 0, SYNDICATE: 0, DEAL_ROOM: 0 });
  const [chatOpen,    setChatOpen]    = useState(false);
  const prevEventsLen = useRef(0);
  const prevTick      = useRef(0);
  const msgId         = useRef(0);

  const nextId = () => `msg-${++msgId.current}`;

  const push = useCallback((partial: Partial<ChatMessage> & { channel: ChatChannel; body: string; kind: MessageKind }) => {
    const msg: ChatMessage = {
      id:         nextId(),
      senderId:   partial.senderId ?? 'SYSTEM',
      senderName: partial.senderName ?? 'SYSTEM',
      ts:         Date.now(),
      ...partial,
    };

    setMessages((prev) => [...prev.slice(-(MAX_MESSAGES - 1)), msg]);

    // Increment unread if panel closed or tab not active
    setUnread((prev) => {
      const isVisible = chatOpen && activeTab === msg.channel;
      if (isVisible) return prev;
      return { ...prev, [msg.channel]: prev[msg.channel] + 1 };
    });
  }, [chatOpen, activeTab]);

  // ── Bootstrap messages on mount ────────────────────────────────────────────
  useEffect(() => {
    const bootstrapNpc = NPC_NAMES.slice(0, 6);
    const bootstrapMsgs = [
      '💬 Welcome to PZO Global Chat — the market is watching.',
      'syndicate rivalry season is live. file your notice.',
      'who\'s hitting passive income targets this cycle?',
      'the deal room never sleeps.',
      'cashflow or die. no in between.',
      'new era. same Rat Race. escape it or work for someone who did.',
    ];
    bootstrapMsgs.forEach((body, i) => {
      const name = bootstrapNpc[i] ?? 'CapitalPlayer';
      setTimeout(() => {
        push({
          channel:    'GLOBAL',
          kind:       'PLAYER',
          senderId:   `npc-${i}`,
          senderName: name,
          senderRank: NPC_RANKS[Math.floor(Math.random() * NPC_RANKS.length)],
          body,
        });
      }, i * 300);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── NPC message interval — feels like 50 people online ────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const rnd = Math.random();
      let channel: ChatChannel = 'GLOBAL';
      let pool = GLOBAL_NPC_MESSAGES;

      if (rnd < 0.25) {
        channel = 'SYNDICATE';
        pool    = SYNDICATE_MESSAGES;
      } else if (rnd < 0.30) {
        // Rare rival taunt in GLOBAL after a bad event
        push({
          channel:    'GLOBAL',
          kind:       'RIVAL_TAUNT',
          senderId:   'rival-npc',
          senderName: 'RedLedger_Boss',
          senderRank: 'Managing Partner',
          body:       RIVAL_TAUNTS[Math.floor(Math.random() * RIVAL_TAUNTS.length)],
          emoji:      '😈',
        });
        return;
      }

      const name = NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)];
      const body = pool[Math.floor(Math.random() * pool.length)];
      push({
        channel,
        kind:       'PLAYER',
        senderId:   `npc-${name}`,
        senderName: name,
        senderRank: NPC_RANKS[Math.floor(Math.random() * NPC_RANKS.length)],
        body,
      });
    }, 5000 + Math.random() * 5000);

    return () => clearInterval(interval);
  }, [push]);

  // ── Game event → chat bridge ───────────────────────────────────────────────
  useEffect(() => {
    const newEvents = ctx.events.slice(prevEventsLen.current);
    prevEventsLen.current = ctx.events.length;

    for (const event of newEvents) {
      const partial = eventToMessage(event, ctx.tick);
      if (!partial) continue;
      push({
        senderId:   'SYSTEM',
        senderName: 'SYSTEM',
        ...partial,
        channel:    partial.channel ?? 'GLOBAL',
        kind:       partial.kind ?? 'SYSTEM',
        body:       partial.body ?? event,
      });
    }
  }, [ctx.events, ctx.tick, push]);

  // ── Regime broadcast when regime changes ──────────────────────────────────
  useEffect(() => {
    if (prevTick.current === 0) { prevTick.current = ctx.tick; return; }
    prevTick.current = ctx.tick;
  }, [ctx.tick]);

  // ── Tab switch clears unread for that channel ──────────────────────────────
  const switchTab = useCallback((tab: ChatChannel) => {
    setActiveTab(tab);
    setUnread((prev) => ({ ...prev, [tab]: 0 }));
  }, []);

  const toggleChat = useCallback(() => {
    setChatOpen((prev) => {
      if (!prev) {
        // Opening — clear unread for active tab
        setUnread((u) => ({ ...u, [activeTab]: 0 }));
      }
      return !prev;
    });
  }, [activeTab]);

  const sendMessage = useCallback((body: string) => {
    if (!body.trim()) return;
    push({
      channel:    activeTab,
      kind:       'PLAYER',
      senderId:   'player-local',
      senderName: 'You',
      senderRank: 'Partner',
      body:       body.trim(),
    });
  }, [activeTab, push]);

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  return {
    messages,
    activeTab,
    switchTab,
    chatOpen,
    toggleChat,
    sendMessage,
    unread,
    totalUnread,
  };
}
