/**
 * ============================================================================
 * POINT ZERO ONE — CHAT EVENT FANOUT
 * FILE: pzo-server/src/chat/liveops/ChatEventFanout.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Server-side liveops/world-event fanout for the PZO chat runtime.
 *
 * This file is intentionally transport-aware at the server-boundary while still
 * remaining adapter-first. It is not a generic event bus. It is the orchestration
 * layer that turns liveops/world-event intent into:
 *
 * - room-scoped overlay pushes
 * - session-scoped banner pushes
 * - delayed reveals
 * - hidden shadow telemetry
 * - faction surge amplification
 * - whisper-only interval policy changes
 * - system broadcast envelopes for chat-side consumption
 *
 * Design goals
 * ------------
 * 1. Stay aligned with the existing pzo-server chat transport stack.
 * 2. Avoid flattening backend engine / room / session authority.
 * 3. Keep the world-event lane deterministic enough for replay, audit, and
 *    server composition while still supporting premium-feeling timing.
 * 4. Treat liveops as a first-class chat pressure system, not a bolt-on alert.
 *
 * Notes
 * -----
 * - This file deliberately defines transport-facing interfaces locally so it can
 *   be adopted without hard-coupling to not-yet-landed shared liveops contracts.
 * - It composes with the existing ChatLiveOpsOverlayGateway rather than replacing it.
 * - It is safe to mount beside ChatFanoutService. ChatFanoutService remains the
 *   authoritative general envelope fanout lane; this file specializes in
 *   liveops/world-event orchestration and fanout timing.
 * ============================================================================
 */

import { randomUUID } from 'node:crypto';
import { ChatLiveOpsOverlayGateway } from '../ChatLiveOpsOverlayGateway';

// ============================================================================
// MARK: Primitive aliases
// ============================================================================

export type ChatEventFanoutScope =
  | 'GLOBAL'
  | 'ROOM'
  | 'ROOM_SET'
  | 'SYNDICATE'
  | 'SESSION'
  | 'SESSION_SET'
  | 'PLAYER'
  | 'PLAYER_SET';

export type ChatEventFanoutSeverity =
  | 'INFO'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'
  | 'CATASTROPHIC';

export type ChatEventFanoutPriority =
  | 'BACKGROUND'
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT'
  | 'IMMOVABLE';

export type ChatEventFanoutDeliveryMode =
  | 'IMMEDIATE'
  | 'SCHEDULED'
  | 'STAGGERED'
  | 'DELAYED_REVEAL'
  | 'MANUAL_RELEASE';

export type ChatEventFanoutAudienceMode =
  | 'VISIBLE'
  | 'WHISPER_ONLY'
  | 'OVERLAY_ONLY'
  | 'BANNER_ONLY'
  | 'SHADOW_ONLY'
  | 'VISIBLE_AND_SHADOW';

export type ChatEventFanoutShadowChannel =
  | 'SYSTEM_SHADOW'
  | 'NPC_SHADOW'
  | 'RIVALRY_SHADOW'
  | 'RESCUE_SHADOW'
  | 'LIVEOPS_SHADOW';

export type ChatEventFanoutReason =
  | 'LIQUIDATOR_HUNT'
  | 'SYNDICATE_PANIC'
  | 'MARKET_RUMOR_BURST'
  | 'HELPER_BLACKOUT'
  | 'DOUBLE_HEAT'
  | 'WHISPER_ONLY_INTERVAL'
  | 'FACTION_DEBATE'
  | 'COORDINATED_HATER_RAID'
  | 'CUSTOM'
  | 'SYSTEM';

// ============================================================================
// MARK: Public constants
// ============================================================================

export const CHAT_EVENT_FANOUT_EVENTS = Object.freeze({
  WORLD_EVENT: 'chat:liveops-world-event',
  WORLD_EVENT_RELEASED: 'chat:liveops-world-event-released',
  WORLD_EVENT_SHADOW: 'chat:liveops-world-event-shadow',
  WORLD_EVENT_BANNER: 'chat:liveops-banner',
  WORLD_EVENT_OVERLAY: 'chat:liveops-overlay',
  WORLD_EVENT_HEAT: 'chat:liveops-heat-modifier',
  WORLD_EVENT_POLICY: 'chat:liveops-policy',
  WORLD_EVENT_AUDIT: 'chat:liveops-audit',
}) satisfies Record<string, string>;

export const DEFAULT_CHAT_EVENT_FANOUT_CONFIG = Object.freeze({
  dedupeWindowMs: 12_000,
  maxScheduledEvents: 2_048,
  maxBindingsPerRoom: 2_000,
  defaultImmediateJitterMs: 400,
  defaultRoomStaggerMs: 350,
  defaultSessionStaggerMs: 60,
  scheduledSweepIntervalMs: 1_000,
  defaultBannerTtlMs: 18_000,
  defaultOverlayTtlMs: 20_000,
  defaultWhisperOnlyTtlMs: 120_000,
  defaultDebateRoundSpacingMs: 3_500,
  defaultRaidWaveSpacingMs: 2_200,
  defaultHeatMultiplierDelta: 0.35,
  maxAuditRecords: 8_192,
  allowBestEffortRoomBroadcasts: true,
  emitAuditEventsToSessions: false,
  deliverShadowsToVisibleSessions: false,
  includeSessionIdsInAudit: false,
  autoPromoteCriticalEventsToBanner: true,
  autoPromoteCriticalEventsToOverlay: true,
}) satisfies Readonly<ChatEventFanoutConfig>;

// ============================================================================
// MARK: Transport-facing interfaces
// ============================================================================

export interface ChatEventFanoutConfig {
  readonly dedupeWindowMs: number;
  readonly maxScheduledEvents: number;
  readonly maxBindingsPerRoom: number;
  readonly defaultImmediateJitterMs: number;
  readonly defaultRoomStaggerMs: number;
  readonly defaultSessionStaggerMs: number;
  readonly scheduledSweepIntervalMs: number;
  readonly defaultBannerTtlMs: number;
  readonly defaultOverlayTtlMs: number;
  readonly defaultWhisperOnlyTtlMs: number;
  readonly defaultDebateRoundSpacingMs: number;
  readonly defaultRaidWaveSpacingMs: number;
  readonly defaultHeatMultiplierDelta: number;
  readonly maxAuditRecords: number;
  readonly allowBestEffortRoomBroadcasts: boolean;
  readonly emitAuditEventsToSessions: boolean;
  readonly deliverShadowsToVisibleSessions: boolean;
  readonly includeSessionIdsInAudit: boolean;
  readonly autoPromoteCriticalEventsToBanner: boolean;
  readonly autoPromoteCriticalEventsToOverlay: boolean;
}

