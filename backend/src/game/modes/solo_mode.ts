/*
 * POINT ZERO ONE — SOLO MODE ENGINE (EMPIRE / GO ALONE)
 * backend/src/game/modes/solo_mode.ts
 *
 * Doctrine:
 * - backend owns mode truth, not the client
 * - Empire is the PRIMARY single-player experience
 * - card legality, timing, targeting, and scoring are mode-native
 * - CORD bonuses, proof conditions, and hold logic are authoritative
 * - ML/DL feature extraction is a first-class concern
 * - chat bridge signals drive companion commentary
 * - educational tag tracking maps financial principles to engagement
 *
 * Sections:
 *   S1  - Imports & type aliases
 *   S2  - Solo-specific constants
 *   S3  - Solo-specific interfaces
 *   S4  - IPA Chain Synergy Engine
 *   S5  - Momentum Score System
 *   S6  - Isolation Tax Engine
 *   S7  - Hold System
 *   S8  - Comeback Surge Detection
 *   S9  - Debt Burden Tracker
 *   S10 - Phase System
 *   S11 - Card Legality & Wave-Based Quality
 *   S12 - Phase Boundary Card Windows
 *   S13 - SO Conversion Tests
 *   S14 - Educational Tag Tracker
 *   S15 - Chat Bridge Signal Emitter
 *   S16 - ML Feature Extraction
 *   S17 - Case File Generation
 *   S18 - SoloModeEngine (main class)
 */

// ============================================================================
// S1 — IMPORTS & TYPE ALIASES
// ============================================================================

import type {
  CardDecisionAudit,
  CardPlayIntent,
  ModeAdapter,
  ModeFinalization,
  ModeFrame,
  ModeParticipant,
  ModeValidationResult,
  ModeMLFeatureVector,
  ModeChatBridgeEvent,
  RunPhaseId,
} from './contracts';

import type {
  CardDefinition,
  CardInstance,
  DeckType,
  HaterBotId,
  ModeCode,
  RunPhase,
} from '../engine/core/GamePrimitives';

import {
  CARD_LEGALITY,
  MODE_TAG_WEIGHTS,
  PHASE_WINDOW_TICKS,
  SAFETY_CARD_IDS,
} from './shared/constants';

import {
  addForkHint,
  auditCardDecision,
  calcPsycheState,
  cardToInstance,
  cloneFrame,
  cloneParticipant,
  modeTagWeight,
  pushEvent,
  shieldPct,
  updateParticipant,
  averageDecisionLatencyMs,
} from './shared/helpers';

import { finalizeEmpire } from './shared/cord';

import { applyModeOverlay, validateModeCardPlay } from './shared/card_overlay';

// ============================================================================
// S1b — MUTABLE CLONE UTILITY
// ============================================================================
//
// RunStateSnapshot and its sub-interfaces are deeply readonly.
// cloneParticipant preserves the readonly type even though the data is
// a fresh copy. MutableDeep strips readonly at the type level so we can mutate
// the clone safely inside mode logic functions that produce a new participant.
//

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

/**
 * Deep-clone a value and strip all readonly modifiers.
 * The runtime clone uses JSON round-trip (same pattern as shared helpers),
 * but the return type is MutableDeep<T> so downstream mutations compile.
 */
function mutableClone<T>(value: T): MutableDeep<T> {
  return JSON.parse(JSON.stringify(value)) as MutableDeep<T>;
}

// ============================================================================
// S2 — SOLO-SPECIFIC CONSTANTS
// ============================================================================

/** IPA sub-types recognized by the synergy engine. */
const IPA_TYPES = ['REAL_ESTATE', 'EQUITY', 'DIGITAL', 'LICENSING', 'BUSINESS'] as const;
type IPAType = typeof IPA_TYPES[number];

/** Solo-legal deck types (everything except multiplayer-exclusive cards). */
const SOLO_LEGAL_DECK_TYPES: ReadonlySet<DeckType> = new Set(CARD_LEGALITY['solo']);

/** Illegal deck types in solo mode. */
const SOLO_ILLEGAL_DECK_TYPES: readonly DeckType[] = [
  'SABOTAGE', 'COUNTER', 'BLUFF', 'AID', 'RESCUE', 'TRUST', 'GHOST',
];

/** Momentum increment per qualifying play. */
const MOMENTUM_INCREMENT = 0.04;

/** Momentum threshold for unlocking second hold. */
const MOMENTUM_HOLD_UNLOCK_THRESHOLD = 0.7;

/** Isolation tax base multiplier per consecutive negative event. */
const ISOLATION_TAX_BASE = 0.05;

/** Maximum isolation tax multiplier cap. */
const ISOLATION_TAX_CAP = 0.50;

/** Comeback surge: drop below this fraction of freedom threshold. */
const COMEBACK_DROP_FRACTION = 0.40;

/** Comeback surge: recover above this fraction of freedom threshold. */
const COMEBACK_RECOVER_FRACTION = 0.80;

/** Comeback surge: boosted decision speed CORD weight. */
const COMEBACK_DECISION_SPEED_WEIGHT = 0.35;

/** Comeback surge duration in ticks. */
const COMEBACK_SURGE_DURATION_TICKS = 20;

/** No-Hold Run CORD bonus multiplier. */
const NO_HOLD_CORD_BONUS = 0.25;

/** Phase boundary window duration in ticks. */
const PHASE_BOUNDARY_WINDOW_TICKS = PHASE_WINDOW_TICKS;

/** Phase boundary card IDs. */
const PHASE_BOUNDARY_CARD_IDS = new Set([
  'MOMENTUM_PIVOT',
  'FORTIFY_ORDER',
  'LAST_STAND_PROTOCOL',
]);

/** IPA synergy bonus table. */
const IPA_SYNERGY_REAL_ESTATE_EQUITY_INCOME_BONUS = 0.08;
const IPA_SYNERGY_DIGITAL_LICENSING_CASHFLOW_BONUS = 0.12;
const IPA_SYNERGY_BUSINESS_REAL_ESTATE_MONTHLY_BONUS = 500;
const IPA_SYNERGY_THREE_PLUS_AUTOMATION_THRESHOLD = 3;
const IPA_SYNERGY_ALL_FOUR_SOVEREIGN_SHIELD_REGEN_MULTIPLIER = 2;

/** Debt interest compounding rate per tick. */
const DEBT_INTEREST_RATE_PER_TICK = 0.002;

/** Debt-to-income critical threshold. */
const DEBT_TO_INCOME_CRITICAL_THRESHOLD = 3.0;

/** Wave quality tiers mapped to phases. */
const WAVE_QUALITY_COST_MULTIPLIERS: Record<RunPhase, number> = {
  FOUNDATION: 0.8,
  ESCALATION: 1.0,
  SOVEREIGNTY: 1.3,
};

const WAVE_QUALITY_EFFECT_MULTIPLIERS: Record<RunPhase, number> = {
  FOUNDATION: 0.7,
  ESCALATION: 1.0,
  SOVEREIGNTY: 1.4,
};

/** Phase tick boundaries for a standard run. */
const PHASE_TICK_BOUNDARIES: Record<RunPhase, { start: number; end: number }> = {
  FOUNDATION: { start: 0, end: 40 },
  ESCALATION: { start: 40, end: 80 },
  SOVEREIGNTY: { start: 80, end: 120 },
};

/** SO conversion route identifiers. */
const SO_CONVERSION_ROUTES = ['CASH_CONVERSION', 'TIME_CONVERSION', 'PAIN_ABSORPTION'] as const;
type SOConversionRoute = typeof SO_CONVERSION_ROUTES[number];

/** Educational tag categories. */
const EDUCATIONAL_TAG_CATEGORIES = [
  'budgeting', 'investing', 'debt_management', 'credit_building',
  'insurance', 'tax_planning', 'income_diversification', 'risk_management',
  'asset_allocation', 'emergency_fund', 'compound_interest', 'leverage',
  'cash_flow', 'net_worth', 'financial_independence',
] as const;
type EducationalTagCategory = typeof EDUCATIONAL_TAG_CATEGORIES[number];

// ============================================================================
// S3 — SOLO-SPECIFIC INTERFACES
// ============================================================================

/** IPA portfolio tracking. */
interface IPAPortfolio {
  readonly types: Set<IPAType>;
  readonly acquisitionTicks: Record<string, number>;
  readonly synergyBonusesApplied: string[];
  readonly sovereignPositionActive: boolean;
}

/** Momentum state. */
interface MomentumState {
  readonly score: number;
  readonly playCount: number;
  readonly lastIncrementTick: number;
  readonly qualityTier: 'SCRAPPY' | 'STANDARD' | 'LEVERAGED' | 'EMPIRE_SCALE';
}

/** Isolation tax state. */
interface IsolationTaxState {
  readonly consecutiveNegativeCount: number;
  readonly currentMultiplier: number;
  readonly totalTaxApplied: number;
  readonly lastNegativeTick: number;
}

/** Hold system state. */
interface HoldState {
  readonly holdsUsed: number;
  readonly maxHolds: number;
  readonly secondHoldUnlocked: boolean;
  readonly holdExpiryPhaseCount: number;
  readonly lastHoldTick: number | null;
  readonly noHoldRun: boolean;
  readonly heldCardIds: string[];
}

/** Comeback surge state. */
interface ComebackSurgeState {
  readonly active: boolean;
  readonly droppedBelowThreshold: boolean;
  readonly dropTick: number | null;
  readonly recoveryTick: number | null;
  readonly surgeExpiryTick: number | null;
  readonly cordBonusTagged: boolean;
}

/** Debt burden state. */
interface DebtBurdenState {
  readonly totalDebt: number;
  readonly interestAccrued: number;
  readonly debtToIncomeRatio: number;
  readonly attachedDebtCardIds: string[];
  readonly compoundingTicks: number;
}

/** SO conversion record. */
interface SOConversionRecord {
  readonly cardId: string;
  readonly route: SOConversionRoute;
  readonly tick: number;
  readonly cashCost: number;
  readonly timeCost: number;
  readonly damageTaken: number;
  readonly cordBonus: number;
}

/** Educational engagement record. */
interface EducationalEngagement {
  readonly tag: string;
  readonly playCount: number;
  readonly totalQuality: number;
  readonly averageQuality: number;
  readonly firstSeenTick: number;
  readonly lastSeenTick: number;
}

/** Phase performance record. */
interface PhasePerformance {
  readonly phase: RunPhaseId;
  readonly cardsPlayed: number;
  readonly cashDelta: number;
  readonly shieldDelta: number;
  readonly extractionsSuffered: number;
  readonly counterPlays: number;
  readonly ipaAcquisitions: number;
  readonly momentumAtEnd: number;
  readonly isolationTaxPaid: number;
  readonly holdUsed: boolean;
}

/** Chat bridge signal for solo mode. */
interface SoloChatSignal {
  readonly type: string;
  readonly tick: number;
  readonly message: string;
  readonly payload: Record<string, string | number | boolean | null>;
}

/** ML feature snapshot for solo mode. */
interface SoloMLFeatureSnapshot {
  readonly tick: number;
  readonly features: ModeMLFeatureVector;
}

/** Case file for post-run analytics. */
interface SoloCaseFile {
  readonly runId: string;
  readonly mode: 'solo';
  readonly totalTicks: number;
  readonly finalOutcome: string;
  readonly phasePerformance: PhasePerformance[];
  readonly cardDecisions: CardDecisionAudit[];
  readonly ipaPortfolioSummary: {
    readonly typesAcquired: string[];
    readonly synergiesUnlocked: string[];
    readonly sovereignPositionReached: boolean;
  };
  readonly holdEfficiency: {
    readonly holdsUsed: number;
    readonly noHoldBonus: boolean;
    readonly holdTimingScores: number[];
  };
  readonly comebackDetection: {
    readonly comebackTriggered: boolean;
    readonly dropTick: number | null;
    readonly recoveryTick: number | null;
    readonly cordBonusAwarded: boolean;
  };
  readonly isolationTaxSummary: {
    readonly totalTaxPaid: number;
    readonly peakMultiplier: number;
    readonly consecutiveNegativeStreak: number;
  };
  readonly debtBurdenSummary: {
    readonly peakDebt: number;
    readonly peakDebtToIncome: number;
    readonly interestPaid: number;
  };
  readonly soConversionSummary: {
    readonly totalConversions: number;
    readonly routeBreakdown: Record<string, number>;
    readonly averageCordBonus: number;
  };
  readonly educationalSummary: {
    readonly tagsEngaged: string[];
    readonly tagsAvoided: string[];
    readonly engagementQuality: Record<string, number>;
  };
  readonly momentumSummary: {
    readonly peakMomentum: number;
    readonly averageMomentum: number;
    readonly qualityTierReached: string;
  };
  readonly mlFeatureSnapshots: SoloMLFeatureSnapshot[];
  readonly chatSignals: SoloChatSignal[];
}

/** Complete solo engine state stored in participant metadata. */
interface SoloEngineState {
  readonly ipaPortfolio: IPAPortfolio;
  readonly momentum: MomentumState;
  readonly isolationTax: IsolationTaxState;
  readonly hold: HoldState;
  readonly comebackSurge: ComebackSurgeState;
  readonly debtBurden: DebtBurdenState;
  readonly soConversions: SOConversionRecord[];
  readonly educationalEngagements: Record<string, EducationalEngagement>;
  readonly phasePerformance: PhasePerformance[];
  readonly cardDecisions: CardDecisionAudit[];
  readonly chatSignals: SoloChatSignal[];
  readonly mlSnapshots: SoloMLFeatureSnapshot[];
  readonly phaseChangeCount: number;
  readonly lastPhase: RunPhase;
  readonly peakMomentum: number;
  readonly peakDebt: number;
  readonly peakDebtToIncome: number;
  readonly peakIsolationMultiplier: number;
  readonly totalCardsPlayed: number;
  readonly currentPhaseCardsPlayed: number;
  readonly currentPhaseCashDelta: number;
  readonly currentPhaseShieldDelta: number;
  readonly currentPhaseExtractions: number;
  readonly currentPhaseCounters: number;
  readonly currentPhaseIPAs: number;
}

// ============================================================================
// S4 — IPA CHAIN SYNERGY ENGINE
// ============================================================================

function createEmptyIPAPortfolio(): IPAPortfolio {
  return {
    types: new Set<IPAType>(),
    acquisitionTicks: {},
    synergyBonusesApplied: [],
    sovereignPositionActive: false,
  };
}

function classifyIPAType(card: CardDefinition): IPAType | null {
  const tags = card.tags;
  if (tags.includes('real_estate') || tags.includes('property')) return 'REAL_ESTATE';
  if (tags.includes('equity') || tags.includes('stock') || tags.includes('shares')) return 'EQUITY';
  if (tags.includes('digital') || tags.includes('crypto') || tags.includes('nft')) return 'DIGITAL';
  if (tags.includes('licensing') || tags.includes('royalty') || tags.includes('patent')) return 'LICENSING';
  if (tags.includes('business') || tags.includes('enterprise') || tags.includes('startup')) return 'BUSINESS';
  return null;
}

function addIPAToPortfolio(
  portfolio: IPAPortfolio,
  ipaType: IPAType,
  tick: number,
): IPAPortfolio {
  const newTypes = new Set(portfolio.types);
  newTypes.add(ipaType);
  const newAcquisitions = { ...portfolio.acquisitionTicks, [ipaType]: tick };
  return {
    types: newTypes,
    acquisitionTicks: newAcquisitions,
    synergyBonusesApplied: [...portfolio.synergyBonusesApplied],
    sovereignPositionActive: portfolio.sovereignPositionActive,
  };
}

function detectIPASynergies(portfolio: IPAPortfolio): string[] {
  const synergies: string[] = [];
  const types = portfolio.types;

  if (types.has('REAL_ESTATE') && types.has('EQUITY')) {
    synergies.push('REAL_ESTATE_EQUITY');
  }
  if (types.has('DIGITAL') && types.has('LICENSING')) {
    synergies.push('DIGITAL_LICENSING');
  }
  if (types.has('BUSINESS') && types.has('REAL_ESTATE')) {
    synergies.push('BUSINESS_REAL_ESTATE');
  }
  if (types.size >= IPA_SYNERGY_THREE_PLUS_AUTOMATION_THRESHOLD) {
    synergies.push('AUTOMATION_TRIGGER');
  }
  if (types.size >= 4) {
    synergies.push('SOVEREIGN_POSITION');
  }
  return synergies;
}

function applyIPASynergyEffects(
  participant: ModeParticipant,
  portfolio: IPAPortfolio,
  newSynergies: string[],
): { participant: ModeParticipant; portfolio: IPAPortfolio } {
  const p = mutableClone(participant);
  const appliedList = [...portfolio.synergyBonusesApplied];
  let sovereign = portfolio.sovereignPositionActive;

  for (const synergy of newSynergies) {
    if (appliedList.includes(synergy)) continue;
    appliedList.push(synergy);

    if (synergy === 'REAL_ESTATE_EQUITY') {
      p.snapshot.economy.incomePerTick = Math.round(
        p.snapshot.economy.incomePerTick * (1 + IPA_SYNERGY_REAL_ESTATE_EQUITY_INCOME_BONUS),
      );
    } else if (synergy === 'DIGITAL_LICENSING') {
      p.snapshot.economy.cash += Math.round(
        p.snapshot.economy.incomePerTick * IPA_SYNERGY_DIGITAL_LICENSING_CASHFLOW_BONUS,
      );
    } else if (synergy === 'BUSINESS_REAL_ESTATE') {
      p.snapshot.economy.incomePerTick += IPA_SYNERGY_BUSINESS_REAL_ESTATE_MONTHLY_BONUS;
    } else if (synergy === 'AUTOMATION_TRIGGER') {
      p.snapshot.economy.expensesPerTick = Math.max(
        0,
        Math.round(p.snapshot.economy.expensesPerTick * 0.85),
      );
    } else if (synergy === 'SOVEREIGN_POSITION') {
      sovereign = true;
      p.snapshot.shield.layers = p.snapshot.shield.layers.map((layer) => ({
        ...layer,
        regenPerTick: layer.regenPerTick * IPA_SYNERGY_ALL_FOUR_SOVEREIGN_SHIELD_REGEN_MULTIPLIER,
      }));
      p.snapshot.tags = [...p.snapshot.tags, 'SOVEREIGN_POSITION'];
    }
  }

  const updatedPortfolio: IPAPortfolio = {
    types: portfolio.types,
    acquisitionTicks: portfolio.acquisitionTicks,
    synergyBonusesApplied: appliedList,
    sovereignPositionActive: sovereign,
  };

  return { participant: p as ModeParticipant, portfolio: updatedPortfolio };
}

function isLiquidatorImmune(portfolio: IPAPortfolio): boolean {
  return portfolio.sovereignPositionActive;
}

// ============================================================================
// S5 — MOMENTUM SCORE SYSTEM
// ============================================================================

function createEmptyMomentumState(): MomentumState {
  return {
    score: 0,
    playCount: 0,
    lastIncrementTick: -1,
    qualityTier: 'SCRAPPY',
  };
}

function incrementMomentum(
  state: MomentumState,
  tick: number,
): MomentumState {
  const newScore = Math.min(1.0, Number((state.score + MOMENTUM_INCREMENT).toFixed(4)));
  const newPlayCount = state.playCount + 1;
  return {
    score: newScore,
    playCount: newPlayCount,
    lastIncrementTick: tick,
    qualityTier: momentumToQualityTier(newScore),
  };
}

function decayMomentum(state: MomentumState): MomentumState {
  if (state.score <= 0) return state;
  const decayed = Math.max(0, Number((state.score - 0.01).toFixed(4)));
  return {
    ...state,
    score: decayed,
    qualityTier: momentumToQualityTier(decayed),
  };
}

function momentumToQualityTier(
  score: number,
): MomentumState['qualityTier'] {
  if (score >= 0.85) return 'EMPIRE_SCALE';
  if (score >= 0.55) return 'LEVERAGED';
  if (score >= 0.25) return 'STANDARD';
  return 'SCRAPPY';
}

// ============================================================================
// S6 — ISOLATION TAX ENGINE
// ============================================================================

function createEmptyIsolationTaxState(): IsolationTaxState {
  return {
    consecutiveNegativeCount: 0,
    currentMultiplier: 0,
    totalTaxApplied: 0,
    lastNegativeTick: -1,
  };
}

