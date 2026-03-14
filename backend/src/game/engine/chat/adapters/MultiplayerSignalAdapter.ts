/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT MULTIPLAYER SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/MultiplayerSignalAdapter.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates multiplayer room truth,
 * membership truth, party/co-op truth, and ranking pressure truth into
 * authoritative backend chat multiplayer signals.
 *
 * Backend-truth question
 * ----------------------
 *   "When room membership changes, players reconnect, spectate, lock, form
 *    co-op or sabotage contracts, or a faction table becomes socially tense,
 *    what exact multiplayer-native chat signal should the authoritative
 *    backend chat engine ingest?"
 *
 * Repo truths preserved
 * ---------------------
 * - pzo-server/src/multiplayer/contracts.ts already exposes co-op contract
 *   truth with assist / sabotage semantics and audit hash support.
 * - pzo-server/src/multiplayer/player.ts already defines the minimal live
 *   player surface with ACTIVE / SUSPENDED / DISCONNECTED / SPECTATING.
 * - pzo-server/src/ws/room-manager.ts and socket-server.ts remain transport /
 *   room plumbing; they do not become final chat truth.
 * - pzo-web/src/engines/chat and the frozen frontend donor lane already treat
 *   crowd presence, faction intimacy, and social pressure as chat-worthy
 *   inputs, but they are not the final authority.
 *
 * Therefore this file owns:
 * - multiplayer payload compatibility and migration shielding,
 * - room/member/party/co-op signal normalization,
 * - faction-pressure and ranking-pressure derivation,
 * - visible-channel recommendation for social witness,
 * - dedupe and saturation control,
 * - explainable adapter diagnostics,
 * - and batch translation into ChatInputEnvelope values.
 *
 * It does not own:
 * - transcript mutation,
 * - moderation,
 * - rate law,
 * - socket fanout,
 * - replay persistence,
 * - or final NPC/helper/hater speech.
 *
 * Design laws
 * -----------
 * - Preserve multiplayer words. Do not genericize them.
 * - Membership change is not automatically transcript-worthy.
 * - Spectating is social pressure, not just a boolean.
 * - Syndicate / faction intimacy must route differently from global room churn.
 * - Co-op assist and sabotage are social truths even before a message exists.
 * - The adapter may describe social heat; orchestrators still decide speech.
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  clamp100,
  type ChatInputEnvelope,
  type ChatMultiplayerSnapshot,
  type ChatRoomId,
  type ChatSignalEnvelope,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type Score01,
  type Score100,
  type UnixMs,
} from '../types';

// ============================================================================
// MARK: Logger, clock, options, and context
// ============================================================================

export interface MultiplayerSignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface MultiplayerSignalAdapterClock {
  now(): UnixMs;
}

export interface MultiplayerSignalAdapterOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly dedupeWindowMs?: number;
  readonly maxHistory?: number;
  readonly includeShadowMetadata?: boolean;
  readonly roomSurgeWitnessThreshold?: number;
  readonly rankingPressureEscalationThreshold?: number;
  readonly logger?: MultiplayerSignalAdapterLogger;
  readonly clock?: MultiplayerSignalAdapterClock;
}

export interface MultiplayerSignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export type MultiplayerSignalAdapterSeverity =
  | 'DEBUG'
  | 'INFO'
  | 'WARN'
  | 'CRITICAL';

export type MultiplayerSignalAdapterNarrativeWeight =
  | 'AMBIENT'
  | 'TACTICAL'
  | 'INTIMATE'
  | 'PREDATORY'
  | 'CEREMONIAL';

export type MultiplayerSignalAdapterEventName =
  | 'multiplayer.room.joined'
  | 'multiplayer.room.left'
  | 'multiplayer.room.updated'
  | 'multiplayer.player.updated'
  | 'multiplayer.party.updated'
  | 'multiplayer.contract.created'
  | 'multiplayer.contract.resolved'
  | 'multiplayer.faction.updated'
  | 'multiplayer.spectators.updated'
  | 'ROOM_JOINED'
  | 'ROOM_LEFT'
  | 'ROOM_UPDATED'
  | 'PLAYER_UPDATED'
  | 'PARTY_UPDATED'
  | 'COOP_CONTRACT_CREATED'
  | 'COOP_CONTRACT_RESOLVED'
  | 'FACTION_UPDATED'
  | 'SPECTATORS_UPDATED'
  | string;

// ============================================================================
// MARK: Multiplayer compatibility surfaces
// ============================================================================

export type MultiplayerPlayerStatusCompat =
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'DISCONNECTED'
  | 'SPECTATING'
  | 'RECONNECTING'
  | 'HIDDEN'
  | string;

export type MultiplayerContractTypeCompat =
  | 'assist'
  | 'sabotage'
  | 'ASSIST'
  | 'SABOTAGE'
  | string;

export interface MultiplayerPlayerCompat {
  readonly id?: string | null;
  readonly playerId?: string | null;
  readonly username?: string | null;
  readonly displayName?: string | null;
  readonly status?: MultiplayerPlayerStatusCompat | null;
  readonly sessionStart?: number | null;
  readonly joinedAt?: number | null;
  readonly turnsLocked?: number | null;
  readonly factionName?: string | null;
  readonly role?: string | null;
  readonly score?: number | null;
  readonly rank?: number | null;
  readonly reputation?: number | null;
  readonly metadata?: Readonly<Record<string, JsonValue>> | null;
}

export interface MultiplayerPartyCompat {
  readonly partyId?: string | null;
  readonly leaderPlayerId?: string | null;
  readonly memberIds?: readonly string[] | null;
  readonly maxSize?: number | null;
  readonly locked?: boolean | null;
}

export interface MultiplayerRoomCompat {
  readonly roomId?: string | null;
  readonly roomKind?: string | null;
  readonly memberCount?: number | null;
  readonly members?: readonly MultiplayerPlayerCompat[] | null;
  readonly partySize?: number | null;
  readonly parties?: readonly MultiplayerPartyCompat[] | null;
  readonly spectatingCount?: number | null;
  readonly factionName?: string | null;
  readonly rankingPressure?: number | null;
  readonly occupancyCap?: number | null;
  readonly hotStreakCount?: number | null;
  readonly mode?: string | null;
  readonly emittedAt?: number | null;
  readonly metadata?: Readonly<Record<string, JsonValue>> | null;
}

export interface MultiplayerContractCompat {
  readonly contractId?: string | null;
  readonly type?: MultiplayerContractTypeCompat | null;
  readonly targetPlayerId?: string | null;
  readonly initiatorPlayerId?: string | null;
  readonly assistGiftTokenId?: string | null;
  readonly sabotageTokenId?: string | null;
  readonly mlEnabled?: boolean | null;
  readonly auditHash?: string | null;
  readonly createdAt?: number | null;
  readonly resolvedAt?: number | null;
}

