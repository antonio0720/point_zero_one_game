/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CALLBACK MEMORY
 * FILE: pzo-web/src/engines/chat/memory/CallbackMemory.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Stateful frontend callback planner and ledger for the unified chat runtime.
 * This module sits above quote retrieval and relationship continuity and below
 * authored response generation:
 *
 * - It ingests transcript events, relationship shifts, rescue pressure, and
 *   scene/mount changes.
 * - It plans callback opportunities without authoring final response text.
 * - It preserves callback memory across channel switches and mode transitions.
 * - It gives the UI and chat runtime a deterministic preview surface for
 *   “receipts,” helper reminders, rival obsessions, witness callbacks, and
 *   silence-worthy holds.
 *
 * Design laws
 * -----------
 * - Never author memory that is not grounded in transcript truth or upstream
 *   authoritative state.
 * - Prefer specific callback beats over generic “remember when” spam.
 * - Allow silence when the scene is stronger than immediate recall.
 * - Support both public and private callback classes.
 * - Stay deterministic enough for frontend preview, replay, and debugging.
 * ============================================================================
 */

import type {
  ChatChannelId,
  ChatEngineState,
  ChatMessage,
  ChatMountTarget,
  ChatPressureTier,
  ChatSceneId,
  JsonObject,
  UnixMs,
} from '../types';
import type {
  ChatCallbackCandidate,
  ChatCallbackContext,
  ChatCallbackId,
  ChatCallbackJoin,
  ChatCallbackKind,
  ChatCallbackLedgerSnapshot,
  ChatCallbackLifecycleState,
  ChatCallbackNarrativeIntent,
  ChatCallbackPlan,
  ChatCallbackPlanBeat,
  ChatCallbackPrivacyClass,
  ChatCallbackRecord,
  ChatCallbackSelectionResponse,
  ChatCallbackSuppressionReason,
  ChatCallbackTemplate,
  ChatCallbackTiming,
  ChatCallbackTransportEnvelope,
  ChatCallbackGeneratedPayloadKind,
  ChatCallbackRelationshipJoin,
  ChatCallbackQuoteJoin,
  ChatCallbackRescueJoin,
  DEFAULT_CHAT_CALLBACK_RULES,
  DEFAULT_CHAT_CALLBACK_TEMPLATES,
} from '../../../../shared/contracts/chat/ChatCallback';
import type {
  ChatQuoteRecord,
  ChatQuoteSelectionCandidate,
  ChatQuoteUseIntent,
} from '../../../../shared/contracts/chat/ChatQuote';
import type { LegacyChatRelationshipState } from './RelationshipState';
import type {
  RelationshipTrackerEvent,
  RelationshipTrackerSignal,
} from './RelationshipTracker';
import type {
  TrustGraphRecommendations,
  TrustGraphSnapshot,
} from './TrustGraph';
import {
  QuoteRecallIndex,
  type QuoteRecallHydrationOptions,
  type QuoteRecallSearchResult,
  type QuoteRecallSelectionQuery,
} from './QuoteRecallIndex';

// ============================================================================
// MARK: Config and state contracts
// ============================================================================

export const CHAT_CALLBACK_MEMORY_VERSION = '1.0.0' as const;
export const CHAT_CALLBACK_MEMORY_FILE_PATH =
  'pzo-web/src/engines/chat/memory/CallbackMemory.ts' as const;

export interface CallbackMemoryConfig {
  readonly maxRecords: number;
  readonly maxPlans: number;
  readonly maxCandidates: number;
  readonly maxPendingPerChannel: number;
  readonly staleRecordWindowMs: number;
  readonly suppressionCooldownMs: number;
  readonly rescueCallbackThreshold01: number;
  readonly rivalryCallbackThreshold01: number;
  readonly trustCallbackThreshold01: number;
  readonly callbackHoldWindowMs: number;
  readonly publicReceiptBias01: number;
  readonly privateReceiptBias01: number;
  readonly helperBias01: number;
  readonly rivalBias01: number;
  readonly witnessBias01: number;
  readonly silenceBias01: number;
  readonly postRunBias01: number;
  readonly carryoverBias01: number;
  readonly autoHydrateQuoteIndex: boolean;
  readonly autoRecordUses: boolean;
}

export const DEFAULT_CALLBACK_MEMORY_CONFIG: CallbackMemoryConfig = Object.freeze({
  maxRecords: 640,
  maxPlans: 220,
  maxCandidates: 240,
  maxPendingPerChannel: 24,
  staleRecordWindowMs: 1000 * 60 * 30,
  suppressionCooldownMs: 1000 * 35,
  rescueCallbackThreshold01: 0.56,
  rivalryCallbackThreshold01: 0.58,
  trustCallbackThreshold01: 0.60,
  callbackHoldWindowMs: 1000 * 10,
  publicReceiptBias01: 0.08,
  privateReceiptBias01: 0.12,
  helperBias01: 0.10,
  rivalBias01: 0.10,
  witnessBias01: 0.08,
  silenceBias01: 0.09,
  postRunBias01: 0.10,
  carryoverBias01: 0.08,
  autoHydrateQuoteIndex: true,
  autoRecordUses: true,
});

export type CallbackMemoryEventKind =
  | 'BOOTSTRAP'
  | 'MESSAGE'
  | 'MESSAGE_BATCH'
  | 'RELATIONSHIP_EVENT'
  | 'RELATIONSHIP_SIGNAL'
  | 'TRUST_GRAPH'
  | 'SCENE_CHANGE'
  | 'MOUNT_CHANGE'
  | 'RUN_END'
  | 'CHANNEL_CHANGE'
  | 'MANUAL_REBUILD';

export interface CallbackMemoryEvent {
  readonly kind: CallbackMemoryEventKind;
  readonly reason: string;
  readonly at: UnixMs;
  readonly engineState?: ChatEngineState | null;
  readonly message?: ChatMessage | null;
  readonly messages?: readonly ChatMessage[];
  readonly relationshipEvent?: RelationshipTrackerEvent | null;
  readonly relationshipSignal?: RelationshipTrackerSignal | null;
  readonly trustGraph?: TrustGraphSnapshot | null;
  readonly trustRecommendations?: TrustGraphRecommendations | null;
  readonly relationships?: readonly LegacyChatRelationshipState[];
  readonly channelId?: ChatChannelId | null;
  readonly sceneId?: ChatSceneId | null;
  readonly mountTarget?: ChatMountTarget | null;
  readonly pressureTier?: ChatPressureTier | null;
  readonly metadata?: JsonObject | null;
}

