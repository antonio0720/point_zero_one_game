/*
 * POINT ZERO ONE — BACKEND ENGINE MODE SHARED
 * /backend/src/game/engine/modes/shared/TimePolicyContracts.ts
 *
 * Doctrine:
 * - time policy is mode-native and pressure-reactive
 * - every tier boundary must carry a full resolution surface, not just a duration
 * - policy snapshots must be deterministic, hashable, and replay-safe
 * - ML/DL timing models read from this contract — it must never lose information
 * - cadence is the heartbeat of the user experience; this file protects it
 */

import type {
  ModeCode,
  PressureTier,
  RunPhase,
} from '../../core/GamePrimitives';

// ============================================================================
// MARK: Tier Configuration
// ============================================================================

/**
 * Per-tier configuration block.
 * Drives both orchestration cadence and UX presentation.
 */
export interface TimePolicyTierConfig {
  readonly tier: PressureTier;
  readonly minDurationMs: number;
  readonly maxDurationMs: number;
  readonly defaultDurationMs: number;
  readonly decisionWindowMs: number;
  readonly holdWindowMs: number;
  readonly autoResolveFallbackMs: number;
  readonly interpolationTicks: number;
  readonly urgencyLabel: string;
  readonly screenShake: boolean;
  readonly audioSignalKey: string | null;
  readonly pressureFloor: number;
  readonly pressureCeiling: number;
}

/**
 * Canonical per-tier timing configurations.
 * These are the authoritative timing constants for all engine surfaces.
 */
export const TIER_CONFIGS: Readonly<Record<PressureTier, TimePolicyTierConfig>> =
  Object.freeze({
    T0: Object.freeze({
      tier: 'T0' as PressureTier,
      minDurationMs: 18_000,
      maxDurationMs: 22_000,
      defaultDurationMs: 20_000,
      decisionWindowMs: 12_000,
      holdWindowMs: 6_000,
      autoResolveFallbackMs: 20_000,
      interpolationTicks: 4,
      urgencyLabel: 'SOVEREIGN',
      screenShake: false,
      audioSignalKey: 'tick_sovereign',
      pressureFloor: 0.0,
      pressureCeiling: 0.2,
    }),
    T1: Object.freeze({
      tier: 'T1' as PressureTier,
      minDurationMs: 12_000,
      maxDurationMs: 14_000,
      defaultDurationMs: 13_000,
      decisionWindowMs: 8_000,
      holdWindowMs: 5_000,
      autoResolveFallbackMs: 13_000,
      interpolationTicks: 3,
      urgencyLabel: 'STABLE',
      screenShake: false,
      audioSignalKey: 'tick_standard',
      pressureFloor: 0.2,
      pressureCeiling: 0.4,
    }),
    T2: Object.freeze({
      tier: 'T2' as PressureTier,
      minDurationMs: 7_000,
      maxDurationMs: 9_000,
      defaultDurationMs: 8_000,
      decisionWindowMs: 5_000,
      holdWindowMs: 3_500,
      autoResolveFallbackMs: 8_000,
      interpolationTicks: 3,
      urgencyLabel: 'COMPRESSED',
      screenShake: false,
      audioSignalKey: 'tick_compressed',
      pressureFloor: 0.4,
      pressureCeiling: 0.65,
    }),
    T3: Object.freeze({
      tier: 'T3' as PressureTier,
      minDurationMs: 3_000,
      maxDurationMs: 5_000,
      defaultDurationMs: 4_000,
      decisionWindowMs: 3_000,
      holdWindowMs: 2_000,
      autoResolveFallbackMs: 4_000,
      interpolationTicks: 2,
      urgencyLabel: 'CRISIS',
      screenShake: false,
      audioSignalKey: 'tick_crisis',
      pressureFloor: 0.65,
      pressureCeiling: 0.85,
    }),
    T4: Object.freeze({
      tier: 'T4' as PressureTier,
      minDurationMs: 1_000,
      maxDurationMs: 2_000,
      defaultDurationMs: 1_500,
      decisionWindowMs: 1_500,
      holdWindowMs: 1_000,
      autoResolveFallbackMs: 1_500,
      interpolationTicks: 2,
      urgencyLabel: 'COLLAPSE_IMMINENT',
      screenShake: true,
      audioSignalKey: 'tick_collapse',
      pressureFloor: 0.85,
      pressureCeiling: 1.0,
    }),
  });