export interface MultiplayerRoomJoinedPayloadCompat {
  readonly roomId?: string | null;
  readonly player?: MultiplayerPlayerCompat | null;
  readonly room?: MultiplayerRoomCompat | null;
}

export interface MultiplayerRoomLeftPayloadCompat {
  readonly roomId?: string | null;
  readonly player?: MultiplayerPlayerCompat | null;
  readonly room?: MultiplayerRoomCompat | null;
  readonly reason?: string | null;
}

export interface MultiplayerPlayerUpdatedPayloadCompat {
  readonly roomId?: string | null;
  readonly previous?: MultiplayerPlayerCompat | null;
  readonly current?: MultiplayerPlayerCompat | null;
  readonly delta?: Readonly<Record<string, JsonValue>> | null;
}

export interface MultiplayerPartyUpdatedPayloadCompat {
  readonly roomId?: string | null;
  readonly previous?: MultiplayerPartyCompat | null;
  readonly current?: MultiplayerPartyCompat | null;
  readonly room?: MultiplayerRoomCompat | null;
}

export interface MultiplayerContractPayloadCompat {
  readonly roomId?: string | null;
  readonly contract?: MultiplayerContractCompat | null;
  readonly room?: MultiplayerRoomCompat | null;
}

export interface MultiplayerFactionUpdatedPayloadCompat {
  readonly roomId?: string | null;
  readonly factionName?: string | null;
  readonly rankingPressure?: number | null;
  readonly memberCount?: number | null;
  readonly spectatingCount?: number | null;
  readonly room?: MultiplayerRoomCompat | null;
}

export interface MultiplayerSpectatorUpdatedPayloadCompat {
  readonly roomId?: string | null;
  readonly spectatingCount?: number | null;
  readonly room?: MultiplayerRoomCompat | null;
}

export interface MultiplayerSnapshotCompat {
  readonly roomId?: string | null;
  readonly roomKind?: string | null;
  readonly members?: readonly MultiplayerPlayerCompat[] | null;
  readonly memberCount?: number | null;
  readonly parties?: readonly MultiplayerPartyCompat[] | null;
  readonly partySize?: number | null;
  readonly spectatingCount?: number | null;
  readonly factionName?: string | null;
  readonly rankingPressure?: number | null;
  readonly mode?: string | null;
  readonly emittedAt?: number | null;
  readonly metadata?: Readonly<Record<string, JsonValue>> | null;
}

// ============================================================================
// MARK: Accepted, deduped, rejected, history, state, and report
// ============================================================================

export interface MultiplayerSignalAdapterAccepted {
  readonly dedupeKey: string;
  readonly eventName: MultiplayerSignalAdapterEventName;
  readonly severity: MultiplayerSignalAdapterSeverity;
  readonly narrativeWeight: MultiplayerSignalAdapterNarrativeWeight;
  readonly routeChannel: ChatVisibleChannel;
  readonly envelope: ChatInputEnvelope;
  readonly signal: ChatSignalEnvelope;
  readonly snapshot: ChatMultiplayerSnapshot;
  readonly diagnostics: Readonly<Record<string, JsonValue>>;
}

