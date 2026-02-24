/**
 * PZO UPGRADE — src/engine/resolver.ts
 * Central deterministic resolution pipeline.
 * 
 * Pipeline order:
 * 1. Base card effects
 * 2. Zone modifiers
 * 3. Run state modifiers (regime, bias, concentration, reputation)
 * 4. Terms modifiers
 * 5. Mitigation matching
 * 6. Apply state changes
 * 7. Emit explanation + telemetry
 * 
 * All randomness is seeded via (tick + cardId hash) — fully deterministic.
 */

import type {
  CardExtension,
  CardEffect,
  ZoneId,
  ZoneConfig,
  BalanceSheet,
  MitigationRecord,
  MindState,
  ReputationState,
  CapabilityState,
  DifficultyProfile,
  ResolutionResult,
  PortfolioRecord,
  ObligationRecord,
  PendingMaturity,
  CapabilityStat,
  BiasState,
  DamageType,
} from '../types/game';

import {
  ZONE_CONFIGS,
  BIAS_CARD_MODIFIERS,
  computeConcentrationScore,
  liquidityRatio,
} from '../types/game';

// Re-export existing DeckType from CardHand for use in resolver
export type { DeckType } from '../components/CardHand';

// ─── Seeded RNG (same mulberry32 as App.tsx) ──────────────────────────────────

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Context passed into resolver ────────────────────────────────────────────

export interface ResolverContext {
  cardId: string;
  effects: CardEffect[];
  cardExtension: CardExtension | null;
  zone: ZoneId | null;
  tick: number;
  cash: number;
  income: number;
  expenses: number;
  balanceSheet: BalanceSheet;
  shields: number;
  mitigations: MitigationRecord[];
  mindState: MindState;
  reputation: ReputationState;
  capabilities: CapabilityState;
  portfolio: PortfolioRecord[];
  difficultyProfile: DifficultyProfile;
  regime: string;
  winStreak: number;
}

// ─── Core Resolver ────────────────────────────────────────────────────────────

