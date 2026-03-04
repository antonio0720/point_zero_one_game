// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m71_device_attestation_trust_tiers_for_competitive_markets.ts
//
// Mechanic : M71 — Device Attestation: Trust Tiers for Competitive + Markets
// Family   : integrity_advanced   Layer: backend_service   Priority: 1   Batch: 2
// ML Pair  : m71a
// Deps     : M47
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

// ── Local domain types (M71-specific; kept here to avoid circular deps) ──────

export type TrustTierId =
  | 'T0_UNTRUSTED'
  | 'T1_BASIC'
  | 'T2_VERIFIED'
  | 'T3_HARDENED'
  | 'T4_SOVEREIGN';

export interface TrustTierEntry {
  id: TrustTierId;
  minScore: number;                 // 0..1
  competitiveEligible: boolean;
  note: string;
}

export interface TrustTierTable {
  tiers: TrustTierEntry[];
  rulesVersion?: string;
  // If true, chaos windows make thresholds stricter (higher minScore effectively).
  strictInChaos?: boolean;
  // If provided, require a minimum fingerprint length; otherwise defaults apply.
  minFingerprintLength?: number;
}

export type AttestationFailureReason =
  | 'MISSING_FINGERPRINT'
  | 'MISSING_CHALLENGE'
  | 'INVALID_CHALLENGE_FORMAT'
  | 'PROOF_MISMATCH'
  | 'FINGERPRINT_TOO_SHORT'
  | 'FINGERPRINT_SUSPICIOUS'
  | 'UNKNOWN';

export interface AttestationResult {
  ok: boolean;
  reason?: AttestationFailureReason;

  // Challenge parse (expected format: "<nonce>.<proof>")
  nonce?: string;
  providedProof?: string;
  expectedProof?: string;

  // Deterministic signals
  trustScore: number;               // 0..1 (post multipliers)
  baseScore: number;                // 0..1 (pre multipliers)
  entropyScore: number;             // 0..1
  chaosPenalty: number;             // 0..1

  // Context signals (deterministic derived from runId)
  tick: number;
  runPhase: RunPhase;
  tickTier: TickTier;
  pressureTier: PressureTier;
  macroRegime: MacroRegime;
  inChaosWindow: boolean;

  // Policy card used to shape evaluation (deterministic)
  policyCardId: string;
  policyCardName: string;

  // Auditability
  decayRate: number;
  auditHash: string;
  rulesVersion: string;
}

// ── Type-usage anchor (ensures ALL imported types are used within this module) ──
type _M71_AllImportedTypesUsed =
  | RunPhase | TickTier | MacroRegime | PressureTier | SolvencyStatus
  | Asset | IPAItem | GameCard | GameEvent | ShieldLayer | Debt | Buff
  | Liability | SetBonus | AssetMod | IncomeItem | MacroEvent | ChaosWindow
  | AuctionResult | PurchaseResult | ShieldResult | ExitResult | TickResult
  | DeckComposition | TierProgress | WipeEvent | RegimeShiftEvent
  | PhaseTransitionEvent | TimerExpiredEvent | StreakEvent | FubarEvent
  | LedgerEntry | ProofCard | CompletedRun | SeasonState | RunState
  | MomentEvent | ClipBoundary;

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M71Input {
  deviceFingerprint?: string;
  attestationChallenge?: string;    // expected: "<nonce>.<proof>"
  trustTierTable?: TrustTierTable;
}

