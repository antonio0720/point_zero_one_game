// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/ChatSelectors.ts

/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT ENGINE FRONTEND SELECTORS
 * FILE: pzo-web/src/engines/chat/ChatSelectors.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Deterministic read-model layer for the sovereign frontend chat engine.
 *
 * This file converts raw chat state into presentation-ready, runtime-safe,
 * mount-aware, and doctrine-aligned views for:
 * - thin render shells in /pzo-web/src/components/chat
 * - adapter surfaces that read run/engine/mechanics context
 * - overlays like threat meter, helper prompts, transcript drawer, invasion
 *   banners, typing strips, presence strips, and legend moment cards
 * - future mount registry / event bridge / notification controller modules
 *
 * Law
 * ---
 * Components must not stitch together chat meaning from raw state.
 * Selectors own read composition.
 *
 * That means selectors are responsible for:
 * - channel permissions by mount target
 * - unread and notification summarization
 * - message feed shaping and card-view metadata
 * - audience heat / threat / urgency derivation
 * - rescue prompt visibility and calm-vs-alert posture
 * - presence and typing theater shaping
 * - relationship and callback surfaces
 * - legend / replay / proof read models
 * - negotiation and deal-room pressure views
 * - dramaturgy surfaces from scene / silence / reveal queues
 * - legacy compatibility views for current donor UI shells
 *
 * Compile-safe phase-one rule
 * ---------------------------
 * This selector layer depends only on:
 * - ./types
 * - ./ChatState
 *
 * It does not import React, socket code, EventBus, runtime adapters, or
 * store implementations directly.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import {
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_MOUNT_PRESETS,
  CHAT_SHADOW_CHANNELS,
  CHAT_VISIBLE_CHANNELS,
} from './types';

import type {
  ChatAffectSnapshot,
  ChatAudienceHeat,
  ChatChannelId,
  ChatChannelMood,
  ChatComposerState,
  ChatContinuityState,
  ChatDeliveryState,
  ChatEngineState,
  ChatFeatureSnapshot,
  ChatLearningProfile,
  ChatLegendMeta,
  ChatLiveOpsState,
  ChatMessage,
  ChatMountPreset,
  ChatMountTarget,
  ChatNotificationKind,
  ChatNotificationState,
  ChatPresenceSnapshot,
  ChatReadReceipt,
  ChatRelationshipState,
  ChatReplayMeta,
  ChatRescueDecision,
  ChatRevealSchedule,
  ChatSceneBeat,
  ChatScenePlan,
  ChatShadowChannel,
  ChatSilenceDecision,
  ChatTypingSnapshot,
  ChatVisibleChannel,
  GameChatContext,
  Nullable,
  PressureTier,
  Score100,
  TickTier,
  UnixMs,
} from './types';

import {
  countUnread,
  deriveFeatureSnapshotFromState,
  getActiveVisibleMessages,
  getLatestVisibleMessage,
  getMessagesForVisibleChannel,
  isDealRoomChannel,
  isShadowChannelId,
  isVisibleChannelId,
} from './ChatState';

// ============================================================================
// MARK: Public selector view models
// ============================================================================

export interface ChatChannelTabView {
  readonly channelId: ChatVisibleChannel;
  readonly label: string;
  readonly unreadCount: number;
  readonly isActive: boolean;
  readonly isAllowedInMount: boolean;
  readonly supportsComposer: boolean;
  readonly supportsPresence: boolean;
  readonly mood: ChatChannelMood['mood'];
  readonly heat: Score100;
  readonly emphasis: 'NORMAL' | 'HOT' | 'URGENT';
}

export interface ChatFeedMessageView {
  readonly id: string;
  readonly channel: ChatVisibleChannel;
  readonly kind: ChatMessage['kind'];
  readonly senderName: string;
  readonly senderRank?: string;
  readonly body: string;
  readonly emoji?: string;
  readonly ts: number;
  readonly isSelf: boolean;
  readonly isSystem: boolean;
  readonly isNpc: boolean;
  readonly isHelper: boolean;
  readonly isHater: boolean;
  readonly isDealRoom: boolean;
  readonly isLegendMoment: boolean;
  readonly hasProof: boolean;
  readonly proofHash?: string;
  readonly pressureTier?: PressureTier;
  readonly tickTier?: TickTier;
  readonly deliveryState?: ChatDeliveryState;
  readonly isPending: boolean;
  readonly isFailed: boolean;
  readonly canReplay: boolean;
  readonly canOpenLegend: boolean;
  readonly cardTone:
    | 'NEUTRAL'
    | 'SYSTEM'
    | 'THREAT'
    | 'HELP'
    | 'NEGOTIATION'
    | 'PRESTIGE'
    | 'MOURNFUL';
  readonly relationshipHint?: string;
  readonly callbackHint?: string;
  readonly readCount: number;
}

export interface ChatComposerView {
  readonly activeChannel: ChatVisibleChannel;
  readonly draft: string;
  readonly disabled: boolean;
  readonly disabledReason?: string;
  readonly placeholder: string;
  readonly maxLength: number;
  readonly remainingChars: number;
  readonly showCounterWarning: boolean;
  readonly canSend: boolean;
}

export interface ChatPresenceStripView {
  readonly visibleEntries: readonly ChatPresenceEntryView[];
  readonly totalVisibleEntries: number;
  readonly showStrip: boolean;
}

export interface ChatPresenceEntryView {
  readonly actorId: string;
  readonly label: string;
  readonly presence: ChatPresenceSnapshot['presence'];
  readonly channelId: ChatChannelId;
  readonly latencyMs?: number;
  readonly isNpc: boolean;
}

export interface ChatTypingIndicatorView {
  readonly entries: readonly ChatTypingEntryView[];
  readonly showIndicator: boolean;
  readonly summaryText?: string;
}

export interface ChatTypingEntryView {
  readonly actorId: string;
  readonly label: string;
  readonly typingState: ChatTypingSnapshot['typingState'];
  readonly channelId: ChatChannelId;
  readonly isNpc: boolean;
  readonly isHelper: boolean;
  readonly isHater: boolean;
}

export interface ChatThreatMeterView {
  readonly score: Score100;
  readonly band: 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  readonly label: string;
  readonly breakdown: {
    readonly audienceHeat: Score100;
    readonly intimidation: Score100;
    readonly scrutiny: Score100;
    readonly volatility: Score100;
  };
  readonly shouldPulse: boolean;
}

