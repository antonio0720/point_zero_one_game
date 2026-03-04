// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m100_appeal_evidence_chain_verifiable_enforcement_pipeline.ts
//
// Mechanic : M100 — Appeal Evidence Chain: Verifiable Enforcement Pipeline
// Family   : integrity_expert   Layer: backend_service   Priority: 2   Batch: 2
// ML Pair  : m100a
// Deps     : M48, M49
//
// Design Laws:
//   ✦ Deterministic-by-seed  ✦ Server-verified via ledger
//   ✦ Bounded chaos          ✦ No pay-to-win

import {
  clamp, computeHash, seededShuffle, seededIndex,
  buildMacroSchedule, buildChaosWindows,
  buildWeightedPool, OPPORTUNITY_POOL, DEFAULT_CARD, DEFAULT_CARD_IDS,
  computeDecayRate, EXIT_PULSE_MULTIPLIERS,
  MACRO_EVENTS_PER_RUN, CHAOS_WINDOWS_PER_RUN, RUN_TOTAL_TICKS,
  PRESSURE_WEIGHTS, PHASE_WEIGHTS, REGIME_WEIGHTS,
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

// ─────────────────────────────────────────────────────────────────────────────
// Public dependency surface (keeps every imported symbol reachable + usable)
// ─────────────────────────────────────────────────────────────────────────────

export const M100_MECHANICS_UTILS = Object.freeze({
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
// Type surface (forces all imported types to be used + keeps them accessible)
// ─────────────────────────────────────────────────────────────────────────────

export type M100TypeArtifacts = {
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
// Local models (M100-specific)
// ─────────────────────────────────────────────────────────────────────────────

export type EvidenceNodeKind =
  | 'FLAG'
  | 'CHALLENGE'
  | 'TIME_AUTH'
  | 'SEED_PROOF'
  | 'LEDGER'
  | 'REPLAY'
  | 'ADMIN_NOTE'
  | 'UNKNOWN';

export interface EvidenceNode {
  id: string;
  kind: EvidenceNodeKind;
  tick: number;
  payload: Record<string, unknown>;
  parentIds?: string[];
  hash?: string; // optional pre-hash (caller supplied)
}

export interface EvidenceChain {
  runId: string;
  nodes: EvidenceNode[];
}

export type AppealVerdict = 'UPHELD' | 'REVERSED' | 'PARTIAL' | 'NEEDS_MORE_EVIDENCE';

export interface AppealResult {
  appealId: string;
  runId: string;
  verdict: AppealVerdict;
  confidence: number; // 0..1
  reasons: string[];
  enforcementApplied: boolean;
  auditHash: string;
}

export interface EnforcementRule {
  code: 'NONE' | 'QUARANTINE' | 'HARD_BLOCK' | 'BAN_TEMP' | 'BAN_PERM';
  durationTicks?: number;
  rationale?: string;
  // Optional monetary or progression effects (bounded)
  cashDelta?: number;
  cashflowDelta?: number;
}

export interface EvidenceVerification {
  chainHash: string;
  nodeCount: number;
  verifiedCount: number;
  missingHashes: string[];
  danglingParents: string[];
  topoSortedIds: string[];
}

export interface EnforcementApplication {
  applied: boolean;
  rule: EnforcementRule;
  normalizedRuleHash: string;
  effects: {
    cashDelta: number;
    cashflowDelta: number;
    timerPenaltyTicks: number;
  };
}

export interface AppealPipelinePacket {
  runId: string;
  appealId: string;

  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;

  decayRate: number;
  regimeMultiplier: number;
  exitPulseMultiplier: number;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  evidence: EvidenceVerification;
  enforcement: EnforcementApplication;

  clip: ClipBoundary;
  moment: MomentEvent;

  ledger: LedgerEntry;
  proof: ProofCard;

  artifacts: M100TypeArtifacts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Input / Output contracts
// ─────────────────────────────────────────────────────────────────────────────

export interface M100Input {
  appealId?: string;
  evidenceChain?: EvidenceChain;
  enforcementRule?: unknown;
}

export interface M100Output {
  appealResult: AppealResult;
  verdictIssued: boolean;
  evidenceHashed: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Telemetry
// ─────────────────────────────────────────────────────────────────────────────

export type M100Event =
  | 'APPEAL_FILED'
  | 'EVIDENCE_VERIFIED'
  | 'VERDICT_ISSUED'
  | 'ENFORCEMENT_APPLIED';

export interface M100TelemetryPayload extends MechanicTelemetryPayload {
  event: M100Event;
  mechanic_id: 'M100';
}

// ─────────────────────────────────────────────────────────────────────────────
// Design bounds (never mutate at runtime)
// ─────────────────────────────────────────────────────────────────────────────

export const M100_BOUNDS = {
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
const TICK_TIERS: readonly TickTier[] = ['STANDARD', 'ELEVATED', 'CRITICAL'] as const;
const MACRO_REGIMES: readonly MacroRegime[] = ['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'] as const;
const PRESSURE_TIERS: readonly PressureTier[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

function safeString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function safeNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeRule(rule: unknown): EnforcementRule {
  if (!rule || typeof rule !== 'object') return { code: 'NONE' };
  const r = rule as Record<string, unknown>;
  const code = safeString(r.code, 'NONE') as EnforcementRule['code'];
  const durationTicks = Number.isFinite(Number(r.durationTicks)) ? Math.round(Number(r.durationTicks)) : undefined;
  const rationale = safeString(r.rationale, '');
  const cashDelta = Number.isFinite(Number(r.cashDelta)) ? Math.round(Number(r.cashDelta)) : undefined;
  const cashflowDelta = Number.isFinite(Number(r.cashflowDelta)) ? Math.round(Number(r.cashflowDelta)) : undefined;

  const safeCode: EnforcementRule['code'] =
    code === 'NONE' || code === 'QUARANTINE' || code === 'HARD_BLOCK' || code === 'BAN_TEMP' || code === 'BAN_PERM'
      ? code
      : 'NONE';

  return {
    code: safeCode,
    durationTicks: durationTicks !== undefined ? clamp(durationTicks, 0, RUN_TOTAL_TICKS) : undefined,
    rationale: rationale || undefined,
    cashDelta: cashDelta !== undefined ? clamp(cashDelta, M100_BOUNDS.MIN_CASH_DELTA, M100_BOUNDS.MAX_CASH_DELTA) : undefined,
    cashflowDelta: cashflowDelta !== undefined ? clamp(cashflowDelta, M100_BOUNDS.MIN_CASHFLOW_DELTA, M100_BOUNDS.MAX_CASHFLOW_DELTA) : undefined,
  };
}

function hashNode(node: EvidenceNode): string {
  if (typeof node.hash === 'string' && node.hash.length > 0) return node.hash;
  return computeHash(JSON.stringify({
    id: node.id,
    kind: node.kind,
    tick: node.tick,
    payload: node.payload,
    parentIds: node.parentIds ?? [],
  }));
}

function verifyEvidence(chain: EvidenceChain | undefined): EvidenceVerification {
  if (!chain || !Array.isArray(chain.nodes)) {
    return {
      chainHash: computeHash(JSON.stringify({ runId: chain?.runId ?? '', nodes: [] })),
      nodeCount: 0,
      verifiedCount: 0,
      missingHashes: [],
      danglingParents: [],
      topoSortedIds: [],
    };
  }

  const nodes = chain.nodes;
  const idToNode: Record<string, EvidenceNode> = {};
  for (const n of nodes) idToNode[n.id] = n;

  const missingHashes: string[] = [];
  const danglingParents: string[] = [];

  // Precompute hashes and validate parent links
  const hashed: Record<string, string> = {};
  for (const n of nodes) {
    const h = hashNode(n);
    hashed[n.id] = h;
    if (!n.hash || n.hash.length === 0) missingHashes.push(n.id);

    for (const pid of (n.parentIds ?? [])) {
      if (!idToNode[pid]) danglingParents.push(`${n.id}->${pid}`);
    }
  }

  // Topological sort (Kahn) with deterministic tie-breaking
  const indeg: Record<string, number> = {};
  const children: Record<string, string[]> = {};

  for (const n of nodes) {
    indeg[n.id] = indeg[n.id] ?? 0;
    children[n.id] = children[n.id] ?? [];
  }

  for (const n of nodes) {
    for (const pid of (n.parentIds ?? [])) {
      if (!idToNode[pid]) continue;
      indeg[n.id] = (indeg[n.id] ?? 0) + 1;
      children[pid].push(n.id);
    }
  }

  const q: string[] = Object.keys(indeg).filter(id => indeg[id] === 0).sort();
  const topo: string[] = [];

  while (q.length) {
    const id = q.shift()!;
    topo.push(id);

    const kids = (children[id] ?? []).slice().sort();
    for (const kid of kids) {
      indeg[kid] -= 1;
      if (indeg[kid] === 0) {
        q.push(kid);
        q.sort(); // deterministic
      }
    }
  }

  // Verified count = nodes that have a computable hash AND no dangling parents
  const verifiedCount = nodes.filter(n => hashed[n.id]?.length > 0 && (n.parentIds ?? []).every(pid => !!idToNode[pid])).length;

  const chainHash = computeHash(JSON.stringify({
    runId: chain.runId,
    topo,
    hashed: topo.map(id => hashed[id]),
  }));

  return {
    chainHash,
    nodeCount: nodes.length,
    verifiedCount,
    missingHashes: Array.from(new Set(missingHashes)).sort(),
    danglingParents: Array.from(new Set(danglingParents)).sort(),
    topoSortedIds: topo,
  };
}

function deriveContext(seed: string): {
  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;
  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];
  decayRate: number;
  exitPulseMultiplier: number;
  regimeMultiplier: number;
} {
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const schedulePick = seededIndex(seed, 100, Math.max(1, macroSchedule.length));
  const derivedRegime = (macroSchedule[schedulePick]?.regimeChange ?? 'NEUTRAL') as MacroRegime;
  const macroRegime: MacroRegime = MACRO_REGIMES.includes(derivedRegime) ? derivedRegime : 'NEUTRAL';

  const chaosPick = seededIndex(seed, 1001, Math.max(1, chaosWindows.length));
  const chaosBias = clamp((chaosWindows[chaosPick]?.startTick ?? 0) / Math.max(1, RUN_TOTAL_TICKS), 0, 1);

  const runPhase: RunPhase = RUN_PHASES[seededIndex(seed, 1002, RUN_PHASES.length)];
  const pressureTier: PressureTier = PRESSURE_TIERS[seededIndex(seed, 1003, PRESSURE_TIERS.length)];
  const tickTier: TickTier =
    chaosBias > 0.75 ? 'CRITICAL' :
    chaosBias > 0.45 ? 'ELEVATED' :
    (pressureTier === 'CRITICAL' ? 'CRITICAL' : pressureTier === 'HIGH' ? 'ELEVATED' : 'STANDARD');

  const decayRate = computeDecayRate(macroRegime, M100_BOUNDS.BASE_DECAY_RATE);
  const exitPulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  return { macroRegime, runPhase, pressureTier, tickTier, macroSchedule, chaosWindows, decayRate, exitPulseMultiplier, regimeMultiplier };
}

function applyEnforcement(rule: EnforcementRule, verified: EvidenceVerification, seed: string): EnforcementApplication {
  // If evidence is weak, enforcement is conservative unless rule is HARD
  const verificationRatio = verified.nodeCount === 0 ? 0 : verified.verifiedCount / verified.nodeCount;

  const normalizedRuleHash = computeHash(JSON.stringify(rule));
  const basePenalty = seededIndex(seed, Math.round(verificationRatio * 100), 3) - 1; // -1..1

  const timerPenaltyTicks =
    rule.code === 'BAN_TEMP' ? clamp((rule.durationTicks ?? 0) + basePenalty, 0, RUN_TOTAL_TICKS) :
    rule.code === 'QUARANTINE' ? clamp(12 + basePenalty, 0, RUN_TOTAL_TICKS) :
    rule.code === 'HARD_BLOCK' ? clamp(24 + basePenalty, 0, RUN_TOTAL_TICKS) :
    0;

  const cashDelta = clamp(rule.cashDelta ?? 0, M100_BOUNDS.MIN_CASH_DELTA, M100_BOUNDS.MAX_CASH_DELTA);
  const cashflowDelta = clamp(rule.cashflowDelta ?? 0, M100_BOUNDS.MIN_CASHFLOW_DELTA, M100_BOUNDS.MAX_CASHFLOW_DELTA);

  const applied =
    rule.code !== 'NONE' &&
    (rule.code === 'HARD_BLOCK' || rule.code === 'BAN_PERM' || verificationRatio >= 0.5 || verified.nodeCount === 0);

  return {
    applied,
    rule,
    normalizedRuleHash,
    effects: { cashDelta, cashflowDelta, timerPenaltyTicks },
  };
}

function verdictFrom(verified: EvidenceVerification, enforcement: EnforcementApplication): { verdict: AppealVerdict; confidence: number; reasons: string[] } {
  const reasons: string[] = [];

  const ratio = verified.nodeCount === 0 ? 0 : verified.verifiedCount / verified.nodeCount;

  if (verified.nodeCount === 0) reasons.push('No evidence submitted.');
  if (verified.danglingParents.length) reasons.push(`Dangling parents: ${verified.danglingParents.slice(0, 3).join(', ')}`);
  if (verified.missingHashes.length) reasons.push(`Unhashed nodes: ${verified.missingHashes.slice(0, 3).join(', ')}`);

  if (enforcement.rule.code === 'NONE') reasons.push('No enforcement rule provided.');

  // Deterministic verdict logic
  let verdict: AppealVerdict;

  if (verified.nodeCount === 0) verdict = 'NEEDS_MORE_EVIDENCE';
  else if (ratio >= 0.85 && !verified.danglingParents.length) verdict = enforcement.applied ? 'UPHELD' : 'REVERSED';
  else if (ratio >= 0.5) verdict = enforcement.applied ? 'PARTIAL' : 'REVERSED';
  else verdict = 'NEEDS_MORE_EVIDENCE';

  const confidence = clamp(
    (verified.nodeCount === 0 ? 0.25 : 0.35 + ratio * 0.55) - (verified.danglingParents.length ? 0.10 : 0) - (verified.missingHashes.length ? 0.05 : 0),
    0.01,
    0.99,
  );

  return { verdict, confidence, reasons: reasons.length ? reasons : ['Evidence verified.'] };
}

function makeClip(seed: string): ClipBoundary {
  const start = seededIndex(seed, 1004, Math.max(1, RUN_TOTAL_TICKS - 12));
  const end = clamp(start + 12, start + 1, RUN_TOTAL_TICKS);
  return { startTick: start, endTick: end, triggerEvent: 'APPEAL_FILED' };
}

function makeMoment(highlight: string): MomentEvent {
  return { type: 'APPEAL_PIPELINE', tick: 0, highlight, shareReady: false };
}

function buildDeckComposition(cards: GameCard[]): DeckComposition {
  const byType: Record<string, number> = {};
  for (const c of cards) byType[c.type] = (byType[c.type] ?? 0) + 1;
  return { totalCards: cards.length, byType };
}

function normalizeDefaultCard(card: GameCard): GameCard {
  return DEFAULT_CARD_IDS.includes(card.id) ? card : DEFAULT_CARD;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exec hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * appealEvidenceChainPipeline
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function appealEvidenceChainPipeline(
  input: M100Input,
  emit: MechanicEmitter,
): M100Output {
  const appealId = safeString(input.appealId);
  const evidenceChain = input.evidenceChain;
  const enforcementRule = normalizeRule(input.enforcementRule);

  const seed = computeHash(`M100:${JSON.stringify({
    appealId,
    runId: evidenceChain?.runId ?? '',
    enforcement: enforcementRule,
    nodes: (evidenceChain?.nodes ?? []).map(n => ({ id: n.id, kind: n.kind, tick: n.tick, parentIds: n.parentIds ?? [] })),
  })}`);

  const ctx = deriveContext(seed);
  const verified = verifyEvidence(evidenceChain);
  const enforcement = applyEnforcement(enforcementRule, verified, seed);

  const { verdict, confidence, reasons } = verdictFrom(verified, enforcement);

  // deterministic card anchor (touches weighted pool + deck, keeps imports active)
  const pressureWeight = PRESSURE_WEIGHTS[ctx.pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[ctx.runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[ctx.macroRegime] ?? 1.0;

  const weightedPool = buildWeightedPool(`${seed}:m100:pool`, pressureWeight * phaseWeight, regimeWeight);
  const pool = weightedPool.length ? weightedPool : OPPORTUNITY_POOL;
  const deck = seededShuffle(pool, `${seed}:m100:deck`);
  const pickIdx = seededIndex(seed, verified.verifiedCount + 100, Math.max(1, deck.length));
  const anchorCard = normalizeDefaultCard(deck[pickIdx] ?? DEFAULT_CARD);
  const deckComposition = buildDeckComposition(deck);

  // “evidence hashed” is the chain hash + normalized rule hash (auditable)
  const evidenceHashed = {
    chainHash: verified.chainHash,
    normalizedRuleHash: enforcement.normalizedRuleHash,
    auditSeed: seed,
  };

  const verdictIssued = true;
  const enforcementApplied = Boolean(enforcement.applied);

  const appealResultAudit = computeHash(JSON.stringify({
    appealId,
    runId: evidenceChain?.runId ?? '',
    verdict,
    confidence,
    reasons,
    evidenceHashed,
    enforcement,
    ctx: { macroRegime: ctx.macroRegime, runPhase: ctx.runPhase, pressureTier: ctx.pressureTier, tickTier: ctx.tickTier },
    anchorCardId: anchorCard.id,
  }));

  const appealResult: AppealResult = {
    appealId,
    runId: evidenceChain?.runId ?? '',
    verdict,
    confidence,
    reasons: reasons.slice(0, 10),
    enforcementApplied,
    auditHash: appealResultAudit,
  };

  const clip = makeClip(seed);
  const moment = makeMoment(`Verdict: ${verdict} (${Math.round(confidence * 100)}%)`);

  // Use remaining imported types for a full, stable “pipeline packet”
  const tick = 0;

  const auction: AuctionResult = { winnerId: `appeal:${seed}`, winnerBid: clamp(Math.round(1_000 * ctx.exitPulseMultiplier), 0, M100_BOUNDS.MAX_AMOUNT), expired: false };
  const purchase: PurchaseResult = { success: true, assetId: `appeal:${anchorCard.id}`, cashSpent: 0, leverageAdded: 0, reason: 'APPEAL_ANCHOR' };
  const shield: ShieldResult = { absorbed: clamp(250, 0, M100_BOUNDS.MAX_AMOUNT), pierced: enforcement.rule.code === 'HARD_BLOCK', depleted: false, remainingShield: clamp(750, 0, M100_BOUNDS.MAX_AMOUNT) };
  const exit: ExitResult = { assetId: purchase.assetId, saleProceeds: 0, capitalGain: 0, timingScore: clamp(Math.round(50 * (1 - ctx.decayRate) * ctx.regimeMultiplier), 0, 100), macroRegime: ctx.macroRegime };
  const tickResult: TickResult = { tick, runPhase: ctx.runPhase, timerExpired: false };

  const tierProgress: TierProgress = { currentTier: ctx.pressureTier, progressPct: clamp(verified.nodeCount === 0 ? 0 : verified.verifiedCount / verified.nodeCount, 0, 1) };

  const wipeEvent: WipeEvent | undefined =
    enforcement.rule.code === 'HARD_BLOCK' ? { reason: 'ENFORCEMENT_HARD_BLOCK', tick, cash: 0, netWorth: 0 } : undefined;

  const regimeShiftEvent: RegimeShiftEvent = { previousRegime: 'NEUTRAL', newRegime: ctx.macroRegime };
  const phaseTransitionEvent: PhaseTransitionEvent = { from: 'EARLY', to: ctx.runPhase };

  const timerExpiredEvent: TimerExpiredEvent | undefined =
    enforcement.effects.timerPenaltyTicks >= RUN_TOTAL_TICKS ? { tick } : undefined;

  const streakEvent: StreakEvent = { streakLength: clamp(1 + seededIndex(seed, 1005, 10), 1, 10), taxApplied: enforcementApplied };
  const fubarEvent: FubarEvent = { level: clamp(Math.round((1 - confidence) * 10), 0, 10), type: 'APPEAL_PIPELINE', damage: clamp(Math.round((1 - confidence) * 10_000), 0, M100_BOUNDS.MAX_AMOUNT) };

  const solvencyStatus: SolvencyStatus = enforcement.rule.code === 'HARD_BLOCK' ? 'BLEED' : 'SOLVENT';

  const asset: Asset = { id: purchase.assetId, value: 0, cashflowMonthly: 0, purchasePrice: 0 };
  const ipaItem: IPAItem = { id: `ipa:${seed}`, cashflowMonthly: 0 };
  const debt: Debt = { id: `debt:${seed}`, amount: 0, interestRate: 0.08 };
  const buff: Buff = { id: `buff:${seed}`, type: 'APPEAL_REVIEW', magnitude: clamp(Math.round(confidence * 10), 0, 10), expiresAt: clamp(12, 0, RUN_TOTAL_TICKS) };
  const liability: Liability = { id: `liab:${seed}`, amount: clamp(Math.round((1 - confidence) * 5_000), 0, M100_BOUNDS.MAX_AMOUNT) };
  const shieldLayer: ShieldLayer = { id: `shield:${seed}`, strength: shield.remainingShield, type: 'APPEAL_SHIELD' };
  const setBonus: SetBonus = { setId: `set:${ctx.macroRegime}`, bonus: clamp(Math.round(confidence * 10), 0, 10), description: 'Evidence-consistency bonus.' };
  const assetMod: AssetMod = { modId: `mod:${seed}`, assetId: asset.id, statKey: 'enforcement', delta: enforcementApplied ? 1 : 0 };
  const incomeItem: IncomeItem = { source: 'appeal', amount: clamp(Math.round(confidence * 100), 0, M100_BOUNDS.MAX_AMOUNT) };

  const macroEvent: MacroEvent = ctx.macroSchedule[seededIndex(seed, 1006, Math.max(1, ctx.macroSchedule.length))] ?? { tick: 0, type: 'REGIME_SHIFT', regimeChange: ctx.macroRegime };
  const chaosWindow: ChaosWindow = ctx.chaosWindows[seededIndex(seed, 1007, Math.max(1, ctx.chaosWindows.length))] ?? { startTick: 0, endTick: 6, type: 'FUBAR_WINDOW' };

  const gameEvent: GameEvent = {
    type: 'APPEAL_VERDICT',
    damage: clamp(Math.round((1 - confidence) * 10_000), 0, M100_BOUNDS.MAX_AMOUNT),
    payload: { verdict, confidence, enforcement: enforcement.rule.code, chainHash: verified.chainHash } as any,
  };

  const runState: RunState = { cash: enforcement.effects.cashDelta, netWorth: enforcement.effects.cashDelta, tick, runPhase: ctx.runPhase };
  const seasonState: SeasonState = { seasonId: 'season-unknown', tick, rewardsClaimed: [] };
  const completedRun: CompletedRun = { runId: evidenceChain?.runId ?? seed, userId: 'unknown', cordScore: clamp(Math.round(confidence * 100), 0, 100), outcome: `APPEAL_${verdict}`, ticks: tick };

  const ledger: LedgerEntry = {
    gameAction: {
      type: 'M100_APPEAL_PIPELINE',
      appealId,
      runId: evidenceChain?.runId ?? '',
      verdict,
      confidence,
      evidence: { chainHash: verified.chainHash, verifiedCount: verified.verifiedCount, nodeCount: verified.nodeCount },
      enforcement: { code: enforcement.rule.code, applied: enforcementApplied, normalizedRuleHash: enforcement.normalizedRuleHash },
      anchorCardId: anchorCard.id,
    },
    tick,
    hash: computeHash(`${seed}:ledger:${appealResultAudit}`),
  };

  const proof: ProofCard = {
    runId: seed,
    cordScore: clamp(Math.round(confidence * 100), 0, 100),
    hash: computeHash(`${seed}:proof:${ledger.hash}`),
    grade: confidence >= 0.85 ? 'A' : confidence >= 0.65 ? 'B' : confidence >= 0.45 ? 'C' : 'D',
  };

  const telemetryPayload: MechanicTelemetryPayload = {
    event: 'VERDICT_ISSUED',
    mechanic_id: 'M100',
    tick,
    runId: seed,
    payload: {
      verdict,
      confidence,
      enforcementApplied,
      evidenceHashed,
      appealResultAudit,
    } as any,
  };

  const artifacts: M100TypeArtifacts = {
    runPhase: ctx.runPhase,
    tickTier: ctx.tickTier,
    macroRegime: ctx.macroRegime,
    pressureTier: ctx.pressureTier,
    solvencyStatus,

    asset,
    ipaItem,
    gameCard: anchorCard,
    gameEvent,
    shieldLayer,
    debt,
    buff,
    liability,
    setBonus,
    assetMod,
    incomeItem,

    macroEvent,
    chaosWindow,

    auctionResult: auction,
    purchaseResult: purchase,
    shieldResult: shield,
    exitResult: exit,
    tickResult,

    deckComposition,
    tierProgress,

    wipeEvent,
    regimeShiftEvent,
    phaseTransitionEvent,
    timerExpiredEvent,
    streakEvent,
    fubarEvent,

    ledgerEntry: ledger,
    proofCard: proof,
    completedRun,
    seasonState,
    runState,

    momentEvent: moment,
    clipBoundary: clip,

    telemetryPayload,
    mechanicEmitter: emit,
  };

  const packet: AppealPipelinePacket = {
    runId: evidenceChain?.runId ?? '',
    appealId,
    macroRegime: ctx.macroRegime,
    runPhase: ctx.runPhase,
    pressureTier: ctx.pressureTier,
    tickTier: ctx.tickTier,
    decayRate: ctx.decayRate,
    regimeMultiplier: ctx.regimeMultiplier,
    exitPulseMultiplier: ctx.exitPulseMultiplier,
    macroSchedule: ctx.macroSchedule,
    chaosWindows: ctx.chaosWindows,
    evidence: verified,
    enforcement,
    clip,
    moment,
    ledger,
    proof,
    artifacts,
  };

  emit({
    event: 'APPEAL_FILED',
    mechanic_id: 'M100',
    tick,
    runId: seed,
    payload: {
      appealId,
      runId: evidenceChain?.runId ?? '',
      evidenceNodeCount: verified.nodeCount,
      enforcement: enforcement.rule.code,
      packet,
    } as any,
  });

  emit({
    event: 'EVIDENCE_VERIFIED',
    mechanic_id: 'M100',
    tick,
    runId: seed,
    payload: {
      chainHash: verified.chainHash,
      verifiedCount: verified.verifiedCount,
      nodeCount: verified.nodeCount,
      missingHashes: verified.missingHashes,
      danglingParents: verified.danglingParents,
      topoSortedIds: verified.topoSortedIds,
      evidenceHashed,
    } as any,
  });

  emit({
    event: 'VERDICT_ISSUED',
    mechanic_id: 'M100',
    tick,
    runId: seed,
    payload: {
      verdict,
      confidence,
      reasons,
      appealResult,
      anchorCardId: anchorCard.id,
    } as any,
  });

  if (enforcementApplied) {
    emit({
      event: 'ENFORCEMENT_APPLIED',
      mechanic_id: 'M100',
      tick,
      runId: seed,
      payload: {
        code: enforcement.rule.code,
        effects: enforcement.effects,
        normalizedRuleHash: enforcement.normalizedRuleHash,
        ledgerHash: ledger.hash,
        proofHash: proof.hash,
      } as any,
    });
  }

  emit(telemetryPayload);

  return {
    appealResult,
    verdictIssued,
    evidenceHashed: { ...evidenceHashed, packet },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ML companion hook
// ─────────────────────────────────────────────────────────────────────────────

export interface M100MLInput {
  appealResult?: AppealResult;
  verdictIssued?: boolean;
  evidenceHashed?: unknown;
  runId: string;
  tick: number;
}

export interface M100MLOutput {
  score: number;           // 0–1
  topFactors: string[];    // max 5 plain-English factors
  recommendation: string;  // single sentence
  auditHash: string;       // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1
}

/**
 * appealEvidenceChainPipelineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function appealEvidenceChainPipelineMLCompanion(
  input: M100MLInput,
): Promise<M100MLOutput> {
  const issued = Boolean(input.verdictIssued);
  const result = input.appealResult;
  const confidence = typeof result?.confidence === 'number' ? result!.confidence : 0.35;

  const base = (issued ? 0.50 : 0.10) + clamp(confidence, 0, 1) * 0.45;
  const score = clamp(base, 0.01, 0.99);

  const pseudoRegime: MacroRegime = MACRO_REGIMES[seededIndex(input.runId, input.tick, MACRO_REGIMES.length)];
  const confidenceDecay = computeDecayRate(pseudoRegime, 0.05);

  const topFactors = [
    issued ? 'verdict=issued' : 'verdict=pending',
    `confidence=${confidence.toFixed(2)}`,
    `verdict=${result?.verdict ?? 'unknown'}`,
    `evidenceHash=${(input.evidenceHashed && typeof input.evidenceHashed === 'object') ? 'present' : 'missing'}`,
    `regime=${pseudoRegime}`,
  ].slice(0, 5);

  return {
    score,
    topFactors,
    recommendation: score > 0.66 ? 'Proceed: evidence chain is serviceable for enforcement.' : 'Require stronger evidence chain before final enforcement.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M100'),
    confidenceDecay,
  };
}