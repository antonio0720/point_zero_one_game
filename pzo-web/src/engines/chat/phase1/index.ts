/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT PHASE 1 INDEX
 * FILE: pzo-web/src/engines/chat/phase1/index.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Barrel re-export of the full Phase 1 novelty + episodic memory stack for
 * the frontend chat engine. Consumers import from this file; they do not
 * import directly from the sub-modules.
 *
 * Module map
 * ----------
 * ChatStatePhaseOne.ts    — state slice types, mutation helpers, analytics,
 *                           serialization, and namespace export
 * ChatEnginePhaseOneBridge.ts — bridge class, candidate ranking, signal
 *                               dispatch, diagnostic surface, and factory
 *
 * Also exported from this index
 * --------------------------------
 * ChatPhaseOneDomain        — high-level orchestration class combining both
 *                             modules behind a single surface
 * runPhaseOnePipeline       — stateless pipeline helper for one-shot usage
 * ChatPhaseOneNS            — aggregated namespace for all exported symbols
 * ============================================================================
 */

// ============================================================================
// MARK: Re-exports from ChatStatePhaseOne
// ============================================================================

export {
  // Constants
  PHASE_ONE_STATE_VERSION,
  PHASE_ONE_FINGERPRINT_DIMENSION_COUNT,
  PHASE_ONE_MAX_UNRESOLVED_CALLBACKS,
  PHASE_ONE_FATIGUE_CRITICAL_THRESHOLD,
  PHASE_ONE_FATIGUE_HIGH_THRESHOLD,
  PHASE_ONE_FATIGUE_MEDIUM_THRESHOLD,
  PHASE_ONE_CALLBACK_PRESSURE_HIGH_THRESHOLD,
  PHASE_ONE_CALLBACK_PRESSURE_MEDIUM_THRESHOLD,
  FINGERPRINT_DIMENSION_KEYS,

  // Default constructors
  createDefaultConversationalFingerprint,
  createDefaultChatPhaseOneStateSlice,

  // State access
  getPhaseOneState,
  withPhaseOneState,
  hasPhaseOneState,

  // Core mutations
  setPhaseOneNoveltyLedgerInState,
  setPhaseOneEpisodicMemoryInState,
  setPhaseOneRecommendedCandidateIdInState,
  setSemanticFatigueInState,
  applyConversationalFingerprintDeltaInState,
  notePhaseOneCarryoverSummaryInState,
  blendConversationalFingerprintInState,
  addUnresolvedCallbackIdsInState,
  removeUnresolvedCallbackIdsInState,
  resetFatigueInState,
  decayFatigueInState,

  // Feature overlay
  phaseOneFeatureOverlay,

  // Fingerprint analytics
  fingerprintToVector,
  vectorToFingerprint,
  interpolateFingerprints,
  scaleFingerprint,
  fingerprintDistance,
  fingerprintManhattanDistance,
  buildFingerprintScore,
  compareConversationalFingerprints,
  classifyConversationalFingerprint,
  describeConversationalFingerprint,

  // Fatigue analytics
  resolveFatigueBand,
  buildFatigueReport,
  getHighestFatigueChannel,
  getLowestFatigueChannel,
  buildChannelPressureMap,

  // Callback & novelty pressure
  computeCallbackPressure,
  computeNoveltyPressure,

  // State diff
  diffPhaseOneStateSlices,

  // Diagnostic
  buildPhaseOneStateReport,
  buildPhaseOneFeatureFlags,
  describePhaseOneState,

  // Merge & prune
  mergePhaseOneStateSlices,
  prunePhaseOneStateSlice,

  // Validation
  validatePhaseOneStateSlice,

  // Serialization
  serializePhaseOneStateSlice,
  serializePhaseOneStateSliceVersioned,
  hydratePhaseOneStateSlice,
  hydratePhaseOneStateSliceVersioned,

  // Message-level helpers
  deriveFingerprintDeltaFromMessage,

  // Summary text
  summarizeFatigue,
  summarizeFingerprint,
  buildPhasOneStateTelemetryLabel,

  // Numeric utilities
  clamp01,

  // Namespace
  ChatPhaseOneStateNS,
} from './ChatStatePhaseOne';

