/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT ADAPTER SUITE BARREL
 * FILE: backend/src/game/engine/chat/adapters/index.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend-chat adapter barrel and orchestration surface for the four
 * authoritative upstream translation lanes:
 *
 * - BattleSignalAdapter
 * - RunSignalAdapter
 * - MultiplayerSignalAdapter
 * - EconomySignalAdapter
 *
 * This file is intentionally large because it does more than re-export classes.
 * It is the adapter-suite authority used by backend chat to treat upstream
 * domains as sovereign while still normalizing them into one backend-chat
 * ingress surface.
 *
 * Backend-truth question
 * ----------------------
 *   "How does backend chat ingest battle, run, multiplayer, and economy truth
 *    through one authoritative adapter suite without flattening the original
 *    domain semantics or letting transport/UI become the source of truth?"
 *
 * This file answers that by owning:
 * - the canonical barrel exports for all backend chat adapters,
 * - suite-level construction and configuration law,
 * - domain routing and runtime ingress normalization,
 * - bundle adaptation and mixed-domain batch ingestion,
 * - suite-level dedupe/report aggregation,
 * - diagnostics, readiness, and health reporting,
 * - stable manifest metadata for the adapter subtree,
 * - and a clean entry surface for ChatEventBridge / ChatEngine composition.
 *
 * It does not own:
 * - transcript mutation,
 * - moderation or rate policy,
 * - socket/session transport,
 * - replay persistence,
 * - or final NPC/helper/hater authoring.
 *
 * Design laws
 * -----------
 * - Each upstream engine keeps its own language.
 * - Backend chat consumes truth; it does not re-simulate the source domain.
 * - The adapter suite may unify ingress, but it may not genericize semantics.
 * - Mixed-domain batches must preserve order for replay/debugging.
 * - Adapter health must be inspectable at runtime.
 * - The barrel itself must be useful as a real orchestration module.
 *
 * Canonical tree alignment
 * ------------------------
 * This file belongs under:
 *   backend/src/game/engine/chat/adapters/index.ts
 *
 * and serves the authoritative backend lane described by the locked backend
 * simulation tree under:
 *   /backend/src/game/engine/chat
 *
 * It is intentionally backend-pure:
 * - no socket ownership,
 * - no frontend-only types,
 * - no UI rendering concerns,
 * - no transport-specific mutability.
 * ============================================================================
 */

import {
  asUnixMs,
  type ChatInputEnvelope,
  type ChatRoomId,
  type ChatSignalEnvelope,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type UnixMs,
} from '../types';

import {
  BattleSignalAdapter,
  type BattleSignalAdapterArtifact,
  type BattleSignalAdapterContext,
  type BattleSignalAdapterEventName,
  type BattleSignalAdapterOptions,
  type BattleSignalAdapterRejection,
  type BattleSignalAdapterReport,
  type BattleSignalAdapterState,
  type BattleSnapshotCompat,
} from './BattleSignalAdapter';

import {
  RunSignalAdapter,
  type RunSignalAdapterArtifact,
  type RunSignalAdapterContext,
  type RunSignalAdapterEventName,
  type RunSignalAdapterOptions,
  type RunSignalAdapterRejection,
  type RunSignalAdapterReport,
  type RunSignalAdapterState,
  type RunSnapshotCompat,
} from './RunSignalAdapter';

import {
  MultiplayerSignalAdapter,
  type MultiplayerRoomCompat,
  type MultiplayerSignalAdapterAccepted,
  type MultiplayerSignalAdapterContext,
  type MultiplayerSignalAdapterDeduped,
  type MultiplayerSignalAdapterEventName,
  type MultiplayerSignalAdapterOptions,
  type MultiplayerSignalAdapterRejected,
  type MultiplayerSignalAdapterReport,
  type MultiplayerSignalAdapterState,
} from './MultiplayerSignalAdapter';

import {
  EconomySignalAdapter,
  type EconomyDealSnapshotCompat,
  type EconomyOfferPayloadCompat,
  type EconomySignalAdapterAccepted,
  type EconomySignalAdapterContext,
  type EconomySignalAdapterDeduped,
  type EconomySignalAdapterEventName,
  type EconomySignalAdapterOptions,
  type EconomySignalAdapterRejected,
  type EconomySignalAdapterReport,
  type EconomySignalAdapterState,
} from './EconomySignalAdapter';

import {
  CoreMLSignalAdapter,
  type CoreDLPacketInput,
  type CoreMLSignalAdapterArtifact,
  type CoreMLSignalAdapterContext,
  type CoreMLSignalAdapterOptions,
  type CoreMLSignalAdapterReport,
  type CoreMLSignalAdapterState,
  type CoreMLSignalInput,
  type CoreMLSignalNarrativeWeight,
  type CoreMLSignalSeverity,
} from './CoreMLSignalAdapter';

import {
  EngineSignalChatAdapter,
  type EngineMLSignalInput,
  type EngineSignalChatAdapterContext,
  type EngineSignalChatAdapterOptions,
  type EngineSignalChatAdapterReport,
  type EngineSignalChatAdapterState,
  type EngineSignalInput,
  type WindowMLContextInput,
  type EngineSignalAggregatorInput,
  type EngineSignalChatArtifact,
  createEngineSignalChatAdapter,
} from './EngineSignalChatAdapter';

import {
  GamePrimitivesSignalAdapter,
  createGamePrimitivesSignalAdapter,
  type GamePrimitivesAttackCompat,
  type GamePrimitivesCascadeCompat,
  type GamePrimitivesChatSignalCompat,
  type GamePrimitivesLegendMarkerCompat,
  type GamePrimitivesMLVectorCompat,
  type GamePrimitivesPressureCompat,
  type GamePrimitivesRunExperienceCompat,
  type GamePrimitivesSignalAdapterArtifact,
  type GamePrimitivesSignalAdapterContext,
  type GamePrimitivesSignalAdapterDeduped,
  type GamePrimitivesSignalAdapterEventName,
  type GamePrimitivesSignalAdapterHistoryEntry,
  type GamePrimitivesSignalAdapterNarrativeWeight,
  type GamePrimitivesSignalAdapterOptions,
  type GamePrimitivesSignalAdapterRejection,
  type GamePrimitivesSignalAdapterReport,
  type GamePrimitivesSignalAdapterSeverity,
  type GamePrimitivesSignalAdapterState,
} from './GamePrimitivesSignalAdapter';

import {
  RegistrySignalAdapter,
  createRegistrySignalAdapter,
  type RegistryCapabilityReportCompat,
  type RegistryChatSignalCompat,
  type RegistryEngineHealthCompat,
  type RegistryMLVectorCompat,
  type RegistrySignalAdapterArtifact,
  type RegistrySignalAdapterContext,
  type RegistrySignalAdapterDeduped,
  type RegistrySignalAdapterEventName,
  type RegistrySignalAdapterHistoryEntry,
  type RegistrySignalAdapterNarrativeWeight,
  type RegistrySignalAdapterOptions,
  type RegistrySignalAdapterRejection,
  type RegistrySignalAdapterReport,
  type RegistrySignalAdapterSeverity,
  type RegistrySignalAdapterState,
} from './RegistrySignalAdapter';

import {
  TickTransactionSignalAdapter,
  createTickTransactionSignalAdapter,
  type TickTransactionChatSignalCompat,
  type TickTransactionHealthReportCompat,
  type TickTransactionSignalAdapterArtifact,
  type TickTransactionSignalAdapterContext,
  type TickTransactionSignalAdapterDeduped,
  type TickTransactionSignalAdapterEventName,
  type TickTransactionSignalAdapterHistoryEntry,
  type TickTransactionSignalAdapterNarrativeWeight,
  type TickTransactionSignalAdapterOptions,
  type TickTransactionSignalAdapterRejection,
  type TickTransactionSignalAdapterReport,
  type TickTransactionSignalAdapterSeverity,
  type TickTransactionSignalAdapterState,
  type TickTransactionUXReportCompat,
} from './TickTransactionSignalAdapter';

import {
  EventBusSignalAdapter,
  createEventBusSignalAdapter,
  type EventBusAnalyticsReportCompat,
  type EventBusChatSignalCompat,
  type EventBusHealthReportCompat,
  type EventBusMLVectorCompat,
  type EventBusSignalAdapterArtifact,
  type EventBusSignalAdapterContext,
  type EventBusSignalAdapterDeduped,
  type EventBusSignalAdapterEventName,
  type EventBusSignalAdapterHistoryEntry,
  type EventBusSignalAdapterNarrativeWeight,
  type EventBusSignalAdapterOptions,
  type EventBusSignalAdapterRejection,
  type EventBusSignalAdapterReport,
  type EventBusSignalAdapterSeverity,
  type EventBusSignalAdapterState,
} from './EventBusSignalAdapter';

import {
  CheckpointSignalAdapter,
  createCheckpointSignalAdapter,
  type CheckpointChatSignalCompat,
  type CheckpointDLTensorCompat,
  type CheckpointMLVectorCompat,
  type CheckpointRollbackRiskCompat,
  type CheckpointSignalAdapterArtifact,
  type CheckpointSignalAdapterContext,
  type CheckpointSignalAdapterDeduped,
  type CheckpointSignalAdapterEventName,
  type CheckpointSignalAdapterHistoryEntry,
  type CheckpointSignalAdapterNarrativeWeight,
  type CheckpointSignalAdapterOptions,
  type CheckpointSignalAdapterRejection,
  type CheckpointSignalAdapterReport,
  type CheckpointSignalAdapterSeverity,
  type CheckpointSignalAdapterState,
} from './CheckpointSignalAdapter';

import {
  OutcomeSignalAdapter,
  createOutcomeSignalAdapter,
  type OutcomeDecisionContextCompat,
  type OutcomeDLTensorCompat,
  type OutcomeForecastCompat,
  type OutcomeMLVectorCompat,
  type OutcomeNarrationHintCompat,
  type OutcomeProximityCompat,
  type OutcomeSignalAdapterArtifact,
  type OutcomeSignalAdapterContext,
  type OutcomeSignalAdapterDeduped,
  type OutcomeSignalAdapterEventName,
  type OutcomeSignalAdapterHistoryEntry,
  type OutcomeSignalAdapterNarrativeWeight,
  type OutcomeSignalAdapterOptions,
  type OutcomeSignalAdapterRejection,
  type OutcomeSignalAdapterReport,
  type OutcomeSignalAdapterSeverity,
  type OutcomeSignalAdapterState,
} from './OutcomeSignalAdapter';

import {
  ThreatRoutingSignalAdapter,
  createThreatRoutingSignalAdapter,
  type CounterStrategyAdviceCompat,
  type ThreatBotPredictionCompat,
  type ThreatChatSignalCompat,
  type ThreatDLTensorCompat,
  type ThreatMLVectorCompat,
  type ThreatRoutingSignalAdapterArtifact,
  type ThreatRoutingSignalAdapterContext,
  type ThreatRoutingSignalAdapterDeduped,
  type ThreatRoutingSignalAdapterEventName,
  type ThreatRoutingSignalAdapterHistoryEntry,
  type ThreatRoutingSignalAdapterNarrativeWeight,
  type ThreatRoutingSignalAdapterOptions,
  type ThreatRoutingSignalAdapterRejection,
  type ThreatRoutingSignalAdapterReport,
  type ThreatRoutingSignalAdapterSeverity,
  type ThreatRoutingSignalAdapterState,
  type ThreatSurgeEventCompat,
} from './ThreatRoutingSignalAdapter';

import {
  TickTraceSignalAdapter,
  createTickTraceSignalAdapter,
  type TickTraceChatSignalCompat,
  type TickTraceDLTensorCompat,
  type TickTraceHealthReportCompat,
  type TickTraceMLVectorCompat,
  type TickTraceRunCoverageCompat,
  type TickTraceSignalAdapterArtifact,
  type TickTraceSignalAdapterContext,
  type TickTraceSignalAdapterDeduped,
  type TickTraceSignalAdapterEventName,
  type TickTraceSignalAdapterHistoryEntry,
  type TickTraceSignalAdapterNarrativeWeight,
  type TickTraceSignalAdapterOptions,
  type TickTraceSignalAdapterRejection,
  type TickTraceSignalAdapterReport,
  type TickTraceSignalAdapterSeverity,
  type TickTraceSignalAdapterState,
  type TickTraceWindowSnapshotCompat,
} from './TickTraceSignalAdapter';

import {
  TickSequenceSignalAdapter,
  createTickSequenceSignalAdapter,
  type TickSequenceChatSignalCompat,
  type TickSequenceDLTensorCompat,
  type TickSequenceHealthReportCompat,
  type TickSequenceMLVectorCompat,
  type TickSequenceSignalAdapterArtifact,
  type TickSequenceSignalAdapterContext,
  type TickSequenceSignalAdapterDeduped,
  type TickSequenceSignalAdapterEventName,
  type TickSequenceSignalAdapterHistoryEntry,
  type TickSequenceSignalAdapterNarrativeWeight,
  type TickSequenceSignalAdapterOptions,
  type TickSequenceSignalAdapterRejection,
  type TickSequenceSignalAdapterReport,
  type TickSequenceSignalAdapterSeverity,
  type TickSequenceSignalAdapterState,
  type TickPhaseTimingSummaryCompat,
  type TickSequenceStatCompat,
  type TickStepPerformanceSummaryCompat,
} from './TickSequenceSignalAdapter';

import {
  ModeSignalAdapter,
  ModeSignalAnalytics,
  ModeSignalBatchProcessor,
  ModeMlFeatureExtractor,
  ModeDlTensorBuilder,
  ModeSignalRiskScorer,
  ModeSignalPriorityClassifier,
  ModeSignalChannelRouter,
  ModeSignalUxLabelGenerator,
  ModeSignalDeduplicator,
  buildModeSignalAdapter,
  buildModeSignalBatchProcessor,
  extractModeMLVector,
  buildModeDLTensor,
  scoreModeRisk,
  getModeChatChannel,
  type ChatModeSignal,
  type ModeSignalKind,
  type ModeSignalPriority,
  type ModeSignalChannelRecommendation,
  type ModeLifecyclePhase,
  type ModeMlVector,
  type ModeDlTensor,
  type ModeConfiguredPayload,
  type ModeTickPayload,
  type ModeActionPayload,
  type ModeFinalizedPayload,
  type ModeSignalPayload,
  type ModeSignalAdapterOptions,
  type ModeSignalBatchEntry,
  type ModeSignalBatchResult,
  type ModeSignalAnalyticsSummary,
} from './ModeSignalAdapter';

import {
  PressureSignalAdapter,
  createPressureSignalAdapter,
  extractPressureMLVector,
  scorePressureRisk,
  getPressureChatChannel,
  buildPressureNarrativeWeight,
  buildPressureThresholdReport,
  PRESSURE_SIGNAL_ADAPTER_VERSION,
  PRESSURE_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  PRESSURE_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
  PRESSURE_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
  PRESSURE_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
  PRESSURE_SIGNAL_ADAPTER_EVENT_NAMES,
  PRESSURE_SIGNAL_ADAPTER_MANIFEST,
  type PressureSignalAdapterEventName,
  type PressureSignalAdapterOptions,
  type PressureSignalAdapterLogger,
  type PressureSignalAdapterClock,
  type PressureSignalAdapterContext,
  type PressureSignalAdapterState,
  type PressureSignalAdapterReport,
  type PressureSignalAdapterArtifact,
  type PressureSignalAdapterDeduped,
  type PressureSignalAdapterRejection,
  type PressureSignalAdapterHistoryEntry,
  type PressureSignalAdapterSeverity,
  type PressureSignalAdapterPriority,
  type PressureSignalAdapterNarrativeWeight,
  type PressureSignalAdapterChannelRecommendation,
  type PressureSnapshotCompat,
  type PressureSignalInput,
  type PressureChatSignalCompat,
  type PressureMLVectorCompat,
  type PressureDLTensorCompat,
  type PressureForecastCompat,
  type PressureUXHintCompat,
  type PressureAnnotationCompat,
  type PressureAdapterMLVector,
} from './PressureSignalAdapter';

import {
  DecaySignalAdapter,
  createDecaySignalAdapter,
  extractDecayAdapterMLVector,
  scoreDecayRisk,
  getDecayChatChannel,
  buildDecayNarrativeWeight,
  buildDecayConstraintReport,
  buildDecayCompatBundle,
  DECAY_SIGNAL_ADAPTER_VERSION,
  DECAY_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  DECAY_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
  DECAY_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH,
  DECAY_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
  DECAY_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
  DECAY_SIGNAL_ADAPTER_EVENT_NAMES,
  DECAY_ADAPTER_FORECAST_DELTA_THRESHOLD,
  DECAY_ADAPTER_POLICY_SHIFT_THRESHOLD,
  DECAY_SIGNAL_ADAPTER_MANIFEST,
  type DecaySignalAdapterEventName,
  type DecaySignalAdapterOptions,
  type DecaySignalAdapterLogger,
  type DecaySignalAdapterClock,
  type DecaySignalAdapterContext,
  type DecaySignalAdapterState,
  type DecaySignalAdapterReport,
  type DecaySignalAdapterArtifact,
  type DecaySignalAdapterDeduped,
  type DecaySignalAdapterRejection,
  type DecaySignalAdapterHistoryEntry,
  type DecaySignalAdapterSeverity,
  type DecaySignalAdapterNarrativeWeight,
  type DecaySignalAdapterChannelRecommendation,
  type DecaySnapshotCompat,
  type DecaySignalInput,
  type DecayChatSignalCompat,
  type DecayMLVectorCompat,
  type DecayDLTensorCompat,
  type DecayForecastCompat,
  type DecayAnnotationCompat,
  type DecayPolicySummaryCompat,
  type DecayAdapterMLVector,
} from './DecaySignalAdapter';

import {
  CollectorSignalAdapter,
  createCollectorSignalAdapter,
  extractCollectorAdapterMLVector,
  scoreCollectorRisk,
  getCollectorChatChannel,
  buildCollectorNarrativeWeight,
  buildCollectorThresholdReport,
  buildCollectorCompatBundle,
  buildCollectorAdapterBundle,
  COLLECTOR_SIGNAL_ADAPTER_VERSION,
  COLLECTOR_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  COLLECTOR_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
  COLLECTOR_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH,
  COLLECTOR_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
  COLLECTOR_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
  COLLECTOR_SIGNAL_ADAPTER_EVENT_NAMES,
  COLLECTOR_SIGNAL_ADAPTER_MANIFEST,
  type CollectorSignalAdapterEventName,
  type CollectorSignalAdapterOptions,
  type CollectorSignalAdapterLogger,
  type CollectorSignalAdapterClock,
  type CollectorSignalAdapterContext,
  type CollectorSignalAdapterState,
  type CollectorSignalAdapterReport,
  type CollectorSignalAdapterArtifact,
  type CollectorSignalAdapterDeduped,
  type CollectorSignalAdapterRejection,
  type CollectorSignalAdapterHistoryEntry,
  type CollectorSignalAdapterSeverity,
  type CollectorSignalAdapterPriority,
  type CollectorSignalAdapterNarrativeWeight,
  type CollectorSignalAdapterChannelRecommendation,
  type CollectorSnapshotCompat,
  type CollectorSignalInput,
  type CollectorChatSignalCompat,
  type CollectorMLVectorCompat,
  type CollectorDLTensorCompat,
  type CollectorForecastCompat,
  type CollectorUXHintCompat,
  type CollectorAnnotationCompat,
  type CollectorAdapterMLVector,
  type CollectorCompatBundle,
  type CollectorAdapterFullBundle,
  type CollectorThresholdReport,
} from './CollectorSignalAdapter';

import {
  ShieldSignalAdapter,
  createShieldSignalAdapter,
  buildShieldAdapterBundle,
  buildShieldEngineAdapterBundle,
  extractShieldMLVector,
  scoreShieldRisk,
  getShieldChatChannel,
  buildShieldNarrativeWeight,
  buildShieldThresholdReport,
  buildShieldCompatBundle,
  // Pure helpers
  getShieldAdapterChatChannel,
  buildShieldAdapterNarrativeWeight,
  scoreShieldAdapterRisk,
  extractShieldAdapterMLVector,
  buildShieldMLVectorCompat,
  buildShieldCascadeMLVectorCompat,
  buildShieldDLTensorCompat,
  buildShieldCascadeDLTensorCompat,
  buildShieldSignalDiagnostics,
  buildShieldRoutedAttackCompat,
  checkDoctrineTargetLayerAlignment,
  computeShieldPreRoutingProfile,
  computeShieldCascadeExposureProfile,
  buildShieldModeMetadata,
  resolveAttackDoctrineAlias,
  buildShieldLayerConfigMap,
  buildShieldLayerExposureMap,
  buildShieldCascadeGrade,
  buildShieldCascadeResolutionCompat,
  containsHaterBotDecisions,
  inspectGhostDoctrineFlags,
  resolveShieldPressureTierUrgency,
  buildDefaultShieldLayerState,
  computeShieldBatchQualityMetrics,
  // Deep analytics
  buildShieldSessionProfile,
  computeShieldPreRoutingExposure,
  analyzeShieldDoctrineComposition,
  inspectShieldCascadePosture,
  scoreShieldCascadeThreatBatch,
  buildShieldCascadeMLParams,
  buildShieldAttackMLParams,
  // Session helpers
  buildShieldCascadeTrend,
  buildShieldCascadeAnnotationBundle,
  buildShieldCascadeHistoryEntry,
  inspectCascadeHistory,
  validateAndMapShieldLayers,
  buildShieldCascadeBotThreatProfile,
  buildShieldCascadeMLContext,
  buildShieldCascadeDLRowExternal,
  buildShieldCascadeSessionReport,
  buildShieldAttackSessionReport,
  // Module constants
  SHIELD_SIGNAL_ADAPTER_VERSION,
  SHIELD_SIGNAL_ADAPTER_ATTACK_ML_FEATURE_COUNT,
  SHIELD_SIGNAL_ADAPTER_ATTACK_DL_FEATURE_COUNT,
  SHIELD_SIGNAL_ADAPTER_ATTACK_DL_SEQUENCE_LENGTH,
  SHIELD_SIGNAL_ADAPTER_CASCADE_ML_FEATURE_COUNT,
  SHIELD_SIGNAL_ADAPTER_CASCADE_DL_FEATURE_COUNT,
  SHIELD_SIGNAL_ADAPTER_CASCADE_DL_SEQUENCE_LENGTH,
  SHIELD_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
  SHIELD_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
  SHIELD_SIGNAL_ADAPTER_HISTORY_DEPTH,
  SHIELD_SIGNAL_ADAPTER_TREND_WINDOW,
  SHIELD_SIGNAL_ADAPTER_CASCADE_SURGE_THRESHOLD,
  SHIELD_SIGNAL_ADAPTER_GHOST_HATER_AMPLIFY,
  SHIELD_SIGNAL_ADAPTER_SOVEREIGNTY_L4_RISK,
  SHIELD_SIGNAL_ADAPTER_DOCTRINE_CONFIDENCE_THRESHOLD,
  SHIELD_SIGNAL_ADAPTER_VULNERABILITY_THRESHOLD,
  SHIELD_SIGNAL_ADAPTER_CASCADE_IMMINENT_L4,
  SHIELD_SIGNAL_ADAPTER_CASCADE_IMMINENT_GHOST_L3,
  SHIELD_SIGNAL_ADAPTER_CASCADE_HISTORY_DEPTH,
  SHIELD_SIGNAL_ADAPTER_GHOST_CRACK_MULTIPLIER,
  SHIELD_SIGNAL_ADAPTER_SOVEREIGNTY_CRACK_MULTIPLIER,
  SHIELD_SIGNAL_ADAPTER_EVENT_NAMES,
  SHIELD_SIGNAL_ADAPTER_MANIFEST,
  // Types
  type ShieldSignalAdapterEventName,
  type ShieldSignalAdapterLogger,
  type ShieldSignalAdapterClock,
  type ShieldSignalAdapterOptions,
  type ShieldSignalAdapterContext,
  type ShieldSnapshotCompat,
  type ShieldSignalInput,
  type ShieldSignalBatchInput,
  type ShieldSignalAdapterSeverity,
  type ShieldSignalAdapterNarrativeWeight,
  type ShieldSignalAdapterChannelRecommendation,
  type ShieldSignalAdapterArtifact,
  type ShieldSignalAdapterDeduped,
  type ShieldSignalAdapterRejection,
  type ShieldSignalAdapterHistoryEntry,
  type ShieldSignalAdapterState,
  type ShieldSignalAdapterReport,
  type ShieldChatSignalCompat,
  type ShieldMLVectorCompat,
  type ShieldDLTensorCompat,
  type ShieldCascadeMLVectorCompat,
  type ShieldCascadeDLTensorCompat,
  type ShieldUXHintCompat,
  type ShieldAnnotationCompat,
  type ShieldRepairJobCompat,
  type ShieldRepairSliceCompat,
  type ShieldQueueRejectionCompat,
  type ShieldRoutedAttackCompat,
  type ShieldDamageResolutionCompat,
  type ShieldCascadeResolutionCompat,
  type ShieldAdapterBundle,
  type ShieldExposureProfile,
  type ShieldPreRoutingCompat,
  type ShieldInspectorBundle,
  type ShieldSessionReportBundle,
  type ShieldLayerConfigMap,
} from './ShieldSignalAdapter';

