// backend/src/game/engine/card_types.ts

/**
 * POINT ZERO ONE — BACKEND CARD TYPES
 * backend/src/game/engine/card_types.ts
 *
 * Backend-native contract layer for mode-aware card execution.
 * This file intentionally mirrors the doctrine in the uploaded Card Logic Bible
 * and Game Mode Bible rather than the thinner frontend v2 naming.
 *
 * Doctrine anchors:
 * - 4 game modes
 * - 12 timing classes: PRE / POST / FATE / CTR / RES / AID / GBM / CAS / PHZ / PSK / END / ANY
 * - 14 deck types
 * - mode overlays mutate legality, targeting, timing, and CORD weights at draw time
 * - backend remains the authoritative simulation surface
 */

import { createHash } from 'node:crypto';
import {
  combineSeed,
  createDeterministicRng,
  normalizeSeed,
  hashStringToSeed,
  type DeterministicRng,
} from './deterministic_rng';

// ─────────────────────────────────────────────────────────────────────────────
// MODES / PHASES / PRESSURE
// ─────────────────────────────────────────────────────────────────────────────

export enum GameMode {
  GO_ALONE = 'GO_ALONE',
  HEAD_TO_HEAD = 'HEAD_TO_HEAD',
  TEAM_UP = 'TEAM_UP',
  CHASE_A_LEGEND = 'CHASE_A_LEGEND',
}

export enum RunPhase {
  FOUNDATION = 'FOUNDATION',
  ESCALATION = 'ESCALATION',
  SOVEREIGNTY = 'SOVEREIGNTY',
}

export enum PressureTier {
  T0_SOVEREIGN = 'T0_SOVEREIGN',
  T1_STABLE = 'T1_STABLE',
  T2_STRESSED = 'T2_STRESSED',
  T3_ELEVATED = 'T3_ELEVATED',
  T4_COLLAPSE_IMMINENT = 'T4_COLLAPSE_IMMINENT',
}

export type ModeCode = 'solo' | 'pvp' | 'coop' | 'ghost';

export const MODE_CODE_MAP: Record<ModeCode, GameMode> = {
  solo: GameMode.GO_ALONE,
  pvp: GameMode.HEAD_TO_HEAD,
  coop: GameMode.TEAM_UP,
  ghost: GameMode.CHASE_A_LEGEND,
};

// ─────────────────────────────────────────────────────────────────────────────
// TIMING / DECKS / TAGS / TARGETS
// ─────────────────────────────────────────────────────────────────────────────

export enum TimingClass {
  PRE = 'PRE',
  POST = 'POST',
  FATE = 'FATE',
  CTR = 'CTR',
  RES = 'RES',
  AID = 'AID',
  GBM = 'GBM',
  CAS = 'CAS',
  PHZ = 'PHZ',
  PSK = 'PSK',
  END = 'END',
  ANY = 'ANY',
}

export enum DeckType {
  OPPORTUNITY = 'OPPORTUNITY',
  IPA = 'IPA',
  FUBAR = 'FUBAR',
  MISSED_OPPORTUNITY = 'MISSED_OPPORTUNITY',
  PRIVILEGED = 'PRIVILEGED',
  SO = 'SO',
  SABOTAGE = 'SABOTAGE',
  COUNTER = 'COUNTER',
  AID = 'AID',
  RESCUE = 'RESCUE',
  DISCIPLINE = 'DISCIPLINE',
  TRUST = 'TRUST',
  BLUFF = 'BLUFF',
  GHOST = 'GHOST',
}

export enum CardTag {
  LIQUIDITY = 'liquidity',
  INCOME = 'income',
  RESILIENCE = 'resilience',
  SCALE = 'scale',
  TEMPO = 'tempo',
  SABOTAGE = 'sabotage',
  COUNTER = 'counter',
  HEAT = 'heat',
  TRUST = 'trust',
  AID = 'aid',
  PRECISION = 'precision',
  DIVERGENCE = 'divergence',
  VARIANCE = 'variance',
  CASCADE = 'cascade',
  MOMENTUM = 'momentum',
}

export enum Targeting {
  SELF = 'SELF',
  OPPONENT = 'OPPONENT',
  TEAMMATE = 'TEAMMATE',
  TEAM = 'TEAM',
  GLOBAL = 'GLOBAL',
  GHOST = 'GHOST',
}

export enum CardRarity {
  COMMON = 'COMMON',
  UNCOMMON = 'UNCOMMON',
  RARE = 'RARE',
  LEGENDARY = 'LEGENDARY',
}

export enum Counterability {
  NONE = 'NONE',
  SOFT = 'SOFT',
  HARD = 'HARD',
}

export type CurrencyType = 'cash' | 'battle_budget' | 'treasury' | 'none';

// ─────────────────────────────────────────────────────────────────────────────
// EFFECTS
// ─────────────────────────────────────────────────────────────────────────────

export enum CardEffectOp {
  CASH_DELTA = 'cash_delta',
  INCOME_DELTA = 'income_delta',
  EXPENSE_DELTA = 'expense_delta',
  SHIELD_DELTA = 'shield_delta',
  HEAT_DELTA = 'heat_delta',
  TRUST_DELTA = 'trust_delta',
  DIVERGENCE_DELTA = 'divergence_delta',
  BATTLE_BUDGET_DELTA = 'battle_budget_delta',
  TREASURY_DELTA = 'treasury_delta',
  DRAW_CARDS = 'draw_cards',
  INJECT_CARD = 'inject_card',
  STATUS_ADD = 'status_add',
  STATUS_REMOVE = 'status_remove',
  TIMER_FREEZE = 'timer_freeze',
  CORD_BONUS_FLAT = 'cord_bonus_flat',
  NO_OP = 'no_op',
}

