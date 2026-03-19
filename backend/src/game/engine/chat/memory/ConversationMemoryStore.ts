/**
 * backend/src/game/engine/chat/memory/ConversationMemoryStore.ts
 *
 * Durable backend conversation-memory authority for Point Zero One chat.
 *
 * This module sits beneath quote recall, callback planning, helper trust,
 * rivalry escalation, scene orchestration, and frontend preview surfaces.
 * It is intentionally persistence-adapter-agnostic so the engine can run
 * in memory today and mirror to a database or replay ledger later.
 */

import type {
  ChatCallbackAnchor,
  ChatCallbackContext,
  ChatCallbackEvidence,
  ChatCallbackMode,
  ChatCallbackPlan,
  ChatCallbackResolution,
  ChatCallbackTrigger,
} from '../../../../../shared/contracts/chat/ChatCallback';
import type {
  ChatQuoteEvidence,
  ChatQuoteFragment,
  ChatQuoteKind,
  ChatQuoteProof,
  ChatQuoteRecord,
  ChatQuoteSpeakerRole,
} from '../../../../../shared/contracts/chat/ChatQuote';

export type ConversationMemoryChannelId =
  | 'GLOBAL'
  | 'SYNDICATE'
  | 'DEAL_ROOM'
  | 'DIRECT'
  | 'SPECTATOR'
  | 'SYSTEM_SHADOW'
  | 'NPC_SHADOW'
  | 'RIVALRY_SHADOW'
  | 'RESCUE_SHADOW'
  | 'LIVEOPS_SHADOW'
  | string;

export type ConversationMemoryRoomType =
  | 'GLOBAL'
  | 'TEAM'
  | 'DIRECT'
  | 'DEAL'
  | 'SPECTATOR'
  | 'SYSTEM'
  | string;

export type ConversationMemorySpeakerRole =
  | 'PLAYER'
  | 'HATER'
  | 'HELPER'
  | 'SYSTEM'
  | 'SPECTATOR'
  | 'DEALER'
  | 'RIVAL'
  | 'ALLY'
  | 'NPC'
  | 'UNKNOWN'
  | ChatQuoteSpeakerRole;

export type ConversationMemoryEventType =
  | 'PLAYER_MESSAGE'
  | 'BOT_MESSAGE'
  | 'SYSTEM_MESSAGE'
  | 'RUN_START'
  | 'RUN_END'
  | 'BANKRUPTCY_WARNING'
  | 'SHIELD_BREAK'
  | 'PRESSURE_SPIKE'
  | 'SOVEREIGNTY_PUSH'
  | 'DEAL_ROOM_PRESSURE'
  | 'RESCUE_INTERVENTION'
  | 'RIVALRY_ESCALATION'
  | 'HELPER_INTERVENTION'
  | 'COUNTERPLAY'
  | 'CALLBACK_USED'
  | 'QUOTE_RECALLED'
  | 'SCENE_REVEAL'
  | string;

export type ConversationMemoryStatus = 'ACTIVE' | 'DORMANT' | 'ARCHIVED' | 'EXPIRED';
export type ConversationMemoryMutationKind =
  | 'UPSERT_EVENT'
  | 'UPSERT_QUOTE'
  | 'UPSERT_CALLBACK'
  | 'MARK_CALLBACK_USED'
  | 'MARK_QUOTE_USED'
  | 'ARCHIVE_EVENT'
  | 'ARCHIVE_QUOTE'
  | 'ARCHIVE_CALLBACK'
  | 'RESTORE_SNAPSHOT'
  | 'DELETE_EVENT'
  | 'DELETE_QUOTE'
  | 'DELETE_CALLBACK'
  ;

export interface ConversationMemoryActorRef {
  readonly actorId: string;
  readonly role: ConversationMemorySpeakerRole;
  readonly displayName?: string;
  readonly botId?: string;
  readonly playerId?: string;
  readonly factionId?: string;
  readonly relationshipId?: string;
}

export interface ConversationMemoryContext {
  readonly playerId: string;
  readonly runId?: string;
  readonly modeId?: string;
  readonly channelId: ConversationMemoryChannelId;
  readonly roomId?: string;
  readonly roomType?: ConversationMemoryRoomType;
  readonly sceneId?: string;
  readonly eventType?: ConversationMemoryEventType;
  readonly tick?: number;
  readonly pressureTier?: string;
  readonly proofChainId?: string;
  readonly matchId?: string;
  readonly serverShardId?: string;
  readonly privacyLevel?: 'PUBLIC' | 'TEAM' | 'PRIVATE' | 'SHADOW';
  readonly tags?: readonly string[];
}

export interface ConversationMemoryEventRecord {
  readonly memoryId: string;
  readonly playerId: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly status: ConversationMemoryStatus;
  readonly role: ConversationMemorySpeakerRole;
  readonly actor: ConversationMemoryActorRef;
  readonly counterpart?: ConversationMemoryActorRef;
  readonly context: ConversationMemoryContext;
  readonly body: string;
  readonly normalizedBody: string;
  readonly tokens: readonly string[];
  readonly fragments: readonly ChatQuoteFragment[];
  readonly sentiment01: number;
  readonly hostility01: number;
  readonly confidence01: number;
  readonly embarrassment01: number;
  readonly intimacy01: number;
  readonly strategicWeight01: number;
  readonly salience01: number;
  readonly unresolved: boolean;
  readonly quoteIds: readonly string[];
  readonly callbackIds: readonly string[];
  readonly lineageIds: readonly string[];
  readonly lastReferencedAt?: number;
  readonly reuseCount: number;
}

export interface ConversationMemoryCallbackRecord {
  readonly callbackId: string;
  readonly memoryId: string;
  readonly playerId: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly status: ConversationMemoryStatus;
  readonly mode: ChatCallbackMode | string;
  readonly trigger: ChatCallbackTrigger;
  readonly anchor: ChatCallbackAnchor;
  readonly context: ChatCallbackContext;
  readonly evidence: readonly ChatCallbackEvidence[];
  readonly plan?: ChatCallbackPlan;
  readonly resolution?: ChatCallbackResolution;
  readonly unresolved: boolean;
  readonly salience01: number;
  readonly strategicWeight01: number;
  readonly emotionalWeight01: number;
  readonly noveltyPenalty01: number;
  readonly usageCount: number;
  readonly lastUsedAt?: number;
  readonly tags: readonly string[];
}

export interface ConversationMemoryQuoteRecord {
  readonly quoteId: string;
  readonly memoryId: string;
  readonly messageId: string;
  readonly playerId: string;
  readonly actorId: string;
  readonly counterpartId?: string;
  readonly speakerRole: ChatQuoteSpeakerRole | ConversationMemorySpeakerRole;
  readonly kind: ChatQuoteKind;
  readonly fragment: ChatQuoteFragment;
  readonly proof: ChatQuoteProof;
  readonly evidence: readonly ChatQuoteEvidence[];
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly status: ConversationMemoryStatus;
  readonly unresolved: boolean;
  readonly tags: readonly string[];
  readonly score01: number;
  readonly salience01: number;
  readonly strategicWeight01: number;
  readonly emotionalWeight01: number;
  readonly recurrenceCount: number;
  readonly usageCount: number;
  readonly lastUsedAt?: number;
}