export interface MultiplayerSignalAdapterDeduped {
  readonly dedupeKey: string;
  readonly eventName: MultiplayerSignalAdapterEventName;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface MultiplayerSignalAdapterRejected {
  readonly eventName: MultiplayerSignalAdapterEventName;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface MultiplayerSignalAdapterHistoryEntry {
  readonly id: string;
  readonly ts: UnixMs;
  readonly roomId: ChatRoomId;
  readonly eventName: MultiplayerSignalAdapterEventName;
  readonly routeChannel: ChatVisibleChannel;
  readonly severity: MultiplayerSignalAdapterSeverity;
  readonly narrativeWeight: MultiplayerSignalAdapterNarrativeWeight;
  readonly memberCount: number;
  readonly partySize: number;
  readonly spectatingCount: number;
  readonly rankingPressure100: Score100;
  readonly factionName: Nullable<string>;
  readonly dedupeKey: string;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface MultiplayerSignalAdapterState {
  readonly history: readonly MultiplayerSignalAdapterHistoryEntry[];
  readonly acceptedCount: number;
  readonly dedupedCount: number;
  readonly rejectedCount: number;
  readonly lastRankingPressure100: Score100;
  readonly lastMemberCount: number;
}

export interface MultiplayerSignalAdapterReport {
  readonly accepted: readonly MultiplayerSignalAdapterAccepted[];
  readonly deduped: readonly MultiplayerSignalAdapterDeduped[];
  readonly rejected: readonly MultiplayerSignalAdapterRejected[];
}

// ============================================================================
// MARK: Defaults and constants
// ============================================================================

const DEFAULT_MULTIPLAYER_SIGNAL_ADAPTER_OPTIONS = Object.freeze({
  defaultVisibleChannel: 'LOBBY' as ChatVisibleChannel,
  dedupeWindowMs: 2_500,
  maxHistory: 256,
  includeShadowMetadata: true,
  roomSurgeWitnessThreshold: 4,
  rankingPressureEscalationThreshold: 68,
});

const CHANNEL_PRIORITY: Record<ChatVisibleChannel, number> = Object.freeze({
  GLOBAL: 4,
  SYNDICATE: 3,
  DEAL_ROOM: 2,
  LOBBY: 1,
});

const ROOM_KIND_TO_CHANNEL: Readonly<Record<string, ChatVisibleChannel>> = Object.freeze({
  GLOBAL: 'GLOBAL',
  SYNDICATE: 'SYNDICATE',
  DEAL_ROOM: 'DEAL_ROOM',
  LOBBY: 'LOBBY',
  PRIVATE: 'LOBBY',
  SYSTEM: 'GLOBAL',
});

// ============================================================================
// MARK: Generic helpers
// ============================================================================

function defaultClock(): MultiplayerSignalAdapterClock {
  return {
    now: () => asUnixMs(Date.now()),
  };
}

function defaultLogger(): MultiplayerSignalAdapterLogger {
  return {
    debug: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asRoomId(value: ChatRoomId | string): ChatRoomId {
  return String(value) as ChatRoomId;
}

function resolveVisibleChannel(
  preferred: Nullable<ChatVisibleChannel>,
  roomKind: Nullable<string>,
  fallback: ChatVisibleChannel,
): ChatVisibleChannel {
  if (preferred) return preferred;
  const mapped = roomKind ? ROOM_KIND_TO_CHANNEL[roomKind.toUpperCase()] : null;
  return mapped ?? fallback;
}

function resolveSeverity(args: {
  readonly rankingPressure100: Score100;
  readonly spectatingCount: number;
  readonly contractType: Nullable<string>;
  readonly lockCount: number;
}): MultiplayerSignalAdapterSeverity {
  const contractUpper = args.contractType?.toUpperCase() ?? null;
  if (contractUpper === 'SABOTAGE') return 'CRITICAL';
  if (args.lockCount > 0) return 'WARN';
  if (args.rankingPressure100 >= clamp100(80)) return 'WARN';
  if (args.spectatingCount >= 6) return 'WARN';
  if (args.rankingPressure100 >= clamp100(55)) return 'INFO';
  return 'DEBUG';
}

function resolveNarrativeWeight(args: {
  readonly routeChannel: ChatVisibleChannel;
  readonly rankingPressure100: Score100;
  readonly contractType: Nullable<string>;
  readonly roomSurge: boolean;
}): MultiplayerSignalAdapterNarrativeWeight {
  const contractUpper = args.contractType?.toUpperCase() ?? null;
  if (contractUpper === 'SABOTAGE') return 'PREDATORY';
  if (contractUpper === 'ASSIST') return 'CEREMONIAL';
  if (args.routeChannel === 'SYNDICATE') return 'INTIMATE';
  if (args.roomSurge || args.rankingPressure100 >= clamp100(60)) return 'TACTICAL';
  return 'AMBIENT';
}

function stableKey(record: Readonly<Record<string, JsonValue>>): string {
  const keys = Object.keys(record).sort();
  return keys
    .map((key) => `${key}:${JSON.stringify(record[key])}`)
    .join('|');
}

function buildMetadata(
  base: Readonly<Record<string, JsonValue>>,
  additions?: Readonly<Record<string, JsonValue>>,
): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    ...base,
    ...(additions ?? {}),
  });
}

function countLockedMembers(members: readonly MultiplayerPlayerCompat[]): number {
  return members.reduce(
    (sum, member) => sum + (toFiniteNumber(member.turnsLocked, 0) > 0 ? 1 : 0),
    0,
  );
}

function normalizePlayerStatus(status: Nullable<string>): MultiplayerPlayerStatusCompat {
  const upper = status?.trim().toUpperCase() ?? 'ACTIVE';
  switch (upper) {
    case 'ACTIVE':
    case 'SUSPENDED':
    case 'DISCONNECTED':
    case 'SPECTATING':
    case 'RECONNECTING':
    case 'HIDDEN':
      return upper;
    default:
      return upper;
  }
}

function computeRankingPressure100(snapshot: {
  readonly rankingPressure?: number | null;
  readonly spectatingCount?: number | null;
  readonly lockedMembers?: number | null;
  readonly memberCount?: number | null;
  readonly partySize?: number | null;
}): Score100 {
  const explicit = toFiniteNumber(snapshot.rankingPressure, NaN);
  if (Number.isFinite(explicit)) {
    return clamp100(explicit);
  }

  const spectating = toFiniteNumber(snapshot.spectatingCount, 0);
  const locked = toFiniteNumber(snapshot.lockedMembers, 0);
  const members = Math.max(0, toFiniteNumber(snapshot.memberCount, 0));
  const party = Math.max(0, toFiniteNumber(snapshot.partySize, 0));

  const occupancyPressure = members <= 0 ? 0 : Math.min(40, members * 4.5);
  const spectatorPressure = Math.min(30, spectating * 5);
  const lockPressure = Math.min(20, locked * 6);
  const partyPressure = party >= 4 ? 10 : party >= 2 ? 5 : 0;

  return clamp100(occupancyPressure + spectatorPressure + lockPressure + partyPressure);
}

function computeFactionName(
  explicitFactionName: Nullable<string>,
  members: readonly MultiplayerPlayerCompat[],
): string | null {
  const direct = toOptionalString(explicitFactionName);
  if (direct) return direct;

  const histogram = new Map<string, number>();
  for (const member of members) {
    const faction = toOptionalString(member.factionName);
    if (!faction) continue;
    histogram.set(faction, (histogram.get(faction) ?? 0) + 1);
  }

  let winner: string | null = null;
  let winnerCount = 0;
  for (const [name, count] of histogram.entries()) {
    if (count > winnerCount) {
      winner = name;
      winnerCount = count;
    }
  }
  return winner;
}

function computePartySize(
  explicitPartySize: number | null | undefined,
  parties: readonly MultiplayerPartyCompat[],
): number {
  const direct = Math.max(0, Math.floor(toFiniteNumber(explicitPartySize, NaN)));
  if (Number.isFinite(direct) && direct > 0) return direct;

  let largest = 0;
  for (const party of parties) {
    const size = Array.isArray(party.memberIds) ? party.memberIds.length : 0;
    if (size > largest) largest = size;
  }
  return largest;
}

function toPlayerArray(value: unknown): readonly MultiplayerPlayerCompat[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is MultiplayerPlayerCompat => !!entry && typeof entry === 'object');
}

function toPartyArray(value: unknown): readonly MultiplayerPartyCompat[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is MultiplayerPartyCompat => !!entry && typeof entry === 'object');
}

function resolveMemberCount(
  explicitMemberCount: number | null | undefined,
  members: readonly MultiplayerPlayerCompat[],
): number {
  const direct = Math.max(0, Math.floor(toFiniteNumber(explicitMemberCount, NaN)));
  if (Number.isFinite(direct) && direct > 0) return direct;
  return members.length;
}

function estimateSpectatingCount(
  explicitSpectatingCount: number | null | undefined,
  members: readonly MultiplayerPlayerCompat[],
): number {
  const direct = Math.max(0, Math.floor(toFiniteNumber(explicitSpectatingCount, NaN)));
  if (Number.isFinite(direct)) return direct;
  return members.filter((member) => normalizePlayerStatus(member.status ?? null) === 'SPECTATING').length;
}

function computeRoomSurge(
  previousMemberCount: number,
  currentMemberCount: number,
  threshold: number,
): boolean {
  return currentMemberCount - previousMemberCount >= Math.max(1, threshold);
}

function isWorthVisibleWitness(args: {
  readonly severity: MultiplayerSignalAdapterSeverity;
  readonly routeChannel: ChatVisibleChannel;
  readonly roomSurge: boolean;
  readonly rankingPressure100: Score100;
  readonly memberCount: number;
}): boolean {
  if (args.severity === 'CRITICAL') return true;
  if (args.routeChannel === 'SYNDICATE' && args.memberCount >= 2) return true;
  if (args.roomSurge) return true;
  if (args.rankingPressure100 >= clamp100(60)) return true;
  return args.severity !== 'DEBUG';
}

function sanitizeEventName(eventName: string): MultiplayerSignalAdapterEventName {
  return (typeof eventName === 'string' && eventName.trim().length > 0
    ? eventName.trim()
    : 'ROOM_UPDATED') as MultiplayerSignalAdapterEventName;
}

