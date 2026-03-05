// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m127_proof_bound_crafting_craft_from_verified_fragments.ts
//
// Mechanic : M127 — Proof-Bound Crafting: Craft from Verified Fragments
// Family   : cosmetics   Layer: backend_service   Priority: 3   Batch: 3
// ML Pair  : m127a
// Deps     : M50, M40
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
export const M127_IMPORTED_SYMBOLS = {
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
export type M127_ImportedTypesAnchor = {
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

// ── Local crafting domain types (M127-only; intentionally not in ./types) ─────

export type CraftedRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export interface CraftingRecipe {
  recipeId: string;
  name?: string;

  /** Required verified fragments to consume (bounded). */
  requiredCount: number;

  /** If true, consumes *all* verified fragments (bounded by cap). */
  consumeAll?: boolean;

  /** Optional salt to diversify crafted outputs deterministically. */
  salt?: string;

  /** Optional max fragments consumed (hard cap) for safety. */
  maxConsumeCap?: number;
}

export interface CraftedItem {
  id: string;
  recipeId: string;
  name: string;
  rarity: CraftedRarity;
  meta: Record<string, unknown>;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M127Input {
  verifiedFragments?: string[];
  craftingRecipe?: CraftingRecipe;
  fragmentHashes?: unknown;
}

export interface M127Output {
  craftedItem: CraftedItem;
  craftingProof: string;
  fragmentsConsumed: string[];
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M127Event = 'CRAFTING_INITIATED' | 'CRAFTING_COMPLETED' | 'FRAGMENTS_VERIFIED';

export interface M127TelemetryPayload extends MechanicTelemetryPayload {
  event: M127Event;
  mechanic_id: 'M127';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M127_BOUNDS = {
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

  // crafting-specific safety caps
  MAX_FRAGMENTS_IN: 256,
  MAX_CONSUME_CAP: 64,
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────

const M127_RULES_VERSION = 'M127:v1';

function asString(v: unknown): string {
  return String(v ?? '').trim();
}

function uniqStrings(xs: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    const s = asString(x);
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function parseRecipe(v: unknown): CraftingRecipe {
  if (!v || typeof v !== 'object') {
    return {
      recipeId: computeHash(`M127:recipe:default:${M127_RULES_VERSION}`),
      name: 'Default Craft',
      requiredCount: 3,
      consumeAll: false,
      salt: 'default',
      maxConsumeCap: M127_BOUNDS.MAX_CONSUME_CAP,
    };
  }

  const o = v as any;
  const recipeId = asString(o.recipeId) || computeHash(`M127:recipe:unnamed:${M127_RULES_VERSION}`);
  const requiredCount = clamp(Number.isFinite(Number(o.requiredCount)) ? Math.trunc(Number(o.requiredCount)) : 3, 1, M127_BOUNDS.MAX_CONSUME_CAP);
  const consumeAll = Boolean(o.consumeAll);
  const salt = asString(o.salt) || 'recipe';
  const maxConsumeCap = clamp(
    Number.isFinite(Number(o.maxConsumeCap)) ? Math.trunc(Number(o.maxConsumeCap)) : M127_BOUNDS.MAX_CONSUME_CAP,
    1,
    M127_BOUNDS.MAX_CONSUME_CAP,
  );

  return {
    recipeId,
    name: asString(o.name) || 'Craft',
    requiredCount,
    consumeAll,
    salt,
    maxConsumeCap,
  };
}

/**
 * fragmentHashes can be:
 * - Record<string, string> { fragmentId: hash }
 * - Array<{ id: string, hash: string }>
 * - Array<[id, hash]>
 * Anything else: treated as absent.
 */
function normalizeFragmentHashes(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};

  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const id = asString(k);
      const hash = asString(val);
      if (!id || !hash) continue;
      out[id] = hash;
    }
    return out;
  }

  if (Array.isArray(v)) {
    for (const entry of v) {
      if (Array.isArray(entry) && entry.length >= 2) {
        const id = asString(entry[0]);
        const hash = asString(entry[1]);
        if (!id || !hash) continue;
        out[id] = hash;
        continue;
      }
      if (entry && typeof entry === 'object') {
        const e = entry as any;
        const id = asString(e.id);
        const hash = asString(e.hash);
        if (!id || !hash) continue;
        out[id] = hash;
      }
    }
  }

  return out;
}

/**
 * Deterministic expected hash for a fragment id.
 * Note: server can reproduce this exactly; mismatch means “not verified”.
 */
function expectedFragmentHash(fragmentId: string): string {
  return computeHash(`${fragmentId}:FRAGMENT:${M127_RULES_VERSION}`);
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

function computeRarity(seed: string, pressure: PressureTier, regime: MacroRegime): CraftedRarity {
  const pW = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const rW = REGIME_WEIGHTS[regime] ?? 1.0;
  const base = clamp((pW * 0.6 + rW * 0.4) / 2, 0, 1);
  const roll = (parseInt(computeHash(seed + ':rarity'), 16) % 10_000) / 10_000;

  if (roll < base * 0.06) return 'LEGENDARY';
  if (roll < base * 0.18) return 'EPIC';
  if (roll < base * 0.45) return 'RARE';
  return 'COMMON';
}

function selectConsumedFragments(params: { verified: string[]; seed: string; recipe: CraftingRecipe }): string[] {
  const cap = clamp(params.recipe.maxConsumeCap ?? M127_BOUNDS.MAX_CONSUME_CAP, 1, M127_BOUNDS.MAX_CONSUME_CAP);
  const pool = params.verified.slice(0, M127_BOUNDS.MAX_FRAGMENTS_IN);

  if (pool.length === 0) return [];

  const shuffled = seededShuffle(pool, params.seed + ':fragments');
  if (params.recipe.consumeAll) return shuffled.slice(0, cap);

  const n = clamp(params.recipe.requiredCount, 1, cap);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

function chooseThemeCard(seed: string, tick: number, pressureW: number, phaseW: number, regimeW: number): GameCard {
  // Keep all shared pools live: weighted pool + opportunity pool
  const weighted = buildWeightedPool(seed + ':cards', pressureW * phaseW, regimeW);
  const pickA = weighted[seededIndex(seed + ':weighted', tick + 11, Math.max(1, weighted.length))] ?? DEFAULT_CARD;
  const pickB = OPPORTUNITY_POOL[seededIndex(seed + ':opp', tick + 19, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  // Deterministic blend: pick one based on hash parity.
  const parity = (parseInt(computeHash(seed + ':blend'), 16) & 1) === 1;
  return parity ? pickA : pickB;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * proofBoundCraftingEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function proofBoundCraftingEngine(input: M127Input, emit: MechanicEmitter): M127Output {
  // Sanitize inputs
  const verifiedFragmentsIn = uniqStrings(Array.isArray(input.verifiedFragments) ? input.verifiedFragments : []);
  const recipe = parseRecipe(input.craftingRecipe);
  const hashes = normalizeFragmentHashes(input.fragmentHashes);

  // Deterministic service hash / runId
  const serviceHash = computeHash(
    JSON.stringify({
      mid: 'M127',
      v: M127_RULES_VERSION,
      verifiedFragmentsIn,
      recipe,
      hashes: Object.keys(hashes).length ? hashes : null,
    }),
  );

  const tick = 0;

  // Macro fabric (keeps shared imports live)
  const macroSchedule = buildMacroSchedule(serviceHash + ':macro', MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(serviceHash + ':chaos', CHAOS_WINDOWS_PER_RUN);

  const runPhase = deriveRunPhase(tick);
  const macroRegime = deriveMacroRegime(tick, macroSchedule);
  const chaos = inChaosWindow(tick, chaosWindows);

  const pressureTier = derivePressureTier(runPhase, macroRegime, chaos);
  const tickTier = deriveTickTier(pressureTier);

  const decay = computeDecayRate(macroRegime, M127_BOUNDS.BASE_DECAY_RATE);
  const pulseMult = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  // Verify fragments against hashes (server-verifiable, deterministic)
  const verifiedFragments: string[] = [];
  const rejectedFragments: string[] = [];

  if (Object.keys(hashes).length) {
    for (const id of verifiedFragmentsIn) {
      const provided = hashes[id];
      const expected = expectedFragmentHash(id);
      if (provided && provided === expected) verifiedFragments.push(id);
      else rejectedFragments.push(id);
    }
  } else {
    // If no hashes provided, treat input list as already verified (still deterministic).
    verifiedFragments.push(...verifiedFragmentsIn);
  }

  // Deterministic ordering baseline used by other systems (keeps DEFAULT_CARD_IDS live)
  const baselineDeck = seededShuffle(DEFAULT_CARD_IDS, serviceHash + ':baseline_deck');
  const baselineDeckHead = baselineDeck[0] ?? DEFAULT_CARD.id;

  // Determine fragments to consume for this craft
  const fragmentsConsumed = selectConsumedFragments({
    verified: verifiedFragments,
    seed: computeHash(`${serviceHash}:${recipe.recipeId}:${recipe.salt ?? ''}`),
    recipe,
  });

  // Theme selection binds craft aesthetics to macro texture (keeps pools live)
  const themeCard = chooseThemeCard(
    serviceHash + ':theme',
    tick,
    pressureW,
    phaseW,
    regimeW,
  );

  // Crafted item derivation (deterministic)
  const rarity = computeRarity(serviceHash + ':rarity:' + recipe.recipeId, pressureTier, macroRegime);

  const craftedItem: CraftedItem = {
    id: computeHash(
      JSON.stringify({
        mid: 'M127',
        recipeId: recipe.recipeId,
        consumed: fragmentsConsumed,
        theme: themeCard.id,
        rarity,
        v: M127_RULES_VERSION,
      }),
    ),
    recipeId: recipe.recipeId,
    name: `${recipe.name ?? 'Craft'} — ${themeCard.name}`,
    rarity,
    meta: {
      rulesVersion: M127_RULES_VERSION,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      decay,
      pulseMult,
      regimeMult,
      themeCard: { id: themeCard.id, name: themeCard.name, type: themeCard.type },
      baselineDeckHead,
      verifiedFragmentsIn: verifiedFragmentsIn.length,
      verifiedFragments: verifiedFragments.length,
      rejectedFragments: rejectedFragments.length,
      consumedCount: fragmentsConsumed.length,
      consumeAll: Boolean(recipe.consumeAll),
      requiredCount: recipe.requiredCount,
      maxConsumeCap: recipe.maxConsumeCap ?? M127_BOUNDS.MAX_CONSUME_CAP,
    },
  };

  const craftingProof = computeHash(
    JSON.stringify({
      mid: 'M127',
      v: M127_RULES_VERSION,
      serviceHash,
      recipeId: recipe.recipeId,
      fragmentsConsumed,
      craftedItemId: craftedItem.id,
      rarity,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      decay,
      pulseMult,
      regimeMult,
      themeCardId: themeCard.id,
    }),
  );

  // ── Telemetry (deterministic; server can re-derive proofs) ───────────────

  emit({
    event: 'CRAFTING_INITIATED',
    mechanic_id: 'M127',
    tick,
    runId: serviceHash,
    payload: {
      recipeId: recipe.recipeId,
      verifiedFragmentsIn: verifiedFragmentsIn.length,
      hasHashes: Object.keys(hashes).length > 0,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      baselineDeckHead,
      themeCardId: themeCard.id,
      serviceHash,
    },
  });

  emit({
    event: 'FRAGMENTS_VERIFIED',
    mechanic_id: 'M127',
    tick,
    runId: serviceHash,
    payload: {
      verifiedCount: verifiedFragments.length,
      rejectedCount: rejectedFragments.length,
      consumedCount: fragmentsConsumed.length,
      rejectedPreview: rejectedFragments.slice(0, 8),
      expectedHashRule: `expectedFragmentHash(id)=SHA256("${'${id}'}:FRAGMENT:${M127_RULES_VERSION}")`,
      serviceHash,
    },
  });

  emit({
    event: 'CRAFTING_COMPLETED',
    mechanic_id: 'M127',
    tick,
    runId: serviceHash,
    payload: {
      craftedItemId: craftedItem.id,
      rarity,
      fragmentsConsumed,
      craftingProof,
      serviceHash,
    },
  });

  return {
    craftedItem,
    craftingProof,
    fragmentsConsumed,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M127MLInput {
  craftedItem?: CraftedItem;
  craftingProof?: string;
  fragmentsConsumed?: string[];
  runId: string;
  tick: number;
}

export interface M127MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * proofBoundCraftingEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function proofBoundCraftingEngineMLCompanion(input: M127MLInput): Promise<M127MLOutput> {
  const tick = clamp(typeof input.tick === 'number' ? input.tick : Number(input.tick), 0, RUN_TOTAL_TICKS);

  const crafted = input.craftedItem;
  const proof = asString(input.craftingProof);
  const consumed = Array.isArray(input.fragmentsConsumed) ? input.fragmentsConsumed.length : 0;

  const rarity = (crafted?.rarity ?? 'COMMON') as CraftedRarity;

  const rarityScore =
    rarity === 'LEGENDARY' ? 0.35 :
    rarity === 'EPIC' ? 0.25 :
    rarity === 'RARE' ? 0.15 : 0.05;

  const proofScore = proof.length > 0 ? 0.25 : 0.0;
  const consumptionScore = clamp(consumed / 12, 0, 1) * 0.25;
  const hasCrafted = crafted?.id ? 0.15 : 0.0;

  const score = clamp(0.05 + rarityScore + proofScore + consumptionScore + hasCrafted, 0.01, 0.99);

  const topFactors: string[] = [];
  topFactors.push(`Rarity: ${rarity}`);
  topFactors.push(proof.length ? 'Crafting proof present' : 'No crafting proof');
  topFactors.push(`Fragments consumed: ${consumed}`);
  topFactors.push(crafted?.id ? 'Crafted item present' : 'No crafted item');
  topFactors.push(`Tick: ${tick}`);

  const recommendation =
    proof.length && crafted?.id
      ? 'Persist craftingProof + fragmentsConsumed to the ledger for dispute-proof verification.'
      : 'Block persistence until craftedItem + craftingProof are both present.';

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + `:ml:M127:${tick}:${M127_RULES_VERSION}`),
    confidenceDecay: 0.05,
  };
}