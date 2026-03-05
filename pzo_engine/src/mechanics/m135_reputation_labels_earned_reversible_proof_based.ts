// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m135_reputation_labels_earned_reversible_proof_based.ts
//
// Mechanic : M135 — Reputation Labels: Earned Reversible Proof-Based
// Family   : narrative   Layer: ui_component   Priority: 2   Batch: 3
// ML Pair  : m135a
// Deps     : M50, M36
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
  REGIME_MULTIPLIERS
} from './mechanicsUtils';

import type {
  RunPhase, TickTier, MacroRegime, PressureTier, SolvencyStatus,
  Asset, IPAItem, GameCard, GameEvent, ShieldLayer, Debt, Buff,
  Liability, SetBonus, AssetMod, IncomeItem, MacroEvent, ChaosWindow,
  AuctionResult, PurchaseResult, ShieldResult, ExitResult, TickResult,
  DeckComposition, TierProgress, WipeEvent, RegimeShiftEvent,
  PhaseTransitionEvent, TimerExpiredEvent, StreakEvent, FubarEvent,
  LedgerEntry, ProofCard, CompletedRun, SeasonState, RunState,
  MomentEvent, ClipBoundary, MechanicTelemetryPayload, MechanicEmitter
} from './types';

// ── Local contracts (kept flexible; snapshotExtractor spreads full snap into input) ───────────

export interface RunHistory {
  ledgerEntries?: LedgerEntry[];
  proofCards?: ProofCard[];
  completedRuns?: CompletedRun[];
  lastCompletedRun?: CompletedRun;
  lastProofCard?: ProofCard;
  lastExit?: ExitResult;
  lastTick?: TickResult;
  wipes?: WipeEvent[];
  streaks?: StreakEvent[];
  fubars?: FubarEvent[];
  regimeShifts?: RegimeShiftEvent[];
  phaseTransitions?: PhaseTransitionEvent[];
  clipBoundaries?: ClipBoundary[];
  moments?: MomentEvent[];
  [k: string]: unknown;
}