export interface M71Output {
  deviceTrustTier: string;
  attestationResult: AttestationResult;
  competitiveEligible: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M71Event = 'DEVICE_ATTESTED' | 'TRUST_TIER_ASSIGNED' | 'ATTESTATION_FAILED';

export interface M71TelemetryPayload extends MechanicTelemetryPayload {
  event: M71Event;
  mechanic_id: 'M71';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M71_BOUNDS = {
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

const M71_RULES_VERSION = 'm71.rules.v1';

// ── Deterministic helpers ──────────────────────────────────────────────────

function stableRunId(input: M71Input): string {
  return computeHash(JSON.stringify(input));
}

function isInChaosWindow(windows: ChaosWindow[], tick: number): boolean {
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function regimeAtTick(schedule: MacroEvent[], tick: number): MacroRegime {
  let regime = 'NEUTRAL' as unknown as MacroRegime;
  for (const ev of schedule) {
    if ((ev as any)?.type === 'REGIME_SHIFT' && typeof (ev as any)?.tick === 'number' && (ev as any).tick <= tick) {
      if ((ev as any)?.regimeChange) regime = (ev as any).regimeChange as MacroRegime;
    }
  }
  return regime;
}

function pickRunPhase(tick: number): RunPhase {
  const third = Math.max(1, Math.floor(RUN_TOTAL_TICKS / 3));
  if (tick < third) return 'EARLY' as unknown as RunPhase;
  if (tick < third * 2) return 'MID' as unknown as RunPhase;
  return 'LATE' as unknown as RunPhase;
}

function derivePressureTier(fingerprint: string, ok: boolean, inChaos: boolean): PressureTier {
  const len = fingerprint.trim().length;
  const heat = (ok ? 0 : 40) + (inChaos ? 20 : 0) + clamp(len, 0, 64) * 0.5;

  if (heat >= 80) return 'CRITICAL' as unknown as PressureTier;
  if (heat >= 55) return 'HIGH' as unknown as PressureTier;
  if (heat >= 28) return 'MEDIUM' as unknown as PressureTier;
  return 'LOW' as unknown as PressureTier;
}

function deriveTickTier(pressure: PressureTier, inChaos: boolean): TickTier {
  if (inChaos) return 'CRITICAL' as unknown as TickTier;
  if (String(pressure) === 'CRITICAL') return 'CRITICAL' as unknown as TickTier;
  if (String(pressure) === 'HIGH') return 'ELEVATED' as unknown as TickTier;
  return 'STANDARD' as unknown as TickTier;
}

function parseChallenge(challenge: string): { nonce?: string; proof?: string; ok: boolean } {
  const raw = challenge.trim();
  if (!raw) return { ok: false };

  const dot = raw.indexOf('.');
  if (dot <= 0 || dot === raw.length - 1) return { ok: false };

  const nonce = raw.slice(0, dot).trim();
  const proof = raw.slice(dot + 1).trim();
  if (!nonce || !proof) return { ok: false };

  return { nonce, proof, ok: true };
}

function fingerprintEntropyScore(fp: string): number {
  const s = fp.trim();
  if (!s) return 0;

  const set = new Set<string>();
  for (let i = 0; i < s.length; i++) set.add(s[i]);
  const unique = set.size;

  const uniformPenalty = unique <= 2 ? 0.25 : unique <= 4 ? 0.12 : 0.0;

  const lengthScore = clamp(s.length / 48, 0, 1);
  const varietyScore = clamp(unique / 24, 0, 1);

  return clamp((lengthScore * 0.6 + varietyScore * 0.4) - uniformPenalty, 0, 1);
}

function fingerprintLooksSuspicious(fp: string): boolean {
  const s = fp.trim().toLowerCase();
  if (!s) return true;
  if (s === 'unknown' || s === 'n/a' || s === 'null' || s === 'undefined') return true;
  if (/^0+$/.test(s)) return true;
  if (/^f+$/i.test(s)) return true;
  return false;
}

// Backward-compatible alias (prevents future “cannot find name” if older call-sites exist)
function deviceFingerprintLooksSuspicious(fp: string): boolean {
  return fingerprintLooksSuspicious(fp);
}

function defaultTrustTierTable(): TrustTierTable {
  return {
    rulesVersion: M71_RULES_VERSION,
    strictInChaos: true,
    minFingerprintLength: 18,
    tiers: [
      { id: 'T0_UNTRUSTED', minScore: 0.0,  competitiveEligible: false, note: 'Untrusted device or failed proof.' },
      { id: 'T1_BASIC',     minScore: 0.30, competitiveEligible: false, note: 'Basic signals only; casual modes allowed.' },
      { id: 'T2_VERIFIED',  minScore: 0.55, competitiveEligible: true,  note: 'Verified proof; competitive allowed with monitoring.' },
      { id: 'T3_HARDENED',  minScore: 0.72, competitiveEligible: true,  note: 'Hardened profile; reduced decay.' },
      { id: 'T4_SOVEREIGN', minScore: 0.86, competitiveEligible: true,  note: 'Highest trust; strongest routing privileges.' },
    ],
  };
}

function normalizeTierTable(table?: TrustTierTable): TrustTierTable {
  const base = defaultTrustTierTable();
  if (!table) return base;

  const tiers = Array.isArray(table.tiers) && table.tiers.length
    ? table.tiers
        .map(t => ({
          id: t.id,
          minScore: clamp(Number(t.minScore ?? 0), 0, 1),
          competitiveEligible: Boolean(t.competitiveEligible),
          note: String(t.note ?? ''),
        }))
        .sort((a, b) => a.minScore - b.minScore)
    : base.tiers;

  return {
    tiers,
    rulesVersion: String(table.rulesVersion ?? base.rulesVersion ?? M71_RULES_VERSION),
    strictInChaos: table.strictInChaos ?? base.strictInChaos,
    minFingerprintLength: typeof table.minFingerprintLength === 'number'
      ? table.minFingerprintLength
      : base.minFingerprintLength,
  };
}

function assignTrustTier(table: TrustTierTable, score: number, inChaos: boolean): TrustTierEntry {
  const strict = Boolean(table.strictInChaos);
  const chaosBump = strict && inChaos ? 0.06 : 0.0;
  const effective = clamp(score - chaosBump, 0, 1);

  let chosen = table.tiers[0] ?? { id: 'T0_UNTRUSTED', minScore: 0, competitiveEligible: false, note: '' };
  for (const t of table.tiers) {
    if (effective >= t.minScore) chosen = t;
  }
  return chosen;
}

function pickPolicyCard(
  runId: string,
  tick: number,
  runPhase: RunPhase,
  pressureTier: PressureTier,
  macroRegime: MacroRegime,
): GameCard {
  const pW = (PRESSURE_WEIGHTS as any)?.[pressureTier] ?? 1.0;
  const phW = (PHASE_WEIGHTS as any)?.[runPhase] ?? 1.0;
  const rW = (REGIME_WEIGHTS as any)?.[macroRegime] ?? 1.0;

  const weighted = buildWeightedPool(runId, pW * phW, rW);

  const shuffledIds = seededShuffle(DEFAULT_CARD_IDS, runId);
  const fallbackId = shuffledIds[seededIndex(runId, tick + 17, Math.max(1, shuffledIds.length))] ?? DEFAULT_CARD.id;

  return (
    weighted[seededIndex(runId, tick + 18, Math.max(1, weighted.length))] ??
    OPPORTUNITY_POOL.find(c => c.id === fallbackId) ??
    DEFAULT_CARD
  );
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * deviceAttestationVerifier
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function deviceAttestationVerifier(
  input: M71Input,
  emit: MechanicEmitter,
): M71Output {
  const deviceFingerprint = String(input.deviceFingerprint ?? '').trim();
  const challenge = String(input.attestationChallenge ?? '').trim();

  const runId = stableRunId(input);

  const macroSchedule = buildMacroSchedule(runId, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(runId, CHAOS_WINDOWS_PER_RUN);

  const tick = seededIndex(runId, 0, RUN_TOTAL_TICKS);
  const inChaos = isInChaosWindow(chaosWindows, tick);
  const macroRegime = regimeAtTick(macroSchedule, tick);
  const runPhase = pickRunPhase(tick);

  const table = normalizeTierTable(input.trustTierTable);
  const minFpLen = clamp(Number(table.minFingerprintLength ?? 18), 6, 128);

  let ok = true;
  let reason: AttestationFailureReason | undefined;

  if (!deviceFingerprint) {
    ok = false; reason = 'MISSING_FINGERPRINT';
  } else if (fingerprintLooksSuspicious(deviceFingerprint)) { // ✅ fixed name
    ok = false; reason = 'FINGERPRINT_SUSPICIOUS';
  } else if (deviceFingerprint.length < minFpLen) {
    ok = false; reason = 'FINGERPRINT_TOO_SHORT';
  } else if (!challenge) {
    ok = false; reason = 'MISSING_CHALLENGE';
  }

  const parsed = parseChallenge(challenge);
  if (ok && !parsed.ok) {
    ok = false; reason = 'INVALID_CHALLENGE_FORMAT';
  }

  const nonce = parsed.nonce;
  const providedProof = parsed.proof;
  const expectedProof = (ok && nonce) ? computeHash(`${deviceFingerprint}:${nonce}`) : undefined;

  if (ok && expectedProof && providedProof !== expectedProof) {
    ok = false; reason = 'PROOF_MISMATCH';
  }

  const pressureTier = derivePressureTier(deviceFingerprint, ok, inChaos);
  const tickTier = deriveTickTier(pressureTier, inChaos);

  const policyCard = pickPolicyCard(runId, tick, runPhase, pressureTier, macroRegime);

  const policyType = (policyCard as any)?.type;
  const entropyScore = fingerprintEntropyScore(deviceFingerprint);
  const baseScore =
    clamp(
      (ok ? 0.62 : 0.04) +
        entropyScore * 0.28 +
        (policyType === 'OPPORTUNITY' ? 0.06 : 0.02),
      0,
      1,
    );

  const regimeMultiplier = (REGIME_MULTIPLIERS as any)?.[macroRegime] ?? 1.0;
  const exitPulse = (EXIT_PULSE_MULTIPLIERS as any)?.[macroRegime] ?? 1.0;

  const chaosPenalty = inChaos ? 0.92 : 1.0;

  const shaped =
    baseScore *
    M71_BOUNDS.MULTIPLIER *
    clamp(regimeMultiplier, 0.6, 1.25) *
    clamp(exitPulse, 0.6, 1.25) *
    chaosPenalty *
    M71_BOUNDS.EFFECT_MULTIPLIER;

  const trustScore = clamp(shaped, 0, 1);
  const tier = assignTrustTier(table, trustScore, inChaos);

  const competitiveEligible = Boolean(ok && tier.competitiveEligible);
  const decayRate = computeDecayRate(macroRegime, M71_BOUNDS.BASE_DECAY_RATE);

  const auditHash = computeHash(JSON.stringify({
    rules: M71_RULES_VERSION,
    runId,
    tick,
    inChaos,
    macroRegime,
    runPhase: String(runPhase),
    pressureTier: String(pressureTier),
    tickTier: String(tickTier),
    policyCardId: policyCard.id,
    ok,
    reason,
    nonce,
    expectedProof,
    providedProof,
    entropyScore,
    baseScore,
    trustScore,
    tierId: tier.id,
    decayRate,
  }));

  const attestationResult: AttestationResult = {
    ok,
    reason,

    nonce,
    providedProof,
    expectedProof,

    trustScore,
    baseScore,
    entropyScore,
    chaosPenalty,

    tick,
    runPhase,
    tickTier,
    pressureTier,
    macroRegime,
    inChaosWindow: inChaos,

    policyCardId: policyCard.id,
    policyCardName: String((policyCard as any)?.name ?? ''),

    decayRate,
    auditHash,
    rulesVersion: M71_RULES_VERSION,
  };

  if (ok) {
    const attested: M71TelemetryPayload = {
      event: 'DEVICE_ATTESTED',
      mechanic_id: 'M71',
      tick,
      runId,
      payload: {
        tier: tier.id,
        trustScore,
        entropyScore,
        macroRegime,
        inChaosWindow: inChaos,
        policyCardId: policyCard.id,
        decayRate,
      },
    };
    emit(attested);
  } else {
    const failed: M71TelemetryPayload = {
      event: 'ATTESTATION_FAILED',
      mechanic_id: 'M71',
      tick,
      runId,
      payload: {
        reason: reason ?? 'UNKNOWN',
        macroRegime,
        inChaosWindow: inChaos,
        entropyScore,
        policyCardId: policyCard.id,
        decayRate,
      },
    };
    emit(failed);
  }

  const assigned: M71TelemetryPayload = {
    event: 'TRUST_TIER_ASSIGNED',
    mechanic_id: 'M71',
    tick,
    runId,
    payload: {
      deviceTrustTier: tier.id,
      competitiveEligible,
      trustScore,
      baseScore,
      auditHash,
      rulesVersion: M71_RULES_VERSION,
    },
  };
  emit(assigned);

  return {
    deviceTrustTier: tier.id,
    attestationResult,
    competitiveEligible,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M71MLInput {
  deviceTrustTier?: string;
  attestationResult?: AttestationResult;
  competitiveEligible?: boolean;
  runId: string;
  tick: number;
}

export interface M71MLOutput {
  score: number;               // 0–1
  topFactors: string[];        // max 5 plain-English factors
  recommendation: string;      // single sentence
  auditHash: string;           // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;     // 0–1, how fast this signal should decay
}

/**
 * deviceAttestationVerifierMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function deviceAttestationVerifierMLCompanion(
  input: M71MLInput,
): Promise<M71MLOutput> {
  const r = input.attestationResult;
  const base = clamp(Number(r?.trustScore ?? 0.1), 0.01, 0.99);

  const factors: string[] = [];
  if (r) {
    factors.push(r.ok ? 'Attestation OK' : `Fail: ${r.reason ?? 'UNKNOWN'}`);
    factors.push(`Tier: ${String(input.deviceTrustTier ?? 'unknown')}`);
    factors.push(`Regime: ${String(r.macroRegime)}`);
    if (r.inChaosWindow) factors.push('Chaos window');
    factors.push(`Entropy: ${r.entropyScore.toFixed(2)}`);
  }

  const topFactors = factors.slice(0, 5);
  const confidenceDecay = clamp(Number(r?.decayRate ?? 0.05), 0.01, 0.30);

  return {
    score: base,
    topFactors: topFactors.length ? topFactors : ['M71 signal computed', 'advisory only'],
    recommendation: (input.competitiveEligible && base >= 0.7)
      ? 'Allow competitive entry; keep passive monitoring enabled.'
      : 'Restrict competitive entry; request re-attestation or step-up verification.',
    auditHash: computeHash(JSON.stringify(input) + `:${M71_RULES_VERSION}:ml:M71`),
    confidenceDecay,
  };
}