export type {
  // Core interfaces
  ChatConversationalFingerprint,
  ChatPhaseOneStateSlice,
  ChatEngineStateWithPhaseOne,
  FingerprintDimensionKey,

  // Extended analytic types
  ChatPhaseOneChannelFatigue,
  ChatPhaseOneFatigueReport,
  ChatPhaseOneCallbackPressureScore,
  ChatFingerprintDelta,
  ChatFingerprintComparison,
  ChatPlayerArchetype,
  ChatFingerprintClassification,
  ChatPhaseOneStateDiff,
  ChatPhaseOneStateReport,
  ChatPhaseOneSerializedEnvelope,
  ChatPhaseOneHydrationResult,
  ChatPhaseOneFeatureFlags,
  ChatPhaseOneChannelPressureMap,
} from './ChatStatePhaseOne';

// ============================================================================
// MARK: Re-exports from ChatEnginePhaseOneBridge
// ============================================================================

export {
  // Class
  ChatEnginePhaseOneBridge,

  // Factory and singleton
  createChatEnginePhaseOneBridge,
  getDefaultChatEnginePhaseOneBridge,
  setDefaultChatEnginePhaseOneBridge,
  resetDefaultChatEnginePhaseOneBridge,

  // Namespace
  ChatEnginePhaseOneBridgeNS,
} from './ChatEnginePhaseOneBridge';

export type {
  ChatEnginePhaseOneBridgeOptions,
  ChatPhaseOneResponseCandidate,
  ChatPhaseOneRankedCandidate,
  ChatPhaseOneRankingResult,
  ChatSignalObservationRecord,
  ChatEnginePhaseOneBridgeSnapshot,
} from './ChatEnginePhaseOneBridge';

// ============================================================================
// MARK: Direct imports for orchestration layer
// ============================================================================

import {
  PHASE_ONE_STATE_VERSION,
  PHASE_ONE_MAX_UNRESOLVED_CALLBACKS,
  FINGERPRINT_DIMENSION_KEYS,
  createDefaultChatPhaseOneStateSlice,
  createDefaultConversationalFingerprint,
  getPhaseOneState,
  withPhaseOneState,
  setPhaseOneNoveltyLedgerInState,
  setPhaseOneEpisodicMemoryInState,
  setPhaseOneRecommendedCandidateIdInState,
  applyConversationalFingerprintDeltaInState,
  notePhaseOneCarryoverSummaryInState,
  blendConversationalFingerprintInState,
  phaseOneFeatureOverlay,
  buildPhaseOneStateReport,
  buildPhaseOneFeatureFlags,
  buildChannelPressureMap,
  buildFatigueReport,
  classifyConversationalFingerprint,
  computeCallbackPressure,
  computeNoveltyPressure,
  diffPhaseOneStateSlices,
  describePhaseOneState,
  mergePhaseOneStateSlices,
  prunePhaseOneStateSlice,
  serializePhaseOneStateSliceVersioned,
  hydratePhaseOneStateSliceVersioned,
  validatePhaseOneStateSlice,
  fingerprintDistance,
  buildFingerprintScore,
  summarizeFatigue,
  summarizeFingerprint,
  clamp01,
  ChatPhaseOneStateNS,
} from './ChatStatePhaseOne';

import type {
  ChatConversationalFingerprint,
  ChatPhaseOneStateSlice,
  ChatEngineStateWithPhaseOne,
  ChatPhaseOneStateReport,
  ChatPhaseOneFeatureFlags,
  ChatPhaseOneChannelPressureMap,
  ChatPhaseOneStateDiff,
  ChatPhaseOneCallbackPressureScore,
  ChatPhaseOneFatigueReport,
  ChatFingerprintClassification,
  ChatPhaseOneSerializedEnvelope,
  ChatPhaseOneHydrationResult,
} from './ChatStatePhaseOne';

