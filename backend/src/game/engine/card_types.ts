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