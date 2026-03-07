/**
 * PZO UPGRADE — src/types/game.ts
 * Extended type system: Sprint 0 foundation enabling all future sprints.
 * Drop-in alongside existing App.tsx types.
 */

// ─── Zone System ──────────────────────────────────────────────────────────────

export type ZoneId = 'BUILD' | 'RESERVE' | 'SCALE' | 'LEARN' | 'FLIP';

export interface ZoneConfig {
  id: ZoneId;
  label: string;
  description: string;
  cashflowMult: number;      // multiplier on cashflowMonthly
  riskMult: number;          // multiplier on FUBAR damage if played here
  valueBonus: number;        // flat net worth bonus
  xpBonus: number;           // season XP on play
  tooltip: string;
}

export const ZONE_CONFIGS: Record<ZoneId, ZoneConfig> = {
  BUILD: {
    id: 'BUILD',
    label: '🏗 Build',
    description: 'Long-term cashflow. Lower risk. Compounding play.',
    cashflowMult: 1.2,
    riskMult: 0.9,
    valueBonus: 0,
    xpBonus: 8,
    tooltip: '+20% cashflow, −10% FUBAR exposure',
  },
  RESERVE: {
    id: 'RESERVE',
    label: '🛡 Reserve',
    description: 'Sacrifice upside for survival. Shields reinforced.',
    cashflowMult: 0.75,
    riskMult: 0.4,
    valueBonus: 0,
    xpBonus: 5,
    tooltip: '−25% cashflow, −60% FUBAR damage',
  },
  SCALE: {
    id: 'SCALE',
    label: '📈 Scale',
    description: 'High upside, high volatility. Risky compounding.',
    cashflowMult: 1.8,
    riskMult: 2.0,
    valueBonus: 5000,
    xpBonus: 15,
    tooltip: '+80% cashflow, ×2 FUBAR exposure',
  },
  LEARN: {
    id: 'LEARN',
    label: '📚 Learn',
    description: 'Invest in capability. Future plays cost less, earn more.',
    cashflowMult: 0.5,
    riskMult: 0.6,
    valueBonus: 0,
    xpBonus: 20,
    tooltip: '−50% cashflow now, +capability stat, −20% future costs',
  },
  FLIP: {
    id: 'FLIP',
    label: '⚡ Flip',
    description: 'Short-term gain, timing-sensitive. Expires fast.',
    cashflowMult: 0.3,
    riskMult: 1.3,
    valueBonus: 12000,
    xpBonus: 10,
    tooltip: 'Immediate value spike, low recurring cashflow',
  },
};

// ─── Card Effect System ───────────────────────────────────────────────────────

export type CardEffectType =
  | 'ADD_CASHFLOW'
  | 'ADD_OBLIGATION'
  | 'ADD_ASSET_VALUE'
  | 'APPLY_DAMAGE'
  | 'ADD_MITIGATION'
  | 'SET_BIAS_STATE'
  | 'CLEAR_BIAS_STATE'
  | 'MODIFY_REPUTATION'
  | 'QUEUE_MATURE_EFFECT'
  | 'DRAW_CARD'
  | 'FREEZE_TICKS'
  | 'ADD_CAPABILITY'
  | 'APPLY_DISTRESS_RECOVERY'
  | 'TRIGGER_MARKET_REFRESH';

export type DamageType = 'macro' | 'legal' | 'fraud' | 'market' | 'ops' | 'health' | 'social';
export type MitigationType = 'emergency_fund' | 'insurance' | 'hedge' | 'compliance' | 'social_capital';
export type BiasState = 'FOMO' | 'SUNK_COST' | 'EGO_REVENGE' | 'PANIC' | 'OVERCONFIDENCE' | 'DECISION_FATIGUE' | 'SOCIAL_PROOF_TRAP';
export type AssetClass = 'real_estate' | 'digital' | 'equities' | 'skills' | 'network' | 'speculative' | 'cash';
export type CounterpartyQuality = 'reliable' | 'average' | 'fragile' | 'predatory' | 'fraudulent';
export type CapabilityStat = 'underwriting' | 'negotiation' | 'bookkeeping' | 'marketing' | 'compliance' | 'analytics' | 'systems';

