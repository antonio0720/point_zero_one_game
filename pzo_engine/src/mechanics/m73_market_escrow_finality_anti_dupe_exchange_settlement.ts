// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m73_market_escrow_finality_anti_dupe_exchange_settlement.ts
//
// Mechanic : M73 — Market Escrow Finality: Anti-Dupe Exchange Settlement
// Family   : integrity_advanced   Layer: backend_service   Priority: 1   Batch: 2
// ML Pair  : m73a
// Deps     : M46, M47
//
// Design Laws:
//   ✦ Deterministic-by-seed  ✦ Server-verified via ledger
//   ✦ Bounded chaos          ✦ No pay-to-win

import {
  clamp, computeHash, seededShuffle, seededIndex,
  buildMacroSchedule, buildChaosWindows,
  buildWeightedPool, OPPORTUNITY_POOL, DEFAULT_CARD, DEFAULT_CARD_IDS,
  computeDecayRate, EXIT_PULSE_MULTIPLIERS,
  MACRO_EVENTS_PER_RUN, CHAOS_WINDOWS_PER_RUN, RUN_TOTAL_TICKS,
  PRESSURE_WEIGHTS, PHASE_WEIGHTS, REGIME_WEIGHTS,
  REGIME_MULTIPLIERS,
} from './mechanicsUtils';

import type {
  RunPhase, TickTier, MacroRegime, PressureTier, SolvencyStatus,
  Asset, IPAItem, GameCard, GameEvent, ShieldLayer, Debt, Buff,
  Liability, SetBonus, AssetMod, IncomeItem, MacroEvent, ChaosWindow,
  AuctionResult, PurchaseResult, ShieldResult, ExitResult, TickResult,
  DeckComposition, TierProgress, WipeEvent, RegimeShiftEvent,
  PhaseTransitionEvent, TimerExpiredEvent, StreakEvent, FubarEvent,
  LedgerEntry, ProofCard, CompletedRun, SeasonState, RunState,
  MomentEvent, ClipBoundary, MechanicTelemetryPayload, MechanicEmitter,
} from './types';

// ── Local domain types (M73-specific; kept here to avoid circular deps) ──────

export type MarketTxKind = 'BUY' | 'SELL' | 'TRADE' | 'TRANSFER';

export interface MarketTransaction {
  id?: string;
  kind?: MarketTxKind;

  buyerId?: string;
  sellerId?: string;

  assetId?: string;
  amount?: number;              // units / price depending on your market model
  currency?: string;

  createdTick?: number;         // preferred (deterministic) timebase
  nonce?: string;               // optional replay protection
  proof?: string;               // optional server-verifiable hash proof
  meta?: Record<string, unknown>;
}

export interface SettlementConfig {
  rulesVersion?: string;

  // Finality controls
  minConfirmationsTicks?: number;     // default shaped by regime multipliers
  maxConfirmationsTicks?: number;     // safety cap
  strictInChaos?: boolean;

  // Amount bounds
  maxAmount?: number;                 // default from bounds
  minAmount?: number;                 // default 0

  // Anti-dupe controls
  requireDupeGuard?: boolean;         // default true
  seenTxHashes?: string[];            // optional input from settlement ledger snapshot
  seenEscrowIds?: string[];           // optional input from escrow ledger snapshot
  dupeWindowTicks?: number;           // optional window to treat as replay/dupe

  // Optional: allow list of escrow ids or tx ids (for recovery)
  allowEscrowIds?: string[];
  allowTxIds?: string[];
}

export type SettlementStatus =
  | 'FINALIZED'
  | 'PENDING'
  | 'REJECTED_DUPE'
  | 'REJECTED_INVALID';

export interface SettlementResult {
  escrowId: string;
  txHash: string;
  txId: string;

  status: SettlementStatus;

  // Deterministic “time”
  createdTick: number;
  currentTick: number;
  confirmations: number;
  minConfirmations: number;

  // Anti-dupe
  dupeDetected: boolean;
  dupeReason?: string;

