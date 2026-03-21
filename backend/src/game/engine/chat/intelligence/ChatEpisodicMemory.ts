/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT EPISODIC MEMORY
 * FILE: backend/src/game/engine/chat/intelligence/ChatEpisodicMemory.ts
 * VERSION: 2026.03.21-backend-episodic-memory.v2
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative backend episodic memory store for the Point Zero One chat
 * intelligence lane.
 *
 * Stores emotionally significant player / bot / crowd moments so the backend
 * chat engine can produce callback-quality social memory that survives across
 * runs, scenes, mode transitions, and realtime session replays.
 *
 * Backend vs frontend doctrine
 * ----------------------------
 * This file is the backend authority lane. It does NOT import from frontend
 * packages. It does NOT reference frontend-only field shapes (channel, body,
 * kind, meta, botSource, ts, momentType, startedAt, primaryChannel) directly
 * from the ChatMessage or ChatScenePlan contracts.
 *
 * All backend ChatMessage field accesses go through module-level accessor
 * helpers (readMsg* / readScene*) that safely extract optional extended fields
 * that may be present in the backend runtime payload but are not part of the
 * canonical contract surface. This pattern keeps the module compile-clean
 * against the actual backend types while preserving the rich inference logic.
 *
 * Contract truth
 * --------------
 * ChatMessage (backend/src/game/engine/chat/types.ts):
 *   Confirmed present: id, channelId, tags
 *   Extended optional fields (accessed via readMsg* helpers below):
 *     content/text, kind, npcId, botId, senderId, sceneId, momentId,
 *     proofHash, createdAt/timestamp, pressureTier, metadata/meta
 *
 * ChatScenePlan (backend/src/game/engine/chat/types.ts):
 *   Extended optional fields (accessed via readScene* helpers below):
 *     sceneId, momentId, momentType, primaryChannel/channelId, startedAt/createdAtMs
 *
 * BotId: Not exported from backend/src/game/engine/battle/types.
 *   Defined here as a string alias matching the BotId enum from the frontend
 *   engine core. String is the correct backend type since the backend never
 *   directly imports the frontend engine enum.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type {
  ChatMessage,
  ChatScenePlan,
  ChatVisibleChannel,
  UnixMs,
} from '../types';

/* ========================================================================== */
/* MARK: Backend BotId alias                                                  */
/* BotId is not exported from backend/src/game/engine/battle/types.           */
/* The backend uses string discriminants matching the frontend BotId enum.    */
/* Canonical enum values: BOT_01 BOT_02 BOT_03 BOT_04 BOT_05                 */
/* ========================================================================== */

export type BotId = string;

/* ========================================================================== */
/* MARK: Backend ChatMessage accessor helpers                                 */
/*                                                                            */
/* The backend ChatMessage contract (types.ts) only guarantees:              */
/*   id, channelId, tags                                                      */
/*                                                                            */
/* All other fields (content, kind, npcId, botId, senderId, sceneId,         */
/* momentId, proofHash, createdAt, pressureTier, metadata) are optional       */
/* extended fields present in the runtime payload but not on the canonical    */
/* contract surface. These helpers read them safely without breaking compile. */
/* ========================================================================== */

/** Extended optional fields that may be present on a backend ChatMessage payload. */
interface BackendChatMessageExtended {
  readonly content?: string | null;
  readonly text?: string | null;
  readonly body?: string | null;
  readonly kind?: string | null;
  readonly npcId?: string | null;
  readonly botId?: string | null;
  readonly senderId?: string | null;
  readonly sceneId?: string | null;
  readonly momentId?: string | null;
  readonly proofHash?: string | null;
  readonly createdAt?: number | null;
  readonly timestamp?: number | null;
  readonly ts?: number | null;
  readonly pressureTier?: string | null;
  readonly metadata?: Record<string, unknown> | null;
  readonly meta?: Record<string, unknown> | null;
  readonly botSource?: {
    readonly botId?: string | null;
    readonly isRetreat?: boolean | null;
  } | null;
}

function asExtended(message: ChatMessage): BackendChatMessageExtended {
  return message as unknown as BackendChatMessageExtended;
}

/** Read message text content from whichever field the backend message uses. */
function readMsgText(message: ChatMessage): string {
  const ext = asExtended(message);
  return String(ext.content ?? ext.text ?? ext.body ?? '');
}

/** Read message kind discriminant (NPC_TAUNT, RESCUE, BREACH, etc.). */
function readMsgKind(message: ChatMessage): string {
  return String(asExtended(message).kind ?? '').toUpperCase();
}

/**
 * Read backend message timestamp.
 * Backend messages may use createdAt, timestamp, or ts.
 */
function readMsgTimestamp(message: ChatMessage): UnixMs {
  const ext = asExtended(message);
  const ts = ext.createdAt ?? ext.timestamp ?? ext.ts;
  return (typeof ts === 'number' && Number.isFinite(ts) ? ts : Date.now()) as UnixMs;
}

