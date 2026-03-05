// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m134_npc_counterparties_deterministic_personalities_no_ai.ts
//
// Mechanic : M134 — NPC Counterparties: Deterministic Personalities No AI
// Family   : narrative   Layer: ui_component   Priority: 2   Batch: 3
// ML Pair  : m134a
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

// ─────────────────────────────────────────────────────────────────────────────
// Export anchors (keeps every imported runtime symbol accessible from this module)
// ─────────────────────────────────────────────────────────────────────────────

export const M134_EXPORT_ANCHORS = {
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

/** Forces all imported types to be “used” within this module (type-only, no runtime). */
export type M134_ALL_IMPORTED_TYPES =
  | RunPhase
  | TickTier
  | MacroRegime
  | PressureTier
  | SolvencyStatus
  | Asset
  | IPAItem
  | GameCard
  | GameEvent
  | ShieldLayer
  | Debt
  | Buff
  | Liability
  | SetBonus
  | AssetMod
  | IncomeItem
  | MacroEvent
  | ChaosWindow
  | AuctionResult
  | PurchaseResult
  | ShieldResult
  | ExitResult
  | TickResult
  | DeckComposition
  | TierProgress
  | WipeEvent
  | RegimeShiftEvent
  | PhaseTransitionEvent
  | TimerExpiredEvent
  | StreakEvent
  | FubarEvent
  | LedgerEntry
  | ProofCard
  | CompletedRun
  | SeasonState
  | RunState
  | MomentEvent
  | ClipBoundary
  | MechanicTelemetryPayload
  | MechanicEmitter;

// ─────────────────────────────────────────────────────────────────────────────
// Local NPC types (kept local; no schema bleed into shared ./types)
// ─────────────────────────────────────────────────────────────────────────────

export type NpcRole = 'BANK' | 'SELLER' | 'LANDLORD' | 'BROKER' | 'REGULATOR' | 'RIVAL' | 'PARTNER';

export interface NpcDef {
  npcId: string;
  name: string;
  role: NpcRole;

  /** 0..1 baseline favorability; cosmetic only */
  baselineDisposition?: number;

  /** Optional style hint for dialogue shaping */
  openingStyle?: 'BLUNT' | 'FORMAL' | 'SLICK' | 'PLAYFUL';

  /** Optional tags to flavor the profile */
  tags?: string[];

  /** Optional strictness hint */
  firm?: boolean;

  /** Extensible metadata (must remain JSON-safe) */
  meta?: Record<string, unknown>;
}

export type NpcTemperament = 'COLD' | 'SMOOTH' | 'VOLATILE' | 'PATIENT';
export type NpcMood = 'CALM' | 'WARY' | 'AGGRESSIVE' | 'PANICKED';

export interface NpcBehavior {
  npcId: string;
  name: string;
  role: NpcRole;

  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;

  temperament: NpcTemperament;
  mood: NpcMood;

  /** 0..1, does NOT change economy; used only for UI flavor and deterministic action selection */
  riskTolerance: number;
  strictness: number;
  generosity: number;
  disposition: number;

  /** Deterministic audit hash */
  auditHash: string;
}

export type NpcActionType = 'OFFER' | 'COUNTER' | 'STALL' | 'REJECT' | 'ACCEPT' | 'DEMAND_PROOF';

export interface NpcAction {
  type: NpcActionType;

  /** target is a card id from OPPORTUNITY_POOL (or DEFAULT_CARD fallback) */
  targetCardId: string;

  /** Cosmetic-only “terms” (never authoritative; server mechanics ignore these fields) */
  terms: {
    costMultiplier: number;
    downPaymentMultiplier: number;
    deadlineTick: number;
    proofRequired: boolean;
  };

  /** 0..1, narrative urgency only */
  severity: number;

  /** Deterministic audit hash */
  auditHash: string;
}

export interface NpcDialoguePacket {
  speaker: string;
  role: NpcRole;
  tone: string;
  headline: string;
  lines: string[];
  auditHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M134Input {
  npcDefinition?: NpcDef;
  runSeed?: string;
  stateTick?: number;
}

export interface M134Output {
  npcBehavior: NpcBehavior;
  counterpartyAction: NpcAction;
  npcDialogue: unknown;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M134Event = 'NPC_ACTION_TAKEN' | 'COUNTERPARTY_RESPONDED' | 'NPC_PERSONALITY_RESOLVED';

export interface M134TelemetryPayload extends MechanicTelemetryPayload {
  event: M134Event;
  mechanic_id: 'M134';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M134_BOUNDS = {
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
// Internal helpers (no throws; deterministic; JSON-safe)
// ─────────────────────────────────────────────────────────────────────────────

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v ?? null);
  } catch {
    return '"[UNSERIALIZABLE]"';
  }
}

function deriveRunPhaseFromTick(tick: number): RunPhase {
  const t = clamp(Math.floor(tick), 0, RUN_TOTAL_TICKS);
  if (t <= RUN_TOTAL_TICKS / 3) return 'EARLY';
  if (t <= (RUN_TOTAL_TICKS * 2) / 3) return 'MID';
  return 'LATE';
}

function deriveMacroRegimeAtTick(schedule: MacroEvent[], seed: string, tick: number): MacroRegime {
  const t = clamp(Math.floor(tick), 0, RUN_TOTAL_TICKS);
  const ordered = [...schedule].sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0) || String(a.type).localeCompare(String(b.type)));
  const prior = ordered.filter(e => (e.tick ?? 0) <= t);
  const pick = prior.length > 0 ? prior[prior.length - 1] : ordered[0];
  const r = (pick?.regimeChange as MacroRegime) ?? (['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'] as const)[seededIndex(seed, t + 900, 4)];
  return r;
}