function applyNegativeEvent(
  state: IsolationTaxState,
  tick: number,
): IsolationTaxState {
  const newCount = state.consecutiveNegativeCount + 1;
  const newMultiplier = Math.min(
    ISOLATION_TAX_CAP,
    Number((newCount * ISOLATION_TAX_BASE).toFixed(4)),
  );
  return {
    consecutiveNegativeCount: newCount,
    currentMultiplier: newMultiplier,
    totalTaxApplied: state.totalTaxApplied,
    lastNegativeTick: tick,
  };
}

function resetIsolationStreak(state: IsolationTaxState): IsolationTaxState {
  return {
    consecutiveNegativeCount: 0,
    currentMultiplier: 0,
    totalTaxApplied: state.totalTaxApplied,
    lastNegativeTick: state.lastNegativeTick,
  };
}

function computeIsolationTax(
  state: IsolationTaxState,
  baseExpenses: number,
): { taxAmount: number; newTotal: number } {
  const taxAmount = Math.round(baseExpenses * state.currentMultiplier);
  return {
    taxAmount,
    newTotal: state.totalTaxApplied + taxAmount,
  };
}

// ============================================================================
// S7 — HOLD SYSTEM
// ============================================================================

function createEmptyHoldState(): HoldState {
  return {
    holdsUsed: 0,
    maxHolds: 1,
    secondHoldUnlocked: false,
    holdExpiryPhaseCount: 0,
    lastHoldTick: null,
    noHoldRun: true,
    heldCardIds: [],
  };
}

function canUseHold(
  holdState: HoldState,
  momentumScore: number,
  bleedMode: boolean,
): boolean {
  if (bleedMode) return false;
  if (holdState.holdsUsed >= holdState.maxHolds) {
    if (momentumScore >= MOMENTUM_HOLD_UNLOCK_THRESHOLD && !holdState.secondHoldUnlocked) {
      return true;
    }
    return false;
  }
  return true;
}

function useHold(
  holdState: HoldState,
  tick: number,
  cardId: string,
  momentumScore: number,
): HoldState {
  const unlockSecond =
    momentumScore >= MOMENTUM_HOLD_UNLOCK_THRESHOLD && !holdState.secondHoldUnlocked;
  return {
    holdsUsed: holdState.holdsUsed + 1,
    maxHolds: unlockSecond ? 2 : holdState.maxHolds,
    secondHoldUnlocked: unlockSecond || holdState.secondHoldUnlocked,
    holdExpiryPhaseCount: 0,
    lastHoldTick: tick,
    noHoldRun: false,
    heldCardIds: [...holdState.heldCardIds, cardId],
  };
}

function checkHoldExpiry(
  holdState: HoldState,
  phaseChanged: boolean,
): HoldState {
  if (!phaseChanged) return holdState;
  const newPhaseCount = holdState.holdExpiryPhaseCount + 1;
  if (newPhaseCount >= 2) {
    return {
      ...holdState,
      holdExpiryPhaseCount: 0,
      heldCardIds: [],
    };
  }
  return {
    ...holdState,
    holdExpiryPhaseCount: newPhaseCount,
  };
}

function isHoldableCard(cardId: string): boolean {
  return !PHASE_BOUNDARY_CARD_IDS.has(cardId);
}

// ============================================================================
// S8 — COMEBACK SURGE DETECTION
// ============================================================================

function createEmptyComebackSurgeState(): ComebackSurgeState {
  return {
    active: false,
    droppedBelowThreshold: false,
    dropTick: null,
    recoveryTick: null,
    surgeExpiryTick: null,
    cordBonusTagged: false,
  };
}

function evaluateComebackSurge(
  state: ComebackSurgeState,
  cash: number,
  freedomTarget: number,
  tick: number,
): ComebackSurgeState {
  const dropThreshold = freedomTarget * COMEBACK_DROP_FRACTION;
  const recoverThreshold = freedomTarget * COMEBACK_RECOVER_FRACTION;

  if (!state.droppedBelowThreshold && cash < dropThreshold) {
    return {
      ...state,
      droppedBelowThreshold: true,
      dropTick: tick,
    };
  }

  if (state.droppedBelowThreshold && !state.active && cash >= recoverThreshold) {
    return {
      active: true,
      droppedBelowThreshold: true,
      dropTick: state.dropTick,
      recoveryTick: tick,
      surgeExpiryTick: tick + COMEBACK_SURGE_DURATION_TICKS,
      cordBonusTagged: true,
    };
  }

  if (state.active && state.surgeExpiryTick !== null && tick >= state.surgeExpiryTick) {
    return {
      ...state,
      active: false,
    };
  }

  return state;
}

function getComebackDecisionSpeedWeight(state: ComebackSurgeState): number {
  return state.active ? COMEBACK_DECISION_SPEED_WEIGHT : 0.15;
}

// ============================================================================
// S9 — DEBT BURDEN TRACKER
// ============================================================================

function createEmptyDebtBurdenState(): DebtBurdenState {
  return {
    totalDebt: 0,
    interestAccrued: 0,
    debtToIncomeRatio: 0,
    attachedDebtCardIds: [],
    compoundingTicks: 0,
  };
}

function attachDebtCard(
  state: DebtBurdenState,
  cardId: string,
  debtAmount: number,
): DebtBurdenState {
  const newTotal = state.totalDebt + debtAmount;
  return {
    ...state,
    totalDebt: newTotal,
    attachedDebtCardIds: [...state.attachedDebtCardIds, cardId],
  };
}

function compoundDebtInterest(
  state: DebtBurdenState,
  incomePerTick: number,
): DebtBurdenState {
  if (state.totalDebt <= 0) return state;
  const interest = Math.round(state.totalDebt * DEBT_INTEREST_RATE_PER_TICK);
  const newTotal = state.totalDebt + interest;
  const ratio = incomePerTick > 0 ? Number((newTotal / incomePerTick).toFixed(4)) : 999;
  return {
    totalDebt: newTotal,
    interestAccrued: state.interestAccrued + interest,
    debtToIncomeRatio: ratio,
    attachedDebtCardIds: state.attachedDebtCardIds,
    compoundingTicks: state.compoundingTicks + 1,
  };
}

function isDebtCritical(state: DebtBurdenState): boolean {
  return state.debtToIncomeRatio >= DEBT_TO_INCOME_CRITICAL_THRESHOLD;
}

function payDownDebt(
  state: DebtBurdenState,
  amount: number,
  incomePerTick: number,
): DebtBurdenState {
  const newTotal = Math.max(0, state.totalDebt - amount);
  const ratio = incomePerTick > 0 ? Number((newTotal / incomePerTick).toFixed(4)) : 0;
  return {
    ...state,
    totalDebt: newTotal,
    debtToIncomeRatio: ratio,
  };
}

// ============================================================================
// S10 — PHASE SYSTEM
// ============================================================================

function phaseForTick(tick: number, totalTicks: number): RunPhase {
  if (totalTicks <= 0) return 'FOUNDATION';
  const fraction = tick / totalTicks;
  if (fraction < 1 / 3) return 'FOUNDATION';
  if (fraction < 2 / 3) return 'ESCALATION';
  return 'SOVEREIGNTY';
}

function phaseForElapsedMs(totalMs: number, elapsedMs: number): RunPhase {
  const fraction = totalMs <= 0 ? 0 : elapsedMs / totalMs;
  if (fraction < 1 / 3) return 'FOUNDATION';
  if (fraction < 2 / 3) return 'ESCALATION';
  return 'SOVEREIGNTY';
}

function phaseToRunPhaseId(phase: RunPhase): RunPhaseId {
  return phase;
}

function phaseOrdinal(phase: RunPhase): number {
  if (phase === 'FOUNDATION') return 0;
  if (phase === 'ESCALATION') return 1;
  return 2;
}

function phasesChanged(prev: RunPhase, next: RunPhase): boolean {
  return prev !== next;
}

function doublePhaseChange(prev: RunPhase, next: RunPhase): boolean {
  return phaseOrdinal(next) - phaseOrdinal(prev) >= 2;
}

// ============================================================================
// S11 — CARD LEGALITY & WAVE-BASED QUALITY
// ============================================================================

function isCardLegalInSolo(deckType: DeckType): boolean {
  return SOLO_LEGAL_DECK_TYPES.has(deckType);
}

function isIllegalInSolo(deckType: DeckType): boolean {
  return SOLO_ILLEGAL_DECK_TYPES.includes(deckType);
}

function computeTagWeightModifier(card: CardInstance): number {
  const tags = card.tags;
  if (tags.length === 0) return 1.0;
  const soloWeights = MODE_TAG_WEIGHTS['solo'];
  const totalWeight = tags.reduce((sum, tag) => sum + (soloWeights[tag] ?? modeTagWeight('solo', tag)), 0);
  const avgWeight = totalWeight / tags.length;
  return Math.max(0.5, Math.min(2.0, avgWeight));
}

function applyWaveQuality(
  card: CardInstance,
  phase: RunPhase,
): CardInstance {
  const costMul = WAVE_QUALITY_COST_MULTIPLIERS[phase];
  const effectMul = WAVE_QUALITY_EFFECT_MULTIPLIERS[phase];
  const tagModifier = computeTagWeightModifier(card);

  const adjustedCost = Math.max(0, Math.round(card.cost * costMul));
  const adjustedCard: CardDefinition = {
    ...card.card,
    baseEffect: {
      ...card.card.baseEffect,
      cashDelta: typeof card.card.baseEffect.cashDelta === 'number'
        ? Math.round(card.card.baseEffect.cashDelta * effectMul * tagModifier)
        : card.card.baseEffect.cashDelta,
      incomeDelta: typeof card.card.baseEffect.incomeDelta === 'number'
        ? Math.round(card.card.baseEffect.incomeDelta * effectMul * tagModifier)
        : card.card.baseEffect.incomeDelta,
      shieldDelta: typeof card.card.baseEffect.shieldDelta === 'number'
        ? Math.round(card.card.baseEffect.shieldDelta * effectMul * tagModifier)
        : card.card.baseEffect.shieldDelta,
    },
  };

  return {
    ...card,
    cost: adjustedCost,
    card: adjustedCard,
  };
}

function buildSoloCardInstance(
  card: CardDefinition,
  phase: RunPhase,
): CardInstance {
  const tagWeight = modeTagWeight('solo', card.tags[0] ?? 'income');
  const costAdjust = tagWeight > 1.5 ? 0.9 : 1.0;
  const baseCost = Math.max(0, Math.round(card.baseCost * costAdjust));
  return cardToInstance('solo', card, baseCost, card.targeting, card.timingClass);
}

// ============================================================================
// S12 — PHASE BOUNDARY CARD WINDOWS
// ============================================================================

function isPhaseBoundaryCard(cardId: string): boolean {
  return PHASE_BOUNDARY_CARD_IDS.has(cardId);
}

function isPhaseBoundaryWindowOpen(participant: ModeParticipant): boolean {
  return participant.snapshot.modeState.phaseBoundaryWindowsRemaining > 0;
}

function decrementPhaseBoundaryWindow(participant: ModeParticipant): ModeParticipant {
  const cloned = mutableClone(participant);
  cloned.snapshot.modeState.phaseBoundaryWindowsRemaining = Math.max(
    0,
    cloned.snapshot.modeState.phaseBoundaryWindowsRemaining - 1,
  );
  return cloned as ModeParticipant;
}

function openPhaseBoundaryWindow(participant: ModeParticipant): ModeParticipant {
  const cloned = mutableClone(participant);
  cloned.snapshot.modeState.phaseBoundaryWindowsRemaining = PHASE_BOUNDARY_WINDOW_TICKS;
  return cloned as ModeParticipant;
}

// ============================================================================
// S13 — SO CONVERSION TESTS
// ============================================================================

function createSOConversionRecord(
  cardId: string,
  route: SOConversionRoute,
  tick: number,
): SOConversionRecord {
  let cashCost = 0;
  let timeCost = 0;
  let damageTaken = 0;
  let cordBonus = 0;

  if (route === 'CASH_CONVERSION') {
    cashCost = 2000;
    cordBonus = 0.01;
  } else if (route === 'TIME_CONVERSION') {
    timeCost = 5;
    cordBonus = 0.02;
  } else if (route === 'PAIN_ABSORPTION') {
    damageTaken = 500;
    cordBonus = 0.04;
  }

  return {
    cardId,
    route,
    tick,
    cashCost,
    timeCost,
    damageTaken,
    cordBonus,
  };
}

function applySOConversion(
  participant: ModeParticipant,
  record: SOConversionRecord,
): ModeParticipant {
  const cloned = mutableClone(participant);

  if (record.route === 'CASH_CONVERSION') {
    cloned.snapshot.economy.cash = Math.max(
      0,
      cloned.snapshot.economy.cash - record.cashCost,
    );
  } else if (record.route === 'TIME_CONVERSION') {
    cloned.snapshot.timers.extensionBudgetMs = Math.max(
      0,
      cloned.snapshot.timers.extensionBudgetMs - record.timeCost * 1000,
    );
  } else if (record.route === 'PAIN_ABSORPTION') {
    const targetLayer = cloned.snapshot.shield.layers.find(
      (l) => l.layerId === cloned.snapshot.shield.weakestLayerId,
    );
    if (targetLayer) {
      targetLayer.current = Math.max(0, targetLayer.current - record.damageTaken);
      targetLayer.lastDamagedTick = cloned.snapshot.tick;
    }
  }

  cloned.snapshot.sovereignty.cordScore = Number(
    (cloned.snapshot.sovereignty.cordScore + record.cordBonus).toFixed(6),
  );

  return cloned as ModeParticipant;
}

function inferSOConversionRoute(
  participant: ModeParticipant,
  payload: Record<string, unknown> | undefined,
): SOConversionRoute {
  if (payload?.route) {
    const r = String(payload.route);
    if (r === 'CASH_CONVERSION' || r === 'TIME_CONVERSION' || r === 'PAIN_ABSORPTION') {
      return r;
    }
  }
  const cash = participant.snapshot.economy.cash;
  const shields = shieldPct(participant);
  if (cash > 5000) return 'CASH_CONVERSION';
  if (shields > 0.6) return 'PAIN_ABSORPTION';
  return 'TIME_CONVERSION';
}

// ============================================================================
// S14 — EDUCATIONAL TAG TRACKER
// ============================================================================

function recordEducationalTag(
  engagements: Record<string, EducationalEngagement>,
  tag: string,
  quality: number,
  tick: number,
): Record<string, EducationalEngagement> {
  const existing = engagements[tag];
  if (existing) {
    const newPlayCount = existing.playCount + 1;
    const newTotalQuality = existing.totalQuality + quality;
    return {
      ...engagements,
      [tag]: {
        tag,
        playCount: newPlayCount,
        totalQuality: newTotalQuality,
        averageQuality: Number((newTotalQuality / newPlayCount).toFixed(4)),
        firstSeenTick: existing.firstSeenTick,
        lastSeenTick: tick,
      },
    };
  }
  return {
    ...engagements,
    [tag]: {
      tag,
      playCount: 1,
      totalQuality: quality,
      averageQuality: quality,
      firstSeenTick: tick,
      lastSeenTick: tick,
    },
  };
}

function getEngagedTags(
  engagements: Record<string, EducationalEngagement>,
): string[] {
  return Object.keys(engagements).filter((key) => engagements[key].playCount > 0);
}

function getAvoidedTags(
  engagements: Record<string, EducationalEngagement>,
): string[] {
  const engaged = new Set(getEngagedTags(engagements));
  return EDUCATIONAL_TAG_CATEGORIES.filter((cat) => !engaged.has(cat));
}

// ============================================================================
// S15 — CHAT BRIDGE SIGNAL EMITTER
// ============================================================================

function emitChatSignal(
  signals: SoloChatSignal[],
  type: string,
  tick: number,
  message: string,
  payload: Record<string, string | number | boolean | null>,
): SoloChatSignal[] {
  return [
    ...signals,
    { type, tick, message, payload },
  ];
}

function buildChatBridgeEvent(
  signal: SoloChatSignal,
  runId: string,
  actorId: string,
): ModeChatBridgeEvent {
  return {
    eventId: `solo_${signal.type}_${signal.tick}`,
    type: signal.type as ModeChatBridgeEvent['type'],
    runId,
    mode: 'solo',
    tick: signal.tick,
    actorId,
    targetId: null,
    summary: signal.message,
    payload: signal.payload,
    timestamp: Date.now(),
  };
}

function emitPhaseTransitionSignal(
  signals: SoloChatSignal[],
  tick: number,
  fromPhase: RunPhase,
  toPhase: RunPhase,
): SoloChatSignal[] {
  const message = toPhase === 'ESCALATION'
    ? 'Phase 2 has begun. The haters are awake. Pressure is climbing.'
    : 'Phase 3 has begun. Sovereignty pressure is live. Every tick counts.';
  return emitChatSignal(signals, 'PHASE_TRANSITION', tick, message, {
    fromPhase,
    toPhase,
  });
}

function emitComebackSurgeSignal(
  signals: SoloChatSignal[],
  tick: number,
  active: boolean,
): SoloChatSignal[] {
  const message = active
    ? 'COMEBACK SURGE ACTIVATED. Decision speed bonus is live. Fight back.'
    : 'Comeback surge expired. Standard scoring resumes.';
  const type = active ? 'COMEBACK_SURGE_ACTIVATED' : 'COMEBACK_SURGE_EXPIRED';
  return emitChatSignal(signals, type, tick, message, { active });
}

function emitIPASynergySignal(
  signals: SoloChatSignal[],
  tick: number,
  synergy: string,
): SoloChatSignal[] {
  const descriptions: Record<string, string> = {
    REAL_ESTATE_EQUITY: 'Real Estate + Equity synergy unlocked: +8% income boost.',
    DIGITAL_LICENSING: 'Digital + Licensing synergy unlocked: +12% cashflow injection.',
    BUSINESS_REAL_ESTATE: 'Business + Real Estate synergy unlocked: +$500/month per IPA.',
    AUTOMATION_TRIGGER: '3+ IPA types detected. Automation Trigger engaged: expenses reduced.',
    SOVEREIGN_POSITION: 'ALL 4 IPA types acquired. SOVEREIGN POSITION: 2x shield regen + Liquidator immunity.',
  };
  return emitChatSignal(signals, 'COMBO_ACTIVATED', tick, descriptions[synergy] ?? `IPA synergy: ${synergy}`, {
    synergy,
  });
}

function emitIsolationTaxWarning(
  signals: SoloChatSignal[],
  tick: number,
  multiplier: number,
  streak: number,
): SoloChatSignal[] {
  return emitChatSignal(
    signals,
    'PRESSURE_TRANSITION',
    tick,
    `Isolation Tax warning: ${streak} consecutive negatives. Expense multiplier at +${Math.round(multiplier * 100)}%.`,
    { multiplier, streak },
  );
}

function emitDebtCriticalSignal(
  signals: SoloChatSignal[],
  tick: number,
  ratio: number,
): SoloChatSignal[] {
  return emitChatSignal(
    signals,
    'PRESSURE_TRANSITION',
    tick,
    `DEBT CRITICAL: Debt-to-income ratio at ${ratio.toFixed(2)}x. Compounding interest is accelerating.`,
    { debtToIncomeRatio: ratio },
  );
}

function emitPhaseBoundaryCardSignal(
  signals: SoloChatSignal[],
  tick: number,
  windowTicks: number,
): SoloChatSignal[] {
  return emitChatSignal(
    signals,
    'BADGE_EARNED',
    tick,
    `Phase boundary window open: ${windowTicks} ticks to play MOMENTUM_PIVOT, FORTIFY_ORDER, or LAST_STAND_PROTOCOL.`,
    { windowTicks },
  );
}

function emitHoldUsedSignal(
  signals: SoloChatSignal[],
  tick: number,
  holdsRemaining: number,
): SoloChatSignal[] {
  return emitChatSignal(
    signals,
    'CARD_PLAYED',
    tick,
    `Hold used. ${holdsRemaining} hold(s) remaining.`,
    { holdsRemaining },
  );
}

// ============================================================================
// S16 — ML FEATURE EXTRACTION
// ============================================================================