/**
 * Lookup: pressure score (0.0–1.0) → PressureTier.
 */
export function tierFromPressureScore(score: number): PressureTier {
  const clamped = Math.max(0, Math.min(1, score));
  for (const [tier, config] of Object.entries(TIER_CONFIGS) as [PressureTier, TimePolicyTierConfig][]) {
    if (clamped >= config.pressureFloor && clamped < config.pressureCeiling) {
      return tier;
    }
  }
  return 'T4';
}

// ============================================================================
// MARK: Phase Policy Surfaces
// ============================================================================

/**
 * Per-phase adjustments applied on top of base tier config.
 */
export interface TimePolicyPhaseModifier {
  readonly phase: RunPhase;
  readonly tickDurationMultiplier: number;
  readonly decisionWindowMultiplier: number;
  readonly holdWindowMultiplier: number;
  readonly phaseBoundaryWindowCount: number;
  readonly phaseBoundaryWindowDurationMs: number;
  readonly autoTriggerThresholds: Readonly<Record<string, number>>;
}

/**
 * Phase modifiers applied by the time policy layer.
 * These are additive on top of tier config, not replacements.
 */
export const PHASE_MODIFIERS: Readonly<Record<RunPhase, TimePolicyPhaseModifier>> =
  Object.freeze({
    FOUNDATION: Object.freeze({
      phase: 'FOUNDATION' as RunPhase,
      tickDurationMultiplier: 1.0,
      decisionWindowMultiplier: 1.2,
      holdWindowMultiplier: 1.1,
      phaseBoundaryWindowCount: 5,
      phaseBoundaryWindowDurationMs: 6_000,
      autoTriggerThresholds: Object.freeze({ income: 0.3, shield: 0.15, heat: 0.4 }),
    }),
    ESCALATION: Object.freeze({
      phase: 'ESCALATION' as RunPhase,
      tickDurationMultiplier: 0.9,
      decisionWindowMultiplier: 1.0,
      holdWindowMultiplier: 1.0,
      phaseBoundaryWindowCount: 4,
      phaseBoundaryWindowDurationMs: 5_000,
      autoTriggerThresholds: Object.freeze({ income: 0.45, shield: 0.3, heat: 0.55 }),
    }),
    SOVEREIGNTY: Object.freeze({
      phase: 'SOVEREIGNTY' as RunPhase,
      tickDurationMultiplier: 0.8,
      decisionWindowMultiplier: 0.85,
      holdWindowMultiplier: 0.85,
      phaseBoundaryWindowCount: 3,
      phaseBoundaryWindowDurationMs: 4_000,
      autoTriggerThresholds: Object.freeze({ income: 0.6, shield: 0.5, heat: 0.7 }),
    }),
  });

// ============================================================================
// MARK: Mode Time Policy
// ============================================================================

/**
 * Authoritative time policy surface for a specific game mode.
 * This is the compiled, mode-specific ruleset — not the live snapshot.
 */
export interface ModeTimePolicy {
  readonly mode: ModeCode;
  readonly label: string;
  readonly tierConfigs: Readonly<Record<PressureTier, TimePolicyTierConfig>>;
  readonly phaseModifiers: Readonly<Record<RunPhase, TimePolicyPhaseModifier>>;
  readonly seasonBudgetMs: number;
  readonly extensionBudgetCap: number;
  readonly defaultHoldCharges: number;
  readonly holdEnabled: boolean;
  readonly bleedModeTickMultiplier: number;
  readonly pvpBattleBudgetRegenPerTick: number;
  readonly coopTrustDecayPerTick: number;
  readonly ghostDivergenceDecayPerTick: number;
  readonly soloIsolationTaxThreshold: number;
  readonly minTickDurationMs: number;
  readonly maxTickDurationMs: number;
  readonly pressureTierLockMs: number;
  readonly ml: ModeTimePolicyMLConfig;
}

/**
 * ML/DL timing model configuration attached to each mode policy.
 */
