/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT PHASE 2 BARREL INDEX
 * FILE: backend/src/game/engine/chat/phase2/index.ts
 * VERSION: 2026.03.22-phase2-index.v1
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative public entry surface for the backend chat Phase 2 module.
 *
 * This barrel exposes the complete Phase 2 relationship evolution subsystem:
 *
 * STATE LAYER (ChatStatePhaseTwo)
 * ────────────────────────────────
 * - ChatPhaseTwoStateSlice          — immutable state slice shape
 * - ChatPhaseTwoCounterpartProjection — per-NPC projection stored in slice
 * - ChatStateWithPhaseTwo           — union type: ChatState + optional phase2 slice
 * - ChatEngineStateWithPhaseTwo     — backward-compatible alias
 * - ChatPhaseTwoMomentumBand        — intensity tier (QUIET / WARM / HOT / FEVER)
 * - ChatPhaseTwoDiagnosticsSnapshot — embedded diagnostics for cheap read access
 * - ChatPhaseTwoPressureAggregate   — global pressure view across all counterparts
 * - ChatPhaseTwoCrossChannelSummary — cross-channel relationship summary
 * - ChatPhaseTwoMomentumView        — rising/falling threat view per counterpart
 * - ChatPhaseTwoAxisDominanceMap    — which counterparts dominate each relationship axis
 * - ChatPhaseTwoRelationshipDiff    — diff between two slice versions
 * - ChatPhaseTwoSelectionContext    — input to selectPhaseTwoFocusedCounterpart
 * - ChatPhaseTwoSelectionResult     — output of counterpart selection
 * - ChatPhaseTwoChannelHeatRow      — heat row for a single channel
 * - ChatPhaseTwoValidationResult    — output of validatePhaseTwoStateSlice
 *
 * Default creators:
 * - createDefaultChatPhaseTwoStateSlice
 * - createDefaultChannelHeatMap
 * - createDefaultFocusedCounterpartByChannel
 *
 * State accessors (read-only, no mutation):
 * - getPhaseTwoState
 * - hasPhaseTwoSlice
 * - getPhaseTwoCounterpartCount
 * - getPhaseTwoCounterpartIds
 * - getPhaseTwoCounterpartProjection
 * - hasPhaseTwoCounterpart
 * - getPhaseTwoFocusedCounterpart
 * - getPhaseTwoHeat
 * - getPhaseTwoEscalationRisk
 * - getPhaseTwoRescueReadiness
 * - isPhaseTwoHighEscalation
 * - isPhaseTwoRescueReady
 *
 * State mutators (all return new state, never mutate in place):
 * - withPhaseTwoState
 * - setPhaseTwoRelationshipSnapshotInState
 * - setPhaseTwoCounterpartProjectionsInState
 * - setPhaseTwoFocusedCounterpartInState
 * - setMultiplePhaseTwoFocusedCounterpartsInState
 * - clearPhaseTwoFocusedCounterpartInState
 * - clearAllPhaseTwoFocusedCounterpartsInState
 * - setPhaseTwoCounterpartProjectionInState
 * - removePhaseTwoCounterpartProjectionFromState
 * - applyPhaseTwoHeatDecayInState
 * - prunePhaseTwoStaleCounterpartsFromState
 * - mergePhaseTwoProjections
 * - mergePhaseTwoRelationshipSnapshotIncrementalInState
 * - addPhaseTwoUnresolvedCallbackInState
 * - resolvePhaseTwoCallbackInState
 * - setPhaseTwoDiagnosticsSnapshotInState
 * - resetPhaseTwoStateSlice
 *
 * Analytics selectors:
 * - getPhaseTwoCounterpartsBySelectionWeight
 * - getPhaseTwoCounterpartsByIntensity
 * - getPhaseTwoDominantCounterpart
 * - getPhaseTwoHighEscalationCounterparts
 * - getPhaseTwoRescueReadyCounterparts
 * - getPhaseTwoTopCallbackCandidates
 * - getPhaseTwoUnresolvedCallbacks
 * - getPhaseTwoMomentumView
 * - getPhaseTwoAxisDominanceMap
 * - getPhaseTwoCrossChannelSummary
 * - computePhaseTwoPressureAggregate
 * - selectPhaseTwoFocusedCounterpart
 * - computePhaseTwoRelationshipDiff
 * - buildPhaseTwoDiagnosticsSnapshot
 * - getPhaseTwoChannelHeatRows
 * - getPhaseTwoRelationshipVector
 * - getPhaseTwoFeverBandCounterparts
 * - hasPhaseTwoFeverBandCounterpart
 * - getPhaseTwoStanceMap
 * - getPhaseTwoObjectiveMap
 * - getAllPhaseTwoCallbackHints
 *
 * Serialization / hydration:
 * - serializePhaseTwoStateSlice
 * - hydratePhaseTwoStateSlice
 * - validatePhaseTwoStateSlice
 *
 * Utility re-exports from state:
 * - phaseTwoClamp01        (clamp01 re-export for bridge consumers)
 * - phaseTwoWeightedBlend  (weightedBlend re-export)
 * - derivePhaseTwoMomentumBand
 *
 * BRIDGE LAYER (ChatEnginePhaseTwoBridge)
 * ──────────────────────────────────────────
 * - ChatEnginePhaseTwoBridge           — authoritative bridge class
 * - ChatEnginePhaseTwoBridgeOptions    — constructor options
 * - ChatEnginePhaseTwoBridgeAuditReport — structured telemetry output
 * - ChatEnginePhaseTwoBridgeSyncDiff   — incremental sync diff report
 * - ChatEnginePhaseTwoBridgeSyncResult — return type of syncIntoState
 * - ChatEnginePhaseTwoBridgeGameEventInput — game event ingestion input
 * - ChatEnginePhaseTwoBridgeNpcMessageInput — NPC message ingestion input
 * - ChatEnginePhaseTwoBridgeModule     — namespace module object
 * - createChatEnginePhaseTwoBridge     — factory function
 * - createChatEnginePhaseTwoBridgeFromSnapshot — snapshot-hydrated factory
 *
 * Bridge methods exposed via class (not re-exported individually):
 * - isHydrated()
 * - getPlayerId()
 * - setPlayerId()
 * - hydrateFromSnapshot()
 * - resetModel()
 * - settle()
 * - notePlayerMessage()
 * - notePlayerMessageRaw()
 * - noteNpcMessage()
 * - noteNpcUtteranceRaw()
 * - noteGameEvent()
 * - noteGameEventSimple()
 * - noteAuthoritativeMessage()
 * - noteAuthoritativeMessages()
 * - primeCounterpart()
 * - forgetCounterpart()
 * - counterpartIds()
 * - hasCounterpart()
 * - getCounterpart()
 * - getCounterpartDigest()
 * - topCounterparts()
 * - summaries()
 * - selectCounterpartFocus()
 * - queryEvents()
 * - getChannelHeat()
 * - getRoomHeat()
 * - getFocusSnapshot()
 * - getDiagnostics()
 * - buildSignal()
 * - buildSignalWithContext()
 * - buildAllSignals()
 * - realizeNpcLine()
 * - snapshot()
 * - projectLegacy()
 * - syncIntoState()
 * - syncIntoFrontendCompatibleState()   (legacy alias, backward-compat)
 * - syncFocusSnapshotIntoState()
 * - syncChannelFocusIntoState()
 * - buildAuditReport()
 * - computeSyncDiff()
 *
 * NAMESPACE MODULE OBJECTS
 * ─────────────────────────
 * - ChatPhaseTwoStateModule  — namespace object grouping all state exports
 * - ChatPhaseTwoBridgeModule — namespace object grouping all bridge exports
 *   (also exported directly from ChatEnginePhaseTwoBridge.ts as a named const)
 *
 * TYPE PREDICATES
 * ────────────────
 * - isChatStateWithPhaseTwo(state)  — runtime guard
 * - hasPhaseTwoProjection(state, counterpartId)
 * - isPhaseTwoFeverBand(projection)
 * - isPhaseTwoHighEscalationProjection(projection)
 * - isPhaseTwoRescueReadyProjection(projection)
 *
 * COMPOSITE FACTORY HELPERS
 * ──────────────────────────
 * - createAndSyncPhaseTwoBridge(state, options?) → { bridge, state }
 *   Constructs a bridge and immediately performs a full sync into the provided state.
 * - bootPhaseTwoLayer(options?)
 *   Boots an empty bridge with default options. Returns the bridge instance.
 * ============================================================================
 */

