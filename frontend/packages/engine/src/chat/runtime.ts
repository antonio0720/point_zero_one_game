/**
 * ============================================================================
 * @pzo/engine/chat/runtime.ts
 * FILE: frontend/packages/engine/src/chat/runtime.ts
 * ----------------------------------------------------------------------------
 * Omnipresent package runtime used by pzo-web and platform-shell adoption.
 *
 * Owns:
 * - client-side chat open/close state
 * - active panel / visible transcript state
 * - unread counts
 * - room membership state
 * - rivalry / deal-room state
 * - game-event -> chat projection
 * - learning-profile rollup
 *
 * Does not own:
 * - reducer authority from pzo-web engines/chat
 * - socket lifecycle
 * - transport implementation
 *
 * Transport remains caller-injected through onSendRemote.
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
} from './adapters';

import type {
  ActiveRivalry,
  AlliancePanelState,
  ChatChannel,
  ChatPanelView,
  DealRoomState,
  GameEventType,
  LearningProfileSnapshot,
  MarketMoveAlertPayload,
  OmnipresentChatContext,
  OmnipresentChatModel,
  OmnipresentChatRuntimeApi,
  PackageChatMessage,
  PackageChatRoom,
  PackageChatRuntimeOptions,
  RoomMember,
  RoomType,
  RivalryPhase,
} from './types';

/* ============================================================================
 * Public runtime model input
 * ========================================================================== */

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

/* ============================================================================
 * Constants
 * ========================================================================== */

const MAX_DEFAULT_MESSAGES = 400;

const DEFAULT_CHANNELS: readonly ChatChannel[] = [
  'GLOBAL',
  'SERVER',
  'SYNDICATE',
  'DEAL_ROOM',
  'DIRECT',
] as const;

const EMPTY_UNREAD: Record<ChatChannel, number> = {
  GLOBAL: 0,
  SERVER: 0,
  SYNDICATE: 0,
  DEAL_ROOM: 0,
  DIRECT: 0,
  SPECTATOR: 0,
};

const EMPTY_PROFILE: LearningProfileSnapshot = {
  dominantTone: 'UNKNOWN',
  messagesSent: 0,
  recentPressureMentions: 0,
  recentMoneyMentions: 0,
  recentBotMentions: 0,
};

