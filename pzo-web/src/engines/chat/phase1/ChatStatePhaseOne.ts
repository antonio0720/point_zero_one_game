/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT STATE PHASE 1 EXTENSION
 * FILE: pzo-web/src/engines/chat/phase1/ChatStatePhaseOne.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Additive state slice helpers for Phase 1 novelty + episodic memory.
 * This file does not overwrite the existing ChatState model. It augments it.
 *
 * This file is the single authority for:
 *   - ChatConversationalFingerprint — per-player behavioral fingerprint with
 *     13 normalized float dimensions derived from message-level signals
 *   - ChatPhaseOneStateSlice — additive extension merged non-destructively into
 *     ChatEngineState; never replaces the base reducer
 *   - ChatEngineStateWithPhaseOne — typed intersection for consumers
 *   - Rich state mutation helpers that preserve immutability
 *   - Deep analytics: fingerprint classification, channel fatigue reports,
 *     callback pressure scoring, state diffs, diagnostics
 *   - Versioned serialization/hydration with validation
 *   - Namespace export aggregating every public symbol
 *
 * Architecture rules
 * ------------------
 * - Every mutation returns a new state; nothing is mutated in place.
 * - All numeric fields are clamped to [0, 1] with 6 decimal places.
 * - Serialization round-trips are loss-free for all documented fields.
 * - This file imports only from '../types' and the intelligence layer.
 *   It does not import from ChatEnginePhaseOneBridge to avoid cycles.
 * ============================================================================
 */

import type {
  ChatEngineState,
  ChatFeatureSnapshot,
  ChatMessage,
  ChatVisibleChannel,
  UnixMs,
} from '../types';

import {
  CHAT_VISIBLE_CHANNELS,
} from '../types';

import type {
  ChatNoveltyLedgerFatigue,
  ChatNoveltyLedgerSnapshot,
} from '../intelligence/ChatNoveltyLedger';

import type {
  ChatEpisodicMemorySnapshot,
} from '../intelligence/ChatEpisodicMemory';

// ============================================================================
// MARK: Constants
// ============================================================================

export const PHASE_ONE_STATE_VERSION = '2026.03' as const;
export const PHASE_ONE_FINGERPRINT_DIMENSION_COUNT = 13 as const;
export const PHASE_ONE_MAX_UNRESOLVED_CALLBACKS = 128 as const;
export const PHASE_ONE_FATIGUE_CRITICAL_THRESHOLD = 0.82 as const;
export const PHASE_ONE_FATIGUE_HIGH_THRESHOLD = 0.62 as const;
export const PHASE_ONE_FATIGUE_MEDIUM_THRESHOLD = 0.38 as const;
export const PHASE_ONE_CALLBACK_PRESSURE_HIGH_THRESHOLD = 0.70 as const;
export const PHASE_ONE_CALLBACK_PRESSURE_MEDIUM_THRESHOLD = 0.42 as const;

/**
 * Ordered list of all fingerprint dimension keys.
 * Used for vector encoding, interpolation, and diff computation.
 */
export const FINGERPRINT_DIMENSION_KEYS = [
  'impulsive01',
  'patient01',
  'greedy01',
  'defensive01',
  'bluffHeavy01',
  'literal01',
  'comebackProne01',
  'collapseProne01',
  'publicPerformer01',
  'silentOperator01',
  'procedureAware01',
  'noveltySeeking01',
  'stabilitySeeking01',
] as const satisfies readonly (keyof Omit<ChatConversationalFingerprint, 'updatedAt'>)[];

export type FingerprintDimensionKey = (typeof FINGERPRINT_DIMENSION_KEYS)[number];

// ============================================================================
// MARK: Core interfaces
// ============================================================================

/**
 * Per-player behavioral fingerprint tracked across messages.
 * All 13 float dimensions are in [0, 1].
 *
 * Semantics
 * ---------
 * impulsive01       — high: short/reactive messages; low: measured responses
 * patient01         — high: long/thoughtful messages; low: impatient/terse
 * greedy01          — high: DEAL_ROOM + offer interactions; low: defensive posture
 * defensive01       — high: shield activations + "hold" language
 * bluffHeavy01      — high: bluff/think language
 * literal01         — high: proof/show language, procedural framing
 * comebackProne01   — high: recovery after collapse events
 * collapseProne01   — high: repeated cascade starts
 * publicPerformer01 — high: GLOBAL/LOBBY activity
 * silentOperator01  — high: SYNDICATE-dominant channel preference
 * procedureAware01  — high: review/terms/sequence language
 * noveltySeeking01  — high: diverse channel / candidate selection behavior
 * stabilitySeeking01— high: extended silence windows, stable channel preference
 */
export interface ChatConversationalFingerprint {
  readonly impulsive01: number;
  readonly patient01: number;
  readonly greedy01: number;
  readonly defensive01: number;
  readonly bluffHeavy01: number;
  readonly literal01: number;
  readonly comebackProne01: number;
  readonly collapseProne01: number;
  readonly publicPerformer01: number;
  readonly silentOperator01: number;
  readonly procedureAware01: number;
  readonly noveltySeeking01: number;
  readonly stabilitySeeking01: number;
  readonly updatedAt: UnixMs;
}

/**
 * Additive state extension for Phase 1 novelty and episodic memory.
 * Merged non-destructively into ChatEngineState; never replaces the base.
 */
export interface ChatPhaseOneStateSlice {
  readonly noveltyLedger?: ChatNoveltyLedgerSnapshot;
  readonly episodicMemory?: ChatEpisodicMemorySnapshot;
  readonly semanticFatigueByChannel: Readonly<Record<ChatVisibleChannel, number>>;
  readonly conversationalFingerprint: ChatConversationalFingerprint;
  readonly unresolvedCallbackIds: readonly string[];
  readonly lastBridgeSyncAt?: UnixMs;
  readonly lastCarryoverSummary?: string;
  readonly lastNoveltyRecommendedCandidateId?: string;
}

/**
 * ChatEngineState extended with the optional Phase 1 slice.
 * Consumers that need Phase 1 state should type their inputs as this.
 */
export type ChatEngineStateWithPhaseOne = ChatEngineState & {
  readonly phaseOne?: ChatPhaseOneStateSlice;
};

// ============================================================================
// MARK: Extended analytic types
// ============================================================================

/**
 * Scalar representation of per-channel fatigue with rich diagnostic metadata.
 */
export interface ChatPhaseOneChannelFatigue {
  readonly channelId: ChatVisibleChannel;
  readonly fatigue01: number;
  readonly band: 'FRESH' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly dominantMotifs: readonly string[];
  readonly dominantForms: readonly string[];
  readonly dominantSemanticClusters: readonly string[];
  readonly recentExactLines: readonly string[];
  readonly lastUpdatedAt?: UnixMs;
}

/**
 * Aggregated fatigue report for all visible channels.
 */
export interface ChatPhaseOneFatigueReport {
  readonly createdAt: UnixMs;
  readonly channels: readonly ChatPhaseOneChannelFatigue[];
  readonly worstChannel: ChatVisibleChannel | null;
  readonly freshestChannel: ChatVisibleChannel | null;
  readonly overallFatigue01: number;
  readonly overallBand: 'FRESH' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly criticalChannelCount: number;
  readonly highChannelCount: number;
  readonly notes: readonly string[];
}

/**
 * Scoring of callback readiness and urgency for the current state.
 */
export interface ChatPhaseOneCallbackPressureScore {
  readonly createdAt: UnixMs;
  readonly unresolvedCount: number;
  readonly pressure01: number;
  readonly band: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  readonly topUnresolvedIds: readonly string[];
  readonly estimatedSalience01: number;
  readonly notes: readonly string[];
}

/**
 * Comparison between two fingerprints.
 * Each dimension shows absolute delta and direction.
 */
export interface ChatFingerprintDelta {
  readonly dimensionKey: FingerprintDimensionKey;
  readonly before: number;
  readonly after: number;
  readonly delta: number;
  readonly direction: 'UP' | 'DOWN' | 'STABLE';
}

export interface ChatFingerprintComparison {
  readonly createdAt: UnixMs;
  readonly before: ChatConversationalFingerprint;
  readonly after: ChatConversationalFingerprint;
  readonly deltas: readonly ChatFingerprintDelta[];
  readonly totalChange: number;
  readonly dominantShiftKey: FingerprintDimensionKey | null;
  readonly dominantShiftMagnitude: number;
  readonly notes: readonly string[];
}

/**
 * Named archetype classification derived from fingerprint.
 * High-level label suitable for use in bark authoring or persona hints.
 */
export type ChatPlayerArchetype =
  | 'AGGRESSOR'       // impulsive01 ↑ greedy01 ↑ bluffHeavy01 ↑
  | 'STRATEGIST'      // patient01 ↑ procedureAware01 ↑ literal01 ↑
  | 'SURVIVOR'        // defensive01 ↑ collapseProne01 ↑ comebackProne01 ↑
  | 'SHOWMAN'         // publicPerformer01 ↑ greedy01 ↑ noveltySeeking01 ↑
  | 'GHOST'           // silentOperator01 ↑ patient01 ↑ stabilitySeeking01 ↑
  | 'NEGOTIATOR'      // greedy01 ↑ literal01 ↑ procedureAware01 ↑
  | 'COMEBACK_ARTIST' // comebackProne01 ↑ impulsive01 ↑ publicPerformer01 ↑
  | 'UNKNOWN';

