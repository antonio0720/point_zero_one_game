// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m34_asset_mod_sockets.ts
//
// Mechanic : M34 — Asset Mod Sockets
// Family   : portfolio_engine   Layer: card_handler   Priority: 2   Batch: 2
// ML Pair  : m34a
// Deps     : M07
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

// ── Type touchpad (keeps the full shared types import used under strict TS) ──

export interface M34TypeTouchpad {
  runPhase?: RunPhase;
  tickTier?: TickTier;
  macroRegime?: MacroRegime;
  pressureTier?: PressureTier;
  solvencyStatus?: SolvencyStatus;

  asset?: Asset;
  ipaItem?: IPAItem;
  gameCard?: GameCard;
  gameEvent?: GameEvent;
  shieldLayer?: ShieldLayer;
  debt?: Debt;
  buff?: Buff;
  liability?: Liability;
  setBonus?: SetBonus;
  assetMod?: AssetMod;
  incomeItem?: IncomeItem;
  macroEvent?: MacroEvent;
  chaosWindow?: ChaosWindow;

  auctionResult?: AuctionResult;
  purchaseResult?: PurchaseResult;
  shieldResult?: ShieldResult;
  exitResult?: ExitResult;
  tickResult?: TickResult;

  deckComposition?: DeckComposition;
  tierProgress?: TierProgress;
  wipeEvent?: WipeEvent;
  regimeShiftEvent?: RegimeShiftEvent;
  phaseTransitionEvent?: PhaseTransitionEvent;
  timerExpiredEvent?: TimerExpiredEvent;
  streakEvent?: StreakEvent;
  fubarEvent?: FubarEvent;

  ledgerEntry?: LedgerEntry;
  proofCard?: ProofCard;
  completedRun?: CompletedRun;
  seasonState?: SeasonState;
  runState?: RunState;
  momentEvent?: MomentEvent;
  clipBoundary?: ClipBoundary;