import {
  ChatEnginePhaseOneBridge,
  createChatEnginePhaseOneBridge,
  getDefaultChatEnginePhaseOneBridge,
  ChatEnginePhaseOneBridgeNS,
} from './ChatEnginePhaseOneBridge';

import type {
  ChatEnginePhaseOneBridgeOptions,
  ChatPhaseOneResponseCandidate,
  ChatPhaseOneRankedCandidate,
  ChatPhaseOneRankingResult,
  ChatEnginePhaseOneBridgeSnapshot,
} from './ChatEnginePhaseOneBridge';

import type {
  ChatFeatureSnapshot,
  ChatMessage,
  ChatScenePlan,
  ChatUpstreamSignal,
  ChatVisibleChannel,
  UnixMs,
} from '../types';

import type { BotId } from '../../battle/types';

import type {
  ChatEpisodicCallbackCandidate,
  ChatEpisodicEventType,
} from '../intelligence/ChatEpisodicMemory';

// ============================================================================
// MARK: Pipeline types
// ============================================================================

/**
 * Options for a one-shot pipeline run.
 */
export interface ChatPhaseOnePipelineOptions {
  readonly playerId?: string;
  readonly noveltyOptions?: Readonly<Record<string, unknown>>;
  readonly episodicOptions?: Readonly<Record<string, unknown>>;
  readonly fatigueSceneDecay?: number;
}

/**
 * Request for a one-shot pipeline invocation.
 */
export interface ChatPhaseOnePipelineRequest {
  readonly state: ChatEngineStateWithPhaseOne;
  readonly messages?: readonly ChatMessage[];
  readonly scene?: ChatScenePlan;
  readonly sceneSummary?: string;
  readonly signals?: readonly ChatUpstreamSignal[];
  readonly candidates?: readonly ChatPhaseOneResponseCandidate[];
  readonly channelId?: ChatVisibleChannel;
  readonly sceneRole?: string | null;
  readonly featureSnapshot?: ChatFeatureSnapshot;
  readonly recommendedCandidateId?: string;
  readonly now?: UnixMs;
}

/**
 * Full result of a one-shot pipeline run.
 */
export interface ChatPhaseOnePipelineResult {
  readonly state: ChatEngineStateWithPhaseOne;
  readonly rankedCandidates: readonly ChatPhaseOneRankedCandidate[];
  readonly report: ChatPhaseOneStateReport;
  readonly featureFlags: ChatPhaseOneFeatureFlags;
  readonly channelPressureMap: ChatPhaseOneChannelPressureMap;
  readonly notes: readonly string[];
}

// ============================================================================
// MARK: Pipeline function
// ============================================================================

/**
 * Stateless one-shot pipeline: creates a bridge, processes the request,
 * and returns the resulting state and diagnostics.
 *
 * Suitable for server-side rendering, unit tests, and one-shot evaluation.
 * For long-lived interactive sessions, use ChatPhaseOneDomain instead.
 */
