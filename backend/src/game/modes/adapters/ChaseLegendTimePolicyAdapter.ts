/*
 * POINT ZERO ONE — BACKEND MODES ADAPTERS
 * /backend/src/game/modes/adapters/ChaseLegendTimePolicyAdapter.ts
 *
 * Doctrine:
 * - Chase a Legend is the phantom lane layered on top of backend ghost mode
 * - cadence should feel like a benchmark pursuit: disciplined, unforgiving, and always visible
 * - backend time policy must amplify ghost-benchmark pressure without granting solo-style forgiveness
 * - this adapter expresses legend-chase semantics while preserving the canonical T0 slowest / T4 fastest law
 */

import { cloneJson, deepFreeze } from '../../engine/core/Deterministic';
import type { RunStateSnapshot } from '../../engine/core/RunStateSnapshot';
import type {
  ModeTimePolicy,
  ResolvedTimePolicy,
  TimePolicyFactoryPatch,
  TimePolicyResolutionInput,
} from '../shared/TimePolicyContracts';
import {
  TimePolicyResolver,
  type TimePolicyResolverOptions,
} from '../shared/TimePolicyResolver';

type Primitive = string | number | boolean | null | undefined | bigint | symbol;
type MutableDeep<T> = T extends Primitive
  ? T
  : T extends (...args: never[]) => unknown
    ? T
    : T extends readonly (infer U)[]
      ? MutableDeep<U>[]
      : T extends object
        ? { -readonly [K in keyof T]: MutableDeep<T[K]> }
        : T;

export interface ChaseLegendNamedTimeWindows {
  readonly legendBenchmarkMs: number;
  readonly ghostSplitMs: number;
  readonly pressureSpikeMs: number;
  readonly phaseBoundaryMs: number;
  readonly scoreLockMs: number;
}

export interface ChaseLegendFactoryTimeInput {
  readonly seasonBudgetMs?: number;
  readonly currentTickDurationMs?: number;
  readonly holdCharges?: number;
}

