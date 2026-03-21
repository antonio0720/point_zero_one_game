/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT EPISODIC MEMORY
 * FILE: pzo-web/src/engines/chat/intelligence/ChatEpisodicMemory.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Stores emotionally significant player / bot / crowd moments so backend chat
 * can feel like it remembers the player even inside backend truth, before persistence services externalize it.
 * ============================================================================
 */

import type {
  ChatMessage,
  ChatScenePlan,
  ChatVisibleChannel,
  UnixMs,
} from '../types';

import type { BotId } from '../types';

export type ChatEpisodicEventType =
  | 'HUMILIATION'
  | 'COMEBACK'
  | 'COLLAPSE'
  | 'BREACH'
  | 'RESCUE'
  | 'BLUFF'
  | 'GREED'
  | 'HESITATION'
  | 'OVERCONFIDENCE'
  | 'DISCIPLINE'
  | 'PERFECT_DEFENSE'
  | 'FAILED_GAMBLE'
  | 'SOVEREIGNTY'
  | 'DEAL_ROOM_STANDOFF'
  | 'PUBLIC_WITNESS'
  | 'PRIVATE_CONFESSION';

export type ChatCallbackTone =
  | 'COLD'
  | 'CEREMONIAL'
  | 'MOCKING'
  | 'INTIMATE'
  | 'PUBLIC'
  | 'PRIVATE'
  | 'POST_EVENT'
  | 'PRE_EVENT';

export interface ChatEpisodicTriggerContext {
  readonly roomId?: string | null;
  readonly channelId?: ChatVisibleChannel | string | null;
  readonly messageId?: string | null;
  readonly sceneId?: string | null;
  readonly momentId?: string | null;
  readonly botId?: BotId | string | null;
  readonly counterpartId?: string | null;
  readonly pressureBand?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly tags?: readonly string[];
  readonly summary: string;
  readonly rawText?: string | null;
}

export interface ChatEpisodicCallbackVariant {
  readonly callbackId: string;
  readonly tone: ChatCallbackTone;
  readonly text: string;
  readonly usageBias01: number;
  readonly eligibleSceneRoles: readonly string[];
  readonly eligibleChannels: readonly string[];
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
  readonly eventTypes?: readonly ChatEpisodicEventType[];
  readonly unresolvedOnly?: boolean;
  readonly activeOnly?: boolean;
  readonly limit?: number;
}

export interface ChatEpisodicMemoryOptions {
  readonly activeMemoryCap?: number;
  readonly archivedMemoryCap?: number;
  readonly defaultExpiryMs?: number;
}

const DEFAULT_OPTIONS: Required<ChatEpisodicMemoryOptions> = {
  activeMemoryCap: 512,
  archivedMemoryCap: 512,
  defaultExpiryMs: 180 * 24 * 60 * 60 * 1000,
};

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

