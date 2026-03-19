
/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT RELATIONSHIP TRACKER
 * FILE: pzo-web/src/engines/chat/memory/RelationshipTracker.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Stateful relationship orchestrator for the frontend chat engine.
 *
 * The tracker sits between the current lightweight `ChatEngineState` surface and
 * the richer graph-backed relationship runtime defined in `RelationshipState.ts`.
 * It allows the frontend to:
 *
 * - hydrate graph-backed relationship continuity from current engine state
 * - ingest committed messages and upstream signals into a richer relationship
 *   graph without breaking the existing store shape
 * - derive lawful legacy `ChatRelationshipState` upserts for the current
 *   ChatEngine adapter surface
 * - track channel focus, unresolved tension, callback opportunities, and rescue
 *   pressure without inventing a parallel chat authority
 * - merge future backend authority frames without throwing away client-learned
 *   continuity
 *
 * Design laws
 * -----------
 * 1. Tracker owns orchestration; `RelationshipState.ts` owns pure state logic.
 * 2. The tracker must remain lawful with the current ChatEngine method surface:
 *    getState() + upsertRelationship().
 * 3. The tracker must be able to run before the backend relationship lane is
 *    fully wired.
 * 4. The tracker must prefer additive adoption over invasive rewrites.
 * 5. The tracker must help dramaturgy, rescue, and memory without replacing the
 *    current chat runtime.
 * ============================================================================
 */

import type {
  ChatRelationshipCounterpartKind,
} from '../../../../../shared/contracts/chat/relationship';

import type {
  RelationshipCounterpartRuntime,
  RelationshipEngineProjection,
  RelationshipEventBuildContext,
  RelationshipEventApplicationResult,
  RelationshipRuntimeConfig,
  RelationshipRuntimeState,
  RelationshipMergeOptions,
} from './RelationshipState';
import {
  CHAT_RELATIONSHIP_RUNTIME_REGISTRY,
  DEFAULT_RELATIONSHIP_RUNTIME_CONFIG,
  applyLegacyRelationshipToRuntime,
  applyMessageToRelationshipRuntime,
  applySignalToRelationshipRuntime,
  buildRelationshipRuntimeFromEngine,
  cloneRelationshipRuntimeState,
  createEmptyRelationshipRuntimeState,
  decayRelationshipRuntime,
  engineProjectionFromRelationshipRuntime,
  normalizeRelationshipRuntimeState,
  reconcileRelationshipRuntimeWithEngine,
  relationshipRuntimeSummary,
  selectCounterpartRuntime,
  selectFocusedCounterpartForChannel,
  selectRelationshipHeatForChannel,
  selectStrongestRelationshipRuntime,
  stableCounterpartId,
  stableNow,
  summaryFromMessage,
} from './RelationshipState';

import type {
  ChatAffectSnapshot,
  ChatChannelId,
  ChatEngineState,
  ChatLearningProfile,
  ChatMessage,
  ChatRelationshipState as LegacyChatRelationshipState,
  ChatUpstreamSignal,
  ChatUserId,
  ChatVisibleChannel,
  JsonObject,
  UnixMs,
} from '../types';

// ============================================================================
// MARK: Adapter / subscriber contracts
// ============================================================================

export interface RelationshipTrackerEngineBinding {
  readonly getState: () => Readonly<ChatEngineState>;
  readonly upsertRelationship: (relationship: LegacyChatRelationshipState) => void;
}

export interface RelationshipTrackerStoreBinding {
  readonly onRuntimeCommitted?: (runtime: RelationshipRuntimeState) => void;
  readonly onProjectionCommitted?: (projection: RelationshipEngineProjection) => void;
}

export type RelationshipTrackerEvent =
  | 'BOOTSTRAPPED'
  | 'HYDRATED'
  | 'MESSAGE_INGESTED'
  | 'MESSAGE_BATCH_INGESTED'
  | 'SIGNAL_INGESTED'
  | 'AUTHORITATIVE_RELATIONSHIP_APPLIED'
  | 'AUTHORITATIVE_RUNTIME_MERGED'
  | 'DECAY_APPLIED'
  | 'ENGINE_RECONCILED'
  | 'ENGINE_FLUSHED'
  | 'SCENE_FOCUS_CHANGED'
  | 'RESCUE_THRESHOLD_CROSSED'
  | 'DRAMA_THRESHOLD_CROSSED';

export interface RelationshipTrackerNotification {
  readonly event: RelationshipTrackerEvent;
  readonly reason: string;
  readonly at: UnixMs;
  readonly runtime: RelationshipRuntimeState;
  readonly projection: RelationshipEngineProjection;
  readonly summary: JsonObject;
  readonly counterpartId?: string;
  readonly channelId?: ChatChannelId;
}

export type RelationshipTrackerSubscriber = (
  notification: RelationshipTrackerNotification,
) => void;

