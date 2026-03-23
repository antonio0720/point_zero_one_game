/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT PHASE 1 BARREL INDEX
 * FILE: backend/src/game/engine/chat/phase1/index.ts
 * VERSION: 2026.03.22-phase1-index.v1
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative public entry surface for the backend chat Phase 1 module.
 *
 * Phase 1 owns two subsystems:
 *
 *   1. NOVELTY + EPISODIC MEMORY STATE (ChatStatePhaseOne)
 *      Additive state slice helpers for Phase 1 novelty tracking and episodic
 *      memory. This file augments ChatState without a full reducer rewrite.
 *      It defines the PhaseOne state slice that tracks the conversational
 *      fingerprint, novelty ledger snapshot, episodic memory snapshot,
 *      per-channel semantic fatigue, and unresolved callback registry.
 *
 *   2. INTELLIGENCE BRIDGE (ChatEnginePhaseOneBridge)
 *      Authoritative backend bridge between ChatEngine and the Phase 1
 *      novelty / episodic memory intelligence stack. Stateful in its
 *      intelligence objects; stateless with respect to ChatState ownership.
 *      All state mutations return immutable ChatStateWithPhaseOne values.
 *
 * Architecture seams (ChatEngine calls into bridge at these points):
 * ──────────────────────────────────────────────────────────────────
 *   Seam 1: constructor + hydration
 *     → bridge.hydrateFromState(state) | bridge.ensureHydrated(state)
 *
 *   Seam 2: committed message append
 *     → bridge.noteCommittedMessage(state, message, now) → ChatStateWithPhaseOne
 *     → bridge.noteCommittedMessages(state, messages, now) → ChatStateWithPhaseOne
 *
 *   Seam 3: scene plan ingestion
 *     → bridge.noteScene(state, scene, summary, now) → ChatStateWithPhaseOne
 *     → bridge.noteScenes(state, entries, now) → ChatStateWithPhaseOne
 *
 *   Seam 4: upstream signal normalization
 *     → bridge.noteSignal(state, envelope, now) → ChatStateWithPhaseOne
 *     → bridge.noteSignals(state, envelopes, now) → ChatStateWithPhaseOne
 *
 *   Seam 5a: NPC candidate ranking (phase-enriched candidates)
 *     → bridge.rankResponseCandidates(state, candidates, channelId, sceneRole, now)
 *
 *   Seam 5b: raw scene candidate ranking (novelty score only)
 *     → bridge.rankSceneCandidates(state, candidates, now)
 *
 *   Seam 6: periodic / authoritative sync
 *     → bridge.syncIntoState(state, recommendedCandidateId, now) → ChatStateWithPhaseOne
 *
 *   Seam 7: rehydration after persistence restore
 *     → bridge.forceRehydrate(state)
 *
 * STATE LAYER (ChatStatePhaseOne)
 * ─────────────────────────────────
 * Types:
 * - ChatConversationalFingerprint  — 13-axis behavioral fingerprint
 * - ChatPhaseOneStateSlice         — immutable Phase 1 state slice shape
 * - ChatStateWithPhaseOne          — union: ChatState + optional phaseOne slice
 *
 * Default creators:
 * - createDefaultConversationalFingerprint(now?)
 * - createDefaultChatPhaseOneStateSlice(now?)
 *
 * State accessors (read-only):
 * - getPhaseOneState(state)   — returns slice or default empty slice
 *
 * State mutators (all return new state, never mutate in place):
 * - withPhaseOneState(state, phaseOne)
 * - setPhaseOneNoveltyLedgerInState(state, snapshot, syncedAt?)
 * - setPhaseOneEpisodicMemoryInState(state, snapshot, syncedAt?)
 * - setPhaseOneRecommendedCandidateIdInState(state, candidateId?, syncedAt?)
 * - setSemanticFatigueInState(state, channelId, fatigue01, syncedAt?)
 * - applyConversationalFingerprintDeltaInState(state, delta, syncedAt?)
 * - notePhaseOneCarryoverSummaryInState(state, summary, syncedAt?)
 *
 * Serialization / hydration:
 * - serializePhaseOneStateSlice(state)
 * - hydratePhaseOneStateSlice(raw, now?)
 *
 * BRIDGE LAYER (ChatEnginePhaseOneBridge)
 * ──────────────────────────────────────────
 * Types:
 * - ChatPhaseOneBridgeOptions       — constructor options
 * - ChatPhaseOneResponseCandidate   — enriched candidate for composite ranking
 * - ChatPhaseOneRankedCandidate     — output of rankResponseCandidates
 * - ChatPhaseOneBridgeDiagnostics   — full bridge diagnostics snapshot
 * - ChatPhaseOneBridgeHealthSnapshot — health summary with warnings
 * - ChatPhaseOneBridgeSignalSummary  — structured signal descriptor
 * - ChatPhaseOneBridgeSyncReport     — output of buildSyncReport
 * - ChatPhaseOneBattleContext        — parsed battle signal context
 * - ChatPhaseOneRunContext           — parsed run signal context
 * - ChatPhaseOneEconomyContext       — parsed economy signal context
 * - ChatPhaseOneLiveOpsContext       — parsed liveops signal context
 *
 * Class:
 * - ChatEnginePhaseOneBridge         — authoritative bridge class
 *
 * Bridge public methods (all on the class):
 *   Lifecycle:
 *   - hydrateFromState(state)
 *   - ensureHydrated(state)
 *   - forceRehydrate(state)
 *
 *   Ingestion seams:
 *   - noteCommittedMessage(state, message, now?) → ChatStateWithPhaseOne
 *   - noteCommittedMessages(state, messages, now?) → ChatStateWithPhaseOne
 *   - noteScene(state, scene, summary, now?) → ChatStateWithPhaseOne
 *   - noteScenes(state, entries, now?) → ChatStateWithPhaseOne
 *   - noteSignal(state, signal, now?) → ChatStateWithPhaseOne
 *   - noteSignals(state, signals, now?) → ChatStateWithPhaseOne
 *
 *   Ranking seam:
 *   - rankResponseCandidates(state, candidates, channelId, sceneRole, now) → ranked[]
 *   - rankSceneCandidates(state, candidates, now) → scores[]
 *
 *   Sync seam:
 *   - syncIntoState(state, recommendedCandidateId, now) → ChatStateWithPhaseOne
 *   - buildSyncReport(state, recommendedCandidateId, now) → ChatPhaseOneBridgeSyncReport
 *
 *   Callback management:
 *   - markCallbackUsed(state, memoryId, callbackId?, now) → ChatStateWithPhaseOne
 *   - markCallbacksUsed(state, entries, now) → ChatStateWithPhaseOne
 *   - queryCallbacks(state, request) → ChatEpisodicCallbackCandidate[]
 *   - queryCallbacksByEventType(state, eventType, channelId?, maxResults?) → []
 *   - getUnresolvedCallbackIds(state) → string[]
 *   - getCarryoverSummary(state) → string | undefined
 *   - buildCarryoverItems(state) → ChatEpisodicCarryoverItem[]
 *
 *   Feature snapshot:
 *   - applyFeatureSnapshot(state, snapshot, now?) → ChatStateWithPhaseOne
 *
 *   Director hints and diagnostics:
 *   - getDirectorHints(state, channelId, now?) → ChatNoveltyLedgerDirectorHints
 *   - getChannelFatigue(state, channelId, now?) → number
 *   - getAllChannelFatigue(state, now?) → { channelId, fatigue01, volatility01 }[]
 *   - getDiagnostics(state) → ChatPhaseOneBridgeDiagnostics
 *   - getHealth(state) → ChatPhaseOneBridgeHealthSnapshot
 *
 *   Maintenance:
 *   - decay(state, now?) → { decayed, next }
 *   - archiveExpired(state, now?) → { archived, next }
 *   - resolveMemory(state, memoryId, reason?, summary?, now?) → ChatStateWithPhaseOne
 *   - strengthenMemory(state, memoryId, delta01, now?) → ChatStateWithPhaseOne
 *
 *   Serialization:
 *   - serializeState(state) → ChatPhaseOneStateSlice | undefined
 *   - deserializeIntoState(state, raw, now?) → ChatStateWithPhaseOne
 *
 *   Context accessors (read-only):
 *   - getLastBattleContext() → ChatPhaseOneBattleContext | null
 *   - getLastRunContext() → ChatPhaseOneRunContext | null
 *   - getLastEconomyContext() → ChatPhaseOneEconomyContext | null
 *   - getLastLiveOpsContext() → ChatPhaseOneLiveOpsContext | null
 *   - getFingerprint(state) → ChatConversationalFingerprint
 *   - getPhaseOneSlice(state) → ChatPhaseOneStateSlice
 *
 * Module-level factories and helpers:
 * - createChatEnginePhaseOneBridge(options?) → ChatEnginePhaseOneBridge
 * - getDefaultChatEnginePhaseOneBridge() → ChatEnginePhaseOneBridge (singleton)
 * - setDefaultChatEnginePhaseOneBridge(bridge)
 * - resetDefaultChatEnginePhaseOneBridge()
 * - applyMessageToPhaseOne(state, message, now?, options?) → ChatStateWithPhaseOne
 * - applySceneToPhaseOne(state, scene, summary, now?, options?) → ChatStateWithPhaseOne
 * - applySignalToPhaseOne(state, signal, now?, options?) → ChatStateWithPhaseOne
 *
 * NAMESPACE MODULE OBJECTS
 * ─────────────────────────
 * - ChatPhaseOneStateModule   — namespace grouping all state-layer exports
 * - ChatPhaseOneBridgeModule  — namespace grouping all bridge-layer exports
 *
 * TYPE PREDICATES
 * ────────────────
 * - isChatStateWithPhaseOne(state)
 * - isPhaseOneBridgeHealthy(health)
 * - hasPhaseOneNoveltyLedger(state)
 * - hasPhaseOneEpisodicMemory(state)
 * - isHighSemanticFatigue(state, channelId, threshold?)
 *
 * COMPOSITE FACTORY HELPERS
 * ──────────────────────────
 * - createAndHydratePhaseOneBridge(state, options?) → bridge
 * - bootPhaseOneLayer(options?) → bridge
 * - syncAndHydratePhaseOneBridge(state, options?) → { bridge, state }
 * ============================================================================
 */

