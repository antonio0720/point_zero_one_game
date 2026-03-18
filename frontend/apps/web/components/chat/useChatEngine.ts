/** App-shell chat hook built on canonical package runtime. */
'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { OmnipresentChatDock, useOmnipresentChatRuntime, type ChatChannel, type ChatMessage, type GameEventType } from '@pzo/engine';
import { privacyGuard } from './ChatPrivacyGuard';
import { channelRouter } from './ChatChannelRouter';
import { chatKernel } from './SovereignChatKernel';

export interface GameChatContext {
  tick: number;
  cash: number;
  regime: string;
  events: string[];
  netWorth: number;
  income: number;
  expenses: number;
  pressureTier?: string;
  tickTier?: string;
  haterHeat?: number;
  activeBotsCount?: number;
  weakestLayerId?: string;
  shieldIntegrityPct?: number;
  breachCascade?: boolean;
  negativeCascadeCount?: number;
  positiveCascadeCount?: number;
  sovereigntyGrade?: string;
  proofHash?: string;
  pipelineStatus?: string;
  lifecycleState?: string;
  runId?: string;
}

export interface UseChatEngineOptions {
  gameContext?: GameChatContext | null;
  playerId?: string;
  displayName?: string;
  mode?: string;
  isLobby?: boolean;
}

const NPC_NAMES = ['CashflowKing_ATL', 'SovereignSyd', 'RatRaceEscaper', 'PassivePhil', 'LiquidityLord', 'DebtFreeDevin'];
const NPC_LINES = [
  'Pressure is up. Don’t sprint into a weak shield stack.',
  'Income before ego. Every time.',
  'Predator mode punishes sloppy sequencing.',
  'Phantom rewards precision more than speed.',
  'Syndicate runs die when partners overextend cash too early.',
];

function npcInterval(isLobby: boolean, tick: number): [number, number] {
  if (isLobby) return [7000, 14000];
  if (tick < 100) return [6000, 12000];
  if (tick < 300) return [4000, 9000];
  return [2500, 7000];
}

