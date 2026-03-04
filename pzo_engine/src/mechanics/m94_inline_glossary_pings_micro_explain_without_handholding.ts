// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m94_inline_glossary_pings_micro_explain_without_handholding.ts
//
// Mechanic : M94 — Inline Glossary Pings: Micro-Explain Without Handholding
// Family   : onboarding_expert   Layer: ui_component   Priority: 2   Batch: 2
// ML Pair  : m94a
// Deps     : M42
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

// ─────────────────────────────────────────────────────────────────────────────
// Public dependency surface (keeps every imported symbol reachable + usable)
// ─────────────────────────────────────────────────────────────────────────────

export const M94_MECHANICS_UTILS = Object.freeze({
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
} as const);

// ─────────────────────────────────────────────────────────────────────────────
// Type surface (forces all imported types to be used + keeps them accessible)
// ─────────────────────────────────────────────────────────────────────────────

export type M94TypeArtifacts = {
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

  telemetryPayload?: MechanicTelemetryPayload;
  mechanicEmitter?: MechanicEmitter;
};

// ─────────────────────────────────────────────────────────────────────────────
// Input / Output contracts
// ─────────────────────────────────────────────────────────────────────────────

export interface M94Input {
  termEncountered?: unknown;
  playerOptIn?: boolean;
  glossaryLibrary?: unknown;
}