export interface ConversationMemoryMutation {
  readonly mutationId: string;
  readonly kind: ConversationMemoryMutationKind;
  readonly playerId: string;
  readonly entityId: string;
  readonly createdAt: number;
  readonly summary: string;
  readonly tags: readonly string[];
}

export interface ConversationMemorySnapshot {
  readonly playerId: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly events: readonly ConversationMemoryEventRecord[];
  readonly callbacks: readonly ConversationMemoryCallbackRecord[];
  readonly quotes: readonly ConversationMemoryQuoteRecord[];
  readonly mutations: readonly ConversationMemoryMutation[];
}

export interface ConversationMemoryQuery {
  readonly playerId: string;
  readonly runId?: string;
  readonly modeId?: string;
  readonly channelId?: ConversationMemoryChannelId;
  readonly roomId?: string;
  readonly role?: ConversationMemorySpeakerRole;
  readonly actorId?: string;
  readonly counterpartId?: string;
  readonly eventTypes?: readonly ConversationMemoryEventType[];
  readonly tags?: readonly string[];
  readonly status?: ConversationMemoryStatus | readonly ConversationMemoryStatus[];
  readonly unresolvedOnly?: boolean;
  readonly minSalience01?: number;
  readonly createdAfter?: number;
  readonly createdBefore?: number;
  readonly limit?: number;
}

export interface ConversationQuoteQuery {
  readonly playerId: string;
  readonly runId?: string;
  readonly modeId?: string;
  readonly channelId?: ConversationMemoryChannelId;
  readonly actorId?: string;
  readonly counterpartId?: string;
  readonly kinds?: readonly ChatQuoteKind[];
  readonly tags?: readonly string[];
  readonly unresolvedOnly?: boolean;
  readonly minScore01?: number;
  readonly minSalience01?: number;
  readonly activeOnly?: boolean;
  readonly limit?: number;
}

export interface ConversationCallbackQuery {
  readonly playerId: string;
  readonly runId?: string;
  readonly channelId?: ConversationMemoryChannelId;
  readonly modeId?: string;
  readonly counterpartId?: string;
  readonly unresolvedOnly?: boolean;
  readonly minSalience01?: number;
  readonly modes?: readonly string[];
  readonly tags?: readonly string[];
  readonly limit?: number;
}

export interface ConversationMemoryIngestMessage {
  readonly memoryId?: string;
  readonly createdAt: number;
  readonly playerId: string;
  readonly role: ConversationMemorySpeakerRole;
  readonly actor: ConversationMemoryActorRef;
  readonly counterpart?: ConversationMemoryActorRef;
  readonly context: ConversationMemoryContext;
  readonly body: string;
  readonly unresolved?: boolean;
  readonly tags?: readonly string[];
}

export interface ConversationMemoryStoreConfig {
  readonly maxEventsPerPlayer: number;
  readonly maxQuotesPerPlayer: number;
  readonly maxCallbacksPerPlayer: number;
  readonly maxMutationsPerPlayer: number;
  readonly maxFragmentsPerMessage: number;
  readonly maxQuoteSelectionsPerResolution: number;
  readonly archiveThresholdMs: number;
  readonly dormantThresholdMs: number;
  readonly quoteMinimumLength: number;
  readonly quoteMaximumLength: number;
}

export interface ConversationQuoteCandidate {
  readonly quoteId: string;
  readonly memoryId: string;
  readonly score01: number;
  readonly reasons: readonly string[];
  readonly record: ConversationMemoryQuoteRecord;
}

export interface ConversationCallbackCandidate {
  readonly callbackId: string;
  readonly memoryId: string;
  readonly score01: number;
  readonly reasons: readonly string[];
  readonly record: ConversationMemoryCallbackRecord;
}

export const DEFAULT_CONVERSATION_MEMORY_STORE_CONFIG: ConversationMemoryStoreConfig = Object.freeze({
  maxEventsPerPlayer: 4096,
  maxQuotesPerPlayer: 2048,
  maxCallbacksPerPlayer: 2048,
  maxMutationsPerPlayer: 4096,
  maxFragmentsPerMessage: 12,
  maxQuoteSelectionsPerResolution: 12,
  archiveThresholdMs: 1000 * 60 * 60 * 24 * 30,
  dormantThresholdMs: 1000 * 60 * 60 * 24 * 7,
  quoteMinimumLength: 12,
  quoteMaximumLength: 240,
});

interface PlayerConversationBucket {
  readonly events: Map<string, ConversationMemoryEventRecord>;
  readonly quotes: Map<string, ConversationMemoryQuoteRecord>;
  readonly callbacks: Map<string, ConversationMemoryCallbackRecord>;
  readonly eventsByActor: Map<string, Set<string>>;
  readonly eventsByCounterpart: Map<string, Set<string>>;
  readonly eventsByRun: Map<string, Set<string>>;
  readonly eventsByMode: Map<string, Set<string>>;
  readonly eventsByChannel: Map<string, Set<string>>;
  readonly eventsByRoom: Map<string, Set<string>>;
  readonly quotesByActor: Map<string, Set<string>>;
  readonly quotesByCounterpart: Map<string, Set<string>>;
  readonly quotesByMemory: Map<string, Set<string>>;
  readonly callbacksByMemory: Map<string, Set<string>>;
  readonly callbacksByCounterpart: Map<string, Set<string>>;
  readonly callbacksByMode: Map<string, Set<string>>;
  readonly mutations: ConversationMemoryMutation[];
  updatedAt: number;
}