export interface ChatFingerprintClassification {
  readonly archetype: ChatPlayerArchetype;
  readonly confidence01: number;
  readonly dominantDimensions: readonly FingerprintDimensionKey[];
  readonly suppressedDimensions: readonly FingerprintDimensionKey[];
  readonly archetypeDescription: string;
  readonly notes: readonly string[];
}

/**
 * A diff between two phase-one state slices, capturing what changed
 * and at what level of significance.
 */
export interface ChatPhaseOneStateDiff {
  readonly createdAt: UnixMs;
  readonly fingerprintDiff: ChatFingerprintComparison | null;
  readonly fatigueChangedChannels: readonly ChatVisibleChannel[];
  readonly unresolvedCallbackDelta: number;
  readonly noveltyLedgerChanged: boolean;
  readonly episodicMemoryChanged: boolean;
  readonly bridgeSyncAdvanced: boolean;
  readonly carryoverSummaryChanged: boolean;
  readonly significanceScore01: number;
  readonly notes: readonly string[];
}

/**
 * Full diagnostic report for the current phase-one state.
 * Used for debug overlays, telemetry, and bark authoring hints.
 */
export interface ChatPhaseOneStateReport {
  readonly createdAt: UnixMs;
  readonly sliceAge?: number;
  readonly fingerprintClassification: ChatFingerprintClassification;
  readonly fatigueReport: ChatPhaseOneFatigueReport;
  readonly callbackPressure: ChatPhaseOneCallbackPressureScore;
  readonly hasNoveltyLedger: boolean;
  readonly hasEpisodicMemory: boolean;
  readonly unresolvedCallbackCount: number;
  readonly carryoverSummaryPresent: boolean;
  readonly overallHealthBand: 'HEALTHY' | 'WARN' | 'DEGRADED' | 'STALE';
  readonly notes: readonly string[];
}

/**
 * Versioned serialization envelope for localStorage / server persistence.
 */
export interface ChatPhaseOneSerializedEnvelope {
  readonly version: typeof PHASE_ONE_STATE_VERSION;
  readonly serializedAt: UnixMs;
  readonly playerId?: string | null;
  readonly slice: ChatPhaseOneStateSlice;
}

/**
 * Result of hydrating a serialized envelope, including validation notes.
 */
export interface ChatPhaseOneHydrationResult {
  readonly slice: ChatPhaseOneStateSlice;
  readonly valid: boolean;
  readonly warnings: readonly string[];
  readonly version: string | null;
}

/**
 * Feature-flag-style toggles derived from phase-one state.
 * Consumed by bark selectors, candidate ranking, and overlay logic.
 */
export interface ChatPhaseOneFeatureFlags {
  readonly callbacksReady: boolean;
  readonly noveltyPressureHigh: boolean;
  readonly noveltyPressureCritical: boolean;
  readonly highFatigueChannelPresent: boolean;
  readonly criticalFatigueChannelPresent: boolean;
  readonly playerIsAggressor: boolean;
  readonly playerIsStrategist: boolean;
  readonly playerIsGhost: boolean;
  readonly playerIsShowman: boolean;
  readonly playerIsNegotiator: boolean;
  readonly playerIsComebackArtist: boolean;
  readonly playerIsSurvivor: boolean;
  readonly fingerprint: ChatConversationalFingerprint;
}

/**
 * Per-channel pressure map combining fatigue, callback, and novelty signals.
 */
export interface ChatPhaseOneChannelPressureMap {
  readonly createdAt: UnixMs;
  readonly GLOBAL: number;
  readonly SYNDICATE: number;
  readonly DEAL_ROOM: number;
  readonly LOBBY: number;
  readonly peak: ChatVisibleChannel;
  readonly trough: ChatVisibleChannel;
}

// ============================================================================
// MARK: Utility — clamp and numeric helpers
// ============================================================================

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

