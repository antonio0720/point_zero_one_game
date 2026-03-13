
/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ENGINE PRESENCE CONTROLLER
 * FILE: pzo-web/src/engines/chat/ChatPresenceController.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical frontend presence authority for the unified chat engine.
 *
 * This file pulls presence ownership out of UI hooks/components and centralizes:
 * - local self presence
 * - channel-aware member strips
 * - typing state lifecycle
 * - read receipt progression
 * - visibility / focus / chat-open state
 * - cross-channel presence aggregation
 * - NPC/helper/hater presence theatre
 *
 * Why this file exists
 * --------------------
 * Your repo's current web chat hook owns transport and unread state directly,
 * but it does not yet own a true presence domain. The new canonical engine lane
 * needs one place that can translate runtime state into:
 * - what the socket should emit
 * - what the UI should render
 * - what the rest of chat intelligence can infer
 *
 * This file is built to be compatible with the new ChatSocketClient.ts created
 * for the pzo-web/src/engines/chat lane and intentionally keeps local
 * compatibility contracts until shared/contracts/chat is finalized.
 *
 * Operating laws
 * --------------
 * - Presence is not decoration; it is part of gameplay pressure.
 * - GLOBAL should feel theatrical.
 * - SYNDICATE should feel trusted and intimate.
 * - DEAL_ROOM should feel quiet, delayed, and predatory.
 * - Local presence must survive transport churn.
 * - Remote presence must tolerate out-of-order deltas.
 * - Typing is timed theater, not a binary flag.
 * - Read state should be deterministic and channel-aware.
 *
 * Density6 LLC · Point Zero One · Production-first architecture
 */

import {
  ChatSocketClient,
  type ChatChannel,
  type ChatDisconnectReason,
  type ChatPresenceDelta,
  type ChatPresenceIntent,
  type ChatPresenceMember,
  type ChatPresenceSnapshot,
  type ChatPresenceState,
  type ChatReadReceipt,
  type ChatRuntimeVisibility,
  type ChatTypingIntent,
  type ChatTypingSignal,
  type ChatTransportState,
} from './ChatSocketClient';

export type ChatPresenceAudienceMood =
  | 'CALM'
  | 'WATCHFUL'
  | 'TENSE'
  | 'SWARMING'
  | 'PREDATORY'
  | 'INTIMATE';

export type ChatPresenceRole =
  | 'SELF'
  | 'PLAYER'
  | 'NPC'
  | 'HELPER'
  | 'HATER'
  | 'SYSTEM';

export type ChatPresenceSortBucket =
  | 'SELF'
  | 'TYPING'
  | 'ACTIVE'
  | 'IDLE'
  | 'AWAY'
  | 'BACKGROUND'
  | 'OFFLINE'
  | 'HIDDEN';

export type ChatTypingSource = 'LOCAL' | 'REMOTE' | 'NPC_THEATER';

export type ChatPresenceTransitionReason =
  | 'bootstrap'
  | 'transport_connected'
  | 'transport_disconnected'
  | 'window_focus'
  | 'window_blur'
  | 'window_hidden'
  | 'chat_opened'
  | 'chat_closed'
  | 'channel_switch'
  | 'local_message_sent'
  | 'remote_snapshot'
  | 'remote_delta'
  | 'typing_started'
  | 'typing_stopped'
  | 'read_receipt'
  | 'idle_timeout'
  | 'away_timeout'
  | 'manual_override'
  | 'destroyed';

export interface ChatPresenceParticipantView {
  playerId: string;
  displayName: string;
  channel: ChatChannel;
  role: ChatPresenceRole;
  state: ChatPresenceState;
  sortBucket: ChatPresenceSortBucket;
  isSelf: boolean;
  isTyping: boolean;
  isVisibleInStrip: boolean;
  isLurking: boolean;
  aura?: string;
  subtitle?: string;
  modeId?: string;
  lastSeenAt: number;
  lastReadAt?: number;
  typingUntil?: number;
  metadata?: Record<string, unknown>;
}

export interface ChatPresenceStripView {
  channel: ChatChannel;
  roomId?: string;
  participants: ChatPresenceParticipantView[];
  activeCount: number;
  typingCount: number;
  visibleCount: number;
  lurkCount: number;
  unreadCount: number;
  audienceMood: ChatPresenceAudienceMood;
  lastUpdatedAt: number;
}

export interface ChannelPresenceLedger {
  channel: ChatChannel;
  roomId?: string;
  revision: number;
  membersById: Map<string, InternalPresenceMember>;
  lastUpdatedAt: number;
  lastReadMessageId?: string;
  lastReadAt?: number;
  unreadCount: number;
  audienceMood: ChatPresenceAudienceMood;
}

export interface ChatPresenceControllerSnapshot {
  transportState: ChatTransportState;
  localState: ChatPresenceState;
  activeChannel: ChatChannel;
  isChatOpen: boolean;
  isWindowVisible: boolean;
  isWindowFocused: boolean;
  ledgers: Array<{
    channel: ChatChannel;
    roomId?: string;
    revision: number;
    memberCount: number;
    unreadCount: number;
    audienceMood: ChatPresenceAudienceMood;
    lastUpdatedAt: number;
  }>;
}

export interface ChatPresenceControllerCallbacks {
  onPresenceChanged?: (
    channel: ChatChannel,
    view: ChatPresenceStripView,
    reason: ChatPresenceTransitionReason,
  ) => void;
  onSnapshotChanged?: (snapshot: ChatPresenceControllerSnapshot) => void;
  onLocalStateChanged?: (
    state: ChatPresenceState,
    previous: ChatPresenceState,
    reason: ChatPresenceTransitionReason,
  ) => void;
  onUnreadChanged?: (channel: ChatChannel, unreadCount: number) => void;
  onTypingChanged?: (channel: ChatChannel, participantIds: string[]) => void;
  onReceiptApplied?: (receipt: ChatReadReceipt) => void;
  onControllerError?: (error: Error, context?: Record<string, unknown>) => void;
}

