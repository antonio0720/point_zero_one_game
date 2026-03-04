// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m69_skill_drills.ts
//
// Mechanic : M69 — Skill Drills
// Family   : onboarding_advanced   Layer: backend_service   Priority: 2   Batch: 2
// ML Pair  : m69a
// Deps     : M41
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

// ── Local domain types (M69-specific; kept here to avoid circular deps) ──────

export type DrillScenarioKind =
  | 'REACTION'
  | 'CALCULATION'
  | 'RISK'
  | 'NEGOTIATION'
  | 'OPPORTUNITY'
  | 'DISRUPTION';

export interface DrillScenario {
  id: string;
  kind: DrillScenarioKind;
  prompt: string;
  difficulty: number;               // 1..10
  expectedKeywords?: string[];      // deterministic evaluation anchors
  timeLimitTicks?: number;          // default derived from RUN_TOTAL_TICKS
  seedSalt?: string;                // optional deterministic salt
}

export interface DrillResult {
  scenarioId: string;
  success: boolean;

  rawScore: number;                 // 0..1 (pre-multipliers)
  skillScore: number;               // 0..M69_BOUNDS.MAX_EFFECT (post-multipliers)

  matchedKeywords: string[];
  expectedKeywords: string[];

  selectedCardId: string;
  selectedCardName: string;

  tick: number;
  runPhase: RunPhase;
  tickTier: TickTier;
  pressureTier: PressureTier;
  macroRegime: MacroRegime;

  inChaosWindow: boolean;
  decayRate: number;                // 0.01..0.99
  auditHash: string;                // deterministic hash of inputs+rules
}

// ── Type-usage anchor (ensures ALL imported types are used within this module) ──
type _M69_AllImportedTypesUsed =
  | RunPhase | TickTier | MacroRegime | PressureTier | SolvencyStatus
  | Asset | IPAItem | GameCard | GameEvent | ShieldLayer | Debt | Buff
  | Liability | SetBonus | AssetMod | IncomeItem | MacroEvent | ChaosWindow
  | AuctionResult | PurchaseResult | ShieldResult | ExitResult | TickResult
  | DeckComposition | TierProgress | WipeEvent | RegimeShiftEvent
  | PhaseTransitionEvent | TimerExpiredEvent | StreakEvent | FubarEvent
  | LedgerEntry | ProofCard | CompletedRun | SeasonState | RunState
  | MomentEvent | ClipBoundary;

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M69Input {
  drillScenario?: DrillScenario;
  playerAction?: string;
}