// ============================================================================
// MARK: Namespace imports for module object construction
// ============================================================================

import * as PhaseTwoState from './ChatStatePhaseTwo';
import * as PhaseTwoBridge from './ChatEnginePhaseTwoBridge';

// ============================================================================
// MARK: Full re-export — ChatStatePhaseTwo
// ============================================================================

export {
  // Constants (utility re-exports)
  phaseTwoClamp01,
  phaseTwoWeightedBlend,
  derivePhaseTwoMomentumBand,

  // Types — slice and union
  type ChatPhaseTwoStateSlice,
  type ChatPhaseTwoCounterpartProjection,
  type ChatStateWithPhaseTwo,
  type ChatEngineStateWithPhaseTwo,

  // Types — momentum and analytics
  type ChatPhaseTwoMomentumBand,
  type ChatPhaseTwoDiagnosticsSnapshot,
  type ChatPhaseTwoPressureAggregate,
  type ChatPhaseTwoCrossChannelSummary,
  type ChatPhaseTwoMomentumView,
  type ChatPhaseTwoAxisDominanceMap,
  type ChatPhaseTwoRelationshipDiff,
  type ChatPhaseTwoSelectionContext,
  type ChatPhaseTwoSelectionResult,
  type ChatPhaseTwoChannelHeatRow,
  type ChatPhaseTwoValidationResult,

  // Default creators
  createDefaultChatPhaseTwoStateSlice,
  createDefaultChannelHeatMap,
  createDefaultFocusedCounterpartByChannel,

  // State accessors
  getPhaseTwoState,
  hasPhaseTwoSlice,
  getPhaseTwoCounterpartCount,
  getPhaseTwoCounterpartIds,
  getPhaseTwoCounterpartProjection,
  hasPhaseTwoCounterpart,
  getPhaseTwoFocusedCounterpart,
  getPhaseTwoHeat,
  getPhaseTwoEscalationRisk,
  getPhaseTwoRescueReadiness,
  isPhaseTwoHighEscalation,
  isPhaseTwoRescueReady,

  // State mutators
  withPhaseTwoState,
  setPhaseTwoRelationshipSnapshotInState,
  setPhaseTwoCounterpartProjectionsInState,
  setPhaseTwoFocusedCounterpartInState,
  setMultiplePhaseTwoFocusedCounterpartsInState,
  clearPhaseTwoFocusedCounterpartInState,
  clearAllPhaseTwoFocusedCounterpartsInState,
  setPhaseTwoCounterpartProjectionInState,
  removePhaseTwoCounterpartProjectionFromState,
  applyPhaseTwoHeatDecayInState,
  prunePhaseTwoStaleCounterpartsFromState,
  mergePhaseTwoProjections,
  mergePhaseTwoRelationshipSnapshotIncrementalInState,
  addPhaseTwoUnresolvedCallbackInState,
  resolvePhaseTwoCallbackInState,
  setPhaseTwoDiagnosticsSnapshotInState,
  resetPhaseTwoStateSlice,

  // Analytics selectors
  getPhaseTwoCounterpartsBySelectionWeight,
  getPhaseTwoCounterpartsByIntensity,
  getPhaseTwoDominantCounterpart,
  getPhaseTwoHighEscalationCounterparts,
  getPhaseTwoRescueReadyCounterparts,
  getPhaseTwoTopCallbackCandidates,
  getPhaseTwoUnresolvedCallbacks,
  getPhaseTwoMomentumView,
  getPhaseTwoAxisDominanceMap,
  getPhaseTwoCrossChannelSummary,
  computePhaseTwoPressureAggregate,
  selectPhaseTwoFocusedCounterpart,
  computePhaseTwoRelationshipDiff,
  buildPhaseTwoDiagnosticsSnapshot,
  getPhaseTwoChannelHeatRows,
  getPhaseTwoRelationshipVector,
  getPhaseTwoFeverBandCounterparts,
  hasPhaseTwoFeverBandCounterpart,
  getPhaseTwoStanceMap,
  getPhaseTwoObjectiveMap,
  getAllPhaseTwoCallbackHints,

  // Serialization / hydration / validation
  serializePhaseTwoStateSlice,
  hydratePhaseTwoStateSlice,
  validatePhaseTwoStateSlice,
} from './ChatStatePhaseTwo';

