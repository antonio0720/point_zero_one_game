/**
 * ============================================================================
 * @pzo/engine/chat — Omnipresent package runtime
 * FILE: frontend/packages/engine/src/chat/runtime.ts
 * ----------------------------------------------------------------------------
 * Purpose
 * - Package-level omnipresent chat runtime for pzo-web and platform-shell adoption
 * - Owns client-side panel state, unread state, room state, rivalry state,
 *   runtime message injection, and game-event -> chat projection
 * - Exposes both:
 *     1) pure model builders for package consumers
 *     2) a React hook for client runtime usage
 *
 * Design rules
 * - Package contracts remain sourced from ./types
 * - Presentation shaping remains sourced from ./adapters
 * - Runtime stays transport-agnostic: remote send is caller-injected
 * - Channels stay aligned to current package contracts:
 *     GLOBAL | SERVER | SYNDICATE | DEAL_ROOM | DIRECT
 * ============================================================================
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  coerceRivalryPhase,
  deriveDealRoomFromRivalry,
  deriveTabs,
  normalizeAllianceState,
  normalizeDealRoomState,
  normalizeRooms,
  readRecord,
  safeBoolean,
  safeIsoDate,
  safeNumber,
  safeString,
} from './adapters';

import type {
  ActiveRivalry,
  AlliancePanelState,
  ChatChannel,
  DealRoomState,
  MarketMoveAlertPayload,
  OmnipresentChatModel,
  PackageChatMessage,
  PackageChatRoom,
  RoomMember,
  RoomType,
  RivalryPhase,
} from './types';

/* ============================================================================
 * Runtime-local public types
 * ========================================================================== */

export type ChatPanelView = ChatChannel | 'ROOMS';

export type GameEventType =
  | 'RUN_STARTED'
  | 'RUN_ENDED'
  | 'PRESSURE_TIER_CHANGED'
  | 'BOT_ATTACK'
  | 'SHIELD_BREACH'
  | 'CASCADE_TRIGGERED'
  | 'SOVEREIGNTY_GRADE_CHANGED'
  | 'PIPELINE_STATUS_CHANGED'
  | 'RIVALRY_PHASE_CHANGED'
  | 'MARKET_ALERT'
  | 'SYSTEM';

export interface LearningProfileSnapshot {
  readonly dominantTone: 'UNKNOWN' | 'CALM' | 'QUESTION' | 'ANGRY' | 'TROLL' | 'FLEX';
  readonly messagesSent: number;
  readonly recentPressureMentions: number;
  readonly recentMoneyMentions: number;
  readonly recentBotMentions: number;
}

export interface OmnipresentChatContext {
  readonly mode?: string | null;
  readonly lifecycleState?: string | null;
  readonly pressureTier?: string | null;
  readonly activeBotsCount?: number | null;
  readonly breachCascade?: boolean | null;
  readonly weakestLayerId?: string | null;
  readonly negativeCascadeCount?: number | null;
  readonly sovereigntyGrade?: string | null;
  readonly pipelineStatus?: string | null;
  readonly proofHash?: string | null;
  readonly rivalryId?: string | null;
  readonly title?: string | null;
  readonly subtitle?: string | null;
  readonly [key: string]: unknown;
}

export interface PackageChatRuntimeInput {
  readonly currentUserId: string;
  readonly activeChannel?: ChatPanelView;
  readonly visibleChannel?: ChatChannel;
  readonly messages?: readonly PackageChatMessage[];
  readonly rooms?: readonly PackageChatRoom[];
  readonly alliance?: Partial<AlliancePanelState>;
  readonly rivalry?: ActiveRivalry | null;
  readonly dealRoom?: Partial<DealRoomState> | null;
  readonly title?: string;
  readonly subtitle?: string;
}

export interface PackageChatRuntimeOptions {
  readonly currentUserId: string;
  readonly displayName?: string;
  readonly mode?: string;
  readonly isLobby?: boolean;
  readonly defaultOpen?: boolean;
  readonly defaultPanel?: ChatPanelView;
  readonly title?: string;
  readonly subtitle?: string;
  readonly initialMessages?: readonly PackageChatMessage[];
  readonly initialRooms?: readonly PackageChatRoom[];
  readonly initialAlliance?: Partial<AlliancePanelState>;
  readonly initialRivalry?: ActiveRivalry | null;
  readonly initialContext?: Partial<OmnipresentChatContext>;
  readonly maxMessages?: number;
  readonly onSendRemote?: (message: PackageChatMessage) => Promise<void> | void;
}