export interface ChatHelperPromptView {
  readonly visible: boolean;
  readonly tone: 'CALM' | 'GUIDE' | 'WARN' | 'DIGNITY';
  readonly title?: string;
  readonly body?: string;
  readonly personaId?: string;
}

export interface ChatInvasionBannerView {
  readonly visible: boolean;
  readonly title?: string;
  readonly subtitle?: string;
  readonly tone: 'HOSTILE' | 'PREDATORY' | 'WORLD_EVENT' | 'PRESTIGE';
}

export interface ChatTranscriptDrawerView {
  readonly visibleMessages: readonly ChatFeedMessageView[];
  readonly proofBearingCount: number;
  readonly legendCount: number;
  readonly replayEligibleCount: number;
  readonly title: string;
}

export interface ChatRoomHeaderView {
  readonly title: string;
  readonly subtitle: string;
  readonly mood: ChatChannelMood['mood'];
  readonly heat: Score100;
  readonly notificationLabel?: string;
}

export interface ChatEmptyStateView {
  readonly title: string;
  readonly body: string;
  readonly showComposerHint: boolean;
}

export interface ChatLegendRibbonView {
  readonly visible: boolean;
  readonly title?: string;
  readonly prestigeScore?: number;
  readonly legendClass?: ChatLegendMeta['legendClass'];
}

export interface ChatReplayIndicatorView {
  readonly visible: boolean;
  readonly replayEligible: boolean;
  readonly label?: string;
}

export interface ChatDealRoomView {
  readonly visible: boolean;
  readonly tone: 'COLD' | 'PROBING' | 'PREDATORY' | 'BINDING';
  readonly headline?: string;
  readonly urgencyPct: number;
  readonly bluffRiskPct: number;
  readonly readPressureActive: boolean;
}

export interface ChatRelationshipBadgeView {
  readonly visible: boolean;
  readonly counterpartId?: string;
  readonly respect: Score100;
  readonly fear: Score100;
  readonly trust: Score100;
  readonly rivalryIntensity: Score100;
  readonly dominantAxis?: 'RESPECT' | 'FEAR' | 'TRUST' | 'RIVALRY';
}

export interface ChatSceneOverlayView {
  readonly visible: boolean;
  readonly sceneId?: string;
  readonly beatCount: number;
  readonly primaryChannel?: ChatVisibleChannel;
  readonly allowComposerDuringScene: boolean;
}

export interface ChatSilenceOverlayView {
  readonly visible: boolean;
  readonly reason?: ChatSilenceDecision['reason'];
  readonly durationMs?: number;
  readonly label?: string;
}

export interface ChatWorldEventBadgeView {
  readonly visible: boolean;
  readonly titles: readonly string[];
  readonly strongestIntensity: Score100;
}

export interface ChatDockView {
  readonly mountTarget: ChatMountTarget;
  readonly preset: ChatMountPreset;
  readonly tabs: readonly ChatChannelTabView[];
  readonly header: ChatRoomHeaderView;
  readonly feed: readonly ChatFeedMessageView[];
  readonly composer: ChatComposerView;
  readonly presence: ChatPresenceStripView;
  readonly typing: ChatTypingIndicatorView;
  readonly threat: ChatThreatMeterView;
  readonly helper: ChatHelperPromptView;
  readonly invasion: ChatInvasionBannerView;
  readonly transcriptDrawer: ChatTranscriptDrawerView;
  readonly scene: ChatSceneOverlayView;
  readonly silence: ChatSilenceOverlayView;
  readonly worldEvents: ChatWorldEventBadgeView;
  readonly emptyState: ChatEmptyStateView;
}

// ============================================================================
// MARK: Primitive value helpers
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function score100(value: number): Score100 {
  return clamp(Math.round(value), 0, 100) as Score100;
}

function coalesceString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value == null) return fallback;
  return String(value);
}

function latest<T>(items: readonly T[]): Nullable<T> {
  return items.length ? items[items.length - 1] : null;
}

// ============================================================================
// MARK: Base state selectors
// ============================================================================

export function selectChatState(state: ChatEngineState): ChatEngineState {
  return state;
}

export function selectActiveMountTarget(state: ChatEngineState): ChatMountTarget {
  return state.activeMountTarget;
}

export function selectMountPreset(state: ChatEngineState): ChatMountPreset {
  return CHAT_MOUNT_PRESETS[state.activeMountTarget];
}

export function selectActiveVisibleChannel(state: ChatEngineState): ChatVisibleChannel {
  return state.activeVisibleChannel;
}

export function selectMessagesByChannel(
  state: ChatEngineState,
): Readonly<Record<ChatVisibleChannel, readonly ChatMessage[]>> {
  return state.messagesByChannel;
}

export function selectActiveVisibleMessages(
  state: ChatEngineState,
): readonly ChatMessage[] {
  return getActiveVisibleMessages(state);
}

export function selectVisibleMessagesForChannel(
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
): readonly ChatMessage[] {
  return getMessagesForVisibleChannel(state, channelId);
}

export function selectLatestVisibleMessage(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): Nullable<ChatMessage> {
  return getLatestVisibleMessage(state, channelId);
}

export function selectConnectionState(state: ChatEngineState) {
  return state.connection;
}

export function selectComposerState(state: ChatEngineState): ChatComposerState {
  return state.composer;
}

export function selectNotificationState(state: ChatEngineState): ChatNotificationState {
  return state.notifications;
}

export function selectLearningProfile(
  state: ChatEngineState,
): Nullable<ChatLearningProfile> {
  return state.learningProfile ?? null;
}

export function selectContinuityState(
  state: ChatEngineState,
): ChatContinuityState {
  return state.continuity;
}

export function selectLiveOpsState(
  state: ChatEngineState,
): ChatLiveOpsState {
  return state.liveOps;
}

export function selectAffectSnapshot(
  state: ChatEngineState,
): ChatAffectSnapshot {
  return state.affect;
}

export function selectRelationshipMap(
  state: ChatEngineState,
): Readonly<Record<string, ChatRelationshipState>> {
  return state.relationshipsByCounterpartId;
}

export function selectPresenceMap(
  state: ChatEngineState,
): Readonly<Record<string, ChatPresenceSnapshot>> {
  return state.presenceByActorId;
}

