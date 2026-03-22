/* eslint-disable max-lines */
/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT LIVEOPS EVENT BANNER POLICY
 * FILE: pzo-web/src/engines/chat/liveops/ChatEventBannerPolicy.ts
 * VERSION: 2026.03.22-chat-event-banner-policy.depth.v1
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Queueing, pacing, acknowledgement, projection, and diagnostics policy for
 * world-event banners that sit above or beside the chat shell.
 *
 * This file does not decide what the world event is. Shared contracts and the
 * SeasonalChatEventDirector own world-event identity and activation. This file
 * decides how event overlays become player-facing banners without creating
 * spam, jitter, priority drift, silent erasure, or mount/channel desync.
 * ============================================================================
 */

import type { ChatBridgeMountTarget } from '../ChatEventBridge';
import type { ChatChannelId } from '../../../../../shared/contracts/chat/ChatChannels';
import type { SeasonalChatEventDirectorSnapshot } from './SeasonalChatEventDirector';
import {
  buildOverlayHeadline,
  buildOverlaySubline,
  buildWorldEventOverlayStack,
  type ChatWorldEventOverlayCard,
  type ChatWorldEventOverlayStack,
} from './WorldEventOverlayPolicy';

export type ChatEventBannerState =
  | 'QUEUED'
  | 'ACTIVE'
  | 'ACKNOWLEDGED'
  | 'DISMISSED'
  | 'EXPIRED'
  | 'SHADOWED'
  | 'PINNED';

export type ChatEventBannerKind = 'PRIMARY' | 'SECONDARY' | 'SHADOW' | 'SYSTEM';
export type ChatEventBannerLifecycle = 'WARMUP' | 'VISIBLE' | 'QUIET_HOLD' | 'FADING' | 'HARD_LOCK' | 'ENDED';
export type ChatEventBannerSource = 'PUBLIC_STACK' | 'SHADOW_STACK' | 'RECOVERY' | 'SYSTEM';
export type ChatEventBannerVisibilityClass = 'VISIBLE' | 'SHADOWED' | 'SUPPRESSED' | 'MOUNT_GATED';
export type ChatEventBannerAckReason = 'USER_ACK' | 'AUTO_ACK' | 'QUIET_WORLD' | 'PREEMPTED' | 'REPLACED' | 'SYSTEM_CLEAR';
export type ChatEventBannerDismissReason = 'USER_DISMISS' | 'TTL_EXPIRED' | 'QUIET_COLLAPSE' | 'DEDUPE_COLLAPSE' | 'PREEMPTED' | 'POLICY_SUPPRESSED' | 'SYSTEM_CLEAR';
export type ChatEventBannerReasonCode =
  | 'HIGH_PRIORITY'
  | 'SHADOW_ONLY'
  | 'WHISPER_ONLY'
  | 'STICKY_WORLD_ALERT'
  | 'HELPER_BLACKOUT'
  | 'QUIET_WORLD'
  | 'CHANNEL_GATED'
  | 'MOUNT_GATED'
  | 'DEDUPED'
  | 'PREEMPTED'
  | 'ACK_REQUIRED'
  | 'PULSE_ALLOWED'
  | 'PULSE_SUPPRESSED'
  | 'HISTORY_COLLAPSED'
  | 'SHADOW_ESCALATION';
export type ChatEventBannerInteractionKind = 'IMPRESSION' | 'ACK' | 'DISMISS' | 'PIN' | 'UNPIN' | 'MOUNT_VIEW' | 'CHANNEL_VIEW';
export type ChatEventBannerPreemptionClass = 'NONE' | 'SOFT_RETAIN' | 'SOFT_REPLACE' | 'HARD_REPLACE' | 'STICKY_RETAIN';
export type ChatEventBannerQuietPosture = 'CALM' | 'UNSTABLE' | 'COLLAPSING' | 'SHADOW_PRESSURE' | 'BLACKOUT';

export interface ChatEventBannerImpressionRecord {
  readonly at: number;
  readonly channel?: ChatChannelId;
  readonly mount?: ChatBridgeMountTarget;
  readonly interaction: ChatEventBannerInteractionKind;
}

export interface ChatEventBannerAuditRecord {
  readonly at: number;
  readonly bannerId: string;
  readonly eventId: string;
  readonly operation: 'INGEST' | 'PREEMPT' | 'ACTIVATE' | 'ACK' | 'DISMISS' | 'EXPIRE' | 'PIN' | 'UNPIN' | 'CLEAR' | 'RESTORE' | 'SHADOW_MERGE' | 'QUEUE_COLLAPSE';
  readonly reason?: ChatEventBannerAckReason | ChatEventBannerDismissReason | ChatEventBannerReasonCode | string;
  readonly fromState?: ChatEventBannerState;
  readonly toState?: ChatEventBannerState;
  readonly notes: readonly string[];
}

export interface ChatEventBannerMountProjection {
  readonly mount: ChatBridgeMountTarget;
  readonly activeBannerId: string | null;
  readonly renderableBannerIds: readonly string[];
  readonly pulseBannerIds: readonly string[];
  readonly stickyBannerIds: readonly string[];
  readonly helperSuppressed: boolean;
  readonly quietWorld: boolean;
  readonly score: number;
}

export interface ChatEventBannerChannelProjection {
  readonly channel: ChatChannelId;
  readonly activeBannerId: string | null;
  readonly queueBannerIds: readonly string[];
  readonly shadowBannerIds: readonly string[];
  readonly helperSuppressed: boolean;
  readonly whisperOnlyPressure: boolean;
  readonly score: number;
}

export interface ChatEventBannerQueueStatistics {
  readonly updatedAt: number;
  readonly activeCount: number;
  readonly queuedCount: number;
  readonly shadowCount: number;
  readonly stickyCount: number;
  readonly helperSuppressedCount: number;
  readonly whisperOnlyCount: number;
  readonly pinnedCount: number;
  readonly expiredCount: number;
  readonly totalPriority: number;
  readonly averagePriority: number;
  readonly quietPosture: ChatEventBannerQuietPosture;
}

export interface ChatEventBannerDiagnostics {
  readonly version: string;
  readonly updatedAt: number;
  readonly stats: ChatEventBannerQueueStatistics;
  readonly channelProjectionMap: Readonly<Record<string, ChatEventBannerChannelProjection>>;
  readonly mountProjectionMap: Readonly<Record<string, ChatEventBannerMountProjection>>;
  readonly recentAudit: readonly ChatEventBannerAuditRecord[];
  readonly recentHistoryIds: readonly string[];
  readonly helperBlackoutActive: boolean;
  readonly quietWorld: boolean;
  readonly activeBannerId: string | null;
}

export interface ChatEventBannerHistoryEntry {
  readonly banner: ChatEventBannerModel;
  readonly terminalState: ChatEventBannerState;
  readonly terminalReason?: ChatEventBannerDismissReason | ChatEventBannerAckReason | string;
  readonly terminalAt: number;
}

export interface ChatEventBannerQueueSnapshot {
  readonly updatedAt: number;
  readonly active: ChatEventBannerModel | null;
  readonly queued: readonly ChatEventBannerModel[];
  readonly shadow: readonly ChatEventBannerModel[];
  readonly history: readonly ChatEventBannerHistoryEntry[];
  readonly helperBlackoutActive: boolean;
  readonly quietWorld: boolean;
  readonly quietPosture: ChatEventBannerQuietPosture;
  readonly bannerHeadline: string;
  readonly bannerSubline: string;
  readonly stats: ChatEventBannerQueueStatistics;
}

export interface ChatEventBannerRestorePayload {
  readonly snapshot: ChatEventBannerQueueSnapshot;
  readonly audit?: readonly ChatEventBannerAuditRecord[];
}

export interface ChatEventBannerImportResult {
  readonly accepted: number;
  readonly rejected: number;
  readonly snapshot: ChatEventBannerQueueSnapshot;
  readonly reasons: readonly string[];
}

export interface ChatEventBannerManifest {
  readonly version: string;
  readonly updatedAt: number;
  readonly optionSignature: string;
  readonly counts: {
    readonly active: number;
    readonly queued: number;
    readonly shadow: number;
    readonly history: number;
  };
  readonly quietPosture: ChatEventBannerQuietPosture;
  readonly helperBlackoutActive: boolean;
  readonly quietWorld: boolean;
}

export interface ChatEventBannerModel {
  readonly bannerId: string;
  readonly overlayId: string;
  readonly eventId: string;
  readonly kind: ChatEventBannerKind;
  readonly source: ChatEventBannerSource;
  readonly state: ChatEventBannerState;
  readonly lifecycle: ChatEventBannerLifecycle;
  readonly visibilityClass: ChatEventBannerVisibilityClass;
  readonly headline: string;
  readonly body: string;
  readonly detailLines: readonly string[];
  readonly mounts: readonly ChatBridgeMountTarget[];
  readonly visibleChannels: readonly ChatChannelId[];
  readonly shadowChannels: readonly ChatChannelId[];
  readonly priorityScore: number;
  readonly queueScore: number;
  readonly sticky: boolean;
  readonly dismissible: boolean;
  readonly pulse: boolean;
  readonly helperSuppressed: boolean;
  readonly whisperOnly: boolean;
  readonly severity: ChatWorldEventOverlayCard['severity'];
  readonly tone: ChatWorldEventOverlayCard['tone'];
  readonly visibilityMode: ChatWorldEventOverlayCard['visibilityMode'];
  readonly pressureBand: ChatWorldEventOverlayCard['pressureBand'];
  readonly announcementMode: ChatWorldEventOverlayCard['announcementMode'];
  readonly crowdHeatScore: number;
  readonly activatedAt: number;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly softExpiresAt: number;
  readonly quietHoldUntil: number;
  readonly preemptionLockUntil: number;
  readonly ackedAt?: number;
  readonly dismissedAt?: number;
  readonly pinnedAt?: number;
  readonly lastVisibleAt?: number;
  readonly lastInteractionAt?: number;
  readonly seenMounts: readonly ChatBridgeMountTarget[];
  readonly seenChannels: readonly ChatChannelId[];
  readonly impressionCount: number;
  readonly interactionCount: number;
  readonly mountAffinity: Readonly<Record<string, number>>;
  readonly channelAffinity: Readonly<Record<string, number>>;
  readonly reasonCodes: readonly ChatEventBannerReasonCode[];
  readonly notes: readonly string[];
  readonly history: readonly ChatEventBannerImpressionRecord[];
}

export interface ChatEventBannerPolicyOptions {
  readonly activeBannerMs?: number;
  readonly stickyBannerMs?: number;
  readonly shadowBannerMs?: number;
  readonly dedupeWindowMs?: number;
  readonly maxQueued?: number;
  readonly maxShadowQueued?: number;
  readonly maxHistory?: number;
  readonly maxAudit?: number;
  readonly quietCollapseMs?: number;
  readonly hardPreemptionDelta?: number;
  readonly softPreemptionDelta?: number;
  readonly stickyPreemptionDelta?: number;
  readonly quietHoldMs?: number;
  readonly channelVisitBoost?: number;
  readonly mountVisitBoost?: number;
  readonly impressionPenalty?: number;
  readonly helperSuppressedStickyBias?: number;
  readonly whisperShadowBias?: number;
  readonly pulseCriticalThreshold?: number;
  readonly channelSaturationCap?: number;
  readonly mountSaturationCap?: number;
  readonly autoAckQuietBanners?: boolean;
  readonly retainAcknowledgedInHistory?: boolean;
  readonly allowShadowPromotion?: boolean;
  readonly allowQuietShadowProjection?: boolean;
}

const CHAT_EVENT_BANNER_POLICY_VERSION = '2026.03.22-chat-event-banner-policy.depth.v1';
const DEFAULT_OPTIONS: Required<ChatEventBannerPolicyOptions> = Object.freeze({
  activeBannerMs: 8_000,
  stickyBannerMs: 18_000,
  shadowBannerMs: 6_000,
  dedupeWindowMs: 45_000,
  maxQueued: 6,
  maxShadowQueued: 4,
  maxHistory: 64,
  maxAudit: 256,
  quietCollapseMs: 7_500,
  hardPreemptionDelta: 0.28,
  softPreemptionDelta: 0.08,
  stickyPreemptionDelta: 0.34,
  quietHoldMs: 2_000,
  channelVisitBoost: 0.035,
  mountVisitBoost: 0.045,
  impressionPenalty: 0.010,
  helperSuppressedStickyBias: 0.12,
  whisperShadowBias: 0.09,
  pulseCriticalThreshold: 0.75,
  channelSaturationCap: 3,
  mountSaturationCap: 2,
  autoAckQuietBanners: true,
  retainAcknowledgedInHistory: true,
  allowShadowPromotion: true,
  allowQuietShadowProjection: true,
});