export interface OmnipresentChatRuntimeApi {
  readonly currentUserId: string;
  readonly isOpen: boolean;
  readonly activePanel: ChatPanelView;
  readonly visibleChannel: ChatChannel;
  readonly messages: readonly PackageChatMessage[];
  readonly allMessages: readonly PackageChatMessage[];
  readonly unread: Record<ChatChannel, number>;
  readonly totalUnread: number;
  readonly availableChannels: readonly ChatChannel[];
  readonly rooms: readonly PackageChatRoom[];
  readonly activeRoomId: string | null;
  readonly alliance: AlliancePanelState;
  readonly activeRivalry: ActiveRivalry | null;
  readonly dealRoom: DealRoomState | null;
  readonly context: OmnipresentChatContext;
  readonly learningProfile: LearningProfileSnapshot;
  readonly model: OmnipresentChatModel;
  readonly tabs: OmnipresentChatModel['tabs'];
  readonly toggleOpen: () => void;
  readonly setOpen: (next: boolean) => void;
  readonly switchPanel: (panel: ChatPanelView) => void;
  readonly sendMessage: (body: string, channel?: ChatChannel) => Promise<void>;
  readonly injectMessages: (nextMessages: readonly PackageChatMessage[]) => void;
  readonly processGameEvent: (type: GameEventType, payload?: Record<string, unknown>) => void;
  readonly updateContext: (next: Partial<OmnipresentChatContext>) => void;
  readonly createRoom: (
    name: string,
    type: RoomType,
    maxMembers: number,
    inviteOnly: boolean,
  ) => Promise<string>;
  readonly joinRoom: (roomId: string, inviteToken?: string) => Promise<void>;
  readonly leaveRoom: (roomId: string) => Promise<void>;
  readonly selectRoom: (roomId: string) => void;
  readonly setRivalry: (rivalry: ActiveRivalry | null) => void;
}

/* ============================================================================
 * Constants
 * ========================================================================== */

const MAX_DEFAULT_MESSAGES = 400;

const DEFAULT_CHANNELS: readonly ChatChannel[] = [
  'GLOBAL',
  'SYNDICATE',
  'DEAL_ROOM',
  'DIRECT',
  'SERVER',
] as const;

const EMPTY_UNREAD: Record<ChatChannel, number> = {
  GLOBAL: 0,
  SERVER: 0,
  SYNDICATE: 0,
  DEAL_ROOM: 0,
  DIRECT: 0,
};

const EMPTY_PROFILE: LearningProfileSnapshot = {
  dominantTone: 'UNKNOWN',
  messagesSent: 0,
  recentPressureMentions: 0,
  recentMoneyMentions: 0,
  recentBotMentions: 0,
};

/* ============================================================================
 * Utilities
 * ========================================================================== */

