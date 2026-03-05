// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m146_audit_event_forced_documentation_under_timer.ts
//
// Mechanic : M146 — Audit Event: Forced Documentation Under Timer
// Family   : ops   Layer: backend_service   Priority: 1   Batch: 3
// ML Pair  : m146a
// Deps     : M46, M47
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

// ── Import Anchors (keep every import "accessible" + used) ────────────────────

/**
 * Runtime access to the canonical mechanicsUtils symbols imported by this mechanic.
 * (Useful for debugging, inspection, and keeping generator-wide imports “live”.)
 */
export const M146_IMPORTED_SYMBOLS = {
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
export type M146_ImportedTypesAnchor = {
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

// ── Local domain (not part of global mechanics/types.ts) ────────────────────

export type AuditTriggerKind =
  | 'TAMPER_FLAG'
  | 'SIGNATURE_MISMATCH'
  | 'EVIDENCE_GAP'
  | 'RISK_ESCALATION'
  | 'MANUAL'
  | 'UNKNOWN';

export interface AuditTrigger {
  kind: AuditTriggerKind;
  /** Optional: upstream mechanic id that triggered this audit (e.g., M46/M47). */
  sourceMechanic?: string;
  /** Human-readable reason (kept short, no PII). */
  reason?: string;
  /** 0..100 (bounded). */
  severity?: number;
  /** If provided, authoritative deadline tick. */
  deadlineTick?: number;
  /** Keys the auditor expects as proof artifacts (UI-driven). */
  requiredKeys?: string[];
  /** Extensible JSON-safe metadata. */
  meta?: Record<string, unknown>;
}

export interface AuditRequirement {
  key: string;
  required: boolean;
  submitted: boolean;
  proofHash: string;
}

export interface AuditEntry {
  id: string;
  runId: string;
  tick: number;

  trigger: AuditTrigger;

  phase: RunPhase;
  pressure: PressureTier;
  regime: MacroRegime;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  /** Featured deterministic reference card (keeps audits legible + repeatable). */
  featuredCardId: string;
  featuredCard: GameCard;

  /** Timer contract. */
  deadlineTick: number;
  timerExpired: boolean;

  requirements: AuditRequirement[];

  documentationSubmitted: boolean;

  /** Stable verification hash for this audit entry. */
  auditHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M146Input {
  auditTrigger?: AuditTrigger;
  stateTick?: number;
  documentationRequired?: unknown;
}

export interface M146Output {
  auditEntry: AuditEntry;
  documentationSubmitted: boolean;
  auditHash: string;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M146Event = 'AUDIT_TRIGGERED' | 'DOCUMENTATION_SUBMITTED' | 'AUDIT_HASH_STORED';

export interface M146TelemetryPayload extends MechanicTelemetryPayload {
  event: M146Event;
  mechanic_id: 'M146';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M146_BOUNDS = {
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

export const M146_AUDIT_BOUNDS = {
  /** Maximum number of requirement keys we will track per audit entry. */
  MAX_REQUIREMENTS: 12,
  /** Fallback timer window if no deadline is supplied. */
  MIN_WINDOW_TICKS: 3,
  MAX_WINDOW_TICKS: 24,
  /** Bounded jitter for timer window to reduce perfect timing exploits (deterministic). */
  MAX_JITTER_TICKS: 2,
} as const;

// ── Internal helpers (no state mutation) ───────────────────────────────────

function m146SafeStringify(v: unknown): string {
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

function m146ToInt(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.floor(v);
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.floor(n);
  }
  if (typeof v === 'boolean') return v ? 1 : 0;
  return fallback;
}

function m146DerivePhaseFromProgress(progress: number): RunPhase {
  return progress < 0.33 ? 'EARLY' : progress < 0.66 ? 'MID' : 'LATE';
}

function m146InChaosWindow(tick: number, chaosWindows: ChaosWindow[]): boolean {
  for (const w of chaosWindows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m146DerivePressureTier(tick: number, runPhase: RunPhase, chaosWindows: ChaosWindow[]): PressureTier {
  if (m146InChaosWindow(tick, chaosWindows)) return 'CRITICAL';
  if (runPhase === 'EARLY') return 'LOW';
  if (runPhase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function m146DeriveRegimeFromSchedule(tick: number, macroSchedule: MacroEvent[]): MacroRegime {
  let regime: MacroRegime = 'NEUTRAL';
  const sorted = [...macroSchedule].sort((a, b) => a.tick - b.tick);
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m146NormalizeTrigger(t: AuditTrigger | undefined): AuditTrigger {
  const kind: AuditTriggerKind = (t?.kind as AuditTriggerKind) ?? 'UNKNOWN';
  const severity = clamp(m146ToInt(t?.severity, 25), 0, 100);
  const requiredKeys = Array.isArray(t?.requiredKeys) ? (t?.requiredKeys as unknown[]).map(k => String(k ?? '').trim()).filter(Boolean) : [];
  return {
    kind,
    sourceMechanic: t?.sourceMechanic ? String(t.sourceMechanic) : undefined,
    reason: t?.reason ? String(t.reason).slice(0, 140) : undefined,
    severity,
    deadlineTick: t?.deadlineTick != null ? clamp(m146ToInt(t.deadlineTick, 0), 0, RUN_TOTAL_TICKS - 1) : undefined,
    requiredKeys,
    meta: (t?.meta && typeof t.meta === 'object') ? (t.meta as Record<string, unknown>) : undefined,
  };
}

function m146DefaultRequiredKeys(kind: AuditTriggerKind): string[] {
  // Minimal canonical keys for audit documentation (purely symbolic; UI can map these).
  if (kind === 'SIGNATURE_MISMATCH') return ['signature', 'action', 'timestamp'];
  if (kind === 'TAMPER_FLAG') return ['ledgerEntry', 'previousHash', 'currentHash'];
  if (kind === 'EVIDENCE_GAP') return ['proof', 'witness', 'context'];
  if (kind === 'RISK_ESCALATION') return ['riskNote', 'mitigation', 'approval'];
  if (kind === 'MANUAL') return ['note', 'attachment', 'ack'];
  return ['note', 'proof'];
}

function m146NormalizeRequiredKeys(trigger: AuditTrigger, seed: string): string[] {
  const base = trigger.requiredKeys && trigger.requiredKeys.length > 0 ? trigger.requiredKeys : m146DefaultRequiredKeys(trigger.kind);
  const uniq = Array.from(new Set(base.map(k => String(k ?? '').trim()).filter(Boolean)));
  const capped = uniq.slice(0, M146_AUDIT_BOUNDS.MAX_REQUIREMENTS);
  return seededShuffle(capped, computeHash(seed + ':reqKeys'));
}

function m146InferDocumentationSubmitted(doc: unknown): boolean {
  if (doc == null) return false;
  if (typeof doc === 'boolean') return doc;
  if (typeof doc === 'number') return Number.isFinite(doc) && doc > 0;
  if (typeof doc === 'string') return doc.trim().length > 0;
  if (Array.isArray(doc)) return doc.length > 0;
  if (typeof doc === 'object') return true; // payload exists (treat as submitted packet)
  return false;
}

function m146HasProofForKey(doc: unknown, key: string): boolean {
  if (!key) return false;
  if (doc == null) return false;
  if (typeof doc === 'boolean') return doc;
  if (typeof doc === 'string') return doc.includes(key);
  if (Array.isArray(doc)) return doc.some(v => String(v ?? '') === key);
  if (typeof doc === 'object') return Object.prototype.hasOwnProperty.call(doc as Record<string, unknown>, key);
  return false;
}

function m146PickFeaturedCard(seed: string, tick: number, pressure: PressureTier, phase: RunPhase, regime: MacroRegime) {
  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;

  const pool = buildWeightedPool(seed, pressureWeight * phaseWeight, regimeWeight);
  const safePool = pool.length ? pool : [DEFAULT_CARD];

  const idx = seededIndex(seed, tick + 999, safePool.length);
  const oppIdx = seededIndex(seed, tick + 777, Math.max(1, OPPORTUNITY_POOL.length));
  const fallback = OPPORTUNITY_POOL[oppIdx] ?? DEFAULT_CARD;

  const featured = safePool[idx] ?? fallback ?? DEFAULT_CARD;
  const idIdx = seededIndex(seed, tick + 31337, Math.max(1, DEFAULT_CARD_IDS.length));
  const featuredId = featured.id || (DEFAULT_CARD_IDS[idIdx] ?? DEFAULT_CARD.id);

  return { featuredCard: featured, featuredCardId: featuredId };
}

function m146ComputeWindowTicks(seed: string, tick: number, regime: MacroRegime): number {
  const base = M146_BOUNDS.FIRST_REFUSAL_TICKS;
  const pulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  // Deterministic jitter: -MAX..+MAX
  const jLen = 2 * M146_AUDIT_BOUNDS.MAX_JITTER_TICKS + 1;
  const jitter = seededIndex(seed, tick + 4242, jLen) - M146_AUDIT_BOUNDS.MAX_JITTER_TICKS;

  // Regime/pulse scale: harsher in CRISIS (smaller window), softer in BULL.
  const scaled = Math.round(base * clamp(pulse, 0.5, 1.25));

  return clamp(
    scaled + jitter,
    M146_AUDIT_BOUNDS.MIN_WINDOW_TICKS,
    M146_AUDIT_BOUNDS.MAX_WINDOW_TICKS,
  );
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * auditEventDocumenter
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function auditEventDocumenter(input: M146Input, emit: MechanicEmitter): M146Output {
  const tick = clamp(m146ToInt(input.stateTick, 0), 0, RUN_TOTAL_TICKS - 1);

  const serviceHash = computeHash(m146SafeStringify(input ?? {}));
  const seed = computeHash(`M146:${serviceHash}:${tick}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const progress = clamp((tick + 1) / RUN_TOTAL_TICKS, 0, 1);
  const phase: RunPhase = m146DerivePhaseFromProgress(progress);
  const pressure: PressureTier = m146DerivePressureTier(tick, phase, chaosWindows);
  const regime: MacroRegime = m146DeriveRegimeFromSchedule(tick, macroSchedule);

  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;

  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const pulseMultiplier = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const decayRate = computeDecayRate(regime, M146_BOUNDS.BASE_DECAY_RATE);

  const trigger = m146NormalizeTrigger(input.auditTrigger);

  const windowTicks = m146ComputeWindowTicks(seed, tick, regime);
  const deadlineTick = clamp(trigger.deadlineTick ?? (tick + windowTicks), 0, RUN_TOTAL_TICKS - 1);
  const timerExpired = tick >= deadlineTick;

  const requiredKeys = m146NormalizeRequiredKeys(trigger, seed);
  const documentationPayload = input.documentationRequired;

  const documentationSubmitted = m146InferDocumentationSubmitted(documentationPayload) && !timerExpired;

  const requirements: AuditRequirement[] = requiredKeys.map((key) => {
    const hasProof = m146HasProofForKey(documentationPayload, key);
    const proofHash = computeHash(`${seed}:proof:${key}:${hasProof ? '1' : '0'}`);
    return {
      key,
      required: true,
      submitted: documentationSubmitted ? hasProof || documentationPayload === true : false,
      proofHash,
    };
  });

  const { featuredCard, featuredCardId } = m146PickFeaturedCard(seed, tick, pressure, phase, regime);

  const entryId = computeHash(`${serviceHash}:audit:${tick}:${trigger.kind}`);

  const documentationHash = computeHash(`${serviceHash}:doc:${m146SafeStringify(documentationPayload)}`);

  const auditHash = computeHash(
    m146SafeStringify({
      v: 'M146/v1',
      entryId,
      runId: serviceHash,
      tick,
      trigger,
      phase,
      pressure,
      regime,
      weights: { pressureWeight, phaseWeight, regimeWeight, regimeMultiplier, pulseMultiplier, decayRate },
      deadlineTick,
      timerExpired,
      featuredCardId,
      requirements: requirements.map(r => ({ k: r.key, s: r.submitted, h: r.proofHash })),
      documentationSubmitted,
      documentationHash,
    }),
  );

  const auditEntry: AuditEntry = {
    id: entryId,
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
    deadlineTick,
    timerExpired,
    requirements,
    documentationSubmitted,
    auditHash,
  };

  emit({
    event: 'AUDIT_TRIGGERED',
    mechanic_id: 'M146',
    tick,
    runId: serviceHash,
    payload: {
      entryId,
      kind: trigger.kind,
      severity: trigger.severity ?? 0,
      deadlineTick,
      timerExpired,
      phase,
      pressure,
      regime,
      featuredCardId,
      windowTicks,
      weights: { pressureWeight, phaseWeight, regimeWeight, regimeMultiplier, pulseMultiplier, decayRate },
    },
  });

  if (documentationSubmitted) {
    const missing = requirements.filter(r => !r.submitted).map(r => r.key);
    emit({
      event: 'DOCUMENTATION_SUBMITTED',
      mechanic_id: 'M146',
      tick,
      runId: serviceHash,
      payload: {
        entryId,
        documentationHash,
        requiredCount: requirements.length,
        missingKeys: missing,
      },
    });
  }

  emit({
    event: 'AUDIT_HASH_STORED',
    mechanic_id: 'M146',
    tick,
    runId: serviceHash,
    payload: {
      entryId,
      auditHash,
      documentationHash,
    },
  });

  return {
    auditEntry,
    documentationSubmitted,
    auditHash,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M146MLInput {
  auditEntry?: AuditEntry;
  documentationSubmitted?: boolean;
  auditHash?: string;
  runId: string;
  tick: number;
}

export interface M146MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * auditEventDocumenterMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function auditEventDocumenterMLCompanion(input: M146MLInput): Promise<M146MLOutput> {
  const entry = input.auditEntry;

  const submitted = !!input.documentationSubmitted;
  const expired = !!entry?.timerExpired;

  const missing = (entry?.requirements ?? []).filter(r => r.required && !r.submitted).length;
  const totalReq = (entry?.requirements ?? []).filter(r => r.required).length;

  const base = submitted ? 0.25 : 0.65;
  const expiryPenalty = expired ? 0.25 : 0.0;
  const missingPenalty = totalReq > 0 ? clamp(missing / totalReq, 0, 1) * 0.35 : 0.0;

  const score = clamp(base + expiryPenalty + missingPenalty, 0.01, 0.99);

  const topFactors: string[] = [];
  if (expired) topFactors.push('Timer expired before documentation completion');
  if (!submitted) topFactors.push('Documentation not submitted');
  if (missing > 0) topFactors.push(`Missing required proofs: ${missing}/${Math.max(1, totalReq)}`);
  if (entry?.trigger?.kind) topFactors.push(`Trigger: ${entry.trigger.kind}`);
  topFactors.push('Advisory only (no state mutation)');

  const recommendation =
    expired
      ? 'Escalate: audit timer expired—lock progression until proof artifacts are submitted.'
      : submitted
        ? 'Audit satisfied: store proof hashes and proceed with normal flow.'
        : 'Audit pending: prompt for required proof artifacts before the timer expires.';

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation,
    auditHash: computeHash(m146SafeStringify(input) + ':ml:M146'),
    confidenceDecay: expired ? 0.15 : submitted ? 0.05 : 0.10,
  };
}