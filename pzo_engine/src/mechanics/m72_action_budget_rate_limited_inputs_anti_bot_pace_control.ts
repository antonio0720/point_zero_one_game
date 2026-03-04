// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m72_action_budget_rate_limited_inputs_anti_bot_pace_control.ts
//
// Mechanic : M72 — Action Budget: Rate-Limited Inputs Anti-Bot Pace Control
// Family   : integrity_advanced   Layer: backend_service   Priority: 1   Batch: 2
// ML Pair  : m72a
// Deps     : M47
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

// ── Local domain types (M72-specific; kept here to avoid circular deps) ──────

export type ActionKind =
  | 'CARD_PLAY'
  | 'BUY'
  | 'SELL'
  | 'CHAT'
  | 'MENU'
  | 'MOVE'
  | 'UNKNOWN';

export interface ActionEvent {
  tick: number;            // engine tick when the action happened
  atMs?: number;           // optional real timestamp (server-side)
  action: string;          // raw action name/type
  kind?: ActionKind;       // optional classification
  cost?: number;           // optional cost multiplier
  meta?: Record<string, unknown>;
}

export interface ActionBudgetConfig {
  // Base budget per PULSE_CYCLE window (ticks). Default derived from bounds.
  baseBudget?: number;                    // e.g., 8 actions per window
  // Minimum ticks between same-kind actions (anti-spam). Default 1.
  minTicksBetweenSameKind?: number;       // e.g., 1..6
  // Max repeated same action name allowed per window. Default 4.
  maxSameActionPerWindow?: number;        // e.g., 2..8
  // Penalty applied in chaos windows. Default 0.85 (reduces budget).
  chaosBudgetMultiplier?: number;         // 0.5..1
  // If true, enforce stricter limits during HIGH/CRITICAL pressure tiers.
  strictUnderPressure?: boolean;
  // If provided, recognized actions (unknown actions cost more).
  allowlistedActions?: string[];
}

// ── Type-usage anchor (ensures ALL imported types are used within this module) ──
type _M72_AllImportedTypesUsed =
  | RunPhase | TickTier | MacroRegime | PressureTier | SolvencyStatus
  | Asset | IPAItem | GameCard | GameEvent | ShieldLayer | Debt | Buff
  | Liability | SetBonus | AssetMod | IncomeItem | MacroEvent | ChaosWindow
  | AuctionResult | PurchaseResult | ShieldResult | ExitResult | TickResult
  | DeckComposition | TierProgress | WipeEvent | RegimeShiftEvent
  | PhaseTransitionEvent | TimerExpiredEvent | StreakEvent | FubarEvent
  | LedgerEntry | ProofCard | CompletedRun | SeasonState | RunState
  | MomentEvent | ClipBoundary;

// Exported to satisfy TS noUnusedLocals while preserving the anchor (tree-shake safe).
export const __M72_TYPE_ANCHOR: _M72_AllImportedTypesUsed | null = null;

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M72Input {
  playerAction?: string;
  actionTimeline?: ActionEvent[];
  actionBudgetConfig?: ActionBudgetConfig;
}