export interface RelationshipTrackerConfig extends RelationshipRuntimeConfig {
  readonly autoFlushToEngine: boolean;
  readonly flushOnEveryMutation: boolean;
  readonly flushOnBatchEnd: boolean;
  readonly reconcileOnBootstrap: boolean;
  readonly reconcileOnSignal: boolean;
  readonly reconcileOnMessageBatch: boolean;
  readonly maxFlushPerCommit: number;
  readonly maxMessageBatch: number;
  readonly focusPromotionThreshold01: number;
  readonly rescueEmitThreshold01: number;
  readonly dramaEmitThreshold01: number;
  readonly rescanVisibleTail: number;
  readonly rescanShadowTail: number;
  readonly snapshotNoteRetention: number;
  readonly defaultSignalCounterpartId: string;
}

export const DEFAULT_RELATIONSHIP_TRACKER_CONFIG: RelationshipTrackerConfig = Object.freeze({
  ...DEFAULT_RELATIONSHIP_RUNTIME_CONFIG,
  autoFlushToEngine: true,
  flushOnEveryMutation: false,
  flushOnBatchEnd: true,
  reconcileOnBootstrap: true,
  reconcileOnSignal: false,
  reconcileOnMessageBatch: true,
  maxFlushPerCommit: 12,
  maxMessageBatch: 128,
  focusPromotionThreshold01: 0.58,
  rescueEmitThreshold01: 0.56,
  dramaEmitThreshold01: 0.60,
  rescanVisibleTail: 64,
  rescanShadowTail: 32,
  snapshotNoteRetention: 48,
  defaultSignalCounterpartId: 'system:relationship-core',
});

// ============================================================================
// MARK: Internal state
// ============================================================================

interface RelationshipTrackerInternalState {
  runtime: RelationshipRuntimeState;
  projection: RelationshipEngineProjection;
  lastFlushSignatureByCounterpartId: Record<string, string>;
  lastFocusedCounterpartByChannel: Record<string, string | undefined>;
  lastRescueEmitAt?: UnixMs;
  lastDramaEmitAt?: UnixMs;
  lastMutationAt?: UnixMs;
  lastReason?: string;
  bootstrapped: boolean;
}

interface RelationshipTrackerCommitOptions {
  readonly reason: string;
  readonly event: RelationshipTrackerEvent;
  readonly at?: UnixMs;
  readonly counterpartId?: string;
  readonly channelId?: ChatChannelId;
  readonly flush?: boolean;
}

interface RelationshipTrackerThresholdSnapshot {
  readonly rescueTriggered: boolean;
  readonly dramaTriggered: boolean;
  readonly strongestCounterpartId?: string;
  readonly strongestChannelId?: ChatChannelId;
}

// ============================================================================
// MARK: Primitive helpers
// ============================================================================

function stableSignature(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return String(value);
  }
}

function counterpartSignature(relationship: LegacyChatRelationshipState): string {
  return stableSignature({
    counterpartId: relationship.counterpartId,
    vector: relationship.vector,
    callbacks: relationship.callbacksAvailable,
    escalationTier: relationship.escalationTier,
    lastMeaningfulShiftAt: relationship.lastMeaningfulShiftAt,
  });
}

function strongestFocusChannel(runtime: RelationshipRuntimeState): ChatChannelId | undefined {
  let best: { channelId?: ChatChannelId; score: number } = { score: -1 };
  for (const [channelId, focus] of Object.entries(runtime.focusByChannel) as [ChatChannelId, RelationshipRuntimeState['focusByChannel'][ChatChannelId]][]) {
    const runtimeFocus = focus.counterpartId ? runtime.counterpartsById[focus.counterpartId] : undefined;
    if (!runtimeFocus) continue;
    const score = runtimeFocus.projection.intensity01 + focus.callbackLoad01 * 0.2 + focus.unresolvedCount * 0.1;
    if (score > best.score) best = { channelId, score };
  }
  return best.channelId;
}

function shouldEmitThresholds(
  runtime: RelationshipRuntimeState,
  config: RelationshipTrackerConfig,
): RelationshipTrackerThresholdSnapshot {
  const strongest = selectStrongestRelationshipRuntime(runtime);
  const strongestChannelId = strongestFocusChannel(runtime);
  return {
    rescueTriggered:
      runtime.metrics.helperRescueCount > 0 ||
      Object.values(runtime.counterpartsById).some((value) => value.shouldRescueGate && value.projection.intensity01 >= config.rescueEmitThreshold01),
    dramaTriggered:
      runtime.metrics.legendWeight01 >= config.dramaEmitThreshold01 ||
      runtime.metrics.activeObsessionCount > 0 ||
      (strongest?.projection.intensity01 ?? 0) >= config.dramaEmitThreshold01,
    strongestCounterpartId: strongest?.counterpartId,
    strongestChannelId,
  };
}

