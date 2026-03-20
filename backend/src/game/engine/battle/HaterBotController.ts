/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/battle/HaterBotController.ts
 *
 * Doctrine:
 * - controller logic translates pressure + heat + rivalry into bot posture
 * - it must never mutate snapshot-owned runtime state
 * - pressureScore is normalized (0..1); composite threat is tactical (0..100)
 * - the controller should remain deterministic, explainable, and replay-safe
 * - richer diagnostics are preferred over hidden magic numbers so battle/chat/
 *   proof layers can all explain why hostility escalated or cooled off
 */

import type { ShieldLayerId } from '../core/GamePrimitives';
import type { BotRuntimeState } from '../core/RunStateSnapshot';
import type {
  BotAttackWindowState,
  BotDynamicContext,
  BotEvolveInput,
  BotEvolveResult,
  BotIntentCode,
  BotMomentumDirection,
  BotProfile,
  BotRetreatDecision,
  BotThreatBand,
  BotThreatBreakdown,
  BotThreatDiagnostics,
  PreferredPressureBand,
} from './types';
import {
  BOT_DYNAMIC_CONTEXT_DEFAULTS,
  BOT_PROFILE_OPTIONAL_DEFAULTS,
  BOT_THREAT_THRESHOLD_BY_BAND,
} from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function safeRatio(numerator: number, denominator: number, fallback = 0): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return fallback;
  }
  return numerator / denominator;
}

function normalizeUnit(value: number): number {
  return clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

function normalizeTactical(value: number): number {
  return clamp(Number.isFinite(value) ? value : 0, 0, 100);
}

function sum(values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    ordered.push(value);
  }
  return ordered;
}

interface ProfileDoctrine {
  readonly pressureFloor: number;
  readonly heatFloor: number;
  readonly rivalryFloor: number;
  readonly retreatFloor: number;
  readonly reengageBonus: number;
  readonly cooldownThreatSuppression: number;
  readonly volatilityWeight: number;
  readonly shieldWeight: number;
  readonly economyWeight: number;
  readonly cascadeWeight: number;
  readonly timingWeight: number;
  readonly momentumWeight: number;
  readonly intimidationBias: number;
  readonly closeoutBias: number;
  readonly trustPunishBias: number;
  readonly ghostPressureBias: number;
  readonly budgetSensitivity: number;
  readonly preferredPressureBand: PreferredPressureBand;
}

interface ThreatComputation {
  readonly context: BotDynamicContext;
  readonly doctrine: ProfileDoctrine;
  readonly cooldownRemaining: number;
  readonly momentum: BotMomentumDirection;
  readonly band: BotThreatBand;
  readonly intent: BotIntentCode;
  readonly attackWindow: BotAttackWindowState;
  readonly retreatDecision: BotRetreatDecision;
  readonly breakdown: BotThreatBreakdown;
  readonly narrativeTags: readonly string[];
  readonly doctrinalNotes: readonly string[];
}

export class HaterBotController {
  /**
   * Public evolution entry point. Deterministic and side-effect free.
   */
  public evolve(
    runtime: BotRuntimeState,
    profile: BotProfile,
    input: BotEvolveInput,
  ): BotEvolveResult {
    if (runtime.neutralized) {
      return this.createNeutralizedResult(runtime, profile, input);
    }

    const computation = this.computeThreat(runtime, profile, input);
    const nextState = this.determineState(runtime, profile, computation);
    const evolvedRuntime = this.evolveRuntime(runtime, nextState, computation.breakdown.finalCompositeThreat);

    return {
      runtime: evolvedRuntime,
      previousState: runtime.state,
      nextState,
      stateChanged: runtime.state !== nextState,
      compositeThreat: computation.breakdown.finalCompositeThreat,
      diagnostics: this.buildDiagnostics(computation),
    };
  }

  // ── Neutralization path ──────────────────────────────────────────────────

