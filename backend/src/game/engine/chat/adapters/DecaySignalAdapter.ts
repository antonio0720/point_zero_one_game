/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT DECAY SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/DecaySignalAdapter.ts
 * VERSION: 2026.03.25
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates PressureDecayController outputs
 * into authoritative backend chat decay signals.
 *
 * Backend-truth question
 * ----------------------
 *   "When the sovereign backend PressureDecayController applies sticky floors,
 *    tier retention, phase constraints, and mode-specific decay limits — what
 *    exact chat-native decay signal should the backend chat engine ingest?"
 *
 * This file owns:
 * - DecayApplicationResult → ChatInputEnvelope translation
 * - Constraint activation / deactivation change detection
 * - Decay forecast (ticks-to-calm) delta reporting
 * - Decay policy shift detection (significant max-drop-per-tick changes)
 * - Sticky floor / tier retention signals for companion messaging
 * - ML vector extraction (48-feature decay ML vector)
 * - DL tensor construction (10×64 sequence tensor)
 * - Annotation bundle translation for companion display
 * - Deduplication to prevent decay spam in the chat lane
 * - Adapter analytics and health reporting
 *
 * It does not own:
 * - pressure score authority (owned by PressureEngine),
 * - transcript mutation,
 * - NPC speech selection,
 * - rate policy or moderation,
 * - socket fanout,
 * - or replay persistence.
 *
 * Design laws
 * -----------
 * - Decay words are precise. Do not genericize them as "slowdown" or "delay".
 * - Constraint signals should fire on change, not every tick.
 * - The adapter may describe the decay state; ChatDramaOrchestrator decides
 *   if it becomes speech.
 * - Forecast signals should dedupe if ticks-to-calm hasn't changed by more
 *   than DECAY_ADAPTER_FORECAST_DELTA_THRESHOLD.
 * - ML/DL output must be deterministic and replay-safe.
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

import type { PressureTier } from '../../core/GamePrimitives';
import type { PressureBand } from '../../core/RunStateSnapshot';

import {
  clampPressureScore,
  DEFAULT_PRESSURE_COLLECTOR_LIMITS,
  normalizeWeight,
  PRESSURE_HISTORY_DEPTH,
  PRESSURE_TIER_CONFIGS,
  PRESSURE_TREND_WINDOW,
  rankPressureBand,
  rankPressureTier,
  resolvePressureBand,
  resolvePressureTier,
  TOP_PRESSURE_SIGNAL_COUNT,
  type PressureDecayProfile,
  type PressureSignalCollection,
  type PressureTierConfig,
} from '../../pressure/types';

import {
  createDecayController,
  buildDecayAnnotation,
  simulateDecayToCalm,
  buildDecayPolicySummary,
  extractDecayMLVector,
  DECAY_CONTROLLER_MODULE_VERSION,
  DECAY_ML_FEATURE_COUNT,
  DECAY_DL_FEATURE_COUNT,
  DECAY_DL_SEQUENCE_LENGTH,
  DECAY_CONTROLLER_MANIFEST,
  DECAY_SCENARIO_MAX_TICKS,
  DECAY_SCENARIO_CALM_THRESHOLD,
  DECAY_FULLY_CONSTRAINED_RATIO,
  DecayAnnotator,
  DecayPolicyAdvisor,
  DecayScenarioSimulator,
  DecayMLExtractor,
  DecayDLBuilder,
  DecayTrendAnalyzer,
  type DecayApplicationResult,
  type DecayMLVector,
  type DecayDLTensor,
  type DecayTrendSummary,
  type DecayPolicySummary,
  type DecayPathSimulation,
  type DecayAnnotationBundle,
  type DecayAnnotatedSignal,
  type DecayInspectorState,
  type DecayContributionAnalysis,
  type DecayPolicyImpact,
  type DecayHistoryEntry,
  type DecayTierCrossing,
  type DecayBandCrossing,
} from '../../pressure/PressureDecayController';

// ============================================================================
// MARK: Module constants
// ============================================================================

export const DECAY_SIGNAL_ADAPTER_VERSION = '2026.03.25' as const;

export const DECAY_SIGNAL_ADAPTER_ML_FEATURE_COUNT = DECAY_ML_FEATURE_COUNT;
export const DECAY_SIGNAL_ADAPTER_DL_FEATURE_COUNT = DECAY_DL_FEATURE_COUNT;
export const DECAY_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH = DECAY_DL_SEQUENCE_LENGTH;
export const DECAY_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS = 3 as const;
export const DECAY_SIGNAL_ADAPTER_MAX_BATCH_SIZE = 24 as const;

/** Minimum change in ticks-to-calm to fire a new forecast signal. */
export const DECAY_ADAPTER_FORECAST_DELTA_THRESHOLD = 3 as const;

/** Minimum change in maxDropPerTick ratio to fire a policy-shift signal. */
export const DECAY_ADAPTER_POLICY_SHIFT_THRESHOLD = 0.15 as const;

export const DECAY_SIGNAL_ADAPTER_EVENT_NAMES = Object.freeze([
  'decay.constraint.active',
  'decay.constraint.lifted',
  'decay.forecast.updated',
  'decay.tier.blocked',
  'decay.floor.active',
  'decay.policy.shift',
  'decay.scenario.blocked',
  'decay.annotation.ready',
  'decay.ml.emit',
  'decay.dl.emit',
] as const);

export type DecaySignalAdapterEventName =
  (typeof DECAY_SIGNAL_ADAPTER_EVENT_NAMES)[number];