export interface ModeTimePolicyMLConfig {
  readonly tickPacingFeatures: readonly string[];
  readonly pressureResponseFeatures: readonly string[];
  readonly decisionLatencyTarget: number;
  readonly adaptiveWindowEnabled: boolean;
  readonly windowExpansionMaxMs: number;
  readonly windowContractionMaxMs: number;
  readonly adaptationLearningRate: number;
  readonly tensorInputShape: readonly number[];
  readonly tensorOutputShape: readonly number[];
}

/**
 * Ground-truth mode time policies.
 * Each mode has distinct timing DNA that changes how the game feels.
 */
export const MODE_TIME_POLICIES: Readonly<Record<ModeCode, ModeTimePolicy>> =
  Object.freeze({
    solo: Object.freeze({
      mode: 'solo' as ModeCode,
      label: 'EMPIRE',
      tierConfigs: TIER_CONFIGS,
      phaseModifiers: PHASE_MODIFIERS,
      seasonBudgetMs: 12 * 60 * 1_000,
      extensionBudgetCap: 3 * 60 * 1_000,
      defaultHoldCharges: 1,
      holdEnabled: true,
      bleedModeTickMultiplier: 0.65,
      pvpBattleBudgetRegenPerTick: 0,
      coopTrustDecayPerTick: 0,
      ghostDivergenceDecayPerTick: 0,
      soloIsolationTaxThreshold: 5_000,
      minTickDurationMs: 1_000,
      maxTickDurationMs: 22_000,
      pressureTierLockMs: 500,
      ml: Object.freeze({
        tickPacingFeatures: ['pressure_score', 'net_worth_ratio', 'shield_pct', 'hand_size', 'phase_elapsed_ratio'],
        pressureResponseFeatures: ['heat_delta', 'income_delta', 'cash_position', 'decision_latency'],
        decisionLatencyTarget: 3_500,
        adaptiveWindowEnabled: true,
        windowExpansionMaxMs: 2_000,
        windowContractionMaxMs: 1_500,
        adaptationLearningRate: 0.02,
        tensorInputShape: [5, 12],
        tensorOutputShape: [1, 3],
      }),
    }),
    pvp: Object.freeze({
      mode: 'pvp' as ModeCode,
      label: 'PREDATOR',
      tierConfigs: TIER_CONFIGS,
      phaseModifiers: PHASE_MODIFIERS,
      seasonBudgetMs: 10 * 60 * 1_000,
      extensionBudgetCap: 2 * 60 * 1_000,
      defaultHoldCharges: 0,
      holdEnabled: false,
      bleedModeTickMultiplier: 0.55,
      pvpBattleBudgetRegenPerTick: 2,
      coopTrustDecayPerTick: 0,
      ghostDivergenceDecayPerTick: 0,
      soloIsolationTaxThreshold: 0,
      minTickDurationMs: 1_000,
      maxTickDurationMs: 14_000,
      pressureTierLockMs: 300,
      ml: Object.freeze({
        tickPacingFeatures: ['pressure_score', 'battle_budget', 'opponent_pressure', 'shield_pct', 'heat_delta'],
        pressureResponseFeatures: ['attack_magnitude', 'counter_intel_tier', 'first_blood', 'extraction_cooldown'],
        decisionLatencyTarget: 2_000,
        adaptiveWindowEnabled: true,
        windowExpansionMaxMs: 1_000,
        windowContractionMaxMs: 1_000,
        adaptationLearningRate: 0.03,
        tensorInputShape: [5, 14],
        tensorOutputShape: [1, 4],
      }),
    }),
    coop: Object.freeze({
      mode: 'coop' as ModeCode,
      label: 'SYNDICATE',
      tierConfigs: TIER_CONFIGS,
      phaseModifiers: PHASE_MODIFIERS,
      seasonBudgetMs: 14 * 60 * 1_000,
      extensionBudgetCap: 4 * 60 * 1_000,
      defaultHoldCharges: 2,
      holdEnabled: true,
      bleedModeTickMultiplier: 0.7,
      pvpBattleBudgetRegenPerTick: 0,
      coopTrustDecayPerTick: 0.5,
      ghostDivergenceDecayPerTick: 0,
      soloIsolationTaxThreshold: 0,
      minTickDurationMs: 1_500,
      maxTickDurationMs: 22_000,
      pressureTierLockMs: 600,
      ml: Object.freeze({
        tickPacingFeatures: ['pressure_score', 'trust_avg', 'shared_treasury', 'team_shield_pct', 'role_coverage'],
        pressureResponseFeatures: ['aid_plays', 'rescue_plays', 'trust_delta', 'treasury_balance'],
        decisionLatencyTarget: 4_000,
        adaptiveWindowEnabled: true,
        windowExpansionMaxMs: 3_000,
        windowContractionMaxMs: 1_200,
        adaptationLearningRate: 0.015,
        tensorInputShape: [5, 13],
        tensorOutputShape: [1, 3],
      }),
    }),
    ghost: Object.freeze({
      mode: 'ghost' as ModeCode,
      label: 'PHANTOM',
      tierConfigs: TIER_CONFIGS,
      phaseModifiers: PHASE_MODIFIERS,
      seasonBudgetMs: 11 * 60 * 1_000,
      extensionBudgetCap: 2 * 60 * 1_000,
      defaultHoldCharges: 1,
      holdEnabled: true,
      bleedModeTickMultiplier: 0.6,
      pvpBattleBudgetRegenPerTick: 0,
      coopTrustDecayPerTick: 0,
      ghostDivergenceDecayPerTick: 0.003,
      soloIsolationTaxThreshold: 0,
      minTickDurationMs: 1_000,
      maxTickDurationMs: 20_000,
      pressureTierLockMs: 400,
      ml: Object.freeze({
        tickPacingFeatures: ['pressure_score', 'gap_vs_legend', 'divergence_potential', 'ghost_marker_proximity', 'cord_score'],
        pressureResponseFeatures: ['divergence_delta', 'precision_plays', 'ghost_benchmark_hits', 'legend_alignment'],
        decisionLatencyTarget: 3_000,
        adaptiveWindowEnabled: true,
        windowExpansionMaxMs: 2_500,
        windowContractionMaxMs: 1_300,
        adaptationLearningRate: 0.025,
        tensorInputShape: [5, 11],
        tensorOutputShape: [1, 3],
      }),
    }),
  });