export function selectTypingMap(
  state: ChatEngineState,
): Readonly<Record<string, ChatTypingSnapshot>> {
  return state.typingByActorId;
}

export function selectActiveScene(
  state: ChatEngineState,
): Nullable<ChatScenePlan> {
  return state.activeScene ?? null;
}

export function selectCurrentSilence(
  state: ChatEngineState,
): Nullable<ChatSilenceDecision> {
  return state.currentSilence ?? null;
}

export function selectPendingReveals(
  state: ChatEngineState,
): readonly ChatRevealSchedule[] {
  return state.pendingReveals;
}

// ============================================================================
// MARK: Channel permission and tab selectors
// ============================================================================

export function selectAllowedVisibleChannels(
  state: ChatEngineState,
): readonly ChatVisibleChannel[] {
  return CHAT_MOUNT_PRESETS[state.activeMountTarget].allowedVisibleChannels;
}

export function selectDisallowedVisibleChannels(
  state: ChatEngineState,
): readonly ChatVisibleChannel[] {
  const allowed = new Set(selectAllowedVisibleChannels(state));
  return CHAT_VISIBLE_CHANNELS.filter((channel) => !allowed.has(channel));
}

export function selectChannelDescriptor(
  channelId: ChatChannelId,
) {
  return CHAT_CHANNEL_DESCRIPTORS[channelId];
}

export function selectAudienceHeatForChannel(
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
): ChatAudienceHeat {
  return state.audienceHeat[channelId];
}

export function selectChannelMoodForChannel(
  state: ChatEngineState,
  channelId: ChatChannelId,
): ChatChannelMood {
  return state.channelMoodByChannel[channelId];
}

export function selectUnreadForChannel(
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
): number {
  return state.notifications.unreadByChannel[channelId] ?? 0;
}

export function selectTabsView(
  state: ChatEngineState,
): readonly ChatChannelTabView[] {
  const allowed = new Set(selectAllowedVisibleChannels(state));

  return CHAT_VISIBLE_CHANNELS.map((channelId) => {
    const unreadCount = selectUnreadForChannel(state, channelId);
    const mood = selectChannelMoodForChannel(state, channelId).mood;
    const heat = selectAudienceHeatForChannel(state, channelId).heat;
    const emphasis =
      unreadCount >= 5 || heat >= 80
        ? 'URGENT'
        : unreadCount > 0 || heat >= 55
          ? 'HOT'
          : 'NORMAL';

    return {
      channelId,
      label: channelLabel(channelId),
      unreadCount,
      isActive: state.activeVisibleChannel === channelId,
      isAllowedInMount: allowed.has(channelId),
      supportsComposer: CHAT_CHANNEL_DESCRIPTORS[channelId].supportsComposer,
      supportsPresence: CHAT_CHANNEL_DESCRIPTORS[channelId].supportsPresence,
      mood,
      heat,
      emphasis,
    };
  });
}

export function selectPrimaryVisibleChannels(
  state: ChatEngineState,
): readonly ChatChannelTabView[] {
  return selectTabsView(state).filter((tab) => tab.isAllowedInMount);
}

// ============================================================================
// MARK: Feed selectors
// ============================================================================

export function selectFeedMessageViews(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): readonly ChatFeedMessageView[] {
  return selectVisibleMessagesForChannel(state, channelId).map((message) =>
    toFeedMessageView(state, message),
  );
}

export function selectLatestFeedMessageView(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): Nullable<ChatFeedMessageView> {
  const latestMessage = selectLatestVisibleMessage(state, channelId);
  return latestMessage ? toFeedMessageView(state, latestMessage) : null;
}

export function selectFeedMessagesWithProof(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): readonly ChatFeedMessageView[] {
  return selectFeedMessageViews(state, channelId).filter((message) => message.hasProof);
}

export function selectLegendFeedMessages(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): readonly ChatFeedMessageView[] {
  return selectFeedMessageViews(state, channelId).filter((message) => message.isLegendMoment);
}

export function selectFailedOutgoingMessages(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): readonly ChatFeedMessageView[] {
  return selectFeedMessageViews(state, channelId).filter((message) => message.isFailed);
}

export function selectPendingOutgoingMessages(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): readonly ChatFeedMessageView[] {
  return selectFeedMessageViews(state, channelId).filter((message) => message.isPending);
}

function toFeedMessageView(
  state: ChatEngineState,
  message: ChatMessage,
): ChatFeedMessageView {
  const isSelf = message.senderId === 'player-local' || message.senderName === 'You';
  const senderRole = message.sender?.senderRole;
  const isSystem =
    message.senderId === 'SYSTEM' ||
    message.senderName === 'SYSTEM' ||
    message.kind === 'SYSTEM' ||
    message.kind === 'MARKET_ALERT' ||
    message.kind === 'ACHIEVEMENT';

  const isHelper =
    message.kind === 'HELPER_PROMPT' ||
    message.kind === 'HELPER_RESCUE' ||
    senderRole === 'HELPER_GUIDE';

  const isHater =
    message.kind === 'BOT_TAUNT' ||
    message.kind === 'BOT_ATTACK' ||
    message.kind === 'HATER_TELEGRAPH' ||
    message.kind === 'HATER_PUNISH' ||
    senderRole === 'HATER_BOT';

  const isNpc = !isSelf && !isSystem;
  const isLegendMoment = message.kind === 'LEGEND_MOMENT' || Boolean(message.legend?.legendClass);
  const hasProof = Boolean(message.proofHash || message.proof?.proofHash);
  const canReplay = Boolean(message.replay?.replayEligible);
  const canOpenLegend = Boolean(isLegendMoment || message.replay?.legendEligible);

  let cardTone: ChatFeedMessageView['cardTone'] = 'NEUTRAL';
  if (isLegendMoment) cardTone = 'PRESTIGE';
  else if (message.kind === 'POST_RUN_RITUAL') cardTone = 'MOURNFUL';
  else if (isHater) cardTone = 'THREAT';
  else if (isHelper) cardTone = 'HELP';
  else if (isSystem) cardTone = 'SYSTEM';
  else if (message.channel === 'DEAL_ROOM') cardTone = 'NEGOTIATION';

  return {
    id: message.id,
    channel: message.channel,
    kind: message.kind,
    senderName: message.senderName,
    senderRank: message.senderRank,
    body: message.body,
    emoji: message.emoji,
    ts: message.ts,
    isSelf,
    isSystem,
    isNpc,
    isHelper,
    isHater,
    isDealRoom: message.channel === 'DEAL_ROOM',
    isLegendMoment,
    hasProof,
    proofHash: message.proofHash ?? message.proof?.proofHash,
    pressureTier: message.pressureTier,
    tickTier: message.tickTier,
    deliveryState: message.deliveryState,
    isPending:
      message.deliveryState === 'LOCAL_ONLY' ||
      message.deliveryState === 'QUEUED' ||
      message.deliveryState === 'SENT',
    isFailed:
      message.deliveryState === 'FAILED' ||
      message.deliveryState === 'DROPPED',
    canReplay,
    canOpenLegend,
    cardTone,
    relationshipHint: message.relationshipIds?.length
      ? `${message.relationshipIds.length} relationship signal${message.relationshipIds.length === 1 ? '' : 's'}`
      : undefined,
    callbackHint: message.quoteIds?.length
      ? `${message.quoteIds.length} callback anchor${message.quoteIds.length === 1 ? '' : 's'}`
      : undefined,
    readCount: message.readReceipts?.length ?? 0,
  };
}