  private createNeutralizedResult(
    runtime: BotRuntimeState,
    profile: BotProfile,
    input: BotEvolveInput,
  ): BotEvolveResult {
    const context = this.buildDynamicContext(input);
    const doctrinalNotes = this.buildDoctrinalNotes(profile);
    const breakdown: BotThreatBreakdown = {
      baselinePressure: 0,
      baselineHeat: 0,
      baselineRivalry: 0,
      modeBias: 0,
      volatilityBonus: 0,
      shieldBonus: 0,
      economyBonus: 0,
      cascadeBonus: 0,
      timingBonus: 0,
      momentumBonus: 0,
      profileBias: 0,
      suppression: 100,
      preClampTotal: 0,
      finalCompositeThreat: 0,
    };

    const neutralizedRuntime: BotRuntimeState = {
      ...runtime,
      state: 'NEUTRALIZED',
      heat: 0,
    };

    return {
      runtime: neutralizedRuntime,
      previousState: runtime.state,
      nextState: 'NEUTRALIZED',
      stateChanged: runtime.state !== 'NEUTRALIZED',
      compositeThreat: 0,
      diagnostics: {
        band: 'DORMANT',
        intent: 'RESET',
        momentum: 'COOLING',
        attackWindow: 'CLOSED',
        retreatDecision: 'NEUTRALIZED_LOCK',
        cooldownRemaining: 0,
        context,
        breakdown,
        narrativeTags: uniqueStrings([
          'neutralized',
          `bot:${runtime.botId}`,
          `mode:${input.mode}`,
        ]),
        doctrinalNotes,
      },
    };
  }

  // ── Threat computation ───────────────────────────────────────────────────

  private computeThreat(
    runtime: BotRuntimeState,
    profile: BotProfile,
    input: BotEvolveInput,
  ): ThreatComputation {
    const doctrine = this.resolveDoctrine(profile);
    const context = this.buildDynamicContext(input);
    const cooldownRemaining = this.computeCooldownRemaining(runtime, profile, context);
    const momentum = this.determineMomentum(context);

    const baselinePressure = this.computeBaselinePressure(profile, doctrine, context);
    const baselineHeat = this.computeBaselineHeat(profile, doctrine, context);
    const baselineRivalry = this.computeBaselineRivalry(profile, doctrine, context);
    const modeBias = this.computeModeBias(profile, context);
    const volatilityBonus = this.computeVolatilityBonus(profile, doctrine, context, momentum);
    const shieldBonus = this.computeShieldBonus(profile, doctrine, context);
    const economyBonus = this.computeEconomyBonus(profile, doctrine, context);
    const cascadeBonus = this.computeCascadeBonus(profile, doctrine, context);
    const timingBonus = this.computeTimingBonus(profile, doctrine, context, runtime);
    const momentumBonus = this.computeMomentumBonus(profile, doctrine, context, momentum, runtime);
    const profileBias = this.computeProfileBias(profile, doctrine, context, runtime);
    const suppression = this.computeSuppression(profile, doctrine, context, runtime, cooldownRemaining);

    const preClampTotal = round3(
      sum([
        baselinePressure,
        baselineHeat,
        baselineRivalry,
        modeBias,
        volatilityBonus,
        shieldBonus,
        economyBonus,
        cascadeBonus,
        timingBonus,
        momentumBonus,
        profileBias,
        -suppression,
      ]),
    );

    const finalCompositeThreat = round2(clamp(preClampTotal, 0, 100));

    const breakdown: BotThreatBreakdown = {
      baselinePressure,
      baselineHeat,
      baselineRivalry,
      modeBias,
      volatilityBonus,
      shieldBonus,
      economyBonus,
      cascadeBonus,
      timingBonus,
      momentumBonus,
      profileBias,
      suppression,
      preClampTotal,
      finalCompositeThreat,
    };

    const band = this.classifyThreatBand(finalCompositeThreat);
    const intent = this.determineIntent(profile, context, runtime, finalCompositeThreat, band, cooldownRemaining);
    const attackWindow = this.determineAttackWindow(profile, context, runtime, finalCompositeThreat, cooldownRemaining);
    const retreatDecision = this.determineRetreatDecision(profile, doctrine, runtime, finalCompositeThreat, cooldownRemaining);
    const narrativeTags = this.buildNarrativeTags(profile, context, runtime, breakdown, band, intent, attackWindow, momentum, cooldownRemaining);
    const doctrinalNotes = this.buildDoctrinalNotes(profile);

    return {
      context,
      doctrine,
      cooldownRemaining,
      momentum,
      band,
      intent,
      attackWindow,
      retreatDecision,
      breakdown,
      narrativeTags,
      doctrinalNotes,
    };
  }