// ============================================================================
// MARK: Resolved Time Policy (Live Snapshot)
// ============================================================================

/**
 * A live, per-tick resolved policy snapshot.
 * Combines base mode policy + current pressure tier + current phase.
 * This is what engines and orchestrators actually consume.
 */
export interface ResolvedTimePolicy {
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly tier: PressureTier;
  readonly tierConfig: TimePolicyTierConfig;
  readonly phaseModifier: TimePolicyPhaseModifier;
  readonly resolvedTickDurationMs: number;
  readonly resolvedDecisionWindowMs: number;
  readonly resolvedHoldWindowMs: number;
  readonly resolvedAutoResolveFallbackMs: number;
  readonly bleedModeActive: boolean;
  readonly bleedModeEffectiveDurationMs: number;
  readonly seasonBudgetMs: number;
  readonly extensionBudgetCap: number;
  readonly holdCharges: number;
  readonly holdEnabled: boolean;
  readonly nowMs: number;
  readonly resolvedAtTick: number;
  readonly ml: ResolvedTimePolicyMLContext;
}

/**
 * ML context embedded in each resolved policy snapshot.
 * Used by the orchestrator ML routing layer.
 */
export interface ResolvedTimePolicyMLContext {
  readonly featureVector: readonly number[];
  readonly predictedOptimalDurationMs: number;
  readonly confidenceScore: number;
  readonly adaptationDelta: number;
  readonly tensorInputShape: readonly number[];
  readonly tensorOutputShape: readonly number[];
  readonly modelVersion: string;
}

// ============================================================================
// MARK: Factory Patch
// ============================================================================

/**
 * Seed patch applied by the time policy resolver at run creation.
 * Ensures the initial snapshot has deterministic timing from the mode policy.
 */
export interface TimePolicyFactoryPatch {
  readonly seasonBudgetMs: number;
  readonly currentTickDurationMs: number;
  readonly holdCharges: number;
  readonly holdEnabled: boolean;
  readonly extensionBudgetCap: number;
}

// ============================================================================
// MARK: Policy Derivation Helpers
// ============================================================================

