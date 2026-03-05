// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m149_regulatory_window_one_chance_to_comply_or_pay_forever.ts
//
// Mechanic : M149 — Regulatory Window: One Chance to Comply or Pay Forever
// Family   : ops   Layer: backend_service   Priority: 2   Batch: 3
// ML Pair  : m149a
// Deps     : M13, M27
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

// ── Import Anchors (keep every import accessible + used) ───────────────────

export const M149_IMPORTED_SYMBOLS = {
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

export type M149_ImportedTypesAnchor = {
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

// ── Local domain (not part of shared ./types.ts) ───────────────────────────

export type RegulatoryTriggerKind =
  | 'LICENSE_REQUIRED'
  | 'REPORTING_REQUIRED'
  | 'KYC_REQUIRED'
  | 'TAX_NOTICE'
  | 'REGULATORY_ACTION'
  | 'UNKNOWN';

export interface RegulatoryTrigger {
  kind: RegulatoryTriggerKind;
  /** 0..100 */
  severity?: number;
  /** Optional: “agency” identifier string (short). */
  authority?: string;
  /** Optional note (short). */
  note?: string;
  /** Optional metadata. */
  meta?: Record<string, unknown>;
}

export type ComplianceAction =
  | 'FILED_REPORT'
  | 'SUBMITTED_KYC'
  | 'PAID_FEE'
  | 'UPDATED_LICENSE'
  | 'ACKNOWLEDGED'
  | 'UNKNOWN';

export interface ComplianceSubmission {
  action: ComplianceAction;
  /** JSON-safe payload (proof artifacts). */
  payload?: Record<string, unknown>;
  /** Optional proof hash if precomputed. */
  proofHash?: string;
  /** Optional “submitted tick” if known. */
  submittedTick?: number;
}

export interface ComplianceWindow {
  /** If omitted, engine derives a deterministic window. */
  openTick?: number;
  closeTick?: number;

  /**
   * Current evaluation tick for this call.
   * If omitted, engine derives a deterministic tick from the input snapshot.
   */
  currentTick?: number;

  /** One-shot submission packet (the “one chance”). */
  submission?: ComplianceSubmission;

  /** If true, treat as submitted (override). */
  submitted?: boolean;

  /** If true, allow late submission (NOT default). */
  allowLate?: boolean;

  /** Optional metadata. */
  meta?: Record<string, unknown>;
}

export type ComplianceStatus = 'PENDING' | 'COMPLIANT' | 'NONCOMPLIANT' | 'PENALTY_PERMANENT';

export interface ComplianceResult {
  id: string;
  runId: string;
  tick: number;

  trigger?: RegulatoryTrigger;

  phase: RunPhase;
  pressure: PressureTier;
  regime: MacroRegime;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  featuredCardId: string;
  featuredCard: GameCard;

  windowOpenTick: number;
  windowCloseTick: number;
  windowExpired: boolean;

  submissionAccepted: boolean;
  submissionTick: number | null;
  submissionHash: string | null;

  status: ComplianceStatus;

  /** One-time penalty assessed when the window closes without compliance (bounded). */
  penaltyAmount: number;

  /**
   * “Pay forever” token: deterministic id that downstream systems can use
   * to apply recurring fees / gating until a hard reset (if any).
   */
  permanentPenaltyToken: string | null;

  /** Stable verification hash. */
  auditHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M149Input {
  regulatoryTrigger?: RegulatoryTrigger;
  complianceWindow?: ComplianceWindow;
  stateCash?: number;
}

export interface M149Output {
  complianceResult: ComplianceResult;
  penaltyApplied: boolean;
  windowExpired: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M149Event = 'REGULATORY_WINDOW_OPENED' | 'COMPLIANCE_SUBMITTED' | 'PENALTY_PERMANENT';

export interface M149TelemetryPayload extends MechanicTelemetryPayload {
  event: M149Event;
  mechanic_id: 'M149';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M149_BOUNDS = {
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

export const M149_WINDOW_BOUNDS = {
  /** Hard cap for compliance window length (ticks). */
  MAX_WINDOW_TICKS: 18,
  MIN_WINDOW_TICKS: 3,
  /** Deterministic jitter to prevent perfect timing exploits. */
  WINDOW_JITTER_TICKS: 2,
  /** Base penalty floor if noncompliant. */
  MIN_PENALTY: 1_000,
  /** Max penalty as percent of cash (bounded) in addition to MAX_AMOUNT. */
  MAX_PENALTY_PCT_OF_CASH: 0.25,
  MAX_NOTE_LEN: 180,
} as const;

// ── Internal helpers (pure) ───────────────────────────────────────────────

function m149SafeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    try {
      return String(v);
    } catch {
      return '[unstringifiable]';
    }
  }
}

function m149ToNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  if (typeof v === 'boolean') return v ? 1 : 0;
  return fallback;
}

function m149ToInt(v: unknown, fallback: number): number {
  return Math.floor(m149ToNumber(v, fallback));
}

function m149DerivePhase(tick: number): RunPhase {
  const p = clamp((tick + 1) / RUN_TOTAL_TICKS, 0, 1);
  return p < 0.33 ? 'EARLY' : p < 0.66 ? 'MID' : 'LATE';
}

function m149InChaos(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m149DerivePressure(tick: number, phase: RunPhase, windows: ChaosWindow[]): PressureTier {
  if (m149InChaos(tick, windows)) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function m149DeriveRegime(tick: number, macroSchedule: MacroEvent[]): MacroRegime {
  let regime: MacroRegime = 'NEUTRAL';
  const sorted = [...macroSchedule].sort((a, b) => a.tick - b.tick);
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m149NormalizeTrigger(t: RegulatoryTrigger | undefined): RegulatoryTrigger | undefined {
  if (!t) return undefined;
  const kind: RegulatoryTriggerKind = (t.kind as RegulatoryTriggerKind) ?? 'UNKNOWN';
  const severity = clamp(m149ToInt(t.severity, 25), 0, 100);
  const authority = t.authority ? String(t.authority).slice(0, 64) : undefined;
  const note = t.note ? String(t.note).slice(0, M149_WINDOW_BOUNDS.MAX_NOTE_LEN) : undefined;
  const meta = t.meta && typeof t.meta === 'object' ? (t.meta as Record<string, unknown>) : undefined;
  return { kind, severity, authority, note, meta };
}

function m149PickFeaturedCard(seed: string, tick: number, pressure: PressureTier, phase: RunPhase, regime: MacroRegime) {
  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;

  const pool = buildWeightedPool(seed, pressureWeight * phaseWeight, regimeWeight);
  const safePool = pool.length ? pool : [DEFAULT_CARD];

  const idx = seededIndex(seed, tick + 999, safePool.length);
  const oppIdx = seededIndex(seed, tick + 777, Math.max(1, OPPORTUNITY_POOL.length));
  const fallback = OPPORTUNITY_POOL[oppIdx] ?? DEFAULT_CARD;

  const featuredCard = safePool[idx] ?? fallback ?? DEFAULT_CARD;

  const idIdx = seededIndex(seed, tick + 31337, Math.max(1, DEFAULT_CARD_IDS.length));
  const featuredCardId = featuredCard.id || (DEFAULT_CARD_IDS[idIdx] ?? DEFAULT_CARD.id);

  return { featuredCard, featuredCardId, poolSize: safePool.length };
}

function m149ComputeWindow(seed: string, tick: number, regime: MacroRegime, override?: ComplianceWindow) {
  const pulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const jitterSpan = 2 * M149_WINDOW_BOUNDS.WINDOW_JITTER_TICKS + 1;
  const jitter = seededIndex(seed, tick + 4242, jitterSpan) - M149_WINDOW_BOUNDS.WINDOW_JITTER_TICKS;

  const base = M149_BOUNDS.FIRST_REFUSAL_TICKS; // canonical window base
  const scaled = Math.round(base * clamp(pulse, 0.6, 1.25));

  const windowTicks = clamp(
    scaled + jitter,
    M149_WINDOW_BOUNDS.MIN_WINDOW_TICKS,
    M149_WINDOW_BOUNDS.MAX_WINDOW_TICKS,
  );

  const openTick = override?.openTick != null ? clamp(m149ToInt(override.openTick, tick), 0, RUN_TOTAL_TICKS - 1) : tick;
  const closeTick =
    override?.closeTick != null
      ? clamp(m149ToInt(override.closeTick, openTick + windowTicks), 0, RUN_TOTAL_TICKS - 1)
      : clamp(openTick + windowTicks, 0, RUN_TOTAL_TICKS - 1);

  return { openTick, closeTick, windowTicks, jitter };
}

function m149NormalizeSubmission(window: ComplianceWindow | undefined): ComplianceSubmission | null {
  const s = window?.submission;
  if (!s) return null;
  const action: ComplianceAction = (s.action as ComplianceAction) ?? 'UNKNOWN';
  const payload = s.payload && typeof s.payload === 'object' ? (s.payload as Record<string, unknown>) : undefined;
  const proofHash = s.proofHash ? String(s.proofHash) : undefined;
  const submittedTick = s.submittedTick != null ? m149ToInt(s.submittedTick, 0) : undefined;
  return { action, payload, proofHash, submittedTick };
}

function m149ComputePenalty(
  seed: string,
  tick: number,
  cash: number,
  trigger: RegulatoryTrigger | undefined,
  regime: MacroRegime,
  pressure: PressureTier,
  phase: RunPhase,
): { penalty: number; factors: string[] } {
  const cashSafe = Math.max(0, Math.floor(cash));
  const severity = clamp(m149ToInt(trigger?.severity, 25), 0, 100);

  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;

  const decayRate = computeDecayRate(regime, M149_BOUNDS.BASE_DECAY_RATE);

  // Deterministic jitter 0.95..1.05
  const j = 0.95 + seededIndex(seed, tick + 17, 11) * 0.01;

  // Base penalty derived from severity, scaled by regime/pressure/phase and “decay” stickiness.
  const base = M149_WINDOW_BOUNDS.MIN_PENALTY + severity * 200;
  const scaled =
    base *
    M149_BOUNDS.MULTIPLIER *
    clamp(regimeMultiplier, 0.7, 1.35) *
    clamp(pressureWeight * phaseWeight, 0.7, 3.0) *
    clamp(1 + decayRate, 1, 1.25) *
    j *
    M149_BOUNDS.EFFECT_MULTIPLIER;

  const pctCap = Math.round(cashSafe * M149_WINDOW_BOUNDS.MAX_PENALTY_PCT_OF_CASH);
  const hardCap = Math.min(M149_BOUNDS.MAX_AMOUNT, Math.max(0, pctCap));

  // If cash is 0, still assess a minimum bounded penalty for “pay forever” tokenization.
  const cap = cashSafe > 0 ? Math.max(M149_WINDOW_BOUNDS.MIN_PENALTY, hardCap) : M149_WINDOW_BOUNDS.MIN_PENALTY;

  const penalty = clamp(Math.round(scaled), M149_WINDOW_BOUNDS.MIN_PENALTY, cap);

  const factors = seededShuffle(
    [
      `sev=${severity}`,
      `regime=${regime}`,
      `pressure=${pressure}`,
      `phase=${phase}`,
      `mult=${regimeMultiplier.toFixed(2)}`,
      `decay=${decayRate.toFixed(3)}`,
      `cap=${cap}`,
      `j=${j.toFixed(2)}`,
    ],
    computeHash(seed + ':penalty:factors'),
  ).slice(0, 5);

  return { penalty, factors };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * regulatoryWindowEnforcer
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function regulatoryWindowEnforcer(input: M149Input, emit: MechanicEmitter): M149Output {
  const serviceHash = computeHash(m149SafeStringify(input ?? {}));
  const seedRoot = computeHash(`M149:${serviceHash}`);

  const cash = Math.max(0, Math.floor(m149ToNumber(input.stateCash, 0)));

  // Determine evaluation tick: from complianceWindow.currentTick OR deterministic derivation.
  const requestedTick = input.complianceWindow?.currentTick;
  const tick =
    requestedTick != null
      ? clamp(m149ToInt(requestedTick, 0), 0, RUN_TOTAL_TICKS - 1)
      : clamp(seededIndex(seedRoot, 149, RUN_TOTAL_TICKS), 0, RUN_TOTAL_TICKS - 1);

  const seed = computeHash(`${seedRoot}:${tick}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m149DerivePhase(tick);
  const pressure = m149DerivePressure(tick, phase, chaosWindows);
  const regime = m149DeriveRegime(tick, macroSchedule);

  const trigger = m149NormalizeTrigger(input.regulatoryTrigger);

  const { openTick, closeTick } = m149ComputeWindow(seed, tick, regime, input.complianceWindow);

  const windowExpired = tick > closeTick;

  const submission = m149NormalizeSubmission(input.complianceWindow);
  const forcedSubmitted = !!input.complianceWindow?.submitted;

  const submissionTickRaw =
    submission?.submittedTick != null ? submission.submittedTick : (forcedSubmitted ? tick : null);

  const submissionTick =
    submissionTickRaw == null
      ? null
      : clamp(m149ToInt(submissionTickRaw, tick), 0, RUN_TOTAL_TICKS - 1);

  const allowLate = !!input.complianceWindow?.allowLate;

  const withinWindow =
    submissionTick != null && submissionTick >= openTick && submissionTick <= closeTick;

  const submissionAccepted =
    (forcedSubmitted || submission != null) && (withinWindow || (allowLate && submissionTick != null));

  const submissionHash =
    submissionAccepted
      ? computeHash(
          m149SafeStringify({
            action: submission?.action ?? 'UNKNOWN',
            payload: submission?.payload ?? null,
            proofHash: submission?.proofHash ?? null,
            submittedTick: submissionTick,
          }),
        )
      : null;

  const { featuredCard, featuredCardId } = m149PickFeaturedCard(seed, tick, pressure, phase, regime);

  // Determine status
  let status: ComplianceStatus = 'PENDING';
  if (submissionAccepted && withinWindow) status = 'COMPLIANT';
  else if (windowExpired) status = 'PENALTY_PERMANENT';
  else status = 'NONCOMPLIANT';

  // Penalty applied only when window expires without valid compliance (unless allowLate and accepted late).
  const penaltyGate =
    windowExpired && !(submissionAccepted && (withinWindow || allowLate));

  const { penalty: penaltyAmount, factors: penaltyFactors } = m149ComputePenalty(
    seed,
    tick,
    cash,
    trigger,
    regime,
    pressure,
    phase,
  );

  const penaltyApplied = penaltyGate;

  const permanentPenaltyToken =
    penaltyApplied
      ? computeHash(
          m149SafeStringify({
            v: 'M149/perm/v1',
            serviceHash,
            seedRoot,
            openTick,
            closeTick,
            trigger: trigger?.kind ?? 'UNKNOWN',
            featuredCardId,
            penaltyAmount,
          }),
        )
      : null;

  const auditHash = computeHash(
    m149SafeStringify({
      v: 'M149/v1',
      serviceHash,
      seedRoot,
      seed,
      tick,
      trigger,
      phase,
      pressure,
      regime,
      openTick,
      closeTick,
      windowExpired,
      submissionAccepted,
      withinWindow,
      allowLate,
      submissionTick,
      submissionHash,
      featuredCardId,
      penaltyApplied,
      penaltyAmount: penaltyApplied ? penaltyAmount : 0,
      permanentPenaltyToken,
      penaltyFactors,
      macroEvents: macroSchedule.length,
      chaosWindows: chaosWindows.length,
      defaultCard: DEFAULT_CARD.id,
      defaultIdsLen: DEFAULT_CARD_IDS.length,
      opportunityPoolLen: OPPORTUNITY_POOL.length,
    }),
  );

  const resultId = computeHash(`${serviceHash}:M149:${openTick}:${closeTick}:${featuredCardId}`);

  const complianceResult: ComplianceResult = {
    id: resultId,
    runId: serviceHash,
    tick,

    trigger,

    phase,
    pressure,
    regime,

    macroSchedule,
    chaosWindows,

    featuredCardId,
    featuredCard,

    windowOpenTick: openTick,
    windowCloseTick: closeTick,
    windowExpired,

    submissionAccepted,
    submissionTick,
    submissionHash,

    status,

    penaltyAmount: penaltyApplied ? penaltyAmount : 0,
    permanentPenaltyToken,

    auditHash,
  };

  // ── Telemetry ────────────────────────────────────────────────────────────

  emit({
    event: 'REGULATORY_WINDOW_OPENED',
    mechanic_id: 'M149',
    tick,
    runId: serviceHash,
    payload: {
      id: resultId,
      openTick,
      closeTick,
      windowExpired,
      triggerKind: trigger?.kind ?? 'UNKNOWN',
      authority: trigger?.authority ?? null,
      severity: trigger?.severity ?? 0,
      phase,
      pressure,
      regime,
      featuredCardId,
      auditHash,
    },
  });

  if (submissionAccepted) {
    emit({
      event: 'COMPLIANCE_SUBMITTED',
      mechanic_id: 'M149',
      tick: submissionTick ?? tick,
      runId: serviceHash,
      payload: {
        id: resultId,
        accepted: submissionAccepted,
        withinWindow,
        allowLate,
        action: submission?.action ?? 'UNKNOWN',
        submissionHash,
        auditHash,
      },
    });
  }

  if (penaltyApplied) {
    emit({
      event: 'PENALTY_PERMANENT',
      mechanic_id: 'M149',
      tick,
      runId: serviceHash,
      payload: {
        id: resultId,
        penaltyAmount,
        permanentPenaltyToken,
        factors: penaltyFactors,
        featuredCardId,
        auditHash,
      },
    });
  }

  return {
    complianceResult,
    penaltyApplied,
    windowExpired,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M149MLInput {
  complianceResult?: ComplianceResult;
  penaltyApplied?: boolean;
  windowExpired?: boolean;
  runId: string;
  tick: number;
}

export interface M149MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * regulatoryWindowEnforcerMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function regulatoryWindowEnforcerMLCompanion(input: M149MLInput): Promise<M149MLOutput> {
  const r = input.complianceResult;

  const expired = !!input.windowExpired || !!r?.windowExpired;
  const penalty = !!input.penaltyApplied || !!r?.permanentPenaltyToken;

  const status = r?.status ?? (penalty ? 'PENALTY_PERMANENT' : expired ? 'NONCOMPLIANT' : 'PENDING');

  const base =
    status === 'COMPLIANT' ? 0.10 :
    status === 'PENDING' ? 0.45 :
    status === 'NONCOMPLIANT' ? 0.70 :
    0.85;

  const windowRemaining =
    r
      ? clamp((r.windowCloseTick - r.tick) / Math.max(1, r.windowCloseTick - r.windowOpenTick), -1, 1)
      : 0;

  const urgencyBoost = status === 'PENDING' ? clamp(1 - windowRemaining, 0, 1) * 0.25 : 0;
  const penaltyBoost = penalty ? 0.10 : 0.0;

  const score = clamp(base + urgencyBoost + penaltyBoost, 0.01, 0.99);

  const topFactors: string[] = [];
  topFactors.push(`Status: ${status}`);
  if (r?.trigger?.kind) topFactors.push(`Trigger: ${r.trigger.kind}`);
  if (expired) topFactors.push('Compliance window expired');
  if (penalty) topFactors.push('Permanent penalty token issued');
  topFactors.push('Advisory only (no state mutation)');

  const recommendation =
    status === 'COMPLIANT'
      ? 'Compliance complete—store audit hash and keep proof artifacts linked to the run.'
      : status === 'PENDING'
        ? 'Submit compliance inside the open window; delay converts into a permanent penalty state.'
        : status === 'PENALTY_PERMANENT'
          ? 'Route future actions through proof gates and mitigation steps to reduce recurring compliance drag.'
          : 'Submit immediately; if the window closes, the penalty state becomes permanent.';

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation,
    auditHash: computeHash(m149SafeStringify(input) + ':ml:M149'),
    confidenceDecay: status === 'COMPLIANT' ? 0.03 : status === 'PENDING' ? 0.07 : 0.10,
  };
}