  private resolveDoctrine(profile: BotProfile): ProfileDoctrine {
    return {
      pressureFloor: profile.pressureFloor ?? BOT_PROFILE_OPTIONAL_DEFAULTS.pressureFloor,
      heatFloor: profile.heatFloor ?? BOT_PROFILE_OPTIONAL_DEFAULTS.heatFloor,
      rivalryFloor: profile.rivalryFloor ?? BOT_PROFILE_OPTIONAL_DEFAULTS.rivalryFloor,
      retreatFloor: profile.retreatFloor ?? BOT_PROFILE_OPTIONAL_DEFAULTS.retreatFloor,
      reengageBonus: profile.reengageBonus ?? BOT_PROFILE_OPTIONAL_DEFAULTS.reengageBonus,
      cooldownThreatSuppression:
        profile.cooldownThreatSuppression ?? BOT_PROFILE_OPTIONAL_DEFAULTS.cooldownThreatSuppression,
      volatilityWeight: profile.volatilityWeight ?? BOT_PROFILE_OPTIONAL_DEFAULTS.volatilityWeight,
      shieldWeight: profile.shieldWeight ?? BOT_PROFILE_OPTIONAL_DEFAULTS.shieldWeight,
      economyWeight: profile.economyWeight ?? BOT_PROFILE_OPTIONAL_DEFAULTS.economyWeight,
      cascadeWeight: profile.cascadeWeight ?? BOT_PROFILE_OPTIONAL_DEFAULTS.cascadeWeight,
      timingWeight: profile.timingWeight ?? BOT_PROFILE_OPTIONAL_DEFAULTS.timingWeight,
      momentumWeight: profile.momentumWeight ?? BOT_PROFILE_OPTIONAL_DEFAULTS.momentumWeight,
      intimidationBias: profile.intimidationBias ?? BOT_PROFILE_OPTIONAL_DEFAULTS.intimidationBias,
      closeoutBias: profile.closeoutBias ?? BOT_PROFILE_OPTIONAL_DEFAULTS.closeoutBias,
      trustPunishBias: profile.trustPunishBias ?? BOT_PROFILE_OPTIONAL_DEFAULTS.trustPunishBias,
      ghostPressureBias: profile.ghostPressureBias ?? BOT_PROFILE_OPTIONAL_DEFAULTS.ghostPressureBias,
      budgetSensitivity: profile.budgetSensitivity ?? BOT_PROFILE_OPTIONAL_DEFAULTS.budgetSensitivity,
      preferredPressureBand:
        profile.preferredPressureBand ?? BOT_PROFILE_OPTIONAL_DEFAULTS.preferredPressureBand,
    };
  }

  private buildDynamicContext(input: BotEvolveInput): BotDynamicContext {
    const weakestLayerRatio = input.weakestLayerRatio ??
      (() => {
        if (
          Number.isFinite(input.weakestLayerCurrent) &&
          Number.isFinite(input.weakestLayerMax) &&
          (input.weakestLayerMax ?? 0) > 0
        ) {
          return safeRatio(input.weakestLayerCurrent ?? 0, input.weakestLayerMax ?? 1, 1);
        }
        return BOT_DYNAMIC_CONTEXT_DEFAULTS.weakestLayerRatio;
      })();

    const shieldOverallIntegrityRatio =
      input.shieldOverallIntegrityRatio ?? weakestLayerRatio;

    return {
      mode: input.mode,
      tick: input.tick,
      pressureScore: normalizeUnit(input.pressureScore),
      pressureDelta: round3(input.pressureDelta ?? 0),
      baseHeat: normalizeTactical(input.baseHeat),
      baseHeatDelta: round3(input.baseHeatDelta ?? 0),
      rivalryHeatCarry: normalizeTactical(input.rivalryHeatCarry),
      rivalryDelta: round3(input.rivalryDelta ?? 0),
      weakestLayerId: input.weakestLayerId ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.weakestLayerId,
      weakestLayerRatio: normalizeUnit(weakestLayerRatio),
      shieldOverallIntegrityRatio: normalizeUnit(shieldOverallIntegrityRatio),
      cash: round2(input.cash ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.cash),
      debt: round2(input.debt ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.debt),
      netWorth: round2(input.netWorth ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.netWorth),
      incomePerTick: round2(input.incomePerTick ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.incomePerTick),
      expensesPerTick: round2(input.expensesPerTick ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.expensesPerTick),
      battleBudget: round2(input.battleBudget ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.battleBudget),
      battleBudgetCap: round2(input.battleBudgetCap ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.battleBudgetCap),
      pendingAttackCount: Math.max(0, Math.floor(input.pendingAttackCount ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.pendingAttackCount)),
      pendingPressureTax: round2(input.pendingPressureTax ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.pendingPressureTax),
      extractionCooldownTicks: Math.max(0, Math.floor(input.extractionCooldownTicks ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.extractionCooldownTicks)),
      activeCascadeChains: Math.max(0, Math.floor(input.activeCascadeChains ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.activeCascadeChains)),
      brokenCascadeChains: Math.max(0, Math.floor(input.brokenCascadeChains ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.brokenCascadeChains)),
      visibleThreatCount: Math.max(0, Math.floor(input.visibleThreatCount ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.visibleThreatCount)),
      anticipationScore: normalizeUnit(input.anticipationScore ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.anticipationScore),
      communityHeatModifier: round2(input.communityHeatModifier ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.communityHeatModifier),
      trustInstability: normalizeUnit(input.trustInstability ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.trustInstability),
      allianceExposure: normalizeUnit(input.allianceExposure ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.allianceExposure),
      spectatorPressure: normalizeUnit(input.spectatorPressure ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.spectatorPressure),
      ghostMarkerCount: Math.max(0, Math.floor(input.ghostMarkerCount ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.ghostMarkerCount)),
      legendGap: round2(input.legendGap ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.legendGap),
      counterIntelTier: Math.max(0, Math.floor(input.counterIntelTier ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.counterIntelTier)),
      phaseBoundaryWindowsRemaining: Math.max(0, Math.floor(input.phaseBoundaryWindowsRemaining ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.phaseBoundaryWindowsRemaining)),
      telemetryWarnings: input.telemetryWarnings ?? BOT_DYNAMIC_CONTEXT_DEFAULTS.telemetryWarnings,
    };
  }

