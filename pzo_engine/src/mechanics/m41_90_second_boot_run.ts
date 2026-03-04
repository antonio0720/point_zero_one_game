// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m41_90_second_boot_run.ts
//
// Mechanic : M41 — 90-Second Boot Run
// Family   : onboarding   Layer: backend_service   Priority: 1   Batch: 2
// ML Pair  : m41a
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

// ── Import Anchors (keep every import accessible + used) ─────────────────────

export const M41_IMPORTED_SYMBOLS = {
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

export interface M41TypeTouchpad {
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

// ── Mechanic-local onboarding domain (NOT in shared ./types.ts) ─────────────

export type OnboardingStepId =
  | 'WELCOME'
  | 'SEED_LOCK'
  | 'MACRO_SENSE'
  | 'PRESSURE_SENSE'
  | 'PICK_ONE_OPPORTUNITY'
  | 'EXIT_PULSE';

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  body: string;
  tickStart: number;
  tickEnd: number;
  requiresAction: boolean;
}

export interface OnboardingConfig {
  /**
   * 90 seconds ≈ 18 ticks at 12 ticks/minute.
   * Hard-bounded so backend can safely run it.
   */
  tickBudget?: number;

  /**
   * How many micro-steps to surface inside the boot run (3..8).
   */
  stepCount?: number;

  /**
   * If true, we allow early chaos windows to influence pressure tier.
   * Default false: boot run stays “safe”.
   */
  allowChaosInfluence?: boolean;

  /**
   * Optional scalar (0.75..1.25) to bias instructional “intensity”.
   */
  intensityBias?: number;
}

export interface OnboardingRunState {
  runId: string;
  seed: string;

  tickBudget: number;
  stepIndex: number;
  completed: boolean;

  // Environment snapshot (deterministic)
  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];
  inEarlyChaos: boolean;

  runPhase: RunPhase;
  macroRegime: MacroRegime;
  pressureTier: PressureTier;

  // Econ/tempo shaping
  regimeMultiplier: number;
  exitPulse: number;
  decayRate: number;

  // Picks (deterministic)
  deckIds: string[];
  featuredOpportunity: GameCard;
  weightedPick: GameCard;

  steps: OnboardingStep[];

  // Verifiability
  auditHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M41Input {
  newPlayerFlag?: boolean;
  onboardingConfig?: OnboardingConfig;
}

export interface M41Output {
  onboardingRunState: OnboardingRunState;
  guidedPrompts: string[];
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M41Event = 'ONBOARDING_STARTED' | 'TUTORIAL_STEP_COMPLETED' | 'BOOT_RUN_FINISHED';

export interface M41TelemetryPayload extends MechanicTelemetryPayload {
  event: M41Event;
  mechanic_id: 'M41';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M41_BOUNDS = {
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

  // M41-specific
  DEFAULT_TICK_BUDGET: 18, // ~90 seconds at 12 ticks/minute
  MIN_TICK_BUDGET: 6,
  MAX_TICK_BUDGET: 60,
  MIN_STEPS: 3,
  MAX_STEPS: 8,
} as const;

// ── Internal helpers (deterministic, bounded) ───────────────────────────────

function m41DerivePhase(tickBudget: number): RunPhase {
  const t = clamp(tickBudget, 0, RUN_TOTAL_TICKS);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m41SelectMacroRegime(seed: string, schedule: MacroEvent[]): MacroRegime {
  if (!schedule || schedule.length === 0) return 'NEUTRAL';
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);
  const first = sorted[0];
  return (first?.regimeChange ?? 'NEUTRAL') as MacroRegime;
}

function m41HasEarlyChaos(tickBudget: number, chaos: ChaosWindow[]): boolean {
  for (const w of chaos) {
    if (w.startTick <= tickBudget) return true;
  }
  return false;
}

function m41DerivePressureTier(
  seed: string,
  tickBudget: number,
  allowChaosInfluence: boolean,
  hasEarlyChaos: boolean,
): PressureTier {
  // Default boot run is safe: LOW.
  // If chaos influence is allowed and chaos appears early, bump pressure.
  if (allowChaosInfluence && hasEarlyChaos) {
    const roll = seededIndex(seed + ':pressure', tickBudget, 1000) / 1000; // 0..0.999
    return roll < 0.55 ? 'MEDIUM' : roll < 0.90 ? 'HIGH' : 'CRITICAL';
  }
  return 'LOW';
}

function m41BuildSteps(
  seed: string,
  tickBudget: number,
  stepCount: number,
  ctx: {
    phase: RunPhase;
    regime: MacroRegime;
    pressure: PressureTier;
    regimeMultiplier: number;
    exitPulse: number;
    decayRate: number;
    featured: GameCard;
    weighted: GameCard;
    deckTop: string;
    intensityBias: number;
  },
): OnboardingStep[] {
  const stepsBase: Array<Omit<OnboardingStep, 'tickStart' | 'tickEnd'>> = [
    {
      id: 'WELCOME',
      title: 'Boot Run: 90 Seconds',
      body: `You are under timer. Move fast. Pick one opportunity and survive the first pulse.`,
      requiresAction: false,
    },
    {
      id: 'SEED_LOCK',
      title: 'Seed Lock',
      body: `This run is deterministic-by-seed. Same inputs ⇒ same outcomes. Your audit hash is verifiable.`,
      requiresAction: false,
    },
    {
      id: 'MACRO_SENSE',
      title: `Macro Regime: ${ctx.regime}`,
      body: `Regime multiplier=${ctx.regimeMultiplier.toFixed(2)}. Exit pulse=${ctx.exitPulse.toFixed(2)}. Adapt quickly.`,
      requiresAction: false,
    },
    {
      id: 'PRESSURE_SENSE',
      title: `Pressure: ${ctx.pressure}`,
      body: `Phase=${ctx.phase}. Decay rate=${ctx.decayRate.toFixed(3)}. Timer discipline beats “busy”.`,
      requiresAction: false,
    },
    {
      id: 'PICK_ONE_OPPORTUNITY',
      title: `Pick One: ${ctx.weighted.name}`,
      body: `Featured=${ctx.featured.name}. DeckTop=${ctx.deckTop}. Commit to ONE move now; no dithering.`,
      requiresAction: true,
    },
    {
      id: 'EXIT_PULSE',
      title: 'Exit Pulse',
      body: `When the pulse hits, exit clean. Timing matters more than ego.`,
      requiresAction: false,
    },
  ];

  // Deterministically choose a subset if stepCount < full set
  const shuffled = seededShuffle(stepsBase, seed + ':steps');
  const picked = shuffled.slice(0, clamp(stepCount, M41_BOUNDS.MIN_STEPS, M41_BOUNDS.MAX_STEPS));

  // Allocate tick windows evenly across budget (bounded)
  const per = Math.max(1, Math.floor(tickBudget / picked.length));
  const out: OnboardingStep[] = [];

  for (let i = 0; i < picked.length; i++) {
    const start = i * per;
    const end = i === picked.length - 1 ? tickBudget : Math.min(tickBudget, (i + 1) * per - 1);

    // Slightly intensify language deterministically
    const bias = clamp(ctx.intensityBias, 0.75, 1.25);
    const salt = seededIndex(seed + ':tone', i, 1000) / 1000;
    const prefix = bias > 1.05 && salt < 0.5 ? 'NOW: ' : bias < 0.95 && salt < 0.5 ? 'Tip: ' : '';

    out.push({
      ...picked[i],
      body: prefix + picked[i].body,
      tickStart: start,
      tickEnd: end,
    });
  }

  // Re-sort by tickStart to keep timeline coherent
  return out.sort((a, b) => a.tickStart - b.tickStart);
}

function m41BuildGuidedPrompts(seed: string, steps: OnboardingStep[], featured: GameCard, weighted: GameCard): string[] {
  const templates = [
    `Select ONE: ${weighted.name}.`,
    `Ignore noise. Act inside the timer.`,
    `Macro matters. Watch regime shifts.`,
    `Your featured option: ${featured.name}.`,
    `Deck order is seeded. Stop guessing.`,
    `Exit on pulse. Don’t get greedy.`,
  ];

  const order = seededShuffle(templates, seed + ':prompts');
  const max = clamp(steps.length, 1, order.length);
  return order.slice(0, max);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * bootRunOnboardingEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function bootRunOnboardingEngine(input: M41Input, emit: MechanicEmitter): M41Output {
  const newPlayerFlag = Boolean(input.newPlayerFlag);
  const cfg = (input.onboardingConfig ?? {}) as OnboardingConfig;

  const tickBudget = clamp(
    Math.floor(cfg.tickBudget ?? M41_BOUNDS.DEFAULT_TICK_BUDGET),
    M41_BOUNDS.MIN_TICK_BUDGET,
    M41_BOUNDS.MAX_TICK_BUDGET,
  );

  const stepCount = clamp(
    Math.floor(cfg.stepCount ?? 6),
    M41_BOUNDS.MIN_STEPS,
    M41_BOUNDS.MAX_STEPS,
  );

  const allowChaosInfluence = Boolean(cfg.allowChaosInfluence);
  const intensityBias = clamp(Number(cfg.intensityBias ?? 1.0), 0.75, 1.25);

  // Service-level deterministic seed (backend safe)
  const serviceHash = computeHash(JSON.stringify({ mid: 'M41', input, tickBudget, stepCount }));
  const seed = computeHash(serviceHash + ':seed');

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const macroRegime = m41SelectMacroRegime(seed, macroSchedule);
  const inEarlyChaos = m41HasEarlyChaos(tickBudget, chaosWindows);

  const runPhase = m41DerivePhase(tickBudget);
  const pressureTier = m41DerivePressureTier(seed, tickBudget, allowChaosInfluence, inEarlyChaos);

  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const decayRate = computeDecayRate(macroRegime, M41_BOUNDS.BASE_DECAY_RATE);

  // Deterministic deck + featured opportunity
  const deckIds = seededShuffle(DEFAULT_CARD_IDS, seed + ':deck');
  const featuredIdx = seededIndex(seed + ':featured', 0, OPPORTUNITY_POOL.length);
  const featuredOpportunity = OPPORTUNITY_POOL[featuredIdx] ?? DEFAULT_CARD;

  // Weighted pool pick (uses all weight tables)
  const pressurePhaseWeight = (PRESSURE_WEIGHTS[pressureTier] ?? 1.0) * (PHASE_WEIGHTS[runPhase] ?? 1.0);
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;
  const pool = buildWeightedPool(seed + ':pool', pressurePhaseWeight, regimeWeight);
  const weightedPick = pool[seededIndex(seed + ':pick', tickBudget, Math.max(1, pool.length))] ?? featuredOpportunity ?? DEFAULT_CARD;

  const steps = m41BuildSteps(seed, tickBudget, stepCount, {
    phase: runPhase,
    regime: macroRegime,
    pressure: pressureTier,
    regimeMultiplier,
    exitPulse,
    decayRate,
    featured: featuredOpportunity,
    weighted: weightedPick,
    deckTop: deckIds[0] ?? '',
    intensityBias,
  });

  const guidedPrompts = newPlayerFlag ? m41BuildGuidedPrompts(seed, steps, featuredOpportunity, weightedPick) : [];

  const auditHash = computeHash(
    JSON.stringify({
      mid: 'M41',
      serviceHash,
      seed,
      tickBudget,
      stepCount,
      allowChaosInfluence,
      intensityBias,
      macroRegime,
      runPhase,
      pressureTier,
      regimeMultiplier,
      exitPulse,
      decayRate,
      featured: featuredOpportunity.id,
      weighted: weightedPick.id,
      deckTop: deckIds[0] ?? '',
      macroSchedule,
      chaosWindows,
    }),
  );

  const onboardingRunState: OnboardingRunState = {
    runId: serviceHash,
    seed,
    tickBudget,
    stepIndex: 0,
    completed: !newPlayerFlag,

    macroSchedule,
    chaosWindows,
    inEarlyChaos,

    runPhase,
    macroRegime,
    pressureTier,

    regimeMultiplier,
    exitPulse,
    decayRate,

    deckIds,
    featuredOpportunity,
    weightedPick,

    steps: newPlayerFlag ? steps : [],

    auditHash,
  };

  // Telemetry
  emit({
    event: 'ONBOARDING_STARTED',
    mechanic_id: 'M41',
    tick: 0,
    runId: serviceHash,
    payload: {
      newPlayerFlag,
      tickBudget,
      stepCount,
      allowChaosInfluence,
      intensityBias,
      macroRegime,
      runPhase,
      pressureTier,
      inEarlyChaos,
      picks: {
        featured: { id: featuredOpportunity.id, name: featuredOpportunity.name },
        weighted: { id: weightedPick.id, name: weightedPick.name },
      },
      auditHash,
    },
  });

  if (!newPlayerFlag) {
    emit({
      event: 'BOOT_RUN_FINISHED',
      mechanic_id: 'M41',
      tick: 0,
      runId: serviceHash,
      payload: { reason: 'NOT_NEW_PLAYER', auditHash },
    });
    return { onboardingRunState, guidedPrompts: [] };
  }

  // Mark first step as “completed” deterministically (boot handshake)
  const firstStep = steps[0];
  if (firstStep) {
    emit({
      event: 'TUTORIAL_STEP_COMPLETED',
      mechanic_id: 'M41',
      tick: firstStep.tickEnd,
      runId: serviceHash,
      payload: {
        stepId: firstStep.id,
        title: firstStep.title,
        tickStart: firstStep.tickStart,
        tickEnd: firstStep.tickEnd,
        auditHash,
      },
    });
  }

  emit({
    event: 'BOOT_RUN_FINISHED',
    mechanic_id: 'M41',
    tick: tickBudget,
    runId: serviceHash,
    payload: {
      tickBudget,
      steps: steps.length,
      macroRegime,
      runPhase,
      pressureTier,
      exitPulse,
      regimeMultiplier,
      decayRate,
      auditHash,
    },
  });

  return { onboardingRunState, guidedPrompts };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M41MLInput {
  onboardingRunState?: OnboardingRunState;
  guidedPrompts?: string[];
  runId: string;
  tick: number;
}

export interface M41MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion) (djb2 here)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * bootRunOnboardingEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function bootRunOnboardingEngineMLCompanion(input: M41MLInput): Promise<M41MLOutput> {
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const runId = String(input.runId ?? '');
  const seed = computeHash(`${runId}:M41:ml:${tick}`);

  // Use shared builders so ML companion stays deterministic-by-seed too
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);
  const macroRegime = m41SelectMacroRegime(seed, macroSchedule);

  const decay = computeDecayRate(macroRegime, M41_BOUNDS.BASE_DECAY_RATE);
  const exitPulse = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  const prompts = input.guidedPrompts ?? [];
  const promptScore = clamp(prompts.length / 6, 0, 1);

  const chaosEarly = m41HasEarlyChaos(M41_BOUNDS.DEFAULT_TICK_BUDGET, chaosWindows);
  const chaosPenalty = chaosEarly ? 0.08 : 0.0;

  const score = clamp(0.25 + promptScore * 0.45 + (exitPulse * regimeMultiplier) / 4 - chaosPenalty, 0.01, 0.99);

  return {
    score,
    topFactors: [
      `tick=${tick}/${RUN_TOTAL_TICKS}`,
      `regime=${macroRegime} env=${(exitPulse * regimeMultiplier).toFixed(2)}`,
      `decay=${decay.toFixed(3)} chaosEarly=${chaosEarly ? 'Y' : 'N'}`,
      `prompts=${prompts.length} (${promptScore.toFixed(2)})`,
      `poolHint=${(REGIME_WEIGHTS[macroRegime] ?? 1.0).toFixed(2)}`,
    ].slice(0, 5),
    recommendation:
      prompts.length === 0
        ? 'Onboarding prompts missing: ensure newPlayerFlag is set and surface boot prompts in UI.'
        : chaosEarly
          ? 'Chaos appears early: keep the boot run in LOW pressure by disabling chaos influence for new players.'
          : 'Boot run looks stable: keep prompts short, force one opportunity pick, and teach exit pulse timing.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M41'),
    confidenceDecay: decay,
  };
}