function nowTs(): number {
  return Date.now();
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function resolveVisibleChannel(
  activeChannel: ChatPanelView | undefined,
  visibleChannel: ChatChannel | undefined,
): ChatChannel {
  if (visibleChannel) return visibleChannel;
  if (!activeChannel || activeChannel === 'ROOMS') return 'GLOBAL';
  return activeChannel;
}

function dedupeMessages(messages: readonly PackageChatMessage[]): PackageChatMessage[] {
  const seen = new Set<string>();
  const output: PackageChatMessage[] = [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    output.push(message);
  }

  output.reverse();
  return output.sort((a, b) => a.ts - b.ts);
}

function mergeMessages(
  prev: readonly PackageChatMessage[],
  next: readonly PackageChatMessage[],
  maxMessages: number,
): PackageChatMessage[] {
  return dedupeMessages([...prev, ...next]).slice(-maxMessages);
}

function defaultAlliance(): AlliancePanelState {
  return normalizeAllianceState({
    syndicateName: 'Syndicate',
    syndicateBanner: '',
    partnerRank: 'ASSOCIATE',
    memberCount: 1,
    treasuryBalance: 0,
    liquidityShieldExpiresAt: null,
    activeRivalry: null,
    canFileNotice: false,
  });
}

function createMember(
  userId: string,
  displayName: string,
  isOwner: boolean,
): RoomMember {
  return {
    userId,
    displayName,
    isOwner,
    isOnline: true,
    joinedAt: nowIso(),
  };
}

function createMessage(
  input: Partial<PackageChatMessage> &
    Pick<PackageChatMessage, 'channel' | 'senderId' | 'body'>,
): PackageChatMessage {
  return {
    id: input.id ?? randomId('chat'),
    channel: input.channel,
    roomId: input.roomId ?? null,
    kind: input.kind ?? 'SYSTEM',
    senderId: input.senderId,
    senderName: input.senderName,
    senderRank: input.senderRank,
    body: input.body,
    ts: input.ts ?? nowTs(),
    immutable: input.immutable ?? false,
    proofHash: input.proofHash,
    meta: input.meta,
    marketMoveAlert: input.marketMoveAlert,
    bulletinType: input.bulletinType,
    bulletinPhase: input.bulletinPhase,
    phase: input.phase,
    dealRoomMeta: input.dealRoomMeta,
  };
}

function roomTypeFromMode(mode?: string): RoomType {
  const normalized = safeString(mode).toUpperCase();
  if (normalized.includes('SYNDICATE') || normalized.includes('TEAM')) return 'HOUSEHOLD_TABLE';
  if (normalized.includes('PREDATOR') || normalized.includes('HEAD')) return 'RIVALRY_ROOM';
  return 'CUSTOM';
}

function deriveChannels(
  mode?: string,
  isLobby?: boolean,
  rivalry?: ActiveRivalry | null,
): readonly ChatChannel[] {
  if (isLobby) return ['GLOBAL', 'SERVER', 'DIRECT'];

  const normalized = safeString(mode).toUpperCase();

  if (normalized.includes('SYNDICATE') || normalized.includes('TEAM')) {
    return rivalry
      ? ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'DIRECT', 'SERVER']
      : ['GLOBAL', 'SYNDICATE', 'DIRECT', 'SERVER'];
  }

  if (normalized.includes('PREDATOR') || normalized.includes('HEAD')) {
    return ['GLOBAL', 'DEAL_ROOM', 'DIRECT', 'SERVER'];
  }

  if (normalized.includes('PHANTOM') || normalized.includes('LEGEND')) {
    return ['GLOBAL', 'DIRECT', 'SERVER'];
  }

  if (normalized.includes('EMPIRE') || normalized.includes('ALONE')) {
    return ['GLOBAL', 'DIRECT', 'SERVER'];
  }

  return DEFAULT_CHANNELS;
}

function buildDealRoomState(
  rivalry: ActiveRivalry | null,
  allMessages: readonly PackageChatMessage[],
): DealRoomState | null {
  return normalizeDealRoomState(deriveDealRoomFromRivalry(rivalry, allMessages));
}

function buildMarketMoveAlertFromPayload(
  payload: Record<string, unknown>,
): MarketMoveAlertPayload | undefined {
  const rivalryId = safeString(payload.rivalryId);
  if (!rivalryId) return undefined;

  return {
    rivalryId,
    phase: coerceRivalryPhase(payload.phase, 'NOTICE_FILED'),
    challenger: {
      syndicateId: safeString(payload.challengerSyndicateId, 'challenger'),
      name: safeString(payload.challengerName, 'Challenger'),
      banner: safeString(payload.challengerBanner),
      capitalScore: safeNumber(payload.challengerScore),
    },
    defender: {
      syndicateId: safeString(payload.defenderSyndicateId, 'defender'),
      name: safeString(payload.defenderName, 'Defender'),
      banner: safeString(payload.defenderBanner),
      capitalScore: safeNumber(payload.defenderScore),
    },
    phaseEndsAt: safeIsoDate(payload.phaseEndsAt),
    deepLink: safeString(payload.deepLink, rivalryId),
    proofHash: safeString(payload.proofHash) || undefined,
    yieldCaptureAmount:
      payload.yieldCaptureAmount == null ? undefined : safeNumber(payload.yieldCaptureAmount),
  };
}

function updateLearningProfile(
  profile: LearningProfileSnapshot,
  body: string,
): LearningProfileSnapshot {
  const lower = body.toLowerCase();

  const flags = {
    question: /\?/.test(lower) || /(how|what|why|help|where|when)/.test(lower),
    angry: /(hate|mad|stupid|trash|garbage|broken|bad)/.test(lower),
    flex: /(won|crushed|dominated|easy|million|net worth|rich)/.test(lower),
    troll: /(lol|lmao|cope|ratio|skill issue)/.test(lower),
    money: /(cash|income|expenses|worth|money|debt|card|treasury|asset)/.test(lower),
    pressure: /(pressure|stress|heat|threat|attack|cascade|breach)/.test(lower),
    bot: /(bot|liquidator|bureaucrat|manipulator|crash prophet|swarm)/.test(lower),
  };

  let dominantTone: LearningProfileSnapshot['dominantTone'] = 'CALM';
  if (flags.angry) dominantTone = 'ANGRY';
  else if (flags.flex) dominantTone = 'FLEX';
  else if (flags.troll) dominantTone = 'TROLL';
  else if (flags.question) dominantTone = 'QUESTION';

  return {
    dominantTone,
    messagesSent: profile.messagesSent + 1,
    recentMoneyMentions: profile.recentMoneyMentions + (flags.money ? 1 : 0),
    recentPressureMentions: profile.recentPressureMentions + (flags.pressure ? 1 : 0),
    recentBotMentions: profile.recentBotMentions + (flags.bot ? 1 : 0),
  };
}