const SUPPORTED_CHANNELS = Object.freeze([
  'GLOBAL' as ChatChannelId,
  'SYNDICATE' as ChatChannelId,
  'DEAL_ROOM' as ChatChannelId,
  'DIRECT' as ChatChannelId,
  'SPECTATOR' as ChatChannelId,
  'LOBBY' as ChatChannelId,
] as const);

const SUPPORTED_MOUNTS = Object.freeze([
  'PRIMARY_DOCK' as ChatBridgeMountTarget,
  'MOMENT_FLASH' as ChatBridgeMountTarget,
  'THREAT_RADAR_PANEL' as ChatBridgeMountTarget,
  'RESCUE_WINDOW_BANNER' as ChatBridgeMountTarget,
  'COUNTERPLAY_MODAL' as ChatBridgeMountTarget,
  'PROOF_CARD_V2' as ChatBridgeMountTarget,
] as const);

const BANNER_KIND_LIFETIME_MULTIPLIER: Readonly<Record<ChatEventBannerKind, number>> = Object.freeze({
  PRIMARY: 1.00,
  SECONDARY: 0.85,
  SHADOW: 0.75,
  SYSTEM: 1.10,
});

const BANNER_KIND_PREEMPTION_FLOOR: Readonly<Record<ChatEventBannerKind, number>> = Object.freeze({
  PRIMARY: 0.00,
  SECONDARY: 0.05,
  SHADOW: 0.10,
  SYSTEM: 0.00,
});

const TONE_QUEUE_BIAS: Readonly<Record<ChatWorldEventOverlayCard['tone'], number>> = Object.freeze({
  CEREMONIAL: 0.08,
  ALARM: 0.12,
  PREDATORY: 0.11,
  WHISPER: 0.06,
  DEBATE: 0.05,
  SURGE: 0.07,
  SUPPRESSED: 0.09,
});

const SEVERITY_QUEUE_BIAS: Readonly<Record<ChatWorldEventOverlayCard['severity'], number>> = Object.freeze({
  CRITICAL: 0.18,
  WARNING: 0.10,
  INFO: 0.04,
  SUCCESS: 0.03,
});

const CHANNEL_BASE_WEIGHTS: Readonly<Record<string, number>> = Object.freeze({
  GLOBAL: 1.00,
  SYNDICATE: 0.92,
  DEAL_ROOM: 0.95,
  DIRECT: 0.76,
  SPECTATOR: 0.78,
  LOBBY: 0.72,
});

const MOUNT_BASE_WEIGHTS: Readonly<Record<string, number>> = Object.freeze({
  PRIMARY_DOCK: 1.00,
  MOMENT_FLASH: 0.96,
  THREAT_RADAR_PANEL: 0.88,
  RESCUE_WINDOW_BANNER: 0.86,
  COUNTERPLAY_MODAL: 0.84,
  PROOF_CARD_V2: 0.82,
});

