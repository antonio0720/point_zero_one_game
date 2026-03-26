/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT SHIELD LAYER MANAGER ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/ShieldLayerManagerSignalAdapter.ts
 * VERSION: 2026.03.25
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates ShieldLayerManager state —
 * layer integrity changes, breach events, repair deliveries, cascade cracks,
 * regen ticks, and resilience forecasts — into authoritative backend chat
 * shield-layer signals.
 *
 * Backend-truth question
 * ----------------------
 *   "When the shield layer manager resolves a tick — regenerating HP, absorbing
 *    routed damage, delivering repair slices, and cracking on cascade — what
 *    exact chat-native signals should the backend chat engine ingest to keep the
 *    player informed of their shield posture in real time?"
 *
 * This file owns:
 * - ShieldLayerState change → ChatInputEnvelope translation
 * - Breach event detection and severity classification
 * - Cascade crack event narration
 * - Regen and repair delivery summaries
 * - Ghost echo risk and sovereignty fatality risk signaling
 * - Per-layer posture and vulnerability reporting
 * - ML vector extraction (32-feature layer manager vector)
 * - DL tensor construction (40×6 layer manager tensor)
 * - Trend analysis and resilience forecast narration
 * - Annotation bundles and UX hints for companion display
 * - Deduplication to prevent shield-layer spam in the chat lane
 * - Adapter analytics, health reporting, and session summaries
 *
 * It does not own:
 * - Attack routing decisions (owned by AttackRouter)
 * - Cascade chain resolution (owned by BreachCascadeResolver)
 * - Repair scheduling (owned by ShieldRepairQueue)
 * - Transcript mutation, NPC speech, rate policy, or socket fanout
 * - Replay persistence or proof chain authoring
 *
 * Design laws
 * -----------
 * - Shield terms are precise: L1=CASH_RESERVE, L2=CREDIT_LINE,
 *   L3=INCOME_BASE, L4=NETWORK_CORE. Never genericize.
 * - Breach signals fire on change, not every tick.
 * - Ghost L3 breach echo is a distinct signal from standard L4 sovereignty breach.
 * - Sovereignty L4 fatality is CRITICAL — never suppressed.
 * - ML/DL output must be deterministic and replay-safe.
 * - All imports consumed — zero TS6133 tolerance.
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  type ChatInputEnvelope,
  type ChatRoomId,
  type ChatSignalEnvelope,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type UnixMs,
} from '../types';

import {
  isEndgamePhase,
  isHaterBotId,
  type AttackEvent,
  type BotState,
  type HaterBotId,
  type ModeCode,
  type PressureTier,
  type RunPhase,
  type ShieldLayerId,
  type ThreatEnvelope,
} from '../../core/GamePrimitives';

import type { RunStateSnapshot, ShieldLayerState } from '../../core/RunStateSnapshot';

import {
  ShieldLayerManager,
  ShieldLayerManagerMLExtractor,
  ShieldLayerManagerDLBuilder,
  ShieldLayerManagerTrendAnalyzer,
  ShieldLayerManagerResilienceForecaster,
  ShieldLayerManagerAnnotator,
  ShieldLayerManagerInspector,
  ShieldLayerManagerAnalytics,
  createShieldLayerManagerWithAnalytics,
  buildShieldLayerManagerSessionReport,
  buildLayerManagerThresholdReport,
  buildLayerManagerMLCompat,
  buildLayerVulnerabilityMap,
  computeWeightedIntegrity,
  computeNormalizedRegenCapacity,
  findCriticalLayerIds,
  findLowIntegrityLayerIds,
  getAbsorptionPriority,
  scoreOverallBreachRisk,
  classifyBreachRisk,
  getLayerManagerChatChannel,
  buildLayerManagerUXHeadline,
  buildRecommendedAction,
  scoreRepairUrgency,
  classifyIncomingAttackSeverity,
  classifyMostUrgentThreat,
  computeLayerBotThreatScore,
  computeModeTensionFloor,
  computeRegenMultiplier,
  computeBreachSensitivity,
  buildLayerConfigMap,
  inferDoctrineFromRoutedAttack,
  buildLayerIntegrityLabel,
  buildLayerManagerNarrativeWeight,
  computeLayerPressureRiskScore,
  extractMLArray,
  validateMLArrayLength,
  validateDLRowLength,
  describeLayerManagerState,
  SHIELD_LAYER_MANAGER_MODULE_VERSION,
  SHIELD_LAYER_MANAGER_READY,
  SHIELD_LAYER_MANAGER_ML_FEATURE_COUNT,
  SHIELD_LAYER_MANAGER_DL_FEATURE_COUNT,
  SHIELD_LAYER_MANAGER_DL_SEQUENCE_LENGTH,
  SHIELD_LAYER_MANAGER_HISTORY_DEPTH,
  SHIELD_LAYER_MANAGER_TREND_WINDOW,
  SHIELD_LAYER_MANAGER_FORECAST_LOW_THRESHOLD,
  SHIELD_LAYER_MANAGER_FORECAST_CRITICAL_THRESHOLD,
  SHIELD_LAYER_MANAGER_FORECAST_MAX_HORIZON,
  SHIELD_LAYER_MANAGER_STABLE_THRESHOLD,
  SHIELD_LAYER_MANAGER_HIGH_DAMAGE_THRESHOLD,
  SHIELD_LAYER_MANAGER_HIGH_REPAIR_THRESHOLD,
  SHIELD_LAYER_MANAGER_BREACH_HISTORY_DEPTH,
  SHIELD_LAYER_MANAGER_ML_FEATURE_LABELS,
  SHIELD_LAYER_MANAGER_DL_FEATURE_LABELS,
  SHIELD_LAYER_MANAGER_MANIFEST,
  type ShieldLayerManagerMLVector,
  type ShieldLayerManagerDLRow,
  type ShieldLayerManagerDLTensor,
  type ShieldLayerManagerLayerTrend,
  type ShieldLayerManagerTrendSummary,
  type ShieldLayerManagerLayerForecast,
  type ShieldLayerManagerResilienceForecast,
  type ShieldLayerManagerBreachAnnotation,
  type ShieldLayerManagerAnnotationBundle,
  type ShieldLayerManagerUXHint,
  type ShieldLayerManagerHistoryEntry,
  type ShieldLayerManagerInspectorState,
  type ShieldLayerManagerAnalyticsSummary,
  type ShieldLayerManagerEnsemble,
  type ShieldLayerManagerMLParams,
  type ShieldLayerManagerDLRowParams,
  type ShieldLayerManagerSessionReport,
} from '../../shield/ShieldLayerManager';

import {
  SHIELD_CONSTANTS,
  SHIELD_LAYER_CONFIGS,
  SHIELD_LAYER_ORDER,
  type CascadeResolution,
  type DamageResolution,
  type PendingRepairSlice,
  type RepairJob,
  type RepairLayerId,
  type RoutedAttack,
  type ShieldDoctrineAttackType,
  type ShieldLayerConfig,
} from '../../shield/types';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — Module constants
// ─────────────────────────────────────────────────────────────────────────────

export const SHIELD_LAYER_MGR_ADAPTER_VERSION =
  SHIELD_LAYER_MANAGER_MODULE_VERSION;

export const SHIELD_LAYER_MGR_ADAPTER_ML_FEATURE_COUNT =
  SHIELD_LAYER_MANAGER_ML_FEATURE_COUNT;

export const SHIELD_LAYER_MGR_ADAPTER_DL_FEATURE_COUNT =
  SHIELD_LAYER_MANAGER_DL_FEATURE_COUNT;

export const SHIELD_LAYER_MGR_ADAPTER_DL_SEQUENCE_LENGTH =
  SHIELD_LAYER_MANAGER_DL_SEQUENCE_LENGTH;

/** Ticks within which the same breach event is deduplicated. */
export const SHIELD_LAYER_MGR_ADAPTER_DEDUPE_WINDOW_TICKS = 3 as const;

/** Maximum signals accepted in a single batch adapt call. */
export const SHIELD_LAYER_MGR_ADAPTER_MAX_BATCH_SIZE = 20 as const;

/** Integrity delta threshold below which a change event is suppressed. */
export const SHIELD_LAYER_MGR_ADAPTER_MIN_DELTA_THRESHOLD = 0.02 as const;

/** Number of history entries to retain in the adapter's ring buffer. */
export const SHIELD_LAYER_MGR_ADAPTER_HISTORY_DEPTH =
  SHIELD_LAYER_MANAGER_HISTORY_DEPTH;