export interface CallbackMemorySnapshot {
  readonly createdAt: UnixMs;
  readonly totalCandidates: number;
  readonly totalPlans: number;
  readonly totalRecords: number;
  readonly pendingByChannel: Readonly<Record<string, number>>;
  readonly latestCandidateIds: readonly string[];
  readonly latestPlanIds: readonly string[];
  readonly latestRecordIds: readonly string[];
  readonly dominantCallbackKind?: ChatCallbackKind;
  readonly rescuePressure01: number;
  readonly rivalryPressure01: number;
  readonly trustPressure01: number;
  readonly silencePressure01: number;
}

export interface CallbackMemoryMutation {
  readonly reason: string;
  readonly addedCandidateIds: readonly string[];
  readonly addedPlanIds: readonly string[];
  readonly addedRecordIds: readonly string[];
  readonly updatedRecordIds: readonly string[];
  readonly removedRecordIds: readonly string[];
  readonly at: UnixMs;
  readonly snapshot: CallbackMemorySnapshot;
}

export type CallbackMemorySubscriber = (mutation: CallbackMemoryMutation) => void;

interface MutableCandidate extends ChatCallbackCandidate {}
interface MutablePlan extends ChatCallbackPlan {}
interface MutableRecord extends ChatCallbackRecord {}

// ============================================================================
// MARK: Primitive helpers
// ============================================================================

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

function nowMs(): UnixMs {
  return Date.now() as UnixMs;
}