function inChaosWindow(windows: ChaosWindow[], tick: number): boolean {
  const t = clamp(Math.floor(tick), 0, RUN_TOTAL_TICKS);
  for (const w of windows) {
    const s = clamp(Math.floor(w.startTick ?? 0), 0, RUN_TOTAL_TICKS);
    const e = clamp(Math.floor(w.endTick ?? 0), 0, RUN_TOTAL_TICKS);
    if (t >= s && t <= e) return true;
  }
  return false;
}

function derivePressureTier(seed: string, macroRegime: MacroRegime, runPhase: RunPhase, chaos: boolean, tick: number): PressureTier {
  const harsh = clamp(1.25 - (REGIME_MULTIPLIERS[macroRegime] ?? 1.0), 0, 1); // CRISIS -> higher harsh
  const phaseBias = runPhase === 'LATE' ? 0.12 : runPhase === 'MID' ? 0.06 : 0.0;
  const chaosBias = chaos ? 0.22 : 0.0;
  const jitter = seededIndex(seed, tick + 77, 1000) / 1000; // 0..0.999

  const s = clamp(harsh * 0.60 + phaseBias + chaosBias + jitter * 0.08, 0, 1);
  if (s >= 0.78) return 'CRITICAL';
  if (s >= 0.55) return 'HIGH';
  if (s >= 0.28) return 'MEDIUM';
  return 'LOW';
}

function deriveTickTierFromIntensity(intensity01: number): TickTier {
  if (intensity01 >= 0.75) return 'CRITICAL';
  if (intensity01 >= 0.45) return 'ELEVATED';
  return 'STANDARD';
}

function safeCardFromPool(card: GameCard | undefined | null): GameCard {
  const c = card ?? DEFAULT_CARD;
  if (DEFAULT_CARD_IDS.includes(c.id)) return c;
  if (OPPORTUNITY_POOL.some(x => x.id === c.id)) return c;
  return DEFAULT_CARD;
}

function pickTemperament(seed: string, role: NpcRole): NpcTemperament {
  const base: NpcTemperament[] =
    role === 'REGULATOR'
      ? ['COLD', 'PATIENT', 'COLD', 'PATIENT']
      : role === 'BANK'
        ? ['COLD', 'SMOOTH', 'PATIENT', 'COLD']
        : role === 'RIVAL'
          ? ['VOLATILE', 'COLD', 'VOLATILE', 'SMOOTH']
          : ['SMOOTH', 'PATIENT', 'COLD', 'SMOOTH'];

  return base[seededIndex(seed, 11, base.length)];
}

