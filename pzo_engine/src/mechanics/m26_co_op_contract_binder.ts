// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m26_co_op_contract_binder.ts
//
// Mechanic : M26 — Co-op Contract Binder
// Family   : coop_contracts   Layer: api_endpoint   Priority: 1   Batch: 1
// ML Pair  : m26a
// Deps     : none
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

// ── Import Anchors (keeps every symbol “accessible” + TS-used) ───────────────

export const M26_IMPORTED_SYMBOLS = {
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

export type M26_ImportedTypesAnchor = {
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

// ── Local schema (kept here to avoid cross-module coupling) ──────────────────

export type ContractScope = 'COOP_RUN' | 'COOP_SEASON' | 'COOP_EVENT';

export type ContractStatus = 'DRAFT' | 'BOUND' | 'VOID';

export interface ContractClause {
  id: string;
  title: string;
  body: string;
  weight: number; // deterministic severity/importance scalar
}

export interface ContractDraft {
  scope: ContractScope;
  title: string;
  description: string;

  // Optional economic terms (UI only; enforcement can be server-side)
  stakeAmount?: number;

  // Deterministic clause set
  clauses: ContractClause[];

  // Optional tagging
  tags?: string[];

  // Optional seedSalt for versioning
  seedSalt?: string;
}

export interface ParticipantSignature {
  participantId: string;
  signedAtTick: number;
  signatureHash: string;
}

export interface BindingResult {
  status: ContractStatus;

  contractId: string;
  scope: ContractScope;

  participantIds: string[];
  signatures: ParticipantSignature[];

  // Deterministic policy keys (used by server verification)
  policyHash: string;
  auditHash: string;

  // Optional hints for UI/telemetry
  effectiveTick: number;
  expiresTick: number;
  clauseCount: number;
  stakeAmount: number;
  pressureTier: PressureTier;
  macroRegime: MacroRegime;
  runPhase: RunPhase;

  // Optional proof artifacts (server can validate)
  proofCardHint: ProofCard;
  ledgerHint: LedgerEntry;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M26Input {
  contractDraft?: ContractDraft;
  participantIds?: string[];

  // Optional canonical request context
  runId?: string;
  runSeed?: string;
  tick?: number;
}

export interface M26Output {
  contractId: string;
  bindingResult: BindingResult;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M26Event = 'CONTRACT_DRAFTED' | 'CONTRACT_BOUND' | 'PARTICIPANT_SIGNED';

export interface M26TelemetryPayload extends MechanicTelemetryPayload {
  event: M26Event;
  mechanic_id: 'M26';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M26_BOUNDS = {
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

// ── Helpers ───────────────────────────────────────────────────────────────

function derivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function deriveRegime(tick: number, schedule: MacroEvent[]): MacroRegime {
  if (!schedule || schedule.length === 0) return 'NEUTRAL';
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function findChaosHit(tick: number, windows: ChaosWindow[]): ChaosWindow | null {
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return w;
  }
  return null;
}

function classifyPressure(phase: RunPhase, chaosHit: ChaosWindow | null): PressureTier {
  if (chaosHit) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function normalizeDraft(draft: ContractDraft | undefined, seed: string): ContractDraft {
  if (draft) return draft;

  // Deterministic “default contract” (safe fallback)
  const clauses: ContractClause[] = [
    { id: `cl-${computeHash(`${seed}:c1`)}`, title: 'No Griefing', body: 'No deliberate sabotage or intentional wipes.', weight: 1.0 },
    { id: `cl-${computeHash(`${seed}:c2`)}`, title: 'Proof-First', body: 'Decisions must be explainable and logged for verification.', weight: 1.0 },
    { id: `cl-${computeHash(`${seed}:c3`)}`, title: 'Bounded Risk', body: 'Risk caps apply during chaos windows and elevated regimes.', weight: 1.2 },
  ];

  return {
    scope: 'COOP_RUN',
    title: 'Co-op Contract',
    description: 'Deterministic co-op ruleset for shared runs.',
    stakeAmount: Math.round(M26_BOUNDS.MAX_AMOUNT * 0.10),
    clauses,
    tags: ['coop', 'contract'],
  };
}

function normalizeParticipants(ids: string[] | undefined): string[] {
  const base = Array.isArray(ids) ? ids : [];
  const norm = base.map((s) => String(s).trim()).filter((s) => s.length > 0);
  // De-dupe while keeping order
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of norm) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function computeClauseWeightSum(clauses: ContractClause[]): number {
  let sum = 0;
  for (const c of clauses) sum += clamp(Number(c.weight ?? 1), 0.1, 10);
  return sum;
}

function pickPolicyCardTag(seed: string, tick: number, phase: RunPhase, pressure: PressureTier, regime: MacroRegime): string {
  // Uses buildWeightedPool + OPPORTUNITY_POOL + DEFAULT_CARD + DEFAULT_CARD_IDS (real logic)
  const pressurePhaseWeight = (PRESSURE_WEIGHTS[pressure] ?? 1.0) * (PHASE_WEIGHTS[phase] ?? 1.0);
  const regimeWeight = (REGIME_WEIGHTS[regime] ?? 1.0);
  const pool: GameCard[] = buildWeightedPool(`${seed}:m26pool`, pressurePhaseWeight, regimeWeight);

  const poolPick =
    pool[seededIndex(seed, tick + 33, Math.max(1, pool.length))] ??
    OPPORTUNITY_POOL[seededIndex(seed, tick + 17, OPPORTUNITY_POOL.length)] ??
    DEFAULT_CARD;

  const id = String(poolPick.id ?? DEFAULT_CARD.id);
  return DEFAULT_CARD_IDS.includes(id) ? id : DEFAULT_CARD.id;
}

function deriveStake(draft: ContractDraft, seed: string, tick: number, regime: MacroRegime, pressure: PressureTier): number {
  const base = clamp(Number(draft.stakeAmount ?? 0), 0, M26_BOUNDS.MAX_AMOUNT);

  const decay = computeDecayRate(regime, M26_BOUNDS.BASE_DECAY_RATE);
  const pulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const mult = REGIME_MULTIPLIERS[regime] ?? 1.0;

  const pw = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const rw = REGIME_WEIGHTS[regime] ?? 1.0;

  const cycle = (tick % M26_BOUNDS.PULSE_CYCLE) / M26_BOUNDS.PULSE_CYCLE;
  const riskScalar = clamp((pw * rw) * (pulse * mult) / Math.max(0.05, decay), 0.5, 6.0);

  const seededBump = 0.85 + 0.30 * (seededIndex(seed, tick + 91, 100) / 99);
  const stake = base > 0 ? base : Math.round(M26_BOUNDS.MAX_AMOUNT * 0.08);

  const out = stake * clamp(riskScalar / 3, 0.5, 2.0) * seededBump * (0.90 + 0.25 * cycle);
  return Math.round(clamp(out, 0, M26_BOUNDS.MAX_AMOUNT));
}

function buildSignatures(seed: string, tick: number, participantIds: string[]): ParticipantSignature[] {
  const signatures: ParticipantSignature[] = [];
  for (let i = 0; i < participantIds.length; i++) {
    const pid = participantIds[i]!;
    const signedAtTick = clamp(tick + seededIndex(seed, tick + i + 13, 5), 0, RUN_TOTAL_TICKS - 1);
    const signatureHash = computeHash(`${seed}:sig:${pid}:${signedAtTick}`);
    signatures.push({ participantId: pid, signedAtTick, signatureHash });
  }
  return signatures;
}

function buildDefaultLedger(contractId: string, tick: number, policyHash: string): LedgerEntry {
  return {
    gameAction: {
      type: 'COOP_CONTRACT_BIND',
      contractId,
      policyHash,
    },
    tick,
    hash: computeHash(`${contractId}:${policyHash}:ledger:${tick}`),
  };
}

function buildDefaultProof(contractId: string, stakeAmount: number, regime: MacroRegime, pressure: PressureTier): ProofCard {
  const difficulty =
    (pressure === 'CRITICAL' ? 0.35 : pressure === 'HIGH' ? 0.20 : pressure === 'MEDIUM' ? 0.12 : 0.06) +
    (regime === 'CRISIS' ? 0.35 : regime === 'BEAR' ? 0.18 : regime === 'BULL' ? 0.08 : 0.05);

  const score = clamp(difficulty + clamp(stakeAmount / M26_BOUNDS.MAX_AMOUNT, 0, 1) * 0.20, 0, 1);

  return {
    runId: contractId,
    cordScore: Math.round(score * 1000) / 10,
    hash: computeHash(`${contractId}:proof`),
    grade: score >= 0.85 ? 'S' : score >= 0.70 ? 'A' : score >= 0.55 ? 'B' : 'C',
  };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

export function coopContractBinder(input: M26Input, emit: MechanicEmitter): M26Output {
  const participantIds = normalizeParticipants(input.participantIds);

  const runId = String(input.runId ?? '');
  const tickRaw = (input.tick as number) ?? participantIds.length;

  const requestSeed =
    String(input.runSeed ?? '') ||
    computeHash(JSON.stringify({ runId, participantIds, draftTitle: input.contractDraft?.title ?? 'Co-op Contract' }));

  const tick = clamp(tickRaw, 0, RUN_TOTAL_TICKS - 1);

  // Deterministic macro/chaos context (uses buildMacroSchedule/buildChaosWindows/constants)
  const macroSchedule: MacroEvent[] = buildMacroSchedule(`${requestSeed}:m26`, MACRO_EVENTS_PER_RUN);
  const chaosWindows: ChaosWindow[] = buildChaosWindows(`${requestSeed}:m26`, CHAOS_WINDOWS_PER_RUN);

  const phase = derivePhase(tick);
  const regime = deriveRegime(tick, macroSchedule);
  const chaosHit = findChaosHit(tick, chaosWindows);
  const pressure = classifyPressure(phase, chaosHit);

  const draft = normalizeDraft(input.contractDraft, requestSeed);

  const contractId = computeHash(
    JSON.stringify({
      mid: 'M26',
      scope: draft.scope,
      title: draft.title,
      seedSalt: draft.seedSalt ?? '',
      participantIds,
      tick,
    }),
  ).slice(0, 16);

  const clauseCount = draft.clauses.length;
  const clauseWeightSum = computeClauseWeightSum(draft.clauses);

  const cardTag = pickPolicyCardTag(requestSeed, tick, phase, pressure, regime);
  const stakeAmount = deriveStake(draft, requestSeed, tick, regime, pressure);

  const signatures = buildSignatures(requestSeed, tick, participantIds);

  // Deterministic timing bounds for contract effectiveness
  const effectiveTick = clamp(tick + 1, 0, RUN_TOTAL_TICKS - 1);
  const expiresTick = clamp(effectiveTick + clamp(M26_BOUNDS.PULSE_CYCLE + Math.round(clauseWeightSum), 6, 60), 0, RUN_TOTAL_TICKS - 1);

  const policyHash = computeHash(
    JSON.stringify({
      contractId,
      scope: draft.scope,
      clauseCount,
      clauseWeightSum,
      participantIds,
      cardTag,
      stakeAmount,
      regime,
      phase,
      pressure,
      effectiveTick,
      expiresTick,
    }),
  );

  const auditHash = computeHash(`${policyHash}:audit:M26`);

  const proofCardHint = buildDefaultProof(contractId, stakeAmount, regime, pressure);
  const ledgerHint = buildDefaultLedger(contractId, tick, policyHash);

  emit({
    event: 'CONTRACT_DRAFTED',
    mechanic_id: 'M26',
    tick,
    runId: contractId,
    payload: {
      contractId,
      runId: runId || null,
      scope: draft.scope,
      title: draft.title,
      participantCount: participantIds.length,
      clauseCount,
      clauseWeightSum: Number(clauseWeightSum.toFixed(3)),
      regime,
      phase,
      pressure,
      cardTag,
      stakeAmount,
    },
  });

  for (const sig of signatures) {
    emit({
      event: 'PARTICIPANT_SIGNED',
      mechanic_id: 'M26',
      tick: sig.signedAtTick,
      runId: contractId,
      payload: {
        contractId,
        participantId: sig.participantId,
        signedAtTick: sig.signedAtTick,
        signatureHash: sig.signatureHash,
      },
    });
  }

  emit({
    event: 'CONTRACT_BOUND',
    mechanic_id: 'M26',
    tick,
    runId: contractId,
    payload: {
      contractId,
      status: 'BOUND',
      policyHash,
      auditHash,
      effectiveTick,
      expiresTick,
      proofCard: { hash: proofCardHint.hash, grade: proofCardHint.grade, cordScore: proofCardHint.cordScore },
      ledger: { hash: ledgerHint.hash },
    },
  });

  const bindingResult: BindingResult = {
    status: 'BOUND',
    contractId,
    scope: draft.scope,
    participantIds,
    signatures,
    policyHash,
    auditHash,
    effectiveTick,
    expiresTick,
    clauseCount,
    stakeAmount,
    pressureTier: pressure,
    macroRegime: regime,
    runPhase: phase,
    proofCardHint,
    ledgerHint,
  };

  return {
    contractId,
    bindingResult,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M26MLInput {
  contractId?: string;
  bindingResult?: BindingResult;
  runId: string;
  tick: number;
}

export interface M26MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

export async function coopContractBinderMLCompanion(input: M26MLInput): Promise<M26MLOutput> {
  const tick = clamp(input.tick ?? 0, 0, RUN_TOTAL_TICKS - 1);

  const br = input.bindingResult;
  const regime: MacroRegime = br?.macroRegime ?? 'NEUTRAL';
  const pressure: PressureTier = br?.pressureTier ?? 'LOW';

  const decay = computeDecayRate(regime, M26_BOUNDS.BASE_DECAY_RATE);
  const pulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const mult = REGIME_MULTIPLIERS[regime] ?? 1.0;

  const stake = clamp(Number(br?.stakeAmount ?? 0), 0, M26_BOUNDS.MAX_AMOUNT);
  const participantCount = clamp(Number(br?.participantIds?.length ?? 0), 0, 8);

  const pressureBoost =
    pressure === 'CRITICAL' ? 0.18 :
    pressure === 'HIGH' ? 0.12 :
    pressure === 'MEDIUM' ? 0.07 : 0.03;

  const stakeBoost = clamp(stake / M26_BOUNDS.MAX_AMOUNT, 0, 1) * 0.20;
  const coopBoost = clamp(participantCount / 6, 0, 1) * 0.15;

  const score = clamp(
    0.20 +
      pressureBoost +
      stakeBoost +
      coopBoost +
      clamp((pulse * mult) / 3, 0, 0.14) +
      clamp((1 - decay) / 2, 0, 0.12),
    0.01,
    0.99,
  );

  const topFactors = [
    `participants=${participantCount}`,
    `stake=${Math.round(stake)}`,
    `pressure=${pressure}`,
    `regime=${regime}`,
    `decay=${decay.toFixed(2)}`,
  ].slice(0, 5);

  const recommendation =
    score >= 0.75
      ? 'Contract is high-signal: enforce risk caps, log decisions, and clip pivots for proof.'
      : score >= 0.55
        ? 'Contract is workable: keep clauses simple, verify compliance, and avoid chaos-window overreach.'
        : 'Contract is low-signal: reduce scope, lower stake, and bind only essential clauses.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify({ mid: 'M26', ...input, regime, pressure, decay, pulse, mult }) + ':ml:M26'),
    confidenceDecay: decay,
  };
}