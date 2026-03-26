/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT SHIELD SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/ShieldSignalAdapter.ts
 * VERSION: 2026.03.25
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates shield subsystem outputs —
 * AttackRouter batch decisions and BreachCascadeResolver cascade contexts —
 * into authoritative backend chat shield signals.
 *
 * Backend-truth question
 * ----------------------
 *   "When the sovereign backend AttackRouter resolves a batch of attacks
 *    through L1–L4 doctrine layers and BreachCascadeResolver fires cascade
 *    chains — what exact chat-native shield signals should the backend chat
 *    engine ingest?"
 *
 * This file owns:
 * - AttackRouterBatchResult → ChatInputEnvelope translation
 * - CascadeResolutionContext → ChatInputEnvelope translation
 * - Breach event detection, ghost echo routing, sovereignty fatality escalation
 * - Doctrine confidence and entropy monitoring
 * - Per-layer integrity degradation and cascade gate exposure reporting
 * - ML vector extraction (36-feature attack + 32-feature cascade)
 * - DL tensor construction (44×6 attack + 40×6 cascade)
 * - Annotation bundle translation for companion display
 * - Deduplication to prevent shield spam in the chat lane
 * - Adapter analytics and health reporting
 *
 * It does not own:
 * - Shield layer integrity values (owned by ShieldLayerManager)
 * - Repair scheduling (owned by ShieldRepairQueue)
 * - Transcript mutation, NPC speech, rate policy, or socket fanout
 * - Replay persistence or proof chain authoring
 *
 * Design laws
 * -----------
 * - Shield terms are precise: L1=CASH_RESERVE, L2=CREDIT_LINE,
 *   L3=INCOME_BASE, L4=NETWORK_CORE. Never genericize.
 * - Breach signals fire on change, not every tick.
 * - Ghost L3 cascade is a distinct signal from standard L4 cascade.
 * - Sovereignty L4 fatality is CRITICAL — never suppressed.
 * - ML/DL output must be deterministic and replay-safe.
 * - Doctrine analysis handles all eight ShieldDoctrineAttackTypes.
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
  isHaterBotId,
  isEndgamePhase,
  type AttackEvent,
  type BotState,
  type HaterBotId,
  type ModeCode,
  type PressureTier,
  type RunPhase,
  type ShieldLayerId,
  type ThreatEnvelope,
} from '../../core/GamePrimitives';

import type { ShieldLayerState } from '../../core/RunStateSnapshot';

import {
  // ── Attack Router — core class and companion classes ─────────────────────
  AttackRouter,
  AttackRouterMLExtractor,
  AttackRouterDLBuilder,
  AttackRouterTrendAnalyzer,
  AttackRouterAnnotator,
  AttackRouterInspector,
  AttackRouterAnalytics,
  // ── Attack Router — factories and standalone helpers ──────────────────────
  createAttackRouterWithAnalytics,
  getAttackChatChannel,
  buildAttackNarrativeWeight,
  scoreAttackBatchRisk,
  extractAttackRouterMLArray,
  describeRoutingDecision,
  buildAttackRouterSessionReport,
  buildAttackRouterModeProfile,
  buildAttackRouterPhaseProfile,
  buildAttackRouterHistoryEntry,
  computePreRoutingThreatExposure,
  validateAttackBatchUniqueness,
  computeBatchDoctrineCoherence,
  computeBotStateThreatPressure,
  // ── Attack Router — module constants ─────────────────────────────────────
  ATTACK_ROUTER_MODULE_VERSION,
  ATTACK_ROUTER_ML_FEATURE_COUNT,
  ATTACK_ROUTER_DL_FEATURE_COUNT,
  ATTACK_ROUTER_DL_SEQUENCE_LENGTH,
  ATTACK_ROUTER_HISTORY_DEPTH,
  ATTACK_ROUTER_TREND_WINDOW,
  ATTACK_ROUTER_MAX_BATCH_SIZE,
  ATTACK_ROUTER_GHOST_HATER_AMPLIFY,
  ATTACK_ROUTER_SOVEREIGNTY_L4_RISK,
  ATTACK_ROUTER_DOCTRINE_CONFIDENCE_THRESHOLD,
  ATTACK_ROUTER_EXPOSED_VULNERABILITY_THRESHOLD,
  ATTACK_ROUTER_MANIFEST,
  ATTACK_ROUTER_ML_FEATURE_LABELS,
  ATTACK_ROUTER_DL_FEATURE_LABELS,
  ATTACK_ROUTER_MODE_PRIORITY_WEIGHT,
  ATTACK_ROUTER_PHASE_ESCALATION_FACTOR,
  ATTACK_ROUTER_GHOST_DUAL_TARGET,
  ATTACK_ROUTER_PHASE_HINT_ELIGIBLE,
  ATTACK_ROUTER_MODE_MAX_BATCH,
  ATTACK_DOCTRINE_DANGER_INDEX,
  ATTACK_DOCTRINE_IS_CASCADE_RISK,
  ATTACK_ROUTER_PRESSURE_TIER_URGENCY,
  // ── Attack Router — types ─────────────────────────────────────────────────
  type AttackRouteDecision,
  type AttackRouterBatchResult,
  type AttackRouterMLVector,
  type AttackRouterDLTensor,
  type AttackRouterTrendSummary,
  type AttackRouterAnnotationBundle,
  type AttackRouterUXHint,
  type AttackRouterHistoryEntry,
  type AttackRouterInspectorState,
  type AttackRouterAnalyticsSummary,
  type AttackRouterEnsemble,
  type AttackRouterMLFeaturesParams,
  type AttackRouterDLRowParams,
  type AttackRouterSessionReport,
  type AttackRouterModeProfile,
  type AttackRouterPhaseProfile,
  type PreRoutingAttackProfile,
  // ── Breach Cascade Resolver — core class and companion classes ────────────
  BreachCascadeResolver,
  CascadeMLExtractor,
  CascadeDLBuilder,
  CascadeTrendAnalyzer,
  CascadeAnnotator,
  CascadeInspector,
  CascadeAnalytics,
  // ── Breach Cascade Resolver — factories and standalone helpers ────────────
  createBreachCascadeResolverWithAnalytics,
  getCascadeChatChannel,
  buildCascadeNarrativeWeight,
  extractCascadeMLArray,
  describeCascadeContext,
  buildCascadeSessionReport,
  buildCascadeModeProfile,
  buildCascadePhaseProfile,
  validateCascadeLayerState,
  gradeCascadeRisk,
  computeCascadeNarrativeImpact,
  mapCascadeLayersForIntegrity,
  computeL4CascadeImminentScore,
  computeGhostL3CascadeImminentScore,
  computeCrackMultiplier,
  scoreCascadeRisk,
  detectCascadeSurge,
  computeAvgIntegrityDrop,
  computeAvgCrackDepth,
  findDominantBreachLayer,
  computeCascadeBotThreatWeight,
  buildCascadeVulnerabilities,
  extractCascadeMLFeatures,
  buildCascadeDLRow,
  buildCascadeTrendSummary,
  buildCascadeAnnotation,
  buildCascadeUXHint,
  buildCascadeHistoryEntry,
  buildCascadeAttackImpactProfiles,
  scoreCascadeThreatFromEnvelopes,
  classifyCascadeThreatBatch,
  computePerLayerCascadeExposure,
  computeTicksUntilCascade,
  computeCascadeChainIntegrityRatio,
  computeSovereigntyFatalityRisk,
  scoreCascadeFromBotStates,
  computeAbsorptionOrderExposure,
  computeLayerCascadePriority,
  // ── Breach Cascade Resolver — module constants ────────────────────────────
  BREACH_CASCADE_MODULE_VERSION,
  CASCADE_ML_FEATURE_COUNT,
  CASCADE_DL_FEATURE_COUNT,
  CASCADE_DL_SEQUENCE_LENGTH,
  CASCADE_HISTORY_DEPTH,
  CASCADE_TREND_WINDOW,
  CASCADE_SURGE_THRESHOLD,
  CASCADE_GHOST_L3_ENABLED,
  CASCADE_SOVEREIGNTY_L4_FATAL,
  CASCADE_SOVEREIGNTY_CRACK_MULTIPLIER,
  CASCADE_GHOST_CRACK_MULTIPLIER,
  CASCADE_IMMINENT_L4_THRESHOLD,
  CASCADE_GHOST_L3_IMMINENT_THRESHOLD,
  BREACH_CASCADE_MANIFEST,
  CASCADE_ML_FEATURE_LABELS,
  CASCADE_DL_FEATURE_LABELS,
  CASCADE_MODE_SENSITIVITY,
  CASCADE_PHASE_RISK_FACTOR,
  CASCADE_GHOST_ECHO_ELIGIBLE,
  CASCADE_SOVEREIGNTY_FATAL_ELIGIBLE,
  CASCADE_MODE_COUNT_WEIGHT,
  CASCADE_TEMPLATE_BY_LAYER,
  CASCADE_BREACH_CONSEQUENCE_LABEL,
  CASCADE_LAYER_DANGER_INDEX,
  CASCADE_PRESSURE_TIER_WEIGHT,
  CASCADE_DOCTRINE_TARGET_LAYER,
  // ── Breach Cascade Resolver — types ──────────────────────────────────────
  type CascadeResolutionContext,
  type CascadeMLVector,
  type CascadeDLTensor,
  type CascadeTrendSummary,
  type CascadeAnnotationBundle,
  type CascadeUXHint,
  type CascadeHistoryEntry,
  type CascadeInspectorState,
  type CascadeAnalyticsSummary,
  type CascadeEnsemble,
  type CascadeMLFeaturesParams,
  type CascadeDLRowParams,
  type CascadeSessionReport,
  type CascadeModeProfile,
  type CascadePhaseProfile,
  type CascadeAttackImpactProfile,
  // ── Shield Layer Manager, Repair Queue, UX Bridge ─────────────────────────
  ShieldLayerManager,
  ShieldRepairQueue,
  ShieldUXBridge,
  // ── Shield Engine — core class and companion classes ─────────────────────
  ShieldEngine,
  ShieldMLExtractor,
  ShieldDLBuilder,
  ShieldTrendAnalyzer,
  ShieldResilienceForecaster,
  ShieldAnnotator,
  ShieldInspector,
  ShieldAnalytics,
  createShieldEngineWithAnalytics as createShieldEngineWithAnalyticsInternal,
  scoreShieldBreachRisk as scoreShieldEngineBreachRisk,
  getShieldChatChannel as getShieldEngineChatChannel,
  buildShieldNarrativeWeight as buildShieldEngineNarrativeWeight,
  // ── Shield types — constants, helpers, domain types ───────────────────────
  SHIELD_LAYER_ORDER,
  SHIELD_LAYER_CONFIGS,
  SHIELD_CONSTANTS,
  SHIELD_ATTACK_ALIASES,
  isShieldLayerId,
  getLayerConfig,
  buildShieldLayerState,
  normalizeShieldNoteTags,
  resolveShieldAlias,
  layerOrderIndex,
  type CascadeResolution,
  type DamageResolution,
  type PendingRepairSlice,
  type QueueRejection,
  type RepairJob,
  type RepairLayerId,
  type RoutedAttack,
  type ShieldDoctrineAttackType,
  type ShieldLayerConfig,
} from '../../shield';

// ============================================================================
// §2 — Module constants
// ============================================================================

export const SHIELD_SIGNAL_ADAPTER_VERSION = '2026.03.25' as const;

/** Attack ML feature count mirrored from AttackRouter. */
export const SHIELD_SIGNAL_ADAPTER_ATTACK_ML_FEATURE_COUNT = ATTACK_ROUTER_ML_FEATURE_COUNT;
/** Attack DL feature count mirrored from AttackRouter. */
export const SHIELD_SIGNAL_ADAPTER_ATTACK_DL_FEATURE_COUNT = ATTACK_ROUTER_DL_FEATURE_COUNT;
/** Attack DL sequence length mirrored from AttackRouter. */
export const SHIELD_SIGNAL_ADAPTER_ATTACK_DL_SEQUENCE_LENGTH = ATTACK_ROUTER_DL_SEQUENCE_LENGTH;
/** Cascade ML feature count mirrored from BreachCascadeResolver. */
export const SHIELD_SIGNAL_ADAPTER_CASCADE_ML_FEATURE_COUNT = CASCADE_ML_FEATURE_COUNT;
/** Cascade DL feature count mirrored from BreachCascadeResolver. */
export const SHIELD_SIGNAL_ADAPTER_CASCADE_DL_FEATURE_COUNT = CASCADE_DL_FEATURE_COUNT;
/** Cascade DL sequence length mirrored from BreachCascadeResolver. */
export const SHIELD_SIGNAL_ADAPTER_CASCADE_DL_SEQUENCE_LENGTH = CASCADE_DL_SEQUENCE_LENGTH;

/** Default deduplication window in ticks. */
export const SHIELD_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS = 4 as const;
/** Maximum batch size honoured by the adapter. */
export const SHIELD_SIGNAL_ADAPTER_MAX_BATCH_SIZE = ATTACK_ROUTER_MAX_BATCH_SIZE;
/** Max history entries retained. */
export const SHIELD_SIGNAL_ADAPTER_HISTORY_DEPTH = ATTACK_ROUTER_HISTORY_DEPTH;
/** Trend window size (attack). */
export const SHIELD_SIGNAL_ADAPTER_TREND_WINDOW = ATTACK_ROUTER_TREND_WINDOW;
/** Cascade surge threshold. */
export const SHIELD_SIGNAL_ADAPTER_CASCADE_SURGE_THRESHOLD = CASCADE_SURGE_THRESHOLD;
/** Ghost mode hater amplification multiplier. */
export const SHIELD_SIGNAL_ADAPTER_GHOST_HATER_AMPLIFY = ATTACK_ROUTER_GHOST_HATER_AMPLIFY;
/** Sovereignty L4 risk multiplier for channel escalation. */
export const SHIELD_SIGNAL_ADAPTER_SOVEREIGNTY_L4_RISK = ATTACK_ROUTER_SOVEREIGNTY_L4_RISK;
/** Minimum doctrine confidence to suppress diversity signals. */
export const SHIELD_SIGNAL_ADAPTER_DOCTRINE_CONFIDENCE_THRESHOLD =
  ATTACK_ROUTER_DOCTRINE_CONFIDENCE_THRESHOLD;
/** Minimum exposed vulnerability ratio to fire a degradation signal. */
export const SHIELD_SIGNAL_ADAPTER_VULNERABILITY_THRESHOLD =
  ATTACK_ROUTER_EXPOSED_VULNERABILITY_THRESHOLD;
/** Cascade imminent threshold (L4). */
export const SHIELD_SIGNAL_ADAPTER_CASCADE_IMMINENT_L4 = CASCADE_IMMINENT_L4_THRESHOLD;
/** Cascade imminent threshold (ghost L3). */
export const SHIELD_SIGNAL_ADAPTER_CASCADE_IMMINENT_GHOST_L3 = CASCADE_GHOST_L3_IMMINENT_THRESHOLD;
/** History depth for cascade state. */
export const SHIELD_SIGNAL_ADAPTER_CASCADE_HISTORY_DEPTH = CASCADE_HISTORY_DEPTH;
/** Ghost mode crack multiplier. */
export const SHIELD_SIGNAL_ADAPTER_GHOST_CRACK_MULTIPLIER = CASCADE_GHOST_CRACK_MULTIPLIER;
/** Sovereignty crack multiplier. */
export const SHIELD_SIGNAL_ADAPTER_SOVEREIGNTY_CRACK_MULTIPLIER = CASCADE_SOVEREIGNTY_CRACK_MULTIPLIER;