import {
  ShieldLayerManagerSignalAdapter,
  createShieldLayerManagerSignalAdapter,
  buildShieldLayerMgrAdapterBundle,
  buildShieldLayerMgrAdapterBundleFromSnapshot,
  extractShieldLayerMgrMLVector,
  scoreShieldLayerMgrRisk,
  getShieldLayerMgrChatChannel,
  buildShieldLayerMgrNarrativeWeight,
  buildShieldLayerMgrThresholdReport,
  buildShieldLayerMgrExposureProfile,
  buildShieldLayerMgrPostureSnapshot,
  buildShieldLayerMgrSessionReport,
  isShieldLayerMgrEndgamePhase,
  buildLayerMgrExposureProfile,
  buildLayerMgrChatSignal,
  buildLayerMgrMLVectorCompat,
  buildLayerMgrDLTensorCompat,
  buildLayerMgrUXHintCompat,
  buildLayerMgrAnnotationCompat,
  buildLayerMgrPostureSnapshot,
  buildLayerMgrConfigMapCompat,
  buildLayerMgrDamageResolutionCompat,
  buildLayerMgrRepairJobCompat,
  classifyAdapterSeverity,
  buildAdapterNarrativeWeight,
  shouldSurfaceTick,
  resolveAdapterEventName,
  buildAdapterDetailString,
  buildAdapterThresholdReport,
  buildAdapterMLCompat,
  validateBotStateMap,
  buildRegenAppliedFromLayers,
  isLayerExposed,
  buildRoutedAttackSummary,
  buildRepairSliceSummary,
  computeAdapterPressureRisk,
  validateLayerMgrInput,
  buildLayerMgrExposureFromSnapshot,
  SHIELD_LAYER_MGR_ADAPTER_VERSION,
  SHIELD_LAYER_MGR_ADAPTER_ML_FEATURE_COUNT,
  SHIELD_LAYER_MGR_ADAPTER_DL_FEATURE_COUNT,
  SHIELD_LAYER_MGR_ADAPTER_DL_SEQUENCE_LENGTH,
  SHIELD_LAYER_MGR_ADAPTER_DEDUPE_WINDOW_TICKS,
  SHIELD_LAYER_MGR_ADAPTER_MAX_BATCH_SIZE,
  SHIELD_LAYER_MGR_ADAPTER_MIN_DELTA_THRESHOLD,
  SHIELD_LAYER_MGR_ADAPTER_HISTORY_DEPTH,
  SHIELD_LAYER_MGR_ADAPTER_TREND_WINDOW,
  SHIELD_LAYER_MGR_ADAPTER_FORECAST_MAX_HORIZON,
  SHIELD_LAYER_MGR_ADAPTER_LOW_INTEGRITY_THRESHOLD,
  SHIELD_LAYER_MGR_ADAPTER_CRITICAL_INTEGRITY_THRESHOLD,
  SHIELD_LAYER_MGR_ADAPTER_STABLE_THRESHOLD,
  SHIELD_LAYER_MGR_ADAPTER_HIGH_DAMAGE_THRESHOLD,
  SHIELD_LAYER_MGR_ADAPTER_HIGH_REPAIR_THRESHOLD,
  SHIELD_LAYER_MGR_ADAPTER_BREACH_HISTORY_DEPTH,
  SHIELD_LAYER_MGR_ADAPTER_EVENT_NAMES,
  SHIELD_LAYER_MGR_ADAPTER_MANIFEST,
  type ShieldLayerMgrAdapterEventName,
  type ShieldLayerMgrAdapterSeverity,
  type ShieldLayerMgrAdapterNarrativeWeight,
  type ShieldLayerMgrAdapterChannelRecommendation,
  type ShieldLayerMgrAdapterLogger,
  type ShieldLayerMgrAdapterClock,
  type ShieldLayerMgrAdapterOptions,
  type ShieldLayerMgrSignalInput,
  type ShieldLayerMgrSignalBatchInput,
  type ShieldLayerMgrChatSignalCompat,
  type ShieldLayerMgrMLVectorCompat,
  type ShieldLayerMgrDLTensorCompat,
  type ShieldLayerMgrUXHintCompat,
  type ShieldLayerMgrAnnotationCompat,
  type ShieldLayerMgrConfigMapCompat,
  type ShieldLayerMgrDamageResolutionCompat,
  type ShieldLayerMgrRepairJobCompat,
  type ShieldLayerMgrAdapterBundle,
  type ShieldLayerMgrAdapterState,
  type ShieldLayerMgrAdapterReport,
  type ShieldLayerMgrAdapterRejection,
  type ShieldLayerMgrAdapterHistoryEntry,
  type ShieldLayerMgrAdapterArtifact,
  type ShieldLayerMgrAdapterDeduped,
  type ShieldLayerMgrExposureProfile,
  type ShieldLayerMgrPostureSnapshot,
} from './ShieldLayerManagerSignalAdapter';

import {
  ShieldRepairQueueSignalAdapter,
  createShieldRepairQueueSignalAdapter,
  buildShieldRepairQueueAdapterBundle,
  buildShieldRepairQueueAdapterBundleFromSnapshot,
  extractShieldRepairQueueAdapterMLVector,
  scoreShieldRepairQueueAdapterRisk,
  getShieldRepairQueueAdapterChatChannel,
  buildShieldRepairQueueAdapterNarrativeWeight,
  buildShieldRepairQueueAdapterThresholdReport,
  buildShieldRepairQueueAdapterPostureSnapshot,
  buildShieldRepairQueueAdapterSessionReport,
  buildShieldRepairQueueAdapterAnalyticsBundle,
  createShieldRepairQueueSignalAdapterWithEnsemble,
  buildRepairQueueEnqueueSignal,
  buildRepairQueueRejectionSignal,
  buildRepairQueueSessionSummarySignal,
  // Pure helpers
  classifyRepairAdapterSeverity,
  buildRepairAdapterNarrativeWeight,
  resolveRepairAdapterChannel,
  resolveRepairAdapterEventName,
  buildRepairAdapterDetailString,
  buildRepairAdapterMLVectorCompat,
  buildRepairAdapterDLTensorCompat,
  buildRepairAdapterUXHintCompat,
  buildRepairAdapterAnnotations,
  buildRepairAdapterEnqueueResults,
  buildRepairAdapterSliceResults,
  buildRepairAdapterExposureProfile,
  buildRepairQueueChatSignal,
  validateRepairAdapterBotStateMap,
  buildRepairAdapterThresholdReport,
  buildRepairAdapterMLCompat,
  scoreRepairAdapterThreatLayerUrgency,
  resolveRepairAdapterJobDoctrine,
  isKnownRepairAlias,
  getRepairAdapterAbsorptionWeight,
  buildRepairAdapterLayerConfigMap,
  applyRepairAdapterSliceToLayer,
  buildRepairAdapterPostureSnapshot,
  buildRepairAdapterSessionReport,
  computeRepairAdapterTotalDelivered,
  computeRepairAdapterJobCountsPerLayer,
  computeRepairAdapterPendingHpPerLayer,
  computeRepairAdapterProgressPerLayer,
  computeRepairAdapterDeliveryRatePerLayer,
  buildRepairAdapterOverflowRiskMap,
  shouldSurfaceRepairTick,
  buildRepairAdapterExposureFromSnapshot,
  // Module constants
  SHIELD_REPAIR_QUEUE_ADAPTER_VERSION,
  SHIELD_REPAIR_QUEUE_ADAPTER_ML_FEATURE_COUNT,
  SHIELD_REPAIR_QUEUE_ADAPTER_DL_FEATURE_COUNT,
  SHIELD_REPAIR_QUEUE_ADAPTER_DL_SEQUENCE_LENGTH,
  SHIELD_REPAIR_QUEUE_ADAPTER_DEDUPE_WINDOW_TICKS,
  SHIELD_REPAIR_QUEUE_ADAPTER_MAX_BATCH_SIZE,
  SHIELD_REPAIR_QUEUE_ADAPTER_MIN_HP_THRESHOLD,
  SHIELD_REPAIR_QUEUE_ADAPTER_HISTORY_DEPTH,
  SHIELD_REPAIR_QUEUE_ADAPTER_TREND_WINDOW,
  SHIELD_REPAIR_QUEUE_ADAPTER_FORECAST_MAX_HORIZON,
  SHIELD_REPAIR_QUEUE_ADAPTER_OVERFLOW_RISK_THRESHOLD,
  SHIELD_REPAIR_QUEUE_ADAPTER_CRITICAL_UTILIZATION,
  SHIELD_REPAIR_QUEUE_ADAPTER_LOW_THROUGHPUT_THRESHOLD,
  SHIELD_REPAIR_QUEUE_ADAPTER_MAX_HP_PER_TICK,
  SHIELD_REPAIR_QUEUE_ADAPTER_REJECTION_HISTORY_DEPTH,
  SHIELD_REPAIR_QUEUE_ADAPTER_MAX_QUEUED_HP,
  SHIELD_REPAIR_QUEUE_ADAPTER_CRITICAL_URGENCY_THRESHOLD,
  SHIELD_REPAIR_QUEUE_ADAPTER_MAX_JOBS_PER_LAYER,
  SHIELD_REPAIR_QUEUE_ADAPTER_MAX_HISTORY_DEPTH,
  SHIELD_REPAIR_QUEUE_ADAPTER_READY,
  SHIELD_REPAIR_QUEUE_ADAPTER_EVENT_NAMES,
  SHIELD_REPAIR_QUEUE_ADAPTER_MANIFEST,
  type ShieldRepairQueueAdapterEventName,
  type ShieldRepairQueueAdapterSeverity,
  type ShieldRepairQueueAdapterNarrativeWeight,
  type ShieldRepairQueueAdapterChannelRecommendation,
  type ShieldRepairQueueAdapterLogger,
  type ShieldRepairQueueAdapterClock,
  type ShieldRepairQueueAdapterOptions,
  type ShieldRepairQueueSignalInput,
  type ShieldRepairQueueSignalBatchInput,
  type ShieldRepairQueueChatSignalCompat,
  type ShieldRepairQueueAdapterMLVectorCompat,
  type ShieldRepairQueueAdapterDLTensorCompat,
  type ShieldRepairQueueAdapterUXHintCompat,
  type ShieldRepairQueueAdapterAnnotationCompat,
  type ShieldRepairQueueAdapterConfigMapCompat,
  type ShieldRepairQueueAdapterEnqueueCompat,
  type ShieldRepairQueueAdapterSliceCompat,
  type ShieldRepairQueueAdapterBundle,
  type ShieldRepairQueueAdapterState,
  type ShieldRepairQueueAdapterReport,
  type ShieldRepairQueueAdapterArtifact,
  type ShieldRepairQueueAdapterDeduped,
  type ShieldRepairQueueAdapterRejection,
  type ShieldRepairQueueAdapterHistoryEntry,
  type ShieldRepairQueueAdapterExposureProfile,
} from './ShieldRepairQueueSignalAdapter';

import {
  ProofGeneratorSignalAdapter,
  createProofGeneratorSignalAdapter,
  buildProofSignalPayload,
  adaptAllProofSignals,
  adaptCertificateBundle,
  adaptAuditBatch,
  gradeHeadline,
  gradeCoachingMessage,
  outcomeHeadline,
  outcomeCoachingMessage,
  integrityHeadline,
  integrityCoachingMessage,
  cordScoreMessage,
  PROOF_SIGNAL_ADAPTER_MANIFEST,
  type ProofGenerationResultCompat,
  type ProofMLVectorCompat,
  type ProofDLTensorCompat,
  type ProofAuditEntryCompat,
  type ProofCertificateCompat,
  type ProofSignalAdapterContext,
  type ProofSignalAdapterLogger,
  type ProofSignalAdapterClock,
  type ProofSignalAdapterSeverity,
  type ProofSignalAdapterEventName,
  type ProofGeneratorSignalAdapterOptions,
  type ProofSignalAdapterStats,
} from './ProofGeneratorSignalAdapter';

import {
  ReplayIntegritySignalAdapter,
  createReplayIntegritySignalAdapter,
  buildIntegritySignalPayload,
  adaptAllIntegritySignals,
  adaptIntegrityBundle,
  adaptIntegrityAuditBatch,
  integrityStatusHeadline,
  integrityStatusCoachingMessage,
  anomalyHeadline,
  anomalyCoachingMessage,
  auditEntryMessage,
  INTEGRITY_SIGNAL_ADAPTER_MANIFEST,
  type IntegrityResultCompat,
  type IntegrityMLVectorCompat,
  type IntegrityDLTensorCompat,
  type IntegrityAuditEntryCompat,
  type IntegritySignalAdapterContext,
  type IntegritySignalAdapterLogger,
  type IntegritySignalAdapterClock,
  type IntegritySignalAdapterSeverity,
  type IntegritySignalAdapterEventName,
  type ReplayIntegritySignalAdapterOptions,
  type IntegritySignalAdapterStats,
} from './ReplayIntegritySignalAdapter';

import {
  RunGradeSignalAdapter,
  createRunGradeSignalAdapter,
  buildGradeSignalPayload,
  adaptAllGradeSignals,
  adaptGradeBundle,
  adaptGradeAuditBatch,
  gradeHeadline as gradeAdapterHeadline,
  gradeCoachingMessage as gradeAdapterCoachingMessage,
  badgeHeadline,
  badgeCoachingMessage,
  comparisonHeadline,
  comparisonCoachingMessage,
  gradeAuditMessage,
  GRADE_SIGNAL_ADAPTER_MANIFEST,
  type GradeResultCompat,
  type GradeMLVectorCompat,
  type GradeDLTensorCompat,
  type GradeAuditEntryCompat,
  type GradeComparisonCompat,
  type GradeSignalAdapterContext,
  type GradeSignalAdapterLogger,
  type GradeSignalAdapterClock,
  type GradeSignalAdapterSeverity,
  type GradeSignalAdapterEventName,
  type RunGradeSignalAdapterOptions,
  type GradeSignalAdapterStats,
} from './RunGradeSignalAdapter';

import {
  SovereigntyExportSignalAdapter,
  createSovereigntyExportSignalAdapter,
  buildExportSignalPayload,
  buildProofCardPayload,
  adaptAllExportSignals,
  adaptExportBundle,
  adaptExportAuditBatch,
  artifactFormatHeadline,
  artifactCoachingMessage,
  gradeExportNote,
  proofCardHeadline,
  proofCardCoachingMessage,
  leaderboardHeadline,
  leaderboardCoachingMessage,
  gradeNarrativeHeadline,
  auditEntryHeadline,
  batchCompleteHeadline,
  batchCompleteCoachingMessage,
  EXPORT_SIGNAL_ADAPTER_MANIFEST,
  type ExportArtifactCompat,
  type ProofCardCompat,
  type ExportMLVectorCompat,
  type ExportDLTensorCompat,
  type ExportAuditEntryCompat,
  type LeaderboardProjectionCompat,
  type ExplorerCardCompat,
  type GradeNarrativeCompat,
  type ExportSignalAdapterContext,
  type ExportSignalAdapterLogger,
  type ExportSignalAdapterClock,
  type ExportSignalAdapterSeverity,
  type ExportSignalAdapterEventName,
  type SovereigntyExportSignalAdapterOptions,
  type ExportSignalAdapterStats,
} from './SovereigntyExportSignalAdapter';

import {
  SovereigntyExporterSignalAdapter,
  createSovereigntyExporterSignalAdapter,
  adaptAllExporterSignals,
  adaptExporterBundle,
  EXPORTER_SIGNAL_ADAPTER_MANIFEST,
  type ExporterPipelineResultCompat,
  type ExporterMLVectorCompat as ExporterAdapterMLVectorCompat,
  type ExporterDLTensorCompat as ExporterAdapterDLTensorCompat,
  type ExporterAuditEntryCompat as ExporterAdapterAuditEntryCompat,
  type ExporterSignalAdapterContext,
  type SovereigntyExporterSignalAdapterOptions as ExporterSignalAdapterOptions,
  type ExporterSignalAdapterStats,
} from './SovereigntyExporterSignalAdapter';

import {
  PersistenceWriterSignalAdapter,
  createPersistenceWriterSignalAdapter,
  adaptAllPersistenceSignals,
  adaptPersistenceBundle,
  PERSISTENCE_SIGNAL_ADAPTER_MANIFEST,
  type PersistenceEnvelopeCompat,
  type PersistenceWriteStatsCompat,
  type PersistenceMLVectorCompat as PersistenceAdapterMLVectorCompat,
  type PersistenceDLTensorCompat as PersistenceAdapterDLTensorCompat,
  type PersistenceAuditEntryCompat as PersistenceAdapterAuditEntryCompat,
  type PersistenceSignalAdapterContext,
  type PersistenceWriterSignalAdapterOptions as PersistenceSignalAdapterOptions,
  type PersistenceSignalAdapterStats,
} from './PersistenceWriterSignalAdapter';

import {
  SnapshotAdapterSignalAdapter,
  createSnapshotAdapterSignalAdapter,
  adaptSnapshotSummarySignals,
  adaptSnapshotBundle,
  SNAPSHOT_ADAPTER_SIGNAL_MANIFEST,
  type TickRecordCompat,
  type RunSummaryCompat,
  type SnapshotDeltaCompat,
  type AdapterMLVectorCompat as SnapshotAdapterMLVectorCompat,
  type AdapterDLTensorCompat as SnapshotAdapterDLTensorCompat,
  type AdapterAuditEntryCompat as SnapshotAdapterAuditEntryCompat,
  type SnapshotAdapterSignalContext as SnapshotSignalAdapterContext,
  type SnapshotAdapterSignalAdapterOptions,
  type SnapshotAdapterSignalStats as SnapshotSignalAdapterStats,
} from './SnapshotAdapterSignalAdapter';

// ============================================================================
// MARK: Re-export authoritative adapter modules and their key public surfaces
// ============================================================================

