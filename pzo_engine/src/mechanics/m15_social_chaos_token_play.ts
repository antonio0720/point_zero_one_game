// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m15_social_chaos_token_play.ts
//
// Mechanic : M15 — Social Chaos Token Play
// Family   : social_engine   Layer: api_endpoint   Priority: 1   Batch: 1
// ML Pair  : m15a
// Deps     : M01
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
 * This keeps all shared imports “live” and makes them directly reachable for
 * debugging, tests, and other modules.
 */
export const M15_IMPORTED_SYMBOLS = {
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
 * (Prevents noUnusedLocals warnings under strict builds.)
 */
export type M15_ImportedTypesAnchor = {
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

// ── Local domain types (M15-only; not provided in ./types) ───────────────────

export type SocialInviteChannel = 'LINK' | 'QR' | 'CONTACTS' | 'IN_APP' | 'UNKNOWN';

export interface FriendInvitePayload {
  inviterUserId: string;
  inviteeUserId: string;
  tokenId: string;

  channel?: SocialInviteChannel;
  message?: string;

  /**
   * If explicitly false, M15 will not apply chaos and will not consume the token.
   * (Consent gating can also be enforced elsewhere; M15 still remains safe.)
   */
  consentGranted?: boolean;
}

export type SocialChaosEffectType =
  | 'NONE'
  | 'BOOST_INVITER'
  | 'BOOST_INVITEE'
  | 'DEBUFF_INVITER'
  | 'DEBUFF_INVITEE'
  | 'MIRROR_SWAP'
  | 'RISK_SPIKE';

export interface SocialChaosEffect {
  id: string;
  requestId: string;

  type: SocialChaosEffectType;

  sourceUserId: string;
  targetUserId: string;

  magnitude: number; // 0..MAX_EFFECT
  durationTicks: number; // >=0

  appliedAtTick: number;
  expiresAtTick: number;

  macroRegime: MacroRegime;
  pressureTier: PressureTier;
  runPhase: RunPhase;

  /**
   * Deterministic “flavor” tie-in to the core game pool for UI and replay auditing.
   */
  cardHint: GameCard;
  deckHintTop: string;
  opportunityHint: GameCard;

  auditHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M15Input {
  friendInvitePayload?: FriendInvitePayload;
  stateTick?: number;
}

export interface M15Output {
  socialChaosEffect: SocialChaosEffect;
  tokenConsumed: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M15Event = 'SOCIAL_TOKEN_PLAYED' | 'CHAOS_EFFECT_APPLIED' | 'TOKEN_SPENT';

export interface M15TelemetryPayload extends MechanicTelemetryPayload {
  event: M15Event;
  mechanic_id: 'M15';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M15_BOUNDS = {
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

// ── Effect catalog (deterministic selection) ───────────────────────────────

type SocialChaosCatalogEntry = {
  id: string;
  type: Exclude<SocialChaosEffectType, 'NONE'>;
  baseMagnitude: number; // unweighted
  baseDurationTicks: number;
};

export const M15_SOCIAL_CHAOS_CATALOG: SocialChaosCatalogEntry[] = [
  { id: 'sc-001', type: 'BOOST_INVITER', baseMagnitude: 3_000, baseDurationTicks: 12 },
  { id: 'sc-002', type: 'BOOST_INVITEE', baseMagnitude: 2_500, baseDurationTicks: 12 },
  { id: 'sc-003', type: 'DEBUFF_INVITER', baseMagnitude: 2_000, baseDurationTicks: 18 },
  { id: 'sc-004', type: 'DEBUFF_INVITEE', baseMagnitude: 2_000, baseDurationTicks: 18 },
  { id: 'sc-005', type: 'MIRROR_SWAP', baseMagnitude: 1_750, baseDurationTicks: 10 },
  { id: 'sc-006', type: 'RISK_SPIKE', baseMagnitude: 3_500, baseDurationTicks: 8 },
];

// ── Internal helpers (deterministic, no state mutation) ────────────────────

function m15DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m15DeriveRegimeFromSchedule(tick: number, schedule: MacroEvent[], fallback: MacroRegime): MacroRegime {
  if (!schedule || schedule.length === 0) return fallback;
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = fallback;
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m15InChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows ?? []) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m15DerivePressureTier(tick: number, phase: RunPhase, inChaos: boolean, regime: MacroRegime): PressureTier {
  if (inChaos) return 'CRITICAL';
  if (regime === 'CRISIS') return 'HIGH';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function m15NormalizeChannel(ch?: SocialInviteChannel): SocialInviteChannel {
  if (!ch) return 'UNKNOWN';
  return ch;
}

function m15NoEffect(requestId: string, tick: number): SocialChaosEffect {
  const phase = m15DerivePhase(tick);
  const regime: MacroRegime = 'NEUTRAL';
  const pressureTier: PressureTier = 'LOW';

  const deckHintTop = seededShuffle(DEFAULT_CARD_IDS, requestId + ':noeffect:deck')[0] ?? DEFAULT_CARD.id;
  const opportunityHint = OPPORTUNITY_POOL[seededIndex(requestId, tick + 1, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  const cardHint = DEFAULT_CARD;
  const auditHash = computeHash(JSON.stringify({ requestId, tick, type: 'NONE' }) + ':M15');

  return {
    id: 'sc-none',
    requestId,
    type: 'NONE',
    sourceUserId: '',
    targetUserId: '',
    magnitude: 0,
    durationTicks: 0,
    appliedAtTick: tick,
    expiresAtTick: tick,
    macroRegime: regime,
    pressureTier,
    runPhase: phase,
    cardHint,
    deckHintTop,
    opportunityHint,
    auditHash,
  };
}

function m15SelectCatalogEntry(seed: string, tick: number): SocialChaosCatalogEntry {
  const shuffled = seededShuffle(M15_SOCIAL_CHAOS_CATALOG, seed + ':catalog');
  const idx = seededIndex(seed, tick + 41, shuffled.length);
  return shuffled[idx] ?? M15_SOCIAL_CHAOS_CATALOG[0];
}

function m15ResolveTarget(
  entryType: SocialChaosEffectType,
  inviterUserId: string,
  inviteeUserId: string,
): { sourceUserId: string; targetUserId: string } {
  switch (entryType) {
    case 'BOOST_INVITER':
    case 'DEBUFF_INVITER':
      return { sourceUserId: inviteeUserId, targetUserId: inviterUserId };
    case 'BOOST_INVITEE':
    case 'DEBUFF_INVITEE':
      return { sourceUserId: inviterUserId, targetUserId: inviteeUserId };
    case 'MIRROR_SWAP':
    case 'RISK_SPIKE':
      return { sourceUserId: inviterUserId, targetUserId: inviteeUserId };
    default:
      return { sourceUserId: inviterUserId, targetUserId: inviteeUserId };
  }
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * socialChaosTokenPlay
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function socialChaosTokenPlay(input: M15Input, emit: MechanicEmitter): M15Output {
  const stateTick = clamp(((input.stateTick as number) ?? 0), 0, RUN_TOTAL_TICKS - 1);

  const friendInvitePayload = input.friendInvitePayload;
  const requestId = computeHash(JSON.stringify({ p: friendInvitePayload ?? null, t: stateTick, mid: 'M15' }));

  // Hard fail-closed: no payload => no effect, token not consumed.
  if (!friendInvitePayload) {
    const eff = m15NoEffect(requestId, stateTick);

    emit({
      event: 'SOCIAL_TOKEN_PLAYED',
      mechanic_id: 'M15',
      tick: stateTick,
      runId: requestId,
      payload: {
        ok: false,
        reason: 'missing_payload',
      },
    });

    return { socialChaosEffect: eff, tokenConsumed: false };
  }

  // Consent fail-closed: explicit false => no effect, token not consumed.
  if (friendInvitePayload.consentGranted === false) {
    const eff = m15NoEffect(requestId, stateTick);

    emit({
      event: 'SOCIAL_TOKEN_PLAYED',
      mechanic_id: 'M15',
      tick: stateTick,
      runId: requestId,
      payload: {
        ok: false,
        reason: 'consent_denied',
        inviterUserId: friendInvitePayload.inviterUserId,
        inviteeUserId: friendInvitePayload.inviteeUserId,
        tokenId: friendInvitePayload.tokenId,
        channel: m15NormalizeChannel(friendInvitePayload.channel),
      },
    });

    return { socialChaosEffect: eff, tokenConsumed: false };
  }

  const inviterUserId = friendInvitePayload.inviterUserId;
  const inviteeUserId = friendInvitePayload.inviteeUserId;
  const tokenId = friendInvitePayload.tokenId;
  const channel = m15NormalizeChannel(friendInvitePayload.channel);

  const seed = computeHash(`${requestId}:${inviterUserId}:${inviteeUserId}:${tokenId}:${channel}:${stateTick}`);

  // Deterministic macro/chaos fabric (uses shared run constants)
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const runPhase = m15DerivePhase(stateTick);
  const macroRegime = m15DeriveRegimeFromSchedule(stateTick, macroSchedule, 'NEUTRAL');
  const inChaos = m15InChaosWindow(stateTick, chaosWindows);

  const pressureTier = m15DerivePressureTier(stateTick, runPhase, inChaos, macroRegime);

  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  // Pool & deck hints (ties social chaos into card economy + ensures all imports are truly live)
  const weightedPool = buildWeightedPool(seed + ':pool', pressureW * phaseW, regimeW);
  const poolPick = weightedPool[seededIndex(seed, stateTick + 7, Math.max(1, weightedPool.length))] ?? DEFAULT_CARD;

  const deckOrder = seededShuffle(DEFAULT_CARD_IDS, seed + ':deck');
  const deckHintTop = deckOrder[0] ?? DEFAULT_CARD.id;

  const opportunityHint = OPPORTUNITY_POOL[seededIndex(seed, stateTick + 17, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  // Regime dynamics (used for effect magnitude and decay)
  const exitPulse = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const decayRate = computeDecayRate(macroRegime, M15_BOUNDS.BASE_DECAY_RATE);

  // Select a deterministic social chaos effect
  const chosen = m15SelectCatalogEntry(seed, stateTick);

  const { sourceUserId, targetUserId } = m15ResolveTarget(chosen.type, inviterUserId, inviteeUserId);

  // Magnitude computation (bounded + deterministic)
  const macroFactor = clamp(exitPulse * regimeMult, 0.25, 2.5);
  const chaosFactor = inChaos ? 1.25 : 1.0;

  const magnitudeRaw =
    chosen.baseMagnitude *
    M15_BOUNDS.EFFECT_MULTIPLIER *
    pressureW *
    phaseW *
    regimeW *
    macroFactor *
    chaosFactor *
    (1 + clamp(decayRate - M15_BOUNDS.BASE_DECAY_RATE, -0.01, 0.15));

  const magnitude = clamp(Math.round(magnitudeRaw), M15_BOUNDS.MIN_EFFECT, M15_BOUNDS.MAX_EFFECT);

  // Duration uses PULSE_CYCLE to stay aligned with the 12-tick cadence
  const durationTicksRaw = chosen.baseDurationTicks * (inChaos ? 1.15 : 1.0) * (1 + clamp(decayRate, 0.01, 0.99) * 0.15);
  const durationTicks = clamp(Math.round(durationTicksRaw / M15_BOUNDS.PULSE_CYCLE) * M15_BOUNDS.PULSE_CYCLE, 0, M15_BOUNDS.PULSE_CYCLE * 6);

  const appliedAtTick = stateTick;
  const expiresAtTick = clamp(appliedAtTick + durationTicks, 0, RUN_TOTAL_TICKS);

  const auditHash = computeHash(
    JSON.stringify({
      requestId,
      seed,
      tokenId,
      channel,
      stateTick,
      macroRegime,
      pressureTier,
      runPhase,
      effect: { id: chosen.id, type: chosen.type, magnitude, durationTicks, sourceUserId, targetUserId },
      hints: { poolPickId: poolPick.id, deckHintTop, opportunityHintId: opportunityHint.id },
    }) + ':M15',
  );

  const socialChaosEffect: SocialChaosEffect = {
    id: chosen.id,
    requestId,
    type: chosen.type,
    sourceUserId,
    targetUserId,
    magnitude,
    durationTicks,
    appliedAtTick,
    expiresAtTick,
    macroRegime,
    pressureTier,
    runPhase,
    cardHint: poolPick,
    deckHintTop,
    opportunityHint,
    auditHash,
  };

  emit({
    event: 'SOCIAL_TOKEN_PLAYED',
    mechanic_id: 'M15',
    tick: stateTick,
    runId: requestId,
    payload: {
      ok: true,
      inviterUserId,
      inviteeUserId,
      tokenId,
      channel,
      requestId,
    },
  });

  emit({
    event: 'CHAOS_EFFECT_APPLIED',
    mechanic_id: 'M15',
    tick: stateTick,
    runId: requestId,
    payload: {
      effectId: socialChaosEffect.id,
      type: socialChaosEffect.type,
      sourceUserId: socialChaosEffect.sourceUserId,
      targetUserId: socialChaosEffect.targetUserId,
      magnitude: socialChaosEffect.magnitude,
      durationTicks: socialChaosEffect.durationTicks,
      macroRegime,
      pressureTier,
      runPhase,
      inChaos,
      exitPulse,
      regimeMult,
      decayRate,
      cardHintId: poolPick.id,
      deckHintTop,
      opportunityHintId: opportunityHint.id,
      auditHash,
    },
  });

  emit({
    event: 'TOKEN_SPENT',
    mechanic_id: 'M15',
    tick: stateTick,
    runId: requestId,
    payload: {
      tokenConsumed: true,
      tokenId,
      requestId,
    },
  });

  return {
    socialChaosEffect,
    tokenConsumed: true,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M15MLInput {
  socialChaosEffect?: SocialChaosEffect;
  tokenConsumed?: boolean;
  runId: string;
  tick: number;
}

export interface M15MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * socialChaosTokenPlayMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function socialChaosTokenPlayMLCompanion(input: M15MLInput): Promise<M15MLOutput> {
  const tick = clamp(input.tick ?? 0, 0, RUN_TOTAL_TICKS - 1);
  const tokenConsumed = Boolean(input.tokenConsumed ?? false);

  const effect = input.socialChaosEffect;
  const magnitude = Number(effect?.magnitude ?? 0);
  const duration = Number(effect?.durationTicks ?? 0);

  const magnitudePct = clamp(magnitude / Math.max(1, M15_BOUNDS.MAX_EFFECT), 0, 1);
  const durationPct = clamp(duration / Math.max(1, M15_BOUNDS.PULSE_CYCLE * 6), 0, 1);

  // “Impact score” (higher impact => higher score) but bounded.
  const score = clamp(
    (tokenConsumed ? 0.15 : 0.05) + magnitudePct * 0.55 + durationPct * 0.30,
    0.01,
    0.99,
  );

  const regime: MacroRegime = effect?.macroRegime ?? 'NEUTRAL';
  const confidenceDecay = computeDecayRate(regime, M15_BOUNDS.BASE_DECAY_RATE);

  const topFactors = [
    `tick=${tick}/${RUN_TOTAL_TICKS}`,
    `tokenConsumed=${tokenConsumed ? 'yes' : 'no'}`,
    `effect=${effect?.type ?? 'NONE'}`,
    `magnitude=${Math.round(magnitude)} (cap=${M15_BOUNDS.MAX_EFFECT})`,
    `durationTicks=${Math.round(duration)} (max=${M15_BOUNDS.PULSE_CYCLE * 6})`,
  ].slice(0, 5);

  const recommendation =
    !tokenConsumed || !effect || effect.type === 'NONE'
      ? 'No social chaos applied: proceed with normal flow and enforce consent gates.'
      : score >= 0.80
        ? 'High-impact social chaos: surface the effect prominently and enable immediate counterplay.'
        : score >= 0.55
          ? 'Moderate social chaos: show the effect, track decay, and avoid stacking blindly.'
          : 'Low-impact social chaos: log it for audit, but keep UI minimal.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M15'),
    confidenceDecay,
  };
}