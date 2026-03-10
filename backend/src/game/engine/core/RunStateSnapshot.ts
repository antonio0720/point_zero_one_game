// backend/src/game/engine/core/RunStateSnapshot.ts

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — BACKEND ENGINE CORE / RUN STATE SNAPSHOT
 * backend/src/game/engine/core/RunStateSnapshot.ts
 *
 * Purpose
 * -------
 * Authoritative immutable run-state contract for the backend simulation layer.
 *
 * Why this file exists
 * --------------------
 * - assembled ONCE per authoritative tick by the backend orchestrator
 * - every engine reads the same frozen state for deterministic execution
 * - captures all mode-native and proof-native state required by the 7 engines
 * - provides one canonical shape for replay, verification, explorer, and grades
 *
 * Design law
 * ----------
 * - engines NEVER mutate snapshots
 * - engines mutate their own live state / repositories / queues
 * - orchestrator builds a fresh snapshot for each tick
 *
 * This file is intentionally self-contained so it can be adopted first without
 * waiting on adjacent engine-core files.
 *
 * Density6 LLC · Point Zero One · Sovereign Runtime
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/* eslint-disable @typescript-eslint/consistent-type-definitions */

/* -------------------------------------------------------------------------- */
/*  Deep readonly utility                                                     */
/* -------------------------------------------------------------------------- */

export type Primitive =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined;

export type DeepReadonly<T> =
  T extends Primitive
    ? T
    : T extends Date
      ? Readonly<Date>
      : T extends Array<infer U>
        ? ReadonlyArray<DeepReadonly<U>>
        : T extends Map<infer K, infer V>
          ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
          : T extends Set<infer S>
            ? ReadonlySet<DeepReadonly<S>>
            : { readonly [K in keyof T]: DeepReadonly<T[K]> };

/* -------------------------------------------------------------------------- */
/*  Canonical constants                                                       */
/* -------------------------------------------------------------------------- */

export const RUN_MODE_CODES = [
  'solo',
  'pvp',
  'coop',
  'ghost',
] as const;

export type RunModeCode = (typeof RUN_MODE_CODES)[number];

export const RUN_LIFECYCLE_STATES = [
  'IDLE',
  'DRAFT',
  'ACTIVE',
  'FINALIZING',
  'FINALIZED',
  'VOIDED',
] as const;

export type RunLifecycleState = (typeof RUN_LIFECYCLE_STATES)[number];

export const RUN_PHASES = [
  'FOUNDATION',
  'ESCALATION',
  'SOVEREIGNTY',
] as const;

export type RunPhase = (typeof RUN_PHASES)[number];

export const RUN_OUTCOMES = [
  'IN_PROGRESS',
  'FREEDOM',
  'TIMEOUT',
  'BANKRUPT',
  'ABANDONED',
] as const;

export type RunOutcome = (typeof RUN_OUTCOMES)[number];

export const PRESSURE_TIERS = [
  'T0_SOVEREIGN',
  'T1_STABLE',
  'T2_STRESSED',
  'T3_ELEVATED',
  'T4_COLLAPSE_IMMINENT',
] as const;

export type PressureTier = (typeof PRESSURE_TIERS)[number];

export const SHIELD_LAYER_IDS = [
  'L1_LIQUIDITY_BUFFER',
  'L2_CREDIT_LINE',
  'L3_ASSET_FLOOR',
  'L4_NETWORK_CORE',
] as const;

export type ShieldLayerId = (typeof SHIELD_LAYER_IDS)[number];

export const BOT_IDS = [
  'BOT_01_LIQUIDATOR',
  'BOT_02_BUREAUCRAT',
  'BOT_03_MANIPULATOR',
  'BOT_04_CRASH_PROPHET',
  'BOT_05_LEGACY_HEIR',
] as const;

export type BotId = (typeof BOT_IDS)[number];

export const BOT_STATES = [
  'DORMANT',
  'TRACKING',
  'ACTIVE',
  'OVERDRIVE',
  'DISABLED',
] as const;

export type BotState = (typeof BOT_STATES)[number];

export const THREAT_VISIBILITY_STATES = [
  'HIDDEN',
  'OBSCURED',
  'EXPOSED',
] as const;

export type ThreatVisibilityState = (typeof THREAT_VISIBILITY_STATES)[number];

export const TIMING_CLASSES = [
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
] as const;

export type TimingClass = (typeof TIMING_CLASSES)[number];

export const CARD_RARITIES = [
  'COMMON',
  'UNCOMMON',
  'RARE',
  'LEGENDARY',
] as const;

export type CardRarity = (typeof CARD_RARITIES)[number];

export const CARD_DECK_TYPES = [
  'OPPORTUNITY',
  'IPA',
  'FUBAR',
  'MISSED_OPPORTUNITY',
  'PRIVILEGED',
  'SO',
  'SABOTAGE',
  'COUNTER',
  'AID',
  'RESCUE',
  'DISCIPLINE',
  'TRUST',
  'BLUFF',
  'GHOST',
] as const;

export type CardDeckType = (typeof CARD_DECK_TYPES)[number];

export const CARD_COUNTERABILITY = [
  'NONE',
  'SOFT',
  'HARD',
] as const;

export type CardCounterability = (typeof CARD_COUNTERABILITY)[number];

export const CARD_TARGETING = [
  'SELF',
  'OPPONENT',
  'TEAMMATE',
  'TEAM',
  'GLOBAL',
] as const;

export type CardTargeting = (typeof CARD_TARGETING)[number];

export const INTEGRITY_STATUSES = [
  'PENDING',
  'VERIFIED',
  'INTEGRITY_VIOLATION',
  'VOID',
] as const;

export type IntegrityStatus = (typeof INTEGRITY_STATUSES)[number];

export const CORD_GRADES = [
  'A',
  'B',
  'C',
  'D',
  'F',
] as const;

export type CordGrade = (typeof CORD_GRADES)[number];

export const TICK_DURATION_BY_PRESSURE_TIER: Readonly<Record<PressureTier, number>> =
  Object.freeze({
    T0_SOVEREIGN: 2000,
    T1_STABLE: 4000,
    T2_STRESSED: 6000,
    T3_ELEVATED: 8500,
    T4_COLLAPSE_IMMINENT: 12000,
  });

/**
 * Default operational cutovers.
 *
 * These are intentionally configurable because the doctrine specifies tier names
 * and durations, but not exact numeric pressure-score cutover values.
 */
export const DEFAULT_PRESSURE_TIER_CUTOVERS = Object.freeze({
  t0MaxInclusive: 0.15,
  t1MaxInclusive: 0.35,
  t2MaxInclusive: 0.60,
  t3MaxInclusive: 0.85,
});

/**
 * Canonical shield maximums derived from game doctrine.
 */
export const SHIELD_LAYER_MAXIMUMS: Readonly<Record<ShieldLayerId, number>> =
  Object.freeze({
    L1_LIQUIDITY_BUFFER: 100,
    L2_CREDIT_LINE: 80,
    L3_ASSET_FLOOR: 60,
    L4_NETWORK_CORE: 40,
  });

