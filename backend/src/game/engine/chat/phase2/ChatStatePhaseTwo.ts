/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT STATE PHASE 2 EXTENSION
 * FILE: backend/src/game/engine/chat/phase2/ChatStatePhaseTwo.ts
 * VERSION: 2026.03.22-phase2-state.v3
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative backend state slice for Phase 2 relationship evolution.
 *
 * This file augments ChatState (backend truth) without a full reducer rewrite.
 * It owns the immutable projection layer that downstream orchestrators,
 * NPC directors, and the frontend-compatible sync bridge rely on to make
 * relationship-aware decisions without reaching into the live relationship
 * model on every tick.
 *
 * Design doctrine
 * ---------------
 * - ChatState is the backend truth root. Phase 2 extends it additively.
 * - The state slice is read-only and deterministic at all serialization
 *   boundaries. Mutations go through withPhaseTwoState helpers only.
 * - Analytics selectors never mutate. They project from existing slice state.
 * - Serialization helpers are replay-safe: they produce structures that can
 *   be roundtripped through JSON without information loss.
 * - Heat values decay toward zero without external refresh; the bridge drives
 *   the refresh schedule.
 * - Counterpart projections are indexed by counterpartId for O(1) lookup by
 *   orchestrators that must query per-NPC relationship state in a tight loop.
 *
 * What lives here
 * ---------------
 * - Core Phase 2 types: projection, state slice, extended state union
 * - Momentum band and pressure aggregate types
 * - Diagnostic snapshot and diff types
 * - Default and factory creators
 * - Immutable state mutator helpers (all return new state)
 * - Analytics selectors: dominance, ranking, callbacks, escalation, etc.
 * - Serialization / hydration helpers
 * - Validation helpers
 * - Utility math functions used by this module exclusively
 * ============================================================================
 */

// ============================================================================
// MARK: Imports
// ============================================================================

import type { ChatState, ChatVisibleChannel, UnixMs } from '../types';

import type {
  ChatRelationshipAxisId,
  ChatRelationshipCallbackHint,
  ChatRelationshipCounterpartKind,
  ChatRelationshipLegacyProjection,
  ChatRelationshipObjective,
  ChatRelationshipPressureBand,
  ChatRelationshipSnapshot,
  ChatRelationshipStance,
  ChatRelationshipSummaryView,
  ChatRelationshipVector,
} from '../../../../../../shared/contracts/chat/relationship';

import { clamp01, weightedBlend } from '../../../../../../shared/contracts/chat/relationship';

// ============================================================================
// MARK: Constants
// ============================================================================

/** Heat below this threshold is considered negligible and eligible for pruning. */
const HEAT_PRUNE_THRESHOLD = 0.02 as const;

/** Heat decay factor applied per settlement tick. */
const HEAT_DECAY_FACTOR = 0.96 as const;

/** Intensity above this threshold qualifies as FEVER momentum. */
const FEVER_BAND_THRESHOLD = 0.80 as const;

/** Intensity above this threshold qualifies as HOT momentum. */
const HOT_BAND_THRESHOLD = 0.55 as const;

/** Intensity above this threshold qualifies as WARM momentum. */
const WARM_BAND_THRESHOLD = 0.28 as const;

/** Minimum time-between-touch (ms) before a counterpart is considered dormant. */
const DORMANCY_THRESHOLD_MS = 1000 * 60 * 18;

/** Escalation risk threshold above which a counterpart is flagged as high risk. */
const HIGH_ESCALATION_THRESHOLD = 0.66 as const;

/** Rescue readiness threshold above which a counterpart is marked ready to rescue. */
const RESCUE_READINESS_THRESHOLD = 0.64 as const;

/** Max number of unresolved callback IDs retained before pruning the oldest. */
const MAX_UNRESOLVED_CALLBACKS = 64 as const;

/** All ChatVisibleChannel values as a stable tuple for iteration. */
const ALL_VISIBLE_CHANNELS: readonly ChatVisibleChannel[] = [
  'GLOBAL',
  'SYNDICATE',
  'DEAL_ROOM',
  'LOBBY',
] as const;

// ============================================================================
// MARK: Momentum band
// ============================================================================

/**
 * Describes the intensity momentum tier of a tracked counterpart.
 * Mirrors ChatRelationshipMomentumBand from the intelligence model but
 * re-declared here so the state slice is not coupled to the model at runtime.
 */
export type ChatPhaseTwoMomentumBand = 'QUIET' | 'WARM' | 'HOT' | 'FEVER';

// ============================================================================
// MARK: Core projection type
// ============================================================================

/**
 * Full per-counterpart projection stored in the Phase 2 state slice.
 *
 * The projection captures both the rich summary view (for NPC orchestration)
 * and the legacy vector (for backward-compatible clients) alongside derived
 * analytics that do not require live model access.
 *
 * Fields derived from ChatRelationshipCounterpartDigest are populated by the
 * bridge during sync. They are safe to use for orchestration reads between
 * sync cycles.
 */
export interface ChatPhaseTwoCounterpartProjection {
  /** The stable identifier for this counterpart (matches relationship model). */
  readonly counterpartId: string;

  /** Full summary view as produced by ChatRelationshipModel.summaries(). */
  readonly summary: ChatRelationshipSummaryView;

  /** Legacy projection for backward-compatible clients. */
  readonly legacy: ChatRelationshipLegacyProjection;

  /** Counterpart kind (NPC, BOT, HELPER, RIVAL, etc). */
  readonly counterpartKind: ChatRelationshipCounterpartKind;

  /** Momentum band derived from intensity01 at time of sync. */
  readonly momentumBand: ChatPhaseTwoMomentumBand;

  /** Escalation risk score [0,1] at time of sync. */
  readonly escalationRisk01: number;

  /** Rescue readiness score [0,1] at time of sync. */
  readonly rescueReadiness01: number;

  /** Discipline signal score [0,1] at time of sync. */
  readonly disciplineSignal01: number;

  /** Greed signal score [0,1] at time of sync. */
  readonly greedSignal01: number;

  /** Public witness heat [0,1] at time of sync. */
  readonly witnessHeat01: number;

  /** Selection weight [0,1] — higher means this counterpart should speak more. */
  readonly selectionWeight01: number;

  /** Dominant relationship axes driving the current stance. */
  readonly dominantAxes: readonly ChatRelationshipAxisId[];

  /** Number of pending callback hints attached to this counterpart. */
  readonly callbackHintCount: number;

  /**
   * Snapshot of the highest-priority callback hint, or undefined if none.
   * Orchestrators can embed this directly into NPC line generation.
   */
  readonly topCallbackHint?: ChatRelationshipCallbackHint;

  /** Channel this counterpart was last active in. */
  readonly lastChannelId?: string | null;

  /** Human-readable summary of the last notable event for this counterpart. */
  readonly lastEventSummary?: string | null;

  /** Timestamp of last touch (ms epoch). Drives dormancy detection. */
  readonly lastTouchedAt: UnixMs;
}

// ============================================================================
// MARK: Diagnostics snapshot (embedded in slice, refreshed on sync)
// ============================================================================

export interface ChatPhaseTwoDiagnosticsSnapshot {
  readonly createdAt: UnixMs;
  readonly counterpartCount: number;
  readonly totalRelationshipEvents: number;
  readonly topCounterpartIds: readonly string[];
  readonly dominantCounterpartId?: string;
  readonly channelHeat: Readonly<Record<ChatVisibleChannel, number>>;
  readonly escalationRiskAggregate: number;
  readonly rescueReadinessAggregate: number;
  readonly volatilitySpread: number;
  readonly activeCallbackTotal: number;
}

// ============================================================================
// MARK: Analytics result types
// ============================================================================

/**
 * Aggregate pressure view across all tracked counterparts in a given slice.
 */
export interface ChatPhaseTwoPressureAggregate {
  readonly aggregateIntensity01: number;
  readonly peakIntensity01: number;
  readonly peakCounterpartId?: string;
  readonly pressureBand: ChatRelationshipPressureBand;
  readonly channelPressure: Readonly<Record<ChatVisibleChannel, number>>;
  readonly totalEscalationWeight: number;
  readonly volatilitySpread: number;
  readonly totalCounterparts: number;
}

/**
 * Cross-channel summary collating per-channel focus, heat, and aggregate scores.
 */
export interface ChatPhaseTwoCrossChannelSummary {
  readonly totalCounterparts: number;
  readonly activeChannels: readonly ChatVisibleChannel[];
  readonly heatByChannel: Readonly<Record<ChatVisibleChannel, number>>;
  readonly focusByChannel: Readonly<Record<ChatVisibleChannel, string | undefined>>;
  readonly topCounterpartId?: string;
  readonly aggregateIntensity01: number;
  readonly aggregateEscalationRisk01: number;
  readonly aggregateRescueReadiness01: number;
  readonly totalCallbacks: number;
  readonly highEscalationCounterpartIds: readonly string[];
  readonly rescueReadyCounterpartIds: readonly string[];
}

/**
 * Momentum view for a single counterpart — supports rising/falling threat detection.
 */
export interface ChatPhaseTwoMomentumView {
  readonly counterpartId: string;
  readonly momentumBand: ChatPhaseTwoMomentumBand;
  readonly intensity01: number;
  readonly volatility01: number;
  readonly escalationRisk01: number;
  readonly rescueReadiness01: number;
  readonly isRisingThreat: boolean;
  readonly isFeverBreaking: boolean;
  readonly isDecaying: boolean;
  readonly witnessHeat01: number;
  readonly dominantAxes: readonly ChatRelationshipAxisId[];
}

