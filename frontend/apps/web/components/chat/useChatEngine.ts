/**
 * useChatEngine.ts — PZO Sovereign Chat · v4 · Kernel-Integrated
 * ─────────────────────────────────────────────────────────────────────────────
 * UPGRADED from pzo-web/src/components/chat/useChatEngine.ts
 *
 * v4 CHANGES:
 *   - Wired to SovereignChatKernel for ML-adaptive dialogue
 *   - Cold-start learning from first message
 *   - Privacy guard integration (mute/block/report)
 *   - Channel routing (GLOBAL/SYNDICATE/DM/DEAL_ROOM/SPECTATOR)
 *   - NPC simulation uses HelperCharacters + expanded bot dialogue
 *   - No engine package imports — self-contained for Next.js
 *   - Works in both lobby (pre-run) and game (in-run) contexts
 *
 * FILE LOCATION: frontend/apps/web/components/chat/useChatEngine.ts
 * Density6 LLC · Point Zero One · Confidential
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ChatChannel, ChatMessage, GameChatContext, SabotageEvent } from './chatTypes';
import { chatKernel } from './SovereignChatKernel';
import { privacyGuard } from './ChatPrivacyGuard';
import { channelRouter } from './ChatChannelRouter';
import type { GameEventType } from './GameEventChatBridge';

export type { SabotageEvent };

// ─── NPC player pool ───────────────────────────────────────────────────────────

const NPC_NAMES = [
  'CashflowKing_ATL', 'SovereignSyd', 'RatRaceEscaper', 'PassivePhil',
  'LiquidityLord', 'DebtFreeDevin', 'YieldHunterJax', 'NetWorthNora',
  'CompoundKing_T', 'CapitalQueen_R', 'ArbitrageAndy', 'DividendDave',
  'EquityElla', 'CashCowCarlos', 'FreedomFund_Z', 'Syndicate_Reese',
  'BigDealBrendan', 'SmallDealSophie', 'LedgerLionel', 'TreasurySam',
  'SovereignSophia', 'BreachBreaker_99', 'ShieldStacker_X', 'MomentumMarcus',
];

const NPC_RANKS = ['Associate', 'Junior Partner', 'Partner', 'Senior Partner'];

const GLOBAL_NPC_MSGS = [
  'anyone surviving the new difficulty? this thing is BRUTAL 😅',
  'tip: hold 3 shields minimum before tick 200. learned that the hard way.',
  'THE LIQUIDATOR just stripped my best income card mid-run. not okay.',
  'finally broke $100K net worth. THE CRASH PROPHET immediately fired an expense injection.',
  'freedom is real. I escaped. took 31 attempts but I\'m here.',
  'who else is learning more about real finance from this game than school ever taught?',
  'pro tip: stack income assets first. don\'t touch OPPORTUNITY cards until income > expenses.',
  'just hit passive > expenses. THE MANIPULATOR immediately started pattern-matching my plays.',
  'the card forcing mechanic is so real. life hits you with FUBARs you didn\'t choose.',
  'shield fortified = income buffer. never play aggressive without it.',
  'income > expenses is step one. sovereignty is the whole game.',
  'THE BUREAUCRAT targeting players with 3+ income streams is diabolical game design.',
  'new player here — any tips for first run?',
  'just watched someone hit sovereignty on their 3rd run. HOW.',
  'the fact that this game teaches you real financial principles while being fun is insane',
  'CRASH PROPHET triggers when you least expect it. always hedge macro.',
];

// ─── NPC interval by game state ────────────────────────────────────────────────

function npcIntervalMs(isInRun: boolean, tick: number): [number, number] {
  if (!isInRun) return [6000, 14000]; // Lobby: moderate chatter
  if (tick < 50)  return [8000, 15000]; // Early game: slower
  if (tick < 200) return [5000, 10000]; // Mid game: moderate
  if (tick < 400) return [3000, 7000];  // Late game: faster
  return [2000, 5000];                  // End game: intense
}

const MAX_MESSAGES = 500;

// ─── Hook ──────────────────────────────────────────────────────────────────────

export interface UseChatEngineOptions {
  /** Game context — pass null for lobby mode */
  gameContext?:  GameChatContext | null;
  /** Player ID for learning profile */
  playerId?:    string;
  /** Game mode (solo, co-op, etc.) */
  mode?:        string;
  /** Whether chat is in lobby (pre-run) or game (in-run) mode */
  isLobby?:     boolean;
  /** Callback when sabotage event fires */
  onSabotage?:  (event: SabotageEvent) => void;
}