  private computeCooldownRemaining(
    runtime: BotRuntimeState,
    profile: BotProfile,
    context: BotDynamicContext,
  ): number {
    if (runtime.lastAttackTick === null) {
      return 0;
    }
    const elapsed = Math.max(0, contextTick(context, runtime, 0) - runtime.lastAttackTick);
    return Math.max(0, profile.cooldownTicks - elapsed);
  }

  private determineMomentum(context: BotDynamicContext): BotMomentumDirection {
    const delta = context.pressureDelta + context.baseHeatDelta * 0.01 + context.rivalryDelta * 0.01;
    if (delta >= 0.16) {
      return 'SPIKING';
    }
    if (delta >= 0.03) {
      return 'RISING';
    }
    if (delta <= -0.08) {
      return 'COOLING';
    }
    return 'STABLE';
  }

  private computeBaselinePressure(
    profile: BotProfile,
    doctrine: ProfileDoctrine,
    context: BotDynamicContext,
  ): number {
    const normalized = Math.max(doctrine.pressureFloor / 100, context.pressureScore);
    return round3(normalized * 100 * profile.pressureWeight);
  }

  private computeBaselineHeat(
    profile: BotProfile,
    doctrine: ProfileDoctrine,
    context: BotDynamicContext,
  ): number {
    const tactical = Math.max(doctrine.heatFloor, context.baseHeat);
    return round3(tactical * profile.heatWeight);
  }

  private computeBaselineRivalry(
    profile: BotProfile,
    doctrine: ProfileDoctrine,
    context: BotDynamicContext,
  ): number {
    const tactical = Math.max(doctrine.rivalryFloor, context.rivalryHeatCarry);
    return round3(tactical * profile.rivalryWeight);
  }

  private computeModeBias(profile: BotProfile, context: BotDynamicContext): number {
    const modeBias = profile.modeWeight[contextMode(context)] ?? 0;
    const attackWindowBias = profile.modeAttackWindowBias?.[contextMode(context)] ?? 0;
    return round3(modeBias + attackWindowBias);
  }

  private computeVolatilityBonus(
    _profile: BotProfile,
    doctrine: ProfileDoctrine,
    context: BotDynamicContext,
    momentum: BotMomentumDirection,
  ): number {
    const volatility =
      Math.abs(context.pressureDelta) * 42 +
      Math.abs(context.baseHeatDelta) * 0.35 +
      Math.abs(context.rivalryDelta) * 0.25;

    const momentumBias =
      momentum === 'SPIKING'
        ? 6
        : momentum === 'RISING'
          ? 2.5
          : momentum === 'COOLING'
            ? -3
            : 0;

    return round3(Math.max(0, volatility * doctrine.volatilityWeight + momentumBias));
  }