export function resolveCardEffects(ctx: ResolverContext): ResolutionResult {
  const rng = mulberry32(hashString(ctx.cardId) ^ ctx.tick);

  const result: ResolutionResult = {
    cashDelta: 0,
    cashflowDelta: 0,
    netWorthDelta: 0,
    freezeTicksDelta: 0,
    shieldConsumed: false,
    biasStateSet: null,
    biasStateCleared: null,
    capabilityGained: null,
    obligationAdded: null,
    maturityQueued: null,
    reputationDelta: 0,
    explanation: '',
    zoneApplied: ctx.zone,
    zoneModifierLabel: null,
  };

  const explanationParts: string[] = [];
  const zoneConfig: ZoneConfig | null = ctx.zone ? ZONE_CONFIGS[ctx.zone] : null;

  // ── Step 1: Compute active bias modifier ────────────────────────────────────
  let globalCashflowMult = 1.0;
  let globalRiskMult = 1.0;

  const activeBiases = Object.entries(ctx.mindState.activeBiases) as [BiasState, { expiresAtTick: number; intensity: number }][];
  for (const [bias, state] of activeBiases) {
    if (state.expiresAtTick > ctx.tick) {
      const mod = BIAS_CARD_MODIFIERS[bias];
      globalCashflowMult *= (1 + (mod.cashflowMult - 1) * state.intensity);
      globalRiskMult *= (1 + (mod.riskMult - 1) * state.intensity);
      explanationParts.push(mod.description);
    }
  }

  // ── Step 2: Hubris modifier ─────────────────────────────────────────────────
  if (ctx.mindState.hubrisMeter > 70) {
    const hubrisRisk = 1 + (ctx.mindState.hubrisMeter - 70) / 100;
    globalRiskMult *= hubrisRisk;
    explanationParts.push(`Hubris ${ctx.mindState.hubrisMeter.toFixed(0)}/100: +${((hubrisRisk - 1) * 100).toFixed(0)}% risk amplification`);
  }

  // ── Step 3: Concentration risk modifier ────────────────────────────────────
  const hhi = computeConcentrationScore(ctx.portfolio);
  if (hhi > 0.6) {
    const concRisk = 1 + (hhi - 0.6) * 1.5;
    globalRiskMult *= concRisk;
    explanationParts.push(`Portfolio concentration ${(hhi * 100).toFixed(0)}% HHI: amplified tail risk`);
  }

  // ── Step 4: Liquidity stress modifier ──────────────────────────────────────
  const liqRatio = liquidityRatio(ctx.balanceSheet);
  let liquidityDamageAmp = 1.0;
  if (liqRatio < ctx.difficultyProfile.liquidityStressThreshold) {
    liquidityDamageAmp = 1 + (ctx.difficultyProfile.liquidityStressThreshold - liqRatio) * 2.5;
    explanationParts.push(`Liquidity at ${(liqRatio * 100).toFixed(0)}%: FUBAR damage ×${liquidityDamageAmp.toFixed(2)}`);
  }

  // ── Step 5: Capability modifiers ────────────────────────────────────────────
  const capNegotiationBonus = 1 + ctx.capabilities.negotiation * 0.02;
  const capComplianceProtect = 1 - ctx.capabilities.compliance * 0.05;
  const capUnderwriteProtect = 1 - ctx.capabilities.underwriting * 0.04;

  // ── Step 6: Process each effect ─────────────────────────────────────────────
  for (const effect of ctx.effects) {
    switch (effect.type) {

      case 'ADD_CASHFLOW': {
        const baseAmount = effect.amount ?? 0;
        let modded = baseAmount * globalCashflowMult * capNegotiationBonus;

        // Zone modifier on cashflow
        if (zoneConfig) {
          modded *= zoneConfig.cashflowMult;
          if (zoneConfig.cashflowMult !== 1.0) {
            explanationParts.push(`${zoneConfig.label} zone: cashflow ×${zoneConfig.cashflowMult}`);
          }
        }

        result.cashflowDelta += Math.round(modded);
        explanationParts.push(effect.label ?? `+${fmtMoney(Math.round(modded))}/mo cashflow`);
        break;
      }

      case 'APPLY_DAMAGE': {
        const baseDamage = Math.abs(effect.amount ?? 0);
        const damageType: DamageType = effect.damageType ?? 'macro';

        // Check mitigations
        let mitigatedAmount = 0;
        let mitigationLabel = '';
        for (const mit of ctx.mitigations) {
          if (mit.coversDamageTypes.includes(damageType) && mit.remainingAbsorption > 0) {
            const absorbed = Math.min(mit.remainingAbsorption, baseDamage);
            mitigatedAmount += absorbed;
            mitigationLabel = `${mit.label} absorbed ${fmtMoney(absorbed)}`;
            break; // first matching mitigation absorbs
          }
        }

        // Capability-based reduction
        let capReduction = 1.0;
        if (damageType === 'legal' || damageType === 'fraud') capReduction = capComplianceProtect;
        if (damageType === 'macro' || damageType === 'market') capReduction = capUnderwriteProtect;

        let finalDamage = (baseDamage - mitigatedAmount)
          * globalRiskMult
          * liquidityDamageAmp
          * ctx.difficultyProfile.fateSeverityMult
          * capReduction;

        finalDamage = Math.max(0, Math.round(finalDamage));

        // Shield check
        if (finalDamage > 0 && ctx.shields > 0) {
          result.shieldConsumed = true;
          finalDamage = Math.round(finalDamage * 0.25); // shield reduces but doesn't negate
          explanationParts.push('Shield activated: 75% damage reduction');
        }

        result.cashDelta -= finalDamage;
        result.netWorthDelta -= Math.round(finalDamage * 0.5);

        const parts = [
          effect.label ?? `${damageType} FUBAR: −${fmtMoney(finalDamage)}`,
        ];
        if (mitigationLabel) parts.push(mitigationLabel);
        explanationParts.push(...parts);
        break;
      }

      case 'ADD_ASSET_VALUE': {
        let baseValue = effect.amount ?? 0;
        if (zoneConfig) baseValue += zoneConfig.valueBonus;
        result.netWorthDelta += Math.round(baseValue);
        explanationParts.push(effect.label ?? `+${fmtMoney(Math.round(baseValue))} asset value`);
        break;
      }

      case 'ADD_OBLIGATION': {
        const newObligation: ObligationRecord = {
          id: `obl-${ctx.cardId}-${ctx.tick}`,
          label: effect.label ?? 'Recurring Obligation',
          amountPerMonth: effect.amount ?? 0,
          ticksRemaining: effect.durationTicks ?? null,
          category: 'operational',
          sourceCardId: ctx.cardId,
        };
        result.obligationAdded = newObligation;
        result.cashflowDelta -= (effect.amount ?? 0); // immediately reduces net cashflow
        explanationParts.push(`New obligation: −${fmtMoney(effect.amount ?? 0)}/mo — ${effect.label}`);
        break;
      }

      case 'ADD_MITIGATION': {
        // Handled by caller — just log
        explanationParts.push(effect.label ?? `Protection added: ${effect.mitigationType}`);
        break;
      }

      case 'SET_BIAS_STATE': {
        result.biasStateSet = effect.biasState ?? null;
        if (effect.biasState) {
          const mod = BIAS_CARD_MODIFIERS[effect.biasState];
          explanationParts.push(`Bias triggered: ${mod.label} — ${mod.description}`);
        }
        break;
      }

      case 'CLEAR_BIAS_STATE': {
        result.biasStateCleared = effect.biasState ?? null;
        explanationParts.push(`Discipline play: ${effect.biasState} bias cleared`);
        result.reputationDelta += 5;
        break;
      }

      case 'ADD_CAPABILITY': {
        const stat = effect.capabilityStat as CapabilityStat;
        const amount = effect.amount ?? 1;
        result.capabilityGained = { stat, amount };
        explanationParts.push(`+${amount} ${stat} capability — future plays improved`);
        break;
      }

      case 'FREEZE_TICKS': {
        result.freezeTicksDelta += effect.amount ?? 0;
        explanationParts.push(effect.label ?? `Frozen for ${effect.amount} ticks`);
        break;
      }

      case 'QUEUE_MATURE_EFFECT': {
        const maturity: PendingMaturity = {
          id: `mat-${ctx.cardId}-${ctx.tick}`,
          sourceCardId: ctx.cardId,
          label: effect.label ?? 'Pending Maturity',
          matureAtTick: effect.matureAtTick ?? (ctx.tick + (effect.durationTicks ?? 30)),
          effects: effect.matureEffects ?? [],
        };
        result.maturityQueued = maturity;
        explanationParts.push(`Queued: ${maturity.label} matures at tick ${maturity.matureAtTick}`);
        break;
      }

      case 'MODIFY_REPUTATION': {
        result.reputationDelta += effect.amount ?? 0;
        break;
      }

      case 'DRAW_CARD': {
        explanationParts.push(effect.label ?? 'Bonus draw triggered');
        break;
      }

      case 'TRIGGER_MARKET_REFRESH': {
        explanationParts.push('Market row refreshed');
        break;
      }

      default:
        break;
    }
  }

  // ── Step 7: Zone bonus XP / reputation ─────────────────────────────────────
  if (zoneConfig) {
    result.reputationDelta += Math.round(zoneConfig.xpBonus * 0.1);
    result.zoneModifierLabel = zoneConfig.tooltip;
  }

  // ── Step 8: Reputation tier bonus ──────────────────────────────────────────
  if (ctx.reputation.tier === 'Respected' || ctx.reputation.tier === 'Sovereign') {
    result.cashflowDelta = Math.round(result.cashflowDelta * 1.05);
    explanationParts.push(`${ctx.reputation.tier} tier: +5% cashflow premium`);
  }

  // ── Step 9: Compile explanation ─────────────────────────────────────────────
  result.explanation = explanationParts.length > 0
    ? explanationParts.slice(0, 4).join(' | ')
    : 'Card played.';

  return result;
}