export {
  BattleSignalAdapter,
  RunSignalAdapter,
  MultiplayerSignalAdapter,
  EconomySignalAdapter,
  CoreMLSignalAdapter,
  EngineSignalChatAdapter,
  createEngineSignalChatAdapter,
  GamePrimitivesSignalAdapter,
  createGamePrimitivesSignalAdapter,
  RegistrySignalAdapter,
  createRegistrySignalAdapter,
  TickTransactionSignalAdapter,
  createTickTransactionSignalAdapter,
  EventBusSignalAdapter,
  createEventBusSignalAdapter,
  // Checkpoint / Outcome / ThreatRouting signal adapters
  CheckpointSignalAdapter,
  createCheckpointSignalAdapter,
  OutcomeSignalAdapter,
  createOutcomeSignalAdapter,
  ThreatRoutingSignalAdapter,
  createThreatRoutingSignalAdapter,
  // TickTrace / TickSequence signal adapters
  TickTraceSignalAdapter,
  createTickTraceSignalAdapter,
  TickSequenceSignalAdapter,
  createTickSequenceSignalAdapter,
  // Mode signal adapter — lifecycle bridge for all four game modes
  ModeSignalAdapter,
  ModeSignalAnalytics,
  ModeSignalBatchProcessor,
  ModeMlFeatureExtractor,
  ModeDlTensorBuilder,
  ModeSignalRiskScorer,
  ModeSignalPriorityClassifier,
  ModeSignalChannelRouter,
  ModeSignalUxLabelGenerator,
  ModeSignalDeduplicator,
  buildModeSignalAdapter,
  buildModeSignalBatchProcessor,
  extractModeMLVector,
  buildModeDLTensor,
  scoreModeRisk,
  getModeChatChannel,
  // Pressure signal adapter — authoritative pressure → chat translation lane
  PressureSignalAdapter,
  createPressureSignalAdapter,
  extractPressureMLVector,
  scorePressureRisk,
  getPressureChatChannel,
  buildPressureNarrativeWeight,
  buildPressureThresholdReport,
  PRESSURE_SIGNAL_ADAPTER_VERSION,
  PRESSURE_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  PRESSURE_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
  PRESSURE_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
  PRESSURE_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
  PRESSURE_SIGNAL_ADAPTER_EVENT_NAMES,
  PRESSURE_SIGNAL_ADAPTER_MANIFEST,
  // Decay signal adapter — PressureDecayController → chat decay lane
  DecaySignalAdapter,

  createDecaySignalAdapter,
  extractDecayAdapterMLVector,
  scoreDecayRisk,
  getDecayChatChannel,
  buildDecayNarrativeWeight,
  buildDecayConstraintReport,
  buildDecayCompatBundle,
  DECAY_SIGNAL_ADAPTER_VERSION,
  DECAY_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  DECAY_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
  DECAY_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH,
  DECAY_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
  DECAY_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
  DECAY_SIGNAL_ADAPTER_EVENT_NAMES,
  DECAY_ADAPTER_FORECAST_DELTA_THRESHOLD,
  DECAY_ADAPTER_POLICY_SHIFT_THRESHOLD,
  DECAY_SIGNAL_ADAPTER_MANIFEST,
  // Collector signal adapter — PressureSignalCollector → chat collector lane
  CollectorSignalAdapter,
  createCollectorSignalAdapter,
  extractCollectorAdapterMLVector,
  scoreCollectorRisk,
  getCollectorChatChannel,
  buildCollectorNarrativeWeight,
  buildCollectorThresholdReport,
  buildCollectorCompatBundle,
  buildCollectorAdapterBundle,
  COLLECTOR_SIGNAL_ADAPTER_VERSION,
  COLLECTOR_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  COLLECTOR_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
  COLLECTOR_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH,
  COLLECTOR_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
  COLLECTOR_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
  COLLECTOR_SIGNAL_ADAPTER_EVENT_NAMES,
  COLLECTOR_SIGNAL_ADAPTER_MANIFEST,
  // Shield signal adapter — AttackRouter + BreachCascadeResolver → chat shield lane
  ShieldSignalAdapter,
  createShieldSignalAdapter,
  buildShieldAdapterBundle,
  buildShieldEngineAdapterBundle,
  extractShieldMLVector,
  scoreShieldRisk,
  getShieldChatChannel,
  buildShieldNarrativeWeight,
  buildShieldThresholdReport,
  buildShieldCompatBundle,
  getShieldAdapterChatChannel,
  buildShieldAdapterNarrativeWeight,
  scoreShieldAdapterRisk,
  extractShieldAdapterMLVector,
  buildShieldMLVectorCompat,
  buildShieldCascadeMLVectorCompat,
  buildShieldDLTensorCompat,
  buildShieldCascadeDLTensorCompat,
  buildShieldSignalDiagnostics,
  buildShieldRoutedAttackCompat,
  checkDoctrineTargetLayerAlignment,
  computeShieldPreRoutingProfile,
  computeShieldCascadeExposureProfile,
  buildShieldModeMetadata,
  resolveAttackDoctrineAlias,
  buildShieldLayerConfigMap,
  buildShieldLayerExposureMap,
  buildShieldCascadeGrade,
  buildShieldCascadeResolutionCompat,
  containsHaterBotDecisions,
  inspectGhostDoctrineFlags,
  resolveShieldPressureTierUrgency,
  buildDefaultShieldLayerState,
  computeShieldBatchQualityMetrics,
  buildShieldSessionProfile,
  computeShieldPreRoutingExposure,
  analyzeShieldDoctrineComposition,
  inspectShieldCascadePosture,
  scoreShieldCascadeThreatBatch,
  buildShieldCascadeMLParams,
  buildShieldAttackMLParams,
  buildShieldCascadeTrend,
  buildShieldCascadeAnnotationBundle,
  buildShieldCascadeHistoryEntry,
  inspectCascadeHistory,
  validateAndMapShieldLayers,
  buildShieldCascadeBotThreatProfile,
  buildShieldCascadeMLContext,
  buildShieldCascadeDLRowExternal,
  buildShieldCascadeSessionReport,
  buildShieldAttackSessionReport,
  SHIELD_SIGNAL_ADAPTER_VERSION,
  SHIELD_SIGNAL_ADAPTER_ATTACK_ML_FEATURE_COUNT,
  SHIELD_SIGNAL_ADAPTER_ATTACK_DL_FEATURE_COUNT,
  SHIELD_SIGNAL_ADAPTER_ATTACK_DL_SEQUENCE_LENGTH,
  SHIELD_SIGNAL_ADAPTER_CASCADE_ML_FEATURE_COUNT,
  SHIELD_SIGNAL_ADAPTER_CASCADE_DL_FEATURE_COUNT,
  SHIELD_SIGNAL_ADAPTER_CASCADE_DL_SEQUENCE_LENGTH,
  SHIELD_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
  SHIELD_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
  SHIELD_SIGNAL_ADAPTER_HISTORY_DEPTH,
  SHIELD_SIGNAL_ADAPTER_TREND_WINDOW,
  SHIELD_SIGNAL_ADAPTER_CASCADE_SURGE_THRESHOLD,
  SHIELD_SIGNAL_ADAPTER_GHOST_HATER_AMPLIFY,
  SHIELD_SIGNAL_ADAPTER_SOVEREIGNTY_L4_RISK,
  SHIELD_SIGNAL_ADAPTER_DOCTRINE_CONFIDENCE_THRESHOLD,
  SHIELD_SIGNAL_ADAPTER_VULNERABILITY_THRESHOLD,
  SHIELD_SIGNAL_ADAPTER_CASCADE_IMMINENT_L4,
  SHIELD_SIGNAL_ADAPTER_CASCADE_IMMINENT_GHOST_L3,
  SHIELD_SIGNAL_ADAPTER_CASCADE_HISTORY_DEPTH,
  SHIELD_SIGNAL_ADAPTER_GHOST_CRACK_MULTIPLIER,
  SHIELD_SIGNAL_ADAPTER_SOVEREIGNTY_CRACK_MULTIPLIER,
  SHIELD_SIGNAL_ADAPTER_EVENT_NAMES,
  SHIELD_SIGNAL_ADAPTER_MANIFEST,
  // Shield Layer Manager signal adapter — ShieldLayerManager → chat layer-state lane
  ShieldLayerManagerSignalAdapter,
  createShieldLayerManagerSignalAdapter,
  buildShieldLayerMgrAdapterBundle,
  buildShieldLayerMgrAdapterBundleFromSnapshot,
  extractShieldLayerMgrMLVector,
  scoreShieldLayerMgrRisk,
  getShieldLayerMgrChatChannel,
  buildShieldLayerMgrNarrativeWeight,
  buildShieldLayerMgrThresholdReport,
  buildShieldLayerMgrExposureProfile,
  buildShieldLayerMgrPostureSnapshot,
  buildShieldLayerMgrSessionReport,
  isShieldLayerMgrEndgamePhase,
  buildLayerMgrExposureProfile,
  buildLayerMgrChatSignal,
  buildLayerMgrMLVectorCompat,
  buildLayerMgrDLTensorCompat,
  buildLayerMgrUXHintCompat,
  buildLayerMgrAnnotationCompat,
  buildLayerMgrPostureSnapshot,
  buildLayerMgrConfigMapCompat,
  buildLayerMgrDamageResolutionCompat,
  buildLayerMgrRepairJobCompat,
  classifyAdapterSeverity,
  buildAdapterNarrativeWeight,
  shouldSurfaceTick,
  resolveAdapterEventName,
  buildAdapterDetailString,
  buildAdapterThresholdReport,
  buildAdapterMLCompat,
  validateBotStateMap,
  buildRegenAppliedFromLayers,
  isLayerExposed,
  buildRoutedAttackSummary,
  buildRepairSliceSummary,
  computeAdapterPressureRisk,
  validateLayerMgrInput,
  buildLayerMgrExposureFromSnapshot,
  SHIELD_LAYER_MGR_ADAPTER_VERSION,
  SHIELD_LAYER_MGR_ADAPTER_ML_FEATURE_COUNT,
  SHIELD_LAYER_MGR_ADAPTER_DL_FEATURE_COUNT,
  SHIELD_LAYER_MGR_ADAPTER_DL_SEQUENCE_LENGTH,
  SHIELD_LAYER_MGR_ADAPTER_DEDUPE_WINDOW_TICKS,
  SHIELD_LAYER_MGR_ADAPTER_MAX_BATCH_SIZE,
  SHIELD_LAYER_MGR_ADAPTER_MIN_DELTA_THRESHOLD,
  SHIELD_LAYER_MGR_ADAPTER_HISTORY_DEPTH,
  SHIELD_LAYER_MGR_ADAPTER_TREND_WINDOW,
  SHIELD_LAYER_MGR_ADAPTER_FORECAST_MAX_HORIZON,
  SHIELD_LAYER_MGR_ADAPTER_LOW_INTEGRITY_THRESHOLD,
  SHIELD_LAYER_MGR_ADAPTER_CRITICAL_INTEGRITY_THRESHOLD,
  SHIELD_LAYER_MGR_ADAPTER_STABLE_THRESHOLD,
  SHIELD_LAYER_MGR_ADAPTER_HIGH_DAMAGE_THRESHOLD,
  SHIELD_LAYER_MGR_ADAPTER_HIGH_REPAIR_THRESHOLD,
  SHIELD_LAYER_MGR_ADAPTER_BREACH_HISTORY_DEPTH,
  SHIELD_LAYER_MGR_ADAPTER_EVENT_NAMES,
  SHIELD_LAYER_MGR_ADAPTER_MANIFEST,
  // Shield Repair Queue signal adapter — ShieldRepairQueue → chat repair-queue lane
  ShieldRepairQueueSignalAdapter,
  createShieldRepairQueueSignalAdapter,
  buildShieldRepairQueueAdapterBundle,
  buildShieldRepairQueueAdapterBundleFromSnapshot,
  extractShieldRepairQueueAdapterMLVector,
  scoreShieldRepairQueueAdapterRisk,
  getShieldRepairQueueAdapterChatChannel,
  buildShieldRepairQueueAdapterNarrativeWeight,
  buildShieldRepairQueueAdapterThresholdReport,
  buildShieldRepairQueueAdapterPostureSnapshot,
  buildShieldRepairQueueAdapterSessionReport,
  buildShieldRepairQueueAdapterAnalyticsBundle,
  createShieldRepairQueueSignalAdapterWithEnsemble,
  buildRepairQueueEnqueueSignal,
  buildRepairQueueRejectionSignal,
  buildRepairQueueSessionSummarySignal,
  classifyRepairAdapterSeverity,
  buildRepairAdapterNarrativeWeight,
  resolveRepairAdapterChannel,
  resolveRepairAdapterEventName,
  buildRepairAdapterDetailString,
  buildRepairAdapterMLVectorCompat,
  buildRepairAdapterDLTensorCompat,
  buildRepairAdapterUXHintCompat,
  buildRepairAdapterAnnotations,
  buildRepairAdapterEnqueueResults,
  buildRepairAdapterSliceResults,
  buildRepairAdapterExposureProfile,
  buildRepairQueueChatSignal,
  validateRepairAdapterBotStateMap,
  buildRepairAdapterThresholdReport,
  buildRepairAdapterMLCompat,
  scoreRepairAdapterThreatLayerUrgency,
  resolveRepairAdapterJobDoctrine,
  isKnownRepairAlias,
  getRepairAdapterAbsorptionWeight,
  buildRepairAdapterLayerConfigMap,
  applyRepairAdapterSliceToLayer,
  buildRepairAdapterPostureSnapshot,
  buildRepairAdapterSessionReport,
  computeRepairAdapterTotalDelivered,
  computeRepairAdapterJobCountsPerLayer,
  computeRepairAdapterPendingHpPerLayer,
  computeRepairAdapterProgressPerLayer,
  computeRepairAdapterDeliveryRatePerLayer,
  buildRepairAdapterOverflowRiskMap,
  shouldSurfaceRepairTick,
  buildRepairAdapterExposureFromSnapshot,
  SHIELD_REPAIR_QUEUE_ADAPTER_VERSION,
  SHIELD_REPAIR_QUEUE_ADAPTER_ML_FEATURE_COUNT,
  SHIELD_REPAIR_QUEUE_ADAPTER_DL_FEATURE_COUNT,
  SHIELD_REPAIR_QUEUE_ADAPTER_DL_SEQUENCE_LENGTH,
  SHIELD_REPAIR_QUEUE_ADAPTER_DEDUPE_WINDOW_TICKS,
  SHIELD_REPAIR_QUEUE_ADAPTER_MAX_BATCH_SIZE,
  SHIELD_REPAIR_QUEUE_ADAPTER_MIN_HP_THRESHOLD,
  SHIELD_REPAIR_QUEUE_ADAPTER_HISTORY_DEPTH,
  SHIELD_REPAIR_QUEUE_ADAPTER_TREND_WINDOW,
  SHIELD_REPAIR_QUEUE_ADAPTER_FORECAST_MAX_HORIZON,
  SHIELD_REPAIR_QUEUE_ADAPTER_OVERFLOW_RISK_THRESHOLD,
  SHIELD_REPAIR_QUEUE_ADAPTER_CRITICAL_UTILIZATION,
  SHIELD_REPAIR_QUEUE_ADAPTER_LOW_THROUGHPUT_THRESHOLD,
  SHIELD_REPAIR_QUEUE_ADAPTER_MAX_HP_PER_TICK,
  SHIELD_REPAIR_QUEUE_ADAPTER_REJECTION_HISTORY_DEPTH,
  SHIELD_REPAIR_QUEUE_ADAPTER_MAX_QUEUED_HP,
  SHIELD_REPAIR_QUEUE_ADAPTER_CRITICAL_URGENCY_THRESHOLD,
  SHIELD_REPAIR_QUEUE_ADAPTER_MAX_JOBS_PER_LAYER,
  SHIELD_REPAIR_QUEUE_ADAPTER_MAX_HISTORY_DEPTH,
  SHIELD_REPAIR_QUEUE_ADAPTER_READY,
  SHIELD_REPAIR_QUEUE_ADAPTER_EVENT_NAMES,
  SHIELD_REPAIR_QUEUE_ADAPTER_MANIFEST,
  // ProofGenerator signal adapter — ProofGenerator → sovereignty proof chat lane
  ProofGeneratorSignalAdapter,
  createProofGeneratorSignalAdapter,
  buildProofSignalPayload,
  adaptAllProofSignals,
  adaptCertificateBundle,
  adaptAuditBatch,
  gradeHeadline,
  gradeCoachingMessage,
  outcomeHeadline,
  outcomeCoachingMessage,
  integrityHeadline,
  integrityCoachingMessage,
  cordScoreMessage,
  PROOF_SIGNAL_ADAPTER_MANIFEST,
  // ReplayIntegrity signal adapter — ReplayIntegrityChecker → sovereignty integrity chat lane
  ReplayIntegritySignalAdapter,
  createReplayIntegritySignalAdapter,
  buildIntegritySignalPayload,
  adaptAllIntegritySignals,
  adaptIntegrityBundle,
  adaptIntegrityAuditBatch,
  integrityStatusHeadline,
  integrityStatusCoachingMessage,
  anomalyHeadline,
  anomalyCoachingMessage,
  auditEntryMessage,
  INTEGRITY_SIGNAL_ADAPTER_MANIFEST,
  // RunGrade signal adapter — RunGradeAssigner → sovereignty grade chat lane
  RunGradeSignalAdapter,
  createRunGradeSignalAdapter,
  buildGradeSignalPayload,
  adaptAllGradeSignals,
  adaptGradeBundle,
  adaptGradeAuditBatch,
  gradeAdapterHeadline,
  gradeAdapterCoachingMessage,
  badgeHeadline,
  badgeCoachingMessage,
  comparisonHeadline,
  comparisonCoachingMessage,
  gradeAuditMessage,
  GRADE_SIGNAL_ADAPTER_MANIFEST,
  // SovereigntyExport signal adapter
  SovereigntyExportSignalAdapter,
  createSovereigntyExportSignalAdapter,
  buildExportSignalPayload,
  buildProofCardPayload,
  adaptAllExportSignals,
  adaptExportBundle,
  adaptExportAuditBatch,
  artifactFormatHeadline,
  artifactCoachingMessage,
  gradeExportNote,
  proofCardHeadline,
  proofCardCoachingMessage,
  leaderboardHeadline,
  leaderboardCoachingMessage,
  gradeNarrativeHeadline,
  auditEntryHeadline,
  batchCompleteHeadline,
  batchCompleteCoachingMessage,
  EXPORT_SIGNAL_ADAPTER_MANIFEST,
  // SovereigntyExporter signal adapter
  SovereigntyExporterSignalAdapter,
  createSovereigntyExporterSignalAdapter,
  adaptAllExporterSignals,
  adaptExporterBundle,
  EXPORTER_SIGNAL_ADAPTER_MANIFEST,
  // PersistenceWriter signal adapter
  PersistenceWriterSignalAdapter,
  createPersistenceWriterSignalAdapter,
  adaptAllPersistenceSignals,
  adaptPersistenceBundle,
  PERSISTENCE_SIGNAL_ADAPTER_MANIFEST,
  // SnapshotAdapter signal adapter
  SnapshotAdapterSignalAdapter,
  createSnapshotAdapterSignalAdapter,
  adaptSnapshotSummarySignals,
  adaptSnapshotBundle,
  SNAPSHOT_ADAPTER_SIGNAL_MANIFEST,
};

export type {
  BattleSignalAdapterArtifact,
  BattleSignalAdapterContext,
  BattleSignalAdapterEventName,
  BattleSignalAdapterOptions,
  BattleSignalAdapterRejection,
  BattleSignalAdapterReport,
  BattleSignalAdapterState,
  BattleSnapshotCompat,
  RunSignalAdapterArtifact,
  RunSignalAdapterContext,
  RunSignalAdapterEventName,
  RunSignalAdapterOptions,
  RunSignalAdapterRejection,
  RunSignalAdapterReport,
  RunSignalAdapterState,
  RunSnapshotCompat,
  MultiplayerRoomCompat,
  MultiplayerSignalAdapterAccepted,
  MultiplayerSignalAdapterContext,
  MultiplayerSignalAdapterDeduped,
  MultiplayerSignalAdapterEventName,
  MultiplayerSignalAdapterOptions,
  MultiplayerSignalAdapterRejected,
  MultiplayerSignalAdapterReport,
  MultiplayerSignalAdapterState,
  EconomyDealSnapshotCompat,
  EconomyOfferPayloadCompat,
  EconomySignalAdapterAccepted,
  EconomySignalAdapterContext,
  EconomySignalAdapterDeduped,
  EconomySignalAdapterEventName,
  EconomySignalAdapterOptions,
  EconomySignalAdapterRejected,
  EconomySignalAdapterReport,
  EconomySignalAdapterState,
  // Core ML signal bridge
  CoreDLPacketInput,
  CoreMLSignalAdapterArtifact,
  // Engine signal chat adapter
  EngineMLSignalInput,
  EngineSignalAggregatorInput,
  EngineSignalChatAdapterContext,
  EngineSignalChatAdapterOptions,
  EngineSignalChatAdapterReport,
  EngineSignalChatAdapterState,
  EngineSignalChatArtifact,
  EngineSignalInput,
  WindowMLContextInput,
  CoreMLSignalAdapterContext,
  CoreMLSignalAdapterOptions,
  CoreMLSignalAdapterReport,
  CoreMLSignalAdapterState,
  CoreMLSignalInput,
  CoreMLSignalNarrativeWeight,
  CoreMLSignalSeverity,
  // GamePrimitives signal adapter
  GamePrimitivesAttackCompat,
  GamePrimitivesCascadeCompat,
  GamePrimitivesChatSignalCompat,
  GamePrimitivesLegendMarkerCompat,
  GamePrimitivesMLVectorCompat,
  GamePrimitivesPressureCompat,
  GamePrimitivesRunExperienceCompat,
  GamePrimitivesSignalAdapterArtifact,
  GamePrimitivesSignalAdapterContext,
  GamePrimitivesSignalAdapterDeduped,
  GamePrimitivesSignalAdapterEventName,
  GamePrimitivesSignalAdapterHistoryEntry,
  GamePrimitivesSignalAdapterNarrativeWeight,
  GamePrimitivesSignalAdapterOptions,
  GamePrimitivesSignalAdapterRejection,
  GamePrimitivesSignalAdapterReport,
  GamePrimitivesSignalAdapterSeverity,
  GamePrimitivesSignalAdapterState,
  // Registry signal adapter
  RegistryCapabilityReportCompat,
  RegistryChatSignalCompat,
  RegistryEngineHealthCompat,
  RegistryMLVectorCompat,
  RegistrySignalAdapterArtifact,
  RegistrySignalAdapterContext,
  RegistrySignalAdapterDeduped,
  RegistrySignalAdapterEventName,
  RegistrySignalAdapterHistoryEntry,
  RegistrySignalAdapterNarrativeWeight,
  RegistrySignalAdapterOptions,
  RegistrySignalAdapterRejection,
  RegistrySignalAdapterReport,
  RegistrySignalAdapterSeverity,
  RegistrySignalAdapterState,
  // TickTransaction signal adapter
  TickTransactionChatSignalCompat,
  TickTransactionHealthReportCompat,
  TickTransactionSignalAdapterArtifact,
  TickTransactionSignalAdapterContext,
  TickTransactionSignalAdapterDeduped,
  TickTransactionSignalAdapterEventName,
  TickTransactionSignalAdapterHistoryEntry,
  TickTransactionSignalAdapterNarrativeWeight,
  TickTransactionSignalAdapterOptions,
  TickTransactionSignalAdapterRejection,
  TickTransactionSignalAdapterReport,
  TickTransactionSignalAdapterSeverity,
  TickTransactionSignalAdapterState,
  TickTransactionUXReportCompat,
  // EventBus signal adapter
  EventBusAnalyticsReportCompat,
  EventBusChatSignalCompat,
  EventBusHealthReportCompat,
  EventBusMLVectorCompat,
  EventBusSignalAdapterArtifact,
  EventBusSignalAdapterContext,
  EventBusSignalAdapterDeduped,
  EventBusSignalAdapterEventName,
  EventBusSignalAdapterHistoryEntry,
  EventBusSignalAdapterNarrativeWeight,
  EventBusSignalAdapterOptions,
  EventBusSignalAdapterRejection,
  EventBusSignalAdapterReport,
  EventBusSignalAdapterSeverity,
  EventBusSignalAdapterState,
  // Checkpoint signal adapter
  CheckpointChatSignalCompat,
  CheckpointDLTensorCompat,
  CheckpointMLVectorCompat,
  CheckpointRollbackRiskCompat,
  CheckpointSignalAdapterArtifact,
  CheckpointSignalAdapterContext,
  CheckpointSignalAdapterDeduped,
  CheckpointSignalAdapterEventName,
  CheckpointSignalAdapterHistoryEntry,
  CheckpointSignalAdapterNarrativeWeight,
  CheckpointSignalAdapterOptions,
  CheckpointSignalAdapterRejection,
  CheckpointSignalAdapterReport,
  CheckpointSignalAdapterSeverity,
  CheckpointSignalAdapterState,
  // Outcome signal adapter
  OutcomeDecisionContextCompat,
  OutcomeDLTensorCompat,
  OutcomeForecastCompat,
  OutcomeMLVectorCompat,
  OutcomeNarrationHintCompat,
  OutcomeProximityCompat,
  OutcomeSignalAdapterArtifact,
  OutcomeSignalAdapterContext,
  OutcomeSignalAdapterDeduped,
  OutcomeSignalAdapterEventName,
  OutcomeSignalAdapterHistoryEntry,
  OutcomeSignalAdapterNarrativeWeight,
  OutcomeSignalAdapterOptions,
  OutcomeSignalAdapterRejection,
  OutcomeSignalAdapterReport,
  OutcomeSignalAdapterSeverity,
  OutcomeSignalAdapterState,
  // ThreatRouting signal adapter
  CounterStrategyAdviceCompat,
  ThreatBotPredictionCompat,
  ThreatChatSignalCompat,
  ThreatDLTensorCompat,
  ThreatMLVectorCompat,
  ThreatRoutingSignalAdapterArtifact,
  ThreatRoutingSignalAdapterContext,
  ThreatRoutingSignalAdapterDeduped,
  ThreatRoutingSignalAdapterEventName,
  ThreatRoutingSignalAdapterHistoryEntry,
  ThreatRoutingSignalAdapterNarrativeWeight,
  ThreatRoutingSignalAdapterOptions,
  ThreatRoutingSignalAdapterRejection,
  ThreatRoutingSignalAdapterReport,
  ThreatRoutingSignalAdapterSeverity,
  ThreatRoutingSignalAdapterState,
  ThreatSurgeEventCompat,
  // TickTrace signal adapter
  TickTraceChatSignalCompat,
  TickTraceDLTensorCompat,
  TickTraceHealthReportCompat,
  TickTraceMLVectorCompat,
  TickTraceRunCoverageCompat,
  TickTraceSignalAdapterArtifact,
  TickTraceSignalAdapterContext,
  TickTraceSignalAdapterDeduped,
  TickTraceSignalAdapterEventName,
  TickTraceSignalAdapterHistoryEntry,
  TickTraceSignalAdapterNarrativeWeight,
  TickTraceSignalAdapterOptions,
  TickTraceSignalAdapterRejection,
  TickTraceSignalAdapterReport,
  TickTraceSignalAdapterSeverity,
  TickTraceSignalAdapterState,
  TickTraceWindowSnapshotCompat,
  // TickSequence signal adapter
  TickSequenceChatSignalCompat,
  TickSequenceDLTensorCompat,
  TickSequenceHealthReportCompat,
  TickSequenceMLVectorCompat,
  TickSequenceSignalAdapterArtifact,
  TickSequenceSignalAdapterContext,
  TickSequenceSignalAdapterDeduped,
  TickSequenceSignalAdapterEventName,
  TickSequenceSignalAdapterHistoryEntry,
  TickSequenceSignalAdapterNarrativeWeight,
  TickSequenceSignalAdapterOptions,
  TickSequenceSignalAdapterRejection,
  TickSequenceSignalAdapterReport,
  TickSequenceSignalAdapterSeverity,
  TickSequenceSignalAdapterState,
  TickPhaseTimingSummaryCompat,
  TickSequenceStatCompat,
  TickStepPerformanceSummaryCompat,
  // Mode signal adapter types
  ChatModeSignal,
  ModeSignalKind,
  ModeSignalPriority,
  ModeSignalChannelRecommendation,
  ModeLifecyclePhase,
  ModeMlVector,
  ModeDlTensor,
  ModeConfiguredPayload,
  ModeTickPayload,
  ModeActionPayload,
  ModeFinalizedPayload,
  ModeSignalPayload,
  ModeSignalAdapterOptions,
  ModeSignalBatchEntry,
  ModeSignalBatchResult,
  ModeSignalAnalyticsSummary,
  // Pressure signal adapter types
  PressureSignalAdapterEventName,
  PressureSignalAdapterOptions,
  PressureSignalAdapterLogger,
  PressureSignalAdapterClock,
  PressureSignalAdapterContext,
  PressureSignalAdapterState,
  PressureSignalAdapterReport,
  PressureSignalAdapterArtifact,
  PressureSignalAdapterDeduped,
  PressureSignalAdapterRejection,
  PressureSignalAdapterHistoryEntry,
  PressureSignalAdapterSeverity,
  PressureSignalAdapterPriority,
  PressureSignalAdapterNarrativeWeight,
  PressureSignalAdapterChannelRecommendation,
  PressureSnapshotCompat,
  PressureSignalInput,
  PressureChatSignalCompat,
  PressureMLVectorCompat,
  PressureDLTensorCompat,
  PressureForecastCompat,
  PressureUXHintCompat,
  PressureAnnotationCompat,
  PressureAdapterMLVector,
  // Decay signal adapter types
  DecaySignalAdapterEventName,
  DecaySignalAdapterOptions,
  DecaySignalAdapterLogger,
  DecaySignalAdapterClock,
  DecaySignalAdapterContext,
  DecaySignalAdapterState,
  DecaySignalAdapterReport,
  DecaySignalAdapterArtifact,
  DecaySignalAdapterDeduped,
  DecaySignalAdapterRejection,
  DecaySignalAdapterHistoryEntry,
  DecaySignalAdapterSeverity,
  DecaySignalAdapterNarrativeWeight,
  DecaySignalAdapterChannelRecommendation,
  DecaySnapshotCompat,
  DecaySignalInput,
  DecayChatSignalCompat,
  DecayMLVectorCompat,
  DecayDLTensorCompat,
  DecayForecastCompat,
  DecayAnnotationCompat,
  DecayPolicySummaryCompat,
  DecayAdapterMLVector,
  // Collector signal adapter types
  CollectorSignalAdapterEventName,
  CollectorSignalAdapterOptions,
  CollectorSignalAdapterLogger,
  CollectorSignalAdapterClock,
  CollectorSignalAdapterContext,
  CollectorSignalAdapterState,
  CollectorSignalAdapterReport,
  CollectorSignalAdapterArtifact,
  CollectorSignalAdapterDeduped,
  CollectorSignalAdapterRejection,
  CollectorSignalAdapterHistoryEntry,
  CollectorSignalAdapterSeverity,
  CollectorSignalAdapterPriority,
  CollectorSignalAdapterNarrativeWeight,
  CollectorSignalAdapterChannelRecommendation,
  CollectorSnapshotCompat,
  CollectorSignalInput,
  CollectorChatSignalCompat,
  CollectorMLVectorCompat,
  CollectorDLTensorCompat,
  CollectorForecastCompat,
  CollectorUXHintCompat,
  CollectorAnnotationCompat,
  CollectorAdapterMLVector,
  CollectorCompatBundle,
  CollectorAdapterFullBundle,
  CollectorThresholdReport,
  // Shield signal adapter types
  ShieldSignalAdapterEventName,
  ShieldSignalAdapterLogger,
  ShieldSignalAdapterClock,
  ShieldSignalAdapterOptions,
  ShieldSignalAdapterContext,
  ShieldSnapshotCompat,
  ShieldSignalInput,
  ShieldSignalBatchInput,
  ShieldSignalAdapterSeverity,
  ShieldSignalAdapterNarrativeWeight,
  ShieldSignalAdapterChannelRecommendation,
  ShieldSignalAdapterArtifact,
  ShieldSignalAdapterDeduped,
  ShieldSignalAdapterRejection,
  ShieldSignalAdapterHistoryEntry,
  ShieldSignalAdapterState,
  ShieldSignalAdapterReport,
  ShieldChatSignalCompat,
  ShieldMLVectorCompat,
  ShieldDLTensorCompat,
  ShieldCascadeMLVectorCompat,
  ShieldCascadeDLTensorCompat,
  ShieldUXHintCompat,
  ShieldAnnotationCompat,
  ShieldRepairJobCompat,
  ShieldRepairSliceCompat,
  ShieldQueueRejectionCompat,
  ShieldRoutedAttackCompat,
  ShieldDamageResolutionCompat,
  ShieldCascadeResolutionCompat,
  ShieldAdapterBundle,
  ShieldExposureProfile,
  ShieldPreRoutingCompat,
  ShieldInspectorBundle,
  ShieldSessionReportBundle,
  ShieldLayerConfigMap,
  // Shield Layer Manager signal adapter types
  ShieldLayerMgrAdapterEventName,
  ShieldLayerMgrAdapterSeverity,
  ShieldLayerMgrAdapterNarrativeWeight,
  ShieldLayerMgrAdapterChannelRecommendation,
  ShieldLayerMgrAdapterLogger,
  ShieldLayerMgrAdapterClock,
  ShieldLayerMgrAdapterOptions,
  ShieldLayerMgrSignalInput,
  ShieldLayerMgrSignalBatchInput,
  ShieldLayerMgrChatSignalCompat,
  ShieldLayerMgrMLVectorCompat,
  ShieldLayerMgrDLTensorCompat,
  ShieldLayerMgrUXHintCompat,
  ShieldLayerMgrAnnotationCompat,
  ShieldLayerMgrConfigMapCompat,
  ShieldLayerMgrDamageResolutionCompat,
  ShieldLayerMgrRepairJobCompat,
  ShieldLayerMgrAdapterBundle,
  ShieldLayerMgrAdapterState,
  ShieldLayerMgrAdapterReport,
  ShieldLayerMgrAdapterRejection,
  ShieldLayerMgrAdapterHistoryEntry,
  ShieldLayerMgrAdapterArtifact,
  ShieldLayerMgrAdapterDeduped,
  ShieldLayerMgrExposureProfile,
  ShieldLayerMgrPostureSnapshot,
  // Shield Repair Queue signal adapter types
  ShieldRepairQueueAdapterEventName,
  ShieldRepairQueueAdapterSeverity,
  ShieldRepairQueueAdapterNarrativeWeight,
  ShieldRepairQueueAdapterChannelRecommendation,
  ShieldRepairQueueAdapterLogger,
  ShieldRepairQueueAdapterClock,
  ShieldRepairQueueAdapterOptions,
  ShieldRepairQueueSignalInput,
  ShieldRepairQueueSignalBatchInput,
  ShieldRepairQueueChatSignalCompat,
  ShieldRepairQueueAdapterMLVectorCompat,
  ShieldRepairQueueAdapterDLTensorCompat,
  ShieldRepairQueueAdapterUXHintCompat,
  ShieldRepairQueueAdapterAnnotationCompat,
  ShieldRepairQueueAdapterConfigMapCompat,
  ShieldRepairQueueAdapterEnqueueCompat,
  ShieldRepairQueueAdapterSliceCompat,
  ShieldRepairQueueAdapterBundle,
  ShieldRepairQueueAdapterState,
  ShieldRepairQueueAdapterReport,
  ShieldRepairQueueAdapterArtifact,
  ShieldRepairQueueAdapterDeduped,
  ShieldRepairQueueAdapterRejection,
  ShieldRepairQueueAdapterHistoryEntry,
  ShieldRepairQueueAdapterExposureProfile,
  // ProofGenerator signal adapter types
  ProofGenerationResultCompat,
  ProofMLVectorCompat,
  ProofDLTensorCompat,
  ProofAuditEntryCompat,
  ProofCertificateCompat,
  ProofSignalAdapterContext,
  ProofSignalAdapterLogger,
  ProofSignalAdapterClock,
  ProofSignalAdapterSeverity,
  ProofSignalAdapterEventName,
  ProofGeneratorSignalAdapterOptions,
  ProofSignalAdapterStats,
  // ReplayIntegrity signal adapter types
  IntegrityResultCompat,
  IntegrityMLVectorCompat,
  IntegrityDLTensorCompat,
  IntegrityAuditEntryCompat,
  IntegritySignalAdapterContext,
  IntegritySignalAdapterLogger,
  IntegritySignalAdapterClock,
  IntegritySignalAdapterSeverity,
  IntegritySignalAdapterEventName,
  ReplayIntegritySignalAdapterOptions,
  IntegritySignalAdapterStats,
  // RunGrade signal adapter types
  GradeResultCompat,
  GradeMLVectorCompat,
  GradeDLTensorCompat,
  GradeAuditEntryCompat,
  GradeComparisonCompat,
  GradeSignalAdapterContext,
  GradeSignalAdapterLogger,
  GradeSignalAdapterClock,
  GradeSignalAdapterSeverity,
  GradeSignalAdapterEventName,
  RunGradeSignalAdapterOptions,
  GradeSignalAdapterStats,
  // SovereigntyExport signal adapter types
  ExportArtifactCompat,
  ProofCardCompat,
  ExportMLVectorCompat,
  ExportDLTensorCompat,
  ExportAuditEntryCompat,
  LeaderboardProjectionCompat,
  ExplorerCardCompat,
  GradeNarrativeCompat,
  ExportSignalAdapterContext,
  ExportSignalAdapterLogger,
  ExportSignalAdapterClock,
  ExportSignalAdapterSeverity,
  ExportSignalAdapterEventName,
  SovereigntyExportSignalAdapterOptions,
  ExportSignalAdapterStats,
  // SovereigntyExporter signal adapter types
  ExporterPipelineResultCompat,
  ExporterAdapterMLVectorCompat,
  ExporterAdapterDLTensorCompat,
  ExporterAdapterAuditEntryCompat,
  ExporterSignalAdapterContext,
  ExporterSignalAdapterOptions,
  ExporterSignalAdapterStats,
  // PersistenceWriter signal adapter types
  PersistenceEnvelopeCompat,
  PersistenceWriteStatsCompat,
  PersistenceAdapterMLVectorCompat,
  PersistenceAdapterDLTensorCompat,
  PersistenceAdapterAuditEntryCompat,
  PersistenceSignalAdapterContext,
  PersistenceSignalAdapterOptions,
  PersistenceSignalAdapterStats,
  // SnapshotAdapter signal adapter types
  TickRecordCompat,
  RunSummaryCompat,
  SnapshotDeltaCompat,
  SnapshotAdapterMLVectorCompat,
  SnapshotAdapterDLTensorCompat,
  SnapshotAdapterAuditEntryCompat,
  SnapshotSignalAdapterContext,
  SnapshotAdapterSignalAdapterOptions,
  SnapshotSignalAdapterStats,
};

