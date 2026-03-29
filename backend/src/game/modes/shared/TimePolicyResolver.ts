/*
 * POINT ZERO ONE — BACKEND MODES SHARED
 * /backend/src/game/modes/shared/TimePolicyResolver.ts
 *
 * Doctrine:
 * - backend cadence must reflect the psychological truth of financial pressure
 * - T0 is slowest and T4 is fastest; any inversion is a runtime defect
 * - mode differences should adjust envelope and budget, not violate the core tier law
 * - resolver output must be deterministic and cheap enough for per-tick application
 */

import type {
  ModeCode,
  PressureTier,
  TimingClass,
} from '../../engine/core/GamePrimitives';
import type { RunFactoryInput } from '../../engine/core/RunStateFactory';
import type { RunStateSnapshot } from '../../engine/core/RunStateSnapshot';
import { cloneJson, deepFreeze } from '../../engine/core/Deterministic';
import {
  TIME_POLICY_TIERS,
  type ModeTimePolicy,
  type ResolvedTimePolicy,
  type TimePolicyFactoryPatch,
  type TimePolicyResolutionInput,
  type TimePolicyResolverContract,
  type TimeTierConfig,
} from './TimePolicyContracts';

export interface TimePolicyResolverOptions {
  readonly policies?: Partial<Record<ModeCode, Partial<ModeTimePolicy>>>;
}

const BASE_TIER_CONFIGS: Readonly<Record<PressureTier, TimeTierConfig>> = Object.freeze({
  T0: {
    tier: 'T0',
    minDurationMs: 18_000,
    maxDurationMs: 22_000,
    defaultDurationMs: 20_000,
    decisionWindowMs: 12_000,
    interpolationTicks: 4,
    screenShake: false,
    audioSignal: 'tick_sovereign',
  },
  T1: {
    tier: 'T1',
    minDurationMs: 12_000,
    maxDurationMs: 14_000,
    defaultDurationMs: 13_000,
    decisionWindowMs: 8_000,
    interpolationTicks: 3,
    screenShake: false,
    audioSignal: 'tick_standard',
  },
  T2: {
    tier: 'T2',
    minDurationMs: 7_000,
    maxDurationMs: 9_000,
    defaultDurationMs: 8_000,
    decisionWindowMs: 5_000,
    interpolationTicks: 2,
    screenShake: false,
    audioSignal: 'tick_compressed',
  },
  T3: {
    tier: 'T3',
    minDurationMs: 3_000,
    maxDurationMs: 5_000,
    defaultDurationMs: 4_000,
    decisionWindowMs: 3_000,
    interpolationTicks: 2,
    screenShake: false,
    audioSignal: 'tick_crisis',
  },
  T4: {
    tier: 'T4',
    minDurationMs: 1_000,
    maxDurationMs: 2_000,
    defaultDurationMs: 1_500,
    decisionWindowMs: 1_500,
    interpolationTicks: 2,
    screenShake: true,
    audioSignal: 'tick_collapse',
  },
});