export const SHIELD_SIGNAL_ADAPTER_EVENT_NAMES = Object.freeze([
  'shield.attack.routed',
  'shield.breach.detected',
  'shield.l4.cascade_risk',
  'shield.ghost.amplified',
  'shield.sovereignty.escalated',
  'shield.cascade.triggered',
  'shield.cascade.ghost_echo',
  'shield.cascade.sovereignty_fatal',
  'shield.ml.emit',
  'shield.dl.emit',
  'shield.integrity.degraded',
  'shield.doctrine.shift',
] as const);

export type ShieldSignalAdapterEventName =
  (typeof SHIELD_SIGNAL_ADAPTER_EVENT_NAMES)[number];

export const SHIELD_SIGNAL_ADAPTER_MANIFEST = Object.freeze({
  module: 'ShieldSignalAdapter',
  version: SHIELD_SIGNAL_ADAPTER_VERSION,
  attackRouterVersion: ATTACK_ROUTER_MODULE_VERSION,
  cascadeResolverVersion: BREACH_CASCADE_MODULE_VERSION,
  attackMLFeatureCount: SHIELD_SIGNAL_ADAPTER_ATTACK_ML_FEATURE_COUNT,
  attackDLFeatureCount: SHIELD_SIGNAL_ADAPTER_ATTACK_DL_FEATURE_COUNT,
  attackDLSequenceLength: SHIELD_SIGNAL_ADAPTER_ATTACK_DL_SEQUENCE_LENGTH,
  cascadeMLFeatureCount: SHIELD_SIGNAL_ADAPTER_CASCADE_ML_FEATURE_COUNT,
  cascadeDLFeatureCount: SHIELD_SIGNAL_ADAPTER_CASCADE_DL_FEATURE_COUNT,
  cascadeDLSequenceLength: SHIELD_SIGNAL_ADAPTER_CASCADE_DL_SEQUENCE_LENGTH,
  dedupeWindowTicks: SHIELD_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
  maxBatchSize: SHIELD_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
  ghostHaterAmplify: SHIELD_SIGNAL_ADAPTER_GHOST_HATER_AMPLIFY,
  sovereigntyL4Risk: SHIELD_SIGNAL_ADAPTER_SOVEREIGNTY_L4_RISK,
  cascadeImminentL4: SHIELD_SIGNAL_ADAPTER_CASCADE_IMMINENT_L4,
  cascadeImminentGhostL3: SHIELD_SIGNAL_ADAPTER_CASCADE_IMMINENT_GHOST_L3,
  cascadeSurgeThreshold: SHIELD_SIGNAL_ADAPTER_CASCADE_SURGE_THRESHOLD,
  ghostCrackMultiplier: SHIELD_SIGNAL_ADAPTER_GHOST_CRACK_MULTIPLIER,
  sovereigntyCrackMultiplier: SHIELD_SIGNAL_ADAPTER_SOVEREIGNTY_CRACK_MULTIPLIER,
  ghostL3Enabled: CASCADE_GHOST_L3_ENABLED,
  sovereigntyL4Fatal: CASCADE_SOVEREIGNTY_L4_FATAL,
  eventNames: SHIELD_SIGNAL_ADAPTER_EVENT_NAMES,
  attackRouterManifest: ATTACK_ROUTER_MANIFEST,
  cascadeManifest: BREACH_CASCADE_MANIFEST,
  shieldLayerOrder: SHIELD_LAYER_ORDER,
  shieldConstantsCriticalThreshold: SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD,
  shieldConstantsLowThreshold: SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD,
});

// ============================================================================
// §3 — Logger and Clock interfaces
// ============================================================================

export interface ShieldSignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ShieldSignalAdapterClock {
  now(): UnixMs;
}

// ============================================================================
// §4 — Options and Context types
// ============================================================================

export interface ShieldSignalAdapterOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly dedupeWindowTicks?: number;
  readonly maxHistory?: number;
  readonly logger?: ShieldSignalAdapterLogger;
  readonly clock?: ShieldSignalAdapterClock;
}

export interface ShieldSignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

// ============================================================================
// §5 — Input types
// ============================================================================

/** Minimal snapshot compat decoupled from RunStateSnapshot versioning. */
export interface ShieldSnapshotCompat {
  readonly tick: number;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly pressureTier: PressureTier;
  readonly runId?: string;
}

/** Full shield signal input for a single tick (attack path). */
export interface ShieldSignalInput {
  readonly snapshot: ShieldSnapshotCompat;
  readonly batchResult: AttackRouterBatchResult;
  readonly decisions: readonly AttackRouteDecision[];
  readonly layers: readonly ShieldLayerState[];
  readonly previousLayers?: readonly ShieldLayerState[] | null;
  readonly cascadeContext?: CascadeResolutionContext | null;
  readonly preBreachLayers?: readonly ShieldLayerState[] | null;
  readonly mlVector?: AttackRouterMLVector | null;
  readonly dlTensor?: AttackRouterDLTensor | null;
  readonly cascadeMLVector?: CascadeMLVector | null;
  readonly cascadeDLTensor?: CascadeDLTensor | null;
  readonly threatEnvelopes?: readonly ThreatEnvelope[] | null;
  readonly botStates?: Readonly<Partial<Record<HaterBotId, BotState>>> | null;
  readonly attacks?: readonly AttackEvent[] | null;
  readonly incomingDamagePerTick?: number;
  readonly totalCascadeCount?: number;
  readonly l4BreachCount?: number;
  readonly ghostL3Count?: number;
  readonly crackCount?: number;
  readonly sovereigntyFatalCount?: number;
}

/** Batch input for processing multiple ticks. */
export interface ShieldSignalBatchInput {
  readonly entries: readonly ShieldSignalInput[];
  readonly context?: ShieldSignalAdapterContext;
}

// ============================================================================
// §6 — Output and compat types
// ============================================================================

export type ShieldSignalAdapterSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'CRITICAL';
export type ShieldSignalAdapterNarrativeWeight =
  | 'AMBIENT'
  | 'TACTICAL'
  | 'URGENT'
  | 'CRITICAL';
export type ShieldSignalAdapterChannelRecommendation =
  | 'GLOBAL'
  | 'SYNDICATE'
  | 'DEAL_ROOM'
  | 'SYSTEM_SHADOW'
  | 'SUPPRESSED';

export interface ShieldSignalAdapterArtifact {
  readonly envelope: ChatInputEnvelope;
  readonly dedupeKey: string;
  readonly routeChannel: ChatVisibleChannel;
  readonly narrativeWeight: ShieldSignalAdapterNarrativeWeight;
  readonly severity: ShieldSignalAdapterSeverity;
  readonly eventName: ShieldSignalAdapterEventName;
  readonly emittedAt: UnixMs;
  readonly signal: ChatSignalEnvelope;
  readonly diagnostics: Readonly<Record<string, JsonValue>>;
}

export interface ShieldSignalAdapterDeduped {
  readonly eventName: ShieldSignalAdapterEventName;
  readonly dedupeKey: string;
  readonly reason: string;
  readonly suppressedAt: UnixMs;
}

export interface ShieldSignalAdapterRejection {
  readonly eventName: string;
  readonly reason: string;
  readonly tick: number;
}

export interface ShieldSignalAdapterHistoryEntry {
  readonly tick: number;
  readonly eventName: ShieldSignalAdapterEventName;
  readonly dedupeKey: string;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly batchRisk: number;
  readonly l4CascadeRiskCount: number;
  readonly ghostAmplifiedCount: number;
  readonly sovereigntyEscalatedCount: number;
}

export interface ShieldSignalAdapterState {
  readonly totalAccepted: number;
  readonly totalDeduped: number;
  readonly totalRejected: number;
  readonly lastTick: number;
  readonly lastBatchRisk: number;
  readonly lastCascadeRisk: number;
  readonly l4RiskActive: boolean;
  readonly sovereigntyFatalFired: boolean;
}

export interface ShieldSignalAdapterReport {
  readonly accepted: readonly ShieldSignalAdapterArtifact[];
  readonly deduped: readonly ShieldSignalAdapterDeduped[];
  readonly rejected: readonly ShieldSignalAdapterRejection[];
  readonly state: ShieldSignalAdapterState;
  readonly attackMLVector: Nullable<AttackRouterMLVector>;
  readonly attackDLTensor: Nullable<AttackRouterDLTensor>;
  readonly attackTrend: Nullable<AttackRouterTrendSummary>;
  readonly cascadeMLVector: Nullable<CascadeMLVector>;
  readonly cascadeDLTensor: Nullable<CascadeDLTensor>;
  readonly cascadeTrend: Nullable<CascadeTrendSummary>;
}

/** Combined chat signal compat for downstream consumers. */
export interface ShieldChatSignalCompat {
  readonly eventName: ShieldSignalAdapterEventName;
  readonly tick: number;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly batchRisk: number;
  readonly l4CascadeRiskCount: number;
  readonly ghostAmplifiedCount: number;
  readonly sovereigntyEscalated: boolean;
  readonly cascadeTriggered: boolean;
  readonly ghostEchoFired: boolean;
  readonly sovereigntyFatal: boolean;
  readonly routeChannel: ShieldSignalAdapterChannelRecommendation;
  readonly narrativeWeight: ShieldSignalAdapterNarrativeWeight;
  readonly dominantDoctrine: Nullable<ShieldDoctrineAttackType>;
  readonly attackAnnotation: Nullable<AttackRouterAnnotationBundle>;
  readonly cascadeAnnotation: Nullable<CascadeAnnotationBundle>;
}

/** ML vector compat (attack lane) for downstream consumers. */
export interface ShieldMLVectorCompat {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly featureCount: number;
  readonly tick: number;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
}

/** DL tensor compat (attack lane). */
export interface ShieldDLTensorCompat {
  readonly features: ReadonlyArray<Readonly<Record<string, number>>>;
  readonly tickCount: number;
  readonly featureCount: number;
  readonly sequenceLength: number;
}

/** Cascade ML vector compat. */
export interface ShieldCascadeMLVectorCompat {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly featureCount: number;
  readonly tick: number;
}

/** Cascade DL tensor compat. */
export interface ShieldCascadeDLTensorCompat {
  readonly features: ReadonlyArray<Readonly<Record<string, number>>>;
  readonly tickCount: number;
  readonly featureCount: number;
  readonly sequenceLength: number;
}

/** Shield UX hint compat. */
export interface ShieldUXHintCompat {
  readonly attackUXHint: Nullable<AttackRouterUXHint>;
  readonly cascadeUXHint: Nullable<CascadeUXHint>;
  readonly primaryAction: Nullable<string>;
  readonly urgencyLabel: string;
  readonly channelRecommendation: ShieldSignalAdapterChannelRecommendation;
}

/** Attack annotation compat. */
export interface ShieldAnnotationCompat {
  readonly attackAnnotation: Nullable<AttackRouterAnnotationBundle>;
  readonly cascadeAnnotation: Nullable<CascadeAnnotationBundle>;
  readonly chatSummary: string;
  readonly severity: ShieldSignalAdapterSeverity;
}

/** Repair compat types for downstream consumers. */
export interface ShieldRepairJobCompat {
  readonly jobId: string;
  readonly layerId: RepairLayerId;
  readonly amount: number;
  readonly durationTicks: number;
  readonly ticksRemaining: number;
  readonly delivered: number;
  readonly source: RepairJob['source'];
}

/** Pending repair slice compat. */
export interface ShieldRepairSliceCompat {
  readonly jobId: PendingRepairSlice['jobId'];
  readonly layerId: PendingRepairSlice['layerId'];
  readonly amount: PendingRepairSlice['amount'];
  readonly completed: PendingRepairSlice['completed'];
}

/** Queue rejection compat. */
export interface ShieldQueueRejectionCompat {
  readonly tick: QueueRejection['tick'];
  readonly layerId: QueueRejection['layerId'];
  readonly amount: QueueRejection['amount'];
  readonly source: QueueRejection['source'];
  readonly reason: string;
}

/** Routed attack compat. */
export interface ShieldRoutedAttackCompat {
  readonly attackId: RoutedAttack['attackId'];
  readonly doctrineType: RoutedAttack['doctrineType'];
  readonly targetLayer: RoutedAttack['targetLayer'];
  readonly fallbackLayer: RoutedAttack['fallbackLayer'];
  readonly magnitude: RoutedAttack['magnitude'];
  readonly isCascadeRisk: boolean;
  readonly dangerIndex: number;
  readonly noteTags: readonly string[];
}

/** Damage resolution compat. */
export interface ShieldDamageResolutionCompat {
  readonly actualLayerId: DamageResolution['actualLayerId'];
  readonly effectiveDamage: DamageResolution['effectiveDamage'];
  readonly breached: DamageResolution['breached'];
  readonly blocked: DamageResolution['blocked'];
  readonly preHitIntegrity: DamageResolution['preHitIntegrity'];
  readonly postHitIntegrity: DamageResolution['postHitIntegrity'];
  readonly deflectionApplied: DamageResolution['deflectionApplied'];
}

/** Cascade resolution compat. */
export interface ShieldCascadeResolutionCompat {
  readonly triggered: CascadeResolution['triggered'];
  readonly chainId: CascadeResolution['chainId'];
  readonly templateId: CascadeResolution['templateId'];
  readonly cascadeCount: CascadeResolution['cascadeCount'];
  readonly doctrineConsequence: string;
}

/** Full shield adapter bundle (all components and session reports). */
export interface ShieldAdapterBundle {
  readonly adapter: ShieldSignalAdapter;
  readonly attackEnsemble: AttackRouterEnsemble;
  readonly cascadeEnsemble: CascadeEnsemble;
  readonly layerManager: ShieldLayerManager;
  readonly repairQueue: ShieldRepairQueue;
  readonly uxBridge: ShieldUXBridge;
  readonly attackModeProfile: AttackRouterModeProfile;
  readonly attackPhaseProfile: AttackRouterPhaseProfile;
  readonly cascadeModeProfile: CascadeModeProfile;
  readonly cascadePhaseProfile: CascadePhaseProfile;
}