  private computeShieldBonus(
    profile: BotProfile,
    doctrine: ProfileDoctrine,
    context: BotDynamicContext,
  ): number {
    const weakestExposure = (1 - context.weakestLayerRatio) * 100;
    const overallExposure = (1 - context.shieldOverallIntegrityRatio) * 100;
    const directPreferenceBias = profile.weaknessBiasByLayer?.[profile.preferredLayer] ?? 0;
    const weakestLayerBias = context.weakestLayerId
      ? profile.weaknessBiasByLayer?.[context.weakestLayerId] ?? 0
      : 0;

    return round3(
      (weakestExposure * 0.65 + overallExposure * 0.35) * doctrine.shieldWeight +
        directPreferenceBias +
        weakestLayerBias,
    );
  }

  private computeEconomyBonus(
    profile: BotProfile,
    doctrine: ProfileDoctrine,
    context: BotDynamicContext,
  ): number {
    const negativeCashPressure = context.cash < 0 ? Math.min(20, Math.abs(context.cash) * 0.05) : 0;
    const debtPressure = Math.min(18, Math.max(0, context.debt) * 0.02);
    const expenseOverhang = Math.max(0, context.expensesPerTick - context.incomePerTick);
    const incomeSuffocation = Math.min(14, expenseOverhang * 0.5);
    const extractionBonus = profile.preferredCategory === 'EXTRACTION' ? negativeCashPressure * 0.35 : 0;
    const drainBonus = profile.preferredCategory === 'DRAIN' ? (debtPressure + incomeSuffocation) * 0.30 : 0;

    return round3(
      (negativeCashPressure + debtPressure + incomeSuffocation) * doctrine.economyWeight +
        extractionBonus +
        drainBonus,
    );
  }

  private computeCascadeBonus(
    profile: BotProfile,
    doctrine: ProfileDoctrine,
    context: BotDynamicContext,
  ): number {
    const activeChainPressure = context.activeCascadeChains * 3.2;
    const brokenChainRecovery = context.brokenCascadeChains * -1.5;
    const breachAffinity = profile.preferredCategory === 'BREACH' ? context.activeCascadeChains * 1.2 : 0;
    const lockAffinity = profile.preferredCategory === 'LOCK' ? context.visibleThreatCount * 0.6 : 0;

    return round3(
      Math.max(0, activeChainPressure + breachAffinity + lockAffinity + brokenChainRecovery) * doctrine.cascadeWeight,
    );
  }

  private computeTimingBonus(
    profile: BotProfile,
    doctrine: ProfileDoctrine,
    context: BotDynamicContext,
    runtime: BotRuntimeState,
  ): number {
    const nearPhaseBoundary = context.phaseBoundaryWindowsRemaining > 0 && context.phaseBoundaryWindowsRemaining <= 2 ? 6 : 0;
    const anticipationPulse = context.anticipationScore * 10;
    const threatDensity = context.visibleThreatCount * 0.75;
    const cooldownRelief = runtime.lastAttackTick === null ? doctrine.reengageBonus : 0;
    const extractionPenalty =
      contextMode(context) === 'pvp' &&
      profile.preferredCategory === 'EXTRACTION' &&
      context.extractionCooldownTicks > 0
        ? -6
        : 0;

    return round3(
      (nearPhaseBoundary + anticipationPulse + threatDensity + cooldownRelief + extractionPenalty) * doctrine.timingWeight,
    );
  }

  private computeMomentumBonus(
    profile: BotProfile,
    doctrine: ProfileDoctrine,
    context: BotDynamicContext,
    momentum: BotMomentumDirection,
    runtime: BotRuntimeState,
  ): number {
    const priorAttackBias = runtime.attacksLanded > runtime.attacksBlocked ? 5 : 0;
    const blockedPenalty = runtime.attacksBlocked > runtime.attacksLanded ? -4 : 0;
    const rivalryMomentum = context.rivalryHeatCarry * 0.04;
    const stateBias = runtime.state === 'TARGETING' ? 2.5 : runtime.state === 'ATTACKING' ? 4 : 0;

    const directionBias =
      momentum === 'SPIKING'
        ? 8
        : momentum === 'RISING'
          ? 4
          : momentum === 'COOLING'
            ? -5
            : 0;

    const categoryBias = profile.categoryBias?.[profile.preferredCategory] ?? 0;

    return round3(
      (priorAttackBias + blockedPenalty + rivalryMomentum + stateBias + directionBias + categoryBias) * doctrine.momentumWeight,
    );
  }

