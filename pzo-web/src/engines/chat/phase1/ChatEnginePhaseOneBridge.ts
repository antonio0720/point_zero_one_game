/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ENGINE PHASE 1 BRIDGE
 * FILE: pzo-web/src/engines/chat/phase1/ChatEnginePhaseOneBridge.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Bridge between the existing frontend ChatEngine.ts and the new Phase 1
 * novelty / episodic memory stack.
 *
 * This file is deliberately additive:
 * - it does not assume reducer ownership
 * - it does not rewrite the existing engine
 * - it expects ChatEngine.ts to call into it at four safe seams:
 *   1) constructor hydration
 *   2) committed message append
 *   3) reaction candidate ranking
 *   4) periodic / authoritative sync
 *
 * Beyond the four core seams this bridge also exposes:
 * - Scene-level observation (noteScene)
 * - Upstream signal observation (noteSignal)
 * - Callback resolution tracking (markCallbackUsed)
 * - Full diagnostic surface (getReport, getFeatureFlags, getChannelPressureMap)
 * - Ranked candidate inspection utilities
 * - Serialization helpers for persistence
 * - A factory function and optional singleton accessor
 * ============================================================================
 */

import type {
  ChatFeatureSnapshot,
  ChatMessage,
  ChatScenePlan,
  ChatUpstreamSignal,
  ChatVisibleChannel,
  UnixMs,
} from '../types';

import type { BotId } from '../../battle/types';

import {
  ChatNoveltyLedger,
  type ChatNoveltyLedgerCandidate,
  type ChatNoveltyLedgerScore,
  type ChatNoveltyLedgerSnapshot,
} from '../intelligence/ChatNoveltyLedger';

import {
  ChatEpisodicMemory,
  type ChatEpisodicCallbackCandidate,
  type ChatEpisodicEventType,
  type ChatEpisodicMemorySnapshot,
} from '../intelligence/ChatEpisodicMemory';

import {
  type ChatEngineStateWithPhaseOne,
  type ChatConversationalFingerprint,
  type ChatPhaseOneStateReport,
  type ChatPhaseOneFeatureFlags,
  type ChatPhaseOneChannelPressureMap,
  type ChatPhaseOneStateDiff,
  type ChatPhaseOneCallbackPressureScore,
  type ChatPhaseOneFatigueReport,
  type ChatFingerprintClassification,
  type ChatPhaseOneSerializedEnvelope,
  type ChatPhaseOneHydrationResult,
  applyConversationalFingerprintDeltaInState,
  blendConversationalFingerprintInState,
  buildPhaseOneFeatureFlags,
  buildPhaseOneStateReport,
  buildChannelPressureMap,
  buildFatigueReport,
  classifyConversationalFingerprint,
  clamp01,
  computeCallbackPressure,
  computeNoveltyPressure,
  decayFatigueInState,
  deriveFingerprintDeltaFromMessage,
  diffPhaseOneStateSlices,
  getPhaseOneState,
  hydratePhaseOneStateSliceVersioned,
  notePhaseOneCarryoverSummaryInState,
  phaseOneFeatureOverlay,
  serializePhaseOneStateSliceVersioned,
  setPhaseOneEpisodicMemoryInState,
  setPhaseOneNoveltyLedgerInState,
  setPhaseOneRecommendedCandidateIdInState,
  removeUnresolvedCallbackIdsInState,
} from './ChatStatePhaseOne';

// ============================================================================
// MARK: Bridge option types
// ============================================================================

export interface ChatEnginePhaseOneBridgeOptions {
  /**
   * Player ID to scope episodic memory and fingerprint tracking.
   */
  readonly playerId?: string;
  /**
   * Timestamp used to seed the novelty ledger and episodic memory at
   * construction time. Defaults to Date.now().
   */
  readonly now?: UnixMs;
  /**
   * If provided, the bridge will seed the novelty ledger with custom options
   * instead of the defaults.
   */
  readonly noveltyOptions?: Readonly<Record<string, unknown>>;
  /**
   * If provided, the bridge will seed the episodic memory with custom options.
   */
  readonly episodicOptions?: Readonly<Record<string, unknown>>;
  /**
   * Fatigue decay factor applied on each noteScene call. Default: 0.92.
   * Higher = slower decay; lower = faster cool-down between scenes.
   */
  readonly fatigueSceneDecay?: number;
  /**
   * Maximum composite score clamp, [0, 1]. Default: 1.0.
   */
  readonly maxCompositeScore?: number;
  /**
   * If true, the bridge will not emit console warnings in production builds.
   */
  readonly silent?: boolean;
}

// ============================================================================
// MARK: Candidate types
// ============================================================================

/**
 * A candidate response fed into the bridge's ranking pipeline.
 * Extends ChatNoveltyLedgerCandidate with optional callback pre-population
 * and a base weight hint from the upstream engine.
 */