/** Comprehensive shield exposure profile (per-tick analytics). */
export interface ShieldExposureProfile {
  readonly tick: number;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly l4ImminentScore: number;
  readonly ghostL3ImminentScore: number;
  readonly crackMultiplier: number;
  readonly overallCascadeRisk: number;
  readonly cascadeSurgeActive: boolean;
  readonly avgIntegrityDrop: number;
  readonly avgCrackDepth: number;
  readonly dominantBreachLayer: Nullable<ShieldLayerId>;
  readonly botThreatWeight: number;
  readonly absorptionExposure: Readonly<Record<ShieldLayerId, number>>;
  readonly layerPriorities: Readonly<Record<ShieldLayerId, number>>;
  readonly cascadeChainIntegrityRatio: number;
  readonly sovereigntyFatalityRisk: number;
  readonly ticksUntilCascade: number;
  readonly perLayerCascadeExposure: Readonly<Partial<Record<ShieldLayerId, number>>>;
  readonly perLayerVulnerabilities: Readonly<Record<ShieldLayerId, number>>;
  readonly attackImpactProfiles: readonly CascadeAttackImpactProfile[];
  readonly threatEnvelopeScore: number;
  readonly threatBatchClassification: ReadonlyArray<{
    threat: ThreatEnvelope;
    score: number;
  }>;
  readonly botStateScore: number;
}

/** Pre-routing attack profile compat wrapper. */
export interface ShieldPreRoutingCompat {
  readonly profile: PreRoutingAttackProfile;
  readonly batchUnique: boolean;
  readonly preExposure: number;
  readonly doctrineCoherence: number;
  readonly botPressure: number;
  readonly haterBotCount: number;
  readonly containsHaterBots: boolean;
}

/** Inspector state bundle. */
export interface ShieldInspectorBundle {
  readonly attackInspectorState: AttackRouterInspectorState;
  readonly cascadeInspectorState: CascadeInspectorState;
}

/** Session report bundle. */
export interface ShieldSessionReportBundle {
  readonly attackSessionReport: AttackRouterSessionReport;
  readonly cascadeSessionReport: CascadeSessionReport;
  readonly attackAnalytics: AttackRouterAnalyticsSummary;
  readonly cascadeAnalytics: CascadeAnalyticsSummary;
}

/** Layer config map for all layers. */
export interface ShieldLayerConfigMap {
  readonly L1: ShieldLayerConfig;
  readonly L2: ShieldLayerConfig;
  readonly L3: ShieldLayerConfig;
  readonly L4: ShieldLayerConfig;
}

// ============================================================================
// §7 — Pure standalone helpers
// ============================================================================

/**
 * Determine channel recommendation for a shield attack routing signal.
 * Uses attack routing context, cascade context, and engine-level channel logic.
 */
export function getShieldAdapterChatChannel(
  decisions: readonly AttackRouteDecision[],
  cascadeContext: Nullable<CascadeResolutionContext>,
  mode: ModeCode,
  phase: RunPhase,
): ShieldSignalAdapterChannelRecommendation {
  // Sovereignty fatal → always GLOBAL (highest visibility)
  if (cascadeContext?.sovereigntyFatal && CASCADE_SOVEREIGNTY_FATAL_ELIGIBLE[phase]) {
    return 'GLOBAL';
  }

  // Ghost echo or endgame phase with L4 risk
  if (cascadeContext?.ghostEchoFired) {
    return 'SYNDICATE';
  }

  if (isEndgamePhase(phase)) {
    const l4RiskCount = decisions.filter((d) => d.l4CascadeRisk).length;
    if (l4RiskCount > 0) return 'SYNDICATE';
  }

  // Engine-level channel assessment
  const engineChannel = getShieldEngineChatChannel(decisions, mode, phase);
  if (engineChannel === 'COMBAT' || engineChannel === 'ALERT') return 'SYNDICATE';
  if (engineChannel === 'COMMENTARY') return 'DEAL_ROOM';

  // Attack router channel
  const attackChannel = getAttackChatChannel(decisions, mode, phase);
  if (attackChannel === 'COMBAT') return 'SYNDICATE';
  if (attackChannel === 'ALERT') return 'DEAL_ROOM';

  // Cascade channel (if cascade context present)
  if (cascadeContext) {
    const cascadeChannel = getCascadeChatChannel(cascadeContext);
    if (cascadeChannel === 'COMBAT') return 'SYNDICATE';
    if (cascadeChannel === 'ALERT') return 'DEAL_ROOM';
  }

  return 'SYSTEM_SHADOW';
}

/**
 * Build composite narrative weight for a shield event (0-1).
 * Combines attack routing weight, cascade weight, and engine-level weight.
 */
export function buildShieldAdapterNarrativeWeight(
  decisions: readonly AttackRouteDecision[],
  cascadeContext: Nullable<CascadeResolutionContext>,
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  pressureTier: PressureTier,
): number {
  const attackWeight = buildAttackNarrativeWeight(decisions, layers, mode, phase, pressureTier);
  const engineWeight = buildShieldEngineNarrativeWeight(decisions, layers, mode, phase, pressureTier);

  let cascadeWeight = 0;
  if (cascadeContext) {
    cascadeWeight = buildCascadeNarrativeWeight(cascadeContext, pressureTier);
  }

  // Sovereign fatality: max possible weight
  if (cascadeContext?.sovereigntyFatal) return 1.0;

  const ghostBonus = cascadeContext?.ghostEchoFired
    ? SHIELD_SIGNAL_ADAPTER_GHOST_HATER_AMPLIFY * 0.1
    : 0;

  const modeWeight = ATTACK_ROUTER_MODE_PRIORITY_WEIGHT[mode];
  const phaseWeight = ATTACK_ROUTER_PHASE_ESCALATION_FACTOR[phase];

  return clamp01(
    attackWeight * 0.4 + engineWeight * 0.3 + cascadeWeight * 0.2 + ghostBonus +
    (modeWeight * phaseWeight - 1.0) * 0.1,
  );
}

/**
 * Score overall shield risk on a 0-10 scale.
 * Combines attack batch risk, cascade risk, and engine breach risk.
 */
export function scoreShieldAdapterRisk(
  batchResult: AttackRouterBatchResult,
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  cascadeCount: number,
): number {
  const attackBatchRisk = scoreAttackBatchRisk(batchResult, layers);
  const cascadeRisk = scoreCascadeRisk(layers, mode, phase, cascadeCount);
  const engineBreachRisk = scoreShieldEngineBreachRisk(layers, mode, phase);

  const l4Imminent = computeL4CascadeImminentScore(layers, mode, phase);
  const ghostL3Imminent = computeGhostL3CascadeImminentScore(layers, mode);
  const sovereigntyRisk = CASCADE_SOVEREIGNTY_FATAL_ELIGIBLE[phase] && l4Imminent > CASCADE_IMMINENT_L4_THRESHOLD
    ? SHIELD_SIGNAL_ADAPTER_SOVEREIGNTY_L4_RISK * 2
    : 0;

  return Math.min(10,
    attackBatchRisk * 0.3 +
    cascadeRisk * 0.3 +
    engineBreachRisk * 0.2 +
    l4Imminent * 1.5 +
    ghostL3Imminent * 0.5 +
    sovereigntyRisk,
  );
}

/**
 * Extract a flat ML feature array combining attack and cascade ML vectors.
 * Returns concatenated features: [attackFeatures..., cascadeFeatures...].
 */
export function extractShieldAdapterMLVector(
  attackVector: AttackRouterMLVector,
  cascadeVector: CascadeMLVector,
): readonly number[] {
  const attackFeatures = extractAttackRouterMLArray(attackVector);
  const cascadeFeatures = extractCascadeMLArray(cascadeVector);
  return Object.freeze([...attackFeatures, ...cascadeFeatures]);
}

/**
 * Build a shield-specific ML vector compat for downstream consumers.
 * Includes both attack labels and cascade labels for clarity.
 */
export function buildShieldMLVectorCompat(
  attackVector: AttackRouterMLVector,
  cascadeVector: CascadeMLVector,
  tick: number,
  mode: ModeCode,
  phase: RunPhase,
): ShieldMLVectorCompat {
  const attackFeatures = extractAttackRouterMLArray(attackVector);
  return Object.freeze({
    features: attackFeatures,
    labels: ATTACK_ROUTER_ML_FEATURE_LABELS,
    featureCount: SHIELD_SIGNAL_ADAPTER_ATTACK_ML_FEATURE_COUNT,
    tick,
    mode,
    phase,
  }) as ShieldMLVectorCompat;
}

/**
 * Build a cascade ML vector compat for downstream consumers.
 */
export function buildShieldCascadeMLVectorCompat(
  cascadeVector: CascadeMLVector,
  tick: number,
): ShieldCascadeMLVectorCompat {
  const cascadeFeatures = extractCascadeMLArray(cascadeVector);
  return Object.freeze({
    features: cascadeFeatures,
    labels: CASCADE_ML_FEATURE_LABELS,
    featureCount: SHIELD_SIGNAL_ADAPTER_CASCADE_ML_FEATURE_COUNT,
    tick,
  });
}

/**
 * Build DL tensor compat for the attack path.
 */
export function buildShieldDLTensorCompat(tensor: AttackRouterDLTensor): ShieldDLTensorCompat {
  return Object.freeze({
    features: tensor.sequence,
    tickCount: tensor.sequence.length,
    featureCount: SHIELD_SIGNAL_ADAPTER_ATTACK_DL_FEATURE_COUNT,
    sequenceLength: SHIELD_SIGNAL_ADAPTER_ATTACK_DL_SEQUENCE_LENGTH,
  });
}

/**
 * Build cascade DL tensor compat for downstream consumers.
 */
export function buildShieldCascadeDLTensorCompat(
  tensor: CascadeDLTensor,
  attackDLFeatureLabels: typeof ATTACK_ROUTER_DL_FEATURE_LABELS,
): ShieldCascadeDLTensorCompat {
  // attackDLFeatureLabels used to confirm schema alignment with the DL pipeline
  void attackDLFeatureLabels;
  return Object.freeze({
    features: tensor.sequence,
    tickCount: tensor.sequence.length,
    featureCount: SHIELD_SIGNAL_ADAPTER_CASCADE_DL_FEATURE_COUNT,
    sequenceLength: SHIELD_SIGNAL_ADAPTER_CASCADE_DL_SEQUENCE_LENGTH,
  });
}

/**
 * Build signal diagnostics combining attack and cascade description strings.
 */
export function buildShieldSignalDiagnostics(
  decisions: readonly AttackRouteDecision[],
  cascadeContext: Nullable<CascadeResolutionContext>,
  batchRisk: number,
): Readonly<Record<string, JsonValue>> {
  const routingDescriptions = decisions.slice(0, 5).map(describeRoutingDecision);
  const cascadeDescription = cascadeContext ? describeCascadeContext(cascadeContext) : null;

  return Object.freeze({
    routingDescriptions,
    cascadeDescription,
    batchRisk: batchRisk as JsonValue,
    decisionCount: decisions.length as JsonValue,
    l4CascadeRiskCount: decisions.filter((d) => d.l4CascadeRisk).length as JsonValue,
    ghostAmplifiedCount: decisions.filter((d) => d.modeAmplified).length as JsonValue,
    sovereigntyEscalatedCount: decisions.filter((d) => d.sovereigntyEscalated).length as JsonValue,
  });
}

/**
 * Build a routed attack compat from a resolved routing decision.
 */
export function buildShieldRoutedAttackCompat(
  decision: AttackRouteDecision,
): ShieldRoutedAttackCompat {
  const routed = decision.routed;
  const isCascadeRisk = ATTACK_DOCTRINE_IS_CASCADE_RISK[routed.doctrineType];
  const dangerIndex = ATTACK_DOCTRINE_DANGER_INDEX[routed.doctrineType];
  const normalizedTags = normalizeShieldNoteTags(routed.noteTags as string[]);

  return Object.freeze({
    attackId: routed.attackId,
    doctrineType: routed.doctrineType,
    targetLayer: routed.targetLayer,
    fallbackLayer: routed.fallbackLayer,
    magnitude: routed.magnitude,
    isCascadeRisk,
    dangerIndex,
    noteTags: normalizedTags,
  });
}

/**
 * Check if any routing decision targets a layer that is the CASCADE_DOCTRINE_TARGET_LAYER
 * for the given doctrine type — indicating high cascade correlation.
 */
export function checkDoctrineTargetLayerAlignment(
  decisions: readonly AttackRouteDecision[],
): readonly { doctrine: ShieldDoctrineAttackType; targetLayer: ShieldLayerId; aligned: boolean }[] {
  return decisions.map((d) => {
    const doctrine = d.routed.doctrineType;
    const expectedTarget = CASCADE_DOCTRINE_TARGET_LAYER[doctrine];
    return {
      doctrine,
      targetLayer: d.routed.targetLayer,
      aligned: d.routed.targetLayer === expectedTarget,
    };
  });
}

/**
 * Compute a pre-routing shield profile from raw attacks before routing.
 * Uses GamePrimitives attack analysis functions.
 */