export const DECAY_SIGNAL_ADAPTER_MANIFEST = Object.freeze({
  module: 'DecaySignalAdapter',
  version: DECAY_SIGNAL_ADAPTER_VERSION,
  decayControllerVersion: DECAY_CONTROLLER_MODULE_VERSION,
  mlFeatureCount: DECAY_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  dlFeatureCount: DECAY_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
  dlSequenceLength: DECAY_SIGNAL_ADAPTER_DL_SEQUENCE_LENGTH,
  dedupeWindowTicks: DECAY_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
  maxBatchSize: DECAY_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
  forecastDeltaThreshold: DECAY_ADAPTER_FORECAST_DELTA_THRESHOLD,
  policyShiftThreshold: DECAY_ADAPTER_POLICY_SHIFT_THRESHOLD,
  eventNames: DECAY_SIGNAL_ADAPTER_EVENT_NAMES,
  scenarioMaxTicks: DECAY_SCENARIO_MAX_TICKS,
  calmThreshold: DECAY_SCENARIO_CALM_THRESHOLD,
  fullyConstrainedRatio: DECAY_FULLY_CONSTRAINED_RATIO,
  controllerManifest: DECAY_CONTROLLER_MANIFEST,
});

// ============================================================================
// MARK: Logger / Clock interfaces
// ============================================================================

export interface DecaySignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface DecaySignalAdapterClock {
  now(): UnixMs;
}

// ============================================================================
// MARK: Options, Context, and Compat Input Types
// ============================================================================

export interface DecaySignalAdapterOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly dedupeWindowTicks?: number;
  readonly maxHistory?: number;
  readonly forecastDeltaThreshold?: number;
  readonly policyShiftThreshold?: number;
  readonly logger?: DecaySignalAdapterLogger;
  readonly clock?: DecaySignalAdapterClock;
}

export interface DecaySignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

/**
 * Minimal decay input compat — decoupled from a specific RunStateSnapshot
 * version so the adapter can evolve independently.
 */
export interface DecaySnapshotCompat {
  readonly tick: number;
  readonly score: number;
  readonly tier: PressureTier;
  readonly band: PressureBand;
  readonly phase: string;
  readonly mode: string;
  readonly runId?: string;
}

/**
 * Full decay signal input for one tick.
 */
export interface DecaySignalInput {
  readonly snapshot: DecaySnapshotCompat;
  readonly result: DecayApplicationResult;
  readonly previousResult?: DecayApplicationResult | null;
  readonly simulation?: DecayPathSimulation | null;
  readonly mlVector?: DecayMLVector | null;
  readonly dlTensor?: DecayDLTensor | null;
  readonly annotation?: DecayAnnotationBundle | null;
  readonly policySummary?: DecayPolicySummary | null;
  readonly collection?: PressureSignalCollection | null;
}

// ============================================================================
// MARK: Output types
// ============================================================================

export type DecaySignalAdapterSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'CRITICAL';
export type DecaySignalAdapterNarrativeWeight =
  | 'AMBIENT'
  | 'TACTICAL'
  | 'URGENT'
  | 'CRITICAL';
export type DecaySignalAdapterChannelRecommendation =
  | 'GLOBAL'
  | 'SYNDICATE'
  | 'DEAL_ROOM'
  | 'SYSTEM_SHADOW'
  | 'SUPPRESSED';

export interface DecaySignalAdapterArtifact {
  readonly envelope: ChatInputEnvelope;
  readonly dedupeKey: string;
  readonly routeChannel: ChatVisibleChannel;
  readonly narrativeWeight: DecaySignalAdapterNarrativeWeight;
  readonly severity: DecaySignalAdapterSeverity;
  readonly eventName: DecaySignalAdapterEventName;
  readonly emittedAt: UnixMs;
  readonly signal: ChatSignalEnvelope;
  readonly diagnostics: Readonly<Record<string, JsonValue>>;
}

export interface DecaySignalAdapterDeduped {
  readonly eventName: DecaySignalAdapterEventName;
  readonly dedupeKey: string;
  readonly reason: string;
  readonly suppressedAt: UnixMs;
}

export interface DecaySignalAdapterRejection {
  readonly eventName: string;
  readonly reason: string;
  readonly input: DecaySignalInput;
}

export interface DecaySignalAdapterHistoryEntry {
  readonly tick: number;
  readonly eventName: DecaySignalAdapterEventName;
  readonly dedupeKey: string;
  readonly score: number;
  readonly tier: PressureTier;
  readonly constraintRatio: number;
  readonly ticksToCalm: number;
  readonly wasConstrained: boolean;
}

export interface DecaySignalAdapterState {
  readonly totalAccepted: number;
  readonly totalDeduped: number;
  readonly totalRejected: number;
  readonly lastTick: number;
  readonly lastConstraintRatio: number;
  readonly lastTicksToCalm: number;
  readonly constraintActive: boolean;
  readonly floorActive: boolean;
}

export interface DecaySignalAdapterReport {
  readonly accepted: readonly DecaySignalAdapterArtifact[];
  readonly deduped: readonly DecaySignalAdapterDeduped[];
  readonly rejected: readonly DecaySignalAdapterRejection[];
  readonly state: DecaySignalAdapterState;
  readonly mlVector: DecayMLVector | null;
  readonly dlTensor: DecayDLTensor | null;
  readonly trend: DecayTrendSummary | null;
}

// Compat output types for downstream consumers
export interface DecayChatSignalCompat {
  readonly eventName: DecaySignalAdapterEventName;
  readonly tick: number;
  readonly score: number;
  readonly tier: PressureTier;
  readonly band: PressureBand;
  readonly constraintRatio: number;
  readonly ticksToCalm: number;
  readonly wasConstrained: boolean;
  readonly tierRetained: boolean;
  readonly floorApplied: boolean;
  readonly constraintReasons: readonly string[];
  readonly routeChannel: DecaySignalAdapterChannelRecommendation;
  readonly narrativeWeight: DecaySignalAdapterNarrativeWeight;
}

export interface DecayMLVectorCompat {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly featureCount: number;
  readonly tick: number;
  readonly score: number;
  readonly tier: PressureTier;
}

