/**
 * pzo-web/src/components/chat/useChatEngine.ts — PRODUCTION v2
 * ─────────────────────────────────────────────────────────────────────────────
 * CHANGES FROM v1:
 *   - Real socket.io connection (connects when accessToken is available)
 *   - Hater messages arrive via socket (not simulated) when server is live
 *   - Falls back to local NPC simulation when socket disconnected (dev mode)
 *   - Receives hater:sabotage events → exposes onSabotage callback
 *   - Player state synced to server every 10 ticks
 *   - Game events forwarded to server for hater reaction
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ChatChannel, ChatMessage, GameChatContext } from './chatTypes';

// ─── Sabotage card types (mirrored from HaterEngine) ──────────────────────────

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
  haterId:   string;
  cardType:  SabotageCardType;
  intensity: number;
  haterName: string;
}

// ─── NPC simulation pool (active when socket is disconnected) ─────────────────

const NPC_NAMES = [
  'CashflowKing_ATL', 'SovereignSyd', 'RatRaceEscaper', 'PassiveIncomePhil',
  'LiquidityLord', 'DebtFreeDevin', 'YieldHunterJax', 'NetWorthNora',
  'CompoundKing_T', 'CapitalQueen_R', 'ArbitrageAndy', 'DividendDave',
  'EquityElla', 'CashCowCarlos', 'FreedomFund_Z', 'Syndicate_Reese',
  'BigDealBrendan', 'SmallDealSophie', 'LedgerLionel', 'TreasurySam',
];

const NPC_RANKS = ['Associate', 'Junior Partner', 'Partner', 'Senior Partner'];

const GLOBAL_NPC = [
  'anyone surviving the new difficulty? this thing is BRUTAL 😅',
  'tip: hold 3 shields minimum before tick 200. learned that the hard way.',
  'the haters just tanked my income mid run. WAGE_CAGE is ruthless.',
  'SLUMLORD_7 hit me with an inspection notice right before my cashflow tipped positive. not okay.',
  'finally broke $100K net worth. STATUS_QUO_ML immediately fired a market correction lmao',
  'the privilege cards are rare but when they hit... game changer. got one in 47 runs.',
  'DEBT_DAEMON is watching. do NOT carry high cash with no income assets.',
  'freedom is real. I escaped. took 31 attempts but I\'m here.',
  'who else is learning more about real finance from this game than school ever taught?',
  'INFLATION_GHOST barely says anything and somehow that\'s the most terrifying one.',
  'pro tip: stack IPA cards first. don\'t touch OPPORTUNITY until income exceeds expenses.',
  'just hit passive > expenses. the haters IMMEDIATELY coordinated on me.',
  'what is the fastest strategy to build shields? asking for a run.',
  'the card forcing mechanic is so real. life hits you with FUBARs you didn\'t choose.',
];

const SYNDICATE_NPC = [
  'partners — hater activity is elevated this cycle. double your shields.',
  'DEBT_DAEMON triggered a debt spiral on two of us simultaneously. coordination suspected.',
  'treasury at 400K. activating market plays before CAPITAL_BATTLE.',
  'if INFLATION_GHOST posts "..." — that means a market correction is coming. prep now.',
  'our Capital Score is 80 points ahead. haters are desperate.',
];

// ─── Game event → chat message ─────────────────────────────────────────────────

function eventToMessage(event: string): Partial<ChatMessage> | null {
  const e = event.toLowerCase();
  if (e.includes('bull run'))         return { kind: 'MARKET_ALERT', emoji: '📈', body: 'MARKET ALERT — Bull Run. Income assets surging. Stack cashflow plays NOW.' };
  if (e.includes('recession'))        return { kind: 'MARKET_ALERT', emoji: '📉', body: 'MARKET ALERT — Recession active. Expense pressure +12%. Shield or get squeezed.' };
  if (e.includes('market rally'))     return { kind: 'MARKET_ALERT', emoji: '💹', body: 'MARKET ALERT — Rally in progress. Net worth amplified. Euphoria window open.' };
  if (e.includes('unexpected bill'))  return { kind: 'MARKET_ALERT', emoji: '🚨', body: 'MARKET ALERT — Panic event. Cash drain incoming. FUBAR probability elevated.' };
  if (e.includes('freedom unlocked')) return { kind: 'ACHIEVEMENT', emoji: '🏆', body: '🏆 FREEDOM UNLOCKED — A player escaped the Rat Race. Point Zero One achieved.' };
  if (e.includes('shield absorbed'))  return { kind: 'ACHIEVEMENT', emoji: '🛡️', body: 'SHIELD PROC — Bankruptcy absorbed. Run survives.' };
  if (e.includes('played:') && e.includes('/mo')) {
    const match = event.match(/Played: (.+?) →/);
    return { kind: 'ACHIEVEMENT', emoji: '✅', body: `DEAL CLOSED — ${match?.[1] ?? 'Asset'} activated.` };
  }
  return null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const MAX_MESSAGES = 300;
const API_WS = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export function useChatEngine(
  ctx: GameChatContext,
  accessToken?: string | null,
  onSabotage?: (event: SabotageEvent) => void,
) {
  const [messages,   setMessages]   = useState<ChatMessage[]>([]);
  const [activeTab,  setActiveTab]  = useState<ChatChannel>('GLOBAL');
  const [unread,     setUnread]     = useState<Record<ChatChannel, number>>({ GLOBAL: 0, SYNDICATE: 0, DEAL_ROOM: 0 });
  const [chatOpen,   setChatOpen]   = useState(false);
  const [connected,  setConnected]  = useState(false);

  const socketRef        = useRef<{ emit: (ev: string, data: unknown) => void; disconnect: () => void } | null>(null);
  const prevEventsLen    = useRef(0);
  const prevTick         = useRef(-1);
  const msgId            = useRef(0);
  const npcIntervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSabotageRef    = useRef(onSabotage);
  onSabotageRef.current  = onSabotage;

  const nextId = () => `msg-${++msgId.current}-${Date.now()}`;

  const push = useCallback((partial: Partial<ChatMessage> & { channel: ChatChannel; body: string; kind: ChatMessage['kind'] }) => {
    const msg: ChatMessage = {
      id:         nextId(),
      senderId:   partial.senderId ?? 'SYSTEM',
      senderName: partial.senderName ?? 'SYSTEM',
      ts:         Date.now(),
      ...partial,
    };
    setMessages((prev) => [...prev.slice(-(MAX_MESSAGES - 1)), msg]);
    setUnread((prev) => {
      if (chatOpen && activeTab === msg.channel) return prev;
      return { ...prev, [msg.channel]: prev[msg.channel] + 1 };
    });
  }, [chatOpen, activeTab]);

  // ── Socket.io connection ────────────────────────────────────────────────

  useEffect(() => {
    if (!accessToken) return;

    // Dynamic import so it doesn't break dev without server
    let io: typeof import('socket.io-client') | null = null;
    let sock: ReturnType<typeof import('socket.io-client').io> | null = null;

    import('socket.io-client').then(({ io: createSocket }) => {
      io = { io: createSocket } as unknown as typeof import('socket.io-client');
      sock = createSocket(API_WS, {
        auth:           { token: accessToken },
        transports:     ['websocket', 'polling'],
        reconnection:   true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
      });

      sock.on('connect', () => {
        setConnected(true);
        // Stop local NPC simulation — server takes over
        if (npcIntervalRef.current) { clearInterval(npcIntervalRef.current); npcIntervalRef.current = null; }
      });

      sock.on('disconnect', () => {
        setConnected(false);
        // Restart local NPC simulation as fallback
        _startNpcSimulation();
      });

      // Incoming chat messages (from real players + haters via server)
      sock.on('chat:message', (msg: ChatMessage) => {
        setMessages((prev) => [...prev.slice(-(MAX_MESSAGES - 1)), msg]);
        setUnread((prev) => {
          if (chatOpen && activeTab === msg.channel) return prev;
          return { ...prev, [msg.channel]: prev[msg.channel] + 1 };
        });
      });

      // Hater sabotage — forward to game engine
      sock.on('hater:sabotage', (event: SabotageEvent) => {
        onSabotageRef.current?.(event);
        // Also post a system message in chat
        push({
          channel:    'GLOBAL',
          kind:       'RIVAL_TAUNT',
          senderId:   event.haterId,
          senderName: event.haterName ?? event.haterId,
          emoji:      '⚠️',
          body:       `⚠️ ${event.haterName ?? event.haterId} has injected a ${event.cardType.replace(/_/g,' ')} into your run. Intensity: ${event.intensity.toFixed(1)}x`,
        });
      });

      socketRef.current = { emit: sock.emit.bind(sock), disconnect: () => sock?.disconnect() };

      // Signal run start
      sock.emit('run:start', { seed: 0 });

    }).catch(() => {
      // socket.io-client not available — use NPC simulation only
      _startNpcSimulation();
    });

    return () => {
      sock?.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // ── Fallback NPC simulation (no server / disconnected) ────────────────

  function _startNpcSimulation() {
    if (npcIntervalRef.current) return;
    npcIntervalRef.current = setInterval(() => {
      const rnd     = Math.random();
      const channel: ChatChannel = rnd < 0.25 ? 'SYNDICATE' : 'GLOBAL';
      const pool    = channel === 'SYNDICATE' ? SYNDICATE_NPC : GLOBAL_NPC;
      push({
        channel,
        kind:       'PLAYER',
        senderId:   'npc-local',
        senderName: NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)],
        senderRank: NPC_RANKS[Math.floor(Math.random() * NPC_RANKS.length)],
        body:       pool[Math.floor(Math.random() * pool.length)],
      });
    }, 5000 + Math.random() * 6000);
  }

  // Start NPC simulation on mount (before socket connects)
  useEffect(() => {
    _startNpcSimulation();
    // Bootstrap
    ['💬 GLOBAL CHAT — The system is watching.', 'escape the rat race or fund those who already did.'].forEach((body, i) => {
      setTimeout(() => push({ channel: 'GLOBAL', kind: 'SYSTEM', senderId: 'SYSTEM', senderName: 'SYSTEM', emoji: '📡', body }), i * 400);
    });
    return () => { if (npcIntervalRef.current) clearInterval(npcIntervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Game event bridge ─────────────────────────────────────────────────

  useEffect(() => {
    const newEvents = ctx.events.slice(prevEventsLen.current);
    prevEventsLen.current = ctx.events.length;
    for (const event of newEvents) {
      const partial = eventToMessage(event);
      if (!partial) continue;
      push({ channel: 'GLOBAL', kind: 'SYSTEM', senderId: 'SYSTEM', senderName: 'SYSTEM', ...partial } as Parameters<typeof push>[0]);
      // Forward to server for hater reaction
      socketRef.current?.emit('game:event', { event });
    }
  }, [ctx.events, push]);

  // ── Player state sync to server (every 10 ticks) ──────────────────────

  useEffect(() => {
    if (ctx.tick === prevTick.current) return;
    if (ctx.tick % 10 !== 0) { prevTick.current = ctx.tick; return; }
    prevTick.current = ctx.tick;
    socketRef.current?.emit('player:state', {
      cash:        ctx.cash,
      netWorth:    ctx.netWorth,
      income:      ctx.income,
      expenses:    ctx.expenses,
      regime:      ctx.regime,
      tick:        ctx.tick,
      recentEvent: ctx.events[ctx.events.length - 1] ?? '',
    });
  }, [ctx.tick, ctx.cash, ctx.netWorth, ctx.income, ctx.expenses, ctx.regime, ctx.events]);

  // ── Tab switch ────────────────────────────────────────────────────────

  const switchTab = useCallback((tab: ChatChannel) => {
    setActiveTab(tab);
    setUnread((prev) => ({ ...prev, [tab]: 0 }));
  }, []);

  const toggleChat = useCallback(() => {
    setChatOpen((prev) => {
      if (!prev) setUnread((u) => ({ ...u, [activeTab]: 0 }));
      return !prev;
    });
  }, [activeTab]);

  const sendMessage = useCallback((body: string) => {
    if (!body.trim()) return;
    const msg: ChatMessage = {
      id:         nextId(),
      channel:    activeTab,
      kind:       'PLAYER',
      senderId:   'player-local',
      senderName: 'You',
      senderRank: 'Partner',
      body:       body.trim(),
      ts:         Date.now(),
    };
    // Optimistic local add
    setMessages((prev) => [...prev.slice(-(MAX_MESSAGES - 1)), msg]);
    // Send to server
    socketRef.current?.emit('chat:send', { channel: activeTab, body: body.trim() });
  }, [activeTab]);

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  return { messages, activeTab, switchTab, chatOpen, toggleChat, sendMessage, unread, totalUnread, connected };
}