// ============================================================================
// MARK: Composer selectors
// ============================================================================

export function selectComposerView(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): ChatComposerView {
  const preset = selectMountPreset(state);
  const draft = state.composer.draftByChannel[channelId];
  const maxLength = state.composer.maxLength;
  const remainingChars = maxLength - draft.length;
  const allowed = selectAllowedVisibleChannels(state).includes(channelId);
  const descriptor = CHAT_CHANNEL_DESCRIPTORS[channelId];

  const disabled =
    state.composer.disabled ||
    !allowed ||
    !descriptor.supportsComposer;

  const disabledReason =
    state.composer.disabled
      ? state.composer.disabledReason
      : !allowed
        ? 'Channel unavailable in this mode.'
        : !descriptor.supportsComposer
          ? 'Composer disabled for this channel.'
          : undefined;

  return {
    activeChannel: channelId,
    draft,
    disabled,
    disabledReason,
    placeholder: placeholderForChannel(channelId, preset),
    maxLength,
    remainingChars,
    showCounterWarning: remainingChars <= 60,
    canSend: !disabled && draft.trim().length > 0,
  };
}

export function selectActiveDraft(
  state: ChatEngineState,
): string {
  return state.composer.draftByChannel[state.activeVisibleChannel];
}

export function selectDraftLength(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): number {
  return state.composer.draftByChannel[channelId].length;
}

export function selectRemainingChars(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): number {
  return state.composer.maxLength - selectDraftLength(state, channelId);
}

// ============================================================================
// MARK: Notification selectors
// ============================================================================

export function selectUnreadCount(state: ChatEngineState): number {
  return countUnread(state);
}

export function selectHasAnyUnread(state: ChatEngineState): boolean {
  return state.notifications.hasAnyUnread;
}

export function selectNotificationKinds(
  state: ChatEngineState,
): readonly ChatNotificationKind[] {
  return state.notifications.notificationKinds;
}

export function selectPrimaryNotificationKind(
  state: ChatEngineState,
): Nullable<ChatNotificationKind> {
  const orderedPriority: ChatNotificationKind[] = [
    'LEGEND_MOMENT',
    'WORLD_EVENT',
    'HATER_ATTACK',
    'NEGOTIATION_URGENCY',
    'HELPER_RESCUE',
    'MENTION',
    'DIRECT_PRESSURE',
    'UNREAD',
  ];

  for (const kind of orderedPriority) {
    if (state.notifications.notificationKinds.includes(kind)) return kind;
  }

  return null;
}

export function selectNotificationLabel(
  state: ChatEngineState,
): Nullable<string> {
  const primary = selectPrimaryNotificationKind(state);
  if (!primary) return null;

  switch (primary) {
    case 'LEGEND_MOMENT':
      return 'Legend moment';
    case 'WORLD_EVENT':
      return 'World event';
    case 'HATER_ATTACK':
      return 'Hostile activity';
    case 'NEGOTIATION_URGENCY':
      return 'Deal-room urgency';
    case 'HELPER_RESCUE':
      return 'Helper intervention';
    case 'DIRECT_PRESSURE':
      return 'Pressure spike';
    case 'MENTION':
      return 'Mention';
    case 'UNREAD':
    default:
      return `${selectUnreadCount(state)} unread`;
  }
}

// ============================================================================
// MARK: Presence and typing selectors
// ============================================================================

export function selectPresenceEntries(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): readonly ChatPresenceEntryView[] {
  const entries = Object.values(state.presenceByActorId)
    .filter((entry) => entry.channelId === channelId && entry.isVisibleToPlayer)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((entry) => ({
      actorId: entry.actorId,
      label: presenceLabelFromActorId(entry.actorId),
      presence: entry.presence,
      channelId: entry.channelId,
      latencyMs: entry.latencyMs,
      isNpc: entry.actorKind !== 'PLAYER',
    }));

  return entries;
}

export function selectPresenceStripView(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): ChatPresenceStripView {
  const preset = selectMountPreset(state);
  const entries = selectPresenceEntries(state, channelId);
  const limit = preset.density === 'COMPACT' ? 4 : preset.density === 'STANDARD' ? 6 : 8;

  return {
    visibleEntries: entries.slice(0, limit),
    totalVisibleEntries: entries.length,
    showStrip: preset.showPresenceStrip && entries.length > 0,
  };
}

export function selectTypingEntries(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): readonly ChatTypingEntryView[] {
  return Object.values(state.typingByActorId)
    .filter((entry) => entry.channelId === channelId)
    .map((entry) => {
      const label = presenceLabelFromActorId(entry.actorId);
      const actorLower = entry.actorId.toLowerCase();

      return {
        actorId: entry.actorId,
        label,
        typingState: entry.typingState,
        channelId: entry.channelId,
        isNpc: entry.actorKind !== 'PLAYER',
        isHelper: actorLower.includes('helper') || actorLower.includes('mentor'),
        isHater: actorLower.includes('hater') || actorLower.includes('bot'),
      };
    });
}