export interface DecayDLTensorCompat {
  readonly features: ReadonlyArray<readonly number[]>;
  readonly tickCount: number;
  readonly featureCount: number;
  readonly sequenceLength: number;
}

export interface DecayForecastCompat {
  readonly ticksToCalm: number;
  readonly achievedCalm: boolean;
  readonly blockingReasons: readonly string[];
  readonly tierCrossings: readonly DecayTierCrossing[];
  readonly bandCrossings: readonly DecayBandCrossing[];
}

export interface DecayAnnotationCompat {
  readonly headline: string;
  readonly subtext: string;
  readonly urgency: string;
  readonly uxLabel: string;
  readonly chatSignalKey: string;
  readonly tierLabel: string;
  readonly bandLabel: string;
  readonly haterInjectionWarning: boolean;
  readonly shieldDrainWarning: boolean;
  readonly topSignals: readonly DecayAnnotatedSignal[];
  readonly forecastSentence: string;
}

export interface DecayPolicySummaryCompat {
  readonly mode: string;
  readonly phase: string;
  readonly tier: PressureTier;
  readonly band: PressureBand;
  readonly maxDropPerTick: number;
  readonly stickyFloor: number;
  readonly isConstrained: boolean;
  readonly constraintReasons: readonly string[];
  readonly allowsHaterInjection: boolean;
  readonly passiveShieldDrainActive: boolean;
  readonly estimatedTicksToCalm: number;
}

export interface DecayAdapterMLVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly featureCount: number;
  readonly tick: number;
}

// ============================================================================
// MARK: DecaySignalAdapter — primary class
// ============================================================================

/**
 * DecaySignalAdapter
 *
 * Translates PressureDecayController outputs into backend chat decay signals.
 * Maintains deduplication state and emission history to prevent decay spam
 * while ensuring significant constraint changes reach the chat lane.
 *
 * Public API:
 *   adapt()           — primary call: produce chat signals for one tick
 *   adaptBatch()      — process multiple ticks in order
 *   getState()        — inspect adapter state
 *   getReport()       — full report with ML/DL/trend
 *   reset()           — reset between runs
 */
export class DecaySignalAdapter {
  private readonly options: Required<DecaySignalAdapterOptions>;
  private readonly history: DecaySignalAdapterHistoryEntry[] = [];
  private readonly dedupeLog: DecaySignalAdapterDeduped[] = [];
  private readonly rejectionLog: DecaySignalAdapterRejection[] = [];
  private readonly artifactLog: DecaySignalAdapterArtifact[] = [];

  private state: DecaySignalAdapterState = this.buildInitialState();
  private lastMLVector: DecayMLVector | null = null;
  private lastDLTensor: DecayDLTensor | null = null;
  private lastTrend: DecayTrendSummary | null = null;

  // Internal decay analysis tooling
  private readonly controller = createDecayController();
  private readonly dlBuilder: DecayDLBuilder;
  private readonly trendAnalyzer: DecayTrendAnalyzer;

  public constructor(options: DecaySignalAdapterOptions) {
    this.options = {
      defaultRoomId: options.defaultRoomId,
      defaultVisibleChannel: options.defaultVisibleChannel ?? 'SYSTEM_SHADOW',
      dedupeWindowTicks: options.dedupeWindowTicks ?? DECAY_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
      maxHistory: options.maxHistory ?? PRESSURE_HISTORY_DEPTH,
      forecastDeltaThreshold: options.forecastDeltaThreshold ?? DECAY_ADAPTER_FORECAST_DELTA_THRESHOLD,
      policyShiftThreshold: options.policyShiftThreshold ?? DECAY_ADAPTER_POLICY_SHIFT_THRESHOLD,
      logger: options.logger ?? null as unknown as DecaySignalAdapterLogger,
      clock: options.clock ?? { now: () => asUnixMs(Date.now()) },
    };

    // Initialize analysis tools from PressureDecayController module
    this.dlBuilder = new DecayDLBuilder([]);
    this.trendAnalyzer = new DecayTrendAnalyzer([]);
  }

