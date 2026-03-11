/*
 * POINT ZERO ONE — BACKEND MODES ADAPTERS
 * /backend/src/game/modes/adapters/TeamUpTimePolicyAdapter.ts
 *
 * Doctrine:
 * - Team Up is the trust-architecture cooperative lane layered on top of backend coop mode
 * - cadence must preserve the canonical T0→T4 time law while widening partner coordination windows
 * - backend time policy should support relay decisions, aid decisions, and regroup moments without creating pause abuse
 * - this adapter exists to express Team Up semantics cleanly even when the runtime ModeCode remains coop
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

export interface TeamUpNamedTimeWindows {
  readonly relayDecisionMs: number;
  readonly assistWindowMs: number;
  readonly regroupWindowMs: number;
  readonly syncWindowMs: number;
  readonly threatBroadcastMs: number;
}

export interface TeamUpFactoryTimeInput {
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

function assertTeamUp(snapshot: RunStateSnapshot): void {
  if (snapshot.mode !== 'coop') {
    throw new Error(
      `TeamUpTimePolicyAdapter cannot adapt snapshot mode=${snapshot.mode}. Expected coop.`,
    );
  }
}

function buildTeamUpTimingMap(
  base: ResolvedTimePolicy,
): ResolvedTimePolicy['timingClassDurationsMs'] {
  const currentTickMs = base.currentTickDurationMs;
  const relayDecisionMs = Math.max(
    base.tierConfig.decisionWindowMs,
    clampInteger(currentTickMs * 1.15, 5_000, 30_000),
  );
  const assistWindowMs = Math.max(
    relayDecisionMs,
    clampInteger(currentTickMs * 1.35, 7_000, 30_000),
  );
  const regroupWindowMs = Math.max(
    assistWindowMs,
    clampInteger(currentTickMs * 1.55, 8_000, 35_000),
  );
  const syncWindowMs = Math.max(
    currentTickMs,
    clampInteger(currentTickMs * 1.2, 4_000, 25_000),
  );
  const threatBroadcastMs = Math.min(
    regroupWindowMs,
    Math.max(currentTickMs, 4_000),
  );

  return {
    ...base.timingClassDurationsMs,
    PRE: relayDecisionMs,
    AID: assistWindowMs,
    RES: regroupWindowMs,
    POST: syncWindowMs,
    PHZ: Math.max(base.timingClassDurationsMs.PHZ ?? currentTickMs, regroupWindowMs),
    PSK: threatBroadcastMs,
    ANY: null,
  } as ResolvedTimePolicy['timingClassDurationsMs'];
}

export class TeamUpTimePolicyAdapter {
  public readonly mode = 'coop' as const;
  private readonly resolver: TimePolicyResolver;

  public constructor(options?: TimePolicyResolverOptions) {
    this.resolver = new TimePolicyResolver(options);
  }

  public getPolicy(): ModeTimePolicy {
    return this.resolver.getPolicy(this.mode);
  }

  public resolveFactoryPatch(
    input: TeamUpFactoryTimeInput = {},
  ): TimePolicyFactoryPatch {
    const patch = this.resolver.resolveFactoryPatch({
      mode: this.mode,
      seasonBudgetMs: input.seasonBudgetMs,
      currentTickDurationMs: input.currentTickDurationMs,
      holdCharges: 0,
    });

    return deepFreeze({
      ...patch,
      policyId: `${patch.policyId}:team-up`,
      holdCharges: 0,
    });
  }

  public resolveSnapshot(
    input: TimePolicyResolutionInput | RunStateSnapshot,
  ): ResolvedTimePolicy {
    const snapshot = 'snapshot' in input ? input.snapshot : input;
    assertTeamUp(snapshot);

    const base = this.resolver.resolveSnapshot(input);
    const timingClassDurationsMs = buildTeamUpTimingMap(base);

    return deepFreeze({
      ...base,
      policyId: `${base.policyId}:team-up`,
      holdEnabled: false,
      holdChargesCap: 0,
      timingClassDurationsMs,
    });
  }

  public resolveNamedWindows(
    input: TimePolicyResolutionInput | RunStateSnapshot,
  ): TeamUpNamedTimeWindows {
    const resolved = this.resolveSnapshot(input);

    return deepFreeze({
      relayDecisionMs: resolved.timingClassDurationsMs.PRE ?? resolved.currentTickDurationMs,
      assistWindowMs: resolved.timingClassDurationsMs.AID ?? resolved.currentTickDurationMs,
      regroupWindowMs: resolved.timingClassDurationsMs.RES ?? resolved.currentTickDurationMs,
      syncWindowMs: resolved.timingClassDurationsMs.POST ?? resolved.currentTickDurationMs,
      threatBroadcastMs: resolved.timingClassDurationsMs.PSK ?? resolved.currentTickDurationMs,
    });
  }

  public applySnapshot(
    snapshot: RunStateSnapshot,
    nowMs?: number,
  ): RunStateSnapshot {
    assertTeamUp(snapshot);

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
    next.modeState.sharedOpportunityDeck = true;
    next.modeState.roleLockEnabled = false;
    next.modeState.phaseBoundaryWindowsRemaining = Math.max(
      next.modeState.phaseBoundaryWindowsRemaining,
      resolved.phaseBoundaryWindowTicks,
    );

    next.telemetry.warnings = [
      ...new Set([
        ...next.telemetry.warnings,
        'TEAM_UP_TIME_POLICY_TRUST_ACTIVE',
      ]),
    ];

    next.telemetry.forkHints = [
      ...new Set([
        ...next.telemetry.forkHints,
        `teamup.time.relay_decision_ms=${named.relayDecisionMs}`,
        `teamup.time.assist_window_ms=${named.assistWindowMs}`,
        `teamup.time.regroup_window_ms=${named.regroupWindowMs}`,
        `teamup.time.sync_window_ms=${named.syncWindowMs}`,
        `teamup.time.threat_broadcast_ms=${named.threatBroadcastMs}`,
      ]),
    ];

    return deepFreeze(next) as RunStateSnapshot;
  }
}

export const teamUpTimePolicyAdapter = new TeamUpTimePolicyAdapter();
