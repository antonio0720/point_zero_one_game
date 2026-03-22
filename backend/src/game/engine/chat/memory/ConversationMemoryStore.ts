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
  ChatCallbackKind,
  ChatCallbackPlan,
  ChatCallbackPrivacyClass,
} from '../../../../../../shared/contracts/chat/ChatCallback';
import type {
  ChatQuoteAudienceClass,
  ChatQuoteRecord,
  ChatQuoteToneClass,
  ChatQuoteUseIntent,
} from '../../../../../../shared/contracts/chat/ChatQuote';

// Local structural types that mirror removed contract types
type ChatCallbackAnchor = { readonly anchorId?: string; readonly kind?: string; readonly memoryId?: string; readonly quoteId?: string; readonly sourceMessageId?: string; readonly sourceText: string; readonly normalizedSourceText?: string; readonly createdAt: number; readonly proofChainId?: string; readonly tags: readonly string[] };
type ChatCallbackEvidence = { readonly evidenceId: string; readonly kind: string; readonly messageId: string; readonly quoteId?: string; readonly proofChainId?: string; readonly excerpt: string; readonly createdAt: number; readonly tags: readonly string[]; readonly summary: string };
type ChatCallbackMode = string;
type ChatCallbackResolution = { readonly outcome?: string; readonly [key: string]: unknown };
type ChatCallbackTrigger = { readonly triggerId: string; readonly eventType: string; readonly channelId?: string; readonly roomId?: string; readonly runId?: string; readonly modeId?: string; readonly createdAt: number; readonly urgency01: number };
type ChatQuoteEvidence = { readonly evidenceId: string; readonly messageId: string; readonly playerId: string; readonly actorId: string; readonly counterpartId?: string; readonly runId?: string; readonly modeId?: string; readonly channelId?: string; readonly roomId?: string; readonly createdAt: number; readonly proof: ChatQuoteProof };
type ChatQuoteFragment = { readonly fragmentId: string; readonly text: string; readonly normalizedText: string; readonly index: number };
type ChatQuoteKind = 'BLUFF' | 'CALLBACK' | 'ADVICE' | 'RECEIPT' | 'BOAST' | 'THREAT' | 'STATEMENT' | string;
type ChatQuoteProof = { readonly proofId: string; readonly proofChainId: string; readonly messageId: string; readonly excerpt: string; readonly excerptStart: number; readonly excerptEnd: number; readonly createdAt: number };
type ChatQuoteSpeakerRole = string;

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
  readonly actorId?: string;
  readonly counterpartId?: string;
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
  readonly toneClass: ChatQuoteToneClass;
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
  readonly context: ConversationMemoryContext;
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
  readonly callbackKind: ChatCallbackKind;
  readonly privacyClass: ChatCallbackPrivacyClass;
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
  readonly toneClass: ChatQuoteToneClass;
  readonly audienceClass: ChatQuoteAudienceClass;
  readonly useIntent: ChatQuoteUseIntent;
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
  readonly toneClasses?: readonly ChatQuoteToneClass[];
  readonly audienceClasses?: readonly ChatQuoteAudienceClass[];
  readonly useIntents?: readonly ChatQuoteUseIntent[];
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
  readonly contract: ConversationMemoryExternalQuoteRecord;
}

export interface ConversationCallbackCandidate {
  readonly callbackId: string;
  readonly memoryId: string;
  readonly score01: number;
  readonly reasons: readonly string[];
  readonly record: ConversationMemoryCallbackRecord;
}
export type ConversationMemoryExternalQuoteRecord = Partial<ChatQuoteRecord>;

export interface ConversationMemoryQuoteContractProjection {
  readonly quoteId: string;
  readonly memoryId: string;
  readonly internal: ConversationMemoryQuoteRecord;
  readonly contract: ConversationMemoryExternalQuoteRecord;
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


// ============================================================================
// MARK: Replay-safe clock abstraction
// ============================================================================

/**
 * Monotonic clock interface for all timestamp generation in the memory store.
 * Production uses wall-clock time. Replay uses a deterministic event-log clock
 * that replays the exact same timestamps from the original session.
 */
export interface MemoryClock {
  /** Returns the current timestamp in milliseconds since epoch. */
  now(): number;
  /** Returns a monotonically increasing tick counter for ordering within the same millisecond. */
  tick(): number;
  /** Resets the clock to a specific state (used during snapshot restore and replay initialization). */
  reset(epochMs: number, tickCounter: number): void;
  /** Returns true if this clock is running in replay mode (deterministic, non-wall-clock). */
  readonly isReplay: boolean;
}

/**
 * Production wall-clock implementation. Uses Date.now() for timestamps and a
 * simple counter for sub-millisecond ordering.
 */
export class WallClock implements MemoryClock {
  private _tick = 0;
  public readonly isReplay = false;
  public now(): number { return Date.now(); }
  public tick(): number { return ++this._tick; }
  public reset(_epochMs: number, tickCounter: number): void { this._tick = tickCounter; }
}

/**
 * Deterministic replay clock. Reads timestamps from a pre-recorded event log
 * so that every memory decision is exactly reproducible for proof-chain
 * verification and post-run replay surfaces.
 */
export class ReplayClock implements MemoryClock {
  private _epochMs: number;
  private _tick: number;
  private readonly _timeline: readonly number[];
  private _cursor = 0;
  public readonly isReplay = true;

  public constructor(timeline: readonly number[], startEpochMs = 0, startTick = 0) {
    this._timeline = timeline;
    this._epochMs = startEpochMs;
    this._tick = startTick;
  }

  public now(): number {
    if (this._cursor < this._timeline.length) {
      this._epochMs = this._timeline[this._cursor++]!;
    }
    return this._epochMs;
  }

  public tick(): number { return ++this._tick; }
  public reset(epochMs: number, tickCounter: number): void { this._epochMs = epochMs; this._tick = tickCounter; this._cursor = 0; }
}

// ============================================================================
// MARK: Replay-safe seeded PRNG (xoshiro128** variant)
// ============================================================================

/**
 * Deterministic pseudo-random number generator for ID generation.
 * Replaces Math.random() so that every memory ID is reproducible from the
 * same seed during replay. Uses xoshiro128** for speed and statistical quality.
 */
export class SeededPRNG {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  public constructor(seed: number = Date.now()) {
    /* splitmix32 to expand single seed into 4-word state */
    let z = (seed | 0) + 0x9E3779B9 | 0;
    z = Math.imul(z ^ (z >>> 16), 0x85EBCA6B);
    z = Math.imul(z ^ (z >>> 13), 0xC2B2AE35);
    this.s0 = (z ^ (z >>> 16)) >>> 0;
    z = (this.s0 + 0x9E3779B9) | 0;
    z = Math.imul(z ^ (z >>> 16), 0x85EBCA6B);
    z = Math.imul(z ^ (z >>> 13), 0xC2B2AE35);
    this.s1 = (z ^ (z >>> 16)) >>> 0;
    z = (this.s1 + 0x9E3779B9) | 0;
    z = Math.imul(z ^ (z >>> 16), 0x85EBCA6B);
    z = Math.imul(z ^ (z >>> 13), 0xC2B2AE35);
    this.s2 = (z ^ (z >>> 16)) >>> 0;
    z = (this.s2 + 0x9E3779B9) | 0;
    z = Math.imul(z ^ (z >>> 16), 0x85EBCA6B);
    z = Math.imul(z ^ (z >>> 13), 0xC2B2AE35);
    this.s3 = (z ^ (z >>> 16)) >>> 0;
  }

  /** Returns a float in [0, 1) — drop-in replacement for Math.random(). */
  public next(): number {
    const result = Math.imul(this.rotl(Math.imul(this.s1, 5), 7), 9);
    const t = this.s1 << 9;
    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;
    this.s2 ^= t;
    this.s3 = this.rotl(this.s3, 11);
    return (result >>> 0) / 0x100000000;
  }

  /** Returns a base-36 string of the given length, suitable for ID suffixes. */
  public nextId(length = 8): string {
    let out = '';
    for (let i = 0; i < length; i++) {
      out += Math.floor(this.next() * 36).toString(36);
    }
    return out;
  }

  /** Snapshot the PRNG state for deterministic restore. */
  public snapshot(): readonly [number, number, number, number] {
    return [this.s0, this.s1, this.s2, this.s3] as const;
  }

  /** Restore PRNG state from a snapshot. */
  public restore(state: readonly [number, number, number, number]): void {
    [this.s0, this.s1, this.s2, this.s3] = state;
  }

  private rotl(x: number, k: number): number { return (x << k) | (x >>> (32 - k)); }
}

// ============================================================================
// MARK: Persistence adapter interface
// ============================================================================

/**
 * Abstract persistence adapter. The memory store calls these methods after
 * every in-memory mutation so downstream storage (PostgreSQL, Redis, event log)
 * stays synchronized without the store knowing which adapter is active.
 */
export interface ConversationMemoryPersistenceAdapter {
  readonly adapterName: string;
  persistEvent(playerId: string, record: ConversationMemoryEventRecord): Promise<void>;
  persistQuote(playerId: string, record: ConversationMemoryQuoteRecord): Promise<void>;
  persistCallback(playerId: string, record: ConversationMemoryCallbackRecord): Promise<void>;
  persistMutation(playerId: string, mutation: ConversationMemoryMutation): Promise<void>;
  persistSnapshot(snapshot: ConversationMemorySnapshot): Promise<void>;
  loadSnapshot(playerId: string): Promise<ConversationMemorySnapshot | null>;
  deletePlayerData(playerId: string): Promise<void>;
  deleteEvent(playerId: string, memoryId: string): Promise<void>;
  deleteQuote(playerId: string, quoteId: string): Promise<void>;
  deleteCallback(playerId: string, callbackId: string): Promise<void>;
  flush(): Promise<void>;
}

/**
 * Default no-op adapter. All writes succeed instantly, no external storage.
 * Used when the store runs in pure in-memory mode (dev, test, replay).
 */
export class InMemoryPersistenceAdapter implements ConversationMemoryPersistenceAdapter {
  public readonly adapterName = 'InMemory';
  public async persistEvent(): Promise<void> { /* no-op */ }
  public async persistQuote(): Promise<void> { /* no-op */ }
  public async persistCallback(): Promise<void> { /* no-op */ }
  public async persistMutation(): Promise<void> { /* no-op */ }
  public async persistSnapshot(): Promise<void> { /* no-op */ }
  public async loadSnapshot(): Promise<ConversationMemorySnapshot | null> { return null; }
  public async deletePlayerData(): Promise<void> { /* no-op */ }
  public async deleteEvent(): Promise<void> { /* no-op */ }
  public async deleteQuote(): Promise<void> { /* no-op */ }
  public async deleteCallback(): Promise<void> { /* no-op */ }
  public async flush(): Promise<void> { /* no-op */ }
}

/**
 * Write-ahead-log adapter stub for the sovereign PostgreSQL stack.
 * Queues mutations and flushes in batches. Implementations wire to
 * TypeORM or raw pg for the 97-table PZO schema.
 */
export class PostgresPersistenceAdapterStub implements ConversationMemoryPersistenceAdapter {
  public readonly adapterName = 'PostgresStub';
  private readonly _queue: Array<{ kind: string; playerId: string; payload: unknown }> = [];
  private readonly _maxBatch: number;

