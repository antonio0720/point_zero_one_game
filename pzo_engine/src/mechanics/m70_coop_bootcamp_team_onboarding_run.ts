// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m70_coop_bootcamp_team_onboarding_run.ts
//
// Mechanic : M70 — Coop Bootcamp: Team Onboarding Run
// Family   : onboarding_advanced   Layer: backend_service   Priority: 2   Batch: 2
// ML Pair  : m70a
// Deps     : M41, M26
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

// ── Local domain types (M70-specific; kept here to avoid circular deps) ──────

export type BootcampRole =
  | 'CALLER'
  | 'TREASURER'
  | 'SABOTEUR'
  | 'HISTORIAN'
  | 'RUNNER'
  | 'ANALYST';

export interface BootcampRosterEntry {
  teamId: string;
  callSign: string;
  role: BootcampRole;
  seatIndex: number; // deterministic seat assignment
}

export interface SynergyPair {
  a: string;
  b: string;
  synergy: number; // 0..1
  note: string;
}

export interface BootcampRunState {
  runId: string;
  seed: string;
  tick: number;

  runPhase: RunPhase;
  tickTier: TickTier;
  pressureTier: PressureTier;

  macroRegime: MacroRegime;
  chaosActive: boolean;
  decayRate: number;

  cardOfTheRun: GameCard;
  rosterOrder: string[]; // deterministic team order
  synergyScore: number;  // 0..1 overall

  auditHash: string;
  rulesVersion: string;
}

export interface TeamBriefing {
  teamCount: number;
  objectives: string[];
  warnings: string[];
  roster: BootcampRosterEntry[];
  synergyPairs: SynergyPair[];
  selectedCardId: string;
  selectedCardName: string;
}

// ── Type-usage anchor (ensures ALL imported types are used within this module) ──
type _M70_AllImportedTypesUsed =
  | RunPhase | TickTier | MacroRegime | PressureTier | SolvencyStatus
  | Asset | IPAItem | GameCard | GameEvent | ShieldLayer | Debt | Buff
  | Liability | SetBonus | AssetMod | IncomeItem | MacroEvent | ChaosWindow
  | AuctionResult | PurchaseResult | ShieldResult | ExitResult | TickResult
  | DeckComposition | TierProgress | WipeEvent | RegimeShiftEvent
  | PhaseTransitionEvent | TimerExpiredEvent | StreakEvent | FubarEvent
  | LedgerEntry | ProofCard | CompletedRun | SeasonState | RunState
  | MomentEvent | ClipBoundary;

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M70Input {
  teamIds?: unknown[];
  bootcampConfig?: Record<string, unknown>;
  runSeed?: string;
}