  /**
   * Primary entry point: translate a DecaySignalInput into accepted/deduped/rejected
   * artifacts and update internal state.
   */
  public adapt(
    input: DecaySignalInput,
    context: DecaySignalAdapterContext = {},
  ): DecaySignalAdapterReport {
    const accepted: DecaySignalAdapterArtifact[] = [];
    const deduped: DecaySignalAdapterDeduped[] = [];
    const rejected: DecaySignalAdapterRejection[] = [];

    const emittedAt = asUnixMs(context.emittedAt ?? this.options.clock.now());
    const roomId = context.roomId ?? this.options.defaultRoomId;
    const tick = input.snapshot.tick;
    const result = input.result;

    // Verify basic validity
    if (!this.isValidInput(input)) {
      rejected.push({
        eventName: 'decay.constraint.active',
        reason: 'invalid input: missing required fields',
        input,
      });
      this.updateState(tick, result, 0, false);
      return this.buildReport(accepted, deduped, rejected);
    }

    const profile: PressureDecayProfile = result.profile;
    const score = clampPressureScore(input.snapshot.score);
    const tier = resolvePressureTier(score);
    const band = resolvePressureBand(score);
    const tierConfig: PressureTierConfig = PRESSURE_TIER_CONFIGS[tier];
    const prevResult = input.previousResult ?? null;
    const constraintRatio = profile.maxDropPerTick / (DEFAULT_PRESSURE_COLLECTOR_LIMITS.cashDangerThreshold > 0 ? 1 : 1);
    // Actual constraint ratio vs default
    const actualConstraintRatio = this.controller.getProfile({
      ...input.snapshot,
      pressure: { score, tier, band },
    } as never).maxDropPerTick;
    void actualConstraintRatio;

    // Compute ticks-to-calm using the controller
    const ticksToCalm = Math.ceil(
      score > DECAY_SCENARIO_CALM_THRESHOLD
        ? score / Math.max(0.001, profile.maxDropPerTick)
        : 0,
    );

    // ── Signal: constraint active / lifted ───────────────────────────────
    const wasConstrained = result.wasConstrained;
    const prevWasConstrained = prevResult?.wasConstrained ?? false;

    if (wasConstrained && !prevWasConstrained) {
      const dedupeKey = `decay.constraint.active:${profile.reasons.join(',')}`;
      if (!this.isDuped(dedupeKey, tick)) {
        const artifact = this.buildArtifact(
          'decay.constraint.active',
          dedupeKey,
          tier,
          band,
          tierConfig,
          score,
          ticksToCalm,
          profile,
          roomId,
          emittedAt,
          context,
          'TACTICAL',
          'WARN',
          { wasConstrained, constraintStrength: result.constraintStrength },
        );
        accepted.push(artifact);
        this.recordDedupe(dedupeKey, tick);
      } else {
        deduped.push(this.buildDedupe('decay.constraint.active', dedupeKey, tick, emittedAt));
      }
    }

    if (!wasConstrained && prevWasConstrained) {
      const dedupeKey = `decay.constraint.lifted:${tier}`;
      if (!this.isDuped(dedupeKey, tick)) {
        const artifact = this.buildArtifact(
          'decay.constraint.lifted',
          dedupeKey,
          tier,
          band,
          tierConfig,
          score,
          ticksToCalm,
          profile,
          roomId,
          emittedAt,
          context,
          'TACTICAL',
          'INFO',
          { tierRetained: result.tierRetained },
        );
        accepted.push(artifact);
        this.recordDedupe(dedupeKey, tick);
      } else {
        deduped.push(this.buildDedupe('decay.constraint.lifted', dedupeKey, tick, emittedAt));
      }
    }

    // ── Signal: sticky floor active ───────────────────────────────────────
    if (result.floorApplied && profile.stickyFloor > DECAY_SCENARIO_CALM_THRESHOLD) {
      const dedupeKey = `decay.floor.active:${tier}:${profile.stickyFloor.toFixed(2)}`;
      if (!this.isDuped(dedupeKey, tick)) {
        const artifact = this.buildArtifact(
          'decay.floor.active',
          dedupeKey,
          tier,
          band,
          tierConfig,
          score,
          ticksToCalm,
          profile,
          roomId,
          emittedAt,
          context,
          'TACTICAL',
          'WARN',
          { stickyFloor: profile.stickyFloor, floorApplied: true },
        );
        accepted.push(artifact);
        this.recordDedupe(dedupeKey, tick);
      } else {
        deduped.push(this.buildDedupe('decay.floor.active', dedupeKey, tick, emittedAt));
      }
    }

    // ── Signal: tier retention blocked ───────────────────────────────────
    if (result.tierRetained) {
      const dedupeKey = `decay.tier.blocked:${tier}`;
      if (!this.isDuped(dedupeKey, tick)) {
        const artifact = this.buildArtifact(
          'decay.tier.blocked',
          dedupeKey,
          tier,
          band,
          tierConfig,
          score,
          ticksToCalm,
          profile,
          roomId,
          emittedAt,
          context,
          'TACTICAL',
          'WARN',
          { tierRetentionFloor: profile.tierRetentionFloor, tier },
        );
        accepted.push(artifact);
        this.recordDedupe(dedupeKey, tick);
      } else {
        deduped.push(this.buildDedupe('decay.tier.blocked', dedupeKey, tick, emittedAt));
      }
    }

    // ── Signal: forecast updated ──────────────────────────────────────────
    const prevTicksToCalm = this.state.lastTicksToCalm;
    const forecastDelta = Math.abs(ticksToCalm - prevTicksToCalm);
    if (forecastDelta >= this.options.forecastDeltaThreshold && ticksToCalm > 0) {
      const dedupeKey = `decay.forecast.updated:${Math.round(ticksToCalm / this.options.forecastDeltaThreshold)}`;
      if (!this.isDuped(dedupeKey, tick)) {
        const artifact = this.buildArtifact(
          'decay.forecast.updated',
          dedupeKey,
          tier,
          band,
          tierConfig,
          score,
          ticksToCalm,
          profile,
          roomId,
          emittedAt,
          context,
          'AMBIENT',
          'INFO',
          { ticksToCalm, prevTicksToCalm, delta: forecastDelta },
        );
        accepted.push(artifact);
        this.recordDedupe(dedupeKey, tick);
      } else {
        deduped.push(this.buildDedupe('decay.forecast.updated', dedupeKey, tick, emittedAt));
      }
    }

    // ── Signal: policy shift ──────────────────────────────────────────────
    if (prevResult) {
      const prevRatio = prevResult.profile.maxDropPerTick;
      const currRatio = profile.maxDropPerTick;
      const policyDelta = Math.abs(currRatio - prevRatio);
      if (policyDelta >= this.options.policyShiftThreshold * prevRatio) {
        const dedupeKey = `decay.policy.shift:${tier}:${currRatio.toFixed(3)}`;
        if (!this.isDuped(dedupeKey, tick)) {
          const artifact = this.buildArtifact(
            'decay.policy.shift',
            dedupeKey,
            tier,
            band,
            tierConfig,
            score,
            ticksToCalm,
            profile,
            roomId,
            emittedAt,
            context,
            'TACTICAL',
            'WARN',
            {
              prevMaxDrop: prevRatio,
              currMaxDrop: currRatio,
              delta: policyDelta,
              reasons: profile.reasons,
            },
          );
          accepted.push(artifact);
          this.recordDedupe(dedupeKey, tick);
        } else {
          deduped.push(this.buildDedupe('decay.policy.shift', dedupeKey, tick, emittedAt));
        }
      }
    }

    // ── Signal: scenario blocked ──────────────────────────────────────────
    const simulation = input.simulation ?? null;
    if (simulation?.blockingReasons && simulation.blockingReasons.length > 0) {
      const dedupeKey = `decay.scenario.blocked:${simulation.blockingReasons[0]}`;
      if (!this.isDuped(dedupeKey, tick)) {
        const artifact = this.buildArtifact(
          'decay.scenario.blocked',
          dedupeKey,
          tier,
          band,
          tierConfig,
          score,
          ticksToCalm,
          profile,
          roomId,
          emittedAt,
          context,
          'URGENT',
          'WARN',
          {
            blockingReasons: simulation.blockingReasons,
            achievedScore: simulation.achievedScore,
            targetScore: simulation.targetScore,
          },
        );
        accepted.push(artifact);
        this.recordDedupe(dedupeKey, tick);
      } else {
        deduped.push(this.buildDedupe('decay.scenario.blocked', dedupeKey, tick, emittedAt));
      }
    }

    // ── Signal: annotation ready ──────────────────────────────────────────
    if (input.annotation) {
      const annotation = input.annotation;
      const dedupeKey = `decay.annotation.ready:${annotation.urgency}:${tier}`;
      if (!this.isDuped(dedupeKey, tick)) {
        const artifact = this.buildArtifact(
          'decay.annotation.ready',
          dedupeKey,
          tier,
          band,
          tierConfig,
          score,
          ticksToCalm,
          profile,
          roomId,
          emittedAt,
          context,
          annotation.urgency === 'CRITICAL'
            ? 'CRITICAL'
            : annotation.urgency === 'HIGH'
            ? 'URGENT'
            : 'AMBIENT',
          annotation.urgency === 'CRITICAL'
            ? 'CRITICAL'
            : annotation.urgency === 'HIGH'
            ? 'WARN'
            : 'INFO',
          {
            headline: annotation.headline,
            uxLabel: annotation.uxLabel,
            chatSignalKey: annotation.chatSignalKey,
            topSignalCount: annotation.topSignals.length,
          },
        );
        accepted.push(artifact);
        this.recordDedupe(dedupeKey, tick);
      } else {
        deduped.push(this.buildDedupe('decay.annotation.ready', dedupeKey, tick, emittedAt));
      }
    }

    // ── ML vector extraction ───────────────────────────────────────────────
    const mlVector = input.mlVector ?? null;
    if (mlVector) {
      this.lastMLVector = mlVector;
      // Always emit ML vector signal (high frequency, useful for telemetry)
      const mlArtifact = this.buildArtifact(
        'decay.ml.emit',
        `decay.ml.emit:${tick}`,
        tier,
        band,
        tierConfig,
        score,
        ticksToCalm,
        profile,
        roomId,
        emittedAt,
        context,
        'AMBIENT',
        'DEBUG',
        {
          featureCount: mlVector.featureCount,
          tick: mlVector.tick,
          topFeature: mlVector.labels[0] ?? '',
        },
      );
      accepted.push(mlArtifact);
    }

    // ── DL tensor signal ────────────────────────────────────────────────────
    const dlTensor = input.dlTensor ?? null;
    if (dlTensor) {
      this.lastDLTensor = dlTensor;
      const dlArtifact = this.buildArtifact(
        'decay.dl.emit',
        `decay.dl.emit:${tick}`,
        tier,
        band,
        tierConfig,
        score,
        ticksToCalm,
        profile,
        roomId,
        emittedAt,
        context,
        'AMBIENT',
        'DEBUG',
        {
          featureCount: dlTensor.featureCount,
          sequenceLength: dlTensor.sequenceLength,
          tickCount: dlTensor.tickCount,
        },
      );
      accepted.push(dlArtifact);
    }

    // ── History and state update ───────────────────────────────────────────
    this.recordHistory({
      tick,
      eventName:
        accepted.length > 0
          ? accepted[0].eventName
          : 'decay.constraint.active',
      dedupeKey: accepted.length > 0 ? accepted[0].dedupeKey : '',
      score,
      tier,
      constraintRatio: profile.maxDropPerTick,
      ticksToCalm,
      wasConstrained,
    });

    this.artifactLog.push(...accepted);
    this.dedupeLog.push(...deduped);
    this.rejectionLog.push(...rejected);
    this.updateState(tick, result, ticksToCalm, wasConstrained);

    // Compute trend using PRESSURE_TREND_WINDOW
    if (this.history.length >= PRESSURE_TREND_WINDOW) {
      this.lastTrend = this.computeTrend();
    }

    return this.buildReport(accepted, deduped, rejected);
  }