  public constructor(maxBatch = 64) { this._maxBatch = maxBatch; }

  public async persistEvent(playerId: string, record: ConversationMemoryEventRecord): Promise<void> {
    this._queue.push({ kind: 'event', playerId, payload: record });
    if (this._queue.length >= this._maxBatch) await this.flush();
  }
  public async persistQuote(playerId: string, record: ConversationMemoryQuoteRecord): Promise<void> {
    this._queue.push({ kind: 'quote', playerId, payload: record });
    if (this._queue.length >= this._maxBatch) await this.flush();
  }
  public async persistCallback(playerId: string, record: ConversationMemoryCallbackRecord): Promise<void> {
    this._queue.push({ kind: 'callback', playerId, payload: record });
    if (this._queue.length >= this._maxBatch) await this.flush();
  }
  public async persistMutation(playerId: string, mutation: ConversationMemoryMutation): Promise<void> {
    this._queue.push({ kind: 'mutation', playerId, payload: mutation });
    if (this._queue.length >= this._maxBatch) await this.flush();
  }
  public async persistSnapshot(snapshot: ConversationMemorySnapshot): Promise<void> {
    this._queue.push({ kind: 'snapshot', playerId: snapshot.playerId, payload: snapshot });
    if (this._queue.length >= this._maxBatch) await this.flush();
  }
  public async loadSnapshot(_playerId: string): Promise<ConversationMemorySnapshot | null> { return null; }
  public async deletePlayerData(_playerId: string): Promise<void> { /* stub */ }
  public async deleteEvent(_playerId: string, _memoryId: string): Promise<void> { /* stub */ }
  public async deleteQuote(_playerId: string, _quoteId: string): Promise<void> { /* stub */ }
  public async deleteCallback(_playerId: string, _callbackId: string): Promise<void> { /* stub */ }
  public async flush(): Promise<void> { this._queue.length = 0; }
  public get pendingCount(): number { return this._queue.length; }
}

// ============================================================================
// MARK: Mode-aware memory profile
// ============================================================================

/**
 * Per-game-mode memory configuration. Each mode tunes how aggressively memory
 * extracts, retains, and weights conversational data.
 *
 * Empire: long runs, warm helpers, high rescue weight — preserve emotional arcs.
 * Predator: short runs, cold room, high deal-room weight — preserve negotiation intel.
 * Syndicate: team runs, trust-critical, high team weight — preserve collective memory.
 * Phantom: mystery runs, trace-heavy, low public weight — preserve ghost signals.
 */
export interface ModeMemoryProfile {
  readonly modeId: string;
  readonly label: string;
  readonly quoteMinimumLength: number;
  readonly quoteMaximumLength: number;
  readonly maxFragmentsPerMessage: number;
  readonly callbackProjectionThreshold01: number;
  readonly hotWindowMs: number;
  readonly warmWindowMs: number;
  readonly archiveThresholdMs: number;
  readonly dormantThresholdMs: number;
  readonly salienceFloor01: number;
  readonly rescueWeightMultiplier: number;
  readonly rivalryWeightMultiplier: number;
  readonly dealRoomWeightMultiplier: number;
  readonly teamWeightMultiplier: number;
  readonly witnessWeightMultiplier: number;
  readonly compressionAggressiveness01: number;
}

export const MODE_MEMORY_PROFILES: Readonly<Record<string, ModeMemoryProfile>> = Object.freeze({
  'GO_ALONE': Object.freeze({
    modeId: 'GO_ALONE', label: 'Empire',
    quoteMinimumLength: 10, quoteMaximumLength: 260, maxFragmentsPerMessage: 14,
    callbackProjectionThreshold01: 0.28,
    hotWindowMs: 1000 * 60 * 60 * 2, warmWindowMs: 1000 * 60 * 60 * 24,
    archiveThresholdMs: 1000 * 60 * 60 * 24 * 45, dormantThresholdMs: 1000 * 60 * 60 * 24 * 10,
    salienceFloor01: 0.14,
    rescueWeightMultiplier: 1.35, rivalryWeightMultiplier: 1.0, dealRoomWeightMultiplier: 0.8,
    teamWeightMultiplier: 0.4, witnessWeightMultiplier: 1.1, compressionAggressiveness01: 0.55,
  }),
  'HEAD_TO_HEAD': Object.freeze({
    modeId: 'HEAD_TO_HEAD', label: 'Predator',
    quoteMinimumLength: 8, quoteMaximumLength: 200, maxFragmentsPerMessage: 10,
    callbackProjectionThreshold01: 0.22,
    hotWindowMs: 1000 * 60 * 45, warmWindowMs: 1000 * 60 * 60 * 6,
    archiveThresholdMs: 1000 * 60 * 60 * 24 * 14, dormantThresholdMs: 1000 * 60 * 60 * 24 * 3,
    salienceFloor01: 0.18,
    rescueWeightMultiplier: 0.7, rivalryWeightMultiplier: 1.25, dealRoomWeightMultiplier: 1.45,
    teamWeightMultiplier: 0.2, witnessWeightMultiplier: 0.9, compressionAggressiveness01: 0.72,
  }),
  'TEAM_UP': Object.freeze({
    modeId: 'TEAM_UP', label: 'Syndicate',
    quoteMinimumLength: 10, quoteMaximumLength: 280, maxFragmentsPerMessage: 16,
    callbackProjectionThreshold01: 0.32,
    hotWindowMs: 1000 * 60 * 60 * 4, warmWindowMs: 1000 * 60 * 60 * 48,
    archiveThresholdMs: 1000 * 60 * 60 * 24 * 60, dormantThresholdMs: 1000 * 60 * 60 * 24 * 14,
    salienceFloor01: 0.12,
    rescueWeightMultiplier: 1.15, rivalryWeightMultiplier: 0.85, dealRoomWeightMultiplier: 0.9,
    teamWeightMultiplier: 1.55, witnessWeightMultiplier: 1.3, compressionAggressiveness01: 0.38,
  }),
  'CHASE_A_LEGEND': Object.freeze({
    modeId: 'CHASE_A_LEGEND', label: 'Phantom',
    quoteMinimumLength: 6, quoteMaximumLength: 180, maxFragmentsPerMessage: 8,
    callbackProjectionThreshold01: 0.35,
    hotWindowMs: 1000 * 60 * 30, warmWindowMs: 1000 * 60 * 60 * 3,
    archiveThresholdMs: 1000 * 60 * 60 * 24 * 21, dormantThresholdMs: 1000 * 60 * 60 * 24 * 5,
    salienceFloor01: 0.22,
    rescueWeightMultiplier: 0.55, rivalryWeightMultiplier: 0.75, dealRoomWeightMultiplier: 0.6,
    teamWeightMultiplier: 0.3, witnessWeightMultiplier: 0.65, compressionAggressiveness01: 0.65,
  }),
});

export function getModeMemoryProfile(modeId: string | undefined): ModeMemoryProfile | undefined {
  if (!modeId) return undefined;
  return MODE_MEMORY_PROFILES[modeId] ?? undefined;
}

// ============================================================================
// MARK: Cross-run memory bridge types
// ============================================================================

export type BridgedMemoryStatus = 'BRIDGED_HOT' | 'BRIDGED_WARM' | 'BRIDGED_DORMANT' | 'BRIDGED_LEGEND';

export interface BridgedMemoryRecord {
  readonly bridgeId: string;
  readonly sourceRunId: string;
  readonly targetRunId: string;
  readonly sourceMemoryId: string;
  readonly playerId: string;
  readonly bridgedAt: number;
  readonly bridgeStatus: BridgedMemoryStatus;
  readonly originalSalience01: number;
  readonly bridgedSalience01: number;
  readonly decayAtBridgeTime01: number;
  readonly domain: 'EVENT' | 'QUOTE' | 'CALLBACK';
  readonly bridgeReason: string;
  readonly lineage: readonly string[];
  readonly tags: readonly string[];
}

export interface CrossRunBridgeConfig {
  readonly minSalienceForBridge01: number;
  readonly maxBridgedEventsPerRun: number;
  readonly maxBridgedQuotesPerRun: number;
  readonly maxBridgedCallbacksPerRun: number;
  readonly bridgeDecayFactor01: number;
  readonly legendPromotionThreshold01: number;
}

export const DEFAULT_CROSS_RUN_BRIDGE_CONFIG: CrossRunBridgeConfig = Object.freeze({
  minSalienceForBridge01: 0.42,
  maxBridgedEventsPerRun: 128,
  maxBridgedQuotesPerRun: 64,
  maxBridgedCallbacksPerRun: 64,
  bridgeDecayFactor01: 0.78,
  legendPromotionThreshold01: 0.88,
});

// ============================================================================
// MARK: Multi-player shared memory types
// ============================================================================

export interface SharedMemoryOverlap {
  readonly overlapId: string;
  readonly playerIds: readonly string[];
  readonly sharedEventIds: readonly string[];
  readonly sharedQuoteIds: readonly string[];
  readonly sharedCallbackIds: readonly string[];
  readonly channelId: string;
  readonly overlapStrength01: number;
  readonly computedAt: number;
}

export interface ConflictingRecollection {
  readonly conflictId: string;
  readonly playerA: string;
  readonly playerB: string;
  readonly memoryIdA: string;
  readonly memoryIdB: string;
  readonly divergenceType: 'SALIENCE_MISMATCH' | 'STATUS_MISMATCH' | 'EMOTION_MISMATCH' | 'QUOTE_MISMATCH';
  readonly divergenceStrength01: number;
  readonly description: string;
}

// ============================================================================
// MARK: Memory conflict arbitration types
// ============================================================================

export interface MemorySelectionClaim {
  readonly claimId: string;
  readonly consumerId: string;
  readonly entityId: string;
  readonly entityType: 'QUOTE' | 'CALLBACK';
  readonly claimedAt: number;
  readonly expiresAt: number;
  readonly priority01: number;
}

export interface ConversationMemoryConflictArbitrationResult {
  readonly claimGranted: boolean;
  readonly conflictDetected: boolean;
  readonly winnerClaimId?: string;
  readonly loserClaimId?: string;
  readonly fallbackEntityId?: string;
  readonly reason: string;
}

// ============================================================================
// MARK: Cross-run pattern detection types
// ============================================================================

export type CrossRunPatternType =
  | 'RECURRING_HOSTILITY_AT_PRESSURE'
  | 'REPEATED_RESCUE'
  | 'REPEATED_CHOKE'
  | 'DEEP_BRIDGE_MEMORY'
  | 'RECURRING_BLUFF_FAILURE'
  | 'RECURRING_COMEBACK'
  | 'PERSISTENT_RIVALRY'
  | 'PERSISTENT_TRUST';

export interface CrossRunPattern {
  readonly patternId: string;
  readonly playerId: string;
  readonly patternType: CrossRunPatternType;
  readonly occurrences: number;
  readonly confidence01: number;
  readonly description: string;
  readonly involvedRunIds: readonly string[];
  readonly tags: readonly string[];
}

// ============================================================================
// MARK: Emotional decay model types
// ============================================================================

export type EmotionChannel = 'HOSTILITY' | 'EMBARRASSMENT' | 'CONFIDENCE' | 'INTIMACY' | 'STRATEGIC_WEIGHT' | 'SALIENCE';

export interface EmotionDecayProfile {
  readonly channel: EmotionChannel;
  readonly halfLifeMs: number;
  readonly floorValue01: number;
  readonly compoundOnRevisit: boolean;
  readonly compoundFactor01: number;
  readonly witnessMultiplier: number;
}

export const EMOTION_DECAY_PROFILES: Readonly<Record<EmotionChannel, EmotionDecayProfile>> = Object.freeze({
  'HOSTILITY': { channel: 'HOSTILITY', halfLifeMs: 1000 * 60 * 60 * 72, floorValue01: 0.05, compoundOnRevisit: true, compoundFactor01: 0.15, witnessMultiplier: 1.3 },
  'EMBARRASSMENT': { channel: 'EMBARRASSMENT', halfLifeMs: 1000 * 60 * 60 * 36, floorValue01: 0.02, compoundOnRevisit: true, compoundFactor01: 0.22, witnessMultiplier: 1.55 },
  'CONFIDENCE': { channel: 'CONFIDENCE', halfLifeMs: 1000 * 60 * 60 * 12, floorValue01: 0.1, compoundOnRevisit: false, compoundFactor01: 0.0, witnessMultiplier: 1.0 },
  'INTIMACY': { channel: 'INTIMACY', halfLifeMs: 1000 * 60 * 60 * 168, floorValue01: 0.08, compoundOnRevisit: true, compoundFactor01: 0.1, witnessMultiplier: 0.8 },
  'STRATEGIC_WEIGHT': { channel: 'STRATEGIC_WEIGHT', halfLifeMs: 1000 * 60 * 60 * 8, floorValue01: 0.03, compoundOnRevisit: false, compoundFactor01: 0.0, witnessMultiplier: 1.0 },
  'SALIENCE': { channel: 'SALIENCE', halfLifeMs: 1000 * 60 * 60 * 48, floorValue01: 0.06, compoundOnRevisit: true, compoundFactor01: 0.12, witnessMultiplier: 1.2 },
});

/**
 * Computes the decayed value of an emotion channel given elapsed time.
 * Uses exponential decay: value(t) = max(floor, original * 2^(-elapsed/halfLife))
 * If the player has revisited the counterpart since the original event,
 * the value compounds upward instead of decaying.
 */
export function computeEmotionDecay(
  originalValue01: number,
  elapsedMs: number,
  profile: EmotionDecayProfile,
  revisitCount = 0,
  wasWitnessed = false,
): number {
  if (elapsedMs <= 0) return originalValue01;
  const witnessBoost = wasWitnessed ? profile.witnessMultiplier : 1.0;
  const compoundBoost = profile.compoundOnRevisit && revisitCount > 0
    ? Math.min(revisitCount * profile.compoundFactor01, 0.5)
    : 0;
  const effectiveOriginal = clamp01(originalValue01 * witnessBoost + compoundBoost);
  const decayFactor = Math.pow(2, -(elapsedMs / profile.halfLifeMs));
  return Math.max(profile.floorValue01, effectiveOriginal * decayFactor);
}

/**
 * Applies decay to all emotion channels on an event record, returning a
 * new record with decayed scores. Does not mutate the original.
 */
export function applyEmotionDecayToEvent(
  record: ConversationMemoryEventRecord,
  referenceTime: number,
  revisitCount = 0,
  wasWitnessed = false,
): ConversationMemoryEventRecord {
  const elapsed = Math.max(0, referenceTime - record.createdAt);
  return {
    ...record,
    toneClass: record.toneClass,
    hostility01: computeEmotionDecay(record.hostility01, elapsed, EMOTION_DECAY_PROFILES.HOSTILITY, revisitCount, wasWitnessed),
    embarrassment01: computeEmotionDecay(record.embarrassment01, elapsed, EMOTION_DECAY_PROFILES.EMBARRASSMENT, revisitCount, wasWitnessed),
    confidence01: computeEmotionDecay(record.confidence01, elapsed, EMOTION_DECAY_PROFILES.CONFIDENCE, revisitCount, wasWitnessed),
    intimacy01: computeEmotionDecay(record.intimacy01, elapsed, EMOTION_DECAY_PROFILES.INTIMACY, revisitCount, wasWitnessed),
    strategicWeight01: computeEmotionDecay(record.strategicWeight01, elapsed, EMOTION_DECAY_PROFILES.STRATEGIC_WEIGHT, revisitCount, wasWitnessed),
    salience01: computeEmotionDecay(record.salience01, elapsed, EMOTION_DECAY_PROFILES.SALIENCE, revisitCount, wasWitnessed),
  };
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
function inferToneClass(normalizedBody: string, hostility01: number, confidence01: number, embarrassment01: number, intimacy01: number): ChatQuoteToneClass {
  if (hostility01 >= 0.65) return 'HOSTILE' as ChatQuoteToneClass;
  if (hostility01 >= 0.40) return 'TAUNTING' as ChatQuoteToneClass;
  if (embarrassment01 >= 0.50) return 'VULNERABLE' as ChatQuoteToneClass;
  if (confidence01 >= 0.60) return 'CONFIDENT' as ChatQuoteToneClass;
  if (intimacy01 >= 0.55) return 'SUPPORTIVE' as ChatQuoteToneClass;
  if (normalizedBody.includes('please') || normalizedBody.includes('help') || normalizedBody.includes('need')) return 'DESPERATE' as ChatQuoteToneClass;
  if (normalizedBody.includes('deal') || normalizedBody.includes('offer') || normalizedBody.includes('counter')) return 'CALCULATING' as ChatQuoteToneClass;
  return 'NEUTRAL' as ChatQuoteToneClass;
}
function inferAudienceClass(context: ConversationMemoryContext): ChatQuoteAudienceClass {
  if (context.privacyLevel === 'SHADOW' || context.channelId === 'SYSTEM_SHADOW' || context.channelId === 'NPC_SHADOW' || context.channelId === 'RIVALRY_SHADOW' || context.channelId === 'RESCUE_SHADOW') return 'SHADOW' as ChatQuoteAudienceClass;
  if (context.privacyLevel === 'PRIVATE' || context.channelId === 'DIRECT') return 'PRIVATE' as ChatQuoteAudienceClass;
  if (context.privacyLevel === 'TEAM' || context.channelId === 'SYNDICATE') return 'TEAM' as ChatQuoteAudienceClass;
  if (context.channelId === 'SPECTATOR') return 'SPECTATOR' as ChatQuoteAudienceClass;
  return 'PUBLIC' as ChatQuoteAudienceClass;
}
function inferUseIntent(kind: ChatQuoteKind, context: ConversationMemoryContext, hostility01: number, unresolved: boolean): ChatQuoteUseIntent {
  if (kind === 'RECEIPT') return 'RECEIPT' as ChatQuoteUseIntent;
  if (kind === 'CALLBACK') return 'CALLBACK' as ChatQuoteUseIntent;
  if (kind === 'BLUFF' && context.channelId === 'DEAL_ROOM') return 'AMMUNITION' as ChatQuoteUseIntent;
  if (kind === 'ADVICE') return 'BONDING' as ChatQuoteUseIntent;
  if (kind === 'THREAT' || (hostility01 >= 0.55 && unresolved)) return 'ESCALATION' as ChatQuoteUseIntent;
  if (kind === 'BOAST') return 'AMMUNITION' as ChatQuoteUseIntent;
  return 'DEFENSE' as ChatQuoteUseIntent;
}
function inferCallbackKind(quoteKind: ChatQuoteKind, mode: ChatCallbackMode | string): ChatCallbackKind {
  if (quoteKind === 'RECEIPT') return 'RECEIPT_DEPLOY' as ChatCallbackKind;
  if (quoteKind === 'BOAST') return 'BOAST_CHECK' as ChatCallbackKind;
  if (quoteKind === 'BLUFF') return 'BLUFF_CALL' as ChatCallbackKind;
  if (quoteKind === 'THREAT') return 'THREAT_FOLLOW' as ChatCallbackKind;
  if (quoteKind === 'ADVICE') return 'ADVICE_RECALL' as ChatCallbackKind;
  if (mode === 'RIVALRY') return 'RIVALRY_ECHO' as ChatCallbackKind;
  return 'GENERAL_RECALL' as ChatCallbackKind;
}
function inferPrivacyClass(context: ConversationMemoryContext): ChatCallbackPrivacyClass {
  if (context.privacyLevel === 'SHADOW' || context.channelId === 'SYSTEM_SHADOW' || context.channelId === 'NPC_SHADOW' || context.channelId === 'RIVALRY_SHADOW') return 'SHADOW' as ChatCallbackPrivacyClass;
  if (context.privacyLevel === 'PRIVATE' || context.channelId === 'DIRECT') return 'PRIVATE' as ChatCallbackPrivacyClass;
  if (context.privacyLevel === 'TEAM' || context.channelId === 'SYNDICATE') return 'TEAM_ONLY' as ChatCallbackPrivacyClass;
  return 'PUBLIC' as ChatCallbackPrivacyClass;
}
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
    const toneClass = inferToneClass(normalizedBody, hostility01, confidence01, embarrassment01, intimacy01);

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
      toneClass,
      unresolved: message.unresolved ?? (hostility01 >= 0.55 || embarrassment01 >= 0.5),
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
      const toneClass = event.toneClass ?? inferToneClass(normalizeText(fragment.text), event.hostility01, event.confidence01, event.embarrassment01, event.intimacy01);
      const audienceClass = inferAudienceClass(event.context);
      const useIntent = inferUseIntent(kind, event.context, event.hostility01, event.unresolved);
      const score01 = clamp01(event.salience01 * 0.42 + event.hostility01 * 0.14 + event.confidence01 * 0.10 + event.embarrassment01 * 0.10 + event.intimacy01 * 0.12 + event.strategicWeight01 * 0.12);

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
        tags: unique([...(event.context.tags ?? []), kind.toLowerCase(), String(event.context.channelId).toLowerCase(), String(toneClass).toLowerCase()]),
        score01,
        salience01: event.salience01,
        strategicWeight01: event.strategicWeight01,
        emotionalWeight01: clamp01(event.hostility01 * 0.42 + event.embarrassment01 * 0.24 + event.intimacy01 * 0.34),
        toneClass,
        audienceClass,
        useIntent,
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
      const callbackKind = inferCallbackKind(quote.kind, mode);
      const privacyClass = inferPrivacyClass(event.context);
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
        tags: unique([String(mode).toLowerCase(), quote.kind.toLowerCase(), String(event.context.channelId).toLowerCase(), String(callbackKind).toLowerCase()]),
        callbackKind,
        privacyClass,
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
      .filter((record) => (query.toneClasses?.length ? query.toneClasses.includes(record.toneClass) : true))
      .filter((record) => (query.audienceClasses?.length ? query.audienceClasses.includes(record.audienceClass) : true))
      .filter((record) => (query.useIntents?.length ? query.useIntents.includes(record.useIntent) : true))
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
  public selectQuoteCandidates(request: { readonly playerId: string; readonly actorId?: string; readonly counterpartId?: string; readonly runId?: string; readonly modeId?: string; readonly channelId?: ConversationMemoryChannelId; readonly toneClass?: ChatQuoteToneClass; readonly audienceClass?: ChatQuoteAudienceClass; readonly useIntent?: ChatQuoteUseIntent; readonly limit?: number; }): readonly ConversationQuoteCandidate[] {
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
        if (request.toneClass && record.toneClass === request.toneClass) { score01 += 0.07; reasons.push('tone_match'); }
        if (request.audienceClass && record.audienceClass === request.audienceClass) { score01 += 0.05; reasons.push('audience_match'); }
        if (request.useIntent && record.useIntent === request.useIntent) { score01 += 0.06; reasons.push('intent_match'); }
        return { quoteId: record.quoteId, memoryId: record.memoryId, score01: clamp01(score01), reasons, record, contract: this.toChatQuoteRecord(record) };
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
        if (record.callbackKind === 'RECEIPT_DEPLOY' as ChatCallbackKind || record.callbackKind === 'BLUFF_CALL' as ChatCallbackKind) { score01 += 0.06; reasons.push('high_impact_kind'); }
        if (record.privacyClass === 'PUBLIC' as ChatCallbackPrivacyClass) { score01 += 0.03; reasons.push('public_leverage'); }
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


  // ==========================================================================
  // MARK: Persistence adapter wiring
  // ==========================================================================

  private _adapter: ConversationMemoryPersistenceAdapter = new InMemoryPersistenceAdapter();
  private _clock: MemoryClock = new WallClock();
  private _prng: SeededPRNG = new SeededPRNG();

  /** Attach a persistence adapter. All subsequent mutations will be mirrored. */
  public setAdapter(adapter: ConversationMemoryPersistenceAdapter): void { this._adapter = adapter; }

  /** Returns the currently active persistence adapter. */
  public getAdapter(): ConversationMemoryPersistenceAdapter { return this._adapter; }

  /** Attach a clock source. Replaces the default wall clock with a replay clock for deterministic replay. */
  public setClock(clock: MemoryClock): void { this._clock = clock; }

  /** Returns the currently active clock source. */
  public getClock(): MemoryClock { return this._clock; }

  /** Attach a seeded PRNG for deterministic ID generation. */
  public setPRNG(prng: SeededPRNG): void { this._prng = prng; }

  /** Returns the currently active PRNG. */
  public getPRNG(): SeededPRNG { return this._prng; }

  /** Flush all pending adapter writes. Call at run boundaries and before snapshots. */
  public async flushAdapter(): Promise<void> { await this._adapter.flush(); }

  /** Load a player's snapshot from the persistence layer and restore it into memory. */
  public async loadFromAdapter(playerId: string): Promise<boolean> {
    const snapshot = await this._adapter.loadSnapshot(playerId);
    if (!snapshot) return false;
    this.restore(snapshot);
    return true;
  }

  /** Persist the current in-memory state for a player through the adapter. */
  public async persistToAdapter(playerId: string): Promise<void> {
    await this._adapter.persistSnapshot(this.getSnapshot(playerId));
  }

  // ==========================================================================
  // MARK: Cross-run memory bridge
  // ==========================================================================

  private readonly _bridges = new Map<string, BridgedMemoryRecord[]>();
  private _bridgeConfig: CrossRunBridgeConfig = DEFAULT_CROSS_RUN_BRIDGE_CONFIG;

  /** Configure cross-run bridge behavior. */
  public setBridgeConfig(config: Partial<CrossRunBridgeConfig>): void {
    this._bridgeConfig = Object.freeze({ ...DEFAULT_CROSS_RUN_BRIDGE_CONFIG, ...config });
  }

  /**
   * Bridge high-salience memories from a completed run into the new run's hot set.
   * Called at RUN_START after the previous run's memory has been finalized.
   * Returns the list of bridged records for audit.
   */
  public bridgeToNewRun(playerId: string, sourceRunId: string, targetRunId: string, referenceTime?: number): readonly BridgedMemoryRecord[] {
    const rt = referenceTime ?? this._clock.now();
    const bucket = this.ensure(playerId);
    const bridges: BridgedMemoryRecord[] = [];
    const cfg = this._bridgeConfig;

    /* Bridge events */
    const runEventIds = bucket.eventsByRun.get(normalizeId(sourceRunId));
    if (runEventIds) {
      const candidates = [...runEventIds]
        .map((id) => bucket.events.get(id))
        .filter((e): e is ConversationMemoryEventRecord => !!e && e.salience01 >= cfg.minSalienceForBridge01)
        .sort((a, b) => b.salience01 - a.salience01)
        .slice(0, cfg.maxBridgedEventsPerRun);

      for (const event of candidates) {
        const bridgedSalience01 = clamp01(event.salience01 * cfg.bridgeDecayFactor01);
        const isLegend = event.salience01 >= cfg.legendPromotionThreshold01;
        const bridge: BridgedMemoryRecord = {
          bridgeId: `bridge:${sourceRunId}:${targetRunId}:${event.memoryId}:${this._prng.nextId(6)}`,
          sourceRunId, targetRunId, sourceMemoryId: event.memoryId, playerId,
          bridgedAt: rt,
          bridgeStatus: isLegend ? 'BRIDGED_LEGEND' : bridgedSalience01 >= 0.6 ? 'BRIDGED_HOT' : bridgedSalience01 >= 0.35 ? 'BRIDGED_WARM' : 'BRIDGED_DORMANT',
          originalSalience01: event.salience01, bridgedSalience01,
          decayAtBridgeTime01: clamp01(1 - cfg.bridgeDecayFactor01),
          domain: 'EVENT',
          bridgeReason: isLegend ? 'legend_promotion' : `salience_${event.salience01.toFixed(2)}_above_threshold`,
          lineage: [...event.lineageIds, event.memoryId],
          tags: [...(event.context.tags ?? []), 'bridged', isLegend ? 'legend' : 'carry_forward'],
        };
        bridges.push(bridge);
      }
    }

    /* Bridge quotes */
    const allQuotes = [...bucket.quotes.values()]
      .filter((q) => q.evidence.some((e) => e.runId === sourceRunId) && q.salience01 >= cfg.minSalienceForBridge01)
      .sort((a, b) => b.salience01 - a.salience01)
      .slice(0, cfg.maxBridgedQuotesPerRun);

    for (const quote of allQuotes) {
      const bridgedSalience01 = clamp01(quote.salience01 * cfg.bridgeDecayFactor01);
      const isLegend = quote.salience01 >= cfg.legendPromotionThreshold01;
      bridges.push({
        bridgeId: `bridge:${sourceRunId}:${targetRunId}:${quote.quoteId}:${this._prng.nextId(6)}`,
        sourceRunId, targetRunId, sourceMemoryId: quote.quoteId, playerId,
        bridgedAt: rt, bridgeStatus: isLegend ? 'BRIDGED_LEGEND' : 'BRIDGED_HOT',
        originalSalience01: quote.salience01, bridgedSalience01,
        decayAtBridgeTime01: clamp01(1 - cfg.bridgeDecayFactor01),
        domain: 'QUOTE',
        bridgeReason: isLegend ? 'legend_quote' : `quote_salience_${quote.salience01.toFixed(2)}`,
        lineage: [quote.memoryId, quote.quoteId],
        tags: [...quote.tags, 'bridged'],
      });
    }

    /* Bridge callbacks */
    const allCallbacks = [...bucket.callbacks.values()]
      .filter((c) => c.context.runId === sourceRunId && c.unresolved && c.salience01 >= cfg.minSalienceForBridge01)
      .sort((a, b) => b.salience01 - a.salience01)
      .slice(0, cfg.maxBridgedCallbacksPerRun);

    for (const cb of allCallbacks) {
      const bridgedSalience01 = clamp01(cb.salience01 * cfg.bridgeDecayFactor01);
      bridges.push({
        bridgeId: `bridge:${sourceRunId}:${targetRunId}:${cb.callbackId}:${this._prng.nextId(6)}`,
        sourceRunId, targetRunId, sourceMemoryId: cb.callbackId, playerId,
        bridgedAt: rt, bridgeStatus: 'BRIDGED_HOT',
        originalSalience01: cb.salience01, bridgedSalience01,
        decayAtBridgeTime01: clamp01(1 - cfg.bridgeDecayFactor01),
        domain: 'CALLBACK',
        bridgeReason: `unresolved_callback_${cb.mode}`,
        lineage: [cb.memoryId, cb.callbackId],
        tags: [...cb.tags, 'bridged', 'unresolved'],
      });
    }

    /* Store bridge records */
    const existing = this._bridges.get(playerId) ?? [];
    this._bridges.set(playerId, [...existing, ...bridges]);
    return Object.freeze(bridges);
  }

  /** List all bridged memories for a player, optionally filtered by target run. */
  public listBridgedMemories(playerId: string, targetRunId?: string): readonly BridgedMemoryRecord[] {
    const all = this._bridges.get(playerId) ?? [];
    if (!targetRunId) return Object.freeze(all);
    return Object.freeze(all.filter((b) => b.targetRunId === targetRunId));
  }

  /** Get the full bridge lineage for a memory — all runs it has been carried through. */
  public getBridgeLineage(playerId: string, memoryId: string): readonly BridgedMemoryRecord[] {
    const all = this._bridges.get(playerId) ?? [];
    return Object.freeze(all.filter((b) => b.sourceMemoryId === memoryId || b.lineage.includes(memoryId)));
  }

  /** Count how many runs a memory has survived through bridging. */
  public getBridgeDepth(playerId: string, memoryId: string): number {
    return this.getBridgeLineage(playerId, memoryId).length;
  }

  // ==========================================================================
  // MARK: Multi-player shared memory projection
  // ==========================================================================

  /**
   * Compute the overlap between two or more players' memories in a shared channel.
   * Used in Syndicate and Predator modes where players share social space.
   */
  public projectSharedMemory(playerIds: readonly string[], channelId: string): SharedMemoryOverlap {
    const rt = this._clock.now();
    const eventSets = playerIds.map((pid) => {
      const bucket = this.ensure(pid);
      const channelEvents = bucket.eventsByChannel.get(normalizeId(channelId));
      return channelEvents ? new Set(channelEvents) : new Set<string>();
    });

    /* Find event IDs that appear in ALL players' channel indexes */
    const sharedEventIds: string[] = [];
    if (eventSets.length > 0) {
      for (const eventId of eventSets[0]!) {
        if (eventSets.every((s) => s.has(eventId))) sharedEventIds.push(eventId);
      }
    }

    /* Find quotes attached to shared events */
    const sharedQuoteIds: string[] = [];
    for (const pid of playerIds) {
      const bucket = this.ensure(pid);
      for (const eventId of sharedEventIds) {
        const quoteIds = bucket.quotesByMemory.get(normalizeId(eventId));
        if (quoteIds) {
          for (const qid of quoteIds) {
            if (!sharedQuoteIds.includes(qid)) sharedQuoteIds.push(qid);
          }
        }
      }
    }

    /* Find callbacks attached to shared events */
    const sharedCallbackIds: string[] = [];
    for (const pid of playerIds) {
      const bucket = this.ensure(pid);
      for (const eventId of sharedEventIds) {
        const cbIds = bucket.callbacksByMemory.get(normalizeId(eventId));
        if (cbIds) {
          for (const cbId of cbIds) {
            if (!sharedCallbackIds.includes(cbId)) sharedCallbackIds.push(cbId);
          }
        }
      }
    }

    const totalPossible = Math.max(1, eventSets.reduce((sum, s) => sum + s.size, 0));
    const overlapStrength01 = clamp01(sharedEventIds.length / (totalPossible / playerIds.length));

    return Object.freeze({
      overlapId: `shared:${playerIds.join(':')}:${channelId}:${this._prng.nextId(6)}`,
      playerIds, sharedEventIds, sharedQuoteIds, sharedCallbackIds,
      channelId, overlapStrength01, computedAt: rt,
    });
  }

  /**
   * Find quotes that both players have in memory but with different emotional scores.
   * This creates the dramatic possibility of asymmetric recollection — Player A
   * remembers a taunt as devastating while Player B remembers it as minor.
   */
  public getConflictingRecollections(playerA: string, playerB: string, channelId?: string): readonly ConflictingRecollection[] {
    const conflicts: ConflictingRecollection[] = [];
    const bucketA = this.ensure(playerA);
    const bucketB = this.ensure(playerB);

    for (const [quoteId, quoteA] of bucketA.quotes) {
      const quoteB = bucketB.quotes.get(quoteId);
      if (!quoteB) continue;
      if (channelId && !quoteA.evidence.some((e) => e.channelId === channelId)) continue;

      const salienceDiff = Math.abs(quoteA.salience01 - quoteB.salience01);
      const emotionDiff = Math.abs(quoteA.emotionalWeight01 - quoteB.emotionalWeight01);

      if (salienceDiff >= 0.2) {
        conflicts.push({
          conflictId: `conflict:salience:${quoteId}:${this._prng.nextId(4)}`,
          playerA, playerB, memoryIdA: quoteA.memoryId, memoryIdB: quoteB.memoryId,
          divergenceType: 'SALIENCE_MISMATCH', divergenceStrength01: salienceDiff,
          description: `Quote "${quoteA.fragment.text.slice(0, 48)}" has salience ${quoteA.salience01.toFixed(2)} for ${playerA} but ${quoteB.salience01.toFixed(2)} for ${playerB}`,
        });
      }

      if (emotionDiff >= 0.25) {
        conflicts.push({
          conflictId: `conflict:emotion:${quoteId}:${this._prng.nextId(4)}`,
          playerA, playerB, memoryIdA: quoteA.memoryId, memoryIdB: quoteB.memoryId,
          divergenceType: 'EMOTION_MISMATCH', divergenceStrength01: emotionDiff,
          description: `Quote "${quoteA.fragment.text.slice(0, 48)}" has emotional weight ${quoteA.emotionalWeight01.toFixed(2)} for ${playerA} but ${quoteB.emotionalWeight01.toFixed(2)} for ${playerB}`,
        });
      }

      if (quoteA.status !== quoteB.status) {
        conflicts.push({
          conflictId: `conflict:status:${quoteId}:${this._prng.nextId(4)}`,
          playerA, playerB, memoryIdA: quoteA.memoryId, memoryIdB: quoteB.memoryId,
          divergenceType: 'STATUS_MISMATCH', divergenceStrength01: 0.5,
          description: `Quote "${quoteA.fragment.text.slice(0, 48)}" is ${quoteA.status} for ${playerA} but ${quoteB.status} for ${playerB}`,
        });
      }
    }

    return Object.freeze(conflicts);
  }

  // ==========================================================================
  // MARK: Memory conflict arbitration
  // ==========================================================================

  private readonly _activeClaims = new Map<string, MemorySelectionClaim>();
  private static readonly CLAIM_TTL_MS = 5000;

  /**
   * Claim a quote or callback for exclusive use by a specific consumer
   * (e.g., a rival claiming a receipt so a helper cannot use the same quote).
   * Returns the arbitration result indicating whether the claim was granted.
   */
  public claimSelection(consumerId: string, entityId: string, entityType: 'QUOTE' | 'CALLBACK', priority01: number): ConversationMemoryConflictArbitrationResult {
    const rt = this._clock.now();
    this.expireStaleClaims(rt);

    const existing = this._activeClaims.get(entityId);
    if (!existing) {
      const claim: MemorySelectionClaim = {
        claimId: `claim:${consumerId}:${entityId}:${this._prng.nextId(4)}`,
        consumerId, entityId, entityType, claimedAt: rt,
        expiresAt: rt + ConversationMemoryStore.CLAIM_TTL_MS, priority01,
      };
      this._activeClaims.set(entityId, claim);
      return { claimGranted: true, conflictDetected: false, winnerClaimId: claim.claimId, reason: 'no_conflict' };
    }

    if (existing.consumerId === consumerId) {
      return { claimGranted: true, conflictDetected: false, winnerClaimId: existing.claimId, reason: 'same_consumer' };
    }

    /* Conflict detected — higher priority wins */
    if (priority01 > existing.priority01) {
      const newClaim: MemorySelectionClaim = {
        claimId: `claim:${consumerId}:${entityId}:${this._prng.nextId(4)}`,
        consumerId, entityId, entityType, claimedAt: rt,
        expiresAt: rt + ConversationMemoryStore.CLAIM_TTL_MS, priority01,
      };
      this._activeClaims.set(entityId, newClaim);
      return {
        claimGranted: true, conflictDetected: true,
        winnerClaimId: newClaim.claimId, loserClaimId: existing.claimId,
        reason: `priority_override_${priority01.toFixed(2)}_beats_${existing.priority01.toFixed(2)}`,
      };
    }

    return {
      claimGranted: false, conflictDetected: true,
      winnerClaimId: existing.claimId, loserClaimId: undefined,
      reason: `priority_insufficient_${priority01.toFixed(2)}_vs_${existing.priority01.toFixed(2)}`,
    };
  }

  /** Release a claim, allowing other consumers to use the entity. */
  public releaseSelection(entityId: string, consumerId?: string): boolean {
    const existing = this._activeClaims.get(entityId);
    if (!existing) return false;
    if (consumerId && existing.consumerId !== consumerId) return false;
    this._activeClaims.delete(entityId);
    return true;
  }

  /** Check if a selection is currently claimed by any consumer. */
  public isSelectionClaimed(entityId: string): boolean {
    this.expireStaleClaims(this._clock.now());
    return this._activeClaims.has(entityId);
  }

  /** Get the active claim for an entity, if any. */
  public getActiveClaim(entityId: string): MemorySelectionClaim | undefined {
    this.expireStaleClaims(this._clock.now());
    return this._activeClaims.get(entityId);
  }

  /** Remove expired claims. */
  private expireStaleClaims(rt: number): void {
    for (const [key, claim] of this._activeClaims) {
      if (claim.expiresAt <= rt) this._activeClaims.delete(key);
    }
  }

  // ==========================================================================
  // MARK: Mode-aware ingestion
  // ==========================================================================

  /**
   * Ingest a message with mode-specific configuration applied. Looks up the
   * ModeMemoryProfile for the given modeId and adjusts extraction parameters.
   */
  public ingestMessageWithModeProfile(message: ConversationMemoryIngestMessage, modeId?: string): ConversationMemoryEventRecord {
    const profile = getModeMemoryProfile(modeId ?? message.context.modeId);
    if (!profile) return this.ingestMessage(message);

    /* Temporarily adjust config for this ingestion */
    const originalConfig = this.config;
    const modeConfig: ConversationMemoryStoreConfig = {
      ...originalConfig,
      quoteMinimumLength: profile.quoteMinimumLength,
      quoteMaximumLength: profile.quoteMaximumLength,
      maxFragmentsPerMessage: profile.maxFragmentsPerMessage,
      archiveThresholdMs: profile.archiveThresholdMs,
      dormantThresholdMs: profile.dormantThresholdMs,
    };
    (this as any).config = Object.freeze(modeConfig);
    try {
      return this.ingestMessage(message);
    } finally {
      (this as any).config = originalConfig;
    }
  }

  // ==========================================================================
  // MARK: Emotion decay application
  // ==========================================================================

  /**
   * Apply emotional decay to all events for a player, producing decayed
   * salience and emotion scores based on elapsed time and revisit patterns.
   */
  public applyEmotionDecay(playerId: string, referenceTime?: number): number {
    const rt = referenceTime ?? this._clock.now();
    const bucket = this.ensure(playerId);
    let updated = 0;

    for (const [memoryId, event] of bucket.events) {
      const elapsed = Math.max(0, rt - event.createdAt);
      if (elapsed <= 0) continue;

      const revisitCount = event.reuseCount;
      const wasWitnessed = event.context.privacyLevel === 'PUBLIC' || event.context.channelId === 'GLOBAL';
      const decayed = applyEmotionDecayToEvent(event, rt, revisitCount, wasWitnessed);

      /* Only update if decay changed any score by more than epsilon */
      const epsilon = 0.005;
      if (
        Math.abs(decayed.hostility01 - event.hostility01) > epsilon ||
        Math.abs(decayed.embarrassment01 - event.embarrassment01) > epsilon ||
        Math.abs(decayed.salience01 - event.salience01) > epsilon
      ) {
        this.unindexEvent(bucket, event);
        bucket.events.set(memoryId, { ...decayed, updatedAt: rt });
        this.indexEvent(bucket, bucket.events.get(memoryId)!);
        updated++;
      }
    }
    return updated;
  }

  // ==========================================================================
  // MARK: Diagnostic and stats
  // ==========================================================================

  /** Returns high-level memory stats for a player. */
  public getPlayerStats(playerId: string): {
    eventCount: number; quoteCount: number; callbackCount: number; mutationCount: number;
    activeEvents: number; dormantEvents: number; archivedEvents: number;
    unresolvedQuotes: number; unresolvedCallbacks: number;
    bridgedMemories: number; activeClaims: number;
    avgSalience01: number; avgHostility01: number; avgEmbarrassment01: number;
  } {
    const bucket = this.ensure(playerId);
    const events = [...bucket.events.values()];
    const quotes = [...bucket.quotes.values()];
    const callbacks = [...bucket.callbacks.values()];

    return {
      eventCount: events.length,
      quoteCount: quotes.length,
      callbackCount: callbacks.length,
      mutationCount: bucket.mutations.length,
      activeEvents: events.filter((e) => e.status === 'ACTIVE').length,
      dormantEvents: events.filter((e) => e.status === 'DORMANT').length,
      archivedEvents: events.filter((e) => e.status === 'ARCHIVED').length,
      unresolvedQuotes: quotes.filter((q) => q.unresolved).length,
      unresolvedCallbacks: callbacks.filter((c) => c.unresolved).length,
      bridgedMemories: (this._bridges.get(playerId) ?? []).length,
      activeClaims: [...this._activeClaims.values()].filter((c) => c.expiresAt > this._clock.now()).length,
      avgSalience01: events.length > 0 ? events.reduce((s, e) => s + e.salience01, 0) / events.length : 0,
      avgHostility01: events.length > 0 ? events.reduce((s, e) => s + e.hostility01, 0) / events.length : 0,
      avgEmbarrassment01: events.length > 0 ? events.reduce((s, e) => s + e.embarrassment01, 0) / events.length : 0,
    };
  }

  /** List all player IDs currently in the store. */
  public listPlayerIds(): readonly string[] { return [...this.players.keys()]; }

  /** Returns total memory footprint across all players. */
  public globalStats(): { playerCount: number; totalEvents: number; totalQuotes: number; totalCallbacks: number; totalBridges: number } {
    let totalEvents = 0, totalQuotes = 0, totalCallbacks = 0, totalBridges = 0;
    for (const bucket of this.players.values()) {
      totalEvents += bucket.events.size;
      totalQuotes += bucket.quotes.size;
      totalCallbacks += bucket.callbacks.size;
    }
    for (const bridges of this._bridges.values()) totalBridges += bridges.length;
    return { playerCount: this.players.size, totalEvents, totalQuotes, totalCallbacks, totalBridges };
  }

  // ==========================================================================
  // MARK: Cross-run pattern detection
  // ==========================================================================

  /**
   * Detect repeating emotional patterns across runs for a player.
   * Returns patterns like "player always chokes at high pressure" or
   * "player always gets rescued by the same helper persona."
   */
  public detectCrossRunPatterns(playerId: string, minOccurrences = 2): readonly CrossRunPattern[] {
    const bridges = this._bridges.get(playerId) ?? [];
    const bucket = this.ensure(playerId);
    const patterns: CrossRunPattern[] = [];

    /* Pattern: repeated high-hostility events at similar pressure tiers */
    const highHostilityByPressure = new Map<string, number>();
    for (const event of bucket.events.values()) {
      if (event.hostility01 >= 0.6 && event.context.pressureTier) {
        const key = event.context.pressureTier;
        highHostilityByPressure.set(key, (highHostilityByPressure.get(key) ?? 0) + 1);
      }
    }
    for (const [pressureTier, count] of highHostilityByPressure) {
      if (count >= minOccurrences) {
        patterns.push({
          patternId: `pattern:hostility_at_pressure:${pressureTier}:${this._prng.nextId(4)}`,
          playerId, patternType: 'RECURRING_HOSTILITY_AT_PRESSURE',
          occurrences: count, confidence01: clamp01(Math.min(count / 6, 1)),
          description: `Player experiences high hostility (>=0.6) at pressure tier ${pressureTier} across ${count} events`,
          involvedRunIds: unique([...bucket.events.values()].filter((e) => e.hostility01 >= 0.6 && e.context.pressureTier === pressureTier).map((e) => e.context.runId).filter((r): r is string => !!r)),
          tags: ['cross_run', 'hostility', pressureTier],
        });
      }
    }

    /* Pattern: repeated rescue interventions */
    const rescueCount = [...bucket.events.values()].filter((e) => e.context.eventType === 'RESCUE_INTERVENTION').length;
    if (rescueCount >= minOccurrences) {
      const rescueRuns = unique([...bucket.events.values()].filter((e) => e.context.eventType === 'RESCUE_INTERVENTION').map((e) => e.context.runId).filter((r): r is string => !!r));
      patterns.push({
        patternId: `pattern:repeated_rescue:${this._prng.nextId(4)}`,
        playerId, patternType: 'REPEATED_RESCUE',
        occurrences: rescueCount, confidence01: clamp01(Math.min(rescueCount / 4, 1)),
        description: `Player has been rescued ${rescueCount} times across ${rescueRuns.length} runs`,
        involvedRunIds: rescueRuns, tags: ['cross_run', 'rescue'],
      });
    }

    /* Pattern: repeated embarrassment events (choking) */
    const chokeCount = [...bucket.events.values()].filter((e) => e.embarrassment01 >= 0.55).length;
    if (chokeCount >= minOccurrences) {
      const chokeRuns = unique([...bucket.events.values()].filter((e) => e.embarrassment01 >= 0.55).map((e) => e.context.runId).filter((r): r is string => !!r));
      patterns.push({
        patternId: `pattern:repeated_choke:${this._prng.nextId(4)}`,
        playerId, patternType: 'REPEATED_CHOKE',
        occurrences: chokeCount, confidence01: clamp01(Math.min(chokeCount / 5, 1)),
        description: `Player shows high embarrassment (>=0.55) in ${chokeCount} events across ${chokeRuns.length} runs`,
        involvedRunIds: chokeRuns, tags: ['cross_run', 'embarrassment', 'choke'],
      });
    }

    /* Pattern: bridge depth — memories that survive 3+ runs */
    const deepBridges = bridges.filter((b) => b.lineage.length >= 3);
    if (deepBridges.length >= 1) {
      patterns.push({
        patternId: `pattern:deep_bridge:${this._prng.nextId(4)}`,
        playerId, patternType: 'DEEP_BRIDGE_MEMORY',
        occurrences: deepBridges.length, confidence01: 0.9,
        description: `${deepBridges.length} memories have survived 3+ runs through bridging — these are the player's defining moments`,
        involvedRunIds: unique(deepBridges.map((b) => b.targetRunId)),
        tags: ['cross_run', 'legend', 'bridge'],
      });
    }

    return Object.freeze(patterns);
  }


  // ==========================================================================
  // MARK: Quote contract projection (shared contract bridge)
  // ==========================================================================

  /**
   * Convert an internal ConversationMemoryQuoteRecord into a ChatQuoteRecord-shaped
   * projection suitable for consumption by shared contract surfaces, frontend engines,
   * and any upstream consumer that expects the canonical ChatQuote contract shape.
   */
  public toChatQuoteRecord(record: ConversationMemoryQuoteRecord): ConversationMemoryExternalQuoteRecord {
    return {
      quoteId: record.quoteId,
      messageId: record.messageId,
      playerId: record.playerId,
      actorId: record.actorId,
      counterpartId: record.counterpartId,
      kind: record.kind,
      speakerRole: record.speakerRole,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      status: record.status,
      unresolved: record.unresolved,
      tags: [...record.tags],
      score01: record.score01,
      salience01: record.salience01,
      strategicWeight01: record.strategicWeight01,
      emotionalWeight01: record.emotionalWeight01,
      toneClass: record.toneClass,
      audienceClass: record.audienceClass,
      useIntent: record.useIntent,
      usageCount: record.usageCount,
      lastUsedAt: record.lastUsedAt,
      fragment: {
        fragmentId: record.fragment.fragmentId,
        text: record.fragment.text,
        normalizedText: record.fragment.normalizedText,
        index: record.fragment.index,
      },
      proof: {
        proofId: record.proof.proofId,
        proofChainId: record.proof.proofChainId,
        messageId: record.proof.messageId,
        excerpt: record.proof.excerpt,
        excerptStart: record.proof.excerptStart,
        excerptEnd: record.proof.excerptEnd,
        createdAt: record.proof.createdAt,
      },
      evidence: record.evidence.map((evidence) => ({
        evidenceId: evidence.evidenceId,
        messageId: evidence.messageId,
        playerId: evidence.playerId,
        actorId: evidence.actorId,
        counterpartId: evidence.counterpartId,
        runId: evidence.runId,
        modeId: evidence.modeId,
        channelId: evidence.channelId,
        roomId: evidence.roomId,
        createdAt: evidence.createdAt,
        proof: {
          proofId: evidence.proof.proofId,
          proofChainId: evidence.proof.proofChainId,
          messageId: evidence.proof.messageId,
          excerpt: evidence.proof.excerpt,
          excerptStart: evidence.proof.excerptStart,
          excerptEnd: evidence.proof.excerptEnd,
          createdAt: evidence.proof.createdAt,
        },
      })),
    } as unknown as ConversationMemoryExternalQuoteRecord;
  }

  /**
   * Build a paired projection containing both the internal memory record and
   * the contract-shaped external record for a single quote.
   */
  public buildQuoteContractProjection(playerId: string, quoteId: string): ConversationMemoryQuoteContractProjection | undefined {
    const record = this.getQuote(playerId, quoteId);
    if (!record) return undefined;
    return {
      quoteId: record.quoteId,
      memoryId: record.memoryId,
      internal: record,
      contract: this.toChatQuoteRecord(record),
    };
  }

  /**
   * Export all quotes matching a query as contract-shaped external records.
   * Used by frontend engines and shared contract consumers that need the
   * ChatQuoteRecord shape without access to internal memory internals.
   */
  public exportChatQuoteRecords(query: ConversationQuoteQuery): readonly ConversationMemoryExternalQuoteRecord[] {
    return this.queryQuotes(query).map((record) => this.toChatQuoteRecord(record));
  }

  /**
   * Export all quotes matching a query as paired internal + contract projections.
   * Used by orchestration layers that need both the rich internal record and
   * the contract-safe external shape in a single pass.
   */
  public exportQuoteContractProjectionBatch(query: ConversationQuoteQuery): readonly ConversationMemoryQuoteContractProjection[] {
    return this.queryQuotes(query).map((record) => ({
      quoteId: record.quoteId,
      memoryId: record.memoryId,
      internal: record,
      contract: this.toChatQuoteRecord(record),
    }));
  }

  /** Delete all data for a player, including bridges and claims. */
  public forgetPlayer(playerId: string): void {
    this.players.delete(playerId);
    this._bridges.delete(playerId);
    for (const [key, claim] of this._activeClaims) {
      if (key.includes(playerId)) this._activeClaims.delete(key);
    }
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


// ============================================================================
// MARK: Real audit slices — 30 unique diagnostic tools
// ============================================================================

/** Slice 1: Per-counterpart memory heat map — event density by counterpart. */
export function buildConversationMemoryAuditSlice1(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=1|counterpart_heat_map'];
  const counterpartCounts = new Map<string, { events: number; quotes: number; callbacks: number; maxSalience: number }>();
  for (const event of snapshot.events) {
    const cpId = event.counterpart?.actorId ?? 'NONE';
    const entry = counterpartCounts.get(cpId) ?? { events: 0, quotes: 0, callbacks: 0, maxSalience: 0 };
    entry.events++;
    entry.maxSalience = Math.max(entry.maxSalience, event.salience01);
    counterpartCounts.set(cpId, entry);
  }
  for (const quote of snapshot.quotes) {
    const cpId = quote.counterpartId ?? 'NONE';
    const entry = counterpartCounts.get(cpId) ?? { events: 0, quotes: 0, callbacks: 0, maxSalience: 0 };
    entry.quotes++;
    counterpartCounts.set(cpId, entry);
  }
  for (const cb of snapshot.callbacks) {
    const cpId = cb.context.counterpartId ?? 'NONE';
    const entry = counterpartCounts.get(cpId) ?? { events: 0, quotes: 0, callbacks: 0, maxSalience: 0 };
    entry.callbacks++;
    counterpartCounts.set(cpId, entry);
  }
  const sorted = [...counterpartCounts.entries()].sort((a, b) => (b[1].events + b[1].quotes) - (a[1].events + a[1].quotes));
  for (const [cpId, counts] of sorted.slice(0, 16)) {
    lines.push(`${cpId}|events=${counts.events}|quotes=${counts.quotes}|callbacks=${counts.callbacks}|maxSalience=${counts.maxSalience.toFixed(3)}`);
  }
  return lines;
}

/** Slice 2: Quote chain graph — which quotes spawned callbacks and their resolution state. */
export function buildConversationMemoryAuditSlice2(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=2|quote_chain_graph'];
  const quoteMap = new Map(snapshot.quotes.map((q) => [q.quoteId, q]));
  for (const cb of snapshot.callbacks.slice(0, 20)) {
    const sourceQuote = quoteMap.get(cb.anchor.quoteId ?? '');
    const quoteText = sourceQuote?.fragment.text.slice(0, 40) ?? cb.anchor.sourceText.slice(0, 40);
    lines.push(`${cb.callbackId}|mode=${cb.mode}|unresolved=${cb.unresolved}|salience=${cb.salience01.toFixed(3)}|used=${cb.usageCount}|quote="${quoteText}"`);
  }
  return lines;
}

/** Slice 3: Salience tier distribution histogram. */
export function buildConversationMemoryAuditSlice3(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=3|salience_distribution'];
  const tiers = { dormant: 0, low: 0, medium: 0, high: 0, critical: 0, legend: 0 };
  for (const event of snapshot.events) {
    if (event.salience01 < 0.15) tiers.dormant++;
    else if (event.salience01 < 0.35) tiers.low++;
    else if (event.salience01 < 0.55) tiers.medium++;
    else if (event.salience01 < 0.75) tiers.high++;
    else if (event.salience01 < 0.90) tiers.critical++;
    else tiers.legend++;
  }
  lines.push(`events_total=${snapshot.events.length}`);
  for (const [tier, count] of Object.entries(tiers)) {
    const pct = snapshot.events.length > 0 ? ((count / snapshot.events.length) * 100).toFixed(1) : '0.0';
    lines.push(`${tier}=${count}|${pct}%`);
  }
  return lines;
}

/** Slice 4: Status distribution across all three domains. */
export function buildConversationMemoryAuditSlice4(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=4|status_distribution'];
  const countStatus = (items: readonly { status: string }[]) => {
    const m = new Map<string, number>();
    for (const item of items) m.set(item.status, (m.get(item.status) ?? 0) + 1);
    return m;
  };
  const eventStatuses = countStatus(snapshot.events);
  const quoteStatuses = countStatus(snapshot.quotes);
  const callbackStatuses = countStatus(snapshot.callbacks);
  lines.push(`events: ${[...eventStatuses.entries()].map(([k, v]) => `${k}=${v}`).join(', ')}`);
  lines.push(`quotes: ${[...quoteStatuses.entries()].map(([k, v]) => `${k}=${v}`).join(', ')}`);
  lines.push(`callbacks: ${[...callbackStatuses.entries()].map(([k, v]) => `${k}=${v}`).join(', ')}`);
  return lines;
}

/** Slice 5: Active unresolved callback inventory with staleness. */
export function buildConversationMemoryAuditSlice5(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=5|unresolved_callbacks'];
  const unresolved = snapshot.callbacks.filter((c) => c.unresolved).sort((a, b) => b.salience01 - a.salience01);
  lines.push(`total_unresolved=${unresolved.length}`);
  for (const cb of unresolved.slice(0, 16)) {
    const ageMs = Date.now() - cb.createdAt;
    const ageHours = (ageMs / (1000 * 60 * 60)).toFixed(1);
    lines.push(`${cb.callbackId}|mode=${cb.mode}|salience=${cb.salience01.toFixed(3)}|age_hours=${ageHours}|text="${cb.anchor.sourceText.slice(0, 40)}"`);
  }
  return lines;
}

/** Slice 6: Memory budget utilization report. */
export function buildConversationMemoryAuditSlice6(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=6|budget_utilization'];
  const stats = store.getPlayerStats(playerId);
  lines.push(`events=${stats.eventCount}|active=${stats.activeEvents}|dormant=${stats.dormantEvents}|archived=${stats.archivedEvents}`);
  lines.push(`quotes=${stats.quoteCount}|unresolved=${stats.unresolvedQuotes}`);
  lines.push(`callbacks=${stats.callbackCount}|unresolved=${stats.unresolvedCallbacks}`);
  lines.push(`mutations=${stats.mutationCount}`);
  lines.push(`bridges=${stats.bridgedMemories}`);
  lines.push(`active_claims=${stats.activeClaims}`);
  lines.push(`avg_salience=${stats.avgSalience01.toFixed(3)}|avg_hostility=${stats.avgHostility01.toFixed(3)}|avg_embarrassment=${stats.avgEmbarrassment01.toFixed(3)}`);
  return lines;
}

/** Slice 7: Cross-run bridge lineage report. */
export function buildConversationMemoryAuditSlice7(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const bridges = store.listBridgedMemories(playerId);
  const lines: string[] = ['slice=7|bridge_lineage'];
  lines.push(`total_bridges=${bridges.length}`);
  const byRun = new Map<string, number>();
  const byDomain = new Map<string, number>();
  const byStatus = new Map<string, number>();
  for (const b of bridges) {
    byRun.set(b.targetRunId, (byRun.get(b.targetRunId) ?? 0) + 1);
    byDomain.set(b.domain, (byDomain.get(b.domain) ?? 0) + 1);
    byStatus.set(b.bridgeStatus, (byStatus.get(b.bridgeStatus) ?? 0) + 1);
  }
  lines.push(`by_domain: ${[...byDomain.entries()].map(([k, v]) => `${k}=${v}`).join(', ')}`);
  lines.push(`by_status: ${[...byStatus.entries()].map(([k, v]) => `${k}=${v}`).join(', ')}`);
  for (const [runId, count] of [...byRun.entries()].slice(0, 8)) {
    lines.push(`run=${runId}|bridged=${count}`);
  }
  return lines;
}

/** Slice 8: Channel activity distribution. */
export function buildConversationMemoryAuditSlice8(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=8|channel_distribution'];
  const channelCounts = new Map<string, number>();
  for (const event of snapshot.events) {
    const ch = event.context.channelId;
    channelCounts.set(ch, (channelCounts.get(ch) ?? 0) + 1);
  }
  const sorted = [...channelCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [channel, count] of sorted) {
    lines.push(`${channel}=${count}|${((count / Math.max(1, snapshot.events.length)) * 100).toFixed(1)}%`);
  }
  return lines;
}

/** Slice 9: Speaker role distribution across events. */
export function buildConversationMemoryAuditSlice9(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=9|role_distribution'];
  const roleCounts = new Map<string, number>();
  for (const event of snapshot.events) {
    roleCounts.set(event.role, (roleCounts.get(event.role) ?? 0) + 1);
  }
  for (const [role, count] of [...roleCounts.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`${role}=${count}`);
  }
  return lines;
}

/** Slice 10: Quote kind distribution. */
export function buildConversationMemoryAuditSlice10(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=10|quote_kind_distribution'];
  const kindCounts = new Map<string, number>();
  for (const quote of snapshot.quotes) {
    kindCounts.set(quote.kind, (kindCounts.get(quote.kind) ?? 0) + 1);
  }
  for (const [kind, count] of [...kindCounts.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`${kind}=${count}`);
  }
  return lines;
}

/** Slice 11: Top 10 highest-salience events with full context. */
export function buildConversationMemoryAuditSlice11(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=11|top_salience_events'];
  const top = [...snapshot.events].sort((a, b) => b.salience01 - a.salience01).slice(0, 10);
  for (const event of top) {
    lines.push(`${event.memoryId}|s=${event.salience01.toFixed(3)}|h=${event.hostility01.toFixed(2)}|e=${event.embarrassment01.toFixed(2)}|ch=${event.context.channelId}|"${event.body.slice(0, 50)}"`);
  }
  return lines;
}

/** Slice 12: Top 10 most-used quotes (recall fatigue candidates). */
export function buildConversationMemoryAuditSlice12(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=12|most_used_quotes'];
  const top = [...snapshot.quotes].sort((a, b) => b.usageCount - a.usageCount).slice(0, 10);
  for (const q of top) {
    lines.push(`${q.quoteId}|used=${q.usageCount}|kind=${q.kind}|salience=${q.salience01.toFixed(3)}|"${q.fragment.text.slice(0, 50)}"`);
  }
  return lines;
}

/** Slice 13: Event type distribution. */
export function buildConversationMemoryAuditSlice13(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=13|event_type_distribution'];
  const typeCounts = new Map<string, number>();
  for (const event of snapshot.events) {
    const et = event.context.eventType ?? 'UNKNOWN';
    typeCounts.set(et, (typeCounts.get(et) ?? 0) + 1);
  }
  for (const [et, count] of [...typeCounts.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`${et}=${count}`);
  }
  return lines;
}

/** Slice 14: Callback mode distribution. */
export function buildConversationMemoryAuditSlice14(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=14|callback_mode_distribution'];
  const modeCounts = new Map<string, number>();
  for (const cb of snapshot.callbacks) {
    modeCounts.set(String(cb.mode), (modeCounts.get(String(cb.mode)) ?? 0) + 1);
  }
  for (const [mode, count] of [...modeCounts.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`${mode}=${count}`);
  }
  return lines;
}

/** Slice 15: Privacy level distribution. */
export function buildConversationMemoryAuditSlice15(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=15|privacy_distribution'];
  const privCounts = new Map<string, number>();
  for (const event of snapshot.events) {
    const priv = event.context.privacyLevel ?? 'UNSET';
    privCounts.set(priv, (privCounts.get(priv) ?? 0) + 1);
  }
  for (const [priv, count] of [...privCounts.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`${priv}=${count}`);
  }
  return lines;
}

/** Slice 16: Run distribution — events per run. */
export function buildConversationMemoryAuditSlice16(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=16|run_distribution'];
  const runCounts = new Map<string, number>();
  for (const event of snapshot.events) {
    const runId = event.context.runId ?? 'NO_RUN';
    runCounts.set(runId, (runCounts.get(runId) ?? 0) + 1);
  }
  for (const [runId, count] of [...runCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    lines.push(`${runId}=${count}`);
  }
  return lines;
}

/** Slice 17: Emotion extremes — events with highest hostility, embarrassment, confidence. */
export function buildConversationMemoryAuditSlice17(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=17|emotion_extremes'];
  const byHostility = [...snapshot.events].sort((a, b) => b.hostility01 - a.hostility01).slice(0, 3);
  const byEmbarrassment = [...snapshot.events].sort((a, b) => b.embarrassment01 - a.embarrassment01).slice(0, 3);
  const byConfidence = [...snapshot.events].sort((a, b) => b.confidence01 - a.confidence01).slice(0, 3);
  lines.push('top_hostility:');
  for (const e of byHostility) lines.push(`  ${e.hostility01.toFixed(3)}|"${e.body.slice(0, 40)}"`);
  lines.push('top_embarrassment:');
  for (const e of byEmbarrassment) lines.push(`  ${e.embarrassment01.toFixed(3)}|"${e.body.slice(0, 40)}"`);
  lines.push('top_confidence:');
  for (const e of byConfidence) lines.push(`  ${e.confidence01.toFixed(3)}|"${e.body.slice(0, 40)}"`);
  return lines;
}

/** Slice 18: Temporal event density — events per hour over the last 24 hours. */
export function buildConversationMemoryAuditSlice18(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=18|temporal_density_24h'];
  const now = Date.now();
  const hourMs = 1000 * 60 * 60;
  const buckets = new Array(24).fill(0);
  for (const event of snapshot.events) {
    const hoursAgo = Math.floor((now - event.createdAt) / hourMs);
    if (hoursAgo >= 0 && hoursAgo < 24) buckets[hoursAgo]!++;
  }
  for (let h = 0; h < 24; h++) {
    if (buckets[h]! > 0) lines.push(`${h}h_ago=${buckets[h]}`);
  }
  return lines;
}

/** Slice 19: Tag frequency analysis. */
export function buildConversationMemoryAuditSlice19(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=19|tag_frequency'];
  const tagCounts = new Map<string, number>();
  for (const event of snapshot.events) {
    for (const tag of event.context.tags ?? []) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  for (const quote of snapshot.quotes) {
    for (const tag of quote.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  for (const [tag, count] of [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    lines.push(`${tag}=${count}`);
  }
  return lines;
}

/** Slice 20: Mutation log summary — recent mutation kinds and frequency. */
export function buildConversationMemoryAuditSlice20(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=20|mutation_summary'];
  const kindCounts = new Map<string, number>();
  for (const m of snapshot.mutations) kindCounts.set(m.kind, (kindCounts.get(m.kind) ?? 0) + 1);
  for (const [kind, count] of [...kindCounts.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`${kind}=${count}`);
  }
  lines.push(`last_5_mutations:`);
  for (const m of snapshot.mutations.slice(-5)) {
    lines.push(`  ${m.kind}|${m.entityId.slice(0, 30)}|${m.summary.slice(0, 40)}`);
  }
  return lines;
}

/** Slice 21: Unresolved events inventory. */
export function buildConversationMemoryAuditSlice21(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=21|unresolved_events'];
  const unresolved = snapshot.events.filter((e) => e.unresolved).sort((a, b) => b.salience01 - a.salience01);
  lines.push(`total_unresolved_events=${unresolved.length}`);
  for (const e of unresolved.slice(0, 12)) {
    lines.push(`${e.memoryId}|role=${e.role}|salience=${e.salience01.toFixed(3)}|"${e.body.slice(0, 48)}"`);
  }
  return lines;
}

/** Slice 22: Quote recurrence — quotes that have been extracted multiple times. */
export function buildConversationMemoryAuditSlice22(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=22|quote_recurrence'];
  const recurring = snapshot.quotes.filter((q) => q.recurrenceCount > 1).sort((a, b) => b.recurrenceCount - a.recurrenceCount);
  lines.push(`recurring_quotes=${recurring.length}`);
  for (const q of recurring.slice(0, 12)) {
    lines.push(`${q.quoteId}|recurrence=${q.recurrenceCount}|kind=${q.kind}|"${q.fragment.text.slice(0, 48)}"`);
  }
  return lines;
}

/** Slice 23: Callback resolution rate. */
export function buildConversationMemoryAuditSlice23(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=23|callback_resolution_rate'];
  const total = snapshot.callbacks.length;
  const resolved = snapshot.callbacks.filter((c) => !c.unresolved).length;
  const unresolved = total - resolved;
  const rate = total > 0 ? ((resolved / total) * 100).toFixed(1) : '0.0';
  lines.push(`total=${total}|resolved=${resolved}|unresolved=${unresolved}|rate=${rate}%`);
  const byMode = new Map<string, { total: number; resolved: number }>();
  for (const cb of snapshot.callbacks) {
    const m = String(cb.mode);
    const entry = byMode.get(m) ?? { total: 0, resolved: 0 };
    entry.total++;
    if (!cb.unresolved) entry.resolved++;
    byMode.set(m, entry);
  }
  for (const [mode, counts] of byMode) {
    const r = counts.total > 0 ? ((counts.resolved / counts.total) * 100).toFixed(1) : '0.0';
    lines.push(`${mode}|total=${counts.total}|resolved=${counts.resolved}|rate=${r}%`);
  }
  return lines;
}

/** Slice 24: Intimacy distribution — events ranked by intimacy score. */
export function buildConversationMemoryAuditSlice24(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=24|intimacy_distribution'];
  const top = [...snapshot.events].sort((a, b) => b.intimacy01 - a.intimacy01).slice(0, 8);
  for (const e of top) {
    lines.push(`${e.memoryId}|intimacy=${e.intimacy01.toFixed(3)}|ch=${e.context.channelId}|role=${e.role}|"${e.body.slice(0, 40)}"`);
  }
  return lines;
}

/** Slice 25: Strategic weight leaders — events with highest strategic weight. */
export function buildConversationMemoryAuditSlice25(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=25|strategic_weight_leaders'];
  const top = [...snapshot.events].sort((a, b) => b.strategicWeight01 - a.strategicWeight01).slice(0, 8);
  for (const e of top) {
    lines.push(`${e.memoryId}|sw=${e.strategicWeight01.toFixed(3)}|et=${e.context.eventType ?? 'NONE'}|"${e.body.slice(0, 40)}"`);
  }
  return lines;
}

/** Slice 26: Lineage depth — events with the deepest lineage chains. */
export function buildConversationMemoryAuditSlice26(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=26|lineage_depth'];
  const withLineage = snapshot.events.filter((e) => e.lineageIds.length > 0).sort((a, b) => b.lineageIds.length - a.lineageIds.length);
  lines.push(`events_with_lineage=${withLineage.length}`);
  for (const e of withLineage.slice(0, 8)) {
    lines.push(`${e.memoryId}|depth=${e.lineageIds.length}|chain=${e.lineageIds.slice(0, 3).join(' → ')}`);
  }
  return lines;
}

/** Slice 27: Mode distribution — events grouped by game mode. */
export function buildConversationMemoryAuditSlice27(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=27|mode_distribution'];
  const modeCounts = new Map<string, number>();
  for (const event of snapshot.events) {
    const mode = event.context.modeId ?? 'NO_MODE';
    modeCounts.set(mode, (modeCounts.get(mode) ?? 0) + 1);
  }
  for (const [mode, count] of [...modeCounts.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`${mode}=${count}`);
  }
  return lines;
}

/** Slice 28: Actor network — top actors by event participation. */
export function buildConversationMemoryAuditSlice28(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=28|actor_network'];
  const actorCounts = new Map<string, { count: number; roles: Set<string> }>();
  for (const event of snapshot.events) {
    const actorId = event.actor.actorId;
    const entry = actorCounts.get(actorId) ?? { count: 0, roles: new Set() };
    entry.count++;
    entry.roles.add(event.role);
    actorCounts.set(actorId, entry);
  }
  for (const [actorId, data] of [...actorCounts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 12)) {
    lines.push(`${actorId}|events=${data.count}|roles=${[...data.roles].join(',')}`);
  }
  return lines;
}

/** Slice 29: Proof chain coverage — events with proof chain IDs. */
export function buildConversationMemoryAuditSlice29(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=29|proof_chain_coverage'];
  const withProof = snapshot.events.filter((e) => e.context.proofChainId);
  const withoutProof = snapshot.events.filter((e) => !e.context.proofChainId);
  lines.push(`with_proof_chain=${withProof.length}|without=${withoutProof.length}`);
  const chains = new Map<string, number>();
  for (const e of withProof) {
    chains.set(e.context.proofChainId!, (chains.get(e.context.proofChainId!) ?? 0) + 1);
  }
  lines.push(`unique_chains=${chains.size}`);
  for (const [chainId, count] of [...chains.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    lines.push(`${chainId.slice(0, 40)}|events=${count}`);
  }
  return lines;
}

/** Slice 30: Global store health — cross-player aggregate metrics. */
export function buildConversationMemoryAuditSlice30(store: ConversationMemoryStore, _playerId: string): readonly string[] {
  const stats = store.globalStats();
  const lines: string[] = ['slice=30|global_store_health'];
  lines.push(`players=${stats.playerCount}`);
  lines.push(`total_events=${stats.totalEvents}`);
  lines.push(`total_quotes=${stats.totalQuotes}`);
  lines.push(`total_callbacks=${stats.totalCallbacks}`);
  lines.push(`total_bridges=${stats.totalBridges}`);
  if (stats.playerCount > 0) {
    lines.push(`avg_events_per_player=${(stats.totalEvents / stats.playerCount).toFixed(1)}`);
    lines.push(`avg_quotes_per_player=${(stats.totalQuotes / stats.playerCount).toFixed(1)}`);
  }
  return lines;
}
/** Slice 31: Tone class distribution across quotes. */
export function buildConversationMemoryAuditSlice31(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=31|tone_class_distribution'];
  const toneCounts = new Map<string, number>();
  for (const quote of snapshot.quotes) {
    const tone = String((quote as any).toneClass ?? 'UNSET');
    toneCounts.set(tone, (toneCounts.get(tone) ?? 0) + 1);
  }
  for (const [tone, count] of [...toneCounts.entries()].sort((a, b) => b[1] - a[1])) {
    const pct = snapshot.quotes.length > 0 ? ((count / snapshot.quotes.length) * 100).toFixed(1) : '0.0';
    lines.push(`${tone}=${count}|${pct}%`);
  }
  return lines;
}

/** Slice 32: Audience class distribution across quotes. */
export function buildConversationMemoryAuditSlice32(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=32|audience_class_distribution'];
  const audienceCounts = new Map<string, number>();
  for (const quote of snapshot.quotes) {
    const audience = String((quote as any).audienceClass ?? 'UNSET');
    audienceCounts.set(audience, (audienceCounts.get(audience) ?? 0) + 1);
  }
  for (const [audience, count] of [...audienceCounts.entries()].sort((a, b) => b[1] - a[1])) {
    const pct = snapshot.quotes.length > 0 ? ((count / snapshot.quotes.length) * 100).toFixed(1) : '0.0';
    lines.push(`${audience}=${count}|${pct}%`);
  }
  return lines;
}

/** Slice 33: Use intent distribution across quotes. */
export function buildConversationMemoryAuditSlice33(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=33|use_intent_distribution'];
  const intentCounts = new Map<string, number>();
  for (const quote of snapshot.quotes) {
    const intent = String((quote as any).useIntent ?? 'UNSET');
    intentCounts.set(intent, (intentCounts.get(intent) ?? 0) + 1);
  }
  for (const [intent, count] of [...intentCounts.entries()].sort((a, b) => b[1] - a[1])) {
    const pct = snapshot.quotes.length > 0 ? ((count / snapshot.quotes.length) * 100).toFixed(1) : '0.0';
    lines.push(`${intent}=${count}|${pct}%`);
  }
  return lines;
}

/** Slice 34: Callback kind distribution. */
export function buildConversationMemoryAuditSlice34(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=34|callback_kind_distribution'];
  const kindCounts = new Map<string, number>();
  for (const cb of snapshot.callbacks) {
    const kind = String((cb as any).callbackKind ?? 'UNSET');
    kindCounts.set(kind, (kindCounts.get(kind) ?? 0) + 1);
  }
  for (const [kind, count] of [...kindCounts.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`${kind}=${count}`);
  }
  return lines;
}

/** Slice 35: Privacy class distribution across callbacks. */
export function buildConversationMemoryAuditSlice35(store: ConversationMemoryStore, playerId: string): readonly string[] {
  const snapshot = store.getSnapshot(playerId);
  const lines: string[] = ['slice=35|callback_privacy_distribution'];
  const privacyCounts = new Map<string, number>();
  for (const cb of snapshot.callbacks) {
    const priv = String((cb as any).privacyClass ?? 'UNSET');
    privacyCounts.set(priv, (privacyCounts.get(priv) ?? 0) + 1);
  }
  for (const [priv, count] of [...privacyCounts.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`${priv}=${count}`);
  }
  return lines;
}