function extractSoloMLFeatures(
  participant: ModeParticipant,
  engineState: SoloEngineState,
  tick: number,
): ModeMLFeatureVector {
  const snap = participant.snapshot;
  const econ = snap.economy;
  const pres = snap.pressure;
  const shield = snap.shield;
  const battle = snap.battle;
  const cards = snap.cards;
  const cascade = snap.cascade;
  const sov = snap.sovereignty;

  const cashNorm = Math.min(1.0, Math.max(0, econ.cash / Math.max(1, econ.freedomTarget)));
  const shieldIntegrity = shieldPct(participant);
  const heatLevel = Math.min(1.0, econ.haterHeat / 100);
  const pressureScore = pres.score;
  const trustScore = 0;
  const tickProgress = snap.timers.seasonBudgetMs > 0
    ? Math.min(1.0, snap.timers.elapsedMs / snap.timers.seasonBudgetMs)
    : 0;
  const cardsInHand = Math.min(1.0, cards.hand.length / 10);
  const cardsPlayedTotal = Math.min(1.0, Math.log1p(engineState.totalCardsPlayed) / 5);
  const incomeRate = Math.min(1.0, econ.incomePerTick / 1000);
  const debtLevel = Math.min(1.0, Math.log1p(engineState.debtBurden.totalDebt) / 12);
  const activeBots = Math.min(
    1.0,
    battle.bots.filter((b) => b.state === 'ATTACKING' || b.state === 'TARGETING').length / 5,
  );
  const extractionCount = Math.min(1.0, Math.log1p(
    battle.pendingAttacks.length + battle.bots.reduce((sum, b) => sum + b.attacksLanded, 0),
  ) / 4);
  const counterCount = Math.min(1.0, Math.log1p(
    Number(participant.metadata['counterSuccessCount'] ?? 0),
  ) / 4);
  const comboChainLength = Math.min(1.0, cascade.activeChains.length / 5);
  const rescueCount = 0;
  const aidCount = 0;
  const phaseNum = phaseOrdinal(snap.phase) / 2;
  const teamSize = 0;
  const defectionStep = 0;
  const loanCountActive = 0;
  const opportunitySlotsOpen = 0;
  const bluffSuccessRate = 0;
  const counterSuccessRate = Number(participant.metadata['counterSuccessCount'] ?? 0) > 0 ? 0.5 : 0;
  const psycheOrd = psycheOrdinal(calcPsycheState(participant)) / 4;
  const visibilityOrd = 0;
  const legendScoreDelta = 0;
  const comebackSurgeActive = engineState.comebackSurge.active ? 1 : 0;
  const battleBudgetFraction = battle.battleBudgetCap > 0
    ? battle.battleBudget / battle.battleBudgetCap
    : 0;
  const sharedObjectiveProgress = 0;
  const rivalryHeat = 0;
  const disciplineCardsPlayed = Math.min(1.0, Math.log1p(
    cards.lastPlayed.filter((id) => id.toLowerCase().includes('discipline')).length,
  ) / 3);
  const modeOrdinal = 0;

  return [
    cashNorm, shieldIntegrity, heatLevel, pressureScore,
    trustScore, tickProgress, cardsInHand, cardsPlayedTotal,
    incomeRate, debtLevel, activeBots, extractionCount,
    counterCount, comboChainLength, rescueCount, aidCount,
    phaseNum, teamSize, defectionStep, loanCountActive,
    opportunitySlotsOpen, bluffSuccessRate, counterSuccessRate, psycheOrd,
    visibilityOrd, legendScoreDelta, comebackSurgeActive, battleBudgetFraction,
    sharedObjectiveProgress, rivalryHeat, disciplineCardsPlayed, modeOrdinal,
  ] as unknown as ModeMLFeatureVector;
}

function psycheOrdinal(state: ReturnType<typeof calcPsycheState>): number {
  const mapping: Record<string, number> = {
    COMPOSED: 0,
    STRESSED: 1,
    CRACKING: 2,
    BREAKING: 3,
    DESPERATE: 4,
  };
  return mapping[state] ?? 0;
}

function captureMLSnapshot(
  participant: ModeParticipant,
  engineState: SoloEngineState,
  tick: number,
): SoloMLFeatureSnapshot {
  return {
    tick,
    features: extractSoloMLFeatures(participant, engineState, tick),
  };
}

// ============================================================================
// S17 — CASE FILE GENERATION
// ============================================================================

function generateCaseFile(
  frame: ModeFrame,
  engineState: SoloEngineState,
): SoloCaseFile {
  const participant = frame.participants[0];
  const runId = participant.snapshot.runId;

  const engagedTags = getEngagedTags(engineState.educationalEngagements);
  const avoidedTags = getAvoidedTags(engineState.educationalEngagements);
  const engagementQuality: Record<string, number> = {};
  for (const tag of engagedTags) {
    engagementQuality[tag] = engineState.educationalEngagements[tag].averageQuality;
  }

  const routeBreakdown: Record<string, number> = {};
  for (const route of SO_CONVERSION_ROUTES) {
    routeBreakdown[route] = engineState.soConversions.filter((c) => c.route === route).length;
  }
  const totalConversions = engineState.soConversions.length;
  const averageCordBonus = totalConversions > 0
    ? engineState.soConversions.reduce((sum, c) => sum + c.cordBonus, 0) / totalConversions
    : 0;

  const holdTimingScores = engineState.hold.heldCardIds.map(() => 0.5);

  const momentumScores = engineState.mlSnapshots.map((s) => s.features[0]);
  const averageMomentum = momentumScores.length > 0
    ? momentumScores.reduce((a, b) => a + b, 0) / momentumScores.length
    : 0;

  return {
    runId,
    mode: 'solo',
    totalTicks: frame.tick,
    finalOutcome: participant.snapshot.outcome ?? 'IN_PROGRESS',
    phasePerformance: engineState.phasePerformance,
    cardDecisions: engineState.cardDecisions,
    ipaPortfolioSummary: {
      typesAcquired: Array.from(engineState.ipaPortfolio.types),
      synergiesUnlocked: engineState.ipaPortfolio.synergyBonusesApplied,
      sovereignPositionReached: engineState.ipaPortfolio.sovereignPositionActive,
    },
    holdEfficiency: {
      holdsUsed: engineState.hold.holdsUsed,
      noHoldBonus: engineState.hold.noHoldRun,
      holdTimingScores,
    },
    comebackDetection: {
      comebackTriggered: engineState.comebackSurge.cordBonusTagged,
      dropTick: engineState.comebackSurge.dropTick,
      recoveryTick: engineState.comebackSurge.recoveryTick,
      cordBonusAwarded: engineState.comebackSurge.cordBonusTagged,
    },
    isolationTaxSummary: {
      totalTaxPaid: engineState.isolationTax.totalTaxApplied,
      peakMultiplier: engineState.peakIsolationMultiplier,
      consecutiveNegativeStreak: engineState.isolationTax.consecutiveNegativeCount,
    },
    debtBurdenSummary: {
      peakDebt: engineState.peakDebt,
      peakDebtToIncome: engineState.peakDebtToIncome,
      interestPaid: engineState.debtBurden.interestAccrued,
    },
    soConversionSummary: {
      totalConversions,
      routeBreakdown,
      averageCordBonus,
    },
    educationalSummary: {
      tagsEngaged: engagedTags,
      tagsAvoided: avoidedTags,
      engagementQuality,
    },
    momentumSummary: {
      peakMomentum: engineState.peakMomentum,
      averageMomentum,
      qualityTierReached: engineState.momentum.qualityTier,
    },
    mlFeatureSnapshots: engineState.mlSnapshots,
    chatSignals: engineState.chatSignals,
  };
}

// ============================================================================
// S18 — SOLO ENGINE STATE SERIALIZATION
// ============================================================================

function createEmptyEngineState(phase: RunPhase): SoloEngineState {
  return {
    ipaPortfolio: createEmptyIPAPortfolio(),
    momentum: createEmptyMomentumState(),
    isolationTax: createEmptyIsolationTaxState(),
    hold: createEmptyHoldState(),
    comebackSurge: createEmptyComebackSurgeState(),
    debtBurden: createEmptyDebtBurdenState(),
    soConversions: [],
    educationalEngagements: {},
    phasePerformance: [],
    cardDecisions: [],
    chatSignals: [],
    mlSnapshots: [],
    phaseChangeCount: 0,
    lastPhase: phase,
    peakMomentum: 0,
    peakDebt: 0,
    peakDebtToIncome: 0,
    peakIsolationMultiplier: 0,
    totalCardsPlayed: 0,
    currentPhaseCardsPlayed: 0,
    currentPhaseCashDelta: 0,
    currentPhaseShieldDelta: 0,
    currentPhaseExtractions: 0,
    currentPhaseCounters: 0,
    currentPhaseIPAs: 0,
  };
}

function serializeEngineState(state: SoloEngineState): string {
  const serializable = {
    ...state,
    ipaPortfolio: {
      ...state.ipaPortfolio,
      types: Array.from(state.ipaPortfolio.types),
    },
  };
  return JSON.stringify(serializable);
}

function deserializeEngineState(raw: string): SoloEngineState {
  const parsed = JSON.parse(raw);
  return {
    ...parsed,
    ipaPortfolio: {
      ...parsed.ipaPortfolio,
      types: new Set(parsed.ipaPortfolio.types),
    },
  };
}

function loadEngineState(participant: ModeParticipant): SoloEngineState {
  const raw = participant.metadata['soloEngineState'];
  if (typeof raw === 'string' && raw.length > 0) {
    return deserializeEngineState(raw);
  }
  return createEmptyEngineState(participant.snapshot.phase);
}

function saveEngineState(
  participant: ModeParticipant,
  state: SoloEngineState,
): ModeParticipant {
  const cloned = cloneParticipant(participant);
  cloned.metadata['soloEngineState'] = serializeEngineState(state);
  return cloned;
}

// ============================================================================
// S19 — HANDICAP & ADVANTAGE APPLICATION
// ============================================================================

function applyHandicap(frame: ModeFrame, handicapId: string): ModeFrame {
  let next = cloneFrame(frame);
  const actorId = next.participants[0].playerId;

  if (handicapId === 'NO_CREDIT_HISTORY') {
    next = updateParticipant(next, actorId, (p) => {
      const cloned = mutableClone(p);
      const layer = cloned.snapshot.shield.layers.find((entry) => entry.layerId === 'L2');
      if (layer) {
        layer.current = Math.min(layer.current, 40);
        layer.max = Math.min(layer.max, 40);
      }
      cloned.metadata['debtCostMultiplier'] = 1.3;
      return cloned as ModeParticipant;
    });
  } else if (handicapId === 'SINGLE_INCOME') {
    next = updateParticipant(next, actorId, (p) => ({
      ...p,
      metadata: { ...p.metadata, singleIncome: true },
    }));
  } else if (handicapId === 'TARGETED') {
    next = updateParticipant(next, actorId, (p) => {
      const cloned = mutableClone(p);
      cloned.snapshot.battle.bots = cloned.snapshot.battle.bots.map((bot) =>
        bot.botId === 'BOT_01' ? { ...bot, heat: Math.max(bot.heat, 20) } : bot,
      );
      return cloned as ModeParticipant;
    });
  } else if (handicapId === 'CASH_POOR') {
    next = updateParticipant(next, actorId, (p) => {
      const cloned = mutableClone(p);
      cloned.snapshot.economy.cash = Math.min(cloned.snapshot.economy.cash, 10000);
      return cloned as ModeParticipant;
    });
  } else if (handicapId === 'CLOCK_CURSED') {
    next = updateParticipant(next, actorId, (p) => {
      const cloned = mutableClone(p);
      cloned.snapshot.timers.seasonBudgetMs = Math.min(
        cloned.snapshot.timers.seasonBudgetMs,
        9 * 60 * 1000,
      );
      return cloned as ModeParticipant;
    });
  }
  return next;
}

function applyAdvantage(frame: ModeFrame, advantageId: string | null): ModeFrame {
  if (!advantageId) return frame;
  let next = cloneFrame(frame);
  const actorId = next.participants[0].playerId;

  if (advantageId === 'MOMENTUM_CAPITAL') {
    next = updateParticipant(next, actorId, (p) => {
      const cloned = mutableClone(p);
      cloned.snapshot.economy.cash += 10000;
      return cloned as ModeParticipant;
    });
  } else if (advantageId === 'NETWORK_ACTIVATED') {
    next = updateParticipant(next, actorId, (p) => {
      const cloned = mutableClone(p);
      const layer = cloned.snapshot.shield.layers.find((entry) => entry.layerId === 'L4');
      if (layer) {
        layer.max = Math.round(layer.max * 1.5);
        layer.current = Math.round(layer.current * 1.5);
      }
      return cloned as ModeParticipant;
    });
  } else if (advantageId === 'FORECLOSURE_BLOCK') {
    next = updateParticipant(next, actorId, (p) => ({
      ...p,
      metadata: { ...p.metadata, foreclosureBlockUntilTick: 5 },
    }));
  } else if (advantageId === 'INTEL_PASS') {
    next = updateParticipant(next, actorId, (p) => ({
      ...p,
      metadata: { ...p.metadata, exposedThreatAllowance: 3 },
    }));
  } else if (advantageId === 'PHANTOM_SEED') {
    next = updateParticipant(next, actorId, (p) => ({
      ...p,
      metadata: { ...p.metadata, phantomSeedDraw: 1 },
    }));
  } else if (advantageId === 'DEBT_SHIELD') {
    next = updateParticipant(next, actorId, (p) => ({
      ...p,
      metadata: { ...p.metadata, autoDebtCounter: 1 },
    }));
  }
  return next;
}

// ============================================================================
// S20 — TICK PROCESSING SUBROUTINES
// ============================================================================

function processPhaseTransition(
  frame: ModeFrame,
  participant: ModeParticipant,
  engineState: SoloEngineState,
  currentPhase: RunPhase,
  newPhase: RunPhase,
): { frame: ModeFrame; participant: ModeParticipant; engineState: SoloEngineState } {
  let nextFrame = frame;

  const phaseRecord: PhasePerformance = {
    phase: phaseToRunPhaseId(currentPhase),
    cardsPlayed: engineState.currentPhaseCardsPlayed,
    cashDelta: engineState.currentPhaseCashDelta,
    shieldDelta: engineState.currentPhaseShieldDelta,
    extractionsSuffered: engineState.currentPhaseExtractions,
    counterPlays: engineState.currentPhaseCounters,
    ipaAcquisitions: engineState.currentPhaseIPAs,
    momentumAtEnd: engineState.momentum.score,
    isolationTaxPaid: engineState.isolationTax.totalTaxApplied,
    holdUsed: !engineState.hold.noHoldRun,
  };

  const opened = openPhaseBoundaryWindow(participant);
  const pMut = mutableClone(opened);
  pMut.snapshot.phase = newPhase;
  let p: ModeParticipant = pMut as ModeParticipant;

  const phaseIsDouble = doublePhaseChange(currentPhase, newPhase);
  let holdState = checkHoldExpiry(engineState.hold, true);
  if (phaseIsDouble) {
    holdState = checkHoldExpiry(holdState, true);
  }

  let signals = emitPhaseTransitionSignal(
    engineState.chatSignals,
    frame.tick,
    currentPhase,
    newPhase,
  );
  signals = emitPhaseBoundaryCardSignal(signals, frame.tick, PHASE_BOUNDARY_WINDOW_TICKS);

  nextFrame = pushEvent(nextFrame, {
    tick: nextFrame.tick,
    level: newPhase === 'SOVEREIGNTY' ? 'ALERT' : 'WARNING',
    channel: 'SYSTEM',
    actorId: null,
    code: 'PHASE_TRANSITION',
    message: newPhase === 'ESCALATION'
      ? 'Phase 2 has begun. The haters are awake.'
      : 'Phase 3 has begun. Sovereignty pressure is live.',
  });

  const updatedState: SoloEngineState = {
    ...engineState,
    phasePerformance: [...engineState.phasePerformance, phaseRecord],
    phaseChangeCount: engineState.phaseChangeCount + 1,
    lastPhase: newPhase,
    hold: holdState,
    chatSignals: signals,
    currentPhaseCardsPlayed: 0,
    currentPhaseCashDelta: 0,
    currentPhaseShieldDelta: 0,
    currentPhaseExtractions: 0,
    currentPhaseCounters: 0,
    currentPhaseIPAs: 0,
  };

  return { frame: nextFrame, participant: p, engineState: updatedState };
}

function processIsolationTax(
  participant: ModeParticipant,
  engineState: SoloEngineState,
  tick: number,
): { participant: ModeParticipant; engineState: SoloEngineState } {
  const lastPlayedCards = participant.snapshot.cards.lastPlayed;
  const hasNegative = lastPlayedCards.some(
    (id) => id.includes('FUBAR') || id.includes('MISSED_OPPORTUNITY'),
  );

  let taxState = engineState.isolationTax;
  let signals = engineState.chatSignals;

  if (hasNegative) {
    taxState = applyNegativeEvent(taxState, tick);
  } else if (lastPlayedCards.length > 0) {
    taxState = resetIsolationStreak(taxState);
  }

  let p = participant;
  if (taxState.currentMultiplier > 0) {
    const { taxAmount, newTotal } = computeIsolationTax(
      taxState,
      p.snapshot.economy.expensesPerTick,
    );
    if (taxAmount > 0) {
      const cloned = mutableClone(p);
      cloned.snapshot.economy.cash = Math.max(0, cloned.snapshot.economy.cash - taxAmount);
      p = cloned as ModeParticipant;
      taxState = {
        ...taxState,
        totalTaxApplied: newTotal,
      };
    }

    if (taxState.consecutiveNegativeCount >= 3) {
      signals = emitIsolationTaxWarning(
        signals,
        tick,
        taxState.currentMultiplier,
        taxState.consecutiveNegativeCount,
      );
    }
  }

  const peakMultiplier = Math.max(engineState.peakIsolationMultiplier, taxState.currentMultiplier);

  return {
    participant: p,
    engineState: {
      ...engineState,
      isolationTax: taxState,
      chatSignals: signals,
      peakIsolationMultiplier: peakMultiplier,
    },
  };
}

function processDebtCompounding(
  participant: ModeParticipant,
  engineState: SoloEngineState,
  tick: number,
): { participant: ModeParticipant; engineState: SoloEngineState } {
  if (engineState.debtBurden.totalDebt <= 0) return { participant, engineState };

  const incomePerTick = participant.snapshot.economy.incomePerTick;
  let debtState = compoundDebtInterest(engineState.debtBurden, incomePerTick);
  let signals = engineState.chatSignals;

  const cloned = mutableClone(participant);
  cloned.snapshot.economy.debt = debtState.totalDebt;

  if (isDebtCritical(debtState)) {
    signals = emitDebtCriticalSignal(signals, tick, debtState.debtToIncomeRatio);
    cloned.snapshot.economy.expensesPerTick = Math.round(
      cloned.snapshot.economy.expensesPerTick * 1.1,
    );
  }

  const peakDebt = Math.max(engineState.peakDebt, debtState.totalDebt);
  const peakRatio = Math.max(engineState.peakDebtToIncome, debtState.debtToIncomeRatio);

  return {
    participant: cloned as ModeParticipant,
    engineState: {
      ...engineState,
      debtBurden: debtState,
      chatSignals: signals,
      peakDebt,
      peakDebtToIncome: peakRatio,
    },
  };
}

function processComebackSurge(
  participant: ModeParticipant,
  engineState: SoloEngineState,
  tick: number,
): { participant: ModeParticipant; engineState: SoloEngineState } {
  const cash = participant.snapshot.economy.cash;
  const freedomTarget = participant.snapshot.economy.freedomTarget;
  const prevState = engineState.comebackSurge;
  const newState = evaluateComebackSurge(prevState, cash, freedomTarget, tick);
  let signals = engineState.chatSignals;

  if (newState.active && !prevState.active) {
    signals = emitComebackSurgeSignal(signals, tick, true);
    const cloned = mutableClone(participant);
    cloned.snapshot.tags = [...cloned.snapshot.tags, 'COMEBACK_SURGE'];
    return {
      participant: cloned as ModeParticipant,
      engineState: { ...engineState, comebackSurge: newState, chatSignals: signals },
    };
  }

  if (!newState.active && prevState.active) {
    signals = emitComebackSurgeSignal(signals, tick, false);
  }

  return {
    participant,
    engineState: { ...engineState, comebackSurge: newState, chatSignals: signals },
  };
}

function processMomentumDecay(
  engineState: SoloEngineState,
): SoloEngineState {
  const decayed = decayMomentum(engineState.momentum);
  return {
    ...engineState,
    momentum: decayed,
  };
}

function processMLCapture(
  participant: ModeParticipant,
  engineState: SoloEngineState,
  tick: number,
): SoloEngineState {
  if (tick % 5 !== 0) return engineState;
  const snapshot = captureMLSnapshot(participant, engineState, tick);
  return {
    ...engineState,
    mlSnapshots: [...engineState.mlSnapshots, snapshot],
  };
}

