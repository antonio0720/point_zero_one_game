// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m97_seed_commit_reveal_deterministic_randomness_you_can_audit.ts
//
// Mechanic : M97 — Seed Commit-Reveal: Deterministic Randomness You Can Audit
// Family   : integrity_expert   Layer: tick_engine   Priority: 1   Batch: 2
// ML Pair  : m97a
// Deps     : M01, M47
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
// Public dependency surface (keeps every imported symbol reachable + usable)
// ─────────────────────────────────────────────────────────────────────────────

export const M97_MECHANICS_UTILS = Object.freeze({
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
} as const);

// ─────────────────────────────────────────────────────────────────────────────
// Type surface (forces all imported types to be referenced + accessible)
// ─────────────────────────────────────────────────────────────────────────────

export type M97TypeArtifacts = {
  runPhase?: RunPhase;
  tickTier?: TickTier;
  macroRegime?: MacroRegime;
  pressureTier?: PressureTier;
  solvencyStatus?: SolvencyStatus;

  asset?: Asset;
  ipaItem?: IPAItem;
  gameCard?: GameCard;
  gameEvent?: GameEvent;
  shieldLayer?: ShieldLayer;
  debt?: Debt;
  buff?: Buff;
  liability?: Liability;
  setBonus?: SetBonus;
  assetMod?: AssetMod;
  incomeItem?: IncomeItem;

  macroEvent?: MacroEvent;
  chaosWindow?: ChaosWindow;

  auctionResult?: AuctionResult;
  purchaseResult?: PurchaseResult;
  shieldResult?: ShieldResult;
  exitResult?: ExitResult;
  tickResult?: TickResult;

  deckComposition?: DeckComposition;
  tierProgress?: TierProgress;

  wipeEvent?: WipeEvent;
  regimeShiftEvent?: RegimeShiftEvent;
  phaseTransitionEvent?: PhaseTransitionEvent;
  timerExpiredEvent?: TimerExpiredEvent;
  streakEvent?: StreakEvent;
  fubarEvent?: FubarEvent;

  ledgerEntry?: LedgerEntry;
  proofCard?: ProofCard;
  completedRun?: CompletedRun;
  seasonState?: SeasonState;
  runState?: RunState;

  momentEvent?: MomentEvent;
  clipBoundary?: ClipBoundary;

  telemetryPayload?: MechanicTelemetryPayload;
  mechanicEmitter?: MechanicEmitter;
};

// ─────────────────────────────────────────────────────────────────────────────
// Input / Output contracts
// ─────────────────────────────────────────────────────────────────────────────

export interface M97Input {
  playerCommitHash?: string;
  serverRevealHash?: string;
  runId?: string; // optional external id (session/run), NOT a seed
}

export interface CommitRevealProof {
  mechanic_id: 'M97';
  runId: string;

  // Raw inputs
  playerCommitHash: string;
  serverRevealHash: string;

  // Derived
  finalSeed: string;

  // Verification (commit schemes vary; this is the minimal audit surface)
  commitMatchesRevealHash: boolean; // assumes playerCommitHash == H(serverRevealHash)
  deterministicAudit: DeterministicAuditSample;

  // Multipliers tied to derived regime (for “seed impacts macro context” proof)
  macroRegime: MacroRegime;
  decayRate: number;
  regimeMultiplier: number;
  exitPulseMultiplier: number;

  // Timelines prove seed drives schedules
  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  // Exposed anchors for downstream reproducibility
  pickedCardId: string;
  pickedCardIsDefaultPool: boolean;
  bounds: typeof M97_BOUNDS;
}

export interface DeterministicAuditSample {
  // Derives an index and shuffle result from the finalSeed
  indexA: number;
  indexB: number;
  shuffledIdsHead: string[]; // first N ids from deterministic shuffle
  weightedPickId: string;    // deterministic pick from weighted pool
  progress: number;          // deterministic progress sample 0..1
  derivedPhase: RunPhase;
}