// ─── Maintenance Event Resolver ───────────────────────────────────────────────

export interface MaintenanceEvent {
  cardId: string;
  label: string;
  cost: number;
  damageType: DamageType;
  explanation: string;
}

export function checkMaintenanceEvents(
  portfolio: PortfolioRecord[],
  tick: number,
  capabilities: CapabilityState,
  difficultyProfile: DifficultyProfile,
): MaintenanceEvent[] {
  const events: MaintenanceEvent[] = [];

  for (const asset of portfolio) {
    const rng = mulberry32(hashString(asset.cardId) ^ tick);
    // Only check once per month (every 12 ticks)
    if (tick % 12 !== 0) continue;

    // Base maintenance probability (varies by asset class)
    const baseProb = getMaintenanceProbByClass(asset.assetClass);
    const adjustedProb = baseProb
      * difficultyProfile.maintenanceProbMult
      * (1 - capabilities.systems * 0.04);

    if (rng() < adjustedProb) {
      const maxCost = getMaintenanceMaxCostByClass(asset.assetClass);
      const cost = Math.round(maxCost * (0.3 + rng() * 0.7) * difficultyProfile.hiddenCostMult);
      const damageType = getDamageTypeByClass(asset.assetClass);

      events.push({
        cardId: asset.cardId,
        label: `${asset.cardName}: maintenance`,
        cost,
        damageType,
        explanation: `${asset.assetClass} asset maintenance — −${fmtMoney(cost)}. ${capabilities.bookkeeping >= 5 ? 'Early detection reduced cost.' : 'Upgrade bookkeeping to reduce exposure.'}`,
      });
    }
  }

  return events;
}

