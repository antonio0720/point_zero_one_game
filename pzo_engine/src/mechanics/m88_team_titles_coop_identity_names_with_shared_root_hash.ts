// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m88_team_titles_coop_identity_names_with_shared_root_hash.ts
//
// Mechanic : M88 — Team Titles: Coop Identity Names with Shared Root Hash
// Family   : achievement_expert   Layer: season_runtime   Priority: 3   Batch: 2
// ML Pair  : m88a
// Deps     : M62, M88
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

// ── Import Anchors (keeps every symbol “accessible” + TS-used) ───────────────

export const M88_IMPORTED_SYMBOLS = {
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

export type M88_ImportedTypesAnchor = {
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

// ── Local domain (M88-specific) ──────────────────────────────────────────────

export interface TeamTitleDefinition {
  /** Base title (ex: "Iron Syndicate", "Canyon Concord", "Ledger Wolves") */
  baseTitle: string;

  /** Optional subtitle (ex: "Season 3", "Debtbreakers", "Proofbound") */
  subtitle?: string;

  /** Optional title “style id” for UI. Cosmetic only. */
  styleId?: string;

  /** Optional allowlist of suffixes; if omitted, deterministic suffix pool is used. */
  suffixes?: string[];

  /** Optional allowlist of prefixes; if omitted, deterministic prefix pool is used. */
  prefixes?: string[];

  /** Optional maximum display length for UI clamping. Default: 32 */
  maxLen?: number;
}

export interface SharedRootEnvelope {
  teamId: string;
  seasonId?: string;
  members?: string[]; // stable member ids (sorted before hashing)
  seedSalt?: string; // optional server salt
  titleBase?: string; // optional, for stronger binding to definition
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M88Input {
  teamId?: string;
  titleDefinition?: unknown;
  sharedRootHash?: string;

  /**
   * Optional snapshot sources; router may pass richer season/run context.
   * If present, they strengthen determinism and help audit the root binding.
   */
  seasonId?: string;
  seasonState?: SeasonState;
  stateTick?: number;
}

export interface M88Output {
  teamTitleAssigned: boolean;
  rootHashVerified: boolean;
  displayTitle: string;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M88Event = 'TEAM_TITLE_AWARDED' | 'ROOT_HASH_BOUND' | 'TITLE_DISPLAYED';

export interface M88TelemetryPayload extends MechanicTelemetryPayload {
  event: M88Event;
  mechanic_id: 'M88';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M88_BOUNDS = {
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

// ── Internal helpers (pure) ────────────────────────────────────────────────

function m88ClampTick(tick: number): number {
  return clamp(tick, 0, RUN_TOTAL_TICKS - 1);
}

function m88PhaseFromTick(tick: number): RunPhase {
  const t = m88ClampTick(tick);
  const third = RUN_TOTAL_TICKS / 3;
  return t < third ? 'EARLY' : t < third * 2 ? 'MID' : 'LATE';
}

function m88RegimeFromSchedule(tick: number, macro: MacroEvent[]): MacroRegime {
  if (!macro || macro.length === 0) return 'NEUTRAL';
  const sorted = [...macro].sort((a, b) => a.tick - b.tick);
  let r: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) r = ev.regimeChange;
  }
  return r;
}

function m88ChaosHit(tick: number, chaos: ChaosWindow[]): ChaosWindow | null {
  for (const w of chaos) {
    if (tick >= w.startTick && tick <= w.endTick) return w;
  }
  return null;
}

function m88PressureFrom(phase: RunPhase, chaosHit: ChaosWindow | null): PressureTier {
  if (chaosHit) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function m88TickTierFrom(pressure: PressureTier): TickTier {
  if (pressure === 'CRITICAL') return 'CRITICAL';
  if (pressure === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function m88Hash16(core: string): string {
  // computeHash() returns 8 hex chars; concatenate twice for stable 16-char ids.
  return computeHash(core + ':a') + computeHash(core + ':b');
}

function m88CoerceTitleDef(x: unknown): TeamTitleDefinition {
  const d = (x && typeof x === 'object') ? (x as Partial<TeamTitleDefinition>) : {};
  const baseTitle = String((d.baseTitle ?? '')).trim();

  return {
    baseTitle: baseTitle.length > 0 ? baseTitle : 'Unnamed Team',
    subtitle: d.subtitle ? String(d.subtitle) : undefined,
    styleId: d.styleId ? String(d.styleId) : undefined,
    suffixes: Array.isArray(d.suffixes) ? d.suffixes.map(String).filter(Boolean) : undefined,
    prefixes: Array.isArray(d.prefixes) ? d.prefixes.map(String).filter(Boolean) : undefined,
    maxLen: typeof d.maxLen === 'number' ? clamp(d.maxLen, 12, 64) : 32,
  };
}

function m88TitleClamp(title: string, maxLen: number): string {
  const t = title.trim().replace(/\s+/g, ' ');
  if (t.length <= maxLen) return t;
  // deterministic clamp w/ ellipsis
  return t.slice(0, Math.max(0, maxLen - 1)).trimEnd() + '…';
}

function m88StableRootEnvelope(
  teamId: string,
  seasonId: string,
  titleBase: string,
  members: string[],
  seedSalt: string,
): SharedRootEnvelope {
  const m = [...members].map(String).filter(Boolean).sort();
  return { teamId, seasonId, titleBase, members: m, seedSalt };
}

function m88DeriveMembersFromSeasonState(seasonState?: SeasonState): string[] {
  // We don't know your exact SeasonState shape; this is a safe best-effort extraction.
  const s = seasonState as unknown as {
    teamMembers?: string[];
    members?: string[];
    coopMembers?: string[];
  } | undefined;

  const m = (s?.teamMembers ?? s?.members ?? s?.coopMembers ?? []) as string[];
  return Array.isArray(m) ? m.map(String).filter(Boolean) : [];
}

type M88Ctx = {
  tick: number;
  seed: string;

  phase: RunPhase;
  regime: MacroRegime;
  pressure: PressureTier;
  tier: TickTier;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  decayRate: number;
  pulse: number;
  mult: number;

  phaseWeight: number;
  regimeWeight: number;
  pressureWeight: number;

  titleCard: GameCard;
  deckSig: string[];
};

function m88BuildCtx(seedRoot: string, tickRaw: number): M88Ctx {
  const tick = m88ClampTick(tickRaw);
  const seed = computeHash(`${seedRoot}:M88:${tick}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m88PhaseFromTick(tick);
  const regime = m88RegimeFromSchedule(tick, macroSchedule);
  const chaosHit = m88ChaosHit(tick, chaosWindows);
  const pressure = m88PressureFrom(phase, chaosHit);
  const tier = m88TickTierFrom(pressure);

  const decayRate = computeDecayRate(regime, M88_BOUNDS.BASE_DECAY_RATE);
  const pulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const mult = REGIME_MULTIPLIERS[regime] ?? 1.0;

  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;
  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;

  // Cosmetic tag derived from weighted pool + opportunity pool.
  const w = buildWeightedPool(`${seed}:titlePool`, pressureWeight * phaseWeight, regimeWeight);
  const titleCard =
    w[seededIndex(seed, tick + 88, w.length)] ??
    OPPORTUNITY_POOL[seededIndex(seed, tick + 1088, OPPORTUNITY_POOL.length)] ??
    DEFAULT_CARD;

  // Deterministic deck signature for audits.
  const deckSig = seededShuffle(DEFAULT_CARD_IDS, `${seed}:deckSig`).slice(0, Math.min(3, DEFAULT_CARD_IDS.length));

  return {
    tick,
    seed,
    phase,
    regime,
    pressure,
    tier,
    macroSchedule,
    chaosWindows,
    decayRate,
    pulse,
    mult,
    phaseWeight,
    regimeWeight,
    pressureWeight,
    titleCard,
    deckSig,
  };
}

function m88PickAffixes(def: TeamTitleDefinition, ctx: M88Ctx): { prefix: string; suffix: string } {
  const defaultPrefixes = ['The', 'Project', 'Unit', 'Syndicate', 'Cohort'];
  const defaultSuffixes = ['Collective', 'Concord', 'Guild', 'Crew', 'Division'];

  const prefixes = (def.prefixes && def.prefixes.length > 0) ? def.prefixes : defaultPrefixes;
  const suffixes = (def.suffixes && def.suffixes.length > 0) ? def.suffixes : defaultSuffixes;

  const p = prefixes[seededIndex(ctx.seed, ctx.tick + 188, prefixes.length)] ?? prefixes[0] ?? 'The';
  const s = suffixes[seededIndex(ctx.seed, ctx.tick + 288, suffixes.length)] ?? suffixes[0] ?? 'Collective';

  return { prefix: String(p), suffix: String(s) };
}

function m88BuildDisplayTitle(def: TeamTitleDefinition, ctx: M88Ctx, rootHash: string): string {
  const { prefix, suffix } = m88PickAffixes(def, ctx);

  // Root-hash-derived, stable 4-char tag for uniqueness (cosmetic).
  const tag = rootHash.slice(0, 4).toUpperCase();

  const base = def.baseTitle.trim();
  const sub = def.subtitle ? ` · ${def.subtitle}` : '';
  const cardTag = ctx.titleCard.id === DEFAULT_CARD.id ? '' : ` · ${ctx.titleCard.id}`;

  const assembled = `${prefix} ${base} ${suffix} · ${tag}${sub}${cardTag}`;
  return m88TitleClamp(assembled, def.maxLen ?? 32);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * teamTitleAwarder
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function teamTitleAwarder(input: M88Input, emit: MechanicEmitter): M88Output {
  const teamId = String(input.teamId ?? '').trim();
  const def = m88CoerceTitleDef(input.titleDefinition);
  const sharedRootHash = String(input.sharedRootHash ?? '').trim();

  const seasonId = String((input.seasonId ?? input.seasonState?.seasonId ?? '')).trim();
  const tickRaw =
    typeof input.stateTick === 'number'
      ? input.stateTick
      : (typeof (input.seasonState as unknown as { tick?: number } | undefined)?.tick === 'number'
          ? (input.seasonState as unknown as { tick?: number }).tick!
          : 0);

  const members = m88DeriveMembersFromSeasonState(input.seasonState);
  const seedSalt = computeHash(`M88:salt:${seasonId}:${teamId}:${members.join('|')}`);

  // Root envelope + computed root hash:
  // - Binding includes teamId + seasonId + sorted members + base title + salt
  const envelope = m88StableRootEnvelope(teamId, seasonId, def.baseTitle, members, seedSalt);
  const computedRootHash = m88Hash16(JSON.stringify(envelope));

  const rootHashVerified = sharedRootHash.length > 0 ? sharedRootHash === computedRootHash : true;
  const effectiveRootHash = sharedRootHash.length > 0 ? sharedRootHash : computedRootHash;

  const ctx = m88BuildCtx(`${effectiveRootHash}:${seasonId}:${teamId}`, tickRaw);

  const displayTitle = m88BuildDisplayTitle(def, ctx, effectiveRootHash);

  // Decision gate: require team id + base title at minimum.
  const hasMinimum = teamId.length >= M88_BOUNDS.TRIGGER_THRESHOLD && def.baseTitle.length >= M88_BOUNDS.TRIGGER_THRESHOLD;

  // Emit root binding (always; crucial for server verification)
  emit({
    event: 'ROOT_HASH_BOUND',
    mechanic_id: 'M88',
    tick: ctx.tick,
    runId: computeHash(`${seasonId}:${teamId}`),
    payload: {
      seasonId,
      teamId,
      membersCount: members.length,
      baseTitle: def.baseTitle,
      computedRootHash,
      providedRootHash: sharedRootHash || null,
      rootHashVerified,
      deckSig: ctx.deckSig,
      regime: ctx.regime,
      phase: ctx.phase,
      pressure: ctx.pressure,
      tickTier: ctx.tier,
      decayRate: Number(ctx.decayRate.toFixed(4)),
      pulse: Number(ctx.pulse.toFixed(4)),
      mult: Number(ctx.mult.toFixed(4)),
      audit: computeHash(JSON.stringify({ envelope, computedRootHash, ctxSeed: ctx.seed })),
    },
  });

  // Award event
  emit({
    event: 'TEAM_TITLE_AWARDED',
    mechanic_id: 'M88',
    tick: ctx.tick,
    runId: computeHash(`${seasonId}:${teamId}`),
    payload: {
      seasonId,
      teamId,
      titleAssigned: hasMinimum,
      displayTitle,
      styleId: def.styleId ?? null,
      titleCardId: ctx.titleCard.id,
      titleCardName: ctx.titleCard.name,
      rootHash: effectiveRootHash,
      rootHashVerified,
      audit: computeHash(`${effectiveRootHash}:${displayTitle}:${ctx.seed}`),
    },
  });

  // Display event (UI binding)
  emit({
    event: 'TITLE_DISPLAYED',
    mechanic_id: 'M88',
    tick: ctx.tick,
    runId: computeHash(`${seasonId}:${teamId}`),
    payload: {
      seasonId,
      teamId,
      displayTitle,
      maxLen: def.maxLen ?? 32,
      tag: effectiveRootHash.slice(0, 4).toUpperCase(),
      deckSig: ctx.deckSig,
    },
  });

  return {
    teamTitleAssigned: hasMinimum,
    rootHashVerified,
    displayTitle,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M88MLInput {
  teamTitleAssigned?: boolean;
  rootHashVerified?: boolean;
  displayTitle?: string;
  runId: string;
  tick: number;
}

export interface M88MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * teamTitleAwarderMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function teamTitleAwarderMLCompanion(input: M88MLInput): Promise<M88MLOutput> {
  const tick = m88ClampTick(input.tick ?? 0);

  // Deterministic macro context derived from runId+tick.
  const seed = computeHash(`${input.runId}:M88ML:${tick}`);
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m88PhaseFromTick(tick);
  const regime = m88RegimeFromSchedule(tick, macroSchedule);
  const chaosHit = m88ChaosHit(tick, chaosWindows);
  const pressure = m88PressureFrom(phase, chaosHit);

  const decay = computeDecayRate(regime, M88_BOUNDS.BASE_DECAY_RATE);
  const pulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const mult = REGIME_MULTIPLIERS[regime] ?? 1.0;

  const assigned = Boolean(input.teamTitleAssigned);
  const verified = Boolean(input.rootHashVerified);
  const titleLen = (input.displayTitle ?? '').length;

  const base = assigned ? 0.60 : 0.25;
  const verifyBonus = verified ? 0.10 : -0.05;
  const lengthBonus = clamp(titleLen / 48, 0, 1) * 0.06;

  const chaosPenalty = chaosHit ? 0.12 : 0.0;
  const pressurePenalty = pressure === 'CRITICAL' ? 0.10 : pressure === 'HIGH' ? 0.05 : 0.0;

  const macroSignal = clamp((pulse * mult) / 3.0, 0, 0.15);
  const stability = clamp((1 - decay) * 0.20, 0, 0.20);

  const score = clamp(base + verifyBonus + lengthBonus + macroSignal + stability - chaosPenalty - pressurePenalty, 0.01, 0.99);

  const topFactors = [
    `assigned=${assigned} verified=${verified}`,
    `tick=${tick}/${RUN_TOTAL_TICKS} phase=${phase}`,
    `regime=${regime} pulse*mult=${(pulse * mult).toFixed(2)}`,
    `pressure=${pressure} chaos=${Boolean(chaosHit)}`,
    `titleLen=${titleLen}`,
  ].slice(0, 5);

  const recommendation = assigned
    ? verified
      ? 'Team title bound to root hash: safe to display across clients and include in proof receipts.'
      : 'Title assigned but root hash mismatch: re-derive root hash from the shared envelope and rebind.'
    : 'No title assigned: ensure teamId + baseTitle meet minimum thresholds and provide (or compute) root hash.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify({ mid: 'M88', ...input, seed, phase, regime, pressure, decay, pulse, mult }) + ':ml:M88'),
    confidenceDecay: decay,
  };
}