/** Trend window for adapter-level velocity computation. */
export const SHIELD_LAYER_MGR_ADAPTER_TREND_WINDOW =
  SHIELD_LAYER_MANAGER_TREND_WINDOW;

/** Forecast horizon used for adapter-level recovery estimates. */
export const SHIELD_LAYER_MGR_ADAPTER_FORECAST_MAX_HORIZON =
  SHIELD_LAYER_MANAGER_FORECAST_MAX_HORIZON;

/** Minimum overall integrity ratio below which a LOW signal fires. */
export const SHIELD_LAYER_MGR_ADAPTER_LOW_INTEGRITY_THRESHOLD =
  SHIELD_LAYER_MANAGER_FORECAST_LOW_THRESHOLD;

/** Minimum overall integrity ratio below which a CRITICAL signal fires. */
export const SHIELD_LAYER_MGR_ADAPTER_CRITICAL_INTEGRITY_THRESHOLD =
  SHIELD_LAYER_MANAGER_FORECAST_CRITICAL_THRESHOLD;

/** Stable integrity threshold — below this, warnings begin. */
export const SHIELD_LAYER_MGR_ADAPTER_STABLE_THRESHOLD =
  SHIELD_LAYER_MANAGER_STABLE_THRESHOLD;

/** Damage magnitude threshold that elevates to a HIGH-severity signal. */
export const SHIELD_LAYER_MGR_ADAPTER_HIGH_DAMAGE_THRESHOLD =
  SHIELD_LAYER_MANAGER_HIGH_DAMAGE_THRESHOLD;

/** Repair magnitude threshold that elevates to an INFO signal. */
export const SHIELD_LAYER_MGR_ADAPTER_HIGH_REPAIR_THRESHOLD =
  SHIELD_LAYER_MANAGER_HIGH_REPAIR_THRESHOLD;

/** Breach history depth for deduplication. */
export const SHIELD_LAYER_MGR_ADAPTER_BREACH_HISTORY_DEPTH =
  SHIELD_LAYER_MANAGER_BREACH_HISTORY_DEPTH;

export const SHIELD_LAYER_MGR_ADAPTER_EVENT_NAMES = Object.freeze([
  'shield_layer_manager.breach',
  'shield_layer_manager.cascade_crack',
  'shield_layer_manager.repair_delivered',
  'shield_layer_manager.regen',
  'shield_layer_manager.integrity_low',
  'shield_layer_manager.integrity_critical',
  'shield_layer_manager.fortified',
  'shield_layer_manager.posture_changed',
  'shield_layer_manager.ghost_echo_risk',
  'shield_layer_manager.sovereignty_fatal_risk',
  'shield_layer_manager.session_summary',
] as const);

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — Type definitions
// ─────────────────────────────────────────────────────────────────────────────

export type ShieldLayerMgrAdapterEventName =
  (typeof SHIELD_LAYER_MGR_ADAPTER_EVENT_NAMES)[number];

export type ShieldLayerMgrAdapterSeverity =
  | 'INFO'
  | 'WARN'
  | 'ERROR'
  | 'CRITICAL';

export type ShieldLayerMgrAdapterNarrativeWeight = {
  readonly score: number;
  readonly label: 'NEGLIGIBLE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  readonly shouldSurface: boolean;
};

export type ShieldLayerMgrAdapterChannelRecommendation =
  | 'SHIELD_LOW'
  | 'SHIELD_MID'
  | 'SHIELD_HIGH'
  | 'SHIELD_CRITICAL';

