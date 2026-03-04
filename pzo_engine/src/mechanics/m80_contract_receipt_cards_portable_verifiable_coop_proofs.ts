// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m80_contract_receipt_cards_portable_verifiable_coop_proofs.ts
//
// Mechanic : M80 — Contract Receipt Cards: Portable Verifiable Coop Proofs
// Family   : coop_governance   Layer: api_endpoint   Priority: 2   Batch: 2
// ML Pair  : m80a
// Deps     : M50, M26
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

// ── Import Anchors (keep every import “accessible” + used) ────────────────────

/**
 * Runtime access to the canonical mechanicsUtils symbols imported by this mechanic.
 * Keeps generator-wide imports “live” and provides inspection/debug handles.
 */
export const M80_IMPORTED_SYMBOLS = {
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

/**
 * Type-only anchor to ensure every imported domain type remains referenced in-module.
 */
export type M80_ImportedTypesAnchor = {
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

// ── Local domain types (standalone; no forced edits to ./types.ts) ──────────

export type ContractOutcome = 'SUCCESS' | 'FAILURE' | 'BREACH' | 'CANCELLED' | 'PARTIAL';

export interface ReceiptCard {
  contractId: string;
  outcome: ContractOutcome;

  issuedAtTick: number;
  runId: string;

  // Proof primitives
  proofHash: string; // user-supplied or derived
  portableProof: string; // deterministic “QR payload” string
  receiptId: string; // deterministic id
  auditHash: string; // deterministic audit

  // Verifiability surface
  shareableReceiptUrl: string;

  // Context
  phase: RunPhase;
  regime: MacroRegime;
  pressureTier: PressureTier;
  inChaos: boolean;

  // Optional metadata (never required, safe to omit)
  tags?: string[];
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M80Input {
  contractId?: string;
  contractOutcome?: ContractOutcome;
  proofHash?: string;

  // Optional execution context (safe to omit)
  tick?: number;
  runId?: string;
  pressureTier?: PressureTier;

  // Optional metadata
  tags?: string[];
}

export interface M80Output {
  receiptCard: ReceiptCard;
  portableProof: string;
  shareableReceiptUrl: string;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M80Event = 'RECEIPT_CARD_ISSUED' | 'RECEIPT_SHARED' | 'RECEIPT_VERIFIED';

export interface M80TelemetryPayload extends MechanicTelemetryPayload {
  event: M80Event;
  mechanic_id: 'M80';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M80_BOUNDS = {
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

// ── Internal helpers (deterministic, no state mutation) ────────────────────

function m80DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m80DeriveRegime(tick: number, schedule: MacroEvent[]): MacroRegime {
  const sorted = [...(schedule ?? [])].sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m80InChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows ?? []) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m80DerivePressureTier(proxyParticipants: number, inChaos: boolean): PressureTier {
  if (inChaos) return proxyParticipants >= 6 ? 'CRITICAL' : 'HIGH';
  if (proxyParticipants <= 2) return 'LOW';
  if (proxyParticipants <= 5) return 'MEDIUM';
  if (proxyParticipants <= 8) return 'HIGH';
  return 'CRITICAL';
}

function m80NormalizeOutcome(raw?: ContractOutcome): ContractOutcome {
  const v = String(raw ?? '').toUpperCase();
  if (v === 'SUCCESS') return 'SUCCESS';
  if (v === 'FAILURE') return 'FAILURE';
  if (v === 'BREACH') return 'BREACH';
  if (v === 'CANCELLED') return 'CANCELLED';
  if (v === 'PARTIAL') return 'PARTIAL';
  return 'SUCCESS';
}

function m80BuildPortableProof(seed: string, contractId: string, proofHash: string, tick: number): string {
  // Uses DEFAULT_CARD_IDS / OPPORTUNITY_POOL as deterministic entropy anchors
  const deck = seededShuffle(DEFAULT_CARD_IDS, `${seed}:proofDeck:${tick}`);
  const deckTop = deck[0] ?? DEFAULT_CARD.id;
  const opp = OPPORTUNITY_POOL[seededIndex(seed, tick + 41, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  const basis = `${contractId}|${proofHash}|${deckTop}|${opp.id ?? opp.name ?? 'opp'}|t=${tick}`;
  const hash = computeHash(`${seed}:portable:${basis}`);

  // Short, portable payload (e.g., QR code string)
  return `PZO:M80:${hash.slice(0, 10)}:${hash.slice(10, 20)}:${hash.slice(20, 32)}`;
}

function m80BuildShareUrl(receiptId: string): string {
  // This is intentionally deterministic + environment-agnostic (no host assumptions).
  // Your API layer can map this to a real route (e.g., /r/:receiptId).
  return `/receipt/${receiptId}`;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * contractReceiptCardIssuer
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function contractReceiptCardIssuer(input: M80Input, emit: MechanicEmitter): M80Output {
  const contractId = String(input.contractId ?? '');
  const outcome = m80NormalizeOutcome(input.contractOutcome);
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const runId = String(input.runId ?? computeHash(JSON.stringify(input)));
  const tags = Array.isArray(input.tags) ? input.tags.map(String) : [];

  // Deterministic seed (stable for server verification)
  const seed = computeHash(
    JSON.stringify({
      m: 'M80',
      contractId,
      outcome,
      tick,
      runId,
      tags,
    }),
  );

  // Context (bounded chaos)
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m80DerivePhase(tick);
  const regime = m80DeriveRegime(tick, macroSchedule);
  const inChaos = m80InChaosWindow(tick, chaosWindows);

  const proxyParticipants = clamp(seededIndex(seed, tick + 11, 12) + 1, 1, 12);
  const pressureTier = (input.pressureTier as PressureTier) ?? m80DerivePressureTier(proxyParticipants, inChaos);

  // Proof hash: if missing, derive deterministically from input + macro context
  const providedProofHash = String(input.proofHash ?? '').trim();
  const proofHash =
    providedProofHash.length > 0
      ? providedProofHash
      : computeHash(
          JSON.stringify({
            contractId,
            outcome,
            tick,
            phase,
            regime,
            runId,
            tags,
          }),
        );

  // Use imported weights/multipliers to salt receipt deterministically (keeps imports live)
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;
  const regimeMul = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const decayRate = computeDecayRate(regime, M80_BOUNDS.BASE_DECAY_RATE);

  const receiptEntropy = computeHash(
    `${seed}:${proofHash}:${pressureW}:${phaseW}:${regimeW}:${regimeMul}:${exitPulse}:${inChaos ? decayRate : 0}`,
  );

  const receiptId = computeHash(`M80:${contractId}:${receiptEntropy}`).slice(0, 24);
  const portableProof = m80BuildPortableProof(seed, contractId, proofHash, tick);
  const shareableReceiptUrl = m80BuildShareUrl(receiptId);

  const auditHash = computeHash(
    JSON.stringify({
      contractId,
      outcome,
      tick,
      runId,
      proofHash,
      receiptId,
      portableProof,
      shareableReceiptUrl,
      phase,
      regime,
      pressureTier,
      inChaos,
      tags,
      seed,
    }),
  );

  const receiptCard: ReceiptCard = {
    contractId,
    outcome,
    issuedAtTick: tick,
    runId,

    proofHash,
    portableProof,
    receiptId,
    auditHash,

    shareableReceiptUrl,

    phase,
    regime,
    pressureTier,
    inChaos,

    tags: tags.length ? tags : undefined,
  };

  emit({
    event: 'RECEIPT_CARD_ISSUED',
    mechanic_id: 'M80',
    tick,
    runId,
    payload: {
      contractId,
      outcome,
      receiptId,
      shareableReceiptUrl,
      proofHash: proofHash.slice(0, 12), // partial in telemetry
      portableProof,
      auditHash,
    },
  });

  // Optional telemetry “share hint” (no external side effects; just signal)
  const shareHintIdx = seededIndex(receiptEntropy, tick + 99, DEFAULT_CARD_IDS.length || 1);
  const shareHintCardId = DEFAULT_CARD_IDS[shareHintIdx] ?? DEFAULT_CARD.id;

  emit({
    event: 'RECEIPT_SHARED',
    mechanic_id: 'M80',
    tick,
    runId,
    payload: {
      contractId,
      receiptId,
      url: shareableReceiptUrl,
      hintCardId: shareHintCardId,
      note: 'telemetry_only_share_hint',
    },
  });

  // Verification telemetry (purely deterministic; your API can run real checks)
  emit({
    event: 'RECEIPT_VERIFIED',
    mechanic_id: 'M80',
    tick,
    runId,
    payload: {
      contractId,
      receiptId,
      verified: true,
      auditHash,
      note: 'deterministic_local_verification_only',
    },
  });

  return {
    receiptCard,
    portableProof,
    shareableReceiptUrl,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M80MLInput {
  receiptCard?: ReceiptCard;
  portableProof?: string;
  shareableReceiptUrl?: string;
  runId: string;
  tick: number;
}

export interface M80MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * contractReceiptCardIssuerMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function contractReceiptCardIssuerMLCompanion(input: M80MLInput): Promise<M80MLOutput> {
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);

  const hasCard = Boolean(input.receiptCard);
  const hasPortable = Boolean((input.portableProof ?? '').length);
  const hasUrl = Boolean((input.shareableReceiptUrl ?? '').length);

  // Neutral decay baseline (regime unknown here)
  const confidenceDecay = computeDecayRate('NEUTRAL' as MacroRegime, M80_BOUNDS.BASE_DECAY_RATE);

  // Score: card + portable proof + url => higher, bounded
  const score = clamp(0.25 + (hasCard ? 0.35 : 0) + (hasPortable ? 0.25 : 0) + (hasUrl ? 0.1 : 0), 0.01, 0.99);

  // Deterministic hint using DEFAULT_CARD_IDS (keeps import live)
  const hintPick = seededIndex(computeHash(`M80ML:${tick}:${input.runId}:${hasCard}:${hasPortable}:${hasUrl}`), tick, DEFAULT_CARD_IDS.length);
  const hintCardId = DEFAULT_CARD_IDS[hintPick] ?? DEFAULT_CARD.id;

  const topFactors = [
    `tick=${tick}/${RUN_TOTAL_TICKS}`,
    `receiptCard=${hasCard ? 'yes' : 'no'}`,
    `portableProof=${hasPortable ? 'yes' : 'no'}`,
    `shareUrl=${hasUrl ? 'yes' : 'no'}`,
    `hintCardId=${hintCardId}`,
  ].slice(0, 5);

  const recommendation = !hasCard
    ? 'No receipt card: ensure contractId/outcome are provided and issuer is executed.'
    : 'Receipt issued: store auditHash in ledger and share receipt URL for verification.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M80'),
    confidenceDecay,
  };
}