export function selectTypingIndicatorView(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): ChatTypingIndicatorView {
  const entries = selectTypingEntries(state, channelId).filter(
    (entry) => entry.typingState === 'STARTED' || entry.typingState === 'SIMULATED',
  );

  const summaryText =
    entries.length === 0
      ? undefined
      : entries.length === 1
        ? `${entries[0].label} is typing…`
        : `${entries.length} participants are typing…`;

  return {
    entries,
    showIndicator: entries.length > 0,
    summaryText,
  };
}

// ============================================================================
// MARK: Threat, rescue, invasion, and emotional selectors
// ============================================================================

export function selectThreatScore(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): Score100 {
  const heat = state.audienceHeat[channelId];
  const affect = state.affect.vector;

  const score =
    heat.heat * 0.35 +
    heat.scrutiny * 0.20 +
    heat.volatility * 0.15 +
    affect.intimidation * 0.15 +
    affect.desperation * 0.10 +
    affect.frustration * 0.05;

  return score100(score);
}

export function selectThreatBand(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): ChatThreatMeterView['band'] {
  const score = selectThreatScore(state, channelId);
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 35) return 'ELEVATED';
  return 'LOW';
}

export function selectThreatMeterView(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): ChatThreatMeterView {
  const score = selectThreatScore(state, channelId);
  const band = selectThreatBand(state, channelId);
  const heat = state.audienceHeat[channelId];
  const intimidation = state.affect.vector.intimidation;

  return {
    score,
    band,
    label:
      band === 'CRITICAL'
        ? 'Critical pressure'
        : band === 'HIGH'
          ? 'High threat'
          : band === 'ELEVATED'
            ? 'Elevated risk'
            : 'Stable',
    breakdown: {
      audienceHeat: heat.heat,
      intimidation,
      scrutiny: heat.scrutiny,
      volatility: heat.volatility,
    },
    shouldPulse: band === 'HIGH' || band === 'CRITICAL',
  };
}

export function selectRescueLikelihood(
  state: ChatEngineState,
): Score100 {
  const affect = state.affect.vector;
  const threat = selectThreatScore(state);
  const silenceMs = state.currentSilence?.durationMs ?? 0;

  return score100(
    affect.frustration * 0.30 +
      affect.intimidation * 0.20 +
      affect.desperation * 0.20 +
      threat * 0.20 +
      Math.min(100, silenceMs / 100) * 0.10,
  );
}

export function selectHelperPromptView(
  state: ChatEngineState,
): ChatHelperPromptView {
  const latest = selectLatestVisibleMessage(state);
  const rescueLikelihood = selectRescueLikelihood(state);

  if (latest?.kind === 'HELPER_RESCUE') {
    return {
      visible: true,
      tone: 'CALM',
      title: 'Recovery window',
      body: latest.body,
      personaId: 'SURVIVOR',
    };
  }

  if (latest?.kind === 'HELPER_PROMPT') {
    return {
      visible: true,
      tone: 'GUIDE',
      title: 'Helper read',
      body: latest.body,
      personaId: 'MENTOR',
    };
  }

  if (rescueLikelihood >= 70) {
    return {
      visible: true,
      tone: 'WARN',
      title: 'Intervention ready',
      body: 'The room reads elevated drop-off risk. Helper timing is justified.',
      personaId: 'MENTOR',
    };
  }

  return {
    visible: false,
  };
}

export function selectInvasionBannerView(
  state: ChatEngineState,
): ChatInvasionBannerView {
  const latest = selectLatestVisibleMessage(state);
  const band = selectThreatBand(state);
  const worldEvents = state.liveOps.activeWorldEvents;

  if (worldEvents.length > 0) {
    const strongest = [...worldEvents].sort((a, b) => b.intensity - a.intensity)[0];
    return {
      visible: true,
      title: strongest.title,
      subtitle: strongest.subtitle,
      tone: 'WORLD_EVENT',
    };
  }

  if (latest?.kind === 'BOT_ATTACK' || latest?.kind === 'HATER_TELEGRAPH') {
    return {
      visible: true,
      title: 'Hostile pressure window',
      subtitle: latest.body,
      tone: 'HOSTILE',
    };
  }

  if (band === 'CRITICAL') {
    return {
      visible: true,
      title: 'Threat spike',
      subtitle: 'The room now expects a witnessed consequence.',
      tone: 'PREDATORY',
    };
  }

  if (latest?.kind === 'LEGEND_MOMENT') {
    return {
      visible: true,
      title: latest.legend?.title ?? 'Legend moment',
      subtitle: latest.body,
      tone: 'PRESTIGE',
    };
  }

  return {
    visible: false,
    tone: 'HOSTILE',
  };
}

// ============================================================================
// MARK: Transcript drawer / replay / legend selectors
// ============================================================================

export function selectTranscriptDrawerView(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): ChatTranscriptDrawerView {
  const messages = selectFeedMessageViews(state, channelId);
  const proofBearingCount = messages.filter((message) => message.hasProof).length;
  const legendCount = messages.filter((message) => message.isLegendMoment).length;
  const replayEligibleCount = messages.filter((message) => message.canReplay).length;

  return {
    visibleMessages: messages,
    proofBearingCount,
    legendCount,
    replayEligibleCount,
    title: `${channelLabel(channelId)} transcript`,
  };
}

export function selectLegendRibbonView(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): ChatLegendRibbonView {
  const latestLegend = [...selectVisibleMessagesForChannel(state, channelId)]
    .reverse()
    .find((message) => message.kind === 'LEGEND_MOMENT' || message.legend?.legendClass);

  if (!latestLegend) {
    return { visible: false };
  }

  return {
    visible: true,
    title: latestLegend.legend?.title ?? 'Legend moment',
    prestigeScore: latestLegend.legend?.prestigeScore,
    legendClass: latestLegend.legend?.legendClass,
  };
}

export function selectReplayIndicatorView(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): ChatReplayIndicatorView {
  const latestReplayEligible = [...selectVisibleMessagesForChannel(state, channelId)]
    .reverse()
    .find((message) => message.replay?.replayEligible);

  return {
    visible: Boolean(latestReplayEligible),
    replayEligible: Boolean(latestReplayEligible),
    label: latestReplayEligible ? 'Replay-ready' : undefined,
  };
}

// ============================================================================
// MARK: Deal-room, negotiation, and predatory read selectors
// ============================================================================