// ============================================================================
// MARK: Namespace imports for module object construction
// ============================================================================

import * as PhaseOneState from './ChatStatePhaseOne';
import * as PhaseOneBridge from './ChatEnginePhaseOneBridge';

// ============================================================================
// MARK: Full re-export — ChatStatePhaseOne
// ============================================================================

export {
  // Types
  type ChatConversationalFingerprint,
  type ChatPhaseOneStateSlice,
  type ChatStateWithPhaseOne,

  // Default creators
  createDefaultConversationalFingerprint,
  createDefaultChatPhaseOneStateSlice,

  // State accessor
  getPhaseOneState,

  // State mutators
  withPhaseOneState,
  setPhaseOneNoveltyLedgerInState,
  setPhaseOneEpisodicMemoryInState,
  setPhaseOneRecommendedCandidateIdInState,
  setSemanticFatigueInState,
  applyConversationalFingerprintDeltaInState,
  notePhaseOneCarryoverSummaryInState,

  // Serialization / hydration
  serializePhaseOneStateSlice,
  hydratePhaseOneStateSlice,
} from './ChatStatePhaseOne';

// ============================================================================
// MARK: Full re-export — ChatEnginePhaseOneBridge
// ============================================================================

export {
  // Class
  ChatEnginePhaseOneBridge,

  // Types
  type ChatPhaseOneBridgeOptions,
  type ChatPhaseOneResponseCandidate,
  type ChatPhaseOneRankedCandidate,
  type ChatPhaseOneBridgeDiagnostics,
  type ChatPhaseOneBridgeHealthSnapshot,
  type ChatPhaseOneBridgeSignalSummary,
  type ChatPhaseOneBridgeSyncReport,
  type ChatPhaseOneBattleContext,
  type ChatPhaseOneRunContext,
  type ChatPhaseOneEconomyContext,
  type ChatPhaseOneLiveOpsContext,

  // Module-level factory and singleton management
  createChatEnginePhaseOneBridge,
  getDefaultChatEnginePhaseOneBridge,
  setDefaultChatEnginePhaseOneBridge,
  resetDefaultChatEnginePhaseOneBridge,

  // One-shot convenience helpers
  applyMessageToPhaseOne,
  applySceneToPhaseOne,
  applySignalToPhaseOne,
} from './ChatEnginePhaseOneBridge';

