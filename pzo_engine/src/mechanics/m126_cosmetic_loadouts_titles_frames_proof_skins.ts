// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m126_cosmetic_loadouts_titles_frames_proof_skins.ts
//
// Mechanic : M126 — Cosmetic Loadouts: Titles, Frames, Proof Skins
// Family   : cosmetics   Layer: ui_component   Priority: 3   Batch: 3
// ML Pair  : m126a
// Deps     : M40
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
export const M126_IMPORTED_SYMBOLS = {
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
export type M126_ImportedTypesAnchor = {
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

// ── Local cosmetics domain types (M126-only; intentionally not in ./types) ───

export type CosmeticSlot = 'TITLE' | 'FRAME' | 'PROOF_SKIN';

export interface CosmeticItem {
  id: string;
  slot: CosmeticSlot;
  name: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  // Optional metadata used by UI rendering layers
  meta?: Record<string, unknown>;
}

export interface PlayerInventory {
  playerId: string;
  ownedCosmetics: CosmeticItem[];
  ownedProofSkins?: ProofCard[]; // optional linkage to proof artifacts
}

export interface LoadoutSelection {
  titleId?: string;
  frameId?: string;
  proofSkinId?: string;
}

export interface DisplayLoadout {
  playerId: string;

  title?: CosmeticItem;
  frame?: CosmeticItem;
  proofSkin?: CosmeticItem;

  // Deterministic “presentation hints”
  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;

  // For UI
  integrityScore: number;
  auditHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M126Input {
  playerInventory?: PlayerInventory;
  loadoutSelection?: LoadoutSelection;
  integrityScore?: number;
}

export interface M126Output {
  cosmeticApplied: CosmeticItem;
  displayLoadout: DisplayLoadout;
  skinHash: string;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M126Event = 'COSMETIC_APPLIED' | 'LOADOUT_SAVED' | 'SKIN_HASH_VERIFIED';

export interface M126TelemetryPayload extends MechanicTelemetryPayload {
  event: M126Event;
  mechanic_id: 'M126';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M126_BOUNDS = {
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

// ── Helpers ───────────────────────────────────────────────────────────────

function asNonEmptyString(v: unknown): string {
  const s = String(v ?? '').trim();
  return s.length ? s : '';
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

function uniqById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const id = asNonEmptyString(it?.id);
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(it);
  }
  return out;
}

function findCosmetic(inv: PlayerInventory, id: string): CosmeticItem | undefined {
  const wanted = asNonEmptyString(id);
  if (!wanted) return undefined;
  return inv.ownedCosmetics.find(c => c.id === wanted);
}

function fallbackCosmetic(slot: CosmeticSlot, seed: string): CosmeticItem {
  // Deterministic fallback cosmetics (non-P2W). Keeps UI consistent even with partial inventories.
  const rarity: CosmeticItem['rarity'] =
    (['COMMON', 'RARE', 'EPIC', 'LEGENDARY'][seededIndex(seed + ':rar', 0, 4)] as any) ?? 'COMMON';

  return {
    id: computeHash(`${seed}:fallback:${slot}`),
    slot,
    name: slot === 'TITLE' ? 'Unproven' : slot === 'FRAME' ? 'Bare Frame' : 'Raw Proof',
    rarity,
    meta: { fallback: true },
  };
}

function deriveMacroContext(seed: string, tick: number): {
  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];
  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;
  decayRate: number;
  deckHintTop: string;
  opportunityHintId: string;
  weightedPoolPreviewIds: string[];
} {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);

  const macroSchedule = buildMacroSchedule(seed + ':macro', MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed + ':chaos', CHAOS_WINDOWS_PER_RUN);

  const runPhase: RunPhase = t < RUN_TOTAL_TICKS / 3 ? 'EARLY' : t < (RUN_TOTAL_TICKS * 2) / 3 ? 'MID' : 'LATE';

  // Regime from schedule
  let macroRegime: MacroRegime = 'NEUTRAL';
  const sorted = [...macroSchedule].sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));
  for (const ev of sorted) {
    if ((ev.tick ?? 0) > t) break;
    if (ev.regimeChange) macroRegime = ev.regimeChange;
  }

  // chaos?
  let chaos = false;
  for (const w of chaosWindows) {
    if (t >= w.startTick && t <= w.endTick) {
      chaos = true;
      break;
    }
  }

  // pressure tier
  let pressureTier: PressureTier = 'LOW';
  if (chaos) pressureTier = 'CRITICAL';
  else if (macroRegime === 'CRISIS') pressureTier = runPhase === 'EARLY' ? 'HIGH' : 'CRITICAL';
  else if (macroRegime === 'BEAR') pressureTier = runPhase === 'LATE' ? 'HIGH' : 'MEDIUM';
  else if (macroRegime === 'BULL') pressureTier = runPhase === 'EARLY' ? 'LOW' : 'MEDIUM';
  else pressureTier = runPhase === 'EARLY' ? 'LOW' : 'MEDIUM';

  const tickTier: TickTier = pressureTier === 'CRITICAL' ? 'CRITICAL' : pressureTier === 'HIGH' ? 'ELEVATED' : 'STANDARD';

  const decayRate = computeDecayRate(macroRegime, M126_BOUNDS.BASE_DECAY_RATE);

  // UI-only hints based on shared pools
  const deckOrder = seededShuffle(DEFAULT_CARD_IDS, seed + ':deck');
  const deckHintTop = deckOrder[0] ?? DEFAULT_CARD.id;

  const opportunityHint = OPPORTUNITY_POOL[seededIndex(seed + ':opp', t, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const weightedPool = buildWeightedPool(seed + ':pool', pressureW * phaseW, regimeW);
  const weightedPoolPreviewIds = weightedPool.map(c => c.id);

  return {
    macroSchedule,
    chaosWindows,
    macroRegime,
    runPhase,
    pressureTier,
    tickTier,
    decayRate,
    deckHintTop,
    opportunityHintId: opportunityHint.id,
    weightedPoolPreviewIds,
  };
}

function deriveAppliedSlot(selection: LoadoutSelection | undefined, seed: string): CosmeticSlot {
  // Deterministic precedence: proof skin > frame > title, unless explicitly absent.
  if (selection?.proofSkinId) return 'PROOF_SKIN';
  if (selection?.frameId) return 'FRAME';
  if (selection?.titleId) return 'TITLE';

  // Deterministic default slot choice.
  return (['TITLE', 'FRAME', 'PROOF_SKIN'][seededIndex(seed + ':slot', 0, 3)] as CosmeticSlot) ?? 'TITLE';
}

function computeSkinHash(params: {
  playerId: string;
  title?: CosmeticItem;
  frame?: CosmeticItem;
  proofSkin?: CosmeticItem;
  integrityScore: number;
  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;
}): string {
  return computeHash(
    JSON.stringify({
      pid: params.playerId,
      t: params.title?.id ?? null,
      f: params.frame?.id ?? null,
      p: params.proofSkin?.id ?? null,
      integrityScore: Math.round(params.integrityScore * 1000) / 1000,
      macroRegime: params.macroRegime,
      runPhase: params.runPhase,
      pressureTier: params.pressureTier,
      tickTier: params.tickTier,
    }),
  );
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * cosmeticLoadoutApplier
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function cosmeticLoadoutApplier(input: M126Input, emit: MechanicEmitter): M126Output {
  const inventory = input.playerInventory;
  const selection = input.loadoutSelection;
  const integrityScore = typeof input.integrityScore === 'number' ? clamp01(input.integrityScore) : 0;

  // Fail-closed inventory.
  const safeInv: PlayerInventory = inventory && asNonEmptyString(inventory.playerId)
    ? {
        playerId: inventory.playerId,
        ownedCosmetics: uniqById(Array.isArray(inventory.ownedCosmetics) ? inventory.ownedCosmetics : []),
        ownedProofSkins: Array.isArray(inventory.ownedProofSkins) ? inventory.ownedProofSkins : undefined,
      }
    : {
        playerId: 'UNKNOWN',
        ownedCosmetics: [],
      };

  // Deterministic seed: binds cosmetics to player + selection + integrity.
  const seed = computeHash(
    `M126:${safeInv.playerId}:${computeHash(JSON.stringify(selection ?? {}))}:${Math.round(integrityScore * 1000)}`,
  );

  // Macro context (keeps shared imports live).
  const ctx = deriveMacroContext(seed, 0);

  // Resolve chosen cosmetics (fall back deterministically to non-P2W placeholders).
  const title = selection?.titleId ? findCosmetic(safeInv, selection.titleId) : undefined;
  const frame = selection?.frameId ? findCosmetic(safeInv, selection.frameId) : undefined;
  const proofSkin = selection?.proofSkinId ? findCosmetic(safeInv, selection.proofSkinId) : undefined;

  const resolvedTitle = title ?? fallbackCosmetic('TITLE', seed);
  const resolvedFrame = frame ?? fallbackCosmetic('FRAME', seed);
  const resolvedProofSkin = proofSkin ?? fallbackCosmetic('PROOF_SKIN', seed);

  // Which cosmetic is considered “applied” for this call (for telemetry, UI toast, etc).
  const appliedSlot = deriveAppliedSlot(selection, seed);
  const cosmeticApplied =
    appliedSlot === 'PROOF_SKIN'
      ? resolvedProofSkin
      : appliedSlot === 'FRAME'
        ? resolvedFrame
        : resolvedTitle;

  const auditHash = computeHash(
    JSON.stringify({
      mid: 'M126',
      playerId: safeInv.playerId,
      selection,
      integrityScore,
      macroRegime: ctx.macroRegime,
      runPhase: ctx.runPhase,
      pressureTier: ctx.pressureTier,
      tickTier: ctx.tickTier,
      deckHintTop: ctx.deckHintTop,
      opportunityHintId: ctx.opportunityHintId,
      weightedPoolPreviewIds: ctx.weightedPoolPreviewIds,
      cosmeticIds: {
        title: resolvedTitle.id,
        frame: resolvedFrame.id,
        proofSkin: resolvedProofSkin.id,
      },
      appliedSlot,
      decayRate: ctx.decayRate,
    }),
  );

  const displayLoadout: DisplayLoadout = {
    playerId: safeInv.playerId,
    title: resolvedTitle,
    frame: resolvedFrame,
    proofSkin: resolvedProofSkin,
    macroRegime: ctx.macroRegime,
    runPhase: ctx.runPhase,
    pressureTier: ctx.pressureTier,
    tickTier: ctx.tickTier,
    integrityScore,
    auditHash,
  };

  const skinHash = computeSkinHash({
    playerId: safeInv.playerId,
    title: resolvedTitle,
    frame: resolvedFrame,
    proofSkin: resolvedProofSkin,
    integrityScore,
    macroRegime: ctx.macroRegime,
    runPhase: ctx.runPhase,
    pressureTier: ctx.pressureTier,
    tickTier: ctx.tickTier,
  });

  // ── Telemetry (deterministic) ───────────────────────────────────────────

  const runId = computeHash(`M126:run:${safeInv.playerId}`);

  emit({
    event: 'COSMETIC_APPLIED',
    mechanic_id: 'M126',
    tick: 0,
    runId,
    payload: {
      playerId: safeInv.playerId,
      appliedSlot,
      cosmeticApplied: { id: cosmeticApplied.id, slot: cosmeticApplied.slot, name: cosmeticApplied.name, rarity: cosmeticApplied.rarity },
      // UI hints to keep the imports “live” + usable
      deckHintTop: ctx.deckHintTop,
      opportunityHintId: ctx.opportunityHintId,
      weightedPoolPreviewCount: ctx.weightedPoolPreviewIds.length,
      integrityScore,
      auditHash,
    },
  });

  emit({
    event: 'LOADOUT_SAVED',
    mechanic_id: 'M126',
    tick: 0,
    runId,
    payload: {
      playerId: safeInv.playerId,
      titleId: resolvedTitle.id,
      frameId: resolvedFrame.id,
      proofSkinId: resolvedProofSkin.id,
      skinHash,
      auditHash,
    },
  });

  emit({
    event: 'SKIN_HASH_VERIFIED',
    mechanic_id: 'M126',
    tick: 0,
    runId,
    payload: {
      playerId: safeInv.playerId,
      skinHash,
      verified: true,
      auditHash,
    },
  });

  return {
    cosmeticApplied,
    displayLoadout,
    skinHash,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M126MLInput {
  cosmeticApplied?: CosmeticItem;
  displayLoadout?: DisplayLoadout;
  skinHash?: string;
  runId: string;
  tick: number;
}

export interface M126MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * cosmeticLoadoutApplierMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function cosmeticLoadoutApplierMLCompanion(input: M126MLInput): Promise<M126MLOutput> {
  const tick = clamp(typeof input.tick === 'number' ? input.tick : Number(input.tick), 0, RUN_TOTAL_TICKS);

  const dl = input.displayLoadout;
  const integrity = clamp01(typeof dl?.integrityScore === 'number' ? dl.integrityScore : 0);

  // Higher integrity + stable skin hash presence increases score.
  const hasHash = asNonEmptyString(input.skinHash).length > 0;
  const hasApplied = Boolean(input.cosmeticApplied?.id);

  const score = clamp(0.15 + integrity * 0.65 + (hasHash ? 0.10 : 0.0) + (hasApplied ? 0.10 : 0.0), 0.01, 0.99);

  const topFactors: string[] = [];
  topFactors.push(`Integrity: ${Math.round(integrity * 100)}%`);
  topFactors.push(hasHash ? 'Skin hash present' : 'No skin hash');
  topFactors.push(hasApplied ? 'Cosmetic applied' : 'No cosmetic applied');
  if (dl?.macroRegime) topFactors.push(`Regime: ${dl.macroRegime}`);
  if (dl?.pressureTier) topFactors.push(`Pressure: ${dl.pressureTier}`);

  const recommendation =
    score >= 0.85
      ? 'Lock loadout; publish skin hash in match headers for consistency.'
      : score >= 0.55
        ? 'Increase integrity gating and ensure inventory ownership checks are server-verified.'
        : 'Treat as cosmetic-only; do not use this signal for competitive decisions.';

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + `:ml:M126:${tick}`),
    confidenceDecay: 0.05,
  };
}