// ============================================================================
// MARK: Full re-export — ChatEnginePhaseTwoBridge
// ============================================================================

export {
  // Class
  ChatEnginePhaseTwoBridge,

  // Types
  type ChatEnginePhaseTwoBridgeOptions,
  type ChatEnginePhaseTwoBridgeAuditReport,
  type ChatEnginePhaseTwoBridgeSyncDiff,
  type ChatEnginePhaseTwoBridgeSyncResult,
  type ChatEnginePhaseTwoBridgeGameEventInput,
  type ChatEnginePhaseTwoBridgeNpcMessageInput,

  // Module namespace
  ChatEnginePhaseTwoBridgeModule,

  // Factory functions
  createChatEnginePhaseTwoBridge,
  createChatEnginePhaseTwoBridgeFromSnapshot,
} from './ChatEnginePhaseTwoBridge';

// ============================================================================
// MARK: Namespace module objects
// ============================================================================

/**
 * Namespace object grouping all ChatStatePhaseTwo exports.
 * Accessible as ChatPhaseTwoStateModule.getPhaseTwoState(state), etc.
 */
export const ChatPhaseTwoStateModule = Object.freeze({
  // Default creators
  createDefault: PhaseTwoState.createDefaultChatPhaseTwoStateSlice,
  createDefaultChannelHeat: PhaseTwoState.createDefaultChannelHeatMap,
  createDefaultFocus: PhaseTwoState.createDefaultFocusedCounterpartByChannel,

  // Accessors
  get: PhaseTwoState.getPhaseTwoState,
  hasSlice: PhaseTwoState.hasPhaseTwoSlice,
  counterpartCount: PhaseTwoState.getPhaseTwoCounterpartCount,
  counterpartIds: PhaseTwoState.getPhaseTwoCounterpartIds,
  counterpartProjection: PhaseTwoState.getPhaseTwoCounterpartProjection,
  hasCounterpart: PhaseTwoState.hasPhaseTwoCounterpart,
  focusedCounterpart: PhaseTwoState.getPhaseTwoFocusedCounterpart,
  heat: PhaseTwoState.getPhaseTwoHeat,
  escalationRisk: PhaseTwoState.getPhaseTwoEscalationRisk,
  rescueReadiness: PhaseTwoState.getPhaseTwoRescueReadiness,
  isHighEscalation: PhaseTwoState.isPhaseTwoHighEscalation,
  isRescueReady: PhaseTwoState.isPhaseTwoRescueReady,

  // Mutators
  with: PhaseTwoState.withPhaseTwoState,
  setSnapshot: PhaseTwoState.setPhaseTwoRelationshipSnapshotInState,
  setProjections: PhaseTwoState.setPhaseTwoCounterpartProjectionsInState,
  setFocus: PhaseTwoState.setPhaseTwoFocusedCounterpartInState,
  setMultiFocus: PhaseTwoState.setMultiplePhaseTwoFocusedCounterpartsInState,
  clearFocus: PhaseTwoState.clearPhaseTwoFocusedCounterpartInState,
  clearAllFocus: PhaseTwoState.clearAllPhaseTwoFocusedCounterpartsInState,
  setProjection: PhaseTwoState.setPhaseTwoCounterpartProjectionInState,
  removeProjection: PhaseTwoState.removePhaseTwoCounterpartProjectionFromState,
  decayHeat: PhaseTwoState.applyPhaseTwoHeatDecayInState,
  pruneStale: PhaseTwoState.prunePhaseTwoStaleCounterpartsFromState,
  mergeProjections: PhaseTwoState.mergePhaseTwoProjections,
  mergeSnapshotIncremental: PhaseTwoState.mergePhaseTwoRelationshipSnapshotIncrementalInState,
  addCallback: PhaseTwoState.addPhaseTwoUnresolvedCallbackInState,
  resolveCallback: PhaseTwoState.resolvePhaseTwoCallbackInState,
  setDiagnostics: PhaseTwoState.setPhaseTwoDiagnosticsSnapshotInState,
  reset: PhaseTwoState.resetPhaseTwoStateSlice,

  // Analytics
  bySelectionWeight: PhaseTwoState.getPhaseTwoCounterpartsBySelectionWeight,
  byIntensity: PhaseTwoState.getPhaseTwoCounterpartsByIntensity,
  dominant: PhaseTwoState.getPhaseTwoDominantCounterpart,
  highEscalation: PhaseTwoState.getPhaseTwoHighEscalationCounterparts,
  rescueReady: PhaseTwoState.getPhaseTwoRescueReadyCounterparts,
  topCallbacks: PhaseTwoState.getPhaseTwoTopCallbackCandidates,
  unresolvedCallbacks: PhaseTwoState.getPhaseTwoUnresolvedCallbacks,
  momentumView: PhaseTwoState.getPhaseTwoMomentumView,
  axisDominance: PhaseTwoState.getPhaseTwoAxisDominanceMap,
  crossChannelSummary: PhaseTwoState.getPhaseTwoCrossChannelSummary,
  pressureAggregate: PhaseTwoState.computePhaseTwoPressureAggregate,
  selectFocus: PhaseTwoState.selectPhaseTwoFocusedCounterpart,
  diff: PhaseTwoState.computePhaseTwoRelationshipDiff,
  buildDiagnostics: PhaseTwoState.buildPhaseTwoDiagnosticsSnapshot,
  channelHeatRows: PhaseTwoState.getPhaseTwoChannelHeatRows,
  relationshipVector: PhaseTwoState.getPhaseTwoRelationshipVector,
  feverBand: PhaseTwoState.getPhaseTwoFeverBandCounterparts,
  hasFeverBand: PhaseTwoState.hasPhaseTwoFeverBandCounterpart,
  stanceMap: PhaseTwoState.getPhaseTwoStanceMap,
  objectiveMap: PhaseTwoState.getPhaseTwoObjectiveMap,
  allCallbackHints: PhaseTwoState.getAllPhaseTwoCallbackHints,

  // Serialization
  serialize: PhaseTwoState.serializePhaseTwoStateSlice,
  hydrate: PhaseTwoState.hydratePhaseTwoStateSlice,
  validate: PhaseTwoState.validatePhaseTwoStateSlice,

  // Utilities
  clamp01: PhaseTwoState.phaseTwoClamp01,
  weightedBlend: PhaseTwoState.phaseTwoWeightedBlend,
  deriveMomentumBand: PhaseTwoState.derivePhaseTwoMomentumBand,
} as const);