// ============================================================================
// MARK: Namespace module objects
// ============================================================================

/**
 * Namespace object grouping all ChatStatePhaseOne exports.
 *
 * Provides shorthand access for callers that prefer the namespace pattern:
 *   ChatPhaseOneStateModule.getSlice(state)
 *   ChatPhaseOneStateModule.setNoveltyLedger(state, snapshot, now)
 *   ChatPhaseOneStateModule.applyFingerprintDelta(state, delta, now)
 *   etc.
 */
export const ChatPhaseOneStateModule = Object.freeze({
  // Default creators
  createDefault: PhaseOneState.createDefaultChatPhaseOneStateSlice,
  createDefaultFingerprint: PhaseOneState.createDefaultConversationalFingerprint,

  // Accessor
  getSlice: PhaseOneState.getPhaseOneState,

  // Mutators
  with: PhaseOneState.withPhaseOneState,
  setNoveltyLedger: PhaseOneState.setPhaseOneNoveltyLedgerInState,
  setEpisodicMemory: PhaseOneState.setPhaseOneEpisodicMemoryInState,
  setRecommendedCandidate: PhaseOneState.setPhaseOneRecommendedCandidateIdInState,
  setSemanticFatigue: PhaseOneState.setSemanticFatigueInState,
  applyFingerprintDelta: PhaseOneState.applyConversationalFingerprintDeltaInState,
  noteCarryoverSummary: PhaseOneState.notePhaseOneCarryoverSummaryInState,

  // Serialization
  serialize: PhaseOneState.serializePhaseOneStateSlice,
  hydrate: PhaseOneState.hydratePhaseOneStateSlice,
} as const);