/* ============================================================================
 * Local helpers
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

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asIsoDate(value: unknown, fallback?: string): string {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return fallback ?? nowIso();
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
  const ts = input.ts ?? nowTs();
  return {
    id: input.id ?? randomId('chat'),
    channel: input.channel,
    roomId: input.roomId ?? null,
    kind: input.kind ?? 'SYSTEM',
    senderId: input.senderId,
    senderName: input.senderName,
    senderRank: input.senderRank,
    body: input.body,
    ts,
    createdAt: input.createdAt ?? new Date(ts).toISOString(),
    immutable: input.immutable ?? false,
    recipientId: input.recipientId,
    emoji: input.emoji,
    proofHash: input.proofHash,
    meta: input.meta,
    marketMoveAlert: input.marketMoveAlert,
    bulletinType: input.bulletinType,
    bulletinPhase: input.bulletinPhase,
    phase: input.phase,
    dealRoomMeta: input.dealRoomMeta,
    wasAdapted: input.wasAdapted,
    sentimentSignal: input.sentimentSignal,
  };
}

function deriveChannels(
  mode?: string,
  isLobby?: boolean,
  rivalry?: ActiveRivalry | null,
): readonly ChatChannel[] {
  if (isLobby) return ['GLOBAL', 'SERVER', 'DIRECT'];

  const normalized = asString(mode).toUpperCase();

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
  const rivalryId = asString(payload.rivalryId);
  if (!rivalryId) return undefined;

  return {
    rivalryId,
    phase: coerceRivalryPhase(payload.phase, 'NOTICE_FILED'),
    challenger: {
      syndicateId: asString(payload.challengerSyndicateId, 'challenger'),
      name: asString(payload.challengerName, 'Challenger'),
      banner: asString(payload.challengerBanner),
      capitalScore: asNumber(payload.challengerScore),
    },
    defender: {
      syndicateId: asString(payload.defenderSyndicateId, 'defender'),
      name: asString(payload.defenderName, 'Defender'),
      banner: asString(payload.defenderBanner),
      capitalScore: asNumber(payload.defenderScore),
    },
    phaseEndsAt: asIsoDate(payload.phaseEndsAt),
    deepLink: asString(payload.deepLink, rivalryId),
    proofHash: asString(payload.proofHash) || undefined,
    yieldCaptureAmount:
      payload.yieldCaptureAmount == null ? undefined : asNumber(payload.yieldCaptureAmount),
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

function resolveRoomMessageChannel(room: PackageChatRoom | undefined | null): ChatChannel {
  if (!room) return 'DIRECT';
  if (room.isWarRoom || room.type === 'RIVALRY_ROOM') return 'DEAL_ROOM';
  if (room.type === 'HOUSEHOLD_TABLE') return 'SYNDICATE';
  return 'DIRECT';
}

function filterVisibleMessages(
  messages: readonly PackageChatMessage[],
  activePanel: ChatPanelView,
  visibleChannel: ChatChannel,
  activeRoomId: string | null,
): readonly PackageChatMessage[] {
  if (activePanel === 'ROOMS' && activeRoomId) {
    return messages.filter((message) => message.roomId === activeRoomId);
  }
  return messages.filter((message) => message.channel === visibleChannel);
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

export function buildOmnipresentChatModel(
  input: PackageChatRuntimeInput,
): OmnipresentChatModel {
  const activeChannel = input.activeChannel ?? 'GLOBAL';
  const visibleChannel = resolveVisibleChannel(activeChannel, input.visibleChannel);
  const allMessages = Array.isArray(input.messages) ? dedupeMessages(input.messages) : [];

  const alliance = normalizeAllianceState({
    ...input.alliance,
    activeRivalry: input.rivalry ?? input.alliance?.activeRivalry ?? null,
  });

  const derivedDealRoom = buildDealRoomState(
    input.rivalry ?? alliance.activeRivalry ?? null,
    allMessages,
  );

  const dealRoom = normalizeDealRoomState(input.dealRoom ?? derivedDealRoom);

  const modelBase = {
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
    ...modelBase,
    tabs: deriveTabs({
      alliance: modelBase.alliance,
      dealRoom: modelBase.dealRoom,
    }),
  };
}

/* ============================================================================
 * Hook runtime
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
  const [learningProfile, setLearningProfile] =
    useState<LearningProfileSnapshot>(EMPTY_PROFILE);

  const isOpenRef = useRef(isOpen);
  const activePanelRef = useRef<ChatPanelView>(activePanel);
  const activeRoomRef = useRef<string | null>(activeRoomId);
  const contextRef = useRef<OmnipresentChatContext>(context);
  const previousContextRef = useRef<OmnipresentChatContext>(context);

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

  const availableChannels = useMemo(
    () => deriveChannels(context.mode ?? mode, isLobby, activeRivalry),
    [activeRivalry, context.mode, isLobby, mode],
  );

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

  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === activeRoomId) ?? null,
    [activeRoomId, rooms],
  );

  const visibleChannel = resolveVisibleChannel(activePanel, undefined);

  const dealRoom = useMemo(
    () => buildDealRoomState(activeRivalry, messages),
    [activeRivalry, messages],
  );

  const visibleMessages = useMemo(
    () => filterVisibleMessages(messages, activePanel, visibleChannel, activeRoomId),
    [activePanel, activeRoomId, messages, visibleChannel],
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
        title: asString(context.title, title),
        subtitle: asString(context.subtitle, subtitle),
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
        const currentVisibleChannel = resolveVisibleChannel(currentPanel, undefined);
        const currentRoomId = activeRoomRef.current;

        for (const message of nextMessages) {
          const roomVisible =
            currentPanel === 'ROOMS' &&
            currentRoomId != null &&
            message.roomId === currentRoomId;

          const channelVisible =
            currentPanel !== 'ROOMS' &&
            message.channel === currentVisibleChannel;

          if (currentOpen && (roomVisible || channelVisible)) continue;
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
      const roomId = panel === 'ROOMS' ? activeRoomRef.current : null;

      const targetChannel =
        channel ??
        (panel === 'ROOMS'
          ? resolveRoomMessageChannel(activeRoom)
          : resolveVisibleChannel(panel, undefined));

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
    [activeRoom, appendMessages, currentUserId, displayName, onSendRemote],
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
        name: asString(name, 'Room'),
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
            body: `Run closed · ${asString(payload.outcome, 'UNRESOLVED')}.`,
            proofHash: asString(payload.proofHash) || undefined,
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
            body: `Pressure tier shifted to ${asString(payload.tier, 'UNKNOWN')}.`,
            meta: payload,
          }),
        );
      } else if (type === 'BOT_ATTACK') {
        nextMessages.push(
          createMessage({
            channel,
            kind: 'BOT_ATTACK',
            senderId: asString(payload.botId, 'BOT'),
            senderName: asString(payload.botName, 'BOT'),
            immutable: true,
            body:
              asString(payload.body) ||
              `Attack fired on ${asString(payload.targetLayer, 'core')} · ${asString(payload.attackType, 'UNKNOWN')}.`,
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
            body: `Shield integrity compromised at ${asString(payload.layerId, 'unknown layer')}.`,
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
            body: `Cascade chain active · ${asString(payload.chainId, 'UNNAMED')} · ${asString(payload.severity, 'MAJOR')}.`,
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
            body: `Sovereignty grade now ${asString(payload.grade, 'UNVERIFIED')}.`,
            proofHash: asString(payload.proofHash) || undefined,
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
            body: `Proof pipeline ${asString(payload.status, 'IDLE')}.`,
            proofHash: asString(payload.proofHash) || undefined,
            meta: payload,
          }),
        );
      } else if (type === 'RIVALRY_PHASE_CHANGED') {
        const previous = activeRivalry;

        const nextRivalry: ActiveRivalry = {
          rivalryId: asString(payload.rivalryId, previous?.rivalryId ?? randomId('rivalry')),
          phase: coerceRivalryPhase(payload.phase, previous?.phase ?? 'NOTICE_FILED'),
          phaseEndsAt: asIsoDate(payload.phaseEndsAt, previous?.phaseEndsAt),
          challengerSyndicateId: asString(
            payload.challengerSyndicateId,
            previous?.challengerSyndicateId ?? 'challenger',
          ),
          defenderSyndicateId: asString(
            payload.defenderSyndicateId,
            previous?.defenderSyndicateId ?? 'defender',
          ),
          challengerName: asString(payload.challengerName, previous?.challengerName ?? 'Challenger'),
          defenderName: asString(payload.defenderName, previous?.defenderName ?? 'Defender'),
          challengerBanner: asString(payload.challengerBanner, previous?.challengerBanner ?? ''),
          defenderBanner: asString(payload.defenderBanner, previous?.defenderBanner ?? ''),
          challengerScore: asNumber(payload.challengerScore, previous?.challengerScore ?? 0),
          defenderScore: asNumber(payload.defenderScore, previous?.defenderScore ?? 0),
          mySyndicateId: asString(payload.mySyndicateId, previous?.mySyndicateId ?? 'self'),
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
              asString(payload.body) ||
              `Rivalry phase shifted to ${asString(payload.phase, 'UNKNOWN')}.`,
            bulletinType: 'MARKET_PHASE_BULLETIN',
            bulletinPhase: nextRivalry.phase,
            phase: nextRivalry.phase,
            marketMoveAlert: buildMarketMoveAlertFromPayload(payload),
            proofHash: asString(payload.proofHash) || undefined,
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
            body: asString(payload.body, 'Market alert issued.'),
            marketMoveAlert: buildMarketMoveAlertFromPayload(payload),
            proofHash: asString(payload.proofHash) || undefined,
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
            body: asString(payload.body, 'System event recorded.'),
            meta: payload,
          }),
        );
      }

      appendMessages(nextMessages);
    },
    [activeRivalry, appendMessages],
  );

  useEffect(() => {
    const previous = previousContextRef.current;
    const next = contextRef.current;
    previousContextRef.current = next;

    if (asString(previous.lifecycleState) !== asString(next.lifecycleState) && next.lifecycleState) {
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

    if (asString(previous.pressureTier) !== asString(next.pressureTier) && next.pressureTier) {
      processGameEvent('PRESSURE_TIER_CHANGED', {
        tier: next.pressureTier,
      });
    }

    if (
      asNumber(next.activeBotsCount) > asNumber(previous.activeBotsCount) &&
      asNumber(next.activeBotsCount) > 0
    ) {
      processGameEvent('BOT_ATTACK', {
        botName: 'HATER SWARM',
        body: `${asNumber(next.activeBotsCount)} active bot contacts detected.`,
        targetLayer: next.weakestLayerId ?? 'core',
      });
    }

    if (!asBoolean(previous.breachCascade) && asBoolean(next.breachCascade)) {
      processGameEvent('SHIELD_BREACH', {
        layerId: next.weakestLayerId,
        body: 'Breach cascade detected.',
      });
    }

    if (
      asNumber(next.negativeCascadeCount) > asNumber(previous.negativeCascadeCount) &&
      asNumber(next.negativeCascadeCount) > 0
    ) {
      processGameEvent('CASCADE_TRIGGERED', {
        chainId: `NEG-${asNumber(next.negativeCascadeCount)}`,
        severity: 'MAJOR',
      });
    }

    if (
      asString(previous.sovereigntyGrade) !== asString(next.sovereigntyGrade) &&
      next.sovereigntyGrade
    ) {
      processGameEvent('SOVEREIGNTY_GRADE_CHANGED', {
        grade: next.sovereigntyGrade,
        proofHash: next.proofHash,
      });
    }

    if (
      asString(previous.pipelineStatus) !== asString(next.pipelineStatus) &&
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
    messages: visibleMessages,
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