/**
 * Namespace object grouping all ChatEnginePhaseTwoBridge exports.
 * Accessible as ChatPhaseTwoBridgeModule.create(options), etc.
 */
export const ChatPhaseTwoBridgeStateModule = Object.freeze({
  Bridge: PhaseTwoBridge.ChatEnginePhaseTwoBridge,
  create: PhaseTwoBridge.createChatEnginePhaseTwoBridge,
  createFromSnapshot: PhaseTwoBridge.createChatEnginePhaseTwoBridgeFromSnapshot,
  Module: PhaseTwoBridge.ChatEnginePhaseTwoBridgeModule,
} as const);

// ============================================================================
// MARK: Type predicates
// ============================================================================

/**
 * Returns true if the given state object has an initialized Phase 2 slice.
 */
export function isChatStateWithPhaseTwo(
  state: unknown,
): state is PhaseTwoState.ChatStateWithPhaseTwo {
  return (
    state !== null &&
    typeof state === 'object' &&
    'phaseTwo' in (state as object) &&
    typeof (state as Record<string, unknown>).phaseTwo === 'object'
  );
}

/**
 * Returns true if the state tracks the given counterpart in its Phase 2 slice.
 */
export function hasPhaseTwoProjection(
  state: PhaseTwoState.ChatStateWithPhaseTwo,
  counterpartId: string,
): boolean {
  return PhaseTwoState.hasPhaseTwoCounterpart(state, counterpartId);
}