/**
 * Namespace object grouping all ChatEnginePhaseOneBridge exports.
 *
 * Provides shorthand access:
 *   ChatPhaseOneBridgeModule.create(options)
 *   ChatPhaseOneBridgeModule.Bridge  (class reference)
 *   ChatPhaseOneBridgeModule.getDefault()
 *   etc.
 */
export const ChatPhaseOneBridgeModule = Object.freeze({
  // Class reference
  Bridge: PhaseOneBridge.ChatEnginePhaseOneBridge,

  // Factories and singleton
  create: PhaseOneBridge.createChatEnginePhaseOneBridge,
  getDefault: PhaseOneBridge.getDefaultChatEnginePhaseOneBridge,
  setDefault: PhaseOneBridge.setDefaultChatEnginePhaseOneBridge,
  resetDefault: PhaseOneBridge.resetDefaultChatEnginePhaseOneBridge,

  // One-shot helpers
  applyMessage: PhaseOneBridge.applyMessageToPhaseOne,
  applyScene: PhaseOneBridge.applySceneToPhaseOne,
  applySignal: PhaseOneBridge.applySignalToPhaseOne,
} as const);

// ============================================================================
// MARK: Class reference alias (matches parent index pattern)
// ============================================================================

/** Direct class reference alias for callers that import from this barrel. */
export const ChatEnginePhaseOneBridgeClass = PhaseOneBridge.ChatEnginePhaseOneBridge;