// ============================================================================
// MARK: Suite constants, module descriptors, and manifest surfaces
// ============================================================================

export const BACKEND_CHAT_ADAPTER_SUITE_VERSION = '2026.03.14' as const;
export const BACKEND_CHAT_ADAPTER_SUITE_PUBLIC_API_VERSION = '1.0.0-alpha' as const;

export const BACKEND_CHAT_ADAPTER_DOMAIN_IDS = Object.freeze([
  'BATTLE',
  'RUN',
  'MULTIPLAYER',
  'ECONOMY',
  'GAME_PRIMITIVES',
  'ENGINE_REGISTRY',
  'TICK_TRANSACTION',
  'EVENT_BUS',
  'CHECKPOINT',
  'OUTCOME',
  'THREAT_ROUTING',
  'PRESSURE',
  'DECAY',
  'COLLECTOR',
  'SHIELD',
  'SHIELD_LAYER_MANAGER',
  'SHIELD_REPAIR_QUEUE',
] as const);

export type BackendChatAdapterDomainId =
  (typeof BACKEND_CHAT_ADAPTER_DOMAIN_IDS)[number];

export const BACKEND_CHAT_ADAPTER_TREE_PATHS = Object.freeze({
  root: 'backend/src/game/engine/chat/adapters',
  index: 'backend/src/game/engine/chat/adapters/index.ts',
  battle: 'backend/src/game/engine/chat/adapters/BattleSignalAdapter.ts',
  run: 'backend/src/game/engine/chat/adapters/RunSignalAdapter.ts',
  multiplayer:
    'backend/src/game/engine/chat/adapters/MultiplayerSignalAdapter.ts',
  economy: 'backend/src/game/engine/chat/adapters/EconomySignalAdapter.ts',
  pressure: 'backend/src/game/engine/chat/adapters/PressureSignalAdapter.ts',
  decay: 'backend/src/game/engine/chat/adapters/DecaySignalAdapter.ts',
  collector: 'backend/src/game/engine/chat/adapters/CollectorSignalAdapter.ts',
  shield: 'backend/src/game/engine/chat/adapters/ShieldSignalAdapter.ts',
  shieldLayerManager: 'backend/src/game/engine/chat/adapters/ShieldLayerManagerSignalAdapter.ts',
  shieldRepairQueue: 'backend/src/game/engine/chat/adapters/ShieldRepairQueueSignalAdapter.ts',
} as const);

export interface BackendChatAdapterModuleDescriptor {
  readonly domain: BackendChatAdapterDomainId;
  readonly className: string;
  readonly relativePath: string;
  readonly ownsTruth: false;
  readonly description: string;
}

export const BACKEND_CHAT_ADAPTER_MODULES = Object.freeze<
  readonly BackendChatAdapterModuleDescriptor[]
>([
  {
    domain: 'BATTLE',
    className: 'BattleSignalAdapter',
    relativePath: BACKEND_CHAT_ADAPTER_TREE_PATHS.battle,
    ownsTruth: false,
    description:
      'Translates backend battle authority into backend-chat battle ingress.',
  },
  {
    domain: 'RUN',
    className: 'RunSignalAdapter',
    relativePath: BACKEND_CHAT_ADAPTER_TREE_PATHS.run,
    ownsTruth: false,
    description:
      'Translates run lifecycle/runtime authority into backend-chat run ingress.',
  },
  {
    domain: 'MULTIPLAYER',
    className: 'MultiplayerSignalAdapter',
    relativePath: BACKEND_CHAT_ADAPTER_TREE_PATHS.multiplayer,
    ownsTruth: false,
    description:
      'Translates room/member/party/co-op authority into backend-chat social ingress.',
  },
  {
    domain: 'ECONOMY',
    className: 'EconomySignalAdapter',
    relativePath: BACKEND_CHAT_ADAPTER_TREE_PATHS.economy,
    ownsTruth: false,
    description:
      'Translates deal-room/liquidity/offer authority into backend-chat economy ingress.',
  },
  {
    domain: 'PRESSURE',
    className: 'PressureSignalAdapter',
    relativePath: BACKEND_CHAT_ADAPTER_TREE_PATHS.pressure,
    ownsTruth: false,
    description:
      'Translates backend pressure engine state into backend-chat pressure ingress — tier changes, band crossings, ML vectors, DL tensors, UX hints, and recovery forecasts.',
  },
  {
    domain: 'DECAY',
    className: 'DecaySignalAdapter',
    relativePath: BACKEND_CHAT_ADAPTER_TREE_PATHS.decay,
    ownsTruth: false,
    description:
      'Translates PressureDecayController outputs into backend-chat decay ingress — constraint activation, tier blocking, sticky floor, policy shifts, forecasts, ML vectors, and DL tensors.',
  },
  {
    domain: 'COLLECTOR',
    className: 'CollectorSignalAdapter',
    relativePath: BACKEND_CHAT_ADAPTER_TREE_PATHS.collector,
    ownsTruth: false,
    description:
      'Translates PressureSignalCollector outputs into backend-chat collector ingress — urgency escalations, tier/band crossings, trend spikes, plateaux, relief events, recovery forecasts, ML vectors, and DL tensors.',
  },
  {
    domain: 'SHIELD',
    className: 'ShieldSignalAdapter',
    relativePath: BACKEND_CHAT_ADAPTER_TREE_PATHS.shield,
    ownsTruth: false,
    description:
      'Translates AttackRouter batch decisions and BreachCascadeResolver cascade contexts into backend-chat shield ingress — L1–L4 breach events, ghost L3 echo chains, sovereignty L4 fatality escalations, doctrine shifts, ML vectors (36-feature attack + 32-feature cascade), DL tensors (44×6 attack + 40×6 cascade), annotation bundles, and UX hints.',
  },
  {
    domain: 'SHIELD_LAYER_MANAGER',
    className: 'ShieldLayerManagerSignalAdapter',
    relativePath: BACKEND_CHAT_ADAPTER_TREE_PATHS.shieldLayerManager,
    ownsTruth: false,
    description:
      'Translates ShieldLayerManager per-tick state — L1–L4 integrity changes, breach events, cascade cracks, repair deliveries, regen ticks, ghost echo risk, and sovereignty fatality risk — into backend-chat shield-layer signals. Produces 32-feature ML vectors, 40×6 DL tensors, annotation bundles, UX hints, resilience forecasts, and trend summaries.',
  },
  {
    domain: 'SHIELD_REPAIR_QUEUE',
    className: 'ShieldRepairQueueSignalAdapter',
    relativePath: BACKEND_CHAT_ADAPTER_TREE_PATHS.shieldRepairQueue,
    ownsTruth: false,
    description:
      'Translates ShieldRepairQueue per-tick state — job enqueue/completion/rejection, HP delivery, overflow risk, utilization saturation, throughput degradation, and repair urgency — into backend-chat shield-repair signals. Produces 28-feature ML vectors, 36×6 DL tensors, annotation bundles, UX hints, capacity forecasts, and trend summaries.',
  },
]);

// ============================================================================
// MARK: Suite logger and clock
// ============================================================================

export interface BackendChatAdapterSuiteLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface BackendChatAdapterSuiteClock {
  now(): UnixMs;
}

// ============================================================================
// MARK: Normalized suite contexts, ingress, and bundle contracts
// ============================================================================

export interface BackendChatAdapterContextBase {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface BackendChatBattleIngress {
  readonly domain: 'BATTLE';
  readonly eventName: BattleSignalAdapterEventName;
  readonly payload: unknown;
  readonly context?: BattleSignalAdapterContext;
}

export interface BackendChatRunIngress {
  readonly domain: 'RUN';
  readonly eventName: RunSignalAdapterEventName;
  readonly payload: unknown;
  readonly context?: RunSignalAdapterContext;
}

export interface BackendChatMultiplayerIngress {
  readonly domain: 'MULTIPLAYER';
  readonly eventName: MultiplayerSignalAdapterEventName;
  readonly payload: unknown;
  readonly context?: MultiplayerSignalAdapterContext;
}

export interface BackendChatEconomyIngress {
  readonly domain: 'ECONOMY';
  readonly eventName: EconomySignalAdapterEventName;
  readonly payload: unknown;
  readonly context?: EconomySignalAdapterContext;
}

export interface BackendChatPressureIngress {
  readonly domain: 'PRESSURE';
  readonly eventName: PressureSignalAdapterEventName;
  readonly payload: PressureSignalInput;
  readonly context?: PressureSignalAdapterContext;
}

export interface BackendChatDecayIngress {
  readonly domain: 'DECAY';
  readonly eventName: DecaySignalAdapterEventName;
  readonly payload: DecaySignalInput;
  readonly context?: DecaySignalAdapterContext;
}

export interface BackendChatCollectorIngress {
  readonly domain: 'COLLECTOR';
  readonly eventName: CollectorSignalAdapterEventName;
  readonly payload: CollectorSignalInput;
  readonly context?: CollectorSignalAdapterContext;
}

export type BackendChatAdapterIngress =
  | BackendChatBattleIngress
  | BackendChatRunIngress
  | BackendChatPressureIngress
  | BackendChatDecayIngress
  | BackendChatCollectorIngress
  | BackendChatMultiplayerIngress
  | BackendChatEconomyIngress;

export interface BackendChatBattleSnapshotIngress {
  readonly domain: 'BATTLE';
  readonly snapshot: BattleSnapshotCompat;
  readonly context?: BattleSignalAdapterContext;
}

export interface BackendChatRunSnapshotIngress {
  readonly domain: 'RUN';
  readonly snapshot: RunSnapshotCompat;
  readonly context?: RunSignalAdapterContext;
}

export interface BackendChatMultiplayerSnapshotIngress {
  readonly domain: 'MULTIPLAYER';
  readonly snapshot: MultiplayerRoomCompat;
  readonly context?: MultiplayerSignalAdapterContext;
}

export interface BackendChatEconomySnapshotIngress {
  readonly domain: 'ECONOMY';
  readonly snapshot: EconomyDealSnapshotCompat;
  readonly context?: EconomySignalAdapterContext;
}

export type BackendChatAdapterSnapshotIngress =
  | BackendChatBattleSnapshotIngress
  | BackendChatRunSnapshotIngress
  | BackendChatMultiplayerSnapshotIngress
  | BackendChatEconomySnapshotIngress;

export interface BackendChatAdapterSnapshotBundle {
  readonly battle?: BattleSnapshotCompat | null;
  readonly run?: RunSnapshotCompat | null;
  readonly multiplayer?: MultiplayerRoomCompat | null;
  readonly economy?: EconomyDealSnapshotCompat | null;
}

export interface BackendChatAdapterBundleContext {
  readonly battle?: BattleSignalAdapterContext;
  readonly run?: RunSignalAdapterContext;
  readonly multiplayer?: MultiplayerSignalAdapterContext;
  readonly economy?: EconomySignalAdapterContext;
}

// ============================================================================
// MARK: Suite option contracts
// ============================================================================

export interface BackendChatAdapterSuiteOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly logger?: BackendChatAdapterSuiteLogger;
  readonly clock?: BackendChatAdapterSuiteClock;
  readonly battle?: Partial<BattleSignalAdapterOptions>;
  readonly run?: Partial<RunSignalAdapterOptions>;
  readonly multiplayer?: Partial<MultiplayerSignalAdapterOptions>;
  readonly economy?: Partial<EconomySignalAdapterOptions>;
  readonly coreML?: Partial<CoreMLSignalAdapterOptions>;
  readonly engineSignal?: Partial<EngineSignalChatAdapterOptions>;
}

export interface BackendChatResolvedAdapterSuiteOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel: ChatVisibleChannel;
  readonly battle: BattleSignalAdapterOptions;
  readonly run: RunSignalAdapterOptions;
  readonly multiplayer: MultiplayerSignalAdapterOptions;
  readonly economy: EconomySignalAdapterOptions;
}

// ============================================================================
// MARK: Unified suite accepted / deduped / rejected / state contracts
// ============================================================================

export interface BackendChatUnifiedAcceptedArtifact {
  readonly domain: BackendChatAdapterDomainId;
  readonly eventName: string;
  readonly dedupeKey: string;
  readonly routeChannel: ChatVisibleChannel;
  readonly severity: string;
  readonly narrativeWeight: string;
  readonly emittedAt: UnixMs;
  readonly envelope: ChatInputEnvelope;
  readonly signal: ChatSignalEnvelope;
  readonly diagnostics: Readonly<Record<string, JsonValue>>;
}

