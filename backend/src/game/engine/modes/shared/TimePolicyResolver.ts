/*
 * POINT ZERO ONE — BACKEND ENGINE MODE SHARED
 * /backend/src/game/engine/modes/shared/TimePolicyResolver.ts
 *
 * Doctrine:
 * - time policy resolution is authoritative and deterministic
 * - every snapshot must carry its own resolved policy — no stale reads
 * - mode + tier + phase is the full context required for policy resolution
 * - ML adaptive timing is derived on the fly from live telemetry signals
 * - this resolver feeds EngineOrchestrator, not individual engines
 */

import type {
  ModeCode,
  PressureTier,
  RunPhase,
} from '../../core/GamePrimitives';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import type { RunFactoryInput } from '../../core/RunStateFactory';
import {
  cloneJson,
  deepFreeze,
} from '../../core/Deterministic';
import {
  TIER_CONFIGS,
  MODE_TIME_POLICIES,
  PHASE_MODIFIERS,
  computeEffectiveDurationMs,
  computeEffectiveDecisionWindowMs,
  computeEffectiveHoldWindowMs,
  computeAutoResolveFallbackMs,
  computeSeasonBudgetMs,
  computePolicyLockWindowMs,
  requiresTierInterpolation,
  computeInterpolationSteps,
  normalizeTierFeatures,
  clampDurationForTier,
  classifyUrgency,
  tierFromPressureScore,
  serializePolicyForHash,
  mergePolicies,
  deriveTimingFeatureVector,
  isDurationInBoundsForTier,
  type ModeTimePolicy,
  type ResolvedTimePolicy,
  type TimePolicyFactoryPatch,
  type TimePolicyTierConfig,
  type TimePolicyPhaseModifier,
  type ResolvedTimePolicyMLContext,
  type UrgencyLevel,
} from './TimePolicyContracts';

// ============================================================================
// MARK: Constants
// ============================================================================

const DEFAULT_MODEL_VERSION = 'time-policy-v1.0';
const ML_CONFIDENCE_BASE = 0.72;
const ML_ADAPTATION_DECAY = 0.95;
const MIN_FEATURE_CONFIDENCE = 0.4;
const MAX_FEATURE_CONFIDENCE = 0.98;

const PRESSURE_TIER_ORDER: readonly PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];

const TICK_DURATION_OVERRIDE_KEY = 'time_policy:tick_duration_override';
const DECISION_WINDOW_OVERRIDE_KEY = 'time_policy:decision_window_override';

// ============================================================================
// MARK: Resolver Options
// ============================================================================

export interface TimePolicyResolverOptions {
  readonly modelVersion?: string;
  readonly adaptiveWindowEnabled?: boolean;
  readonly mlConfidenceThreshold?: number;
  readonly policyLockEnabled?: boolean;
}

// ============================================================================
// MARK: Policy Diagnostics
// ============================================================================

export interface PolicyResolutionDiagnostic {
  readonly mode: ModeCode;
  readonly tier: PressureTier;
  readonly phase: RunPhase;
  readonly resolvedDurationMs: number;
  readonly tierConfigDurationMs: number;
  readonly phaseModifierMultiplier: number;
  readonly bleedModeActive: boolean;
  readonly bleedMultiplier: number;
  readonly urgencyLevel: UrgencyLevel;
  readonly lockWindowMs: number;
  readonly interpolationRequired: boolean;
  readonly interpolationSteps: number;
  readonly normalizedFeatures: Readonly<Record<string, number>>;
  readonly mlContext: ResolvedTimePolicyMLContext;
  readonly issueFlags: readonly string[];
}

// ============================================================================
// MARK: Adaptive Timing State
// ============================================================================

interface AdaptiveTimingEntry {
  readonly mode: ModeCode;
  readonly tier: PressureTier;
  readonly observedLatencies: number[];
  readonly adaptationWeight: number;
  readonly lastUpdatedAtTick: number;
}

// ============================================================================
// MARK: TimePolicyResolver
// ============================================================================

/**
 * TimePolicyResolver is the canonical timing authority for the EngineOrchestrator.
 *
 * It compiles mode + pressure + phase into a single ResolvedTimePolicy that
 * every engine step consumes. It also manages the adaptive ML timing layer
 * that learns from observed decision latencies to fine-tune window durations.
 */
export class TimePolicyResolver {
  private readonly modelVersion: string;
  private readonly adaptiveWindowEnabled: boolean;
  private readonly mlConfidenceThreshold: number;
  private readonly policyLockEnabled: boolean;