export interface ChatPhaseOneResponseCandidate extends ChatNoveltyLedgerCandidate {
  /**
   * Pre-resolved callback candidates from the upstream system or persona layer.
   * When present, the first entry is preferred over ledger-queried callbacks.
   */
  readonly callbackCandidates?: readonly ChatEpisodicCallbackCandidate[];
  /**
   * Base weight hint supplied by the upstream engine, e.g., from a bark
   * relevance score or persona voiceprint fit score. [0, 1].
   */
  readonly baseWeight01?: number;
}

/**
 * Output of the bridge's ranking pipeline per candidate.
 */
export interface ChatPhaseOneRankedCandidate {
  readonly candidateId: string;
  /**
   * Full novelty score from the ledger's scoring pass.
   */
  readonly novelty: ChatNoveltyLedgerScore;
  /**
   * Best matched callback for this candidate, if any.
   */
  readonly callback?: ChatEpisodicCallbackCandidate;
  /**
   * Final composite score combining novelty, base weight, callback salience,
   * fatigue, and overlay modifiers.
   */
  readonly compositeScore01: number;
  /**
   * Diagnostic notes accumulated during scoring.
   */
  readonly notes: readonly string[];
}

/**
 * Result of a full ranking pass, with metadata.
 */
export interface ChatPhaseOneRankingResult {
  readonly rankedCandidates: readonly ChatPhaseOneRankedCandidate[];
  readonly topCandidateId: string | null;
  readonly secondCandidateId: string | null;
  readonly overallFatigue01: number;
  readonly noveltyPressure01: number;
  readonly callbacksPresent: boolean;
  readonly notes: readonly string[];
}

/**
 * A single signal observation record, for tracing what the bridge forwarded
 * to episodic memory on each signal.
 */
export interface ChatSignalObservationRecord {
  readonly signalType: string;
  readonly eventType: ChatEpisodicEventType;
  readonly summary: string;
  readonly channelId?: ChatVisibleChannel;
  readonly pressureBand?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly observedAt: UnixMs;
}

/**
 * Diagnostic snapshot of the bridge's internal state, for dev overlays
 * and telemetry.
 */
export interface ChatEnginePhaseOneBridgeSnapshot {
  readonly createdAt: UnixMs;
  readonly playerId?: string;
  readonly hydrated: boolean;
  readonly messageCount: number;
  readonly sceneCount: number;
  readonly signalCount: number;
  readonly rankingCallCount: number;
  readonly callbackUsedCount: number;
  readonly lastSyncAt?: UnixMs;
  readonly noveltyLedger: ChatNoveltyLedgerSnapshot | null;
  readonly episodicMemory: ChatEpisodicMemorySnapshot | null;
  readonly recentSignals: readonly ChatSignalObservationRecord[];
}

// ============================================================================
// MARK: Signal dispatch type
// ============================================================================

interface ResolvedSignalSummary {
  readonly eventType: ChatEpisodicEventType;
  readonly summary: string;
  readonly channelId?: ChatVisibleChannel;
  readonly botId?: BotId | string | null;
  readonly counterpartId?: string | null;
  readonly pressureBand?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// ============================================================================
// MARK: ChatEnginePhaseOneBridge class
// ============================================================================

export class ChatEnginePhaseOneBridge {
  private readonly novelty: ChatNoveltyLedger;
  private readonly memory: ChatEpisodicMemory;
  private readonly playerId?: string;
  private readonly fatigueSceneDecay: number;
  private readonly maxCompositeScore: number;

  // Telemetry counters
  private hydrated = false;
  private messageCount = 0;
  private sceneCount = 0;
  private signalCount = 0;
  private rankingCallCount = 0;
  private callbackUsedCount = 0;
  private lastSyncAt?: UnixMs;
  private recentSignals: ChatSignalObservationRecord[] = [];
  private static readonly MAX_RECENT_SIGNALS = 32;