function nowMs(): number {
  return Date.now();
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function freezeObject<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function freezeArray<T>(value: readonly T[]): readonly T[] {
  return Object.freeze([...value]);
}

function uniqueStrings<T extends string>(value: readonly T[]): readonly T[] {
  return freezeArray([...new Set(value)]);
}

function stableNumber(value: number | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toRecord(entries: readonly (readonly [string, number])[]): Readonly<Record<string, number>> {
  return freezeObject(Object.fromEntries(entries));
}

function compactNotes(notes: readonly string[]): readonly string[] {
  return freezeArray(notes.map((note) => note.trim()).filter(Boolean).slice(0, 12));
}

function createImpressionRecord(
  at: number,
  interaction: ChatEventBannerInteractionKind,
  channel?: ChatChannelId,
  mount?: ChatBridgeMountTarget,
): ChatEventBannerImpressionRecord {
  return freezeObject({
    at,
    interaction,
    ...(channel ? { channel } : {}),
    ...(mount ? { mount } : {}),
  });
}

function createAuditRecord(
  record: Omit<ChatEventBannerAuditRecord, 'notes'> & { readonly notes?: readonly string[] },
): ChatEventBannerAuditRecord {
  return freezeObject({
    at: record.at,
    bannerId: record.bannerId,
    eventId: record.eventId,
    operation: record.operation,
    ...(record.reason ? { reason: record.reason } : {}),
    ...(record.fromState ? { fromState: record.fromState } : {}),
    ...(record.toState ? { toState: record.toState } : {}),
    notes: freezeArray(record.notes ?? []),
  });
}

function eventKey(overlayId: string, createdAt: number): string {
  return `banner:${overlayId}:${createdAt}`;
}

function sortBanners(left: ChatEventBannerModel, right: ChatEventBannerModel): number {
  return (right.queueScore - left.queueScore)
    || (right.priorityScore - left.priorityScore)
    || (Number(right.sticky) - Number(left.sticky))
    || (right.createdAt - left.createdAt)
    || left.bannerId.localeCompare(right.bannerId);
}

function sortAudit(left: ChatEventBannerAuditRecord, right: ChatEventBannerAuditRecord): number {
  return (right.at - left.at) || left.bannerId.localeCompare(right.bannerId);
}

function sortHistory(left: ChatEventBannerHistoryEntry, right: ChatEventBannerHistoryEntry): number {
  return (right.terminalAt - left.terminalAt) || left.banner.bannerId.localeCompare(right.banner.bannerId);
}

function withinDedupeWindow(
  left: Pick<ChatEventBannerModel, 'eventId' | 'overlayId' | 'createdAt'>,
  right: Pick<ChatEventBannerModel, 'eventId' | 'overlayId' | 'createdAt'>,
  dedupeWindowMs: number,
): boolean {
  if (left.eventId === right.eventId) {
    return Math.abs(left.createdAt - right.createdAt) <= dedupeWindowMs;
  }
  if (left.overlayId === right.overlayId) {
    return Math.abs(left.createdAt - right.createdAt) <= Math.floor(dedupeWindowMs * 0.75);
  }
  return false;
}

function deriveBannerKind(card: ChatWorldEventOverlayCard): ChatEventBannerKind {
  if (card.whisperOnly || card.visibilityMode === 'SHADOW_ONLY') {
    return 'SHADOW';
  }
  if (card.sticky || card.severity === 'CRITICAL') {
    return 'PRIMARY';
  }
  return 'SECONDARY';
}

function deriveBannerSource(card: ChatWorldEventOverlayCard): ChatEventBannerSource {
  if (card.visibilityMode === 'SHADOW_ONLY' || card.whisperOnly) {
    return 'SHADOW_STACK';
  }
  return 'PUBLIC_STACK';
}

function deriveVisibilityClass(card: ChatWorldEventOverlayCard): ChatEventBannerVisibilityClass {
  if (card.visibilityMode === 'SHADOW_ONLY' || card.whisperOnly) {
    return 'SHADOWED';
  }
  if (card.helperSuppressed && card.sticky) {
    return 'MOUNT_GATED';
  }
  return 'VISIBLE';
}

function deriveLifecycle(card: ChatWorldEventOverlayCard): ChatEventBannerLifecycle {
  if (card.visibilityMode === 'SHADOW_ONLY') {
    return 'QUIET_HOLD';
  }
  if (card.sticky || card.severity === 'CRITICAL') {
    return 'HARD_LOCK';
  }
  return 'VISIBLE';
}

function computeLifetime(
  card: ChatWorldEventOverlayCard,
  kind: ChatEventBannerKind,
  options: Required<ChatEventBannerPolicyOptions>,
): number {
  const base = card.sticky
    ? options.stickyBannerMs
    : card.whisperOnly
      ? options.shadowBannerMs
      : options.activeBannerMs;
  const multiplier = BANNER_KIND_LIFETIME_MULTIPLIER[kind];
  const severityBias = card.severity === 'CRITICAL'
    ? 1.20
    : card.severity === 'WARNING'
      ? 1.08
      : 1.00;
  const toneBias = card.tone === 'SUPPRESSED'
    ? 1.10
    : card.tone === 'WHISPER'
      ? 0.92
      : 1.00;
  return Math.max(1_500, Math.round(base * multiplier * severityBias * toneBias));
}

function buildMountAffinity(card: ChatWorldEventOverlayCard): Readonly<Record<string, number>> {
  const entries: Array<readonly [string, number]> = [];
  for (const mount of SUPPORTED_MOUNTS) {
    const base = MOUNT_BASE_WEIGHTS[mount] ?? 0.50;
    const score = card.mounts.includes(mount)
      ? clamp01(base + (card.priorityScore * 0.35))
      : clamp01(base * 0.15 * (card.whisperOnly ? 1.4 : 1.0));
    entries.push([mount, score]);
  }
  return toRecord(entries);
}

function buildChannelAffinity(card: ChatWorldEventOverlayCard): Readonly<Record<string, number>> {
  const entries: Array<readonly [string, number]> = [];
  for (const channel of SUPPORTED_CHANNELS) {
    const base = CHANNEL_BASE_WEIGHTS[channel] ?? 0.50;
    const visible = card.visibleChannels.includes(channel);
    const shadow = card.shadowChannels.includes(channel);
    const score = visible
      ? clamp01(base + (card.priorityScore * 0.30))
      : shadow
        ? clamp01((base * 0.35) + (card.priorityScore * 0.15))
        : clamp01(base * 0.08);
    entries.push([channel, score]);
  }
  return toRecord(entries);
}

function buildReasonCodes(card: ChatWorldEventOverlayCard): readonly ChatEventBannerReasonCode[] {
  const reasons: ChatEventBannerReasonCode[] = [];
  if (card.priorityScore >= 0.75) {
    reasons.push('HIGH_PRIORITY');
  }
  if (card.visibilityMode === 'SHADOW_ONLY') {
    reasons.push('SHADOW_ONLY');
  }
  if (card.whisperOnly) {
    reasons.push('WHISPER_ONLY');
  }
  if (card.sticky) {
    reasons.push('ACK_REQUIRED', 'STICKY_WORLD_ALERT');
  }
  if (card.helperSuppressed) {
    reasons.push('HELPER_BLACKOUT');
  }
  if (card.shouldPulse) {
    reasons.push('PULSE_ALLOWED');
  } else {
    reasons.push('PULSE_SUPPRESSED');
  }
  return freezeArray(reasons);
}

function computeQueueScore(
  card: ChatWorldEventOverlayCard,
  kind: ChatEventBannerKind,
  options: Required<ChatEventBannerPolicyOptions>,
): number {
  const stickyBias = card.sticky ? 0.16 : 0;
  const helperBias = card.helperSuppressed ? options.helperSuppressedStickyBias : 0;
  const shadowBias = (card.whisperOnly || card.visibilityMode === 'SHADOW_ONLY')
    ? options.whisperShadowBias
    : 0;
  const toneBias = TONE_QUEUE_BIAS[card.tone] ?? 0;
  const severityBias = SEVERITY_QUEUE_BIAS[card.severity] ?? 0;
  const kindFloor = BANNER_KIND_PREEMPTION_FLOOR[kind] ?? 0;
  return clamp01(card.priorityScore + stickyBias + helperBias + shadowBias + toneBias + severityBias + kindFloor);
}

function computePreemptionClass(
  currentActive: ChatEventBannerModel | null,
  candidate: ChatEventBannerModel,
  options: Required<ChatEventBannerPolicyOptions>,
  timestamp: number,
): ChatEventBannerPreemptionClass {
  if (!currentActive) {
    return 'HARD_REPLACE';
  }
  if (currentActive.state === 'PINNED') {
    return 'STICKY_RETAIN';
  }
  if (currentActive.sticky && currentActive.preemptionLockUntil > timestamp) {
    return 'STICKY_RETAIN';
  }
  const delta = candidate.queueScore - currentActive.queueScore;
  if (delta >= options.hardPreemptionDelta) {
    return 'HARD_REPLACE';
  }
  if (delta >= options.softPreemptionDelta) {
    return 'SOFT_REPLACE';
  }
  if (delta <= 0) {
    return 'SOFT_RETAIN';
  }
  return currentActive.sticky ? 'STICKY_RETAIN' : 'SOFT_RETAIN';
}

function deriveQuietPosture(
  quietWorld: boolean,
  helperBlackoutActive: boolean,
  queued: readonly ChatEventBannerModel[],
  shadow: readonly ChatEventBannerModel[],
): ChatEventBannerQuietPosture {
  if (helperBlackoutActive) {
    return 'BLACKOUT';
  }
  if (!quietWorld && queued.length > 0) {
    return 'UNSTABLE';
  }
  if (quietWorld && shadow.length > 0) {
    return 'SHADOW_PRESSURE';
  }
  if (quietWorld && queued.length === 0) {
    return 'CALM';
  }
  return 'COLLAPSING';
}

function cloneImpressionHistory(records: readonly ChatEventBannerImpressionRecord[]): readonly ChatEventBannerImpressionRecord[] {
  return freezeArray(records.map((record) => freezeObject({ ...record })));
}

function cloneBanner(banner: ChatEventBannerModel): ChatEventBannerModel {
  return freezeObject({
    ...banner,
    detailLines: freezeArray(banner.detailLines),
    mounts: freezeArray(banner.mounts),
    visibleChannels: freezeArray(banner.visibleChannels),
    shadowChannels: freezeArray(banner.shadowChannels),
    seenMounts: freezeArray(banner.seenMounts),
    seenChannels: freezeArray(banner.seenChannels),
    mountAffinity: freezeObject({ ...banner.mountAffinity }),
    channelAffinity: freezeObject({ ...banner.channelAffinity }),
    reasonCodes: freezeArray(banner.reasonCodes),
    notes: freezeArray(banner.notes),
    history: cloneImpressionHistory(banner.history),
  });
}

function cloneHistoryEntry(entry: ChatEventBannerHistoryEntry): ChatEventBannerHistoryEntry {
  return freezeObject({
    ...entry,
    banner: cloneBanner(entry.banner),
  });
}

function buildBannerModel(
  card: ChatWorldEventOverlayCard,
  createdAt: number,
  options: Required<ChatEventBannerPolicyOptions>,
): ChatEventBannerModel {
  const kind = deriveBannerKind(card);
  const source = deriveBannerSource(card);
  const visibilityClass = deriveVisibilityClass(card);
  const lifetime = computeLifetime(card, kind, options);
  const queueScore = computeQueueScore(card, kind, options);
  const state: ChatEventBannerState = kind === 'SHADOW' ? 'SHADOWED' : 'QUEUED';
  const lifecycle = deriveLifecycle(card);
  const softExpiresAt = createdAt + Math.round(lifetime * 0.72);
  const quietHoldUntil = createdAt + options.quietHoldMs;
  const preemptionLockUntil = createdAt + Math.round(lifetime * (card.sticky ? 0.55 : 0.20));
  return freezeObject({
    bannerId: eventKey(card.overlayId, createdAt),
    overlayId: card.overlayId,
    eventId: card.eventId,
    kind,
    source,
    state,
    lifecycle,
    visibilityClass,
    headline: card.headline,
    body: card.body,
    detailLines: freezeArray(card.detailLines),
    mounts: freezeArray(card.mounts),
    visibleChannels: freezeArray(card.visibleChannels),
    shadowChannels: freezeArray(card.shadowChannels),
    priorityScore: clamp01(card.priorityScore),
    queueScore,
    sticky: card.sticky,
    dismissible: card.dismissible,
    pulse: card.shouldPulse && queueScore >= options.pulseCriticalThreshold,
    helperSuppressed: card.helperSuppressed,
    whisperOnly: card.whisperOnly,
    severity: card.severity,
    tone: card.tone,
    visibilityMode: card.visibilityMode,
    pressureBand: card.pressureBand,
    announcementMode: card.announcementMode,
    crowdHeatScore: clamp01(card.crowdHeatScore),
    activatedAt: card.activatedAt,
    createdAt,
    expiresAt: createdAt + lifetime,
    softExpiresAt,
    quietHoldUntil,
    preemptionLockUntil,
    seenMounts: freezeArray([]),
    seenChannels: freezeArray([]),
    impressionCount: 0,
    interactionCount: 0,
    mountAffinity: buildMountAffinity(card),
    channelAffinity: buildChannelAffinity(card),
    reasonCodes: buildReasonCodes(card),
    notes: compactNotes([
      card.sticky ? 'sticky-world-event' : 'transient-world-event',
      card.whisperOnly ? 'whisper-paced' : 'public-paced',
      card.helperSuppressed ? 'helper-blackout' : 'helpers-allowed',
      `tone:${card.tone.toLowerCase()}`,
      `severity:${card.severity.toLowerCase()}`,
      `announcement:${card.announcementMode.toLowerCase()}`,
    ]),
    history: freezeArray([]),
  });
}

function replaceBanner(
  banner: ChatEventBannerModel,
  patch: Partial<ChatEventBannerModel>,
): ChatEventBannerModel {
  return cloneBanner({
    ...banner,
    ...patch,
  });
}

function appendInteraction(
  banner: ChatEventBannerModel,
  interaction: ChatEventBannerInteractionKind,
  at: number,
  channel?: ChatChannelId,
  mount?: ChatBridgeMountTarget,
): ChatEventBannerModel {
  const history = [
    ...banner.history,
    createImpressionRecord(at, interaction, channel, mount),
  ].slice(-48);
  const seenMounts = mount ? uniqueStrings([...banner.seenMounts, mount]) : banner.seenMounts;
  const seenChannels = channel ? uniqueStrings([...banner.seenChannels, channel]) : banner.seenChannels;
  const isVisibleInteraction = interaction === 'IMPRESSION' || interaction === 'MOUNT_VIEW' || interaction === 'CHANNEL_VIEW';
  const lastVisible = isVisibleInteraction ? at : undefined;
  return replaceBanner(banner, {
    history,
    seenMounts,
    seenChannels,
    ...(lastVisible !== undefined ? { lastVisibleAt: lastVisible } : {}),
    lastInteractionAt: at,
    impressionCount: banner.impressionCount + (isVisibleInteraction ? 1 : 0),
    interactionCount: banner.interactionCount + 1,
  });
}

function computeStatistics(
  active: ChatEventBannerModel | null,
  queued: readonly ChatEventBannerModel[],
  shadow: readonly ChatEventBannerModel[],
  history: readonly ChatEventBannerHistoryEntry[],
  helperBlackoutActive: boolean,
  quietWorld: boolean,
  updatedAt: number,
): ChatEventBannerQueueStatistics {
  const all = [active, ...queued, ...shadow].filter(Boolean) as ChatEventBannerModel[];
  const stickyCount = all.filter((banner) => banner.sticky).length;
  const helperSuppressedCount = all.filter((banner) => banner.helperSuppressed).length;
  const whisperOnlyCount = all.filter((banner) => banner.whisperOnly).length;
  const pinnedCount = all.filter((banner) => banner.state === 'PINNED').length;
  const expiredCount = history.filter((entry) => entry.terminalState === 'EXPIRED').length;
  const totalPriority = all.reduce((sum, banner) => sum + banner.priorityScore, 0);
  return freezeObject({
    updatedAt,
    activeCount: active ? 1 : 0,
    queuedCount: queued.length,
    shadowCount: shadow.length,
    stickyCount,
    helperSuppressedCount,
    whisperOnlyCount,
    pinnedCount,
    expiredCount,
    totalPriority,
    averagePriority: all.length > 0 ? totalPriority / all.length : 0,
    quietPosture: deriveQuietPosture(quietWorld, helperBlackoutActive, queued, shadow),
  });
}

function channelProjection(
  channel: ChatChannelId,
  active: ChatEventBannerModel | null,
  queued: readonly ChatEventBannerModel[],
  shadow: readonly ChatEventBannerModel[],
  helperBlackoutActive: boolean,
  quietWorld: boolean,
): ChatEventBannerChannelProjection {
  const queueBannerIds = queued
    .filter((banner) => banner.visibleChannels.includes(channel))
    .sort(sortBanners)
    .map((banner) => banner.bannerId);
  const shadowBannerIds = shadow
    .filter((banner) => banner.shadowChannels.includes(channel) || banner.visibleChannels.includes(channel))
    .sort(sortBanners)
    .map((banner) => banner.bannerId);
  const activeVisible = active && (active.visibleChannels.includes(channel) || active.shadowChannels.includes(channel))
    ? active.bannerId
    : null;
  const score = Math.max(
    active?.channelAffinity[channel] ?? 0,
    ...queued.map((banner) => banner.channelAffinity[channel] ?? 0),
    ...shadow.map((banner) => banner.channelAffinity[channel] ?? 0),
    0,
  );
  return freezeObject({
    channel,
    activeBannerId: activeVisible,
    queueBannerIds: freezeArray(queueBannerIds),
    shadowBannerIds: freezeArray(shadowBannerIds),
    helperSuppressed: helperBlackoutActive,
    whisperOnlyPressure: shadow.some((banner) => banner.whisperOnly && banner.shadowChannels.includes(channel)),
    score,
  });
}

function mountProjection(
  mount: ChatBridgeMountTarget,
  active: ChatEventBannerModel | null,
  queued: readonly ChatEventBannerModel[],
  shadow: readonly ChatEventBannerModel[],
  helperBlackoutActive: boolean,
  quietWorld: boolean,
): ChatEventBannerMountProjection {
  const renderable = [active, ...queued, ...shadow]
    .filter(Boolean)
    .filter((banner): banner is ChatEventBannerModel => banner !== null)
    .filter((banner) => banner.mounts.includes(mount))
    .sort(sortBanners);
  const score = Math.max(...renderable.map((banner) => banner.mountAffinity[mount] ?? 0), 0);
  return freezeObject({
    mount,
    activeBannerId: active && active.mounts.includes(mount) ? active.bannerId : null,
    renderableBannerIds: freezeArray(renderable.map((banner) => banner.bannerId)),
    pulseBannerIds: freezeArray(renderable.filter((banner) => banner.pulse).map((banner) => banner.bannerId)),
    stickyBannerIds: freezeArray(renderable.filter((banner) => banner.sticky).map((banner) => banner.bannerId)),
    helperSuppressed: helperBlackoutActive,
    quietWorld,
    score,
  });
}

function buildDiagnostics(
  snapshot: ChatEventBannerQueueSnapshot,
  audit: readonly ChatEventBannerAuditRecord[],
): ChatEventBannerDiagnostics {
  const channelProjectionMap = Object.fromEntries(
    SUPPORTED_CHANNELS.map((channel) => [
      channel,
      channelProjection(
        channel,
        snapshot.active,
        snapshot.queued,
        snapshot.shadow,
        snapshot.helperBlackoutActive,
        snapshot.quietWorld,
      ),
    ]),
  );
  const mountProjectionMap = Object.fromEntries(
    SUPPORTED_MOUNTS.map((mount) => [
      mount,
      mountProjection(
        mount,
        snapshot.active,
        snapshot.queued,
        snapshot.shadow,
        snapshot.helperBlackoutActive,
        snapshot.quietWorld,
      ),
    ]),
  );
  return freezeObject({
    version: CHAT_EVENT_BANNER_POLICY_VERSION,
    updatedAt: snapshot.updatedAt,
    stats: snapshot.stats,
    channelProjectionMap: freezeObject(channelProjectionMap),
    mountProjectionMap: freezeObject(mountProjectionMap),
    recentAudit: freezeArray([...audit].sort(sortAudit).slice(0, 32)),
    recentHistoryIds: freezeArray(snapshot.history.slice(0, 16).map((entry) => entry.banner.bannerId)),
    helperBlackoutActive: snapshot.helperBlackoutActive,
    quietWorld: snapshot.quietWorld,
    activeBannerId: snapshot.active?.bannerId ?? null,
  });
}

function createEmptySnapshot(updatedAt: number): ChatEventBannerQueueSnapshot {
  const stats = computeStatistics(null, [], [], [], false, true, updatedAt);
  return freezeObject({
    updatedAt,
    active: null,
    queued: freezeArray([]),
    shadow: freezeArray([]),
    history: freezeArray([]),
    helperBlackoutActive: false,
    quietWorld: true,
    quietPosture: stats.quietPosture,
    bannerHeadline: 'World pressure stable',
    bannerSubline: 'No active liveops surge.',
    stats,
  });
}

export class ChatEventBannerPolicy {
  private readonly options: Required<ChatEventBannerPolicyOptions>;
  private snapshot: ChatEventBannerQueueSnapshot;
  private audit: ChatEventBannerAuditRecord[];

  public constructor(options: ChatEventBannerPolicyOptions = {}) {
    this.options = freezeObject({
      ...DEFAULT_OPTIONS,
      ...options,
    });
    this.snapshot = createEmptySnapshot(nowMs());
    this.audit = [];
  }

  public ingest(snapshot: SeasonalChatEventDirectorSnapshot): ChatEventBannerQueueSnapshot {
    const stack = buildWorldEventOverlayStack(snapshot);
    return this.ingestStack(snapshot, stack);
  }

  public ingestStack(
    directorSnapshot: SeasonalChatEventDirectorSnapshot,
    stack: ChatWorldEventOverlayStack,
  ): ChatEventBannerQueueSnapshot {
    const timestamp = directorSnapshot.now;
    const nextPublic = this.buildIncomingPublicBanners(stack, timestamp);
    const nextShadow = this.buildIncomingShadowBanners(stack, timestamp);
    const previousActive = this.snapshot.active;
    let queued = this.mergeQueued(previousActive, this.snapshot.queued, nextPublic, timestamp);
    let shadow = this.mergeShadow(this.snapshot.shadow, nextShadow, timestamp);

    const preemption = this.resolveActive(previousActive, queued, shadow, timestamp);
    const active = preemption.active;
    queued = [...preemption.queued];
    shadow = [...preemption.shadow];

    if (previousActive && active && previousActive.bannerId !== active.bannerId) {
      this.recordAudit({
        at: timestamp,
        bannerId: previousActive.bannerId,
        eventId: previousActive.eventId,
        operation: 'PREEMPT',
        reason: preemption.preemptionClass,
        fromState: previousActive.state,
        toState: active.state,
        notes: freezeArray([
          `replaced-by:${active.bannerId}`,
          `delta:${(active.queueScore - previousActive.queueScore).toFixed(3)}`,
        ]),
      });
    }

    const helperBlackoutActive = stack.helperBlackoutActive;
    const quietWorld = stack.quietWorld;
    const history = this.snapshot.history;
    const nextStats = computeStatistics(active, queued, shadow, history, helperBlackoutActive, quietWorld, timestamp);

    this.snapshot = freezeObject({
      updatedAt: timestamp,
      active,
      queued: freezeArray(queued),
      shadow: freezeArray(shadow),
      history,
      helperBlackoutActive,
      quietWorld,
      quietPosture: deriveQuietPosture(quietWorld, helperBlackoutActive, queued, shadow),
      bannerHeadline: buildOverlayHeadline(directorSnapshot.summary, stack),
      bannerSubline: buildOverlaySubline(directorSnapshot.summary, stack),
      stats: nextStats,
    });

    if (active) {
      this.recordAudit(createAuditRecord({
        at: timestamp,
        bannerId: active.bannerId,
        eventId: active.eventId,
        operation: 'ACTIVATE',
        ...(previousActive ? { fromState: previousActive.state } : {}),
        toState: active.state,
        notes: freezeArray([
          `queue-score:${active.queueScore.toFixed(3)}`,
          `priority:${active.priorityScore.toFixed(3)}`,
          `quiet-posture:${this.snapshot.quietPosture.toLowerCase()}`,
        ]),
      }));
    }

    if (quietWorld && this.options.autoAckQuietBanners) {
      return this.autoAcknowledgeQuietBanners(timestamp);
    }

    return this.snapshot;
  }

  public acknowledge(bannerId: string, acknowledgedAt: number = nowMs()): ChatEventBannerQueueSnapshot {
    const active = this.snapshot.active;
    if (!active || active.bannerId !== bannerId) {
      return this.snapshot;
    }
    const acknowledged = replaceBanner(active, {
      state: 'ACKNOWLEDGED',
      lifecycle: 'FADING',
      ackedAt: acknowledgedAt,
      expiresAt: Math.min(active.expiresAt, acknowledgedAt + 60),
      softExpiresAt: acknowledgedAt,
    });
    this.recordAudit({
      at: acknowledgedAt,
      bannerId,
      eventId: active.eventId,
      operation: 'ACK',
      reason: 'USER_ACK',
      fromState: active.state,
      toState: acknowledged.state,
      notes: freezeArray(['manual-ack']),
    });
    this.pushHistory(acknowledged, 'ACKNOWLEDGED', 'USER_ACK', acknowledgedAt);
    const nextQueued = [...this.snapshot.queued];
    const nextShadow = [...this.snapshot.shadow];
    const nextActive = this.resolveActive(acknowledged, nextQueued, nextShadow, acknowledgedAt).active;
    return this.commit(
      nextActive,
      nextQueued.filter((banner) => nextActive?.bannerId !== banner.bannerId),
      nextShadow,
      acknowledgedAt,
      this.snapshot.helperBlackoutActive,
      this.snapshot.quietWorld,
      this.snapshot.bannerHeadline,
      this.snapshot.bannerSubline,
    );
  }

  public dismiss(
    bannerId: string,
    dismissedAt: number = nowMs(),
    reason: ChatEventBannerDismissReason = 'USER_DISMISS',
  ): ChatEventBannerQueueSnapshot {
    let active = this.snapshot.active;
    let queued = [...this.snapshot.queued];
    let shadow = [...this.snapshot.shadow];
    const remove = (banner: ChatEventBannerModel): ChatEventBannerModel => replaceBanner(banner, {
      state: 'DISMISSED',
      lifecycle: 'ENDED',
      dismissedAt,
      expiresAt: dismissedAt,
      softExpiresAt: dismissedAt,
    });

    if (active?.bannerId === bannerId) {
      const dismissed = remove(active);
      this.recordAudit({
        at: dismissedAt,
        bannerId,
        eventId: active.eventId,
        operation: 'DISMISS',
        reason,
        fromState: active.state,
        toState: dismissed.state,
        notes: freezeArray(['active-dismiss']),
      });
      this.pushHistory(dismissed, 'DISMISSED', reason, dismissedAt);
      active = null;
    } else {
      const queueIndex = queued.findIndex((banner) => banner.bannerId === bannerId);
      if (queueIndex >= 0) {
        const queuedBanner = queued[queueIndex]!;
        const dismissed = remove(queuedBanner);
        queued.splice(queueIndex, 1);
        this.recordAudit({
          at: dismissedAt,
          bannerId,
          eventId: dismissed.eventId,
          operation: 'DISMISS',
          reason,
          fromState: dismissed.state,
          toState: 'DISMISSED',
          notes: freezeArray(['queued-dismiss']),
        });
        this.pushHistory(dismissed, 'DISMISSED', reason, dismissedAt);
      }
      const shadowIndex = shadow.findIndex((banner) => banner.bannerId === bannerId);
      if (shadowIndex >= 0) {
        const shadowBanner = shadow[shadowIndex]!;
        const dismissed = remove(shadowBanner);
        shadow.splice(shadowIndex, 1);
        this.recordAudit({
          at: dismissedAt,
          bannerId,
          eventId: dismissed.eventId,
          operation: 'DISMISS',
          reason,
          fromState: dismissed.state,
          toState: 'DISMISSED',
          notes: freezeArray(['shadow-dismiss']),
        });
        this.pushHistory(dismissed, 'DISMISSED', reason, dismissedAt);
      }
    }

    const resolved = this.resolveActive(active, queued, shadow, dismissedAt);
    return this.commit(
      resolved.active,
      resolved.queued,
      resolved.shadow,
      dismissedAt,
      this.snapshot.helperBlackoutActive,
      this.snapshot.quietWorld,
      this.snapshot.bannerHeadline,
      this.snapshot.bannerSubline,
    );
  }

  public pin(bannerId: string, pinnedAt: number = nowMs()): ChatEventBannerQueueSnapshot {
    const active = this.snapshot.active;
    if (!active || active.bannerId !== bannerId) {
      return this.snapshot;
    }
    const pinned = replaceBanner(active, {
      state: 'PINNED',
      lifecycle: 'HARD_LOCK',
      pinnedAt,
      preemptionLockUntil: Math.max(active.preemptionLockUntil, pinnedAt + this.options.stickyBannerMs),
    });
    this.recordAudit({
      at: pinnedAt,
      bannerId,
      eventId: active.eventId,
      operation: 'PIN',
      fromState: active.state,
      toState: pinned.state,
      notes: freezeArray(['manual-pin']),
    });
    return this.commit(
      pinned,
      [...this.snapshot.queued],
      [...this.snapshot.shadow],
      pinnedAt,
      this.snapshot.helperBlackoutActive,
      this.snapshot.quietWorld,
      this.snapshot.bannerHeadline,
      this.snapshot.bannerSubline,
    );
  }

  public unpin(bannerId: string, at: number = nowMs()): ChatEventBannerQueueSnapshot {
    const active = this.snapshot.active;
    if (!active || active.bannerId !== bannerId || active.state !== 'PINNED') {
      return this.snapshot;
    }
    const unpinned = replaceBanner(active, {
      state: 'ACTIVE',
      lifecycle: 'VISIBLE',
      preemptionLockUntil: Math.min(active.preemptionLockUntil, at + this.options.quietHoldMs),
    });
    this.recordAudit({
      at,
      bannerId,
      eventId: active.eventId,
      operation: 'UNPIN',
      fromState: active.state,
      toState: unpinned.state,
      notes: freezeArray(['manual-unpin']),
    });
    const resolved = this.resolveActive(unpinned, [...this.snapshot.queued], [...this.snapshot.shadow], at);
    return this.commit(
      resolved.active,
      resolved.queued,
      resolved.shadow,
      at,
      this.snapshot.helperBlackoutActive,
      this.snapshot.quietWorld,
      this.snapshot.bannerHeadline,
      this.snapshot.bannerSubline,
    );
  }

  public expire(at: number = nowMs()): ChatEventBannerQueueSnapshot {
    let active = this.snapshot.active;
    const queued = [...this.snapshot.queued];
    const shadow = [...this.snapshot.shadow];

    if (active && active.expiresAt <= at) {
      const expired = replaceBanner(active, {
        state: 'EXPIRED',
        lifecycle: 'ENDED',
      });
      this.recordAudit({
        at,
        bannerId: expired.bannerId,
        eventId: expired.eventId,
        operation: 'EXPIRE',
        reason: 'TTL_EXPIRED',
        fromState: active.state,
        toState: expired.state,
        notes: freezeArray(['active-expire']),
      });
      this.pushHistory(expired, 'EXPIRED', 'TTL_EXPIRED', at);
      active = null;
    }

    const filterLive = (banner: ChatEventBannerModel, bucket: 'queued' | 'shadow'): boolean => {
      if (banner.expiresAt > at) {
        return true;
      }
      const expired = replaceBanner(banner, {
        state: 'EXPIRED',
        lifecycle: 'ENDED',
      });
      this.recordAudit({
        at,
        bannerId: banner.bannerId,
        eventId: banner.eventId,
        operation: 'EXPIRE',
        reason: 'TTL_EXPIRED',
        fromState: banner.state,
        toState: expired.state,
        notes: freezeArray([`${bucket}-expire`]),
      });
      this.pushHistory(expired, 'EXPIRED', 'TTL_EXPIRED', at);
      return false;
    };

    const nextQueued = queued.filter((banner) => filterLive(banner, 'queued'));
    const nextShadow = shadow.filter((banner) => filterLive(banner, 'shadow'));
    const resolved = this.resolveActive(active, nextQueued, nextShadow, at);
    return this.commit(
      resolved.active,
      resolved.queued,
      resolved.shadow,
      at,
      this.snapshot.helperBlackoutActive,
      this.snapshot.quietWorld,
      this.snapshot.bannerHeadline,
      this.snapshot.bannerSubline,
    );
  }

  public tick(at: number = nowMs()): ChatEventBannerQueueSnapshot {
    const collapsed = this.collapseQuietWorld(at);
    if (collapsed !== this.snapshot) {
      return collapsed;
    }
    return this.expire(at);
  }

  public markMountSeen(
    mount: ChatBridgeMountTarget,
    bannerId?: string,
    at: number = nowMs(),
  ): ChatEventBannerQueueSnapshot {
    return this.markInteraction('MOUNT_VIEW', at, undefined, mount, bannerId);
  }

  public markChannelSeen(
    channel: ChatChannelId,
    bannerId?: string,
    at: number = nowMs(),
  ): ChatEventBannerQueueSnapshot {
    return this.markInteraction('CHANNEL_VIEW', at, channel, undefined, bannerId);
  }

  public markImpression(
    bannerId?: string,
    channel?: ChatChannelId,
    mount?: ChatBridgeMountTarget,
    at: number = nowMs(),
  ): ChatEventBannerQueueSnapshot {
    return this.markInteraction('IMPRESSION', at, channel, mount, bannerId);
  }

  public getSnapshot(): ChatEventBannerQueueSnapshot {
    return this.snapshot;
  }

  public getDiagnostics(): ChatEventBannerDiagnostics {
    return buildDiagnostics(this.snapshot, this.audit);
  }

  public getManifest(): ChatEventBannerManifest {
    return freezeObject({
      version: CHAT_EVENT_BANNER_POLICY_VERSION,
      updatedAt: this.snapshot.updatedAt,
      optionSignature: JSON.stringify(this.options),
      counts: freezeObject({
        active: this.snapshot.active ? 1 : 0,
        queued: this.snapshot.queued.length,
        shadow: this.snapshot.shadow.length,
        history: this.snapshot.history.length,
      }),
      quietPosture: this.snapshot.quietPosture,
      helperBlackoutActive: this.snapshot.helperBlackoutActive,
      quietWorld: this.snapshot.quietWorld,
    });
  }

  public getAudit(): readonly ChatEventBannerAuditRecord[] {
    return freezeArray(this.audit.map((entry) => freezeObject({ ...entry, notes: freezeArray(entry.notes) })));
  }

  public getHistory(): readonly ChatEventBannerHistoryEntry[] {
    return freezeArray(this.snapshot.history.map(cloneHistoryEntry));
  }

  public getBannerById(bannerId: string): ChatEventBannerModel | null {
    const all = [this.snapshot.active, ...this.snapshot.queued, ...this.snapshot.shadow].filter(Boolean) as ChatEventBannerModel[];
    return all.find((banner) => banner.bannerId === bannerId) ?? null;
  }

  public getChannelProjection(channel: ChatChannelId): ChatEventBannerChannelProjection {
    return channelProjection(
      channel,
      this.snapshot.active,
      this.snapshot.queued,
      this.snapshot.shadow,
      this.snapshot.helperBlackoutActive,
      this.snapshot.quietWorld,
    );
  }

  public getMountProjection(mount: ChatBridgeMountTarget): ChatEventBannerMountProjection {
    return mountProjection(
      mount,
      this.snapshot.active,
      this.snapshot.queued,
      this.snapshot.shadow,
      this.snapshot.helperBlackoutActive,
      this.snapshot.quietWorld,
    );
  }

  public resolveBannerForChannel(channel: ChatChannelId): ChatEventBannerModel | null {
    const candidates = [this.snapshot.active, ...this.snapshot.queued, ...this.snapshot.shadow]
      .filter(Boolean)
      .filter((banner): banner is ChatEventBannerModel => banner !== null)
      .filter((banner) => banner.visibleChannels.includes(channel) || banner.shadowChannels.includes(channel))
      .sort(sortBanners);
    return candidates[0] ?? null;
  }

  public resolveBannerForMount(mount: ChatBridgeMountTarget): ChatEventBannerModel | null {
    const candidates = [this.snapshot.active, ...this.snapshot.queued, ...this.snapshot.shadow]
      .filter(Boolean)
      .filter((banner): banner is ChatEventBannerModel => banner !== null)
      .filter((banner) => banner.mounts.includes(mount))
      .sort(sortBanners);
    return candidates[0] ?? null;
  }

  public preview(
    directorSnapshot: SeasonalChatEventDirectorSnapshot,
  ): ChatEventBannerQueueSnapshot {
    const stack = buildWorldEventOverlayStack(directorSnapshot);
    const publicBanners = this.buildIncomingPublicBanners(stack, directorSnapshot.now);
    const shadowBanners = this.buildIncomingShadowBanners(stack, directorSnapshot.now);
    const resolved = this.resolveActive(
      this.snapshot.active,
      this.mergeQueued(this.snapshot.active, this.snapshot.queued, publicBanners, directorSnapshot.now),
      this.mergeShadow(this.snapshot.shadow, shadowBanners, directorSnapshot.now),
      directorSnapshot.now,
    );
    const stats = computeStatistics(
      resolved.active,
      resolved.queued,
      resolved.shadow,
      this.snapshot.history,
      stack.helperBlackoutActive,
      stack.quietWorld,
      directorSnapshot.now,
    );
    return freezeObject({
      updatedAt: directorSnapshot.now,
      active: resolved.active,
      queued: freezeArray(resolved.queued),
      shadow: freezeArray(resolved.shadow),
      history: this.snapshot.history,
      helperBlackoutActive: stack.helperBlackoutActive,
      quietWorld: stack.quietWorld,
      quietPosture: deriveQuietPosture(stack.quietWorld, stack.helperBlackoutActive, resolved.queued, resolved.shadow),
      bannerHeadline: buildOverlayHeadline(directorSnapshot.summary, stack),
      bannerSubline: buildOverlaySubline(directorSnapshot.summary, stack),
      stats,
    });
  }

  public clear(at: number = nowMs()): ChatEventBannerQueueSnapshot {
    for (const banner of [this.snapshot.active, ...this.snapshot.queued, ...this.snapshot.shadow].filter(Boolean) as ChatEventBannerModel[]) {
      this.recordAudit({
        at,
        bannerId: banner.bannerId,
        eventId: banner.eventId,
        operation: 'CLEAR',
        reason: 'SYSTEM_CLEAR',
        fromState: banner.state,
        toState: 'EXPIRED',
        notes: freezeArray(['clear-policy']),
      });
      this.pushHistory(replaceBanner(banner, { state: 'EXPIRED', lifecycle: 'ENDED' }), 'EXPIRED', 'SYSTEM_CLEAR', at);
    }
    this.snapshot = createEmptySnapshot(at);
    return this.snapshot;
  }

  public restore(payload: ChatEventBannerRestorePayload): ChatEventBannerQueueSnapshot {
    this.snapshot = freezeObject({
      ...payload.snapshot,
      active: payload.snapshot.active ? cloneBanner(payload.snapshot.active) : null,
      queued: freezeArray(payload.snapshot.queued.map(cloneBanner)),
      shadow: freezeArray(payload.snapshot.shadow.map(cloneBanner)),
      history: freezeArray(payload.snapshot.history.map(cloneHistoryEntry)),
      stats: freezeObject(payload.snapshot.stats),
    });
    if (payload.audit) {
      this.audit = payload.audit.slice(-this.options.maxAudit).map((entry) => freezeObject({ ...entry, notes: freezeArray(entry.notes) }));
    }
    if (this.snapshot.active) {
      this.recordAudit({
        at: this.snapshot.updatedAt,
        bannerId: this.snapshot.active.bannerId,
        eventId: this.snapshot.active.eventId,
        operation: 'RESTORE',
        toState: this.snapshot.active.state,
        notes: freezeArray(['restore-active']),
      });
    }
    return this.snapshot;
  }

  public exportNdjson(): readonly string[] {
    const lines: string[] = [];
    lines.push(JSON.stringify({
      type: 'manifest',
      value: this.getManifest(),
    }));
    lines.push(JSON.stringify({
      type: 'snapshot',
      value: this.snapshot,
    }));
    for (const entry of this.audit) {
      lines.push(JSON.stringify({ type: 'audit', value: entry }));
    }
    return freezeArray(lines);
  }

  public importNdjson(lines: readonly string[]): ChatEventBannerImportResult {
    let snapshot: ChatEventBannerQueueSnapshot | null = null;
    const audit: ChatEventBannerAuditRecord[] = [];
    let accepted = 0;
    let rejected = 0;
    const reasons: string[] = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as { type?: string; value?: unknown };
        if (parsed.type === 'snapshot' && parsed.value && typeof parsed.value === 'object') {
          snapshot = parsed.value as ChatEventBannerQueueSnapshot;
          accepted += 1;
          continue;
        }
        if (parsed.type === 'audit' && parsed.value && typeof parsed.value === 'object') {
          audit.push(parsed.value as ChatEventBannerAuditRecord);
          accepted += 1;
          continue;
        }
        if (parsed.type === 'manifest') {
          accepted += 1;
          continue;
        }
        rejected += 1;
        reasons.push('unsupported-ndjson-line');
      } catch {
        rejected += 1;
        reasons.push('invalid-json-line');
      }
    }
    if (!snapshot) {
      return freezeObject({
        accepted,
        rejected: rejected + 1,
        snapshot: this.snapshot,
        reasons: freezeArray([...reasons, 'missing-snapshot']),
      });
    }
    this.restore({ snapshot, audit });
    return freezeObject({
      accepted,
      rejected,
      snapshot: this.snapshot,
      reasons: freezeArray(reasons),
    });
  }

  private buildIncomingPublicBanners(
    stack: ChatWorldEventOverlayStack,
    timestamp: number,
  ): readonly ChatEventBannerModel[] {
    return freezeArray(
      [stack.primary, ...stack.secondary]
        .filter(Boolean)
        .map((card) => buildBannerModel(card as ChatWorldEventOverlayCard, timestamp, this.options))
        .filter((banner) => banner.kind !== 'SHADOW'),
    );
  }

  private buildIncomingShadowBanners(
    stack: ChatWorldEventOverlayStack,
    timestamp: number,
  ): readonly ChatEventBannerModel[] {
    return freezeArray(
      stack.shadow
        .map((card) => buildBannerModel(card, timestamp, this.options))
        .filter((banner) => banner.kind === 'SHADOW'),
    );
  }

  private mergeQueued(
    active: ChatEventBannerModel | null,
    existing: readonly ChatEventBannerModel[],
    incoming: readonly ChatEventBannerModel[],
    timestamp: number,
  ): ChatEventBannerModel[] {
    const merged = [...existing];
    for (const banner of incoming) {
      if (active && withinDedupeWindow(active, banner, this.options.dedupeWindowMs)) {
        this.recordAudit({
          at: timestamp,
          bannerId: banner.bannerId,
          eventId: banner.eventId,
          operation: 'QUEUE_COLLAPSE',
          reason: 'DEDUPE_COLLAPSE',
          toState: banner.state,
          notes: freezeArray(['dedupe-vs-active']),
        });
        continue;
      }
      const existingIndex = merged.findIndex((entry) => withinDedupeWindow(entry, banner, this.options.dedupeWindowMs));
      if (existingIndex >= 0) {
        const existingBanner = merged[existingIndex];
        if (!existingBanner) {
          merged.push(banner);
          continue;
        }
        if (banner.queueScore > existingBanner.queueScore) {
          merged.splice(existingIndex, 1, replaceBanner(banner, {
            reasonCodes: uniqueStrings([...banner.reasonCodes, 'DEDUPED']),
            notes: compactNotes([...banner.notes, `dedupe-replaced:${existingBanner.bannerId}`]),
          }));
        }
        this.recordAudit({
          at: timestamp,
          bannerId: banner.bannerId,
          eventId: banner.eventId,
          operation: 'QUEUE_COLLAPSE',
          reason: 'DEDUPE_COLLAPSE',
          notes: freezeArray([`dedupe-vs:${existingBanner.bannerId}`]),
        });
        continue;
      }
      merged.push(banner);
      this.recordAudit({
        at: timestamp,
        bannerId: banner.bannerId,
        eventId: banner.eventId,
        operation: 'INGEST',
        toState: banner.state,
        notes: freezeArray(['queue-ingest']),
      });
    }
    return merged
      .filter((banner) => banner.kind !== 'SHADOW')
      .sort(sortBanners)
      .slice(0, this.options.maxQueued)
      .map(cloneBanner);
  }

  private mergeShadow(
    existing: readonly ChatEventBannerModel[],
    incoming: readonly ChatEventBannerModel[],
    timestamp: number,
  ): ChatEventBannerModel[] {
    const merged = [...existing];
    for (const banner of incoming) {
      const existingIndex = merged.findIndex((entry) => withinDedupeWindow(entry, banner, this.options.dedupeWindowMs));
      if (existingIndex >= 0) {
        const existingBanner = merged[existingIndex];
        if (!existingBanner) {
          merged.push(banner);
          continue;
        }
        const winner = banner.queueScore > existingBanner.queueScore ? banner : existingBanner;
        merged.splice(existingIndex, 1, winner);
      } else {
        merged.push(banner);
      }
      this.recordAudit({
        at: timestamp,
        bannerId: banner.bannerId,
        eventId: banner.eventId,
        operation: 'SHADOW_MERGE',
        toState: banner.state,
        notes: freezeArray(['shadow-ingest']),
      });
    }
    return merged
      .filter((banner) => banner.kind === 'SHADOW')
      .sort(sortBanners)
      .slice(0, this.options.maxShadowQueued)
      .map(cloneBanner);
  }

  private resolveActive(
    currentActive: ChatEventBannerModel | null,
    queued: readonly ChatEventBannerModel[],
    shadow: readonly ChatEventBannerModel[],
    timestamp: number,
  ): {
    readonly active: ChatEventBannerModel | null;
    readonly queued: readonly ChatEventBannerModel[];
    readonly shadow: readonly ChatEventBannerModel[];
    readonly preemptionClass: ChatEventBannerPreemptionClass;
  } {
    const nextQueued = [...queued].sort(sortBanners);
    const nextShadow = [...shadow].sort(sortBanners);
    const candidate = nextQueued[0] ?? (
      this.options.allowShadowPromotion && this.options.allowQuietShadowProjection
        ? nextShadow[0] ?? null
        : null
    );

    if (!candidate && currentActive && currentActive.expiresAt > timestamp && currentActive.state !== 'ACKNOWLEDGED') {
      return freezeObject({
        active: cloneBanner(replaceBanner(currentActive, {
          state: currentActive.state === 'QUEUED' ? 'ACTIVE' : currentActive.state,
        })),
        queued: freezeArray(nextQueued),
        shadow: freezeArray(nextShadow),
        preemptionClass: 'NONE',
      });
    }

    if (!candidate) {
      return freezeObject({
        active: null,
        queued: freezeArray(nextQueued),
        shadow: freezeArray(nextShadow),
        preemptionClass: 'NONE',
      });
    }

    const preemptionClass = computePreemptionClass(currentActive, candidate, this.options, timestamp);
    if (currentActive && currentActive.expiresAt > timestamp) {
      if (preemptionClass === 'SOFT_RETAIN' || preemptionClass === 'STICKY_RETAIN') {
        return freezeObject({
          active: cloneBanner(replaceBanner(currentActive, {
            state: currentActive.state === 'QUEUED' ? 'ACTIVE' : currentActive.state,
          })),
          queued: freezeArray(nextQueued),
          shadow: freezeArray(nextShadow),
          preemptionClass,
        });
      }
    }

    const activateCandidate = replaceBanner(candidate, {
      state: candidate.kind === 'SHADOW' ? 'SHADOWED' : 'ACTIVE',
      lifecycle: candidate.kind === 'SHADOW' ? 'QUIET_HOLD' : (candidate.sticky ? 'HARD_LOCK' : 'VISIBLE'),
    });

    const remainingQueued = nextQueued.filter((banner) => banner.bannerId !== candidate.bannerId);
    const remainingShadow = nextShadow.filter((banner) => banner.bannerId !== candidate.bannerId);

    if (candidate.kind === 'SHADOW' && !this.options.allowQuietShadowProjection) {
      return freezeObject({
        active: currentActive ? cloneBanner(currentActive) : null,
        queued: freezeArray(remainingQueued),
        shadow: freezeArray(nextShadow),
        preemptionClass: 'SOFT_RETAIN',
      });
    }

    return freezeObject({
      active: cloneBanner(activateCandidate),
      queued: freezeArray(remainingQueued),
      shadow: freezeArray(remainingShadow),
      preemptionClass,
    });
  }

  private autoAcknowledgeQuietBanners(at: number): ChatEventBannerQueueSnapshot {
    const active = this.snapshot.active;
    if (!active) {
      return this.snapshot;
    }
    if (active.sticky || active.state === 'PINNED') {
      return this.snapshot;
    }
    const quietAck = replaceBanner(active, {
      state: 'ACKNOWLEDGED',
      lifecycle: 'FADING',
      ackedAt: at,
      expiresAt: at + 60,
      softExpiresAt: at,
    });
    this.recordAudit({
      at,
      bannerId: active.bannerId,
      eventId: active.eventId,
      operation: 'ACK',
      reason: 'QUIET_WORLD',
      fromState: active.state,
      toState: quietAck.state,
      notes: freezeArray(['auto-quiet-ack']),
    });
    this.pushHistory(quietAck, 'ACKNOWLEDGED', 'QUIET_WORLD', at);
    const resolved = this.resolveActive(null, this.snapshot.queued, this.snapshot.shadow, at);
    return this.commit(
      resolved.active,
      resolved.queued,
      resolved.shadow,
      at,
      this.snapshot.helperBlackoutActive,
      this.snapshot.quietWorld,
      this.snapshot.bannerHeadline,
      this.snapshot.bannerSubline,
    );
  }

  private collapseQuietWorld(at: number): ChatEventBannerQueueSnapshot {
    if (!this.snapshot.quietWorld) {
      return this.snapshot;
    }
    const active = this.snapshot.active;
    if (active && active.sticky) {
      return this.snapshot;
    }
    const age = active ? at - active.createdAt : this.options.quietCollapseMs + 1;
    if (age < this.options.quietCollapseMs) {
      return this.snapshot;
    }
    if (active) {
      const collapsed = replaceBanner(active, {
        state: 'EXPIRED',
        lifecycle: 'ENDED',
        expiresAt: at,
      });
      this.recordAudit({
        at,
        bannerId: active.bannerId,
        eventId: active.eventId,
        operation: 'QUEUE_COLLAPSE',
        reason: 'QUIET_COLLAPSE',
        fromState: active.state,
        toState: collapsed.state,
        notes: freezeArray(['quiet-collapse']),
      });
      this.pushHistory(collapsed, 'EXPIRED', 'QUIET_COLLAPSE', at);
    }
    return this.commit(
      null,
      [],
      this.options.allowQuietShadowProjection ? [...this.snapshot.shadow] : [],
      at,
      this.snapshot.helperBlackoutActive,
      true,
      this.snapshot.bannerHeadline,
      this.snapshot.bannerSubline,
    );
  }

  private markInteraction(
    interaction: ChatEventBannerInteractionKind,
    at: number,
    channel?: ChatChannelId,
    mount?: ChatBridgeMountTarget,
    bannerId?: string,
  ): ChatEventBannerQueueSnapshot {
    const targetId = bannerId ?? this.snapshot.active?.bannerId;
    if (!targetId) {
      return this.snapshot;
    }
    let active = this.snapshot.active;
    let queued = [...this.snapshot.queued];
    let shadow = [...this.snapshot.shadow];

    const apply = (banner: ChatEventBannerModel): ChatEventBannerModel => appendInteraction(banner, interaction, at, channel, mount);

    if (active?.bannerId === targetId) {
      active = apply(active);
    }
    queued = queued.map((banner) => banner.bannerId === targetId ? apply(banner) : banner);
    shadow = shadow.map((banner) => banner.bannerId === targetId ? apply(banner) : banner);

    return this.commit(
      active,
      queued,
      shadow,
      at,
      this.snapshot.helperBlackoutActive,
      this.snapshot.quietWorld,
      this.snapshot.bannerHeadline,
      this.snapshot.bannerSubline,
    );
  }

  private commit(
    active: ChatEventBannerModel | null,
    queued: readonly ChatEventBannerModel[],
    shadow: readonly ChatEventBannerModel[],
    updatedAt: number,
    helperBlackoutActive: boolean,
    quietWorld: boolean,
    bannerHeadline: string,
    bannerSubline: string,
  ): ChatEventBannerQueueSnapshot {
    const nextStats = computeStatistics(active, queued, shadow, this.snapshot.history, helperBlackoutActive, quietWorld, updatedAt);
    this.snapshot = freezeObject({
      updatedAt,
      active: active ? cloneBanner(active) : null,
      queued: freezeArray(queued.map(cloneBanner)),
      shadow: freezeArray(shadow.map(cloneBanner)),
      history: this.snapshot.history,
      helperBlackoutActive,
      quietWorld,
      quietPosture: deriveQuietPosture(quietWorld, helperBlackoutActive, queued, shadow),
      bannerHeadline,
      bannerSubline,
      stats: nextStats,
    });
    return this.snapshot;
  }

  private pushHistory(
    banner: ChatEventBannerModel,
    terminalState: ChatEventBannerState,
    terminalReason: ChatEventBannerDismissReason | ChatEventBannerAckReason | string,
    terminalAt: number,
  ): void {
    const nextEntry = freezeObject({
      banner: cloneBanner(banner),
      terminalState,
      terminalReason,
      terminalAt,
    });
    const history = [nextEntry, ...this.snapshot.history]
      .sort(sortHistory)
      .slice(0, this.options.maxHistory)
      .map(cloneHistoryEntry);
    this.snapshot = freezeObject({
      ...this.snapshot,
      history: freezeArray(history),
    });
  }

  private recordAudit(record: ChatEventBannerAuditRecord): void {
    this.audit = [createAuditRecord(record), ...this.audit]
      .sort(sortAudit)
      .slice(0, this.options.maxAudit);
  }
}

