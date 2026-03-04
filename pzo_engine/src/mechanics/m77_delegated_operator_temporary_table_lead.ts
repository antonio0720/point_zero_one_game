// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m77_delegated_operator_temporary_table_lead.ts
//
// Mechanic : M77 — Delegated Operator: Temporary Table Lead
// Family   : coop_governance   Layer: api_endpoint   Priority: 2   Batch: 2
// ML Pair  : m77a
// Deps     : M76
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

// ── Import Anchors (keep every import “accessible” + used) ────────────────────

/**
 * Runtime access to the canonical mechanicsUtils symbols imported by this mechanic.
 * Keeps generator-wide imports “live” and provides inspection/debug handles.
 */
export const M77_IMPORTED_SYMBOLS = {
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

/**
 * Type-only anchor to ensure every imported domain type remains referenced in-module.
 */
export type M77_ImportedTypesAnchor = {
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

// ── Local domain types (keep M77 standalone; no forced edits to ./types.ts) ──

export type OperatorPower =
  | 'OPEN_VOTE'
  | 'CLOSE_VOTE'
  | 'SET_AGENDA'
  | 'LOCK_DECISION'
  | 'KICKOFF_TIMER'
  | 'PAUSE_TIMER'
  | 'RESUME_TIMER'
  | 'DECLARE_EMERGENCY';

export type DelegationScope = 'TABLE' | 'CONTRACT' | 'RUN';

export interface DelegationGrant {
  delegateId: string;
  scope: DelegationScope;
  durationTicks: number;
  grantedAtTick: number;
  expiresAtTick: number;
  powers: OperatorPower[];
  auditHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M77Input {
  delegateId?: string;
  delegationScope?: string; // (coerced into DelegationScope)
  delegationDuration?: number; // ticks

  // Optional execution context (safe to omit)
  tick?: number;
  runId?: string;
  pressureTier?: PressureTier;
}

export interface M77Output {
  delegationActive: boolean;
  operatorPowers: OperatorPower[];
  delegationExpiry: number; // tick
  grant?: DelegationGrant;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M77Event = 'DELEGATION_GRANTED' | 'DELEGATION_REVOKED' | 'OPERATOR_ACTION_TAKEN';

export interface M77TelemetryPayload extends MechanicTelemetryPayload {
  event: M77Event;
  mechanic_id: 'M77';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M77_BOUNDS = {
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

// ── Internal helpers (deterministic, no state mutation) ────────────────────

function m77DeriveScope(raw?: string): DelegationScope {
  const v = String(raw ?? '').trim().toUpperCase();
  if (v === 'CONTRACT') return 'CONTRACT';
  if (v === 'RUN') return 'RUN';
  return 'TABLE';
}

function m77DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m77DeriveRegime(tick: number, schedule: MacroEvent[]): MacroRegime {
  const sorted = [...(schedule ?? [])].sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m77InChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows ?? []) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m77DerivePressureTier(participants: number, inChaos: boolean): PressureTier {
  if (inChaos) return participants >= 6 ? 'CRITICAL' : 'HIGH';
  if (participants <= 2) return 'LOW';
  if (participants <= 5) return 'MEDIUM';
  if (participants <= 8) return 'HIGH';
  return 'CRITICAL';
}

function m77BoundDurationTicks(raw?: number): number {
  // “Temporary table lead” should stay bounded; still configurable by input
  const v = Math.floor(Number(raw ?? 0));
  return clamp(v, 0, RUN_TOTAL_TICKS);
}

function m77ComputePowers(
  seed: string,
  tick: number,
  scope: DelegationScope,
  phase: RunPhase,
  regime: MacroRegime,
  pressureTier: PressureTier,
  inChaos: boolean,
): OperatorPower[] {
  // Use imported weights/multipliers to deterministically vary the grant while staying bounded.
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;
  const regimeMul = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const decay = inChaos ? computeDecayRate(regime, M77_BOUNDS.BASE_DECAY_RATE) : 0;
  const intensity = clamp(pressureW * phaseW * regimeW * regimeMul * exitPulse * (inChaos ? (1 - decay) : 1), 0.5, 6.0);

  // Build a deterministic “pool” of candidate powers using opportunity pool + card ids as entropy anchors
  const pool = buildWeightedPool(`${seed}:powers:${tick}`, intensity, Math.max(1, intensity * 0.75));
  const deck = seededShuffle(DEFAULT_CARD_IDS, `${seed}:deck:${tick}`);
  const deckTop = deck[0] ?? DEFAULT_CARD.id;

  const candidates: OperatorPower[] = [
    'SET_AGENDA',
    'OPEN_VOTE',
    'CLOSE_VOTE',
    'LOCK_DECISION',
    'KICKOFF_TIMER',
    'PAUSE_TIMER',
    'RESUME_TIMER',
    'DECLARE_EMERGENCY',
  ];

  // Scope gates (keep semantics sane)
  const allowed = candidates.filter(p => {
    if (scope === 'TABLE') return p !== 'LOCK_DECISION'; // table lead can’t “lock” globally
    if (scope === 'CONTRACT') return true;
    return true; // RUN
  });

  // Deterministically choose N powers (bounded) based on intensity + entropy
  const n = clamp(Math.round(intensity + (deckTop.length % 3)), 2, 6);

  // Use seededIndex + pool-derived entropy to pick without repeats
  const chosen: OperatorPower[] = [];
  for (let i = 0; i < allowed.length && chosen.length < n; i++) {
    const op = pool[seededIndex(seed, tick + 200 + i, Math.max(1, pool.length))] ?? DEFAULT_CARD;
    const h = computeHash(`${seed}:${tick}:${op.id ?? op.name ?? 'x'}:${i}`);
    const idx = seededIndex(h, tick + i, allowed.length);
    const pick = allowed[idx];
    if (pick && !chosen.includes(pick)) chosen.push(pick);
  }

  // Ensure required minimum capabilities
  if (!chosen.includes('SET_AGENDA')) chosen.unshift('SET_AGENDA');
  if (!chosen.includes('OPEN_VOTE')) chosen.push('OPEN_VOTE');

  // If high pressure or chaos, include emergency
  if ((pressureTier === 'HIGH' || pressureTier === 'CRITICAL' || inChaos) && !chosen.includes('DECLARE_EMERGENCY')) {
    chosen.push('DECLARE_EMERGENCY');
  }

  return chosen.slice(0, 6);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * delegatedOperatorHandler
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function delegatedOperatorHandler(input: M77Input, emit: MechanicEmitter): M77Output {
  const delegateId = String(input.delegateId ?? '');
  const scope = m77DeriveScope(input.delegationScope);
  const durationTicks = m77BoundDurationTicks(input.delegationDuration);

  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const runId = String(input.runId ?? computeHash(JSON.stringify(input)));

  // Deterministic context (bounded chaos)
  const seed = computeHash(
    JSON.stringify({
      m: 'M77',
      delegateId,
      scope,
      durationTicks,
      tick,
      runId,
    }),
  );

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m77DerivePhase(tick);
  const regime = m77DeriveRegime(tick, macroSchedule);
  const inChaos = m77InChaosWindow(tick, chaosWindows);

  // We don’t have participant list here, so derive a stable proxy from seed entropy.
  const pseudoParticipants = clamp(seededIndex(seed, tick + 11, 12) + 1, 1, 12);
  const pressureTier = (input.pressureTier as PressureTier) ?? m77DerivePressureTier(pseudoParticipants, inChaos);

  const operatorPowers = m77ComputePowers(seed, tick, scope, phase, regime, pressureTier, inChaos);
  const expiresAtTick = clamp(tick + durationTicks, tick, RUN_TOTAL_TICKS);

  const auditHash = computeHash(
    JSON.stringify({
      m: 'M77',
      delegateId,
      scope,
      durationTicks,
      tick,
      expiresAtTick,
      phase,
      regime,
      pressureTier,
      inChaos,
      operatorPowers,
      seed,
    }),
  );

  const grant: DelegationGrant = {
    delegateId,
    scope,
    durationTicks,
    grantedAtTick: tick,
    expiresAtTick,
    powers: operatorPowers,
    auditHash,
  };

  // Emit grant / revoke events deterministically
  emit({
    event: 'DELEGATION_GRANTED',
    mechanic_id: 'M77',
    tick,
    runId,
    payload: {
      delegateId,
      scope,
      durationTicks,
      expiresAtTick,
      operatorPowers,
      auditHash,
    },
  });

  // If duration is 0, we auto-revoke (still returns a fully-populated output).
  const delegationActive = durationTicks > 0;

  if (!delegationActive) {
    emit({
      event: 'DELEGATION_REVOKED',
      mechanic_id: 'M77',
      tick,
      runId,
      payload: {
        delegateId,
        scope,
        reason: 'durationTicks=0',
        auditHash,
      },
    });
  }

  // Emit a bounded “operator action taken” telemetry hint (no state mutation)
  const opIdx = seededIndex(auditHash, tick + 99, operatorPowers.length || 1);
  const op = operatorPowers[opIdx] ?? 'SET_AGENDA';
  emit({
    event: 'OPERATOR_ACTION_TAKEN',
    mechanic_id: 'M77',
    tick,
    runId,
    payload: {
      delegateId,
      scope,
      action: op,
      note: 'telemetry_hint_only',
    },
  });

  return {
    delegationActive,
    operatorPowers,
    delegationExpiry: expiresAtTick,
    grant,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M77MLInput {
  delegationActive?: boolean;
  operatorPowers?: OperatorPower[];
  delegationExpiry?: number;
  runId: string;
  tick: number;
}

export interface M77MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * delegatedOperatorHandlerMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function delegatedOperatorHandlerMLCompanion(input: M77MLInput): Promise<M77MLOutput> {
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);

  const active = Boolean(input.delegationActive ?? false);
  const powers = Array.isArray(input.operatorPowers) ? input.operatorPowers : [];
  const expiry = Number(input.delegationExpiry ?? 0);

  // Regime is unknown here; treat as neutral for decay.
  const confidenceDecay = computeDecayRate('NEUTRAL' as MacroRegime, M77_BOUNDS.BASE_DECAY_RATE);

  // Score: more powers + active + expiry in future => higher, bounded.
  const future = expiry > tick ? 1 : 0;
  const score = clamp(0.25 + (active ? 0.35 : 0) + clamp(powers.length / 6, 0, 1) * 0.3 + future * 0.1, 0.01, 0.99);

  // Deterministic hint using DEFAULT_CARD_IDS (keeps import live)
  const hintPick = seededIndex(computeHash(`M77ML:${tick}:${input.runId}:${powers.join(',')}:${expiry}`), tick, DEFAULT_CARD_IDS.length);
  const hintCardId = DEFAULT_CARD_IDS[hintPick] ?? DEFAULT_CARD.id;

  const topFactors = [
    `tick=${tick}/${RUN_TOTAL_TICKS}`,
    `active=${active ? 'yes' : 'no'}`,
    `powers=${powers.length}`,
    `expiry=${expiry}`,
    `hintCardId=${hintCardId}`,
  ].slice(0, 5);

  const recommendation = !active
    ? 'Delegation inactive: require re-grant with nonzero duration and clear scope.'
    : future
      ? 'Delegation active: enforce operator actions through ledger-verified commands until expiry.'
      : 'Delegation expired: revoke powers and return control to default governance.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M77'),
    confidenceDecay,
  };
}