function sanitizePanel(
  panel: ChatPanelView,
  availableChannels: readonly ChatChannel[],
): ChatPanelView {
  if (panel === 'ROOMS') return panel;
  return availableChannels.includes(panel) ? panel : availableChannels[0] ?? 'GLOBAL';
}

function clearUnreadForPanel(
  prev: Record<ChatChannel, number>,
  panel: ChatPanelView,
): Record<ChatChannel, number> {
  if (panel === 'ROOMS') return prev;
  return { ...prev, [panel]: 0 };
}

function sumUnread(unread: Record<ChatChannel, number>): number {
  return Object.values(unread).reduce((sum, value) => sum + value, 0);
}

/* ============================================================================
 * Pure model exports
 * ========================================================================== */

export function filterMessagesForChannel(
  messages: readonly PackageChatMessage[],
  channel: ChatChannel,
): readonly PackageChatMessage[] {
  return messages.filter((message) => message.channel === channel);
}

export function buildOmnipresentChatModel(input: PackageChatRuntimeInput): OmnipresentChatModel {
  const activeChannel = input.activeChannel ?? 'GLOBAL';
  const visibleChannel = resolveVisibleChannel(activeChannel, input.visibleChannel);
  const allMessages = Array.isArray(input.messages) ? dedupeMessages(input.messages) : [];
  const alliance = normalizeAllianceState({
    ...input.alliance,
    activeRivalry: input.rivalry ?? input.alliance?.activeRivalry ?? null,
  });

  const derivedDealRoom = buildDealRoomState(input.rivalry ?? alliance.activeRivalry ?? null, allMessages);
  const dealRoom = normalizeDealRoomState(input.dealRoom ?? derivedDealRoom);
  const modelSeed = {
    currentUserId: input.currentUserId,
    activeChannel,
    visibleChannel,
    visibleMessages: filterMessagesForChannel(allMessages, visibleChannel),
    rooms: normalizeRooms(input.rooms),
    alliance,
    dealRoom,
    tabs: [] as const,
    title: input.title ?? 'COMMAND COMMS',
    subtitle: input.subtitle ?? 'OMNIPRESENT CHAT',
  };

  return {
    ...modelSeed,
    tabs: deriveTabs({
      alliance: modelSeed.alliance,
      dealRoom: modelSeed.dealRoom,
    }),
  };
}

/* ============================================================================
 * React runtime hook
 * ========================================================================== */

