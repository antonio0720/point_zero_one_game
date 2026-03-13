
/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ENGINE NOTIFICATION CONTROLLER
 * FILE: pzo-web/src/engines/chat/ChatNotificationController.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical frontend notification authority for the unified chat engine.
 *
 * This file moves alerting, badge state, unread pressure, browser notice
 * shaping, and in-app notification feed ownership out of UI hooks.
 *
 * What this controller owns
 * -------------------------
 * - unread aggregation by channel
 * - notification materialization from inbound messages / server notifications /
 *   invasions / moderation events
 * - local suppression when the player is already looking at the active channel
 * - browser notification gating
 * - title badge shaping
 * - seen/dismiss lifecycle
 * - severity escalation
 * - replay-safe dedup
 * - pressure-sensitive presentation policy
 *
 * Why this file exists
 * --------------------
 * The donor hook in pzo-web/src/components/chat/useChatEngine.ts only tracks
 * unread counts in local React state. That is enough for a prototype, but it is
 * not enough for the unified engine you locked:
 * - GLOBAL needs theatrical but controlled noise.
 * - SYNDICATE needs tactical signal-over-noise.
 * - DEAL_ROOM needs predatory pressure without spam.
 * - LOBBY needs welcoming prompts with low intrusion.
 *
 * Design laws
 * -----------
 * - Components render notifications; they do not own their policy.
 * - Transcript truth remains backend authoritative.
 * - Browser notifications are opt-in, deduped, and channel-aware.
 * - Unread counts should reflect real attention state, not only message volume.
 * - Major events can escalate above active-channel suppression.
 *
 * Migration note
 * --------------
 * This file is intentionally self-contained against:
 * - ./ChatSocketClient
 * - ./ChatPresenceController
 *
 * Once /shared/contracts/chat and pzo-web/src/engines/chat/types.ts are live,
 * local compatibility contracts can be replaced with canonical imports.
 *
 * Density6 LLC · Point Zero One · Production-first architecture
 */

import {
  ChatSocketClient,
  type ChatChannel,
  type ChatInvasionEvent,
  type ChatMessage,
  type ChatModerationEvent,
  type ChatNotification,
  type ChatSocketClientStateSnapshot,
  type ChatTransportState,
} from './ChatSocketClient';

import {
  ChatPresenceController,
  type ChatPresenceControllerSnapshot,
  type ChatPresenceStripView,
} from './ChatPresenceController';

export type ChatNotificationSurface =
  | 'INLINE_FEED'
  | 'BANNER'
  | 'BADGE'
  | 'BROWSER'
  | 'TITLE'
  | 'SOUND'
  | 'NONE';

export type ChatNotificationKind =
  | 'MESSAGE'
  | 'SERVER_NOTIFICATION'
  | 'INVASION'
  | 'MODERATION'
  | 'SYSTEM'
  | 'REPLAY_MARKER'
  | 'PRESSURE'
  | 'HELPER'
  | 'HATER'
  | 'DEALROOM';

export type ChatNotificationSeverity =
  | 'INFO'
  | 'TACTICAL'
  | 'WARN'
  | 'CRITICAL';

export type ChatNotificationState =
  | 'QUEUED'
  | 'DELIVERED'
  | 'SEEN'
  | 'DISMISSED'
  | 'ARCHIVED';

export type ChatNotificationSoundCue =
  | 'NONE'
  | 'SOFT_TICK'
  | 'ALERT'
  | 'THREAT'
  | 'SUCCESS'
  | 'PREDATOR'
  | 'TACTICAL_PING';

export type ChatNotificationSource =
  | 'MESSAGE'
  | 'NOTIFICATION'
  | 'INVASION'
  | 'MODERATION'
  | 'SYSTEM';

export type ChatNotificationSuppressionReason =
  | 'none'
  | 'active_channel_visible'
  | 'window_visible_same_channel'
  | 'window_focused_same_channel'
  | 'duplicate'
  | 'replay'
  | 'channel_muted'
  | 'severity_below_threshold'
  | 'browser_disabled'
  | 'browser_denied'
  | 'transport_offline'
  | 'destroyed';

export type ChatNotificationAttentionMode =
  | 'FULL_FOCUS'
  | 'VISIBLE_DISTRACTED'
  | 'BACKGROUND'
  | 'CLOSED'
  | 'OFFLINE';

export type ChatNotificationRouteReason =
  | 'new_message'
  | 'server_event'
  | 'invasion'
  | 'moderation'
  | 'system'
  | 'manual_test'
  | 'replay_hydration';

export interface ChatNotificationRecord {
  id: string;
  source: ChatNotificationSource;
  kind: ChatNotificationKind;
  channel: ChatChannel;
  title: string;
  body: string;
  ts: number;
  severity: ChatNotificationSeverity;
  state: ChatNotificationState;
  unreadContribution: number;
  canBrowserNotify: boolean;
  canBanner: boolean;
  canSound: boolean;
  soundCue: ChatNotificationSoundCue;
  surfaces: ChatNotificationSurface[];
  suppressionReason: ChatNotificationSuppressionReason;
  metadata?: Record<string, unknown>;
  linkedMessageId?: string;
  linkedServerNotificationId?: string;
}

export interface ChatChannelBadgeState {
  channel: ChatChannel;
  unreadCount: number;
  unseenNotificationCount: number;
  criticalCount: number;
  tacticalCount: number;
  lastEventAt: number | null;
  titlePreview?: string;
}

export interface ChatNotificationControllerSnapshot {
  activeChannel: ChatChannel;
  transportState: ChatTransportState;
  attentionMode: ChatNotificationAttentionMode;
  totalUnread: number;
  totalUnseenNotifications: number;
  browserPermission: ChatBrowserPermissionState;
  badges: ChatChannelBadgeState[];
  recent: ChatNotificationRecord[];
  deliveredBrowserCount: number;
  suppressedCount: number;
}