// ============================================================================
// MARK: Type predicates
// ============================================================================

/**
 * Returns true if the given state object has an initialized Phase 1 slice.
 */
export function isChatStateWithPhaseOne(
  state: unknown,
): state is PhaseOneState.ChatStateWithPhaseOne {
  return (
    state !== null &&
    typeof state === 'object' &&
    'phaseOne' in (state as object) &&
    typeof (state as Record<string, unknown>).phaseOne === 'object'
  );
}

/**
 * Returns true if the bridge health snapshot reports healthy (no warnings).
 */
export function isPhaseOneBridgeHealthy(
  health: PhaseOneBridge.ChatPhaseOneBridgeHealthSnapshot,
): boolean {
  return health.healthy && health.hydrated;
}

/**
 * Returns true if the state has a non-undefined novelty ledger snapshot
 * embedded in its Phase 1 slice.
 */
export function hasPhaseOneNoveltyLedger(
  state: PhaseOneState.ChatStateWithPhaseOne,
): boolean {
  return PhaseOneState.getPhaseOneState(state).noveltyLedger !== undefined;
}

/**
 * Returns true if the state has a non-undefined episodic memory snapshot
 * embedded in its Phase 1 slice.
 */
export function hasPhaseOneEpisodicMemory(
  state: PhaseOneState.ChatStateWithPhaseOne,
): boolean {
  return PhaseOneState.getPhaseOneState(state).episodicMemory !== undefined;
}

/**
 * Returns true if the semantic fatigue for the given channel exceeds the
 * provided threshold (default 0.65).
 *
 * Orchestrators can use this to throttle NPC injection when a channel is
 * semantically saturated.
 */
export function isHighSemanticFatigue(
  state: PhaseOneState.ChatStateWithPhaseOne,
  channelId: 'GLOBAL' | 'SYNDICATE' | 'DEAL_ROOM' | 'LOBBY',
  threshold = 0.65,
): boolean {
  const fatigue = PhaseOneState.getPhaseOneState(state).semanticFatigueByChannel[channelId] ?? 0;
  return fatigue >= threshold;
}

/**
 * Returns true if there are unresolved callback IDs in the Phase 1 slice.
 * Used by the NPC director to know whether callback debt exists.
 */
export function hasPhaseOneUnresolvedCallbacks(
  state: PhaseOneState.ChatStateWithPhaseOne,
): boolean {
  return PhaseOneState.getPhaseOneState(state).unresolvedCallbackIds.length > 0;
}

/**
 * Returns true if the conversational fingerprint is in its initial/default
 * state — i.e., the player has not yet produced enough signals to diverge
 * meaningfully from neutral.
 */
export function isPhaseOneFingerprintNeutral(
  state: PhaseOneState.ChatStateWithPhaseOne,
  driftThreshold = 0.08,
): boolean {
  const defaults = PhaseOneState.createDefaultConversationalFingerprint();
  const fp = PhaseOneState.getPhaseOneState(state).conversationalFingerprint;
  const axes: (keyof Omit<PhaseOneState.ChatConversationalFingerprint, 'updatedAt'>)[] = [
    'impulsive01', 'patient01', 'greedy01', 'defensive01', 'bluffHeavy01',
    'literal01', 'comebackProne01', 'collapseProne01', 'publicPerformer01',
    'silentOperator01', 'procedureAware01', 'noveltySeeking01', 'stabilitySeeking01',
  ];
  return axes.every((axis) => Math.abs((fp[axis] ?? 0) - (defaults[axis] ?? 0)) < driftThreshold);
}

