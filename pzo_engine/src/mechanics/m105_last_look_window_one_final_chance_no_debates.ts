// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m105_last_look_window_one_final_chance_no_debates.ts
//
// Mechanic : M105 — Last Look Window: One Final Chance No Debates
// Family   : portfolio_experimental   Layer: card_handler   Priority: 2   Batch: 3
// ML Pair  : m105a
// Deps     : M09
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

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M105Input {
  lastLookTrigger?: unknown;
  stateTick?: number;
  windowDuration?: number;
}

export interface M105Output {
  lastLookOpened: boolean;
  finalDecision: string | null;
  windowExpired: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M105Event = 'LAST_LOOK_OPENED' | 'FINAL_DECISION_MADE' | 'WINDOW_EXPIRED';

export interface M105TelemetryPayload extends MechanicTelemetryPayload {
  event: M105Event;
  mechanic_id: 'M105';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M105_BOUNDS = {
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

// ── Type Touch Anchor (ensures every imported type is referenced in-code) ───

export type M105TypeTouch = {
  RunPhase: RunPhase;
  TickTier: TickTier;
  MacroRegime: MacroRegime;
  PressureTier: PressureTier;
  SolvencyStatus: SolvencyStatus;

  Asset: Asset;
  IPAItem: IPAItem;
  GameCard: GameCard;
  GameEvent: GameEvent;
  ShieldLayer: ShieldLayer;
  Debt: Debt;
  Buff: Buff;
  Liability: Liability;
  SetBonus: SetBonus;
  AssetMod: AssetMod;
  IncomeItem: IncomeItem;

  MacroEvent: MacroEvent;
  ChaosWindow: ChaosWindow;

  AuctionResult: AuctionResult;
  PurchaseResult: PurchaseResult;
  ShieldResult: ShieldResult;
  ExitResult: ExitResult;
  TickResult: TickResult;
  DeckComposition: DeckComposition;
  TierProgress: TierProgress;

  WipeEvent: WipeEvent;
  RegimeShiftEvent: RegimeShiftEvent;
  PhaseTransitionEvent: PhaseTransitionEvent;
  TimerExpiredEvent: TimerExpiredEvent;
  StreakEvent: StreakEvent;
  FubarEvent: FubarEvent;

  LedgerEntry: LedgerEntry;
  ProofCard: ProofCard;
  CompletedRun: CompletedRun;

  SeasonState: SeasonState;
  RunState: RunState;

  MomentEvent: MomentEvent;
  ClipBoundary: ClipBoundary;

  MechanicTelemetryPayload: MechanicTelemetryPayload;
  MechanicEmitter: MechanicEmitter;
};

// ── Internal helpers ──────────────────────────────────────────────────────

type LastLookTriggerShape = {
  open?: boolean;
  forceOpen?: boolean;
  openedAt?: number;
  opened_at?: number;
  windowOpenedAt?: number;

  decision?: string | null;
  finalDecision?: string | null;
  decisionAt?: number;
  decision_at?: number;

  reason?: string;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function toSafeString(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

function toSafeNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function resolveRunPhase(tick: number, hint: unknown): RunPhase {
  const s = typeof hint === 'string' ? hint : '';
  if (s === 'EARLY' || s === 'MID' || s === 'LATE') return s;

  const pct = RUN_TOTAL_TICKS > 0 ? clamp(tick / RUN_TOTAL_TICKS, 0, 0.9999) : 0;
  if (pct < 0.3333) return 'EARLY';
  if (pct < 0.6666) return 'MID';
  return 'LATE';
}

function resolvePressureTier(hint: unknown): PressureTier {
  const s = typeof hint === 'string' ? hint : '';
  if (s === 'LOW' || s === 'MEDIUM' || s === 'HIGH' || s === 'CRITICAL') return s;
  return 'MEDIUM';
}

function resolveMacroRegime(seed: string, tick: number, hint: unknown): MacroRegime {
  const base = ((): MacroRegime => {
    const s = typeof hint === 'string' ? hint : '';
    if (s === 'BULL' || s === 'NEUTRAL' || s === 'BEAR' || s === 'CRISIS') return s;
    return 'NEUTRAL';
  })();

  // Deterministically advance through schedule up to current tick
  const schedule = buildMacroSchedule(seed + ':M105:macro', MACRO_EVENTS_PER_RUN)
    .slice()
    .sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));

  let regime: MacroRegime = base;
  for (const e of schedule) {
    const t = typeof e.tick === 'number' ? e.tick : 0;
    if (t <= tick && e.regimeChange) regime = e.regimeChange as MacroRegime;
  }
  return regime;
}

function isChaosActive(seed: string, tick: number): boolean {
  const windows = buildChaosWindows(seed + ':M105:chaos', CHAOS_WINDOWS_PER_RUN);
  for (const w of windows) {
    const s = typeof w.startTick === 'number' ? w.startTick : 0;
    const e = typeof w.endTick === 'number' ? w.endTick : 0;
    if (tick >= s && tick <= e) return true;
  }
  return false;
}

function resolveDeck(rawDeck: unknown, seed: string): GameCard[] {
  if (Array.isArray(rawDeck)) {
    // Accept array of GameCard-like or array of ids (string) with safe mapping.
    const byId = new Map(OPPORTUNITY_POOL.map(c => [c.id, c]));
    if (rawDeck.every(x => typeof x === 'string')) {
      const mapped = (rawDeck as string[]).map(id => byId.get(id) ?? DEFAULT_CARD);
      return mapped.length > 0 ? mapped : seededShuffle(OPPORTUNITY_POOL, seed + ':M105:deck');
    }
    if (rawDeck.every(x => isObject(x) && typeof (x as any).id === 'string')) {
      return rawDeck as GameCard[];
    }
  }
  return seededShuffle(OPPORTUNITY_POOL, seed + ':M105:deck');
}

function normalizeCardId(id: string): string {
  return DEFAULT_CARD_IDS.includes(id) ? id : DEFAULT_CARD.id;
}

function emitM105(
  emit: MechanicEmitter,
  tick: number,
  runId: string,
  event: M105Event,
  payload: Record<string, unknown>,
): void {
  const msg: M105TelemetryPayload = {
    event,
    mechanic_id: 'M105',
    tick,
    runId,
    payload,
  };
  emit(msg);
}

function computeAutoDecision(args: {
  seed: string;
  tick: number;
  runId: string;
  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  chaosActive: boolean;
  deck: GameCard[];
  cash: number;
}): { decision: string; auditHash: string; confidenceDecay: number; recommendedCardId: string } {
  const { seed, tick, runId, macroRegime, runPhase, pressureTier, chaosActive, deck, cash } = args;

  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  const combined = pressureW * phaseW * regimeW * regimeMult;

  const pool = buildWeightedPool(seed + ':M105:pool', pressureW * phaseW, regimeW);
  const shuffled = seededShuffle(pool.length > 0 ? pool : OPPORTUNITY_POOL, seed + ':M105:poolShuffle:' + tick);

  const pickedFromPool = shuffled[seededIndex(seed + ':M105:poolPick', tick, shuffled.length)] ?? DEFAULT_CARD;
  const pickedFromDeck =
    deck.length > 0 ? deck[seededIndex(seed + ':M105:deckPick', tick, deck.length)] ?? pickedFromPool : pickedFromPool;

  const candidateId = normalizeCardId(pickedFromDeck.id);

  const decay = computeDecayRate(macroRegime, M105_BOUNDS.BASE_DECAY_RATE);
  const pulse = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;

  const cost = typeof (pickedFromDeck as any).cost === 'number' ? ((pickedFromDeck as any).cost as number) : 0;
  const down = typeof (pickedFromDeck as any).downPayment === 'number' ? ((pickedFromDeck as any).downPayment as number) : cost;

  const affordability = down <= 0 ? 1 : clamp(cash / down, 0, 2);
  const urgency = clamp((tick / RUN_TOTAL_TICKS) * pulse * (1 + (combined - 1) * 0.25), 0, 2);
  const chaosPenalty = chaosActive ? 0.75 : 1.0;

  const takeScore = affordability * urgency * chaosPenalty;

  const decision = takeScore >= 0.95 ? `TAKE:${candidateId}` : 'PASS';

  const auditHash = computeHash(
    JSON.stringify({
      runId,
      tick,
      seed,
      macroRegime,
      runPhase,
      pressureTier,
      chaosActive,
      combined,
      pulse,
      decay,
      candidateId,
      cost,
      down,
      cash,
      affordability,
      urgency,
      takeScore,
      decision,
    }),
  );

  return {
    decision,
    auditHash,
    confidenceDecay: decay,
    recommendedCardId: candidateId,
  };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * lastLookWindowResolver
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function lastLookWindowResolver(input: M105Input, emit: MechanicEmitter): M105Output {
  const tick = clamp(toSafeNumber(input.stateTick, 0), 0, RUN_TOTAL_TICKS);

  const seed = toSafeString((input as any).seed ?? (input as any).runSeed ?? (input as any).seedSalt, 'seed:missing');
  const runId = toSafeString((input as any).runId, '');

  const windowDurationRaw = toSafeNumber(input.windowDuration, 0);
  const windowDuration = windowDurationRaw > 0 ? Math.floor(windowDurationRaw) : M105_BOUNDS.FIRST_REFUSAL_TICKS;

  const trigger = input.lastLookTrigger;
  const t: LastLookTriggerShape = (isObject(trigger) ? (trigger as LastLookTriggerShape) : {}) as LastLookTriggerShape;

  const explicitOpen = trigger === true || t.open === true || t.forceOpen === true;

  const openedAt =
    typeof t.openedAt === 'number'
      ? t.openedAt
      : typeof t.opened_at === 'number'
        ? t.opened_at
        : typeof t.windowOpenedAt === 'number'
          ? t.windowOpenedAt
          : explicitOpen
            ? tick
            : -1;

  const preDecision =
    typeof t.finalDecision === 'string'
      ? t.finalDecision
      : typeof t.decision === 'string'
        ? t.decision
        : null;

  const macroRegime = resolveMacroRegime(seed, tick, (input as any).macroRegime ?? (input as any).stateMacroRegime);
  const runPhase = resolveRunPhase(tick, (input as any).runPhase ?? (input as any).stateRunPhase);
  const pressureTier = resolvePressureTier((input as any).pressureTier ?? (input as any).statePressureTier);

  const chaosActive = isChaosActive(seed, tick);

  const deck = resolveDeck((input as any).sharedOpportunityDeck ?? (input as any).opportunityDeck, seed);
  const cash = toSafeNumber((input as any).cash ?? (input as any).stateCash, 0);

  const hasOpened = openedAt >= 0;
  const elapsed = hasOpened ? Math.max(0, tick - openedAt) : 0;
  const windowExpired = hasOpened ? elapsed >= windowDuration : false;
  const lastLookOpened = hasOpened ? !windowExpired : false;

  const isNewOpenThisTick = explicitOpen && (typeof t.openedAt !== 'number' && typeof t.opened_at !== 'number' && typeof t.windowOpenedAt !== 'number');

  if (isNewOpenThisTick) {
    emitM105(emit, tick, runId, 'LAST_LOOK_OPENED', {
      openedAt: tick,
      windowDuration,
      macroRegime,
      runPhase,
      pressureTier,
      chaosActive,
      trigger: input.lastLookTrigger ?? null,
      audit: computeHash(`${seed}:${runId}:${tick}:M105:OPEN`),
    });
  }

  if (preDecision) {
    emitM105(emit, tick, runId, 'FINAL_DECISION_MADE', {
      decision: preDecision,
      openedAt,
      elapsed,
      windowDuration,
      macroRegime,
      runPhase,
      pressureTier,
      chaosActive,
      audit: computeHash(`${seed}:${runId}:${tick}:M105:DECIDE:${preDecision}`),
    });
    return {
      lastLookOpened,
      finalDecision: preDecision,
      windowExpired,
    };
  }

  // If expired and no decision provided, enforce deterministic auto-resolution.
  if (windowExpired) {
    const auto = computeAutoDecision({
      seed,
      tick,
      runId,
      macroRegime,
      runPhase,
      pressureTier,
      chaosActive,
      deck,
      cash,
    });

    emitM105(emit, tick, runId, 'WINDOW_EXPIRED', {
      openedAt,
      elapsed,
      windowDuration,
      macroRegime,
      runPhase,
      pressureTier,
      chaosActive,
      recommendedCardId: auto.recommendedCardId,
      confidenceDecay: auto.confidenceDecay,
      auditHash: auto.auditHash,
    });

    emitM105(emit, tick, runId, 'FINAL_DECISION_MADE', {
      decision: auto.decision,
      auto: true,
      openedAt,
      elapsed,
      windowDuration,
      recommendedCardId: auto.recommendedCardId,
      auditHash: auto.auditHash,
    });

    return {
      lastLookOpened: false,
      finalDecision: auto.decision,
      windowExpired: true,
    };
  }

  // Window not open unless explicitly triggered or prior openedAt exists in trigger.
  return {
    lastLookOpened,
    finalDecision: null,
    windowExpired: false,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M105MLInput {
  lastLookOpened?: boolean;
  finalDecision?: string | null;
  windowExpired?: boolean;
  runId: string;
  tick: number;
}

export interface M105MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * lastLookWindowResolverMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function lastLookWindowResolverMLCompanion(input: M105MLInput): Promise<M105MLOutput> {
  const opened = !!input.lastLookOpened;
  const expired = !!input.windowExpired;
  const decided = typeof input.finalDecision === 'string' && input.finalDecision.length > 0;

  // Bounded signal: open + undecided + nearing expiry => higher
  const base = opened && !decided ? 0.75 : opened && decided ? 0.35 : expired ? 0.55 : 0.15;
  const score = clamp(base + (expired ? 0.1 : 0) + (decided ? -0.05 : 0), 0.01, 0.99);

  const topFactors: string[] = [];
  if (opened) topFactors.push('Last Look window active');
  if (decided) topFactors.push('Final decision recorded');
  if (!decided && opened) topFactors.push('Decision pending inside window');
  if (expired) topFactors.push('Window expired (auto-resolve path)');
  if (!opened && !expired) topFactors.push('No Last Look window');

  while (topFactors.length > 5) topFactors.pop();

  const recommendation = expired
    ? 'Review the forced resolution and document the rationale in the ledger.'
    : opened && !decided
      ? 'Decide now; delaying increases downside and can trigger auto-resolution.'
      : decided
        ? 'Proceed with the recorded decision and commit the proof trail.'
        : 'No action required unless a Last Look trigger fires.';

  // Use decay logic and regime multipliers deterministically even in ML layer:
  const pseudoRegime: MacroRegime = 'NEUTRAL';
  const confidenceDecay = computeDecayRate(pseudoRegime, 0.05);

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M105'),
    confidenceDecay,
  };
}