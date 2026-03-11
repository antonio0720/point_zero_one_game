/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/TickTierPolicy.ts
 *
 * Doctrine:
 * - pressure owns the semantic score, but time owns the final cadence policy
 * - the policy may clamp upward for hard danger states; it should not lie by slowing crisis
 * - real-world season windows and mode tempo can shape cadence without mutating pressure truth
 * - every resolution returns reasons so runtime, telemetry, and ops can explain cadence shifts
 */

import type { ModeCode, PressureTier } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { SeasonClock } from './SeasonClock';
import { TICK_TIER_CONFIGS } from './types';

export interface TickTierPolicyOptions {
  readonly nowMs?: number;
  readonly forcedTier?: PressureTier | null;
  readonly previousTier?: PressureTier | null;
}

export interface TickTierResolution {
  readonly baseTier: PressureTier;
  readonly resolvedTier: PressureTier;
  readonly durationMs: number;
  readonly decisionWindowMs: number;
  readonly minDurationMs: number;
  readonly maxDurationMs: number;
  readonly seasonMultiplier: number;
  readonly modeTempoMultiplier: number;
  readonly budgetTempoMultiplier: number;
  readonly remainingBudgetMs: number;
  readonly shouldScreenShake: boolean;
  readonly shouldOpenEndgameWindow: boolean;
  readonly shouldInterpolate: boolean;
  readonly reasonCodes: readonly string[];
}

const TIER_ORDER: readonly PressureTier[] = Object.freeze(['T0', 'T1', 'T2', 'T3', 'T4']);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function tierIndex(tier: PressureTier): number {
  return TIER_ORDER.indexOf(tier);
}

function raiseTier(current: PressureTier, minimum: PressureTier): PressureTier {
  return tierIndex(minimum) > tierIndex(current) ? minimum : current;
}

function raiseTierBySteps(current: PressureTier, steps: number): PressureTier {
  const normalizedSteps = Math.max(0, Math.trunc(steps));
  const index = clamp(tierIndex(current) + normalizedSteps, 0, TIER_ORDER.length - 1);
  return TIER_ORDER[index];
}

function computeModeTempoMultiplier(mode: ModeCode): number {
  switch (mode) {
    case 'solo':
      return 1.00;
    case 'pvp':
      return 0.92;
    case 'coop':
      return 1.08;
    case 'ghost':
      return 0.95;
    default:
      return 1.00;
  }
}

function computeBudgetTempoMultiplier(remainingBudgetMs: number): number {
  if (remainingBudgetMs <= 15_000) {
    return 0.65;
  }

  if (remainingBudgetMs <= 30_000) {
    return 0.78;
  }

  if (remainingBudgetMs <= 60_000) {
    return 0.90;
  }

  return 1.00;
}

function normalizeDurationMs(value: number, min: number, max: number): number {
  const rounded = Math.trunc(value);
  return Math.max(min, Math.min(max, rounded));
}

export class TickTierPolicy {
  public constructor(private readonly seasonClock?: SeasonClock) {}