  private computeProfileBias(
    profile: BotProfile,
    doctrine: ProfileDoctrine,
    context: BotDynamicContext,
    runtime: BotRuntimeState,
  ): number {
    const intimidation = context.spectatorPressure * 12 + doctrine.intimidationBias;
    const closeout =
      this.isCloseoutContext(context)
        ? doctrine.closeoutBias + (profile.preferredCategory === 'BREACH' ? 5 : 0)
        : 0;
    const trustPunish =
      contextMode(context) === 'coop'
        ? context.trustInstability * 14 + context.allianceExposure * 10 + doctrine.trustPunishBias
        : 0;
    const ghostPressure =
      contextMode(context) === 'ghost'
        ? Math.min(12, context.ghostMarkerCount * 1.6 + Math.max(0, -context.legendGap) * 0.01) + doctrine.ghostPressureBias
        : 0;
    const counterIntelDampener = context.counterIntelTier > 0 ? -Math.min(6, context.counterIntelTier * 1.2) : 0;
    const retreatPenalty = runtime.state === 'RETREATING' ? -4 : 0;
    const warningEscalation = context.telemetryWarnings.length > 0 ? Math.min(5, context.telemetryWarnings.length) : 0;

    return round3(
      intimidation + closeout + trustPunish + ghostPressure + counterIntelDampener + retreatPenalty + warningEscalation,
    );
  }

  private computeSuppression(
    profile: BotProfile,
    doctrine: ProfileDoctrine,
    context: BotDynamicContext,
    runtime: BotRuntimeState,
    cooldownRemaining: number,
  ): number {
    const cooldownSuppression = cooldownRemaining > 0
      ? doctrine.cooldownThreatSuppression * safeRatio(cooldownRemaining, Math.max(profile.cooldownTicks, 1), 1)
      : 0;

    const pendingAttackSuppression = Math.min(18, context.pendingAttackCount * 1.5 + context.pendingPressureTax * 0.25);
    const budgetSuppression =
      context.battleBudgetCap > 0
        ? (context.battleBudget / context.battleBudgetCap) * doctrine.budgetSensitivity * 100
        : 0;
    const blockedMemorySuppression = runtime.attacksBlocked * 0.8;
    const recoverySuppression = context.brokenCascadeChains > 0 ? Math.min(8, context.brokenCascadeChains * 1.5) : 0;

    return round3(
      cooldownSuppression + pendingAttackSuppression + budgetSuppression + blockedMemorySuppression + recoverySuppression,
    );
  }

  // ── Classification / intent / window / retreat ──────────────────────────

  private classifyThreatBand(compositeThreat: number): BotThreatBand {
    if (compositeThreat >= BOT_THREAT_THRESHOLD_BY_BAND.TERMINAL) {
      return 'TERMINAL';
    }
    if (compositeThreat >= BOT_THREAT_THRESHOLD_BY_BAND.CRITICAL) {
      return 'CRITICAL';
    }
    if (compositeThreat >= BOT_THREAT_THRESHOLD_BY_BAND.HOT) {
      return 'HOT';
    }
    if (compositeThreat >= BOT_THREAT_THRESHOLD_BY_BAND.WARM) {
      return 'WARM';
    }
    if (compositeThreat >= BOT_THREAT_THRESHOLD_BY_BAND.LOW) {
      return 'LOW';
    }
    return 'DORMANT';
  }

  private determineIntent(
    profile: BotProfile,
    context: BotDynamicContext,
    runtime: BotRuntimeState,
    compositeThreat: number,
    band: BotThreatBand,
    cooldownRemaining: number,
  ): BotIntentCode {
    if (runtime.neutralized) {
      return 'RESET';
    }
    if (cooldownRemaining > 0 && compositeThreat >= profile.activationThreshold) {
      return 'PIN';
    }
    if (band === 'DORMANT') {
      return runtime.state === 'RETREATING' ? 'RETREAT' : 'RESET';
    }

    switch (profile.preferredCategory) {
      case 'EXTRACTION':
        return band === 'CRITICAL' || band === 'TERMINAL' ? 'EXTRACT' : 'HARASS';
      case 'LOCK':
        return band === 'HOT' || band === 'CRITICAL' || band === 'TERMINAL' ? 'LOCK' : 'PIN';
      case 'DRAIN':
        return band === 'HOT' || band === 'CRITICAL' || band === 'TERMINAL' ? 'DRAIN' : 'PROBE';
      case 'HEAT':
        return contextMode(context) === 'coop' ? 'HEAT_SPIKE' : 'HARASS';
      case 'BREACH':
        return this.isCloseoutContext(context) ? 'CLOSE' : 'BREACH_SETUP';
      case 'DEBT':
      default:
        return band === 'WARM' ? 'PROBE' : band === 'HOT' ? 'HARASS' : 'PIN';
    }
  }