function now(): number { return Date.now(); }
function clamp01(value: number): number { if (Number.isNaN(value)) return 0; if (value <= 0) return 0; if (value >= 1) return 1; return value; }
function unique<T>(values: readonly T[]): readonly T[] { return [...new Set(values)]; }
function normalizeText(input: string): string { return input.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[^a-z0-9\s'"!?.,:-]/g, ' ').replace(/\s+/g, ' ').trim(); }
function tokenize(input: string): readonly string[] { return unique(normalizeText(input).split(/\s+/).map((token) => token.trim()).filter(Boolean)); }
function normalizeId(input: string): string { return input.replace(/[^a-zA-Z0-9:_-]/g, '_'); }
function safeArray<T>(value: readonly T[] | undefined): readonly T[] { return value ? [...value] : []; }
function pickStatus(createdAt: number, config: ConversationMemoryStoreConfig, at: number = now()): ConversationMemoryStatus { const age = Math.max(0, at - createdAt); if (age >= config.archiveThresholdMs) return 'ARCHIVED'; if (age >= config.dormantThresholdMs) return 'DORMANT'; return 'ACTIVE'; }
function compareByRecency<T extends { readonly createdAt: number; readonly updatedAt?: number }>(left: T, right: T): number { return (right.updatedAt ?? right.createdAt) - (left.updatedAt ?? left.createdAt); }
function upsertSetIndex(index: Map<string, Set<string>>, key: string | undefined, value: string): void { if (!key) return; const normalizedKey = normalizeId(key); const set = index.get(normalizedKey) ?? new Set<string>(); set.add(value); index.set(normalizedKey, set); }
function removeSetIndex(index: Map<string, Set<string>>, key: string | undefined, value: string): void { if (!key) return; const normalizedKey = normalizeId(key); const set = index.get(normalizedKey); if (!set) return; set.delete(value); if (set.size === 0) index.delete(normalizedKey); }
function messageSummary(message: ConversationMemoryIngestMessage): string { const body = message.body.trim(); return body.length <= 96 ? body : `${body.slice(0, 93)}...`; }
function generateId(prefix: string, parts: readonly (string | number | undefined)[]): string { const joined = parts.filter((part) => part != null && `${part}`.length > 0).map((part) => normalizeId(String(part))).join(':'); return `${prefix}:${joined}:${Math.random().toString(36).slice(2, 10)}`; }
function scoreSentiment(normalizedBody: string): number { const positive = ['win','nice','clean','smart','strong','saved','calm','good','locked','steady']; const negative = ['lose','broke','crash','fraud','panic','stupid','weak','dead','fold','trash']; let score = 0.5; for (const token of positive) if (normalizedBody.includes(token)) score += 0.04; for (const token of negative) if (normalizedBody.includes(token)) score -= 0.05; return clamp01(score); }
function scoreHostility(normalizedBody: string): number { const markers = ['trash','fraud','weak','fold','broke','dead','clown','pathetic','quit','easy']; let score = 0; for (const marker of markers) if (normalizedBody.includes(marker)) score += 0.11; if (normalizedBody.includes('!')) score += 0.06; return clamp01(score); }
function scoreConfidence(normalizedBody: string): number { const markers = ['i got this','easy','watch me','locked','clean','certain','guaranteed','free']; let score = 0.2; for (const marker of markers) if (normalizedBody.includes(marker)) score += 0.1; return clamp01(score); }
function scoreEmbarrassment(normalizedBody: string): number { const markers = ['oops','my bad','missed','folded','choked','hesitated','wrong']; let score = 0; for (const marker of markers) if (normalizedBody.includes(marker)) score += 0.12; return clamp01(score); }
function scoreIntimacy(role: ConversationMemorySpeakerRole, channelId: string, normalizedBody: string): number { let score = channelId === 'DIRECT' ? 0.58 : channelId === 'SYNDICATE' ? 0.46 : 0.18; if (role === 'HELPER' || role === 'ALLY') score += 0.16; if (normalizedBody.includes('remember')) score += 0.1; if (normalizedBody.includes('trust')) score += 0.12; return clamp01(score); }
function scoreStrategicWeight(context: ConversationMemoryContext, normalizedBody: string): number { let score = 0.12; if (context.eventType === 'SHIELD_BREAK') score += 0.18; if (context.eventType === 'BANKRUPTCY_WARNING') score += 0.18; if (context.eventType === 'SOVEREIGNTY_PUSH') score += 0.16; if (context.channelId === 'DEAL_ROOM') score += 0.12; if (normalizedBody.includes('offer') || normalizedBody.includes('counter')) score += 0.1; if (normalizedBody.includes('proof')) score += 0.1; return clamp01(score); }
function scoreSalience(body: string, sentiment01: number, hostility01: number, confidence01: number, embarrassment01: number, intimacy01: number, strategicWeight01: number): number { const lengthBoost = Math.min(body.length / 160, 0.16); return clamp01(hostility01 * 0.22 + confidence01 * 0.11 + embarrassment01 * 0.1 + intimacy01 * 0.11 + strategicWeight01 * 0.24 + Math.abs(sentiment01 - 0.5) * 0.18 + lengthBoost); }
function extractQuotedStrings(body: string, config: ConversationMemoryStoreConfig): readonly string[] { const results: string[] = []; const quoted = body.match(/"([^"\n]{3,240})"/g) ?? []; for (const candidate of quoted) { const cleaned = candidate.replace(/^"|"$/g, '').trim(); if (cleaned.length >= config.quoteMinimumLength && cleaned.length <= config.quoteMaximumLength) results.push(cleaned); } if (results.length > 0) return unique(results); const clauses = body.split(/[.!?\n]+/).map((part) => part.trim()).filter((part) => part.length >= config.quoteMinimumLength && part.length <= config.quoteMaximumLength); return unique(clauses.slice(0, config.maxFragmentsPerMessage)); }
function inferQuoteKind(body: string, role: ConversationMemorySpeakerRole, context: ConversationMemoryContext): ChatQuoteKind { const normalized = normalizeText(body); if (context.channelId === 'DEAL_ROOM' || normalized.includes('offer') || normalized.includes('counter')) return 'BLUFF'; if (normalized.includes('remember') || normalized.includes('last time')) return 'CALLBACK'; if (role === 'HELPER' && (normalized.includes('listen') || normalized.includes('trust me'))) return 'ADVICE'; if (normalized.includes('you said')) return 'RECEIPT'; if (normalized.includes('watch me') || normalized.includes('easy')) return 'BOAST'; if (normalized.includes('quit') || normalized.includes('fold')) return 'THREAT'; return 'STATEMENT'; }
function makeQuoteProof(message: ConversationMemoryIngestMessage, memoryId: string, fragment: string, index: number): ChatQuoteProof { const proofId = `${memoryId}:proof:${index}`; const excerptStart = Math.max(0, message.body.indexOf(fragment)); return { proofId, proofChainId: message.context.proofChainId ?? `${memoryId}:chain`, messageId: memoryId, excerpt: fragment, excerptStart, excerptEnd: excerptStart + fragment.length, createdAt: message.createdAt }; }
function makeQuoteEvidence(message: ConversationMemoryIngestMessage, memoryId: string, proof: ChatQuoteProof): ChatQuoteEvidence { return { evidenceId: `${memoryId}:evidence:${proof.proofId}`, messageId: memoryId, playerId: message.playerId, actorId: message.actor.actorId, counterpartId: message.counterpart?.actorId, runId: message.context.runId, modeId: message.context.modeId, channelId: message.context.channelId, roomId: message.context.roomId, createdAt: message.createdAt, proof }; }
function makeCallbackEvidence(memory: ConversationMemoryEventRecord, quote: ConversationMemoryQuoteRecord): ChatCallbackEvidence { return { evidenceId: `${quote.quoteId}:callback-evidence`, kind: 'QUOTE', messageId: quote.messageId, quoteId: quote.quoteId, proofChainId: quote.proof.proofChainId, excerpt: quote.fragment.text, createdAt: quote.createdAt, tags: quote.tags, summary: `${memory.actor.displayName ?? memory.actor.actorId} said: ${quote.fragment.text}` }; }
function buildFragments(body: string, config: ConversationMemoryStoreConfig): readonly ChatQuoteFragment[] { return extractQuotedStrings(body, config).slice(0, config.maxFragmentsPerMessage).map((text, index) => ({ fragmentId: `fragment:${index}:${normalizeId(text.slice(0, 24))}`, text, normalizedText: normalizeText(text), index })); }

export class ConversationMemoryStore {
  private readonly config: ConversationMemoryStoreConfig;
  private readonly players = new Map<string, PlayerConversationBucket>();

  public constructor(config: Partial<ConversationMemoryStoreConfig> = {}) {
    this.config = Object.freeze({ ...DEFAULT_CONVERSATION_MEMORY_STORE_CONFIG, ...config });
  }

  private ensure(playerId: string): PlayerConversationBucket {
    const existing = this.players.get(playerId);
    if (existing) return existing;
    const bucket: PlayerConversationBucket = {
      events: new Map(),
      quotes: new Map(),
      callbacks: new Map(),
      eventsByActor: new Map(),
      eventsByCounterpart: new Map(),
      eventsByRun: new Map(),
      eventsByMode: new Map(),
      eventsByChannel: new Map(),
      eventsByRoom: new Map(),
      quotesByActor: new Map(),
      quotesByCounterpart: new Map(),
      quotesByMemory: new Map(),
      callbacksByMemory: new Map(),
      callbacksByCounterpart: new Map(),
      callbacksByMode: new Map(),
      mutations: [],
      updatedAt: now(),
    };
    this.players.set(playerId, bucket);
    return bucket;
  }

  private pushMutation(bucket: PlayerConversationBucket, mutation: Omit<ConversationMemoryMutation, 'mutationId'>): void {
    bucket.mutations.push({
      mutationId: generateId('mutation', [mutation.kind, mutation.playerId, mutation.entityId, mutation.createdAt]),
      ...mutation,
    });
    if (bucket.mutations.length > this.config.maxMutationsPerPlayer) {
      bucket.mutations.splice(0, bucket.mutations.length - this.config.maxMutationsPerPlayer);
    }
    bucket.updatedAt = mutation.createdAt;
  }

  private indexEvent(bucket: PlayerConversationBucket, record: ConversationMemoryEventRecord): void {
    upsertSetIndex(bucket.eventsByActor, record.actor.actorId, record.memoryId);
    upsertSetIndex(bucket.eventsByCounterpart, record.counterpart?.actorId, record.memoryId);
    upsertSetIndex(bucket.eventsByRun, record.context.runId, record.memoryId);
    upsertSetIndex(bucket.eventsByMode, record.context.modeId, record.memoryId);
    upsertSetIndex(bucket.eventsByChannel, record.context.channelId, record.memoryId);
    upsertSetIndex(bucket.eventsByRoom, record.context.roomId, record.memoryId);
  }

  private unindexEvent(bucket: PlayerConversationBucket, record: ConversationMemoryEventRecord): void {
    removeSetIndex(bucket.eventsByActor, record.actor.actorId, record.memoryId);
    removeSetIndex(bucket.eventsByCounterpart, record.counterpart?.actorId, record.memoryId);
    removeSetIndex(bucket.eventsByRun, record.context.runId, record.memoryId);
    removeSetIndex(bucket.eventsByMode, record.context.modeId, record.memoryId);
    removeSetIndex(bucket.eventsByChannel, record.context.channelId, record.memoryId);
    removeSetIndex(bucket.eventsByRoom, record.context.roomId, record.memoryId);
  }

  private indexQuote(bucket: PlayerConversationBucket, record: ConversationMemoryQuoteRecord): void {
    upsertSetIndex(bucket.quotesByActor, record.actorId, record.quoteId);
    upsertSetIndex(bucket.quotesByCounterpart, record.counterpartId, record.quoteId);
    upsertSetIndex(bucket.quotesByMemory, record.memoryId, record.quoteId);
  }

  private unindexQuote(bucket: PlayerConversationBucket, record: ConversationMemoryQuoteRecord): void {
    removeSetIndex(bucket.quotesByActor, record.actorId, record.quoteId);
    removeSetIndex(bucket.quotesByCounterpart, record.counterpartId, record.quoteId);
    removeSetIndex(bucket.quotesByMemory, record.memoryId, record.quoteId);
  }

  private indexCallback(bucket: PlayerConversationBucket, record: ConversationMemoryCallbackRecord): void {
    upsertSetIndex(bucket.callbacksByMemory, record.memoryId, record.callbackId);
    upsertSetIndex(bucket.callbacksByCounterpart, record.context.counterpartId, record.callbackId);
    upsertSetIndex(bucket.callbacksByMode, record.context.modeId, record.callbackId);
  }

  private unindexCallback(bucket: PlayerConversationBucket, record: ConversationMemoryCallbackRecord): void {
    removeSetIndex(bucket.callbacksByMemory, record.memoryId, record.callbackId);
    removeSetIndex(bucket.callbacksByCounterpart, record.context.counterpartId, record.callbackId);
    removeSetIndex(bucket.callbacksByMode, record.context.modeId, record.callbackId);
  }
  public ingestMessage(message: ConversationMemoryIngestMessage): ConversationMemoryEventRecord {
    const bucket = this.ensure(message.playerId);
    const createdAt = message.createdAt;
    const memoryId = message.memoryId ?? generateId('memory', [message.playerId, message.actor.actorId, message.context.runId, createdAt]);
    const normalizedBody = normalizeText(message.body);
    const previous = bucket.events.get(memoryId);
    if (previous) this.unindexEvent(bucket, previous);

    const sentiment01 = scoreSentiment(normalizedBody);
    const hostility01 = scoreHostility(normalizedBody);
    const confidence01 = scoreConfidence(normalizedBody);
    const embarrassment01 = scoreEmbarrassment(normalizedBody);
    const intimacy01 = scoreIntimacy(message.role, message.context.channelId, normalizedBody);
    const strategicWeight01 = scoreStrategicWeight(message.context, normalizedBody);
    const salience01 = scoreSalience(message.body, sentiment01, hostility01, confidence01, embarrassment01, intimacy01, strategicWeight01);

    const record: ConversationMemoryEventRecord = {
      memoryId,
      playerId: message.playerId,
      createdAt,
      updatedAt: now(),
      status: pickStatus(createdAt, this.config),
      role: message.role,
      actor: message.actor,
      counterpart: message.counterpart,
      context: { ...message.context, tags: safeArray(message.context.tags) },
      body: message.body,
      normalizedBody,
      tokens: tokenize(message.body),
      fragments: buildFragments(message.body, this.config),
      sentiment01,
      hostility01,
      confidence01,
      embarrassment01,
      intimacy01,
      strategicWeight01,
      salience01,
      unresolved: message.unresolved ?? hostility01 >= 0.55 || embarrassment01 >= 0.5,
      quoteIds: previous?.quoteIds ?? [],
      callbackIds: previous?.callbackIds ?? [],
      lineageIds: previous ? unique([...previous.lineageIds, previous.memoryId]) : [],
      lastReferencedAt: previous?.lastReferencedAt,
      reuseCount: previous?.reuseCount ?? 0,
    };

    bucket.events.set(memoryId, record);
    this.indexEvent(bucket, record);
    this.pushMutation(bucket, {
      kind: 'UPSERT_EVENT',
      playerId: message.playerId,
      entityId: memoryId,
      createdAt: record.updatedAt,
      summary: messageSummary(message),
      tags: safeArray(message.tags),
    });

    const quotes = this.extractQuotesFromEvent(record);
    this.projectCallbacksFromEvent(record, quotes);
    this.trimPlayer(message.playerId);
    return bucket.events.get(memoryId)!;
  }
  public extractQuotesFromEvent(event: ConversationMemoryEventRecord): readonly ConversationMemoryQuoteRecord[] {
    const bucket = this.ensure(event.playerId);
    const quotes: ConversationMemoryQuoteRecord[] = [];

    for (const [index, fragment] of event.fragments.entries()) {
      const quoteId = `${event.memoryId}:quote:${index}`;
      const previous = bucket.quotes.get(quoteId);
      if (previous) this.unindexQuote(bucket, previous);

      const ingestMessage: ConversationMemoryIngestMessage = {
        createdAt: event.createdAt,
        playerId: event.playerId,
        role: event.role,
        actor: event.actor,
        counterpart: event.counterpart,
        context: event.context,
        body: event.body,
      };

      const proof = makeQuoteProof(ingestMessage, event.memoryId, fragment.text, index);
      const evidence = makeQuoteEvidence(ingestMessage, event.memoryId, proof);
      const kind = inferQuoteKind(fragment.text, event.role, event.context);
      const score01 = clamp01(event.salience01 * 0.46 + event.hostility01 * 0.16 + event.confidence01 * 0.12 + event.embarrassment01 * 0.12 + event.intimacy01 * 0.14);

      const quoteRecord: ConversationMemoryQuoteRecord = {
        quoteId,
        memoryId: event.memoryId,
        messageId: event.memoryId,
        playerId: event.playerId,
        actorId: event.actor.actorId,
        counterpartId: event.counterpart?.actorId,
        speakerRole: event.role,
        kind,
        fragment,
        proof,
        evidence: [evidence],
        createdAt: event.createdAt,
        updatedAt: now(),
        status: pickStatus(event.createdAt, this.config),
        unresolved: event.unresolved,
        tags: unique([...(event.context.tags ?? []), kind.toLowerCase(), String(event.context.channelId).toLowerCase()]),
        score01,
        salience01: event.salience01,
        strategicWeight01: event.strategicWeight01,
        emotionalWeight01: clamp01(event.hostility01 * 0.42 + event.embarrassment01 * 0.24 + event.intimacy01 * 0.34),
        recurrenceCount: previous ? previous.recurrenceCount + 1 : 1,
        usageCount: previous?.usageCount ?? 0,
        lastUsedAt: previous?.lastUsedAt,
      };

      bucket.quotes.set(quoteId, quoteRecord);
      this.indexQuote(bucket, quoteRecord);
      quotes.push(quoteRecord);
      this.pushMutation(bucket, {
        kind: 'UPSERT_QUOTE',
        playerId: event.playerId,
        entityId: quoteId,
        createdAt: quoteRecord.updatedAt,
        summary: quoteRecord.fragment.text,
        tags: quoteRecord.tags,
      });
    }

    const nextEvent = bucket.events.get(event.memoryId);
    if (nextEvent) {
      const merged: ConversationMemoryEventRecord = { ...nextEvent, quoteIds: quotes.map((quote) => quote.quoteId), updatedAt: now() };
      this.unindexEvent(bucket, nextEvent);
      bucket.events.set(event.memoryId, merged);
      this.indexEvent(bucket, merged);
    }

    return quotes;
  }
  public projectCallbacksFromEvent(event: ConversationMemoryEventRecord, quotes: readonly ConversationMemoryQuoteRecord[] = this.listQuotesByMemory(event.playerId, event.memoryId)): readonly ConversationMemoryCallbackRecord[] {
    const bucket = this.ensure(event.playerId);
    const callbacks: ConversationMemoryCallbackRecord[] = [];
    const candidates = quotes.filter((quote) => quote.kind === 'BOAST' || quote.kind === 'RECEIPT' || quote.kind === 'CALLBACK' || quote.kind === 'BLUFF' || quote.kind === 'ADVICE');

    for (const quote of candidates) {
      const callbackId = `${quote.quoteId}:callback`;
      const previous = bucket.callbacks.get(callbackId);
      if (previous) this.unindexCallback(bucket, previous);

      const mode: ChatCallbackMode | string = quote.kind === 'BLUFF' ? 'NEGOTIATION' : quote.kind === 'ADVICE' ? 'HELPER_RECALL' : quote.kind === 'RECEIPT' ? 'RECEIPT' : 'RIVALRY';
      const emotionalWeight01 = clamp01(quote.emotionalWeight01 * 0.54 + event.hostility01 * 0.22 + event.embarrassment01 * 0.24);
      const noveltyPenalty01 = previous ? clamp01(previous.usageCount / 12) : 0;
      const salience01 = clamp01(quote.score01 * 0.5 + event.salience01 * 0.32 + (event.unresolved ? 0.18 : 0));

      const callbackRecord: ConversationMemoryCallbackRecord = {
        callbackId,
        memoryId: event.memoryId,
        playerId: event.playerId,
        createdAt: quote.createdAt,
        updatedAt: now(),
        status: pickStatus(quote.createdAt, this.config),
        mode,
        trigger: {
          triggerId: `${callbackId}:trigger`,
          eventType: event.context.eventType ?? 'PLAYER_MESSAGE',
          channelId: event.context.channelId,
          roomId: event.context.roomId,
          runId: event.context.runId,
          modeId: event.context.modeId,
          createdAt: event.createdAt,
          urgency01: clamp01(event.hostility01 * 0.3 + event.embarrassment01 * 0.18 + event.strategicWeight01 * 0.3 + event.salience01 * 0.22),
        },
        anchor: {
          anchorId: `${callbackId}:anchor`,
          kind: quote.kind,
          memoryId: event.memoryId,
          quoteId: quote.quoteId,
          sourceMessageId: quote.messageId,
          sourceText: quote.fragment.text,
          normalizedSourceText: quote.fragment.normalizedText,
          createdAt: quote.createdAt,
          proofChainId: quote.proof.proofChainId,
          tags: quote.tags,
        },
        context: {
          playerId: event.playerId,
          actorId: event.actor.actorId,
          counterpartId: event.counterpart?.actorId,
          channelId: event.context.channelId,
          roomId: event.context.roomId,
          runId: event.context.runId,
          modeId: event.context.modeId,
          privacyLevel: event.context.privacyLevel,
          pressureTier: event.context.pressureTier,
          tags: unique([...(event.context.tags ?? []), ...quote.tags]),
        },
        evidence: [makeCallbackEvidence(event, quote)],
        plan: undefined,
        resolution: undefined,
        unresolved: event.unresolved,
        salience01,
        strategicWeight01: quote.strategicWeight01,
        emotionalWeight01,
        noveltyPenalty01,
        usageCount: previous?.usageCount ?? 0,
        lastUsedAt: previous?.lastUsedAt,
        tags: unique([String(mode).toLowerCase(), quote.kind.toLowerCase(), String(event.context.channelId).toLowerCase()]),
      };

      bucket.callbacks.set(callbackId, callbackRecord);
      this.indexCallback(bucket, callbackRecord);
      callbacks.push(callbackRecord);
      this.pushMutation(bucket, {
        kind: 'UPSERT_CALLBACK',
        playerId: event.playerId,
        entityId: callbackId,
        createdAt: callbackRecord.updatedAt,
        summary: quote.fragment.text,
        tags: callbackRecord.tags,
      });
    }

    const nextEvent = bucket.events.get(event.memoryId);
    if (nextEvent) {
      const merged: ConversationMemoryEventRecord = { ...nextEvent, callbackIds: callbacks.map((callback) => callback.callbackId), updatedAt: now() };
      this.unindexEvent(bucket, nextEvent);
      bucket.events.set(event.memoryId, merged);
      this.indexEvent(bucket, merged);
    }

    return callbacks;
  }
  public queryEvents(query: ConversationMemoryQuery): readonly ConversationMemoryEventRecord[] {
    const bucket = this.ensure(query.playerId);
    const statuses = Array.isArray(query.status) ? new Set(query.status) : query.status ? new Set([query.status]) : undefined;
    return [...bucket.events.values()]
      .filter((record) => (query.runId ? record.context.runId === query.runId : true))
      .filter((record) => (query.modeId ? record.context.modeId === query.modeId : true))
      .filter((record) => (query.channelId ? record.context.channelId === query.channelId : true))
      .filter((record) => (query.roomId ? record.context.roomId === query.roomId : true))
      .filter((record) => (query.role ? record.role === query.role : true))
      .filter((record) => (query.actorId ? record.actor.actorId === query.actorId : true))
      .filter((record) => (query.counterpartId ? record.counterpart?.actorId === query.counterpartId : true))
      .filter((record) => (query.eventTypes?.length ? query.eventTypes.includes(record.context.eventType ?? 'PLAYER_MESSAGE') : true))
      .filter((record) => (query.tags?.length ? query.tags.every((tag) => (record.context.tags ?? []).includes(tag)) : true))
      .filter((record) => (statuses ? statuses.has(record.status) : true))
      .filter((record) => (query.unresolvedOnly ? record.unresolved : true))
      .filter((record) => (query.minSalience01 != null ? record.salience01 >= query.minSalience01 : true))
      .filter((record) => (query.createdAfter != null ? record.createdAt >= query.createdAfter : true))
      .filter((record) => (query.createdBefore != null ? record.createdAt <= query.createdBefore : true))
      .sort(compareByRecency)
      .slice(0, query.limit ?? 64);
  }

  public queryQuotes(query: ConversationQuoteQuery): readonly ConversationMemoryQuoteRecord[] {
    const bucket = this.ensure(query.playerId);
    return [...bucket.quotes.values()]
      .filter((record) => (query.runId ? record.evidence.some((item) => item.runId === query.runId) : true))
      .filter((record) => (query.modeId ? record.evidence.some((item) => item.modeId === query.modeId) : true))
      .filter((record) => (query.channelId ? record.evidence.some((item) => item.channelId === query.channelId) : true))
      .filter((record) => (query.actorId ? record.actorId === query.actorId : true))
      .filter((record) => (query.counterpartId ? record.counterpartId === query.counterpartId : true))
      .filter((record) => (query.kinds?.length ? query.kinds.includes(record.kind) : true))
      .filter((record) => (query.tags?.length ? query.tags.every((tag) => record.tags.includes(tag)) : true))
      .filter((record) => (query.unresolvedOnly ? record.unresolved : true))
      .filter((record) => (query.minScore01 != null ? record.score01 >= query.minScore01 : true))
      .filter((record) => (query.minSalience01 != null ? record.salience01 >= query.minSalience01 : true))
      .filter((record) => (query.activeOnly ? record.status === 'ACTIVE' || record.status === 'DORMANT' : true))
      .sort((left, right) => right.score01 - left.score01 || compareByRecency(left, right))
      .slice(0, query.limit ?? 64);
  }

  public queryCallbacks(query: ConversationCallbackQuery): readonly ConversationMemoryCallbackRecord[] {
    const bucket = this.ensure(query.playerId);
    return [...bucket.callbacks.values()]
      .filter((record) => (query.runId ? record.context.runId === query.runId : true))
      .filter((record) => (query.channelId ? record.context.channelId === query.channelId : true))
      .filter((record) => (query.modeId ? record.context.modeId === query.modeId : true))
      .filter((record) => (query.counterpartId ? record.context.counterpartId === query.counterpartId : true))
      .filter((record) => (query.unresolvedOnly ? record.unresolved : true))
      .filter((record) => (query.minSalience01 != null ? record.salience01 >= query.minSalience01 : true))
      .filter((record) => (query.modes?.length ? query.modes.includes(record.mode) : true))
      .filter((record) => (query.tags?.length ? query.tags.every((tag) => record.tags.includes(tag)) : true))
      .sort((left, right) => right.salience01 - left.salience01 || compareByRecency(left, right))
      .slice(0, query.limit ?? 64);
  }
  public listQuotesByMemory(playerId: string, memoryId: string): readonly ConversationMemoryQuoteRecord[] {
    const bucket = this.ensure(playerId);
    const ids = bucket.quotesByMemory.get(normalizeId(memoryId));
    if (!ids) return [];
    return [...ids].map((quoteId) => bucket.quotes.get(quoteId)).filter((value): value is ConversationMemoryQuoteRecord => Boolean(value)).sort(compareByRecency);
  }

  public getEvent(playerId: string, memoryId: string): ConversationMemoryEventRecord | undefined { return this.ensure(playerId).events.get(memoryId); }
  public getQuote(playerId: string, quoteId: string): ConversationMemoryQuoteRecord | undefined { return this.ensure(playerId).quotes.get(quoteId); }
  public getCallback(playerId: string, callbackId: string): ConversationMemoryCallbackRecord | undefined { return this.ensure(playerId).callbacks.get(callbackId); }

  public markQuoteUsed(playerId: string, quoteId: string, usedAt: number = now()): ConversationMemoryQuoteRecord | undefined {
    const bucket = this.ensure(playerId);
    const current = bucket.quotes.get(quoteId);
    if (!current) return undefined;
    this.unindexQuote(bucket, current);
    const next: ConversationMemoryQuoteRecord = { ...current, usageCount: current.usageCount + 1, lastUsedAt: usedAt, updatedAt: usedAt };
    bucket.quotes.set(quoteId, next);
    this.indexQuote(bucket, next);
    this.pushMutation(bucket, { kind: 'MARK_QUOTE_USED', playerId, entityId: quoteId, createdAt: usedAt, summary: current.fragment.text, tags: current.tags });
    return next;
  }

  public markCallbackUsed(playerId: string, callbackId: string, usedAt: number = now(), resolution?: ChatCallbackResolution): ConversationMemoryCallbackRecord | undefined {
    const bucket = this.ensure(playerId);
    const current = bucket.callbacks.get(callbackId);
    if (!current) return undefined;
    this.unindexCallback(bucket, current);
    const next: ConversationMemoryCallbackRecord = { ...current, usageCount: current.usageCount + 1, lastUsedAt: usedAt, resolution: resolution ?? current.resolution, updatedAt: usedAt, unresolved: resolution?.outcome === 'RESOLVED' ? false : current.unresolved };
    bucket.callbacks.set(callbackId, next);
    this.indexCallback(bucket, next);
    this.pushMutation(bucket, { kind: 'MARK_CALLBACK_USED', playerId, entityId: callbackId, createdAt: usedAt, summary: current.anchor.sourceText, tags: current.tags });
    return next;
  }
  public archiveEvent(playerId: string, memoryId: string, archivedAt: number = now()): ConversationMemoryEventRecord | undefined {
    const bucket = this.ensure(playerId);
    const current = bucket.events.get(memoryId); if (!current) return undefined;
    this.unindexEvent(bucket, current);
    const next: ConversationMemoryEventRecord = { ...current, status: 'ARCHIVED', updatedAt: archivedAt };
    bucket.events.set(memoryId, next); this.indexEvent(bucket, next);
    this.pushMutation(bucket, { kind: 'ARCHIVE_EVENT', playerId, entityId: memoryId, createdAt: archivedAt, summary: current.body.slice(0, 96), tags: current.context.tags ?? [] });
    return next;
  }

  public archiveQuote(playerId: string, quoteId: string, archivedAt: number = now()): ConversationMemoryQuoteRecord | undefined {
    const bucket = this.ensure(playerId);
    const current = bucket.quotes.get(quoteId); if (!current) return undefined;
    this.unindexQuote(bucket, current);
    const next: ConversationMemoryQuoteRecord = { ...current, status: 'ARCHIVED', updatedAt: archivedAt };
    bucket.quotes.set(quoteId, next); this.indexQuote(bucket, next);
    this.pushMutation(bucket, { kind: 'ARCHIVE_QUOTE', playerId, entityId: quoteId, createdAt: archivedAt, summary: current.fragment.text, tags: current.tags });
    return next;
  }

  public archiveCallback(playerId: string, callbackId: string, archivedAt: number = now()): ConversationMemoryCallbackRecord | undefined {
    const bucket = this.ensure(playerId);
    const current = bucket.callbacks.get(callbackId); if (!current) return undefined;
    this.unindexCallback(bucket, current);
    const next: ConversationMemoryCallbackRecord = { ...current, status: 'ARCHIVED', updatedAt: archivedAt };
    bucket.callbacks.set(callbackId, next); this.indexCallback(bucket, next);
    this.pushMutation(bucket, { kind: 'ARCHIVE_CALLBACK', playerId, entityId: callbackId, createdAt: archivedAt, summary: current.anchor.sourceText, tags: current.tags });
    return next;
  }

  public deleteEvent(playerId: string, memoryId: string): void {
    const bucket = this.ensure(playerId); const current = bucket.events.get(memoryId); if (!current) return;
    this.unindexEvent(bucket, current); bucket.events.delete(memoryId);
    for (const quote of this.listQuotesByMemory(playerId, memoryId)) this.deleteQuote(playerId, quote.quoteId);
    for (const callbackId of current.callbackIds) this.deleteCallback(playerId, callbackId);
    this.pushMutation(bucket, { kind: 'DELETE_EVENT', playerId, entityId: memoryId, createdAt: now(), summary: current.body.slice(0, 96), tags: current.context.tags ?? [] });
  }

  public deleteQuote(playerId: string, quoteId: string): void {
    const bucket = this.ensure(playerId); const current = bucket.quotes.get(quoteId); if (!current) return;
    this.unindexQuote(bucket, current); bucket.quotes.delete(quoteId);
    this.pushMutation(bucket, { kind: 'DELETE_QUOTE', playerId, entityId: quoteId, createdAt: now(), summary: current.fragment.text, tags: current.tags });
  }

  public deleteCallback(playerId: string, callbackId: string): void {
    const bucket = this.ensure(playerId); const current = bucket.callbacks.get(callbackId); if (!current) return;
    this.unindexCallback(bucket, current); bucket.callbacks.delete(callbackId);
    this.pushMutation(bucket, { kind: 'DELETE_CALLBACK', playerId, entityId: callbackId, createdAt: now(), summary: current.anchor.sourceText, tags: current.tags });
  }
  public selectQuoteCandidates(request: ChatQuoteRequest & { readonly playerId: string; readonly actorId?: string; readonly counterpartId?: string; readonly runId?: string; readonly modeId?: string; readonly channelId?: ConversationMemoryChannelId; readonly limit?: number; }): readonly ConversationQuoteCandidate[] {
    return this.queryQuotes({
      playerId: request.playerId,
      actorId: request.actorId,
      counterpartId: request.counterpartId,
      runId: request.runId,
      modeId: request.modeId,
      channelId: request.channelId,
      minSalience01: 0.18,
      activeOnly: true,
      limit: 96,
    })
      .map((record) => {
        const reasons: string[] = [];
        let score01 = record.score01 * 0.42 + record.salience01 * 0.24 + record.strategicWeight01 * 0.18 + record.emotionalWeight01 * 0.16;
        if (request.counterpartId && record.counterpartId === request.counterpartId) { score01 += 0.12; reasons.push('counterpart_match'); }
        if (request.actorId && record.actorId === request.actorId) { score01 += 0.09; reasons.push('actor_match'); }
        if (request.channelId && record.evidence.some((item) => item.channelId === request.channelId)) { score01 += 0.06; reasons.push('channel_match'); }
        if (record.unresolved) { score01 += 0.08; reasons.push('unresolved'); }
        if (record.kind === 'RECEIPT' || record.kind === 'CALLBACK') { score01 += 0.06; reasons.push('callback_kind'); }
        return { quoteId: record.quoteId, memoryId: record.memoryId, score01: clamp01(score01), reasons, record };
      })
      .sort((left, right) => right.score01 - left.score01)
      .slice(0, request.limit ?? this.config.maxQuoteSelectionsPerResolution);
  }

  public selectCallbackCandidates(request: { readonly playerId: string; readonly counterpartId?: string; readonly runId?: string; readonly modeId?: string; readonly channelId?: string; readonly modes?: readonly string[]; readonly limit?: number; }): readonly ConversationCallbackCandidate[] {
    return this.queryCallbacks({
      playerId: request.playerId,
      counterpartId: request.counterpartId,
      runId: request.runId,
      modeId: request.modeId,
      channelId: request.channelId,
      modes: request.modes,
      unresolvedOnly: false,
      minSalience01: 0.18,
      limit: 96,
    })
      .map((record) => {
        const reasons: string[] = [];
        let score01 = record.salience01 * 0.42 + record.strategicWeight01 * 0.18 + record.emotionalWeight01 * 0.18 + (1 - record.noveltyPenalty01) * 0.12;
        if (request.counterpartId && record.context.counterpartId === request.counterpartId) { score01 += 0.12; reasons.push('counterpart_match'); }
        if (request.channelId && record.context.channelId === request.channelId) { score01 += 0.06; reasons.push('channel_match'); }
        if (record.unresolved) { score01 += 0.09; reasons.push('unresolved'); }
        if (record.mode === 'RECEIPT' || record.mode === 'RIVALRY') { score01 += 0.05; reasons.push('pressure_mode'); }
        return { callbackId: record.callbackId, memoryId: record.memoryId, score01: clamp01(score01), reasons, record };
      })
      .sort((left, right) => right.score01 - left.score01)
      .slice(0, request.limit ?? this.config.maxQuoteSelectionsPerResolution);
  }
  public getSnapshot(playerId: string): ConversationMemorySnapshot {
    const bucket = this.ensure(playerId);
    return {
      playerId,
      createdAt: bucket.events.size === 0 ? now() : [...bucket.events.values()].sort(compareByRecency).at(-1)?.createdAt ?? now(),
      updatedAt: bucket.updatedAt,
      events: [...bucket.events.values()].sort(compareByRecency),
      callbacks: [...bucket.callbacks.values()].sort(compareByRecency),
      quotes: [...bucket.quotes.values()].sort(compareByRecency),
      mutations: [...bucket.mutations],
    };
  }

  public restore(snapshot: ConversationMemorySnapshot): void {
    const bucket = this.ensure(snapshot.playerId);
    bucket.events.clear(); bucket.quotes.clear(); bucket.callbacks.clear();
    bucket.eventsByActor.clear(); bucket.eventsByCounterpart.clear(); bucket.eventsByRun.clear(); bucket.eventsByMode.clear(); bucket.eventsByChannel.clear(); bucket.eventsByRoom.clear();
    bucket.quotesByActor.clear(); bucket.quotesByCounterpart.clear(); bucket.quotesByMemory.clear();
    bucket.callbacksByMemory.clear(); bucket.callbacksByCounterpart.clear(); bucket.callbacksByMode.clear();
    bucket.mutations.splice(0, bucket.mutations.length, ...snapshot.mutations);
    for (const event of snapshot.events) { bucket.events.set(event.memoryId, event); this.indexEvent(bucket, event); }
    for (const quote of snapshot.quotes) { bucket.quotes.set(quote.quoteId, quote); this.indexQuote(bucket, quote); }
    for (const callback of snapshot.callbacks) { bucket.callbacks.set(callback.callbackId, callback); this.indexCallback(bucket, callback); }
    bucket.updatedAt = snapshot.updatedAt;
    this.pushMutation(bucket, { kind: 'RESTORE_SNAPSHOT', playerId: snapshot.playerId, entityId: snapshot.playerId, createdAt: now(), summary: 'snapshot_restored', tags: ['restore'] });
    this.trimPlayer(snapshot.playerId);
  }

  public sweepAging(at: number = now()): void {
    for (const [playerId, bucket] of this.players) {
      for (const [memoryId, event] of bucket.events) {
        const status = pickStatus(event.createdAt, this.config, at);
        if (status !== event.status) bucket.events.set(memoryId, { ...event, status, updatedAt: at });
      }
      for (const [quoteId, quote] of bucket.quotes) {
        const status = pickStatus(quote.createdAt, this.config, at);
        if (status !== quote.status) bucket.quotes.set(quoteId, { ...quote, status, updatedAt: at });
      }
      for (const [callbackId, callback] of bucket.callbacks) {
        const status = pickStatus(callback.createdAt, this.config, at);
        if (status !== callback.status) bucket.callbacks.set(callbackId, { ...callback, status, updatedAt: at });
      }
      this.trimPlayer(playerId);
    }
  }

  public trimPlayer(playerId: string): void {
    const bucket = this.ensure(playerId);
    const trimMap = <T extends { readonly createdAt: number }>(map: Map<string, T>, max: number, onDrop: (record: T) => void): void => {
      const sorted = [...map.values()].sort(compareByRecency);
      if (sorted.length <= max) return;
      for (const record of sorted.slice(max)) onDrop(record);
    };

    trimMap(bucket.events, this.config.maxEventsPerPlayer, (record) => this.deleteEvent(playerId, (record as ConversationMemoryEventRecord).memoryId));
    trimMap(bucket.quotes, this.config.maxQuotesPerPlayer, (record) => this.deleteQuote(playerId, (record as ConversationMemoryQuoteRecord).quoteId));
    trimMap(bucket.callbacks, this.config.maxCallbacksPerPlayer, (record) => this.deleteCallback(playerId, (record as ConversationMemoryCallbackRecord).callbackId));
  }
}

export const CONVERSATION_MEMORY_EVENT_WEIGHT_TABLE: Readonly<Record<string, number>> = Object.freeze({
  PLAYER_MESSAGE: 0.52,
  BOT_MESSAGE: 0.44,
  SYSTEM_MESSAGE: 0.26,
  RUN_START: 0.18,
  RUN_END: 0.34,
  BANKRUPTCY_WARNING: 0.92,
  SHIELD_BREAK: 0.96,
  PRESSURE_SPIKE: 0.86,
  SOVEREIGNTY_PUSH: 0.88,
  DEAL_ROOM_PRESSURE: 0.83,
  RESCUE_INTERVENTION: 0.79,
  RIVALRY_ESCALATION: 0.9,
  HELPER_INTERVENTION: 0.74,
  COUNTERPLAY: 0.82,
  CALLBACK_USED: 0.61,
  QUOTE_RECALLED: 0.59,
  SCENE_REVEAL: 0.67,
});

export const CONVERSATION_MEMORY_KIND_WEIGHT_TABLE: Readonly<Record<string, number>> = Object.freeze({
  STATEMENT: 0.32,
  BOAST: 0.78,
  RECEIPT: 0.86,
  CALLBACK: 0.88,
  BLUFF: 0.81,
  ADVICE: 0.62,
  THREAT: 0.84,
});

export function buildConversationMemoryAuditSlice1(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=1`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice2(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=2`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice3(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=3`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice4(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=4`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice5(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=5`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice6(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=6`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice7(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=7`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice8(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=8`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice9(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=9`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice10(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=10`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice11(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=11`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice12(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=12`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice13(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=13`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice14(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=14`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice15(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=15`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice16(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=16`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice17(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=17`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice18(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=18`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice19(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=19`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice20(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=20`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice21(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=21`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice22(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=22`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice23(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=23`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice24(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=24`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice25(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=25`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice26(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=26`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice27(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=27`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice28(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=28`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice29(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=29`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}

export function buildConversationMemoryAuditSlice30(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = [];
  lines.push(`player=${snapshot.playerId}`);
  lines.push(`events=${snapshot.events.length}`);
  lines.push(`quotes=${snapshot.quotes.length}`);
  lines.push(`callbacks=${snapshot.callbacks.length}`);
  lines.push(`mutations=${snapshot.mutations.length}`);
  lines.push(`slice=30`);
  for (const event of snapshot.events.slice(0, 5)) {
    lines.push(`${event.memoryId}|${event.role}|${event.context.channelId}|${event.salience01.toFixed(3)}|${event.body.slice(0, 48)}`);
  }
  return lines;
}
