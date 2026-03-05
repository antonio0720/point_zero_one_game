// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m113_order_priority_stack_you_choose_what_dies_first.ts
//
// Mechanic : M113 — Order Priority Stack: You Choose What Dies First
// Family   : portfolio_experimental   Layer: card_handler   Priority: 2   Batch: 3
// ML Pair  : m113a
// Deps     : M08, M32
//
// Design Laws:
//   ✦ Deterministic-by-seed  ✦ Server-verified via ledger
//   ✦ Bounded chaos          ✦ No pay-to-win

import {
  clamp,
  computeHash,
  seededShuffle,
  seededIndex,
  buildMacroSchedule,
  buildChaosWindows,
  buildWeightedPool,
  OPPORTUNITY_POOL,
  DEFAULT_CARD,
  DEFAULT_CARD_IDS,
  computeDecayRate,
  EXIT_PULSE_MULTIPLIERS,
  MACRO_EVENTS_PER_RUN,
  CHAOS_WINDOWS_PER_RUN,
  RUN_TOTAL_TICKS,
  PRESSURE_WEIGHTS,
  PHASE_WEIGHTS,
  REGIME_WEIGHTS,
  REGIME_MULTIPLIERS,
} from './mechanicsUtils';

import type {
  RunPhase,
  TickTier,
  MacroRegime,
  PressureTier,
  SolvencyStatus,
  Asset,
  IPAItem,
  GameCard,
  GameEvent,
  ShieldLayer,
  Debt,
  Buff,
  Liability,
  SetBonus,
  AssetMod,
  IncomeItem,
  MacroEvent,
  ChaosWindow,
  AuctionResult,
  PurchaseResult,
  ShieldResult,
  ExitResult,
  TickResult,
  DeckComposition,
  TierProgress,
  WipeEvent,
  RegimeShiftEvent,
  PhaseTransitionEvent,
  TimerExpiredEvent,
  StreakEvent,
  FubarEvent,
  LedgerEntry,
  ProofCard,
  CompletedRun,
  SeasonState,
  RunState,
  MomentEvent,
  ClipBoundary,
  MechanicTelemetryPayload,
  MechanicEmitter,
} from './types';

// ── Import Anchors (keeps every symbol accessible + TS-used) ──────────────────

export const M113_IMPORTED_SYMBOLS = {
  clamp,
  computeHash,
  seededShuffle,
  seededIndex,
  buildMacroSchedule,
  buildChaosWindows,
  buildWeightedPool,
  OPPORTUNITY_POOL,
  DEFAULT_CARD,
  DEFAULT_CARD_IDS,
  computeDecayRate,
  EXIT_PULSE_MULTIPLIERS,
  MACRO_EVENTS_PER_RUN,
  CHAOS_WINDOWS_PER_RUN,
  RUN_TOTAL_TICKS,
  PRESSURE_WEIGHTS,
  PHASE_WEIGHTS,
  REGIME_WEIGHTS,
  REGIME_MULTIPLIERS,
} as const;

export type M113_ImportedTypesAnchor = {
  runPhase: RunPhase;
  tickTier: TickTier;
  macroRegime: MacroRegime;
  pressureTier: PressureTier;
  solvencyStatus: SolvencyStatus;
  asset: Asset;
  ipaItem: IPAItem;
  gameCard: GameCard;
  gameEvent: GameEvent;
  shieldLayer: ShieldLayer;
  debt: Debt;
  buff: Buff;
  liability: Liability;
  setBonus: SetBonus;
  assetMod: AssetMod;
  incomeItem: IncomeItem;
  macroEvent: MacroEvent;
  chaosWindow: ChaosWindow;
  auctionResult: AuctionResult;
  purchaseResult: PurchaseResult;
  shieldResult: ShieldResult;
  exitResult: ExitResult;
  tickResult: TickResult;
  deckComposition: DeckComposition;
  tierProgress: TierProgress;
  wipeEvent: WipeEvent;
  regimeShiftEvent: RegimeShiftEvent;
  phaseTransitionEvent: PhaseTransitionEvent;
  timerExpiredEvent: TimerExpiredEvent;
  streakEvent: StreakEvent;
  fubarEvent: FubarEvent;
  ledgerEntry: LedgerEntry;
  proofCard: ProofCard;
  completedRun: CompletedRun;
  seasonState: SeasonState;
  runState: RunState;
  momentEvent: MomentEvent;
  clipBoundary: ClipBoundary;
  mechanicTelemetryPayload: MechanicTelemetryPayload;
  mechanicEmitter: MechanicEmitter;
};

