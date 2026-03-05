// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m142_house_rules_custom_lobbies_with_published_constraints.ts
//
// Mechanic : M142 — House Rules: Custom Lobbies with Published Constraints
// Family   : ops   Layer: api_endpoint   Priority: 2   Batch: 3
// ML Pair  : m142a
// Deps     : M19, M136
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
// Import Anchors (keep generator-wide imports accessible + “used”)
// ─────────────────────────────────────────────────────────────────────────────

export const M142_IMPORTED_SYMBOLS = {
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

export type M142_ImportedTypesAnchor = {
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

// ─────────────────────────────────────────────────────────────────────────────
// Local House Rules Contracts (api_endpoint layer; safe structural typing)
// ─────────────────────────────────────────────────────────────────────────────

export type ConstraintSeverity = 'INFO' | 'WARN' | 'BLOCK';
export type ConstraintKind = 'BOOL' | 'INT' | 'FLOAT' | 'ENUM' | 'STRING' | 'JSON';

export interface PublishedConstraint {
  key: string;
  kind: ConstraintKind;
  value: unknown;
  label: string;
  description: string;
  severity: ConstraintSeverity;
  enforced: boolean;

  valid: boolean;
  reason?: string;

  hash: string;
}

export interface HouseRuleConfig {
  enabled?: boolean;

  /** Optional human-readable rules name displayed in lobby UI. */
  name?: string;

  /** Optional rules version (pairs with M136 signature in UI). */
  rulesVersion?: string;

  /** Optional signature hash from M136 or server ruleset registry. */
  rulesetSignatureHash?: string;

  /** Hard caps / constraints */
  maxPlayers?: number;              // default 4
  minPlayers?: number;              // default 1
  allowSpectators?: boolean;         // default true
  allowReplays?: boolean;            // default true
  allowOfflineQueue?: boolean;        // default true (pairs with M139)
  allowAsyncVoting?: boolean;         // default true (pairs with M141)

  /** Timer knobs */
  runTicksOverride?: number;          // if set, clamp to [24..RUN_TOTAL_TICKS]
  timerMultiplier?: number;           // default 1.0, clamp [0.5..2.0]

  /** Economy knobs (must remain non-pay-to-win) */
  opportunityPoolMultiplier?: number; // default 1.0, clamp [0.75..1.25]
  forbidCardTypes?: string[];         // e.g. ['OPPORTUNITY']

  /** Constraint publishing controls */
  publishAll?: boolean;               // if false, publish only enforced + warnings
  constraints?: Array<{
    key: string;
    kind?: ConstraintKind;
    value: unknown;
    label?: string;
    description?: string;
    severity?: ConstraintSeverity;
    enforced?: boolean;
  }>;

  /** Arbitrary metadata for audits (never trusted for auth). */
  meta?: Record<string, unknown>;
}

export interface ConstraintValidationContext {
  lobbyId: string;
  runId: string;
  tick: number;

  runPhase: RunPhase;
  macroRegime: MacroRegime;
  pressureTier: PressureTier;
  tickTier: TickTier;

  inChaos: boolean;

  // Deterministic anchors for validator logic (if used)
  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];
  poolPick: GameCard;
  oppPick: GameCard;
  deckSig: string[];
}

export interface ConstraintValidationResult {
  ok: boolean;
  reason?: string;
  perConstraint?: Record<string, { ok: boolean; reason?: string }>;
}

export type ConstraintValidator =
  | ((cfg: HouseRuleConfig, ctx: ConstraintValidationContext, published: PublishedConstraint[]) => ConstraintValidationResult)
  | { validate: (cfg: HouseRuleConfig, ctx: ConstraintValidationContext, published: PublishedConstraint[]) => ConstraintValidationResult };

// ─────────────────────────────────────────────────────────────────────────────
// Input / Output contracts
// ─────────────────────────────────────────────────────────────────────────────

export interface M142Input {
  houseRuleConfig?: HouseRuleConfig;
  constraintValidator?: ConstraintValidator;
  lobbyId?: string;

  // Optional snapshot fields (many callers pass these; safe structural typing)
  runId?: string;
  seed?: string;
  stateTick?: number;
  stateRunPhase?: RunPhase;
  stateMacroRegime?: MacroRegime;
  statePressureTier?: PressureTier;
  stateSolvencyStatus?: SolvencyStatus;
}

export interface M142Output {
  houseRulesActive: boolean;
  publishedConstraints: PublishedConstraint[];
  lobbySignature: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Telemetry
// ─────────────────────────────────────────────────────────────────────────────

export type M142Event = 'HOUSE_RULES_PUBLISHED' | 'CONSTRAINT_VALIDATED' | 'LOBBY_SIGNED';

export interface M142TelemetryPayload extends MechanicTelemetryPayload {
  event: M142Event;
  mechanic_id: 'M142';
}

// ─────────────────────────────────────────────────────────────────────────────
// Design bounds (never mutate at runtime)
// ─────────────────────────────────────────────────────────────────────────────

export const M142_BOUNDS = {
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
// Internal helpers (pure, deterministic, no throws)
// ─────────────────────────────────────────────────────────────────────────────

function m142NormalizeRegime(r: unknown): MacroRegime {
  return r === 'BULL' || r === 'NEUTRAL' || r === 'BEAR' || r === 'CRISIS' ? r : 'NEUTRAL';
}

function m142NormalizePhase(p: unknown): RunPhase {
  return p === 'EARLY' || p === 'MID' || p === 'LATE' ? p : 'MID';
}

function m142NormalizePressure(p: unknown): PressureTier {
  return p === 'LOW' || p === 'MEDIUM' || p === 'HIGH' || p === 'CRITICAL' ? p : 'MEDIUM';
}

function m142DerivePhaseFromTick(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = Math.max(1, Math.floor(RUN_TOTAL_TICKS / 3));
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m142RegimeAtTick(tick: number, schedule: MacroEvent[], fallback: MacroRegime): MacroRegime {
  if (!schedule || schedule.length === 0) return fallback;
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const sorted = [...schedule].sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));
  let regime: MacroRegime = fallback;
  for (const ev of sorted) {
    const et = typeof ev.tick === 'number' ? ev.tick : 0;
    if (et > t) break;
    if (ev.regimeChange) regime = m142NormalizeRegime(ev.regimeChange);
  }
  return regime;
}

function m142InChaos(tick: number, windows: ChaosWindow[]): boolean {
  if (!windows || windows.length === 0) return false;
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  for (const w of windows) {
    if (t >= w.startTick && t <= w.endTick) return true;
  }
  return false;
}

function m142DerivePressureTier(phase: RunPhase, inChaos: boolean, regime: MacroRegime): PressureTier {
  let score = 0;
  if (phase === 'MID') score += 1;
  if (phase === 'LATE') score += 2;
  if (inChaos) score += 2;
  if (regime === 'BEAR') score += 1;
  if (regime === 'CRISIS') score += 2;

  if (score >= 5) return 'CRITICAL';
  if (score >= 3) return 'HIGH';
  if (score >= 1) return 'MEDIUM';
  return 'LOW';
}

function m142DeriveTickTier(pressure: PressureTier, inChaos: boolean): TickTier {
  if (pressure === 'CRITICAL' || inChaos) return 'CRITICAL';
  if (pressure === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function m142DedupStrings(xs: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    const s = String(x ?? '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function m142KindFromValue(v: unknown): ConstraintKind {
  if (typeof v === 'boolean') return 'BOOL';
  if (typeof v === 'number') return Number.isInteger(v) ? 'INT' : 'FLOAT';
  if (typeof v === 'string') return 'STRING';
  if (v == null) return 'JSON';
  if (Array.isArray(v)) return 'JSON';
  if (typeof v === 'object') return 'JSON';
  return 'JSON';
}

function m142Severity(s: unknown, fallback: ConstraintSeverity): ConstraintSeverity {
  return s === 'INFO' || s === 'WARN' || s === 'BLOCK' ? s : fallback;
}

function m142Bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function m142Num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function m142String(v: unknown, fallback: string): string {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : fallback;
}

function m142BuildPublishedConstraints(cfg: HouseRuleConfig, ctx: ConstraintValidationContext): PublishedConstraint[] {
  const enabled = m142Bool(cfg.enabled, true);

  const minPlayers = clamp(m142Num(cfg.minPlayers, 1), 1, 64);
  const maxPlayers = clamp(m142Num(cfg.maxPlayers, 4), minPlayers, 64);

  const allowSpectators = m142Bool(cfg.allowSpectators, true);
  const allowReplays = m142Bool(cfg.allowReplays, true);
  const allowOfflineQueue = m142Bool(cfg.allowOfflineQueue, true);
  const allowAsyncVoting = m142Bool(cfg.allowAsyncVoting, true);

  const timerMultiplier = clamp(m142Num(cfg.timerMultiplier, 1.0), 0.5, 2.0);
  const runTicksOverrideRaw = m142Num(cfg.runTicksOverride, 0);
  const runTicksOverride =
    runTicksOverrideRaw > 0 ? clamp(Math.floor(runTicksOverrideRaw), 24, RUN_TOTAL_TICKS) : null;

  const oppPoolMult = clamp(m142Num(cfg.opportunityPoolMultiplier, 1.0), 0.75, 1.25);
  const forbidCardTypes = m142DedupStrings(cfg.forbidCardTypes ?? []);

  const base: Array<Omit<PublishedConstraint, 'valid' | 'hash'>> = [
    {
      key: 'house_rules.enabled',
      kind: 'BOOL',
      value: enabled,
      label: 'House Rules Enabled',
      description: 'Whether custom lobby house rules are enabled for this lobby.',
      severity: 'BLOCK',
      enforced: true,
      reason: undefined,
    },
    {
      key: 'lobby.players.min',
      kind: 'INT',
      value: minPlayers,
      label: 'Minimum Players',
      description: 'Minimum number of players allowed to start a lobby run.',
      severity: 'BLOCK',
      enforced: true,
      reason: undefined,
    },
    {
      key: 'lobby.players.max',
      kind: 'INT',
      value: maxPlayers,
      label: 'Maximum Players',
      description: 'Maximum number of players allowed in this lobby.',
      severity: 'BLOCK',
      enforced: true,
      reason: undefined,
    },
    {
      key: 'lobby.spectators.allowed',
      kind: 'BOOL',
      value: allowSpectators,
      label: 'Spectators Allowed',
      description: 'Whether spectators may observe the lobby.',
      severity: 'WARN',
      enforced: true,
      reason: undefined,
    },
    {
      key: 'lobby.replays.allowed',
      kind: 'BOOL',
      value: allowReplays,
      label: 'Replays Allowed',
      description: 'Whether replays are available for this lobby.',
      severity: 'INFO',
      enforced: true,
      reason: undefined,
    },
    {
      key: 'lobby.offline_queue.allowed',
      kind: 'BOOL',
      value: allowOfflineQueue,
      label: 'Offline Queue Allowed',
      description: 'Whether runs may be queued offline and verified later (pairs with M139).',
      severity: 'WARN',
      enforced: true,
      reason: undefined,
    },
    {
      key: 'lobby.async_vote.allowed',
      kind: 'BOOL',
      value: allowAsyncVoting,
      label: 'Async Voting Allowed',
      description: 'Whether friends may vote asynchronously under timer bounds (pairs with M141).',
      severity: 'WARN',
      enforced: true,
      reason: undefined,
    },
    {
      key: 'run.timer.multiplier',
      kind: 'FLOAT',
      value: timerMultiplier,
      label: 'Timer Multiplier',
      description: 'Multiplies tick pacing/timer policy; always clamped and timer-safe.',
      severity: 'BLOCK',
      enforced: true,
      reason: undefined,
    },
    {
      key: 'run.ticks.override',
      kind: 'INT',
      value: runTicksOverride,
      label: 'Run Ticks Override',
      description: `Optional run length override, clamped to [24..${RUN_TOTAL_TICKS}] ticks.`,
      severity: 'WARN',
      enforced: true,
      reason: undefined,
    },
    {
      key: 'econ.opportunity_pool.multiplier',
      kind: 'FLOAT',
      value: oppPoolMult,
      label: 'Opportunity Pool Multiplier',
      description: 'Scales the opportunity pool selection pressure; bounded to prevent pay-to-win.',
      severity: 'BLOCK',
      enforced: true,
      reason: undefined,
    },
    {
      key: 'econ.forbid.card_types',
      kind: 'JSON',
      value: forbidCardTypes,
      label: 'Forbidden Card Types',
      description: 'Card types forbidden for this lobby (enforced at draw/selection points).',
      severity: 'WARN',
      enforced: true,
      reason: undefined,
    },
    {
      key: 'context.macro_regime',
      kind: 'ENUM',
      value: ctx.macroRegime,
      label: 'Macro Regime',
      description: 'Deterministic macro regime context used for signature + auditing.',
      severity: 'INFO',
      enforced: false,
      reason: undefined,
    },
    {
      key: 'context.run_phase',
      kind: 'ENUM',
      value: ctx.runPhase,
      label: 'Run Phase',
      description: 'Deterministic run phase context used for signature + auditing.',
      severity: 'INFO',
      enforced: false,
      reason: undefined,
    },
    {
      key: 'context.pressure_tier',
      kind: 'ENUM',
      value: ctx.pressureTier,
      label: 'Pressure Tier',
      description: 'Derived pressure tier used for signature + auditing.',
      severity: 'INFO',
      enforced: false,
      reason: undefined,
    },
    {
      key: 'context.tick_tier',
      kind: 'ENUM',
      value: ctx.tickTier,
      label: 'Tick Tier',
      description: 'Derived tick tier used for signature + auditing.',
      severity: 'INFO',
      enforced: false,
      reason: undefined,
    },
    {
      key: 'context.econ.pool_pick',
      kind: 'STRING',
      value: ctx.poolPick.id,
      label: 'Pool Pick (Anchor)',
      description: 'Deterministic pool pick anchor used for signature hardening.',
      severity: 'INFO',
      enforced: false,
      reason: undefined,
    },
    {
      key: 'context.econ.opp_pick',
      kind: 'STRING',
      value: ctx.oppPick.id,
      label: 'Opportunity Pick (Anchor)',
      description: 'Deterministic opportunity pick anchor used for signature hardening.',
      severity: 'INFO',
      enforced: false,
      reason: undefined,
    },
    {
      key: 'context.deck.sig',
      kind: 'JSON',
      value: ctx.deckSig,
      label: 'Deck Signature (Anchor)',
      description: 'Deterministic deck signature used for signature hardening.',
      severity: 'INFO',
      enforced: false,
      reason: undefined,
    },
  ];

  // Merge user-provided custom constraints (if any)
  const custom = Array.isArray(cfg.constraints) ? cfg.constraints : [];
  for (const c of custom) {
    if (!c || typeof c !== 'object') continue;
    const key = String((c as any).key ?? '').trim();
    if (!key) continue;

    const value = (c as any).value;
    base.push({
      key,
      kind: (c as any).kind ?? m142KindFromValue(value),
      value,
      label: String((c as any).label ?? key),
      description: String((c as any).description ?? 'Custom house rule constraint.'),
      severity: m142Severity((c as any).severity, 'WARN'),
      enforced: typeof (c as any).enforced === 'boolean' ? Boolean((c as any).enforced) : true,
      reason: undefined,
    });
  }

  // Deterministic ordering: sort by key, then stable seed shuffle within same prefix
  const sorted = base.slice().sort((a, b) => a.key.localeCompare(b.key));
  const shuffledKeys = seededShuffle(sorted.map(x => x.key), computeHash(`${ctx.lobbyId}:${ctx.runId}:M142:keys`));
  const order = new Map<string, number>();
  for (let i = 0; i < shuffledKeys.length; i++) order.set(shuffledKeys[i], i);

  const ordered = sorted.slice().sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));

  const published: PublishedConstraint[] = [];
  for (const c of ordered) {
    const kind = (c.kind === 'BOOL' || c.kind === 'INT' || c.kind === 'FLOAT' || c.kind === 'ENUM' || c.kind === 'STRING' || c.kind === 'JSON')
      ? c.kind
      : m142KindFromValue(c.value);

    const hash = computeHash(JSON.stringify({
      k: c.key,
      kind,
      v: c.value,
      s: c.severity,
      e: c.enforced ? 1 : 0,
      lobbyId: ctx.lobbyId,
    }));

    published.push({
      key: c.key,
      kind,
      value: c.value,
      label: c.label,
      description: c.description,
      severity: c.severity,
      enforced: c.enforced,
      valid: true,
      reason: undefined,
      hash,
    });
  }

  return published;
}

function m142InvokeValidator(
  v: ConstraintValidator | undefined,
  cfg: HouseRuleConfig,
  ctx: ConstraintValidationContext,
  published: PublishedConstraint[],
): ConstraintValidationResult {
  if (!v) return { ok: true };

  try {
    if (typeof v === 'function') return v(cfg, ctx, published);
    if (typeof (v as any).validate === 'function') return (v as any).validate(cfg, ctx, published);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: `validator_exception:${String((e as any)?.message ?? e)}` };
  }
}

function m142ApplyValidationToPublished(
  published: PublishedConstraint[],
  res: ConstraintValidationResult,
): PublishedConstraint[] {
  const per = res.perConstraint ?? {};
  return published.map((c) => {
    const hit = per[c.key];
    if (!hit) return c;
    return { ...c, valid: Boolean(hit.ok), reason: hit.reason ?? (hit.ok ? undefined : 'invalid') };
  });
}

function m142FilterForPublishing(cfg: HouseRuleConfig, published: PublishedConstraint[]): PublishedConstraint[] {
  const publishAll = m142Bool(cfg.publishAll, true);
  if (publishAll) return published;

  // publish only enforced + WARN/BLOCK + invalids
  return published.filter((c) => c.enforced || c.severity !== 'INFO' || !c.valid);
}

// ─────────────────────────────────────────────────────────────────────────────
// Exec hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * houseRulesCustomLobby
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 */
export function houseRulesCustomLobby(
  input: M142Input,
  emit: MechanicEmitter,
): M142Output {
  const tick = clamp(Number(input.stateTick ?? 0), 0, RUN_TOTAL_TICKS - 1);

  const lobbyId = String(input.lobbyId ?? '').trim() || `lobby_${computeHash(JSON.stringify(input)).slice(0, 8)}`;

  const cfg: HouseRuleConfig = input.houseRuleConfig ?? {};
  const enabled = m142Bool(cfg.enabled, true);

  const runId =
    (typeof input.runId === 'string' && input.runId.trim())
      ? input.runId.trim()
      : computeHash(JSON.stringify({ mid: 'M142', lobbyId, tick, enabled }));

  const seed =
    (typeof input.seed === 'string' && input.seed.trim())
      ? input.seed.trim()
      : computeHash(`${runId}:${lobbyId}:M142`);

  // deterministic macro/chaos fabric (and ensures imports are live)
  const macroSchedule = buildMacroSchedule(`${seed}:m142:macro`, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(`${seed}:m142:chaos`, CHAOS_WINDOWS_PER_RUN);

  const phase: RunPhase = m142NormalizePhase(input.stateRunPhase ?? m142DerivePhaseFromTick(tick));
  const regimeFallback: MacroRegime = m142NormalizeRegime(input.stateMacroRegime ?? 'NEUTRAL');
  const macroRegime: MacroRegime = m142RegimeAtTick(tick, macroSchedule, regimeFallback);

  const inChaos = m142InChaos(tick, chaosWindows);

  const derivedPressure: PressureTier = m142DerivePressureTier(phase, inChaos, macroRegime);
  const pressureTier: PressureTier = m142NormalizePressure(input.statePressureTier ?? derivedPressure);
  const tickTier: TickTier = m142DeriveTickTier(pressureTier, inChaos);

  // weights + multipliers (must be used)
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const decay = computeDecayRate(macroRegime, M142_BOUNDS.BASE_DECAY_RATE);

  // economy anchors (must touch pool + defaults)
  const oppPoolMult = clamp(m142Num(cfg.opportunityPoolMultiplier, 1.0), 0.75, 1.25);
  const weightedPool = buildWeightedPool(`${seed}:m142:pool`, pressureW * phaseW * oppPoolMult, regimeW * regimeMult);

  const poolPick: GameCard =
    (weightedPool[seededIndex(`${seed}:m142:pick`, tick, Math.max(1, weightedPool.length))] as GameCard | undefined) ?? DEFAULT_CARD;

  const oppPick: GameCard =
    OPPORTUNITY_POOL[seededIndex(`${seed}:m142:opp`, tick + 17, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  const deckOrder = seededShuffle(DEFAULT_CARD_IDS, `${seed}:m142:deck`);
  const deckSig = deckOrder.slice(0, Math.min(7, deckOrder.length));

  const ctx: ConstraintValidationContext = {
    lobbyId,
    runId,
    tick,

    runPhase: phase,
    macroRegime,
    pressureTier,
    tickTier,

    inChaos,

    macroSchedule,
    chaosWindows,
    poolPick,
    oppPick,
    deckSig,
  };

  // build + validate constraints
  const publishedAll = m142BuildPublishedConstraints(cfg, ctx);

  // base validator (always enforces non-pay-to-win + bounds)
  const baseValidation: ConstraintValidationResult = {
    ok: true,
    perConstraint: {},
  };

  const minPlayers = clamp(m142Num(cfg.minPlayers, 1), 1, 64);
  const maxPlayers = clamp(m142Num(cfg.maxPlayers, 4), minPlayers, 64);
  if (maxPlayers < minPlayers) {
    baseValidation.ok = false;
    baseValidation.reason = 'maxPlayers_lt_minPlayers';
    baseValidation.perConstraint!['lobby.players.max'] = { ok: false, reason: 'maxPlayers must be >= minPlayers' };
  }

  const timerMult = clamp(m142Num(cfg.timerMultiplier, 1.0), 0.5, 2.0);
  if (timerMult < 0.5 || timerMult > 2.0) {
    baseValidation.ok = false;
    baseValidation.reason = baseValidation.reason ?? 'timerMultiplier_out_of_bounds';
    baseValidation.perConstraint!['run.timer.multiplier'] = { ok: false, reason: 'timerMultiplier must be within [0.5..2.0]' };
  }

  const poolMult = clamp(m142Num(cfg.opportunityPoolMultiplier, 1.0), 0.75, 1.25);
  if (poolMult < 0.75 || poolMult > 1.25) {
    baseValidation.ok = false;
    baseValidation.reason = baseValidation.reason ?? 'opportunityPoolMultiplier_out_of_bounds';
    baseValidation.perConstraint!['econ.opportunity_pool.multiplier'] = { ok: false, reason: 'opportunityPoolMultiplier must be within [0.75..1.25]' };
  }

  // optional external validator
  const extValidation = m142InvokeValidator(input.constraintValidator, cfg, ctx, publishedAll);

  const mergedValidation: ConstraintValidationResult = {
    ok: baseValidation.ok && extValidation.ok,
    reason: baseValidation.reason ?? extValidation.reason,
    perConstraint: { ...(baseValidation.perConstraint ?? {}), ...(extValidation.perConstraint ?? {}) },
  };

  const publishedValidated = m142ApplyValidationToPublished(publishedAll, mergedValidation);
  const publishedConstraints = m142FilterForPublishing(cfg, publishedValidated);

  const rulesVersion = m142String(cfg.rulesVersion, '');
  const rulesetSignatureHash = m142String(cfg.rulesetSignatureHash, '');

  const lobbySignature = computeHash(JSON.stringify({
    mid: 'M142',
    lobbyId,
    runId,
    tick,
    enabled,
    rulesVersion,
    rulesetSignatureHash,
    macroRegime,
    phase,
    pressureTier,
    tickTier,
    inChaos,
    weights: { phaseW, pressureW, regimeW, regimeMult, exitPulse, decay },
    anchors: { poolPickId: poolPick.id, oppPickId: oppPick.id, deckSig },
    constraints: publishedAll.map(c => ({ k: c.key, v: c.value, s: c.severity, e: c.enforced ? 1 : 0 })),
    validation: { ok: mergedValidation.ok, reason: mergedValidation.reason ?? null },
    bounds: { RUN_TOTAL_TICKS, PULSE_CYCLE: M142_BOUNDS.PULSE_CYCLE },
  })).slice(0, 16);

  const shouldPulse = (tick % M142_BOUNDS.PULSE_CYCLE) === 0 || tick <= M142_BOUNDS.TRIGGER_THRESHOLD;

  if (shouldPulse) {
    emit({
      event: 'HOUSE_RULES_PUBLISHED',
      mechanic_id: 'M142',
      tick,
      runId,
      payload: {
        lobbyId,
        lobbySignature,
        enabled,
        rulesVersion: rulesVersion || null,
        rulesetSignatureHash: rulesetSignatureHash || null,
        publishedCount: publishedConstraints.length,
        totalCount: publishedAll.length,
        validationOk: mergedValidation.ok,
        validationReason: mergedValidation.reason ?? null,
      },
    });

    emit({
      event: 'CONSTRAINT_VALIDATED',
      mechanic_id: 'M142',
      tick,
      runId,
      payload: {
        lobbyId,
        lobbySignature,
        ok: mergedValidation.ok,
        reason: mergedValidation.reason ?? null,
        invalidCount: publishedValidated.filter(c => !c.valid).length,
        macroRegime,
        runPhase: phase,
        pressureTier,
        tickTier,
        inChaos,
      },
    });

    emit({
      event: 'LOBBY_SIGNED',
      mechanic_id: 'M142',
      tick,
      runId,
      payload: {
        lobbyId,
        lobbySignature,
        signatureHash: computeHash(lobbySignature + ':' + runId),
        anchors: { poolPickId: poolPick.id, oppPickId: oppPick.id, deckSig },
      },
    });
  }

  return {
    houseRulesActive: enabled && mergedValidation.ok,
    publishedConstraints,
    lobbySignature,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ML companion hook
// ─────────────────────────────────────────────────────────────────────────────

export interface M142MLInput {
  houseRulesActive?: boolean;
  publishedConstraints?: PublishedConstraint[];
  lobbySignature?: string;
  runId: string;
  tick: number;
}

export interface M142MLOutput {
  score: number;            // 0–1
  topFactors: string[];     // max 5 plain-English factors
  recommendation: string;   // single sentence
  auditHash: string;        // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;  // 0–1, how fast this signal should decay
}

/**
 * houseRulesCustomLobbyMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function houseRulesCustomLobbyMLCompanion(
  input: M142MLInput,
): Promise<M142MLOutput> {
  const t = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);

  const active = Boolean(input.houseRulesActive);
  const n = Array.isArray(input.publishedConstraints) ? input.publishedConstraints.length : 0;

  const invalid = Array.isArray(input.publishedConstraints)
    ? input.publishedConstraints.filter(c => c && typeof c === 'object' && (c as any).valid === false).length
    : 0;

  const score = clamp(
    (active ? 0.72 : 0.25) +
      clamp(n * 0.01, 0, 0.15) -
      clamp(invalid * 0.06, 0, 0.30) -
      clamp(t / RUN_TOTAL_TICKS, 0, 1) * 0.05,
    0.01,
    0.99,
  );

  const topFactors = [
    active ? 'House rules active' : 'House rules inactive',
    `published=${n}`,
    invalid > 0 ? `invalid=${invalid}` : 'no invalid constraints',
    `tick=${t}`,
  ].slice(0, 5);

  const recommendation =
    invalid > 0
      ? 'Fix invalid house rules before starting; keep constraints published and signed.'
      : active
        ? 'Keep lobby signature stable; publish constraints to all participants before start.'
        : 'If house rules are disabled, ensure default ruleset signature is still visible (M136).';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M142'),
    confidenceDecay: 0.05,
  };
}