function getMaintenanceProbByClass(assetClass: string): number {
  const map: Record<string, number> = {
    real_estate: 0.25,
    digital: 0.15,
    equities: 0.05,
    skills: 0.02,
    network: 0.08,
    speculative: 0.30,
    cash: 0.0,
  };
  return map[assetClass] ?? 0.10;
}

function getMaintenanceMaxCostByClass(assetClass: string): number {
  const map: Record<string, number> = {
    real_estate: 8000,
    digital: 3000,
    equities: 1500,
    skills: 500,
    network: 2000,
    speculative: 12000,
    cash: 0,
  };
  return map[assetClass] ?? 2000;
}

function getDamageTypeByClass(assetClass: string): DamageType {
  const map: Record<string, DamageType> = {
    real_estate: 'ops',
    digital: 'ops',
    equities: 'market',
    skills: 'health',
    network: 'social',
    speculative: 'market',
    cash: 'macro',
  };
  return map[assetClass] ?? 'ops';
}

// ─── Obligation Monthly Tick ──────────────────────────────────────────────────

export interface ObligationTickResult {
  totalDue: number;
  coverageRatio: number;
  isUnderwater: boolean;
  expiredObligationIds: string[];
  explanation: string;
}

export function tickObligations(
  obligations: ObligationRecord[],
  income: number,
): ObligationTickResult {
  const totalDue = obligations.reduce((sum, o) => sum + o.amountPerMonth, 0);
  const coverageRatio = income / Math.max(1, totalDue);
  const expiredIds = obligations
    .filter(o => o.ticksRemaining !== null && o.ticksRemaining <= 1)
    .map(o => o.id);

  return {
    totalDue,
    coverageRatio,
    isUnderwater: coverageRatio < 1.0,
    expiredObligationIds: expiredIds,
    explanation: coverageRatio < 1.0
      ? `Obligations exceed income: ${fmtMoney(totalDue)}/mo vs ${fmtMoney(income)}/mo income. You are bleeding.`
      : `Coverage ratio ${coverageRatio.toFixed(2)}× — ${coverageRatio >= 2 ? 'strong' : coverageRatio >= 1.3 ? 'comfortable' : 'thin'}.`,
  };
}

// ─── Hubris Meter Update ─────────────────────────────────────────────────────

export function updateHubrisMeter(
  current: number,
  winStreak: number,
  cashflowDelta: number,
  leverageUsed: boolean,
  reservesNeglected: boolean,
): number {
  let delta = 0;
  if (winStreak > 3) delta += (winStreak - 3) * 3;
  if (cashflowDelta > 500) delta += 2;
  if (leverageUsed) delta += 5;
  if (reservesNeglected) delta += 8;

  // Natural decay
  delta -= 1;

  return Math.max(0, Math.min(100, current + delta));
}

// ─── Opportunity Expiry ───────────────────────────────────────────────────────

export interface HandExpiryUpdate {
  cardId: string;
  newRoiPct: number | null;
  isExpired: boolean;
  badge: 'HOT' | 'COOLING' | 'EXPIRING' | 'EXPIRED';
}