function mutableClone<T>(value: T): MutableDeep<T> {
  return cloneJson(value) as MutableDeep<T>;
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function assertChaseLegend(snapshot: RunStateSnapshot): void {
  if (snapshot.mode !== 'ghost') {
    throw new Error(
      `ChaseLegendTimePolicyAdapter cannot adapt snapshot mode=${snapshot.mode}. Expected ghost.`,
    );
  }
}

function buildLegendTimingMap(
  base: ResolvedTimePolicy,
): ResolvedTimePolicy['timingClassDurationsMs'] {
  const currentTickMs = base.currentTickDurationMs;
  const legendBenchmarkMs = Math.max(
    currentTickMs,
    clampInteger(currentTickMs * 1.25, 5_000, 35_000),
  );
  const ghostSplitMs = Math.max(
    base.tierConfig.decisionWindowMs,
    clampInteger(currentTickMs * 1.05, 3_500, 20_000),
  );
  const pressureSpikeMs = Math.min(
    legendBenchmarkMs,
    Math.max(2_500, clampInteger(currentTickMs * 0.85, 2_500, 12_000)),
  );
  const phaseBoundaryMs = Math.max(
    legendBenchmarkMs,
    clampInteger(currentTickMs * 1.4, 6_000, 35_000),
  );
  const scoreLockMs = Math.max(
    currentTickMs,
    clampInteger(currentTickMs * 1.15, 4_000, 25_000),
  );

  return {
    ...base.timingClassDurationsMs,
    GBM: legendBenchmarkMs,
    PRE: ghostSplitMs,
    PSK: pressureSpikeMs,
    PHZ: phaseBoundaryMs,
    POST: scoreLockMs,
    RES: null,
    AID: null,
    ANY: null,
  } as ResolvedTimePolicy['timingClassDurationsMs'];
}

export class ChaseLegendTimePolicyAdapter {
  public readonly mode = 'ghost' as const;
  private readonly resolver: TimePolicyResolver;

  public constructor(options?: TimePolicyResolverOptions) {
    this.resolver = new TimePolicyResolver(options);
  }

  public getPolicy(): ModeTimePolicy {
    return this.resolver.getPolicy(this.mode);
  }

  public resolveFactoryPatch(
    input: ChaseLegendFactoryTimeInput = {},
  ): TimePolicyFactoryPatch {
    const patch = this.resolver.resolveFactoryPatch({
      mode: this.mode,
      seasonBudgetMs: input.seasonBudgetMs,
      currentTickDurationMs: input.currentTickDurationMs,
      holdCharges: 0,
    });

    return deepFreeze({
      ...patch,
      policyId: `${patch.policyId}:chase-legend`,
      holdCharges: 0,
    });
  }

  public resolveSnapshot(
    input: TimePolicyResolutionInput | RunStateSnapshot,
  ): ResolvedTimePolicy {
    const snapshot = 'snapshot' in input ? input.snapshot : input;
    assertChaseLegend(snapshot);

    const base = this.resolver.resolveSnapshot(input);
    const timingClassDurationsMs = buildLegendTimingMap(base);

    return deepFreeze({
      ...base,
      policyId: `${base.policyId}:chase-legend`,
      holdEnabled: false,
      holdChargesCap: 0,
      timingClassDurationsMs,
    });
  }

  public resolveNamedWindows(
    input: TimePolicyResolutionInput | RunStateSnapshot,
  ): ChaseLegendNamedTimeWindows {
    const resolved = this.resolveSnapshot(input);

    return deepFreeze({
      legendBenchmarkMs: resolved.timingClassDurationsMs.GBM ?? resolved.currentTickDurationMs,
      ghostSplitMs: resolved.timingClassDurationsMs.PRE ?? resolved.currentTickDurationMs,
      pressureSpikeMs: resolved.timingClassDurationsMs.PSK ?? resolved.currentTickDurationMs,
      phaseBoundaryMs: resolved.timingClassDurationsMs.PHZ ?? resolved.currentTickDurationMs,
      scoreLockMs: resolved.timingClassDurationsMs.POST ?? resolved.currentTickDurationMs,
    });
  }

  public applySnapshot(
    snapshot: RunStateSnapshot,
    nowMs?: number,
  ): RunStateSnapshot {
    assertChaseLegend(snapshot);

    const resolved = this.resolveSnapshot({ snapshot, nowMs });
    const next = mutableClone(snapshot);
    const named = this.resolveNamedWindows(snapshot);

    next.timers.seasonBudgetMs = resolved.seasonBudgetMs;
    next.timers.currentTickDurationMs = resolved.currentTickDurationMs;
    next.timers.nextTickAtMs =
      snapshot.outcome === null
        ? (nowMs ?? snapshot.timers.elapsedMs) + resolved.currentTickDurationMs
        : null;
    next.timers.holdCharges = 0;

    next.modeState.holdEnabled = false;
    next.modeState.sharedTreasury = false;
    next.modeState.sharedOpportunityDeck = false;
    next.modeState.roleLockEnabled = false;
    next.modeState.loadoutEnabled = true;
    next.modeState.phaseBoundaryWindowsRemaining = Math.max(
      next.modeState.phaseBoundaryWindowsRemaining,
      resolved.phaseBoundaryWindowTicks,
    );

    next.telemetry.warnings = [
      ...new Set([
        ...next.telemetry.warnings,
        'CHASE_LEGEND_TIME_POLICY_PHANTOM_ACTIVE',
      ]),
    ];

    next.telemetry.forkHints = [
      ...new Set([
        ...next.telemetry.forkHints,
        `chaselegend.time.legend_benchmark_ms=${named.legendBenchmarkMs}`,
        `chaselegend.time.ghost_split_ms=${named.ghostSplitMs}`,
        `chaselegend.time.pressure_spike_ms=${named.pressureSpikeMs}`,
        `chaselegend.time.phase_boundary_ms=${named.phaseBoundaryMs}`,
        `chaselegend.time.score_lock_ms=${named.scoreLockMs}`,
      ]),
    ];

    return deepFreeze(next) as RunStateSnapshot;
  }
}

export const chaseLegendTimePolicyAdapter = new ChaseLegendTimePolicyAdapter();