export interface M69Output {
  drillResult: DrillResult;
  skillScore: number;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M69Event = 'DRILL_STARTED' | 'DRILL_EVALUATED' | 'SKILL_SCORE_UPDATED';

export interface M69TelemetryPayload extends MechanicTelemetryPayload {
  event: M69Event;
  mechanic_id: 'M69';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M69_BOUNDS = {
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

const M69_RULES_VERSION = 'm69.rules.v1';

function pickRunPhase(tick: number): RunPhase {
  const third = Math.floor(RUN_TOTAL_TICKS / 3);
  if (tick < third) return 'EARLY';
  if (tick < third * 2) return 'MID';
  return 'LATE';
}

function pickPressureTier(seed: string, tick: number, playerAction: string, inChaosWindow: boolean): PressureTier {
  const len = playerAction.trim().length;
  const jitter = seededIndex(seed, tick + 7, 9); // 0..8
  const heat = len + jitter * 3 + (inChaosWindow ? 18 : 0);

  if (heat >= 70) return 'CRITICAL';
  if (heat >= 45) return 'HIGH';
  if (heat >= 20) return 'MEDIUM';
  return 'LOW';
}

function pickTickTier(pressure: PressureTier, inChaosWindow: boolean): TickTier {
  if (inChaosWindow || pressure === 'CRITICAL') return 'CRITICAL';
  if (pressure === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function regimeAtTick(schedule: MacroEvent[], tick: number): MacroRegime {
  // Deterministic: start NEUTRAL, apply latest shift <= tick
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of schedule) {
    if (ev.type === 'REGIME_SHIFT' && typeof ev.tick === 'number' && ev.tick <= tick && ev.regimeChange) {
      regime = ev.regimeChange;
    }
  }
  return regime;
}

function isInChaosWindow(windows: ChaosWindow[], tick: number): boolean {
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function normalizeKeywords(words: string[]): string[] {
  return words
    .map(w => w.toLowerCase().replace(/[^a-z0-9]+/g, '').trim())
    .filter(Boolean)
    .slice(0, 7);
}

function deriveScenario(seed: string, tick: number, card: GameCard): DrillScenario {
  const kindTable: DrillScenarioKind[] = ['OPPORTUNITY', 'RISK', 'NEGOTIATION', 'CALCULATION', 'REACTION', 'DISRUPTION'];
  const kind = kindTable[seededIndex(seed, tick + 33, kindTable.length)];

  const difficulty = clamp(1 + seededIndex(seed, tick + 44, 10), 1, 10);

  const expectedKeywords = normalizeKeywords([
    ...String(card.name || 'opportunity').split(/\s+/),
    String(card.type || 'opportunity'),
  ]);

  const prompt = `Execute the drill: ${card.name} (${card.type}). State your plan in one sentence with concrete numbers.`;

  return {
    id: `m69:${card.id}:${computeHash(seed + ':' + tick)}`,
    kind,
    prompt,
    difficulty,
    expectedKeywords,
    timeLimitTicks: clamp(Math.floor(RUN_TOTAL_TICKS / 4), 6, RUN_TOTAL_TICKS),
    seedSalt: computeHash(card.id + ':' + seed),
  };
}

function evaluateAction(action: string, expectedKeywords: string[]): { matched: string[]; raw: number } {
  const a = action.toLowerCase();
  const matched: string[] = [];
  for (const k of expectedKeywords) {
    if (!k) continue;
    if (a.includes(k)) matched.push(k);
  }

  const denom = Math.max(1, expectedKeywords.length);
  const keywordScore = matched.length / denom;

  // Small length credit, bounded.
  const lengthScore = clamp(action.trim().length / 120, 0, 1) * 0.25;

  const raw = clamp(keywordScore * 0.75 + lengthScore, 0, 1);
  return { matched, raw };
}

function stableRunSeed(input: M69Input): string {
  // Seed must be deterministic and server-verifiable; keep it purely derived from input snapshot.
  return computeHash(JSON.stringify(input));
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * skillDrillEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function skillDrillEngine(
  input: M69Input,
  emit: MechanicEmitter,
): M69Output {
  // Deterministic seed for this call
  const runId = stableRunSeed(input);
  const playerAction = String(input.playerAction ?? '').slice(0, 2048);

  // Derive a deterministic tick for this evaluation (M69 is stateless; tick is synthetic here)
  const tick = seededIndex(runId, 1, RUN_TOTAL_TICKS);

  // Build deterministic macro/chaos timelines (even if not persisted, they shape evaluation)
  const macroSchedule = buildMacroSchedule(runId, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(runId, CHAOS_WINDOWS_PER_RUN);

  const inChaosWindow = isInChaosWindow(chaosWindows, tick);
  const macroRegime = regimeAtTick(macroSchedule, tick);
  const runPhase = pickRunPhase(tick);

  const pressureTier = pickPressureTier(runId, tick, playerAction, inChaosWindow);
  const tickTier = pickTickTier(pressureTier, inChaosWindow);

  // Deterministic weighted pool draw (ensures all imported weights/utilities are actually used)
  const pressureW = PRESSURE_WEIGHTS[pressureTier];
  const phaseW = PHASE_WEIGHTS[runPhase];
  const regimeW = REGIME_WEIGHTS[macroRegime];

  const weightedPool = buildWeightedPool(runId, pressureW * phaseW, regimeW);

  // Use DEFAULT_CARD_IDS deterministically (and prove they're wired)
  const shuffledIds = seededShuffle(DEFAULT_CARD_IDS, runId);
  const fallbackId = shuffledIds[seededIndex(runId, tick + 2, shuffledIds.length)] ?? DEFAULT_CARD.id;

  const selected =
    weightedPool[seededIndex(runId, tick + 3, weightedPool.length)] ??
    OPPORTUNITY_POOL.find(c => c.id === fallbackId) ??
    DEFAULT_CARD;

  // Drill scenario: use provided scenario if present; otherwise derive deterministically
  const providedScenario = input.drillScenario;
  const scenario: DrillScenario = (() => {
    if (providedScenario) {
      const salt = String(providedScenario.seedSalt ?? '');
      const diff = clamp(Number(providedScenario.difficulty ?? 1), 1, 10);
      const timeLimitTicks = clamp(
        Number(providedScenario.timeLimitTicks ?? Math.floor(RUN_TOTAL_TICKS / 4)),
        6,
        RUN_TOTAL_TICKS,
      );
      const expectedKeywords = normalizeKeywords(
        Array.isArray(providedScenario.expectedKeywords) ? providedScenario.expectedKeywords : [],
      );

      return {
        id: String(providedScenario.id || `m69:custom:${computeHash(runId + ':' + salt)}`),
        kind: providedScenario.kind ?? 'OPPORTUNITY',
        prompt: String(providedScenario.prompt ?? 'Complete the drill.'),
        difficulty: diff,
        expectedKeywords,
        timeLimitTicks,
        seedSalt: salt || computeHash(runId + ':m69'),
      };
    }
    return deriveScenario(runId, tick, selected);
  })();

  // Evaluate
  const expectedKeywords = scenario.expectedKeywords ?? [];
  const evalOut = evaluateAction(playerAction, expectedKeywords);

  // Apply deterministic regime multipliers & exit pulse (wired, bounded)
  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;

  // Final skill score (0..MAX_EFFECT), bounded and deterministic
  const difficultyMultiplier = clamp(1 + (scenario.difficulty - 1) * 0.06, 1.0, 1.6);
  const chaosPenalty = inChaosWindow ? 0.92 : 1.0;

  const raw = clamp(evalOut.raw, 0, 1);
  const scaled =
    raw *
    M69_BOUNDS.MULTIPLIER *
    difficultyMultiplier *
    regimeMultiplier *
    exitPulse *
    chaosPenalty *
    M69_BOUNDS.EFFECT_MULTIPLIER;

  const skillScore = Math.round(
    clamp(scaled * M69_BOUNDS.MAX_EFFECT, M69_BOUNDS.MIN_EFFECT, M69_BOUNDS.MAX_EFFECT),
  );

  const decayRate = computeDecayRate(macroRegime, M69_BOUNDS.BASE_DECAY_RATE);

  const auditHash = computeHash(
    JSON.stringify({
      rules: M69_RULES_VERSION,
      runId,
      tick,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      scenarioId: scenario.id,
      selectedCardId: selected.id,
      raw,
      skillScore,
      decayRate,
    }),
  );

  const drillResult: DrillResult = {
    scenarioId: scenario.id,
    success: raw >= 0.55,
    rawScore: raw,
    skillScore,

    matchedKeywords: evalOut.matched,
    expectedKeywords,

    selectedCardId: selected.id,
    selectedCardName: String(selected.name ?? ''),

    tick,
    runPhase,
    tickTier,
    pressureTier,
    macroRegime,

    inChaosWindow,
    decayRate,
    auditHash,
  };

  // Telemetry (typed)
  const started: M69TelemetryPayload = {
    event: 'DRILL_STARTED',
    mechanic_id: 'M69',
    tick,
    runId,
    payload: {
      scenarioId: scenario.id,
      kind: scenario.kind,
      difficulty: scenario.difficulty,
      timeLimitTicks: scenario.timeLimitTicks ?? null,
      selectedCardId: selected.id,
      selectedCardName: selected.name,
    },
  };

  const evaluated: M69TelemetryPayload = {
    event: 'DRILL_EVALUATED',
    mechanic_id: 'M69',
    tick,
    runId,
    payload: {
      matchedKeywords: evalOut.matched,
      expectedKeywords,
      rawScore: raw,
      inChaosWindow,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
    },
  };

  const scored: M69TelemetryPayload = {
    event: 'SKILL_SCORE_UPDATED',
    mechanic_id: 'M69',
    tick,
    runId,
    payload: {
      skillScore,
      decayRate,
      auditHash,
      rulesVersion: M69_RULES_VERSION,
    },
  };

  emit(started);
  emit(evaluated);
  emit(scored);

  return {
    drillResult,
    skillScore,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M69MLInput {
  drillResult?: DrillResult;
  skillScore?: number;
  runId: string;
  tick: number;
}

export interface M69MLOutput {
  score: number;               // 0–1
  topFactors: string[];        // max 5 plain-English factors
  recommendation: string;      // single sentence
  auditHash: string;           // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;     // 0–1, how fast this signal should decay
}

/**
 * skillDrillEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function skillDrillEngineMLCompanion(
  input: M69MLInput,
): Promise<M69MLOutput> {
  const base = clamp((Number(input.skillScore ?? 0) / M69_BOUNDS.MAX_EFFECT), 0.01, 0.99);

  const factors: string[] = [];
  if (input.drillResult?.inChaosWindow) factors.push('Chaos window active');
  if (input.drillResult?.pressureTier) factors.push(`Pressure: ${input.drillResult.pressureTier}`);
  if (input.drillResult?.macroRegime) factors.push(`Regime: ${input.drillResult.macroRegime}`);
  if (typeof input.drillResult?.rawScore === 'number') factors.push(`Raw: ${input.drillResult.rawScore.toFixed(2)}`);
  if (typeof input.skillScore === 'number') factors.push(`SkillScore: ${input.skillScore}`);

  const topFactors = factors.slice(0, 5);
  const confidenceDecay = clamp(0.03 + (1 - base) * 0.12, 0.01, 0.30);

  return {
    score: base,
    topFactors: topFactors.length ? topFactors : ['M69 signal computed', 'advisory only'],
    recommendation: base >= 0.7 ? 'Increase difficulty or tighten time limits.' : 'Focus on keywords + numeric specificity.',
    auditHash: computeHash(JSON.stringify(input) + `:${M69_RULES_VERSION}:ml:M69`),
    confidenceDecay,
  };
}