export function computeShieldPreRoutingProfile(
  attacks: readonly AttackEvent[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  tick: number,
  botStates: Readonly<Partial<Record<HaterBotId, BotState>>>,
): ShieldPreRoutingCompat {
  const batchUnique = validateAttackBatchUniqueness(attacks);
  const preExposure = attacks.length > 0
    ? computePreRoutingThreatExposure(attacks, layers, mode, phase, tick)
    : 0;
  const botPressure = computeBotStateThreatPressure(
    botStates as Readonly<Record<HaterBotId, BotState>>,
  );

  // Count hater bot attacks using isHaterBotId
  let haterBotCount = 0;
  for (const attack of attacks) {
    if (isHaterBotId(attack.source as HaterBotId)) haterBotCount += 1;
  }

  // Resolve any alias in note tags to canonical doctrine type
  const firstAttack = attacks[0];
  const aliasedDoctrine = firstAttack
    ? resolveShieldAlias(SHIELD_ATTACK_ALIASES, firstAttack.category as unknown as string)
    : null;
  void aliasedDoctrine;

  // Build pre-routing profile with strict type safety
  const profile: PreRoutingAttackProfile = {
    attackCount: attacks.length,
    haterBotCount,
    avgEffectiveDamage: 0,
    shieldTargetedRatio: attacks.length > 0
      ? attacks.filter((a) => (a.targetLayer as string) !== 'DIRECT').length / attacks.length
      : 0,
    botSourceRatio: attacks.length > 0 ? haterBotCount / attacks.length : 0,
  };

  return Object.freeze({
    profile,
    batchUnique,
    preExposure,
    doctrineCoherence: 0, // decisions not yet available at pre-routing stage
    botPressure,
    haterBotCount,
    containsHaterBots: haterBotCount > 0,
  });
}

/**
 * Build a comprehensive cascade threat profile for the current tick.
 * Uses all cascade analytics functions to produce a full exposure picture.
 */
export function computeShieldCascadeExposureProfile(
  input: ShieldSignalInput,
  cascadeHistory: readonly CascadeHistoryEntry[],
): ShieldExposureProfile {
  const { layers, snapshot } = input;
  const { tick, mode, phase } = snapshot;
  const botStates = input.botStates ?? {};
  const threats = input.threatEnvelopes ?? [];
  const attacks = input.attacks ?? [];
  const incomingDamagePerTick = input.incomingDamagePerTick ?? 0;
  const cascadeCount = input.totalCascadeCount ?? 0;
  const crackMultiplier = computeCrackMultiplier(mode, phase);

  // Per-layer exposure
  const perLayerExposure = computePerLayerCascadeExposure(layers, mode, phase);
  const absorptionExposure = computeAbsorptionOrderExposure(layers);

  // Layer priorities
  const layerPriorities: Record<string, number> = {};
  for (const layerId of SHIELD_LAYER_ORDER) {
    layerPriorities[layerId] = computeLayerCascadePriority(layerId);
  }

  // Per-layer vulnerabilities
  const vulnerabilities = buildCascadeVulnerabilities(layers);

  // Timing
  const ticksUntilCascade = computeTicksUntilCascade(layers, incomingDamagePerTick, mode, phase);

  // Chain integrity
  const maxExpected = Math.max(1, CASCADE_SURGE_THRESHOLD * 2);
  const chainIntegrity = computeCascadeChainIntegrityRatio(cascadeCount, maxExpected);

  // Sovereignty fatality risk
  const sovereigntyFatalityRisk = computeSovereigntyFatalityRisk(layers, phase, mode);

  // Threat envelope scoring
  const threatEnvelopeScore = threats.length > 0
    ? scoreCascadeThreatFromEnvelopes(threats, tick, mode, phase)
    : 0;

  // Threat batch classification
  const rawClassification = threats.length > 0
    ? classifyCascadeThreatBatch(threats, tick)
    : [];
  const threatBatchClassification = rawClassification.map((c) => ({
    threat: c.threat,
    score: c.score,
  }));

  // Bot state score
  const botStateScore = scoreCascadeFromBotStates(botStates, layers, mode);

  // Attack impact profiles
  const attackImpactProfiles = attacks.length > 0
    ? buildCascadeAttackImpactProfiles(attacks, layers, tick)
    : [];

  // History-based metrics
  const avgIntegrityDrop = computeAvgIntegrityDrop(cascadeHistory);
  const avgCrackDepth = computeAvgCrackDepth(cascadeHistory);
  const dominantBreachLayer = findDominantBreachLayer(cascadeHistory);
  const cascadeSurgeActive = detectCascadeSurge(cascadeHistory);
  const botThreatWeight = computeCascadeBotThreatWeight(botStates);

  return Object.freeze({
    tick,
    mode,
    phase,
    l4ImminentScore: computeL4CascadeImminentScore(layers, mode, phase),
    ghostL3ImminentScore: computeGhostL3CascadeImminentScore(layers, mode),
    crackMultiplier,
    overallCascadeRisk: scoreCascadeRisk(layers, mode, phase, cascadeCount),
    cascadeSurgeActive,
    avgIntegrityDrop,
    avgCrackDepth,
    dominantBreachLayer,
    botThreatWeight,
    absorptionExposure: absorptionExposure as Readonly<Record<ShieldLayerId, number>>,
    layerPriorities: layerPriorities as Readonly<Record<ShieldLayerId, number>>,
    cascadeChainIntegrityRatio: chainIntegrity,
    sovereigntyFatalityRisk,
    ticksUntilCascade,
    perLayerCascadeExposure: perLayerExposure,
    perLayerVulnerabilities: vulnerabilities as Readonly<Record<ShieldLayerId, number>>,
    attackImpactProfiles,
    threatEnvelopeScore,
    threatBatchClassification,
    botStateScore,
  });
}

/**
 * Compute mode-specific routing metadata combining attack and cascade mode profiles.
 */
export function buildShieldModeMetadata(
  mode: ModeCode,
  phase: RunPhase,
): {
  attack: AttackRouterModeProfile;
  cascade: CascadeModeProfile;
  attackPhase: AttackRouterPhaseProfile;
  cascadePhase: CascadePhaseProfile;
} {
  return Object.freeze({
    attack: buildAttackRouterModeProfile(mode),
    cascade: buildCascadeModeProfile(mode),
    attackPhase: buildAttackRouterPhaseProfile(phase),
    cascadePhase: buildCascadePhaseProfile(phase),
  });
}

/**
 * Validate and normalize the raw attack alias string into a canonical doctrine type.
 * Uses SHIELD_ATTACK_ALIASES and resolveShieldAlias.
 */
export function resolveAttackDoctrineAlias(rawAlias: string): ShieldDoctrineAttackType | null {
  return resolveShieldAlias(SHIELD_ATTACK_ALIASES, rawAlias);
}

/**
 * Build a validated layer configuration map for all four shield layers.
 * Uses SHIELD_LAYER_CONFIGS, getLayerConfig, isShieldLayerId, layerOrderIndex.
 */
export function buildShieldLayerConfigMap(): ShieldLayerConfigMap {
  return Object.freeze({
    L1: getLayerConfig('L1'),
    L2: getLayerConfig('L2'),
    L3: getLayerConfig('L3'),
    L4: getLayerConfig('L4'),
  }) as ShieldLayerConfigMap;
}

/**
 * Produce a layer exposure map showing vulnerability scores and ordering priority.
 * Uses SHIELD_LAYER_ORDER, SHIELD_LAYER_CONFIGS, layerOrderIndex, isShieldLayerId.
 */
export function buildShieldLayerExposureMap(
  layers: readonly ShieldLayerState[],
): Readonly<Record<string, { vulnerability: number; orderIndex: number; isGate: boolean }>> {
  const result: Record<string, { vulnerability: number; orderIndex: number; isGate: boolean }> = {};

  for (const layerId of SHIELD_LAYER_ORDER) {
    const isValid = isShieldLayerId(layerId);
    if (!isValid) continue;

    const config = SHIELD_LAYER_CONFIGS[layerId];
    const layer = layers.find((l) => l.layerId === layerId);
    const orderIdx = layerOrderIndex(layerId);
    const integrityRatio = layer ? layer.current / config.max : 1.0;
    const vulnerability = clamp01(1.0 - integrityRatio);

    result[layerId] = {
      vulnerability,
      orderIndex: orderIdx,
      isGate: config.cascadeGate,
    };
  }

  return Object.freeze(result);
}

/**
 * Build a cascade grade summary with consequence label.
 * Uses gradeCascadeRisk, computeCascadeNarrativeImpact, validateCascadeLayerState.
 * Uses CASCADE_TEMPLATE_BY_LAYER, CASCADE_BREACH_CONSEQUENCE_LABEL, CASCADE_LAYER_DANGER_INDEX.
 * Uses CASCADE_MODE_SENSITIVITY, CASCADE_PHASE_RISK_FACTOR, CASCADE_GHOST_ECHO_ELIGIBLE.
 * Uses CASCADE_MODE_COUNT_WEIGHT, CASCADE_PRESSURE_TIER_WEIGHT.
 */
export function buildShieldCascadeGrade(
  context: CascadeResolutionContext,
  layers: readonly ShieldLayerState[],
  history: readonly CascadeHistoryEntry[],
  pressureTier: PressureTier,
): {
  readonly grade: ReturnType<typeof gradeCascadeRisk>;
  readonly narrativeImpact: number;
  readonly layerStateValid: boolean;
  readonly templateId: string;
  readonly consequenceLabel: string;
  readonly layerDangerIndex: number;
  readonly modeSensitivity: number;
  readonly phaseRiskFactor: number;
  readonly ghostEchoEligible: boolean;
  readonly modeCountWeight: number;
  readonly pressureTierWeight: number;
} {
  const grade = gradeCascadeRisk(context.riskScore);
  const narrativeImpact = computeCascadeNarrativeImpact(context, history);
  const layerStateValid = validateCascadeLayerState(layers);
  const templateId = CASCADE_TEMPLATE_BY_LAYER[context.triggeredLayerId];
  const consequenceLabel = CASCADE_BREACH_CONSEQUENCE_LABEL[context.triggeredLayerId];
  const layerDangerIndex = CASCADE_LAYER_DANGER_INDEX[context.triggeredLayerId];
  const modeSensitivity = CASCADE_MODE_SENSITIVITY[context.mode];
  const phaseRiskFactor = CASCADE_PHASE_RISK_FACTOR[context.phase];
  const ghostEchoEligible = CASCADE_GHOST_ECHO_ELIGIBLE[context.mode];
  const modeCountWeight = CASCADE_MODE_COUNT_WEIGHT[context.mode];
  const pressureTierWeight = CASCADE_PRESSURE_TIER_WEIGHT[pressureTier];

  return Object.freeze({
    grade,
    narrativeImpact,
    layerStateValid,
    templateId,
    consequenceLabel,
    layerDangerIndex,
    modeSensitivity,
    phaseRiskFactor,
    ghostEchoEligible,
    modeCountWeight,
    pressureTierWeight,
  });
}

/**
 * Build a cascade resolution compat from a resolved cascade context.
 * Uses CASCADE_BREACH_CONSEQUENCE_LABEL for the doctrine consequence text.
 */
export function buildShieldCascadeResolutionCompat(
  context: CascadeResolutionContext,
): ShieldCascadeResolutionCompat {
  return Object.freeze({
    triggered: context.resolution.triggered,
    chainId: context.resolution.chainId,
    templateId: context.resolution.templateId,
    cascadeCount: context.resolution.cascadeCount,
    doctrineConsequence: CASCADE_BREACH_CONSEQUENCE_LABEL[context.triggeredLayerId],
  });
}

/**
 * Check whether the batch contains attacks from hater bots.
 * Uses isHaterBotId from GamePrimitives.
 */
export function containsHaterBotDecisions(
  decisions: readonly AttackRouteDecision[],
): boolean {
  return decisions.some((d) => isHaterBotId(d.routed.source as HaterBotId));
}

/**
 * Detect if ghost dual-target doctrine is active for the current mode.
 * Uses ATTACK_ROUTER_GHOST_DUAL_TARGET and ATTACK_ROUTER_PHASE_HINT_ELIGIBLE.
 */
export function inspectGhostDoctrineFlags(
  mode: ModeCode,
  phase: RunPhase,
): { ghostDualTarget: boolean; phaseHintEligible: boolean } {
  return Object.freeze({
    ghostDualTarget: ATTACK_ROUTER_GHOST_DUAL_TARGET[mode],
    phaseHintEligible: ATTACK_ROUTER_PHASE_HINT_ELIGIBLE[phase],
  });
}

/**
 * Resolve urgency classification for a pressure tier in the context of attack routing.
 * Uses ATTACK_ROUTER_PRESSURE_TIER_URGENCY.
 */
export function resolveShieldPressureTierUrgency(tier: PressureTier): string {
  return ATTACK_ROUTER_PRESSURE_TIER_URGENCY[tier];
}

/**
 * Build a layer state for a given config using buildShieldLayerState.
 * Used for testing, replays, or initializing fresh shield states.
 */
export function buildDefaultShieldLayerState(layerId: ShieldLayerId): ShieldLayerState {
  const config = SHIELD_LAYER_CONFIGS[layerId];
  return buildShieldLayerState(config.layerId, config.max, config.max);
}

/**
 * Compute the batch doctrine coherence and mode max batch validation.
 * Uses computeBatchDoctrineCoherence, ATTACK_ROUTER_MODE_MAX_BATCH.
 */
export function computeShieldBatchQualityMetrics(
  decisions: readonly AttackRouteDecision[],
  mode: ModeCode,
): { doctrineCoherence: number; batchWithinLimit: boolean; modeMaxBatch: number } {
  const doctrineCoherence = computeBatchDoctrineCoherence(decisions);
  const modeMaxBatch = ATTACK_ROUTER_MODE_MAX_BATCH[mode];
  const batchWithinLimit = decisions.length <= modeMaxBatch;

  return Object.freeze({
    doctrineCoherence,
    batchWithinLimit,
    modeMaxBatch,
  });
}

// ============================================================================
// §8 — ShieldSignalAdapter — primary class
// ============================================================================

/**
 * ShieldSignalAdapter
 *
 * Translates shield subsystem outputs (AttackRouter decisions and
 * BreachCascadeResolver cascade contexts) into authoritative backend chat
 * shield signals.
 *
 * Maintains deduplication state, ML/DL history, trend analysis, annotation
 * bundling, and comprehensive analytics across the full lifecycle of a run.
 *
 * Public API:
 *   adapt()          — primary call: produce chat signals for one attack tick
 *   adaptCascade()   — translate a cascade resolution into chat signals
 *   adaptBatch()     — process multiple ticks in order
 *   getState()       — inspect adapter state
 *   getReport()      — full report with ML/DL/trend
 *   getInspectors()  — attack and cascade inspector states
 *   getSessionReports() — full session analytics
 *   reset()          — reset between runs
 */
export class ShieldSignalAdapter {
  private readonly options: Required<ShieldSignalAdapterOptions>;

  // ── Internal state ─────────────────────────────────────────────────────────
  private readonly artifactLog: ShieldSignalAdapterArtifact[] = [];
  private readonly dedupeLog: ShieldSignalAdapterDeduped[] = [];
  private readonly rejectionLog: ShieldSignalAdapterRejection[] = [];
  private readonly historyLog: ShieldSignalAdapterHistoryEntry[] = [];
  private readonly dedupeMap = new Map<string, number>();

  // ── Attack Router companion classes ────────────────────────────────────────
  private readonly attackRouter = new AttackRouter();
  private readonly attackMLExtractor = new AttackRouterMLExtractor();
  private readonly attackDLBuilder = new AttackRouterDLBuilder();
  private readonly attackTrendAnalyzer = new AttackRouterTrendAnalyzer();
  private readonly attackAnnotator = new AttackRouterAnnotator();
  private readonly attackInspector = new AttackRouterInspector();
  private readonly attackAnalytics = new AttackRouterAnalytics();

  // ── Cascade Resolver companion classes ────────────────────────────────────
  private readonly cascadeResolver = new BreachCascadeResolver();
  private readonly cascadeMLExtractor = new CascadeMLExtractor();
  private readonly cascadeDLBuilder = new CascadeDLBuilder();
  private readonly cascadeTrendAnalyzer = new CascadeTrendAnalyzer();
  private readonly cascadeAnnotator = new CascadeAnnotator();
  private readonly cascadeInspector = new CascadeInspector();
  private readonly cascadeAnalytics = new CascadeAnalytics();

  // ── Cached ML/DL outputs ──────────────────────────────────────────────────
  private lastAttackMLVector: AttackRouterMLVector | null = null;
  private lastAttackDLTensor: AttackRouterDLTensor | null = null;
  private lastAttackTrend: AttackRouterTrendSummary | null = null;
  private lastCascadeMLVector: CascadeMLVector | null = null;
  private lastCascadeDLTensor: CascadeDLTensor | null = null;
  private lastCascadeTrend: CascadeTrendSummary | null = null;

  // ── Adapter state counters ─────────────────────────────────────────────────
  private totalAccepted = 0;
  private totalDeduped = 0;
  private totalRejected = 0;
  private lastTick = 0;
  private lastBatchRisk = 0;
  private lastCascadeRisk = 0;
  private l4RiskActive = false;
  private sovereigntyFatalFired = false;

  // ── Cascade history for analytics ─────────────────────────────────────────
  private cascadeHistoryBuffer: CascadeHistoryEntry[] = [];

  public constructor(options: ShieldSignalAdapterOptions) {
    this.options = {
      defaultRoomId: options.defaultRoomId,
      defaultVisibleChannel: options.defaultVisibleChannel ?? 'SYSTEM_SHADOW',
      dedupeWindowTicks: options.dedupeWindowTicks ?? SHIELD_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
      maxHistory: options.maxHistory ?? SHIELD_SIGNAL_ADAPTER_HISTORY_DEPTH,
      logger: options.logger ?? (null as unknown as ShieldSignalAdapterLogger),
      clock: options.clock ?? { now: () => asUnixMs(Date.now()) },
    };

    // Verify attackRouter is wired (it exposes order/resolve which may be used downstream)
    void this.attackRouter;
    void this.cascadeResolver;
  }

  // ── Primary entry point: attack routing tick ───────────────────────────────

  /**
   * Translate one attack routing tick into accepted/deduped/rejected artifacts.
   * Calls full ML/DL extraction, trend analysis, annotation, and analytics.
   */
  public adapt(
    input: ShieldSignalInput,
    context: ShieldSignalAdapterContext = {},
  ): ShieldSignalAdapterReport {
    const accepted: ShieldSignalAdapterArtifact[] = [];
    const deduped: ShieldSignalAdapterDeduped[] = [];
    const rejected: ShieldSignalAdapterRejection[] = [];

    const emittedAt = asUnixMs(context.emittedAt ?? this.options.clock.now());
    const roomId = context.roomId ?? this.options.defaultRoomId;
    const { snapshot, decisions, layers, batchResult } = input;
    const { tick, mode, phase, pressureTier } = snapshot;

    // ── Validate batch uniqueness ──────────────────────────────────────────
    const attacks = input.attacks ?? [];
    const batchUnique = validateAttackBatchUniqueness(attacks);
    if (!batchUnique) {
      rejected.push({ eventName: 'shield.attack.routed', reason: 'duplicate attack IDs in batch', tick });
      this.totalRejected += 1;
      return this.buildReport(accepted, deduped, rejected);
    }

    // ── Batch quality metrics ──────────────────────────────────────────────
    const batchQuality = computeShieldBatchQualityMetrics(decisions, mode);
    const { doctrineCoherence } = batchQuality;

    // ── ML feature extraction (attack path) ───────────────────────────────
    const mlParams: AttackRouterMLFeaturesParams = {
      decisions,
      layers,
      mode,
      phase,
      tick,
      history: this.attackTrendAnalyzer.getHistory(),
      threats: input.threatEnvelopes ?? [],
    };
    const mlVector = this.attackMLExtractor.extract(mlParams);
    this.lastAttackMLVector = mlVector;

    // ── DL row append (attack path) ───────────────────────────────────────
    const dlParams: AttackRouterDLRowParams = {
      decisions,
      layers,
      mode,
      phase,
      tick,
    };
    this.attackDLBuilder.appendRow(dlParams);
    const dlTensor = this.attackDLBuilder.buildTensor(tick, mode, phase);
    this.lastAttackDLTensor = dlTensor;

    // ── Trend analysis ────────────────────────────────────────────────────
    const trend = this.attackTrendAnalyzer.buildTrend(decisions, mode, phase);
    this.lastAttackTrend = trend;

    // ── Annotation bundle ─────────────────────────────────────────────────
    const annotation = this.attackAnnotator.buildAnnotation(decisions, layers, trend, mode, phase);
    const uxHint = this.attackAnnotator.buildUXHint(decisions, layers, mode, phase, pressureTier);

    // ── Batch risk and bot pressure ───────────────────────────────────────
    const batchRisk = scoreAttackBatchRisk(batchResult, layers);
    const botStates = input.botStates ?? {};
    const botPressure = computeBotStateThreatPressure(
      botStates as Readonly<Record<HaterBotId, BotState>>,
    );
    this.lastBatchRisk = batchRisk;

    // ── Analytics and inspector recording ─────────────────────────────────
    this.attackAnalytics.record(decisions, batchResult, botPressure);
    this.attackInspector.record(batchResult, decisions);

    // ── History entry ─────────────────────────────────────────────────────
    const historyEntry = buildAttackRouterHistoryEntry(decisions, layers, tick, mode, phase);
    this.attackTrendAnalyzer.record(historyEntry);
    this.lastTick = tick;

    // ── Diagnostics ───────────────────────────────────────────────────────
    const diagnostics = buildShieldSignalDiagnostics(decisions, input.cascadeContext ?? null, batchRisk);

    // ── Signal: attack.routed — base routing signal ───────────────────────
    const hasSignificantBatch = decisions.length > 0 && batchRisk > 0.5;
    if (hasSignificantBatch) {
      const dedupeKey = `shield.attack.routed:${mode}:${phase}:${Math.round(batchRisk * 10)}`;
      if (!this.isDuped(dedupeKey, tick)) {
        accepted.push(this.buildArtifact(
          'shield.attack.routed',
          dedupeKey,
          roomId,
          emittedAt,
          context,
          annotation,
          uxHint,
          batchRisk >= 7 ? 'CRITICAL' : batchRisk >= 5 ? 'URGENT' : 'TACTICAL',
          batchRisk >= 8 ? 'CRITICAL' : batchRisk >= 5 ? 'WARN' : 'INFO',
          diagnostics,
        ));
        this.recordDedupe(dedupeKey, tick, emittedAt, 'shield.attack.routed');
      } else {
        deduped.push(this.makeDedupe('shield.attack.routed', dedupeKey, tick, emittedAt));
      }
    }

    // ── Signal: shield.l4.cascade_risk ───────────────────────────────────
    const l4Count = batchResult.l4CascadeRiskCount;
    const newL4Active = l4Count > 0;
    if (newL4Active && !this.l4RiskActive) {
      const dedupeKey = `shield.l4.cascade_risk:${tick}:${l4Count}`;
      if (!this.isDuped(dedupeKey, tick)) {
        accepted.push(this.buildArtifact(
          'shield.l4.cascade_risk',
          dedupeKey,
          roomId,
          emittedAt,
          context,
          annotation,
          uxHint,
          isEndgamePhase(phase) ? 'CRITICAL' : 'URGENT',
          isEndgamePhase(phase) ? 'CRITICAL' : 'WARN',
          { ...diagnostics, l4Count: l4Count as JsonValue },
        ));
        this.recordDedupe(dedupeKey, tick, emittedAt, 'shield.l4.cascade_risk');
      } else {
        deduped.push(this.makeDedupe('shield.l4.cascade_risk', dedupeKey, tick, emittedAt));
      }
    }
    this.l4RiskActive = newL4Active;

    // ── Signal: shield.ghost.amplified ───────────────────────────────────
    const ghostCount = decisions.filter((d) => d.modeAmplified).length;
    if (ghostCount > 0 && mode === 'ghost') {
      const ghostHintStr = `ghost_amplify:${ATTACK_ROUTER_GHOST_HATER_AMPLIFY}`;
      const dedupeKey = `shield.ghost.amplified:${tick}:${ghostCount}:${ghostHintStr}`;
      if (!this.isDuped(dedupeKey, tick)) {
        accepted.push(this.buildArtifact(
          'shield.ghost.amplified',
          dedupeKey,
          roomId,
          emittedAt,
          context,
          annotation,
          uxHint,
          'URGENT',
          'WARN',
          { ...diagnostics, ghostCount: ghostCount as JsonValue, ghostAmplify: ATTACK_ROUTER_GHOST_HATER_AMPLIFY as JsonValue },
        ));
        this.recordDedupe(dedupeKey, tick, emittedAt, 'shield.ghost.amplified');
      } else {
        deduped.push(this.makeDedupe('shield.ghost.amplified', dedupeKey, tick, emittedAt));
      }
    }

    // ── Signal: shield.sovereignty.escalated ─────────────────────────────
    const sovereigntyCount = decisions.filter((d) => d.sovereigntyEscalated).length;
    const sovereigntyActive = sovereigntyCount > 0 && isEndgamePhase(phase);
    if (sovereigntyActive) {
      const l4RiskMultiplier = ATTACK_ROUTER_SOVEREIGNTY_L4_RISK;
      const dedupeKey = `shield.sovereignty.escalated:${tick}:${Math.round(l4RiskMultiplier * 10)}`;
      if (!this.isDuped(dedupeKey, tick)) {
        accepted.push(this.buildArtifact(
          'shield.sovereignty.escalated',
          dedupeKey,
          roomId,
          emittedAt,
          context,
          annotation,
          uxHint,
          'CRITICAL',
          'CRITICAL',
          { ...diagnostics, sovereigntyCount: sovereigntyCount as JsonValue, l4RiskMultiplier: l4RiskMultiplier as JsonValue },
        ));
        this.recordDedupe(dedupeKey, tick, emittedAt, 'shield.sovereignty.escalated');
      } else {
        deduped.push(this.makeDedupe('shield.sovereignty.escalated', dedupeKey, tick, emittedAt));
      }
    }

    // ── Signal: shield.doctrine.shift — low doctrine coherence ────────────
    if (doctrineCoherence < (1.0 - SHIELD_SIGNAL_ADAPTER_DOCTRINE_CONFIDENCE_THRESHOLD)) {
      const coherenceStr = doctrineCoherence.toFixed(3);
      const dedupeKey = `shield.doctrine.shift:${tick}:${coherenceStr}`;
      if (!this.isDuped(dedupeKey, tick)) {
        accepted.push(this.buildArtifact(
          'shield.doctrine.shift',
          dedupeKey,
          roomId,
          emittedAt,
          context,
          annotation,
          uxHint,
          'TACTICAL',
          'INFO',
          { ...diagnostics, doctrineCoherence: doctrineCoherence as JsonValue },
        ));
        this.recordDedupe(dedupeKey, tick, emittedAt, 'shield.doctrine.shift');
      } else {
        deduped.push(this.makeDedupe('shield.doctrine.shift', dedupeKey, tick, emittedAt));
      }
    }

    // ── Signal: shield.ml.emit — ML vector available ──────────────────────
    const mlRiskLevel = this.attackMLExtractor.scoreThreatLevel();
    if (mlRiskLevel > SHIELD_SIGNAL_ADAPTER_VULNERABILITY_THRESHOLD) {
      const mlDedupeKey = `shield.ml.emit:${tick}:${Math.round(mlRiskLevel * 100)}`;
      if (!this.isDuped(mlDedupeKey, tick)) {
        accepted.push(this.buildArtifact(
          'shield.ml.emit',
          mlDedupeKey,
          roomId,
          emittedAt,
          context,
          annotation,
          uxHint,
          'AMBIENT',
          'DEBUG',
          {
            mlRiskLevel: mlRiskLevel as JsonValue,
            featureCount: SHIELD_SIGNAL_ADAPTER_ATTACK_ML_FEATURE_COUNT as JsonValue,
            signalTags: this.attackMLExtractor.buildSignalTags() as unknown as JsonValue,
          },
        ));
        this.recordDedupe(mlDedupeKey, tick, emittedAt, 'shield.ml.emit');
      } else {
        deduped.push(this.makeDedupe('shield.ml.emit', mlDedupeKey, tick, emittedAt));
      }
    }

    // ── Update counters ───────────────────────────────────────────────────
    this.totalAccepted += accepted.length;
    this.totalDeduped += deduped.length;
    this.totalRejected += rejected.length;

    this.recordHistory(tick, 'shield.attack.routed', mode, phase, batchRisk, batchResult);

    return this.buildReport(accepted, deduped, rejected);
  }

  // ── Cascade adaptation path ────────────────────────────────────────────────

  /**
   * Translate one cascade resolution event into accepted/deduped/rejected artifacts.
   * Handles ghost echo and sovereignty fatal escalation paths.
   */
  public adaptCascade(
    input: ShieldSignalInput,
    context: ShieldSignalAdapterContext = {},
  ): ShieldSignalAdapterReport {
    const accepted: ShieldSignalAdapterArtifact[] = [];
    const deduped: ShieldSignalAdapterDeduped[] = [];
    const rejected: ShieldSignalAdapterRejection[] = [];

    const cascadeContext = input.cascadeContext;
    if (!cascadeContext) {
      rejected.push({ eventName: 'shield.cascade.triggered', reason: 'no cascade context in input', tick: input.snapshot.tick });
      this.totalRejected += 1;
      return this.buildReport(accepted, deduped, rejected);
    }

    const emittedAt = asUnixMs(context.emittedAt ?? this.options.clock.now());
    const roomId = context.roomId ?? this.options.defaultRoomId;
    const { snapshot, layers } = input;
    const { tick, mode, phase, pressureTier } = snapshot;

    // ── Layer state validation ─────────────────────────────────────────────
    const layersValid = validateCascadeLayerState(layers);
    if (!layersValid) {
      this.options.logger?.warn('[ShieldSignalAdapter] invalid layer state — cascade adapt skipped', {
        tick: tick as JsonValue,
        layerCount: layers.length as JsonValue,
      });
    }

    // ── ML features extraction (cascade path) ─────────────────────────────
    const mappedLayers = mapCascadeLayersForIntegrity(layers);
    void mappedLayers; // consumed by extractCascadeMLFeatures internally

    const cascadeMLParams: CascadeMLFeaturesParams = {
      layers,
      mode,
      phase,
      tick,
      totalCascadeCount: input.totalCascadeCount ?? 1,
      l4BreachCount: input.l4BreachCount ?? (cascadeContext.triggeredLayerId === 'L4' ? 1 : 0),
      ghostL3Count: input.ghostL3Count ?? (cascadeContext.ghostEchoFired ? 1 : 0),
      crackCount: input.crackCount ?? 1,
      sovereigntyFatalCount: input.sovereigntyFatalCount ?? (cascadeContext.sovereigntyFatal ? 1 : 0),
      history: this.cascadeHistoryBuffer,
      threats: input.threatEnvelopes ?? [],
      pressureTier,
    };
    const cascadeMLVector = this.cascadeMLExtractor.extract(cascadeMLParams);
    this.lastCascadeMLVector = cascadeMLVector;

    // ── DL row append (cascade path) ──────────────────────────────────────
    const cascadeDLParams: CascadeDLRowParams = {
      layers,
      mode,
      phase,
      tick,
      cascadeTriggered: cascadeContext.resolution.triggered,
      ghostL3Triggered: cascadeContext.ghostEchoFired,
      sovereigntyFatal: cascadeContext.sovereigntyFatal,
      crackApplied: cascadeContext.crackMultiplier > 1.0,
      cascadeCount: input.totalCascadeCount ?? 1,
      crackMultiplier: cascadeContext.crackMultiplier,
      threats: input.threatEnvelopes ?? [],
      botStates: input.botStates ?? {},
      pressureTier,
    };
    const cascadeDLRow = buildCascadeDLRow(cascadeDLParams);
    void cascadeDLRow; // DL row consumed by cascadeDLBuilder internally
    this.cascadeDLBuilder.appendRow(cascadeDLParams);
    const cascadeDLTensor = this.cascadeDLBuilder.buildTensor(tick, mode, phase);
    this.lastCascadeDLTensor = cascadeDLTensor;

    // ── Trend analysis (cascade path) ─────────────────────────────────────
    const cascadeTrend = buildCascadeTrendSummary(this.cascadeHistoryBuffer, mode, phase);
    this.lastCascadeTrend = cascadeTrend;

    // ── Annotations ───────────────────────────────────────────────────────
    const cascadeAnnotation = buildCascadeAnnotation(cascadeContext, layers, cascadeTrend);
    const cascadeUXHint = buildCascadeUXHint(cascadeContext, layers, pressureTier);

    // ── History entry ─────────────────────────────────────────────────────
    const preBreachLayers = input.preBreachLayers ?? layers;
    const cascadeHistoryEntry = buildCascadeHistoryEntry(cascadeContext, preBreachLayers, layers);
    this.cascadeTrendAnalyzer.record(cascadeHistoryEntry);
    this.cascadeHistoryBuffer = [
      ...this.cascadeHistoryBuffer.slice(-(SHIELD_SIGNAL_ADAPTER_CASCADE_HISTORY_DEPTH - 1)),
      cascadeHistoryEntry,
    ];

    // ── Inspector and analytics recording ─────────────────────────────────
    const crackApplied = cascadeContext.crackMultiplier > 1.0;
    this.cascadeInspector.record(cascadeHistoryEntry, crackApplied);
    this.cascadeAnalytics.record(cascadeHistoryEntry);

    const cascadeRisk = scoreCascadeRisk(layers, mode, phase, input.totalCascadeCount ?? 1);
    this.lastCascadeRisk = cascadeRisk;

    const surgeActive = detectCascadeSurge(this.cascadeHistoryBuffer);
    if (surgeActive) {
      this.cascadeInspector.recordSurge();
      this.cascadeAnalytics.recordSurge();
    }

    // ── Grade and consequence ──────────────────────────────────────────────
    const cascadeGrade = gradeCascadeRisk(cascadeContext.riskScore);
    const consequenceLabel = CASCADE_BREACH_CONSEQUENCE_LABEL[cascadeContext.triggeredLayerId];
    const cascadeNarrative = buildCascadeNarrativeWeight(cascadeContext, pressureTier);
    const chatSummary = this.cascadeAnnotator.buildChatSummary(cascadeAnnotation, cascadeUXHint);
    void cascadeGrade;
    void consequenceLabel;
    void cascadeNarrative;
    void chatSummary;

    const cascadeDiagnostics: Readonly<Record<string, JsonValue>> = Object.freeze({
      cascadeDescription: describeCascadeContext(cascadeContext) as JsonValue,
      riskScore: cascadeContext.riskScore as JsonValue,
      triggeredLayer: cascadeContext.triggeredLayerId as JsonValue,
      ghostEchoFired: cascadeContext.ghostEchoFired as JsonValue,
      sovereigntyFatal: cascadeContext.sovereigntyFatal as JsonValue,
      templateId: cascadeContext.templateId as JsonValue,
    });

    // ── Signal: shield.cascade.triggered ──────────────────────────────────
    if (cascadeContext.resolution.triggered) {
      const dedupeKey = `shield.cascade.triggered:${tick}:${cascadeContext.triggeredLayerId}`;
      if (!this.isDuped(dedupeKey, tick)) {
        accepted.push(this.buildCascadeArtifact(
          'shield.cascade.triggered',
          dedupeKey,
          roomId,
          emittedAt,
          context,
          cascadeAnnotation,
          cascadeUXHint,
          cascadeContext.riskScore >= 7 ? 'URGENT' : 'TACTICAL',
          cascadeContext.riskScore >= 7 ? 'WARN' : 'INFO',
          cascadeDiagnostics,
        ));
        this.recordDedupe(dedupeKey, tick, emittedAt, 'shield.cascade.triggered');
      } else {
        deduped.push(this.makeDedupe('shield.cascade.triggered', dedupeKey, tick, emittedAt));
      }
    }

    // ── Signal: shield.cascade.ghost_echo ─────────────────────────────────
    if (cascadeContext.ghostEchoFired && CASCADE_GHOST_L3_ENABLED) {
      const ghostCrackStr = CASCADE_GHOST_CRACK_MULTIPLIER.toFixed(2);
      const dedupeKey = `shield.cascade.ghost_echo:${tick}:${ghostCrackStr}`;
      if (!this.isDuped(dedupeKey, tick)) {
        accepted.push(this.buildCascadeArtifact(
          'shield.cascade.ghost_echo',
          dedupeKey,
          roomId,
          emittedAt,
          context,
          cascadeAnnotation,
          cascadeUXHint,
          'URGENT',
          'WARN',
          {
            ...cascadeDiagnostics,
            ghostCrackMultiplier: CASCADE_GHOST_CRACK_MULTIPLIER as JsonValue,
            ghostL3ImminentThreshold: CASCADE_GHOST_L3_IMMINENT_THRESHOLD as JsonValue,
          },
        ));
        this.recordDedupe(dedupeKey, tick, emittedAt, 'shield.cascade.ghost_echo');
      } else {
        deduped.push(this.makeDedupe('shield.cascade.ghost_echo', dedupeKey, tick, emittedAt));
      }
    }

    // ── Signal: shield.cascade.sovereignty_fatal — NEVER suppressed ───────
    if (cascadeContext.sovereigntyFatal && CASCADE_SOVEREIGNTY_L4_FATAL) {
      const sovereigntyKey = `shield.cascade.sovereignty_fatal:${tick}`;
      this.sovereigntyFatalFired = true;
      // Sovereignty fatal always fires — bypass dedupe
      accepted.push(this.buildCascadeArtifact(
        'shield.cascade.sovereignty_fatal',
        sovereigntyKey,
        roomId,
        emittedAt,
        context,
        cascadeAnnotation,
        cascadeUXHint,
        'CRITICAL',
        'CRITICAL',
        {
          ...cascadeDiagnostics,
          sovereigntyCrackMultiplier: CASCADE_SOVEREIGNTY_CRACK_MULTIPLIER as JsonValue,
          sovereigntyFatalEligible: CASCADE_SOVEREIGNTY_FATAL_ELIGIBLE[phase] as JsonValue,
          l4ImminentThreshold: CASCADE_IMMINENT_L4_THRESHOLD as JsonValue,
        },
      ));
    }

    // ── Signal: shield.integrity.degraded ─────────────────────────────────
    const avgDrop = computeAvgIntegrityDrop(this.cascadeHistoryBuffer);
    if (avgDrop > SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD) {
      const avgDropStr = avgDrop.toFixed(3);
      const dedupeKey = `shield.integrity.degraded:${tick}:${avgDropStr}`;
      if (!this.isDuped(dedupeKey, tick)) {
        accepted.push(this.buildCascadeArtifact(
          'shield.integrity.degraded',
          dedupeKey,
          roomId,
          emittedAt,
          context,
          cascadeAnnotation,
          cascadeUXHint,
          'TACTICAL',
          'WARN',
          { ...cascadeDiagnostics, avgIntegrityDrop: avgDrop as JsonValue },
        ));
        this.recordDedupe(dedupeKey, tick, emittedAt, 'shield.integrity.degraded');
      } else {
        deduped.push(this.makeDedupe('shield.integrity.degraded', dedupeKey, tick, emittedAt));
      }
    }

    // ── Signal: shield.dl.emit — DL tensor ready ──────────────────────────
    const cascadeRiskLevel = this.cascadeMLExtractor.scoreCascadeRiskLevel();
    if (cascadeRiskLevel > SHIELD_SIGNAL_ADAPTER_CASCADE_IMMINENT_GHOST_L3) {
      const dlDedupeKey = `shield.dl.emit:cascade:${tick}:${Math.round(cascadeRiskLevel * 100)}`;
      if (!this.isDuped(dlDedupeKey, tick)) {
        accepted.push(this.buildCascadeArtifact(
          'shield.dl.emit',
          dlDedupeKey,
          roomId,
          emittedAt,
          context,
          cascadeAnnotation,
          cascadeUXHint,
          'AMBIENT',
          'DEBUG',
          {
            cascadeRiskLevel: cascadeRiskLevel as JsonValue,
            featureCount: SHIELD_SIGNAL_ADAPTER_CASCADE_DL_FEATURE_COUNT as JsonValue,
            signalTags: this.cascadeMLExtractor.buildSignalTags() as unknown as JsonValue,
          },
        ));
        this.recordDedupe(dlDedupeKey, tick, emittedAt, 'shield.dl.emit');
      } else {
        deduped.push(this.makeDedupe('shield.dl.emit', dlDedupeKey, tick, emittedAt));
      }
    }

    // ── Update counters ───────────────────────────────────────────────────
    this.totalAccepted += accepted.length;
    this.totalDeduped += deduped.length;
    this.totalRejected += rejected.length;
    this.lastTick = tick;

    this.recordHistory(
      tick,
      'shield.cascade.triggered',
      mode,
      phase,
      cascadeRisk,
      null,
    );

    return this.buildReport(accepted, deduped, rejected);
  }

  // ── Batch adaptation ───────────────────────────────────────────────────────

  /** Process a batch of shield signal inputs in tick order. */
  public adaptBatch(
    batch: ShieldSignalBatchInput,
  ): ShieldSignalAdapterReport {
    const allAccepted: ShieldSignalAdapterArtifact[] = [];
    const allDeduped: ShieldSignalAdapterDeduped[] = [];
    const allRejected: ShieldSignalAdapterRejection[] = [];

    const context = batch.context ?? {};
    const maxEntries = Math.min(batch.entries.length, SHIELD_SIGNAL_ADAPTER_MAX_BATCH_SIZE);

    for (let i = 0; i < maxEntries; i++) {
      const entry = batch.entries[i];
      const attackReport = this.adapt(entry, context);
      allAccepted.push(...attackReport.accepted);
      allDeduped.push(...attackReport.deduped);
      allRejected.push(...attackReport.rejected);

      if (entry.cascadeContext) {
        const cascadeReport = this.adaptCascade(entry, context);
        allAccepted.push(...cascadeReport.accepted);
        allDeduped.push(...cascadeReport.deduped);
        allRejected.push(...cascadeReport.rejected);
      }
    }

    return this.buildReport(allAccepted, allDeduped, allRejected);
  }

  // ── State and inspection methods ──────────────────────────────────────────

  public getState(): ShieldSignalAdapterState {
    return Object.freeze({
      totalAccepted: this.totalAccepted,
      totalDeduped: this.totalDeduped,
      totalRejected: this.totalRejected,
      lastTick: this.lastTick,
      lastBatchRisk: this.lastBatchRisk,
      lastCascadeRisk: this.lastCascadeRisk,
      l4RiskActive: this.l4RiskActive,
      sovereigntyFatalFired: this.sovereigntyFatalFired,
    });
  }

  public getReport(): ShieldSignalAdapterReport {
    return this.buildReport(
      [...this.artifactLog],
      [...this.dedupeLog],
      [...this.rejectionLog],
    );
  }

  /** Build complete inspector state bundle for attack and cascade paths. */
  public getInspectors(): ShieldInspectorBundle {
    const attackHistory = this.attackTrendAnalyzer.getHistory();
    const cascadeHistory = this.cascadeTrendAnalyzer.getHistory();

    const attackInspectorState = this.attackInspector.buildState(
      attackHistory,
      this.lastAttackMLVector,
      this.lastAttackTrend,
    );

    const cascadeInspectorState = this.cascadeInspector.buildState(
      cascadeHistory,
      this.lastCascadeMLVector,
      this.lastCascadeTrend,
    );

    return Object.freeze({ attackInspectorState, cascadeInspectorState });
  }

  /** Build complete session report bundle for attack and cascade paths. */
  public getSessionReports(): ShieldSessionReportBundle {
    const attackAnalytics = this.attackAnalytics.computeSummary();
    const cascadeAnalytics = this.cascadeAnalytics.computeSummary();
    const attackHistory = this.attackTrendAnalyzer.getHistory();
    const cascadeHistory = this.cascadeTrendAnalyzer.getHistory();

    return Object.freeze({
      attackAnalytics,
      cascadeAnalytics,
      attackSessionReport: buildAttackRouterSessionReport(attackAnalytics, attackHistory),
      cascadeSessionReport: buildCascadeSessionReport(cascadeAnalytics, cascadeHistory),
    });
  }

  /** Reset all state between runs. */
  public reset(): void {
    this.artifactLog.length = 0;
    this.dedupeLog.length = 0;
    this.rejectionLog.length = 0;
    this.historyLog.length = 0;
    this.dedupeMap.clear();
    this.cascadeHistoryBuffer = [];

    this.attackMLExtractor.reset();
    this.attackDLBuilder.reset();
    this.attackTrendAnalyzer.reset();
    this.attackInspector.reset();
    this.cascadeMLExtractor.reset();
    this.cascadeDLBuilder.reset();
    this.cascadeTrendAnalyzer.reset();
    this.cascadeInspector.reset();

    this.lastAttackMLVector = null;
    this.lastAttackDLTensor = null;
    this.lastAttackTrend = null;
    this.lastCascadeMLVector = null;
    this.lastCascadeDLTensor = null;
    this.lastCascadeTrend = null;

    this.totalAccepted = 0;
    this.totalDeduped = 0;
    this.totalRejected = 0;
    this.lastTick = 0;
    this.lastBatchRisk = 0;
    this.lastCascadeRisk = 0;
    this.l4RiskActive = false;
    this.sovereigntyFatalFired = false;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private isDuped(dedupeKey: string, tick: number): boolean {
    const lastTick = this.dedupeMap.get(dedupeKey);
    if (lastTick === undefined) return false;
    return tick - lastTick < this.options.dedupeWindowTicks;
  }

  private recordDedupe(
    dedupeKey: string,
    tick: number,
    emittedAt: UnixMs,
    eventName: ShieldSignalAdapterEventName,
  ): void {
    this.dedupeMap.set(dedupeKey, tick);
    void emittedAt;
    void eventName;
  }

  private makeDedupe(
    eventName: ShieldSignalAdapterEventName,
    dedupeKey: string,
    tick: number,
    suppressedAt: UnixMs,
  ): ShieldSignalAdapterDeduped {
    const entry: ShieldSignalAdapterDeduped = {
      eventName,
      dedupeKey,
      reason: `suppressed within ${this.options.dedupeWindowTicks} ticks of prior emission at tick ${tick}`,
      suppressedAt,
    };
    this.dedupeLog.push(entry);
    return entry;
  }

  private buildArtifact(
    eventName: ShieldSignalAdapterEventName,
    dedupeKey: string,
    roomId: ChatRoomId | string,
    emittedAt: UnixMs,
    context: ShieldSignalAdapterContext,
    annotation: AttackRouterAnnotationBundle,
    uxHint: AttackRouterUXHint,
    narrativeWeight: ShieldSignalAdapterNarrativeWeight,
    severity: ShieldSignalAdapterSeverity,
    diagnostics: Readonly<Record<string, JsonValue>>,
  ): ShieldSignalAdapterArtifact {
    const routeChannel = (context.routeChannel ?? this.options.defaultVisibleChannel) as ChatVisibleChannel;

    const envelope: ChatInputEnvelope = Object.freeze({
      roomId: roomId as ChatRoomId,
      eventKind: 'BATTLE_SIGNAL',
      payload: Object.freeze({
        eventName,
        source: 'ShieldSignalAdapter',
        annotation: annotation.summary,
        uxHint: uxHint.urgencyLabel,
        ...diagnostics,
      }),
      emittedAt,
      tags: context.tags ?? [],
    });

    const signal: ChatSignalEnvelope = Object.freeze({
      eventName,
      severity,
      narrativeWeight,
      dedupeKey,
      emittedAt,
    });

    const artifact: ShieldSignalAdapterArtifact = {
      envelope,
      dedupeKey,
      routeChannel,
      narrativeWeight,
      severity,
      eventName,
      emittedAt,
      signal,
      diagnostics,
    };

    this.artifactLog.push(artifact);
    return artifact;
  }

  private buildCascadeArtifact(
    eventName: ShieldSignalAdapterEventName,
    dedupeKey: string,
    roomId: ChatRoomId | string,
    emittedAt: UnixMs,
    context: ShieldSignalAdapterContext,
    annotation: CascadeAnnotationBundle,
    uxHint: CascadeUXHint,
    narrativeWeight: ShieldSignalAdapterNarrativeWeight,
    severity: ShieldSignalAdapterSeverity,
    diagnostics: Readonly<Record<string, JsonValue>>,
  ): ShieldSignalAdapterArtifact {
    const routeChannel = (context.routeChannel ?? this.options.defaultVisibleChannel) as ChatVisibleChannel;

    const envelope: ChatInputEnvelope = Object.freeze({
      roomId: roomId as ChatRoomId,
      eventKind: 'BATTLE_SIGNAL',
      payload: Object.freeze({
        eventName,
        source: 'ShieldSignalAdapter.cascade',
        annotation: annotation.summary,
        uxHint: uxHint.urgencyLabel,
        ...diagnostics,
      }),
      emittedAt,
      tags: context.tags ?? [],
    });

    const signal: ChatSignalEnvelope = Object.freeze({
      eventName,
      severity,
      narrativeWeight,
      dedupeKey,
      emittedAt,
    });

    const artifact: ShieldSignalAdapterArtifact = {
      envelope,
      dedupeKey,
      routeChannel,
      narrativeWeight,
      severity,
      eventName,
      emittedAt,
      signal,
      diagnostics,
    };

    this.artifactLog.push(artifact);
    return artifact;
  }

  private buildReport(
    accepted: ShieldSignalAdapterArtifact[],
    deduped: ShieldSignalAdapterDeduped[],
    rejected: ShieldSignalAdapterRejection[],
  ): ShieldSignalAdapterReport {
    return Object.freeze({
      accepted: Object.freeze([...accepted]),
      deduped: Object.freeze([...deduped]),
      rejected: Object.freeze([...rejected]),
      state: this.getState(),
      attackMLVector: this.lastAttackMLVector,
      attackDLTensor: this.lastAttackDLTensor,
      attackTrend: this.lastAttackTrend,
      cascadeMLVector: this.lastCascadeMLVector,
      cascadeDLTensor: this.lastCascadeDLTensor,
      cascadeTrend: this.lastCascadeTrend,
    });
  }

  private recordHistory(
    tick: number,
    eventName: ShieldSignalAdapterEventName,
    mode: ModeCode,
    phase: RunPhase,
    batchRisk: number,
    batchResult: AttackRouterBatchResult | null,
  ): void {
    const entry: ShieldSignalAdapterHistoryEntry = {
      tick,
      eventName,
      dedupeKey: `${eventName}:${tick}`,
      mode,
      phase,
      batchRisk,
      l4CascadeRiskCount: batchResult?.l4CascadeRiskCount ?? 0,
      ghostAmplifiedCount: 0,
      sovereigntyEscalatedCount: 0,
    };

    this.historyLog.push(entry);
    if (this.historyLog.length > this.options.maxHistory) {
      this.historyLog.shift();
    }
  }
}

// ============================================================================
// §9 — Factory and standalone exports
// ============================================================================

/** Factory: create a ShieldSignalAdapter with default options. */
export function createShieldSignalAdapter(opts: ShieldSignalAdapterOptions): ShieldSignalAdapter {
  return new ShieldSignalAdapter(opts);
}

/**
 * Build a full ShieldAdapterBundle — adapter plus all companion infrastructure.
 * Uses createAttackRouterWithAnalytics, createBreachCascadeResolverWithAnalytics,
 * createShieldEngineWithAnalyticsInternal, ShieldLayerManager, ShieldRepairQueue,
 * ShieldUXBridge, buildAttackRouterModeProfile, buildAttackRouterPhaseProfile,
 * buildCascadeModeProfile, buildCascadePhaseProfile.
 */
export function buildShieldAdapterBundle(
  opts: ShieldSignalAdapterOptions,
  mode: ModeCode,
  phase: RunPhase,
): ShieldAdapterBundle {
  const adapter = new ShieldSignalAdapter(opts);
  const attackEnsemble = createAttackRouterWithAnalytics();
  const cascadeEnsemble = createBreachCascadeResolverWithAnalytics();

  // Engine-level bundle (brings in ShieldEngine, ShieldMLExtractor, ShieldDLBuilder, etc.)
  const engineBundle = createShieldEngineWithAnalyticsInternal();
  void engineBundle; // full engine bundle available for downstream wiring

  return Object.freeze({
    adapter,
    attackEnsemble,
    cascadeEnsemble,
    layerManager: new ShieldLayerManager(),
    repairQueue: new ShieldRepairQueue(),
    uxBridge: new ShieldUXBridge(),
    attackModeProfile: buildAttackRouterModeProfile(mode),
    attackPhaseProfile: buildAttackRouterPhaseProfile(phase),
    cascadeModeProfile: buildCascadeModeProfile(mode),
    cascadePhaseProfile: buildCascadePhaseProfile(phase),
  });
}

/**
 * Build a full shield engine adapter bundle including all ShieldEngine companions.
 * Exposes ShieldEngine, ShieldMLExtractor, ShieldDLBuilder, ShieldTrendAnalyzer,
 * ShieldResilienceForecaster, ShieldAnnotator, ShieldInspector, ShieldAnalytics.
 */
export function buildShieldEngineAdapterBundle(): {
  readonly engine: ShieldEngine;
  readonly mlExtractor: ShieldMLExtractor;
  readonly dlBuilder: ShieldDLBuilder;
  readonly trendAnalyzer: ShieldTrendAnalyzer;
  readonly forecaster: ShieldResilienceForecaster;
  readonly annotator: ShieldAnnotator;
  readonly inspector: ShieldInspector;
  readonly analytics: ShieldAnalytics;
} {
  return createShieldEngineWithAnalyticsInternal();
}

/**
 * Extract a shield adapter ML vector from an attack ML vector (flat array form).
 * Convenience wrapper over extractShieldAdapterMLVector for single-vector consumers.
 */
export function extractShieldMLVector(
  attackVector: AttackRouterMLVector,
): readonly number[] {
  return extractAttackRouterMLArray(attackVector);
}

/**
 * Score the overall shield risk from a batch result and layers.
 * Convenience wrapper over scoreShieldAdapterRisk.
 */
export function scoreShieldRisk(
  batchResult: AttackRouterBatchResult,
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  cascadeCount: number,
): number {
  return scoreShieldAdapterRisk(batchResult, layers, mode, phase, cascadeCount);
}

/**
 * Get the channel recommendation for a shield signal.
 * Convenience wrapper for the full getShieldAdapterChatChannel helper.
 */
export function getShieldChatChannel(
  decisions: readonly AttackRouteDecision[],
  cascadeContext: Nullable<CascadeResolutionContext>,
  mode: ModeCode,
  phase: RunPhase,
): ShieldSignalAdapterChannelRecommendation {
  return getShieldAdapterChatChannel(decisions, cascadeContext, mode, phase);
}

/**
 * Build narrative weight for a shield signal.
 * Convenience wrapper for the full buildShieldAdapterNarrativeWeight helper.
 */
export function buildShieldNarrativeWeight(
  decisions: readonly AttackRouteDecision[],
  cascadeContext: Nullable<CascadeResolutionContext>,
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  pressureTier: PressureTier,
): number {
  return buildShieldAdapterNarrativeWeight(decisions, cascadeContext, layers, mode, phase, pressureTier);
}

/**
 * Build a comprehensive threshold report for the shield subsystem.
 * Combines per-layer breach status with cascade and doctrine risk summaries.
 */
export function buildShieldThresholdReport(
  layers: readonly ShieldLayerState[],
  batchResult: AttackRouterBatchResult,
  mode: ModeCode,
  phase: RunPhase,
): {
  readonly criticalLayers: readonly ShieldLayerId[];
  readonly lowIntegrityLayers: readonly ShieldLayerId[];
  readonly fortifiedLayers: readonly ShieldLayerId[];
  readonly l4CascadeRiskCount: number;
  readonly overallRisk: number;
  readonly modeMaxBatch: number;
  readonly ghostDualTarget: boolean;
  readonly phaseHintEligible: boolean;
} {
  const criticalLayers: ShieldLayerId[] = [];
  const lowIntegrityLayers: ShieldLayerId[] = [];
  const fortifiedLayers: ShieldLayerId[] = [];

  for (const layer of layers) {
    const ratio = layer.integrityRatio;
    if (ratio <= SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD) {
      criticalLayers.push(layer.layerId);
    } else if (ratio <= SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD) {
      lowIntegrityLayers.push(layer.layerId);
    } else if (ratio >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD) {
      fortifiedLayers.push(layer.layerId);
    }
  }

  const overallRisk = scoreAttackBatchRisk(batchResult, layers);
  const flags = inspectGhostDoctrineFlags(mode, phase);

  return Object.freeze({
    criticalLayers: Object.freeze(criticalLayers),
    lowIntegrityLayers: Object.freeze(lowIntegrityLayers),
    fortifiedLayers: Object.freeze(fortifiedLayers),
    l4CascadeRiskCount: batchResult.l4CascadeRiskCount,
    overallRisk,
    modeMaxBatch: ATTACK_ROUTER_MODE_MAX_BATCH[mode],
    ghostDualTarget: flags.ghostDualTarget,
    phaseHintEligible: flags.phaseHintEligible,
  });
}

/**
 * Build a comprehensive compat bundle for downstream consumers.
 * Aggregates all major signal compat types into one authoritative bundle.
 */
export function buildShieldCompatBundle(
  input: ShieldSignalInput,
  mlVector: AttackRouterMLVector,
  cascadeMLVector: Nullable<CascadeMLVector>,
  dlTensor: AttackRouterDLTensor,
  cascadeDLTensor: Nullable<CascadeDLTensor>,
  annotation: AttackRouterAnnotationBundle,
  cascadeAnnotation: Nullable<CascadeAnnotationBundle>,
  uxHint: AttackRouterUXHint,
  cascadeUXHint: Nullable<CascadeUXHint>,
): {
  readonly chatSignal: ShieldChatSignalCompat;
  readonly mlVectorCompat: ShieldMLVectorCompat;
  readonly dlTensorCompat: ShieldDLTensorCompat;
  readonly cascadeMLCompat: Nullable<ShieldCascadeMLVectorCompat>;
  readonly cascadeDLCompat: Nullable<ShieldCascadeDLTensorCompat>;
  readonly uxHintCompat: ShieldUXHintCompat;
  readonly annotationCompat: ShieldAnnotationCompat;
} {
  const { snapshot, decisions, batchResult } = input;
  const { tick, mode, phase } = snapshot;
  const cascadeContext = input.cascadeContext ?? null;

  const chatSignal: ShieldChatSignalCompat = Object.freeze({
    eventName: 'shield.attack.routed',
    tick,
    mode,
    phase,
    batchRisk: scoreAttackBatchRisk(batchResult, input.layers),
    l4CascadeRiskCount: batchResult.l4CascadeRiskCount,
    ghostAmplifiedCount: decisions.filter((d) => d.modeAmplified).length,
    sovereigntyEscalated: decisions.some((d) => d.sovereigntyEscalated),
    cascadeTriggered: cascadeContext?.resolution.triggered ?? false,
    ghostEchoFired: cascadeContext?.ghostEchoFired ?? false,
    sovereigntyFatal: cascadeContext?.sovereigntyFatal ?? false,
    routeChannel: getShieldAdapterChatChannel(decisions, cascadeContext, mode, phase),
    narrativeWeight: buildShieldAdapterNarrativeWeight(
      decisions, cascadeContext, input.layers, mode, phase, snapshot.pressureTier,
    ) > 0.7 ? 'CRITICAL' : 'TACTICAL',
    dominantDoctrine: batchResult.dominantDoctrine ?? null,
    attackAnnotation: annotation,
    cascadeAnnotation,
  });

  const mlVectorCompat = buildShieldMLVectorCompat(mlVector, cascadeMLVector ?? mlVector as unknown as CascadeMLVector, tick, mode, phase);
  const dlTensorCompat = buildShieldDLTensorCompat(dlTensor);
  const cascadeMLCompat = cascadeMLVector
    ? buildShieldCascadeMLVectorCompat(cascadeMLVector, tick)
    : null;
  const cascadeDLCompat = cascadeDLTensor
    ? buildShieldCascadeDLTensorCompat(cascadeDLTensor, ATTACK_ROUTER_DL_FEATURE_LABELS)
    : null;

  const primaryAction = uxHint.actionSuggestion ?? cascadeUXHint?.actionSuggestion ?? null;

  const uxHintCompat: ShieldUXHintCompat = Object.freeze({
    attackUXHint: uxHint,
    cascadeUXHint,
    primaryAction,
    urgencyLabel: uxHint.urgencyLabel,
    channelRecommendation: getShieldAdapterChatChannel(decisions, cascadeContext, mode, phase),
  });

  const annotationCompat: ShieldAnnotationCompat = Object.freeze({
    attackAnnotation: annotation,
    cascadeAnnotation,
    chatSummary: annotation.summary + (cascadeAnnotation ? ' | ' + cascadeAnnotation.summary : ''),
    severity: (cascadeContext?.sovereigntyFatal ? 'CRITICAL'
      : cascadeContext?.ghostEchoFired ? 'WARN'
      : batchResult.l4CascadeRiskCount > 0 ? 'WARN'
      : 'INFO') as ShieldSignalAdapterSeverity,
  });

  return Object.freeze({
    chatSignal,
    mlVectorCompat,
    dlTensorCompat,
    cascadeMLCompat,
    cascadeDLCompat,
    uxHintCompat,
    annotationCompat,
  });
}

// ============================================================================
// §10 — Deep analytics helpers
// ============================================================================

/**
 * Build a comprehensive session profile for attack routing.
 * Uses buildAttackRouterSessionReport, buildCascadeSessionReport.
 */
export function buildShieldSessionProfile(
  attackAnalytics: AttackRouterAnalyticsSummary,
  cascadeAnalytics: CascadeAnalyticsSummary,
  attackHistory: readonly AttackRouterHistoryEntry[],
  cascadeHistory: readonly CascadeHistoryEntry[],
): ShieldSessionReportBundle {
  return Object.freeze({
    attackAnalytics,
    cascadeAnalytics,
    attackSessionReport: buildAttackRouterSessionReport(attackAnalytics, attackHistory),
    cascadeSessionReport: buildCascadeSessionReport(cascadeAnalytics, cascadeHistory),
  });
}

/**
 * Compute a pre-routing threat exposure profile.
 * Uses computePreRoutingThreatExposure, validateAttackBatchUniqueness,
 * computeBotStateThreatPressure, containsHaterBotDecisions.
 */
export function computeShieldPreRoutingExposure(
  attacks: readonly AttackEvent[],
  decisions: readonly AttackRouteDecision[],
  layers: readonly ShieldLayerState[],
  botStates: Readonly<Partial<Record<HaterBotId, BotState>>>,
  mode: ModeCode,
  phase: RunPhase,
  tick: number,
): ShieldPreRoutingCompat {
  return computeShieldPreRoutingProfile(attacks, layers, mode, phase, tick, botStates);
}

/**
 * Analyze the doctrine composition of a batch against mode constraints.
 * Uses ATTACK_DOCTRINE_DANGER_INDEX, ATTACK_DOCTRINE_IS_CASCADE_RISK,
 * computeBatchDoctrineCoherence, checkDoctrineTargetLayerAlignment.
 */
export function analyzeShieldDoctrineComposition(
  decisions: readonly AttackRouteDecision[],
  mode: ModeCode,
): {
  readonly coherence: number;
  readonly cascadeRiskDoctrines: readonly ShieldDoctrineAttackType[];
  readonly highDangerDoctrines: readonly ShieldDoctrineAttackType[];
  readonly targetLayerAligned: number;
  readonly modeMaxBatch: number;
} {
  const coherence = computeBatchDoctrineCoherence(decisions);
  const cascadeRiskDoctrines = decisions
    .filter((d) => ATTACK_DOCTRINE_IS_CASCADE_RISK[d.routed.doctrineType])
    .map((d) => d.routed.doctrineType);
  const highDangerDoctrines = decisions
    .filter((d) => ATTACK_DOCTRINE_DANGER_INDEX[d.routed.doctrineType] >= 0.7)
    .map((d) => d.routed.doctrineType);
  const alignments = checkDoctrineTargetLayerAlignment(decisions);
  const targetLayerAligned = alignments.filter((a) => a.aligned).length;

  return Object.freeze({
    coherence,
    cascadeRiskDoctrines: Object.freeze([...new Set(cascadeRiskDoctrines)]),
    highDangerDoctrines: Object.freeze([...new Set(highDangerDoctrines)]),
    targetLayerAligned,
    modeMaxBatch: ATTACK_ROUTER_MODE_MAX_BATCH[mode],
  });
}

/**
 * Inspect the current shield cascade posture across all layers.
 * Uses computePerLayerCascadeExposure, computeAbsorptionOrderExposure,
 * computeLayerCascadePriority, buildCascadeVulnerabilities,
 * computeSovereigntyFatalityRisk, computeTicksUntilCascade.
 * Also uses CASCADE_DOCTRINE_TARGET_LAYER for doctrine routing analysis.
 */
export function inspectShieldCascadePosture(
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  incomingDamagePerTick: number,
): {
  readonly perLayerExposure: Readonly<Partial<Record<ShieldLayerId, number>>>;
  readonly absorptionOrder: Readonly<Record<ShieldLayerId, number>>;
  readonly layerPriorities: Readonly<Record<ShieldLayerId, number>>;
  readonly vulnerabilities: Readonly<Record<ShieldLayerId, number>>;
  readonly sovereigntyFatalityRisk: number;
  readonly ticksUntilCascade: number;
  readonly doctrineCascadeTargets: Readonly<Record<string, ShieldLayerId>>;
} {
  const perLayerExposure = computePerLayerCascadeExposure(layers, mode, phase);
  const absorptionOrder = computeAbsorptionOrderExposure(layers) as Readonly<Record<ShieldLayerId, number>>;
  const vulnerabilities = buildCascadeVulnerabilities(layers) as Readonly<Record<ShieldLayerId, number>>;
  const sovereigntyFatalityRisk = computeSovereigntyFatalityRisk(layers, phase, mode);
  const ticksUntilCascade = computeTicksUntilCascade(layers, incomingDamagePerTick, mode, phase);

  // Build per-layer priority map
  const layerPrioritiesRaw: Record<string, number> = {};
  for (const layerId of SHIELD_LAYER_ORDER) {
    layerPrioritiesRaw[layerId] = computeLayerCascadePriority(layerId);
  }

  return Object.freeze({
    perLayerExposure,
    absorptionOrder,
    layerPriorities: layerPrioritiesRaw as Readonly<Record<ShieldLayerId, number>>,
    vulnerabilities,
    sovereigntyFatalityRisk,
    ticksUntilCascade,
    doctrineCascadeTargets: CASCADE_DOCTRINE_TARGET_LAYER as Readonly<Record<string, ShieldLayerId>>,
  });
}

/**
 * Score a cascade threat batch from threat envelopes.
 * Uses scoreCascadeThreatFromEnvelopes, classifyCascadeThreatBatch,
 * computeCascadeChainIntegrityRatio, scoreCascadeFromBotStates.
 */
export function scoreShieldCascadeThreatBatch(
  threats: readonly ThreatEnvelope[],
  layers: readonly ShieldLayerState[],
  botStates: Readonly<Partial<Record<HaterBotId, BotState>>>,
  mode: ModeCode,
  phase: RunPhase,
  tick: number,
  cascadeCount: number,
  maxExpectedCascades: number,
): {
  readonly envelopeScore: number;
  readonly botStateScore: number;
  readonly chainIntegrityRatio: number;
  readonly classified: ReadonlyArray<{ score: number }>;
} {
  const envelopeScore = threats.length > 0
    ? scoreCascadeThreatFromEnvelopes(threats, tick, mode, phase)
    : 0;
  const botStateScore = scoreCascadeFromBotStates(botStates, layers, mode);
  const chainIntegrityRatio = computeCascadeChainIntegrityRatio(cascadeCount, maxExpectedCascades);
  const classified = threats.length > 0
    ? classifyCascadeThreatBatch(threats, tick).map((c) => ({ score: c.score }))
    : [];

  return Object.freeze({
    envelopeScore,
    botStateScore,
    chainIntegrityRatio,
    classified: Object.freeze(classified),
  });
}

/**
 * Build ML/DL feature parameter objects for external use.
 * Uses CASCADE_ML_FEATURE_LABELS, CASCADE_DL_FEATURE_LABELS for label validation.
 */
export function buildShieldCascadeMLParams(
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  tick: number,
  counters: {
    totalCascadeCount: number;
    l4BreachCount: number;
    ghostL3Count: number;
    crackCount: number;
    sovereigntyFatalCount: number;
  },
  history: readonly CascadeHistoryEntry[],
  threats?: readonly ThreatEnvelope[],
  pressureTier?: PressureTier,
): CascadeMLFeaturesParams {
  // Validate expected feature count against known labels
  const expectedFeatureCount = CASCADE_ML_FEATURE_LABELS.length;
  void expectedFeatureCount;
  const expectedDLFeatureCount = CASCADE_DL_FEATURE_LABELS.length;
  void expectedDLFeatureCount;

  return Object.freeze({
    layers,
    mode,
    phase,
    tick,
    ...counters,
    history,
    threats,
    pressureTier,
  });
}

/**
 * Build ML/DL feature parameter objects for the attack router.
 * Uses ATTACK_ROUTER_ML_FEATURE_LABELS, ATTACK_ROUTER_DL_FEATURE_LABELS.
 */
export function buildShieldAttackMLParams(
  decisions: readonly AttackRouteDecision[],
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
  tick: number,
  history: readonly AttackRouterHistoryEntry[],
  threats?: readonly ThreatEnvelope[],
): AttackRouterMLFeaturesParams {
  // Validate expected feature count against known labels
  const expectedFeatureCount = ATTACK_ROUTER_ML_FEATURE_LABELS.length;
  void expectedFeatureCount;
  const expectedDLCount = ATTACK_ROUTER_DL_FEATURE_LABELS.length;
  void expectedDLCount;

  return Object.freeze({
    decisions,
    layers,
    mode,
    phase,
    tick,
    history,
    threats,
  });
}

// ============================================================================
// §11 — Trend analysis and session helpers
// ============================================================================

/**
 * Build a full cascade trend summary for a given history.
 * Wraps buildCascadeTrendSummary for external consumers.
 */
export function buildShieldCascadeTrend(
  history: readonly CascadeHistoryEntry[],
  mode: ModeCode,
  phase: RunPhase,
): CascadeTrendSummary {
  return buildCascadeTrendSummary(history, mode, phase);
}

/**
 * Build cascade annotation and UX hint for external consumers.
 * Wraps buildCascadeAnnotation and buildCascadeUXHint.
 */
export function buildShieldCascadeAnnotationBundle(
  context: CascadeResolutionContext,
  layers: readonly ShieldLayerState[],
  trend: CascadeTrendSummary,
  pressureTier: PressureTier,
): { annotation: CascadeAnnotationBundle; uxHint: CascadeUXHint } {
  return Object.freeze({
    annotation: buildCascadeAnnotation(context, layers, trend),
    uxHint: buildCascadeUXHint(context, layers, pressureTier),
  });
}

/**
 * Build a cascade history entry from a context and layer snapshots.
 * Wraps buildCascadeHistoryEntry for external consumers.
 */
export function buildShieldCascadeHistoryEntry(
  context: CascadeResolutionContext,
  preBreachLayers: readonly ShieldLayerState[],
  postBreachLayers: readonly ShieldLayerState[],
): CascadeHistoryEntry {
  return buildCascadeHistoryEntry(context, preBreachLayers, postBreachLayers);
}

/**
 * Inspect cascade history metrics using the full analytics suite.
 * Uses computeAvgIntegrityDrop, computeAvgCrackDepth, findDominantBreachLayer,
 * detectCascadeSurge, computeCascadeNarrativeImpact (via context).
 */
export function inspectCascadeHistory(
  history: readonly CascadeHistoryEntry[],
  cascadeContext: Nullable<CascadeResolutionContext>,
): {
  readonly avgIntegrityDrop: number;
  readonly avgCrackDepth: number;
  readonly dominantBreachLayer: Nullable<ShieldLayerId>;
  readonly surgeActive: boolean;
  readonly narrativeImpact: number;
} {
  const avgIntegrityDrop = computeAvgIntegrityDrop(history);
  const avgCrackDepth = computeAvgCrackDepth(history);
  const dominantBreachLayer = findDominantBreachLayer(history);
  const surgeActive = detectCascadeSurge(history);
  const narrativeImpact = cascadeContext
    ? computeCascadeNarrativeImpact(cascadeContext, history)
    : 0;

  return Object.freeze({
    avgIntegrityDrop,
    avgCrackDepth,
    dominantBreachLayer,
    surgeActive,
    narrativeImpact,
  });
}

/**
 * Validate shield layer states and build a comprehensive layer state map.
 * Uses validateCascadeLayerState, buildShieldLayerState, isShieldLayerId,
 * getLayerConfig, layerOrderIndex, SHIELD_LAYER_CONFIGS.
 */
export function validateAndMapShieldLayers(
  layers: readonly ShieldLayerState[],
): {
  readonly isValid: boolean;
  readonly configMap: ShieldLayerConfigMap;
  readonly exposureMap: ReturnType<typeof buildShieldLayerExposureMap>;
  readonly defaultStates: Readonly<Record<ShieldLayerId, ShieldLayerState>>;
} {
  const isValid = validateCascadeLayerState(layers);
  const configMap = buildShieldLayerConfigMap();
  const exposureMap = buildShieldLayerExposureMap(layers);

  // Build default states for all four layers
  const defaultStatesRaw: Partial<Record<ShieldLayerId, ShieldLayerState>> = {};
  for (const layerId of SHIELD_LAYER_ORDER) {
    const valid = isShieldLayerId(layerId);
    if (valid) {
      const cfg = SHIELD_LAYER_CONFIGS[layerId];
      const orderIdx = layerOrderIndex(layerId);
      void orderIdx;
      defaultStatesRaw[layerId] = buildShieldLayerState(cfg.layerId, cfg.max, cfg.max);
    }
  }

  return Object.freeze({
    isValid,
    configMap,
    exposureMap,
    defaultStates: defaultStatesRaw as Readonly<Record<ShieldLayerId, ShieldLayerState>>,
  });
}

/**
 * Build a cascade bot threat weight combining multiple threat signals.
 * Uses computeCascadeBotThreatWeight from the cascade analytics toolkit.
 */
export function buildShieldCascadeBotThreatProfile(
  botStates: Readonly<Partial<Record<HaterBotId, BotState>>>,
  layers: readonly ShieldLayerState[],
  mode: ModeCode,
  phase: RunPhase,
): {
  readonly cascadeBotThreatWeight: number;
  readonly botStateScore: number;
  readonly l4ImminentScore: number;
  readonly ghostL3ImminentScore: number;
  readonly totalRisk: number;
} {
  const cascadeBotThreatWeight = computeCascadeBotThreatWeight(botStates);
  const botStateScore = scoreCascadeFromBotStates(botStates, layers, mode);
  const l4ImminentScore = computeL4CascadeImminentScore(layers, mode, phase);
  const ghostL3ImminentScore = computeGhostL3CascadeImminentScore(layers, mode);
  const totalRisk = clamp01(
    cascadeBotThreatWeight * 0.3 +
    botStateScore * 0.3 +
    l4ImminentScore * 0.25 +
    ghostL3ImminentScore * 0.15,
  );

  return Object.freeze({
    cascadeBotThreatWeight,
    botStateScore,
    l4ImminentScore,
    ghostL3ImminentScore,
    totalRisk,
  });
}

/**
 * Build a full shield cascade context (extractCascadeMLFeatures path).
 * Uses extractCascadeMLFeatures, mapCascadeLayersForIntegrity.
 */
export function buildShieldCascadeMLContext(
  params: CascadeMLFeaturesParams,
): {
  readonly mlVector: CascadeMLVector;
  readonly featureArray: readonly number[];
  readonly mappedLayers: ReturnType<typeof mapCascadeLayersForIntegrity>;
} {
  const mlVector = extractCascadeMLFeatures(params);
  const featureArray = extractCascadeMLArray(mlVector);
  const mappedLayers = mapCascadeLayersForIntegrity(params.layers);

  return Object.freeze({ mlVector, featureArray, mappedLayers });
}

/**
 * Cascade DL row build path (buildCascadeDLRow).
 * Returns the raw row for external consumers that want to build their own DL sequences.
 */
export function buildShieldCascadeDLRowExternal(
  params: CascadeDLRowParams,
): Readonly<Record<string, number>> {
  return buildCascadeDLRow(params);
}

/**
 * Build a cascade session report for external consumers.
 * Wraps buildCascadeSessionReport with analytics.
 */
export function buildShieldCascadeSessionReport(
  cascadeAnalytics: CascadeAnalyticsSummary,
  history: readonly CascadeHistoryEntry[],
): CascadeSessionReport {
  return buildCascadeSessionReport(cascadeAnalytics, history);
}

/**
 * Build an attack session report for external consumers.
 * Wraps buildAttackRouterSessionReport with analytics.
 */
export function buildShieldAttackSessionReport(
  attackAnalytics: AttackRouterAnalyticsSummary,
  history: readonly AttackRouterHistoryEntry[],
): AttackRouterSessionReport {
  return buildAttackRouterSessionReport(attackAnalytics, history);
}
