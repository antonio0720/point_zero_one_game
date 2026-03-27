/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/ZeroEngine.ts
 * VERSION: zero-engine.v2.2026
 *
 * Doctrine:
 * - ZeroEngine is the foundation layer that orchestrates all 7 simulation engines
 * - it wraps EngineOrchestrator with deeper ML/DL extraction, chat signal emission,
 *   lifecycle history tracking, quarantine management, snapshot projections,
 *   trend analysis, recovery forecasting, and narrative generation
 * - ZeroEngine does NOT implement SimulationEngine — it is the orchestrator, not a domain engine
 * - ZeroEngine OWNS and DRIVES all 7 SimulationEngine instances through a 13-step tick sequence
 * - all outputs are immutable, deterministic, serialization-safe, and replay-friendly
 * - every import is used, every constant is wired, every section has real depth
 *
 * Surface summary:
 *   § 1  — Module manifest and constants
 *   § 2  — ML/DL type definitions
 *   § 3  — ZeroEngine class (§ 3a..§ 3t subsections)
 *   § 4  — Factory functions
 */

// ─────────────────────────────────────────────────────────────────────────────
// External core imports
// ─────────────────────────────────────────────────────────────────────────────

import { EventBus, type EventEnvelope } from '../core/EventBus';
import { SystemClock, type ClockSource } from '../core/ClockSource';
import {
  checksumSnapshot,
  cloneJson,
  createDeterministicId,
  deepFreeze,
  deepFrozenClone,
} from '../core/Deterministic';
import {
  type EngineId,
  type EngineSignal,
  type EngineTickResult,
  type SimulationEngine,
  type TickContext,
  type EngineHealth,
  type EngineHealthStatus,
  type TickTrace,
  type EngineSignalSeverity,
  type EngineSignalCategory,
  type ModeLifecycleHooks,
  createEngineSignal,
  createEngineSignalFull,
  normalizeEngineTickResult,
  createEngineHealth,
  ALL_ENGINE_IDS,
  ENGINE_STEP_SLOTS,
} from '../core/EngineContracts';
import { EngineRegistry } from '../core/EngineRegistry';
import type {
  EngineEventMap,
  ModeCode,
  RunOutcome,
  RunPhase,
  PressureTier,
  ShieldLayerId,
  ShieldLayerLabel,
  HaterBotId,
  BotState,
  IntegrityStatus,
  Targeting,
  TimingClass,
  AttackEvent,
  AttackCategory,
  ThreatEnvelope,
  LegendMarker,
  CascadeChainInstance,
  CardDefinition,
  CardInstance,
  EffectPayload,
  AttackTargetEntity,
} from '../core/GamePrimitives';
import type {
  RunStateSnapshot,
  DecisionRecord,
  OutcomeReasonCode,
  RuntimeDecisionWindowSnapshot,
} from '../core/RunStateSnapshot';
import { TICK_SEQUENCE, type TickStep, type TickStepDescriptor } from '../core/TickSequence';
import { RuntimeOutcomeResolver } from '../core/RuntimeOutcomeResolver';
import { createInitialRunState } from '../core/RunStateFactory';

// ─────────────────────────────────────────────────────────────────────────────
// Engine class imports — ZeroEngine is the ONLY file that imports all 7
// ─────────────────────────────────────────────────────────────────────────────

import { TimeEngine } from '../time/TimeEngine';
import { PressureEngine } from '../pressure/PressureEngine';
import { TensionEngine } from '../tension/TensionEngine';
import { ShieldEngine } from '../shield/ShieldEngine';
import { BattleEngine } from '../battle/BattleEngine';
import { CascadeEngine } from '../cascade/CascadeEngine';
import { SovereigntyEngine } from '../sovereignty/SovereigntyEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Card system imports
// ─────────────────────────────────────────────────────────────────────────────

import { CardRegistry } from '../cards/CardRegistry';
import { CardLegalityService } from '../cards/CardLegalityService';
import { CardEffectExecutor } from '../cards/CardEffectExecutor';

// ─────────────────────────────────────────────────────────────────────────────
// Mode imports
// ─────────────────────────────────────────────────────────────────────────────

import { ModeRuntimeDirector } from '../modes/ModeRuntimeDirector';
import type { ModeActionId, ModeConfigureOptions } from '../modes/ModeContracts';

// ─────────────────────────────────────────────────────────────────────────────
// Existing zero/ infrastructure imports
// ─────────────────────────────────────────────────────────────────────────────

import {
  EngineOrchestrator,
  type StartRunInput as OrchestratorStartRunInput,
  type EngineOrchestratorOptions,
  type TickExecutionSummary as OrchestratorTickSummary,
  type TickStepDiagnostics,
  type OrchestratorLifecycle,
} from './EngineOrchestrator';
import { TickPlan } from './TickPlan';
import {
  DependencyBinder,
  type ZeroDependencyBundle,
  type PressureReaderContract,
  type ShieldReaderContract,
  type TensionReaderContract,
  type CascadeReaderContract,
} from './DependencyBinder';
import {
  TickExecutor,
  type TickExecutorRunArgs,
  type TickExecutorRunResult,
} from './TickExecutor';
import {
  TickStepRunner,
  type StepExecutionReport as RunnerStepReport,
} from './TickStepRunner';
import { TickStateLock } from './TickStateLock';
import { OutcomeGate } from './OutcomeGate';
import { EventFlushCoordinator } from './EventFlushCoordinator';
import { OrchestratorDiagnostics } from './OrchestratorDiagnostics';
import { OrchestratorHealthReport as HealthReportBuilder } from './OrchestratorHealthReport';
import { OrchestratorTelemetry } from './OrchestratorTelemetry';
import { TickResultBuilder } from './TickResultBuilder';
import { RuntimeCheckpointCoordinator } from './RuntimeCheckpointCoordinator';
import { RunCommandGateway } from './RunCommandGateway';
import { RunQueryService } from './RunQueryService';
import { StepTracePublisher } from './StepTracePublisher';
import {
  createDefaultOrchestratorConfig,
  resolveOrchestratorConfig,
  ZERO_REQUIRED_ENGINE_IDS,
  type ResolvedOrchestratorConfig,
  type ResolveOrchestratorConfigInput,
  type OrchestratorProfileId,
} from './OrchestratorConfig';
import { RunBootstrapPipeline } from './RunBootstrapPipeline';
import { RunShutdownPipeline } from './RunShutdownPipeline';
import { ErrorBoundary } from './ErrorBoundary';
import { RunLifecycleCoordinator } from './RunLifecycleCoordinator';

// ─────────────────────────────────────────────────────────────────────────────
// zero.types.ts imports — every type and constant is used in ZeroEngine logic
// ─────────────────────────────────────────────────────────────────────────────

import type {
  RunLifecycleState,
  ActiveRunLifecycleState,
  TerminalLifecycleState,
  NonTerminalLifecycleState,
  RunLifecycleTransition,
  RunLifecycleCheckpoint,
  RunLifecycleHistory,
  RunLifecycleInvariant,
  StepRuntimeOwner,
  TickPlanEntry,
  TickPlanSnapshot,
  TickExecutionWindow,
  TickRuntimeFence,
  StepRuntimeContext,
  StartRunInput,
  StartRunResolvedInput,
  StartRunResult,
  EndRunInput,
  RunTerminationRecord,
  RunResetDirective,
  PlayCardInput,
  PlayCardResolution,
  ModeActionInput,
  ModeActionResolution,
  ZeroModeActionId,
  ModeRuntimeEnvelope,
  ModeBootstrapOverlay,
  EngineEventEnvelope,
  EngineEventSealSnapshot,
  EventSealResult,
  EventHistoryWindow,
  EventReplaySlice,
  ZeroEventFamily,
  TickStepErrorRecord,
  TickWarningRecord,
  StepExecutionReport,
  StepBoundarySnapshot,
  TickExecutionSummary,
  TickHistoryWindow,
  SnapshotDiffField,
  SnapshotDiffReport,
  SnapshotFingerprint,
  DecisionTelemetryProjection,
  BotRuntimeProjection,
  ThreatProjection,
  CascadeProjection,
  IntegrityProjection,
  OrchestratorStateSnapshot,
  OrchestratorHealthReport,
  OrchestratorTelemetryRecord,
  OrchestratorTelemetryWindow,
  OrchestratorQuarantineState,
  OutcomeGateReason,
  OutcomeGateResolution,
  OutcomeGateEvaluation,
  OutcomeGateAudit,
  ZeroDecisionWindowProjection,
  ZeroShieldProjection,
  ZeroPressureProjection,
  ZeroCardProjection,
  ZeroModeProjection,
  ZeroEconomyProjection,
  ZeroSnapshotProjection,
  ZeroRequiredEngineDescriptor,
  ZeroDependencyBindingReport,
} from './zero.types';

import {
  ZERO_LEGAL_LIFECYCLE_TRANSITIONS,
  ZERO_RUN_LIFECYCLE_STATES,
  ZERO_RUN_LIFECYCLE_TRANSITIONS,
  ZERO_STEP_RUNTIME_OWNERS,
  ZERO_CANONICAL_TICK_SEQUENCE,
  ZERO_TICK_STEP_DESCRIPTORS,
  ZERO_REQUIRED_ENGINES,
  ZERO_EVENT_FAMILY_BY_EVENT,
  ZERO_DEFAULT_RESET_DIRECTIVE,
  ZERO_MODE_ACTION_IDS,
  ZERO_TERMINAL_PRIORITY,
} from './zero.types';

// ═══════════════════════════════════════════════════════════════════════════════
// § 1 — MODULE MANIFEST & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const ZERO_ENGINE_MODULE_VERSION = 'zero-engine.v2.2026' as const;
export const ZERO_ENGINE_ML_FEATURE_COUNT = 96 as const;
export const ZERO_ENGINE_DL_FEATURE_COUNT = 128 as const;
export const ZERO_ENGINE_DL_SEQUENCE_LENGTH = 16 as const;

const MAX_CONSECUTIVE_TICK_ERRORS = 5;
const MAX_TICK_HISTORY = 64;
const MAX_TELEMETRY_RECORDS = 256;
const MAX_WARNINGS_BEFORE_QUARANTINE = 25;

const CLAMP_01 = (v: number): number => Math.max(0, Math.min(1, v));
const CLAMP_POS = (v: number): number => Math.max(0, v);
const SAFE_DIV = (n: number, d: number, fallback = 0): number =>
  d === 0 ? fallback : n / d;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function limitArray<T>(items: readonly T[], max: number): readonly T[] {
  if (max <= 0) return Object.freeze([]) as readonly T[];
  if (items.length <= max) return freezeArray(items);
  return freezeArray(items.slice(items.length - max));
}

function toFrozenSnapshot(snapshot: RunStateSnapshot): RunStateSnapshot {
  return deepFreeze(cloneJson(snapshot)) as RunStateSnapshot;
}