function resolveMood(temperament: NpcTemperament, pressure: PressureTier, chaos: boolean, intensity01: number): NpcMood {
  const p = pressure;
  const i = clamp(intensity01, 0.01, 0.99);

  if (chaos && (p === 'CRITICAL' || i >= 0.72)) return temperament === 'PATIENT' ? 'WARY' : 'PANICKED';
  if (p === 'CRITICAL') return temperament === 'COLD' ? 'AGGRESSIVE' : 'PANICKED';
  if (p === 'HIGH') return temperament === 'PATIENT' ? 'WARY' : 'AGGRESSIVE';
  if (p === 'MEDIUM') return temperament === 'VOLATILE' ? 'WARY' : 'CALM';
  return 'CALM';
}

function actionTypeFromMood(seed: string, mood: NpcMood, role: NpcRole, tick: number): NpcActionType {
  const table: Record<NpcMood, NpcActionType[]> = {
    CALM: ['OFFER', 'COUNTER', 'DEMAND_PROOF', 'OFFER'],
    WARY: ['DEMAND_PROOF', 'STALL', 'COUNTER', 'DEMAND_PROOF'],
    AGGRESSIVE: ['COUNTER', 'REJECT', 'DEMAND_PROOF', 'COUNTER'],
    PANICKED: ['REJECT', 'STALL', 'COUNTER', 'REJECT'],
  };

  const roleBias = role === 'REGULATOR' ? 1 : role === 'RIVAL' ? 2 : 0;
  const picks = table[mood];
  return picks[seededIndex(seed, tick + 200 + roleBias, picks.length)];
}

