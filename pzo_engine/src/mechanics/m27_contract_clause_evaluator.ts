// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m27_contract_clause_evaluator.ts
//
// Mechanic : M27 — Contract Clause Evaluator
// Family   : coop_contracts   Layer: api_endpoint   Priority: 1   Batch: 1
// ML Pair  : m27a
// Deps     : M26
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

export const M27_IMPORTED_SYMBOLS = {
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

export type M27_ImportedTypesAnchor = {
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

export type ClauseOutcome = 'SATISFIED' | 'BREACHED' | 'NEUTRAL';

export type ClauseOperator = 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'IN' | 'NOT_IN' | 'CONTAINS';

export type ClauseSubject =
  | 'RUN_TICK'
  | 'RUN_PHASE'
  | 'MACRO_REGIME'
  | 'PRESSURE_TIER'
  | 'SOLVENCY_STATUS'
  | 'EVENT_TYPE'
  | 'CARD_ID'
  | 'CASH'
  | 'NET_WORTH'
  | 'STREAK_LENGTH'
  | 'FUBAR_LEVEL';

export interface ClauseDef {
  id: string;
  title: string;
  subject: ClauseSubject;
  op: ClauseOperator;

  // scalar comparisons use `value`, set comparisons use `values`
  value?: string | number | boolean | null;
  values?: Array<string | number | boolean>;

  // severity/weight, deterministic scoring multiplier
  weight: number;

  // optional: only evaluate within a clip window / tick window
  window?: {
    startTick?: number;
    endTick?: number;
  };

  // optional: tags for UI, routing, and analytics
  tags?: string[];
}

export interface ClauseEvalContext {
  tick: number;
  runId: string;
  runPhase: RunPhase;
  macroRegime: MacroRegime;
  pressureTier: PressureTier;
  solvencyStatus: SolvencyStatus;

  cash?: number;
  netWorth?: number;

  lastEventTypes?: string[];
  lastCardId?: string;

  streakLength?: number;
  fubarLevel?: number;

  clipBoundary?: ClipBoundary;
  momentHint?: MomentEvent;
}

export interface ClauseEvalResult {
  contractId: string;
  clauseId: string;
  outcome: ClauseOutcome;
  triggered: boolean;
  satisfied: boolean;
  breached: boolean;

  // bounded score: severity of breach/satisfaction
  score: number; // 0..1

  // explanation for logs / UI
  reason: string;

  // deterministic metadata for proof/verification
  policyTag: string; // card-id tag used as a stable “policy anchor”
  auditHash: string;
  tags: string[];
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M27Input {
  contractId?: string;
  clauseDefinitions?: ClauseDef[];

  // optional evaluation context (recommended)
  context?: ClauseEvalContext;

  // optional canonical seed for determinism
  runSeed?: string;
}

export interface M27Output {
  clauseEvaluated: ClauseEvalResult;
  triggerFired: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M27Event = 'CLAUSE_TRIGGERED' | 'CLAUSE_SATISFIED' | 'CLAUSE_BREACHED';

export interface M27TelemetryPayload extends MechanicTelemetryPayload {
  event: M27Event;
  mechanic_id: 'M27';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M27_BOUNDS = {
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

function classifySolvency(cash: number | undefined): SolvencyStatus {
  const c = typeof cash === 'number' ? cash : 0;
  if (c <= 0) return 'WIPED';
  if (c < M27_BOUNDS.BLEED_CASH_THRESHOLD) return 'BLEED';
  return 'SOLVENT';
}

function inWindow(tick: number, w: ClauseDef['window'] | undefined): boolean {
  if (!w) return true;
  const s = typeof w.startTick === 'number' ? w.startTick : 0;
  const e = typeof w.endTick === 'number' ? w.endTick : RUN_TOTAL_TICKS - 1;
  return tick >= s && tick <= e;
}

function normalizeContext(seed: string, ctxIn: ClauseEvalContext | undefined): ClauseEvalContext {
  const tick = clamp((ctxIn?.tick as number) ?? 0, 0, RUN_TOTAL_TICKS - 1);

  // Deterministic schedules (ensures these imports are “used” in real logic)
  const macroSchedule: MacroEvent[] = buildMacroSchedule(`${seed}:m27`, MACRO_EVENTS_PER_RUN);
  const chaosWindows: ChaosWindow[] = buildChaosWindows(`${seed}:m27`, CHAOS_WINDOWS_PER_RUN);

  const runPhase: RunPhase = (ctxIn?.runPhase as RunPhase) ?? derivePhase(tick);
  const macroRegime: MacroRegime = (ctxIn?.macroRegime as MacroRegime) ?? deriveRegime(tick, macroSchedule);

  const chaosHit = findChaosHit(tick, chaosWindows);
  const pressureTier: PressureTier =
    (ctxIn?.pressureTier as PressureTier) ?? classifyPressure(runPhase, chaosHit);

  const solvencyStatus: SolvencyStatus =
    (ctxIn?.solvencyStatus as SolvencyStatus) ?? classifySolvency(ctxIn?.cash);

  const lastEventTypes = Array.isArray(ctxIn?.lastEventTypes) ? ctxIn!.lastEventTypes : [];
  const lastCardId = typeof ctxIn?.lastCardId === 'string' ? ctxIn!.lastCardId : '';

  return {
    tick,
    runId: String(ctxIn?.runId ?? seed),
    runPhase,
    macroRegime,
    pressureTier,
    solvencyStatus,
    cash: typeof ctxIn?.cash === 'number' ? ctxIn.cash : undefined,
    netWorth: typeof ctxIn?.netWorth === 'number' ? ctxIn.netWorth : undefined,
    lastEventTypes,
    lastCardId,
    streakLength: typeof ctxIn?.streakLength === 'number' ? ctxIn.streakLength : undefined,
    fubarLevel: typeof ctxIn?.fubarLevel === 'number' ? ctxIn.fubarLevel : undefined,
    clipBoundary: ctxIn?.clipBoundary,
    momentHint: ctxIn?.momentHint,
  };
}

function valueForSubject(ctx: ClauseEvalContext, subject: ClauseSubject): unknown {
  switch (subject) {
    case 'RUN_TICK': return ctx.tick;
    case 'RUN_PHASE': return ctx.runPhase;
    case 'MACRO_REGIME': return ctx.macroRegime;
    case 'PRESSURE_TIER': return ctx.pressureTier;
    case 'SOLVENCY_STATUS': return ctx.solvencyStatus;
    case 'EVENT_TYPE': return (ctx.lastEventTypes ?? [])[0] ?? '';
    case 'CARD_ID': return ctx.lastCardId ?? '';
    case 'CASH': return ctx.cash ?? 0;
    case 'NET_WORTH': return ctx.netWorth ?? 0;
    case 'STREAK_LENGTH': return ctx.streakLength ?? 0;
    case 'FUBAR_LEVEL': return ctx.fubarLevel ?? 0;
    default: return undefined;
  }
}

function evalOp(actual: unknown, op: ClauseOperator, value?: unknown, values?: unknown[]): boolean {
  switch (op) {
    case 'EQ': return actual === value;
    case 'NEQ': return actual !== value;
    case 'GT': return Number(actual) > Number(value);
    case 'GTE': return Number(actual) >= Number(value);
    case 'LT': return Number(actual) < Number(value);
    case 'LTE': return Number(actual) <= Number(value);
    case 'IN': return Array.isArray(values) ? values.includes(actual as never) : false;
    case 'NOT_IN': return Array.isArray(values) ? !values.includes(actual as never) : true;
    case 'CONTAINS': {
      if (typeof actual === 'string') return String(actual).includes(String(value ?? ''));
      if (Array.isArray(actual)) return actual.includes(value as never);
      return false;
    }
    default: return false;
  }
}

function pickPolicyTag(seed: string, tick: number, phase: RunPhase, pressure: PressureTier, regime: MacroRegime): string {
  // Uses buildWeightedPool + OPPORTUNITY_POOL + DEFAULT_CARD + DEFAULT_CARD_IDS (real logic)
  const pressurePhaseWeight = (PRESSURE_WEIGHTS[pressure] ?? 1.0) * (PHASE_WEIGHTS[phase] ?? 1.0);
  const regimeWeight = (REGIME_WEIGHTS[regime] ?? 1.0);

  const pool: GameCard[] = buildWeightedPool(`${seed}:m27pool`, pressurePhaseWeight, regimeWeight);
  const poolPick =
    pool[seededIndex(seed, tick + 33, Math.max(1, pool.length))] ??
    OPPORTUNITY_POOL[seededIndex(seed, tick + 17, OPPORTUNITY_POOL.length)] ??
    DEFAULT_CARD;

  const id = String(poolPick.id ?? DEFAULT_CARD.id);
  return DEFAULT_CARD_IDS.includes(id) ? id : DEFAULT_CARD.id;
}

function buildResult(args: {
  contractId: string;
  clause: ClauseDef;
  ctx: ClauseEvalContext;
  outcome: ClauseOutcome;
  policyTag: string;
  satisfied: boolean;
  breached: boolean;
  triggered: boolean;
  reason: string;
  seed: string;
}): ClauseEvalResult {
  // Score shaping uses regime multipliers + pulse + decay (real logic)
  const decay = computeDecayRate(args.ctx.macroRegime, M27_BOUNDS.BASE_DECAY_RATE);
  const pulse = EXIT_PULSE_MULTIPLIERS[args.ctx.macroRegime] ?? 1.0;
  const mult = REGIME_MULTIPLIERS[args.ctx.macroRegime] ?? 1.0;

  const weight = clamp(Number(args.clause.weight ?? 1), 0.1, 10);

  const base =
    args.breached ? 0.65 :
    args.satisfied ? 0.45 :
    0.20;

  const pressureBoost =
    args.ctx.pressureTier === 'CRITICAL' ? 0.22 :
    args.ctx.pressureTier === 'HIGH' ? 0.12 :
    args.ctx.pressureTier === 'MEDIUM' ? 0.06 : 0.02;

  const regimeBoost =
    args.ctx.macroRegime === 'CRISIS' ? 0.20 :
    args.ctx.macroRegime === 'BEAR' ? 0.10 :
    args.ctx.macroRegime === 'BULL' ? 0.06 : 0.03;

  const score = clamp(
    (base + pressureBoost + regimeBoost + clamp((pulse * mult) / 3, 0, 0.12) + clamp((1 - decay) / 2, 0, 0.10)) *
      clamp(weight / 3, 0.5, 2.5),
    0,
    1,
  );

  const tags = seededShuffle(
    Array.from(
      new Set([
        ...(args.clause.tags ?? []),
        `subject:${args.clause.subject.toLowerCase()}`,
        `op:${args.clause.op.toLowerCase()}`,
        `outcome:${args.outcome.toLowerCase()}`,
        `policy:${args.policyTag}`,
        `regime:${args.ctx.macroRegime.toLowerCase()}`,
        `pressure:${args.ctx.pressureTier.toLowerCase()}`,
      ]),
    ),
    `${args.seed}:m27tags:${args.clause.id}:${args.ctx.tick}`,
  );

  const auditHash = computeHash(
    JSON.stringify({
      mid: 'M27',
      contractId: args.contractId,
      clauseId: args.clause.id,
      tick: args.ctx.tick,
      outcome: args.outcome,
      satisfied: args.satisfied,
      breached: args.breached,
      triggered: args.triggered,
      score: Number(score.toFixed(6)),
      policyTag: args.policyTag,
      reason: args.reason,
    }),
  );

  return {
    contractId: args.contractId,
    clauseId: args.clause.id,
    outcome: args.outcome,
    triggered: args.triggered,
    satisfied: args.satisfied,
    breached: args.breached,
    score,
    reason: args.reason,
    policyTag: args.policyTag,
    auditHash,
    tags,
  };
}

function normalizeClauseDefs(seed: string, defs: ClauseDef[] | undefined): ClauseDef[] {
  const base = Array.isArray(defs) ? defs : [];

  if (base.length > 0) return base;

  // Deterministic fallback clause set (safe defaults)
  return [
    {
      id: `cl-${computeHash(`${seed}:default:1`)}`,
      title: 'No Wipe',
      subject: 'SOLVENCY_STATUS',
      op: 'NEQ',
      value: 'WIPED',
      weight: 1.4,
      tags: ['core', 'safety'],
    },
    {
      id: `cl-${computeHash(`${seed}:default:2`)}`,
      title: 'No Chaos Overreach',
      subject: 'PRESSURE_TIER',
      op: 'NEQ',
      value: 'CRITICAL',
      weight: 1.2,
      tags: ['risk', 'chaos'],
    },
    {
      id: `cl-${computeHash(`${seed}:default:3`)}`,
      title: 'Minimum Pace',
      subject: 'RUN_TICK',
      op: 'GTE',
      value: M27_BOUNDS.TRIGGER_THRESHOLD,
      weight: 1.0,
      tags: ['tempo'],
    },
  ];
}

// ── Exec hook ─────────────────────────────────────────────────────────────

export function contractClauseEvaluator(input: M27Input, emit: MechanicEmitter): M27Output {
  const contractId = String(input.contractId ?? '');
  const seed =
    String(input.runSeed ?? '') ||
    computeHash(JSON.stringify({ contractId, defsLen: input.clauseDefinitions?.length ?? 0, ctx: input.context?.runId ?? 'ctx' }));

  const ctx = normalizeContext(seed, input.context);
  const defs = normalizeClauseDefs(seed, input.clauseDefinitions);

  // Deterministic “which clause to evaluate” based on context tick + seed
  const idx = seededIndex(seed, ctx.tick + 271, defs.length);
  const clause = defs[idx] ?? defs[0];

  // Ensure buildMacroSchedule/buildChaosWindows are used as part of evaluation determinism
  const macroSchedule: MacroEvent[] = buildMacroSchedule(`${seed}:m27eval`, MACRO_EVENTS_PER_RUN);
  const chaosWindows: ChaosWindow[] = buildChaosWindows(`${seed}:m27eval`, CHAOS_WINDOWS_PER_RUN);
  const chaosHit = findChaosHit(ctx.tick, chaosWindows);

  // If in chaos window, bump pressure deterministically (bounded)
  const phase = ctx.runPhase ?? derivePhase(ctx.tick);
  const regime = ctx.macroRegime ?? deriveRegime(ctx.tick, macroSchedule);
  const pressure = chaosHit ? 'CRITICAL' : ctx.pressureTier ?? classifyPressure(phase, chaosHit);

  // policy tag ties to deck/pool deterministically
  const policyTag = pickPolicyTag(seed, ctx.tick, phase, pressure, regime);

  const active = inWindow(ctx.tick, clause.window);
  const actual = valueForSubject({ ...ctx, macroRegime: regime, pressureTier: pressure }, clause.subject);

  const passes = active
    ? evalOp(actual, clause.op, clause.value, clause.values)
    : false;

  // Trigger rules:
  // - A clause "fires" when either it is breached OR it is satisfied AND tick is on a pulse boundary
  const pulseBoundary = (ctx.tick % M27_BOUNDS.PULSE_CYCLE) === 0;
  const satisfied = active && passes;
  const breached = active && !passes;

  const triggered =
    breached ||
    (satisfied && pulseBoundary) ||
    (ctx.tick >= M27_BOUNDS.TRIGGER_THRESHOLD && (seededIndex(seed, ctx.tick + 9, 10) >= 8)); // bounded, deterministic rare trigger

  const outcome: ClauseOutcome =
    breached ? 'BREACHED' :
    satisfied ? 'SATISFIED' :
    'NEUTRAL';

  const reason =
    !active ? 'Clause not active in this window.' :
    breached ? `Clause breached: ${clause.subject} ${clause.op} ${String(clause.value ?? clause.values ?? '')} (actual=${String(actual)}).` :
    satisfied ? `Clause satisfied: ${clause.subject} ${clause.op} ${String(clause.value ?? clause.values ?? '')} (actual=${String(actual)}).` :
    'Neutral evaluation.';

  const res = buildResult({
    contractId,
    clause,
    ctx: { ...ctx, macroRegime: regime, pressureTier: pressure },
    outcome,
    policyTag,
    satisfied,
    breached,
    triggered,
    reason,
    seed,
  });

  emit({
    event: 'CLAUSE_TRIGGERED',
    mechanic_id: 'M27',
    tick: ctx.tick,
    runId: contractId || seed,
    payload: {
      contractId,
      clauseId: clause.id,
      clauseTitle: clause.title,
      triggered,
      active,
      subject: clause.subject,
      op: clause.op,
      expected: clause.value ?? clause.values ?? null,
      actual,
      outcome,
      policyTag,
      score: Number(res.score.toFixed(4)),
      auditHash: res.auditHash,
    },
  });

  if (res.outcome === 'SATISFIED') {
    emit({
      event: 'CLAUSE_SATISFIED',
      mechanic_id: 'M27',
      tick: ctx.tick,
      runId: contractId || seed,
      payload: {
        contractId,
        clauseId: clause.id,
        policyTag,
        score: Number(res.score.toFixed(4)),
        tags: res.tags,
      },
    });
  } else if (res.outcome === 'BREACHED') {
    emit({
      event: 'CLAUSE_BREACHED',
      mechanic_id: 'M27',
      tick: ctx.tick,
      runId: contractId || seed,
      payload: {
        contractId,
        clauseId: clause.id,
        policyTag,
        score: Number(res.score.toFixed(4)),
        tags: res.tags,
      },
    });
  }

  return {
    clauseEvaluated: res,
    triggerFired: triggered,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M27MLInput {
  clauseEvaluated?: ClauseEvalResult;
  triggerFired?: boolean;
  runId: string;
  tick: number;
}

export interface M27MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

export async function contractClauseEvaluatorMLCompanion(input: M27MLInput): Promise<M27MLOutput> {
  const tick = clamp(input.tick ?? 0, 0, RUN_TOTAL_TICKS - 1);

  const ce = input.clauseEvaluated;
  const regime: MacroRegime =
    ce?.tags?.some(t => t === 'regime:crisis') ? 'CRISIS' :
    ce?.tags?.some(t => t === 'regime:bear') ? 'BEAR' :
    ce?.tags?.some(t => t === 'regime:bull') ? 'BULL' :
    'NEUTRAL';

  const pressure: PressureTier =
    ce?.tags?.some(t => t === 'pressure:critical') ? 'CRITICAL' :
    ce?.tags?.some(t => t === 'pressure:high') ? 'HIGH' :
    ce?.tags?.some(t => t === 'pressure:medium') ? 'MEDIUM' :
    'LOW';

  const decay = computeDecayRate(regime, M27_BOUNDS.BASE_DECAY_RATE);
  const pulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const mult = REGIME_MULTIPLIERS[regime] ?? 1.0;

  const severity = clamp(Number(ce?.score ?? 0), 0, 1);
  const fired = Boolean(input.triggerFired);

  const base = fired ? 0.55 : 0.25;
  const score = clamp(
    base +
      severity * 0.25 +
      clamp((pulse * mult) / 3, 0, 0.12) +
      clamp((1 - decay) / 2, 0, 0.10),
    0.01,
    0.99,
  );

  const topFactors = [
    `triggered=${fired}`,
    `severity=${severity.toFixed(2)}`,
    `pressure=${pressure}`,
    `regime=${regime}`,
    `tick=${tick}/${RUN_TOTAL_TICKS}`,
  ].slice(0, 5);

  const recommendation =
    fired && severity >= 0.70
      ? 'Enforce immediately: pause co-op actions, log the breach, and apply the contract remedy.'
      : fired
        ? 'Trigger detected: verify context, log the event, and tighten constraints.'
        : 'No trigger: keep monitoring clauses, especially on pulse boundaries.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify({ mid: 'M27', ...input, regime, pressure, decay, pulse, mult }) + ':ml:M27'),
    confidenceDecay: decay,
  };
}