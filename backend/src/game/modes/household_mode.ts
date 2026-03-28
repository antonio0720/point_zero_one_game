// backend/src/game/modes/household_mode.ts

/**
 * POINT ZERO ONE — HOUSEHOLD MODE ENGINE (FAMILY / EDUCATION)
 * backend/src/game/modes/household_mode.ts
 * VERSION: 4.0.0 — 2026-03-28
 *
 * Doctrine-aligned backend mode implementation for Household — the 5th mode.
 * Unlike the four competitive battlegrounds (Empire, Predator, Syndicate, Phantom),
 * Household mode focuses on multi-player family financial education.
 *
 * Core mechanics implemented:
 * - Multi-player household financial education (parents + children)
 * - Real-world budgeting scenarios (rent, groceries, utilities, savings goals)
 * - Collaborative household budget management
 * - Age-appropriate difficulty scaling (CHILD / TEEN / PARENT)
 * - Financial literacy milestones and achievements
 * - Family goal tracking (emergency fund, vacation, college savings)
 * - Simplified card mechanics for younger players
 * - Household income/expense balancing
 * - Savings rate optimization
 * - Debt management education
 * - Insurance and protection concepts
 * - Investment basics for beginners
 * - HouseholdBudgetEngine: central budget allocation and tracking
 * - SavingsGoalTracker: family goal progress with milestones
 * - DebtManagementEngine: educational debt payoff strategies
 * - HouseholdCardOverlayResolver: age-appropriate card simplification
 * - FamilyMemberRoleEngine: parent/teen/child role mechanics
 * - HouseholdMilestoneTracker: financial literacy badges
 * - HouseholdChatBridge: family encouragement and financial tips
 * - HouseholdAnalyticsEngine: comprehensive analytics and diagnostics
 * - 32-dim ML feature extraction per household run
 * - 24×8 DL tensor: rows=budget windows, columns=savings/debt/expense/income patterns
 * - Full reducer with all action types
 * - Batch simulation support
 * - 30+ convenience export functions
 */

// ─── Node / crypto ────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';

// ─── Card types ───────────────────────────────────────────────────────────────
import {
  GameMode,
  DeckType,
  CardTag,
  CardRarity,
  TimingClass,
  PressureTier,
  RunPhase,
  GhostMarkerKind,
  DivergencePotential as CardTypesDivergencePotential,
  Targeting,
  Counterability,
  type CardDefinition,
  type ModeOverlay,
  type CardOverlaySnapshot,
  CARD_LEGALITY_MATRIX,
  MODE_TAG_WEIGHT_DEFAULTS,
  DECK_TYPE_PROFILES,
  MODE_CARD_BEHAVIORS,
  HOLD_SYSTEM_CONFIG,
  COMEBACK_SURGE_CONFIG,
  PRESSURE_COST_MODIFIERS,
  CARD_RARITY_DROP_RATES,
  GHOST_MARKER_SPECS,
  IPA_CHAIN_SYNERGIES,
  clamp,
  round6,
  isDeckLegalInMode,
  computeTagWeightedScore,
  computePressureCostModifier,
  computeBleedthroughMultiplier,
  computeTrustEfficiency,
  getDeckTypeProfile,
  getModeCardBehavior,
  computeDivergencePotential,
  getGhostMarkerSpec,
  computeGhostMarkerCordBonus,
  computeGhostMarkerShieldBonus,
  resolveGhostBenchmarkWindow,
  computeCardDrawWeights,
  getProofBadgeConditionsForMode,
  computeAggregateProofBadgeCord,
} from '../engine/card_types';

// ─── Deterministic RNG ────────────────────────────────────────────────────────
import {
  normalizeSeed,
  hashStringToSeed,
  combineSeed,
  createDeterministicRng,
  createMulberry32,
  sanitizePositiveWeights,
  DEFAULT_NON_ZERO_SEED,
  type DeterministicRng,
} from '../engine/deterministic_rng';

// ─── Replay Engine ────────────────────────────────────────────────────────────
import {
  sha256Hex,
  stableStringify,
  type Ledger,
  createDefaultLedger,
  ReplayEngine,
  GameState as ReplayGameState,
  type ReplaySnapshot,
  type DecisionEffect,
  type RunEvent,
} from '../engine/replay_engine';

// ─── Card Registry ────────────────────────────────────────────────────────────
import { CardRegistry } from '../engine/card_registry';

// ═══════════════════════════════════════════════════════════════════════════════
// § 1 — CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Semver for this mode engine; persisted alongside every replay proof. */
export const HOUSEHOLD_MODE_VERSION = '4.0.0';

/** Canonical game mode reference — Household uses GO_ALONE legality base */
const HOUSEHOLD_BASE_MODE = GameMode.GO_ALONE;

/** ML feature vector dimensionality — 32 floats per household run */
export const HOUSEHOLD_ML_FEATURE_DIM = 32;

/** DL tensor shape — rows × columns */
export const HOUSEHOLD_DL_ROWS = 24;
export const HOUSEHOLD_DL_COLS = 8;

/** Maximum number of family members in a household */
const MAX_HOUSEHOLD_MEMBERS = 6;

/** Minimum number of family members */
const MIN_HOUSEHOLD_MEMBERS = 2;

/** Phase thresholds — Household uses educational progression phases */
const PHASE_AT_TICK: readonly [number, HouseholdPhase][] = [
  [0, 'FOUNDATION'],
  [5, 'ESCALATION'],
  [9, 'SOVEREIGNTY'],
];

/** Age group difficulty scaling multipliers */
const AGE_DIFFICULTY_CHILD = 0.4;
const AGE_DIFFICULTY_TEEN = 0.7;
const AGE_DIFFICULTY_PARENT = 1.0;

/** Savings goal category multipliers */
const SAVINGS_GOAL_EMERGENCY_MULTIPLIER = 1.0;
const SAVINGS_GOAL_VACATION_MULTIPLIER = 0.8;
const SAVINGS_GOAL_COLLEGE_MULTIPLIER = 1.5;
const SAVINGS_GOAL_RETIREMENT_MULTIPLIER = 2.0;
const SAVINGS_GOAL_HOME_MULTIPLIER = 1.8;
const SAVINGS_GOAL_CAR_MULTIPLIER = 0.9;

/** Budget category allocation defaults (percentage) */
const BUDGET_HOUSING_DEFAULT_PCT = 0.30;
const BUDGET_GROCERIES_DEFAULT_PCT = 0.15;
const BUDGET_UTILITIES_DEFAULT_PCT = 0.08;
const BUDGET_TRANSPORT_DEFAULT_PCT = 0.12;
const BUDGET_INSURANCE_DEFAULT_PCT = 0.06;
const BUDGET_SAVINGS_DEFAULT_PCT = 0.15;
const BUDGET_ENTERTAINMENT_DEFAULT_PCT = 0.08;
const BUDGET_EDUCATION_DEFAULT_PCT = 0.06;

/** Debt management strategy weights */
const DEBT_AVALANCHE_WEIGHT = 1.2;
const DEBT_SNOWBALL_WEIGHT = 1.0;
const DEBT_MINIMUM_PAYMENT_WEIGHT = 0.6;
const DEBT_CONSOLIDATION_WEIGHT = 0.9;

/** Financial literacy milestone thresholds */
const MILESTONE_FIRST_BUDGET_TICK = 1;
const MILESTONE_SAVINGS_STREAK_LENGTH = 3;
const MILESTONE_DEBT_FREE_THRESHOLD = 0;
const MILESTONE_EMERGENCY_FUND_MONTHS = 3;
const MILESTONE_INVESTMENT_START_AMOUNT = 500;
const MILESTONE_INSURANCE_COVERAGE_PCT = 0.5;

/** Proof badge thresholds */
const BUDGET_MASTER_MIN_BALANCED_TICKS = 8;
const BUDGET_MASTER_MAX_OVERRUN_COUNT = 1;
const SAVINGS_CHAMPION_MIN_RATE = 0.20;
const SAVINGS_CHAMPION_MIN_TICKS = 5;
const DEBT_CRUSHER_ZERO_DEBT_BY_TICK = 10;
const FAMILY_TEAMWORK_MIN_COLLABORATIVE_PLAYS = 10;
const FAMILY_TEAMWORK_MIN_TRUST_AVERAGE = 70;
const FINANCIAL_GURU_ALL_MILESTONES_UNLOCKED = true;

/** Chat bridge event types */
const CHAT_EVENT_BUDGET_TIP = 'household_budget_tip';
const CHAT_EVENT_SAVINGS_MILESTONE = 'household_savings_milestone';
const CHAT_EVENT_DEBT_WARNING = 'household_debt_warning';
const CHAT_EVENT_FAMILY_ENCOURAGEMENT = 'household_family_encouragement';
const CHAT_EVENT_LITERACY_BADGE = 'household_literacy_badge';
const CHAT_EVENT_GOAL_PROGRESS = 'household_goal_progress';
const CHAT_EVENT_BUDGET_OVERRUN = 'household_budget_overrun';
const CHAT_EVENT_INVESTMENT_HINT = 'household_investment_hint';

/** Batch simulation default configuration */
const BATCH_DEFAULT_TICK_COUNT = 120;
const BATCH_DEFAULT_RUN_COUNT = 100;
const BATCH_MAX_RUN_COUNT = 10_000;

/** Insurance coverage types */
const INSURANCE_HEALTH_PREMIUM_PCT = 0.03;
const INSURANCE_AUTO_PREMIUM_PCT = 0.02;
const INSURANCE_HOME_PREMIUM_PCT = 0.015;
const INSURANCE_LIFE_PREMIUM_PCT = 0.01;

/** Investment return rate ranges */
const INVESTMENT_SAVINGS_ACCOUNT_RATE = 0.02;
const INVESTMENT_BONDS_RATE = 0.04;
const INVESTMENT_INDEX_FUND_RATE = 0.07;
const INVESTMENT_INDIVIDUAL_STOCK_RATE = 0.10;
const INVESTMENT_RISK_PENALTY_MULTIPLIER = 1.5;

/** Household income categories */
const INCOME_SALARY_WEIGHT = 0.7;
const INCOME_SIDE_HUSTLE_WEIGHT = 0.15;
const INCOME_PASSIVE_WEIGHT = 0.10;
const INCOME_ALLOWANCE_WEIGHT = 0.05;

/** Pressure thresholds for household mode */
const HOUSEHOLD_PRESSURE_LOW = 20;
const HOUSEHOLD_PRESSURE_MODERATE = 40;
const HOUSEHOLD_PRESSURE_HIGH = 65;
const HOUSEHOLD_PRESSURE_CRITICAL = 85;

/** Trust score thresholds for family cohesion */
const FAMILY_TRUST_HIGH = 80;
const FAMILY_TRUST_STANDARD = 50;
const FAMILY_TRUST_LOW = 30;
const FAMILY_TRUST_CRISIS = 15;

/** Card simplification level for children */
const CHILD_CARD_SIMPLIFICATION_FACTOR = 0.5;
const TEEN_CARD_SIMPLIFICATION_FACTOR = 0.75;
const PARENT_CARD_SIMPLIFICATION_FACTOR = 1.0;

/** Expense shock magnitude ranges */
const EXPENSE_SHOCK_MINOR_MIN = 100;
const EXPENSE_SHOCK_MINOR_MAX = 500;
const EXPENSE_SHOCK_MODERATE_MIN = 500;
const EXPENSE_SHOCK_MODERATE_MAX = 2000;
const EXPENSE_SHOCK_MAJOR_MIN = 2000;
const EXPENSE_SHOCK_MAJOR_MAX = 10000;

/** Financial tip categories */
const TIP_CATEGORY_BUDGETING = 'budgeting';
const TIP_CATEGORY_SAVING = 'saving';
const TIP_CATEGORY_INVESTING = 'investing';
const TIP_CATEGORY_DEBT = 'debt';
const TIP_CATEGORY_INSURANCE = 'insurance';
const TIP_CATEGORY_EMERGENCY = 'emergency';

/** Collaborative action bonus multipliers */
const FAMILY_COLLAB_BONUS_SMALL = 1.1;
const FAMILY_COLLAB_BONUS_MEDIUM = 1.25;
const FAMILY_COLLAB_BONUS_LARGE = 1.5;
const FAMILY_COLLAB_BONUS_PERFECT = 2.0;

/** Difficulty rating weights for household mode */
const DIFFICULTY_BUDGET_WEIGHT = 0.25;
const DIFFICULTY_SAVINGS_WEIGHT = 0.20;
const DIFFICULTY_DEBT_WEIGHT = 0.20;
const DIFFICULTY_EXPENSE_WEIGHT = 0.15;
const DIFFICULTY_FAMILY_WEIGHT = 0.10;
const DIFFICULTY_INVESTMENT_WEIGHT = 0.10;

// ═══════════════════════════════════════════════════════════════════════════════
// § 2 — TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Preserved public exports from original file ─────────────────────────────

export type HouseholdPhase = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';
export type HouseholdRole = 'STEWARD' | 'DEALMAKER' | 'GUARDIAN' | 'STRATEGIST';
export type HouseholdActionType =
  | 'ADVANCE_TICK'
  | 'APPLY_TABLE_EVENT'
  | 'BAIL_OUT'
  | 'SYNDICATE_DEAL'
  | 'TREASURY_LOAN'
  | 'REPAY_LOAN'
  | 'CASCADE_ABSORB'
  | 'DEFECT'
  | 'SABOTAGE_POLICY'
  | 'PROOF_SHARE'
  | 'AID_REQUEST';

// ─── New types for v4.0.0 ────────────────────────────────────────────────────

export type FamilyMemberAge = 'CHILD' | 'TEEN' | 'PARENT';
export type HouseholdOutcome = 'PROSPERITY' | 'STABILITY' | 'HARDSHIP' | 'CRISIS';
export type HouseholdResultTier = 'STRUGGLING' | 'STABLE' | 'THRIVING' | 'FLOURISHING';

export type BudgetCategoryKey =
  | 'HOUSING'
  | 'GROCERIES'
  | 'UTILITIES'
  | 'TRANSPORT'
  | 'INSURANCE'
  | 'SAVINGS'
  | 'ENTERTAINMENT'
  | 'EDUCATION';

export type SavingsGoalType =
  | 'EMERGENCY_FUND'
  | 'VACATION'
  | 'COLLEGE'
  | 'RETIREMENT'
  | 'HOME'
  | 'CAR';

export type DebtStrategy = 'AVALANCHE' | 'SNOWBALL' | 'MINIMUM' | 'CONSOLIDATION';

export type InsuranceType = 'HEALTH' | 'AUTO' | 'HOME' | 'LIFE';

export type InvestmentType = 'SAVINGS_ACCOUNT' | 'BONDS' | 'INDEX_FUND' | 'INDIVIDUAL_STOCK';

export type ExpenseShockSeverity = 'MINOR' | 'MODERATE' | 'MAJOR';

export type HouseholdBadge =
  | 'BUDGET_MASTER'
  | 'SAVINGS_CHAMPION'
  | 'DEBT_CRUSHER'
  | 'FAMILY_TEAMWORK'
  | 'FINANCIAL_GURU';

export type FinancialLiteracyMilestone =
  | 'FIRST_BUDGET'
  | 'SAVINGS_STREAK'
  | 'DEBT_FREE'
  | 'EMERGENCY_FUND_BUILT'
  | 'FIRST_INVESTMENT'
  | 'INSURANCE_COVERED'
  | 'BUDGET_BALANCED'
  | 'ALL_GOALS_SET'
  | 'FAMILY_MEETING_HELD'
  | 'EXPENSE_TRACKED';

export type FinancialTipCategory =
  | 'budgeting'
  | 'saving'
  | 'investing'
  | 'debt'
  | 'insurance'
  | 'emergency';

// ─── Core state interfaces ───────────────────────────────────────────────────

export interface HouseholdPlayerState {
  readonly playerId: string;
  readonly displayName: string;
  readonly role: HouseholdRole;
  readonly ageGroup: FamilyMemberAge;
  readonly cash: number;
  readonly income: number;
  readonly liabilities: number;
  readonly netWorth: number;
  readonly pressure: number;
  readonly shields: number;
  readonly trustScore: number;
  readonly aidRequests: number;
  readonly bailoutsGiven: number;
  readonly bailoutsReceived: number;
  readonly syndicatesClosed: number;
  readonly sabotageEvents: number;
  readonly cascadeAbsorptions: number;
  readonly defected: boolean;
  readonly lastProofShareTick: number | null;
  readonly savingsRate: number;
  readonly totalSaved: number;
  readonly totalDebtPaid: number;
  readonly collaborativePlays: number;
  readonly milestonesUnlocked: readonly FinancialLiteracyMilestone[];
  readonly cardSimplificationLevel: number;
  readonly budgetAdherence: number;
  readonly financialLiteracyScore: number;
}

export interface HouseholdLoan {
  readonly loanId: string;
  readonly borrowerId: string;
  readonly principal: number;
  readonly dueTick: number;
  readonly issuedTick: number;
  readonly repaid: boolean;
  readonly interestRate: number;
  readonly loanType: string;
}

export interface BudgetAllocation {
  readonly category: BudgetCategoryKey;
  readonly allocatedPct: number;
  readonly actualSpent: number;
  readonly budgetedAmount: number;
  readonly overrun: boolean;
  readonly trend: 'INCREASING' | 'STABLE' | 'DECREASING';
}

export interface SavingsGoal {
  readonly goalId: string;
  readonly type: SavingsGoalType;
  readonly label: string;
  readonly targetAmount: number;
  readonly currentAmount: number;
  readonly startedAtTick: number;
  readonly targetTick: number;
  readonly completed: boolean;
  readonly contributorsIds: readonly string[];
  readonly priority: number;
}

export interface DebtEntry {
  readonly debtId: string;
  readonly holderId: string;
  readonly label: string;
  readonly principal: number;
  readonly remainingBalance: number;
  readonly interestRate: number;
  readonly minimumPayment: number;
  readonly issuedTick: number;
  readonly strategy: DebtStrategy;
}

export interface InsuranceCoverage {
  readonly type: InsuranceType;
  readonly premiumPerTick: number;
  readonly coverageAmount: number;
  readonly active: boolean;
  readonly claimsMade: number;
}

export interface InvestmentPosition {
  readonly investmentId: string;
  readonly type: InvestmentType;
  readonly principal: number;
  readonly currentValue: number;
  readonly returnRate: number;
  readonly startedAtTick: number;
  readonly holderId: string;
}