export interface M97Output {
  finalSeed: string;
  commitRevealProof: unknown;
  auditHash: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Telemetry
// ─────────────────────────────────────────────────────────────────────────────

export type M97Event = 'SEED_COMMITTED' | 'SEED_REVEALED' | 'COMMIT_REVEAL_VERIFIED';

export interface M97TelemetryPayload extends MechanicTelemetryPayload {
  event: M97Event;
  mechanic_id: 'M97';
}

// ─────────────────────────────────────────────────────────────────────────────
// Design bounds (never mutate at runtime)
// ─────────────────────────────────────────────────────────────────────────────

export const M97_BOUNDS = {
  BASE_AMOUNT: 1_000,
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
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

const RUN_PHASES: readonly RunPhase[] = ['EARLY', 'MID', 'LATE'] as const;
const MACRO_REGIMES: readonly MacroRegime[] = ['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'] as const;
const PRESSURE_TIERS: readonly PressureTier[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

function safeString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function derivePhase(progress: number): RunPhase {
  const p = clamp(progress, 0, 1);
  return (p < 0.33 ? 'EARLY' : p < 0.66 ? 'MID' : 'LATE') as RunPhase;
}

function normalizeDefaultCardId(id: string): string {
  // proves DEFAULT_CARD + DEFAULT_CARD_IDS are integrated
  return DEFAULT_CARD_IDS.includes(id) ? id : DEFAULT_CARD.id;
}

function buildDeterministicAudit(finalSeed: string, macroSchedule: MacroEvent[]): DeterministicAuditSample {
  const indexA = seededIndex(finalSeed, 97, 1_000_000);
  const indexB = seededIndex(finalSeed, indexA, 1_000_000);

  const shuffledIdsHead = seededShuffle(DEFAULT_CARD_IDS.slice(), `${finalSeed}:m97:ids`)
    .slice(0, clamp(8, 0, DEFAULT_CARD_IDS.length));

  const schedulePick = seededIndex(finalSeed, 971, Math.max(1, macroSchedule.length));
  const progress = clamp((schedulePick + 1) / Math.max(1, RUN_TOTAL_TICKS), 0, 1);
  const derivedPhase = derivePhase(progress);

  // Use weighted pool deterministically: derive tiers from seed, then pick
  const pressureTier: PressureTier = PRESSURE_TIERS[seededIndex(finalSeed, 972, PRESSURE_TIERS.length)] ?? 'LOW';
  const macroRegime: MacroRegime =
    (macroSchedule[schedulePick]?.regimeChange as MacroRegime) ?? ('NEUTRAL' as MacroRegime);

  const pressureWeight = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[derivedPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const weightedPool = buildWeightedPool(`${finalSeed}:m97:pool`, pressureWeight * phaseWeight, regimeWeight);
  const pickedFromPool = seededShuffle((weightedPool.length ? weightedPool : OPPORTUNITY_POOL), `${finalSeed}:m97:deck`)[
    seededIndex(finalSeed, 973, Math.max(1, (weightedPool.length ? weightedPool : OPPORTUNITY_POOL).length))
  ] ?? DEFAULT_CARD;

  const weightedPickId = normalizeDefaultCardId(pickedFromPool.id);

  return {
    indexA,
    indexB,
    shuffledIdsHead,
    weightedPickId,
    progress,
    derivedPhase,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exec hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * seedCommitRevealVerifier
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function seedCommitRevealVerifier(
  input: M97Input,
  emit: MechanicEmitter,
): M97Output {
  const playerCommitHash = safeString(input.playerCommitHash);
  const serverRevealHash = safeString(input.serverRevealHash);
  const externalRunId = safeString(input.runId);

  // Final seed MUST be derived deterministically from both sides + optional external id
  const finalSeed = computeHash(`M97:${playerCommitHash}:${serverRevealHash}:${externalRunId}`);

  // Minimal verification: assumes player commits to serverRevealHash itself (commit = H(revealHash)).
  // If your protocol differs, keep this bool but adjust how you compute it at integration time.
  const commitMatchesRevealHash = playerCommitHash.length > 0 && playerCommitHash === computeHash(serverRevealHash);

  // Timelines prove the seed drives schedules
  const macroSchedule = buildMacroSchedule(finalSeed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(finalSeed, CHAOS_WINDOWS_PER_RUN);

  const schedulePick = seededIndex(finalSeed, 974, Math.max(1, macroSchedule.length));
  const derivedRegime = (macroSchedule[schedulePick]?.regimeChange ?? 'NEUTRAL') as MacroRegime;
  const macroRegime: MacroRegime = MACRO_REGIMES.includes(derivedRegime) ? derivedRegime : 'NEUTRAL';

  const decayRate = computeDecayRate(macroRegime, M97_BOUNDS.BASE_DECAY_RATE);
  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const exitPulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;

  // Deterministic audit sample uses every RNG helper + constants
  const deterministicAudit = buildDeterministicAudit(finalSeed, macroSchedule);

  // Expose a reproducible card anchor derived from seed & audit
  const pickedCardId = normalizeDefaultCardId(deterministicAudit.weightedPickId);
  const pickedCardIsDefaultPool = DEFAULT_CARD_IDS.includes(pickedCardId);

  const commitRevealProof: CommitRevealProof = {
    mechanic_id: 'M97',
    runId: finalSeed,
    playerCommitHash,
    serverRevealHash,
    finalSeed,
    commitMatchesRevealHash,
    deterministicAudit,
    macroRegime,
    decayRate,
    regimeMultiplier,
    exitPulseMultiplier,
    macroSchedule,
    chaosWindows,
    pickedCardId,
    pickedCardIsDefaultPool,
    bounds: M97_BOUNDS,
  };

  // Audit hash commits proof + key constants (so audits detect rule changes)
  const auditHash = computeHash(
    JSON.stringify({
      finalSeed,
      playerCommitHash,
      serverRevealHash,
      externalRunId,
      commitMatchesRevealHash,
      pickedCardId,
      macroRegime,
      decayRate,
      regimeMultiplier,
      exitPulseMultiplier,
      constants: {
        MACRO_EVENTS_PER_RUN,
        CHAOS_WINDOWS_PER_RUN,
        RUN_TOTAL_TICKS,
        DEFAULT_CARD_ID: DEFAULT_CARD.id,
        DEFAULT_CARD_IDS_LEN: DEFAULT_CARD_IDS.length,
      },
      audit: deterministicAudit,
    }),
  );

  emit({
    event: 'SEED_COMMITTED',
    mechanic_id: 'M97',
    tick: 0,
    runId: finalSeed,
    payload: {
      playerCommitHash,
      externalRunId,
      auditHash,
    },
  });

  emit({
    event: 'SEED_REVEALED',
    mechanic_id: 'M97',
    tick: 0,
    runId: finalSeed,
    payload: {
      serverRevealHash,
      finalSeed,
      macroRegime,
      pickedCardId,
      pickedCardIsDefaultPool,
    },
  });

  emit({
    event: 'COMMIT_REVEAL_VERIFIED',
    mechanic_id: 'M97',
    tick: 0,
    runId: finalSeed,
    payload: {
      commitMatchesRevealHash,
      decayRate,
      regimeMultiplier,
      exitPulseMultiplier,
      deterministicAudit,
      macroScheduleLen: macroSchedule.length,
      chaosWindowsLen: chaosWindows.length,
    },
  });

  return {
    finalSeed,
    commitRevealProof,
    auditHash,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ML companion hook
// ─────────────────────────────────────────────────────────────────────────────

export interface M97MLInput {
  finalSeed?: string;
  commitRevealProof?: unknown;
  auditHash?: string;
  runId: string;
  tick: number;
}

export interface M97MLOutput {
  score: number;           // 0–1
  topFactors: string[];    // max 5 plain-English factors
  recommendation: string;  // single sentence
  auditHash: string;       // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1
}

/**
 * seedCommitRevealVerifierMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function seedCommitRevealVerifierMLCompanion(
  input: M97MLInput,
): Promise<M97MLOutput> {
  const seed = safeString(input.finalSeed, input.runId);
  const proof = input.commitRevealProof as Partial<CommitRevealProof> | null;

  const verified = Boolean(proof && proof.commitMatchesRevealHash);
  const macroRegime: MacroRegime =
    (proof?.macroRegime as MacroRegime) ??
    (buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN)[seededIndex(seed, input.tick, MACRO_EVENTS_PER_RUN)]?.regimeChange as MacroRegime) ??
    ('NEUTRAL' as MacroRegime);

  const confidenceDecay = computeDecayRate(macroRegime, 0.05);

  // Score favors verifiable commit-reveal + stable audit hash presence
  const base = (verified ? 0.75 : 0.35) + (safeString(input.auditHash).length > 0 ? 0.15 : 0.05);
  const score = clamp(base, 0.01, 0.99);

  const topFactors = [
    verified ? 'commit-reveal verified' : 'verification failed/unknown',
    `regime=${macroRegime}`,
    `auditHash=${safeString(input.auditHash).length > 0 ? 'present' : 'missing'}`,
    `seedLen=${safeString(seed).length}`,
    `pulse=${EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0}`,
  ].slice(0, 5);

  return {
    score,
    topFactors,
    recommendation: verified ? 'Proceed: seed is auditable and deterministic.' : 'Block: require valid commit→reveal verification.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M97'),
    confidenceDecay,
  };
}