// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m81_synergy_tree_paths_branching_portfolio_identity.ts
//
// Mechanic : M81 — Synergy Tree Paths: Branching Portfolio Identity
// Family   : portfolio_expert   Layer: card_handler   Priority: 2   Batch: 2
// ML Pair  : m81a
// Deps     : M31, M56
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
export const M81_IMPORTED_SYMBOLS = {
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
export type M81_ImportedTypesAnchor = {
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

// ── Local domain types (standalone; no forced edits to ./types.ts) ──────────

export type SynergyPathId = string;

export interface SynergyNodeDef {
  id: string;
  label: string;
  requiresTags?: string[]; // derived from assets/cards (optional)
  requiresAssetKinds?: string[]; // derived from assets (optional)
  minAssets?: number; // minimum asset count gate
  weight?: number; // selection bias (optional)
  grantsBadge?: string; // optional identity badge override
}

export interface SynergyTreeDef {
  rootPath?: SynergyPathId;
  nodes?: SynergyNodeDef[]; // flattened nodes; selection picks one active node path per resolution
  // Optional doctrine mapping (player choice biases selection deterministically)
  doctrineWeights?: Record<string, Record<string, number>>; // doctrineKey -> nodeId -> weight
}

export interface SynergyResolution {
  activePath: SynergyPathId;
  branchUnlocked: boolean;
  identityBadge: string;

  tick: number;
  phase: RunPhase;
  regime: MacroRegime;
  pressureTier: PressureTier;
  inChaos: boolean;

  seed: string;
  auditHash: string;

  // signals
  candidates: Array<{ nodeId: string; score: number; picked: boolean }>;
  effectScore: number;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M81Input {
  stateAssets?: Asset[];
  synergyTreeDef?: SynergyTreeDef;
  playerDoctrineChoice?: unknown;

  // Optional execution context (safe to omit)
  tick?: number;
  runId?: string;
  pressureTier?: PressureTier;

  // Optional portfolio identity tags from upstream (safe to omit)
  portfolioTags?: string[];
}

export interface M81Output {
  activePath: string;
  branchUnlocked: boolean;
  identityBadge: string;
  resolution?: SynergyResolution;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M81Event = 'SYNERGY_BRANCH_UNLOCKED' | 'IDENTITY_FORGED' | 'PATH_LOCKED';

export interface M81TelemetryPayload extends MechanicTelemetryPayload {
  event: M81Event;
  mechanic_id: 'M81';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M81_BOUNDS = {
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

function m81DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m81DeriveRegime(tick: number, schedule: MacroEvent[]): MacroRegime {
  const sorted = [...(schedule ?? [])].sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m81InChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows ?? []) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m81DerivePressureTier(proxy: number, inChaos: boolean): PressureTier {
  if (inChaos) return proxy >= 6 ? 'CRITICAL' : 'HIGH';
  if (proxy <= 2) return 'LOW';
  if (proxy <= 5) return 'MEDIUM';
  if (proxy <= 8) return 'HIGH';
  return 'CRITICAL';
}

function m81NormalizeTree(def?: SynergyTreeDef): Required<Pick<SynergyTreeDef, 'rootPath' | 'nodes' | 'doctrineWeights'>> {
  const rootPath = String(def?.rootPath ?? 'ROOT');
  const nodes: SynergyNodeDef[] = Array.isArray(def?.nodes) && def!.nodes!.length
    ? def!.nodes!.map(n => ({
        id: String(n.id),
        label: String(n.label ?? n.id),
        requiresTags: Array.isArray(n.requiresTags) ? n.requiresTags.map(String) : [],
        requiresAssetKinds: Array.isArray(n.requiresAssetKinds) ? n.requiresAssetKinds.map(String) : [],
        minAssets: Math.max(0, Math.floor(Number(n.minAssets ?? 0))),
        weight: Number.isFinite(Number(n.weight)) ? Number(n.weight) : 1,
        grantsBadge: n.grantsBadge ? String(n.grantsBadge) : undefined,
      }))
    : [
        // deterministic fallback nodes (keeps mechanic functional even if def omitted)
        { id: 'FOCUS_CASHFLOW', label: 'Cashflow Focus', requiresTags: [], requiresAssetKinds: [], minAssets: 0, weight: 1.2, grantsBadge: 'CASHFLOW' },
        { id: 'FOCUS_GROWTH', label: 'Growth Focus', requiresTags: [], requiresAssetKinds: [], minAssets: 1, weight: 1.0, grantsBadge: 'GROWTH' },
        { id: 'FOCUS_DEFENSE', label: 'Defense Focus', requiresTags: [], requiresAssetKinds: [], minAssets: 0, weight: 0.9, grantsBadge: 'DEFENSE' },
        { id: 'FOCUS_ARBITRAGE', label: 'Arbitrage Focus', requiresTags: [], requiresAssetKinds: [], minAssets: 2, weight: 0.8, grantsBadge: 'ARBITRAGE' },
      ];

  const doctrineWeights = def?.doctrineWeights ?? {};
  return { rootPath, nodes, doctrineWeights };
}

function m81DoctrineKey(choice: unknown): string {
  if (typeof choice === 'string' && choice.trim().length) return choice.trim();
  if (typeof choice === 'number' && Number.isFinite(choice)) return `DOCTRINE_${choice}`;
  if (choice && typeof choice === 'object') return computeHash(JSON.stringify(choice)).slice(0, 12);
  return 'DEFAULT';
}

function m81AssetKind(a: Asset): string {
  // Conservative extraction: tries common fields without assuming your schema.
  const anyA = a as unknown as Record<string, unknown>;
  const kind = (anyA.kind ?? anyA.type ?? anyA.category ?? anyA.assetType) as unknown;
  return String(kind ?? 'UNKNOWN').toUpperCase();
}

function m81ComputeCandidateScores(
  seed: string,
  tick: number,
  nodes: SynergyNodeDef[],
  assets: Asset[],
  portfolioTags: string[],
  doctrineKey: string,
  doctrineWeights: Record<string, Record<string, number>>,
  phase: RunPhase,
  regime: MacroRegime,
  pressureTier: PressureTier,
  inChaos: boolean,
): Array<{ nodeId: string; score: number }> {
  const assetKinds = assets.map(m81AssetKind);

  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;
  const regimeMul = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const decay = inChaos ? computeDecayRate(regime, M81_BOUNDS.BASE_DECAY_RATE) : 0;

  // Deterministic pool for subtle bias
  const pool = buildWeightedPool(`${seed}:candPool:${tick}`, pressureW * phaseW, regimeW);
  const opp = OPPORTUNITY_POOL[seededIndex(seed, tick + 61, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;
  const deck = seededShuffle(DEFAULT_CARD_IDS, `${seed}:deck:${tick}`);
  const deckTop = deck[0] ?? DEFAULT_CARD.id;

  const doctrineMap = doctrineWeights[doctrineKey] ?? doctrineWeights['DEFAULT'] ?? {};

  return nodes.map((n, i) => {
    const tagGate = (n.requiresTags ?? []).every(t => portfolioTags.includes(String(t)));
    const kindGate = (n.requiresAssetKinds ?? []).every(k => assetKinds.includes(String(k).toUpperCase()));
    const minGate = assets.length >= (n.minAssets ?? 0);

    const gates = (tagGate ? 1 : 0) + (kindGate ? 1 : 0) + (minGate ? 1 : 0);
    const gateScore = gates / 3;

    const baseWeight = Number.isFinite(Number(n.weight)) ? Number(n.weight) : 1.0;
    const docW = Number.isFinite(Number(doctrineMap[n.id])) ? Number(doctrineMap[n.id]) : 1.0;

    const poolPick = pool[seededIndex(seed, tick + 300 + i, Math.max(1, pool.length))] ?? opp;
    const money = Number(poolPick.cost ?? poolPick.downPayment ?? 1_000);
    const entropy = seededIndex(computeHash(`${seed}:${deckTop}:${n.id}:${poolPick.id ?? poolPick.name ?? 'x'}`), tick + i, 100);

    // score: gated + economics + deterministic entropy, all bounded
    const eco = clamp((money / 50_000) * (pressureW * phaseW * regimeW) * (regimeMul * exitPulse), 0, 3);
    const chaosAdj = inChaos ? (1 - clamp(decay, 0, 0.5)) : 1;

    const scoreRaw =
      gateScore *
      baseWeight *
      docW *
      chaosAdj *
      (0.6 + eco * 0.25) *
      (0.85 + entropy * 0.003); // 0.85..1.147

    return { nodeId: n.id, score: clamp(scoreRaw, 0, 9.99) };
  });
}

function m81PickNode(seed: string, tick: number, candidates: Array<{ nodeId: string; score: number }>): string {
  if (!candidates.length) return 'ROOT';
  const total = candidates.reduce((s, c) => s + Math.max(0, c.score), 0) || 1;
  const r = seededIndex(seed, tick + 777, 10_000) / 10_000; // 0..0.9999
  let acc = 0;
  for (const c of candidates) {
    acc += Math.max(0, c.score) / total;
    if (r <= acc) return c.nodeId;
  }
  return candidates[candidates.length - 1].nodeId;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * synergyTreePathResolver
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function synergyTreePathResolver(input: M81Input, emit: MechanicEmitter): M81Output {
  const stateAssets = (Array.isArray(input.stateAssets) ? input.stateAssets : []) as Asset[];
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const runId = String(input.runId ?? computeHash(JSON.stringify(input)));

  const tree = m81NormalizeTree(input.synergyTreeDef);
  const portfolioTags = Array.isArray(input.portfolioTags) ? input.portfolioTags.map(String) : [];

  const doctrineKey = m81DoctrineKey(input.playerDoctrineChoice);

  const seed = computeHash(
    JSON.stringify({
      m: 'M81',
      tick,
      runId,
      doctrineKey,
      assetsCount: stateAssets.length,
      tags: portfolioTags,
      treeRoot: tree.rootPath,
      nodeIds: tree.nodes.map(n => n.id),
    }),
  );

  // Context (bounded chaos)
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m81DerivePhase(tick);
  const regime = m81DeriveRegime(tick, macroSchedule);
  const inChaos = m81InChaosWindow(tick, chaosWindows);

  const proxy = clamp(stateAssets.length + portfolioTags.length, 1, 12);
  const pressureTier = (input.pressureTier as PressureTier) ?? m81DerivePressureTier(proxy, inChaos);

  const candidates = m81ComputeCandidateScores(
    seed,
    tick,
    tree.nodes,
    stateAssets,
    portfolioTags,
    doctrineKey,
    tree.doctrineWeights,
    phase,
    regime,
    pressureTier,
    inChaos,
  );

  const pickedNodeId = m81PickNode(seed, tick, candidates);
  const pickedNode = tree.nodes.find(n => n.id === pickedNodeId) ?? tree.nodes[0];

  const activePath = `${tree.rootPath}/${pickedNodeId}`;

  // Branch unlock condition: enough assets or deterministic tick condition
  const branchUnlocked = stateAssets.length >= 1 || (seededIndex(seed, tick + 55, 10) >= 7);

  // Identity badge: node grantsBadge or derived deterministic label
  const identityBadge =
    pickedNode?.grantsBadge ??
    computeHash(`${seed}:${pickedNodeId}:${doctrineKey}`).slice(0, 10).toUpperCase();

  // Effect score (telemetry-only)
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;
  const regimeMul = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const decay = computeDecayRate(regime, M81_BOUNDS.BASE_DECAY_RATE);

  const pickedScore = candidates.find(c => c.nodeId === pickedNodeId)?.score ?? 0;
  const effectRaw =
    clamp(pickedScore / 10, 0, 1) *
    (pressureW * phaseW * regimeW) *
    (regimeMul * exitPulse) *
    (inChaos ? (1 - clamp(decay, 0, 0.5)) : 1);

  const effectScore = clamp(effectRaw * M81_BOUNDS.MAX_EFFECT * M81_BOUNDS.EFFECT_MULTIPLIER, M81_BOUNDS.MIN_EFFECT, M81_BOUNDS.MAX_EFFECT);

  const auditHash = computeHash(
    JSON.stringify({
      m: 'M81',
      tick,
      runId,
      doctrineKey,
      activePath,
      branchUnlocked,
      identityBadge,
      pickedNodeId,
      candidates,
      phase,
      regime,
      pressureTier,
      inChaos,
      effectScore: Math.round(effectScore),
      seed,
    }),
  );

  emit({
    event: 'SYNERGY_BRANCH_UNLOCKED',
    mechanic_id: 'M81',
    tick,
    runId,
    payload: {
      activePath,
      pickedNodeId,
      branchUnlocked,
      identityBadge,
      doctrineKey,
      candidates,
      auditHash,
    },
  });

  emit({
    event: 'IDENTITY_FORGED',
    mechanic_id: 'M81',
    tick,
    runId,
    payload: {
      identityBadge,
      activePath,
      note: 'portfolio_identity_badge',
    },
  });

  emit({
    event: 'PATH_LOCKED',
    mechanic_id: 'M81',
    tick,
    runId,
    payload: {
      activePath,
      locked: true,
      effectScore: Math.round(effectScore),
    },
  });

  const resolution: SynergyResolution = {
    activePath,
    branchUnlocked,
    identityBadge,
    tick,
    phase,
    regime,
    pressureTier,
    inChaos,
    seed,
    auditHash,
    candidates: candidates.map(c => ({ nodeId: c.nodeId, score: c.score, picked: c.nodeId === pickedNodeId })),
    effectScore: Math.round(effectScore),
  };

  return {
    activePath,
    branchUnlocked,
    identityBadge,
    resolution,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M81MLInput {
  activePath?: string;
  branchUnlocked?: boolean;
  identityBadge?: string;
  runId: string;
  tick: number;
}

export interface M81MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * synergyTreePathResolverMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function synergyTreePathResolverMLCompanion(input: M81MLInput): Promise<M81MLOutput> {
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);

  const path = String(input.activePath ?? '');
  const unlocked = Boolean(input.branchUnlocked ?? false);
  const badge = String(input.identityBadge ?? '');

  // Neutral decay baseline (regime unknown here)
  const confidenceDecay = computeDecayRate('NEUTRAL' as MacroRegime, M81_BOUNDS.BASE_DECAY_RATE);

  // Score: unlocked + non-empty badge/path => higher, bounded
  const score = clamp(
    0.25 +
      (unlocked ? 0.35 : 0) +
      (path.length ? 0.2 : 0) +
      (badge.length ? 0.15 : 0),
    0.01,
    0.99,
  );

  // Deterministic hint using DEFAULT_CARD_IDS (keeps import live)
  const hintPick = seededIndex(computeHash(`M81ML:${tick}:${input.runId}:${path}:${String(unlocked)}:${badge}`), tick, DEFAULT_CARD_IDS.length);
  const hintCardId = DEFAULT_CARD_IDS[hintPick] ?? DEFAULT_CARD.id;

  const topFactors = [
    `tick=${tick}/${RUN_TOTAL_TICKS}`,
    `unlocked=${unlocked ? 'yes' : 'no'}`,
    `path=${path ? 'set' : 'empty'}`,
    `badge=${badge ? 'set' : 'empty'}`,
    `hintCardId=${hintCardId}`,
  ].slice(0, 5);

  const recommendation = !unlocked
    ? 'Branch locked: acquire required assets/tags or adjust doctrine to unlock synergy paths.'
    : 'Path selected: reinforce portfolio identity by choosing assets/cards aligned with this synergy path.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M81'),
    confidenceDecay,
  };
}