/**
 * Axis dominance map — which counterparts dominate each relationship axis.
 */
export interface ChatPhaseTwoAxisDominanceMap {
  readonly byAxis: Readonly<Record<ChatRelationshipAxisId, readonly string[]>>;
  readonly dominantAxis?: ChatRelationshipAxisId;
  readonly dominantAxisCounterpartId?: string;
  readonly axisCount: number;
}

/**
 * Diff between two Phase 2 state slices — used by the bridge for incremental sync reporting.
 */
export interface ChatPhaseTwoRelationshipDiff {
  readonly addedCounterpartIds: readonly string[];
  readonly removedCounterpartIds: readonly string[];
  readonly changedCounterpartIds: readonly string[];
  readonly focusChanges: Partial<Record<ChatVisibleChannel, { readonly prev?: string; readonly next?: string }>>;
  readonly heatDeltas: Readonly<Record<string, number>>;
  readonly snapshotEventDelta: number;
  readonly syncTimeDelta: number;
  readonly escalationDeltas: Readonly<Record<string, number>>;
  readonly rescueDeltas: Readonly<Record<string, number>>;
  readonly hasAnyChange: boolean;
}

/**
 * Selection context — used by NPC orchestrators to pick the best counterpart
 * for a given channel + intent combination.
 */
export interface ChatPhaseTwoSelectionContext {
  readonly channelId: ChatVisibleChannel;
  readonly candidateIds?: readonly string[];
  readonly preferHighEscalation?: boolean;
  readonly preferRescueReady?: boolean;
  readonly preferHighFamiliarity?: boolean;
  readonly preferObsession?: boolean;
  readonly excludeIds?: readonly string[];
}

/**
 * Result of a counterpart selection query.
 */
export interface ChatPhaseTwoSelectionResult {
  readonly selectedId?: string;
  readonly selectionScore01: number;
  readonly candidatesConsidered: number;
  readonly selectionBasis: readonly string[];
}

/**
 * Heat row for a single channel — used in cross-channel aggregation.
 */
export interface ChatPhaseTwoChannelHeatRow {
  readonly channelId: ChatVisibleChannel;
  readonly heat01: number;
  readonly focusCounterpartId?: string;
  readonly topCounterpartIds: readonly string[];
  readonly isActive: boolean;
}

// ============================================================================
// MARK: Core state slice
// ============================================================================

/**
 * Phase 2 state slice attached to the backend ChatState.
 *
 * All fields are readonly. Mutations return new slices via helpers below.
 * This slice is safe to serialize to JSON and restore via hydratePhaseTwoStateSlice.
 */
export interface ChatPhaseTwoStateSlice {
  /** Full relationship snapshot from the last bridge sync. */
  readonly relationshipSnapshot?: ChatRelationshipSnapshot;

  /** All tracked counterpart projections, indexed by counterpartId. */
  readonly counterpartProjectionsById: Readonly<Record<string, ChatPhaseTwoCounterpartProjection>>;

  /** Which counterpart is currently focused per visible channel. */
  readonly focusedCounterpartByChannel: Readonly<Record<ChatVisibleChannel, string | undefined>>;

  /** Relationship heat per counterpart [0,1] — reflects intensity at last sync. */
  readonly relationshipHeatByCounterpartId: Readonly<Record<string, number>>;

  /** Per-channel heat aggregate [0,1] — reflects witness heat rolled up per channel. */
  readonly channelHeatByChannelId: Readonly<Record<ChatVisibleChannel, number>>;

  /** Escalation risk per counterpart [0,1] — sourced from digest at last sync. */
  readonly escalationRiskByCounterpartId: Readonly<Record<string, number>>;

  /** Rescue readiness per counterpart [0,1] — sourced from digest at last sync. */
  readonly rescueReadinessByCounterpartId: Readonly<Record<string, number>>;

  /** Pending callback hints per counterpart — used by NPC line pickers. */
  readonly callbackCandidatesByCounterpartId: Readonly<Record<string, readonly ChatRelationshipCallbackHint[]>>;

  /** ID of the counterpart with the highest current selection weight. */
  readonly dominantCounterpartId?: string;

  /** Total relationship events tracked across all counterparts since last hydration. */
  readonly totalRelationshipEvents: number;

  /** IDs of callback hints that have been seeded but not yet resolved by NPC output. */
  readonly unresolvedCallbackIds: readonly string[];

  /** Snapshot of diagnostics produced on last sync — cheap to read without model access. */
  readonly diagnosticsSnapshot?: ChatPhaseTwoDiagnosticsSnapshot;

  /** Timestamp of the last bridge sync. */
  readonly lastPhaseTwoSyncAt?: UnixMs;
}

// ============================================================================
// MARK: Extended state union
// ============================================================================

/**
 * Backend ChatState extended with an optional Phase 2 slice.
 *
 * The canonical backend name follows the Phase 1 pattern (ChatStateWithPhaseOne).
 * ChatEngineStateWithPhaseTwo is retained as an alias for bridge backward compatibility.
 */
export type ChatStateWithPhaseTwo = ChatState & {
  readonly phaseTwo?: ChatPhaseTwoStateSlice;
};

/**
 * Backward-compatible alias. New code should prefer ChatStateWithPhaseTwo.
 * The old name referenced "ChatEngineState" which was a frontend-only type;
 * this alias keeps the bridge API stable while the base is now ChatState.
 */
export type ChatEngineStateWithPhaseTwo = ChatStateWithPhaseTwo;

// ============================================================================
// MARK: Default creators
// ============================================================================

export function createDefaultChannelHeatMap(): Readonly<Record<ChatVisibleChannel, number>> {
  return Object.freeze({
    GLOBAL: 0,
    SYNDICATE: 0,
    DEAL_ROOM: 0,
    LOBBY: 0,
  });
}

export function createDefaultFocusedCounterpartByChannel(): Readonly<Record<ChatVisibleChannel, string | undefined>> {
  return Object.freeze({
    GLOBAL: undefined,
    SYNDICATE: undefined,
    DEAL_ROOM: undefined,
    LOBBY: undefined,
  });
}

export function createDefaultChatPhaseTwoStateSlice(): ChatPhaseTwoStateSlice {
  return {
    relationshipSnapshot: undefined,
    counterpartProjectionsById: {},
    focusedCounterpartByChannel: createDefaultFocusedCounterpartByChannel(),
    relationshipHeatByCounterpartId: {},
    channelHeatByChannelId: createDefaultChannelHeatMap(),
    escalationRiskByCounterpartId: {},
    rescueReadinessByCounterpartId: {},
    callbackCandidatesByCounterpartId: {},
    dominantCounterpartId: undefined,
    totalRelationshipEvents: 0,
    unresolvedCallbackIds: [],
    diagnosticsSnapshot: undefined,
    lastPhaseTwoSyncAt: undefined,
  };
}

// ============================================================================
// MARK: Core state accessors
// ============================================================================

/** Returns the Phase 2 slice from a state, or a default empty slice. */
export function getPhaseTwoState(state: ChatStateWithPhaseTwo): ChatPhaseTwoStateSlice {
  return state.phaseTwo ?? createDefaultChatPhaseTwoStateSlice();
}

/** Returns true if the state has an initialized Phase 2 slice. */
export function hasPhaseTwoSlice(state: ChatStateWithPhaseTwo): boolean {
  return state.phaseTwo !== undefined;
}

/** Returns the total number of tracked counterparts in the Phase 2 slice. */
export function getPhaseTwoCounterpartCount(state: ChatStateWithPhaseTwo): number {
  return Object.keys(getPhaseTwoState(state).counterpartProjectionsById).length;
}

/** Returns all counterpart IDs tracked in the Phase 2 slice, sorted alphabetically. */
export function getPhaseTwoCounterpartIds(state: ChatStateWithPhaseTwo): readonly string[] {
  return Object.keys(getPhaseTwoState(state).counterpartProjectionsById).sort();
}

/** Returns a single counterpart projection by ID, or undefined. */
export function getPhaseTwoCounterpartProjection(
  state: ChatStateWithPhaseTwo,
  counterpartId: string,
): ChatPhaseTwoCounterpartProjection | undefined {
  return getPhaseTwoState(state).counterpartProjectionsById[counterpartId];
}

/** Returns true if the given counterpart is tracked in the Phase 2 slice. */
export function hasPhaseTwoCounterpart(state: ChatStateWithPhaseTwo, counterpartId: string): boolean {
  return counterpartId in getPhaseTwoState(state).counterpartProjectionsById;
}

/** Returns the currently focused counterpart for the given channel, if any. */
export function getPhaseTwoFocusedCounterpart(
  state: ChatStateWithPhaseTwo,
  channelId: ChatVisibleChannel,
): string | undefined {
  return getPhaseTwoState(state).focusedCounterpartByChannel[channelId];
}

/** Returns the relationship heat for a given counterpart. */
export function getPhaseTwoHeat(state: ChatStateWithPhaseTwo, counterpartId: string): number {
  return getPhaseTwoState(state).relationshipHeatByCounterpartId[counterpartId] ?? 0;
}

/** Returns the escalation risk for a given counterpart. */
export function getPhaseTwoEscalationRisk(state: ChatStateWithPhaseTwo, counterpartId: string): number {
  return getPhaseTwoState(state).escalationRiskByCounterpartId[counterpartId] ?? 0;
}

/** Returns the rescue readiness for a given counterpart. */
export function getPhaseTwoRescueReadiness(state: ChatStateWithPhaseTwo, counterpartId: string): number {
  return getPhaseTwoState(state).rescueReadinessByCounterpartId[counterpartId] ?? 0;
}