export function useOmnipresentChatRuntime(
  options: PackageChatRuntimeOptions,
): OmnipresentChatRuntimeApi {
  const {
    currentUserId,
    displayName = 'You',
    mode,
    isLobby = false,
    defaultOpen = false,
    defaultPanel = 'GLOBAL',
    title = 'COMMAND COMMS',
    subtitle = 'OMNIPRESENT CHAT',
    initialMessages = [],
    initialRooms = [],
    initialAlliance,
    initialRivalry = null,
    initialContext,
    maxMessages = MAX_DEFAULT_MESSAGES,
    onSendRemote,
  } = options;

  const maxBufferedMessages = Math.max(50, maxMessages);

  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);
  const [activePanel, setActivePanel] = useState<ChatPanelView>(defaultPanel);
  const [messages, setMessages] = useState<PackageChatMessage[]>(() =>
    dedupeMessages(initialMessages).slice(-maxBufferedMessages),
  );
  const [rooms, setRooms] = useState<PackageChatRoom[]>(() => [...normalizeRooms(initialRooms)]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeRivalry, setActiveRivalry] = useState<ActiveRivalry | null>(initialRivalry);
  const [alliance, setAlliance] = useState<AlliancePanelState>(() =>
    normalizeAllianceState({
      ...defaultAlliance(),
      ...initialAlliance,
      activeRivalry: initialRivalry ?? initialAlliance?.activeRivalry ?? null,
    }),
  );
  const [context, setContext] = useState<OmnipresentChatContext>({
    ...initialContext,
    mode: initialContext?.mode ?? mode ?? null,
    title: initialContext?.title ?? title,
    subtitle: initialContext?.subtitle ?? subtitle,
  });
  const [unread, setUnread] = useState<Record<ChatChannel, number>>({ ...EMPTY_UNREAD });
  const [learningProfile, setLearningProfile] = useState<LearningProfileSnapshot>(EMPTY_PROFILE);

  const isOpenRef = useRef(isOpen);
  const activePanelRef = useRef<ChatPanelView>(activePanel);
  const activeRoomRef = useRef<string | null>(activeRoomId);
  const contextRef = useRef<OmnipresentChatContext>(context);
  const previousContextRef = useRef<OmnipresentChatContext>(context);

  const availableChannels = useMemo(
    () => deriveChannels(context.mode ?? mode, isLobby, activeRivalry),
    [activeRivalry, context.mode, isLobby, mode],
  );

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    activePanelRef.current = activePanel;
  }, [activePanel]);

  useEffect(() => {
    activeRoomRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  useEffect(() => {
    setActivePanel((prev) => sanitizePanel(prev, availableChannels));
  }, [availableChannels]);

  useEffect(() => {
    setContext((prev) => ({
      ...prev,
      mode: mode ?? prev.mode ?? null,
      title: title ?? prev.title ?? 'COMMAND COMMS',
      subtitle: subtitle ?? prev.subtitle ?? 'OMNIPRESENT CHAT',
    }));
  }, [mode, subtitle, title]);

  useEffect(() => {
    setAlliance((prev) =>
      normalizeAllianceState({
        ...prev,
        activeRivalry,
      }),
    );
  }, [activeRivalry]);

  const visibleChannel = resolveVisibleChannel(activePanel, undefined);
  const dealRoom = useMemo(
    () => buildDealRoomState(activeRivalry, messages),
    [activeRivalry, messages],
  );

  const model = useMemo(
    () =>
      buildOmnipresentChatModel({
        currentUserId,
        activeChannel: activePanel,
        visibleChannel,
        messages,
        rooms,
        alliance,
        rivalry: activeRivalry,
        dealRoom,
        title: safeString(context.title, title),
        subtitle: safeString(context.subtitle, subtitle),
      }),
    [
      activePanel,
      activeRivalry,
      alliance,
      context.subtitle,
      context.title,
      currentUserId,
      dealRoom,
      messages,
      rooms,
      subtitle,
      title,
      visibleChannel,
    ],
  );

  const appendMessages = useCallback(
    (nextMessages: readonly PackageChatMessage[]) => {
      if (!nextMessages.length) return;

      setMessages((prev) => mergeMessages(prev, nextMessages, maxBufferedMessages));

      setUnread((prev) => {
        const draft = { ...prev };
        const currentOpen = isOpenRef.current;
        const currentPanel = activePanelRef.current;
        const currentVisible = resolveVisibleChannel(currentPanel, undefined);

        for (const message of nextMessages) {
          if (message.channel === currentVisible && currentOpen && currentPanel !== 'ROOMS') continue;
          draft[message.channel] = (draft[message.channel] ?? 0) + 1;
        }

        return draft;
      });
    },
    [maxBufferedMessages],
  );

  const setOpen = useCallback((next: boolean) => {
    setIsOpen(next);
    if (next) {
      setUnread((prev) => clearUnreadForPanel(prev, activePanelRef.current));
    }
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setUnread((draft) => clearUnreadForPanel(draft, activePanelRef.current));
      }
      return next;
    });
  }, []);

  const switchPanel = useCallback(
    (panel: ChatPanelView) => {
      const next = sanitizePanel(panel, availableChannels);
      setActivePanel(next);
      setUnread((prev) => clearUnreadForPanel(prev, next));
    },
    [availableChannels],
  );

  const sendMessage = useCallback(
    async (body: string, channel?: ChatChannel) => {
      const trimmed = body.trim();
      if (!trimmed) return;

      const panel = activePanelRef.current;
      const targetChannel =
        channel ??
        (panel === 'ROOMS' ? 'DIRECT' : resolveVisibleChannel(panel, undefined));

      const roomId = panel === 'ROOMS' ? activeRoomRef.current : null;

      const optimistic = createMessage({
        channel: targetChannel,
        roomId,
        kind: 'PLAYER',
        senderId: currentUserId,
        senderName: displayName,
        body: trimmed,
      });

      appendMessages([optimistic]);
      setLearningProfile((prev) => updateLearningProfile(prev, trimmed));

      await onSendRemote?.(optimistic);
    },
    [appendMessages, currentUserId, displayName, onSendRemote],
  );

  const injectMessages = useCallback(
    (nextMessages: readonly PackageChatMessage[]) => {
      appendMessages(nextMessages);
    },
    [appendMessages],
  );

  const updateContext = useCallback((next: Partial<OmnipresentChatContext>) => {
    setContext((prev) => ({ ...prev, ...next }));
  }, []);

  const createRoom = useCallback(
    async (
      name: string,
      type: RoomType,
      maxMembers: number,
      inviteOnly: boolean,
    ): Promise<string> => {
      const id = randomId('room');
      const inviteToken = inviteOnly ? randomId('inv') : null;

      const room: PackageChatRoom = {
        id,
        name: safeString(name, 'Room'),
        type,
        creatorId: currentUserId,
        maxMembers: Math.max(2, Math.floor(maxMembers || 2)),
        memberCount: 1,
        isInviteOnly: inviteOnly,
        inviteToken,
        createdAt: nowIso(),
        expiresAt: null,
        isWarRoom: type === 'RIVALRY_ROOM',
        members: [createMember(currentUserId, displayName, true)],
      };

      setRooms((prev) => [room, ...prev]);
      return id;
    },
    [currentUserId, displayName],
  );

  const joinRoom = useCallback(
    async (roomId: string, _inviteToken?: string) => {
      setRooms((prev) =>
        prev.map((room) => {
          if (room.id !== roomId) return room;
          const members = [...(room.members ?? [])];
          if (members.some((member) => member.userId === currentUserId)) return room;

          members.push(createMember(currentUserId, displayName, false));

          return {
            ...room,
            memberCount: Math.min(room.maxMembers, members.length),
            members,
          };
        }),
      );

      setActiveRoomId(roomId);
      setActivePanel('ROOMS');
    },
    [currentUserId, displayName],
  );

  const leaveRoom = useCallback(
    async (roomId: string) => {
      setRooms((prev) =>
        prev
          .map((room) => {
            if (room.id !== roomId) return room;
            const members = (room.members ?? []).filter(
              (member) => member.userId !== currentUserId,
            );
            return {
              ...room,
              members,
              memberCount: members.length,
            };
          })
          .filter((room) => room.memberCount > 0),
      );

      if (activeRoomRef.current === roomId) {
        setActiveRoomId(null);
      }
    },
    [currentUserId],
  );

  const selectRoom = useCallback((roomId: string) => {
    setActiveRoomId(roomId);
    setActivePanel('ROOMS');
  }, []);

  const setRivalry = useCallback((rivalry: ActiveRivalry | null) => {
    setActiveRivalry(rivalry);
  }, []);

  const processGameEvent = useCallback(
    (type: GameEventType, payload: Record<string, unknown> = {}) => {
      const channel = (payload.channel as ChatChannel | undefined) ?? 'GLOBAL';
      const nextMessages: PackageChatMessage[] = [];

      if (type === 'RUN_STARTED') {
        nextMessages.push(
          createMessage({
            channel,
            kind: 'SYSTEM',
            senderId: 'SYSTEM',
            senderName: 'SYSTEM',
            immutable: true,
            body: `Run initialized${payload.mode ? ` · ${String(payload.mode)}` : ''}.`,
            meta: payload,
          }),
        );
      } else if (type === 'RUN_ENDED') {
        nextMessages.push(
          createMessage({
            channel,
            kind: 'DEAL_RECAP',
            senderId: 'SYSTEM',
            senderName: 'SYSTEM',
            immutable: true,
            body: `Run closed · ${safeString(payload.outcome, 'UNRESOLVED')}.`,
            proofHash: safeString(payload.proofHash) || undefined,
            meta: payload,
          }),
        );
      } else if (type === 'PRESSURE_TIER_CHANGED') {
        nextMessages.push(
          createMessage({
            channel,
            kind: 'MARKET_ALERT',
            senderId: 'SYSTEM',
            senderName: 'SYSTEM',
            immutable: true,
            body: `Pressure tier shifted to ${safeString(payload.tier, 'UNKNOWN')}.`,
            meta: payload,
          }),
        );
      } else if (type === 'BOT_ATTACK') {
        nextMessages.push(
          createMessage({
            channel,
            kind: 'BOT_ATTACK',
            senderId: safeString(payload.botId, 'BOT'),
            senderName: safeString(payload.botName, 'BOT'),
            immutable: true,
            body:
              safeString(payload.body) ||
              `Attack fired on ${safeString(payload.targetLayer, 'core')} · ${safeString(payload.attackType, 'UNKNOWN')}.`,
            meta: payload,
          }),
        );
      } else if (type === 'SHIELD_BREACH') {
        nextMessages.push(
          createMessage({
            channel,
            kind: 'SHIELD_EVENT',
            senderId: 'SYSTEM',
            senderName: 'SYSTEM',
            immutable: true,
            body: `Shield integrity compromised at ${safeString(payload.layerId, 'unknown layer')}.`,
            meta: payload,
          }),
        );
      } else if (type === 'CASCADE_TRIGGERED') {
        nextMessages.push(
          createMessage({
            channel,
            kind: 'CASCADE_ALERT',
            senderId: 'SYSTEM',
            senderName: 'SYSTEM',
            immutable: true,
            body: `Cascade chain active · ${safeString(payload.chainId, 'UNNAMED')} · ${safeString(payload.severity, 'MAJOR')}.`,
            meta: payload,
          }),
        );
      } else if (type === 'SOVEREIGNTY_GRADE_CHANGED') {
        nextMessages.push(
          createMessage({
            channel,
            kind: 'ACHIEVEMENT',
            senderId: 'SYSTEM',
            senderName: 'SYSTEM',
            immutable: true,
            body: `Sovereignty grade now ${safeString(payload.grade, 'UNVERIFIED')}.`,
            proofHash: safeString(payload.proofHash) || undefined,
            meta: payload,
          }),
        );
      } else if (type === 'PIPELINE_STATUS_CHANGED') {
        nextMessages.push(
          createMessage({
            channel,
            kind: 'SYSTEM',
            senderId: 'SYSTEM',
            senderName: 'SYSTEM',
            immutable: true,
            body: `Proof pipeline ${safeString(payload.status, 'IDLE')}.`,
            proofHash: safeString(payload.proofHash) || undefined,
            meta: payload,
          }),
        );
      } else if (type === 'RIVALRY_PHASE_CHANGED') {
        const nextRivalry: ActiveRivalry = {
          rivalryId: safeString(payload.rivalryId, activeRivalry?.rivalryId ?? randomId('rivalry')),
          phase: coerceRivalryPhase(payload.phase, activeRivalry?.phase ?? 'NOTICE_FILED'),
          phaseEndsAt: safeIsoDate(payload.phaseEndsAt),
          challengerSyndicateId: safeString(
            payload.challengerSyndicateId,
            activeRivalry?.challengerSyndicateId ?? 'challenger',
          ),
          defenderSyndicateId: safeString(
            payload.defenderSyndicateId,
            activeRivalry?.defenderSyndicateId ?? 'defender',
          ),
          challengerName: safeString(payload.challengerName, activeRivalry?.challengerName ?? 'Challenger'),
          defenderName: safeString(payload.defenderName, activeRivalry?.defenderName ?? 'Defender'),
          challengerBanner: safeString(payload.challengerBanner, activeRivalry?.challengerBanner ?? ''),
          defenderBanner: safeString(payload.defenderBanner, activeRivalry?.defenderBanner ?? ''),
          challengerScore: safeNumber(payload.challengerScore, activeRivalry?.challengerScore ?? 0),
          defenderScore: safeNumber(payload.defenderScore, activeRivalry?.defenderScore ?? 0),
          mySyndicateId: safeString(payload.mySyndicateId, activeRivalry?.mySyndicateId ?? 'self'),
          dealRoomChannel: 'DEAL_ROOM',
        };

        setActiveRivalry(nextRivalry);

        nextMessages.push(
          createMessage({
            channel: 'DEAL_ROOM',
            kind: 'RIVALRY_BULLETIN',
            senderId: 'SYSTEM',
            senderName: 'SYSTEM',
            immutable: true,
            body:
              safeString(payload.body) ||
              `Rivalry phase shifted to ${safeString(payload.phase, 'UNKNOWN')}.`,
            bulletinType: 'MARKET_PHASE_BULLETIN',
            bulletinPhase: nextRivalry.phase,
            phase: nextRivalry.phase,
            marketMoveAlert: buildMarketMoveAlertFromPayload(payload),
            proofHash: safeString(payload.proofHash) || undefined,
            meta: payload,
            dealRoomMeta: {
              rivalryId: nextRivalry.rivalryId,
              phase: nextRivalry.phase,
              phaseEndsAt: nextRivalry.phaseEndsAt,
              challengerName: nextRivalry.challengerName,
              defenderName: nextRivalry.defenderName,
              challengerScore: nextRivalry.challengerScore,
              defenderScore: nextRivalry.defenderScore,
            },
          }),
        );
      } else if (type === 'MARKET_ALERT') {
        nextMessages.push(
          createMessage({
            channel,
            kind: 'MARKET_ALERT',
            senderId: 'SYSTEM',
            senderName: 'SYSTEM',
            immutable: true,
            body: safeString(payload.body, 'Market alert issued.'),
            marketMoveAlert: buildMarketMoveAlertFromPayload(payload),
            proofHash: safeString(payload.proofHash) || undefined,
            meta: payload,
          }),
        );
      } else {
        nextMessages.push(
          createMessage({
            channel,
            kind: 'SYSTEM',
            senderId: 'SYSTEM',
            senderName: 'SYSTEM',
            immutable: true,
            body: safeString(payload.body, 'System event recorded.'),
            meta: payload,
          }),
        );
      }

      appendMessages(nextMessages);
    },
    [activeRivalry, appendMessages],
  );

  useEffect(() => {
    const prev = previousContextRef.current;
    const next = contextRef.current;
    previousContextRef.current = next;

    if (safeString(prev.lifecycleState) !== safeString(next.lifecycleState) && next.lifecycleState) {
      if (next.lifecycleState === 'ACTIVE') {
        processGameEvent('RUN_STARTED', {
          body: `Lifecycle ${next.lifecycleState}.`,
          mode: next.mode,
        });
      } else if (next.lifecycleState === 'ENDED' || next.lifecycleState === 'FINALIZED') {
        processGameEvent('RUN_ENDED', {
          body: `Lifecycle ${next.lifecycleState}.`,
          outcome: next.lifecycleState,
          proofHash: next.proofHash,
        });
      } else {
        processGameEvent('SYSTEM', {
          body: `Lifecycle ${next.lifecycleState}.`,
        });
      }
    }

    if (safeString(prev.pressureTier) !== safeString(next.pressureTier) && next.pressureTier) {
      processGameEvent('PRESSURE_TIER_CHANGED', {
        tier: next.pressureTier,
      });
    }

    if (
      safeNumber(next.activeBotsCount) > safeNumber(prev.activeBotsCount) &&
      safeNumber(next.activeBotsCount) > 0
    ) {
      processGameEvent('BOT_ATTACK', {
        botName: 'HATER SWARM',
        body: `${safeNumber(next.activeBotsCount)} active bot contacts detected.`,
        targetLayer: next.weakestLayerId ?? 'core',
      });
    }

    if (!safeBoolean(prev.breachCascade) && safeBoolean(next.breachCascade)) {
      processGameEvent('SHIELD_BREACH', {
        layerId: next.weakestLayerId,
        body: 'Breach cascade detected.',
      });
    }

    if (
      safeNumber(next.negativeCascadeCount) > safeNumber(prev.negativeCascadeCount) &&
      safeNumber(next.negativeCascadeCount) > 0
    ) {
      processGameEvent('CASCADE_TRIGGERED', {
        chainId: `NEG-${safeNumber(next.negativeCascadeCount)}`,
        severity: 'MAJOR',
      });
    }

    if (
      safeString(prev.sovereigntyGrade) !== safeString(next.sovereigntyGrade) &&
      next.sovereigntyGrade
    ) {
      processGameEvent('SOVEREIGNTY_GRADE_CHANGED', {
        grade: next.sovereigntyGrade,
        proofHash: next.proofHash,
      });
    }

    if (
      safeString(prev.pipelineStatus) !== safeString(next.pipelineStatus) &&
      next.pipelineStatus
    ) {
      processGameEvent('PIPELINE_STATUS_CHANGED', {
        status: next.pipelineStatus,
        proofHash: next.proofHash,
      });
    }
  }, [context, processGameEvent]);

  useEffect(() => {
    if (!isLobby || typeof window === 'undefined') return undefined;

    const timer = window.setTimeout(() => {
      appendMessages([
        createMessage({
          channel: 'GLOBAL',
          kind: 'SYSTEM',
          senderId: 'SYSTEM',
          senderName: 'SYSTEM',
          immutable: true,
          body: 'Lobby comms synchronized. Choose your lane.',
        }),
      ]);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [appendMessages, isLobby]);

  const totalUnread = useMemo(() => sumUnread(unread), [unread]);

  return {
    currentUserId,
    isOpen,
    activePanel,
    visibleChannel,
    messages: model.visibleMessages,
    allMessages: messages,
    unread,
    totalUnread,
    availableChannels,
    rooms,
    activeRoomId,
    alliance,
    activeRivalry,
    dealRoom,
    context,
    learningProfile,
    model,
    tabs: model.tabs,
    toggleOpen,
    setOpen,
    switchPanel,
    sendMessage,
    injectMessages,
    processGameEvent,
    updateContext,
    createRoom,
    joinRoom,
    leaveRoom,
    selectRoom,
    setRivalry,
  };
}