  private readonly adaptiveState = new Map<string, AdaptiveTimingEntry>();
  private lastPolicyLockTick: number | null = null;
  private lockedTier: PressureTier | null = null;

  public constructor(options: TimePolicyResolverOptions = {}) {
    this.modelVersion = options.modelVersion ?? DEFAULT_MODEL_VERSION;
    this.adaptiveWindowEnabled = options.adaptiveWindowEnabled ?? true;
    this.mlConfidenceThreshold = Math.max(
      MIN_FEATURE_CONFIDENCE,
      Math.min(MAX_FEATURE_CONFIDENCE, options.mlConfidenceThreshold ?? ML_CONFIDENCE_BASE),
    );
    this.policyLockEnabled = options.policyLockEnabled ?? true;
  }

  // ============================================================================
  // MARK: Public API
  // ============================================================================

  /**
   * Compute the timing factory patch to apply when creating a new run.
   * This ensures the initial snapshot has mode-native timing from tick zero.
   */
  public resolveFactoryPatch(input: RunFactoryInput): TimePolicyFactoryPatch {
    const mode = this.normalizeMode(input.mode as ModeCode);
    const policy = MODE_TIME_POLICIES[mode];
    const communityHeatModifier = typeof input.communityHeatModifier === 'number'
      ? input.communityHeatModifier
      : 1.0;

    const seasonBudgetMs = computeSeasonBudgetMs(mode, communityHeatModifier);
    const currentTickDurationMs = clampDurationForTier('T1', policy.tierConfigs['T1'].defaultDurationMs);

    return {
      seasonBudgetMs,
      currentTickDurationMs,
      holdCharges: policy.defaultHoldCharges,
      holdEnabled: policy.holdEnabled,
      extensionBudgetCap: policy.extensionBudgetCap,
    };
  }

  /**
   * Apply mode-native timing corrections to a live snapshot.
   * Called by the orchestrator after each engine step to keep timing sane.
   */
  public applySnapshot(snapshot: RunStateSnapshot, nowMs: number): RunStateSnapshot {
    const mode = snapshot.mode;
    const tier = this.resolveTier(snapshot);
    const phase = snapshot.phase;
    const bleedMode = snapshot.modeState.bleedMode;

    const resolvedDurationMs = computeEffectiveDurationMs(mode, tier, phase, bleedMode);
    const resolvedDecisionWindowMs = computeEffectiveDecisionWindowMs(mode, tier, phase, bleedMode);

    const current = snapshot.timers.currentTickDurationMs;
    if (isDurationInBoundsForTier(tier, current)) {
      return snapshot;
    }

    const next = cloneJson(snapshot) as { -readonly [K in keyof RunStateSnapshot]: RunStateSnapshot[K] };
    next.timers = {
      ...next.timers,
      currentTickDurationMs: resolvedDurationMs,
      nextTickAtMs: snapshot.outcome === null ? nowMs + resolvedDurationMs : null,
    };

    void resolvedDecisionWindowMs;

    return deepFreeze(next) as RunStateSnapshot;
  }

  /**
   * Resolve the full policy snapshot for the given state.
   * This is the primary read surface for orchestrators and engines.
   */
  public resolveSnapshot(opts: {
    readonly snapshot: RunStateSnapshot;
    readonly nowMs: number;
  }): ResolvedTimePolicy {
    const { snapshot, nowMs } = opts;
    const mode = snapshot.mode;
    const tier = this.resolveTier(snapshot);
    const phase = snapshot.phase;
    const bleedMode = snapshot.modeState.bleedMode;
    const policy = MODE_TIME_POLICIES[mode];
    const tierConfig = TIER_CONFIGS[tier];
    const phaseModifier = PHASE_MODIFIERS[phase];

    const resolvedTickDurationMs = computeEffectiveDurationMs(mode, tier, phase, bleedMode);
    const resolvedDecisionWindowMs = computeEffectiveDecisionWindowMs(mode, tier, phase, bleedMode);
    const resolvedHoldWindowMs = computeEffectiveHoldWindowMs(mode, tier, phase);
    const resolvedAutoResolveFallbackMs = computeAutoResolveFallbackMs(mode, tier, phase);
    const bleedModeEffectiveDurationMs = bleedMode
      ? Math.trunc(resolvedTickDurationMs * policy.bleedModeTickMultiplier)
      : resolvedTickDurationMs;

    const ml = this.buildMLContext(snapshot, mode, tier, phase, bleedMode, nowMs);

    const resolved: ResolvedTimePolicy = {
      mode,
      phase,
      tier,
      tierConfig,
      phaseModifier,
      resolvedTickDurationMs,
      resolvedDecisionWindowMs,
      resolvedHoldWindowMs,
      resolvedAutoResolveFallbackMs,
      bleedModeActive: bleedMode,
      bleedModeEffectiveDurationMs,
      seasonBudgetMs: policy.seasonBudgetMs,
      extensionBudgetCap: policy.extensionBudgetCap,
      holdCharges: snapshot.timers.holdCharges,
      holdEnabled: policy.holdEnabled,
      nowMs,
      resolvedAtTick: snapshot.tick,
      ml,
    };

    return deepFreeze(resolved) as ResolvedTimePolicy;
  }