function defaultContextForChannel(
  channelId?: ChatChannelId,
  playerId?: string,
  roomId?: string,
): RelationshipEventBuildContext {
  return {
    playerId,
    roomId,
    channelId,
    now: stableNow(),
  };
}

// ============================================================================
// MARK: Tracker class
// ============================================================================

export class RelationshipTracker {
  private readonly config: RelationshipTrackerConfig;
  private readonly subscribers = new Set<RelationshipTrackerSubscriber>();
  private engineBinding?: RelationshipTrackerEngineBinding;
  private storeBinding?: RelationshipTrackerStoreBinding;
  private internal: RelationshipTrackerInternalState;

  public constructor(
    config: Partial<RelationshipTrackerConfig> = {},
    initialRuntime?: RelationshipRuntimeState,
  ) {
    this.config = Object.freeze({
      ...DEFAULT_RELATIONSHIP_TRACKER_CONFIG,
      ...config,
    });

    const runtime =
      initialRuntime
        ? normalizeRelationshipRuntimeState(cloneRelationshipRuntimeState(initialRuntime))
        : createEmptyRelationshipRuntimeState({ now: stableNow() });

    this.internal = {
      runtime,
      projection: engineProjectionFromRelationshipRuntime(runtime),
      lastFlushSignatureByCounterpartId: {},
      lastFocusedCounterpartByChannel: {},
      lastRescueEmitAt: undefined,
      lastDramaEmitAt: undefined,
      lastMutationAt: undefined,
      lastReason: undefined,
      bootstrapped: false,
    };
  }

  // ---------------------------------------------------------------------------
  // Attachment / lifecycle
  // ---------------------------------------------------------------------------

  public attachEngine(binding: RelationshipTrackerEngineBinding): this {
    this.engineBinding = binding;
    return this;
  }

  public attachStore(binding: RelationshipTrackerStoreBinding): this {
    this.storeBinding = binding;
    return this;
  }

  public detachEngine(): this {
    this.engineBinding = undefined;
    return this;
  }

