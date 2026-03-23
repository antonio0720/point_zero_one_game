/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT STATE PHASE 1 EXTENSION
 * FILE: backend/src/game/engine/chat/phase1/ChatStatePhaseOne.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Additive backend state slice helpers for Phase 1 novelty + episodic memory.
 * This file does not overwrite the existing backend ChatState model. It augments it.
 *
 * This file is the single authority for:
 *   - ChatConversationalFingerprint — per-player behavioral fingerprint with
 *     13 normalized float dimensions derived from message-level signals
 *   - ChatPhaseOneStateSlice — additive extension merged non-destructively into
 *     ChatState; never replaces the authoritative reducer
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
 *   It never imports frontend chat modules or UI helpers.
 * ============================================================================
 */

import type {
  ChatState,
  ChatFeatureSnapshot,
  ChatMessage,
  ChatVisibleChannel,
  UnixMs,
} from '../types';

import {
  CHAT_MOUNT_POLICIES as CHAT_MOUNT_PRESETS,
  CHAT_VISIBLE_CHANNELS,
} from '../types';

import type {
  ChatNoveltyLedgerFatigue,
  ChatNoveltyLedgerSnapshot,
} from '../intelligence/ChatNoveltyLedger';

import type {
  ChatEpisodicMemorySnapshot,
} from '../intelligence/ChatEpisodicMemory';


type BackendMountTarget = keyof typeof CHAT_MOUNT_PRESETS;

type ChatEngineState = ChatState & {
  readonly phaseOne?: ChatPhaseOneStateSlice;
  readonly activeVisibleChannel?: ChatVisibleChannel;
  readonly activeMountTarget?: BackendMountTarget;
  readonly affect?: {
    readonly vector?: {
      readonly embarrassment?: number;
      readonly frustration?: number;
    };
  };
  readonly audienceHeat?: Partial<Record<ChatVisibleChannel, {
    readonly heat?: number;
    readonly hype?: number;
    readonly ridicule?: number;
    readonly scrutiny?: number;
    readonly volatility?: number;
  }>>;
  readonly audienceHeatByRoom?: Readonly<Record<string, {
    readonly heat?: number;
    readonly hype?: number;
    readonly ridicule?: number;
    readonly scrutiny?: number;
    readonly volatility?: number;
  }>>;
  readonly offerState?: {
    readonly stance?: string;
    readonly readPressureActive?: boolean;
    readonly inferredOpponentUrgency?: number;
    readonly inferredOpponentConfidence?: number;
  };
  readonly activeScene?: {
    readonly beats?: readonly unknown[];
    readonly expectedDurationMs?: number;
    readonly allowPlayerComposerDuringScene?: boolean;
    readonly primaryChannel?: ChatVisibleChannel | string;
  };
  readonly liveOps?: {
    readonly suppressedHelperChannels?: readonly (ChatVisibleChannel | string)[];
    readonly boostedCrowdChannels?: readonly (ChatVisibleChannel | string)[];
  };
  readonly continuity?: {
    readonly lastMountTarget?: BackendMountTarget | string;
    readonly carryoverSummary?: string;
  };
  readonly lastAuthoritativeSyncAt?: UnixMs;
  readonly runtime?: {
    readonly allowVisibleChannels?: readonly ChatVisibleChannel[];
  };
  readonly rooms?: Readonly<Record<string, {
    readonly channelId?: ChatVisibleChannel | string;
  }>>;
  readonly lastEventAtByRoom?: Readonly<Record<string, UnixMs>>;
};

type ChatFeatureSnapshotCompat = ChatFeatureSnapshot & {
  readonly createdAt?: UnixMs;
  readonly activeChannel?: ChatVisibleChannel | string;
  readonly panelOpen?: boolean;
  readonly silenceWindowMs?: number;
  readonly visibleMessageCount?: number;
  readonly haterHeat?: number;
  readonly dropOffSignals?: {
    readonly silenceAfterCollapseMs?: number;
    readonly repeatedComposerDeletes?: number;
    readonly panelCollapseCount?: number;
    readonly channelHopCount?: number;
    readonly failedInputCount?: number;
    readonly negativeEmotionScore?: number;
  };
};

function asPlainRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function isVisibleChannel(value: unknown): value is ChatVisibleChannel {
  return typeof value === 'string' && (CHAT_VISIBLE_CHANNELS as readonly string[]).includes(value);
}

function normalizeVisibleChannel(
  value: unknown,
  fallback: ChatVisibleChannel = 'GLOBAL',
): ChatVisibleChannel {
  return isVisibleChannel(value) ? value : fallback;
}

function asFeatureSnapshotCompat(
  value?: ChatFeatureSnapshot,
): ChatFeatureSnapshotCompat | undefined {
  return value as ChatFeatureSnapshotCompat | undefined;
}

function readFeatureCreatedAt(
  value?: ChatFeatureSnapshot,
  fallback: UnixMs = Date.now() as UnixMs,
): UnixMs {
  const compat = asFeatureSnapshotCompat(value);
  return typeof compat?.createdAt === 'number' ? compat.createdAt : fallback;
}

function readFeatureActiveChannel(
  value: ChatFeatureSnapshot | undefined,
  fallback: ChatVisibleChannel,
): ChatVisibleChannel {
  return normalizeVisibleChannel(asFeatureSnapshotCompat(value)?.activeChannel, fallback);
}

function readFeaturePanelOpen(value?: ChatFeatureSnapshot): boolean {
  return asFeatureSnapshotCompat(value)?.panelOpen === true;
}