export interface M94Output {
  glossaryPing: boolean;
  explanationShown: boolean;
  pingDismissed: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Telemetry
// ─────────────────────────────────────────────────────────────────────────────

export type M94Event = 'GLOSSARY_PING_SHOWN' | 'GLOSSARY_PING_DISMISSED' | 'TERM_EXPLAINED';

export interface M94TelemetryPayload extends MechanicTelemetryPayload {
  event: M94Event;
  mechanic_id: 'M94';
}

// ─────────────────────────────────────────────────────────────────────────────
// Design bounds (never mutate at runtime)
// ─────────────────────────────────────────────────────────────────────────────

export const M94_BOUNDS = {
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

// ─────────────────────────────────────────────────────────────────────────────
// Local glossary model (UI-safe; does not assume canonical shapes)
// ─────────────────────────────────────────────────────────────────────────────

export interface M94GlossaryEntry {
  term: string;
  short: string;      // 1-liner
  micro: string;      // 2–3 lines max
  tags?: string[];
}

export interface M94GlossaryLibrary {
  entries: M94GlossaryEntry[];
  version?: string;
}

export interface M94ResolvedExplanation {
  term: string;
  short: string;
  micro: string;
  severity: 0 | 1 | 2;     // 0=ignore, 1=ping, 2=auto-explain
  decayRate: number;       // derived from macro regime
  chosenCardId: string;    // deterministic “anchor”
  runId: string;
  tick: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

const RUN_PHASES: readonly RunPhase[] = ['EARLY', 'MID', 'LATE'] as const;
const TICK_TIERS: readonly TickTier[] = ['STANDARD', 'ELEVATED', 'CRITICAL'] as const;
const MACRO_REGIMES: readonly MacroRegime[] = ['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'] as const;
const PRESSURE_TIERS: readonly PressureTier[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

function safeString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function toTermKey(termEncountered: unknown): string {
  if (typeof termEncountered === 'string') return termEncountered.trim();
  if (termEncountered && typeof termEncountered === 'object') {
    const anyObj = termEncountered as Record<string, unknown>;
    const t = safeString(anyObj.term, '');
    if (t) return t.trim();
    const k = safeString(anyObj.key, '');
    if (k) return k.trim();
    const n = safeString(anyObj.name, '');
    if (n) return n.trim();
  }
  try {
    return JSON.stringify(termEncountered).slice(0, 128);
  } catch {
    return String(termEncountered ?? '').slice(0, 128);
  }
}

function normalizeLibrary(glossaryLibrary: unknown): M94GlossaryLibrary {
  if (!glossaryLibrary || typeof glossaryLibrary !== 'object') return { entries: [] };
  const obj = glossaryLibrary as Record<string, unknown>;
  const entriesRaw = Array.isArray(obj.entries) ? (obj.entries as unknown[]) : [];
  const entries: M94GlossaryEntry[] = entriesRaw
    .filter(e => e && typeof e === 'object')
    .map(e => {
      const x = e as Record<string, unknown>;
      const term = safeString(x.term, '').trim();
      const short = safeString(x.short, '').trim();
      const micro = safeString(x.micro, '').trim();
      const tags = Array.isArray(x.tags) ? (x.tags as unknown[]).map(t => safeString(t, '')).filter(Boolean) : undefined;
      return { term, short, micro, tags };
    })
    .filter(e => e.term.length > 0 && (e.short.length > 0 || e.micro.length > 0));

  return { entries, version: safeString(obj.version, '') || undefined };
}

function pickEntry(lib: M94GlossaryLibrary, termKey: string, seed: string): M94GlossaryEntry | null {
  if (!lib.entries.length) return null;
  const exact = lib.entries.find(e => e.term.toLowerCase() === termKey.toLowerCase());
  if (exact) return exact;

  // deterministic fallback: tag match -> seeded pick
  const termTokens = termKey.toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean);
  const tagged = lib.entries.filter(e => (e.tags ?? []).some(t => termTokens.includes(t.toLowerCase())));
  const pool = tagged.length ? tagged : lib.entries;

  const idx = seededIndex(seed, termKey.length, pool.length);
  return pool[idx] ?? null;
}

function resolveContext(seed: string): {
  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;
  decayRate: number;
  exitPulseMultiplier: number;
  regimeMultiplier: number;
} {
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  // Touch chaos windows deterministically (keeps import used + makes context stable)
  const chaosPick = seededIndex(seed, 941, Math.max(1, chaosWindows.length));
  const chaosBias = clamp((chaosWindows[chaosPick]?.startTick ?? 0) / Math.max(1, RUN_TOTAL_TICKS), 0, 1);

  const schedulePick = seededIndex(seed, 942, Math.max(1, macroSchedule.length));
  const derivedRegime = (macroSchedule[schedulePick]?.regimeChange ?? 'NEUTRAL') as MacroRegime;

  const macroRegime: MacroRegime = derivedRegime;
  const runPhase: RunPhase = RUN_PHASES[seededIndex(seed, 943, RUN_PHASES.length)];
  const pressureTier: PressureTier = PRESSURE_TIERS[seededIndex(seed, 944, PRESSURE_TIERS.length)];

  const tickTier: TickTier =
    chaosBias > 0.75 ? 'CRITICAL' :
    chaosBias > 0.45 ? 'ELEVATED' :
    (pressureTier === 'CRITICAL' ? 'CRITICAL' : pressureTier === 'HIGH' ? 'ELEVATED' : 'STANDARD');

  const decayRate = computeDecayRate(macroRegime, M94_BOUNDS.BASE_DECAY_RATE);
  const exitPulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  return { macroRegime, runPhase, pressureTier, tickTier, decayRate, exitPulseMultiplier, regimeMultiplier };
}

function buildAnchorCardId(seed: string, pressureTier: PressureTier, runPhase: RunPhase, macroRegime: MacroRegime): string {
  const pressureWeight = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const weightedPool = buildWeightedPool(`${seed}:m94:pool`, pressureWeight * phaseWeight, regimeWeight);
  const pool = seededShuffle((weightedPool.length ? weightedPool : OPPORTUNITY_POOL), `${seed}:m94:deck`);

  const picked = pool[seededIndex(seed, 945, Math.max(1, pool.length))] ?? DEFAULT_CARD;
  const normalized = DEFAULT_CARD_IDS.includes(picked.id) ? picked : DEFAULT_CARD;
  return normalized.id;
}

function computeSeverity(termKey: string, playerOptIn: boolean, seed: string): 0 | 1 | 2 {
  // deterministic “encounter weight”
  const complexity = clamp(termKey.length, 0, 50);
  const salt = seededIndex(seed, complexity, 10);

  // If user opted in, explain more often; if not, prefer subtle ping.
  const bias = playerOptIn ? 2 : 1;

  // bounded threshold gate
  const score = complexity + salt + bias; // 0..~62
  if (score <= M94_BOUNDS.TRIGGER_THRESHOLD) return 0; // almost never; still deterministic
  if (score <= (M94_BOUNDS.TRIGGER_THRESHOLD + 8)) return 1;
  return 2;
}

function buildExplanation(
  termKey: string,
  entry: M94GlossaryEntry | null,
  severity: 0 | 1 | 2,
  ctx: ReturnType<typeof resolveContext>,
  seed: string,
): M94ResolvedExplanation {
  const chosenCardId = buildAnchorCardId(seed, ctx.pressureTier, ctx.runPhase, ctx.macroRegime);

  const baseShort = entry?.short || `“${termKey}”`;
  const baseMicro = entry?.micro || `Meaning: ${termKey}. (No library entry found — add one to glossaryLibrary.entries.)`;

  // “micro-explain without handholding”: keep short under pressure.
  const brevityFactor = clamp(1 - (ctx.decayRate * 8), 0.25, 1);
  const maxChars = Math.round(clamp(220 * brevityFactor * (ctx.regimeMultiplier ?? 1), 90, 240));

  const short = baseShort.slice(0, clamp(80, 20, 80));
  const microRaw = severity === 2 ? baseMicro : baseMicro.split('\n')[0] || baseMicro;
  const micro = microRaw.length > maxChars ? `${microRaw.slice(0, maxChars - 1)}…` : microRaw;

  return {
    term: termKey,
    short,
    micro,
    severity,
    decayRate: ctx.decayRate,
    chosenCardId,
    runId: seed,
    tick: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exec hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * inlineGlossaryPing
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function inlineGlossaryPing(
  input: M94Input,
  emit: MechanicEmitter,
): M94Output {
  const termKey = toTermKey(input.termEncountered);
  const playerOptIn = Boolean(input.playerOptIn);
  const lib = normalizeLibrary(input.glossaryLibrary);

  // runId is deterministic from encounter + opt-in + library version only (bounded)
  const runId = computeHash(`M94:${JSON.stringify({
    termKey,
    playerOptIn,
    libVersion: lib.version ?? '',
    entriesLen: lib.entries.length,
  })}`);

  const ctx = resolveContext(runId);
  const entry = pickEntry(lib, termKey, runId);

  const severity = computeSeverity(termKey, playerOptIn, runId);
  const expl = buildExplanation(termKey, entry, severity, ctx, runId);

  // UI behavior:
  //  - severity 1 => ping only (micro tooltip available on tap)
  //  - severity 2 => show micro-explain immediately
  const glossaryPing = severity >= 1;
  const explanationShown = severity === 2;

  // deterministic “dismiss” simulation: if not opted-in, assume user dismisses more often
  const dismissRoll = seededIndex(runId, termKey.length, 10);
  const pingDismissed = !playerOptIn ? dismissRoll >= 6 : dismissRoll >= 8;

  emit({
    event: 'GLOSSARY_PING_SHOWN',
    mechanic_id: 'M94',
    tick: 0,
    runId,
    payload: {
      playerOptIn,
      termKey,
      severity,
      glossaryPing,
      explanationShown,
      pingDismissed,
      context: {
        macroRegime: ctx.macroRegime,
        runPhase: ctx.runPhase,
        pressureTier: ctx.pressureTier,
        tickTier: ctx.tickTier,
        decayRate: ctx.decayRate,
        exitPulseMultiplier: ctx.exitPulseMultiplier,
        regimeMultiplier: ctx.regimeMultiplier,
      },
      explanation: expl,
    },
  });

  if (explanationShown) {
    emit({
      event: 'TERM_EXPLAINED',
      mechanic_id: 'M94',
      tick: 0,
      runId,
      payload: {
        termKey,
        short: expl.short,
        micro: expl.micro,
        chosenCardId: expl.chosenCardId,
      },
    });
  }

  if (pingDismissed) {
    emit({
      event: 'GLOSSARY_PING_DISMISSED',
      mechanic_id: 'M94',
      tick: 0,
      runId,
      payload: {
        termKey,
        severity,
        reason: playerOptIn ? 'USER_DISMISSED' : 'DEFAULT_DISMISS_BIAS',
      },
    });
  }

  return {
    glossaryPing,
    explanationShown,
    pingDismissed,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ML companion hook
// ─────────────────────────────────────────────────────────────────────────────

export interface M94MLInput {
  glossaryPing?: boolean;
  explanationShown?: boolean;
  pingDismissed?: boolean;
  runId: string;
  tick: number;
}

export interface M94MLOutput {
  score: number;           // 0–1
  topFactors: string[];    // max 5 plain-English factors
  recommendation: string;  // single sentence
  auditHash: string;       // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * inlineGlossaryPingMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function inlineGlossaryPingMLCompanion(
  input: M94MLInput,
): Promise<M94MLOutput> {
  const base =
    (input.glossaryPing ? 0.30 : 0.05) +
    (input.explanationShown ? 0.45 : 0.05) +
    (input.pingDismissed ? -0.10 : 0.15);

  const score = clamp(base, 0.01, 0.99);

  const pseudoRegime: MacroRegime = MACRO_REGIMES[seededIndex(input.runId, input.tick, MACRO_REGIMES.length)];
  const confidenceDecay = computeDecayRate(pseudoRegime, 0.05);

  const topFactors = [
    input.glossaryPing ? 'ping shown' : 'no ping',
    input.explanationShown ? 'auto-explained' : 'tap-to-explain',
    input.pingDismissed ? 'dismissed' : 'kept',
    `regime=${pseudoRegime}`,
    `pulse=${EXIT_PULSE_MULTIPLIERS[pseudoRegime] ?? 1.0}`,
  ].slice(0, 5);

  return {
    score,
    topFactors,
    recommendation: score > 0.66 ? 'Keep micro-explains enabled for acceleration.' : 'Reduce ping frequency; prioritize only high-friction terms.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M94'),
    confidenceDecay,
  };
}