export function runPhaseOnePipeline(
  request: ChatPhaseOnePipelineRequest,
  options: ChatPhaseOnePipelineOptions = {},
): ChatPhaseOnePipelineResult {
  const now = request.now ?? (Date.now() as UnixMs);
  const bridge = createChatEnginePhaseOneBridge({
    playerId: options.playerId,
    now,
    noveltyOptions: options.noveltyOptions,
    episodicOptions: options.episodicOptions,
    fatigueSceneDecay: options.fatigueSceneDecay,
  });

  let state = request.state;
  bridge.ensureHydrated(state);
  const notes: string[] = [];

  // Process messages
  for (const message of request.messages ?? []) {
    state = bridge.noteCommittedMessage(state, message, request.featureSnapshot, now);
  }

  // Process scene
  if (request.scene) {
    state = bridge.noteScene(state, request.scene, request.sceneSummary ?? '', now);
  }

  // Process signals
  for (const signal of request.signals ?? []) {
    state = bridge.noteSignal(state, signal, now);
  }

  // Sync
  state = bridge.syncIntoState(state, request.recommendedCandidateId, now);

  // Rank candidates
  const channelId = request.channelId ?? 'GLOBAL';
  let rankedCandidates: readonly ChatPhaseOneRankedCandidate[] = [];
  if (request.candidates && request.candidates.length > 0 && request.featureSnapshot) {
    rankedCandidates = bridge.rankResponseCandidates(
      state,
      request.candidates,
      channelId,
      request.sceneRole ?? null,
      request.featureSnapshot,
      now,
    );
    if (rankedCandidates.length > 0) {
      notes.push(`Ranked ${rankedCandidates.length} candidates; top: ${rankedCandidates[0]!.candidateId}`);
    }
  }

  const report = bridge.getReport(state, now);
  const featureFlags = bridge.getFeatureFlags(state);
  const channelPressureMap = bridge.getChannelPressureMap(state, now);

  if (report.overallHealthBand !== 'HEALTHY') {
    notes.push(`State health: ${report.overallHealthBand}`);
  }

  return {
    state,
    rankedCandidates,
    report,
    featureFlags,
    channelPressureMap,
    notes,
  };
}

// ============================================================================
// MARK: ChatPhaseOneDomain — orchestration class
// ============================================================================

/**
 * Options for ChatPhaseOneDomain construction.
 */
export interface ChatPhaseOneDomainOptions extends ChatPhaseOneBridgeOptions {
  /**
   * If true, auto-serialize the state to the persistence callback after
   * each mutation. Default: false.
   */
  readonly autoPersist?: boolean;
  /**
   * Called after each mutation when autoPersist is enabled.
   */
  readonly onPersist?: (envelope: ChatPhaseOneSerializedEnvelope) => void;
  /**
   * Called when the report health band changes.
   */
  readonly onHealthChange?: (band: ChatPhaseOneStateReport['overallHealthBand']) => void;
}

// Alias for use inside the domain
type ChatPhaseOneBridgeOptions = ChatEnginePhaseOneBridgeOptions;

/**
 * High-level orchestration class that combines the state helpers from
 * ChatStatePhaseOne with the bridge from ChatEnginePhaseOneBridge into a
 * single lifecycle-aware object.
 *
 * Use this in React contexts, game engine singletons, and server-side
 * session handlers where you want a managed instance.
 *
 * Usage
 * -----
 *   const domain = createChatPhaseOneDomain({ playerId });
 *   // On each committed message:
 *   state = domain.noteMessage(state, message, featureSnapshot);
 *   // Before rendering responses:
 *   const ranked = domain.rankCandidates(state, candidates, channelId, sceneRole, featureSnapshot);
 */
export class ChatPhaseOneDomain {
  private readonly bridge: ChatEnginePhaseOneBridge;
  private readonly autoPersist: boolean;
  private readonly onPersist?: (envelope: ChatPhaseOneSerializedEnvelope) => void;
  private readonly onHealthChange?: (band: ChatPhaseOneStateReport['overallHealthBand']) => void;
  private lastHealthBand?: ChatPhaseOneStateReport['overallHealthBand'];

  public constructor(options: ChatPhaseOneDomainOptions = {}) {
    const { autoPersist, onPersist, onHealthChange, ...bridgeOptions } = options;
    this.bridge = createChatEnginePhaseOneBridge(bridgeOptions);
    this.autoPersist = autoPersist ?? false;
    this.onPersist = onPersist;
    this.onHealthChange = onHealthChange;
  }

  // ── Hydration ──────────────────────────────────────────────────────────

  /** Hydrate domain from existing engine state. */
  public hydrate(state: ChatEngineStateWithPhaseOne): void {
    this.bridge.hydrateFromState(state);
  }

  /** Hydrate from a persisted versioned envelope. */
  public hydrateFromEnvelope(
    state: ChatEngineStateWithPhaseOne,
    envelope: unknown,
    now?: UnixMs,
  ): { state: ChatEngineStateWithPhaseOne; result: ChatPhaseOneHydrationResult } {
    return this.bridge.hydrateFromEnvelope(state, envelope, now);
  }