// ============================================================================
// MARK: Snapshot normalization
// ============================================================================

interface NormalizedMultiplayerModel {
  readonly roomId: ChatRoomId;
  readonly routeChannel: ChatVisibleChannel;
  readonly memberCount: number;
  readonly partySize: number;
  readonly spectatingCount: number;
  readonly factionName: Nullable<string>;
  readonly rankingPressure100: Score100;
  readonly lockedMembers: number;
  readonly members: readonly MultiplayerPlayerCompat[];
  readonly parties: readonly MultiplayerPartyCompat[];
  readonly roomKind: Nullable<string>;
}

function normalizeMultiplayerModel(args: {
  readonly roomId: ChatRoomId;
  readonly roomKind: Nullable<string>;
  readonly members?: readonly MultiplayerPlayerCompat[] | null;
  readonly memberCount?: number | null;
  readonly parties?: readonly MultiplayerPartyCompat[] | null;
  readonly partySize?: number | null;
  readonly spectatingCount?: number | null;
  readonly factionName?: string | null;
  readonly rankingPressure?: number | null;
  readonly routeChannel: ChatVisibleChannel;
}): NormalizedMultiplayerModel {
  const members = args.members ? [...args.members] : [];
  const parties = args.parties ? [...args.parties] : [];
  const memberCount = resolveMemberCount(args.memberCount, members);
  const spectatingCount = estimateSpectatingCount(args.spectatingCount, members);
  const partySize = computePartySize(args.partySize, parties);
  const lockedMembers = countLockedMembers(members);
  const factionName = computeFactionName(args.factionName ?? null, members);
  const rankingPressure100 = computeRankingPressure100({
    rankingPressure: args.rankingPressure,
    spectatingCount,
    lockedMembers,
    memberCount,
    partySize,
  });

  return Object.freeze({
    roomId: args.roomId,
    routeChannel: args.routeChannel,
    memberCount,
    partySize,
    spectatingCount,
    factionName,
    rankingPressure100,
    lockedMembers,
    members,
    parties,
    roomKind: args.roomKind ?? null,
  });
}

function toChatSnapshot(model: NormalizedMultiplayerModel): ChatMultiplayerSnapshot {
  return Object.freeze({
    roomMemberCount: model.memberCount,
    partySize: model.partySize,
    spectatingCount: model.spectatingCount,
    factionName: model.factionName,
    rankingPressure: model.rankingPressure100,
  });
}

// ============================================================================
// MARK: Adapter class
// ============================================================================

export class MultiplayerSignalAdapter {
  private readonly logger: MultiplayerSignalAdapterLogger;
  private readonly clock: MultiplayerSignalAdapterClock;
  private readonly defaultRoomId: ChatRoomId;
  private readonly defaultVisibleChannel: ChatVisibleChannel;
  private readonly dedupeWindowMs: number;
  private readonly maxHistory: number;
  private readonly includeShadowMetadata: boolean;
  private readonly roomSurgeWitnessThreshold: number;
  private readonly rankingPressureEscalationThreshold: number;

  private readonly dedupeMap = new Map<string, UnixMs>();
  private readonly history: MultiplayerSignalAdapterHistoryEntry[] = [];
  private acceptedCount = 0;
  private dedupedCount = 0;
  private rejectedCount = 0;
  private lastRankingPressure100: Score100 = clamp100(0);
  private lastMemberCount = 0;

  public constructor(options: MultiplayerSignalAdapterOptions) {
    this.logger = options.logger ?? defaultLogger();
    this.clock = options.clock ?? defaultClock();
    this.defaultRoomId = asRoomId(options.defaultRoomId);
    this.defaultVisibleChannel =
      options.defaultVisibleChannel ??
      DEFAULT_MULTIPLAYER_SIGNAL_ADAPTER_OPTIONS.defaultVisibleChannel;
    this.dedupeWindowMs =
      options.dedupeWindowMs ?? DEFAULT_MULTIPLAYER_SIGNAL_ADAPTER_OPTIONS.dedupeWindowMs;
    this.maxHistory =
      options.maxHistory ?? DEFAULT_MULTIPLAYER_SIGNAL_ADAPTER_OPTIONS.maxHistory;
    this.includeShadowMetadata =
      options.includeShadowMetadata ??
      DEFAULT_MULTIPLAYER_SIGNAL_ADAPTER_OPTIONS.includeShadowMetadata;
    this.roomSurgeWitnessThreshold =
      options.roomSurgeWitnessThreshold ??
      DEFAULT_MULTIPLAYER_SIGNAL_ADAPTER_OPTIONS.roomSurgeWitnessThreshold;
    this.rankingPressureEscalationThreshold =
      options.rankingPressureEscalationThreshold ??
      DEFAULT_MULTIPLAYER_SIGNAL_ADAPTER_OPTIONS.rankingPressureEscalationThreshold;
  }

  public reset(): void {
    this.dedupeMap.clear();
    this.history.length = 0;
    this.acceptedCount = 0;
    this.dedupedCount = 0;
    this.rejectedCount = 0;
    this.lastRankingPressure100 = clamp100(0);
    this.lastMemberCount = 0;
  }

  public getState(): MultiplayerSignalAdapterState {
    return Object.freeze({
      history: this.history.slice(),
      acceptedCount: this.acceptedCount,
      dedupedCount: this.dedupedCount,
      rejectedCount: this.rejectedCount,
      lastRankingPressure100: this.lastRankingPressure100,
      lastMemberCount: this.lastMemberCount,
    });
  }