function processForkHints(
  participant: ModeParticipant,
  tick: number,
): ModeParticipant {
  if (tick % 15 !== 0) return participant;

  let hint = 'Foundation remains open. Build income before the haters circle.';
  const phase = participant.snapshot.phase;
  if (phase === 'ESCALATION') {
    hint = 'Escalation live: hesitation is extending Manipulator pressure.';
  } else if (phase === 'SOVEREIGNTY') {
    hint = 'Sovereignty live: every tick under pressure is worth more if you survive it.';
  }
  return addForkHint(participant, hint);
}

function processIncomeDryStreak(
  participant: ModeParticipant,
): ModeParticipant {
  const hasIncomeCard = participant.snapshot.cards.hand.some((card) => card.tags.includes('income'));
  const cloned = mutableClone(participant);
  const dryStreak = Number(cloned.metadata['incomeDryStreak'] ?? 0);
  cloned.metadata['incomeDryStreak'] = hasIncomeCard ? 0 : dryStreak + 1;

  if (Number(cloned.metadata['incomeDryStreak']) >= 3) {
    cloned.snapshot.sovereignty.sovereigntyScore = Number(
      (cloned.snapshot.sovereignty.sovereigntyScore - 0.002).toFixed(6),
    );
  }
  return cloned as ModeParticipant;
}

function processLowCashShieldPenalty(participant: ModeParticipant): ModeParticipant {
  if (participant.snapshot.economy.cash >= 5000) return participant;
  const cloned = mutableClone(participant);
  const liquidity = cloned.snapshot.shield.layers.find((layer) => layer.layerId === 'L1');
  if (liquidity) {
    liquidity.regenPerTick = Math.max(1, Math.floor(liquidity.regenPerTick / 2));
  }
  return cloned as ModeParticipant;
}

function processCascadeAmplifier(participant: ModeParticipant): ModeParticipant {
  const repeated = Object.values(
    participant.snapshot.cascade.repeatedTriggerCounts as Record<string, number>,
  ).some((value) => value >= 2);
  if (!repeated) return participant;
  const cloned = cloneParticipant(participant);
  cloned.metadata['cascadeAmplifier'] = 1.5;
  return cloned;
}

function processHighPressureWindowShrink(participant: ModeParticipant): ModeParticipant {
  const tier = participant.snapshot.pressure.tier;
  const noShield = participant.snapshot.shield.layers.every((layer) => layer.current <= 0);
  if ((tier !== 'T3' && tier !== 'T4') || !noShield) return participant;

  const cloned = mutableClone(participant);
  const shrinkFactor = 0.75;
  cloned.snapshot.timers.activeDecisionWindows = Object.fromEntries(
    Object.entries(cloned.snapshot.timers.activeDecisionWindows).map(([key, window]) => [
      key,
      {
        ...window,
        closesAtTick: window.closesAtTick !== null
          ? Math.max(window.openedAtTick + 1, Math.floor(window.openedAtTick + (window.closesAtTick - window.openedAtTick) * shrinkFactor))
          : null,
        closesAtMs: window.closesAtMs !== null
          ? Math.max(window.openedAtMs + 1000, Math.floor(window.openedAtMs + (window.closesAtMs - window.openedAtMs) * shrinkFactor))
          : null,
      },
    ]),
  );
  return cloned as ModeParticipant;
}

function processComebackLowCashTracking(
  participant: ModeParticipant,
  tick: number,
): ModeParticipant {
  const cloned = mutableClone(participant);

  if (cloned.snapshot.economy.cash < 2000) {
    cloned.metadata['comebackLowCashTicks'] = Number(
      cloned.metadata['comebackLowCashTicks'] ?? 0,
    ) + 1;
    const currentFloor = Number(cloned.metadata['cashFloor'] ?? Number.MAX_SAFE_INTEGER);
    cloned.metadata['cashFloor'] = Math.min(currentFloor, cloned.snapshot.economy.cash);
  } else {
    const streak = Number(cloned.metadata['comebackLowCashTicks'] ?? 0);
    if (streak >= 15 && cloned.snapshot.economy.cash > 8000) {
      cloned.metadata['comebackSurgeUntilTick'] = tick + 20;
      if (!cloned.snapshot.tags.includes('COMEBACK_SURGE')) {
        cloned.snapshot.tags = [...cloned.snapshot.tags, 'COMEBACK_SURGE'];
      }
    }
    if (streak >= 15 && cloned.snapshot.economy.cash > 20000) {
      cloned.snapshot.shield.layers = cloned.snapshot.shield.layers.map((layer) => ({
        ...layer,
        regenPerTick: layer.regenPerTick * 2,
      }));
    }
    cloned.metadata['comebackLowCashTicks'] = 0;
  }

  if (Number(cloned.metadata['comebackSurgeUntilTick'] ?? -1) >= tick) {
    cloned.metadata['decisionSpeedCordWeight'] = getComebackDecisionSpeedWeight(
      { active: true, droppedBelowThreshold: true, dropTick: null, recoveryTick: null, surgeExpiryTick: null, cordBonusTagged: false },
    );
  }

  return cloned as ModeParticipant;
}

function processLiquidatorImmunity(
  participant: ModeParticipant,
  portfolio: IPAPortfolio,
): ModeParticipant {
  if (!isLiquidatorImmune(portfolio)) return participant;
  const cloned = mutableClone(participant);
  cloned.snapshot.battle.bots = cloned.snapshot.battle.bots.map((bot) =>
    bot.botId === 'BOT_05' ? { ...bot, state: 'DORMANT' as const, heat: 0 } : bot,
  );
  return cloned as ModeParticipant;
}

// ============================================================================
// S21 — CARD PLAY PROCESSING
// ============================================================================

function processCardPlayForEngine(
  participant: ModeParticipant,
  engineState: SoloEngineState,
  card: CardDefinition,
  tick: number,
  timingDelta: number,
): { participant: ModeParticipant; engineState: SoloEngineState } {
  let p = participant;
  let state = { ...engineState };

  state = {
    ...state,
    totalCardsPlayed: state.totalCardsPlayed + 1,
    currentPhaseCardsPlayed: state.currentPhaseCardsPlayed + 1,
  };

  if (card.educationalTag) {
    const quality = Math.max(0, Number((1 - timingDelta * 0.1).toFixed(4)));
    state = {
      ...state,
      educationalEngagements: recordEducationalTag(
        state.educationalEngagements,
        card.educationalTag,
        quality,
        tick,
      ),
    };
  }

  if (card.deckType === 'OPPORTUNITY' || card.deckType === 'IPA') {
    const newMomentum = incrementMomentum(state.momentum, tick);
    state = {
      ...state,
      momentum: newMomentum,
      peakMomentum: Math.max(state.peakMomentum, newMomentum.score),
    };
  }

  if (card.deckType === 'IPA') {
    const ipaType = classifyIPAType(card);
    if (ipaType) {
      let portfolio = addIPAToPortfolio(state.ipaPortfolio, ipaType, tick);
      const synergies = detectIPASynergies(portfolio);
      const newSynergies = synergies.filter(
        (s) => !portfolio.synergyBonusesApplied.includes(s),
      );

      if (newSynergies.length > 0) {
        const result = applyIPASynergyEffects(p, portfolio, newSynergies);
        p = result.participant;
        portfolio = result.portfolio;

        let signals = state.chatSignals;
        for (const synergy of newSynergies) {
          signals = emitIPASynergySignal(signals, tick, synergy);
        }
        state = { ...state, chatSignals: signals };
      }

      state = {
        ...state,
        ipaPortfolio: portfolio,
        currentPhaseIPAs: state.currentPhaseIPAs + 1,
      };
    }
  }

  if (card.deckType === 'FUBAR' || card.deckType === 'MISSED_OPPORTUNITY') {
    state = {
      ...state,
      isolationTax: applyNegativeEvent(state.isolationTax, tick),
      currentPhaseExtractions: state.currentPhaseExtractions + 1,
    };
  }

  if (card.deckType === 'COUNTER' || card.deckType === 'DISCIPLINE') {
    state = {
      ...state,
      currentPhaseCounters: state.currentPhaseCounters + 1,
    };
  }

  if (card.baseEffect.debtDelta && card.baseEffect.debtDelta > 0) {
    state = {
      ...state,
      debtBurden: attachDebtCard(state.debtBurden, card.id, card.baseEffect.debtDelta),
    };
  }

  if (card.baseEffect.cashDelta) {
    state = {
      ...state,
      currentPhaseCashDelta: state.currentPhaseCashDelta + (card.baseEffect.cashDelta ?? 0),
    };
  }

  if (card.baseEffect.shieldDelta) {
    state = {
      ...state,
      currentPhaseShieldDelta: state.currentPhaseShieldDelta + (card.baseEffect.shieldDelta ?? 0),
    };
  }

  const audit = auditCardDecision(
    p.playerId,
    card.id,
    'solo',
    timingDelta,
    card.baseCost,
    [`phase=${p.snapshot.phase}`, `momentum=${state.momentum.score.toFixed(2)}`],
  );
  state = {
    ...state,
    cardDecisions: [...state.cardDecisions, audit],
  };

  return { participant: p, engineState: state };
}

// ============================================================================
// S21b — DECISION QUALITY SCORING
// ============================================================================
//
// Every card play in Empire mode is scored on three axes:
//   1. Timing Delta — how close to optimal the play was
//   2. Opportunity Cost — what the player forfeited by choosing this card
//   3. Cascade Intercept Rate — whether the play intercepted or extended cascades
//
// These three produce a composite Decision Quality Score (DQS) per card play,
// aggregated into run-level statistics used by the case file and ML pipeline.
//

/** Thresholds for decision quality classification. */
const DQS_EXCELLENT_THRESHOLD = 0.85;
const DQS_GOOD_THRESHOLD = 0.60;
const DQS_MEDIOCRE_THRESHOLD = 0.35;
const DQS_POOR_THRESHOLD = 0.15;

/** Weight allocation for the three DQS axes. */
const DQS_TIMING_WEIGHT = 0.45;
const DQS_OPPORTUNITY_COST_WEIGHT = 0.30;
const DQS_CASCADE_INTERCEPT_WEIGHT = 0.25;

/** Decision quality classification labels. */
type DecisionQualityLabel = 'EXCELLENT' | 'GOOD' | 'MEDIOCRE' | 'POOR' | 'CATASTROPHIC';

/** Per-play decision quality record. */
interface DecisionQualityRecord {
  readonly cardId: string;
  readonly tick: number;
  readonly timingScore: number;
  readonly opportunityCostScore: number;
  readonly cascadeInterceptScore: number;
  readonly compositeScore: number;
  readonly label: DecisionQualityLabel;
  readonly phase: RunPhase;
}

/** Aggregate decision quality statistics for a run. */
interface DecisionQualityAggregate {
  readonly totalDecisions: number;
  readonly averageComposite: number;
  readonly excellentCount: number;
  readonly goodCount: number;
  readonly mediocreCount: number;
  readonly poorCount: number;
  readonly catastrophicCount: number;
  readonly bestDecision: DecisionQualityRecord | null;
  readonly worstDecision: DecisionQualityRecord | null;
  readonly streakBestLength: number;
  readonly streakWorstLength: number;
  readonly phaseBreakdown: Record<string, { count: number; averageScore: number }>;
}

function classifyDecisionQuality(score: number): DecisionQualityLabel {
  if (score >= DQS_EXCELLENT_THRESHOLD) return 'EXCELLENT';
  if (score >= DQS_GOOD_THRESHOLD) return 'GOOD';
  if (score >= DQS_MEDIOCRE_THRESHOLD) return 'MEDIOCRE';
  if (score >= DQS_POOR_THRESHOLD) return 'POOR';
  return 'CATASTROPHIC';
}

function computeTimingScore(timingDelta: number): number {
  // Perfect timing = 0 delta, score = 1.0
  // Each second of delay reduces score by 0.15
  return Math.max(0, Math.min(1.0, Number((1.0 - timingDelta * 0.15).toFixed(4))));
}

function computeOpportunityCostScore(
  card: CardDefinition,
  handSize: number,
  cash: number,
  freedomTarget: number,
): number {
  // Opportunity cost is low when:
  //   - The card directly advances toward freedom (income/IPA)
  //   - The hand is small (fewer alternatives)
  //   - Cash is high relative to freedom target (less risk)
  const directAdvancement = (card.deckType === 'IPA' || card.deckType === 'OPPORTUNITY') ? 0.4 : 0.0;
  const handPenalty = Math.min(0.3, handSize * 0.03);
  const cashSafety = Math.min(0.3, (cash / Math.max(1, freedomTarget)) * 0.3);
  return Math.min(1.0, Number((directAdvancement + (0.3 - handPenalty) + cashSafety).toFixed(4)));
}

function computeCascadeInterceptScore(
  participant: ModeParticipant,
  card: CardDefinition,
): number {
  // Cards that break negative cascade chains score higher
  // Cards that trigger positive cascades also score higher
  const activeChains = participant.snapshot.cascade.activeChains;
  const negativeChainsActive = activeChains.filter(
    (chain) => !chain.positive,
  ).length;
  const isCounterCard = card.deckType === 'COUNTER' || card.deckType === 'DISCIPLINE';
  const isPositiveCard = card.deckType === 'OPPORTUNITY' || card.deckType === 'IPA';

  if (negativeChainsActive > 0 && isCounterCard) {
    // Intercepting a negative cascade — high score
    return Math.min(1.0, 0.7 + negativeChainsActive * 0.1);
  }
  if (negativeChainsActive === 0 && isPositiveCard) {
    // Building during calm — moderate score
    return 0.5;
  }
  if (negativeChainsActive > 0 && isPositiveCard) {
    // Building while under attack — risky but brave
    return 0.3;
  }
  // Neutral play
  return 0.4;
}

function scoreDecision(
  participant: ModeParticipant,
  card: CardDefinition,
  tick: number,
  timingDelta: number,
): DecisionQualityRecord {
  const timingScore = computeTimingScore(timingDelta);
  const opportunityCostScore = computeOpportunityCostScore(
    card,
    participant.snapshot.cards.hand.length,
    participant.snapshot.economy.cash,
    participant.snapshot.economy.freedomTarget,
  );
  const cascadeInterceptScore = computeCascadeInterceptScore(participant, card);

  const compositeScore = Number((
    timingScore * DQS_TIMING_WEIGHT +
    opportunityCostScore * DQS_OPPORTUNITY_COST_WEIGHT +
    cascadeInterceptScore * DQS_CASCADE_INTERCEPT_WEIGHT
  ).toFixed(4));

  return {
    cardId: card.id,
    tick,
    timingScore,
    opportunityCostScore,
    cascadeInterceptScore,
    compositeScore,
    label: classifyDecisionQuality(compositeScore),
    phase: participant.snapshot.phase,
  };
}

function aggregateDecisionQuality(
  records: DecisionQualityRecord[],
): DecisionQualityAggregate {
  if (records.length === 0) {
    return {
      totalDecisions: 0,
      averageComposite: 0,
      excellentCount: 0,
      goodCount: 0,
      mediocreCount: 0,
      poorCount: 0,
      catastrophicCount: 0,
      bestDecision: null,
      worstDecision: null,
      streakBestLength: 0,
      streakWorstLength: 0,
      phaseBreakdown: {},
    };
  }

  const totalComposite = records.reduce((sum, r) => sum + r.compositeScore, 0);
  const avg = Number((totalComposite / records.length).toFixed(4));

  let excellentCount = 0;
  let goodCount = 0;
  let mediocreCount = 0;
  let poorCount = 0;
  let catastrophicCount = 0;
  let best: DecisionQualityRecord = records[0];
  let worst: DecisionQualityRecord = records[0];

  let currentBestStreak = 0;
  let maxBestStreak = 0;
  let currentWorstStreak = 0;
  let maxWorstStreak = 0;

  const phaseMap: Record<string, { count: number; totalScore: number }> = {};

  for (const record of records) {
    if (record.compositeScore > best.compositeScore) best = record;
    if (record.compositeScore < worst.compositeScore) worst = record;

    if (record.label === 'EXCELLENT') { excellentCount++; }
    else if (record.label === 'GOOD') { goodCount++; }
    else if (record.label === 'MEDIOCRE') { mediocreCount++; }
    else if (record.label === 'POOR') { poorCount++; }
    else { catastrophicCount++; }

    if (record.compositeScore >= DQS_GOOD_THRESHOLD) {
      currentBestStreak++;
      maxBestStreak = Math.max(maxBestStreak, currentBestStreak);
      currentWorstStreak = 0;
    } else if (record.compositeScore < DQS_MEDIOCRE_THRESHOLD) {
      currentWorstStreak++;
      maxWorstStreak = Math.max(maxWorstStreak, currentWorstStreak);
      currentBestStreak = 0;
    } else {
      currentBestStreak = 0;
      currentWorstStreak = 0;
    }

    const phaseKey = record.phase;
    if (!phaseMap[phaseKey]) {
      phaseMap[phaseKey] = { count: 0, totalScore: 0 };
    }
    phaseMap[phaseKey].count++;
    phaseMap[phaseKey].totalScore += record.compositeScore;
  }

  const phaseBreakdown: Record<string, { count: number; averageScore: number }> = {};
  for (const [phase, data] of Object.entries(phaseMap)) {
    phaseBreakdown[phase] = {
      count: data.count,
      averageScore: Number((data.totalScore / data.count).toFixed(4)),
    };
  }

  return {
    totalDecisions: records.length,
    averageComposite: avg,
    excellentCount,
    goodCount,
    mediocreCount,
    poorCount,
    catastrophicCount,
    bestDecision: best,
    worstDecision: worst,
    streakBestLength: maxBestStreak,
    streakWorstLength: maxWorstStreak,
    phaseBreakdown,
  };
}

// ============================================================================
// S21c — IPA CHAIN SYNERGY DEEP EVALUATION
// ============================================================================
//
// Beyond the binary synergy unlock, the synergy engine evaluates synergy
// STRENGTH based on timing, portfolio diversity velocity, and phase context.
//

/** Synergy strength classification. */
type SynergyStrengthLabel = 'DORMANT' | 'EMERGING' | 'ACTIVE' | 'DOMINANT';

/** Detailed synergy evaluation record. */
interface SynergyEvaluation {
  readonly synergyId: string;
  readonly strengthLabel: SynergyStrengthLabel;
  readonly strengthScore: number;
  readonly activatedAtTick: number;
  readonly phaseWhenActivated: RunPhase;
  readonly incomeImpact: number;
  readonly shieldImpact: number;
  readonly expenseReduction: number;
}

function evaluateSynergyStrength(
  synergy: string,
  activationTick: number,
  totalTicks: number,
  phase: RunPhase,
): { label: SynergyStrengthLabel; score: number } {
  // Earlier activation = stronger long-term value
  const timingFraction = totalTicks > 0 ? activationTick / totalTicks : 0.5;
  const earlinessBonus = Math.max(0, 1.0 - timingFraction);

  // Phase context: Foundation synergies are game-changing, Sovereignty synergies are late
  const phaseMultiplier = phase === 'FOUNDATION' ? 1.5
    : phase === 'ESCALATION' ? 1.0
    : 0.7;

  // Synergy type bonus
  const typeBonus = synergy === 'SOVEREIGN_POSITION' ? 0.4
    : synergy === 'AUTOMATION_TRIGGER' ? 0.2
    : 0.1;

  const raw = Number(((earlinessBonus * phaseMultiplier + typeBonus) / 2.0).toFixed(4));
  const score = Math.min(1.0, raw);

  let label: SynergyStrengthLabel;
  if (score >= 0.75) label = 'DOMINANT';
  else if (score >= 0.45) label = 'ACTIVE';
  else if (score >= 0.20) label = 'EMERGING';
  else label = 'DORMANT';

  return { label, score };
}

function buildSynergyEvaluation(
  synergy: string,
  portfolio: IPAPortfolio,
  tick: number,
  totalTicks: number,
  phase: RunPhase,
  participant: ModeParticipant,
): SynergyEvaluation {
  const { label, score } = evaluateSynergyStrength(synergy, tick, totalTicks, phase);

  let incomeImpact = 0;
  let shieldImpact = 0;
  let expenseReduction = 0;

  if (synergy === 'REAL_ESTATE_EQUITY') {
    incomeImpact = Math.round(participant.snapshot.economy.incomePerTick * IPA_SYNERGY_REAL_ESTATE_EQUITY_INCOME_BONUS);
  } else if (synergy === 'DIGITAL_LICENSING') {
    incomeImpact = Math.round(participant.snapshot.economy.incomePerTick * IPA_SYNERGY_DIGITAL_LICENSING_CASHFLOW_BONUS);
  } else if (synergy === 'BUSINESS_REAL_ESTATE') {
    incomeImpact = IPA_SYNERGY_BUSINESS_REAL_ESTATE_MONTHLY_BONUS;
  } else if (synergy === 'AUTOMATION_TRIGGER') {
    expenseReduction = Math.round(participant.snapshot.economy.expensesPerTick * 0.15);
  } else if (synergy === 'SOVEREIGN_POSITION') {
    const totalRegen = participant.snapshot.shield.layers.reduce(
      (sum, layer) => sum + layer.regenPerTick, 0,
    );
    shieldImpact = totalRegen * (IPA_SYNERGY_ALL_FOUR_SOVEREIGN_SHIELD_REGEN_MULTIPLIER - 1);
  }

  return {
    synergyId: synergy,
    strengthLabel: label,
    strengthScore: score,
    activatedAtTick: tick,
    phaseWhenActivated: phase,
    incomeImpact,
    shieldImpact,
    expenseReduction,
  };
}