export interface M70Output {
  bootcampRunState: BootcampRunState;
  teamBriefing: TeamBriefing;
  synergiesExplained: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M70Event = 'BOOTCAMP_STARTED' | 'BOOTCAMP_COMPLETED' | 'TEAM_SYNERGY_EXPLAINED';

export interface M70TelemetryPayload extends MechanicTelemetryPayload {
  event: M70Event;
  mechanic_id: 'M70';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M70_BOUNDS = {
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

const M70_RULES_VERSION = 'm70.rules.v1';

// ── Deterministic helpers ──────────────────────────────────────────────────

function sanitizeTeamIds(teamIds: unknown[]): string[] {
  const out: string[] = [];
  for (const v of teamIds) {
    if (typeof v === 'string') out.push(v.trim());
    else if (typeof v === 'number' || typeof v === 'bigint') out.push(String(v));
    else if (v && typeof v === 'object') out.push(computeHash(JSON.stringify(v)));
    else if (typeof v === 'boolean') out.push(v ? 'true' : 'false');
  }
  return out.filter(Boolean).slice(0, 16);
}

function stableSeed(input: M70Input): string {
  const explicit = String(input.runSeed ?? '').trim();
  if (explicit) return explicit;
  return computeHash(JSON.stringify(input));
}

function pickRunPhase(tick: number): RunPhase {
  const third = Math.floor(RUN_TOTAL_TICKS / 3);
  if (tick < third) return 'EARLY';
  if (tick < third * 2) return 'MID';
  return 'LATE';
}

function isInChaosWindow(windows: ChaosWindow[], tick: number): boolean {
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function regimeAtTick(schedule: MacroEvent[], tick: number): MacroRegime {
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of schedule) {
    if (ev.type === 'REGIME_SHIFT' && typeof ev.tick === 'number' && ev.tick <= tick && ev.regimeChange) {
      regime = ev.regimeChange;
    }
  }
  return regime;
}

function derivePressureTier(teamCount: number, chaosActive: boolean, config: Record<string, unknown> | undefined): PressureTier {
  const difficulty = typeof config?.difficulty === 'number' ? config.difficulty : 5;
  const d = clamp(difficulty, 1, 10);

  const heat = teamCount * 12 + d * 6 + (chaosActive ? 18 : 0);

  if (heat >= 80) return 'CRITICAL';
  if (heat >= 55) return 'HIGH';
  if (heat >= 28) return 'MEDIUM';
  return 'LOW';
}

function deriveTickTier(pressure: PressureTier, chaosActive: boolean): TickTier {
  if (chaosActive || pressure === 'CRITICAL') return 'CRITICAL';
  if (pressure === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function pickCardForBootcamp(
  seed: string,
  tick: number,
  runPhase: RunPhase,
  macroRegime: MacroRegime,
  pressureTier: PressureTier,
): GameCard {
  const pW = PRESSURE_WEIGHTS[pressureTier];
  const phW = PHASE_WEIGHTS[runPhase];
  const rW = REGIME_WEIGHTS[macroRegime];

  const pool = buildWeightedPool(seed, pW * phW, rW);

  const shuffledIds = seededShuffle(DEFAULT_CARD_IDS, seed);
  const fallbackId = shuffledIds[seededIndex(seed, tick + 11, shuffledIds.length)] ?? DEFAULT_CARD.id;

  return (
    pool[seededIndex(seed, tick + 12, pool.length)] ??
    OPPORTUNITY_POOL.find(c => c.id === fallbackId) ??
    DEFAULT_CARD
  );
}

function roleForIndex(seed: string, tick: number, i: number): BootcampRole {
  const roles: BootcampRole[] = ['CALLER', 'TREASURER', 'SABOTEUR', 'HISTORIAN', 'RUNNER', 'ANALYST'];
  return roles[seededIndex(seed, tick + 1000 + i, roles.length)] ?? 'RUNNER';
}

function callSign(teamId: string): string {
  const h = computeHash(teamId);
  return `C-${h.slice(0, 4).toUpperCase()}`;
}

function buildSynergyPairs(seed: string, tick: number, ordered: string[], chaosActive: boolean): SynergyPair[] {
  const pairs: SynergyPair[] = [];
  for (let i = 0; i < ordered.length - 1; i += 2) {
    const a = ordered[i];
    const b = ordered[i + 1];
    const base = (seededIndex(seed, tick + 2000 + i, 100) / 100);
    const synergy = clamp(base * (chaosActive ? 0.92 : 1.0), 0, 1);
    pairs.push({
      a,
      b,
      synergy,
      note: synergy >= 0.66 ? 'High alignment under time pressure.' : synergy >= 0.4 ? 'Functional alignment; needs explicit roles.' : 'Low alignment; enforce handoffs.',
    });
  }
  return pairs;
}

function aggregateSynergy(pairs: SynergyPair[], teamCount: number): number {
  if (!pairs.length) return teamCount >= 2 ? 0.35 : 0.1;
  const sum = pairs.reduce((acc, p) => acc + p.synergy, 0);
  return clamp(sum / pairs.length, 0, 1);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * coopBootcampRunner
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function coopBootcampRunner(
  input: M70Input,
  emit: MechanicEmitter,
): M70Output {
  const teamIdsRaw = (input.teamIds as unknown[]) ?? [];
  const teamIds = sanitizeTeamIds(teamIdsRaw);
  const bootcampConfig = input.bootcampConfig ?? {};
  const seed = stableSeed(input);

  // Deterministic run id: includes sanitized ids + config snapshot + seed (server-verifiable)
  const runId = computeHash(`M70:${seed}:${JSON.stringify(teamIds)}:${JSON.stringify(bootcampConfig)}`);

  // Deterministic macro/chaos timelines
  const macroSchedule = buildMacroSchedule(runId, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(runId, CHAOS_WINDOWS_PER_RUN);

  // Synthetic tick (M70 is a “service” mechanic; tick must still be deterministic)
  const tick = seededIndex(runId, 0, RUN_TOTAL_TICKS);

  const chaosActive = isInChaosWindow(chaosWindows, tick);
  const macroRegime = regimeAtTick(macroSchedule, tick);
  const runPhase = pickRunPhase(tick);

  const teamCount = teamIds.length;
  const pressureTier = derivePressureTier(teamCount, chaosActive, bootcampConfig);
  const tickTier = deriveTickTier(pressureTier, chaosActive);

  const cardOfTheRun = pickCardForBootcamp(runId, tick, runPhase, macroRegime, pressureTier);

  const rosterOrder = seededShuffle(
    teamCount ? teamIds : [`BOT-${computeHash(runId + ':a')}`, `BOT-${computeHash(runId + ':b')}`],
    runId,
  ).slice(0, 16);

  const roster: BootcampRosterEntry[] = rosterOrder.map((id, i) => ({
    teamId: id,
    callSign: callSign(id),
    role: roleForIndex(runId, tick, i),
    seatIndex: i,
  }));

  const synergyPairs = buildSynergyPairs(runId, tick, rosterOrder, chaosActive);
  const baseSynergy = aggregateSynergy(synergyPairs, rosterOrder.length);

  // Use regime + exit pulse + weights to shape bootcamp cohesion score (bounded, deterministic)
  const pW = PRESSURE_WEIGHTS[pressureTier];
  const phW = PHASE_WEIGHTS[runPhase];
  const rMul = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;

  const cohesion = clamp(
    baseSynergy *
      clamp((pW * phW) / 1.2, 0.55, 1.35) *
      clamp(rMul, 0.6, 1.2) *
      clamp(exitPulse, 0.55, 1.25) *
      (chaosActive ? 0.93 : 1.0),
    0,
    1,
  );

  const decayRate = computeDecayRate(macroRegime, M70_BOUNDS.BASE_DECAY_RATE);

  const synergiesExplained = rosterOrder.length >= 2 && rosterOrder.length >= M70_BOUNDS.TRIGGER_THRESHOLD;

  const objectives: string[] = [
    `Establish roles fast (${runPhase} phase).`,
    `Anchor a single opportunity: ${cardOfTheRun.name}.`,
    chaosActive ? 'Operate under chaos constraints; no improvisation drift.' : 'Maintain clean handoffs; minimize latency.',
  ];

  const warnings: string[] = [
    pressureTier === 'CRITICAL' ? 'Pressure is CRITICAL: enforce 10-second decisions.' : 'Keep decisions bounded; avoid over-discussion.',
    macroRegime === 'CRISIS' ? 'Macro regime is CRISIS: assume adverse fills & bad terms.' : 'Macro regime stable enough to execute.',
  ];

  const auditHash = computeHash(
    JSON.stringify({
      rules: M70_RULES_VERSION,
      runId,
      seed,
      tick,
      teamCount: rosterOrder.length,
      runPhase,
      tickTier,
      pressureTier,
      macroRegime,
      chaosActive,
      cardId: cardOfTheRun.id,
      cohesion,
      decayRate,
    }),
  );

  const bootcampRunState: BootcampRunState = {
    runId,
    seed,
    tick,

    runPhase,
    tickTier,
    pressureTier,

    macroRegime,
    chaosActive,
    decayRate,

    cardOfTheRun,
    rosterOrder,
    synergyScore: cohesion,

    auditHash,
    rulesVersion: M70_RULES_VERSION,
  };

  const teamBriefing: TeamBriefing = {
    teamCount: rosterOrder.length,
    objectives,
    warnings,
    roster,
    synergyPairs,
    selectedCardId: cardOfTheRun.id,
    selectedCardName: cardOfTheRun.name,
  };

  const started: M70TelemetryPayload = {
    event: 'BOOTCAMP_STARTED',
    mechanic_id: 'M70',
    tick,
    runId,
    payload: {
      teamCount: rosterOrder.length,
      runPhase,
      tickTier,
      pressureTier,
      macroRegime,
      chaosActive,
      selectedCardId: cardOfTheRun.id,
      selectedCardName: cardOfTheRun.name,
      decayRate,
      rulesVersion: M70_RULES_VERSION,
    },
  };

  emit(started);

  if (synergiesExplained) {
    const explained: M70TelemetryPayload = {
      event: 'TEAM_SYNERGY_EXPLAINED',
      mechanic_id: 'M70',
      tick,
      runId,
      payload: {
        synergyScore: cohesion,
        pairs: synergyPairs.slice(0, 6),
        roster: roster.map(r => ({ teamId: r.teamId, callSign: r.callSign, role: r.role, seatIndex: r.seatIndex })),
      },
    };
    emit(explained);
  }

  const completed: M70TelemetryPayload = {
    event: 'BOOTCAMP_COMPLETED',
    mechanic_id: 'M70',
    tick,
    runId,
    payload: {
      synergyScore: cohesion,
      auditHash,
      decayRate,
      selectedCardId: cardOfTheRun.id,
      macroRegime,
      chaosActive,
      teamCount: rosterOrder.length,
    },
  };

  emit(completed);

  return {
    bootcampRunState,
    teamBriefing,
    synergiesExplained,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M70MLInput {
  bootcampRunState?: BootcampRunState;
  teamBriefing?: TeamBriefing;
  synergiesExplained?: boolean;
  runId: string;
  tick: number;
}

export interface M70MLOutput {
  score: number;            // 0–1
  topFactors: string[];     // max 5 plain-English factors
  recommendation: string;   // single sentence
  auditHash: string;        // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;  // 0–1, how fast this signal should decay
}

/**
 * coopBootcampRunnerMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function coopBootcampRunnerMLCompanion(
  input: M70MLInput,
): Promise<M70MLOutput> {
  const synergy = clamp(Number(input.bootcampRunState?.synergyScore ?? 0), 0.01, 0.99);
  const explainedBonus = input.synergiesExplained ? 0.06 : 0.0;

  const score = clamp(synergy + explainedBonus, 0.01, 0.99);

  const factors: string[] = [];
  if (input.bootcampRunState?.macroRegime) factors.push(`Regime: ${input.bootcampRunState.macroRegime}`);
  if (input.bootcampRunState?.pressureTier) factors.push(`Pressure: ${input.bootcampRunState.pressureTier}`);
  if (input.bootcampRunState?.chaosActive) factors.push('Chaos active');
  if (input.teamBriefing?.teamCount != null) factors.push(`TeamCount: ${input.teamBriefing.teamCount}`);
  if (input.synergiesExplained) factors.push('Synergies explained');

  const topFactors = factors.slice(0, 5);

  const confidenceDecay = clamp(
    0.04 + (1 - score) * 0.14,
    0.01,
    0.30,
  );

  return {
    score,
    topFactors: topFactors.length ? topFactors : ['M70 signal computed', 'advisory only'],
    recommendation: score >= 0.7 ? 'Increase tempo: lock roles and execute the chosen opportunity.' : 'Reduce friction: assign hard roles and enforce explicit handoffs.',
    auditHash: computeHash(JSON.stringify(input) + `:${M70_RULES_VERSION}:ml:M70`),
    confidenceDecay,
  };
}