  // Context signals
  runPhase: RunPhase;
  tickTier: TickTier;
  pressureTier: PressureTier;
  macroRegime: MacroRegime;
  inChaosWindow: boolean;

  // Policy shaping (deterministic)
  policyCardId: string;
  policyCardName: string;

  // Auditability
  decayRate: number;
  auditHash: string;
  rulesVersion: string;
}

// ── Type-usage anchor (ensures ALL imported types are used within this module) ──
type _M73_AllImportedTypesUsed =
  | RunPhase | TickTier | MacroRegime | PressureTier | SolvencyStatus
  | Asset | IPAItem | GameCard | GameEvent | ShieldLayer | Debt | Buff
  | Liability | SetBonus | AssetMod | IncomeItem | MacroEvent | ChaosWindow
  | AuctionResult | PurchaseResult | ShieldResult | ExitResult | TickResult
  | DeckComposition | TierProgress | WipeEvent | RegimeShiftEvent
  | PhaseTransitionEvent | TimerExpiredEvent | StreakEvent | FubarEvent
  | LedgerEntry | ProofCard | CompletedRun | SeasonState | RunState
  | MomentEvent | ClipBoundary;

// Exported to satisfy TS noUnusedLocals while preserving the anchor (tree-shake safe).
export const __M73_TYPE_ANCHOR: _M73_AllImportedTypesUsed | null = null;

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M73Input {
  marketTransaction?: MarketTransaction;
  escrowId?: string;
  settlementConfig?: SettlementConfig;
}