  // ── Core observations ──────────────────────────────────────────────────

  /** Note a committed message; returns updated state. */
  public noteMessage(
    state: ChatEngineStateWithPhaseOne,
    message: ChatMessage,
    featureSnapshot?: ChatFeatureSnapshot,
    now?: UnixMs,
  ): ChatEngineStateWithPhaseOne {
    const next = this.bridge.noteCommittedMessage(state, message, featureSnapshot, now as UnixMs ?? Date.now() as UnixMs);
    return this.afterMutate(next, now);
  }

  /** Note a completed scene; returns updated state. */
  public noteScene(
    state: ChatEngineStateWithPhaseOne,
    scene: ChatScenePlan,
    summary: string,
    now?: UnixMs,
  ): ChatEngineStateWithPhaseOne {
    const next = this.bridge.noteScene(state, scene, summary, now as UnixMs ?? scene.startedAt);
    return this.afterMutate(next, now);
  }

  /** Note an upstream signal; returns updated state. */
  public noteSignal(
    state: ChatEngineStateWithPhaseOne,
    signal: ChatUpstreamSignal,
    now?: UnixMs,
  ): ChatEngineStateWithPhaseOne {
    const next = this.bridge.noteSignal(state, signal, now as UnixMs);
    return this.afterMutate(next, now);
  }

  /** Sync internal state into engine state. */
  public sync(
    state: ChatEngineStateWithPhaseOne,
    recommendedCandidateId?: string,
    now?: UnixMs,
  ): ChatEngineStateWithPhaseOne {
    const next = this.bridge.syncIntoState(state, recommendedCandidateId, now as UnixMs ?? Date.now() as UnixMs);
    return this.afterMutate(next, now);
  }

  // ── Ranking ─────────────────────────────────────────────────────────────

  /** Rank response candidates; returns sorted array. */
  public rankCandidates(
    state: ChatEngineStateWithPhaseOne,
    candidates: readonly ChatPhaseOneResponseCandidate[],
    channelId: ChatVisibleChannel,
    sceneRole: string | null,
    featureSnapshot: ChatFeatureSnapshot,
    now?: UnixMs,
  ): readonly ChatPhaseOneRankedCandidate[] {
    return this.bridge.rankResponseCandidates(
      state,
      candidates,
      channelId,
      sceneRole,
      featureSnapshot,
      now as UnixMs ?? featureSnapshot.createdAt,
    );
  }

  /** Full ranking result with metadata. */
  public rankCandidatesFull(
    state: ChatEngineStateWithPhaseOne,
    candidates: readonly ChatPhaseOneResponseCandidate[],
    channelId: ChatVisibleChannel,
    sceneRole: string | null,
    featureSnapshot: ChatFeatureSnapshot,
    now?: UnixMs,
  ): ChatPhaseOneRankingResult {
    return this.bridge.rankResponseCandidatesFull(
      state,
      candidates,
      channelId,
      sceneRole,
      featureSnapshot,
      now as UnixMs ?? featureSnapshot.createdAt,
    );
  }

  // ── Callback resolution ─────────────────────────────────────────────────

  /** Mark a single callback as used. */
  public markCallbackUsed(
    state: ChatEngineStateWithPhaseOne,
    memoryId: string,
    callbackId?: string,
    now?: UnixMs,
  ): ChatEngineStateWithPhaseOne {
    const next = this.bridge.markCallbackUsed(state, memoryId, callbackId, now as UnixMs ?? Date.now() as UnixMs);
    return this.afterMutate(next, now);
  }

  /** Mark multiple callbacks as used. */
  public markCallbacksUsed(
    state: ChatEngineStateWithPhaseOne,
    entries: readonly { memoryId: string; callbackId?: string }[],
    now?: UnixMs,
  ): ChatEngineStateWithPhaseOne {
    const next = this.bridge.markCallbacksUsed(state, entries, now as UnixMs ?? Date.now() as UnixMs);
    return this.afterMutate(next, now);
  }