function computePortfolioDiversityVelocity(
  portfolio: IPAPortfolio,
  currentTick: number,
): number {
  // How fast the player is diversifying their IPA portfolio
  const acquisitions = Object.values(portfolio.acquisitionTicks);
  if (acquisitions.length <= 1) return 0;
  const sorted = [...acquisitions].sort((a, b) => a - b);
  const span = sorted[sorted.length - 1] - sorted[0];
  if (span <= 0) return 1.0;
  // Faster acquisition = higher velocity
  const ticksPerAcquisition = span / (sorted.length - 1);
  return Math.min(1.0, Number((10 / Math.max(1, ticksPerAcquisition)).toFixed(4)));
}

function evaluateIPAPortfolioHealth(
  portfolio: IPAPortfolio,
  participant: ModeParticipant,
  tick: number,
): {
  diversityScore: number;
  velocityScore: number;
  synergyCount: number;
  sovereignReady: boolean;
  missingTypes: IPAType[];
  estimatedTicksToSovereign: number;
} {
  const diversityScore = Math.min(1.0, portfolio.types.size / IPA_TYPES.length);
  const velocityScore = computePortfolioDiversityVelocity(portfolio, tick);
  const synergyCount = portfolio.synergyBonusesApplied.length;
  const sovereignReady = portfolio.sovereignPositionActive;
  const allTypes = new Set(IPA_TYPES);
  const missingTypes: IPAType[] = [];
  for (const t of allTypes) {
    if (!portfolio.types.has(t)) missingTypes.push(t);
  }
  // Estimate ticks to sovereign based on current velocity
  const estimatedTicksToSovereign = missingTypes.length === 0 ? 0
    : velocityScore > 0 ? Math.round(missingTypes.length / velocityScore * 10)
    : 999;

  return {
    diversityScore,
    velocityScore,
    synergyCount,
    sovereignReady,
    missingTypes,
    estimatedTicksToSovereign,
  };
}

// ============================================================================
// S21d — PHASE BOUNDARY CARD GENERATION
// ============================================================================
//
// At each phase transition, the engine generates special phase-boundary cards
// that are only available during the boundary window. These cards represent
// pivotal decisions that shape the rest of the run.
//

/** Phase boundary card specification. */
interface PhaseBoundaryCardSpec {
  readonly cardId: string;
  readonly phase: RunPhase;
  readonly targetPhase: RunPhase;
  readonly label: string;
  readonly description: string;
  readonly costRange: { min: number; max: number };
  readonly effectDescription: string;
  readonly windowTicks: number;
  readonly educationalTag: string;
}

/** All phase boundary card specs. */
const PHASE_BOUNDARY_CARD_SPECS: readonly PhaseBoundaryCardSpec[] = [
  {
    cardId: 'MOMENTUM_PIVOT',
    phase: 'FOUNDATION',
    targetPhase: 'ESCALATION',
    label: 'Momentum Pivot',
    description: 'Redirect accumulated Foundation momentum into Escalation leverage. Converts passive income growth into active investment capital.',
    costRange: { min: 2000, max: 8000 },
    effectDescription: 'Converts 20% of current income into a one-time cash injection equal to 3x monthly income. Reduces expenses by 10% for the next 10 ticks.',
    windowTicks: PHASE_BOUNDARY_WINDOW_TICKS,
    educationalTag: 'income_diversification',
  },
  {
    cardId: 'FORTIFY_ORDER',
    phase: 'ESCALATION',
    targetPhase: 'SOVEREIGNTY',
    label: 'Fortify Order',
    description: 'Lock in Escalation gains with a defensive posture entering Sovereignty. Shield layers receive a permanent regen boost.',
    costRange: { min: 5000, max: 15000 },
    effectDescription: 'All shield layers gain +50% regen for the rest of the run. Current debt interest rate is frozen for 15 ticks.',
    windowTicks: PHASE_BOUNDARY_WINDOW_TICKS,
    educationalTag: 'risk_management',
  },
  {
    cardId: 'LAST_STAND_PROTOCOL',
    phase: 'SOVEREIGNTY',
    targetPhase: 'SOVEREIGNTY',
    label: 'Last Stand Protocol',
    description: 'Activate emergency sovereignty measures. Available only when shields are critical and cash is below freedom target.',
    costRange: { min: 0, max: 0 },
    effectDescription: 'Zeroes all debt. Halves current cash. Grants immunity to hater attacks for 8 ticks. If freedom is reached during immunity, CORD bonus +0.15.',
    windowTicks: PHASE_BOUNDARY_WINDOW_TICKS,
    educationalTag: 'emergency_fund',
  },
];

function getPhaseBoundaryCardSpec(cardId: string): PhaseBoundaryCardSpec | null {
  return PHASE_BOUNDARY_CARD_SPECS.find((spec) => spec.cardId === cardId) ?? null;
}

function computePhaseBoundaryCardCost(
  spec: PhaseBoundaryCardSpec,
  participant: ModeParticipant,
): number {
  // Cost scales with the player's current economic strength
  const cash = participant.snapshot.economy.cash;
  const income = participant.snapshot.economy.incomePerTick;
  const strength = Math.min(1.0, (cash + income * 20) / Math.max(1, participant.snapshot.economy.freedomTarget));
  const range = spec.costRange.max - spec.costRange.min;
  return Math.round(spec.costRange.min + range * strength);
}

function isPhaseBoundaryCardPlayable(
  spec: PhaseBoundaryCardSpec,
  participant: ModeParticipant,
  engineState: SoloEngineState,
): { playable: boolean; reason: string | null } {
  if (engineState.hold.noHoldRun && spec.cardId === 'LAST_STAND_PROTOCOL') {
    // LAST_STAND_PROTOCOL has additional conditions
    const shieldsLow = shieldPct(participant) < 0.25;
    const cashLow = participant.snapshot.economy.cash < participant.snapshot.economy.freedomTarget * 0.5;
    if (!shieldsLow || !cashLow) {
      return {
        playable: false,
        reason: 'Last Stand Protocol requires shields below 25% and cash below 50% of freedom target.',
      };
    }
  }

  const cost = computePhaseBoundaryCardCost(spec, participant);
  if (participant.snapshot.economy.cash < cost) {
    return {
      playable: false,
      reason: `Insufficient funds. Need ${cost} but have ${participant.snapshot.economy.cash}.`,
    };
  }

  return { playable: true, reason: null };
}

function applyPhaseBoundaryCardEffect(
  participant: ModeParticipant,
  spec: PhaseBoundaryCardSpec,
  engineState: SoloEngineState,
  tick: number,
): { participant: ModeParticipant; engineState: SoloEngineState } {
  const cost = computePhaseBoundaryCardCost(spec, participant);
  const p = mutableClone(participant);

  p.snapshot.economy.cash = Math.max(0, p.snapshot.economy.cash - cost);

  if (spec.cardId === 'MOMENTUM_PIVOT') {
    const injection = Math.round(p.snapshot.economy.incomePerTick * 3);
    p.snapshot.economy.cash += injection;
    p.snapshot.economy.expensesPerTick = Math.round(p.snapshot.economy.expensesPerTick * 0.9);
    p.metadata['momentumPivotExpenseResetTick'] = tick + 10;
  } else if (spec.cardId === 'FORTIFY_ORDER') {
    p.snapshot.shield.layers = p.snapshot.shield.layers.map((layer) => ({
      ...layer,
      regenPerTick: Math.round(layer.regenPerTick * 1.5),
    }));
    p.metadata['debtInterestFrozenUntilTick'] = tick + 15;
  } else if (spec.cardId === 'LAST_STAND_PROTOCOL') {
    p.snapshot.economy.cash = Math.round(p.snapshot.economy.cash * 0.5);
    p.snapshot.economy.debt = 0;
    p.metadata['haterImmunityUntilTick'] = tick + 8;
    p.metadata['lastStandCordBonusPending'] = true;
  }

  if (!p.snapshot.tags.includes('PHASE_BOUNDARY_PLAY')) {
    p.snapshot.tags = [...p.snapshot.tags, 'PHASE_BOUNDARY_PLAY'];
  }

  const signals = emitChatSignal(
    engineState.chatSignals,
    'CARD_PLAYED',
    tick,
    `Phase boundary card ${spec.label} activated. ${spec.effectDescription}`,
    { cardId: spec.cardId, cost },
  );

  const updatedEngineState: SoloEngineState = {
    ...engineState,
    chatSignals: signals,
    totalCardsPlayed: engineState.totalCardsPlayed + 1,
  };

  const eduEngagements = recordEducationalTag(
    updatedEngineState.educationalEngagements,
    spec.educationalTag,
    0.9,
    tick,
  );

  return {
    participant: p as ModeParticipant,
    engineState: { ...updatedEngineState, educationalEngagements: eduEngagements },
  };
}

// ============================================================================
// S21e — WAVE-BASED CARD QUALITY TIER DETAILS
// ============================================================================
//
// Card quality tiers define the raw character of each phase's card pool.
// Foundation cards are scrappy (cheap, low-ceiling, high-floor).
// Escalation cards leverage risk for reward.
// Sovereignty cards are empire-scale (expensive, transformative).
//

/** Wave quality tier description. */
interface WaveQualityTierInfo {
  readonly phase: RunPhase;
  readonly tierLabel: string;
  readonly costMultiplier: number;
  readonly effectMultiplier: number;
  readonly description: string;
  readonly cardPool: string;
  readonly riskProfile: string;
  readonly incomeFloor: number;
  readonly incomeCeiling: number;
}

const WAVE_QUALITY_TIER_INFO: readonly WaveQualityTierInfo[] = [
  {
    phase: 'FOUNDATION',
    tierLabel: 'SCRAPPY',
    costMultiplier: WAVE_QUALITY_COST_MULTIPLIERS['FOUNDATION'],
    effectMultiplier: WAVE_QUALITY_EFFECT_MULTIPLIERS['FOUNDATION'],
    description: 'Foundation cards are cheap and reliable. Build income streams before the pressure ramps.',
    cardPool: 'INCOME, OPPORTUNITY, DISCIPLINE — no IPA, no DEBT',
    riskProfile: 'Low risk, low ceiling. Ideal for establishing recurring cash flow.',
    incomeFloor: 100,
    incomeCeiling: 500,
  },
  {
    phase: 'ESCALATION',
    tierLabel: 'LEVERAGE',
    costMultiplier: WAVE_QUALITY_COST_MULTIPLIERS['ESCALATION'],
    effectMultiplier: WAVE_QUALITY_EFFECT_MULTIPLIERS['ESCALATION'],
    description: 'Escalation cards introduce leverage. IPA cards appear. Debt becomes available.',
    cardPool: 'INCOME, OPPORTUNITY, IPA, DEBT, COUNTER, DISCIPLINE',
    riskProfile: 'Medium risk, medium ceiling. Leverage amplifies both gains and losses.',
    incomeFloor: 300,
    incomeCeiling: 2000,
  },
  {
    phase: 'SOVEREIGNTY',
    tierLabel: 'EMPIRE_SCALE',
    costMultiplier: WAVE_QUALITY_COST_MULTIPLIERS['SOVEREIGNTY'],
    effectMultiplier: WAVE_QUALITY_EFFECT_MULTIPLIERS['SOVEREIGNTY'],
    description: 'Sovereignty cards are expensive but transformative. Every play reshapes the board.',
    cardPool: 'All solo-legal types at maximum scale. Phase boundary cards available.',
    riskProfile: 'High risk, highest ceiling. Empire-scale decisions under hater pressure.',
    incomeFloor: 800,
    incomeCeiling: 10000,
  },
];

function getWaveQualityTierInfo(phase: RunPhase): WaveQualityTierInfo {
  return WAVE_QUALITY_TIER_INFO.find((info) => info.phase === phase) ?? WAVE_QUALITY_TIER_INFO[0];
}

function computeWaveAdjustedValue(
  baseValue: number,
  phase: RunPhase,
  isEffect: boolean,
): number {
  const multiplier = isEffect
    ? WAVE_QUALITY_EFFECT_MULTIPLIERS[phase]
    : WAVE_QUALITY_COST_MULTIPLIERS[phase];
  return Math.round(baseValue * multiplier);
}

function isCardInWaveTierRange(
  card: CardDefinition,
  phase: RunPhase,
): boolean {
  const tierInfo = getWaveQualityTierInfo(phase);
  const effectSize = Math.abs(card.baseEffect.cashDelta ?? 0) + Math.abs(card.baseEffect.incomeDelta ?? 0);
  return effectSize >= tierInfo.incomeFloor && effectSize <= tierInfo.incomeCeiling;
}

// ============================================================================
// S21f — DEBT BURDEN ADVANCED TRACKING
// ============================================================================
//
// Beyond basic compounding, the debt engine tracks debt velocity,
// payment discipline, and projects time-to-debt-freedom.
//

/** Debt analytics record. */
interface DebtAnalytics {
  readonly debtVelocity: number;
  readonly paymentDisciplineScore: number;
  readonly estimatedTicksToDebtFree: number;
  readonly interestBurdenRatio: number;
  readonly debtCategory: 'NONE' | 'MANAGEABLE' | 'CONCERNING' | 'CRITICAL' | 'CATASTROPHIC';
}

function analyzeDebtBurden(
  state: DebtBurdenState,
  incomePerTick: number,
  cashOnHand: number,
): DebtAnalytics {
  if (state.totalDebt <= 0) {
    return {
      debtVelocity: 0,
      paymentDisciplineScore: 1.0,
      estimatedTicksToDebtFree: 0,
      interestBurdenRatio: 0,
      debtCategory: 'NONE',
    };
  }

  // Debt velocity: how fast debt is growing
  const interestPerTick = state.totalDebt * DEBT_INTEREST_RATE_PER_TICK;
  const debtVelocity = incomePerTick > 0
    ? Number((interestPerTick / incomePerTick).toFixed(4))
    : 999;

  // Payment discipline: can the player service the debt from income?
  const canServiceFromIncome = incomePerTick > interestPerTick;
  const paymentDisciplineScore = canServiceFromIncome
    ? Math.min(1.0, Number(((incomePerTick - interestPerTick) / Math.max(1, interestPerTick)).toFixed(4)))
    : 0;

  // Time to debt free: optimistic estimate
  const netPaymentPerTick = Math.max(0, incomePerTick - interestPerTick);
  const estimatedTicksToDebtFree = netPaymentPerTick > 0
    ? Math.ceil(state.totalDebt / netPaymentPerTick)
    : 999;

  // Interest burden: what fraction of income goes to interest
  const interestBurdenRatio = incomePerTick > 0
    ? Number((interestPerTick / incomePerTick).toFixed(4))
    : 1.0;

  // Category classification
  let debtCategory: DebtAnalytics['debtCategory'];
  if (state.debtToIncomeRatio >= DEBT_TO_INCOME_CRITICAL_THRESHOLD * 2) {
    debtCategory = 'CATASTROPHIC';
  } else if (state.debtToIncomeRatio >= DEBT_TO_INCOME_CRITICAL_THRESHOLD) {
    debtCategory = 'CRITICAL';
  } else if (state.debtToIncomeRatio >= DEBT_TO_INCOME_CRITICAL_THRESHOLD * 0.5) {
    debtCategory = 'CONCERNING';
  } else {
    debtCategory = 'MANAGEABLE';
  }

  return {
    debtVelocity,
    paymentDisciplineScore,
    estimatedTicksToDebtFree,
    interestBurdenRatio,
    debtCategory,
  };
}

function shouldAutoPayDebt(
  analytics: DebtAnalytics,
  cashOnHand: number,
  freedomTarget: number,
): { shouldPay: boolean; suggestedAmount: number; reason: string } {
  if (analytics.debtCategory === 'NONE') {
    return { shouldPay: false, suggestedAmount: 0, reason: 'No debt outstanding.' };
  }
  if (analytics.debtCategory === 'CATASTROPHIC') {
    const payable = Math.min(cashOnHand * 0.5, freedomTarget * 0.2);
    return {
      shouldPay: true,
      suggestedAmount: Math.round(payable),
      reason: 'Debt is catastrophic. Allocating 50% of available cash to debt reduction.',
    };
  }
  if (analytics.debtCategory === 'CRITICAL') {
    const payable = Math.min(cashOnHand * 0.3, freedomTarget * 0.1);
    return {
      shouldPay: true,
      suggestedAmount: Math.round(payable),
      reason: 'Debt is critical. Suggesting 30% of cash toward paydown.',
    };
  }
  if (analytics.interestBurdenRatio > 0.5) {
    const payable = Math.min(cashOnHand * 0.15, freedomTarget * 0.05);
    return {
      shouldPay: true,
      suggestedAmount: Math.round(payable),
      reason: 'Interest burden exceeds 50% of income. Partial paydown recommended.',
    };
  }
  return { shouldPay: false, suggestedAmount: 0, reason: 'Debt is manageable.' };
}

// ============================================================================
// S21g — SO CONVERSION ROUTE DEEP EVALUATION
// ============================================================================
//
// SO conversion is the mechanism by which players transform obstacles into
// opportunities. Each route (Cash, Time, Pain) has distinct risk/reward curves.
//

/** SO route evaluation. */
interface SORouteEvaluation {
  readonly route: SOConversionRoute;
  readonly viability: number;
  readonly riskScore: number;
  readonly cordBonusProjected: number;
  readonly recommendation: string;
}

function evaluateSORoutes(
  participant: ModeParticipant,
  engineState: SoloEngineState,
): SORouteEvaluation[] {
  const cash = participant.snapshot.economy.cash;
  const freedomTarget = participant.snapshot.economy.freedomTarget;
  const shields = shieldPct(participant);
  const extensionMs = participant.snapshot.timers.extensionBudgetMs;

  const evaluations: SORouteEvaluation[] = [];

  // Cash Conversion: pay cash to convert obstacle
  const cashViability = cash > 5000 ? Math.min(1.0, cash / (freedomTarget * 0.3)) : 0;
  const cashRisk = cash > freedomTarget * 0.5 ? 0.2 : 0.6;
  evaluations.push({
    route: 'CASH_CONVERSION',
    viability: Number(cashViability.toFixed(4)),
    riskScore: Number(cashRisk.toFixed(4)),
    cordBonusProjected: 0.01,
    recommendation: cashViability > 0.5
      ? 'Cash conversion viable. Low CORD bonus but preserves shields and time.'
      : 'Cash reserves too low for safe conversion.',
  });

  // Time Conversion: spend decision time budget
  const timeViability = extensionMs > 10000 ? Math.min(1.0, extensionMs / 60000) : 0;
  const timeRisk = extensionMs > 30000 ? 0.3 : 0.7;
  evaluations.push({
    route: 'TIME_CONVERSION',
    viability: Number(timeViability.toFixed(4)),
    riskScore: Number(timeRisk.toFixed(4)),
    cordBonusProjected: 0.02,
    recommendation: timeViability > 0.3
      ? 'Time conversion available. Moderate CORD bonus. Watch clock pressure.'
      : 'Time budget too tight for safe conversion.',
  });

  // Pain Absorption: take shield damage
  const painViability = shields > 0.3 ? Math.min(1.0, shields) : 0;
  const painRisk = shields > 0.6 ? 0.4 : 0.8;
  evaluations.push({
    route: 'PAIN_ABSORPTION',
    viability: Number(painViability.toFixed(4)),
    riskScore: Number(painRisk.toFixed(4)),
    cordBonusProjected: 0.04,
    recommendation: painViability > 0.4
      ? 'Pain absorption highest CORD bonus. Requires strong shields.'
      : 'Shields too weak. Pain absorption would risk breach cascade.',
  });

  return evaluations;
}