export interface BackendChatUnifiedDedupedArtifact {
  readonly domain: BackendChatAdapterDomainId;
  readonly eventName: string;
  readonly dedupeKey: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface BackendChatUnifiedRejectedArtifact {
  readonly domain: BackendChatAdapterDomainId;
  readonly eventName: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface BackendChatAdapterDomainCounters {
  readonly accepted: number;
  readonly deduped: number;
  readonly rejected: number;
}

export interface BackendChatAdapterSuiteState {
  readonly battle: BattleSignalAdapterState;
  readonly run: RunSignalAdapterState;
  readonly multiplayer: MultiplayerSignalAdapterState;
  readonly economy: EconomySignalAdapterState;
  readonly coreML: CoreMLSignalAdapterState;
  readonly engineSignal: EngineSignalChatAdapterState;
  readonly totals: Readonly<Record<BackendChatAdapterDomainId, BackendChatAdapterDomainCounters>>;
}

export interface BackendChatAdapterDomainReport<TAccepted, TDeduped, TRejected> {
  readonly accepted: readonly TAccepted[];
  readonly deduped: readonly TDeduped[];
  readonly rejected: readonly TRejected[];
}

export interface BackendChatAdapterSuiteReport {
  readonly accepted: readonly BackendChatUnifiedAcceptedArtifact[];
  readonly deduped: readonly BackendChatUnifiedDedupedArtifact[];
  readonly rejected: readonly BackendChatUnifiedRejectedArtifact[];
  readonly byDomain: Readonly<{
    battle: BackendChatAdapterDomainReport<
      BattleSignalAdapterArtifact,
      BattleSignalAdapterArtifact,
      BattleSignalAdapterRejection
    >;
    run: BackendChatAdapterDomainReport<
      RunSignalAdapterArtifact,
      RunSignalAdapterArtifact,
      RunSignalAdapterRejection
    >;
    multiplayer: BackendChatAdapterDomainReport<
      MultiplayerSignalAdapterAccepted,
      MultiplayerSignalAdapterDeduped,
      MultiplayerSignalAdapterRejected
    >;
    economy: BackendChatAdapterDomainReport<
      EconomySignalAdapterAccepted,
      EconomySignalAdapterDeduped,
      EconomySignalAdapterRejected
    >;
  }>;
  readonly counters: Readonly<Record<BackendChatAdapterDomainId, BackendChatAdapterDomainCounters>>;
}

export interface BackendChatAdapterHealthReport {
  readonly version: string;
  readonly publicApiVersion: string;
  readonly moduleCount: number;
  readonly totalAccepted: number;
  readonly totalDeduped: number;
  readonly totalRejected: number;
  readonly hottestDomain: BackendChatAdapterDomainId;
  readonly quietestDomain: BackendChatAdapterDomainId;
  readonly domains: Readonly<Record<BackendChatAdapterDomainId, BackendChatAdapterDomainCounters>>;
}

// ============================================================================
// MARK: Suite classifier / route / descriptor contracts
// ============================================================================

export type BackendChatAdapterIngressKind =
  | 'BATTLE_EVENT'
  | 'RUN_EVENT'
  | 'MULTIPLAYER_EVENT'
  | 'ECONOMY_EVENT'
  | 'BATTLE_SNAPSHOT'
  | 'RUN_SNAPSHOT'
  | 'MULTIPLAYER_SNAPSHOT'
  | 'ECONOMY_SNAPSHOT';

export interface BackendChatAdapterIngressDescriptor {
  readonly kind: BackendChatAdapterIngressKind;
  readonly domain: BackendChatAdapterDomainId;
  readonly routeChannel: Nullable<ChatVisibleChannel>;
  readonly roomId: Nullable<ChatRoomId | string>;
  readonly eventName: Nullable<string>;
}

// ============================================================================
// MARK: Default logger and clock
// ============================================================================

const NULL_LOGGER: BackendChatAdapterSuiteLogger = Object.freeze({
  debug() {
    // deliberate no-op
  },
  warn() {
    // deliberate no-op
  },
  error() {
    // deliberate no-op
  },
});

const SYSTEM_CLOCK: BackendChatAdapterSuiteClock = Object.freeze({
  now(): UnixMs {
    return asUnixMs(Date.now());
  },
});

// ============================================================================
// MARK: Helper functions — option resolution
// ============================================================================

function resolveDefaultVisibleChannel(
  value: ChatVisibleChannel | undefined,
): ChatVisibleChannel {
  return value ?? 'GLOBAL';
}

function resolveBattleOptions(
  options: BackendChatAdapterSuiteOptions,
  logger: BackendChatAdapterSuiteLogger,
  clock: BackendChatAdapterSuiteClock,
): BattleSignalAdapterOptions {
  return Object.freeze({
    defaultRoomId: options.defaultRoomId,
    defaultVisibleChannel: options.defaultVisibleChannel,
    logger,
    clock,
    ...(options.battle ?? {}),
  });
}

function resolveRunOptions(
  options: BackendChatAdapterSuiteOptions,
  logger: BackendChatAdapterSuiteLogger,
  clock: BackendChatAdapterSuiteClock,
): RunSignalAdapterOptions {
  return Object.freeze({
    defaultRoomId: options.defaultRoomId,
    defaultVisibleChannel: options.defaultVisibleChannel,
    logger,
    clock,
    ...(options.run ?? {}),
  });
}

function resolveMultiplayerOptions(
  options: BackendChatAdapterSuiteOptions,
  logger: BackendChatAdapterSuiteLogger,
  clock: BackendChatAdapterSuiteClock,
): MultiplayerSignalAdapterOptions {
  return Object.freeze({
    defaultRoomId: options.defaultRoomId,
    defaultVisibleChannel: options.defaultVisibleChannel,
    logger,
    clock,
    ...(options.multiplayer ?? {}),
  });
}

function resolveEconomyOptions(
  options: BackendChatAdapterSuiteOptions,
  logger: BackendChatAdapterSuiteLogger,
  clock: BackendChatAdapterSuiteClock,
): EconomySignalAdapterOptions {
  return Object.freeze({
    defaultRoomId: options.defaultRoomId,
    defaultVisibleChannel: options.defaultVisibleChannel,
    logger,
    clock,
    ...(options.economy ?? {}),
  });
}

export function resolveBackendChatAdapterSuiteOptions(
  options: BackendChatAdapterSuiteOptions,
): BackendChatResolvedAdapterSuiteOptions {
  const logger = options.logger ?? NULL_LOGGER;
  const clock = options.clock ?? SYSTEM_CLOCK;
  const defaultVisibleChannel = resolveDefaultVisibleChannel(
    options.defaultVisibleChannel,
  );

  const resolvedOptions: BackendChatAdapterSuiteOptions = Object.freeze({
    ...options,
    defaultVisibleChannel,
    logger,
    clock,
  });

  return Object.freeze({
    defaultRoomId: options.defaultRoomId,
    defaultVisibleChannel,
    battle: resolveBattleOptions(resolvedOptions, logger, clock),
    run: resolveRunOptions(resolvedOptions, logger, clock),
    multiplayer: resolveMultiplayerOptions(resolvedOptions, logger, clock),
    economy: resolveEconomyOptions(resolvedOptions, logger, clock),
  });
}

export function createDefaultBackendChatAdapterSuiteOptions(
  defaultRoomId: ChatRoomId | string,
  defaultVisibleChannel: ChatVisibleChannel = 'GLOBAL',
): BackendChatResolvedAdapterSuiteOptions {
  return resolveBackendChatAdapterSuiteOptions({
    defaultRoomId,
    defaultVisibleChannel,
  });
}

// ============================================================================
// MARK: Helper functions — report normalization
// ============================================================================

function inferAcceptedUnixMs(envelope: ChatInputEnvelope): UnixMs {
  return envelope.emittedAt;
}

function inferSignalFromEnvelope(envelope: ChatInputEnvelope): ChatSignalEnvelope {
  switch (envelope.kind) {
    case 'BATTLE_SIGNAL':
    case 'RUN_SIGNAL':
    case 'MULTIPLAYER_SIGNAL':
    case 'ECONOMY_SIGNAL':
    case 'LIVEOPS_SIGNAL':
      return envelope.payload;
    default:
      return envelope.payload as unknown as ChatSignalEnvelope;
  }
}

function normalizeBattleAccepted(
  artifact: BattleSignalAdapterArtifact,
): BackendChatUnifiedAcceptedArtifact {
  return Object.freeze({
    domain: 'BATTLE',
    eventName: artifact.eventName,
    dedupeKey: artifact.dedupeKey,
    routeChannel: artifact.routeChannel,
    severity: artifact.severity,
    narrativeWeight: artifact.narrativeWeight,
    emittedAt: inferAcceptedUnixMs(artifact.envelope),
    envelope: artifact.envelope,
    signal: inferSignalFromEnvelope(artifact.envelope),
    diagnostics: artifact.details,
  });
}

function normalizeRunAccepted(
  artifact: RunSignalAdapterArtifact,
): BackendChatUnifiedAcceptedArtifact {
  return Object.freeze({
    domain: 'RUN',
    eventName: artifact.eventName,
    dedupeKey: artifact.dedupeKey,
    routeChannel: artifact.routeChannel,
    severity: artifact.severity,
    narrativeWeight: artifact.narrativeWeight,
    emittedAt: inferAcceptedUnixMs(artifact.envelope),
    envelope: artifact.envelope,
    signal: inferSignalFromEnvelope(artifact.envelope),
    diagnostics: artifact.details,
  });
}

function normalizeMultiplayerAccepted(
  artifact: MultiplayerSignalAdapterAccepted,
): BackendChatUnifiedAcceptedArtifact {
  return Object.freeze({
    domain: 'MULTIPLAYER',
    eventName: artifact.eventName,
    dedupeKey: artifact.dedupeKey,
    routeChannel: artifact.routeChannel,
    severity: artifact.severity,
    narrativeWeight: artifact.narrativeWeight,
    emittedAt: inferAcceptedUnixMs(artifact.envelope),
    envelope: artifact.envelope,
    signal: artifact.signal,
    diagnostics: artifact.diagnostics,
  });
}

function normalizeEconomyAccepted(
  artifact: EconomySignalAdapterAccepted,
): BackendChatUnifiedAcceptedArtifact {
  return Object.freeze({
    domain: 'ECONOMY',
    eventName: artifact.eventName,
    dedupeKey: artifact.dedupeKey,
    routeChannel: artifact.routeChannel,
    severity: artifact.severity,
    narrativeWeight: artifact.narrativeWeight,
    emittedAt: inferAcceptedUnixMs(artifact.envelope),
    envelope: artifact.envelope,
    signal: artifact.signal,
    diagnostics: artifact.diagnostics,
  });
}

function normalizeBattleDeduped(
  artifact: BattleSignalAdapterArtifact,
): BackendChatUnifiedDedupedArtifact {
  return Object.freeze({
    domain: 'BATTLE',
    eventName: artifact.eventName,
    dedupeKey: artifact.dedupeKey,
    reason: 'DEDUPED',
    details: artifact.details,
  });
}

function normalizeRunDeduped(
  artifact: RunSignalAdapterArtifact,
): BackendChatUnifiedDedupedArtifact {
  return Object.freeze({
    domain: 'RUN',
    eventName: artifact.eventName,
    dedupeKey: artifact.dedupeKey,
    reason: 'DEDUPED',
    details: artifact.details,
  });
}

function normalizeMultiplayerDeduped(
  artifact: MultiplayerSignalAdapterDeduped,
): BackendChatUnifiedDedupedArtifact {
  return Object.freeze({
    domain: 'MULTIPLAYER',
    eventName: artifact.eventName,
    dedupeKey: artifact.dedupeKey,
    reason: artifact.reason,
    details: artifact.details,
  });
}

function normalizeEconomyDeduped(
  artifact: EconomySignalAdapterDeduped,
): BackendChatUnifiedDedupedArtifact {
  return Object.freeze({
    domain: 'ECONOMY',
    eventName: artifact.eventName,
    dedupeKey: artifact.dedupeKey,
    reason: artifact.reason,
    details: artifact.details,
  });
}

function normalizeBattleRejected(
  artifact: BattleSignalAdapterRejection,
): BackendChatUnifiedRejectedArtifact {
  return Object.freeze({
    domain: 'BATTLE',
    eventName: artifact.eventName,
    reason: artifact.reason,
    details: artifact.details,
  });
}

function normalizeRunRejected(
  artifact: RunSignalAdapterRejection,
): BackendChatUnifiedRejectedArtifact {
  return Object.freeze({
    domain: 'RUN',
    eventName: artifact.eventName,
    reason: artifact.reason,
    details: artifact.details,
  });
}

function normalizeMultiplayerRejected(
  artifact: MultiplayerSignalAdapterRejected,
): BackendChatUnifiedRejectedArtifact {
  return Object.freeze({
    domain: 'MULTIPLAYER',
    eventName: artifact.eventName,
    reason: artifact.reason,
    details: artifact.details,
  });
}

function normalizeEconomyRejected(
  artifact: EconomySignalAdapterRejected,
): BackendChatUnifiedRejectedArtifact {
  return Object.freeze({
    domain: 'ECONOMY',
    eventName: artifact.eventName,
    reason: artifact.reason,
    details: artifact.details,
  });
}

function emptyDomainCounters(): BackendChatAdapterDomainCounters {
  return Object.freeze({
    accepted: 0,
    deduped: 0,
    rejected: 0,
  });
}

function toCounters(
  accepted: number,
  deduped: number,
  rejected: number,
): BackendChatAdapterDomainCounters {
  return Object.freeze({ accepted, deduped, rejected });
}

function pickHottestDomain(
  counters: Readonly<Record<BackendChatAdapterDomainId, BackendChatAdapterDomainCounters>>,
): BackendChatAdapterDomainId {
  let winner: BackendChatAdapterDomainId = 'BATTLE';
  let highest = -1;
  for (const domain of BACKEND_CHAT_ADAPTER_DOMAIN_IDS) {
    const score =
      counters[domain].accepted + counters[domain].deduped + counters[domain].rejected;
    if (score > highest) {
      highest = score;
      winner = domain;
    }
  }
  return winner;
}

function pickQuietestDomain(
  counters: Readonly<Record<BackendChatAdapterDomainId, BackendChatAdapterDomainCounters>>,
): BackendChatAdapterDomainId {
  let winner: BackendChatAdapterDomainId = 'BATTLE';
  let lowest = Number.POSITIVE_INFINITY;
  for (const domain of BACKEND_CHAT_ADAPTER_DOMAIN_IDS) {
    const score =
      counters[domain].accepted + counters[domain].deduped + counters[domain].rejected;
    if (score < lowest) {
      lowest = score;
      winner = domain;
    }
  }
  return winner;
}

// ============================================================================
// MARK: Helper functions — descriptor / ingress inference
// ============================================================================

export function describeAdapterIngress(
  ingress: BackendChatAdapterIngress | BackendChatAdapterSnapshotIngress,
): BackendChatAdapterIngressDescriptor {
  if ('eventName' in ingress) {
    return Object.freeze({
      kind:
        ingress.domain === 'BATTLE'
          ? 'BATTLE_EVENT'
          : ingress.domain === 'RUN'
            ? 'RUN_EVENT'
            : ingress.domain === 'MULTIPLAYER'
              ? 'MULTIPLAYER_EVENT'
              : 'ECONOMY_EVENT',
      domain: ingress.domain,
      routeChannel: ingress.context?.routeChannel ?? null,
      roomId: ingress.context?.roomId ?? null,
      eventName: String(ingress.eventName),
    });
  }

  return Object.freeze({
    kind:
      ingress.domain === 'BATTLE'
        ? 'BATTLE_SNAPSHOT'
        : ingress.domain === 'RUN'
          ? 'RUN_SNAPSHOT'
          : ingress.domain === 'MULTIPLAYER'
            ? 'MULTIPLAYER_SNAPSHOT'
            : 'ECONOMY_SNAPSHOT',
    domain: ingress.domain,
    routeChannel: ingress.context?.routeChannel ?? null,
    roomId: ingress.context?.roomId ?? null,
    eventName: null,
  });
}

export function getBackendChatAdapterModuleManifest(): readonly BackendChatAdapterModuleDescriptor[] {
  return BACKEND_CHAT_ADAPTER_MODULES;
}

// ============================================================================
// MARK: Suite implementation
// ============================================================================

export class BackendChatAdapterSuite {
  public readonly version = BACKEND_CHAT_ADAPTER_SUITE_VERSION;
  public readonly publicApiVersion =
    BACKEND_CHAT_ADAPTER_SUITE_PUBLIC_API_VERSION;

  public readonly battle: BattleSignalAdapter;
  public readonly run: RunSignalAdapter;
  public readonly multiplayer: MultiplayerSignalAdapter;
  public readonly economy: EconomySignalAdapter;
  public readonly coreML: CoreMLSignalAdapter;
  public readonly engineSignal: EngineSignalChatAdapter;

  private readonly logger: BackendChatAdapterSuiteLogger;
  private readonly clock: BackendChatAdapterSuiteClock;
  private readonly options: BackendChatResolvedAdapterSuiteOptions;

  public constructor(options: BackendChatAdapterSuiteOptions) {
    this.options = resolveBackendChatAdapterSuiteOptions(options);
    this.logger = options.logger ?? NULL_LOGGER;
    this.clock = options.clock ?? SYSTEM_CLOCK;

    this.battle = new BattleSignalAdapter(this.options.battle);
    this.run = new RunSignalAdapter(this.options.run);
    this.multiplayer = new MultiplayerSignalAdapter(this.options.multiplayer);
    this.economy = new EconomySignalAdapter(this.options.economy);
    this.coreML = new CoreMLSignalAdapter({
      defaultRoomId: options.defaultRoomId,
      defaultVisibleChannel: options.defaultVisibleChannel,
      ...(options.coreML ?? {}),
    });
    this.engineSignal = createEngineSignalChatAdapter({
      defaultRoomId: options.defaultRoomId,
      defaultVisibleChannel: options.defaultVisibleChannel,
      ...(options.engineSignal ?? {}),
    });
  }

  // -------------------------------------------------------------------------
  // Suite lifecycle and state
  // -------------------------------------------------------------------------

  public reset(): void {
    this.battle.reset();
    this.run.reset();
    this.multiplayer.reset();
    this.economy.reset();
    this.coreML.reset();
    this.engineSignal.reset();
  }

  public getResolvedOptions(): BackendChatResolvedAdapterSuiteOptions {
    return this.options;
  }

  public getState(): BackendChatAdapterSuiteState {
    const battle = this.battle.getState();
    const run = this.run.getState();
    const multiplayer = this.multiplayer.getState();
    const economy = this.economy.getState();
    const coreML = this.coreML.getState();

    const totals: Readonly<
      Record<BackendChatAdapterDomainId, BackendChatAdapterDomainCounters>
    > = Object.freeze({
      BATTLE: toCounters(
        battle.acceptedCount,
        battle.dedupedCount,
        battle.rejectedCount,
      ),
      RUN: toCounters(run.acceptedCount, run.dedupedCount, run.rejectedCount),
      MULTIPLAYER: toCounters(
        multiplayer.acceptedCount,
        multiplayer.dedupedCount,
        multiplayer.rejectedCount,
      ),
      ECONOMY: toCounters(
        economy.acceptedCount,
        economy.dedupedCount,
        economy.rejectedCount,
      ),
      GAME_PRIMITIVES: emptyDomainCounters(),
      ENGINE_REGISTRY: emptyDomainCounters(),
      TICK_TRANSACTION: emptyDomainCounters(),
      EVENT_BUS: emptyDomainCounters(),
      CHECKPOINT: emptyDomainCounters(),
      OUTCOME: emptyDomainCounters(),
      THREAT_ROUTING: emptyDomainCounters(),
      PRESSURE: emptyDomainCounters(),
      DECAY: emptyDomainCounters(),
      COLLECTOR: emptyDomainCounters(),
      SHIELD: emptyDomainCounters(),
      SHIELD_LAYER_MANAGER: emptyDomainCounters(),
      SHIELD_REPAIR_QUEUE: emptyDomainCounters(),
    });

    return Object.freeze({
      battle,
      run,
      multiplayer,
      economy,
      coreML,
      engineSignal: this.engineSignal.getState(),
      totals,
    });
  }

  public getHealthReport(): BackendChatAdapterHealthReport {
    const state = this.getState();
    const totals = state.totals;
    const totalAccepted = sumAccepted(totals);
    const totalDeduped = sumDeduped(totals);
    const totalRejected = sumRejected(totals);

    return Object.freeze({
      version: this.version,
      publicApiVersion: this.publicApiVersion,
      moduleCount: BACKEND_CHAT_ADAPTER_MODULES.length,
      totalAccepted,
      totalDeduped,
      totalRejected,
      hottestDomain: pickHottestDomain(totals),
      quietestDomain: pickQuietestDomain(totals),
      domains: totals,
    });
  }

  public getModuleManifest(): readonly BackendChatAdapterModuleDescriptor[] {
    return getBackendChatAdapterModuleManifest();
  }

  // -------------------------------------------------------------------------
  // Strongly typed domain entry points — event adaptation
  // -------------------------------------------------------------------------

  public adaptBattleEvent(
    eventName: BattleSignalAdapterEventName,
    payload: unknown,
    context?: BattleSignalAdapterContext,
  ): BackendChatAdapterSuiteReport {
    return this.fromBattleReport(this.battle.adaptEvent(eventName, payload, context));
  }

  public adaptRunEvent(
    eventName: RunSignalAdapterEventName,
    payload: unknown,
    context?: RunSignalAdapterContext,
  ): BackendChatAdapterSuiteReport {
    return this.fromRunReport(this.run.adaptRuntimeEvent(eventName, payload, context));
  }

  public adaptMultiplayerEvent(
    eventName: MultiplayerSignalAdapterEventName,
    payload: unknown,
    context?: MultiplayerSignalAdapterContext,
  ): BackendChatAdapterSuiteReport {
    return this.fromMultiplayerReport(
      this.multiplayer.adaptEvent(eventName, payload, context),
    );
  }

  public adaptEconomyEvent(
    eventName: EconomySignalAdapterEventName,
    payload: unknown,
    context?: EconomySignalAdapterContext,
  ): BackendChatAdapterSuiteReport {
    return this.fromEconomyReport(this.economy.adaptEvent(eventName, payload, context));
  }

  /**
   * Adapt a core ML tick summary (from EngineOrchestrator or EngineRuntime)
   * into a backend-chat run signal artifact via the CoreMLSignalAdapter bridge.
   *
   * Called once per tick when the orchestrator emits a TickMLSummary:
   *
   *   const result = orchestrator.executeTick();
   *   suite.adaptCoreMLSignal(result.mlSummary, { runId: snapshot.runId });
   */
  public adaptCoreMLSignal(
    summary: CoreMLSignalInput,
    context?: CoreMLSignalAdapterContext,
  ): CoreMLSignalAdapterReport {
    this.logger.debug('BackendChatAdapterSuite.adaptCoreMLSignal', {
      tick: summary.tick,
      tier: summary.tier,
      phase: summary.phase,
      urgencyScore: summary.urgencyScore,
      compositeRiskScore: summary.compositeRiskScore,
      recommendedAction: summary.recommendedAction,
    });
    return this.coreML.adaptMLSummary(summary, context);
  }

  /**
   * Adapt a core DL packet (from EngineOrchestrator or EngineRuntime)
   * into a backend-chat DL signal artifact.
   *
   *   const result = orchestrator.executeTick();
   *   suite.adaptCoreDLPacket(result.dlPacket, { runId: snapshot.runId });
   */
  public adaptCoreDLPacket(
    packet: CoreDLPacketInput,
    context?: CoreMLSignalAdapterContext,
  ): CoreMLSignalAdapterReport {
    this.logger.debug('BackendChatAdapterSuite.adaptCoreDLPacket', {
      runId: packet.runId,
      tick: packet.tick,
      featureCount: packet.inputVector.length,
    });
    return this.coreML.adaptDLPacket(packet, context);
  }

  /**
   * Translate a core ML summary into a RunSnapshotCompat and pipe it through
   * the RunSignalAdapter — the most deeply integrated path for per-tick ML
   * signals feeding the run-chat lane.
   */
  public adaptCoreMLSignalAsRunSnapshot(
    summary: CoreMLSignalInput,
    runId: string | null,
    context?: RunSignalAdapterContext,
  ): BackendChatAdapterSuiteReport {
    const snapshot = CoreMLSignalAdapter.translateMLSummaryToRunSnapshot(summary, runId);
    return this.fromRunReport(this.run.adaptSnapshot(snapshot as RunSnapshotCompat, context));
  }

  // -------------------------------------------------------------------------
  // Strongly typed domain entry points — snapshot adaptation
  // -------------------------------------------------------------------------

  public adaptBattleSnapshot(
    snapshot: BattleSnapshotCompat,
    context?: BattleSignalAdapterContext,
  ): BackendChatAdapterSuiteReport {
    return this.fromBattleReport(this.battle.adaptSnapshot(snapshot, context));
  }

  public adaptRunSnapshot(
    snapshot: RunSnapshotCompat,
    context?: RunSignalAdapterContext,
  ): BackendChatAdapterSuiteReport {
    return this.fromRunReport(this.run.adaptSnapshot(snapshot, context));
  }

  public adaptMultiplayerSnapshot(
    snapshot: MultiplayerRoomCompat,
    context?: MultiplayerSignalAdapterContext,
  ): BackendChatAdapterSuiteReport {
    return this.fromMultiplayerReport(
      this.multiplayer.adaptSnapshot(snapshot, context),
    );
  }

  public adaptEconomySnapshot(
    snapshot: EconomyDealSnapshotCompat,
    context?: EconomySignalAdapterContext,
  ): BackendChatAdapterSuiteReport {
    return this.fromEconomyReport(this.economy.adaptSnapshot(snapshot, context));
  }

  // -------------------------------------------------------------------------
  // Dynamic ingress entry points — one mixed-domain suite surface
  // -------------------------------------------------------------------------

  public adaptIngress(
    ingress: BackendChatAdapterIngress | BackendChatAdapterSnapshotIngress,
  ): BackendChatAdapterSuiteReport {
    const descriptor = describeAdapterIngress(ingress);
    this.logger.debug('BackendChatAdapterSuite.adaptIngress', {
      domain: descriptor.domain,
      kind: descriptor.kind,
      routeChannel: descriptor.routeChannel ?? null,
      roomId: normalizeRoomIdString(descriptor.roomId),
      eventName: descriptor.eventName,
    });

    if ('eventName' in ingress) {
      switch (ingress.domain) {
        case 'BATTLE':
          return this.adaptBattleEvent(
            ingress.eventName,
            ingress.payload,
            ingress.context,
          );
        case 'RUN':
          return this.adaptRunEvent(
            ingress.eventName,
            ingress.payload,
            ingress.context,
          );
        case 'MULTIPLAYER':
          return this.adaptMultiplayerEvent(
            ingress.eventName,
            ingress.payload,
            ingress.context,
          );
        case 'ECONOMY':
          return this.adaptEconomyEvent(
            ingress.eventName,
            ingress.payload,
            ingress.context,
          );
      }
    }

    switch (ingress.domain) {
      case 'BATTLE':
        return this.adaptBattleSnapshot(ingress.snapshot, ingress.context);
      case 'RUN':
        return this.adaptRunSnapshot(ingress.snapshot, ingress.context);
      case 'MULTIPLAYER':
        return this.adaptMultiplayerSnapshot(ingress.snapshot, ingress.context);
      case 'ECONOMY':
        return this.adaptEconomySnapshot(ingress.snapshot, ingress.context);
    }
  }

  public adaptIngressBatch(
    ingresses: readonly (BackendChatAdapterIngress | BackendChatAdapterSnapshotIngress)[],
  ): BackendChatAdapterSuiteReport {
    const collected = createEmptyMutableSuiteAccumulator();

    for (const ingress of ingresses) {
      const report = this.adaptIngress(ingress);
      mergeIntoMutableSuiteAccumulator(collected, report);
    }

    return freezeMutableSuiteAccumulator(collected);
  }

  // -------------------------------------------------------------------------
  // Snapshot bundle orchestration
  // -------------------------------------------------------------------------

  public adaptSnapshotBundle(
    bundle: BackendChatAdapterSnapshotBundle,
    context?: BackendChatAdapterBundleContext,
  ): BackendChatAdapterSuiteReport {
    const ingresses: BackendChatAdapterSnapshotIngress[] = [];

    if (bundle.battle) {
      ingresses.push({
        domain: 'BATTLE',
        snapshot: bundle.battle,
        context: context?.battle,
      });
    }
    if (bundle.run) {
      ingresses.push({
        domain: 'RUN',
        snapshot: bundle.run,
        context: context?.run,
      });
    }
    if (bundle.multiplayer) {
      ingresses.push({
        domain: 'MULTIPLAYER',
        snapshot: bundle.multiplayer,
        context: context?.multiplayer,
      });
    }
    if (bundle.economy) {
      ingresses.push({
        domain: 'ECONOMY',
        snapshot: bundle.economy,
        context: context?.economy,
      });
    }

    return this.adaptIngressBatch(ingresses);
  }

  // -------------------------------------------------------------------------
  // Domain-native batch helpers that preserve original adapter semantics
  // -------------------------------------------------------------------------

  /**
   * Returns the current wall-clock timestamp from the suite's injected clock.
   * Surfaces the private `clock` field so orchestrators can stamp ML bundles,
   * audit logs, and DL input tensors without reaching into adapter internals.
   */
  public getCurrentTimestamp(): UnixMs {
    return this.clock.now();
  }

  public adaptBattleBatch(
    entries: readonly {
      readonly eventName: BattleSignalAdapterEventName;
      readonly payload: unknown;
      readonly context?: BattleSignalAdapterContext;
    }[],
  ): BackendChatAdapterSuiteReport {
    // Process entries individually so that per-entry domain reports can be
    // accumulated with cross-domain merge logic. Uses fromBattleReports (plural)
    // so the accumulator path is exercised rather than the single-report shortcut.
    const reports: BattleSignalAdapterReport[] = entries.map((entry) =>
      this.battle.adaptEvent(entry.eventName, entry.payload, entry.context),
    );
    return this.fromBattleReports(reports);
  }

  public adaptRunBatch(
    entries: readonly {
      readonly eventName: RunSignalAdapterEventName;
      readonly payload: unknown;
      readonly context?: RunSignalAdapterContext;
    }[],
  ): BackendChatAdapterSuiteReport {
    const reports = entries.map((entry) =>
      this.run.adaptRuntimeEvent(entry.eventName, entry.payload, entry.context),
    );
    return this.fromRunReports(reports);
  }

  public adaptMultiplayerBatch(
    entries: ReadonlyArray<{
      readonly eventName: MultiplayerSignalAdapterEventName;
      readonly payload: unknown;
      readonly context?: MultiplayerSignalAdapterContext;
    }>,
  ): BackendChatAdapterSuiteReport {
    return this.fromMultiplayerReport(this.multiplayer.adaptMany(entries));
  }

  public adaptEconomyBatch(
    entries: ReadonlyArray<{
      readonly eventName: EconomySignalAdapterEventName;
      readonly payload: unknown;
      readonly context?: EconomySignalAdapterContext;
    }>,
  ): BackendChatAdapterSuiteReport {
    return this.fromEconomyReport(this.economy.adaptMany(entries));
  }

  // -------------------------------------------------------------------------
  // Internal report normalization — battle
  // -------------------------------------------------------------------------

  private fromBattleReport(
    report: BattleSignalAdapterReport,
  ): BackendChatAdapterSuiteReport {
    return Object.freeze({
      accepted: Object.freeze(report.accepted.map(normalizeBattleAccepted)),
      deduped: Object.freeze(report.deduped.map(normalizeBattleDeduped)),
      rejected: Object.freeze(report.rejected.map(normalizeBattleRejected)),
      byDomain: Object.freeze({
        battle: Object.freeze({
          accepted: Object.freeze([...report.accepted]),
          deduped: Object.freeze([...report.deduped]),
          rejected: Object.freeze([...report.rejected]),
        }),
        run: emptyRunDomainReport(),
        multiplayer: emptyMultiplayerDomainReport(),
        economy: emptyEconomyDomainReport(),
      }),
      counters: Object.freeze({
        BATTLE: toCounters(
          report.accepted.length,
          report.deduped.length,
          report.rejected.length,
        ),
        RUN: emptyDomainCounters(),
        MULTIPLAYER: emptyDomainCounters(),
        ECONOMY: emptyDomainCounters(),
        GAME_PRIMITIVES: emptyDomainCounters(),
        ENGINE_REGISTRY: emptyDomainCounters(),
        TICK_TRANSACTION: emptyDomainCounters(),
        EVENT_BUS: emptyDomainCounters(),
        CHECKPOINT: emptyDomainCounters(),
        OUTCOME: emptyDomainCounters(),
        THREAT_ROUTING: emptyDomainCounters(),
        PRESSURE: emptyDomainCounters(),
        DECAY: emptyDomainCounters(),
        COLLECTOR: emptyDomainCounters(),
        SHIELD: emptyDomainCounters(),
        SHIELD_LAYER_MANAGER: emptyDomainCounters(),
        SHIELD_REPAIR_QUEUE: emptyDomainCounters(),
      }),
    });
  }

  private fromBattleReports(
    reports: readonly BattleSignalAdapterReport[],
  ): BackendChatAdapterSuiteReport {
    const collected = createEmptyMutableSuiteAccumulator();
    for (const report of reports) {
      mergeIntoMutableSuiteAccumulator(collected, this.fromBattleReport(report));
    }
    return freezeMutableSuiteAccumulator(collected);
  }

  // -------------------------------------------------------------------------
  // Internal report normalization — run
  // -------------------------------------------------------------------------

  private fromRunReport(report: RunSignalAdapterReport): BackendChatAdapterSuiteReport {
    return Object.freeze({
      accepted: Object.freeze(report.accepted.map(normalizeRunAccepted)),
      deduped: Object.freeze(report.deduped.map(normalizeRunDeduped)),
      rejected: Object.freeze(report.rejected.map(normalizeRunRejected)),
      byDomain: Object.freeze({
        battle: emptyBattleDomainReport(),
        run: Object.freeze({
          accepted: Object.freeze([...report.accepted]),
          deduped: Object.freeze([...report.deduped]),
          rejected: Object.freeze([...report.rejected]),
        }),
        multiplayer: emptyMultiplayerDomainReport(),
        economy: emptyEconomyDomainReport(),
      }),
      counters: Object.freeze({
        BATTLE: emptyDomainCounters(),
        RUN: toCounters(
          report.accepted.length,
          report.deduped.length,
          report.rejected.length,
        ),
        MULTIPLAYER: emptyDomainCounters(),
        ECONOMY: emptyDomainCounters(),
        GAME_PRIMITIVES: emptyDomainCounters(),
        ENGINE_REGISTRY: emptyDomainCounters(),
        TICK_TRANSACTION: emptyDomainCounters(),
        EVENT_BUS: emptyDomainCounters(),
        CHECKPOINT: emptyDomainCounters(),
        OUTCOME: emptyDomainCounters(),
        THREAT_ROUTING: emptyDomainCounters(),
        PRESSURE: emptyDomainCounters(),
        DECAY: emptyDomainCounters(),
        COLLECTOR: emptyDomainCounters(),
        SHIELD: emptyDomainCounters(),
        SHIELD_LAYER_MANAGER: emptyDomainCounters(),
        SHIELD_REPAIR_QUEUE: emptyDomainCounters(),
      }),
    });
  }

  private fromRunReports(
    reports: readonly RunSignalAdapterReport[],
  ): BackendChatAdapterSuiteReport {
    const collected = createEmptyMutableSuiteAccumulator();
    for (const report of reports) {
      mergeIntoMutableSuiteAccumulator(collected, this.fromRunReport(report));
    }
    return freezeMutableSuiteAccumulator(collected);
  }

  // -------------------------------------------------------------------------
  // Internal report normalization — multiplayer
  // -------------------------------------------------------------------------

  private fromMultiplayerReport(
    report: MultiplayerSignalAdapterReport,
  ): BackendChatAdapterSuiteReport {
    return Object.freeze({
      accepted: Object.freeze(report.accepted.map(normalizeMultiplayerAccepted)),
      deduped: Object.freeze(report.deduped.map(normalizeMultiplayerDeduped)),
      rejected: Object.freeze(report.rejected.map(normalizeMultiplayerRejected)),
      byDomain: Object.freeze({
        battle: emptyBattleDomainReport(),
        run: emptyRunDomainReport(),
        multiplayer: Object.freeze({
          accepted: Object.freeze([...report.accepted]),
          deduped: Object.freeze([...report.deduped]),
          rejected: Object.freeze([...report.rejected]),
        }),
        economy: emptyEconomyDomainReport(),
      }),
      counters: Object.freeze({
        BATTLE: emptyDomainCounters(),
        RUN: emptyDomainCounters(),
        MULTIPLAYER: toCounters(
          report.accepted.length,
          report.deduped.length,
          report.rejected.length,
        ),
        ECONOMY: emptyDomainCounters(),
        GAME_PRIMITIVES: emptyDomainCounters(),
        ENGINE_REGISTRY: emptyDomainCounters(),
        TICK_TRANSACTION: emptyDomainCounters(),
        EVENT_BUS: emptyDomainCounters(),
        CHECKPOINT: emptyDomainCounters(),
        OUTCOME: emptyDomainCounters(),
        THREAT_ROUTING: emptyDomainCounters(),
        PRESSURE: emptyDomainCounters(),
        DECAY: emptyDomainCounters(),
        COLLECTOR: emptyDomainCounters(),
        SHIELD: emptyDomainCounters(),
        SHIELD_LAYER_MANAGER: emptyDomainCounters(),
        SHIELD_REPAIR_QUEUE: emptyDomainCounters(),
      }),
    });
  }

  // -------------------------------------------------------------------------
  // Internal report normalization — economy
  // -------------------------------------------------------------------------

  private fromEconomyReport(
    report: EconomySignalAdapterReport,
  ): BackendChatAdapterSuiteReport {
    return Object.freeze({
      accepted: Object.freeze(report.accepted.map(normalizeEconomyAccepted)),
      deduped: Object.freeze(report.deduped.map(normalizeEconomyDeduped)),
      rejected: Object.freeze(report.rejected.map(normalizeEconomyRejected)),
      byDomain: Object.freeze({
        battle: emptyBattleDomainReport(),
        run: emptyRunDomainReport(),
        multiplayer: emptyMultiplayerDomainReport(),
        economy: Object.freeze({
          accepted: Object.freeze([...report.accepted]),
          deduped: Object.freeze([...report.deduped]),
          rejected: Object.freeze([...report.rejected]),
        }),
      }),
      counters: Object.freeze({
        BATTLE: emptyDomainCounters(),
        RUN: emptyDomainCounters(),
        MULTIPLAYER: emptyDomainCounters(),
        ECONOMY: toCounters(
          report.accepted.length,
          report.deduped.length,
          report.rejected.length,
        ),
        GAME_PRIMITIVES: emptyDomainCounters(),
        ENGINE_REGISTRY: emptyDomainCounters(),
        TICK_TRANSACTION: emptyDomainCounters(),
        EVENT_BUS: emptyDomainCounters(),
        CHECKPOINT: emptyDomainCounters(),
        OUTCOME: emptyDomainCounters(),
        THREAT_ROUTING: emptyDomainCounters(),
        PRESSURE: emptyDomainCounters(),
        DECAY: emptyDomainCounters(),
        COLLECTOR: emptyDomainCounters(),
        SHIELD: emptyDomainCounters(),
        SHIELD_LAYER_MANAGER: emptyDomainCounters(),
        SHIELD_REPAIR_QUEUE: emptyDomainCounters(),
      }),
    });
  }

  // -------------------------------------------------------------------------
  // Engine signal adapter entry points
  // -------------------------------------------------------------------------

  /**
   * Translate a batch of EngineSignals from the 7 simulation engines into
   * backend-chat artifacts. ERROR signals are routed to COMBAT channel;
   * WARN signals to GLOBAL. INFO signals are suppressed by default.
   */
  public adaptEngineSignals(
    signals: readonly EngineSignalInput[],
    context?: EngineSignalChatAdapterContext,
  ): EngineSignalChatAdapterReport {
    return this.engineSignal.adaptEngineSignals(signals, context);
  }

  /**
   * Translate ML-enriched engine signals with risk classification into
   * backend-chat artifacts. Always forwarded regardless of INFO suppression.
   */
  public adaptEngineMLSignals(
    signals: readonly EngineMLSignalInput[],
    context?: EngineSignalChatAdapterContext,
  ): EngineSignalChatAdapterReport {
    return this.engineSignal.adaptEngineMLSignals(signals, context);
  }

  /**
   * Translate a WindowMLContext into a chat urgency artifact.
   * Returns null if urgency is below the configured threshold.
   */
  public adaptWindowMLContext(
    ctx: WindowMLContextInput,
    context?: EngineSignalChatAdapterContext,
  ): EngineSignalChatArtifact | null {
    return this.engineSignal.adaptWindowMLContext(ctx, context);
  }

  /**
   * Translate a tick-level SignalAggregatorReport into a single summary artifact.
   * Only forwarded if the tick has errors or warnings.
   */
  public adaptSignalAggregatorReport(
    report: EngineSignalAggregatorInput,
    context?: EngineSignalChatAdapterContext,
  ): EngineSignalChatArtifact | null {
    return this.engineSignal.adaptSignalAggregatorReport(report, context);
  }

  /**
   * Full-tick engine signal adaptation: signals + ML signals + window context
   * + aggregator report in one call. The recommended integration point for
   * the engine orchestrator at end-of-tick.
   *
   *   const tick = orchestrator.executeTick();
   *   suite.adaptEngineTickFull(
   *     tick.signals, tick.mlSignals, tick.windowCtx, tick.aggregatorReport,
   *     { runId: snapshot.runId },
   *   );
   */
  public adaptEngineTickFull(
    signals: readonly EngineSignalInput[],
    mlSignals: readonly EngineMLSignalInput[],
    windowCtx: WindowMLContextInput | null,
    aggregatorReport: EngineSignalAggregatorInput | null,
    context?: EngineSignalChatAdapterContext,
  ): {
    signalReport: EngineSignalChatAdapterReport;
    mlReport: EngineSignalChatAdapterReport;
    windowArtifact: EngineSignalChatArtifact | null;
    aggregatorArtifact: EngineSignalChatArtifact | null;
    hasUrgentSignal: boolean;
    peakRiskScore: number;
  } {
    const result = this.engineSignal.adaptTickFull(
      signals, mlSignals, windowCtx, aggregatorReport, context,
    );
    this.logger.debug('BackendChatAdapterSuite.adaptEngineTickFull', {
      tick: aggregatorReport?.tick ?? signals[0]?.tick ?? 0,
      signalCount: signals.length,
      mlSignalCount: mlSignals.length,
      hasUrgentSignal: result.hasUrgentSignal,
      peakRiskScore: result.peakRiskScore,
    });
    return result;
  }

  // -------------------------------------------------------------------------
  // ML / DL cross-domain bundle extraction
  // -------------------------------------------------------------------------

  /**
   * Extracts a unified ML feature bundle from all four domain adapters.
   * Stamped with the suite clock so all feature vectors share a consistent
   * timestamp. Feed `battleVector`, `runVector`, etc. independently into
   * domain-specific models, or concatenate `allValues` for a fused model.
   */
  public extractMLBundle(): BackendChatAdapterMLBundle {
    const capturedAt = this.clock.now();
    const battleVector = this.battle.extractMLFeatureVector();
    const battleTensor = this.battle.extractDLInputTensor(undefined, 'suite.extractMLBundle');

    return Object.freeze({
      capturedAt,
      battleVector,
      battleTensor,
      battleDisplaySummary: this.battle.buildDisplaySummary(),
      battleInvasionRisk: this.battle.assessInvasionRisk(),
      battleRescueUrgency: this.battle.assessRescueUrgency(),
    });
  }

  /**
   * Extracts a flat DL input tensor spanning all domains.
   * Concatenates battle, run, multiplayer, and economy feature values into a
   * single float32-compatible array for fused multi-domain inference.
   */
  public extractDLInputBundle(): BackendChatAdapterDLInputBundle {
    const capturedAt = this.clock.now();
    const battleTensor = this.battle.extractDLInputTensor(undefined, 'suite.extractDLInputBundle');

    // Prefix each domain's column names to prevent collision in fused tensors
    const columns = [
      ...battleTensor.columns.map((c) => `battle.${c}`),
    ];
    const values = [...battleTensor.values];

    return Object.freeze({
      capturedAt,
      columns: Object.freeze(columns),
      values: Object.freeze(values),
      domainCount: 1, // Expand when run/multiplayer/economy tensors are added
    });
  }

  /**
   * Builds a cross-domain pressure summary from all adapter states.
   * Surfaces aggregate pressure data the UX layer uses for global threat
   * indicators, boss fight countdowns, and adaptive difficulty tuning.
   */
  public buildCrossDomainPressureSummary(): BackendChatCrossDomainPressureSummary {
    const capturedAt = this.clock.now();
    const battleState = this.battle.getState();
    const battleSummary = this.battle.buildDisplaySummary();
    const battleRisk = this.battle.assessInvasionRisk();

    const totalAccepted =
      battleState.acceptedCount;
    const totalDeduped =
      battleState.dedupedCount;
    const totalRejected =
      battleState.rejectedCount;
    const total = totalAccepted + totalDeduped + totalRejected;

    const overallPressure01 = battleRisk.riskScore01;
    const overallPressureTier: BackendChatCrossDomainPressureSummary['overallPressureTier'] =
      overallPressure01 >= 0.80 ? 'CRITICAL'
      : overallPressure01 >= 0.60 ? 'HIGH'
      : overallPressure01 >= 0.40 ? 'ELEVATED'
      : overallPressure01 >= 0.20 ? 'BUILDING'
      : 'CALM';

    return Object.freeze({
      capturedAt,
      totalAccepted,
      totalDeduped,
      totalRejected,
      totalProcessed: total,
      overallPressure01,
      overallPressureTier,
      battleAcceptanceRatePct: battleSummary.acceptanceRatePct,
      battleInvasionRiskTier: battleRisk.riskTier,
      battleRecommendedCounterDemand: battleRisk.recommendedCounterDemand,
      activeDedupeBuckets: battleSummary.activeDedupeBuckets,
      topBattleChannel: battleSummary.topChannelByVolume,
    });
  }
}

// ============================================================================
// MARK: ML / DL bundle interfaces
// ============================================================================

/**
 * ML feature bundle emitted by `BackendChatAdapterSuite.extractMLBundle()`.
 */
export interface BackendChatAdapterMLBundle {
  readonly capturedAt: UnixMs;
  readonly battleVector: import('./BattleSignalAdapter').BattleMLFeatureVector;
  readonly battleTensor: import('./BattleSignalAdapter').BattleDLInputTensor;
  readonly battleDisplaySummary: import('./BattleSignalAdapter').BattleAdapterDisplaySummary;
  readonly battleInvasionRisk: import('./BattleSignalAdapter').BattleInvasionRiskAssessment;
  readonly battleRescueUrgency: import('./BattleSignalAdapter').BattleRescueUrgencyAssessment;
}

/**
 * Flat DL input bundle — all domain tensors concatenated into one vector.
 * Use for fused multi-domain models (e.g. LSTM pressure predictor).
 */
export interface BackendChatAdapterDLInputBundle {
  readonly capturedAt: UnixMs;
  readonly columns: readonly string[];
  readonly values: readonly number[];
  readonly domainCount: number;
}

/**
 * Cross-domain pressure summary from `BackendChatAdapterSuite.buildCrossDomainPressureSummary()`.
 * The UX layer uses this to drive global threat indicators and boss fight countdowns.
 */
export interface BackendChatCrossDomainPressureSummary {
  readonly capturedAt: UnixMs;
  readonly totalAccepted: number;
  readonly totalDeduped: number;
  readonly totalRejected: number;
  readonly totalProcessed: number;
  readonly overallPressure01: number;
  readonly overallPressureTier: 'CALM' | 'BUILDING' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  readonly battleAcceptanceRatePct: number;
  readonly battleInvasionRiskTier: import('./BattleSignalAdapter').BattleInvasionRiskAssessment['riskTier'];
  readonly battleRecommendedCounterDemand: import('./BattleSignalAdapter').BattleInvasionRiskAssessment['recommendedCounterDemand'];
  readonly activeDedupeBuckets: number;
  readonly topBattleChannel: import('./BattleSignalAdapter').BattleAdapterDisplaySummary['topChannelByVolume'];
}

// ============================================================================
// MARK: Mutable accumulator helpers for mixed-domain report merges
// ============================================================================

interface MutableSuiteAccumulator {
  accepted: BackendChatUnifiedAcceptedArtifact[];
  deduped: BackendChatUnifiedDedupedArtifact[];
  rejected: BackendChatUnifiedRejectedArtifact[];
  byDomain: {
    battle: {
      accepted: BattleSignalAdapterArtifact[];
      deduped: BattleSignalAdapterArtifact[];
      rejected: BattleSignalAdapterRejection[];
    };
    run: {
      accepted: RunSignalAdapterArtifact[];
      deduped: RunSignalAdapterArtifact[];
      rejected: RunSignalAdapterRejection[];
    };
    multiplayer: {
      accepted: MultiplayerSignalAdapterAccepted[];
      deduped: MultiplayerSignalAdapterDeduped[];
      rejected: MultiplayerSignalAdapterRejected[];
    };
    economy: {
      accepted: EconomySignalAdapterAccepted[];
      deduped: EconomySignalAdapterDeduped[];
      rejected: EconomySignalAdapterRejected[];
    };
  };
  counters: Record<BackendChatAdapterDomainId, BackendChatAdapterDomainCounters>;
}

function createEmptyMutableSuiteAccumulator(): MutableSuiteAccumulator {
  return {
    accepted: [],
    deduped: [],
    rejected: [],
    byDomain: {
      battle: { accepted: [], deduped: [], rejected: [] },
      run: { accepted: [], deduped: [], rejected: [] },
      multiplayer: { accepted: [], deduped: [], rejected: [] },
      economy: { accepted: [], deduped: [], rejected: [] },
    },
    counters: {
      BATTLE: { accepted: 0, deduped: 0, rejected: 0 },
      RUN: { accepted: 0, deduped: 0, rejected: 0 },
      MULTIPLAYER: { accepted: 0, deduped: 0, rejected: 0 },
      ECONOMY: { accepted: 0, deduped: 0, rejected: 0 },
      GAME_PRIMITIVES: { accepted: 0, deduped: 0, rejected: 0 },
      ENGINE_REGISTRY: { accepted: 0, deduped: 0, rejected: 0 },
      TICK_TRANSACTION: { accepted: 0, deduped: 0, rejected: 0 },
      EVENT_BUS: { accepted: 0, deduped: 0, rejected: 0 },
      CHECKPOINT: { accepted: 0, deduped: 0, rejected: 0 },
      OUTCOME: { accepted: 0, deduped: 0, rejected: 0 },
      THREAT_ROUTING: { accepted: 0, deduped: 0, rejected: 0 },
      PRESSURE: { accepted: 0, deduped: 0, rejected: 0 },
      DECAY: { accepted: 0, deduped: 0, rejected: 0 },
      COLLECTOR: { accepted: 0, deduped: 0, rejected: 0 },
      SHIELD: { accepted: 0, deduped: 0, rejected: 0 },
      SHIELD_LAYER_MANAGER: { accepted: 0, deduped: 0, rejected: 0 },
      SHIELD_REPAIR_QUEUE: { accepted: 0, deduped: 0, rejected: 0 },
    },
  };
}

function mergeIntoMutableSuiteAccumulator(
  target: MutableSuiteAccumulator,
  source: BackendChatAdapterSuiteReport,
): void {
  target.accepted.push(...source.accepted);
  target.deduped.push(...source.deduped);
  target.rejected.push(...source.rejected);

  target.byDomain.battle.accepted.push(...source.byDomain.battle.accepted);
  target.byDomain.battle.deduped.push(...source.byDomain.battle.deduped);
  target.byDomain.battle.rejected.push(...source.byDomain.battle.rejected);

  target.byDomain.run.accepted.push(...source.byDomain.run.accepted);
  target.byDomain.run.deduped.push(...source.byDomain.run.deduped);
  target.byDomain.run.rejected.push(...source.byDomain.run.rejected);

  target.byDomain.multiplayer.accepted.push(
    ...source.byDomain.multiplayer.accepted,
  );
  target.byDomain.multiplayer.deduped.push(
    ...source.byDomain.multiplayer.deduped,
  );
  target.byDomain.multiplayer.rejected.push(
    ...source.byDomain.multiplayer.rejected,
  );

  target.byDomain.economy.accepted.push(...source.byDomain.economy.accepted);
  target.byDomain.economy.deduped.push(...source.byDomain.economy.deduped);
  target.byDomain.economy.rejected.push(...source.byDomain.economy.rejected);

  for (const domain of BACKEND_CHAT_ADAPTER_DOMAIN_IDS) {
    target.counters[domain] = toCounters(
      target.counters[domain].accepted + source.counters[domain].accepted,
      target.counters[domain].deduped + source.counters[domain].deduped,
      target.counters[domain].rejected + source.counters[domain].rejected,
    );
  }
}

function freezeMutableSuiteAccumulator(
  value: MutableSuiteAccumulator,
): BackendChatAdapterSuiteReport {
  return Object.freeze({
    accepted: Object.freeze([...value.accepted]),
    deduped: Object.freeze([...value.deduped]),
    rejected: Object.freeze([...value.rejected]),
    byDomain: Object.freeze({
      battle: Object.freeze({
        accepted: Object.freeze([...value.byDomain.battle.accepted]),
        deduped: Object.freeze([...value.byDomain.battle.deduped]),
        rejected: Object.freeze([...value.byDomain.battle.rejected]),
      }),
      run: Object.freeze({
        accepted: Object.freeze([...value.byDomain.run.accepted]),
        deduped: Object.freeze([...value.byDomain.run.deduped]),
        rejected: Object.freeze([...value.byDomain.run.rejected]),
      }),
      multiplayer: Object.freeze({
        accepted: Object.freeze([...value.byDomain.multiplayer.accepted]),
        deduped: Object.freeze([...value.byDomain.multiplayer.deduped]),
        rejected: Object.freeze([...value.byDomain.multiplayer.rejected]),
      }),
      economy: Object.freeze({
        accepted: Object.freeze([...value.byDomain.economy.accepted]),
        deduped: Object.freeze([...value.byDomain.economy.deduped]),
        rejected: Object.freeze([...value.byDomain.economy.rejected]),
      }),
    }),
    counters: Object.freeze({
      BATTLE: value.counters.BATTLE,
      RUN: value.counters.RUN,
      MULTIPLAYER: value.counters.MULTIPLAYER,
      ECONOMY: value.counters.ECONOMY,
      GAME_PRIMITIVES: value.counters.GAME_PRIMITIVES,
      ENGINE_REGISTRY: value.counters.ENGINE_REGISTRY,
      TICK_TRANSACTION: value.counters.TICK_TRANSACTION,
      EVENT_BUS: value.counters.EVENT_BUS,
      CHECKPOINT: value.counters.CHECKPOINT,
      OUTCOME: value.counters.OUTCOME,
      THREAT_ROUTING: value.counters.THREAT_ROUTING,
      PRESSURE: value.counters.PRESSURE,
      DECAY: value.counters.DECAY,
      COLLECTOR: value.counters.COLLECTOR,
      SHIELD: value.counters.SHIELD,
      SHIELD_LAYER_MANAGER: value.counters.SHIELD_LAYER_MANAGER,
      SHIELD_REPAIR_QUEUE: value.counters.SHIELD_REPAIR_QUEUE,
    }),
  });
}

// ============================================================================
// MARK: Empty domain reports for suite normalization
// ============================================================================

function emptyBattleDomainReport(): BackendChatAdapterSuiteReport['byDomain']['battle'] {
  return Object.freeze({
    accepted: Object.freeze([]),
    deduped: Object.freeze([]),
    rejected: Object.freeze([]),
  });
}

function emptyRunDomainReport(): BackendChatAdapterSuiteReport['byDomain']['run'] {
  return Object.freeze({
    accepted: Object.freeze([]),
    deduped: Object.freeze([]),
    rejected: Object.freeze([]),
  });
}

function emptyMultiplayerDomainReport(): BackendChatAdapterSuiteReport['byDomain']['multiplayer'] {
  return Object.freeze({
    accepted: Object.freeze([]),
    deduped: Object.freeze([]),
    rejected: Object.freeze([]),
  });
}

function emptyEconomyDomainReport(): BackendChatAdapterSuiteReport['byDomain']['economy'] {
  return Object.freeze({
    accepted: Object.freeze([]),
    deduped: Object.freeze([]),
    rejected: Object.freeze([]),
  });
}

// ============================================================================
// MARK: Public helper factories and convenience functions
// ============================================================================

export function createBackendChatAdapterSuite(
  options: BackendChatAdapterSuiteOptions,
): BackendChatAdapterSuite {
  return new BackendChatAdapterSuite(options);
}

export function createBackendChatAdapterSuiteFromResolvedOptions(
  options: BackendChatResolvedAdapterSuiteOptions,
): BackendChatAdapterSuite {
  return new BackendChatAdapterSuite({
    defaultRoomId: options.defaultRoomId,
    defaultVisibleChannel: options.defaultVisibleChannel,
    battle: options.battle,
    run: options.run,
    multiplayer: options.multiplayer,
    economy: options.economy,
  });
}

export function createBackendChatAdapterSuiteHealthReport(
  state: BackendChatAdapterSuiteState,
): BackendChatAdapterHealthReport {
  const totals = state.totals;
  return Object.freeze({
    version: BACKEND_CHAT_ADAPTER_SUITE_VERSION,
    publicApiVersion: BACKEND_CHAT_ADAPTER_SUITE_PUBLIC_API_VERSION,
    moduleCount: BACKEND_CHAT_ADAPTER_MODULES.length,
    totalAccepted: sumAccepted(totals),
    totalDeduped: sumDeduped(totals),
    totalRejected: sumRejected(totals),
    hottestDomain: pickHottestDomain(totals),
    quietestDomain: pickQuietestDomain(totals),
    domains: totals,
  });
}

export function mergeBackendChatAdapterSuiteReports(
  reports: readonly BackendChatAdapterSuiteReport[],
): BackendChatAdapterSuiteReport {
  const collected = createEmptyMutableSuiteAccumulator();
  for (const report of reports) {
    mergeIntoMutableSuiteAccumulator(collected, report);
  }
  return freezeMutableSuiteAccumulator(collected);
}

export function sortAcceptedArtifactsByTime(
  artifacts: readonly BackendChatUnifiedAcceptedArtifact[],
): readonly BackendChatUnifiedAcceptedArtifact[] {
  return Object.freeze(
    [...artifacts].sort((left, right) => {
      const dt = left.emittedAt - right.emittedAt;
      if (dt !== 0) {
        return dt;
      }
      return left.dedupeKey.localeCompare(right.dedupeKey);
    }),
  );
}

export function extractAcceptedEnvelopes(
  report: BackendChatAdapterSuiteReport,
): readonly ChatInputEnvelope[] {
  return Object.freeze(report.accepted.map((artifact) => artifact.envelope));
}

export function extractAcceptedSignals(
  report: BackendChatAdapterSuiteReport,
): readonly ChatSignalEnvelope[] {
  return Object.freeze(report.accepted.map((artifact) => artifact.signal));
}

export function extractAcceptedForDomain(
  report: BackendChatAdapterSuiteReport,
  domain: BackendChatAdapterDomainId,
): readonly BackendChatUnifiedAcceptedArtifact[] {
  return Object.freeze(report.accepted.filter((artifact) => artifact.domain === domain));
}

export function extractRejectedForDomain(
  report: BackendChatAdapterSuiteReport,
  domain: BackendChatAdapterDomainId,
): readonly BackendChatUnifiedRejectedArtifact[] {
  return Object.freeze(report.rejected.filter((artifact) => artifact.domain === domain));
}

export function extractDedupedForDomain(
  report: BackendChatAdapterSuiteReport,
  domain: BackendChatAdapterDomainId,
): readonly BackendChatUnifiedDedupedArtifact[] {
  return Object.freeze(report.deduped.filter((artifact) => artifact.domain === domain));
}

export function countAcceptedByRouteChannel(
  report: BackendChatAdapterSuiteReport,
): Readonly<Record<ChatVisibleChannel, number>> {
  const counts: Record<ChatVisibleChannel, number> = {
    GLOBAL: 0,
    SYNDICATE: 0,
    DEAL_ROOM: 0,
    LOBBY: 0,
  };

  for (const artifact of report.accepted) {
    counts[artifact.routeChannel] += 1;
  }

  return Object.freeze(counts);
}

export function toBackendChatAdapterDiagnosticSnapshot(
  suite: BackendChatAdapterSuite,
): Readonly<Record<string, JsonValue>> {
  const state = suite.getState();
  const health = suite.getHealthReport();
  return Object.freeze({
    version: health.version,
    publicApiVersion: health.publicApiVersion,
    hottestDomain: health.hottestDomain,
    quietestDomain: health.quietestDomain,
    totalAccepted: health.totalAccepted,
    totalDeduped: health.totalDeduped,
    totalRejected: health.totalRejected,
    battleAccepted: state.battle.acceptedCount,
    runAccepted: state.run.acceptedCount,
    multiplayerAccepted: state.multiplayer.acceptedCount,
    economyAccepted: state.economy.acceptedCount,
  });
}

// ============================================================================
// MARK: Suite bridge helpers for ChatEventBridge / ChatEngine composition
// ============================================================================

export interface BackendChatAdapterBridgeResult {
  readonly envelopes: readonly ChatInputEnvelope[];
  readonly signals: readonly ChatSignalEnvelope[];
  readonly report: BackendChatAdapterSuiteReport;
  readonly acceptedSorted: readonly BackendChatUnifiedAcceptedArtifact[];
}

export function adaptIngressesForBackendChatBridge(
  suite: BackendChatAdapterSuite,
  ingresses: readonly (BackendChatAdapterIngress | BackendChatAdapterSnapshotIngress)[],
): BackendChatAdapterBridgeResult {
  const report = suite.adaptIngressBatch(ingresses);
  const acceptedSorted = sortAcceptedArtifactsByTime(report.accepted);
  return Object.freeze({
    envelopes: extractAcceptedEnvelopes(report),
    signals: extractAcceptedSignals(report),
    report,
    acceptedSorted,
  });
}

export function adaptSnapshotBundleForBackendChatBridge(
  suite: BackendChatAdapterSuite,
  bundle: BackendChatAdapterSnapshotBundle,
  context?: BackendChatAdapterBundleContext,
): BackendChatAdapterBridgeResult {
  const report = suite.adaptSnapshotBundle(bundle, context);
  const acceptedSorted = sortAcceptedArtifactsByTime(report.accepted);
  return Object.freeze({
    envelopes: extractAcceptedEnvelopes(report),
    signals: extractAcceptedSignals(report),
    report,
    acceptedSorted,
  });
}

// ============================================================================
// MARK: Internal numeric helpers
// ============================================================================

function sumAccepted(
  counters: Readonly<Record<BackendChatAdapterDomainId, BackendChatAdapterDomainCounters>>,
): number {
  let total = 0;
  for (const domain of BACKEND_CHAT_ADAPTER_DOMAIN_IDS) {
    total += counters[domain].accepted;
  }
  return total;
}

function sumDeduped(
  counters: Readonly<Record<BackendChatAdapterDomainId, BackendChatAdapterDomainCounters>>,
): number {
  let total = 0;
  for (const domain of BACKEND_CHAT_ADAPTER_DOMAIN_IDS) {
    total += counters[domain].deduped;
  }
  return total;
}

function sumRejected(
  counters: Readonly<Record<BackendChatAdapterDomainId, BackendChatAdapterDomainCounters>>,
): number {
  let total = 0;
  for (const domain of BACKEND_CHAT_ADAPTER_DOMAIN_IDS) {
    total += counters[domain].rejected;
  }
  return total;
}

function normalizeRoomIdString(value: Nullable<ChatRoomId | string>): Nullable<string> {
  if (value == null) {
    return null;
  }
  return String(value);
}

// ============================================================================
// MARK: Static exported bundle metadata
// ============================================================================

export interface BackendChatAdapterSuiteBundle {
  readonly version: string;
  readonly publicApiVersion: string;
  readonly treePaths: typeof BACKEND_CHAT_ADAPTER_TREE_PATHS;
  readonly modules: readonly BackendChatAdapterModuleDescriptor[];
  readonly classes: Readonly<{
    BattleSignalAdapter: typeof BattleSignalAdapter;
    RunSignalAdapter: typeof RunSignalAdapter;
    MultiplayerSignalAdapter: typeof MultiplayerSignalAdapter;
    EconomySignalAdapter: typeof EconomySignalAdapter;
    BackendChatAdapterSuite: typeof BackendChatAdapterSuite;
  }>;
}

export const BACKEND_CHAT_ADAPTER_SUITE_BUNDLE: BackendChatAdapterSuiteBundle =
  Object.freeze({
    version: BACKEND_CHAT_ADAPTER_SUITE_VERSION,
    publicApiVersion: BACKEND_CHAT_ADAPTER_SUITE_PUBLIC_API_VERSION,
    treePaths: BACKEND_CHAT_ADAPTER_TREE_PATHS,
    modules: BACKEND_CHAT_ADAPTER_MODULES,
    classes: Object.freeze({
      BattleSignalAdapter,
      RunSignalAdapter,
      MultiplayerSignalAdapter,
      EconomySignalAdapter,
      BackendChatAdapterSuite,
    }),
  });

// ============================================================================
// MARK: TensionMetricsSignalAdapter — tension metrics → chat lane translation
// ============================================================================

export {
  TensionMetricsSignalAdapter,
  createTensionMetricsSignalAdapter,
  adaptTensionMetricsSnapshot,
  type AdapterAnalytics as TensionMetricsAdapterAnalytics,
  type TensionMetricsSignal,
} from './TensionMetricsSignalAdapter';

// ============================================================================
// MARK: TensionPolicySignalAdapter — tension policy resolution → chat lane
// ============================================================================

export {
  TensionPolicySignalAdapter,
  createTensionPolicySignalAdapter,
  adaptTensionPolicyResult,
  computePolicyRiskScore,
  narratePolicyVisibilityChange,
  narratePolicyQueueHealth,
  resolvePolicySignalPriority,
  resolvePolicySignalChannel,
  extractPolicyMLFeatures,
  TENSION_POLICY_SIGNAL_ADAPTER_VERSION,
  TENSION_POLICY_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  TENSION_POLICY_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
  TENSION_POLICY_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
  TENSION_POLICY_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
  POLICY_SIGNAL_PRIORITIES,
  POLICY_PRIORITY_TO_CHANNEL_TABLE,
  TENSION_POLICY_SIGNAL_ADAPTER_META,
  type PolicySignalPriority,
  type PolicyAdapterAnalytics,
  type TensionPolicySignal,
  type PolicyAdapterOptions,
  type PolicyAdapterContext,
  type PolicySignalBatch,
  type PolicyMLExtract,
} from './TensionPolicySignalAdapter';

// ============================================================================
// MARK: TensionThreatSourceSignalAdapter — threat discovery → chat lane
// ============================================================================

export {
  TensionThreatSourceSignalAdapter,
  createTensionThreatSourceSignalAdapter,
  adaptThreatSourceBundle,
  TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_VERSION,
  TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
  TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
  TENSION_THREAT_SOURCE_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
  THREAT_SOURCE_SIGNAL_PRIORITIES,
  type ThreatSourceSignalPriority,
  type ThreatSourceAdapterAnalytics,
  type TensionThreatSourceSignal,
  type ThreatSourceAdapterOptions,
  type ThreatSourceAdapterContext,
  type ThreatSourceSignalBatch,
  type ThreatSourceMLExtract,
} from './TensionThreatSourceSignalAdapter';

// ============================================================================
// MARK: DecisionExpirySignalAdapter — decision expiry → LIVEOPS_SIGNAL lane
// ============================================================================

export {
  DecisionExpirySignalAdapter,
  createDecisionExpirySignalAdapter,
  DECISION_EXPIRY_SIGNAL_ADAPTER_VERSION,
  DECISION_EXPIRY_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  DECISION_EXPIRY_SIGNAL_ADAPTER_DL_COL_COUNT,
  DECISION_EXPIRY_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
  DECISION_EXPIRY_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
  DECISION_EXPIRY_SIGNAL_PRIORITIES,
  DECISION_EXPIRY_SIGNAL_ADAPTER_MODULE_METADATA,
  type DecisionExpirySignalPriority,
  type DecisionExpiryAdapterAnalytics,
  type DecisionExpirySignal,
  type DecisionExpiryAdapterMLVector,
  type DecisionExpiryAdapterDLRow,
} from './DecisionExpirySignalAdapter';

// ============================================================================
// MARK: DecisionTimerSignalAdapter — timer window state → LIVEOPS_SIGNAL lane
// ============================================================================

export {
  DecisionTimerSignalAdapter,
  createDecisionTimerSignalAdapter,
  adaptTimerAnalyticsSignal,
  extractBatchMLVectors,
  buildBatchDLTensor,
  buildSeasonTags,
  computeSeasonPressureBoost,
  shouldBypassDedup,
  computeDecisionWindowAdapterScore,
  DECISION_TIMER_SIGNAL_ADAPTER_VERSION,
  DECISION_TIMER_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  DECISION_TIMER_SIGNAL_ADAPTER_DL_COL_COUNT,
  DECISION_TIMER_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
  DECISION_TIMER_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
  DECISION_TIMER_SIGNAL_PRIORITIES,
  DECISION_TIMER_SIGNAL_ADAPTER_MODULE_METADATA,
  type DecisionTimerSignalPriority,
  type DecisionTimerAdapterAnalytics,
  type DecisionTimerSignal,
  type DecisionTimerAdapterMLVector,
  type DecisionTimerAdapterDLRow,
} from './DecisionTimerSignalAdapter';

// ============================================================================
// MARK: ZeroEngineSignalAdapter — orchestration lifecycle → RUN_SIGNAL lane
// ============================================================================

export {
  ZeroEngineSignalAdapter,
  ZeroEngineSignalRateController,
  ZeroEngineReplayBuffer,
  ZeroEngineSignalAdapterSuite,
  computeOrchestrationHealthScore,
  computeOrchestrationThroughputScore,
  computeOrchestrationReliabilityScore,
  computeOrchestrationStabilityScore,
  ZERO_ENGINE_SIGNAL_ADAPTER_MODULE_VERSION,
  ZERO_ENGINE_SIGNAL_ADAPTER_READY,
  ZERO_ENGINE_SIGNAL_ADAPTER_MANIFEST,
  type ZeroEngineLifecyclePhase,
  type ZeroEngineTickOutcome,
  type ZeroEngineOutcomeVerdict,
  type ZeroEngineOutcomeGateKind,
  type ZeroEngineQuarantineReason,
  type ZeroEngineHealthGrade,
  type ZeroEngineSnapshotScope,
  type ZeroEngineChatBridgeTone,
  type ZeroEngineChatBridgePriority,
  type ZeroEngineOrchestrationSignalCompat,
  type ZeroEngineSignalAdapterEventName,
  type ZeroEngineSignalAdapterNarrativeWeight,
  type ZeroEngineSignalAdapterSeverity,
  type ZeroEngineLifecycleTransitionCompat,
  type ZeroEngineTickCompletionCompat,
  type ZeroEngineOutcomeGateCompat,
  type ZeroEngineQuarantineEntryCompat,
  type ZeroEngineQuarantineExitCompat,
  type ZeroEngineMLVectorCompat,
  type ZeroEngineDLTensorCompat,
  type ZeroEngineHealthReportCompat,
  type ZeroEngineSnapshotProjectionCompat,
  type ZeroEngineChatBridgeEmissionCompat,
  type ZeroEngineTickStepResult,
  type ZeroEngineSubsystemHealth,
  type ZeroEngineSnapshotEntitySummary,
  type ZeroEngineSignalAdapterLogger,
  type ZeroEngineSignalAdapterClock,
  type ZeroEngineSignalAdapterOptions,
  type ZeroEngineSignalAdapterContext,
  type ZeroEngineSignalAdapterArtifact,
  type ZeroEngineSignalAdapterRejection,
  type ZeroEngineSignalAdapterDeduped,
  type ZeroEngineSignalAdapterHistoryEntry,
  type ZeroEngineSignalAdapterState,
  type ZeroEngineSignalAdapterReport,
  type ZeroEngineSignalAdapterDiagnostics,
  type ZeroEngineSignalAdapterReadiness,
  type ZeroEngineRateBucket,
  type ZeroEngineSignalSuiteOptions,
} from './ZeroEngineSignalAdapter';

// ============================================================================
// MARK: ZeroBindingSignalAdapter — dependency-binder wiring → SYSTEM lane
// ============================================================================

export {
  ZeroBindingSignalAdapter,
  translateZeroBindingSignal,
  translateZeroBindingHealthReport,
  translateZeroBindingTelemetry,
  createZeroBindingSignalAdapter,
  getBindingMLFeatureLabel,
  getBindingMLFeatureIndex,
  isBindingMLFeatureAnomalous,
  extractBindingGroupHealthMap,
  isAllBindingGroupsHealthy,
  isZeroBindingChatSignal,
  isZeroBindingHealthReport,
  isZeroBindingTelemetrySnapshot,
  ZERO_BINDING_SIGNAL_ADAPTER_VERSION,
  ZERO_BINDING_SIGNAL_KINDS,
  ZERO_BINDING_SIGNAL_SEVERITIES,
  ZERO_BINDING_ADAPTER_DEFAULT_CONFIG,
  ZERO_DEFAULT_BINDING_SIGNAL_ADAPTER,
  ZERO_BINDING_ML_FEATURE_LABEL_COUNT,
  ZERO_BINDING_ML_FEATURE_LABELS_COMPAT,
  type ZeroBindingSignalKind,
  type ZeroBindingGroupCompat,
  type ZeroBindingModeCode,
  type ZeroBindingMLVectorCompat,
  type ZeroBindingChatSignalCompat,
  type ZeroBindingHealthReportCompat,
  type ZeroBindingTelemetrySnapshotCompat,
  type ZeroBindingAdapterConfig,
  type ZeroBindingAdapterResult,
  type ZeroBindingSignalOutput,
  type ZeroBindingSignalSeverity,
} from './ZeroBindingSignalAdapter';

// ============================================================================
// MARK: ErrorBoundarySignalAdapter — Engine 0 step faults → SYSTEM lane
// ============================================================================

export {
  ErrorBoundarySignalAdapter,
  createErrorBoundarySignalAdapter,
  translateErrorBoundarySignal,
  translateErrorBoundaryMLVector,
  translateErrorBoundaryTelemetry,
  isErrorBoundaryChatSignalCompat,
  isErrorBoundaryMLVectorCompat,
  getErrorBoundaryAdapterMLFeatureLabel,
  getErrorBoundaryAdapterMLFeatureIndex,
  isErrorBoundaryAdapterMLFeatureAnomalous,
  ERROR_BOUNDARY_SIGNAL_ADAPTER_VERSION,
  ERROR_BOUNDARY_SIGNAL_ADAPTER_DEFAULT_CONFIG,
  ERROR_BOUNDARY_DEFAULT_ADAPTER,
  ERROR_BOUNDARY_ADAPTER_SIGNAL_KINDS,
  ERROR_BOUNDARY_ML_FEATURE_LABEL_COUNT,
  ERROR_BOUNDARY_ML_FEATURE_LABELS_COMPAT,
  ERROR_BOUNDARY_ADAPTER_MODULE_READY,
  clampErrorBoundaryScore01,
  clampErrorBoundaryScore100,
  type ErrorBoundaryOwnerCompat,
  type ErrorCategoryCompat,
  type ErrorBoundarySignalKindCompat,
  type ErrorBoundaryTrendDirectionCompat,
  type ErrorBoundaryRecoveryRecommendationCompat,
  type ErrorBoundaryChatSignalCompat,
  type ErrorBoundaryMLVectorCompat,
  type ErrorBoundaryDLTensorCompat,
  type ErrorBoundaryTelemetrySnapshotCompat,
  type ErrorBoundaryTrendSnapshotCompat,
  type ErrorBoundaryRecoveryForecastCompat,
  type ErrorBoundarySessionReportCompat,
  type ErrorBoundarySignalAdapterConfig,
  type ErrorBoundaryAdapterSignalKind,
  type ErrorBoundaryAdapterSeverity,
  type ErrorBoundarySignalOutput,
  type ErrorBoundaryAdapterResult,
  type ErrorBoundaryAdapterState,
  type ErrorBoundaryAdapterReport,
} from './ErrorBoundarySignalAdapter';

// ============================================================================
// MARK: EventFlushSignalAdapter — Engine 0 flush coordinator → LIVEOPS lane
// ============================================================================

export {
  EventFlushSignalAdapter,
  EVENT_FLUSH_DEFAULT_ADAPTER,
  EVENT_FLUSH_STRICT_ADAPTER,
  EVENT_FLUSH_VERBOSE_ADAPTER,
  type ModeCodeCompat,
  type PressureTierCompat,
  type RunPhaseCompat,
  type FlushSignalKindCompat,
  type FlushChatSignalCompat,
  type FlushMLVectorCompat,
  type FlushDLTensorCompat,
  type FlushTelemetrySnapshotCompat,
  type FlushTrendDirectionCompat,
  type FlushTrendSnapshotCompat,
  type FlushRecoveryActionCompat,
  type FlushRecoveryForecastCompat,
  type FlushSessionReportCompat,
  type EventFlushSignalAdapterConfig,
  type EventFlushChatSignalKind,
  type EventFlushChatPayload,
  type EventFlushTranslationResult,
} from './EventFlushSignalAdapter';

// ============================================================================
// MARK: OrchestratorDiagnosticsSignalAdapter — Engine 0 diagnostics → LIVEOPS
// ============================================================================

export {
  OrchestratorDiagnosticsSignalAdapter,
  ORCHESTRATOR_DIAGNOSTICS_DEFAULT_ADAPTER,
  ORCHESTRATOR_DIAGNOSTICS_STRICT_ADAPTER,
  ORCHESTRATOR_DIAGNOSTICS_VERBOSE_ADAPTER,
  type DiagnosticsSignalCompat,
  type DiagnosticsMLVectorSignal,
  type DiagnosticsTrendSignal,
  type DiagnosticsSessionSignal,
  type DiagnosticsTelemetrySignal,
  type OrchestratorDiagnosticsAdapterMode,
} from './OrchestratorDiagnosticsSignalAdapter';

// ============================================================================
// MARK: OrchestratorHealthSignalAdapter — Engine 0 health report → LIVEOPS
// ============================================================================

export {
  OrchestratorHealthSignalAdapter,
  ORCHESTRATOR_HEALTH_DEFAULT_ADAPTER,
  ORCHESTRATOR_HEALTH_STRICT_ADAPTER,
  ORCHESTRATOR_HEALTH_VERBOSE_ADAPTER,
  type HealthSignalCompat,
  type HealthTelemetryCompat,
  type HealthMLVectorCompat,
  type HealthTrendCompat,
  type HealthSessionCompat,
  type HealthDLTensorCompat,
  type HealthAnnotationCompat,
  type OrchestratorHealthAdapterMode,
} from './OrchestratorHealthSignalAdapter';

// ============================================================================
// MARK: OrchestratorTelemetrySignalAdapter — Engine 0 telemetry → LIVEOPS
// ============================================================================

export {
  OrchestratorTelemetrySignalAdapter,
  ORCHESTRATOR_TELEMETRY_DEFAULT_ADAPTER,
  ORCHESTRATOR_TELEMETRY_STRICT_ADAPTER,
  ORCHESTRATOR_TELEMETRY_VERBOSE_ADAPTER,
  type TelemetryChatSignalCompat,
  type TelemetryMLVectorCompat,
  type TelemetryMLVectorSignal,
  type TelemetryTrendSignalCompat,
  type TelemetrySessionSignalCompat,
  type TelemetryAnnotationCompat,
  type TelemetryAnnotationBundleCompat,
  type TelemetryDLTensorCompat,
  type OrchestratorTelemetryAdapterMode,
} from './OrchestratorTelemetrySignalAdapter';

// ============================================================================
// MARK: OutcomeGateSignalAdapter — Engine 0 outcome gate → LIVEOPS lane
// ============================================================================

export {
  OutcomeGateSignalAdapter,
  OUTCOME_GATE_DEFAULT_ADAPTER,
  OUTCOME_GATE_STRICT_ADAPTER,
  OUTCOME_GATE_VERBOSE_ADAPTER,
  classifyOutcomeGateSignalKind,
  isOutcomeGateSignalCritical,
  computeOutcomeGateChatUrgency,
  scoreOutcomeGateChatSignal,
  isOutcomeGateBankruptcyWarning,
  isOutcomeGateFreedomSprint,
  summarizeOutcomeGateChatSignal,
  validateOutcomeGateChatSignal,
  classifyBankruptcyRunwayTier,
  formatOutcomeGateMLVector,
  computeGateMLVectorSimilarity,
  getTopGateMLFeatures,
  flattenGateDLTensor,
  extractGateDLColumn,
  type OutcomeGateChatSignalCompat,
  type OutcomeGateMLVectorCompat,
  type OutcomeGateDLTensorCompat,
  type OutcomeGateTrendSnapshotCompat,
  type OutcomeGateSessionReportCompat,
  type OutcomeGateAnnotationBundleCompat,
  type OutcomeGateAdapterMode,
  type OutcomeGateSignalAdapterConfig,
  type OutcomeGateSignalKind,
  type OutcomeGateChatPayload,
  type OutcomeGateTranslationResult,
} from './OutcomeGateSignalAdapter';

// ============================================================================
// MARK: RunBootstrapPipelineSignalAdapter — Engine 0 bootstrap → LIVEOPS lane
// ============================================================================

export {
  RunBootstrapPipelineSignalAdapter,
  BOOTSTRAP_DEFAULT_ADAPTER,
  BOOTSTRAP_STRICT_ADAPTER,
  BOOTSTRAP_VERBOSE_ADAPTER,
  type BootstrapSignalCompat,
  type BootstrapAnnotationCompat,
  type BootstrapNarrationCompat,
  type BootstrapMLVectorCompat,
  type BootstrapDLTensorCompat,
  type BootstrapTrendCompat,
  type BootstrapSessionCompat,
  type BootstrapTranslationResult,
  type RunBootstrapAdapterMode,
} from './RunBootstrapPipelineSignalAdapter';

// ============================================================================
// MARK: RunCommandGatewaySignalAdapter — Engine 0 command → LIVEOPS lane
// ============================================================================

export {
  RunCommandGatewaySignalAdapter,
  GATEWAY_DEFAULT_SIGNAL_ADAPTER,
  GATEWAY_STRICT_SIGNAL_ADAPTER,
  GATEWAY_VERBOSE_SIGNAL_ADAPTER,
  GATEWAY_SIGNAL_ADAPTER_MANIFEST,
  GATEWAY_SIGNAL_ADAPTER_VERSION,
  GATEWAY_SIGNAL_ADAPTER_READY,
  GATEWAY_SIGNAL_ADAPTER_SCHEMA,
  GATEWAY_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  GATEWAY_SIGNAL_ADAPTER_MAX_HEAT,
  GATEWAY_SIGNAL_WORLD_EVENT_PREFIX,
  type GatewaySeverityCompat,
  type GatewayCommandKindCompat,
  type GatewaySignalCompat,
  type GatewayAnnotationCompat,
  type GatewayNarrationCompat,
  type GatewayMLVectorCompat,
  type GatewayDLTensorCompat,
  type GatewayTrendCompat,
  type GatewaySessionCompat,
  type GatewayHealthSnapshotCompat,
  type GatewayRunSummaryCompat,
  type GatewayTranslationResult,
  type RunCommandGatewayAdapterMode,
} from './RunCommandGatewaySignalAdapter';

// ============================================================================
// MARK: RunLifecycleCoordinatorSignalAdapter — Engine 0 lifecycle → LIVEOPS lane
// ============================================================================

export {
  RunLifecycleCoordinatorSignalAdapter,
  LIFECYCLE_DEFAULT_SIGNAL_ADAPTER,
  LIFECYCLE_STRICT_SIGNAL_ADAPTER,
  LIFECYCLE_VERBOSE_SIGNAL_ADAPTER,
  LIFECYCLE_SIGNAL_ADAPTER_MANIFEST,
  LIFECYCLE_SIGNAL_ADAPTER_VERSION,
  LIFECYCLE_SIGNAL_ADAPTER_READY,
  LIFECYCLE_SIGNAL_ADAPTER_SCHEMA,
  LIFECYCLE_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  LIFECYCLE_SIGNAL_ADAPTER_MAX_HEAT,
  LIFECYCLE_SIGNAL_WORLD_EVENT_PREFIX,
  type LifecycleSeverityCompat,
  type LifecycleOperationKindCompat,
  type LifecycleSignalCompat,
  type LifecycleAnnotationCompat,
  type LifecycleNarrationCompat,
  type LifecycleMLVectorCompat,
  type LifecycleDLTensorRowCompat,
  type LifecycleDLTensorCompat,
  type LifecycleTrendCompat,
  type LifecycleSessionCompat,
  type LifecycleHealthSnapshotCompat,
  type LifecycleRunSummaryCompat,
  type LifecycleTranslationResult,
  type RunLifecycleCoordinatorAdapterMode,
} from './RunLifecycleCoordinatorSignalAdapter';

// ============================================================================
// MARK: RunShutdownPipelineSignalAdapter — Engine 0 shutdown → LIVEOPS lane
// ============================================================================

export {
  RunShutdownPipelineSignalAdapter,
  SHUTDOWN_DEFAULT_SIGNAL_ADAPTER,
  SHUTDOWN_STRICT_SIGNAL_ADAPTER,
  SHUTDOWN_VERBOSE_SIGNAL_ADAPTER,
  SHUTDOWN_SIGNAL_ADAPTER_MANIFEST,
  SHUTDOWN_SIGNAL_ADAPTER_VERSION,
  SHUTDOWN_SIGNAL_ADAPTER_READY,
  SHUTDOWN_SIGNAL_ADAPTER_SCHEMA,
  SHUTDOWN_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  SHUTDOWN_SIGNAL_ADAPTER_MAX_HEAT,
  SHUTDOWN_SIGNAL_WORLD_EVENT_PREFIX,
  type ShutdownSeverityCompat,
  type ShutdownOperationKindCompat,
  type ShutdownSignalCompat,
  type ShutdownAnnotationCompat,
  type ShutdownNarrationCompat,
  type ShutdownMLVectorCompat,
  type ShutdownDLTensorRowCompat,
  type ShutdownDLTensorCompat,
  type ShutdownTrendCompat,
  type ShutdownSessionCompat,
  type ShutdownHealthSnapshotCompat,
  type ShutdownRunSummaryCompat,
  type ShutdownTranslationResult,
  type RunShutdownAdapterMode,
} from './RunShutdownPipelineSignalAdapter';

// ============================================================================
// MARK: RuntimeCheckpointCoordinatorSignalAdapter — Engine 0 checkpoint → LIVEOPS lane
// ============================================================================

export {
  RuntimeCheckpointCoordinatorSignalAdapter,
  CHECKPOINT_DEFAULT_SIGNAL_ADAPTER,
  CHECKPOINT_STRICT_SIGNAL_ADAPTER,
  CHECKPOINT_VERBOSE_SIGNAL_ADAPTER,
  CHECKPOINT_SIGNAL_ADAPTER_MANIFEST,
  CHECKPOINT_SIGNAL_ADAPTER_VERSION,
  CHECKPOINT_SIGNAL_ADAPTER_READY,
  CHECKPOINT_SIGNAL_ADAPTER_SCHEMA,
  CHECKPOINT_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  CHECKPOINT_SIGNAL_ADAPTER_MAX_HEAT,
  CHECKPOINT_SIGNAL_WORLD_EVENT_PREFIX,
  type CheckpointSeverityCompat,
  type CheckpointOperationKindCompat,
  type CheckpointSignalCompat,
  type CheckpointAnnotationCompat,
  type CheckpointNarrationCompat,
  type CoordinatorMLVectorCompat,
  type CoordinatorDLTensorRowCompat,
  type CoordinatorDLTensorCompat,
  type CheckpointTrendCompat,
  type CheckpointSessionCompat,
  type CheckpointHealthSnapshotCompat,
  type CheckpointRunSummaryCompat,
  type CheckpointTranslationResult,
  type RuntimeCheckpointAdapterMode,
} from './RuntimeCheckpointCoordinatorSignalAdapter';

// ============================================================================
// MARK: RunQueryServiceSignalAdapter — Engine 0 query → LIVEOPS lane
// ============================================================================

export {
  RunQueryServiceSignalAdapter,
  QUERY_DEFAULT_SIGNAL_ADAPTER,
  QUERY_STRICT_SIGNAL_ADAPTER,
  QUERY_VERBOSE_SIGNAL_ADAPTER,
  QUERY_SIGNAL_ADAPTER_MANIFEST,
  QUERY_SIGNAL_ADAPTER_VERSION,
  QUERY_SIGNAL_ADAPTER_READY,
  QUERY_SIGNAL_ADAPTER_SCHEMA,
  QUERY_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  QUERY_SIGNAL_ADAPTER_MAX_HEAT,
  QUERY_SIGNAL_WORLD_EVENT_PREFIX,
  type QuerySeverityCompat,
  type QueryOperationKindCompat,
  type QuerySignalCompat,
  type QueryAnnotationCompat,
  type QueryNarrationCompat,
  type QueryMLVectorCompat,
  type QueryDLTensorRowCompat,
  type QueryDLTensorCompat,
  type QueryTrendCompat,
  type QuerySessionCompat,
  type QueryHealthSnapshotCompat,
  type QueryRunSummaryCompat,
  type QueryTranslationResult,
  type RunQueryAdapterMode,
} from './RunQueryServiceSignalAdapter';

// ============================================================================
// MARK: StepTracePublisherSignalAdapter — Engine 0 step trace → LIVEOPS lane
// ============================================================================

export {
  StepTracePublisherSignalAdapter,
  STEP_TRACE_DEFAULT_SIGNAL_ADAPTER,
  STEP_TRACE_STRICT_SIGNAL_ADAPTER,
  STEP_TRACE_VERBOSE_SIGNAL_ADAPTER,
  STEP_TRACE_SIGNAL_ADAPTER_MANIFEST,
  STEP_TRACE_SIGNAL_ADAPTER_VERSION,
  STEP_TRACE_SIGNAL_ADAPTER_READY,
  STEP_TRACE_SIGNAL_ADAPTER_SCHEMA,
  STEP_TRACE_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  STEP_TRACE_SIGNAL_ADAPTER_MAX_HEAT,
  STEP_TRACE_SIGNAL_WORLD_EVENT_PREFIX,
  type StepTraceSeverityCompat,
  type StepTraceOperationKindCompat,
  type StepTraceSignalCompat,
  type StepTraceAnnotationCompat,
  type StepTraceNarrationCompat,
  type StepTraceMLVectorCompat,
  type StepTraceDLTensorRowCompat,
  type StepTraceDLTensorCompat,
  type StepTraceTrendCompat,
  type StepTraceSessionCompat,
  type StepTraceHealthSnapshotCompat,
  type StepTraceRunSummaryCompat,
  type StepTraceTranslationResult,
  type StepTraceAdapterMode,
  type StepTraceSignalAdapterManifest,
} from './StepTracePublisherSignalAdapter';

// ============================================================================
// MARK: TickExecutorSignalAdapter — Engine 0 tick orchestration → LIVEOPS lane
// ============================================================================

export {
  TickExecutorSignalAdapter,
  TICK_EXECUTOR_DEFAULT_SIGNAL_ADAPTER,
  TICK_EXECUTOR_STRICT_SIGNAL_ADAPTER,
  TICK_EXECUTOR_VERBOSE_SIGNAL_ADAPTER,
  TICK_EXECUTOR_SIGNAL_ADAPTER_MANIFEST,
  TICK_EXECUTOR_SIGNAL_ADAPTER_VERSION,
  TICK_EXECUTOR_SIGNAL_ADAPTER_READY,
  TICK_EXECUTOR_SIGNAL_ADAPTER_SCHEMA,
  TICK_EXECUTOR_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  TICK_EXECUTOR_SIGNAL_ADAPTER_DL_TENSOR_SHAPE,
  TICK_EXECUTOR_SIGNAL_ADAPTER_MAX_HEAT,
  TICK_EXECUTOR_SIGNAL_WORLD_EVENT_PREFIX,
  type TickExecutorSeverityCompat,
  type TickExecutorOperationKindCompat,
  type TickExecutorMLVectorCompat,
  type TickExecutorDLTensorRowCompat,
  type TickExecutorDLTensorCompat,
  type TickExecutorSignalCompat,
  type TickExecutorAnnotationCompat,
  type TickExecutorNarrationCompat,
  type TickExecutorTrendCompat,
  type TickExecutorSessionCompat,
  type TickExecutorHealthSnapshotCompat,
  type TickExecutorRunSummaryCompat,
  type TickExecutorTranslationResult,
  type TickExecutorAdapterMode,
  type TickExecutorSignalAdapterManifest,
} from './TickExecutorSignalAdapter';

// ============================================================================
// MARK: TickPlanSignalAdapter — Engine 0 tick plan → LIVEOPS lane
// ============================================================================

export {
  TickPlanSignalAdapter,
  TICK_PLAN_DEFAULT_SIGNAL_ADAPTER,
  TICK_PLAN_STRICT_SIGNAL_ADAPTER,
  TICK_PLAN_VERBOSE_SIGNAL_ADAPTER,
  TICK_PLAN_SIGNAL_ADAPTER_MANIFEST,
  TICK_PLAN_SIGNAL_ADAPTER_VERSION,
  TICK_PLAN_SIGNAL_ADAPTER_READY,
  TICK_PLAN_SIGNAL_ADAPTER_SCHEMA,
  TICK_PLAN_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  TICK_PLAN_SIGNAL_ADAPTER_DL_TENSOR_SHAPE,
  TICK_PLAN_SIGNAL_ADAPTER_MAX_HEAT,
  TICK_PLAN_SIGNAL_WORLD_EVENT_PREFIX,
  buildTickPlanLiveOpsPayload,
  translateTickPlanSeverityToHeat,
  type TickPlanSignalAdapterSeverityCompat,
  type TickPlanSignalAdapterOperationKindCompat,
  type TickPlanMLVectorCompat,
  type TickPlanDLTensorRowCompat,
  type TickPlanDLTensorCompat,
  type TickPlanNarrationHintCompat,
  type TickPlanAnnotationCompat,
  type TickPlanHealthSnapshotCompat,
  type TickPlanRunSummaryCompat,
  type TickPlanTrendSnapshotCompat,
  type TickPlanSessionReportCompat,
  type TickPlanSignalCompat,
  type TickPlanAdapterMode,
  type TickPlanSignalAdapterManifest,
  type TickPlanChatSignalEnvelope,
  type TickPlanPressureTierAdapterCompat,
  type TickPlanRunPhaseAdapterCompat,
  type TickPlanRunOutcomeAdapterCompat,
} from './TickPlanSignalAdapter';

// ============================================================================
// MARK: TickResultBuilderSignalAdapter — Engine 0 tick result → LIVEOPS lane
// ============================================================================

export {
  TickResultBuilderSignalAdapter,
  createTickResultBuilderSignalAdapter,
  TICK_RESULT_DEFAULT_SIGNAL_ADAPTER,
  TICK_RESULT_STRICT_SIGNAL_ADAPTER,
  TICK_RESULT_VERBOSE_SIGNAL_ADAPTER,
  TICK_RESULT_SIGNAL_ADAPTER_MANIFEST,
  TICK_RESULT_SIGNAL_ADAPTER_VERSION,
  TICK_RESULT_SIGNAL_ADAPTER_READY,
  TICK_RESULT_SIGNAL_ADAPTER_SCHEMA,
  TICK_RESULT_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  TICK_RESULT_SIGNAL_ADAPTER_DL_TENSOR_SHAPE,
  TICK_RESULT_SIGNAL_ADAPTER_MAX_HEAT,
  TICK_RESULT_SIGNAL_WORLD_EVENT_PREFIX,
  buildTickResultLiveOpsPayload,
  translateTickResultSeverityToHeat,
  isTickResultSeverityCompat,
  isTickResultOperationKindCompat,
  isTickResultModeCompat,
  buildTickResultDefaultMLVector,
  buildTickResultDefaultDLTensor,
  computeTickResultSignalHealthScore,
  classifyTickResultSignalSeverity,
  buildTickResultSignalAnnotation,
  buildTickResultSignalNarrationHint,
  buildTickResultSignalHealthSnapshot,
  buildTickResultSignalRunSummary,
  extractTickResultSignalMLVector,
  buildTickResultSignalDLTensor,
  translateTickResultBattleSignal,
  translateTickResultShieldSignal,
  translateTickResultCascadeSignal,
  translateTickResultPressureSignal,
  translateTickResultIntegritySignal,
  deduplicateTickResultSignals,
  batchTranslateTickResultSignals,
  diffTickResultSignals,
  buildTickResultSignalAnnotationBundle,
  buildTickResultSignalExportBundle,
  buildTickResultAdapterMetricsSnapshot,
  type TickResultSeverityCompat,
  type TickResultOperationKindCompat,
  type TickResultModeCompat,
  type TickResultRunPhaseCompat,
  type TickResultRunOutcomeCompat,
  type TickResultMLVectorCompat,
  type TickResultDLTensorRowCompat,
  type TickResultDLTensorCompat,
  type TickResultBattleSummaryCompat,
  type TickResultShieldSummaryCompat,
  type TickResultCascadeSummaryCompat,
  type TickResultPressureSummaryCompat,
  type TickResultIntegritySummaryCompat,
  type TickResultSignalCompat,
  type TickResultAnnotationCompat,
  type TickResultNarrationCompat,
  type TickResultTrendCompat,
  type TickResultSessionCompat,
  type TickResultHealthSnapshotCompat,
  type TickResultRunSummaryCompat,
  type TickResultTranslationResult,
  type TickResultAdapterMode,
  type TickResultSignalAdapterManifest,
  type TickResultBuilderSignalAdapterOptions,
  type TickResultSignalDiffReport,
  type TickResultSignalAnnotationBundle,
  type TickResultAdapterMetricsSnapshot,
  type TickResultSignalExportBundle,
} from './TickResultBuilderSignalAdapter';

// ============================================================================
// MARK: TickStateLockSignalAdapter — Engine 0 lock lifecycle → LIVEOPS lane
// ============================================================================

export {
  TickStateLockSignalAdapter,
  TICK_STATE_LOCK_DEFAULT_SIGNAL_ADAPTER,
  TICK_STATE_LOCK_STRICT_SIGNAL_ADAPTER,
  TICK_STATE_LOCK_VERBOSE_SIGNAL_ADAPTER,
  TICK_STATE_LOCK_SIGNAL_ADAPTER_MANIFEST,
  TICK_STATE_LOCK_SIGNAL_ADAPTER_VERSION,
  TICK_STATE_LOCK_SIGNAL_ADAPTER_READY,
  TICK_STATE_LOCK_SIGNAL_ADAPTER_SCHEMA,
  TICK_STATE_LOCK_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  TICK_STATE_LOCK_SIGNAL_ADAPTER_DL_TENSOR_SHAPE,
  TICK_STATE_LOCK_SIGNAL_ADAPTER_MAX_HEAT,
  TICK_STATE_LOCK_SIGNAL_WORLD_EVENT_PREFIX,
  buildTickStateLockLiveOpsPayload,
  translateTickStateLockSeverityToHeat,
  isTickStateLockSeverityCompat,
  isTickStateLockOperationKindCompat,
  isTickStateLockRuntimeStateCompat,
  isTickStateLockModeCodeCompat,
  extractTickStateLockSignalMLVector,
  buildTickStateLockSignalDLTensor,
  computeTickStateLockSignalHealthScore,
  classifyTickStateLockSignalSeverity,
  buildTickStateLockSignalNarrationHint,
  buildTickStateLockSignalAnnotation,
  buildTickStateLockSignalHealthSnapshot,
  buildTickStateLockSignalRunSummary,
  buildTickStateLockAdapterTrendSnapshot,
  buildTickStateLockSignalSessionReport,
  buildTickStateLockSignalExportBundle,
  buildTickStateLockSignalAnnotationBundle,
  buildTickStateLockAdapterMetricsSnapshot,
  translateTickStateLockAcquireSignal,
  translateTickStateLockReleaseSignal,
  translateTickStateLockStaleSignal,
  translateTickStateLockTerminalSignal,
  translateTickStateLockResetSignal,
  translateTickStateLockIllegalTransitionSignal,
  deduplicateTickStateLockSignals,
  batchTranslateTickStateLockSignals,
  diffTickStateLockSignals,
  buildTickStateLockSignalAdapterManifest,
  getTickStateLockWorldEventName,
  getTickStateLockAnnotationWorldEvent,
  getTickStateLockNarrationWorldEvent,
  getTickStateLockHealthWorldEvent,
  getTickStateLockRunSummaryWorldEvent,
  getTickStateLockTrendWorldEvent,
  getTickStateLockSessionWorldEvent,
  getTickStateLockDLTensorWorldEvent,
  getTickStateLockChatLane,
  type TickStateLockSignalAdapterSeverityCompat,
  type TickStateLockSignalAdapterOperationKindCompat,
  type TickStateLockRuntimeStateCompat,
  type TickStateLockModeCodeCompat,
  type TickStateLockRunPhaseCompat,
  type TickStateLockPressureTierCompat,
  type TickStateLockRunOutcomeCompat,
  type TickStateLockMLVectorCompat,
  type TickStateLockDLTensorRowCompat,
  type TickStateLockDLTensorCompat,
  type TickStateLockNarrationHintCompat,
  type TickStateLockAnnotationCompat,
  type TickStateLockHealthSnapshotCompat,
  type TickStateLockRunSummaryCompat,
  type TickStateLockTrendSnapshotCompat,
  type TickStateLockSessionReportCompat,
  type TickStateLockSignalCompat,
  type TickStateLockAdapterModeCompat,
  type TickStateLockSignalAdapterManifest,
  type TickStateLockTranslationResult,
  type TickStateLockSignalDiffReport,
  type TickStateLockSignalAnnotationBundle,
  type TickStateLockAdapterMetricsSnapshot,
  type TickStateLockSignalExportBundle,
  type TickStateLockSignalAdapterOptions,
} from './TickStateLockSignalAdapter';

// ============================================================================
// MARK: TickStepRunnerSignalAdapter — Engine 0 step execution → LIVEOPS lane
// ============================================================================
export {
  TickStepRunnerSignalAdapter,
  TICK_STEP_RUNNER_DEFAULT_SIGNAL_ADAPTER,
  TICK_STEP_RUNNER_STRICT_SIGNAL_ADAPTER,
  TICK_STEP_RUNNER_VERBOSE_SIGNAL_ADAPTER,
  TICK_STEP_RUNNER_SIGNAL_ADAPTER_MANIFEST,
  TICK_STEP_RUNNER_SIGNAL_ADAPTER_BUNDLE,
  TICK_STEP_RUNNER_SIGNAL_ADAPTER_MODULE_VERSION,
  TICK_STEP_RUNNER_SIGNAL_ADAPTER_SCHEMA,
  TICK_STEP_RUNNER_SIGNAL_ADAPTER_READY,
  TICK_STEP_RUNNER_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  TICK_STEP_RUNNER_SIGNAL_ADAPTER_DL_TENSOR_SHAPE,
  TICK_STEP_RUNNER_SIGNAL_ADAPTER_MAX_HEAT,
  TICK_STEP_RUNNER_SIGNAL_ADAPTER_STEP_BUDGET_MS,
  TICK_STEP_RUNNER_SIGNAL_ADAPTER_WORLD_EVENT_PREFIX,
  TICK_STEP_RUNNER_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
  buildTickStepRunnerNarrationHint,
  buildTickStepRunnerNarrationHintFromParts,
  buildZeroMLVectorCompat,
  buildZeroDLRowCompat,
  scoreSignalHealthGrade,
  buildMinimalSignalCompat,
  isTickStepRunnerSignalAdapterSeverity,
  isTickStepRunnerSignalAdapterMode,
  isTerminalSignalCompat,
  isBudgetExceededSignalCompat,
  type TickStepRunnerSignalAdapterSeverityCompat,
  type TickStepRunnerSignalAdapterOperationKindCompat,
  type TickStepRunnerSignalAdapterModeCompat,
  type TickStepRunnerModeCodeCompat,
  type TickStepRunnerRunPhaseCompat,
  type TickStepRunnerPressureTierCompat,
  type TickStepRunnerRunOutcomeCompat,
  type TickStepRunnerPhaseCompat,
  type TickStepRunnerOwnerCompat,
  type TickStepRunnerMLVectorCompat,
  type TickStepRunnerDLRowCompat,
  type TickStepRunnerDLTensorCompat,
  type TickStepRunnerNarrationHintCompat,
  type TickStepRunnerAnnotationCompat,
  type TickStepRunnerScoreResultCompat,
  type TickStepRunnerTrendSnapshotCompat,
  type TickStepRunnerSessionEntryCompat,
  type TickStepRunnerSignalCompat,
  type TickStepRunnerSignalAdapterManifest,
} from './TickStepRunnerSignalAdapter';

// ============================================================================
// MARK: TickTransactionCoordinatorSignalAdapter — coordinator execution → LIVEOPS lane
// ============================================================================
export {
  TickTransactionCoordinatorSignalAdapter,
  TICK_TRANSACTION_COORDINATOR_DEFAULT_SIGNAL_ADAPTER,
  TICK_TRANSACTION_COORDINATOR_STRICT_SIGNAL_ADAPTER,
  TICK_TRANSACTION_COORDINATOR_VERBOSE_SIGNAL_ADAPTER,
  TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_MANIFEST,
  TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_BUNDLE,
  TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_MODULE_VERSION,
  TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_SCHEMA,
  TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_READY,
  TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_DL_TENSOR_SHAPE,
  TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_MAX_HEAT,
  TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_STEP_BUDGET_MS,
  TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_WORLD_EVENT_PREFIX,
  TICK_TRANSACTION_COORDINATOR_SIGNAL_ADAPTER_MAX_BATCH,
  COORDINATOR_SIGNAL_ADAPTER_BY_MODE,
  buildCoordinatorSignalNarrationHint,
  buildCoordinatorSignalNarrationHintFromParts,
  buildTickTxCoordinatorMLVectorCompat,
  buildCoordinatorDLRowCompat,
  scoreCoordinatorSignalHealth,
  buildMinimalCoordinatorSignalCompat,
  getCoordinatorSignalAdapterForMode,
  isCoordinatorSignalAdapterSeverity,
  isCoordinatorSignalAdapterMode,
  isCoordinatorSignalAdapterOperationKind,
  isRollbackSignalCompat,
  isAbortSignalCompat,
  isCriticalCoordinatorSignal,
  isWitnessTriggerCompat,
  type CoordinatorSignalAdapterSeverityCompat,
  type CoordinatorSignalAdapterOperationKindCompat,
  type CoordinatorSignalAdapterModeCompat,
  type CoordinatorModeCodeCompat,
  type CoordinatorRunPhaseCompat,
  type CoordinatorPressureTierCompat,
  type CoordinatorRunOutcomeCompat,
  type CoordinatorChatSignalCompat,
  type TickTxCoordinatorMLVectorCompat,
  type TickTxCoordinatorDLTensorRowCompat,
  type TickTxCoordinatorDLTensorCompat,
  type CoordinatorNarrationHintCompat,
  type CoordinatorAnnotationBundleCompat,
  type CoordinatorHealthSnapshotCompat,
  type MinimalCoordinatorSignalCompat,
  type CoordinatorScoreResultCompat,
  type CoordinatorTrendSnapshotCompat,
  type CoordinatorSessionEntryCompat,
  type CoordinatorSignalAdapterOptions,
  type CoordinatorSignalTranslationResult,
  type CoordinatorSignalBatchResult,
  type CoordinatorSignalAdapterManifest,
} from './TickTransactionCoordinatorSignalAdapter';

// ============================================================================
// MARK: Final default export
// ============================================================================

export default BACKEND_CHAT_ADAPTER_SUITE_BUNDLE;