function nudge(current: number, incoming: number, weight: number): number {
  return clamp01(current * (1 - weight) + incoming * weight);
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

function weightedMean(pairs: readonly [number, number][]): number {
  if (pairs.length === 0) return 0;
  let weightSum = 0;
  let valueSum = 0;
  for (const [value, weight] of pairs) {
    weightSum += weight;
    valueSum += value * weight;
  }
  return weightSum === 0 ? 0 : valueSum / weightSum;
}

function absDelta(a: number, b: number): number {
  return Math.abs(a - b);
}

// ============================================================================
// MARK: Default constructors
// ============================================================================

export function createDefaultConversationalFingerprint(
  now: UnixMs = Date.now() as UnixMs,
): ChatConversationalFingerprint {
  return {
    impulsive01: 0.20,
    patient01: 0.60,
    greedy01: 0.20,
    defensive01: 0.55,
    bluffHeavy01: 0.20,
    literal01: 0.60,
    comebackProne01: 0.45,
    collapseProne01: 0.10,
    publicPerformer01: 0.40,
    silentOperator01: 0.50,
    procedureAware01: 0.50,
    noveltySeeking01: 0.50,
    stabilitySeeking01: 0.50,
    updatedAt: now,
  };
}

export function createDefaultChatPhaseOneStateSlice(
  now: UnixMs = Date.now() as UnixMs,
): ChatPhaseOneStateSlice {
  return {
    noveltyLedger: undefined,
    episodicMemory: undefined,
    semanticFatigueByChannel: {
      GLOBAL: 0,
      SYNDICATE: 0,
      DEAL_ROOM: 0,
      LOBBY: 0,
    },
    conversationalFingerprint: createDefaultConversationalFingerprint(now),
    unresolvedCallbackIds: [],
    lastBridgeSyncAt: undefined,
    lastCarryoverSummary: undefined,
    lastNoveltyRecommendedCandidateId: undefined,
  };
}

// ============================================================================
// MARK: State access helpers
// ============================================================================

export function getPhaseOneState(state: ChatEngineStateWithPhaseOne): ChatPhaseOneStateSlice {
  return state.phaseOne ?? createDefaultChatPhaseOneStateSlice();
}

export function withPhaseOneState(
  state: ChatEngineState,
  phaseOne: ChatPhaseOneStateSlice,
): ChatEngineStateWithPhaseOne {
  return {
    ...(state as ChatEngineStateWithPhaseOne),
    phaseOne: {
      ...phaseOne,
      semanticFatigueByChannel: { ...phaseOne.semanticFatigueByChannel },
      conversationalFingerprint: { ...phaseOne.conversationalFingerprint },
      unresolvedCallbackIds: [...phaseOne.unresolvedCallbackIds],
    },
  };
}

export function hasPhaseOneState(
  state: ChatEngineState,
): state is ChatEngineStateWithPhaseOne & { readonly phaseOne: ChatPhaseOneStateSlice } {
  return (state as ChatEngineStateWithPhaseOne).phaseOne !== undefined;
}

// ============================================================================
// MARK: Core state mutation helpers
// ============================================================================

export function setPhaseOneNoveltyLedgerInState(
  state: ChatEngineStateWithPhaseOne,
  noveltyLedger: ChatNoveltyLedgerSnapshot | undefined,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatEngineStateWithPhaseOne {
  const phaseOne = getPhaseOneState(state);
  const next = {
    ...phaseOne,
    noveltyLedger,
    semanticFatigueByChannel: noveltyLedger
      ? mergeFatigueByChannel(phaseOne.semanticFatigueByChannel, noveltyLedger.fatigueByChannel)
      : phaseOne.semanticFatigueByChannel,
    lastBridgeSyncAt: syncedAt,
  };
  return withPhaseOneState(state, next);
}

export function setPhaseOneEpisodicMemoryInState(
  state: ChatEngineStateWithPhaseOne,
  episodicMemory: ChatEpisodicMemorySnapshot | undefined,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatEngineStateWithPhaseOne {
  const phaseOne = getPhaseOneState(state);
  const next = {
    ...phaseOne,
    episodicMemory,
    unresolvedCallbackIds: episodicMemory?.unresolvedMemoryIds ?? phaseOne.unresolvedCallbackIds,
    lastCarryoverSummary: episodicMemory?.lastCarryoverSummary ?? phaseOne.lastCarryoverSummary,
    lastBridgeSyncAt: syncedAt,
  };
  return withPhaseOneState(state, next);
}

export function setPhaseOneRecommendedCandidateIdInState(
  state: ChatEngineStateWithPhaseOne,
  candidateId?: string,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatEngineStateWithPhaseOne {
  const phaseOne = getPhaseOneState(state);
  return withPhaseOneState(state, {
    ...phaseOne,
    lastNoveltyRecommendedCandidateId: candidateId,
    lastBridgeSyncAt: syncedAt,
  });
}

export function setSemanticFatigueInState(
  state: ChatEngineStateWithPhaseOne,
  channelId: ChatVisibleChannel,
  fatigue01: number,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatEngineStateWithPhaseOne {
  const phaseOne = getPhaseOneState(state);
  return withPhaseOneState(state, {
    ...phaseOne,
    semanticFatigueByChannel: {
      ...phaseOne.semanticFatigueByChannel,
      [channelId]: clamp01(fatigue01),
    },
    lastBridgeSyncAt: syncedAt,
  });
}

export function applyConversationalFingerprintDeltaInState(
  state: ChatEngineStateWithPhaseOne,
  delta: Partial<Omit<ChatConversationalFingerprint, 'updatedAt'>>,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatEngineStateWithPhaseOne {
  const phaseOne = getPhaseOneState(state);
  const current = phaseOne.conversationalFingerprint;
  const nextFingerprint: ChatConversationalFingerprint = {
    impulsive01: clamp01(delta.impulsive01 ?? current.impulsive01),
    patient01: clamp01(delta.patient01 ?? current.patient01),
    greedy01: clamp01(delta.greedy01 ?? current.greedy01),
    defensive01: clamp01(delta.defensive01 ?? current.defensive01),
    bluffHeavy01: clamp01(delta.bluffHeavy01 ?? current.bluffHeavy01),
    literal01: clamp01(delta.literal01 ?? current.literal01),
    comebackProne01: clamp01(delta.comebackProne01 ?? current.comebackProne01),
    collapseProne01: clamp01(delta.collapseProne01 ?? current.collapseProne01),
    publicPerformer01: clamp01(delta.publicPerformer01 ?? current.publicPerformer01),
    silentOperator01: clamp01(delta.silentOperator01 ?? current.silentOperator01),
    procedureAware01: clamp01(delta.procedureAware01 ?? current.procedureAware01),
    noveltySeeking01: clamp01(delta.noveltySeeking01 ?? current.noveltySeeking01),
    stabilitySeeking01: clamp01(delta.stabilitySeeking01 ?? current.stabilitySeeking01),
    updatedAt: syncedAt,
  };

  return withPhaseOneState(state, {
    ...phaseOne,
    conversationalFingerprint: nextFingerprint,
    lastBridgeSyncAt: syncedAt,
  });
}

export function notePhaseOneCarryoverSummaryInState(
  state: ChatEngineStateWithPhaseOne,
  summary: string | undefined,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatEngineStateWithPhaseOne {
  const phaseOne = getPhaseOneState(state);
  return withPhaseOneState(state, {
    ...phaseOne,
    lastCarryoverSummary: summary,
    lastBridgeSyncAt: syncedAt,
  });
}

/**
 * Smoothly nudge fingerprint dimensions toward incoming values with a given
 * blend weight in [0, 1]. Weight 1.0 = hard override; 0.1 = gentle drift.
 */
export function blendConversationalFingerprintInState(
  state: ChatEngineStateWithPhaseOne,
  target: Partial<Omit<ChatConversationalFingerprint, 'updatedAt'>>,
  blendWeight: number,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatEngineStateWithPhaseOne {
  const phaseOne = getPhaseOneState(state);
  const current = phaseOne.conversationalFingerprint;
  const w = clamp01(blendWeight);
  const next: ChatConversationalFingerprint = {
    impulsive01: target.impulsive01 !== undefined ? nudge(current.impulsive01, target.impulsive01, w) : current.impulsive01,
    patient01: target.patient01 !== undefined ? nudge(current.patient01, target.patient01, w) : current.patient01,
    greedy01: target.greedy01 !== undefined ? nudge(current.greedy01, target.greedy01, w) : current.greedy01,
    defensive01: target.defensive01 !== undefined ? nudge(current.defensive01, target.defensive01, w) : current.defensive01,
    bluffHeavy01: target.bluffHeavy01 !== undefined ? nudge(current.bluffHeavy01, target.bluffHeavy01, w) : current.bluffHeavy01,
    literal01: target.literal01 !== undefined ? nudge(current.literal01, target.literal01, w) : current.literal01,
    comebackProne01: target.comebackProne01 !== undefined ? nudge(current.comebackProne01, target.comebackProne01, w) : current.comebackProne01,
    collapseProne01: target.collapseProne01 !== undefined ? nudge(current.collapseProne01, target.collapseProne01, w) : current.collapseProne01,
    publicPerformer01: target.publicPerformer01 !== undefined ? nudge(current.publicPerformer01, target.publicPerformer01, w) : current.publicPerformer01,
    silentOperator01: target.silentOperator01 !== undefined ? nudge(current.silentOperator01, target.silentOperator01, w) : current.silentOperator01,
    procedureAware01: target.procedureAware01 !== undefined ? nudge(current.procedureAware01, target.procedureAware01, w) : current.procedureAware01,
    noveltySeeking01: target.noveltySeeking01 !== undefined ? nudge(current.noveltySeeking01, target.noveltySeeking01, w) : current.noveltySeeking01,
    stabilitySeeking01: target.stabilitySeeking01 !== undefined ? nudge(current.stabilitySeeking01, target.stabilitySeeking01, w) : current.stabilitySeeking01,
    updatedAt: syncedAt,
  };
  return withPhaseOneState(state, {
    ...phaseOne,
    conversationalFingerprint: next,
    lastBridgeSyncAt: syncedAt,
  });
}

/**
 * Add one or more unresolved callback IDs, respecting the cap.
 */
export function addUnresolvedCallbackIdsInState(
  state: ChatEngineStateWithPhaseOne,
  ids: readonly string[],
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatEngineStateWithPhaseOne {
  const phaseOne = getPhaseOneState(state);
  const existingSet = new Set(phaseOne.unresolvedCallbackIds);
  for (const id of ids) existingSet.add(id);
  const merged = [...existingSet].slice(-PHASE_ONE_MAX_UNRESOLVED_CALLBACKS);
  return withPhaseOneState(state, {
    ...phaseOne,
    unresolvedCallbackIds: merged,
    lastBridgeSyncAt: syncedAt,
  });
}

/**
 * Remove resolved callback IDs from the unresolved list.
 */
export function removeUnresolvedCallbackIdsInState(
  state: ChatEngineStateWithPhaseOne,
  ids: readonly string[],
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatEngineStateWithPhaseOne {
  const phaseOne = getPhaseOneState(state);
  const removeSet = new Set(ids);
  const remaining = phaseOne.unresolvedCallbackIds.filter((id) => !removeSet.has(id));
  return withPhaseOneState(state, {
    ...phaseOne,
    unresolvedCallbackIds: remaining,
    lastBridgeSyncAt: syncedAt,
  });
}

/**
 * Reset per-channel fatigue for the specified channels (or all channels).
 */
export function resetFatigueInState(
  state: ChatEngineStateWithPhaseOne,
  channels?: readonly ChatVisibleChannel[],
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatEngineStateWithPhaseOne {
  const phaseOne = getPhaseOneState(state);
  const resetChannels = channels ?? (CHAT_VISIBLE_CHANNELS as readonly ChatVisibleChannel[]);
  const updated: Record<ChatVisibleChannel, number> = { ...phaseOne.semanticFatigueByChannel };
  for (const ch of resetChannels) {
    updated[ch] = 0;
  }
  return withPhaseOneState(state, {
    ...phaseOne,
    semanticFatigueByChannel: updated,
    lastBridgeSyncAt: syncedAt,
  });
}

/**
 * Apply a global fatigue decay across all channels by the given factor [0, 1].
 * decay = 0.90 means each fatigue value multiplied by 0.90 (10% decay).
 */
export function decayFatigueInState(
  state: ChatEngineStateWithPhaseOne,
  decayFactor: number,
  syncedAt: UnixMs = Date.now() as UnixMs,
): ChatEngineStateWithPhaseOne {
  const phaseOne = getPhaseOneState(state);
  const factor = clamp01(decayFactor);
  const updated: Record<ChatVisibleChannel, number> = {
    GLOBAL: clamp01(phaseOne.semanticFatigueByChannel.GLOBAL * factor),
    SYNDICATE: clamp01(phaseOne.semanticFatigueByChannel.SYNDICATE * factor),
    DEAL_ROOM: clamp01(phaseOne.semanticFatigueByChannel.DEAL_ROOM * factor),
    LOBBY: clamp01(phaseOne.semanticFatigueByChannel.LOBBY * factor),
  };
  return withPhaseOneState(state, {
    ...phaseOne,
    semanticFatigueByChannel: updated,
    lastBridgeSyncAt: syncedAt,
  });
}

// ============================================================================
// MARK: Feature overlay
// ============================================================================

/**
 * Projects phase-one state onto a ChatFeatureSnapshot, adding the four
 * additional fields consumed by ChatEnginePhaseOneBridge ranking.
 */
export function phaseOneFeatureOverlay(
  state: ChatEngineStateWithPhaseOne,
  base: ChatFeatureSnapshot,
): ChatFeatureSnapshot & {
  readonly semanticFatigue01: number;
  readonly unresolvedCallbacks: number;
  readonly noveltySeeking01: number;
  readonly stabilitySeeking01: number;
} {
  const phaseOne = getPhaseOneState(state);
  return {
    ...base,
    semanticFatigue01: phaseOne.semanticFatigueByChannel[base.activeChannel as ChatVisibleChannel] ?? 0,
    unresolvedCallbacks: phaseOne.unresolvedCallbackIds.length,
    noveltySeeking01: phaseOne.conversationalFingerprint.noveltySeeking01,
    stabilitySeeking01: phaseOne.conversationalFingerprint.stabilitySeeking01,
  };
}

// ============================================================================
// MARK: Fingerprint analytics
// ============================================================================

/**
 * Convert a fingerprint to a plain number array in dimension-key order.
 * Useful for distance computation, interpolation, or embedding.
 */
export function fingerprintToVector(fp: ChatConversationalFingerprint): readonly number[] {
  return FINGERPRINT_DIMENSION_KEYS.map((key) => fp[key]);
}

/**
 * Reconstruct a fingerprint from a plain number vector.
 * Vector must be ordered by FINGERPRINT_DIMENSION_KEYS.
 */
export function vectorToFingerprint(
  vector: readonly number[],
  updatedAt: UnixMs = Date.now() as UnixMs,
): ChatConversationalFingerprint {
  if (vector.length !== FINGERPRINT_DIMENSION_DIMENSION_COUNT) {
    return createDefaultConversationalFingerprint(updatedAt);
  }
  const [
    impulsive01,
    patient01,
    greedy01,
    defensive01,
    bluffHeavy01,
    literal01,
    comebackProne01,
    collapseProne01,
    publicPerformer01,
    silentOperator01,
    procedureAware01,
    noveltySeeking01,
    stabilitySeeking01,
  ] = vector;
  return {
    impulsive01: clamp01(impulsive01!),
    patient01: clamp01(patient01!),
    greedy01: clamp01(greedy01!),
    defensive01: clamp01(defensive01!),
    bluffHeavy01: clamp01(bluffHeavy01!),
    literal01: clamp01(literal01!),
    comebackProne01: clamp01(comebackProne01!),
    collapseProne01: clamp01(collapseProne01!),
    publicPerformer01: clamp01(publicPerformer01!),
    silentOperator01: clamp01(silentOperator01!),
    procedureAware01: clamp01(procedureAware01!),
    noveltySeeking01: clamp01(noveltySeeking01!),
    stabilitySeeking01: clamp01(stabilitySeeking01!),
    updatedAt,
  };
}

const FINGERPRINT_DIMENSION_DIMENSION_COUNT = FINGERPRINT_DIMENSION_KEYS.length;

/**
 * Interpolate two fingerprints with a blend weight [0, 1].
 * weight = 0: returns a; weight = 1: returns b.
 */
export function interpolateFingerprints(
  a: ChatConversationalFingerprint,
  b: ChatConversationalFingerprint,
  weight: number,
  updatedAt: UnixMs = Date.now() as UnixMs,
): ChatConversationalFingerprint {
  const w = clamp01(weight);
  const blend = (av: number, bv: number): number => clamp01(av * (1 - w) + bv * w);
  return {
    impulsive01: blend(a.impulsive01, b.impulsive01),
    patient01: blend(a.patient01, b.patient01),
    greedy01: blend(a.greedy01, b.greedy01),
    defensive01: blend(a.defensive01, b.defensive01),
    bluffHeavy01: blend(a.bluffHeavy01, b.bluffHeavy01),
    literal01: blend(a.literal01, b.literal01),
    comebackProne01: blend(a.comebackProne01, b.comebackProne01),
    collapseProne01: blend(a.collapseProne01, b.collapseProne01),
    publicPerformer01: blend(a.publicPerformer01, b.publicPerformer01),
    silentOperator01: blend(a.silentOperator01, b.silentOperator01),
    procedureAware01: blend(a.procedureAware01, b.procedureAware01),
    noveltySeeking01: blend(a.noveltySeeking01, b.noveltySeeking01),
    stabilitySeeking01: blend(a.stabilitySeeking01, b.stabilitySeeking01),
    updatedAt,
  };
}

/**
 * Scale all fingerprint dimensions by a uniform factor in [0, 2].
 * Values are clamped to [0, 1] after scaling.
 */
export function scaleFingerprint(
  fp: ChatConversationalFingerprint,
  factor: number,
  updatedAt: UnixMs = Date.now() as UnixMs,
): ChatConversationalFingerprint {
  const scale = (v: number): number => clamp01(v * factor);
  return {
    impulsive01: scale(fp.impulsive01),
    patient01: scale(fp.patient01),
    greedy01: scale(fp.greedy01),
    defensive01: scale(fp.defensive01),
    bluffHeavy01: scale(fp.bluffHeavy01),
    literal01: scale(fp.literal01),
    comebackProne01: scale(fp.comebackProne01),
    collapseProne01: scale(fp.collapseProne01),
    publicPerformer01: scale(fp.publicPerformer01),
    silentOperator01: scale(fp.silentOperator01),
    procedureAware01: scale(fp.procedureAware01),
    noveltySeeking01: scale(fp.noveltySeeking01),
    stabilitySeeking01: scale(fp.stabilitySeeking01),
    updatedAt,
  };
}

/**
 * Compute the Euclidean distance between two fingerprints in the 13D space.
 * Returns a value in [0, sqrt(13)] ≈ [0, 3.606].
 */
export function fingerprintDistance(
  a: ChatConversationalFingerprint,
  b: ChatConversationalFingerprint,
): number {
  let sumSq = 0;
  for (const key of FINGERPRINT_DIMENSION_KEYS) {
    const d = a[key] - b[key];
    sumSq += d * d;
  }
  return Math.sqrt(sumSq);
}

/**
 * Compute the Manhattan (L1) distance between two fingerprints.
 * Returns a value in [0, 13].
 */
export function fingerprintManhattanDistance(
  a: ChatConversationalFingerprint,
  b: ChatConversationalFingerprint,
): number {
  let sum = 0;
  for (const key of FINGERPRINT_DIMENSION_KEYS) {
    sum += Math.abs(a[key] - b[key]);
  }
  return sum;
}

/**
 * Compute a single scalar score for a fingerprint.
 * Higher values indicate higher overall engagement intensity.
 * Weights are calibrated for the Point Zero One balance surface.
 */
export function buildFingerprintScore(fp: ChatConversationalFingerprint): number {
  return clamp01(weightedMean([
    [fp.impulsive01, 0.08],
    [fp.greedy01, 0.10],
    [fp.bluffHeavy01, 0.08],
    [fp.comebackProne01, 0.12],
    [fp.publicPerformer01, 0.10],
    [fp.procedureAware01, 0.08],
    [fp.noveltySeeking01, 0.12],
    [fp.literal01, 0.06],
    [fp.defensive01, 0.08],
    [1 - fp.collapseProne01, 0.10],
    [fp.patient01, 0.04],
    [fp.silentOperator01, 0.02],
    [fp.stabilitySeeking01, 0.02],
  ]));
}

/**
 * Compare two fingerprints and build a diff with per-dimension deltas.
 */
export function compareConversationalFingerprints(
  before: ChatConversationalFingerprint,
  after: ChatConversationalFingerprint,
  now: UnixMs = Date.now() as UnixMs,
): ChatFingerprintComparison {
  const deltas: ChatFingerprintDelta[] = [];
  let totalChange = 0;
  let dominantKey: FingerprintDimensionKey | null = null;
  let dominantMag = 0;

  for (const key of FINGERPRINT_DIMENSION_KEYS) {
    const bv = before[key];
    const av = after[key];
    const delta = av - bv;
    const mag = Math.abs(delta);
    totalChange += mag;
    if (mag > dominantMag) {
      dominantMag = mag;
      dominantKey = key;
    }
    deltas.push({
      dimensionKey: key,
      before: bv,
      after: av,
      delta: Number(delta.toFixed(6)),
      direction: mag < 0.005 ? 'STABLE' : delta > 0 ? 'UP' : 'DOWN',
    });
  }

  const notes: string[] = [];
  if (dominantKey) notes.push(`Dominant shift: ${dominantKey} (Δ${Number(dominantMag.toFixed(4))})`);
  if (totalChange > 1.0) notes.push('Large overall fingerprint shift detected.');

  return {
    createdAt: now,
    before,
    after,
    deltas,
    totalChange: Number(totalChange.toFixed(6)),
    dominantShiftKey: dominantKey,
    dominantShiftMagnitude: Number(dominantMag.toFixed(6)),
    notes,
  };
}

/**
 * Classify the dominant player archetype from a fingerprint.
 */
export function classifyConversationalFingerprint(
  fp: ChatConversationalFingerprint,
): ChatFingerprintClassification {
  type Score = [ChatPlayerArchetype, number];
  const scores: Score[] = [
    ['AGGRESSOR', weightedMean([
      [fp.impulsive01, 0.35],
      [fp.greedy01, 0.30],
      [fp.bluffHeavy01, 0.25],
      [fp.publicPerformer01, 0.10],
    ])],
    ['STRATEGIST', weightedMean([
      [fp.patient01, 0.35],
      [fp.procedureAware01, 0.35],
      [fp.literal01, 0.30],
    ])],
    ['SURVIVOR', weightedMean([
      [fp.defensive01, 0.35],
      [fp.collapseProne01, 0.30],
      [fp.comebackProne01, 0.35],
    ])],
    ['SHOWMAN', weightedMean([
      [fp.publicPerformer01, 0.40],
      [fp.greedy01, 0.25],
      [fp.noveltySeeking01, 0.35],
    ])],
    ['GHOST', weightedMean([
      [fp.silentOperator01, 0.40],
      [fp.patient01, 0.30],
      [fp.stabilitySeeking01, 0.30],
    ])],
    ['NEGOTIATOR', weightedMean([
      [fp.greedy01, 0.35],
      [fp.literal01, 0.30],
      [fp.procedureAware01, 0.35],
    ])],
    ['COMEBACK_ARTIST', weightedMean([
      [fp.comebackProne01, 0.45],
      [fp.impulsive01, 0.30],
      [fp.publicPerformer01, 0.25],
    ])],
  ];

  scores.sort((a, b) => b[1] - a[1]);
  const [best, second] = scores;
  if (!best) {
    return {
      archetype: 'UNKNOWN',
      confidence01: 0,
      dominantDimensions: [],
      suppressedDimensions: [],
      archetypeDescription: 'No classification available.',
      notes: [],
    };
  }

  const confidence = second
    ? clamp01((best[1] - second[1]) * 3 + 0.40)
    : clamp01(best[1]);

  const threshold = 0.58;
  const dominant = FINGERPRINT_DIMENSION_KEYS.filter((k) => fp[k] >= threshold);
  const suppressed = FINGERPRINT_DIMENSION_KEYS.filter((k) => fp[k] <= 1 - threshold);

  const archetypeDescriptions: Record<ChatPlayerArchetype, string> = {
    AGGRESSOR: 'Plays fast and loose — short messages, deal activity, bluff pressure.',
    STRATEGIST: 'Methodical, reads the procedure, speaks with evidence.',
    SURVIVOR: 'Takes damage and keeps coming back; collapse-prone but resilient.',
    SHOWMAN: 'Lives in the public channels; performs for the crowd.',
    GHOST: 'Silent operator; slow, deliberate, syndicate-focused.',
    NEGOTIATOR: 'Deal-room native; literal, procedural, and greedy.',
    COMEBACK_ARTIST: 'Makes a scene of recovery; impulsive comebacks in public.',
    UNKNOWN: 'No clear behavioral signature yet.',
  };

  return {
    archetype: best[0],
    confidence01: confidence,
    dominantDimensions: dominant,
    suppressedDimensions: suppressed,
    archetypeDescription: archetypeDescriptions[best[0]],
    notes: [
      `Top score: ${best[0]} (${Number(best[1].toFixed(3))})`,
      second ? `Runner-up: ${second[0]} (${Number(second[1].toFixed(3))})` : '',
    ].filter(Boolean),
  };
}

/**
 * Build a human-readable multi-line description of a fingerprint.
 */
export function describeConversationalFingerprint(
  fp: ChatConversationalFingerprint,
): string {
  const lines: string[] = [
    `Fingerprint (updated ${new Date(fp.updatedAt).toISOString()}):`,
  ];
  for (const key of FINGERPRINT_DIMENSION_KEYS) {
    const v = fp[key];
    const bar = buildProgressBar(v, 8);
    lines.push(`  ${key.padEnd(22)} [${bar}] ${(v * 100).toFixed(1)}%`);
  }
  return lines.join('\n');
}

function buildProgressBar(value: number, width: number): string {
  const filled = Math.round(clamp01(value) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

// ============================================================================
// MARK: Fatigue analytics
// ============================================================================

/**
 * Resolve the fatigue band for a scalar [0, 1] value.
 */
export function resolveFatigueBand(
  fatigue01: number,
): 'FRESH' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (fatigue01 >= PHASE_ONE_FATIGUE_CRITICAL_THRESHOLD) return 'CRITICAL';
  if (fatigue01 >= PHASE_ONE_FATIGUE_HIGH_THRESHOLD) return 'HIGH';
  if (fatigue01 >= PHASE_ONE_FATIGUE_MEDIUM_THRESHOLD) return 'MEDIUM';
  if (fatigue01 > 0.05) return 'LOW';
  return 'FRESH';
}

/**
 * Build a full fatigue report for a phase-one state slice.
 */
export function buildFatigueReport(
  phaseOne: ChatPhaseOneStateSlice,
  now: UnixMs = Date.now() as UnixMs,
): ChatPhaseOneFatigueReport {
  const ledger = phaseOne.noveltyLedger;
  const fatigueByLedger = new Map<string, ChatNoveltyLedgerFatigue>();
  if (ledger) {
    for (const entry of ledger.fatigueByChannel) {
      fatigueByLedger.set(entry.channelId, entry);
    }
  }

  const channels: ChatPhaseOneChannelFatigue[] = CHAT_VISIBLE_CHANNELS.map((channelId) => {
    const fatigue01 = phaseOne.semanticFatigueByChannel[channelId] ?? 0;
    const ledgerEntry = fatigueByLedger.get(channelId);
    return {
      channelId,
      fatigue01,
      band: resolveFatigueBand(fatigue01),
      dominantMotifs: ledgerEntry?.dominantMotifs ?? [],
      dominantForms: ledgerEntry?.dominantForms ?? [],
      dominantSemanticClusters: ledgerEntry?.dominantSemanticClusters ?? [],
      recentExactLines: ledgerEntry?.recentExactLines ?? [],
      lastUpdatedAt: ledgerEntry?.lastUpdatedAt,
    };
  });

  channels.sort((a, b) => b.fatigue01 - a.fatigue01);
  const worst = channels[0]?.fatigue01 ?? 0 > 0.05 ? (channels[0]?.channelId ?? null) : null;
  const freshest = [...channels].sort((a, b) => a.fatigue01 - b.fatigue01)[0]?.channelId ?? null;

  const allFatigue = CHAT_VISIBLE_CHANNELS.map((ch) => phaseOne.semanticFatigueByChannel[ch] ?? 0);
  const overallFatigue01 = clamp01(mean(allFatigue));
  const criticalCount = channels.filter((c) => c.band === 'CRITICAL').length;
  const highCount = channels.filter((c) => c.band === 'HIGH').length;

  const notes: string[] = [];
  if (criticalCount > 0) notes.push(`${criticalCount} channel(s) at CRITICAL fatigue.`);
  if (highCount > 0) notes.push(`${highCount} channel(s) at HIGH fatigue.`);
  if (overallFatigue01 > PHASE_ONE_FATIGUE_HIGH_THRESHOLD) notes.push('Overall fatigue is high — consider channel rotation.');

  return {
    createdAt: now,
    channels,
    worstChannel: worst,
    freshestChannel: freshest,
    overallFatigue01,
    overallBand: resolveFatigueBand(overallFatigue01),
    criticalChannelCount: criticalCount,
    highChannelCount: highCount,
    notes,
  };
}

/**
 * Get the channel with the highest fatigue.
 */
export function getHighestFatigueChannel(
  phaseOne: ChatPhaseOneStateSlice,
): { channelId: ChatVisibleChannel; fatigue01: number } {
  let worst: ChatVisibleChannel = 'GLOBAL';
  let worstVal = phaseOne.semanticFatigueByChannel.GLOBAL;
  for (const ch of CHAT_VISIBLE_CHANNELS) {
    const v = phaseOne.semanticFatigueByChannel[ch] ?? 0;
    if (v > worstVal) {
      worstVal = v;
      worst = ch;
    }
  }
  return { channelId: worst, fatigue01: worstVal };
}

/**
 * Get the channel with the lowest fatigue (freshest).
 */
export function getLowestFatigueChannel(
  phaseOne: ChatPhaseOneStateSlice,
): { channelId: ChatVisibleChannel; fatigue01: number } {
  let best: ChatVisibleChannel = 'GLOBAL';
  let bestVal = phaseOne.semanticFatigueByChannel.GLOBAL;
  for (const ch of CHAT_VISIBLE_CHANNELS) {
    const v = phaseOne.semanticFatigueByChannel[ch] ?? 0;
    if (v < bestVal) {
      bestVal = v;
      best = ch;
    }
  }
  return { channelId: best, fatigue01: bestVal };
}

/**
 * Build a per-channel pressure map combining fatigue, callback count, and
 * novelty signal from the ledger.
 */
export function buildChannelPressureMap(
  phaseOne: ChatPhaseOneStateSlice,
  now: UnixMs = Date.now() as UnixMs,
): ChatPhaseOneChannelPressureMap {
  const callbackPressure = clamp01(phaseOne.unresolvedCallbackIds.length / PHASE_ONE_MAX_UNRESOLVED_CALLBACKS);
  const computePressure = (ch: ChatVisibleChannel): number => {
    const fatigue = phaseOne.semanticFatigueByChannel[ch] ?? 0;
    return clamp01(fatigue * 0.70 + callbackPressure * 0.30);
  };

  const GLOBAL = computePressure('GLOBAL');
  const SYNDICATE = computePressure('SYNDICATE');
  const DEAL_ROOM = computePressure('DEAL_ROOM');
  const LOBBY = computePressure('LOBBY');

  const entries: Array<[ChatVisibleChannel, number]> = [
    ['GLOBAL', GLOBAL],
    ['SYNDICATE', SYNDICATE],
    ['DEAL_ROOM', DEAL_ROOM],
    ['LOBBY', LOBBY],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  const peak = entries[0]![0];
  const trough = entries[entries.length - 1]![0];

  return { createdAt: now, GLOBAL, SYNDICATE, DEAL_ROOM, LOBBY, peak, trough };
}

// ============================================================================
// MARK: Callback pressure analytics
// ============================================================================

/**
 * Compute the callback readiness pressure from the current state slice.
 */
export function computeCallbackPressure(
  phaseOne: ChatPhaseOneStateSlice,
  now: UnixMs = Date.now() as UnixMs,
): ChatPhaseOneCallbackPressureScore {
  const count = phaseOne.unresolvedCallbackIds.length;
  const pressure01 = clamp01(count / Math.max(1, PHASE_ONE_MAX_UNRESOLVED_CALLBACKS * 0.5));

  let band: ChatPhaseOneCallbackPressureScore['band'] = 'NONE';
  if (pressure01 >= PHASE_ONE_CALLBACK_PRESSURE_HIGH_THRESHOLD) band = 'HIGH';
  else if (pressure01 >= PHASE_ONE_CALLBACK_PRESSURE_MEDIUM_THRESHOLD) band = 'MEDIUM';
  else if (pressure01 > 0.05) band = 'LOW';

  const topUnresolvedIds = [...phaseOne.unresolvedCallbackIds].slice(0, 5);

  // Estimate salience from episodic memory if available
  let estimatedSalience01 = 0;
  if (phaseOne.episodicMemory && count > 0) {
    const unresolvedSet = new Set(phaseOne.unresolvedCallbackIds);
    const activeSaliences = phaseOne.episodicMemory.activeMemories
      .filter((m) => unresolvedSet.has(m.memoryId))
      .map((m) => m.salience01);
    if (activeSaliences.length > 0) {
      estimatedSalience01 = clamp01(mean(activeSaliences));
    }
  }

  const notes: string[] = [];
  if (band === 'HIGH') notes.push(`${count} unresolved callbacks — high pressure.`);
  else if (band === 'MEDIUM') notes.push(`${count} unresolved callbacks — moderate pressure.`);
  if (estimatedSalience01 > 0.65) notes.push('High-salience callbacks pending.');

  return {
    createdAt: now,
    unresolvedCount: count,
    pressure01,
    band,
    topUnresolvedIds,
    estimatedSalience01,
    notes,
  };
}

/**
 * Estimate the overall novelty pressure as a scalar [0, 1].
 * Derived from weighted per-channel fatigue.
 */
export function computeNoveltyPressure(
  phaseOne: ChatPhaseOneStateSlice,
): number {
  // GLOBAL and SYNDICATE weighted highest since they carry most NPC traffic
  return clamp01(weightedMean([
    [phaseOne.semanticFatigueByChannel.GLOBAL, 0.40],
    [phaseOne.semanticFatigueByChannel.SYNDICATE, 0.30],
    [phaseOne.semanticFatigueByChannel.DEAL_ROOM, 0.20],
    [phaseOne.semanticFatigueByChannel.LOBBY, 0.10],
  ]));
}

// ============================================================================
// MARK: State diff
// ============================================================================

/**
 * Compute a diff between two phase-one state slices.
 */
export function diffPhaseOneStateSlices(
  before: ChatPhaseOneStateSlice,
  after: ChatPhaseOneStateSlice,
  now: UnixMs = Date.now() as UnixMs,
): ChatPhaseOneStateDiff {
  const notes: string[] = [];

  const fingerprintDiff = compareConversationalFingerprints(
    before.conversationalFingerprint,
    after.conversationalFingerprint,
    now,
  );

  const fatigueChangedChannels: ChatVisibleChannel[] = [];
  for (const ch of CHAT_VISIBLE_CHANNELS) {
    if (absDelta(before.semanticFatigueByChannel[ch], after.semanticFatigueByChannel[ch]) > 0.01) {
      fatigueChangedChannels.push(ch);
    }
  }

  const unresolvedDelta = after.unresolvedCallbackIds.length - before.unresolvedCallbackIds.length;
  const noveltyChanged = before.noveltyLedger?.updatedAt !== after.noveltyLedger?.updatedAt;
  const episodicChanged = before.episodicMemory?.updatedAt !== after.episodicMemory?.updatedAt;
  const bridgeSyncAdvanced = (after.lastBridgeSyncAt ?? 0) > (before.lastBridgeSyncAt ?? 0);
  const carryoverChanged = before.lastCarryoverSummary !== after.lastCarryoverSummary;

  // Significance: fingerprint shift + fatigue changes + callback delta
  const significanceScore01 = clamp01(
    fingerprintDiff.totalChange * 0.20 +
    fatigueChangedChannels.length * 0.10 +
    Math.min(1, Math.abs(unresolvedDelta) / 10) * 0.15 +
    (noveltyChanged ? 0.20 : 0) +
    (episodicChanged ? 0.15 : 0),
  );

  if (fingerprintDiff.totalChange > 0.5) notes.push('Large fingerprint shift.');
  if (fatigueChangedChannels.length > 0) notes.push(`Fatigue changed in: ${fatigueChangedChannels.join(', ')}.`);
  if (unresolvedDelta !== 0) notes.push(`Unresolved callbacks delta: ${unresolvedDelta > 0 ? '+' : ''}${unresolvedDelta}.`);

  return {
    createdAt: now,
    fingerprintDiff: fingerprintDiff.totalChange > 0.001 ? fingerprintDiff : null,
    fatigueChangedChannels,
    unresolvedCallbackDelta: unresolvedDelta,
    noveltyLedgerChanged: noveltyChanged,
    episodicMemoryChanged: episodicChanged,
    bridgeSyncAdvanced,
    carryoverSummaryChanged: carryoverChanged,
    significanceScore01,
    notes,
  };
}

// ============================================================================
// MARK: Diagnostic report
// ============================================================================

/**
 * Build a full diagnostic report for the current phase-one state.
 */
export function buildPhaseOneStateReport(
  state: ChatEngineStateWithPhaseOne,
  now: UnixMs = Date.now() as UnixMs,
): ChatPhaseOneStateReport {
  const phaseOne = getPhaseOneState(state);
  const fingerprintClassification = classifyConversationalFingerprint(phaseOne.conversationalFingerprint);
  const fatigueReport = buildFatigueReport(phaseOne, now);
  const callbackPressure = computeCallbackPressure(phaseOne, now);

  const sliceAge = phaseOne.lastBridgeSyncAt
    ? now - phaseOne.lastBridgeSyncAt
    : undefined;

  const notes: string[] = [];
  let health: ChatPhaseOneStateReport['overallHealthBand'] = 'HEALTHY';

  if (!phaseOne.noveltyLedger && !phaseOne.episodicMemory) {
    health = 'STALE';
    notes.push('No ledger or episodic memory present — state is unhydrated.');
  } else if (fatigueReport.overallBand === 'CRITICAL') {
    health = 'DEGRADED';
    notes.push('Critical overall fatigue detected.');
  } else if (fatigueReport.criticalChannelCount > 0 || callbackPressure.band === 'HIGH') {
    health = 'WARN';
    if (fatigueReport.criticalChannelCount > 0) notes.push('One or more channels at critical fatigue.');
    if (callbackPressure.band === 'HIGH') notes.push('Callback pressure is high.');
  }

  if (sliceAge !== undefined && sliceAge > 10 * 60 * 1000) {
    if (health === 'HEALTHY') health = 'WARN';
    notes.push(`Phase-one state is ${Math.round(sliceAge / 1000)}s old — may be stale.`);
  }

  return {
    createdAt: now,
    sliceAge,
    fingerprintClassification,
    fatigueReport,
    callbackPressure,
    hasNoveltyLedger: phaseOne.noveltyLedger !== undefined,
    hasEpisodicMemory: phaseOne.episodicMemory !== undefined,
    unresolvedCallbackCount: phaseOne.unresolvedCallbackIds.length,
    carryoverSummaryPresent: phaseOne.lastCarryoverSummary !== undefined,
    overallHealthBand: health,
    notes,
  };
}

// ============================================================================
// MARK: Feature flags
// ============================================================================

/**
 * Derive feature-flag-style boolean toggles from a phase-one state slice.
 * These are fast-path queries used in ranking and bark selection.
 */
export function buildPhaseOneFeatureFlags(
  phaseOne: ChatPhaseOneStateSlice,
): ChatPhaseOneFeatureFlags {
  const fp = phaseOne.conversationalFingerprint;
  const noveltyPressure = computeNoveltyPressure(phaseOne);
  const callbackPressure = phaseOne.unresolvedCallbackIds.length;
  const classification = classifyConversationalFingerprint(fp);

  return {
    callbacksReady: callbackPressure > 0,
    noveltyPressureHigh: noveltyPressure >= PHASE_ONE_FATIGUE_HIGH_THRESHOLD,
    noveltyPressureCritical: noveltyPressure >= PHASE_ONE_FATIGUE_CRITICAL_THRESHOLD,
    highFatigueChannelPresent: CHAT_VISIBLE_CHANNELS.some(
      (ch) => (phaseOne.semanticFatigueByChannel[ch] ?? 0) >= PHASE_ONE_FATIGUE_HIGH_THRESHOLD,
    ),
    criticalFatigueChannelPresent: CHAT_VISIBLE_CHANNELS.some(
      (ch) => (phaseOne.semanticFatigueByChannel[ch] ?? 0) >= PHASE_ONE_FATIGUE_CRITICAL_THRESHOLD,
    ),
    playerIsAggressor: classification.archetype === 'AGGRESSOR',
    playerIsStrategist: classification.archetype === 'STRATEGIST',
    playerIsGhost: classification.archetype === 'GHOST',
    playerIsShowman: classification.archetype === 'SHOWMAN',
    playerIsNegotiator: classification.archetype === 'NEGOTIATOR',
    playerIsComebackArtist: classification.archetype === 'COMEBACK_ARTIST',
    playerIsSurvivor: classification.archetype === 'SURVIVOR',
    fingerprint: fp,
  };
}

// ============================================================================
// MARK: Human-readable description
// ============================================================================

/**
 * Build a human-readable summary of the current phase-one state.
 * Suitable for debug overlays or console diagnostics.
 */
export function describePhaseOneState(
  state: ChatEngineStateWithPhaseOne,
  now: UnixMs = Date.now() as UnixMs,
): string {
  const report = buildPhaseOneStateReport(state, now);
  const lines: string[] = [
    `=== Phase One State (${report.overallHealthBand}) ===`,
    `Novelty ledger: ${report.hasNoveltyLedger ? 'present' : 'absent'}`,
    `Episodic memory: ${report.hasEpisodicMemory ? 'present' : 'absent'}`,
    `Unresolved callbacks: ${report.unresolvedCallbackCount}`,
    `Callback pressure: ${report.callbackPressure.band} (${(report.callbackPressure.pressure01 * 100).toFixed(1)}%)`,
    `Overall fatigue: ${report.fatigueReport.overallBand} (${(report.fatigueReport.overallFatigue01 * 100).toFixed(1)}%)`,
    `Player archetype: ${report.fingerprintClassification.archetype} (confidence ${(report.fingerprintClassification.confidence01 * 100).toFixed(0)}%)`,
  ];
  if (report.notes.length > 0) {
    lines.push('Notes:');
    for (const note of report.notes) lines.push(`  · ${note}`);
  }
  return lines.join('\n');
}

// ============================================================================
// MARK: Merge helpers
// ============================================================================

/**
 * Merge two phase-one state slices, taking the more recent value for each
 * field and blending fingerprints with equal weight.
 */
export function mergePhaseOneStateSlices(
  a: ChatPhaseOneStateSlice,
  b: ChatPhaseOneStateSlice,
  now: UnixMs = Date.now() as UnixMs,
): ChatPhaseOneStateSlice {
  const aAt = a.lastBridgeSyncAt ?? 0;
  const bAt = b.lastBridgeSyncAt ?? 0;
  const newer = aAt >= bAt ? a : b;

  const mergedFatigue: Record<ChatVisibleChannel, number> = {
    GLOBAL: Math.max(a.semanticFatigueByChannel.GLOBAL, b.semanticFatigueByChannel.GLOBAL),
    SYNDICATE: Math.max(a.semanticFatigueByChannel.SYNDICATE, b.semanticFatigueByChannel.SYNDICATE),
    DEAL_ROOM: Math.max(a.semanticFatigueByChannel.DEAL_ROOM, b.semanticFatigueByChannel.DEAL_ROOM),
    LOBBY: Math.max(a.semanticFatigueByChannel.LOBBY, b.semanticFatigueByChannel.LOBBY),
  };

  // Blend fingerprints with weight proportional to age (newer = more weight)
  const totalAge = aAt + bAt;
  const aWeight = totalAge > 0 ? aAt / totalAge : 0.5;
  const blendedFingerprint = interpolateFingerprints(b.conversationalFingerprint, a.conversationalFingerprint, aWeight, now);

  const mergedCallbackIds = [...new Set([...a.unresolvedCallbackIds, ...b.unresolvedCallbackIds])]
    .slice(-PHASE_ONE_MAX_UNRESOLVED_CALLBACKS);

  return {
    noveltyLedger: newer.noveltyLedger,
    episodicMemory: newer.episodicMemory,
    semanticFatigueByChannel: mergedFatigue,
    conversationalFingerprint: blendedFingerprint,
    unresolvedCallbackIds: mergedCallbackIds,
    lastBridgeSyncAt: Math.max(aAt, bAt) as UnixMs,
    lastCarryoverSummary: newer.lastCarryoverSummary,
    lastNoveltyRecommendedCandidateId: newer.lastNoveltyRecommendedCandidateId,
  };
}

/**
 * Prune stale data from a phase-one state slice.
 * - Trims unresolved callback IDs to the cap
 * - Optionally resets fatigue for channels exceeding a threshold
 */
export function prunePhaseOneStateSlice(
  phaseOne: ChatPhaseOneStateSlice,
  options: {
    readonly trimCallbackIds?: boolean;
    readonly resetCriticalFatigue?: boolean;
    readonly fatigueResetThreshold?: number;
  } = {},
  now: UnixMs = Date.now() as UnixMs,
): ChatPhaseOneStateSlice {
  let result = { ...phaseOne };

  if (options.trimCallbackIds !== false) {
    result = {
      ...result,
      unresolvedCallbackIds: [...result.unresolvedCallbackIds].slice(-PHASE_ONE_MAX_UNRESOLVED_CALLBACKS),
    };
  }

  if (options.resetCriticalFatigue) {
    const threshold = options.fatigueResetThreshold ?? PHASE_ONE_FATIGUE_CRITICAL_THRESHOLD;
    const updated: Record<ChatVisibleChannel, number> = { ...result.semanticFatigueByChannel };
    for (const ch of CHAT_VISIBLE_CHANNELS) {
      if ((updated[ch] ?? 0) >= threshold) updated[ch] = 0;
    }
    result = { ...result, semanticFatigueByChannel: updated };
  }

  result = { ...result, lastBridgeSyncAt: now };
  return result;
}

// ============================================================================
// MARK: Validation
// ============================================================================

/**
 * Validate a candidate phase-one state slice.
 * Returns any warnings found; empty array = valid.
 */
export function validatePhaseOneStateSlice(
  raw: unknown,
): readonly string[] {
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') {
    warnings.push('Not an object — cannot validate.');
    return warnings;
  }

  const value = raw as Partial<ChatPhaseOneStateSlice>;

  if (!value.conversationalFingerprint) {
    warnings.push('conversationalFingerprint is missing.');
  } else {
    for (const key of FINGERPRINT_DIMENSION_KEYS) {
      const v = value.conversationalFingerprint[key];
      if (typeof v !== 'number' || v < 0 || v > 1) {
        warnings.push(`conversationalFingerprint.${key} is out of range (${v}).`);
      }
    }
  }

  if (!value.semanticFatigueByChannel) {
    warnings.push('semanticFatigueByChannel is missing.');
  } else {
    for (const ch of CHAT_VISIBLE_CHANNELS) {
      const v = value.semanticFatigueByChannel[ch];
      if (typeof v !== 'number' || v < 0 || v > 1) {
        warnings.push(`semanticFatigueByChannel.${ch} is out of range (${v}).`);
      }
    }
  }

  if (!Array.isArray(value.unresolvedCallbackIds)) {
    warnings.push('unresolvedCallbackIds is not an array.');
  }

  return warnings;
}

// ============================================================================
// MARK: Serialization and hydration
// ============================================================================

export function serializePhaseOneStateSlice(
  state: ChatEngineStateWithPhaseOne,
): ChatPhaseOneStateSlice | undefined {
  const phaseOne = state.phaseOne;
  if (!phaseOne) return undefined;
  return {
    ...phaseOne,
    noveltyLedger: phaseOne.noveltyLedger
      ? {
          ...phaseOne.noveltyLedger,
          recentEvents: phaseOne.noveltyLedger.recentEvents.map((item) => ({ ...item })),
          lineCounters: [...phaseOne.noveltyLedger.lineCounters],
          motifCounters: [...phaseOne.noveltyLedger.motifCounters],
          rhetoricalCounters: [...phaseOne.noveltyLedger.rhetoricalCounters],
          semanticCounters: [...phaseOne.noveltyLedger.semanticCounters],
          sceneRoleCounters: [...phaseOne.noveltyLedger.sceneRoleCounters],
          counterpartCounters: [...phaseOne.noveltyLedger.counterpartCounters],
          callbackCounters: [...phaseOne.noveltyLedger.callbackCounters],
          channelCounters: [...phaseOne.noveltyLedger.channelCounters],
          fatigueByChannel: [...phaseOne.noveltyLedger.fatigueByChannel],
        }
      : undefined,
    episodicMemory: phaseOne.episodicMemory
      ? {
          ...phaseOne.episodicMemory,
          activeMemories: phaseOne.episodicMemory.activeMemories.map((item) => ({
            ...item,
            callbackVariants: [...item.callbackVariants],
          })),
          archivedMemories: phaseOne.episodicMemory.archivedMemories.map((item) => ({
            ...item,
            callbackVariants: [...item.callbackVariants],
          })),
          unresolvedMemoryIds: [...phaseOne.episodicMemory.unresolvedMemoryIds],
        }
      : undefined,
    semanticFatigueByChannel: { ...phaseOne.semanticFatigueByChannel },
    conversationalFingerprint: { ...phaseOne.conversationalFingerprint },
    unresolvedCallbackIds: [...phaseOne.unresolvedCallbackIds],
  };
}

/**
 * Versioned serialization: wraps the slice in a versioned envelope for
 * persistent storage (localStorage, IndexedDB, remote state).
 */
export function serializePhaseOneStateSliceVersioned(
  state: ChatEngineStateWithPhaseOne,
  playerId?: string | null,
  now: UnixMs = Date.now() as UnixMs,
): ChatPhaseOneSerializedEnvelope | undefined {
  const slice = serializePhaseOneStateSlice(state);
  if (!slice) return undefined;
  return {
    version: PHASE_ONE_STATE_VERSION,
    serializedAt: now,
    playerId: playerId ?? null,
    slice,
  };
}

export function hydratePhaseOneStateSlice(
  raw: unknown,
  now: UnixMs = Date.now() as UnixMs,
): ChatPhaseOneStateSlice {
  if (!raw || typeof raw !== 'object') return createDefaultChatPhaseOneStateSlice(now);
  const value = raw as Partial<ChatPhaseOneStateSlice>;
  return {
    noveltyLedger: value.noveltyLedger,
    episodicMemory: value.episodicMemory,
    semanticFatigueByChannel: {
      GLOBAL: clamp01(value.semanticFatigueByChannel?.GLOBAL ?? 0),
      SYNDICATE: clamp01(value.semanticFatigueByChannel?.SYNDICATE ?? 0),
      DEAL_ROOM: clamp01(value.semanticFatigueByChannel?.DEAL_ROOM ?? 0),
      LOBBY: clamp01(value.semanticFatigueByChannel?.LOBBY ?? 0),
    },
    conversationalFingerprint: {
      ...createDefaultConversationalFingerprint(now),
      ...(value.conversationalFingerprint ?? {}),
      updatedAt: value.conversationalFingerprint?.updatedAt ?? now,
    },
    unresolvedCallbackIds: [...(value.unresolvedCallbackIds ?? [])],
    lastBridgeSyncAt: value.lastBridgeSyncAt,
    lastCarryoverSummary: value.lastCarryoverSummary,
    lastNoveltyRecommendedCandidateId: value.lastNoveltyRecommendedCandidateId,
  };
}

/**
 * Versioned hydration: unwraps a versioned envelope with full validation.
 */
export function hydratePhaseOneStateSliceVersioned(
  raw: unknown,
  now: UnixMs = Date.now() as UnixMs,
): ChatPhaseOneHydrationResult {
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      slice: createDefaultChatPhaseOneStateSlice(now),
      valid: false,
      warnings: ['Not an object — cannot hydrate.'],
      version: null,
    };
  }

  const envelope = raw as Partial<ChatPhaseOneSerializedEnvelope>;

  if (!envelope.version) {
    warnings.push('No version field — treating as legacy raw slice.');
    const slice = hydratePhaseOneStateSlice(envelope.slice ?? raw, now);
    const validationWarnings = validatePhaseOneStateSlice(slice);
    return {
      slice,
      valid: validationWarnings.length === 0,
      warnings: [...warnings, ...validationWarnings],
      version: null,
    };
  }

  if (envelope.version !== PHASE_ONE_STATE_VERSION) {
    warnings.push(`Version mismatch: expected ${PHASE_ONE_STATE_VERSION}, got ${envelope.version}.`);
  }

  if (!envelope.slice) {
    return {
      slice: createDefaultChatPhaseOneStateSlice(now),
      valid: false,
      warnings: [...warnings, 'Missing slice in envelope.'],
      version: envelope.version ?? null,
    };
  }

  const slice = hydratePhaseOneStateSlice(envelope.slice, now);
  const validationWarnings = validatePhaseOneStateSlice(slice);

  return {
    slice,
    valid: validationWarnings.length === 0 && warnings.length === 0,
    warnings: [...warnings, ...validationWarnings],
    version: envelope.version ?? null,
  };
}

// ============================================================================
// MARK: Internal helpers
// ============================================================================

function mergeFatigueByChannel(
  base: Readonly<Record<ChatVisibleChannel, number>>,
  fatigueByChannel: readonly ChatNoveltyLedgerFatigue[],
): Readonly<Record<ChatVisibleChannel, number>> {
  const next: Record<ChatVisibleChannel, number> = {
    GLOBAL: base.GLOBAL ?? 0,
    SYNDICATE: base.SYNDICATE ?? 0,
    DEAL_ROOM: base.DEAL_ROOM ?? 0,
    LOBBY: base.LOBBY ?? 0,
  };

  for (const fatigue of fatigueByChannel) {
    if (
      fatigue.channelId === 'GLOBAL' ||
      fatigue.channelId === 'SYNDICATE' ||
      fatigue.channelId === 'DEAL_ROOM' ||
      fatigue.channelId === 'LOBBY'
    ) {
      next[fatigue.channelId] = clamp01(fatigue.fatigue01);
    }
  }

  return next;
}

// ============================================================================
// MARK: Message-level fingerprint derivation helper
// ============================================================================

/**
 * Derive a fingerprint delta from a committed ChatMessage.
 * This is the lightweight front-end version of the derivation logic.
 * The bridge calls this and applies it to state.
 */
export function deriveFingerprintDeltaFromMessage(
  message: ChatMessage,
  featureSnapshot?: ChatFeatureSnapshot,
): Partial<Omit<ChatConversationalFingerprint, 'updatedAt'>> {
  const body = String((message as { body?: unknown }).body ?? '').toLowerCase();
  const channel = (message as { channel?: unknown }).channel as ChatVisibleChannel | undefined;
  const tags = new Set(
    ((message as { tags?: unknown }).tags as readonly string[] | undefined ?? []).map((t) => String(t).toLowerCase()),
  );

  return {
    impulsive01: body.length < 28 ? 0.52 : undefined,
    patient01: body.length > 72 ? 0.64 : undefined,
    greedy01: tags.has('offer') || channel === 'DEAL_ROOM' ? 0.58 : undefined,
    defensive01: tags.has('shield') || body.includes('hold') ? 0.62 : undefined,
    bluffHeavy01: body.includes('bluff') || body.includes('think') ? 0.57 : undefined,
    literal01: body.includes('proof') || body.includes('show') ? 0.68 : undefined,
    publicPerformer01: channel === 'GLOBAL' || channel === 'LOBBY' ? 0.60 : undefined,
    silentOperator01: channel === 'SYNDICATE' ? 0.64 : undefined,
    procedureAware01: body.includes('review') || body.includes('terms') || body.includes('sequence') ? 0.72 : undefined,
    noveltySeeking01: featureSnapshot && featureSnapshot.visibleMessageCount > 6 ? 0.55 : 0.50,
    stabilitySeeking01: featureSnapshot && featureSnapshot.silenceWindowMs > 0 ? 0.58 : 0.45,
  };
}

// ============================================================================
// MARK: Summary text helpers
// ============================================================================

/**
 * Build a concise one-line summary of the current fatigue state.
 */
export function summarizeFatigue(phaseOne: ChatPhaseOneStateSlice): string {
  const parts = CHAT_VISIBLE_CHANNELS.map((ch) => {
    const v = phaseOne.semanticFatigueByChannel[ch] ?? 0;
    return `${ch}:${(v * 100).toFixed(0)}%`;
  });
  return parts.join(' | ');
}

/**
 * Build a concise one-line summary of the current fingerprint.
 */
export function summarizeFingerprint(fp: ChatConversationalFingerprint): string {
  const classification = classifyConversationalFingerprint(fp);
  const score = buildFingerprintScore(fp);
  return `${classification.archetype}@${(score * 100).toFixed(0)}% [conf:${(classification.confidence01 * 100).toFixed(0)}%]`;
}

/**
 * Build a terse diagnostic string suitable for telemetry payloads.
 */
export function buildPhasOneStateTelemetryLabel(
  phaseOne: ChatPhaseOneStateSlice,
): string {
  const archetype = classifyConversationalFingerprint(phaseOne.conversationalFingerprint).archetype;
  const fatigue = summarizeFatigue(phaseOne);
  const callbacks = phaseOne.unresolvedCallbackIds.length;
  return `arch:${archetype} fatigue:[${fatigue}] cb:${callbacks}`;
}

// ============================================================================
// MARK: Namespace export
// ============================================================================

/**
 * ChatPhaseOneStateNS — frozen namespace aggregating every public symbol
 * exported from this module. Consumers may either import individual symbols
 * or import the namespace and use its members.
 */
export const ChatPhaseOneStateNS = Object.freeze({
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
});