  /**
   * Get the base mode time policy (static, not live-snapshot-dependent).
   */
  public getPolicy(mode: ModeCode): ModeTimePolicy {
    return MODE_TIME_POLICIES[this.normalizeMode(mode)];
  }

  /**
   * Generate a full diagnostic for the current resolution context.
   * Used by EngineOrchestrator telemetry and audit surfaces.
   */
  public diagnose(snapshot: RunStateSnapshot, nowMs: number): PolicyResolutionDiagnostic {
    const mode = snapshot.mode;
    const tier = this.resolveTier(snapshot);
    const phase = snapshot.phase;
    const bleedMode = snapshot.modeState.bleedMode;
    const policy = MODE_TIME_POLICIES[mode];
    const tierConfig = TIER_CONFIGS[tier];
    const phaseModifier = PHASE_MODIFIERS[phase];
    const lockWindowMs = computePolicyLockWindowMs(mode, tier);

    const prevTier = snapshot.pressure.previousTier;
    const interpolationRequired = requiresTierInterpolation(prevTier, tier);
    const interpolationSteps = interpolationRequired
      ? computeInterpolationSteps(prevTier, tier, mode)
      : 0;

    const normalizedFeatures = normalizeTierFeatures(tier);
    const issueFlags: string[] = [];

    const resolvedDurationMs = computeEffectiveDurationMs(mode, tier, phase, bleedMode);
    if (!isDurationInBoundsForTier(tier, snapshot.timers.currentTickDurationMs)) {
      issueFlags.push(`DURATION_OUT_OF_BOUNDS:${snapshot.timers.currentTickDurationMs}`);
    }

    if (snapshot.timers.elapsedMs > policy.seasonBudgetMs + policy.extensionBudgetCap) {
      issueFlags.push('BUDGET_EXCEEDED');
    }

    if (
      this.policyLockEnabled &&
      this.lockedTier !== null &&
      this.lockedTier !== tier &&
      this.lastPolicyLockTick !== null &&
      snapshot.tick - this.lastPolicyLockTick < 2
    ) {
      issueFlags.push(`POLICY_LOCK_VIOLATION:locked=${this.lockedTier},current=${tier}`);
    }

    const ml = this.buildMLContext(snapshot, mode, tier, phase, bleedMode, nowMs);

    return {
      mode,
      tier,
      phase,
      resolvedDurationMs,
      tierConfigDurationMs: tierConfig.defaultDurationMs,
      phaseModifierMultiplier: phaseModifier.tickDurationMultiplier,
      bleedModeActive: bleedMode,
      bleedMultiplier: bleedMode ? policy.bleedModeTickMultiplier : 1.0,
      urgencyLevel: classifyUrgency(tier, phase),
      lockWindowMs,
      interpolationRequired,
      interpolationSteps,
      normalizedFeatures,
      mlContext: ml,
      issueFlags: Object.freeze(issueFlags),
    };
  }

  /**
   * Record an observed decision latency for adaptive window tuning.
   * Called by EngineOrchestrator after each player decision event.
   */
  public recordDecisionLatency(
    mode: ModeCode,
    tier: PressureTier,
    tick: number,
    latencyMs: number,
  ): void {
    if (!this.adaptiveWindowEnabled) {
      return;
    }

    const key = `${mode}:${tier}`;
    const existing = this.adaptiveState.get(key);
    const latencies = existing ? [...existing.observedLatencies, latencyMs].slice(-50) : [latencyMs];

    this.adaptiveState.set(key, {
      mode,
      tier,
      observedLatencies: latencies,
      adaptationWeight: existing
        ? Math.min(1, existing.adaptationWeight * (1 / ML_ADAPTATION_DECAY))
        : 0.3,
      lastUpdatedAtTick: tick,
    });
  }