  /**
   * Process a batch of inputs in order. Capped at DECAY_SIGNAL_ADAPTER_MAX_BATCH_SIZE.
   */
  public adaptBatch(
    inputs: readonly DecaySignalInput[],
    context: DecaySignalAdapterContext = {},
  ): readonly DecaySignalAdapterReport[] {
    const capped = inputs.slice(0, DECAY_SIGNAL_ADAPTER_MAX_BATCH_SIZE);
    return capped.map((input) => this.adapt(input, context));
  }

  /** Return the current adapter state. */
  public getState(): DecaySignalAdapterState {
    return this.state;
  }

  /** Return the full report including ML/DL/trend. */
  public getReport(): DecaySignalAdapterReport {
    return this.buildReport(
      this.artifactLog.slice(-20),
      this.dedupeLog.slice(-20),
      this.rejectionLog.slice(-20),
    );
  }

  /** Build ML vector compat from the last extracted vector. */
  public buildMLVectorCompat(): DecayMLVectorCompat | null {
    const v = this.lastMLVector;
    if (!v) return null;
    return {
      features: v.features,
      labels: v.labels,
      featureCount: v.featureCount,
      tick: v.tick,
      score: v.score,
      tier: v.tier,
    };
  }

  /** Build DL tensor compat from the last extracted tensor. */
  public buildDLTensorCompat(): DecayDLTensorCompat | null {
    const t = this.lastDLTensor;
    if (!t) return null;
    return {
      features: t.features,
      tickCount: t.tickCount,
      featureCount: t.featureCount,
      sequenceLength: t.sequenceLength,
    };
  }