function buildDialogue(seed: string, def: NpcDef, behavior: NpcBehavior, action: NpcAction, focusCard: GameCard, tick: number): NpcDialoguePacket {
  const openerBank = [
    'Say it clean. What do you want, and what can you prove?',
    'If this is real, it survives audit. Start there.',
    'I’ve seen prettier stories. I’m listening anyway.',
    'Numbers talk. Everything else performs.',
  ];

  const regulatorBank = [
    'This is compliance, not negotiation.',
    'You get one clean window. Miss it, and it becomes permanent.',
    'Document it. Then we can speak.',
    'Your intent doesn’t matter. Your trail does.',
  ];

  const rivalBank = [
    'You’re late. That’s a habit.',
    'I don’t hate you. I just profit from your timing.',
    'Go ahead—try it. I’ll be here when it snaps back.',
    'Make it interesting. Or make it gone.',
  ];

  const sellerBank = [
    'I can wait. Can you?',
    'If you’re serious, you move fast—no speeches.',
    'This isn’t personal. It’s a deadline.',
    'Bring proof, not promises.',
  ];

  const pool =
    def.role === 'REGULATOR'
      ? regulatorBank
      : def.role === 'RIVAL'
        ? rivalBank
        : def.role === 'SELLER' || def.role === 'LANDLORD'
          ? sellerBank
          : openerBank;

  const tone =
    behavior.temperament === 'COLD'
      ? 'cold'
      : behavior.temperament === 'SMOOTH'
        ? 'smooth'
        : behavior.temperament === 'VOLATILE'
          ? 'volatile'
          : 'patient';

  const headerParts = seededShuffle(
    [
      `COUNTERPARTY // ${def.role}`,
      `REGIME ${behavior.macroRegime}`,
      `PHASE ${behavior.runPhase}`,
      `PRESSURE ${behavior.pressureTier}`,
      `TIER ${behavior.tickTier}`,
      `FOCUS ${focusCard.name}`,
    ],
    `${seed}:hdr:${tick}`,
  );

  const headline = headerParts.slice(0, 3).join(' • ');

  const actionLine =
    action.type === 'OFFER'
      ? `I’ll talk on ${focusCard.name}. Terms are tight.`
      : action.type === 'COUNTER'
        ? `I’m not taking that. Countering on ${focusCard.name}.`
        : action.type === 'STALL'
          ? `Clock’s running. I’m not ready.`
          : action.type === 'ACCEPT'
            ? `Fine. Lock it. Don’t waste the window.`
            : action.type === 'DEMAND_PROOF'
              ? `Show proof. Then we move.`
              : `No. Not like this.`;

  const proofLine = action.terms.proofRequired ? 'Proof is mandatory. No proof, no movement.' : 'Proof helps, but speed matters more.';
  const deadlineLine = `Deadline: T${action.terms.deadlineTick}. After that, the terms decay.`;

  const lines = seededShuffle(
    [
      pool[seededIndex(seed, tick, pool.length)],
      actionLine,
      proofLine,
      deadlineLine,
    ],
    `${seed}:dlg:${tick}`,
  ).slice(0, 4);

  const auditHash = computeHash(
    safeJson({
      npcId: def.npcId,
      tick,
      headline,
      lines,
      action: action.auditHash,
      behavior: behavior.auditHash,
    }),
  );

  return {
    speaker: def.name,
    role: def.role,
    tone,
    headline,
    lines,
    auditHash,
  };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * npcCounterpartyEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function npcCounterpartyEngine(input: M134Input, emit: MechanicEmitter): M134Output {
  const npcDefinition: NpcDef =
    input.npcDefinition ?? {
      npcId: 'npc-unknown',
      name: 'Counterparty',
      role: 'BROKER',
      baselineDisposition: 0.5,
      openingStyle: 'FORMAL',
      tags: ['DEFAULT'],
      firm: false,
      meta: {},
    };

  const runSeed = String(input.runSeed ?? '');
  const stateTick = clamp(Math.floor(Number(input.stateTick ?? 0)), 0, RUN_TOTAL_TICKS);

  const seed = computeHash(
    safeJson({
      mechanic: 'M134',
      npcId: npcDefinition.npcId,
      runSeed,
      tick: stateTick,
      role: npcDefinition.role,
    }),
  );

  const runPhase = deriveRunPhaseFromTick(stateTick);

  const macroSchedule = buildMacroSchedule(`${seed}:macro`, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(`${seed}:chaos`, CHAOS_WINDOWS_PER_RUN);

  const macroRegime = deriveMacroRegimeAtTick(macroSchedule, seed, stateTick);
  const chaosNow = inChaosWindow(chaosWindows, stateTick);

  const pressureTier = derivePressureTier(seed, macroRegime, runPhase, chaosNow, stateTick);

  const decay = computeDecayRate(macroRegime, M134_BOUNDS.BASE_DECAY_RATE);
  const pulse =
    stateTick > 0 && stateTick % M134_BOUNDS.PULSE_CYCLE === 0 ? (EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0) : 1.0;

  const intensity01 = clamp(decay * pulse * (REGIME_MULTIPLIERS[macroRegime] ?? 1.0), 0.01, 0.99);
  const tickTier = deriveTickTierFromIntensity(intensity01);

  // Use all weight maps to deterministically shape NPC posture (UI-only).
  const wPressure = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const wPhase = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const wRegime = REGIME_WEIGHTS[macroRegime] ?? 1.0;
  const weightCombined = clamp(wPressure * wPhase * wRegime, 0.25, 3.0);

  const temperament = pickTemperament(seed, npcDefinition.role);

  const baseDisp = clamp(Number(npcDefinition.baselineDisposition ?? 0.5), 0, 1);
  const firmBias = npcDefinition.firm ? 0.12 : 0.0;

  // Risk/strict/generous are deterministic personality knobs (NO economic authority).
  const riskTolerance = clamp(
    baseDisp * 0.55 +
      (temperament === 'VOLATILE' ? 0.12 : temperament === 'SMOOTH' ? 0.08 : temperament === 'PATIENT' ? 0.02 : -0.04) +
      (macroRegime === 'BULL' ? 0.08 : macroRegime === 'CRISIS' ? -0.10 : 0.0) +
      (seededIndex(seed, 33, 1000) / 1000) * 0.10,
    0,
    1,
  );

  const strictness = clamp(
    (1 - baseDisp) * 0.55 +
      firmBias +
      (temperament === 'COLD' ? 0.14 : temperament === 'PATIENT' ? 0.06 : 0.02) +
      (pressureTier === 'CRITICAL' ? 0.14 : pressureTier === 'HIGH' ? 0.08 : 0.02) +
      (seededIndex(seed, 44, 1000) / 1000) * 0.08,
    0,
    1,
  );

  const generosity = clamp(
    baseDisp * 0.60 +
      (temperament === 'SMOOTH' ? 0.10 : temperament === 'PATIENT' ? 0.06 : -0.02) +
      (macroRegime === 'BULL' ? 0.07 : macroRegime === 'CRISIS' ? -0.08 : 0.0) -
      strictness * 0.25 +
      (seededIndex(seed, 55, 1000) / 1000) * 0.06,
    0,
    1,
  );

  const disposition = clamp(baseDisp + (generosity - strictness) * 0.18 - (chaosNow ? 0.10 : 0.0), 0, 1);

  const mood = resolveMood(temperament, pressureTier, chaosNow, intensity01);

  const behaviorAuditHash = computeHash(
    safeJson({
      npcId: npcDefinition.npcId,
      tick: stateTick,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      temperament,
      mood,
      riskTolerance: Number(riskTolerance.toFixed(4)),
      strictness: Number(strictness.toFixed(4)),
      generosity: Number(generosity.toFixed(4)),
      disposition: Number(disposition.toFixed(4)),
    }),
  );

  const npcBehavior: NpcBehavior = {
    npcId: npcDefinition.npcId,
    name: npcDefinition.name,
    role: npcDefinition.role,
    macroRegime,
    runPhase,
    pressureTier,
    tickTier,
    temperament,
    mood,
    riskTolerance,
    strictness,
    generosity,
    disposition,
    auditHash: behaviorAuditHash,
  };

  // Deterministic “focus” opportunity (UI-only).
  const pressurePhaseWeight = wPressure * wPhase;
  const regimeWeight = wRegime;

  const weightedPool = buildWeightedPool(`${seed}:pool`, pressurePhaseWeight, regimeWeight);
  const poolPick = weightedPool[seededIndex(seed, stateTick, Math.max(1, weightedPool.length))];
  const focusCard = safeCardFromPool(poolPick);

  // Ensure DEFAULT_CARD and DEFAULT_CARD_IDS are used in enforceable way (even for UI).
  const targetCardId =
    DEFAULT_CARD_IDS.includes(focusCard.id) || OPPORTUNITY_POOL.some(c => c.id === focusCard.id) ? focusCard.id : DEFAULT_CARD.id;

  const actionType = actionTypeFromMood(seed, mood, npcDefinition.role, stateTick);

  const severity = clamp((weightCombined - 0.25) / 2.75 + (1 - disposition) * 0.18 + (chaosNow ? 0.10 : 0.0), 0, 1);

  // Terms are NON-AUTHORITATIVE UI “vibe”, derived deterministically from personality.
  const costMultiplier = clamp(1.0 + (strictness - generosity) * 0.25 + (macroRegime === 'CRISIS' ? 0.08 : 0.0), 0.85, 1.35);
  const downPaymentMultiplier = clamp(1.0 + strictness * 0.30 - riskTolerance * 0.20, 0.80, 1.50);

  // Deadline is deterministic, bounded, and never beyond RUN_TOTAL_TICKS.
  const baseDeadline = clamp(stateTick + (pressureTier === 'CRITICAL' ? 6 : pressureTier === 'HIGH' ? 10 : 14), 0, RUN_TOTAL_TICKS);
  const chaosNudge = chaosNow ? -2 : 0;
  const pulseNudge = stateTick % M134_BOUNDS.PULSE_CYCLE === 0 ? -1 : 0;
  const deadlineTick = clamp(baseDeadline + chaosNudge + pulseNudge, 0, RUN_TOTAL_TICKS);

  const proofRequired =
    actionType === 'DEMAND_PROOF' ||
    npcDefinition.role === 'REGULATOR' ||
    (strictness >= 0.62 && pressureTier !== 'LOW') ||
    (macroRegime === 'CRISIS' && disposition < 0.55);

  const actionAuditHash = computeHash(
    safeJson({
      npcId: npcDefinition.npcId,
      tick: stateTick,
      actionType,
      targetCardId,
      costMultiplier: Number(costMultiplier.toFixed(4)),
      downPaymentMultiplier: Number(downPaymentMultiplier.toFixed(4)),
      deadlineTick,
      proofRequired,
      severity: Number(severity.toFixed(4)),
    }),
  );

  const counterpartyAction: NpcAction = {
    type: actionType,
    targetCardId,
    terms: {
      costMultiplier,
      downPaymentMultiplier,
      deadlineTick,
      proofRequired,
    },
    severity,
    auditHash: actionAuditHash,
  };

  const npcDialogue = buildDialogue(seed, npcDefinition, npcBehavior, counterpartyAction, focusCard, stateTick);

  const runId = computeHash(`${runSeed}:${seed}:${npcDefinition.npcId}`);

  emit({
    event: 'NPC_PERSONALITY_RESOLVED',
    mechanic_id: 'M134',
    tick: stateTick,
    runId,
    payload: {
      npcId: npcDefinition.npcId,
      name: npcDefinition.name,
      role: npcDefinition.role,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      temperament,
      mood,
      riskTolerance: Number(riskTolerance.toFixed(4)),
      strictness: Number(strictness.toFixed(4)),
      generosity: Number(generosity.toFixed(4)),
      disposition: Number(disposition.toFixed(4)),
      auditHash: behaviorAuditHash,
    },
  });

  emit({
    event: 'NPC_ACTION_TAKEN',
    mechanic_id: 'M134',
    tick: stateTick,
    runId,
    payload: {
      npcId: npcDefinition.npcId,
      actionType,
      targetCardId,
      severity: Number(severity.toFixed(4)),
      deadlineTick,
      proofRequired,
      auditHash: actionAuditHash,
    },
  });

  emit({
    event: 'COUNTERPARTY_RESPONDED',
    mechanic_id: 'M134',
    tick: stateTick,
    runId,
    payload: {
      npcId: npcDefinition.npcId,
      headlineHash: computeHash(npcDialogue.headline),
      dialogueAuditHash: npcDialogue.auditHash,
      focusCardId: focusCard.id,
      chaosNow,
      pulseTick: stateTick % M134_BOUNDS.PULSE_CYCLE === 0,
      macroEvents: MACRO_EVENTS_PER_RUN,
      chaosWindows: CHAOS_WINDOWS_PER_RUN,
    },
  });

  return {
    npcBehavior,
    counterpartyAction,
    npcDialogue: npcDialogue as unknown,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M134MLInput {
  npcBehavior?: NpcBehavior;
  counterpartyAction?: NpcAction;
  npcDialogue?: unknown;
  runId: string;
  tick: number;
}

export interface M134MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // deterministic hash (non-crypto)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * npcCounterpartyEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function npcCounterpartyEngineMLCompanion(input: M134MLInput): Promise<M134MLOutput> {
  const runId = String(input.runId ?? '');
  const tick = clamp(Math.floor(Number(input.tick ?? 0)), 0, RUN_TOTAL_TICKS);

  const b = input.npcBehavior;
  const a = input.counterpartyAction;

  const regime: MacroRegime =
    (b?.macroRegime as MacroRegime) ?? (['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'] as const)[seededIndex(runId, tick + 3, 4)];

  const decay = computeDecayRate(regime, M134_BOUNDS.BASE_DECAY_RATE);
  const pulse = tick > 0 && tick % M134_BOUNDS.PULSE_CYCLE === 0 ? (EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0) : 1.0;

  const moodBoost =
    b?.mood === 'CALM'
      ? 0.10
      : b?.mood === 'WARY'
        ? 0.06
        : b?.mood === 'AGGRESSIVE'
          ? 0.04
          : 0.02;

  const severity = typeof a?.severity === 'number' ? clamp(a.severity, 0, 1) : 0.35;
  const proofPenalty = a?.terms?.proofRequired ? -0.06 : 0.02;

  const score = clamp(0.25 + severity * 0.45 + moodBoost + proofPenalty + clamp((pulse - 1.0) * 0.10, -0.08, 0.08), 0.01, 0.99);

  const factors = seededShuffle(
    [
      `Regime context: ${regime}`,
      b?.mood ? `NPC mood: ${b.mood}` : 'NPC mood: unknown',
      a?.type ? `Action: ${a.type}` : 'Action: unknown',
      a?.terms?.proofRequired ? 'Proof demanded' : 'Proof not demanded',
      `Decay shaping: ${decay.toFixed(3)}`,
    ],
    `${runId}:M134:ml:factors:${tick}`,
  ).slice(0, 5);

  const recommendation =
    score >= 0.70
      ? 'Surface the counterparty prompt prominently; require acknowledgment before the next step.'
      : 'Keep the counterparty prompt lightweight; escalate only when pressure increases.';

  return {
    score,
    topFactors: factors,
    recommendation,
    auditHash: computeHash(safeJson(input) + ':ml:M134:v1'),
    confidenceDecay: clamp(decay, 0.01, 0.25),
  };
}