export interface CardEffect {
  type: CardEffectType;
  // Params per type
  amount?: number;           // cashflow delta, damage, value, freeze ticks
  damageType?: DamageType;
  mitigationType?: MitigationType;
  biasState?: BiasState;
  capabilityStat?: CapabilityStat;
  durationTicks?: number;    // for obligations, bias states
  matureEffects?: CardEffect[]; // for QUEUE_MATURE_EFFECT
  matureAtTick?: number;
  label?: string;            // human-readable description for logs
}

// ─── Extended Card Type (additive over existing) ──────────────────────────────

export interface CardExtension {
  // Classification
  tags: string[];
  assetClass: AssetClass | null;
  damageType: DamageType | null;

  // Timing
  activationDelayTicks: number | null;   // how many ticks before card activates
  expiresAtTick: number | null;          // tick at which card expires from hand
  decaySchedule: {
    tick: number;
    roiMultiplier: number;
  }[] | null;

  // Risk profile
  latentRiskProfile: {
    maintenanceProbPerMonth: number;     // 0–1, chance of maintenance event
    maxMaintenanceCost: number;
    damageType: DamageType;
  } | null;

  counterpartyRisk: {
    quality: CounterpartyQuality;
    discoverableViaDueDiligence: boolean;
    fraudPenalty: number | null;
  } | null;

  // Zone affinity: multiplier applied on top of zone base
  zoneAffinity: Partial<Record<ZoneId, number>> | null;

  // Rich effects
  effects: CardEffect[];

  // Terms override (set by user pre-play)
  terms: {
    leveragePct: number;          // 0–80
    durationMonths: number;       // 1–36
    isVariableRate: boolean;
    hasInsuranceAddon: boolean;
  } | null;
}

// ─── State Slices ─────────────────────────────────────────────────────────────

export interface BalanceSheet {
  cash: number;
  reserves: number;          // earmarked emergency fund — separate from cash
  illiquidValue: number;     // assets not easily converted to cash
  monthlyObligations: number;
  obligationCoverage: number; // income / obligations ratio
}

export interface ObligationRecord {
  id: string;
  label: string;
  amountPerMonth: number;
  ticksRemaining: number | null;  // null = permanent
  category: 'debt_service' | 'operational' | 'compliance' | 'maintenance';
  sourceCardId: string;
}

export interface PortfolioRecord {
  cardId: string;
  cardName: string;
  assetClass: AssetClass;
  value: number;
  monthlyIncome: number;
  purchaseTick: number;
  zone: ZoneId;
  terms: CardExtension['terms'];
}

export interface MitigationRecord {
  type: MitigationType;
  label: string;
  remainingAbsorption: number;   // how much damage this can absorb
  maxAbsorption: number;
  coversDamageTypes: DamageType[];
  ticksRemaining: number | null;
}

export interface MindState {
  activeBiases: Partial<Record<BiasState, {
    expiresAtTick: number;
    intensity: number;       // 0–1
    source: string;
  }>>;
  hubrisMeter: number;       // 0–100; triggers overconfidence cascade above 70
  disciplineScore: number;   // 0–100; earned by smart plays
}

export interface ReputationState {
  score: number;             // 0–1000
  tier: 'Unknown' | 'Emerging' | 'Established' | 'Respected' | 'Sovereign';
  recentEvents: string[];
}

export interface CapabilityState {
  underwriting: number;      // 0–10; reduces FUBAR probability
  negotiation: number;       // 0–10; improves terms
  bookkeeping: number;       // 0–10; reveals hidden costs early
  marketing: number;         // 0–10; improves cashflow on digital assets
  compliance: number;        // 0–10; reduces legal/fraud FUBAR
  analytics: number;         // 0–10; increases ML card effectiveness
  systems: number;           // 0–10; reduces obligation burden
}

export interface PendingMaturity {
  id: string;
  sourceCardId: string;
  label: string;
  matureAtTick: number;
  effects: CardEffect[];
}

export interface DifficultyProfile {
  preset: 'INTRO' | 'STANDARD' | 'BRUTAL';
  hiddenCostMult: number;
  fateSeverityMult: number;
  counterpartyWorstCaseFreq: number;
  decaySpeed: number;
  liquidityStressThreshold: number;   // illiquid/total ratio that triggers stress
  maintenanceProbMult: number;
}

