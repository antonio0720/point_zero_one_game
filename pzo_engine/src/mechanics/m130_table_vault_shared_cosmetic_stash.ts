// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m130_table_vault_shared_cosmetic_stash.ts
//
// Mechanic : M130 — Table Vault: Shared Cosmetic Stash
// Family   : cosmetics   Layer: api_endpoint   Priority: 3   Batch: 3
// ML Pair  : m130a
// Deps     : M26, M126
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
 * Runtime access to canonical mechanicsUtils symbols imported by this mechanic.
 * Keeps all shared imports “live” + directly reachable for debugging/tests.
 */
export const M130_IMPORTED_SYMBOLS = {
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
 * Type-only anchor so every imported domain type remains referenced in-module.
 * Prevents type-import drift and keeps the full surface area reachable.
 */
export type M130_ImportedTypesAnchor = {
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

// ── Local vault domain types (M130-only; intentionally not in ./types) ───────

export type VaultContributionKind = 'TROPHY_POINTS' | 'PROOF_SKIN' | 'COSMETIC';

export interface VaultContribution {
  contributorId: string;
  kind: VaultContributionKind;

  /** For currency contributions. */
  amount?: number;

  /** For cosmetics / proof skins contributions. */
  itemId?: string;

  /** Optional proof hash / signature. */
  proof?: string;

  /** Optional client timestamp for audit. */
  ts?: number;
}

export interface VaultConfig {
  /** Hard cap for vault balance (safety). */
  maxBalance?: number;

  /** Minimum balance required to “use” a shared cosmetic (rent/fee model). */
  minBalanceToUse?: number;

  /** Per-use fee charged from vault (sink). */
  useFee?: number;

  /** Seed salt for deterministic receipts. */
  salt?: string;
}

export interface VaultState {
  teamId: string;
  vaultBalance: number;
  contributionsApplied: number;
  sharedCosmeticUsable: boolean;

  // Deterministic macro context
  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;

  // Deterministic UI hints
  deckHintTop: string;
  opportunityHintId: string;

  auditHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M130Input {
  teamId?: string;
  vaultContributions?: unknown;
  vaultConfig?: Record<string, unknown>;
}

export interface M130Output {
  vaultUpdated: boolean;
  sharedCosmeticUsable: boolean;
  vaultBalance: number;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M130Event = 'VAULT_CONTRIBUTION' | 'VAULT_COSMETIC_USED' | 'VAULT_BALANCE_UPDATED';

export interface M130TelemetryPayload extends MechanicTelemetryPayload {
  event: M130Event;
  mechanic_id: 'M130';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M130_BOUNDS = {
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

  // vault caps
  MAX_BALANCE: 1_000_000_000,
  MAX_CONTRIBUTIONS_IN: 256,
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────

const M130_RULES_VERSION = 'M130:v1';

function asString(v: unknown): string {
  return String(v ?? '').trim();
}

function toFiniteInt(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function normalizeVaultConfig(v: unknown): Required<VaultConfig> {
  const cfg = (v && typeof v === 'object') ? (v as VaultConfig) : {};
  const maxBalance = clamp(toFiniteInt(cfg.maxBalance, M130_BOUNDS.MAX_BALANCE), 1, M130_BOUNDS.MAX_BALANCE);
  const minBalanceToUse = clamp(toFiniteInt(cfg.minBalanceToUse, 0), 0, maxBalance);
  const useFee = clamp(toFiniteInt(cfg.useFee, 0), 0, maxBalance);
  const salt = asString(cfg.salt) || 'vault';
  return { maxBalance, minBalanceToUse, useFee, salt };
}

function parseContributions(v: unknown): VaultContribution[] {
  const out: VaultContribution[] = [];
  if (!Array.isArray(v)) return out;

  for (const raw of v.slice(0, M130_BOUNDS.MAX_CONTRIBUTIONS_IN)) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as any;

    const contributorId = asString(o.contributorId) || asString(o.userId) || asString(o.playerId);
    const kind = (asString(o.kind) as VaultContributionKind) || 'TROPHY_POINTS';

    const amount = Number.isFinite(Number(o.amount)) ? Math.trunc(Number(o.amount)) : undefined;
    const itemId = asString(o.itemId) || undefined;
    const proof = asString(o.proof) || undefined;
    const ts = Number.isFinite(Number(o.ts)) ? Math.trunc(Number(o.ts)) : undefined;

    if (!contributorId) continue;

    out.push({ contributorId, kind, amount, itemId, proof, ts });
  }

  return out;
}

function deriveRunPhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  if (t < RUN_TOTAL_TICKS / 3) return 'EARLY';
  if (t < (RUN_TOTAL_TICKS * 2) / 3) return 'MID';
  return 'LATE';
}

function deriveMacroRegime(tick: number, schedule: MacroEvent[]): MacroRegime {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const sorted = [...schedule].sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if ((ev.tick ?? 0) > t) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function inChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  for (const w of windows) {
    if (t >= w.startTick && t <= w.endTick) return true;
  }
  return false;
}

function derivePressureTier(runPhase: RunPhase, regime: MacroRegime, chaos: boolean): PressureTier {
  if (chaos) return 'CRITICAL';
  if (regime === 'CRISIS') return runPhase === 'EARLY' ? 'HIGH' : 'CRITICAL';
  if (regime === 'BEAR') return runPhase === 'LATE' ? 'HIGH' : 'MEDIUM';
  if (regime === 'BULL') return runPhase === 'EARLY' ? 'LOW' : 'MEDIUM';
  return runPhase === 'EARLY' ? 'LOW' : 'MEDIUM';
}

function deriveTickTier(pressureTier: PressureTier): TickTier {
  if (pressureTier === 'CRITICAL') return 'CRITICAL';
  if (pressureTier === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function applyContribution(balance: number, c: VaultContribution, maxBalance: number): { next: number; delta: number } {
  if (c.kind === 'TROPHY_POINTS') {
    const amt = Math.max(0, toFiniteInt(c.amount, 0));
    const next = clamp(balance + amt, 0, maxBalance);
    return { next, delta: next - balance };
  }

  // Cosmetics/proof skins don't affect numeric balance directly in this mechanic (stash only).
  return { next: balance, delta: 0 };
}

function computeUsable(balance: number, cfg: Required<VaultConfig>): boolean {
  return balance >= cfg.minBalanceToUse;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * tableVaultManager
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function tableVaultManager(input: M130Input, emit: MechanicEmitter): M130Output {
  const teamId = asString(input.teamId) || computeHash(JSON.stringify(input)).slice(0, 16);
  const cfg = normalizeVaultConfig(input.vaultConfig);
  const contributions = parseContributions(input.vaultContributions);

  // Deterministic request/run id.
  const requestId = computeHash(JSON.stringify({ mid: 'M130', v: M130_RULES_VERSION, teamId, cfg, contributions }));

  // Macro fabric (keeps shared imports live + gives vault “season texture”)
  const tick = 0;
  const macroSchedule = buildMacroSchedule(requestId + ':macro', MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(requestId + ':chaos', CHAOS_WINDOWS_PER_RUN);

  const runPhase = deriveRunPhase(tick);
  const macroRegime = deriveMacroRegime(tick, macroSchedule);
  const chaos = inChaosWindow(tick, chaosWindows);

  const pressureTier = derivePressureTier(runPhase, macroRegime, chaos);
  const tickTier = deriveTickTier(pressureTier);

  const decay = computeDecayRate(macroRegime, M130_BOUNDS.BASE_DECAY_RATE);
  const pulseMult = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  // Keep pools live for deterministic “vault UI flavor”
  const deckOrder = seededShuffle(DEFAULT_CARD_IDS, requestId + ':deck');
  const deckHintTop = deckOrder[0] ?? DEFAULT_CARD.id;

  const opportunityHint =
    OPPORTUNITY_POOL[seededIndex(requestId + ':opp', tick, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const weightedPool = buildWeightedPool(requestId + ':pool', pressureW * phaseW, regimeW);
  const weightedPick = weightedPool[seededIndex(requestId + ':weightedPick', tick + 9, Math.max(1, weightedPool.length))] ?? DEFAULT_CARD;

  // Apply contributions (this mechanic is stateless; caller persists balance).
  // So we compute "session balance delta" from contributions only; starting balance assumed 0 here.
  let balance = 0;
  let contributionsApplied = 0;
  const perContributionDeltas: Array<{ contributorId: string; kind: VaultContributionKind; delta: number; itemId?: string }> = [];

  for (const c of contributions) {
    const { next, delta: d } = applyContribution(balance, c, cfg.maxBalance);
    balance = next;
    contributionsApplied += 1;
    perContributionDeltas.push({ contributorId: c.contributorId, kind: c.kind, delta: d, itemId: c.itemId });
  }

  // Determine usability
  const sharedCosmeticUsable = computeUsable(balance, cfg);

  // Optional deterministic “use” decision (simulates a shared cosmetic being used via fee),
  // ONLY when usable and fee > 0 and at least one cosmetic contribution exists.
  const hasCosmeticContribution = contributions.some(c => c.kind !== 'TROPHY_POINTS');
  const shouldAutoUse = sharedCosmeticUsable && cfg.useFee > 0 && hasCosmeticContribution &&
    ((parseInt(computeHash(requestId + ':autouse'), 16) % 2) === 1);

  let usedFee = 0;
  if (shouldAutoUse) {
    usedFee = clamp(cfg.useFee, 0, balance);
    balance = balance - usedFee;
  }

  const auditHash = computeHash(
    JSON.stringify({
      mid: 'M130',
      v: M130_RULES_VERSION,
      teamId,
      cfg,
      requestId,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      decay,
      pulseMult,
      regimeMult,
      deckHintTop,
      opportunityHintId: opportunityHint.id,
      weightedPickId: weightedPick.id,
      contributionsApplied,
      perContributionDeltas,
      usedFee,
      vaultBalance: balance,
      sharedCosmeticUsable: computeUsable(balance, cfg),
    }),
  );

  const runId = requestId;

  // ── Telemetry (deterministic) ───────────────────────────────────────────

  emit({
    event: 'VAULT_CONTRIBUTION',
    mechanic_id: 'M130',
    tick,
    runId,
    payload: {
      teamId,
      contributionsIn: contributions.length,
      contributionsApplied,
      perContributionDeltas: perContributionDeltas.slice(0, 16),
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      decay,
      pulseMult,
      regimeMult,
      deckHintTop,
      opportunityHintId: opportunityHint.id,
      weightedPickId: weightedPick.id,
      auditHash,
    },
  });

  if (shouldAutoUse && usedFee > 0) {
    emit({
      event: 'VAULT_COSMETIC_USED',
      mechanic_id: 'M130',
      tick,
      runId,
      payload: {
        teamId,
        usedFee,
        postBalance: balance,
        // deterministic “which cosmetic was showcased” via weighted pick id
        showcasedCosmeticHintId: weightedPick.id,
        auditHash,
      },
    });
  }

  emit({
    event: 'VAULT_BALANCE_UPDATED',
    mechanic_id: 'M130',
    tick,
    runId,
    payload: {
      teamId,
      vaultBalance: balance,
      sharedCosmeticUsable: computeUsable(balance, cfg),
      minBalanceToUse: cfg.minBalanceToUse,
      useFee: cfg.useFee,
      auditHash,
    },
  });

  return {
    vaultUpdated: true,
    sharedCosmeticUsable: computeUsable(balance, cfg),
    vaultBalance: balance,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M130MLInput {
  vaultUpdated?: boolean;
  sharedCosmeticUsable?: boolean;
  vaultBalance?: number;
  runId: string;
  tick: number;
}

export interface M130MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * tableVaultManagerMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function tableVaultManagerMLCompanion(input: M130MLInput): Promise<M130MLOutput> {
  const tick = clamp(typeof input.tick === 'number' ? input.tick : Number(input.tick), 0, RUN_TOTAL_TICKS);

  const updated = Boolean(input.vaultUpdated);
  const usable = Boolean(input.sharedCosmeticUsable);
  const balance = Math.max(0, toFiniteInt(input.vaultBalance, 0));

  const balanceScore = clamp(balance / 25_000, 0, 1) * 0.45;
  const usableScore = usable ? 0.25 : 0.0;
  const updatedScore = updated ? 0.15 : 0.0;

  const score = clamp(0.05 + balanceScore + usableScore + updatedScore, 0.01, 0.99);

  const topFactors: string[] = [];
  topFactors.push(updated ? 'Vault updated' : 'Vault not updated');
  topFactors.push(usable ? 'Shared cosmetics usable' : 'Shared cosmetics not usable');
  topFactors.push(`Balance: ${balance}`);
  topFactors.push('Table vault operational');
  topFactors.push(`Tick: ${tick}`);

  const recommendation =
    usable
      ? 'Expose vault balance + audit hash in the table lobby for trust and replay verification.'
      : 'Increase contributions or lower minBalanceToUse to activate shared cosmetics.';

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + `:ml:M130:${tick}:${M130_RULES_VERSION}`),
    confidenceDecay: 0.05,
  };
}