  /**
   * Retrieve the adaptive duration estimate for a given mode+tier context.
   * Returns null if insufficient data.
   */
  public getAdaptiveDurationMs(mode: ModeCode, tier: PressureTier): number | null {
    const key = `${mode}:${tier}`;
    const entry = this.adaptiveState.get(key);
    if (!entry || entry.observedLatencies.length < 3) {
      return null;
    }

    const sorted = [...entry.observedLatencies].sort((a, b) => a - b);
    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    const policy = MODE_TIME_POLICIES[mode];
    const mlConfig = policy.ml;

    const adaptedDuration = p75 * (1 + mlConfig.adaptationLearningRate * entry.adaptationWeight);
    return clampDurationForTier(tier, adaptedDuration);
  }

  /**
   * Apply a policy lock — prevents tier changes for a minimum window.
   * Called when a pressure transition is detected during the orchestration.
   */
  public acquirePolicyLock(tier: PressureTier, atTick: number): void {
    if (!this.policyLockEnabled) {
      return;
    }

    this.lockedTier = tier;
    this.lastPolicyLockTick = atTick;
  }

  /**
   * Release the policy lock if the lock window has elapsed.
   */
  public releasePolicyLockIfExpired(currentTick: number, mode: ModeCode): void {
    if (!this.policyLockEnabled || this.lockedTier === null) {
      return;
    }

    if (this.lastPolicyLockTick === null) {
      this.lockedTier = null;
      return;
    }

    const lockDurationTicks = 2 + MODE_TIME_POLICIES[mode].tierConfigs[this.lockedTier].interpolationTicks;

    if (currentTick - this.lastPolicyLockTick >= lockDurationTicks) {
      this.lockedTier = null;
      this.lastPolicyLockTick = null;
    }
  }

  /**
   * Check if the given tier is currently policy-locked.
   */
  public isPolicyLocked(tier: PressureTier): boolean {
    return this.policyLockEnabled && this.lockedTier !== null && this.lockedTier !== tier;
  }

  /**
   * Merge an override into a base resolved policy.
   * Used by orchestrator when a mode hook wants to adjust timing mid-tick.
   */
  public applyOverride(
    base: ResolvedTimePolicy,
    overrides: Partial<Pick<ResolvedTimePolicy, 'resolvedTickDurationMs' | 'resolvedDecisionWindowMs' | 'resolvedHoldWindowMs'>>,
  ): ResolvedTimePolicy {
    return mergePolicies(base, overrides);
  }

  /**
   * Serialize the current policy to a hash-safe map for proof chain inclusion.
   */
  public serializeForHash(policy: ResolvedTimePolicy): Record<string, unknown> {
    return serializePolicyForHash(policy);
  }

  /**
   * List all adaptive state entries for diagnostics.
   */
  public listAdaptiveEntries(): readonly AdaptiveTimingEntry[] {
    return Object.freeze(Array.from(this.adaptiveState.values()));
  }

  /**
   * Reset adaptive timing state. Used on run start or manual reset.
   */
  public reset(): void {
    this.adaptiveState.clear();
    this.lockedTier = null;
    this.lastPolicyLockTick = null;
  }

  // ============================================================================
  // MARK: Tier Resolution
  // ============================================================================

  /**
   * Determine the effective PressureTier from a snapshot.
   * Uses the snapshot's pressure.tier if valid, otherwise derives from score.
   */
  public resolveTier(snapshot: RunStateSnapshot): PressureTier {
    const tier = snapshot.pressure.tier;

    if (PRESSURE_TIER_ORDER.includes(tier)) {
      if (this.isPolicyLocked(tier)) {
        return this.lockedTier!;
      }
      return tier;
    }

    return tierFromPressureScore(snapshot.pressure.score);
  }

  /**
   * Determine the effective RunPhase from a snapshot.
   * Validates the phase and returns a safe fallback.
   */
  public resolvePhase(snapshot: RunStateSnapshot): RunPhase {
    const validPhases: RunPhase[] = ['FOUNDATION', 'ESCALATION', 'SOVEREIGNTY'];
    return validPhases.includes(snapshot.phase) ? snapshot.phase : 'FOUNDATION';
  }