  public constructor(options: ChatEnginePhaseOneBridgeOptions = {}) {
    const now = options.now ?? (Date.now() as UnixMs);
    this.playerId = options.playerId;
    this.fatigueSceneDecay = options.fatigueSceneDecay ?? 0.92;
    this.maxCompositeScore = options.maxCompositeScore ?? 1.0;
    this.novelty = new ChatNoveltyLedger(options.noveltyOptions ?? {}, now);
    this.memory = new ChatEpisodicMemory(options.episodicOptions ?? {}, now);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MARK: Hydration
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Hydrate the bridge's internal novelty ledger and episodic memory from
   * an existing engine state slice.
   */
  public hydrateFromState(state: ChatEngineStateWithPhaseOne): void {
    const phaseOne = getPhaseOneState(state);
    if (phaseOne.noveltyLedger) this.novelty.restore(phaseOne.noveltyLedger);
    if (phaseOne.episodicMemory) this.memory.restore(phaseOne.episodicMemory);
    this.hydrated = true;
  }

  /**
   * Hydrate only if not already hydrated. Safe to call on every engine tick.
   */
  public ensureHydrated(state: ChatEngineStateWithPhaseOne): void {
    if (this.hydrated) return;
    this.hydrateFromState(state);
  }

  /**
   * Force re-hydration from state, discarding any pending in-memory changes.
   * Use when authoritative server state replaces local state.
   */
  public forceRehydrate(
    state: ChatEngineStateWithPhaseOne,
    now: UnixMs = Date.now() as UnixMs,
  ): ChatEngineStateWithPhaseOne {
    this.hydrated = false;
    this.hydrateFromState(state);
    return this.syncIntoState(state, undefined, now);
  }

  /**
   * Hydrate from a versioned serialized envelope (e.g., from localStorage).
   * Returns the resulting engine state with the hydrated slice merged in.
   */
  public hydrateFromEnvelope(
    state: ChatEngineStateWithPhaseOne,
    envelope: unknown,
    now: UnixMs = Date.now() as UnixMs,
  ): { state: ChatEngineStateWithPhaseOne; result: ChatPhaseOneHydrationResult } {
    const result = hydratePhaseOneStateSliceVersioned(envelope, now);
    const hydratedState = setPhaseOneNoveltyLedgerInState(
      setPhaseOneEpisodicMemoryInState(state, result.slice.episodicMemory, now),
      result.slice.noveltyLedger,
      now,
    );
    this.hydrateFromState(hydratedState);
    return { state: hydratedState, result };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MARK: Core seam 2 — noteCommittedMessage
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Called by ChatEngine.ts when a message is committed to the transcript.
   * Updates novelty ledger, episodic memory, and conversational fingerprint.
   *
   * @param state      Current engine state with phase-one slice
   * @param message    The committed message
   * @param featureSnapshot  Optional feature snapshot at commit time
   * @param now        Timestamp (defaults to message.ts)
   * @returns New engine state with updated phase-one slice
   */
  public noteCommittedMessage(
    state: ChatEngineStateWithPhaseOne,
    message: ChatMessage,
    featureSnapshot?: ChatFeatureSnapshot,
    now: UnixMs = (message as { ts?: number }).ts as UnixMs ?? Date.now() as UnixMs,
  ): ChatEngineStateWithPhaseOne {
    this.ensureHydrated(state);
    this.novelty.noteMessage(message, now);
    this.memory.noteMessage(message, now);
    this.messageCount += 1;

    let next = state;
    next = setPhaseOneNoveltyLedgerInState(next, this.novelty.snapshot(now), now);
    next = setPhaseOneEpisodicMemoryInState(next, this.memory.snapshot(), now);

    const fingerprintDelta = deriveFingerprintDeltaFromMessage(message, featureSnapshot);
    next = applyConversationalFingerprintDeltaInState(next, fingerprintDelta, now);
    next = notePhaseOneCarryoverSummaryInState(next, this.memory.buildCarryoverSummary(), now);

    this.lastSyncAt = now;
    return next;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MARK: Scene observation
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Called when a scene plan completes or is summarized.
   * Updates both the novelty ledger and episodic memory with scene-level data.
   * Applies a fatigue decay pass to reflect the time elapsed.
   *
   * @param state   Current engine state
   * @param scene   The completed scene plan
   * @param summary Human-readable scene summary for episodic memory
   * @param now     Timestamp (defaults to scene.startedAt)
   * @returns New engine state with updated phase-one slice
   */
  public noteScene(
    state: ChatEngineStateWithPhaseOne,
    scene: ChatScenePlan,
    summary: string,
    now: UnixMs = scene.startedAt,
  ): ChatEngineStateWithPhaseOne {
    this.ensureHydrated(state);
    this.novelty.noteScene(scene, scene.primaryChannel, now);
    this.memory.noteScene(scene, summary, now);
    this.sceneCount += 1;

    let next = state;
    next = setPhaseOneNoveltyLedgerInState(next, this.novelty.snapshot(now), now);
    next = setPhaseOneEpisodicMemoryInState(next, this.memory.snapshot(), now);
    next = notePhaseOneCarryoverSummaryInState(next, this.memory.buildCarryoverSummary(), now);

    // Apply per-scene fatigue decay so channels cool down over time
    if (this.fatigueSceneDecay < 1.0) {
      next = decayFatigueInState(next, this.fatigueSceneDecay, now);
    }

    this.lastSyncAt = now;
    return next;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MARK: Upstream signal observation
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Called when the engine receives a meaningful upstream signal (shield
   * breach, cascade start, sovereignty, etc.).
   * Translates the signal into an episodic memory event and blends a
   * fingerprint nudge reflecting the emotional weight.
   *
   * @param state   Current engine state
   * @param signal  The upstream signal
   * @param now     Timestamp (defaults to signal.emittedAt)
   * @returns New engine state, or unchanged state if signal is unrecognized
   */
  public noteSignal(
    state: ChatEngineStateWithPhaseOne,
    signal: ChatUpstreamSignal,
    now: UnixMs = (signal as { emittedAt?: number }).emittedAt as UnixMs ?? Date.now() as UnixMs,
  ): ChatEngineStateWithPhaseOne {
    this.ensureHydrated(state);

    const resolved = this.resolveSignal(signal);
    if (!resolved) return state;

    this.memory.recordEvent(resolved.eventType, {
      roomId: null,
      channelId: resolved.channelId,
      summary: resolved.summary,
      rawText: resolved.summary,
      botId: resolved.botId ?? null,
      counterpartId: resolved.counterpartId ?? null,
      pressureBand: resolved.pressureBand,
      tags: ['signal', String((signal as { signalType?: unknown }).signalType ?? '').toLowerCase()],
    }, now);

    this.signalCount += 1;
    this.recordSignalObservation(signal, resolved, now);

    let next = state;
    next = setPhaseOneEpisodicMemoryInState(next, this.memory.snapshot(), now);
    next = notePhaseOneCarryoverSummaryInState(next, this.memory.buildCarryoverSummary(), now);

    // Apply signal-specific fingerprint nudge
    const fpNudge = this.deriveFingerprintNudgeFromSignal(resolved);
    if (fpNudge) {
      next = blendConversationalFingerprintInState(next, fpNudge, 0.15, now);
    }

    this.lastSyncAt = now;
    return next;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MARK: Core seam 3 — rankResponseCandidates
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Rank response candidates using the novelty ledger, episodic callback
   * matching, and the phase-one overlay derived from the current feature
   * snapshot.
   *
   * @param state           Current engine state
   * @param candidates      Candidates to rank
   * @param channelId       Active channel for callback context
   * @param sceneRole       Current scene role for callback filtering
   * @param featureSnapshot Feature snapshot at ranking time
   * @param now             Timestamp
   * @returns Sorted ranked candidates (highest composite score first)
   */
  public rankResponseCandidates(
    state: ChatEngineStateWithPhaseOne,
    candidates: readonly ChatPhaseOneResponseCandidate[],
    channelId: ChatVisibleChannel,
    sceneRole: string | null,
    featureSnapshot: ChatFeatureSnapshot,
    now: UnixMs = featureSnapshot.createdAt,
  ): readonly ChatPhaseOneRankedCandidate[] {
    this.ensureHydrated(state);
    this.rankingCallCount += 1;

    const overlay = phaseOneFeatureOverlay(state, featureSnapshot);
    const noveltyScores = this.novelty.rankCandidates(candidates, now);

    const ranked = noveltyScores.map((noveltyScore) => {
      const candidate = candidates.find((c) => c.candidateId === noveltyScore.candidateId);
      const callback = this.resolveCallbackForCandidate(candidate, channelId, sceneRole);

      const composite = this.computeCompositeScore(noveltyScore, candidate, callback, overlay);
      const notes = this.buildScoringNotes(noveltyScore, callback, overlay, composite);

      return {
        candidateId: noveltyScore.candidateId,
        novelty: noveltyScore,
        callback,
        compositeScore01: composite,
        notes,
      };
    });

    ranked.sort((a, b) =>
      b.compositeScore01 - a.compositeScore01 ||
      a.candidateId.localeCompare(b.candidateId),
    );

    return ranked;
  }

  /**
   * Convenience: run a full ranking pass and return the full result with
   * metadata about the ranking context.
   */
  public rankResponseCandidatesFull(
    state: ChatEngineStateWithPhaseOne,
    candidates: readonly ChatPhaseOneResponseCandidate[],
    channelId: ChatVisibleChannel,
    sceneRole: string | null,
    featureSnapshot: ChatFeatureSnapshot,
    now: UnixMs = featureSnapshot.createdAt,
  ): ChatPhaseOneRankingResult {
    const ranked = this.rankResponseCandidates(state, candidates, channelId, sceneRole, featureSnapshot, now);
    const phaseOne = getPhaseOneState(state);
    const overallFatigue01 = phaseOne.semanticFatigueByChannel[channelId] ?? 0;
    const noveltyPressure01 = computeNoveltyPressure(phaseOne);
    const callbacksPresent = ranked.some((r) => r.callback !== undefined);
    const notes: string[] = [];

    if (ranked.length === 0) notes.push('No candidates to rank.');
    if (overallFatigue01 > 0.7) notes.push(`High channel fatigue on ${channelId}.`);

    return {
      rankedCandidates: ranked,
      topCandidateId: ranked[0]?.candidateId ?? null,
      secondCandidateId: ranked[1]?.candidateId ?? null,
      overallFatigue01,
      noveltyPressure01,
      callbacksPresent,
      notes,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MARK: Core seam 4 — syncIntoState
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Authoritative sync: flush the bridge's internal state into the engine
   * state. Called on periodic ticks or after a batch of observations.
   *
   * @param state                   Current engine state
   * @param recommendedCandidateId  ID of the top-ranked candidate, if known
   * @param now                     Timestamp
   * @returns New engine state with fully synchronized phase-one slice
   */
  public syncIntoState(
    state: ChatEngineStateWithPhaseOne,
    recommendedCandidateId: string | undefined,
    now: UnixMs = Date.now() as UnixMs,
  ): ChatEngineStateWithPhaseOne {
    this.ensureHydrated(state);
    let next = state;
    next = setPhaseOneNoveltyLedgerInState(next, this.novelty.snapshot(now), now);
    next = setPhaseOneEpisodicMemoryInState(next, this.memory.snapshot(), now);
    next = setPhaseOneRecommendedCandidateIdInState(next, recommendedCandidateId, now);
    next = notePhaseOneCarryoverSummaryInState(next, this.memory.buildCarryoverSummary(), now);
    this.lastSyncAt = now;
    return next;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MARK: Callback resolution
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Mark a memory as reused (callback fired) and remove its ID from the
   * unresolved list in state.
   */
  public markCallbackUsed(
    state: ChatEngineStateWithPhaseOne,
    memoryId: string,
    callbackId?: string,
    now: UnixMs = Date.now() as UnixMs,
  ): ChatEngineStateWithPhaseOne {
    this.ensureHydrated(state);
    this.memory.markReused(memoryId, callbackId, now);
    this.callbackUsedCount += 1;
    let next = setPhaseOneEpisodicMemoryInState(state, this.memory.snapshot(), now);
    next = removeUnresolvedCallbackIdsInState(next, [memoryId], now);
    return next;
  }

  /**
   * Mark multiple memory IDs as resolved in a single operation.
   */
  public markCallbacksUsed(
    state: ChatEngineStateWithPhaseOne,
    entries: readonly { memoryId: string; callbackId?: string }[],
    now: UnixMs = Date.now() as UnixMs,
  ): ChatEngineStateWithPhaseOne {
    this.ensureHydrated(state);
    for (const { memoryId, callbackId } of entries) {
      this.memory.markReused(memoryId, callbackId, now);
      this.callbackUsedCount += 1;
    }
    let next = setPhaseOneEpisodicMemoryInState(state, this.memory.snapshot(), now);
    next = removeUnresolvedCallbackIdsInState(next, entries.map((e) => e.memoryId), now);
    return next;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MARK: Query surface
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Query episodic callbacks matching a specific context (bot, channel, role).
   * Returns up to `maxResults` scored callback candidates.
   */
  public queryCallbacks(options: {
    readonly botId?: BotId | string | null;
    readonly counterpartId?: string | null;
    readonly roomId?: string | null;
    readonly channelId?: ChatVisibleChannel | null;
    readonly sceneRole?: string | null;
    readonly maxResults?: number;
  }): readonly ChatEpisodicCallbackCandidate[] {
    return this.memory.queryCallbacks(options);
  }

  /**
   * Query callbacks for a specific event type.
   */
  public queryCallbacksByEventType(
    eventType: ChatEpisodicEventType,
    maxResults = 5,
  ): readonly ChatEpisodicCallbackCandidate[] {
    return this.memory.queryCallbacks({ maxResults }).filter((c) => c.eventType === eventType).slice(0, maxResults);
  }

  /**
   * Get all currently unresolved callback IDs from episodic memory.
   */
  public getUnresolvedCallbackIds(): readonly string[] {
    return this.memory.snapshot().unresolvedMemoryIds;
  }

  /**
   * Get the current carryover summary from episodic memory.
   */
  public getCarryoverSummary(): string | undefined {
    return this.memory.buildCarryoverSummary();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MARK: Diagnostic surface
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Build a full phase-one state report from the current engine state.
   */
  public getReport(
    state: ChatEngineStateWithPhaseOne,
    now: UnixMs = Date.now() as UnixMs,
  ): ChatPhaseOneStateReport {
    this.ensureHydrated(state);
    return buildPhaseOneStateReport(state, now);
  }

  /**
   * Derive feature flags from the current phase-one state slice.
   */
  public getFeatureFlags(state: ChatEngineStateWithPhaseOne): ChatPhaseOneFeatureFlags {
    this.ensureHydrated(state);
    return buildPhaseOneFeatureFlags(getPhaseOneState(state));
  }

  /**
   * Build the per-channel pressure map from the current state.
   */
  public getChannelPressureMap(
    state: ChatEngineStateWithPhaseOne,
    now: UnixMs = Date.now() as UnixMs,
  ): ChatPhaseOneChannelPressureMap {
    this.ensureHydrated(state);
    return buildChannelPressureMap(getPhaseOneState(state), now);
  }

  /**
   * Build a fatigue report from the current state.
   */
  public getFatigueReport(
    state: ChatEngineStateWithPhaseOne,
    now: UnixMs = Date.now() as UnixMs,
  ): ChatPhaseOneFatigueReport {
    this.ensureHydrated(state);
    return buildFatigueReport(getPhaseOneState(state), now);
  }

  /**
   * Compute callback pressure from the current state.
   */
  public getCallbackPressure(
    state: ChatEngineStateWithPhaseOne,
    now: UnixMs = Date.now() as UnixMs,
  ): ChatPhaseOneCallbackPressureScore {
    this.ensureHydrated(state);
    return computeCallbackPressure(getPhaseOneState(state), now);
  }

  /**
   * Classify the current player fingerprint.
   */
  public getFingerprintClassification(
    state: ChatEngineStateWithPhaseOne,
  ): ChatFingerprintClassification {
    this.ensureHydrated(state);
    return classifyConversationalFingerprint(getPhaseOneState(state).conversationalFingerprint);
  }

  /**
   * Diff the current state against a previous snapshot.
   */
  public diffAgainstState(
    before: ChatEngineStateWithPhaseOne,
    after: ChatEngineStateWithPhaseOne,
    now: UnixMs = Date.now() as UnixMs,
  ): ChatPhaseOneStateDiff {
    return diffPhaseOneStateSlices(getPhaseOneState(before), getPhaseOneState(after), now);
  }

  /**
   * Get a snapshot of the bridge's internal telemetry counters.
   */
  public getBridgeSnapshot(now: UnixMs = Date.now() as UnixMs): ChatEnginePhaseOneBridgeSnapshot {
    return {
      createdAt: now,
      playerId: this.playerId,
      hydrated: this.hydrated,
      messageCount: this.messageCount,
      sceneCount: this.sceneCount,
      signalCount: this.signalCount,
      rankingCallCount: this.rankingCallCount,
      callbackUsedCount: this.callbackUsedCount,
      lastSyncAt: this.lastSyncAt,
      noveltyLedger: this.hydrated ? this.novelty.snapshot(now) : null,
      episodicMemory: this.hydrated ? this.memory.snapshot() : null,
      recentSignals: [...this.recentSignals],
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MARK: Serialization
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Serialize the current phase-one state slice into a versioned envelope
   * for localStorage / server persistence.
   */
  public serializeState(
    state: ChatEngineStateWithPhaseOne,
    now: UnixMs = Date.now() as UnixMs,
  ): ChatPhaseOneSerializedEnvelope | undefined {
    return serializePhaseOneStateSliceVersioned(state, this.playerId, now);
  }

  /**
   * Load a persisted envelope into the bridge and engine state.
   */
  public deserializeIntoState(
    state: ChatEngineStateWithPhaseOne,
    envelope: unknown,
    now: UnixMs = Date.now() as UnixMs,
  ): { state: ChatEngineStateWithPhaseOne; result: ChatPhaseOneHydrationResult } {
    return this.hydrateFromEnvelope(state, envelope, now);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MARK: Private helpers
  // ══════════════════════════════════════════════════════════════════════════

  private resolveCallbackForCandidate(
    candidate: ChatPhaseOneResponseCandidate | undefined,
    channelId: ChatVisibleChannel,
    sceneRole: string | null,
  ): ChatEpisodicCallbackCandidate | undefined {
    if (!candidate) return undefined;

    // Prefer pre-resolved callback from caller
    if (candidate.callbackCandidates && candidate.callbackCandidates.length > 0) {
      return candidate.callbackCandidates[0];
    }

    // Query the memory for a matching callback
    const results = this.memory.queryCallbacks({
      botId: candidate.botId,
      counterpartId: candidate.counterpartId ?? null,
      roomId: candidate.roomId ?? null,
      channelId,
      sceneRole,
      maxResults: 1,
    });

    return results[0];
  }

  private computeCompositeScore(
    noveltyScore: ChatNoveltyLedgerScore,
    candidate: ChatPhaseOneResponseCandidate | undefined,
    callback: ChatEpisodicCallbackCandidate | undefined,
    overlay: ChatFeatureSnapshot & {
      readonly semanticFatigue01: number;
      readonly unresolvedCallbacks: number;
      readonly noveltySeeking01: number;
      readonly stabilitySeeking01: number;
    },
  ): number {
    let composite = noveltyScore.noveltyScore01;

    // Base weight hint from the upstream engine
    composite += (candidate?.baseWeight01 ?? 0) * 0.25;

    // Callback salience bonus
    composite += (callback?.score01 ?? 0) * 0.20;

    // Penalize for high channel fatigue
    composite -= overlay.semanticFatigue01 * 0.10;

    // Novelty-seeking bonus for fresh content
    composite += overlay.noveltySeeking01 * 0.05;

    // Stability-seeking bonus for re-use when there are unresolved callbacks
    if (callback?.unresolved) {
      composite += overlay.stabilitySeeking01 * 0.03;
    }

    return clamp01(
      Math.max(0, Math.min(this.maxCompositeScore, Number(composite.toFixed(6)))),
    );
  }

  private buildScoringNotes(
    noveltyScore: ChatNoveltyLedgerScore,
    callback: ChatEpisodicCallbackCandidate | undefined,
    overlay: ChatFeatureSnapshot & {
      readonly semanticFatigue01: number;
      readonly unresolvedCallbacks: number;
      readonly noveltySeeking01: number;
      readonly stabilitySeeking01: number;
    },
    composite: number,
  ): readonly string[] {
    const notes = [...noveltyScore.notes];
    if (callback) notes.push(`callback:${callback.eventType.toLowerCase()}`);
    if (overlay.semanticFatigue01 > 0.55) notes.push('fatigue_high');
    if (overlay.unresolvedCallbacks > 0) notes.push(`unresolved_callbacks:${overlay.unresolvedCallbacks}`);
    if (composite < 0.20) notes.push('low_composite_score');
    if (composite > 0.80) notes.push('strong_composite_score');
    return notes;
  }

  private resolveSignal(signal: ChatUpstreamSignal): ResolvedSignalSummary | null {
    const s = signal as Record<string, unknown>;
    switch (s['signalType']) {
      case 'SHIELD_LAYER_BREACHED':
        return {
          eventType: 'BREACH',
          summary: `Shield layer ${s['layerId'] ?? 'unknown'} breached.`,
          channelId: 'GLOBAL',
          pressureBand: 'HIGH',
        };
      case 'BOT_ATTACK_FIRED':
        return {
          eventType: 'PUBLIC_WITNESS',
          summary: `Bot attack fired by ${s['botId'] ?? 'unknown'}.`,
          channelId: 'GLOBAL',
          botId: (s['botId'] as BotId | string | null | undefined) ?? null,
          pressureBand: 'HIGH',
        };
      case 'CASCADE_CHAIN_STARTED':
        return {
          eventType: 'COLLAPSE',
          summary: `Cascade chain ${s['chainId'] ?? 'unknown'} started.`,
          channelId: 'GLOBAL',
          pressureBand: 'CRITICAL',
        };
      case 'CASCADE_CHAIN_BROKEN':
        return {
          eventType: 'COMEBACK',
          summary: `Cascade chain ${s['chainId'] ?? 'unknown'} broken.`,
          channelId: 'GLOBAL',
          pressureBand: 'MEDIUM',
        };
      case 'SOVEREIGNTY_ACHIEVED':
        return {
          eventType: 'SOVEREIGNTY',
          summary: 'Sovereignty achieved.',
          channelId: 'GLOBAL',
          pressureBand: 'LOW',
        };
      case 'SHIELD_LAYER_RESTORED':
        return {
          eventType: 'RESCUE',
          summary: `Shield layer ${s['layerId'] ?? 'unknown'} restored.`,
          channelId: 'GLOBAL',
          pressureBand: 'LOW',
        };
      case 'BOT_RETREAT_FIRED':
        return {
          eventType: 'DISCIPLINE',
          summary: `Bot ${s['botId'] ?? 'unknown'} retreated.`,
          channelId: 'GLOBAL',
          pressureBand: 'LOW',
        };
      case 'DEAL_ROOM_OFFER_ACCEPTED':
        return {
          eventType: 'DEAL_ROOM_STANDOFF',
          summary: 'Deal room offer accepted.',
          channelId: 'DEAL_ROOM',
          pressureBand: 'MEDIUM',
        };
      case 'DEAL_ROOM_OFFER_REJECTED':
        return {
          eventType: 'DEAL_ROOM_STANDOFF',
          summary: 'Deal room offer rejected.',
          channelId: 'DEAL_ROOM',
          pressureBand: 'MEDIUM',
        };
      case 'PLAYER_GREED_SIGNAL':
        return {
          eventType: 'GREED',
          summary: 'Player greed signal detected.',
          channelId: 'GLOBAL',
          pressureBand: 'MEDIUM',
        };
      case 'PLAYER_BLUFF_SIGNAL':
        return {
          eventType: 'BLUFF',
          summary: 'Player bluff signal detected.',
          channelId: 'GLOBAL',
          pressureBand: 'MEDIUM',
        };
      case 'PLAYER_HESITATION_SIGNAL':
        return {
          eventType: 'HESITATION',
          summary: 'Player hesitation signal detected.',
          channelId: 'GLOBAL',
          pressureBand: 'LOW',
        };
      case 'PLAYER_OVERCONFIDENCE_SIGNAL':
        return {
          eventType: 'OVERCONFIDENCE',
          summary: 'Player overconfidence signal detected.',
          channelId: 'GLOBAL',
          pressureBand: 'MEDIUM',
        };
      case 'PLAYER_PERFECT_DEFENSE':
        return {
          eventType: 'PERFECT_DEFENSE',
          summary: 'Player achieved perfect defense.',
          channelId: 'GLOBAL',
          pressureBand: 'LOW',
        };
      case 'PUBLIC_HUMILIATION':
        return {
          eventType: 'HUMILIATION',
          summary: `Public humiliation event: ${s['reason'] ?? 'unknown'}.`,
          channelId: 'GLOBAL',
          pressureBand: 'CRITICAL',
        };
      case 'PRIVATE_CONFESSION':
        return {
          eventType: 'PRIVATE_CONFESSION',
          summary: 'Private confession recorded.',
          channelId: 'SYNDICATE',
          pressureBand: 'LOW',
        };
      case 'FAILED_GAMBLE':
        return {
          eventType: 'FAILED_GAMBLE',
          summary: `Failed gamble: ${s['reason'] ?? 'unknown'}.`,
          channelId: 'GLOBAL',
          pressureBand: 'HIGH',
        };
      default:
        return null;
    }
  }

  private deriveFingerprintNudgeFromSignal(
    resolved: ResolvedSignalSummary,
  ): Partial<Omit<ChatConversationalFingerprint, 'updatedAt'>> | null {
    switch (resolved.eventType) {
      case 'COLLAPSE':
        return { collapseProne01: 0.65, impulsive01: 0.55 };
      case 'COMEBACK':
        return { comebackProne01: 0.68, publicPerformer01: 0.60 };
      case 'BREACH':
        return { collapseProne01: 0.58, defensive01: 0.62 };
      case 'SOVEREIGNTY':
        return { publicPerformer01: 0.70, patient01: 0.65, comebackProne01: 0.60 };
      case 'GREED':
        return { greedy01: 0.68 };
      case 'BLUFF':
        return { bluffHeavy01: 0.65 };
      case 'HESITATION':
        return { patient01: 0.62, defensive01: 0.60 };
      case 'OVERCONFIDENCE':
        return { impulsive01: 0.65, greedy01: 0.60 };
      case 'PERFECT_DEFENSE':
        return { defensive01: 0.70, procedureAware01: 0.65 };
      case 'HUMILIATION':
        return { publicPerformer01: 0.45, defensive01: 0.68 };
      case 'DISCIPLINE':
        return { patient01: 0.65, procedureAware01: 0.62 };
      case 'DEAL_ROOM_STANDOFF':
        return { greedy01: 0.62, literal01: 0.65 };
      case 'FAILED_GAMBLE':
        return { greedy01: 0.58, impulsive01: 0.62, collapseProne01: 0.58 };
      case 'RESCUE':
        return { defensive01: 0.55, patient01: 0.60 };
      default:
        return null;
    }
  }

  private recordSignalObservation(
    signal: ChatUpstreamSignal,
    resolved: ResolvedSignalSummary,
    now: UnixMs,
  ): void {
    const record: ChatSignalObservationRecord = {
      signalType: String((signal as Record<string, unknown>)['signalType'] ?? ''),
      eventType: resolved.eventType,
      summary: resolved.summary,
      channelId: resolved.channelId,
      pressureBand: resolved.pressureBand,
      observedAt: now,
    };
    this.recentSignals = [
      record,
      ...this.recentSignals,
    ].slice(0, ChatEnginePhaseOneBridge.MAX_RECENT_SIGNALS);
  }
}

// ============================================================================
// MARK: Factory and singleton
// ============================================================================

export function createChatEnginePhaseOneBridge(
  options: ChatEnginePhaseOneBridgeOptions = {},
): ChatEnginePhaseOneBridge {
  return new ChatEnginePhaseOneBridge(options);
}

let _defaultBridge: ChatEnginePhaseOneBridge | null = null;

/**
 * Get or create the default singleton bridge.
 * Useful for modules that do not manage bridge lifecycle directly.
 *
 * NOTE: The singleton is not tied to a specific player ID. If your app
 * needs per-player isolation, use `createChatEnginePhaseOneBridge` directly.
 */
export function getDefaultChatEnginePhaseOneBridge(
  options?: ChatEnginePhaseOneBridgeOptions,
): ChatEnginePhaseOneBridge {
  if (!_defaultBridge) {
    _defaultBridge = new ChatEnginePhaseOneBridge(options ?? {});
  }
  return _defaultBridge;
}

/**
 * Replace the singleton. Useful in tests and when switching players.
 */
export function setDefaultChatEnginePhaseOneBridge(
  bridge: ChatEnginePhaseOneBridge,
): void {
  _defaultBridge = bridge;
}

/**
 * Reset the singleton. Forces re-creation on next getDefaultChatEnginePhaseOneBridge call.
 */
export function resetDefaultChatEnginePhaseOneBridge(): void {
  _defaultBridge = null;
}

// ============================================================================
// MARK: Namespace export
// ============================================================================

/**
 * ChatEnginePhaseOneBridgeNS — frozen namespace aggregating every public
 * symbol from this module.
 */
export const ChatEnginePhaseOneBridgeNS = Object.freeze({
  // Class
  ChatEnginePhaseOneBridge,

  // Factory and singleton helpers
  createChatEnginePhaseOneBridge,
  getDefaultChatEnginePhaseOneBridge,
  setDefaultChatEnginePhaseOneBridge,
  resetDefaultChatEnginePhaseOneBridge,
});