export function createChatEventBannerPolicy(
  options: ChatEventBannerPolicyOptions = {},
): ChatEventBannerPolicy {
  return new ChatEventBannerPolicy(options);
}

export function buildBannerQueueSnapshot(
  directorSnapshot: SeasonalChatEventDirectorSnapshot,
  options: ChatEventBannerPolicyOptions = {},
): ChatEventBannerQueueSnapshot {
  const policy = new ChatEventBannerPolicy(options);
  return policy.ingest(directorSnapshot);
}

export function previewBannerQueueSnapshot(
  directorSnapshot: SeasonalChatEventDirectorSnapshot,
  existing: ChatEventBannerQueueSnapshot,
  options: ChatEventBannerPolicyOptions = {},
): ChatEventBannerQueueSnapshot {
  const policy = new ChatEventBannerPolicy(options);
  policy.restore({ snapshot: existing });
  return policy.preview(directorSnapshot);
}

export function buildChatEventBannerDiagnostics(
  snapshot: ChatEventBannerQueueSnapshot,
  audit: readonly ChatEventBannerAuditRecord[] = [],
): ChatEventBannerDiagnostics {
  return buildDiagnostics(snapshot, audit);
}

export function buildChatEventBannerManifest(
  snapshot: ChatEventBannerQueueSnapshot,
  options: ChatEventBannerPolicyOptions = {},
): ChatEventBannerManifest {
  const resolved = freezeObject({ ...DEFAULT_OPTIONS, ...options });
  return freezeObject({
    version: CHAT_EVENT_BANNER_POLICY_VERSION,
    updatedAt: snapshot.updatedAt,
    optionSignature: JSON.stringify(resolved),
    counts: freezeObject({
      active: snapshot.active ? 1 : 0,
      queued: snapshot.queued.length,
      shadow: snapshot.shadow.length,
      history: snapshot.history.length,
    }),
    quietPosture: snapshot.quietPosture,
    helperBlackoutActive: snapshot.helperBlackoutActive,
    quietWorld: snapshot.quietWorld,
  });
}

