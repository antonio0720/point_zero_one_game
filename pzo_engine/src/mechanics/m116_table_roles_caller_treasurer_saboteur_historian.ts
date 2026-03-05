// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m116_table_roles_caller_treasurer_saboteur_historian.ts
//
// Mechanic : M116 — Table Roles: Caller, Treasurer, Saboteur, Historian
// Family   : social_advanced   Layer: api_endpoint   Priority: 2   Batch: 3
// ML Pair  : m116a
// Deps     : M26
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

// ── Import Anchors (keeps every symbol accessible + TS-used) ──────────────────

export const M116_IMPORTED_SYMBOLS = {
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

export type M116_ImportedTypesAnchor = {
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

// ── Local types (mechanic-standalone) ──────────────────────────────────────

export type TableRole = 'CALLER' | 'TREASURER' | 'SABOTEUR' | 'HISTORIAN';

export type RoleAssignment = {
  playerId: string;
  role: TableRole;
  // optional role strength (for leagues / variants)
  level?: number;
};

export type RoleSynergy = {
  // pair synergy: (CALLER+TREASURER), (CALLER+HISTORIAN), etc.
  a: TableRole;
  b: TableRole;
  // effect is advisory and ledger-verifiable; does not mutate state directly here
  bonus: number; // 0..1
  description?: string;
};

export type RolePassive = {
  role: TableRole;
  passiveId: string;
  magnitude: number;
};

export type RoleAbility = {
  role: TableRole;
  abilityId: string;
  cooldownTicks: number;
  magnitude: number;
};

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M116Input {
  teamId?: string;
  roleAssignment?: RoleAssignment; // optional single assignment request
  roleSynergies?: RoleSynergy[];   // optional synergy table

  // Optional, backward-compatible additions (keeps existing callers intact)
  runId?: string;
  tick?: number;

  // optional roster snapshot
  players?: { playerId: string; seedHint?: string }[];
}

export interface M116Output {
  rolesAssigned: RoleAssignment[];
  passivesActive: boolean;
  activeAbilityQueued: boolean;

  // extra metadata callers can ignore
  queuedAbility?: RoleAbility | null;
  activePassives?: RolePassive[];
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M116Event = 'ROLE_ASSIGNED' | 'PASSIVE_ACTIVE' | 'ABILITY_USED';

export interface M116TelemetryPayload extends MechanicTelemetryPayload {
  event: M116Event;
  mechanic_id: 'M116';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M116_BOUNDS = {
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

// ── Internal helpers (pure, deterministic) ─────────────────────────────────

type KV = Record<string, unknown>;

function isRecord(v: unknown): v is KV {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function normalizeRole(v: unknown): TableRole | null {
  switch (v) {
    case 'CALLER':
    case 'TREASURER':
    case 'SABOTEUR':
    case 'HISTORIAN':
      return v;
    default:
      return null;
  }
}

function clampTick(t: number): number {
  return clamp(t, 0, RUN_TOTAL_TICKS - 1);
}

function phaseFromTick(tick: number): RunPhase {
  const p = clamp((tick + 1) / RUN_TOTAL_TICKS, 0, 1);
  return p < 0.33 ? 'EARLY' : p < 0.66 ? 'MID' : 'LATE';
}

function chaosActive(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function pressureFrom(phase: RunPhase, chaos: boolean): PressureTier {
  if (chaos) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function tickTierFromPressure(p: PressureTier): TickTier {
  if (p === 'CRITICAL') return 'CRITICAL';
  if (p === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function normalizeRegime(v: unknown): MacroRegime {
  switch (v) {
    case 'BULL':
    case 'NEUTRAL':
    case 'BEAR':
    case 'CRISIS':
      return v;
    case 'RECESSION':
    case 'DOWNTURN':
      return 'BEAR';
    case 'BOOM':
    case 'EXPANSION':
      return 'BULL';
    default:
      return 'NEUTRAL';
  }
}

function regimeFromSchedule(tick: number, schedule: MacroEvent[], fallback: MacroRegime): MacroRegime {
  let r: MacroRegime = fallback;
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) r = normalizeRegime(ev.regimeChange);
  }
  return r;
}

function stableRunId(input: M116Input, tick: number): string {
  const explicit = typeof input.runId === 'string' ? input.runId.trim() : '';
  if (explicit.length > 0) return explicit;

  return computeHash(
    `M116:run:${tick}:${String(input.teamId ?? '')}:${JSON.stringify(input.roleAssignment ?? null)}:${JSON.stringify(input.players ?? null)}`,
  );
}

function defaultSynergies(): RoleSynergy[] {
  return [
    { a: 'CALLER', b: 'TREASURER', bonus: 0.22, description: 'Clear calls + disciplined cash execution' },
    { a: 'CALLER', b: 'HISTORIAN', bonus: 0.18, description: 'Calls anchored to memory / precedent' },
    { a: 'TREASURER', b: 'HISTORIAN', bonus: 0.16, description: 'Budget memory reduces repeat mistakes' },
    { a: 'SABOTEUR', b: 'HISTORIAN', bonus: 0.10, description: 'Sabotage contained by audit trail' },
    { a: 'SABOTEUR', b: 'CALLER', bonus: 0.08, description: 'Calls pressured by adversarial challenge' },
  ];
}

function normalizeSynergies(raw: unknown): RoleSynergy[] {
  const fallback = defaultSynergies();
  if (!Array.isArray(raw)) return fallback;

  const out: RoleSynergy[] = raw
    .map((x: unknown): RoleSynergy | null => {
      if (!isRecord(x)) return null;
      const a = normalizeRole(x.a);
      const b = normalizeRole(x.b);
      if (!a || !b) return null;

      const bonus = clamp(asNumber(x.bonus, 0), 0, 1);
      const description = x.description != null ? asString(x.description, '') : undefined;
      return { a, b, bonus, description };
    })
    .filter((x): x is RoleSynergy => x !== null);

  return out.length ? out : fallback;
}

function rosterFromInput(input: M116Input, seed: string): { playerId: string; seedHint: string }[] {
  // if no roster provided, synthesize deterministic 4-seat table using seed
  if (Array.isArray(input.players) && input.players.length > 0) {
    return input.players
      .map(p => ({
        playerId: asString((p as unknown as { playerId?: unknown }).playerId, '').trim(),
        seedHint: asString((p as unknown as { seedHint?: unknown }).seedHint, ''),
      }))
      .filter(p => p.playerId.length > 0)
      .map(p => ({ ...p, seedHint: p.seedHint.length ? p.seedHint : computeHash(`${seed}:player:${p.playerId}`) }));
  }

  const ids = ['P1', 'P2', 'P3', 'P4'].map(s => `${s}-${seededIndex(`${seed}:roster`, s.length, 10_000)}`);
  return ids.map((id, i) => ({ playerId: id, seedHint: computeHash(`${seed}:player:${i}:${id}`) }));
}

function buildRoleDeck(seed: string): TableRole[] {
  // deterministic shuffle (uses seededShuffle)
  return seededShuffle(['CALLER', 'TREASURER', 'SABOTEUR', 'HISTORIAN'] as TableRole[], `${seed}:roles`);
}

function assignRolesStrict(seed: string, roster: { playerId: string }[], requested?: RoleAssignment): RoleAssignment[] {
  const roles = buildRoleDeck(seed);

  // If caller requests a single assignment, lock it and distribute the rest deterministically.
  const locked: RoleAssignment[] = [];
  const remainingPlayers = [...roster];
  let remainingRoles = [...roles];

  if (requested && requested.playerId && requested.role) {
    locked.push({ playerId: requested.playerId, role: requested.role, level: requested.level });
    // remove player + role if present
    const pi = remainingPlayers.findIndex(p => p.playerId === requested.playerId);
    if (pi >= 0) remainingPlayers.splice(pi, 1);
    remainingRoles = remainingRoles.filter(r => r !== requested.role);
  }

  const shuffledPlayers = seededShuffle(remainingPlayers, `${seed}:players`);
  const out: RoleAssignment[] = [...locked];

  for (let i = 0; i < shuffledPlayers.length; i++) {
    const role = remainingRoles[i % remainingRoles.length] ?? roles[i % roles.length];
    out.push({ playerId: shuffledPlayers[i].playerId, role, level: 1 });
  }

  // deterministic ordering for stable diffs
  return out.sort((a, b) => a.playerId.localeCompare(b.playerId));
}

function synergyBonus(assignments: RoleAssignment[], synergies: RoleSynergy[]): number {
  const roles = assignments.map(a => a.role);
  let bonus = 0;
  for (const s of synergies) {
    const hasA = roles.includes(s.a);
    const hasB = roles.includes(s.b);
    if (hasA && hasB) bonus += s.bonus;
  }
  return clamp(bonus, 0, 1);
}

function passivesFor(assignments: RoleAssignment[], seed: string, tick: number, pressure: PressureTier): RolePassive[] {
  const base = pressure === 'CRITICAL' ? 1.25 : pressure === 'HIGH' ? 1.10 : pressure === 'MEDIUM' ? 1.0 : 0.90;

  const passives: RolePassive[] = [];
  for (const a of assignments) {
    const mag = clamp(base * (0.75 + (seededIndex(`${seed}:passive:${a.role}`, tick, 51) / 100)), 0.25, 2.0);
    passives.push({
      role: a.role,
      passiveId: `PASSIVE_${a.role}`,
      magnitude: mag,
    });
  }
  return passives;
}

function queuedAbilityFor(assignments: RoleAssignment[], seed: string, tick: number, synergy: number): RoleAbility | null {
  if (assignments.length === 0) return null;
  const idx = seededIndex(`${seed}:abilityPick`, tick, assignments.length);
  const role = assignments[idx].role;

  const mag = clamp(0.50 + synergy + (seededIndex(`${seed}:abilityMag:${role}`, tick + 3, 51) / 100), 0, 2.0);
  const cd = clamp(Math.round(6 + (1 - synergy) * 12), 3, 24);

  return {
    role,
    abilityId: `ABILITY_${role}`,
    cooldownTicks: cd,
    magnitude: mag,
  };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * tableRoleAssignmentEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function tableRoleAssignmentEngine(input: M116Input, emit: MechanicEmitter): M116Output {
  const teamId = asString(input.teamId, '').trim();

  const tick =
    typeof input.tick === 'number' && Number.isFinite(input.tick)
      ? clampTick(input.tick)
      : clampTick(seededIndex(computeHash(`M116:tick:${teamId}`), 0, RUN_TOTAL_TICKS));

  const runId = stableRunId(input, tick);
  const seed = computeHash(`M116:${runId}:${tick}:${teamId}`);

  // consume schedule utilities (keeps imports live and drives deterministic context)
  const macroSchedule = buildMacroSchedule(`${seed}:macro`, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(`${seed}:chaos`, CHAOS_WINDOWS_PER_RUN);

  const phase = phaseFromTick(tick);
  const chaos = chaosActive(tick, chaosWindows);
  const pressure = pressureFrom(phase, chaos);
  const tickTier = tickTierFromPressure(pressure);

  const regime = regimeFromSchedule(tick, macroSchedule, 'NEUTRAL');
  const decay = computeDecayRate(regime, M116_BOUNDS.BASE_DECAY_RATE);
  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  // deterministic theme card (keeps buildWeightedPool, OPPORTUNITY_POOL, DEFAULT_CARD live)
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;
  const pressureW = PRESSURE_WEIGHTS[pressure] ?? 1.0;

  const pool = buildWeightedPool(`${seed}:pool`, phaseW * pressureW, regimeW * regimeMultiplier);
  const themeCard =
    (pool[seededIndex(`${seed}:theme`, tick + 5, Math.max(1, pool.length))] as GameCard | undefined) ??
    OPPORTUNITY_POOL[seededIndex(`${seed}:opp`, tick + 15, OPPORTUNITY_POOL.length)] ??
    DEFAULT_CARD;

  const deckSig = seededShuffle(DEFAULT_CARD_IDS, `${seed}:deckSig`).slice(0, Math.min(3, DEFAULT_CARD_IDS.length));

  const roster = rosterFromInput(input, seed);

  const requestedRole =
    input.roleAssignment && isRecord(input.roleAssignment)
      ? ({
          playerId: asString((input.roleAssignment as RoleAssignment).playerId, ''),
          role: normalizeRole((input.roleAssignment as RoleAssignment).role) ?? 'CALLER',
          level: asNumber((input.roleAssignment as RoleAssignment).level, 1),
        } as RoleAssignment)
      : undefined;

  const rolesAssigned = assignRolesStrict(seed, roster, requestedRole);

  const synergies = normalizeSynergies(input.roleSynergies);
  const synergy = synergyBonus(rolesAssigned, synergies);

  const activePassives = passivesFor(rolesAssigned, seed, tick, pressure);
  const queuedAbility = queuedAbilityFor(rolesAssigned, seed, tick, synergy);

  const passivesActive = activePassives.length > 0;
  const activeAbilityQueued = queuedAbility != null;

  // Telemetry: role assignment
  for (const ra of rolesAssigned) {
    emit({
      event: 'ROLE_ASSIGNED',
      mechanic_id: 'M116',
      tick,
      runId,
      payload: {
        teamId,
        playerId: ra.playerId,
        role: ra.role,
        level: ra.level ?? 1,
        synergy,
        phase,
        regime,
        pressure,
        tickTier,
        themeCardId: (themeCard as unknown as { id?: unknown }).id ?? null,
        deckSig,
      },
    });
  }

  // Telemetry: passives
  if (passivesActive) {
    emit({
      event: 'PASSIVE_ACTIVE',
      mechanic_id: 'M116',
      tick,
      runId,
      payload: {
        teamId,
        passives: activePassives,
        synergy,
        decay,
        regimeMultiplier,
        exitPulse,
        phaseW,
        regimeW,
        pressureW,
        themeCardId: (themeCard as unknown as { id?: unknown }).id ?? null,
        deckSig,
        audit: computeHash(JSON.stringify({ mid: 'M116', runId, tick, teamId, rolesAssigned, activePassives, synergy })),
      },
    });
  }

  // Telemetry: queued “ability”
  if (queuedAbility) {
    emit({
      event: 'ABILITY_USED',
      mechanic_id: 'M116',
      tick,
      runId,
      payload: {
        teamId,
        ability: queuedAbility,
        synergy,
        note: 'queued_only_no_state_mutation',
        audit: computeHash(JSON.stringify({ mid: 'M116', runId, tick, teamId, queuedAbility, synergy })),
      },
    });
  }

  return {
    rolesAssigned,
    passivesActive,
    activeAbilityQueued,
    queuedAbility,
    activePassives,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M116MLInput {
  rolesAssigned?: RoleAssignment[];
  passivesActive?: boolean;
  activeAbilityQueued?: boolean;
  runId: string;
  tick: number;
}

export interface M116MLOutput {
  score: number;          // 0–1
  topFactors: string[];   // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string;      // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;// 0–1, how fast this signal should decay
}

/**
 * tableRoleAssignmentEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function tableRoleAssignmentEngineMLCompanion(input: M116MLInput): Promise<M116MLOutput> {
  const score = Math.min(0.99, Math.max(0.01, Object.keys(input).length * 0.05));

  const topFactors: string[] = [];
  if ((input.rolesAssigned?.length ?? 0) > 0) topFactors.push('Roles assigned');
  if (input.passivesActive) topFactors.push('Passives active');
  if (input.activeAbilityQueued) topFactors.push('Ability queued');
  topFactors.push('Advisory only');

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation: input.passivesActive ? 'Leverage role passives; coordinate around Caller.' : 'Assign roles to unlock team passives.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M116'),
    confidenceDecay: 0.05,
  };
}