export function selectDealRoomView(
  state: ChatEngineState,
): ChatDealRoomView {
  const visible = state.activeVisibleChannel === 'DEAL_ROOM';
  const tone = dealRoomToneFromState(state);
  const urgencyPct = state.offerState
    ? Math.round(state.offerState.inferredOpponentUrgency)
    : 0;
  const bluffRiskPct = state.offerState
    ? Math.round(100 - state.offerState.inferredOpponentConfidence)
    : 0;

  const latestDealMessage = [...state.messagesByChannel.DEAL_ROOM]
    .reverse()
    .find(
      (message) =>
        message.kind === 'NEGOTIATION_OFFER' ||
        message.kind === 'NEGOTIATION_COUNTER',
    );

  return {
    visible,
    tone,
    headline: latestDealMessage?.body,
    urgencyPct,
    bluffRiskPct,
    readPressureActive: Boolean(state.offerState?.readPressureActive),
  };
}

function dealRoomToneFromState(
  state: ChatEngineState,
): ChatDealRoomView['tone'] {
  if (!state.offerState) return 'COLD';
  if (state.offerState.readPressureActive) return 'PREDATORY';
  if (state.offerState.stance === 'CLOSING') return 'BINDING';
  if (state.offerState.stance === 'PUSHING') return 'PREDATORY';
  return 'PROBING';
}

// ============================================================================
// MARK: Relationship / memory selectors
// ============================================================================

export function selectRelationshipStates(
  state: ChatEngineState,
): readonly ChatRelationshipState[] {
  return Object.values(state.relationshipsByCounterpartId);
}

export function selectStrongestRelationship(
  state: ChatEngineState,
): Nullable<ChatRelationshipState> {
  const relationships = selectRelationshipStates(state);
  if (!relationships.length) return null;

  return [...relationships].sort((a, b) => {
    const scoreA =
      a.vector.rivalryIntensity +
      a.vector.trust +
      a.vector.fear +
      a.vector.respect;
    const scoreB =
      b.vector.rivalryIntensity +
      b.vector.trust +
      b.vector.fear +
      b.vector.respect;
    return scoreB - scoreA;
  })[0];
}

export function selectRelationshipBadgeView(
  state: ChatEngineState,
): ChatRelationshipBadgeView {
  const strongest = selectStrongestRelationship(state);
  if (!strongest) {
    return {
      visible: false,
      respect: 0 as Score100,
      fear: 0 as Score100,
      trust: 0 as Score100,
      rivalryIntensity: 0 as Score100,
    };
  }

  const dominantAxis = dominantRelationshipAxis(strongest);

  return {
    visible: true,
    counterpartId: strongest.counterpartId,
    respect: strongest.vector.respect,
    fear: strongest.vector.fear,
    trust: strongest.vector.trust,
    rivalryIntensity: strongest.vector.rivalryIntensity,
    dominantAxis,
  };
}

function dominantRelationshipAxis(
  relationship: ChatRelationshipState,
): ChatRelationshipBadgeView['dominantAxis'] {
  const axes = [
    ['RESPECT', relationship.vector.respect],
    ['FEAR', relationship.vector.fear],
    ['TRUST', relationship.vector.trust],
    ['RIVALRY', relationship.vector.rivalryIntensity],
  ] as const;

  return [...axes].sort((a, b) => b[1] - a[1])[0][0];
}

export function selectCallbackAnchoredMessages(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): readonly ChatFeedMessageView[] {
  return selectFeedMessageViews(state, channelId).filter(
    (message) => Boolean(message.callbackHint),
  );
}

// ============================================================================
// MARK: Scene, silence, and reveal selectors
// ============================================================================

export function selectSceneOverlayView(
  state: ChatEngineState,
): ChatSceneOverlayView {
  const scene = state.activeScene;
  if (!scene) {
    return {
      visible: false,
      beatCount: 0,
      allowComposerDuringScene: true,
    };
  }

  return {
    visible: true,
    sceneId: scene.sceneId,
    beatCount: scene.beats.length,
    primaryChannel: scene.primaryChannel,
    allowComposerDuringScene: scene.allowPlayerComposerDuringScene,
  };
}

export function selectCurrentSceneBeats(
  state: ChatEngineState,
): readonly ChatSceneBeat[] {
  return state.activeScene?.beats ?? [];
}

export function selectSilenceOverlayView(
  state: ChatEngineState,
): ChatSilenceOverlayView {
  const silence = state.currentSilence;
  if (!silence?.enforced) {
    return {
      visible: false,
    };
  }

  return {
    visible: true,
    reason: silence.reason,
    durationMs: silence.durationMs,
    label:
      silence.reason === 'DREAD'
        ? 'The room is holding its breath.'
        : silence.reason === 'NEGOTIATION_PRESSURE'
          ? 'Silence is being weaponized.'
          : silence.reason === 'SCENE_COMPOSITION'
            ? 'The moment is still forming.'
            : 'Silence active.',
  };
}

export function selectPendingRevealCount(
  state: ChatEngineState,
): number {
  return state.pendingReveals.length;
}

export function selectSoonestReveal(
  state: ChatEngineState,
): Nullable<ChatRevealSchedule> {
  return state.pendingReveals.length ? state.pendingReveals[0] : null;
}

// ============================================================================
// MARK: World events and liveops selectors
// ============================================================================

export function selectWorldEventBadgeView(
  state: ChatEngineState,
): ChatWorldEventBadgeView {
  const events = state.liveOps.activeWorldEvents;
  if (events.length === 0) {
    return {
      visible: false,
      titles: [],
      strongestIntensity: 0 as Score100,
    };
  }

  const strongestIntensity = score100(
    Math.max(...events.map((event) => event.intensity)),
  );

  return {
    visible: true,
    titles: events.map((event) => event.title),
    strongestIntensity,
  };
}

export function selectSuppressedHelperChannels(
  state: ChatEngineState,
): readonly ChatChannelId[] {
  return state.liveOps.suppressedHelperChannels;
}

export function selectBoostedCrowdChannels(
  state: ChatEngineState,
): readonly ChatChannelId[] {
  return state.liveOps.boostedCrowdChannels;
}

// ============================================================================
// MARK: Room header, empty state, and dock assembly
// ============================================================================

export function selectRoomHeaderView(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): ChatRoomHeaderView {
  const mood = selectChannelMoodForChannel(state, channelId).mood;
  const heat = selectAudienceHeatForChannel(state, channelId).heat;
  const notificationLabel = selectNotificationLabel(state);

  return {
    title: channelLabel(channelId),
    subtitle: headerSubtitleForChannel(channelId, mood),
    mood,
    heat,
    notificationLabel: notificationLabel ?? undefined,
  };
}

