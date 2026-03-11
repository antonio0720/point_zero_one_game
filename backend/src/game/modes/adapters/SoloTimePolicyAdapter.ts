/*
 * POINT ZERO ONE — BACKEND MODES ADAPTERS
 * /backend/src/game/modes/adapters/SoloTimePolicyAdapter.ts
 *
 * Doctrine:
 * - solo is the canonical sovereign climb lane
 * - backend time policy owns cadence, budget, and hold authority
 * - solo may grant exactly one hold by doctrine, except when bleed/curse state disables it
 * - adapter output must stay deterministic so it can be called at bootstrap and per tick
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

export interface SoloNamedTimeWindows {
  readonly forcedFateMs: number;
  readonly haterInjectionMs: number;
  readonly crisisEventMs: number;
  readonly ghostBenchmarkMs: number;
  readonly phaseBoundaryMs: number;
  readonly pressureSpikeMs: number;
}

export interface SoloFactoryTimeInput {
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

function assertSolo(snapshot: RunStateSnapshot): void {
  if (snapshot.mode !== 'solo') {
    throw new Error(
      `SoloTimePolicyAdapter cannot adapt snapshot mode=${snapshot.mode}. Expected solo.`,
    );
  }
}

function hasHandicap(snapshot: RunStateSnapshot, handicapId: string): boolean {
  return snapshot.modeState.handicapIds.includes(handicapId);
}

function isBleedRun(snapshot: RunStateSnapshot): boolean {
  return snapshot.modeState.bleedMode || hasHandicap(snapshot, 'DISADVANTAGE_DRAFT');
}

function resolveSoloBudgetMs(baseBudgetMs: number, snapshot: RunStateSnapshot): number {
  if (hasHandicap(snapshot, 'CLOCK_CURSED')) {
    return Math.min(baseBudgetMs, 9 * 60 * 1_000);
  }

  return baseBudgetMs;
}

function scaleWindowMap(
  values: ResolvedTimePolicy['timingClassDurationsMs'],
  multiplier: number,
): ResolvedTimePolicy['timingClassDurationsMs'] {
  const next: Partial<Record<keyof typeof values, number | null>> = {};

  for (const [key, raw] of Object.entries(values)) {
    if (raw === null || raw === undefined) {
      next[key as keyof typeof values] = raw;
      continue;
    }

    next[key as keyof typeof values] = clampInteger(raw * multiplier, 250, 120_000);
  }

  return next as ResolvedTimePolicy['timingClassDurationsMs'];
}

export class SoloTimePolicyAdapter {
  public readonly mode = 'solo' as const;
  private readonly resolver: TimePolicyResolver;

  public constructor(options?: TimePolicyResolverOptions) {
    this.resolver = new TimePolicyResolver(options);
  }

  public getPolicy(): ModeTimePolicy {
    return this.resolver.getPolicy(this.mode);
  }

  public resolveFactoryPatch(input: SoloFactoryTimeInput = {}): TimePolicyFactoryPatch {
    const patch = this.resolver.resolveFactoryPatch({
      mode: this.mode,
      seasonBudgetMs: input.seasonBudgetMs,
      currentTickDurationMs: input.currentTickDurationMs,
      holdCharges: input.holdCharges,
    });

    return deepFreeze({
      ...patch,
      holdCharges: patch.holdCharges <= 0 ? 1 : patch.holdCharges,
    });
  }

  public resolveSnapshot(
    input: TimePolicyResolutionInput | RunStateSnapshot,
  ): ResolvedTimePolicy {
    const snapshot = 'snapshot' in input ? input.snapshot : input;
    assertSolo(snapshot);

    const base = this.resolver.resolveSnapshot(input);
    const bleed = isBleedRun(snapshot);
    const holdEnabled = base.holdEnabled && !bleed;
    const holdChargesCap = holdEnabled ? Math.max(1, base.holdChargesCap) : 0;
    const seasonBudgetMs = resolveSoloBudgetMs(base.seasonBudgetMs, snapshot);
    const totalBudgetMs = seasonBudgetMs + snapshot.timers.extensionBudgetMs;
    const remainingBudgetMs = Math.max(0, totalBudgetMs - snapshot.timers.elapsedMs);

    const decisionMultiplier = bleed ? 0.8 : 1;
    const timingClassDurationsMs = bleed
      ? scaleWindowMap(base.timingClassDurationsMs, decisionMultiplier)
      : base.timingClassDurationsMs;

    return deepFreeze({
      ...base,
      seasonBudgetMs,
      totalBudgetMs,
      remainingBudgetMs,
      holdEnabled,
      holdChargesCap,
      timingClassDurationsMs,
      tierConfig: {
        ...base.tierConfig,
        decisionWindowMs: clampInteger(
          base.tierConfig.decisionWindowMs * decisionMultiplier,
          250,
          120_000,
        ),
      },
    });
  }

  public resolveNamedWindows(
    input: TimePolicyResolutionInput | RunStateSnapshot,
  ): SoloNamedTimeWindows {
    const resolved = this.resolveSnapshot(input);

    return deepFreeze({
      forcedFateMs: resolved.tierConfig.decisionWindowMs,
      haterInjectionMs: resolved.tierConfig.decisionWindowMs,
      crisisEventMs: resolved.tierConfig.decisionWindowMs,
      ghostBenchmarkMs: resolved.timingClassDurationsMs.GBM ?? resolved.currentTickDurationMs,
      phaseBoundaryMs: resolved.timingClassDurationsMs.PHZ ?? resolved.currentTickDurationMs,
      pressureSpikeMs: resolved.timingClassDurationsMs.PSK ?? resolved.currentTickDurationMs,
    });
  }

  public applySnapshot(
    snapshot: RunStateSnapshot,
    nowMs?: number,
  ): RunStateSnapshot {
    assertSolo(snapshot);

    const resolved = this.resolveSnapshot({ snapshot, nowMs });
    const next = mutableClone(snapshot);
    const named = this.resolveNamedWindows(snapshot);

    next.timers.seasonBudgetMs = resolved.seasonBudgetMs;
    next.timers.currentTickDurationMs = resolved.currentTickDurationMs;
    next.timers.nextTickAtMs =
      snapshot.outcome === null ? (nowMs ?? snapshot.timers.elapsedMs) + resolved.currentTickDurationMs : null;
    next.timers.holdCharges = resolved.holdEnabled
      ? Math.min(snapshot.timers.holdCharges, resolved.holdChargesCap)
      : 0;

    next.modeState.holdEnabled = resolved.holdEnabled;
    next.modeState.phaseBoundaryWindowsRemaining = Math.max(
      next.modeState.phaseBoundaryWindowsRemaining,
      resolved.phaseBoundaryWindowTicks,
    );
    next.modeState.loadoutEnabled = true;
    next.modeState.sharedTreasury = false;
    next.modeState.sharedOpportunityDeck = false;

    next.telemetry.warnings = [
      ...new Set([
        ...next.telemetry.warnings,
        isBleedRun(snapshot)
          ? 'SOLO_TIME_POLICY_BLEED_MODE_ACTIVE'
          : 'SOLO_TIME_POLICY_CANONICAL_ACTIVE',
      ]),
    ];

    next.telemetry.forkHints = [
      ...new Set([
        ...next.telemetry.forkHints,
        `solo.time.forced_fate_ms=${named.forcedFateMs}`,
        `solo.time.phase_boundary_ms=${named.phaseBoundaryMs}`,
        `solo.time.hold_enabled=${String(resolved.holdEnabled)}`,
      ]),
    ];

    return deepFreeze(next) as RunStateSnapshot;
  }
}

export const soloTimePolicyAdapter = new SoloTimePolicyAdapter();