export interface ChatEventFanoutLogger {
  debug(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  info(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  warn(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  error(message: string, metadata?: Readonly<Record<string, unknown>>): void;
}

export interface ChatEventFanoutEmitter {
  emitToSession(sessionId: string, event: string, payload: unknown): void;
  emitToRoom?(roomId: string, event: string, payload: unknown): void;
  emitToRooms?(roomIds: readonly string[], event: string, payload: unknown): void;
}

export interface ChatEventFanoutClock {
  nowMs(): number;
  nowIso(): string;
}

export interface ChatEventFanoutSessionBinding {
  readonly sessionId: string;
  readonly roomId: string;
  readonly playerId?: string | null;
  readonly userId?: string | null;
  readonly syndicateId?: string | null;
  readonly factionId?: string | null;
  readonly connected?: boolean;
  readonly socketId?: string | null;
  readonly tags?: readonly string[];
  readonly heatBias?: number;
}

export interface ChatEventFanoutBannerPayload {
  readonly eventId: string;
  readonly title: string;
  readonly body: string;
  readonly severity: ChatEventFanoutSeverity;
  readonly ttlMs: number;
  readonly accent?: string | null;
  readonly icon?: string | null;
  readonly ctaLabel?: string | null;
  readonly ctaAction?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ChatEventFanoutOverlayPayload {
  readonly eventId: string;
  readonly headline: string;
  readonly subhead?: string | null;
  readonly reason: ChatEventFanoutReason;
  readonly severity: ChatEventFanoutSeverity;
  readonly startsAt: string;
  readonly endsAt?: string | null;
  readonly ttlMs: number;
  readonly heatMultiplier?: number | null;
  readonly whisperOnly?: boolean;
  readonly helperBlackout?: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ChatEventFanoutShadowPayload {
  readonly eventId: string;
  readonly channel: ChatEventFanoutShadowChannel;
  readonly reason: ChatEventFanoutReason;
  readonly severity: ChatEventFanoutSeverity;
  readonly phase: 'PLANNED' | 'QUEUED' | 'RELEASED' | 'EXPIRED' | 'CANCELLED';
  readonly targets: Readonly<{
    rooms: readonly string[];
    sessions?: readonly string[];
  }>;
  readonly revealAt: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ChatEventFanoutVisiblePayload {
  readonly eventId: string;
  readonly reason: ChatEventFanoutReason;
  readonly title: string;
  readonly body: string;
  readonly severity: ChatEventFanoutSeverity;
  readonly priority: ChatEventFanoutPriority;
  readonly startsAt: string;
  readonly endsAt?: string | null;
  readonly audienceMode: ChatEventFanoutAudienceMode;
  readonly roomIds: readonly string[];
  readonly sessionIds: readonly string[];
  readonly factionIds: readonly string[];
  readonly syndicateIds: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ChatEventFanoutPolicyPayload {
  readonly eventId: string;
  readonly whisperOnly: boolean;
  readonly helperBlackout: boolean;
  readonly heatMultiplierDelta: number;
  readonly startsAt: string;
  readonly endsAt?: string | null;
  readonly reason: ChatEventFanoutReason;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ChatEventFanoutHeatPayload {
  readonly eventId: string;
  readonly reason: ChatEventFanoutReason;
  readonly heatMultiplierDelta: number;
  readonly roomIds: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ChatEventFanoutAuditRecord {
  readonly auditId: string;
  readonly eventId: string;
  readonly signature: string;
  readonly reason: ChatEventFanoutReason;
  readonly severity: ChatEventFanoutSeverity;
  readonly priority: ChatEventFanoutPriority;
  readonly phase:
    | 'PLANNED'
    | 'DEDUPED'
    | 'QUEUED'
    | 'RELEASED'
    | 'PARTIALLY_RELEASED'
    | 'SKIPPED'
    | 'CANCELLED'
    | 'EXPIRED';
  readonly emittedAt: string;
  readonly targetRooms: readonly string[];
  readonly targetSessionsCount: number;
  readonly revealAt?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ChatEventFanoutResult {
  readonly eventId: string;
  readonly signature: string;
  readonly released: boolean;
  readonly scheduled: boolean;
  readonly deduped: boolean;
  readonly targetRoomIds: readonly string[];
  readonly targetSessionIds: readonly string[];
  readonly overlayRoomIds: readonly string[];
  readonly bannerSessionIds: readonly string[];
  readonly visibleSessionIds: readonly string[];
  readonly shadowSessionIds: readonly string[];
  readonly revealAt: string | null;
  readonly emittedAudit: ChatEventFanoutAuditRecord;
}

export interface ChatEventFanoutScopeDescriptor {
  readonly scope: ChatEventFanoutScope;
  readonly roomId?: string | null;
  readonly roomIds?: readonly string[];
  readonly sessionId?: string | null;
  readonly sessionIds?: readonly string[];
  readonly playerId?: string | null;
  readonly playerIds?: readonly string[];
  readonly syndicateId?: string | null;
  readonly syndicateIds?: readonly string[];
  readonly factionId?: string | null;
  readonly factionIds?: readonly string[];
  readonly tagsAny?: readonly string[];
}

export interface ChatEventFanoutDeliveryWindow {
  readonly startsAtMs?: number | null;
  readonly endsAtMs?: number | null;
  readonly revealAtMs?: number | null;
  readonly staggerByRoomMs?: number | null;
  readonly staggerBySessionMs?: number | null;
  readonly releaseMode?: ChatEventFanoutDeliveryMode | null;
  readonly jitterMs?: number | null;
}

export interface ChatEventFanoutDraft {
  readonly eventId?: string | null;
  readonly reason: ChatEventFanoutReason;
  readonly title: string;
  readonly body: string;
  readonly severity: ChatEventFanoutSeverity;
  readonly priority?: ChatEventFanoutPriority | null;
  readonly audienceMode?: ChatEventFanoutAudienceMode | null;
  readonly target: ChatEventFanoutScopeDescriptor;
  readonly delivery?: ChatEventFanoutDeliveryWindow | null;
  readonly banner?: Partial<ChatEventFanoutBannerPayload> | null;
  readonly overlay?: Partial<ChatEventFanoutOverlayPayload> | null;
  readonly visiblePayload?: Readonly<Record<string, unknown>> | null;
  readonly policy?: Partial<ChatEventFanoutPolicyPayload> | null;
  readonly heat?: Partial<ChatEventFanoutHeatPayload> | null;
  readonly shadowChannels?: readonly ChatEventFanoutShadowChannel[] | null;
  readonly whisperOnly?: boolean | null;
  readonly helperBlackout?: boolean | null;
  readonly heatMultiplierDelta?: number | null;
  readonly metadata?: Readonly<Record<string, unknown>> | null;
  readonly dedupeKey?: string | null;
  readonly source?: string | null;
}

export interface ChatEventFanoutScheduledRecord {
  readonly eventId: string;
  readonly signature: string;
  readonly draft: NormalizedChatEventFanoutDraft;
  readonly queuedAtMs: number;
  readonly releaseAtMs: number;
}

export interface ChatEventFanoutAuditSnapshot {
  readonly activeScheduledCount: number;
  readonly totalBindings: number;
  readonly totalRooms: number;
  readonly lastSweepAtMs: number;
  readonly records: readonly ChatEventFanoutAuditRecord[];
}

// ============================================================================
// MARK: Internal normalized models
// ============================================================================

interface NormalizedChatEventFanoutDraft {
  readonly eventId: string;
  readonly reason: ChatEventFanoutReason;
  readonly title: string;
  readonly body: string;
  readonly severity: ChatEventFanoutSeverity;
  readonly priority: ChatEventFanoutPriority;
  readonly audienceMode: ChatEventFanoutAudienceMode;
  readonly target: ChatEventFanoutScopeDescriptor;
  readonly delivery: Required<ChatEventFanoutDeliveryWindow>;
  readonly banner: ChatEventFanoutBannerPayload | null;
  readonly overlay: ChatEventFanoutOverlayPayload | null;
  readonly visiblePayload: Readonly<Record<string, unknown>> | null;
  readonly policy: ChatEventFanoutPolicyPayload | null;
  readonly heat: ChatEventFanoutHeatPayload | null;
  readonly shadowChannels: readonly ChatEventFanoutShadowChannel[];
  readonly whisperOnly: boolean;
  readonly helperBlackout: boolean;
  readonly heatMultiplierDelta: number;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly dedupeKey: string | null;
  readonly source: string | null;
}

interface ResolvedChatEventTargets {
  readonly roomIds: readonly string[];
  readonly sessions: readonly ChatEventFanoutSessionBinding[];
  readonly syndicateIds: readonly string[];
  readonly factionIds: readonly string[];
  readonly playerIds: readonly string[];
}

// ============================================================================
// MARK: Default adapters
// ============================================================================

const NOOP_CHAT_EVENT_FANOUT_LOGGER: ChatEventFanoutLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const SYSTEM_CLOCK: ChatEventFanoutClock = {
  nowMs: () => Date.now(),
  nowIso: () => new Date().toISOString(),
};

// ============================================================================
// MARK: Utility helpers
// ============================================================================

export function createDefaultChatEventFanoutConfig(
  overrides: Partial<ChatEventFanoutConfig> = {},
): ChatEventFanoutConfig {
  return {
    ...DEFAULT_CHAT_EVENT_FANOUT_CONFIG,
    ...sanitizeConfig(overrides),
  };
}

export function normalizeWorldEventDeliveryWindow(
  window: ChatEventFanoutDeliveryWindow | null | undefined,
  nowMs: number,
  defaults: ChatEventFanoutConfig = DEFAULT_CHAT_EVENT_FANOUT_CONFIG,
): Required<ChatEventFanoutDeliveryWindow> {
  const startsAtMs = safeNumber(window?.startsAtMs, nowMs);
  const endsAtMs = clampEnd(startsAtMs, safeNullableNumber(window?.endsAtMs));
  const revealAtMs = clampReveal(startsAtMs, endsAtMs, safeNullableNumber(window?.revealAtMs));
  const staggerByRoomMs = clampNonNegative(
    safeNumber(window?.staggerByRoomMs, defaults.defaultRoomStaggerMs),
  );
  const staggerBySessionMs = clampNonNegative(
    safeNumber(window?.staggerBySessionMs, defaults.defaultSessionStaggerMs),
  );
  const jitterMs = clampNonNegative(
    safeNumber(window?.jitterMs, defaults.defaultImmediateJitterMs),
  );
  const releaseMode = normalizeDeliveryMode(window?.releaseMode);

  return {
    startsAtMs,
    endsAtMs,
    revealAtMs,
    staggerByRoomMs,
    staggerBySessionMs,
    releaseMode,
    jitterMs,
  };
}

export function createWorldEventFanoutDigest(input: {
  readonly reason: ChatEventFanoutReason;
  readonly title: string;
  readonly body: string;
  readonly severity: ChatEventFanoutSeverity;
  readonly scope: ChatEventFanoutScopeDescriptor;
  readonly startsAtMs?: number | null;
  readonly endsAtMs?: number | null;
  readonly revealAtMs?: number | null;
  readonly dedupeKey?: string | null;
}): string {
  const stable = [
    input.dedupeKey ?? '',
    input.reason,
    input.title.trim(),
    input.body.trim(),
    input.severity,
    input.scope.scope,
    stableJoin(input.scope.roomIds),
    input.scope.roomId ?? '',
    stableJoin(input.scope.sessionIds),
    input.scope.sessionId ?? '',
    input.scope.playerId ?? '',
    stableJoin(input.scope.playerIds),
    input.scope.syndicateId ?? '',
    stableJoin(input.scope.syndicateIds),
    input.scope.factionId ?? '',
    stableJoin(input.scope.factionIds),
    String(input.startsAtMs ?? ''),
    String(input.endsAtMs ?? ''),
    String(input.revealAtMs ?? ''),
  ].join('|');

  return fnv1aHex(stable);
}

function sanitizeConfig(input: Partial<ChatEventFanoutConfig>): Partial<ChatEventFanoutConfig> {
  const output: Partial<ChatEventFanoutConfig> = {};

  if (isFinitePositive(input.dedupeWindowMs)) output.dedupeWindowMs = input.dedupeWindowMs;
  if (isFinitePositive(input.maxScheduledEvents))
    output.maxScheduledEvents = Math.floor(input.maxScheduledEvents);
  if (isFinitePositive(input.maxBindingsPerRoom))
    output.maxBindingsPerRoom = Math.floor(input.maxBindingsPerRoom);
  if (isFiniteNonNegative(input.defaultImmediateJitterMs))
    output.defaultImmediateJitterMs = input.defaultImmediateJitterMs;
  if (isFiniteNonNegative(input.defaultRoomStaggerMs))
    output.defaultRoomStaggerMs = input.defaultRoomStaggerMs;
  if (isFiniteNonNegative(input.defaultSessionStaggerMs))
    output.defaultSessionStaggerMs = input.defaultSessionStaggerMs;
  if (isFinitePositive(input.scheduledSweepIntervalMs))
    output.scheduledSweepIntervalMs = input.scheduledSweepIntervalMs;
  if (isFinitePositive(input.defaultBannerTtlMs))
    output.defaultBannerTtlMs = input.defaultBannerTtlMs;
  if (isFinitePositive(input.defaultOverlayTtlMs))
    output.defaultOverlayTtlMs = input.defaultOverlayTtlMs;
  if (isFinitePositive(input.defaultWhisperOnlyTtlMs))
    output.defaultWhisperOnlyTtlMs = input.defaultWhisperOnlyTtlMs;
  if (isFinitePositive(input.defaultDebateRoundSpacingMs))
    output.defaultDebateRoundSpacingMs = input.defaultDebateRoundSpacingMs;
  if (isFinitePositive(input.defaultRaidWaveSpacingMs))
    output.defaultRaidWaveSpacingMs = input.defaultRaidWaveSpacingMs;
  if (isFiniteNumber(input.defaultHeatMultiplierDelta))
    output.defaultHeatMultiplierDelta = input.defaultHeatMultiplierDelta;
  if (isFinitePositive(input.maxAuditRecords))
    output.maxAuditRecords = Math.floor(input.maxAuditRecords);
  if (typeof input.allowBestEffortRoomBroadcasts === 'boolean')
    output.allowBestEffortRoomBroadcasts = input.allowBestEffortRoomBroadcasts;
  if (typeof input.emitAuditEventsToSessions === 'boolean')
    output.emitAuditEventsToSessions = input.emitAuditEventsToSessions;
  if (typeof input.deliverShadowsToVisibleSessions === 'boolean')
    output.deliverShadowsToVisibleSessions = input.deliverShadowsToVisibleSessions;
  if (typeof input.includeSessionIdsInAudit === 'boolean')
    output.includeSessionIdsInAudit = input.includeSessionIdsInAudit;
  if (typeof input.autoPromoteCriticalEventsToBanner === 'boolean')
    output.autoPromoteCriticalEventsToBanner = input.autoPromoteCriticalEventsToBanner;
  if (typeof input.autoPromoteCriticalEventsToOverlay === 'boolean')
    output.autoPromoteCriticalEventsToOverlay = input.autoPromoteCriticalEventsToOverlay;

  return output;
}

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function stableJoin(values: readonly string[] | null | undefined): string {
  if (!values?.length) return '';
  return [...values].filter(Boolean).sort().join(',');
}

function safeNumber(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeNullableNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clampNonNegative(value: number): number {
  return value < 0 ? 0 : value;
}

function clampEnd(startsAtMs: number, endsAtMs: number | null): number | null {
  if (endsAtMs == null) return null;
  return endsAtMs < startsAtMs ? startsAtMs : endsAtMs;
}

function clampReveal(
  startsAtMs: number,
  endsAtMs: number | null,
  revealAtMs: number | null,
): number | null {
  if (revealAtMs == null) return null;
  if (revealAtMs < startsAtMs) return startsAtMs;
  if (endsAtMs != null && revealAtMs > endsAtMs) return endsAtMs;
  return revealAtMs;
}

function normalizeDeliveryMode(value: ChatEventFanoutDeliveryMode | null | undefined): ChatEventFanoutDeliveryMode {
  switch (value) {
    case 'IMMEDIATE':
    case 'SCHEDULED':
    case 'STAGGERED':
    case 'DELAYED_REVEAL':
    case 'MANUAL_RELEASE':
      return value;
    default:
      return 'IMMEDIATE';
  }
}

function normalizeSeverity(value: ChatEventFanoutSeverity | null | undefined): ChatEventFanoutSeverity {
  switch (value) {
    case 'INFO':
    case 'LOW':
    case 'MEDIUM':
    case 'HIGH':
    case 'CRITICAL':
    case 'CATASTROPHIC':
      return value;
    default:
      return 'INFO';
  }
}

function normalizePriority(
  value: ChatEventFanoutPriority | null | undefined,
  severity: ChatEventFanoutSeverity,
): ChatEventFanoutPriority {
  if (value) return value;
  switch (severity) {
    case 'CATASTROPHIC':
      return 'IMMOVABLE';
    case 'CRITICAL':
      return 'URGENT';
    case 'HIGH':
      return 'HIGH';
    case 'MEDIUM':
      return 'NORMAL';
    case 'LOW':
      return 'LOW';
    case 'INFO':
    default:
      return 'BACKGROUND';
  }
}

function normalizeAudienceMode(
  value: ChatEventFanoutAudienceMode | null | undefined,
): ChatEventFanoutAudienceMode {
  switch (value) {
    case 'VISIBLE':
    case 'WHISPER_ONLY':
    case 'OVERLAY_ONLY':
    case 'BANNER_ONLY':
    case 'SHADOW_ONLY':
    case 'VISIBLE_AND_SHADOW':
      return value;
    default:
      return 'VISIBLE';
  }
}

function normalizeScope(input: ChatEventFanoutScopeDescriptor): ChatEventFanoutScopeDescriptor {
  return {
    scope: input.scope,
    roomId: normalizeOptionalString(input.roomId),
    roomIds: freezeStrings(input.roomIds),
    sessionId: normalizeOptionalString(input.sessionId),
    sessionIds: freezeStrings(input.sessionIds),
    playerId: normalizeOptionalString(input.playerId),
    playerIds: freezeStrings(input.playerIds),
    syndicateId: normalizeOptionalString(input.syndicateId),
    syndicateIds: freezeStrings(input.syndicateIds),
    factionId: normalizeOptionalString(input.factionId),
    factionIds: freezeStrings(input.factionIds),
    tagsAny: freezeStrings(input.tagsAny),
  };
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function freezeStrings(values: readonly string[] | null | undefined): readonly string[] {
  return Object.freeze(
    [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].sort(),
  );
}

function uniqueBySession(bindings: readonly ChatEventFanoutSessionBinding[]): readonly ChatEventFanoutSessionBinding[] {
  const seen = new Set<string>();
  const output: ChatEventFanoutSessionBinding[] = [];
  for (const binding of bindings) {
    if (!binding.sessionId || seen.has(binding.sessionId)) continue;
    seen.add(binding.sessionId);
    output.push(binding);
  }
  return output;
}

function collectUniqueStrings(
  values: readonly (string | null | undefined)[],
): readonly string[] {
  return Object.freeze(
    [...new Set(values.map((value) => (value ?? '').trim()).filter(Boolean))].sort(),
  );
}

function isCriticalLike(severity: ChatEventFanoutSeverity): boolean {
  return severity === 'CRITICAL' || severity === 'CATASTROPHIC';
}

function buildAuditId(eventId: string, phase: string): string {
  return `${eventId}:${phase}:${randomUUID()}`;
}

function coerceRecord(value: Readonly<Record<string, unknown>> | null | undefined): Readonly<Record<string, unknown>> {
  return Object.freeze({ ...(value ?? {}) });
}

// ============================================================================
// MARK: Class
// ============================================================================

export class ChatEventFanout {
  private readonly config: ChatEventFanoutConfig;

  private readonly emitter: ChatEventFanoutEmitter;

  private readonly logger: ChatEventFanoutLogger;

  private readonly clock: ChatEventFanoutClock;

  private readonly overlayGateway: ChatLiveOpsOverlayGateway;

  private readonly bindingsBySession = new Map<string, ChatEventFanoutSessionBinding>();

  private readonly sessionsByRoom = new Map<string, Set<string>>();

  private readonly signatures = new Map<string, number>();

  private readonly scheduled = new Map<string, ChatEventFanoutScheduledRecord>();

  private readonly auditTrail: ChatEventFanoutAuditRecord[] = [];

  private lastSweepAtMs = 0;

  public constructor(deps: {
    readonly emitter: ChatEventFanoutEmitter;
    readonly logger?: ChatEventFanoutLogger;
    readonly clock?: ChatEventFanoutClock;
    readonly config?: Partial<ChatEventFanoutConfig>;
  }) {
    this.config = createDefaultChatEventFanoutConfig(deps.config);
    this.emitter = deps.emitter;
    this.logger = deps.logger ?? NOOP_CHAT_EVENT_FANOUT_LOGGER;
    this.clock = deps.clock ?? SYSTEM_CLOCK;
    this.overlayGateway = new ChatLiveOpsOverlayGateway({
      emitToSession: (sessionId, event, payload) => {
        this.emitter.emitToSession(sessionId, event, payload);
      },
    });
  }

  // ==========================================================================
  // MARK: Session binding lifecycle
  // ==========================================================================

  public bindSession(binding: ChatEventFanoutSessionBinding): void {
    const normalized: ChatEventFanoutSessionBinding = {
      sessionId: binding.sessionId.trim(),
      roomId: binding.roomId.trim(),
      playerId: normalizeOptionalString(binding.playerId),
      userId: normalizeOptionalString(binding.userId),
      syndicateId: normalizeOptionalString(binding.syndicateId),
      factionId: normalizeOptionalString(binding.factionId),
      connected: binding.connected ?? true,
      socketId: normalizeOptionalString(binding.socketId),
      tags: freezeStrings(binding.tags),
      heatBias: typeof binding.heatBias === 'number' && Number.isFinite(binding.heatBias)
        ? binding.heatBias
        : 0,
    };

    if (!normalized.sessionId || !normalized.roomId) {
      this.logger.warn('chat_event_fanout.bind_session_invalid', {
        sessionId: binding.sessionId,
        roomId: binding.roomId,
      });
      return;
    }

    const existing = this.bindingsBySession.get(normalized.sessionId);
    if (existing?.roomId && existing.roomId !== normalized.roomId) {
      this.detachSessionFromRoom(existing.sessionId, existing.roomId);
    }

    this.bindingsBySession.set(normalized.sessionId, normalized);
    this.attachSessionToRoom(normalized.sessionId, normalized.roomId);

    this.overlayGateway.bindSession({
      sessionId: normalized.sessionId,
      roomId: normalized.roomId,
    });

    this.logger.debug('chat_event_fanout.bind_session', {
      sessionId: normalized.sessionId,
      roomId: normalized.roomId,
      syndicateId: normalized.syndicateId,
      factionId: normalized.factionId,
    });
  }

  public unbindSession(sessionId: string): void {
    const existing = this.bindingsBySession.get(sessionId);
    if (!existing) return;

    this.bindingsBySession.delete(sessionId);
    this.detachSessionFromRoom(sessionId, existing.roomId);
    this.overlayGateway.unbindSession(sessionId);

    this.logger.debug('chat_event_fanout.unbind_session', {
      sessionId,
      roomId: existing.roomId,
    });
  }

  public hasSession(sessionId: string): boolean {
    return this.bindingsBySession.has(sessionId);
  }

  public getBinding(sessionId: string): ChatEventFanoutSessionBinding | null {
    return this.bindingsBySession.get(sessionId) ?? null;
  }

  public getBindingsForRoom(roomId: string): readonly ChatEventFanoutSessionBinding[] {
    const ids = this.sessionsByRoom.get(roomId);
    if (!ids?.size) return Object.freeze([]);
    const bindings: ChatEventFanoutSessionBinding[] = [];
    for (const sessionId of ids) {
      const binding = this.bindingsBySession.get(sessionId);
      if (!binding) continue;
      bindings.push(binding);
    }
    return uniqueBySession(bindings);
  }

  public getAuditSnapshot(): ChatEventFanoutAuditSnapshot {
    return {
      activeScheduledCount: this.scheduled.size,
      totalBindings: this.bindingsBySession.size,
      totalRooms: this.sessionsByRoom.size,
      lastSweepAtMs: this.lastSweepAtMs,
      records: Object.freeze([...this.auditTrail]),
    };
  }

  // ==========================================================================
  // MARK: High-level world event entrypoints
  // ==========================================================================

  public publishWorldEvent(draft: ChatEventFanoutDraft): ChatEventFanoutResult {
    const nowMs = this.clock.nowMs();
    const normalized = this.normalizeDraft(draft, nowMs);
    const signature = createWorldEventFanoutDigest({
      reason: normalized.reason,
      title: normalized.title,
      body: normalized.body,
      severity: normalized.severity,
      scope: normalized.target,
      startsAtMs: normalized.delivery.startsAtMs,
      endsAtMs: normalized.delivery.endsAtMs,
      revealAtMs: normalized.delivery.revealAtMs,
      dedupeKey: normalized.dedupeKey,
    });

    if (this.isDuplicate(signature, nowMs)) {
      const audit = this.recordAudit({
        auditId: buildAuditId(normalized.eventId, 'DEDUPED'),
        eventId: normalized.eventId,
        signature,
        reason: normalized.reason,
        severity: normalized.severity,
        priority: normalized.priority,
        phase: 'DEDUPED',
        emittedAt: this.clock.nowIso(),
        targetRooms: [],
        targetSessionsCount: 0,
        revealAt: this.isoOrNull(normalized.delivery.revealAtMs),
        metadata: {
          source: normalized.source,
        },
      });

      return {
        eventId: normalized.eventId,
        signature,
        released: false,
        scheduled: false,
        deduped: true,
        targetRoomIds: Object.freeze([]),
        targetSessionIds: Object.freeze([]),
        overlayRoomIds: Object.freeze([]),
        bannerSessionIds: Object.freeze([]),
        visibleSessionIds: Object.freeze([]),
        shadowSessionIds: Object.freeze([]),
        revealAt: this.isoOrNull(normalized.delivery.revealAtMs),
        emittedAudit: audit,
      };
    }

    if (this.shouldQueue(normalized, nowMs)) {
      return this.queueEvent(normalized, signature, nowMs);
    }

    return this.releaseEvent(normalized, signature, nowMs);
  }

  public publishLiquidatorHunt(input: {
    readonly title?: string;
    readonly body?: string;
    readonly roomIds?: readonly string[];
    readonly durationMs?: number;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }): ChatEventFanoutResult {
    const nowMs = this.clock.nowMs();
    return this.publishWorldEvent({
      reason: 'LIQUIDATOR_HUNT',
      title: input.title ?? 'The Liquidator is hunting low-shield players.',
      body:
        input.body ??
        'Low-shield survivors are being tracked across active rooms. Stay loud and you become prey.',
      severity: 'CRITICAL',
      priority: 'URGENT',
      audienceMode: 'VISIBLE_AND_SHADOW',
      target: {
        scope: input.roomIds?.length ? 'ROOM_SET' : 'GLOBAL',
        roomIds: input.roomIds,
      },
      delivery: {
        startsAtMs: nowMs,
        endsAtMs: nowMs + clampNonNegative(input.durationMs ?? 20 * 60_000),
        revealAtMs: nowMs,
        releaseMode: 'IMMEDIATE',
        staggerByRoomMs: this.config.defaultRoomStaggerMs,
        staggerBySessionMs: this.config.defaultSessionStaggerMs,
      },
      whisperOnly: false,
      heatMultiplierDelta: 0.45,
      shadowChannels: ['LIVEOPS_SHADOW', 'RIVALRY_SHADOW'],
      metadata: {
        preset: 'liquidator_hunt',
        ...(input.metadata ?? {}),
      },
    });
  }

  public publishSyndicatePanic(input: {
    readonly syndicateIds: readonly string[];
    readonly title?: string;
    readonly body?: string;
    readonly durationMs?: number;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }): ChatEventFanoutResult {
    const nowMs = this.clock.nowMs();
    return this.publishWorldEvent({
      reason: 'SYNDICATE_PANIC',
      title: input.title ?? 'Syndicate panic is spreading.',
      body:
        input.body ??
        'Trusted channels are unstable. Reputation-sensitive chatter is accelerating across syndicate rooms.',
      severity: 'HIGH',
      audienceMode: 'VISIBLE_AND_SHADOW',
      target: {
        scope: 'SYNDICATE',
        syndicateIds: input.syndicateIds,
      },
      delivery: {
        startsAtMs: nowMs,
        endsAtMs: nowMs + clampNonNegative(input.durationMs ?? 8 * 60_000),
        revealAtMs: nowMs,
        releaseMode: 'IMMEDIATE',
      },
      heatMultiplierDelta: 0.28,
      shadowChannels: ['LIVEOPS_SHADOW', 'SYSTEM_SHADOW'],
      metadata: {
        preset: 'syndicate_panic',
        ...(input.metadata ?? {}),
      },
    });
  }

  public publishMarketRumorBurst(input: {
    readonly roomIds?: readonly string[];
    readonly revealDelayMs?: number;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }): ChatEventFanoutResult {
    const nowMs = this.clock.nowMs();
    return this.publishWorldEvent({
      reason: 'MARKET_RUMOR_BURST',
      title: 'A market rumor is moving faster than proof.',
      body: 'The first wave is noise. The second wave decides who panics.',
      severity: 'MEDIUM',
      audienceMode: 'VISIBLE_AND_SHADOW',
      target: {
        scope: input.roomIds?.length ? 'ROOM_SET' : 'GLOBAL',
        roomIds: input.roomIds,
      },
      delivery: {
        startsAtMs: nowMs,
        revealAtMs: nowMs + clampNonNegative(input.revealDelayMs ?? 9_000),
        releaseMode: 'DELAYED_REVEAL',
        staggerByRoomMs: 220,
        staggerBySessionMs: 45,
      },
      heatMultiplierDelta: 0.18,
      shadowChannels: ['LIVEOPS_SHADOW', 'SYSTEM_SHADOW'],
      metadata: {
        preset: 'market_rumor_burst',
        ...(input.metadata ?? {}),
      },
    });
  }

  public publishHelperBlackout(input: {
    readonly roomIds?: readonly string[];
    readonly durationMs?: number;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }): ChatEventFanoutResult {
    const nowMs = this.clock.nowMs();
    return this.publishWorldEvent({
      reason: 'HELPER_BLACKOUT',
      title: 'Helper channels are dark.',
      body: 'Guidance latency has spiked. Clean rescue timing is temporarily unavailable.',
      severity: 'HIGH',
      audienceMode: 'VISIBLE_AND_SHADOW',
      target: {
        scope: input.roomIds?.length ? 'ROOM_SET' : 'GLOBAL',
        roomIds: input.roomIds,
      },
      delivery: {
        startsAtMs: nowMs,
        endsAtMs: nowMs + clampNonNegative(input.durationMs ?? 6 * 60_000),
        revealAtMs: nowMs,
        releaseMode: 'IMMEDIATE',
      },
      helperBlackout: true,
      shadowChannels: ['LIVEOPS_SHADOW', 'RESCUE_SHADOW'],
      metadata: {
        preset: 'helper_blackout',
        ...(input.metadata ?? {}),
      },
    });
  }

  public publishDoubleHeat(input: {
    readonly roomIds?: readonly string[];
    readonly durationMs?: number;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }): ChatEventFanoutResult {
    const nowMs = this.clock.nowMs();
    return this.publishWorldEvent({
      reason: 'DOUBLE_HEAT',
      title: 'Global channels are running hot.',
      body: 'Crowd heat amplification is active. Every visible mistake carries extra audience velocity.',
      severity: 'HIGH',
      audienceMode: 'VISIBLE_AND_SHADOW',
      target: {
        scope: input.roomIds?.length ? 'ROOM_SET' : 'GLOBAL',
        roomIds: input.roomIds,
      },
      delivery: {
        startsAtMs: nowMs,
        endsAtMs: nowMs + clampNonNegative(input.durationMs ?? 10 * 60_000),
        revealAtMs: nowMs,
        releaseMode: 'IMMEDIATE',
      },
      heatMultiplierDelta: 0.75,
      shadowChannels: ['LIVEOPS_SHADOW', 'NPC_SHADOW'],
      metadata: {
        preset: 'double_heat',
        ...(input.metadata ?? {}),
      },
    });
  }

  public publishWhisperOnlyInterval(input: {
    readonly roomIds?: readonly string[];
    readonly durationMs?: number;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }): ChatEventFanoutResult {
    const nowMs = this.clock.nowMs();
    return this.publishWorldEvent({
      reason: 'WHISPER_ONLY_INTERVAL',
      title: 'Whisper-only interval active.',
      body: 'Visible chatter is suppressed. Pressure now moves through quieter lanes.',
      severity: 'MEDIUM',
      audienceMode: 'VISIBLE_AND_SHADOW',
      target: {
        scope: input.roomIds?.length ? 'ROOM_SET' : 'GLOBAL',
        roomIds: input.roomIds,
      },
      delivery: {
        startsAtMs: nowMs,
        endsAtMs: nowMs + clampNonNegative(input.durationMs ?? this.config.defaultWhisperOnlyTtlMs),
        revealAtMs: nowMs,
        releaseMode: 'IMMEDIATE',
      },
      whisperOnly: true,
      shadowChannels: ['LIVEOPS_SHADOW', 'SYSTEM_SHADOW'],
      metadata: {
        preset: 'whisper_only_interval',
        ...(input.metadata ?? {}),
      },
    });
  }

  public publishFactionDebate(input: {
    readonly factionIds?: readonly string[];
    readonly roomIds?: readonly string[];
    readonly rounds?: number;
    readonly title?: string;
    readonly body?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }): ChatEventFanoutResult {
    const rounds = Math.max(1, Math.floor(input.rounds ?? 3));
    const nowMs = this.clock.nowMs();
    return this.publishWorldEvent({
      reason: 'FACTION_DEBATE',
      title: input.title ?? 'Faction debate has broken containment.',
      body:
        input.body ??
        `Debate pressure is escalating across ${rounds} rounds. Positioning now affects reputation carryover.`,
      severity: 'MEDIUM',
      audienceMode: 'VISIBLE_AND_SHADOW',
      target: {
        scope: input.roomIds?.length
          ? 'ROOM_SET'
          : input.factionIds?.length
            ? 'GLOBAL'
            : 'GLOBAL',
        roomIds: input.roomIds,
        factionIds: input.factionIds,
      },
      delivery: {
        startsAtMs: nowMs,
        endsAtMs: nowMs + rounds * this.config.defaultDebateRoundSpacingMs,
        revealAtMs: nowMs,
        releaseMode: 'STAGGERED',
        staggerByRoomMs: this.config.defaultDebateRoundSpacingMs,
        staggerBySessionMs: 120,
      },
      heatMultiplierDelta: 0.22,
      shadowChannels: ['LIVEOPS_SHADOW', 'RIVALRY_SHADOW'],
      metadata: {
        preset: 'faction_debate',
        rounds,
        ...(input.metadata ?? {}),
      },
    });
  }

  public publishCoordinatedHaterRaid(input: {
    readonly roomIds?: readonly string[];
    readonly waves?: number;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }): ChatEventFanoutResult {
    const waves = Math.max(1, Math.floor(input.waves ?? 3));
    const nowMs = this.clock.nowMs();
    return this.publishWorldEvent({
      reason: 'COORDINATED_HATER_RAID',
      title: 'Coordinated hater raid detected.',
      body: `Raid pressure is organizing into ${waves} timed waves. Expect swarm timing, not isolated noise.`,
      severity: 'CRITICAL',
      priority: 'URGENT',
      audienceMode: 'VISIBLE_AND_SHADOW',
      target: {
        scope: input.roomIds?.length ? 'ROOM_SET' : 'GLOBAL',
        roomIds: input.roomIds,
      },
      delivery: {
        startsAtMs: nowMs,
        endsAtMs: nowMs + waves * this.config.defaultRaidWaveSpacingMs,
        revealAtMs: nowMs,
        releaseMode: 'STAGGERED',
        staggerByRoomMs: this.config.defaultRaidWaveSpacingMs,
        staggerBySessionMs: 80,
      },
      heatMultiplierDelta: 0.52,
      shadowChannels: ['LIVEOPS_SHADOW', 'RIVALRY_SHADOW', 'NPC_SHADOW'],
      metadata: {
        preset: 'coordinated_hater_raid',
        waves,
        ...(input.metadata ?? {}),
      },
    });
  }

  // ==========================================================================
  // MARK: Scheduling
  // ==========================================================================

  public flushDue(nowMs = this.clock.nowMs()): readonly ChatEventFanoutResult[] {
    this.lastSweepAtMs = nowMs;
    const due = [...this.scheduled.values()]
      .filter((record) => record.releaseAtMs <= nowMs)
      .sort((a, b) => a.releaseAtMs - b.releaseAtMs);

    const results: ChatEventFanoutResult[] = [];
    for (const record of due) {
      this.scheduled.delete(record.signature);
      results.push(this.releaseEvent(record.draft, record.signature, nowMs));
    }

    if (results.length) {
      this.logger.info('chat_event_fanout.flush_due', {
        releasedCount: results.length,
        scheduledRemaining: this.scheduled.size,
      });
    }

    this.pruneDedupeSignatures(nowMs);
    return Object.freeze(results);
  }

  public releaseScheduled(signature: string, nowMs = this.clock.nowMs()): ChatEventFanoutResult | null {
    const record = this.scheduled.get(signature);
    if (!record) return null;

    this.scheduled.delete(signature);
    return this.releaseEvent(record.draft, record.signature, nowMs);
  }

  public cancelScheduled(signature: string, reason = 'manual_cancel'): boolean {
    const record = this.scheduled.get(signature);
    if (!record) return false;

    this.scheduled.delete(signature);
    this.recordAudit({
      auditId: buildAuditId(record.eventId, 'CANCELLED'),
      eventId: record.eventId,
      signature: record.signature,
      reason: record.draft.reason,
      severity: record.draft.severity,
      priority: record.draft.priority,
      phase: 'CANCELLED',
      emittedAt: this.clock.nowIso(),
      targetRooms: [],
      targetSessionsCount: 0,
      revealAt: this.isoOrNull(record.releaseAtMs),
      metadata: {
        reason,
      },
    });

    return true;
  }

  // ==========================================================================
  // MARK: Internal normalization + targeting
  // ==========================================================================

  private normalizeDraft(
    draft: ChatEventFanoutDraft,
    nowMs: number,
  ): NormalizedChatEventFanoutDraft {
    const severity = normalizeSeverity(draft.severity);
    const priority = normalizePriority(draft.priority, severity);
    const audienceMode = normalizeAudienceMode(draft.audienceMode);
    const target = normalizeScope(draft.target);
    const delivery = normalizeWorldEventDeliveryWindow(draft.delivery, nowMs, this.config);
    const metadata = coerceRecord(draft.metadata);
    const eventId = normalizeOptionalString(draft.eventId) ?? this.createEventId(draft.reason);
    const whisperOnly = Boolean(draft.whisperOnly);
    const helperBlackout = Boolean(draft.helperBlackout);
    const heatMultiplierDelta = typeof draft.heatMultiplierDelta === 'number' && Number.isFinite(draft.heatMultiplierDelta)
      ? draft.heatMultiplierDelta
      : this.config.defaultHeatMultiplierDelta;

    const shadowChannels = normalizeShadowChannels(draft.shadowChannels);

    const banner = this.normalizeBanner({
      eventId,
      title: draft.title,
      body: draft.body,
      severity,
      ttlMs: this.config.defaultBannerTtlMs,
      ...(draft.banner ?? {}),
    }, severity);

    const overlay = this.normalizeOverlay({
      eventId,
      headline: draft.title,
      subhead: draft.body,
      reason: draft.reason,
      severity,
      startsAt: this.toIso(delivery.startsAtMs),
      endsAt: this.isoOrNull(delivery.endsAtMs),
      ttlMs: this.config.defaultOverlayTtlMs,
      heatMultiplier: heatMultiplierDelta,
      whisperOnly,
      helperBlackout,
      metadata,
      ...(draft.overlay ?? {}),
    }, severity);

    const policy = this.normalizePolicy({
      eventId,
      whisperOnly,
      helperBlackout,
      heatMultiplierDelta,
      startsAt: this.toIso(delivery.startsAtMs),
      endsAt: this.isoOrNull(delivery.endsAtMs),
      reason: draft.reason,
      metadata,
      ...(draft.policy ?? {}),
    });

    const heat = this.normalizeHeat({
      eventId,
      reason: draft.reason,
      heatMultiplierDelta,
      roomIds: [],
      metadata,
      ...(draft.heat ?? {}),
    });

    return {
      eventId,
      reason: draft.reason,
      title: draft.title.trim(),
      body: draft.body.trim(),
      severity,
      priority,
      audienceMode,
      target,
      delivery,
      banner: this.config.autoPromoteCriticalEventsToBanner && isCriticalLike(severity)
        ? banner
        : draft.banner
          ? banner
          : audienceMode === 'BANNER_ONLY'
            ? banner
            : banner,
      overlay: this.config.autoPromoteCriticalEventsToOverlay && isCriticalLike(severity)
        ? overlay
        : draft.overlay
          ? overlay
          : audienceMode === 'OVERLAY_ONLY'
            ? overlay
            : overlay,
      visiblePayload: draft.visiblePayload ? coerceRecord(draft.visiblePayload) : null,
      policy,
      heat,
      shadowChannels,
      whisperOnly,
      helperBlackout,
      heatMultiplierDelta,
      metadata,
      dedupeKey: normalizeOptionalString(draft.dedupeKey),
      source: normalizeOptionalString(draft.source),
    };
  }

  private normalizeBanner(
    banner: Partial<ChatEventFanoutBannerPayload> | null | undefined,
    severity: ChatEventFanoutSeverity,
  ): ChatEventFanoutBannerPayload | null {
    if (!banner) return null;
    return {
      eventId: banner.eventId ?? randomUUID(),
      title: typeof banner.title === 'string' && banner.title.trim().length
        ? banner.title.trim()
        : 'World event active',
      body: typeof banner.body === 'string' && banner.body.trim().length
        ? banner.body.trim()
        : '',
      severity: normalizeSeverity(banner.severity ?? severity),
      ttlMs: isFinitePositive(banner.ttlMs) ? banner.ttlMs : this.config.defaultBannerTtlMs,
      accent: normalizeOptionalString(banner.accent),
      icon: normalizeOptionalString(banner.icon),
      ctaLabel: normalizeOptionalString(banner.ctaLabel),
      ctaAction: normalizeOptionalString(banner.ctaAction),
      metadata: coerceRecord(banner.metadata),
    };
  }

  private normalizeOverlay(
    overlay: Partial<ChatEventFanoutOverlayPayload> | null | undefined,
    severity: ChatEventFanoutSeverity,
  ): ChatEventFanoutOverlayPayload | null {
    if (!overlay) return null;
    return {
      eventId: overlay.eventId ?? randomUUID(),
      headline: typeof overlay.headline === 'string' && overlay.headline.trim().length
        ? overlay.headline.trim()
        : 'World event active',
      subhead: normalizeOptionalString(overlay.subhead),
      reason: overlay.reason ?? 'CUSTOM',
      severity: normalizeSeverity(overlay.severity ?? severity),
      startsAt: overlay.startsAt ?? this.clock.nowIso(),
      endsAt: normalizeOptionalString(overlay.endsAt ?? null),
      ttlMs: isFinitePositive(overlay.ttlMs) ? overlay.ttlMs : this.config.defaultOverlayTtlMs,
      heatMultiplier:
        typeof overlay.heatMultiplier === 'number' && Number.isFinite(overlay.heatMultiplier)
          ? overlay.heatMultiplier
          : null,
      whisperOnly: Boolean(overlay.whisperOnly),
      helperBlackout: Boolean(overlay.helperBlackout),
      metadata: coerceRecord(overlay.metadata),
    };
  }

  private normalizePolicy(
    policy: Partial<ChatEventFanoutPolicyPayload> | null | undefined,
  ): ChatEventFanoutPolicyPayload | null {
    if (!policy) return null;
    return {
      eventId: policy.eventId ?? randomUUID(),
      whisperOnly: Boolean(policy.whisperOnly),
      helperBlackout: Boolean(policy.helperBlackout),
      heatMultiplierDelta:
        typeof policy.heatMultiplierDelta === 'number' && Number.isFinite(policy.heatMultiplierDelta)
          ? policy.heatMultiplierDelta
          : 0,
      startsAt: policy.startsAt ?? this.clock.nowIso(),
      endsAt: normalizeOptionalString(policy.endsAt ?? null),
      reason: policy.reason ?? 'CUSTOM',
      metadata: coerceRecord(policy.metadata),
    };
  }

  private normalizeHeat(
    heat: Partial<ChatEventFanoutHeatPayload> | null | undefined,
  ): ChatEventFanoutHeatPayload | null {
    if (!heat) return null;
    return {
      eventId: heat.eventId ?? randomUUID(),
      reason: heat.reason ?? 'CUSTOM',
      heatMultiplierDelta:
        typeof heat.heatMultiplierDelta === 'number' && Number.isFinite(heat.heatMultiplierDelta)
          ? heat.heatMultiplierDelta
          : 0,
      roomIds: freezeStrings(heat.roomIds),
      metadata: coerceRecord(heat.metadata),
    };
  }

  private resolveTargets(scope: ChatEventFanoutScopeDescriptor): ResolvedChatEventTargets {
    const sessionBindings: ChatEventFanoutSessionBinding[] = [];

    switch (scope.scope) {
      case 'GLOBAL': {
        sessionBindings.push(...this.bindingsBySession.values());
        break;
      }

      case 'ROOM': {
        if (scope.roomId) sessionBindings.push(...this.getBindingsForRoom(scope.roomId));
        break;
      }

      case 'ROOM_SET': {
        for (const roomId of scope.roomIds ?? []) {
          sessionBindings.push(...this.getBindingsForRoom(roomId));
        }
        break;
      }

      case 'SESSION': {
        if (scope.sessionId) {
          const binding = this.bindingsBySession.get(scope.sessionId);
          if (binding) sessionBindings.push(binding);
        }
        break;
      }

      case 'SESSION_SET': {
        for (const sessionId of scope.sessionIds ?? []) {
          const binding = this.bindingsBySession.get(sessionId);
          if (binding) sessionBindings.push(binding);
        }
        break;
      }

      case 'PLAYER': {
        if (scope.playerId) {
          for (const binding of this.bindingsBySession.values()) {
            if (binding.playerId === scope.playerId) sessionBindings.push(binding);
          }
        }
        break;
      }

      case 'PLAYER_SET': {
        const playerIds = new Set(scope.playerIds ?? []);
        for (const binding of this.bindingsBySession.values()) {
          if (binding.playerId && playerIds.has(binding.playerId)) sessionBindings.push(binding);
        }
        break;
      }

      case 'SYNDICATE': {
        const syndicates = new Set<string>(
          collectUniqueStrings([
            scope.syndicateId,
            ...(scope.syndicateIds ?? []),
          ]),
        );

        for (const binding of this.bindingsBySession.values()) {
          if (binding.syndicateId && syndicates.has(binding.syndicateId)) {
            sessionBindings.push(binding);
          }
        }
        break;
      }

      default: {
        sessionBindings.push(...this.bindingsBySession.values());
        break;
      }
    }

    let filtered = uniqueBySession(sessionBindings);

    if (scope.factionId || scope.factionIds?.length) {
      const factionIds = new Set<string>(
        collectUniqueStrings([scope.factionId, ...(scope.factionIds ?? [])]),
      );
      filtered = uniqueBySession(
        filtered.filter((binding) => Boolean(binding.factionId && factionIds.has(binding.factionId))),
      );
    }

    if (scope.tagsAny?.length) {
      const tags = new Set(scope.tagsAny);
      filtered = uniqueBySession(
        filtered.filter((binding) => binding.tags?.some((tag) => tags.has(tag)) ?? false),
      );
    }

    const roomIds = collectUniqueStrings(filtered.map((binding) => binding.roomId));
    const syndicateIds = collectUniqueStrings(filtered.map((binding) => binding.syndicateId));
    const factionIds = collectUniqueStrings(filtered.map((binding) => binding.factionId));
    const playerIds = collectUniqueStrings(filtered.map((binding) => binding.playerId));

    return {
      roomIds,
      sessions: filtered,
      syndicateIds,
      factionIds,
      playerIds,
    };
  }

  // ==========================================================================
  // MARK: Queue + release
  // ==========================================================================

  private shouldQueue(draft: NormalizedChatEventFanoutDraft, nowMs: number): boolean {
    if (draft.delivery.releaseMode === 'MANUAL_RELEASE') return true;
    if (draft.delivery.releaseMode === 'SCHEDULED') return draft.delivery.startsAtMs > nowMs;
    if (draft.delivery.releaseMode === 'DELAYED_REVEAL') return (draft.delivery.revealAtMs ?? 0) > nowMs;
    return false;
  }

  private queueEvent(
    draft: NormalizedChatEventFanoutDraft,
    signature: string,
    nowMs: number,
  ): ChatEventFanoutResult {
    if (this.scheduled.size >= this.config.maxScheduledEvents) {
      this.evictOldestScheduled();
    }

    const releaseAtMs =
      draft.delivery.releaseMode === 'DELAYED_REVEAL'
        ? draft.delivery.revealAtMs ?? nowMs
        : draft.delivery.startsAtMs;

    this.scheduled.set(signature, {
      eventId: draft.eventId,
      signature,
      draft,
      queuedAtMs: nowMs,
      releaseAtMs,
    });

    const targets = this.resolveTargets(draft.target);
    const audit = this.recordAudit({
      auditId: buildAuditId(draft.eventId, 'QUEUED'),
      eventId: draft.eventId,
      signature,
      reason: draft.reason,
      severity: draft.severity,
      priority: draft.priority,
      phase: 'QUEUED',
      emittedAt: this.clock.nowIso(),
      targetRooms: targets.roomIds,
      targetSessionsCount: targets.sessions.length,
      revealAt: this.isoOrNull(releaseAtMs),
      metadata: {
        audienceMode: draft.audienceMode,
        releaseMode: draft.delivery.releaseMode,
        source: draft.source,
      },
    });

    this.logger.info('chat_event_fanout.queued', {
      eventId: draft.eventId,
      signature,
      releaseAtMs,
      targetRooms: targets.roomIds.length,
      targetSessions: targets.sessions.length,
    });

    return {
      eventId: draft.eventId,
      signature,
      released: false,
      scheduled: true,
      deduped: false,
      targetRoomIds: targets.roomIds,
      targetSessionIds: Object.freeze(targets.sessions.map((session) => session.sessionId)),
      overlayRoomIds: Object.freeze([]),
      bannerSessionIds: Object.freeze([]),
      visibleSessionIds: Object.freeze([]),
      shadowSessionIds: Object.freeze([]),
      revealAt: this.isoOrNull(releaseAtMs),
      emittedAudit: audit,
    };
  }

  private releaseEvent(
    draft: NormalizedChatEventFanoutDraft,
    signature: string,
    nowMs: number,
  ): ChatEventFanoutResult {
    const targets = this.resolveTargets(draft.target);
    const targetSessionIds = Object.freeze(targets.sessions.map((session) => session.sessionId));

    const roomIdsForOverlay = this.shouldEmitOverlay(draft)
      ? targets.roomIds
      : Object.freeze([]);

    const bannerSessionIds = this.shouldEmitBanner(draft)
      ? targetSessionIds
      : Object.freeze([]);

    const visibleSessionIds =
      draft.audienceMode === 'SHADOW_ONLY'
        ? Object.freeze([])
        : targetSessionIds;

    const shadowSessionIds =
      draft.shadowChannels.length && this.config.deliverShadowsToVisibleSessions
        ? targetSessionIds
        : Object.freeze([]);

    if (draft.overlay && roomIdsForOverlay.length) {
      for (const roomId of roomIdsForOverlay) {
        this.emitOverlay(roomId, draft.overlay);
      }
    }

    if (draft.banner && bannerSessionIds.length) {
      for (const sessionId of bannerSessionIds) {
        this.emitBanner(sessionId, draft.banner);
      }
    }

    if (draft.policy && visibleSessionIds.length) {
      for (const sessionId of visibleSessionIds) {
        this.emitter.emitToSession(sessionId, CHAT_EVENT_FANOUT_EVENTS.WORLD_EVENT_POLICY, {
          ...draft.policy,
          roomIds: targets.roomIds,
          factionIds: targets.factionIds,
          syndicateIds: targets.syndicateIds,
        });
      }
    }

    if (draft.heat && targets.roomIds.length) {
      const heatPayload: ChatEventFanoutHeatPayload = {
        ...draft.heat,
        roomIds: targets.roomIds,
      };

      for (const sessionId of visibleSessionIds) {
        this.emitter.emitToSession(sessionId, CHAT_EVENT_FANOUT_EVENTS.WORLD_EVENT_HEAT, heatPayload);
      }
    }

    if (visibleSessionIds.length) {
      const visiblePayload: ChatEventFanoutVisiblePayload = {
        eventId: draft.eventId,
        reason: draft.reason,
        title: draft.title,
        body: draft.body,
        severity: draft.severity,
        priority: draft.priority,
        startsAt: this.toIso(draft.delivery.startsAtMs),
        endsAt: this.isoOrNull(draft.delivery.endsAtMs),
        audienceMode: draft.audienceMode,
        roomIds: targets.roomIds,
        sessionIds: targetSessionIds,
        factionIds: targets.factionIds,
        syndicateIds: targets.syndicateIds,
        metadata: {
          ...draft.metadata,
          ...(draft.visiblePayload ?? {}),
        },
      };

      this.emitVisiblePayloads(draft, targets.sessions, visiblePayload, nowMs);
    }

    if (draft.shadowChannels.length) {
      this.emitShadowPayloads(draft, targets, signature);
    }

    this.signatures.set(signature, nowMs);

    const audit = this.recordAudit({
      auditId: buildAuditId(draft.eventId, 'RELEASED'),
      eventId: draft.eventId,
      signature,
      reason: draft.reason,
      severity: draft.severity,
      priority: draft.priority,
      phase: 'RELEASED',
      emittedAt: this.clock.nowIso(),
      targetRooms: targets.roomIds,
      targetSessionsCount: targetSessionIds.length,
      revealAt: this.isoOrNull(draft.delivery.revealAtMs),
      metadata: {
        source: draft.source,
        audienceMode: draft.audienceMode,
        overlayRooms: roomIdsForOverlay.length,
        bannerSessions: bannerSessionIds.length,
      },
    });

    if (this.config.emitAuditEventsToSessions && visibleSessionIds.length) {
      for (const sessionId of visibleSessionIds) {
        this.emitter.emitToSession(sessionId, CHAT_EVENT_FANOUT_EVENTS.WORLD_EVENT_AUDIT, audit);
      }
    }

    return {
      eventId: draft.eventId,
      signature,
      released: true,
      scheduled: false,
      deduped: false,
      targetRoomIds: targets.roomIds,
      targetSessionIds,
      overlayRoomIds: roomIdsForOverlay,
      bannerSessionIds,
      visibleSessionIds,
      shadowSessionIds,
      revealAt: this.isoOrNull(draft.delivery.revealAtMs),
      emittedAudit: audit,
    };
  }

  private emitVisiblePayloads(
    draft: NormalizedChatEventFanoutDraft,
    sessions: readonly ChatEventFanoutSessionBinding[],
    visiblePayload: ChatEventFanoutVisiblePayload,
    nowMs: number,
  ): void {
    if (!sessions.length) return;

    if (draft.delivery.releaseMode === 'STAGGERED') {
      const byRoom = this.groupSessionsByRoom(sessions);
      const roomIds = [...byRoom.keys()].sort();
      roomIds.forEach((roomId, roomIndex) => {
        const roomSessions = byRoom.get(roomId) ?? [];
        roomSessions.forEach((session, sessionIndex) => {
          const releaseOffsetMs =
            roomIndex * draft.delivery.staggerByRoomMs +
            sessionIndex * draft.delivery.staggerBySessionMs +
            computeSessionJitter(session.sessionId, draft.delivery.jitterMs);

          this.emitter.emitToSession(
            session.sessionId,
            CHAT_EVENT_FANOUT_EVENTS.WORLD_EVENT,
            {
              ...visiblePayload,
              roomId,
              releaseAt: this.toIso(nowMs + releaseOffsetMs),
              releaseOffsetMs,
            },
          );
        });
      });
      return;
    }

    for (const session of sessions) {
      this.emitter.emitToSession(session.sessionId, CHAT_EVENT_FANOUT_EVENTS.WORLD_EVENT, {
        ...visiblePayload,
        roomId: session.roomId,
        releaseAt: this.clock.nowIso(),
        releaseOffsetMs: 0,
      });
    }
  }

  private emitShadowPayloads(
    draft: NormalizedChatEventFanoutDraft,
    targets: ResolvedChatEventTargets,
    signature: string,
  ): void {
    const payloadBase: Omit<ChatEventFanoutShadowPayload, 'channel'> = {
      eventId: draft.eventId,
      reason: draft.reason,
      severity: draft.severity,
      phase: 'RELEASED',
      targets: {
        rooms: targets.roomIds,
        sessions: this.config.includeSessionIdsInAudit
          ? Object.freeze(targets.sessions.map((session) => session.sessionId))
          : undefined,
      },
      revealAt: this.isoOrNull(draft.delivery.revealAtMs),
      metadata: {
        ...draft.metadata,
        signature,
        audienceMode: draft.audienceMode,
        whisperOnly: draft.whisperOnly,
        helperBlackout: draft.helperBlackout,
      },
    };

    if (!this.config.deliverShadowsToVisibleSessions) {
      this.logger.debug('chat_event_fanout.shadow_recorded', {
        eventId: draft.eventId,
        shadowChannels: draft.shadowChannels,
        targetRooms: targets.roomIds.length,
      });
      return;
    }

    for (const session of targets.sessions) {
      for (const channel of draft.shadowChannels) {
        this.emitter.emitToSession(session.sessionId, CHAT_EVENT_FANOUT_EVENTS.WORLD_EVENT_SHADOW, {
          ...payloadBase,
          channel,
        } satisfies ChatEventFanoutShadowPayload);
      }
    }
  }

  private shouldEmitBanner(draft: NormalizedChatEventFanoutDraft): boolean {
    if (!draft.banner) return false;
    return (
      draft.audienceMode === 'VISIBLE' ||
      draft.audienceMode === 'BANNER_ONLY' ||
      draft.audienceMode === 'VISIBLE_AND_SHADOW' ||
      draft.audienceMode === 'WHISPER_ONLY'
    );
  }

  private shouldEmitOverlay(draft: NormalizedChatEventFanoutDraft): boolean {
    if (!draft.overlay) return false;
    return (
      draft.audienceMode === 'VISIBLE' ||
      draft.audienceMode === 'OVERLAY_ONLY' ||
      draft.audienceMode === 'VISIBLE_AND_SHADOW' ||
      draft.audienceMode === 'WHISPER_ONLY'
    );
  }

  private emitOverlay(roomId: string, overlay: ChatEventFanoutOverlayPayload): void {
    this.overlayGateway.publishToRoom(roomId, {
      campaignId: overlay.eventId,
      headline: overlay.headline,
      subhead: overlay.subhead ?? '',
      startsAt: overlay.startsAt,
      endsAt: overlay.endsAt ?? undefined,
      severity: overlay.severity,
      active: true,
      metadata: {
        reason: overlay.reason,
        ttlMs: overlay.ttlMs,
        heatMultiplier: overlay.heatMultiplier,
        whisperOnly: overlay.whisperOnly,
        helperBlackout: overlay.helperBlackout,
        ...(overlay.metadata ?? {}),
      },
    } as unknown);
  }

  private emitBanner(sessionId: string, banner: ChatEventFanoutBannerPayload): void {
    this.emitter.emitToSession(sessionId, CHAT_EVENT_FANOUT_EVENTS.WORLD_EVENT_BANNER, banner);
  }

  // ==========================================================================
  // MARK: Audit + dedupe
  // ==========================================================================

  private isDuplicate(signature: string, nowMs: number): boolean {
    this.pruneDedupeSignatures(nowMs);
    const lastEmittedAtMs = this.signatures.get(signature);
    if (lastEmittedAtMs == null) return false;
    return nowMs - lastEmittedAtMs <= this.config.dedupeWindowMs;
  }

  private pruneDedupeSignatures(nowMs: number): void {
    for (const [signature, emittedAtMs] of this.signatures.entries()) {
      if (nowMs - emittedAtMs > this.config.dedupeWindowMs) {
        this.signatures.delete(signature);
      }
    }
  }

  private recordAudit(record: ChatEventFanoutAuditRecord): ChatEventFanoutAuditRecord {
    this.auditTrail.push(record);
    const overflow = this.auditTrail.length - this.config.maxAuditRecords;
    if (overflow > 0) {
      this.auditTrail.splice(0, overflow);
    }

    this.logger.debug('chat_event_fanout.audit', {
      auditId: record.auditId,
      eventId: record.eventId,
      phase: record.phase,
      targetRooms: record.targetRooms.length,
      targetSessionsCount: record.targetSessionsCount,
    });

    return record;
  }

  private evictOldestScheduled(): void {
    const oldest = [...this.scheduled.values()].sort((a, b) => a.releaseAtMs - b.releaseAtMs)[0];
    if (!oldest) return;

    this.scheduled.delete(oldest.signature);

    this.recordAudit({
      auditId: buildAuditId(oldest.eventId, 'CANCELLED'),
      eventId: oldest.eventId,
      signature: oldest.signature,
      reason: oldest.draft.reason,
      severity: oldest.draft.severity,
      priority: oldest.draft.priority,
      phase: 'CANCELLED',
      emittedAt: this.clock.nowIso(),
      targetRooms: [],
      targetSessionsCount: 0,
      revealAt: this.isoOrNull(oldest.releaseAtMs),
      metadata: {
        reason: 'queue_eviction',
      },
    });

    this.logger.warn('chat_event_fanout.queue_eviction', {
      eventId: oldest.eventId,
      signature: oldest.signature,
      scheduledRemaining: this.scheduled.size,
    });
  }

  // ==========================================================================
  // MARK: Low-level room/session bookkeeping
  // ==========================================================================

  private attachSessionToRoom(sessionId: string, roomId: string): void {
    let roomSessions = this.sessionsByRoom.get(roomId);
    if (!roomSessions) {
      roomSessions = new Set<string>();
      this.sessionsByRoom.set(roomId, roomSessions);
    }

    roomSessions.add(sessionId);

    if (roomSessions.size > this.config.maxBindingsPerRoom) {
      this.logger.warn('chat_event_fanout.room_binding_pressure', {
        roomId,
        bindingCount: roomSessions.size,
        threshold: this.config.maxBindingsPerRoom,
      });
    }
  }

  private detachSessionFromRoom(sessionId: string, roomId: string): void {
    const roomSessions = this.sessionsByRoom.get(roomId);
    if (!roomSessions) return;

    roomSessions.delete(sessionId);
    if (!roomSessions.size) {
      this.sessionsByRoom.delete(roomId);
    }
  }

  private groupSessionsByRoom(
    sessions: readonly ChatEventFanoutSessionBinding[],
  ): ReadonlyMap<string, readonly ChatEventFanoutSessionBinding[]> {
    const grouped = new Map<string, ChatEventFanoutSessionBinding[]>();
    for (const session of sessions) {
      const existing = grouped.get(session.roomId);
      if (existing) {
        existing.push(session);
      } else {
        grouped.set(session.roomId, [session]);
      }
    }

    const frozen = new Map<string, readonly ChatEventFanoutSessionBinding[]>();
    for (const [roomId, roomSessions] of grouped.entries()) {
      frozen.set(
        roomId,
        Object.freeze([...roomSessions].sort((left, right) => left.sessionId.localeCompare(right.sessionId))),
      );
    }
    return frozen;
  }

  private createEventId(reason: ChatEventFanoutReason): string {
    return `world:${reason.toLowerCase()}:${this.clock.nowMs()}:${randomUUID()}`;
  }

  private toIso(valueMs: number): string {
    return new Date(valueMs).toISOString();
  }

  private isoOrNull(valueMs: number | null | undefined): string | null {
    return typeof valueMs === 'number' && Number.isFinite(valueMs)
      ? new Date(valueMs).toISOString()
      : null;
  }
}

// ============================================================================
// MARK: Helpers
// ============================================================================

function normalizeShadowChannels(
  values: readonly ChatEventFanoutShadowChannel[] | null | undefined,
): readonly ChatEventFanoutShadowChannel[] {
  const output = new Set<ChatEventFanoutShadowChannel>();
  for (const value of values ?? []) {
    switch (value) {
      case 'SYSTEM_SHADOW':
      case 'NPC_SHADOW':
      case 'RIVALRY_SHADOW':
      case 'RESCUE_SHADOW':
      case 'LIVEOPS_SHADOW':
        output.add(value);
        break;
      default:
        break;
    }
  }
  return Object.freeze([...output]);
}

function computeSessionJitter(sessionId: string, maxJitterMs: number): number {
  if (maxJitterMs <= 0) return 0;
  const digest = fnv1aHex(sessionId);
  const numeric = Number.parseInt(digest.slice(0, 6), 16);
  return Math.abs(numeric % (maxJitterMs + 1));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isFinitePositive(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isFiniteNonNegative(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

// ============================================================================
// MARK: Convenience factories
// ============================================================================

export function createChatEventFanout(deps: ConstructorParameters<typeof ChatEventFanout>[0]): ChatEventFanout {
  return new ChatEventFanout(deps);
}

export function createChatEventFanoutNoopEmitter(): ChatEventFanoutEmitter {
  return {
    emitToSession: () => undefined,
    emitToRoom: () => undefined,
    emitToRooms: () => undefined,
  };
}