/**
 * Returns true if the given projection is in the FEVER momentum band.
 */
export function isPhaseTwoFeverBand(
  projection: PhaseTwoState.ChatPhaseTwoCounterpartProjection,
): boolean {
  return projection.momentumBand === 'FEVER';
}

/**
 * Returns true if the given projection's escalation risk is above the high threshold.
 */
export function isPhaseTwoHighEscalationProjection(
  projection: PhaseTwoState.ChatPhaseTwoCounterpartProjection,
): boolean {
  return projection.escalationRisk01 >= 0.66;
}

/**
 * Returns true if the given projection's rescue readiness is above the threshold.
 */
export function isPhaseTwoRescueReadyProjection(
  projection: PhaseTwoState.ChatPhaseTwoCounterpartProjection,
): boolean {
  return projection.rescueReadiness01 >= 0.64;
}

/**
 * Returns true if the given projection has pending callback hints.
 */
export function isPhaseTwoCallbackPending(
  projection: PhaseTwoState.ChatPhaseTwoCounterpartProjection,
): boolean {
  return projection.callbackHintCount > 0;
}

// ============================================================================
// MARK: Composite factory helpers
// ============================================================================

/**
 * Constructs a ChatEnginePhaseTwoBridge and immediately performs a full sync
 * into the provided state. Returns both the bridge and the updated state.
 *
 * Useful in engine boot sequences where you want a pre-synced slice from the
 * start without a separate sync call.
 */