export function selectEmptyStateView(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): ChatEmptyStateView {
  const messages = selectVisibleMessagesForChannel(state, channelId);
  if (messages.length > 0) {
    return {
      title: '',
      body: '',
      showComposerHint: false,
    };
  }

  switch (channelId) {
    case 'GLOBAL':
      return {
        title: 'The room is listening.',
        body: 'Open the line or wait for the world to react.',
        showComposerHint: true,
      };
    case 'SYNDICATE':
      return {
        title: 'The syndicate is quiet.',
        body: 'This channel rewards deliberate communication.',
        showComposerHint: true,
      };
    case 'DEAL_ROOM':
      return {
        title: 'No offer on the table.',
        body: 'Deal-room silence can be strategy, not emptiness.',
        showComposerHint: true,
      };
    case 'LOBBY':
    default:
      return {
        title: 'The lobby is waking up.',
        body: 'Warm the room before the run begins.',
        showComposerHint: true,
      };
  }
}

export function selectDockView(
  state: ChatEngineState,
): ChatDockView {
  const activeChannel = state.activeVisibleChannel;

  return {
    mountTarget: state.activeMountTarget,
    preset: selectMountPreset(state),
    tabs: selectPrimaryVisibleChannels(state),
    header: selectRoomHeaderView(state, activeChannel),
    feed: selectFeedMessageViews(state, activeChannel),
    composer: selectComposerView(state, activeChannel),
    presence: selectPresenceStripView(state, activeChannel),
    typing: selectTypingIndicatorView(state, activeChannel),
    threat: selectThreatMeterView(state, activeChannel),
    helper: selectHelperPromptView(state),
    invasion: selectInvasionBannerView(state),
    transcriptDrawer: selectTranscriptDrawerView(state, activeChannel),
    scene: selectSceneOverlayView(state),
    silence: selectSilenceOverlayView(state),
    worldEvents: selectWorldEventBadgeView(state),
    emptyState: selectEmptyStateView(state, activeChannel),
  };
}

// ============================================================================
// MARK: Feature snapshot selectors
// ============================================================================

export function selectFeatureSnapshot(
  state: ChatEngineState,
  options: {
    readonly now?: UnixMs;
    readonly panelOpen?: boolean;
  } = {},
): ChatFeatureSnapshot {
  const now = options.now ?? (Date.now() as UnixMs);
  const activeChannel = state.activeVisibleChannel;

  return deriveFeatureSnapshotFromState(state, {
    now,
    panelOpen: options.panelOpen ?? false,
    currentMountTarget: state.activeMountTarget,
    activeChannel,
    composerLength: state.composer.draftByChannel[activeChannel].length,
    silenceWindowMs: state.currentSilence?.durationMs ?? 0,
    pressureTier: selectLatestPressureTier(state),
    tickTier: selectLatestTickTier(state),
    haterHeat: selectThreatScore(state, activeChannel),
    dropOffSignals: {
      silenceAfterCollapseMs: state.currentSilence?.durationMs ?? 0,
      repeatedComposerDeletes: 0,
      panelCollapseCount: 0,
      channelHopCount: 0,
      failedInputCount: 0,
      negativeEmotionScore: highestNegativeAffect(state.affect),
    },
  });
}

export function selectLatestPressureTier(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): PressureTier | undefined {
  return [...selectVisibleMessagesForChannel(state, channelId)]
    .reverse()
    .find((message) => message.pressureTier != null)?.pressureTier;
}

export function selectLatestTickTier(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): TickTier | undefined {
  return [...selectVisibleMessagesForChannel(state, channelId)]
    .reverse()
    .find((message) => message.tickTier != null)?.tickTier;
}

// ============================================================================
// MARK: Legacy compatibility selectors for current donor lane
// ============================================================================

export interface LegacyChatPanelView {
  readonly messages: readonly ChatMessage[];
  readonly activeChannel: ChatVisibleChannel;
  readonly unread: Readonly<Record<ChatVisibleChannel, number>>;
  readonly draft: string;
  readonly chatOpen: boolean;
  readonly threatScore: Score100;
  readonly haterHeatProxy: number;
  readonly pressureTier?: PressureTier;
  readonly tickTier?: TickTier;
}

export function selectLegacyChatPanelView(
  state: ChatEngineState,
  options: {
    readonly chatOpen?: boolean;
  } = {},
): LegacyChatPanelView {
  const activeChannel = state.activeVisibleChannel;
  const messages = selectVisibleMessagesForChannel(state, activeChannel);

  return {
    messages,
    activeChannel,
    unread: { ...state.notifications.unreadByChannel },
    draft: state.composer.draftByChannel[activeChannel],
    chatOpen: options.chatOpen ?? false,
    threatScore: selectThreatScore(state, activeChannel),
    haterHeatProxy: selectThreatScore(state, activeChannel),
    pressureTier: selectLatestPressureTier(state, activeChannel),
    tickTier: selectLatestTickTier(state, activeChannel),
  };
}

export function selectLegacyGameChatContext(
  state: ChatEngineState,
  fallback: GameChatContext,
): GameChatContext {
  return {
    ...fallback,
    pressureTier: selectLatestPressureTier(state) ?? fallback.pressureTier,
    tickTier: selectLatestTickTier(state) ?? fallback.tickTier,
    haterHeat: selectThreatScore(state),
  };
}

// ============================================================================
// MARK: Analytics-oriented selectors
// ============================================================================

export function selectMessageCountsByKind(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): Readonly<Record<ChatMessage['kind'], number>> {
  const messages = selectVisibleMessagesForChannel(state, channelId);
  const counts = {} as Record<ChatMessage['kind'], number>;

  for (const message of messages) {
    counts[message.kind] = (counts[message.kind] ?? 0) + 1;
  }

  return counts;
}

export function selectNpcMessageRatio(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): number {
  const feed = selectFeedMessageViews(state, channelId);
  if (feed.length === 0) return 0;
  return feed.filter((message) => message.isNpc).length / feed.length;
}

export function selectHelperMessageRatio(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): number {
  const feed = selectFeedMessageViews(state, channelId);
  if (feed.length === 0) return 0;
  return feed.filter((message) => message.isHelper).length / feed.length;
}