  // ============================================================================
  // MARK: ML Context Building
  // ============================================================================

  private buildMLContext(
    snapshot: RunStateSnapshot,
    mode: ModeCode,
    tier: PressureTier,
    phase: RunPhase,
    bleedMode: boolean,
    _nowMs: number,
  ): ResolvedTimePolicyMLContext {
    const policy = MODE_TIME_POLICIES[mode];
    const mlConfig = policy.ml;

    const decisions = snapshot.telemetry.decisions;
    const recentLatencies = decisions
      .slice(-10)
      .filter((d) => d.accepted)
      .map((d) => d.latencyMs);

    const avgLatency =
      recentLatencies.length === 0
        ? mlConfig.decisionLatencyTarget
        : recentLatencies.reduce((s, v) => s + v, 0) / recentLatencies.length;

    const featureVector = deriveTimingFeatureVector(
      mode,
      tier,
      phase,
      snapshot.pressure.score,
      avgLatency,
      bleedMode,
    );

    const adaptiveDuration = this.getAdaptiveDurationMs(mode, tier);
    const predictedOptimalDurationMs = adaptiveDuration
      ?? computeEffectiveDurationMs(mode, tier, phase, bleedMode);

    const dataPointCount = recentLatencies.length;
    const confidenceScore = Math.min(
      MAX_FEATURE_CONFIDENCE,
      this.mlConfidenceThreshold + (dataPointCount / 20) * (1 - this.mlConfidenceThreshold),
    );

    const baseDuration = TIER_CONFIGS[tier].defaultDurationMs;
    const adaptationDelta = predictedOptimalDurationMs - baseDuration;

    return {
      featureVector: Object.freeze(featureVector),
      predictedOptimalDurationMs,
      confidenceScore,
      adaptationDelta,
      tensorInputShape: mlConfig.tensorInputShape,
      tensorOutputShape: mlConfig.tensorOutputShape,
      modelVersion: this.modelVersion,
    };
  }

  // ============================================================================
  // MARK: Mode Normalization
  // ============================================================================

  private normalizeMode(mode: ModeCode): ModeCode {
    const validModes: ModeCode[] = ['solo', 'pvp', 'coop', 'ghost'];
    return validModes.includes(mode) ? mode : 'solo';
  }

  // ============================================================================
  // MARK: Contract Surface Accessors
  // ============================================================================

  /**
   * Get the tier config for a specific tier (stateless, no snapshot needed).
   */
  public getTierConfig(tier: PressureTier): TimePolicyTierConfig {
    return TIER_CONFIGS[tier];
  }

  /**
   * Get the phase modifier for a specific phase.
   */
  public getPhaseModifier(phase: RunPhase): TimePolicyPhaseModifier {
    return PHASE_MODIFIERS[phase];
  }

  /**
   * Classify the urgency level for a given tier and phase.
   */
  public classifyUrgency(tier: PressureTier, phase: RunPhase): UrgencyLevel {
    return classifyUrgency(tier, phase);
  }

  /**
   * Compute the policy lock window for the given mode and tier.
   */
  public getLockWindowMs(mode: ModeCode, tier: PressureTier): number {
    return computePolicyLockWindowMs(mode, tier);
  }

  /**
   * Check if two tiers require interpolation between them.
   */
  public requiresInterpolation(fromTier: PressureTier, toTier: PressureTier): boolean {
    return requiresTierInterpolation(fromTier, toTier);
  }

  /**
   * Compute the number of interpolation steps for a tier transition.
   */
  public computeInterpolationSteps(fromTier: PressureTier, toTier: PressureTier, mode: ModeCode): number {
    return computeInterpolationSteps(fromTier, toTier, mode);
  }

  /**
   * Derive the ML feature vector for timing inference.
   */
  public deriveFeatureVector(
    mode: ModeCode,
    tier: PressureTier,
    phase: RunPhase,
    pressureScore: number,
    decisionLatencyMs: number,
    bleedMode: boolean,
  ): number[] {
    return deriveTimingFeatureVector(mode, tier, phase, pressureScore, decisionLatencyMs, bleedMode);
  }

  /**
   * Get the override key constants used in snapshot tags.
   */
  public static readonly TICK_DURATION_OVERRIDE_KEY = TICK_DURATION_OVERRIDE_KEY;
  public static readonly DECISION_WINDOW_OVERRIDE_KEY = DECISION_WINDOW_OVERRIDE_KEY;
}