export function collectChatEventBannerIds(
  snapshot: ChatEventBannerQueueSnapshot,
): readonly string[] {
  return freezeArray(
    [snapshot.active, ...snapshot.queued, ...snapshot.shadow]
      .filter(Boolean)
      .map((banner) => (banner as ChatEventBannerModel).bannerId),
  );
}

export function projectChatEventBannerForChannel(
  snapshot: ChatEventBannerQueueSnapshot,
  channel: ChatChannelId,
): ChatEventBannerChannelProjection {
  return channelProjection(
    channel,
    snapshot.active,
    snapshot.queued,
    snapshot.shadow,
    snapshot.helperBlackoutActive,
    snapshot.quietWorld,
  );
}

export function projectChatEventBannerForMount(
  snapshot: ChatEventBannerQueueSnapshot,
  mount: ChatBridgeMountTarget,
): ChatEventBannerMountProjection {
  return mountProjection(
    mount,
    snapshot.active,
    snapshot.queued,
    snapshot.shadow,
    snapshot.helperBlackoutActive,
    snapshot.quietWorld,
  );
}

export function summarizeChatEventBannerSnapshot(
  snapshot: ChatEventBannerQueueSnapshot,
): readonly string[] {
  const lines: string[] = [];
  lines.push(`headline:${snapshot.bannerHeadline}`);
  lines.push(`subline:${snapshot.bannerSubline}`);
  lines.push(`quiet:${String(snapshot.quietWorld)}`);
  lines.push(`helper-blackout:${String(snapshot.helperBlackoutActive)}`);
  lines.push(`quiet-posture:${snapshot.quietPosture}`);
  lines.push(`active:${snapshot.active?.bannerId ?? 'none'}`);
  lines.push(`queued:${snapshot.queued.length}`);
  lines.push(`shadow:${snapshot.shadow.length}`);
  return freezeArray(lines);
}