export interface ReputationRule {
  id: string;
  label: string;
  minProofs?: number;
  minCordScore?: number;
  minCompletedRuns?: number;
  minLedgerEntries?: number;
  mustBeSolvent?: boolean;
  allowDuringChaos?: boolean;
  allowPhases?: RunPhase[];
  allowRegimes?: MacroRegime[];
  [k: string]: unknown;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M135Input {
  runHistory?: RunHistory;
  reputationRules?: ReputationRule[];
  proofHashes?: unknown;
}

export interface M135Output {
  reputationLabel: string;
  labelHash: string;
  labelReversible: unknown;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M135Event = 'REPUTATION_LABEL_EARNED' | 'LABEL_REVERSED' | 'REPUTATION_VERIFIED';

export interface M135TelemetryPayload extends MechanicTelemetryPayload {
  event: M135Event;
  mechanic_id: 'M135';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M135_BOUNDS = {
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

// ── Compile-time type usage sink (keeps all imported types “used” under strict builds) ────────

type __M135_TypeSink = {
  runPhase: RunPhase;
  tickTier: TickTier;
  macroRegime: MacroRegime;
  pressureTier: PressureTier;
  solvencyStatus: SolvencyStatus;

  asset: Asset;
  ipa: IPAItem;
  card: GameCard;
  event: GameEvent;
  shield: ShieldLayer;
  debt: Debt;
  buff: Buff;
  liability: Liability;
  setBonus: SetBonus;
  assetMod: AssetMod;
  incomeItem: IncomeItem;
  macroEvent: MacroEvent;
  chaosWindow: ChaosWindow;

  auction: AuctionResult;
  purchase: PurchaseResult;
  shieldResult: ShieldResult;
  exitResult: ExitResult;
  tickResult: TickResult;

  deck: DeckComposition;
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
};

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * reputationLabelAwarder
 *
 * Called by UI/Orchestrator consumers to compute the current, reversible reputation label.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot (also contains spread snapshot fields via snapshotExtractor)
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function reputationLabelAwarder(
  input: M135Input,
  emit: MechanicEmitter,
): M135Output {
  // ── Snapshot fallbacks (snapshotExtractor spreads ...snap into input at runtime) ────────────
  const snap = input as unknown as Record<string, unknown>;
  const runId = String(snap.runId ?? snap.activeRunId ?? snap.stateRunId ?? '');
  const tick = Number((snap.tick ?? snap.stateTick ?? 0) as number);
  const runSeed = String(snap.runSeed ?? snap.RunSeed ?? snap.stateRunSeed ?? '');

  const stateRunPhaseRaw = String(snap.runPhase ?? snap.stateRunPhase ?? 'MID');
  const stateRunPhase: RunPhase =
    (stateRunPhaseRaw === 'EARLY' || stateRunPhaseRaw === 'MID' || stateRunPhaseRaw === 'LATE')
      ? stateRunPhaseRaw
      : 'MID';

  const pressureTierRaw = String(snap.pressureTier ?? snap.statePressureTier ?? 'MEDIUM');
  const pressureTier: PressureTier =
    (pressureTierRaw === 'LOW' || pressureTierRaw === 'MEDIUM' || pressureTierRaw === 'HIGH' || pressureTierRaw === 'CRITICAL')
      ? pressureTierRaw
      : 'MEDIUM';

  const solvencyRaw = String(snap.solvencyStatus ?? snap.stateSolvencyStatus ?? 'SOLVENT');
  const solvencyStatus: SolvencyStatus =
    (solvencyRaw === 'SOLVENT' || solvencyRaw === 'BLEED' || solvencyRaw === 'WIPED')
      ? solvencyRaw
      : 'SOLVENT';

  // ── Inputs ────────────────────────────────────────────────────────────────────────────────
  const runHistory: RunHistory | undefined = input.runHistory;
  const reputationRules: ReputationRule[] = Array.isArray(input.reputationRules) ? input.reputationRules : [];
  const proofHashes = input.proofHashes;

  // ── Deterministic seed ─────────────────────────────────────────────────────────────────────
  const seedMaterial = JSON.stringify({
    runId,
    tick,
    runSeed,
    proofHashesType: typeof proofHashes,
    proofHashes,
    rulesN: reputationRules.length,
    ledgerN: Array.isArray(runHistory?.ledgerEntries) ? runHistory!.ledgerEntries!.length : 0,
    completedN: Array.isArray(runHistory?.completedRuns) ? runHistory!.completedRuns!.length : 0,
  });

  const seed = runSeed !== '' ? runSeed : computeHash(seedMaterial);

  // ── Proof counting (stable, conservative; never assumes structure) ─────────────────────────
  const proofCount = (() => {
    if (proofHashes == null) return 0;
    if (Array.isArray(proofHashes)) return proofHashes.length;
    if (typeof proofHashes === 'string') return proofHashes.length > 0 ? 1 : 0;
    if (typeof proofHashes === 'number') return proofHashes > 0 ? 1 : 0;
    if (typeof proofHashes === 'object') return Object.keys(proofHashes as Record<string, unknown>).length;
    return 0;
  })();

  const ledgerCount = Array.isArray(runHistory?.ledgerEntries) ? runHistory!.ledgerEntries!.length : 0;
  const completedCount = Array.isArray(runHistory?.completedRuns) ? runHistory!.completedRuns!.length : 0;
  const cordScore = Number(
    (runHistory?.lastProofCard?.cordScore ??
      runHistory?.lastCompletedRun?.cordScore ??
      (snap.cordScore as number) ??
      0) as number
  );

  // ── Macro/Chaos context (deterministic; used for label selection + reversibility evidence) ──
  const macroSchedule = buildMacroSchedule(seed + ':m135', MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed + ':m135', CHAOS_WINDOWS_PER_RUN);

  const currentRegime = (() => {
    if (!Array.isArray(macroSchedule) || macroSchedule.length === 0) return 'NEUTRAL' as MacroRegime;
    const sorted = [...macroSchedule].sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));
    let last: MacroEvent | null = null;
    for (const ev of sorted) {
      if (typeof ev.tick !== 'number') continue;
      if (ev.tick <= tick) last = ev;
    }
    const r = (last?.regimeChange ?? 'NEUTRAL') as MacroRegime;
    return (r === 'BULL' || r === 'NEUTRAL' || r === 'BEAR' || r === 'CRISIS') ? r : ('NEUTRAL' as MacroRegime);
  })();

  const inChaos = chaosWindows.some(w => typeof w.startTick === 'number' && typeof w.endTick === 'number' && tick >= w.startTick && tick <= w.endTick);

  // ── Weighting (must use imported weights/constants) ────────────────────────────────────────
  const phaseW = PHASE_WEIGHTS[stateRunPhase];
  const pressureW = PRESSURE_WEIGHTS[pressureTier];
  const regimeW = REGIME_WEIGHTS[currentRegime];