export interface ChatNotificationRouteDecision {
  surfaces: ChatNotificationSurface[];
  soundCue: ChatNotificationSoundCue;
  suppressionReason: ChatNotificationSuppressionReason;
  unreadContribution: number;
  severity: ChatNotificationSeverity;
  allowBrowser: boolean;
  allowBanner: boolean;
  allowSound: boolean;
}

export interface ChatNotificationControllerCallbacks {
  onNotificationEnqueued?: (record: ChatNotificationRecord) => void;
  onNotificationUpdated?: (record: ChatNotificationRecord) => void;
  onBrowserNotificationDelivered?: (record: ChatNotificationRecord) => void;
  onBannerRequested?: (record: ChatNotificationRecord) => void;
  onSoundRequested?: (
    record: ChatNotificationRecord,
    cue: ChatNotificationSoundCue,
  ) => void;
  onSnapshotChanged?: (snapshot: ChatNotificationControllerSnapshot) => void;
  onTitleChanged?: (title: string) => void;
  onError?: (error: Error, context?: Record<string, unknown>) => void;
}

export interface ChatNotificationControllerConfig {
  recentLimit?: number;
  browserMaxPerMinute?: number;
  browserAutoCloseMs?: number;
  bannerMaxVisible?: number;
  activeChannelBannerSeverityFloor?: ChatNotificationSeverity;
  browserSeverityFloor?: ChatNotificationSeverity;
  soundSeverityFloor?: ChatNotificationSeverity;
  allowBrowserNotifications?: boolean;
  allowTitleBadge?: boolean;
  allowSounds?: boolean;
  baseTitle?: string;
  dedupWindowMs?: number;
  idleUnreadCollapseMs?: number;
  log?: (message: string, context?: Record<string, unknown>) => void;
  warn?: (message: string, context?: Record<string, unknown>) => void;
  error?: (message: string, context?: Record<string, unknown>) => void;
}

export interface ChatNotificationControllerOptions {
  socketClient: ChatSocketClient;
  presenceController: ChatPresenceController;
  callbacks?: ChatNotificationControllerCallbacks;
  config?: ChatNotificationControllerConfig;
}

interface InternalChannelBadgeState extends ChatChannelBadgeState {
  muted: boolean;
}

interface BrowserNotificationLike {
  close?: () => void;
  onclick?: (() => void) | null;
}

interface BrowserNotificationCtor {
  permission?: string;
  requestPermission?: () => Promise<string>;
  new (title: string, options?: Record<string, unknown>): BrowserNotificationLike;
}

type BrowserPermissionValue = 'default' | 'granted' | 'denied';

export type ChatBrowserPermissionState =
  | 'UNSUPPORTED'
  | 'DEFAULT'
  | 'GRANTED'
  | 'DENIED';

interface InternalBrowserNotificationEntry {
  recordId: string;
  handle: BrowserNotificationLike;
  closeTimer: ReturnType<typeof setTimeout> | null;
}

const CHANNELS: ChatChannel[] = ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'];

const DEFAULT_CONFIG: Required<
  Pick<
    ChatNotificationControllerConfig,
    | 'recentLimit'
    | 'browserMaxPerMinute'
    | 'browserAutoCloseMs'
    | 'bannerMaxVisible'
    | 'activeChannelBannerSeverityFloor'
    | 'browserSeverityFloor'
    | 'soundSeverityFloor'
    | 'allowBrowserNotifications'
    | 'allowTitleBadge'
    | 'allowSounds'
    | 'baseTitle'
    | 'dedupWindowMs'
    | 'idleUnreadCollapseMs'
  >
> = {
  recentLimit: 120,
  browserMaxPerMinute: 6,
  browserAutoCloseMs: 8_000,
  bannerMaxVisible: 3,
  activeChannelBannerSeverityFloor: 'CRITICAL',
  browserSeverityFloor: 'WARN',
  soundSeverityFloor: 'TACTICAL',
  allowBrowserNotifications: true,
  allowTitleBadge: true,
  allowSounds: true,
  baseTitle: 'Point Zero One',
  dedupWindowMs: 6_000,
  idleUnreadCollapseMs: 120_000,
};

function now(): number {
  return Date.now();
}

function createError(message: string, cause?: unknown): Error {
  if (cause instanceof Error) {
    return new Error(message, { cause });
  }
  return new Error(message);
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function limitArray<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) return items;
  return items.slice(items.length - limit);
}

function severityRank(value: ChatNotificationSeverity): number {
  switch (value) {
    case 'INFO':
      return 1;
    case 'TACTICAL':
      return 2;
    case 'WARN':
      return 3;
    case 'CRITICAL':
      return 4;
    default:
      return 1;
  }
}

function compareSeverity(
  left: ChatNotificationSeverity,
  right: ChatNotificationSeverity,
): number {
  return severityRank(left) - severityRank(right);
}

function inferAttentionMode(args: {
  transportState: ChatTransportState;
  windowVisible: boolean;
  windowFocused: boolean;
  chatOpen: boolean;
}): ChatNotificationAttentionMode {
  if (args.transportState !== 'CONNECTED') return 'OFFLINE';
  if (args.chatOpen && args.windowVisible && args.windowFocused) return 'FULL_FOCUS';
  if (args.windowVisible && args.windowFocused) return 'VISIBLE_DISTRACTED';
  if (args.windowVisible) return 'BACKGROUND';
  return 'CLOSED';
}

function coerceBrowserPermission(input: string | undefined): ChatBrowserPermissionState {
  switch (input as BrowserPermissionValue | undefined) {
    case 'granted':
      return 'GRANTED';
    case 'denied':
      return 'DENIED';
    case 'default':
      return 'DEFAULT';
    default:
      return 'UNSUPPORTED';
  }
}

function globalAny(): Record<string, unknown> {
  return globalThis as unknown as Record<string, unknown>;
}

function getBrowserNotificationCtor(): BrowserNotificationCtor | null {
  const candidate = globalAny().Notification as BrowserNotificationCtor | undefined;
  if (!candidate) return null;
  return candidate;
}