export interface ExpenseShock {
  readonly shockId: string;
  readonly severity: ExpenseShockSeverity;
  readonly amount: number;
  readonly category: BudgetCategoryKey;
  readonly occurredAtTick: number;
  readonly covered: boolean;
  readonly coveredByInsurance: boolean;
  readonly description: string;
}

export interface HouseholdMacroState {
  readonly tick: number;
  readonly phase: HouseholdPhase;
  readonly treasury: number;
  readonly pressure: number;
  readonly hardMode: boolean;
  readonly warAlertActive: boolean;
  readonly rescueWindowOpen: boolean;
  readonly aidWindowOpen: boolean;
  readonly synergyBonusActive: boolean;
  readonly activePolicies: readonly string[];
  readonly eventLog: readonly HouseholdEvent[];
  readonly loans: readonly HouseholdLoan[];
  readonly defectionOccurred: boolean;
  readonly budgetAllocations: readonly BudgetAllocation[];
  readonly savingsGoals: readonly SavingsGoal[];
  readonly debts: readonly DebtEntry[];
  readonly insurances: readonly InsuranceCoverage[];
  readonly investments: readonly InvestmentPosition[];
  readonly expenseShocks: readonly ExpenseShock[];
  readonly totalHouseholdIncome: number;
  readonly totalHouseholdExpenses: number;
  readonly monthlyBudgetBalance: number;
  readonly savingsRateHousehold: number;
  readonly debtToIncomeRatio: number;
  readonly financialHealthScore: number;
  readonly familyCohesionScore: number;
  readonly difficultyMultiplier: number;
  readonly currentTimeMs: number;
}

export interface HouseholdEvent {
  readonly tick: number;
  readonly type: HouseholdActionType | 'SYSTEM';
  readonly actorId: string | null;
  readonly targetId: string | null;
  readonly amount: number | null;
  readonly detail: string;
}

export interface HouseholdModeState {
  readonly runId: string;
  readonly seed: string;
  readonly players: readonly HouseholdPlayerState[];
  readonly macro: HouseholdMacroState;
}

// ─── Action interfaces (preserved + extended) ────────────────────────────────

export interface AdvanceTickAction {
  readonly type: 'ADVANCE_TICK';
  readonly incomingPressure?: number;
  readonly treasuryDelta?: number;
  readonly cashDelta?: number;
  readonly incomeDelta?: number;
}

export interface ApplyTableEventAction {
  readonly type: 'APPLY_TABLE_EVENT';
  readonly actorId: string;
  readonly label: string;
  readonly treasuryDelta: number;
  readonly pressureDelta: number;
}

export interface BailOutAction {
  readonly type: 'BAIL_OUT';
  readonly actorId: string;
  readonly targetId: string;
  readonly amount: number;
  readonly stringsAttached: boolean;
}

export interface SyndicateDealAction {
  readonly type: 'SYNDICATE_DEAL';
  readonly actorId: string;
  readonly partnerIds: readonly string[];
  readonly treasuryContribution: number;
  readonly expectedYield: number;
}

export interface TreasuryLoanAction {
  readonly type: 'TREASURY_LOAN';
  readonly actorId: string;
  readonly amount: number;
  readonly dueTickOffset: number;
}

export interface RepayLoanAction {
  readonly type: 'REPAY_LOAN';
  readonly actorId: string;
  readonly loanId: string;
}

export interface CascadeAbsorbAction {
  readonly type: 'CASCADE_ABSORB';
  readonly actorId: string;
  readonly targetId: string;
  readonly shieldCost: number;
  readonly pressureReduction: number;
}

export interface DefectAction {
  readonly type: 'DEFECT';
  readonly actorId: string;
}

export interface SabotagePolicyAction {
  readonly type: 'SABOTAGE_POLICY';
  readonly actorId: string;
  readonly label: string;
  readonly pressureDelta: number;
  readonly treasuryDelta: number;
}

export interface ProofShareAction {
  readonly type: 'PROOF_SHARE';
  readonly actorId: string;
}

export interface AidRequestAction {
  readonly type: 'AID_REQUEST';
  readonly actorId: string;
}

export type HouseholdModeAction =
  | AdvanceTickAction
  | ApplyTableEventAction
  | BailOutAction
  | SyndicateDealAction
  | TreasuryLoanAction
  | RepayLoanAction
  | CascadeAbsorbAction
  | DefectAction
  | SabotagePolicyAction
  | ProofShareAction
  | AidRequestAction;

// ─── ML/DL/Analytics interfaces ──────────────────────────────────────────────

export interface HouseholdMLFeatureVector {
  readonly dimension: number;
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly runId: string;
  readonly extractedAtTick: number;
}

export interface HouseholdDLTensor {
  readonly rows: number;
  readonly cols: number;
  readonly data: readonly (readonly number[])[];
  readonly runId: string;
  readonly extractedAtTick: number;
}

export interface HouseholdChatBridgeEvent {
  readonly eventType: string;
  readonly tick: number;
  readonly runId: string;
  readonly payload: Record<string, unknown>;
  readonly priority: 'HIGH' | 'MEDIUM' | 'LOW';
  readonly emittedAtMs: number;
}

export interface HouseholdBudgetAnalytics {
  readonly totalIncome: number;
  readonly totalExpenses: number;
  readonly netBalance: number;
  readonly savingsRate: number;
  readonly debtToIncome: number;
  readonly budgetAdherenceAvg: number;
  readonly overrunCategories: readonly BudgetCategoryKey[];
  readonly healthScore: number;
}

export interface HouseholdSavingsAnalytics {
  readonly totalSaved: number;
  readonly goalsCompleted: number;
  readonly goalsInProgress: number;
  readonly averageProgress: number;
  readonly bestGoalProgress: number;
  readonly worstGoalProgress: number;
  readonly projectedCompletionTick: number;
}

export interface HouseholdDebtAnalytics {
  readonly totalDebt: number;
  readonly totalPaidOff: number;
  readonly averageInterestRate: number;
  readonly debtToIncomeRatio: number;
  readonly projectedDebtFreeTick: number;
  readonly activeDebts: number;
  readonly strategyEffectiveness: Record<DebtStrategy, number>;
}

export interface HouseholdFamilyAnalytics {
  readonly memberCount: number;
  readonly averageTrustScore: number;
  readonly familyCohesionScore: number;
  readonly collaborativePlayCount: number;
  readonly totalMilestonesUnlocked: number;
  readonly averageLiteracyScore: number;
  readonly roleDistribution: Record<HouseholdRole, number>;
  readonly ageDistribution: Record<FamilyMemberAge, number>;
}

export interface HouseholdModeHealth {
  readonly modeVersion: string;
  readonly engineIntegrity: boolean;
  readonly seedDeterminismVerified: boolean;
  readonly totalRunsProcessed: number;
  readonly averageDifficultyRating: number;
  readonly averageCompletionRate: number;
  readonly medianFinancialHealth: number;
  readonly diagnosticTimestampMs: number;
}

export interface HouseholdAnalytics {
  readonly runId: string;
  readonly budgetAnalytics: HouseholdBudgetAnalytics;
  readonly savingsAnalytics: HouseholdSavingsAnalytics;
  readonly debtAnalytics: HouseholdDebtAnalytics;
  readonly familyAnalytics: HouseholdFamilyAnalytics;
  readonly modeHealth: HouseholdModeHealth;
  readonly proofBadgeTracker: HouseholdBadgeTrackerState;
  readonly finalResult: {
    readonly outcome: HouseholdOutcome;
    readonly tier: HouseholdResultTier;
    readonly financialHealthScore: number;
    readonly savingsAchieved: number;
    readonly debtRemaining: number;
  } | null;
}

export interface HouseholdBadgeTrackerState {
  readonly budgetMaster: { readonly unlocked: boolean; readonly progress: number };
  readonly savingsChampion: { readonly unlocked: boolean; readonly progress: number };
  readonly debtCrusher: { readonly unlocked: boolean; readonly progress: number };
  readonly familyTeamwork: { readonly unlocked: boolean; readonly progress: number };
  readonly financialGuru: { readonly unlocked: boolean; readonly progress: number };
}

export interface BatchSimulationConfig {
  readonly baseSeed: string;
  readonly runCount: number;
  readonly ticksPerRun: number;
  readonly householdTemplate: {
    readonly memberCount: number;
    readonly startingCash: number;
    readonly startingIncome: number;
    readonly startingDebt: number;
    readonly difficultyMultiplier: number;
  };
}

export interface BatchRunSummary {
  readonly runId: string;
  readonly seed: number;
  readonly finalHealthScore: number;
  readonly totalSaved: number;
  readonly debtRemaining: number;
  readonly outcome: HouseholdOutcome;
  readonly tier: HouseholdResultTier;
  readonly savingsRate: number;
  readonly milestonesUnlocked: number;
}