export interface ChatPresenceControllerConfig {
  idleAfterMs?: number;
  awayAfterMs?: number;
  remoteOfflineAfterMs?: number;
  typingTtlMs?: number;
  stripParticipantLimit?: number;
  unreadResetOnOpen?: boolean;
  emitLocalPresenceImmediately?: boolean;
  allowNpcPresenceTheater?: boolean;
  log?: (message: string, context?: Record<string, unknown>) => void;
  warn?: (message: string, context?: Record<string, unknown>) => void;
  error?: (message: string, context?: Record<string, unknown>) => void;
}

export interface ChatPresenceControllerOptions {
  socketClient: ChatSocketClient;
  self: {
    playerId: string;
    displayName: string;
    aura?: string;
  };
  initialChannel?: ChatChannel;
  initialVisibility?: Partial<ChatRuntimeVisibility>;
  callbacks?: ChatPresenceControllerCallbacks;
  config?: ChatPresenceControllerConfig;
}

interface InternalPresenceMember extends ChatPresenceMember {
  role: ChatPresenceRole;
  sortBucket: ChatPresenceSortBucket;
  typingSource?: ChatTypingSource;
  createdAt: number;
  lastTransitionAt: number;
  isLurking?: boolean;
}

interface NpcTheaterTypingPlan {
  participantId: string;
  channel: ChatChannel;
  startedAt: number;
  expiresAt: number;
  textHint?: string;
}

const DEFAULT_CONFIG: Required<
  Pick<
    ChatPresenceControllerConfig,
    | 'idleAfterMs'
    | 'awayAfterMs'
    | 'remoteOfflineAfterMs'
    | 'typingTtlMs'
    | 'stripParticipantLimit'
    | 'unreadResetOnOpen'
    | 'emitLocalPresenceImmediately'
    | 'allowNpcPresenceTheater'
  >
> = {
  idleAfterMs: 20_000,
  awayAfterMs: 90_000,
  remoteOfflineAfterMs: 120_000,
  typingTtlMs: 6_000,
  stripParticipantLimit: 12,
  unreadResetOnOpen: true,
  emitLocalPresenceImmediately: true,
  allowNpcPresenceTheater: true,
};

const CHANNELS: ChatChannel[] = ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'];

function now(): number {
  return Date.now();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createError(message: string, cause?: unknown): Error {
  const error = new Error(message);
  if (cause !== undefined) {
    (error as Error & { cause?: unknown }).cause = cause;
  }
  return error;
}

function createLedger(channel: ChatChannel): ChannelPresenceLedger {
  return {
    channel,
    revision: 0,
    membersById: new Map<string, InternalPresenceMember>(),
    lastUpdatedAt: now(),
    unreadCount: 0,
    audienceMood: deriveAudienceMood(channel, []),
  };
}

function deriveRole(member: Partial<ChatPresenceMember>): ChatPresenceRole {
  if (member.isSelf) return 'SELF';
  if (member.isHelper) return 'HELPER';
  if (member.isHater) return 'HATER';
  if (member.isNpc) return 'NPC';
  return 'PLAYER';
}

function deriveSortBucket(
  state: ChatPresenceState,
  isSelf: boolean,
  isTyping: boolean,
  hidden?: boolean,
): ChatPresenceSortBucket {
  if (hidden) return 'HIDDEN';
  if (isSelf) return 'SELF';
  if (isTyping) return 'TYPING';

  switch (state) {
    case 'ACTIVE':
      return 'ACTIVE';
    case 'IDLE':
      return 'IDLE';
    case 'AWAY':
      return 'AWAY';
    case 'BACKGROUND':
      return 'BACKGROUND';
    case 'OFFLINE':
      return 'OFFLINE';
    case 'HIDDEN':
      return 'HIDDEN';
    default:
      return 'IDLE';
  }
}

function deriveAudienceMood(
  channel: ChatChannel,
  members: InternalPresenceMember[],
): ChatPresenceAudienceMood {
  const active = members.filter((member) => member.state === 'ACTIVE').length;
  const typing = members.filter(
    (member) => Boolean(member.typingUntil && member.typingUntil > now()),
  ).length;
  const haters = members.filter((member) => member.role === 'HATER').length;
  const helpers = members.filter((member) => member.role === 'HELPER').length;

  if (channel === 'DEAL_ROOM') return 'PREDATORY';
  if (channel === 'SYNDICATE') return helpers > active ? 'INTIMATE' : 'WATCHFUL';
  if (typing + haters >= 5 || active >= 8) return 'SWARMING';
  if (typing + haters >= 3) return 'TENSE';
  if (active >= 3) return 'WATCHFUL';
  return 'CALM';
}

function stableParticipantSubtitle(member: InternalPresenceMember): string | undefined {
  if (member.role === 'HELPER') return 'Advisor';
  if (member.role === 'HATER') return 'Threat actor';
  if (member.role === 'NPC') return 'Spectator';
  if (member.role === 'SELF') return 'You';
  if (member.state === 'ACTIVE') return 'Active';
  if (member.state === 'IDLE') return 'Idle';
  if (member.state === 'AWAY') return 'Away';
  if (member.state === 'BACKGROUND') return 'Background';
  if (member.state === 'OFFLINE') return 'Offline';
  return undefined;
}

function compareMembers(a: InternalPresenceMember, b: InternalPresenceMember): number {
  const bucketOrder: Record<ChatPresenceSortBucket, number> = {
    SELF: 0,
    TYPING: 1,
    ACTIVE: 2,
    IDLE: 3,
    AWAY: 4,
    BACKGROUND: 5,
    OFFLINE: 6,
    HIDDEN: 7,
  };

  const bucketDelta = bucketOrder[a.sortBucket] - bucketOrder[b.sortBucket];
  if (bucketDelta !== 0) return bucketDelta;

  const seenDelta = (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0);
  if (seenDelta !== 0) return seenDelta;

  return a.displayName.localeCompare(b.displayName);
}

function cloneSnapshot(ledger: ChannelPresenceLedger): ChatPresenceStripView {
  const members = [...ledger.membersById.values()].sort(compareMembers);

  const participants = members.map<ChatPresenceParticipantView>((member) => ({
    playerId: member.playerId,
    displayName: member.displayName,
    channel: member.channel,
    role: member.role,
    state: member.state,
    sortBucket: member.sortBucket,
    isSelf: Boolean(member.isSelf),
    isTyping: Boolean(member.typingUntil && member.typingUntil > now()),
    isVisibleInStrip: !member.hidden && member.sortBucket !== 'HIDDEN',
    isLurking: Boolean(member.isLurking),
    aura: member.aura,
    subtitle: stableParticipantSubtitle(member),
    modeId: member.modeId,
    lastSeenAt: member.lastSeenAt,
    lastReadAt: member.lastReadAt,
    typingUntil: member.typingUntil,
    metadata: member.metadata,
  }));

  const visibleParticipants = participants.filter((participant) => participant.isVisibleInStrip);
  const typingParticipants = participants.filter((participant) => participant.isTyping);

  return {
    channel: ledger.channel,
    roomId: ledger.roomId,
    participants: visibleParticipants.slice(0, Infinity),
    activeCount: participants.filter((participant) => participant.state === 'ACTIVE').length,
    typingCount: typingParticipants.length,
    visibleCount: visibleParticipants.length,
    lurkCount: participants.filter((participant) => participant.isLurking).length,
    unreadCount: ledger.unreadCount,
    audienceMood: ledger.audienceMood,
    lastUpdatedAt: ledger.lastUpdatedAt,
  };
}

function mergeMetadata(
  previous?: Record<string, unknown>,
  next?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!previous && !next) return undefined;
  return {
    ...(previous ?? {}),
    ...(next ?? {}),
  };
}