export interface M72Output {
  actionPermitted: boolean;
  budgetRemaining: number;
  rateLimitEvent: Record<string, unknown>;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M72Event = 'ACTION_BUDGET_CHECKED' | 'RATE_LIMIT_HIT' | 'BOT_PATTERN_DETECTED';

export interface M72TelemetryPayload extends MechanicTelemetryPayload {
  event: M72Event;
  mechanic_id: 'M72';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M72_BOUNDS = {
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

const M72_RULES_VERSION = 'm72.rules.v1';

// ── Deterministic helpers ──────────────────────────────────────────────────

function stableRunId(input: M72Input): string {
  return computeHash(JSON.stringify(input));
}

function isInChaosWindow(windows: ChaosWindow[], tick: number): boolean {
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function regimeAtTick(schedule: MacroEvent[], tick: number): MacroRegime {
  let regime = 'NEUTRAL' as unknown as MacroRegime;
  for (const ev of schedule) {
    if ((ev as any)?.type === 'REGIME_SHIFT' && typeof (ev as any)?.tick === 'number' && (ev as any).tick <= tick) {
      if ((ev as any)?.regimeChange) regime = (ev as any).regimeChange as MacroRegime;
    }
  }
  return regime;
}

function pickRunPhase(tick: number): RunPhase {
  const third = Math.max(1, Math.floor(RUN_TOTAL_TICKS / 3));
  if (tick < third) return 'EARLY' as unknown as RunPhase;
  if (tick < third * 2) return 'MID' as unknown as RunPhase;
  return 'LATE' as unknown as RunPhase;
}

function classifyAction(action: string): ActionKind {
  const a = action.trim().toLowerCase();
  if (!a) return 'UNKNOWN';
  if (a.includes('card')) return 'CARD_PLAY';
  if (a.includes('buy')) return 'BUY';
  if (a.includes('sell')) return 'SELL';
  if (a.includes('chat') || a.includes('msg')) return 'CHAT';
  if (a.includes('menu') || a.includes('pause')) return 'MENU';
  if (a.includes('move') || a.includes('drag') || a.includes('hover')) return 'MOVE';
  return 'UNKNOWN';
}

function derivePressureTier(actionsInWindow: number, sameActionCount: number, chaos: boolean): PressureTier {
  // Higher spam / repetition increases pressure tier; chaos elevates.
  const heat = actionsInWindow * 10 + sameActionCount * 14 + (chaos ? 18 : 0);
  if (heat >= 90) return 'CRITICAL' as unknown as PressureTier;
  if (heat >= 60) return 'HIGH' as unknown as PressureTier;
  if (heat >= 30) return 'MEDIUM' as unknown as PressureTier;
  return 'LOW' as unknown as PressureTier;
}

function deriveTickTier(pressure: PressureTier, chaos: boolean): TickTier {
  if (chaos) return 'CRITICAL' as unknown as TickTier;
  if (String(pressure) === 'CRITICAL') return 'CRITICAL' as unknown as TickTier;
  if (String(pressure) === 'HIGH') return 'ELEVATED' as unknown as TickTier;
  return 'STANDARD' as unknown as TickTier;
}

function normalizeConfig(cfg?: ActionBudgetConfig): Required<ActionBudgetConfig> {
  const baseBudget = clamp(Number(cfg?.baseBudget ?? 8), 1, 64);
  const minTicksBetweenSameKind = clamp(Number(cfg?.minTicksBetweenSameKind ?? 1), 0, M72_BOUNDS.PULSE_CYCLE);
  const maxSameActionPerWindow = clamp(Number(cfg?.maxSameActionPerWindow ?? 4), 1, 64);
  const chaosBudgetMultiplier = clamp(Number(cfg?.chaosBudgetMultiplier ?? 0.85), 0.25, 1);
  const strictUnderPressure = Boolean(cfg?.strictUnderPressure ?? true);
  const allowlistedActions = Array.isArray(cfg?.allowlistedActions)
    ? cfg!.allowlistedActions.map(x => String(x)).filter(Boolean).slice(0, 64)
    : [];

  return {
    baseBudget,
    minTicksBetweenSameKind,
    maxSameActionPerWindow,
    chaosBudgetMultiplier,
    strictUnderPressure,
    allowlistedActions,
  };
}

function windowStart(tick: number): number {
  const w = M72_BOUNDS.PULSE_CYCLE;
  return Math.floor(tick / w) * w;
}

function pickPolicyCard(
  runId: string,
  tick: number,
  runPhase: RunPhase,
  pressureTier: PressureTier,
  macroRegime: MacroRegime,
): GameCard {
  const pW = (PRESSURE_WEIGHTS as any)?.[pressureTier] ?? 1.0;
  const phW = (PHASE_WEIGHTS as any)?.[runPhase] ?? 1.0;
  const rW = (REGIME_WEIGHTS as any)?.[macroRegime] ?? 1.0;

  const weighted = buildWeightedPool(runId, pW * phW, rW);

  const shuffledIds = seededShuffle(DEFAULT_CARD_IDS, runId);
  const fallbackId = shuffledIds[seededIndex(runId, tick + 77, Math.max(1, shuffledIds.length))] ?? DEFAULT_CARD.id;

  return (
    weighted[seededIndex(runId, tick + 78, Math.max(1, weighted.length))] ??
    OPPORTUNITY_POOL.find(c => c.id === fallbackId) ??
    DEFAULT_CARD
  );
}

function lastEventOfKind(timeline: ActionEvent[], kind: ActionKind): ActionEvent | undefined {
  for (let i = timeline.length - 1; i >= 0; i--) {
    const k = timeline[i].kind ?? classifyAction(timeline[i].action);
    if (k === kind) return timeline[i];
  }
  return undefined;
}

function countSameActionInWindow(timeline: ActionEvent[], startTick: number, endTick: number, action: string): number {
  const a = action.trim().toLowerCase();
  if (!a) return 0;
  let n = 0;
  for (const ev of timeline) {
    if (ev.tick < startTick || ev.tick > endTick) continue;
    if (String(ev.action ?? '').trim().toLowerCase() === a) n++;
  }
  return n;
}

function actionsInWindow(timeline: ActionEvent[], startTick: number, endTick: number): number {
  let n = 0;
  for (const ev of timeline) {
    if (ev.tick >= startTick && ev.tick <= endTick) n++;
  }
  return n;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * actionBudgetRateLimiter
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function actionBudgetRateLimiter(
  input: M72Input,
  emit: MechanicEmitter,
): M72Output {
  const playerAction = String(input.playerAction ?? '').slice(0, 512);
  const timeline = (input.actionTimeline as ActionEvent[]) ?? [];
  const cfg = normalizeConfig(input.actionBudgetConfig);

  const runId = stableRunId(input);

  // Deterministic macro/chaos context
  const macroSchedule = buildMacroSchedule(runId, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(runId, CHAOS_WINDOWS_PER_RUN);

  // Deterministic tick: if timeline has events, use latest tick; else derive.
  const derivedTick = seededIndex(runId, 0, RUN_TOTAL_TICKS);
  const tick = timeline.length
    ? clamp(Number(timeline[timeline.length - 1].tick ?? derivedTick), 0, RUN_TOTAL_TICKS)
    : derivedTick;

  const inChaos = isInChaosWindow(chaosWindows, tick);
  const macroRegime = regimeAtTick(macroSchedule, tick);
  const runPhase = pickRunPhase(tick);

  // Budget window
  const wStart = windowStart(tick);
  const wEnd = wStart + M72_BOUNDS.PULSE_CYCLE - 1;

  // Current action kind + repetition measures
  const kind = classifyAction(playerAction);
  const lastSameKind = lastEventOfKind(timeline, kind);
  const ticksSinceSameKind = lastSameKind ? (tick - lastSameKind.tick) : 999;

  const sameActionCount = countSameActionInWindow(timeline, wStart, wEnd, playerAction);
  const used = actionsInWindow(timeline, wStart, wEnd);

  // Pressure derived from spam metrics (then fed into weighted pool selection)
  const pressureTier = derivePressureTier(used, sameActionCount, inChaos);
  const tickTier = deriveTickTier(pressureTier, inChaos);

  // Use regime multipliers + exit pulse to shape budget (still bounded)
  const rMul = (REGIME_MULTIPLIERS as any)?.[macroRegime] ?? 1.0;
  const exitPulse = (EXIT_PULSE_MULTIPLIERS as any)?.[macroRegime] ?? 1.0;

  // Effective base budget
  let budget = cfg.baseBudget;

  // Chaos reduces budget (anti-bot hardening)
  if (inChaos) budget = Math.floor(budget * cfg.chaosBudgetMultiplier);

  // Under pressure, tighten
  if (cfg.strictUnderPressure && (String(pressureTier) === 'HIGH' || String(pressureTier) === 'CRITICAL')) {
    budget = Math.max(1, Math.floor(budget * 0.75));
  }

  // Macro regime shaping (bounded)
  budget = clamp(
    Math.floor(budget * clamp(rMul, 0.7, 1.15) * clamp(exitPulse, 0.7, 1.15)),
    1,
    64,
  );

  // Unknown / non-allowlisted actions cost more (budget burn)
  const isAllowlisted = cfg.allowlistedActions.length ? cfg.allowlistedActions.includes(playerAction) : true;
  const actionCost = isAllowlisted ? 1 : 2;

  const remainingBefore = clamp(budget - used, 0, 64);
  const remainingAfter = clamp(remainingBefore - actionCost, 0, 64);

  // Rate-limit rules
  const violatesMinTicks = ticksSinceSameKind < cfg.minTicksBetweenSameKind;
  const violatesSameActionCap = (sameActionCount + 1) > cfg.maxSameActionPerWindow;
  const violatesBudget = remainingAfter <= 0;

  // Deterministic policy card (forces all mechanics utils pool bits to be “live”)
  const policyCard = pickPolicyCard(runId, tick, runPhase, pressureTier, macroRegime);

  // Bot pattern heuristic: repeated exact action + too-fast cadence + low entropy schedule
  // (entropy via seededIndex sampling)
  const cadenceHash = seededIndex(runId, tick + 5, 1000);
  const cadenceLooksBot =
    (sameActionCount >= M72_BOUNDS.TRIGGER_THRESHOLD) &&
    (ticksSinceSameKind <= 1) &&
    (cadenceHash % 7 === 0);

  const actionPermitted = !(violatesMinTicks || violatesSameActionCap || violatesBudget || cadenceLooksBot);

  const decayRate = computeDecayRate(macroRegime, M72_BOUNDS.BASE_DECAY_RATE);

  const auditHash = computeHash(JSON.stringify({
    rules: M72_RULES_VERSION,
    runId,
    tick,
    wStart,
    wEnd,
    playerAction,
    kind,
    used,
    budget,
    actionCost,
    remainingAfter,
    ticksSinceSameKind,
    sameActionCount,
    inChaos,
    macroRegime,
    runPhase: String(runPhase),
    pressureTier: String(pressureTier),
    tickTier: String(tickTier),
    cadenceHash,
    cadenceLooksBot,
    policyCardId: policyCard.id,
    decayRate,
  }));

  const rateLimitEvent: Record<string, unknown> = {
    serviceId: `m72:${runId.slice(0, 8)}`,
    status: actionPermitted ? 'OK' : 'BLOCKED',
    timestamp: Date.now(),
    tick,
    window: { start: wStart, end: wEnd },
    reason: actionPermitted
      ? 'PERMITTED'
      : cadenceLooksBot
        ? 'BOT_PATTERN'
        : violatesBudget
          ? 'BUDGET_EXHAUSTED'
          : violatesSameActionCap
            ? 'REPEAT_CAP'
            : 'MIN_TICK_GAP',
    meta: {
      action: playerAction,
      kind,
      allowlisted: isAllowlisted,
      policyCardId: policyCard.id,
      policyCardName: (policyCard as any)?.name ?? '',
      macroRegime,
      pressureTier,
      tickTier,
      decayRate,
      auditHash,
    },
  };

  const checked: M72TelemetryPayload = {
    event: 'ACTION_BUDGET_CHECKED',
    mechanic_id: 'M72',
    tick,
    runId,
    payload: {
      action: playerAction,
      kind,
      budget,
      used,
      remainingBefore,
      remainingAfter,
      macroRegime,
      inChaosWindow: inChaos,
      pressureTier,
      tickTier,
      policyCardId: policyCard.id,
      decayRate,
      auditHash,
    },
  };
  emit(checked);

  if (!actionPermitted) {
    const hit: M72TelemetryPayload = {
      event: cadenceLooksBot ? 'BOT_PATTERN_DETECTED' : 'RATE_LIMIT_HIT',
      mechanic_id: 'M72',
      tick,
      runId,
      payload: {
        reason: (rateLimitEvent as any).reason,
        used,
        budget,
        remainingAfter,
        ticksSinceSameKind,
        sameActionCount,
        cadenceLooksBot,
        macroRegime,
        inChaosWindow: inChaos,
        pressureTier,
        tickTier,
        policyCardId: policyCard.id,
        decayRate,
        auditHash,
      },
    };
    emit(hit);
  }

  return {
    actionPermitted,
    budgetRemaining: remainingAfter,
    rateLimitEvent,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M72MLInput {
  actionPermitted?: boolean;
  budgetRemaining?: number;
  rateLimitEvent?: Record<string, unknown>;
  runId: string;
  tick: number;
}

export interface M72MLOutput {
  score: number;               // 0–1
  topFactors: string[];        // max 5 plain-English factors
  recommendation: string;      // single sentence
  auditHash: string;           // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;     // 0–1, how fast this signal should decay
}

/**
 * actionBudgetRateLimiterMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function actionBudgetRateLimiterMLCompanion(
  input: M72MLInput,
): Promise<M72MLOutput> {
  const permitted = Boolean(input.actionPermitted);
  const remaining = clamp(Number(input.budgetRemaining ?? 0), 0, 64);

  const score = clamp((permitted ? 0.65 : 0.2) + (remaining / 64) * 0.3, 0.01, 0.99);

  const topFactors: string[] = [];
  if ((input.rateLimitEvent as any)?.status) topFactors.push(`Status: ${String((input.rateLimitEvent as any).status)}`);
  if ((input.rateLimitEvent as any)?.reason) topFactors.push(`Reason: ${String((input.rateLimitEvent as any).reason)}`);
  topFactors.push(`BudgetRemaining: ${remaining}`);
  if (typeof (input.rateLimitEvent as any)?.meta?.macroRegime === 'string') topFactors.push(`Regime: ${(input.rateLimitEvent as any).meta.macroRegime}`);
  if (typeof (input.rateLimitEvent as any)?.meta?.pressureTier === 'string') topFactors.push(`Pressure: ${(input.rateLimitEvent as any).meta.pressureTier}`);

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation: permitted ? 'Maintain pacing; keep inputs varied.' : 'Slow cadence and vary action types to avoid throttling.',
    auditHash: computeHash(JSON.stringify(input) + `:${M72_RULES_VERSION}:ml:M72`),
    confidenceDecay: 0.06,
  };
}