function asArray<T>(value: readonly T[] | T[] | undefined | null): readonly T[] {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function candidateId(seed: string, at: UnixMs): ChatCallbackId {
  return `callback:${seed}:${at}` as ChatCallbackId;
}

function isShadowChannel(channelId?: ChatChannelId | null): boolean {
  return !!channelId && String(channelId).includes('SHADOW');
}

function bestPrivacyForChannel(channelId?: ChatChannelId | null): ChatCallbackPrivacyClass {
  if (!channelId) return 'PRIVATE';
  if (channelId === 'GLOBAL' || channelId === 'LOBBY') return 'PUBLIC';
  if (channelId === 'SYNDICATE' || channelId === 'DEAL_ROOM') return 'PRIVATE';
  if (isShadowChannel(channelId)) return 'SHADOW';
  return 'PRIVATE';
}

function bestTimingForReason(reason: string): ChatCallbackTiming {
  if (/run_end|post-run|postrun/i.test(reason)) return 'POST_RUN';
  if (/mount|scene|carryover/i.test(reason)) return 'NEXT_MODE';
  if (/silence|hold|wait/i.test(reason)) return 'REVEAL_WINDOW';
  if (/message|receipt|rival|helper/i.test(reason)) return 'FAST_FOLLOW';
  return 'IMMEDIATE';
}

function kindToIntent(kind: ChatCallbackKind): ChatCallbackNarrativeIntent {
  switch (kind) {
    case 'RELATIONSHIP': return 'WITNESS';
    case 'QUOTE': return 'REVEAL';
    case 'MEMORY': return 'INTERPRET';
    case 'RESCUE': return 'RESCUE';
    case 'NEGOTIATION': return 'REPRICE';
    case 'SCENE_REVEAL': return 'REVEAL';
    case 'POST_RUN': return 'MEMORIALIZE';
    case 'LEGEND': return 'MEMORIALIZE';
    case 'WORLD_EVENT': return 'FORESHADOW';
    case 'SYSTEM_RECEIPT': return 'WARN';
    default: return 'WITNESS';
  }
}

function kindToPayload(kind: ChatCallbackKind): ChatCallbackGeneratedPayloadKind {
  switch (kind) {
    case 'RELATIONSHIP': return 'RELATIONSHIP_CALLBACK';
    case 'QUOTE': return 'QUOTE_CALLBACK';
    case 'RESCUE': return 'HELPER_RESCUE';
    case 'POST_RUN': return 'POST_RUN_RITUAL';
    case 'WORLD_EVENT': return 'SYSTEM_SHADOW_MARKER';
    default: return 'RELATIONSHIP_CALLBACK';
  }
}

// ============================================================================
// MARK: CallbackMemory
// ============================================================================

export class CallbackMemory {
  private readonly config: CallbackMemoryConfig;
  private readonly quoteIndex: QuoteRecallIndex;
  private readonly subscribers = new Set<CallbackMemorySubscriber>();
  private readonly candidatesById = new Map<string, MutableCandidate>();
  private readonly plansById = new Map<string, MutablePlan>();
  private readonly recordsById = new Map<string, MutableRecord>();
  private readonly pendingIdsByChannel = new Map<string, string[]>();
  private lastTrustGraph?: TrustGraphSnapshot;
  private lastTrustRecommendations?: TrustGraphRecommendations;
  private lastRelationships: readonly LegacyChatRelationshipState[] = [];
  private lastEngineState?: ChatEngineState;
  private lastSceneId?: ChatSceneId | null;
  private lastMountTarget?: ChatMountTarget | null;
  private lastPressureTier?: ChatPressureTier | null;
  private lastProcessedAt?: UnixMs;

  public constructor(
    quoteIndex = new QuoteRecallIndex(),
    config: Partial<CallbackMemoryConfig> = {},
  ) {
    this.quoteIndex = quoteIndex;
    this.config = {
      ...DEFAULT_CALLBACK_MEMORY_CONFIG,
      ...config,
    };
  }

  public subscribe(subscriber: CallbackMemorySubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  public getQuoteIndex(): QuoteRecallIndex {
    return this.quoteIndex;
  }

  public clear(reason = 'clear'): void {
    const removedRecordIds = Array.from(this.recordsById.keys());
    this.candidatesById.clear();
    this.plansById.clear();
    this.recordsById.clear();
    this.pendingIdsByChannel.clear();
    this.emitMutation({
      reason,
      addedCandidateIds: [],
      addedPlanIds: [],
      addedRecordIds: [],
      updatedRecordIds: [],
      removedRecordIds,
      at: nowMs(),
      snapshot: this.snapshot(),
    });
  }

  public bootstrap(engineState: ChatEngineState, relationships: readonly LegacyChatRelationshipState[] = [], now: UnixMs = nowMs()): CallbackMemoryMutation {
    this.lastEngineState = engineState;
    this.lastRelationships = relationships;
    if (this.config.autoHydrateQuoteIndex) {
      const hydrate: QuoteRecallHydrationOptions = {
        engineState,
        relationships,
        replaceExisting: false,
        reason: 'callback-bootstrap',
        now,
      };
      this.quoteIndex.hydrate(hydrate);
    }
    return this.process({
      kind: 'BOOTSTRAP',
      reason: 'bootstrap',
      at: now,
      engineState,
      relationships,
      sceneId: (engineState as { activeSceneId?: ChatSceneId }).activeSceneId ?? null,
      mountTarget: (engineState as { mountTarget?: ChatMountTarget }).mountTarget ?? null,
      pressureTier: (engineState as { pressureTier?: ChatPressureTier }).pressureTier ?? null,
    });
  }

  public process(event: CallbackMemoryEvent): CallbackMemoryMutation {
    const at = event.at ?? nowMs();
    this.lastProcessedAt = at;
    if (event.engineState) this.lastEngineState = event.engineState;
    if (event.relationships) this.lastRelationships = event.relationships;
    if (event.trustGraph) this.lastTrustGraph = event.trustGraph;
    if (event.trustRecommendations) this.lastTrustRecommendations = event.trustRecommendations;
    if (event.sceneId !== undefined) this.lastSceneId = event.sceneId;
    if (event.mountTarget !== undefined) this.lastMountTarget = event.mountTarget;
    if (event.pressureTier !== undefined) this.lastPressureTier = event.pressureTier;

    const addedCandidateIds: string[] = [];
    const addedPlanIds: string[] = [];
    const addedRecordIds: string[] = [];
    const updatedRecordIds: string[] = [];
    const removedRecordIds: string[] = [];

    if (event.message) {
      if (this.config.autoHydrateQuoteIndex) {
        this.quoteIndex.ingestMessage(event.message, this.relationshipMap(this.lastRelationships), at, 'callback-memory-message');
      }
      const candidate = this.buildCandidateFromMessage(event.message, event, at);
      if (candidate) {
        this.candidatesById.set(candidate.callbackId, candidate);
        addedCandidateIds.push(candidate.callbackId);
        this.pushPending(candidate.channelId ?? null, candidate.callbackId);
        const plan = this.planFromCandidate(candidate, event, at);
        this.plansById.set(plan.planId, plan);
        addedPlanIds.push(plan.planId);
        const record = this.recordFromPlan(plan, at, 'PENDING');
        this.recordsById.set(record.callbackId, record);
        addedRecordIds.push(record.callbackId);
      }
    }

    for (const message of asArray(event.messages)) {
      if (this.config.autoHydrateQuoteIndex) {
        this.quoteIndex.ingestMessage(message, this.relationshipMap(this.lastRelationships), at, 'callback-memory-batch');
      }
      const candidate = this.buildCandidateFromMessage(message, event, at);
      if (!candidate) continue;
      this.candidatesById.set(candidate.callbackId, candidate);
      addedCandidateIds.push(candidate.callbackId);
      this.pushPending(candidate.channelId ?? null, candidate.callbackId);
      const plan = this.planFromCandidate(candidate, event, at);
      this.plansById.set(plan.planId, plan);
      addedPlanIds.push(plan.planId);
      const record = this.recordFromPlan(plan, at, 'PENDING');
      this.recordsById.set(record.callbackId, record);
      addedRecordIds.push(record.callbackId);
    }

    if (event.relationshipEvent) {
      const candidate = this.buildCandidateFromRelationshipEvent(event.relationshipEvent, event, at);
      if (candidate) {
        this.candidatesById.set(candidate.callbackId, candidate);
        addedCandidateIds.push(candidate.callbackId);
        this.pushPending(candidate.channelId ?? null, candidate.callbackId);
        const plan = this.planFromCandidate(candidate, event, at);
        this.plansById.set(plan.planId, plan);
        addedPlanIds.push(plan.planId);
        const record = this.recordFromPlan(plan, at, 'PLANNED');
        this.recordsById.set(record.callbackId, record);
        addedRecordIds.push(record.callbackId);
      }
    }

    if (event.relationshipSignal) {
      const candidate = this.buildCandidateFromRelationshipSignal(event.relationshipSignal, event, at);
      if (candidate) {
        this.candidatesById.set(candidate.callbackId, candidate);
        addedCandidateIds.push(candidate.callbackId);
        this.pushPending(candidate.channelId ?? null, candidate.callbackId);
        const plan = this.planFromCandidate(candidate, event, at);
        this.plansById.set(plan.planId, plan);
        addedPlanIds.push(plan.planId);
        const record = this.recordFromPlan(plan, at, 'PLANNED');
        this.recordsById.set(record.callbackId, record);
        addedRecordIds.push(record.callbackId);
      }
    }

    if (event.trustRecommendations) {
      const trustCandidates = this.buildCandidatesFromTrust(event.trustRecommendations, event, at);
      for (const candidate of trustCandidates) {
        this.candidatesById.set(candidate.callbackId, candidate);
        addedCandidateIds.push(candidate.callbackId);
        this.pushPending(candidate.channelId ?? null, candidate.callbackId);
        const plan = this.planFromCandidate(candidate, event, at);
        this.plansById.set(plan.planId, plan);
        addedPlanIds.push(plan.planId);
        const record = this.recordFromPlan(plan, at, 'PLANNED');
        this.recordsById.set(record.callbackId, record);
        addedRecordIds.push(record.callbackId);
      }
    }

    if (event.kind === 'RUN_END') {
      const candidate = this.buildPostRunCandidate(event, at);
      if (candidate) {
        this.candidatesById.set(candidate.callbackId, candidate);
        addedCandidateIds.push(candidate.callbackId);
        const plan = this.planFromCandidate(candidate, event, at);
        this.plansById.set(plan.planId, plan);
        addedPlanIds.push(plan.planId);
        const record = this.recordFromPlan(plan, at, 'PLANNED');
        this.recordsById.set(record.callbackId, record);
        addedRecordIds.push(record.callbackId);
      }
    }

    const sweep = this.prune(at);
    updatedRecordIds.push(...sweep.updatedRecordIds);
    removedRecordIds.push(...sweep.removedRecordIds);

    const mutation: CallbackMemoryMutation = {
      reason: event.reason,
      addedCandidateIds,
      addedPlanIds,
      addedRecordIds,
      updatedRecordIds,
      removedRecordIds,
      at,
      snapshot: this.snapshot(at),
    };
    this.emitMutation(mutation);
    return mutation;
  }

  public searchQuotes(query: QuoteRecallSelectionQuery, now: UnixMs = nowMs()): QuoteRecallSearchResult {
    return this.quoteIndex.search(query, now);
  }

  public markPlanEmitted(planId: string, at: UnixMs = nowMs(), notes: readonly string[] = []): void {
    const plan = this.plansById.get(planId);
    if (!plan) return;
    const record = this.recordsById.get(plan.callbackId);
    if (!record) return;
    this.recordsById.set(plan.callbackId, {
      ...record,
      lifecycleState: 'EMITTED',
      updatedAt: at,
      notes: uniqueStrings([...(record.notes ?? []), ...notes]),
    });
    if (this.config.autoRecordUses) {
      for (const beat of plan.beats) {
        const primary = beat.quoteJoin?.selectedQuoteCandidate;
        if (primary?.quoteId) {
          this.quoteIndex.rememberUse(
            primary.quoteId,
            (primary.useIntent ?? 'RECALL') as ChatQuoteUseIntent,
            plan.callbackKind,
            plan.context,
            ['plan-emitted', ...notes],
            at,
          );
        }
      }
    }
  }

  public markPlanSuppressed(
    planId: string,
    suppressionReason: ChatCallbackSuppressionReason,
    at: UnixMs = nowMs(),
    notes: readonly string[] = [],
  ): void {
    const plan = this.plansById.get(planId);
    if (!plan) return;
    const record = this.recordsById.get(plan.callbackId);
    if (!record) return;
    this.recordsById.set(plan.callbackId, {
      ...record,
      lifecycleState: 'SUPPRESSED',
      suppressionReason,
      updatedAt: at,
      notes: uniqueStrings([...(record.notes ?? []), ...notes]),
    });
  }

  public getPendingForChannel(channelId?: ChatChannelId | null): readonly ChatCallbackRecord[] {
    const ids = this.pendingIdsByChannel.get(String(channelId ?? 'UNSCOPED')) ?? [];
    return ids.map((id) => this.recordsById.get(id)).filter(Boolean) as ChatCallbackRecord[];
  }

  public getRecords(): readonly ChatCallbackRecord[] {
    return Array.from(this.recordsById.values()).sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  }

  public getPlans(): readonly ChatCallbackPlan[] {
    return Array.from(this.plansById.values()).sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  }

  public snapshot(at: UnixMs = nowMs()): CallbackMemorySnapshot {
    const pendingByChannel: Record<string, number> = {};
    for (const [channelId, ids] of this.pendingIdsByChannel.entries()) {
      pendingByChannel[channelId] = ids.length;
    }
    const records = this.getRecords();
    const plans = this.getPlans();
    const candidates = Array.from(this.candidatesById.values()).sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
    const kindCounts: Record<string, number> = {};
    for (const record of records) {
      kindCounts[record.callbackKind] = (kindCounts[record.callbackKind] ?? 0) + 1;
    }
    const dominantCallbackKind = Object.entries(kindCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as ChatCallbackKind | undefined;
    const rescuePressure01 = clamp01((this.lastTrustRecommendations?.rescueCandidate?.rescue01 ?? 0) + (this.lastTrustRecommendations?.shouldShiftPrivate ? 0.08 : 0));
    const rivalryPressure01 = clamp01((this.lastTrustRecommendations?.rivalryCandidate?.rivalry01 ?? 0) + (this.lastTrustRecommendations?.shouldEscalateCrowd ? 0.08 : 0));
    const trustPressure01 = clamp01(this.lastTrustRecommendations?.trustCandidate?.trust01 ?? 0);
    const silencePressure01 = clamp01(this.lastTrustRecommendations?.shouldHoldSilence ? 0.76 : 0.18);
    return {
      createdAt: at,
      totalCandidates: candidates.length,
      totalPlans: plans.length,
      totalRecords: records.length,
      pendingByChannel,
      latestCandidateIds: candidates.slice(0, 24).map((candidate) => candidate.callbackId),
      latestPlanIds: plans.slice(0, 24).map((plan) => plan.planId),
      latestRecordIds: records.slice(0, 24).map((record) => record.callbackId),
      dominantCallbackKind,
      rescuePressure01,
      rivalryPressure01,
      trustPressure01,
      silencePressure01,
    };
  }

  public toLedgerSnapshot(at: UnixMs = nowMs()): ChatCallbackLedgerSnapshot {
    const records = this.getRecords();
    return {
      ledgerId: `ledger:${at}` as ChatCallbackLedgerSnapshot['ledgerId'],
      createdAt: at,
      updatedAt: at,
      records,
      plans: this.getPlans(),
      pendingByChannel: Object.fromEntries(this.pendingIdsByChannel.entries()),
      snapshotMetadata: this.snapshot(at) as unknown as JsonObject,
    } as ChatCallbackLedgerSnapshot;
  }

  public toTransportEnvelope(at: UnixMs = nowMs()): ChatCallbackTransportEnvelope {
    return {
      version: CHAT_CALLBACK_MEMORY_VERSION,
      createdAt: at,
      ledger: this.toLedgerSnapshot(at),
    } as ChatCallbackTransportEnvelope;
  }

  private buildCandidateFromMessage(message: ChatMessage, event: CallbackMemoryEvent, at: UnixMs): MutableCandidate | undefined {
    const body = String((message as { body?: string; text?: string }).body ?? (message as { text?: string }).text ?? '').trim();
    if (!body) return undefined;
    const channelId = String((message as { channelId?: string }).channelId ?? event.channelId ?? 'GLOBAL') as ChatChannelId;
    const privacyClass = bestPrivacyForChannel(channelId);
    const useIntent = this.inferUseIntentFromBody(body, channelId);
    const quoteJoin = this.quoteIndex.buildQuoteJoin({
      text: body,
      exactText: body.length <= 72 ? body : undefined,
      channelId,
      sceneId: (safeString((message as { sceneId?: string }).sceneId) ?? event.sceneId ?? null) as ChatSceneId | null,
      counterpartId: safeString((message as { counterpartId?: string; actorId?: string }).counterpartId)
        ?? safeString((message as { actorId?: string }).actorId)
        ?? null,
      pressureTier: ((message as { pressureTier?: ChatPressureTier }).pressureTier ?? event.pressureTier ?? null),
      useIntent,
      privacyClass,
    }, at);
    if (!quoteJoin.primaryQuote && body.length < 14) return undefined;

    const kind = this.inferKindFromMessage(body, channelId, privacyClass);
    const callbackId = candidateId(`msg:${safeString((message as { messageId?: string; id?: string }).messageId) ?? safeString((message as { id?: string }).id) ?? body.slice(0, 12)}`, at);
    return {
      callbackId,
      callbackKind: kind,
      context: this.buildContext(event, channelId, privacyClass, kind, at, {
        targetActorId: safeString((message as { actorId?: string; speakerId?: string }).actorId)
          ?? safeString((message as { speakerId?: string }).speakerId)
          ?? null,
        counterpartId: safeString((message as { counterpartId?: string; actorId?: string }).counterpartId)
          ?? safeString((message as { actorId?: string }).actorId)
          ?? null,
        sceneId: safeString((message as { sceneId?: string }).sceneId) ?? event.sceneId ?? null,
        pressureTier: ((message as { pressureTier?: ChatPressureTier }).pressureTier ?? event.pressureTier ?? null),
      }),
      relationshipJoin: this.buildRelationshipJoinFromMessage(message),
      quoteJoin,
      memoryJoin: {
        memoryAnchorId: null,
        memoryEventType: null,
        candidateMemories: [],
      },
      rescueJoin: this.buildRescueJoin(),
      narrativeIntent: kindToIntent(kind),
      score01: this.candidateScore(kind, privacyClass, body, quoteJoin),
      reasons: uniqueStrings([
        'message-grounded',
        kind.toLowerCase(),
        privacyClass.toLowerCase(),
        ...(quoteJoin.primaryQuote ? ['quote-available'] : []),
      ]),
      templateId: this.selectTemplateId(kind),
      createdAt: at,
      updatedAt: at,
      lifecycleState: 'PENDING',
      suppressionReason: 'NONE',
      tags: uniqueStrings([
        channelId.toLowerCase(),
        kind.toLowerCase(),
        useIntent.toLowerCase(),
      ]),
      channelId,
      sceneId: (safeString((message as { sceneId?: string }).sceneId) ?? event.sceneId ?? null) as ChatSceneId | null,
      mountTarget: (safeString((message as { mountTarget?: string }).mountTarget) ?? event.mountTarget ?? null) as ChatMountTarget | null,
      previewText: body.slice(0, 180),
    } as MutableCandidate;
  }

  private buildCandidateFromRelationshipEvent(
    relationshipEvent: RelationshipTrackerEvent,
    event: CallbackMemoryEvent,
    at: UnixMs,
  ): MutableCandidate | undefined {
    const counterpartId = relationshipEvent.counterpartId;
    if (!counterpartId) return undefined;
    const relationship = this.lastRelationships.find((item) => item.counterpartId === counterpartId);
    const channelId = (relationshipEvent.channelId ?? event.channelId ?? 'GLOBAL') as ChatChannelId;
    const privacyClass = bestPrivacyForChannel(channelId);
    const useIntent = relationshipEvent.kind.includes('RESCUE') ? 'GUIDE' : 'RECALL';
    const quoteJoin = this.quoteIndex.buildQuoteJoin({
      counterpartId,
      channelId,
      pressureTier: event.pressureTier ?? null,
      useIntent,
      privacyClass,
    }, at);
    const kind: ChatCallbackKind = relationshipEvent.kind.includes('RESCUE')
      ? 'RESCUE'
      : relationshipEvent.kind.includes('RIVAL')
      ? 'RELATIONSHIP'
      : 'MEMORY';
    const callbackId = candidateId(`rel:${counterpartId}:${relationshipEvent.kind}`, at);
    return {
      callbackId,
      callbackKind: kind,
      context: this.buildContext(event, channelId, privacyClass, kind, at, {
        counterpartId,
        pressureTier: event.pressureTier ?? null,
        sceneId: event.sceneId ?? null,
      }),
      relationshipJoin: this.buildRelationshipJoin(relationship),
      quoteJoin,
      memoryJoin: {
        memoryAnchorId: null,
        memoryEventType: null,
        candidateMemories: [],
      },
      rescueJoin: this.buildRescueJoin(relationship),
      narrativeIntent: kindToIntent(kind),
      score01: clamp01((relationshipEvent.intensity01 ?? 0.52) + (kind === 'RESCUE' ? this.config.helperBias01 : this.config.rivalBias01)),
      reasons: uniqueStrings([
        'relationship-event',
        relationshipEvent.kind.toLowerCase(),
        counterpartId,
      ]),
      templateId: this.selectTemplateId(kind),
      createdAt: at,
      updatedAt: at,
      lifecycleState: 'PENDING',
      suppressionReason: 'NONE',
      tags: uniqueStrings(['relationship', relationshipEvent.kind.toLowerCase(), counterpartId]),
      channelId,
      sceneId: (event.sceneId ?? null) as ChatSceneId | null,
      mountTarget: (event.mountTarget ?? null) as ChatMountTarget | null,
      previewText: relationshipEvent.summary ?? `Relationship callback for ${counterpartId}`,
    } as MutableCandidate;
  }

  private buildCandidateFromRelationshipSignal(
    relationshipSignal: RelationshipTrackerSignal,
    event: CallbackMemoryEvent,
    at: UnixMs,
  ): MutableCandidate | undefined {
    const counterpartId = relationshipSignal.counterpartId;
    const relationship = this.lastRelationships.find((item) => item.counterpartId === counterpartId);
    const channelId = (relationshipSignal.channelId ?? event.channelId ?? 'GLOBAL') as ChatChannelId;
    const privacyClass = bestPrivacyForChannel(channelId);
    const kind: ChatCallbackKind = relationshipSignal.kind.includes('RESCUE') ? 'RESCUE' : 'RELATIONSHIP';
    const callbackId = candidateId(`signal:${counterpartId}:${relationshipSignal.kind}`, at);
    return {
      callbackId,
      callbackKind: kind,
      context: this.buildContext(event, channelId, privacyClass, kind, at, {
        counterpartId,
        pressureTier: event.pressureTier ?? null,
      }),
      relationshipJoin: this.buildRelationshipJoin(relationship),
      quoteJoin: this.quoteIndex.buildQuoteJoin({
        counterpartId,
        channelId,
        pressureTier: event.pressureTier ?? null,
        useIntent: kind === 'RESCUE' ? 'GUIDE' : 'RECALL',
        privacyClass,
      }, at),
      memoryJoin: {
        memoryAnchorId: null,
        memoryEventType: null,
        candidateMemories: [],
      },
      rescueJoin: this.buildRescueJoin(relationship),
      narrativeIntent: kindToIntent(kind),
      score01: clamp01(relationshipSignal.weight01 ?? 0.5),
      reasons: uniqueStrings(['relationship-signal', relationshipSignal.kind.toLowerCase(), counterpartId]),
      templateId: this.selectTemplateId(kind),
      createdAt: at,
      updatedAt: at,
      lifecycleState: 'PENDING',
      suppressionReason: 'NONE',
      tags: uniqueStrings(['signal', relationshipSignal.kind.toLowerCase(), counterpartId]),
      channelId,
      sceneId: (event.sceneId ?? null) as ChatSceneId | null,
      mountTarget: (event.mountTarget ?? null) as ChatMountTarget | null,
      previewText: relationshipSignal.label ?? `Signal callback for ${counterpartId}`,
    } as MutableCandidate;
  }

  private buildCandidatesFromTrust(
    trust: TrustGraphRecommendations,
    event: CallbackMemoryEvent,
    at: UnixMs,
  ): MutableCandidate[] {
    const result: MutableCandidate[] = [];
    const dominantChannel = trust.dominantChannel as ChatChannelId;

    if (trust.rescueCandidate && trust.rescueCandidate.rescue01 >= this.config.rescueCallbackThreshold01) {
      const relationship = this.lastRelationships.find((item) => item.counterpartId === trust.rescueCandidate?.counterpartId);
      const kind: ChatCallbackKind = 'RESCUE';
      const privacyClass: ChatCallbackPrivacyClass = trust.shouldShiftPrivate ? 'HELPER_ONLY' : bestPrivacyForChannel(dominantChannel);
      result.push({
        callbackId: candidateId(`trust:rescue:${trust.rescueCandidate.counterpartId}`, at),
        callbackKind: kind,
        context: this.buildContext(event, dominantChannel, privacyClass, kind, at, {
          counterpartId: trust.rescueCandidate.counterpartId,
          pressureTier: event.pressureTier ?? null,
        }),
        relationshipJoin: this.buildRelationshipJoin(relationship),
        quoteJoin: this.quoteIndex.buildQuoteJoin({
          counterpartId: trust.rescueCandidate.counterpartId,
          channelId: dominantChannel,
          useIntent: 'GUIDE',
          privacyClass,
          pressureTier: event.pressureTier ?? null,
        }, at),
        memoryJoin: { memoryAnchorId: null, memoryEventType: null, candidateMemories: [] },
        rescueJoin: this.buildRescueJoin(relationship),
        narrativeIntent: 'RESCUE',
        score01: clamp01(trust.rescueCandidate.rescue01 + this.config.helperBias01),
        reasons: uniqueStrings(['trust-rescue', ...trust.reasons]),
        templateId: this.selectTemplateId(kind),
        createdAt: at,
        updatedAt: at,
        lifecycleState: 'PENDING',
        suppressionReason: trust.shouldHoldSilence ? 'HELPER_WAITING' : 'NONE',
        tags: uniqueStrings(['trust', 'rescue', trust.rescueCandidate.counterpartId]),
        channelId: dominantChannel,
        sceneId: (event.sceneId ?? null) as ChatSceneId | null,
        mountTarget: (event.mountTarget ?? null) as ChatMountTarget | null,
        previewText: `Helper callback leaning toward ${trust.rescueCandidate.counterpartId}`,
      } as MutableCandidate);
    }

    if (trust.rivalryCandidate && trust.rivalryCandidate.rivalry01 >= this.config.rivalryCallbackThreshold01) {
      const relationship = this.lastRelationships.find((item) => item.counterpartId === trust.rivalryCandidate?.counterpartId);
      const kind: ChatCallbackKind = 'QUOTE';
      const privacyClass = bestPrivacyForChannel(dominantChannel);
      result.push({
        callbackId: candidateId(`trust:rival:${trust.rivalryCandidate.counterpartId}`, at),
        callbackKind: kind,
        context: this.buildContext(event, dominantChannel, privacyClass, kind, at, {
          counterpartId: trust.rivalryCandidate.counterpartId,
          pressureTier: event.pressureTier ?? null,
        }),
        relationshipJoin: this.buildRelationshipJoin(relationship),
        quoteJoin: this.quoteIndex.buildQuoteJoin({
          counterpartId: trust.rivalryCandidate.counterpartId,
          channelId: dominantChannel,
          useIntent: 'HUMILIATE',
          privacyClass,
          pressureTier: event.pressureTier ?? null,
        }, at),
        memoryJoin: { memoryAnchorId: null, memoryEventType: null, candidateMemories: [] },
        rescueJoin: this.buildRescueJoin(relationship),
        narrativeIntent: 'HUMILIATE',
        score01: clamp01(trust.rivalryCandidate.rivalry01 + this.config.rivalBias01 + (trust.shouldEscalateCrowd ? this.config.publicReceiptBias01 : 0)),
        reasons: uniqueStrings(['trust-rivalry', ...trust.reasons]),
        templateId: this.selectTemplateId(kind),
        createdAt: at,
        updatedAt: at,
        lifecycleState: 'PENDING',
        suppressionReason: trust.shouldHoldSilence ? 'RIVAL_HOLDING' : 'NONE',
        tags: uniqueStrings(['trust', 'rivalry', trust.rivalryCandidate.counterpartId]),
        channelId: dominantChannel,
        sceneId: (event.sceneId ?? null) as ChatSceneId | null,
        mountTarget: (event.mountTarget ?? null) as ChatMountTarget | null,
        previewText: `Rival callback leaning toward ${trust.rivalryCandidate.counterpartId}`,
      } as MutableCandidate);
    }

    if (trust.shouldHoldSilence) {
      const kind: ChatCallbackKind = 'SCENE_REVEAL';
      result.push({
        callbackId: candidateId('trust:silence-hold', at),
        callbackKind: kind,
        context: this.buildContext(event, dominantChannel, 'SHADOW', kind, at, {
          pressureTier: event.pressureTier ?? null,
          sceneId: event.sceneId ?? null,
        }),
        relationshipJoin: this.buildRelationshipJoin(undefined),
        quoteJoin: { primaryQuote: null, candidateQuotes: [], selectedQuoteCandidate: null, quoteReference: null },
        memoryJoin: { memoryAnchorId: null, memoryEventType: null, candidateMemories: [] },
        rescueJoin: this.buildRescueJoin(),
        narrativeIntent: 'REVEAL',
        score01: clamp01(this.config.silenceBias01 + 0.54),
        reasons: uniqueStrings(['trust-silence', ...trust.reasons]),
        templateId: this.selectTemplateId(kind),
        createdAt: at,
        updatedAt: at,
        lifecycleState: 'PENDING',
        suppressionReason: 'SILENCE_WINDOW',
        tags: uniqueStrings(['trust', 'silence']),
        channelId: dominantChannel,
        sceneId: (event.sceneId ?? null) as ChatSceneId | null,
        mountTarget: (event.mountTarget ?? null) as ChatMountTarget | null,
        previewText: 'Hold callback beat. Let silence do work.',
      } as MutableCandidate);
    }

    return result;
  }

  private buildPostRunCandidate(event: CallbackMemoryEvent, at: UnixMs): MutableCandidate | undefined {
    const channelId = (event.channelId ?? 'GLOBAL') as ChatChannelId;
    const kind: ChatCallbackKind = 'POST_RUN';
    const privacyClass = bestPrivacyForChannel(channelId);
    return {
      callbackId: candidateId('post-run', at),
      callbackKind: kind,
      context: this.buildContext(event, channelId, privacyClass, kind, at, {
        sceneId: event.sceneId ?? null,
        pressureTier: event.pressureTier ?? null,
      }),
      relationshipJoin: this.buildRelationshipJoin(undefined),
      quoteJoin: this.quoteIndex.buildQuoteJoin({
        channelId,
        useIntent: 'INTERPRET',
        privacyClass,
        pressureTier: event.pressureTier ?? null,
      }, at),
      memoryJoin: { memoryAnchorId: null, memoryEventType: null, candidateMemories: [] },
      rescueJoin: this.buildRescueJoin(),
      narrativeIntent: 'MEMORIALIZE',
      score01: clamp01(0.55 + this.config.postRunBias01),
      reasons: ['post-run-ritual'],
      templateId: this.selectTemplateId(kind),
      createdAt: at,
      updatedAt: at,
      lifecycleState: 'PENDING',
      suppressionReason: 'NONE',
      tags: ['post-run', 'ritual'],
      channelId,
      sceneId: (event.sceneId ?? null) as ChatSceneId | null,
      mountTarget: (event.mountTarget ?? null) as ChatMountTarget | null,
      previewText: 'Post-run callback ritual ready.',
    } as MutableCandidate;
  }

  private planFromCandidate(candidate: MutableCandidate, event: CallbackMemoryEvent, at: UnixMs): MutablePlan {
    const template = this.selectTemplate(candidate);
    const beat = this.buildPlanBeat(candidate, template, event, at);
    return {
      planId: `plan:${candidate.callbackId}` as ChatCallbackPlan['planId'],
      callbackId: candidate.callbackId,
      callbackKind: candidate.callbackKind,
      narrativeIntent: candidate.narrativeIntent,
      payloadKind: kindToPayload(candidate.callbackKind),
      timing: bestTimingForReason(event.reason),
      privacyClass: candidate.context.privacyClass,
      score01: candidate.score01,
      context: candidate.context,
      beats: [beat],
      createdAt: at,
      updatedAt: at,
      tags: candidate.tags,
      notes: candidate.reasons,
    } as MutablePlan;
  }

  private buildPlanBeat(
    candidate: MutableCandidate,
    template: ChatCallbackTemplate,
    event: CallbackMemoryEvent,
    at: UnixMs,
  ): ChatCallbackPlanBeat {
    return {
      beatId: `beat:${candidate.callbackId}` as ChatCallbackPlanBeat['beatId'],
      order: 0,
      timing: bestTimingForReason(event.reason),
      privacyClass: candidate.context.privacyClass,
      payloadKind: kindToPayload(candidate.callbackKind),
      openingHint: template.openingHint ?? undefined,
      bodyHint: template.bodyHint,
      closingHint: template.closingHint ?? undefined,
      quoteJoin: candidate.quoteJoin,
      relationshipJoin: candidate.relationshipJoin,
      rescueJoin: candidate.rescueJoin,
      suppressionReason: candidate.suppressionReason,
      createdAt: at,
      notes: candidate.reasons,
    } as ChatCallbackPlanBeat;
  }

  private recordFromPlan(plan: MutablePlan, at: UnixMs, lifecycleState: ChatCallbackLifecycleState): MutableRecord {
    return {
      callbackId: plan.callbackId,
      planId: plan.planId,
      callbackKind: plan.callbackKind,
      lifecycleState,
      suppressionReason: 'NONE',
      context: plan.context,
      score01: plan.score01,
      beats: plan.beats,
      createdAt: at,
      updatedAt: at,
      notes: plan.notes,
      tags: plan.tags,
    } as MutableRecord;
  }

  private buildContext(
    event: CallbackMemoryEvent,
    channelId: ChatChannelId,
    privacyClass: ChatCallbackPrivacyClass,
    kind: ChatCallbackKind,
    at: UnixMs,
    overrides: Partial<ChatCallbackContext> = {},
  ): ChatCallbackContext {
    return {
      requestId: `callback-memory:${kind}:${at}` as ChatCallbackContext['requestId'],
      createdAt: at,
      roomId: overrides.roomId ?? null,
      channelId,
      playerId: overrides.playerId ?? null,
      targetActorId: overrides.targetActorId ?? null,
      targetActorKind: overrides.targetActorKind ?? null,
      counterpartId: overrides.counterpartId ?? null,
      counterpartKind: overrides.counterpartKind ?? null,
      sceneId: overrides.sceneId ?? event.sceneId ?? null,
      sceneArchetype: overrides.sceneArchetype ?? null,
      sceneRole: overrides.sceneRole ?? null,
      momentType: overrides.momentType ?? null,
      pressureTier: overrides.pressureTier ?? event.pressureTier ?? null,
      privacyClass,
      requestedIntent: overrides.requestedIntent ?? kindToIntent(kind),
      useIntent: overrides.useIntent ?? this.defaultUseIntent(kind),
      allowQuoteReuse: overrides.allowQuoteReuse ?? true,
      allowRelationshipReuse: overrides.allowRelationshipReuse ?? true,
      allowMemoryReuse: overrides.allowMemoryReuse ?? true,
      allowPublicReceipt: overrides.allowPublicReceipt ?? privacyClass === 'PUBLIC',
      allowSilentOutcome: overrides.allowSilentOutcome ?? true,
      tags: uniqueStrings([
        kind.toLowerCase(),
        channelId.toLowerCase(),
        ...(event.kind ? [event.kind.toLowerCase()] : []),
        ...asArray(overrides.tags),
      ]),
    } as ChatCallbackContext;
  }

  private buildRelationshipJoin(relationship?: LegacyChatRelationshipState): ChatCallbackRelationshipJoin {
    return {
      relationshipId: relationship ? (`rel:${relationship.counterpartId}` as ChatCallbackRelationshipJoin['relationshipId']) : null,
      counterpartState: relationship ? (relationship as unknown as ChatCallbackRelationshipJoin['counterpartState']) : null,
      relationshipSnapshot: null,
      callbackHints: [],
    };
  }

  private buildRelationshipJoinFromMessage(message: ChatMessage): ChatCallbackRelationshipJoin {
    const counterpartId = String((message as { counterpartId?: string; actorId?: string; speakerId?: string }).counterpartId
      ?? (message as { actorId?: string }).actorId
      ?? (message as { speakerId?: string }).speakerId
      ?? '').trim();
    const relationship = this.lastRelationships.find((item) => item.counterpartId === counterpartId);
    return this.buildRelationshipJoin(relationship);
  }

  private buildRescueJoin(relationship?: LegacyChatRelationshipState): ChatCallbackRescueJoin {
    return {
      interventionId: null,
      rescueDebt01: relationship ? clamp01(relationship.rescueDebt / 100) : 0,
      frustration01: relationship ? clamp01((100 - relationship.adviceObedience) / 100) : 0.18,
      attachment01: relationship ? clamp01((relationship.trust + relationship.familiarity) / 200) : 0.12,
      trustNeed01: relationship ? clamp01((100 - relationship.trust) / 100) : 0.38,
    };
  }

  private inferKindFromMessage(body: string, channelId: ChatChannelId, privacyClass: ChatCallbackPrivacyClass): ChatCallbackKind {
    if (/\b(remember|you said|last time|again)\b/i.test(body)) return 'QUOTE';
    if (/\b(help|breathe|recover|hold|wait)\b/i.test(body)) return 'RESCUE';
    if (channelId === 'DEAL_ROOM') return 'NEGOTIATION';
    if (privacyClass === 'SHADOW') return 'SCENE_REVEAL';
    return 'RELATIONSHIP';
  }

  private inferUseIntentFromBody(body: string, channelId: ChatChannelId): ChatQuoteUseIntent {
    if (/\b(help|recover|breathe|wait|hold)\b/i.test(body)) return 'GUIDE';
    if (/\b(remember|you said|last time|receipt)\b/i.test(body)) return 'RECALL';
    if (channelId === 'DEAL_ROOM') return 'NEGOTIATE';
    if (/\b(weak|easy|mine|fold)\b/i.test(body)) return 'HUMILIATE';
    return 'RECALL';
  }

  private candidateScore(
    kind: ChatCallbackKind,
    privacyClass: ChatCallbackPrivacyClass,
    body: string,
    quoteJoin: ChatCallbackQuoteJoin,
  ): number {
    let score = 0.42;
    if (kind === 'RESCUE') score += this.config.helperBias01;
    if (kind === 'QUOTE') score += this.config.rivalBias01 * 0.5;
    if (kind === 'NEGOTIATION') score += 0.10;
    if (privacyClass === 'PUBLIC') score += this.config.publicReceiptBias01;
    if (privacyClass === 'PRIVATE' || privacyClass === 'HELPER_ONLY') score += this.config.privateReceiptBias01;
    if (quoteJoin.primaryQuote) score += 0.08;
    if (/\b(remember|again|last time|you said)\b/i.test(body)) score += 0.08;
    return clamp01(score);
  }

  private defaultUseIntent(kind: ChatCallbackKind): ChatQuoteUseIntent {
    switch (kind) {
      case 'RESCUE': return 'GUIDE';
      case 'NEGOTIATION': return 'NEGOTIATE';
      case 'QUOTE': return 'RECALL';
      case 'POST_RUN': return 'INTERPRET';
      default: return 'RECALL';
    }
  }

  private selectTemplateId(kind: ChatCallbackKind): string {
    const template = DEFAULT_CHAT_CALLBACK_TEMPLATES.find((item) => item.callbackKind === kind);
    return template?.templateId ?? `template:${kind.toLowerCase()}`;
  }

  private selectTemplate(candidate: MutableCandidate): ChatCallbackTemplate {
    return DEFAULT_CHAT_CALLBACK_TEMPLATES.find((item) => item.templateId === candidate.templateId)
      ?? DEFAULT_CHAT_CALLBACK_TEMPLATES.find((item) => item.callbackKind === candidate.callbackKind)
      ?? DEFAULT_CHAT_CALLBACK_TEMPLATES[0];
  }

  private pushPending(channelId: ChatChannelId | null, callbackId: string): void {
    const key = String(channelId ?? 'UNSCOPED');
    const current = this.pendingIdsByChannel.get(key) ?? [];
    if (!current.includes(callbackId)) current.push(callbackId);
    this.pendingIdsByChannel.set(key, current.slice(-this.config.maxPendingPerChannel));
  }

  private relationshipMap(relationships: readonly LegacyChatRelationshipState[]): ReadonlyMap<string, LegacyChatRelationshipState> {
    const map = new Map<string, LegacyChatRelationshipState>();
    for (const relationship of relationships) map.set(relationship.counterpartId, relationship);
    return map;
  }

  private prune(at: UnixMs): { updatedRecordIds: string[]; removedRecordIds: string[] } {
    const updatedRecordIds: string[] = [];
    const removedRecordIds: string[] = [];
    const cutoff = Number(at) - this.config.staleRecordWindowMs;
    const records = this.getRecords();
    for (const record of records) {
      if (Number(record.updatedAt) >= cutoff) continue;
      if (record.lifecycleState === 'EMITTED' || record.lifecycleState === 'ARCHIVED') continue;
      const nextState: MutableRecord = {
        ...record,
        lifecycleState: 'ARCHIVED',
        updatedAt: at,
        notes: uniqueStrings([...(record.notes ?? []), 'auto-archived']),
      };
      this.recordsById.set(record.callbackId, nextState);
      updatedRecordIds.push(record.callbackId);
    }

    const overflow = this.getRecords().slice(this.config.maxRecords);
    for (const record of overflow) {
      this.recordsById.delete(record.callbackId);
      removedRecordIds.push(record.callbackId);
    }
    const excessPlans = this.getPlans().slice(this.config.maxPlans);
    for (const plan of excessPlans) this.plansById.delete(plan.planId);
    const excessCandidates = Array.from(this.candidatesById.values())
      .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
      .slice(this.config.maxCandidates);
    for (const candidate of excessCandidates) this.candidatesById.delete(candidate.callbackId);

    return { updatedRecordIds, removedRecordIds };
  }

  private emitMutation(mutation: CallbackMemoryMutation): void {
    for (const subscriber of this.subscribers) {
      subscriber(mutation);
    }
  }
}

// ============================================================================
// MARK: Convenience builders
// ============================================================================

export function buildCallbackMemory(
  quoteIndex = new QuoteRecallIndex(),
  config: Partial<CallbackMemoryConfig> = {},
): CallbackMemory {
  return new CallbackMemory(quoteIndex, config);
}

export const CHAT_CALLBACK_MEMORY_MANIFEST = Object.freeze({
  version: CHAT_CALLBACK_MEMORY_VERSION,
  filePath: CHAT_CALLBACK_MEMORY_FILE_PATH,
  exports: ['CallbackMemory', 'buildCallbackMemory'] as const,
  authorities: {
    sharedContractsRoot: '/shared/contracts/chat',
    frontendEngineRoot: '/pzo-web/src/engines/chat',
    backendEngineRoot: '/backend/src/game/engine/chat',
    serverTransportRoot: '/pzo-server/src/chat',
  },
});