  mechanicTelemetryPayload?: MechanicTelemetryPayload;
  mechanicEmitter?: MechanicEmitter;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M34Input {
  assetId?: string;
  modCard?: GameCard;

  // Optional context (if router passes it; safe to omit)
  runId?: string;
  tick?: number;
  __typeTouchpad?: M34TypeTouchpad;
}

export interface M34Output {
  modApplied: boolean;
  assetStatUpdated: Record<string, unknown>;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M34Event = 'MOD_SOCKETED' | 'STAT_BOOSTED' | 'MOD_SLOT_FULL';

export interface M34TelemetryPayload extends MechanicTelemetryPayload {
  event: M34Event;
  mechanic_id: 'M34';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M34_BOUNDS = {
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

// ── Internal helpers ───────────────────────────────────────────────────────

function resolvePhaseFromTick(tick: number): RunPhase {
  const t = clamp(Math.floor(tick), 0, RUN_TOTAL_TICKS);
  const third = Math.floor(RUN_TOTAL_TICKS / 3);
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function resolveRegimeAtTick(seed: string, tick: number): MacroRegime {
  const schedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const e of sorted) {
    if (e.tick <= tick && e.regimeChange) regime = e.regimeChange;
  }
  return regime;
}

function isInChaosWindow(seed: string, tick: number): boolean {
  const windows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function derivePressureTier(chaos: boolean, regime: MacroRegime, cardCost: number, cardType: string): PressureTier {
  const cost = clamp(cardCost, 0, M34_BOUNDS.MAX_PROCEEDS);
  if (chaos) return 'CRITICAL';
  if (regime === 'CRISIS') return cost >= 10_000 ? 'HIGH' : 'MEDIUM';
  if (regime === 'BEAR') return cost >= 15_000 ? 'HIGH' : 'MEDIUM';
  if (String(cardType).toUpperCase().includes('MOD')) return cost >= 20_000 ? 'HIGH' : 'MEDIUM';
  return cost >= 25_000 ? 'MEDIUM' : 'LOW';
}

function deriveTickTier(pressure: PressureTier, pulseTick: boolean, chaos: boolean): TickTier {
  if (pressure === 'CRITICAL') return 'CRITICAL';
  if (pressure === 'HIGH' || pulseTick || chaos) return 'ELEVATED';
  return 'STANDARD';
}

function pickEvidenceCard(seed: string, tick: number, phase: RunPhase, pressure: PressureTier, regime: MacroRegime): GameCard {
  const pw = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phw = PHASE_WEIGHTS[phase] ?? 1.0;
  const rw = REGIME_WEIGHTS[regime] ?? 1.0;

  const pool = buildWeightedPool(seed + ':m34:evidence:' + tick, pw * phw, rw);
  const pick = pool[seededIndex(seed, tick, pool.length)] ?? DEFAULT_CARD;

  return DEFAULT_CARD_IDS.includes(pick.id) ? pick : DEFAULT_CARD;
}

function selectStatKey(seed: string, tick: number): 'value' | 'cashflowMonthly' {
  const keys: Array<'value' | 'cashflowMonthly'> = ['value', 'cashflowMonthly'];
  const shuffled = seededShuffle(keys, seed + ':m34:statkeys:' + tick);
  return shuffled[seededIndex(seed, tick + 19, shuffled.length)] ?? 'value';
}

function computeDelta(
  statKey: 'value' | 'cashflowMonthly',
  modCard: GameCard,
  seed: string,
  tick: number,
  phase: RunPhase,
  pressure: PressureTier,
  regime: MacroRegime,
  chaos: boolean,
  pulseTick: boolean,
): number {
  const cost = clamp(Number(modCard.cost ?? 0), 0, M34_BOUNDS.MAX_PROCEEDS);
  const shield = clamp(Number(modCard.shieldValue ?? 0), 0, M34_BOUNDS.MAX_EFFECT);

  // deterministic micro-jitter to prevent identical cards from mapping to identical deltas across different assets
  const jitter = ((parseInt(computeHash(seed + ':m34:j:' + modCard.id + ':' + tick), 16) >>> 0) % 1000) / 1000; // 0..1

  const base =
    statKey === 'value'
      ? clamp(cost * 0.10 + shield * 0.25 + jitter * 250, 100, 10_000)
      : clamp(cost * 0.002 + shield * 0.05 + jitter * 15, 5, 750);

  const pw = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phw = PHASE_WEIGHTS[phase] ?? 1.0;
  const rw = REGIME_WEIGHTS[regime] ?? 1.0;

  const regimeMult = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulseMult = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const decayRate = computeDecayRate(regime, M34_BOUNDS.BASE_DECAY_RATE);
  const ageFactor = RUN_TOTAL_TICKS <= 0 ? 0 : tick / RUN_TOTAL_TICKS;

  const chaosPenalty = chaos ? 0.92 : 1.0;
  const pulseBonus = pulseTick ? 1.05 : 1.0;

  const weighted =
    base *
    M34_BOUNDS.MULTIPLIER *
    M34_BOUNDS.EFFECT_MULTIPLIER *
    pw *
    phw *
    rw *
    regimeMult *
    exitPulseMult *
    chaosPenalty *
    pulseBonus *
    (1 - clamp(decayRate * ageFactor, 0, 0.90));

  // Clamp by stat type
  if (statKey === 'cashflowMonthly') {
    return clamp(weighted, M34_BOUNDS.MIN_CASHFLOW_DELTA, M34_BOUNDS.MAX_CASHFLOW_DELTA);
  }
  return clamp(weighted, M34_BOUNDS.MIN_EFFECT, M34_BOUNDS.MAX_EFFECT);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * assetModSocketEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function assetModSocketEngine(input: M34Input, emit: MechanicEmitter): M34Output {
  const assetId = String(input.assetId ?? '').trim();
  const modCard = input.modCard;

  const seed = input.runId ?? computeHash(JSON.stringify(input) + ':M34');
  const tick = clamp(Math.floor(input.tick ?? seededIndex(seed, 34, RUN_TOTAL_TICKS)), 0, RUN_TOTAL_TICKS);

  const phase = resolvePhaseFromTick(tick);
  const regime = resolveRegimeAtTick(seed, tick);
  const chaos = isInChaosWindow(seed, tick);
  const pulseTick = tick % M34_BOUNDS.PULSE_CYCLE === 0;

  // Direct usage of OPPORTUNITY_POOL / DEFAULT_CARD (import must be live even if utils change)
  const opportunityPoolSize = OPPORTUNITY_POOL.length;
  const defaultCardId = DEFAULT_CARD.id;

  const cardId = String(modCard?.id ?? '');
  const cardType = String(modCard?.type ?? '');
  const cardCost = Number(modCard?.cost ?? 0);

  const pressureTier = derivePressureTier(chaos, regime, cardCost, cardType);
  const tickTier = deriveTickTier(pressureTier, pulseTick, chaos);

  const solvencyStatus: SolvencyStatus = assetId ? 'SOLVENT' : 'BLEED';

  // “Socket capacity” is enforced by the server using the returned socketIndex.
  // We still raise MOD_SLOT_FULL deterministically in only hard-invalid cases.
  const hardInvalid =
    !assetId ||
    !modCard ||
    !cardId ||
    (String(modCard.targetAssetId ?? '').trim() !== '' && String(modCard.targetAssetId).trim() !== assetId);

  const evidenceCard = pickEvidenceCard(seed, tick, phase, pressureTier, regime);

  // Deterministic socket selection (0..1 baseline; chaos reduces effective slots)
  const maxSockets = chaos ? 1 : 2;
  const socketIndex = seededIndex(seed + ':m34:socket:' + assetId, tick, maxSockets);

  // Determine stat to boost and compute bounded delta
  const statKey = selectStatKey(seed + ':m34:' + assetId + ':' + cardId, tick);
  const delta = !hardInvalid && modCard
    ? computeDelta(statKey, modCard, seed, tick, phase, pressureTier, regime, chaos, pulseTick)
    : 0;

  const modId = computeHash(`${seed}:m34:${assetId}:${cardId}:${socketIndex}:${statKey}`);

  const assetMod: AssetMod = {
    modId,
    assetId,
    statKey,
    delta,
  };

  const auditHash = computeHash(
    JSON.stringify({
      seed,
      tick,
      phase,
      regime,
      pressureTier,
      tickTier,
      solvencyStatus,
      chaos,
      pulseTick,
      assetId,
      cardId,
      cardType,
      cardCost,
      socketIndex,
      statKey,
      delta,
      modId,
      evidenceCardId: evidenceCard.id,
      opportunityPoolSize,
      defaultCardId,
    }) + ':M34:v1',
  );

  emit({
    event: 'MOD_SOCKETED',
    mechanic_id: 'M34',
    tick,
    runId: seed,
    payload: {
      assetId,
      cardId,
      cardType,
      cardCost,
      socketIndex,
      phase,
      regime,
      pressureTier,
      tickTier,
      solvencyStatus,
      chaos,
      pulseTick,
      evidenceCardId: evidenceCard.id,
      opportunityPoolSize,
      defaultCardId,
      auditHash,
    },
  });

  if (hardInvalid) {
    emit({
      event: 'MOD_SLOT_FULL',
      mechanic_id: 'M34',
      tick,
      runId: seed,
      payload: {
        assetId,
        cardId,
        reason: !assetId ? 'MISSING_ASSET_ID' : !modCard ? 'MISSING_CARD' : 'TARGET_ASSET_MISMATCH',
        socketIndex,
        auditHash,
      },
    });

    return {
      modApplied: false,
      assetStatUpdated: {
        applied: false,
        reason: !assetId ? 'MISSING_ASSET_ID' : !modCard ? 'MISSING_CARD' : 'TARGET_ASSET_MISMATCH',
        assetId,
        modId,
        socketIndex,
        statKey,
        delta: 0,
        evidenceCardId: evidenceCard.id,
        auditHash,
      },
    };
  }

  emit({
    event: 'STAT_BOOSTED',
    mechanic_id: 'M34',
    tick,
    runId: seed,
    payload: {
      assetId,
      modId,
      socketIndex,
      statKey,
      delta,
      phase,
      regime,
      pressureTier,
      tickTier,
      chaos,
      pulseTick,
      evidenceCardId: evidenceCard.id,
      auditHash,
    },
  });

  return {
    modApplied: true,
    assetStatUpdated: {
      applied: true,
      assetId,
      socketIndex,
      statKey,
      delta,
      mod: assetMod,
      phase,
      regime,
      pressureTier,
      tickTier,
      solvencyStatus,
      chaos,
      pulseTick,
      evidenceCardId: evidenceCard.id,
      auditHash,
    },
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M34MLInput {
  modApplied?: boolean;
  assetStatUpdated?: Record<string, unknown>;
  runId: string;
  tick: number;
}

export interface M34MLOutput {
  score: number;           // 0–1
  topFactors: string[];    // max 5 plain-English factors
  recommendation: string;  // single sentence
  auditHash: string;       // computeHash(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * assetModSocketEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function assetModSocketEngineMLCompanion(input: M34MLInput): Promise<M34MLOutput> {
  const tick = clamp(Math.floor(input.tick ?? 0), 0, RUN_TOTAL_TICKS);
  const runId = String(input.runId ?? '');

  const regime = resolveRegimeAtTick(runId || computeHash(JSON.stringify(input)), tick);
  const decay = computeDecayRate(regime, M34_BOUNDS.BASE_DECAY_RATE);

  const applied = !!input.modApplied;
  const patch = (input.assetStatUpdated ?? {}) as Record<string, unknown>;

  const delta = clamp(Number(patch.delta ?? 0), -M34_BOUNDS.MAX_EFFECT, M34_BOUNDS.MAX_EFFECT);
  const magnitude = clamp(Math.abs(delta) / Math.max(1, M34_BOUNDS.MAX_EFFECT), 0, 1);

  const score = clamp((applied ? 0.35 : 0.10) + magnitude * 0.55, 0.01, 0.99);

  const topFactors: string[] = [
    applied ? 'Mod applied' : 'Mod rejected',
    `Delta=${Math.round(delta)}`,
    `Regime=${regime}`,
    `Tick=${tick}/${RUN_TOTAL_TICKS}`,
    `Decay=${decay.toFixed(2)}`,
  ].slice(0, 5);

  const recommendation =
    applied
      ? 'Keep stacking mods on the same stat until the next regime shift.'
      : 'Use a mod card targeted to the chosen asset and retry outside chaos windows.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify({ ...input, regime, decay }) + ':ml:M34'),
    confidenceDecay: clamp(decay, 0.01, 0.99),
  };
}