/** Returns true if the counterpart's escalation risk is above the high threshold. */
export function isPhaseTwoHighEscalation(state: ChatStateWithPhaseTwo, counterpartId: string): boolean {
  return getPhaseTwoEscalationRisk(state, counterpartId) >= HIGH_ESCALATION_THRESHOLD;
}

/** Returns true if the counterpart's rescue readiness is above the threshold. */
export function isPhaseTwoRescueReady(state: ChatStateWithPhaseTwo, counterpartId: string): boolean {
  return getPhaseTwoRescueReadiness(state, counterpartId) >= RESCUE_READINESS_THRESHOLD;
}

// ============================================================================
// MARK: Core state mutators — all return new state
// ============================================================================

/**
 * Wraps a Phase 2 state slice into the extended ChatState.
 * Always performs a shallow clone of all mutable sub-objects.
 */
export function withPhaseTwoState(
  state: ChatState,
  phaseTwo: ChatPhaseTwoStateSlice,
): ChatStateWithPhaseTwo {
  return {
    ...(state as ChatStateWithPhaseTwo),
    phaseTwo: {
      ...phaseTwo,
      counterpartProjectionsById: { ...phaseTwo.counterpartProjectionsById },
      focusedCounterpartByChannel: { ...phaseTwo.focusedCounterpartByChannel },
      relationshipHeatByCounterpartId: { ...phaseTwo.relationshipHeatByCounterpartId },
      channelHeatByChannelId: { ...phaseTwo.channelHeatByChannelId },
      escalationRiskByCounterpartId: { ...phaseTwo.escalationRiskByCounterpartId },
      rescueReadinessByCounterpartId: { ...phaseTwo.rescueReadinessByCounterpartId },
      callbackCandidatesByCounterpartId: { ...phaseTwo.callbackCandidatesByCounterpartId },
      unresolvedCallbackIds: [...phaseTwo.unresolvedCallbackIds],
    },
  };
}

/**
 * Sets the relationship snapshot and updates sync timestamp.
 */