/** Read the channelId — confirmed present on backend ChatMessage. */
function readMsgChannelId(message: ChatMessage): string | null {
  const ch = message.channelId;
  const normalized = String(ch ?? '').toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

/** Read the metadata / meta blob, normalised to a plain record. */
function readMsgMeta(message: ChatMessage): Record<string, unknown> {
  const ext = asExtended(message);
  const raw = ext.metadata ?? ext.meta;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

/** Read the nested shield breach flag from message metadata. */
function readMsgShieldBreached(message: ChatMessage): boolean {
  const meta = readMsgMeta(message);
  const shieldMeta = meta['shieldMeta'] as Record<string, unknown> | undefined;
  return shieldMeta?.['isBreached'] === true;
}

/** Read the cascade direction (POSITIVE | NEGATIVE) from message metadata. */
function readMsgCascadeDirection(message: ChatMessage): string | null {
  const meta = readMsgMeta(message);
  const cascadeMeta = meta['cascadeMeta'] as Record<string, unknown> | undefined;
  const dir = String(cascadeMeta?.['direction'] ?? '').toUpperCase();
  return dir.length > 0 ? dir : null;
}

/** Read deal-room bluff risk score from message metadata. */
function readMsgBluffRisk(message: ChatMessage): number | null {
  const meta = readMsgMeta(message);
  const dealRoom = meta['dealRoom'] as Record<string, unknown> | undefined;
  const raw = dealRoom?.['bluffRisk'];
  return typeof raw === 'number' ? raw : null;
}

/** Read deal-room urgency score from message metadata. */
function readMsgDealUrgency(message: ChatMessage): number | null {
  const meta = readMsgMeta(message);
  const dealRoom = meta['dealRoom'] as Record<string, unknown> | undefined;
  const raw = dealRoom?.['urgencyScore'];
  return typeof raw === 'number' ? raw : null;
}

/** Read the pressure tier from message metadata or top-level field. */
function readMsgPressureTier(message: ChatMessage): string | null {
  const ext = asExtended(message);
  // Top-level pressureTier wins if present
  if (ext.pressureTier) return String(ext.pressureTier).toUpperCase();
  // Fall back to nested metadata location
  const meta = readMsgMeta(message);
  const pressure = meta['pressure'] as Record<string, unknown> | undefined;
  const tier = String(pressure?.['pressureTier'] ?? '').toUpperCase();
  return tier.length > 0 ? tier : null;
}

/** Read bot source metadata from message. */
function readMsgBotSource(message: ChatMessage): BackendChatMessageExtended['botSource'] {
  return asExtended(message).botSource ?? null;
}

/** Read the sceneId field from message extended payload. */
function readMsgSceneId(message: ChatMessage): string | null {
  const raw = asExtended(message).sceneId;
  const normalized = String(raw ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

/** Read the momentId field from message extended payload. */
function readMsgMomentId(message: ChatMessage): string | null {
  const raw = asExtended(message).momentId;
  const normalized = String(raw ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

/** Read the senderId (author) from message extended payload. */
function readMsgSenderId(message: ChatMessage): string | null {
  const raw = asExtended(message).senderId;
  const normalized = String(raw ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

/** Read the proofHash from message extended payload. */
function readMsgProofHash(message: ChatMessage): string | null {
  const raw = asExtended(message).proofHash;
  const normalized = String(raw ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

/* ========================================================================== */
/* MARK: Backend ChatScenePlan accessor helpers                               */
/*                                                                            */
/* ChatScenePlan (backend/src/game/engine/chat/types.ts) has a different      */
/* shape from the frontend planning types. Fields like momentType,            */
/* startedAt, primaryChannel, momentId, sceneId may be present in the         */
/* runtime payload but are not guaranteed by the contract surface.            */
/* ========================================================================== */

/** Extended optional fields that may be present on a backend ChatScenePlan payload. */
interface BackendChatScenePlanExtended {
  readonly sceneId?: string | null;
  readonly momentId?: string | null;
  readonly momentType?: string | null;
  readonly primaryChannel?: string | null;
  readonly channelId?: string | null;
  readonly startedAt?: number | null;
  readonly createdAtMs?: number | null;
  readonly openedAtMs?: number | null;
}

function asSceneExtended(scene: ChatScenePlan): BackendChatScenePlanExtended {
  return scene as unknown as BackendChatScenePlanExtended;
}

function readSceneId(scene: ChatScenePlan): string {
  const ext = asSceneExtended(scene);
  const raw = ext.sceneId ?? (scene as any).id;
  const normalized = String(raw ?? '').trim();
  return normalized.length > 0 ? normalized : `scene:${Date.now()}`;
}

function readSceneMomentId(scene: ChatScenePlan): string {
  const ext = asSceneExtended(scene);
  const raw = ext.momentId;
  const normalized = String(raw ?? '').trim();
  return normalized.length > 0 ? normalized : `moment:${Date.now()}`;
}

function readSceneMomentType(scene: ChatScenePlan): string {
  const raw = asSceneExtended(scene).momentType;
  return String(raw ?? '').toUpperCase();
}

function readScenePrimaryChannel(scene: ChatScenePlan): string {
  const ext = asSceneExtended(scene);
  const raw = ext.primaryChannel ?? ext.channelId;
  return String(raw ?? 'GLOBAL').toUpperCase();
}

function readSceneStartedAt(scene: ChatScenePlan): UnixMs {
  const ext = asSceneExtended(scene);
  const ts = ext.startedAt ?? ext.createdAtMs ?? ext.openedAtMs;
  return (typeof ts === 'number' && Number.isFinite(ts) ? ts : Date.now()) as UnixMs;
}

/* ========================================================================== */
/* MARK: Module identity                                                      */
/* ========================================================================== */

export const CHAT_EPISODIC_MEMORY_MODULE_NAME =
  'PZO_BACKEND_CHAT_EPISODIC_MEMORY' as const;

export const CHAT_EPISODIC_MEMORY_VERSION =
  '2026.03.21-backend-episodic-memory.v2' as const;

export const CHAT_EPISODIC_MEMORY_RUNTIME_LAWS = Object.freeze([
  'Backend episodic memory is authoritative and replayable.',
  'Frontend replay truth can strengthen, resolve, or overwrite backend memory.',
  'Repeated moments should merge before they multiply.',
  'Callbacks must be ranked against channel, role, tone, and reuse fatigue.',
  'High-salience humiliation, breach, and comeback moments deserve longer persistence.',
  'Silent state still matters: shadow evidence may create memory without player-visible spam.',
  'Carryover summaries should compress meaning, not replay whole transcripts.',
  'Decay should lower weak memories while preserving defining moments.',
  'All ChatMessage and ChatScenePlan field accesses must go through backend accessor helpers.',
  'BotId is a string alias in the backend lane — never import the frontend engine enum.',
] as const);

/* ========================================================================== */
/* MARK: Domain constants                                                     */
/* ========================================================================== */

export const CHAT_EPISODIC_EVENT_TYPES = [
  'HUMILIATION',
  'COMEBACK',
  'COLLAPSE',
  'BREACH',
  'RESCUE',
  'BLUFF',
  'GREED',
  'HESITATION',
  'OVERCONFIDENCE',
  'DISCIPLINE',
  'PERFECT_DEFENSE',
  'FAILED_GAMBLE',
  'SOVEREIGNTY',
  'DEAL_ROOM_STANDOFF',
  'PUBLIC_WITNESS',
  'PRIVATE_CONFESSION',
] as const;

export type ChatEpisodicEventType = (typeof CHAT_EPISODIC_EVENT_TYPES)[number];

export const CHAT_EPISODIC_CALLBACK_TONES = [
  'COLD',
  'CEREMONIAL',
  'MOCKING',
  'INTIMATE',
  'PUBLIC',
  'PRIVATE',
  'POST_EVENT',
  'PRE_EVENT',
] as const;

export type ChatCallbackTone = (typeof CHAT_EPISODIC_CALLBACK_TONES)[number];

export const CHAT_EPISODIC_PRESSURE_BANDS = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const;

export type ChatEpisodicPressureBand = (typeof CHAT_EPISODIC_PRESSURE_BANDS)[number];

export const CHAT_EPISODIC_PRIORITY_TIERS = [
  'AMBIENT',
  'IMPORTANT',
  'DEFINING',
  'LEGENDARY',
] as const;

export type ChatEpisodicPriorityTier = (typeof CHAT_EPISODIC_PRIORITY_TIERS)[number];

/* ========================================================================== */
/* MARK: Contracts                                                            */
/* ========================================================================== */

export interface ChatEpisodicTriggerContext {
  readonly roomId?: string | null;
  readonly channelId?: ChatVisibleChannel | string | null;
  readonly messageId?: string | null;
  readonly sceneId?: string | null;
  readonly momentId?: string | null;
  readonly botId?: BotId | string | null;
  readonly counterpartId?: string | null;
  readonly pressureBand?: ChatEpisodicPressureBand;
  readonly tags?: readonly string[];
  readonly summary: string;
  readonly rawText?: string | null;
  readonly sourceKind?:
    | 'MESSAGE'
    | 'SCENE'
    | 'REPLAY'
    | 'SYSTEM'
    | 'AUTHORITATIVE_PATCH';
  readonly sourceReliability01?: number;
  readonly visibility?: 'VISIBLE' | 'SHADOW' | 'MIXED';
  readonly humiliationExposure01?: number;
  readonly leverageRisk01?: number;
  readonly confidenceSignal01?: number;
  readonly evidenceRefs?: readonly string[];
}

export interface ChatEpisodicCallbackVariant {
  readonly callbackId: string;
  readonly tone: ChatCallbackTone;
  readonly text: string;
  readonly usageBias01: number;
  readonly eligibleSceneRoles: readonly string[];
  readonly eligibleChannels: readonly string[];
  readonly minSalience01?: number;
  readonly preferredEventStates?: readonly ('UNRESOLVED' | 'RESOLVED')[];
  readonly suppressIfEmbarrassmentBelow01?: number;
}

export interface ChatEpisodicMemoryRecord {
  readonly memoryId: string;
  readonly playerId?: string | null;
  readonly botId?: BotId | string | null;
  readonly counterpartId?: string | null;
  readonly roomId?: string | null;
  readonly eventType: ChatEpisodicEventType;
  readonly triggerContext: ChatEpisodicTriggerContext;
  readonly salience01: number;
  readonly emotionalWeight01: number;
  readonly strategicWeight01: number;
  readonly embarrassmentRisk01: number;
  readonly callbackVariants: readonly ChatEpisodicCallbackVariant[];
  readonly createdAt: UnixMs;
  readonly lastReferencedAt?: UnixMs;
  readonly lastStrengthenedAt?: UnixMs;
  readonly timesReused: number;
  readonly unresolved: boolean;
  readonly expiresAt?: UnixMs;
  readonly archived: boolean;
  readonly fingerprint?: string;
  readonly dedupeKey?: string;
  readonly lastEventAt?: UnixMs;
  readonly strengthCount?: number;
  readonly sourceReliability01?: number;
  readonly priorityTier?: ChatEpisodicPriorityTier;
  readonly resolutionReason?: string;
  readonly resolutionSummary?: string;
  readonly channelAffinity?: readonly string[];
}

export interface ChatEpisodicCallbackCandidate {
  readonly memoryId: string;
  readonly callbackId: string;
  readonly eventType: ChatEpisodicEventType;
  readonly unresolved: boolean;
  readonly salience01: number;
  readonly score01: number;
  readonly tone: ChatCallbackTone;
  readonly text: string;
  readonly notes: readonly string[];
}

export interface ChatEpisodicCarryoverItem {
  readonly memoryId: string;
  readonly eventType: ChatEpisodicEventType;
  readonly priorityTier: ChatEpisodicPriorityTier;
  readonly unresolved: boolean;
  readonly summary: string;
  readonly channelId?: string | null;
  readonly score01: number;
}

export interface ChatEpisodicMemorySnapshot {
  readonly createdAt: UnixMs;
  readonly updatedAt: UnixMs;
  readonly activeMemories: readonly ChatEpisodicMemoryRecord[];
  readonly archivedMemories: readonly ChatEpisodicMemoryRecord[];
  readonly unresolvedMemoryIds: readonly string[];
  readonly lastCarryoverSummary?: string;
}

export interface ChatEpisodicMemoryQuery {
  readonly botId?: BotId | string | null;
  readonly counterpartId?: string | null;
  readonly roomId?: string | null;
  readonly channelId?: string | null;
  readonly eventTypes?: readonly ChatEpisodicEventType[];
  readonly unresolvedOnly?: boolean;
  readonly activeOnly?: boolean;
  readonly includeArchived?: boolean;
  readonly tags?: readonly string[];
  readonly searchText?: string | null;
  readonly sinceAt?: UnixMs;
  readonly limit?: number;
}

export interface ChatEpisodicCallbackRequest {
  readonly botId?: BotId | string | null;
  readonly counterpartId?: string | null;
  readonly roomId?: string | null;
  readonly channelId?: string | null;
  readonly sceneRole?: string | null;
  readonly preferredTones?: readonly ChatCallbackTone[];
  readonly preferUnresolved?: boolean;
  readonly requireChannelEligibility?: boolean;
  readonly requireSceneRoleEligibility?: boolean;
  readonly maxResults?: number;
}

export interface ChatEpisodicMemoryPatch {
  readonly unresolved?: boolean;
  readonly archived?: boolean;
  readonly expiresAt?: UnixMs | null;
  readonly salienceDelta01?: number;
  readonly emotionalDelta01?: number;
  readonly strategicDelta01?: number;
  readonly embarrassmentDelta01?: number;
  readonly resolutionReason?: string | null;
  readonly resolutionSummary?: string | null;
  readonly tagsToAdd?: readonly string[];
}

export interface ChatEpisodicMemoryOptions {
  readonly activeMemoryCap?: number;
  readonly archivedMemoryCap?: number;
  readonly defaultExpiryMs?: number;
  readonly dedupeWindowMs?: number;
  readonly callbackReuseCooldownMs?: number;
  readonly minSalienceToPersist01?: number;
  readonly decayHalfLifeMs?: number;
  readonly carryoverLimit?: number;
  readonly summarySoftLimit?: number;
}

interface ChatEpisodicEventDescriptor {
  readonly eventType: ChatEpisodicEventType;
  readonly defaultUnresolved: boolean;
  readonly baseSalience01: number;
  readonly emotionalBias01: number;
  readonly strategicBias01: number;
  readonly embarrassmentBias01: number;
  readonly defaultExpiryMs: number;
  readonly priorityTier: ChatEpisodicPriorityTier;
  readonly callbackStem: string;
  readonly tags: readonly string[];
}

interface ChatEpisodicInference {
  readonly eventType: ChatEpisodicEventType | null;
  readonly notes: readonly string[];
  readonly tags: readonly string[];
  readonly pressureBand?: ChatEpisodicPressureBand;
  readonly sourceReliability01: number;
  readonly humiliationExposure01?: number;
  readonly leverageRisk01?: number;
  readonly confidenceSignal01?: number;
}

/* ========================================================================== */
/* MARK: Defaults                                                             */
/* ========================================================================== */

export const CHAT_EPISODIC_MEMORY_DEFAULTS: Required<ChatEpisodicMemoryOptions> = {
  activeMemoryCap:          512,
  archivedMemoryCap:        512,
  defaultExpiryMs:          180 * 24 * 60 * 60 * 1000,
  dedupeWindowMs:           20  * 60 * 1000,
  callbackReuseCooldownMs:  6   * 60 * 1000,
  minSalienceToPersist01:   0.36,
  decayHalfLifeMs:          14 * 24 * 60 * 60 * 1000,
  carryoverLimit:           6,
  summarySoftLimit:         160,
};

const DAY_MS  = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/* ========================================================================== */
/* MARK: Event descriptor registry                                            */
/* ========================================================================== */

const EVENT_DESCRIPTORS: Readonly<Record<ChatEpisodicEventType, ChatEpisodicEventDescriptor>> =
  Object.freeze({
    HUMILIATION: {
      eventType: 'HUMILIATION', defaultUnresolved: true,
      baseSalience01: 0.86, emotionalBias01: 0.93, strategicBias01: 0.48, embarrassmentBias01: 0.98,
      defaultExpiryMs: 240 * DAY_MS, priorityTier: 'LEGENDARY',
      callbackStem: 'the moment the room watched you bleed status',
      tags: ['public', 'humiliation', 'witness'],
    },
    COMEBACK: {
      eventType: 'COMEBACK', defaultUnresolved: false,
      baseSalience01: 0.88, emotionalBias01: 0.84, strategicBias01: 0.77, embarrassmentBias01: 0.22,
      defaultExpiryMs: 210 * DAY_MS, priorityTier: 'LEGENDARY',
      callbackStem: 'the comeback that changed how the room read you',
      tags: ['reversal', 'momentum', 'witness'],
    },
    COLLAPSE: {
      eventType: 'COLLAPSE', defaultUnresolved: true,
      baseSalience01: 0.83, emotionalBias01: 0.90, strategicBias01: 0.73, embarrassmentBias01: 0.72,
      defaultExpiryMs: 210 * DAY_MS, priorityTier: 'LEGENDARY',
      callbackStem: 'the collapse that opened the floor beneath you',
      tags: ['collapse', 'pressure', 'downside'],
    },
    BREACH: {
      eventType: 'BREACH', defaultUnresolved: true,
      baseSalience01: 0.79, emotionalBias01: 0.68, strategicBias01: 0.91, embarrassmentBias01: 0.44,
      defaultExpiryMs: 180 * DAY_MS, priorityTier: 'DEFINING',
      callbackStem: 'the breach that changed the balance of the room',
      tags: ['breach', 'shield', 'exposure'],
    },
    RESCUE: {
      eventType: 'RESCUE', defaultUnresolved: false,
      baseSalience01: 0.71, emotionalBias01: 0.82, strategicBias01: 0.58, embarrassmentBias01: 0.18,
      defaultExpiryMs: 150 * DAY_MS, priorityTier: 'DEFINING',
      callbackStem: 'the rescue that bought you one more breath',
      tags: ['rescue', 'helper', 'survival'],
    },
    BLUFF: {
      eventType: 'BLUFF', defaultUnresolved: true,
      baseSalience01: 0.69, emotionalBias01: 0.54, strategicBias01: 0.87, embarrassmentBias01: 0.42,
      defaultExpiryMs: 120 * DAY_MS, priorityTier: 'DEFINING',
      callbackStem: 'the bluff the room still replays in silence',
      tags: ['deal-room', 'bluff', 'negotiation'],
    },
    GREED: {
      eventType: 'GREED', defaultUnresolved: true,
      baseSalience01: 0.61, emotionalBias01: 0.46, strategicBias01: 0.63, embarrassmentBias01: 0.34,
      defaultExpiryMs: 90 * DAY_MS, priorityTier: 'IMPORTANT',
      callbackStem: 'the reach that exposed what you wanted too early',
      tags: ['greed', 'overreach'],
    },
    HESITATION: {
      eventType: 'HESITATION', defaultUnresolved: true,
      baseSalience01: 0.58, emotionalBias01: 0.57, strategicBias01: 0.49, embarrassmentBias01: 0.36,
      defaultExpiryMs: 90 * DAY_MS, priorityTier: 'IMPORTANT',
      callbackStem: 'the hesitation that told the room you were counting fear',
      tags: ['hesitation', 'stall'],
    },
    OVERCONFIDENCE: {
      eventType: 'OVERCONFIDENCE', defaultUnresolved: true,
      baseSalience01: 0.67, emotionalBias01: 0.44, strategicBias01: 0.61, embarrassmentBias01: 0.51,
      defaultExpiryMs: 90 * DAY_MS, priorityTier: 'IMPORTANT',
      callbackStem: 'the overconfidence that announced itself too loudly',
      tags: ['overconfidence', 'posture'],
    },
    DISCIPLINE: {
      eventType: 'DISCIPLINE', defaultUnresolved: false,
      baseSalience01: 0.62, emotionalBias01: 0.38, strategicBias01: 0.86, embarrassmentBias01: 0.08,
      defaultExpiryMs: 120 * DAY_MS, priorityTier: 'DEFINING',
      callbackStem: 'the discipline that kept the room from owning you',
      tags: ['discipline', 'restraint'],
    },
    PERFECT_DEFENSE: {
      eventType: 'PERFECT_DEFENSE', defaultUnresolved: false,
      baseSalience01: 0.76, emotionalBias01: 0.42, strategicBias01: 0.94, embarrassmentBias01: 0.04,
      defaultExpiryMs: 180 * DAY_MS, priorityTier: 'DEFINING',
      callbackStem: 'the defense that denied the room its collapse fantasy',
      tags: ['defense', 'shield', 'precision'],
    },
    FAILED_GAMBLE: {
      eventType: 'FAILED_GAMBLE', defaultUnresolved: true,
      baseSalience01: 0.72, emotionalBias01: 0.74, strategicBias01: 0.71, embarrassmentBias01: 0.56,
      defaultExpiryMs: 150 * DAY_MS, priorityTier: 'DEFINING',
      callbackStem: 'the gamble that priced itself against you',
      tags: ['gamble', 'risk'],
    },
    SOVEREIGNTY: {
      eventType: 'SOVEREIGNTY', defaultUnresolved: false,
      baseSalience01: 0.91, emotionalBias01: 0.78, strategicBias01: 0.90, embarrassmentBias01: 0.00,
      defaultExpiryMs: 365 * DAY_MS, priorityTier: 'LEGENDARY',
      callbackStem: 'the sovereign turn that forced the room to recalculate you',
      tags: ['sovereignty', 'legend'],
    },
    DEAL_ROOM_STANDOFF: {
      eventType: 'DEAL_ROOM_STANDOFF', defaultUnresolved: true,
      baseSalience01: 0.74, emotionalBias01: 0.49, strategicBias01: 0.89, embarrassmentBias01: 0.22,
      defaultExpiryMs: 180 * DAY_MS, priorityTier: 'DEFINING',
      callbackStem: 'the stand-off where neither side blinked first',
      tags: ['deal-room', 'standoff', 'negotiation'],
    },
    PUBLIC_WITNESS: {
      eventType: 'PUBLIC_WITNESS', defaultUnresolved: false,
      baseSalience01: 0.73, emotionalBias01: 0.67, strategicBias01: 0.41, embarrassmentBias01: 0.61,
      defaultExpiryMs: 180 * DAY_MS, priorityTier: 'DEFINING',
      callbackStem: 'the public witness moment the room now owns with you',
      tags: ['public', 'witness'],
    },
    PRIVATE_CONFESSION: {
      eventType: 'PRIVATE_CONFESSION', defaultUnresolved: false,
      baseSalience01: 0.63, emotionalBias01: 0.88, strategicBias01: 0.37, embarrassmentBias01: 0.19,
      defaultExpiryMs: 120 * DAY_MS, priorityTier: 'IMPORTANT',
      callbackStem: 'what was only said when the public room went quiet',
      tags: ['private', 'confession'],
    },
  });

const MOMENT_TYPE_TO_EVENT: Readonly<Record<string, ChatEpisodicEventType>> = Object.freeze({
  SHIELD_BREACH:      'BREACH',
  HELPER_RESCUE:      'RESCUE',
  DEAL_ROOM_STANDOFF: 'DEAL_ROOM_STANDOFF',
  SOVEREIGN_APPROACH: 'SOVEREIGNTY',
  SOVEREIGN_ACHIEVED: 'SOVEREIGNTY',
  LEGEND_MOMENT:      'PUBLIC_WITNESS',
  CASCADE_TRIGGER:    'COLLAPSE',
  CASCADE_BREAK:      'COMEBACK',
});

const CHANNEL_EMBARRASSMENT_BOOST: Readonly<Record<string, number>> = Object.freeze({
  GLOBAL:         0.18,
  LOBBY:          0.14,
  DEAL_ROOM:      0.08,
  SYNDICATE:     -0.06,
  SYSTEM_SHADOW: -0.08,
  NPC_SHADOW:    -0.03,
  RIVALRY_SHADOW: 0.05,
  RESCUE_SHADOW: -0.08,
  LIVEOPS_SHADOW: 0.00,
});

const PRESSURE_BAND_BOOST: Readonly<Record<ChatEpisodicPressureBand, number>> = Object.freeze({
  LOW:      0.00,
  MEDIUM:   0.06,
  HIGH:     0.12,
  CRITICAL: 0.18,
});

const BODY_EVENT_PATTERNS: ReadonlyArray<{
  readonly eventType: ChatEpisodicEventType;
  readonly pattern: RegExp;
  readonly bonus01: number;
  readonly notes: readonly string[];
}> = [
  { eventType: 'COMEBACK',        pattern: /\b(comeback|turned it around|recovered|stole it back|regained control)\b/i, bonus01: 0.12, notes: ['body=comeback'] },
  { eventType: 'COLLAPSE',        pattern: /\b(collapse|implod|cascad|spiral|free[- ]?fall|blew up)\b/i,               bonus01: 0.12, notes: ['body=collapse'] },
  { eventType: 'BLUFF',           pattern: /\b(bluff|called your bluff|priced your bluff|posture|fake strength)\b/i,    bonus01: 0.10, notes: ['body=bluff'] },
  { eventType: 'HESITATION',      pattern: /\b(hesitat|stalled|froze|flinched|waited too long)\b/i,                     bonus01: 0.08, notes: ['body=hesitation'] },
  { eventType: 'DISCIPLINE',      pattern: /\b(discipline|held the line|stayed clean|stayed patient|did not chase)\b/i, bonus01: 0.10, notes: ['body=discipline'] },
  { eventType: 'PERFECT_DEFENSE', pattern: /\b(perfect defense|blocked everything|no breach|shut it all down|absorbed it clean)\b/i, bonus01: 0.12, notes: ['body=perfect-defense'] },
  { eventType: 'OVERCONFIDENCE',  pattern: /\b(overconfiden|too certain|too easy|untouchable|cannot lose)\b/i,          bonus01: 0.08, notes: ['body=overconfidence'] },
  { eventType: 'FAILED_GAMBLE',   pattern: /\b(gamble|all[- ]?in|overextended|missed the read|bet wrong)\b/i,           bonus01: 0.11, notes: ['body=failed-gamble'] },
  { eventType: 'PRIVATE_CONFESSION', pattern: /\b(only between us|off the record|i admit|confess|quietly)\b/i,          bonus01: 0.08, notes: ['body=confession'] },
];

/* ========================================================================== */
/* MARK: Utility helpers                                                      */
/* ========================================================================== */

function clamp01(value: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) return 0;
  return value <= 0 ? 0 : value >= 1 ? 1 : Number(value.toFixed(6));
}

function clampPositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const n = Math.floor(value);
  return n > 0 ? n : fallback;
}

function normalizeText(value?: string | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeKey(value?: string | null): string {
  return normalizeText(value).toLowerCase();
}

function canonicalizeChannel(value?: string | null): string | null {
  const normalized = normalizeText(value).toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const n = normalizeText(value);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function tokenize(value?: string | null): readonly string[] {
  const normalized = normalizeKey(value);
  if (!normalized) return [];
  return uniqueStrings(normalized.split(/[^a-z0-9_]+/g).filter(Boolean));
}

function fastHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function asUnixMs(value: number): UnixMs { return value as UnixMs; }
function nowUnixMs(): UnixMs { return Date.now() as UnixMs; }

function normalizePressureBand(value: unknown): ChatEpisodicPressureBand | undefined {
  const n = String(value ?? '').toUpperCase();
  if (n === 'CRITICAL') return 'CRITICAL';
  if (n === 'HIGH') return 'HIGH';
  if (n === 'MEDIUM' || n === 'ELEVATED') return 'MEDIUM';
  if (n === 'LOW' || n === 'BUILDING' || n === 'CALM') return 'LOW';
  return undefined;
}

function summarizeText(value: string, softLimit: number): string {
  const n = normalizeText(value);
  return n.length <= softLimit ? n : `${n.slice(0, Math.max(12, softLimit - 1)).trimEnd()}…`;
}

function dedupeStringArray(values?: readonly string[]): readonly string[] {
  return values ? uniqueStrings(values) : [];
}

function descriptorOf(eventType: ChatEpisodicEventType): ChatEpisodicEventDescriptor {
  return EVENT_DESCRIPTORS[eventType];
}

function computePriorityTier(score01: number, fallback: ChatEpisodicPriorityTier): ChatEpisodicPriorityTier {
  if (score01 >= 0.90) return 'LEGENDARY';
  if (score01 >= 0.72) return 'DEFINING';
  if (score01 >= 0.48) return 'IMPORTANT';
  return fallback;
}

function stringifyMaybe(value: unknown): string | null {
  const n = normalizeText(typeof value === 'string' ? value : value == null ? '' : String(value));
  return n.length > 0 ? n : null;
}

function buildFingerprint(
  eventType: ChatEpisodicEventType,
  context: ChatEpisodicTriggerContext,
  summarySoftLimit: number,
): string {
  const summary = summarizeText(context.summary, summarySoftLimit).toLowerCase();
  return fastHash([
    eventType,
    normalizeKey(context.botId ? String(context.botId) : null),
    normalizeKey(context.counterpartId),
    normalizeKey(context.roomId),
    normalizeKey(context.channelId ? String(context.channelId) : null),
    normalizeKey(context.sceneId),
    normalizeKey(summary),
  ].join('|'));
}

function buildMemoryId(eventType: ChatEpisodicEventType, fingerprint: string, at: UnixMs): string {
  return `memory:${eventType.toLowerCase()}:${fingerprint}:${Number(at)}`;
}

function buildCallbackId(memoryId: string, tone: ChatCallbackTone, index: number): string {
  return `${memoryId}:${tone.toLowerCase()}:${index + 1}`;
}

function ensureReadonlyCopy<T>(values: readonly T[]): readonly T[] {
  return [...values];
}

/* ========================================================================== */
/* MARK: Inference — scene                                                   */
/* Uses readScene* helpers — no direct field access on ChatScenePlan         */
/* ========================================================================== */

function inferEventTypeFromScene(
  scene: ChatScenePlan,
  summary: string,
): ChatEpisodicInference {
  const notes: string[] = [];
  const tags: string[] = ['scene'];

  // readSceneMomentType — replaces scene.momentType (error line 762)
  const momentType = readSceneMomentType(scene);
  if (momentType) tags.push(`moment:${momentType.toLowerCase()}`);

  const mapped = MOMENT_TYPE_TO_EVENT[momentType];
  if (mapped) {
    notes.push(`moment=${momentType}`);
    return { eventType: mapped, notes, tags, sourceReliability01: 0.90, pressureBand: undefined };
  }

  const lowered = normalizeText(summary).toLowerCase();
  if (lowered.includes('rescue'))    { notes.push('summary=rescue');    return { eventType: 'RESCUE',      notes, tags, sourceReliability01: 0.74 }; }
  if (lowered.includes('breach'))    { notes.push('summary=breach');    return { eventType: 'BREACH',      notes, tags, sourceReliability01: 0.74 }; }
  if (lowered.includes('comeback'))  { notes.push('summary=comeback');  return { eventType: 'COMEBACK',    notes, tags, sourceReliability01: 0.74 }; }
  if (lowered.includes('sovereign')) { notes.push('summary=sovereignty');return { eventType: 'SOVEREIGNTY', notes, tags, sourceReliability01: 0.74 }; }

  return { eventType: null, notes, tags, sourceReliability01: 0.60 };
}

/* ========================================================================== */
/* MARK: Inference — message                                                 */
/* Uses readMsg* helpers — all previous direct ChatMessage field access is   */
/* replaced here. No message.body, message.kind, message.meta, etc.         */
/* ========================================================================== */

function inferEventTypeFromMessage(message: ChatMessage): ChatEpisodicInference {
  const notes: string[] = [];
  const tags: string[] = [...(message.tags ?? [])];

  // readMsgKind replaces message.kind (error line 809)
  const kind = readMsgKind(message);
  // readMsgText replaces message.body (error lines 810, 1244, 1245)
  const body     = readMsgText(message);
  const bodyLower = body.toLowerCase();
  // readMsgPressureTier replaces message.pressureTier / message.meta?.pressure?.pressureTier
  const pressureBand = normalizePressureBand(readMsgPressureTier(message));

  const pushNote = (note: string): void => { notes.push(note); };
  const kindContains = (value: string): boolean => kind.includes(value);

  // readMsgShieldBreached replaces message.meta?.shieldMeta?.isBreached (error line 813)
  if (readMsgShieldBreached(message)) {
    pushNote('meta.shieldMeta.isBreached');
    tags.push('shield', 'breach');
    // readMsgChannelId replaces message.channel (error line 832)
    const channelId = readMsgChannelId(message);
    const isPublicChannel = channelId === 'GLOBAL' || channelId === 'LOBBY';
    return {
      eventType: 'BREACH', notes, tags, pressureBand,
      sourceReliability01: 0.94,
      humiliationExposure01: isPublicChannel ? 0.56 : 0.18,
      confidenceSignal01: 0.18,
    };
  }

  // readMsgCascadeDirection replaces message.meta?.cascadeMeta?.direction (error line 822)
  const cascadeDir = readMsgCascadeDirection(message);
  if (cascadeDir === 'NEGATIVE') {
    pushNote('meta.cascadeMeta.direction=NEGATIVE'); tags.push('cascade', 'negative');
    return { eventType: 'COLLAPSE', notes, tags, pressureBand, sourceReliability01: 0.88, humiliationExposure01: 0.40, leverageRisk01: 0.54, confidenceSignal01: 0.12 };
  }
  if (cascadeDir === 'POSITIVE') {
    pushNote('meta.cascadeMeta.direction=POSITIVE'); tags.push('cascade', 'positive');
    return { eventType: 'COMEBACK', notes, tags, pressureBand, sourceReliability01: 0.88, confidenceSignal01: 0.84, humiliationExposure01: 0.08 };
  }

  // readMsgBluffRisk replaces message.meta?.dealRoom?.bluffRisk (error line 837)
  const bluffRisk = readMsgBluffRisk(message);
  if (bluffRisk != null && bluffRisk >= 0.72) {
    pushNote('meta.dealRoom.bluffRisk>=0.72'); tags.push('deal-room', 'bluff');
    return { eventType: 'BLUFF', notes, tags, pressureBand, sourceReliability01: 0.90, leverageRisk01: clamp01(bluffRisk), confidenceSignal01: 0.68 };
  }

  // readMsgDealUrgency replaces message.meta?.dealRoom?.urgencyScore (error line 852)
  const urgency = readMsgDealUrgency(message);
  if (urgency != null && urgency >= 0.80) {
    pushNote('meta.dealRoom.urgencyScore>=0.80'); tags.push('deal-room', 'standoff');
    return { eventType: 'DEAL_ROOM_STANDOFF', notes, tags, pressureBand, sourceReliability01: 0.82, leverageRisk01: clamp01(urgency), confidenceSignal01: 0.42 };
  }

  if (kindContains('RESCUE') || kindContains('HELPER')) {
    pushNote('kind=rescue/helper'); tags.push('rescue');
    return { eventType: 'RESCUE', notes, tags, pressureBand, sourceReliability01: 0.82, confidenceSignal01: 0.65 };
  }
  if (kindContains('BREACH')) {
    pushNote('kind=breach'); tags.push('breach');
    // readMsgChannelId replaces message.channel (error line 917)
    const ch = readMsgChannelId(message);
    return { eventType: 'BREACH', notes, tags, pressureBand, sourceReliability01: 0.79, humiliationExposure01: (ch === 'GLOBAL' || ch === 'LOBBY') ? 0.42 : 0.16 };
  }
  if (kindContains('LEGEND')) {
    pushNote('kind=legend'); tags.push('legend', 'witness');
    return { eventType: 'PUBLIC_WITNESS', notes, tags, pressureBand, sourceReliability01: 0.78, confidenceSignal01: 0.76 };
  }
  if (kindContains('NEGOTIATION') || kindContains('DEAL')) {
    pushNote('kind=negotiation'); tags.push('deal-room');
    return { eventType: 'DEAL_ROOM_STANDOFF', notes, tags, pressureBand, sourceReliability01: 0.76, leverageRisk01: 0.60 };
  }

  for (const entry of BODY_EVENT_PATTERNS) {
    if (!entry.pattern.test(bodyLower)) continue;
    for (const note of entry.notes) pushNote(note);
    tags.push(...entry.notes.map((n) => n.replace(/^body=/, 'body:')));
    return {
      eventType: entry.eventType, notes, tags, pressureBand,
      sourceReliability01: clamp01(0.62 + entry.bonus01),
      humiliationExposure01: entry.eventType === 'HUMILIATION' || entry.eventType === 'OVERCONFIDENCE' ? 0.52 : undefined,
      leverageRisk01: entry.eventType === 'BLUFF' || entry.eventType === 'FAILED_GAMBLE' ? 0.58 : undefined,
      confidenceSignal01: entry.eventType === 'COMEBACK' || entry.eventType === 'DISCIPLINE' ? 0.72 : undefined,
    };
  }

  // readMsgChannelId + readMsgBotSource replace message.channel + message.botSource (error line 972)
  const channelId = readMsgChannelId(message);
  const botSource = readMsgBotSource(message);

  if (channelId === 'DEAL_ROOM' && botSource?.isRetreat === false) {
    pushNote('channel=deal-room+bot-active'); tags.push('deal-room', 'pressure');
    return { eventType: 'DEAL_ROOM_STANDOFF', notes, tags, pressureBand, sourceReliability01: 0.68, leverageRisk01: 0.50, confidenceSignal01: 0.34 };
  }

  // readMsgBotSource replaces message.botSource (error line 986)
  if (botSource?.isRetreat) {
    pushNote('botSource.isRetreat'); tags.push('retreat');
    return { eventType: 'COMEBACK', notes, tags, pressureBand, sourceReliability01: 0.70, confidenceSignal01: 0.66 };
  }

  if (bodyLower.includes('everyone saw')) {
    pushNote('body=everyone-saw'); tags.push('public', 'witness');
    return { eventType: 'PUBLIC_WITNESS', notes, tags, pressureBand, sourceReliability01: 0.67, humiliationExposure01: 0.55 };
  }

  return { eventType: null, notes, tags, pressureBand, sourceReliability01: 0.45 };
}

/* ========================================================================== */
/* MARK: Callback generation                                                  */
/* ========================================================================== */

function buildDefaultCallbacks(
  record: ChatEpisodicMemoryRecord,
  summarySoftLimit: number,
): readonly ChatEpisodicCallbackVariant[] {
  const descriptor = descriptorOf(record.eventType);
  const summary = summarizeText(record.triggerContext.summary, summarySoftLimit);
  const stem = summary.length > 0 ? summary : descriptor.callbackStem;
  const ch = String(record.triggerContext.channelId ?? '').toUpperCase();
  const isPublic   = ch === 'GLOBAL' || ch === 'LOBBY';
  const isDealRoom = ch === 'DEAL_ROOM';
  const unresolvedState = record.unresolved ? ['UNRESOLVED'] as const : ['RESOLVED'] as const;

  return [
    {
      callbackId: buildCallbackId(record.memoryId, 'COLD', 0),
      tone: 'COLD', text: `I remember ${stem}.`,
      usageBias01: 0.74,
      eligibleSceneRoles: ['TAUNT', 'CALLBACK', 'RECKONING', 'PRESSURE_ESCALATOR'],
      eligibleChannels: ['GLOBAL', 'DEAL_ROOM', 'SYNDICATE'],
      minSalience01: 0.42, preferredEventStates: unresolvedState,
    },
    {
      callbackId: buildCallbackId(record.memoryId, 'PUBLIC', 1),
      tone: 'PUBLIC',
      text: isPublic ? `The room remembers ${stem}.` : `If this goes public, they will remember ${stem}.`,
      usageBias01: 0.62,
      eligibleSceneRoles: ['PUBLIC_WITNESS', 'TAUNT', 'CROWD_WITNESS'],
      eligibleChannels: ['GLOBAL', 'LOBBY'],
      minSalience01: 0.52, preferredEventStates: unresolvedState,
      suppressIfEmbarrassmentBelow01: 0.18,
    },
    {
      callbackId: buildCallbackId(record.memoryId, 'PRIVATE', 2),
      tone: 'PRIVATE', text: `You and I both know what ${stem} cost.`,
      usageBias01: 0.59,
      eligibleSceneRoles: ['CONFESSION', 'RESCUE', 'RECKONING', 'HELPER_INTERCEPTOR'],
      eligibleChannels: ['SYNDICATE', 'DEAL_ROOM'],
      minSalience01: 0.36, preferredEventStates: ['UNRESOLVED', 'RESOLVED'],
    },
    {
      callbackId: buildCallbackId(record.memoryId, 'MOCKING', 3),
      tone: 'MOCKING',
      text: isDealRoom
        ? `I have not forgotten ${stem}. Neither has the spread.`
        : `I have not forgotten ${stem}. Why would I?`,
      usageBias01: 0.54,
      eligibleSceneRoles: ['TAUNT', 'TRAP', 'PUNISH'],
      eligibleChannels: ['GLOBAL', 'DEAL_ROOM'],
      minSalience01: 0.46, preferredEventStates: unresolvedState,
      suppressIfEmbarrassmentBelow01: 0.24,
    },
    {
      callbackId: buildCallbackId(record.memoryId, 'CEREMONIAL', 4),
      tone: 'CEREMONIAL',
      text: `Some moments do not pass. ${stem[0]?.toUpperCase() ?? ''}${stem.slice(1)} remains one of them.`,
      usageBias01: 0.44,
      eligibleSceneRoles: ['ECHO', 'POST_BEAT_ECHO', 'PUBLIC_WITNESS'],
      eligibleChannels: ['GLOBAL', 'SYNDICATE', 'LOBBY'],
      minSalience01: 0.66, preferredEventStates: ['RESOLVED'],
    },
    {
      callbackId: buildCallbackId(record.memoryId, 'POST_EVENT', 5),
      tone: 'POST_EVENT',
      text: `After ${stem}, the room stopped reading you the same way.`,
      usageBias01: 0.48,
      eligibleSceneRoles: ['POST_BEAT_ECHO', 'CALLBACK', 'RECKONING'],
      eligibleChannels: ['GLOBAL', 'DEAL_ROOM', 'SYNDICATE'],
      minSalience01: 0.58, preferredEventStates: ['RESOLVED', 'UNRESOLVED'],
    },
  ];
}

/* ========================================================================== */
/* MARK: Main class                                                           */
/* ========================================================================== */

export class ChatEpisodicMemory {
  private readonly options: Required<ChatEpisodicMemoryOptions>;
  private readonly createdAt: UnixMs;
  private updatedAt: UnixMs;
  private lastCarryoverSummary?: string;

  private readonly activeMemories   = new Map<string, ChatEpisodicMemoryRecord>();
  private readonly archivedMemories = new Map<string, ChatEpisodicMemoryRecord>();

  private readonly memoryIdsByFingerprint = new Map<string, string>();
  private readonly memoryIdsByBot         = new Map<string, Set<string>>();
  private readonly memoryIdsByCounterpart = new Map<string, Set<string>>();
  private readonly memoryIdsByRoom        = new Map<string, Set<string>>();
  private readonly memoryIdsByChannel     = new Map<string, Set<string>>();
  private readonly memoryIdsByEventType   = new Map<ChatEpisodicEventType, Set<string>>();

  public constructor(options: ChatEpisodicMemoryOptions = {}, now: UnixMs = nowUnixMs()) {
    const D = CHAT_EPISODIC_MEMORY_DEFAULTS;
    this.options = {
      activeMemoryCap:         clampPositiveInteger(options.activeMemoryCap         ?? D.activeMemoryCap,         D.activeMemoryCap),
      archivedMemoryCap:       clampPositiveInteger(options.archivedMemoryCap       ?? D.archivedMemoryCap,       D.archivedMemoryCap),
      defaultExpiryMs:         clampPositiveInteger(options.defaultExpiryMs         ?? D.defaultExpiryMs,         D.defaultExpiryMs),
      dedupeWindowMs:          clampPositiveInteger(options.dedupeWindowMs          ?? D.dedupeWindowMs,          D.dedupeWindowMs),
      callbackReuseCooldownMs: clampPositiveInteger(options.callbackReuseCooldownMs ?? D.callbackReuseCooldownMs, D.callbackReuseCooldownMs),
      decayHalfLifeMs:         clampPositiveInteger(options.decayHalfLifeMs         ?? D.decayHalfLifeMs,         D.decayHalfLifeMs),
      carryoverLimit:          clampPositiveInteger(options.carryoverLimit           ?? D.carryoverLimit,          D.carryoverLimit),
      summarySoftLimit:        clampPositiveInteger(options.summarySoftLimit         ?? D.summarySoftLimit,        D.summarySoftLimit),
      minSalienceToPersist01:  clamp01(options.minSalienceToPersist01 ?? D.minSalienceToPersist01),
    };
    this.createdAt = now;
    this.updatedAt = now;
  }

  public restore(snapshot: ChatEpisodicMemorySnapshot): this {
    this.clearAll();
    for (const memory of snapshot.activeMemories) {
      const n = this.normalizeRecord(memory, false);
      this.activeMemories.set(n.memoryId, n);
      this.indexRecord(n);
    }
    for (const memory of snapshot.archivedMemories) {
      const n = this.normalizeRecord(memory, true);
      this.archivedMemories.set(n.memoryId, n);
    }
    this.updatedAt = snapshot.updatedAt;
    this.lastCarryoverSummary = snapshot.lastCarryoverSummary;
    this.evictIfNeeded();
    return this;
  }

  public snapshot(): ChatEpisodicMemorySnapshot {
    const active   = this.sortMemories([...this.activeMemories.values()]);
    const archived = this.sortMemories([...this.archivedMemories.values()]);
    return {
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      activeMemories: active,
      archivedMemories: archived,
      unresolvedMemoryIds: active.filter((m) => m.unresolved).map((m) => m.memoryId),
      lastCarryoverSummary: this.lastCarryoverSummary,
    };
  }

  public get(memoryId: string): ChatEpisodicMemoryRecord | undefined {
    return this.activeMemories.get(memoryId) ?? this.archivedMemories.get(memoryId);
  }

  public has(memoryId: string): boolean {
    return this.activeMemories.has(memoryId) || this.archivedMemories.has(memoryId);
  }

  /**
   * Record a memory from a backend ChatMessage.
   * Default now uses nowUnixMs() — NOT message.ts (which does not exist on
   * the backend ChatMessage contract). Callers may pass an explicit timestamp.
   */
  public noteMessage(
    message: ChatMessage,
    now: UnixMs = nowUnixMs(),    // ← replaces: asUnixMs(message.ts) — error line 1223
  ): ChatEpisodicMemoryRecord | null {
    const inference = inferEventTypeFromMessage(message);
    if (!inference.eventType) return null;

    // readMsgChannelId replaces message.channel (error line 1228, 1236)
    const channelId  = readMsgChannelId(message);
    const visibility = channelId?.endsWith('_SHADOW') ? 'SHADOW' : 'VISIBLE';
    const sourceReliability01 = clamp01(inference.sourceReliability01);

    return this.recordEvent(
      inference.eventType,
      {
        roomId:            null,
        channelId:         message.channelId as ChatVisibleChannel,
        messageId:         String(message.id),
        // readMsgSceneId replaces message.sceneId (error line 1238)
        sceneId:           readMsgSceneId(message),
        // readMsgMomentId replaces message.momentId (error line 1239)
        momentId:          readMsgMomentId(message),
        // readMsgBotSource replaces message.botSource (error line 1240)
        botId:             readMsgBotSource(message)?.botId ?? null,
        // readMsgSenderId replaces message.senderId (error line 1241)
        counterpartId:     readMsgSenderId(message),
        pressureBand:      inference.pressureBand,
        tags:              dedupeStringArray([...inference.tags, ...notesToTags(inference.notes)]),
        // readMsgText replaces message.body (error lines 1244, 1245)
        summary:           summarizeText(readMsgText(message), this.options.summarySoftLimit),
        rawText:           readMsgText(message),
        sourceKind:        'MESSAGE',
        sourceReliability01,
        visibility,
        humiliationExposure01: inference.humiliationExposure01,
        leverageRisk01:        inference.leverageRisk01,
        confidenceSignal01:    inference.confidenceSignal01,
        evidenceRefs:          buildEvidenceRefsFromMessage(message),
      },
      now,
    );
  }

  public noteMessages(
    messages: readonly ChatMessage[],
    now?: UnixMs,
  ): readonly ChatEpisodicMemoryRecord[] {
    const results: ChatEpisodicMemoryRecord[] = [];
    for (const message of messages) {
      // readMsgTimestamp replaces message.ts (error line 1264)
      const recorded = this.noteMessage(message, now ?? readMsgTimestamp(message));
      if (recorded) results.push(recorded);
    }
    return results;
  }

  /**
   * Record a memory from a backend ChatScenePlan.
   * Default now uses nowUnixMs() then falls back to readSceneStartedAt().
   * Direct scene.startedAt does not exist on backend ChatScenePlan (error line 1273).
   */
  public noteScene(
    scene: ChatScenePlan,
    summary: string,
    now: UnixMs = readSceneStartedAt(scene),  // ← replaces: scene.startedAt — error line 1273
  ): ChatEpisodicMemoryRecord | null {
    const inference = inferEventTypeFromScene(scene, summary);
    if (!inference.eventType) return null;

    // readScenePrimaryChannel replaces scene.primaryChannel (error lines 1278, 1286)
    const primaryChannel = readScenePrimaryChannel(scene);
    const visibility = primaryChannel.endsWith('_SHADOW') ? 'SHADOW' : 'VISIBLE';

    // readSceneId replaces scene.sceneId usage
    // readSceneMomentId replaces scene.momentId (error lines 1288, 1295)
    const sceneId  = readSceneId(scene);
    const momentId = readSceneMomentId(scene);

    return this.recordEvent(
      inference.eventType,
      {
        roomId:            null,
        channelId:         primaryChannel,
        sceneId,
        momentId,
        summary:           summarizeText(summary, this.options.summarySoftLimit),
        rawText:           summary,
        tags:              dedupeStringArray([...inference.tags, ...notesToTags(inference.notes)]),
        sourceKind:        'SCENE',
        // readSceneStartedAt replaces scene.startedAt (error line 1307)
        sourceReliability01: inference.sourceReliability01,
        visibility,
        evidenceRefs: [sceneId, momentId],
      },
      now,
    );
  }

  public noteScenes(
    scenes: readonly { readonly scene: ChatScenePlan; readonly summary: string }[],
    now?: UnixMs,
  ): readonly ChatEpisodicMemoryRecord[] {
    const results: ChatEpisodicMemoryRecord[] = [];
    for (const entry of scenes) {
      // readSceneStartedAt replaces entry.scene.startedAt
      const recorded = this.noteScene(entry.scene, entry.summary, now ?? readSceneStartedAt(entry.scene));
      if (recorded) results.push(recorded);
    }
    return results;
  }

  public recordEvent(
    eventType: ChatEpisodicEventType,
    triggerContext: ChatEpisodicTriggerContext,
    now: UnixMs = nowUnixMs(),
    overrides: Partial<Omit<ChatEpisodicMemoryRecord, 'memoryId' | 'eventType' | 'triggerContext' | 'createdAt' | 'callbackVariants' | 'fingerprint' | 'dedupeKey'>> = {},
  ): ChatEpisodicMemoryRecord {
    this.updatedAt = now;
    const context    = this.normalizeTriggerContext(triggerContext);
    const fingerprint = buildFingerprint(eventType, context, this.options.summarySoftLimit);
    const dedupeKey  = `${eventType}:${fingerprint}`;

    const merged = this.tryMergeIntoExisting(eventType, context, dedupeKey, now, overrides);
    if (merged) return merged;

    const salience01         = overrides.salience01         ?? this.deriveSalience(eventType, context, now);
    const emotionalWeight01  = overrides.emotionalWeight01  ?? this.deriveEmotionalWeight(eventType, context);
    const strategicWeight01  = overrides.strategicWeight01  ?? this.deriveStrategicWeight(eventType, context);
    const embarrassmentRisk01 = overrides.embarrassmentRisk01 ?? this.deriveEmbarrassmentRisk(eventType, context);

    if (salience01 < this.options.minSalienceToPersist01) {
      return this.buildRecord(eventType, context, fingerprint, dedupeKey, now, salience01, emotionalWeight01, strategicWeight01, embarrassmentRisk01, overrides, true);
    }

    const record = this.buildRecord(eventType, context, fingerprint, dedupeKey, now, salience01, emotionalWeight01, strategicWeight01, embarrassmentRisk01, overrides, false);
    this.activeMemories.set(record.memoryId, record);
    this.indexRecord(record);
    this.evictIfNeeded();
    return record;
  }

  public patch(memoryId: string, patch: ChatEpisodicMemoryPatch, now: UnixMs = nowUnixMs()): ChatEpisodicMemoryRecord | null {
    const current = this.activeMemories.get(memoryId) ?? this.archivedMemories.get(memoryId);
    if (!current) return null;
    const updated = this.normalizeRecord({
      ...current,
      unresolved:          patch.unresolved         ?? current.unresolved,
      archived:            patch.archived            ?? current.archived,
      expiresAt:           patch.expiresAt === null  ? undefined : patch.expiresAt ?? current.expiresAt,
      salience01:          clamp01(current.salience01 + (patch.salienceDelta01 ?? 0)),
      emotionalWeight01:   clamp01(current.emotionalWeight01 + (patch.emotionalDelta01 ?? 0)),
      strategicWeight01:   clamp01(current.strategicWeight01 + (patch.strategicDelta01 ?? 0)),
      embarrassmentRisk01: clamp01(current.embarrassmentRisk01 + (patch.embarrassmentDelta01 ?? 0)),
      resolutionReason:    patch.resolutionReason === null ? undefined : patch.resolutionReason ?? current.resolutionReason,
      resolutionSummary:   patch.resolutionSummary === null ? undefined : patch.resolutionSummary ?? current.resolutionSummary,
      triggerContext: { ...current.triggerContext, tags: dedupeStringArray([...(current.triggerContext.tags ?? []), ...(patch.tagsToAdd ?? [])]) },
      lastStrengthenedAt: now, lastEventAt: now,
    }, current.archived || patch.archived === true);
    this.replaceRecord(current, updated);
    this.updatedAt = now;
    return updated;
  }

  public resolve(memoryId: string, reason = 'resolved', summary?: string, now: UnixMs = nowUnixMs()): ChatEpisodicMemoryRecord | null {
    return this.patch(memoryId, { unresolved: false, resolutionReason: reason, resolutionSummary: summary ?? reason }, now);
  }

  public reopen(memoryId: string, now: UnixMs = nowUnixMs()): ChatEpisodicMemoryRecord | null {
    return this.patch(memoryId, { unresolved: true, resolutionReason: null, resolutionSummary: null, salienceDelta01: 0.04 }, now);
  }

  public archive(memoryId: string, now: UnixMs = nowUnixMs()): ChatEpisodicMemoryRecord | null {
    const current = this.activeMemories.get(memoryId);
    if (!current) return null;
    const archived = this.normalizeRecord({ ...current, archived: true, unresolved: false, resolutionReason: current.resolutionReason ?? 'archived', resolutionSummary: current.resolutionSummary ?? 'Archived from active episodic pool.', lastEventAt: now }, true);
    this.activeMemories.delete(memoryId);
    this.deindexRecord(current);
    this.archivedMemories.set(memoryId, archived);
    this.updatedAt = now;
    this.evictIfNeeded();
    return archived;
  }

  public markReused(memoryId: string, callbackId?: string, now: UnixMs = nowUnixMs()): void {
    const current = this.activeMemories.get(memoryId);
    if (!current) return;
    const updated = this.normalizeRecord({ ...current, timesReused: current.timesReused + 1, lastReferencedAt: now, lastEventAt: now, unresolved: callbackId ? false : current.unresolved }, false);
    this.replaceRecord(current, updated);
    this.updatedAt = now;
  }

  public strengthen(memoryId: string, delta01: number, now: UnixMs = nowUnixMs()): void {
    const current = this.activeMemories.get(memoryId);
    if (!current) return;
    const d = clamp01(Math.max(0, delta01));
    const updated = this.normalizeRecord({ ...current, salience01: clamp01(current.salience01 + d), emotionalWeight01: clamp01(current.emotionalWeight01 + (d * 0.50)), strategicWeight01: clamp01(current.strategicWeight01 + (d * 0.35)), lastStrengthenedAt: now, lastEventAt: now, strengthCount: (current.strengthCount ?? 1) + 1 }, false);
    this.replaceRecord(current, updated);
    this.updatedAt = now;
  }

  public decay(now: UnixMs = nowUnixMs()): readonly ChatEpisodicMemoryRecord[] {
    const updated: ChatEpisodicMemoryRecord[] = [];
    for (const current of [...this.activeMemories.values()]) {
      const lastTouch = Number(current.lastStrengthenedAt ?? current.lastReferencedAt ?? current.lastEventAt ?? current.createdAt);
      const elapsed = Math.max(0, Number(now) - lastTouch);
      if (elapsed <= 0) continue;
      const decayRatio = Math.pow(0.5, elapsed / this.options.decayHalfLifeMs);
      const descriptor = descriptorOf(current.eventType);
      const floor = current.unresolved ? 0.34 : 0.18;
      const targetSalience = clamp01(Math.max(floor, current.salience01 * decayRatio * (descriptor.priorityTier === 'LEGENDARY' ? 1.08 : 1)));
      if (Math.abs(targetSalience - current.salience01) < 0.01) continue;
      const next = this.normalizeRecord({ ...current, salience01: targetSalience, emotionalWeight01: clamp01(current.emotionalWeight01 * (0.92 + (current.unresolved ? 0.03 : 0))), strategicWeight01: clamp01(current.strategicWeight01 * 0.96) }, false);
      this.replaceRecord(current, next);
      updated.push(next);
    }
    this.updatedAt = now;
    return updated;
  }

  public archiveExpired(now: UnixMs = nowUnixMs()): readonly ChatEpisodicMemoryRecord[] {
    const archived: ChatEpisodicMemoryRecord[] = [];
    for (const [memoryId, memory] of [...this.activeMemories.entries()]) {
      if (memory.expiresAt == null || Number(memory.expiresAt) > Number(now)) continue;
      const result = this.archive(memoryId, now);
      if (result) archived.push(result);
    }
    this.updatedAt = now;
    return archived;
  }

  public query(query: ChatEpisodicMemoryQuery = {}): readonly ChatEpisodicMemoryRecord[] {
    const pool = this.materializeQueryPool(query);
    let records = pool.map((id) => this.activeMemories.get(id) ?? this.archivedMemories.get(id)).filter(Boolean) as ChatEpisodicMemoryRecord[];
    if (query.eventTypes?.length) { const allow = new Set(query.eventTypes); records = records.filter((m) => allow.has(m.eventType)); }
    if (query.unresolvedOnly)    records = records.filter((m) => m.unresolved);
    if (query.activeOnly)        records = records.filter((m) => !m.archived);
    if (!query.includeArchived)  records = records.filter((m) => !m.archived);
    if (query.tags?.length) {
      const tags = new Set(query.tags.map(normalizeKey));
      records = records.filter((m) => {
        const mTags = new Set((m.triggerContext.tags ?? []).map(normalizeKey));
        for (const tag of tags) { if (mTags.has(tag)) return true; }
        return false;
      });
    }
    if (query.searchText) {
      const tokens = tokenize(query.searchText);
      records = records.filter((m) => {
        const hay = `${m.triggerContext.summary} ${m.triggerContext.rawText ?? ''}`.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      });
    }
    if (query.sinceAt != null) {
      records = records.filter((m) => Number(m.lastEventAt ?? m.createdAt) >= Number(query.sinceAt));
    }
    const sorted = this.sortMemories(records);
    return typeof query.limit === 'number' ? sorted.slice(0, query.limit) : sorted;
  }

  public queryCallbacks(request: ChatEpisodicCallbackRequest): readonly ChatEpisodicCallbackCandidate[] {
    const pool = this.query({ botId: request.botId, counterpartId: request.counterpartId, roomId: request.roomId, activeOnly: true, limit: 128 });
    const tones   = new Set(request.preferredTones ?? []);
    const ch      = canonicalizeChannel(request.channelId);
    const role    = stringifyMaybe(request.sceneRole)?.toUpperCase() ?? null;
    const reqCh   = request.requireChannelEligibility ?? false;
    const reqRole = request.requireSceneRoleEligibility ?? false;
    const preferUnresolved = request.preferUnresolved ?? true;
    const candidates: ChatEpisodicCallbackCandidate[] = [];
    for (const memory of pool) {
      for (const callback of memory.callbackVariants) {
        const c = this.scoreCallbackCandidate(memory, callback, tones, ch, role, reqCh, reqRole, preferUnresolved);
        if (c) candidates.push(c);
      }
    }
    return candidates.sort((a, b) => b.score01 - a.score01 || a.callbackId.localeCompare(b.callbackId)).slice(0, request.maxResults ?? 8);
  }

  public pickBestCallback(request: ChatEpisodicCallbackRequest, options: { readonly markReused?: boolean; readonly at?: UnixMs } = {}): ChatEpisodicCallbackCandidate | null {
    const [top] = this.queryCallbacks({ ...request, maxResults: 1 });
    if (!top) return null;
    if (options.markReused) this.markReused(top.memoryId, top.callbackId, options.at ?? nowUnixMs());
    return top;
  }

  public buildCarryoverItems(limit = this.options.carryoverLimit): readonly ChatEpisodicCarryoverItem[] {
    return this.sortMemories([...this.activeMemories.values()])
      .filter((m) => m.unresolved || m.salience01 >= 0.68)
      .slice(0, limit)
      .map((m) => ({
        memoryId:    m.memoryId,
        eventType:   m.eventType,
        priorityTier: m.priorityTier ?? descriptorOf(m.eventType).priorityTier,
        unresolved:  m.unresolved,
        summary:     m.triggerContext.summary,
        channelId:   stringifyMaybe(m.triggerContext.channelId ? String(m.triggerContext.channelId) : null),
        score01:     this.scoreMemory(m),
      }));
  }

  public buildCarryoverSummary(limit = this.options.carryoverLimit): string | undefined {
    const items = this.buildCarryoverItems(limit);
    if (!items.length) return undefined;
    const summary = items.map((m) => `${m.eventType.toLowerCase().replace(/_/g, ' ')}: ${m.summary}`).join(' | ');
    this.lastCarryoverSummary = summary;
    return summary;
  }

  public reconcileAuthoritativeRecords(records: readonly ChatEpisodicMemoryRecord[], now: UnixMs = nowUnixMs()): readonly ChatEpisodicMemoryRecord[] {
    const results: ChatEpisodicMemoryRecord[] = [];
    for (const incoming of records) {
      const normalized = this.normalizeRecord(incoming, Boolean(incoming.archived));
      const existing   = normalized.fingerprint ? this.findActiveByFingerprint(normalized.fingerprint) : undefined;
      if (!existing) {
        if (normalized.archived) this.archivedMemories.set(normalized.memoryId, normalized);
        else { this.activeMemories.set(normalized.memoryId, normalized); this.indexRecord(normalized); }
        results.push(normalized);
        continue;
      }
      const merged = this.mergeRecords(existing, normalized, now, true);
      this.replaceRecord(existing, merged);
      results.push(merged);
    }
    this.updatedAt = now;
    this.evictIfNeeded();
    return results;
  }

  public inspect(): {
    readonly moduleName: typeof CHAT_EPISODIC_MEMORY_MODULE_NAME;
    readonly version: typeof CHAT_EPISODIC_MEMORY_VERSION;
    readonly activeCount: number;
    readonly archivedCount: number;
    readonly unresolvedCount: number;
    readonly latestCarryoverSummary?: string;
  } {
    return {
      moduleName:              CHAT_EPISODIC_MEMORY_MODULE_NAME,
      version:                 CHAT_EPISODIC_MEMORY_VERSION,
      activeCount:             this.activeMemories.size,
      archivedCount:           this.archivedMemories.size,
      unresolvedCount:         [...this.activeMemories.values()].filter((m) => m.unresolved).length,
      latestCarryoverSummary:  this.lastCarryoverSummary,
    };
  }

  /* ── Private helpers ─────────────────────────────────────────────── */

  private buildRecord(
    eventType: ChatEpisodicEventType, context: ChatEpisodicTriggerContext,
    fingerprint: string, dedupeKey: string, now: UnixMs,
    salience01: number, emotionalWeight01: number, strategicWeight01: number, embarrassmentRisk01: number,
    overrides: Partial<Omit<ChatEpisodicMemoryRecord, 'memoryId' | 'eventType' | 'triggerContext' | 'createdAt' | 'callbackVariants' | 'fingerprint' | 'dedupeKey'>>,
    ephemeral: boolean,
  ): ChatEpisodicMemoryRecord {
    const descriptor  = descriptorOf(eventType);
    const priorityTier = computePriorityTier(salience01, descriptor.priorityTier);
    const memoryId    = buildMemoryId(eventType, fingerprint, now);
    const base: ChatEpisodicMemoryRecord = {
      memoryId, playerId: overrides.playerId ?? null, botId: context.botId ?? null,
      counterpartId: context.counterpartId ?? null, roomId: context.roomId ?? null,
      eventType, triggerContext: context, salience01, emotionalWeight01, strategicWeight01, embarrassmentRisk01,
      callbackVariants: [],
      createdAt: now, lastReferencedAt: overrides.lastReferencedAt, lastStrengthenedAt: overrides.lastStrengthenedAt,
      timesReused: overrides.timesReused ?? 0,
      unresolved: overrides.unresolved ?? descriptor.defaultUnresolved,
      expiresAt: overrides.expiresAt ?? asUnixMs(Number(now) + this.resolveExpiryMs(eventType, context, salience01)),
      archived: overrides.archived ?? false, fingerprint, dedupeKey,
      lastEventAt: overrides.lastEventAt ?? now, strengthCount: overrides.strengthCount ?? 1,
      sourceReliability01: overrides.sourceReliability01 ?? clamp01(context.sourceReliability01 ?? 0.70),
      priorityTier, resolutionReason: overrides.resolutionReason, resolutionSummary: overrides.resolutionSummary,
      channelAffinity: ensureReadonlyCopy(this.buildChannelAffinity(context, eventType)),
    };
    const withCallbacks = { ...base, callbackVariants: buildDefaultCallbacks(base, this.options.summarySoftLimit) };
    return ephemeral ? withCallbacks : this.normalizeRecord(withCallbacks, false);
  }

  private clearAll(): void {
    this.activeMemories.clear(); this.archivedMemories.clear();
    this.memoryIdsByFingerprint.clear(); this.memoryIdsByBot.clear();
    this.memoryIdsByCounterpart.clear(); this.memoryIdsByRoom.clear();
    this.memoryIdsByChannel.clear(); this.memoryIdsByEventType.clear();
  }

  private normalizeTriggerContext(ctx: ChatEpisodicTriggerContext): ChatEpisodicTriggerContext {
    const summary = summarizeText(ctx.summary, this.options.summarySoftLimit);
    return {
      ...ctx,
      roomId:        stringifyMaybe(ctx.roomId),
      channelId:     stringifyMaybe(ctx.channelId ? String(ctx.channelId) : null),
      messageId:     stringifyMaybe(ctx.messageId),
      sceneId:       stringifyMaybe(ctx.sceneId),
      momentId:      stringifyMaybe(ctx.momentId),
      botId:         stringifyMaybe(ctx.botId ? String(ctx.botId) : null),
      counterpartId: stringifyMaybe(ctx.counterpartId),
      pressureBand:  normalizePressureBand(ctx.pressureBand),
      tags: dedupeStringArray([...(ctx.tags ?? []), ...(ctx.visibility === 'SHADOW' ? ['shadow'] : [])]),
      summary, rawText: ctx.rawText ? normalizeText(ctx.rawText) : undefined,
      sourceKind: ctx.sourceKind ?? 'SYSTEM',
      sourceReliability01: clamp01(ctx.sourceReliability01 ?? 0.70),
      visibility: ctx.visibility ?? 'VISIBLE',
      humiliationExposure01: clamp01(ctx.humiliationExposure01 ?? 0),
      leverageRisk01:        clamp01(ctx.leverageRisk01 ?? 0),
      confidenceSignal01:    clamp01(ctx.confidenceSignal01 ?? 0),
      evidenceRefs: dedupeStringArray(ctx.evidenceRefs),
    };
  }

  private normalizeRecord(record: ChatEpisodicMemoryRecord, archived: boolean): ChatEpisodicMemoryRecord {
    const ctx = this.normalizeTriggerContext(record.triggerContext);
    const fingerprint = record.fingerprint ?? buildFingerprint(record.eventType, ctx, this.options.summarySoftLimit);
    const dedupeKey   = record.dedupeKey ?? `${record.eventType}:${fingerprint}`;
    const descriptor  = descriptorOf(record.eventType);
    const salience01  = clamp01(record.salience01);
    return {
      ...record,
      botId: stringifyMaybe(record.botId ? String(record.botId) : null),
      counterpartId: stringifyMaybe(record.counterpartId),
      roomId: stringifyMaybe(record.roomId),
      triggerContext: ctx, salience01,
      emotionalWeight01:   clamp01(record.emotionalWeight01),
      strategicWeight01:   clamp01(record.strategicWeight01),
      embarrassmentRisk01: clamp01(record.embarrassmentRisk01),
      callbackVariants: record.callbackVariants?.length
        ? ensureReadonlyCopy(record.callbackVariants)
        : buildDefaultCallbacks({ ...record, triggerContext: ctx, salience01, callbackVariants: [], archived, fingerprint, dedupeKey }, this.options.summarySoftLimit),
      createdAt: asUnixMs(Number(record.createdAt)),
      lastReferencedAt: record.lastReferencedAt != null ? asUnixMs(Number(record.lastReferencedAt)) : undefined,
      lastStrengthenedAt: record.lastStrengthenedAt != null ? asUnixMs(Number(record.lastStrengthenedAt)) : undefined,
      timesReused: Math.max(0, Math.floor(record.timesReused ?? 0)),
      unresolved: Boolean(record.unresolved),
      expiresAt: record.expiresAt != null ? asUnixMs(Number(record.expiresAt)) : undefined,
      archived, fingerprint, dedupeKey,
      lastEventAt: record.lastEventAt != null ? asUnixMs(Number(record.lastEventAt)) : asUnixMs(Number(record.createdAt)),
      strengthCount: Math.max(1, Math.floor(record.strengthCount ?? 1)),
      sourceReliability01: clamp01(record.sourceReliability01 ?? ctx.sourceReliability01 ?? 0.70),
      priorityTier: record.priorityTier ?? computePriorityTier(salience01, descriptor.priorityTier),
      resolutionReason: stringifyMaybe(record.resolutionReason) ?? undefined,
      resolutionSummary: stringifyMaybe(record.resolutionSummary) ?? undefined,
      channelAffinity: ensureReadonlyCopy(record.channelAffinity?.length ? record.channelAffinity : this.buildChannelAffinity(ctx, record.eventType)),
    };
  }

  private resolveExpiryMs(eventType: ChatEpisodicEventType, ctx: ChatEpisodicTriggerContext, salience01: number): number {
    const descriptor = descriptorOf(eventType);
    let ttl = descriptor.defaultExpiryMs;
    if (ctx.pressureBand) ttl += Math.floor(ttl * PRESSURE_BAND_BOOST[ctx.pressureBand] * 0.25);
    if ((ctx.tags ?? []).includes('legend')) ttl += 45 * DAY_MS;
    if (salience01 >= 0.90) ttl += 60 * DAY_MS;
    else if (salience01 <= 0.45) ttl -= 21 * DAY_MS;
    return Math.max(7 * DAY_MS, ttl || this.options.defaultExpiryMs);
  }

  private buildChannelAffinity(ctx: ChatEpisodicTriggerContext, eventType: ChatEpisodicEventType): readonly string[] {
    const descriptor = descriptorOf(eventType);
    const affinity   = new Set<string>();
    const primary    = canonicalizeChannel(ctx.channelId ? String(ctx.channelId) : null);
    if (primary) affinity.add(primary);
    if (descriptor.tags.includes('deal-room')) affinity.add('DEAL_ROOM');
    if (descriptor.tags.includes('public'))    affinity.add('GLOBAL');
    if (descriptor.tags.includes('private'))   affinity.add('SYNDICATE');
    if (ctx.visibility === 'SHADOW') affinity.add('SYSTEM_SHADOW');
    if (eventType === 'RESCUE')         affinity.add('SYNDICATE');
    if (eventType === 'PUBLIC_WITNESS') affinity.add('LOBBY');
    return [...affinity];
  }

  private tryMergeIntoExisting(
    eventType: ChatEpisodicEventType, context: ChatEpisodicTriggerContext,
    dedupeKey: string, now: UnixMs,
    overrides: Partial<Omit<ChatEpisodicMemoryRecord, 'memoryId' | 'eventType' | 'triggerContext' | 'createdAt' | 'callbackVariants' | 'fingerprint' | 'dedupeKey'>>,
  ): ChatEpisodicMemoryRecord | null {
    const existingId = this.memoryIdsByFingerprint.get(dedupeKey);
    if (!existingId) return null;
    const current = this.activeMemories.get(existingId);
    if (!current) return null;
    const lastEventAt = Number(current.lastEventAt ?? current.createdAt);
    if (Math.abs(Number(now) - lastEventAt) > this.options.dedupeWindowMs) return null;
    const merged = this.mergeRecords(
      current,
      this.buildRecord(eventType, context, current.fingerprint ?? dedupeKey, dedupeKey, now,
        overrides.salience01 ?? this.deriveSalience(eventType, context, now),
        overrides.emotionalWeight01 ?? this.deriveEmotionalWeight(eventType, context),
        overrides.strategicWeight01 ?? this.deriveStrategicWeight(eventType, context),
        overrides.embarrassmentRisk01 ?? this.deriveEmbarrassmentRisk(eventType, context),
        overrides, false),
      now, false,
    );
    this.replaceRecord(current, merged);
    return merged;
  }

  private mergeRecords(current: ChatEpisodicMemoryRecord, incoming: ChatEpisodicMemoryRecord, now: UnixMs, authoritative: boolean): ChatEpisodicMemoryRecord {
    const mergedCtx: ChatEpisodicTriggerContext = {
      ...current.triggerContext, ...incoming.triggerContext,
      tags: dedupeStringArray([...(current.triggerContext.tags ?? []), ...(incoming.triggerContext.tags ?? [])]),
      evidenceRefs: dedupeStringArray([...(current.triggerContext.evidenceRefs ?? []), ...(incoming.triggerContext.evidenceRefs ?? [])]),
      summary: incoming.triggerContext.summary.length > current.triggerContext.summary.length ? incoming.triggerContext.summary : current.triggerContext.summary,
      rawText: incoming.triggerContext.rawText && incoming.triggerContext.rawText.length > (current.triggerContext.rawText?.length ?? 0) ? incoming.triggerContext.rawText : current.triggerContext.rawText,
      sourceReliability01: clamp01(Math.max(current.triggerContext.sourceReliability01 ?? 0, incoming.triggerContext.sourceReliability01 ?? 0)),
      humiliationExposure01: clamp01(Math.max(current.triggerContext.humiliationExposure01 ?? 0, incoming.triggerContext.humiliationExposure01 ?? 0)),
      leverageRisk01: clamp01(Math.max(current.triggerContext.leverageRisk01 ?? 0, incoming.triggerContext.leverageRisk01 ?? 0)),
      confidenceSignal01: clamp01(Math.max(current.triggerContext.confidenceSignal01 ?? 0, incoming.triggerContext.confidenceSignal01 ?? 0)),
    };
    const salience01 = clamp01(authoritative ? Math.max(current.salience01, incoming.salience01) : Math.max(current.salience01, current.salience01 + (incoming.salience01 * 0.18)));
    const merged: ChatEpisodicMemoryRecord = this.normalizeRecord({
      ...current, triggerContext: mergedCtx, salience01,
      emotionalWeight01: clamp01(authoritative ? Math.max(current.emotionalWeight01, incoming.emotionalWeight01) : current.emotionalWeight01 + (incoming.emotionalWeight01 * 0.12)),
      strategicWeight01: clamp01(authoritative ? Math.max(current.strategicWeight01, incoming.strategicWeight01) : current.strategicWeight01 + (incoming.strategicWeight01 * 0.12)),
      embarrassmentRisk01: clamp01(authoritative ? Math.max(current.embarrassmentRisk01, incoming.embarrassmentRisk01) : current.embarrassmentRisk01 + (incoming.embarrassmentRisk01 * 0.10)),
      callbackVariants: dedupeCallbackVariants([...current.callbackVariants, ...incoming.callbackVariants]),
      lastStrengthenedAt: now, lastEventAt: now, strengthCount: (current.strengthCount ?? 1) + 1,
      unresolved: authoritative ? incoming.unresolved : current.unresolved || incoming.unresolved,
      archived: authoritative ? incoming.archived : current.archived,
      expiresAt: authoritative && incoming.expiresAt != null ? incoming.expiresAt : asUnixMs(Math.max(Number(current.expiresAt ?? current.createdAt), Number(incoming.expiresAt ?? incoming.createdAt))),
      sourceReliability01: clamp01(Math.max(current.sourceReliability01 ?? 0, incoming.sourceReliability01 ?? 0)),
      priorityTier: computePriorityTier(salience01, authoritative ? incoming.priorityTier ?? descriptorOf(current.eventType).priorityTier : current.priorityTier ?? descriptorOf(current.eventType).priorityTier),
      resolutionReason: authoritative ? incoming.resolutionReason ?? current.resolutionReason : current.resolutionReason,
      resolutionSummary: authoritative ? incoming.resolutionSummary ?? current.resolutionSummary : current.resolutionSummary,
    }, authoritative ? incoming.archived : current.archived);
    return {
      ...merged,
      callbackVariants: merged.callbackVariants.length >= 6 ? merged.callbackVariants : buildDefaultCallbacks(merged, this.options.summarySoftLimit),
    };
  }

  private replaceRecord(previous: ChatEpisodicMemoryRecord, next: ChatEpisodicMemoryRecord): void {
    if (previous.archived) {
      this.archivedMemories.delete(previous.memoryId);
      this.archivedMemories.set(next.memoryId, next);
      return;
    }
    this.activeMemories.delete(previous.memoryId);
    this.deindexRecord(previous);
    this.activeMemories.set(next.memoryId, next);
    this.indexRecord(next);
  }

  private materializeQueryPool(query: ChatEpisodicMemoryQuery): readonly string[] {
    const sets: Set<string>[] = [];
    if (query.botId != null)          sets.push(this.memoryIdsByBot.get(String(query.botId))          ?? new Set());
    if (query.counterpartId != null)  sets.push(this.memoryIdsByCounterpart.get(String(query.counterpartId)) ?? new Set());
    if (query.roomId != null)         sets.push(this.memoryIdsByRoom.get(String(query.roomId))         ?? new Set());
    if (query.channelId != null)      sets.push(this.memoryIdsByChannel.get(String(query.channelId).toUpperCase()) ?? new Set());
    if (query.eventTypes?.length === 1) sets.push(this.memoryIdsByEventType.get(query.eventTypes[0]) ?? new Set());
    if (sets.length === 0) {
      const base = query.includeArchived ? [...this.activeMemories.keys(), ...this.archivedMemories.keys()] : [...this.activeMemories.keys()];
      return base;
    }
    const [first, ...rest] = sets;
    const intersection = new Set(first);
    for (const s of rest) { for (const id of [...intersection]) { if (!s.has(id)) intersection.delete(id); } }
    if (query.includeArchived) {
      for (const [id, a] of this.archivedMemories) {
        if (query.botId != null && String(a.botId ?? '') !== String(query.botId)) continue;
        if (query.counterpartId != null && String(a.counterpartId ?? '') !== String(query.counterpartId)) continue;
        if (query.roomId != null && String(a.roomId ?? '') !== String(query.roomId)) continue;
        if (query.channelId != null && canonicalizeChannel(String(a.triggerContext.channelId ?? '')) !== canonicalizeChannel(query.channelId)) continue;
        intersection.add(id);
      }
    }
    return [...intersection];
  }

  private scoreCallbackCandidate(memory: ChatEpisodicMemoryRecord, callback: ChatEpisodicCallbackVariant, tones: ReadonlySet<ChatCallbackTone>, channelId: string | null, sceneRole: string | null, reqCh: boolean, reqRole: boolean, preferUnresolved: boolean): ChatEpisodicCallbackCandidate | null {
    const chMatch   = !channelId || callback.eligibleChannels.includes(channelId);
    const roleMatch = !sceneRole || callback.eligibleSceneRoles.includes(sceneRole);
    if (reqCh   && !chMatch)   return null;
    if (reqRole && !roleMatch) return null;
    if (callback.minSalience01 != null && memory.salience01 < callback.minSalience01) return null;
    if (callback.suppressIfEmbarrassmentBelow01 != null && memory.embarrassmentRisk01 < callback.suppressIfEmbarrassmentBelow01) return null;
    const notes: string[] = [];
    if (chMatch)   notes.push('channel_match');
    if (roleMatch) notes.push('scene_match');
    if (tones.size > 0 && tones.has(callback.tone)) notes.push('preferred_tone');
    if (memory.unresolved) notes.push('unresolved');
    const cooldownPenalty = this.computeReusePenalty(memory);
    let score = this.scoreMemory(memory) * 0.56;
    score += callback.usageBias01 * 0.18;
    score += chMatch   ? 0.08 : -0.05;
    score += roleMatch ? 0.08 : -0.04;
    score += tones.size > 0 ? (tones.has(callback.tone) ? 0.10 : -0.05) : 0.03;
    score += preferUnresolved && memory.unresolved ? 0.06 : 0;
    score -= cooldownPenalty;
    if (callback.preferredEventStates?.length) {
      const state = memory.unresolved ? 'UNRESOLVED' : 'RESOLVED';
      if (callback.preferredEventStates.includes(state)) { score += 0.04; notes.push(`state=${state.toLowerCase()}`); }
    }
    return { memoryId: memory.memoryId, callbackId: callback.callbackId, eventType: memory.eventType, unresolved: memory.unresolved, salience01: memory.salience01, score01: clamp01(score), tone: callback.tone, text: callback.text, notes };
  }

  private computeReusePenalty(memory: ChatEpisodicMemoryRecord): number {
    let penalty = Math.min(0.24, (memory.timesReused ?? 0) * 0.035);
    if (memory.lastReferencedAt == null) return penalty;
    if (Number(this.updatedAt) - Number(memory.lastReferencedAt) < this.options.callbackReuseCooldownMs) penalty += 0.12;
    return penalty;
  }

  private scoreMemory(memory: ChatEpisodicMemoryRecord): number {
    let score = 0;
    score += memory.salience01         * 0.46;
    score += memory.emotionalWeight01  * 0.16;
    score += memory.strategicWeight01  * 0.16;
    score += memory.embarrassmentRisk01 * 0.12;
    score += memory.unresolved ? 0.06 : 0;
    score += memory.priorityTier === 'LEGENDARY' ? 0.04 : 0;
    const recencyHours = (Number(this.updatedAt) - Number(memory.lastEventAt ?? memory.createdAt)) / HOUR_MS;
    if (recencyHours <= 24)       score += 0.04;
    if (recencyHours >= 24 * 14)  score -= 0.05;
    return clamp01(score);
  }

  private sortMemories(memories: readonly ChatEpisodicMemoryRecord[]): readonly ChatEpisodicMemoryRecord[] {
    return [...memories].sort((a, b) => {
      const as = this.scoreMemory(a), bs = this.scoreMemory(b);
      if (as !== bs) return bs - as;
      return Number(b.lastEventAt ?? b.createdAt) - Number(a.lastEventAt ?? a.createdAt);
    });
  }

  private evictIfNeeded(): void {
    const active = [...this.sortMemories([...this.activeMemories.values()])];
    while (active.length > this.options.activeMemoryCap) { const v = active.pop(); if (!v) break; this.archive(v.memoryId, this.updatedAt); }
    const archived = [...this.sortMemories([...this.archivedMemories.values()])];
    while (archived.length > this.options.archivedMemoryCap) { const v = archived.pop(); if (!v) break; this.archivedMemories.delete(v.memoryId); }
  }

  private deriveSalience(eventType: ChatEpisodicEventType, ctx: ChatEpisodicTriggerContext, now: UnixMs): number {
    const descriptor = descriptorOf(eventType);
    let score = descriptor.baseSalience01;
    if (ctx.pressureBand) score += PRESSURE_BAND_BOOST[ctx.pressureBand];
    const ch = canonicalizeChannel(ctx.channelId ? String(ctx.channelId) : null);
    if (ch === 'GLOBAL') score += 0.04;
    if (ch === 'DEAL_ROOM') score += 0.03;
    if (ch?.endsWith('_SHADOW')) score -= 0.04;
    if ((ctx.tags ?? []).includes('legend')) score += 0.10;
    if ((ctx.tags ?? []).includes('scene'))  score += 0.04;
    if ((ctx.tags ?? []).includes('rescue')) score += 0.03;
    if ((ctx.confidenceSignal01 ?? 0) >= 0.80) score += 0.06;
    if ((ctx.humiliationExposure01 ?? 0) >= 0.70) score += 0.05;
    if ((ctx.leverageRisk01 ?? 0) >= 0.70) score += 0.04;
    if (Number(now) - Number(this.createdAt) < HOUR_MS) score += 0.01;
    return clamp01(score);
  }

  private deriveEmotionalWeight(eventType: ChatEpisodicEventType, ctx: ChatEpisodicTriggerContext): number {
    const d = descriptorOf(eventType);
    let score = d.emotionalBias01;
    score += (ctx.humiliationExposure01 ?? 0) * 0.22;
    score += (ctx.confidenceSignal01 ?? 0) * 0.16;
    if (ctx.pressureBand === 'CRITICAL') score += 0.12;
    if ((ctx.tags ?? []).includes('private')) score += 0.05;
    return clamp01(score);
  }

  private deriveStrategicWeight(eventType: ChatEpisodicEventType, ctx: ChatEpisodicTriggerContext): number {
    const d = descriptorOf(eventType);
    let score = d.strategicBias01;
    score += (ctx.leverageRisk01 ?? 0) * 0.24;
    if (canonicalizeChannel(String(ctx.channelId ?? '')) === 'DEAL_ROOM') score += 0.08;
    if ((ctx.tags ?? []).includes('negotiation')) score += 0.06;
    if ((ctx.tags ?? []).includes('shield'))      score += 0.04;
    return clamp01(score);
  }

  private deriveEmbarrassmentRisk(eventType: ChatEpisodicEventType, ctx: ChatEpisodicTriggerContext): number {
    const d = descriptorOf(eventType);
    let score = d.embarrassmentBias01;
    const ch = canonicalizeChannel(ctx.channelId ? String(ctx.channelId) : null);
    if (ch) score += CHANNEL_EMBARRASSMENT_BOOST[ch] ?? 0;
    score += (ctx.humiliationExposure01 ?? 0) * 0.28;
    if ((ctx.tags ?? []).includes('public')) score += 0.08;
    if (eventType === 'COMEBACK' || eventType === 'DISCIPLINE' || eventType === 'SOVEREIGNTY') score -= 0.10;
    return clamp01(score);
  }

  private indexRecord(record: ChatEpisodicMemoryRecord): void {
    if (record.dedupeKey) this.memoryIdsByFingerprint.set(record.dedupeKey, record.memoryId);
    this.addIndex(this.memoryIdsByEventType, record.eventType, record.memoryId);
    if (record.botId)         this.addIndex(this.memoryIdsByBot,         String(record.botId), record.memoryId);
    if (record.counterpartId) this.addIndex(this.memoryIdsByCounterpart, String(record.counterpartId), record.memoryId);
    if (record.roomId)        this.addIndex(this.memoryIdsByRoom,        String(record.roomId), record.memoryId);
    const ch = canonicalizeChannel(record.triggerContext.channelId ? String(record.triggerContext.channelId) : null);
    if (ch) this.addIndex(this.memoryIdsByChannel, ch, record.memoryId);
  }

  private deindexRecord(record: ChatEpisodicMemoryRecord): void {
    if (record.dedupeKey) { const cur = this.memoryIdsByFingerprint.get(record.dedupeKey); if (cur === record.memoryId) this.memoryIdsByFingerprint.delete(record.dedupeKey); }
    this.removeIndex(this.memoryIdsByEventType, record.eventType, record.memoryId);
    if (record.botId)         this.removeIndex(this.memoryIdsByBot,         String(record.botId), record.memoryId);
    if (record.counterpartId) this.removeIndex(this.memoryIdsByCounterpart, String(record.counterpartId), record.memoryId);
    if (record.roomId)        this.removeIndex(this.memoryIdsByRoom,        String(record.roomId), record.memoryId);
    const ch = canonicalizeChannel(record.triggerContext.channelId ? String(record.triggerContext.channelId) : null);
    if (ch) this.removeIndex(this.memoryIdsByChannel, ch, record.memoryId);
  }

  private findActiveByFingerprint(fingerprint: string): ChatEpisodicMemoryRecord | undefined {
    const id = this.memoryIdsByFingerprint.get(fingerprint);
    return id ? this.activeMemories.get(id) : undefined;
  }

  private addIndex<TKey extends string>(map: Map<TKey, Set<string>>, key: TKey, memoryId: string): void {
    const cur = map.get(key);
    if (cur) { cur.add(memoryId); return; }
    map.set(key, new Set([memoryId]));
  }

  private removeIndex<TKey extends string>(map: Map<TKey, Set<string>>, key: TKey, memoryId: string): void {
    const cur = map.get(key);
    if (!cur) return;
    cur.delete(memoryId);
    if (cur.size === 0) map.delete(key);
  }
}

/* ========================================================================== */
/* MARK: Public factory                                                        */
/* ========================================================================== */

export function createChatEpisodicMemory(
  options: ChatEpisodicMemoryOptions = {},
  now: UnixMs = nowUnixMs(),
): ChatEpisodicMemory {
  return new ChatEpisodicMemory(options, now);
}

export const CHAT_EPISODIC_MEMORY_NAMESPACE = Object.freeze({
  moduleName: CHAT_EPISODIC_MEMORY_MODULE_NAME,
  version:    CHAT_EPISODIC_MEMORY_VERSION,
  laws:       CHAT_EPISODIC_MEMORY_RUNTIME_LAWS,
  defaults:   CHAT_EPISODIC_MEMORY_DEFAULTS,
  eventTypes: CHAT_EPISODIC_EVENT_TYPES,
  callbackTones: CHAT_EPISODIC_CALLBACK_TONES,
  ChatEpisodicMemory,
  createChatEpisodicMemory,
} as const);

/* ========================================================================== */
/* MARK: Local helpers                                                         */
/* ========================================================================== */

function notesToTags(notes: readonly string[]): readonly string[] {
  return notes.map((n) => n.replace(/[.=><]+/g, ':'));
}

/**
 * Build evidence refs from a backend ChatMessage.
 * Uses readMsg* helpers for all fields not confirmed on the backend contract.
 * Replaces: message.sceneId (error 2585), message.momentId (error 2586),
 *           message.proofHash (error 2587)
 */
function buildEvidenceRefsFromMessage(message: ChatMessage): readonly string[] {
  const refs = [
    String(message.id),
    readMsgSceneId(message),    // replaces message.sceneId  (error line 2585)
    readMsgMomentId(message),   // replaces message.momentId (error line 2586)
    readMsgProofHash(message),  // replaces message.proofHash (error line 2587)
  ].filter(Boolean) as string[];
  return dedupeStringArray(refs);
}

function dedupeCallbackVariants(values: readonly ChatEpisodicCallbackVariant[]): readonly ChatEpisodicCallbackVariant[] {
  const byKey = new Map<string, ChatEpisodicCallbackVariant>();
  for (const v of values) {
    const key = `${v.tone}:${normalizeKey(v.text)}`;
    const ex  = byKey.get(key);
    if (!ex || v.usageBias01 > ex.usageBias01) byKey.set(key, v);
  }
  return [...byKey.values()];
}