function deriveMessageNotificationKind(message: ChatMessage): ChatNotificationKind {
  switch (message.kind) {
    case 'BOT_ATTACK':
      return 'HATER';
    case 'BOT_RETREAT':
      return 'HATER';
    case 'HELPER':
      return 'HELPER';
    case 'INVASION':
      return 'INVASION';
    case 'DEAL_ROOM':
      return 'DEALROOM';
    case 'SYSTEM':
      return 'SYSTEM';
    case 'MARKET_ALERT':
    case 'SHIELD_EVENT':
    case 'CASCADE_ALERT':
      return 'PRESSURE';
    default:
      return 'MESSAGE';
  }
}

function inferMessageSeverity(message: ChatMessage): ChatNotificationSeverity {
  switch (message.kind) {
    case 'BOT_ATTACK':
    case 'INVASION':
      return 'CRITICAL';
    case 'MARKET_ALERT':
    case 'SHIELD_EVENT':
    case 'CASCADE_ALERT':
      return 'WARN';
    case 'HELPER':
    case 'DEAL_ROOM':
      return 'TACTICAL';
    default:
      return 'INFO';
  }
}

function inferMessageSoundCue(message: ChatMessage): ChatNotificationSoundCue {
  switch (message.kind) {
    case 'BOT_ATTACK':
      return 'THREAT';
    case 'INVASION':
      return 'PREDATOR';
    case 'DEAL_ROOM':
      return 'TACTICAL_PING';
    case 'HELPER':
      return 'SOFT_TICK';
    case 'ACHIEVEMENT':
      return 'SUCCESS';
    case 'MARKET_ALERT':
    case 'SHIELD_EVENT':
    case 'CASCADE_ALERT':
      return 'ALERT';
    default:
      return 'NONE';
  }
}