function selectOptimalSORoute(
  evaluations: SORouteEvaluation[],
): SOConversionRoute {
  // Prefer highest viability-to-risk ratio with CORD bonus weighting
  let bestRoute: SOConversionRoute = 'CASH_CONVERSION';
  let bestScore = -1;
  for (const evaluation of evaluations) {
    const score = (evaluation.viability * 0.5) + (evaluation.cordBonusProjected * 10 * 0.3) - (evaluation.riskScore * 0.2);
    if (score > bestScore) {
      bestScore = score;
      bestRoute = evaluation.route;
    }
  }
  return bestRoute;
}

// ============================================================================
// S21h — MOMENTUM ADVANCED TRACKING
// ============================================================================
//
// Beyond the base momentum score, the engine tracks momentum patterns,
// streaks, and phase-specific momentum behavior.
//

/** Momentum analytics. */
interface MomentumAnalytics {
  readonly currentScore: number;
  readonly qualityTier: MomentumState['qualityTier'];
  readonly streakLength: number;
  readonly peakScore: number;
  readonly averageScore: number;
  readonly phaseScores: Record<string, number>;
  readonly holdUnlockProgress: number;
  readonly decayRate: number;
  readonly projectedPeakTick: number | null;
}

function analyzeMomentum(
  state: MomentumState,
  peakMomentum: number,
  snapshots: SoloMLFeatureSnapshot[],
  phase: RunPhase,
): MomentumAnalytics {
  const currentScore = state.score;
  const qualityTier = state.qualityTier;

  // Streak: consecutive ticks with score above median
  const scores = snapshots.map((s) => s.features[0]);
  const median = scores.length > 0
    ? [...scores].sort((a, b) => a - b)[Math.floor(scores.length / 2)]
    : 0;
  let streakLength = 0;
  for (let i = scores.length - 1; i >= 0; i--) {
    if (scores[i] >= median) streakLength++;
    else break;
  }

  const averageScore = scores.length > 0
    ? Number((scores.reduce((sum, s) => sum + s, 0) / scores.length).toFixed(4))
    : 0;

  // Phase scores
  const phaseScores: Record<string, number> = {};
  phaseScores[phase] = currentScore;

  // Hold unlock progress
  const holdUnlockProgress = Math.min(1.0, Number((currentScore / MOMENTUM_HOLD_UNLOCK_THRESHOLD).toFixed(4)));

  // Decay rate
  const decayRate = 0.01;

  // Projected peak: if momentum is increasing
  const recentScores = scores.slice(-5);
  let projectedPeakTick: number | null = null;
  if (recentScores.length >= 2) {
    const delta = recentScores[recentScores.length - 1] - recentScores[0];
    if (delta > 0) {
      const ticksToMax = Math.ceil((1.0 - currentScore) / (delta / recentScores.length));
      projectedPeakTick = (snapshots[snapshots.length - 1]?.tick ?? 0) + ticksToMax;
    }
  }

  return {
    currentScore,
    qualityTier,
    streakLength,
    peakScore: peakMomentum,
    averageScore,
    phaseScores,
    holdUnlockProgress,
    decayRate,
    projectedPeakTick,
  };
}

// ============================================================================
// S21i — EMPIRE-SPECIFIC ML FEATURE EXTRACTION
// ============================================================================
//
// Beyond the base 32-feature vector, Empire mode extracts additional features
// specific to solo play patterns, used by the recommendation engine.
//

/** Extended Empire ML features (appended conceptually to the base vector). */
interface EmpireMLExtendedFeatures {
  readonly ipaPortfolioDiversity: number;
  readonly synergyActivationRate: number;
  readonly isolationTaxMultiplier: number;
  readonly debtToIncomeRatio: number;
  readonly momentumScore: number;
  readonly comebackSurgeActive: number;
  readonly holdEfficiency: number;
  readonly phaseBoundaryPlaysCount: number;
  readonly decisionQualityAverage: number;
  readonly educationalEngagementBreadth: number;
  readonly soConversionCount: number;
  readonly shieldBreachRisk: number;
  readonly cashToFreedomRatio: number;
  readonly haterPressureIndex: number;
  readonly timeRemainingFraction: number;
  readonly cascadeChainDepth: number;
}

function extractEmpireExtendedFeatures(
  participant: ModeParticipant,
  engineState: SoloEngineState,
): EmpireMLExtendedFeatures {
  const snap = participant.snapshot;

  const ipaPortfolioDiversity = Math.min(1.0, engineState.ipaPortfolio.types.size / IPA_TYPES.length);
  const synergyActivationRate = Math.min(1.0, engineState.ipaPortfolio.synergyBonusesApplied.length / 5);
  const isolationTaxMultiplier = Math.min(1.0, engineState.isolationTax.currentMultiplier / ISOLATION_TAX_CAP);
  const debtToIncomeRatio = Math.min(1.0, engineState.debtBurden.debtToIncomeRatio / (DEBT_TO_INCOME_CRITICAL_THRESHOLD * 2));
  const momentumScore = engineState.momentum.score;
  const comebackSurgeActiveVal = engineState.comebackSurge.active ? 1.0 : 0.0;

  const holdEfficiency = engineState.hold.holdsUsed > 0
    ? Math.min(1.0, 1.0 / engineState.hold.holdsUsed)
    : engineState.hold.noHoldRun ? 1.0 : 0;

  const phaseBoundaryPlaysCount = Math.min(1.0,
    snap.tags.filter((t) => t === 'PHASE_BOUNDARY_PLAY').length / 3,
  );

  const decisionQualityAverage = 0.5;
  const educationalEngagementBreadth = Math.min(1.0,
    Object.keys(engineState.educationalEngagements).length / EDUCATIONAL_TAG_CATEGORIES.length,
  );
  const soConversionCount = Math.min(1.0, engineState.soConversions.length / 10);

  const shieldBreachRisk = 1.0 - shieldPct(participant);
  const cashToFreedomRatio = Math.min(1.0, snap.economy.cash / Math.max(1, snap.economy.freedomTarget));

  const haterPressureIndex = Math.min(1.0,
    snap.battle.bots.filter((b) => b.state === 'ATTACKING').length / 5,
  );
  const timeRemainingFraction = snap.timers.seasonBudgetMs > 0
    ? Math.max(0, 1.0 - snap.timers.elapsedMs / snap.timers.seasonBudgetMs)
    : 0;
  const cascadeChainDepth = Math.min(1.0, snap.cascade.activeChains.length / 5);

  return {
    ipaPortfolioDiversity,
    synergyActivationRate,
    isolationTaxMultiplier,
    debtToIncomeRatio,
    momentumScore,
    comebackSurgeActive: comebackSurgeActiveVal,
    holdEfficiency,
    phaseBoundaryPlaysCount,
    decisionQualityAverage,
    educationalEngagementBreadth,
    soConversionCount,
    shieldBreachRisk,
    cashToFreedomRatio,
    haterPressureIndex,
    timeRemainingFraction,
    cascadeChainDepth,
  };
}

// ============================================================================
// S21j — CHAT BRIDGE ADVANCED SIGNALS
// ============================================================================
//
// Empire-specific chat events for the companion commentary system.
// These signals drive the AI companion's contextual reactions.
//

/** Empire-specific chat event types. */
const EMPIRE_CHAT_EVENT_TYPES = [
  'ISOLATION_PRESSURE_RISING',
  'ISOLATION_PRESSURE_EASED',
  'WITNESS_MOMENT_IPA_SYNERGY',
  'WITNESS_MOMENT_COMEBACK',
  'WITNESS_MOMENT_PHASE_BOUNDARY',
  'HATER_TAUNT_DEBT_SPIRAL',
  'HATER_TAUNT_LOW_SHIELDS',
  'HATER_TAUNT_NO_INCOME',
  'ENCOURAGEMENT_MILESTONE',
  'ENCOURAGEMENT_STREAK',
  'WARNING_CLOCK_PRESSURE',
  'WARNING_SHIELD_CRITICAL',
  'CELEBRATION_FREEDOM',
  'CELEBRATION_SOVEREIGN_POSITION',
  'CELEBRATION_NO_HOLD_RUN',
] as const;
type EmpireChatEventType = typeof EMPIRE_CHAT_EVENT_TYPES[number];

function emitIsolationPressureSignal(
  signals: SoloChatSignal[],
  tick: number,
  multiplier: number,
  rising: boolean,
): SoloChatSignal[] {
  const type = rising ? 'ISOLATION_PRESSURE_RISING' : 'ISOLATION_PRESSURE_EASED';
  const message = rising
    ? `Isolation pressure climbing. Tax multiplier at ${Math.round(multiplier * 100)}%.`
    : 'Isolation pressure easing. Negative streak broken.';
  return emitChatSignal(signals, type, tick, message, { multiplier, rising });
}

function emitWitnessMomentSignal(
  signals: SoloChatSignal[],
  tick: number,
  momentType: string,
  details: string,
): SoloChatSignal[] {
  return emitChatSignal(
    signals,
    `WITNESS_MOMENT_${momentType}`,
    tick,
    details,
    { momentType },
  );
}

function emitHaterTauntSignal(
  signals: SoloChatSignal[],
  tick: number,
  tauntType: string,
  botId: string,
): SoloChatSignal[] {
  const taunts: Record<string, string> = {
    DEBT_SPIRAL: 'Manipulator whispers: "The interest never sleeps. You think you can outrun compound math?"',
    LOW_SHIELDS: 'Extractor growls: "No shields left. Every hit lands clean now."',
    NO_INCOME: 'Forecloser laughs: "No income stream? You\'re building a house on sand."',
  };
  return emitChatSignal(
    signals,
    `HATER_TAUNT_${tauntType}`,
    tick,
    taunts[tauntType] ?? `Hater ${botId} taunts you.`,
    { tauntType, botId },
  );
}

function emitEncouragementSignal(
  signals: SoloChatSignal[],
  tick: number,
  milestoneType: string,
  message: string,
): SoloChatSignal[] {
  return emitChatSignal(
    signals,
    `ENCOURAGEMENT_${milestoneType}`,
    tick,
    message,
    { milestoneType },
  );
}

function emitCelebrationSignal(
  signals: SoloChatSignal[],
  tick: number,
  celebrationType: string,
  message: string,
): SoloChatSignal[] {
  return emitChatSignal(
    signals,
    `CELEBRATION_${celebrationType}`,
    tick,
    message,
    { celebrationType },
  );
}

// ============================================================================
// S21k — EDUCATIONAL TAG DEEP TRACKING
// ============================================================================
//
// The educational system maps every card play to financial literacy concepts.
// Deep tracking measures engagement breadth, depth, and quality per concept.
//

/** Educational engagement analytics. */
interface EducationalAnalytics {
  readonly breadthScore: number;
  readonly depthScore: number;
  readonly qualityScore: number;
  readonly compositeScore: number;
  readonly strongestConcept: string | null;
  readonly weakestConcept: string | null;
  readonly unexploredConcepts: string[];
  readonly conceptMastery: Record<string, number>;
}

function analyzeEducationalEngagement(
  engagements: Record<string, EducationalEngagement>,
): EducationalAnalytics {
  const engaged = getEngagedTags(engagements);
  const avoided = getAvoidedTags(engagements);

  const breadthScore = Math.min(1.0, engaged.length / EDUCATIONAL_TAG_CATEGORIES.length);

  let totalDepth = 0;
  let totalQuality = 0;
  let strongest: string | null = null;
  let strongestScore = -1;
  let weakest: string | null = null;
  let weakestScore = Number.MAX_SAFE_INTEGER;

  const conceptMastery: Record<string, number> = {};

  for (const tag of engaged) {
    const entry = engagements[tag];
    const depth = Math.min(1.0, entry.playCount / 5);
    totalDepth += depth;
    totalQuality += entry.averageQuality;

    const mastery = Number(((depth * 0.4 + entry.averageQuality * 0.6)).toFixed(4));
    conceptMastery[tag] = mastery;

    if (mastery > strongestScore) {
      strongestScore = mastery;
      strongest = tag;
    }
    if (mastery < weakestScore) {
      weakestScore = mastery;
      weakest = tag;
    }
  }

  const depthScore = engaged.length > 0 ? Number((totalDepth / engaged.length).toFixed(4)) : 0;
  const qualityScore = engaged.length > 0 ? Number((totalQuality / engaged.length).toFixed(4)) : 0;
  const compositeScore = Number(((breadthScore * 0.3 + depthScore * 0.3 + qualityScore * 0.4)).toFixed(4));

  return {
    breadthScore,
    depthScore,
    qualityScore,
    compositeScore,
    strongestConcept: strongest,
    weakestConcept: weakest,
    unexploredConcepts: avoided,
    conceptMastery,
  };
}

function suggestNextEducationalFocus(
  analytics: EducationalAnalytics,
  phase: RunPhase,
): string {
  // Suggest the educational concept most relevant to the current phase
  // that the player hasn't yet engaged with
  const phaseRelevance: Record<string, readonly string[]> = {
    FOUNDATION: ['budgeting', 'emergency_fund', 'income_diversification', 'cash_flow'],
    ESCALATION: ['investing', 'debt_management', 'leverage', 'risk_management', 'compound_interest'],
    SOVEREIGNTY: ['asset_allocation', 'financial_independence', 'net_worth', 'tax_planning'],
  };

  const relevant = phaseRelevance[phase] ?? [];
  for (const concept of relevant) {
    if (analytics.unexploredConcepts.includes(concept)) {
      return concept;
    }
  }
  // If all phase-relevant concepts are explored, suggest the weakest
  return analytics.weakestConcept ?? 'budgeting';
}

// ============================================================================
// S21l — ENHANCED CASE FILE GENERATION
// ============================================================================
//
// The extended case file adds decision quality, debt analytics, synergy
// evaluations, and educational analytics to the post-run report.
//

/** Extended case file with deep analytics. */
interface ExtendedSoloCaseFile extends SoloCaseFile {
  readonly decisionQualityAggregate: DecisionQualityAggregate;
  readonly debtAnalytics: DebtAnalytics;
  readonly educationalAnalytics: EducationalAnalytics;
  readonly empireMLFeatures: EmpireMLExtendedFeatures;
  readonly soRouteEvaluations: SORouteEvaluation[];
  readonly momentumAnalytics: MomentumAnalytics;
  readonly portfolioHealth: ReturnType<typeof evaluateIPAPortfolioHealth>;
  readonly waveQualityTierInfo: WaveQualityTierInfo;
  readonly phaseBoundaryCardsPlayed: string[];
  readonly chatEventBreakdown: Record<string, number>;
}

function generateExtendedCaseFile(
  frame: ModeFrame,
  engineState: SoloEngineState,
  decisionRecords: DecisionQualityRecord[],
): ExtendedSoloCaseFile {
  const baseCaseFile = generateCaseFile(frame, engineState);
  const participant = frame.participants[0];

  const decisionQualityAggregate = aggregateDecisionQuality(decisionRecords);
  const debtAnalytics = analyzeDebtBurden(
    engineState.debtBurden,
    participant.snapshot.economy.incomePerTick,
    participant.snapshot.economy.cash,
  );
  const educationalAnalytics = analyzeEducationalEngagement(
    engineState.educationalEngagements,
  );
  const empireMLFeatures = extractEmpireExtendedFeatures(participant, engineState);
  const soRouteEvaluations = evaluateSORoutes(participant, engineState);
  const momentumAnalytics = analyzeMomentum(
    engineState.momentum,
    engineState.peakMomentum,
    engineState.mlSnapshots,
    participant.snapshot.phase,
  );
  const portfolioHealth = evaluateIPAPortfolioHealth(
    engineState.ipaPortfolio,
    participant,
    frame.tick,
  );
  const waveQualityTierInfo = getWaveQualityTierInfo(participant.snapshot.phase);

  const phaseBoundaryCardsPlayed = engineState.cardDecisions
    .filter((d) => PHASE_BOUNDARY_CARD_IDS.has(d.cardId))
    .map((d) => d.cardId);

  const chatEventBreakdown: Record<string, number> = {};
  for (const signal of engineState.chatSignals) {
    chatEventBreakdown[signal.type] = (chatEventBreakdown[signal.type] ?? 0) + 1;
  }

  return {
    ...baseCaseFile,
    decisionQualityAggregate,
    debtAnalytics,
    educationalAnalytics,
    empireMLFeatures,
    soRouteEvaluations,
    momentumAnalytics,
    portfolioHealth,
    waveQualityTierInfo,
    phaseBoundaryCardsPlayed,
    chatEventBreakdown,
  };
}

// ============================================================================
// S21m — TICK-LEVEL CHAT SIGNAL GENERATION
// ============================================================================
//
// Each tick, the engine evaluates conditions and emits contextual chat signals.
// These drive the companion AI's real-time commentary.
//

function generateTickChatSignals(
  participant: ModeParticipant,
  engineState: SoloEngineState,
  tick: number,
): SoloChatSignal[] {
  let signals = engineState.chatSignals;
  const snap = participant.snapshot;

  // Isolation pressure signals
  if (engineState.isolationTax.consecutiveNegativeCount >= 2) {
    signals = emitIsolationPressureSignal(
      signals,
      tick,
      engineState.isolationTax.currentMultiplier,
      true,
    );
  } else if (
    engineState.isolationTax.consecutiveNegativeCount === 0 &&
    engineState.isolationTax.totalTaxApplied > 0
  ) {
    signals = emitIsolationPressureSignal(
      signals,
      tick,
      engineState.isolationTax.currentMultiplier,
      false,
    );
  }

  // Hater taunts — only emit every 10 ticks to avoid spam
  if (tick % 10 === 0) {
    if (engineState.debtBurden.debtToIncomeRatio >= DEBT_TO_INCOME_CRITICAL_THRESHOLD) {
      const manipulator = snap.battle.bots.find((b) => b.botId === 'BOT_02');
      if (manipulator && manipulator.state === 'ATTACKING') {
        signals = emitHaterTauntSignal(signals, tick, 'DEBT_SPIRAL', 'BOT_02');
      }
    }
    if (shieldPct(participant) < 0.15) {
      const extractor = snap.battle.bots.find((b) => b.botId === 'BOT_01');
      if (extractor && extractor.state === 'ATTACKING') {
        signals = emitHaterTauntSignal(signals, tick, 'LOW_SHIELDS', 'BOT_01');
      }
    }
    if (snap.economy.incomePerTick <= 0) {
      signals = emitHaterTauntSignal(signals, tick, 'NO_INCOME', 'BOT_03');
    }
  }

  // Encouragement milestones
  if (snap.economy.cash >= snap.economy.freedomTarget * 0.5 && tick > 0) {
    const alreadyEmitted = signals.some(
      (s) => s.type === 'ENCOURAGEMENT_MILESTONE' && s.payload['milestoneType'] === 'HALFWAY',
    );
    if (!alreadyEmitted) {
      signals = emitEncouragementSignal(
        signals,
        tick,
        'MILESTONE',
        'Halfway to freedom. Keep building. The haters are watching.',
      );
    }
  }

  // Warning signals
  if (snap.timers.seasonBudgetMs > 0) {
    const remaining = snap.timers.seasonBudgetMs - snap.timers.elapsedMs;
    const fraction = remaining / snap.timers.seasonBudgetMs;
    if (fraction < 0.15 && fraction > 0.10) {
      const alreadyWarned = signals.some(
        (s) => s.type === 'WARNING_CLOCK_PRESSURE',
      );
      if (!alreadyWarned) {
        signals = emitChatSignal(
          signals,
          'WARNING_CLOCK_PRESSURE',
          tick,
          'Clock pressure: less than 15% of season time remains.',
          { remainingFraction: Number(fraction.toFixed(4)) },
        );
      }
    }
  }

  if (shieldPct(participant) < 0.10 && shieldPct(participant) > 0) {
    const alreadyWarned = signals.some(
      (s) => s.type === 'WARNING_SHIELD_CRITICAL' && s.tick > tick - 5,
    );
    if (!alreadyWarned) {
      signals = emitChatSignal(
        signals,
        'WARNING_SHIELD_CRITICAL',
        tick,
        'SHIELD CRITICAL. One more hit and you breach.',
        { shieldPercent: Number(shieldPct(participant).toFixed(4)) },
      );
    }
  }

  return signals;
}

// ============================================================================
// S21n — PROCESS ADVANCED TICK SIGNALS
// ============================================================================
//
// Wires the advanced chat signal generation into the tick processing pipeline.
//

function processAdvancedTickSignals(
  participant: ModeParticipant,
  engineState: SoloEngineState,
  tick: number,
): SoloEngineState {
  const signals = generateTickChatSignals(participant, engineState, tick);
  return {
    ...engineState,
    chatSignals: signals,
  };
}

// ============================================================================
// S21o — PROCESS PHASE BOUNDARY CARD EXPIRY
// ============================================================================
//
// Phase boundary card effects that have time-limited durations expire here.
//