/**
 * Compute the effective tick duration for a given mode, tier, phase,
 * and optional bleed-mode state.
 */
export function computeEffectiveDurationMs(
  mode: ModeCode,
  tier: PressureTier,
  phase: RunPhase,
  bleedMode: boolean,
): number {
  const policy = MODE_TIME_POLICIES[mode];
  const tierConfig = policy.tierConfigs[tier];
  const phaseModifier = policy.phaseModifiers[phase];
  const base = tierConfig.defaultDurationMs * phaseModifier.tickDurationMultiplier;
  const multiplier = bleedMode ? policy.bleedModeTickMultiplier : 1.0;
  const raw = base * multiplier;
  return Math.max(policy.minTickDurationMs, Math.min(policy.maxTickDurationMs, Math.trunc(raw)));
}

/**
 * Compute the effective decision window for the given context.
 */
export function computeEffectiveDecisionWindowMs(
  mode: ModeCode,
  tier: PressureTier,
  phase: RunPhase,
  bleedMode: boolean,
): number {
  const policy = MODE_TIME_POLICIES[mode];
  const tierConfig = policy.tierConfigs[tier];
  const phaseModifier = policy.phaseModifiers[phase];
  const base = tierConfig.decisionWindowMs * phaseModifier.decisionWindowMultiplier;
  const multiplier = bleedMode ? policy.bleedModeTickMultiplier : 1.0;
  return Math.max(800, Math.trunc(base * multiplier));
}

/**
 * Compute the effective hold window for the given context.
 */
export function computeEffectiveHoldWindowMs(
  mode: ModeCode,
  tier: PressureTier,
  phase: RunPhase,
): number {
  const policy = MODE_TIME_POLICIES[mode];
  const tierConfig = policy.tierConfigs[tier];
  const phaseModifier = policy.phaseModifiers[phase];
  return Math.max(500, Math.trunc(tierConfig.holdWindowMs * phaseModifier.holdWindowMultiplier));
}

/**
 * Compute the auto-resolve fallback duration.
 */
export function computeAutoResolveFallbackMs(
  mode: ModeCode,
  tier: PressureTier,
  phase: RunPhase,
): number {
  const policy = MODE_TIME_POLICIES[mode];
  const tierConfig = policy.tierConfigs[tier];
  const phaseModifier = policy.phaseModifiers[phase];
  return Math.max(500, Math.trunc(tierConfig.autoResolveFallbackMs * phaseModifier.decisionWindowMultiplier));
}

/**
 * Check if the transition between two tiers requires interpolation.
 */
export function requiresTierInterpolation(
  fromTier: PressureTier,
  toTier: PressureTier,
): boolean {
  const ORDER: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
  return Math.abs(ORDER.indexOf(fromTier) - ORDER.indexOf(toTier)) >= 1;
}

/**
 * Compute interpolation step count for a tier transition.
 */
export function computeInterpolationSteps(
  fromTier: PressureTier,
  toTier: PressureTier,
  mode: ModeCode,
): number {
  const ORDER: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
  const delta = Math.abs(ORDER.indexOf(toTier) - ORDER.indexOf(fromTier));
  const config = MODE_TIME_POLICIES[mode].tierConfigs[toTier];
  return Math.max(config.interpolationTicks, delta * 2);
}

/**
 * Compute the season budget for a given mode with optional modifier.
 */
export function computeSeasonBudgetMs(
  mode: ModeCode,
  communityHeatModifier: number,
): number {
  const base = MODE_TIME_POLICIES[mode].seasonBudgetMs;
  const modifier = Math.max(0.5, Math.min(2.0, communityHeatModifier));
  return Math.trunc(base * modifier);
}

/**
 * Derive a simple ML feature vector from policy context for timing model ingestion.
 */
export function deriveTimingFeatureVector(
  mode: ModeCode,
  tier: PressureTier,
  phase: RunPhase,
  pressureScore: number,
  decisionLatencyMs: number,
  bleedMode: boolean,
): number[] {
  const ORDER: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
  const PHASES: RunPhase[] = ['FOUNDATION', 'ESCALATION', 'SOVEREIGNTY'];
  const MODES: ModeCode[] = ['solo', 'pvp', 'coop', 'ghost'];

  return [
    pressureScore,
    ORDER.indexOf(tier) / 4,
    PHASES.indexOf(phase) / 2,
    MODES.indexOf(mode) / 3,
    bleedMode ? 1 : 0,
    Math.min(1, decisionLatencyMs / 10_000),
  ];
}

