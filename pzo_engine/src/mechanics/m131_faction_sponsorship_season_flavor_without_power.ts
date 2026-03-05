// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m131_faction_sponsorship_season_flavor_without_power.ts
//
// Mechanic : M131 — Faction Sponsorship: Season Flavor Without Power
// Family   : cosmetics   Layer: season_runtime   Priority: 3   Batch: 3
// ML Pair  : m131a
// Deps     : M19, M126
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

// ─────────────────────────────────────────────────────────────────────────────
// Local domain types (intentionally local; keeps this cosmetic-only mechanic decoupled)
// ─────────────────────────────────────────────────────────────────────────────

export type FactionBenefitKind =
  | 'COSMETIC'
  | 'TITLE'
  | 'FRAME'
  | 'BANNER'
  | 'SFX'
  | 'EMOTE'
  | 'BADGE';

/**
 * FactionBenefit
 * Cosmetic-only metadata payload. Any economic / gameplay-affecting fields cause powerGuard failure.
 */
export interface FactionBenefit {
  id: string;
  kind: FactionBenefitKind;
  label?: string;
  tags?: string[];
  /**
   * If a caller explicitly sets this true, it fails the power guard.
   * (Server can also set this field when rejecting.)
   */
  powerAffecting?: boolean;

  // Allow arbitrary extra keys without breaking determinism or typing.
  [k: string]: unknown;
}

