/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT MOMENT LEDGER
 * FILE: backend/src/game/engine/chat/experience/ChatMomentLedger.ts
 * VERSION: 2026.03.18
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative backend ledger for drama moments, scene lifecycle, silence
 * windows, reveal reservations, witness continuity, callback carryover, and
 * cross-mode scene memory handoff.
 *
 * This file deliberately sits beneath orchestration and above transport.
 * It owns durable moment truth for the backend chat experience lane.
 *
 * Design doctrine
 * ---------------
 * - Moment truth is not UI state.
 * - A scene is not complete when a message is emitted; it is complete when the
 *   backend says the dramatic thread is resolved, interrupted, timed out, or
 *   carried forward.
 * - Silence is first-class state, not an absence of state.
 * - Reveals are first-class state, not just delayed messages.
 * - Archive and carryover must be reconstructible from ledger truth.
 * - Relationship and memory services enrich ledger decisions; they do not
 *   replace ledger ownership.
 */

import type {
  SharedChatChannelId,
  SharedChatMemoryAnchor,
  SharedChatMomentType,
  SharedChatSceneArchetype,
  SharedChatSceneArchiveRecord,
  SharedChatSceneCarryoverSummary,
  SharedChatSceneOutcome,
  SharedChatScenePlan,
  SharedChatScenePlannerInput,
  SharedPressureTier,
} from '../../../../../../shared/contracts/chat/scene';

import type {
  EpisodicMemoryCallbackCandidate,
  EpisodicMemoryQuery,
  EpisodicMemoryRecord,
  EpisodicMemorySnapshot,
} from '../../../../../../shared/contracts/chat/memory';

import type {
  ChatRelationshipCounterpartState,
  ChatRelationshipEventDescriptor,
  ChatRelationshipSnapshot,
} from '../../../../../../shared/contracts/chat/relationship';

import { ChatSceneArchiveService } from '../ChatSceneArchiveService';
import { ChatMemoryService } from '../ChatMemoryService';
import { ChatRelationshipService } from '../ChatRelationshipService';

import type {
  ChatChannelId,
  ChatMessageId,
  ChatRuntimeConfig,
  ChatShadowChannel,
  ChatVisibleChannel,
} from '../types';

import { CHAT_RUNTIME_DEFAULTS } from '../types';

/* ============================================================================
 * MARK: Scalar helpers
 * ============================================================================
 */

function now(): number {
  return Date.now();
}