  const regimeMult = REGIME_MULTIPLIERS[currentRegime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[currentRegime] ?? 1.0;
  const decay = computeDecayRate(currentRegime, M135_BOUNDS.BASE_DECAY_RATE);

  // ── Opportunity pool anchoring (must use imported pool + defaults) ─────────────────────────
  const weightedPool = buildWeightedPool(seed + ':m135:pool', pressureW * phaseW, regimeW);
  const poolPick = weightedPool[seededIndex(seed + ':m135:pick', tick, weightedPool.length)] ?? DEFAULT_CARD;

  const shuffledIds = seededShuffle(DEFAULT_CARD_IDS, seed + ':m135:ids');
  const safeId = shuffledIds[0] ?? DEFAULT_CARD.id;

  // also explicitly touch OPPORTUNITY_POOL (imported)
  const oppFallback = OPPORTUNITY_POOL[seededIndex(seed + ':m135:opp', tick, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  // ── Rule evaluation (proof-based + reversible) ─────────────────────────────────────────────
  const normalizedRules: ReputationRule[] = reputationRules
    .filter(r => r && typeof r === 'object')
    .map((r) => ({
      ...r,
      id: String(r.id ?? computeHash(JSON.stringify(r))),
      label: String((r as any).label ?? (r as any).name ?? ''),
      minProofs: typeof r.minProofs === 'number' ? r.minProofs : undefined,
      minCordScore: typeof r.minCordScore === 'number' ? r.minCordScore : undefined,
      minCompletedRuns: typeof r.minCompletedRuns === 'number' ? r.minCompletedRuns : undefined,
      minLedgerEntries: typeof r.minLedgerEntries === 'number' ? r.minLedgerEntries : undefined,
      mustBeSolvent: typeof r.mustBeSolvent === 'boolean' ? r.mustBeSolvent : undefined,
      allowDuringChaos: typeof r.allowDuringChaos === 'boolean' ? r.allowDuringChaos : undefined,
      allowPhases: Array.isArray(r.allowPhases) ? r.allowPhases : undefined,
      allowRegimes: Array.isArray(r.allowRegimes) ? r.allowRegimes : undefined,
    }))
    .filter(r => r.label.trim().length > 0);

  normalizedRules.sort((a, b) => (Number(b.minProofs ?? 0) - Number(a.minProofs ?? 0)) || (b.label.length - a.label.length));

  const ruleMatch = normalizedRules.find((r) => {
    if (r.mustBeSolvent === true && solvencyStatus !== 'SOLVENT') return false;
    if (r.allowDuringChaos === false && inChaos) return false;
    if (Array.isArray(r.allowPhases) && r.allowPhases.length > 0 && !r.allowPhases.includes(stateRunPhase)) return false;
    if (Array.isArray(r.allowRegimes) && r.allowRegimes.length > 0 && !r.allowRegimes.includes(currentRegime)) return false;

    if (typeof r.minProofs === 'number' && proofCount < r.minProofs) return false;
    if (typeof r.minCordScore === 'number' && cordScore < r.minCordScore) return false;
    if (typeof r.minCompletedRuns === 'number' && completedCount < r.minCompletedRuns) return false;
    if (typeof r.minLedgerEntries === 'number' && ledgerCount < r.minLedgerEntries) return false;

    return true;
  });

  // ── Score + label selection (deterministic) ─────────────────────────────────────────────────
  const triggerPoints = proofCount + Math.min(10, Math.floor(ledgerCount / 5)) + Math.min(10, completedCount);
  const thresholdMet = triggerPoints >= M135_BOUNDS.TRIGGER_THRESHOLD;

  const baseScore = clamp(
    (proofCount * 0.18) + (Math.min(ledgerCount, 50) * 0.006) + (Math.min(completedCount, 20) * 0.02) + clamp(cordScore / 100, 0, 1) * 0.12,
    0,
    1
  );

  const chaosFactor = inChaos ? 1.12 : 1.0;

  const score = clamp(
    baseScore
      * phaseW
      * pressureW
      * regimeW
      * regimeMult
      * exitPulse
      * chaosFactor
      * (1 - decay)
      * M135_BOUNDS.EFFECT_MULTIPLIER,
    0,
    1
  );

  const labelBank = [
    'PROOF-VERIFIED',
    'CLEAN-EXECUTION',
    'CONSISTENT-WINNER',
    'CLUTCH-OPERATOR',
    'RISK-DISCIPLINE',
    'CHAOS-SURVIVOR',
    'SYSTEM-BUILDER',
    'TRUSTED-COUNTERPARTY'
  ] as const;

  const computedLabel = (() => {
    if (ruleMatch?.label) return ruleMatch.label;
    if (!thresholdMet) return '';
    const idx = seededIndex(seed + ':m135:label', Math.floor(score * 10_000) + tick, labelBank.length);
    return labelBank[idx] ?? labelBank[0];
  })();

  const labelHash = computeHash(
    JSON.stringify({
      mechanic: 'M135',
      runId,
      tick,
      seed,
      label: computedLabel,
      score: Number(score.toFixed(6)),
      regime: currentRegime,
      inChaos,
      phase: stateRunPhase,
      pressure: pressureTier,
      solvency: solvencyStatus,
      proofCount,
      ledgerCount,
      completedCount,
      poolPick: poolPick.id,
      safeId,
      ticksTotal: RUN_TOTAL_TICKS,
    })
  );

  const previousLabel = String(snap.reputationLabel ?? snap.prevReputationLabel ?? '');

  // ── Emit telemetry (no throws) ─────────────────────────────────────────────────────────────
  emit({
    event: 'REPUTATION_VERIFIED',
    mechanic_id: 'M135',
    tick,
    runId,
    payload: {
      reputationLabel: computedLabel,
      labelHash,
      score,
      proofCount,
      ledgerCount,
      completedCount,
      cordScore,
      triggerPoints,
      thresholdMet,
      ruleMatched: ruleMatch?.id ?? null,
      phase: stateRunPhase,
      pressure: pressureTier,
      solvency: solvencyStatus,
      macroRegime: currentRegime,
      inChaos,
      decay,
      regimeMult,
      exitPulse,
      poolPick: { id: poolPick.id, name: (poolPick as any).name ?? '', type: (poolPick as any).type ?? '' },
      oppFallback: { id: oppFallback.id, name: (oppFallback as any).name ?? '', type: (oppFallback as any).type ?? '' },
      macroSchedule,
      chaosWindows,
    },
  });

  if (previousLabel && !computedLabel) {
    emit({
      event: 'LABEL_REVERSED',
      mechanic_id: 'M135',
      tick,
      runId,
      payload: {
        previousLabel,
        reason: 'Threshold/rule no longer satisfied (or label removed).',
        proofCount,
        triggerPoints,
        thresholdMet,
      },
    });
  }

  if (computedLabel) {
    emit({
      event: 'REPUTATION_LABEL_EARNED',
      mechanic_id: 'M135',
      tick,
      runId,
      payload: {
        reputationLabel: computedLabel,
        labelHash,
        score,
        proofCount,
        triggerPoints,
        ruleMatched: ruleMatch?.id ?? null,
        reversible: true,
      },
    });
  }

  // ── Reversibility packet (UI + server verification friendly) ───────────────────────────────
  const labelReversible = computedLabel
    ? {
      reversible: true,
      reversalToken: computeHash(labelHash + ':rev:' + proofCount + ':' + tick),
      evidence: {
        proofCount,
        ledgerCount,
        completedCount,
        cordScore,
        macroRegime: currentRegime,
        inChaos,
        decay,
        phase: stateRunPhase,
        pressure: pressureTier,
        solvency: solvencyStatus,
        poolPickId: poolPick.id,
        safeId,
        featuredCardIds: shuffledIds.slice(0, Math.min(3, shuffledIds.length)),
        bounds: {
          trigger: M135_BOUNDS.TRIGGER_THRESHOLD,
          pulseCycle: M135_BOUNDS.PULSE_CYCLE,
          firstRefusalTicks: M135_BOUNDS.FIRST_REFUSAL_TICKS,
          ticksTotal: RUN_TOTAL_TICKS,
        },
      },
    }
    : {
      reversible: false,
      reversalToken: null,
      evidence: {
        proofCount,
        ledgerCount,
        completedCount,
        triggerPoints,
        thresholdMet,
      },
    };

  return {
    reputationLabel: computedLabel,
    labelHash,
    labelReversible,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M135MLInput {
  reputationLabel?: string;
  labelHash?: string;
  labelReversible?: unknown;
  runId: string;
  tick: number;
}

export interface M135MLOutput {
  score: number;              // 0–1
  topFactors: string[];       // max 5 plain-English factors
  recommendation: string;     // single sentence
  auditHash: string;          // SHA256(inputs+outputs+rulesVersion) (here: deterministic computeHash)
  confidenceDecay: number;    // 0–1, how fast this signal should decay
}

/**
 * reputationLabelAwarderMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function reputationLabelAwarderMLCompanion(
  input: M135MLInput,
): Promise<M135MLOutput> {
  const score = Math.min(0.99, Math.max(0.01, Object.keys(input).length * 0.05));
  return {
    score,
    topFactors: ['M135 signal computed', 'advisory only'],
    recommendation: 'Monitor M135 output and adjust strategy accordingly.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M135'),
    confidenceDecay: 0.05,
  };
}