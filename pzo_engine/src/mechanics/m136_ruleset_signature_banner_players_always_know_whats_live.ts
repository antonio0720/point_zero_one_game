// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m136_ruleset_signature_banner_players_always_know_whats_live.ts
//
// Mechanic : M136 — Ruleset Signature Banner: Players Always Know Whats Live
// Family   : ops   Layer: season_runtime   Priority: 1   Batch: 3
// ML Pair  : m136a
// Deps     : M19
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
  REGIME_MULTIPLIERS
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

// ── Import Anchors ──────────────────────────────────────────────────────────
// Ensures the generator-wide import set is always "used" in-module (types + values),
// without mutating exec_hook behavior.

export type M136_ImportedTypesAnchor = {
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

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M136Input {
  activeRuleset?: boolean;
  rulesVersion?: string;
  stateRunId?: string;

  // Optional (engine may pass additional context; safe structural typing)
  stateTick?: number;
  runId?: string;
  seed?: string;
  stateMacroRegime?: MacroRegime;
  stateRunPhase?: RunPhase;
  statePressureTier?: PressureTier;

  // Optional acknowledgement plumbing (UI/server may echo back tokens/hashes)
  playerAckToken?: string;
  lastAcknowledgedSignatureHash?: string;
  playerAcknowledged?: unknown;
}

export interface M136Output {
  bannerDisplayed: unknown;
  rulesetSignature: unknown;
  playerAcknowledged: unknown;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M136Event = 'RULESET_SIGNATURE_SHOWN' | 'RULESET_VERSION_CONFIRMED' | 'PLAYER_ACKNOWLEDGED';

export interface M136TelemetryPayload extends MechanicTelemetryPayload {
  event: M136Event;
  mechanic_id: 'M136';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M136_BOUNDS = {
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

function m136DerivePhase(stateTick: number): RunPhase {
  const t = clamp(stateTick, 0, RUN_TOTAL_TICKS - 1);
  const third = Math.max(1, Math.floor(RUN_TOTAL_TICKS / 3));
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m136NormalizeRegime(r: unknown): MacroRegime {
  switch (r) {
    case 'BULL':
    case 'NEUTRAL':
    case 'BEAR':
    case 'CRISIS':
      return r;
    // deterministic mappings for stray labels that may leak in
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

function m136DeriveRegimeFromSchedule(tick: number, schedule: MacroEvent[], fallback: MacroRegime): MacroRegime {
  if (!schedule || schedule.length === 0) return fallback;
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const sorted = [...schedule].sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));
  let regime: MacroRegime = fallback;
  for (const ev of sorted) {
    if ((ev.tick ?? 0) > t) break;
    if (ev.regimeChange) regime = m136NormalizeRegime(ev.regimeChange);
  }
  return regime;
}

function m136InChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  if (!windows || windows.length === 0) return false;
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  for (const w of windows) {
    if (t >= w.startTick && t <= w.endTick) return true;
  }
  return false;
}

function m136DerivePressureTier(runPhase: RunPhase, inChaos: boolean, macroRegime: MacroRegime): PressureTier {
  // Deterministic + simple: chaos bumps tier; crisis regime bumps tier; late phase bumps tier.
  let score = 0;

  if (runPhase === 'MID') score += 1;
  if (runPhase === 'LATE') score += 2;

  if (inChaos) score += 2;

  if (macroRegime === 'BEAR') score += 1;
  if (macroRegime === 'CRISIS') score += 2;

  if (score >= 5) return 'CRITICAL';
  if (score >= 3) return 'HIGH';
  if (score >= 1) return 'MEDIUM';
  return 'LOW';
}

function m136ShortSig(hash: string, n: number): string {
  const h = String(hash ?? '');
  return h.length <= n ? h : h.slice(0, n);
}

function m136ExtractPriorAckHash(input: M136Input): string {
  if (typeof input.lastAcknowledgedSignatureHash === 'string' && input.lastAcknowledgedSignatureHash.trim()) {
    return input.lastAcknowledgedSignatureHash.trim();
  }
  const pa = input.playerAcknowledged;
  if (pa && typeof pa === 'object') {
    const anyPa = pa as Record<string, unknown>;
    const h = anyPa.signatureHash ?? anyPa.rulesetSignatureHash ?? anyPa.lastAcknowledgedSignatureHash;
    if (typeof h === 'string' && h.trim()) return h.trim();
  }
  return '';
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * rulesetSignatureBanner
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function rulesetSignatureBanner(
  input: M136Input,
  emit: MechanicEmitter,
): M136Output {
  const stateTick = clamp(((input.stateTick as number) ?? 0), 0, RUN_TOTAL_TICKS - 1);

  const activeRuleset = Boolean(input.activeRuleset);
  const rulesVersion = String(input.rulesVersion ?? '').trim() || '0.0.0';

  const runId =
    (typeof input.stateRunId === 'string' && input.stateRunId.trim())
      ? input.stateRunId.trim()
      : (typeof input.runId === 'string' && input.runId.trim())
        ? input.runId.trim()
        : computeHash(JSON.stringify({ mid: 'M136', t: stateTick, v: rulesVersion, a: activeRuleset }));

  const baseSeed =
    (typeof input.seed === 'string' && input.seed.trim())
      ? input.seed.trim()
      : computeHash(`${runId}:${rulesVersion}:${activeRuleset ? 1 : 0}:${stateTick}:M136`);

  // Deterministic macro fabric (keeps shared imports “truly live”).
  const macroSchedule = buildMacroSchedule(baseSeed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(baseSeed, CHAOS_WINDOWS_PER_RUN);

  const runPhase: RunPhase = input.stateRunPhase ?? m136DerivePhase(stateTick);
  const fallbackRegime: MacroRegime = m136NormalizeRegime(input.stateMacroRegime ?? 'NEUTRAL');
  const macroRegime: MacroRegime = m136DeriveRegimeFromSchedule(stateTick, macroSchedule, fallbackRegime);

  const inChaos = m136InChaosWindow(stateTick, chaosWindows);
  const pressureTier: PressureTier = input.statePressureTier ?? m136DerivePressureTier(runPhase, inChaos, macroRegime);

  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const decay = computeDecayRate(macroRegime, M136_BOUNDS.BASE_DECAY_RATE);

  // Pool & deck hints (ties banner to economy for UI/debug/audit).
  const weightedPool = buildWeightedPool(`${baseSeed}:pool`, pressureW * phaseW, regimeW * regimeMult);

  const poolPick: GameCard =
    (weightedPool[seededIndex(`${baseSeed}:pick`, stateTick + 7, Math.max(1, weightedPool.length))] as GameCard | undefined) ??
    DEFAULT_CARD;

  const oppHint: GameCard =
    OPPORTUNITY_POOL[seededIndex(`${baseSeed}:opp`, stateTick + 17, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  const deckOrder = seededShuffle(DEFAULT_CARD_IDS, `${baseSeed}:deck`);
  const deckSig = deckOrder.slice(0, Math.min(5, DEFAULT_CARD_IDS.length));
  const deckTop = deckOrder[0] ?? DEFAULT_CARD.id;

  // Deterministic signature hash: binds banner to exact rules + derived context.
  const signatureHash = computeHash(
    JSON.stringify({
      mid: 'M136',
      runId,
      tick: stateTick,
      activeRuleset,
      rulesVersion,
      macroRegime,
      runPhase,
      pressureTier,
      inChaos,
      weights: { phaseW, pressureW, regimeW, regimeMult, exitPulse, decay },
      hints: { poolPickId: poolPick.id, oppHintId: oppHint.id, deckTop, deckSig },
      params: { macroEventsPlanned: MACRO_EVENTS_PER_RUN, chaosWindowsPlanned: CHAOS_WINDOWS_PER_RUN, runTotalTicks: RUN_TOTAL_TICKS },
    }),
  );

  const ackToken = computeHash(`${signatureHash}:ack:${runId}`);
  const priorAckHash = m136ExtractPriorAckHash(input);
  const incomingAck = String(input.playerAckToken ?? '').trim();

  const ackByHash = priorAckHash !== '' && priorAckHash === signatureHash;
  const ackByToken = incomingAck !== '' && incomingAck === ackToken;

  const acknowledged = ackByHash || ackByToken;

  // Show ruleset signature at start, on pulse, and whenever not yet acknowledged.
  const onPulse = (stateTick % M136_BOUNDS.PULSE_CYCLE) === 0;
  const onEarly = stateTick <= M136_BOUNDS.TRIGGER_THRESHOLD;
  const shouldShow = activeRuleset && (!acknowledged || onPulse || onEarly);

  const showStrength = clamp(
    (shouldShow ? 0.55 : 0.05) +
      (inChaos ? 0.10 : 0) +
      clamp((pressureW - 0.8) * 0.25, 0, 0.25) +
      clamp((1.25 - exitPulse) * 0.15, 0, 0.15) +
      clamp(decay * 0.35, 0, 0.35),
    0,
    1,
  );

  const bannerText =
    `RULESET LIVE v${rulesVersion} · ${macroRegime}/${runPhase}/${pressureTier}` +
    ` · SIG ${m136ShortSig(signatureHash, 10)}` +
    ` · CARD ${String((poolPick as unknown as { id?: unknown }).id ?? '')}`;

  const bannerDisplayed = {
    show: shouldShow,
    strength: showStrength,
    text: bannerText,
    rulesVersion,
    activeRuleset,
    signatureHash,
    ackToken,
    acknowledged,
    nextPulseInTicks: clamp(M136_BOUNDS.PULSE_CYCLE - (stateTick % M136_BOUNDS.PULSE_CYCLE), 0, M136_BOUNDS.PULSE_CYCLE),
    uiHints: {
      poolPickId: poolPick.id,
      poolPickName: (poolPick as unknown as { name?: unknown }).name ?? null,
      oppHintId: oppHint.id,
      oppHintName: (oppHint as unknown as { name?: unknown }).name ?? null,
      deckTop,
      deckSig,
    },
  } as const;

  const rulesetSignature = {
    runId,
    tick: stateTick,
    rulesVersion,
    activeRuleset,
    signatureHash,
    ackToken,
    derived: {
      macroRegime,
      runPhase,
      pressureTier,
      inChaos,
      weights: { phaseW, pressureW, regimeW, regimeMult, exitPulse, decay },
      bounds: {
        pulseCycle: M136_BOUNDS.PULSE_CYCLE,
        triggerThreshold: M136_BOUNDS.TRIGGER_THRESHOLD,
        runTotalTicks: RUN_TOTAL_TICKS,
      },
      macroSchedule,
      chaosWindows,
    },
    audit: {
      baseSeed,
      deckSig,
      poolPickId: poolPick.id,
      oppHintId: oppHint.id,
      auditHash: computeHash(`${signatureHash}:${baseSeed}:${deckTop}:${poolPick.id}:${oppHint.id}`),
    },
  } as const;

  const playerAcknowledged = {
    acknowledged,
    ackByHash,
    ackByToken,
    signatureHash,
    ackToken,
    incomingAckToken: incomingAck || null,
    priorAckHash: priorAckHash || null,
    required: activeRuleset && !acknowledged,
  } as const;

  // Always confirm the current ruleset signature (canonical).
  emit({
    event: 'RULESET_VERSION_CONFIRMED',
    mechanic_id: 'M136',
    tick: stateTick,
    runId,
    payload: {
      rulesVersion,
      activeRuleset,
      signatureHash,
      macroRegime,
      runPhase,
      pressureTier,
      inChaos,
      weights: { phaseW, pressureW, regimeW, regimeMult, exitPulse, decay },
      hints: {
        poolPickId: poolPick.id,
        oppHintId: oppHint.id,
        deckTop,
        deckSig,
      },
      pulseCycle: M136_BOUNDS.PULSE_CYCLE,
    },
  });

  if (shouldShow) {
    emit({
      event: 'RULESET_SIGNATURE_SHOWN',
      mechanic_id: 'M136',
      tick: stateTick,
      runId,
      payload: {
        rulesVersion,
        signatureHash,
        ackToken,
        bannerText,
        strength: showStrength,
        acknowledged,
      },
    });
  }

  if (acknowledged) {
    emit({
      event: 'PLAYER_ACKNOWLEDGED',
      mechanic_id: 'M136',
      tick: stateTick,
      runId,
      payload: {
        rulesVersion,
        signatureHash,
        ackByHash,
        ackByToken,
        incomingAckToken: incomingAck || null,
      },
    });
  }

  return {
    bannerDisplayed: bannerDisplayed as unknown,
    rulesetSignature: rulesetSignature as unknown,
    playerAcknowledged: playerAcknowledged as unknown,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M136MLInput {
  bannerDisplayed?: unknown; rulesetSignature?: unknown; playerAcknowledged?: unknown;
  runId: string;
  tick: number;
}

export interface M136MLOutput {
  score: number;            // 0–1
  topFactors: string[];     // max 5 plain-English factors
  recommendation: string;   // single sentence
  auditHash: string;        // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;  // 0–1, how fast this signal should decay
}

/**
 * rulesetSignatureBannerMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function rulesetSignatureBannerMLCompanion(
  input: M136MLInput,
): Promise<M136MLOutput> {
  const t = clamp(((input.tick as number) ?? 0), 0, RUN_TOTAL_TICKS - 1);

  const b = (input.bannerDisplayed && typeof input.bannerDisplayed === 'object')
    ? (input.bannerDisplayed as Record<string, unknown>)
    : null;

  const shown = b ? Boolean(b.show) : false;
  const acknowledged = b ? Boolean(b.acknowledged) : false;

  const base = shown ? (acknowledged ? 0.55 : 0.75) : 0.20;
  const score = clamp(base + clamp(Object.keys(input).length * 0.01, 0, 0.15) - clamp(t / RUN_TOTAL_TICKS, 0, 1) * 0.05, 0.01, 0.99);

  const topFactors = [
    shown ? 'Signature shown' : 'Signature not shown',
    acknowledged ? 'Player acknowledged' : 'Awaiting acknowledgement',
    `tick=${t}`,
  ].slice(0, 5);

  return {
    score,
    topFactors,
    recommendation: acknowledged ? 'No action needed; keep ruleset visible in settings.' : 'Prompt acknowledgement of current ruleset signature.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M136'),
    confidenceDecay: 0.05,
  };
}