export const DIFFICULTY_PROFILES: Record<DifficultyProfile['preset'], DifficultyProfile> = {
  INTRO: {
    preset: 'INTRO',
    hiddenCostMult: 0.3,
    fateSeverityMult: 0.6,
    counterpartyWorstCaseFreq: 0.05,
    decaySpeed: 0.3,
    liquidityStressThreshold: 0.75,
    maintenanceProbMult: 0.3,
  },
  STANDARD: {
    preset: 'STANDARD',
    hiddenCostMult: 1.0,
    fateSeverityMult: 1.0,
    counterpartyWorstCaseFreq: 0.15,
    decaySpeed: 1.0,
    liquidityStressThreshold: 0.55,
    maintenanceProbMult: 1.0,
  },
  BRUTAL: {
    preset: 'BRUTAL',
    hiddenCostMult: 1.8,
    fateSeverityMult: 1.6,
    counterpartyWorstCaseFreq: 0.3,
    decaySpeed: 1.8,
    liquidityStressThreshold: 0.35,
    maintenanceProbMult: 2.0,
  },
};

// ─── Objective System ─────────────────────────────────────────────────────────

export type ObjectiveId =
  | 'SURVIVE_12_MONTHS'
  | 'CASHFLOW_POSITIVE'
  | 'DIVERSIFIED_PORTFOLIO'
  | 'NET_WORTH_TARGET'
  | 'RECOVER_FROM_DISTRESS'
  | 'CAPABILITY_MASTERY';

export interface ObjectiveConfig {
  id: ObjectiveId;
  label: string;
  description: string;
  checkFn: (gs: GameStateSnapshot) => boolean;
  bonusXp: number;
  badgeLabel: string;
}

export interface GameStateSnapshot {
  cash: number;
  netWorth: number;
  income: number;
  expenses: number;
  balanceSheet: BalanceSheet;
  portfolio: PortfolioRecord[];
  capabilities: CapabilityState;
  reputation: ReputationState;
  tick: number;
  wasEverInDistress: boolean;
}

export const OBJECTIVE_CONFIGS: Record<ObjectiveId, ObjectiveConfig> = {
  SURVIVE_12_MONTHS: {
    id: 'SURVIVE_12_MONTHS',
    label: 'Survive',
    description: 'Reach tick 720 without bankruptcy.',
    checkFn: (gs) => gs.tick >= 720,
    bonusXp: 200,
    badgeLabel: '🏁 Survivor',
  },
  CASHFLOW_POSITIVE: {
    id: 'CASHFLOW_POSITIVE',
    label: 'Cash Flow Positive',
    description: 'End with income > expenses.',
    checkFn: (gs) => gs.income > gs.expenses,
    bonusXp: 300,
    badgeLabel: '💚 Cash Positive',
  },
  DIVERSIFIED_PORTFOLIO: {
    id: 'DIVERSIFIED_PORTFOLIO',
    label: 'Diversified',
    description: 'Hold assets in 4+ asset classes.',
    checkFn: (gs) => {
      const classes = new Set(gs.portfolio.map(p => p.assetClass));
      return classes.size >= 4;
    },
    bonusXp: 400,
    badgeLabel: '🌐 Diversified',
  },
  NET_WORTH_TARGET: {
    id: 'NET_WORTH_TARGET',
    label: 'Net Worth',
    description: 'Reach $250K net worth.',
    checkFn: (gs) => gs.netWorth >= 250_000,
    bonusXp: 500,
    badgeLabel: '💰 Quarter Mil',
  },
  RECOVER_FROM_DISTRESS: {
    id: 'RECOVER_FROM_DISTRESS',
    label: 'Phoenix',
    description: 'Enter distress and recover to positive cashflow.',
    checkFn: (gs) => gs.wasEverInDistress && gs.income > gs.expenses,
    bonusXp: 600,
    badgeLabel: '🔥 Phoenix',
  },
  CAPABILITY_MASTERY: {
    id: 'CAPABILITY_MASTERY',
    label: 'Operator',
    description: 'Reach level 5 in any 3 capabilities.',
    checkFn: (gs) => {
      const caps = Object.values(gs.capabilities) as number[];
      return caps.filter(c => c >= 5).length >= 3;
    },
    bonusXp: 450,
    badgeLabel: '⚙️ Operator',
  },
};

// ─── Resolution Result ────────────────────────────────────────────────────────

export interface ResolutionResult {
  cashDelta: number;
  cashflowDelta: number;
  netWorthDelta: number;
  freezeTicksDelta: number;
  shieldConsumed: boolean;
  biasStateSet: BiasState | null;
  biasStateCleared: BiasState | null;
  capabilityGained: { stat: CapabilityStat; amount: number } | null;
  obligationAdded: ObligationRecord | null;
  maturityQueued: PendingMaturity | null;
  reputationDelta: number;
  explanation: string;             // one-line cause explanation for "teach back"
  zoneApplied: ZoneId | null;
  zoneModifierLabel: string | null;
}