  // ── Query surface ────────────────────────────────────────────────────────

  /** Query callbacks by context. */
  public queryCallbacks(options: {
    botId?: BotId | string | null;
    counterpartId?: string | null;
    roomId?: string | null;
    channelId?: ChatVisibleChannel | null;
    sceneRole?: string | null;
    maxResults?: number;
  }): readonly ChatEpisodicCallbackCandidate[] {
    return this.bridge.queryCallbacks(options);
  }

  /** Query callbacks by event type. */
  public queryCallbacksByEventType(
    eventType: ChatEpisodicEventType,
    maxResults?: number,
  ): readonly ChatEpisodicCallbackCandidate[] {
    return this.bridge.queryCallbacksByEventType(eventType, maxResults);
  }

  /** Get current unresolved callback IDs. */
  public getUnresolvedCallbackIds(): readonly string[] {
    return this.bridge.getUnresolvedCallbackIds();
  }

  /** Get the current carryover summary. */
  public getCarryoverSummary(): string | undefined {
    return this.bridge.getCarryoverSummary();
  }

  // ── Diagnostics ──────────────────────────────────────────────────────────

  /** Full diagnostic report. */
  public getReport(state: ChatEngineStateWithPhaseOne, now?: UnixMs): ChatPhaseOneStateReport {
    return this.bridge.getReport(state, now as UnixMs ?? Date.now() as UnixMs);
  }

  /** Feature flags. */
  public getFeatureFlags(state: ChatEngineStateWithPhaseOne): ChatPhaseOneFeatureFlags {
    return this.bridge.getFeatureFlags(state);
  }

  /** Channel pressure map. */
  public getChannelPressureMap(state: ChatEngineStateWithPhaseOne, now?: UnixMs): ChatPhaseOneChannelPressureMap {
    return this.bridge.getChannelPressureMap(state, now as UnixMs ?? Date.now() as UnixMs);
  }

  /** Fatigue report. */
  public getFatigueReport(state: ChatEngineStateWithPhaseOne, now?: UnixMs): ChatPhaseOneFatigueReport {
    return this.bridge.getFatigueReport(state, now as UnixMs ?? Date.now() as UnixMs);
  }

  /** Callback pressure. */
  public getCallbackPressure(state: ChatEngineStateWithPhaseOne, now?: UnixMs): ChatPhaseOneCallbackPressureScore {
    return this.bridge.getCallbackPressure(state, now as UnixMs ?? Date.now() as UnixMs);
  }

  /** Fingerprint classification. */
  public getFingerprintClassification(state: ChatEngineStateWithPhaseOne): ChatFingerprintClassification {
    return this.bridge.getFingerprintClassification(state);
  }

  /** State diff between two states. */
  public diff(
    before: ChatEngineStateWithPhaseOne,
    after: ChatEngineStateWithPhaseOne,
    now?: UnixMs,
  ): ChatPhaseOneStateDiff {
    return this.bridge.diffAgainstState(before, after, now as UnixMs ?? Date.now() as UnixMs);
  }

  /** Bridge telemetry snapshot. */
  public getBridgeSnapshot(now?: UnixMs): ChatEnginePhaseOneBridgeSnapshot {
    return this.bridge.getBridgeSnapshot(now as UnixMs ?? Date.now() as UnixMs);
  }

  /** Human-readable state description. */
  public describe(state: ChatEngineStateWithPhaseOne, now?: UnixMs): string {
    return describePhaseOneState(state, now as UnixMs ?? Date.now() as UnixMs);
  }

  // ── Serialization ────────────────────────────────────────────────────────

  /** Serialize to versioned envelope. */
  public serialize(state: ChatEngineStateWithPhaseOne, now?: UnixMs): ChatPhaseOneSerializedEnvelope | undefined {
    return this.bridge.serializeState(state, now as UnixMs ?? Date.now() as UnixMs);
  }