  private determineAttackWindow(
    profile: BotProfile,
    context: BotDynamicContext,
    runtime: BotRuntimeState,
    compositeThreat: number,
    cooldownRemaining: number,
  ): BotAttackWindowState {
    if (runtime.neutralized) {
      return 'CLOSED';
    }
    if (cooldownRemaining > 0) {
      return compositeThreat >= profile.activationThreshold ? 'PRESSURE_ONLY' : 'CLOSED';
    }
    if (contextMode(context) === 'pvp' && profile.preferredCategory === 'EXTRACTION' && context.extractionCooldownTicks > 0) {
      return 'PRESSURE_ONLY';
    }
    if (contextMode(context) === 'ghost' && profile.preferredCategory === 'BREACH' && context.ghostMarkerCount === 0) {
      return 'SOFT_OPEN';
    }
    if (this.isCloseoutContext(context) && compositeThreat >= profile.activationThreshold + profile.watchWindow + profile.targetWindow) {
      return 'FORCED';
    }
    if (compositeThreat >= profile.activationThreshold + profile.watchWindow + profile.targetWindow) {
      return 'OPEN';
    }
    if (compositeThreat >= profile.activationThreshold + profile.watchWindow) {
      return 'SOFT_OPEN';
    }
    if (compositeThreat >= profile.activationThreshold) {
      return 'PRESSURE_ONLY';
    }
    return 'CLOSED';
  }

  private determineRetreatDecision(
    profile: BotProfile,
    doctrine: ProfileDoctrine,
    runtime: BotRuntimeState,
    compositeThreat: number,
    cooldownRemaining: number,
  ): BotRetreatDecision {
    if (runtime.neutralized) {
      return 'NEUTRALIZED_LOCK';
    }
    if (cooldownRemaining > 0) {
      return 'COOLDOWN_LOCK';
    }
    if (compositeThreat <= doctrine.retreatFloor) {
      return runtime.state === 'ATTACKING' || runtime.state === 'TARGETING'
        ? 'HARD_RETREAT'
        : 'SOFT_RETREAT';
    }
    if (compositeThreat < profile.activationThreshold) {
      return runtime.state === 'WATCHING' ? 'SOFT_RETREAT' : 'HOLD';
    }
    return 'HOLD';
  }

  // ── State evolution ──────────────────────────────────────────────────────

  private determineState(
    runtime: BotRuntimeState,
    profile: BotProfile,
    computation: ThreatComputation,
  ): BotRuntimeState['state'] {
    if (runtime.neutralized) {
      return 'NEUTRALIZED';
    }

    const compositeThreat = computation.breakdown.finalCompositeThreat;
    const cooldownRemaining = computation.cooldownRemaining;
    const attackWindow = computation.attackWindow;
    const retreatDecision = computation.retreatDecision;

    if (retreatDecision === 'NEUTRALIZED_LOCK') {
      return 'NEUTRALIZED';
    }

    if (retreatDecision === 'HARD_RETREAT') {
      return 'RETREATING';
    }

    if (compositeThreat < profile.activationThreshold) {
      if (runtime.state === 'ATTACKING' || runtime.state === 'TARGETING' || runtime.state === 'WATCHING') {
        return retreatDecision === 'SOFT_RETREAT' ? 'RETREATING' : 'DORMANT';
      }
      return 'DORMANT';
    }

    if (compositeThreat < profile.activationThreshold + profile.watchWindow) {
      return runtime.state === 'RETREATING' && compositeThreat >= profile.activationThreshold
        ? 'WATCHING'
        : 'WATCHING';
    }

    if (cooldownRemaining > 0 || attackWindow === 'PRESSURE_ONLY') {
      return 'TARGETING';
    }

    if (compositeThreat < profile.activationThreshold + profile.watchWindow + profile.targetWindow) {
      return 'TARGETING';
    }

    if (attackWindow === 'FORCED' || attackWindow === 'OPEN') {
      return 'ATTACKING';
    }

    return 'TARGETING';
  }