export function useChatEngine(options: UseChatEngineOptions = {}) {
  const {
    gameContext = null,
    playerId = 'anonymous',
    mode = 'solo',
    isLobby = false,
    onSabotage,
  } = options;

  const [messages,  setMessages]  = useState<ChatMessage[]>([]);
  const [activeTab, setActiveTab] = useState<ChatChannel>('GLOBAL');
  const [unread,    setUnread]    = useState<Record<ChatChannel, number>>(
    { GLOBAL: 0, SYNDICATE: 0, DEAL_ROOM: 0, DM: 0, SPECTATOR: 0 },
  );
  const [chatOpen,  setChatOpen]  = useState(false);

  const npcTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTabRef  = useRef(activeTab);
  const chatOpenRef   = useRef(chatOpen);
  const msgIdRef      = useRef(0);
  const onSabotageRef = useRef(onSabotage);

  activeTabRef.current  = activeTab;
  chatOpenRef.current   = chatOpen;
  onSabotageRef.current = onSabotage;

  const nextId = useCallback(() => `msg-${++msgIdRef.current}-${Date.now()}`, []);

  // ── Push message into state ──────────────────────────────────────────────

  const pushMessages = useCallback((newMsgs: ChatMessage[]) => {
    const filtered = newMsgs.filter(m => {
      if (!privacyGuard.shouldShowMessage(m)) return false;
      if (!privacyGuard.enforceDMPrivacy(m)) return false;
      return true;
    });
    if (filtered.length === 0) return;

    setMessages(prev => {
      const combined = [...prev, ...filtered];
      return combined.slice(-MAX_MESSAGES);
    });

    setUnread(prev => {
      const updated = { ...prev };
      for (const msg of filtered) {
        if (chatOpenRef.current && activeTabRef.current === msg.channel) continue;
        updated[msg.channel] = (updated[msg.channel] ?? 0) + 1;
      }
      return updated;
    });
  }, []);

  // ── Subscribe to kernel messages ─────────────────────────────────────────

  useEffect(() => {
    const unsub = chatKernel.onMessages(pushMessages);
    return unsub;
  }, [pushMessages]);

  // ── Set mode on channel router ───────────────────────────────────────────

  useEffect(() => {
    channelRouter.setMode(mode);
  }, [mode]);

  // ── Update game context on kernel ────────────────────────────────────────

  useEffect(() => {
    if (gameContext) {
      chatKernel.updateGameContext(gameContext);
    }
  }, [gameContext]);

  // ── NPC simulation ───────────────────────────────────────────────────────

  const scheduleNextNpc = useCallback(() => {
    if (npcTimerRef.current) clearTimeout(npcTimerRef.current);

    const tick = gameContext?.tick ?? 0;
    const [minMs, maxMs] = npcIntervalMs(!isLobby && !!gameContext, tick);
    const delay = minMs + Math.random() * (maxMs - minMs);

    npcTimerRef.current = setTimeout(() => {
      const npcName = NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)];
      const npcRank = NPC_RANKS[Math.floor(Math.random() * NPC_RANKS.length)];
      const body    = GLOBAL_NPC_MSGS[Math.floor(Math.random() * GLOBAL_NPC_MSGS.length)];

      const msg: ChatMessage = {
        id:         nextId(),
        channel:    'GLOBAL',
        kind:       'PLAYER',
        senderId:   `npc_${npcName}`,
        senderName: npcName,
        senderRank: npcRank,
        body,
        ts:         Date.now(),
      };

      pushMessages([msg]);
      scheduleNextNpc();
    }, delay);
  }, [gameContext, isLobby, nextId, pushMessages]);

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  useEffect(() => {
    // Start NPC chatter
    scheduleNextNpc();

    // Welcome messages
    const welcomeMessages: ChatMessage[] = isLobby
      ? [
          {
            id: nextId(), channel: 'GLOBAL', kind: 'SYSTEM',
            senderId: 'SYSTEM', senderName: 'SYSTEM', emoji: '📡',
            body: '📡 PZO GLOBAL — The system is watching. Choose your mode.',
            ts: Date.now(),
          },
        ]
      : [
          {
            id: nextId(), channel: 'GLOBAL', kind: 'SYSTEM',
            senderId: 'SYSTEM', senderName: 'SYSTEM', emoji: '📡',
            body: '📡 PZO GLOBAL — Run initialized. Five adversaries are monitoring.',
            ts: Date.now(),
          },
          {
            id: nextId(), channel: 'GLOBAL', kind: 'SYSTEM',
            senderId: 'SYSTEM', senderName: 'SYSTEM',
            body: 'Escape the rat race or fund those who already did.',
            ts: Date.now() + 500,
          },
        ];

    pushMessages(welcomeMessages);

    // If lobby mode, fire lobby taunts from bots after a delay
    if (isLobby) {
      setTimeout(() => {
        chatKernel.processGameEvent('RUN_STARTED', { mode, goal: '', archetype: '' });
      }, 2000);
    }

    return () => {
      if (npcTimerRef.current) clearTimeout(npcTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tab / toggle ──────────────────────────────────────────────────────────

  const switchTab = useCallback((tab: ChatChannel) => {
    setActiveTab(tab);
    setUnread(prev => ({ ...prev, [tab]: 0 }));
  }, []);

  const toggleChat = useCallback(() => {
    setChatOpen(prev => {
      const next = !prev;
      if (next) {
        chatKernel.trackChatOpen();
        setUnread(u => ({ ...u, [activeTabRef.current]: 0 }));
      } else {
        chatKernel.trackChatClose();
      }
      return next;
    });
  }, []);

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback((body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return;

    // Content assessment
    const assessment = privacyGuard.assessContent(trimmed);
    if (!assessment.safe && assessment.flags.includes('SEVERE_CONTENT')) {
      // Don't send, but show a system message to the player
      pushMessages([{
        id: nextId(), channel: activeTabRef.current, kind: 'SYSTEM',
        senderId: 'SYSTEM', senderName: 'SYSTEM',
        body: '⚠️ Message not sent. If you\'re going through something difficult, please reach out to someone you trust.',
        ts: Date.now(),
      }]);
      return;
    }

    // Route through kernel (triggers bot reactions, ML learning, etc.)
    chatKernel.processPlayerMessage(trimmed, activeTabRef.current);
  }, [nextId, pushMessages]);

  // ── Process game event (called by GameShell/parent) ───────────────────────

  const processGameEvent = useCallback((eventType: GameEventType, payload: Record<string, any> = {}) => {
    chatKernel.processGameEvent(eventType, payload);
  }, []);

  // ── Mute/Block/Report ────────────────────────────────────────────────────

  const muteSender = useCallback((senderId: string, senderName: string, type: 'BOT' | 'NPC' | 'PLAYER') => {
    privacyGuard.mute(senderId, senderName, type);
    // Re-filter existing messages
    setMessages(prev => prev.filter(m => privacyGuard.shouldShowMessage(m)));
  }, []);

  const unmuteSender = useCallback((senderId: string) => {
    privacyGuard.unmute(senderId);
  }, []);

  const blockSender = useCallback((senderId: string) => {
    privacyGuard.block(senderId);
    setMessages(prev => prev.filter(m => privacyGuard.shouldShowMessage(m)));
  }, []);

  const reportMessage = useCallback((message: ChatMessage, reason: 'HARASSMENT' | 'SPAM' | 'INAPPROPRIATE' | 'CHEATING' | 'OTHER') => {
    return privacyGuard.report(message.senderId, message.senderName, reason, message);
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);
  const availableChannels = channelRouter.getAvailableChannels();
  const visibleMessages = messages.filter(m => m.channel === activeTab);
  const learningProfile = chatKernel.getProfile();

  return {
    // State
    messages: visibleMessages,
    allMessages: messages,
    activeTab,
    chatOpen,
    unread,
    totalUnread,
    availableChannels,
    learningProfile,

    // Actions
    switchTab,
    toggleChat,
    sendMessage,
    processGameEvent,

    // Privacy
    muteSender,
    unmuteSender,
    blockSender,
    reportMessage,
    getMutedList: () => privacyGuard.getMutedList(),
  };
}