  // ── State-level analytics (stateless, no bridge required) ─────────────────

  /** Compute novelty pressure from a state. */
  public computeNoveltyPressure(state: ChatEngineStateWithPhaseOne): number {
    return computeNoveltyPressure(getPhaseOneState(state));
  }

  /** Build fingerprint score from a state. */
  public buildFingerprintScore(state: ChatEngineStateWithPhaseOne): number {
    return buildFingerprintScore(getPhaseOneState(state).conversationalFingerprint);
  }

  /** Merge two states' phase-one slices. */
  public mergeStates(
    a: ChatEngineStateWithPhaseOne,
    b: ChatEngineStateWithPhaseOne,
    now?: UnixMs,
  ): ChatPhaseOneStateSlice {
    return mergePhaseOneStateSlices(
      getPhaseOneState(a),
      getPhaseOneState(b),
      now as UnixMs ?? Date.now() as UnixMs,
    );
  }

  // ── Private lifecycle ─────────────────────────────────────────────────────

  private afterMutate(
    state: ChatEngineStateWithPhaseOne,
    now?: UnixMs,
  ): ChatEngineStateWithPhaseOne {
    if (this.autoPersist && this.onPersist) {
      const envelope = this.bridge.serializeState(state, now as UnixMs ?? Date.now() as UnixMs);
      if (envelope) this.onPersist(envelope);
    }

    if (this.onHealthChange) {
      const report = buildPhaseOneStateReport(state, now as UnixMs ?? Date.now() as UnixMs);
      if (report.overallHealthBand !== this.lastHealthBand) {
        this.lastHealthBand = report.overallHealthBand;
        this.onHealthChange(report.overallHealthBand);
      }
    }

    return state;
  }
}

// ============================================================================
// MARK: Factory functions for ChatPhaseOneDomain
// ============================================================================

export function createChatPhaseOneDomain(
  options: ChatPhaseOneDomainOptions = {},
): ChatPhaseOneDomain {
  return new ChatPhaseOneDomain(options);
}

let _defaultDomain: ChatPhaseOneDomain | null = null;

/**
 * Get or create the default singleton domain.
 */
export function getDefaultChatPhaseOneDomain(
  options?: ChatPhaseOneDomainOptions,
): ChatPhaseOneDomain {
  if (!_defaultDomain) {
    _defaultDomain = new ChatPhaseOneDomain(options ?? {});
  }
  return _defaultDomain;
}

/**
 * Replace the singleton domain.
 */
export function setDefaultChatPhaseOneDomain(domain: ChatPhaseOneDomain): void {
  _defaultDomain = domain;
}

/**
 * Reset the singleton domain.
 */
export function resetDefaultChatPhaseOneDomain(): void {
  _defaultDomain = null;
}

// ============================================================================
// MARK: Convenience helpers exported at the index level
// ============================================================================

/**
 * One-shot: rank candidates using a fresh bridge and the provided state.
 * Does not persist the bridge.
 */
export function rankCandidatesOnce(
  state: ChatEngineStateWithPhaseOne,
  candidates: readonly ChatPhaseOneResponseCandidate[],
  channelId: ChatVisibleChannel,
  sceneRole: string | null,
  featureSnapshot: ChatFeatureSnapshot,
  now?: UnixMs,
): readonly ChatPhaseOneRankedCandidate[] {
  const bridge = createChatEnginePhaseOneBridge({ now: now ?? featureSnapshot.createdAt });
  bridge.ensureHydrated(state);
  return bridge.rankResponseCandidates(
    state,
    candidates,
    channelId,
    sceneRole,
    featureSnapshot,
    now ?? featureSnapshot.createdAt,
  );
}

/**
 * One-shot: build a phase-one state report from a state without a bridge.
 */
export function getPhaseOneReport(
  state: ChatEngineStateWithPhaseOne,
  now: UnixMs = Date.now() as UnixMs,
): ChatPhaseOneStateReport {
  return buildPhaseOneStateReport(state, now);
}