  public adaptEvent(
    eventName: MultiplayerSignalAdapterEventName,
    payload: unknown,
    context?: MultiplayerSignalAdapterContext,
  ): MultiplayerSignalAdapterReport {
    this.evictExpiredDedupe();
    const now = this.resolveEventTime(context?.emittedAt);
    const sanitizedEventName = sanitizeEventName(eventName);

    switch (sanitizedEventName) {
      case 'multiplayer.room.joined':
      case 'ROOM_JOINED':
        return this.adaptRoomJoined(
          sanitizedEventName,
          payload as MultiplayerRoomJoinedPayloadCompat,
          now,
          context,
        );
      case 'multiplayer.room.left':
      case 'ROOM_LEFT':
        return this.adaptRoomLeft(
          sanitizedEventName,
          payload as MultiplayerRoomLeftPayloadCompat,
          now,
          context,
        );
      case 'multiplayer.room.updated':
      case 'ROOM_UPDATED':
        return this.adaptRoomUpdated(
          sanitizedEventName,
          payload as MultiplayerRoomCompat,
          now,
          context,
        );
      case 'multiplayer.player.updated':
      case 'PLAYER_UPDATED':
        return this.adaptPlayerUpdated(
          sanitizedEventName,
          payload as MultiplayerPlayerUpdatedPayloadCompat,
          now,
          context,
        );
      case 'multiplayer.party.updated':
      case 'PARTY_UPDATED':
        return this.adaptPartyUpdated(
          sanitizedEventName,
          payload as MultiplayerPartyUpdatedPayloadCompat,
          now,
          context,
        );
      case 'multiplayer.contract.created':
      case 'COOP_CONTRACT_CREATED':
        return this.adaptContractEvent(
          sanitizedEventName,
          payload as MultiplayerContractPayloadCompat,
          now,
          context,
        );
      case 'multiplayer.contract.resolved':
      case 'COOP_CONTRACT_RESOLVED':
        return this.adaptContractEvent(
          sanitizedEventName,
          payload as MultiplayerContractPayloadCompat,
          now,
          context,
        );
      case 'multiplayer.faction.updated':
      case 'FACTION_UPDATED':
        return this.adaptFactionUpdated(
          sanitizedEventName,
          payload as MultiplayerFactionUpdatedPayloadCompat,
          now,
          context,
        );
      case 'multiplayer.spectators.updated':
      case 'SPECTATORS_UPDATED':
        return this.adaptSpectatorUpdated(
          sanitizedEventName,
          payload as MultiplayerSpectatorUpdatedPayloadCompat,
          now,
          context,
        );
      default:
        this.rejectedCount += 1;
        return Object.freeze({
          accepted: [],
          deduped: [],
          rejected: [
            {
              eventName: sanitizedEventName,
              reason: 'UNSUPPORTED_MULTIPLAYER_EVENT',
              details: buildMetadata({ eventName: sanitizedEventName }, context?.metadata),
            },
          ],
        });
    }
  }

  public adaptSnapshot(
    snapshot: MultiplayerSnapshotCompat,
    context?: MultiplayerSignalAdapterContext,
  ): MultiplayerSignalAdapterReport {
    this.evictExpiredDedupe();

    const roomId = this.resolveRoomId(snapshot.roomId ?? context?.roomId);
    const routeChannel = resolveVisibleChannel(
      context?.routeChannel ?? null,
      snapshot.roomKind ?? null,
      this.defaultVisibleChannel,
    );
    const emittedAt = this.resolveEventTime(snapshot.emittedAt ?? context?.emittedAt);

    const normalized = normalizeMultiplayerModel({
      roomId,
      roomKind: snapshot.roomKind ?? null,
      members: snapshot.members ?? null,
      memberCount: snapshot.memberCount ?? null,
      parties: snapshot.parties ?? null,
      partySize: snapshot.partySize ?? null,
      spectatingCount: snapshot.spectatingCount ?? null,
      factionName: snapshot.factionName ?? null,
      rankingPressure: snapshot.rankingPressure ?? null,
      routeChannel,
    });

    const roomSurge = computeRoomSurge(
      this.lastMemberCount,
      normalized.memberCount,
      this.roomSurgeWitnessThreshold,
    );
    const severity = resolveSeverity({
      rankingPressure100: normalized.rankingPressure100,
      spectatingCount: normalized.spectatingCount,
      contractType: null,
      lockCount: normalized.lockedMembers,
    });
    const narrativeWeight = resolveNarrativeWeight({
      routeChannel,
      rankingPressure100: normalized.rankingPressure100,
      contractType: null,
      roomSurge,
    });

    return this.acceptOrDedupe({
      eventName: 'ROOM_UPDATED',
      roomId,
      routeChannel,
      emittedAt,
      snapshot: toChatSnapshot(normalized),
      severity,
      narrativeWeight,
      metadata: buildMetadata(
        {
          source: context?.source ?? 'MultiplayerSignalAdapter.snapshot',
          roomKind: normalized.roomKind,
          memberCount: normalized.memberCount,
          partySize: normalized.partySize,
          spectatingCount: normalized.spectatingCount,
          factionName: normalized.factionName,
          rankingPressure100: normalized.rankingPressure100,
          lockedMembers: normalized.lockedMembers,
          roomSurge,
          witnessRecommended: isWorthVisibleWitness({
            severity,
            routeChannel,
            roomSurge,
            rankingPressure100: normalized.rankingPressure100,
            memberCount: normalized.memberCount,
          }),
        },
        buildMetadataFromContext(context),
      ),
    });
  }

  public adaptMany(
    events: ReadonlyArray<{
      readonly eventName: MultiplayerSignalAdapterEventName;
      readonly payload: unknown;
      readonly context?: MultiplayerSignalAdapterContext;
    }>,
  ): MultiplayerSignalAdapterReport {
    const accepted: MultiplayerSignalAdapterAccepted[] = [];
    const deduped: MultiplayerSignalAdapterDeduped[] = [];
    const rejected: MultiplayerSignalAdapterRejected[] = [];

    for (const event of events) {
      const report = this.adaptEvent(event.eventName, event.payload, event.context);
      accepted.push(...report.accepted);
      deduped.push(...report.deduped);
      rejected.push(...report.rejected);
    }

    return Object.freeze({ accepted, deduped, rejected });
  }

  // ---------------------------------------------------------------------------
  // Event-specific adapters
  // ---------------------------------------------------------------------------

  private adaptRoomJoined(
    eventName: MultiplayerSignalAdapterEventName,
    payload: MultiplayerRoomJoinedPayloadCompat,
    emittedAt: UnixMs,
    context?: MultiplayerSignalAdapterContext,
  ): MultiplayerSignalAdapterReport {
    const room = payload.room ?? null;
    const player = payload.player ?? null;
    const roomId = this.resolveRoomId(room?.roomId ?? payload.roomId ?? context?.roomId);
    const routeChannel = resolveVisibleChannel(
      context?.routeChannel ?? null,
      room?.roomKind ?? null,
      this.defaultVisibleChannel,
    );
    const normalized = normalizeMultiplayerModel({
      roomId,
      roomKind: room?.roomKind ?? null,
      members: room?.members ?? (player ? [player] : []),
      memberCount: room?.memberCount ?? null,
      parties: room?.parties ?? null,
      partySize: room?.partySize ?? null,
      spectatingCount: room?.spectatingCount ?? null,
      factionName: room?.factionName ?? player?.factionName ?? null,
      rankingPressure: room?.rankingPressure ?? player?.rank ?? null,
      routeChannel,
    });
    const roomSurge = computeRoomSurge(
      this.lastMemberCount,
      normalized.memberCount,
      this.roomSurgeWitnessThreshold,
    );
    const severity = resolveSeverity({
      rankingPressure100: normalized.rankingPressure100,
      spectatingCount: normalized.spectatingCount,
      contractType: null,
      lockCount: normalized.lockedMembers,
    });
    const narrativeWeight = resolveNarrativeWeight({
      routeChannel,
      rankingPressure100: normalized.rankingPressure100,
      contractType: null,
      roomSurge,
    });

    return this.acceptOrDedupe({
      eventName,
      roomId,
      routeChannel,
      emittedAt,
      snapshot: toChatSnapshot(normalized),
      severity,
      narrativeWeight,
      metadata: buildMetadata(
        {
          source: context?.source ?? 'MultiplayerSignalAdapter.room.joined',
          playerId: toOptionalString(player?.playerId ?? player?.id),
          username: toOptionalString(player?.username ?? player?.displayName),
          playerStatus: normalizePlayerStatus(player?.status ?? null),
          roomKind: normalized.roomKind,
          roomSurge,
        },
        buildMetadataFromContext(context),
      ),
    });
  }

