// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m111_portfolio_rules_macros_if_then_autopilot_hard_capped.ts
//
// Mechanic : M111 — Portfolio Rules Macros: If-Then Autopilot Hard-Capped
// Family   : portfolio_experimental   Layer: api_endpoint   Priority: 2   Batch: 3
// ML Pair  : m111a
// Deps     : M07, M32
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
  RunPhase, TickTier, MacroRegime, PressureTier, SolvencyStatus,
  Asset, IPAItem, GameCard, GameEvent, ShieldLayer, Debt, Buff,
  Liability, SetBonus, AssetMod, IncomeItem, MacroEvent, ChaosWindow,
  AuctionResult, PurchaseResult, ShieldResult, ExitResult, TickResult,
  DeckComposition, TierProgress, WipeEvent, RegimeShiftEvent,
  PhaseTransitionEvent, TimerExpiredEvent, StreakEvent, FubarEvent,
  LedgerEntry, ProofCard, CompletedRun, SeasonState, RunState,
  MomentEvent, ClipBoundary, MechanicTelemetryPayload, MechanicEmitter,
} from './types';

// ── Import Anchors (keeps every symbol accessible + TS-used) ──────────────────

export const M111_IMPORTED_SYMBOLS = {
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

export type M111_ImportedTypesAnchor = {
  runPhase: RunPhase; tickTier: TickTier; macroRegime: MacroRegime; pressureTier: PressureTier; solvencyStatus: SolvencyStatus;
  asset: Asset; ipaItem: IPAItem; gameCard: GameCard; gameEvent: GameEvent; shieldLayer: ShieldLayer; debt: Debt; buff: Buff;
  liability: Liability; setBonus: SetBonus; assetMod: AssetMod; incomeItem: IncomeItem; macroEvent: MacroEvent; chaosWindow: ChaosWindow;
  auctionResult: AuctionResult; purchaseResult: PurchaseResult; shieldResult: ShieldResult; exitResult: ExitResult; tickResult: TickResult;
  deckComposition: DeckComposition; tierProgress: TierProgress; wipeEvent: WipeEvent; regimeShiftEvent: RegimeShiftEvent;
  phaseTransitionEvent: PhaseTransitionEvent; timerExpiredEvent: TimerExpiredEvent; streakEvent: StreakEvent; fubarEvent: FubarEvent;
  ledgerEntry: LedgerEntry; proofCard: ProofCard; completedRun: CompletedRun; seasonState: SeasonState; runState: RunState;
  momentEvent: MomentEvent; clipBoundary: ClipBoundary; mechanicTelemetryPayload: MechanicTelemetryPayload; mechanicEmitter: MechanicEmitter;
};

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M111Input {
  macroRuleDefinition?: unknown;
  state?: Record<string, unknown>;
  macroCapConfig?: Record<string, unknown>;

  // Optional, backward-compatible additions (keeps existing callers intact)
  runId?: string;
  tick?: number;
}

export interface M111Output {
  macroRuleActive: boolean;
  autoActionExecuted: boolean;
  capEnforced: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M111Event = 'MACRO_RULE_ACTIVATED' | 'AUTO_ACTION_EXECUTED' | 'CAP_ENFORCED';

export interface M111TelemetryPayload extends MechanicTelemetryPayload {
  event: M111Event;
  mechanic_id: 'M111';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M111_BOUNDS = {
  TRIGGER_THRESHOLD:   3,
  MULTIPLIER:          1.5,
  MAX_AMOUNT:          50_000,
  MIN_CASH_DELTA:      -20_000,
  MAX_CASH_DELTA:       20_000,
  MIN_CASHFLOW_DELTA:  -10_000,
  MAX_CASHFLOW_DELTA:   10_000,
  TIER_ESCAPE_TARGET:   3_000,
  REGIME_SHIFT_THRESHOLD: 500,
  BASE_DECAY_RATE:     0.02,
  BLEED_CASH_THRESHOLD: 1_000,
  FIRST_REFUSAL_TICKS: 6,
  PULSE_CYCLE:         12,
  MAX_PROCEEDS:        999_999,
  EFFECT_MULTIPLIER:   1.0,
  MIN_EFFECT:          0,
  MAX_EFFECT:          100_000,
} as const;

// ── Internal helpers (pure, deterministic, strict-safe) ────────────────────

type KV = Record<string, unknown>;

type MacroRule = {
  id: string;
  enabled: boolean;
  if: { path: string; op: 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'INCLUDES'; value: unknown };
  then: { action: 'BUY' | 'SELL' | 'HOLD' | 'SHIELD' | 'REBALANCE'; amount: number; target?: string };
};

type ParsedRuleDef = {
  enabled: boolean;
  rules: MacroRule[];
  mode: 'FIRST_MATCH' | 'BEST_MATCH';
};

type CapConfig = {
  hardCap: number;              // max auto-actions allowed (hard cap)
  perWindowCap: number;         // cap per macro/chaos window
  minTickGap: number;           // throttle between auto-actions
};

type M111Ctx = {
  runId: string;
  seed: string;
  tick: number;
  phase: RunPhase;
  regime: MacroRegime;
  pressure: PressureTier;
  tier: TickTier;
  solvency: SolvencyStatus;
  macroSchedule: import('./types').MacroEvent[];
  chaosWindows: import('./types').ChaosWindow[];
  triggerWindow: 'MACRO' | 'CHAOS' | 'PULSE' | 'NONE';
  weights: { phase: number; regime: number; pressure: number; regimeMultiplier: number; exitPulse: number; decay: number };
  deckSig: string[];
  targetCard: GameCard;
};

function isRecord(v: unknown): v is KV {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function clampTick(t: number): number {
  return clamp(t, 0, RUN_TOTAL_TICKS - 1);
}

function normalizeRunPhase(v: unknown): RunPhase {
  return v === 'EARLY' || v === 'MID' || v === 'LATE' ? v : 'EARLY';
}

function normalizeRegime(v: unknown): MacroRegime {
  return v === 'BULL' || v === 'NEUTRAL' || v === 'BEAR' || v === 'CRISIS' ? v : 'NEUTRAL';
}

function normalizePressure(v: unknown): PressureTier {
  return v === 'LOW' || v === 'MEDIUM' || v === 'HIGH' || v === 'CRITICAL' ? v : 'LOW';
}

function normalizeSolvency(v: unknown): SolvencyStatus {
  return v === 'SOLVENT' || v === 'BLEED' || v === 'WIPED' ? v : 'SOLVENT';
}

function phaseFromTick(tick: number): RunPhase {
  const p = clamp((tick + 1) / RUN_TOTAL_TICKS, 0, 1);
  return p < 0.33 ? 'EARLY' : p < 0.66 ? 'MID' : 'LATE';
}

function tickTierFromPressure(p: PressureTier): TickTier {
  return p === 'CRITICAL' ? 'CRITICAL' : p === 'HIGH' ? 'ELEVATED' : 'STANDARD';
}

function getPath(root: unknown, path: string): unknown {
  if (!isRecord(root)) return undefined;
  const parts = path.split('.').map(s => s.trim()).filter(Boolean);
  let cur: unknown = root;
  for (const k of parts) {
    if (!isRecord(cur)) return undefined;
    cur = cur[k];
  }
  return cur;
}

function safeJsonParse(v: string): unknown {
  try { return JSON.parse(v); } catch { return undefined; }
}

function parseRuleDef(def: unknown): ParsedRuleDef {
  const fallback: ParsedRuleDef = { enabled: false, rules: [], mode: 'FIRST_MATCH' };

  let obj: unknown = def;
  if (typeof def === 'string') obj = safeJsonParse(def);

  if (!isRecord(obj)) return fallback;

  const enabled = obj.enabled !== undefined ? Boolean(obj.enabled) : true;
  const mode: ParsedRuleDef['mode'] = obj.mode === 'BEST_MATCH' ? 'BEST_MATCH' : 'FIRST_MATCH';

  const rawRules = Array.isArray(obj.rules) ? obj.rules : [];
  const rules: MacroRule[] = rawRules
    .map((r, idx): MacroRule | null => {
      if (!isRecord(r)) return null;

      const id = asString(r.id, `rule-${idx}`);
      const ruleEnabled = r.enabled !== undefined ? Boolean(r.enabled) : true;

      const ifObj = isRecord(r.if) ? r.if : {};
      const thenObj = isRecord(r.then) ? r.then : {};

      const path = asString(ifObj.path, '');
      const opRaw = asString(ifObj.op, 'EQ').toUpperCase();
      const op: MacroRule['if']['op'] =
        opRaw === 'NEQ' ? 'NEQ' :
        opRaw === 'GT' ? 'GT' :
        opRaw === 'GTE' ? 'GTE' :
        opRaw === 'LT' ? 'LT' :
        opRaw === 'LTE' ? 'LTE' :
        opRaw === 'INCLUDES' ? 'INCLUDES' :
        'EQ';

      const actionRaw = asString(thenObj.action, 'HOLD').toUpperCase();
      const action: MacroRule['then']['action'] =
        actionRaw === 'BUY' ? 'BUY' :
        actionRaw === 'SELL' ? 'SELL' :
        actionRaw === 'SHIELD' ? 'SHIELD' :
        actionRaw === 'REBALANCE' ? 'REBALANCE' :
        'HOLD';

      const amount = clamp(asNumber(thenObj.amount, 0), 0, M111_BOUNDS.MAX_AMOUNT);
      const target = thenObj.target !== undefined ? asString(thenObj.target, undefined as unknown as string) : undefined;

      if (path.length === 0) return null;

      return {
        id,
        enabled: ruleEnabled,
        if: { path, op, value: ifObj.value },
        then: { action, amount, target },
      };
    })
    .filter((x): x is MacroRule => x !== null);

  return { enabled, rules, mode };
}

function parseCapConfig(cfg: unknown): CapConfig {
  const base: CapConfig = {
    hardCap: 1,
    perWindowCap: 1,
    minTickGap: 6,
  };
  if (!isRecord(cfg)) return base;

  const hardCap = clamp(Math.round(asNumber(cfg.hardCap, base.hardCap)), 0, 9);
  const perWindowCap = clamp(Math.round(asNumber(cfg.perWindowCap, base.perWindowCap)), 0, 9);
  const minTickGap = clamp(Math.round(asNumber(cfg.minTickGap, base.minTickGap)), 0, 60);

  return { hardCap, perWindowCap, minTickGap };
}

function compare(lhs: unknown, op: MacroRule['if']['op'], rhs: unknown): boolean {
  if (op === 'INCLUDES') {
    if (typeof lhs === 'string') return lhs.includes(String(rhs));
    if (Array.isArray(lhs)) return lhs.includes(rhs);
    return false;
  }

  const ln = typeof lhs === 'number' ? lhs : Number.isFinite(Number(lhs)) ? Number(lhs) : undefined;
  const rn = typeof rhs === 'number' ? rhs : Number.isFinite(Number(rhs)) ? Number(rhs) : undefined;

  if (op === 'EQ') return lhs === rhs;
  if (op === 'NEQ') return lhs !== rhs;

  if (ln === undefined || rn === undefined) return false;

  if (op === 'GT') return ln > rn;
  if (op === 'GTE') return ln >= rn;
  if (op === 'LT') return ln < rn;
  if (op === 'LTE') return ln <= rn;

  return false;
}

function deriveCtx(input: M111Input): M111Ctx {
  const state = isRecord(input.state) ? input.state : {};

  const tick =
    clampTick(
      typeof input.tick === 'number'
        ? input.tick
        : asNumber(state.tick ?? state.stateTick ?? state.currentTick, 0),
    );

  const runId =
    (typeof input.runId === 'string' && input.runId.trim().length > 0)
      ? input.runId.trim()
      : asString(state.runId, '');

  const stableRunId =
    runId.length > 0
      ? runId
      : computeHash(`M111:run:${tick}:${JSON.stringify(input.macroRuleDefinition ?? null)}:${JSON.stringify(input.macroCapConfig ?? null)}:${JSON.stringify(state)}`);

  const seed = computeHash(`M111:${stableRunId}:${tick}:${JSON.stringify(input.macroRuleDefinition ?? null)}:${JSON.stringify(input.macroCapConfig ?? null)}`);

  const macroSchedule = buildMacroSchedule(`${seed}:macro`, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(`${seed}:chaos`, CHAOS_WINDOWS_PER_RUN);

  // regime: state override else follow macro schedule up to tick
  let regime: MacroRegime = normalizeRegime(state.macroRegime ?? state.stateMacroRegime ?? state.regime);
  for (const ev of macroSchedule) {
    if (ev.tick <= tick && (ev as { regimeChange?: unknown }).regimeChange) {
      regime = normalizeRegime((ev as { regimeChange?: unknown }).regimeChange);
    }
  }

  const phase: RunPhase = normalizeRunPhase(state.runPhase ?? state.stateRunPhase ?? phaseFromTick(tick));

  const inChaos = chaosWindows.some(w => tick >= w.startTick && tick <= w.endTick);
  const pressure: PressureTier =
    normalizePressure(
      state.pressureTier ?? state.statePressureTier ??
      (inChaos ? 'CRITICAL' : phase === 'EARLY' ? 'LOW' : phase === 'MID' ? 'MEDIUM' : 'HIGH'),
    );

  const tier: TickTier = tickTierFromPressure(pressure);

  const solvency: SolvencyStatus = normalizeSolvency(state.solvencyStatus ?? state.stateSolvencyStatus ?? 'SOLVENT');

  const isMacroTick = macroSchedule.some(m => m.tick === tick);
  const isPulse = tick % M111_BOUNDS.PULSE_CYCLE === 0;

  const triggerWindow: M111Ctx['triggerWindow'] =
    isMacroTick ? 'MACRO' :
    inChaos ? 'CHAOS' :
    isPulse ? 'PULSE' :
    'NONE';

  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;
  const pressureW = PRESSURE_WEIGHTS[pressure] ?? 1.0;

  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const decay = computeDecayRate(regime, M111_BOUNDS.BASE_DECAY_RATE);

  const deckSig = seededShuffle(DEFAULT_CARD_IDS, `${seed}:deckSig`).slice(0, Math.min(3, DEFAULT_CARD_IDS.length));

  // deterministic “target card” selection (used for action payload)
  const pool = buildWeightedPool(`${seed}:weightedPool`, phaseW * pressureW, regimeW * regimeMultiplier);
  const targetCard =
    (pool[seededIndex(`${seed}:pick`, tick, Math.max(1, pool.length))] as GameCard | undefined) ??
    OPPORTUNITY_POOL[seededIndex(`${seed}:fallbackOpp`, tick + 7, OPPORTUNITY_POOL.length)] ??
    DEFAULT_CARD;

  return {
    runId: stableRunId,
    seed,
    tick,
    phase,
    regime,
    pressure,
    tier,
    solvency,
    macroSchedule,
    chaosWindows,
    triggerWindow,
    weights: { phase: phaseW, regime: regimeW, pressure: pressureW, regimeMultiplier, exitPulse, decay },
    deckSig,
    targetCard,
  };
}

function evaluateRules(ruleDef: ParsedRuleDef, state: KV, ctx: M111Ctx): { matched: boolean; rule?: MacroRule; score: number } {
  const rules = ruleDef.rules.filter(r => r.enabled);

  if (rules.length === 0) return { matched: false, score: 0 };

  // deterministic order for fairness
  const ordered = seededShuffle(rules, `${ctx.seed}:ruleOrder`);

  let best: { matched: boolean; rule?: MacroRule; score: number } = { matched: false, score: 0 };

  for (let i = 0; i < ordered.length; i++) {
    const r = ordered[i];
    const lhs = getPath(state, r.if.path);

    const ok = compare(lhs, r.if.op, r.if.value);

    if (!ok) continue;

    // score: regime/pressure/phase weighting + rule position bias (deterministic)
    const posBias = (ordered.length - i) / ordered.length;
    const score =
      clamp(
        0.10 +
          0.25 * posBias +
          0.20 * clamp(ctx.weights.phase, 0, 2) +
          0.20 * clamp(ctx.weights.pressure, 0, 2) +
          0.25 * clamp(ctx.weights.regime, 0, 2),
        0,
        1,
      );

    if (ruleDef.mode === 'FIRST_MATCH') return { matched: true, rule: r, score };

    if (!best.matched || score > best.score) best = { matched: true, rule: r, score };
  }

  return best;
}

function defaultFallbackRule(ctx: M111Ctx, state: KV): { matched: boolean; rule: MacroRule; score: number } {
  const cash =
    asNumber(state.cash ?? state.cashOnHand ?? state.cashBalance ?? state.money, 0);

  const matched =
    (ctx.regime === 'BEAR' || ctx.regime === 'CRISIS') &&
    (cash < M111_BOUNDS.BLEED_CASH_THRESHOLD) &&
    (ctx.triggerWindow !== 'NONE');

  const rule: MacroRule = {
    id: 'fallback:autopilot_defense',
    enabled: true,
    if: { path: 'cash', op: 'LT', value: M111_BOUNDS.BLEED_CASH_THRESHOLD },
    then: { action: 'SHIELD', amount: clamp(Math.round(M111_BOUNDS.BASE_DECAY_RATE * 100_000), 0, M111_BOUNDS.MAX_AMOUNT) },
  };

  const score =
    matched
      ? clamp(0.35 + 0.25 * ctx.weights.pressure + 0.20 * (1 - ctx.weights.decay) + 0.20 * (1 - ctx.weights.exitPulse), 0, 1)
      : 0;

  return { matched, rule, score };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * portfolioRulesMacroEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function portfolioRulesMacroEngine(input: M111Input, emit: MechanicEmitter): M111Output {
  const ctx = deriveCtx(input);
  const state = isRecord(input.state) ? input.state : {};

  const ruleDef = parseRuleDef(input.macroRuleDefinition);
  const capCfg = parseCapConfig(input.macroCapConfig);

  const actionsExecuted =
    clamp(Math.round(asNumber(state.macroAutoActionsExecuted ?? state.autoActionsExecuted ?? state.autopilotActions ?? 0, 0)), 0, 999);

  const lastAutoTick =
    clampTick(Math.round(asNumber(state.lastMacroAutoTick ?? state.lastAutopilotTick ?? -999, -999)));

  const gapOk = (ctx.tick - lastAutoTick) >= capCfg.minTickGap;

  const inWindow = ctx.triggerWindow !== 'NONE';

  const macroRuleActive = ruleDef.enabled && ctx.solvency !== 'WIPED';

  const evalResult =
    macroRuleActive
      ? evaluateRules(ruleDef, state, ctx)
      : { matched: false, score: 0 as number };

  const fallback = macroRuleActive && !evalResult.matched ? defaultFallbackRule(ctx, state) : null;

  const matched = macroRuleActive && inWindow && (evalResult.matched || (fallback?.matched ?? false));
  const pickedRule = evalResult.matched ? evalResult.rule : (fallback?.matched ? fallback.rule : undefined);
  const ruleScore = evalResult.matched ? evalResult.score : (fallback?.matched ? fallback.score : 0);

  // hard cap enforcement
  const capReached = actionsExecuted >= capCfg.hardCap;
  const capEnforced = macroRuleActive && capCfg.hardCap >= 0 && capReached;

  // window cap (optional, deterministic)
  const perWindowExecuted =
    clamp(Math.round(asNumber(state.macroAutoActionsExecutedInWindow ?? state.autoActionsInWindow ?? 0, 0)), 0, 999);
  const windowCapReached = perWindowExecuted >= capCfg.perWindowCap;

  // deterministic action magnitude (bounded)
  const magnitudeBase =
    M111_BOUNDS.MULTIPLIER *
    (ctx.weights.phase * ctx.weights.pressure) *
    (ctx.weights.regime * ctx.weights.regimeMultiplier) *
    (1 - ctx.weights.decay) *
    (ctx.weights.exitPulse);

  const magnitude =
    clamp(
      Math.round(10_000 * magnitudeBase * M111_BOUNDS.EFFECT_MULTIPLIER),
      M111_BOUNDS.MIN_EFFECT,
      M111_BOUNDS.MAX_EFFECT,
    );

  // allow execution only if: matched + not capped + window ok + tick-gap ok
  const autoActionExecuted =
    matched &&
    !capReached &&
    !windowCapReached &&
    gapOk;

  const audit = computeHash(
    JSON.stringify({
      mid: 'M111',
      runId: ctx.runId,
      tick: ctx.tick,
      phase: ctx.phase,
      regime: ctx.regime,
      pressure: ctx.pressure,
      tier: ctx.tier,
      triggerWindow: ctx.triggerWindow,
      hardCap: capCfg.hardCap,
      perWindowCap: capCfg.perWindowCap,
      actionsExecuted,
      perWindowExecuted,
      gapOk,
      matched,
      autoActionExecuted,
      ruleId: pickedRule?.id ?? null,
      ruleScore,
      magnitude,
      targetCardId: ctx.targetCard.id,
      deckSig: ctx.deckSig,
    }),
  );

  if (macroRuleActive) {
    emit({
      event: 'MACRO_RULE_ACTIVATED',
      mechanic_id: 'M111',
      tick: ctx.tick,
      runId: ctx.runId,
      payload: {
        audit,
        triggerWindow: ctx.triggerWindow,
        phase: ctx.phase,
        regime: ctx.regime,
        pressure: ctx.pressure,
        tier: ctx.tier,
        solvency: ctx.solvency,
        weights: ctx.weights,
        rulesEnabled: ruleDef.enabled,
        rulesCount: ruleDef.rules.length,
        mode: ruleDef.mode,
        hardCap: capCfg.hardCap,
        perWindowCap: capCfg.perWindowCap,
        minTickGap: capCfg.minTickGap,
        actionsExecuted,
        perWindowExecuted,
        gapOk,
        inWindow,
        matched,
        pickedRuleId: pickedRule?.id ?? null,
        ruleScore,
        magnitude,
        targetCardId: ctx.targetCard.id,
        deckSig: ctx.deckSig,
      },
    });
  }

  if (autoActionExecuted && pickedRule) {
    emit({
      event: 'AUTO_ACTION_EXECUTED',
      mechanic_id: 'M111',
      tick: ctx.tick,
      runId: ctx.runId,
      payload: {
        audit,
        action: pickedRule.then.action,
        amount: clamp(Math.round((pickedRule.then.amount || magnitude) * (ruleScore || 1)), 0, M111_BOUNDS.MAX_AMOUNT),
        magnitude,
        ruleId: pickedRule.id,
        ruleScore,
        target: pickedRule.then.target ?? ctx.targetCard.id,
        targetCardId: ctx.targetCard.id,
        triggerWindow: ctx.triggerWindow,
        caps: { hardCap: capCfg.hardCap, perWindowCap: capCfg.perWindowCap, minTickGap: capCfg.minTickGap },
        stateHints: {
          shouldPersist: {
            lastMacroAutoTick: ctx.tick,
            macroAutoActionsExecuted: actionsExecuted + 1,
            macroAutoActionsExecutedInWindow: inWindow ? (perWindowExecuted + 1) : perWindowExecuted,
          },
        },
      },
    });
  }

  if (capEnforced || windowCapReached || (matched && !gapOk)) {
    emit({
      event: 'CAP_ENFORCED',
      mechanic_id: 'M111',
      tick: ctx.tick,
      runId: ctx.runId,
      payload: {
        audit,
        reason: capEnforced ? 'HARD_CAP' : windowCapReached ? 'WINDOW_CAP' : 'MIN_TICK_GAP',
        hardCap: capCfg.hardCap,
        perWindowCap: capCfg.perWindowCap,
        minTickGap: capCfg.minTickGap,
        actionsExecuted,
        perWindowExecuted,
        lastAutoTick,
        gapOk,
        matched,
        pickedRuleId: pickedRule?.id ?? null,
        triggerWindow: ctx.triggerWindow,
      },
    });
  }

  return {
    macroRuleActive,
    autoActionExecuted,
    capEnforced: capEnforced || windowCapReached || (matched && !gapOk),
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M111MLInput {
  macroRuleActive?: boolean;
  autoActionExecuted?: boolean;
  capEnforced?: boolean;
  runId: string;
  tick: number;
}

export interface M111MLOutput {
  score: number;          // 0–1
  topFactors: string[];   // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string;      // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;// 0–1, how fast this signal should decay
}

/**
 * portfolioRulesMacroEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function portfolioRulesMacroEngineMLCompanion(input: M111MLInput): Promise<M111MLOutput> {
  const score = Math.min(0.99, Math.max(0.01, Object.keys(input).length * 0.05));

  const topFactors: string[] = [];
  if (input.macroRuleActive) topFactors.push('Autopilot enabled');
  if (input.autoActionExecuted) topFactors.push('Auto-action executed');
  if (input.capEnforced) topFactors.push('Cap enforced');
  topFactors.push('Advisory only');

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation: input.capEnforced ? 'Adjust macro caps or tighten rule triggers.' : 'Keep rules tight; verify outcomes in ledger.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M111'),
    confidenceDecay: 0.05,
  };
}