  public resolve(
    snapshot: RunStateSnapshot,
    options: TickTierPolicyOptions = {},
  ): TickTierResolution {
    const nowMs = Math.trunc(options.nowMs ?? Date.now());
    const baseTier = options.forcedTier ?? snapshot.pressure.tier;
    const reasonCodes = new Set<string>([
      `BASE_TIER_${baseTier}`,
      `PRESSURE_BAND_${snapshot.pressure.band}`,
    ]);

    let resolvedTier = baseTier;

    const weakestLayer = snapshot.shield.layers.find(
      (layer) => layer.layerId === snapshot.shield.weakestLayerId,
    );

    const cashflow = snapshot.economy.incomePerTick - snapshot.economy.expensesPerTick;
    const totalBudgetMs = snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;
    const remainingBudgetMs = Math.max(0, totalBudgetMs - snapshot.timers.elapsedMs);
    const visibleThreatCount = snapshot.tension.visibleThreats.length;
    const pendingAttackCount = snapshot.battle.pendingAttacks.length;

    if (snapshot.economy.cash < 0) {
      resolvedTier = raiseTier(resolvedTier, 'T4');
      reasonCodes.add('NEGATIVE_CASH');
    }

    if (cashflow < 0) {
      resolvedTier = raiseTier(resolvedTier, 'T3');
      reasonCodes.add('NEGATIVE_CASHFLOW');
    }

    if (snapshot.economy.haterHeat >= 85) {
      resolvedTier = raiseTier(resolvedTier, 'T4');
      reasonCodes.add('HATER_HEAT_85_PLUS');
    } else if (snapshot.economy.haterHeat >= 60) {
      resolvedTier = raiseTier(resolvedTier, 'T3');
      reasonCodes.add('HATER_HEAT_60_PLUS');
    }

    if (weakestLayer?.breached === true || (weakestLayer?.integrityRatio ?? 1) <= 0.15) {
      resolvedTier = raiseTier(resolvedTier, 'T4');
      reasonCodes.add('SHIELD_CRITICAL');
    } else if ((weakestLayer?.integrityRatio ?? 1) <= 0.35) {
      resolvedTier = raiseTier(resolvedTier, 'T3');
      reasonCodes.add('SHIELD_WEAK');
    }

    if (visibleThreatCount >= 4) {
      resolvedTier = raiseTier(resolvedTier, 'T4');
      reasonCodes.add('VISIBLE_THREATS_4_PLUS');
    } else if (visibleThreatCount >= 2) {
      resolvedTier = raiseTier(resolvedTier, 'T3');
      reasonCodes.add('VISIBLE_THREATS_2_PLUS');
    }

    if (pendingAttackCount >= 3) {
      resolvedTier = raiseTier(resolvedTier, 'T4');
      reasonCodes.add('PENDING_ATTACKS_3_PLUS');
    } else if (pendingAttackCount >= 1) {
      resolvedTier = raiseTier(resolvedTier, 'T2');
      reasonCodes.add('PENDING_ATTACKS_PRESENT');
    }

    if (remainingBudgetMs <= 15_000) {
      resolvedTier = raiseTier(resolvedTier, 'T4');
      reasonCodes.add('FINAL_15S');
    } else if (remainingBudgetMs <= 45_000) {
      resolvedTier = raiseTier(resolvedTier, 'T3');
      reasonCodes.add('FINAL_45S');
    }

    if (snapshot.sovereignty.integrityStatus === 'QUARANTINED') {
      resolvedTier = raiseTier(resolvedTier, 'T4');
      reasonCodes.add('INTEGRITY_QUARANTINED');
    }

    if (
      snapshot.mode === 'pvp' &&
      snapshot.battle.battleBudgetCap > 0 &&
      snapshot.battle.battleBudget >= snapshot.battle.battleBudgetCap * 0.75
    ) {
      resolvedTier = raiseTierBySteps(resolvedTier, 1);
      reasonCodes.add('PVP_BATTLE_BUDGET_HIGH');
    }

    const seasonMultiplier = this.seasonClock
      ? this.seasonClock.getPressureMultiplier(nowMs)
      : 1.0;

    if (seasonMultiplier > 1.0) {
      reasonCodes.add('SEASON_PRESSURE_ACTIVE');
    }

    const modeTempoMultiplier = computeModeTempoMultiplier(snapshot.mode);
    const budgetTempoMultiplier = computeBudgetTempoMultiplier(remainingBudgetMs);

    const config = TICK_TIER_CONFIGS[resolvedTier];

    const durationBeforeClamp =
      (config.defaultDurationMs / seasonMultiplier) *
      modeTempoMultiplier *
      budgetTempoMultiplier;

    const decisionWindowBeforeClamp =
      (config.decisionWindowMs / seasonMultiplier) *
      modeTempoMultiplier *
      budgetTempoMultiplier;

    const durationMs = normalizeDurationMs(
      durationBeforeClamp,
      config.minDurationMs,
      config.maxDurationMs,
    );

    const decisionWindowMs = normalizeDurationMs(
      decisionWindowBeforeClamp,
      1_000,
      config.decisionWindowMs,
    );

    const referencePreviousTier =
      options.previousTier ?? snapshot.pressure.previousTier ?? snapshot.pressure.tier;

    return Object.freeze({
      baseTier,
      resolvedTier,
      durationMs,
      decisionWindowMs,
      minDurationMs: config.minDurationMs,
      maxDurationMs: config.maxDurationMs,
      seasonMultiplier,
      modeTempoMultiplier,
      budgetTempoMultiplier,
      remainingBudgetMs,
      shouldScreenShake: resolvedTier === 'T4',
      shouldOpenEndgameWindow: remainingBudgetMs <= 30_000,
      shouldInterpolate: resolvedTier !== referencePreviousTier,
      reasonCodes: Object.freeze([...reasonCodes]),
    });
  }

  public resolveTier(
    snapshot: RunStateSnapshot,
    options: TickTierPolicyOptions = {},
  ): PressureTier {
    return this.resolve(snapshot, options).resolvedTier;
  }

  public resolveDurationMs(
    snapshot: RunStateSnapshot,
    options: TickTierPolicyOptions = {},
  ): number {
    return this.resolve(snapshot, options).durationMs;
  }

  public resolveDecisionWindowMs(
    snapshot: RunStateSnapshot,
    options: TickTierPolicyOptions = {},
  ): number {
    return this.resolve(snapshot, options).decisionWindowMs;
  }

  public getModeTempoMultiplier(mode: ModeCode): number {
    return computeModeTempoMultiplier(mode);
  }

  public getBudgetTempoMultiplier(remainingBudgetMs: number): number {
    return computeBudgetTempoMultiplier(Math.max(0, Math.trunc(remainingBudgetMs)));
  }
}