export function collapseExpiredBanners(
  snapshot: ChatEventBannerQueueSnapshot,
  at: number = nowMs(),
  options: ChatEventBannerPolicyOptions = {},
): ChatEventBannerQueueSnapshot {
  const policy = new ChatEventBannerPolicy(options);
  policy.restore({ snapshot });
  return policy.expire(at);
}

export function acknowledgeActiveBanner(
  snapshot: ChatEventBannerQueueSnapshot,
  at: number = nowMs(),
  options: ChatEventBannerPolicyOptions = {},
): ChatEventBannerQueueSnapshot {
  if (!snapshot.active) {
    return snapshot;
  }
  const policy = new ChatEventBannerPolicy(options);
  policy.restore({ snapshot });
  return policy.acknowledge(snapshot.active.bannerId, at);
}

export function dismissBannerById(
  snapshot: ChatEventBannerQueueSnapshot,
  bannerId: string,
  at: number = nowMs(),
  reason: ChatEventBannerDismissReason = 'USER_DISMISS',
  options: ChatEventBannerPolicyOptions = {},
): ChatEventBannerQueueSnapshot {
  const policy = new ChatEventBannerPolicy(options);
  policy.restore({ snapshot });
  return policy.dismiss(bannerId, at, reason);
}

export function importChatEventBannerPolicy(
  lines: readonly string[],
  options: ChatEventBannerPolicyOptions = {},
): ChatEventBannerImportResult {
  const policy = new ChatEventBannerPolicy(options);
  return policy.importNdjson(lines);
}