export function processHandExpiry(
  cards: Array<{ id: string; roiPct: number | null; expiresAtTick: number | null; decaySchedule: { tick: number; roiMultiplier: number }[] | null }>,
  tick: number,
  decaySpeed: number,
): HandExpiryUpdate[] {
  return cards.map(card => {
    if (!card.expiresAtTick) {
      return { cardId: card.id, newRoiPct: card.roiPct, isExpired: false, badge: 'HOT' };
    }

    const remaining = card.expiresAtTick - tick;
    let badge: HandExpiryUpdate['badge'] = 'HOT';
    if (remaining <= 0) badge = 'EXPIRED';
    else if (remaining <= 15 * decaySpeed) badge = 'EXPIRING';
    else if (remaining <= 40 * decaySpeed) badge = 'COOLING';

    let newRoiPct = card.roiPct;
    if (card.decaySchedule && card.roiPct !== null) {
      const decayStep = card.decaySchedule.find(ds => tick >= ds.tick);
      if (decayStep) {
        newRoiPct = Math.round(card.roiPct * decayStep.roiMultiplier);
      }
    }

    return {
      cardId: card.id,
      newRoiPct,
      isExpired: remaining <= 0,
      badge,
    };
  });
}

// ─── Distress Recovery Actions ────────────────────────────────────────────────

export type RecoveryActionId = 'RESTRUCTURE' | 'SELL_ASSET' | 'EMERGENCY_PARTNER' | 'SIDE_HUSTLE_SPRINT' | 'AUSTERITY';

export interface RecoveryAction {
  id: RecoveryActionId;
  label: string;
  description: string;
  tradeoff: string;
  cashDelta: number;
  cashflowDelta: number;
  netWorthDelta: number;
  reputationDelta: number;
  explanation: string;
}

export function getRecoveryActions(
  cash: number,
  portfolio: PortfolioRecord[],
  obligations: ObligationRecord[],
): RecoveryAction[] {
  const actions: RecoveryAction[] = [];

  // Always available in distress
  actions.push({
    id: 'AUSTERITY',
    label: '🔒 Austerity Mode',
    description: 'Cut all non-essential expenses. Survive.',
    tradeoff: 'Freeze capability gains for 2 months.',
    cashDelta: 0,
    cashflowDelta: Math.round(obligations.reduce((s, o) => s + o.amountPerMonth * 0.25, 0)),
    netWorthDelta: 0,
    reputationDelta: -10,
    explanation: 'Austerity reduced obligations 25%. No growth, but you live.',
  });

  if (portfolio.length > 0) {
    const worstAsset = [...portfolio].sort((a, b) => a.monthlyIncome - b.monthlyIncome)[0];
    actions.push({
      id: 'SELL_ASSET',
      label: `💸 Sell ${worstAsset.cardName}`,
      description: 'Liquidate lowest-performing asset at 70% value.',
      tradeoff: 'Permanent cashflow loss + reputation hit.',
      cashDelta: Math.round(worstAsset.value * 0.7),
      cashflowDelta: -worstAsset.monthlyIncome,
      netWorthDelta: -worstAsset.value,
      reputationDelta: -20,
      explanation: `Sold ${worstAsset.cardName} at discount. Cash injected. Cashflow reduced permanently.`,
    });
  }

  actions.push({
    id: 'SIDE_HUSTLE_SPRINT',
    label: '⚡ Side Hustle Sprint',
    description: 'Burst income for 3 months. High effort.',
    tradeoff: 'No new cards for 2 draw cycles.',
    cashDelta: 0,
    cashflowDelta: 800,
    netWorthDelta: 0,
    reputationDelta: 5,
    explanation: 'Side hustle +$800/mo for 36 ticks. Card draws paused.',
  });

  if (obligations.length > 0) {
    const highestObligation = [...obligations].sort((a, b) => b.amountPerMonth - a.amountPerMonth)[0];
    actions.push({
      id: 'RESTRUCTURE',
      label: `🔄 Restructure ${highestObligation.label}`,
      description: 'Renegotiate terms. Lower monthly, extended duration.',
      tradeoff: 'Duration extended. Total paid increases.',
      cashDelta: 0,
      cashflowDelta: Math.round(highestObligation.amountPerMonth * 0.35),
      netWorthDelta: -Math.round(highestObligation.amountPerMonth * 2),
      reputationDelta: -5,
      explanation: `Restructured obligation: −${fmtMoney(Math.round(highestObligation.amountPerMonth * 0.35))}/mo relief. Costs more long-term.`,
    });
  }

  return actions;
}

// ─── Reputation Tier Computation ─────────────────────────────────────────────

export function computeReputationTier(score: number): ReputationState['tier'] {
  if (score >= 800) return 'Sovereign';
  if (score >= 600) return 'Respected';
  if (score >= 350) return 'Established';
  if (score >= 150) return 'Emerging';
  return 'Unknown';
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}
