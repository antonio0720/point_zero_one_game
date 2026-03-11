/*
 * POINT ZERO ONE — BACKEND MODES ADAPTERS
 * /backend/src/game/modes/adapters/HeadToHeadTimePolicyAdapter.ts
 *
 * Doctrine:
 * - head-to-head is the predator lane: tempo matters, hesitation is punished, and holds are disabled
 * - backend time policy must preserve shared-opportunity and counter-play windows as authoritative server rules
 * - pvp cadence may tighten, but it must never violate the core law that T0 is slowest and T4 is fastest
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

export interface HeadToHeadNamedTimeWindows {
  readonly firstRefusalMs: number;
  readonly sharedDiscardMs: number;
  readonly counterPlayMs: number;
  readonly extractionCadenceTicks: number;
  readonly threatRevealMs: number;
}

export interface HeadToHeadFactoryTimeInput {
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

function assertHeadToHead(snapshot: RunStateSnapshot): void {
  if (snapshot.mode !== 'pvp') {
    throw new Error(
      `HeadToHeadTimePolicyAdapter cannot adapt snapshot mode=${snapshot.mode}. Expected pvp.`,
    );
  }
}

function withTimingOverride(
  base: ResolvedTimePolicy,
  key: keyof ResolvedTimePolicy['timingClassDurationsMs'],
  value: number | null,
): ResolvedTimePolicy['timingClassDurationsMs'] {
  return {
    ...base.timingClassDurationsMs,
    [key]: value,
  } as ResolvedTimePolicy['timingClassDurationsMs'];
}

export class HeadToHeadTimePolicyAdapter {
  public readonly mode = 'pvp' as const;
  private readonly resolver: TimePolicyResolver;

  public constructor(options?: TimePolicyResolverOptions) {
    this.resolver = new TimePolicyResolver(options);
  }

  public getPolicy(): ModeTimePolicy {
    return this.resolver.getPolicy(this.mode);
  }

  public resolveFactoryPatch(
    input: HeadToHeadFactoryTimeInput = {},
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
    assertHeadToHead(snapshot);

    const base = this.resolver.resolveSnapshot(input);
    const currentTickMs = base.currentTickDurationMs;
    const firstRefusalMs = Math.max(8_000, currentTickMs);
    const sharedDiscardMs = Math.max(12_000, clampInteger(currentTickMs * 1.5, 12_000, 30_000));
    const counterPlayMs = 5_000;
    const threatRevealMs = Math.max(currentTickMs, 4_000);

    let timingClassDurationsMs = withTimingOverride(base, 'PRE', firstRefusalMs);
    timingClassDurationsMs = {
      ...timingClassDurationsMs,
      POST: sharedDiscardMs,
      CTR: counterPlayMs,
      PSK: Math.min(threatRevealMs, base.currentTickDurationMs),
      RES: null,
      AID: null,
    } as ResolvedTimePolicy['timingClassDurationsMs'];

    return deepFreeze({
      ...base,
      holdEnabled: false,
      holdChargesCap: 0,
      timingClassDurationsMs,
    });
  }

  public resolveNamedWindows(
    input: TimePolicyResolutionInput | RunStateSnapshot,
  ): HeadToHeadNamedTimeWindows {
    const resolved = this.resolveSnapshot(input);

    return deepFreeze({
      firstRefusalMs: resolved.timingClassDurationsMs.PRE ?? resolved.currentTickDurationMs,
      sharedDiscardMs: resolved.timingClassDurationsMs.POST ?? resolved.currentTickDurationMs,
      counterPlayMs: resolved.timingClassDurationsMs.CTR ?? 5_000,
      extractionCadenceTicks: 3,
      threatRevealMs: resolved.timingClassDurationsMs.PSK ?? resolved.currentTickDurationMs,
    });
  }

  public applySnapshot(
    snapshot: RunStateSnapshot,
    nowMs?: number,
  ): RunStateSnapshot {
    assertHeadToHead(snapshot);

    const resolved = this.resolveSnapshot({ snapshot, nowMs });
    const next = mutableClone(snapshot);
    const named = this.resolveNamedWindows(snapshot);

    next.timers.seasonBudgetMs = resolved.seasonBudgetMs;
    next.timers.currentTickDurationMs = resolved.currentTickDurationMs;
    next.timers.nextTickAtMs =
      snapshot.outcome === null ? (nowMs ?? snapshot.timers.elapsedMs) + resolved.currentTickDurationMs : null;
    next.timers.holdCharges = 0;

    next.modeState.holdEnabled = false;
    next.modeState.sharedOpportunityDeck = true;
    next.modeState.sharedTreasury = false;
    next.modeState.roleLockEnabled = false;
    next.modeState.extractionActionsRemaining = Math.max(
      0,
      snapshot.modeState.extractionActionsRemaining,
    );

    next.telemetry.warnings = [
      ...new Set([
        ...next.telemetry.warnings,
        'PVP_TIME_POLICY_PREDATOR_ACTIVE',
      ]),
    ];

    next.telemetry.forkHints = [
      ...new Set([
        ...next.telemetry.forkHints,
        `pvp.time.first_refusal_ms=${named.firstRefusalMs}`,
        `pvp.time.shared_discard_ms=${named.sharedDiscardMs}`,
        `pvp.time.counter_play_ms=${named.counterPlayMs}`,
        `pvp.time.extraction_cadence_ticks=${named.extractionCadenceTicks}`,
      ]),
    ];

    return deepFreeze(next) as RunStateSnapshot;
  }
}

export const headToHeadTimePolicyAdapter = new HeadToHeadTimePolicyAdapter();