  private adaptRoomLeft(
    eventName: MultiplayerSignalAdapterEventName,
    payload: MultiplayerRoomLeftPayloadCompat,
    emittedAt: UnixMs,
    context?: MultiplayerSignalAdapterContext,
  ): MultiplayerSignalAdapterReport {
    const room = payload.room ?? null;
    const player = payload.player ?? null;
    const roomId = this.resolveRoomId(room?.roomId ?? payload.roomId ?? context?.roomId);
    const routeChannel = resolveVisibleChannel(
      context?.routeChannel ?? null,
      room?.roomKind ?? null,
      this.defaultVisibleChannel,
    );

    const normalized = normalizeMultiplayerModel({
      roomId,
      roomKind: room?.roomKind ?? null,
      members: room?.members ?? [],
      memberCount: room?.memberCount ?? null,
      parties: room?.parties ?? null,
      partySize: room?.partySize ?? null,
      spectatingCount: room?.spectatingCount ?? null,
      factionName: room?.factionName ?? null,
      rankingPressure: room?.rankingPressure ?? null,
      routeChannel,
    });
    const severity = resolveSeverity({
      rankingPressure100: normalized.rankingPressure100,
      spectatingCount: normalized.spectatingCount,
      contractType: null,
      lockCount: normalized.lockedMembers,
    });
    const narrativeWeight = normalized.memberCount <= 1 ? 'TACTICAL' : 'AMBIENT';

    return this.acceptOrDedupe({
      eventName,
      roomId,
      routeChannel,
      emittedAt,
      snapshot: toChatSnapshot(normalized),
      severity,
      narrativeWeight,
      metadata: buildMetadata(
        {
          source: context?.source ?? 'MultiplayerSignalAdapter.room.left',
          playerId: toOptionalString(player?.playerId ?? player?.id),
          username: toOptionalString(player?.username ?? player?.displayName),
          playerStatus: normalizePlayerStatus(player?.status ?? null),
          reason: toOptionalString(payload.reason),
          roomKind: normalized.roomKind,
        },
        buildMetadataFromContext(context),
      ),
    });
  }

  private adaptRoomUpdated(
    eventName: MultiplayerSignalAdapterEventName,
    payload: MultiplayerRoomCompat,
    emittedAt: UnixMs,
    context?: MultiplayerSignalAdapterContext,
  ): MultiplayerSignalAdapterReport {
    return this.adaptSnapshot(
      {
        roomId: payload.roomId ?? context?.roomId ?? null,
        roomKind: payload.roomKind ?? null,
        members: payload.members ?? null,
        memberCount: payload.memberCount ?? null,
        parties: payload.parties ?? null,
        partySize: payload.partySize ?? null,
        spectatingCount: payload.spectatingCount ?? null,
        factionName: payload.factionName ?? null,
        rankingPressure: payload.rankingPressure ?? null,
        mode: payload.mode ?? null,
        emittedAt,
        metadata: payload.metadata ?? null,
      },
      {
        ...context,
        emittedAt,
        source: context?.source ?? 'MultiplayerSignalAdapter.room.updated',
      },
    );
  }

  private adaptPlayerUpdated(
    eventName: MultiplayerSignalAdapterEventName,
    payload: MultiplayerPlayerUpdatedPayloadCompat,
    emittedAt: UnixMs,
    context?: MultiplayerSignalAdapterContext,
  ): MultiplayerSignalAdapterReport {
    const current = payload.current ?? payload.previous ?? null;
    const roomId = this.resolveRoomId(payload.roomId ?? context?.roomId);
    const routeChannel = resolveVisibleChannel(context?.routeChannel ?? null, null, this.defaultVisibleChannel);
    const status = normalizePlayerStatus(current?.status ?? null);
    const memberCount = Math.max(1, this.lastMemberCount);
    const rankingPressure100 = computeRankingPressure100({
      rankingPressure: current?.rank ?? current?.score ?? null,
      memberCount,
      spectatingCount: status === 'SPECTATING' ? 1 : 0,
      partySize: 0,
      lockedMembers: toFiniteNumber(current?.turnsLocked, 0) > 0 ? 1 : 0,
    });
    const snapshot: ChatMultiplayerSnapshot = Object.freeze({
      roomMemberCount: memberCount,
      partySize: 0,
      spectatingCount: status === 'SPECTATING' ? 1 : 0,
      factionName: toOptionalString(current?.factionName),
      rankingPressure: rankingPressure100,
    });
    const severity = status === 'SUSPENDED' || status === 'DISCONNECTED' ? 'WARN' : 'INFO';
    const narrativeWeight = status === 'SPECTATING' ? 'TACTICAL' : 'AMBIENT';

    return this.acceptOrDedupe({
      eventName,
      roomId,
      routeChannel,
      emittedAt,
      snapshot,
      severity,
      narrativeWeight,
      metadata: buildMetadata(
        {
          source: context?.source ?? 'MultiplayerSignalAdapter.player.updated',
          playerId: toOptionalString(current?.playerId ?? current?.id),
          username: toOptionalString(current?.username ?? current?.displayName),
          previousStatus: normalizePlayerStatus(payload.previous?.status ?? null),
          currentStatus: status,
          turnsLocked: toFiniteNumber(current?.turnsLocked, 0),
          rank: toFiniteNumber(current?.rank, 0),
          score: toFiniteNumber(current?.score, 0),
        },
        buildMetadataFromContext(context),
      ),
    });
  }