export function setPhaseTwoRelationshipSnapshotInState(
  state: ChatStateWithPhaseTwo,
  relationshipSnapshot: ChatRelationshipSnapshot | undefined,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatStateWithPhaseTwo {
  const phaseTwo = getPhaseTwoState(state);
  const totalRelationshipEvents = relationshipSnapshot?.totalEventCount ?? phaseTwo.totalRelationshipEvents;
  return withPhaseTwoState(state, {
    ...phaseTwo,
    relationshipSnapshot,
    totalRelationshipEvents,
    lastPhaseTwoSyncAt: syncedAt,
  });
}

/**
 * Replaces all counterpart projections atomically.
 * Recomputes derived maps: heat, escalation, rescue, callbacks, dominance.
 */
export function setPhaseTwoCounterpartProjectionsInState(
  state: ChatStateWithPhaseTwo,
  projections: readonly ChatPhaseTwoCounterpartProjection[],
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatStateWithPhaseTwo {
  const phaseTwo = getPhaseTwoState(state);

  const counterpartProjectionsById: Record<string, ChatPhaseTwoCounterpartProjection> = {};
  const relationshipHeatByCounterpartId: Record<string, number> = {};
  const escalationRiskByCounterpartId: Record<string, number> = {};
  const rescueReadinessByCounterpartId: Record<string, number> = {};
  const callbackCandidatesByCounterpartId: Record<string, readonly ChatRelationshipCallbackHint[]> = {};

  let dominantCounterpartId: string | undefined;
  let dominantWeight = -1;

  for (const projection of projections) {
    const id = projection.counterpartId;
    counterpartProjectionsById[id] = projection;
    relationshipHeatByCounterpartId[id] = clamp01(projection.summary.intensity01);
    escalationRiskByCounterpartId[id] = clamp01(projection.escalationRisk01);
    rescueReadinessByCounterpartId[id] = clamp01(projection.rescueReadiness01);
    if (projection.topCallbackHint) {
      callbackCandidatesByCounterpartId[id] = [projection.topCallbackHint];
    }
    if (projection.selectionWeight01 > dominantWeight) {
      dominantWeight = projection.selectionWeight01;
      dominantCounterpartId = id;
    }
  }

  // Recompute channel heat from projections using focused channel mapping
  const channelHeatByChannelId: Record<ChatVisibleChannel, number> = {
    GLOBAL: 0,
    SYNDICATE: 0,
    DEAL_ROOM: 0,
    LOBBY: 0,
  };
  for (const ch of ALL_VISIBLE_CHANNELS) {
    const focusedId = phaseTwo.focusedCounterpartByChannel[ch];
    if (focusedId && counterpartProjectionsById[focusedId]) {
      channelHeatByChannelId[ch] = clamp01(
        counterpartProjectionsById[focusedId].witnessHeat01 * 0.55 +
        counterpartProjectionsById[focusedId].summary.intensity01 * 0.45,
      );
    } else {
      // Aggregate heat from all counterparts that were last seen in this channel
      let sum = 0;
      let count = 0;
      for (const proj of projections) {
        if (proj.lastChannelId === ch) {
          sum += proj.summary.intensity01;
          count++;
        }
      }
      channelHeatByChannelId[ch] = count > 0 ? clamp01(sum / count) : 0;
    }
  }

  return withPhaseTwoState(state, {
    ...phaseTwo,
    counterpartProjectionsById,
    relationshipHeatByCounterpartId,
    channelHeatByChannelId,
    escalationRiskByCounterpartId,
    rescueReadinessByCounterpartId,
    callbackCandidatesByCounterpartId,
    dominantCounterpartId,
    lastPhaseTwoSyncAt: syncedAt,
  });
}

/**
 * Sets the focused counterpart for a single channel.
 */
export function setPhaseTwoFocusedCounterpartInState(
  state: ChatStateWithPhaseTwo,
  channelId: ChatVisibleChannel,
  counterpartId: string | undefined,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatStateWithPhaseTwo {
  const phaseTwo = getPhaseTwoState(state);
  return withPhaseTwoState(state, {
    ...phaseTwo,
    focusedCounterpartByChannel: {
      ...phaseTwo.focusedCounterpartByChannel,
      [channelId]: counterpartId,
    },
    lastPhaseTwoSyncAt: syncedAt,
  });
}

/**
 * Sets multiple channel focus entries at once. More efficient than calling
 * setPhaseTwoFocusedCounterpartInState per channel when syncing a full focus map.
 */
export function setMultiplePhaseTwoFocusedCounterpartsInState(
  state: ChatStateWithPhaseTwo,
  focusMap: Partial<Record<ChatVisibleChannel, string | undefined>>,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatStateWithPhaseTwo {
  const phaseTwo = getPhaseTwoState(state);
  return withPhaseTwoState(state, {
    ...phaseTwo,
    focusedCounterpartByChannel: {
      ...phaseTwo.focusedCounterpartByChannel,
      ...focusMap,
    },
    lastPhaseTwoSyncAt: syncedAt,
  });
}

/**
 * Clears the focused counterpart for the given channel.
 */
export function clearPhaseTwoFocusedCounterpartInState(
  state: ChatStateWithPhaseTwo,
  channelId: ChatVisibleChannel,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatStateWithPhaseTwo {
  return setPhaseTwoFocusedCounterpartInState(state, channelId, undefined, syncedAt);
}

/**
 * Clears all channel focus entries, resetting to the default empty map.
 */
export function clearAllPhaseTwoFocusedCounterpartsInState(
  state: ChatStateWithPhaseTwo,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatStateWithPhaseTwo {
  const phaseTwo = getPhaseTwoState(state);
  return withPhaseTwoState(state, {
    ...phaseTwo,
    focusedCounterpartByChannel: createDefaultFocusedCounterpartByChannel(),
    lastPhaseTwoSyncAt: syncedAt,
  });
}

/**
 * Upserts a single counterpart projection without replacing others.
 * Recomputes derived scalars for the affected counterpart only.
 */
export function setPhaseTwoCounterpartProjectionInState(
  state: ChatStateWithPhaseTwo,
  projection: ChatPhaseTwoCounterpartProjection,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatStateWithPhaseTwo {
  const phaseTwo = getPhaseTwoState(state);
  const id = projection.counterpartId;

  // Determine new dominant after upsert
  let dominantCounterpartId = phaseTwo.dominantCounterpartId;
  const currentDominantWeight =
    dominantCounterpartId
      ? (phaseTwo.counterpartProjectionsById[dominantCounterpartId]?.selectionWeight01 ?? 0)
      : 0;
  if (projection.selectionWeight01 > currentDominantWeight) {
    dominantCounterpartId = id;
  } else if (dominantCounterpartId === id && projection.selectionWeight01 < currentDominantWeight) {
    // Recompute dominant from all projections
    dominantCounterpartId = computeDominantCounterpartId({
      ...phaseTwo.counterpartProjectionsById,
      [id]: projection,
    });
  }

  const updatedCallbacks: Record<string, readonly ChatRelationshipCallbackHint[]> = {
    ...phaseTwo.callbackCandidatesByCounterpartId,
  };
  if (projection.topCallbackHint) {
    updatedCallbacks[id] = [projection.topCallbackHint];
  } else {
    delete updatedCallbacks[id];
  }

  return withPhaseTwoState(state, {
    ...phaseTwo,
    counterpartProjectionsById: { ...phaseTwo.counterpartProjectionsById, [id]: projection },
    relationshipHeatByCounterpartId: {
      ...phaseTwo.relationshipHeatByCounterpartId,
      [id]: clamp01(projection.summary.intensity01),
    },
    escalationRiskByCounterpartId: {
      ...phaseTwo.escalationRiskByCounterpartId,
      [id]: clamp01(projection.escalationRisk01),
    },
    rescueReadinessByCounterpartId: {
      ...phaseTwo.rescueReadinessByCounterpartId,
      [id]: clamp01(projection.rescueReadiness01),
    },
    callbackCandidatesByCounterpartId: updatedCallbacks,
    dominantCounterpartId,
    lastPhaseTwoSyncAt: syncedAt,
  });
}

/**
 * Removes a counterpart projection from the state.
 * Clears associated heat, escalation, rescue, and callback entries.
 * Recomputes focused channel entries if this counterpart was focused.
 */
export function removePhaseTwoCounterpartProjectionFromState(
  state: ChatStateWithPhaseTwo,
  counterpartId: string,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatStateWithPhaseTwo {
  const phaseTwo = getPhaseTwoState(state);
  if (!(counterpartId in phaseTwo.counterpartProjectionsById)) return state;

  const nextProjections = { ...phaseTwo.counterpartProjectionsById };
  delete nextProjections[counterpartId];

  const nextHeat = { ...phaseTwo.relationshipHeatByCounterpartId };
  delete nextHeat[counterpartId];

  const nextEscalation = { ...phaseTwo.escalationRiskByCounterpartId };
  delete nextEscalation[counterpartId];

  const nextRescue = { ...phaseTwo.rescueReadinessByCounterpartId };
  delete nextRescue[counterpartId];

  const nextCallbacks = { ...phaseTwo.callbackCandidatesByCounterpartId };
  delete nextCallbacks[counterpartId];

  // Clear focused channel entries pointing to removed counterpart
  const nextFocus: Record<ChatVisibleChannel, string | undefined> = {
    ...phaseTwo.focusedCounterpartByChannel,
  };
  for (const ch of ALL_VISIBLE_CHANNELS) {
    if (nextFocus[ch] === counterpartId) nextFocus[ch] = undefined;
  }

  const dominantCounterpartId =
    phaseTwo.dominantCounterpartId === counterpartId
      ? computeDominantCounterpartId(nextProjections)
      : phaseTwo.dominantCounterpartId;

  return withPhaseTwoState(state, {
    ...phaseTwo,
    counterpartProjectionsById: nextProjections,
    relationshipHeatByCounterpartId: nextHeat,
    channelHeatByChannelId: recomputeChannelHeat(nextProjections, nextFocus),
    escalationRiskByCounterpartId: nextEscalation,
    rescueReadinessByCounterpartId: nextRescue,
    callbackCandidatesByCounterpartId: nextCallbacks,
    focusedCounterpartByChannel: nextFocus,
    dominantCounterpartId,
    lastPhaseTwoSyncAt: syncedAt,
  });
}

/**
 * Applies heat decay to all counterpart heat values.
 * Values below HEAT_PRUNE_THRESHOLD are removed.
 * Channel heat is recalculated from remaining entries.
 */
export function applyPhaseTwoHeatDecayInState(
  state: ChatStateWithPhaseTwo,
  decayFactor: number = HEAT_DECAY_FACTOR,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatStateWithPhaseTwo {
  const phaseTwo = getPhaseTwoState(state);
  const factor = Math.max(0, Math.min(1, decayFactor));

  const nextHeat: Record<string, number> = {};
  for (const [id, heat] of Object.entries(phaseTwo.relationshipHeatByCounterpartId)) {
    const decayed = clamp01(heat * factor);
    if (decayed > HEAT_PRUNE_THRESHOLD) nextHeat[id] = decayed;
  }

  const nextChannelHeat: Record<ChatVisibleChannel, number> = {
    GLOBAL: clamp01((phaseTwo.channelHeatByChannelId.GLOBAL ?? 0) * factor),
    SYNDICATE: clamp01((phaseTwo.channelHeatByChannelId.SYNDICATE ?? 0) * factor),
    DEAL_ROOM: clamp01((phaseTwo.channelHeatByChannelId.DEAL_ROOM ?? 0) * factor),
    LOBBY: clamp01((phaseTwo.channelHeatByChannelId.LOBBY ?? 0) * factor),
  };

  return withPhaseTwoState(state, {
    ...phaseTwo,
    relationshipHeatByCounterpartId: nextHeat,
    channelHeatByChannelId: nextChannelHeat,
    lastPhaseTwoSyncAt: syncedAt,
  });
}

/**
 * Removes counterpart projections that have become dormant (low heat, no callbacks).
 * Does not remove the dominant counterpart or anyone with a pending callback.
 */
export function prunePhaseTwoStaleCounterpartsFromState(
  state: ChatStateWithPhaseTwo,
  now: UnixMs = Date.now() as UnixMs,
  options: {
    readonly heatThreshold?: number;
    readonly dormancyMs?: number;
    readonly preserveDominant?: boolean;
  } = {},
): ChatStateWithPhaseTwo {
  const phaseTwo = getPhaseTwoState(state);
  const heatThreshold = options.heatThreshold ?? HEAT_PRUNE_THRESHOLD;
  const dormancyMs = options.dormancyMs ?? DORMANCY_THRESHOLD_MS;
  const preserveDominant = options.preserveDominant ?? true;

  const prunable: string[] = [];
  for (const [id, projection] of Object.entries(phaseTwo.counterpartProjectionsById)) {
    if (preserveDominant && id === phaseTwo.dominantCounterpartId) continue;
    if (projection.callbackHintCount > 0) continue;
    const heat = phaseTwo.relationshipHeatByCounterpartId[id] ?? 0;
    const timeSinceTouch = Number(now) - Number(projection.lastTouchedAt);
    if (heat < heatThreshold && timeSinceTouch >= dormancyMs) {
      prunable.push(id);
    }
  }

  if (prunable.length === 0) return state;

  let nextState: ChatStateWithPhaseTwo = state;
  for (const id of prunable) {
    nextState = removePhaseTwoCounterpartProjectionFromState(nextState, id, now);
  }
  return nextState;
}

/**
 * Incremental merge: updates only the counterparts present in the incoming projections.
 * Counterparts not present in the incoming list are preserved unchanged.
 */
export function mergePhaseTwoProjections(
  state: ChatStateWithPhaseTwo,
  incomingProjections: readonly ChatPhaseTwoCounterpartProjection[],
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatStateWithPhaseTwo {
  let nextState: ChatStateWithPhaseTwo = state;
  for (const projection of incomingProjections) {
    nextState = setPhaseTwoCounterpartProjectionInState(nextState, projection, syncedAt);
  }
  return { ...nextState, phaseTwo: { ...getPhaseTwoState(nextState), lastPhaseTwoSyncAt: syncedAt } };
}

/**
 * Applies an incremental relationship snapshot without replacing the full projection set.
 * Useful when only a subset of counterparts changed since the last sync.
 */
export function mergePhaseTwoRelationshipSnapshotIncrementalInState(
  state: ChatStateWithPhaseTwo,
  snapshot: ChatRelationshipSnapshot,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatStateWithPhaseTwo {
  const phaseTwo = getPhaseTwoState(state);
  const updatedFocus: Partial<Record<ChatVisibleChannel, string | undefined>> = {};
  for (const [channelId, counterpartId] of Object.entries(snapshot.focusedCounterpartByChannel)) {
    if (isVisibleChannel(channelId)) {
      updatedFocus[channelId] = counterpartId;
    }
  }

  let nextState = withPhaseTwoState(state, {
    ...phaseTwo,
    relationshipSnapshot: snapshot,
    totalRelationshipEvents: snapshot.totalEventCount,
    lastPhaseTwoSyncAt: syncedAt,
  });

  if (Object.keys(updatedFocus).length > 0) {
    nextState = setMultiplePhaseTwoFocusedCounterpartsInState(nextState, updatedFocus, syncedAt);
  }

  return nextState;
}

/**
 * Seeds an unresolved callback ID into the slice.
 * Prevents duplicate entries and enforces the MAX_UNRESOLVED_CALLBACKS cap.
 */
export function addPhaseTwoUnresolvedCallbackInState(
  state: ChatStateWithPhaseTwo,
  callbackId: string,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatStateWithPhaseTwo {
  const phaseTwo = getPhaseTwoState(state);
  if (phaseTwo.unresolvedCallbackIds.includes(callbackId)) return state;

  const next = [callbackId, ...phaseTwo.unresolvedCallbackIds];
  const trimmed = next.slice(0, MAX_UNRESOLVED_CALLBACKS);

  return withPhaseTwoState(state, {
    ...phaseTwo,
    unresolvedCallbackIds: trimmed,
    lastPhaseTwoSyncAt: syncedAt,
  });
}

/**
 * Removes a resolved callback ID from the unresolved set.
 */
export function resolvePhaseTwoCallbackInState(
  state: ChatStateWithPhaseTwo,
  callbackId: string,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatStateWithPhaseTwo {
  const phaseTwo = getPhaseTwoState(state);
  const filtered = phaseTwo.unresolvedCallbackIds.filter((id) => id !== callbackId);
  if (filtered.length === phaseTwo.unresolvedCallbackIds.length) return state;

  return withPhaseTwoState(state, {
    ...phaseTwo,
    unresolvedCallbackIds: filtered,
    lastPhaseTwoSyncAt: syncedAt,
  });
}

/**
 * Embeds a diagnostics snapshot into the state slice.
 * Called by the bridge after each full sync to keep diagnostics cheap to read.
 */
export function setPhaseTwoDiagnosticsSnapshotInState(
  state: ChatStateWithPhaseTwo,
  diagnosticsSnapshot: ChatPhaseTwoDiagnosticsSnapshot,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatStateWithPhaseTwo {
  const phaseTwo = getPhaseTwoState(state);
  return withPhaseTwoState(state, {
    ...phaseTwo,
    diagnosticsSnapshot,
    lastPhaseTwoSyncAt: syncedAt,
  });
}

/**
 * Hard-resets the Phase 2 state slice to the empty default.
 * Used for session reset and test teardown.
 */
export function resetPhaseTwoStateSlice(
  state: ChatStateWithPhaseTwo,
): ChatStateWithPhaseTwo {
  return withPhaseTwoState(state, createDefaultChatPhaseTwoStateSlice());
}

// ============================================================================
// MARK: Analytics selectors
// ============================================================================

/**
 * Returns all counterpart projections sorted by selection weight descending.
 * Ties broken by counterpartId for determinism.
 */
export function getPhaseTwoCounterpartsBySelectionWeight(
  state: ChatStateWithPhaseTwo,
): readonly ChatPhaseTwoCounterpartProjection[] {
  return Object.values(getPhaseTwoState(state).counterpartProjectionsById).sort(
    (a, b) =>
      b.selectionWeight01 - a.selectionWeight01 || a.counterpartId.localeCompare(b.counterpartId),
  );
}

/**
 * Returns all counterpart projections sorted by intensity descending.
 */
export function getPhaseTwoCounterpartsByIntensity(
  state: ChatStateWithPhaseTwo,
): readonly ChatPhaseTwoCounterpartProjection[] {
  return Object.values(getPhaseTwoState(state).counterpartProjectionsById).sort(
    (a, b) =>
      b.summary.intensity01 - a.summary.intensity01 || a.counterpartId.localeCompare(b.counterpartId),
  );
}

/**
 * Returns the dominant counterpart projection — the one with the highest selection weight.
 */
export function getPhaseTwoDominantCounterpart(
  state: ChatStateWithPhaseTwo,
): ChatPhaseTwoCounterpartProjection | undefined {
  const phaseTwo = getPhaseTwoState(state);
  if (!phaseTwo.dominantCounterpartId) return undefined;
  return phaseTwo.counterpartProjectionsById[phaseTwo.dominantCounterpartId];
}

/**
 * Returns counterparts whose escalation risk is above the HIGH threshold.
 * Sorted by escalation risk descending.
 */
export function getPhaseTwoHighEscalationCounterparts(
  state: ChatStateWithPhaseTwo,
): readonly ChatPhaseTwoCounterpartProjection[] {
  return Object.values(getPhaseTwoState(state).counterpartProjectionsById)
    .filter((p) => p.escalationRisk01 >= HIGH_ESCALATION_THRESHOLD)
    .sort((a, b) => b.escalationRisk01 - a.escalationRisk01 || a.counterpartId.localeCompare(b.counterpartId));
}

/**
 * Returns counterparts whose rescue readiness is above the RESCUE_READINESS threshold.
 * Sorted by rescue readiness descending.
 */
export function getPhaseTwoRescueReadyCounterparts(
  state: ChatStateWithPhaseTwo,
): readonly ChatPhaseTwoCounterpartProjection[] {
  return Object.values(getPhaseTwoState(state).counterpartProjectionsById)
    .filter((p) => p.rescueReadiness01 >= RESCUE_READINESS_THRESHOLD)
    .sort((a, b) => b.rescueReadiness01 - a.rescueReadiness01 || a.counterpartId.localeCompare(b.counterpartId));
}

/**
 * Returns counterparts sorted by descending callback hint count.
 * Only returns counterparts with at least one pending callback.
 */
export function getPhaseTwoTopCallbackCandidates(
  state: ChatStateWithPhaseTwo,
  limit = 8,
): readonly ChatPhaseTwoCounterpartProjection[] {
  return Object.values(getPhaseTwoState(state).counterpartProjectionsById)
    .filter((p) => p.callbackHintCount > 0)
    .sort((a, b) => b.callbackHintCount - a.callbackHintCount || a.counterpartId.localeCompare(b.counterpartId))
    .slice(0, Math.max(1, limit));
}

/**
 * Returns the unresolved callback IDs from the state slice.
 */
export function getPhaseTwoUnresolvedCallbacks(
  state: ChatStateWithPhaseTwo,
): readonly string[] {
  return getPhaseTwoState(state).unresolvedCallbackIds;
}

/**
 * Returns the momentum view for a single counterpart, or undefined if not tracked.
 */
export function getPhaseTwoMomentumView(
  state: ChatStateWithPhaseTwo,
  counterpartId: string,
): ChatPhaseTwoMomentumView | undefined {
  const projection = getPhaseTwoState(state).counterpartProjectionsById[counterpartId];
  if (!projection) return undefined;

  const { summary, escalationRisk01, rescueReadiness01, witnessHeat01, dominantAxes } = projection;
  const band = deriveMomentumBand(summary.intensity01);
  const prevHeat = getPhaseTwoState(state).relationshipHeatByCounterpartId[counterpartId] ?? 0;

  return {
    counterpartId,
    momentumBand: band,
    intensity01: summary.intensity01,
    volatility01: summary.volatility01,
    escalationRisk01,
    rescueReadiness01,
    witnessHeat01,
    dominantAxes,
    isRisingThreat: escalationRisk01 >= 0.50 && summary.intensity01 > prevHeat,
    isFeverBreaking: band === 'HOT' && summary.volatility01 >= 0.70,
    isDecaying: summary.intensity01 < prevHeat * 0.85,
  };
}

/**
 * Computes an axis dominance map — which counterpart(s) dominate each relationship axis.
 */
export function getPhaseTwoAxisDominanceMap(
  state: ChatStateWithPhaseTwo,
): ChatPhaseTwoAxisDominanceMap {
  const phaseTwo = getPhaseTwoState(state);
  const projections = Object.values(phaseTwo.counterpartProjectionsById);

  const byAxis: Partial<Record<ChatRelationshipAxisId, string[]>> = {};
  const axisCounts: Partial<Record<ChatRelationshipAxisId, number>> = {};

  for (const projection of projections) {
    for (const axis of projection.dominantAxes) {
      if (!byAxis[axis]) byAxis[axis] = [];
      byAxis[axis]!.push(projection.counterpartId);
      axisCounts[axis] = (axisCounts[axis] ?? 0) + 1;
    }
  }

  // Sort each axis bucket by selection weight descending
  for (const [axis, ids] of Object.entries(byAxis) as [ChatRelationshipAxisId, string[]][]) {
    ids.sort((a, b) => {
      const wa = phaseTwo.counterpartProjectionsById[a]?.selectionWeight01 ?? 0;
      const wb = phaseTwo.counterpartProjectionsById[b]?.selectionWeight01 ?? 0;
      return wb - wa;
    });
  }

  // Find the dominant axis (most counterparts sharing it)
  let dominantAxis: ChatRelationshipAxisId | undefined;
  let dominantAxisCount = 0;
  for (const [axis, count] of Object.entries(axisCounts) as [ChatRelationshipAxisId, number][]) {
    if (count > dominantAxisCount) {
      dominantAxisCount = count;
      dominantAxis = axis;
    }
  }

  const dominantAxisCounterpartId = dominantAxis
    ? byAxis[dominantAxis]?.[0]
    : undefined;

  return {
    byAxis: byAxis as Readonly<Record<ChatRelationshipAxisId, readonly string[]>>,
    dominantAxis,
    dominantAxisCounterpartId,
    axisCount: Object.keys(byAxis).length,
  };
}

/**
 * Computes a cross-channel summary — the primary read surface for orchestrators
 * that need a high-level view of relationship state across all channels.
 */
export function getPhaseTwoCrossChannelSummary(
  state: ChatStateWithPhaseTwo,
): ChatPhaseTwoCrossChannelSummary {
  const phaseTwo = getPhaseTwoState(state);
  const projections = Object.values(phaseTwo.counterpartProjectionsById);

  let totalIntensity = 0;
  let totalEscalation = 0;
  let totalRescue = 0;
  let totalCallbacks = 0;
  const highEscalationIds: string[] = [];
  const rescueReadyIds: string[] = [];

  for (const p of projections) {
    totalIntensity += p.summary.intensity01;
    totalEscalation += p.escalationRisk01;
    totalRescue += p.rescueReadiness01;
    totalCallbacks += p.callbackHintCount;
    if (p.escalationRisk01 >= HIGH_ESCALATION_THRESHOLD) highEscalationIds.push(p.counterpartId);
    if (p.rescueReadiness01 >= RESCUE_READINESS_THRESHOLD) rescueReadyIds.push(p.counterpartId);
  }

  const count = projections.length || 1;
  const activeChannels: ChatVisibleChannel[] = [];

  for (const ch of ALL_VISIBLE_CHANNELS) {
    if ((phaseTwo.channelHeatByChannelId[ch] ?? 0) > HEAT_PRUNE_THRESHOLD) {
      activeChannels.push(ch);
    }
  }

  return {
    totalCounterparts: projections.length,
    activeChannels,
    heatByChannel: { ...phaseTwo.channelHeatByChannelId },
    focusByChannel: { ...phaseTwo.focusedCounterpartByChannel },
    topCounterpartId: phaseTwo.dominantCounterpartId,
    aggregateIntensity01: clamp01(totalIntensity / count),
    aggregateEscalationRisk01: clamp01(totalEscalation / count),
    aggregateRescueReadiness01: clamp01(totalRescue / count),
    totalCallbacks,
    highEscalationCounterpartIds: highEscalationIds.sort(),
    rescueReadyCounterpartIds: rescueReadyIds.sort(),
  };
}

/**
 * Computes a pressure aggregate across all tracked counterparts.
 * Used by moderation policy and drama orchestrator to gauge global tension.
 */
export function computePhaseTwoPressureAggregate(
  state: ChatStateWithPhaseTwo,
): ChatPhaseTwoPressureAggregate {
  const phaseTwo = getPhaseTwoState(state);
  const projections = Object.values(phaseTwo.counterpartProjectionsById);

  let totalIntensity = 0;
  let totalEscalation = 0;
  let totalVolatility = 0;
  let peakIntensity = 0;
  let peakCounterpartId: string | undefined;

  for (const p of projections) {
    totalIntensity += p.summary.intensity01;
    totalEscalation += p.escalationRisk01;
    totalVolatility += p.summary.volatility01;
    if (p.summary.intensity01 > peakIntensity) {
      peakIntensity = p.summary.intensity01;
      peakCounterpartId = p.counterpartId;
    }
  }

  const count = projections.length || 1;
  const aggregateIntensity = clamp01(totalIntensity / count);
  const volatilitySpread = clamp01(totalVolatility / count);

  const pressureBand: ChatRelationshipPressureBand =
    aggregateIntensity >= 0.80
      ? 'CRITICAL'
      : aggregateIntensity >= 0.60
        ? 'HIGH'
        : aggregateIntensity >= 0.35
          ? 'MEDIUM'
          : 'LOW';

  const channelPressure: Record<ChatVisibleChannel, number> = {
    GLOBAL: clamp01(phaseTwo.channelHeatByChannelId.GLOBAL ?? 0),
    SYNDICATE: clamp01(phaseTwo.channelHeatByChannelId.SYNDICATE ?? 0),
    DEAL_ROOM: clamp01(phaseTwo.channelHeatByChannelId.DEAL_ROOM ?? 0),
    LOBBY: clamp01(phaseTwo.channelHeatByChannelId.LOBBY ?? 0),
  };

  return {
    aggregateIntensity01: aggregateIntensity,
    peakIntensity01: clamp01(peakIntensity),
    peakCounterpartId,
    pressureBand,
    channelPressure,
    totalEscalationWeight: clamp01(totalEscalation / count),
    volatilitySpread,
    totalCounterparts: projections.length,
  };
}

/**
 * Selects the best counterpart for a given channel + intent context.
 * Uses a weighted scoring model that respects the selection context flags.
 */
export function selectPhaseTwoFocusedCounterpart(
  state: ChatStateWithPhaseTwo,
  context: ChatPhaseTwoSelectionContext,
): ChatPhaseTwoSelectionResult {
  const phaseTwo = getPhaseTwoState(state);
  let candidates = Object.values(phaseTwo.counterpartProjectionsById);

  if (context.candidateIds?.length) {
    const allowed = new Set(context.candidateIds);
    candidates = candidates.filter((p) => allowed.has(p.counterpartId));
  }

  if (context.excludeIds?.length) {
    const excluded = new Set(context.excludeIds);
    candidates = candidates.filter((p) => !excluded.has(p.counterpartId));
  }

  if (candidates.length === 0) {
    return { selectedId: undefined, selectionScore01: 0, candidatesConsidered: 0, selectionBasis: ['no_candidates'] };
  }

  // Check if channel has an existing focus that's still in the candidate set
  const existingFocus = phaseTwo.focusedCounterpartByChannel[context.channelId];
  if (existingFocus && candidates.some((p) => p.counterpartId === existingFocus)) {
    const focusProjScore = candidates.find((p) => p.counterpartId === existingFocus)?.selectionWeight01 ?? 0;
    if (focusProjScore >= 0.45) {
      return {
        selectedId: existingFocus,
        selectionScore01: focusProjScore,
        candidatesConsidered: candidates.length,
        selectionBasis: ['channel_focus_retained'],
      };
    }
  }

  // Score each candidate
  const scored = candidates.map((p) => {
    let score = p.selectionWeight01 * 0.50;
    if (context.preferHighEscalation) score += p.escalationRisk01 * 0.20;
    if (context.preferRescueReady) score += p.rescueReadiness01 * 0.20;
    if (context.preferHighFamiliarity) score += p.summary.familiarity01 * 0.15;
    if (context.preferObsession) score += p.summary.obsession01 * 0.15;
    // Channel bias
    if (p.lastChannelId === context.channelId) score += 0.12;
    // Callback density bonus
    if (p.callbackHintCount > 0) score += Math.min(0.08, p.callbackHintCount * 0.02);
    return { counterpartId: p.counterpartId, score: clamp01(score) };
  });

  scored.sort((a, b) => b.score - a.score || a.counterpartId.localeCompare(b.counterpartId));
  const best = scored[0];

  const selectionBasis: string[] = ['weighted_score'];
  if (context.preferHighEscalation) selectionBasis.push('prefer_escalation');
  if (context.preferRescueReady) selectionBasis.push('prefer_rescue');
  if (context.preferHighFamiliarity) selectionBasis.push('prefer_familiarity');
  if (context.preferObsession) selectionBasis.push('prefer_obsession');

  return {
    selectedId: best.counterpartId,
    selectionScore01: best.score,
    candidatesConsidered: candidates.length,
    selectionBasis,
  };
}

/**
 * Computes a diff between two Phase 2 state slices.
 * Useful for telemetry, sync reporting, and incremental UI updates.
 */
export function computePhaseTwoRelationshipDiff(
  prev: ChatPhaseTwoStateSlice,
  next: ChatPhaseTwoStateSlice,
): ChatPhaseTwoRelationshipDiff {
  const prevIds = new Set(Object.keys(prev.counterpartProjectionsById));
  const nextIds = new Set(Object.keys(next.counterpartProjectionsById));

  const addedCounterpartIds: string[] = [];
  const removedCounterpartIds: string[] = [];
  const changedCounterpartIds: string[] = [];

  for (const id of nextIds) {
    if (!prevIds.has(id)) addedCounterpartIds.push(id);
    else {
      const prevP = prev.counterpartProjectionsById[id];
      const nextP = next.counterpartProjectionsById[id];
      if (
        prevP.summary.intensity01 !== nextP.summary.intensity01 ||
        prevP.summary.stance !== nextP.summary.stance ||
        prevP.summary.objective !== nextP.summary.objective ||
        prevP.escalationRisk01 !== nextP.escalationRisk01
      ) {
        changedCounterpartIds.push(id);
      }
    }
  }
  for (const id of prevIds) {
    if (!nextIds.has(id)) removedCounterpartIds.push(id);
  }

  const focusChanges: Partial<Record<ChatVisibleChannel, { readonly prev?: string; readonly next?: string }>> = {};
  for (const ch of ALL_VISIBLE_CHANNELS) {
    const prevFocus = prev.focusedCounterpartByChannel[ch];
    const nextFocus = next.focusedCounterpartByChannel[ch];
    if (prevFocus !== nextFocus) {
      focusChanges[ch] = { prev: prevFocus, next: nextFocus };
    }
  }

  const heatDeltas: Record<string, number> = {};
  const escalationDeltas: Record<string, number> = {};
  const rescueDeltas: Record<string, number> = {};

  const allIds = new Set([...prevIds, ...nextIds]);
  for (const id of allIds) {
    const prevHeat = prev.relationshipHeatByCounterpartId[id] ?? 0;
    const nextHeat = next.relationshipHeatByCounterpartId[id] ?? 0;
    const delta = nextHeat - prevHeat;
    if (Math.abs(delta) > 0.001) heatDeltas[id] = delta;

    const prevEsc = prev.escalationRiskByCounterpartId[id] ?? 0;
    const nextEsc = next.escalationRiskByCounterpartId[id] ?? 0;
    const escDelta = nextEsc - prevEsc;
    if (Math.abs(escDelta) > 0.001) escalationDeltas[id] = escDelta;

    const prevResc = prev.rescueReadinessByCounterpartId[id] ?? 0;
    const nextResc = next.rescueReadinessByCounterpartId[id] ?? 0;
    const rescDelta = nextResc - prevResc;
    if (Math.abs(rescDelta) > 0.001) rescueDeltas[id] = rescDelta;
  }

  const snapshotEventDelta =
    (next.relationshipSnapshot?.totalEventCount ?? 0) -
    (prev.relationshipSnapshot?.totalEventCount ?? 0);
  const syncTimeDelta =
    (next.lastPhaseTwoSyncAt ?? 0) - (prev.lastPhaseTwoSyncAt ?? 0);

  const hasAnyChange =
    addedCounterpartIds.length > 0 ||
    removedCounterpartIds.length > 0 ||
    changedCounterpartIds.length > 0 ||
    Object.keys(focusChanges).length > 0 ||
    Object.keys(heatDeltas).length > 0;

  return {
    addedCounterpartIds: addedCounterpartIds.sort(),
    removedCounterpartIds: removedCounterpartIds.sort(),
    changedCounterpartIds: changedCounterpartIds.sort(),
    focusChanges,
    heatDeltas,
    snapshotEventDelta,
    syncTimeDelta,
    escalationDeltas,
    rescueDeltas,
    hasAnyChange,
  };
}

/**
 * Builds a diagnostics snapshot from the current state slice.
 * Intended to be stored back into the slice via setPhaseTwoDiagnosticsSnapshotInState.
 */
export function buildPhaseTwoDiagnosticsSnapshot(
  state: ChatStateWithPhaseTwo,
  now: UnixMs = Date.now() as UnixMs,
): ChatPhaseTwoDiagnosticsSnapshot {
  const phaseTwo = getPhaseTwoState(state);
  const projections = Object.values(phaseTwo.counterpartProjectionsById);

  let totalEscalation = 0;
  let totalRescue = 0;
  let totalCallbacks = 0;
  let maxVolatility = 0;
  let minVolatility = 1;

  for (const p of projections) {
    totalEscalation += p.escalationRisk01;
    totalRescue += p.rescueReadiness01;
    totalCallbacks += p.callbackHintCount;
    if (p.summary.volatility01 > maxVolatility) maxVolatility = p.summary.volatility01;
    if (p.summary.volatility01 < minVolatility) minVolatility = p.summary.volatility01;
  }

  const count = projections.length || 1;

  const topCounterpartIds = projections
    .sort((a, b) => b.selectionWeight01 - a.selectionWeight01)
    .slice(0, 6)
    .map((p) => p.counterpartId);

  return {
    createdAt: now,
    counterpartCount: projections.length,
    totalRelationshipEvents: phaseTwo.totalRelationshipEvents,
    topCounterpartIds,
    dominantCounterpartId: phaseTwo.dominantCounterpartId,
    channelHeat: { ...phaseTwo.channelHeatByChannelId },
    escalationRiskAggregate: clamp01(totalEscalation / count),
    rescueReadinessAggregate: clamp01(totalRescue / count),
    volatilitySpread: clamp01(maxVolatility - minVolatility),
    activeCallbackTotal: totalCallbacks,
  };
}

/**
 * Returns per-channel heat rows, sorted by heat descending.
 */
export function getPhaseTwoChannelHeatRows(
  state: ChatStateWithPhaseTwo,
): readonly ChatPhaseTwoChannelHeatRow[] {
  const phaseTwo = getPhaseTwoState(state);
  const projections = Object.values(phaseTwo.counterpartProjectionsById);

  return ALL_VISIBLE_CHANNELS.map((ch): ChatPhaseTwoChannelHeatRow => {
    const heat = phaseTwo.channelHeatByChannelId[ch] ?? 0;
    const focusCounterpartId = phaseTwo.focusedCounterpartByChannel[ch];
    const topCounterpartIds = projections
      .filter((p) => p.lastChannelId === ch)
      .sort((a, b) => b.selectionWeight01 - a.selectionWeight01)
      .slice(0, 4)
      .map((p) => p.counterpartId);

    return {
      channelId: ch,
      heat01: heat,
      focusCounterpartId,
      topCounterpartIds,
      isActive: heat > HEAT_PRUNE_THRESHOLD,
    };
  }).sort((a, b) => b.heat01 - a.heat01);
}

/**
 * Returns the relationship vector from the snapshot for a given counterpart, or null.
 */
export function getPhaseTwoRelationshipVector(
  state: ChatStateWithPhaseTwo,
  counterpartId: string,
): ChatRelationshipVector | null {
  const snapshot = getPhaseTwoState(state).relationshipSnapshot;
  if (!snapshot) return null;
  const counterpart = snapshot.counterparts.find((c) => c.counterpartId === counterpartId);
  return counterpart?.vector ?? null;
}

/**
 * Returns counterparts in FEVER momentum band — the highest-priority NPCs.
 */
export function getPhaseTwoFeverBandCounterparts(
  state: ChatStateWithPhaseTwo,
): readonly ChatPhaseTwoCounterpartProjection[] {
  return Object.values(getPhaseTwoState(state).counterpartProjectionsById).filter(
    (p) => p.momentumBand === 'FEVER',
  ).sort((a, b) => b.summary.intensity01 - a.summary.intensity01);
}

/**
 * Returns true if any tracked counterpart is in the FEVER momentum band.
 */
export function hasPhaseTwoFeverBandCounterpart(state: ChatStateWithPhaseTwo): boolean {
  return Object.values(getPhaseTwoState(state).counterpartProjectionsById).some(
    (p) => p.momentumBand === 'FEVER',
  );
}

/**
 * Returns the counterpart stances across all projections as a record.
 * Useful for drama orchestrator to understand the room's emotional texture.
 */
export function getPhaseTwoStanceMap(
  state: ChatStateWithPhaseTwo,
): Readonly<Record<string, ChatRelationshipStance>> {
  const result: Record<string, ChatRelationshipStance> = {};
  for (const [id, projection] of Object.entries(getPhaseTwoState(state).counterpartProjectionsById)) {
    result[id] = projection.summary.stance;
  }
  return result;
}

/**
 * Returns the counterpart objectives across all projections as a record.
 */
export function getPhaseTwoObjectiveMap(
  state: ChatStateWithPhaseTwo,
): Readonly<Record<string, ChatRelationshipObjective>> {
  const result: Record<string, ChatRelationshipObjective> = {};
  for (const [id, projection] of Object.entries(getPhaseTwoState(state).counterpartProjectionsById)) {
    result[id] = projection.summary.objective;
  }
  return result;
}

/**
 * Returns a flat list of all pending callback hints across all counterparts.
 * Sorted by weight descending.
 */
export function getAllPhaseTwoCallbackHints(
  state: ChatStateWithPhaseTwo,
): readonly ChatRelationshipCallbackHint[] {
  const phaseTwo = getPhaseTwoState(state);
  const hints: ChatRelationshipCallbackHint[] = [];
  for (const hintList of Object.values(phaseTwo.callbackCandidatesByCounterpartId)) {
    hints.push(...hintList);
  }
  return hints.sort((a, b) => b.weight01 - a.weight01 || a.callbackId.localeCompare(b.callbackId));
}

// ============================================================================
// MARK: Serialization helpers
// ============================================================================

/**
 * Produces a JSON-safe representation of the Phase 2 state slice.
 * Suitable for persistence, cache writes, and replay snapshots.
 */
export function serializePhaseTwoStateSlice(
  state: ChatStateWithPhaseTwo,
): ChatPhaseTwoStateSlice | undefined {
  const phaseTwo = state.phaseTwo;
  if (!phaseTwo) return undefined;

  return {
    ...phaseTwo,
    counterpartProjectionsById: Object.fromEntries(
      Object.entries(phaseTwo.counterpartProjectionsById).map(([id, proj]) => [
        id,
        {
          ...proj,
          dominantAxes: [...proj.dominantAxes],
          topCallbackHint: proj.topCallbackHint ? { ...proj.topCallbackHint } : undefined,
        },
      ]),
    ),
    focusedCounterpartByChannel: { ...phaseTwo.focusedCounterpartByChannel },
    relationshipHeatByCounterpartId: { ...phaseTwo.relationshipHeatByCounterpartId },
    channelHeatByChannelId: { ...phaseTwo.channelHeatByChannelId },
    escalationRiskByCounterpartId: { ...phaseTwo.escalationRiskByCounterpartId },
    rescueReadinessByCounterpartId: { ...phaseTwo.rescueReadinessByCounterpartId },
    callbackCandidatesByCounterpartId: Object.fromEntries(
      Object.entries(phaseTwo.callbackCandidatesByCounterpartId).map(([id, hints]) => [
        id,
        hints.map((h) => ({ ...h })),
      ]),
    ),
    unresolvedCallbackIds: [...phaseTwo.unresolvedCallbackIds],
    relationshipSnapshot: phaseTwo.relationshipSnapshot
      ? {
          ...phaseTwo.relationshipSnapshot,
          counterparts: phaseTwo.relationshipSnapshot.counterparts.map((c) => ({
            ...c,
            vector: { ...c.vector },
            callbackHints: c.callbackHints.map((h) => ({ ...h })),
            eventHistoryTail: c.eventHistoryTail.map((e) => ({
              ...e,
              tags: e.tags ? [...e.tags] : undefined,
            })),
            dominantAxes: [...c.dominantAxes],
          })),
          focusedCounterpartByChannel: { ...phaseTwo.relationshipSnapshot.focusedCounterpartByChannel },
        }
      : undefined,
    diagnosticsSnapshot: phaseTwo.diagnosticsSnapshot
      ? {
          ...phaseTwo.diagnosticsSnapshot,
          topCounterpartIds: [...phaseTwo.diagnosticsSnapshot.topCounterpartIds],
          channelHeat: { ...phaseTwo.diagnosticsSnapshot.channelHeat },
        }
      : undefined,
  };
}

/**
 * Restores a Phase 2 state slice from a raw deserialized value.
 * Safe to call with incomplete or null input — always returns a valid slice.
 */
export function hydratePhaseTwoStateSlice(
  raw: unknown,
  now: UnixMs = Date.now() as UnixMs,
): ChatPhaseTwoStateSlice {
  if (!raw || typeof raw !== 'object') return createDefaultChatPhaseTwoStateSlice();
  const value = raw as Partial<ChatPhaseTwoStateSlice>;

  const focusedCounterpartByChannel: Record<ChatVisibleChannel, string | undefined> = {
    GLOBAL: value.focusedCounterpartByChannel?.GLOBAL,
    SYNDICATE: value.focusedCounterpartByChannel?.SYNDICATE,
    DEAL_ROOM: value.focusedCounterpartByChannel?.DEAL_ROOM,
    LOBBY: value.focusedCounterpartByChannel?.LOBBY,
  };

  const channelHeatByChannelId: Record<ChatVisibleChannel, number> = {
    GLOBAL: clamp01(value.channelHeatByChannelId?.GLOBAL ?? 0),
    SYNDICATE: clamp01(value.channelHeatByChannelId?.SYNDICATE ?? 0),
    DEAL_ROOM: clamp01(value.channelHeatByChannelId?.DEAL_ROOM ?? 0),
    LOBBY: clamp01(value.channelHeatByChannelId?.LOBBY ?? 0),
  };

  const counterpartProjectionsById: Record<string, ChatPhaseTwoCounterpartProjection> = {};
  if (value.counterpartProjectionsById && typeof value.counterpartProjectionsById === 'object') {
    for (const [id, proj] of Object.entries(value.counterpartProjectionsById)) {
      if (proj && typeof proj === 'object') {
        counterpartProjectionsById[id] = hydrateCounterpartProjection(proj as Partial<ChatPhaseTwoCounterpartProjection>, now);
      }
    }
  }

  const callbackCandidatesByCounterpartId: Record<string, readonly ChatRelationshipCallbackHint[]> = {};
  if (value.callbackCandidatesByCounterpartId && typeof value.callbackCandidatesByCounterpartId === 'object') {
    for (const [id, hints] of Object.entries(value.callbackCandidatesByCounterpartId)) {
      if (Array.isArray(hints)) {
        callbackCandidatesByCounterpartId[id] = hints.filter(isValidCallbackHint);
      }
    }
  }

  return {
    relationshipSnapshot: value.relationshipSnapshot,
    counterpartProjectionsById,
    focusedCounterpartByChannel,
    relationshipHeatByCounterpartId: hydrateNumericRecord(value.relationshipHeatByCounterpartId),
    channelHeatByChannelId,
    escalationRiskByCounterpartId: hydrateNumericRecord(value.escalationRiskByCounterpartId),
    rescueReadinessByCounterpartId: hydrateNumericRecord(value.rescueReadinessByCounterpartId),
    callbackCandidatesByCounterpartId,
    dominantCounterpartId: value.dominantCounterpartId,
    totalRelationshipEvents: value.totalRelationshipEvents ?? 0,
    unresolvedCallbackIds: Array.isArray(value.unresolvedCallbackIds) ? [...value.unresolvedCallbackIds] : [],
    diagnosticsSnapshot: value.diagnosticsSnapshot,
    lastPhaseTwoSyncAt: value.lastPhaseTwoSyncAt,
  };
}

// ============================================================================
// MARK: Validation helpers
// ============================================================================

export interface ChatPhaseTwoValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Validates the structural integrity of a Phase 2 state slice.
 * Emits errors for corrupt or impossible values, warnings for degraded state.
 */
export function validatePhaseTwoStateSlice(
  slice: ChatPhaseTwoStateSlice,
): ChatPhaseTwoValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Heat bounds
  for (const [id, heat] of Object.entries(slice.relationshipHeatByCounterpartId)) {
    if (heat < 0 || heat > 1 || !Number.isFinite(heat)) {
      errors.push(`relationshipHeat[${id}] out of bounds: ${heat}`);
    }
  }

  for (const ch of ALL_VISIBLE_CHANNELS) {
    const heat = slice.channelHeatByChannelId[ch] ?? 0;
    if (heat < 0 || heat > 1 || !Number.isFinite(heat)) {
      errors.push(`channelHeat[${ch}] out of bounds: ${heat}`);
    }
  }

  // Escalation / rescue bounds
  for (const [id, risk] of Object.entries(slice.escalationRiskByCounterpartId)) {
    if (risk < 0 || risk > 1 || !Number.isFinite(risk)) {
      errors.push(`escalationRisk[${id}] out of bounds: ${risk}`);
    }
  }

  // Focus references valid counterparts
  for (const ch of ALL_VISIBLE_CHANNELS) {
    const focusId = slice.focusedCounterpartByChannel[ch];
    if (focusId && !(focusId in slice.counterpartProjectionsById)) {
      warnings.push(`focusedCounterpart[${ch}]=${focusId} not in counterpartProjectionsById`);
    }
  }

  // Dominant counterpart is tracked
  if (
    slice.dominantCounterpartId &&
    !(slice.dominantCounterpartId in slice.counterpartProjectionsById)
  ) {
    warnings.push(`dominantCounterpartId=${slice.dominantCounterpartId} not in counterpartProjectionsById`);
  }

  // Callback candidates reference tracked counterparts
  for (const id of Object.keys(slice.callbackCandidatesByCounterpartId)) {
    if (!(id in slice.counterpartProjectionsById)) {
      warnings.push(`callbackCandidate counterpartId=${id} not in counterpartProjectionsById`);
    }
  }

  // Projection integrity
  for (const [id, proj] of Object.entries(slice.counterpartProjectionsById)) {
    if (proj.counterpartId !== id) {
      errors.push(`projection.counterpartId mismatch: key=${id}, value=${proj.counterpartId}`);
    }
    if (proj.summary.intensity01 < 0 || proj.summary.intensity01 > 1) {
      errors.push(`projection[${id}].summary.intensity01 out of bounds`);
    }
    if (proj.escalationRisk01 < 0 || proj.escalationRisk01 > 1) {
      errors.push(`projection[${id}].escalationRisk01 out of bounds`);
    }
  }

  if (slice.totalRelationshipEvents < 0) {
    errors.push(`totalRelationshipEvents is negative: ${slice.totalRelationshipEvents}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
// MARK: Private utility functions
// ============================================================================

function deriveMomentumBand(intensity01: number): ChatPhaseTwoMomentumBand {
  if (intensity01 >= FEVER_BAND_THRESHOLD) return 'FEVER';
  if (intensity01 >= HOT_BAND_THRESHOLD) return 'HOT';
  if (intensity01 >= WARM_BAND_THRESHOLD) return 'WARM';
  return 'QUIET';
}

function computeDominantCounterpartId(
  projectionsById: Readonly<Record<string, ChatPhaseTwoCounterpartProjection>>,
): string | undefined {
  let dominantId: string | undefined;
  let dominantWeight = -1;
  for (const [id, proj] of Object.entries(projectionsById)) {
    if (proj.selectionWeight01 > dominantWeight) {
      dominantWeight = proj.selectionWeight01;
      dominantId = id;
    }
  }
  return dominantId;
}

function recomputeChannelHeat(
  projectionsById: Readonly<Record<string, ChatPhaseTwoCounterpartProjection>>,
  focusedByChannel: Readonly<Record<ChatVisibleChannel, string | undefined>>,
): Readonly<Record<ChatVisibleChannel, number>> {
  const result: Record<ChatVisibleChannel, number> = {
    GLOBAL: 0,
    SYNDICATE: 0,
    DEAL_ROOM: 0,
    LOBBY: 0,
  };
  for (const ch of ALL_VISIBLE_CHANNELS) {
    const focusedId = focusedByChannel[ch];
    if (focusedId && projectionsById[focusedId]) {
      result[ch] = clamp01(
        projectionsById[focusedId].witnessHeat01 * 0.55 +
        projectionsById[focusedId].summary.intensity01 * 0.45,
      );
    } else {
      let sum = 0;
      let count = 0;
      for (const proj of Object.values(projectionsById)) {
        if (proj.lastChannelId === ch) { sum += proj.summary.intensity01; count++; }
      }
      result[ch] = count > 0 ? clamp01(sum / count) : 0;
    }
  }
  return result;
}

function hydrateCounterpartProjection(
  raw: Partial<ChatPhaseTwoCounterpartProjection>,
  now: UnixMs,
): ChatPhaseTwoCounterpartProjection {
  const intensity01 = clamp01(raw.summary?.intensity01 ?? 0);
  return {
    counterpartId: String(raw.counterpartId ?? ''),
    summary: raw.summary ?? ({} as ChatRelationshipSummaryView),
    legacy: raw.legacy ?? ({} as ChatRelationshipLegacyProjection),
    counterpartKind: raw.counterpartKind ?? 'NPC',
    momentumBand: raw.momentumBand ?? deriveMomentumBand(intensity01),
    escalationRisk01: clamp01(raw.escalationRisk01 ?? 0),
    rescueReadiness01: clamp01(raw.rescueReadiness01 ?? 0),
    disciplineSignal01: clamp01(raw.disciplineSignal01 ?? 0),
    greedSignal01: clamp01(raw.greedSignal01 ?? 0),
    witnessHeat01: clamp01(raw.witnessHeat01 ?? 0),
    selectionWeight01: clamp01(raw.selectionWeight01 ?? 0),
    dominantAxes: Array.isArray(raw.dominantAxes) ? [...raw.dominantAxes] : [],
    callbackHintCount: Math.max(0, raw.callbackHintCount ?? 0),
    topCallbackHint: raw.topCallbackHint,
    lastChannelId: raw.lastChannelId,
    lastEventSummary: raw.lastEventSummary,
    lastTouchedAt: (raw.lastTouchedAt ?? now) as UnixMs,
  };
}

function hydrateNumericRecord(
  raw: unknown,
): Readonly<Record<string, number>> {
  if (!raw || typeof raw !== 'object') return {};
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      result[k] = clamp01(v);
    }
  }
  return result;
}

function isValidCallbackHint(hint: unknown): hint is ChatRelationshipCallbackHint {
  if (!hint || typeof hint !== 'object') return false;
  const h = hint as Record<string, unknown>;
  return (
    typeof h.callbackId === 'string' &&
    typeof h.label === 'string' &&
    typeof h.text === 'string' &&
    typeof h.weight01 === 'number'
  );
}

function isVisibleChannel(channelId: string): channelId is ChatVisibleChannel {
  return channelId === 'GLOBAL' || channelId === 'SYNDICATE' || channelId === 'DEAL_ROOM' || channelId === 'LOBBY';
}

// Re-export weightedBlend so the bridge can use it without a separate import.
export { clamp01 as phaseTwoClamp01, weightedBlend as phaseTwoWeightedBlend };

// Export momentum band deriver so the bridge can use it when building projections.
export { deriveMomentumBand as derivePhaseTwoMomentumBand };