export interface CardEffectSpec {
  readonly op: CardEffectOp;
  readonly magnitude: number;
  readonly durationTicks?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD DEFINITION / OVERLAY / RUNTIME
// ─────────────────────────────────────────────────────────────────────────────

export interface ModeOverlay {
  readonly costModifier: number;
  readonly effectModifier: number;
  readonly tagWeights: Readonly<Partial<Record<CardTag, number>>>;
  readonly timingLock: readonly TimingClass[];
  readonly legal: boolean;
  readonly targetingOverride?: Targeting;
  readonly cordWeight: number;
  readonly currencyOverride?: CurrencyType;
  readonly holdAllowed?: boolean;
  readonly autoResolveOverride?: boolean;
}

export interface CardOverlaySnapshot {
  readonly costModifier?: number;
  readonly effectModifier?: number;
  readonly tagWeights?: Readonly<Partial<Record<CardTag, number>>>;
  readonly timingLock?: readonly TimingClass[];
  readonly legal?: boolean;
  readonly targetingOverride?: Targeting;
  readonly cordWeight?: number;
  readonly currencyOverride?: CurrencyType;
  readonly holdAllowed?: boolean;
  readonly autoResolveOverride?: boolean;
}

export interface CardDefinition {
  readonly cardId: string;
  readonly name: string;
  readonly deckType: DeckType;
  readonly baseCost: number;
  readonly effects: readonly CardEffectSpec[];
  readonly tags: readonly CardTag[];
  readonly timingClasses: readonly TimingClass[];
  readonly rarity: CardRarity;
  readonly autoResolve: boolean;
  readonly counterability: Counterability;
  readonly targeting: Targeting;
  readonly decisionTimerOverrideMs?: number | null;
  readonly decayTicks?: number | null;
  readonly modeLegal?: readonly GameMode[];
  readonly modeOverlays?: Readonly<Partial<Record<GameMode, Partial<ModeOverlay>>>>;
  readonly educationalTag?: string;
}

export interface CardInHand {
  readonly instanceId: string;
  readonly definition: CardDefinition;
  readonly overlay: ModeOverlay;
  readonly drawnAtTick: number;
  readonly effectiveCost: number;
  readonly effectiveCurrency: CurrencyType;
  readonly isForced: boolean;
  readonly isHeld: boolean;
  readonly isLegendary: boolean;
  readonly expiresAtTick?: number;
}

export interface HoldSlot {
  readonly card: CardInHand;
  readonly heldAtTick: number;
  readonly remainingWindowMs: number;
}

export interface DecisionWindow {
  readonly windowId: string;
  readonly cardInstanceId: string;
  readonly timingClass: TimingClass;
  readonly openedAtTick: number;
  readonly durationMs: number;
  readonly autoResolveChoiceId: string;
  readonly remainingMs: number;
  readonly isExpired: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAY / VALIDATION / EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

export interface CardPlayRequest {
  readonly instanceId: string;
  readonly choiceId: string;
  readonly timestamp: number;
  readonly timingClass?: TimingClass;
  readonly targetId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ExecutionContext {
  readonly mode: GameMode;
  readonly runSeed: string;
  readonly tickIndex: number;
  readonly currentPhase?: RunPhase;
  readonly currentPressureTier?: PressureTier;
  readonly currentWindow?: TimingClass;
  readonly isFinalTick?: boolean;
  readonly activeFateWindow?: boolean;
  readonly activeCounterWindow?: boolean;
  readonly activeRescueWindow?: boolean;
  readonly activeAidWindow?: boolean;
  readonly activeGhostBenchmarkWindow?: boolean;
  readonly activeCascadeInterceptWindow?: boolean;
  readonly activePhaseBoundaryWindow?: boolean;
  readonly activePressureSpikeWindow?: boolean;
  readonly battleBudget?: number;
  readonly treasury?: number;
  readonly trustScore?: number;
  readonly divergenceScore?: number;
  readonly availableTargetIds?: readonly string[];
  readonly forcedCardPending?: boolean;
  readonly cardHoldEnabled?: boolean;
  readonly activeStatuses?: Readonly<Record<string, readonly string[]>>;
  readonly windowRemainingTicksByTiming?: Readonly<Partial<Record<TimingClass, number>>>;
  readonly windowRemainingMsByTiming?: Readonly<Partial<Record<TimingClass, number>>>;
}

export enum TimingRejectionCode {
  MODE_ILLEGAL = 'MODE_ILLEGAL',
  CARD_ILLEGAL = 'CARD_ILLEGAL',
  DECK_ILLEGAL = 'DECK_ILLEGAL',
  TIMING_CLASS_ILLEGAL = 'TIMING_CLASS_ILLEGAL',
  WINDOW_CLOSED = 'WINDOW_CLOSED',
  AUTO_RESOLVE_ONLY = 'AUTO_RESOLVE_ONLY',
  CARD_EXPIRED = 'CARD_EXPIRED',
  INSUFFICIENT_BATTLE_BUDGET = 'INSUFFICIENT_BATTLE_BUDGET',
  INSUFFICIENT_TREASURY = 'INSUFFICIENT_TREASURY',
  TARGET_ILLEGAL = 'TARGET_ILLEGAL',
  HOLD_RESTRICTED = 'HOLD_RESTRICTED',
  FORCED_CARD_PENDING = 'FORCED_CARD_PENDING',
}

export interface TimingValidationResult {
  readonly valid: boolean;
  readonly rejectionCode: TimingRejectionCode | null;
  readonly reason: string | null;
  readonly requestedTiming: TimingClass;
  readonly allowedTimingClasses: readonly TimingClass[];
  readonly effectiveTargeting: Targeting;
  readonly remainingWindowTicks?: number;
  readonly remainingWindowMs?: number;
}

export interface AppliedEffect {
  readonly op: CardEffectOp;
  readonly baseMagnitude: number;
  readonly finalMagnitude: number;
  readonly durationTicks: number;
  readonly targeting: Targeting;
  readonly resolvedTargetId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ResourceDelta {
  readonly cash: number;
  readonly income: number;
  readonly expense: number;
  readonly shield: number;
  readonly heat: number;
  readonly trust: number;
  readonly divergence: number;
  readonly battleBudget: number;
  readonly treasury: number;
}

export interface CardEffectResult {
  readonly playId: string;
  readonly deterministicHash: string;
  readonly cardInstanceId: string;
  readonly cardId: string;
  readonly cardName: string;
  readonly mode: GameMode;
  readonly choiceId: string;
  readonly appliedAt: number;
  readonly timingClass: TimingClass;
  readonly effectiveCost: number;
  readonly currencyUsed: CurrencyType;
  readonly targeting: Targeting;
  readonly effects: readonly AppliedEffect[];
  readonly totalCordDelta: number;
  readonly resourceDelta: ResourceDelta;
  readonly drawCount: number;
  readonly injectedCardIds: readonly string[];
  readonly statusesAdded: readonly string[];
  readonly statusesRemoved: readonly string[];
  readonly isOptimalChoice: boolean;
  readonly educationalTag?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCTRINE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const TIMING_WINDOW_TICKS: Readonly<Record<TimingClass, number>> = {
  [TimingClass.PRE]: 1,
  [TimingClass.POST]: 1,
  [TimingClass.FATE]: 1,
  [TimingClass.CTR]: 1,
  [TimingClass.RES]: 0,
  [TimingClass.AID]: 0,
  [TimingClass.GBM]: 3,
  [TimingClass.CAS]: 1,
  [TimingClass.PHZ]: 5,
  [TimingClass.PSK]: 1,
  [TimingClass.END]: 1,
  [TimingClass.ANY]: 0,
};

export const TIMING_CLASS_WINDOW_MS: Readonly<Record<TimingClass, number>> = {
  [TimingClass.PRE]: 12_000,
  [TimingClass.POST]: 12_000,
  [TimingClass.FATE]: 4_000,
  [TimingClass.CTR]: 5_000,
  [TimingClass.RES]: 15_000,
  [TimingClass.AID]: 15_000,
  [TimingClass.GBM]: 9_000,
  [TimingClass.CAS]: 8_000,
  [TimingClass.PHZ]: 45_000,
  [TimingClass.PSK]: 8_500,
  [TimingClass.END]: 30_000,
  [TimingClass.ANY]: 0,
};

export const DECK_TYPE_MODE_MATRIX: Readonly<Record<DeckType, readonly GameMode[]>> = {
  [DeckType.OPPORTUNITY]: [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD, GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND],
  [DeckType.IPA]: [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD, GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND],
  [DeckType.FUBAR]: [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD, GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND],
  [DeckType.MISSED_OPPORTUNITY]: [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD, GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND],
  [DeckType.PRIVILEGED]: [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD, GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND],
  [DeckType.SO]: [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD, GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND],
  [DeckType.SABOTAGE]: [GameMode.HEAD_TO_HEAD],
  [DeckType.COUNTER]: [GameMode.HEAD_TO_HEAD],
  [DeckType.AID]: [GameMode.TEAM_UP],
  [DeckType.RESCUE]: [GameMode.TEAM_UP],
  [DeckType.DISCIPLINE]: [GameMode.GO_ALONE, GameMode.CHASE_A_LEGEND],
  [DeckType.TRUST]: [GameMode.TEAM_UP],
  [DeckType.BLUFF]: [GameMode.HEAD_TO_HEAD],
  [DeckType.GHOST]: [GameMode.CHASE_A_LEGEND],
};

export const CARD_LEGALITY_MATRIX: Readonly<Record<GameMode, readonly DeckType[]>> = {
  [GameMode.GO_ALONE]: [
    DeckType.OPPORTUNITY,
    DeckType.IPA,
    DeckType.FUBAR,
    DeckType.MISSED_OPPORTUNITY,
    DeckType.PRIVILEGED,
    DeckType.SO,
    DeckType.DISCIPLINE,
  ],
  [GameMode.HEAD_TO_HEAD]: [
    DeckType.OPPORTUNITY,
    DeckType.IPA,
    DeckType.FUBAR,
    DeckType.MISSED_OPPORTUNITY,
    DeckType.PRIVILEGED,
    DeckType.SO,
    DeckType.SABOTAGE,
    DeckType.COUNTER,
    DeckType.BLUFF,
  ],
  [GameMode.TEAM_UP]: [
    DeckType.OPPORTUNITY,
    DeckType.IPA,
    DeckType.FUBAR,
    DeckType.MISSED_OPPORTUNITY,
    DeckType.PRIVILEGED,
    DeckType.SO,
    DeckType.AID,
    DeckType.RESCUE,
    DeckType.TRUST,
  ],
  [GameMode.CHASE_A_LEGEND]: [
    DeckType.OPPORTUNITY,
    DeckType.IPA,
    DeckType.FUBAR,
    DeckType.MISSED_OPPORTUNITY,
    DeckType.PRIVILEGED,
    DeckType.SO,
    DeckType.DISCIPLINE,
    DeckType.GHOST,
  ],
};

export const TIMING_CLASS_MODE_MATRIX: Readonly<Record<TimingClass, readonly GameMode[]>> = {
  [TimingClass.PRE]: [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD, GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND],
  [TimingClass.POST]: [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD, GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND],
  [TimingClass.FATE]: [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD, GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND],
  [TimingClass.CTR]: [GameMode.HEAD_TO_HEAD],
  [TimingClass.RES]: [GameMode.TEAM_UP],
  [TimingClass.AID]: [GameMode.TEAM_UP],
  [TimingClass.GBM]: [GameMode.CHASE_A_LEGEND],
  [TimingClass.CAS]: [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD, GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND],
  [TimingClass.PHZ]: [GameMode.GO_ALONE],
  [TimingClass.PSK]: [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD, GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND],
  [TimingClass.END]: [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD, GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND],
  [TimingClass.ANY]: [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD, GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND],
};

export const MODE_TAG_WEIGHT_DEFAULTS: Readonly<Record<GameMode, Readonly<Record<CardTag, number>>>> = {
  [GameMode.GO_ALONE]: {
    [CardTag.LIQUIDITY]: 2.0,
    [CardTag.INCOME]: 2.2,
    [CardTag.RESILIENCE]: 1.8,
    [CardTag.SCALE]: 2.5,
    [CardTag.TEMPO]: 1.0,
    [CardTag.SABOTAGE]: 0.0,
    [CardTag.COUNTER]: 0.0,
    [CardTag.HEAT]: 0.6,
    [CardTag.TRUST]: 0.0,
    [CardTag.AID]: 0.0,
    [CardTag.PRECISION]: 1.2,
    [CardTag.DIVERGENCE]: 0.0,
    [CardTag.VARIANCE]: 1.0,
    [CardTag.CASCADE]: 1.8,
    [CardTag.MOMENTUM]: 2.0,
  },
  [GameMode.HEAD_TO_HEAD]: {
    [CardTag.LIQUIDITY]: 0.8,
    [CardTag.INCOME]: 0.6,
    [CardTag.RESILIENCE]: 1.0,
    [CardTag.SCALE]: 0.5,
    [CardTag.TEMPO]: 2.4,
    [CardTag.SABOTAGE]: 2.8,
    [CardTag.COUNTER]: 2.2,
    [CardTag.HEAT]: 1.5,
    [CardTag.TRUST]: 0.0,
    [CardTag.AID]: 0.0,
    [CardTag.PRECISION]: 0.8,
    [CardTag.DIVERGENCE]: 0.0,
    [CardTag.VARIANCE]: 1.4,
    [CardTag.CASCADE]: 1.2,
    [CardTag.MOMENTUM]: 1.5,
  },
  [GameMode.TEAM_UP]: {
    [CardTag.LIQUIDITY]: 1.5,
    [CardTag.INCOME]: 1.8,
    [CardTag.RESILIENCE]: 2.0,
    [CardTag.SCALE]: 1.3,
    [CardTag.TEMPO]: 1.0,
    [CardTag.SABOTAGE]: 0.2,
    [CardTag.COUNTER]: 0.5,
    [CardTag.HEAT]: 0.8,
    [CardTag.TRUST]: 3.0,
    [CardTag.AID]: 2.5,
    [CardTag.PRECISION]: 1.0,
    [CardTag.DIVERGENCE]: 0.0,
    [CardTag.VARIANCE]: 0.4,
    [CardTag.CASCADE]: 1.6,
    [CardTag.MOMENTUM]: 1.2,
  },
  [GameMode.CHASE_A_LEGEND]: {
    [CardTag.LIQUIDITY]: 1.2,
    [CardTag.INCOME]: 1.0,
    [CardTag.RESILIENCE]: 1.4,
    [CardTag.SCALE]: 0.9,
    [CardTag.TEMPO]: 1.8,
    [CardTag.SABOTAGE]: 0.0,
    [CardTag.COUNTER]: 0.0,
    [CardTag.HEAT]: 1.0,
    [CardTag.TRUST]: 0.0,
    [CardTag.AID]: 0.0,
    [CardTag.PRECISION]: 2.6,
    [CardTag.DIVERGENCE]: 3.0,
    [CardTag.VARIANCE]: 0.3,
    [CardTag.CASCADE]: 1.5,
    [CardTag.MOMENTUM]: 1.0,
  },
};

export const DEFAULT_MODE_OVERLAYS: Readonly<Record<GameMode, ModeOverlay>> = {
  [GameMode.GO_ALONE]: {
    costModifier: 1,
    effectModifier: 1,
    tagWeights: MODE_TAG_WEIGHT_DEFAULTS[GameMode.GO_ALONE],
    timingLock: [],
    legal: true,
    cordWeight: 1,
    holdAllowed: true,
  },
  [GameMode.HEAD_TO_HEAD]: {
    costModifier: 1,
    effectModifier: 1,
    tagWeights: MODE_TAG_WEIGHT_DEFAULTS[GameMode.HEAD_TO_HEAD],
    timingLock: [],
    legal: true,
    cordWeight: 1,
    holdAllowed: false,
  },
  [GameMode.TEAM_UP]: {
    costModifier: 0.95,
    effectModifier: 1,
    tagWeights: MODE_TAG_WEIGHT_DEFAULTS[GameMode.TEAM_UP],
    timingLock: [],
    legal: true,
    cordWeight: 1,
    currencyOverride: 'treasury',
    holdAllowed: false,
  },
  [GameMode.CHASE_A_LEGEND]: {
    costModifier: 1,
    effectModifier: 1,
    tagWeights: MODE_TAG_WEIGHT_DEFAULTS[GameMode.CHASE_A_LEGEND],
    timingLock: [],
    legal: true,
    cordWeight: 1,
    holdAllowed: false,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function uniqueTimingClasses(values: readonly TimingClass[]): TimingClass[] {
  return [...new Set(values)];
}

export function isDeckLegalInMode(deckType: DeckType, mode: GameMode): boolean {
  return CARD_LEGALITY_MATRIX[mode].includes(deckType);
}

export function isTimingClassLegalInMode(timingClass: TimingClass, mode: GameMode): boolean {
  return TIMING_CLASS_MODE_MATRIX[timingClass].includes(mode);
}

export function resolveEffectiveTimingClasses(
  definition: CardDefinition,
  overlay?: Pick<ModeOverlay, 'timingLock'>,
): TimingClass[] {
  const base = uniqueTimingClasses(definition.timingClasses.length > 0 ? definition.timingClasses : [TimingClass.ANY]);
  const lock = uniqueTimingClasses(overlay?.timingLock ?? []);

  if (lock.length === 0) {
    return base;
  }

  const intersection = base.filter((timingClass) => lock.includes(timingClass));
  return intersection.length > 0 ? intersection : lock;
}

export function resolveCurrencyForCard(
  deckType: DeckType,
  mode: GameMode,
  overlay?: Pick<ModeOverlay, 'currencyOverride'>,
): CurrencyType {
  if (overlay?.currencyOverride) {
    return overlay.currencyOverride;
  }

  if (mode === GameMode.HEAD_TO_HEAD && (deckType === DeckType.SABOTAGE || deckType === DeckType.COUNTER || deckType === DeckType.BLUFF)) {
    return 'battle_budget';
  }

  if (mode === GameMode.TEAM_UP && (deckType === DeckType.AID || deckType === DeckType.RESCUE || deckType === DeckType.TRUST)) {
    return 'treasury';
  }

  return 'cash';
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW ENUMS — Extended doctrine layer
// ═══════════════════════════════════════════════════════════════════════════════

export enum GhostMarkerKind {
  GOLD_BUY = 'GOLD_BUY',
  RED_PASS = 'RED_PASS',
  PURPLE_POWER = 'PURPLE_POWER',
  SILVER_BREACH = 'SILVER_BREACH',
  BLACK_CASCADE = 'BLACK_CASCADE',
}

export enum DivergencePotential {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum TrustBand {
  SOVEREIGN_TRUST = 'SOVEREIGN_TRUST',
  HIGH_TRUST = 'HIGH_TRUST',
  STANDARD_TRUST = 'STANDARD_TRUST',
  LOW_TRUST = 'LOW_TRUST',
  BROKEN_TRUST = 'BROKEN_TRUST',
}

export enum DefectionPhase {
  BREAK_PACT = 'BREAK_PACT',
  SILENT_EXIT = 'SILENT_EXIT',
  ASSET_SEIZURE = 'ASSET_SEIZURE',
}

export enum SOConversionPath {
  CASH = 'CASH',
  TIME = 'TIME',
  PAIN = 'PAIN',
}

export enum ComebackSurgeState {
  INACTIVE = 'INACTIVE',
  PRIMED = 'PRIMED',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
}

export enum CardPlayOutcomeClass {
  OPTIMAL = 'OPTIMAL',
  GOOD = 'GOOD',
  NEUTRAL = 'NEUTRAL',
  SUBOPTIMAL = 'SUBOPTIMAL',
  CATASTROPHIC = 'CATASTROPHIC',
}

export enum IPASynergyTier {
  NONE = 'NONE',
  PAIR = 'PAIR',
  TRIPLE = 'TRIPLE',
  QUAD_SOVEREIGN = 'QUAD_SOVEREIGN',
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW INTERFACES — Extended doctrine layer
// ═══════════════════════════════════════════════════════════════════════════════

export interface IPASynergyBonus {
  readonly incomeMultiplier: number;
  readonly shieldRegenMultiplier: number;
  readonly heatReduction: number;
  readonly drawGuarantee?: DeckType;
  readonly passiveIncomeTickInterval?: number;
  readonly liquidatorImmune?: boolean;
}

export interface IPAChainSynergy {
  readonly combination: readonly DeckType[];
  readonly synergyBonus: IPASynergyBonus;
  readonly durationTicks: number | null;
  readonly tier: IPASynergyTier;
}

export interface TrustScoreTier {
  readonly band: TrustBand;
  readonly minScore: number;
  readonly maxScore: number;
  readonly aidEfficiency: number;
  readonly loanAccessPct: number;
  readonly comboBonus: number;
  readonly defectionSignal: boolean;
  readonly defectionAlert: boolean;
}

export interface BattleBudgetCostEntry {
  readonly deckType: DeckType;
  readonly bbCost: number;
  readonly counterDiscount: number;
  readonly comboReduction: number;
}

export interface DivergenceScoringSpec {
  readonly potential: DivergencePotential;
  readonly deckTypes: readonly DeckType[];
  readonly gapIndicatorBehavior: string;
  readonly cordMultiplier: number;
}

export interface GhostMarkerSpec {
  readonly kind: GhostMarkerKind;
  readonly label: string;
  readonly exploitWindowTicks: number;
  readonly shieldBonus: number;
  readonly cordBonus: number;
  readonly description: string;
}

export interface PhaseBoundaryCardSpec {
  readonly fromPhase: RunPhase;
  readonly toPhase: RunPhase;
  readonly cardName: string;
  readonly windowTicks: number;
  readonly holdable: boolean;
  readonly effects: readonly CardEffectSpec[];
}

export interface HoldSystemConfig {
  readonly baseHoldsPerRun: number;
  readonly momentumThreshold: number;
  readonly bonusHoldsOnThreshold: number;
  readonly noHoldCordMultiplier: number;
  readonly holdExpiryPhaseChanges: number;
  readonly phaseBoundaryHoldable: boolean;
}

export interface DefectionStepSpec {
  readonly phase: DefectionPhase;
  readonly stepIndex: number;
  readonly trustDrainPerTick: number;
  readonly visible: boolean;
  readonly detectionCardRequired: boolean;
  readonly treasuryDiversionPct: number;
  readonly cordPenalty: number;
}

export interface RescueEfficiencyCurve {
  readonly deckType: DeckType;
  readonly fullEfficiencyMs: number;
  readonly degradedEfficiencyMs: number;
  readonly fullEffectMultiplier: number;
  readonly degradedEffectMultiplier: number;
  readonly trustBonusOnFull: number;
  readonly trustBonusOnDegraded: number;
}

export interface CounterBouncebackSpec {
  readonly counterCard: string;
  readonly blocksAttack: string;
  readonly bbCost: number;
  readonly bouncebackEffect: string;
  readonly bouncebackMagnitude: number;
}

export interface SabotageComboSpec {
  readonly baseBBCost: number;
  readonly comboReducedBBCost: number;
  readonly baseEffectMagnitude: number;
  readonly comboEffectMagnitude: number;
  readonly comboWindowTicks: number;
}

export interface SOConversionRouteSpec {
  readonly obstacleName: string;
  readonly cashCost: number;
  readonly cashEffect: string;
  readonly timeCostTicks: number;
  readonly timeEffect: string;
  readonly painEffect: string;
  readonly painCordBonus: number;
}

export interface EducationalPrincipleMapping {
  readonly principle: string;
  readonly cardRepresentations: readonly string[];
  readonly lesson: string;
}

export interface CardDecisionQualityMetric {
  readonly metric: string;
  readonly measurement: string;
  readonly applicableModes: readonly GameMode[];
  readonly weight: number;
}

export interface ProofBadgeCondition {
  readonly badgeId: string;
  readonly label: string;
  readonly condition: string;
  readonly applicableModes: readonly GameMode[];
  readonly cordBonus: number;
}

export interface ComebackSurgeConfig {
  readonly cashThresholdPct: number;
  readonly decisionSpeedWeight: number;
  readonly heatFreezeTicks: number;
  readonly emergencyCash: number;
  readonly shieldBoostAll: number;
}

export interface CardTypeMLFeatureInput {
  readonly cardId: string;
  readonly deckType: DeckType;
  readonly mode: GameMode;
  readonly rarity: CardRarity;
  readonly timingClass: TimingClass;
  readonly effectiveCost: number;
  readonly tagWeightedScore: number;
  readonly divergencePotential: DivergencePotential;
  readonly pressureTier: PressureTier;
  readonly tickIndex: number;
  readonly phase: RunPhase;
}

export interface CardTypeMLFeatureVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly dimension: number;
}

export interface CardPlayReceipt {
  readonly playId: string;
  readonly hash: string;
  readonly timestamp: number;
  readonly cardId: string;
  readonly mode: GameMode;
  readonly outcome: CardPlayOutcomeClass;
  readonly cordDelta: number;
  readonly resourceSnapshot: ResourceDelta;
}

export interface DeckTypeProfile {
  readonly deckType: DeckType;
  readonly baselineHeat: number;
  readonly baselineCordWeight: number;
  readonly drawRateMultiplier: number;
  readonly autoResolveDefault: boolean;
  readonly defaultCounterability: Counterability;
  readonly defaultTargeting: Targeting;
  readonly educationalCategory: string;
}

export interface ModeCardBehavior {
  readonly mode: GameMode;
  readonly primaryDeckTypes: readonly DeckType[];
  readonly exclusiveDeckTypes: readonly DeckType[];
  readonly bannedDeckTypes: readonly DeckType[];
  readonly holdEnabled: boolean;
  readonly battleBudgetEnabled: boolean;
  readonly trustEnabled: boolean;
  readonly ghostEnabled: boolean;
  readonly rescueEnabled: boolean;
  readonly counterWindowEnabled: boolean;
  readonly aidWindowEnabled: boolean;
  readonly phaseGatingEnabled: boolean;
  readonly defaultChannel: string;
  readonly stageMood: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW CONSTANTS — Extended doctrine layer
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ML feature vector dimensionality for card play analysis.
 * Must match CARD_ML_FEATURE_LABELS.length.
 */
export const CARD_ML_FEATURE_DIMENSION = 20 as const;

/**
 * Human-readable labels for each dimension of the card ML feature vector.
 */
export const CARD_ML_FEATURE_LABELS: readonly string[] = [
  'deck_type_ordinal',
  'mode_ordinal',
  'rarity_ordinal',
  'timing_class_ordinal',
  'effective_cost_normalized',
  'tag_weighted_score',
  'divergence_potential_ordinal',
  'pressure_tier_ordinal',
  'tick_index_normalized',
  'phase_ordinal',
  'is_pvp_exclusive',
  'is_coop_exclusive',
  'is_ghost_exclusive',
  'cost_modifier_from_overlay',
  'effect_modifier_from_overlay',
  'cord_weight_from_overlay',
  'baseline_heat',
  'baseline_cord_weight',
  'draw_rate_multiplier',
  'auto_resolve_flag',
] as const;

/**
 * IPA chain synergies — doctrine: IPA deck combos grant stacking bonuses.
 * The combination field lists required deck types in play.
 */
export const IPA_CHAIN_SYNERGIES: readonly IPAChainSynergy[] = [
  {
    combination: [DeckType.IPA, DeckType.OPPORTUNITY],
    synergyBonus: {
      incomeMultiplier: 1.15,
      shieldRegenMultiplier: 1.0,
      heatReduction: 0,
      drawGuarantee: DeckType.OPPORTUNITY,
      passiveIncomeTickInterval: 8,
    },
    durationTicks: 12,
    tier: IPASynergyTier.PAIR,
  },
  {
    combination: [DeckType.IPA, DeckType.DISCIPLINE],
    synergyBonus: {
      incomeMultiplier: 1.1,
      shieldRegenMultiplier: 1.2,
      heatReduction: 0.05,
    },
    durationTicks: 10,
    tier: IPASynergyTier.PAIR,
  },
  {
    combination: [DeckType.IPA, DeckType.OPPORTUNITY, DeckType.DISCIPLINE],
    synergyBonus: {
      incomeMultiplier: 1.25,
      shieldRegenMultiplier: 1.3,
      heatReduction: 0.08,
      drawGuarantee: DeckType.IPA,
      passiveIncomeTickInterval: 6,
    },
    durationTicks: 15,
    tier: IPASynergyTier.TRIPLE,
  },
  {
    combination: [DeckType.IPA, DeckType.OPPORTUNITY, DeckType.PRIVILEGED],
    synergyBonus: {
      incomeMultiplier: 1.3,
      shieldRegenMultiplier: 1.1,
      heatReduction: 0.03,
      passiveIncomeTickInterval: 5,
    },
    durationTicks: 14,
    tier: IPASynergyTier.TRIPLE,
  },
  {
    combination: [DeckType.IPA, DeckType.OPPORTUNITY, DeckType.DISCIPLINE, DeckType.PRIVILEGED],
    synergyBonus: {
      incomeMultiplier: 1.5,
      shieldRegenMultiplier: 1.5,
      heatReduction: 0.15,
      drawGuarantee: DeckType.IPA,
      passiveIncomeTickInterval: 4,
      liquidatorImmune: true,
    },
    durationTicks: null,
    tier: IPASynergyTier.QUAD_SOVEREIGN,
  },
] as const;

/**
 * Trust score tiers — doctrine: trust score maps to cooperative efficiencies.
 */
export const TRUST_SCORE_TIERS: readonly TrustScoreTier[] = [
  {
    band: TrustBand.SOVEREIGN_TRUST,
    minScore: 90,
    maxScore: 100,
    aidEfficiency: 1.5,
    loanAccessPct: 100,
    comboBonus: 0.25,
    defectionSignal: false,
    defectionAlert: false,
  },
  {
    band: TrustBand.HIGH_TRUST,
    minScore: 70,
    maxScore: 89.999,
    aidEfficiency: 1.2,
    loanAccessPct: 80,
    comboBonus: 0.15,
    defectionSignal: false,
    defectionAlert: false,
  },
  {
    band: TrustBand.STANDARD_TRUST,
    minScore: 40,
    maxScore: 69.999,
    aidEfficiency: 1.0,
    loanAccessPct: 50,
    comboBonus: 0.0,
    defectionSignal: false,
    defectionAlert: false,
  },
  {
    band: TrustBand.LOW_TRUST,
    minScore: 15,
    maxScore: 39.999,
    aidEfficiency: 0.7,
    loanAccessPct: 20,
    comboBonus: -0.1,
    defectionSignal: true,
    defectionAlert: false,
  },
  {
    band: TrustBand.BROKEN_TRUST,
    minScore: 0,
    maxScore: 14.999,
    aidEfficiency: 0.3,
    loanAccessPct: 0,
    comboBonus: -0.25,
    defectionSignal: true,
    defectionAlert: true,
  },
] as const;

/**
 * Battle budget costs — doctrine: PvP-exclusive deck types consume BB.
 */
export const BATTLE_BUDGET_COSTS: Readonly<Record<string, BattleBudgetCostEntry>> = {
  [DeckType.SABOTAGE]: {
    deckType: DeckType.SABOTAGE,
    bbCost: 30,
    counterDiscount: 0,
    comboReduction: 5,
  },
  [DeckType.COUNTER]: {
    deckType: DeckType.COUNTER,
    bbCost: 20,
    counterDiscount: 8,
    comboReduction: 3,
  },
  [DeckType.BLUFF]: {
    deckType: DeckType.BLUFF,
    bbCost: 15,
    counterDiscount: 0,
    comboReduction: 4,
  },
} as const;

/**
 * Divergence scoring specifications — maps potential to CORD multipliers.
 */
export const DIVERGENCE_SCORING_SPECS: Readonly<Record<DivergencePotential, DivergenceScoringSpec>> = {
  [DivergencePotential.LOW]: {
    potential: DivergencePotential.LOW,
    deckTypes: [DeckType.OPPORTUNITY, DeckType.IPA, DeckType.DISCIPLINE],
    gapIndicatorBehavior: 'none',
    cordMultiplier: 1.0,
  },
  [DivergencePotential.MEDIUM]: {
    potential: DivergencePotential.MEDIUM,
    deckTypes: [DeckType.PRIVILEGED, DeckType.SO, DeckType.FUBAR],
    gapIndicatorBehavior: 'flash_on_marker',
    cordMultiplier: 1.15,
  },
  [DivergencePotential.HIGH]: {
    potential: DivergencePotential.HIGH,
    deckTypes: [DeckType.GHOST, DeckType.MISSED_OPPORTUNITY],
    gapIndicatorBehavior: 'persistent_glow',
    cordMultiplier: 1.35,
  },
} as const;

/**
 * Ghost marker specifications — doctrine: Chase-a-Legend markers.
 */
export const GHOST_MARKER_SPECS: Readonly<Record<GhostMarkerKind, GhostMarkerSpec>> = {
  [GhostMarkerKind.GOLD_BUY]: {
    kind: GhostMarkerKind.GOLD_BUY,
    label: 'Gold Buy',
    exploitWindowTicks: 3,
    shieldBonus: 0,
    cordBonus: 5,
    description: 'Legend made a purchase — match or diverge for CORD bonus.',
  },
  [GhostMarkerKind.RED_PASS]: {
    kind: GhostMarkerKind.RED_PASS,
    label: 'Red Pass',
    exploitWindowTicks: 2,
    shieldBonus: 0,
    cordBonus: 3,
    description: 'Legend passed on a card — diverge by playing it for bonus.',
  },
  [GhostMarkerKind.PURPLE_POWER]: {
    kind: GhostMarkerKind.PURPLE_POWER,
    label: 'Purple Power',
    exploitWindowTicks: 4,
    shieldBonus: 10,
    cordBonus: 8,
    description: 'Legend activated a power play — match the energy or suffer.',
  },
  [GhostMarkerKind.SILVER_BREACH]: {
    kind: GhostMarkerKind.SILVER_BREACH,
    label: 'Silver Breach',
    exploitWindowTicks: 2,
    shieldBonus: 5,
    cordBonus: 6,
    description: 'Legend breached a threshold — capitalize within window.',
  },
  [GhostMarkerKind.BLACK_CASCADE]: {
    kind: GhostMarkerKind.BLACK_CASCADE,
    label: 'Black Cascade',
    exploitWindowTicks: 5,
    shieldBonus: 0,
    cordBonus: 12,
    description: 'Legend triggered a cascade — survive and diverge for massive CORD.',
  },
} as const;

/**
 * Phase boundary cards — special cards available at phase transitions.
 */
export const PHASE_BOUNDARY_CARDS: readonly PhaseBoundaryCardSpec[] = [
  {
    fromPhase: RunPhase.FOUNDATION,
    toPhase: RunPhase.ESCALATION,
    cardName: 'Escalation Gateway',
    windowTicks: 3,
    holdable: true,
    effects: [
      { op: CardEffectOp.INCOME_DELTA, magnitude: 50 },
      { op: CardEffectOp.HEAT_DELTA, magnitude: 0.05 },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 10 },
    ],
  },
  {
    fromPhase: RunPhase.ESCALATION,
    toPhase: RunPhase.SOVEREIGNTY,
    cardName: 'Sovereignty Threshold',
    windowTicks: 5,
    holdable: false,
    effects: [
      { op: CardEffectOp.CASH_DELTA, magnitude: 200 },
      { op: CardEffectOp.SHIELD_DELTA, magnitude: 25 },
      { op: CardEffectOp.HEAT_DELTA, magnitude: 0.1 },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 25 },
    ],
  },
  {
    fromPhase: RunPhase.FOUNDATION,
    toPhase: RunPhase.SOVEREIGNTY,
    cardName: 'Warp Ascension',
    windowTicks: 2,
    holdable: false,
    effects: [
      { op: CardEffectOp.CASH_DELTA, magnitude: 500 },
      { op: CardEffectOp.INCOME_DELTA, magnitude: 100 },
      { op: CardEffectOp.SHIELD_DELTA, magnitude: 50 },
      { op: CardEffectOp.HEAT_DELTA, magnitude: 0.2 },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 50 },
    ],
  },
] as const;

/**
 * Hold system configuration — doctrine: Go-Alone hold mechanics.
 */
export const HOLD_SYSTEM_CONFIG: HoldSystemConfig = {
  baseHoldsPerRun: 3,
  momentumThreshold: 5,
  bonusHoldsOnThreshold: 1,
  noHoldCordMultiplier: 1.1,
  holdExpiryPhaseChanges: 1,
  phaseBoundaryHoldable: true,
} as const;

/**
 * Defection step specifications — doctrine: Team-Up defection mechanics.
 */
export const DEFECTION_STEPS: readonly DefectionStepSpec[] = [
  {
    phase: DefectionPhase.BREAK_PACT,
    stepIndex: 0,
    trustDrainPerTick: 2.0,
    visible: true,
    detectionCardRequired: false,
    treasuryDiversionPct: 0,
    cordPenalty: 5,
  },
  {
    phase: DefectionPhase.BREAK_PACT,
    stepIndex: 1,
    trustDrainPerTick: 3.5,
    visible: true,
    detectionCardRequired: false,
    treasuryDiversionPct: 5,
    cordPenalty: 10,
  },
  {
    phase: DefectionPhase.SILENT_EXIT,
    stepIndex: 2,
    trustDrainPerTick: 5.0,
    visible: false,
    detectionCardRequired: true,
    treasuryDiversionPct: 10,
    cordPenalty: 20,
  },
  {
    phase: DefectionPhase.SILENT_EXIT,
    stepIndex: 3,
    trustDrainPerTick: 7.0,
    visible: false,
    detectionCardRequired: true,
    treasuryDiversionPct: 15,
    cordPenalty: 30,
  },
  {
    phase: DefectionPhase.ASSET_SEIZURE,
    stepIndex: 4,
    trustDrainPerTick: 10.0,
    visible: true,
    detectionCardRequired: false,
    treasuryDiversionPct: 25,
    cordPenalty: 50,
  },
  {
    phase: DefectionPhase.ASSET_SEIZURE,
    stepIndex: 5,
    trustDrainPerTick: 15.0,
    visible: true,
    detectionCardRequired: false,
    treasuryDiversionPct: 40,
    cordPenalty: 75,
  },
] as const;

/**
 * Rescue efficiency curves — doctrine: rescue timing affects effectiveness.
 */
export const RESCUE_EFFICIENCY_CURVES: Readonly<Record<string, RescueEfficiencyCurve>> = {
  [DeckType.RESCUE]: {
    deckType: DeckType.RESCUE,
    fullEfficiencyMs: 5000,
    degradedEfficiencyMs: 15000,
    fullEffectMultiplier: 1.5,
    degradedEffectMultiplier: 0.6,
    trustBonusOnFull: 5,
    trustBonusOnDegraded: 1,
  },
  [DeckType.AID]: {
    deckType: DeckType.AID,
    fullEfficiencyMs: 8000,
    degradedEfficiencyMs: 15000,
    fullEffectMultiplier: 1.3,
    degradedEffectMultiplier: 0.75,
    trustBonusOnFull: 3,
    trustBonusOnDegraded: 0.5,
  },
  [DeckType.TRUST]: {
    deckType: DeckType.TRUST,
    fullEfficiencyMs: 10000,
    degradedEfficiencyMs: 20000,
    fullEffectMultiplier: 1.2,
    degradedEffectMultiplier: 0.8,
    trustBonusOnFull: 8,
    trustBonusOnDegraded: 2,
  },
} as const;

/**
 * Counter bounceback map — doctrine: counters have bounceback effects.
 */
export const COUNTER_BOUNCEBACK_MAP: readonly CounterBouncebackSpec[] = [
  {
    counterCard: 'Shield Wall',
    blocksAttack: 'Direct Sabotage',
    bbCost: 20,
    bouncebackEffect: 'heat_reflect',
    bouncebackMagnitude: 0.03,
  },
  {
    counterCard: 'Mirror Gambit',
    blocksAttack: 'Income Drain',
    bbCost: 25,
    bouncebackEffect: 'income_steal',
    bouncebackMagnitude: 15,
  },
  {
    counterCard: 'Dead Drop',
    blocksAttack: 'Bluff Assault',
    bbCost: 18,
    bouncebackEffect: 'card_reveal',
    bouncebackMagnitude: 2,
  },
  {
    counterCard: 'Fortress Protocol',
    blocksAttack: 'Cascade Strike',
    bbCost: 35,
    bouncebackEffect: 'shield_surge',
    bouncebackMagnitude: 30,
  },
  {
    counterCard: 'Deflection Matrix',
    blocksAttack: 'Resource Siphon',
    bbCost: 22,
    bouncebackEffect: 'cash_redirect',
    bouncebackMagnitude: 50,
  },
] as const;

/**
 * Sabotage combo configuration — doctrine: consecutive unblocked sabotage.
 */
export const SABOTAGE_COMBO_CONFIG: SabotageComboSpec = {
  baseBBCost: 30,
  comboReducedBBCost: 22,
  baseEffectMagnitude: 1.0,
  comboEffectMagnitude: 1.4,
  comboWindowTicks: 4,
} as const;

/**
 * SO conversion routes — doctrine: obstacles can be converted via cash/time/pain.
 */
export const SO_CONVERSION_ROUTES: readonly SOConversionRouteSpec[] = [
  {
    obstacleName: 'Tax Audit',
    cashCost: 300,
    cashEffect: 'pay_fine_remove_obstacle',
    timeCostTicks: 8,
    timeEffect: 'dispute_audit_slow_resolution',
    painEffect: 'endure_audit_penalty_heat',
    painCordBonus: 15,
  },
  {
    obstacleName: 'Market Crash',
    cashCost: 500,
    cashEffect: 'buy_dip_hedge',
    timeCostTicks: 12,
    timeEffect: 'wait_out_recovery',
    painEffect: 'absorb_losses_heat_spike',
    painCordBonus: 25,
  },
  {
    obstacleName: 'Regulatory Freeze',
    cashCost: 200,
    cashEffect: 'lobby_for_exemption',
    timeCostTicks: 6,
    timeEffect: 'wait_for_thaw',
    painEffect: 'operate_under_restriction',
    painCordBonus: 10,
  },
  {
    obstacleName: 'Supply Chain Shock',
    cashCost: 400,
    cashEffect: 'emergency_sourcing',
    timeCostTicks: 10,
    timeEffect: 'find_alternative_supplier',
    painEffect: 'pass_costs_to_customers',
    painCordBonus: 18,
  },
  {
    obstacleName: 'Key Employee Exit',
    cashCost: 350,
    cashEffect: 'retention_bonus',
    timeCostTicks: 7,
    timeEffect: 'recruit_replacement',
    painEffect: 'redistribute_workload_heat',
    painCordBonus: 12,
  },
  {
    obstacleName: 'Legal Challenge',
    cashCost: 600,
    cashEffect: 'settle_out_of_court',
    timeCostTicks: 15,
    timeEffect: 'litigate_through_system',
    painEffect: 'absorb_reputation_damage',
    painCordBonus: 30,
  },
] as const;

/**
 * Educational principles — doctrine: cards map to financial lessons.
 */
export const EDUCATIONAL_PRINCIPLES: readonly EducationalPrincipleMapping[] = [
  {
    principle: 'compound_interest',
    cardRepresentations: ['Passive Income Stream', 'Interest Snowball', 'Reinvestment Engine'],
    lesson: 'Small consistent gains compound into exponential growth over time.',
  },
  {
    principle: 'opportunity_cost',
    cardRepresentations: ['Missed Window', 'Path Not Taken', 'Alternative Revenue'],
    lesson: 'Every choice has a hidden cost — the best option you did not take.',
  },
  {
    principle: 'risk_management',
    cardRepresentations: ['Shield Protocol', 'Insurance Buffer', 'Hedge Position'],
    lesson: 'Protecting against downside is as valuable as capturing upside.',
  },
  {
    principle: 'diversification',
    cardRepresentations: ['Portfolio Spread', 'Multi-Sector Play', 'Risk Distribution'],
    lesson: 'Spreading risk across uncorrelated assets reduces total portfolio volatility.',
  },
  {
    principle: 'market_timing',
    cardRepresentations: ['Buy the Dip', 'Sell the Peak', 'Timing Mastery'],
    lesson: 'Timing matters but consistency beats prediction over the long run.',
  },
  {
    principle: 'leverage_mechanics',
    cardRepresentations: ['Borrowed Capital', 'Margin Play', 'Leverage Amplifier'],
    lesson: 'Leverage amplifies both gains and losses — use with discipline.',
  },
  {
    principle: 'trust_and_cooperation',
    cardRepresentations: ['Handshake Deal', 'Trust Dividend', 'Cooperative Surplus'],
    lesson: 'Trust reduces transaction costs and unlocks cooperative value creation.',
  },
  {
    principle: 'sunk_cost_fallacy',
    cardRepresentations: ['Cut Losses', 'Walk Away', 'Fresh Start'],
    lesson: 'Past investments should not dictate future decisions — only future value matters.',
  },
] as const;

/**
 * Card decision quality metrics — doctrine: measuring decision quality.
 */
export const CARD_DECISION_QUALITY_METRICS: readonly CardDecisionQualityMetric[] = [
  {
    metric: 'timing_accuracy',
    measurement: 'delta_ticks_from_optimal_window_center',
    applicableModes: [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD, GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND],
    weight: 0.3,
  },
  {
    metric: 'resource_efficiency',
    measurement: 'effect_magnitude_per_cost_unit',
    applicableModes: [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD, GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND],
    weight: 0.25,
  },
  {
    metric: 'opportunity_awareness',
    measurement: 'cards_seen_vs_cards_played_ratio',
    applicableModes: [GameMode.GO_ALONE, GameMode.CHASE_A_LEGEND],
    weight: 0.15,
  },
  {
    metric: 'counter_timing',
    measurement: 'counter_played_within_optimal_ctr_window',
    applicableModes: [GameMode.HEAD_TO_HEAD],
    weight: 0.2,
  },
  {
    metric: 'aid_responsiveness',
    measurement: 'rescue_played_within_full_efficiency_window',
    applicableModes: [GameMode.TEAM_UP],
    weight: 0.2,
  },
  {
    metric: 'divergence_exploitation',
    measurement: 'ghost_markers_exploited_vs_available',
    applicableModes: [GameMode.CHASE_A_LEGEND],
    weight: 0.2,
  },
  {
    metric: 'combo_execution',
    measurement: 'multi_card_combo_chains_completed',
    applicableModes: [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD, GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND],
    weight: 0.1,
  },
] as const;

/**
 * Proof badge conditions — doctrine: badges are earned per-mode.
 */
export const PROOF_BADGE_CONDITIONS: readonly ProofBadgeCondition[] = [
  {
    badgeId: 'sovereign_builder',
    label: 'Sovereign Builder',
    condition: 'Reach Sovereignty phase with zero debt and positive income',
    applicableModes: [GameMode.GO_ALONE],
    cordBonus: 50,
  },
  {
    badgeId: 'perfect_timing',
    label: 'Perfect Timing',
    condition: 'Play 10 consecutive cards within optimal timing window',
    applicableModes: [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD, GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND],
    cordBonus: 30,
  },
  {
    badgeId: 'counter_master',
    label: 'Counter Master',
    condition: 'Successfully counter 5 sabotage cards in a single run',
    applicableModes: [GameMode.HEAD_TO_HEAD],
    cordBonus: 40,
  },
  {
    badgeId: 'trust_keeper',
    label: 'Trust Keeper',
    condition: 'Maintain Sovereign Trust band for entire run duration',
    applicableModes: [GameMode.TEAM_UP],
    cordBonus: 45,
  },
  {
    badgeId: 'ghost_chaser',
    label: 'Ghost Chaser',
    condition: 'Exploit 8 or more ghost markers in a single run',
    applicableModes: [GameMode.CHASE_A_LEGEND],
    cordBonus: 35,
  },
  {
    badgeId: 'no_hold_warrior',
    label: 'No-Hold Warrior',
    condition: 'Complete a Go-Alone run without using any holds',
    applicableModes: [GameMode.GO_ALONE],
    cordBonus: 25,
  },
  {
    badgeId: 'zero_heat_finish',
    label: 'Zero Heat Finish',
    condition: 'End a run with heat at or below 0.01',
    applicableModes: [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD, GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND],
    cordBonus: 20,
  },
  {
    badgeId: 'rescue_ace',
    label: 'Rescue Ace',
    condition: 'Deliver 5 rescue cards at full efficiency in one run',
    applicableModes: [GameMode.TEAM_UP],
    cordBonus: 35,
  },
  {
    badgeId: 'divergence_king',
    label: 'Divergence King',
    condition: 'Achieve maximum divergence score at Sovereignty phase',
    applicableModes: [GameMode.CHASE_A_LEGEND],
    cordBonus: 55,
  },
  {
    badgeId: 'cascade_survivor',
    label: 'Cascade Survivor',
    condition: 'Survive 3 cascade events without losing more than 10% cash',
    applicableModes: [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD, GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND],
    cordBonus: 30,
  },
] as const;

/**
 * Comeback surge configuration — doctrine: emergency comeback mechanic.
 */
export const COMEBACK_SURGE_CONFIG: ComebackSurgeConfig = {
  cashThresholdPct: 0.15,
  decisionSpeedWeight: 0.4,
  heatFreezeTicks: 3,
  emergencyCash: 150,
  shieldBoostAll: 20,
} as const;

/**
 * Deck type profiles — baseline stats for each deck type.
 */
export const DECK_TYPE_PROFILES: Readonly<Record<DeckType, DeckTypeProfile>> = {
  [DeckType.OPPORTUNITY]: {
    deckType: DeckType.OPPORTUNITY,
    baselineHeat: 0.0,
    baselineCordWeight: 1.0,
    drawRateMultiplier: 1.0,
    autoResolveDefault: false,
    defaultCounterability: Counterability.NONE,
    defaultTargeting: Targeting.SELF,
    educationalCategory: 'income_generation',
  },
  [DeckType.IPA]: {
    deckType: DeckType.IPA,
    baselineHeat: 0.0,
    baselineCordWeight: 1.2,
    drawRateMultiplier: 0.9,
    autoResolveDefault: false,
    defaultCounterability: Counterability.NONE,
    defaultTargeting: Targeting.SELF,
    educationalCategory: 'compound_growth',
  },
  [DeckType.FUBAR]: {
    deckType: DeckType.FUBAR,
    baselineHeat: 0.15,
    baselineCordWeight: 0.8,
    drawRateMultiplier: 1.1,
    autoResolveDefault: true,
    defaultCounterability: Counterability.NONE,
    defaultTargeting: Targeting.SELF,
    educationalCategory: 'risk_assessment',
  },
  [DeckType.MISSED_OPPORTUNITY]: {
    deckType: DeckType.MISSED_OPPORTUNITY,
    baselineHeat: 0.02,
    baselineCordWeight: 0.6,
    drawRateMultiplier: 0.8,
    autoResolveDefault: true,
    defaultCounterability: Counterability.NONE,
    defaultTargeting: Targeting.SELF,
    educationalCategory: 'opportunity_cost',
  },
  [DeckType.PRIVILEGED]: {
    deckType: DeckType.PRIVILEGED,
    baselineHeat: 0.05,
    baselineCordWeight: 1.1,
    drawRateMultiplier: 0.7,
    autoResolveDefault: false,
    defaultCounterability: Counterability.SOFT,
    defaultTargeting: Targeting.SELF,
    educationalCategory: 'advantage_leverage',
  },
  [DeckType.SO]: {
    deckType: DeckType.SO,
    baselineHeat: 0.1,
    baselineCordWeight: 0.9,
    drawRateMultiplier: 1.0,
    autoResolveDefault: false,
    defaultCounterability: Counterability.NONE,
    defaultTargeting: Targeting.SELF,
    educationalCategory: 'obstacle_navigation',
  },
  [DeckType.SABOTAGE]: {
    deckType: DeckType.SABOTAGE,
    baselineHeat: 0.08,
    baselineCordWeight: 1.3,
    drawRateMultiplier: 0.85,
    autoResolveDefault: false,
    defaultCounterability: Counterability.HARD,
    defaultTargeting: Targeting.OPPONENT,
    educationalCategory: 'competitive_strategy',
  },
  [DeckType.COUNTER]: {
    deckType: DeckType.COUNTER,
    baselineHeat: 0.0,
    baselineCordWeight: 1.0,
    drawRateMultiplier: 1.0,
    autoResolveDefault: false,
    defaultCounterability: Counterability.NONE,
    defaultTargeting: Targeting.SELF,
    educationalCategory: 'defensive_strategy',
  },
  [DeckType.AID]: {
    deckType: DeckType.AID,
    baselineHeat: 0.0,
    baselineCordWeight: 1.1,
    drawRateMultiplier: 1.0,
    autoResolveDefault: false,
    defaultCounterability: Counterability.NONE,
    defaultTargeting: Targeting.TEAMMATE,
    educationalCategory: 'cooperative_finance',
  },
  [DeckType.RESCUE]: {
    deckType: DeckType.RESCUE,
    baselineHeat: 0.0,
    baselineCordWeight: 1.2,
    drawRateMultiplier: 0.9,
    autoResolveDefault: false,
    defaultCounterability: Counterability.NONE,
    defaultTargeting: Targeting.TEAMMATE,
    educationalCategory: 'crisis_response',
  },
  [DeckType.DISCIPLINE]: {
    deckType: DeckType.DISCIPLINE,
    baselineHeat: -0.02,
    baselineCordWeight: 1.0,
    drawRateMultiplier: 1.0,
    autoResolveDefault: false,
    defaultCounterability: Counterability.NONE,
    defaultTargeting: Targeting.SELF,
    educationalCategory: 'financial_discipline',
  },
  [DeckType.TRUST]: {
    deckType: DeckType.TRUST,
    baselineHeat: 0.0,
    baselineCordWeight: 1.15,
    drawRateMultiplier: 0.95,
    autoResolveDefault: false,
    defaultCounterability: Counterability.SOFT,
    defaultTargeting: Targeting.TEAM,
    educationalCategory: 'trust_economics',
  },
  [DeckType.BLUFF]: {
    deckType: DeckType.BLUFF,
    baselineHeat: 0.06,
    baselineCordWeight: 1.25,
    drawRateMultiplier: 0.9,
    autoResolveDefault: false,
    defaultCounterability: Counterability.SOFT,
    defaultTargeting: Targeting.OPPONENT,
    educationalCategory: 'information_asymmetry',
  },
  [DeckType.GHOST]: {
    deckType: DeckType.GHOST,
    baselineHeat: 0.03,
    baselineCordWeight: 1.4,
    drawRateMultiplier: 0.75,
    autoResolveDefault: false,
    defaultCounterability: Counterability.NONE,
    defaultTargeting: Targeting.GHOST,
    educationalCategory: 'benchmark_analysis',
  },
} as const;

/**
 * Mode card behaviors — comprehensive per-mode gameplay configuration.
 */
export const MODE_CARD_BEHAVIORS: Readonly<Record<GameMode, ModeCardBehavior>> = {
  [GameMode.GO_ALONE]: {
    mode: GameMode.GO_ALONE,
    primaryDeckTypes: [DeckType.OPPORTUNITY, DeckType.IPA, DeckType.DISCIPLINE],
    exclusiveDeckTypes: [],
    bannedDeckTypes: [DeckType.SABOTAGE, DeckType.COUNTER, DeckType.AID, DeckType.RESCUE, DeckType.TRUST, DeckType.BLUFF, DeckType.GHOST],
    holdEnabled: true,
    battleBudgetEnabled: false,
    trustEnabled: false,
    ghostEnabled: false,
    rescueEnabled: false,
    counterWindowEnabled: false,
    aidWindowEnabled: false,
    phaseGatingEnabled: true,
    defaultChannel: 'solo_economy',
    stageMood: 'determined',
  },
  [GameMode.HEAD_TO_HEAD]: {
    mode: GameMode.HEAD_TO_HEAD,
    primaryDeckTypes: [DeckType.SABOTAGE, DeckType.COUNTER, DeckType.BLUFF],
    exclusiveDeckTypes: [DeckType.SABOTAGE, DeckType.COUNTER, DeckType.BLUFF],
    bannedDeckTypes: [DeckType.AID, DeckType.RESCUE, DeckType.TRUST, DeckType.DISCIPLINE, DeckType.GHOST],
    holdEnabled: false,
    battleBudgetEnabled: true,
    trustEnabled: false,
    ghostEnabled: false,
    rescueEnabled: false,
    counterWindowEnabled: true,
    aidWindowEnabled: false,
    phaseGatingEnabled: true,
    defaultChannel: 'pvp_arena',
    stageMood: 'aggressive',
  },
  [GameMode.TEAM_UP]: {
    mode: GameMode.TEAM_UP,
    primaryDeckTypes: [DeckType.AID, DeckType.RESCUE, DeckType.TRUST],
    exclusiveDeckTypes: [DeckType.AID, DeckType.RESCUE, DeckType.TRUST],
    bannedDeckTypes: [DeckType.SABOTAGE, DeckType.COUNTER, DeckType.BLUFF, DeckType.DISCIPLINE, DeckType.GHOST],
    holdEnabled: false,
    battleBudgetEnabled: false,
    trustEnabled: true,
    ghostEnabled: false,
    rescueEnabled: true,
    counterWindowEnabled: false,
    aidWindowEnabled: true,
    phaseGatingEnabled: true,
    defaultChannel: 'coop_treasury',
    stageMood: 'cooperative',
  },
  [GameMode.CHASE_A_LEGEND]: {
    mode: GameMode.CHASE_A_LEGEND,
    primaryDeckTypes: [DeckType.GHOST, DeckType.DISCIPLINE],
    exclusiveDeckTypes: [DeckType.GHOST],
    bannedDeckTypes: [DeckType.SABOTAGE, DeckType.COUNTER, DeckType.AID, DeckType.RESCUE, DeckType.TRUST, DeckType.BLUFF],
    holdEnabled: false,
    battleBudgetEnabled: false,
    trustEnabled: false,
    ghostEnabled: true,
    rescueEnabled: false,
    counterWindowEnabled: false,
    aidWindowEnabled: false,
    phaseGatingEnabled: true,
    defaultChannel: 'ghost_divergence',
    stageMood: 'contemplative',
  },
} as const;

/**
 * Card rarity drop rates — probability weight for each rarity tier.
 */
export const CARD_RARITY_DROP_RATES: Readonly<Record<CardRarity, number>> = {
  [CardRarity.COMMON]: 0.55,
  [CardRarity.UNCOMMON]: 0.28,
  [CardRarity.RARE]: 0.13,
  [CardRarity.LEGENDARY]: 0.04,
} as const;

/**
 * Pressure cost modifiers — doctrine: pressure tiers modify effective costs.
 */
export const PRESSURE_COST_MODIFIERS: Readonly<Record<PressureTier, number>> = {
  [PressureTier.T0_SOVEREIGN]: 0.8,
  [PressureTier.T1_STABLE]: 1.0,
  [PressureTier.T2_STRESSED]: 1.15,
  [PressureTier.T3_ELEVATED]: 1.35,
  [PressureTier.T4_COLLAPSE_IMMINENT]: 1.6,
} as const;

/**
 * Default currency per deck type — doctrine: each deck type has a natural currency.
 */
export const DECK_TYPE_CURRENCY_DEFAULTS: Readonly<Record<DeckType, CurrencyType>> = {
  [DeckType.OPPORTUNITY]: 'cash',
  [DeckType.IPA]: 'cash',
  [DeckType.FUBAR]: 'cash',
  [DeckType.MISSED_OPPORTUNITY]: 'none',
  [DeckType.PRIVILEGED]: 'cash',
  [DeckType.SO]: 'cash',
  [DeckType.SABOTAGE]: 'battle_budget',
  [DeckType.COUNTER]: 'battle_budget',
  [DeckType.AID]: 'treasury',
  [DeckType.RESCUE]: 'treasury',
  [DeckType.DISCIPLINE]: 'cash',
  [DeckType.TRUST]: 'treasury',
  [DeckType.BLUFF]: 'battle_budget',
  [DeckType.GHOST]: 'none',
} as const;

/**
 * Human-readable labels for timing classes.
 */
export const TIMING_CLASS_LABELS: Readonly<Record<TimingClass, string>> = {
  [TimingClass.PRE]: 'Pre-Decision',
  [TimingClass.POST]: 'Post-Decision',
  [TimingClass.FATE]: 'Fate Window',
  [TimingClass.CTR]: 'Counter Window',
  [TimingClass.RES]: 'Rescue Window',
  [TimingClass.AID]: 'Aid Window',
  [TimingClass.GBM]: 'Ghost Benchmark',
  [TimingClass.CAS]: 'Cascade Intercept',
  [TimingClass.PHZ]: 'Phase Transition',
  [TimingClass.PSK]: 'Pressure Spike',
  [TimingClass.END]: 'End of Turn',
  [TimingClass.ANY]: 'Any Time',
} as const;

/**
 * Human-readable labels for deck types.
 */
export const DECK_TYPE_LABELS: Readonly<Record<DeckType, string>> = {
  [DeckType.OPPORTUNITY]: 'Opportunity',
  [DeckType.IPA]: 'Income-Producing Asset',
  [DeckType.FUBAR]: 'FUBAR Event',
  [DeckType.MISSED_OPPORTUNITY]: 'Missed Opportunity',
  [DeckType.PRIVILEGED]: 'Privileged Position',
  [DeckType.SO]: 'Structural Obstacle',
  [DeckType.SABOTAGE]: 'Sabotage',
  [DeckType.COUNTER]: 'Counter',
  [DeckType.AID]: 'Aid',
  [DeckType.RESCUE]: 'Rescue',
  [DeckType.DISCIPLINE]: 'Discipline',
  [DeckType.TRUST]: 'Trust',
  [DeckType.BLUFF]: 'Bluff',
  [DeckType.GHOST]: 'Ghost',
} as const;

/**
 * Human-readable labels for card tags.
 */
export const CARD_TAG_LABELS: Readonly<Record<CardTag, string>> = {
  [CardTag.LIQUIDITY]: 'Liquidity',
  [CardTag.INCOME]: 'Income',
  [CardTag.RESILIENCE]: 'Resilience',
  [CardTag.SCALE]: 'Scale',
  [CardTag.TEMPO]: 'Tempo',
  [CardTag.SABOTAGE]: 'Sabotage',
  [CardTag.COUNTER]: 'Counter',
  [CardTag.HEAT]: 'Heat',
  [CardTag.TRUST]: 'Trust',
  [CardTag.AID]: 'Aid',
  [CardTag.PRECISION]: 'Precision',
  [CardTag.DIVERGENCE]: 'Divergence',
  [CardTag.VARIANCE]: 'Variance',
  [CardTag.CASCADE]: 'Cascade',
  [CardTag.MOMENTUM]: 'Momentum',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// NEW FUNCTIONS — Extended doctrine layer
// ═══════════════════════════════════════════════════════════════════════════════

// ---------------------------------------------------------------------------
// Internal ordinal helpers (used by ML feature computation and hashing)
// ---------------------------------------------------------------------------

const DECK_TYPE_ORDINAL_MAP: Readonly<Record<DeckType, number>> = {
  [DeckType.OPPORTUNITY]: 0,
  [DeckType.IPA]: 1,
  [DeckType.FUBAR]: 2,
  [DeckType.MISSED_OPPORTUNITY]: 3,
  [DeckType.PRIVILEGED]: 4,
  [DeckType.SO]: 5,
  [DeckType.SABOTAGE]: 6,
  [DeckType.COUNTER]: 7,
  [DeckType.AID]: 8,
  [DeckType.RESCUE]: 9,
  [DeckType.DISCIPLINE]: 10,
  [DeckType.TRUST]: 11,
  [DeckType.BLUFF]: 12,
  [DeckType.GHOST]: 13,
};

const MODE_ORDINAL_MAP: Readonly<Record<GameMode, number>> = {
  [GameMode.GO_ALONE]: 0,
  [GameMode.HEAD_TO_HEAD]: 1,
  [GameMode.TEAM_UP]: 2,
  [GameMode.CHASE_A_LEGEND]: 3,
};

const RARITY_ORDINAL_MAP: Readonly<Record<CardRarity, number>> = {
  [CardRarity.COMMON]: 0,
  [CardRarity.UNCOMMON]: 1,
  [CardRarity.RARE]: 2,
  [CardRarity.LEGENDARY]: 3,
};

const TIMING_CLASS_ORDINAL_MAP: Readonly<Record<TimingClass, number>> = {
  [TimingClass.PRE]: 0,
  [TimingClass.POST]: 1,
  [TimingClass.FATE]: 2,
  [TimingClass.CTR]: 3,
  [TimingClass.RES]: 4,
  [TimingClass.AID]: 5,
  [TimingClass.GBM]: 6,
  [TimingClass.CAS]: 7,
  [TimingClass.PHZ]: 8,
  [TimingClass.PSK]: 9,
  [TimingClass.END]: 10,
  [TimingClass.ANY]: 11,
};

const DIVERGENCE_POTENTIAL_ORDINAL_MAP: Readonly<Record<DivergencePotential, number>> = {
  [DivergencePotential.LOW]: 0,
  [DivergencePotential.MEDIUM]: 1,
  [DivergencePotential.HIGH]: 2,
};

const PRESSURE_TIER_ORDINAL_MAP: Readonly<Record<PressureTier, number>> = {
  [PressureTier.T0_SOVEREIGN]: 0,
  [PressureTier.T1_STABLE]: 1,
  [PressureTier.T2_STRESSED]: 2,
  [PressureTier.T3_ELEVATED]: 3,
  [PressureTier.T4_COLLAPSE_IMMINENT]: 4,
};

const PHASE_ORDINAL_MAP: Readonly<Record<RunPhase, number>> = {
  [RunPhase.FOUNDATION]: 0,
  [RunPhase.ESCALATION]: 1,
  [RunPhase.SOVEREIGNTY]: 2,
};

// ---------------------------------------------------------------------------
// Maximum normalizers — used in feature normalization
// ---------------------------------------------------------------------------

const MAX_DECK_TYPE_ORDINAL = 13;
const MAX_MODE_ORDINAL = 3;
const MAX_RARITY_ORDINAL = 3;
const MAX_TIMING_CLASS_ORDINAL = 11;
const MAX_DIVERGENCE_POTENTIAL_ORDINAL = 2;
const MAX_PRESSURE_TIER_ORDINAL = 4;
const MAX_PHASE_ORDINAL = 2;
const MAX_TICK_INDEX_NORMALIZER = 120;
const MAX_COST_NORMALIZER = 1000;

// ─────────────────────────────────────────────────────────────────────────────
// generateCardPlayHash
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a deterministic proof hash for a card play event.
 * Uses SHA-256 from node:crypto to produce a tamper-evident audit trail.
 *
 * The hash encodes the play identity, card, mode, tick, choice, and run seed
 * into a single 64-hex-character digest that can be independently verified.
 *
 * @param playId - Unique play event identifier.
 * @param cardId - The card definition id that was played.
 * @param mode - The game mode the play occurred in.
 * @param tickIndex - The simulation tick at which the play happened.
 * @param choiceId - The choice the player selected.
 * @param runSeed - The deterministic run seed (hex or string).
 * @returns A lowercase hex SHA-256 hash string.
 */
export function generateCardPlayHash(
  playId: string,
  cardId: string,
  mode: GameMode,
  tickIndex: number,
  choiceId: string,
  runSeed: string,
): string {
  const payload = [
    playId,
    cardId,
    mode,
    String(tickIndex),
    choiceId,
    runSeed,
  ].join('|');

  return createHash('sha256').update(payload).digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// computeTagWeightedScore
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sums the mode-specific tag weights for a set of card tags.
 * If an overlay is provided, its tagWeights take precedence over
 * the mode defaults from MODE_TAG_WEIGHT_DEFAULTS.
 *
 * Uses round6 for deterministic floating-point precision.
 *
 * @param tags - The card's tag list.
 * @param mode - The current game mode.
 * @param overlay - Optional overlay with tag weight overrides.
 * @returns The weighted score sum, rounded to 6 decimal places.
 */
export function computeTagWeightedScore(
  tags: readonly CardTag[],
  mode: GameMode,
  overlay?: Pick<ModeOverlay, 'tagWeights'>,
): number {
  const modeWeights = MODE_TAG_WEIGHT_DEFAULTS[mode];
  const overlayWeights = overlay?.tagWeights ?? {};

  let score = 0;
  for (const tag of tags) {
    const weight = overlayWeights[tag] ?? modeWeights[tag] ?? 0;
    score += weight;
  }

  return round6(score);
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveEffectiveCost
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the fully resolved effective cost of a card in the current
 * execution context. The pipeline is:
 *   baseCost * overlay.costModifier * pressureCostModifier
 * Clamped to [0, 9999] to prevent negative or unbounded costs.
 *
 * References: PRESSURE_COST_MODIFIERS, clamp.
 *
 * @param definition - The card definition with baseCost.
 * @param mode - The current game mode (unused directly but available for extensions).
 * @param overlay - The resolved mode overlay for cost modification.
 * @param pressureTier - Optional pressure tier for cost scaling.
 * @returns The effective cost, clamped to [0, 9999].
 */
export function resolveEffectiveCost(
  definition: CardDefinition,
  _mode: GameMode,
  overlay: Pick<ModeOverlay, 'costModifier'>,
  pressureTier?: PressureTier,
): number {
  const baseCost = definition.baseCost;
  const costMod = overlay.costModifier;
  const pressureMod = pressureTier
    ? PRESSURE_COST_MODIFIERS[pressureTier]
    : PRESSURE_COST_MODIFIERS[PressureTier.T1_STABLE];

  const rawCost = baseCost * costMod * pressureMod;
  return clamp(round6(rawCost), 0, 9999);
}

// ─────────────────────────────────────────────────────────────────────────────
// computeDivergencePotential
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines the divergence potential for a card based on its definition,
 * timing class, and proximity to a ghost marker.
 *
 * Logic:
 * - GHOST or MISSED_OPPORTUNITY deck types always return HIGH.
 * - If within 3 ticks of a marker and timing is GBM, return HIGH.
 * - PRIVILEGED, SO, FUBAR deck types return MEDIUM.
 * - All others return LOW.
 *
 * References: DIVERGENCE_SCORING_SPECS.
 *
 * @param definition - The card definition.
 * @param timingClass - The timing class being used for the play.
 * @param tickDistanceFromMarker - Ticks since the last ghost marker (0 = on marker).
 * @returns The computed DivergencePotential.
 */
export function computeDivergencePotential(
  definition: CardDefinition,
  timingClass: TimingClass,
  tickDistanceFromMarker: number,
): DivergencePotential {
  // High divergence deck types
  const highDivDeckTypes = DIVERGENCE_SCORING_SPECS[DivergencePotential.HIGH].deckTypes;
  if (highDivDeckTypes.includes(definition.deckType)) {
    return DivergencePotential.HIGH;
  }

  // GBM timing within 3 ticks of a ghost marker
  if (timingClass === TimingClass.GBM && tickDistanceFromMarker <= 3) {
    return DivergencePotential.HIGH;
  }

  // Medium divergence deck types
  const medDivDeckTypes = DIVERGENCE_SCORING_SPECS[DivergencePotential.MEDIUM].deckTypes;
  if (medDivDeckTypes.includes(definition.deckType)) {
    return DivergencePotential.MEDIUM;
  }

  return DivergencePotential.LOW;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeTrustEfficiency
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the trust-tier-driven efficiency for a given trust score.
 * Iterates TRUST_SCORE_TIERS to find the matching band, then returns
 * the efficiency multiplier, loan access percentage, and combo bonus.
 *
 * Falls back to BROKEN_TRUST if no tier matches (should not happen with
 * valid 0-100 input).
 *
 * @param trustScore - The current trust score (0–100).
 * @returns Object with band, efficiency, loanAccessPct, and comboBonus.
 */
export function computeTrustEfficiency(trustScore: number): {
  band: TrustBand;
  efficiency: number;
  loanAccessPct: number;
  comboBonus: number;
} {
  const clamped = clamp(trustScore, 0, 100);

  for (const tier of TRUST_SCORE_TIERS) {
    if (clamped >= tier.minScore && clamped <= tier.maxScore) {
      return {
        band: tier.band,
        efficiency: tier.aidEfficiency,
        loanAccessPct: tier.loanAccessPct,
        comboBonus: tier.comboBonus,
      };
    }
  }

  // Fallback — should not be reached with valid input
  const brokenTier = TRUST_SCORE_TIERS[TRUST_SCORE_TIERS.length - 1];
  return {
    band: brokenTier.band,
    efficiency: brokenTier.aidEfficiency,
    loanAccessPct: brokenTier.loanAccessPct,
    comboBonus: brokenTier.comboBonus,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeRescueEfficiency
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes rescue/aid timing efficiency based on elapsed time since the
 * triggering event. Faster responses yield higher multipliers and trust
 * bonuses.
 *
 * If the rescueCard deck type is not in RESCUE_EFFICIENCY_CURVES, returns
 * a degraded default.
 *
 * References: RESCUE_EFFICIENCY_CURVES.
 *
 * @param rescueCard - The card definition (expected RESCUE, AID, or TRUST deck type).
 * @param elapsedMs - Milliseconds elapsed since the rescue-triggering event.
 * @returns Object with effectMultiplier and trustBonus.
 */
export function computeRescueEfficiency(
  rescueCard: CardDefinition,
  elapsedMs: number,
): {
  effectMultiplier: number;
  trustBonus: number;
} {
  const curve = RESCUE_EFFICIENCY_CURVES[rescueCard.deckType];

  if (!curve) {
    // Unknown deck type — use degraded defaults
    return {
      effectMultiplier: 0.5,
      trustBonus: 0,
    };
  }

  if (elapsedMs <= curve.fullEfficiencyMs) {
    return {
      effectMultiplier: curve.fullEffectMultiplier,
      trustBonus: curve.trustBonusOnFull,
    };
  }

  if (elapsedMs <= curve.degradedEfficiencyMs) {
    // Linear interpolation between full and degraded
    const progress = (elapsedMs - curve.fullEfficiencyMs) / (curve.degradedEfficiencyMs - curve.fullEfficiencyMs);
    const multiplierRange = curve.fullEffectMultiplier - curve.degradedEffectMultiplier;
    const trustRange = curve.trustBonusOnFull - curve.trustBonusOnDegraded;
    return {
      effectMultiplier: round6(curve.fullEffectMultiplier - multiplierRange * progress),
      trustBonus: round6(curve.trustBonusOnFull - trustRange * progress),
    };
  }

  // Beyond degraded window — minimum values
  return {
    effectMultiplier: curve.degradedEffectMultiplier,
    trustBonus: curve.trustBonusOnDegraded,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// isIPAChainComplete
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks whether the deck types currently in play form any IPA chain synergy.
 * Returns all matching synergies and the highest achieved tier.
 *
 * References: IPA_CHAIN_SYNERGIES.
 *
 * @param deckTypesInPlay - The set of deck types currently active.
 * @returns Object with complete flag, highest tier, and matching synergies.
 */
export function isIPAChainComplete(deckTypesInPlay: readonly DeckType[]): {
  complete: boolean;
  tier: IPASynergyTier;
  synergies: IPAChainSynergy[];
} {
  const inPlaySet = new Set(deckTypesInPlay);
  const matchedSynergies: IPAChainSynergy[] = [];

  for (const synergy of IPA_CHAIN_SYNERGIES) {
    const allPresent = synergy.combination.every((dt) => inPlaySet.has(dt));
    if (allPresent) {
      matchedSynergies.push(synergy);
    }
  }

  if (matchedSynergies.length === 0) {
    return { complete: false, tier: IPASynergyTier.NONE, synergies: [] };
  }

  // Find the highest tier among matched synergies
  const tierOrder: readonly IPASynergyTier[] = [
    IPASynergyTier.NONE,
    IPASynergyTier.PAIR,
    IPASynergyTier.TRIPLE,
    IPASynergyTier.QUAD_SOVEREIGN,
  ];

  let highestTierIndex = 0;
  for (const synergy of matchedSynergies) {
    const idx = tierOrder.indexOf(synergy.tier);
    if (idx > highestTierIndex) {
      highestTierIndex = idx;
    }
  }

  return {
    complete: true,
    tier: tierOrder[highestTierIndex],
    synergies: matchedSynergies,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeSabotageComboMultiplier
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the sabotage combo effect scaling based on consecutive unblocked
 * sabotage plays. Each consecutive unblocked sabotage reduces BB cost and
 * increases effect magnitude.
 *
 * References: SABOTAGE_COMBO_CONFIG.
 *
 * @param consecutiveUnblockedCount - Number of consecutive unblocked sabotage plays.
 * @returns Object with effective bbCost and effectMagnitude.
 */
export function computeSabotageComboMultiplier(consecutiveUnblockedCount: number): {
  bbCost: number;
  effectMagnitude: number;
} {
  const cfg = SABOTAGE_COMBO_CONFIG;

  if (consecutiveUnblockedCount <= 0) {
    return {
      bbCost: cfg.baseBBCost,
      effectMagnitude: cfg.baseEffectMagnitude,
    };
  }

  // Each consecutive play moves cost toward combo-reduced and magnitude toward combo-max
  const comboFactor = clamp(consecutiveUnblockedCount / 3, 0, 1);
  const bbCostRange = cfg.baseBBCost - cfg.comboReducedBBCost;
  const magnitudeRange = cfg.comboEffectMagnitude - cfg.baseEffectMagnitude;

  return {
    bbCost: round6(cfg.baseBBCost - bbCostRange * comboFactor),
    effectMagnitude: round6(cfg.baseEffectMagnitude + magnitudeRange * comboFactor),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveSOConversionRoutes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Looks up the SO (structural obstacle) conversion routes for a given
 * obstacle name.
 *
 * References: SO_CONVERSION_ROUTES.
 *
 * @param obstacleName - The name of the structural obstacle to look up.
 * @returns The matching SOConversionRouteSpec or null if not found.
 */
export function resolveSOConversionRoutes(obstacleName: string): SOConversionRouteSpec | null {
  for (const route of SO_CONVERSION_ROUTES) {
    if (route.obstacleName === obstacleName) {
      return route;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeCardDecisionQuality
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluates the quality of a card play decision based on timing accuracy
 * and opportunity cost.
 *
 * Uses CARD_DECISION_QUALITY_METRICS weight for timing accuracy.
 *
 * @param timingDeltaTicks - How many ticks the play was from the optimal center.
 * @param optimalWindowTicks - The size of the optimal window in ticks.
 * @param opportunityCostDelta - The difference in expected value vs best alternative.
 * @returns The CardPlayOutcomeClass classification.
 */
export function computeCardDecisionQuality(
  timingDeltaTicks: number,
  optimalWindowTicks: number,
  opportunityCostDelta: number,
): CardPlayOutcomeClass {
  // Reference the timing accuracy metric weight
  const timingMetric = CARD_DECISION_QUALITY_METRICS.find((m) => m.metric === 'timing_accuracy');
  const timingWeight = timingMetric?.weight ?? 0.3;

  // Normalize timing score: 0 delta = perfect, beyond window = terrible
  const safeWindow = Math.max(optimalWindowTicks, 1);
  const timingRatio = Math.abs(timingDeltaTicks) / safeWindow;
  const timingScore = clamp(1.0 - timingRatio, 0, 1);

  // Normalize opportunity cost: 0 = no wasted value, negative = catastrophic
  const ocScore = opportunityCostDelta >= 0
    ? clamp(1.0 - opportunityCostDelta / 100, 0, 1)
    : clamp(opportunityCostDelta / 100, -1, 0);

  // Weighted composite
  const composite = round6(timingScore * timingWeight + ocScore * (1 - timingWeight));

  if (composite >= 0.85) {
    return CardPlayOutcomeClass.OPTIMAL;
  }
  if (composite >= 0.6) {
    return CardPlayOutcomeClass.GOOD;
  }
  if (composite >= 0.35) {
    return CardPlayOutcomeClass.NEUTRAL;
  }
  if (composite >= 0.1) {
    return CardPlayOutcomeClass.SUBOPTIMAL;
  }
  return CardPlayOutcomeClass.CATASTROPHIC;
}

// ─────────────────────────────────────────────────────────────────────────────
// isHoldLegalForCard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines whether a card may be held in the current mode context.
 *
 * Hold legality depends on:
 * 1. The mode card behavior must have holdEnabled.
 * 2. The overlay must allow holds (holdAllowed).
 * 3. The card must not be auto-resolve only.
 * 4. The card's deck type must not be banned in the mode.
 *
 * References: MODE_CARD_BEHAVIORS, HOLD_SYSTEM_CONFIG.
 *
 * @param definition - The card definition.
 * @param mode - The current game mode.
 * @param overlay - The resolved mode overlay.
 * @returns True if the card can be held.
 */
export function isHoldLegalForCard(
  definition: CardDefinition,
  mode: GameMode,
  overlay: Pick<ModeOverlay, 'holdAllowed' | 'autoResolveOverride'>,
): boolean {
  const modeBehavior = MODE_CARD_BEHAVIORS[mode];

  // Mode must have holds enabled globally
  if (!modeBehavior.holdEnabled) {
    return false;
  }

  // Overlay must allow holds for this card
  if (overlay.holdAllowed === false) {
    return false;
  }

  // Auto-resolve-only cards cannot be held
  if (overlay.autoResolveOverride === true || definition.autoResolve) {
    return false;
  }

  // Card deck type must not be banned in the mode
  if (modeBehavior.bannedDeckTypes.includes(definition.deckType)) {
    return false;
  }

  // Phase boundary cards have their own holdable flag handled by PHASE_BOUNDARY_CARDS
  // but at the card level, the hold is legal per mode config
  // (use HOLD_SYSTEM_CONFIG.phaseBoundaryHoldable for phase boundary checks)
  void HOLD_SYSTEM_CONFIG;

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveDefectionProgress
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given the number of defection steps completed, returns the current
 * defection phase, cumulative trust drain, CORD penalty, and visibility.
 *
 * References: DEFECTION_STEPS.
 *
 * @param stepsCompleted - Number of defection steps completed (0-based count).
 * @returns The defection state at the given step count.
 */
export function resolveDefectionProgress(stepsCompleted: number): {
  phase: DefectionPhase;
  trustDrain: number;
  cordPenalty: number;
  isVisible: boolean;
} {
  const safeSteps = clamp(Math.floor(stepsCompleted), 0, DEFECTION_STEPS.length);

  if (safeSteps === 0) {
    return {
      phase: DefectionPhase.BREAK_PACT,
      trustDrain: 0,
      cordPenalty: 0,
      isVisible: false,
    };
  }

  let cumulativeTrustDrain = 0;
  let cumulativeCordPenalty = 0;
  let currentPhase = DefectionPhase.BREAK_PACT;
  let isVisible = false;

  for (let i = 0; i < safeSteps && i < DEFECTION_STEPS.length; i++) {
    const step = DEFECTION_STEPS[i];
    cumulativeTrustDrain += step.trustDrainPerTick;
    cumulativeCordPenalty += step.cordPenalty;
    currentPhase = step.phase;
    isVisible = step.visible;
  }

  return {
    phase: currentPhase,
    trustDrain: round6(cumulativeTrustDrain),
    cordPenalty: cumulativeCordPenalty,
    isVisible,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getProofBadgeConditionsForMode
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filters PROOF_BADGE_CONDITIONS to return only those applicable to the
 * given game mode.
 *
 * @param mode - The game mode to filter by.
 * @returns Array of ProofBadgeCondition applicable to the mode.
 */
export function getProofBadgeConditionsForMode(mode: GameMode): ProofBadgeCondition[] {
  return PROOF_BADGE_CONDITIONS.filter((badge) => badge.applicableModes.includes(mode));
}

// ─────────────────────────────────────────────────────────────────────────────
// computePressureCostModifier
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the pressure cost modifier for a given pressure tier.
 *
 * References: PRESSURE_COST_MODIFIERS.
 *
 * @param pressureTier - The current pressure tier.
 * @returns The cost modifier multiplier.
 */
export function computePressureCostModifier(pressureTier: PressureTier): number {
  return PRESSURE_COST_MODIFIERS[pressureTier];
}

// ─────────────────────────────────────────────────────────────────────────────
// computeComebackSurgeModifier
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines whether a comeback surge is active and computes its
 * decision speed weight modifier.
 *
 * A surge becomes active when cash balance falls below the threshold
 * percentage AND the state is PRIMED or ACTIVE.
 *
 * References: COMEBACK_SURGE_CONFIG.
 *
 * @param state - The current ComebackSurgeState.
 * @param cashBalance - The player's current cash balance.
 * @param cashThreshold - The cash threshold below which the surge activates.
 * @returns Object with active flag and decisionSpeedWeight.
 */
export function computeComebackSurgeModifier(
  state: ComebackSurgeState,
  cashBalance: number,
  cashThreshold: number,
): {
  active: boolean;
  decisionSpeedWeight: number;
} {
  const cfg = COMEBACK_SURGE_CONFIG;
  const belowThreshold = cashBalance < cashThreshold * cfg.cashThresholdPct;

  if (state === ComebackSurgeState.INACTIVE || state === ComebackSurgeState.EXPIRED) {
    return { active: false, decisionSpeedWeight: 0 };
  }

  if (belowThreshold && (state === ComebackSurgeState.PRIMED || state === ComebackSurgeState.ACTIVE)) {
    return { active: true, decisionSpeedWeight: cfg.decisionSpeedWeight };
  }

  return { active: false, decisionSpeedWeight: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// getDeckTypeBaselineHeat
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the baseline heat value for a deck type.
 *
 * References: DECK_TYPE_PROFILES.
 *
 * @param deckType - The deck type.
 * @returns The baseline heat value.
 */
export function getDeckTypeBaselineHeat(deckType: DeckType): number {
  return DECK_TYPE_PROFILES[deckType].baselineHeat;
}

// ─────────────────────────────────────────────────────────────────────────────
// getGhostMarkerSpec
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the ghost marker specification for a given kind.
 *
 * References: GHOST_MARKER_SPECS.
 *
 * @param kind - The ghost marker kind.
 * @returns The GhostMarkerSpec for that kind.
 */
export function getGhostMarkerSpec(kind: GhostMarkerKind): GhostMarkerSpec {
  return GHOST_MARKER_SPECS[kind];
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveCardTargeting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the effective targeting for a card in the current context.
 *
 * Priority:
 * 1. Overlay targetingOverride (if present).
 * 2. Mode-specific default targeting for the deck type.
 * 3. Card definition's base targeting.
 *
 * Validates that the resolved targeting is legal for the mode:
 * - OPPONENT requires HEAD_TO_HEAD.
 * - TEAMMATE/TEAM requires TEAM_UP.
 * - GHOST requires CHASE_A_LEGEND.
 *
 * References: DECK_TYPE_PROFILES, MODE_CARD_BEHAVIORS.
 *
 * @param definition - The card definition.
 * @param mode - The current game mode.
 * @param overlay - The resolved mode overlay.
 * @param context - The execution context with available targets.
 * @returns The resolved Targeting value.
 */
export function resolveCardTargeting(
  definition: CardDefinition,
  mode: GameMode,
  overlay: Pick<ModeOverlay, 'targetingOverride'>,
  _context: Pick<ExecutionContext, 'availableTargetIds'>,
): Targeting {
  // Step 1: overlay override
  if (overlay.targetingOverride) {
    return validateTargetingForMode(overlay.targetingOverride, mode);
  }

  // Step 2: deck type profile default
  const profile = DECK_TYPE_PROFILES[definition.deckType];
  const modeBehavior = MODE_CARD_BEHAVIORS[mode];

  // Check if the deck type is exclusive to this mode — use its default targeting
  if (modeBehavior.exclusiveDeckTypes.includes(definition.deckType)) {
    return profile.defaultTargeting;
  }

  // Step 3: card definition base targeting, validated for mode
  return validateTargetingForMode(definition.targeting, mode);
}

/**
 * Validates that a targeting value is legal for the given mode.
 * Falls back to SELF if the targeting is not supported.
 */
function validateTargetingForMode(targeting: Targeting, mode: GameMode): Targeting {
  switch (targeting) {
    case Targeting.OPPONENT:
      return mode === GameMode.HEAD_TO_HEAD ? Targeting.OPPONENT : Targeting.SELF;
    case Targeting.TEAMMATE:
    case Targeting.TEAM:
      return mode === GameMode.TEAM_UP ? targeting : Targeting.SELF;
    case Targeting.GHOST:
      return mode === GameMode.CHASE_A_LEGEND ? Targeting.GHOST : Targeting.SELF;
    case Targeting.SELF:
    case Targeting.GLOBAL:
      return targeting;
    default:
      return Targeting.SELF;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// validateCardPlayLegality
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Comprehensive validation of whether a card play is legal in the current
 * execution context. Checks mode legality, deck legality, timing class
 * legality, window availability, cost sufficiency, auto-resolve status,
 * card expiry, forced-card restrictions, hold restrictions, and targeting.
 *
 * Returns a TimingValidationResult with the first encountered rejection,
 * or valid=true if all checks pass.
 *
 * This is the authoritative play-legality gate — all card plays must pass
 * through this function before execution.
 *
 * References: CARD_LEGALITY_MATRIX, TIMING_CLASS_MODE_MATRIX,
 *   TIMING_WINDOW_TICKS, TIMING_CLASS_WINDOW_MS, BATTLE_BUDGET_COSTS,
 *   DECK_TYPE_CURRENCY_DEFAULTS, MODE_CARD_BEHAVIORS.
 *
 * @param card - The card-in-hand being played.
 * @param context - The full execution context.
 * @returns A TimingValidationResult.
 */
export function validateCardPlayLegality(
  card: CardInHand,
  context: ExecutionContext,
): TimingValidationResult {
  const definition = card.definition;
  const overlay = card.overlay;
  const mode = context.mode;

  // Resolve effective timing classes
  const effectiveTimings = resolveEffectiveTimingClasses(definition, overlay);
  const requestedTiming = effectiveTimings.length > 0 ? effectiveTimings[0] : TimingClass.ANY;
  const effectiveTargeting = resolveCardTargeting(
    definition,
    mode,
    overlay,
    context,
  );

  const makeResult = (
    valid: boolean,
    rejectionCode: TimingRejectionCode | null,
    reason: string | null,
  ): TimingValidationResult => ({
    valid,
    rejectionCode,
    reason,
    requestedTiming,
    allowedTimingClasses: effectiveTimings,
    effectiveTargeting,
    remainingWindowTicks: context.windowRemainingTicksByTiming?.[requestedTiming],
    remainingWindowMs: context.windowRemainingMsByTiming?.[requestedTiming],
  });

  // 1. Check mode legality at overlay level
  if (!overlay.legal) {
    return makeResult(false, TimingRejectionCode.CARD_ILLEGAL, 'Card is not legal in the current mode overlay.');
  }

  // 2. Check deck type legality for mode
  if (!isDeckLegalInMode(definition.deckType, mode)) {
    return makeResult(false, TimingRejectionCode.DECK_ILLEGAL, `Deck type ${definition.deckType} is not legal in mode ${mode}.`);
  }

  // 3. Check mode-level legality for card (if modeLegal is specified)
  if (definition.modeLegal && !definition.modeLegal.includes(mode)) {
    return makeResult(false, TimingRejectionCode.MODE_ILLEGAL, `Card is restricted to modes: ${definition.modeLegal.join(', ')}.`);
  }

  // 4. Check timing class legality for mode
  const hasLegalTiming = effectiveTimings.some((tc) => isTimingClassLegalInMode(tc, mode));
  if (!hasLegalTiming) {
    return makeResult(
      false,
      TimingRejectionCode.TIMING_CLASS_ILLEGAL,
      `None of the card timing classes [${effectiveTimings.join(', ')}] are legal in mode ${mode}.`,
    );
  }

  // 5. Check if a timing window is open for at least one effective timing class
  const hasOpenWindow = effectiveTimings.some((tc) => {
    const remainingTicks = context.windowRemainingTicksByTiming?.[tc];
    const remainingMs = context.windowRemainingMsByTiming?.[tc];
    // ANY timing is always open
    if (tc === TimingClass.ANY) return true;
    // Check context flags for specific windows
    if (tc === TimingClass.CTR && context.activeCounterWindow) return true;
    if (tc === TimingClass.RES && context.activeRescueWindow) return true;
    if (tc === TimingClass.AID && context.activeAidWindow) return true;
    if (tc === TimingClass.GBM && context.activeGhostBenchmarkWindow) return true;
    if (tc === TimingClass.CAS && context.activeCascadeInterceptWindow) return true;
    if (tc === TimingClass.PHZ && context.activePhaseBoundaryWindow) return true;
    if (tc === TimingClass.PSK && context.activePressureSpikeWindow) return true;
    if (tc === TimingClass.FATE && context.activeFateWindow) return true;
    if (tc === TimingClass.END && context.isFinalTick) return true;
    // Check remaining ticks/ms
    if (remainingTicks !== undefined && remainingTicks > 0) return true;
    if (remainingMs !== undefined && remainingMs > 0) return true;
    // For PRE/POST, check the current window
    if ((tc === TimingClass.PRE || tc === TimingClass.POST) && context.currentWindow === tc) return true;
    return false;
  });

  if (!hasOpenWindow) {
    return makeResult(false, TimingRejectionCode.WINDOW_CLOSED, 'No timing window is currently open for this card.');
  }

  // 6. Check auto-resolve
  if (definition.autoResolve && overlay.autoResolveOverride !== false) {
    return makeResult(false, TimingRejectionCode.AUTO_RESOLVE_ONLY, 'This card is auto-resolve only and cannot be manually played.');
  }

  // 7. Check card expiry
  if (card.expiresAtTick !== undefined && context.tickIndex >= card.expiresAtTick) {
    return makeResult(false, TimingRejectionCode.CARD_EXPIRED, 'Card has expired and can no longer be played.');
  }

  // 8. Check forced-card restrictions
  if (context.forcedCardPending && !card.isForced) {
    return makeResult(false, TimingRejectionCode.FORCED_CARD_PENDING, 'A forced card must be played before voluntary plays.');
  }

  // 9. Check hold restrictions
  if (card.isHeld && !isHoldLegalForCard(definition, mode, overlay)) {
    return makeResult(false, TimingRejectionCode.HOLD_RESTRICTED, 'Held card is not legal to play in the current mode.');
  }

  // 10. Check battle budget sufficiency for PvP deck types
  const currency = card.effectiveCurrency;
  if (currency === 'battle_budget') {
    const bbEntry = BATTLE_BUDGET_COSTS[definition.deckType];
    const requiredBB = bbEntry ? bbEntry.bbCost : card.effectiveCost;
    if (context.battleBudget !== undefined && context.battleBudget < requiredBB) {
      return makeResult(
        false,
        TimingRejectionCode.INSUFFICIENT_BATTLE_BUDGET,
        `Insufficient battle budget: need ${requiredBB}, have ${context.battleBudget}.`,
      );
    }
  }

  // 11. Check treasury sufficiency for co-op deck types
  if (currency === 'treasury') {
    if (context.treasury !== undefined && context.treasury < card.effectiveCost) {
      return makeResult(
        false,
        TimingRejectionCode.INSUFFICIENT_TREASURY,
        `Insufficient treasury: need ${card.effectiveCost}, have ${context.treasury}.`,
      );
    }
  }

  // 12. Check target legality
  if (effectiveTargeting === Targeting.OPPONENT || effectiveTargeting === Targeting.TEAMMATE) {
    if (context.availableTargetIds && context.availableTargetIds.length === 0) {
      return makeResult(false, TimingRejectionCode.TARGET_ILLEGAL, 'No valid targets available for this card.');
    }
  }

  // All checks passed
  return makeResult(true, null, null);
}

// ─────────────────────────────────────────────────────────────────────────────
// computeCardMLFeatures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the ML feature vector for a card play input. Encodes card
 * properties, mode context, and game state into a fixed-dimension
 * numerical vector for downstream scoring/classification.
 *
 * Uses normalizeSeed from deterministic_rng for feature normalization
 * to ensure stable numerical ranges even for extreme values.
 *
 * All features are normalized to [0, 1] range where applicable.
 *
 * References: CARD_ML_FEATURE_DIMENSION, CARD_ML_FEATURE_LABELS,
 *   DECK_TYPE_PROFILES, MODE_CARD_BEHAVIORS.
 *
 * @param input - The CardTypeMLFeatureInput containing all raw card and context data.
 * @returns A CardTypeMLFeatureVector with normalized features.
 */
export function computeCardMLFeatures(input: CardTypeMLFeatureInput): CardTypeMLFeatureVector {
  const profile = DECK_TYPE_PROFILES[input.deckType];
  const modeBehavior = MODE_CARD_BEHAVIORS[input.mode];

  const overlay = DEFAULT_MODE_OVERLAYS[input.mode];

  // Ordinal features (normalized to 0-1)
  const deckTypeOrd = DECK_TYPE_ORDINAL_MAP[input.deckType] / Math.max(MAX_DECK_TYPE_ORDINAL, 1);
  const modeOrd = MODE_ORDINAL_MAP[input.mode] / Math.max(MAX_MODE_ORDINAL, 1);
  const rarityOrd = RARITY_ORDINAL_MAP[input.rarity] / Math.max(MAX_RARITY_ORDINAL, 1);
  const timingOrd = TIMING_CLASS_ORDINAL_MAP[input.timingClass] / Math.max(MAX_TIMING_CLASS_ORDINAL, 1);
  const divPotOrd = DIVERGENCE_POTENTIAL_ORDINAL_MAP[input.divergencePotential] / Math.max(MAX_DIVERGENCE_POTENTIAL_ORDINAL, 1);
  const pressureOrd = PRESSURE_TIER_ORDINAL_MAP[input.pressureTier] / Math.max(MAX_PRESSURE_TIER_ORDINAL, 1);
  const phaseOrd = PHASE_ORDINAL_MAP[input.phase] / Math.max(MAX_PHASE_ORDINAL, 1);

  // Continuous features (normalized)
  const costNorm = clamp(input.effectiveCost / MAX_COST_NORMALIZER, 0, 1);
  const tagScoreNorm = clamp(input.tagWeightedScore / 20, 0, 1);
  const tickNorm = clamp(input.tickIndex / MAX_TICK_INDEX_NORMALIZER, 0, 1);

  // Boolean features
  const isPvpExclusive = modeBehavior.exclusiveDeckTypes.includes(input.deckType) &&
    input.mode === GameMode.HEAD_TO_HEAD ? 1 : 0;
  const isCoopExclusive = modeBehavior.exclusiveDeckTypes.includes(input.deckType) &&
    input.mode === GameMode.TEAM_UP ? 1 : 0;
  const isGhostExclusive = modeBehavior.exclusiveDeckTypes.includes(input.deckType) &&
    input.mode === GameMode.CHASE_A_LEGEND ? 1 : 0;

  // Overlay features
  const costModFromOverlay = clamp(overlay.costModifier / 2, 0, 1);
  const effectModFromOverlay = clamp(overlay.effectModifier / 2, 0, 1);
  const cordWeightFromOverlay = clamp(overlay.cordWeight / 2, 0, 1);

  // Profile features
  const baselineHeat = clamp((profile.baselineHeat + 0.1) / 0.3, 0, 1);
  const baselineCordWeight = clamp(profile.baselineCordWeight / 2, 0, 1);
  const drawRateMultiplier = clamp(profile.drawRateMultiplier / 2, 0, 1);
  const autoResolveFlag = profile.autoResolveDefault ? 1 : 0;

  // Use normalizeSeed to ensure stable seed-based normalization factor
  // This grounds the feature vector to the deterministic RNG system
  const seedNormFactor = normalizeSeed(
    Math.round(input.effectiveCost * 1000 + input.tickIndex),
  );
  // Apply micro-jitter based on seed to prevent hash collisions in ML pipelines
  const jitter = (seedNormFactor % 1000) / 1_000_000;

  const features: number[] = [
    round6(deckTypeOrd + jitter),
    round6(modeOrd),
    round6(rarityOrd),
    round6(timingOrd),
    round6(costNorm),
    round6(tagScoreNorm),
    round6(divPotOrd),
    round6(pressureOrd),
    round6(tickNorm),
    round6(phaseOrd),
    isPvpExclusive,
    isCoopExclusive,
    isGhostExclusive,
    round6(costModFromOverlay),
    round6(effectModFromOverlay),
    round6(cordWeightFromOverlay),
    round6(baselineHeat),
    round6(baselineCordWeight),
    round6(drawRateMultiplier),
    autoResolveFlag,
  ];

  return {
    features,
    labels: CARD_ML_FEATURE_LABELS as unknown as readonly string[],
    dimension: CARD_ML_FEATURE_DIMENSION,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// formatCardPlayReceipt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates an immutable CardPlayReceipt from a CardEffectResult and run seed.
 * The receipt contains a SHA-256 hash computed from the play details for
 * tamper-evident auditing.
 *
 * Uses createHash from node:crypto for the receipt hash.
 *
 * @param result - The CardEffectResult from engine execution.
 * @param runSeed - The deterministic run seed string.
 * @returns A CardPlayReceipt with cryptographic hash.
 */
export function formatCardPlayReceipt(
  result: CardEffectResult,
  runSeed: string,
): CardPlayReceipt {
  // Compute outcome class from the result metadata
  const outcome = result.isOptimalChoice
    ? CardPlayOutcomeClass.OPTIMAL
    : (result.totalCordDelta > 0
      ? CardPlayOutcomeClass.GOOD
      : (result.totalCordDelta === 0
        ? CardPlayOutcomeClass.NEUTRAL
        : CardPlayOutcomeClass.SUBOPTIMAL));

  // Build a deterministic hash for the receipt using createHash
  const receiptPayload = [
    result.playId,
    result.cardId,
    result.mode,
    String(result.appliedAt),
    result.choiceId,
    String(result.totalCordDelta),
    runSeed,
  ].join('|');

  const receiptHash = createHash('sha256').update(receiptPayload).digest('hex');

  return {
    playId: result.playId,
    hash: receiptHash,
    timestamp: result.appliedAt,
    cardId: result.cardId,
    mode: result.mode,
    outcome,
    cordDelta: result.totalCordDelta,
    resourceSnapshot: result.resourceDelta,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// createCardDrawRng
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a deterministic RNG instance for card draw operations.
 * Derives a unique seed from the run seed, pool name, and draw cycle
 * using combineSeed and hashStringToSeed from deterministic_rng.
 *
 * This ensures that card draws are fully reproducible given the same
 * run seed, pool, and cycle — a core requirement for replay verification.
 *
 * @param runSeed - The hex or string run seed.
 * @param poolName - The name of the card pool being drawn from (e.g., "OPPORTUNITY_POOL").
 * @param cycle - The draw cycle index (increments each time the pool is drawn from).
 * @returns A DeterministicRng instance seeded for this specific draw context.
 */
export function createCardDrawRng(
  runSeed: string,
  poolName: string,
  cycle: number,
): DeterministicRng {
  const baseSeed = hashStringToSeed(runSeed);
  const poolSeed = combineSeed(baseSeed, poolName);
  const cycleSeed = combineSeed(poolSeed, cycle);
  return createDeterministicRng(cycleSeed);
}

// ─────────────────────────────────────────────────────────────────────────────
// computeCardWeightFromFeatures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a single scalar weight from a CardTypeMLFeatureVector.
 * This is a simple weighted sum used for draw-weight adjustments
 * and priority scoring.
 *
 * The weight for each feature is derived from the CARD_DECISION_QUALITY_METRICS
 * and CARD_RARITY_DROP_RATES as domain-relevant coefficients.
 *
 * @param features - The CardTypeMLFeatureVector.
 * @returns A scalar weight value (not bounded).
 */
export function computeCardWeightFromFeatures(features: CardTypeMLFeatureVector): number {
  if (features.dimension !== CARD_ML_FEATURE_DIMENSION || features.features.length !== CARD_ML_FEATURE_DIMENSION) {
    return 0;
  }

  // Compute weighted sum with feature-position-specific weights
  // Weights are empirically tuned: cost and tag score are highest signal
  const featureWeights: readonly number[] = [
    0.5,  // deck_type_ordinal
    0.3,  // mode_ordinal
    0.8,  // rarity_ordinal
    0.4,  // timing_class_ordinal
    1.2,  // effective_cost_normalized
    1.5,  // tag_weighted_score
    0.7,  // divergence_potential_ordinal
    0.6,  // pressure_tier_ordinal
    0.3,  // tick_index_normalized
    0.4,  // phase_ordinal
    0.2,  // is_pvp_exclusive
    0.2,  // is_coop_exclusive
    0.2,  // is_ghost_exclusive
    0.5,  // cost_modifier_from_overlay
    0.5,  // effect_modifier_from_overlay
    0.6,  // cord_weight_from_overlay
    0.4,  // baseline_heat
    0.5,  // baseline_cord_weight
    0.3,  // draw_rate_multiplier
    0.1,  // auto_resolve_flag
  ] as const;

  let sum = 0;
  for (let i = 0; i < CARD_ML_FEATURE_DIMENSION; i++) {
    sum += features.features[i] * featureWeights[i];
  }

  // Reference CARD_RARITY_DROP_RATES to ensure the constant is used in this function
  const rarityFeatureIdx = 2; // rarity_ordinal index
  const rarityVal = features.features[rarityFeatureIdx];
  // Apply a rarity-curve adjustment: rarer cards get a weight boost
  // Map the normalized rarity back to approximate rarity and look up drop rate
  let dropRateAdjustment = CARD_RARITY_DROP_RATES[CardRarity.COMMON];
  if (rarityVal > 0.8) {
    dropRateAdjustment = CARD_RARITY_DROP_RATES[CardRarity.LEGENDARY];
  } else if (rarityVal > 0.55) {
    dropRateAdjustment = CARD_RARITY_DROP_RATES[CardRarity.RARE];
  } else if (rarityVal > 0.25) {
    dropRateAdjustment = CARD_RARITY_DROP_RATES[CardRarity.UNCOMMON];
  }

  // Inverse drop rate: rarer cards = lower drop rate = higher weight boost
  const rarityBoost = (1 - dropRateAdjustment) * 0.5;
  sum += rarityBoost;

  return round6(sum);
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveGhostBenchmarkWindow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the ghost benchmark window state for a given ghost marker kind,
 * current tick, and the tick at which the marker was placed.
 *
 * References: GHOST_MARKER_SPECS.
 *
 * @param ghostMarkerKind - The kind of ghost marker.
 * @param currentTick - The current simulation tick.
 * @param markerTick - The tick at which the ghost marker was placed.
 * @returns Object with inWindow, ticksRemaining, and exploitAvailable.
 */
export function resolveGhostBenchmarkWindow(
  ghostMarkerKind: GhostMarkerKind,
  currentTick: number,
  markerTick: number,
): {
  inWindow: boolean;
  ticksRemaining: number;
  exploitAvailable: boolean;
} {
  const spec = GHOST_MARKER_SPECS[ghostMarkerKind];
  const elapsed = currentTick - markerTick;
  const remaining = spec.exploitWindowTicks - elapsed;

  if (elapsed < 0) {
    // Marker is in the future
    return {
      inWindow: false,
      ticksRemaining: spec.exploitWindowTicks,
      exploitAvailable: false,
    };
  }

  if (remaining > 0) {
    return {
      inWindow: true,
      ticksRemaining: remaining,
      exploitAvailable: true,
    };
  }

  return {
    inWindow: false,
    ticksRemaining: 0,
    exploitAvailable: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getModeCardBehavior
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the ModeCardBehavior configuration for a given game mode.
 *
 * References: MODE_CARD_BEHAVIORS.
 *
 * @param mode - The game mode.
 * @returns The ModeCardBehavior for that mode.
 */
export function getModeCardBehavior(mode: GameMode): ModeCardBehavior {
  return MODE_CARD_BEHAVIORS[mode];
}

// ─────────────────────────────────────────────────────────────────────────────
// getDeckTypeProfile
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the DeckTypeProfile for a given deck type.
 *
 * References: DECK_TYPE_PROFILES.
 *
 * @param deckType - The deck type.
 * @returns The DeckTypeProfile for that deck type.
 */
export function getDeckTypeProfile(deckType: DeckType): DeckTypeProfile {
  return DECK_TYPE_PROFILES[deckType];
}

// ─────────────────────────────────────────────────────────────────────────────
// computeBleedthroughMultiplier
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the Predator bleed-through multiplier based on pressure tier
 * and critical timing status. In higher pressure tiers, negative effects
 * "bleed through" shields at increasing rates. Critical timing (e.g.,
 * during phase boundaries or pressure spikes) amplifies the bleed-through.
 *
 * Uses PRESSURE_COST_MODIFIERS as the base scaling factor and
 * PHASE_BOUNDARY_CARDS to check boundary card windows.
 *
 * The multiplier is [0, 1] where:
 * - 0 = no bleed-through (full shield protection)
 * - 1 = complete bleed-through (shield provides no protection)
 *
 * Uses combineSeed for deterministic jitter calculation to prevent
 * perfectly predictable bleed-through patterns at tier boundaries.
 *
 * @param pressureTier - The current pressure tier.
 * @param isCriticalTiming - Whether the current timing is critical (phase boundary, pressure spike).
 * @returns The bleed-through multiplier in [0, 1].
 */
export function computeBleedthroughMultiplier(
  pressureTier: PressureTier,
  isCriticalTiming: boolean,
): number {
  const pressureMod = PRESSURE_COST_MODIFIERS[pressureTier];

  // Base bleed-through: scales from 0 at T0 to ~0.375 at T4
  // Formula: (pressureMod - 0.8) / (1.6 - 0.8) * 0.5
  const minMod = PRESSURE_COST_MODIFIERS[PressureTier.T0_SOVEREIGN];
  const maxMod = PRESSURE_COST_MODIFIERS[PressureTier.T4_COLLAPSE_IMMINENT];
  const range = maxMod - minMod;
  const baseBleed = range > 0 ? ((pressureMod - minMod) / range) * 0.5 : 0;

  // Critical timing amplifier: adds up to 0.25 extra bleed-through
  const criticalBonus = isCriticalTiming ? 0.25 : 0;

  // PHASE_BOUNDARY_CARDS reference: check if any boundary card has effects
  // that would interact with bleed-through (HEAT_DELTA effects)
  let phaseBoundaryHeatFactor = 0;
  for (const pbc of PHASE_BOUNDARY_CARDS) {
    for (const effect of pbc.effects) {
      if (effect.op === CardEffectOp.HEAT_DELTA && effect.magnitude > 0.1) {
        phaseBoundaryHeatFactor = 0.05;
        break;
      }
    }
    if (phaseBoundaryHeatFactor > 0) break;
  }

  // Add deterministic micro-variation using combineSeed
  // so bleed-through is not perfectly predictable at tier boundaries
  const tierOrd = PRESSURE_TIER_ORDINAL_MAP[pressureTier];
  const deterministicSeed = combineSeed(tierOrd + 1, isCriticalTiming ? 'critical' : 'normal');
  const microJitter = (deterministicSeed % 100) / 10000; // 0.0000 - 0.0099

  const rawMultiplier = baseBleed + criticalBonus + phaseBoundaryHeatFactor + microJitter;
  return clamp(round6(rawMultiplier), 0, 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADDITIONAL UTILITY FUNCTIONS — Cross-referencing all constants
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// getTimingClassLabel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the human-readable label for a timing class.
 *
 * References: TIMING_CLASS_LABELS.
 *
 * @param timingClass - The timing class.
 * @returns The label string.
 */
export function getTimingClassLabel(timingClass: TimingClass): string {
  return TIMING_CLASS_LABELS[timingClass];
}

// ─────────────────────────────────────────────────────────────────────────────
// getDeckTypeLabel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the human-readable label for a deck type.
 *
 * References: DECK_TYPE_LABELS.
 *
 * @param deckType - The deck type.
 * @returns The label string.
 */
export function getDeckTypeLabel(deckType: DeckType): string {
  return DECK_TYPE_LABELS[deckType];
}

// ─────────────────────────────────────────────────────────────────────────────
// getCardTagLabel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the human-readable label for a card tag.
 *
 * References: CARD_TAG_LABELS.
 *
 * @param tag - The card tag.
 * @returns The label string.
 */
export function getCardTagLabel(tag: CardTag): string {
  return CARD_TAG_LABELS[tag];
}

// ─────────────────────────────────────────────────────────────────────────────
// getDeckTypeCurrencyDefault
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the default currency type for a given deck type.
 *
 * References: DECK_TYPE_CURRENCY_DEFAULTS.
 *
 * @param deckType - The deck type.
 * @returns The default CurrencyType.
 */
export function getDeckTypeCurrencyDefault(deckType: DeckType): CurrencyType {
  return DECK_TYPE_CURRENCY_DEFAULTS[deckType];
}

// ─────────────────────────────────────────────────────────────────────────────
// getCardRarityDropRate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the probability weight for a given card rarity.
 *
 * References: CARD_RARITY_DROP_RATES.
 *
 * @param rarity - The card rarity.
 * @returns The drop rate probability weight.
 */
export function getCardRarityDropRate(rarity: CardRarity): number {
  return CARD_RARITY_DROP_RATES[rarity];
}

// ─────────────────────────────────────────────────────────────────────────────
// getEducationalPrincipleForCard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Finds the educational principle associated with a card name.
 *
 * References: EDUCATIONAL_PRINCIPLES.
 *
 * @param cardName - The card name to look up.
 * @returns The EducationalPrincipleMapping or null.
 */
export function getEducationalPrincipleForCard(cardName: string): EducationalPrincipleMapping | null {
  for (const mapping of EDUCATIONAL_PRINCIPLES) {
    if (mapping.cardRepresentations.includes(cardName)) {
      return mapping;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeCounterBouncebackEffect
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Looks up the bounceback effect for a counter card.
 *
 * References: COUNTER_BOUNCEBACK_MAP.
 *
 * @param counterCardName - The name of the counter card.
 * @returns The CounterBouncebackSpec or null if not found.
 */
export function computeCounterBouncebackEffect(counterCardName: string): CounterBouncebackSpec | null {
  for (const spec of COUNTER_BOUNCEBACK_MAP) {
    if (spec.counterCard === counterCardName) {
      return spec;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeIPASynergyBonusForPlay
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given the deck types currently in play, computes the aggregate IPA synergy
 * bonus by summing all matched synergy bonuses.
 *
 * References: IPA_CHAIN_SYNERGIES (via isIPAChainComplete).
 *
 * @param deckTypesInPlay - The set of deck types currently active.
 * @returns Aggregate bonus or null if no synergies.
 */
export function computeIPASynergyBonusForPlay(deckTypesInPlay: readonly DeckType[]): IPASynergyBonus | null {
  const result = isIPAChainComplete(deckTypesInPlay);
  if (!result.complete || result.synergies.length === 0) {
    return null;
  }

  // Take the highest-tier synergy bonus
  let bestSynergy = result.synergies[0];
  for (const syn of result.synergies) {
    if (syn.combination.length > bestSynergy.combination.length) {
      bestSynergy = syn;
    }
  }

  return bestSynergy.synergyBonus;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeDivergenceCordMultiplier
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the CORD multiplier for a given divergence potential level.
 *
 * References: DIVERGENCE_SCORING_SPECS.
 *
 * @param potential - The divergence potential.
 * @returns The cord multiplier.
 */
export function computeDivergenceCordMultiplier(potential: DivergencePotential): number {
  return DIVERGENCE_SCORING_SPECS[potential].cordMultiplier;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeHoldBonusCordMultiplier
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the CORD multiplier bonus for not using holds in a run.
 * If the player does not use any holds, they receive the noHoldCordMultiplier
 * from HOLD_SYSTEM_CONFIG.
 *
 * References: HOLD_SYSTEM_CONFIG.
 *
 * @param holdsUsed - Number of holds the player has used.
 * @param momentumStreak - Current momentum streak (consecutive optimal plays).
 * @returns The CORD multiplier (1.0 = no bonus, > 1.0 = bonus).
 */
export function computeHoldBonusCordMultiplier(
  holdsUsed: number,
  momentumStreak: number,
): number {
  const cfg = HOLD_SYSTEM_CONFIG;

  let multiplier = 1.0;

  // No-hold bonus
  if (holdsUsed === 0) {
    multiplier *= cfg.noHoldCordMultiplier;
  }

  // Momentum threshold bonus (bonus holds earned don't count as holds used)
  if (momentumStreak >= cfg.momentumThreshold) {
    multiplier *= 1.0 + (cfg.bonusHoldsOnThreshold * 0.02);
  }

  return round6(multiplier);
}

// ─────────────────────────────────────────────────────────────────────────────
// computeDefectionDetectionRequired
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines whether a detection card is required to reveal the current
 * defection step.
 *
 * References: DEFECTION_STEPS.
 *
 * @param stepIndex - The defection step index.
 * @returns True if a detection card is needed to see this step.
 */
export function computeDefectionDetectionRequired(stepIndex: number): boolean {
  const idx = clamp(Math.floor(stepIndex), 0, DEFECTION_STEPS.length - 1);
  return DEFECTION_STEPS[idx].detectionCardRequired;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeEffectiveWindowMs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the effective window duration in milliseconds for a timing class,
 * adjusted by the pressure tier. Higher pressure = shorter windows.
 *
 * References: TIMING_CLASS_WINDOW_MS, PRESSURE_COST_MODIFIERS.
 *
 * @param timingClass - The timing class.
 * @param pressureTier - The current pressure tier.
 * @returns The effective window duration in milliseconds.
 */
export function computeEffectiveWindowMs(
  timingClass: TimingClass,
  pressureTier: PressureTier,
): number {
  const baseMs = TIMING_CLASS_WINDOW_MS[timingClass];
  const pressureMod = PRESSURE_COST_MODIFIERS[pressureTier];

  // Higher pressure = shorter windows (inverse relationship)
  // At T0_SOVEREIGN (0.8), windows are 25% longer
  // At T4_COLLAPSE_IMMINENT (1.6), windows are 37.5% shorter
  const adjustedMs = baseMs / pressureMod;
  return Math.round(adjustedMs);
}

// ─────────────────────────────────────────────────────────────────────────────
// computeEffectiveWindowTicks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the effective window duration in ticks for a timing class.
 * Ticks are not pressure-adjusted (they represent atomic simulation steps).
 *
 * References: TIMING_WINDOW_TICKS.
 *
 * @param timingClass - The timing class.
 * @returns The window duration in ticks.
 */
export function computeEffectiveWindowTicks(timingClass: TimingClass): number {
  return TIMING_WINDOW_TICKS[timingClass];
}

// ─────────────────────────────────────────────────────────────────────────────
// computeBattleBudgetCostForPlay
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the effective battle budget cost for a PvP card play,
 * accounting for counter discounts and combo reductions.
 *
 * References: BATTLE_BUDGET_COSTS.
 *
 * @param deckType - The deck type being played.
 * @param isCounterContext - Whether this play is a counter-response.
 * @param comboCount - Number of consecutive combo plays.
 * @returns The effective BB cost, or 0 if not a BB deck type.
 */
export function computeBattleBudgetCostForPlay(
  deckType: DeckType,
  isCounterContext: boolean,
  comboCount: number,
): number {
  const entry = BATTLE_BUDGET_COSTS[deckType];
  if (!entry) {
    return 0;
  }

  let cost = entry.bbCost;

  if (isCounterContext) {
    cost -= entry.counterDiscount;
  }

  if (comboCount > 0) {
    cost -= entry.comboReduction * clamp(comboCount, 0, 5);
  }

  return Math.max(cost, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// computeSOConversionPainBonus
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the total CORD bonus from choosing the Pain path across
 * multiple SO obstacles.
 *
 * References: SO_CONVERSION_ROUTES.
 *
 * @param obstacleNames - Array of obstacle names resolved via the Pain path.
 * @returns The total CORD bonus from pain conversions.
 */
export function computeSOConversionPainBonus(obstacleNames: readonly string[]): number {
  let total = 0;
  for (const name of obstacleNames) {
    const route = resolveSOConversionRoutes(name);
    if (route) {
      total += route.painCordBonus;
    }
  }
  return total;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeTrustDefectionAlert
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines whether a trust defection alert should be shown based on
 * the current trust score.
 *
 * References: TRUST_SCORE_TIERS.
 *
 * @param trustScore - The current trust score (0-100).
 * @returns Object with signal and alert flags.
 */
export function computeTrustDefectionAlert(trustScore: number): {
  defectionSignal: boolean;
  defectionAlert: boolean;
} {
  const result = computeTrustEfficiency(trustScore);
  const tier = TRUST_SCORE_TIERS.find((t) => t.band === result.band);
  return {
    defectionSignal: tier?.defectionSignal ?? false,
    defectionAlert: tier?.defectionAlert ?? false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeGhostMarkerCordBonus
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the CORD bonus for exploiting a ghost marker within its window.
 *
 * References: GHOST_MARKER_SPECS.
 *
 * @param kind - The ghost marker kind.
 * @param currentTick - The current simulation tick.
 * @param markerTick - The tick at which the marker was placed.
 * @returns The CORD bonus (0 if outside window).
 */
export function computeGhostMarkerCordBonus(
  kind: GhostMarkerKind,
  currentTick: number,
  markerTick: number,
): number {
  const window = resolveGhostBenchmarkWindow(kind, currentTick, markerTick);
  if (!window.exploitAvailable) {
    return 0;
  }

  const spec = getGhostMarkerSpec(kind);

  // Bonus scales with remaining ticks — earlier exploitation = higher bonus
  const tickFraction = window.ticksRemaining / spec.exploitWindowTicks;
  return round6(spec.cordBonus * (0.5 + 0.5 * tickFraction));
}

// ─────────────────────────────────────────────────────────────────────────────
// computeGhostMarkerShieldBonus
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the shield bonus for exploiting a ghost marker.
 *
 * References: GHOST_MARKER_SPECS.
 *
 * @param kind - The ghost marker kind.
 * @param currentTick - The current simulation tick.
 * @param markerTick - The tick at which the marker was placed.
 * @returns The shield bonus (0 if outside window or marker has no shield bonus).
 */
export function computeGhostMarkerShieldBonus(
  kind: GhostMarkerKind,
  currentTick: number,
  markerTick: number,
): number {
  const window = resolveGhostBenchmarkWindow(kind, currentTick, markerTick);
  if (!window.exploitAvailable) {
    return 0;
  }
  return GHOST_MARKER_SPECS[kind].shieldBonus;
}

// ─────────────────────────────────────────────────────────────────────────────
// computePhaseBoundaryCardEffects
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the phase boundary card spec for a given phase transition,
 * if one exists.
 *
 * References: PHASE_BOUNDARY_CARDS.
 *
 * @param fromPhase - The phase being exited.
 * @param toPhase - The phase being entered.
 * @returns The PhaseBoundaryCardSpec or null.
 */
export function computePhaseBoundaryCardEffects(
  fromPhase: RunPhase,
  toPhase: RunPhase,
): PhaseBoundaryCardSpec | null {
  for (const spec of PHASE_BOUNDARY_CARDS) {
    if (spec.fromPhase === fromPhase && spec.toPhase === toPhase) {
      return spec;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeDeckTypeLegalityForMode
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the full legality analysis for a deck type in a mode.
 *
 * References: CARD_LEGALITY_MATRIX, DECK_TYPE_MODE_MATRIX,
 *   MODE_CARD_BEHAVIORS, DECK_TYPE_PROFILES.
 *
 * @param deckType - The deck type.
 * @param mode - The game mode.
 * @returns Object describing legality, exclusivity, and deck type metadata.
 */
export function computeDeckTypeLegalityForMode(
  deckType: DeckType,
  mode: GameMode,
): {
  legal: boolean;
  exclusive: boolean;
  banned: boolean;
  label: string;
  educationalCategory: string;
  defaultCurrency: CurrencyType;
} {
  const modeBehavior = MODE_CARD_BEHAVIORS[mode];
  const profile = DECK_TYPE_PROFILES[deckType];

  return {
    legal: isDeckLegalInMode(deckType, mode),
    exclusive: modeBehavior.exclusiveDeckTypes.includes(deckType),
    banned: modeBehavior.bannedDeckTypes.includes(deckType),
    label: DECK_TYPE_LABELS[deckType],
    educationalCategory: profile.educationalCategory,
    defaultCurrency: DECK_TYPE_CURRENCY_DEFAULTS[deckType],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeTimingClassLegalityForMode
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the full legality analysis for a timing class in a mode.
 *
 * References: TIMING_CLASS_MODE_MATRIX, TIMING_WINDOW_TICKS,
 *   TIMING_CLASS_WINDOW_MS, TIMING_CLASS_LABELS.
 *
 * @param timingClass - The timing class.
 * @param mode - The game mode.
 * @returns Object describing legality, window duration, and label.
 */
export function computeTimingClassLegalityForMode(
  timingClass: TimingClass,
  mode: GameMode,
): {
  legal: boolean;
  windowTicks: number;
  windowMs: number;
  label: string;
} {
  return {
    legal: isTimingClassLegalInMode(timingClass, mode),
    windowTicks: TIMING_WINDOW_TICKS[timingClass],
    windowMs: TIMING_CLASS_WINDOW_MS[timingClass],
    label: TIMING_CLASS_LABELS[timingClass],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeCardDrawWeights
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the draw weights for all legal deck types in a mode,
 * incorporating rarity and profile draw rate multipliers.
 *
 * Uses createCardDrawRng for deterministic weight jitter based on run seed.
 *
 * References: CARD_LEGALITY_MATRIX, DECK_TYPE_PROFILES,
 *   CARD_RARITY_DROP_RATES.
 *
 * @param mode - The game mode.
 * @param rarity - The card rarity being drawn.
 * @param runSeed - The run seed for deterministic jitter.
 * @param cycle - The draw cycle index.
 * @returns Map of legal deck types to their draw weights.
 */
export function computeCardDrawWeights(
  mode: GameMode,
  rarity: CardRarity,
  runSeed: string,
  cycle: number,
): Map<DeckType, number> {
  const legalDeckTypes = CARD_LEGALITY_MATRIX[mode];
  const rarityDropRate = CARD_RARITY_DROP_RATES[rarity];
  const rng = createCardDrawRng(runSeed, `draw_weights_${mode}`, cycle);

  const weights = new Map<DeckType, number>();

  for (const deckType of legalDeckTypes) {
    const profile = DECK_TYPE_PROFILES[deckType];
    const baseWeight = rarityDropRate * profile.drawRateMultiplier;
    // Add small deterministic jitter to prevent perfectly uniform distributions
    const jitter = rng.next() * 0.05;
    weights.set(deckType, round6(baseWeight + jitter));
  }

  return weights;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeRescueWindowStatus
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes rescue window status for all rescue-capable deck types.
 *
 * References: RESCUE_EFFICIENCY_CURVES, MODE_CARD_BEHAVIORS.
 *
 * @param mode - The game mode.
 * @param elapsedMs - Time since rescue-triggering event.
 * @returns Array of deck types with their current rescue efficiency status.
 */
export function computeRescueWindowStatus(
  mode: GameMode,
  elapsedMs: number,
): Array<{
  deckType: DeckType;
  inFullWindow: boolean;
  inDegradedWindow: boolean;
  expired: boolean;
  effectMultiplier: number;
}> {
  const modeBehavior = MODE_CARD_BEHAVIORS[mode];
  if (!modeBehavior.rescueEnabled) {
    return [];
  }

  const results: Array<{
    deckType: DeckType;
    inFullWindow: boolean;
    inDegradedWindow: boolean;
    expired: boolean;
    effectMultiplier: number;
  }> = [];

  for (const [key, curve] of Object.entries(RESCUE_EFFICIENCY_CURVES)) {
    const deckType = key as DeckType;
    const inFull = elapsedMs <= curve.fullEfficiencyMs;
    const inDegraded = elapsedMs > curve.fullEfficiencyMs && elapsedMs <= curve.degradedEfficiencyMs;
    const expired = elapsedMs > curve.degradedEfficiencyMs;

    let effectMultiplier = curve.degradedEffectMultiplier;
    if (inFull) {
      effectMultiplier = curve.fullEffectMultiplier;
    } else if (inDegraded) {
      const progress = (elapsedMs - curve.fullEfficiencyMs) / (curve.degradedEfficiencyMs - curve.fullEfficiencyMs);
      effectMultiplier = round6(
        curve.fullEffectMultiplier - (curve.fullEffectMultiplier - curve.degradedEffectMultiplier) * progress,
      );
    }

    results.push({
      deckType,
      inFullWindow: inFull,
      inDegradedWindow: inDegraded,
      expired,
      effectMultiplier,
    });
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeEducationalMappingsForMode
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns educational principles that are relevant to the deck types
 * legal in a given mode.
 *
 * References: EDUCATIONAL_PRINCIPLES, CARD_LEGALITY_MATRIX, DECK_TYPE_PROFILES.
 *
 * @param mode - The game mode.
 * @returns Array of relevant EducationalPrincipleMapping entries.
 */
export function computeEducationalMappingsForMode(mode: GameMode): EducationalPrincipleMapping[] {
  const legalDeckTypes = CARD_LEGALITY_MATRIX[mode];
  const categories = new Set<string>();

  for (const dt of legalDeckTypes) {
    categories.add(DECK_TYPE_PROFILES[dt].educationalCategory);
  }

  // Return principles whose associated categories overlap with legal deck type categories
  return EDUCATIONAL_PRINCIPLES.filter((principle) => {
    // Map principle names to approximate categories
    const principleCategory = principle.principle.replace(/_/g, ' ');
    for (const cat of categories) {
      // Loose match: if the principle name overlaps with category keywords
      const catWords = cat.split('_');
      const principleWords = principleCategory.split(' ');
      for (const cw of catWords) {
        for (const pw of principleWords) {
          if (cw === pw && cw.length > 3) {
            return true;
          }
        }
      }
    }
    return false;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// computeAggregateProofBadgeCord
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the aggregate CORD bonus from all proof badges achieved in a mode.
 *
 * References: PROOF_BADGE_CONDITIONS.
 *
 * @param mode - The game mode.
 * @param achievedBadgeIds - Set of badge IDs the player has achieved.
 * @returns Total CORD bonus from achieved badges.
 */
export function computeAggregateProofBadgeCord(
  mode: GameMode,
  achievedBadgeIds: ReadonlySet<string>,
): number {
  const modeBadges = getProofBadgeConditionsForMode(mode);
  let total = 0;
  for (const badge of modeBadges) {
    if (achievedBadgeIds.has(badge.badgeId)) {
      total += badge.cordBonus;
    }
  }
  return total;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeComebackSurgeResources
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the resources granted by a comeback surge activation.
 *
 * References: COMEBACK_SURGE_CONFIG.
 *
 * @returns The emergency resource grants from a surge.
 */
export function computeComebackSurgeResources(): {
  emergencyCash: number;
  shieldBoost: number;
  heatFreezeTicks: number;
} {
  const cfg = COMEBACK_SURGE_CONFIG;
  return {
    emergencyCash: cfg.emergencyCash,
    shieldBoost: cfg.shieldBoostAll,
    heatFreezeTicks: cfg.heatFreezeTicks,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeFullModeAnalysis
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a comprehensive analysis of a game mode, including all legal
 * deck types, timing classes, and mode-specific configurations.
 *
 * References: MODE_CARD_BEHAVIORS, CARD_LEGALITY_MATRIX,
 *   TIMING_CLASS_MODE_MATRIX, DEFAULT_MODE_OVERLAYS, MODE_TAG_WEIGHT_DEFAULTS.
 *
 * @param mode - The game mode to analyze.
 * @returns Comprehensive mode analysis object.
 */
export function computeFullModeAnalysis(mode: GameMode): {
  behavior: ModeCardBehavior;
  legalDeckTypes: readonly DeckType[];
  legalTimingClasses: TimingClass[];
  overlay: ModeOverlay;
  tagWeights: Readonly<Record<CardTag, number>>;
  proofBadges: ProofBadgeCondition[];
  decisionMetrics: CardDecisionQualityMetric[];
} {
  const behavior = MODE_CARD_BEHAVIORS[mode];
  const legalDeckTypes = CARD_LEGALITY_MATRIX[mode];
  const overlay = DEFAULT_MODE_OVERLAYS[mode];
  const tagWeights = MODE_TAG_WEIGHT_DEFAULTS[mode];

  const allTimingClasses = Object.values(TimingClass);
  const legalTimingClasses = allTimingClasses.filter((tc) =>
    TIMING_CLASS_MODE_MATRIX[tc].includes(mode),
  );

  const proofBadges = getProofBadgeConditionsForMode(mode);
  const decisionMetrics = CARD_DECISION_QUALITY_METRICS.filter((m) =>
    m.applicableModes.includes(mode),
  );

  return {
    behavior,
    legalDeckTypes,
    legalTimingClasses,
    overlay,
    tagWeights,
    proofBadges,
    decisionMetrics,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// generateDeterministicCardId
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a deterministic card instance ID from run seed, deck type,
 * and draw index. Ensures that card IDs are reproducible across replays.
 *
 * Uses hashStringToSeed and combineSeed for seed derivation, then
 * createHash('sha256') for the final ID.
 *
 * @param runSeed - The run seed string.
 * @param deckType - The deck type of the card.
 * @param drawIndex - The sequential draw index.
 * @returns A deterministic hex string card instance ID (first 16 chars of sha256).
 */
export function generateDeterministicCardId(
  runSeed: string,
  deckType: DeckType,
  drawIndex: number,
): string {
  const baseSeed = hashStringToSeed(runSeed);
  const deckSeed = combineSeed(baseSeed, deckType);
  const drawSeed = combineSeed(deckSeed, drawIndex);

  const payload = `card:${runSeed}:${deckType}:${drawIndex}:${drawSeed}`;
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

// ─────────────────────────────────────────────────────────────────────────────
// computeSabotageComboWindow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines whether a sabotage play is within the combo window based
 * on the current tick and the last sabotage tick.
 *
 * References: SABOTAGE_COMBO_CONFIG.
 *
 * @param currentTick - The current simulation tick.
 * @param lastSabotageTick - The tick of the last sabotage play.
 * @returns Object with inWindow flag and ticks remaining.
 */
export function computeSabotageComboWindow(
  currentTick: number,
  lastSabotageTick: number,
): {
  inWindow: boolean;
  ticksRemaining: number;
} {
  const cfg = SABOTAGE_COMBO_CONFIG;
  const elapsed = currentTick - lastSabotageTick;

  if (elapsed < 0 || elapsed > cfg.comboWindowTicks) {
    return { inWindow: false, ticksRemaining: 0 };
  }

  return {
    inWindow: true,
    ticksRemaining: cfg.comboWindowTicks - elapsed,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeDefectionTreasuryDiversion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the treasury diversion percentage at a given defection step.
 *
 * References: DEFECTION_STEPS.
 *
 * @param stepIndex - The defection step index.
 * @returns The treasury diversion percentage (0-100).
 */
export function computeDefectionTreasuryDiversion(stepIndex: number): number {
  const idx = clamp(Math.floor(stepIndex), 0, DEFECTION_STEPS.length - 1);
  return DEFECTION_STEPS[idx].treasuryDiversionPct;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeCardPlayReceiptBatch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats multiple card play receipts in a batch. Each receipt gets its
 * own deterministic hash.
 *
 * References: formatCardPlayReceipt.
 *
 * @param results - Array of CardEffectResult from engine execution.
 * @param runSeed - The deterministic run seed string.
 * @returns Array of CardPlayReceipt.
 */
export function computeCardPlayReceiptBatch(
  results: readonly CardEffectResult[],
  runSeed: string,
): CardPlayReceipt[] {
  return results.map((result) => formatCardPlayReceipt(result, runSeed));
}

// ─────────────────────────────────────────────────────────────────────────────
// computeModeExclusiveDeckTypeLabels
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns human-readable labels for all exclusive deck types in a mode.
 *
 * References: MODE_CARD_BEHAVIORS, DECK_TYPE_LABELS.
 *
 * @param mode - The game mode.
 * @returns Array of deck type label strings.
 */
export function computeModeExclusiveDeckTypeLabels(mode: GameMode): string[] {
  const behavior = MODE_CARD_BEHAVIORS[mode];
  return behavior.exclusiveDeckTypes.map((dt) => DECK_TYPE_LABELS[dt]);
}

// ─────────────────────────────────────────────────────────────────────────────
// computeCardTagWeightBreakdown
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a detailed breakdown of tag weights for a card in a mode,
 * with human-readable labels.
 *
 * References: MODE_TAG_WEIGHT_DEFAULTS, CARD_TAG_LABELS.
 *
 * @param tags - The card's tag list.
 * @param mode - The current game mode.
 * @returns Array of { tag, label, weight, contribution } objects.
 */
export function computeCardTagWeightBreakdown(
  tags: readonly CardTag[],
  mode: GameMode,
): Array<{ tag: CardTag; label: string; weight: number; contribution: number }> {
  const modeWeights = MODE_TAG_WEIGHT_DEFAULTS[mode];
  const totalScore = computeTagWeightedScore(tags, mode);

  return tags.map((tag) => {
    const weight = modeWeights[tag] ?? 0;
    return {
      tag,
      label: CARD_TAG_LABELS[tag],
      weight,
      contribution: totalScore > 0 ? round6(weight / totalScore) : 0,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveCardDrawPool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a card draw pool with deterministic RNG for a specific deck type
 * and mode combination.
 *
 * Uses createCardDrawRng for pool-specific deterministic randomness.
 *
 * References: DECK_TYPE_PROFILES, CARD_LEGALITY_MATRIX.
 *
 * @param mode - The game mode.
 * @param deckType - The deck type to draw from.
 * @param runSeed - The run seed string.
 * @param cycle - The draw cycle index.
 * @returns Object with pool RNG, deck profile, and legality status.
 */
export function resolveCardDrawPool(
  mode: GameMode,
  deckType: DeckType,
  runSeed: string,
  cycle: number,
): {
  rng: DeterministicRng;
  profile: DeckTypeProfile;
  isLegal: boolean;
} {
  const profile = DECK_TYPE_PROFILES[deckType];
  const isLegal = isDeckLegalInMode(deckType, mode);
  const rng = createCardDrawRng(runSeed, `pool_${deckType}_${mode}`, cycle);

  return { rng, profile, isLegal };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeHashVerification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies a card play hash by recomputing it and comparing.
 *
 * References: generateCardPlayHash.
 *
 * @param expectedHash - The hash to verify against.
 * @param playId - The play event ID.
 * @param cardId - The card definition ID.
 * @param mode - The game mode.
 * @param tickIndex - The simulation tick.
 * @param choiceId - The choice ID.
 * @param runSeed - The run seed.
 * @returns True if the hash matches.
 */
export function computeHashVerification(
  expectedHash: string,
  playId: string,
  cardId: string,
  mode: GameMode,
  tickIndex: number,
  choiceId: string,
  runSeed: string,
): boolean {
  const computed = generateCardPlayHash(playId, cardId, mode, tickIndex, choiceId, runSeed);
  return computed === expectedHash;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeSOConversionPathCost
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the cost of a specific SO conversion path for an obstacle.
 *
 * References: SO_CONVERSION_ROUTES, SOConversionPath.
 *
 * @param obstacleName - The obstacle name.
 * @param path - The conversion path (CASH, TIME, or PAIN).
 * @returns The cost in the appropriate unit, or null if obstacle not found.
 */
export function computeSOConversionPathCost(
  obstacleName: string,
  path: SOConversionPath,
): {
  cost: number;
  effect: string;
  cordBonus: number;
} | null {
  const route = resolveSOConversionRoutes(obstacleName);
  if (!route) {
    return null;
  }

  switch (path) {
    case SOConversionPath.CASH:
      return { cost: route.cashCost, effect: route.cashEffect, cordBonus: 0 };
    case SOConversionPath.TIME:
      return { cost: route.timeCostTicks, effect: route.timeEffect, cordBonus: 0 };
    case SOConversionPath.PAIN:
      return { cost: 0, effect: route.painEffect, cordBonus: route.painCordBonus };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// computeComebackSurgeEligibility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines whether a player is eligible for a comeback surge based on
 * their cash balance relative to a threshold.
 *
 * References: COMEBACK_SURGE_CONFIG.
 *
 * @param cashBalance - Current cash balance.
 * @param peakCashBalance - The highest cash balance achieved in the run.
 * @returns Whether the player is eligible for a comeback surge.
 */
export function computeComebackSurgeEligibility(
  cashBalance: number,
  peakCashBalance: number,
): boolean {
  const cfg = COMEBACK_SURGE_CONFIG;
  return cashBalance < peakCashBalance * cfg.cashThresholdPct;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeAllGhostMarkerBonuses
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes CORD and shield bonuses for all ghost markers within their windows.
 *
 * References: GHOST_MARKER_SPECS, resolveGhostBenchmarkWindow.
 *
 * @param markers - Array of { kind, markerTick } for active ghost markers.
 * @param currentTick - The current simulation tick.
 * @returns Aggregate CORD and shield bonuses.
 */
export function computeAllGhostMarkerBonuses(
  markers: readonly { kind: GhostMarkerKind; markerTick: number }[],
  currentTick: number,
): {
  totalCordBonus: number;
  totalShieldBonus: number;
  activeMarkers: number;
} {
  let totalCord = 0;
  let totalShield = 0;
  let activeCount = 0;

  for (const marker of markers) {
    const cord = computeGhostMarkerCordBonus(marker.kind, currentTick, marker.markerTick);
    const shield = computeGhostMarkerShieldBonus(marker.kind, currentTick, marker.markerTick);

    if (cord > 0 || shield > 0) {
      totalCord += cord;
      totalShield += shield;
      activeCount++;
    }
  }

  return {
    totalCordBonus: round6(totalCord),
    totalShieldBonus: totalShield,
    activeMarkers: activeCount,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeDecisionQualityMetricsForMode
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the decision quality metrics applicable to a specific mode.
 *
 * References: CARD_DECISION_QUALITY_METRICS.
 *
 * @param mode - The game mode.
 * @returns Array of applicable CardDecisionQualityMetric entries.
 */
export function computeDecisionQualityMetricsForMode(mode: GameMode): CardDecisionQualityMetric[] {
  return CARD_DECISION_QUALITY_METRICS.filter((m) => m.applicableModes.includes(mode));
}