export function useChatEngine(options: UseChatEngineOptions = {}) {
  const {
    gameContext = null,
    playerId = 'player-local',
    displayName = 'You',
    mode = 'solo',
    isLobby = !gameContext,
  } = options;

  channelRouter.setMode(mode);

  const runtime = useOmnipresentChatRuntime({
    currentUserId: playerId,
    displayName,
    mode,
    isLobby,
    defaultOpen: isLobby,
    defaultPanel: 'GLOBAL',
    initialContext: gameContext ?? undefined,
  });

  const npcTimerRef = useRef<number | null>(null);
  const lastContextRef = useRef<GameChatContext | null>(gameContext ?? null);

  const filteredMessages = useMemo(() => runtime.messages.filter((message) => privacyGuard.shouldShowMessage(message as ChatMessage) && privacyGuard.enforceDMPrivacy(message as ChatMessage)), [runtime.messages]);

  const scheduleNpc = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (npcTimerRef.current) window.clearTimeout(npcTimerRef.current);
    const [minMs, maxMs] = npcInterval(isLobby, gameContext?.tick ?? 0);
    const delay = minMs + Math.random() * (maxMs - minMs);
    npcTimerRef.current = window.setTimeout(() => {
      runtime.injectMessages([{ id: `npc_${Date.now()}`, channel: 'GLOBAL', kind: 'PLAYER', senderId: `npc_${Date.now()}`, senderName: NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)], body: NPC_LINES[Math.floor(Math.random() * NPC_LINES.length)], createdAt: new Date().toISOString() }]);
      scheduleNpc();
    }, delay);
  }, [gameContext?.tick, isLobby, runtime]);

  useEffect(() => {
    const unsub = chatKernel.onMessages((messages) => runtime.injectMessages(messages));
    return unsub;
  }, [runtime]);

  useEffect(() => {
    runtime.updateContext(gameContext ?? {});
    const prev = lastContextRef.current;
    lastContextRef.current = gameContext ?? null;
    if (!gameContext) return;
    if ((prev?.pressureTier ?? null) !== (gameContext.pressureTier ?? null) && gameContext.pressureTier) {
      runtime.processGameEvent('PRESSURE_TIER_CHANGED', { tier: gameContext.pressureTier });
    }
    if ((prev?.activeBotsCount ?? 0) !== (gameContext.activeBotsCount ?? 0) && (gameContext.activeBotsCount ?? 0) > (prev?.activeBotsCount ?? 0)) {
      runtime.processGameEvent('BOT_ATTACK', { body: `${gameContext.activeBotsCount} active bot contacts.`, targetLayer: gameContext.weakestLayerId });
    }
    if (!prev?.breachCascade && gameContext.breachCascade) {
      runtime.processGameEvent('SHIELD_BREACH', { layerId: gameContext.weakestLayerId });
    }
    if ((gameContext.negativeCascadeCount ?? 0) > (prev?.negativeCascadeCount ?? 0)) {
      runtime.processGameEvent('CASCADE_TRIGGERED', { chainId: `NEG-${gameContext.negativeCascadeCount}` });
    }
    if ((prev?.sovereigntyGrade ?? null) !== (gameContext.sovereigntyGrade ?? null) && gameContext.sovereigntyGrade) {
      runtime.processGameEvent('SOVEREIGNTY_GRADE_CHANGED', { grade: gameContext.sovereigntyGrade, proofHash: gameContext.proofHash });
    }
    if ((prev?.pipelineStatus ?? null) !== (gameContext.pipelineStatus ?? null) && gameContext.pipelineStatus) {
      runtime.processGameEvent('PIPELINE_STATUS_CHANGED', { status: gameContext.pipelineStatus, proofHash: gameContext.proofHash });
    }
    if ((prev?.lifecycleState ?? null) !== (gameContext.lifecycleState ?? null) && gameContext.lifecycleState) {
      runtime.processGameEvent(gameContext.lifecycleState === 'ACTIVE' ? 'RUN_STARTED' : 'SYSTEM', { body: `Lifecycle ${gameContext.lifecycleState}.`, mode });
    }
  }, [gameContext, mode, runtime]);

  useEffect(() => {
    scheduleNpc();
    return () => {
      if (typeof window !== 'undefined' && npcTimerRef.current) window.clearTimeout(npcTimerRef.current);
    };
  }, [scheduleNpc]);

  const switchTab = useCallback((tab: ChatChannel) => runtime.switchPanel(tab), [runtime]);
  const toggleChat = useCallback(() => runtime.toggleOpen(), [runtime]);
  const sendMessage = useCallback(async (body: string) => {
    const assessment = privacyGuard.assessContent(body);
    if (!assessment.safe) {
      runtime.injectMessages([{ id: `guard_${Date.now()}`, channel: runtime.visibleChannel, kind: 'SYSTEM', senderId: 'SYSTEM', senderName: 'SYSTEM', body: 'Message not sent. Reach out to someone you trust if you are in crisis.', createdAt: new Date().toISOString(), immutable: true }]);
      return;
    }
    await runtime.sendMessage(body, runtime.visibleChannel);
    chatKernel.processPlayerMessage(body);
  }, [runtime]);

  const muteSender = useCallback((senderId: string, senderName: string, type: 'BOT' | 'NPC' | 'PLAYER') => privacyGuard.mute(senderId, senderName, type), []);
  const unmuteSender = useCallback((senderId: string) => privacyGuard.unmute(senderId), []);
  const blockSender = useCallback((senderId: string) => privacyGuard.block(senderId), []);
  const reportMessage = useCallback((message: ChatMessage, reason: 'HARASSMENT' | 'SPAM' | 'INAPPROPRIATE' | 'CHEATING' | 'OTHER') => privacyGuard.report(message.senderId, message.senderName, reason, message), []);
  const processGameEvent = useCallback((type: GameEventType, payload: Record<string, unknown> = {}) => { runtime.processGameEvent(type, payload); chatKernel.processGameEvent(type, payload); }, [runtime]);

  return {
    messages: filteredMessages,
    allMessages: runtime.allMessages.filter((message) => privacyGuard.shouldShowMessage(message as ChatMessage)),
    activeTab: runtime.visibleChannel,
    chatOpen: runtime.isOpen,
    unread: runtime.unread,
    totalUnread: runtime.totalUnread,
    availableChannels: channelRouter.getAvailableChannels(isLobby),
    learningProfile: runtime.learningProfile,
    runtime,
    switchTab,
    toggleChat,
    sendMessage,
    processGameEvent,
    muteSender,
    unmuteSender,
    blockSender,
    reportMessage,
    getMutedList: () => privacyGuard.getMutedList(),
  };
}

export { OmnipresentChatDock };
