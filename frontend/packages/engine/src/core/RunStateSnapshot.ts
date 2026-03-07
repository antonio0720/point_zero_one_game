// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — RUN STATE SNAPSHOT
// pzo-web/src/engines/core/RunStateSnapshot.ts
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════
// Assembled ONCE per tick by EngineOrchestrator before Step 1.
// All 7 engines read from this frozen snapshot — never from live state.
// Guarantees determinism: same snapshot + same seed = same output, always.
// No engine writes to this object. TypeScript enforces this via readonly.

import type {
  RunStateSnapshot,
  ShieldState,
  ShieldLayer,
  ShieldLayerId,
  BotRuntimeState,
  BotId,
  CascadeChainInstance,
  RunMode,
  RunLifecycleState,
  PressureTier,
  TickTier,
} from './types';
import { SHIELD_MAX_INTEGRITY, PRESSURE_TIER_THRESHOLDS } from './types';

// ── Mutable live state (written by engines, read at snapshot time) ────────────

export interface LiveRunState {
  tick:           number;
  cash:           number;
  income:         number;
  expenses:       number;
  netWorth:       number;
  haterHeat:      number;          // 0–100
  pressureScore:  number;          // 0.0–1.0
  tickTier:       TickTier;
  shields:        MutableShieldState;
  botStates:      Record<BotId, BotRuntimeState>;
  activeCascades: CascadeChainInstance[];
  runMode:        RunMode;
  seed:           number;
  lifecycle:      RunLifecycleState;
}

export interface MutableShieldState {
  layers:              Record<ShieldLayerId, MutableShieldLayer>;
  l4BreachCount:       number;
}

export interface MutableShieldLayer {
  id:          ShieldLayerId;
  label:       string;
  current:     number;
  max:         number;
  breached:    boolean;
  lastBreach:  number | null;
  regenActive: boolean;
}

// ── Snapshot builder ──────────────────────────────────────────────────────────

/**
 * Builds a frozen RunStateSnapshot from the current live state.
 * Called exclusively by EngineOrchestrator at the START of each tick.
 * The returned object is deeply frozen — TypeScript + runtime both enforce this.
 */
export function buildSnapshot(live: LiveRunState): RunStateSnapshot {
  const pressureTier = computePressureTier(live.pressureScore);

  const snapshot: RunStateSnapshot = {
    tick:           live.tick,
    cash:           live.cash,
    income:         live.income,
    expenses:       live.expenses,
    netWorth:       live.netWorth,
    haterHeat:      live.haterHeat,
    pressureScore:  live.pressureScore,
    pressureTier,
    tickTier:       live.tickTier,
    shields:        buildFrozenShieldState(live.shields),
    botStates:      Object.freeze({ ...live.botStates }),
    activeCascades: [...live.activeCascades] as CascadeChainInstance[],
    runMode:        live.runMode,
    seed:           live.seed,
    lifecycleState: live.lifecycle,
  };

  return Object.freeze(snapshot);
}

function buildFrozenShieldState(mutable: MutableShieldState): ShieldState {
  const frozenLayers = {} as Record<ShieldLayerId, ShieldLayer>;
  for (const [id, layer] of Object.entries(mutable.layers)) {
    frozenLayers[id as ShieldLayerId] = Object.freeze({ ...layer });
  }

  const overallIntegrityPct = computeOverallIntegrity(frozenLayers);

  return Object.freeze({
    layers:              frozenLayers,
    overallIntegrityPct,
    l4BreachCount:       mutable.l4BreachCount,
  });
}

function computeOverallIntegrity(layers: Record<ShieldLayerId, ShieldLayer>): number {
  let totalMax     = 0;
  let totalCurrent = 0;
  for (const layer of Object.values(layers)) {
    totalMax     += layer.max;
    totalCurrent += layer.current;
  }
  if (totalMax === 0) return 0;
  return totalCurrent / totalMax;
}

function computePressureTier(score: number): PressureTier {
  if (score >= PRESSURE_TIER_THRESHOLDS.CRITICAL)  return 'CRITICAL';
  if (score >= PRESSURE_TIER_THRESHOLDS.HIGH)       return 'HIGH';
  if (score >= PRESSURE_TIER_THRESHOLDS.ELEVATED)   return 'ELEVATED';
  if (score >= PRESSURE_TIER_THRESHOLDS.BUILDING)   return 'BUILDING';
  return 'CALM';
}

// ── Live state factory ────────────────────────────────────────────────────────

/** Creates the initial live state for a new run. */
export function createInitialLiveState(params: {
  seed:             number;
  startingCash:     number;
  startingIncome:   number;
  startingExpenses: number;
  runMode:          RunMode;
}): LiveRunState {
  return {
    tick:          0,
    cash:          params.startingCash,
    income:        params.startingIncome,
    expenses:      params.startingExpenses,
    netWorth:      params.startingCash,
    haterHeat:     0,
    pressureScore: 0.0,
    tickTier:      'T1',
    runMode:       params.runMode,
    seed:          params.seed,
    lifecycle:     'IDLE',
    shields:       createInitialShields(),
    botStates:     createInitialBotStates(),
    activeCascades: [],
  };
}

function createInitialShields(): MutableShieldState {
  const layers: Record<ShieldLayerId, MutableShieldLayer> = {
    L1_LIQUIDITY_BUFFER: {
      id: 'L1_LIQUIDITY_BUFFER', label: 'Liquidity Buffer',
      current: SHIELD_MAX_INTEGRITY.L1_LIQUIDITY_BUFFER,
      max:     SHIELD_MAX_INTEGRITY.L1_LIQUIDITY_BUFFER,
      breached: false, lastBreach: null, regenActive: true,
    },
    L2_CREDIT_LINE: {
      id: 'L2_CREDIT_LINE', label: 'Credit Line',
      current: SHIELD_MAX_INTEGRITY.L2_CREDIT_LINE,
      max:     SHIELD_MAX_INTEGRITY.L2_CREDIT_LINE,
      breached: false, lastBreach: null, regenActive: true,
    },
    L3_ASSET_FLOOR: {
      id: 'L3_ASSET_FLOOR', label: 'Asset Floor',
      current: SHIELD_MAX_INTEGRITY.L3_ASSET_FLOOR,
      max:     SHIELD_MAX_INTEGRITY.L3_ASSET_FLOOR,
      breached: false, lastBreach: null, regenActive: true,
    },
    L4_NETWORK_CORE: {
      id: 'L4_NETWORK_CORE', label: 'Network Core',
      current: SHIELD_MAX_INTEGRITY.L4_NETWORK_CORE,
      max:     SHIELD_MAX_INTEGRITY.L4_NETWORK_CORE,
      breached: false, lastBreach: null, regenActive: true,
    },
  };
  return { layers, l4BreachCount: 0 };
}

function createInitialBotStates(): Record<BotId, BotRuntimeState> {
  const bots: BotId[] = [
    'BOT_01_LIQUIDATOR',
    'BOT_02_BUREAUCRAT',
    'BOT_03_MANIPULATOR',
    'BOT_04_CRASH_PROPHET',
    'BOT_05_LEGACY_HEIR',
  ];
  const states = {} as Record<BotId, BotRuntimeState>;
  for (const id of bots) {
    states[id] = {
      id,
      state:            'DORMANT',
      ticksInState:     0,
      preloadedArrival: null,
      isCritical:       false,
      lastAttackTick:   null,
    };
  }
  return states;
}