// ─── Bias Effects on Card Resolution ─────────────────────────────────────────

export const BIAS_CARD_MODIFIERS: Record<BiasState, {
  label: string;
  cashflowMult: number;
  riskMult: number;
  description: string;
}> = {
  FOMO: {
    label: '⚡ FOMO Active',
    cashflowMult: 1.15,
    riskMult: 1.4,
    description: 'FOMO: +15% upside, +40% downside exposure',
  },
  SUNK_COST: {
    label: '🕳 Sunk Cost',
    cashflowMult: 0.85,
    riskMult: 1.2,
    description: 'Holding losers: −15% cashflow efficiency',
  },
  EGO_REVENGE: {
    label: '🔥 Ego Revenge',
    cashflowMult: 0.7,
    riskMult: 1.8,
    description: 'Chasing losses: brutal downside amplifier',
  },
  PANIC: {
    label: '😱 Panic',
    cashflowMult: 0.5,
    riskMult: 0.5,
    description: 'Panic sell: halved returns but reduced further FUBAR',
  },
  OVERCONFIDENCE: {
    label: '😎 Overconfident',
    cashflowMult: 1.3,
    riskMult: 2.5,
    description: 'Riding the streak: massive upside AND downside amplification',
  },
  DECISION_FATIGUE: {
    label: '😴 Fatigued',
    cashflowMult: 0.9,
    riskMult: 1.15,
    description: 'Decision fatigue: slightly degraded performance',
  },
  SOCIAL_PROOF_TRAP: {
    label: '👥 Herd Mode',
    cashflowMult: 1.0,
    riskMult: 1.3,
    description: 'Following the crowd: neutral cashflow, elevated tail risk',
  },
};

// ─── Concentration / HHI Scoring ─────────────────────────────────────────────

export function computeConcentrationScore(portfolio: PortfolioRecord[]): number {
  if (portfolio.length === 0) return 0;
  const totals: Partial<Record<AssetClass, number>> = {};
  let total = 0;
  for (const p of portfolio) {
    totals[p.assetClass] = (totals[p.assetClass] ?? 0) + p.value;
    total += p.value;
  }
  if (total === 0) return 0;
  // HHI-style: sum of squared shares (0 = perfect diversification, 1 = total concentration)
  return Object.values(totals).reduce((acc, v) => acc + Math.pow((v ?? 0) / total, 2), 0);
}

export function liquidityRatio(bs: BalanceSheet): number {
  const total = bs.cash + bs.reserves + bs.illiquidValue;
  if (total === 0) return 1;
  return (bs.cash + bs.reserves) / total;
}

// ─── Distress Detection ───────────────────────────────────────────────────────

export function isInDistress(
  bs: BalanceSheet,
  income: number,
  difficultyProfile: DifficultyProfile,
): boolean {
  const liqRatio = liquidityRatio(bs);
  const coverageRatio = income / Math.max(1, bs.monthlyObligations);
  return liqRatio < difficultyProfile.liquidityStressThreshold || coverageRatio < 1.05;
}

// ─── Expiry Badge Label ───────────────────────────────────────────────────────

export type ExpiryBadge = 'HOT' | 'COOLING' | 'EXPIRING' | 'EXPIRED';

export function getExpiryBadge(currentTick: number, expiresAtTick: number | null): ExpiryBadge | null {
  if (expiresAtTick === null) return null;
  const remaining = expiresAtTick - currentTick;
  if (remaining <= 0) return 'EXPIRED';
  if (remaining <= 15) return 'EXPIRING';
  if (remaining <= 40) return 'COOLING';
  return 'HOT';
}

export const EXPIRY_BADGE_STYLES: Record<ExpiryBadge, { label: string; color: string; bg: string }> = {
  HOT:      { label: '🔥 HOT',      color: 'text-orange-300', bg: 'bg-orange-900/80' },
  COOLING:  { label: '❄️ COOLING',  color: 'text-blue-300',   bg: 'bg-blue-900/80' },
  EXPIRING: { label: '⚠️ EXPIRING', color: 'text-red-300',    bg: 'bg-red-900/80' },
  EXPIRED:  { label: '💀 EXPIRED',  color: 'text-zinc-500',   bg: 'bg-zinc-900/80' },
};