export function exportChatEventBannerPolicy(
  snapshot: ChatEventBannerQueueSnapshot,
  audit: readonly ChatEventBannerAuditRecord[] = [],
  options: ChatEventBannerPolicyOptions = {},
): readonly string[] {
  const policy = new ChatEventBannerPolicy(options);
  policy.restore({ snapshot, audit });
  return policy.exportNdjson();
}

// ============================================================================
// MARK: Analytic helpers
// ============================================================================

export function getGlobalChannelBannerIds(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  return projectChatEventBannerForChannel(snapshot, 'GLOBAL' as ChatChannelId).queueBannerIds;
}

export function getSyndicateChannelBannerIds(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  return projectChatEventBannerForChannel(snapshot, 'SYNDICATE' as ChatChannelId).queueBannerIds;
}

export function getDealRoomChannelBannerIds(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  return projectChatEventBannerForChannel(snapshot, 'DEAL_ROOM' as ChatChannelId).queueBannerIds;
}

export function getDirectChannelBannerIds(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  return projectChatEventBannerForChannel(snapshot, 'DIRECT' as ChatChannelId).queueBannerIds;
}

export function getSpectatorChannelBannerIds(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  return projectChatEventBannerForChannel(snapshot, 'SPECTATOR' as ChatChannelId).queueBannerIds;
}

export function getLobbyChannelBannerIds(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  return projectChatEventBannerForChannel(snapshot, 'LOBBY' as ChatChannelId).queueBannerIds;
}

export function getPrimaryDockMountBannerIds(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  return projectChatEventBannerForMount(snapshot, 'PRIMARY_DOCK' as ChatBridgeMountTarget).renderableBannerIds;
}

export function getMomentFlashMountBannerIds(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  return projectChatEventBannerForMount(snapshot, 'MOMENT_FLASH' as ChatBridgeMountTarget).renderableBannerIds;
}

export function getThreatRadarPanelMountBannerIds(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  return projectChatEventBannerForMount(snapshot, 'THREAT_RADAR_PANEL' as ChatBridgeMountTarget).renderableBannerIds;
}

export function getRescueWindowBannerMountBannerIds(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  return projectChatEventBannerForMount(snapshot, 'RESCUE_WINDOW_BANNER' as ChatBridgeMountTarget).renderableBannerIds;
}

export function getCounterplayModalMountBannerIds(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  return projectChatEventBannerForMount(snapshot, 'COUNTERPLAY_MODAL' as ChatBridgeMountTarget).renderableBannerIds;
}

export function getProofCardV2MountBannerIds(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  return projectChatEventBannerForMount(snapshot, 'PROOF_CARD_V2' as ChatBridgeMountTarget).renderableBannerIds;
}

export function countPrimaryBanners(snapshot: ChatEventBannerQueueSnapshot): number {
  return [snapshot.active, ...snapshot.queued, ...snapshot.shadow]
    .filter(Boolean)
    .filter((banner) => (banner as ChatEventBannerModel).kind === 'PRIMARY')
    .length;
}

export function countSecondaryBanners(snapshot: ChatEventBannerQueueSnapshot): number {
  return [snapshot.active, ...snapshot.queued, ...snapshot.shadow]
    .filter(Boolean)
    .filter((banner) => (banner as ChatEventBannerModel).kind === 'SECONDARY')
    .length;
}

export function countShadowBanners(snapshot: ChatEventBannerQueueSnapshot): number {
  return [snapshot.active, ...snapshot.queued, ...snapshot.shadow]
    .filter(Boolean)
    .filter((banner) => (banner as ChatEventBannerModel).kind === 'SHADOW')
    .length;
}

export function countSystemBanners(snapshot: ChatEventBannerQueueSnapshot): number {
  return [snapshot.active, ...snapshot.queued, ...snapshot.shadow]
    .filter(Boolean)
    .filter((banner) => (banner as ChatEventBannerModel).kind === 'SYSTEM')
    .length;
}

export function isCalmBannerPosture(snapshot: ChatEventBannerQueueSnapshot): boolean {
  return snapshot.quietPosture === 'CALM';
}

export function isUnstableBannerPosture(snapshot: ChatEventBannerQueueSnapshot): boolean {
  return snapshot.quietPosture === 'UNSTABLE';
}

export function isCollapsingBannerPosture(snapshot: ChatEventBannerQueueSnapshot): boolean {
  return snapshot.quietPosture === 'COLLAPSING';
}

export function isShadowPressureBannerPosture(snapshot: ChatEventBannerQueueSnapshot): boolean {
  return snapshot.quietPosture === 'SHADOW_PRESSURE';
}

export function isBlackoutBannerPosture(snapshot: ChatEventBannerQueueSnapshot): boolean {
  return snapshot.quietPosture === 'BLACKOUT';
}

export function countHighPriorityBanners(snapshot: ChatEventBannerQueueSnapshot): number {
  return [snapshot.active, ...snapshot.queued, ...snapshot.shadow]
    .filter(Boolean)
    .filter((banner) => (banner as ChatEventBannerModel).reasonCodes.includes('HIGH_PRIORITY'))
    .length;
}

export function countShadowOnlyBanners(snapshot: ChatEventBannerQueueSnapshot): number {
  return [snapshot.active, ...snapshot.queued, ...snapshot.shadow]
    .filter(Boolean)
    .filter((banner) => (banner as ChatEventBannerModel).reasonCodes.includes('SHADOW_ONLY'))
    .length;
}

export function countWhisperOnlyBanners(snapshot: ChatEventBannerQueueSnapshot): number {
  return [snapshot.active, ...snapshot.queued, ...snapshot.shadow]
    .filter(Boolean)
    .filter((banner) => (banner as ChatEventBannerModel).reasonCodes.includes('WHISPER_ONLY'))
    .length;
}

export function countStickyWorldAlertBanners(snapshot: ChatEventBannerQueueSnapshot): number {
  return [snapshot.active, ...snapshot.queued, ...snapshot.shadow]
    .filter(Boolean)
    .filter((banner) => (banner as ChatEventBannerModel).reasonCodes.includes('STICKY_WORLD_ALERT'))
    .length;
}

export function countHelperBlackoutBanners(snapshot: ChatEventBannerQueueSnapshot): number {
  return [snapshot.active, ...snapshot.queued, ...snapshot.shadow]
    .filter(Boolean)
    .filter((banner) => (banner as ChatEventBannerModel).reasonCodes.includes('HELPER_BLACKOUT'))
    .length;
}

export function countQuietWorldBanners(snapshot: ChatEventBannerQueueSnapshot): number {
  return [snapshot.active, ...snapshot.queued, ...snapshot.shadow]
    .filter(Boolean)
    .filter((banner) => (banner as ChatEventBannerModel).reasonCodes.includes('QUIET_WORLD'))
    .length;
}

export function countChannelGatedBanners(snapshot: ChatEventBannerQueueSnapshot): number {
  return [snapshot.active, ...snapshot.queued, ...snapshot.shadow]
    .filter(Boolean)
    .filter((banner) => (banner as ChatEventBannerModel).reasonCodes.includes('CHANNEL_GATED'))
    .length;
}

export function countMountGatedBanners(snapshot: ChatEventBannerQueueSnapshot): number {
  return [snapshot.active, ...snapshot.queued, ...snapshot.shadow]
    .filter(Boolean)
    .filter((banner) => (banner as ChatEventBannerModel).reasonCodes.includes('MOUNT_GATED'))
    .length;
}

export function countDedupedBanners(snapshot: ChatEventBannerQueueSnapshot): number {
  return [snapshot.active, ...snapshot.queued, ...snapshot.shadow]
    .filter(Boolean)
    .filter((banner) => (banner as ChatEventBannerModel).reasonCodes.includes('DEDUPED'))
    .length;
}

export function countPreemptedBanners(snapshot: ChatEventBannerQueueSnapshot): number {
  return [snapshot.active, ...snapshot.queued, ...snapshot.shadow]
    .filter(Boolean)
    .filter((banner) => (banner as ChatEventBannerModel).reasonCodes.includes('PREEMPTED'))
    .length;
}

export function countAckRequiredBanners(snapshot: ChatEventBannerQueueSnapshot): number {
  return [snapshot.active, ...snapshot.queued, ...snapshot.shadow]
    .filter(Boolean)
    .filter((banner) => (banner as ChatEventBannerModel).reasonCodes.includes('ACK_REQUIRED'))
    .length;
}

export function countPulseAllowedBanners(snapshot: ChatEventBannerQueueSnapshot): number {
  return [snapshot.active, ...snapshot.queued, ...snapshot.shadow]
    .filter(Boolean)
    .filter((banner) => (banner as ChatEventBannerModel).reasonCodes.includes('PULSE_ALLOWED'))
    .length;
}

export function countPulseSuppressedBanners(snapshot: ChatEventBannerQueueSnapshot): number {
  return [snapshot.active, ...snapshot.queued, ...snapshot.shadow]
    .filter(Boolean)
    .filter((banner) => (banner as ChatEventBannerModel).reasonCodes.includes('PULSE_SUPPRESSED'))
    .length;
}

export function countHistoryCollapsedBanners(snapshot: ChatEventBannerQueueSnapshot): number {
  return [snapshot.active, ...snapshot.queued, ...snapshot.shadow]
    .filter(Boolean)
    .filter((banner) => (banner as ChatEventBannerModel).reasonCodes.includes('HISTORY_COLLAPSED'))
    .length;
}

export function countShadowEscalationBanners(snapshot: ChatEventBannerQueueSnapshot): number {
  return [snapshot.active, ...snapshot.queued, ...snapshot.shadow]
    .filter(Boolean)
    .filter((banner) => (banner as ChatEventBannerModel).reasonCodes.includes('SHADOW_ESCALATION'))
    .length;
}

export const CHAT_EVENT_BANNER_CHANNEL_POLICY_MATRIX: Readonly<Record<string, Readonly<Record<string, number>>>> = Object.freeze({
  GLOBAL: Object.freeze({
    PRIMARY_DOCK: 0.71,
    MOMENT_FLASH: 0.67,
    THREAT_RADAR_PANEL: 0.88,
    RESCUE_WINDOW_BANNER: 0.56,
    COUNTERPLAY_MODAL: 0.72,
    PROOF_CARD_V2: 0.81,
  }),
  SYNDICATE: Object.freeze({
    PRIMARY_DOCK: 0.83,
    MOMENT_FLASH: 0.69,
    THREAT_RADAR_PANEL: 0.66,
    RESCUE_WINDOW_BANNER: 0.83,
    COUNTERPLAY_MODAL: 0.66,
    PROOF_CARD_V2: 0.63,
  }),
  DEAL_ROOM: Object.freeze({
    PRIMARY_DOCK: 0.64,
    MOMENT_FLASH: 0.67,
    THREAT_RADAR_PANEL: 0.87,
    RESCUE_WINDOW_BANNER: 0.86,
    COUNTERPLAY_MODAL: 0.89,
    PROOF_CARD_V2: 0.86,
  }),
  DIRECT: Object.freeze({
    PRIMARY_DOCK: 0.73,
    MOMENT_FLASH: 0.74,
    THREAT_RADAR_PANEL: 0.82,
    RESCUE_WINDOW_BANNER: 0.89,
    COUNTERPLAY_MODAL: 0.86,
    PROOF_CARD_V2: 0.64,
  }),
  SPECTATOR: Object.freeze({
    PRIMARY_DOCK: 0.74,
    MOMENT_FLASH: 0.78,
    THREAT_RADAR_PANEL: 0.86,
    RESCUE_WINDOW_BANNER: 0.83,
    COUNTERPLAY_MODAL: 0.70,
    PROOF_CARD_V2: 0.71,
  }),
  LOBBY: Object.freeze({
    PRIMARY_DOCK: 0.70,
    MOMENT_FLASH: 0.59,
    THREAT_RADAR_PANEL: 0.82,
    RESCUE_WINDOW_BANNER: 0.79,
    COUNTERPLAY_MODAL: 0.72,
    PROOF_CARD_V2: 0.84,
  }),
});