  private adaptPartyUpdated(
    eventName: MultiplayerSignalAdapterEventName,
    payload: MultiplayerPartyUpdatedPayloadCompat,
    emittedAt: UnixMs,
    context?: MultiplayerSignalAdapterContext,
  ): MultiplayerSignalAdapterReport {
    const roomId = this.resolveRoomId(payload.room?.roomId ?? payload.roomId ?? context?.roomId);
    const routeChannel = resolveVisibleChannel(
      context?.routeChannel ?? null,
      payload.room?.roomKind ?? 'SYNDICATE',
      'SYNDICATE',
    );
    const current = payload.current ?? null;
    const previous = payload.previous ?? null;
    const nextPartySize = Array.isArray(current?.memberIds) ? current.memberIds.length : 0;
    const previousPartySize = Array.isArray(previous?.memberIds) ? previous.memberIds.length : 0;
    const room = payload.room ?? null;

    const normalized = normalizeMultiplayerModel({
      roomId,
      roomKind: room?.roomKind ?? 'SYNDICATE',
      members: room?.members ?? null,
      memberCount: room?.memberCount ?? null,
      parties: room?.parties ?? (current ? [current] : []),
      partySize: nextPartySize,
      spectatingCount: room?.spectatingCount ?? null,
      factionName: room?.factionName ?? null,
      rankingPressure: room?.rankingPressure ?? null,
      routeChannel,
    });

    const severity: MultiplayerSignalAdapterSeverity =
      current?.locked ? 'WARN' : nextPartySize > previousPartySize ? 'INFO' : 'DEBUG';
    const narrativeWeight: MultiplayerSignalAdapterNarrativeWeight =
      current?.locked ? 'TACTICAL' : 'INTIMATE';

    return this.acceptOrDedupe({
      eventName,
      roomId,
      routeChannel,
      emittedAt,
      snapshot: toChatSnapshot(normalized),
      severity,
      narrativeWeight,
      metadata: buildMetadata(
        {
          source: context?.source ?? 'MultiplayerSignalAdapter.party.updated',
          partyId: toOptionalString(current?.partyId),
          leaderPlayerId: toOptionalString(current?.leaderPlayerId),
          previousPartySize,
          nextPartySize,
          partyLocked: !!current?.locked,
        },
        buildMetadataFromContext(context),
      ),
    });
  }

  private adaptContractEvent(
    eventName: MultiplayerSignalAdapterEventName,
    payload: MultiplayerContractPayloadCompat,
    emittedAt: UnixMs,
    context?: MultiplayerSignalAdapterContext,
  ): MultiplayerSignalAdapterReport {
    const roomId = this.resolveRoomId(payload.room?.roomId ?? payload.roomId ?? context?.roomId);
    const room = payload.room ?? null;
    const contract = payload.contract ?? null;
    const contractType = toOptionalString(contract?.type)?.toUpperCase() ?? null;
    const routeChannel = resolveVisibleChannel(
      context?.routeChannel ?? null,
      room?.roomKind ?? (contractType === 'SABOTAGE' ? 'DEAL_ROOM' : 'SYNDICATE'),
      contractType === 'SABOTAGE' ? 'DEAL_ROOM' : 'SYNDICATE',
    );

    const normalized = normalizeMultiplayerModel({
      roomId,
      roomKind: room?.roomKind ?? null,
      members: room?.members ?? null,
      memberCount: room?.memberCount ?? null,
      parties: room?.parties ?? null,
      partySize: room?.partySize ?? null,
      spectatingCount: room?.spectatingCount ?? null,
      factionName: room?.factionName ?? null,
      rankingPressure: room?.rankingPressure ?? null,
      routeChannel,
    });

    const severity = resolveSeverity({
      rankingPressure100: normalized.rankingPressure100,
      spectatingCount: normalized.spectatingCount,
      contractType,
      lockCount: normalized.lockedMembers,
    });
    const narrativeWeight = resolveNarrativeWeight({
      routeChannel,
      rankingPressure100: normalized.rankingPressure100,
      contractType,
      roomSurge: false,
    });

    return this.acceptOrDedupe({
      eventName,
      roomId,
      routeChannel,
      emittedAt,
      snapshot: toChatSnapshot(normalized),
      severity,
      narrativeWeight,
      metadata: buildMetadata(
        {
          source: context?.source ?? 'MultiplayerSignalAdapter.contract',
          contractId: toOptionalString(contract?.contractId),
          contractType,
          targetPlayerId: toOptionalString(contract?.targetPlayerId),
          initiatorPlayerId: toOptionalString(contract?.initiatorPlayerId),
          assistGiftTokenId: toOptionalString(contract?.assistGiftTokenId),
          sabotageTokenId: toOptionalString(contract?.sabotageTokenId),
          mlEnabled: !!contract?.mlEnabled,
          auditHash: toOptionalString(contract?.auditHash),
          resolvedAt: toFiniteNumber(contract?.resolvedAt, 0),
        },
        buildMetadataFromContext(context),
      ),
    });
  }

  private adaptFactionUpdated(
    eventName: MultiplayerSignalAdapterEventName,
    payload: MultiplayerFactionUpdatedPayloadCompat,
    emittedAt: UnixMs,
    context?: MultiplayerSignalAdapterContext,
  ): MultiplayerSignalAdapterReport {
    const roomId = this.resolveRoomId(payload.room?.roomId ?? payload.roomId ?? context?.roomId);
    const routeChannel = resolveVisibleChannel(
      context?.routeChannel ?? null,
      payload.room?.roomKind ?? 'SYNDICATE',
      'SYNDICATE',
    );
    const normalized = normalizeMultiplayerModel({
      roomId,
      roomKind: payload.room?.roomKind ?? 'SYNDICATE',
      members: payload.room?.members ?? null,
      memberCount: payload.memberCount ?? payload.room?.memberCount ?? null,
      parties: payload.room?.parties ?? null,
      partySize: payload.room?.partySize ?? null,
      spectatingCount: payload.spectatingCount ?? payload.room?.spectatingCount ?? null,
      factionName: payload.factionName ?? payload.room?.factionName ?? null,
      rankingPressure: payload.rankingPressure ?? payload.room?.rankingPressure ?? null,
      routeChannel,
    });
    const severity = normalized.rankingPressure100 >= clamp100(this.rankingPressureEscalationThreshold)
      ? 'WARN'
      : 'INFO';
    const narrativeWeight: MultiplayerSignalAdapterNarrativeWeight = 'INTIMATE';

    return this.acceptOrDedupe({
      eventName,
      roomId,
      routeChannel,
      emittedAt,
      snapshot: toChatSnapshot(normalized),
      severity,
      narrativeWeight,
      metadata: buildMetadata(
        {
          source: context?.source ?? 'MultiplayerSignalAdapter.faction.updated',
          factionName: normalized.factionName,
          rankingPressure100: normalized.rankingPressure100,
        },
        buildMetadataFromContext(context),
      ),
    });
  }