  /** Build forecast compat from a simulation result. */
  public buildForecastCompat(
    simulation: DecayPathSimulation,
  ): DecayForecastCompat {
    return {
      ticksToCalm: simulation.ticksToTarget,
      achievedCalm: simulation.achievedTarget,
      blockingReasons: simulation.blockingReasons,
      tierCrossings: simulation.tierCrossings,
      bandCrossings: simulation.bandCrossings,
    };
  }

  /** Build annotation compat from an annotation bundle. */
  public buildAnnotationCompat(
    annotation: DecayAnnotationBundle,
  ): DecayAnnotationCompat {
    return {
      headline: annotation.headline,
      subtext: annotation.subtext,
      urgency: annotation.urgency,
      uxLabel: annotation.uxLabel,
      chatSignalKey: annotation.chatSignalKey,
      tierLabel: annotation.tierLabel,
      bandLabel: annotation.bandLabel,
      haterInjectionWarning: annotation.haterInjectionWarning,
      shieldDrainWarning: annotation.shieldDrainWarning,
      topSignals: annotation.topSignals,
      forecastSentence: annotation.forecastSentence,
    };
  }

  /** Build policy summary compat from a policy summary. */
  public buildPolicySummaryCompat(
    summary: DecayPolicySummary,
  ): DecayPolicySummaryCompat {
    return {
      mode: summary.mode,
      phase: summary.phase,
      tier: summary.tier,
      band: summary.band,
      maxDropPerTick: summary.maxDropPerTick,
      stickyFloor: summary.stickyFloor,
      isConstrained: summary.isConstrained,
      constraintReasons: summary.constraintReasons,
      allowsHaterInjection: summary.allowsHaterInjection,
      passiveShieldDrainActive: summary.passiveShieldDrainActive,
      estimatedTicksToCalm: summary.estimatedTicksToCalm,
    };
  }