  public subscribe(subscriber: RelationshipTrackerSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  public bootstrapFromEngineState(
    state?: ChatEngineState,
    context?: {
      readonly playerId?: ChatUserId | string;
      readonly roomId?: string;
      readonly notes?: readonly string[];
    },
  ): RelationshipRuntimeState {
    const source = state ?? this.engineBinding?.getState();
    if (!source) {
      const runtime = createEmptyRelationshipRuntimeState({
        playerId: context?.playerId,
        roomId: context?.roomId,
        now: stableNow(),
        notes: context?.notes,
      });
      this.commit(runtime, {
        reason: 'bootstrap-empty',
        event: 'BOOTSTRAPPED',
        flush: false,
      });
      return runtime;
    }

    const runtime = buildRelationshipRuntimeFromEngine({
      state: source,
      playerId: context?.playerId ? `${context.playerId}` : undefined,
      roomId: context?.roomId,
      notes: context?.notes,
    });

    const next = this.config.reconcileOnBootstrap
      ? reconcileRelationshipRuntimeWithEngine(runtime, source, context?.playerId ? `${context.playerId}` : undefined)
      : runtime;

    this.commit(next, {
      reason: 'bootstrap-engine-state',
      event: 'BOOTSTRAPPED',
      flush: this.config.autoFlushToEngine && this.config.flushOnEveryMutation,
    });
    this.internal.bootstrapped = true;
    return this.internal.runtime;
  }

  public hydrateRuntime(runtime: RelationshipRuntimeState, reason = 'hydrate-runtime'): RelationshipRuntimeState {
    this.commit(
      normalizeRelationshipRuntimeState(cloneRelationshipRuntimeState(runtime)),
      {
        reason,
        event: 'HYDRATED',
        flush: false,
      },
    );
    this.internal.bootstrapped = true;
    return this.internal.runtime;
  }

  // ---------------------------------------------------------------------------
  // Readers
  // ---------------------------------------------------------------------------

  public getRuntime(): Readonly<RelationshipRuntimeState> {
    return this.internal.runtime;
  }

  public getProjection(): Readonly<RelationshipEngineProjection> {
    return this.internal.projection;
  }

  public getSummary(): JsonObject {
    return relationshipRuntimeSummary(this.internal.runtime);
  }

  public getCounterpart(counterpartId: string): RelationshipCounterpartRuntime | undefined {
    return selectCounterpartRuntime(this.internal.runtime, counterpartId);
  }

  public getFocusedCounterpart(channelId: ChatChannelId): RelationshipCounterpartRuntime | undefined {
    return selectFocusedCounterpartForChannel(this.internal.runtime, channelId);
  }

  public getStrongestCounterpart(): RelationshipCounterpartRuntime | undefined {
    return selectStrongestRelationshipRuntime(this.internal.runtime);
  }

  public getRelationshipHeat(channelId: ChatChannelId): number {
    return selectRelationshipHeatForChannel(this.internal.runtime, channelId);
  }

  public isBootstrapped(): boolean {
    return this.internal.bootstrapped;
  }

  public getRegistry(): JsonObject {
    return {
      trackerVersion: DEFAULT_RELATIONSHIP_TRACKER_CONFIG.maxEventTail,
      runtimeRegistry: CHAT_RELATIONSHIP_RUNTIME_REGISTRY,
      trackerConfig: { ...this.config },
    };
  }

  // ---------------------------------------------------------------------------
  // Message ingestion
  // ---------------------------------------------------------------------------

  public ingestMessage(
    message: ChatMessage,
    context?: RelationshipEventBuildContext,
  ): RelationshipRuntimeState {
    const result = applyMessageToRelationshipRuntime(
      this.internal.runtime,
      message,
      {
        ...defaultContextForChannel(
          context?.channelId ?? message.channel,
          context?.playerId ?? (this.internal.runtime.playerId ? `${this.internal.runtime.playerId}` : undefined),
          context?.roomId ?? this.internal.runtime.activeRoomId,
        ),
        ...context,
        sourceSummary: context?.sourceSummary ?? summaryFromMessage(message),
        tags: [...(context?.tags ?? []), ...(message.tags ?? [])],
      },
    );

    this.commit(result.state, {
      reason: `ingest-message:${message.kind}:${stableCounterpartId(message)}`,
      event: 'MESSAGE_INGESTED',
      counterpartId: result.counterpart?.counterpartId,
      channelId: message.channel,
      flush: this.config.autoFlushToEngine && this.config.flushOnEveryMutation,
    });

    return this.internal.runtime;
  }

  public ingestMessages(
    messages: readonly ChatMessage[],
    context?: {
      readonly playerId?: string;
      readonly roomId?: string;
      readonly flush?: boolean;
    },
  ): RelationshipRuntimeState {
    const batch = messages.slice(-this.config.maxMessageBatch);
    let runtime = this.internal.runtime;

    for (const message of batch) {
      runtime = applyMessageToRelationshipRuntime(runtime, message, {
        playerId: context?.playerId ?? (runtime.playerId ? `${runtime.playerId}` : undefined),
        roomId: context?.roomId ?? runtime.activeRoomId,
        channelId: message.channel,
        now: (message.ts as UnixMs),
        sourceSummary: summaryFromMessage(message),
        tags: message.tags,
      }).state;
    }

    if (this.config.reconcileOnMessageBatch && this.engineBinding) {
      runtime = reconcileRelationshipRuntimeWithEngine(
        runtime,
        this.engineBinding.getState(),
        context?.playerId ?? (runtime.playerId ? `${runtime.playerId}` : undefined),
      );
    }

    this.commit(runtime, {
      reason: `ingest-message-batch:${batch.length}`,
      event: 'MESSAGE_BATCH_INGESTED',
      flush:
        this.config.autoFlushToEngine &&
        (context?.flush ?? this.config.flushOnBatchEnd),
    });

    return this.internal.runtime;
  }

  public ingestVisibleChannelTail(
    state: ChatEngineState,
    channelId: ChatVisibleChannel,
  ): RelationshipRuntimeState {
    const messages = state.messagesByChannel[channelId].slice(-this.config.rescanVisibleTail);
    return this.ingestMessages(messages, {
      playerId: this.internal.runtime.playerId ? `${this.internal.runtime.playerId}` : undefined,
      roomId: this.internal.runtime.activeRoomId,
      flush: false,
    });
  }

  public ingestAllVisibleTails(state: ChatEngineState): RelationshipRuntimeState {
    const messages = (Object.values(state.messagesByChannel) as readonly ChatMessage[][])
      .flatMap((list) => list.slice(-this.config.rescanVisibleTail));
    return this.ingestMessages(messages, {
      playerId: this.internal.runtime.playerId ? `${this.internal.runtime.playerId}` : undefined,
      roomId: this.internal.runtime.activeRoomId,
      flush: false,
    });
  }

  // ---------------------------------------------------------------------------
  // Signal ingestion
  // ---------------------------------------------------------------------------

  public ingestSignal(
    signal: ChatUpstreamSignal,
    counterpartId = this.config.defaultSignalCounterpartId,
    counterpartKind: ChatRelationshipCounterpartKind = 'SYSTEM',
    context?: RelationshipEventBuildContext,
  ): RelationshipRuntimeState {
    let runtime = applySignalToRelationshipRuntime(
      this.internal.runtime,
      signal,
      counterpartId,
      counterpartKind,
      {
        ...defaultContextForChannel(
          context?.channelId ?? 'SYSTEM_SHADOW',
          context?.playerId ?? (this.internal.runtime.playerId ? `${this.internal.runtime.playerId}` : undefined),
          context?.roomId ?? this.internal.runtime.activeRoomId,
        ),
        ...context,
      },
    ).state;

    if (this.config.reconcileOnSignal && this.engineBinding) {
      runtime = reconcileRelationshipRuntimeWithEngine(
        runtime,
        this.engineBinding.getState(),
        context?.playerId ?? (runtime.playerId ? `${runtime.playerId}` : undefined),
      );
    }

    this.commit(runtime, {
      reason: `ingest-signal:${signal.signalType}:${counterpartId}`,
      event: 'SIGNAL_INGESTED',
      counterpartId,
      channelId: context?.channelId ?? 'SYSTEM_SHADOW',
      flush: this.config.autoFlushToEngine && this.config.flushOnEveryMutation,
    });

    return this.internal.runtime;
  }

  public ingestSignals(
    signals: readonly ChatUpstreamSignal[],
    counterpartId = this.config.defaultSignalCounterpartId,
    counterpartKind: ChatRelationshipCounterpartKind = 'SYSTEM',
  ): RelationshipRuntimeState {
    let runtime = this.internal.runtime;
    for (const signal of signals) {
      runtime = applySignalToRelationshipRuntime(
        runtime,
        signal,
        counterpartId,
        counterpartKind,
        {
          playerId: runtime.playerId ? `${runtime.playerId}` : undefined,
          roomId: runtime.activeRoomId,
          channelId: 'SYSTEM_SHADOW',
          now: signal.emittedAt,
          sourceSummary: signal.signalType,
        },
      ).state;
    }

    this.commit(runtime, {
      reason: `ingest-signal-batch:${signals.length}:${counterpartId}`,
      event: 'SIGNAL_INGESTED',
      counterpartId,
      channelId: 'SYSTEM_SHADOW',
      flush: this.config.autoFlushToEngine && this.config.flushOnBatchEnd,
    });

    return this.internal.runtime;
  }

  // ---------------------------------------------------------------------------
  // Authority merge / reconciliation
  // ---------------------------------------------------------------------------

  public applyAuthoritativeRelationship(
    relationship: LegacyChatRelationshipState,
  ): RelationshipRuntimeState {
    const runtime = applyLegacyRelationshipToRuntime(
      this.internal.runtime,
      relationship,
      'authoritative-relationship',
    );

    this.commit(runtime, {
      reason: `authoritative-relationship:${relationship.counterpartId}`,
      event: 'AUTHORITATIVE_RELATIONSHIP_APPLIED',
      counterpartId: relationship.counterpartId,
      flush: false,
    });

    return this.internal.runtime;
  }

  public applyAuthoritativeRelationships(
    relationships: readonly LegacyChatRelationshipState[],
  ): RelationshipRuntimeState {
    let runtime = this.internal.runtime;
    for (const relationship of relationships) {
      runtime = applyLegacyRelationshipToRuntime(
        runtime,
        relationship,
        'authoritative-relationship-batch',
      );
    }

    this.commit(runtime, {
      reason: `authoritative-relationship-batch:${relationships.length}`,
      event: 'AUTHORITATIVE_RELATIONSHIP_APPLIED',
      flush: false,
    });

    return this.internal.runtime;
  }

  public mergeAuthoritativeRuntime(
    incoming: RelationshipRuntimeState,
    options: RelationshipMergeOptions = {},
  ): RelationshipRuntimeState {
    const runtime = normalizeRelationshipRuntimeState(
      options.markAuthoritative
        ? incoming
        : reconcileRelationshipRuntimeWithEngine(
            incoming,
            this.engineBinding?.getState?.() ?? this.internal.runtime.projection.relationshipsByCounterpartId
              ? (this.engineBinding?.getState?.() ?? this.createSyntheticEngineState())
              : this.createSyntheticEngineState(),
            incoming.playerId ? `${incoming.playerId}` : undefined,
          ),
    );

    this.commit(runtime, {
      reason: options.recordNote ?? 'authoritative-runtime-merged',
      event: 'AUTHORITATIVE_RUNTIME_MERGED',
      flush: false,
    });

    return this.internal.runtime;
  }

  public reconcileFromEngine(
    state?: ChatEngineState,
    reason = 'reconcile-from-engine',
  ): RelationshipRuntimeState {
    const source = state ?? this.engineBinding?.getState();
    if (!source) return this.internal.runtime;

    const runtime = reconcileRelationshipRuntimeWithEngine(
      this.internal.runtime,
      source,
      this.internal.runtime.playerId ? `${this.internal.runtime.playerId}` : undefined,
    );

    this.commit(runtime, {
      reason,
      event: 'ENGINE_RECONCILED',
      flush: this.config.autoFlushToEngine && this.config.flushOnEveryMutation,
    });

    return this.internal.runtime;
  }

  // ---------------------------------------------------------------------------
  // Time / decay
  // ---------------------------------------------------------------------------

  public tick(now: UnixMs = stableNow()): RelationshipRuntimeState {
    const runtime = decayRelationshipRuntime(this.internal.runtime, now);

    this.commit(runtime, {
      reason: `tick:${now}`,
      event: 'DECAY_APPLIED',
      at: now,
      flush: false,
    });

    return this.internal.runtime;
  }

  // ---------------------------------------------------------------------------
  // Engine flush
  // ---------------------------------------------------------------------------

  public flushToEngine(max = this.config.maxFlushPerCommit): number {
    if (!this.engineBinding) return 0;

    let flushed = 0;
    const relationships = Object.values(this.internal.projection.relationshipsByCounterpartId)
      .sort((a, b) => Number(b.lastMeaningfulShiftAt) - Number(a.lastMeaningfulShiftAt));

    for (const relationship of relationships) {
      if (flushed >= max) break;
      const signature = counterpartSignature(relationship);
      if (this.internal.lastFlushSignatureByCounterpartId[relationship.counterpartId] === signature) continue;

      this.engineBinding.upsertRelationship(relationship);
      this.internal.lastFlushSignatureByCounterpartId[relationship.counterpartId] = signature;
      flushed += 1;
    }

    if (flushed > 0) {
      this.notify({
        event: 'ENGINE_FLUSHED',
        reason: `flush:${flushed}`,
        at: stableNow(),
        runtime: this.internal.runtime,
        projection: this.internal.projection,
        summary: this.getSummary(),
      });
    }

    return flushed;
  }

  // ---------------------------------------------------------------------------
  // Helper derivations
  // ---------------------------------------------------------------------------

  public strongestCounterpartForChannel(
    channelId: ChatChannelId,
  ): RelationshipCounterpartRuntime | undefined {
    const direct = this.getFocusedCounterpart(channelId);
    if (direct) return direct;

    const candidates = Object.values(this.internal.runtime.counterpartsById)
      .filter((value) => value.lastChannelId === channelId)
      .sort((a, b) => {
        const scoreA = a.projection.intensity01 + a.projection.callbackLoad01 * 0.2 + a.unresolvedOpenLoops * 0.05;
        const scoreB = b.projection.intensity01 + b.projection.callbackLoad01 * 0.2 + b.unresolvedOpenLoops * 0.05;
        return scoreB - scoreA;
      });

    return candidates[0];
  }

  public recommendCounterpartForRescue(): RelationshipCounterpartRuntime | undefined {
    const candidates = Object.values(this.internal.runtime.counterpartsById)
      .filter((value) => value.shouldRescueGate)
      .sort((a, b) => {
        const scoreA = a.bridge.counterpartState.vector.traumaDebt01 + a.projection.intensity01 * 0.4;
        const scoreB = b.bridge.counterpartState.vector.traumaDebt01 + b.projection.intensity01 * 0.4;
        return scoreB - scoreA;
      });

    return candidates[0] ?? this.getStrongestCounterpart();
  }

  public recommendCounterpartForDrama(): RelationshipCounterpartRuntime | undefined {
    const candidates = Object.values(this.internal.runtime.counterpartsById)
      .filter((value) => value.hasLegendPotential || value.unresolvedOpenLoops > 0)
      .sort((a, b) => {
        const scoreA = a.projection.legendPotential01 + a.unresolvedOpenLoops * 0.08 + a.projection.intensity01 * 0.35;
        const scoreB = b.projection.legendPotential01 + b.unresolvedOpenLoops * 0.08 + b.projection.intensity01 * 0.35;
        return scoreB - scoreA;
      });

    return candidates[0] ?? this.getStrongestCounterpart();
  }

  public buildCounterpartDigest(
    counterpartId: string,
  ): JsonObject | undefined {
    const counterpart = this.getCounterpart(counterpartId);
    if (!counterpart) return undefined;

    return {
      counterpartId: counterpart.counterpartId,
      edgeId: counterpart.edgeId,
      kind: counterpart.kind,
      lastChannelId: counterpart.lastChannelId ?? null,
      dominantAffinityLaneId: counterpart.dominantAffinityLaneId ?? null,
      intensity01: counterpart.projection.intensity01,
      volatility01: counterpart.projection.volatility01,
      rescueDebt01: counterpart.projection.rescueDebt01,
      callbackLoad01: counterpart.projection.callbackLoad01,
      witnessLoad01: counterpart.projection.witnessLoad01,
      legendPotential01: counterpart.projection.legendPotential01,
      unresolvedOpenLoops: counterpart.unresolvedOpenLoops,
      visibleWitnessCount: counterpart.visibleWitnessCount,
      shadowWitnessCount: counterpart.shadowWitnessCount,
      shouldRescueGate: counterpart.shouldRescueGate,
      shouldDelayReveal: counterpart.shouldDelayReveal,
      shouldSurfaceBanner: counterpart.shouldSurfaceBanner,
      lastEventType: counterpart.lastEventType ?? null,
      lastEventAt: counterpart.lastEventAt ?? null,
      lastSummary: counterpart.lastSummary ?? null,
      notes: [...counterpart.projection.notes],
    };
  }

  public snapshotForUi(
    channelId?: ChatChannelId,
  ): JsonObject {
    const strongest = this.getStrongestCounterpart();
    const focused = channelId ? this.getFocusedCounterpart(channelId) : strongest;
    return {
      summary: this.getSummary(),
      strongestCounterpartId: strongest?.counterpartId ?? null,
      focusedCounterpartId: focused?.counterpartId ?? null,
      focusedChannelId: channelId ?? null,
      focusedHeat01: channelId ? this.getRelationshipHeat(channelId) : null,
      rescueCounterpartId: this.recommendCounterpartForRescue()?.counterpartId ?? null,
      dramaCounterpartId: this.recommendCounterpartForDrama()?.counterpartId ?? null,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal commit / notification
  // ---------------------------------------------------------------------------

  private commit(
    runtime: RelationshipRuntimeState,
    options: RelationshipTrackerCommitOptions,
  ): void {
    const at = options.at ?? stableNow();
    const normalized = normalizeRelationshipRuntimeState(runtime, at);
    const projection = engineProjectionFromRelationshipRuntime(normalized);
    const previous = this.internal.runtime;
    const thresholds = shouldEmitThresholds(normalized, this.config);

    this.internal = {
      ...this.internal,
      runtime: normalized,
      projection,
      lastMutationAt: at,
      lastReason: options.reason,
      lastFocusedCounterpartByChannel: Object.fromEntries(
        Object.entries(projection.focusedCounterpartByChannel).map(([key, value]) => [key, value]),
      ),
    };

    this.storeBinding?.onRuntimeCommitted?.(normalized);
    this.storeBinding?.onProjectionCommitted?.(projection);

    this.notify({
      event: options.event,
      reason: options.reason,
      at,
      runtime: normalized,
      projection,
      summary: relationshipRuntimeSummary(normalized),
      counterpartId: options.counterpartId,
      channelId: options.channelId,
    });

    this.emitThresholdNotifications(previous, normalized, thresholds, at);

    if (options.flush ?? false) {
      this.flushToEngine(this.config.maxFlushPerCommit);
    }
  }

  private emitThresholdNotifications(
    previous: RelationshipRuntimeState,
    next: RelationshipRuntimeState,
    thresholds: RelationshipTrackerThresholdSnapshot,
    at: UnixMs,
  ): void {
    const prevThresholds = shouldEmitThresholds(previous, this.config);

    if (thresholds.rescueTriggered && !prevThresholds.rescueTriggered) {
      this.internal.lastRescueEmitAt = at;
      this.notify({
        event: 'RESCUE_THRESHOLD_CROSSED',
        reason: `rescue-threshold:${thresholds.strongestCounterpartId ?? 'none'}`,
        at,
        runtime: next,
        projection: this.internal.projection,
        summary: relationshipRuntimeSummary(next),
        counterpartId: thresholds.strongestCounterpartId,
        channelId: thresholds.strongestChannelId,
      });
    }

    if (thresholds.dramaTriggered && !prevThresholds.dramaTriggered) {
      this.internal.lastDramaEmitAt = at;
      this.notify({
        event: 'DRAMA_THRESHOLD_CROSSED',
        reason: `drama-threshold:${thresholds.strongestCounterpartId ?? 'none'}`,
        at,
        runtime: next,
        projection: this.internal.projection,
        summary: relationshipRuntimeSummary(next),
        counterpartId: thresholds.strongestCounterpartId,
        channelId: thresholds.strongestChannelId,
      });
    }

    for (const [channelId, counterpartId] of Object.entries(this.internal.projection.focusedCounterpartByChannel) as [ChatChannelId, string | undefined][]) {
      const previousCounterpartId = this.internal.lastFocusedCounterpartByChannel[channelId];
      if (counterpartId && counterpartId !== previousCounterpartId) {
        this.notify({
          event: 'SCENE_FOCUS_CHANGED',
          reason: `focus:${channelId}:${counterpartId}`,
          at,
          runtime: next,
          projection: this.internal.projection,
          summary: relationshipRuntimeSummary(next),
          counterpartId,
          channelId,
        });
      }
    }
  }

  private notify(notification: RelationshipTrackerNotification): void {
    for (const subscriber of this.subscribers) {
      subscriber(notification);
    }
  }

  // ---------------------------------------------------------------------------
  // Synthetic engine bridge
  // ---------------------------------------------------------------------------

  private createSyntheticEngineState(): ChatEngineState {
    return {
      version: this.internal.runtime.version,
      connection: {
        status: 'IDLE',
        retryCount: 0,
      },
      activeMountTarget: 'GAME_BOARD',
      activeVisibleChannel: 'GLOBAL',
      memberships: [],
      messagesByChannel: {
        GLOBAL: [],
        SYNDICATE: [],
        DEAL_ROOM: [],
        LOBBY: [],
      },
      shadowMessageCountByChannel: {
        SYSTEM_SHADOW: 0,
        NPC_SHADOW: 0,
        RIVALRY_SHADOW: 0,
        RESCUE_SHADOW: 0,
        LIVEOPS_SHADOW: 0,
      },
      composer: {
        activeChannel: 'GLOBAL',
        draftByChannel: {
          GLOBAL: '',
          SYNDICATE: '',
          DEAL_ROOM: '',
          LOBBY: '',
        },
        disabled: false,
        maxLength: 500,
      },
      notifications: {
        unreadByChannel: {
          GLOBAL: 0,
          SYNDICATE: 0,
          DEAL_ROOM: 0,
          LOBBY: 0,
        },
        notificationKinds: [],
        hasAnyUnread: false,
      },
      presenceByActorId: {},
      typingByActorId: {},
      activeScene: undefined,
      pendingReveals: [],
      currentSilence: undefined,
      audienceHeat: {
        GLOBAL: {
          ridicule: 0 as any,
          hype: 0 as any,
          swarm: 0 as any,
          volatility: 0 as any,
          witnessDensity: 0 as any,
        },
        SYNDICATE: {
          ridicule: 0 as any,
          hype: 0 as any,
          swarm: 0 as any,
          volatility: 0 as any,
          witnessDensity: 0 as any,
        },
        DEAL_ROOM: {
          ridicule: 0 as any,
          hype: 0 as any,
          swarm: 0 as any,
          volatility: 0 as any,
          witnessDensity: 0 as any,
        },
        LOBBY: {
          ridicule: 0 as any,
          hype: 0 as any,
          swarm: 0 as any,
          volatility: 0 as any,
          witnessDensity: 0 as any,
        },
      },
      channelMoodByChannel: {
        GLOBAL: { mood: 'WATCHFUL', intensity: 0 as any, direction: 'STABLE' },
        SYNDICATE: { mood: 'WATCHFUL', intensity: 0 as any, direction: 'STABLE' },
        DEAL_ROOM: { mood: 'WATCHFUL', intensity: 0 as any, direction: 'STABLE' },
        LOBBY: { mood: 'WATCHFUL', intensity: 0 as any, direction: 'STABLE' },
        SYSTEM_SHADOW: { mood: 'WATCHFUL', intensity: 0 as any, direction: 'STABLE' },
        NPC_SHADOW: { mood: 'WATCHFUL', intensity: 0 as any, direction: 'STABLE' },
        RIVALRY_SHADOW: { mood: 'WATCHFUL', intensity: 0 as any, direction: 'STABLE' },
        RESCUE_SHADOW: { mood: 'WATCHFUL', intensity: 0 as any, direction: 'STABLE' },
        LIVEOPS_SHADOW: { mood: 'WATCHFUL', intensity: 0 as any, direction: 'STABLE' },
      },
      reputation: {
        publicAura: 0 as any,
        syndicateCredibility: 0 as any,
        negotiationFear: 0 as any,
        comebackRespect: 0 as any,
        humiliationRisk: 0 as any,
      },
      affect: {
        vector: {
          intimidation: 0 as any,
          confidence: 0 as any,
          frustration: 0 as any,
          curiosity: 0 as any,
          attachment: 0 as any,
          embarrassment: 0 as any,
          relief: 0 as any,
          dominance: 0 as any,
          desperation: 0 as any,
          trust: 0 as any,
        },
        dominantEmotion: 'CONFIDENCE',
        confidenceSwingDelta: 0,
        lastUpdatedAt: stableNow(),
      },
      liveOps: {
        activeWorldEvents: [],
        suppressedHelperChannels: [],
        boostedCrowdChannels: [],
      },
      relationshipsByCounterpartId: this.internal.runtime.legacyByCounterpartId,
      offerState: undefined,
      learningProfile: undefined,
      continuity: {
        unresolvedMomentIds: [],
        carriedPersonaIds: [],
      },
      lastAuthoritativeSyncAt: undefined,
    };
  }
}

export const CHAT_RELATIONSHIP_TRACKER_REGISTRY = Object.freeze({
  filePath: 'pzo-web/src/engines/chat/memory/RelationshipTracker.ts',
  version: '1.0.0',
  config: DEFAULT_RELATIONSHIP_TRACKER_CONFIG,
  runtimeRegistry: CHAT_RELATIONSHIP_RUNTIME_REGISTRY,
});