export class ChatPresenceController {
  private readonly socketClient: ChatSocketClient;
  private readonly self: {
    playerId: string;
    displayName: string;
    aura?: string;
  };
  private readonly callbacks: ChatPresenceControllerCallbacks;
  private readonly config: ChatPresenceControllerConfig;
  private readonly log: (message: string, context?: Record<string, unknown>) => void;
  private readonly warn: (message: string, context?: Record<string, unknown>) => void;
  private readonly error: (message: string, context?: Record<string, unknown>) => void;

  private readonly ledgers = new Map<ChatChannel, ChannelPresenceLedger>();
  private readonly npcTypingPlans = new Map<string, NpcTheaterTypingPlan>();

  private transportState: ChatTransportState = 'IDLE';
  private localState: ChatPresenceState = 'IDLE';
  private visibility: ChatRuntimeVisibility;
  private destroyed = false;

  private localLastActivityAt = now();
  private localLastOpenAt: number | null = null;
  private localLastReadMessageByChannel = new Map<ChatChannel, string | undefined>();
  private localLastReadAtByChannel = new Map<ChatChannel, number | undefined>();

  private idleTimer: ReturnType<typeof setInterval> | null = null;
  private expiryTimer: ReturnType<typeof setInterval> | null = null;
  private typingStopTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: ChatPresenceControllerOptions) {
    this.socketClient = options.socketClient;
    this.self = { ...options.self };
    this.callbacks = options.callbacks ?? {};
    this.config = {
      ...DEFAULT_CONFIG,
      ...(options.config ?? {}),
    };

    this.log = this.config.log ?? (() => undefined);
    this.warn = this.config.warn ?? (() => undefined);
    this.error = this.config.error ?? (() => undefined);

    this.visibility = {
      isWindowVisible: options.initialVisibility?.isWindowVisible ?? true,
      isWindowFocused: options.initialVisibility?.isWindowFocused ?? true,
      isChatOpen: options.initialVisibility?.isChatOpen ?? false,
      activeChannel: options.initialChannel ?? options.initialVisibility?.activeChannel ?? 'GLOBAL',
    };

    for (const channel of CHANNELS) {
      this.ledgers.set(channel, createLedger(channel));
    }

    this.bootstrapLocalSelf();
    this.installTimers();
    this.syncSocketVisibility();
  }

  // ---------------------------------------------------------------------------
  // Public state access
  // ---------------------------------------------------------------------------

  public getActiveChannel(): ChatChannel {
    return this.visibility.activeChannel;
  }

  public isChatOpen(): boolean {
    return this.visibility.isChatOpen;
  }

  public getTransportState(): ChatTransportState {
    return this.transportState;
  }

  public getLocalPresenceState(): ChatPresenceState {
    return this.localState;
  }

  public getStrip(channel: ChatChannel = this.visibility.activeChannel): ChatPresenceStripView {
    const ledger = this.getLedger(channel);
    const snapshot = cloneSnapshot(ledger);
    snapshot.participants = snapshot.participants.slice(0, this.config.stripParticipantLimit);
    return snapshot;
  }

  public getSnapshot(): ChatPresenceControllerSnapshot {
    return {
      transportState: this.transportState,
      localState: this.localState,
      activeChannel: this.visibility.activeChannel,
      isChatOpen: this.visibility.isChatOpen,
      isWindowVisible: this.visibility.isWindowVisible,
      isWindowFocused: this.visibility.isWindowFocused,
      ledgers: CHANNELS.map((channel) => {
        const ledger = this.getLedger(channel);
        return {
          channel,
          roomId: ledger.roomId,
          revision: ledger.revision,
          memberCount: ledger.membersById.size,
          unreadCount: ledger.unreadCount,
          audienceMood: ledger.audienceMood,
          lastUpdatedAt: ledger.lastUpdatedAt,
        };
      }),
    };
  }

  // ---------------------------------------------------------------------------
  // Public lifecycle
  // ---------------------------------------------------------------------------

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.setLocalState('OFFLINE', 'destroyed');
    this.clearTimers();
    this.emitPresence('destroyed');
  }

  // ---------------------------------------------------------------------------
  // Public UI/runtime controls
  // ---------------------------------------------------------------------------

  public openChat(): void {
    this.visibility = {
      ...this.visibility,
      isChatOpen: true,
    };
    this.localLastOpenAt = now();
    this.localLastActivityAt = now();
    this.setLocalState('ACTIVE', 'chat_opened');
    this.resetUnreadForActiveChannel('chat_opened');
    this.syncSocketVisibility();
  }

  public closeChat(): void {
    this.visibility = {
      ...this.visibility,
      isChatOpen: false,
    };

    const nextState =
      this.visibility.isWindowVisible && this.visibility.isWindowFocused
        ? 'IDLE'
        : this.localState;

    this.setLocalState(nextState, 'chat_closed');
    this.syncSocketVisibility();
  }

  public switchChannel(channel: ChatChannel): void {
    if (this.visibility.activeChannel === channel) return;

    this.visibility = {
      ...this.visibility,
      activeChannel: channel,
    };

    this.localLastActivityAt = now();
    this.resetUnreadForActiveChannel('channel_switch');
    this.syncSocketVisibility();
    this.emitStrip(channel, 'channel_switch');
    this.emitSnapshot();
  }

  public setWindowFocus(isFocused: boolean): void {
    this.visibility = {
      ...this.visibility,
      isWindowFocused: isFocused,
    };

    if (!isFocused) {
      this.setLocalState(
        this.visibility.isWindowVisible ? 'AWAY' : 'BACKGROUND',
        'window_blur',
      );
    } else {
      this.localLastActivityAt = now();
      this.setLocalState(this.visibility.isChatOpen ? 'ACTIVE' : 'IDLE', 'window_focus');
    }

    this.syncSocketVisibility();
  }

  public setWindowVisible(isVisible: boolean): void {
    this.visibility = {
      ...this.visibility,
      isWindowVisible: isVisible,
    };

    if (!isVisible) {
      this.setLocalState('BACKGROUND', 'window_hidden');
      this.stopTypingIfNeeded('window_hidden');
    } else {
      this.localLastActivityAt = now();
      this.setLocalState(
        this.visibility.isWindowFocused && this.visibility.isChatOpen ? 'ACTIVE' : 'IDLE',
        'window_focus',
      );
    }

    this.syncSocketVisibility();
  }

  public noteLocalActivity(reason: ChatPresenceTransitionReason = 'manual_override'): void {
    this.localLastActivityAt = now();

    if (this.visibility.isWindowVisible && this.visibility.isWindowFocused) {
      this.setLocalState(this.visibility.isChatOpen ? 'ACTIVE' : 'IDLE', reason);
    }
  }

  public beginTyping(channel: ChatChannel = this.visibility.activeChannel): void {
    this.localLastActivityAt = now();
    this.setLocalState('ACTIVE', 'typing_started');
    this.upsertLocalSelf(channel, {
      typingUntil: now() + this.config.typingTtlMs!,
      state: 'ACTIVE',
      lastSeenAt: now(),
    });
    this.queueTyping(channel, 'STARTED');
    this.emitStrip(channel, 'typing_started');
    this.armLocalTypingStopGuard(channel);
  }

  public refreshTyping(channel: ChatChannel = this.visibility.activeChannel): void {
    this.localLastActivityAt = now();
    this.upsertLocalSelf(channel, {
      typingUntil: now() + this.config.typingTtlMs!,
      state: 'ACTIVE',
      lastSeenAt: now(),
    });
    this.queueTyping(channel, 'STARTED');
    this.emitStrip(channel, 'typing_started');
    this.armLocalTypingStopGuard(channel);
  }

  public stopTypingIfNeeded(
    reason: ChatPresenceTransitionReason = 'typing_stopped',
    channel: ChatChannel = this.visibility.activeChannel,
  ): void {
    const member = this.getLedger(channel).membersById.get(this.self.playerId);
    if (!member || !member.typingUntil) return;

    member.typingUntil = undefined;
    member.lastTransitionAt = now();
    member.sortBucket = deriveSortBucket(
      member.state,
      true,
      false,
      member.hidden,
    );

    this.queueTyping(channel, 'STOPPED');
    this.emitStrip(channel, reason);
  }

  public noteLocalMessageSent(args: {
    channel?: ChatChannel;
    messageId?: string;
    ts?: number;
  } = {}): void {
    const channel = args.channel ?? this.visibility.activeChannel;
    const readTs = args.ts ?? now();

    this.localLastActivityAt = readTs;
    this.stopTypingIfNeeded('local_message_sent', channel);
    this.upsertLocalSelf(channel, {
      state: 'ACTIVE',
      lastSeenAt: readTs,
      lastReadAt: readTs,
    });

    if (args.messageId) {
      this.localLastReadMessageByChannel.set(channel, args.messageId);
      this.localLastReadAtByChannel.set(channel, readTs);
    }

    this.queueReceipt(channel, args.messageId, readTs);
    this.resetUnread(channel, 'local_message_sent');
    this.setLocalState('ACTIVE', 'local_message_sent');
  }

  public noteInboundMessage(args: {
    channel: ChatChannel;
    messageId?: string;
    senderId?: string;
    ts?: number;
  }): void {
    const ledger = this.getLedger(args.channel);
    const timestamp = args.ts ?? now();

    if (
      this.visibility.isChatOpen &&
      this.visibility.activeChannel === args.channel &&
      this.visibility.isWindowVisible &&
      this.visibility.isWindowFocused
    ) {
      this.markRead({
        channel: args.channel,
        messageId: args.messageId,
        ts: timestamp,
      });
      return;
    }

    if (args.senderId === this.self.playerId) {
      return;
    }

    ledger.unreadCount += 1;
    ledger.lastUpdatedAt = timestamp;

    this.callbacks.onUnreadChanged?.(args.channel, ledger.unreadCount);
    this.emitStrip(args.channel, 'remote_delta');
  }

  public markRead(input: {
    channel?: ChatChannel;
    messageId?: string;
    ts?: number;
  }): void {
    const channel = input.channel ?? this.visibility.activeChannel;
    const readTs = input.ts ?? now();

    this.localLastReadMessageByChannel.set(channel, input.messageId);
    this.localLastReadAtByChannel.set(channel, readTs);

    const ledger = this.getLedger(channel);
    ledger.lastReadMessageId = input.messageId;
    ledger.lastReadAt = readTs;

    this.resetUnread(channel, 'read_receipt');
    this.queueReceipt(channel, input.messageId, readTs);
    this.upsertLocalSelf(channel, {
      lastReadAt: readTs,
      lastSeenAt: readTs,
      state: this.visibility.isChatOpen ? 'ACTIVE' : 'IDLE',
    });

    this.emitStrip(channel, 'read_receipt');
  }

  // ---------------------------------------------------------------------------
  // Public socket-side handlers
  // ---------------------------------------------------------------------------

  public handleTransportState(
    next: ChatTransportState,
    _previous: ChatTransportState,
    reason?: ChatDisconnectReason,
  ): void {
    this.transportState = next;

    if (next === 'CONNECTED') {
      this.setLocalState(
        this.visibility.isChatOpen ? 'ACTIVE' : 'IDLE',
        'transport_connected',
      );
      this.syncSocketVisibility();
    } else if (next === 'DISCONNECTED' || next === 'DEGRADED') {
      this.setLocalState('OFFLINE', 'transport_disconnected');
    }

    if (reason === 'destroyed') {
      this.setLocalState('OFFLINE', 'destroyed');
    }

    this.emitSnapshot();
  }

  public handlePresenceSnapshot(snapshot: ChatPresenceSnapshot): void {
    try {
      const ledger = this.getLedger(snapshot.channel);

      if (snapshot.revision < ledger.revision) {
        return;
      }

      ledger.roomId = snapshot.roomId;
      ledger.revision = snapshot.revision;
      ledger.membersById.clear();

      for (const member of snapshot.members) {
        ledger.membersById.set(
          member.playerId,
          this.toInternalMember(member, snapshot.channel),
        );
      }

      this.ensureLocalSelf(snapshot.channel);
      ledger.lastUpdatedAt = snapshot.serverTs;
      ledger.audienceMood = deriveAudienceMood(
        snapshot.channel,
        [...ledger.membersById.values()],
      );

      this.expireRemoteMembers(snapshot.channel);
      this.emitStrip(snapshot.channel, 'remote_snapshot');
      this.emitSnapshot();
    } catch (error) {
      this.emitControllerError(
        createError('Failed to apply presence snapshot.', error),
        { phase: 'handlePresenceSnapshot' },
      );
    }
  }

  public handlePresenceDelta(delta: ChatPresenceDelta): void {
    try {
      const ledger = this.getLedger(delta.channel);

      if (delta.revision < ledger.revision) {
        return;
      }

      ledger.roomId = delta.roomId ?? ledger.roomId;
      ledger.revision = delta.revision;

      for (const join of delta.joins ?? []) {
        ledger.membersById.set(join.playerId, this.toInternalMember(join, delta.channel));
      }

      for (const update of delta.updates ?? []) {
        const previous = ledger.membersById.get(update.playerId);
        ledger.membersById.set(
          update.playerId,
          this.toInternalMember(
            {
              ...(previous ?? {}),
              ...update,
              metadata: mergeMetadata(previous?.metadata, update.metadata),
            },
            delta.channel,
          ),
        );
      }

      for (const leaveId of delta.leaves ?? []) {
        const previous = ledger.membersById.get(leaveId);
        if (!previous) continue;

        ledger.membersById.set(leaveId, {
          ...previous,
          state: 'OFFLINE',
          hidden: previous.hidden,
          sortBucket: deriveSortBucket('OFFLINE', false, false, previous.hidden),
          lastSeenAt: delta.serverTs,
          lastTransitionAt: delta.serverTs,
        });
      }

      this.ensureLocalSelf(delta.channel);
      ledger.lastUpdatedAt = delta.serverTs;
      ledger.audienceMood = deriveAudienceMood(delta.channel, [...ledger.membersById.values()]);

      this.expireRemoteMembers(delta.channel);
      this.emitStrip(delta.channel, 'remote_delta');
      this.emitSnapshot();
    } catch (error) {
      this.emitControllerError(
        createError('Failed to apply presence delta.', error),
        { phase: 'handlePresenceDelta' },
      );
    }
  }

  public handleTyping(signal: ChatTypingSignal): void {
    try {
      const ledger = this.getLedger(signal.channel);
      const member =
        ledger.membersById.get(signal.playerId) ??
        this.toInternalMember(
          {
            playerId: signal.playerId,
            displayName: signal.displayName ?? signal.playerId,
            channel: signal.channel,
            state: 'IDLE',
            isNpc: signal.isNpc,
            isHelper: signal.isHelper,
            isHater: signal.isHater,
            lastSeenAt: signal.ts,
          },
          signal.channel,
        );

      if (signal.state === 'STARTED') {
        member.typingUntil = signal.expiresAt ?? now() + this.config.typingTtlMs!;
        member.typingSource = signal.playerId === this.self.playerId ? 'LOCAL' : 'REMOTE';
        member.state = member.state === 'OFFLINE' ? 'IDLE' : member.state;
        member.lastSeenAt = signal.ts;
      } else {
        member.typingUntil = undefined;
      }

      member.sortBucket = deriveSortBucket(
        member.state,
        Boolean(member.isSelf),
        Boolean(member.typingUntil && member.typingUntil > now()),
        member.hidden,
      );
      member.lastTransitionAt = now();
      ledger.membersById.set(member.playerId, member);
      ledger.lastUpdatedAt = signal.ts;
      ledger.audienceMood = deriveAudienceMood(signal.channel, [...ledger.membersById.values()]);

      this.emitTypingChanged(signal.channel);
      this.emitStrip(signal.channel, signal.state === 'STARTED' ? 'typing_started' : 'typing_stopped');
    } catch (error) {
      this.emitControllerError(
        createError('Failed to apply typing signal.', error),
        { phase: 'handleTyping' },
      );
    }
  }

  public handleReceipt(receipt: ChatReadReceipt): void {
    try {
      const ledger = this.getLedger(receipt.channel);
      const member = ledger.membersById.get(receipt.playerId);

      if (member) {
        member.lastReadAt = receipt.lastReadAt;
        member.lastSeenAt = Math.max(member.lastSeenAt, receipt.lastReadAt);
        member.lastTransitionAt = receipt.lastReadAt;
      }

      if (receipt.playerId === this.self.playerId) {
        ledger.lastReadMessageId = receipt.lastReadMessageId;
        ledger.lastReadAt = receipt.lastReadAt;
        this.resetUnread(receipt.channel, 'read_receipt');
      }

      ledger.lastUpdatedAt = receipt.lastReadAt;
      this.callbacks.onReceiptApplied?.(receipt);
      this.emitStrip(receipt.channel, 'read_receipt');
    } catch (error) {
      this.emitControllerError(
        createError('Failed to apply read receipt.', error),
        { phase: 'handleReceipt' },
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Public NPC/helper/hater presence theater
  // ---------------------------------------------------------------------------

  public stageNpcPresence(input: {
    channel: ChatChannel;
    participantId: string;
    displayName: string;
    role?: ChatPresenceRole;
    aura?: string;
    state?: ChatPresenceState;
    isLurking?: boolean;
    metadata?: Record<string, unknown>;
  }): void {
    if (!this.config.allowNpcPresenceTheater) return;

    const ledger = this.getLedger(input.channel);
    const role = input.role ?? 'NPC';
    const ts = now();

    ledger.membersById.set(input.participantId, {
      playerId: input.participantId,
      displayName: input.displayName,
      channel: input.channel,
      state: input.state ?? 'IDLE',
      role,
      sortBucket: deriveSortBucket(input.state ?? 'IDLE', false, false, false),
      isSelf: false,
      isNpc: role === 'NPC',
      isHelper: role === 'HELPER',
      isHater: role === 'HATER',
      aura: input.aura,
      createdAt: ts,
      lastSeenAt: ts,
      lastTransitionAt: ts,
      isLurking: input.isLurking,
      metadata: input.metadata,
    });

    ledger.lastUpdatedAt = ts;
    ledger.audienceMood = deriveAudienceMood(input.channel, [...ledger.membersById.values()]);
    this.emitStrip(input.channel, 'manual_override');
  }

  public stageNpcTyping(input: {
    channel: ChatChannel;
    participantId: string;
    displayName?: string;
    durationMs?: number;
    textHint?: string;
  }): void {
    if (!this.config.allowNpcPresenceTheater) return;

    const ledger = this.getLedger(input.channel);
    const member = ledger.membersById.get(input.participantId);
    if (!member) return;

    const startedAt = now();
    const expiresAt = startedAt + clamp(input.durationMs ?? 2_500, 400, this.config.typingTtlMs!);

    member.typingUntil = expiresAt;
    member.typingSource = 'NPC_THEATER';
    member.lastSeenAt = startedAt;
    member.lastTransitionAt = startedAt;
    member.sortBucket = deriveSortBucket(member.state, false, true, member.hidden);

    this.npcTypingPlans.set(input.participantId, {
      participantId: input.participantId,
      channel: input.channel,
      startedAt,
      expiresAt,
      textHint: input.textHint,
    });

    this.emitTypingChanged(input.channel);
    this.emitStrip(input.channel, 'typing_started');
  }

  public clearNpcPresence(input: {
    channel: ChatChannel;
    participantId: string;
  }): void {
    const ledger = this.getLedger(input.channel);
    ledger.membersById.delete(input.participantId);
    this.npcTypingPlans.delete(input.participantId);
    ledger.lastUpdatedAt = now();
    ledger.audienceMood = deriveAudienceMood(input.channel, [...ledger.membersById.values()]);
    this.emitStrip(input.channel, 'manual_override');
  }

  // ---------------------------------------------------------------------------
  // Internal timers
  // ---------------------------------------------------------------------------

  private installTimers(): void {
    this.idleTimer = setInterval(() => {
      if (this.destroyed) return;

      const elapsed = now() - this.localLastActivityAt;
      const nextState = this.deriveLocalStateFromActivity(elapsed);

      if (
        this.visibility.isWindowVisible &&
        this.visibility.isWindowFocused &&
        nextState !== this.localState &&
        !this.visibility.isChatOpen
      ) {
        this.setLocalState(nextState, nextState === 'AWAY' ? 'away_timeout' : 'idle_timeout');
      }
    }, 1_000);

    this.expiryTimer = setInterval(() => {
      if (this.destroyed) return;

      for (const channel of CHANNELS) {
        this.expireTyping(channel);
        this.expireRemoteMembers(channel);
      }
    }, 750);
  }

  private clearTimers(): void {
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }

    if (this.expiryTimer) {
      clearInterval(this.expiryTimer);
      this.expiryTimer = null;
    }

    if (this.typingStopTimer) {
      clearTimeout(this.typingStopTimer);
      this.typingStopTimer = null;
    }
  }

  private armLocalTypingStopGuard(channel: ChatChannel): void {
    if (this.typingStopTimer) {
      clearTimeout(this.typingStopTimer);
      this.typingStopTimer = null;
    }

    this.typingStopTimer = setTimeout(() => {
      this.stopTypingIfNeeded('typing_stopped', channel);
    }, this.config.typingTtlMs);
  }

  private deriveLocalStateFromActivity(elapsedMs: number): ChatPresenceState {
    if (!this.visibility.isWindowVisible) return 'BACKGROUND';
    if (!this.visibility.isWindowFocused) return 'AWAY';
    if (this.visibility.isChatOpen) return 'ACTIVE';
    if (elapsedMs >= this.config.awayAfterMs!) return 'AWAY';
    if (elapsedMs >= this.config.idleAfterMs!) return 'IDLE';
    return 'IDLE';
  }

  private expireTyping(channel: ChatChannel): void {
    const ledger = this.getLedger(channel);
    const ts = now();
    let changed = false;

    for (const member of ledger.membersById.values()) {
      if (member.typingUntil && member.typingUntil <= ts) {
        member.typingUntil = undefined;
        member.sortBucket = deriveSortBucket(
          member.state,
          Boolean(member.isSelf),
          false,
          member.hidden,
        );
        member.lastTransitionAt = ts;
        changed = true;
      }
    }

    for (const [participantId, plan] of this.npcTypingPlans.entries()) {
      if (plan.channel !== channel) continue;
      if (plan.expiresAt > ts) continue;
      this.npcTypingPlans.delete(participantId);
    }

    if (changed) {
      this.emitTypingChanged(channel);
      this.emitStrip(channel, 'typing_stopped');
    }
  }

  private expireRemoteMembers(channel: ChatChannel): void {
    const ledger = this.getLedger(channel);
    const cutoff = now() - this.config.remoteOfflineAfterMs!;
    let changed = false;

    for (const member of ledger.membersById.values()) {
      if (member.isSelf) continue;
      if (member.lastSeenAt > cutoff) continue;
      if (member.state === 'OFFLINE') continue;

      member.state = 'OFFLINE';
      member.sortBucket = deriveSortBucket('OFFLINE', false, false, member.hidden);
      member.lastTransitionAt = now();
      changed = true;
    }

    if (changed) {
      ledger.audienceMood = deriveAudienceMood(channel, [...ledger.membersById.values()]);
      this.emitStrip(channel, 'idle_timeout');
    }
  }

  // ---------------------------------------------------------------------------
  // Internal local self management
  // ---------------------------------------------------------------------------

  private bootstrapLocalSelf(): void {
    for (const channel of CHANNELS) {
      this.upsertLocalSelf(channel, {
        state: channel === this.visibility.activeChannel ? this.localState : 'IDLE',
        lastSeenAt: now(),
      });
    }

    this.emitSnapshot();
    this.emitStrip(this.visibility.activeChannel, 'bootstrap');
  }

  private ensureLocalSelf(channel: ChatChannel): void {
    const ledger = this.getLedger(channel);
    if (ledger.membersById.has(this.self.playerId)) return;

    ledger.membersById.set(this.self.playerId, {
      playerId: this.self.playerId,
      displayName: this.self.displayName,
      channel,
      state: channel === this.visibility.activeChannel ? this.localState : 'IDLE',
      role: 'SELF',
      sortBucket: deriveSortBucket(
        channel === this.visibility.activeChannel ? this.localState : 'IDLE',
        true,
        false,
        false,
      ),
      isSelf: true,
      aura: this.self.aura,
      createdAt: now(),
      lastSeenAt: now(),
      lastTransitionAt: now(),
    });
  }

  private upsertLocalSelf(
    channel: ChatChannel,
    patch: Partial<InternalPresenceMember>,
  ): void {
    const ledger = this.getLedger(channel);
    const previous = ledger.membersById.get(this.self.playerId);
    const nextState = patch.state ?? previous?.state ?? this.localState;
    const typing = Boolean((patch.typingUntil ?? previous?.typingUntil) && (patch.typingUntil ?? previous?.typingUntil)! > now());
    const hidden = patch.hidden ?? previous?.hidden ?? false;

    const next: InternalPresenceMember = {
      playerId: this.self.playerId,
      displayName: this.self.displayName,
      channel,
      state: nextState,
      role: 'SELF',
      sortBucket: deriveSortBucket(nextState, true, typing, hidden),
      isSelf: true,
      aura: patch.aura ?? previous?.aura ?? this.self.aura,
      createdAt: previous?.createdAt ?? now(),
      lastSeenAt: patch.lastSeenAt ?? previous?.lastSeenAt ?? now(),
      lastReadAt: patch.lastReadAt ?? previous?.lastReadAt,
      typingUntil: patch.typingUntil ?? previous?.typingUntil,
      hidden,
      lastTransitionAt: now(),
      metadata: mergeMetadata(previous?.metadata, patch.metadata),
      roomId: patch.roomId ?? previous?.roomId,
      modeId: patch.modeId ?? previous?.modeId,
      isLurking: patch.isLurking ?? previous?.isLurking,
      typingSource: patch.typingSource ?? previous?.typingSource,
      isNpc: false,
      isHelper: false,
      isHater: false,
      muted: patch.muted ?? previous?.muted,
    };

    ledger.membersById.set(this.self.playerId, next);
    ledger.lastUpdatedAt = now();
    ledger.audienceMood = deriveAudienceMood(channel, [...ledger.membersById.values()]);
  }

  private setLocalState(
    state: ChatPresenceState,
    reason: ChatPresenceTransitionReason,
  ): void {
    const previous = this.localState;
    if (previous === state) {
      this.emitPresence(reason);
      return;
    }

    this.localState = state;

    for (const channel of CHANNELS) {
      if (channel !== this.visibility.activeChannel) {
        this.upsertLocalSelf(channel, {
          state: state === 'ACTIVE' ? 'IDLE' : state,
          lastSeenAt: now(),
        });
      } else {
        this.upsertLocalSelf(channel, {
          state,
          lastSeenAt: now(),
        });
      }
      this.emitStrip(channel, reason);
    }

    this.callbacks.onLocalStateChanged?.(state, previous, reason);
    this.emitPresence(reason);
    this.emitSnapshot();
  }

  private emitPresence(reason: ChatPresenceTransitionReason): void {
    if (this.destroyed) return;
    if (!this.config.emitLocalPresenceImmediately) return;

    const payload: ChatPresenceIntent = {
      channel: this.visibility.activeChannel,
      state: this.localState,
      isChatOpen: this.visibility.isChatOpen,
      isWindowVisible: this.visibility.isWindowVisible,
      isWindowFocused: this.visibility.isWindowFocused,
      metadata: {
        reason,
        localLastOpenAt: this.localLastOpenAt,
      },
    };

    this.socketClient.queuePresence(payload);
  }

  private queueTyping(channel: ChatChannel, state: 'STARTED' | 'STOPPED'): void {
    const intent: ChatTypingIntent = {
      channel,
      state,
      expiresAt: state === 'STARTED' ? now() + this.config.typingTtlMs! : undefined,
      metadata: {
        source: 'presence_controller',
      },
    };

    this.socketClient.queueTyping(intent);
  }

  private queueReceipt(
    channel: ChatChannel,
    messageId: string | undefined,
    ts: number,
  ): void {
    this.socketClient.queueReadReceipt({
      channel,
      playerId: this.self.playerId,
      lastReadMessageId: messageId,
      lastReadAt: ts,
    });
  }

  private syncSocketVisibility(): void {
    this.socketClient.setVisibility(this.visibility);
  }

  // ---------------------------------------------------------------------------
  // Internal ledger transforms
  // ---------------------------------------------------------------------------

  private getLedger(channel: ChatChannel): ChannelPresenceLedger {
    const ledger = this.ledgers.get(channel);
    if (!ledger) {
      throw createError(`Presence ledger missing for channel ${channel}.`);
    }
    return ledger;
  }

  private toInternalMember(
    member: Partial<ChatPresenceMember>,
    channel: ChatChannel,
  ): InternalPresenceMember {
    const typingUntil = member.typingUntil;
    const isTyping = Boolean(typingUntil && typingUntil > now());
    const role = deriveRole(member);

    return {
      playerId: member.playerId ?? 'unknown',
      displayName: member.displayName ?? member.playerId ?? 'Unknown',
      channel,
      state: member.state ?? 'IDLE',
      role,
      sortBucket: deriveSortBucket(
        member.state ?? 'IDLE',
        Boolean(member.isSelf),
        isTyping,
        member.hidden,
      ),
      isSelf: Boolean(member.isSelf),
      isNpc: Boolean(member.isNpc),
      isHelper: Boolean(member.isHelper),
      isHater: Boolean(member.isHater),
      aura: member.aura,
      lastSeenAt: member.lastSeenAt ?? now(),
      lastReadAt: member.lastReadAt,
      typingUntil,
      hidden: Boolean(member.hidden),
      muted: Boolean(member.muted),
      roomId: member.roomId,
      modeId: member.modeId,
      metadata: member.metadata,
      createdAt: now(),
      lastTransitionAt: now(),
      isLurking: false,
    };
  }

  private resetUnreadForActiveChannel(reason: ChatPresenceTransitionReason): void {
    this.resetUnread(this.visibility.activeChannel, reason);
  }

  private resetUnread(
    channel: ChatChannel,
    reason: ChatPresenceTransitionReason,
  ): void {
    const ledger = this.getLedger(channel);
    if (ledger.unreadCount === 0 && reason !== 'read_receipt') return;

    ledger.unreadCount = 0;
    ledger.lastUpdatedAt = now();
    this.callbacks.onUnreadChanged?.(channel, 0);
    this.emitStrip(channel, reason);
  }

  // ---------------------------------------------------------------------------
  // Internal emissions
  // ---------------------------------------------------------------------------

  private emitStrip(
    channel: ChatChannel,
    reason: ChatPresenceTransitionReason,
  ): void {
    const view = this.getStrip(channel);
    this.callbacks.onPresenceChanged?.(channel, view, reason);
  }

  private emitTypingChanged(channel: ChatChannel): void {
    const typingIds = this.getStrip(channel).participants
      .filter((participant) => participant.isTyping)
      .map((participant) => participant.playerId);

    this.callbacks.onTypingChanged?.(channel, typingIds);
  }

  private emitSnapshot(): void {
    this.callbacks.onSnapshotChanged?.(this.getSnapshot());
  }

  private emitControllerError(
    error: Error,
    context?: Record<string, unknown>,
  ): void {
    this.callbacks.onControllerError?.(error, context);
    this.error(error.message, context);
  }
}

// -----------------------------------------------------------------------------
// Socket callback adapter helpers
// -----------------------------------------------------------------------------

export interface ChatPresenceSocketCallbackAdapter {
  onTransportState: (
    next: ChatTransportState,
    previous: ChatTransportState,
    reason?: ChatDisconnectReason,
  ) => void;
  onPresenceSnapshot: (snapshot: ChatPresenceSnapshot) => void;
  onPresenceDelta: (delta: ChatPresenceDelta) => void;
  onTyping: (signal: ChatTypingSignal) => void;
  onReceipt: (receipt: ChatReadReceipt) => void;
}

export function createChatPresenceSocketCallbackAdapter(
  controller: ChatPresenceController,
): ChatPresenceSocketCallbackAdapter {
  return {
    onTransportState: (next, previous, reason) => {
      controller.handleTransportState(next, previous, reason);
    },
    onPresenceSnapshot: (snapshot) => {
      controller.handlePresenceSnapshot(snapshot);
    },
    onPresenceDelta: (delta) => {
      controller.handlePresenceDelta(delta);
    },
    onTyping: (signal) => {
      controller.handleTyping(signal);
    },
    onReceipt: (receipt) => {
      controller.handleReceipt(receipt);
    },
  };
}

// -----------------------------------------------------------------------------
// Convenience constructor
// -----------------------------------------------------------------------------

export function createChatPresenceController(
  options: ChatPresenceControllerOptions,
): ChatPresenceController {
  return new ChatPresenceController(options);
}