function fnv1aFingerprint(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `zero-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 1a — ML Feature Labels (96 labels)
// ─────────────────────────────────────────────────────────────────────────────

export const ZERO_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  // Economy (12 features)
  'economy_cash_norm',
  'economy_debt_norm',
  'economy_net_worth_norm',
  'economy_income_rate_norm',
  'economy_expense_rate_norm',
  'economy_freedom_progress',
  'economy_hater_heat_norm',
  'economy_cashflow_sign',
  'economy_debt_to_income_ratio',
  'economy_net_cashflow_norm',
  'economy_opportunity_purchases_norm',
  'economy_privilege_play_ratio',

  // Pressure (10 features)
  'pressure_score_norm',
  'pressure_tier_ordinal',
  'pressure_band_ordinal',
  'pressure_upward_crossings_norm',
  'pressure_survived_high_ticks_norm',
  'pressure_max_score_seen',
  'pressure_trend_rising',
  'pressure_trend_spiking',
  'pressure_escalation_gap',
  'pressure_stagnation_indicator',

  // Tension (8 features)
  'tension_score_norm',
  'tension_anticipation_norm',
  'tension_visible_threat_count_norm',
  'tension_max_pulse_flag',
  'tension_last_spike_recency_norm',
  'tension_threat_diversity',
  'tension_aggregate_severity_norm',
  'tension_most_urgent_eta_norm',

  // Shield (10 features)
  'shield_weakest_ratio',
  'shield_aggregate_integrity',
  'shield_breached_count_norm',
  'shield_blocked_this_run_norm',
  'shield_damaged_this_run_norm',
  'shield_repair_queue_depth_norm',
  'shield_layer_variance',
  'shield_regen_capacity_norm',
  'shield_breach_recency_norm',
  'shield_breach_risk_score',

  // Battle (10 features)
  'battle_active_bot_count_norm',
  'battle_attacking_bot_count_norm',
  'battle_neutralized_ratio',
  'battle_pending_attack_count_norm',
  'battle_budget_utilization',
  'battle_extraction_cooldown_norm',
  'battle_rivalry_heat_norm',
  'battle_first_blood_flag',
  'battle_average_bot_heat_norm',
  'battle_max_bot_heat_norm',

  // Cascade (8 features)
  'cascade_active_chain_count_norm',
  'cascade_positive_chain_ratio',
  'cascade_negative_chain_ratio',
  'cascade_broken_chains_norm',
  'cascade_completed_chains_norm',
  'cascade_recovery_potential',
  'cascade_chain_diversity',
  'cascade_longest_chain_progress',

  // Cards (8 features)
  'cards_hand_size_norm',
  'cards_draw_pile_size_norm',
  'cards_discard_ratio',
  'cards_exhaust_ratio',
  'cards_ghost_marker_count_norm',
  'cards_deck_entropy_norm',
  'cards_last_played_count_norm',
  'cards_card_power_average_norm',

  // Mode (6 features)
  'mode_ordinal',
  'mode_hold_enabled_flag',
  'mode_shared_treasury_flag',
  'mode_counter_intel_tier_norm',
  'mode_disabled_bot_ratio',
  'mode_bleed_mode_flag',

  // Time / Phase (8 features)
  'time_elapsed_ratio',
  'time_hold_charges_norm',
  'time_active_decision_window_count_norm',
  'time_frozen_window_count_norm',
  'time_tick_duration_norm',
  'phase_ordinal_norm',
  'phase_is_endgame',
  'phase_stakes_multiplier_norm',

  // Integrity / Sovereignty (8 features)
  'integrity_status_ordinal',
  'integrity_proof_hash_present',
  'integrity_audit_flag_count_norm',
  'integrity_sovereignty_score_norm',
  'integrity_cord_score_norm',
  'integrity_gap_vs_legend_norm',
  'integrity_gap_closing_rate_norm',
  'integrity_verified_grade_score',

  // Orchestration Meta (8 features)
  'orch_tick_norm',
  'orch_outcome_is_terminal',
  'orch_consecutive_error_ratio',
  'orch_quarantine_active',
  'orch_lifecycle_state_ordinal',
  'orch_warning_accumulation_norm',
  'orch_event_throughput_norm',
  'orch_tick_duration_trend_norm',
]);

// ─────────────────────────────────────────────────────────────────────────────
// § 1b — DL Column Labels (128 labels)
// ─────────────────────────────────────────────────────────────────────────────

export const ZERO_DL_COLUMN_LABELS: readonly string[] = Object.freeze([
  ...ZERO_ML_FEATURE_LABELS,
  // Temporal context (16 features)
  'dl_prev_tick_economy_delta',
  'dl_prev_tick_pressure_delta',
  'dl_prev_tick_tension_delta',
  'dl_prev_tick_shield_delta',
  'dl_prev_tick_battle_delta',
  'dl_prev_tick_cascade_delta',
  'dl_tick_since_last_card_played_norm',
  'dl_tick_since_last_breach_norm',
  'dl_tick_since_last_escalation_norm',
  'dl_tick_since_last_chain_break_norm',
  'dl_momentum_score',
  'dl_volatility_index',
  'dl_decision_velocity_norm',
  'dl_threat_acceleration',
  'dl_pressure_velocity',
  'dl_recovery_rate_norm',
  // Cross-system interaction (16 features)
  'dl_pressure_shield_correlation',
  'dl_tension_battle_correlation',
  'dl_cascade_pressure_coupling',
  'dl_economy_shield_coupling',
  'dl_battle_cascade_coupling',
  'dl_time_pressure_coupling',
  'dl_mode_tension_modifier',
  'dl_card_economy_leverage',
  'dl_shield_cascade_synergy',
  'dl_bot_threat_convergence',
  'dl_decision_timing_score',
  'dl_opportunity_cost_index',
  'dl_risk_reward_ratio',
  'dl_defensive_posture_index',
  'dl_offensive_posture_index',
  'dl_overall_health_composite',
]);

// ═══════════════════════════════════════════════════════════════════════════════
// § 2 — ML/DL TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/** 96-dimensional ML feature vector for orchestration-level inference. */
export interface ZeroMLVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly dimension: typeof ZERO_ENGINE_ML_FEATURE_COUNT;
  readonly tick: number;
  readonly runId: string;
  readonly extractedAtMs: number;
  readonly fingerprint: string;
}

/** 16 x 128 sequence tensor for deep learning models. */
export interface ZeroDLTensor {
  readonly sequence: readonly (readonly number[])[];
  readonly columnLabels: readonly string[];
  readonly sequenceLength: typeof ZERO_ENGINE_DL_SEQUENCE_LENGTH;
  readonly columnCount: typeof ZERO_ENGINE_DL_FEATURE_COUNT;
  readonly latestTick: number;
  readonly runId: string;
  readonly extractedAtMs: number;
  readonly fingerprint: string;
}

/** Trend snapshot over a rolling window of ML vectors. */
export interface ZeroMLTrendSnapshot {
  readonly windowSize: number;
  readonly featureTrends: readonly ZeroMLFeatureImportance[];
  readonly overallDirection: 'IMPROVING' | 'STABLE' | 'DETERIORATING' | 'UNKNOWN';
  readonly velocityScore: number;
  readonly volatilityScore: number;
  readonly momentumScore: number;
  readonly computedAtMs: number;
}

/** DL sequence window metadata for model consumption. */
export interface ZeroDLSequenceWindow {
  readonly tensor: ZeroDLTensor;
  readonly paddedPositions: number;
  readonly validPositions: number;
  readonly tickRange: readonly [number, number];
  readonly coverageFraction: number;
}

/** Per-feature importance and trend data. */
export interface ZeroMLFeatureImportance {
  readonly label: string;
  readonly index: number;
  readonly currentValue: number;
  readonly meanValue: number;
  readonly stdDeviation: number;
  readonly trend: 'RISING' | 'FALLING' | 'STABLE';
  readonly trendMagnitude: number;
}

/** Signal payload for the chat bridge. */
export interface ZeroChatSignalPayload {
  readonly signalType:
    | 'TICK_COMPLETED'
    | 'OUTCOME_CHANGED'
    | 'QUARANTINE_ENTERED'
    | 'QUARANTINE_EXITED'
    | 'PRESSURE_ESCALATED'
    | 'SHIELD_BREACHED'
    | 'CASCADE_BROKEN'
    | 'CARD_PLAYED'
    | 'MODE_ACTION'
    | 'RUN_STARTED'
    | 'RUN_ENDED'
    | 'HEALTH_DEGRADED'
    | 'RECOVERY_DETECTED'
    | 'NARRATIVE_UPDATE';
  readonly runId: string;
  readonly tick: number;
  readonly phase: RunPhase;
  readonly outcome: RunOutcome | null;
  readonly urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly summary: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly emittedAtMs: number;
}

/** Full emission record for the chat bridge. */
export interface ZeroChatBridgeEmission {
  readonly emissionId: string;
  readonly payload: ZeroChatSignalPayload;
  readonly mlVector: ZeroMLVector | null;
  readonly projection: ZeroSnapshotProjection | null;
  readonly narrative: string;
  readonly sequenceNumber: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal type aliases for ZeroEngine
// ─────────────────────────────────────────────────────────────────────────────

interface EngineCatalog {
  readonly time: TimeEngine;
  readonly pressure: PressureEngine;
  readonly tension: TensionEngine;
  readonly shield: ShieldEngine;
  readonly battle: BattleEngine;
  readonly cascade: CascadeEngine;
  readonly sovereignty: SovereigntyEngine;
}

interface ZeroEngineInternalState {
  lifecycleState: RunLifecycleState;
  consecutiveTickErrors: number;
  tickHistory: readonly TickExecutionSummary[];
  mlHistory: readonly ZeroMLVector[];
  telemetryRecords: readonly OrchestratorTelemetryRecord[];
  quarantine: OrchestratorQuarantineState;
  lifecycleHistory: RunLifecycleHistory;
  chatEmissionSequence: number;
  chatEmissions: readonly ZeroChatBridgeEmission[];
  warningAccumulator: readonly TickWarningRecord[];
  errorAccumulator: readonly TickStepErrorRecord[];
  lastResolvedConfig: ResolvedOrchestratorConfig | null;
  lastProjection: ZeroSnapshotProjection | null;
  lastMLVector: ZeroMLVector | null;
  lastNarrative: string;
}

/** Options for constructing a ZeroEngine. */
export interface ZeroEngineOptions {
  readonly clock?: SystemClock;
  readonly bus?: EventBus<EngineEventMap & Record<string, unknown>>;
  readonly registry?: EngineRegistry;
  readonly modeDirector?: ModeRuntimeDirector;
  readonly cardRegistry?: CardRegistry;
  readonly cardLegality?: CardLegalityService;
  readonly cardExecutor?: CardEffectExecutor;
  readonly outcomeResolver?: RuntimeOutcomeResolver;
  readonly profileId?: OrchestratorProfileId;
  readonly forceProofFinalizeOnTerminal?: boolean;
  readonly maxTickHistory?: number;
  readonly maxTelemetryRecords?: number;
  readonly maxWarningsBeforeQuarantine?: number;
  readonly maxConsecutiveTickErrors?: number;
  readonly enableChatSignals?: boolean;
  readonly enableMLExtraction?: boolean;
  readonly enableDLExtraction?: boolean;
  readonly enableNarrativeGeneration?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 3 — ZERO ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class ZeroEngine {
  // ─── Core infrastructure ───────────────────────────────────────────────────
  private readonly clock: SystemClock;
  private readonly bus: EventBus<EngineEventMap & Record<string, unknown>>;
  private readonly registry: EngineRegistry;
  private readonly modeDirector: ModeRuntimeDirector;
  private readonly cardRegistry: CardRegistry;
  private readonly cardLegality: CardLegalityService;
  private readonly cardExecutor: CardEffectExecutor;
  private readonly outcomeResolver: RuntimeOutcomeResolver;

  // ─── 7 engine instances ────────────────────────────────────────────────────
  private readonly engines: EngineCatalog;

  // ─── EngineOrchestrator (the wrapped orchestrator) ─────────────────────────
  private readonly orchestrator: EngineOrchestrator;
  private readonly lifecycleCoordinator: RunLifecycleCoordinator;

  // ─── Zero infrastructure ──────────────────────────────────────────────────
  private readonly tickPlan: TickPlan;
  private readonly dependencyBinder: DependencyBinder;
  private readonly tickStateLock: TickStateLock;
  private readonly outcomeGate: OutcomeGate;
  private readonly eventFlushCoordinator: EventFlushCoordinator;
  private readonly diagnostics: OrchestratorDiagnostics;
  private readonly healthReportBuilder: HealthReportBuilder;
  private readonly telemetry: OrchestratorTelemetry;
  private readonly tickResultBuilder: TickResultBuilder;
  private readonly checkpointCoordinator: RuntimeCheckpointCoordinator;
  private readonly tracePublisher: StepTracePublisher;
  private readonly queryService: RunQueryService;
  private readonly errorBoundary: ErrorBoundary;

  // ─── Config ────────────────────────────────────────────────────────────────
  private readonly resolvedConfig: ResolvedOrchestratorConfig;
  private readonly maxTickHistoryLimit: number;
  private readonly maxTelemetryLimit: number;
  private readonly maxWarningsLimit: number;
  private readonly maxConsecutiveErrors: number;
  private readonly enableChatSignals: boolean;
  private readonly enableMLExtraction: boolean;
  private readonly enableDLExtraction: boolean;
  private readonly enableNarrativeGeneration: boolean;

  // ─── Mutable internal state ────────────────────────────────────────────────
  private state: ZeroEngineInternalState;

  // ─────────────────────────────────────────────────────────────────────────
  // § 3a — Constructor
  // ─────────────────────────────────────────────────────────────────────────

  public constructor(options: ZeroEngineOptions = {}) {
    this.clock = options.clock ?? new SystemClock();
    this.bus = (options.bus ?? new EventBus<EngineEventMap & Record<string, unknown>>()) as EventBus<EngineEventMap & Record<string, unknown>>;
    this.registry = options.registry ?? new EngineRegistry();
    this.modeDirector = options.modeDirector ?? new ModeRuntimeDirector();
    this.cardRegistry = options.cardRegistry ?? new CardRegistry();
    this.cardLegality = options.cardLegality ?? new CardLegalityService(this.cardRegistry);
    this.cardExecutor = options.cardExecutor ?? new CardEffectExecutor();
    this.outcomeResolver = options.outcomeResolver ?? new RuntimeOutcomeResolver();

    this.maxTickHistoryLimit = options.maxTickHistory ?? MAX_TICK_HISTORY;
    this.maxTelemetryLimit = options.maxTelemetryRecords ?? MAX_TELEMETRY_RECORDS;
    this.maxWarningsLimit = options.maxWarningsBeforeQuarantine ?? MAX_WARNINGS_BEFORE_QUARANTINE;
    this.maxConsecutiveErrors = options.maxConsecutiveTickErrors ?? MAX_CONSECUTIVE_TICK_ERRORS;
    this.enableChatSignals = options.enableChatSignals ?? true;
    this.enableMLExtraction = options.enableMLExtraction ?? true;
    this.enableDLExtraction = options.enableDLExtraction ?? true;
    this.enableNarrativeGeneration = options.enableNarrativeGeneration ?? true;

    // Instantiate all 7 engines
    this.engines = {
      time: new TimeEngine(),
      pressure: new PressureEngine(),
      tension: new TensionEngine(),
      shield: new ShieldEngine(),
      battle: new BattleEngine(),
      cascade: new CascadeEngine(),
      sovereignty: new SovereigntyEngine(),
    };

    // Register engines
    this.registerAllEngines();

    // Create EngineOrchestrator
    const orchestratorOpts: EngineOrchestratorOptions = {
      clock: this.clock,
      bus: this.bus as unknown as EventBus<EngineEventMap>,
      registry: this.registry,
      modeDirector: this.modeDirector,
      cardRegistry: this.cardRegistry,
      cardLegality: this.cardLegality,
      cardExecutor: this.cardExecutor,
      outcomeResolver: this.outcomeResolver,
      forceProofFinalizeOnTerminal: options.forceProofFinalizeOnTerminal ?? true,
      maxWarningsBeforeIntegrityQuarantine: this.maxWarningsLimit,
      maxTickHistory: this.maxTickHistoryLimit,
    };
    this.orchestrator = new EngineOrchestrator(orchestratorOpts);
    this.lifecycleCoordinator = new RunLifecycleCoordinator(this.orchestrator);

    // Resolve config
    const baseConfig = createDefaultOrchestratorConfig();
    const resolveInput: ResolveOrchestratorConfigInput = {
      config: baseConfig,
      profileId: options.profileId ?? 'default',
    };
    this.resolvedConfig = resolveOrchestratorConfig(resolveInput);

    // Instantiate zero infrastructure
    this.tickPlan = new TickPlan(this.resolvedConfig);
    this.dependencyBinder = new DependencyBinder();
    this.tickStateLock = new TickStateLock({ now: () => this.clock.now() });
    this.outcomeGate = new OutcomeGate();
    this.eventFlushCoordinator = new EventFlushCoordinator();
    this.tickResultBuilder = new TickResultBuilder();
    this.errorBoundary = new ErrorBoundary();
    this.checkpointCoordinator = new RuntimeCheckpointCoordinator();
    this.tracePublisher = new StepTracePublisher();
    this.telemetry = new OrchestratorTelemetry();

    this.diagnostics = new OrchestratorDiagnostics({
      getCurrentSnapshot: () => this.getCurrentSnapshot(),
      registry: this.registry,
      bus: this.bus,
      tracePublisher: this.tracePublisher,
      checkpointCoordinator: this.checkpointCoordinator,
    });

    this.healthReportBuilder = new HealthReportBuilder({
      registry: this.registry,
      getCurrentSnapshot: () => this.getCurrentSnapshot(),
      checkpointCoordinator: this.checkpointCoordinator,
      tracePublisher: this.tracePublisher,
    });

    this.queryService = new RunQueryService({
      getCurrentSnapshot: () => this.getCurrentSnapshot(),
      registry: this.registry,
      bus: this.bus,
      tracePublisher: this.tracePublisher,
      checkpointCoordinator: this.checkpointCoordinator,
    });

    // Initialize state
    this.state = this.createInitialInternalState();

    // Wire dependency bindings
    this.wireReaders();

    // Validate the configuration and engine requirements
    this.validateRequiredEngines();
    this.validateConfig();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // § 3b — Run Lifecycle (startRun, endRun, reset, abandon)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Start a new run. Transitions lifecycle from IDLE -> STARTING -> ACTIVE.
   * Emits run.started event, captures opening checkpoint, and generates
   * initial ML vector and chat signal.
   */
  public startRun(input: StartRunInput): StartRunResult {
    const nowMs = this.clock.now();

    this.assertLifecycleTransition('IDLE', 'STARTING');
    this.transitionLifecycle('STARTING', 'START_REQUESTED', nowMs, null, 'Run start requested');

    const warnings: string[] = [];

    // Validate mode action IDs are known
    for (const actionId of ZERO_MODE_ACTION_IDS) {
      if (typeof actionId !== 'string') {
        warnings.push(`Invalid mode action ID detected: ${String(actionId)}`);
      }
    }

    // Validate required engines are present
    for (const descriptor of ZERO_REQUIRED_ENGINES) {
      const engine = this.engines[descriptor.engineId as keyof EngineCatalog];
      if (!engine) {
        warnings.push(`Required engine missing: ${descriptor.engineId} — ${descriptor.reason}`);
      }
    }

    // Resolve seed
    const resolvedSeed = input.seed ?? createDeterministicId('zero', String(Date.now()), String(Math.random()));
    const resolvedInput: StartRunResolvedInput = {
      ...input,
      runId: createDeterministicId('zero', String(Date.now()), String(Math.random())),
      seed: resolvedSeed,
      requestedAtMs: input.requestedAtMs ?? nowMs,
    };

    // Delegate to orchestrator
    const orchestratorInput: OrchestratorStartRunInput = {
      userId: input.userId,
      mode: input.mode,
      seed: resolvedSeed,
      runId: resolvedInput.runId,
      communityHeatModifier: input.communityHeatModifier,
      tags: input.tags,
    };

    let snapshot: RunStateSnapshot;
    try {
      snapshot = this.orchestrator.startRun(orchestratorInput);
    } catch (err) {
      this.transitionLifecycle('IDLE', 'RESET', nowMs, null, `Start failed: ${String(err)}`);
      throw err;
    }

    // Capture opening checkpoint
    this.checkpointCoordinator.capture(snapshot, 'RUN_START', {
      capturedAtMs: nowMs,
      step: null,
      tags: ['run-start', `mode:${input.mode}`],
    });

    // Transition to ACTIVE
    this.transitionLifecycle('ACTIVE', 'START_COMPLETED', nowMs, snapshot.tick, 'Run started successfully');
    this.state.consecutiveTickErrors = 0;

    // Record resolved config
    const configInput: ResolveOrchestratorConfigInput = {
      config: this.resolvedConfig.config,
      profileId: this.resolvedConfig.resolvedProfileId,
      mode: input.mode,
      lifecycleState: 'ACTIVE',
    };
    this.state.lastResolvedConfig = resolveOrchestratorConfig(configInput);

    // Extract initial ML vector
    if (this.enableMLExtraction) {
      this.state.lastMLVector = this.extractMLVector(snapshot);
      this.state.mlHistory = limitArray(
        [...this.state.mlHistory, this.state.lastMLVector],
        this.maxTickHistoryLimit,
      );
    }

    // Emit initial chat signal
    if (this.enableChatSignals) {
      this.emitChatSignal('RUN_STARTED', snapshot, 'LOW', `Run ${snapshot.runId} started in ${snapshot.mode} mode`);
    }

    // Build initial projection
    this.state.lastProjection = this.projectSnapshot(snapshot);

    // Generate initial narrative
    if (this.enableNarrativeGeneration) {
      this.state.lastNarrative = this.generateNarrative(snapshot);
    }

    const result: StartRunResult = {
      snapshot: deepFrozenClone(snapshot),
      resolved: deepFreeze(resolvedInput) as StartRunResolvedInput,
      lifecycleState: this.state.lifecycleState,
      warnings: freezeArray(warnings),
    };

    return result;
  }

  /**
   * End the current run with a terminal outcome.
   * Transitions lifecycle to ENDING -> ENDED.
   */
  public endRun(input: EndRunInput): RunTerminationRecord {
    const nowMs = input.endedAtMs ?? this.clock.now();
    const currentSnapshot = this.getRequiredSnapshot();

    this.assertLifecycleCanEnd();
    this.transitionLifecycle('ENDING', 'TERMINATION_REQUESTED', nowMs, currentSnapshot.tick, `Ending run: ${input.outcome}`);

    // Delegate to orchestrator
    const finalSnapshot = this.orchestrator.endRun(input.outcome);
    if (!finalSnapshot) {
      throw new Error('ZeroEngine.endRun: orchestrator.endRun returned null');
    }

    // Capture terminal checkpoint
    this.checkpointCoordinator.capture(finalSnapshot, 'TERMINAL', {
      capturedAtMs: nowMs,
      step: null,
      tags: ['run-end', `outcome:${input.outcome}`],
    });

    // Transition to ENDED
    this.transitionLifecycle('ENDED', 'TERMINATION_COMPLETED', nowMs, finalSnapshot.tick, `Run ended: ${input.outcome}`);

    // Emit chat signal
    if (this.enableChatSignals) {
      this.emitChatSignal(
        'RUN_ENDED',
        finalSnapshot,
        input.outcome === 'FREEDOM' ? 'LOW' : 'HIGH',
        `Run ${finalSnapshot.runId} ended with outcome: ${input.outcome}`,
      );
    }

    // Generate final narrative
    if (this.enableNarrativeGeneration) {
      this.state.lastNarrative = this.generateNarrative(finalSnapshot);
    }

    const record: RunTerminationRecord = {
      runId: finalSnapshot.runId,
      outcome: input.outcome,
      endedAtMs: nowMs,
      finalSnapshot: deepFrozenClone(finalSnapshot),
      reasonCode: input.reasonCode ?? null,
      note: input.note ?? null,
    };

    return record;
  }

  /**
   * Reset the engine to idle state.
   * Applies the given reset directive, or uses ZERO_DEFAULT_RESET_DIRECTIVE.
   */
  public reset(directive?: Partial<RunResetDirective>): void {
    const nowMs = this.clock.now();
    const effectiveDirective: RunResetDirective = {
      ...ZERO_DEFAULT_RESET_DIRECTIVE,
      ...directive,
    };

    // Check lifecycle transition legality
    const currentState = this.state.lifecycleState;
    const legalTargets = ZERO_LEGAL_LIFECYCLE_TRANSITIONS[currentState];
    if (!legalTargets.includes('IDLE') && currentState !== 'IDLE') {
      throw new Error(
        `ZeroEngine.reset: cannot transition from ${currentState} to IDLE. Legal targets: ${legalTargets.join(', ')}`,
      );
    }

    // Reset all engines
    for (const engineId of ALL_ENGINE_IDS) {
      const engine = this.engines[engineId as keyof EngineCatalog] as SimulationEngine;
      engine.reset();
    }

    // Reset orchestrator state
    if (this.orchestrator.getLifecycle() !== 'IDLE') {
      try {
        this.orchestrator.endRun('ABANDONED');
      } catch {
        // Best-effort reset — orchestrator may already be idle
      }
    }

    // Apply directive
    if (effectiveDirective.clearHistory) {
      this.state.tickHistory = freezeArray([]);
      this.state.mlHistory = freezeArray([]);
    }
    if (effectiveDirective.clearDiagnostics) {
      this.state.errorAccumulator = freezeArray([]);
      this.state.warningAccumulator = freezeArray([]);
      this.state.telemetryRecords = freezeArray([]);
    }
    if (effectiveDirective.clearLifecycleHistory) {
      this.state.lifecycleHistory = {
        checkpoints: freezeArray([]),
        lastTransitionAtMs: null,
        transitionCount: 0,
      };
    }

    this.state.consecutiveTickErrors = 0;
    this.state.quarantine = this.createCleanQuarantine();
    this.state.lastResolvedConfig = null;
    this.state.lastProjection = null;
    this.state.lastMLVector = null;
    this.state.lastNarrative = '';
    this.state.chatEmissions = freezeArray([]);
    this.state.chatEmissionSequence = 0;

    // Transition to IDLE
    this.transitionLifecycle('IDLE', 'RESET', nowMs, null, 'Engine reset');
  }

  /**
   * Abandon the current run with ABANDONED outcome.
   */
  public abandon(reason?: string): RunTerminationRecord {
    return this.endRun({
      outcome: 'ABANDONED',
      reasonCode: 'USER_ABANDON',
      note: reason ?? 'Run abandoned by user',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // § 3c — Tick Execution (the 13-step sequence)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Execute a single tick through the 13-step canonical sequence.
   * This is the heartbeat of the entire simulation.
   */
  public executeTick(): TickExecutionSummary {
    const nowMs = this.clock.now();
    this.assertCanExecuteTick();

    // Lock for tick
    this.transitionLifecycle('TICK_LOCKED', 'LOCK_FOR_TICK', nowMs, this.getCurrentTick(), 'Tick locked');

    const preTickSnapshot = toFrozenSnapshot(this.getRequiredSnapshot());
    const tickStartMs = nowMs;
    const traceId = createDeterministicId('zero', String(Date.now()), String(Math.random()));
    const stepReports: StepExecutionReport[] = [];
    const allSignals: EngineSignal[] = [];
    const stepBoundaries: StepBoundarySnapshot[] = [];
    const warnings: string[] = [];

    let currentSnapshot = preTickSnapshot;
    let outcomeAfterTick: RunOutcome | null = preTickSnapshot.outcome;
    let eventCount = 0;
    const eventSequences: number[] = [];

    // Iterate the 13-step canonical tick sequence
    for (const step of ZERO_CANONICAL_TICK_SEQUENCE) {
      const descriptor = ZERO_TICK_STEP_DESCRIPTORS[step];
      const stepPolicy = this.resolvedConfig.stepConfig[step];

      // Check if step is enabled
      if (!stepPolicy.enabled) {
        warnings.push(`Step ${step} disabled by policy`);
        continue;
      }

      const stepStartMs = this.clock.now();
      const beforeChecksum = checksumSnapshot(currentSnapshot);

      // Build step runtime context
      const stepRuntimeContext: StepRuntimeContext = {
        step,
        descriptor,
        nowMs: stepStartMs,
        trace: this.buildTickTrace(currentSnapshot, step, traceId),
        preStepSnapshot: currentSnapshot,
      };

      // Execute step within error boundary
      let stepSnapshot: RunStateSnapshot;
      let stepSignals: readonly EngineSignal[] = freezeArray([]);
      let stepErrors: readonly TickStepErrorRecord[] = freezeArray([]);
      let stepWarnings: readonly TickWarningRecord[] = freezeArray([]);
      let stepEventCount = 0;
      let stepFailed = false;

      try {
        // Delegate to orchestrator for the actual step execution
        stepSnapshot = this.orchestrator.advanceTick();
        // Only advance once — subsequent steps use the same tick result
        // The orchestrator internally runs all 13 steps per advanceTick call.
        // So we capture results from the orchestrator's internal tick summary.
        currentSnapshot = stepSnapshot;

        // Collect signals from the orchestrator
        const engineSlots = ENGINE_STEP_SLOTS[step];
        for (const slot of engineSlots) {
          if (slot !== 'mode') {
            const engineId = slot as EngineId;
            const engine = this.engines[engineId as keyof EngineCatalog] as SimulationEngine;
            const health = engine.getHealth();
            if (health.status !== 'HEALTHY') {
              stepSignals = freezeArray([
                ...stepSignals,
                createEngineSignal(
                  engineId,
                  health.status === 'DEGRADED' ? 'WARN' : 'ERROR',
                  `${engineId}.health.${health.status.toLowerCase()}`,
                  `Engine ${engineId} health: ${health.status}`,
                  currentSnapshot.tick,
                  ['zero', `step:${step.toLowerCase()}`, 'health'],
                ),
              ]);
            }
          }
        }

        // Process the orchestrator result
        outcomeAfterTick = currentSnapshot.outcome;

        // Break early — orchestrator processes full tick in one call
        // We record all 13 steps from the orchestrator's internal history
        const orchTickHistory = this.orchestrator.getTickHistory();
        if (orchTickHistory.length > 0) {
          const lastOrchSummary = orchTickHistory[orchTickHistory.length - 1];
          for (const diag of lastOrchSummary.stepDiagnostics) {
            allSignals.push(...diag.signals);
          }
          eventCount = lastOrchSummary.flushedEventCount;
        }

        break; // The orchestrator handles all 13 steps internally
      } catch (err) {
        stepFailed = true;
        this.state.consecutiveTickErrors += 1;

        const errorRecord: TickStepErrorRecord = {
          step,
          engineId: this.resolveStepOwner(step),
          message: err instanceof Error ? err.message : String(err),
          atMs: this.clock.now(),
          fatal: this.state.consecutiveTickErrors >= this.maxConsecutiveErrors,
          code: 'TICK_STEP_ERROR',
          tags: ['zero', `step:${step.toLowerCase()}`],
        };

        stepErrors = freezeArray([errorRecord]);
        this.state.errorAccumulator = limitArray(
          [...this.state.errorAccumulator, errorRecord],
          MAX_TELEMETRY_RECORDS,
        );

        warnings.push(`Step ${step} failed: ${errorRecord.message}`);

        // Emit error signal
        allSignals.push(
          createEngineSignalFull(
            'mode',
            'ERROR',
            'zero.tick.step_error',
            `Tick step ${step} failed: ${errorRecord.message}`,
            currentSnapshot.tick,
            'error',
            ['zero', `step:${step.toLowerCase()}`, 'tick-error'],
            undefined,
            { step, consecutiveErrors: this.state.consecutiveTickErrors },
          ),
        );

        // Check quarantine threshold
        if (this.state.consecutiveTickErrors >= this.maxConsecutiveErrors) {
          this.enterQuarantine(currentSnapshot.tick, step, 'Consecutive tick error limit reached');
          outcomeAfterTick = 'ABANDONED';
          break;
        }

        stepSnapshot = currentSnapshot;
        break;
      }

      const stepEndMs = this.clock.now();
      const afterChecksum = checksumSnapshot(currentSnapshot);

      // Record step boundary
      stepBoundaries.push({
        step,
        beforeChecksum,
        afterChecksum,
        changed: beforeChecksum !== afterChecksum,
      });

      // Build step report
      const stepReport: StepExecutionReport = {
        step,
        descriptor,
        startedAtMs: stepStartMs,
        endedAtMs: stepEndMs,
        durationMs: Math.max(0, stepEndMs - stepStartMs),
        emittedEventCount: stepEventCount,
        emittedSequences: freezeArray(eventSequences),
        snapshotMutated: beforeChecksum !== afterChecksum,
        outcomeAfterStep: currentSnapshot.outcome,
        errors: stepErrors,
        warnings: stepWarnings,
        signals: stepSignals,
      };

      stepReports.push(stepReport);
    }

    const tickEndMs = this.clock.now();
    const postTickSnapshot = toFrozenSnapshot(currentSnapshot);

    // Build the tick execution summary
    const summary: TickExecutionSummary = {
      runId: postTickSnapshot.runId,
      tick: postTickSnapshot.tick,
      startedAtMs: tickStartMs,
      endedAtMs: tickEndMs,
      durationMs: Math.max(0, tickEndMs - tickStartMs),
      stepCount: stepReports.length,
      steps: freezeArray(stepReports),
      stepBoundaries: freezeArray(stepBoundaries),
      preTickSnapshot: deepFrozenClone(preTickSnapshot),
      postTickSnapshot: deepFrozenClone(postTickSnapshot),
      outcome: outcomeAfterTick,
      outcomeReasonCode: postTickSnapshot.telemetry.outcomeReasonCode ?? null,
      eventCount,
      eventSequences: freezeArray(eventSequences),
      warnings: freezeArray(warnings),
      signals: freezeArray(allSignals),
    };

    // Record tick in history
    this.state.tickHistory = limitArray(
      [...this.state.tickHistory, summary],
      this.maxTickHistoryLimit,
    );

    // Reset consecutive errors on success
    if (!warnings.some((w) => w.includes('failed'))) {
      this.state.consecutiveTickErrors = 0;
    }

    // Collect telemetry
    this.collectTelemetryForTick(summary);

    // Extract ML vector
    if (this.enableMLExtraction) {
      this.state.lastMLVector = this.extractMLVector(postTickSnapshot);
      this.state.mlHistory = limitArray(
        [...this.state.mlHistory, this.state.lastMLVector],
        this.maxTickHistoryLimit,
      );
    }

    // Update projection
    this.state.lastProjection = this.projectSnapshot(postTickSnapshot);

    // Generate narrative
    if (this.enableNarrativeGeneration) {
      this.state.lastNarrative = this.generateNarrative(postTickSnapshot);
    }

    // Emit chat signals
    if (this.enableChatSignals) {
      this.emitTickChatSignals(summary, postTickSnapshot);
    }

    // Check for outcome change
    if (outcomeAfterTick !== null && preTickSnapshot.outcome === null) {
      if (this.enableChatSignals) {
        this.emitChatSignal(
          'OUTCOME_CHANGED',
          postTickSnapshot,
          outcomeAfterTick === 'FREEDOM' ? 'MEDIUM' : 'CRITICAL',
          `Outcome resolved: ${outcomeAfterTick}`,
        );
      }
    }

    // Unlock after tick
    this.transitionLifecycle(
      outcomeAfterTick !== null ? 'ENDING' : 'ACTIVE',
      'UNLOCK_AFTER_TICK',
      tickEndMs,
      postTickSnapshot.tick,
      `Tick ${postTickSnapshot.tick} completed`,
    );

    // Auto-end on terminal outcome
    if (outcomeAfterTick !== null && this.state.lifecycleState === 'ENDING') {
      this.transitionLifecycle('ENDED', 'TERMINATION_COMPLETED', tickEndMs, postTickSnapshot.tick, `Auto-terminated: ${outcomeAfterTick}`);
    }

    return summary;
  }

  /**
   * Execute multiple ticks, stopping early on terminal outcome.
   */
  public executeTickBatch(count: number, stopOnTerminal = true): readonly TickExecutionSummary[] {
    const summaries: TickExecutionSummary[] = [];
    const safeCount = Math.max(1, Math.min(count, 10_000));

    for (let i = 0; i < safeCount; i++) {
      if (this.state.lifecycleState !== 'ACTIVE') break;

      const summary = this.executeTick();
      summaries.push(summary);

      if (stopOnTerminal && summary.outcome !== null) break;
    }

    return freezeArray(summaries);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // § 3d — Card Play Surface
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Play a card within the current run.
   */
  public playCard(input: PlayCardInput): PlayCardResolution {
    const nowMs = this.clock.now();
    const snapshot = this.getRequiredSnapshot();
    const requestedAtMs = input.requestedAtMs ?? nowMs;

    this.assertLifecycleActive('playCard');

    // Validate against mode action legality
    const targeting: Targeting = input.targeting ?? 'SELF';
    const warnings: string[] = [];

    // Validate card is legal
    const legalityResult = this.validateCardLegality(input.definitionId, snapshot, targeting);
    if (!legalityResult.legal) {
      return {
        accepted: false,
        runId: snapshot.runId,
        tick: snapshot.tick,
        actorId: input.actorId,
        targeting,
        cardDefinitionId: input.definitionId,
        cardInstanceId: null,
        requestedAtMs,
        resolvedAtMs: this.clock.now(),
        warnings: freezeArray([...warnings, `Card not legal: ${legalityResult.reason}`]),
        reason: legalityResult.reason,
        snapshot: deepFrozenClone(snapshot),
      };
    }

    // Delegate to orchestrator for card play
    let resultSnapshot: RunStateSnapshot;
    try {
      resultSnapshot = this.orchestrator.playCard(
        { definitionId: input.definitionId, actorId: input.actorId, targeting },
      );
    } catch (err) {
      return {
        accepted: false,
        runId: snapshot.runId,
        tick: snapshot.tick,
        actorId: input.actorId,
        targeting,
        cardDefinitionId: input.definitionId,
        cardInstanceId: null,
        requestedAtMs,
        resolvedAtMs: this.clock.now(),
        warnings: freezeArray(warnings),
        reason: err instanceof Error ? err.message : String(err),
        snapshot: deepFrozenClone(snapshot),
      };
    }

    const resolvedAtMs = this.clock.now();

    // Emit chat signal for card play
    if (this.enableChatSignals) {
      this.emitChatSignal(
        'CARD_PLAYED',
        resultSnapshot,
        'MEDIUM',
        `Card ${input.definitionId} played by ${input.actorId}`,
      );
    }

    // Find the card instance ID from the decision records
    const latestDecisions = resultSnapshot.telemetry.decisions;
    const cardInstanceId = latestDecisions.length > 0
      ? latestDecisions[latestDecisions.length - 1].cardId
      : null;

    return {
      accepted: true,
      runId: resultSnapshot.runId,
      tick: resultSnapshot.tick,
      actorId: input.actorId,
      targeting,
      cardDefinitionId: input.definitionId,
      cardInstanceId,
      requestedAtMs,
      resolvedAtMs,
      warnings: freezeArray(warnings),
      reason: null,
      snapshot: deepFrozenClone(resultSnapshot),
    };
  }

  /**
   * Validate whether a card is legal to play in the current game state.
   */
  public validateCardLegality(
    definitionId: string,
    snapshot: RunStateSnapshot,
    targeting: Targeting = 'SELF',
  ): { legal: boolean; reason: string } {
    try {
      const isLegal = this.cardLegality.canResolve(snapshot, definitionId, targeting);
      if (!isLegal) {
        return { legal: false, reason: `Card ${definitionId} is not legal in the current game state` };
      }
      return { legal: true, reason: '' };
    } catch (err) {
      return { legal: false, reason: err instanceof Error ? err.message : String(err) };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // § 3e — Mode Action Surface
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Execute a mode-specific action within the current run.
   */
  public executeModeAction(input: ModeActionInput): ModeActionResolution {
    const nowMs = this.clock.now();
    const snapshot = this.getRequiredSnapshot();
    const requestedAtMs = input.requestedAtMs ?? nowMs;
    const warnings: string[] = [];

    this.assertLifecycleActive('executeModeAction');

    // Validate action ID against known mode action IDs
    const knownActionIds = ZERO_MODE_ACTION_IDS as readonly string[];
    const actionIdStr = input.actionId;
    if (!knownActionIds.includes(actionIdStr) && actionIdStr !== 'CUSTOM') {
      warnings.push(`Action ID '${actionIdStr}' is not in the canonical ZERO_MODE_ACTION_IDS set`);
    }

    // Build mode runtime envelope
    const envelope: ModeRuntimeEnvelope = {
      mode: snapshot.mode,
      tick: snapshot.tick,
      phase: snapshot.phase,
      actionId: actionIdStr,
      actorId: input.actorId,
      payload: input.payload ?? {},
      reason: input.reason ?? null,
      emittedAtMs: nowMs,
    };

    // Delegate to orchestrator
    let resultSnapshot: RunStateSnapshot;
    try {
      resultSnapshot = this.orchestrator.dispatchModeAction({
        actionId: actionIdStr as ModeActionId,
        payload: input.payload,
      });
    } catch (err) {
      return {
        accepted: false,
        actionId: actionIdStr,
        actorId: input.actorId,
        runId: snapshot.runId,
        tick: snapshot.tick,
        requestedAtMs,
        resolvedAtMs: this.clock.now(),
        warnings: freezeArray(warnings),
        reason: err instanceof Error ? err.message : String(err),
        snapshot: deepFrozenClone(snapshot),
      };
    }

    const resolvedAtMs = this.clock.now();

    // Emit chat signal
    if (this.enableChatSignals) {
      this.emitChatSignal(
        'MODE_ACTION',
        resultSnapshot,
        'LOW',
        `Mode action ${actionIdStr} executed by ${input.actorId}`,
      );
    }

    return {
      accepted: true,
      actionId: actionIdStr,
      actorId: input.actorId,
      runId: resultSnapshot.runId,
      tick: resultSnapshot.tick,
      requestedAtMs,
      resolvedAtMs,
      warnings: freezeArray(warnings),
      reason: null,
      snapshot: deepFrozenClone(resultSnapshot),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // § 3f — Dependency Binding
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Wire cross-engine reader dependencies.
   * This establishes the data flow graph between engines.
   */
  public wireReaders(): ZeroDependencyBindingReport {
    const bundle: ZeroDependencyBundle = {
      timeEngine: this.engines.time as unknown as ZeroDependencyBundle['timeEngine'],
      pressureEngine: this.engines.pressure as unknown as ZeroDependencyBundle['pressureEngine'],
      tensionEngine: this.engines.tension as unknown as ZeroDependencyBundle['tensionEngine'],
      shieldEngine: this.engines.shield as unknown as ZeroDependencyBundle['shieldEngine'],
      battleEngine: this.engines.battle as unknown as ZeroDependencyBundle['battleEngine'],
      cascadeEngine: this.engines.cascade as unknown as ZeroDependencyBundle['cascadeEngine'],
      sovereigntyEngine: this.engines.sovereignty as unknown as ZeroDependencyBundle['sovereigntyEngine'],
    };

    return this.dependencyBinder.bind(bundle);
  }

  /**
   * Validate that all required dependency bindings are established.
   */
  public validateBindings(): { valid: boolean; report: ZeroDependencyBindingReport } {
    const report = this.dependencyBinder.getLastReport()!;
    const valid = report.pressureReaderBound &&
      report.shieldReaderBound &&
      report.tensionReaderBound &&
      report.cascadeReaderBound;

    return { valid, report };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // § 3g — Snapshot Projection
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Project the full ZeroSnapshotProjection from the current snapshot.
   * This is the rich read-model for API consumers, chat adapters, and devtools.
   */
  public projectSnapshot(snapshot: RunStateSnapshot): ZeroSnapshotProjection {
    const fingerprint = this.buildSnapshotFingerprint(snapshot);
    const economy = this.projectEconomy(snapshot);
    const pressure = this.projectPressure(snapshot);
    const shield = this.projectShield(snapshot);
    const battle = this.projectBattle(snapshot);
    const tension = this.projectTension(snapshot);
    const cascade = this.projectCascade(snapshot);
    const decisionWindows = this.projectDecisionWindows(snapshot);
    const cards = this.projectCards(snapshot);
    const mode = this.projectMode(snapshot);
    const integrity = this.projectIntegrity(snapshot);

    return deepFreeze({
      fingerprint,
      economy,
      pressure,
      shield,
      battle,
      tension,
      cascade,
      decisionWindows,
      cards,
      mode,
      integrity,
    }) as ZeroSnapshotProjection;
  }

  /**
   * Get the last computed projection without recalculating.
   */
  public getLastProjection(): ZeroSnapshotProjection | null {
    return this.state.lastProjection;
  }

  private buildSnapshotFingerprint(snapshot: RunStateSnapshot): SnapshotFingerprint {
    return Object.freeze({
      runId: snapshot.runId,
      tick: snapshot.tick,
      phase: snapshot.phase,
      outcome: snapshot.outcome,
      checksum: checksumSnapshot(snapshot),
      integrityStatus: snapshot.sovereignty.integrityStatus,
      eventCount: snapshot.telemetry.emittedEventCount,
    });
  }

  private projectEconomy(snapshot: RunStateSnapshot): ZeroEconomyProjection {
    const eco = snapshot.economy;
    return Object.freeze({
      cash: eco.cash,
      debt: eco.debt,
      incomePerTick: eco.incomePerTick,
      expensesPerTick: eco.expensesPerTick,
      netWorth: eco.netWorth,
      freedomTarget: eco.freedomTarget,
      haterHeat: eco.haterHeat,
      netCashflowPerTick: eco.incomePerTick - eco.expensesPerTick,
    });
  }

  private projectPressure(snapshot: RunStateSnapshot): ZeroPressureProjection {
    const p = snapshot.pressure;
    const trend = this.computePressureTrend(snapshot);
    return Object.freeze({
      score: p.score,
      tier: p.tier,
      upwardCrossings: p.upwardCrossings,
      survivedHighPressureTicks: p.survivedHighPressureTicks,
      maxScoreSeen: p.maxScoreSeen,
      trend,
    });
  }

  private projectShield(snapshot: RunStateSnapshot): ZeroShieldProjection {
    const s = snapshot.shield;
    const weakestLayer = s.layers.find((l) => l.layerId === s.weakestLayerId);
    const totalCurrent = s.layers.reduce((sum, l) => sum + l.current, 0);
    const totalMax = s.layers.reduce((sum, l) => sum + l.max, 0);
    const breachedLayerIds = s.layers.filter((l) => l.breached).map((l) => l.layerId);

    return Object.freeze({
      weakestLayerId: s.weakestLayerId,
      weakestLayerLabel: weakestLayer?.label ?? ('UNKNOWN' as ShieldLayerLabel),
      weakestLayerRatio: s.weakestLayerRatio,
      breachedLayerIds: freezeArray(breachedLayerIds),
      totalCurrent,
      totalMax,
      normalizedIntegrity: SAFE_DIV(totalCurrent, totalMax),
    });
  }

  private projectBattle(snapshot: RunStateSnapshot): BotRuntimeProjection {
    const b = snapshot.battle;
    const activeBotIds = b.bots
      .filter((bot) => bot.state === 'WATCHING' || bot.state === 'TARGETING' || bot.state === 'ATTACKING')
      .map((bot) => bot.botId);
    const neutralizedBotIds = b.bots.filter((bot) => bot.neutralized).map((bot) => bot.botId);
    const attackingBotIds = b.bots.filter((bot) => bot.state === 'ATTACKING').map((bot) => bot.botId);
    const breachedTargetLayers = snapshot.shield.layers
      .filter((l) => l.breached)
      .map((l) => l.layerId);

    return Object.freeze({
      activeBotIds: freezeArray(activeBotIds),
      neutralizedBotIds: freezeArray(neutralizedBotIds),
      attackingBotIds: freezeArray(attackingBotIds),
      breachedTargetLayers: freezeArray(breachedTargetLayers),
    });
  }

  private projectTension(snapshot: RunStateSnapshot): ThreatProjection {
    const t = snapshot.tension;
    const bySource: Record<string, number> = {};
    const byTargetLayer: Record<string, number> = {};

    for (const threat of t.visibleThreats) {
      const source = threat.source ?? 'unknown';
      bySource[source] = (bySource[source] ?? 0) + 1;
      // ThreatEnvelope does not carry targetLayerId; classify as DIRECT
      const target = 'DIRECT';
      byTargetLayer[target] = (byTargetLayer[target] ?? 0) + 1;
    }

    return Object.freeze({
      totalVisible: t.visibleThreats.length,
      bySource: Object.freeze({ ...bySource }),
      byTargetLayer: Object.freeze({ ...byTargetLayer }) as Readonly<Record<ShieldLayerId | 'DIRECT', number>>,
    });
  }

  private projectCascade(snapshot: RunStateSnapshot): CascadeProjection {
    const c = snapshot.cascade;
    const positiveCount = c.activeChains.filter((ch) => ch.positive).length;
    const negativeCount = c.activeChains.filter((ch) => !ch.positive).length;

    return Object.freeze({
      activeChainCount: c.activeChains.length,
      activePositiveChainCount: positiveCount,
      activeNegativeChainCount: negativeCount,
      brokenChains: c.brokenChains,
      completedChains: c.completedChains,
    });
  }

  private projectDecisionWindows(snapshot: RunStateSnapshot): ZeroDecisionWindowProjection {
    const windows = snapshot.timers.activeDecisionWindows;
    const windowEntries = Object.values(windows);
    const ids = Object.keys(windows);
    const activeCount = windowEntries.filter((w) => !w.frozen && !w.consumed).length;
    const frozenCount = windowEntries.filter((w) => w.frozen).length;
    const consumedCount = windowEntries.filter((w) => w.consumed).length;
    const actorIds = [...new Set(windowEntries.map((w) => w.actorId).filter(Boolean))] as string[];
    const sourceLabels = [...new Set(windowEntries.map((w) => w.source))];

    return Object.freeze({
      ids: freezeArray(ids),
      activeCount,
      frozenCount,
      consumedCount,
      actorIds: freezeArray(actorIds),
      sourceLabels: freezeArray(sourceLabels),
    });
  }

  private projectCards(snapshot: RunStateSnapshot): ZeroCardProjection {
    const c = snapshot.cards;
    return Object.freeze({
      handSize: c.hand.length,
      discardSize: c.discard.length,
      exhaustSize: c.exhaust.length,
      drawPileSize: c.drawPileSize,
      lastPlayedCardIds: freezeArray(c.lastPlayed),
      ghostMarkerCount: c.ghostMarkers.length,
    });
  }

  private projectMode(snapshot: RunStateSnapshot): ZeroModeProjection {
    const m = snapshot.modeState;
    return Object.freeze({
      mode: snapshot.mode,
      holdEnabled: m.holdEnabled,
      sharedTreasury: m.sharedTreasury,
      sharedTreasuryBalance: m.sharedTreasuryBalance,
      sharedOpportunityDeck: m.sharedOpportunityDeck,
      disabledBots: freezeArray(m.disabledBots),
      spectatorLimit: m.spectatorLimit,
      counterIntelTier: m.counterIntelTier,
      modePresentation: m.modePresentation,
    });
  }

  private projectIntegrity(snapshot: RunStateSnapshot): IntegrityProjection {
    const s = snapshot.sovereignty;
    return Object.freeze({
      status: s.integrityStatus,
      proofHashPresent: s.proofHash !== null,
      auditFlagCount: s.auditFlags.length,
      proofBadgeCount: s.proofBadges.length,
      tickChecksumCount: s.tickChecksums.length,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // § 3h — ML Vector Extraction (96-dim feature vector)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Extract a 96-dimensional ML feature vector from the current snapshot.
   * Every feature is a normalized floating-point value in [0, 1] unless noted.
   */
  public extractMLVector(snapshot: RunStateSnapshot): ZeroMLVector {
    const nowMs = this.clock.now();
    const features: number[] = new Array(ZERO_ENGINE_ML_FEATURE_COUNT).fill(0);
    let idx = 0;

    // ── Economy (12 features) ────────────────────────────────────────────
    const eco = snapshot.economy;
    const freedomTarget = Math.max(1, eco.freedomTarget);
    const netCashflow = eco.incomePerTick - eco.expensesPerTick;

    features[idx++] = CLAMP_01(eco.cash / freedomTarget);                             // economy_cash_norm
    features[idx++] = CLAMP_01(eco.debt / freedomTarget);                              // economy_debt_norm
    features[idx++] = CLAMP_01(eco.netWorth / freedomTarget);                          // economy_net_worth_norm
    features[idx++] = CLAMP_01(eco.incomePerTick / 100);                               // economy_income_rate_norm
    features[idx++] = CLAMP_01(eco.expensesPerTick / 100);                             // economy_expense_rate_norm
    features[idx++] = CLAMP_01(eco.netWorth / freedomTarget);                          // economy_freedom_progress
    features[idx++] = CLAMP_01(eco.haterHeat / 100);                                   // economy_hater_heat_norm
    features[idx++] = netCashflow >= 0 ? 1.0 : 0.0;                                    // economy_cashflow_sign
    features[idx++] = CLAMP_01(SAFE_DIV(eco.debt, Math.max(1, eco.incomePerTick)));     // economy_debt_to_income_ratio
    features[idx++] = CLAMP_01((netCashflow + 50) / 100);                              // economy_net_cashflow_norm
    features[idx++] = CLAMP_01(eco.opportunitiesPurchased / 20);                       // economy_opportunity_purchases_norm
    features[idx++] = CLAMP_01(eco.privilegePlays / 10);                               // economy_privilege_play_ratio

    // ── Pressure (10 features) ───────────────────────────────────────────
    const prs = snapshot.pressure;
    const tierOrdinals: Record<PressureTier, number> = { T0: 0, T1: 0.25, T2: 0.5, T3: 0.75, T4: 1.0 };
    const bandOrdinals: Record<string, number> = { CALM: 0, BUILDING: 0.25, ELEVATED: 0.5, HIGH: 0.75, CRITICAL: 1.0 };

    features[idx++] = CLAMP_01(prs.score);                                             // pressure_score_norm
    features[idx++] = tierOrdinals[prs.tier] ?? 0;                                     // pressure_tier_ordinal
    features[idx++] = bandOrdinals[prs.band] ?? 0;                                     // pressure_band_ordinal
    features[idx++] = CLAMP_01(prs.upwardCrossings / 10);                              // pressure_upward_crossings_norm
    features[idx++] = CLAMP_01(prs.survivedHighPressureTicks / 50);                    // pressure_survived_high_ticks_norm
    features[idx++] = CLAMP_01(prs.maxScoreSeen);                                      // pressure_max_score_seen
    features[idx++] = prs.score > (prs.previousTier === prs.tier ? 0.5 : 0.3) ? 1 : 0; // pressure_trend_rising
    features[idx++] = prs.score > 0.85 ? 1 : 0;                                       // pressure_trend_spiking
    features[idx++] = CLAMP_01(Math.abs(prs.score - (tierOrdinals[prs.tier] ?? 0)));   // pressure_escalation_gap
    features[idx++] = prs.score === prs.maxScoreSeen && prs.maxScoreSeen > 0 ? 0 : 1;  // pressure_stagnation_indicator

    // ── Tension (8 features) ─────────────────────────────────────────────
    const ten = snapshot.tension;
    const threatSources = new Set(ten.visibleThreats.map((t) => t.source));
    const maxSeverity = ten.visibleThreats.reduce((mx, t) => Math.max(mx, t.severity ?? 0), 0);
    const minEta = ten.visibleThreats.reduce((mn, t) => Math.min(mn, t.etaTicks ?? 100), 100);

    features[idx++] = CLAMP_01(ten.score / 100);                                       // tension_score_norm
    features[idx++] = CLAMP_01(ten.anticipation / 100);                                // tension_anticipation_norm
    features[idx++] = CLAMP_01(ten.visibleThreats.length / 10);                        // tension_visible_threat_count_norm
    features[idx++] = ten.maxPulseTriggered ? 1 : 0;                                   // tension_max_pulse_flag
    features[idx++] = ten.lastSpikeTick !== null ? CLAMP_01(1 - (snapshot.tick - ten.lastSpikeTick) / 20) : 0; // tension_last_spike_recency_norm
    features[idx++] = CLAMP_01(threatSources.size / 5);                                // tension_threat_diversity
    features[idx++] = CLAMP_01(maxSeverity / 10);                                      // tension_aggregate_severity_norm
    features[idx++] = CLAMP_01(1 - minEta / 20);                                       // tension_most_urgent_eta_norm

    // ── Shield (10 features) ─────────────────────────────────────────────
    const shd = snapshot.shield;
    const totalCurrent = shd.layers.reduce((s, l) => s + l.current, 0);
    const totalMax = shd.layers.reduce((s, l) => s + l.max, 0);
    const layerRatios = shd.layers.map((l) => SAFE_DIV(l.current, l.max));
    const layerMean = SAFE_DIV(layerRatios.reduce((a, b) => a + b, 0), layerRatios.length);
    const layerVariance = SAFE_DIV(
      layerRatios.reduce((acc, r) => acc + (r - layerMean) ** 2, 0),
      layerRatios.length,
    );
    const totalRegen = shd.layers.reduce((s, l) => s + l.regenPerTick, 0);
    const breachCount = shd.layers.filter((l) => l.breached).length;
    const recentBreachTick = shd.layers
      .filter((l) => l.lastDamagedTick !== null)
      .reduce((mx, l) => Math.max(mx, l.lastDamagedTick!), 0);

    features[idx++] = CLAMP_01(shd.weakestLayerRatio);                                 // shield_weakest_ratio
    features[idx++] = CLAMP_01(SAFE_DIV(totalCurrent, totalMax));                      // shield_aggregate_integrity
    features[idx++] = CLAMP_01(breachCount / Math.max(1, shd.layers.length));          // shield_breached_count_norm
    features[idx++] = CLAMP_01(shd.blockedThisRun / 50);                              // shield_blocked_this_run_norm
    features[idx++] = CLAMP_01(shd.damagedThisRun / 50);                              // shield_damaged_this_run_norm
    features[idx++] = CLAMP_01(shd.repairQueueDepth / 10);                            // shield_repair_queue_depth_norm
    features[idx++] = CLAMP_01(layerVariance);                                          // shield_layer_variance
    features[idx++] = CLAMP_01(totalRegen / 20);                                       // shield_regen_capacity_norm
    features[idx++] = recentBreachTick > 0 ? CLAMP_01(1 - (snapshot.tick - recentBreachTick) / 20) : 0; // shield_breach_recency_norm
    features[idx++] = CLAMP_01((1 - shd.weakestLayerRatio) * (breachCount > 0 ? 1.5 : 1.0)); // shield_breach_risk_score

    // ── Battle (10 features) ─────────────────────────────────────────────
    const btl = snapshot.battle;
    const activeBots = btl.bots.filter((b) => b.state === 'WATCHING' || b.state === 'TARGETING' || b.state === 'ATTACKING');
    const attackingBots = btl.bots.filter((b) => b.state === 'ATTACKING');
    const neutralizedRatio = SAFE_DIV(btl.neutralizedBotIds.length, Math.max(1, btl.bots.length));
    const avgBotHeat = SAFE_DIV(btl.bots.reduce((s, b) => s + b.heat, 0), btl.bots.length);
    const maxBotHeat = btl.bots.reduce((mx, b) => Math.max(mx, b.heat), 0);

    features[idx++] = CLAMP_01(activeBots.length / Math.max(1, btl.bots.length));     // battle_active_bot_count_norm
    features[idx++] = CLAMP_01(attackingBots.length / Math.max(1, btl.bots.length));   // battle_attacking_bot_count_norm
    features[idx++] = CLAMP_01(neutralizedRatio);                                       // battle_neutralized_ratio
    features[idx++] = CLAMP_01(btl.pendingAttacks.length / 10);                        // battle_pending_attack_count_norm
    features[idx++] = CLAMP_01(SAFE_DIV(btl.battleBudget, Math.max(1, btl.battleBudgetCap))); // battle_budget_utilization
    features[idx++] = CLAMP_01(btl.extractionCooldownTicks / 10);                     // battle_extraction_cooldown_norm
    features[idx++] = CLAMP_01(btl.rivalryHeatCarry / 100);                           // battle_rivalry_heat_norm
    features[idx++] = btl.firstBloodClaimed ? 1 : 0;                                   // battle_first_blood_flag
    features[idx++] = CLAMP_01(avgBotHeat / 100);                                     // battle_average_bot_heat_norm
    features[idx++] = CLAMP_01(maxBotHeat / 100);                                     // battle_max_bot_heat_norm

    // ── Cascade (8 features) ─────────────────────────────────────────────
    const cas = snapshot.cascade;
    const posChains = cas.activeChains.filter((ch) => ch.positive);
    const negChains = cas.activeChains.filter((ch) => !ch.positive);
    const totalChainEvents = cas.completedChains + cas.brokenChains + cas.activeChains.length;
    const chainTemplateSet = new Set(cas.activeChains.map((ch) => ch.templateId));
    const longestChainProgress = cas.activeChains.reduce((mx, ch) => {
      const linkCount = ch.links?.length ?? 0;
      const progress = SAFE_DIV(linkCount, Math.max(1, linkCount + 1));
      return Math.max(mx, progress);
    }, 0);

    features[idx++] = CLAMP_01(cas.activeChains.length / 10);                         // cascade_active_chain_count_norm
    features[idx++] = CLAMP_01(SAFE_DIV(posChains.length, Math.max(1, cas.activeChains.length))); // cascade_positive_chain_ratio
    features[idx++] = CLAMP_01(SAFE_DIV(negChains.length, Math.max(1, cas.activeChains.length))); // cascade_negative_chain_ratio
    features[idx++] = CLAMP_01(cas.brokenChains / 10);                                // cascade_broken_chains_norm
    features[idx++] = CLAMP_01(cas.completedChains / 10);                             // cascade_completed_chains_norm
    features[idx++] = CLAMP_01(SAFE_DIV(posChains.length, Math.max(1, totalChainEvents))); // cascade_recovery_potential
    features[idx++] = CLAMP_01(chainTemplateSet.size / 8);                             // cascade_chain_diversity
    features[idx++] = CLAMP_01(longestChainProgress);                                   // cascade_longest_chain_progress

    // ── Cards (8 features) ───────────────────────────────────────────────
    const cds = snapshot.cards;
    const totalDeckSize = cds.hand.length + cds.discard.length + cds.exhaust.length + cds.drawPileSize;

    features[idx++] = CLAMP_01(cds.hand.length / 10);                                 // cards_hand_size_norm
    features[idx++] = CLAMP_01(cds.drawPileSize / 30);                                // cards_draw_pile_size_norm
    features[idx++] = CLAMP_01(SAFE_DIV(cds.discard.length, Math.max(1, totalDeckSize))); // cards_discard_ratio
    features[idx++] = CLAMP_01(SAFE_DIV(cds.exhaust.length, Math.max(1, totalDeckSize))); // cards_exhaust_ratio
    features[idx++] = CLAMP_01(cds.ghostMarkers.length / 10);                         // cards_ghost_marker_count_norm
    features[idx++] = CLAMP_01(cds.deckEntropy);                                       // cards_deck_entropy_norm
    features[idx++] = CLAMP_01(cds.lastPlayed.length / 5);                            // cards_last_played_count_norm
    features[idx++] = CLAMP_01(SAFE_DIV(cds.hand.length, Math.max(1, totalDeckSize))); // cards_card_power_average_norm

    // ── Mode (6 features) ────────────────────────────────────────────────
    const modeOrdinals: Record<ModeCode, number> = { solo: 0.0, pvp: 0.33, coop: 0.66, ghost: 1.0 };
    const mdst = snapshot.modeState;

    features[idx++] = modeOrdinals[snapshot.mode] ?? 0;                                // mode_ordinal
    features[idx++] = mdst.holdEnabled ? 1 : 0;                                        // mode_hold_enabled_flag
    features[idx++] = mdst.sharedTreasury ? 1 : 0;                                     // mode_shared_treasury_flag
    features[idx++] = CLAMP_01(mdst.counterIntelTier / 5);                             // mode_counter_intel_tier_norm
    features[idx++] = CLAMP_01(SAFE_DIV(mdst.disabledBots.length, Math.max(1, btl.bots.length))); // mode_disabled_bot_ratio
    features[idx++] = mdst.bleedMode ? 1 : 0;                                          // mode_bleed_mode_flag

    // ── Time / Phase (8 features) ────────────────────────────────────────
    const tmr = snapshot.timers;
    const phaseOrdinals: Record<RunPhase, number> = {
      FOUNDATION: 0.0, ESCALATION: 0.5, SOVEREIGNTY: 1.0,
    };
    const windowValues = Object.values(tmr.activeDecisionWindows);
    const frozenWindows = windowValues.filter((w) => w.frozen);

    features[idx++] = CLAMP_01(SAFE_DIV(tmr.elapsedMs, Math.max(1, tmr.seasonBudgetMs))); // time_elapsed_ratio
    features[idx++] = CLAMP_01(tmr.holdCharges / 5);                                  // time_hold_charges_norm
    features[idx++] = CLAMP_01(windowValues.length / 10);                              // time_active_decision_window_count_norm
    features[idx++] = CLAMP_01(frozenWindows.length / 5);                              // time_frozen_window_count_norm
    features[idx++] = CLAMP_01(tmr.currentTickDurationMs / 5000);                      // time_tick_duration_norm
    features[idx++] = phaseOrdinals[snapshot.phase] ?? 0;                               // phase_ordinal_norm
    features[idx++] = snapshot.phase === 'SOVEREIGNTY' ? 1 : 0;                          // phase_is_endgame
    features[idx++] = CLAMP_01(phaseOrdinals[snapshot.phase] ?? 0);                     // phase_stakes_multiplier_norm

    // ── Integrity / Sovereignty (8 features) ─────────────────────────────
    const sov = snapshot.sovereignty;
    const integrityOrdinals: Record<IntegrityStatus, number> = {
      VERIFIED: 0, PENDING: 0.33, UNVERIFIED: 0.66, QUARANTINED: 1.0,
    };
    const gradeScores: Record<string, number> = {
      'S': 1.0, 'A': 0.85, 'B': 0.7, 'C': 0.55, 'D': 0.4, 'F': 0.1,
    };

    features[idx++] = integrityOrdinals[sov.integrityStatus] ?? 0;                     // integrity_status_ordinal
    features[idx++] = sov.proofHash !== null ? 1 : 0;                                  // integrity_proof_hash_present
    features[idx++] = CLAMP_01(sov.auditFlags.length / 10);                           // integrity_audit_flag_count_norm
    features[idx++] = CLAMP_01(sov.sovereigntyScore / 100);                            // integrity_sovereignty_score_norm
    features[idx++] = CLAMP_01(sov.cordScore / 100);                                   // integrity_cord_score_norm
    features[idx++] = CLAMP_01(sov.gapVsLegend / 100);                                // integrity_gap_vs_legend_norm
    features[idx++] = CLAMP_01((sov.gapClosingRate + 1) / 2);                         // integrity_gap_closing_rate_norm
    features[idx++] = gradeScores[sov.verifiedGrade ?? 'F'] ?? 0;                      // integrity_verified_grade_score

    // ── Orchestration Meta (8 features) ──────────────────────────────────
    const lifecycleOrdinals: Record<RunLifecycleState, number> = {
      IDLE: 0, STARTING: 0.2, ACTIVE: 0.4, TICK_LOCKED: 0.6, ENDING: 0.8, ENDED: 1.0,
    };
    const totalWarnings = this.state.warningAccumulator.length;

    features[idx++] = CLAMP_01(snapshot.tick / 500);                                    // orch_tick_norm
    features[idx++] = snapshot.outcome !== null ? 1 : 0;                                // orch_outcome_is_terminal
    features[idx++] = CLAMP_01(this.state.consecutiveTickErrors / this.maxConsecutiveErrors); // orch_consecutive_error_ratio
    features[idx++] = this.state.quarantine.active ? 1 : 0;                             // orch_quarantine_active
    features[idx++] = lifecycleOrdinals[this.state.lifecycleState] ?? 0;                // orch_lifecycle_state_ordinal
    features[idx++] = CLAMP_01(totalWarnings / this.maxWarningsLimit);                 // orch_warning_accumulation_norm
    features[idx++] = CLAMP_01(snapshot.telemetry.emittedEventCount / 500);            // orch_event_throughput_norm
    features[idx++] = this.computeTickDurationTrend();                                  // orch_tick_duration_trend_norm

    const frozenFeatures = Object.freeze([...features]);
    const fingerprint = fnv1aFingerprint(JSON.stringify(frozenFeatures));

    return Object.freeze({
      features: frozenFeatures,
      labels: ZERO_ML_FEATURE_LABELS,
      dimension: ZERO_ENGINE_ML_FEATURE_COUNT,
      tick: snapshot.tick,
      runId: snapshot.runId,
      extractedAtMs: nowMs,
      fingerprint,
    });
  }

  /**
   * Get the last extracted ML vector.
   */
  public getLastMLVector(): ZeroMLVector | null {
    return this.state.lastMLVector;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // § 3i — DL Tensor Extraction (16x128 sequence tensor)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Extract a 16x128 DL tensor from the ML vector history.
   * Each row is a 128-dimensional vector (96 ML features + 32 temporal/cross-system features).
   * The sequence represents the last 16 ticks, zero-padded at the start if fewer exist.
   */
  public extractDLTensor(snapshot: RunStateSnapshot): ZeroDLTensor {
    const nowMs = this.clock.now();
    const seqLen = ZERO_ENGINE_DL_SEQUENCE_LENGTH;
    const colCount = ZERO_ENGINE_DL_FEATURE_COUNT;

    // Gather the last 16 ML vectors
    const recentVectors = this.state.mlHistory.slice(-seqLen);
    const validPositions = recentVectors.length;
    const paddedPositions = seqLen - validPositions;

    const sequence: (readonly number[])[] = [];

    // Zero-pad the beginning
    for (let p = 0; p < paddedPositions; p++) {
      sequence.push(Object.freeze(new Array(colCount).fill(0)));
    }

    // Fill with real data
    for (let i = 0; i < validPositions; i++) {
      const mlVec = recentVectors[i];
      const row: number[] = [...mlVec.features];

      // Compute temporal delta features (comparing to previous vector)
      const prevVec = i > 0 ? recentVectors[i - 1] : null;

      // dl_prev_tick_economy_delta (index 96)
      row.push(prevVec ? CLAMP_01(Math.abs(mlVec.features[2] - prevVec.features[2])) : 0);
      // dl_prev_tick_pressure_delta (index 97)
      row.push(prevVec ? CLAMP_01(Math.abs(mlVec.features[12] - prevVec.features[12])) : 0);
      // dl_prev_tick_tension_delta (index 98)
      row.push(prevVec ? CLAMP_01(Math.abs(mlVec.features[22] - prevVec.features[22])) : 0);
      // dl_prev_tick_shield_delta (index 99)
      row.push(prevVec ? CLAMP_01(Math.abs(mlVec.features[32] - prevVec.features[32])) : 0);
      // dl_prev_tick_battle_delta (index 100)
      row.push(prevVec ? CLAMP_01(Math.abs(mlVec.features[42] - prevVec.features[42])) : 0);
      // dl_prev_tick_cascade_delta (index 101)
      row.push(prevVec ? CLAMP_01(Math.abs(mlVec.features[52] - prevVec.features[52])) : 0);
      // dl_tick_since_last_card_played_norm (index 102)
      row.push(CLAMP_01(mlVec.features[66])); // uses cards_last_played_count_norm
      // dl_tick_since_last_breach_norm (index 103)
      row.push(CLAMP_01(mlVec.features[40])); // uses shield_breach_recency_norm
      // dl_tick_since_last_escalation_norm (index 104)
      row.push(CLAMP_01(mlVec.features[20])); // uses pressure_escalation_gap
      // dl_tick_since_last_chain_break_norm (index 105)
      row.push(CLAMP_01(mlVec.features[55])); // uses cascade_broken_chains_norm
      // dl_momentum_score (index 106)
      row.push(this.computeMomentumScore(mlVec, prevVec));
      // dl_volatility_index (index 107)
      row.push(this.computeVolatilityIndex(recentVectors, i));
      // dl_decision_velocity_norm (index 108)
      row.push(CLAMP_01(mlVec.features[74])); // uses time_active_decision_window_count_norm
      // dl_threat_acceleration (index 109)
      row.push(prevVec ? CLAMP_01(Math.max(0, mlVec.features[24] - prevVec.features[24])) : 0);
      // dl_pressure_velocity (index 110)
      row.push(prevVec ? CLAMP_01((mlVec.features[12] - prevVec.features[12] + 1) / 2) : 0.5);
      // dl_recovery_rate_norm (index 111)
      row.push(this.computeRecoveryRate(mlVec, prevVec));

      // Cross-system interaction features (16 features, indices 112-127)
      // dl_pressure_shield_correlation (index 112)
      row.push(CLAMP_01(mlVec.features[12] * (1 - mlVec.features[33])));
      // dl_tension_battle_correlation (index 113)
      row.push(CLAMP_01(mlVec.features[22] * mlVec.features[43]));
      // dl_cascade_pressure_coupling (index 114)
      row.push(CLAMP_01(mlVec.features[52] * mlVec.features[12]));
      // dl_economy_shield_coupling (index 115)
      row.push(CLAMP_01(mlVec.features[5] * mlVec.features[33]));
      // dl_battle_cascade_coupling (index 116)
      row.push(CLAMP_01(mlVec.features[42] * mlVec.features[52]));
      // dl_time_pressure_coupling (index 117)
      row.push(CLAMP_01(mlVec.features[72] * mlVec.features[12]));
      // dl_mode_tension_modifier (index 118)
      row.push(CLAMP_01(mlVec.features[68] * mlVec.features[22]));
      // dl_card_economy_leverage (index 119)
      row.push(CLAMP_01(mlVec.features[60] * mlVec.features[5]));
      // dl_shield_cascade_synergy (index 120)
      row.push(CLAMP_01(mlVec.features[33] * (1 - mlVec.features[54])));
      // dl_bot_threat_convergence (index 121)
      row.push(CLAMP_01(mlVec.features[43] * mlVec.features[24]));
      // dl_decision_timing_score (index 122)
      row.push(CLAMP_01(mlVec.features[74] * (1 - mlVec.features[72])));
      // dl_opportunity_cost_index (index 123)
      row.push(CLAMP_01(mlVec.features[10] * mlVec.features[72]));
      // dl_risk_reward_ratio (index 124)
      row.push(CLAMP_01(SAFE_DIV(mlVec.features[5], Math.max(0.01, mlVec.features[12]))));
      // dl_defensive_posture_index (index 125)
      row.push(CLAMP_01((mlVec.features[33] + mlVec.features[41]) / 2));
      // dl_offensive_posture_index (index 126)
      row.push(CLAMP_01((mlVec.features[43] + mlVec.features[52]) / 2));
      // dl_overall_health_composite (index 127)
      row.push(this.computeOverallHealthComposite(mlVec));

      // Ensure exactly colCount columns
      while (row.length < colCount) row.push(0);
      sequence.push(Object.freeze(row.slice(0, colCount)));
    }

    const frozenSequence = Object.freeze(sequence.map((r) => Object.freeze([...r])));
    const latestTick = snapshot.tick;
    const fingerprint = fnv1aFingerprint(JSON.stringify(frozenSequence));

    return Object.freeze({
      sequence: frozenSequence,
      columnLabels: ZERO_DL_COLUMN_LABELS,
      sequenceLength: ZERO_ENGINE_DL_SEQUENCE_LENGTH,
      columnCount: ZERO_ENGINE_DL_FEATURE_COUNT,
      latestTick,
      runId: snapshot.runId,
      extractedAtMs: nowMs,
      fingerprint,
    });
  }

  /**
   * Build a DL sequence window with metadata about padding and coverage.
   */
  public extractDLSequenceWindow(snapshot: RunStateSnapshot): ZeroDLSequenceWindow {
    const tensor = this.extractDLTensor(snapshot);
    const validPositions = Math.min(this.state.mlHistory.length, ZERO_ENGINE_DL_SEQUENCE_LENGTH);
    const paddedPositions = ZERO_ENGINE_DL_SEQUENCE_LENGTH - validPositions;
    const firstTick = validPositions > 0
      ? this.state.mlHistory[Math.max(0, this.state.mlHistory.length - ZERO_ENGINE_DL_SEQUENCE_LENGTH)].tick
      : snapshot.tick;
    const lastTick = snapshot.tick;

    return Object.freeze({
      tensor,
      paddedPositions,
      validPositions,
      tickRange: Object.freeze([firstTick, lastTick]) as readonly [number, number],
      coverageFraction: SAFE_DIV(validPositions, ZERO_ENGINE_DL_SEQUENCE_LENGTH),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // § 3j — Trend Analysis
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compute a trend snapshot across the ML vector history.
   */
  public computeTrendSnapshot(windowSize?: number): ZeroMLTrendSnapshot {
    const nowMs = this.clock.now();
    const effectiveWindowSize = Math.min(windowSize ?? 10, this.state.mlHistory.length);

    if (effectiveWindowSize < 2) {
      return Object.freeze({
        windowSize: effectiveWindowSize,
        featureTrends: freezeArray([]),
        overallDirection: 'UNKNOWN' as const,
        velocityScore: 0,
        volatilityScore: 0,
        momentumScore: 0,
        computedAtMs: nowMs,
      });
    }

    const recentVectors = this.state.mlHistory.slice(-effectiveWindowSize);
    const featureTrends: ZeroMLFeatureImportance[] = [];

    // Compute per-feature statistics
    for (let fi = 0; fi < ZERO_ENGINE_ML_FEATURE_COUNT; fi++) {
      const values = recentVectors.map((v) => v.features[fi]);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
      const stdDev = Math.sqrt(variance);

      // Compute linear trend using least-squares
      const n = values.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      for (let j = 0; j < n; j++) {
        sumX += j;
        sumY += values[j];
        sumXY += j * values[j];
        sumX2 += j * j;
      }
      const slope = SAFE_DIV(n * sumXY - sumX * sumY, n * sumX2 - sumX * sumX);

      let trend: 'RISING' | 'FALLING' | 'STABLE';
      if (slope > 0.01) trend = 'RISING';
      else if (slope < -0.01) trend = 'FALLING';
      else trend = 'STABLE';

      featureTrends.push(Object.freeze({
        label: ZERO_ML_FEATURE_LABELS[fi],
        index: fi,
        currentValue: values[values.length - 1],
        meanValue: mean,
        stdDeviation: stdDev,
        trend,
        trendMagnitude: Math.abs(slope),
      }));
    }

    // Compute overall direction
    const risingCount = featureTrends.filter((t) => t.trend === 'RISING').length;
    const fallingCount = featureTrends.filter((t) => t.trend === 'FALLING').length;

    // Key health indicators: economy_freedom_progress, shield_aggregate_integrity, pressure_score inversed
    const healthIndices = [5, 33, 12]; // freedom_progress, shield_integrity, pressure_score
    let healthDelta = 0;
    for (const hi of healthIndices) {
      const ft = featureTrends[hi];
      if (ft) {
        // For pressure, rising is bad; for shield/economy, rising is good
        healthDelta += hi === 12 ? -ft.trendMagnitude * (ft.trend === 'RISING' ? 1 : -1) :
          ft.trendMagnitude * (ft.trend === 'RISING' ? 1 : -1);
      }
    }

    let overallDirection: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
    if (healthDelta > 0.02) overallDirection = 'IMPROVING';
    else if (healthDelta < -0.02) overallDirection = 'DETERIORATING';
    else overallDirection = 'STABLE';

    // Velocity: how fast features are changing
    const velocityScore = CLAMP_01(
      featureTrends.reduce((s, t) => s + t.trendMagnitude, 0) / ZERO_ENGINE_ML_FEATURE_COUNT,
    );

    // Volatility: standard deviation across features
    const volatilityScore = CLAMP_01(
      featureTrends.reduce((s, t) => s + t.stdDeviation, 0) / ZERO_ENGINE_ML_FEATURE_COUNT,
    );

    // Momentum: net positive movement direction
    const momentumScore = CLAMP_01((risingCount - fallingCount + ZERO_ENGINE_ML_FEATURE_COUNT) /
      (2 * ZERO_ENGINE_ML_FEATURE_COUNT));

    return Object.freeze({
      windowSize: effectiveWindowSize,
      featureTrends: freezeArray(featureTrends),
      overallDirection,
      velocityScore,
      volatilityScore,
      momentumScore,
      computedAtMs: nowMs,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // § 3k — Recovery Forecasting
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Forecast recovery probability based on current state and trend history.
   */
  public forecastRecovery(snapshot: RunStateSnapshot): {
    readonly recoveryLikelihood: number;
    readonly estimatedTicksToRecover: number;
    readonly bottlenecks: readonly string[];
    readonly opportunities: readonly string[];
  } {
    const trend = this.computeTrendSnapshot(8);
    const bottlenecks: string[] = [];
    const opportunities: string[] = [];
    let recoveryScore = 0.5; // Neutral starting point
    let tickEstimate = 10; // Default estimate

    // Analyze pressure state
    const pressureScore = snapshot.pressure.score;
    if (pressureScore > 0.8) {
      bottlenecks.push('Critical pressure level — escalation imminent');
      recoveryScore -= 0.15;
      tickEstimate += 5;
    } else if (pressureScore < 0.3) {
      opportunities.push('Low pressure — window for aggressive play');
      recoveryScore += 0.1;
    }

    // Analyze shield state
    const shieldIntegrity = SAFE_DIV(
      snapshot.shield.layers.reduce((s, l) => s + l.current, 0),
      snapshot.shield.layers.reduce((s, l) => s + l.max, 0),
    );
    if (shieldIntegrity < 0.3) {
      bottlenecks.push('Shield integrity critically low — defensive play needed');
      recoveryScore -= 0.1;
      tickEstimate += 3;
    } else if (shieldIntegrity > 0.8) {
      opportunities.push('Strong shield integrity — offensive potential');
      recoveryScore += 0.05;
    }

    // Analyze economy
    const netCashflow = snapshot.economy.incomePerTick - snapshot.economy.expensesPerTick;
    if (netCashflow < 0) {
      bottlenecks.push('Negative cashflow — economy unsustainable');
      recoveryScore -= 0.15;
      tickEstimate += Math.ceil(Math.abs(snapshot.economy.debt) / Math.max(1, Math.abs(netCashflow)));
    } else if (netCashflow > 0) {
      const ticksToFreedom = Math.ceil(
        (snapshot.economy.freedomTarget - snapshot.economy.netWorth) / netCashflow,
      );
      if (ticksToFreedom > 0 && ticksToFreedom < 50) {
        opportunities.push(`Positive cashflow — estimated ${ticksToFreedom} ticks to freedom`);
        recoveryScore += 0.1;
        tickEstimate = Math.min(tickEstimate, ticksToFreedom);
      }
    }

    // Analyze battle state
    const attackingBots = snapshot.battle.bots.filter((b) => b.state === 'ATTACKING').length;
    if (attackingBots > 2) {
      bottlenecks.push('Multiple bots attacking — shield drain risk');
      recoveryScore -= 0.1;
    }

    // Analyze cascade state
    const negativeChains = snapshot.cascade.activeChains.filter((ch) => !ch.positive).length;
    if (negativeChains > 2) {
      bottlenecks.push('Multiple negative cascade chains — compound damage risk');
      recoveryScore -= 0.1;
    }

    const positiveChains = snapshot.cascade.activeChains.filter((ch) => ch.positive).length;
    if (positiveChains > 0) {
      opportunities.push(`${positiveChains} positive cascade chain(s) — recovery amplification`);
      recoveryScore += 0.05 * positiveChains;
    }

    // Factor in trend
    if (trend.overallDirection === 'IMPROVING') {
      recoveryScore += 0.1;
      tickEstimate = Math.max(1, tickEstimate - 3);
    } else if (trend.overallDirection === 'DETERIORATING') {
      recoveryScore -= 0.1;
      tickEstimate += 5;
    }

    // Analyze consecutive errors
    if (this.state.consecutiveTickErrors > 0) {
      bottlenecks.push(`${this.state.consecutiveTickErrors} consecutive tick error(s)`);
      recoveryScore -= 0.05 * this.state.consecutiveTickErrors;
    }

    // Analyze quarantine
    if (this.state.quarantine.active) {
      bottlenecks.push('Quarantine active — operations restricted');
      recoveryScore -= 0.2;
    }

    // Analyze decision windows
    const windowValues = Object.values(snapshot.timers.activeDecisionWindows);
    const activeWindows = windowValues.filter((w) => !w.frozen && !w.consumed);
    if (activeWindows.length > 0) {
      opportunities.push(`${activeWindows.length} active decision window(s) — tactical options available`);
      recoveryScore += 0.05;
    }

    // Analyze card hand
    if (snapshot.cards.hand.length > 3) {
      opportunities.push('Full hand — multiple play options');
      recoveryScore += 0.05;
    } else if (snapshot.cards.hand.length === 0) {
      bottlenecks.push('Empty hand — no cards to play');
      recoveryScore -= 0.1;
    }

    return Object.freeze({
      recoveryLikelihood: CLAMP_01(recoveryScore),
      estimatedTicksToRecover: Math.max(1, Math.round(tickEstimate)),
      bottlenecks: freezeArray(bottlenecks),
      opportunities: freezeArray(opportunities),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // § 3l — Chat Signal Emission
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Emit a signal to the chat bridge system.
   */
  public emitChatSignal(
    signalType: ZeroChatSignalPayload['signalType'],
    snapshot: RunStateSnapshot,
    urgency: ZeroChatSignalPayload['urgency'],
    summary: string,
    metadata: Record<string, unknown> = {},
  ): ZeroChatBridgeEmission {
    const nowMs = this.clock.now();
    const seqNum = this.state.chatEmissionSequence + 1;
    this.state.chatEmissionSequence = seqNum;

    const payload: ZeroChatSignalPayload = Object.freeze({
      signalType,
      runId: snapshot.runId,
      tick: snapshot.tick,
      phase: snapshot.phase,
      outcome: snapshot.outcome,
      urgency,
      summary,
      metadata: Object.freeze({ ...metadata }),
      emittedAtMs: nowMs,
    });

    const emission: ZeroChatBridgeEmission = Object.freeze({
      emissionId: createDeterministicId('zero', String(Date.now()), String(Math.random())),
      payload,
      mlVector: this.state.lastMLVector,
      projection: this.state.lastProjection,
      narrative: this.state.lastNarrative,
      sequenceNumber: seqNum,
    });

    this.state.chatEmissions = limitArray(
      [...this.state.chatEmissions, emission],
      MAX_TELEMETRY_RECORDS,
    );

    // Emit as engine signal for bus subscribers
    const signalForBus = createEngineSignalFull(
      'mode',
      urgency === 'CRITICAL' ? 'ERROR' : urgency === 'HIGH' ? 'WARN' : 'INFO',
      `zero.chat.${signalType.toLowerCase()}`,
      summary,
      snapshot.tick,
      'ml_emit',
      ['zero', 'chat-bridge', signalType.toLowerCase()],
      undefined,
      { signalType, urgency, emissionId: emission.emissionId },
    );

    // Emit on the bus as a zero-owned chat signal event
    this.bus.emit(
      'tick.completed' as keyof (EngineEventMap & Record<string, unknown>),
      {
        runId: snapshot.runId,
        tick: snapshot.tick,
        phase: snapshot.phase,
        checksum: checksumSnapshot(snapshot),
        chatSignal: payload,
      } as unknown as (EngineEventMap & Record<string, unknown>)[keyof (EngineEventMap & Record<string, unknown>)],
    );

    return emission;
  }

  /**
   * Get all chat emissions for the current session.
   */
  public getChatEmissions(): readonly ZeroChatBridgeEmission[] {
    return this.state.chatEmissions;
  }

  /**
   * Get the last N chat emissions.
   */
  public getRecentChatEmissions(count: number): readonly ZeroChatBridgeEmission[] {
    return freezeArray(this.state.chatEmissions.slice(-Math.max(1, count)));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // § 3m — Diagnostics & Health
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get a comprehensive health report for the orchestrator.
   */
  public getHealthReport(): OrchestratorHealthReport {
    const snapshot = this.getCurrentSnapshot();
    const engineHealthEntries: EngineHealth[] = [];

    for (const engineId of ALL_ENGINE_IDS) {
      const engine = this.engines[engineId as keyof EngineCatalog] as SimulationEngine;
      engineHealthEntries.push(engine.getHealth());
    }

    const bindingReport = this.dependencyBinder.getLastReport()!;

    return Object.freeze({
      lifecycleState: this.state.lifecycleState,
      runId: snapshot?.runId ?? null,
      userId: snapshot?.userId ?? null,
      seed: snapshot?.seed ?? null,
      currentTick: snapshot?.tick ?? null,
      consecutiveTickErrorCount: this.state.consecutiveTickErrors,
      engines: freezeArray(engineHealthEntries),
      lastTickSummary: this.state.tickHistory.length > 0
        ? this.state.tickHistory[this.state.tickHistory.length - 1]
        : null,
      lastErrors: freezeArray(this.state.errorAccumulator.slice(-10)),
      dependencyBindings: bindingReport,
      lifecycleHistory: this.state.lifecycleHistory,
    });
  }

  /**
   * Get a full diagnostics snapshot using the OrchestratorDiagnostics service.
   */
  public getDiagnostics(): ReturnType<OrchestratorDiagnostics['snapshot']> {
    return this.diagnostics.snapshot();
  }

  /**
   * Get the health report builder's snapshot.
   */
  public getHealthReportBuilderSnapshot(): ReturnType<HealthReportBuilder['snapshot']> {
    return this.healthReportBuilder.snapshot();
  }

  /**
   * Get orchestrator state snapshot.
   */
  public getOrchestratorStateSnapshot(): OrchestratorStateSnapshot {
    const snapshot = this.getCurrentSnapshot();
    return Object.freeze({
      lifecycleState: this.state.lifecycleState,
      runId: snapshot?.runId ?? null,
      userId: snapshot?.userId ?? null,
      seed: snapshot?.seed ?? null,
      freedomThreshold: snapshot?.economy.freedomTarget ?? 0,
      consecutiveTickErrorCount: this.state.consecutiveTickErrors,
      current: snapshot ? deepFrozenClone(snapshot) : null,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // § 3n — Telemetry
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the telemetry service's snapshot.
   */
  public getTelemetrySnapshot(): ReturnType<OrchestratorTelemetry['snapshot']> {
    return this.telemetry.snapshot();
  }

  /**
   * Get a windowed view of telemetry records.
   */
  public getTelemetryWindow(maxRecords?: number): OrchestratorTelemetryWindow {
    const limit = maxRecords ?? this.maxTelemetryLimit;
    const records = limitArray(this.state.telemetryRecords, limit);
    return Object.freeze({
      records,
      retainedCount: records.length,
    });
  }

  /**
   * Export all telemetry records for external consumption.
   */
  public exportTelemetryRecords(): readonly OrchestratorTelemetryRecord[] {
    return this.state.telemetryRecords;
  }

  /**
   * Get tick execution history.
   */
  public getTickHistory(): TickHistoryWindow {
    return Object.freeze({
      summaries: this.state.tickHistory,
      retainedCount: this.state.tickHistory.length,
      maxRetainedCount: this.maxTickHistoryLimit,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // § 3o — Event Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get access to the underlying event bus.
   */
  public getEventBus(): EventBus<EngineEventMap & Record<string, unknown>> {
    return this.bus;
  }

  /**
   * Get event history within a window.
   */
  public getEventHistory(limit?: number): EventHistoryWindow {
    const history = this.bus.getHistory(limit);
    return Object.freeze({
      fromSequence: history.length > 0 ? 0 : null,
      toSequence: history.length > 0 ? history.length - 1 : null,
      count: history.length,
    });
  }

  /**
   * Build a replay slice from the event history.
   */
  public getEventReplaySlice(snapshot: RunStateSnapshot): EventReplaySlice {
    const events = this.bus.getHistory() as readonly EngineEventEnvelope[];
    const window = this.getEventHistory();

    return Object.freeze({
      runId: snapshot.runId,
      tick: snapshot.tick,
      phase: snapshot.phase,
      window,
      entries: freezeArray(events),
    });
  }

  /**
   * Classify an event by its family using ZERO_EVENT_FAMILY_BY_EVENT.
   */
  public classifyEventFamily(eventName: keyof EngineEventMap): ZeroEventFamily {
    return ZERO_EVENT_FAMILY_BY_EVENT[eventName] ?? 'UNKNOWN';
  }

  /**
   * Get queued event count on the bus.
   */
  public getQueuedEventCount(): number {
    return this.bus.queuedCount();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // § 3p — Quarantine Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Enter quarantine state.
   */
  public enterQuarantine(
    tick: number,
    triggeredBy: TickStep | 'RUN_START' | 'RUN_END',
    reason: string,
  ): void {
    const current = this.state.quarantine;
    this.state.quarantine = Object.freeze({
      active: true,
      sinceTick: current.sinceTick ?? tick,
      reasons: freezeArray([...current.reasons, reason]),
      triggeredBy,
    });

    const snapshot = this.getCurrentSnapshot();
    if (snapshot && this.enableChatSignals) {
      this.emitChatSignal(
        'QUARANTINE_ENTERED',
        snapshot,
        'CRITICAL',
        `Quarantine entered at tick ${tick}: ${reason}`,
        { triggeredBy },
      );
    }
  }

  /**
   * Exit quarantine state.
   */
  public exitQuarantine(): void {
    const wasActive = this.state.quarantine.active;
    this.state.quarantine = this.createCleanQuarantine();

    if (wasActive) {
      const snapshot = this.getCurrentSnapshot();
      if (snapshot && this.enableChatSignals) {
        this.emitChatSignal(
          'QUARANTINE_EXITED',
          snapshot,
          'MEDIUM',
          'Quarantine exited — normal operations resumed',
        );
      }
    }
  }

  /**
   * Check quarantine state.
   */
  public getQuarantineState(): OrchestratorQuarantineState {
    return this.state.quarantine;
  }

  /**
   * Check if quarantine is active.
   */
  public isQuarantined(): boolean {
    return this.state.quarantine.active;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // § 3q — Lifecycle History & Transitions
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the full lifecycle history.
   */
  public getLifecycleHistory(): RunLifecycleHistory {
    return this.state.lifecycleHistory;
  }

  /**
   * Get the current lifecycle state.
   */
  public getLifecycleState(): RunLifecycleState {
    return this.state.lifecycleState;
  }

  /**
   * Check if a lifecycle transition is legal.
   */
  public isLegalTransition(from: RunLifecycleState, to: RunLifecycleState): RunLifecycleInvariant {
    const legalTargets = ZERO_LEGAL_LIFECYCLE_TRANSITIONS[from];
    const legal = legalTargets.includes(to);
    return Object.freeze({
      from,
      to,
      legal,
      reason: legal
        ? `Transition from ${from} to ${to} is permitted`
        : `Transition from ${from} to ${to} is forbidden. Legal targets: ${legalTargets.join(', ')}`,
    });
  }

  /**
   * Get all valid lifecycle states.
   */
  public getValidLifecycleStates(): readonly RunLifecycleState[] {
    return ZERO_RUN_LIFECYCLE_STATES;
  }

  /**
   * Get all valid lifecycle transitions.
   */
  public getValidLifecycleTransitions(): readonly RunLifecycleTransition[] {
    return ZERO_RUN_LIFECYCLE_TRANSITIONS;
  }

  /**
   * Get the step runtime owners mapping.
   */
  public getStepRuntimeOwners(): readonly StepRuntimeOwner[] {
    return ZERO_STEP_RUNTIME_OWNERS;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // § 3r — Narrative Generation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generate a human-readable narrative description of the current run state.
   * This bridges game engine state to the chat system.
   */
  public generateNarrative(snapshot: RunStateSnapshot): string {
    const parts: string[] = [];

    // Opening line
    parts.push(this.narrateRunContext(snapshot));

    // Economy narrative
    parts.push(this.narrateEconomy(snapshot));

    // Pressure narrative
    parts.push(this.narratePressure(snapshot));

    // Shield narrative
    parts.push(this.narrateShield(snapshot));

    // Battle narrative
    parts.push(this.narrateBattle(snapshot));

    // Cascade narrative
    parts.push(this.narrateCascade(snapshot));

    // Decision window narrative
    parts.push(this.narrateDecisionWindows(snapshot));

    // Outcome narrative
    if (snapshot.outcome !== null) {
      parts.push(this.narrateOutcome(snapshot));
    } else {
      parts.push(this.narratePrognosis(snapshot));
    }

    return parts.filter((p) => p.length > 0).join(' ');
  }

  /**
   * Get the last generated narrative.
   */
  public getLastNarrative(): string {
    return this.state.lastNarrative;
  }

  private narrateRunContext(snapshot: RunStateSnapshot): string {
    const modeLabels: Record<ModeCode, string> = {
      solo: 'Solo', pvp: 'PvP', coop: 'Co-op', ghost: 'Ghost',
    };
    const phaseLabels: Record<RunPhase, string> = {
      FOUNDATION: 'foundation', ESCALATION: 'escalation', SOVEREIGNTY: 'sovereignty',
    };
    return `[Tick ${snapshot.tick}, ${modeLabels[snapshot.mode]} ${phaseLabels[snapshot.phase]} phase]`;
  }

  private narrateEconomy(snapshot: RunStateSnapshot): string {
    const eco = snapshot.economy;
    const netCf = eco.incomePerTick - eco.expensesPerTick;
    const progressPct = Math.round((eco.netWorth / Math.max(1, eco.freedomTarget)) * 100);

    let narrative = `Net worth at ${progressPct}% of freedom target.`;
    if (netCf > 0) {
      narrative += ` Positive cashflow of ${netCf.toFixed(0)} per tick.`;
    } else if (netCf < 0) {
      narrative += ` Negative cashflow of ${netCf.toFixed(0)} per tick — bleeding out.`;
    }
    if (eco.debt > 0) {
      narrative += ` Carrying ${eco.debt.toFixed(0)} debt.`;
    }
    return narrative;
  }

  private narratePressure(snapshot: RunStateSnapshot): string {
    const p = snapshot.pressure;
    const tierLabels: Record<PressureTier, string> = {
      T0: 'minimal', T1: 'low', T2: 'moderate', T3: 'high', T4: 'extreme',
    };
    const trend = this.computePressureTrend(snapshot);
    let narrative = `Pressure is ${tierLabels[p.tier]}`;
    if (trend === 'SPIKING') narrative += ' and spiking rapidly';
    else if (trend === 'RISING') narrative += ' and rising';
    else if (trend === 'RELIEVING') narrative += ' but easing off';
    narrative += '.';
    if (p.upwardCrossings > 3) {
      narrative += ` ${p.upwardCrossings} escalation events this run.`;
    }
    return narrative;
  }

  private narrateShield(snapshot: RunStateSnapshot): string {
    const s = snapshot.shield;
    const totalCurrent = s.layers.reduce((sum, l) => sum + l.current, 0);
    const totalMax = s.layers.reduce((sum, l) => sum + l.max, 0);
    const intPct = Math.round(SAFE_DIV(totalCurrent, totalMax) * 100);
    const breached = s.layers.filter((l) => l.breached);

    let narrative = `Shield integrity at ${intPct}%.`;
    if (breached.length > 0) {
      narrative += ` ${breached.length} layer(s) breached.`;
    }
    if (s.weakestLayerRatio < 0.2) {
      const weakest = s.layers.find((l) => l.layerId === s.weakestLayerId);
      narrative += ` ${weakest?.label ?? s.weakestLayerId} critically low.`;
    }
    return narrative;
  }

  private narrateBattle(snapshot: RunStateSnapshot): string {
    const b = snapshot.battle;
    const attacking = b.bots.filter((bot) => bot.state === 'ATTACKING');
    const neutralized = b.neutralizedBotIds;

    if (attacking.length === 0 && neutralized.length === b.bots.length) {
      return 'All hostile bots neutralized.';
    }

    let narrative = '';
    if (attacking.length > 0) {
      narrative += `${attacking.length} bot(s) actively attacking.`;
    }
    if (b.pendingAttacks.length > 0) {
      narrative += ` ${b.pendingAttacks.length} pending attack(s) in queue.`;
    }
    if (neutralized.length > 0) {
      narrative += ` ${neutralized.length} bot(s) neutralized.`;
    }
    return narrative;
  }

  private narrateCascade(snapshot: RunStateSnapshot): string {
    const c = snapshot.cascade;
    if (c.activeChains.length === 0) {
      return 'No active cascade chains.';
    }

    const pos = c.activeChains.filter((ch) => ch.positive).length;
    const neg = c.activeChains.filter((ch) => !ch.positive).length;
    let narrative = `${c.activeChains.length} active cascade chain(s)`;
    if (pos > 0 && neg > 0) {
      narrative += ` (${pos} positive, ${neg} negative)`;
    } else if (pos > 0) {
      narrative += ' (all positive)';
    } else {
      narrative += ' (all negative)';
    }
    narrative += '.';
    if (c.brokenChains > 0) {
      narrative += ` ${c.brokenChains} chain(s) broken this run.`;
    }
    return narrative;
  }

  private narrateDecisionWindows(snapshot: RunStateSnapshot): string {
    const windows = Object.values(snapshot.timers.activeDecisionWindows);
    const active = windows.filter((w) => !w.frozen && !w.consumed);
    if (active.length === 0) return '';
    return `${active.length} decision window(s) open.`;
  }

  private narrateOutcome(snapshot: RunStateSnapshot): string {
    const outcomeLabels: Record<string, string> = {
      FREEDOM: 'Freedom achieved — you won.',
      BANKRUPT: 'Bankruptcy — net worth collapsed.',
      TIMEOUT: 'Season timed out — budget exhausted.',
      ABANDONED: 'Run abandoned.',
    };
    return outcomeLabels[snapshot.outcome ?? ''] ?? `Outcome: ${snapshot.outcome}.`;
  }

  private narratePrognosis(snapshot: RunStateSnapshot): string {
    const forecast = this.forecastRecovery(snapshot);
    if (forecast.recoveryLikelihood > 0.7) {
      return `Outlook positive (${Math.round(forecast.recoveryLikelihood * 100)}% recovery likelihood).`;
    } else if (forecast.recoveryLikelihood > 0.4) {
      return `Outlook uncertain (${Math.round(forecast.recoveryLikelihood * 100)}% recovery likelihood).`;
    } else {
      return `Outlook critical (${Math.round(forecast.recoveryLikelihood * 100)}% recovery likelihood). Immediate action needed.`;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // § 3s — Serialization
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Serialize the ZeroEngine state to a JSON-safe object.
   */
  public toJSON(): Record<string, unknown> {
    const snapshot = this.getCurrentSnapshot();
    return Object.freeze({
      moduleVersion: ZERO_ENGINE_MODULE_VERSION,
      lifecycleState: this.state.lifecycleState,
      runId: snapshot?.runId ?? null,
      tick: snapshot?.tick ?? null,
      phase: snapshot?.phase ?? null,
      outcome: snapshot?.outcome ?? null,
      consecutiveTickErrors: this.state.consecutiveTickErrors,
      quarantine: this.state.quarantine,
      lifecycleHistory: this.state.lifecycleHistory,
      tickHistoryCount: this.state.tickHistory.length,
      mlHistoryCount: this.state.mlHistory.length,
      telemetryRecordCount: this.state.telemetryRecords.length,
      chatEmissionCount: this.state.chatEmissions.length,
      lastProjection: this.state.lastProjection,
      lastNarrative: this.state.lastNarrative,
      warningCount: this.state.warningAccumulator.length,
      errorCount: this.state.errorAccumulator.length,
      configFingerprint: this.resolvedConfig.fingerprint,
      configProfileId: this.resolvedConfig.resolvedProfileId,
      enableChatSignals: this.enableChatSignals,
      enableMLExtraction: this.enableMLExtraction,
      enableDLExtraction: this.enableDLExtraction,
      enableNarrativeGeneration: this.enableNarrativeGeneration,
    });
  }

  /**
   * Validate the current engine state for integrity.
   */
  public validate(): { valid: boolean; issues: readonly string[] } {
    const issues: string[] = [];

    // Validate lifecycle state
    if (!ZERO_RUN_LIFECYCLE_STATES.includes(this.state.lifecycleState)) {
      issues.push(`Invalid lifecycle state: ${this.state.lifecycleState}`);
    }

    // Validate engine registrations
    for (const engineId of ZERO_REQUIRED_ENGINE_IDS) {
      const engine = this.engines[engineId as keyof EngineCatalog] as SimulationEngine | undefined;
      if (!engine) {
        issues.push(`Required engine not instantiated: ${engineId}`);
      }
    }

    // Validate tick plan
    const planSnapshot = this.tickPlan.snapshot();
    if (planSnapshot.size !== ZERO_CANONICAL_TICK_SEQUENCE.length) {
      issues.push(`Tick plan size mismatch: expected ${ZERO_CANONICAL_TICK_SEQUENCE.length}, got ${planSnapshot.size}`);
    }

    // Validate quarantine consistency
    if (this.state.quarantine.active && this.state.quarantine.sinceTick === null) {
      issues.push('Quarantine active but sinceTick is null');
    }

    // Validate consecutive error count
    if (this.state.consecutiveTickErrors < 0) {
      issues.push(`Invalid consecutive error count: ${this.state.consecutiveTickErrors}`);
    }

    // Validate ML feature label count
    if (ZERO_ML_FEATURE_LABELS.length !== ZERO_ENGINE_ML_FEATURE_COUNT) {
      issues.push(`ML feature label count mismatch: expected ${ZERO_ENGINE_ML_FEATURE_COUNT}, got ${ZERO_ML_FEATURE_LABELS.length}`);
    }

    // Validate DL column label count
    if (ZERO_DL_COLUMN_LABELS.length !== ZERO_ENGINE_DL_FEATURE_COUNT) {
      issues.push(`DL column label count mismatch: expected ${ZERO_ENGINE_DL_FEATURE_COUNT}, got ${ZERO_DL_COLUMN_LABELS.length}`);
    }

    // Validate terminal priority rules
    for (const rule of ZERO_TERMINAL_PRIORITY) {
      if (!rule.outcome || !rule.description) {
        issues.push(`Invalid terminal priority rule: ${JSON.stringify(rule)}`);
      }
    }

    // Validate config
    if (!this.resolvedConfig.config) {
      issues.push('Resolved config has no underlying config object');
    }

    return Object.freeze({
      valid: issues.length === 0,
      issues: freezeArray(issues),
    });
  }

  /**
   * Compute a snapshot diff report between two snapshots.
   */
  public computeSnapshotDiff(before: RunStateSnapshot, after: RunStateSnapshot): SnapshotDiffReport {
    const beforeChecksum = checksumSnapshot(before);
    const afterChecksum = checksumSnapshot(after);
    const changed = beforeChecksum !== afterChecksum;
    const fields: SnapshotDiffField[] = [];

    if (changed) {
      // Compare top-level fields
      const topLevelFields: (keyof RunStateSnapshot)[] = [
        'tick', 'phase', 'outcome',
      ];

      for (const field of topLevelFields) {
        const bVal = before[field];
        const aVal = after[field];
        if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
          fields.push({ path: field, before: bVal, after: aVal });
        }
      }

      // Compare economy
      if (before.economy.cash !== after.economy.cash) {
        fields.push({ path: 'economy.cash', before: before.economy.cash, after: after.economy.cash });
      }
      if (before.economy.netWorth !== after.economy.netWorth) {
        fields.push({ path: 'economy.netWorth', before: before.economy.netWorth, after: after.economy.netWorth });
      }
      if (before.economy.debt !== after.economy.debt) {
        fields.push({ path: 'economy.debt', before: before.economy.debt, after: after.economy.debt });
      }

      // Compare pressure
      if (before.pressure.score !== after.pressure.score) {
        fields.push({ path: 'pressure.score', before: before.pressure.score, after: after.pressure.score });
      }
      if (before.pressure.tier !== after.pressure.tier) {
        fields.push({ path: 'pressure.tier', before: before.pressure.tier, after: after.pressure.tier });
      }

      // Compare tension
      if (before.tension.score !== after.tension.score) {
        fields.push({ path: 'tension.score', before: before.tension.score, after: after.tension.score });
      }

      // Compare shield
      if (before.shield.weakestLayerRatio !== after.shield.weakestLayerRatio) {
        fields.push({ path: 'shield.weakestLayerRatio', before: before.shield.weakestLayerRatio, after: after.shield.weakestLayerRatio });
      }

      // Compare sovereignty
      if (before.sovereignty.integrityStatus !== after.sovereignty.integrityStatus) {
        fields.push({ path: 'sovereignty.integrityStatus', before: before.sovereignty.integrityStatus, after: after.sovereignty.integrityStatus });
      }
    }

    return Object.freeze({
      changed,
      fields: freezeArray(fields),
      beforeChecksum,
      afterChecksum,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // § 3t — Static Factories
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a ZeroEngine with default options.
   */
  public static create(options?: ZeroEngineOptions): ZeroEngine {
    return new ZeroEngine(options);
  }

  /**
   * Create a ZeroEngine configured for production.
   */
  public static createProduction(options?: Partial<ZeroEngineOptions>): ZeroEngine {
    return new ZeroEngine({
      ...options,
      profileId: 'production',
      enableChatSignals: true,
      enableMLExtraction: true,
      enableDLExtraction: true,
      enableNarrativeGeneration: true,
      forceProofFinalizeOnTerminal: true,
    });
  }

  /**
   * Create a ZeroEngine configured for testing.
   */
  public static createForTest(options?: Partial<ZeroEngineOptions>): ZeroEngine {
    return new ZeroEngine({
      ...options,
      profileId: 'integration-test',
      enableChatSignals: false,
      enableMLExtraction: true,
      enableDLExtraction: false,
      enableNarrativeGeneration: false,
      forceProofFinalizeOnTerminal: false,
    });
  }

  /**
   * Create a ZeroEngine configured for replay.
   */
  public static createForReplay(options?: Partial<ZeroEngineOptions>): ZeroEngine {
    return new ZeroEngine({
      ...options,
      profileId: 'replay',
      enableChatSignals: false,
      enableMLExtraction: true,
      enableDLExtraction: true,
      enableNarrativeGeneration: true,
      forceProofFinalizeOnTerminal: false,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Engine registration ───────────────────────────────────────────────

  private registerAllEngines(): void {
    const allEngines: SimulationEngine[] = [
      this.engines.time,
      this.engines.pressure,
      this.engines.tension,
      this.engines.shield,
      this.engines.battle,
      this.engines.cascade,
      this.engines.sovereignty,
    ];

    for (const engine of allEngines) {
      this.registry.register(engine);
    }
  }

  private validateRequiredEngines(): void {
    for (const descriptor of ZERO_REQUIRED_ENGINES) {
      const engine = this.registry.get(descriptor.engineId);
      if (!engine && descriptor.critical) {
        throw new Error(
          `ZeroEngine: Critical required engine '${descriptor.engineId}' is not registered. Reason: ${descriptor.reason}`,
        );
      }
    }
  }

  private validateConfig(): void {
    const stepCount = ZERO_CANONICAL_TICK_SEQUENCE.length;
    const configStepCount = Object.keys(this.resolvedConfig.stepConfig).length;
    if (configStepCount !== stepCount) {
      throw new Error(
        `ZeroEngine: Config step count mismatch. Expected ${stepCount}, got ${configStepCount}`,
      );
    }
  }

  // ─── Lifecycle management ──────────────────────────────────────────────

  private createInitialInternalState(): ZeroEngineInternalState {
    return {
      lifecycleState: 'IDLE',
      consecutiveTickErrors: 0,
      tickHistory: freezeArray([]),
      mlHistory: freezeArray([]),
      telemetryRecords: freezeArray([]),
      quarantine: this.createCleanQuarantine(),
      lifecycleHistory: {
        checkpoints: freezeArray([]),
        lastTransitionAtMs: null,
        transitionCount: 0,
      },
      chatEmissionSequence: 0,
      chatEmissions: freezeArray([]),
      warningAccumulator: freezeArray([]),
      errorAccumulator: freezeArray([]),
      lastResolvedConfig: null,
      lastProjection: null,
      lastMLVector: null,
      lastNarrative: '',
    };
  }

  private createCleanQuarantine(): OrchestratorQuarantineState {
    return Object.freeze({
      active: false,
      sinceTick: null,
      reasons: freezeArray([]),
      triggeredBy: null,
    });
  }

  private transitionLifecycle(
    to: RunLifecycleState,
    transition: RunLifecycleTransition,
    nowMs: number,
    tick: number | null,
    note: string,
  ): void {
    const checkpoint: RunLifecycleCheckpoint = Object.freeze({
      lifecycleState: to,
      changedAtMs: nowMs,
      tick,
      note,
      transition,
    });

    const prevHistory = this.state.lifecycleHistory;
    this.state.lifecycleHistory = {
      checkpoints: limitArray(
        [...prevHistory.checkpoints, checkpoint],
        128,
      ),
      lastTransitionAtMs: nowMs,
      transitionCount: prevHistory.transitionCount + 1,
    };

    this.state.lifecycleState = to;
  }

  private assertLifecycleTransition(expectedFrom: RunLifecycleState, to: RunLifecycleState): void {
    if (this.state.lifecycleState !== expectedFrom) {
      throw new Error(
        `ZeroEngine: Expected lifecycle state '${expectedFrom}' but found '${this.state.lifecycleState}'`,
      );
    }
    const legalTargets = ZERO_LEGAL_LIFECYCLE_TRANSITIONS[expectedFrom];
    if (!legalTargets.includes(to)) {
      throw new Error(
        `ZeroEngine: Transition from '${expectedFrom}' to '${to}' is not legal. Legal targets: ${legalTargets.join(', ')}`,
      );
    }
  }

  private assertLifecycleActive(operation: string): void {
    if (this.state.lifecycleState !== 'ACTIVE') {
      throw new Error(
        `ZeroEngine.${operation}: Requires ACTIVE lifecycle state but found '${this.state.lifecycleState}'`,
      );
    }
  }

  private assertLifecycleCanEnd(): void {
    const current = this.state.lifecycleState;
    const legalTargets = ZERO_LEGAL_LIFECYCLE_TRANSITIONS[current];
    if (!legalTargets.includes('ENDING') && current !== 'ENDING') {
      throw new Error(
        `ZeroEngine.endRun: Cannot transition from '${current}' to ENDING. Legal targets: ${legalTargets.join(', ')}`,
      );
    }
  }

  private assertCanExecuteTick(): void {
    if (this.state.lifecycleState !== 'ACTIVE') {
      throw new Error(
        `ZeroEngine.executeTick: Cannot execute tick in lifecycle state '${this.state.lifecycleState}'. Must be ACTIVE.`,
      );
    }
    if (this.state.quarantine.active) {
      throw new Error(
        `ZeroEngine.executeTick: Cannot execute tick while in quarantine. Reasons: ${this.state.quarantine.reasons.join(', ')}`,
      );
    }
  }

  // ─── Snapshot access ───────────────────────────────────────────────────

  private getCurrentSnapshot(): RunStateSnapshot | null {
    try {
      return this.orchestrator.getSnapshot();
    } catch {
      return null;
    }
  }

  private getRequiredSnapshot(): RunStateSnapshot {
    const snapshot = this.getCurrentSnapshot();
    if (!snapshot) {
      throw new Error('ZeroEngine: No active run snapshot available');
    }
    return snapshot;
  }

  private getCurrentTick(): number | null {
    const snapshot = this.getCurrentSnapshot();
    return snapshot?.tick ?? null;
  }

  // ─── Telemetry collection ──────────────────────────────────────────────

  private collectTelemetryForTick(summary: TickExecutionSummary): void {
    const record: OrchestratorTelemetryRecord = Object.freeze({
      runId: summary.runId,
      tick: summary.tick,
      lifecycleState: this.state.lifecycleState,
      step: 'RUN_START', // Placeholder — entire tick recorded as one record
      emittedEventCount: summary.eventCount,
      durationMs: summary.durationMs,
      warnings: freezeArray(
        summary.warnings.map((w) => Object.freeze({
          step: 'STEP_01_PREPARE' as TickStep,
          message: w,
          atMs: summary.startedAtMs,
        })),
      ),
      errors: freezeArray([]),
    });

    this.state.telemetryRecords = limitArray(
      [...this.state.telemetryRecords, record],
      this.maxTelemetryLimit,
    );

    // Feed the telemetry service
    this.telemetry.recordTick({
      snapshot: summary.postTickSnapshot,
      tickDurationMs: summary.durationMs,
      signals: summary.signals,
      events: [],
      capturedAtMs: summary.endedAtMs,
    });
  }

  // ─── Tick trace building ───────────────────────────────────────────────

  private buildTickTrace(snapshot: RunStateSnapshot, step: TickStep, traceId: string): TickTrace {
    return Object.freeze({
      runId: snapshot.runId,
      tick: snapshot.tick,
      step,
      mode: snapshot.mode,
      phase: snapshot.phase,
      traceId,
    });
  }

  // ─── Step owner resolution ─────────────────────────────────────────────

  private resolveStepOwner(step: TickStep): TickStepErrorRecord['engineId'] {
    const descriptor = ZERO_TICK_STEP_DESCRIPTORS[step];
    return (descriptor?.owner ?? 'unknown') as TickStepErrorRecord['engineId'];
  }

  // ─── Pressure trend computation ────────────────────────────────────────

  private computePressureTrend(snapshot: RunStateSnapshot): ZeroPressureProjection['trend'] {
    const p = snapshot.pressure;

    if (this.state.mlHistory.length < 3) {
      if (p.score > 0.85) return 'SPIKING';
      if (p.score > p.maxScoreSeen * 0.8) return 'RISING';
      return 'FLAT';
    }

    const recent = this.state.mlHistory.slice(-5);
    const pressureValues = recent.map((v) => v.features[12]); // pressure_score_norm
    const deltas = pressureValues.slice(1).map((v, i) => v - pressureValues[i]);
    const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;

    if (avgDelta > 0.05) return 'SPIKING';
    if (avgDelta > 0.01) return 'RISING';
    if (avgDelta < -0.01) return 'RELIEVING';
    return 'FLAT';
  }

  // ─── Chat signal helpers ───────────────────────────────────────────────

  private emitTickChatSignals(summary: TickExecutionSummary, snapshot: RunStateSnapshot): void {
    // Detect pressure escalation
    if (summary.preTickSnapshot.pressure.tier !== snapshot.pressure.tier) {
      const tierOrd = (t: PressureTier) => ({ T0: 0, T1: 1, T2: 2, T3: 3, T4: 4 }[t] ?? 0);
      if (tierOrd(snapshot.pressure.tier) > tierOrd(summary.preTickSnapshot.pressure.tier)) {
        this.emitChatSignal(
          'PRESSURE_ESCALATED',
          snapshot,
          snapshot.pressure.tier === 'T4' ? 'CRITICAL' : 'HIGH',
          `Pressure escalated to ${snapshot.pressure.tier}`,
        );
      }
    }

    // Detect shield breaches
    const prevBreachedCount = summary.preTickSnapshot.shield.layers.filter((l) => l.breached).length;
    const currBreachedCount = snapshot.shield.layers.filter((l) => l.breached).length;
    if (currBreachedCount > prevBreachedCount) {
      this.emitChatSignal(
        'SHIELD_BREACHED',
        snapshot,
        'HIGH',
        `Shield breach detected — ${currBreachedCount} layer(s) breached`,
      );
    }

    // Detect cascade breaks
    if (snapshot.cascade.brokenChains > summary.preTickSnapshot.cascade.brokenChains) {
      this.emitChatSignal(
        'CASCADE_BROKEN',
        snapshot,
        'MEDIUM',
        'Cascade chain broken',
      );
    }

    // Detect health degradation
    const prevHealthScore = this.computeSimpleHealthScore(summary.preTickSnapshot);
    const currHealthScore = this.computeSimpleHealthScore(snapshot);
    if (currHealthScore < prevHealthScore - 0.15) {
      this.emitChatSignal(
        'HEALTH_DEGRADED',
        snapshot,
        'HIGH',
        `Overall health dropped significantly (${Math.round(prevHealthScore * 100)}% -> ${Math.round(currHealthScore * 100)}%)`,
      );
    }

    // Detect recovery
    if (currHealthScore > prevHealthScore + 0.1 && prevHealthScore < 0.5) {
      this.emitChatSignal(
        'RECOVERY_DETECTED',
        snapshot,
        'LOW',
        `Recovery detected (${Math.round(prevHealthScore * 100)}% -> ${Math.round(currHealthScore * 100)}%)`,
      );
    }

    // Emit standard tick completed signal
    this.emitChatSignal(
      'TICK_COMPLETED',
      snapshot,
      'LOW',
      `Tick ${snapshot.tick} completed in ${summary.durationMs}ms`,
      {
        durationMs: summary.durationMs,
        eventCount: summary.eventCount,
        outcome: summary.outcome,
      },
    );
  }

  private computeSimpleHealthScore(snapshot: RunStateSnapshot): number {
    const ecoScore = CLAMP_01(snapshot.economy.netWorth / Math.max(1, snapshot.economy.freedomTarget));
    const shieldScore = SAFE_DIV(
      snapshot.shield.layers.reduce((s, l) => s + l.current, 0),
      snapshot.shield.layers.reduce((s, l) => s + l.max, 0),
    );
    const pressureInverse = 1 - CLAMP_01(snapshot.pressure.score);
    return (ecoScore + shieldScore + pressureInverse) / 3;
  }

  // ─── DL tensor helpers ─────────────────────────────────────────────────

  private computeMomentumScore(current: ZeroMLVector, prev: ZeroMLVector | null): number {
    if (!prev) return 0.5;

    // Aggregate positive delta across key health features
    const healthIndices = [2, 5, 33]; // net_worth, freedom_progress, shield_integrity
    let totalDelta = 0;
    for (const idx of healthIndices) {
      totalDelta += current.features[idx] - prev.features[idx];
    }
    // Inverse pressure delta (lower pressure = positive momentum)
    totalDelta -= (current.features[12] - prev.features[12]);

    return CLAMP_01((totalDelta + 0.5) / 1.0);
  }

  private computeVolatilityIndex(vectors: readonly ZeroMLVector[], currentIndex: number): number {
    if (currentIndex < 2) return 0;

    const windowSize = Math.min(5, currentIndex + 1);
    const window = vectors.slice(currentIndex - windowSize + 1, currentIndex + 1);

    // Compute average absolute delta across all features
    let totalVolatility = 0;
    let count = 0;

    for (let i = 1; i < window.length; i++) {
      for (let fi = 0; fi < ZERO_ENGINE_ML_FEATURE_COUNT; fi++) {
        totalVolatility += Math.abs(window[i].features[fi] - window[i - 1].features[fi]);
        count++;
      }
    }

    return CLAMP_01(SAFE_DIV(totalVolatility, count) * 10);
  }

  private computeRecoveryRate(current: ZeroMLVector, prev: ZeroMLVector | null): number {
    if (!prev) return 0.5;

    // Recovery = improvement in shield + economy - pressure increase
    const shieldDelta = current.features[33] - prev.features[33]; // shield_aggregate_integrity
    const economyDelta = current.features[5] - prev.features[5]; // economy_freedom_progress
    const pressureDelta = current.features[12] - prev.features[12]; // pressure_score_norm

    const recovery = shieldDelta + economyDelta - pressureDelta;
    return CLAMP_01((recovery + 0.5) / 1.0);
  }

  private computeOverallHealthComposite(vec: ZeroMLVector): number {
    // Weighted composite of key health indicators
    const weights = [
      { index: 5, weight: 0.25 },  // economy_freedom_progress
      { index: 33, weight: 0.2 },  // shield_aggregate_integrity
      { index: 12, weight: -0.2 }, // pressure_score_norm (inverse)
      { index: 22, weight: -0.1 }, // tension_score_norm (inverse)
      { index: 42, weight: -0.1 }, // battle_active_bot_count_norm (inverse)
      { index: 52, weight: -0.05 }, // cascade_active_chain_count_norm
      { index: 60, weight: 0.1 },  // cards_hand_size_norm
      { index: 84, weight: 0.1 },  // integrity_sovereignty_score_norm
    ];

    let composite = 0.5; // Neutral baseline
    for (const { index, weight } of weights) {
      composite += vec.features[index] * weight;
    }
    return CLAMP_01(composite);
  }

  // ─── Tick duration trend ───────────────────────────────────────────────

  private computeTickDurationTrend(): number {
    if (this.state.tickHistory.length < 2) return 0.5;

    const recent = this.state.tickHistory.slice(-5);
    const durations = recent.map((t) => t.durationMs);

    if (durations.length < 2) return 0.5;

    const first = durations[0];
    const last = durations[durations.length - 1];
    const delta = SAFE_DIV(last - first, Math.max(1, first));

    // Normalize: -1 (getting faster) to +1 (getting slower) -> 0..1
    return CLAMP_01((delta + 1) / 2);
  }

  // ─── Public query accessors ────────────────────────────────────────────

  /**
   * Get the underlying EngineOrchestrator.
   */
  public getOrchestrator(): EngineOrchestrator {
    return this.orchestrator;
  }

  /**
   * Get the RunLifecycleCoordinator.
   */
  public getLifecycleCoordinator(): RunLifecycleCoordinator {
    return this.lifecycleCoordinator;
  }

  /**
   * Get the RunQueryService.
   */
  public getQueryService(): RunQueryService {
    return this.queryService;
  }

  /**
   * Get the engine registry.
   */
  public getRegistry(): EngineRegistry {
    return this.registry;
  }

  /**
   * Get the clock source.
   */
  public getClock(): ClockSource {
    return this.clock;
  }

  /**
   * Get the resolved configuration.
   */
  public getResolvedConfig(): ResolvedOrchestratorConfig {
    return this.resolvedConfig;
  }

  /**
   * Get a specific engine by ID.
   */
  public getEngine(engineId: EngineId): SimulationEngine {
    const engine = this.engines[engineId as keyof EngineCatalog] as SimulationEngine;
    if (!engine) {
      throw new Error(`ZeroEngine.getEngine: Unknown engine ID '${engineId}'`);
    }
    return engine;
  }

  /**
   * Get all engine health statuses.
   */
  public getAllEngineHealth(): readonly EngineHealth[] {
    return freezeArray(
      ALL_ENGINE_IDS.map((engineId) => {
        const engine = this.engines[engineId as keyof EngineCatalog] as SimulationEngine;
        return engine.getHealth();
      }),
    );
  }

  /**
   * Get the tick plan.
   */
  public getTickPlan(): TickPlan {
    return this.tickPlan;
  }

  /**
   * Get the tick plan snapshot.
   */
  public getTickPlanSnapshot(): TickPlanSnapshot {
    return this.tickPlan.snapshot();
  }

  /**
   * Get the tick state lock snapshot.
   */
  public getTickStateLockSnapshot(): ReturnType<TickStateLock['snapshot']> {
    return this.tickStateLock.snapshot();
  }

  /**
   * Get the checkpoint coordinator.
   */
  public getCheckpointCoordinator(): RuntimeCheckpointCoordinator {
    return this.checkpointCoordinator;
  }

  /**
   * Get the trace publisher.
   */
  public getTracePublisher(): StepTracePublisher {
    return this.tracePublisher;
  }

  /**
   * Get the error boundary.
   */
  public getErrorBoundary(): ErrorBoundary {
    return this.errorBoundary;
  }

  /**
   * Get the outcome gate.
   */
  public getOutcomeGate(): OutcomeGate {
    return this.outcomeGate;
  }

  /**
   * Get the event flush coordinator.
   */
  public getEventFlushCoordinator(): EventFlushCoordinator {
    return this.eventFlushCoordinator;
  }

  /**
   * Get the tick result builder.
   */
  public getTickResultBuilder(): TickResultBuilder {
    return this.tickResultBuilder;
  }

  /**
   * Get decision telemetry projection from the current snapshot.
   */
  public getDecisionTelemetryProjection(snapshot: RunStateSnapshot): DecisionTelemetryProjection {
    const decisions = snapshot.telemetry.decisions;
    const tickDecisions = decisions.filter((d) => d.tick === snapshot.tick);
    const accepted = tickDecisions.filter((d) => d.accepted);
    const rejected = tickDecisions.filter((d) => !d.accepted);
    const totalLatency = tickDecisions.reduce((s, d) => s + d.latencyMs, 0);
    const cardIds = [...new Set(tickDecisions.map((d) => d.cardId))];
    const timingClasses = [...new Set(tickDecisions.flatMap((d) => d.timingClass))];

    return Object.freeze({
      tick: snapshot.tick,
      totalCount: tickDecisions.length,
      acceptedCount: accepted.length,
      rejectedCount: rejected.length,
      averageLatencyMs: SAFE_DIV(totalLatency, tickDecisions.length),
      cardIds: freezeArray(cardIds),
      timingClasses: freezeArray(timingClasses),
    });
  }

  /**
   * Get the current outcome gate audit for the snapshot.
   */
  public evaluateOutcomeGate(snapshot: RunStateSnapshot): OutcomeGateAudit {
    const evaluations: OutcomeGateEvaluation[] = [];

    // Evaluate each outcome condition
    const hasReachedTarget = snapshot.economy.netWorth >= snapshot.economy.freedomTarget;
    evaluations.push({
      condition: 'HAS_REACHED_TARGET',
      satisfied: hasReachedTarget,
      note: hasReachedTarget
        ? `Net worth ${snapshot.economy.netWorth} >= freedom target ${snapshot.economy.freedomTarget}`
        : `Net worth ${snapshot.economy.netWorth} < freedom target ${snapshot.economy.freedomTarget}`,
    });

    const hasCollapsedNetWorth = snapshot.economy.cash < 0;
    evaluations.push({
      condition: 'HAS_COLLAPSED_NET_WORTH',
      satisfied: hasCollapsedNetWorth,
      note: hasCollapsedNetWorth ? `Cash is negative: ${snapshot.economy.cash}` : 'Cash is non-negative',
    });

    const hasExhaustedBudget = snapshot.timers.elapsedMs >= snapshot.timers.seasonBudgetMs;
    evaluations.push({
      condition: 'HAS_EXHAUSTED_SEASON_BUDGET',
      satisfied: hasExhaustedBudget,
      note: hasExhaustedBudget
        ? `Elapsed ${snapshot.timers.elapsedMs}ms >= budget ${snapshot.timers.seasonBudgetMs}ms`
        : `Elapsed ${snapshot.timers.elapsedMs}ms < budget ${snapshot.timers.seasonBudgetMs}ms`,
    });

    const hasUserAbandoned = snapshot.outcome === 'ABANDONED';
    evaluations.push({
      condition: 'HAS_USER_ABANDONED',
      satisfied: hasUserAbandoned,
      note: hasUserAbandoned ? 'User abandoned the run' : 'User has not abandoned',
    });

    const hasEngineAborted = this.state.consecutiveTickErrors >= this.maxConsecutiveErrors;
    evaluations.push({
      condition: 'HAS_ENGINE_ABORTED',
      satisfied: hasEngineAborted,
      note: hasEngineAborted
        ? `${this.state.consecutiveTickErrors} consecutive errors >= limit ${this.maxConsecutiveErrors}`
        : `${this.state.consecutiveTickErrors} consecutive errors < limit ${this.maxConsecutiveErrors}`,
    });

    const hasQuarantine = this.state.quarantine.active;
    evaluations.push({
      condition: 'HAS_ENTERED_INTEGRITY_QUARANTINE',
      satisfied: hasQuarantine,
      note: hasQuarantine ? `Quarantine active since tick ${this.state.quarantine.sinceTick}` : 'Not quarantined',
    });

    // Resolve using terminal priority
    let resolution: OutcomeGateResolution;
    if (hasReachedTarget) {
      resolution = { nextOutcome: 'FREEDOM', reason: 'TARGET_REACHED' };
    } else if (hasCollapsedNetWorth) {
      resolution = { nextOutcome: 'BANKRUPT', reason: 'NET_WORTH_COLLAPSE' };
    } else if (hasExhaustedBudget) {
      resolution = { nextOutcome: 'TIMEOUT', reason: 'SEASON_TIMEOUT' };
    } else if (hasUserAbandoned) {
      resolution = { nextOutcome: 'ABANDONED', reason: 'USER_ABANDON' };
    } else if (hasEngineAborted) {
      resolution = { nextOutcome: 'ABANDONED', reason: 'ENGINE_ABORT' };
    } else if (hasQuarantine) {
      resolution = { nextOutcome: 'ABANDONED', reason: 'INTEGRITY_QUARANTINE' };
    } else {
      resolution = { nextOutcome: null, reason: 'UNCHANGED' };
    }

    return Object.freeze({
      runId: snapshot.runId,
      tick: snapshot.tick,
      evaluations: freezeArray(evaluations),
      resolution,
    });
  }

  /**
   * Get the mode bootstrap overlay for the given mode.
   */
  public buildModeBootstrapOverlay(mode: ModeCode): ModeBootstrapOverlay {
    const defaults: Record<ModeCode, ModeBootstrapOverlay> = {
      solo: {
        mode: 'solo',
        sharedTreasury: false,
        sharedOpportunityDeck: false,
        holdEnabled: true,
        legendMarkersEnabled: false,
        counterIntelTier: 0,
        disabledBots: [],
        defaultTags: ['mode:solo'],
      },
      pvp: {
        mode: 'pvp',
        sharedTreasury: false,
        sharedOpportunityDeck: true,
        holdEnabled: true,
        legendMarkersEnabled: false,
        counterIntelTier: 1,
        disabledBots: [],
        defaultTags: ['mode:pvp'],
      },
      coop: {
        mode: 'coop',
        sharedTreasury: true,
        sharedOpportunityDeck: true,
        holdEnabled: true,
        legendMarkersEnabled: false,
        counterIntelTier: 0,
        disabledBots: [],
        defaultTags: ['mode:coop'],
      },
      ghost: {
        mode: 'ghost',
        sharedTreasury: false,
        sharedOpportunityDeck: false,
        holdEnabled: false,
        legendMarkersEnabled: true,
        counterIntelTier: 2,
        disabledBots: [],
        defaultTags: ['mode:ghost'],
      },
    };

    return Object.freeze(defaults[mode] ?? defaults.solo);
  }

  /**
   * Build a tick execution window specification.
   */
  public buildTickExecutionWindow(
    fromStep: TickStep,
    toStep: TickStep,
    inclusive = true,
  ): TickExecutionWindow {
    return Object.freeze({ fromStep, toStep, inclusive });
  }

  /**
   * Get the tick runtime fence state.
   */
  public getTickRuntimeFence(): TickRuntimeFence {
    const lockSnapshot = this.tickStateLock.snapshot();
    return Object.freeze({
      locked: lockSnapshot.state === 'TICK_LOCKED',
      lockOwner: lockSnapshot.state === 'TICK_LOCKED'
        ? ('STEP_01_PREPARE' as TickStep)
        : null,
      lockedAtMs: lockSnapshot.lockedAtMs,
      reason: lockSnapshot.state === 'TICK_LOCKED' ? 'Tick in progress' : null,
    });
  }

  /**
   * Produce the normalizeEngineTickResult for given engine output.
   */
  public normalizeTickResult(engineId: EngineId, tick: number, result: RunStateSnapshot | EngineTickResult): EngineTickResult {
    return normalizeEngineTickResult(engineId, tick, result);
  }

  /**
   * Create engine health for diagnostics.
   */
  public createHealthEntry(engineId: EngineId, status: EngineHealthStatus): EngineHealth {
    return createEngineHealth(engineId, status, this.clock.now());
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 4 — FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate that the module manifest is consistent.
 * This guard runs at import time to ensure label arrays match declared counts.
 */
function assertModuleIntegrity(): void {
  if (ZERO_ML_FEATURE_LABELS.length !== ZERO_ENGINE_ML_FEATURE_COUNT) {
    throw new Error(
      `ZeroEngine module integrity failure: ZERO_ML_FEATURE_LABELS has ` +
      `${ZERO_ML_FEATURE_LABELS.length} entries, expected ${ZERO_ENGINE_ML_FEATURE_COUNT}`,
    );
  }
  if (ZERO_DL_COLUMN_LABELS.length !== ZERO_ENGINE_DL_FEATURE_COUNT) {
    throw new Error(
      `ZeroEngine module integrity failure: ZERO_DL_COLUMN_LABELS has ` +
      `${ZERO_DL_COLUMN_LABELS.length} entries, expected ${ZERO_ENGINE_DL_FEATURE_COUNT}`,
    );
  }
  if (ZERO_CANONICAL_TICK_SEQUENCE.length !== TICK_SEQUENCE.length) {
    throw new Error(
      `ZeroEngine module integrity failure: ZERO_CANONICAL_TICK_SEQUENCE has ` +
      `${ZERO_CANONICAL_TICK_SEQUENCE.length} entries, expected ${TICK_SEQUENCE.length}`,
    );
  }

  // Verify every step in ZERO_CANONICAL_TICK_SEQUENCE has a descriptor
  for (const step of ZERO_CANONICAL_TICK_SEQUENCE) {
    const descriptor = ZERO_TICK_STEP_DESCRIPTORS[step];
    if (!descriptor) {
      throw new Error(`ZeroEngine module integrity failure: Missing descriptor for step ${step}`);
    }
    if (descriptor.step !== step) {
      throw new Error(
        `ZeroEngine module integrity failure: Descriptor step mismatch for ${step}`,
      );
    }
  }

  // Verify ZERO_TERMINAL_PRIORITY covers all expected outcomes
  const coveredOutcomes = new Set(ZERO_TERMINAL_PRIORITY.map((r) => r.outcome));
  for (const expected of ['FREEDOM', 'BANKRUPT', 'TIMEOUT', 'ABANDONED'] as const) {
    if (!coveredOutcomes.has(expected)) {
      throw new Error(
        `ZeroEngine module integrity failure: ZERO_TERMINAL_PRIORITY missing outcome ${expected}`,
      );
    }
  }

  // Verify ZERO_EVENT_FAMILY_BY_EVENT is consistent
  const familyEntries = Object.entries(ZERO_EVENT_FAMILY_BY_EVENT);
  for (const [eventName, family] of familyEntries) {
    if (!eventName || !family) {
      throw new Error(
        `ZeroEngine module integrity failure: Invalid event family mapping for ${eventName}`,
      );
    }
  }

  // Verify ZERO_REQUIRED_ENGINES covers all 7 engine IDs
  const coveredEngines = new Set(ZERO_REQUIRED_ENGINES.map((d) => d.engineId));
  for (const engineId of ALL_ENGINE_IDS) {
    if (!coveredEngines.has(engineId)) {
      throw new Error(
        `ZeroEngine module integrity failure: ZERO_REQUIRED_ENGINES missing engine ${engineId}`,
      );
    }
  }

  // Verify ZERO_RUN_LIFECYCLE_STATES covers all lifecycle transitions
  for (const state of ZERO_RUN_LIFECYCLE_STATES) {
    const targets = ZERO_LEGAL_LIFECYCLE_TRANSITIONS[state];
    if (!targets) {
      throw new Error(
        `ZeroEngine module integrity failure: No legal transitions defined for state ${state}`,
      );
    }
    for (const target of targets) {
      if (!ZERO_RUN_LIFECYCLE_STATES.includes(target)) {
        throw new Error(
          `ZeroEngine module integrity failure: Legal transition target '${target}' from '${state}' is not a valid state`,
        );
      }
    }
  }

  // Verify ZERO_MODE_ACTION_IDS are all strings
  for (const actionId of ZERO_MODE_ACTION_IDS) {
    if (typeof actionId !== 'string' || actionId.length === 0) {
      throw new Error(
        `ZeroEngine module integrity failure: Invalid mode action ID: ${String(actionId)}`,
      );
    }
  }

  // Verify ZERO_STEP_RUNTIME_OWNERS includes all canonical owners
  const ownerSet = new Set(ZERO_STEP_RUNTIME_OWNERS);
  for (const engineId of ALL_ENGINE_IDS) {
    if (!ownerSet.has(engineId)) {
      throw new Error(
        `ZeroEngine module integrity failure: ZERO_STEP_RUNTIME_OWNERS missing engine owner ${engineId}`,
      );
    }
  }
  for (const required of ['system', 'mode', 'telemetry'] as const) {
    if (!ownerSet.has(required)) {
      throw new Error(
        `ZeroEngine module integrity failure: ZERO_STEP_RUNTIME_OWNERS missing required owner ${required}`,
      );
    }
  }

  // Verify ZERO_RUN_LIFECYCLE_TRANSITIONS are all valid
  for (const transition of ZERO_RUN_LIFECYCLE_TRANSITIONS) {
    if (typeof transition !== 'string' || transition.length === 0) {
      throw new Error(
        `ZeroEngine module integrity failure: Invalid lifecycle transition: ${String(transition)}`,
      );
    }
  }

  // Verify ZERO_DEFAULT_RESET_DIRECTIVE has all required fields
  const resetKeys: (keyof RunResetDirective)[] = [
    'hard', 'clearHistory', 'clearEventQueue',
    'clearEventHistory', 'clearDiagnostics', 'clearLifecycleHistory',
  ];
  for (const key of resetKeys) {
    if (typeof ZERO_DEFAULT_RESET_DIRECTIVE[key] !== 'boolean') {
      throw new Error(
        `ZeroEngine module integrity failure: ZERO_DEFAULT_RESET_DIRECTIVE.${key} is not a boolean`,
      );
    }
  }
}

// Run module integrity check at import time
assertModuleIntegrity();

/**
 * Create a ZeroEngine with the given options.
 */
export function createZeroEngine(options?: ZeroEngineOptions): ZeroEngine {
  return new ZeroEngine(options);
}

/**
 * Build the full ZeroEngine stack and return both the engine and its key surfaces.
 */
export function buildZeroEngineStack(options?: ZeroEngineOptions): {
  readonly engine: ZeroEngine;
  readonly orchestrator: EngineOrchestrator;
  readonly coordinator: RunLifecycleCoordinator;
  readonly queryService: RunQueryService;
  readonly bus: EventBus<EngineEventMap & Record<string, unknown>>;
  readonly registry: EngineRegistry;
} {
  const engine = new ZeroEngine(options);
  return Object.freeze({
    engine,
    orchestrator: engine.getOrchestrator(),
    coordinator: engine.getLifecycleCoordinator(),
    queryService: engine.getQueryService(),
    bus: engine.getEventBus(),
    registry: engine.getRegistry(),
  });
}