function processPhaseBoundaryExpiry(
  participant: ModeParticipant,
  tick: number,
): ModeParticipant {
  const pivotResetTick = Number(participant.metadata['momentumPivotExpenseResetTick'] ?? -1);
  if (pivotResetTick > 0 && tick >= pivotResetTick) {
    const p = mutableClone(participant);
    // Restore expenses to pre-pivot level (approximate: +11% to reverse the 10% cut)
    p.snapshot.economy.expensesPerTick = Math.round(p.snapshot.economy.expensesPerTick * 1.11);
    p.metadata['momentumPivotExpenseResetTick'] = -1;
    return p as ModeParticipant;
  }

  const haterImmunityTick = Number(participant.metadata['haterImmunityUntilTick'] ?? -1);
  if (haterImmunityTick > 0 && tick >= haterImmunityTick) {
    const p = mutableClone(participant);
    p.metadata['haterImmunityUntilTick'] = -1;
    // Check if freedom was reached during immunity
    if (p.snapshot.outcome === 'FREEDOM' && p.metadata['lastStandCordBonusPending'] === true) {
      p.snapshot.sovereignty.cordScore = Number(
        (p.snapshot.sovereignty.cordScore + 0.15).toFixed(6),
      );
      p.metadata['lastStandCordBonusPending'] = false;
    }
    return p as ModeParticipant;
  }

  return participant;
}

// ============================================================================
// S21p — PROCESS DECISION QUALITY TRACKING
// ============================================================================
//
// Per-card-play decision quality scoring is integrated into the card play
// processing pipeline. Results are stored in participant metadata.
//

function processDecisionQualityTracking(
  participant: ModeParticipant,
  card: CardDefinition,
  tick: number,
  timingDelta: number,
): ModeParticipant {
  const record = scoreDecision(participant, card, tick, timingDelta);
  const cloned = cloneParticipant(participant);

  // Store the latest DQS in metadata for the ML pipeline
  cloned.metadata['lastDecisionQualityScore'] = record.compositeScore;
  cloned.metadata['lastDecisionQualityLabel'] = record.label;
  cloned.metadata['decisionQualityCount'] = Number(cloned.metadata['decisionQualityCount'] ?? 0) + 1;

  const runningSum = Number(cloned.metadata['decisionQualitySum'] ?? 0);
  cloned.metadata['decisionQualitySum'] = runningSum + record.compositeScore;

  const count = Number(cloned.metadata['decisionQualityCount']);
  cloned.metadata['decisionQualityAverage'] = Number(
    ((runningSum + record.compositeScore) / count).toFixed(4),
  );

  return cloned;
}

// ============================================================================
// S22 — SOLO MODE ENGINE CLASS
// ============================================================================

export class SoloModeEngine implements ModeAdapter {
  public readonly mode: ModeCode = 'solo';

  // --------------------------------------------------------------------------
  // bootstrap — Initialize Empire run state
  // --------------------------------------------------------------------------
  public bootstrap(frame: ModeFrame, options?: Record<string, unknown>): ModeFrame {
    let next = cloneFrame(frame);
    const actorId = next.participants[0].playerId;

    next.participants = next.participants.slice(0, 1);

    next = updateParticipant(next, actorId, (participant) => {
      const cloned = mutableClone(participant);
      cloned.snapshot.modeState.holdEnabled = true;
      cloned.snapshot.modeState.loadoutEnabled = true;
      cloned.snapshot.modeState.sharedTreasury = false;
      cloned.snapshot.modeState.legendMarkersEnabled = false;
      cloned.snapshot.modeState.phaseBoundaryWindowsRemaining = 0;
      cloned.snapshot.modeState.bleedMode = false;
      cloned.snapshot.modeState.modePresentation = 'empire';
      return cloned as ModeParticipant;
    });

    const handicapIds = Array.isArray(options?.handicapIds)
      ? (options?.handicapIds as string[])
      : [];
    const bleed =
      handicapIds.includes('DISADVANTAGE_DRAFT') || options?.bleedMode === true;
    const normalizedHandicaps = bleed
      ? [
          'NO_CREDIT_HISTORY',
          'SINGLE_INCOME',
          'TARGETED',
          'CASH_POOR',
          'CLOCK_CURSED',
          'DISADVANTAGE_DRAFT',
        ]
      : handicapIds;

    for (const handicapId of normalizedHandicaps) {
      next = applyHandicap(next, handicapId);
    }
    next = applyAdvantage(
      next,
      (options?.advantageId as string | null | undefined) ?? null,
    );

    next = updateParticipant(next, actorId, (participant) => {
      const cloned = mutableClone(participant);
      cloned.snapshot.modeState.handicapIds = normalizedHandicaps;
      cloned.snapshot.modeState.advantageId =
        (options?.advantageId as string | null | undefined) ?? null;
      cloned.snapshot.modeState.disabledBots = (
        (options?.disabledBots as HaterBotId[] | undefined) ?? []
      ).slice();
      cloned.snapshot.modeState.bleedMode = bleed;
      cloned.metadata['bleedMode'] = bleed;

      if (bleed) {
        cloned.snapshot.modeState.holdEnabled = false;
        cloned.snapshot.timers.holdCharges = 0;
        cloned.snapshot.battle.bots = cloned.snapshot.battle.bots.map((bot) => ({
          ...bot,
          heat: Math.max(bot.heat, 25),
        }));
      }

      if (Array.isArray(options?.disabledBots)) {
        const disabled = new Set(options?.disabledBots as string[]);
        cloned.snapshot.battle.bots = cloned.snapshot.battle.bots.map((bot) =>
          disabled.has(bot.botId) ? { ...bot, state: 'DORMANT' as const, heat: 0 } : bot,
        );
      }

      const engineState = createEmptyEngineState(cloned.snapshot.phase as string as RunPhase);
      const initializedState: SoloEngineState = {
        ...engineState,
        hold: bleed
          ? { ...engineState.hold, maxHolds: 0, noHoldRun: true }
          : engineState.hold,
      };
      cloned.metadata['soloEngineState'] = serializeEngineState(initializedState);

      return cloned as ModeParticipant;
    });

    const chatSignals = emitChatSignal(
      [],
      'MODE_STARTED',
      next.tick,
      'EMPIRE mode initialized. GO ALONE. Build your financial sovereignty.',
      { mode: 'solo', bleed },
    );
    next = updateParticipant(next, actorId, (participant) => {
      const state = loadEngineState(participant);
      return saveEngineState(participant, { ...state, chatSignals });
    });

    return pushEvent(next, {
      tick: next.tick,
      level: 'INFO',
      channel: 'SYSTEM',
      actorId: null,
      code: 'EMPIRE_BOOTSTRAP',
      message:
        'GO ALONE runtime bootstrapped with authoritative loadout + handicap state.',
    });
  }

  // --------------------------------------------------------------------------
  // onTickStart — Per-tick pre-processing
  // --------------------------------------------------------------------------
  public onTickStart(frame: ModeFrame): ModeFrame {
    let next = cloneFrame(frame);
    const actor = next.participants[0];
    const actorId = actor.playerId;
    let engineState = loadEngineState(actor);

    const totalMs = actor.snapshot.timers.seasonBudgetMs;
    const newPhase = phaseForElapsedMs(totalMs, actor.snapshot.timers.elapsedMs);
    const priorPhase = actor.snapshot.phase;

    if (phasesChanged(priorPhase, newPhase)) {
      const transition = processPhaseTransition(
        next,
        actor,
        engineState,
        priorPhase,
        newPhase,
      );
      next = transition.frame;
      next = updateParticipant(next, actorId, () => transition.participant);
      engineState = transition.engineState;
    }

    next = updateParticipant(next, actorId, (participant) => {
      let p = cloneParticipant(participant);
      let state = engineState;

      p = processIncomeDryStreak(p);
      p = processLowCashShieldPenalty(p);
      p = processCascadeAmplifier(p);
      p = processHighPressureWindowShrink(p);
      p = processComebackLowCashTracking(p, frame.tick);
      p = processLiquidatorImmunity(p, state.ipaPortfolio);

      const isolationResult = processIsolationTax(p, state, frame.tick);
      p = isolationResult.participant;
      state = isolationResult.engineState;

      const debtResult = processDebtCompounding(p, state, frame.tick);
      p = debtResult.participant;
      state = debtResult.engineState;

      const comebackResult = processComebackSurge(p, state, frame.tick);
      p = comebackResult.participant;
      state = comebackResult.engineState;

      state = processMomentumDecay(state);
      state = processMLCapture(p, state, frame.tick);
      state = processAdvancedTickSignals(p, state, frame.tick);

      p = processForkHints(p, frame.tick);
      p = processPhaseBoundaryExpiry(p, frame.tick);

      return saveEngineState(p, state);
    });

    return next;
  }

  // --------------------------------------------------------------------------
  // onTickEnd — Per-tick post-processing
  // --------------------------------------------------------------------------
  public onTickEnd(frame: ModeFrame): ModeFrame {
    let next = cloneFrame(frame);
    const actorId = next.participants[0].playerId;

    next = updateParticipant(next, actorId, (participant) => {
      const pMut = mutableClone(participant);
      let p: ModeParticipant = pMut as ModeParticipant;
      let engineState = loadEngineState(p);

      p = decrementPhaseBoundaryWindow(p);

      const bleed =
        p.metadata['bleedMode'] === true || p.snapshot.modeState.bleedMode;
      if (bleed && p.snapshot.economy.cash <= 0) {
        if (!p.snapshot.tags.includes('VOID_SCAR')) {
          const pTag = mutableClone(p);
          pTag.snapshot.tags = [...pTag.snapshot.tags, 'VOID_SCAR'];
          p = pTag as ModeParticipant;
        }
      }

      if (
        p.snapshot.outcome === 'FREEDOM' &&
        Number(p.metadata['cashFloor'] ?? Number.MAX_SAFE_INTEGER) < 2000
      ) {
        p.metadata['comebackFreedom'] = true;
      }

      if (p.snapshot.outcome === 'FREEDOM' || p.snapshot.outcome === 'BANKRUPT' || p.snapshot.outcome === 'TIMEOUT') {
        const extendedCaseFile = generateExtendedCaseFile(
          { ...frame, participants: [p] } as ModeFrame,
          engineState,
          [],
        );
        p.metadata['soloCaseFile'] = JSON.stringify(extendedCaseFile);
      }

      return saveEngineState(p, engineState);
    });

    return next;
  }

  // --------------------------------------------------------------------------
  // validateCardPlay — Card legality enforcement
  // --------------------------------------------------------------------------
  public validateCardPlay(
    frame: ModeFrame,
    intent: CardPlayIntent,
  ): ModeValidationResult {
    const base = validateModeCardPlay(frame, intent);
    if (!base.ok) return base;

    const card = 'card' in intent.card ? intent.card.card : intent.card;
    const actor = frame.participants[0];

    if (isIllegalInSolo(card.deckType)) {
      return {
        ok: false,
        reason: `${card.deckType} cards are illegal in solo mode.`,
        warnings: base.warnings,
      };
    }

    if (!isCardLegalInSolo(card.deckType)) {
      return {
        ok: false,
        reason: `${card.deckType} is not in the solo-legal deck pool.`,
        warnings: base.warnings,
      };
    }

    const singleIncome =
      actor.metadata['singleIncome'] === true ||
      actor.snapshot.modeState.handicapIds.includes('SINGLE_INCOME');
    if (singleIncome && card.tags.includes('income')) {
      const heldIncomeCards = actor.snapshot.cards.hand.filter((entry) =>
        entry.tags.includes('income'),
      ).length;
      if (heldIncomeCards >= 1) {
        return {
          ok: false,
          reason: 'Single Income handicap prevents a second income hold.',
          warnings: base.warnings,
        };
      }
    }

    const bleed =
      actor.metadata['bleedMode'] === true ||
      actor.snapshot.modeState.bleedMode;
    if (bleed && SAFETY_CARD_IDS.has(card.id)) {
      return {
        ok: false,
        reason: 'Bleed mode removes safety cards from the legal pool.',
        warnings: base.warnings,
      };
    }

    if (
      intent.timing === 'PHZ' &&
      actor.snapshot.modeState.phaseBoundaryWindowsRemaining <= 0
    ) {
      return {
        ok: false,
        reason: 'Phase boundary window is closed.',
        warnings: base.warnings,
      };
    }

    if (isPhaseBoundaryCard(card.id) && !isPhaseBoundaryWindowOpen(actor)) {
      return {
        ok: false,
        reason: 'Phase boundary cards require an open phase boundary window.',
        warnings: base.warnings,
      };
    }

    if (intent.targetId && intent.targetId !== intent.actorId) {
      return {
        ok: false,
        reason: 'Solo cards cannot target another participant.',
        warnings: base.warnings,
      };
    }

    const engineState = loadEngineState(actor);
    const warnings = [...base.warnings];

    if (card.deckType === 'IPA' && engineState.ipaPortfolio.types.size >= 4) {
      warnings.push('IPA portfolio is already at maximum diversity. Card synergy effect may be limited.');
    }

    if (
      card.deckType === 'OPPORTUNITY' &&
      engineState.momentum.score >= 0.9
    ) {
      warnings.push('Momentum near maximum. Opportunity may yield diminishing returns.');
    }

    if (isDebtCritical(engineState.debtBurden) && card.baseEffect.debtDelta && card.baseEffect.debtDelta > 0) {
      warnings.push('Debt-to-income ratio is critical. Taking more debt will compound aggressively.');
    }

    return { ok: true, reason: null, warnings };
  }

  // --------------------------------------------------------------------------
  // applyCardOverlay — Wave-quality-adjusted card overlay
  // --------------------------------------------------------------------------
  public applyCardOverlay(
    frame: ModeFrame,
    _actorId: string,
    card: CardDefinition,
  ): CardInstance {
    const baseInstance = applyModeOverlay(frame, card);
    const actor = frame.participants[0];
    const phase = actor.snapshot.phase;

    const waveAdjusted = applyWaveQuality(baseInstance, phase);

    const engineState = loadEngineState(actor);
    const debtCostMultiplier = Number(actor.metadata['debtCostMultiplier'] ?? 1.0);
    if (
      card.baseEffect.debtDelta &&
      card.baseEffect.debtDelta > 0 &&
      debtCostMultiplier > 1.0
    ) {
      return {
        ...waveAdjusted,
        cost: Math.round(waveAdjusted.cost * debtCostMultiplier),
      };
    }

    if (engineState.comebackSurge.active && card.tags.includes('income')) {
      return {
        ...waveAdjusted,
        card: {
          ...waveAdjusted.card,
          baseEffect: {
            ...waveAdjusted.card.baseEffect,
            cashDelta: typeof waveAdjusted.card.baseEffect.cashDelta === 'number'
              ? Math.round(waveAdjusted.card.baseEffect.cashDelta * 1.5)
              : waveAdjusted.card.baseEffect.cashDelta,
          },
        },
      };
    }

    return waveAdjusted;
  }

  // --------------------------------------------------------------------------
  // resolveNamedAction — Hold, SO Conversion, Debt Paydown
  // --------------------------------------------------------------------------
  public resolveNamedAction(
    frame: ModeFrame,
    actorId: string,
    actionId: string,
    payload?: Record<string, unknown>,
  ): ModeFrame {
    let next = cloneFrame(frame);

    if (actionId === 'HOLD') {
      next = this.resolveHoldAction(next, actorId, payload);
    } else if (actionId === 'SO_CONVERSION') {
      next = this.resolveSOConversion(next, actorId, payload);
    } else if (actionId === 'DEBT_PAYDOWN') {
      next = this.resolveDebtPaydown(next, actorId, payload);
    } else if (actionId === 'CARD_PLAYED') {
      next = this.resolveCardPlayed(next, actorId, payload);
    }

    return next;
  }

  // --------------------------------------------------------------------------
  // finalize — CORD scoring + case file
  // --------------------------------------------------------------------------
  public finalize(frame: ModeFrame): ModeFinalization {
    const base = finalizeEmpire(frame);
    const participant = frame.participants[0];
    const engineState = loadEngineState(participant);

    let bonusMultiplier = base.bonusMultiplier;
    let flatBonus = base.flatBonus;
    const badges = [...base.badges];
    const notes = [...base.notes];
    const audits = [...base.audits, ...engineState.cardDecisions];

    if (engineState.hold.noHoldRun) {
      if (!badges.includes('NO_HOLD_RUN')) {
        bonusMultiplier += NO_HOLD_CORD_BONUS;
        badges.push('NO_HOLD_RUN');
      }
    }

    if (engineState.comebackSurge.cordBonusTagged) {
      if (!badges.includes('COMEBACK_SOVEREIGN')) {
        flatBonus += 0.05;
        badges.push('COMEBACK_SOVEREIGN');
      }
    }

    if (engineState.ipaPortfolio.sovereignPositionActive) {
      bonusMultiplier += 0.30;
      badges.push('SOVEREIGN_POSITION');
    }

    if (engineState.ipaPortfolio.synergyBonusesApplied.length >= 3) {
      bonusMultiplier += 0.15;
      badges.push('SYNERGY_MASTER');
    }

    if (engineState.isolationTax.totalTaxApplied > 5000 && participant.snapshot.outcome === 'FREEDOM') {
      bonusMultiplier += 0.20;
      badges.push('ISOLATION_SURVIVOR');
    }

    if (engineState.debtBurden.totalDebt === 0 && participant.snapshot.outcome === 'FREEDOM') {
      if (!badges.includes('DEBT_FREE')) {
        bonusMultiplier += 0.10;
        badges.push('DEBT_FREE');
      }
    }

    const soConversions = engineState.soConversions;
    if (soConversions.length >= 3) {
      const allPain = soConversions.every((c) => c.route === 'PAIN_ABSORPTION');
      if (allPain) {
        bonusMultiplier += 0.25;
        badges.push('PAIN_MASTER');
      }
    }

    const totalSOCordBonus = soConversions.reduce((sum, c) => sum + c.cordBonus, 0);
    flatBonus += totalSOCordBonus;

    notes.push(`IPA types=${engineState.ipaPortfolio.types.size}`);
    notes.push(`Synergies=${engineState.ipaPortfolio.synergyBonusesApplied.join(',')}`);
    notes.push(`Momentum peak=${engineState.peakMomentum.toFixed(2)}`);
    notes.push(`Isolation tax total=${engineState.isolationTax.totalTaxApplied}`);
    notes.push(`Debt peak=${engineState.peakDebt}`);
    notes.push(`SO conversions=${soConversions.length}`);
    notes.push(`Cards played=${engineState.totalCardsPlayed}`);
    notes.push(`Comeback=${engineState.comebackSurge.cordBonusTagged}`);
    notes.push(`Average decision latency=${averageDecisionLatencyMs(participant).toFixed(0)}ms`);

    return {
      bonusMultiplier,
      flatBonus,
      badges: Array.from(new Set(badges)),
      audits,
      notes,
    };
  }

  // --------------------------------------------------------------------------
  // Private: resolveHoldAction
  // --------------------------------------------------------------------------
  private resolveHoldAction(
    frame: ModeFrame,
    actorId: string,
    payload?: Record<string, unknown>,
  ): ModeFrame {
    let next = frame;
    const actor = next.participants[0];

    if (!actor.snapshot.modeState.holdEnabled) return next;

    const engineState = loadEngineState(actor);
    const cardId = String(payload?.cardId ?? 'default');

    if (!isHoldableCard(cardId)) {
      return pushEvent(next, {
        tick: next.tick,
        level: 'WARNING',
        channel: 'PRIVATE',
        actorId,
        code: 'HOLD_REJECTED',
        message: 'Phase boundary cards cannot be held.',
      });
    }

    if (!canUseHold(engineState.hold, engineState.momentum.score, actor.snapshot.modeState.bleedMode)) {
      return pushEvent(next, {
        tick: next.tick,
        level: 'WARNING',
        channel: 'PRIVATE',
        actorId,
        code: 'HOLD_REJECTED',
        message: 'No hold charges available.',
      });
    }

    next = updateParticipant(next, actorId, (participant) => {
      const cloned = mutableClone(participant);
      let state = loadEngineState(cloned as ModeParticipant);

      const newHoldState = useHold(
        state.hold,
        frame.tick,
        cardId,
        state.momentum.score,
      );

      const windowId = String(payload?.windowId ?? 'default');
      if (cloned.snapshot.timers.holdCharges > 0) {
        cloned.snapshot.timers.holdCharges -= 1;
      }
      cloned.snapshot.timers.frozenWindowIds = [
        ...cloned.snapshot.timers.frozenWindowIds,
        windowId,
      ];
      if (!cloned.snapshot.tags.includes('HOLD_USED')) {
        cloned.snapshot.tags = [...cloned.snapshot.tags, 'HOLD_USED'];
      }

      const holdsRemaining = newHoldState.maxHolds - newHoldState.holdsUsed;
      const signals = emitHoldUsedSignal(
        state.chatSignals,
        frame.tick,
        holdsRemaining,
      );

      state = {
        ...state,
        hold: newHoldState,
        chatSignals: signals,
      };

      return saveEngineState(cloned as ModeParticipant, state);
    });

    return pushEvent(next, {
      tick: next.tick,
      level: 'INFO',
      channel: 'SYSTEM',
      actorId,
      code: 'HOLD_USED',
      message: 'Empire hold action authorized by backend.',
    });
  }