/**
 * One-shot: get feature flags without a bridge.
 */
export function getPhaseOneFeatureFlags(
  state: ChatEngineStateWithPhaseOne,
): ChatPhaseOneFeatureFlags {
  return buildPhaseOneFeatureFlags(getPhaseOneState(state));
}

/**
 * One-shot: classify the player fingerprint from a state.
 */
export function classifyPlayerFromState(
  state: ChatEngineStateWithPhaseOne,
): ChatFingerprintClassification {
  return classifyConversationalFingerprint(getPhaseOneState(state).conversationalFingerprint);
}

/**
 * One-shot: get the current channel pressure map from a state.
 */
export function getChannelPressureMapFromState(
  state: ChatEngineStateWithPhaseOne,
  now: UnixMs = Date.now() as UnixMs,
): ChatPhaseOneChannelPressureMap {
  return buildChannelPressureMap(getPhaseOneState(state), now);
}

/**
 * One-shot: validate and hydrate an unknown value into a phase-one slice.
 */
export function validateAndHydrateSlice(
  raw: unknown,
  now?: UnixMs,
): ChatPhaseOneHydrationResult {
  return hydratePhaseOneStateSliceVersioned(raw, now ?? Date.now() as UnixMs);
}

// ============================================================================
// MARK: Aggregated namespace export
// ============================================================================

/**
 * ChatPhaseOneNS — frozen namespace aggregating every public symbol from
 * both ChatStatePhaseOne.ts and ChatEnginePhaseOneBridge.ts, plus the
 * orchestration layer defined in this index file.
 */
export const ChatPhaseOneNS = Object.freeze({
  // Sub-namespaces
  state: ChatPhaseOneStateNS,
  bridge: ChatEnginePhaseOneBridgeNS,

  // Constants (promoted for convenience)
  PHASE_ONE_STATE_VERSION,
  PHASE_ONE_MAX_UNRESOLVED_CALLBACKS,
  FINGERPRINT_DIMENSION_KEYS,

  // Classes
  ChatEnginePhaseOneBridge,
  ChatPhaseOneDomain,

  // Factory and singletons — bridge
  createChatEnginePhaseOneBridge,
  getDefaultChatEnginePhaseOneBridge,

  // Factory and singletons — domain
  createChatPhaseOneDomain,
  getDefaultChatPhaseOneDomain,
  setDefaultChatPhaseOneDomain,
  resetDefaultChatPhaseOneDomain,

  // Pipeline
  runPhaseOnePipeline,

  // Convenience helpers
  rankCandidatesOnce,
  getPhaseOneReport,
  getPhaseOneFeatureFlags,
  classifyPlayerFromState,
  getChannelPressureMapFromState,
  validateAndHydrateSlice,

  // State access (promoted for convenience)
  getPhaseOneState,
  withPhaseOneState,
  phaseOneFeatureOverlay,

  // Core mutations (promoted for convenience)
  setPhaseOneNoveltyLedgerInState,
  setPhaseOneEpisodicMemoryInState,
  applyConversationalFingerprintDeltaInState,
  notePhaseOneCarryoverSummaryInState,
  blendConversationalFingerprintInState,

  // Analytics (promoted for convenience)
  classifyConversationalFingerprint,
  buildFingerprintScore,
  buildFatigueReport,
  computeCallbackPressure,
  computeNoveltyPressure,
  diffPhaseOneStateSlices,
  buildPhaseOneStateReport,
  buildPhaseOneFeatureFlags,
  buildChannelPressureMap,
  mergePhaseOneStateSlices,
  prunePhaseOneStateSlice,

  // Serialization
  serializePhaseOneStateSliceVersioned,
  hydratePhaseOneStateSliceVersioned,
  validatePhaseOneStateSlice,

  // Utilities
  clamp01,
  fingerprintDistance,
  summarizeFatigue,
  summarizeFingerprint,
  createDefaultConversationalFingerprint,
  createDefaultChatPhaseOneStateSlice,
  describePhaseOneState,
});