// ============================================================================
// MARK: Composite factory helpers
// ============================================================================

/**
 * Creates a ChatEnginePhaseOneBridge and immediately hydrates it from the
 * given state. Returns the hydrated bridge ready for seam calls.
 *
 * The preferred boot path for ChatEngine.ts when Phase 1 intelligence is needed
 * at session start. The state must already have a Phase 1 slice for the hydration
 * to restore novelty ledger and episodic memory from persistence.
 */
export function createAndHydratePhaseOneBridge(
  state: PhaseOneState.ChatStateWithPhaseOne,
  options: PhaseOneBridge.ChatPhaseOneBridgeOptions = {},
): PhaseOneBridge.ChatEnginePhaseOneBridge {
  const bridge = PhaseOneBridge.createChatEnginePhaseOneBridge(options);
  bridge.hydrateFromState(state);
  return bridge;
}

/**
 * Creates a ChatEnginePhaseOneBridge with default options.
 * Does not hydrate from state — intended for fresh session boot where there
 * is no persisted Phase 1 state to restore from.
 */
export function bootPhaseOneLayer(
  options: PhaseOneBridge.ChatPhaseOneBridgeOptions = {},
): PhaseOneBridge.ChatEnginePhaseOneBridge {
  return PhaseOneBridge.createChatEnginePhaseOneBridge(options);
}

/**
 * Creates a bridge, hydrates it from state, then immediately performs a
 * full syncIntoState pass to ensure the state slice reflects the hydrated
 * intelligence objects.
 *
 * Use when re-attaching to a session after a process restart, where the
 * state slice may be slightly stale relative to the persisted intelligence
 * snapshots.
 */
export function syncAndHydratePhaseOneBridge(
  state: PhaseOneState.ChatStateWithPhaseOne,
  options: PhaseOneBridge.ChatPhaseOneBridgeOptions = {},
  recommendedCandidateId?: string,
): { readonly bridge: PhaseOneBridge.ChatEnginePhaseOneBridge; readonly state: PhaseOneState.ChatStateWithPhaseOne } {
  const bridge = PhaseOneBridge.createChatEnginePhaseOneBridge(options);
  bridge.hydrateFromState(state);
  const now = Date.now() as import('../types').UnixMs;
  const nextState = bridge.syncIntoState(state, recommendedCandidateId, now);
  return { bridge, state: nextState };
}

/**
 * Applies a batch of messages, a scene, and signals to the bridge in one call.
 * Returns the updated state after all inputs have been processed.
 *
 * Useful for replaying historical session data into a fresh bridge.
 */
export function replaySessionDataIntoPhaseOne(
  state: PhaseOneState.ChatStateWithPhaseOne,
  data: {
    readonly messages?: readonly import('../types').ChatMessage[];
    readonly scenes?: readonly {
      readonly scene: import('../types').ChatScenePlan;
      readonly summary: string;
    }[];
    readonly signals?: readonly import('../types').ChatSignalEnvelope[];
  },
  options: PhaseOneBridge.ChatPhaseOneBridgeOptions = {},
): { readonly bridge: PhaseOneBridge.ChatEnginePhaseOneBridge; readonly state: PhaseOneState.ChatStateWithPhaseOne } {
  const bridge = PhaseOneBridge.createChatEnginePhaseOneBridge(options);
  bridge.hydrateFromState(state);

  let current = state;

  if (data.messages?.length) {
    current = bridge.noteCommittedMessages(current, data.messages);
  }
  if (data.scenes?.length) {
    current = bridge.noteScenes(current, data.scenes);
  }
  if (data.signals?.length) {
    current = bridge.noteSignals(current, data.signals);
  }

  const now = Date.now() as import('../types').UnixMs;
  current = bridge.syncIntoState(current, undefined, now);

  return { bridge, state: current };
}
