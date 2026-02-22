/**
 * M09a — Opportunity Value Model + Regret Stamp Generator
 * Source spec: ml/M09a_opportunity_value_regret_model.md
 *
 * Estimates opportunity EV under time pressure.
 * Generates 'regret delta' when player passes and someone else buys.
 * Produces shareable 'you left $X on the table' cards.
 *
 * Deploy to: pzo_ml/src/models/m09a_opportunity_ev_regret_model.ts
 */

import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MacroRegime = 'BULL' | 'NEUTRAL' | 'BEAR' | 'CRASH';
export type CardType = 'BIG_DEAL' | 'SMALL_DEAL' | 'IPA';
export type AssetKind = 'REAL_ESTATE' | 'BUSINESS' | 'IPA';

export interface Card {
  id: number;
  name: string;
  type: CardType;
  assetKind: AssetKind;
  cost: number;
  downPayment: number;
  debt: number;
  cashflowMonthly: number;
  exitMin: number;
  exitMax: number;
  roiPct: number;
}

export interface Portfolio {
  id: number;
  cash: number;
  passiveIncomeMonthly: number;
  monthlyExpenses: number;
  netWorth: number;
  totalDebt: number;
  totalAssetsValue: number;
  assetCount: number;
  hasLiquidRung: boolean;
  concentrationInAssetKind: Partial<Record<AssetKind, number>>; // 0–1 fraction
}

export interface MacroState {
  id: number;
  regime: MacroRegime;
  interestRateMultiplier: number;   // e.g. 1.2 = 20% higher rates
  debtServiceMultiplier: number;
  exitValueMultiplier: number;      // macro affects sell prices
}

export interface RegretCardPayload {
  cardId: number;
  portfolioId: number;
  macroStateId: number;
  tickIndex: number;
  regretDelta: number;
  evScore: number;
  topFactors: string[];
  shareLabel: string;              // "You left $X on the table"
}