function normalizeText(value?: string | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function randomId(prefix: string, at: UnixMs): string {
  return `${prefix}:${Number(at)}:${Math.random().toString(36).slice(2, 10)}`;
}

function inferEventTypeFromMessage(message: ChatMessage): ChatEpisodicEventType | null {
  const kind = String((message as any).kind ?? '').toUpperCase();
  if (kind.includes('RESCUE')) return 'RESCUE';
  if (kind.includes('BREACH')) return 'BREACH';
  if (kind.includes('LEGEND')) return 'PUBLIC_WITNESS';
  if (kind.includes('NEGOTIATION')) return 'DEAL_ROOM_STANDOFF';

  const body = normalizeText(message.plainText).toLowerCase();
  if (body.includes('comeback')) return 'COMEBACK';
  if (body.includes('hesitat')) return 'HESITATION';
  if (body.includes('collapse')) return 'COLLAPSE';
  if (body.includes('bluff')) return 'BLUFF';
  if (body.includes('perfect defense')) return 'PERFECT_DEFENSE';
  if (body.includes('discipline')) return 'DISCIPLINE';
  if (body.includes('overconfiden')) return 'OVERCONFIDENCE';
  return null;
}

function buildDefaultCallbacks(
  eventType: ChatEpisodicEventType,
  summary: string,
  memoryId: string,
): readonly ChatEpisodicCallbackVariant[] {
  const raw = normalizeText(summary);
  const stem = raw.length > 0 ? raw : eventType.toLowerCase().replace(/_/g, ' ');
  return [
    {
      callbackId: `${memoryId}:cold`,
      tone: 'COLD',
      text: `I remember ${stem}.`,
      usageBias01: 0.72,
      eligibleSceneRoles: ['TAUNT', 'CALLBACK', 'RECKONING'],
      eligibleChannels: ['GLOBAL', 'DEAL_ROOM', 'SYNDICATE'],
    },
    {
      callbackId: `${memoryId}:public`,
      tone: 'PUBLIC',
      text: `The room remembers ${stem}.`,
      usageBias01: 0.54,
      eligibleSceneRoles: ['TAUNT', 'PUBLIC_WITNESS'],
      eligibleChannels: ['GLOBAL', 'LOBBY'],
    },
    {
      callbackId: `${memoryId}:private`,
      tone: 'PRIVATE',
      text: `You and I both know what ${stem} cost.`,
      usageBias01: 0.61,
      eligibleSceneRoles: ['RESCUE', 'CONFESSION', 'RECKONING'],
      eligibleChannels: ['SYNDICATE', 'DEAL_ROOM'],
    },
    {
      callbackId: `${memoryId}:mocking`,
      tone: 'MOCKING',
      text: `I have not forgotten ${stem}. Why would I?`,
      usageBias01: 0.48,
      eligibleSceneRoles: ['TAUNT', 'TRAP', 'PUNISH'],
      eligibleChannels: ['GLOBAL', 'DEAL_ROOM'],
    },
  ] as const;
}

export class ChatEpisodicMemory {
  private readonly options: Required<ChatEpisodicMemoryOptions>;
  private readonly createdAt: UnixMs;
  private updatedAt: UnixMs;
  private lastCarryoverSummary?: string;
  private readonly activeMemories = new Map<string, ChatEpisodicMemoryRecord>();
  private readonly archivedMemories = new Map<string, ChatEpisodicMemoryRecord>();

  public constructor(options: ChatEpisodicMemoryOptions = {}, now: UnixMs = Date.now() as UnixMs) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.createdAt = now;
    this.updatedAt = now;
  }

  public restore(snapshot: ChatEpisodicMemorySnapshot): this {
    this.activeMemories.clear();
    this.archivedMemories.clear();
    for (const memory of snapshot.activeMemories) this.activeMemories.set(memory.memoryId, { ...memory, callbackVariants: [...memory.callbackVariants] });
    for (const memory of snapshot.archivedMemories) this.archivedMemories.set(memory.memoryId, { ...memory, callbackVariants: [...memory.callbackVariants] });
    this.updatedAt = snapshot.updatedAt;
    this.lastCarryoverSummary = snapshot.lastCarryoverSummary;
    return this;
  }

  public snapshot(): ChatEpisodicMemorySnapshot {
    return {
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      activeMemories: this.sortMemories([...this.activeMemories.values()]),
      archivedMemories: this.sortMemories([...this.archivedMemories.values()]),
      unresolvedMemoryIds: [...this.activeMemories.values()].filter((item) => item.unresolved).map((item) => item.memoryId),
      lastCarryoverSummary: this.lastCarryoverSummary,
    };
  }

  public noteMessage(message: ChatMessage, now: UnixMs = message.createdAt as UnixMs): ChatEpisodicMemoryRecord | null {
    const inferred = inferEventTypeFromMessage(message);
    if (!inferred) return null;

    return this.recordEvent(
      inferred,
      {
        roomId: null,
        channelId: message.channelId,
        messageId: String(message.id),
        sceneId: (message.metadata as any)?.sceneId ? String((message.metadata as any)?.sceneId) : null,
        momentId: (message.metadata as any)?.momentId ? String((message.metadata as any)?.momentId) : null,
        botId: (message.attribution as any)?.botId ?? null,
        counterpartId: (message.attribution as any)?.actorId ?? null,
        pressureBand: this.toPressureBand((message.metadata as any)?.pressureTier),
        tags: message.tags ?? [],
        summary: message.plainText,
        rawText: message.plainText,
      },
      now,
    );
  }

  public noteScene(scene: ChatScenePlan, summary: string, now: UnixMs = scene.openedAt): ChatEpisodicMemoryRecord | null {
    const momentType = String((scene as any).momentType ?? '').toUpperCase();
    const type: ChatEpisodicEventType | null =
      momentType.includes('COMEBACK') ? 'COMEBACK'
      : momentType.includes('BREACH') ? 'BREACH'
      : momentType.includes('RESCUE') ? 'RESCUE'
      : momentType.includes('SOVEREIGNTY') ? 'SOVEREIGNTY'
      : null;

    if (!type) return null;

    return this.recordEvent(type, {
      roomId: null,
      channelId: (scene as any).primaryChannel,
      sceneId: String(scene.sceneId),
      momentId: String((scene as any).momentId),
      summary,
      rawText: summary,
      tags: ['scene', String((scene as any).momentType ?? '').toLowerCase()],
    }, now);
  }

  public recordEvent(
    eventType: ChatEpisodicEventType,
    triggerContext: ChatEpisodicTriggerContext,
    now: UnixMs = Date.now() as UnixMs,
    overrides: Partial<Omit<ChatEpisodicMemoryRecord, 'memoryId' | 'eventType' | 'triggerContext' | 'createdAt' | 'callbackVariants'>> = {},
  ): ChatEpisodicMemoryRecord {
    this.updatedAt = now;

    const memoryId = randomId(`memory:${String(eventType).toLowerCase()}`, now);
    const summary = normalizeText(triggerContext.summary);
    const salience = this.deriveSalience(eventType, triggerContext);
    const emotional = this.deriveEmotionalWeight(eventType, triggerContext);
    const strategic = this.deriveStrategicWeight(eventType, triggerContext);
    const embarrassment = this.deriveEmbarrassmentRisk(eventType, triggerContext);
    const memory: ChatEpisodicMemoryRecord = {
      memoryId,
      playerId: null,
      botId: triggerContext.botId ?? null,
      counterpartId: triggerContext.counterpartId ?? null,
      roomId: triggerContext.roomId ?? null,
      eventType,
      triggerContext: {
        ...triggerContext,
        tags: [...(triggerContext.tags ?? [])],
      },
      salience01: overrides.salience01 ?? salience,
      emotionalWeight01: overrides.emotionalWeight01 ?? emotional,
      strategicWeight01: overrides.strategicWeight01 ?? strategic,
      embarrassmentRisk01: overrides.embarrassmentRisk01 ?? embarrassment,
      callbackVariants: buildDefaultCallbacks(eventType, summary, memoryId),
      createdAt: now,
      lastReferencedAt: overrides.lastReferencedAt,
      lastStrengthenedAt: overrides.lastStrengthenedAt,
      timesReused: overrides.timesReused ?? 0,
      unresolved: overrides.unresolved ?? this.isUnresolvedByDefault(eventType),
      expiresAt: overrides.expiresAt ?? ((Number(now) + this.options.defaultExpiryMs) as UnixMs),
      archived: overrides.archived ?? false,
    };

    this.activeMemories.set(memoryId, memory);
    this.evictIfNeeded();
    return memory;
  }

  public query(query: ChatEpisodicMemoryQuery): readonly ChatEpisodicMemoryRecord[] {
    let pool = [...this.activeMemories.values()];
    if (query.botId != null) pool = pool.filter((item) => String(item.botId ?? '') === String(query.botId));
    if (query.counterpartId != null) pool = pool.filter((item) => String(item.counterpartId ?? '') === String(query.counterpartId));
    if (query.roomId != null) pool = pool.filter((item) => String(item.roomId ?? '') === String(query.roomId));
    if (query.eventTypes?.length) {
      const allow = new Set(query.eventTypes);
      pool = pool.filter((item) => allow.has(item.eventType));
    }
    if (query.unresolvedOnly) pool = pool.filter((item) => item.unresolved);
    if (query.activeOnly) pool = pool.filter((item) => !item.archived);
    const sorted = this.sortMemories(pool);
    return typeof query.limit === 'number' ? sorted.slice(0, query.limit) : sorted;
  }

  public queryCallbacks(request: {
    readonly botId?: BotId | string | null;
    readonly counterpartId?: string | null;
    readonly roomId?: string | null;
    readonly channelId?: string | null;
    readonly sceneRole?: string | null;
    readonly preferredTones?: readonly ChatCallbackTone[];
    readonly maxResults?: number;
  }): readonly ChatEpisodicCallbackCandidate[] {
    const notes: string[] = [];
    const pool = this.query({
      botId: request.botId,
      counterpartId: request.counterpartId,
      roomId: request.roomId,
      activeOnly: true,
      limit: 64,
    });

    const tones = new Set(request.preferredTones ?? []);
    const channelId = request.channelId ? String(request.channelId) : null;
    const sceneRole = request.sceneRole ? String(request.sceneRole) : null;

    const candidates: ChatEpisodicCallbackCandidate[] = [];
    for (const memory of pool) {
      for (const callback of memory.callbackVariants) {
        let score = memory.salience01 * 0.55;
        if (memory.unresolved) score += 0.15;
        if (!channelId || callback.eligibleChannels.includes(channelId)) score += 0.08;
        if (!sceneRole || callback.eligibleSceneRoles.includes(sceneRole)) score += 0.08;
        if (tones.size === 0 || tones.has(callback.tone)) score += 0.10;
        if (memory.timesReused > 0) score -= Math.min(0.20, memory.timesReused * 0.03);

        const candidateNotes = [...notes];
        if (memory.unresolved) candidateNotes.push('unresolved');
        if (tones.size > 0 && tones.has(callback.tone)) candidateNotes.push('preferred_tone');
        if (sceneRole && callback.eligibleSceneRoles.includes(sceneRole)) candidateNotes.push('scene_match');
        if (channelId && callback.eligibleChannels.includes(channelId)) candidateNotes.push('channel_match');

        candidates.push({
          memoryId: memory.memoryId,
          callbackId: callback.callbackId,
          eventType: memory.eventType,
          unresolved: memory.unresolved,
          salience01: memory.salience01,
          score01: clamp01(score),
          tone: callback.tone,
          text: callback.text,
          notes: candidateNotes,
        });
      }
    }

    const maxResults = request.maxResults ?? 8;
    return candidates
      .sort((a, b) => b.score01 - a.score01 || a.callbackId.localeCompare(b.callbackId))
      .slice(0, maxResults);
  }

  public markReused(memoryId: string, callbackId?: string, now: UnixMs = Date.now() as UnixMs): void {
    const current = this.activeMemories.get(memoryId);
    if (!current) return;
    this.activeMemories.set(memoryId, {
      ...current,
      timesReused: current.timesReused + 1,
      lastReferencedAt: now,
      unresolved: callbackId ? false : current.unresolved,
    });
    this.updatedAt = now;
  }

  public strengthen(memoryId: string, delta01: number, now: UnixMs = Date.now() as UnixMs): void {
    const current = this.activeMemories.get(memoryId);
    if (!current) return;
    this.activeMemories.set(memoryId, {
      ...current,
      salience01: clamp01(current.salience01 + delta01),
      emotionalWeight01: clamp01(current.emotionalWeight01 + (delta01 * 0.5)),
      lastStrengthenedAt: now,
    });
    this.updatedAt = now;
  }

  public archiveExpired(now: UnixMs = Date.now() as UnixMs): void {
    for (const [memoryId, memory] of [...this.activeMemories.entries()]) {
      if (memory.expiresAt && Number(memory.expiresAt) <= Number(now)) {
        this.activeMemories.delete(memoryId);
        this.archivedMemories.set(memoryId, { ...memory, archived: true, unresolved: false });
      }
    }
    this.evictIfNeeded();
    this.updatedAt = now;
  }

  public buildCarryoverSummary(limit = 4): string | undefined {
    const top = this.sortMemories([...this.activeMemories.values()])
      .filter((item) => item.unresolved || item.salience01 >= 0.65)
      .slice(0, limit);

    if (top.length === 0) return undefined;
    const summary = top.map((item) => `${item.eventType.toLowerCase().replace(/_/g, ' ')}: ${item.triggerContext.summary}`).join(' | ');
    this.lastCarryoverSummary = summary;
    return summary;
  }

  private sortMemories(memories: readonly ChatEpisodicMemoryRecord[]): readonly ChatEpisodicMemoryRecord[] {
    return [...memories].sort((a, b) => {
      const aScore = (a.salience01 * 0.55) + (a.emotionalWeight01 * 0.20) + (a.strategicWeight01 * 0.20) + (a.unresolved ? 0.05 : 0);
      const bScore = (b.salience01 * 0.55) + (b.emotionalWeight01 * 0.20) + (b.strategicWeight01 * 0.20) + (b.unresolved ? 0.05 : 0);
      if (aScore !== bScore) return bScore - aScore;
      return Number(b.createdAt) - Number(a.createdAt);
    });
  }

  private evictIfNeeded(): void {
    const active = [...this.sortMemories([...this.activeMemories.values()])];
    while (active.length > this.options.activeMemoryCap) {
      const victim = active.pop();
      if (!victim) break;
      this.activeMemories.delete(victim.memoryId);
      this.archivedMemories.set(victim.memoryId, { ...victim, archived: true });
    }

    const archived = [...this.sortMemories([...this.archivedMemories.values()])];
    while (archived.length > this.options.archivedMemoryCap) {
      const victim = archived.pop();
      if (!victim) break;
      this.archivedMemories.delete(victim.memoryId);
    }
  }

  private isUnresolvedByDefault(eventType: ChatEpisodicEventType): boolean {
    return eventType === 'HUMILIATION' ||
      eventType === 'COLLAPSE' ||
      eventType === 'BREACH' ||
      eventType === 'FAILED_GAMBLE' ||
      eventType === 'DEAL_ROOM_STANDOFF';
  }

  private deriveSalience(eventType: ChatEpisodicEventType, context: ChatEpisodicTriggerContext): number {
    let score = 0.45;
    if (eventType === 'HUMILIATION' || eventType === 'COMEBACK' || eventType === 'SOVEREIGNTY') score += 0.28;
    if (eventType === 'BREACH' || eventType === 'PERFECT_DEFENSE') score += 0.20;
    if ((context.tags ?? []).includes('legend')) score += 0.10;
    if (context.channelId === 'GLOBAL') score += 0.05;
    return clamp01(score);
  }

  private deriveEmotionalWeight(eventType: ChatEpisodicEventType, context: ChatEpisodicTriggerContext): number {
    let score = 0.40;
    if (eventType === 'HUMILIATION' || eventType === 'COLLAPSE') score += 0.30;
    if (eventType === 'RESCUE' || eventType === 'COMEBACK') score += 0.20;
    if (context.pressureBand === 'CRITICAL') score += 0.15;
    return clamp01(score);
  }

  private deriveStrategicWeight(eventType: ChatEpisodicEventType, context: ChatEpisodicTriggerContext): number {
    let score = 0.35;
    if (eventType === 'DISCIPLINE' || eventType === 'PERFECT_DEFENSE') score += 0.25;
    if (eventType === 'FAILED_GAMBLE' || eventType === 'BLUFF') score += 0.18;
    if (context.channelId === 'DEAL_ROOM') score += 0.10;
    return clamp01(score);
  }

  private deriveEmbarrassmentRisk(eventType: ChatEpisodicEventType, context: ChatEpisodicTriggerContext): number {
    let score = 0.15;
    if (eventType === 'HUMILIATION' || eventType === 'PUBLIC_WITNESS') score += 0.35;
    if (context.channelId === 'GLOBAL' || context.channelId === 'LOBBY') score += 0.20;
    return clamp01(score);
  }

  private toPressureBand(value: unknown): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | undefined {
    const normalized = String(value ?? '').toUpperCase();
    if (normalized === 'CRITICAL') return 'CRITICAL';
    if (normalized === 'HIGH') return 'HIGH';
    if (normalized === 'MEDIUM' || normalized === 'ELEVATED') return 'MEDIUM';
    if (normalized === 'LOW' || normalized === 'BUILDING') return 'LOW';
    return undefined;
  }
}

export function createChatEpisodicMemory(
  options: ChatEpisodicMemoryOptions = {},
  now: UnixMs = Date.now() as UnixMs,
): ChatEpisodicMemory {
  return new ChatEpisodicMemory(options, now);
}