function clamp01(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

function asArray<T>(value: readonly T[] | undefined | null): readonly T[] {
  return Array.isArray(value) ? value : [];
}

function uniq<T>(values: readonly T[]): readonly T[] {
  const out: T[] = [];
  const seen = new Set<T>();
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function max01(values: readonly number[]): number {
  let max = 0;
  for (const value of values) {
    if (value > max) max = value;
  }
  return clamp01(max);
}

function avg01(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return clamp01(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function normalizeTag(tag: string): string {
  return String(tag ?? '')
    .trim()
    .replace(/[:/\\]+/g, '_')
    .replace(/\s+/g, '_')
    .toUpperCase();
}

function normalizeSummary(value: string | undefined | null, fallback: string): string {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : fallback;
}

function channelKind(channelId: ChatChannelId | SharedChatChannelId): 'VISIBLE' | 'SHADOW' {
  const channel = String(channelId ?? '').toUpperCase();
  if (channel.endsWith('_SHADOW')) return 'SHADOW';
  return 'VISIBLE';
}

function normalizeVisibleChannel(value: string | null | undefined): ChatVisibleChannel {
  const upper = String(value ?? '').toUpperCase();
  switch (upper) {
    case 'GLOBAL':
    case 'SYNDICATE':
    case 'DEAL_ROOM':
    case 'LOBBY':
      return upper;
    default:
      return 'GLOBAL';
  }
}

function normalizeShadowChannel(value: string | null | undefined): ChatShadowChannel {
  const upper = String(value ?? '').toUpperCase();
  switch (upper) {
    case 'SYSTEM_SHADOW':
    case 'NPC_SHADOW':
    case 'RIVALRY_SHADOW':
    case 'RESCUE_SHADOW':
    case 'LIVEOPS_SHADOW':
      return upper;
    default:
      return 'SYSTEM_SHADOW';
  }
}

function normalizePressureTier(value: string | null | undefined): SharedPressureTier | undefined {
  const upper = String(value ?? '').toUpperCase();
  switch (upper) {
    case 'CALM':
    case 'WATCHFUL':
    case 'PRESSURED':
    case 'CRITICAL':
    case 'BREAKPOINT':
      return upper;
    default:
      return undefined;
  }
}

function pressureTo01(value: SharedPressureTier | undefined): number {
  switch (value) {
    case 'CALM':
      return 0.1;
    case 'WATCHFUL':
      return 0.3;
    case 'PRESSURED':
      return 0.58;
    case 'CRITICAL':
      return 0.82;
    case 'BREAKPOINT':
      return 0.97;
    default:
      return 0.42;
  }
}

function archetypeSeverity(archetype: SharedChatSceneArchetype | undefined): number {
  switch (archetype) {
    case 'BREACH_SCENE':
      return 0.92;
    case 'TRAP_SCENE':
      return 0.84;
    case 'RESCUE_SCENE':
      return 0.73;
    case 'PUBLIC_HUMILIATION_SCENE':
      return 0.9;
    case 'COMEBACK_WITNESS_SCENE':
      return 0.76;
    case 'DEAL_ROOM_PRESSURE_SCENE':
      return 0.79;
    case 'FALSE_CALM_SCENE':
      return 0.41;
    case 'END_OF_RUN_RECKONING_SCENE':
      return 0.68;
    case 'LONG_ARC_CALLBACK_SCENE':
      return 0.63;
    case 'SEASON_EVENT_INTRUSION_SCENE':
      return 0.75;
    default:
      return 0.5;
  }
}

function momentImportance(momentType: SharedChatMomentType): number {
  switch (momentType) {
    case 'RUN_START':
      return 0.34;
    case 'RUN_END':
      return 0.84;
    case 'PRESSURE_SURGE':
      return 0.66;
    case 'SHIELD_BREACH':
      return 0.95;
    case 'CASCADE_TRIGGER':
      return 0.78;
    case 'CASCADE_BREAK':
      return 0.72;
    case 'BOT_ATTACK':
      return 0.7;
    case 'BOT_RETREAT':
      return 0.58;
    case 'HELPER_RESCUE':
      return 0.82;
    case 'DEAL_ROOM_STANDOFF':
      return 0.77;
    case 'SOVEREIGN_APPROACH':
      return 0.88;
    case 'SOVEREIGN_ACHIEVED':
      return 1;
    case 'LEGEND_MOMENT':
      return 0.97;
    case 'WORLD_EVENT':
      return 0.74;
    default:
      return 0.5;
  }
}

/* ============================================================================
 * MARK: Ledger contracts
 * ============================================================================
 */

export type ChatMomentStatus =
  | 'REGISTERED'
  | 'PLANNED'
  | 'EMITTING'
  | 'WAITING_ON_SILENCE'
  | 'WAITING_ON_REVEAL'
  | 'WAITING_ON_PLAYER'
  | 'RESOLVED'
  | 'CANCELLED'
  | 'TIMED_OUT'
  | 'CARRIED_OVER';

export type ChatRevealStatus =
  | 'QUEUED'
  | 'LEASED'
  | 'READY'
  | 'RELEASED'
  | 'CONSUMED'
  | 'CANCELLED'
  | 'EXPIRED';

export type ChatSilenceWindowPurpose =
  | 'FALSE_CALM'
  | 'POST_BREACH_STAREDOWN'
  | 'PRE_RESCUE_GAP'
  | 'PLAYER_REPLY_WINDOW'
  | 'REVEAL_BUFFER'
  | 'POST_LEGEND_BREATH'
  | 'DEAL_ROOM_WAIT'
  | 'WORLD_EVENT_HUSH'
  | 'COOLDOWN'
  | 'MOURNING'
  | 'SHOCK'
  | 'TYPING_THEATER';

export interface ChatMomentWitnessState {
  readonly witnessId: string;
  readonly witnessKind: 'PLAYER' | 'HATER' | 'HELPER' | 'CROWD' | 'SYSTEM' | 'NARRATOR';
  readonly channelId: ChatChannelId;
  readonly intensity01: number;
  readonly addedAt: number;
  readonly tags: readonly string[];
}

export interface ChatMomentRevealReservation {
  readonly reservationId: string;
  readonly momentId: string;
  readonly sceneId?: string;
  readonly roomId: string;
  readonly playerId: string;
  readonly channelId: ChatChannelId;
  readonly payloadId: string;
  readonly revealKind: 'QUOTE' | 'TURNING_POINT' | 'IDENTITY' | 'RECEIPT' | 'LEGEND' | 'WORLD_EVENT';
  readonly weight01: number;
  readonly createdAt: number;
  readonly notBefore: number;
  readonly expiresAt: number;
  readonly counterpartId?: string;
  readonly callbackAnchorIds: readonly string[];
  readonly tags: readonly string[];
  readonly status: ChatRevealStatus;
  readonly leaseOwner?: string;
  readonly leasedAt?: number;
  readonly releasedAt?: number;
  readonly consumedAt?: number;
}

export interface ChatMomentSilenceWindow {
  readonly silenceId: string;
  readonly playerId: string;
  readonly roomId: string;
  readonly momentId: string;
  readonly sceneId?: string;
  readonly channelId: ChatChannelId;
  readonly purpose: ChatSilenceWindowPurpose;
  readonly createdAt: number;
  readonly opensAt: number;
  readonly closesAt: number;
  readonly weight01: number;
  readonly interruptible: boolean;
  readonly shadowOnly: boolean;
  readonly inheritedFromMomentId?: string;
  readonly preferredCounterpartId?: string;
  readonly tags: readonly string[];
  readonly reasonSummary: string;
  readonly closedAt?: number;
  readonly closeReason?: string;
}

export interface ChatMomentEmission {
  readonly emissionId: string;
  readonly momentId: string;
  readonly sceneId?: string;
  readonly beatId?: string;
  readonly messageId: ChatMessageId;
  readonly channelId: ChatChannelId;
  readonly kind: 'VISIBLE' | 'SHADOW' | 'ANNOTATION';
  readonly source: 'SYSTEM' | 'HATER' | 'HELPER' | 'CROWD' | 'CALLBACK' | 'REVEAL' | 'UNKNOWN';
  readonly createdAt: number;
  readonly tags: readonly string[];
}

export interface ChatMomentRecord {
  readonly momentId: string;
  readonly playerId: string;
  readonly roomId: string;
  readonly primaryChannelId: ChatVisibleChannel;
  readonly momentType: SharedChatMomentType;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly causeEventId?: string;
  readonly sourceMessageId?: string;
  readonly sourcePlanId?: string;
  readonly pressureTier?: SharedPressureTier;
  readonly intensity01: number;
  readonly importance01: number;
  readonly status: ChatMomentStatus;
  readonly sceneId?: string;
  readonly sceneArchetype?: SharedChatSceneArchetype;
  readonly scenePlan?: SharedChatScenePlan;
  readonly archiveId?: string;
  readonly worldTags: readonly string[];
  readonly planningTags: readonly string[];
  readonly counterpartIds: readonly string[];
  readonly callbackAnchorIds: readonly string[];
  readonly pendingRevealReservationIds: readonly string[];
  readonly activeSilenceWindowIds: readonly string[];
  readonly visibleEmissionIds: readonly string[];
  readonly shadowEmissionIds: readonly string[];
  readonly witnessTail: readonly ChatMomentWitnessState[];
  readonly unresolvedReasons: readonly string[];
  readonly carryoverWeight01: number;
  readonly summaryLine: string;
  readonly lastMeaningfulMutationAt: number;
  readonly resolvedAt?: number;
  readonly outcome?: SharedChatSceneOutcome;
}

export interface ChatMomentRegistrationInput {
  readonly playerId: string;
  readonly roomId: string;
  readonly primaryChannelId: ChatVisibleChannel | SharedChatChannelId;
  readonly createdAt?: number;
  readonly momentId: string;
  readonly momentType: SharedChatMomentType;
  readonly causeEventId?: string;
  readonly sourceMessageId?: string;
  readonly sourcePlanId?: string;
  readonly pressureTier?: SharedPressureTier | string;
  readonly intensity01?: number;
  readonly worldTags?: readonly string[];
  readonly planningTags?: readonly string[];
  readonly counterpartIds?: readonly string[];
  readonly callbackAnchorIds?: readonly string[];
  readonly unresolvedReasons?: readonly string[];
  readonly summaryLine?: string;
}

export interface ChatMomentPlanAttachment {
  readonly attachedAt?: number;
  readonly scene: SharedChatScenePlan;
  readonly counterpartIds?: readonly string[];
  readonly callbackAnchorIds?: readonly string[];
  readonly worldTags?: readonly string[];
  readonly planningTags?: readonly string[];
  readonly unresolvedReasons?: readonly string[];
  readonly summaryLine?: string;
}

export interface ChatMomentResolutionInput {
  readonly playerId: string;
  readonly momentId: string;
  readonly resolvedAt?: number;
  readonly outcome: SharedChatSceneOutcome;
  readonly finalSummary?: string;
  readonly carryOver?: boolean;
  readonly archived?: boolean;
  readonly generatedTags?: readonly string[];
  readonly resolveRevealReservations?: boolean;
  readonly resolveMemoryIds?: readonly string[];
}

export interface ChatMomentCarryoverRecord {
  readonly carryoverId: string;
  readonly playerId: string;
  readonly roomId: string;
  readonly momentId: string;
  readonly sceneId?: string;
  readonly archetype?: SharedChatSceneArchetype;
  readonly weight01: number;
  readonly createdAt: number;
  readonly summaryLine: string;
  readonly callbackAnchorIds: readonly string[];
  readonly counterpartIds: readonly string[];
  readonly worldTags: readonly string[];
}

export interface ChatMomentRoomSnapshot {
  readonly roomId: string;
  readonly playerIds: readonly string[];
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly momentIdsByUpdatedDesc: readonly string[];
  readonly unresolvedMomentIds: readonly string[];
  readonly activeRevealReservationIds: readonly string[];
  readonly activeSilenceWindowIds: readonly string[];
}

export interface ChatMomentPlayerSnapshot {
  readonly playerId: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly totalMomentCount: number;
  readonly unresolvedMomentIds: readonly string[];
  readonly carryover: readonly ChatMomentCarryoverRecord[];
  readonly activeRevealReservationIds: readonly string[];
  readonly activeSilenceWindowIds: readonly string[];
  readonly momentsById: Readonly<Record<string, ChatMomentRecord>>;
  readonly roomIds: readonly string[];
}

export interface ChatMomentLedgerStats {
  readonly registeredMoments: number;
  readonly resolvedMoments: number;
  readonly carriedMoments: number;
  readonly cancelledMoments: number;
  readonly timedOutMoments: number;
  readonly activeSilenceWindows: number;
  readonly activeRevealReservations: number;
  readonly visibleEmissions: number;
  readonly shadowEmissions: number;
}

export interface ChatMomentLedgerSnapshot {
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly stats: ChatMomentLedgerStats;
  readonly players: Readonly<Record<string, ChatMomentPlayerSnapshot>>;
  readonly rooms: Readonly<Record<string, ChatMomentRoomSnapshot>>;
}

export interface ChatMomentLedgerPlannerContext {
  readonly relationshipState: readonly ChatRelationshipCounterpartState[];
  readonly memoryAnchors: readonly SharedChatMemoryAnchor[];
  readonly unresolvedMomentIds: readonly string[];
  readonly carriedPersonaIds: readonly string[];
  readonly pendingRevealPayloadIds: readonly string[];
  readonly worldTags: readonly string[];
  readonly suggestedCallbackAnchorIds: readonly string[];
}

export interface ChatMomentLedgerConfig {
  readonly maxMomentsPerPlayer: number;
  readonly maxWitnessTail: number;
  readonly maxCarryoverPerPlayer: number;
  readonly maxRevealReservationsPerPlayer: number;
  readonly maxSilenceWindowsPerPlayer: number;
  readonly staleMomentMs: number;
  readonly carryoverTtlMs: number;
  readonly revealDefaultTtlMs: number;
  readonly silenceDefaultTtlMs: number;
  readonly archiveOnResolve: boolean;
  readonly inheritRelationshipContinuity: boolean;
  readonly inheritMemoryContinuity: boolean;
  readonly archiveService?: ChatSceneArchiveService;
  readonly memoryService?: ChatMemoryService;
  readonly relationshipService?: ChatRelationshipService;
  readonly runtimeConfig?: ChatRuntimeConfig;
}

export const DEFAULT_CHAT_MOMENT_LEDGER_CONFIG: ChatMomentLedgerConfig = Object.freeze({
  maxMomentsPerPlayer: 512,
  maxWitnessTail: 24,
  maxCarryoverPerPlayer: 48,
  maxRevealReservationsPerPlayer: 128,
  maxSilenceWindowsPerPlayer: 128,
  staleMomentMs: 10 * 60_000,
  carryoverTtlMs: 8 * 60 * 60_000,
  revealDefaultTtlMs: 5 * 60_000,
  silenceDefaultTtlMs: 60_000,
  archiveOnResolve: true,
  inheritRelationshipContinuity: true,
  inheritMemoryContinuity: true,
  archiveService: undefined,
  memoryService: undefined,
  relationshipService: undefined,
  runtimeConfig: CHAT_RUNTIME_DEFAULTS,
});

/* ============================================================================
 * MARK: Internal bucket types
 * ============================================================================
 */

interface PlayerMomentBucket {
  readonly playerId: string;
  createdAt: number;
  updatedAt: number;
  totalMomentCount: number;
  moments: Map<string, ChatMomentRecord>;
  roomIds: Set<string>;
  carryover: ChatMomentCarryoverRecord[];
  revealReservations: Map<string, ChatMomentRevealReservation>;
  silenceWindows: Map<string, ChatMomentSilenceWindow>;
  emissions: Map<string, ChatMomentEmission>;
}

interface RoomMomentBucket {
  readonly roomId: string;
  createdAt: number;
  updatedAt: number;
  playerIds: Set<string>;
  momentIdsByUpdatedDesc: string[];
  unresolvedMomentIds: Set<string>;
  activeRevealReservationIds: Set<string>;
  activeSilenceWindowIds: Set<string>;
}

interface UpsertMomentPatch {
  readonly status?: ChatMomentStatus;
  readonly updatedAt?: number;
  readonly pressureTier?: SharedPressureTier;
  readonly intensity01?: number;
  readonly sceneId?: string;
  readonly sceneArchetype?: SharedChatSceneArchetype;
  readonly scenePlan?: SharedChatScenePlan;
  readonly archiveId?: string;
  readonly worldTags?: readonly string[];
  readonly planningTags?: readonly string[];
  readonly counterpartIds?: readonly string[];
  readonly callbackAnchorIds?: readonly string[];
  readonly pendingRevealReservationIds?: readonly string[];
  readonly activeSilenceWindowIds?: readonly string[];
  readonly visibleEmissionIds?: readonly string[];
  readonly shadowEmissionIds?: readonly string[];
  readonly witnessTail?: readonly ChatMomentWitnessState[];
  readonly unresolvedReasons?: readonly string[];
  readonly carryoverWeight01?: number;
  readonly summaryLine?: string;
  readonly lastMeaningfulMutationAt?: number;
  readonly resolvedAt?: number;
  readonly outcome?: SharedChatSceneOutcome;
}

/* ============================================================================
 * MARK: Projection helpers
 * ============================================================================
 */

function extractMemoryEmbeddingKey(record: EpisodicMemoryRecord): string | undefined {
  const semanticKey = (record as EpisodicMemoryRecord & { readonly semanticKey?: string | null }).semanticKey;
  if (typeof semanticKey === 'string' && semanticKey.trim().length > 0) {
    return semanticKey.trim();
  }

  const rawTags = Array.isArray(record.triggerContext.tags) ? record.triggerContext.tags : [];
  const normalizedTags = rawTags
    .map((tag) => normalizeTag(String(tag)))
    .filter((tag) => tag.length > 0)
    .slice(0, 4);

  if (normalizedTags.length > 0) {
    return `MEM:${record.eventType}:${normalizedTags.join(':')}`;
  }

  if (record.counterpartId) {
    return `MEM:${record.eventType}:${normalizeTag(record.counterpartId)}`;
  }

  return undefined;
}

function buildMemoryAnchorsFromRecords(
  records: readonly EpisodicMemoryRecord[],
  roomId: string,
): readonly SharedChatMemoryAnchor[] {
  return records
    .filter((record) => record.triggerContext.roomId === roomId)
    .slice(0, 24)
    .map((record) => ({
      anchorId: record.memoryId,
      anchorType: mapMemoryEventTypeToAnchor(record.eventType),
      roomId,
      channelId: normalizeVisibleChannel(record.triggerContext.channelId),
      messageIds: record.triggerContext.messageId ? [record.triggerContext.messageId] : [],
      salience: clamp01(record.salience01),
      createdAt: record.createdAt,
      embeddingKey: extractMemoryEmbeddingKey(record),
    }));
}

function buildMemoryAnchorsFromSnapshot(snapshot: EpisodicMemorySnapshot, roomId: string): readonly SharedChatMemoryAnchor[] {
  return buildMemoryAnchorsFromRecords(snapshot.activeMemories, roomId);
}

function memoryRoomRelevance(
  record: EpisodicMemoryRecord,
  roomId: string,
  channelId: ChatVisibleChannel | SharedChatChannelId,
  counterpartIds: readonly string[],
): number {
  const sameRoom = record.triggerContext.roomId === roomId ? 0.34 : 0;
  const sameChannel = normalizeVisibleChannel(record.triggerContext.channelId) === normalizeVisibleChannel(channelId) ? 0.16 : 0;
  const counterpartMatch = record.counterpartId && counterpartIds.includes(record.counterpartId) ? 0.18 : 0;
  const unresolvedBoost = record.unresolved ? 0.14 : 0;
  const reuseBoost = Math.min(record.timesReused, 4) * 0.03;
  const embarrassmentBoost = clamp01(record.embarrassmentRisk01) * 0.08;
  return clamp01(sameRoom + sameChannel + counterpartMatch + unresolvedBoost + reuseBoost + embarrassmentBoost);
}

function deriveMemoryContinuityTags(records: readonly EpisodicMemoryRecord[]): readonly string[] {
  const tags: string[] = [];
  for (const record of records.slice(0, 8)) {
    tags.push(`MEMORY_EVENT:${normalizeTag(record.eventType)}`);
    if (record.unresolved) tags.push('MEMORY_UNRESOLVED');
    if (record.embarrassmentRisk01 >= 0.72) tags.push('MEMORY_EMBARRASSMENT_RISK');
    if (record.callbackVariants.length > 0) tags.push('MEMORY_CALLBACK_READY');
    if (record.counterpartId) tags.push(`MEMORY_COUNTERPART:${normalizeTag(record.counterpartId)}`);
  }
  return uniq(tags);
}

function mapMemoryEventTypeToAnchor(
  eventType: EpisodicMemoryRecord['eventType'],
): SharedChatMemoryAnchor['anchorType'] {
  switch (eventType) {
    case 'BREACH':
      return 'BREACH';
    case 'RESCUE':
      return 'RESCUE';
    case 'COMEBACK':
      return 'COMEBACK';
    case 'DEAL_ROOM_STANDOFF':
      return 'DEAL_ROOM';
    case 'SOVEREIGNTY':
      return 'SOVEREIGNTY';
    case 'HUMILIATION':
      return 'HUMILIATION';
    default:
      return 'QUOTE';
  }
}

function projectRelationshipCounterparts(
  snapshot: ChatRelationshipSnapshot,
): readonly ChatRelationshipCounterpartState[] {
  return [...snapshot.counterparts].sort(
    (a, b) =>
      b.intensity01 - a.intensity01 ||
      (b.lastTouchedAt ?? 0) - (a.lastTouchedAt ?? 0) ||
      a.counterpartId.localeCompare(b.counterpartId),
  );
}

function relationshipContinuityTags(states: readonly ChatRelationshipCounterpartState[]): readonly string[] {
  const tags: string[] = [];
  for (const state of states.slice(0, 6)) {
    tags.push(`REL_STANCE:${normalizeTag(state.stance)}`);
    tags.push(`REL_OBJECTIVE:${normalizeTag(state.objective)}`);
    if (state.intensity01 >= 0.82) tags.push('REL_INTENSE');
    if (state.callbackHints.length > 0) tags.push('REL_CALLBACK_READY');
  }
  return uniq(tags);
}

function carryoverWeightFromMoment(record: ChatMomentRecord): number {
  const unresolvedBias =
    record.status === 'CARRIED_OVER' || record.status === 'WAITING_ON_REVEAL' || record.status === 'WAITING_ON_PLAYER'
      ? 0.25
      : record.status === 'WAITING_ON_SILENCE'
        ? 0.18
        : record.status === 'PLANNED' || record.status === 'EMITTING'
          ? 0.12
          : 0;
  return clamp01(
    record.importance01 * 0.42 +
      record.intensity01 * 0.22 +
      archetypeSeverity(record.sceneArchetype) * 0.2 +
      unresolvedBias +
      Math.min(record.callbackAnchorIds.length, 4) * 0.04,
  );
}

function makeCarryoverRecord(record: ChatMomentRecord, createdAt: number): ChatMomentCarryoverRecord {
  return {
    carryoverId: `carryover:${record.momentId}:${createdAt}`,
    playerId: record.playerId,
    roomId: record.roomId,
    momentId: record.momentId,
    sceneId: record.sceneId,
    archetype: record.sceneArchetype,
    weight01: carryoverWeightFromMoment(record),
    createdAt,
    summaryLine: record.summaryLine,
    callbackAnchorIds: record.callbackAnchorIds,
    counterpartIds: record.counterpartIds,
    worldTags: uniq([...record.worldTags, ...record.planningTags]),
  };
}

function buildSummaryLineFromPlan(plan: SharedChatScenePlan): string {
  const beats = plan.beats.map((beat) => `${beat.beatType}:${beat.sceneRole}`).join(' > ');
  return `${plan.archetype} [${plan.momentType}] ${beats}`;
}

/* ============================================================================
 * MARK: ChatMomentLedger
 * ============================================================================
 */

export class ChatMomentLedger {
  private readonly config: ChatMomentLedgerConfig;
  private readonly players = new Map<string, PlayerMomentBucket>();
  private readonly rooms = new Map<string, RoomMomentBucket>();
  private createdAt = now();
  private updatedAt = this.createdAt;
  private stats: ChatMomentLedgerStats = {
    registeredMoments: 0,
    resolvedMoments: 0,
    carriedMoments: 0,
    cancelledMoments: 0,
    timedOutMoments: 0,
    activeSilenceWindows: 0,
    activeRevealReservations: 0,
    visibleEmissions: 0,
    shadowEmissions: 0,
  };

  public constructor(config: Partial<ChatMomentLedgerConfig> = {}) {
    this.config = Object.freeze({
      ...DEFAULT_CHAT_MOMENT_LEDGER_CONFIG,
      ...config,
      runtimeConfig: config.runtimeConfig ?? DEFAULT_CHAT_MOMENT_LEDGER_CONFIG.runtimeConfig,
    });
  }

  /* -------------------------------------------------------------------------
   * MARK: bucket management
   * -------------------------------------------------------------------------
   */

  private ensurePlayer(playerId: string): PlayerMomentBucket {
    const current = this.players.get(playerId);
    if (current) return current;

    const bucket: PlayerMomentBucket = {
      playerId,
      createdAt: now(),
      updatedAt: now(),
      totalMomentCount: 0,
      moments: new Map<string, ChatMomentRecord>(),
      roomIds: new Set<string>(),
      carryover: [],
      revealReservations: new Map<string, ChatMomentRevealReservation>(),
      silenceWindows: new Map<string, ChatMomentSilenceWindow>(),
      emissions: new Map<string, ChatMomentEmission>(),
    };

    this.players.set(playerId, bucket);
    return bucket;
  }

  private ensureRoom(roomId: string): RoomMomentBucket {
    const current = this.rooms.get(roomId);
    if (current) return current;

    const bucket: RoomMomentBucket = {
      roomId,
      createdAt: now(),
      updatedAt: now(),
      playerIds: new Set<string>(),
      momentIdsByUpdatedDesc: [],
      unresolvedMomentIds: new Set<string>(),
      activeRevealReservationIds: new Set<string>(),
      activeSilenceWindowIds: new Set<string>(),
    };

    this.rooms.set(roomId, bucket);
    return bucket;
  }

  private touch(playerId: string, roomId: string, at: number): void {
    const player = this.ensurePlayer(playerId);
    const room = this.ensureRoom(roomId);
    player.updatedAt = at;
    room.updatedAt = at;
    this.updatedAt = at;
    player.roomIds.add(roomId);
    room.playerIds.add(playerId);
  }

  private resortRoomMoments(room: RoomMomentBucket, player: PlayerMomentBucket): void {
    const knownIds = new Set<string>();
    const next = [...room.momentIdsByUpdatedDesc]
      .filter((momentId) => {
        if (knownIds.has(momentId)) return false;
        knownIds.add(momentId);
        return player.moments.has(momentId) || this.findMomentRecord(momentId) != null;
      });

    for (const momentId of player.moments.keys()) {
      const record = player.moments.get(momentId);
      if (!record || record.roomId !== room.roomId) continue;
      if (knownIds.has(momentId)) continue;
      knownIds.add(momentId);
      next.push(momentId);
    }

    next.sort((leftId, rightId) => {
      const left = this.findMomentRecord(leftId);
      const right = this.findMomentRecord(rightId);
      return (right?.updatedAt ?? 0) - (left?.updatedAt ?? 0);
    });

    room.momentIdsByUpdatedDesc = next.slice(0, this.config.maxMomentsPerPlayer);
  }

  private trimPlayer(player: PlayerMomentBucket): void {
    const sorted = [...player.moments.values()].sort((a, b) => b.updatedAt - a.updatedAt);

    if (sorted.length > this.config.maxMomentsPerPlayer) {
      const keepIds = new Set(sorted.slice(0, this.config.maxMomentsPerPlayer).map((record) => record.momentId));
      for (const record of sorted.slice(this.config.maxMomentsPerPlayer)) {
        player.moments.delete(record.momentId);
        const room = this.ensureRoom(record.roomId);
        room.unresolvedMomentIds.delete(record.momentId);
        room.activeRevealReservationIds.forEach((reservationId) => {
          const reservation = player.revealReservations.get(reservationId);
          if (reservation?.momentId === record.momentId) {
            player.revealReservations.delete(reservationId);
          }
        });
        room.activeSilenceWindowIds.forEach((silenceId) => {
          const silence = player.silenceWindows.get(silenceId);
          if (silence?.momentId === record.momentId) {
            player.silenceWindows.delete(silenceId);
          }
        });
      }

      for (const roomId of player.roomIds) {
        const room = this.ensureRoom(roomId);
        room.momentIdsByUpdatedDesc = room.momentIdsByUpdatedDesc.filter((momentId) => keepIds.has(momentId));
      }
    }

    player.carryover = [...player.carryover]
      .filter((record) => now() - record.createdAt <= this.config.carryoverTtlMs)
      .sort((a, b) => b.createdAt - a.createdAt || b.weight01 - a.weight01)
      .slice(0, this.config.maxCarryoverPerPlayer);

    const revealSorted = [...player.revealReservations.values()]
      .filter((reservation) => reservation.status !== 'EXPIRED' && reservation.status !== 'CANCELLED')
      .sort((a, b) => b.createdAt - a.createdAt);

    if (revealSorted.length > this.config.maxRevealReservationsPerPlayer) {
      const keepIds = new Set(
        revealSorted.slice(0, this.config.maxRevealReservationsPerPlayer).map((reservation) => reservation.reservationId),
      );
      for (const reservationId of player.revealReservations.keys()) {
        if (!keepIds.has(reservationId)) {
          player.revealReservations.delete(reservationId);
        }
      }
    }

    const silenceSorted = [...player.silenceWindows.values()]
      .filter((window) => window.closedAt == null || now() - (window.closedAt ?? 0) <= this.config.silenceDefaultTtlMs)
      .sort((a, b) => b.createdAt - a.createdAt);

    if (silenceSorted.length > this.config.maxSilenceWindowsPerPlayer) {
      const keepIds = new Set(silenceSorted.slice(0, this.config.maxSilenceWindowsPerPlayer).map((window) => window.silenceId));
      for (const silenceId of player.silenceWindows.keys()) {
        if (!keepIds.has(silenceId)) {
          player.silenceWindows.delete(silenceId);
        }
      }
    }
  }

  private findMomentRecord(momentId: string): ChatMomentRecord | undefined {
    for (const player of this.players.values()) {
      const record = player.moments.get(momentId);
      if (record) return record;
    }
    return undefined;
  }

  private getPlayerForMoment(momentId: string): PlayerMomentBucket | undefined {
    for (const player of this.players.values()) {
      if (player.moments.has(momentId)) return player;
    }
    return undefined;
  }

  private getRoomForMoment(momentId: string): RoomMomentBucket | undefined {
    const record = this.findMomentRecord(momentId);
    return record ? this.ensureRoom(record.roomId) : undefined;
  }

  private recomputeStats(): void {
    let resolvedMoments = 0;
    let carriedMoments = 0;
    let cancelledMoments = 0;
    let timedOutMoments = 0;
    let activeSilenceWindows = 0;
    let activeRevealReservations = 0;
    let visibleEmissions = 0;
    let shadowEmissions = 0;

    for (const player of this.players.values()) {
      for (const moment of player.moments.values()) {
        if (moment.status === 'RESOLVED') resolvedMoments += 1;
        if (moment.status === 'CARRIED_OVER') carriedMoments += 1;
        if (moment.status === 'CANCELLED') cancelledMoments += 1;
        if (moment.status === 'TIMED_OUT') timedOutMoments += 1;
      }
      for (const window of player.silenceWindows.values()) {
        if (!window.closedAt && now() <= window.closesAt) activeSilenceWindows += 1;
      }
      for (const reservation of player.revealReservations.values()) {
        if (
          reservation.status === 'QUEUED' ||
          reservation.status === 'LEASED' ||
          reservation.status === 'READY' ||
          reservation.status === 'RELEASED'
        ) {
          activeRevealReservations += 1;
        }
      }
      for (const emission of player.emissions.values()) {
        if (emission.kind === 'VISIBLE') visibleEmissions += 1;
        if (emission.kind === 'SHADOW' || emission.kind === 'ANNOTATION') shadowEmissions += 1;
      }
    }

    this.stats = {
      registeredMoments: [...this.players.values()].reduce((sum, player) => sum + player.totalMomentCount, 0),
      resolvedMoments,
      carriedMoments,
      cancelledMoments,
      timedOutMoments,
      activeSilenceWindows,
      activeRevealReservations,
      visibleEmissions,
      shadowEmissions,
    };
  }

  /* -------------------------------------------------------------------------
   * MARK: registration
   * -------------------------------------------------------------------------
   */

  public registerMoment(input: ChatMomentRegistrationInput): ChatMomentRecord {
    const createdAt = input.createdAt ?? now();
    const pressureTier = normalizePressureTier(input.pressureTier);
    const intensity01 = clamp01(
      input.intensity01 ??
        avg01([pressureTo01(pressureTier), momentImportance(input.momentType)]),
    );

    const record: ChatMomentRecord = {
      momentId: input.momentId,
      playerId: input.playerId,
      roomId: input.roomId,
      primaryChannelId: normalizeVisibleChannel(input.primaryChannelId),
      momentType: input.momentType,
      createdAt,
      updatedAt: createdAt,
      causeEventId: input.causeEventId,
      sourceMessageId: input.sourceMessageId,
      sourcePlanId: input.sourcePlanId,
      pressureTier,
      intensity01,
      importance01: momentImportance(input.momentType),
      status: 'REGISTERED',
      sceneId: undefined,
      sceneArchetype: undefined,
      scenePlan: undefined,
      archiveId: undefined,
      worldTags: uniq(asArray(input.worldTags).map(normalizeTag)),
      planningTags: uniq(asArray(input.planningTags).map(normalizeTag)),
      counterpartIds: uniq(asArray(input.counterpartIds)),
      callbackAnchorIds: uniq(asArray(input.callbackAnchorIds)),
      pendingRevealReservationIds: [],
      activeSilenceWindowIds: [],
      visibleEmissionIds: [],
      shadowEmissionIds: [],
      witnessTail: [],
      unresolvedReasons: uniq(asArray(input.unresolvedReasons).map(String)),
      carryoverWeight01: 0,
      summaryLine: normalizeSummary(
        input.summaryLine,
        `${input.momentType} @ ${normalizeVisibleChannel(input.primaryChannelId)}`,
      ),
      lastMeaningfulMutationAt: createdAt,
      resolvedAt: undefined,
      outcome: undefined,
    };

    const player = this.ensurePlayer(input.playerId);
    const room = this.ensureRoom(input.roomId);

    player.moments.set(record.momentId, record);
    player.totalMomentCount += 1;
    room.unresolvedMomentIds.add(record.momentId);

    this.touch(input.playerId, input.roomId, createdAt);
    this.resortRoomMoments(room, player);
    this.trimPlayer(player);
    this.recomputeStats();

    return record;
  }

  public attachScenePlan(momentId: string, attachment: ChatMomentPlanAttachment): ChatMomentRecord | undefined {
    const player = this.getPlayerForMoment(momentId);
    if (!player) return undefined;

    const current = player.moments.get(momentId);
    if (!current) return undefined;

    const attachedAt = attachment.attachedAt ?? now();
    const archiveId = current.archiveId ?? `scene-archive:${attachment.scene.sceneId}`;

    let archiveRecord: SharedChatSceneArchiveRecord | undefined;
    if (this.config.archiveService) {
      archiveRecord = this.config.archiveService.archiveScene(
        current.playerId,
        current.roomId,
        normalizeVisibleChannel(current.primaryChannelId),
        attachment.scene,
        {
          counterpartIds: uniq([
            ...current.counterpartIds,
            ...asArray(attachment.counterpartIds),
          ]),
          callbackAnchorIds: uniq([
            ...current.callbackAnchorIds,
            ...asArray(attachment.callbackAnchorIds),
            ...asArray(attachment.scene.callbackAnchorIds),
          ]),
          tags: uniq([
            ...current.worldTags,
            ...current.planningTags,
            ...asArray(attachment.worldTags).map(normalizeTag),
            ...asArray(attachment.planningTags).map(normalizeTag),
          ]),
        },
      );
    }

    const next = this.upsertMoment(momentId, {
      status: current.status === 'REGISTERED' ? 'PLANNED' : current.status,
      updatedAt: attachedAt,
      sceneId: attachment.scene.sceneId,
      sceneArchetype: attachment.scene.archetype,
      scenePlan: attachment.scene,
      archiveId: archiveRecord?.archiveId ?? archiveId,
      worldTags: uniq([
        ...current.worldTags,
        ...asArray(attachment.worldTags).map(normalizeTag),
      ]),
      planningTags: uniq([
        ...current.planningTags,
        ...asArray(attachment.planningTags).map(normalizeTag),
        ...asArray(attachment.scene.planningTags).map(normalizeTag),
      ]),
      counterpartIds: uniq([
        ...current.counterpartIds,
        ...asArray(attachment.counterpartIds),
      ]),
      callbackAnchorIds: uniq([
        ...current.callbackAnchorIds,
        ...asArray(attachment.callbackAnchorIds),
        ...asArray(attachment.scene.callbackAnchorIds),
      ]),
      unresolvedReasons: uniq([
        ...current.unresolvedReasons,
        ...asArray(attachment.unresolvedReasons).map(String),
      ]),
      summaryLine: normalizeSummary(
        attachment.summaryLine,
        buildSummaryLineFromPlan(attachment.scene),
      ),
      lastMeaningfulMutationAt: attachedAt,
    });

    return next;
  }

  public upsertArchiveId(momentId: string, archiveId: string, at = now()): ChatMomentRecord | undefined {
    return this.upsertMoment(momentId, {
      archiveId,
      updatedAt: at,
      lastMeaningfulMutationAt: at,
    });
  }

  public noteCounterparts(momentId: string, counterpartIds: readonly string[], at = now()): ChatMomentRecord | undefined {
    const current = this.findMomentRecord(momentId);
    if (!current) return undefined;

    return this.upsertMoment(momentId, {
      counterpartIds: uniq([...current.counterpartIds, ...counterpartIds]),
      updatedAt: at,
      lastMeaningfulMutationAt: at,
    });
  }

  public noteCallbackAnchors(momentId: string, callbackAnchorIds: readonly string[], at = now()): ChatMomentRecord | undefined {
    const current = this.findMomentRecord(momentId);
    if (!current) return undefined;

    return this.upsertMoment(momentId, {
      callbackAnchorIds: uniq([...current.callbackAnchorIds, ...callbackAnchorIds]),
      updatedAt: at,
      lastMeaningfulMutationAt: at,
    });
  }

  public notePlanningTags(momentId: string, tags: readonly string[], at = now()): ChatMomentRecord | undefined {
    const current = this.findMomentRecord(momentId);
    if (!current) return undefined;

    return this.upsertMoment(momentId, {
      planningTags: uniq([...current.planningTags, ...tags.map(normalizeTag)]),
      updatedAt: at,
      lastMeaningfulMutationAt: at,
    });
  }

  public noteWorldTags(momentId: string, tags: readonly string[], at = now()): ChatMomentRecord | undefined {
    const current = this.findMomentRecord(momentId);
    if (!current) return undefined;

    return this.upsertMoment(momentId, {
      worldTags: uniq([...current.worldTags, ...tags.map(normalizeTag)]),
      updatedAt: at,
      lastMeaningfulMutationAt: at,
    });
  }

  /* -------------------------------------------------------------------------
   * MARK: emission and witness lifecycle
   * -------------------------------------------------------------------------
   */

  public recordEmission(input: {
    readonly playerId: string;
    readonly roomId: string;
    readonly momentId: string;
    readonly sceneId?: string;
    readonly beatId?: string;
    readonly messageId: ChatMessageId;
    readonly channelId: ChatChannelId;
    readonly kind: 'VISIBLE' | 'SHADOW' | 'ANNOTATION';
    readonly source: ChatMomentEmission['source'];
    readonly createdAt?: number;
    readonly tags?: readonly string[];
  }): ChatMomentEmission | undefined {
    const player = this.ensurePlayer(input.playerId);
    const current = player.moments.get(input.momentId);
    if (!current) return undefined;

    const createdAt = input.createdAt ?? now();
    const emission: ChatMomentEmission = {
      emissionId: `emission:${input.messageId}`,
      momentId: input.momentId,
      sceneId: input.sceneId ?? current.sceneId,
      beatId: input.beatId,
      messageId: input.messageId,
      channelId: input.channelId,
      kind: input.kind,
      source: input.source,
      createdAt,
      tags: uniq(asArray(input.tags).map(normalizeTag)),
    };

    player.emissions.set(emission.emissionId, emission);

    const nextStatus: ChatMomentStatus =
      input.kind === 'ANNOTATION'
        ? current.status
        : current.status === 'REGISTERED' || current.status === 'PLANNED'
          ? 'EMITTING'
          : current.status;

    const next = this.upsertMoment(input.momentId, {
      status: nextStatus,
      updatedAt: createdAt,
      visibleEmissionIds:
        input.kind === 'VISIBLE'
          ? uniq([...current.visibleEmissionIds, emission.emissionId])
          : current.visibleEmissionIds,
      shadowEmissionIds:
        input.kind !== 'VISIBLE'
          ? uniq([...current.shadowEmissionIds, emission.emissionId])
          : current.shadowEmissionIds,
      lastMeaningfulMutationAt: createdAt,
    });

    this.touch(input.playerId, input.roomId, createdAt);
    this.recomputeStats();
    return emission;
  }

  public addWitness(input: {
    readonly momentId: string;
    readonly witnessId: string;
    readonly witnessKind: ChatMomentWitnessState['witnessKind'];
    readonly channelId: ChatChannelId;
    readonly intensity01: number;
    readonly at?: number;
    readonly tags?: readonly string[];
  }): ChatMomentRecord | undefined {
    const player = this.getPlayerForMoment(input.momentId);
    if (!player) return undefined;

    const current = player.moments.get(input.momentId);
    if (!current) return undefined;

    const addedAt = input.at ?? now();
    const witness: ChatMomentWitnessState = {
      witnessId: input.witnessId,
      witnessKind: input.witnessKind,
      channelId: input.channelId,
      intensity01: clamp01(input.intensity01),
      addedAt,
      tags: uniq(asArray(input.tags).map(normalizeTag)),
    };

    const nextWitnessTail = [witness, ...current.witnessTail]
      .slice(0, this.config.maxWitnessTail)
      .sort((a, b) => b.addedAt - a.addedAt);

    return this.upsertMoment(input.momentId, {
      witnessTail: nextWitnessTail,
      updatedAt: addedAt,
      lastMeaningfulMutationAt: addedAt,
    });
  }

  public setWaitingOnPlayer(momentId: string, reason = 'PLAYER_REPLY_WINDOW', at = now()): ChatMomentRecord | undefined {
    const current = this.findMomentRecord(momentId);
    if (!current) return undefined;

    return this.upsertMoment(momentId, {
      status: 'WAITING_ON_PLAYER',
      unresolvedReasons: uniq([...current.unresolvedReasons, reason]),
      updatedAt: at,
      lastMeaningfulMutationAt: at,
    });
  }

  public setWaitingOnReveal(momentId: string, reason = 'REVEAL_PENDING', at = now()): ChatMomentRecord | undefined {
    const current = this.findMomentRecord(momentId);
    if (!current) return undefined;

    return this.upsertMoment(momentId, {
      status: 'WAITING_ON_REVEAL',
      unresolvedReasons: uniq([...current.unresolvedReasons, reason]),
      updatedAt: at,
      lastMeaningfulMutationAt: at,
    });
  }

  public setWaitingOnSilence(momentId: string, reason = 'SILENCE_ACTIVE', at = now()): ChatMomentRecord | undefined {
    const current = this.findMomentRecord(momentId);
    if (!current) return undefined;

    return this.upsertMoment(momentId, {
      status: 'WAITING_ON_SILENCE',
      unresolvedReasons: uniq([...current.unresolvedReasons, reason]),
      updatedAt: at,
      lastMeaningfulMutationAt: at,
    });
  }

  /* -------------------------------------------------------------------------
   * MARK: reveal reservations
   * -------------------------------------------------------------------------
   */

  public reserveReveal(input: {
    readonly playerId: string;
    readonly roomId: string;
    readonly momentId: string;
    readonly sceneId?: string;
    readonly channelId: ChatChannelId;
    readonly payloadId: string;
    readonly revealKind: ChatMomentRevealReservation['revealKind'];
    readonly notBefore?: number;
    readonly expiresAt?: number;
    readonly weight01?: number;
    readonly counterpartId?: string;
    readonly callbackAnchorIds?: readonly string[];
    readonly tags?: readonly string[];
    readonly createdAt?: number;
  }): ChatMomentRevealReservation | undefined {
    const player = this.ensurePlayer(input.playerId);
    const current = player.moments.get(input.momentId);
    if (!current) return undefined;

    const createdAt = input.createdAt ?? now();
    const reservation: ChatMomentRevealReservation = {
      reservationId: `reveal:${input.payloadId}:${createdAt}`,
      momentId: input.momentId,
      sceneId: input.sceneId ?? current.sceneId,
      roomId: input.roomId,
      playerId: input.playerId,
      channelId: input.channelId,
      payloadId: input.payloadId,
      revealKind: input.revealKind,
      weight01: clamp01(input.weight01 ?? current.importance01),
      createdAt,
      notBefore: input.notBefore ?? createdAt,
      expiresAt: input.expiresAt ?? createdAt + this.config.revealDefaultTtlMs,
      counterpartId: input.counterpartId,
      callbackAnchorIds: uniq([
        ...current.callbackAnchorIds,
        ...asArray(input.callbackAnchorIds),
      ]),
      tags: uniq([
        ...current.worldTags,
        ...current.planningTags,
        ...asArray(input.tags).map(normalizeTag),
      ]),
      status: 'QUEUED',
      leaseOwner: undefined,
      leasedAt: undefined,
      releasedAt: undefined,
      consumedAt: undefined,
    };

    player.revealReservations.set(reservation.reservationId, reservation);
    const room = this.ensureRoom(input.roomId);
    room.activeRevealReservationIds.add(reservation.reservationId);

    this.upsertMoment(input.momentId, {
      status: 'WAITING_ON_REVEAL',
      pendingRevealReservationIds: uniq([
        ...current.pendingRevealReservationIds,
        reservation.reservationId,
      ]),
      updatedAt: createdAt,
      lastMeaningfulMutationAt: createdAt,
      unresolvedReasons: uniq([...current.unresolvedReasons, `REVEAL:${reservation.revealKind}`]),
    });

    this.trimPlayer(player);
    this.recomputeStats();
    return reservation;
  }

  public leaseReadyReveal(input: {
    readonly playerId: string;
    readonly roomId: string;
    readonly leaseOwner: string;
    readonly at?: number;
    readonly channelId?: ChatChannelId;
  }): ChatMomentRevealReservation | undefined {
    const player = this.ensurePlayer(input.playerId);
    const at = input.at ?? now();

    const pool = [...player.revealReservations.values()]
      .filter((reservation) => reservation.roomId === input.roomId)
      .filter((reservation) => !input.channelId || reservation.channelId === input.channelId)
      .filter((reservation) => reservation.status === 'QUEUED' || reservation.status === 'READY' || reservation.status === 'RELEASED')
      .filter((reservation) => reservation.notBefore <= at)
      .filter((reservation) => reservation.expiresAt > at)
      .sort((a, b) => b.weight01 - a.weight01 || a.createdAt - b.createdAt);

    const candidate = pool[0];
    if (!candidate) return undefined;

    const leased: ChatMomentRevealReservation = {
      ...candidate,
      status: 'LEASED',
      leaseOwner: input.leaseOwner,
      leasedAt: at,
    };

    player.revealReservations.set(leased.reservationId, leased);
    this.updatedAt = at;
    this.recomputeStats();
    return leased;
  }

  public markRevealReady(playerId: string, reservationId: string, at = now()): ChatMomentRevealReservation | undefined {
    return this.patchReveal(playerId, reservationId, {
      status: 'READY',
      releasedAt: at,
    });
  }

  public releaseReveal(playerId: string, reservationId: string, at = now()): ChatMomentRevealReservation | undefined {
    return this.patchReveal(playerId, reservationId, {
      status: 'RELEASED',
      releasedAt: at,
      leaseOwner: undefined,
    });
  }

  public consumeReveal(playerId: string, reservationId: string, at = now()): ChatMomentRevealReservation | undefined {
    const player = this.ensurePlayer(playerId);
    const current = player.revealReservations.get(reservationId);
    if (!current) return undefined;

    const next = this.patchReveal(playerId, reservationId, {
      status: 'CONSUMED',
      consumedAt: at,
      releasedAt: at,
      leaseOwner: undefined,
    });

    const record = player.moments.get(current.momentId);
    if (record) {
      const remaining = record.pendingRevealReservationIds.filter((id) => id !== reservationId);
      this.upsertMoment(current.momentId, {
        pendingRevealReservationIds: remaining,
        status: remaining.length > 0 ? 'WAITING_ON_REVEAL' : record.status === 'WAITING_ON_REVEAL' ? 'EMITTING' : record.status,
        updatedAt: at,
        lastMeaningfulMutationAt: at,
      });
    }

    const room = this.ensureRoom(current.roomId);
    room.activeRevealReservationIds.delete(reservationId);
    this.recomputeStats();
    return next;
  }

  public cancelReveal(playerId: string, reservationId: string, reason = 'cancelled', at = now()): ChatMomentRevealReservation | undefined {
    const player = this.ensurePlayer(playerId);
    const current = player.revealReservations.get(reservationId);
    if (!current) return undefined;

    const next = this.patchReveal(playerId, reservationId, {
      status: 'CANCELLED',
      releasedAt: at,
      consumedAt: undefined,
      leaseOwner: undefined,
      tags: uniq([...current.tags, `REASON:${normalizeTag(reason)}`]),
    });

    const record = player.moments.get(current.momentId);
    if (record) {
      const remaining = record.pendingRevealReservationIds.filter((id) => id !== reservationId);
      this.upsertMoment(current.momentId, {
        pendingRevealReservationIds: remaining,
        status:
          record.status === 'WAITING_ON_REVEAL' && remaining.length === 0
            ? 'PLANNED'
            : record.status,
        updatedAt: at,
        lastMeaningfulMutationAt: at,
      });
    }

    const room = this.ensureRoom(current.roomId);
    room.activeRevealReservationIds.delete(reservationId);
    this.recomputeStats();
    return next;
  }

  private patchReveal(
    playerId: string,
    reservationId: string,
    patch: Partial<ChatMomentRevealReservation>,
  ): ChatMomentRevealReservation | undefined {
    const player = this.ensurePlayer(playerId);
    const current = player.revealReservations.get(reservationId);
    if (!current) return undefined;

    const next: ChatMomentRevealReservation = {
      ...current,
      ...patch,
      callbackAnchorIds: patch.callbackAnchorIds ? uniq(patch.callbackAnchorIds) : current.callbackAnchorIds,
      tags: patch.tags ? uniq(patch.tags) : current.tags,
    };

    if (next.expiresAt <= now() && next.status !== 'CONSUMED' && next.status !== 'CANCELLED') {
      next.status = 'EXPIRED';
    }

    player.revealReservations.set(reservationId, next);
    this.updatedAt = now();
    return next;
  }

  /* -------------------------------------------------------------------------
   * MARK: silence windows
   * -------------------------------------------------------------------------
   */

  public openSilenceWindow(input: {
    readonly playerId: string;
    readonly roomId: string;
    readonly momentId: string;
    readonly sceneId?: string;
    readonly channelId: ChatChannelId;
    readonly purpose: ChatSilenceWindowPurpose;
    readonly opensAt?: number;
    readonly closesAt?: number;
    readonly weight01?: number;
    readonly interruptible?: boolean;
    readonly shadowOnly?: boolean;
    readonly inheritedFromMomentId?: string;
    readonly preferredCounterpartId?: string;
    readonly tags?: readonly string[];
    readonly reasonSummary?: string;
    readonly createdAt?: number;
  }): ChatMomentSilenceWindow | undefined {
    const player = this.ensurePlayer(input.playerId);
    const current = player.moments.get(input.momentId);
    if (!current) return undefined;

    const createdAt = input.createdAt ?? now();
    const opensAt = input.opensAt ?? createdAt;
    const closesAt =
      input.closesAt ??
      createdAt +
        Math.max(
          this.config.runtimeConfig?.ratePolicy.npcMinimumGapMs ?? 1_200,
          this.config.silenceDefaultTtlMs,
        );

    const window: ChatMomentSilenceWindow = {
      silenceId: `silence:${input.momentId}:${createdAt}:${normalizeTag(input.purpose)}`,
      playerId: input.playerId,
      roomId: input.roomId,
      momentId: input.momentId,
      sceneId: input.sceneId ?? current.sceneId,
      channelId: input.channelId,
      purpose: input.purpose,
      createdAt,
      opensAt,
      closesAt,
      weight01: clamp01(input.weight01 ?? current.intensity01),
      interruptible: input.interruptible ?? true,
      shadowOnly: input.shadowOnly ?? false,
      inheritedFromMomentId: input.inheritedFromMomentId,
      preferredCounterpartId: input.preferredCounterpartId,
      tags: uniq([
        ...current.worldTags,
        ...current.planningTags,
        ...asArray(input.tags).map(normalizeTag),
      ]),
      reasonSummary: normalizeSummary(input.reasonSummary, input.purpose),
      closedAt: undefined,
      closeReason: undefined,
    };

    player.silenceWindows.set(window.silenceId, window);
    const room = this.ensureRoom(input.roomId);
    room.activeSilenceWindowIds.add(window.silenceId);

    this.upsertMoment(input.momentId, {
      status: 'WAITING_ON_SILENCE',
      activeSilenceWindowIds: uniq([...current.activeSilenceWindowIds, window.silenceId]),
      updatedAt: createdAt,
      lastMeaningfulMutationAt: createdAt,
      unresolvedReasons: uniq([...current.unresolvedReasons, `SILENCE:${input.purpose}`]),
    });

    this.trimPlayer(player);
    this.recomputeStats();
    return window;
  }

  public closeSilenceWindow(
    playerId: string,
    silenceId: string,
    reason = 'closed',
    at = now(),
  ): ChatMomentSilenceWindow | undefined {
    const player = this.ensurePlayer(playerId);
    const current = player.silenceWindows.get(silenceId);
    if (!current) return undefined;

    const next: ChatMomentSilenceWindow = {
      ...current,
      closedAt: at,
      closeReason: reason,
    };

    player.silenceWindows.set(silenceId, next);

    const record = player.moments.get(current.momentId);
    if (record) {
      const remaining = record.activeSilenceWindowIds.filter((id) => id !== silenceId);
      this.upsertMoment(current.momentId, {
        activeSilenceWindowIds: remaining,
        status:
          remaining.length > 0
            ? 'WAITING_ON_SILENCE'
            : record.status === 'WAITING_ON_SILENCE'
              ? 'PLANNED'
              : record.status,
        updatedAt: at,
        lastMeaningfulMutationAt: at,
      });
    }

    const room = this.ensureRoom(current.roomId);
    room.activeSilenceWindowIds.delete(silenceId);

    this.recomputeStats();
    return next;
  }

  public getActiveSilenceWindows(input: {
    readonly playerId?: string;
    readonly roomId?: string;
    readonly channelId?: ChatChannelId;
    readonly at?: number;
  } = {}): readonly ChatMomentSilenceWindow[] {
    const at = input.at ?? now();
    const pool = input.playerId
      ? [...this.ensurePlayer(input.playerId).silenceWindows.values()]
      : [...this.players.values()].flatMap((player) => [...player.silenceWindows.values()]);

    return pool
      .filter((window) => window.closedAt == null)
      .filter((window) => window.opensAt <= at && window.closesAt >= at)
      .filter((window) => !input.roomId || window.roomId === input.roomId)
      .filter((window) => !input.channelId || window.channelId === input.channelId)
      .sort((a, b) => b.weight01 - a.weight01 || a.opensAt - b.opensAt);
  }

  /* -------------------------------------------------------------------------
   * MARK: resolution
   * -------------------------------------------------------------------------
   */

  public resolveMoment(input: ChatMomentResolutionInput): ChatMomentRecord | undefined {
    const player = this.ensurePlayer(input.playerId);
    const current = player.moments.get(input.momentId);
    if (!current) return undefined;

    const resolvedAt = input.resolvedAt ?? now();
    const generatedTags = asArray(input.generatedTags).map(normalizeTag);
    const status: ChatMomentStatus =
      input.carryOver ? 'CARRIED_OVER' : input.outcome.outcomeKind === 'CANCELLED'
        ? 'CANCELLED'
        : input.outcome.outcomeKind === 'TIMED_OUT'
          ? 'TIMED_OUT'
          : 'RESOLVED';

    if (input.archived !== false && this.config.archiveOnResolve && this.config.archiveService && current.sceneId) {
      this.config.archiveService.appendOutcome(current.playerId, current.sceneId, input.outcome);
    }

    if (input.resolveRevealReservations !== false) {
      for (const reservationId of current.pendingRevealReservationIds) {
        this.cancelReveal(current.playerId, reservationId, 'moment_resolved', resolvedAt);
      }
    }

    if (input.resolveMemoryIds?.length && this.config.memoryService) {
      for (const memoryId of input.resolveMemoryIds) {
        this.config.memoryService.resolve(current.playerId, memoryId);
      }
    }

    const next = this.upsertMoment(current.momentId, {
      status,
      updatedAt: resolvedAt,
      resolvedAt,
      outcome: {
        ...input.outcome,
        generatedTags: uniq([
          ...asArray(input.outcome.generatedTags),
          ...generatedTags,
        ]),
      },
      planningTags: uniq([...current.planningTags, ...generatedTags]),
      summaryLine: normalizeSummary(input.finalSummary, input.outcome.summary),
      carryoverWeight01: input.carryOver ? carryoverWeightFromMoment(current) : 0,
      unresolvedReasons: input.carryOver ? current.unresolvedReasons : [],
      lastMeaningfulMutationAt: resolvedAt,
    });

    if (!next) return undefined;

    const room = this.ensureRoom(next.roomId);
    room.unresolvedMomentIds.delete(next.momentId);

    if (status === 'CARRIED_OVER') {
      const carryover = makeCarryoverRecord(next, resolvedAt);
      player.carryover = [carryover, ...player.carryover]
        .sort((a, b) => b.createdAt - a.createdAt || b.weight01 - a.weight01)
        .slice(0, this.config.maxCarryoverPerPlayer);
    }

    this.trimPlayer(player);
    this.recomputeStats();
    return next;
  }

  public cancelMoment(
    playerId: string,
    momentId: string,
    reason = 'cancelled',
    at = now(),
  ): ChatMomentRecord | undefined {
    return this.resolveMoment({
      playerId,
      momentId,
      resolvedAt: at,
      outcome: {
        outcomeKind: 'CANCELLED',
        resolvedAt: at,
        summary: reason,
        generatedTags: [`MOMENT_CANCELLED`, `REASON:${normalizeTag(reason)}`],
      },
      finalSummary: reason,
      carryOver: false,
    });
  }

  public timeoutStaleMoments(at = now()): readonly ChatMomentRecord[] {
    const timedOut: ChatMomentRecord[] = [];

    for (const player of this.players.values()) {
      for (const record of player.moments.values()) {
        if (
          record.status === 'RESOLVED' ||
          record.status === 'CANCELLED' ||
          record.status === 'TIMED_OUT'
        ) {
          continue;
        }

        if (at - record.lastMeaningfulMutationAt < this.config.staleMomentMs) {
          continue;
        }

        const next = this.resolveMoment({
          playerId: record.playerId,
          momentId: record.momentId,
          resolvedAt: at,
          outcome: {
            outcomeKind: 'TIMED_OUT',
            resolvedAt: at,
            summary: 'moment timed out',
            generatedTags: ['MOMENT_TIMED_OUT'],
          },
          finalSummary: `${record.summaryLine} [timed out]`,
          carryOver: false,
        });

        if (next) timedOut.push(next);
      }
    }

    this.recomputeStats();
    return timedOut;
  }

  /* -------------------------------------------------------------------------
   * MARK: memory query authority
   * -------------------------------------------------------------------------
   */

  private buildPlannerMemoryQuery(input: {
    readonly playerId: string;
    readonly roomId: string;
    readonly channelId: ChatVisibleChannel | SharedChatChannelId;
    readonly counterpartIds?: readonly string[];
    readonly minSalience01?: number;
    readonly unresolvedOnly?: boolean;
    readonly activeOnly?: boolean;
    readonly limit?: number;
  }): EpisodicMemoryQuery {
    const normalizedCounterpartId = asArray(input.counterpartIds).find((value) => String(value ?? '').trim().length > 0);

    const query: EpisodicMemoryQuery = {
      playerId: input.playerId,
      counterpartId: normalizedCounterpartId,
      roomId: input.roomId,
      channelId: normalizeVisibleChannel(input.channelId),
      unresolvedOnly: input.unresolvedOnly ?? false,
      activeOnly: input.activeOnly ?? true,
      minSalience01: clamp01(input.minSalience01 ?? 0.34),
      limit: Math.max(1, Math.min(input.limit ?? 24, 48)),
    };

    return query;
  }

  private queryPlannerMemories(input: {
    readonly playerId: string;
    readonly roomId: string;
    readonly channelId: ChatVisibleChannel | SharedChatChannelId;
    readonly counterpartIds?: readonly string[];
    readonly limit?: number;
  }): readonly EpisodicMemoryRecord[] {
    if (!this.config.memoryService) return [];

    const primaryQuery = this.buildPlannerMemoryQuery({
      playerId: input.playerId,
      roomId: input.roomId,
      channelId: input.channelId,
      counterpartIds: input.counterpartIds,
      minSalience01: 0.36,
      unresolvedOnly: false,
      activeOnly: true,
      limit: input.limit ?? 16,
    });

    const unresolvedQuery = this.buildPlannerMemoryQuery({
      playerId: input.playerId,
      roomId: input.roomId,
      channelId: input.channelId,
      counterpartIds: input.counterpartIds,
      minSalience01: 0.22,
      unresolvedOnly: true,
      activeOnly: true,
      limit: Math.max(6, Math.floor((input.limit ?? 16) / 2)),
    });

    const primary = this.config.memoryService.query(primaryQuery);
    const unresolved = this.config.memoryService.query(unresolvedQuery);
    const combined = uniq([...primary, ...unresolved]);
    const counterpartIds = uniq(asArray(input.counterpartIds));

    return [...combined]
      .sort((left, right) => {
        const leftScore = memoryRoomRelevance(left, input.roomId, input.channelId, counterpartIds);
        const rightScore = memoryRoomRelevance(right, input.roomId, input.channelId, counterpartIds);
        return (
          rightScore - leftScore ||
          (right.lastReferencedAt ?? right.createdAt) - (left.lastReferencedAt ?? left.createdAt) ||
          right.salience01 - left.salience01
        );
      })
      .slice(0, input.limit ?? 16);
  }

  public queryRelevantMemories(input: {
    readonly playerId: string;
    readonly roomId: string;
    readonly channelId: ChatVisibleChannel | SharedChatChannelId;
    readonly counterpartIds?: readonly string[];
    readonly limit?: number;
  }): readonly EpisodicMemoryRecord[] {
    return this.queryPlannerMemories(input);
  }

  /* -------------------------------------------------------------------------
   * MARK: continuity projections
   * -------------------------------------------------------------------------
   */

  public buildPlannerContext(
    playerId: string,
    roomId: string,
    channelId: ChatVisibleChannel | SharedChatChannelId,
  ): ChatMomentLedgerPlannerContext {
    const player = this.ensurePlayer(playerId);

    const relationshipState = this.config.relationshipService
      ? projectRelationshipCounterparts(this.config.relationshipService.getSnapshot(playerId)).slice(0, 12)
      : [];

    const unresolvedMomentRecords = [...player.moments.values()]
      .filter((record) =>
        record.roomId === roomId &&
        record.status !== 'RESOLVED' &&
        record.status !== 'CANCELLED' &&
        record.status !== 'TIMED_OUT',
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 16);

    const unresolvedMomentIds = unresolvedMomentRecords.map((record) => record.momentId);
    const activeCounterpartIds = uniq([
      ...relationshipState.map((state) => state.counterpartId),
      ...unresolvedMomentRecords.flatMap((record) => record.counterpartIds),
      ...player.carryover.filter((record) => record.roomId === roomId).flatMap((record) => record.counterpartIds),
    ]).slice(0, 12);

    const queriedMemories = this.queryPlannerMemories({
      playerId,
      roomId,
      channelId,
      counterpartIds: activeCounterpartIds,
      limit: 24,
    });

    const memoryAnchors = queriedMemories.length > 0
      ? buildMemoryAnchorsFromRecords(queriedMemories, roomId)
      : this.config.memoryService
        ? buildMemoryAnchorsFromSnapshot(this.config.memoryService.getSnapshot(playerId), roomId)
        : [];

    const carriedPersonaIds = relationshipState
      .filter((state) => state.intensity01 >= 0.55 || state.callbackHints.length > 0)
      .map((state) => state.counterpartId)
      .slice(0, 8);

    const pendingRevealPayloadIds = [...player.revealReservations.values()]
      .filter((reservation) => reservation.roomId === roomId)
      .filter((reservation) => reservation.status === 'QUEUED' || reservation.status === 'READY' || reservation.status === 'LEASED')
      .map((reservation) => reservation.payloadId)
      .slice(0, 16);

    const carryoverTags = player.carryover
      .filter((record) => record.roomId === roomId)
      .slice(0, 8)
      .flatMap((record) => record.worldTags);

    const continuityTags = uniq([
      ...relationshipContinuityTags(relationshipState),
      ...deriveMemoryContinuityTags(queriedMemories),
      ...carryoverTags,
      `CHANNEL:${normalizeTag(channelId)}`,
      queriedMemories.some((record) => record.unresolved) ? 'MEMORY_PRESSURE_OPEN' : 'MEMORY_PRESSURE_STABLE',
    ]);

    const suggestedCallbackAnchorIds = uniq([
      ...memoryAnchors.slice(0, 8).map((anchor) => anchor.anchorId),
      ...queriedMemories.slice(0, 8).flatMap((record) => record.callbackVariants.slice(0, 2).map((variant) => variant.callbackId)),
      ...relationshipState.flatMap((state) => state.callbackHints.slice(0, 2).map((hint) => hint.callbackId)),
      ...player.carryover.slice(0, 8).flatMap((record) => record.callbackAnchorIds),
    ]).slice(0, 24);

    return {
      relationshipState,
      memoryAnchors,
      unresolvedMomentIds,
      carriedPersonaIds,
      pendingRevealPayloadIds,
      worldTags: continuityTags,
      suggestedCallbackAnchorIds,
    };
  }

  public augmentPlannerInput(input: SharedChatScenePlannerInput): SharedChatScenePlannerInput {
    const continuity = this.buildPlannerContext(input.playerId, input.roomId, input.primaryChannel);

    return {
      ...input,
      relationshipState: input.relationshipState?.length ? input.relationshipState : continuity.relationshipState.map((state) => ({
        relationshipId: `${input.playerId}:${state.counterpartId}`,
        playerId: input.playerId,
        counterpartId: state.counterpartId,
        counterpartKind: state.counterpartKind,
        vector: {
          respect: Math.round(state.vector.respect01 * 100),
          fear: Math.round(state.vector.fear01 * 100),
          contempt: Math.round(state.vector.contempt01 * 100),
          fascination: Math.round(state.vector.fascination01 * 100),
          trust: Math.round((state.vector.familiarity01 * 0.55 + state.vector.patience01 * 0.45) * 100),
          familiarity: Math.round(state.vector.familiarity01 * 100),
          rivalryIntensity: Math.round((state.vector.unfinishedBusiness01 * 0.55 + state.vector.obsession01 * 0.45) * 100),
          rescueDebt: Math.round(state.vector.traumaDebt01 * 100),
          adviceObedience: Math.round((state.vector.respect01 * 0.55 + state.vector.patience01 * 0.45) * 100),
        },
        lastMeaningfulShiftAt: state.lastTouchedAt,
        callbacksAvailable: state.callbackHints.map((hint) => hint.callbackId),
        escalationTier:
          state.vector.obsession01 > 0.82 ? 'OBSESSIVE'
          : state.intensity01 > 0.62 ? 'ACTIVE'
          : state.intensity01 > 0.34 ? 'MILD'
          : 'NONE',
      })),
      memoryAnchors: input.memoryAnchors?.length ? input.memoryAnchors : continuity.memoryAnchors,
      unresolvedMomentIds: input.unresolvedMomentIds?.length ? input.unresolvedMomentIds : continuity.unresolvedMomentIds,
      carriedPersonaIds: input.carriedPersonaIds?.length ? input.carriedPersonaIds : continuity.carriedPersonaIds,
      pendingRevealPayloadIds: input.pendingRevealPayloadIds?.length ? input.pendingRevealPayloadIds : continuity.pendingRevealPayloadIds,
      worldTags: uniq([
        ...asArray(input.worldTags),
        ...continuity.worldTags,
      ]),
    };
  }

  public buildCarryoverSummary(playerId: string): SharedChatSceneCarryoverSummary {
    const player = this.ensurePlayer(playerId);

    const unresolvedSceneIds = [...player.moments.values()]
      .filter((record) =>
        record.status !== 'RESOLVED' &&
        record.status !== 'CANCELLED' &&
        record.status !== 'TIMED_OUT' &&
        Boolean(record.sceneId),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((record) => record.sceneId!)
      .slice(0, 16);

    const activeCounterpartIds = uniq([
      ...player.carryover.flatMap((record) => record.counterpartIds),
      ...[...player.moments.values()]
        .filter((record) => record.status !== 'RESOLVED' && record.status !== 'CANCELLED' && record.status !== 'TIMED_OUT')
        .slice(0, 8)
        .flatMap((record) => record.counterpartIds),
    ]).slice(0, 24);

    const summaryLines = player.carryover
      .sort((a, b) => b.createdAt - a.createdAt || b.weight01 - a.weight01)
      .slice(0, 5)
      .map((record) => record.summaryLine);

    const suggestedCallbackAnchorIds = uniq([
      ...player.carryover.flatMap((record) => record.callbackAnchorIds),
      ...[...player.moments.values()].flatMap((record) => record.callbackAnchorIds),
    ]).slice(0, 24);

    return {
      playerId,
      generatedAt: now(),
      unresolvedSceneIds,
      activeCounterpartIds,
      summaryLines,
      suggestedCallbackAnchorIds,
    };
  }

  /* -------------------------------------------------------------------------
   * MARK: relationship + memory enrichment
   * -------------------------------------------------------------------------
   */

  public applyRelationshipEvent(
    descriptor: ChatRelationshipEventDescriptor,
  ): ChatRelationshipCounterpartState | undefined {
    if (!this.config.relationshipService || !descriptor.playerId) {
      return undefined;
    }

    const next = this.config.relationshipService.applyEvent(descriptor);

    const record = descriptor.sceneId
      ? this.findMomentBySceneId(descriptor.playerId, descriptor.sceneId)
      : descriptor.sourcePlanId
        ? this.findMomentByPlanId(descriptor.playerId, descriptor.sourcePlanId)
        : descriptor.sourceMessageId
          ? this.findMomentBySourceMessageId(descriptor.playerId, descriptor.sourceMessageId)
          : undefined;

    if (record) {
      this.noteCounterparts(record.momentId, [descriptor.counterpartId], descriptor.createdAt);
      if (descriptor.summary) {
        this.upsertMoment(record.momentId, {
          summaryLine: `${record.summaryLine} | ${descriptor.summary}`,
          updatedAt: descriptor.createdAt,
          lastMeaningfulMutationAt: descriptor.createdAt,
        });
      }
    }

    return next;
  }

  public selectCallbackCandidates(input: {
    readonly playerId: string;
    readonly roomId: string;
    readonly channelId: ChatVisibleChannel | SharedChatChannelId;
    readonly counterpartId?: string;
    readonly botId?: string;
    readonly maxResults?: number;
    readonly pressureBand?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    readonly sceneRole?: string;
    readonly preferredTones?: readonly (
      'COLD' |
      'CEREMONIAL' |
      'MOCKING' |
      'INTIMATE' |
      'PUBLIC' |
      'PRIVATE' |
      'POST_EVENT' |
      'PRE_EVENT'
    )[];
  }): readonly EpisodicMemoryCallbackCandidate[] {
    if (!this.config.memoryService) return [];

    const query: EpisodicMemoryQuery = this.buildPlannerMemoryQuery({
      playerId: input.playerId,
      roomId: input.roomId,
      channelId: input.channelId,
      counterpartIds: input.counterpartId ? [input.counterpartId] : [],
      minSalience01: 0.18,
      unresolvedOnly: false,
      activeOnly: true,
      limit: Math.max(12, input.maxResults ?? 8),
    });

    const warmPool = this.config.memoryService
      .query(query)
      .filter((record) => !input.botId || record.botId == null || record.botId === input.botId)
      .slice(0, Math.max(12, input.maxResults ?? 8));

    for (const record of warmPool.slice(0, 3)) {
      this.config.memoryService.markReferenced(input.playerId, record.memoryId, now());
    }

    const response = this.config.memoryService.selectCallbacks({
      requestId: `callback-request:${input.playerId}:${input.roomId}:${now()}`,
      createdAt: now(),
      playerId: input.playerId,
      botId: input.botId,
      counterpartId: input.counterpartId,
      roomId: input.roomId,
      channelId: normalizeVisibleChannel(input.channelId),
      sceneRole: input.sceneRole,
      preferredTones: input.preferredTones,
      pressureBand: input.pressureBand,
      maxResults: input.maxResults ?? 8,
    });

    const warmedIds = new Set(warmPool.map((record) => record.memoryId));
    return response.candidates
      .sort((left, right) => {
        const leftWarm = warmedIds.has(left.memoryId) ? 1 : 0;
        const rightWarm = warmedIds.has(right.memoryId) ? 1 : 0;
        return rightWarm - leftWarm || right.score01 - left.score01 || left.callbackId.localeCompare(right.callbackId);
      })
      .slice(0, input.maxResults ?? 8);
  }

  /* -------------------------------------------------------------------------
   * MARK: lookup helpers
   * -------------------------------------------------------------------------
   */

  public getMoment(momentId: string): ChatMomentRecord | undefined {
    return this.findMomentRecord(momentId);
  }

  public getMomentsForPlayer(playerId: string): readonly ChatMomentRecord[] {
    return [...this.ensurePlayer(playerId).moments.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public getMomentsForRoom(roomId: string): readonly ChatMomentRecord[] {
    const room = this.ensureRoom(roomId);
    return room.momentIdsByUpdatedDesc
      .map((momentId) => this.findMomentRecord(momentId))
      .filter((value): value is ChatMomentRecord => Boolean(value));
  }

  public findMomentBySceneId(playerId: string, sceneId: string): ChatMomentRecord | undefined {
    return [...this.ensurePlayer(playerId).moments.values()].find((record) => record.sceneId === sceneId);
  }

  public findMomentByPlanId(playerId: string, sourcePlanId: string): ChatMomentRecord | undefined {
    return [...this.ensurePlayer(playerId).moments.values()].find((record) => record.sourcePlanId === sourcePlanId);
  }

  public findMomentBySourceMessageId(playerId: string, sourceMessageId: string): ChatMomentRecord | undefined {
    return [...this.ensurePlayer(playerId).moments.values()].find((record) => record.sourceMessageId === sourceMessageId);
  }

  public getSnapshot(): ChatMomentLedgerSnapshot {
    this.recomputeStats();

    const players: Record<string, ChatMomentPlayerSnapshot> = {};
    for (const player of this.players.values()) {
      players[player.playerId] = {
        playerId: player.playerId,
        createdAt: player.createdAt,
        updatedAt: player.updatedAt,
        totalMomentCount: player.totalMomentCount,
        unresolvedMomentIds: [...player.moments.values()]
          .filter((record) => record.status !== 'RESOLVED' && record.status !== 'CANCELLED' && record.status !== 'TIMED_OUT')
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((record) => record.momentId),
        carryover: [...player.carryover],
        activeRevealReservationIds: [...player.revealReservations.values()]
          .filter((reservation) => reservation.status !== 'CONSUMED' && reservation.status !== 'CANCELLED' && reservation.status !== 'EXPIRED')
          .map((reservation) => reservation.reservationId),
        activeSilenceWindowIds: [...player.silenceWindows.values()]
          .filter((window) => !window.closedAt || window.closedAt >= now() - this.config.silenceDefaultTtlMs)
          .map((window) => window.silenceId),
        momentsById: Object.fromEntries(
          [...player.moments.values()]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((record) => [record.momentId, record]),
        ),
        roomIds: [...player.roomIds],
      };
    }

    const rooms: Record<string, ChatMomentRoomSnapshot> = {};
    for (const room of this.rooms.values()) {
      rooms[room.roomId] = {
        roomId: room.roomId,
        playerIds: [...room.playerIds],
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
        momentIdsByUpdatedDesc: [...room.momentIdsByUpdatedDesc],
        unresolvedMomentIds: [...room.unresolvedMomentIds],
        activeRevealReservationIds: [...room.activeRevealReservationIds],
        activeSilenceWindowIds: [...room.activeSilenceWindowIds],
      };
    }

    return {
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      stats: this.stats,
      players,
      rooms,
    };
  }

  public restore(snapshot: ChatMomentLedgerSnapshot): void {
    this.players.clear();
    this.rooms.clear();
    this.createdAt = snapshot.createdAt;
    this.updatedAt = snapshot.updatedAt;
    this.stats = snapshot.stats;

    for (const playerSnapshot of Object.values(snapshot.players)) {
      const player: PlayerMomentBucket = {
        playerId: playerSnapshot.playerId,
        createdAt: playerSnapshot.createdAt,
        updatedAt: playerSnapshot.updatedAt,
        totalMomentCount: playerSnapshot.totalMomentCount,
        moments: new Map(Object.entries(playerSnapshot.momentsById)),
        roomIds: new Set(playerSnapshot.roomIds),
        carryover: [...playerSnapshot.carryover],
        revealReservations: new Map(),
        silenceWindows: new Map(),
        emissions: new Map(),
      };
      this.players.set(player.playerId, player);
    }

    for (const roomSnapshot of Object.values(snapshot.rooms)) {
      this.rooms.set(roomSnapshot.roomId, {
        roomId: roomSnapshot.roomId,
        createdAt: roomSnapshot.createdAt,
        updatedAt: roomSnapshot.updatedAt,
        playerIds: new Set(roomSnapshot.playerIds),
        momentIdsByUpdatedDesc: [...roomSnapshot.momentIdsByUpdatedDesc],
        unresolvedMomentIds: new Set(roomSnapshot.unresolvedMomentIds),
        activeRevealReservationIds: new Set(roomSnapshot.activeRevealReservationIds),
        activeSilenceWindowIds: new Set(roomSnapshot.activeSilenceWindowIds),
      });
    }
  }

  /* -------------------------------------------------------------------------
   * MARK: private mutation primitive
   * -------------------------------------------------------------------------
   */

  private upsertMoment(momentId: string, patch: UpsertMomentPatch): ChatMomentRecord | undefined {
    const player = this.getPlayerForMoment(momentId);
    if (!player) return undefined;

    const current = player.moments.get(momentId);
    if (!current) return undefined;

    const updatedAt = patch.updatedAt ?? now();

    const next: ChatMomentRecord = {
      ...current,
      ...patch,
      pressureTier: patch.pressureTier ?? current.pressureTier,
      intensity01: clamp01(patch.intensity01 ?? current.intensity01),
      worldTags: patch.worldTags ? uniq(patch.worldTags.map(normalizeTag)) : current.worldTags,
      planningTags: patch.planningTags ? uniq(patch.planningTags.map(normalizeTag)) : current.planningTags,
      counterpartIds: patch.counterpartIds ? uniq(patch.counterpartIds) : current.counterpartIds,
      callbackAnchorIds: patch.callbackAnchorIds ? uniq(patch.callbackAnchorIds) : current.callbackAnchorIds,
      pendingRevealReservationIds: patch.pendingRevealReservationIds ? uniq(patch.pendingRevealReservationIds) : current.pendingRevealReservationIds,
      activeSilenceWindowIds: patch.activeSilenceWindowIds ? uniq(patch.activeSilenceWindowIds) : current.activeSilenceWindowIds,
      visibleEmissionIds: patch.visibleEmissionIds ? uniq(patch.visibleEmissionIds) : current.visibleEmissionIds,
      shadowEmissionIds: patch.shadowEmissionIds ? uniq(patch.shadowEmissionIds) : current.shadowEmissionIds,
      witnessTail: patch.witnessTail ? [...patch.witnessTail] : current.witnessTail,
      unresolvedReasons: patch.unresolvedReasons ? uniq(patch.unresolvedReasons.map(String)) : current.unresolvedReasons,
      carryoverWeight01: clamp01(patch.carryoverWeight01 ?? current.carryoverWeight01),
      summaryLine: normalizeSummary(patch.summaryLine, current.summaryLine),
      updatedAt,
      lastMeaningfulMutationAt: patch.lastMeaningfulMutationAt ?? current.lastMeaningfulMutationAt,
    };

    player.moments.set(momentId, next);

    const room = this.ensureRoom(current.roomId);
    if (
      next.status === 'RESOLVED' ||
      next.status === 'CANCELLED' ||
      next.status === 'TIMED_OUT'
    ) {
      room.unresolvedMomentIds.delete(next.momentId);
    } else {
      room.unresolvedMomentIds.add(next.momentId);
    }

    this.touch(next.playerId, next.roomId, updatedAt);
    this.resortRoomMoments(room, player);
    this.trimPlayer(player);
    this.recomputeStats();
    return next;
  }
}





export default ChatMomentLedger;