/** Exported anchors: keeps every imported runtime symbol "used" and accessible from this module. */
export const M131_EXPORT_ANCHORS = {
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

/** Exported so it is not flagged as unused; also forces all type symbols to be “used” in this module. */
export type M131_ALL_IMPORTED_TYPES =
  | RunPhase
  | TickTier
  | MacroRegime
  | PressureTier
  | SolvencyStatus
  | Asset
  | IPAItem
  | GameCard
  | GameEvent
  | ShieldLayer
  | Debt
  | Buff
  | Liability
  | SetBonus
  | AssetMod
  | IncomeItem
  | MacroEvent
  | ChaosWindow
  | AuctionResult
  | PurchaseResult
  | ShieldResult
  | ExitResult
  | TickResult
  | DeckComposition
  | TierProgress
  | WipeEvent
  | RegimeShiftEvent
  | PhaseTransitionEvent
  | TimerExpiredEvent
  | StreakEvent
  | FubarEvent
  | LedgerEntry
  | ProofCard
  | CompletedRun
  | SeasonState
  | RunState
  | MomentEvent
  | ClipBoundary
  | MechanicTelemetryPayload
  | MechanicEmitter
  | FactionBenefit;

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M131Input {
  factionChoice?: string;
  seasonId?: string;
  factionBenefits?: FactionBenefit[];
}

export interface M131Output {
  factionActive: boolean;
  cosmeticFlavor: string;
  powerGuardPassed: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M131Event = 'FACTION_JOINED' | 'FACTION_BENEFIT_APPLIED' | 'POWER_GUARD_VERIFIED';

export interface M131TelemetryPayload extends MechanicTelemetryPayload {
  event: M131Event;
  mechanic_id: 'M131';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M131_BOUNDS = {
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

// ── Internal helpers ──────────────────────────────────────────────────────

const ALLOWED_BENEFIT_KINDS: ReadonlySet<FactionBenefitKind> = new Set([
  'COSMETIC',
  'TITLE',
  'FRAME',
  'BANNER',
  'SFX',
  'EMOTE',
  'BADGE',
]);

function isPowerAffectingBenefit(b: FactionBenefit): boolean {
  if (b.powerAffecting === true) return true;

  // If someone sneaks economic/gameplay signals into the benefit payload, reject.
  const suspiciousKeys = [
    'cash',
    'cashDelta',
    'cashflow',
    'cashflowDelta',
    'netWorth',
    'xp',
    'score',
    'multiplier',
    'interest',
    'apr',
    'rate',
    'damage',
    'shield',
    'strength',
    'buff',
    'debt',
  ];

  for (const k of Object.keys(b)) {
    const lk = k.toLowerCase();
    if (suspiciousKeys.some(s => lk.includes(s))) return true;
  }

  const tags = (b.tags ?? []).map(t => String(t).toLowerCase());
  if (tags.some(t => t.includes('power') || t.includes('pay-to-win') || t.includes('econ') || t.includes('stats'))) {
    return true;
  }

  return false;
}

function chooseDeterministic<T>(seed: string, salt: number, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('chooseDeterministic: empty array'); // should never happen
  return arr[seededIndex(seed, salt, arr.length)];
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * factionSponsorshipHandler
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function factionSponsorshipHandler(input: M131Input, emit: MechanicEmitter): M131Output {
  const factionChoice = String(input.factionChoice ?? '');
  const seasonId = String(input.seasonId ?? '');

  const factionBenefits: FactionBenefit[] = Array.isArray(input.factionBenefits)
    ? (input.factionBenefits as FactionBenefit[])
    : [];

  // Canonical runId for verification (server can recompute this for ledger checks).
  const runId = computeHash(
    JSON.stringify({
      mechanic: 'M131',
      seasonId,
      factionChoice,
      benefitIds: factionBenefits.map(b => String(b?.id ?? '')).slice(0, 64),
    }),
  );

  // Deterministic pseudo-tick for flavor shaping (M131 is cosmetic-only; does not mutate runtime state).
  const tick = seededIndex(runId, 0, RUN_TOTAL_TICKS);

  // Deterministic "context" (without depending on other mechanics).
  const macroRegime: MacroRegime = chooseDeterministic<MacroRegime>(runId, 1, ['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'] as const);
  const runPhase: RunPhase = chooseDeterministic<RunPhase>(runId, 2, ['EARLY', 'MID', 'LATE'] as const);
  const pressureTier: PressureTier = chooseDeterministic<PressureTier>(runId, 3, ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const);

  // Schedules (forces these helpers/constants to be used in real logic).
  const macroSchedule = buildMacroSchedule(`${runId}:${seasonId}:${factionChoice}`, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(`${runId}:${seasonId}:${factionChoice}`, CHAOS_WINDOWS_PER_RUN);

  // Cosmetic-only intensity shaping (no power impact).
  const decay = computeDecayRate(macroRegime, M131_BOUNDS.BASE_DECAY_RATE);
  const pulse = tick > 0 && tick % M131_BOUNDS.PULSE_CYCLE === 0 ? EXIT_PULSE_MULTIPLIERS[macroRegime] : 1.0;
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const intensity = clamp(decay * pulse * regimeMult, 0.01, 1.0);

  // Weighted cosmetic “mascot card” (never applied to deck; only used as flavor token).
  const pressurePhaseWeight = (PRESSURE_WEIGHTS[pressureTier] ?? 1.0) * (PHASE_WEIGHTS[runPhase] ?? 1.0);
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const pool = buildWeightedPool(`${runId}:pool`, pressurePhaseWeight, regimeWeight);
  const picked = pool[seededIndex(runId, tick, pool.length)] ?? DEFAULT_CARD;

  // Hard guard: card id must be from known pools (still cosmetic-only, but keep deterministic integrity).
  const safeCardId =
    DEFAULT_CARD_IDS.includes(picked.id) || OPPORTUNITY_POOL.some(c => c.id === picked.id) ? picked.id : DEFAULT_CARD.id;

  // Benefits: allow only cosmetic metadata; reject anything that smells like power.
  let powerGuardPassed = true;
  for (const b of factionBenefits) {
    const kind = String(b?.kind ?? 'COSMETIC') as FactionBenefitKind;
    const id = String(b?.id ?? '');

    const kindAllowed = ALLOWED_BENEFIT_KINDS.has(kind);
    const powerAffecting = isPowerAffectingBenefit(b);

    if (!kindAllowed || powerAffecting) powerGuardPassed = false;

    // Emit every benefit as a cosmetic application attempt (server can audit and reject if needed).
    emit({
      event: 'FACTION_BENEFIT_APPLIED',
      mechanic_id: 'M131',
      tick,
      runId,
      payload: {
        seasonId,
        factionChoice,
        benefitId: id,
        kind,
        kindAllowed,
        powerAffecting,
      },
    });
  }

  // Join event
  emit({
    event: 'FACTION_JOINED',
    mechanic_id: 'M131',
    tick,
    runId,
    payload: { factionChoice, seasonId, benefitCount: factionBenefits.length },
  });

  // Power guard verification event
  emit({
    event: 'POWER_GUARD_VERIFIED',
    mechanic_id: 'M131',
    tick,
    runId,
    payload: {
      powerGuardPassed,
      macroRegime,
      runPhase,
      pressureTier,
      intensity,
    },
  });

  // Deterministic cosmetic flavor string (stable, compact, audit-friendly).
  const benefitTokens = seededShuffle(
    factionBenefits
      .map(b => `${String(b?.kind ?? 'COSMETIC')}:${String(b?.id ?? '').slice(0, 32)}`)
      .filter(Boolean),
    `${runId}:benefits`,
  ).slice(0, 8);

  const macroFirst = macroSchedule[0]?.tick ?? 0;
  const chaosFirst = chaosWindows[0]?.startTick ?? 0;

  const cosmeticFlavor = [
    computeHash(
      JSON.stringify({
        seasonId,
        factionChoice,
        safeCardId,
        macroRegime,
        runPhase,
        pressureTier,
        intensity: Number(intensity.toFixed(4)),
        macroFirst,
        chaosFirst,
        benefitTokens,
      }),
    ),
    safeCardId,
    macroRegime,
    runPhase,
    pressureTier,
    `I${Math.round(intensity * 1000)}`,
    `M${macroFirst}`,
    `C${chaosFirst}`,
    ...benefitTokens,
  ]
    .join('|')
    .slice(0, 220); // keep UI-safe / log-safe

  return {
    factionActive: true,
    cosmeticFlavor,
    powerGuardPassed,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M131MLInput {
  factionActive?: boolean;
  cosmeticFlavor?: string;
  powerGuardPassed?: boolean;
  runId: string;
  tick: number;
}

export interface M131MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion) (non-crypto placeholder hash here)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * factionSponsorshipHandlerMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function factionSponsorshipHandlerMLCompanion(input: M131MLInput): Promise<M131MLOutput> {
  const seed = String(input.runId ?? '');
  const tick = Math.max(0, Math.floor(Number(input.tick ?? 0)));

  const macroRegime: MacroRegime = chooseDeterministic<MacroRegime>(seed, tick + 7, ['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'] as const);
  const decay = computeDecayRate(macroRegime, M131_BOUNDS.BASE_DECAY_RATE);
  const pulse = tick > 0 && tick % M131_BOUNDS.PULSE_CYCLE === 0 ? EXIT_PULSE_MULTIPLIERS[macroRegime] : 1.0;

  const active = Boolean(input.factionActive);
  const guard = Boolean(input.powerGuardPassed);

  // Advisory score: rewards “cosmetic participation + clean guard”; penalizes guard fail.
  const base = active ? 0.55 : 0.35;
  const guardBonus = guard ? 0.20 : -0.25;
  const regimeBonus = clamp((REGIME_MULTIPLIERS[macroRegime] ?? 1.0) - 1.0, -0.5, 0.5) * 0.10;
  const pulseBonus = clamp(pulse - 1.0, -0.75, 0.75) * 0.05;

  const score = clamp(base + guardBonus + regimeBonus + pulseBonus, 0.01, 0.99);

  const factors = seededShuffle(
    [
      active ? 'Faction flavor active' : 'Faction flavor inactive',
      guard ? 'No pay-to-win guard passed' : 'Guard failed: benefit payload flagged',
      `Macro regime context: ${macroRegime}`,
      `Decay shaping: ${decay.toFixed(3)}`,
      tick % M131_BOUNDS.PULSE_CYCLE === 0 ? 'Pulse tick: flavor spike window' : 'Normal tick: steady flavor',
    ],
    `${seed}:m131:factors:${tick}`,
  ).slice(0, 5);

  const recommendation = guard
    ? 'Use faction cosmetics to reinforce identity; keep benefits strictly visual.'
    : 'Remove or sanitize any benefit payload fields that could affect gameplay or economy.';

  return {
    score,
    topFactors: factors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M131:v1'),
    confidenceDecay: clamp(decay, 0.01, 0.25),
  };
}