export const CHAT_EVENT_BANNER_REASON_POLICY_MATRIX: Readonly<Record<string, Readonly<Record<string, number>>>> = Object.freeze({
  HIGH_PRIORITY: Object.freeze({
    GLOBAL: 0.60,
    SYNDICATE: 0.63,
    DEAL_ROOM: 0.66,
    DIRECT: 0.56,
    SPECTATOR: 0.53,
    LOBBY: 0.75,
  }),
  SHADOW_ONLY: Object.freeze({
    GLOBAL: 0.66,
    SYNDICATE: 0.52,
    DEAL_ROOM: 0.45,
    DIRECT: 0.41,
    SPECTATOR: 0.77,
    LOBBY: 0.77,
  }),
  WHISPER_ONLY: Object.freeze({
    GLOBAL: 0.66,
    SYNDICATE: 0.52,
    DEAL_ROOM: 0.56,
    DIRECT: 0.41,
    SPECTATOR: 0.43,
    LOBBY: 0.64,
  }),
  STICKY_WORLD_ALERT: Object.freeze({
    GLOBAL: 0.79,
    SYNDICATE: 0.51,
    DEAL_ROOM: 0.62,
    DIRECT: 0.62,
    SPECTATOR: 0.77,
    LOBBY: 0.52,
  }),
  HELPER_BLACKOUT: Object.freeze({
    GLOBAL: 0.54,
    SYNDICATE: 0.49,
    DEAL_ROOM: 0.48,
    DIRECT: 0.66,
    SPECTATOR: 0.43,
    LOBBY: 0.59,
  }),
  QUIET_WORLD: Object.freeze({
    GLOBAL: 0.60,
    SYNDICATE: 0.72,
    DEAL_ROOM: 0.52,
    DIRECT: 0.48,
    SPECTATOR: 0.55,
    LOBBY: 0.73,
  }),
  CHANNEL_GATED: Object.freeze({
    GLOBAL: 0.72,
    SYNDICATE: 0.62,
    DEAL_ROOM: 0.73,
    DIRECT: 0.48,
    SPECTATOR: 0.44,
    LOBBY: 0.65,
  }),
  MOUNT_GATED: Object.freeze({
    GLOBAL: 0.62,
    SYNDICATE: 0.52,
    DEAL_ROOM: 0.62,
    DIRECT: 0.55,
    SPECTATOR: 0.61,
    LOBBY: 0.61,
  }),
  DEDUPED: Object.freeze({
    GLOBAL: 0.47,
    SYNDICATE: 0.41,
    DEAL_ROOM: 0.59,
    DIRECT: 0.54,
    SPECTATOR: 0.53,
    LOBBY: 0.60,
  }),
  PREEMPTED: Object.freeze({
    GLOBAL: 0.45,
    SYNDICATE: 0.73,
    DEAL_ROOM: 0.68,
    DIRECT: 0.74,
    SPECTATOR: 0.46,
    LOBBY: 0.46,
  }),
  ACK_REQUIRED: Object.freeze({
    GLOBAL: 0.73,
    SYNDICATE: 0.50,
    DEAL_ROOM: 0.71,
    DIRECT: 0.67,
    SPECTATOR: 0.40,
    LOBBY: 0.77,
  }),
  PULSE_ALLOWED: Object.freeze({
    GLOBAL: 0.67,
    SYNDICATE: 0.72,
    DEAL_ROOM: 0.68,
    DIRECT: 0.44,
    SPECTATOR: 0.45,
    LOBBY: 0.40,
  }),
  PULSE_SUPPRESSED: Object.freeze({
    GLOBAL: 0.51,
    SYNDICATE: 0.60,
    DEAL_ROOM: 0.63,
    DIRECT: 0.62,
    SPECTATOR: 0.41,
    LOBBY: 0.73,
  }),
  HISTORY_COLLAPSED: Object.freeze({
    GLOBAL: 0.53,
    SYNDICATE: 0.69,
    DEAL_ROOM: 0.64,
    DIRECT: 0.45,
    SPECTATOR: 0.60,
    LOBBY: 0.68,
  }),
  SHADOW_ESCALATION: Object.freeze({
    GLOBAL: 0.44,
    SYNDICATE: 0.43,
    DEAL_ROOM: 0.74,
    DIRECT: 0.41,
    SPECTATOR: 0.64,
    LOBBY: 0.56,
  }),
});

export function scoreBannerForChannelAndMount(
  banner: ChatEventBannerModel,
  channel: ChatChannelId,
  mount: ChatBridgeMountTarget,
): number {
  const channelWeight = stableNumber(banner.channelAffinity[channel], 0);
  const mountWeight = stableNumber(banner.mountAffinity[mount], 0);
  const reasonWeight = banner.reasonCodes.reduce((sum, reason) => sum + stableNumber(CHAT_EVENT_BANNER_REASON_POLICY_MATRIX[reason]?.[channel], 0), 0);
  const matrixWeight = stableNumber(CHAT_EVENT_BANNER_CHANNEL_POLICY_MATRIX[channel]?.[mount], 0);
  return clamp01((channelWeight * 0.30) + (mountWeight * 0.30) + (matrixWeight * 0.20) + Math.min(0.20, reasonWeight * 0.01));
}

export function rankBannersForChannelAndMount(
  snapshot: ChatEventBannerQueueSnapshot,
  channel: ChatChannelId,
  mount: ChatBridgeMountTarget,
): readonly ChatEventBannerModel[] {
  return freezeArray(
    [snapshot.active, ...snapshot.queued, ...snapshot.shadow]
      .filter(Boolean)
      .map((banner) => banner as ChatEventBannerModel)
      .sort((left, right) => scoreBannerForChannelAndMount(right, channel, mount) - scoreBannerForChannelAndMount(left, channel, mount)),
  );
}

export function describeGlobalPrimaryDockBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'GLOBAL' as ChatChannelId, 'PRIMARY_DOCK' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:global',
    'mount:primary_dock',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeGlobalMomentFlashBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'GLOBAL' as ChatChannelId, 'MOMENT_FLASH' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:global',
    'mount:moment_flash',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeGlobalThreatRadarPanelBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'GLOBAL' as ChatChannelId, 'THREAT_RADAR_PANEL' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:global',
    'mount:threat_radar_panel',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeGlobalRescueWindowBannerBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'GLOBAL' as ChatChannelId, 'RESCUE_WINDOW_BANNER' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:global',
    'mount:rescue_window_banner',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeGlobalCounterplayModalBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'GLOBAL' as ChatChannelId, 'COUNTERPLAY_MODAL' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:global',
    'mount:counterplay_modal',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeGlobalProofCardV2BannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'GLOBAL' as ChatChannelId, 'PROOF_CARD_V2' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:global',
    'mount:proof_card_v2',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeSyndicatePrimaryDockBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'SYNDICATE' as ChatChannelId, 'PRIMARY_DOCK' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:syndicate',
    'mount:primary_dock',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeSyndicateMomentFlashBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'SYNDICATE' as ChatChannelId, 'MOMENT_FLASH' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:syndicate',
    'mount:moment_flash',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeSyndicateThreatRadarPanelBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'SYNDICATE' as ChatChannelId, 'THREAT_RADAR_PANEL' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:syndicate',
    'mount:threat_radar_panel',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeSyndicateRescueWindowBannerBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'SYNDICATE' as ChatChannelId, 'RESCUE_WINDOW_BANNER' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:syndicate',
    'mount:rescue_window_banner',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeSyndicateCounterplayModalBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'SYNDICATE' as ChatChannelId, 'COUNTERPLAY_MODAL' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:syndicate',
    'mount:counterplay_modal',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeSyndicateProofCardV2BannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'SYNDICATE' as ChatChannelId, 'PROOF_CARD_V2' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:syndicate',
    'mount:proof_card_v2',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeDealRoomPrimaryDockBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'DEAL_ROOM' as ChatChannelId, 'PRIMARY_DOCK' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:deal_room',
    'mount:primary_dock',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeDealRoomMomentFlashBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'DEAL_ROOM' as ChatChannelId, 'MOMENT_FLASH' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:deal_room',
    'mount:moment_flash',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeDealRoomThreatRadarPanelBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'DEAL_ROOM' as ChatChannelId, 'THREAT_RADAR_PANEL' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:deal_room',
    'mount:threat_radar_panel',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeDealRoomRescueWindowBannerBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'DEAL_ROOM' as ChatChannelId, 'RESCUE_WINDOW_BANNER' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:deal_room',
    'mount:rescue_window_banner',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeDealRoomCounterplayModalBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'DEAL_ROOM' as ChatChannelId, 'COUNTERPLAY_MODAL' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:deal_room',
    'mount:counterplay_modal',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeDealRoomProofCardV2BannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'DEAL_ROOM' as ChatChannelId, 'PROOF_CARD_V2' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:deal_room',
    'mount:proof_card_v2',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeDirectPrimaryDockBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'DIRECT' as ChatChannelId, 'PRIMARY_DOCK' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:direct',
    'mount:primary_dock',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeDirectMomentFlashBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'DIRECT' as ChatChannelId, 'MOMENT_FLASH' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:direct',
    'mount:moment_flash',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeDirectThreatRadarPanelBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'DIRECT' as ChatChannelId, 'THREAT_RADAR_PANEL' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:direct',
    'mount:threat_radar_panel',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeDirectRescueWindowBannerBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'DIRECT' as ChatChannelId, 'RESCUE_WINDOW_BANNER' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:direct',
    'mount:rescue_window_banner',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeDirectCounterplayModalBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'DIRECT' as ChatChannelId, 'COUNTERPLAY_MODAL' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:direct',
    'mount:counterplay_modal',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeDirectProofCardV2BannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'DIRECT' as ChatChannelId, 'PROOF_CARD_V2' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:direct',
    'mount:proof_card_v2',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeSpectatorPrimaryDockBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'SPECTATOR' as ChatChannelId, 'PRIMARY_DOCK' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:spectator',
    'mount:primary_dock',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeSpectatorMomentFlashBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'SPECTATOR' as ChatChannelId, 'MOMENT_FLASH' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:spectator',
    'mount:moment_flash',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeSpectatorThreatRadarPanelBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'SPECTATOR' as ChatChannelId, 'THREAT_RADAR_PANEL' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:spectator',
    'mount:threat_radar_panel',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeSpectatorRescueWindowBannerBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'SPECTATOR' as ChatChannelId, 'RESCUE_WINDOW_BANNER' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:spectator',
    'mount:rescue_window_banner',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeSpectatorCounterplayModalBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'SPECTATOR' as ChatChannelId, 'COUNTERPLAY_MODAL' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:spectator',
    'mount:counterplay_modal',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeSpectatorProofCardV2BannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'SPECTATOR' as ChatChannelId, 'PROOF_CARD_V2' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:spectator',
    'mount:proof_card_v2',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeLobbyPrimaryDockBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'LOBBY' as ChatChannelId, 'PRIMARY_DOCK' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:lobby',
    'mount:primary_dock',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeLobbyMomentFlashBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'LOBBY' as ChatChannelId, 'MOMENT_FLASH' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:lobby',
    'mount:moment_flash',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeLobbyThreatRadarPanelBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'LOBBY' as ChatChannelId, 'THREAT_RADAR_PANEL' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:lobby',
    'mount:threat_radar_panel',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeLobbyRescueWindowBannerBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'LOBBY' as ChatChannelId, 'RESCUE_WINDOW_BANNER' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:lobby',
    'mount:rescue_window_banner',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeLobbyCounterplayModalBannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'LOBBY' as ChatChannelId, 'COUNTERPLAY_MODAL' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:lobby',
    'mount:counterplay_modal',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

export function describeLobbyProofCardV2BannerLens(snapshot: ChatEventBannerQueueSnapshot): readonly string[] {
  const ranked = rankBannersForChannelAndMount(snapshot, 'LOBBY' as ChatChannelId, 'PROOF_CARD_V2' as ChatBridgeMountTarget);
  return freezeArray(ranked.slice(0, 6).map((banner) => [
    'channel:lobby',
    'mount:proof_card_v2',
    `banner:${banner.bannerId}`,
    `kind:${banner.kind.toLowerCase()}`,
    `state:${banner.state.toLowerCase()}`,
    `queue:${banner.queueScore.toFixed(3)}`,
    `priority:${banner.priorityScore.toFixed(3)}`,
  ].join('|')));
}