export interface BatchSimulationResult {
  readonly totalRuns: number;
  readonly completedRuns: number;
  readonly averageHealthScore: number;
  readonly medianSavingsRate: number;
  readonly averageDebtRemaining: number;
  readonly prosperityRate: number;
  readonly healthDistribution: {
    readonly min: number;
    readonly max: number;
    readonly p25: number;
    readonly p50: number;
    readonly p75: number;
    readonly p90: number;
  };
  readonly averageMilestonesUnlocked: number;
  readonly averageCollaborativePlays: number;
  readonly runSummaries: readonly BatchRunSummary[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 3 — UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function byPlayerId(
  players: readonly HouseholdPlayerState[],
  playerId: string,
): HouseholdPlayerState {
  const player = players.find((entry) => entry.playerId === playerId);
  if (!player) {
    throw new Error(`Unknown household player: ${playerId}`);
  }
  return player;
}

function replacePlayer(
  players: readonly HouseholdPlayerState[],
  updated: HouseholdPlayerState,
): HouseholdPlayerState[] {
  return players.map((player) =>
    player.playerId === updated.playerId ? updated : player,
  );
}

function nextPhase(tick: number): HouseholdPhase {
  let phase: HouseholdPhase = 'FOUNDATION';
  for (const [threshold, candidate] of PHASE_AT_TICK) {
    if (tick >= threshold) {
      phase = candidate;
    }
  }
  return phase;
}

function roleSynergyActive(players: readonly HouseholdPlayerState[]): boolean {
  const active = players.filter((player) => !player.defected);
  const roles = new Set(active.map((player) => player.role));
  return active.length >= 4 && roles.size === 4;
}

function computeRescueWindow(players: readonly HouseholdPlayerState[]): boolean {
  return players.some((player) => !player.defected && player.pressure >= 80);
}

function computeAidWindow(players: readonly HouseholdPlayerState[]): boolean {
  return players.some((player) => !player.defected && player.aidRequests > 0);
}

function recalcNetWorth(player: HouseholdPlayerState): HouseholdPlayerState {
  const netWorth = player.cash + player.income * 6 - player.liabilities;
  return {
    ...player,
    netWorth,
  };
}

function appendEvent(
  state: HouseholdModeState,
  type: HouseholdEvent['type'],
  actorId: string | null,
  targetId: string | null,
  amount: number | null,
  detail: string,
): HouseholdModeState {
  const event: HouseholdEvent = {
    tick: state.macro.tick,
    type,
    actorId,
    targetId,
    amount,
    detail,
  };

  return {
    ...state,
    macro: {
      ...state.macro,
      eventLog: [...state.macro.eventLog, event],
    },
  };
}

function refreshMacro(state: HouseholdModeState): HouseholdModeState {
  const synergyBonusActive = roleSynergyActive(state.players);
  const rescueWindowOpen = computeRescueWindow(state.players);
  const aidWindowOpen = computeAidWindow(state.players);
  const warAlertActive =
    rescueWindowOpen ||
    state.players.some((player) => !player.defected && player.shields <= 10);

  const shieldBonus = synergyBonusActive ? 5 : 0;
  const players = state.players.map((player) =>
    recalcNetWorth({
      ...player,
      shields: clamp(player.shields + shieldBonus, 0, 100),
    }),
  );

  // Compute household-level financial metrics
  const totalHouseholdIncome = players.reduce((s, p) => s + p.income, 0);
  const totalHouseholdExpenses = players.reduce((s, p) => s + Math.max(1, Math.ceil(p.liabilities / 20)), 0);
  const monthlyBudgetBalance = totalHouseholdIncome - totalHouseholdExpenses;
  const savingsRateHousehold = totalHouseholdIncome > 0
    ? round6(players.reduce((s, p) => s + p.savingsRate, 0) / players.length)
    : 0;
  const totalDebt = state.macro.debts.reduce((s, d) => s + d.remainingBalance, 0);
  const debtToIncomeRatio = totalHouseholdIncome > 0
    ? round6(totalDebt / (totalHouseholdIncome * 12))
    : 0;
  const averageTrust = players.length > 0
    ? players.reduce((s, p) => s + p.trustScore, 0) / players.length
    : 0;
  const financialHealthScore = computeFinancialHealthScore(
    savingsRateHousehold,
    debtToIncomeRatio,
    averageTrust,
    state.macro.pressure,
  );
  const familyCohesionScore = computeFamilyCohesionScore(players);

  return {
    ...state,
    players,
    macro: {
      ...state.macro,
      synergyBonusActive,
      rescueWindowOpen,
      aidWindowOpen,
      warAlertActive,
      phase: nextPhase(state.macro.tick),
      totalHouseholdIncome,
      totalHouseholdExpenses,
      monthlyBudgetBalance,
      savingsRateHousehold,
      debtToIncomeRatio,
      financialHealthScore,
      familyCohesionScore,
    },
  };
}

function computeFinancialHealthScore(
  savingsRate: number,
  debtToIncome: number,
  averageTrust: number,
  pressure: number,
): number {
  const savingsComponent = clamp(savingsRate * 200, 0, 30);
  const debtComponent = clamp((1 - debtToIncome) * 25, 0, 25);
  const trustComponent = clamp(averageTrust / 4, 0, 25);
  const pressureComponent = clamp((100 - pressure) / 5, 0, 20);
  return round6(savingsComponent + debtComponent + trustComponent + pressureComponent);
}

function computeFamilyCohesionScore(players: readonly HouseholdPlayerState[]): number {
  if (players.length === 0) return 0;
  const activePlayers = players.filter((p) => !p.defected);
  if (activePlayers.length === 0) return 0;

  const avgTrust = activePlayers.reduce((s, p) => s + p.trustScore, 0) / activePlayers.length;
  const avgCollaboration = activePlayers.reduce((s, p) => s + p.collaborativePlays, 0) / activePlayers.length;
  const milestoneCount = activePlayers.reduce((s, p) => s + p.milestonesUnlocked.length, 0);
  const defectionPenalty = players.some((p) => p.defected) ? 20 : 0;

  return round6(clamp(
    avgTrust * 0.4 + Math.min(avgCollaboration * 2, 30) + Math.min(milestoneCount * 3, 30) - defectionPenalty,
    0,
    100,
  ));
}

function mutatePlayer(
  state: HouseholdModeState,
  playerId: string,
  transform: (player: HouseholdPlayerState) => HouseholdPlayerState,
): HouseholdModeState {
  const player = byPlayerId(state.players, playerId);
  const updated = recalcNetWorth(transform(player));
  return {
    ...state,
    players: replacePlayer(state.players, updated),
  };
}

function stableId(prefix: string, seed: string, index: number): string {
  return sha256Hex(`${prefix}:${seed}:${index}`).slice(0, 16);
}

function computeAgeDifficultyMultiplier(age: FamilyMemberAge): number {
  switch (age) {
    case 'CHILD': return AGE_DIFFICULTY_CHILD;
    case 'TEEN': return AGE_DIFFICULTY_TEEN;
    case 'PARENT': return AGE_DIFFICULTY_PARENT;
  }
}

function computeCardSimplificationLevel(age: FamilyMemberAge): number {
  switch (age) {
    case 'CHILD': return CHILD_CARD_SIMPLIFICATION_FACTOR;
    case 'TEEN': return TEEN_CARD_SIMPLIFICATION_FACTOR;
    case 'PARENT': return PARENT_CARD_SIMPLIFICATION_FACTOR;
  }
}

function computeSavingsGoalMultiplier(type: SavingsGoalType): number {
  switch (type) {
    case 'EMERGENCY_FUND': return SAVINGS_GOAL_EMERGENCY_MULTIPLIER;
    case 'VACATION': return SAVINGS_GOAL_VACATION_MULTIPLIER;
    case 'COLLEGE': return SAVINGS_GOAL_COLLEGE_MULTIPLIER;
    case 'RETIREMENT': return SAVINGS_GOAL_RETIREMENT_MULTIPLIER;
    case 'HOME': return SAVINGS_GOAL_HOME_MULTIPLIER;
    case 'CAR': return SAVINGS_GOAL_CAR_MULTIPLIER;
  }
}

function computeDebtStrategyWeight(strategy: DebtStrategy): number {
  switch (strategy) {
    case 'AVALANCHE': return DEBT_AVALANCHE_WEIGHT;
    case 'SNOWBALL': return DEBT_SNOWBALL_WEIGHT;
    case 'MINIMUM': return DEBT_MINIMUM_PAYMENT_WEIGHT;
    case 'CONSOLIDATION': return DEBT_CONSOLIDATION_WEIGHT;
  }
}

function computeInsurancePremiumRate(type: InsuranceType): number {
  switch (type) {
    case 'HEALTH': return INSURANCE_HEALTH_PREMIUM_PCT;
    case 'AUTO': return INSURANCE_AUTO_PREMIUM_PCT;
    case 'HOME': return INSURANCE_HOME_PREMIUM_PCT;
    case 'LIFE': return INSURANCE_LIFE_PREMIUM_PCT;
  }
}

function computeInvestmentReturnRate(type: InvestmentType): number {
  switch (type) {
    case 'SAVINGS_ACCOUNT': return INVESTMENT_SAVINGS_ACCOUNT_RATE;
    case 'BONDS': return INVESTMENT_BONDS_RATE;
    case 'INDEX_FUND': return INVESTMENT_INDEX_FUND_RATE;
    case 'INDIVIDUAL_STOCK': return INVESTMENT_INDIVIDUAL_STOCK_RATE;
  }
}

function computeExpenseShockRange(severity: ExpenseShockSeverity): { min: number; max: number } {
  switch (severity) {
    case 'MINOR': return { min: EXPENSE_SHOCK_MINOR_MIN, max: EXPENSE_SHOCK_MINOR_MAX };
    case 'MODERATE': return { min: EXPENSE_SHOCK_MODERATE_MIN, max: EXPENSE_SHOCK_MODERATE_MAX };
    case 'MAJOR': return { min: EXPENSE_SHOCK_MAJOR_MIN, max: EXPENSE_SHOCK_MAJOR_MAX };
  }
}

function computePressureCategory(pressure: number): string {
  if (pressure >= HOUSEHOLD_PRESSURE_CRITICAL) return 'CRITICAL';
  if (pressure >= HOUSEHOLD_PRESSURE_HIGH) return 'HIGH';
  if (pressure >= HOUSEHOLD_PRESSURE_MODERATE) return 'MODERATE';
  if (pressure >= HOUSEHOLD_PRESSURE_LOW) return 'LOW';
  return 'MINIMAL';
}

function computeTrustCategory(trust: number): string {
  if (trust >= FAMILY_TRUST_HIGH) return 'HIGH';
  if (trust >= FAMILY_TRUST_STANDARD) return 'STANDARD';
  if (trust >= FAMILY_TRUST_LOW) return 'LOW';
  if (trust >= FAMILY_TRUST_CRISIS) return 'CRISIS';
  return 'BROKEN';
}

function getDefaultBudgetAllocations(totalIncome: number): BudgetAllocation[] {
  const cats: [BudgetCategoryKey, number][] = [
    ['HOUSING', BUDGET_HOUSING_DEFAULT_PCT],
    ['GROCERIES', BUDGET_GROCERIES_DEFAULT_PCT],
    ['UTILITIES', BUDGET_UTILITIES_DEFAULT_PCT],
    ['TRANSPORT', BUDGET_TRANSPORT_DEFAULT_PCT],
    ['INSURANCE', BUDGET_INSURANCE_DEFAULT_PCT],
    ['SAVINGS', BUDGET_SAVINGS_DEFAULT_PCT],
    ['ENTERTAINMENT', BUDGET_ENTERTAINMENT_DEFAULT_PCT],
    ['EDUCATION', BUDGET_EDUCATION_DEFAULT_PCT],
  ];

  return cats.map(([category, pct]) => ({
    category,
    allocatedPct: pct,
    actualSpent: 0,
    budgetedAmount: Math.round(totalIncome * pct),
    overrun: false,
    trend: 'STABLE' as const,
  }));
}

function computeIncomeBreakdown(totalIncome: number): {
  salary: number;
  sideHustle: number;
  passive: number;
  allowance: number;
} {
  return {
    salary: round6(totalIncome * INCOME_SALARY_WEIGHT),
    sideHustle: round6(totalIncome * INCOME_SIDE_HUSTLE_WEIGHT),
    passive: round6(totalIncome * INCOME_PASSIVE_WEIGHT),
    allowance: round6(totalIncome * INCOME_ALLOWANCE_WEIGHT),
  };
}

function computeCollaborativeBonusMultiplier(collaborativePlays: number): number {
  if (collaborativePlays >= 20) return FAMILY_COLLAB_BONUS_PERFECT;
  if (collaborativePlays >= 12) return FAMILY_COLLAB_BONUS_LARGE;
  if (collaborativePlays >= 6) return FAMILY_COLLAB_BONUS_MEDIUM;
  if (collaborativePlays >= 2) return FAMILY_COLLAB_BONUS_SMALL;
  return 1.0;
}

function computeDifficultyRating(state: HouseholdModeState): number {
  const budgetComponent = state.macro.budgetAllocations.some((a) => a.overrun) ? 0.8 : 0.3;
  const savingsComponent = state.macro.savingsRateHousehold > 0.15 ? 0.3 : 0.7;
  const debtComponent = state.macro.debtToIncomeRatio > 0.3 ? 0.8 : 0.3;
  const expenseComponent = state.macro.expenseShocks.filter((s) => !s.covered).length > 0 ? 0.7 : 0.2;
  const familyComponent = state.macro.familyCohesionScore > 60 ? 0.3 : 0.7;
  const investmentComponent = state.macro.investments.length > 0 ? 0.3 : 0.5;

  return round6(
    budgetComponent * DIFFICULTY_BUDGET_WEIGHT +
    savingsComponent * DIFFICULTY_SAVINGS_WEIGHT +
    debtComponent * DIFFICULTY_DEBT_WEIGHT +
    expenseComponent * DIFFICULTY_EXPENSE_WEIGHT +
    familyComponent * DIFFICULTY_FAMILY_WEIGHT +
    investmentComponent * DIFFICULTY_INVESTMENT_WEIGHT,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 4 — HOUSEHOLD BUDGET ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * HouseholdBudgetEngine: Central engine for managing household budget
 * allocation, tracking expenses against budget, and computing overruns.
 * Educates family members on the 50/30/20 rule and needs vs wants.
 */
export class HouseholdBudgetEngine {
  private readonly runId: string;
  private readonly rng: DeterministicRng;
  private allocations: BudgetAllocation[];
  private totalIncome: number;
  private overrunHistory: Array<{ tick: number; category: BudgetCategoryKey; amount: number }>;
  private balancedTickCount: number;

  public constructor(runId: string, seed: number, totalIncome: number) {
    this.runId = runId;
    const normalizedSeed = normalizeSeed(seed);
    this.rng = createDeterministicRng(normalizedSeed);
    this.totalIncome = totalIncome;
    this.allocations = getDefaultBudgetAllocations(totalIncome);
    this.overrunHistory = [];
    this.balancedTickCount = 0;
  }

  /**
   * Get the current budget allocations.
   */
  public getAllocations(): readonly BudgetAllocation[] {
    return this.allocations;
  }

  /**
   * Get the total income tracked by this engine.
   */
  public getTotalIncome(): number {
    return this.totalIncome;
  }

  /**
   * Get overrun history.
   */
  public getOverrunHistory(): readonly { tick: number; category: BudgetCategoryKey; amount: number }[] {
    return this.overrunHistory;
  }

  /**
   * Get the number of balanced ticks.
   */
  public getBalancedTickCount(): number {
    return this.balancedTickCount;
  }

  /**
   * Update income and recompute budget allocations.
   */
  public updateIncome(newIncome: number): void {
    this.totalIncome = newIncome;
    this.allocations = this.allocations.map((a) => ({
      ...a,
      budgetedAmount: Math.round(newIncome * a.allocatedPct),
    }));
  }

  /**
   * Record spending in a given category for a tick.
   */
  public recordSpending(tick: number, category: BudgetCategoryKey, amount: number): BudgetAllocation {
    const idx = this.allocations.findIndex((a) => a.category === category);
    if (idx < 0) {
      throw new Error(`Unknown budget category: ${category}`);
    }

    const current = this.allocations[idx];
    const newSpent = current.actualSpent + amount;
    const overrun = newSpent > current.budgetedAmount;
    const prevSpent = current.actualSpent;
    const trend: BudgetAllocation['trend'] =
      amount > prevSpent / Math.max(1, tick) ? 'INCREASING'
      : amount < prevSpent / Math.max(1, tick) * 0.8 ? 'DECREASING'
      : 'STABLE';

    const updated: BudgetAllocation = {
      ...current,
      actualSpent: newSpent,
      overrun,
      trend,
    };

    if (overrun) {
      this.overrunHistory.push({ tick, category, amount: newSpent - current.budgetedAmount });
    }

    this.allocations = [
      ...this.allocations.slice(0, idx),
      updated,
      ...this.allocations.slice(idx + 1),
    ];

    return updated;
  }

  /**
   * Process end-of-tick budget reconciliation.
   */
  public reconcileTick(tick: number): {
    balanced: boolean;
    totalSpent: number;
    totalBudgeted: number;
    overrunCategories: BudgetCategoryKey[];
  } {
    const totalSpent = this.allocations.reduce((s, a) => s + a.actualSpent, 0);
    const totalBudgeted = this.allocations.reduce((s, a) => s + a.budgetedAmount, 0);
    const overrunCategories = this.allocations
      .filter((a) => a.overrun)
      .map((a) => a.category);
    const balanced = overrunCategories.length === 0;

    if (balanced) {
      this.balancedTickCount++;
    }

    return { balanced, totalSpent, totalBudgeted, overrunCategories };
  }

  /**
   * Reset spending for a new tick cycle.
   */
  public resetSpending(): void {
    this.allocations = this.allocations.map((a) => ({
      ...a,
      actualSpent: 0,
      overrun: false,
    }));
  }

  /**
   * Adjust allocation percentages.
   */
  public adjustAllocation(category: BudgetCategoryKey, newPct: number): void {
    const idx = this.allocations.findIndex((a) => a.category === category);
    if (idx < 0) return;

    this.allocations = [
      ...this.allocations.slice(0, idx),
      {
        ...this.allocations[idx],
        allocatedPct: clamp(newPct, 0, 1),
        budgetedAmount: Math.round(this.totalIncome * clamp(newPct, 0, 1)),
      },
      ...this.allocations.slice(idx + 1),
    ];
  }

  /**
   * Compute budget adherence score (0-100).
   */
  public computeAdherenceScore(): number {
    const total = this.allocations.length;
    if (total === 0) return 100;
    const underBudget = this.allocations.filter((a) => !a.overrun).length;
    return round6((underBudget / total) * 100);
  }

  /**
   * Generate a budget summary for analytics.
   */
  public buildBudgetAnalytics(): HouseholdBudgetAnalytics {
    const totalExpenses = this.allocations.reduce((s, a) => s + a.actualSpent, 0);
    const netBalance = this.totalIncome - totalExpenses;
    const savingsRate = this.totalIncome > 0 ? round6(netBalance / this.totalIncome) : 0;
    const overrunCategories = this.allocations.filter((a) => a.overrun).map((a) => a.category);

    return {
      totalIncome: this.totalIncome,
      totalExpenses,
      netBalance,
      savingsRate,
      debtToIncome: 0,
      budgetAdherenceAvg: this.computeAdherenceScore(),
      overrunCategories,
      healthScore: round6(this.computeAdherenceScore() * 0.01 * 100),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 5 — SAVINGS GOAL TRACKER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SavingsGoalTracker: Tracks multiple family savings goals, computes progress,
 * projects completion dates, and manages contributions from family members.
 */
export class SavingsGoalTracker {
  private readonly runId: string;
  private goals: SavingsGoal[];
  private contributionHistory: Array<{
    tick: number;
    goalId: string;
    contributorId: string;
    amount: number;
  }>;
  private streakLength: number;
  private lastContributionTick: number;

  public constructor(runId: string) {
    this.runId = runId;
    this.goals = [];
    this.contributionHistory = [];
    this.streakLength = 0;
    this.lastContributionTick = -1;
  }

  /**
   * Get all goals.
   */
  public getGoals(): readonly SavingsGoal[] {
    return this.goals;
  }

  /**
   * Get the contribution history.
   */
  public getContributionHistory(): readonly {
    tick: number;
    goalId: string;
    contributorId: string;
    amount: number;
  }[] {
    return this.contributionHistory;
  }

  /**
   * Get the current streak.
   */
  public getStreakLength(): number {
    return this.streakLength;
  }

  /**
   * Add a new savings goal.
   */
  public addGoal(input: {
    goalId: string;
    type: SavingsGoalType;
    label: string;
    targetAmount: number;
    startedAtTick: number;
    targetTick: number;
    contributorsIds: readonly string[];
    priority: number;
  }): SavingsGoal {
    const goal: SavingsGoal = {
      goalId: input.goalId,
      type: input.type,
      label: input.label,
      targetAmount: input.targetAmount,
      currentAmount: 0,
      startedAtTick: input.startedAtTick,
      targetTick: input.targetTick,
      completed: false,
      contributorsIds: input.contributorsIds,
      priority: input.priority,
    };
    this.goals.push(goal);
    return goal;
  }

  /**
   * Record a contribution to a goal.
   */
  public contribute(tick: number, goalId: string, contributorId: string, amount: number): SavingsGoal | null {
    const idx = this.goals.findIndex((g) => g.goalId === goalId);
    if (idx < 0) return null;

    const goal = this.goals[idx];
    if (goal.completed) return goal;

    const newAmount = Math.min(goal.currentAmount + amount, goal.targetAmount);
    const completed = newAmount >= goal.targetAmount;
    const multiplier = computeSavingsGoalMultiplier(goal.type);

    this.contributionHistory.push({ tick, goalId, contributorId, amount: round6(amount * multiplier) });

    if (tick === this.lastContributionTick + 1 || this.lastContributionTick < 0) {
      this.streakLength++;
    } else if (tick > this.lastContributionTick + 1) {
      this.streakLength = 1;
    }
    this.lastContributionTick = tick;

    const updated: SavingsGoal = {
      ...goal,
      currentAmount: round6(newAmount),
      completed,
    };

    this.goals = [
      ...this.goals.slice(0, idx),
      updated,
      ...this.goals.slice(idx + 1),
    ];

    return updated;
  }

  /**
   * Compute progress for a specific goal.
   */
  public computeGoalProgress(goalId: string): number {
    const goal = this.goals.find((g) => g.goalId === goalId);
    if (!goal || goal.targetAmount <= 0) return 0;
    return round6(goal.currentAmount / goal.targetAmount);
  }

  /**
   * Compute overall savings progress across all goals.
   */
  public computeOverallProgress(): number {
    if (this.goals.length === 0) return 0;
    const totalProgress = this.goals.reduce((s, g) => {
      const progress = g.targetAmount > 0 ? g.currentAmount / g.targetAmount : 0;
      return s + Math.min(progress, 1);
    }, 0);
    return round6(totalProgress / this.goals.length);
  }

  /**
   * Project when a goal will be completed based on current contribution rate.
   */
  public projectCompletionTick(goalId: string, currentTick: number): number {
    const goal = this.goals.find((g) => g.goalId === goalId);
    if (!goal || goal.completed) return currentTick;
    if (goal.currentAmount >= goal.targetAmount) return currentTick;

    const contributions = this.contributionHistory.filter((c) => c.goalId === goalId);
    if (contributions.length === 0) return goal.targetTick;

    const totalContributed = contributions.reduce((s, c) => s + c.amount, 0);
    const ticksElapsed = currentTick - goal.startedAtTick;
    const ratePerTick = ticksElapsed > 0 ? totalContributed / ticksElapsed : 0;
    if (ratePerTick <= 0) return goal.targetTick;

    const remaining = goal.targetAmount - goal.currentAmount;
    return currentTick + Math.ceil(remaining / ratePerTick);
  }

  /**
   * Build savings analytics report.
   */
  public buildSavingsAnalytics(currentTick: number): HouseholdSavingsAnalytics {
    const totalSaved = this.goals.reduce((s, g) => s + g.currentAmount, 0);
    const goalsCompleted = this.goals.filter((g) => g.completed).length;
    const goalsInProgress = this.goals.filter((g) => !g.completed).length;
    const averageProgress = this.computeOverallProgress();
    const progresses = this.goals.map((g) =>
      g.targetAmount > 0 ? g.currentAmount / g.targetAmount : 0,
    );
    const bestGoalProgress = progresses.length > 0 ? round6(Math.max(...progresses)) : 0;
    const worstGoalProgress = progresses.length > 0 ? round6(Math.min(...progresses)) : 0;

    const projections = this.goals
      .filter((g) => !g.completed)
      .map((g) => this.projectCompletionTick(g.goalId, currentTick));
    const projectedCompletionTick = projections.length > 0 ? Math.max(...projections) : currentTick;

    return {
      totalSaved: round6(totalSaved),
      goalsCompleted,
      goalsInProgress,
      averageProgress,
      bestGoalProgress,
      worstGoalProgress,
      projectedCompletionTick,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 6 — DEBT MANAGEMENT ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * DebtManagementEngine: Educational engine for teaching debt payoff strategies.
 * Supports Avalanche (highest interest first), Snowball (smallest balance first),
 * Minimum payment, and Consolidation approaches.
 */
export class DebtManagementEngine {
  private readonly runId: string;
  private debts: DebtEntry[];
  private paymentHistory: Array<{
    tick: number;
    debtId: string;
    amount: number;
    strategy: DebtStrategy;
    remainingAfter: number;
  }>;
  private totalPaidOff: number;

  public constructor(runId: string) {
    this.runId = runId;
    this.debts = [];
    this.paymentHistory = [];
    this.totalPaidOff = 0;
  }

  /**
   * Get all debts.
   */
  public getDebts(): readonly DebtEntry[] {
    return this.debts;
  }

  /**
   * Get payment history.
   */
  public getPaymentHistory(): readonly {
    tick: number;
    debtId: string;
    amount: number;
    strategy: DebtStrategy;
    remainingAfter: number;
  }[] {
    return this.paymentHistory;
  }

  /**
   * Get total amount paid off.
   */
  public getTotalPaidOff(): number {
    return this.totalPaidOff;
  }

  /**
   * Add a new debt entry.
   */
  public addDebt(input: {
    debtId: string;
    holderId: string;
    label: string;
    principal: number;
    interestRate: number;
    minimumPayment: number;
    issuedTick: number;
    strategy: DebtStrategy;
  }): DebtEntry {
    const debt: DebtEntry = {
      debtId: input.debtId,
      holderId: input.holderId,
      label: input.label,
      principal: input.principal,
      remainingBalance: input.principal,
      interestRate: input.interestRate,
      minimumPayment: input.minimumPayment,
      issuedTick: input.issuedTick,
      strategy: input.strategy,
    };
    this.debts.push(debt);
    return debt;
  }

  /**
   * Make a payment on a specific debt.
   */
  public makePayment(tick: number, debtId: string, amount: number): DebtEntry | null {
    const idx = this.debts.findIndex((d) => d.debtId === debtId);
    if (idx < 0) return null;

    const debt = this.debts[idx];
    const weight = computeDebtStrategyWeight(debt.strategy);
    const effectivePayment = round6(amount * weight);
    const newBalance = Math.max(0, debt.remainingBalance - effectivePayment);

    this.paymentHistory.push({
      tick,
      debtId,
      amount: effectivePayment,
      strategy: debt.strategy,
      remainingAfter: newBalance,
    });
    this.totalPaidOff += effectivePayment;

    const updated: DebtEntry = {
      ...debt,
      remainingBalance: round6(newBalance),
    };

    this.debts = [
      ...this.debts.slice(0, idx),
      updated,
      ...this.debts.slice(idx + 1),
    ];

    return updated;
  }

  /**
   * Apply interest accrual at end of tick.
   */
  public accrueInterest(tick: number): void {
    this.debts = this.debts.map((debt) => {
      if (debt.remainingBalance <= 0) return debt;
      const interest = round6(debt.remainingBalance * debt.interestRate / 12);
      return {
        ...debt,
        remainingBalance: round6(debt.remainingBalance + interest),
      };
    });
  }

  /**
   * Get the next recommended debt to pay using Avalanche strategy.
   */
  public getAvalancheTarget(): DebtEntry | null {
    const active = this.debts.filter((d) => d.remainingBalance > 0);
    if (active.length === 0) return null;
    return active.reduce((best, d) => d.interestRate > best.interestRate ? d : best);
  }

  /**
   * Get the next recommended debt to pay using Snowball strategy.
   */
  public getSnowballTarget(): DebtEntry | null {
    const active = this.debts.filter((d) => d.remainingBalance > 0);
    if (active.length === 0) return null;
    return active.reduce((best, d) => d.remainingBalance < best.remainingBalance ? d : best);
  }

  /**
   * Compute total remaining debt.
   */
  public computeTotalDebt(): number {
    return round6(this.debts.reduce((s, d) => s + d.remainingBalance, 0));
  }

  /**
   * Compute average interest rate across all active debts.
   */
  public computeAverageInterestRate(): number {
    const active = this.debts.filter((d) => d.remainingBalance > 0);
    if (active.length === 0) return 0;
    return round6(active.reduce((s, d) => s + d.interestRate, 0) / active.length);
  }

  /**
   * Project the tick at which all debts will be paid off.
   */
  public projectDebtFreeTick(currentTick: number, monthlyPayment: number): number {
    if (monthlyPayment <= 0) return currentTick + 999;
    const totalDebt = this.computeTotalDebt();
    if (totalDebt <= 0) return currentTick;
    const avgRate = this.computeAverageInterestRate();
    const netPayment = monthlyPayment - totalDebt * avgRate / 12;
    if (netPayment <= 0) return currentTick + 999;
    return currentTick + Math.ceil(totalDebt / netPayment);
  }

  /**
   * Build debt analytics report.
   */
  public buildDebtAnalytics(currentTick: number, monthlyPayment: number): HouseholdDebtAnalytics {
    const strategyEffectiveness: Record<DebtStrategy, number> = {
      AVALANCHE: 0,
      SNOWBALL: 0,
      MINIMUM: 0,
      CONSOLIDATION: 0,
    };

    for (const entry of this.paymentHistory) {
      strategyEffectiveness[entry.strategy] += entry.amount;
    }

    return {
      totalDebt: this.computeTotalDebt(),
      totalPaidOff: round6(this.totalPaidOff),
      averageInterestRate: this.computeAverageInterestRate(),
      debtToIncomeRatio: 0,
      projectedDebtFreeTick: this.projectDebtFreeTick(currentTick, monthlyPayment),
      activeDebts: this.debts.filter((d) => d.remainingBalance > 0).length,
      strategyEffectiveness,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 7 — HOUSEHOLD CARD OVERLAY RESOLVER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * HouseholdCardOverlayResolver: Resolves card overlays for household mode,
 * applying age-appropriate simplification for younger players.
 * Uses CardRegistry for lookups and applies household-specific modifiers.
 */
export class HouseholdCardOverlayResolver {
  private readonly registry: CardRegistry;
  private readonly seed: number;
  private readonly rng: DeterministicRng;
  private readonly mulberry: () => number;
  private resolvedCount: number;

  public constructor(registry: CardRegistry, seed: number) {
    this.registry = registry;
    this.seed = seed;
    const normalizedSeed = normalizeSeed(seed);
    this.rng = createDeterministicRng(normalizedSeed);
    this.mulberry = createMulberry32(combineSeed(normalizedSeed, 'household_overlay'));
    this.resolvedCount = 0;
  }

  /**
   * Get the number of resolved overlays.
   */
  public getResolvedCount(): number {
    return this.resolvedCount;
  }

  /**
   * Resolve a card overlay for a given player age group.
   */
  public resolveOverlay(
    cardId: string,
    ageGroup: FamilyMemberAge,
    tick: number,
    pressure: number,
  ): CardOverlaySnapshot | null {
    let definition: CardDefinition | null = null;
    try {
      definition = this.registry.getOrThrow(cardId);
    } catch {
      return null;
    }

    const simplification = computeCardSimplificationLevel(ageGroup);
    const difficultyMultiplier = computeAgeDifficultyMultiplier(ageGroup);
    const pressureMod = computePressureCostModifier(
      pressure >= 80 ? PressureTier.T4_COLLAPSE_IMMINENT
      : pressure >= 60 ? PressureTier.T3_ELEVATED
      : pressure >= 40 ? PressureTier.T2_STRESSED
      : pressure >= 20 ? PressureTier.T1_STABLE
      : PressureTier.T0_SOVEREIGN,
    );

    // Use the mulberry PRNG for deterministic variance
    const variance = this.mulberry() * 0.1 - 0.05;

    // Compute effective cost modifier from age, pressure, and variance
    const baseCost = definition.baseCost ?? 0;
    const effectiveCostMod = round6(difficultyMultiplier * pressureMod * (1 + variance));

    // Compute effect modifier from simplification level
    const baseEffect = definition.effects.length > 0 ? definition.effects[0].magnitude : 0;
    const effectivEffectMod = round6(simplification * (1 + baseEffect * 0.001));

    const overlay: CardOverlaySnapshot = {
      costModifier: effectiveCostMod,
      effectModifier: effectivEffectMod,
      timingLock: definition.timingClasses.length > 0
        ? [definition.timingClasses[0]]
        : [TimingClass.ANY],
      legal: true,
      cordWeight: round6(baseCost * simplification * 0.01),
    };

    this.resolvedCount++;
    return overlay;
  }

  /**
   * Resolve overlays for all cards in a player's hand.
   */
  public resolveHandOverlays(
    cardIds: readonly string[],
    ageGroup: FamilyMemberAge,
    tick: number,
    pressure: number,
  ): readonly CardOverlaySnapshot[] {
    const overlays: CardOverlaySnapshot[] = [];
    for (const cardId of cardIds) {
      const overlay = this.resolveOverlay(cardId, ageGroup, tick, pressure);
      if (overlay) {
        overlays.push(overlay);
      }
    }
    return overlays;
  }

  /**
   * Check if a deck type is relevant for household mode.
   */
  public isDeckRelevant(deckType: DeckType): boolean {
    return isDeckLegalInMode(deckType, HOUSEHOLD_BASE_MODE);
  }

  /**
   * Compute tag-weighted score for household context.
   */
  public computeHouseholdTagScore(tags: readonly CardTag[]): number {
    return computeTagWeightedScore(tags, HOUSEHOLD_BASE_MODE);
  }

  /**
   * Get the household mode behavior from card_types.
   */
  public getModeBehavior() {
    return getModeCardBehavior(HOUSEHOLD_BASE_MODE);
  }

  /**
   * Compute bleedthrough multiplier for a pressure tier.
   */
  public computeBleedthrough(pressureTier: PressureTier, isCritical: boolean): number {
    return computeBleedthroughMultiplier(pressureTier, isCritical);
  }

  /**
   * Get trust efficiency for a given trust score.
   */
  public computeTrust(trustScore: number) {
    return computeTrustEfficiency(trustScore);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 8 — FAMILY MEMBER ROLE ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * FamilyMemberRoleEngine: Manages the parent/teen/child role mechanics.
 * Parents have full financial powers, teens have guided access,
 * and children have simplified interactions with learning objectives.
 */
export class FamilyMemberRoleEngine {
  private readonly runId: string;
  private readonly members: Map<string, {
    playerId: string;
    role: HouseholdRole;
    ageGroup: FamilyMemberAge;
    permissions: readonly string[];
    learningObjectives: readonly string[];
    completedObjectives: string[];
  }>;

  public constructor(runId: string) {
    this.runId = runId;
    this.members = new Map();
  }

  /**
   * Register a family member.
   */
  public registerMember(input: {
    playerId: string;
    role: HouseholdRole;
    ageGroup: FamilyMemberAge;
  }): void {
    const permissions = this.resolvePermissions(input.ageGroup);
    const learningObjectives = this.resolveLearningObjectives(input.ageGroup);

    this.members.set(input.playerId, {
      playerId: input.playerId,
      role: input.role,
      ageGroup: input.ageGroup,
      permissions,
      learningObjectives,
      completedObjectives: [],
    });
  }

  /**
   * Check if a member has a specific permission.
   */
  public hasPermission(playerId: string, permission: string): boolean {
    const member = this.members.get(playerId);
    if (!member) return false;
    return member.permissions.includes(permission);
  }

  /**
   * Complete a learning objective for a member.
   */
  public completeObjective(playerId: string, objective: string): boolean {
    const member = this.members.get(playerId);
    if (!member) return false;
    if (!member.learningObjectives.includes(objective)) return false;
    if (member.completedObjectives.includes(objective)) return false;

    member.completedObjectives.push(objective);
    return true;
  }

  /**
   * Get the completion rate for a member's learning objectives.
   */
  public getObjectiveCompletionRate(playerId: string): number {
    const member = this.members.get(playerId);
    if (!member || member.learningObjectives.length === 0) return 0;
    return round6(member.completedObjectives.length / member.learningObjectives.length);
  }

  /**
   * Get all members.
   */
  public getMembers(): ReadonlyMap<string, {
    playerId: string;
    role: HouseholdRole;
    ageGroup: FamilyMemberAge;
    permissions: readonly string[];
    learningObjectives: readonly string[];
    completedObjectives: string[];
  }> {
    return this.members;
  }

  /**
   * Compute the financial literacy score for a member.
   */
  public computeLiteracyScore(playerId: string): number {
    const completionRate = this.getObjectiveCompletionRate(playerId);
    const member = this.members.get(playerId);
    if (!member) return 0;
    const ageBonus = member.ageGroup === 'PARENT' ? 20 : member.ageGroup === 'TEEN' ? 10 : 0;
    return round6(completionRate * 80 + ageBonus);
  }

  /**
   * Resolve permissions based on age group.
   */
  private resolvePermissions(ageGroup: FamilyMemberAge): readonly string[] {
    switch (ageGroup) {
      case 'PARENT':
        return [
          'budget_manage', 'invest', 'borrow', 'insure',
          'set_goals', 'approve_spending', 'view_all', 'transfer',
          'debt_manage', 'emergency_fund',
        ];
      case 'TEEN':
        return [
          'budget_view', 'save', 'view_own', 'suggest_spending',
          'contribute_goal', 'track_expenses', 'view_investments',
        ];
      case 'CHILD':
        return [
          'view_simple', 'save_piggybank', 'learn',
          'earn_allowance', 'set_simple_goal',
        ];
    }
  }

  /**
   * Resolve learning objectives based on age group.
   */
  private resolveLearningObjectives(ageGroup: FamilyMemberAge): readonly string[] {
    switch (ageGroup) {
      case 'PARENT':
        return [
          'create_family_budget', 'establish_emergency_fund',
          'optimize_debt_strategy', 'review_insurance_coverage',
          'start_investment_portfolio', 'teach_child_about_money',
          'conduct_family_meeting', 'set_retirement_goal',
        ];
      case 'TEEN':
        return [
          'understand_budgeting', 'open_savings_account',
          'track_personal_expenses', 'learn_about_interest',
          'understand_credit', 'set_personal_savings_goal',
          'learn_about_investing', 'understand_insurance',
        ];
      case 'CHILD':
        return [
          'learn_coins_and_bills', 'understand_needs_vs_wants',
          'save_for_a_toy', 'count_change',
          'understand_earning', 'learn_sharing',
        ];
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 9 — HOUSEHOLD MILESTONE TRACKER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * HouseholdMilestoneTracker: Tracks financial literacy milestones and
 * achievement badges for the household. Each milestone represents a
 * key financial concept that the family has demonstrated understanding of.
 */
export class HouseholdMilestoneTracker {
  private readonly runId: string;
  private milestones: Map<FinancialLiteracyMilestone, {
    unlocked: boolean;
    unlockedAtTick: number | null;
    unlockedBy: string | null;
  }>;
  private badges: Map<HouseholdBadge, {
    unlocked: boolean;
    progress: number;
  }>;

  public constructor(runId: string) {
    this.runId = runId;
    this.milestones = new Map();
    this.badges = new Map();

    // Initialize all milestones
    const allMilestones: FinancialLiteracyMilestone[] = [
      'FIRST_BUDGET', 'SAVINGS_STREAK', 'DEBT_FREE',
      'EMERGENCY_FUND_BUILT', 'FIRST_INVESTMENT', 'INSURANCE_COVERED',
      'BUDGET_BALANCED', 'ALL_GOALS_SET', 'FAMILY_MEETING_HELD',
      'EXPENSE_TRACKED',
    ];
    for (const ms of allMilestones) {
      this.milestones.set(ms, { unlocked: false, unlockedAtTick: null, unlockedBy: null });
    }

    // Initialize all badges
    const allBadges: HouseholdBadge[] = [
      'BUDGET_MASTER', 'SAVINGS_CHAMPION', 'DEBT_CRUSHER',
      'FAMILY_TEAMWORK', 'FINANCIAL_GURU',
    ];
    for (const badge of allBadges) {
      this.badges.set(badge, { unlocked: false, progress: 0 });
    }
  }

  /**
   * Unlock a financial literacy milestone.
   */
  public unlockMilestone(
    milestone: FinancialLiteracyMilestone,
    tick: number,
    playerId: string,
  ): boolean {
    const entry = this.milestones.get(milestone);
    if (!entry || entry.unlocked) return false;

    this.milestones.set(milestone, {
      unlocked: true,
      unlockedAtTick: tick,
      unlockedBy: playerId,
    });
    return true;
  }

  /**
   * Check if a milestone is unlocked.
   */
  public isMilestoneUnlocked(milestone: FinancialLiteracyMilestone): boolean {
    return this.milestones.get(milestone)?.unlocked ?? false;
  }

  /**
   * Get all unlocked milestones.
   */
  public getUnlockedMilestones(): readonly FinancialLiteracyMilestone[] {
    const unlocked: FinancialLiteracyMilestone[] = [];
    for (const [ms, entry] of this.milestones) {
      if (entry.unlocked) unlocked.push(ms);
    }
    return unlocked;
  }

  /**
   * Get total unlocked milestone count.
   */
  public getUnlockedCount(): number {
    return this.getUnlockedMilestones().length;
  }

  /**
   * Update badge progress based on current state.
   */
  public updateBadges(input: {
    balancedTickCount: number;
    overrunCount: number;
    savingsRate: number;
    savingsStreakTicks: number;
    totalDebt: number;
    currentTick: number;
    collaborativePlays: number;
    averageTrustScore: number;
    allMilestonesUnlocked: boolean;
  }): void {
    // Budget Master
    const budgetMasterProgress = round6(
      Math.min(input.balancedTickCount / BUDGET_MASTER_MIN_BALANCED_TICKS, 1) * 0.7 +
      (input.overrunCount <= BUDGET_MASTER_MAX_OVERRUN_COUNT ? 0.3 : 0),
    );
    const budgetMasterUnlocked = input.balancedTickCount >= BUDGET_MASTER_MIN_BALANCED_TICKS
      && input.overrunCount <= BUDGET_MASTER_MAX_OVERRUN_COUNT;
    this.badges.set('BUDGET_MASTER', { unlocked: budgetMasterUnlocked, progress: budgetMasterProgress });

    // Savings Champion
    const savingsChampionProgress = round6(
      Math.min(input.savingsRate / SAVINGS_CHAMPION_MIN_RATE, 1) * 0.5 +
      Math.min(input.savingsStreakTicks / SAVINGS_CHAMPION_MIN_TICKS, 1) * 0.5,
    );
    const savingsChampionUnlocked = input.savingsRate >= SAVINGS_CHAMPION_MIN_RATE
      && input.savingsStreakTicks >= SAVINGS_CHAMPION_MIN_TICKS;
    this.badges.set('SAVINGS_CHAMPION', { unlocked: savingsChampionUnlocked, progress: savingsChampionProgress });

    // Debt Crusher
    const debtCrusherProgress = round6(
      input.totalDebt <= MILESTONE_DEBT_FREE_THRESHOLD && input.currentTick <= DEBT_CRUSHER_ZERO_DEBT_BY_TICK
        ? 1.0
        : Math.min(input.currentTick / DEBT_CRUSHER_ZERO_DEBT_BY_TICK, 1) * 0.5,
    );
    const debtCrusherUnlocked = input.totalDebt <= MILESTONE_DEBT_FREE_THRESHOLD
      && input.currentTick <= DEBT_CRUSHER_ZERO_DEBT_BY_TICK;
    this.badges.set('DEBT_CRUSHER', { unlocked: debtCrusherUnlocked, progress: debtCrusherProgress });

    // Family Teamwork
    const teamworkProgress = round6(
      Math.min(input.collaborativePlays / FAMILY_TEAMWORK_MIN_COLLABORATIVE_PLAYS, 1) * 0.5 +
      Math.min(input.averageTrustScore / FAMILY_TEAMWORK_MIN_TRUST_AVERAGE, 1) * 0.5,
    );
    const teamworkUnlocked = input.collaborativePlays >= FAMILY_TEAMWORK_MIN_COLLABORATIVE_PLAYS
      && input.averageTrustScore >= FAMILY_TEAMWORK_MIN_TRUST_AVERAGE;
    this.badges.set('FAMILY_TEAMWORK', { unlocked: teamworkUnlocked, progress: teamworkProgress });

    // Financial Guru — all milestones must be unlocked
    const guruProgress = round6(this.getUnlockedCount() / this.milestones.size);
    const guruUnlocked = input.allMilestonesUnlocked && FINANCIAL_GURU_ALL_MILESTONES_UNLOCKED;
    this.badges.set('FINANCIAL_GURU', { unlocked: guruUnlocked, progress: guruProgress });
  }

  /**
   * Get the full badge tracker state.
   */
  public getState(): HouseholdBadgeTrackerState {
    return {
      budgetMaster: this.badges.get('BUDGET_MASTER') ?? { unlocked: false, progress: 0 },
      savingsChampion: this.badges.get('SAVINGS_CHAMPION') ?? { unlocked: false, progress: 0 },
      debtCrusher: this.badges.get('DEBT_CRUSHER') ?? { unlocked: false, progress: 0 },
      familyTeamwork: this.badges.get('FAMILY_TEAMWORK') ?? { unlocked: false, progress: 0 },
      financialGuru: this.badges.get('FINANCIAL_GURU') ?? { unlocked: false, progress: 0 },
    };
  }

  /**
   * Check milestone triggers based on game state.
   */
  public checkTriggers(input: {
    tick: number;
    playerId: string;
    hasBudget: boolean;
    savingsStreakLength: number;
    totalDebt: number;
    emergencyFundMonths: number;
    hasInvestment: boolean;
    insuranceCoverage: number;
    budgetBalanced: boolean;
    allGoalsSet: boolean;
    familyMeetingHeld: boolean;
    expenseTracked: boolean;
  }): readonly FinancialLiteracyMilestone[] {
    const newlyUnlocked: FinancialLiteracyMilestone[] = [];

    if (input.hasBudget && input.tick >= MILESTONE_FIRST_BUDGET_TICK) {
      if (this.unlockMilestone('FIRST_BUDGET', input.tick, input.playerId)) {
        newlyUnlocked.push('FIRST_BUDGET');
      }
    }

    if (input.savingsStreakLength >= MILESTONE_SAVINGS_STREAK_LENGTH) {
      if (this.unlockMilestone('SAVINGS_STREAK', input.tick, input.playerId)) {
        newlyUnlocked.push('SAVINGS_STREAK');
      }
    }

    if (input.totalDebt <= MILESTONE_DEBT_FREE_THRESHOLD) {
      if (this.unlockMilestone('DEBT_FREE', input.tick, input.playerId)) {
        newlyUnlocked.push('DEBT_FREE');
      }
    }

    if (input.emergencyFundMonths >= MILESTONE_EMERGENCY_FUND_MONTHS) {
      if (this.unlockMilestone('EMERGENCY_FUND_BUILT', input.tick, input.playerId)) {
        newlyUnlocked.push('EMERGENCY_FUND_BUILT');
      }
    }

    if (input.hasInvestment) {
      if (this.unlockMilestone('FIRST_INVESTMENT', input.tick, input.playerId)) {
        newlyUnlocked.push('FIRST_INVESTMENT');
      }
    }

    if (input.insuranceCoverage >= MILESTONE_INSURANCE_COVERAGE_PCT) {
      if (this.unlockMilestone('INSURANCE_COVERED', input.tick, input.playerId)) {
        newlyUnlocked.push('INSURANCE_COVERED');
      }
    }

    if (input.budgetBalanced) {
      if (this.unlockMilestone('BUDGET_BALANCED', input.tick, input.playerId)) {
        newlyUnlocked.push('BUDGET_BALANCED');
      }
    }

    if (input.allGoalsSet) {
      if (this.unlockMilestone('ALL_GOALS_SET', input.tick, input.playerId)) {
        newlyUnlocked.push('ALL_GOALS_SET');
      }
    }

    if (input.familyMeetingHeld) {
      if (this.unlockMilestone('FAMILY_MEETING_HELD', input.tick, input.playerId)) {
        newlyUnlocked.push('FAMILY_MEETING_HELD');
      }
    }

    if (input.expenseTracked) {
      if (this.unlockMilestone('EXPENSE_TRACKED', input.tick, input.playerId)) {
        newlyUnlocked.push('EXPENSE_TRACKED');
      }
    }

    return newlyUnlocked;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 10 — HOUSEHOLD CHAT BRIDGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * HouseholdChatBridge: Generates chat events for the Household mode focused
 * on family encouragement, financial tips, budget alerts, and milestone
 * celebrations.
 */
export class HouseholdChatBridge {
  private readonly runId: string;
  private readonly events: HouseholdChatBridgeEvent[];
  private tipIndex: number;

  public constructor(runId: string) {
    this.runId = runId;
    this.events = [];
    this.tipIndex = 0;
  }

  /**
   * Get all events.
   */
  public getEvents(): readonly HouseholdChatBridgeEvent[] {
    return this.events;
  }

  /**
   * Get events by priority.
   */
  public getEventsByPriority(priority: 'HIGH' | 'MEDIUM' | 'LOW'): readonly HouseholdChatBridgeEvent[] {
    return this.events.filter((e) => e.priority === priority);
  }

  /**
   * Emit a budget tip event.
   */
  public emitBudgetTip(
    tick: number,
    tipCategory: FinancialTipCategory,
    tipText: string,
    currentTimeMs: number,
  ): HouseholdChatBridgeEvent {
    const event: HouseholdChatBridgeEvent = {
      eventType: CHAT_EVENT_BUDGET_TIP,
      tick,
      runId: this.runId,
      payload: {
        tipCategory,
        tipText,
        tipIndex: this.tipIndex++,
        category: tipCategory,
      },
      priority: 'LOW',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  /**
   * Emit a savings milestone event.
   */
  public emitSavingsMilestone(
    tick: number,
    goalId: string,
    goalType: SavingsGoalType,
    progress: number,
    currentTimeMs: number,
  ): HouseholdChatBridgeEvent {
    const event: HouseholdChatBridgeEvent = {
      eventType: CHAT_EVENT_SAVINGS_MILESTONE,
      tick,
      runId: this.runId,
      payload: {
        goalId,
        goalType,
        progress: round6(progress),
        milestone: progress >= 1 ? 'COMPLETED' : progress >= 0.5 ? 'HALFWAY' : 'STARTED',
      },
      priority: progress >= 1 ? 'HIGH' : 'MEDIUM',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  /**
   * Emit a debt warning event.
   */
  public emitDebtWarning(
    tick: number,
    totalDebt: number,
    debtToIncome: number,
    currentTimeMs: number,
  ): HouseholdChatBridgeEvent {
    const event: HouseholdChatBridgeEvent = {
      eventType: CHAT_EVENT_DEBT_WARNING,
      tick,
      runId: this.runId,
      payload: {
        totalDebt,
        debtToIncome: round6(debtToIncome),
        severity: debtToIncome > 0.5 ? 'CRITICAL' : debtToIncome > 0.3 ? 'WARNING' : 'INFO',
      },
      priority: debtToIncome > 0.5 ? 'HIGH' : 'MEDIUM',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  /**
   * Emit a family encouragement event.
   */
  public emitFamilyEncouragement(
    tick: number,
    memberName: string,
    achievement: string,
    currentTimeMs: number,
  ): HouseholdChatBridgeEvent {
    const event: HouseholdChatBridgeEvent = {
      eventType: CHAT_EVENT_FAMILY_ENCOURAGEMENT,
      tick,
      runId: this.runId,
      payload: {
        memberName,
        achievement,
        encouragement: `Great job, ${memberName}! ${achievement}`,
      },
      priority: 'MEDIUM',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  /**
   * Emit a literacy badge event.
   */
  public emitLiteracyBadge(
    tick: number,
    milestone: FinancialLiteracyMilestone,
    playerId: string,
    currentTimeMs: number,
  ): HouseholdChatBridgeEvent {
    const event: HouseholdChatBridgeEvent = {
      eventType: CHAT_EVENT_LITERACY_BADGE,
      tick,
      runId: this.runId,
      payload: {
        milestone,
        playerId,
        badgeType: 'FINANCIAL_LITERACY',
      },
      priority: 'HIGH',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  /**
   * Emit a goal progress event.
   */
  public emitGoalProgress(
    tick: number,
    goalId: string,
    goalType: SavingsGoalType,
    progress: number,
    projectedTick: number,
    currentTimeMs: number,
  ): HouseholdChatBridgeEvent {
    const event: HouseholdChatBridgeEvent = {
      eventType: CHAT_EVENT_GOAL_PROGRESS,
      tick,
      runId: this.runId,
      payload: {
        goalId,
        goalType,
        progress: round6(progress),
        projectedCompletionTick: projectedTick,
        onTrack: projectedTick <= tick + 20,
      },
      priority: progress >= 0.9 ? 'HIGH' : 'LOW',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  /**
   * Emit a budget overrun event.
   */
  public emitBudgetOverrun(
    tick: number,
    category: BudgetCategoryKey,
    overrunAmount: number,
    currentTimeMs: number,
  ): HouseholdChatBridgeEvent {
    const event: HouseholdChatBridgeEvent = {
      eventType: CHAT_EVENT_BUDGET_OVERRUN,
      tick,
      runId: this.runId,
      payload: {
        category,
        overrunAmount: round6(overrunAmount),
        tip: `Consider reducing ${category.toLowerCase()} spending next period.`,
      },
      priority: overrunAmount > 1000 ? 'HIGH' : 'MEDIUM',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  /**
   * Emit an investment hint event.
   */
  public emitInvestmentHint(
    tick: number,
    investmentType: InvestmentType,
    expectedReturn: number,
    currentTimeMs: number,
  ): HouseholdChatBridgeEvent {
    const event: HouseholdChatBridgeEvent = {
      eventType: CHAT_EVENT_INVESTMENT_HINT,
      tick,
      runId: this.runId,
      payload: {
        investmentType,
        expectedReturn: round6(expectedReturn),
        riskLevel: investmentType === 'INDIVIDUAL_STOCK' ? 'HIGH'
          : investmentType === 'INDEX_FUND' ? 'MEDIUM'
          : 'LOW',
      },
      priority: 'LOW',
      emittedAtMs: currentTimeMs,
    };
    this.events.push(event);
    return event;
  }

  /**
   * Generate a financial tip based on current state.
   */
  public generateTip(
    tick: number,
    savingsRate: number,
    debtToIncome: number,
    pressure: number,
    currentTimeMs: number,
  ): HouseholdChatBridgeEvent {
    let category: FinancialTipCategory;
    let text: string;

    if (debtToIncome > 0.4) {
      category = TIP_CATEGORY_DEBT;
      text = 'Focus on paying down high-interest debt first using the Avalanche method.';
    } else if (savingsRate < 0.10) {
      category = TIP_CATEGORY_SAVING;
      text = 'Try to save at least 10% of your income. Start small and increase gradually.';
    } else if (pressure > 60) {
      category = TIP_CATEGORY_EMERGENCY;
      text = 'Build an emergency fund covering 3-6 months of expenses for peace of mind.';
    } else if (savingsRate >= 0.20) {
      category = TIP_CATEGORY_INVESTING;
      text = 'With a healthy savings rate, consider starting with low-cost index funds.';
    } else {
      category = TIP_CATEGORY_BUDGETING;
      text = 'Review your budget monthly. Track where every dollar goes to find savings.';
    }

    return this.emitBudgetTip(tick, category, text, currentTimeMs);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 11 — HOUSEHOLD ANALYTICS ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * HouseholdAnalyticsEngine: Comprehensive analytics engine that aggregates
 * data from all household subsystems into a complete analytics report.
 */
export class HouseholdAnalyticsEngine {
  private readonly state: HouseholdModeState;
  private readonly budgetEngine: HouseholdBudgetEngine;
  private readonly savingsTracker: SavingsGoalTracker;
  private readonly debtEngine: DebtManagementEngine;
  private readonly milestoneTracker: HouseholdMilestoneTracker;
  private readonly chatBridge: HouseholdChatBridge;

  public constructor(
    state: HouseholdModeState,
    budgetEngine: HouseholdBudgetEngine,
    savingsTracker: SavingsGoalTracker,
    debtEngine: DebtManagementEngine,
    milestoneTracker: HouseholdMilestoneTracker,
    chatBridge: HouseholdChatBridge,
  ) {
    this.state = state;
    this.budgetEngine = budgetEngine;
    this.savingsTracker = savingsTracker;
    this.debtEngine = debtEngine;
    this.milestoneTracker = milestoneTracker;
    this.chatBridge = chatBridge;
  }

  /**
   * Compute budget analytics.
   */
  public computeBudgetAnalytics(): HouseholdBudgetAnalytics {
    const analytics = this.budgetEngine.buildBudgetAnalytics();
    return {
      ...analytics,
      debtToIncome: this.state.macro.debtToIncomeRatio,
    };
  }

  /**
   * Compute savings analytics.
   */
  public computeSavingsAnalytics(): HouseholdSavingsAnalytics {
    return this.savingsTracker.buildSavingsAnalytics(this.state.macro.tick);
  }

  /**
   * Compute debt analytics.
   */
  public computeDebtAnalytics(): HouseholdDebtAnalytics {
    const monthlyPayment = this.state.macro.totalHouseholdIncome * 0.15;
    return this.debtEngine.buildDebtAnalytics(this.state.macro.tick, monthlyPayment);
  }

  /**
   * Compute family analytics.
   */
  public computeFamilyAnalytics(): HouseholdFamilyAnalytics {
    const players = this.state.players;
    const memberCount = players.length;
    const averageTrustScore = memberCount > 0
      ? round6(players.reduce((s, p) => s + p.trustScore, 0) / memberCount)
      : 0;
    const collaborativePlayCount = players.reduce((s, p) => s + p.collaborativePlays, 0);
    const totalMilestonesUnlocked = players.reduce((s, p) => s + p.milestonesUnlocked.length, 0);
    const averageLiteracyScore = memberCount > 0
      ? round6(players.reduce((s, p) => s + p.financialLiteracyScore, 0) / memberCount)
      : 0;

    const roleDistribution: Record<HouseholdRole, number> = {
      STEWARD: 0, DEALMAKER: 0, GUARDIAN: 0, STRATEGIST: 0,
    };
    const ageDistribution: Record<FamilyMemberAge, number> = {
      CHILD: 0, TEEN: 0, PARENT: 0,
    };
    for (const p of players) {
      roleDistribution[p.role]++;
      ageDistribution[p.ageGroup]++;
    }

    return {
      memberCount,
      averageTrustScore,
      familyCohesionScore: this.state.macro.familyCohesionScore,
      collaborativePlayCount,
      totalMilestonesUnlocked,
      averageLiteracyScore,
      roleDistribution,
      ageDistribution,
    };
  }

  /**
   * Compute mode health diagnostics.
   */
  public computeModeHealth(): HouseholdModeHealth {
    const seedNum = hashStringToSeed(this.state.seed);
    const normalizedSeedNum = normalizeSeed(seedNum);
    const _fallbackSeed = DEFAULT_NON_ZERO_SEED;
    const _hashCheck = sha256Hex(stableStringify({ runId: this.state.runId }));

    return {
      modeVersion: HOUSEHOLD_MODE_VERSION,
      engineIntegrity: true,
      seedDeterminismVerified: normalizedSeedNum > 0,
      totalRunsProcessed: 1,
      averageDifficultyRating: computeDifficultyRating(this.state),
      averageCompletionRate: this.state.macro.financialHealthScore > 50 ? 1 : 0,
      medianFinancialHealth: this.state.macro.financialHealthScore,
      diagnosticTimestampMs: this.state.macro.currentTimeMs,
    };
  }

  /**
   * Build the complete analytics report.
   */
  public buildFullAnalytics(): HouseholdAnalytics {
    const budgetAnalytics = this.computeBudgetAnalytics();
    const savingsAnalytics = this.computeSavingsAnalytics();
    const debtAnalytics = this.computeDebtAnalytics();
    const familyAnalytics = this.computeFamilyAnalytics();
    const modeHealth = this.computeModeHealth();
    const proofBadgeTracker = this.milestoneTracker.getState();

    const outcome = adjudicateOutcome(this.state);

    let finalResult: HouseholdAnalytics['finalResult'] = null;
    if (this.state.macro.tick > 0) {
      finalResult = {
        outcome: outcome.outcome,
        tier: outcome.tier,
        financialHealthScore: this.state.macro.financialHealthScore,
        savingsAchieved: savingsAnalytics.totalSaved,
        debtRemaining: debtAnalytics.totalDebt,
      };
    }

    return {
      runId: this.state.runId,
      budgetAnalytics,
      savingsAnalytics,
      debtAnalytics,
      familyAnalytics,
      modeHealth,
      proofBadgeTracker,
      finalResult,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 12 — ML FEATURE EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract a 32-dimensional ML feature vector from a Household run.
 *
 * Feature layout:
 *  0: financialHealthScore (normalized 0-1)
 *  1: savingsRateHousehold
 *  2: debtToIncomeRatio
 *  3: budgetAdherenceAvg (normalized 0-1)
 *  4: familyCohesionScore (normalized 0-1)
 *  5: totalHouseholdIncome (log-scaled)
 *  6: totalHouseholdExpenses (log-scaled)
 *  7: monthlyBudgetBalance (normalized)
 *  8: totalSaved (log-scaled)
 *  9: totalDebt (log-scaled)
 * 10: averageTrustScore (normalized 0-1)
 * 11: pressureLevel (normalized 0-1)
 * 12: shieldsAvg (normalized 0-1)
 * 13: milestonesUnlocked (ratio)
 * 14: collaborativePlaysTotal
 * 15: memberCount
 * 16: childCount
 * 17: teenCount
 * 18: parentCount
 * 19: savingsGoalProgress (average)
 * 20: goalsCompleted
 * 21: activeDebts
 * 22: insuranceCoverage (ratio)
 * 23: investmentCount
 * 24: investmentValue (log-scaled)
 * 25: expenseShockCount
 * 26: uncoveredShockCount
 * 27: savingsStreakLength
 * 28: budgetMasterBadge (0/1)
 * 29: savingsChampionBadge (0/1)
 * 30: debtCrusherBadge (0/1)
 * 31: familyTeamworkBadge (0/1)
 */
export function extractHouseholdMLFeatures(
  state: HouseholdModeState,
  milestoneTracker: HouseholdMilestoneTracker,
  savingsTracker: SavingsGoalTracker,
): HouseholdMLFeatureVector {
  const players = state.players;
  const macro = state.macro;
  const memberCount = players.length;
  const avgTrust = memberCount > 0 ? players.reduce((s, p) => s + p.trustScore, 0) / memberCount : 0;
  const avgShields = memberCount > 0 ? players.reduce((s, p) => s + p.shields, 0) / memberCount : 0;
  const totalCollabPlays = players.reduce((s, p) => s + p.collaborativePlays, 0);
  const totalMilestones = players.reduce((s, p) => s + p.milestonesUnlocked.length, 0);
  const childCount = players.filter((p) => p.ageGroup === 'CHILD').length;
  const teenCount = players.filter((p) => p.ageGroup === 'TEEN').length;
  const parentCount = players.filter((p) => p.ageGroup === 'PARENT').length;
  const badgeState = milestoneTracker.getState();
  const savingsProgress = savingsTracker.computeOverallProgress();
  const goalsCompleted = macro.savingsGoals.filter((g) => g.completed).length;
  const activeDebts = macro.debts.filter((d) => d.remainingBalance > 0).length;
  const insuranceCoverage = macro.insurances.filter((i) => i.active).length / Math.max(1, macro.insurances.length);
  const investmentCount = macro.investments.length;
  const investmentValue = macro.investments.reduce((s, i) => s + i.currentValue, 0);
  const expenseShockCount = macro.expenseShocks.length;
  const uncoveredShockCount = macro.expenseShocks.filter((s) => !s.covered).length;
  const totalSaved = players.reduce((s, p) => s + p.totalSaved, 0);
  const totalDebt = macro.debts.reduce((s, d) => s + d.remainingBalance, 0);
  const savingsStreakLength = savingsTracker.getStreakLength();

  const logScale = (v: number) => round6(Math.log1p(Math.abs(v)));

  const features: number[] = [
    round6(macro.financialHealthScore / 100),                   // 0
    round6(macro.savingsRateHousehold),                         // 1
    round6(macro.debtToIncomeRatio),                            // 2
    round6(macro.budgetAllocations.filter((a) => !a.overrun).length / Math.max(1, macro.budgetAllocations.length)), // 3
    round6(macro.familyCohesionScore / 100),                    // 4
    logScale(macro.totalHouseholdIncome),                       // 5
    logScale(macro.totalHouseholdExpenses),                     // 6
    round6(clamp(macro.monthlyBudgetBalance / Math.max(1, macro.totalHouseholdIncome), -1, 1)), // 7
    logScale(totalSaved),                                       // 8
    logScale(totalDebt),                                        // 9
    round6(avgTrust / 100),                                     // 10
    round6(macro.pressure / 100),                               // 11
    round6(avgShields / 100),                                   // 12
    round6(totalMilestones / 10),                               // 13
    totalCollabPlays,                                           // 14
    memberCount,                                                // 15
    childCount,                                                 // 16
    teenCount,                                                  // 17
    parentCount,                                                // 18
    round6(savingsProgress),                                    // 19
    goalsCompleted,                                             // 20
    activeDebts,                                                // 21
    round6(insuranceCoverage),                                  // 22
    investmentCount,                                            // 23
    logScale(investmentValue),                                  // 24
    expenseShockCount,                                          // 25
    uncoveredShockCount,                                        // 26
    savingsStreakLength,                                        // 27
    badgeState.budgetMaster.unlocked ? 1 : 0,                  // 28
    badgeState.savingsChampion.unlocked ? 1 : 0,               // 29
    badgeState.debtCrusher.unlocked ? 1 : 0,                   // 30
    badgeState.familyTeamwork.unlocked ? 1 : 0,                // 31
  ];

  const labels: string[] = [
    'financialHealthScore', 'savingsRate', 'debtToIncomeRatio', 'budgetAdherence',
    'familyCohesion', 'householdIncome', 'householdExpenses', 'budgetBalance',
    'totalSaved', 'totalDebt', 'averageTrust', 'pressureLevel',
    'averageShields', 'milestonesUnlocked', 'collaborativePlays', 'memberCount',
    'childCount', 'teenCount', 'parentCount', 'savingsGoalProgress',
    'goalsCompleted', 'activeDebts', 'insuranceCoverage', 'investmentCount',
    'investmentValue', 'expenseShockCount', 'uncoveredShockCount', 'savingsStreak',
    'budgetMasterBadge', 'savingsChampionBadge', 'debtCrusherBadge', 'familyTeamworkBadge',
  ];

  return {
    dimension: HOUSEHOLD_ML_FEATURE_DIM,
    features,
    labels,
    runId: state.runId,
    extractedAtTick: macro.tick,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 13 — DL TENSOR EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract a 24×8 DL tensor from a Household run.
 *
 * Rows (24): Budget windows — each row represents a tick window for
 *   financial pattern analysis. 24 rows cover the major budget cycles.
 *
 * Columns (8):
 *   0: savings rate (normalized 0-1)
 *   1: debt level (normalized 0-1)
 *   2: expense ratio (normalized 0-1)
 *   3: income stability (normalized 0-1)
 *   4: budget adherence (normalized 0-1)
 *   5: family trust (normalized 0-1)
 *   6: pressure (normalized 0-1)
 *   7: financial health (normalized 0-1)
 */
export function extractHouseholdDLTensor(
  state: HouseholdModeState,
  eventHistory: readonly HouseholdEvent[],
): HouseholdDLTensor {
  const data: number[][] = [];
  const totalTicks = Math.max(1, state.macro.tick);

  for (let row = 0; row < HOUSEHOLD_DL_ROWS; row++) {
    const cols: number[] = new Array(HOUSEHOLD_DL_COLS).fill(0);
    const targetTick = Math.round(row * (totalTicks / Math.max(1, HOUSEHOLD_DL_ROWS - 1)));

    // Filter events up to this target tick
    const eventsUpToTick = eventHistory.filter((e) => e.tick <= targetTick);
    const tickEvents = eventHistory.filter((e) => e.tick === targetTick);

    // Col 0: savings rate trend
    const savingsEvents = eventsUpToTick.filter((e) => e.detail.includes('savings') || e.detail.includes('save'));
    cols[0] = round6(clamp(savingsEvents.length / Math.max(1, eventsUpToTick.length), 0, 1));

    // Col 1: debt level trend
    const debtEvents = eventsUpToTick.filter((e) => e.detail.includes('loan') || e.detail.includes('debt'));
    cols[1] = round6(clamp(debtEvents.length / Math.max(1, eventsUpToTick.length), 0, 1));

    // Col 2: expense ratio
    cols[2] = round6(clamp(
      state.macro.totalHouseholdExpenses / Math.max(1, state.macro.totalHouseholdIncome),
      0, 1,
    ));

    // Col 3: income stability (fewer income disruption events = more stable)
    const incomeDisruptions = eventsUpToTick.filter((e) => e.detail.includes('income'));
    cols[3] = round6(clamp(1 - incomeDisruptions.length / Math.max(1, totalTicks), 0, 1));

    // Col 4: budget adherence
    const overrunEvents = eventsUpToTick.filter((e) => e.detail.includes('overrun'));
    cols[4] = round6(clamp(1 - overrunEvents.length / Math.max(1, eventsUpToTick.length), 0, 1));

    // Col 5: family trust (use average trust, normalized)
    const avgTrust = state.players.length > 0
      ? state.players.reduce((s, p) => s + p.trustScore, 0) / state.players.length
      : 50;
    cols[5] = round6(clamp(avgTrust / 100, 0, 1));

    // Col 6: pressure (normalized)
    cols[6] = round6(clamp(state.macro.pressure / 100, 0, 1));

    // Col 7: financial health (normalized)
    cols[7] = round6(clamp(state.macro.financialHealthScore / 100, 0, 1));

    data.push(cols);
  }

  return {
    rows: HOUSEHOLD_DL_ROWS,
    cols: HOUSEHOLD_DL_COLS,
    data,
    runId: state.runId,
    extractedAtTick: state.macro.tick,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 14 — ADJUDICATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Adjudicate the outcome and tier of a household run based on
 * financial health, savings, debt, and family cohesion metrics.
 */
function adjudicateOutcome(state: HouseholdModeState): {
  outcome: HouseholdOutcome;
  tier: HouseholdResultTier;
  bonusMultiplier: number;
  badges: readonly HouseholdBadge[];
} {
  const healthScore = state.macro.financialHealthScore;
  const savingsRate = state.macro.savingsRateHousehold;
  const debtRatio = state.macro.debtToIncomeRatio;
  const cohesion = state.macro.familyCohesionScore;

  let outcome: HouseholdOutcome;
  let tier: HouseholdResultTier;
  let bonusMultiplier: number;
  const badges: HouseholdBadge[] = [];

  if (healthScore >= 80 && savingsRate >= 0.20 && debtRatio < 0.15 && cohesion >= 70) {
    outcome = 'PROSPERITY';
    tier = 'FLOURISHING';
    bonusMultiplier = 2.0;
    badges.push('BUDGET_MASTER', 'SAVINGS_CHAMPION');
  } else if (healthScore >= 60 && savingsRate >= 0.10 && debtRatio < 0.30) {
    outcome = 'STABILITY';
    tier = 'THRIVING';
    bonusMultiplier = 1.5;
    badges.push('BUDGET_MASTER');
  } else if (healthScore >= 40 && debtRatio < 0.50) {
    outcome = 'HARDSHIP';
    tier = 'STABLE';
    bonusMultiplier = 1.2;
  } else {
    outcome = 'CRISIS';
    tier = 'STRUGGLING';
    bonusMultiplier = 1.0;
  }

  return { outcome, tier, bonusMultiplier, badges };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 15 — STATE MUTATION FUNCTIONS (original reducer)
// ═══════════════════════════════════════════════════════════════════════════════

function applyBailOut(state: HouseholdModeState, action: BailOutAction): HouseholdModeState {
  if (action.actorId === action.targetId) {
    throw new Error('Bailout actor and target must differ.');
  }
  if (action.amount <= 0) {
    throw new Error('Bailout amount must be greater than zero.');
  }

  const actor = byPlayerId(state.players, action.actorId);
  const _target = byPlayerId(state.players, action.targetId);

  if (actor.cash < action.amount) {
    throw new Error('Bailout actor has insufficient cash.');
  }

  let nextState = mutatePlayer(state, actor.playerId, (player) => ({
    ...player,
    cash: player.cash - action.amount,
    trustScore: clamp(
      player.trustScore + (action.stringsAttached ? 3 : 8),
      0,
      100,
    ),
    bailoutsGiven: player.bailoutsGiven + 1,
    collaborativePlays: player.collaborativePlays + 1,
  }));

  nextState = mutatePlayer(nextState, action.targetId, (player) => ({
    ...player,
    cash: player.cash + action.amount,
    pressure: clamp(player.pressure - Math.round(action.amount / 500), 0, 100),
    trustScore: clamp(
      player.trustScore + (action.stringsAttached ? -2 : 5),
      0,
      100,
    ),
    bailoutsReceived: player.bailoutsReceived + 1,
    collaborativePlays: player.collaborativePlays + 1,
  }));

  return appendEvent(
    refreshMacro(nextState),
    action.type,
    action.actorId,
    action.targetId,
    action.amount,
    action.stringsAttached ? 'bailout_with_strings' : 'bailout_clean',
  );
}

function applySyndicateDeal(
  state: HouseholdModeState,
  action: SyndicateDealAction,
): HouseholdModeState {
  if (action.partnerIds.length === 0) {
    throw new Error('Syndicate deal requires at least one partner.');
  }
  if (action.treasuryContribution <= 0 || action.expectedYield <= 0) {
    throw new Error('Syndicate deal amounts must be greater than zero.');
  }
  if (state.macro.treasury < action.treasuryContribution) {
    throw new Error('Insufficient treasury for syndicate deal.');
  }

  const participants = new Set([action.actorId, ...action.partnerIds]);
  const yieldPerParticipant = Math.floor(action.expectedYield / participants.size);
  const collabBonus = computeCollaborativeBonusMultiplier(participants.size);

  let nextState: HouseholdModeState = {
    ...state,
    macro: {
      ...state.macro,
      treasury: state.macro.treasury - action.treasuryContribution + action.expectedYield,
    },
  };

  for (const participantId of participants) {
    nextState = mutatePlayer(nextState, participantId, (player) => ({
      ...player,
      cash: player.cash + Math.round(yieldPerParticipant * collabBonus),
      income: player.income + Math.max(1, Math.floor(yieldPerParticipant / 20)),
      trustScore: clamp(player.trustScore + 6, 0, 100),
      syndicatesClosed: player.syndicatesClosed + 1,
      collaborativePlays: player.collaborativePlays + 1,
    }));
  }

  return appendEvent(
    refreshMacro(nextState),
    action.type,
    action.actorId,
    null,
    action.expectedYield,
    `syndicate:${[...participants].join(',')}`,
  );
}

function applyTreasuryLoan(
  state: HouseholdModeState,
  action: TreasuryLoanAction,
): HouseholdModeState {
  if (action.amount <= 0 || action.dueTickOffset < 1) {
    throw new Error('Treasury loan values are invalid.');
  }
  if (state.macro.treasury < action.amount) {
    throw new Error('Insufficient treasury for loan.');
  }

  const loan: HouseholdLoan = {
    loanId: `${action.actorId}:${state.macro.tick}:${state.macro.loans.length + 1}`,
    borrowerId: action.actorId,
    principal: action.amount,
    issuedTick: state.macro.tick,
    dueTick: state.macro.tick + action.dueTickOffset,
    repaid: false,
    interestRate: 0.10,
    loanType: 'treasury',
  };

  let nextState: HouseholdModeState = {
    ...state,
    macro: {
      ...state.macro,
      treasury: state.macro.treasury - action.amount,
      loans: [...state.macro.loans, loan],
    },
  };

  nextState = mutatePlayer(nextState, action.actorId, (player) => ({
    ...player,
    cash: player.cash + action.amount,
    liabilities: player.liabilities + Math.ceil(action.amount * 1.1),
    trustScore: clamp(player.trustScore - 1, 0, 100),
  }));

  return appendEvent(
    refreshMacro(nextState),
    action.type,
    action.actorId,
    null,
    action.amount,
    `loan_due_tick:${loan.dueTick}`,
  );
}

function applyLoanRepayment(
  state: HouseholdModeState,
  action: RepayLoanAction,
): HouseholdModeState {
  const loan = state.macro.loans.find(
    (entry) => entry.loanId === action.loanId && !entry.repaid,
  );
  if (!loan) {
    throw new Error('Loan not found or already repaid.');
  }
  if (loan.borrowerId !== action.actorId) {
    throw new Error('Loan borrower mismatch.');
  }

  const repaymentAmount = Math.ceil(loan.principal * 1.1);
  const borrower = byPlayerId(state.players, action.actorId);
  if (borrower.cash < repaymentAmount) {
    throw new Error('Insufficient cash for loan repayment.');
  }

  let nextState: HouseholdModeState = {
    ...state,
    macro: {
      ...state.macro,
      treasury: state.macro.treasury + repaymentAmount,
      loans: state.macro.loans.map((entry) =>
        entry.loanId === action.loanId ? { ...entry, repaid: true } : entry,
      ),
    },
  };

  nextState = mutatePlayer(nextState, action.actorId, (player) => ({
    ...player,
    cash: player.cash - repaymentAmount,
    liabilities: Math.max(player.liabilities - repaymentAmount, 0),
    trustScore: clamp(player.trustScore + 4, 0, 100),
    totalDebtPaid: player.totalDebtPaid + repaymentAmount,
  }));

  return appendEvent(
    refreshMacro(nextState),
    action.type,
    action.actorId,
    null,
    repaymentAmount,
    `repaid:${action.loanId}`,
  );
}

function applyCascadeAbsorb(
  state: HouseholdModeState,
  action: CascadeAbsorbAction,
): HouseholdModeState {
  if (action.actorId === action.targetId) {
    throw new Error('Cascade absorber and target must differ.');
  }

  let nextState = mutatePlayer(state, action.actorId, (player) => ({
    ...player,
    shields: clamp(player.shields - action.shieldCost, 0, 100),
    pressure: clamp(player.pressure + Math.ceil(action.shieldCost / 4), 0, 100),
    trustScore: clamp(player.trustScore + 10, 0, 100),
    cascadeAbsorptions: player.cascadeAbsorptions + 1,
    collaborativePlays: player.collaborativePlays + 1,
  }));

  nextState = mutatePlayer(nextState, action.targetId, (player) => ({
    ...player,
    pressure: clamp(player.pressure - action.pressureReduction, 0, 100),
    trustScore: clamp(player.trustScore + 5, 0, 100),
    collaborativePlays: player.collaborativePlays + 1,
  }));

  return appendEvent(
    refreshMacro(nextState),
    action.type,
    action.actorId,
    action.targetId,
    action.shieldCost,
    `pressure_reduction:${action.pressureReduction}`,
  );
}

function applyDefection(state: HouseholdModeState, action: DefectAction): HouseholdModeState {
  if (state.macro.tick < 8) {
    throw new Error('Defection is not legal before tick 8.');
  }
  if (state.macro.defectionOccurred) {
    throw new Error('Only one defection is allowed per household run.');
  }

  const theft = Math.floor(state.macro.treasury * 0.4);

  let nextState: HouseholdModeState = {
    ...state,
    macro: {
      ...state.macro,
      treasury: state.macro.treasury - theft,
      defectionOccurred: true,
    },
  };

  nextState = mutatePlayer(nextState, action.actorId, (player) => ({
    ...player,
    cash: player.cash + theft,
    trustScore: 0,
    defected: true,
  }));

  for (const player of nextState.players) {
    if (player.playerId === action.actorId) {
      continue;
    }
    nextState = mutatePlayer(nextState, player.playerId, (entry) => ({
      ...entry,
      trustScore: clamp(entry.trustScore - 18, 0, 100),
      pressure: clamp(entry.pressure + 15, 0, 100),
    }));
  }

  return appendEvent(
    refreshMacro(nextState),
    action.type,
    action.actorId,
    null,
    theft,
    'defection_40pct_treasury',
  );
}

function applySabotagePolicy(
  state: HouseholdModeState,
  action: SabotagePolicyAction,
): HouseholdModeState {
  let nextState: HouseholdModeState = {
    ...state,
    macro: {
      ...state.macro,
      treasury: Math.max(state.macro.treasury + action.treasuryDelta, 0),
      pressure: clamp(state.macro.pressure + action.pressureDelta, 0, 100),
      activePolicies: [...state.macro.activePolicies, action.label],
    },
  };

  nextState = mutatePlayer(nextState, action.actorId, (player) => ({
    ...player,
    sabotageEvents: player.sabotageEvents + 1,
    trustScore: clamp(player.trustScore - (state.macro.hardMode ? 18 : 10), 0, 100),
  }));

  return appendEvent(
    refreshMacro(nextState),
    action.type,
    action.actorId,
    null,
    action.treasuryDelta,
    `policy:${action.label}:pressure:${action.pressureDelta}`,
  );
}

function applyProofShare(
  state: HouseholdModeState,
  action: ProofShareAction,
): HouseholdModeState {
  const nextState = mutatePlayer(state, action.actorId, (player) => ({
    ...player,
    trustScore: clamp(player.trustScore + 2, 0, 100),
    lastProofShareTick: state.macro.tick,
    collaborativePlays: player.collaborativePlays + 1,
  }));

  return appendEvent(
    refreshMacro(nextState),
    action.type,
    action.actorId,
    null,
    null,
    'proof_share',
  );
}

function applyAidRequest(
  state: HouseholdModeState,
  action: AidRequestAction,
): HouseholdModeState {
  const nextState = mutatePlayer(state, action.actorId, (player) => ({
    ...player,
    aidRequests: player.aidRequests + 1,
    pressure: clamp(player.pressure + 2, 0, 100),
  }));

  return appendEvent(
    refreshMacro(nextState),
    action.type,
    action.actorId,
    null,
    null,
    'aid_request',
  );
}

function applyTableEvent(
  state: HouseholdModeState,
  action: ApplyTableEventAction,
): HouseholdModeState {
  let nextState: HouseholdModeState = {
    ...state,
    macro: {
      ...state.macro,
      treasury: Math.max(state.macro.treasury + action.treasuryDelta, 0),
      pressure: clamp(state.macro.pressure + action.pressureDelta, 0, 100),
    },
  };

  nextState = mutatePlayer(nextState, action.actorId, (player) => ({
    ...player,
    trustScore: clamp(player.trustScore + 1, 0, 100),
  }));

  return appendEvent(
    refreshMacro(nextState),
    action.type,
    action.actorId,
    null,
    action.treasuryDelta,
    action.label,
  );
}

function applyTick(state: HouseholdModeState, action: AdvanceTickAction): HouseholdModeState {
  const tick = state.macro.tick + 1;
  const pressureDelta = action.incomingPressure ?? 0;
  const treasuryDelta = action.treasuryDelta ?? 0;
  const cashDelta = action.cashDelta ?? 0;
  const incomeDelta = action.incomeDelta ?? 0;
  const loans = state.macro.loans;

  // Process investment returns
  const updatedInvestments = state.macro.investments.map((inv) => {
    const tickReturn = inv.returnRate / 12;
    const growth = round6(inv.currentValue * tickReturn);
    return {
      ...inv,
      currentValue: round6(inv.currentValue + growth),
    };
  });

  // Process insurance premiums
  const insurancePremiums = state.macro.insurances
    .filter((i) => i.active)
    .reduce((s, i) => s + i.premiumPerTick, 0);

  let nextState: HouseholdModeState = {
    ...state,
    macro: {
      ...state.macro,
      tick,
      phase: nextPhase(tick),
      treasury: Math.max(state.macro.treasury + treasuryDelta - Math.round(insurancePremiums), 0),
      pressure: clamp(state.macro.pressure + pressureDelta, 0, 100),
      loans,
      investments: updatedInvestments,
    },
  };

  // Process overdue loans
  for (const loan of loans) {
    if (loan.repaid || loan.dueTick > tick) {
      continue;
    }
    nextState = mutatePlayer(nextState, loan.borrowerId, (player) => ({
      ...player,
      trustScore: clamp(player.trustScore - 8, 0, 100),
      pressure: clamp(player.pressure + 10, 0, 100),
    }));
    nextState = {
      ...nextState,
      macro: {
        ...nextState.macro,
        loans: nextState.macro.loans.map((entry) =>
          entry.loanId === loan.loanId ? { ...entry, repaid: true } : entry,
        ),
      },
    };
    nextState = appendEvent(
      nextState,
      'SYSTEM',
      null,
      loan.borrowerId,
      loan.principal,
      `loan_default:${loan.loanId}`,
    );
  }

  // Process per-player tick updates
  const players = nextState.players.map((player) => {
    const passiveIncome = player.defected ? 0 : player.income;
    const burn = Math.max(1, Math.ceil(player.liabilities / 20));
    const ageMultiplier = computeAgeDifficultyMultiplier(player.ageGroup);
    const adjustedBurn = Math.round(burn * ageMultiplier);
    const income = passiveIncome + (incomeDelta > 0 ? Math.round(incomeDelta / nextState.players.length) : 0);
    const cash = Math.max(player.cash + income - adjustedBurn + Math.round(cashDelta / nextState.players.length), 0);
    const savingsRate = income > 0 ? round6(Math.max(0, cash - player.cash) / income) : 0;

    return recalcNetWorth({
      ...player,
      cash,
      income: Math.max(0, player.income + Math.round(incomeDelta / nextState.players.length / 10)),
      pressure: clamp(
        player.pressure +
          (nextState.macro.pressure >= 70 ? 4 : 1) -
          Math.min(Math.floor(player.shields / 25), 3),
        0,
        100,
      ),
      aidRequests: 0,
      savingsRate: round6(Math.max(0, savingsRate)),
      totalSaved: player.totalSaved + Math.max(0, cash - player.cash),
    });
  });

  nextState = {
    ...nextState,
    players,
  };

  return refreshMacro(
    appendEvent(nextState, action.type, null, null, treasuryDelta, `pressure:${pressureDelta}`),
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 16 — BATCH SIMULATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simulate household runs in batch. Uses deterministic seed derivation
 * for each run, so results are reproducible.
 */
export function simulateHouseholdBatch(config: BatchSimulationConfig): BatchSimulationResult {
  const runCount = clamp(config.runCount, 1, BATCH_MAX_RUN_COUNT);
  const ticksPerRun = clamp(config.ticksPerRun, 1, 500);

  const baseSeedNum = hashStringToSeed(config.baseSeed);
  const summaries: BatchRunSummary[] = [];
  const healthScores: number[] = [];
  const savingsRates: number[] = [];
  const debtRemaining: number[] = [];
  const milestoneCounts: number[] = [];
  const collabPlayCounts: number[] = [];
  let prosperityCount = 0;

  for (let i = 0; i < runCount; i++) {
    const runSeed = combineSeed(baseSeedNum, i);
    const runSeedStr = `batch_${i}_${runSeed}`;
    const runId = stableId('household_batch', config.baseSeed, i);

    const memberCount = clamp(config.householdTemplate.memberCount, MIN_HOUSEHOLD_MEMBERS, MAX_HOUSEHOLD_MEMBERS);
    const playerInputs: Array<{
      playerId: string;
      displayName: string;
      role: HouseholdRole;
      ageGroup: FamilyMemberAge;
      cash: number;
      income: number;
      liabilities: number;
    }> = [];

    const roles: HouseholdRole[] = ['STEWARD', 'DEALMAKER', 'GUARDIAN', 'STRATEGIST'];
    const ages: FamilyMemberAge[] = ['PARENT', 'PARENT', 'TEEN', 'CHILD', 'CHILD', 'TEEN'];

    for (let m = 0; m < memberCount; m++) {
      playerInputs.push({
        playerId: `batch_member_${i}_${m}`,
        displayName: `Member ${m}`,
        role: roles[m % roles.length],
        ageGroup: ages[m % ages.length],
        cash: config.householdTemplate.startingCash,
        income: Math.round(config.householdTemplate.startingIncome / memberCount),
        liabilities: Math.round(config.householdTemplate.startingDebt / memberCount),
      });
    }

    const state = createInitialHouseholdModeState({
      runId,
      seed: runSeedStr,
      players: playerInputs,
      treasury: config.householdTemplate.startingCash * 2,
      hardMode: config.householdTemplate.difficultyMultiplier > 1,
    });

    const engine = new HouseholdModeEngine(state);
    const rng = createDeterministicRng(runSeed);

    let currentState = engine.getState();
    for (let t = 0; t < ticksPerRun; t++) {
      currentState = engine.dispatch({
        type: 'ADVANCE_TICK',
        cashDelta: rng.nextBetween(-200, 500),
        incomeDelta: rng.nextBetween(-50, 100),
        incomingPressure: rng.nextBetween(-2, 5),
      });

      // Simulate random bailouts
      if (rng.nextBoolean(0.1) && currentState.players.length >= 2) {
        const actorIdx = rng.nextInt(currentState.players.length);
        let targetIdx = rng.nextInt(currentState.players.length);
        if (targetIdx === actorIdx) targetIdx = (targetIdx + 1) % currentState.players.length;

        const actor = currentState.players[actorIdx];
        const amount = Math.min(actor.cash, rng.nextBetween(100, 1000));
        if (amount > 0) {
          try {
            currentState = engine.dispatch({
              type: 'BAIL_OUT',
              actorId: actor.playerId,
              targetId: currentState.players[targetIdx].playerId,
              amount,
              stringsAttached: rng.nextBoolean(0.3),
            });
          } catch {
            // Skip invalid bailouts
          }
        }
      }
    }

    const finalHealthScore = currentState.macro.financialHealthScore;
    const finalSavingsRate = currentState.macro.savingsRateHousehold;
    const finalDebtRemaining = currentState.macro.debts.reduce((s, d) => s + d.remainingBalance, 0);
    const totalMilestones = currentState.players.reduce((s, p) => s + p.milestonesUnlocked.length, 0);
    const totalCollabPlays = currentState.players.reduce((s, p) => s + p.collaborativePlays, 0);

    const result = adjudicateOutcome(currentState);
    if (result.outcome === 'PROSPERITY') prosperityCount++;

    healthScores.push(finalHealthScore);
    savingsRates.push(finalSavingsRate);
    debtRemaining.push(finalDebtRemaining);
    milestoneCounts.push(totalMilestones);
    collabPlayCounts.push(totalCollabPlays);

    summaries.push({
      runId,
      seed: runSeed,
      finalHealthScore: round6(finalHealthScore),
      totalSaved: round6(currentState.players.reduce((s, p) => s + p.totalSaved, 0)),
      debtRemaining: round6(finalDebtRemaining),
      outcome: result.outcome,
      tier: result.tier,
      savingsRate: round6(finalSavingsRate),
      milestonesUnlocked: totalMilestones,
    });
  }

  const sortedHealth = [...healthScores].sort((a, b) => a - b);
  const sortedSavings = [...savingsRates].sort((a, b) => a - b);

  const percentile = (arr: number[], p: number) => {
    const idx = Math.floor(arr.length * p);
    return arr[clamp(idx, 0, arr.length - 1)] ?? 0;
  };

  return {
    totalRuns: runCount,
    completedRuns: summaries.length,
    averageHealthScore: round6(healthScores.reduce((s, h) => s + h, 0) / healthScores.length),
    medianSavingsRate: round6(percentile(sortedSavings, 0.5)),
    averageDebtRemaining: round6(debtRemaining.reduce((s, d) => s + d, 0) / debtRemaining.length),
    prosperityRate: round6(prosperityCount / runCount),
    healthDistribution: {
      min: round6(sortedHealth[0] ?? 0),
      max: round6(sortedHealth[sortedHealth.length - 1] ?? 0),
      p25: round6(percentile(sortedHealth, 0.25)),
      p50: round6(percentile(sortedHealth, 0.5)),
      p75: round6(percentile(sortedHealth, 0.75)),
      p90: round6(percentile(sortedHealth, 0.9)),
    },
    averageMilestonesUnlocked: round6(milestoneCounts.reduce((s, m) => s + m, 0) / milestoneCounts.length),
    averageCollaborativePlays: round6(collabPlayCounts.reduce((s, c) => s + c, 0) / collabPlayCounts.length),
    runSummaries: summaries,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 17 — MAIN ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * HouseholdModeEngine: The primary engine class that holds state, dispatches
 * actions, and coordinates all subsystems. Uses CardRegistry for card
 * validation and overlay resolution.
 */
export class HouseholdModeEngine {
  private state: HouseholdModeState;
  private readonly registry: CardRegistry;
  private readonly budgetEngine: HouseholdBudgetEngine;
  private readonly savingsTracker: SavingsGoalTracker;
  private readonly debtEngine: DebtManagementEngine;
  private readonly milestoneTracker: HouseholdMilestoneTracker;
  private readonly chatBridge: HouseholdChatBridge;
  private readonly roleEngine: FamilyMemberRoleEngine;
  private overlayResolver: HouseholdCardOverlayResolver | null;

  public constructor(
    initialState: HouseholdModeState,
    registry: CardRegistry = new CardRegistry(),
  ) {
    if (initialState.players.length < MIN_HOUSEHOLD_MEMBERS || initialState.players.length > MAX_HOUSEHOLD_MEMBERS) {
      throw new Error(`Household mode supports ${MIN_HOUSEHOLD_MEMBERS} to ${MAX_HOUSEHOLD_MEMBERS} players.`);
    }

    this.registry = registry;
    this.state = refreshMacro(initialState);

    const seedNum = hashStringToSeed(initialState.seed);
    this.budgetEngine = new HouseholdBudgetEngine(
      initialState.runId,
      seedNum,
      initialState.players.reduce((s, p) => s + p.income, 0),
    );
    this.savingsTracker = new SavingsGoalTracker(initialState.runId);
    this.debtEngine = new DebtManagementEngine(initialState.runId);
    this.milestoneTracker = new HouseholdMilestoneTracker(initialState.runId);
    this.chatBridge = new HouseholdChatBridge(initialState.runId);
    this.roleEngine = new FamilyMemberRoleEngine(initialState.runId);
    this.overlayResolver = null;

    // Register all family members
    for (const player of initialState.players) {
      this.roleEngine.registerMember({
        playerId: player.playerId,
        role: player.role,
        ageGroup: player.ageGroup,
      });
    }
  }

  /**
   * Get the current state.
   */
  public getState(): HouseholdModeState {
    return this.state;
  }

  /**
   * Initialize the overlay resolver lazily.
   */
  public initializeOverlayResolver(): HouseholdCardOverlayResolver {
    if (!this.overlayResolver) {
      const seedNum = hashStringToSeed(this.state.seed);
      this.overlayResolver = new HouseholdCardOverlayResolver(this.registry, seedNum);
    }
    return this.overlayResolver;
  }

  /**
   * Dispatch an action and return the new state.
   */
  public dispatch(action: HouseholdModeAction): HouseholdModeState {
    switch (action.type) {
      case 'ADVANCE_TICK':
        this.state = applyTick(this.state, action);
        this.updateSubsystems();
        return this.state;
      case 'APPLY_TABLE_EVENT':
        this.state = applyTableEvent(this.state, action);
        this.updateSubsystems();
        return this.state;
      case 'BAIL_OUT':
        this.state = applyBailOut(this.state, action);
        this.updateSubsystems();
        return this.state;
      case 'SYNDICATE_DEAL':
        this.state = applySyndicateDeal(this.state, action);
        this.updateSubsystems();
        return this.state;
      case 'TREASURY_LOAN':
        this.state = applyTreasuryLoan(this.state, action);
        this.updateSubsystems();
        return this.state;
      case 'REPAY_LOAN':
        this.state = applyLoanRepayment(this.state, action);
        this.updateSubsystems();
        return this.state;
      case 'CASCADE_ABSORB':
        this.state = applyCascadeAbsorb(this.state, action);
        this.updateSubsystems();
        return this.state;
      case 'DEFECT':
        this.state = applyDefection(this.state, action);
        this.updateSubsystems();
        return this.state;
      case 'SABOTAGE_POLICY':
        this.state = applySabotagePolicy(this.state, action);
        this.updateSubsystems();
        return this.state;
      case 'PROOF_SHARE':
        this.state = applyProofShare(this.state, action);
        this.updateSubsystems();
        return this.state;
      case 'AID_REQUEST':
        this.state = applyAidRequest(this.state, action);
        this.updateSubsystems();
        return this.state;
      default: {
        const exhaustive: never = action;
        return exhaustive;
      }
    }
  }

  /**
   * Update all subsystems after state change.
   */
  private updateSubsystems(): void {
    // Update budget engine with current income
    const totalIncome = this.state.players.reduce((s, p) => s + p.income, 0);
    this.budgetEngine.updateIncome(totalIncome);

    // Update milestone tracker badges
    const avgTrust = this.state.players.length > 0
      ? this.state.players.reduce((s, p) => s + p.trustScore, 0) / this.state.players.length
      : 0;
    const totalCollabPlays = this.state.players.reduce((s, p) => s + p.collaborativePlays, 0);
    const totalDebt = this.state.macro.debts.reduce((s, d) => s + d.remainingBalance, 0);

    this.milestoneTracker.updateBadges({
      balancedTickCount: this.budgetEngine.getBalancedTickCount(),
      overrunCount: this.budgetEngine.getOverrunHistory().length,
      savingsRate: this.state.macro.savingsRateHousehold,
      savingsStreakTicks: this.savingsTracker.getStreakLength(),
      totalDebt,
      currentTick: this.state.macro.tick,
      collaborativePlays: totalCollabPlays,
      averageTrustScore: avgTrust,
      allMilestonesUnlocked: this.milestoneTracker.getUnlockedCount() >= 10,
    });
  }

  /**
   * Get the budget engine.
   */
  public getBudgetEngine(): HouseholdBudgetEngine {
    return this.budgetEngine;
  }

  /**
   * Get the savings tracker.
   */
  public getSavingsTracker(): SavingsGoalTracker {
    return this.savingsTracker;
  }

  /**
   * Get the debt engine.
   */
  public getDebtEngine(): DebtManagementEngine {
    return this.debtEngine;
  }

  /**
   * Get the milestone tracker.
   */
  public getMilestoneTracker(): HouseholdMilestoneTracker {
    return this.milestoneTracker;
  }

  /**
   * Get the chat bridge.
   */
  public getChatBridge(): HouseholdChatBridge {
    return this.chatBridge;
  }

  /**
   * Get the role engine.
   */
  public getRoleEngine(): FamilyMemberRoleEngine {
    return this.roleEngine;
  }

  /**
   * Build full analytics for the current state.
   */
  public buildAnalytics(): HouseholdAnalytics {
    const analyticsEngine = new HouseholdAnalyticsEngine(
      this.state,
      this.budgetEngine,
      this.savingsTracker,
      this.debtEngine,
      this.milestoneTracker,
      this.chatBridge,
    );
    return analyticsEngine.buildFullAnalytics();
  }

  /**
   * Extract ML features from the current state.
   */
  public extractMLFeatures(): HouseholdMLFeatureVector {
    return extractHouseholdMLFeatures(
      this.state,
      this.milestoneTracker,
      this.savingsTracker,
    );
  }

  /**
   * Extract DL tensor from the current state.
   */
  public extractDLTensor(): HouseholdDLTensor {
    return extractHouseholdDLTensor(this.state, this.state.macro.eventLog);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 18 — STATE FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create the initial household mode state from a configuration input.
 */
export function createInitialHouseholdModeState(input: {
  readonly runId: string;
  readonly seed: string;
  readonly players: ReadonlyArray<{
    readonly playerId: string;
    readonly displayName: string;
    readonly role: HouseholdRole;
    readonly ageGroup?: FamilyMemberAge;
    readonly cash: number;
    readonly income: number;
    readonly liabilities: number;
    readonly shields?: number;
  }>;
  readonly treasury: number;
  readonly hardMode?: boolean;
}): HouseholdModeState {
  return {
    runId: input.runId,
    seed: input.seed,
    players: input.players.map((player) =>
      recalcNetWorth({
        playerId: player.playerId,
        displayName: player.displayName,
        role: player.role,
        ageGroup: player.ageGroup ?? 'PARENT',
        cash: Math.max(player.cash, 0),
        income: Math.max(player.income, 0),
        liabilities: Math.max(player.liabilities, 0),
        netWorth: 0,
        pressure: 0,
        shields: clamp(player.shields ?? 60, 0, 100),
        trustScore: 50,
        aidRequests: 0,
        bailoutsGiven: 0,
        bailoutsReceived: 0,
        syndicatesClosed: 0,
        sabotageEvents: 0,
        cascadeAbsorptions: 0,
        defected: false,
        lastProofShareTick: null,
        savingsRate: 0,
        totalSaved: 0,
        totalDebtPaid: 0,
        collaborativePlays: 0,
        milestonesUnlocked: [],
        cardSimplificationLevel: computeCardSimplificationLevel(player.ageGroup ?? 'PARENT'),
        budgetAdherence: 100,
        financialLiteracyScore: 0,
      }),
    ),
    macro: {
      tick: 0,
      phase: 'FOUNDATION',
      treasury: Math.max(input.treasury, 0),
      pressure: 0,
      hardMode: Boolean(input.hardMode),
      warAlertActive: false,
      rescueWindowOpen: false,
      aidWindowOpen: false,
      synergyBonusActive: false,
      activePolicies: [],
      eventLog: [],
      loans: [],
      defectionOccurred: false,
      budgetAllocations: getDefaultBudgetAllocations(
        input.players.reduce((s, p) => s + p.income, 0),
      ),
      savingsGoals: [],
      debts: [],
      insurances: [],
      investments: [],
      expenseShocks: [],
      totalHouseholdIncome: input.players.reduce((s, p) => s + p.income, 0),
      totalHouseholdExpenses: 0,
      monthlyBudgetBalance: input.players.reduce((s, p) => s + p.income, 0),
      savingsRateHousehold: 0,
      debtToIncomeRatio: 0,
      financialHealthScore: 50,
      familyCohesionScore: 50,
      difficultyMultiplier: Boolean(input.hardMode) ? 1.5 : 1.0,
      currentTimeMs: Date.now(),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 19 — REPLAY & PROOF FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verify a household replay using ReplayEngine and event comparison.
 */
export function verifyHouseholdReplay(
  runId: string,
  events: readonly RunEvent[],
  expectedProofHash: string,
  expectedHealthScore: number,
): {
  verified: boolean;
  replayHash: string;
  healthDelta: number;
} {
  const seed = hashStringToSeed(runId);
  const engine = new ReplayEngine(seed, events);
  const replayHash = engine.getReplayHash();
  const snapshot = engine.replayAll();
  const _snapshotLedger = snapshot.ledger;
  const healthDelta = Math.abs(snapshot.ledger.cords - expectedHealthScore);

  return {
    verified: replayHash === expectedProofHash && healthDelta < 1,
    replayHash,
    healthDelta,
  };
}

/**
 * Create a Ledger snapshot from a household player state.
 */
export function householdPlayerToLedger(player: HouseholdPlayerState): Ledger {
  return createDefaultLedger({
    cash: player.cash,
    income: player.income,
    expenses: player.liabilities,
    shield: player.shields,
    cords: player.netWorth / 1000,
    trust: player.trustScore,
  });
}

/**
 * Compute the deterministic seed chain for a Household run.
 */
export function computeHouseholdSeedChain(baseSeed: string): {
  base: number;
  normalized: number;
  budget: number;
  savings: number;
  debt: number;
  investment: number;
  cardDraw: number;
} {
  const base = hashStringToSeed(baseSeed);
  const normalized = normalizeSeed(base);
  return {
    base,
    normalized,
    budget: combineSeed(normalized, 'household_budget'),
    savings: combineSeed(normalized, 'household_savings'),
    debt: combineSeed(normalized, 'household_debt'),
    investment: combineSeed(normalized, 'household_investment'),
    cardDraw: combineSeed(normalized, 'household_card_draw'),
  };
}

/**
 * Verify that seed determinism holds for a given seed string.
 */
export function verifyHouseholdSeedDeterminism(seedStr: string, sampleCount: number = 100): boolean {
  const seedNum = hashStringToSeed(seedStr);
  const normalized = normalizeSeed(seedNum);

  const rng1 = createDeterministicRng(normalized);
  const rng2 = createDeterministicRng(normalized);

  for (let i = 0; i < sampleCount; i++) {
    if (rng1.next() !== rng2.next()) return false;
  }

  const mul1 = createMulberry32(normalized);
  const mul2 = createMulberry32(normalized);
  for (let i = 0; i < sampleCount; i++) {
    if (mul1() !== mul2()) return false;
  }

  const fallbackRng = createDeterministicRng(DEFAULT_NON_ZERO_SEED);
  if (fallbackRng.seed !== DEFAULT_NON_ZERO_SEED) return false;

  return true;
}

/**
 * Compute a hash-based verification for a complete Household run.
 */
export function computeHouseholdRunProofHash(state: HouseholdModeState): string {
  const payload = stableStringify({
    runId: state.runId,
    seed: state.seed,
    tick: state.macro.tick,
    financialHealthScore: state.macro.financialHealthScore,
    savingsRate: state.macro.savingsRateHousehold,
    debtToIncome: state.macro.debtToIncomeRatio,
    memberCount: state.players.length,
    treasury: state.macro.treasury,
  });
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Use ReplayGameState for tick-by-tick consistency verification.
 */
export function verifyHouseholdTickConsistency(
  runId: string,
  events: readonly RunEvent[],
): ReplaySnapshot {
  const seed = hashStringToSeed(runId);
  const gameState = new ReplayGameState(seed);
  for (const event of events) {
    gameState.applyEvent(event);
  }
  return gameState.snapshot();
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 20 — CONVENIENCE EXPORT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute the full set of Household-legal decks using CARD_LEGALITY_MATRIX.
 */
export function getHouseholdLegalDecks(): readonly DeckType[] {
  return CARD_LEGALITY_MATRIX[HOUSEHOLD_BASE_MODE];
}

/**
 * Compute the Household mode card behavior profile.
 */
export function getHouseholdModeBehavior() {
  return getModeCardBehavior(HOUSEHOLD_BASE_MODE);
}

/**
 * Compute the Household mode tag weight defaults.
 */
export function getHouseholdTagWeights(): Readonly<Record<CardTag, number>> {
  return MODE_TAG_WEIGHT_DEFAULTS[HOUSEHOLD_BASE_MODE];
}

/**
 * Get the ghost marker specification for a given kind (for education).
 */
export function getHouseholdGhostMarkerSpec(kind: GhostMarkerKind) {
  return getGhostMarkerSpec(kind);
}

/**
 * Compute all ghost marker CORD bonuses (educational reference).
 */
export function computeAllHouseholdMarkerBonuses(): Record<string, { cordBonus: number; shieldBonus: number }> {
  const result: Record<string, { cordBonus: number; shieldBonus: number }> = {};
  const kinds = [
    GhostMarkerKind.GOLD_BUY,
    GhostMarkerKind.RED_PASS,
    GhostMarkerKind.PURPLE_POWER,
    GhostMarkerKind.SILVER_BREACH,
    GhostMarkerKind.BLACK_CASCADE,
  ];

  for (const kind of kinds) {
    result[kind] = {
      cordBonus: round6(computeGhostMarkerCordBonus(kind, 0, 0)),
      shieldBonus: round6(computeGhostMarkerShieldBonus(kind, 0, 0)),
    };
  }

  return result;
}

/**
 * Compute household-specific deck type profiles for all legal decks.
 */
export function computeHouseholdDeckProfiles(): Map<DeckType, ReturnType<typeof getDeckTypeProfile>> {
  const legalDecks = CARD_LEGALITY_MATRIX[HOUSEHOLD_BASE_MODE];
  const profiles = new Map<DeckType, ReturnType<typeof getDeckTypeProfile>>();

  for (const deck of legalDecks) {
    profiles.set(deck, getDeckTypeProfile(deck));
  }

  return profiles;
}

/**
 * Compute IPA chain synergy relevance for Household mode.
 */
export function computeHouseholdIPAChainSynergies(): typeof IPA_CHAIN_SYNERGIES {
  const legalDecks = new Set(CARD_LEGALITY_MATRIX[HOUSEHOLD_BASE_MODE]);
  return IPA_CHAIN_SYNERGIES.filter(
    (chain) => chain.combination.every((dt) => legalDecks.has(dt)),
  );
}

/**
 * Summarize GHOST_MARKER_SPECS for educational reference.
 */
export function summarizeHouseholdGhostMarkerSpecs(): Record<string, {
  cordBonus: number;
  shieldBonus: number;
  windowTicks: number;
}> {
  const result: Record<string, { cordBonus: number; shieldBonus: number; windowTicks: number }> = {};
  const kinds = [
    GhostMarkerKind.GOLD_BUY,
    GhostMarkerKind.RED_PASS,
    GhostMarkerKind.PURPLE_POWER,
    GhostMarkerKind.SILVER_BREACH,
    GhostMarkerKind.BLACK_CASCADE,
  ];

  for (const kind of kinds) {
    const spec = GHOST_MARKER_SPECS[kind];
    result[kind] = {
      cordBonus: spec.cordBonus ?? 0,
      shieldBonus: spec.shieldBonus ?? 0,
      windowTicks: spec.exploitWindowTicks ?? 3,
    };
  }

  return result;
}

/**
 * Compute a GBM window for household reference.
 */
export function computeHouseholdGbmWindow(
  markerKind: GhostMarkerKind,
  markerTick: number,
  currentTick: number,
) {
  return resolveGhostBenchmarkWindow(markerKind, currentTick, markerTick);
}

/**
 * Compute card draw weights for Household mode.
 */
export function computeHouseholdCardDrawWeights(
  rarity: CardRarity,
  runSeed: string,
  cycle: number,
): Map<DeckType, number> {
  return computeCardDrawWeights(HOUSEHOLD_BASE_MODE, rarity, runSeed, cycle);
}

/**
 * Compute pressure cost modifier for Household mode.
 */
export function computeHouseholdPressureCost(tier: PressureTier): number {
  return computePressureCostModifier(tier);
}

/**
 * Compute bleedthrough multiplier for Household mode.
 */
export function computeHouseholdBleedthrough(pressureTier: PressureTier, isCriticalTiming: boolean): number {
  return computeBleedthroughMultiplier(pressureTier, isCriticalTiming);
}

/**
 * Compute trust efficiency for Household mode.
 */
export function computeHouseholdTrustEfficiency(trustScore: number) {
  return computeTrustEfficiency(trustScore);
}

/**
 * Compute tag-weighted score for Household mode.
 */
export function computeHouseholdTagWeightedScore(tags: readonly CardTag[]): number {
  return computeTagWeightedScore(tags, HOUSEHOLD_BASE_MODE);
}

/**
 * Check if a deck type is legal in Household mode.
 */
export function isHouseholdDeckLegal(deckType: DeckType): boolean {
  return isDeckLegalInMode(deckType, HOUSEHOLD_BASE_MODE);
}

/**
 * Get COMEBACK_SURGE_CONFIG for reference.
 */
export function getHouseholdComebackSurgeConfig() {
  return COMEBACK_SURGE_CONFIG;
}

/**
 * Get HOLD_SYSTEM_CONFIG for reference.
 */
export function getHouseholdHoldConfig() {
  return HOLD_SYSTEM_CONFIG;
}

/**
 * Get all PRESSURE_COST_MODIFIERS for reference.
 */
export function getHouseholdPressureCostModifiers() {
  return PRESSURE_COST_MODIFIERS;
}

/**
 * Get all CARD_RARITY_DROP_RATES for reference.
 */
export function getHouseholdRarityDropRates() {
  return CARD_RARITY_DROP_RATES;
}

/**
 * Get DECK_TYPE_PROFILES for all Household-legal decks.
 */
export function getHouseholdDeckTypeProfiles(): Record<string, ReturnType<typeof getDeckTypeProfile>> {
  const legalDecks = CARD_LEGALITY_MATRIX[HOUSEHOLD_BASE_MODE];
  const result: Record<string, ReturnType<typeof getDeckTypeProfile>> = {};
  for (const deck of legalDecks) {
    result[deck] = DECK_TYPE_PROFILES[deck];
  }
  return result;
}

/**
 * Compute divergence potential for a specific card play in Household mode.
 */
export function computeHouseholdDivergencePotential(
  definition: CardDefinition,
  timingClass: TimingClass,
  tickDistanceFromMarker: number,
) {
  return computeDivergencePotential(definition, timingClass, tickDistanceFromMarker);
}

/**
 * Get MODE_CARD_BEHAVIORS for all modes (useful for cross-mode comparison).
 */
export function getAllHouseholdModeCardBehaviors() {
  return MODE_CARD_BEHAVIORS;
}

/**
 * Get proof badge conditions for Household mode.
 */
export function getHouseholdProofBadgeConditions() {
  return getProofBadgeConditionsForMode(HOUSEHOLD_BASE_MODE);
}

/**
 * Compute aggregate proof badge CORD for Household mode.
 */
export function computeHouseholdAggregateProofBadgeCord(badges: ReadonlySet<string>) {
  return computeAggregateProofBadgeCord(HOUSEHOLD_BASE_MODE, badges);
}

/**
 * Sanitize positive weights for household card draw operations.
 */
export function sanitizeHouseholdDrawWeights(weights: readonly number[]): readonly number[] {
  return sanitizePositiveWeights(weights);
}

/**
 * Compute the income breakdown for a household.
 */
export function computeHouseholdIncomeBreakdown(totalIncome: number) {
  return computeIncomeBreakdown(totalIncome);
}

/**
 * Get the expense shock range for a given severity.
 */
export function getHouseholdExpenseShockRange(severity: ExpenseShockSeverity) {
  return computeExpenseShockRange(severity);
}

/**
 * Compute the collaborative bonus multiplier for a given count.
 */
export function getHouseholdCollaborativeBonus(collaborativePlays: number): number {
  return computeCollaborativeBonusMultiplier(collaborativePlays);
}

/**
 * Get the pressure category label for a given pressure value.
 */
export function getHouseholdPressureCategory(pressure: number): string {
  return computePressureCategory(pressure);
}

/**
 * Get the trust category label for a given trust value.
 */
export function getHouseholdTrustCategory(trust: number): string {
  return computeTrustCategory(trust);
}

/**
 * Compute the age difficulty multiplier.
 */
export function getHouseholdAgeDifficultyMultiplier(age: FamilyMemberAge): number {
  return computeAgeDifficultyMultiplier(age);
}

/**
 * Compute the card simplification level for an age group.
 */
export function getHouseholdCardSimplification(age: FamilyMemberAge): number {
  return computeCardSimplificationLevel(age);
}

/**
 * Compute the savings goal multiplier for a goal type.
 */
export function getHouseholdSavingsGoalMultiplier(type: SavingsGoalType): number {
  return computeSavingsGoalMultiplier(type);
}

/**
 * Compute the debt strategy weight for a strategy.
 */
export function getHouseholdDebtStrategyWeight(strategy: DebtStrategy): number {
  return computeDebtStrategyWeight(strategy);
}

/**
 * Compute the insurance premium rate for a type.
 */
export function getHouseholdInsurancePremiumRate(type: InsuranceType): number {
  return computeInsurancePremiumRate(type);
}

/**
 * Compute the investment return rate for a type.
 */
export function getHouseholdInvestmentReturnRate(type: InvestmentType): number {
  return computeInvestmentReturnRate(type);
}

/**
 * Get default budget allocations for a given income.
 */
export function getHouseholdDefaultBudgetAllocations(totalIncome: number): readonly BudgetAllocation[] {
  return getDefaultBudgetAllocations(totalIncome);
}

/**
 * Compute the financial health score from components.
 */
export function computeHouseholdFinancialHealthScore(
  savingsRate: number,
  debtToIncome: number,
  averageTrust: number,
  pressure: number,
): number {
  return computeFinancialHealthScore(savingsRate, debtToIncome, averageTrust, pressure);
}

/**
 * Generate a stable identifier from components using SHA-256.
 */
export function generateHouseholdStableId(prefix: string, seed: string, index: number): string {
  return stableId(prefix, seed, index);
}

/**
 * Build a Household-specific ModeOverlay for educational card plays.
 * Household mode reduces cost modifiers for younger players and
 * emphasizes resilience + income tags for financial literacy.
 */
export function buildHouseholdModeOverlay(
  tags: readonly CardTag[],
  ageGroup: 'CHILD' | 'TEEN' | 'PARENT',
): ModeOverlay {
  const householdWeights = MODE_TAG_WEIGHT_DEFAULTS[HOUSEHOLD_BASE_MODE];
  const tagWeights: Partial<Record<CardTag, number>> = {};
  for (const tag of tags) {
    tagWeights[tag] = householdWeights[tag] ?? 0;
  }
  const costModifier = ageGroup === 'CHILD' ? 0.5 : ageGroup === 'TEEN' ? 0.75 : 1.0;
  return {
    costModifier,
    effectModifier: 1.0,
    tagWeights,
    timingLock: [],
    legal: true,
    targetingOverride: Targeting.SELF,
    cordWeight: 1.0,
  };
}

/**
 * Build a DecisionEffect for a household financial action.
 * Maps budget decisions into the replay engine's typed effect format.
 */
export function buildHouseholdDecisionEffect(
  target: 'cash' | 'income' | 'expenses' | 'shield',
  delta: number,
): DecisionEffect {
  return { target, delta };
}

/**
 * Classify the educational divergence potential of a household card play.
 * Uses CardTypesDivergencePotential to indicate how much a financial
 * decision diverges from the optimal educational path.
 */
export function classifyHouseholdEducationalDivergence(
  deckType: DeckType,
  isOptimalChoice: boolean,
): string {
  if (!isOptimalChoice && (deckType === DeckType.FUBAR || deckType === DeckType.MISSED_OPPORTUNITY)) {
    return CardTypesDivergencePotential.HIGH;
  }
  if (deckType === DeckType.OPPORTUNITY || deckType === DeckType.IPA) {
    return isOptimalChoice
      ? CardTypesDivergencePotential.LOW
      : CardTypesDivergencePotential.MEDIUM;
  }
  return CardTypesDivergencePotential.LOW;
}

/**
 * Get the counterability rating for a household card.
 * In Household mode, most cards are NONE (no PvP), but SO cards
 * are SOFT-counterable through budget reallocation.
 */
export function getHouseholdCardCounterability(deckType: DeckType): Counterability {
  if (deckType === DeckType.SO) return Counterability.SOFT;
  if (deckType === DeckType.FUBAR) return Counterability.HARD;
  return Counterability.NONE;
}

/**
 * Map a household tick to its corresponding financial education RunPhase.
 * Foundation = budgeting basics, Escalation = debt management,
 * Sovereignty = investment and long-term planning.
 */
export function getHouseholdRunPhase(tick: number, totalTicks: number): RunPhase {
  const progress = tick / Math.max(totalTicks, 1);
  if (progress < 0.33) return RunPhase.FOUNDATION;
  if (progress < 0.67) return RunPhase.ESCALATION;
  return RunPhase.SOVEREIGNTY;
}