export interface M09aEvaluationResult {
  evScore: number;                 // 0–1 normalized opportunity value
  regretDelta: number;             // 0–1 magnitude of passing regret
  regretCardPayload: RegretCardPayload;
  recommendation: 'BUY' | 'PASS' | 'AUCTION' | 'HOLD';
  topFactors: string[];
  auditHash: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RUN_DURATION_TICKS = 720;
const MAX_EV_SCORE = 1.0;
const MAX_NUDGE_STRENGTH = 0.15;

const MACRO_EXIT_MULTIPLIERS: Record<MacroRegime, number> = {
  BULL:    1.25,
  NEUTRAL: 1.00,
  BEAR:    0.80,
  CRASH:   0.55,
};

const MACRO_CASHFLOW_MULTIPLIERS: Record<MacroRegime, number> = {
  BULL:    1.10,
  NEUTRAL: 1.00,
  BEAR:    0.85,
  CRASH:   0.60,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n)}`;
}

// ─── Feature Computation ──────────────────────────────────────────────────────

/**
 * Expected cashflow from this card over remaining run time.
 * Accounts for macro regime, debt service, and time-to-payback.
 */
function calculateExpectedCashflow(
  card: Card,
  portfolio: Portfolio,
  macroState: MacroState,
): number {
  // Player can't afford it → no value
  if (portfolio.cash < card.downPayment) return -1;

  // Adjust cashflow for macro conditions
  const adjustedCashflow = card.cashflowMonthly * MACRO_CASHFLOW_MULTIPLIERS[macroState.regime];
  // Adjusted debt service (macro rate multiplier)
  const adjustedDebtService = card.debt > 0
    ? (card.debt * 0.007) * macroState.debtServiceMultiplier  // ~0.7%/mo base
    : 0;
  const netMonthlyCashflow = adjustedCashflow - adjustedDebtService;

  // Concentration penalty: buying more of a concentrated kind reduces EV
  const concentration = portfolio.concentrationInAssetKind[card.assetKind] ?? 0;
  const concentrationPenalty = concentration > 0.5 ? 0.7 : 1.0;

  return netMonthlyCashflow * concentrationPenalty;
}

/**
 * Time-value multiplier: more valuable earlier in the run.
 * Linear decay from 1.0 at tick 0 to 0.1 at tick 720.
 */
function timeValueMultiplier(tickIndex: number): number {
  return clamp(1 - (tickIndex / RUN_DURATION_TICKS) * 0.9);
}

/**
 * Exit-value contribution: expected gain from selling at exitMin..exitMax.
 * Adjusted by macro exit multiplier.
 */
function calculateExitValueContribution(card: Card, macroState: MacroState): number {
  const midExit = (card.exitMin + card.exitMax) / 2;
  const adjustedExit = midExit * MACRO_EXIT_MULTIPLIERS[macroState.regime];
  const capitalGain = Math.max(0, adjustedExit - card.cost);
  // Normalize: $100K gain on a $500K asset = 0.2 contribution
  return clamp(capitalGain / Math.max(card.cost, 1) * 0.5);
}

/**
 * Leverage multiplier: buying with financing amplifies EV relative to cash committed.
 * Capped to prevent leverage from dominating the score.
 */
function getLeverageMultiplier(portfolio: Portfolio, card: Card): number {
  if (card.downPayment <= 0 || card.cost <= 0) return 1.0;
  const leverageRatio = card.cost / card.downPayment;
  // Cap at 3× to prevent runaway leverage scoring
  return clamp(Math.min(leverageRatio, 3) / 3 * 1.5 + 0.5, 1.0, 1.5);
}

/**
 * Portfolio synergy: does this card diversify or over-concentrate?
 */
function portfolioSynergyScore(card: Card, portfolio: Portfolio): number {
  const concentration = portfolio.concentrationInAssetKind[card.assetKind] ?? 0;
  // High concentration = low synergy (0.3); diversifying = high synergy (1.0)
  return clamp(1 - concentration * 0.7);
}

// ─── Top Factors ─────────────────────────────────────────────────────────────

function buildTopFactors(
  cashflow: number,
  exitContribution: number,
  leverage: number,
  synergy: number,
  timeValue: number,
  canAfford: boolean,
): string[] {
  const factors: Array<[string, number]> = [
    ['cashflow', Math.abs(cashflow) / 5000],
    ['exit_value', exitContribution],
    ['leverage', leverage - 1],
    ['portfolio_fit', synergy],
    ['time_pressure', 1 - timeValue],
  ];
  if (!canAfford) factors.push(['insufficient_cash', 1]);

  return factors
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);
}

// ─── Recommendation ───────────────────────────────────────────────────────────

function buildRecommendation(
  evScore: number,
  canAfford: boolean,
  tickIndex: number,
): 'BUY' | 'PASS' | 'AUCTION' | 'HOLD' {
  if (!canAfford) return 'PASS';
  if (evScore >= 0.70) return tickIndex > 540 ? 'BUY' : 'AUCTION'; // late run: buy now
  if (evScore >= 0.45) return 'HOLD';
  return 'PASS';
}

// ─── Main Model ───────────────────────────────────────────────────────────────

export abstract class MLBase {
  abstract readonly mlEnabled: boolean;
  protected abstract calculateAuditHash(payload: unknown): string;
}

export class M09aOpportunityEvRegretModel extends MLBase {
  public readonly mlEnabled = true;
  private readonly rulesetVersion: string;

  constructor(rulesetVersion = '1.0') {
    super();
    this.rulesetVersion = rulesetVersion;
  }

  public async evaluate({
    card,
    portfolio,
    macroState,
    tickIndex,
  }: {
    card: Card;
    portfolio: Portfolio;
    macroState: MacroState;
    tickIndex: number;
  }): Promise<M09aEvaluationResult> {
    const canAfford = portfolio.cash >= card.downPayment;

    // Feature computation — all bounded
    const expectedCashflow = calculateExpectedCashflow(card, portfolio, macroState);
    const exitContribution = calculateExitValueContribution(card, macroState);
    const leverageMultiplier = getLeverageMultiplier(portfolio, card);
    const synergyScore = portfolioSynergyScore(card, portfolio);
    const timeValue = timeValueMultiplier(tickIndex);

    // EV score: time-weighted cashflow × leverage × synergy + exit premium
    let evScore = 0.0;
    if (expectedCashflow > 0 && canAfford) {
      const cashflowComponent = clamp(expectedCashflow / 5000); // normalize against $5K/mo benchmark
      evScore = clamp(
        cashflowComponent * timeValue * leverageMultiplier * synergyScore + exitContribution * 0.3,
      );
    } else if (!canAfford) {
      evScore = 0;
    } else {
      // Negative cashflow — opportunity has negative value
      evScore = 0;
    }

    // Regret delta: how much value the player loses by passing
    // Higher when time is running out + opportunity is genuinely good
    const regretDelta = expectedCashflow > 0 && canAfford
      ? clamp(evScore * (1 + (1 - timeValue) * 0.4))
      : 0.0;

    const topFactors = buildTopFactors(expectedCashflow, exitContribution, leverageMultiplier, synergyScore, timeValue, canAfford);
    const recommendation = buildRecommendation(evScore, canAfford, tickIndex);

    // Regret dollar amount for share card
    const estimatedCashflowValue = Math.max(0, expectedCashflow) * 12; // annualized
    const shareLabel = regretDelta > 0.3
      ? `You left ${formatMoney(estimatedCashflowValue)}/yr on the table`
      : `Passed on ${formatMoney(card.cost)} deal`;

    const regretCardPayload: RegretCardPayload = {
      cardId: card.id,
      portfolioId: portfolio.id,
      macroStateId: macroState.id,
      tickIndex,
      regretDelta: clamp(regretDelta),
      evScore: clamp(evScore),
      topFactors,
      shareLabel,
    };

    const auditHash = this.calculateAuditHash(regretCardPayload);

    return {
      evScore: clamp(evScore),
      regretDelta: clamp(regretDelta),
      regretCardPayload,
      recommendation,
      topFactors,
      auditHash,
    };
  }

  protected calculateAuditHash(payload: unknown): string {
    return sha256(JSON.stringify({
      payload,
      modelId: 'M09a',
      rulesetVersion: this.rulesetVersion,
    })).slice(0, 32);
  }
}