export const DEFAULT_FREEDOM_THRESHOLD = 100_000;
export const DEFAULT_SEASON_TICK_BUDGET = 180;
export const DEFAULT_STARTING_CASH = 10_000;
export const DEFAULT_STARTING_MONTHLY_INCOME = 2_500;
export const DEFAULT_STARTING_MONTHLY_EXPENSES = 2_100;

/* -------------------------------------------------------------------------- */
/*  Shared scalar-safe helpers                                                */
/* -------------------------------------------------------------------------- */

function assertNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }
  return value.trim();
}

function assertFiniteNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number.`);
  }
  return value;
}

function assertNonNegativeNumber(value: unknown, fieldName: string): number {
  const normalized = assertFiniteNumber(value, fieldName);
  if (normalized < 0) {
    throw new Error(`${fieldName} must be >= 0.`);
  }
  return normalized;
}

function assertInteger(value: unknown, fieldName: string): number {
  const normalized = assertFiniteNumber(value, fieldName);
  if (!Number.isInteger(normalized)) {
    throw new Error(`${fieldName} must be an integer.`);
  }
  return normalized;
}

function assertNonNegativeInteger(value: unknown, fieldName: string): number {
  const normalized = assertInteger(value, fieldName);
  if (normalized < 0) {
    throw new Error(`${fieldName} must be >= 0.`);
  }
  return normalized;
}

function uniqueSortedStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

function shallowCloneRecord<TValue>(
  input: Record<string, TValue>,
): Record<string, TValue> {
  return { ...input };
}

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (
    value === null ||
    value === undefined ||
    typeof value !== 'object' ||
    Object.isFrozen(value)
  ) {
    return value as DeepReadonly<T>;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      deepFreeze(entry);
    }
    return Object.freeze(value) as DeepReadonly<T>;
  }

  for (const key of Object.keys(value as Record<string, unknown>)) {
    const entry = (value as Record<string, unknown>)[key];
    deepFreeze(entry);
  }

  return Object.freeze(value) as DeepReadonly<T>;
}

function computeCashflow(
  monthlyIncome: number,
  monthlyExpenses: number,
): number {
  return monthlyIncome - monthlyExpenses;
}

function roundTo(value: number, decimals: number = 6): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/* -------------------------------------------------------------------------- */
/*  Runtime contracts                                                         */
/* -------------------------------------------------------------------------- */

export interface TimingWindowSnapshot {
  id: string;
  timingClass: TimingClass;
  source:
    | 'ENGINE'
    | 'CARD'
    | 'MODE'
    | 'SYSTEM';
  opensAtTick: number;
  closesAtTick: number;
  hardDeadlineMs?: number | null;
  targetPlayerId?: string | null;
  notes?: string | null;
}

export interface ShieldLayerSnapshot {
  id: ShieldLayerId;
  label: string;
  currentIntegrity: number;
  maxIntegrity: number;
  breached: boolean;
  regenActive: boolean;
  lastBreachTick: number | null;
  blockedDamageThisTick: number;
  blockedDamageLifetime: number;
}

export interface ShieldAggregateSnapshot {
  layers: Record<ShieldLayerId, ShieldLayerSnapshot>;
  overallIntegrityPct: number;
  breachedLayerIds: readonly ShieldLayerId[];
  l4BreachCount: number;
}

export interface BotRuntimeSnapshot {
  id: BotId;
  state: BotState;
  ticksInState: number;
  isCritical: boolean;
  preloadedArrivalTick: number | null;
  lastAttackTick: number | null;
  pendingAttackIds: readonly string[];
  extractionUnlocked: boolean;
}

export interface ThreatSnapshot {
  id: string;
  source:
    | 'BOT'
    | 'CARD'
    | 'MODE'
    | 'MACRO'
    | 'SYSTEM';
  severity: number;
  visibility: ThreatVisibilityState;
  arrivesAtTick: number;
  targetedPlayerIds: readonly string[];
  extraction: boolean;
  tags: readonly string[];
  payloadChecksum?: string | null;
}

export interface CascadeChainSnapshot {
  id: string;
  sourceThreatId?: string | null;
  active: boolean;
  positive: boolean;
  intercepted: boolean;
  currentDepth: number;
  nextTriggerTick: number | null;
  tags: readonly string[];
}

export interface DecisionRecordSnapshot {
  id: string;
  tickIndex: number;
  actorPlayerId: string;
  action:
    | 'PLAY_CARD'
    | 'HOLD'
    | 'PASS'
    | 'COUNTER'
    | 'RESCUE'
    | 'AID'
    | 'TARGET'
    | 'BUY'
    | 'SELL'
    | 'CUSTOM';
  cardId?: string | null;
  timingClass: TimingClass;
  startedAtMs: number;
  resolvedAtMs: number | null;
  durationMs: number | null;
  legal: boolean;
  outcome:
    | 'SUCCESS'
    | 'FAILED'
    | 'EXPIRED'
    | 'COUNTERED'
    | 'SKIPPED';
  pressureTierAtDecision: PressureTier;
  notes?: string | null;
}

export interface CardInstanceSnapshot {
  instanceId: string;
  cardId: string;
  name: string;
  deckType: CardDeckType;
  rarity: CardRarity;
  timingClass: TimingClass;
  tags: readonly string[];
  baseCost: number;
  currentCost: number;
  autoResolve: boolean;
  counterability: CardCounterability;
  targeting: CardTargeting;
  decisionTimerOverrideMs: number | null;
  decayTicksRemaining: number | null;
  modeLegal: readonly RunModeCode[];
  educationalTag: string;
  overlayAppliedForMode?: RunModeCode | null;
}

export interface CardZoneSnapshot {
  hand: readonly CardInstanceSnapshot[];
  drawQueueDepth: number;
  discardQueueDepth: number;
  activeTimingWindows: readonly TimingWindowSnapshot[];
  forcedCardQueueDepth: number;
}

export interface PlayerRuntimeSnapshot {
  playerId: string;
  displayName: string;
  role?: string | null;
  cashBalance: number;
  netWorth: number;
  shieldHealthNormalized: number;
  pressureScore: number;
  trustScore?: number | null;
  legendCordTarget?: number | null;
  isDefected?: boolean;
  isEliminated?: boolean;
}

export interface TimeRuntimeSnapshot {
  tickIndex: number;
  seasonTickBudget: number;
  ticksRemaining: number;
  currentTickDurationMs: number;
  pressureTier: PressureTier;
  phase: RunPhase;
  phaseStartedAtTick: number;
  activeDecisionWindowCount: number;
}

export interface EconomyRuntimeSnapshot {
  cashBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  cashflow: number;
  netWorth: number;
  liquidReserves: number;
  debtOutstanding: number;
  assetValue: number;
  opportunityCostDamage: number;
  isolationTaxAccrued: number;
}

export interface PressureRuntimeSnapshot {
  score: number;
  tier: PressureTier;
  ticksWithoutIncomeGrowth: number;
  pressureSurvivedTicksHighOrHigher: number;
  lastTierTransitionTick: number | null;
}

export interface TensionRuntimeSnapshot {
  score: number;
  anticipationQueueDepth: number;
  visibleThreatCount: number;
  threatVisibilityState: ThreatVisibilityState;
  activeThreats: readonly ThreatSnapshot[];
}

export interface BattleRuntimeSnapshot {
  haterHeat: number;
  activeBotCount: number;
  haterAttemptsThisTick: number;
  haterBlockedThisTick: number;
  haterDamagedThisTick: number;
  activeThreatCardCount: number;
  bots: Readonly<Record<BotId, BotRuntimeSnapshot>>;
}

export interface CascadeRuntimeSnapshot {
  activeChainCount: number;
  triggeredThisTick: number;
  brokenThisTick: number;
  brokenLifetime: number;
  activeChains: readonly CascadeChainSnapshot[];
  positiveChainCount: number;
}

export interface EmpireModeState {
  advantageCardId: string | null;
  handicapId: string | null;
  holdCountUsed: number;
  holdsRemaining: number;
  bleedModeActive: boolean;
  isolationTaxTicks: number;
  pressureJournalEnabled: boolean;
  personalMasteryTier: number;
  comebackSurgeActive: boolean;
  voidScarPeakNetWorth: number | null;
}

export interface PredatorModeState {
  rivalPlayerId: string | null;
  battleBudget: number;
  extractionWindowOpen: boolean;
  extractionWindowClosesAtTick: number | null;
  firstBloodClaimedByPlayerId: string | null;
  perfectCounterCount: number;
  spectatorsAllowed: boolean;
}

export interface SyndicateModeState {
  teamId: string | null;
  sharedTreasuryBalance: number;
  trustScore: number;
  rolesPresent: readonly string[];
  defectionWindowOpen: boolean;
  defectedPlayerIds: readonly string[];
  activeAidRequestIds: readonly string[];
  syndicateDuelActive: boolean;
}

export interface PhantomModeState {
  legendRunId: string | null;
  legendCordTarget: number | null;
  challengerRunIds: readonly string[];
  currentGapPct: number | null;
  activeMarkerTicks: readonly number[];
  markerWindowOpen: boolean;
  legendDecayDays: number;
  dynastyEligible: boolean;
}

export interface SovereigntyMetricsSnapshot {
  decisionSpeedScore: number;
  shieldsMaintainedPct: number;
  haterSabotagesBlocked: number;
  cascadeChainsBroken: number;
  pressureSurvivedScore: number;
  clutchDecisionCountUnder2s: number;
  noHoldEligible: boolean;
  sweepEligible: boolean;
  exterminatorEligible: boolean;
  betrayalSurvivorEligible: boolean;
  fullSynergyEligible: boolean;
  ghostSlayerEligible: boolean;
  tickStreamChecksum: string;
  proofHash: string | null;
  cord: number | null;
  grade: CordGrade | null;
  integrityStatus: IntegrityStatus;
}

export interface SnapshotStatus {
  lifecycleState: RunLifecycleState;
  outcome: RunOutcome;
  hasCrossedFreedomThreshold: boolean;
  isBankrupt: boolean;
  isTimedOut: boolean;
  hasAnyBreachedLayer: boolean;
}

export interface RunStateSnapshot {
  schemaVersion: 1;
  runId: string;
  userId: string;
  seed: string;
  mode: RunModeCode;
  localPlayerId: string;
  createdAtMs: number;
  updatedAtMs: number;
  freedomThreshold: number;
  eventSequence: number;
  time: TimeRuntimeSnapshot;
  economy: EconomyRuntimeSnapshot;
  pressure: PressureRuntimeSnapshot;
  tension: TensionRuntimeSnapshot;
  shields: ShieldAggregateSnapshot;
  battle: BattleRuntimeSnapshot;
  cascades: CascadeRuntimeSnapshot;
  cards: CardZoneSnapshot;
  players: readonly PlayerRuntimeSnapshot[];
  empire: EmpireModeState | null;
  predator: PredatorModeState | null;
  syndicate: SyndicateModeState | null;
  phantom: PhantomModeState | null;
  sovereignty: SovereigntyMetricsSnapshot;
  decisionsThisTick: readonly DecisionRecordSnapshot[];
  status: SnapshotStatus;
}

/* -------------------------------------------------------------------------- */
/*  Live mutable state contract                                               */
/* -------------------------------------------------------------------------- */

export interface LiveRunState
  extends Omit<
    RunStateSnapshot,
    | 'schemaVersion'
    | 'decisionsThisTick'
    | 'players'
    | 'cards'
    | 'battle'
    | 'tension'
    | 'cascades'
    | 'shields'
    | 'status'
  > {
  time: TimeRuntimeSnapshot;
  economy: EconomyRuntimeSnapshot;
  pressure: PressureRuntimeSnapshot;
  tension: TensionRuntimeSnapshot;
  shields: ShieldAggregateSnapshot;
  battle: BattleRuntimeSnapshot;
  cascades: CascadeRuntimeSnapshot;
  cards: CardZoneSnapshot;
  players: PlayerRuntimeSnapshot[];
  decisionsThisTick: DecisionRecordSnapshot[];
}

/* -------------------------------------------------------------------------- */
/*  Snapshot derivation helpers                                               */
/* -------------------------------------------------------------------------- */

export function computePressureTier(
  pressureScore: number,
  cutovers: typeof DEFAULT_PRESSURE_TIER_CUTOVERS = DEFAULT_PRESSURE_TIER_CUTOVERS,
): PressureTier {
  const score = assertNonNegativeNumber(pressureScore, 'pressureScore');

  if (score <= cutovers.t0MaxInclusive) {
    return 'T0_SOVEREIGN';
  }

  if (score <= cutovers.t1MaxInclusive) {
    return 'T1_STABLE';
  }

  if (score <= cutovers.t2MaxInclusive) {
    return 'T2_STRESSED';
  }

  if (score <= cutovers.t3MaxInclusive) {
    return 'T3_ELEVATED';
  }

  return 'T4_COLLAPSE_IMMINENT';
}

export function getTickDurationMsForPressureTier(
  pressureTier: PressureTier,
): number {
  return TICK_DURATION_BY_PRESSURE_TIER[pressureTier];
}

export function computeShieldAggregate(
  layers: Record<ShieldLayerId, ShieldLayerSnapshot>,
): ShieldAggregateSnapshot {
  let totalCurrent = 0;
  let totalMax = 0;
  let l4BreachCount = 0;
  const breachedLayerIds: ShieldLayerId[] = [];

  for (const layerId of SHIELD_LAYER_IDS) {
    const layer = layers[layerId];
    totalCurrent += layer.currentIntegrity;
    totalMax += layer.maxIntegrity;

    if (layer.breached) {
      breachedLayerIds.push(layer.id);
    }

    if (layer.id === 'L4_NETWORK_CORE' && layer.breached) {
      l4BreachCount += 1;
    }
  }

  return {
    layers,
    overallIntegrityPct:
      totalMax > 0 ? roundTo(totalCurrent / totalMax) : 0,
    breachedLayerIds: Object.freeze(breachedLayerIds),
    l4BreachCount,
  };
}

export function computePressureSurvivedScore(
  ticksHighOrHigher: number,
  seasonTickBudget: number,
): number {
  const safeBudget = Math.max(1, seasonTickBudget);
  return roundTo(
    Math.max(0, ticksHighOrHigher) / safeBudget,
    6,
  );
}

export function computeHasCrossedFreedomThreshold(
  netWorth: number,
  freedomThreshold: number,
): boolean {
  return netWorth >= freedomThreshold;
}

export function computeIsBankrupt(
  cashBalance: number,
  cashflow: number,
): boolean {
  return cashBalance < 0 && cashflow < 0;
}

export function computeIsTimedOut(
  ticksRemaining: number,
): boolean {
  return ticksRemaining <= 0;
}

export function computeStatus(live: LiveRunState): SnapshotStatus {
  const hasCrossedFreedomThreshold = computeHasCrossedFreedomThreshold(
    live.economy.netWorth,
    live.freedomThreshold,
  );

  const isBankrupt = computeIsBankrupt(
    live.economy.cashBalance,
    live.economy.cashflow,
  );

  const isTimedOut = computeIsTimedOut(live.time.ticksRemaining);

  const hasAnyBreachedLayer = live.shields.breachedLayerIds.length > 0;

  let outcome: RunOutcome = live.status?.outcome ?? 'IN_PROGRESS';

  if (live.lifecycleState === 'FINALIZED' || live.lifecycleState === 'FINALIZING') {
    if (hasCrossedFreedomThreshold) {
      outcome = 'FREEDOM';
    } else if (isBankrupt) {
      outcome = 'BANKRUPT';
    } else if (isTimedOut) {
      outcome = 'TIMEOUT';
    } else if (live.lifecycleState === 'VOIDED') {
      outcome = 'ABANDONED';
    }
  } else {
    if (hasCrossedFreedomThreshold) {
      outcome = 'FREEDOM';
    } else if (isBankrupt) {
      outcome = 'BANKRUPT';
    } else if (isTimedOut) {
      outcome = 'TIMEOUT';
    }
  }

  return {
    lifecycleState: live.lifecycleState,
    outcome,
    hasCrossedFreedomThreshold,
    isBankrupt,
    isTimedOut,
    hasAnyBreachedLayer,
  };
}

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

export function assertRunStateSnapshotIntegrity(
  live: LiveRunState,
): void {
  assertNonEmptyString(live.runId, 'runId');
  assertNonEmptyString(live.userId, 'userId');
  assertNonEmptyString(live.seed, 'seed');
  assertNonEmptyString(live.localPlayerId, 'localPlayerId');

  assertFiniteNumber(live.createdAtMs, 'createdAtMs');
  assertFiniteNumber(live.updatedAtMs, 'updatedAtMs');
  assertNonNegativeNumber(live.freedomThreshold, 'freedomThreshold');
  assertNonNegativeInteger(live.eventSequence, 'eventSequence');

  assertNonNegativeInteger(live.time.tickIndex, 'time.tickIndex');
  assertNonNegativeInteger(
    live.time.seasonTickBudget,
    'time.seasonTickBudget',
  );
  assertInteger(live.time.ticksRemaining, 'time.ticksRemaining');
  assertNonNegativeNumber(
    live.time.currentTickDurationMs,
    'time.currentTickDurationMs',
  );

  assertFiniteNumber(live.economy.cashBalance, 'economy.cashBalance');
  assertFiniteNumber(live.economy.monthlyIncome, 'economy.monthlyIncome');
  assertFiniteNumber(
    live.economy.monthlyExpenses,
    'economy.monthlyExpenses',
  );
  assertFiniteNumber(live.economy.netWorth, 'economy.netWorth');
  assertNonNegativeNumber(
    live.economy.liquidReserves,
    'economy.liquidReserves',
  );
  assertNonNegativeNumber(
    live.economy.debtOutstanding,
    'economy.debtOutstanding',
  );
  assertNonNegativeNumber(live.economy.assetValue, 'economy.assetValue');

  assertNonNegativeNumber(live.pressure.score, 'pressure.score');
  assertNonNegativeNumber(live.tension.score, 'tension.score');
  assertNonNegativeNumber(live.battle.haterHeat, 'battle.haterHeat');

  for (const layerId of SHIELD_LAYER_IDS) {
    const layer = live.shields.layers[layerId];
    if (!layer) {
      throw new Error(`shields.layers.${layerId} is missing.`);
    }

    assertNonNegativeNumber(
      layer.currentIntegrity,
      `shields.layers.${layerId}.currentIntegrity`,
    );
    assertNonNegativeNumber(
      layer.maxIntegrity,
      `shields.layers.${layerId}.maxIntegrity`,
    );

    if (layer.currentIntegrity > layer.maxIntegrity) {
      throw new Error(
        `shields.layers.${layerId}.currentIntegrity cannot exceed maxIntegrity.`,
      );
    }
  }

  const playerIds = new Set<string>();
  for (const player of live.players) {
    const playerId = assertNonEmptyString(player.playerId, 'players[].playerId');
    if (playerIds.has(playerId)) {
      throw new Error(`Duplicate playerId detected in players: ${playerId}`);
    }
    playerIds.add(playerId);
  }

  if (!playerIds.has(live.localPlayerId)) {
    throw new Error(
      `localPlayerId "${live.localPlayerId}" must exist in players[].playerId.`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  Normalization                                                             */
/* -------------------------------------------------------------------------- */

function normalizeTimingWindows(
  windows: readonly TimingWindowSnapshot[],
): readonly TimingWindowSnapshot[] {
  const normalized = windows
    .map((window) => ({
      ...window,
      id: assertNonEmptyString(window.id, 'timingWindow.id'),
      opensAtTick: assertInteger(window.opensAtTick, 'timingWindow.opensAtTick'),
      closesAtTick: assertInteger(
        window.closesAtTick,
        'timingWindow.closesAtTick',
      ),
      hardDeadlineMs:
        window.hardDeadlineMs === null || window.hardDeadlineMs === undefined
          ? null
          : assertNonNegativeNumber(
              window.hardDeadlineMs,
              'timingWindow.hardDeadlineMs',
            ),
      targetPlayerId:
        window.targetPlayerId === undefined ? null : window.targetPlayerId,
      notes: window.notes === undefined ? null : window.notes,
    }))
    .sort((a, b) => {
      if (a.opensAtTick !== b.opensAtTick) {
        return a.opensAtTick - b.opensAtTick;
      }
      return a.id.localeCompare(b.id);
    });

  return Object.freeze(normalized);
}

function normalizePlayerSnapshots(
  players: readonly PlayerRuntimeSnapshot[],
): readonly PlayerRuntimeSnapshot[] {
  return Object.freeze(
    [...players]
      .map((player) => ({
        ...player,
        playerId: assertNonEmptyString(player.playerId, 'player.playerId'),
        displayName: assertNonEmptyString(
          player.displayName,
          'player.displayName',
        ),
        cashBalance: assertFiniteNumber(
          player.cashBalance,
          'player.cashBalance',
        ),
        netWorth: assertFiniteNumber(player.netWorth, 'player.netWorth'),
        shieldHealthNormalized: roundTo(
          Math.max(0, Math.min(1, player.shieldHealthNormalized)),
        ),
        pressureScore: assertNonNegativeNumber(
          player.pressureScore,
          'player.pressureScore',
        ),
        trustScore:
          player.trustScore === undefined ? null : player.trustScore,
        legendCordTarget:
          player.legendCordTarget === undefined ? null : player.legendCordTarget,
        role: player.role ?? null,
      }))
      .sort((a, b) => a.playerId.localeCompare(b.playerId)),
  );
}

function normalizeDecisions(
  decisions: readonly DecisionRecordSnapshot[],
): readonly DecisionRecordSnapshot[] {
  return Object.freeze(
    [...decisions]
      .map((decision) => ({
        ...decision,
        id: assertNonEmptyString(decision.id, 'decision.id'),
        actorPlayerId: assertNonEmptyString(
          decision.actorPlayerId,
          'decision.actorPlayerId',
        ),
        tickIndex: assertNonNegativeInteger(
          decision.tickIndex,
          'decision.tickIndex',
        ),
        startedAtMs: assertNonNegativeNumber(
          decision.startedAtMs,
          'decision.startedAtMs',
        ),
        resolvedAtMs:
          decision.resolvedAtMs === undefined ? null : decision.resolvedAtMs,
        durationMs:
          decision.durationMs === undefined ? null : decision.durationMs,
        cardId: decision.cardId ?? null,
        notes: decision.notes ?? null,
      }))
      .sort((a, b) => {
        if (a.tickIndex !== b.tickIndex) {
          return a.tickIndex - b.tickIndex;
        }
        return a.id.localeCompare(b.id);
      }),
  );
}

function normalizeCards(
  cards: CardZoneSnapshot,
): CardZoneSnapshot {
  return {
    hand: Object.freeze(
      [...cards.hand]
        .map((card) => ({
          ...card,
          instanceId: assertNonEmptyString(card.instanceId, 'card.instanceId'),
          cardId: assertNonEmptyString(card.cardId, 'card.cardId'),
          name: assertNonEmptyString(card.name, 'card.name'),
          baseCost: assertNonNegativeNumber(card.baseCost, 'card.baseCost'),
          currentCost: assertNonNegativeNumber(
            card.currentCost,
            'card.currentCost',
          ),
          tags: uniqueSortedStrings(card.tags),
          modeLegal: Object.freeze([...card.modeLegal].sort()),
          educationalTag: assertNonEmptyString(
            card.educationalTag,
            'card.educationalTag',
          ),
          decisionTimerOverrideMs:
            card.decisionTimerOverrideMs === undefined
              ? null
              : card.decisionTimerOverrideMs,
          decayTicksRemaining:
            card.decayTicksRemaining === undefined ? null : card.decayTicksRemaining,
          overlayAppliedForMode:
            card.overlayAppliedForMode === undefined
              ? null
              : card.overlayAppliedForMode,
        }))
        .sort((a, b) => a.instanceId.localeCompare(b.instanceId)),
    ),
    drawQueueDepth: assertNonNegativeInteger(
      cards.drawQueueDepth,
      'cards.drawQueueDepth',
    ),
    discardQueueDepth: assertNonNegativeInteger(
      cards.discardQueueDepth,
      'cards.discardQueueDepth',
    ),
    activeTimingWindows: normalizeTimingWindows(cards.activeTimingWindows),
    forcedCardQueueDepth: assertNonNegativeInteger(
      cards.forcedCardQueueDepth,
      'cards.forcedCardQueueDepth',
    ),
  };
}

function normalizeBattle(
  battle: BattleRuntimeSnapshot,
): BattleRuntimeSnapshot {
  const bots: Record<BotId, BotRuntimeSnapshot> = {} as Record<
    BotId,
    BotRuntimeSnapshot
  >;

  for (const botId of BOT_IDS) {
    const bot = battle.bots[botId];
    if (!bot) {
      throw new Error(`battle.bots.${botId} is missing.`);
    }

    bots[botId] = {
      ...bot,
      pendingAttackIds: Object.freeze([...bot.pendingAttackIds].sort()),
    };
  }

  return {
    ...battle,
    haterHeat: assertNonNegativeNumber(battle.haterHeat, 'battle.haterHeat'),
    activeBotCount: assertNonNegativeInteger(
      battle.activeBotCount,
      'battle.activeBotCount',
    ),
    haterAttemptsThisTick: assertNonNegativeInteger(
      battle.haterAttemptsThisTick,
      'battle.haterAttemptsThisTick',
    ),
    haterBlockedThisTick: assertNonNegativeInteger(
      battle.haterBlockedThisTick,
      'battle.haterBlockedThisTick',
    ),
    haterDamagedThisTick: assertNonNegativeInteger(
      battle.haterDamagedThisTick,
      'battle.haterDamagedThisTick',
    ),
    activeThreatCardCount: assertNonNegativeInteger(
      battle.activeThreatCardCount,
      'battle.activeThreatCardCount',
    ),
    bots,
  };
}

function normalizeShields(
  shields: ShieldAggregateSnapshot,
): ShieldAggregateSnapshot {
  const layers: Record<ShieldLayerId, ShieldLayerSnapshot> = {} as Record<
    ShieldLayerId,
    ShieldLayerSnapshot
  >;

  for (const layerId of SHIELD_LAYER_IDS) {
    const layer = shields.layers[layerId];
    if (!layer) {
      throw new Error(`shields.layers.${layerId} is missing.`);
    }

    layers[layerId] = {
      ...layer,
      currentIntegrity: assertNonNegativeNumber(
        layer.currentIntegrity,
        `shields.layers.${layerId}.currentIntegrity`,
      ),
      maxIntegrity: assertNonNegativeNumber(
        layer.maxIntegrity,
        `shields.layers.${layerId}.maxIntegrity`,
      ),
      blockedDamageThisTick: assertNonNegativeNumber(
        layer.blockedDamageThisTick,
        `shields.layers.${layerId}.blockedDamageThisTick`,
      ),
      blockedDamageLifetime: assertNonNegativeNumber(
        layer.blockedDamageLifetime,
        `shields.layers.${layerId}.blockedDamageLifetime`,
      ),
      lastBreachTick:
        layer.lastBreachTick === undefined ? null : layer.lastBreachTick,
    };
  }

  return computeShieldAggregate(layers);
}

function normalizeThreats(
  threats: readonly ThreatSnapshot[],
): readonly ThreatSnapshot[] {
  return Object.freeze(
    [...threats]
      .map((threat) => ({
        ...threat,
        id: assertNonEmptyString(threat.id, 'threat.id'),
        severity: assertNonNegativeNumber(threat.severity, 'threat.severity'),
        arrivesAtTick: assertInteger(threat.arrivesAtTick, 'threat.arrivesAtTick'),
        targetedPlayerIds: Object.freeze([...threat.targetedPlayerIds].sort()),
        tags: uniqueSortedStrings(threat.tags),
        payloadChecksum:
          threat.payloadChecksum === undefined ? null : threat.payloadChecksum,
      }))
      .sort((a, b) => {
        if (a.arrivesAtTick !== b.arrivesAtTick) {
          return a.arrivesAtTick - b.arrivesAtTick;
        }
        return a.id.localeCompare(b.id);
      }),
  );
}

function normalizeCascades(
  cascades: CascadeRuntimeSnapshot,
): CascadeRuntimeSnapshot {
  return {
    ...cascades,
    activeChainCount: assertNonNegativeInteger(
      cascades.activeChainCount,
      'cascades.activeChainCount',
    ),
    triggeredThisTick: assertNonNegativeInteger(
      cascades.triggeredThisTick,
      'cascades.triggeredThisTick',
    ),
    brokenThisTick: assertNonNegativeInteger(
      cascades.brokenThisTick,
      'cascades.brokenThisTick',
    ),
    brokenLifetime: assertNonNegativeInteger(
      cascades.brokenLifetime,
      'cascades.brokenLifetime',
    ),
    positiveChainCount: assertNonNegativeInteger(
      cascades.positiveChainCount,
      'cascades.positiveChainCount',
    ),
    activeChains: Object.freeze(
      [...cascades.activeChains]
        .map((chain) => ({
          ...chain,
          id: assertNonEmptyString(chain.id, 'cascade.id'),
          currentDepth: assertNonNegativeInteger(
            chain.currentDepth,
            'cascade.currentDepth',
          ),
          nextTriggerTick:
            chain.nextTriggerTick === undefined ? null : chain.nextTriggerTick,
          sourceThreatId:
            chain.sourceThreatId === undefined ? null : chain.sourceThreatId,
          tags: uniqueSortedStrings(chain.tags),
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    ),
  };
}

/* -------------------------------------------------------------------------- */
/*  Builders                                                                  */
/* -------------------------------------------------------------------------- */

export function buildRunStateSnapshot(
  liveState: LiveRunState,
): DeepReadonly<RunStateSnapshot> {
  assertRunStateSnapshotIntegrity(liveState);

  const cards = normalizeCards(liveState.cards);
  const shields = normalizeShields(liveState.shields);
  const battle = normalizeBattle(liveState.battle);
  const activeThreats = normalizeThreats(liveState.tension.activeThreats);
  const cascades = normalizeCascades(liveState.cascades);
  const players = normalizePlayerSnapshots(liveState.players);
  const decisionsThisTick = normalizeDecisions(liveState.decisionsThisTick);

  const pressureTier =
    liveState.pressure.tier ??
    computePressureTier(liveState.pressure.score);

  const time: TimeRuntimeSnapshot = {
    ...liveState.time,
    pressureTier,
    currentTickDurationMs:
      liveState.time.currentTickDurationMs > 0
        ? liveState.time.currentTickDurationMs
        : getTickDurationMsForPressureTier(pressureTier),
  };

  const economy: EconomyRuntimeSnapshot = {
    ...liveState.economy,
    cashflow: computeCashflow(
      liveState.economy.monthlyIncome,
      liveState.economy.monthlyExpenses,
    ),
  };

  const pressure: PressureRuntimeSnapshot = {
    ...liveState.pressure,
    tier: pressureTier,
    pressureSurvivedScore: computePressureSurvivedScore(
      liveState.pressure.pressureSurvivedTicksHighOrHigher,
      time.seasonTickBudget,
    ),
  };

  const tension: TensionRuntimeSnapshot = {
    ...liveState.tension,
    activeThreats,
    visibleThreatCount: activeThreats.filter(
      (threat) => threat.visibility !== 'HIDDEN',
    ).length,
  };

  const sovereignty: SovereigntyMetricsSnapshot = {
    ...liveState.sovereignty,
    shieldsMaintainedPct: roundTo(shields.overallIntegrityPct),
    pressureSurvivedScore: pressure.pressureSurvivedScore,
    proofHash: liveState.sovereignty.proofHash ?? null,
    cord: liveState.sovereignty.cord ?? null,
    grade: liveState.sovereignty.grade ?? null,
  };

  const normalized: RunStateSnapshot = {
    schemaVersion: 1,
    runId: liveState.runId,
    userId: liveState.userId,
    seed: liveState.seed,
    mode: liveState.mode,
    localPlayerId: liveState.localPlayerId,
    createdAtMs: liveState.createdAtMs,
    updatedAtMs: liveState.updatedAtMs,
    freedomThreshold: liveState.freedomThreshold,
    eventSequence: liveState.eventSequence,
    time,
    economy,
    pressure,
    tension,
    shields,
    battle,
    cascades,
    cards,
    players,
    empire: liveState.empire
      ? {
          ...liveState.empire,
          advantageCardId: liveState.empire.advantageCardId ?? null,
          handicapId: liveState.empire.handicapId ?? null,
          voidScarPeakNetWorth:
            liveState.empire.voidScarPeakNetWorth ?? null,
        }
      : null,
    predator: liveState.predator
      ? {
          ...liveState.predator,
          rivalPlayerId: liveState.predator.rivalPlayerId ?? null,
          extractionWindowClosesAtTick:
            liveState.predator.extractionWindowClosesAtTick ?? null,
          firstBloodClaimedByPlayerId:
            liveState.predator.firstBloodClaimedByPlayerId ?? null,
        }
      : null,
    syndicate: liveState.syndicate
      ? {
          ...liveState.syndicate,
          teamId: liveState.syndicate.teamId ?? null,
          rolesPresent: uniqueSortedStrings(liveState.syndicate.rolesPresent),
          defectedPlayerIds: uniqueSortedStrings(
            liveState.syndicate.defectedPlayerIds,
          ),
          activeAidRequestIds: uniqueSortedStrings(
            liveState.syndicate.activeAidRequestIds,
          ),
        }
      : null,
    phantom: liveState.phantom
      ? {
          ...liveState.phantom,
          legendRunId: liveState.phantom.legendRunId ?? null,
          legendCordTarget: liveState.phantom.legendCordTarget ?? null,
          challengerRunIds: uniqueSortedStrings(
            liveState.phantom.challengerRunIds,
          ),
          activeMarkerTicks: Object.freeze(
            [...liveState.phantom.activeMarkerTicks].sort((a, b) => a - b),
          ),
          currentGapPct:
            liveState.phantom.currentGapPct === undefined
              ? null
              : liveState.phantom.currentGapPct,
        }
      : null,
    sovereignty,
    decisionsThisTick,
    status: {
      lifecycleState: liveState.lifecycleState,
      outcome: 'IN_PROGRESS',
      hasCrossedFreedomThreshold: false,
      isBankrupt: false,
      isTimedOut: false,
      hasAnyBreachedLayer: false,
    },
  };

  normalized.status = computeStatus({
    ...liveState,
    time,
    economy,
    pressure,
    tension,
    shields,
    battle,
    cascades,
    cards,
    players: [...players],
    decisionsThisTick: [...decisionsThisTick],
    sovereignty,
  });

  return deepFreeze(normalized);
}

/* -------------------------------------------------------------------------- */
/*  Initial-state factory                                                     */
/* -------------------------------------------------------------------------- */

export interface CreateInitialRunStateInput {
  runId: string;
  userId: string;
  seed: string;
  mode: RunModeCode;
  localPlayerId: string;
  localPlayerDisplayName: string;
  createdAtMs?: number;
  seasonTickBudget?: number;
  freedomThreshold?: number;
  startingCashBalance?: number;
  startingMonthlyIncome?: number;
  startingMonthlyExpenses?: number;
  startingNetWorth?: number;
  startingLiquidReserves?: number;
  startingDebtOutstanding?: number;
  startingAssetValue?: number;
  pressureJournalEnabled?: boolean;
  bleedModeActive?: boolean;
  battleBudget?: number;
  sharedTreasuryBalance?: number;
  trustScore?: number;
  legendRunId?: string;
  legendCordTarget?: number;
}

function createDefaultShieldLayers(): Record<ShieldLayerId, ShieldLayerSnapshot> {
  return {
    L1_LIQUIDITY_BUFFER: {
      id: 'L1_LIQUIDITY_BUFFER',
      label: 'Liquidity Buffer',
      currentIntegrity: SHIELD_LAYER_MAXIMUMS.L1_LIQUIDITY_BUFFER,
      maxIntegrity: SHIELD_LAYER_MAXIMUMS.L1_LIQUIDITY_BUFFER,
      breached: false,
      regenActive: true,
      lastBreachTick: null,
      blockedDamageThisTick: 0,
      blockedDamageLifetime: 0,
    },
    L2_CREDIT_LINE: {
      id: 'L2_CREDIT_LINE',
      label: 'Credit Line',
      currentIntegrity: SHIELD_LAYER_MAXIMUMS.L2_CREDIT_LINE,
      maxIntegrity: SHIELD_LAYER_MAXIMUMS.L2_CREDIT_LINE,
      breached: false,
      regenActive: true,
      lastBreachTick: null,
      blockedDamageThisTick: 0,
      blockedDamageLifetime: 0,
    },
    L3_ASSET_FLOOR: {
      id: 'L3_ASSET_FLOOR',
      label: 'Asset Floor',
      currentIntegrity: SHIELD_LAYER_MAXIMUMS.L3_ASSET_FLOOR,
      maxIntegrity: SHIELD_LAYER_MAXIMUMS.L3_ASSET_FLOOR,
      breached: false,
      regenActive: true,
      lastBreachTick: null,
      blockedDamageThisTick: 0,
      blockedDamageLifetime: 0,
    },
    L4_NETWORK_CORE: {
      id: 'L4_NETWORK_CORE',
      label: 'Network Core',
      currentIntegrity: SHIELD_LAYER_MAXIMUMS.L4_NETWORK_CORE,
      maxIntegrity: SHIELD_LAYER_MAXIMUMS.L4_NETWORK_CORE,
      breached: false,
      regenActive: true,
      lastBreachTick: null,
      blockedDamageThisTick: 0,
      blockedDamageLifetime: 0,
    },
  };
}

function createDefaultBots(): Record<BotId, BotRuntimeSnapshot> {
  return {
    BOT_01_LIQUIDATOR: {
      id: 'BOT_01_LIQUIDATOR',
      state: 'DORMANT',
      ticksInState: 0,
      isCritical: false,
      preloadedArrivalTick: null,
      lastAttackTick: null,
      pendingAttackIds: Object.freeze([]),
      extractionUnlocked: false,
    },
    BOT_02_BUREAUCRAT: {
      id: 'BOT_02_BUREAUCRAT',
      state: 'DORMANT',
      ticksInState: 0,
      isCritical: false,
      preloadedArrivalTick: null,
      lastAttackTick: null,
      pendingAttackIds: Object.freeze([]),
      extractionUnlocked: false,
    },
    BOT_03_MANIPULATOR: {
      id: 'BOT_03_MANIPULATOR',
      state: 'DORMANT',
      ticksInState: 0,
      isCritical: false,
      preloadedArrivalTick: null,
      lastAttackTick: null,
      pendingAttackIds: Object.freeze([]),
      extractionUnlocked: false,
    },
    BOT_04_CRASH_PROPHET: {
      id: 'BOT_04_CRASH_PROPHET',
      state: 'DORMANT',
      ticksInState: 0,
      isCritical: false,
      preloadedArrivalTick: null,
      lastAttackTick: null,
      pendingAttackIds: Object.freeze([]),
      extractionUnlocked: false,
    },
    BOT_05_LEGACY_HEIR: {
      id: 'BOT_05_LEGACY_HEIR',
      state: 'DORMANT',
      ticksInState: 0,
      isCritical: false,
      preloadedArrivalTick: null,
      lastAttackTick: null,
      pendingAttackIds: Object.freeze([]),
      extractionUnlocked: false,
    },
  };
}

function createInitialModeState(
  input: CreateInitialRunStateInput,
): Pick<
  LiveRunState,
  'empire' | 'predator' | 'syndicate' | 'phantom'
> {
  return {
    empire:
      input.mode === 'solo'
        ? {
            advantageCardId: null,
            handicapId: null,
            holdCountUsed: 0,
            holdsRemaining: 1,
            bleedModeActive: input.bleedModeActive ?? false,
            isolationTaxTicks: 0,
            pressureJournalEnabled: input.pressureJournalEnabled ?? true,
            personalMasteryTier: 0,
            comebackSurgeActive: false,
            voidScarPeakNetWorth: null,
          }
        : null,
    predator:
      input.mode === 'pvp'
        ? {
            rivalPlayerId: null,
            battleBudget: input.battleBudget ?? 0,
            extractionWindowOpen: false,
            extractionWindowClosesAtTick: null,
            firstBloodClaimedByPlayerId: null,
            perfectCounterCount: 0,
            spectatorsAllowed: true,
          }
        : null,
    syndicate:
      input.mode === 'coop'
        ? {
            teamId: null,
            sharedTreasuryBalance: input.sharedTreasuryBalance ?? 0,
            trustScore: input.trustScore ?? 50,
            rolesPresent: Object.freeze([]),
            defectionWindowOpen: false,
            defectedPlayerIds: Object.freeze([]),
            activeAidRequestIds: Object.freeze([]),
            syndicateDuelActive: false,
          }
        : null,
    phantom:
      input.mode === 'ghost'
        ? {
            legendRunId: input.legendRunId ?? null,
            legendCordTarget: input.legendCordTarget ?? null,
            challengerRunIds: Object.freeze([]),
            currentGapPct: null,
            activeMarkerTicks: Object.freeze([]),
            markerWindowOpen: false,
            legendDecayDays: 0,
            dynastyEligible: false,
          }
        : null,
  };
}

export function createInitialLiveRunState(
  input: CreateInitialRunStateInput,
): LiveRunState {
  const createdAtMs = input.createdAtMs ?? Date.now();
  const seasonTickBudget =
    input.seasonTickBudget ?? DEFAULT_SEASON_TICK_BUDGET;
  const freedomThreshold =
    input.freedomThreshold ?? DEFAULT_FREEDOM_THRESHOLD;

  const cashBalance =
    input.startingCashBalance ?? DEFAULT_STARTING_CASH;
  const monthlyIncome =
    input.startingMonthlyIncome ?? DEFAULT_STARTING_MONTHLY_INCOME;
  const monthlyExpenses =
    input.startingMonthlyExpenses ?? DEFAULT_STARTING_MONTHLY_EXPENSES;
  const startingNetWorth =
    input.startingNetWorth ?? cashBalance;
  const liquidReserves =
    input.startingLiquidReserves ?? Math.max(0, cashBalance);
  const debtOutstanding =
    input.startingDebtOutstanding ?? 0;
  const assetValue =
    input.startingAssetValue ?? Math.max(0, startingNetWorth - debtOutstanding);

  const pressureTier: PressureTier = 'T1_STABLE';
  const currentTickDurationMs = getTickDurationMsForPressureTier(pressureTier);

  const shields = computeShieldAggregate(createDefaultShieldLayers());

  const state: LiveRunState = {
    runId: assertNonEmptyString(input.runId, 'runId'),
    userId: assertNonEmptyString(input.userId, 'userId'),
    seed: assertNonEmptyString(input.seed, 'seed'),
    mode: input.mode,
    localPlayerId: assertNonEmptyString(input.localPlayerId, 'localPlayerId'),
    createdAtMs,
    updatedAtMs: createdAtMs,
    freedomThreshold,
    eventSequence: 0,
    lifecycleState: 'DRAFT',
    time: {
      tickIndex: 0,
      seasonTickBudget,
      ticksRemaining: seasonTickBudget,
      currentTickDurationMs,
      pressureTier,
      phase: 'FOUNDATION',
      phaseStartedAtTick: 0,
      activeDecisionWindowCount: 0,
    },
    economy: {
      cashBalance,
      monthlyIncome,
      monthlyExpenses,
      cashflow: computeCashflow(monthlyIncome, monthlyExpenses),
      netWorth: startingNetWorth,
      liquidReserves,
      debtOutstanding,
      assetValue,
      opportunityCostDamage: 0,
      isolationTaxAccrued: 0,
    },
    pressure: {
      score: 0,
      tier: pressureTier,
      ticksWithoutIncomeGrowth: 0,
      pressureSurvivedTicksHighOrHigher: 0,
      lastTierTransitionTick: null,
    },
    tension: {
      score: 0,
      anticipationQueueDepth: 0,
      visibleThreatCount: 0,
      threatVisibilityState: 'HIDDEN',
      activeThreats: Object.freeze([]),
    },
    shields,
    battle: {
      haterHeat: 0,
      activeBotCount: 0,
      haterAttemptsThisTick: 0,
      haterBlockedThisTick: 0,
      haterDamagedThisTick: 0,
      activeThreatCardCount: 0,
      bots: createDefaultBots(),
    },
    cascades: {
      activeChainCount: 0,
      triggeredThisTick: 0,
      brokenThisTick: 0,
      brokenLifetime: 0,
      activeChains: Object.freeze([]),
      positiveChainCount: 0,
    },
    cards: {
      hand: Object.freeze([]),
      drawQueueDepth: 0,
      discardQueueDepth: 0,
      activeTimingWindows: Object.freeze([
        {
          id: 'BOOT_PRE',
          timingClass: 'PRE',
          source: 'SYSTEM',
          opensAtTick: 0,
          closesAtTick: 0,
          hardDeadlineMs: null,
          targetPlayerId: null,
          notes: 'Boot window for first tick.',
        },
        {
          id: 'BOOT_ANY',
          timingClass: 'ANY',
          source: 'SYSTEM',
          opensAtTick: 0,
          closesAtTick: seasonTickBudget,
          hardDeadlineMs: null,
          targetPlayerId: null,
          notes: 'Always-legal baseline window.',
        },
      ]),
      forcedCardQueueDepth: 0,
    },
    players: [
      {
        playerId: input.localPlayerId,
        displayName: assertNonEmptyString(
          input.localPlayerDisplayName,
          'localPlayerDisplayName',
        ),
        role: null,
        cashBalance,
        netWorth: startingNetWorth,
        shieldHealthNormalized: shields.overallIntegrityPct,
        pressureScore: 0,
        trustScore: input.mode === 'coop' ? input.trustScore ?? 50 : null,
        legendCordTarget:
          input.mode === 'ghost' ? input.legendCordTarget ?? null : null,
        isDefected: false,
        isEliminated: false,
      },
    ],
    sovereignty: {
      decisionSpeedScore: 0,
      shieldsMaintainedPct: shields.overallIntegrityPct,
      haterSabotagesBlocked: 0,
      cascadeChainsBroken: 0,
      pressureSurvivedScore: 0,
      clutchDecisionCountUnder2s: 0,
      noHoldEligible: true,
      sweepEligible: true,
      exterminatorEligible: true,
      betrayalSurvivorEligible: false,
      fullSynergyEligible: false,
      ghostSlayerEligible: false,
      tickStreamChecksum: 'BOOTSTRAP',
      proofHash: null,
      cord: null,
      grade: null,
      integrityStatus: 'PENDING',
    },
    decisionsThisTick: [],
    status: {
      lifecycleState: 'DRAFT',
      outcome: 'IN_PROGRESS',
      hasCrossedFreedomThreshold: false,
      isBankrupt: false,
      isTimedOut: false,
      hasAnyBreachedLayer: false,
    },
    ...createInitialModeState(input),
  };

  return state;
}

/* -------------------------------------------------------------------------- */
/*  Safe pure update helpers                                                  */
/* -------------------------------------------------------------------------- */

export interface ApplyTickAdvanceInput {
  nextTickIndex: number;
  nextUpdatedAtMs?: number;
  nextPhase?: RunPhase;
  nextPressureScore?: number;
}

export function applyTickAdvance(
  state: LiveRunState,
  input: ApplyTickAdvanceInput,
): LiveRunState {
  const nextTickIndex = assertNonNegativeInteger(
    input.nextTickIndex,
    'nextTickIndex',
  );

  const nextPressureScore =
    input.nextPressureScore === undefined
      ? state.pressure.score
      : assertNonNegativeNumber(input.nextPressureScore, 'nextPressureScore');

  const nextPressureTier = computePressureTier(nextPressureScore);

  const nextTicksRemaining = Math.max(
    0,
    state.time.seasonTickBudget - nextTickIndex,
  );

  return {
    ...state,
    updatedAtMs: input.nextUpdatedAtMs ?? Date.now(),
    time: {
      ...state.time,
      tickIndex: nextTickIndex,
      ticksRemaining: nextTicksRemaining,
      phase: input.nextPhase ?? state.time.phase,
      pressureTier: nextPressureTier,
      currentTickDurationMs: getTickDurationMsForPressureTier(nextPressureTier),
    },
    pressure: {
      ...state.pressure,
      score: nextPressureScore,
      tier: nextPressureTier,
      lastTierTransitionTick:
        nextPressureTier === state.pressure.tier
          ? state.pressure.lastTierTransitionTick
          : nextTickIndex,
      pressureSurvivedTicksHighOrHigher:
        nextPressureTier === 'T3_ELEVATED' ||
        nextPressureTier === 'T4_COLLAPSE_IMMINENT'
          ? state.pressure.pressureSurvivedTicksHighOrHigher + 1
          : state.pressure.pressureSurvivedTicksHighOrHigher,
    },
    status: computeStatus(state),
  };
}

export function clearPerTickTransientState(
  state: LiveRunState,
): LiveRunState {
  const clearedShieldLayers = shallowCloneRecord(state.shields.layers);

  for (const layerId of SHIELD_LAYER_IDS) {
    clearedShieldLayers[layerId] = {
      ...clearedShieldLayers[layerId],
      blockedDamageThisTick: 0,
    };
  }

  return {
    ...state,
    battle: {
      ...state.battle,
      haterAttemptsThisTick: 0,
      haterBlockedThisTick: 0,
      haterDamagedThisTick: 0,
      activeThreatCardCount: state.tension.activeThreats.length,
    },
    cascades: {
      ...state.cascades,
      triggeredThisTick: 0,
      brokenThisTick: 0,
    },
    shields: computeShieldAggregate(clearedShieldLayers),
    decisionsThisTick: [],
  };
}