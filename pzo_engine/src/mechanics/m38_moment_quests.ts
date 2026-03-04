// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m38_moment_quests.ts
//
// Mechanic : M38 — Moment Quests
// Family   : achievement_engine   Layer: season_runtime   Priority: 2   Batch: 2
// ML Pair  : m38a
// Deps     : M22, M36
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

// ── Import Anchors (keep every import “accessible” + used) ───────────────────

export const M38_IMPORTED_SYMBOLS = {
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

export type M38_ImportedTypesAnchor = {
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

// ── Local reward contract (mechanic-specific; not in shared types.ts) ────────

export type QuestRewardKind = 'CARD' | 'CURRENCY';

export interface QuestReward {
  id: string; // stable hash for server verification
  kind: QuestRewardKind;
  amount?: number; // for CURRENCY
  card?: GameCard; // for CARD
  meta: Record<string, unknown>;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M38Input {
  /**
   * Optional stable run identifier. If omitted, derived deterministically from input snapshot.
   */
  runId?: string;

  /**
   * Optional tick override. If omitted, prefers momentEvent.tick; else 0.
   */
  tick?: number;

  /**
   * Master switch: if false, M38 emits nothing and returns no updates.
   */
  activeQuests?: boolean;

  /**
   * Incoming “moment” from upstream (UI, engine, or social system).
   */
  momentEvent?: MomentEvent;

  /**
   * Optional proof token to bind reward issuance to a verifiable artifact.
   */
  proofCard?: ProofCard | null;
}

export interface M38Output {
  questProgressUpdated: boolean;
  questCompleted: boolean;
  questReward: QuestReward | null;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M38Event = 'QUEST_PROGRESS' | 'QUEST_COMPLETED' | 'QUEST_REWARD_ISSUED';

export interface M38TelemetryPayload extends MechanicTelemetryPayload {
  event: M38Event;
  mechanic_id: 'M38';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M38_BOUNDS = {
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

// ── Internal helpers (strict + deterministic) ──────────────────────────────

function m38DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m38InChaosWindow(tick: number, chaos: ChaosWindow[]): boolean {
  for (const w of chaos) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m38RegimeAtTick(tick: number, schedule: MacroEvent[]): MacroRegime {
  if (!schedule || schedule.length === 0) return 'NEUTRAL';
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);

  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m38PressureTier(tick: number, phase: RunPhase, chaos: ChaosWindow[]): PressureTier {
  if (m38InChaosWindow(tick, chaos)) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

type M38Context = {
  seed: string;
  runId: string;
  tick: number;
  phase: RunPhase;
  regime: MacroRegime;
  pressure: PressureTier;
  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];
  inChaos: boolean;

  pressureWeight: number;
  phaseWeight: number;
  regimeWeight: number;
  regimeMultiplier: number;
  exitPulse: number;
  decayRate: number;

  deckIds: string[];
  oppPick: GameCard;
  rewardPoolPick: GameCard;

  pulseFrac: number;
  bonusWindow: boolean;
};

function m38BuildContext(input: M38Input): M38Context {
  const inferredTick = input.tick ?? input.momentEvent?.tick ?? 0;
  const tick = clamp(Number(inferredTick), 0, RUN_TOTAL_TICKS - 1);

  const runId = String(input.runId ?? computeHash(JSON.stringify({ ...input, tick })));
  const seed = computeHash(`${runId}:M38:${tick}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m38DerivePhase(tick);
  const regime = m38RegimeAtTick(tick, macroSchedule);
  const pressure = m38PressureTier(tick, phase, chaosWindows);
  const inChaos = m38InChaosWindow(tick, chaosWindows);

  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;
  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const decayRate = computeDecayRate(regime, M38_BOUNDS.BASE_DECAY_RATE);

  const deckIds = seededShuffle(DEFAULT_CARD_IDS, seed);
  const oppIdx = seededIndex(seed, tick + 17, OPPORTUNITY_POOL.length);
  const oppPick = OPPORTUNITY_POOL[oppIdx] ?? DEFAULT_CARD;

  const weightedPool = buildWeightedPool(seed + ':reward', pressureWeight * phaseWeight, regimeWeight);
  const poolIdx = seededIndex(seed, tick + 33, Math.max(1, weightedPool.length));
  const rewardPoolPick = weightedPool[poolIdx] ?? oppPick ?? DEFAULT_CARD;

  const pulseFrac = clamp((tick % M38_BOUNDS.PULSE_CYCLE) / M38_BOUNDS.PULSE_CYCLE, 0, 1);
  const bonusWindow = !inChaos && pulseFrac <= 0.25;

  return {
    seed,
    runId,
    tick,
    phase,
    regime,
    pressure,
    macroSchedule,
    chaosWindows,
    inChaos,
    pressureWeight,
    phaseWeight,
    regimeWeight,
    regimeMultiplier,
    exitPulse,
    decayRate,
    deckIds,
    oppPick,
    rewardPoolPick,
    pulseFrac,
    bonusWindow,
  };
}

function m38ComputeQuestDelta(moment: MomentEvent, ctx: M38Context): number {
  // Deterministic, bounded “progress delta” derived from moment properties + macro context.
  const base = clamp(moment.highlight.length / 120, 0, 1); // longer highlight => more progress (bounded)
  const shareBoost = moment.shareReady ? 0.25 : 0.0;
  const windowBoost = ctx.bonusWindow ? 0.15 : 0.0;
  const chaosPenalty = ctx.inChaos ? 0.20 : 0.0;

  const env = clamp((ctx.regimeMultiplier * ctx.exitPulse) / 1.25, 0.4, 1.2);
  const delta = (base + shareBoost + windowBoost - chaosPenalty) * env;

  return clamp(delta, 0, 1);
}

function m38DetermineCompletion(moment: MomentEvent, ctx: M38Context, delta: number): boolean {
  // Completion is deterministic and does NOT require local mutable progress state:
  // - shareReady moments are “proofable” and can complete
  // - otherwise require a sufficiently strong delta and not in chaos
  if (moment.shareReady) return true;
  if (ctx.inChaos) return false;
  return delta >= 0.78;
}

function m38IssueReward(ctx: M38Context, completed: boolean, moment: MomentEvent, delta: number, proof: ProofCard | null | undefined): QuestReward | null {
  if (!completed) return null;

  const rewardKindIdx = seededIndex(ctx.seed + ':kind', ctx.tick + 5, 100);
  const kind: QuestRewardKind = rewardKindIdx < 55 ? 'CURRENCY' : 'CARD';

  const proofHash = proof?.hash ?? '';
  const rewardId = computeHash(
    JSON.stringify({
      mid: 'M38',
      runId: ctx.runId,
      tick: ctx.tick,
      momentType: moment.type,
      momentTick: moment.tick,
      kind,
      pick: ctx.rewardPoolPick.id,
      deckTop: ctx.deckIds[0] ?? '',
      proofHash,
    }),
  );

  if (kind === 'CARD') {
    return {
      id: rewardId,
      kind,
      card: ctx.rewardPoolPick,
      meta: {
        regime: ctx.regime,
        phase: ctx.phase,
        pressure: ctx.pressure,
        inChaos: ctx.inChaos,
        bonusWindow: ctx.bonusWindow,
        delta: Number(delta.toFixed(4)),
        momentType: moment.type,
        proofHash,
      },
    };
  }

  // Currency reward: scaled by environment + delta, bounded by MAX_AMOUNT.
  const envMult = clamp(ctx.regimeMultiplier * ctx.exitPulse, 0.3, 2.0);
  const decayDampen = clamp(1 - ctx.decayRate, 0.15, 0.99);
  const amountRaw = Math.round(M38_BOUNDS.MAX_AMOUNT * 0.06 * envMult * decayDampen * clamp(0.65 + delta * 0.55, 0, 1.2));
  const amount = clamp(amountRaw, 0, M38_BOUNDS.MAX_AMOUNT);

  return {
    id: rewardId,
    kind,
    amount,
    meta: {
      regime: ctx.regime,
      phase: ctx.phase,
      pressure: ctx.pressure,
      inChaos: ctx.inChaos,
      bonusWindow: ctx.bonusWindow,
      decayRate: Number(ctx.decayRate.toFixed(4)),
      delta: Number(delta.toFixed(4)),
      momentType: moment.type,
      proofHash,
    },
  };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * momentQuestEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function momentQuestEngine(input: M38Input, emit: MechanicEmitter): M38Output {
  const activeQuests = Boolean(input.activeQuests);

  if (!activeQuests) {
    return {
      questProgressUpdated: false,
      questCompleted: false,
      questReward: null,
    };
  }

  const momentEvent = input.momentEvent;
  if (!momentEvent) {
    return {
      questProgressUpdated: false,
      questCompleted: false,
      questReward: null,
    };
  }

  const ctx = m38BuildContext(input);
  const delta = m38ComputeQuestDelta(momentEvent, ctx);
  const completed = m38DetermineCompletion(momentEvent, ctx, delta);
  const reward = m38IssueReward(ctx, completed, momentEvent, delta, input.proofCard);

  const questId = computeHash(`${ctx.runId}:M38:quest:${momentEvent.type}`);
  const questKey = `${momentEvent.type}:${questId}`;

  emit({
    event: 'QUEST_PROGRESS',
    mechanic_id: 'M38',
    tick: ctx.tick,
    runId: ctx.runId,
    payload: {
      questId,
      questKey,
      delta: Number(delta.toFixed(4)),
      moment: {
        type: momentEvent.type,
        tick: momentEvent.tick,
        shareReady: momentEvent.shareReady,
      },
      env: {
        regime: ctx.regime,
        phase: ctx.phase,
        pressure: ctx.pressure,
        inChaos: ctx.inChaos,
        bonusWindow: ctx.bonusWindow,
        decayRate: Number(ctx.decayRate.toFixed(4)),
      },
      picks: {
        opp: { id: ctx.oppPick.id, name: ctx.oppPick.name },
        reward: { id: ctx.rewardPoolPick.id, name: ctx.rewardPoolPick.name },
        deckTop: ctx.deckIds[0] ?? '',
      },
    },
  } as M38TelemetryPayload);

  if (completed) {
    emit({
      event: 'QUEST_COMPLETED',
      mechanic_id: 'M38',
      tick: ctx.tick,
      runId: ctx.runId,
      payload: {
        questId,
        questKey,
        completionMode: momentEvent.shareReady ? 'SHARE_READY' : 'DELTA_THRESHOLD',
        delta: Number(delta.toFixed(4)),
      },
    } as M38TelemetryPayload);
  }

  if (reward) {
    emit({
      event: 'QUEST_REWARD_ISSUED',
      mechanic_id: 'M38',
      tick: ctx.tick,
      runId: ctx.runId,
      payload: {
        questId,
        questKey,
        reward,
      },
    } as M38TelemetryPayload);
  }

  return {
    questProgressUpdated: true,
    questCompleted: completed,
    questReward: reward,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M38MLInput {
  questProgressUpdated?: boolean;
  questCompleted?: boolean;
  questReward?: QuestReward | null;
  runId: string;
  tick: number;
}

export interface M38MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion) (djb2 here)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * momentQuestEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function momentQuestEngineMLCompanion(input: M38MLInput): Promise<M38MLOutput> {
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const runId = String(input.runId ?? '');
  const seed = computeHash(`${runId}:M38:ml:${tick}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m38DerivePhase(tick);
  const regime = m38RegimeAtTick(tick, macroSchedule);
  const pressure = m38PressureTier(tick, phase, chaosWindows);
  const inChaos = m38InChaosWindow(tick, chaosWindows);

  const decay = computeDecayRate(regime, M38_BOUNDS.BASE_DECAY_RATE);

  const updated = Boolean(input.questProgressUpdated);
  const completed = Boolean(input.questCompleted);
  const rewardKind = input.questReward?.kind ?? 'CURRENCY';

  const base = updated ? 0.35 : 0.15;
  const compBoost = completed ? 0.45 : 0.0;
  const rewardBoost = input.questReward ? (rewardKind === 'CARD' ? 0.10 : 0.08) : 0.0;
  const chaosPenalty = inChaos ? 0.12 : 0.0;

  const score = clamp(base + compBoost + rewardBoost - chaosPenalty, 0.01, 0.99);

  const topFactors = [
    `tick=${tick}/${RUN_TOTAL_TICKS} phase=${phase}`,
    `regime=${regime} pressure=${pressure} chaos=${inChaos ? 'Y' : 'N'}`,
    `questUpdated=${updated ? 'Y' : 'N'} completed=${completed ? 'Y' : 'N'}`,
    `reward=${input.questReward ? `${rewardKind}:${input.questReward.id}` : 'NONE'}`,
    `decay=${decay.toFixed(2)} pulseMult=${(EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0).toFixed(2)}`,
  ].slice(0, 5);

  const recommendation = !updated
    ? 'No quest activity: generate a share-ready moment during a clean pulse window.'
    : completed
      ? input.questReward
        ? rewardKind === 'CARD'
          ? 'Quest completed: equip/route the reward card for maximum compounding.'
          : 'Quest completed: convert currency reward into the next high-EV opportunity.'
        : 'Quest completed: claim reward and lock proof for verification.'
      : 'Quest in progress: avoid chaos windows and aim for a share-ready moment to finish fast.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify({ mid: 'M38', ...input }) + ':ml:M38'),
    confidenceDecay: decay,
  };
}