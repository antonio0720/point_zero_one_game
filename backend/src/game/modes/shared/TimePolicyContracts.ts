/*
 * POINT ZERO ONE — BACKEND MODES SHARED
 * /backend/src/game/modes/shared/TimePolicyContracts.ts
 *
 * Doctrine:
 * - time is a first-class mode contract, not a frontend-only presentation concern
 * - cadence must be pressure-reactive, mode-native, and deterministic
 * - backend timing policy is the source of truth for run budget, hold charges, and decision windows
 * - policy contracts must be stable enough for orchestration, tests, analytics, and liveops
 */

import type {
  ModeCode,
  PressureTier,
  TimingClass,
} from '../../engine/core/GamePrimitives';
import type { RunFactoryInput } from '../../engine/core/RunStateFactory';
import type { RunStateSnapshot } from '../../engine/core/RunStateSnapshot';

export type TimePolicyTier = PressureTier;

export interface TimeTierConfig {
  readonly tier: TimePolicyTier;
  readonly minDurationMs: number;
  readonly maxDurationMs: number;
  readonly defaultDurationMs: number;
  readonly decisionWindowMs: number;
  readonly interpolationTicks: number;
  readonly screenShake: boolean;
  readonly audioSignal: string | null;
}

export interface ModeTimePolicy {
  readonly policyId: string;
  readonly mode: ModeCode;
  readonly description: string;
  readonly seasonBudgetMs: number;
  readonly baseHoldCharges: number;
  readonly holdEnabled: boolean;
  readonly phaseBoundaryWindowTicks: number;
  readonly phaseBoundaryDurationMultiplier: number;
  readonly ghostBenchmarkDurationMultiplier: number;
  readonly pressureSpikeWindowCapMs: number;
  readonly explicitTimingClassDurationsMs: Readonly<
    Partial<Record<TimingClass, number | null>>
  >;
  readonly tiers: Readonly<Record<TimePolicyTier, TimeTierConfig>>;
}

export interface TimePolicyFactoryPatch {
  readonly policyId: string;
  readonly mode: ModeCode;
  readonly seasonBudgetMs: number;
  readonly currentTickDurationMs: number;
  readonly holdCharges: number;
}

export interface TimePolicyResolutionInput {
  readonly snapshot: RunStateSnapshot;
  readonly nowMs?: number;
}

export interface ResolvedTimePolicy {
  readonly policyId: string;
  readonly mode: ModeCode;
  readonly tier: TimePolicyTier;
  readonly tierConfig: TimeTierConfig;
  readonly seasonBudgetMs: number;
  readonly totalBudgetMs: number;
  readonly remainingBudgetMs: number;
  readonly currentTickDurationMs: number;
  readonly nextTickAtMs: number | null;
  readonly holdEnabled: boolean;
  readonly holdChargesCap: number;
  readonly phaseBoundaryWindowTicks: number;
  readonly timingClassDurationsMs: Readonly<Partial<Record<TimingClass, number | null>>>;
}

export const TIME_POLICY_TIERS: readonly TimePolicyTier[] = Object.freeze([
  'T0',
  'T1',
  'T2',
  'T3',
  'T4',
] as const);

export const TIME_POLICY_TIMING_CLASSES: readonly TimingClass[] = Object.freeze([
  'PRE',
  'POST',
  'FATE',
  'CTR',
  'RES',
  'AID',
  'GBM',
  'CAS',
  'PHZ',
  'PSK',
  'END',
  'ANY',
] as const);

export interface TimePolicyResolverContract {
  getPolicy(mode: ModeCode): ModeTimePolicy;
  resolveFactoryPatch(
    input: Pick<RunFactoryInput, 'mode' | 'seasonBudgetMs' | 'currentTickDurationMs' | 'holdCharges'>,
  ): TimePolicyFactoryPatch;
  resolveSnapshot(input: TimePolicyResolutionInput | RunStateSnapshot): ResolvedTimePolicy;
  applySnapshot(snapshot: RunStateSnapshot, nowMs?: number): RunStateSnapshot;
}