function summarizeBody(input: string, maxLength = 140): string {
  const normalized = normalizeText(input);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function titleForMessage(message: ChatMessage): string {
  if (message.senderName && message.senderName !== 'SYSTEM') {
    return `${message.senderName} • ${message.channel}`;
  }
  switch (message.kind) {
    case 'MARKET_ALERT':
      return 'Market Alert';
    case 'SHIELD_EVENT':
      return 'Shield Event';
    case 'CASCADE_ALERT':
      return 'Cascade Alert';
    case 'ACHIEVEMENT':
      return 'Achievement';
    default:
      return 'System Notice';
  }
}

function bodyForModeration(event: ChatModerationEvent): string {
  return normalizeText(
    `${event.code}${event.reason ? ` — ${event.reason}` : ''}${event.channel ? ` · ${event.channel}` : ''}`,
  );
}

function titleForModeration(event: ChatModerationEvent): string {
  return event.code === 'RATE_LIMITED'
    ? 'Chat Rate Limited'
    : event.code === 'MUTED'
      ? 'Chat Muted'
      : event.code === 'UNMUTED'
        ? 'Chat Restored'
        : 'Moderation Notice';
}

function inferSeverityForModeration(event: ChatModerationEvent): ChatNotificationSeverity {
  switch (event.code) {
    case 'MESSAGE_REJECTED':
    case 'CHANNEL_LOCKED':
      return 'WARN';
    case 'MUTED':
    case 'RATE_LIMITED':
      return 'TACTICAL';
    case 'UNMUTED':
    case 'CHANNEL_UNLOCKED':
      return 'INFO';
    default:
      return 'INFO';
  }
}

function inferSoundCueForModeration(event: ChatModerationEvent): ChatNotificationSoundCue {
  switch (event.code) {
    case 'MESSAGE_REJECTED':
    case 'CHANNEL_LOCKED':
      return 'ALERT';
    case 'MUTED':
    case 'RATE_LIMITED':
      return 'TACTICAL_PING';
    default:
      return 'NONE';
  }
}

function inferSeverityForServerNotification(
  notification: ChatNotification,
): ChatNotificationSeverity {
  switch (notification.severity) {
    case 'CRITICAL':
      return 'CRITICAL';
    case 'WARN':
      return 'WARN';
    default:
      return 'INFO';
  }
}

function inferSoundCueForServerNotification(
  notification: ChatNotification,
): ChatNotificationSoundCue {
  switch (notification.severity) {
    case 'CRITICAL':
      return 'THREAT';
    case 'WARN':
      return 'ALERT';
    default:
      return 'SOFT_TICK';
  }
}

function inferSeverityForInvasion(event: ChatInvasionEvent): ChatNotificationSeverity {
  switch (event.severity) {
    case 'CRITICAL':
      return 'CRITICAL';
    case 'HIGH':
      return 'WARN';
    case 'MEDIUM':
      return 'TACTICAL';
    default:
      return 'INFO';
  }
}

function inferSoundCueForInvasion(event: ChatInvasionEvent): ChatNotificationSoundCue {
  switch (event.severity) {
    case 'CRITICAL':
      return 'PREDATOR';
    case 'HIGH':
      return 'THREAT';
    case 'MEDIUM':
      return 'ALERT';
    default:
      return 'TACTICAL_PING';
  }
}

function makeBadge(channel: ChatChannel): InternalChannelBadgeState {
  return {
    channel,
    unreadCount: 0,
    unseenNotificationCount: 0,
    criticalCount: 0,
    tacticalCount: 0,
    lastEventAt: null,
    titlePreview: undefined,
    muted: false,
  };
}

function hashRecordKey(parts: string[]): string {
  let hash = 0;
  const composite = parts.join('|');
  for (let index = 0; index < composite.length; index += 1) {
    hash = (hash * 33 + composite.charCodeAt(index)) >>> 0;
  }
  return `n_${hash.toString(16)}`;
}

export class ChatNotificationController {
  private readonly socketClient: ChatSocketClient;
  private readonly presenceController: ChatPresenceController;
  private readonly callbacks: ChatNotificationControllerCallbacks;
  private readonly config: Required<
    Pick<
      ChatNotificationControllerConfig,
      | 'recentLimit'
      | 'browserMaxPerMinute'
      | 'browserAutoCloseMs'
      | 'bannerMaxVisible'
      | 'activeChannelBannerSeverityFloor'
      | 'browserSeverityFloor'
      | 'soundSeverityFloor'
      | 'allowBrowserNotifications'
      | 'allowTitleBadge'
      | 'allowSounds'
      | 'baseTitle'
      | 'dedupWindowMs'
      | 'idleUnreadCollapseMs'
    >
  >;
  private readonly log?: (message: string, context?: Record<string, unknown>) => void;
  private readonly warn?: (message: string, context?: Record<string, unknown>) => void;
  private readonly error?: (message: string, context?: Record<string, unknown>) => void;

  private destroyed = false;
  private activeChannel: ChatChannel = 'GLOBAL';
  private transportState: ChatTransportState = 'IDLE';
  private windowVisible = true;
  private windowFocused = true;
  private chatOpen = false;
  private browserPermission: ChatBrowserPermissionState = 'UNSUPPORTED';
  private deliveredBrowserCount = 0;
  private suppressedCount = 0;

  private readonly recent: ChatNotificationRecord[] = [];
  private readonly byId = new Map<string, ChatNotificationRecord>();
  private readonly badges = new Map<ChatChannel, InternalChannelBadgeState>();
  private readonly dedupWindow = new Map<string, number>();
  private readonly browserWindowHistory: number[] = [];
  private readonly activeBrowserNotifications = new Map<string, InternalBrowserNotificationEntry>();
  private titleRestoreTimer: ReturnType<typeof setTimeout> | null = null;
  private idleCollapseTimer: ReturnType<typeof setInterval> | null = null;

  public constructor(options: ChatNotificationControllerOptions) {
    this.socketClient = options.socketClient;
    this.presenceController = options.presenceController;
    this.callbacks = options.callbacks ?? {};
    this.config = {
      ...DEFAULT_CONFIG,
      ...options.config,
    };
    this.log = options.config?.log;
    this.warn = options.config?.warn;
    this.error = options.config?.error;

    for (const channel of CHANNELS) {
      this.badges.set(channel, makeBadge(channel));
    }

    try {
      const presenceSnapshot = this.presenceController.getSnapshot();
      this.activeChannel = presenceSnapshot.activeChannel;
      this.transportState = presenceSnapshot.transportState;
      this.windowVisible = presenceSnapshot.isWindowVisible;
      this.windowFocused = presenceSnapshot.isWindowFocused;
      this.chatOpen = presenceSnapshot.isChatOpen;
    } catch {
      const socketSnapshot = this.socketClient.getStateSnapshot();
      this.transportState = socketSnapshot.state;
      this.activeChannel = socketSnapshot.activeChannel ?? 'GLOBAL';
    }

    this.browserPermission = this.readBrowserPermission();
    this.idleCollapseTimer = setInterval(() => {
      this.sweepDedupWindow();
      this.collapseIdleUnreadPreview();
    }, 5_000);

    this.renderDocumentTitle();
    this.emitSnapshot();
  }

  // ---------------------------------------------------------------------------
  // Public read surface
  // ---------------------------------------------------------------------------

  public getSnapshot(): ChatNotificationControllerSnapshot {
    const badges = CHANNELS.map((channel) => {
      const badge = this.requireBadge(channel);
      return {
        channel,
        unreadCount: badge.unreadCount,
        unseenNotificationCount: badge.unseenNotificationCount,
        criticalCount: badge.criticalCount,
        tacticalCount: badge.tacticalCount,
        lastEventAt: badge.lastEventAt,
        titlePreview: badge.titlePreview,
      };
    });

    return {
      activeChannel: this.activeChannel,
      transportState: this.transportState,
      attentionMode: inferAttentionMode({
        transportState: this.transportState,
        windowVisible: this.windowVisible,
        windowFocused: this.windowFocused,
        chatOpen: this.chatOpen,
      }),
      totalUnread: badges.reduce((sum, badge) => sum + badge.unreadCount, 0),
      totalUnseenNotifications: badges.reduce(
        (sum, badge) => sum + badge.unseenNotificationCount,
        0,
      ),
      browserPermission: this.browserPermission,
      badges,
      recent: [...this.recent],
      deliveredBrowserCount: this.deliveredBrowserCount,
      suppressedCount: this.suppressedCount,
    };
  }

  public getRecent(limit = 20): ChatNotificationRecord[] {
    return this.recent.slice(Math.max(0, this.recent.length - limit));
  }

  public getBadge(channel: ChatChannel): ChatChannelBadgeState {
    const badge = this.requireBadge(channel);
    return {
      channel: badge.channel,
      unreadCount: badge.unreadCount,
      unseenNotificationCount: badge.unseenNotificationCount,
      criticalCount: badge.criticalCount,
      tacticalCount: badge.tacticalCount,
      lastEventAt: badge.lastEventAt,
      titlePreview: badge.titlePreview,
    };
  }

  // ---------------------------------------------------------------------------
  // Public lifecycle
  // ---------------------------------------------------------------------------

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.idleCollapseTimer) {
      clearInterval(this.idleCollapseTimer);
      this.idleCollapseTimer = null;
    }

    if (this.titleRestoreTimer) {
      clearTimeout(this.titleRestoreTimer);
      this.titleRestoreTimer = null;
    }

    for (const entry of this.activeBrowserNotifications.values()) {
      if (entry.closeTimer) clearTimeout(entry.closeTimer);
      try {
        entry.handle.close?.();
      } catch {
        // ignore
      }
    }

    this.activeBrowserNotifications.clear();
    this.renderDocumentTitle();
    this.emitSnapshot();
  }

  // ---------------------------------------------------------------------------
  // Public runtime state inputs
  // ---------------------------------------------------------------------------

  public switchChannel(channel: ChatChannel): void {
    this.assertNotDestroyed('switchChannel');

    if (this.activeChannel === channel) return;
    this.activeChannel = channel;

    if (this.chatOpen && this.windowVisible && this.windowFocused) {
      this.markChannelSeen(channel, 'active_focus');
    }

    this.renderDocumentTitle();
    this.emitSnapshot();
  }

  public setChatOpen(isOpen: boolean): void {
    this.assertNotDestroyed('setChatOpen');

    this.chatOpen = isOpen;
    if (isOpen && this.windowVisible && this.windowFocused) {
      this.markChannelSeen(this.activeChannel, 'chat_open');
    }

    this.renderDocumentTitle();
    this.emitSnapshot();
  }

  public setWindowVisible(isVisible: boolean): void {
    this.assertNotDestroyed('setWindowVisible');

    this.windowVisible = isVisible;
    if (isVisible && this.chatOpen && this.windowFocused) {
      this.markChannelSeen(this.activeChannel, 'window_visible');
    }

    this.renderDocumentTitle();
    this.emitSnapshot();
  }

  public setWindowFocus(isFocused: boolean): void {
    this.assertNotDestroyed('setWindowFocus');

    this.windowFocused = isFocused;
    if (isFocused && this.windowVisible && this.chatOpen) {
      this.markChannelSeen(this.activeChannel, 'window_focus');
    }

    this.renderDocumentTitle();
    this.emitSnapshot();
  }

  public handlePresenceSnapshot(snapshot: ChatPresenceControllerSnapshot): void {
    this.assertNotDestroyed('handlePresenceSnapshot');

    this.activeChannel = snapshot.activeChannel;
    this.transportState = snapshot.transportState;
    this.windowVisible = snapshot.isWindowVisible;
    this.windowFocused = snapshot.isWindowFocused;
    this.chatOpen = snapshot.isChatOpen;

    for (const ledger of snapshot.ledgers) {
      const badge = this.requireBadge(ledger.channel);
      badge.unreadCount = ledger.unreadCount;
      badge.lastEventAt = ledger.lastUpdatedAt;
    }

    this.renderDocumentTitle();
    this.emitSnapshot();
  }

  public handlePresenceStrip(view: ChatPresenceStripView): void {
    this.assertNotDestroyed('handlePresenceStrip');

    const badge = this.requireBadge(view.channel);
    if (!badge.titlePreview && view.participants.length > 0) {
      badge.titlePreview = view.participants
        .slice(0, 2)
        .map((participant) => participant.displayName)
        .join(', ');
      this.renderDocumentTitle();
      this.emitSnapshot();
    }
  }

  public handleTransportState(
    next: ChatTransportState,
    _previous: ChatTransportState,
  ): void {
    this.assertNotDestroyed('handleTransportState');

    this.transportState = next;
    this.renderDocumentTitle();
    this.emitSnapshot();
  }

  // ---------------------------------------------------------------------------
  // Public event entrypoints
  // ---------------------------------------------------------------------------

  public noteInboundMessage(
    message: ChatMessage,
    routeReason: ChatNotificationRouteReason = 'new_message',
  ): ChatNotificationRecord {
    this.assertNotDestroyed('noteInboundMessage');

    const record = this.materializeFromMessage(message, routeReason);
    return this.enqueue(record, routeReason);
  }

  public noteSocketNotification(
    notification: ChatNotification,
    routeReason: ChatNotificationRouteReason = 'server_event',
  ): ChatNotificationRecord {
    this.assertNotDestroyed('noteSocketNotification');

    const record = this.materializeFromServerNotification(notification);
    return this.enqueue(record, routeReason);
  }

  public noteInvasion(
    event: ChatInvasionEvent,
    routeReason: ChatNotificationRouteReason = 'invasion',
  ): ChatNotificationRecord {
    this.assertNotDestroyed('noteInvasion');

    const record = this.materializeFromInvasion(event);
    return this.enqueue(record, routeReason);
  }

  public noteModeration(
    event: ChatModerationEvent,
    routeReason: ChatNotificationRouteReason = 'moderation',
  ): ChatNotificationRecord {
    this.assertNotDestroyed('noteModeration');

    const record = this.materializeFromModeration(event);
    return this.enqueue(record, routeReason);
  }

  public noteSystem(input: {
    channel?: ChatChannel;
    title: string;
    body: string;
    severity?: ChatNotificationSeverity;
    metadata?: Record<string, unknown>;
  }): ChatNotificationRecord {
    this.assertNotDestroyed('noteSystem');

    const channel = input.channel ?? this.activeChannel;
    const record: ChatNotificationRecord = {
      id: hashRecordKey([
        'system',
        channel,
        input.title,
        input.body,
        String(now()),
      ]),
      source: 'SYSTEM',
      kind: 'SYSTEM',
      channel,
      title: normalizeText(input.title),
      body: summarizeBody(input.body),
      ts: now(),
      severity: input.severity ?? 'INFO',
      state: 'QUEUED',
      unreadContribution: 1,
      canBrowserNotify: true,
      canBanner: true,
      canSound: Boolean(input.severity && severityRank(input.severity) >= severityRank('WARN')),
      soundCue: input.severity === 'CRITICAL' ? 'THREAT' : 'SOFT_TICK',
      surfaces: [],
      suppressionReason: 'none',
      metadata: input.metadata,
    };

    return this.enqueue(record, 'system');
  }

  // ---------------------------------------------------------------------------
  // Public seen / dismissal lifecycle
  // ---------------------------------------------------------------------------

  public markChannelSeen(
    channel: ChatChannel,
    _reason: 'active_focus' | 'chat_open' | 'window_visible' | 'window_focus' | 'manual' = 'manual',
  ): void {
    this.assertNotDestroyed('markChannelSeen');

    const badge = this.requireBadge(channel);
    badge.unreadCount = 0;
    badge.unseenNotificationCount = 0;
    badge.criticalCount = 0;
    badge.tacticalCount = 0;

    for (const record of this.recent) {
      if (record.channel !== channel) continue;
      if (record.state === 'DELIVERED' || record.state === 'QUEUED') {
        record.state = 'SEEN';
        this.callbacks.onNotificationUpdated?.(record);
      }
      if (record.linkedServerNotificationId) {
        this.socketClient.markNotificationSeen(record.linkedServerNotificationId);
      }
    }

    try {
      this.presenceController.markRead({ channel, ts: now() });
    } catch {
      // presence linkage is best effort
    }

    this.renderDocumentTitle();
    this.emitSnapshot();
  }

  public markNotificationSeen(id: string): void {
    this.assertNotDestroyed('markNotificationSeen');

    const record = this.byId.get(id);
    if (!record) return;
    if (record.state === 'SEEN' || record.state === 'DISMISSED' || record.state === 'ARCHIVED') {
      return;
    }

    record.state = 'SEEN';
    const badge = this.requireBadge(record.channel);
    badge.unseenNotificationCount = Math.max(0, badge.unseenNotificationCount - 1);
    if (record.severity === 'CRITICAL') {
      badge.criticalCount = Math.max(0, badge.criticalCount - 1);
    } else if (record.severity === 'TACTICAL') {
      badge.tacticalCount = Math.max(0, badge.tacticalCount - 1);
    }

    if (record.linkedServerNotificationId) {
      this.socketClient.markNotificationSeen(record.linkedServerNotificationId);
    }

    this.closeBrowserNotification(id);
    this.callbacks.onNotificationUpdated?.(record);
    this.renderDocumentTitle();
    this.emitSnapshot();
  }

  public dismissNotification(id: string): void {
    this.assertNotDestroyed('dismissNotification');

    const record = this.byId.get(id);
    if (!record) return;

    record.state = 'DISMISSED';
    this.closeBrowserNotification(id);
    this.callbacks.onNotificationUpdated?.(record);
    this.renderDocumentTitle();
    this.emitSnapshot();
  }

  public archiveOlderThan(ts: number): void {
    this.assertNotDestroyed('archiveOlderThan');

    for (const record of this.recent) {
      if (record.ts < ts && record.state !== 'ARCHIVED') {
        record.state = 'ARCHIVED';
      }
    }

    this.trimRecentIfNeeded();
    this.renderDocumentTitle();
    this.emitSnapshot();
  }

  public async requestBrowserPermission(): Promise<ChatBrowserPermissionState> {
    this.assertNotDestroyed('requestBrowserPermission');

    const ctor = getBrowserNotificationCtor();
    if (!ctor || !ctor.requestPermission) {
      this.browserPermission = 'UNSUPPORTED';
      this.emitSnapshot();
      return this.browserPermission;
    }

    try {
      const result = await ctor.requestPermission();
      this.browserPermission = coerceBrowserPermission(result);
    } catch (error) {
      this.browserPermission = this.readBrowserPermission();
      this.emitControllerError(
        createError('Failed to request browser notification permission.', error),
      );
    }

    this.emitSnapshot();
    return this.browserPermission;
  }

  // ---------------------------------------------------------------------------
  // Private materialization
  // ---------------------------------------------------------------------------

  private materializeFromMessage(
    message: ChatMessage,
    _routeReason: ChatNotificationRouteReason,
  ): ChatNotificationRecord {
    return {
      id: hashRecordKey([
        'msg',
        message.id,
        message.channel,
        message.senderId,
      ]),
      source: 'MESSAGE',
      kind: deriveMessageNotificationKind(message),
      channel: message.channel,
      title: titleForMessage(message),
      body: summarizeBody(message.body),
      ts: message.ts,
      severity: inferMessageSeverity(message),
      state: 'QUEUED',
      unreadContribution: message.senderId === 'player-local' ? 0 : 1,
      canBrowserNotify: message.senderId !== 'player-local',
      canBanner: true,
      canSound: inferMessageSoundCue(message) !== 'NONE',
      soundCue: inferMessageSoundCue(message),
      surfaces: [],
      suppressionReason: 'none',
      metadata: message.metadata,
      linkedMessageId: message.id,
    };
  }

  private materializeFromServerNotification(
    notification: ChatNotification,
  ): ChatNotificationRecord {
    return {
      id: hashRecordKey([
        'notification',
        notification.id,
        notification.channel,
      ]),
      source: 'NOTIFICATION',
      kind: 'SERVER_NOTIFICATION',
      channel: notification.channel,
      title: normalizeText(notification.title),
      body: summarizeBody(notification.body),
      ts: notification.ts,
      severity: inferSeverityForServerNotification(notification),
      state: 'QUEUED',
      unreadContribution: 1,
      canBrowserNotify: true,
      canBanner: true,
      canSound: inferSoundCueForServerNotification(notification) !== 'NONE',
      soundCue: inferSoundCueForServerNotification(notification),
      surfaces: [],
      suppressionReason: 'none',
      metadata: notification.metadata,
      linkedServerNotificationId: notification.id,
    };
  }

  private materializeFromInvasion(event: ChatInvasionEvent): ChatNotificationRecord {
    return {
      id: hashRecordKey(['invasion', event.id, event.channel]),
      source: 'INVASION',
      kind: 'INVASION',
      channel: event.channel,
      title: normalizeText(event.title),
      body: summarizeBody(event.body),
      ts: event.ts,
      severity: inferSeverityForInvasion(event),
      state: 'QUEUED',
      unreadContribution: 1,
      canBrowserNotify: true,
      canBanner: true,
      canSound: inferSoundCueForInvasion(event) !== 'NONE',
      soundCue: inferSoundCueForInvasion(event),
      surfaces: [],
      suppressionReason: 'none',
      metadata: event.metadata,
    };
  }

  private materializeFromModeration(event: ChatModerationEvent): ChatNotificationRecord {
    return {
      id: hashRecordKey([
        'moderation',
        event.code,
        event.channel ?? 'GLOBAL',
        String(event.ts),
      ]),
      source: 'MODERATION',
      kind: 'MODERATION',
      channel: event.channel ?? 'GLOBAL',
      title: titleForModeration(event),
      body: summarizeBody(bodyForModeration(event)),
      ts: event.ts,
      severity: inferSeverityForModeration(event),
      state: 'QUEUED',
      unreadContribution: 1,
      canBrowserNotify: true,
      canBanner: true,
      canSound: inferSoundCueForModeration(event) !== 'NONE',
      soundCue: inferSoundCueForModeration(event),
      surfaces: [],
      suppressionReason: 'none',
      metadata: event.metadata,
    };
  }

  // ---------------------------------------------------------------------------
  // Private enqueue / routing
  // ---------------------------------------------------------------------------

  private enqueue(
    record: ChatNotificationRecord,
    routeReason: ChatNotificationRouteReason,
  ): ChatNotificationRecord {
    const dedupKey = hashRecordKey([
      record.source,
      record.kind,
      record.channel,
      record.title,
      record.body,
      String(Math.floor(record.ts / 1000)),
    ]);

    if (this.isDuplicate(dedupKey)) {
      record.suppressionReason = routeReason === 'replay_hydration' ? 'replay' : 'duplicate';
      record.surfaces = ['NONE'];
      record.state = 'ARCHIVED';
      this.suppressedCount += 1;
      return record;
    }

    const decision = this.route(record, routeReason);
    record.suppressionReason = decision.suppressionReason;
    record.unreadContribution = decision.unreadContribution;
    record.surfaces = decision.surfaces;
    record.soundCue = decision.soundCue;
    record.canBrowserNotify = decision.allowBrowser;
    record.canBanner = decision.allowBanner;
    record.canSound = decision.allowSound;
    record.severity = decision.severity;
    record.state = record.surfaces.includes('NONE') ? 'ARCHIVED' : 'DELIVERED';

    this.byId.set(record.id, record);
    this.recent.push(record);
    this.trimRecentIfNeeded();

    if (!record.surfaces.includes('NONE')) {
      this.applyBadgeUpdate(record);
      this.callbacks.onNotificationEnqueued?.(record);

      if (record.surfaces.includes('BANNER')) {
        this.callbacks.onBannerRequested?.(record);
      }

      if (record.surfaces.includes('SOUND') && record.soundCue !== 'NONE') {
        this.callbacks.onSoundRequested?.(record, record.soundCue);
      }

      if (record.surfaces.includes('BROWSER')) {
        this.deliverBrowserNotification(record);
      }
    } else {
      this.suppressedCount += 1;
    }

    this.renderDocumentTitle();
    this.emitSnapshot();
    return record;
  }

  private route(
    record: ChatNotificationRecord,
    routeReason: ChatNotificationRouteReason,
  ): ChatNotificationRouteDecision {
    const attentionMode = inferAttentionMode({
      transportState: this.transportState,
      windowVisible: this.windowVisible,
      windowFocused: this.windowFocused,
      chatOpen: this.chatOpen,
    });

    if (this.destroyed) {
      return {
        surfaces: ['NONE'],
        soundCue: 'NONE',
        suppressionReason: 'destroyed',
        unreadContribution: 0,
        severity: record.severity,
        allowBrowser: false,
        allowBanner: false,
        allowSound: false,
      };
    }

    if (this.transportState !== 'CONNECTED' && routeReason !== 'system') {
      return {
        surfaces: ['BADGE', 'TITLE', 'INLINE_FEED'],
        soundCue: 'NONE',
        suppressionReason: 'transport_offline',
        unreadContribution: record.unreadContribution,
        severity: record.severity,
        allowBrowser: false,
        allowBanner: false,
        allowSound: false,
      };
    }

    const sameChannel =
      record.channel === this.activeChannel &&
      this.chatOpen &&
      this.windowVisible &&
      this.windowFocused;

    if (sameChannel && compareSeverity(record.severity, this.config.activeChannelBannerSeverityFloor) < 0) {
      return {
        surfaces: ['INLINE_FEED'],
        soundCue: 'NONE',
        suppressionReason: 'active_channel_visible',
        unreadContribution: 0,
        severity: record.severity,
        allowBrowser: false,
        allowBanner: false,
        allowSound: false,
      };
    }

    if (
      sameChannel &&
      compareSeverity(record.severity, this.config.activeChannelBannerSeverityFloor) >= 0
    ) {
      return {
        surfaces: ['INLINE_FEED', 'BANNER'],
        soundCue: record.canSound ? record.soundCue : 'NONE',
        suppressionReason: 'none',
        unreadContribution: 0,
        severity: record.severity,
        allowBrowser: false,
        allowBanner: true,
        allowSound: this.config.allowSounds && compareSeverity(record.severity, this.config.soundSeverityFloor) >= 0,
      };
    }

    const allowBrowser =
      this.config.allowBrowserNotifications &&
      record.canBrowserNotify &&
      this.browserPermission === 'GRANTED' &&
      compareSeverity(record.severity, this.config.browserSeverityFloor) >= 0 &&
      attentionMode !== 'FULL_FOCUS' &&
      this.browserWindowHistory.length < this.config.browserMaxPerMinute;

    const allowBanner =
      compareSeverity(record.severity, 'TACTICAL') >= 0 ||
      record.kind === 'DEALROOM' ||
      record.kind === 'HELPER' ||
      record.kind === 'INVASION';

    const allowSound =
      this.config.allowSounds &&
      record.canSound &&
      compareSeverity(record.severity, this.config.soundSeverityFloor) >= 0 &&
      attentionMode !== 'FULL_FOCUS';

    const surfaces: ChatNotificationSurface[] = ['INLINE_FEED', 'BADGE'];
    if (this.config.allowTitleBadge) surfaces.push('TITLE');
    if (allowBanner) surfaces.push('BANNER');
    if (allowBrowser) surfaces.push('BROWSER');
    if (allowSound) surfaces.push('SOUND');

    return {
      surfaces,
      soundCue: allowSound ? record.soundCue : 'NONE',
      suppressionReason: this.browserPermission === 'DENIED' && allowBanner
        ? 'browser_denied'
        : this.browserPermission === 'DEFAULT' && allowBanner
          ? 'browser_disabled'
          : 'none',
      unreadContribution:
        record.channel === this.activeChannel && attentionMode === 'VISIBLE_DISTRACTED'
          ? 0
          : record.unreadContribution,
      severity: record.severity,
      allowBrowser,
      allowBanner,
      allowSound,
    };
  }

  // ---------------------------------------------------------------------------
  // Private badge / count ownership
  // ---------------------------------------------------------------------------

  private requireBadge(channel: ChatChannel): InternalChannelBadgeState {
    const badge = this.badges.get(channel);
    if (!badge) {
      throw new Error(`Missing badge state for channel: ${channel}`);
    }
    return badge;
  }

  private applyBadgeUpdate(record: ChatNotificationRecord): void {
    const badge = this.requireBadge(record.channel);
    badge.unreadCount += record.unreadContribution;
    badge.unseenNotificationCount += 1;
    badge.lastEventAt = record.ts;
    badge.titlePreview = record.title;

    if (record.severity === 'CRITICAL') {
      badge.criticalCount += 1;
    } else if (record.severity === 'TACTICAL') {
      badge.tacticalCount += 1;
    }
  }

  private collapseIdleUnreadPreview(): void {
    const timestamp = now();
    for (const badge of this.badges.values()) {
      if (!badge.lastEventAt) continue;
      if (timestamp - badge.lastEventAt < this.config.idleUnreadCollapseMs) continue;
      if (badge.unreadCount === 0) {
        badge.titlePreview = undefined;
      }
    }
  }

  private trimRecentIfNeeded(): void {
    const trimmed = limitArray(this.recent, this.config.recentLimit);
    if (trimmed === this.recent) return;

    const removed = this.recent.splice(0, this.recent.length - trimmed.length);
    for (const record of removed) {
      this.byId.delete(record.id);
      this.closeBrowserNotification(record.id);
    }
  }

  // ---------------------------------------------------------------------------
  // Private browser notification delivery
  // ---------------------------------------------------------------------------

  private readBrowserPermission(): ChatBrowserPermissionState {
    const ctor = getBrowserNotificationCtor();
    if (!ctor) return 'UNSUPPORTED';
    return coerceBrowserPermission(ctor.permission);
  }

  private deliverBrowserNotification(record: ChatNotificationRecord): void {
    if (!this.config.allowBrowserNotifications) return;
    const ctor = getBrowserNotificationCtor();
    if (!ctor) return;
    if (this.browserPermission !== 'GRANTED') return;

    try {
      const handle = new ctor(record.title, {
        body: record.body,
        tag: record.id,
        data: {
          channel: record.channel,
          recordId: record.id,
        },
      });

      const entry: InternalBrowserNotificationEntry = {
        recordId: record.id,
        handle,
        closeTimer: null,
      };

      handle.onclick = () => {
        this.switchChannel(record.channel);
        this.setWindowVisible(true);
        this.setWindowFocus(true);
        this.setChatOpen(true);
        this.markNotificationSeen(record.id);
      };

      entry.closeTimer = setTimeout(() => {
        try {
          handle.close?.();
        } catch {
          // ignore
        }
        this.activeBrowserNotifications.delete(record.id);
      }, this.config.browserAutoCloseMs);

      this.activeBrowserNotifications.set(record.id, entry);
      this.deliveredBrowserCount += 1;
      this.browserWindowHistory.push(now());
      this.callbacks.onBrowserNotificationDelivered?.(record);
    } catch (error) {
      this.emitControllerError(
        createError('Failed to deliver browser notification.', error),
        { recordId: record.id },
      );
    }
  }

  private closeBrowserNotification(recordId: string): void {
    const entry = this.activeBrowserNotifications.get(recordId);
    if (!entry) return;

    if (entry.closeTimer) {
      clearTimeout(entry.closeTimer);
      entry.closeTimer = null;
    }

    try {
      entry.handle.close?.();
    } catch {
      // ignore
    }

    this.activeBrowserNotifications.delete(recordId);
  }

  // ---------------------------------------------------------------------------
  // Private dedup / title ownership
  // ---------------------------------------------------------------------------

  private isDuplicate(key: string): boolean {
    const timestamp = now();
    const previous = this.dedupWindow.get(key);
    this.dedupWindow.set(key, timestamp);

    if (!previous) return false;
    return timestamp - previous <= this.config.dedupWindowMs;
  }

  private sweepDedupWindow(): void {
    const timestamp = now();
    for (const [key, createdAt] of [...this.dedupWindow.entries()]) {
      if (timestamp - createdAt > this.config.dedupWindowMs) {
        this.dedupWindow.delete(key);
      }
    }

    while (this.browserWindowHistory.length > 0) {
      const oldest = this.browserWindowHistory[0];
      if (timestamp - oldest <= 60_000) break;
      this.browserWindowHistory.shift();
    }
  }

  private renderDocumentTitle(): void {
    if (!this.config.allowTitleBadge) return;
    const doc = globalAny().document as { title?: string } | undefined;
    if (!doc) return;

    const snapshot = this.getSnapshot();
    const totalUnread = snapshot.totalUnread;
    const activeBadge = this.requireBadge(this.activeChannel);
    const prefix = totalUnread > 0 ? `(${totalUnread}) ` : '';
    const preview = activeBadge.titlePreview ? ` — ${activeBadge.titlePreview}` : '';
    const title = `${prefix}${this.config.baseTitle}${preview}`;

    try {
      doc.title = title;
      this.callbacks.onTitleChanged?.(title);
    } catch {
      // ignore document title failures
    }
  }

  // ---------------------------------------------------------------------------
  // Private misc
  // ---------------------------------------------------------------------------

  private assertNotDestroyed(operation: string): void {
    if (this.destroyed) {
      throw new Error(`ChatNotificationController.${operation} called after destroy().`);
    }
  }

  private emitSnapshot(): void {
    this.callbacks.onSnapshotChanged?.(this.getSnapshot());
  }

  private emitControllerError(error: Error, context?: Record<string, unknown>): void {
    this.error?.(error.message, context);
    this.callbacks.onError?.(error, context);
  }
}