  private adaptSpectatorUpdated(
    eventName: MultiplayerSignalAdapterEventName,
    payload: MultiplayerSpectatorUpdatedPayloadCompat,
    emittedAt: UnixMs,
    context?: MultiplayerSignalAdapterContext,
  ): MultiplayerSignalAdapterReport {
    const roomId = this.resolveRoomId(payload.room?.roomId ?? payload.roomId ?? context?.roomId);
    const routeChannel = resolveVisibleChannel(
      context?.routeChannel ?? null,
      payload.room?.roomKind ?? 'GLOBAL',
      'GLOBAL',
    );
    const normalized = normalizeMultiplayerModel({
      roomId,
      roomKind: payload.room?.roomKind ?? null,
      members: payload.room?.members ?? null,
      memberCount: payload.room?.memberCount ?? null,
      parties: payload.room?.parties ?? null,
      partySize: payload.room?.partySize ?? null,
      spectatingCount: payload.spectatingCount ?? payload.room?.spectatingCount ?? null,
      factionName: payload.room?.factionName ?? null,
      rankingPressure: payload.room?.rankingPressure ?? null,
      routeChannel,
    });
    const severity = normalized.spectatingCount >= 6 ? 'WARN' : 'INFO';
    const narrativeWeight = normalized.spectatingCount >= 6 ? 'TACTICAL' : 'AMBIENT';

    return this.acceptOrDedupe({
      eventName,
      roomId,
      routeChannel,
      emittedAt,
      snapshot: toChatSnapshot(normalized),
      severity,
      narrativeWeight,
      metadata: buildMetadata(
        {
          source: context?.source ?? 'MultiplayerSignalAdapter.spectators.updated',
          spectatingCount: normalized.spectatingCount,
        },
        buildMetadataFromContext(context),
      ),
    });
  }

  // ---------------------------------------------------------------------------
  // Acceptance / dedupe / history
  // ---------------------------------------------------------------------------

  private acceptOrDedupe(args: {
    readonly eventName: MultiplayerSignalAdapterEventName;
    readonly roomId: ChatRoomId;
    readonly routeChannel: ChatVisibleChannel;
    readonly emittedAt: UnixMs;
    readonly snapshot: ChatMultiplayerSnapshot;
    readonly severity: MultiplayerSignalAdapterSeverity;
    readonly narrativeWeight: MultiplayerSignalAdapterNarrativeWeight;
    readonly metadata: Readonly<Record<string, JsonValue>>;
  }): MultiplayerSignalAdapterReport {
    this.lastRankingPressure100 = args.snapshot.rankingPressure;
    this.lastMemberCount = args.snapshot.roomMemberCount;

    const dedupeKey = stableKey({
      eventName: args.eventName,
      roomId: args.roomId,
      routeChannel: args.routeChannel,
      memberCount: args.snapshot.roomMemberCount,
      partySize: args.snapshot.partySize,
      spectatingCount: args.snapshot.spectatingCount,
      factionName: args.snapshot.factionName,
      rankingPressure: args.snapshot.rankingPressure,
      severity: args.severity,
      narrativeWeight: args.narrativeWeight,
      source: args.metadata.source ?? null,
      contractId: args.metadata.contractId ?? null,
      playerId: args.metadata.playerId ?? null,
    });

    const previous = this.dedupeMap.get(dedupeKey);
    if (previous && args.emittedAt - previous < this.dedupeWindowMs) {
      this.dedupedCount += 1;
      return Object.freeze({
        accepted: [],
        deduped: [
          {
            dedupeKey,
            eventName: args.eventName,
            reason: 'MULTIPLAYER_SIGNAL_DEDUPED',
            details: buildMetadata({
              previousAcceptedAt: previous,
              emittedAt: args.emittedAt,
              dedupeWindowMs: this.dedupeWindowMs,
            }, args.metadata),
          },
        ],
        rejected: [],
      });
    }

    this.dedupeMap.set(dedupeKey, args.emittedAt);

    const signal: ChatSignalEnvelope = Object.freeze({
      type: 'MULTIPLAYER',
      emittedAt: args.emittedAt,
      roomId: args.roomId,
      multiplayer: args.snapshot,
      metadata: this.includeShadowMetadata
        ? buildMetadata(args.metadata, {
            severity: args.severity,
            narrativeWeight: args.narrativeWeight,
            dedupeKey,
          })
        : args.metadata,
    });

    const envelope: ChatInputEnvelope = Object.freeze({
      kind: 'MULTIPLAYER_SIGNAL',
      emittedAt: args.emittedAt,
      payload: signal,
    });

    const accepted: MultiplayerSignalAdapterAccepted = Object.freeze({
      dedupeKey,
      eventName: args.eventName,
      severity: args.severity,
      narrativeWeight: args.narrativeWeight,
      routeChannel: args.routeChannel,
      envelope,
      signal,
      snapshot: args.snapshot,
      diagnostics: buildMetadata(
        {
          witnessRecommended: isWorthVisibleWitness({
            severity: args.severity,
            routeChannel: args.routeChannel,
            roomSurge: !!args.metadata.roomSurge,
            rankingPressure100: args.snapshot.rankingPressure,
            memberCount: args.snapshot.roomMemberCount,
          }),
          rankingPressureEscalated:
            args.snapshot.rankingPressure >= clamp100(this.rankingPressureEscalationThreshold),
        },
        args.metadata,
      ),
    });

    this.acceptedCount += 1;
    this.pushHistory({
      id: `multiplayer:${this.acceptedCount}:${String(args.emittedAt)}`,
      ts: args.emittedAt,
      roomId: args.roomId,
      eventName: args.eventName,
      routeChannel: args.routeChannel,
      severity: args.severity,
      narrativeWeight: args.narrativeWeight,
      memberCount: args.snapshot.roomMemberCount,
      partySize: args.snapshot.partySize,
      spectatingCount: args.snapshot.spectatingCount,
      rankingPressure100: args.snapshot.rankingPressure,
      factionName: args.snapshot.factionName,
      dedupeKey,
      metadata: args.metadata,
    });

    return Object.freeze({ accepted: [accepted], deduped: [], rejected: [] });
  }

  private pushHistory(entry: MultiplayerSignalAdapterHistoryEntry): void {
    this.history.push(Object.freeze(entry));
    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory);
    }
  }

  private resolveRoomId(value: ChatRoomId | string | null | undefined): ChatRoomId {
    return value ? asRoomId(value) : this.defaultRoomId;
  }

  private resolveEventTime(value: number | null | undefined): UnixMs {
    return asUnixMs(toFiniteNumber(value, this.clock.now()));
  }

  private evictExpiredDedupe(): void {
    const now = this.clock.now();
    for (const [key, ts] of this.dedupeMap.entries()) {
      if (now - ts >= this.dedupeWindowMs) {
        this.dedupeMap.delete(key);
      }
    }
  }
}

function buildMetadataFromContext(
  context?: MultiplayerSignalAdapterContext,
): Readonly<Record<string, JsonValue>> | undefined {
  if (!context) return undefined;
  return buildMetadata(
    {
      source: context.source ?? 'unknown',
      tags: context.tags ?? [],
    },
    context.metadata,
  );
}
