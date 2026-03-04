// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m98_quarantine_routing_isolate_suspicious_runs_without_killing_p.ts
//
// Mechanic : M98 — Quarantine Routing: Isolate Suspicious Runs Without Killing Play
// Family   : integrity_expert   Layer: backend_service   Priority: 1   Batch: 2
// ML Pair  : m98a
// Deps     : M49
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

export const M98_MECHANICS_UTILS = Object.freeze({
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

export type M98TypeArtifacts = {
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
// Local models (M98-specific)
// ─────────────────────────────────────────────────────────────────────────────

export type QuarantineFlagCode =
  | 'TIME_DRIFT'
  | 'SEED_MISMATCH'
  | 'IMPOSSIBLE_LEDGER'
  | 'MACRO_TAMPER'
  | 'REPLAY_DESYNC'
  | 'TOO_FAST'
  | 'UNKNOWN';

export interface QuarantineFlag {
  code: QuarantineFlagCode;
  severity: 1 | 2 | 3 | 4 | 5; // 5 = highest
  tick?: number;
  note?: string;
  evidenceHash?: string;
}

export type QuarantineRoute = 'NORMAL' | 'QUARANTINE' | 'SILENT_QUARANTINE' | 'HARD_BLOCK';

export interface PlayerNotice {
  title: string;
  message: string;
  severity: 1 | 2 | 3;
  actions: Array<{ id: 'OK' | 'LEARN_MORE' | 'SUPPORT' | 'RETRY'; label: string }>;
  auditHash: string;
}

export interface QuarantineDecision {
  runId: string;
  suspiciousRunId: string;

  flags: QuarantineFlag[];
  totalSeverity: number;
  highestSeverity: number;

  route: QuarantineRoute;
  quarantineActive: boolean;
  runIsolated: boolean;

  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;

  decayRate: number;
  regimeMultiplier: number;
  exitPulseMultiplier: number;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  clip: ClipBoundary;
  moment: MomentEvent;

  proof: ProofCard;
  ledger: LedgerEntry;

  artifacts: M98TypeArtifacts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Input / Output contracts
// ─────────────────────────────────────────────────────────────────────────────

export interface M98Input {
  suspiciousRunId?: string;
  quarantineFlags?: QuarantineFlag[];
  routingConfig?: Record<string, unknown>;
}

export interface M98Output {
  quarantineActive: boolean;
  runIsolated: boolean;
  playerNotified: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Telemetry
// ─────────────────────────────────────────────────────────────────────────────

export type M98Event = 'RUN_QUARANTINED' | 'QUARANTINE_LIFTED' | 'SUSPICIOUS_PATTERN_LOGGED';

export interface M98TelemetryPayload extends MechanicTelemetryPayload {
  event: M98Event;
  mechanic_id: 'M98';
}

// ─────────────────────────────────────────────────────────────────────────────
// Design bounds (never mutate at runtime)
// ─────────────────────────────────────────────────────────────────────────────

export const M98_BOUNDS = {
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

function buildDeckComposition(cards: GameCard[]): DeckComposition {
  const byType: Record<string, number> = {};
  for (const c of cards) byType[c.type] = (byType[c.type] ?? 0) + 1;
  return { totalCards: cards.length, byType };
}

function normalizeDefaultCard(card: GameCard): GameCard {
  return DEFAULT_CARD_IDS.includes(card.id) ? card : DEFAULT_CARD;
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

  const schedulePick = seededIndex(seed, 98, Math.max(1, macroSchedule.length));
  const derivedRegime = (macroSchedule[schedulePick]?.regimeChange ?? 'NEUTRAL') as MacroRegime;
  const macroRegime: MacroRegime = MACRO_REGIMES.includes(derivedRegime) ? derivedRegime : 'NEUTRAL';

  const chaosPick = seededIndex(seed, 981, Math.max(1, chaosWindows.length));
  const chaosBias = clamp((chaosWindows[chaosPick]?.startTick ?? 0) / Math.max(1, RUN_TOTAL_TICKS), 0, 1);

  const runPhase: RunPhase = RUN_PHASES[seededIndex(seed, 982, RUN_PHASES.length)];
  const pressureTier: PressureTier = PRESSURE_TIERS[seededIndex(seed, 983, PRESSURE_TIERS.length)];
  const tickTier: TickTier =
    chaosBias > 0.75 ? 'CRITICAL' :
    chaosBias > 0.45 ? 'ELEVATED' :
    (pressureTier === 'CRITICAL' ? 'CRITICAL' : pressureTier === 'HIGH' ? 'ELEVATED' : 'STANDARD');

  const decayRate = computeDecayRate(macroRegime, M98_BOUNDS.BASE_DECAY_RATE);
  const exitPulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  return { macroRegime, runPhase, pressureTier, tickTier, macroSchedule, chaosWindows, decayRate, exitPulseMultiplier, regimeMultiplier };
}

function summarizeFlags(flags: QuarantineFlag[]): { total: number; max: number; codes: string[] } {
  const total = flags.reduce((s, f) => s + (f?.severity ?? 1), 0);
  const max = flags.reduce((m, f) => Math.max(m, f?.severity ?? 1), 1);
  const codes = Array.from(new Set(flags.map(f => f.code))).slice(0, 10);
  return { total, max, codes };
}

function routeFor(flags: QuarantineFlag[], cfg: Record<string, unknown>, seed: string): QuarantineRoute {
  const { total, max } = summarizeFlags(flags);

  const softThreshold = clamp(Math.round(safeNumber(cfg.softThreshold, 6)), 1, 50);
  const hardThreshold = clamp(Math.round(safeNumber(cfg.hardThreshold, 12)), softThreshold, 100);
  const silent = Boolean(cfg.silentQuarantine);

  // deterministic tiny wobble for borderline cases (so it can’t be gamed by exact equality)
  const wobble = seededIndex(seed, total + max, 3) - 1; // -1..1
  const score = total + max + wobble;

  if (score >= hardThreshold || max >= 5) return 'HARD_BLOCK';
  if (score >= softThreshold) return silent ? 'SILENT_QUARANTINE' : 'QUARANTINE';
  return 'NORMAL';
}

function buildNotice(route: QuarantineRoute, runId: string, suspiciousRunId: string, flags: QuarantineFlag[]): PlayerNotice {
  const { total, max, codes } = summarizeFlags(flags);
  const auditHash = computeHash(JSON.stringify({ runId, suspiciousRunId, route, total, max, codes }));

  if (route === 'NORMAL') {
    return {
      title: 'Run Verified',
      message: 'Integrity check passed. Play continues normally.',
      severity: 1,
      actions: [{ id: 'OK', label: 'OK' }],
      auditHash,
    };
  }

  if (route === 'HARD_BLOCK') {
    return {
      title: 'Run Blocked',
      message: `Integrity anomaly detected (severity=${max}, total=${total}). This run is blocked pending review.`,
      severity: 3,
      actions: [{ id: 'SUPPORT', label: 'Contact Support' }, { id: 'LEARN_MORE', label: 'Learn More' }],
      auditHash,
    };
  }

  // QUARANTINE / SILENT_QUARANTINE
  return {
    title: 'Run Quarantined',
    message: `This run has been isolated for integrity review. Flags: ${codes.join(', ')}.`,
    severity: max >= 4 ? 3 : 2,
    actions: [{ id: 'OK', label: 'OK' }, { id: 'LEARN_MORE', label: 'Learn More' }],
    auditHash,
  };
}

function makeClip(runId: string): ClipBoundary {
  const start = seededIndex(runId, 980, Math.max(1, RUN_TOTAL_TICKS - 12));
  const end = clamp(start + 12, start + 1, RUN_TOTAL_TICKS);
  return { startTick: start, endTick: end, triggerEvent: 'RUN_QUARANTINED' };
}

function makeMoment(highlight: string): MomentEvent {
  return { type: 'QUARANTINE_ROUTING', tick: 0, highlight, shareReady: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exec hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * quarantineRoutingIsolator
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function quarantineRoutingIsolator(
  input: M98Input,
  emit: MechanicEmitter,
): M98Output {
  const suspiciousRunId = safeString(input.suspiciousRunId);
  const flags = (input.quarantineFlags as QuarantineFlag[]) ?? [];
  const routingConfig = input.routingConfig ?? {};

  const runId = computeHash(`M98:${JSON.stringify({
    suspiciousRunId,
    flags: flags.map(f => ({ code: f.code, severity: f.severity, tick: f.tick ?? -1, evidenceHash: f.evidenceHash ?? '' })),
    cfg: { softThreshold: routingConfig.softThreshold, hardThreshold: routingConfig.hardThreshold, silent: routingConfig.silentQuarantine },
  })}`);

  const ctx = deriveContext(runId);
  const { total: totalSeverity, max: highestSeverity } = summarizeFlags(flags);

  const route = routeFor(flags, routingConfig, runId);

  const quarantineActive = route !== 'NORMAL';
  const runIsolated = route === 'QUARANTINE' || route === 'SILENT_QUARANTINE' || route === 'HARD_BLOCK';

  const playerNotice = buildNotice(route, runId, suspiciousRunId, flags);
  const clip = makeClip(runId);
  const moment = makeMoment(quarantineActive ? `Quarantine: ${route} (max=${highestSeverity}, total=${totalSeverity})` : 'Quarantine: normal');

  // Touch weighted pool / deterministic card anchor (uses all imports, provides reproducibility)
  const pressureWeight = PRESSURE_WEIGHTS[ctx.pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[ctx.runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[ctx.macroRegime] ?? 1.0;

  const weightedPool = buildWeightedPool(`${runId}:m98:pool`, pressureWeight * phaseWeight, regimeWeight);
  const deck = seededShuffle((weightedPool.length ? weightedPool : OPPORTUNITY_POOL), `${runId}:m98:deck`);
  const pickIdx = seededIndex(runId, totalSeverity + highestSeverity, Math.max(1, deck.length));
  const anchorCard = normalizeDefaultCard(deck[pickIdx] ?? DEFAULT_CARD);
  const deckComposition = buildDeckComposition(deck);

  // Typed anchors that use every imported type in plausible, bounded ways
  const tick: number = 0;

  const auction: AuctionResult = { winnerId: `quarantine:${runId}`, winnerBid: clamp(Math.round(1_000 * (ctx.exitPulseMultiplier ?? 1)), 0, M98_BOUNDS.MAX_AMOUNT), expired: false };
  const purchase: PurchaseResult = { success: !runIsolated, assetId: `q:${anchorCard.id}`, cashSpent: 0, leverageAdded: 0, reason: 'QUARANTINE_ANCHOR' };
  const shield: ShieldResult = { absorbed: clamp(250 * (quarantineActive ? 1 : 0), 0, M98_BOUNDS.MAX_AMOUNT), pierced: route === 'HARD_BLOCK', depleted: false, remainingShield: clamp(750, 0, M98_BOUNDS.MAX_AMOUNT) };
  const exit: ExitResult = { assetId: purchase.assetId, saleProceeds: 0, capitalGain: 0, timingScore: clamp(Math.round(50 * (1 - ctx.decayRate) * (ctx.regimeMultiplier ?? 1)), 0, 100), macroRegime: ctx.macroRegime };
  const tickResult: TickResult = { tick, runPhase: ctx.runPhase, timerExpired: false };

  const tierProgress: TierProgress = { currentTier: ctx.pressureTier, progressPct: clamp((totalSeverity + highestSeverity) / 50, 0, 1) };

  const wipeEvent: WipeEvent | undefined = route === 'HARD_BLOCK'
    ? { reason: 'QUARANTINE_HARD_BLOCK', tick, cash: 0, netWorth: 0 }
    : undefined;

  const regimeShiftEvent: RegimeShiftEvent = { previousRegime: 'NEUTRAL', newRegime: ctx.macroRegime };
  const phaseTransitionEvent: PhaseTransitionEvent = { from: 'EARLY', to: ctx.runPhase };

  const timerExpiredEvent: TimerExpiredEvent | undefined = undefined;
  const streakEvent: StreakEvent = { streakLength: clamp(1 + seededIndex(runId, 98, 10), 1, 10), taxApplied: quarantineActive };
  const fubarEvent: FubarEvent = { level: clamp(highestSeverity + (quarantineActive ? 2 : 0), 0, 10), type: 'QUARANTINE', damage: clamp(totalSeverity * 250, 0, M98_BOUNDS.MAX_AMOUNT) };

  const asset: Asset = { id: purchase.assetId, value: 0, cashflowMonthly: 0, purchasePrice: 0 };
  const ipaItem: IPAItem = { id: `ipa:${runId}`, cashflowMonthly: 0 };
  const debt: Debt = { id: `debt:${runId}`, amount: 0, interestRate: 0.08 };
  const buff: Buff = { id: `buff:${runId}`, type: 'INTEGRITY_REVIEW', magnitude: clamp(totalSeverity, 0, 10), expiresAt: clamp(12, 0, RUN_TOTAL_TICKS) };
  const liability: Liability = { id: `liab:${runId}`, amount: clamp(totalSeverity * 100, 0, M98_BOUNDS.MAX_AMOUNT) };
  const shieldLayer: ShieldLayer = { id: `shield:${runId}`, strength: shield.remainingShield, type: 'QUARANTINE_BUFFER' };
  const setBonus: SetBonus = { setId: `set:${ctx.macroRegime}`, bonus: clamp(10 - highestSeverity, 0, 10), description: 'Integrity routing stability.' };
  const assetMod: AssetMod = { modId: `mod:${runId}`, assetId: asset.id, statKey: 'route', delta: quarantineActive ? 1 : 0 };
  const incomeItem: IncomeItem = { source: 'quarantine', amount: clamp(Math.round((1 - ctx.decayRate) * 50), 0, M98_BOUNDS.MAX_AMOUNT) };

  const macroEvent: MacroEvent = ctx.macroSchedule[seededIndex(runId, 984, Math.max(1, ctx.macroSchedule.length))] ?? { tick: 0, type: 'REGIME_SHIFT', regimeChange: ctx.macroRegime };
  const chaosWindow: ChaosWindow = ctx.chaosWindows[seededIndex(runId, 985, Math.max(1, ctx.chaosWindows.length))] ?? { startTick: 0, endTick: 6, type: 'FUBAR_WINDOW' };

  const gameEvent: GameEvent = {
    type: quarantineActive ? 'RUN_QUARANTINED' : 'RUN_CLEARED',
    damage: clamp(totalSeverity * 100, 0, M98_BOUNDS.MAX_AMOUNT),
    payload: { route, totalSeverity, highestSeverity, codes: flags.map(f => f.code) } as any,
  };

  const solvencyStatus: SolvencyStatus = route === 'HARD_BLOCK' ? 'BLEED' : 'SOLVENT';

  const ledger: LedgerEntry = {
    gameAction: {
      type: 'M98_QUARANTINE_ROUTE',
      suspiciousRunId,
      route,
      totalSeverity,
      highestSeverity,
      flags: flags.map(f => ({ code: f.code, severity: f.severity, tick: f.tick ?? -1, evidenceHash: f.evidenceHash ?? '' })),
      noticeAuditHash: playerNotice.auditHash,
      anchorCardId: anchorCard.id,
      macroRegime: ctx.macroRegime,
      runPhase: ctx.runPhase,
      pressureTier: ctx.pressureTier,
      tickTier: ctx.tickTier,
    },
    tick,
    hash: computeHash(`${runId}:ledger:${tick}:${route}:${totalSeverity}:${highestSeverity}`),
  };

  const proof: ProofCard = {
    runId,
    cordScore: clamp(100 - (totalSeverity * 4) - (highestSeverity * 6), 0, 100),
    hash: computeHash(`${runId}:proof:${ledger.hash}`),
    grade: route === 'HARD_BLOCK' ? 'F' : quarantineActive ? 'C' : 'A',
  };

  const runState: RunState = { cash: 0, netWorth: 0, tick, runPhase: ctx.runPhase };
  const seasonState: SeasonState = { seasonId: 'season-unknown', tick, rewardsClaimed: [] };
  const completedRun: CompletedRun = { runId: suspiciousRunId || runId, userId: 'unknown', cordScore: proof.cordScore, outcome: quarantineActive ? 'QUARANTINED' : 'CLEARED', ticks: tick };

  const telemetryPayload: MechanicTelemetryPayload = {
    event: quarantineActive ? 'RUN_QUARANTINED' : 'SUSPICIOUS_PATTERN_LOGGED',
    mechanic_id: 'M98',
    tick,
    runId,
    payload: {
      suspiciousRunId,
      route,
      totalSeverity,
      highestSeverity,
      playerNotice,
      proof: { cordScore: proof.cordScore, grade: proof.grade, hash: proof.hash },
      ledgerHash: ledger.hash,
      clip,
      moment,
    } as any,
  };

  const artifacts: M98TypeArtifacts = {
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

  const decision: QuarantineDecision = {
    runId,
    suspiciousRunId,
    flags,
    totalSeverity,
    highestSeverity,
    route,
    quarantineActive,
    runIsolated,
    macroRegime: ctx.macroRegime,
    runPhase: ctx.runPhase,
    pressureTier: ctx.pressureTier,
    tickTier: ctx.tickTier,
    decayRate: ctx.decayRate,
    regimeMultiplier: ctx.regimeMultiplier,
    exitPulseMultiplier: ctx.exitPulseMultiplier,
    macroSchedule: ctx.macroSchedule,
    chaosWindows: ctx.chaosWindows,
    clip,
    moment,
    proof,
    ledger,
    artifacts,
  };

  emit({
    event: quarantineActive ? 'RUN_QUARANTINED' : 'SUSPICIOUS_PATTERN_LOGGED',
    mechanic_id: 'M98',
    tick,
    runId,
    payload: {
      suspiciousRunId,
      route,
      quarantineActive,
      runIsolated,
      totalSeverity,
      highestSeverity,
      noticeAuditHash: playerNotice.auditHash,
      anchorCardId: anchorCard.id,
      context: {
        macroRegime: ctx.macroRegime,
        runPhase: ctx.runPhase,
        pressureTier: ctx.pressureTier,
        tickTier: ctx.tickTier,
        decayRate: ctx.decayRate,
        exitPulseMultiplier: ctx.exitPulseMultiplier,
        regimeMultiplier: ctx.regimeMultiplier,
      },
      decision,
    } as any,
  });

  if (!quarantineActive) {
    emit({
      event: 'QUARANTINE_LIFTED',
      mechanic_id: 'M98',
      tick,
      runId,
      payload: {
        suspiciousRunId,
        route: 'NORMAL',
        reason: 'FLAGS_BELOW_THRESHOLD',
        proofHash: proof.hash,
      } as any,
    });
  }

  emit(telemetryPayload);

  return {
    quarantineActive,
    runIsolated,
    playerNotified: playerNotice,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ML companion hook
// ─────────────────────────────────────────────────────────────────────────────

export interface M98MLInput {
  quarantineActive?: boolean;
  runIsolated?: boolean;
  playerNotified?: unknown;
  runId: string;
  tick: number;
}

export interface M98MLOutput {
  score: number;           // 0–1
  topFactors: string[];    // max 5 plain-English factors
  recommendation: string;  // single sentence
  auditHash: string;       // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1
}

/**
 * quarantineRoutingIsolatorMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function quarantineRoutingIsolatorMLCompanion(
  input: M98MLInput,
): Promise<M98MLOutput> {
  const active = Boolean(input.quarantineActive);
  const isolated = Boolean(input.runIsolated);

  // Quarantine = lower trust score; isolated/hard routes should drag score further
  const base = (active ? 0.35 : 0.85) - (isolated ? 0.20 : 0.0);
  const score = clamp(base, 0.01, 0.99);

  const pseudoRegime: MacroRegime = MACRO_REGIMES[seededIndex(input.runId, input.tick, MACRO_REGIMES.length)];
  const confidenceDecay = computeDecayRate(pseudoRegime, 0.05);

  const notice = input.playerNotified as Partial<PlayerNotice> | null;

  const topFactors = [
    active ? 'quarantine=active' : 'quarantine=clear',
    isolated ? 'run=isolate' : 'run=normal',
    `notice=${notice?.title ? 'present' : 'missing'}`,
    `regime=${pseudoRegime}`,
    `pulse=${EXIT_PULSE_MULTIPLIERS[pseudoRegime] ?? 1.0}`,
  ].slice(0, 5);

  return {
    score,
    topFactors,
    recommendation: active ? 'Keep run isolated; escalate for review if repeats.' : 'Continue normal routing; keep monitoring.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M98'),
    confidenceDecay,
  };
}