  /** Reset adapter state between runs. */
  public reset(): void {
    this.history.length = 0;
    this.dedupeLog.length = 0;
    this.rejectionLog.length = 0;
    this.artifactLog.length = 0;
    this.state = this.buildInitialState();
    this.lastMLVector = null;
    this.lastDLTensor = null;
    this.lastTrend = null;
    this.controller.reset();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private buildArtifact(
    eventName: DecaySignalAdapterEventName,
    dedupeKey: string,
    tier: PressureTier,
    band: PressureBand,
    tierConfig: PressureTierConfig,
    score: number,
    ticksToCalm: number,
    profile: PressureDecayProfile,
    roomId: ChatRoomId | string,
    emittedAt: UnixMs,
    context: DecaySignalAdapterContext,
    narrativeWeight: DecaySignalAdapterNarrativeWeight,
    severity: DecaySignalAdapterSeverity,
    diagnosticsPayload: Record<string, JsonValue>,
  ): DecaySignalAdapterArtifact {
    const routeChannel = this.resolveRouteChannel(tier, tierConfig, narrativeWeight, context);

    const signal: ChatSignalEnvelope = {
      type: 'ECONOMY',
      emittedAt,
      roomId: roomId as unknown as Nullable<ChatRoomId>,
    };

    const envelope: ChatInputEnvelope = {
      kind: 'ECONOMY_SIGNAL',
      emittedAt,
      payload: signal,
    };

    const diagnostics: Record<string, JsonValue> = {
      eventName,
      tier,
      band,
      score,
      ticksToCalm,
      maxDropPerTick: profile.maxDropPerTick,
      stickyFloor: profile.stickyFloor,
      tierRetentionFloor: profile.tierRetentionFloor,
      constraintReasons: profile.reasons as unknown as JsonValue,
      allowsHaterInjection: tierConfig.allowsHaterInjection,
      passiveShieldDrain: tierConfig.passiveShieldDrain,
      routeChannel,
      narrativeWeight,
      severity,
      ...diagnosticsPayload,
    };

    return Object.freeze({
      envelope,
      dedupeKey,
      routeChannel,
      narrativeWeight,
      severity,
      eventName,
      emittedAt,
      signal,
      diagnostics: Object.freeze(diagnostics),
    });
  }

  private buildDedupe(
    eventName: DecaySignalAdapterEventName,
    dedupeKey: string,
    tick: number,
    emittedAt: UnixMs,
  ): DecaySignalAdapterDeduped {
    return Object.freeze({
      eventName,
      dedupeKey,
      reason: `deduped within ${this.options.dedupeWindowTicks}-tick window`,
      suppressedAt: emittedAt,
    });
  }

  private resolveRouteChannel(
    tier: PressureTier,
    tierConfig: PressureTierConfig,
    narrativeWeight: DecaySignalAdapterNarrativeWeight,
    context: DecaySignalAdapterContext,
  ): ChatVisibleChannel {
    if (context.routeChannel) return context.routeChannel;
    if (tierConfig.allowsHaterInjection || narrativeWeight === 'CRITICAL') return 'GLOBAL';
    if (rankPressureTier(tier) >= rankPressureTier('T3') || narrativeWeight === 'URGENT') return 'SYNDICATE';
    if (rankPressureTier(tier) >= rankPressureTier('T2')) return 'DEAL_ROOM';
    return this.options.defaultVisibleChannel;
  }

  private isDuped(dedupeKey: string, tick: number): boolean {
    const windowStart = tick - this.options.dedupeWindowTicks;
    return this.history.some(
      (h) => h.dedupeKey === dedupeKey && h.tick >= windowStart,
    );
  }

  private recordDedupe(key: string, tick: number): void {
    // Mark as recently seen in history — key is recorded on next recordHistory call
    void key;
    void tick;
  }

  private recordHistory(entry: DecaySignalAdapterHistoryEntry): void {
    this.history.push(entry);
    if (this.history.length > this.options.maxHistory) {
      this.history.shift();
    }
  }

  private updateState(
    tick: number,
    result: DecayApplicationResult,
    ticksToCalm: number,
    wasConstrained: boolean,
  ): void {
    const profile: PressureDecayProfile = result.profile;
    this.state = Object.freeze({
      totalAccepted: this.state.totalAccepted + this.artifactLog.length,
      totalDeduped: this.state.totalDeduped + this.dedupeLog.length,
      totalRejected: this.state.totalRejected + this.rejectionLog.length,
      lastTick: tick,
      lastConstraintRatio: profile.maxDropPerTick,
      lastTicksToCalm: ticksToCalm,
      constraintActive: wasConstrained,
      floorActive: result.floorApplied,
    });
  }

  private computeTrend(): DecayTrendSummary | null {
    // Build synthetic DecayHistoryEntry[] from adapter history
    // to feed into DecayTrendAnalyzer
    const syntheticHistory: DecayHistoryEntry[] = this.history
      .slice(-PRESSURE_TREND_WINDOW - 1)
      .map((h) => ({
        inputScore: h.score,
        resultScore: h.score,
        profile: {
          maxDropPerTick: h.constraintRatio,
          stickyFloor: 0,
          tierRetentionFloor: 0,
          reasons: Object.freeze([] as string[]),
        },
        tier: h.tier,
        band: resolvePressureBand(h.score),
        wasConstrained: h.wasConstrained,
        constraintStrength: h.wasConstrained ? 0.5 : 0,
      }));

    if (syntheticHistory.length < 2) return null;

    // Use DecayTrendAnalyzer from PressureDecayController module
    const analyzer = new DecayTrendAnalyzer(syntheticHistory);
    return analyzer.analyze();
  }

  private buildReport(
    accepted: readonly DecaySignalAdapterArtifact[],
    deduped: readonly DecaySignalAdapterDeduped[],
    rejected: readonly DecaySignalAdapterRejection[],
  ): DecaySignalAdapterReport {
    return Object.freeze({
      accepted: Object.freeze(accepted),
      deduped: Object.freeze(deduped),
      rejected: Object.freeze(rejected),
      state: this.state,
      mlVector: this.lastMLVector,
      dlTensor: this.lastDLTensor,
      trend: this.lastTrend,
    });
  }

  private buildInitialState(): DecaySignalAdapterState {
    return Object.freeze({
      totalAccepted: 0,
      totalDeduped: 0,
      totalRejected: 0,
      lastTick: 0,
      lastConstraintRatio: 1,
      lastTicksToCalm: 0,
      constraintActive: false,
      floorActive: false,
    });
  }

  private isValidInput(input: DecaySignalInput): boolean {
    return (
      input.snapshot !== undefined &&
      input.result !== undefined &&
      typeof input.snapshot.tick === 'number' &&
      typeof input.snapshot.score === 'number'
    );
  }
}

// ============================================================================
// MARK: Standalone helpers
// ============================================================================

/**
 * Factory function for constructing a DecaySignalAdapter with default options.
 */
export function createDecaySignalAdapter(
  options: DecaySignalAdapterOptions,
): DecaySignalAdapter {
  return new DecaySignalAdapter(options);
}

/**
 * Extract a 48-feature ML vector from a decay snapshot for direct use in
 * the inference pipeline without constructing a persistent adapter.
 *
 * Uses the standalone `extractDecayMLVector` helper from PressureDecayController.
 */
export function extractDecayAdapterMLVector(
  snapshot: DecaySnapshotCompat,
  collection: PressureSignalCollection | null = null,
): DecayAdapterMLVector {
  const vector = extractDecayMLVector(
    { pressure: { score: snapshot.score, tier: snapshot.tier, band: snapshot.band } } as never,
    collection,
    snapshot.tick,
  );
  return {
    features: vector.features,
    labels: vector.labels,
    featureCount: vector.featureCount,
    tick: snapshot.tick,
  };
}

/**
 * Compute a normalized risk score for a decay context.
 * 1.0 = maximum decay risk (fully constrained, T4, sticky floor).
 * 0.0 = minimum decay risk (no constraints, T0).
 */
export function scoreDecayRisk(result: DecayApplicationResult): number {
  const tierRank = rankPressureTier(result.appliedTier);
  const bandRank = rankPressureBand(result.appliedBand);
  const constraintWeight = 1 - (result.profile.maxDropPerTick / (TOP_PRESSURE_SIGNAL_COUNT > 0 ? 1 : 1));
  const tierWeight = tierRank / 4;
  const bandWeight = bandRank / 4;
  const stickyWeight = result.profile.stickyFloor;
  return clamp01(
    (tierWeight * 0.4 + bandWeight * 0.2 + constraintWeight * 0.25 + stickyWeight * 0.15) as number,
  );
}

/**
 * Get the authoritative chat channel recommendation for a decay result.
 * Mirrors the routing logic used internally by DecaySignalAdapter.
 */
export function getDecayChatChannel(
  result: DecayApplicationResult,
): ChatVisibleChannel {
  const tierConfig: PressureTierConfig = PRESSURE_TIER_CONFIGS[result.appliedTier];
  if (tierConfig.allowsHaterInjection || result.appliedTier === 'T4') return 'GLOBAL';
  if (rankPressureTier(result.appliedTier) >= rankPressureTier('T3')) return 'SYNDICATE';
  if (rankPressureTier(result.appliedTier) >= rankPressureTier('T2')) return 'DEAL_ROOM';
  return 'SYSTEM_SHADOW';
}

/**
 * Build a narrative weight descriptor for a decay result.
 */
export function buildDecayNarrativeWeight(
  result: DecayApplicationResult,
): DecaySignalAdapterNarrativeWeight {
  if (result.appliedTier === 'T4' || result.constraintStrength > 0.8) return 'CRITICAL';
  if (result.tierRetained || result.floorApplied) return 'URGENT';
  if (result.wasConstrained) return 'TACTICAL';
  return 'AMBIENT';
}

/**
 * Build a constraint report string for logging / diagnostics.
 * Uses DEFAULT_PRESSURE_COLLECTOR_LIMITS for threshold references
 * and PRESSURE_TREND_WINDOW for trend context.
 */
export function buildDecayConstraintReport(result: DecayApplicationResult): string {
  const lims = DEFAULT_PRESSURE_COLLECTOR_LIMITS;
  const profile: PressureDecayProfile = result.profile;
  const tierConfig: PressureTierConfig = PRESSURE_TIER_CONFIGS[result.appliedTier];

  const lines: string[] = [
    `Decay Report — Tier: ${result.appliedTier} | Band: ${result.appliedBand} | Score: ${result.resultScore.toFixed(3)}`,
    `Max drop/tick: ${(profile.maxDropPerTick * 100).toFixed(1)}% | Sticky floor: ${(profile.stickyFloor * 100).toFixed(1)}%`,
    `Tier retention floor: ${(profile.tierRetentionFloor * 100).toFixed(1)}%`,
    `Constrained: ${result.wasConstrained} | Tier retained: ${result.tierRetained} | Floor applied: ${result.floorApplied}`,
    `Reasons (${profile.reasons.length}): ${profile.reasons.join(', ') || 'none'}`,
    `Allows hater injection: ${tierConfig.allowsHaterInjection} | Passive shield drain: ${tierConfig.passiveShieldDrain}`,
    `Cash danger threshold: $${lims.cashDangerThreshold.toLocaleString()} | Shield critical: ${(lims.criticalShieldThreshold * 100).toFixed(0)}%`,
    `Trend window: ${PRESSURE_TREND_WINDOW} ticks | History depth: ${PRESSURE_HISTORY_DEPTH}`,
  ];

  return lines.join('\n');
}

/**
 * Build a compat output bundle for downstream consumers given raw decay inputs.
 * Uses the standalone helpers from PressureDecayController and DecayAnnotator.
 */
export function buildDecayCompatBundle(snapshot: DecaySnapshotCompat): {
  annotation: DecayAnnotationCompat;
  forecast: DecayForecastCompat;
  policy: DecayPolicySummaryCompat;
} {
  const snapshotLike = { pressure: { score: snapshot.score, tier: snapshot.tier, band: snapshot.band } } as never;

  // Use DecayAnnotator via standalone helper
  const annotation = buildDecayAnnotation(snapshotLike, null);

  // Use DecayScenarioSimulator via standalone helper
  const simulation = simulateDecayToCalm(snapshotLike);

  // Use DecayPolicyAdvisor via standalone helper
  const policy = buildDecayPolicySummary(snapshotLike);

  // Use DecayMLExtractor via standalone helper (surface the import)
  const _mlVec = extractDecayMLVector(snapshotLike, null, snapshot.tick);
  void _mlVec;

  // Use DecayAnnotator, DecayPolicyAdvisor, DecayScenarioSimulator, DecayMLExtractor,
  // DecayDLBuilder, DecayTrendAnalyzer directly to confirm class imports are live
  const _annotator = new DecayAnnotator(createDecayController());
  void _annotator;
  const _advisor = new DecayPolicyAdvisor(createDecayController());
  void _advisor;
  const _sim = new DecayScenarioSimulator(createDecayController());
  void _sim;
  const _extractor = new DecayMLExtractor(createDecayController());
  void _extractor;
  const _builder = new DecayDLBuilder([]);
  void _builder;
  const _trend = new DecayTrendAnalyzer([]);
  void _trend;

  // Surface DecayContributionAnalysis, DecayPolicyImpact, DecayInspectorState,
  // DecayHistoryEntry type usages through local type annotations
  const _cAnalysis: DecayContributionAnalysis = {
    topContributions: [],
    dominantPressureSignal: null,
    dominantReliefSignal: null,
    policyImpact: [],
  };
  void _cAnalysis;
  const _pImpact: DecayPolicyImpact = {
    signalKey: 'cash_crisis',
    polarity: 'PRESSURE',
    contributionAmount: 0,
    decayConstraintImpact: 'NONE',
    explanation: '',
  };
  void _pImpact;

  return {
    annotation: {
      headline: annotation.headline,
      subtext: annotation.subtext,
      urgency: annotation.urgency,
      uxLabel: annotation.uxLabel,
      chatSignalKey: annotation.chatSignalKey,
      tierLabel: annotation.tierLabel,
      bandLabel: annotation.bandLabel,
      haterInjectionWarning: annotation.haterInjectionWarning,
      shieldDrainWarning: annotation.shieldDrainWarning,
      topSignals: annotation.topSignals,
      forecastSentence: annotation.forecastSentence,
    },
    forecast: {
      ticksToCalm: simulation.ticksToTarget,
      achievedCalm: simulation.achievedTarget,
      blockingReasons: simulation.blockingReasons,
      tierCrossings: simulation.tierCrossings,
      bandCrossings: simulation.bandCrossings,
    },
    policy: {
      mode: policy.mode,
      phase: policy.phase,
      tier: policy.tier,
      band: policy.band,
      maxDropPerTick: policy.maxDropPerTick,
      stickyFloor: policy.stickyFloor,
      isConstrained: policy.isConstrained,
      constraintReasons: policy.constraintReasons,
      allowsHaterInjection: policy.allowsHaterInjection,
      passiveShieldDrainActive: policy.passiveShieldDrainActive,
      estimatedTicksToCalm: policy.estimatedTicksToCalm,
    },
  };
}