function readFeatureSilenceWindowMs(value?: ChatFeatureSnapshot): number {
  const raw = asFeatureSnapshotCompat(value)?.silenceWindowMs;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

function readFeatureVisibleMessageCount(value?: ChatFeatureSnapshot): number {
  const raw = asFeatureSnapshotCompat(value)?.visibleMessageCount;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

function readFeatureHaterHeat(value?: ChatFeatureSnapshot): number {
  const raw = asFeatureSnapshotCompat(value)?.haterHeat;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

function readFeatureDropOffSignals(
  value?: ChatFeatureSnapshot,
): {
  readonly silenceAfterCollapseMs: number;
  readonly repeatedComposerDeletes: number;
  readonly panelCollapseCount: number;
  readonly channelHopCount: number;
  readonly failedInputCount: number;
  readonly negativeEmotionScore: number;
} | undefined {
  const raw = asFeatureSnapshotCompat(value)?.dropOffSignals;
  if (!raw) return undefined;
  return {
    silenceAfterCollapseMs: typeof raw.silenceAfterCollapseMs === 'number' ? raw.silenceAfterCollapseMs : 0,
    repeatedComposerDeletes: typeof raw.repeatedComposerDeletes === 'number' ? raw.repeatedComposerDeletes : 0,
    panelCollapseCount: typeof raw.panelCollapseCount === 'number' ? raw.panelCollapseCount : 0,
    channelHopCount: typeof raw.channelHopCount === 'number' ? raw.channelHopCount : 0,
    failedInputCount: typeof raw.failedInputCount === 'number' ? raw.failedInputCount : 0,
    negativeEmotionScore: typeof raw.negativeEmotionScore === 'number' ? raw.negativeEmotionScore : 0,
  };
}

function readMountDefaultVisibleChannel(
  preset: (typeof CHAT_MOUNT_PRESETS)[BackendMountTarget] | undefined,
  fallback: ChatVisibleChannel,
): ChatVisibleChannel {
  const raw = (preset as { readonly defaultVisibleChannel?: unknown } | undefined)?.defaultVisibleChannel;
  return normalizeVisibleChannel(raw, fallback);
}

function resolveActiveVisibleChannel(state: ChatEngineState): ChatVisibleChannel {
  if (isVisibleChannel(state.activeVisibleChannel)) {
    return state.activeVisibleChannel;
  }
  const allowed = state.runtime?.allowVisibleChannels;
  if (Array.isArray(allowed) && allowed.length > 0 && isVisibleChannel(allowed[0])) {
    return allowed[0];
  }
  return 'GLOBAL';
}

function resolveMountTarget(state: ChatEngineState): BackendMountTarget {
  const raw = state.activeMountTarget;
  if (typeof raw === 'string' && raw in CHAT_MOUNT_PRESETS) {
    return raw as BackendMountTarget;
  }
  const active = resolveActiveVisibleChannel(state);
  if (active === 'LOBBY') return 'LOBBY_SCREEN';
  if (active === 'DEAL_ROOM') return 'PREDATOR_GAME_SCREEN';
  if (active === 'SYNDICATE') return 'SYNDICATE_GAME_SCREEN';
  return 'GAME_BOARD';
}

function resolveLastAuthoritativeSyncAt(state: ChatEngineState): UnixMs | undefined {
  if (typeof state.lastAuthoritativeSyncAt === 'number') {
    return state.lastAuthoritativeSyncAt;
  }
  const values = Object.values(state.lastEventAtByRoom ?? {});
  if (values.length === 0) return undefined;
  return values.reduce<UnixMs | undefined>((latest, value) => {
    if (typeof value !== 'number') return latest;
    if (latest === undefined || value > latest) return value;
    return latest;
  }, undefined);
}

function readAffectVectorScalar(
  state: ChatEngineState,
  key: 'embarrassment' | 'frustration',
): number {
  const raw = state.affect?.vector?.[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

function readAudienceHeat(
  state: ChatEngineState,
  channelId: ChatVisibleChannel,
): {
  readonly heat?: number;
  readonly hype?: number;
  readonly ridicule?: number;
  readonly scrutiny?: number;
  readonly volatility?: number;
} {
  const direct = state.audienceHeat?.[channelId];
  if (direct) return direct;

  const rooms = state.rooms ?? {};
  const roomId = Object.keys(rooms).find((candidate) => normalizeVisibleChannel(rooms[candidate]?.channelId, 'GLOBAL') === channelId);
  return roomId ? state.audienceHeatByRoom?.[roomId] ?? {} : {};
}

function readOfferState(state: ChatEngineState): Required<NonNullable<ChatEngineState['offerState']>> | null {
  const offer = state.offerState;
  if (!offer) return null;
  return {
    stance: typeof offer.stance === 'string' ? offer.stance : 'NEUTRAL',
    readPressureActive: offer.readPressureActive === true,
    inferredOpponentUrgency: typeof offer.inferredOpponentUrgency === 'number' ? offer.inferredOpponentUrgency : 0,
    inferredOpponentConfidence: typeof offer.inferredOpponentConfidence === 'number' ? offer.inferredOpponentConfidence : 0,
  };
}

function readActiveScene(state: ChatEngineState): {
  readonly beats: readonly unknown[];
  readonly expectedDurationMs: number;
  readonly allowPlayerComposerDuringScene: boolean;
  readonly primaryChannel?: ChatVisibleChannel;
} | null {
  const scene = state.activeScene;
  if (!scene) return null;
  return {
    beats: Array.isArray(scene.beats) ? scene.beats : [],
    expectedDurationMs: typeof scene.expectedDurationMs === 'number' && Number.isFinite(scene.expectedDurationMs) ? scene.expectedDurationMs : 0,
    allowPlayerComposerDuringScene: scene.allowPlayerComposerDuringScene !== false,
    primaryChannel: isVisibleChannel(scene.primaryChannel) ? scene.primaryChannel : undefined,
  };
}

function readLiveOps(state: ChatEngineState): {
  readonly suppressedHelperChannels: readonly ChatVisibleChannel[];
  readonly boostedCrowdChannels: readonly ChatVisibleChannel[];
} {
  const liveOps = state.liveOps;
  const normalizeList = (value: readonly (ChatVisibleChannel | string)[] | undefined): readonly ChatVisibleChannel[] =>
    Array.isArray(value) ? value.filter(isVisibleChannel) : [];
  return {
    suppressedHelperChannels: normalizeList(liveOps?.suppressedHelperChannels),
    boostedCrowdChannels: normalizeList(liveOps?.boostedCrowdChannels),
  };
}

function readContinuity(state: ChatEngineState): {
  readonly lastMountTarget?: BackendMountTarget;
  readonly carryoverSummary?: string;
} {
  const continuity = state.continuity;
  return {
    lastMountTarget:
      continuity?.lastMountTarget && continuity.lastMountTarget in CHAT_MOUNT_PRESETS
        ? (continuity.lastMountTarget as BackendMountTarget)
        : undefined,
    carryoverSummary: typeof continuity?.carryoverSummary === 'string' ? continuity.carryoverSummary : undefined,
  };
}

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
  readonly channelPressureMap: ChatPhaseOneChannelPressureMap;
  readonly carryoverAgenda: ChatPhaseOneCarryoverAgenda;
  readonly syncDiagnostics: ChatPhaseOneSyncDiagnostics;
  readonly interactionRisk: ChatPhaseOneInteractionRisk;
  readonly channelRecommendation: ChatPhaseOneChannelRecommendation;
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

export interface ChatPhaseOneCarryoverAgendaItem {
  readonly memoryId: string;
  readonly eventType: string;
  readonly summary: string;
  readonly unresolved: boolean;
  readonly salience01: number;
  readonly strategicWeight01: number;
  readonly emotionalWeight01: number;
  readonly embarrassmentRisk01: number;
  readonly priorityTier: 'BACKGROUND' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';
  readonly channelAffinity: readonly string[];
  readonly createdAt: UnixMs;
  readonly expiresAt?: UnixMs;
  readonly score01: number;
  readonly notes: readonly string[];
}

export interface ChatPhaseOneCarryoverAgenda {
  readonly createdAt: UnixMs;
  readonly items: readonly ChatPhaseOneCarryoverAgendaItem[];
  readonly unresolvedCount: number;
  readonly urgentCount: number;
  readonly dominantEventType?: string;
  readonly summary?: string;
}

export interface ChatPhaseOneSyncDiagnostics {
  readonly createdAt: UnixMs;
  readonly phaseOneUpdatedAt?: UnixMs;
  readonly authoritativeUpdatedAt?: UnixMs;
  readonly bridgeLagMs?: number;
  readonly authoritativeLagMs?: number;
  readonly driftMs?: number;
  readonly band: 'FRESH' | 'AGING' | 'STALE' | 'DESYNC';
  readonly notes: readonly string[];
}

export interface ChatPhaseOneInteractionRisk {
  readonly createdAt: UnixMs;
  readonly risk01: number;
  readonly band: 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  readonly fatigue01: number;
  readonly callbackPressure01: number;
  readonly crowdHostility01: number;
  readonly embarrassment01: number;
  readonly frustration01: number;
  readonly dropOffRisk01: number;
  readonly negotiationPressure01: number;
  readonly sceneLock01: number;
  readonly notes: readonly string[];
}

export interface ChatPhaseOneChannelRecommendationEntry {
  readonly channelId: ChatVisibleChannel;
  readonly score01: number;
  readonly allowedByMount: boolean;
  readonly pinnedByScene: boolean;
  readonly suppressedByLiveOps: boolean;
  readonly fatigue01: number;
  readonly crowdPressure01: number;
  readonly negotiationFit01: number;
  readonly rescueFit01: number;
  readonly performerFit01: number;
  readonly reasons: readonly string[];
}

export interface ChatPhaseOneChannelRecommendation {
  readonly createdAt: UnixMs;
  readonly mountTarget: string;
  readonly currentChannel: ChatVisibleChannel;
  readonly recommendedChannel: ChatVisibleChannel;
  readonly shouldSwitch: boolean;
  readonly entries: readonly ChatPhaseOneChannelRecommendationEntry[];
  readonly notes: readonly string[];
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
      noveltyLedger: phaseOne.noveltyLedger
        ? deepCloneValue(phaseOne.noveltyLedger)
        : undefined,
      episodicMemory: phaseOne.episodicMemory
        ? deepCloneValue(phaseOne.episodicMemory)
        : undefined,
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
  readonly interactionRisk01: number;
  readonly recommendedChannel: ChatVisibleChannel;
  readonly crowdPressure01: number;
  readonly negotiationPressure01: number;
} {
  const phaseOne = getPhaseOneState(state);
  const interactionRisk = computeInteractionRisk(state, base, readFeatureCreatedAt(base));
  const recommendation = recommendVisibleChannel(state, base, readFeatureCreatedAt(base));
  const activeChannel = readFeatureActiveChannel(base, resolveActiveVisibleChannel(state));
  const crowdPressure01 = computeCrowdPressureForChannel(state, activeChannel);
  const negotiationPressure01 = computeNegotiationPressure01(state, base);
  return {
    ...base,
    semanticFatigue01: phaseOne.semanticFatigueByChannel[activeChannel] ?? 0,
    unresolvedCallbacks: phaseOne.unresolvedCallbackIds.length,
    noveltySeeking01: phaseOne.conversationalFingerprint.noveltySeeking01,
    stabilitySeeking01: phaseOne.conversationalFingerprint.stabilitySeeking01,
    interactionRisk01: interactionRisk.risk01,
    recommendedChannel: recommendation.recommendedChannel,
    crowdPressure01,
    negotiationPressure01,
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
  const noveltyLedger = asPlainRecord(phaseOne.noveltyLedger);
  const rawFatigueEntries = Array.isArray(noveltyLedger?.fatigueByChannel)
    ? (noveltyLedger!.fatigueByChannel as readonly Record<string, unknown>[])
    : [];

  const computePressure = (ch: ChatVisibleChannel): number => {
    const fatigue = phaseOne.semanticFatigueByChannel[ch] ?? 0;
    const ledgerEntry = rawFatigueEntries.find((entry) => entry.channelId === ch);
    const volatility01 = clamp01(Number(ledgerEntry?.volatility01 ?? 0));
    const similarity01 = clamp01(Number(ledgerEntry?.similarity01 ?? fatigue));
    const saturation01 = clamp01(Number(ledgerEntry?.saturation01 ?? fatigue));
    const blendedLedgerPressure = weightedMean([
      [similarity01, 0.45],
      [saturation01, 0.35],
      [volatility01, 0.20],
    ]);
    return clamp01(weightedMean([
      [fatigue, 0.52],
      [callbackPressure, 0.18],
      [blendedLedgerPressure, 0.30],
    ]));
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
  const pressureMap = buildChannelPressureMap(phaseOne);
  const ledger = asPlainRecord(phaseOne.noveltyLedger);
  const fatigueEntries = Array.isArray(ledger?.fatigueByChannel)
    ? (ledger!.fatigueByChannel as readonly Record<string, unknown>[])
    : [];

  const volatilityMean = clamp01(mean(
    fatigueEntries
      .map((entry) => Number(entry.volatility01 ?? 0))
      .filter((value) => Number.isFinite(value)),
  ));

  return clamp01(weightedMean([
    [pressureMap.GLOBAL, 0.28],
    [pressureMap.SYNDICATE, 0.24],
    [pressureMap.DEAL_ROOM, 0.28],
    [pressureMap.LOBBY, 0.08],
    [volatilityMean, 0.12],
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
  const channelPressureMap = buildChannelPressureMap(phaseOne, now);
  const carryoverAgenda = buildCarryoverAgenda(phaseOne, now);
  const syncDiagnostics = buildSyncDiagnostics(state, now);
  const interactionRisk = computeInteractionRisk(state, undefined, now);
  const channelRecommendation = recommendVisibleChannel(state, undefined, now);

  const sliceAge = phaseOne.lastBridgeSyncAt
    ? now - phaseOne.lastBridgeSyncAt
    : undefined;

  const notes: string[] = [];
  let health: ChatPhaseOneStateReport['overallHealthBand'] = 'HEALTHY';

  if (!phaseOne.noveltyLedger && !phaseOne.episodicMemory) {
    health = 'STALE';
    notes.push('No ledger or episodic memory present — state is unhydrated.');
  } else if (fatigueReport.overallBand === 'CRITICAL' || interactionRisk.band === 'CRITICAL') {
    health = 'DEGRADED';
    notes.push('Critical fatigue or interaction risk detected.');
  } else if (
    fatigueReport.criticalChannelCount > 0 ||
    callbackPressure.band === 'HIGH' ||
    syncDiagnostics.band === 'STALE' ||
    syncDiagnostics.band === 'DESYNC' ||
    interactionRisk.band === 'HIGH'
  ) {
    health = 'WARN';
    if (fatigueReport.criticalChannelCount > 0) notes.push('One or more channels at critical fatigue.');
    if (callbackPressure.band === 'HIGH') notes.push('Callback pressure is high.');
    if (syncDiagnostics.band === 'STALE' || syncDiagnostics.band === 'DESYNC') notes.push('Bridge/authority sync is degraded.');
    if (interactionRisk.band === 'HIGH') notes.push('Interaction risk is elevated for the current player state.');
  }

  if (sliceAge !== undefined && sliceAge > 10 * 60 * 1000) {
    if (health === 'HEALTHY') health = 'WARN';
    notes.push(`Phase-one state is ${Math.round(sliceAge / 1000)}s old — may be stale.`);
  }

  if (carryoverAgenda.urgentCount > 0) {
    notes.push(`${carryoverAgenda.urgentCount} carryover memories should be staged soon.`);
  }

  if (channelRecommendation.shouldSwitch) {
    notes.push(`Recommended channel shift: ${channelRecommendation.currentChannel} → ${channelRecommendation.recommendedChannel}.`);
  }

  return {
    createdAt: now,
    sliceAge,
    fingerprintClassification,
    fatigueReport,
    callbackPressure,
    channelPressureMap,
    carryoverAgenda,
    syncDiagnostics,
    interactionRisk,
    channelRecommendation,
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
  const aAt = a.lastBridgeSyncAt ?? (a.noveltyLedger?.updatedAt ?? a.episodicMemory?.updatedAt ?? 0);
  const bAt = b.lastBridgeSyncAt ?? (b.noveltyLedger?.updatedAt ?? b.episodicMemory?.updatedAt ?? 0);
  const newer = aAt >= bAt ? a : b;
  const older = newer === a ? b : a;

  const mergedFatigue: Record<ChatVisibleChannel, number> = {
    GLOBAL: clamp01(weightedMean([[a.semanticFatigueByChannel.GLOBAL, 0.45], [b.semanticFatigueByChannel.GLOBAL, 0.55]])),
    SYNDICATE: clamp01(weightedMean([[a.semanticFatigueByChannel.SYNDICATE, 0.45], [b.semanticFatigueByChannel.SYNDICATE, 0.55]])),
    DEAL_ROOM: clamp01(weightedMean([[a.semanticFatigueByChannel.DEAL_ROOM, 0.45], [b.semanticFatigueByChannel.DEAL_ROOM, 0.55]])),
    LOBBY: clamp01(weightedMean([[a.semanticFatigueByChannel.LOBBY, 0.45], [b.semanticFatigueByChannel.LOBBY, 0.55]])),
  };

  const timeGap = Math.abs(aAt - bAt);
  const recencyWeight = clamp01(timeGap <= 0 ? 0.5 : 0.5 + Math.min(0.35, timeGap / (60 * 60 * 1000) * 0.10));
  const blendedFingerprint = newer === a
    ? interpolateFingerprints(older.conversationalFingerprint, newer.conversationalFingerprint, recencyWeight, now)
    : interpolateFingerprints(older.conversationalFingerprint, newer.conversationalFingerprint, recencyWeight, now);

  const mergedCallbackIds = [...new Set([...older.unresolvedCallbackIds, ...newer.unresolvedCallbackIds])]
    .slice(-PHASE_ONE_MAX_UNRESOLVED_CALLBACKS);

  return {
    noveltyLedger: newer.noveltyLedger ? deepCloneValue(newer.noveltyLedger) : older.noveltyLedger ? deepCloneValue(older.noveltyLedger) : undefined,
    episodicMemory: newer.episodicMemory ? deepCloneValue(newer.episodicMemory) : older.episodicMemory ? deepCloneValue(older.episodicMemory) : undefined,
    semanticFatigueByChannel: mergedFatigue,
    conversationalFingerprint: blendedFingerprint,
    unresolvedCallbackIds: mergedCallbackIds,
    lastBridgeSyncAt: Math.max(aAt, bAt) as UnixMs,
    lastCarryoverSummary: newer.lastCarryoverSummary ?? older.lastCarryoverSummary,
    lastNoveltyRecommendedCandidateId: newer.lastNoveltyRecommendedCandidateId ?? older.lastNoveltyRecommendedCandidateId,
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
  } else {
    const duplicateCount = value.unresolvedCallbackIds.length - new Set(value.unresolvedCallbackIds).size;
    if (duplicateCount > 0) warnings.push(`unresolvedCallbackIds contains ${duplicateCount} duplicate id(s).`);
    if (value.unresolvedCallbackIds.length > PHASE_ONE_MAX_UNRESOLVED_CALLBACKS) {
      warnings.push(`unresolvedCallbackIds exceeds cap (${value.unresolvedCallbackIds.length}/${PHASE_ONE_MAX_UNRESOLVED_CALLBACKS}).`);
    }
  }

  if (value.noveltyLedger) {
    const ledger = asPlainRecord(value.noveltyLedger) ?? {};
    if (!Array.isArray(ledger.recentEvents)) warnings.push('noveltyLedger.recentEvents is not an array.');
    if (!Array.isArray(ledger.fatigueByChannel)) warnings.push('noveltyLedger.fatigueByChannel is not an array.');
  }

  if (value.episodicMemory) {
    const memory = asPlainRecord(value.episodicMemory) ?? {};
    if (!Array.isArray(memory.activeMemories)) warnings.push('episodicMemory.activeMemories is not an array.');
    if (!Array.isArray(memory.archivedMemories)) warnings.push('episodicMemory.archivedMemories is not an array.');
    if (!Array.isArray(memory.unresolvedMemoryIds)) warnings.push('episodicMemory.unresolvedMemoryIds is not an array.');
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
      ? deepCloneValue(phaseOne.noveltyLedger)
      : undefined,
    episodicMemory: phaseOne.episodicMemory
      ? deepCloneValue(phaseOne.episodicMemory)
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
  const unresolvedCallbackIds = Array.isArray(value.unresolvedCallbackIds)
    ? [...new Set(value.unresolvedCallbackIds.map((id) => String(id)).filter(Boolean))].slice(-PHASE_ONE_MAX_UNRESOLVED_CALLBACKS)
    : [];

  return {
    noveltyLedger: value.noveltyLedger ? deepCloneValue(value.noveltyLedger) : undefined,
    episodicMemory: value.episodicMemory ? deepCloneValue(value.episodicMemory) : undefined,
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
    unresolvedCallbackIds,
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
  const body = String((message as { body?: unknown }).body ?? '').trim().toLowerCase();
  const channel = (message as { channel?: unknown }).channel as ChatVisibleChannel | undefined;
  const kind = String((message as { kind?: unknown }).kind ?? '').toUpperCase();
  const tags = new Set(
    ((message as { tags?: unknown }).tags as readonly string[] | undefined ?? []).map((t) => String(t).toLowerCase()),
  );
  const meta = (message as { meta?: Record<string, unknown> }).meta;
  const proofHash = (message as { proofHash?: unknown }).proofHash;
  const relationshipIds = ((message as { relationshipIds?: readonly string[] }).relationshipIds ?? []).length;
  const quoteIds = ((message as { quoteIds?: readonly string[] }).quoteIds ?? []).length;
  const readReceipts = ((message as { readReceipts?: readonly unknown[] }).readReceipts ?? []).length;
  const sender = (message as { sender?: Record<string, unknown> }).sender;

  const bodyWordCount = body.length === 0 ? 0 : body.split(/\s+/g).filter(Boolean).length;
  const hasQuestion = body.includes('?');
  const hasNumbers = /\d/.test(body);
  const hasProofLanguage = /(proof|show|receipt|hash|ledger|evidence|verify|verified|source)/.test(body);
  const hasProcedureLanguage = /(review|terms|sequence|step|staged|clause|process|policy|window|timing)/.test(body);
  const hasDefenseLanguage = /(hold|wait|steady|calm|shield|protect|guard|reset|breathe)/.test(body);
  const hasBluffLanguage = /(bluff|fold|blink|think|pretend|maybe|probably|i guess)/.test(body);
  const hasGreedLanguage = /(offer|deal|price|cut|split|take|buy|sell|pay|percent|upside)/.test(body);
  const hasComebackLanguage = /(comeback|back in it|recovered|stole it|saved|rebuild)/.test(body);
  const hasCollapseLanguage = /(collapse|broke|lost it|spiral|ruined|tilt)/.test(body);

  const dealRoomRisk = clamp01(Number((meta?.dealRoom as Record<string, unknown> | undefined)?.riskScore ?? 0));
  const dealRoomBluff = clamp01(Number((meta?.dealRoom as Record<string, unknown> | undefined)?.bluffRisk ?? 0));
  const dealRoomUrgency = clamp01(Number((meta?.dealRoom as Record<string, unknown> | undefined)?.urgencyScore ?? 0));
  const pressureScore = clamp01(Number((meta?.pressure as Record<string, unknown> | undefined)?.pressureScore ?? 0));
  const haterHeat = clamp01(Number((meta?.pressure as Record<string, unknown> | undefined)?.haterHeat ?? readFeatureHaterHeat(featureSnapshot) ?? 0) / 100);

  const playerFacingPublicRead = clamp01(readReceipts > 0 ? Math.min(1, readReceipts / 6) : 0);
  const relationSignal = clamp01(Math.min(1, relationshipIds / 4));
  const callbackSignal = clamp01(Math.min(1, quoteIds / 4));
  const verifiedSystemVoice = Boolean(sender?.isVerifiedSystemVoice);
  const isNpc = Boolean(sender?.isNpc);

  return {
    impulsive01:
      kind === 'PLAYER'
        ? bodyWordCount <= 4
          ? 0.64
          : hasQuestion
            ? 0.46
            : undefined
        : kind === 'NEGOTIATION_COUNTER'
          ? 0.57
          : undefined,
    patient01:
      bodyWordCount >= 16 || hasProcedureLanguage
        ? 0.71
        : kind === 'DEAL_RECAP' || verifiedSystemVoice
          ? 0.66
          : undefined,
    greedy01:
      channel === 'DEAL_ROOM' || kind === 'NEGOTIATION_OFFER' || kind === 'NEGOTIATION_COUNTER' || hasGreedLanguage
        ? clamp01(0.56 + dealRoomUrgency * 0.18 + dealRoomRisk * 0.08)
        : undefined,
    defensive01:
      kind === 'HELPER_RESCUE' || kind === 'SHIELD_EVENT' || hasDefenseLanguage
        ? clamp01(0.58 + pressureScore * 0.10)
        : hasCollapseLanguage
          ? 0.54
          : undefined,
    bluffHeavy01:
      hasBluffLanguage || dealRoomBluff > 0
        ? clamp01(0.52 + dealRoomBluff * 0.28 + dealRoomRisk * 0.10)
        : kind === 'HATER_TELEGRAPH'
          ? 0.48
          : undefined,
    literal01:
      hasProofLanguage || hasNumbers || proofHash !== undefined
        ? clamp01(0.62 + (proofHash ? 0.12 : 0) + (verifiedSystemVoice ? 0.06 : 0))
        : kind === 'SYSTEM' || kind === 'MARKET_ALERT'
          ? 0.60
          : undefined,
    comebackProne01:
      hasComebackLanguage || kind === 'RELATIONSHIP_CALLBACK' || kind === 'QUOTE_CALLBACK'
        ? clamp01(0.56 + callbackSignal * 0.16 + relationSignal * 0.10)
        : kind === 'LEGEND_MOMENT'
          ? 0.68
          : undefined,
    collapseProne01:
      hasCollapseLanguage || kind === 'CASCADE_ALERT'
        ? clamp01(0.52 + pressureScore * 0.16 + haterHeat * 0.10)
        : kind === 'BOT_ATTACK'
          ? 0.46
          : undefined,
    publicPerformer01:
      channel === 'GLOBAL' || channel === 'LOBBY' || kind === 'CROWD_REACTION' || kind === 'LEGEND_MOMENT'
        ? clamp01(0.56 + playerFacingPublicRead * 0.18 + callbackSignal * 0.08)
        : undefined,
    silentOperator01:
      channel === 'SYNDICATE'
        ? clamp01(0.58 + (bodyWordCount <= 10 ? 0.08 : 0) + (isNpc ? 0 : 0.04))
        : featureSnapshot && readFeatureSilenceWindowMs(featureSnapshot) >= 5_000
          ? 0.60
          : undefined,
    procedureAware01:
      hasProcedureLanguage || kind === 'DEAL_RECAP' || kind === 'SYSTEM'
        ? clamp01(0.64 + (hasProofLanguage ? 0.08 : 0) + (dealRoomUrgency > 0 ? 0.04 : 0))
        : undefined,
    noveltySeeking01:
      featureSnapshot
        ? clamp01(weightedMean([
            [readFeatureVisibleMessageCount(featureSnapshot) > 8 ? 0.62 : 0.48, 0.45],
            [readFeaturePanelOpen(featureSnapshot) ? 0.56 : 0.42, 0.20],
            [channel === 'GLOBAL' || channel === 'DEAL_ROOM' ? 0.58 : 0.46, 0.20],
            [kind === 'WORLD_EVENT' || kind === 'NPC_AMBIENT' ? 0.60 : 0.48, 0.15],
          ]))
        : channel === 'GLOBAL' || channel === 'DEAL_ROOM'
          ? 0.54
          : 0.48,
    stabilitySeeking01:
      featureSnapshot
        ? clamp01(weightedMean([
            [readFeatureSilenceWindowMs(featureSnapshot) > 0 ? Math.min(1, readFeatureSilenceWindowMs(featureSnapshot) / 12_000) : 0.40, 0.40],
            [kind === 'HELPER_RESCUE' || kind === 'SYSTEM' ? 0.66 : 0.48, 0.20],
            [channel === 'SYNDICATE' ? 0.64 : 0.44, 0.25],
            [hasDefenseLanguage ? 0.62 : 0.46, 0.15],
          ]))
        : hasDefenseLanguage
          ? 0.60
          : 0.46,
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
export function buildPhaseOneStateTelemetryLabel(
  phaseOne: ChatPhaseOneStateSlice,
): string {
  const archetype = classifyConversationalFingerprint(phaseOne.conversationalFingerprint).archetype;
  const fatigue = summarizeFatigue(phaseOne);
  const callbacks = phaseOne.unresolvedCallbackIds.length;
  const carryover = buildCarryoverAgenda(phaseOne).urgentCount;
  const noveltyPressure = computeNoveltyPressure(phaseOne);
  return `arch:${archetype} fatigue:[${fatigue}] cb:${callbacks} carry:${carryover} nov:${(noveltyPressure * 100).toFixed(0)}%`;
}

/**
 * Backward-compatible alias preserving older callers with the original typo.
 */
export function buildPhasOneStateTelemetryLabel(
  phaseOne: ChatPhaseOneStateSlice,
): string {
  return buildPhaseOneStateTelemetryLabel(phaseOne);
}

// ============================================================================
// MARK: Advanced UX and authority helpers
// ============================================================================

function deepCloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => deepCloneValue(entry)) as T;
  }
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      next[key] = deepCloneValue(inner);
    }
    return next as T;
  }
  return value;
}

function score100To01(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return clamp01(value / 100);
}

function resolveInteractionRiskBand(value: number): ChatPhaseOneInteractionRisk['band'] {
  if (value >= 0.82) return 'CRITICAL';
  if (value >= 0.64) return 'HIGH';
  if (value >= 0.38) return 'ELEVATED';
  return 'LOW';
}

function resolveCarryoverPriorityTier(raw: unknown): ChatPhaseOneCarryoverAgendaItem['priorityTier'] {
  const value = String(raw ?? '').toUpperCase();
  if (value === 'BACKGROUND' || value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'CRITICAL') {
    return value;
  }
  return 'UNKNOWN';
}

function priorityTierScore(tier: ChatPhaseOneCarryoverAgendaItem['priorityTier']): number {
  switch (tier) {
    case 'CRITICAL': return 1;
    case 'HIGH': return 0.82;
    case 'MEDIUM': return 0.60;
    case 'LOW': return 0.36;
    case 'BACKGROUND': return 0.18;
    default: return 0.28;
  }
}

function inferChannelAffinityFromMemory(record: Record<string, unknown>): readonly string[] {
  if (Array.isArray(record.channelAffinity)) {
    return record.channelAffinity.map((entry) => String(entry));
  }
  const triggerContext = (record.triggerContext ?? {}) as Record<string, unknown>;
  const channelId = triggerContext.channelId;
  return channelId ? [String(channelId)] : [];
}

function computeCrowdPressureForChannel(
  state: ChatEngineStateWithPhaseOne,
  channelId: ChatVisibleChannel,
): number {
  const heat = readAudienceHeat(state, channelId);
  if (!heat) return 0;
  return clamp01(weightedMean([
    [score100To01(heat.heat), 0.20],
    [score100To01(heat.ridicule), 0.32],
    [score100To01(heat.scrutiny), 0.28],
    [score100To01(heat.volatility), 0.20],
  ]));
}

function computeNegotiationPressure01(
  state: ChatEngineStateWithPhaseOne,
  featureSnapshot?: ChatFeatureSnapshot,
): number {
  const offerState = readOfferState(state);
  if (!offerState) return 0;
  const activeChannelBoost = resolveActiveVisibleChannel(state) === 'DEAL_ROOM' || readFeatureActiveChannel(featureSnapshot, resolveActiveVisibleChannel(state)) === 'DEAL_ROOM' ? 0.08 : 0;
  const stanceBoost = offerState.stance === 'CLOSING' ? 0.18 : offerState.stance === 'PUSHING' ? 0.12 : offerState.stance === 'STALLING' ? 0.06 : 0.02;
  const readPressureBoost = offerState.readPressureActive ? 0.16 : 0;
  return clamp01(weightedMean([
    [score100To01(offerState.inferredOpponentUrgency), 0.36],
    [1 - score100To01(offerState.inferredOpponentConfidence), 0.18],
    [stanceBoost + activeChannelBoost + readPressureBoost, 0.46],
  ]));
}

export function buildCarryoverAgenda(
  phaseOne: ChatPhaseOneStateSlice,
  now: UnixMs = Date.now() as UnixMs,
  limit = 6,
): ChatPhaseOneCarryoverAgenda {
  const memory = phaseOne.episodicMemory;
  if (!memory) {
    return {
      createdAt: now,
      items: [],
      unresolvedCount: 0,
      urgentCount: 0,
      dominantEventType: undefined,
      summary: phaseOne.lastCarryoverSummary,
    };
  }

  const items: ChatPhaseOneCarryoverAgendaItem[] = memory.activeMemories
    .map((entry) => {
      const raw = entry as unknown as Record<string, unknown>;
      const priorityTier = resolveCarryoverPriorityTier(raw.priorityTier);
      const affinity = inferChannelAffinityFromMemory(raw);
      const unresolvedBoost = entry.unresolved ? 0.10 : 0;
      const callbackBoost = clamp01(Math.min(1, entry.callbackVariants.length / 4)) * 0.06;
      const score01 = clamp01(weightedMean([
        [entry.salience01, 0.34],
        [entry.strategicWeight01, 0.22],
        [entry.emotionalWeight01, 0.14],
        [entry.embarrassmentRisk01, 0.12],
        [priorityTierScore(priorityTier), 0.12],
        [unresolvedBoost + callbackBoost, 0.06],
      ]));
      const notes: string[] = [];
      if (entry.unresolved) notes.push('Unresolved callback still open.');
      if (priorityTier === 'CRITICAL' || priorityTier === 'HIGH') notes.push(`Priority tier ${priorityTier}.`);
      if (entry.expiresAt && entry.expiresAt <= now + 15 * 60 * 1000) notes.push('Expiring soon.');
      if (affinity.length > 0) notes.push(`Affinity: ${affinity.join(', ')}.`);
      return {
        memoryId: entry.memoryId,
        eventType: entry.eventType,
        summary: entry.triggerContext.summary,
        unresolved: entry.unresolved,
        salience01: entry.salience01,
        strategicWeight01: entry.strategicWeight01,
        emotionalWeight01: entry.emotionalWeight01,
        embarrassmentRisk01: entry.embarrassmentRisk01,
        priorityTier,
        channelAffinity: affinity,
        createdAt: entry.createdAt,
        expiresAt: entry.expiresAt,
        score01,
        notes,
      };
    })
    .sort((a, b) => b.score01 - a.score01)
    .slice(0, Math.max(1, limit));

  const unresolvedCount = items.filter((item) => item.unresolved).length;
  const urgentCount = items.filter((item) => item.priorityTier === 'CRITICAL' || item.priorityTier === 'HIGH' || item.score01 >= 0.78).length;

  const dominantEventType = items[0]?.eventType;

  return {
    createdAt: now,
    items,
    unresolvedCount,
    urgentCount,
    dominantEventType,
    summary: phaseOne.lastCarryoverSummary,
  };
}

export function buildSyncDiagnostics(
  state: ChatEngineStateWithPhaseOne,
  now: UnixMs = Date.now() as UnixMs,
): ChatPhaseOneSyncDiagnostics {
  const phaseOne = getPhaseOneState(state);
  const phaseOneUpdatedAt = phaseOne.lastBridgeSyncAt ?? phaseOne.noveltyLedger?.updatedAt ?? phaseOne.episodicMemory?.updatedAt;
  const authoritativeUpdatedAt = resolveLastAuthoritativeSyncAt(state);
  const bridgeLagMs = phaseOneUpdatedAt ? now - phaseOneUpdatedAt : undefined;
  const authoritativeLagMs = authoritativeUpdatedAt ? now - authoritativeUpdatedAt : undefined;
  const driftMs = phaseOneUpdatedAt && authoritativeUpdatedAt
    ? Math.abs(phaseOneUpdatedAt - authoritativeUpdatedAt)
    : undefined;

  const notes: string[] = [];
  let band: ChatPhaseOneSyncDiagnostics['band'] = 'FRESH';

  if (!phaseOneUpdatedAt && !authoritativeUpdatedAt) {
    band = 'DESYNC';
    notes.push('Neither phase-one nor authoritative sync timestamps are present.');
  } else if ((bridgeLagMs ?? 0) > 10 * 60 * 1000 || (authoritativeLagMs ?? 0) > 10 * 60 * 1000) {
    band = 'STALE';
    notes.push('One or more sync lanes are stale.');
  } else if ((driftMs ?? 0) > 90 * 1000) {
    band = 'DESYNC';
    notes.push('Frontend phase-one state is drifting from authoritative sync.');
  } else if ((bridgeLagMs ?? 0) > 2 * 60 * 1000 || (authoritativeLagMs ?? 0) > 2 * 60 * 1000) {
    band = 'AGING';
    notes.push('Sync freshness is aging.');
  }

  return {
    createdAt: now,
    phaseOneUpdatedAt,
    authoritativeUpdatedAt,
    bridgeLagMs,
    authoritativeLagMs,
    driftMs,
    band,
    notes,
  };
}

export function computeInteractionRisk(
  state: ChatEngineStateWithPhaseOne,
  featureSnapshot?: ChatFeatureSnapshot,
  now: UnixMs = Date.now() as UnixMs,
): ChatPhaseOneInteractionRisk {
  const phaseOne = getPhaseOneState(state);
  const callbackPressure = computeCallbackPressure(phaseOne, now).pressure01;
  const fatigue01 = computeNoveltyPressure(phaseOne);
  const embarrassment01 = score100To01(readAffectVectorScalar(state, 'embarrassment'));
  const frustration01 = score100To01(readAffectVectorScalar(state, 'frustration'));
  const publicChannel = readFeatureActiveChannel(featureSnapshot, resolveActiveVisibleChannel(state)) === 'GLOBAL' || resolveActiveVisibleChannel(state) === 'GLOBAL' ? 'GLOBAL' : resolveActiveVisibleChannel(state);
  const crowdHostility01 = computeCrowdPressureForChannel(state, publicChannel);
  const dropOffSignals = readFeatureDropOffSignals(featureSnapshot);
  const dropOffRisk01 = dropOffSignals
    ? clamp01(weightedMean([
        [Math.min(1, dropOffSignals.silenceAfterCollapseMs / 30_000), 0.20],
        [Math.min(1, dropOffSignals.repeatedComposerDeletes / 6), 0.18],
        [Math.min(1, dropOffSignals.panelCollapseCount / 5), 0.16],
        [Math.min(1, dropOffSignals.channelHopCount / 8), 0.16],
        [Math.min(1, dropOffSignals.failedInputCount / 5), 0.12],
        [score100To01(dropOffSignals.negativeEmotionScore), 0.18],
      ]))
    : clamp01(weightedMean([[embarrassment01, 0.45], [frustration01, 0.55]]));
  const negotiationPressure01 = computeNegotiationPressure01(state, featureSnapshot);
  const activeScene = readActiveScene(state);
  const sceneLock01 = activeScene
    ? clamp01(weightedMean([
        [Math.min(1, activeScene.beats.length / 8), 0.34],
        [Math.min(1, activeScene.expectedDurationMs / 18_000), 0.33],
        [activeScene.allowPlayerComposerDuringScene ? 0.20 : 0.78, 0.33],
      ]))
    : 0;

  const risk01 = clamp01(weightedMean([
    [fatigue01, 0.20],
    [callbackPressure, 0.14],
    [crowdHostility01, 0.16],
    [embarrassment01, 0.12],
    [frustration01, 0.12],
    [dropOffRisk01, 0.16],
    [negotiationPressure01, 0.06],
    [sceneLock01, 0.04],
  ]));

  const notes: string[] = [];
  if (crowdHostility01 >= 0.65) notes.push('Public room is hostile.');
  if (dropOffRisk01 >= 0.60) notes.push('Drop-off signals are elevated.');
  if (negotiationPressure01 >= 0.60) notes.push('Deal-room pressure is active.');
  if (sceneLock01 >= 0.65) notes.push('Scene choreography is constraining player freedom.');

  return {
    createdAt: now,
    risk01,
    band: resolveInteractionRiskBand(risk01),
    fatigue01,
    callbackPressure01: callbackPressure,
    crowdHostility01,
    embarrassment01,
    frustration01,
    dropOffRisk01,
    negotiationPressure01,
    sceneLock01,
    notes,
  };
}

export function recommendVisibleChannel(
  state: ChatEngineStateWithPhaseOne,
  featureSnapshot?: ChatFeatureSnapshot,
  now: UnixMs = Date.now() as UnixMs,
): ChatPhaseOneChannelRecommendation {
  const phaseOne = getPhaseOneState(state);
  const preset = CHAT_MOUNT_PRESETS[resolveMountTarget(state)];
  const allowed = preset?.allowedVisibleChannels ?? CHAT_VISIBLE_CHANNELS;
  const classification = classifyConversationalFingerprint(phaseOne.conversationalFingerprint);
  const interactionRisk = computeInteractionRisk(state, featureSnapshot, now);
  const currentChannel = resolveActiveVisibleChannel(state);

  const entries: ChatPhaseOneChannelRecommendationEntry[] = allowed.map((channelId) => {
    const reasons: string[] = [];
    const fatigue01 = phaseOne.semanticFatigueByChannel[channelId] ?? 0;
    const crowdPressure01 = computeCrowdPressureForChannel(state, channelId);
    const negotiationFit01 = channelId === 'DEAL_ROOM'
      ? clamp01(weightedMean([[computeNegotiationPressure01(state, featureSnapshot), 0.72], [classification.archetype === 'NEGOTIATOR' ? 0.82 : 0.40, 0.28]]))
      : 0.18;
    const rescueFit01 = channelId === 'SYNDICATE'
      ? clamp01(weightedMean([[interactionRisk.risk01, 0.65], [classification.archetype === 'GHOST' || classification.archetype === 'SURVIVOR' ? 0.72 : 0.36, 0.35]]))
      : channelId === 'LOBBY' && resolveMountTarget(state) === 'LOBBY_SCREEN'
        ? 0.46
        : 0.10;
    const performerFit01 = channelId === 'GLOBAL' || channelId === 'LOBBY'
      ? clamp01(weightedMean([[classification.archetype === 'SHOWMAN' || classification.archetype === 'COMEBACK_ARTIST' ? 0.82 : 0.36, 0.60], [1 - crowdPressure01, 0.20], [score100To01(readAudienceHeat(state, channelId).hype), 0.20]]))
      : 0.14;

    const mountDefaultChannel = readMountDefaultVisibleChannel(preset, currentChannel);
    const mountBias = mountDefaultChannel === channelId ? 0.14 : 0.05;
    const activeScene = readActiveScene(state);
    const sceneBias = activeScene?.primaryChannel === channelId ? 0.18 : 0;
    const scenePinned = activeScene?.primaryChannel === channelId && !activeScene.allowPlayerComposerDuringScene;
    const liveOpsSuppressed = readLiveOps(state).suppressedHelperChannels.includes(channelId);
    const liveOpsBoost = readLiveOps(state).boostedCrowdChannels.includes(channelId) ? 0.08 : 0;
    const continuity = readContinuity(state);
    const continuityBias = continuity.lastMountTarget === resolveMountTarget(state) && continuity.carryoverSummary && channelId === currentChannel ? 0.06 : 0;

    const score01 = clamp01(weightedMean([
      [1 - fatigue01, 0.28],
      [1 - crowdPressure01, classification.archetype === 'SHOWMAN' ? 0.05 : 0.18],
      [negotiationFit01, 0.18],
      [rescueFit01, 0.16],
      [performerFit01, 0.12],
      [mountBias + sceneBias + liveOpsBoost + continuityBias, 0.26],
    ]) - (liveOpsSuppressed ? 0.10 : 0));

    if (mountDefaultChannel === channelId) reasons.push('Fits mount default.');
    if (sceneBias > 0) reasons.push('Matches active scene.');
    if (negotiationFit01 >= 0.60) reasons.push('Supports active negotiation pressure.');
    if (rescueFit01 >= 0.60) reasons.push('Lower-friction channel for player recovery.');
    if (performerFit01 >= 0.60) reasons.push('Fits the player’s public-performance profile.');
    if (fatigue01 >= 0.62) reasons.push('Penalty: channel fatigue is high.');
    if (crowdPressure01 >= 0.62 && classification.archetype !== 'SHOWMAN' && classification.archetype !== 'COMEBACK_ARTIST') reasons.push('Penalty: crowd pressure is high.');
    if (liveOpsSuppressed) reasons.push('Penalty: LiveOps is suppressing this channel.');

    return {
      channelId,
      score01,
      allowedByMount: allowed.includes(channelId),
      pinnedByScene: Boolean(scenePinned),
      suppressedByLiveOps: liveOpsSuppressed,
      fatigue01,
      crowdPressure01,
      negotiationFit01,
      rescueFit01,
      performerFit01,
      reasons,
    };
  }).sort((a, b) => b.score01 - a.score01);

  const recommendedChannel = entries[0]?.channelId ?? currentChannel;
  const currentScore = entries.find((entry) => entry.channelId === currentChannel)?.score01 ?? 0;
  const recommendedScore = entries[0]?.score01 ?? currentScore;
  const shouldSwitch = recommendedChannel !== currentChannel && (recommendedScore - currentScore >= 0.08);

  const notes: string[] = [];
  if (shouldSwitch) notes.push(`Switch to ${recommendedChannel} for better pressure handling and pacing.`);
  if (!shouldSwitch) notes.push('Current channel remains viable.');

  return {
    createdAt: now,
    mountTarget: resolveMountTarget(state),
    currentChannel,
    recommendedChannel,
    shouldSwitch,
    entries,
    notes,
  };
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
  buildCarryoverAgenda,
  buildSyncDiagnostics,
  computeInteractionRisk,
  recommendVisibleChannel,

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
  buildPhaseOneStateTelemetryLabel,
  buildPhasOneStateTelemetryLabel,

  // Numeric utilities
  clamp01,
});