  private evolveRuntime(
    runtime: BotRuntimeState,
    nextState: BotRuntimeState['state'],
    compositeThreat: number,
  ): BotRuntimeState {
    return {
      ...runtime,
      state: nextState,
      heat: compositeThreat,
      lastAttackTick: runtime.lastAttackTick,
    };
  }

  // ── Diagnostics / tags ───────────────────────────────────────────────────

  private buildDiagnostics(computation: ThreatComputation): BotThreatDiagnostics {
    return {
      band: computation.band,
      intent: computation.intent,
      momentum: computation.momentum,
      attackWindow: computation.attackWindow,
      retreatDecision: computation.retreatDecision,
      cooldownRemaining: computation.cooldownRemaining,
      context: computation.context,
      breakdown: computation.breakdown,
      narrativeTags: computation.narrativeTags,
      doctrinalNotes: computation.doctrinalNotes,
    };
  }

  private buildNarrativeTags(
    profile: BotProfile,
    context: BotDynamicContext,
    runtime: BotRuntimeState,
    breakdown: BotThreatBreakdown,
    band: BotThreatBand,
    intent: BotIntentCode,
    attackWindow: BotAttackWindowState,
    momentum: BotMomentumDirection,
    cooldownRemaining: number,
  ): readonly string[] {
    const tags: string[] = [
      `bot:${runtime.botId}`,
      `state:${runtime.state}`,
      `band:${band}`,
      `intent:${intent}`,
      `window:${attackWindow}`,
      `momentum:${momentum}`,
      `category:${profile.preferredCategory}`,
      `layer:${profile.preferredLayer}`,
      `mode:${contextMode(context)}`,
      `threat:${String(Math.round(breakdown.finalCompositeThreat))}`,
      `pressure:${context.pressureScore.toFixed(2)}`,
      `heat:${String(Math.round(context.baseHeat))}`,
      `rivalry:${String(Math.round(context.rivalryHeatCarry))}`,
    ];

    if (context.weakestLayerId) {
      tags.push(`weakest-layer:${context.weakestLayerId}`);
      tags.push(`weakest-ratio:${context.weakestLayerRatio.toFixed(2)}`);
    }

    if (context.activeCascadeChains > 0) {
      tags.push(`cascades:${String(context.activeCascadeChains)}`);
    }

    if (context.visibleThreatCount > 0) {
      tags.push(`visible-threats:${String(context.visibleThreatCount)}`);
    }

    if (contextMode(context) === 'coop') {
      tags.push(`trust:${context.trustInstability.toFixed(2)}`);
      tags.push(`alliance:${context.allianceExposure.toFixed(2)}`);
    }

    if (contextMode(context) === 'ghost') {
      tags.push(`ghost-markers:${String(context.ghostMarkerCount)}`);
      tags.push(`legend-gap:${round2(context.legendGap).toFixed(2)}`);
    }

    if (cooldownRemaining > 0) {
      tags.push(`cooldown:${String(cooldownRemaining)}`);
    }

    if (this.isCloseoutContext(context)) {
      tags.push('closeout-context');
    }

    if (context.telemetryWarnings.length > 0) {
      for (const warning of context.telemetryWarnings) {
        tags.push(`warning:${warning}`);
      }
    }

    return uniqueStrings(tags);
  }

  private buildDoctrinalNotes(profile: BotProfile): readonly string[] {
    return uniqueStrings([
      profile.label,
      profile.archetype,
      ...profile.notes,
      ...(profile.preferredPressureBand ? [`pref-pressure:${profile.preferredPressureBand}`] : []),
    ]);
  }

  // ── Context semantics ────────────────────────────────────────────────────

  private isCloseoutContext(context: BotDynamicContext): boolean {
    const lowShield = context.shieldOverallIntegrityRatio <= 0.26 || context.weakestLayerRatio <= 0.18;
    const financialCollapse = context.cash < 0 && context.incomePerTick <= context.expensesPerTick;
    const severePressure = context.pressureScore >= 0.78;
    return lowShield || financialCollapse || severePressure;
  }
}

function contextMode(context: BotDynamicContext): 'solo' | 'pvp' | 'coop' | 'ghost' {
  return context.mode;
}

function contextTick(
  context: BotDynamicContext,
  runtime: BotRuntimeState,
  fallback: number,
): number {
  return context.tick ?? runtime.lastAttackTick ?? fallback;
}