function freezeObject<T extends object>(value: T): T {
  return Object.freeze(value);
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function scaleTierConfig(
  config: TimeTierConfig,
  durationMultiplier: number,
  decisionMultiplier: number,
): TimeTierConfig {
  return freezeObject({
    ...config,
    minDurationMs: clampInteger(config.minDurationMs * durationMultiplier, 250, 120_000),
    maxDurationMs: clampInteger(config.maxDurationMs * durationMultiplier, 250, 120_000),
    defaultDurationMs: clampInteger(config.defaultDurationMs * durationMultiplier, 250, 120_000),
    decisionWindowMs: clampInteger(config.decisionWindowMs * decisionMultiplier, 250, 120_000),
  });
}

function scaleTierTable(
  durationMultiplier: number,
  decisionMultiplier: number,
): Record<PressureTier, TimeTierConfig> {
  return {
    T0: scaleTierConfig(BASE_TIER_CONFIGS.T0, durationMultiplier, decisionMultiplier),
    T1: scaleTierConfig(BASE_TIER_CONFIGS.T1, durationMultiplier, decisionMultiplier),
    T2: scaleTierConfig(BASE_TIER_CONFIGS.T2, durationMultiplier, decisionMultiplier),
    T3: scaleTierConfig(BASE_TIER_CONFIGS.T3, durationMultiplier, decisionMultiplier),
    T4: scaleTierConfig(BASE_TIER_CONFIGS.T4, durationMultiplier, decisionMultiplier),
  };
}

const DEFAULT_POLICIES: Readonly<Record<ModeCode, ModeTimePolicy>> = freezeObject({
  solo: freezeObject({
    policyId: 'time-policy:solo:authoritative-v1',
    mode: 'solo',
    description: '12-minute sovereign climb with one hold charge and the canonical cadence law.',
    seasonBudgetMs: 12 * 60 * 1_000,
    baseHoldCharges: 1,
    holdEnabled: true,
    phaseBoundaryWindowTicks: 5,
    phaseBoundaryDurationMultiplier: 5,
    ghostBenchmarkDurationMultiplier: 3,
    pressureSpikeWindowCapMs: 3_500,
    explicitTimingClassDurationsMs: freezeObject({
      RES: null,
      AID: null,
      ANY: null,
    }),
    tiers: freezeObject(scaleTierTable(1, 1)),
  }),
  pvp: freezeObject({
    policyId: 'time-policy:pvp:predator-v1',
    mode: 'pvp',
    description: 'Predator lane with tighter cadence, no holds, and hard counter tempo.',
    seasonBudgetMs: 12 * 60 * 1_000,
    baseHoldCharges: 0,
    holdEnabled: false,
    phaseBoundaryWindowTicks: 5,
    phaseBoundaryDurationMultiplier: 4,
    ghostBenchmarkDurationMultiplier: 3,
    pressureSpikeWindowCapMs: 3_000,
    explicitTimingClassDurationsMs: freezeObject({
      CTR: 5_000,
      RES: null,
      AID: null,
      ANY: null,
    }),
    tiers: freezeObject(scaleTierTable(0.9, 0.95)),
  }),
  coop: freezeObject({
    policyId: 'time-policy:coop:syndicate-v1',
    mode: 'coop',
    description: 'Shared-pressure lane with a longer season budget and wider recovery windows.',
    seasonBudgetMs: 14 * 60 * 1_000,
    baseHoldCharges: 0,
    holdEnabled: false,
    phaseBoundaryWindowTicks: 5,
    phaseBoundaryDurationMultiplier: 5,
    ghostBenchmarkDurationMultiplier: 3,
    pressureSpikeWindowCapMs: 3_500,
    explicitTimingClassDurationsMs: freezeObject({
      RES: null,
      AID: null,
      ANY: null,
    }),
    tiers: freezeObject(scaleTierTable(1.08, 1.15)),
  }),
  ghost: freezeObject({
    policyId: 'time-policy:ghost:phantom-v1',
    mode: 'ghost',
    description: 'Phantom lane with benchmark pressure and no hold forgiveness.',
    seasonBudgetMs: 12 * 60 * 1_000,
    baseHoldCharges: 0,
    holdEnabled: false,
    phaseBoundaryWindowTicks: 5,
    phaseBoundaryDurationMultiplier: 5,
    ghostBenchmarkDurationMultiplier: 4,
    pressureSpikeWindowCapMs: 3_250,
    explicitTimingClassDurationsMs: freezeObject({
      RES: null,
      AID: null,
      ANY: null,
    }),
    tiers: freezeObject(scaleTierTable(0.95, 0.9)),
  }),
});

function resolveInputSnapshot(
  input: TimePolicyResolutionInput | RunStateSnapshot,
): {
  readonly snapshot: RunStateSnapshot;
  readonly nowMs: number;
} {
  if ('snapshot' in input) {
    return {
      snapshot: input.snapshot,
      nowMs: input.nowMs ?? input.snapshot.timers.elapsedMs,
    };
  }

  return {
    snapshot: input,
    nowMs: input.timers.elapsedMs,
  };
}

function buildTimingClassDurations(
  policy: ModeTimePolicy,
  snapshot: RunStateSnapshot,
  tierConfig: TimeTierConfig,
  currentTickDurationMs: number,
  remainingBudgetMs: number,
): Partial<Record<TimingClass, number | null>> {
  const built: Partial<Record<TimingClass, number | null>> = {
    PRE: currentTickDurationMs,
    POST: currentTickDurationMs,
    FATE: tierConfig.decisionWindowMs,
    CTR: Math.max(tierConfig.decisionWindowMs, 5_000),
    RES: null,
    AID: null,
    GBM: clampInteger(
      currentTickDurationMs * policy.ghostBenchmarkDurationMultiplier,
      currentTickDurationMs,
      120_000,
    ),
    CAS: currentTickDurationMs,
    PHZ: clampInteger(
      currentTickDurationMs * policy.phaseBoundaryDurationMultiplier,
      currentTickDurationMs,
      120_000,
    ),
    PSK: Math.min(currentTickDurationMs, policy.pressureSpikeWindowCapMs),
    END: remainingBudgetMs,
    ANY: null,
  };

  for (const [timingClass, override] of Object.entries(policy.explicitTimingClassDurationsMs)) {
    built[timingClass as TimingClass] = override;
  }

  return built;
}

function mergePolicy(
  base: ModeTimePolicy,
  override?: Partial<ModeTimePolicy>,
): ModeTimePolicy {
  if (!override) {
    return base;
  }

  return freezeObject({
    ...base,
    ...override,
    explicitTimingClassDurationsMs: freezeObject({
      ...base.explicitTimingClassDurationsMs,
      ...(override.explicitTimingClassDurationsMs ?? {}),
    }),
    tiers: freezeObject({
      ...base.tiers,
      ...(override.tiers ?? {}),
    }),
  });
}

export class TimePolicyResolver implements TimePolicyResolverContract {
  private readonly policies: Readonly<Record<ModeCode, ModeTimePolicy>>;

  public constructor(options: TimePolicyResolverOptions = {}) {
    this.policies = freezeObject({
      solo: mergePolicy(DEFAULT_POLICIES.solo, options.policies?.solo),
      pvp: mergePolicy(DEFAULT_POLICIES.pvp, options.policies?.pvp),
      coop: mergePolicy(DEFAULT_POLICIES.coop, options.policies?.coop),
      ghost: mergePolicy(DEFAULT_POLICIES.ghost, options.policies?.ghost),
    });
  }

  public getPolicy(mode: ModeCode): ModeTimePolicy {
    return this.policies[mode];
  }

  public resolveFactoryPatch(
    input: Pick<
      RunFactoryInput,
      'mode' | 'seasonBudgetMs' | 'currentTickDurationMs' | 'holdCharges'
    >,
  ): TimePolicyFactoryPatch {
    const policy = this.getPolicy(input.mode as ModeCode);
    const stableTier = policy.tiers.T1;

    return freezeObject({
      policyId: policy.policyId,
      mode: policy.mode,
      seasonBudgetMs: input.seasonBudgetMs ?? policy.seasonBudgetMs,
      currentTickDurationMs:
        input.currentTickDurationMs ?? stableTier.defaultDurationMs,
      holdCharges:
        input.holdCharges ??
        (policy.holdEnabled ? policy.baseHoldCharges : 0),
    });
  }

  public resolveSnapshot(
    input: TimePolicyResolutionInput | RunStateSnapshot,
  ): ResolvedTimePolicy {
    const resolved = resolveInputSnapshot(input);
    const snapshot = resolved.snapshot;
    const policy = this.getPolicy(snapshot.mode);
    const tier = snapshot.pressure.tier;
    const tierConfig = policy.tiers[tier];
    const totalBudgetMs =
      snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;
    const remainingBudgetMs = Math.max(0, totalBudgetMs - snapshot.timers.elapsedMs);

    const unclampedDuration =
      remainingBudgetMs > 0
        ? Math.min(tierConfig.defaultDurationMs, remainingBudgetMs)
        : tierConfig.defaultDurationMs;

    const currentTickDurationMs = clampInteger(
      unclampedDuration,
      tierConfig.minDurationMs,
      tierConfig.maxDurationMs,
    );

    const nextTickAtMs =
      snapshot.outcome === null ? resolved.nowMs + currentTickDurationMs : null;

    return freezeObject({
      policyId: policy.policyId,
      mode: policy.mode,
      tier,
      tierConfig,
      seasonBudgetMs: policy.seasonBudgetMs,
      totalBudgetMs,
      remainingBudgetMs,
      currentTickDurationMs,
      nextTickAtMs,
      holdEnabled: policy.holdEnabled && snapshot.modeState.holdEnabled,
      holdChargesCap: policy.holdEnabled ? policy.baseHoldCharges : 0,
      phaseBoundaryWindowTicks: policy.phaseBoundaryWindowTicks,
      timingClassDurationsMs: freezeObject(
        buildTimingClassDurations(
          policy,
          snapshot,
          tierConfig,
          currentTickDurationMs,
          remainingBudgetMs,
        ),
      ),
    });
  }

  public applySnapshot(
    snapshot: RunStateSnapshot,
    nowMs = snapshot.timers.elapsedMs,
  ): RunStateSnapshot {
    const resolved = this.resolveSnapshot({
      snapshot,
      nowMs,
    });

    const next = cloneJson(snapshot) as RunStateSnapshot & {
      -readonly [K in keyof RunStateSnapshot]: RunStateSnapshot[K];
    };

    (
      next.timers as {
        currentTickDurationMs: number;
        nextTickAtMs: number | null;
        holdCharges: number;
        seasonBudgetMs: number;
      }
    ).currentTickDurationMs = resolved.currentTickDurationMs;
    (
      next.timers as {
        currentTickDurationMs: number;
        nextTickAtMs: number | null;
        holdCharges: number;
        seasonBudgetMs: number;
      }
    ).nextTickAtMs = resolved.nextTickAtMs;
    (
      next.timers as {
        currentTickDurationMs: number;
        nextTickAtMs: number | null;
        holdCharges: number;
        seasonBudgetMs: number;
      }
    ).seasonBudgetMs = snapshot.timers.seasonBudgetMs;

    (
      next.timers as {
        currentTickDurationMs: number;
        nextTickAtMs: number | null;
        holdCharges: number;
        seasonBudgetMs: number;
      }
    ).holdCharges = resolved.holdEnabled
      ? clampInteger(snapshot.timers.holdCharges, 0, resolved.holdChargesCap)
      : 0;

    (
      next.modeState as {
        holdEnabled: boolean;
        phaseBoundaryWindowsRemaining: number;
      }
    ).holdEnabled = resolved.holdEnabled;
    (
      next.modeState as {
        holdEnabled: boolean;
        phaseBoundaryWindowsRemaining: number;
      }
    ).phaseBoundaryWindowsRemaining = Math.max(
      snapshot.modeState.phaseBoundaryWindowsRemaining,
      resolved.phaseBoundaryWindowTicks,
    );

    const policyTag = `time-policy:${resolved.policyId}`;
    const nextTags = new Set(next.tags);
    nextTags.add(policyTag);
    (
      next as {
        tags: readonly string[];
      }
    ).tags = Object.freeze([...nextTags]);

    return deepFreeze(next) as RunStateSnapshot;
  }

  /**
   * Serialize the current policy version to a hash-safe string for proof chain inclusion.
   */
  public serializeForHash(): string {
    return 'time-policy-v1.0';
  }

  /**
   * Generate a diagnostic summary for the given snapshot.
   * Used by EngineOrchestrator health reports.
   */
  public diagnose(
    snapshot: RunStateSnapshot,
    _nowMs: number,
  ): { readonly mode: ModeCode; readonly tier: PressureTier; readonly ok: boolean } {
    const policy = this.getPolicy(snapshot.mode);
    const tier = snapshot.pressure.tier;
    return { mode: policy.mode, tier, ok: true };
  }
}

export const DEFAULT_TIME_POLICY_RESOLVER = new TimePolicyResolver();