export interface ShieldLayerMgrAdapterLogger {
  debug(msg: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(msg: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(msg: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ShieldLayerMgrAdapterClock {
  now(): UnixMs;
}

export interface ShieldLayerMgrAdapterOptions {
  readonly logger?: ShieldLayerMgrAdapterLogger;
  readonly clock?: ShieldLayerMgrAdapterClock;
  readonly dedupeWindowTicks?: number;
  readonly maxBatchSize?: number;
  readonly minDeltaThreshold?: number;
  readonly suppressRegenSignals?: boolean;
  readonly alwaysSurfaceSovereigntyFatal?: boolean;
}

/** Primary input to ShieldLayerManagerSignalAdapter.adapt(). */
export interface ShieldLayerMgrSignalInput {
  readonly tick: number;
  readonly layers: readonly ShieldLayerState[];
  readonly previousLayers: readonly ShieldLayerState[] | null;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly pressureTier: PressureTier;
  readonly newBreaches: readonly ShieldLayerId[];
  readonly cascadeCrackLayers: readonly ShieldLayerId[];
  readonly repairApplied: Readonly<Record<ShieldLayerId, number>>;
  readonly regenApplied: Readonly<Record<ShieldLayerId, number>>;
  readonly damageApplied: Readonly<Record<ShieldLayerId, number>>;
  readonly attacks: readonly AttackEvent[];
  readonly threats: readonly ThreatEnvelope[];
  readonly botStates: Readonly<Record<HaterBotId, BotState>>;
  readonly routedAttacks: readonly RoutedAttack[];
  readonly repairSlices: readonly PendingRepairSlice[];
  readonly activeRepairJobs: readonly RepairJob[];
  readonly damageResolutions: readonly DamageResolution[];
  readonly cascadeResolution: CascadeResolution | null;
  readonly runId?: string;
  readonly roomId?: ChatRoomId | null;
}

/** Batch input — multiple ticks resolved in one call. */
export interface ShieldLayerMgrSignalBatchInput {
  readonly ticks: readonly ShieldLayerMgrSignalInput[];
  readonly runId?: string;
  readonly roomId?: ChatRoomId | null;
}

/** Chat signal compat object for one shield layer manager event. */
export interface ShieldLayerMgrChatSignalCompat {
  readonly eventName: ShieldLayerMgrAdapterEventName;
  readonly tick: number;
  readonly runId: string;
  readonly severity: ShieldLayerMgrAdapterSeverity;
  readonly channel: ShieldLayerMgrAdapterChannelRecommendation;
  readonly headline: string;
  readonly detail: string;
  readonly layerId: ShieldLayerId | null;
  readonly overallIntegrity: number;
  readonly breachRisk: number;
  readonly ghostEchoRisk: number;
  readonly sovereigntyFatalRisk: number;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly pressureTier: PressureTier;
  readonly mlVector: ShieldLayerManagerMLVector | null;
  readonly narrativeWeight: number;
  readonly emittedAt: UnixMs;
}

/** ML vector compat wrapper. */
export interface ShieldLayerMgrMLVectorCompat {
  readonly tick: number;
  readonly vector: ShieldLayerManagerMLVector;
  readonly features: number[];
  readonly labels: readonly string[];
  readonly featureCount: number;
  readonly valid: boolean;
}

/** DL tensor compat wrapper. */
export interface ShieldLayerMgrDLTensorCompat {
  readonly tensor: ShieldLayerManagerDLTensor;
  readonly latestTick: number;
  readonly sequenceLength: number;
  readonly featureCount: number;
  readonly valid: boolean;
}

/** UX hint compat — surface-level display for chat lane. */
export interface ShieldLayerMgrUXHintCompat {
  readonly tick: number;
  readonly hint: ShieldLayerManagerUXHint;
  readonly breachRisk: number;
  readonly urgencyLabel: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  readonly channel: ShieldLayerMgrAdapterChannelRecommendation;
}

/** Annotation compat — full annotation bundle. */
export interface ShieldLayerMgrAnnotationCompat {
  readonly tick: number;
  readonly bundle: ShieldLayerManagerAnnotationBundle;
  readonly overallHeadline: string;
  readonly uxSummary: string;
}

/** Layer config map compat. */
export interface ShieldLayerMgrConfigMapCompat {
  readonly configs: Readonly<Record<ShieldLayerId, ShieldLayerConfig>>;
  readonly constants: typeof SHIELD_CONSTANTS;
  readonly layerOrder: typeof SHIELD_LAYER_ORDER;
  readonly layerConfigs: typeof SHIELD_LAYER_CONFIGS;
}

/** Damage resolution compat. */
export interface ShieldLayerMgrDamageResolutionCompat {
  readonly layerId: ShieldLayerId;
  readonly effectiveDamage: number;
  readonly deflectionApplied: number;
  readonly preHitIntegrity: number;
  readonly postHitIntegrity: number;
  readonly breached: boolean;
  readonly wasAlreadyBreached: boolean;
}

/** Repair job compat. */
export interface ShieldLayerMgrRepairJobCompat {
  readonly jobId: string;
  readonly layerId: RepairLayerId;
  readonly amount: number;
  readonly ticksRemaining: number;
  readonly delivered: number;
  readonly source: RepairJob['source'];
}

/** Full adapter bundle for one tick. */
export interface ShieldLayerMgrAdapterBundle {
  readonly tick: number;
  readonly signal: ShieldLayerMgrChatSignalCompat;
  readonly mlVector: ShieldLayerMgrMLVectorCompat;
  readonly dlTensor: ShieldLayerMgrDLTensorCompat;
  readonly uxHint: ShieldLayerMgrUXHintCompat;
  readonly annotation: ShieldLayerMgrAnnotationCompat;
  readonly inspectorState: ShieldLayerManagerInspectorState;
  readonly forecast: ShieldLayerManagerResilienceForecast;
  readonly trendSummary: ShieldLayerManagerTrendSummary;
  readonly thresholdReport: string;
}

/** Adapter internal state. */
export interface ShieldLayerMgrAdapterState {
  readonly signalCount: number;
  readonly rejectedCount: number;
  readonly lastTick: number;
  readonly lastSignalAt: UnixMs | null;
  readonly breachCount: number;
  readonly cascadeCrackCount: number;
  readonly totalRepairApplied: number;
  readonly historyDepth: number;
}

/** Adapter session report. */
export interface ShieldLayerMgrAdapterReport {
  readonly state: ShieldLayerMgrAdapterState;
  readonly analytics: ShieldLayerManagerAnalyticsSummary;
  readonly sessionReport: ShieldLayerManagerSessionReport | null;
}

/** Rejection record — why a signal was suppressed. */
export interface ShieldLayerMgrAdapterRejection {
  readonly tick: number;
  readonly reason: string;
  readonly layerId: ShieldLayerId | null;
}

/** History entry for internal deduplication tracking. */
export interface ShieldLayerMgrAdapterHistoryEntry {
  readonly tick: number;
  readonly eventName: ShieldLayerMgrAdapterEventName;
  readonly layerId: ShieldLayerId | null;
  readonly severity: ShieldLayerMgrAdapterSeverity;
  readonly narrativeWeight: number;
}

/** Signal artifact produced after accept. */
export interface ShieldLayerMgrAdapterArtifact {
  readonly accepted: true;
  readonly signal: ShieldLayerMgrChatSignalCompat;
  readonly envelopes: readonly ChatInputEnvelope[];
  readonly tick: number;
}

/** Signal rejection produced after reject. */
export interface ShieldLayerMgrAdapterDeduped {
  readonly accepted: false;
  readonly reason: string;
  readonly tick: number;
  readonly layerId: ShieldLayerId | null;
}

/** Exposure profile for pre-routing layer state. */
export interface ShieldLayerMgrExposureProfile {
  readonly tick: number;
  readonly overallBreachRisk: number;
  readonly vulnerabilityMap: Readonly<Record<ShieldLayerId, number>>;
  readonly criticalLayerIds: readonly ShieldLayerId[];
  readonly lowLayerIds: readonly ShieldLayerId[];
  readonly ghostEchoRisk: number;
  readonly sovereigntyFatalRisk: number;
  readonly botThreatScore: number;
  readonly repairUrgency: number;
  readonly narrativeWeight: number;
}

/** Posture snapshot for all four layers. */
export interface ShieldLayerMgrPostureSnapshot {
  readonly tick: number;
  readonly postures: Readonly<Record<ShieldLayerId, string>>;
  readonly overall: string;
  readonly fortified: boolean;
  readonly breachedCount: number;
  readonly criticalCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — Pure helper functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map overall breach risk to an adapter severity level.
 */
export function classifyAdapterSeverity(
  breachRisk: number,
  newBreaches: readonly ShieldLayerId[],
  hasSovereigntyFatal: boolean,
): ShieldLayerMgrAdapterSeverity {
  if (hasSovereigntyFatal && newBreaches.includes('L4')) return 'CRITICAL';
  if (breachRisk >= 0.85) return 'CRITICAL';
  if (newBreaches.length > 0 || breachRisk >= 0.60) return 'ERROR';
  if (breachRisk >= 0.30) return 'WARN';
  return 'INFO';
}

/**
 * Map narrative weight score to a label and surface decision.
 */
export function buildAdapterNarrativeWeight(
  score: number,
): ShieldLayerMgrAdapterNarrativeWeight {
  if (score >= 0.80) return { score, label: 'CRITICAL', shouldSurface: true };
  if (score >= 0.60) return { score, label: 'HIGH', shouldSurface: true };
  if (score >= 0.35) return { score, label: 'MODERATE', shouldSurface: true };
  if (score >= 0.15) return { score, label: 'LOW', shouldSurface: false };
  return { score, label: 'NEGLIGIBLE', shouldSurface: false };
}

/**
 * Determine whether a tick should be surfaced to chat based on breach risk,
 * new breaches, and the delta threshold.
 */
export function shouldSurfaceTick(
  input: ShieldLayerMgrSignalInput,
  dedupeWindowTicks: number,
  lastBreachTicks: Readonly<Record<ShieldLayerId, number>>,
  minDeltaThreshold: number,
  suppressRegenSignals: boolean,
): boolean {
  // Always surface new breaches
  if (input.newBreaches.length > 0) return true;

  // Always surface cascade cracks
  if (input.cascadeCrackLayers.length > 0) return true;

  // Always surface sovereignty fatal risk when L4 is critical
  const l4 = input.layers.find((l) => l.layerId === 'L4');
  if (
    l4 &&
    l4.integrityRatio < SHIELD_LAYER_MANAGER_FORECAST_CRITICAL_THRESHOLD &&
    input.phase === 'SOVEREIGNTY'
  ) {
    return true;
  }

  // Deduplicate layer breaches within the window
  for (const layerId of input.newBreaches) {
    const lastTick = lastBreachTicks[layerId] ?? -Infinity;
    if (input.tick - lastTick < dedupeWindowTicks) return false;
  }

  // Surface significant damage
  const totalDamage = Object.values(input.damageApplied).reduce((s, v) => s + v, 0);
  if (totalDamage >= SHIELD_LAYER_MANAGER_HIGH_DAMAGE_THRESHOLD) return true;

  // Surface significant repair
  const totalRepair = Object.values(input.repairApplied).reduce((s, v) => s + v, 0);
  if (totalRepair >= SHIELD_LAYER_MANAGER_HIGH_REPAIR_THRESHOLD) return true;

  // Suppress pure regen ticks if configured
  const isRegenOnly = totalDamage === 0 && totalRepair === 0;
  if (isRegenOnly && suppressRegenSignals) return false;

  // Surface integrity change above threshold
  if (input.previousLayers !== null) {
    for (const layer of input.layers) {
      const prev = input.previousLayers.find((l) => l.layerId === layer.layerId);
      if (prev) {
        const delta = Math.abs(layer.integrityRatio - prev.integrityRatio);
        if (delta >= minDeltaThreshold) return true;
      }
    }
  }

  return false;
}

/**
 * Build an exposure profile from the current tick's layer state.
 */
export function buildLayerMgrExposureProfile(
  input: ShieldLayerMgrSignalInput,
  manager: ShieldLayerManager,
): ShieldLayerMgrExposureProfile {
  const vulnerabilityMap = buildLayerVulnerabilityMap(input.layers);
  const criticalLayerIds = findCriticalLayerIds(input.layers);
  const lowLayerIds = findLowIntegrityLayerIds(input.layers);
  const overallBreachRisk = scoreOverallBreachRisk(input.layers);
  const ghostEchoRisk = manager.computeGhostEchoRisk(input.layers, input.mode);
  const sovereigntyFatalRisk = manager.computeSovereigntyFatalityRisk(
    input.layers,
    input.phase,
    input.mode,
  );
  const botThreatScore = computeLayerBotThreatScore(input.botStates);
  const repairUrgency = scoreRepairUrgency(
    input.layers,
    input.attacks,
    input.threats,
    input.tick,
    input.mode,
    input.phase,
  );
  const narrativeWeight = buildLayerManagerNarrativeWeight(
    input.layers,
    input.mode,
    input.phase,
    input.pressureTier,
  );

  return {
    tick: input.tick,
    overallBreachRisk,
    vulnerabilityMap,
    criticalLayerIds,
    lowLayerIds,
    ghostEchoRisk,
    sovereigntyFatalRisk,
    botThreatScore,
    repairUrgency,
    narrativeWeight,
  };
}

/**
 * Build the chat signal compat object for one tick.
 */
export function buildLayerMgrChatSignal(
  input: ShieldLayerMgrSignalInput,
  eventName: ShieldLayerMgrAdapterEventName,
  severity: ShieldLayerMgrAdapterSeverity,
  headline: string,
  detail: string,
  mlVector: ShieldLayerManagerMLVector | null,
  breachRisk: number,
  ghostEchoRisk: number,
  sovereigntyFatalRisk: number,
  narrativeWeight: number,
  clock: ShieldLayerMgrAdapterClock,
): ShieldLayerMgrChatSignalCompat {
  const channel = getLayerManagerChatChannel(
    breachRisk,
  ) as ShieldLayerMgrAdapterChannelRecommendation;

  const dominantBreachedLayer = input.newBreaches[0] ?? null;

  return {
    eventName,
    tick: input.tick,
    runId: input.runId ?? 'unknown',
    severity,
    channel,
    headline,
    detail,
    layerId: dominantBreachedLayer,
    overallIntegrity: computeWeightedIntegrity(input.layers),
    breachRisk,
    ghostEchoRisk,
    sovereigntyFatalRisk,
    mode: input.mode,
    phase: input.phase,
    pressureTier: input.pressureTier,
    mlVector,
    narrativeWeight,
    emittedAt: clock.now(),
  };
}

/**
 * Build the ML vector compat for one tick.
 */
export function buildLayerMgrMLVectorCompat(
  tick: number,
  vector: ShieldLayerManagerMLVector,
): ShieldLayerMgrMLVectorCompat {
  const features = extractMLArray(vector);
  return {
    tick,
    vector,
    features,
    labels: SHIELD_LAYER_MANAGER_ML_FEATURE_LABELS,
    featureCount: SHIELD_LAYER_MANAGER_ML_FEATURE_COUNT,
    valid: validateMLArrayLength(features),
  };
}

/**
 * Build the DL tensor compat from a built tensor.
 */
export function buildLayerMgrDLTensorCompat(
  tensor: ShieldLayerManagerDLTensor,
): ShieldLayerMgrDLTensorCompat {
  const latestRow =
    tensor.rows.length > 0 ? tensor.rows[tensor.rows.length - 1] : null;
  const valid = latestRow !== null && validateDLRowLength(latestRow);
  return {
    tensor,
    latestTick: tensor.latestTick,
    sequenceLength: tensor.sequenceLength,
    featureCount: tensor.featureCount,
    valid,
  };
}

/**
 * Build a UX hint compat from the annotator output.
 */
export function buildLayerMgrUXHintCompat(
  tick: number,
  hint: ShieldLayerManagerUXHint,
): ShieldLayerMgrUXHintCompat {
  return {
    tick,
    hint,
    breachRisk: hint.urgency === 'CRITICAL'
      ? 0.9
      : hint.urgency === 'HIGH'
        ? 0.7
        : hint.urgency === 'MODERATE'
          ? 0.45
          : hint.urgency === 'LOW'
            ? 0.2
            : 0,
    urgencyLabel: hint.urgency,
    channel: hint.chatChannel as ShieldLayerMgrAdapterChannelRecommendation,
  };
}

/**
 * Build an annotation compat from the annotator bundle.
 */
export function buildLayerMgrAnnotationCompat(
  tick: number,
  bundle: ShieldLayerManagerAnnotationBundle,
): ShieldLayerMgrAnnotationCompat {
  return {
    tick,
    bundle,
    overallHeadline: bundle.overallHeadline,
    uxSummary: bundle.uxSummary,
  };
}

/**
 * Build a posture snapshot for all four layers.
 */
export function buildLayerMgrPostureSnapshot(
  tick: number,
  layers: readonly ShieldLayerState[],
  manager: ShieldLayerManager,
): ShieldLayerMgrPostureSnapshot {
  const postures = manager.computeLayerPostures(layers);
  const overallRatio = computeWeightedIntegrity(layers);
  const fortified = manager.isFortified(layers);
  const breachedCount = layers.filter((l) => l.breached).length;
  const criticalCount = findCriticalLayerIds(layers).length;
  const overall = buildLayerIntegrityLabel(overallRatio);

  return {
    tick,
    postures,
    overall,
    fortified,
    breachedCount,
    criticalCount,
  };
}

/**
 * Build the layer config map compat including shield constants.
 */
export function buildLayerMgrConfigMapCompat(): ShieldLayerMgrConfigMapCompat {
  return {
    configs: buildLayerConfigMap(),
    constants: SHIELD_CONSTANTS,
    layerOrder: SHIELD_LAYER_ORDER,
    layerConfigs: SHIELD_LAYER_CONFIGS,
  };
}

/**
 * Convert a DamageResolution to an adapter-level compat object.
 */
export function buildLayerMgrDamageResolutionCompat(
  resolution: DamageResolution,
): ShieldLayerMgrDamageResolutionCompat {
  return {
    layerId: resolution.actualLayerId,
    effectiveDamage: resolution.effectiveDamage,
    deflectionApplied: resolution.deflectionApplied,
    preHitIntegrity: resolution.preHitIntegrity,
    postHitIntegrity: resolution.postHitIntegrity,
    breached: resolution.breached,
    wasAlreadyBreached: resolution.wasAlreadyBreached,
  };
}

/**
 * Convert a RepairJob to an adapter-level compat object.
 */
export function buildLayerMgrRepairJobCompat(
  job: RepairJob,
): ShieldLayerMgrRepairJobCompat {
  return {
    jobId: job.jobId,
    layerId: job.layerId,
    amount: job.amount,
    ticksRemaining: job.ticksRemaining,
    delivered: job.delivered,
    source: job.source,
  };
}

/**
 * Compute which event name to use for the current tick's most significant event.
 */
export function resolveAdapterEventName(
  input: ShieldLayerMgrSignalInput,
  manager: ShieldLayerManager,
): ShieldLayerMgrAdapterEventName {
  if (
    input.newBreaches.includes('L4') &&
    input.phase === 'SOVEREIGNTY'
  ) {
    return 'shield_layer_manager.sovereignty_fatal_risk';
  }
  if (input.newBreaches.length > 0) {
    return 'shield_layer_manager.breach';
  }
  if (input.cascadeCrackLayers.length > 0) {
    return 'shield_layer_manager.cascade_crack';
  }
  if (manager.isFortified(input.layers)) {
    return 'shield_layer_manager.fortified';
  }
  const critical = findCriticalLayerIds(input.layers);
  if (critical.length > 0) {
    return 'shield_layer_manager.integrity_critical';
  }
  const low = findLowIntegrityLayerIds(input.layers);
  if (low.length > 0) {
    return 'shield_layer_manager.integrity_low';
  }
  const totalRepair = Object.values(input.repairApplied).reduce(
    (s, v) => s + v,
    0,
  );
  if (totalRepair > 0) {
    return 'shield_layer_manager.repair_delivered';
  }
  const ghostEcho = manager.computeGhostEchoRisk(input.layers, input.mode);
  if (ghostEcho >= 0.7) {
    return 'shield_layer_manager.ghost_echo_risk';
  }
  return 'shield_layer_manager.regen';
}

/**
 * Build the detail string for a chat signal from the current tick.
 */
export function buildAdapterDetailString(
  input: ShieldLayerMgrSignalInput,
  breachRisk: number,
  ghostEchoRisk: number,
  sovereigntyFatalRisk: number,
): string {
  const totalDamage = Object.values(input.damageApplied).reduce(
    (s, v) => s + v,
    0,
  );
  const totalRepair = Object.values(input.repairApplied).reduce(
    (s, v) => s + v,
    0,
  );
  const overallIntegrity = Math.round(computeWeightedIntegrity(input.layers) * 100);
  const severityLabel = classifyIncomingAttackSeverity(input.attacks);
  const threatUrgency = classifyMostUrgentThreat(input.threats, input.tick);
  const tensionFloor = computeModeTensionFloor(input.mode);
  const regenMultiplier = computeRegenMultiplier(input.mode, input.phase);
  const breachSensitivity = computeBreachSensitivity(input.mode, input.phase);
  const description = describeLayerManagerState(
    input.layers,
    input.mode,
    input.phase,
  );

  const parts: string[] = [
    description,
    `breach_risk=${Math.round(breachRisk * 100)}%`,
    `damage=${totalDamage} repair=${totalRepair}`,
    `attack_severity=${severityLabel}`,
    `threat_urgency=${threatUrgency}`,
    `tension_floor=${tensionFloor.toFixed(2)}`,
    `regen_multiplier=${regenMultiplier.toFixed(2)}`,
    `breach_sensitivity=${breachSensitivity.toFixed(2)}`,
    `overall_integrity=${overallIntegrity}%`,
  ];

  if (ghostEchoRisk > 0.1) {
    parts.push(`ghost_echo_risk=${Math.round(ghostEchoRisk * 100)}%`);
  }
  if (sovereigntyFatalRisk > 0.1) {
    parts.push(`sovereignty_fatal_risk=${Math.round(sovereigntyFatalRisk * 100)}%`);
  }
  if (input.routedAttacks.length > 0) {
    const doctrines = [
      ...new Set(input.routedAttacks.map((a) => inferDoctrineFromRoutedAttack(a))),
    ].join(',');
    parts.push(`doctrines=${doctrines}`);
  }

  return parts.join(' | ');
}

/**
 * Build the compat representation of layer manager exposure from a snapshot.
 */
export function buildLayerMgrExposureFromSnapshot(
  snapshot: RunStateSnapshot,
  manager: ShieldLayerManager,
  pressureTier: PressureTier,
): ShieldLayerMgrExposureProfile {
  const vulnerabilityMap = buildLayerVulnerabilityMap(snapshot.shield.layers);
  const criticalLayerIds = findCriticalLayerIds(snapshot.shield.layers);
  const lowLayerIds = findLowIntegrityLayerIds(snapshot.shield.layers);
  const overallBreachRisk = scoreOverallBreachRisk(snapshot.shield.layers);
  const ghostEchoRisk = manager.computeGhostEchoRisk(
    snapshot.shield.layers,
    snapshot.mode,
  );
  const sovereigntyFatalRisk = manager.computeSovereigntyFatalityRisk(
    snapshot.shield.layers,
    snapshot.phase,
    snapshot.mode,
  );
  const botThreatScore = 0; // snapshot doesn't carry bot states
  const narrativeWeight = buildLayerManagerNarrativeWeight(
    snapshot.shield.layers,
    snapshot.mode,
    snapshot.phase,
    pressureTier,
  );

  return {
    tick: snapshot.tick,
    overallBreachRisk,
    vulnerabilityMap,
    criticalLayerIds,
    lowLayerIds,
    ghostEchoRisk,
    sovereigntyFatalRisk,
    botThreatScore,
    repairUrgency: 0,
    narrativeWeight,
  };
}

/**
 * Compute the pressure risk score for the adapter's current context.
 * Delegates to ShieldLayerManager's computeLayerPressureRiskScore.
 */
export function computeAdapterPressureRisk(
  tier: PressureTier,
  pressureScore: number,
): number {
  return computeLayerPressureRiskScore(tier, pressureScore);
}

/**
 * Validate that an input has the required structure for processing.
 */
export function validateLayerMgrInput(
  input: ShieldLayerMgrSignalInput,
): { valid: boolean; reason: string | null } {
  if (input.layers.length === 0) {
    return { valid: false, reason: 'layers array is empty' };
  }
  const layerIds = new Set(input.layers.map((l) => l.layerId));
  for (const id of SHIELD_LAYER_ORDER) {
    if (!layerIds.has(id)) {
      return { valid: false, reason: `missing layer ${id}` };
    }
  }
  if (input.tick < 0) {
    return { valid: false, reason: `invalid tick ${input.tick}` };
  }
  return { valid: true, reason: null };
}

/**
 * Build a concise threshold report string for the adapter state.
 * Delegates to the pure helper from ShieldLayerManager.
 */
export function buildAdapterThresholdReport(
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
): string {
  return buildLayerManagerThresholdReport(layers, mode, phase);
}

/**
 * Build an ML compat object usable by cross-subsystem ML pipelines.
 * Delegates to buildLayerManagerMLCompat.
 */
export function buildAdapterMLCompat(
  vector: ShieldLayerManagerMLVector,
): ReturnType<typeof buildLayerManagerMLCompat> {
  return buildLayerManagerMLCompat(vector);
}

/**
 * Check whether any of the bot states in the input maps to a HaterBotId.
 * Used by the adapter to confirm bot threat is real (not spoofed IDs).
 */
export function validateBotStateMap(
  botStates: Readonly<Record<string, BotState>>,
): boolean {
  return Object.keys(botStates).every((id) => isHaterBotId(id));
}

/**
 * Compute the per-layer regen compat array for DL row construction.
 */
export function buildRegenAppliedFromLayers(
  layers: readonly ShieldLayerState[],
): Record<ShieldLayerId, number> {
  const result: Record<string, number> = {};
  for (const layer of layers) {
    result[layer.layerId] =
      layer.max > 0 ? computeNormalizedRegenCapacity(layer) * layer.max : 0;
  }
  return result as Record<ShieldLayerId, number>;
}

/**
 * Classify whether a layer at a given absorption priority is "exposed"
 * to inbound damage after higher-priority layers are bypassed.
 */
export function isLayerExposed(
  layerId: ShieldLayerId,
  layers: readonly ShieldLayerState[],
): boolean {
  const priority = getAbsorptionPriority(layerId);
  for (let i = 0; i < priority; i++) {
    const higherPriorityId = SHIELD_LAYER_ORDER[i];
    if (!higherPriorityId) continue;
    const higherLayer = layers.find((l) => l.layerId === higherPriorityId);
    if (higherLayer && !higherLayer.breached) return false;
  }
  return true;
}

/**
 * Build a RoutedAttack summary string for telemetry.
 */
export function buildRoutedAttackSummary(
  attacks: readonly RoutedAttack[],
): string {
  if (attacks.length === 0) return 'no routed attacks';
  const doctrines = [...new Set(attacks.map((a) => a.doctrineType as ShieldDoctrineAttackType))];
  const totalMagnitude = attacks.reduce((s, a) => s + a.magnitude, 0);
  return `${attacks.length} attacks | doctrines=[${doctrines.join(',')}] | total_magnitude=${totalMagnitude.toFixed(1)}`;
}

/**
 * Build the pending repair slice summary string.
 */
export function buildRepairSliceSummary(
  slices: readonly PendingRepairSlice[],
): string {
  if (slices.length === 0) return 'no pending repair slices';
  const completed = slices.filter((s) => s.completed).length;
  const total = slices.reduce((s, r) => s + r.amount, 0);
  return `${slices.length} slices | completed=${completed} | total_amount=${total.toFixed(1)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — ShieldLayerManagerSignalAdapter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The authoritative adapter that translates `ShieldLayerManager` state into
 * backend chat `ChatInputEnvelope` signals.
 *
 * Instantiates the full companion ensemble internally and exposes:
 * - `adapt()` — primary single-tick ingress
 * - `adaptFromSnapshot()` — snapshot-driven alternative
 * - `adaptBatch()` — multi-tick batch ingress
 * - `buildFullBundle()` — rich bundle for telemetry and ML pipelines
 * - `getState()` / `getReport()` — adapter diagnostics
 */
export class ShieldLayerManagerSignalAdapter {
  private readonly options: Required<ShieldLayerMgrAdapterOptions>;
  private readonly ensemble: ShieldLayerManagerEnsemble;

  // Deduplication state
  private lastBreachTicks: Record<ShieldLayerId, number> = {
    L1: -Infinity,
    L2: -Infinity,
    L3: -Infinity,
    L4: -Infinity,
  };
  private signalCount = 0;
  private rejectedCount = 0;
  private lastTick = -1;
  private lastSignalAt: UnixMs | null = null;
  private breachCount = 0;
  private cascadeCrackCount = 0;
  private totalRepairApplied = 0;
  private readonly history: ShieldLayerMgrAdapterHistoryEntry[] = [];

  constructor(options: ShieldLayerMgrAdapterOptions = {}) {
    this.options = {
      logger: options.logger ?? {
        debug: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
      clock: options.clock ?? { now: () => asUnixMs(Date.now()) },
      dedupeWindowTicks:
        options.dedupeWindowTicks ?? SHIELD_LAYER_MGR_ADAPTER_DEDUPE_WINDOW_TICKS,
      maxBatchSize:
        options.maxBatchSize ?? SHIELD_LAYER_MGR_ADAPTER_MAX_BATCH_SIZE,
      minDeltaThreshold:
        options.minDeltaThreshold ?? SHIELD_LAYER_MGR_ADAPTER_MIN_DELTA_THRESHOLD,
      suppressRegenSignals: options.suppressRegenSignals ?? true,
      alwaysSurfaceSovereigntyFatal:
        options.alwaysSurfaceSovereigntyFatal ?? true,
    };
    this.ensemble = createShieldLayerManagerWithAnalytics();
  }

  // ── Primary ingress ───────────────────────────────────────────────────────

  /**
   * Adapt a single tick's shield layer manager state into ChatInputEnvelopes.
   * Returns an artifact (accepted) or deduped (rejected) record.
   */
  public adapt(
    input: ShieldLayerMgrSignalInput,
  ): ShieldLayerMgrAdapterArtifact | ShieldLayerMgrAdapterDeduped {
    const { valid, reason } = validateLayerMgrInput(input);
    if (!valid) {
      this.rejectedCount++;
      return {
        accepted: false,
        reason: reason ?? 'invalid input',
        tick: input.tick,
        layerId: null,
      };
    }

    const sovereigntyFatalRisk = this.ensemble.manager.computeSovereigntyFatalityRisk(
      input.layers,
      input.phase,
      input.mode,
    );
    const isSovereigntyFatal =
      this.options.alwaysSurfaceSovereigntyFatal &&
      sovereigntyFatalRisk >= 0.8 &&
      input.newBreaches.includes('L4');

    const surface = shouldSurfaceTick(
      input,
      this.options.dedupeWindowTicks,
      this.lastBreachTicks,
      this.options.minDeltaThreshold,
      this.options.suppressRegenSignals,
    );

    if (!surface && !isSovereigntyFatal) {
      this.rejectedCount++;
      return {
        accepted: false,
        reason: 'below surface threshold',
        tick: input.tick,
        layerId: null,
      };
    }

    const bundle = this.buildFullBundle(input);
    const envelopes = this.buildEnvelopes(bundle, input);

    // Update deduplication state
    for (const layerId of input.newBreaches) {
      this.lastBreachTicks[layerId] = input.tick;
      this.breachCount++;
    }
    this.cascadeCrackCount += input.cascadeCrackLayers.length;
    this.totalRepairApplied += Object.values(input.repairApplied).reduce(
      (s, v) => s + v,
      0,
    );
    this.signalCount++;
    this.lastTick = input.tick;
    this.lastSignalAt = this.options.clock.now();

    // Record to analytics
    this.ensemble.analytics.recordTick(
      input.layers,
      input.newBreaches,
      Object.values(input.repairApplied).reduce((s, v) => s + v, 0),
      Object.values(input.damageApplied).reduce((s, v) => s + v, 0),
      input.cascadeCrackLayers.length,
    );

    // Push to trend analyzer
    const historyEntry: ShieldLayerManagerHistoryEntry = {
      tick: input.tick,
      layers: input.layers,
      overallIntegrity: computeWeightedIntegrity(input.layers),
      breachedCount: input.layers.filter((l) => l.breached).length,
      repairApplied: Object.values(input.repairApplied).reduce((s, v) => s + v, 0),
      damageApplied: Object.values(input.damageApplied).reduce((s, v) => s + v, 0),
      cascadeCracks: input.cascadeCrackLayers.length,
    };
    this.ensemble.trendAnalyzer.pushEntry(historyEntry);
    this.ensemble.inspector.setHistoryDepth(this.history.length);

    // Record to adapter history
    const historyRec: ShieldLayerMgrAdapterHistoryEntry = {
      tick: input.tick,
      eventName: bundle.signal.eventName,
      layerId: bundle.signal.layerId,
      severity: bundle.signal.severity,
      narrativeWeight: bundle.signal.narrativeWeight,
    };
    this.history.push(historyRec);
    if (this.history.length > SHIELD_LAYER_MGR_ADAPTER_HISTORY_DEPTH) {
      this.history.shift();
    }

    return {
      accepted: true,
      signal: bundle.signal,
      envelopes,
      tick: input.tick,
    };
  }

  /**
   * Adapt directly from a RunStateSnapshot. Minimal mode — no prior-layer delta.
   */
  public adaptFromSnapshot(
    snapshot: RunStateSnapshot,
    pressureTier: PressureTier,
    newBreaches: readonly ShieldLayerId[],
    cascadeCrackLayers: readonly ShieldLayerId[],
    repairApplied: Readonly<Record<ShieldLayerId, number>>,
    damageApplied: Readonly<Record<ShieldLayerId, number>>,
    attacks: readonly AttackEvent[],
    threats: readonly ThreatEnvelope[],
    botStates: Readonly<Record<HaterBotId, BotState>>,
  ): ShieldLayerMgrAdapterArtifact | ShieldLayerMgrAdapterDeduped {
    const emptyRecord: Record<ShieldLayerId, number> = {
      L1: 0,
      L2: 0,
      L3: 0,
      L4: 0,
    };
    const regenApplied = buildRegenAppliedFromLayers(snapshot.shield.layers);

    const input: ShieldLayerMgrSignalInput = {
      tick: snapshot.tick,
      layers: snapshot.shield.layers,
      previousLayers: null,
      mode: snapshot.mode,
      phase: snapshot.phase,
      pressureTier,
      newBreaches,
      cascadeCrackLayers,
      repairApplied: repairApplied ?? emptyRecord,
      regenApplied,
      damageApplied: damageApplied ?? emptyRecord,
      attacks,
      threats,
      botStates,
      routedAttacks: [],
      repairSlices: [],
      activeRepairJobs: [],
      damageResolutions: [],
      cascadeResolution: null,
      runId: snapshot.runId ?? 'unknown',
    };

    return this.adapt(input);
  }

  /**
   * Adapt a batch of ticks. Respects maxBatchSize option.
   */
  public adaptBatch(
    batchInput: ShieldLayerMgrSignalBatchInput,
  ): Array<ShieldLayerMgrAdapterArtifact | ShieldLayerMgrAdapterDeduped> {
    const ticks = batchInput.ticks.slice(
      0,
      this.options.maxBatchSize,
    );
    return ticks.map((tick) => this.adapt(tick));
  }

  // ── Full bundle construction ─────────────────────────────────────────────

  /**
   * Build a full ShieldLayerMgrAdapterBundle for one tick.
   * Includes signal, ML vector, DL tensor, UX hint, annotation, inspector, forecast, trend.
   */
  public buildFullBundle(
    input: ShieldLayerMgrSignalInput,
  ): ShieldLayerMgrAdapterBundle {
    const { manager, mlExtractor, dlBuilder, trendAnalyzer, resilienceForecaster, annotator, inspector } =
      this.ensemble;

    // Compute derived metrics
    const breachRisk = scoreOverallBreachRisk(input.layers);
    const ghostEchoRisk = manager.computeGhostEchoRisk(input.layers, input.mode);
    const sovereigntyFatalRisk = manager.computeSovereigntyFatalityRisk(
      input.layers,
      input.phase,
      input.mode,
    );
    const narrativeWeight = buildLayerManagerNarrativeWeight(
      input.layers,
      input.mode,
      input.phase,
      input.pressureTier,
    );

    // ML vector
    const mlVector = mlExtractor.extractVector({
      layers: input.layers,
      mode: input.mode,
      phase: input.phase,
      breachCount: this.breachCount,
      cascadeCrackCount: this.cascadeCrackCount,
      repairApplied: this.totalRepairApplied,
    });

    // DL tensor
    const dlRowParams: ShieldLayerManagerDLRowParams = {
      tick: input.tick,
      layers: input.layers,
      previousLayers: input.previousLayers,
      regenApplied: input.regenApplied,
      damageApplied: input.damageApplied,
      repairApplied: input.repairApplied,
      breachEvents: input.newBreaches,
      cascadeCrackEvents: input.cascadeCrackLayers,
    };
    dlBuilder.buildAndPush(dlRowParams);
    const dlTensor = dlBuilder.getTensor();

    // ML params for consistency
    const mlParams: ShieldLayerManagerMLParams = {
      layers: input.layers,
      mode: input.mode,
      phase: input.phase,
      breachCount: this.breachCount,
      cascadeCrackCount: this.cascadeCrackCount,
      repairApplied: this.totalRepairApplied,
    };
    // Ensure mlParams is used (consistent validation)
    void mlParams;

    // Trend summary
    const trendSummary = trendAnalyzer.computeSummary(input.tick);

    // Resilience forecast
    const forecast = resilienceForecaster.forecastAll(
      input.layers,
      input.mode,
      input.phase,
      input.tick,
    );

    // Annotation bundle
    const breachAnnotations = input.newBreaches.map((layerId) => {
      const prevLayer = input.previousLayers?.find(
        (l) => l.layerId === layerId,
      );
      const currLayer = input.layers.find((l) => l.layerId === layerId);
      return annotator.annotateBreachEvent(
        layerId,
        input.tick,
        prevLayer?.integrityRatio ?? 0,
        currLayer?.integrityRatio ?? 0,
        input.attacks,
        input.mode,
        input.phase,
      );
    });

    const annotationBundle = annotator.buildAnnotationBundle(
      input.tick,
      input.layers,
      breachAnnotations,
      input.repairApplied,
      input.cascadeCrackLayers,
      SHIELD_LAYER_ORDER.filter((id) => {
        const layer = input.layers.find((l) => l.layerId === id);
        const regenAmt = input.regenApplied[id] ?? 0;
        return layer && !layer.breached && regenAmt > 0;
      }),
      input.mode,
      input.phase,
    );

    // UX hint
    const uxHint = annotator.buildUXHint(input.layers, input.mode, input.phase);

    // Inspector state
    const inspectorState = inspector.inspect(
      input.layers,
      input.mode,
      input.phase,
      input.tick,
      this.breachCount,
      this.cascadeCrackCount,
      this.totalRepairApplied,
    );

    // Event name and severity
    const eventName = resolveAdapterEventName(input, manager);
    const severity = classifyAdapterSeverity(
      breachRisk,
      input.newBreaches,
      input.phase === 'SOVEREIGNTY',
    );
    const headline = buildLayerManagerUXHeadline(
      input.layers,
      input.mode,
      input.phase,
    );
    const detail = buildAdapterDetailString(
      input,
      breachRisk,
      ghostEchoRisk,
      sovereigntyFatalRisk,
    );

    // Chat signal
    const signal = buildLayerMgrChatSignal(
      input,
      eventName,
      severity,
      headline,
      detail,
      mlVector,
      breachRisk,
      ghostEchoRisk,
      sovereigntyFatalRisk,
      narrativeWeight,
      this.options.clock,
    );

    // Compat wrappers
    const mlVectorCompat = buildLayerMgrMLVectorCompat(input.tick, mlVector);
    const dlTensorCompat = buildLayerMgrDLTensorCompat(dlTensor);
    const uxHintCompat = buildLayerMgrUXHintCompat(input.tick, uxHint);
    const annotationCompat = buildLayerMgrAnnotationCompat(
      input.tick,
      annotationBundle,
    );
    const thresholdReport = buildAdapterThresholdReport(
      input.layers,
      input.mode,
      input.phase,
    );

    return {
      tick: input.tick,
      signal,
      mlVector: mlVectorCompat,
      dlTensor: dlTensorCompat,
      uxHint: uxHintCompat,
      annotation: annotationCompat,
      inspectorState,
      forecast,
      trendSummary,
      thresholdReport,
    };
  }

  // ── Diagnostics ─────────────────────────────────────────────────────────

  public getState(): ShieldLayerMgrAdapterState {
    return {
      signalCount: this.signalCount,
      rejectedCount: this.rejectedCount,
      lastTick: this.lastTick,
      lastSignalAt: this.lastSignalAt,
      breachCount: this.breachCount,
      cascadeCrackCount: this.cascadeCrackCount,
      totalRepairApplied: this.totalRepairApplied,
      historyDepth: this.history.length,
    };
  }

  public getReport(): ShieldLayerMgrAdapterReport {
    return {
      state: this.getState(),
      analytics: this.ensemble.analytics.buildSummary(),
      sessionReport: null,
    };
  }

  public buildSessionReport(
    runId: string,
    finalTick: number,
    layers: readonly ShieldLayerState[],
    mode: ModeCode,
    phase: RunPhase,
  ): ShieldLayerMgrAdapterReport {
    const sessionReport = buildShieldLayerManagerSessionReport(
      runId,
      finalTick,
      layers,
      mode,
      phase,
      this.ensemble.analytics,
      this.ensemble.trendAnalyzer,
      this.ensemble.resilienceForecaster,
      this.ensemble.mlExtractor,
      this.breachCount,
      this.cascadeCrackCount,
      this.totalRepairApplied,
    );
    return {
      state: this.getState(),
      analytics: this.ensemble.analytics.buildSummary(),
      sessionReport,
    };
  }

  public reset(): void {
    this.lastBreachTicks = {
      L1: -Infinity,
      L2: -Infinity,
      L3: -Infinity,
      L4: -Infinity,
    };
    this.signalCount = 0;
    this.rejectedCount = 0;
    this.lastTick = -1;
    this.lastSignalAt = null;
    this.breachCount = 0;
    this.cascadeCrackCount = 0;
    this.totalRepairApplied = 0;
    this.history.length = 0;
    this.ensemble.dlBuilder.reset();
    this.ensemble.trendAnalyzer.reset();
    this.ensemble.analytics.reset();
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private buildEnvelopes(
    bundle: ShieldLayerMgrAdapterBundle,
    input: ShieldLayerMgrSignalInput,
  ): ChatInputEnvelope[] {
    const envelopes: ChatInputEnvelope[] = [];
    const channel = bundle.signal.channel as ChatVisibleChannel;

    // Primary shield layer manager signal
    const primary: ChatSignalEnvelope = {
      type: 'BATTLE',
      emittedAt: bundle.signal.emittedAt,
      roomId: input.roomId ?? null,
      metadata: {
        eventName: bundle.signal.eventName,
        channel,
        tick: bundle.signal.tick,
        runId: bundle.signal.runId,
        severity: bundle.signal.severity,
        headline: bundle.signal.headline,
        detail: bundle.signal.detail,
        layerId: bundle.signal.layerId,
        overallIntegrity: clamp01(bundle.signal.overallIntegrity),
        breachRisk: clamp01(bundle.signal.breachRisk),
        ghostEchoRisk: clamp01(bundle.signal.ghostEchoRisk),
        sovereigntyFatalRisk: clamp01(bundle.signal.sovereigntyFatalRisk),
        mode: bundle.signal.mode,
        phase: bundle.signal.phase,
        pressureTier: bundle.signal.pressureTier,
        narrativeWeight: clamp01(bundle.signal.narrativeWeight),
        uxHint: bundle.uxHint.hint,
        thresholdReport: bundle.thresholdReport,
      } as unknown as Readonly<Record<string, JsonValue>>,
    };
    envelopes.push({ kind: 'BATTLE_SIGNAL', emittedAt: bundle.signal.emittedAt, payload: primary });

    // ML data envelope if above narrative threshold
    if (bundle.signal.narrativeWeight >= 0.3 && bundle.mlVector.valid) {
      const mlEnvelope: ChatSignalEnvelope = {
        type: 'BATTLE',
        emittedAt: bundle.signal.emittedAt,
        roomId: input.roomId ?? null,
        metadata: {
          eventName: 'shield_layer_manager.breach',
          channel: 'SHIELD_LOW',
          mlVector: bundle.mlVector.features,
          featureLabels: SHIELD_LAYER_MANAGER_ML_FEATURE_LABELS,
          dlSequenceLength: bundle.dlTensor.sequenceLength,
          tick: bundle.tick,
        } as unknown as Readonly<Record<string, JsonValue>>,
      };
      envelopes.push({ kind: 'BATTLE_SIGNAL', emittedAt: bundle.signal.emittedAt, payload: mlEnvelope });
    }

    // UX annotation envelope for companion display
    if (bundle.annotation.bundle.breaches.length > 0) {
      const annotEnvelope: ChatSignalEnvelope = {
        type: 'BATTLE',
        emittedAt: bundle.signal.emittedAt,
        roomId: input.roomId ?? null,
        metadata: {
          eventName: 'shield_layer_manager.breach',
          channel,
          overallHeadline: bundle.annotation.overallHeadline,
          uxSummary: bundle.annotation.uxSummary,
          breachCount: bundle.annotation.bundle.breaches.length,
          repairEventCount: bundle.annotation.bundle.repairEvents.length,
          crackCount: bundle.annotation.bundle.cascadeCrackEvents.length,
        } as unknown as Readonly<Record<string, JsonValue>>,
      };
      envelopes.push({ kind: 'BATTLE_SIGNAL', emittedAt: bundle.signal.emittedAt, payload: annotEnvelope });
    }

    return envelopes;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — Factory functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new ShieldLayerManagerSignalAdapter with default options.
 */
export function createShieldLayerManagerSignalAdapter(
  options: ShieldLayerMgrAdapterOptions = {},
): ShieldLayerManagerSignalAdapter {
  return new ShieldLayerManagerSignalAdapter(options);
}

/**
 * Build a one-shot adapter bundle without maintaining adapter state.
 * Useful for server-side telemetry snapshots.
 */
export function buildShieldLayerMgrAdapterBundle(
  input: ShieldLayerMgrSignalInput,
  options: ShieldLayerMgrAdapterOptions = {},
): ShieldLayerMgrAdapterBundle {
  const adapter = createShieldLayerManagerSignalAdapter(options);
  return adapter.buildFullBundle(input);
}

/**
 * Build an adapter bundle directly from a RunStateSnapshot.
 */
export function buildShieldLayerMgrAdapterBundleFromSnapshot(
  snapshot: RunStateSnapshot,
  pressureTier: PressureTier,
  attacks: readonly AttackEvent[],
  threats: readonly ThreatEnvelope[],
  botStates: Readonly<Record<HaterBotId, BotState>>,
  options: ShieldLayerMgrAdapterOptions = {},
): ShieldLayerMgrAdapterBundle {
  const emptyRecord: Record<ShieldLayerId, number> = {
    L1: 0,
    L2: 0,
    L3: 0,
    L4: 0,
  };
  const regenApplied = buildRegenAppliedFromLayers(snapshot.shield.layers);
  const input: ShieldLayerMgrSignalInput = {
    tick: snapshot.tick,
    layers: snapshot.shield.layers,
    previousLayers: null,
    mode: snapshot.mode,
    phase: snapshot.phase,
    pressureTier,
    newBreaches: [],
    cascadeCrackLayers: [],
    repairApplied: emptyRecord,
    regenApplied,
    damageApplied: emptyRecord,
    attacks,
    threats,
    botStates,
    routedAttacks: [],
    repairSlices: [],
    activeRepairJobs: [],
    damageResolutions: [],
    cascadeResolution: null,
    runId: snapshot.runId ?? 'snapshot',
  };
  const adapter = createShieldLayerManagerSignalAdapter(options);
  return adapter.buildFullBundle(input);
}

/**
 * Extract the ML vector directly from a snapshot.
 */
export function extractShieldLayerMgrMLVector(
  snapshot: RunStateSnapshot,
  breachCount: number,
  cascadeCrackCount: number,
  repairApplied: number,
): ShieldLayerMgrMLVectorCompat {
  const extractor = new ShieldLayerManagerMLExtractor();
  const vector = extractor.extractFromSnapshot(
    snapshot,
    breachCount,
    cascadeCrackCount,
    repairApplied,
  );
  return buildLayerMgrMLVectorCompat(snapshot.tick, vector);
}

/**
 * Score the overall breach risk from a snapshot.
 */
export function scoreShieldLayerMgrRisk(
  snapshot: RunStateSnapshot,
): number {
  return scoreOverallBreachRisk(snapshot.shield.layers);
}

/**
 * Get the chat channel recommendation for a snapshot.
 */
export function getShieldLayerMgrChatChannel(
  snapshot: RunStateSnapshot,
): ShieldLayerMgrAdapterChannelRecommendation {
  const risk = scoreOverallBreachRisk(snapshot.shield.layers);
  return getLayerManagerChatChannel(risk) as ShieldLayerMgrAdapterChannelRecommendation;
}

/**
 * Build the narrative weight for a snapshot.
 */
export function buildShieldLayerMgrNarrativeWeight(
  snapshot: RunStateSnapshot,
  pressureTier: PressureTier,
): ShieldLayerMgrAdapterNarrativeWeight {
  const score = buildLayerManagerNarrativeWeight(
    snapshot.shield.layers,
    snapshot.mode,
    snapshot.phase,
    pressureTier,
  );
  return buildAdapterNarrativeWeight(score);
}

/**
 * Build the threshold report string for a snapshot.
 */
export function buildShieldLayerMgrThresholdReport(
  snapshot: RunStateSnapshot,
): string {
  return buildLayerManagerThresholdReport(
    snapshot.shield.layers,
    snapshot.mode,
    snapshot.phase,
  );
}

/**
 * Build the exposure profile from a snapshot.
 */
export function buildShieldLayerMgrExposureProfile(
  snapshot: RunStateSnapshot,
  pressureTier: PressureTier,
): ShieldLayerMgrExposureProfile {
  const manager = new ShieldLayerManager();
  return buildLayerMgrExposureFromSnapshot(snapshot, manager, pressureTier);
}

/**
 * Build posture snapshot from a RunStateSnapshot.
 */
export function buildShieldLayerMgrPostureSnapshot(
  snapshot: RunStateSnapshot,
): ShieldLayerMgrPostureSnapshot {
  const manager = new ShieldLayerManager();
  return buildLayerMgrPostureSnapshot(snapshot.tick, snapshot.shield.layers, manager);
}

/**
 * Check whether the isEndgamePhase flag is active.
 * Useful for adapter-level downstream decisions without importing GamePrimitives.
 */
export function isShieldLayerMgrEndgamePhase(phase: RunPhase): boolean {
  return isEndgamePhase(phase);
}

/**
 * Build a session report bundle from an adapter instance.
 */
export function buildShieldLayerMgrSessionReport(
  adapter: ShieldLayerManagerSignalAdapter,
  runId: string,
  finalTick: number,
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
): ShieldLayerMgrAdapterReport {
  return adapter.buildSessionReport(runId, finalTick, layers, mode, phase);
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — SHIELD_LAYER_MGR_ADAPTER_MANIFEST
// ─────────────────────────────────────────────────────────────────────────────

export const SHIELD_LAYER_MGR_ADAPTER_MANIFEST = Object.freeze({
  module: 'ShieldLayerManagerSignalAdapter',
  version: SHIELD_LAYER_MGR_ADAPTER_VERSION,
  layerManagerManifest: SHIELD_LAYER_MANAGER_MANIFEST,
  mlFeatureCount: SHIELD_LAYER_MGR_ADAPTER_ML_FEATURE_COUNT,
  dlFeatureCount: SHIELD_LAYER_MGR_ADAPTER_DL_FEATURE_COUNT,
  dlSequenceLength: SHIELD_LAYER_MGR_ADAPTER_DL_SEQUENCE_LENGTH,
  dedupeWindowTicks: SHIELD_LAYER_MGR_ADAPTER_DEDUPE_WINDOW_TICKS,
  maxBatchSize: SHIELD_LAYER_MGR_ADAPTER_MAX_BATCH_SIZE,
  historyDepth: SHIELD_LAYER_MGR_ADAPTER_HISTORY_DEPTH,
  trendWindow: SHIELD_LAYER_MGR_ADAPTER_TREND_WINDOW,
  forecastMaxHorizon: SHIELD_LAYER_MGR_ADAPTER_FORECAST_MAX_HORIZON,
  eventNames: SHIELD_LAYER_MGR_ADAPTER_EVENT_NAMES,
  layerManagerReady: SHIELD_LAYER_MANAGER_READY,
  chatAdapterDomain: 'SHIELD_LAYER_MANAGER',
  ownsTruth: false,
  description:
    'Translates ShieldLayerManager per-tick state — layer integrity changes, ' +
    'breach events, cascade cracks, repair deliveries, regen ticks, ghost echo risk, ' +
    'and sovereignty fatality risk — into authoritative backend chat shield-layer signals. ' +
    'Produces 32-feature ML vectors, 40×6 DL tensors, annotation bundles, UX hints, ' +
    'resilience forecasts, and trend summaries for the chat lane and ML pipeline.',
});

// Re-export all ShieldLayerManager types so consumers can import from this adapter
export type {
  ShieldLayerManagerMLVector,
  ShieldLayerManagerDLRow,
  ShieldLayerManagerDLTensor,
  ShieldLayerManagerLayerTrend,
  ShieldLayerManagerTrendSummary,
  ShieldLayerManagerLayerForecast,
  ShieldLayerManagerResilienceForecast,
  ShieldLayerManagerBreachAnnotation,
  ShieldLayerManagerAnnotationBundle,
  ShieldLayerManagerUXHint,
  ShieldLayerManagerHistoryEntry,
  ShieldLayerManagerInspectorState,
  ShieldLayerManagerAnalyticsSummary,
  ShieldLayerManagerEnsemble,
  ShieldLayerManagerMLParams,
  ShieldLayerManagerDLRowParams,
  ShieldLayerManagerSessionReport,
};

// Re-export shield types used by cross-subsystem consumers
export type {
  CascadeResolution,
  DamageResolution,
  PendingRepairSlice,
  RepairJob,
  RepairLayerId,
  RoutedAttack,
  ShieldDoctrineAttackType,
  ShieldLayerConfig,
};