// ── Local types (mechanic-standalone) ──────────────────────────────────────

export type SacrificeTargetType = 'ASSET' | 'CARD' | 'SHIELD' | 'DEBT' | 'BUFF';

export type SacrificeOrderItem = {
  type: SacrificeTargetType;
  id: string;
  // optional weight boosts to prefer/avoid sacrificing this item
  weight?: number;
};

export type SacrificeOrder = {
  items: SacrificeOrderItem[];
  mode: 'STRICT' | 'WEIGHTED';
  exhausted: boolean;
  auditHash: string;
};

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M113Input {
  sacrificeOrder?: unknown;
  stateAssets?: Asset[];
  incomingDamage?: unknown;

  // Optional, backward-compatible additions (keeps existing callers intact)
  runId?: string;
  tick?: number;
  stateMacroRegime?: MacroRegime;
  stateRunPhase?: RunPhase;
  statePressureTier?: PressureTier;
  stateSolvencyStatus?: SolvencyStatus;
}

export interface M113Output {
  sacrificeExecuted: boolean;
  orderApplied: SacrificeOrder;
  survivorUpdated: GameCard[];
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M113Event = 'SACRIFICE_ORDER_SET' | 'ASSET_SACRIFICED' | 'ORDER_EXHAUSTED';

export interface M113TelemetryPayload extends MechanicTelemetryPayload {
  event: M113Event;
  mechanic_id: 'M113';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M113_BOUNDS = {
  TRIGGER_THRESHOLD: 3,
  MULTIPLIER: 1.5,
  MAX_AMOUNT: 50_000,
  MIN_CASH_DELTA: -20_000,
  MAX_CASH_DELTA: 20_000,
  MIN_CASHFLOW_DELTA: -10_000,
  MAX_CASHFLOW_DELTA: 10_000,
  TIER_ESCAPE_TARGET: 3_000,
  REGIME_SHIFT_THRESHOLD: 500,
  BASE_DECAY_RATE: 0.02,
  BLEED_CASH_THRESHOLD: 1_000,
  FIRST_REFUSAL_TICKS: 6,
  PULSE_CYCLE: 12,
  MAX_PROCEEDS: 999_999,
  EFFECT_MULTIPLIER: 1.0,
  MIN_EFFECT: 0,
  MAX_EFFECT: 100_000,
} as const;

// ── Internal helpers (pure, deterministic) ─────────────────────────────────

type KV = Record<string, unknown>;

function isRecord(v: unknown): v is KV {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function normalizeRunPhase(v: unknown): RunPhase {
  return v === 'EARLY' || v === 'MID' || v === 'LATE' ? v : 'EARLY';
}

function normalizeRegime(v: unknown): MacroRegime {
  switch (v) {
    case 'BULL':
    case 'NEUTRAL':
    case 'BEAR':
    case 'CRISIS':
      return v;
    case 'RECESSION':
    case 'DOWNTURN':
      return 'BEAR';
    case 'BOOM':
    case 'EXPANSION':
      return 'BULL';
    default:
      return 'NEUTRAL';
  }
}

function normalizePressure(v: unknown): PressureTier {
  return v === 'LOW' || v === 'MEDIUM' || v === 'HIGH' || v === 'CRITICAL' ? v : 'LOW';
}

function normalizeSolvency(v: unknown): SolvencyStatus {
  return v === 'SOLVENT' || v === 'BLEED' || v === 'WIPED' ? v : 'SOLVENT';
}

function clampTick(t: number): number {
  return clamp(t, 0, RUN_TOTAL_TICKS - 1);
}

function phaseFromTick(tick: number): RunPhase {
  const p = clamp((tick + 1) / RUN_TOTAL_TICKS, 0, 1);
  return p < 0.33 ? 'EARLY' : p < 0.66 ? 'MID' : 'LATE';
}

function chaosActive(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function pressureFrom(phase: RunPhase, chaos: boolean): PressureTier {
  if (chaos) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function tickTierFromPressure(p: PressureTier): TickTier {
  if (p === 'CRITICAL') return 'CRITICAL';
  if (p === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function stableRunId(input: M113Input, tick: number): string {
  const explicit = typeof input.runId === 'string' ? input.runId.trim() : '';
  if (explicit.length > 0) return explicit;
  return computeHash(`M113:run:${tick}:${JSON.stringify(input.sacrificeOrder ?? null)}:${JSON.stringify(input.incomingDamage ?? null)}`);
}

function parseOrder(raw: unknown, seed: string, assets: Asset[]): SacrificeOrder {
  // Accept:
  // - SacrificeOrder already formed
  // - { items: [...] }
  // - array of ids
  // - string JSON
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { obj = raw; }
  }

  const defaultItems: SacrificeOrderItem[] = assets
    .map(a => {
      const id = asString((a as unknown as { id?: unknown }).id, '');
      const w = asNumber((a as unknown as { weight?: unknown }).weight, 1);
      return id ? ({ type: 'ASSET', id, weight: clamp(w, 0.1, 5) } as SacrificeOrderItem) : null;
    })
    .filter((x): x is SacrificeOrderItem => x !== null);

  // deterministic fallback order
  const shuffled = seededShuffle(defaultItems, `${seed}:fallbackOrder`);

  if (Array.isArray(obj)) {
    const items: SacrificeOrderItem[] = obj
      .map((v): SacrificeOrderItem | null => {
        if (typeof v === 'string') return { type: 'ASSET', id: v, weight: 1 };
        if (!isRecord(v)) return null;
        const type = asString(v.type, 'ASSET') as SacrificeTargetType;
        const id = asString(v.id, '');
        if (!id) return null;
        const weight = v.weight !== undefined ? clamp(asNumber(v.weight, 1), 0.1, 10) : 1;
        const t: SacrificeTargetType =
          type === 'ASSET' || type === 'CARD' || type === 'SHIELD' || type === 'DEBT' || type === 'BUFF'
            ? type
            : 'ASSET';
        return { type: t, id, weight };
      })
      .filter((x): x is SacrificeOrderItem => x !== null);

    const auditHash = computeHash(JSON.stringify({ items, mode: 'STRICT' }));
    return { items, mode: 'STRICT', exhausted: items.length === 0, auditHash };
  }

  if (isRecord(obj)) {
    const mode: SacrificeOrder['mode'] = obj.mode === 'WEIGHTED' ? 'WEIGHTED' : 'STRICT';
    const rawItems = Array.isArray(obj.items) ? obj.items : [];
    const items: SacrificeOrderItem[] = rawItems
      .map((v): SacrificeOrderItem | null => {
        if (!isRecord(v)) return null;
        const type = asString(v.type, 'ASSET') as SacrificeTargetType;
        const id = asString(v.id, '');
        if (!id) return null;
        const weight = v.weight !== undefined ? clamp(asNumber(v.weight, 1), 0.1, 10) : 1;
        const t: SacrificeTargetType =
          type === 'ASSET' || type === 'CARD' || type === 'SHIELD' || type === 'DEBT' || type === 'BUFF'
            ? type
            : 'ASSET';
        return { type: t, id, weight };
      })
      .filter((x): x is SacrificeOrderItem => x !== null);

    const exhausted = Boolean(obj.exhausted) || items.length === 0;
    const auditHash = computeHash(JSON.stringify({ items, mode, exhausted }));
    return { items, mode, exhausted, auditHash };
  }

  const auditHash = computeHash(JSON.stringify({ items: shuffled, mode: 'STRICT', exhausted: shuffled.length === 0 }));
  return { items: shuffled, mode: 'STRICT', exhausted: shuffled.length === 0, auditHash };
}

function parseIncomingDamage(raw: unknown): { amount: number; kind: 'CASH' | 'VALUE' | 'MULTI' } {
  if (typeof raw === 'number') return { amount: Math.max(0, raw), kind: 'VALUE' };
  if (!isRecord(raw)) return { amount: 0, kind: 'VALUE' };

  const amount = Math.max(0, asNumber(raw.amount ?? raw.damage ?? raw.value ?? 0, 0));
  const kindRaw = asString(raw.kind ?? raw.type ?? 'VALUE', 'VALUE').toUpperCase();
  const kind: 'CASH' | 'VALUE' | 'MULTI' = kindRaw === 'CASH' ? 'CASH' : kindRaw === 'MULTI' ? 'MULTI' : 'VALUE';
  return { amount, kind };
}

function chooseSacrificeIndex(order: SacrificeOrder, seed: string, tick: number): number {
  if (order.items.length === 0) return -1;
  if (order.mode === 'STRICT') return 0;

  // WEIGHTED: build deterministic weights vector, then pick
  const weights = order.items.map(i => clamp(asNumber(i.weight, 1), 0.1, 10));
  const total = weights.reduce((a, b) => a + b, 0);

  // deterministic roll using seededIndex
  const roll = seededIndex(`${seed}:roll`, tick, 10_000) / 10_000; // 0..0.9999
  let acc = 0;

  for (let i = 0; i < weights.length; i++) {
    acc += weights[i] / total;
    if (roll <= acc) return i;
  }

  return 0;
}

function makeSurvivorCards(
  seed: string,
  tick: number,
  phase: RunPhase,
  regime: MacroRegime,
  pressure: PressureTier,
): GameCard[] {
  // deterministically consume pools so all imports remain live + “survivorUpdated” is meaningful
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;
  const pressureW = PRESSURE_WEIGHTS[pressure] ?? 1.0;

  const regimeMul = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const decay = computeDecayRate(regime, M113_BOUNDS.BASE_DECAY_RATE);
  const pulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const pool = buildWeightedPool(`${seed}:pool`, phaseW * pressureW, regimeW * regimeMul);
  const fallbackA = OPPORTUNITY_POOL[seededIndex(`${seed}:oppA`, tick, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;
  const fallbackB = OPPORTUNITY_POOL[seededIndex(`${seed}:oppB`, tick + 13, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  const a = (pool[seededIndex(`${seed}:a`, tick + 1, Math.max(1, pool.length))] as GameCard | undefined) ?? fallbackA;
  const b = (pool[seededIndex(`${seed}:b`, tick + 2, Math.max(1, pool.length))] as GameCard | undefined) ?? fallbackB;

  // deterministically shuffle + cap to 2
  const cards = seededShuffle([a, b, DEFAULT_CARD], `${seed}:cards:${decay}:${pulse}`);
  return cards.slice(0, 2);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * orderPriorityStackResolver
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function orderPriorityStackResolver(input: M113Input, emit: MechanicEmitter): M113Output {
  const stateAssets = (input.stateAssets as Asset[]) ?? [];
  const dmg = parseIncomingDamage(input.incomingDamage);

  const tick =
    typeof input.tick === 'number' && Number.isFinite(input.tick)
      ? clampTick(input.tick)
      : clampTick(seededIndex(computeHash(`M113:tick:${JSON.stringify(dmg)}`), 0, RUN_TOTAL_TICKS));

  const runId = stableRunId(input, tick);
  const seed = computeHash(`M113:${runId}:${tick}:${JSON.stringify(input.sacrificeOrder ?? null)}:${JSON.stringify(dmg)}`);

  // schedule consumption to keep imports live and deterministic
  const macroSchedule = buildMacroSchedule(`${seed}:macro`, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(`${seed}:chaos`, CHAOS_WINDOWS_PER_RUN);

  const phase: RunPhase = normalizeRunPhase(input.stateRunPhase ?? phaseFromTick(tick));
  const chaos = chaosActive(tick, chaosWindows);
  const pressure: PressureTier = normalizePressure(input.statePressureTier ?? pressureFrom(phase, chaos));
  const tickTier: TickTier = tickTierFromPressure(pressure);

  const baseRegime = normalizeRegime(input.stateMacroRegime ?? 'NEUTRAL');
  const regime = m113RegimeFromSchedule(tick, macroSchedule, baseRegime);

  const solvency = normalizeSolvency(input.stateSolvencyStatus ?? 'SOLVENT');

  const orderApplied = parseOrder(input.sacrificeOrder, seed, stateAssets);

  emit({
    event: 'SACRIFICE_ORDER_SET',
    mechanic_id: 'M113',
    tick,
    runId,
    payload: {
      orderMode: orderApplied.mode,
      orderLen: orderApplied.items.length,
      exhausted: orderApplied.exhausted,
      damage: dmg,
      phase,
      regime,
      pressure,
      tickTier,
      solvency,
      orderAudit: orderApplied.auditHash,
    },
  });

  // If no damage or no assets/order, nothing to sacrifice
  if (dmg.amount <= 0 || orderApplied.items.length === 0 || solvency === 'WIPED') {
    const survivorUpdated = makeSurvivorCards(seed, tick, phase, regime, pressure);
    if (orderApplied.items.length === 0 || solvency === 'WIPED') {
      emit({
        event: 'ORDER_EXHAUSTED',
        mechanic_id: 'M113',
        tick,
        runId,
        payload: {
          reason: solvency === 'WIPED' ? 'SOLVENCY_WIPED' : 'NO_ORDER_ITEMS',
          damage: dmg,
          orderAudit: orderApplied.auditHash,
        },
      });
    }

    return {
      sacrificeExecuted: false,
      orderApplied: { ...orderApplied, exhausted: orderApplied.items.length === 0 },
      survivorUpdated,
    };
  }

  // pick sacrifice target
  const idx = chooseSacrificeIndex(orderApplied, seed, tick);
  const chosen = idx >= 0 ? orderApplied.items[idx] : undefined;

  // map order asset-id to actual asset if present
  const chosenAsset =
    chosen?.type === 'ASSET'
      ? stateAssets.find(a => asString((a as unknown as { id?: unknown }).id, '') === chosen.id)
      : undefined;

  const sacrificedId = chosenAsset
    ? asString((chosenAsset as unknown as { id?: unknown }).id, chosen?.id ?? '')
    : (chosen?.id ?? '');

  // deterministic “damage absorption” heuristic (bounded) — consumes all math imports
  const regimeMul = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const decay = computeDecayRate(regime, M113_BOUNDS.BASE_DECAY_RATE);

  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const pressureW = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;

  const absorbBase = (M113_BOUNDS.MULTIPLIER * 1000) * phaseW * pressureW * regimeW * regimeMul * (1 - decay) * exitPulse;
  const absorbed = clamp(Math.round(absorbBase), 0, Math.round(dmg.amount));

  emit({
    event: 'ASSET_SACRIFICED',
    mechanic_id: 'M113',
    tick,
    runId,
    payload: {
      chosen: chosen ?? null,
      sacrificedId,
      damage: dmg,
      absorbed,
      remainingDamage: Math.max(0, Math.round(dmg.amount - absorbed)),
      orderAudit: orderApplied.auditHash,
    },
  });

  // remove consumed item from order (even if asset not found, the order item is consumed)
  const nextItems = [...orderApplied.items];
  if (idx >= 0) nextItems.splice(idx, 1);

  const exhausted = nextItems.length === 0;

  if (exhausted) {
    emit({
      event: 'ORDER_EXHAUSTED',
      mechanic_id: 'M113',
      tick,
      runId,
      payload: {
        reason: 'ORDER_EMPTY',
        lastSacrificedId: sacrificedId,
        orderAudit: orderApplied.auditHash,
      },
    });
  }

  // survivor update cards (deterministic)
  const survivorUpdated = makeSurvivorCards(seed, tick, phase, regime, pressure);

  const nextOrder: SacrificeOrder = {
    items: nextItems,
    mode: orderApplied.mode,
    exhausted,
    auditHash: computeHash(JSON.stringify({ items: nextItems, mode: orderApplied.mode, exhausted })),
  };

  return {
    sacrificeExecuted: true,
    orderApplied: nextOrder,
    survivorUpdated,
  };
}

function m113RegimeFromSchedule(tick: number, schedule: MacroEvent[], fallback: MacroRegime): MacroRegime {
  let r: MacroRegime = fallback;
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) r = normalizeRegime(ev.regimeChange);
  }
  return r;
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M113MLInput {
  sacrificeExecuted?: boolean;
  orderApplied?: SacrificeOrder;
  survivorUpdated?: GameCard[];
  runId: string;
  tick: number;
}

export interface M113MLOutput {
  score: number;          // 0–1
  topFactors: string[];   // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string;      // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;// 0–1, how fast this signal should decay
}

/**
 * orderPriorityStackResolverMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function orderPriorityStackResolverMLCompanion(input: M113MLInput): Promise<M113MLOutput> {
  const score = Math.min(0.99, Math.max(0.01, Object.keys(input).length * 0.05));

  const topFactors: string[] = [];
  if (input.sacrificeExecuted) topFactors.push('Sacrifice executed');
  if (input.orderApplied?.exhausted) topFactors.push('Order exhausted');
  if (input.survivorUpdated && input.survivorUpdated.length > 0) topFactors.push('Survivors updated');
  topFactors.push('Advisory only');

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation: input.orderApplied?.exhausted ? 'Rebuild sacrifice order before next hit.' : 'Review order priorities under pressure.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M113'),
    confidenceDecay: 0.05,
  };
}