export function createAndSyncPhaseTwoBridge<T extends PhaseTwoState.ChatStateWithPhaseTwo>(
  state: T,
  options: PhaseTwoBridge.ChatEnginePhaseTwoBridgeOptions = {},
  now: PhaseTwoState.ChatStateWithPhaseTwo extends { phaseTwo?: unknown } ? number : number = Date.now(),
): { readonly bridge: PhaseTwoBridge.ChatEnginePhaseTwoBridge; readonly state: T } {
  const bridge = PhaseTwoBridge.createChatEnginePhaseTwoBridge(options);
  const { state: nextState } = bridge.syncIntoState(state, now as import('../types').UnixMs);
  return { bridge, state: nextState };
}

/**
 * Creates a ChatEnginePhaseTwoBridge with default options.
 * Convenience entry point for orchestrators that don't need custom config.
 */
export function bootPhaseTwoLayer(
  options: PhaseTwoBridge.ChatEnginePhaseTwoBridgeOptions = {},
): PhaseTwoBridge.ChatEnginePhaseTwoBridge {
  return PhaseTwoBridge.createChatEnginePhaseTwoBridge(options);
}

/**
 * Creates a bridge from a snapshot and syncs it into a state in a single call.
 */
export function hydrateAndSyncPhaseTwoBridge<T extends PhaseTwoState.ChatStateWithPhaseTwo>(
  state: T,
  snapshot: import('../../../../../../shared/contracts/chat/relationship').ChatRelationshipSnapshot,
  options: Omit<PhaseTwoBridge.ChatEnginePhaseTwoBridgeOptions, 'snapshot'> = {},
): { readonly bridge: PhaseTwoBridge.ChatEnginePhaseTwoBridge; readonly state: T } {
  const bridge = PhaseTwoBridge.createChatEnginePhaseTwoBridgeFromSnapshot(snapshot, options);
  const now = Date.now() as import('../types').UnixMs;
  const { state: nextState } = bridge.syncIntoState(state, now);
  return { bridge, state: nextState };
}

// ============================================================================
// MARK: Class reference aliases (match parent index pattern)
// ============================================================================

/** Direct reference to the ChatEnginePhaseTwoBridge class. */
export const ChatEnginePhaseTwoBridgeClass = PhaseTwoBridge.ChatEnginePhaseTwoBridge;