/**
 * Compute the policy lock window — minimum time before a tier can change again.
 */
export function computePolicyLockWindowMs(mode: ModeCode, tier: PressureTier): number {
  const policy = MODE_TIME_POLICIES[mode];
  return policy.pressureTierLockMs + (policy.tierConfigs[tier].interpolationTicks * 200);
}

/**
 * Classify urgency level based on tier and phase.
 */
export type UrgencyLevel = 'CALM' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export function classifyUrgency(tier: PressureTier, phase: RunPhase): UrgencyLevel {
  if (tier === 'T4') return 'CRITICAL';
  if (tier === 'T3') return phase === 'SOVEREIGNTY' ? 'CRITICAL' : 'HIGH';
  if (tier === 'T2') return phase === 'FOUNDATION' ? 'LOW' : 'MEDIUM';
  if (tier === 'T1') return 'LOW';
  return 'CALM';
}

/**
 * Compute ML-ready normalized tier features.
 */
export function normalizeTierFeatures(tier: PressureTier): Readonly<Record<string, number>> {
  const config = TIER_CONFIGS[tier];
  const ORDER: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
  return Object.freeze({
    tier_index: ORDER.indexOf(tier) / 4,
    min_duration_norm: config.minDurationMs / 22_000,
    max_duration_norm: config.maxDurationMs / 22_000,
    default_duration_norm: config.defaultDurationMs / 22_000,
    decision_window_norm: config.decisionWindowMs / 12_000,
    hold_window_norm: config.holdWindowMs / 6_000,
    interpolation_norm: config.interpolationTicks / 4,
    screen_shake: config.screenShake ? 1 : 0,
    pressure_midpoint: (config.pressureFloor + config.pressureCeiling) / 2,
  });
}

/**
 * Check if a given tick duration is within the valid range for a tier.
 */
export function isDurationInBoundsForTier(
  tier: PressureTier,
  durationMs: number,
): boolean {
  const config = TIER_CONFIGS[tier];
  return durationMs >= config.minDurationMs && durationMs <= config.maxDurationMs;
}

/**
 * Clamp a duration to valid bounds for a given tier.
 */
export function clampDurationForTier(tier: PressureTier, durationMs: number): number {
  const config = TIER_CONFIGS[tier];
  if (!Number.isFinite(durationMs)) return config.defaultDurationMs;
  return Math.max(config.minDurationMs, Math.min(config.maxDurationMs, Math.trunc(durationMs)));
}

/**
 * Serialize a ResolvedTimePolicy for hashing / proof chain inclusion.
 */
export function serializePolicyForHash(policy: ResolvedTimePolicy): Record<string, unknown> {
  return {
    mode: policy.mode,
    phase: policy.phase,
    tier: policy.tier,
    resolvedTickDurationMs: policy.resolvedTickDurationMs,
    resolvedDecisionWindowMs: policy.resolvedDecisionWindowMs,
    bleedModeActive: policy.bleedModeActive,
    nowMs: policy.nowMs,
    resolvedAtTick: policy.resolvedAtTick,
  };
}

/**
 * Merge two resolved policies (prioritize second for conflict resolution).
 * Used in multi-engine reconciliation paths.
 */
export function mergePolicies(
  base: ResolvedTimePolicy,
  override: Partial<Pick<ResolvedTimePolicy, 'resolvedTickDurationMs' | 'resolvedDecisionWindowMs' | 'resolvedHoldWindowMs'>>,
): ResolvedTimePolicy {
  return {
    ...base,
    resolvedTickDurationMs: override.resolvedTickDurationMs ?? base.resolvedTickDurationMs,
    resolvedDecisionWindowMs: override.resolvedDecisionWindowMs ?? base.resolvedDecisionWindowMs,
    resolvedHoldWindowMs: override.resolvedHoldWindowMs ?? base.resolvedHoldWindowMs,
  };
}
