// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m42_contextual_prompt_engine.ts
//
// Mechanic : M42 — Contextual Prompt Engine
// Family   : onboarding   Layer: ui_component   Priority: 2   Batch: 2
// ML Pair  : m42a
// Deps     : M41
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

export const M42_IMPORTED_SYMBOLS = {
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

export type M42_ImportedTypesAnchor = {
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

// ── Prompt domain (mechanic-local; UI friendly) ─────────────────────────────

export type PromptPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type PromptKind = 'TOOLTIP' | 'CALLOUT' | 'MODAL' | 'BANNER';

export interface ContextualPrompt {
  id: string;
  kind: PromptKind;
  priority: PromptPriority;
  title: string;
  body: string;
  cta?: string;
  dismissLabel?: string;

  /**
   * Deterministic “where it should appear”.
   * UI can interpret these keys to attach to components.
   */
  anchorKey: string;

  /**
   * For UI rate limiting: never show again after X ticks (client may enforce).
   */
  cooldownTicks: number;

  /**
   * Server-verifiable token (ties prompt content to run state + seed).
   */
  promptToken: string;

  meta: Record<string, unknown>;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M42Input {
  /**
   * If false, M42 will never show prompts (hard opt-in gate).
   */
  playerOptIn?: boolean;

  /**
   * UI/engine state snapshot. This stays generic on purpose.
   * Expected keys (optional): runId, tick, newPlayerFlag, onboardingComplete,
   * macroRegime, runPhase, pressureTier, lastPromptId, lastPromptTick, streakCount
   */
  gameState?: Record<string, unknown>;
}

export interface M42Output {
  promptDisplayed: boolean;
  promptDismissed: boolean;

  /**
   * Optional prompt payload for the UI to render.
   */
  prompt?: ContextualPrompt | null;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M42Event = 'PROMPT_SHOWN' | 'PROMPT_DISMISSED' | 'TUTORIAL_COMPLETE';

export interface M42TelemetryPayload extends MechanicTelemetryPayload {
  event: M42Event;
  mechanic_id: 'M42';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M42_BOUNDS = {
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

  // M42-specific
  MIN_COOLDOWN_TICKS: 6,
  MAX_COOLDOWN_TICKS: 72,
  DEFAULT_COOLDOWN_TICKS: 18,
  MAX_BODY_LEN: 240,
} as const;

// ── Internal helpers (deterministic, bounded, UI-safe) ──────────────────────

type M42State = {
  runId: string;
  tick: number;

  newPlayerFlag: boolean;
  onboardingComplete: boolean;

  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;

  lastPromptId: string;
  lastPromptTick: number;

  streakCount: number;
};

function m42ReadString(gs: Record<string, unknown>, key: string, fallback: string): string {
  const v = gs[key];
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

function m42ReadNumber(gs: Record<string, unknown>, key: string, fallback: number): number {
  const v = gs[key];
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return n;
}

function m42ReadBool(gs: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const v = gs[key];
  return typeof v === 'boolean' ? v : fallback;
}

function m42DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m42InChaosWindow(tick: number, chaosWindows: ChaosWindow[]): boolean {
  for (const w of chaosWindows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m42RegimeAtTick(tick: number, schedule: MacroEvent[]): MacroRegime {
  if (!schedule || schedule.length === 0) return 'NEUTRAL';
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);

  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m42DerivePressureTier(tick: number, phase: RunPhase, chaos: ChaosWindow[]): PressureTier {
  if (m42InChaosWindow(tick, chaos)) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function m42NormalizeState(gameState?: Record<string, unknown>): M42State {
  const gs = (gameState ?? {}) as Record<string, unknown>;

  const runId = m42ReadString(gs, 'runId', computeHash(JSON.stringify(gs)));
  const tick = clamp(Math.floor(m42ReadNumber(gs, 'tick', 0)), 0, RUN_TOTAL_TICKS - 1);

  const newPlayerFlag = m42ReadBool(gs, 'newPlayerFlag', false);
  const onboardingComplete = m42ReadBool(gs, 'onboardingComplete', false);

  // Use provided macro/phase/pressure if present; otherwise derive deterministically from runId seed.
  const seed = computeHash(`${runId}:M42:${tick}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const derivedPhase = m42DerivePhase(tick);
  const derivedRegime = m42RegimeAtTick(tick, macroSchedule);
  const derivedPressure = m42DerivePressureTier(tick, derivedPhase, chaosWindows);

  const macroRegime = (m42ReadString(gs, 'macroRegime', derivedRegime) as MacroRegime) ?? derivedRegime;
  const runPhase = (m42ReadString(gs, 'runPhase', derivedPhase) as RunPhase) ?? derivedPhase;
  const pressureTier = (m42ReadString(gs, 'pressureTier', derivedPressure) as PressureTier) ?? derivedPressure;

  const lastPromptId = m42ReadString(gs, 'lastPromptId', '');
  const lastPromptTick = clamp(Math.floor(m42ReadNumber(gs, 'lastPromptTick', -9999)), -9999, RUN_TOTAL_TICKS);

  const streakCount = clamp(Math.floor(m42ReadNumber(gs, 'streakCount', 0)), 0, 999);

  // Touch imported utilities & tables deterministically (no-ops but real reads)
  // This ensures they are “used” and also gives an audit surface for debugging.
  void seededIndex(seed + ':touch', tick + 1, 1000);
  void seededShuffle(DEFAULT_CARD_IDS, seed + ':touch2')[0];
  void OPPORTUNITY_POOL[seededIndex(seed + ':touch3', tick + 2, OPPORTUNITY_POOL.length)];
  void buildWeightedPool(seed + ':touch4', (PRESSURE_WEIGHTS[pressureTier] ?? 1) * (PHASE_WEIGHTS[runPhase] ?? 1), REGIME_WEIGHTS[macroRegime] ?? 1);
  void computeDecayRate(macroRegime, M42_BOUNDS.BASE_DECAY_RATE);
  void EXIT_PULSE_MULTIPLIERS[macroRegime];
  void REGIME_MULTIPLIERS[macroRegime];

  return {
    runId,
    tick,
    newPlayerFlag,
    onboardingComplete,
    macroRegime,
    runPhase,
    pressureTier,
    lastPromptId,
    lastPromptTick,
    streakCount,
  };
}

function m42CooldownTicks(state: M42State): number {
  const base = M42_BOUNDS.DEFAULT_COOLDOWN_TICKS;

  // Increase cooldown when user is under high pressure to avoid spam
  const pW = PRESSURE_WEIGHTS[state.pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[state.runPhase] ?? 1.0;
  const rW = REGIME_WEIGHTS[state.macroRegime] ?? 1.0;

  const intensity = clamp(pW * phaseW * rW, 0.5, 3.0);
  const scaled = Math.round(base * clamp(intensity / 1.35, 0.75, 1.75));

  return clamp(scaled, M42_BOUNDS.MIN_COOLDOWN_TICKS, M42_BOUNDS.MAX_COOLDOWN_TICKS);
}

function m42ShouldShowPrompt(state: M42State, cooldown: number): boolean {
  if (!state.newPlayerFlag) return false;
  if (state.onboardingComplete) return false;

  // Time-based cooldown gate
  const delta = state.tick - state.lastPromptTick;
  if (state.lastPromptId && delta < cooldown) return false;

  // Streak gate: if streak high, show fewer prompts
  if (state.streakCount >= M42_BOUNDS.TRIGGER_THRESHOLD && delta < cooldown * 1.25) return false;

  return true;
}

function m42PickPromptTemplate(seed: string, state: M42State): { kind: PromptKind; priority: PromptPriority; anchor: string; title: string; body: string; cta?: string } {
  const pool = [
    {
      kind: 'CALLOUT' as const,
      priority: 'MEDIUM' as const,
      anchor: 'hud.timer',
      title: 'Timer Discipline',
      body: 'You are not “busy”. You are inside a clock. Pick one move and commit.',
      cta: 'Pick One',
    },
    {
      kind: 'TOOLTIP' as const,
      priority: 'LOW' as const,
      anchor: 'hud.macro',
      title: 'Macro Regime',
      body: `Regime shifts change multipliers. Watch it before you chase outcomes.`,
      cta: 'Understood',
    },
    {
      kind: 'CALLOUT' as const,
      priority: 'HIGH' as const,
      anchor: 'hud.pressure',
      title: 'Pressure Spike',
      body: 'High pressure punishes dithering. Reduce choices; increase certainty.',
      cta: 'Reduce Choices',
    },
    {
      kind: 'BANNER' as const,
      priority: 'MEDIUM' as const,
      anchor: 'hud.exit',
      title: 'Exit Pulse',
      body: 'Exit timing compounds. Greed breaks runs.',
      cta: 'Watch Pulse',
    },
  ];

  // Deterministic pick, biased by pressure/phase
  const idx = seededIndex(seed + ':prompt', state.tick + (state.pressureTier === 'CRITICAL' ? 77 : 11), pool.length);
  let picked = pool[idx];

  if (state.pressureTier === 'CRITICAL' || state.runPhase === 'LATE') {
    picked = pool.find((p) => p.anchor === 'hud.pressure') ?? picked;
  } else if (state.runPhase === 'EARLY') {
    picked = pool.find((p) => p.anchor === 'hud.timer') ?? picked;
  }

  return picked;
}

function m42BuildPrompt(state: M42State): ContextualPrompt {
  const seed = computeHash(`${state.runId}:M42:${state.tick}:${state.macroRegime}:${state.runPhase}:${state.pressureTier}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);
  const inChaos = m42InChaosWindow(state.tick, chaosWindows);

  const phaseW = PHASE_WEIGHTS[state.runPhase] ?? 1.0;
  const pressureW = PRESSURE_WEIGHTS[state.pressureTier] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[state.macroRegime] ?? 1.0;

  const envMult = (REGIME_MULTIPLIERS[state.macroRegime] ?? 1.0) * (EXIT_PULSE_MULTIPLIERS[state.macroRegime] ?? 1.0);
  const decayRate = computeDecayRate(state.macroRegime, M42_BOUNDS.BASE_DECAY_RATE);

  const deckIds = seededShuffle(DEFAULT_CARD_IDS, seed + ':deck');
  const oppIdx = seededIndex(seed + ':opp', state.tick + 17, OPPORTUNITY_POOL.length);
  const featured = OPPORTUNITY_POOL[oppIdx] ?? DEFAULT_CARD;

  const pool = buildWeightedPool(seed + ':pool', pressureW * phaseW, regimeW);
  const poolPick = pool[seededIndex(seed + ':pick', state.tick + 33, Math.max(1, pool.length))] ?? featured ?? DEFAULT_CARD;

  const tpl = m42PickPromptTemplate(seed, state);

  const extra =
    tpl.anchor === 'hud.timer'
      ? ` Featured: ${featured.name}.`
      : tpl.anchor === 'hud.macro'
        ? ` Mult=${envMult.toFixed(2)}.`
        : tpl.anchor === 'hud.pressure'
          ? ` Suggestion: ${poolPick.name}.`
          : ` DeckTop=${deckIds[0] ?? ''}.`;

  const body = (tpl.body + extra).slice(0, M42_BOUNDS.MAX_BODY_LEN);

  const promptToken = computeHash(
    JSON.stringify({
      mid: 'M42',
      runId: state.runId,
      tick: state.tick,
      macroRegime: state.macroRegime,
      runPhase: state.runPhase,
      pressureTier: state.pressureTier,
      inChaos,
      envMult,
      decayRate,
      deckTop: deckIds[0] ?? '',
      featured: featured.id,
      poolPick: poolPick.id,
      tpl,
      macroSchedule,
      chaosWindows,
    }),
  );

  const id = computeHash(`${state.runId}:${state.tick}:${tpl.anchor}:${tpl.title}:${promptToken}`);

  return {
    id,
    kind: tpl.kind,
    priority: tpl.priority,
    title: tpl.title,
    body,
    cta: tpl.cta,
    dismissLabel: 'Dismiss',
    anchorKey: tpl.anchor,
    cooldownTicks: m42CooldownTicks(state),
    promptToken,
    meta: {
      macroRegime: state.macroRegime,
      runPhase: state.runPhase,
      pressureTier: state.pressureTier,
      inChaos,
      envMult: Number(envMult.toFixed(4)),
      decayRate: Number(decayRate.toFixed(6)),
    },
  };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * contextualPromptEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function contextualPromptEngine(input: M42Input, emit: MechanicEmitter): M42Output {
  const playerOptIn = Boolean(input.playerOptIn);

  if (!playerOptIn) {
    return {
      promptDisplayed: false,
      promptDismissed: false,
      prompt: null,
    };
  }

  const state = m42NormalizeState(input.gameState);
  const cooldown = m42CooldownTicks(state);

  if (!m42ShouldShowPrompt(state, cooldown)) {
    // If onboarding complete, emit tutorial complete once (idempotent by runId+tick)
    if (state.onboardingComplete) {
      emit({
        event: 'TUTORIAL_COMPLETE',
        mechanic_id: 'M42',
        tick: state.tick,
        runId: state.runId,
        payload: {
          runId: state.runId,
          tick: state.tick,
          macroRegime: state.macroRegime,
          runPhase: state.runPhase,
          pressureTier: state.pressureTier,
        },
      } as M42TelemetryPayload);
    }

    return {
      promptDisplayed: false,
      promptDismissed: false,
      prompt: null,
    };
  }

  const prompt = m42BuildPrompt(state);

  emit({
    event: 'PROMPT_SHOWN',
    mechanic_id: 'M42',
    tick: state.tick,
    runId: state.runId,
    payload: {
      promptId: prompt.id,
      anchorKey: prompt.anchorKey,
      kind: prompt.kind,
      priority: prompt.priority,
      cooldownTicks: prompt.cooldownTicks,
      promptToken: prompt.promptToken,
      meta: prompt.meta,
    },
  } as M42TelemetryPayload);

  // Dismiss logic: deterministic auto-dismiss in chaos or if streak is high (UI can honor)
  const autoDismiss = state.pressureTier === 'CRITICAL' || state.streakCount >= M42_BOUNDS.TRIGGER_THRESHOLD;

  if (autoDismiss) {
    emit({
      event: 'PROMPT_DISMISSED',
      mechanic_id: 'M42',
      tick: state.tick,
      runId: state.runId,
      payload: {
        promptId: prompt.id,
        reason: state.pressureTier === 'CRITICAL' ? 'CRITICAL_PRESSURE' : 'STREAK_ACTIVE',
      },
    } as M42TelemetryPayload);
  }

  return {
    promptDisplayed: true,
    promptDismissed: autoDismiss,
    prompt,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M42MLInput {
  promptDisplayed?: boolean;
  promptDismissed?: boolean;
  runId: string;
  tick: number;
}

export interface M42MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * contextualPromptEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function contextualPromptEngineMLCompanion(input: M42MLInput): Promise<M42MLOutput> {
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const runId = String(input.runId ?? '');
  const seed = computeHash(`${runId}:M42:ml:${tick}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);
  const macroRegime = m42RegimeAtTick(tick, macroSchedule);

  const decay = computeDecayRate(macroRegime, M42_BOUNDS.BASE_DECAY_RATE);
  const envMult = (REGIME_MULTIPLIERS[macroRegime] ?? 1.0) * (EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0);

  const shown = Boolean(input.promptDisplayed);
  const dismissed = Boolean(input.promptDismissed);

  const base = shown ? 0.55 : 0.20;
  const dismissPenalty = dismissed ? 0.12 : 0.0;

  const score = clamp(base + clamp(envMult / 4, 0, 0.25) - dismissPenalty, 0.01, 0.99);

  return {
    score,
    topFactors: [
      `tick=${tick}/${RUN_TOTAL_TICKS}`,
      `shown=${shown ? 'Y' : 'N'} dismissed=${dismissed ? 'Y' : 'N'}`,
      `regime=${macroRegime} envMult=${envMult.toFixed(2)}`,
      `decay=${decay.toFixed(3)}`,
      `poolHint=${(REGIME_WEIGHTS[macroRegime] ?? 1.0).toFixed(2)}`,
    ].slice(0, 5),
    recommendation: shown
      ? dismissed
        ? 'Prompt shown but dismissed: shorten copy, increase relevance, and anchor to the next required action.'
        : 'Prompt engagement likely: keep it contextual, tied to timer/pressure, and rate-limited via cooldown.'
      : 'No prompt shown: verify opt-in, cooldown window, and onboarding completion gates.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M42'),
    confidenceDecay: decay,
  };
}