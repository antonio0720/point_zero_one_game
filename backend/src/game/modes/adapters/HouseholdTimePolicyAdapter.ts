/*
 * POINT ZERO ONE — BACKEND MODES ADAPTERS
 * /backend/src/game/modes/adapters/HouseholdTimePolicyAdapter.ts
 *
 * Doctrine:
 * - household is the syndicate lane: shared treasury, rescue rhythm, and cooperative recovery windows matter
 * - backend time policy must widen aid and rescue timing without collapsing the global tier law
 * - cooperative timing should create room for trust decisions without turning the run into a pause state
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

export interface HouseholdNamedTimeWindows {
  readonly rescueWindowMs: number;
  readonly aidWindowMs: number;
  readonly proofShareWindowMs: number;
  readonly phaseBoundaryMs: number;
  readonly sharedTreasuryDecisionMs: number;
}

export interface HouseholdFactoryTimeInput {
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

function assertHousehold(snapshot: RunStateSnapshot): void {
  if (snapshot.mode !== 'coop') {
    throw new Error(
      `HouseholdTimePolicyAdapter cannot adapt snapshot mode=${snapshot.mode}. Expected coop.`,
    );
  }
}

function buildCoopTimingMap(base: ResolvedTimePolicy): ResolvedTimePolicy['timingClassDurationsMs'] {
  const currentTickMs = base.currentTickDurationMs;
  const aidWindowMs = Math.max(base.tierConfig.decisionWindowMs, clampInteger(currentTickMs * 1.25, 6_000, 30_000));
  const rescueWindowMs = Math.max(aidWindowMs, clampInteger(currentTickMs * 1.5, 8_000, 30_000));
  const proofShareWindowMs = Math.max(currentTickMs, clampInteger(currentTickMs * 1.1, 4_000, 30_000));

  return {
    ...base.timingClassDurationsMs,
    AID: aidWindowMs,
    RES: rescueWindowMs,
    PHZ: Math.max(base.timingClassDurationsMs.PHZ ?? currentTickMs, rescueWindowMs),
    ANY: null,
    PRE: currentTickMs,
    POST: proofShareWindowMs,
  } as ResolvedTimePolicy['timingClassDurationsMs'];
}

export class HouseholdTimePolicyAdapter {
  public readonly mode = 'coop' as const;
  private readonly resolver: TimePolicyResolver;

  public constructor(options?: TimePolicyResolverOptions) {
    this.resolver = new TimePolicyResolver(options);
  }

  public getPolicy(): ModeTimePolicy {
    return this.resolver.getPolicy(this.mode);
  }

  public resolveFactoryPatch(
    input: HouseholdFactoryTimeInput = {},
  ): TimePolicyFactoryPatch {
    const patch = this.resolver.resolveFactoryPatch({
      mode: this.mode,
      seasonBudgetMs: input.seasonBudgetMs,
      currentTickDurationMs: input.currentTickDurationMs,
      holdCharges: 0,
    });

    return deepFreeze({
      ...patch,
      holdCharges: 0,
    });
  }

  public resolveSnapshot(
    input: TimePolicyResolutionInput | RunStateSnapshot,
  ): ResolvedTimePolicy {
    const snapshot = 'snapshot' in input ? input.snapshot : input;
    assertHousehold(snapshot);

    const base = this.resolver.resolveSnapshot(input);
    const timingClassDurationsMs = buildCoopTimingMap(base);

    return deepFreeze({
      ...base,
      holdEnabled: false,
      holdChargesCap: 0,
      timingClassDurationsMs,
    });
  }

  public resolveNamedWindows(
    input: TimePolicyResolutionInput | RunStateSnapshot,
  ): HouseholdNamedTimeWindows {
    const resolved = this.resolveSnapshot(input);

    return deepFreeze({
      rescueWindowMs: resolved.timingClassDurationsMs.RES ?? resolved.currentTickDurationMs,
      aidWindowMs: resolved.timingClassDurationsMs.AID ?? resolved.currentTickDurationMs,
      proofShareWindowMs: resolved.timingClassDurationsMs.POST ?? resolved.currentTickDurationMs,
      phaseBoundaryMs: resolved.timingClassDurationsMs.PHZ ?? resolved.currentTickDurationMs,
      sharedTreasuryDecisionMs: Math.max(
        resolved.currentTickDurationMs,
        resolved.timingClassDurationsMs.AID ?? resolved.currentTickDurationMs,
      ),
    });
  }

  public applySnapshot(
    snapshot: RunStateSnapshot,
    nowMs?: number,
  ): RunStateSnapshot {
    assertHousehold(snapshot);

    const resolved = this.resolveSnapshot({ snapshot, nowMs });
    const next = mutableClone(snapshot);
    const named = this.resolveNamedWindows(snapshot);

    next.timers.seasonBudgetMs = resolved.seasonBudgetMs;
    next.timers.currentTickDurationMs = resolved.currentTickDurationMs;
    next.timers.nextTickAtMs =
      snapshot.outcome === null ? (nowMs ?? snapshot.timers.elapsedMs) + resolved.currentTickDurationMs : null;
    next.timers.holdCharges = 0;

    next.modeState.holdEnabled = false;
    next.modeState.sharedTreasury = true;
    next.modeState.sharedOpportunityDeck = false;
    next.modeState.roleLockEnabled = true;
    next.modeState.phaseBoundaryWindowsRemaining = Math.max(
      next.modeState.phaseBoundaryWindowsRemaining,
      resolved.phaseBoundaryWindowTicks,
    );

    next.telemetry.warnings = [
      ...new Set([
        ...next.telemetry.warnings,
        'COOP_TIME_POLICY_SYNDICATE_ACTIVE',
      ]),
    ];

    next.telemetry.forkHints = [
      ...new Set([
        ...next.telemetry.forkHints,
        `coop.time.rescue_window_ms=${named.rescueWindowMs}`,
        `coop.time.aid_window_ms=${named.aidWindowMs}`,
        `coop.time.proof_share_window_ms=${named.proofShareWindowMs}`,
        `coop.time.shared_treasury_decision_ms=${named.sharedTreasuryDecisionMs}`,
      ]),
    ];

    return deepFreeze(next) as RunStateSnapshot;
  }
}

export const householdTimePolicyAdapter = new HouseholdTimePolicyAdapter();