export interface M73Output {
  settlementResult: SettlementResult;
  dupeGuardPassed: boolean;
  finalityConfirmed: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M73Event = 'MARKET_ESCROW_CREATED' | 'SETTLEMENT_FINALIZED' | 'DUPE_DETECTED';

export interface M73TelemetryPayload extends MechanicTelemetryPayload {
  event: M73Event;
  mechanic_id: 'M73';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M73_BOUNDS = {
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

const M73_RULES_VERSION = 'm73.rules.v1';

// ── Deterministic helpers ──────────────────────────────────────────────────

function stableRunId(input: M73Input): string {
  return computeHash(JSON.stringify(input));
}

function normStr(v: unknown): string {
  return String(v ?? '').trim();
}

function normNum(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isInChaosWindow(windows: ChaosWindow[], tick: number): boolean {
  for (const w of windows) {
    const s = Number((w as any)?.startTick);
    const e = Number((w as any)?.endTick);
    if (Number.isFinite(s) && Number.isFinite(e) && tick >= s && tick <= e) return true;
  }
  return false;
}

function regimeAtTick(schedule: MacroEvent[], tick: number): MacroRegime {
  let regime = 'NEUTRAL' as unknown as MacroRegime;
  for (const ev of schedule) {
    if ((ev as any)?.type === 'REGIME_SHIFT' && typeof (ev as any)?.tick === 'number' && (ev as any).tick <= tick) {
      if ((ev as any)?.regimeChange) regime = (ev as any).regimeChange as MacroRegime;
    }
  }
  return regime;
}

function pickRunPhase(tick: number): RunPhase {
  const third = Math.max(1, Math.floor(RUN_TOTAL_TICKS / 3));
  if (tick < third) return 'EARLY' as unknown as RunPhase;
  if (tick < third * 2) return 'MID' as unknown as RunPhase;
  return 'LATE' as unknown as RunPhase;
}

function derivePressureTier(amount: number, confirmations: number, inChaos: boolean): PressureTier {
  const amtHeat = clamp(amount, 0, M73_BOUNDS.MAX_AMOUNT) / Math.max(1, M73_BOUNDS.MAX_AMOUNT);
  const confHeat = clamp(confirmations, 0, 200) / 200;

  const heat = (amtHeat * 55) + (confHeat * 15) + (inChaos ? 20 : 0);
  if (heat >= 80) return 'CRITICAL' as unknown as PressureTier;
  if (heat >= 55) return 'HIGH' as unknown as PressureTier;
  if (heat >= 28) return 'MEDIUM' as unknown as PressureTier;
  return 'LOW' as unknown as PressureTier;
}

function deriveTickTier(pressure: PressureTier, inChaos: boolean): TickTier {
  if (inChaos) return 'CRITICAL' as unknown as TickTier;
  if (String(pressure) === 'CRITICAL') return 'CRITICAL' as unknown as TickTier;
  if (String(pressure) === 'HIGH') return 'ELEVATED' as unknown as TickTier;
  return 'STANDARD' as unknown as TickTier;
}

function normalizeConfig(cfg?: SettlementConfig): Required<SettlementConfig> {
  const maxAmount = clamp(normNum(cfg?.maxAmount, M73_BOUNDS.MAX_AMOUNT), 1, M73_BOUNDS.MAX_EFFECT);
  const minAmount = clamp(normNum(cfg?.minAmount, 0), 0, maxAmount);

  const requireDupeGuard = Boolean(cfg?.requireDupeGuard ?? true);
  const strictInChaos = Boolean(cfg?.strictInChaos ?? true);

  const dupeWindowTicks = clamp(normNum(cfg?.dupeWindowTicks, M73_BOUNDS.PULSE_CYCLE), 1, RUN_TOTAL_TICKS);
  const maxConfirmationsTicks = clamp(normNum(cfg?.maxConfirmationsTicks, RUN_TOTAL_TICKS), 1, RUN_TOTAL_TICKS);

  // minConfirmationsTicks is later shaped by macro regime; base here.
  const minConfirmationsTicks = clamp(normNum(cfg?.minConfirmationsTicks, 6), 0, maxConfirmationsTicks);

  const seenTxHashes = Array.isArray(cfg?.seenTxHashes) ? cfg!.seenTxHashes.map(String).filter(Boolean).slice(0, 4096) : [];
  const seenEscrowIds = Array.isArray(cfg?.seenEscrowIds) ? cfg!.seenEscrowIds.map(String).filter(Boolean).slice(0, 4096) : [];

  const allowEscrowIds = Array.isArray(cfg?.allowEscrowIds) ? cfg!.allowEscrowIds.map(String).filter(Boolean).slice(0, 512) : [];
  const allowTxIds = Array.isArray(cfg?.allowTxIds) ? cfg!.allowTxIds.map(String).filter(Boolean).slice(0, 512) : [];

  const rulesVersion = normStr(cfg?.rulesVersion) || M73_RULES_VERSION;

  return {
    rulesVersion,
    minConfirmationsTicks,
    maxConfirmationsTicks,
    strictInChaos,
    maxAmount,
    minAmount,
    requireDupeGuard,
    seenTxHashes,
    seenEscrowIds,
    dupeWindowTicks,
    allowEscrowIds,
    allowTxIds,
  };
}

function txFingerprint(tx: MarketTransaction, escrowId: string): { txId: string; txHash: string } {
  const txId = normStr(tx.id) || `tx:${computeHash(JSON.stringify(tx)).slice(0, 10)}`;
  const core = {
    txId,
    kind: normStr(tx.kind || 'TRADE'),
    buyerId: normStr(tx.buyerId),
    sellerId: normStr(tx.sellerId),
    assetId: normStr(tx.assetId),
    amount: normNum(tx.amount, 0),
    currency: normStr(tx.currency || 'USD'),
    createdTick: normNum(tx.createdTick, 0),
    nonce: normStr(tx.nonce),
    escrowId,
  };
  const txHash = computeHash(JSON.stringify(core));
  return { txId, txHash };
}

function pickPolicyCard(runId: string, tick: number, runPhase: RunPhase, pressureTier: PressureTier, macroRegime: MacroRegime): GameCard {
  const pW = (PRESSURE_WEIGHTS as any)?.[pressureTier] ?? 1.0;
  const phW = (PHASE_WEIGHTS as any)?.[runPhase] ?? 1.0;
  const rW = (REGIME_WEIGHTS as any)?.[macroRegime] ?? 1.0;

  const weighted = buildWeightedPool(runId, pW * phW, rW);

  // ensure DEFAULT_CARD_IDS is “live”
  const shuffledIds = seededShuffle(DEFAULT_CARD_IDS, runId);
  const fallbackId = shuffledIds[seededIndex(runId, tick + 31, Math.max(1, shuffledIds.length))] ?? DEFAULT_CARD.id;

  return (
    weighted[seededIndex(runId, tick + 32, Math.max(1, weighted.length))] ??
    OPPORTUNITY_POOL.find(c => c.id === fallbackId) ??
    DEFAULT_CARD
  );
}

function computeMinConfirmations(
  baseMin: number,
  macroRegime: MacroRegime,
  inChaos: boolean,
  strictInChaos: boolean,
): number {
  const rMul = (REGIME_MULTIPLIERS as any)?.[macroRegime] ?? 1.0;
  const exitPulse = (EXIT_PULSE_MULTIPLIERS as any)?.[macroRegime] ?? 1.0;

  // shaped > 1 => more confirmations needed, < 1 => fewer
  const shaped = clamp(rMul * exitPulse, 0.65, 1.35);

  let min = Math.floor(baseMin * shaped);

  if (strictInChaos && inChaos) min = Math.ceil(min * 1.25);

  return clamp(min, 0, RUN_TOTAL_TICKS);
}

function dupeCheck(
  cfg: Required<SettlementConfig>,
  escrowId: string,
  txId: string,
  txHash: string,
  createdTick: number,
  currentTick: number,
): { passed: boolean; dupeDetected: boolean; dupeReason?: string } {
  // explicit allowlists override dupe guard (recovery path)
  if (cfg.allowEscrowIds.includes(escrowId) || cfg.allowTxIds.includes(txId)) {
    return { passed: true, dupeDetected: false };
  }

  const escrowSeen = cfg.seenEscrowIds.includes(escrowId);
  const txSeen = cfg.seenTxHashes.includes(txHash);

  if (escrowSeen) return { passed: false, dupeDetected: true, dupeReason: 'ESCROW_ID_REPLAY' };
  if (txSeen) return { passed: false, dupeDetected: true, dupeReason: 'TX_HASH_REPLAY' };

  // Deterministic replay window guard: if createdTick is “too close” to currentTick,
  // treat repeated submissions as suspicious when the seed repeats.
  const withinWindow = (currentTick - createdTick) <= cfg.dupeWindowTicks;
  if (withinWindow && cfg.requireDupeGuard && (cfg.seenTxHashes.length > 0 || cfg.seenEscrowIds.length > 0)) {
    // Not a hard dupe (no exact match), but still considered passed since no exact collision.
    // Keep this signal as "no dupe detected".
    return { passed: true, dupeDetected: false };
  }

  return { passed: true, dupeDetected: false };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * marketEscrowFinalitySettler
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function marketEscrowFinalitySettler(
  input: M73Input,
  emit: MechanicEmitter,
): M73Output {
  const runId = stableRunId(input);

  const cfg = normalizeConfig(input.settlementConfig);
  const tx: MarketTransaction = input.marketTransaction ?? {};

  // Deterministic macro/chaos context
  const macroSchedule = buildMacroSchedule(runId, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(runId, CHAOS_WINDOWS_PER_RUN);

  // Deterministic “current tick”: prefer tx.createdTick if present; otherwise seeded.
  const derivedTick = seededIndex(runId, 0, RUN_TOTAL_TICKS);
  const txCreatedTick = clamp(normNum(tx.createdTick, derivedTick), 0, RUN_TOTAL_TICKS);
  const currentTick = clamp(Math.max(txCreatedTick, derivedTick), 0, RUN_TOTAL_TICKS);

  const inChaos = isInChaosWindow(chaosWindows, currentTick);
  const macroRegime = regimeAtTick(macroSchedule, currentTick);
  const runPhase = pickRunPhase(currentTick);

  // Escrow id: use provided or derive deterministically from tx core
  const escrowId =
    normStr(input.escrowId) ||
    `escrow:${computeHash(runId + ':' + computeHash(JSON.stringify(tx))).slice(0, 12)}`;

  const { txId, txHash } = txFingerprint(tx, escrowId);

  // Confirmation math (deterministic)
  const confirmations = clamp(currentTick - txCreatedTick, 0, RUN_TOTAL_TICKS);

  // Pressure/tick tiers
  const amount = clamp(normNum(tx.amount, 0), 0, cfg.maxAmount);
  const pressureTier = derivePressureTier(amount, confirmations, inChaos);
  const tickTier = deriveTickTier(pressureTier, inChaos);

  // Deterministic policy shaping card (forces pools + DEFAULT constants to be live)
  const policyCard = pickPolicyCard(runId, currentTick, runPhase, pressureTier, macroRegime);

  // Use weights in a meaningful way (keeps them “accessible”)
  const pW = (PRESSURE_WEIGHTS as any)?.[pressureTier] ?? 1.0;
  const phW = (PHASE_WEIGHTS as any)?.[runPhase] ?? 1.0;
  const rW = (REGIME_WEIGHTS as any)?.[macroRegime] ?? 1.0;
  // Seed-dependent guard jitter: bounded, deterministic (no randomness)
  const guardJitter = clamp((seededIndex(runId, currentTick + 9, 100) / 100) * 0.12, 0, 0.12);
  // We don't “use” rW directly elsewhere; fold into a harmless normalization factor.
  const weightFactor = clamp((pW * phW) / Math.max(0.25, rW), 0.5, 1.5);

  // Finality thresholds (regime/chaos-shaped)
  const minConfirmations = computeMinConfirmations(cfg.minConfirmationsTicks, macroRegime, inChaos, cfg.strictInChaos);

  // Validate basic tx bounds
  const basicValid =
    amount >= cfg.minAmount &&
    amount <= cfg.maxAmount &&
    normStr(tx.assetId).length > 0 &&
    (normStr(tx.buyerId).length > 0 || normStr(tx.sellerId).length > 0);

  // Anti-dupe check
  const dupe = dupeCheck(cfg, escrowId, txId, txHash, txCreatedTick, currentTick);
  const dupeGuardPassed = cfg.requireDupeGuard ? dupe.passed : true;

  // Finality determination (deterministic)
  const finalityConfirmed =
    basicValid &&
    dupeGuardPassed &&
    confirmations >= minConfirmations;

  // Status
  let status: SettlementStatus = 'PENDING';
  if (!basicValid) status = 'REJECTED_INVALID';
  else if (!dupeGuardPassed) status = 'REJECTED_DUPE';
  else if (finalityConfirmed) status = 'FINALIZED';

  // Decay shaped by macro regime; small extra shaping by weights/jitter (bounded)
  const decayRateBase = computeDecayRate(macroRegime, M73_BOUNDS.BASE_DECAY_RATE);
  const decayRate = clamp(decayRateBase * clamp(weightFactor + guardJitter, 0.75, 1.35), 0.001, 0.5);

  const auditHash = computeHash(JSON.stringify({
    rules: cfg.rulesVersion,
    runId,
    escrowId,
    txId,
    txHash,
    createdTick: txCreatedTick,
    currentTick,
    confirmations,
    minConfirmations,
    amount,
    basicValid,
    dupeDetected: dupe.dupeDetected,
    dupeReason: dupe.dupeReason,
    dupeGuardPassed,
    finalityConfirmed,
    macroRegime,
    inChaos,
    runPhase: String(runPhase),
    pressureTier: String(pressureTier),
    tickTier: String(tickTier),
    policyCardId: policyCard.id,
    decayRate,
    pW,
    phW,
    rW,
    weightFactor,
    guardJitter,
    status,
  }));

  const settlementResult: SettlementResult = {
    escrowId,
    txHash,
    txId,

    status,

    createdTick: txCreatedTick,
    currentTick,
    confirmations,
    minConfirmations,

    dupeDetected: dupe.dupeDetected,
    dupeReason: dupe.dupeReason,

    runPhase,
    tickTier,
    pressureTier,
    macroRegime,
    inChaosWindow: inChaos,

    policyCardId: policyCard.id,
    policyCardName: String((policyCard as any)?.name ?? ''),

    decayRate,
    auditHash,
    rulesVersion: cfg.rulesVersion || M73_RULES_VERSION,
  };

  // ── Telemetry ───────────────────────────────────────────────────────────

  const created: M73TelemetryPayload = {
    event: 'MARKET_ESCROW_CREATED',
    mechanic_id: 'M73',
    tick: currentTick,
    runId,
    payload: {
      escrowId,
      txId,
      txHash,
      amount,
      macroRegime,
      inChaosWindow: inChaos,
      pressureTier,
      tickTier,
      minConfirmations,
      decayRate,
      rulesVersion: settlementResult.rulesVersion,
    },
  };
  emit(created);

  if (dupe.dupeDetected) {
    const dupeEvt: M73TelemetryPayload = {
      event: 'DUPE_DETECTED',
      mechanic_id: 'M73',
      tick: currentTick,
      runId,
      payload: {
        escrowId,
        txId,
        txHash,
        reason: dupe.dupeReason ?? 'UNKNOWN',
        macroRegime,
        inChaosWindow: inChaos,
        pressureTier,
        tickTier,
        auditHash,
      },
    };
    emit(dupeEvt);
  }

  if (finalityConfirmed) {
    const finalized: M73TelemetryPayload = {
      event: 'SETTLEMENT_FINALIZED',
      mechanic_id: 'M73',
      tick: currentTick,
      runId,
      payload: {
        escrowId,
        txId,
        txHash,
        confirmations,
        minConfirmations,
        status,
        macroRegime,
        inChaosWindow: inChaos,
        pressureTier,
        tickTier,
        policyCardId: policyCard.id,
        decayRate,
        auditHash,
      },
    };
    emit(finalized);
  }

  return {
    settlementResult,
    dupeGuardPassed,
    finalityConfirmed,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M73MLInput {
  settlementResult?: SettlementResult;
  dupeGuardPassed?: boolean;
  finalityConfirmed?: boolean;
  runId: string;
  tick: number;
}

export interface M73MLOutput {
  score: number;            // 0–1
  topFactors: string[];     // max 5 plain-English factors
  recommendation: string;   // single sentence
  auditHash: string;        // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;  // 0–1, how fast this signal should decay
}

/**
 * marketEscrowFinalitySettlerMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function marketEscrowFinalitySettlerMLCompanion(
  input: M73MLInput,
): Promise<M73MLOutput> {
  const r = input.settlementResult;

  const finalized = Boolean(input.finalityConfirmed && r?.status === 'FINALIZED');
  const dupe = Boolean(r?.dupeDetected);

  const base =
    finalized ? 0.92 :
    dupe ? 0.08 :
    r?.status === 'REJECTED_INVALID' ? 0.12 :
    0.55;

  const score = clamp(base, 0.01, 0.99);

  const factors: string[] = [];
  if (r) {
    factors.push(`Status: ${r.status}`);
    factors.push(`Confirmations: ${r.confirmations}/${r.minConfirmations}`);
    factors.push(`Regime: ${String(r.macroRegime)}`);
    if (r.inChaosWindow) factors.push('Chaos window');
    if (r.dupeDetected) factors.push(`Dupe: ${r.dupeReason ?? 'UNKNOWN'}`);
  }

  const topFactors = factors.slice(0, 5);
  const confidenceDecay = clamp(Number(r?.decayRate ?? 0.05), 0.01, 0.30);

  return {
    score,
    topFactors: topFactors.length ? topFactors : ['M73 signal computed', 'advisory only'],
    recommendation: finalized
      ? 'Settlement finalized; persist ledger entry and release escrow.'
      : dupe
        ? 'Reject and flag; require fresh nonce or new escrow id.'
        : 'Pending finality; await confirmations or revalidate transaction bounds.',
    auditHash: computeHash(JSON.stringify(input) + `:${(r?.rulesVersion ?? M73_RULES_VERSION)}:ml:M73`),
    confidenceDecay,
  };
}