  // --------------------------------------------------------------------------
  // Private: resolveSOConversion
  // --------------------------------------------------------------------------
  private resolveSOConversion(
    frame: ModeFrame,
    actorId: string,
    payload?: Record<string, unknown>,
  ): ModeFrame {
    let next = frame;
    const cardId = String(payload?.cardId ?? 'unknown_so');

    next = updateParticipant(next, actorId, (participant) => {
      let p = cloneParticipant(participant);
      let state = loadEngineState(p);

      // Evaluate all routes and select optimal if no explicit route provided
      const routeEvaluations = evaluateSORoutes(p, state);
      const inferredRoute = inferSOConversionRoute(p, payload);
      const route = payload?.route
        ? inferredRoute
        : selectOptimalSORoute(routeEvaluations);
      const record = createSOConversionRecord(cardId, route, frame.tick);
      p = applySOConversion(p, record);

      state = {
        ...state,
        soConversions: [...state.soConversions, record],
      };

      return saveEngineState(p, state);
    });

    return pushEvent(next, {
      tick: next.tick,
      level: 'INFO',
      channel: 'SYSTEM',
      actorId,
      code: 'SO_CONVERSION',
      message: `SO obstacle conversion resolved via ${payload?.route ?? 'auto-selected route'}.`,
    });
  }

  // --------------------------------------------------------------------------
  // Private: resolveDebtPaydown
  // --------------------------------------------------------------------------
  private resolveDebtPaydown(
    frame: ModeFrame,
    actorId: string,
    payload?: Record<string, unknown>,
  ): ModeFrame {
    let next = frame;
    const amount = Number(payload?.amount ?? 0);
    if (amount <= 0) return next;

    next = updateParticipant(next, actorId, (participant) => {
      const cloned = mutableClone(participant);
      let state = loadEngineState(cloned as ModeParticipant);

      const available = Math.min(amount, cloned.snapshot.economy.cash);
      cloned.snapshot.economy.cash -= available;

      state = {
        ...state,
        debtBurden: payDownDebt(
          state.debtBurden,
          available,
          cloned.snapshot.economy.incomePerTick,
        ),
      };

      cloned.snapshot.economy.debt = state.debtBurden.totalDebt;

      return saveEngineState(cloned as ModeParticipant, state);
    });

    return pushEvent(next, {
      tick: next.tick,
      level: 'INFO',
      channel: 'SYSTEM',
      actorId,
      code: 'DEBT_PAYDOWN',
      message: `Debt paydown of ${amount} authorized.`,
    });
  }

  // --------------------------------------------------------------------------
  // Private: resolveCardPlayed
  // --------------------------------------------------------------------------
  private resolveCardPlayed(
    frame: ModeFrame,
    actorId: string,
    payload?: Record<string, unknown>,
  ): ModeFrame {
    let next = frame;
    if (!payload?.card) return next;

    const card = payload.card as CardDefinition;
    const timingDelta = Number(payload?.timingDelta ?? 0);

    next = updateParticipant(next, actorId, (participant) => {
      let state = loadEngineState(participant);
      const result = processCardPlayForEngine(participant, state, card, frame.tick, timingDelta);
      const withDQS = processDecisionQualityTracking(result.participant, card, frame.tick, timingDelta);
      return saveEngineState(withDQS, result.engineState);
    });

    return next;
  }
}

// ============================================================================
// S23 — MODULE EXPORTS
// ============================================================================

/**
 * Factory function consumed by ModeRegistry.
 * Returns the canonical solo mode adapter.
 */
export function createSoloModeAdapter(): ModeAdapter {
  return new SoloModeEngine();
}

/**
 * Extract solo ML features from a participant.
 * Used by the ML pipeline when operating on solo mode frames.
 */
export function extractSoloFeatures(
  participant: ModeParticipant,
  tick: number,
): ModeMLFeatureVector {
  const state = loadEngineState(participant);
  return extractSoloMLFeatures(participant, state, tick);
}

/**
 * Generate a solo case file from a completed frame.
 * Used by the analytics pipeline post-run.
 */
export function generateSoloCaseFile(frame: ModeFrame): SoloCaseFile {
  const participant = frame.participants[0];
  const state = loadEngineState(participant);
  return generateCaseFile(frame, state);
}

/**
 * Build a chat bridge event from a solo signal.
 * Used by the chat bridge adapter.
 */
export function buildSoloChatEvent(
  signal: SoloChatSignal,
  runId: string,
  actorId: string,
): ModeChatBridgeEvent {
  return buildChatBridgeEvent(signal, runId, actorId);
}

/**
 * Get all accumulated chat signals from a solo participant.
 * Used by the chat bridge to flush signals.
 */
export function getSoloChatSignals(participant: ModeParticipant): SoloChatSignal[] {
  const state = loadEngineState(participant);
  return state.chatSignals;
}

/**
 * Check if a deck type is legal in solo mode.
 * Used by external validators and the deck builder.
 */
export function isSoloDeckTypeLegal(deckType: DeckType): boolean {
  return isCardLegalInSolo(deckType);
}

/**
 * Classify an IPA card into its sub-type.
 * Used by analytics and the deck builder.
 */
export function classifySoloIPAType(card: CardDefinition): IPAType | null {
  return classifyIPAType(card);
}

/**
 * Detect all active IPA synergies from a portfolio.
 * Used by the synergy display overlay.
 */
export function detectSoloIPASynergies(participant: ModeParticipant): string[] {
  const state = loadEngineState(participant);
  return detectIPASynergies(state.ipaPortfolio);
}

/**
 * Check whether the Liquidator (BOT_05) is currently neutralized
 * by the SOVEREIGN POSITION synergy.
 */
export function isSoloLiquidatorImmune(participant: ModeParticipant): boolean {
  const state = loadEngineState(participant);
  return isLiquidatorImmune(state.ipaPortfolio);
}

/**
 * Get the current momentum score for a solo participant.
 */
export function getSoloMomentumScore(participant: ModeParticipant): number {
  const state = loadEngineState(participant);
  return state.momentum.score;
}

/**
 * Get the current isolation tax multiplier.
 */
export function getSoloIsolationTaxMultiplier(participant: ModeParticipant): number {
  const state = loadEngineState(participant);
  return state.isolationTax.currentMultiplier;
}

/**
 * Get the current debt burden state.
 */
export function getSoloDebtBurden(participant: ModeParticipant): DebtBurdenState {
  const state = loadEngineState(participant);
  return state.debtBurden;
}

/**
 * Check if comeback surge is active.
 */
export function isSoloComebackSurgeActive(participant: ModeParticipant): boolean {
  const state = loadEngineState(participant);
  return state.comebackSurge.active;
}

/**
 * Get the hold state for a solo participant.
 */
export function getSoloHoldState(participant: ModeParticipant): {
  holdsUsed: number;
  maxHolds: number;
  noHoldRun: boolean;
  secondHoldUnlocked: boolean;
} {
  const state = loadEngineState(participant);
  return {
    holdsUsed: state.hold.holdsUsed,
    maxHolds: state.hold.maxHolds,
    noHoldRun: state.hold.noHoldRun,
    secondHoldUnlocked: state.hold.secondHoldUnlocked,
  };
}

/**
 * Get SO conversion records for a solo participant.
 */
export function getSoloSOConversions(participant: ModeParticipant): SOConversionRecord[] {
  const state = loadEngineState(participant);
  return state.soConversions;
}

/**
 * Get educational engagement summary.
 */
export function getSoloEducationalEngagements(
  participant: ModeParticipant,
): Record<string, EducationalEngagement> {
  const state = loadEngineState(participant);
  return state.educationalEngagements;
}

/**
 * Get phase performance records.
 */
export function getSoloPhasePerformance(participant: ModeParticipant): PhasePerformance[] {
  const state = loadEngineState(participant);
  return state.phasePerformance;
}

/**
 * Wave quality cost multiplier for the current phase.
 * Used by UI to preview card costs before purchase.
 */
export function getSoloWaveQualityCostMultiplier(phase: RunPhase): number {
  return WAVE_QUALITY_COST_MULTIPLIERS[phase];
}

/**
 * Wave quality effect multiplier for the current phase.
 * Used by UI to preview card effects.
 */
export function getSoloWaveQualityEffectMultiplier(phase: RunPhase): number {
  return WAVE_QUALITY_EFFECT_MULTIPLIERS[phase];
}

/**
 * Phase tick boundary information.
 * Used by UI for progress display.
 */
export function getSoloPhaseTickBoundary(
  phase: RunPhase,
): { start: number; end: number } {
  return PHASE_TICK_BOUNDARIES[phase];
}

/**
 * Check if a card is a phase boundary card.
 */
export function isSoloPhaseBoundaryCard(cardId: string): boolean {
  return isPhaseBoundaryCard(cardId);
}

/**
 * Get the debt-to-income ratio critical threshold.
 */
export function getSoloDebtToIncomeCriticalThreshold(): number {
  return DEBT_TO_INCOME_CRITICAL_THRESHOLD;
}

/**
 * Get the momentum threshold for second hold unlock.
 */
export function getSoloMomentumHoldUnlockThreshold(): number {
  return MOMENTUM_HOLD_UNLOCK_THRESHOLD;
}

/**
 * Get the momentum quality tier for a given score.
 */
export function getSoloMomentumQualityTier(
  score: number,
): 'SCRAPPY' | 'STANDARD' | 'LEVERAGED' | 'EMPIRE_SCALE' {
  return momentumToQualityTier(score);
}

/**
 * Get the comeback surge thresholds.
 */
export function getSoloComebackThresholds(): {
  dropFraction: number;
  recoverFraction: number;
  durationTicks: number;
  decisionSpeedWeight: number;
} {
  return {
    dropFraction: COMEBACK_DROP_FRACTION,
    recoverFraction: COMEBACK_RECOVER_FRACTION,
    durationTicks: COMEBACK_SURGE_DURATION_TICKS,
    decisionSpeedWeight: COMEBACK_DECISION_SPEED_WEIGHT,
  };
}

/**
 * Get the isolation tax parameters.
 */
export function getSoloIsolationTaxParams(): {
  base: number;
  cap: number;
} {
  return {
    base: ISOLATION_TAX_BASE,
    cap: ISOLATION_TAX_CAP,
  };
}

/**
 * All IPA synergy types for documentation and UI display.
 */
export function getSoloIPASynergyDescriptions(): Record<string, string> {
  return {
    REAL_ESTATE_EQUITY: `Real Estate + Equity: +${IPA_SYNERGY_REAL_ESTATE_EQUITY_INCOME_BONUS * 100}% income`,
    DIGITAL_LICENSING: `Digital + Licensing: +${IPA_SYNERGY_DIGITAL_LICENSING_CASHFLOW_BONUS * 100}% cashflow`,
    BUSINESS_REAL_ESTATE: `Business + Real Estate: +$${IPA_SYNERGY_BUSINESS_REAL_ESTATE_MONTHLY_BONUS}/month per IPA`,
    AUTOMATION_TRIGGER: `3+ IPA types: Automation Trigger (15% expense reduction)`,
    SOVEREIGN_POSITION: `All 4 IPA types: SOVEREIGN POSITION (${IPA_SYNERGY_ALL_FOUR_SOVEREIGN_SHIELD_REGEN_MULTIPLIER}x shield regen + Liquidator immunity)`,
  };
}

/**
 * Return the list of deck types that are illegal in solo mode.
 * Used by UI to grey out illegal cards.
 */
export function getSoloIllegalDeckTypes(): readonly DeckType[] {
  return SOLO_ILLEGAL_DECK_TYPES;
}

/**
 * Build a CardInstance for solo mode with wave-quality and tag-weight adjustments.
 * Used by the deck builder and preview systems.
 */
export function buildSoloCardPreview(
  card: CardDefinition,
  phase: RunPhase,
): CardInstance {
  return buildSoloCardInstance(card, phase);
}

/**
 * Determine the run phase based on tick number.
 * Used by simulation and batch testing to map tick to phase.
 */
export function getSoloPhaseForTick(tick: number, totalTicks: number): RunPhase {
  return phaseForTick(tick, totalTicks);
}

/**
 * Score a decision made during solo mode.
 * Used by analytics and ML pipelines to evaluate play quality.
 */
export function scoreSoloDecision(
  participant: ModeParticipant,
  card: CardDefinition,
  tick: number,
  timingDelta: number,
): DecisionQualityRecord {
  return scoreDecision(participant, card, tick, timingDelta);
}

/**
 * Aggregate decision quality records into a summary.
 * Used by the case file generator and analytics dashboard.
 */
export function aggregateSoloDecisionQuality(
  records: DecisionQualityRecord[],
): DecisionQualityAggregate {
  return aggregateDecisionQuality(records);
}

/**
 * Evaluate IPA synergy strength for a given synergy type.
 * Used by the UI overlay to display synergy impact.
 */
export function evaluateSoloSynergyStrength(
  synergy: string,
  activationTick: number,
  totalTicks: number,
  phase: RunPhase,
): { label: SynergyStrengthLabel; score: number } {
  return evaluateSynergyStrength(synergy, activationTick, totalTicks, phase);
}

/**
 * Build a synergy evaluation for display in the UI.
 */
export function buildSoloSynergyEvaluation(
  synergy: string,
  participant: ModeParticipant,
  tick: number,
  totalTicks: number,
  phase: RunPhase,
): SynergyEvaluation {
  const state = loadEngineState(participant);
  return buildSynergyEvaluation(synergy, state.ipaPortfolio, tick, totalTicks, phase, participant);
}

/**
 * Evaluate the health of a solo participant's IPA portfolio.
 */
export function evaluateSoloPortfolioHealth(
  participant: ModeParticipant,
  tick: number,
): ReturnType<typeof evaluateIPAPortfolioHealth> {
  const state = loadEngineState(participant);
  return evaluateIPAPortfolioHealth(state.ipaPortfolio, participant, tick);
}

/**
 * Get the phase boundary card spec for a given card ID.
 */
export function getSoloPhaseBoundaryCardSpec(cardId: string): PhaseBoundaryCardSpec | null {
  return getPhaseBoundaryCardSpec(cardId);
}

/**
 * All phase boundary card specs.
 */
export function getSoloPhaseBoundaryCardSpecs(): readonly PhaseBoundaryCardSpec[] {
  return PHASE_BOUNDARY_CARD_SPECS;
}

/**
 * Compute the cost of a phase boundary card for a given participant.
 */
export function computeSoloPhaseBoundaryCardCost(
  cardId: string,
  participant: ModeParticipant,
): number | null {
  const spec = getPhaseBoundaryCardSpec(cardId);
  if (!spec) return null;
  return computePhaseBoundaryCardCost(spec, participant);
}

/**
 * Get wave quality tier info for a given phase.
 */
export function getSoloWaveQualityTierInfo(phase: RunPhase): WaveQualityTierInfo {
  return getWaveQualityTierInfo(phase);
}

/**
 * Analyze debt burden in depth.
 * Used by the analytics dashboard and recommendation engine.
 */
export function analyzeSoloDebtBurden(participant: ModeParticipant): DebtAnalytics {
  const state = loadEngineState(participant);
  return analyzeDebtBurden(
    state.debtBurden,
    participant.snapshot.economy.incomePerTick,
    participant.snapshot.economy.cash,
  );
}

/**
 * Get a debt paydown recommendation.
 */
export function getSoloDebtPaydownRecommendation(participant: ModeParticipant): {
  shouldPay: boolean;
  suggestedAmount: number;
  reason: string;
} {
  const state = loadEngineState(participant);
  const analytics = analyzeDebtBurden(
    state.debtBurden,
    participant.snapshot.economy.incomePerTick,
    participant.snapshot.economy.cash,
  );
  return shouldAutoPayDebt(
    analytics,
    participant.snapshot.economy.cash,
    participant.snapshot.economy.freedomTarget,
  );
}

/**
 * Evaluate all SO conversion routes for a participant.
 * Used by the UI to display route viability and recommendations.
 */
export function evaluateSoloSORoutes(participant: ModeParticipant): SORouteEvaluation[] {
  const state = loadEngineState(participant);
  return evaluateSORoutes(participant, state);
}

/**
 * Select the optimal SO conversion route.
 */
export function selectSoloOptimalSORoute(participant: ModeParticipant): SOConversionRoute {
  const state = loadEngineState(participant);
  const evaluations = evaluateSORoutes(participant, state);
  return selectOptimalSORoute(evaluations);
}

/**
 * Analyze momentum patterns.
 */
export function analyzeSoloMomentum(participant: ModeParticipant): MomentumAnalytics {
  const state = loadEngineState(participant);
  return analyzeMomentum(state.momentum, state.peakMomentum, state.mlSnapshots, participant.snapshot.phase);
}

/**
 * Extract Empire-specific extended ML features.
 */
export function extractSoloEmpireMLFeatures(
  participant: ModeParticipant,
): EmpireMLExtendedFeatures {
  const state = loadEngineState(participant);
  return extractEmpireExtendedFeatures(participant, state);
}

/**
 * Analyze educational engagement for a solo participant.
 */
export function analyzeSoloEducationalEngagement(
  participant: ModeParticipant,
): EducationalAnalytics {
  const state = loadEngineState(participant);
  return analyzeEducationalEngagement(state.educationalEngagements);
}

/**
 * Suggest the next educational focus area for the player.
 */
export function suggestSoloNextEducationalFocus(
  participant: ModeParticipant,
): string {
  const state = loadEngineState(participant);
  const analytics = analyzeEducationalEngagement(state.educationalEngagements);
  return suggestNextEducationalFocus(analytics, participant.snapshot.phase);
}

/**
 * Generate an extended case file with deep analytics.
 */
export function generateSoloExtendedCaseFile(
  frame: ModeFrame,
  decisionRecords: DecisionQualityRecord[],
): ExtendedSoloCaseFile {
  const state = loadEngineState(frame.participants[0]);
  return generateExtendedCaseFile(frame, state, decisionRecords);
}

/**
 * Check if a card is in the appropriate wave quality tier range for the current phase.
 */
export function isSoloCardInWaveTierRange(card: CardDefinition, phase: RunPhase): boolean {
  return isCardInWaveTierRange(card, phase);
}

/**
 * Compute a wave-adjusted value for display purposes.
 */
export function computeSoloWaveAdjustedValue(
  baseValue: number,
  phase: RunPhase,
  isEffect: boolean,
): number {
  return computeWaveAdjustedValue(baseValue, phase, isEffect);
}

/**
 * Get the complete set of Empire chat event types.
 */
export function getSoloEmpireChatEventTypes(): readonly string[] {
  return EMPIRE_CHAT_EVENT_TYPES;
}

/**
 * Check if a phase boundary card is playable.
 */
export function isSoloPhaseBoundaryCardPlayable(
  cardId: string,
  participant: ModeParticipant,
): { playable: boolean; reason: string | null } {
  const spec = getPhaseBoundaryCardSpec(cardId);
  if (!spec) return { playable: false, reason: 'Unknown phase boundary card.' };
  const state = loadEngineState(participant);
  return isPhaseBoundaryCardPlayable(spec, participant, state);
}

/**
 * Decision quality score thresholds for classification.
 */
export function getSoloDecisionQualityThresholds(): {
  excellent: number;
  good: number;
  mediocre: number;
  poor: number;
} {
  return {
    excellent: DQS_EXCELLENT_THRESHOLD,
    good: DQS_GOOD_THRESHOLD,
    mediocre: DQS_MEDIOCRE_THRESHOLD,
    poor: DQS_POOR_THRESHOLD,
  };
}

/**
 * Compute portfolio diversity velocity.
 * Higher velocity indicates faster IPA type acquisition.
 */
export function getSoloPortfolioDiversityVelocity(
  participant: ModeParticipant,
  tick: number,
): number {
  const state = loadEngineState(participant);
  return computePortfolioDiversityVelocity(state.ipaPortfolio, tick);
}
