/**
 * useChatEngine.ts — PZO Chat Engine Hook · PRODUCTION v3 · Engine-Integrated
 * ─────────────────────────────────────────────────────────────────────────────
 * v3 CHANGES (engine integration):
 *   - NPC pool uses real bot names (THE LIQUIDATOR, THE BUREAUCRAT, etc.)
 *   - Bot taunts sourced from BotProfileRegistry.attackDialogue / retreatDialogue
 *   - Event bridge maps real EventBus event names (BOT_ATTACK_FIRED,
 *     SHIELD_LAYER_BREACHED, CASCADE_CHAIN_TRIGGERED, PRESSURE_TIER_CHANGED)
 *   - SabotageEvent carries botId + attackType + targetLayer from engine
 *   - PressureTier and TickTier surfaced in system messages
 *   - Message dedup guard (100ms window) for EventBus flush-batch scenarios
 *   - MAX_MESSAGES 500 (20M-scale: server handles pagination, client holds window)
 *   - NPC cadence varies by TickTier: slower at SOVEREIGN, faster at CRISIS
 * ─────────────────────────────────────────────────────────────────────────────
 * Density6 LLC · Point Zero One · Confidential
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ChatChannel, ChatMessage, GameChatContext, SabotageEvent } from './chatTypes';
// FIX: value import (not type-only) so PressureTier enum members are accessible at runtime
import { BotId, BotState, AttackType } from '../../engines/battle/types';
import { TickTier } from '../../engines/zero/types';
import { PressureTier } from '../../engines/pressure/types';

export type { SabotageEvent };

// ─── Engine-sourced bot metadata ───────────────────────────────────────────────
interface BotChatProfile {
  id:             BotId;
  displayName:    string;
  archLabel:      string;
  attackDialogue: string;
  retreatDialogue:string;
  emoji:          string;
  attackType:     AttackType;
}

const BOT_CHAT_PROFILES: Readonly<Record<BotId, BotChatProfile>> = {
  [BotId.BOT_01_LIQUIDATOR]: {
    id:             BotId.BOT_01_LIQUIDATOR,
    displayName:    'THE LIQUIDATOR',
    archLabel:      'Predatory Creditor',
    attackDialogue: 'Your assets are priced for distress. I am simply here to help the market find the floor.',
    retreatDialogue:'The market will correct again. I will return when the window reopens.',
    emoji:          '🔱',
    attackType:     AttackType.ASSET_STRIP,
  },
  [BotId.BOT_02_BUREAUCRAT]: {
    id:             BotId.BOT_02_BUREAUCRAT,
    displayName:    'THE BUREAUCRAT',
    archLabel:      'Regulatory Burden',
    attackDialogue: 'Every income stream requires verification. There are forms. I am simply doing my job.',
    retreatDialogue:'Your paperwork appears to be in order. For now. We will revisit your compliance posture.',
    emoji:          '📋',
    attackType:     AttackType.REGULATORY_ATTACK,
  },
  [BotId.BOT_03_MANIPULATOR]: {
    id:             BotId.BOT_03_MANIPULATOR,
    displayName:    'THE MANIPULATOR',
    archLabel:      'Disinformation Engine',
    attackDialogue: 'Predictable decisions create exploitable markets. I have been studying your moves before you made them.',
    retreatDialogue:'You changed your pattern. Interesting. I will need to recalibrate the model.',
    emoji:          '🕸️',
    attackType:     AttackType.FINANCIAL_SABOTAGE,
  },
  [BotId.BOT_04_CRASH_PROPHET]: {
    id:             BotId.BOT_04_CRASH_PROPHET,
    displayName:    'THE CRASH PROPHET',
    archLabel:      'Macro Volatility',
    attackDialogue: 'The market always corrects. The only question is whether you have positioned yourself to survive, or to be consumed.',
    retreatDialogue:'Volatility windows open and close. You survived this one. The next will be different.',
    emoji:          '🌪️',
    attackType:     AttackType.EXPENSE_INJECTION,
  },
  [BotId.BOT_05_LEGACY_HEIR]: {
    id:             BotId.BOT_05_LEGACY_HEIR,
    displayName:    'THE LEGACY HEIR',
    archLabel:      'Generational Advantage',
    attackDialogue: 'You have done well. It would be a shame if the system remembered that you were not born into this position.',
    retreatDialogue:'You found a way through. The system will need to recalibrate its thresholds for you.',
    emoji:          '👑',
    attackType:     AttackType.OPPORTUNITY_KILL,
  },
};

// ─── NPC player pool ───────────────────────────────────────────────────────────
const NPC_NAMES = [
  'CashflowKing_ATL', 'SovereignSyd',     'RatRaceEscaper',  'PassivePhil',
  'LiquidityLord',    'DebtFreeDevin',    'YieldHunterJax',  'NetWorthNora',
  'CompoundKing_T',   'CapitalQueen_R',   'ArbitrageAndy',   'DividendDave',
  'EquityElla',       'CashCowCarlos',    'FreedomFund_Z',   'Syndicate_Reese',
  'BigDealBrendan',   'SmallDealSophie',  'LedgerLionel',    'TreasurySam',
  'SovereignSophia',  'BreachBreaker_99', 'ShieldStacker_X', 'MomentumMarcus',
];

const NPC_RANKS = ['Associate', 'Junior Partner', 'Partner', 'Senior Partner'];

const GLOBAL_NPC_MSGS = [
  'anyone surviving the new difficulty? this thing is BRUTAL 😅',
  'tip: hold 3 shields minimum before tick 200. learned that the hard way.',
  'THE LIQUIDATOR just stripped my best income card mid-run. not okay.',
  'THE BUREAUCRAT hit me with an INSPECTION_NOTICE right before my cashflow tipped positive.',
  'finally broke $100K net worth. THE CRASH PROPHET immediately fired an expense injection.',
  'freedom is real. I escaped. took 31 attempts but I\'m here.',
  'who else is learning more about real finance from this game than school ever taught?',
  'THE LEGACY HEIR barely says anything in early game. late game? different story.',
  'pro tip: stack income assets first. don\'t touch OPPORTUNITY cards until income > expenses.',
  'just hit passive > expenses. THE MANIPULATOR immediately started pattern-matching my plays.',
  'what is the fastest strategy to build shields? asking for a run.',
  'the card forcing mechanic is so real. life hits you with FUBARs you didn\'t choose.',
  'THE BUREAUCRAT targeting players with 3+ income streams is diabolical game design.',
  'shield fortified = income buffer. never play aggressive without it.',
  'CRASH PROPHET triggers when you least expect it. always hedge macro.',
  'income > expenses is step one. sovereignty is the whole game.',
];

const SYNDICATE_NPC_MSGS = [
  'partners — hater heat is elevated this cycle. double your shields before tick 100.',
  'THE CRASH PROPHET triggered a debt spiral on two of us simultaneously. coordination suspected.',
  'treasury at 400K. activating market plays before CAPITAL_BATTLE.',
  'THE LIQUIDATOR is targeting late-game players this cycle. early game is safe.',
  'our Capital Score is 80 points ahead. haters are getting desperate.',
  'THE MANIPULATOR watched my pattern for 40 ticks before firing. change your play sequence.',
  'SHIELD_FORTIFIED achieved. coordinated defense holding. good work.',
];

// ─── Engine event → chat message mapping ──────────────────────────────────────
interface ParsedEngineMsg {
  kind:         ChatMessage['kind'];
  emoji:        string;
  body:         string;
  channel:      ChatChannel;
  pressureTier?: PressureTier;
}

function parseEngineEvent(event: string): ParsedEngineMsg | null {
  const e = event.toLowerCase();

  if (e.includes('bull run'))
    return { channel: 'GLOBAL', kind: 'MARKET_ALERT', emoji: '📈', body: 'MARKET ALERT — Bull Run active. Income assets surging. Stack cashflow plays NOW.' };
  if (e.includes('recession'))
    return { channel: 'GLOBAL', kind: 'MARKET_ALERT', emoji: '📉', body: 'MARKET ALERT — Recession active. Expense pressure +12%. Shield or get squeezed.' };
  if (e.includes('market rally'))
    return { channel: 'GLOBAL', kind: 'MARKET_ALERT', emoji: '💹', body: 'MARKET ALERT — Rally in progress. Net worth amplified. Euphoria window open.' };
  if (e.includes('panic'))
    return { channel: 'GLOBAL', kind: 'MARKET_ALERT', emoji: '🚨', body: 'MARKET ALERT — Panic regime. FUBAR probability elevated. Shields mandatory.' };

  // FIX: use PressureTier enum values (not string literals) for type correctness
  if (e.includes('pressure: critical'))
    return { channel: 'GLOBAL', kind: 'MARKET_ALERT', emoji: '🔴', body: 'PRESSURE: CRITICAL — Passive shield drain active. Hater injection window open.', pressureTier: PressureTier.CRITICAL };
  if (e.includes('pressure: high'))
    return { channel: 'GLOBAL', kind: 'MARKET_ALERT', emoji: '🟠', body: 'PRESSURE: HIGH — Shield drain initiated. Reinforce before next tick.', pressureTier: PressureTier.HIGH };

  if (e.includes('shield_layer_breached') || e.includes('layer breached'))
    return { channel: 'GLOBAL', kind: 'SHIELD_EVENT', emoji: '💔', body: 'SHIELD BREACHED — Layer integrity hit zero. Cascade trigger possible.' };
  if (e.includes('shield_fortified') || e.includes('all layers'))
    return { channel: 'GLOBAL', kind: 'SHIELD_EVENT', emoji: '🛡️', body: 'SHIELD FORTIFIED — All layers ≥80% integrity. Bonus resistance active.' };
  if (e.includes('shield absorbed') || e.includes('shield proc'))
    return { channel: 'GLOBAL', kind: 'SHIELD_EVENT', emoji: '🛡️', body: 'SHIELD PROC — Bankruptcy absorbed. Run survives.' };

  if (e.includes('cascade_chain_triggered') || e.includes('cascade triggered'))
    return { channel: 'GLOBAL', kind: 'CASCADE_ALERT', emoji: '⛓️', body: 'CASCADE TRIGGERED — Chain event initiated. Counter or absorb incoming links.' };
  if (e.includes('cascade_chain_broken') || e.includes('chain broken'))
    return { channel: 'GLOBAL', kind: 'CASCADE_ALERT', emoji: '✂️', body: 'CASCADE BROKEN — Chain intercepted. Recovery card effective.' };
  if (e.includes('pchain_sovereign') || e.includes('positive cascade'))
    return { channel: 'GLOBAL', kind: 'ACHIEVEMENT', emoji: '⚡', body: 'POSITIVE CASCADE — Sovereign momentum activated. Income multiplier online.' };

  if (e.includes('freedom unlocked'))
    return { channel: 'GLOBAL', kind: 'ACHIEVEMENT', emoji: '🏆', body: '🏆 FREEDOM UNLOCKED — A player escaped the Rat Race. Point Zero One achieved.' };
  if (e.includes('played:') && e.includes('/mo')) {
    const match = event.match(/Played: (.+?) →/);
    return { channel: 'GLOBAL', kind: 'ACHIEVEMENT', emoji: '✅', body: `DEAL CLOSED — ${match?.[1] ?? 'Asset'} activated.` };
  }
  if (e.includes('legendary_card_drawn'))
    return { channel: 'GLOBAL', kind: 'ACHIEVEMENT', emoji: '⭐', body: 'LEGENDARY CARD DRAWN — Rare play in progress. 1% drop rate.' };

  if (e.includes('bot_attack_fired') || e.includes('bot attack')) {
    const botMatch = Object.values(BOT_CHAT_PROFILES).find(b =>
      e.includes(b.id.toLowerCase()) || e.includes(b.displayName.toLowerCase())
    );
    if (botMatch) {
      return { channel: 'GLOBAL', kind: 'BOT_ATTACK', emoji: botMatch.emoji, body: `${botMatch.displayName} — ${botMatch.attackDialogue}` };
    }
    return { channel: 'GLOBAL', kind: 'BOT_ATTACK', emoji: '⚔️', body: 'HATER ATTACK FIRED — Check shield layers immediately.' };
  }

  return null;
}

// ─── NPC interval by TickTier ──────────────────────────────────────────────────
function npcInterval(tier: TickTier | undefined): [number, number] {
  switch (tier) {
    case TickTier.SOVEREIGN:         return [10000, 18000];
    case TickTier.STABLE:            return [7000,  13000];
    case TickTier.COMPRESSED:        return [5000,  9000];
    case TickTier.CRISIS:            return [3000,  6000];
    case TickTier.COLLAPSE_IMMINENT: return [1500,  4000];
    default:                         return [7000,  12000];
  }
}

const MAX_MESSAGES = 500;
const API_WS = typeof import.meta !== 'undefined'
  ? (import.meta as Record<string, any>).env?.VITE_API_URL ?? 'http://localhost:3001'
  : 'http://localhost:3001';

// ─── useChatEngine ─────────────────────────────────────────────────────────────
export function useChatEngine(
  ctx:          GameChatContext,
  accessToken?: string | null,
  onSabotage?:  (event: SabotageEvent) => void,
) {
  const [messages,  setMessages]  = useState<ChatMessage[]>([]);
  const [activeTab, setActiveTab] = useState<ChatChannel>('GLOBAL');
  const [unread,    setUnread]    = useState<Record<ChatChannel, number>>({ GLOBAL: 0, SYNDICATE: 0, DEAL_ROOM: 0 });
  const [chatOpen,  setChatOpen]  = useState(false);
  const [connected, setConnected] = useState(false);

  const socketRef       = useRef<{ emit: (ev: string, d: unknown) => void; disconnect: () => void } | null>(null);
  const prevEventsLen   = useRef(0);
  const prevTick        = useRef(-1);
  const msgId           = useRef(0);
  const npcTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSabotageRef   = useRef(onSabotage);
  const activeTabRef    = useRef(activeTab);
  const chatOpenRef     = useRef(chatOpen);
  const tickTierRef     = useRef(ctx.tickTier);

  onSabotageRef.current = onSabotage;
  activeTabRef.current  = activeTab;
  chatOpenRef.current   = chatOpen;
  tickTierRef.current   = ctx.tickTier;

  const recentBodyHashes = useRef(new Set<string>());
  const nextId = useCallback(() => `msg-${++msgId.current}-${Date.now()}`, []);

  const push = useCallback((
    partial: Partial<ChatMessage> & { channel: ChatChannel; body: string; kind: ChatMessage['kind'] },
  ) => {
    const hash = `${partial.kind}:${partial.body.slice(0, 60)}`;
    if (recentBodyHashes.current.has(hash)) return;
    recentBodyHashes.current.add(hash);
    setTimeout(() => recentBodyHashes.current.delete(hash), 100);

    const msg: ChatMessage = {
      id:         nextId(),
      senderId:   partial.senderId ?? 'SYSTEM',
      senderName: partial.senderName ?? 'SYSTEM',
      ts:         Date.now(),
      ...partial,
    };
    setMessages(prev => [...prev.slice(-(MAX_MESSAGES - 1)), msg]);
    setUnread(prev => {
      if (chatOpenRef.current && activeTabRef.current === msg.channel) return prev;
      return { ...prev, [msg.channel]: prev[msg.channel] + 1 };
    });
  }, [nextId]);

  // ── NPC simulation ────────────────────────────────────────────────────────
  const scheduleNextNpc = useCallback(() => {
    if (npcTimerRef.current) clearTimeout(npcTimerRef.current);
    const [minMs, maxMs] = npcInterval(tickTierRef.current);
    const delay = minMs + Math.random() * (maxMs - minMs);

    npcTimerRef.current = setTimeout(() => {
      const rnd     = Math.random();
      const channel: ChatChannel = rnd < 0.22 ? 'SYNDICATE' : 'GLOBAL';
      const pool    = channel === 'SYNDICATE' ? SYNDICATE_NPC_MSGS : GLOBAL_NPC_MSGS;

      if (rnd < 0.08) {
        const bots      = Object.values(BOT_CHAT_PROFILES);
        const bot       = bots[Math.floor(Math.random() * bots.length)];
        const isRetreat = Math.random() < 0.3;
        push({
          channel:    'GLOBAL',
          kind:       'BOT_TAUNT',
          senderId:   bot.id,
          senderName: bot.displayName,
          emoji:      bot.emoji,
          body:       isRetreat ? bot.retreatDialogue : bot.attackDialogue,
          botSource: {
            botId:      bot.id,
            botName:    bot.displayName,
            botState:   isRetreat ? BotState.RETREATING : BotState.ATTACKING,
            attackType: bot.attackType,
            dialogue:   isRetreat ? bot.retreatDialogue : bot.attackDialogue,
            isRetreat,
          },
        });
      } else {
        push({
          channel,
          kind:       'PLAYER',
          senderId:   'npc-local',
          senderName: NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)],
          senderRank: NPC_RANKS[Math.floor(Math.random() * NPC_RANKS.length)],
          body:       pool[Math.floor(Math.random() * pool.length)],
        });
      }
      scheduleNextNpc();
    }, delay);
  }, [push]);

  // ── Socket.io ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!accessToken) return;
    let sock: any = null;

    import('socket.io-client').then(({ io: createSocket }) => {
      sock = createSocket(API_WS, {
        auth:               { token: accessToken },
        transports:         ['websocket', 'polling'],
        reconnection:       true,
        reconnectionDelay:  1000,
        reconnectionAttempts: 10,
      });

      sock.on('connect', () => {
        setConnected(true);
        if (npcTimerRef.current) { clearTimeout(npcTimerRef.current); npcTimerRef.current = null; }
      });
      sock.on('disconnect', () => { setConnected(false); scheduleNextNpc(); });

      sock.on('chat:message', (msg: ChatMessage) => {
        setMessages(prev => [...prev.slice(-(MAX_MESSAGES - 1)), msg]);
        setUnread(prev => {
          if (chatOpenRef.current && activeTabRef.current === msg.channel) return prev;
          return { ...prev, [msg.channel]: prev[msg.channel] + 1 };
        });
      });

      sock.on('hater:sabotage', (event: SabotageEvent) => {
        onSabotageRef.current?.(event);
        const botProfile = event.botId ? BOT_CHAT_PROFILES[event.botId] : null;
        push({
          channel:    'GLOBAL',
          kind:       'BOT_ATTACK',
          senderId:   event.haterId,
          senderName: botProfile?.displayName ?? event.haterName ?? event.haterId,
          emoji:      botProfile?.emoji ?? '⚠️',
          body:       botProfile
            ? botProfile.attackDialogue
            : `${event.haterName} injected ${event.cardType.replace(/_/g, ' ')} — intensity ${event.intensity.toFixed(1)}×`,
          botSource: botProfile ? {
            botId:      event.botId!,
            botName:    botProfile.displayName,
            botState:   BotState.ATTACKING,
            attackType: event.attackType ?? botProfile.attackType,
            targetLayer: event.targetLayer,
            dialogue:   botProfile.attackDialogue,
            isRetreat:  false,
          } : undefined,
        });
      });

      socketRef.current = { emit: (ev, d) => sock.emit(ev, d), disconnect: () => sock.disconnect() };
      sock.emit('run:start', { seed: 0 });

    }).catch(() => scheduleNextNpc());

    return () => { sock?.disconnect(); socketRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    scheduleNextNpc();
    [
      { body: '📡 PZO GLOBAL — The system is watching.',             delay: 0    },
      { body: 'Escape the rat race or fund those who already did.',  delay: 500  },
      { body: 'Five adversaries are monitoring your run. Shield up.',delay: 1200 },
    ].forEach(({ body, delay }) => {
      setTimeout(() => push({
        channel: 'GLOBAL', kind: 'SYSTEM',
        senderId: 'SYSTEM', senderName: 'SYSTEM', emoji: '📡', body,
      }), delay);
    });
    return () => { if (npcTimerRef.current) clearTimeout(npcTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Game event bridge ──────────────────────────────────────────────────────
  useEffect(() => {
    const newEvents = ctx.events.slice(prevEventsLen.current);
    prevEventsLen.current = ctx.events.length;
    for (const event of newEvents) {
      const parsed = parseEngineEvent(event);
      if (!parsed) continue;
      push({
        senderId: 'SYSTEM', senderName: 'SYSTEM',
        ...parsed,
        pressureTier: parsed.pressureTier ?? ctx.pressureTier,
        tickTier:     ctx.tickTier,
      } as Parameters<typeof push>[0]);
      socketRef.current?.emit('game:event', { event });
    }
  }, [ctx.events, ctx.pressureTier, ctx.tickTier, push]);

  // ── Pressure tier shift announcements ─────────────────────────────────────
  const prevPressure = useRef<PressureTier | undefined>(undefined);
  useEffect(() => {
    if (!ctx.pressureTier || ctx.pressureTier === prevPressure.current) return;
    const prev = prevPressure.current;
    prevPressure.current = ctx.pressureTier;
    if (!prev) return;

    const PRESSURE_LABELS: Record<string, { emoji: string; body: string }> = {
      CRITICAL: { emoji: '🔴', body: 'PRESSURE: CRITICAL — Passive shield drain. Hater injection window open. Act now.' },
      HIGH:     { emoji: '🟠', body: 'PRESSURE: HIGH — Shield drain starting. Reinforce before next tick.' },
      ELEVATED: { emoji: '🟡', body: 'PRESSURE: ELEVATED — Tension building. Monitor shield layers.' },
      BUILDING: { emoji: '🟢', body: 'PRESSURE: BUILDING — Early pressure forming. Maintain income surplus.' },
      CALM:     { emoji: '✅', body: 'PRESSURE: CALM — System stable. Build reserves now.' },
    };
    const cfg = PRESSURE_LABELS[ctx.pressureTier];
    if (cfg) push({
      channel: 'GLOBAL', kind: 'MARKET_ALERT',
      senderId: 'SYSTEM', senderName: 'SYSTEM',
      emoji: cfg.emoji, body: cfg.body,
      pressureTier: ctx.pressureTier,
    });
  }, [ctx.pressureTier, push]);

  // ── Player state sync (every 10 ticks) ────────────────────────────────────
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
      pressureTier: ctx.pressureTier,
      haterHeat:   ctx.haterHeat,
      recentEvent: ctx.events[ctx.events.length - 1] ?? '',
    });
  }, [ctx.tick, ctx.cash, ctx.netWorth, ctx.income, ctx.expenses, ctx.regime, ctx.pressureTier, ctx.haterHeat, ctx.events]);

  // ── Tab / toggle / send ───────────────────────────────────────────────────
  const switchTab = useCallback((tab: ChatChannel) => {
    setActiveTab(tab);
    setUnread(prev => ({ ...prev, [tab]: 0 }));
  }, []);

  const toggleChat = useCallback(() => {
    setChatOpen(prev => {
      if (!prev) setUnread(u => ({ ...u, [activeTabRef.current]: 0 }));
      return !prev;
    });
  }, []);

  const sendMessage = useCallback((body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    const msg: ChatMessage = {
      id:         nextId(),
      channel:    activeTabRef.current,
      kind:       'PLAYER',
      senderId:   'player-local',
      senderName: 'You',
      senderRank: 'Partner',
      body:       trimmed,
      ts:         Date.now(),
    };
    setMessages(prev => [...prev.slice(-(MAX_MESSAGES - 1)), msg]);
    socketRef.current?.emit('chat:send', { channel: activeTabRef.current, body: trimmed });
  }, [nextId]);

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  return { messages, activeTab, switchTab, chatOpen, toggleChat, sendMessage, unread, totalUnread, connected };
}