export function selectHaterMessageRatio(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): number {
  const feed = selectFeedMessageViews(state, channelId);
  if (feed.length === 0) return 0;
  return feed.filter((message) => message.isHater).length / feed.length;
}

export function selectProofDensity(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): number {
  const feed = selectFeedMessageViews(state, channelId);
  if (feed.length === 0) return 0;
  return feed.filter((message) => message.hasProof).length / feed.length;
}

// ============================================================================
// MARK: Emotional scoring selectors
// ============================================================================

export function selectDominantEmotion(
  state: ChatEngineState,
): ChatAffectSnapshot['dominantEmotion'] {
  return state.affect.dominantEmotion;
}

export function selectEmotionalBalance(
  state: ChatEngineState,
): {
  readonly confidence: Score100;
  readonly intimidation: Score100;
  readonly frustration: Score100;
  readonly relief: Score100;
} {
  return {
    confidence: state.affect.vector.confidence,
    intimidation: state.affect.vector.intimidation,
    frustration: state.affect.vector.frustration,
    relief: state.affect.vector.relief,
  };
}

export function selectEmbarrassmentRisk(
  state: ChatEngineState,
): Score100 {
  return score100(
    state.affect.vector.embarrassment * 0.6 +
      state.audienceHeat[state.activeVisibleChannel].scrutiny * 0.4,
  );
}

export function selectConfidenceRecoveryPotential(
  state: ChatEngineState,
): Score100 {
  return score100(
    state.affect.vector.relief * 0.35 +
      state.affect.vector.trust * 0.25 +
      (100 - state.affect.vector.desperation) * 0.20 +
      (100 - state.affect.vector.intimidation) * 0.20,
  );
}

// ============================================================================
// MARK: Scene dramaturgy and post-run ritual selectors
// ============================================================================

export function selectIsInWitnessedCollapse(
  state: ChatEngineState,
): boolean {
  const latest = selectLatestVisibleMessage(state);
  return (
    latest?.kind === 'SHIELD_EVENT' &&
    latest.body.toLowerCase().includes('breached')
  );
}

export function selectIsInLegendMoment(
  state: ChatEngineState,
): boolean {
  const latest = selectLatestVisibleMessage(state);
  return Boolean(latest?.kind === 'LEGEND_MOMENT' || latest?.legend?.legendClass);
}

export function selectPostRunRitualMessages(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): readonly ChatFeedMessageView[] {
  return selectFeedMessageViews(state, channelId).filter(
    (message) => message.kind === 'POST_RUN_RITUAL',
  );
}

// ============================================================================
// MARK: Misc convenience selectors
// ============================================================================

export function selectHasDraft(
  state: ChatEngineState,
  channelId: ChatVisibleChannel = state.activeVisibleChannel,
): boolean {
  return state.composer.draftByChannel[channelId].trim().length > 0;
}

export function selectHasPendingScene(
  state: ChatEngineState,
): boolean {
  return Boolean(state.activeScene);
}

export function selectHasPendingReveals(
  state: ChatEngineState,
): boolean {
  return state.pendingReveals.length > 0;
}

export function selectHasWorldEvents(
  state: ChatEngineState,
): boolean {
  return state.liveOps.activeWorldEvents.length > 0;
}

export function selectHasRelationshipMemory(
  state: ChatEngineState,
): boolean {
  return Object.keys(state.relationshipsByCounterpartId).length > 0;
}

export function selectIsDealRoomActive(
  state: ChatEngineState,
): boolean {
  return isDealRoomChannel(state.activeVisibleChannel);
}

export function selectAllowedShadowChannels(
  state: ChatEngineState,
): readonly ChatShadowChannel[] {
  return CHAT_SHADOW_CHANNELS;
}

// ============================================================================
// MARK: Private helper functions
// ============================================================================

function channelLabel(channelId: ChatVisibleChannel): string {
  switch (channelId) {
    case 'GLOBAL':
      return 'Global';
    case 'SYNDICATE':
      return 'Syndicate';
    case 'DEAL_ROOM':
      return 'Deal Room';
    case 'LOBBY':
    default:
      return 'Lobby';
  }
}

function headerSubtitleForChannel(
  channelId: ChatVisibleChannel,
  mood: ChatChannelMood['mood'],
): string {
  if (channelId === 'GLOBAL') {
    return mood === 'HOSTILE'
      ? 'The room is reacting in public.'
      : 'Witnessed social pressure and ambient crowd memory.';
  }

  if (channelId === 'SYNDICATE') {
    return mood === 'SUSPICIOUS'
      ? 'Private coordination under pressure.'
      : 'Intimate tactical alignment and reputation-sensitive trust.';
  }

  if (channelId === 'DEAL_ROOM') {
    return mood === 'PREDATORY'
      ? 'Negotiation theater is active.'
      : 'Psychological negotiation chamber.';
  }

  return 'Pre-run atmosphere and first contact.';
}

function placeholderForChannel(
  channelId: ChatVisibleChannel,
  preset: ChatMountPreset,
): string {
  switch (channelId) {
    case 'GLOBAL':
      return 'Signal the room…';
    case 'SYNDICATE':
      return 'Coordinate the syndicate…';
    case 'DEAL_ROOM':
      return 'Make the other side show urgency first…';
    case 'LOBBY':
    default:
      return preset.composerPlaceholder;
  }
}

function presenceLabelFromActorId(actorId: string): string {
  const lower = actorId.toLowerCase();
  if (lower.includes('mentor')) return 'Mentor';
  if (lower.includes('helper')) return 'Helper';
  if (lower.includes('hater')) return 'Hater';
  if (lower.includes('bot')) return 'Bot';
  if (lower.includes('ambient')) return 'Observer';
  if (lower.includes('player-local') || lower === 'self') return 'You';

  const pieces = actorId.split(':');
  return pieces[pieces.length - 1]
    ?.replace(/[-_]/g, ' ')
    ?.replace(/\b\w/g, (s) => s.toUpperCase()) ?? actorId;
}

function highestNegativeAffect(
  affect: ChatAffectSnapshot,
): Score100 {
  return Math.max(
    affect.vector.frustration,
    affect.vector.intimidation,
    affect.vector.desperation,
    affect.vector.embarrassment,
  ) as Score100;
}

// ============================================================================
// MARK: End
// ============================================================================