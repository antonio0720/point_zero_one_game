// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m74_forensic_snapshot_bundles_exportable_run_truth_packets.ts
//
// Mechanic : M74 — Forensic Snapshot Bundles: Exportable Run Truth Packets
// Family   : integrity_advanced   Layer: backend_service   Priority: 2   Batch: 2
// ML Pair  : m74a
// Deps     : M46, M50
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

// ── Local domain types (M74-specific; kept here to avoid circular deps) ──────

export type RedactionRule =
  | string
  | { key: string }
  | { keys: string[] }
  | { path: string } // shallow "a.b.c" supported for payload objects
  | { matchKeyPrefix: string };

/**
 * SnapshotBundle
 * A deterministic “truth packet” bundle of ledger entries + metadata.
 */
export interface SnapshotBundle {
  runId: string;
  tick: number;

  runPhase: RunPhase;
  tickTier: TickTier;
  pressureTier: PressureTier;

  macroRegime: MacroRegime;
  inChaosWindow: boolean;

  // Policy shaping (deterministic)
  policyCardId: string;
  policyCardName: string;

  // Core data
  entryCount: number;
  entryHashes: string[];      // per-entry hashes (ordered)
  sampleHashes: string[];     // deterministic sampled hashes for quick integrity checks
  bundleHash: string;         // hash(entries + policy + context)

  // Integrity signals
  integrityScore: number;     // 0..1
  decayRate: number;
  auditHash: string;
  rulesVersion: string;

  // Redaction bookkeeping
  redactionApplied: boolean;
  redactionRuleCount: number;
}

/**
 * ExportPacket
 * A stable exportable container for transport/storage. Data is JSON-serializable.
 */
export interface ExportPacket {
  runId: string;
  packetVersion: string;
  createdTick: number;
  data: Record<string, unknown>;
  hash: string;
}

/**
 * Type-usage anchor (ensures ALL imported types are used within this module)
 */
type _M74_AllImportedTypesUsed =
  | RunPhase | TickTier | MacroRegime | PressureTier | SolvencyStatus
  | Asset | IPAItem | GameCard | GameEvent | ShieldLayer | Debt | Buff
  | Liability | SetBonus | AssetMod | IncomeItem | MacroEvent | ChaosWindow
  | AuctionResult | PurchaseResult | ShieldResult | ExitResult | TickResult
  | DeckComposition | TierProgress | WipeEvent | RegimeShiftEvent
  | PhaseTransitionEvent | TimerExpiredEvent | StreakEvent | FubarEvent
  | LedgerEntry | ProofCard | CompletedRun | SeasonState | RunState
  | MomentEvent | ClipBoundary;

// Exported to satisfy TS noUnusedLocals while preserving the anchor (tree-shake safe).
export const __M74_TYPE_ANCHOR: _M74_AllImportedTypesUsed | null = null;

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M74Input {
  runId?: string;
  ledgerEntries?: LedgerEntry[];
  redactionRules?: unknown[];
}

export interface M74Output {
  snapshotBundle: SnapshotBundle;
  exportedPacket: ExportPacket;
  redactedHash: string;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M74Event = 'SNAPSHOT_BUNDLED' | 'PACKET_EXPORTED' | 'REDACTION_APPLIED';

export interface M74TelemetryPayload extends MechanicTelemetryPayload {
  event: M74Event;
  mechanic_id: 'M74';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M74_BOUNDS = {
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

const M74_RULES_VERSION = 'm74.rules.v1';
const M74_PACKET_VERSION = 'm74.packet.v1';

// ── Deterministic helpers ──────────────────────────────────────────────────

function stableRunId(input: M74Input): string {
  const explicit = String(input.runId ?? '').trim();
  return explicit || computeHash(JSON.stringify(input));
}

function isInChaosWindow(windows: ChaosWindow[], tick: number): boolean {
  for (const w of windows) {
    const s = Number((w as any)?.startTick);
    const e = Number((w as any)?.endTick);
    if (Number.isFinite(s) && Number.isFinite(e) && tick >= s && tick <= e) return true;
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

function derivePressureTier(entryCount: number, inChaos: boolean): PressureTier {
  const heat = entryCount * 4 + (inChaos ? 20 : 0);
  if (heat >= 90) return 'CRITICAL' as unknown as PressureTier;
  if (heat >= 60) return 'HIGH' as unknown as PressureTier;
  if (heat >= 30) return 'MEDIUM' as unknown as PressureTier;
  return 'LOW' as unknown as PressureTier;
}

function deriveTickTier(pressure: PressureTier, inChaos: boolean): TickTier {
  if (inChaos) return 'CRITICAL' as unknown as TickTier;
  if (String(pressure) === 'CRITICAL') return 'CRITICAL' as unknown as TickTier;
  if (String(pressure) === 'HIGH') return 'ELEVATED' as unknown as TickTier;
  return 'STANDARD' as unknown as TickTier;
}

function normalizeRedactionRules(raw: unknown[]): RedactionRule[] {
  const out: RedactionRule[] = [];
  for (const r of raw) {
    if (typeof r === 'string' && r.trim()) out.push(r.trim());
    else if (r && typeof r === 'object') {
      const obj = r as any;
      if (typeof obj.key === 'string' && obj.key.trim()) out.push({ key: obj.key.trim() });
      else if (Array.isArray(obj.keys)) out.push({ keys: obj.keys.map(String).map((s: string) => s.trim()).filter(Boolean).slice(0, 64) });
      else if (typeof obj.path === 'string' && obj.path.trim()) out.push({ path: obj.path.trim() });
      else if (typeof obj.matchKeyPrefix === 'string' && obj.matchKeyPrefix.trim()) out.push({ matchKeyPrefix: obj.matchKeyPrefix.trim() });
    }
    if (out.length >= 256) break;
  }
  return out;
}

function shallowClone<T extends Record<string, unknown>>(v: T): T {
  return { ...(v as any) };
}

function deletePath(obj: Record<string, unknown>, path: string): void {
  const parts = path.split('.').map(p => p.trim()).filter(Boolean);
  if (!parts.length) return;

  let cur: any = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!cur || typeof cur !== 'object') return;
    cur = cur[k];
  }

  const last = parts[parts.length - 1];
  if (cur && typeof cur === 'object' && Object.prototype.hasOwnProperty.call(cur, last)) {
    delete cur[last];
  }
}

function applyRedactionsToEntry(entry: unknown, rules: RedactionRule[]): unknown {
  // LedgerEntry is imported as a type; runtime shape can vary. We treat it as object-like.
  if (!entry || typeof entry !== 'object') return entry;

  const base = shallowClone(entry as Record<string, unknown>);

  for (const rule of rules) {
    if (typeof rule === 'string') {
      delete (base as any)[rule];
      // common payload nesting (best-effort)
      if (base.payload && typeof base.payload === 'object') delete (base.payload as any)[rule];
    } else if ((rule as any).key) {
      const k = (rule as any).key as string;
      delete (base as any)[k];
      if (base.payload && typeof base.payload === 'object') delete (base.payload as any)[k];
    } else if ((rule as any).keys) {
      for (const k of (rule as any).keys as string[]) {
        delete (base as any)[k];
        if (base.payload && typeof base.payload === 'object') delete (base.payload as any)[k];
      }
    } else if ((rule as any).path) {
      const p = (rule as any).path as string;
      // apply to base + payload (if present)
      deletePath(base, p);
      if (base.payload && typeof base.payload === 'object') deletePath(base.payload as any, p);
    } else if ((rule as any).matchKeyPrefix) {
      const prefix = String((rule as any).matchKeyPrefix);
      for (const k of Object.keys(base)) {
        if (k.startsWith(prefix)) delete (base as any)[k];
      }
      if (base.payload && typeof base.payload === 'object') {
        for (const k of Object.keys(base.payload as any)) {
          if (k.startsWith(prefix)) delete (base.payload as any)[k];
        }
      }
    }
  }

  return base;
}

function pickPolicyCard(runId: string, tick: number, runPhase: RunPhase, pressureTier: PressureTier, macroRegime: MacroRegime): GameCard {
  const pW = (PRESSURE_WEIGHTS as any)?.[pressureTier] ?? 1.0;
  const phW = (PHASE_WEIGHTS as any)?.[runPhase] ?? 1.0;
  const rW = (REGIME_WEIGHTS as any)?.[macroRegime] ?? 1.0;

  const weighted = buildWeightedPool(runId, pW * phW, rW);

  // ensure DEFAULT_CARD_IDS is live
  const shuffledIds = seededShuffle(DEFAULT_CARD_IDS, runId);
  const fallbackId = shuffledIds[seededIndex(runId, tick + 61, Math.max(1, shuffledIds.length))] ?? DEFAULT_CARD.id;

  return (
    weighted[seededIndex(runId, tick + 62, Math.max(1, weighted.length))] ??
    OPPORTUNITY_POOL.find(c => c.id === fallbackId) ??
    DEFAULT_CARD
  );
}

function hashEntries(entries: unknown[], runId: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    out.push(computeHash(`${runId}:e:${i}:${JSON.stringify(entries[i])}`));
    if (out.length >= 8192) break;
  }
  return out;
}

function sampleHashes(all: string[], runId: string, tick: number): string[] {
  if (!all.length) return [];
  const count = clamp(M74_BOUNDS.TRIGGER_THRESHOLD, 1, 7);
  const picks: string[] = [];
  for (let i = 0; i < count; i++) {
    picks.push(all[seededIndex(runId, tick + 700 + i, all.length)]);
  }
  // make sampling order deterministic but not trivial
  return seededShuffle(picks, runId).slice(0, 7);
}

function computeIntegrityScore(
  entryCount: number,
  redactionApplied: boolean,
  macroRegime: MacroRegime,
  inChaos: boolean,
): number {
  const base = clamp(entryCount / 250, 0, 1);
  const rMul = clamp((REGIME_MULTIPLIERS as any)?.[macroRegime] ?? 1.0, 0.6, 1.25);
  const pulse = clamp((EXIT_PULSE_MULTIPLIERS as any)?.[macroRegime] ?? 1.0, 0.6, 1.25);

  // More entries => better forensic coverage; chaos slightly reduces confidence.
  const shaped = base * clamp(rMul * pulse, 0.75, 1.35) * (inChaos ? 0.92 : 1.0) * (redactionApplied ? 0.97 : 1.0);
  return clamp(shaped, 0.01, 0.99);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * forensicSnapshotBundler
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function forensicSnapshotBundler(
  input: M74Input,
  emit: MechanicEmitter,
): M74Output {
  const runId = stableRunId(input);

  const ledgerEntries = (input.ledgerEntries as LedgerEntry[]) ?? [];
  const redactionRules = normalizeRedactionRules((input.redactionRules as unknown[]) ?? []);
  const redactionApplied = redactionRules.length > 0;

  // Deterministic macro/chaos context
  const macroSchedule = buildMacroSchedule(runId, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(runId, CHAOS_WINDOWS_PER_RUN);

  // Deterministic tick
  const tick = seededIndex(runId, 0, RUN_TOTAL_TICKS);

  const inChaos = isInChaosWindow(chaosWindows, tick);
  const macroRegime = regimeAtTick(macroSchedule, tick);
  const runPhase = pickRunPhase(tick);

  // Redact deterministically
  const limitedEntries: unknown[] = ledgerEntries.slice(0, 4096);
  const redactedEntries: unknown[] = redactionApplied
    ? limitedEntries.map(e => applyRedactionsToEntry(e, redactionRules))
    : limitedEntries;

  const entryCount = redactedEntries.length;

  const pressureTier = derivePressureTier(entryCount, inChaos);
  const tickTier = deriveTickTier(pressureTier, inChaos);

  // Deterministic policy card (forces pools/constants to stay live)
  const policyCard = pickPolicyCard(runId, tick, runPhase, pressureTier, macroRegime);

  // Use weights in a meaningful (bounded) way (keeps them “accessible”)
  const pW = (PRESSURE_WEIGHTS as any)?.[pressureTier] ?? 1.0;
  const phW = (PHASE_WEIGHTS as any)?.[runPhase] ?? 1.0;
  const rW = (REGIME_WEIGHTS as any)?.[macroRegime] ?? 1.0;
  const weightFactor = clamp((pW * phW) / Math.max(0.25, rW), 0.5, 1.5);

  const entryHashes = hashEntries(redactedEntries, runId);
  const sampled = sampleHashes(entryHashes, runId, tick);

  const redactedHash = computeHash(JSON.stringify({
    runId,
    tick,
    redactionApplied,
    redactionRuleCount: redactionRules.length,
    entryHashes,
    sampled,
  }));

  const integrityScore = computeIntegrityScore(entryCount, redactionApplied, macroRegime, inChaos);

  const decayRateBase = computeDecayRate(macroRegime, M74_BOUNDS.BASE_DECAY_RATE);
  const decayRate = clamp(decayRateBase * clamp(weightFactor, 0.75, 1.35), 0.001, 0.5);

  const bundleHash = computeHash(JSON.stringify({
    rules: M74_RULES_VERSION,
    runId,
    tick,
    macroRegime,
    inChaos,
    runPhase: String(runPhase),
    pressureTier: String(pressureTier),
    tickTier: String(tickTier),
    policyCardId: policyCard.id,
    entryHashes,
    sampled,
    redactedHash,
    integrityScore,
    decayRate,
  }));

  const auditHash = computeHash(JSON.stringify({
    rules: M74_RULES_VERSION,
    runId,
    tick,
    bundleHash,
    redactedHash,
    entryCount,
    integrityScore,
    macroRegime,
    inChaos,
    policyCardId: policyCard.id,
    decayRate,
  }));

  const snapshotBundle: SnapshotBundle = {
    runId,
    tick,

    runPhase,
    tickTier,
    pressureTier,

    macroRegime,
    inChaosWindow: inChaos,

    policyCardId: policyCard.id,
    policyCardName: String((policyCard as any)?.name ?? ''),

    entryCount,
    entryHashes,
    sampleHashes: sampled,
    bundleHash,

    integrityScore,
    decayRate,
    auditHash,
    rulesVersion: M74_RULES_VERSION,

    redactionApplied,
    redactionRuleCount: redactionRules.length,
  };

  // Deterministic packet data (JSON-serializable; does not embed raw ledger entries by default)
  // You can include raw redacted entries later if your export storage allows it.
  const packetData: Record<string, unknown> = {
    mechanic: 'M74',
    rulesVersion: M74_RULES_VERSION,
    runId,
    tick,
    macroRegime,
    inChaosWindow: inChaos,
    policyCard: { id: policyCard.id, name: (policyCard as any)?.name ?? '' },
    bundle: {
      entryCount,
      entryHashes,
      sampleHashes: sampled,
      bundleHash,
      integrityScore,
      decayRate,
      auditHash,
    },
    redaction: {
      applied: redactionApplied,
      ruleCount: redactionRules.length,
      redactedHash,
      // store normalized rules (safe, deterministic)
      rules: redactionRules.map(r => (typeof r === 'string' ? r : r)),
    },
  };

  const exportedPacket: ExportPacket = {
    runId,
    packetVersion: M74_PACKET_VERSION,
    createdTick: tick,
    data: packetData,
    hash: computeHash(JSON.stringify(packetData) + `:${bundleHash}:${redactedHash}`),
  };

  // ── Telemetry ───────────────────────────────────────────────────────────

  if (redactionApplied) {
    const redactionEvt: M74TelemetryPayload = {
      event: 'REDACTION_APPLIED',
      mechanic_id: 'M74',
      tick,
      runId,
      payload: {
        ruleCount: redactionRules.length,
        redactedHash,
        entryCount,
      },
    };
    emit(redactionEvt);
  }

  const bundled: M74TelemetryPayload = {
    event: 'SNAPSHOT_BUNDLED',
    mechanic_id: 'M74',
    tick,
    runId,
    payload: {
      entryCount,
      inChaosWindow: inChaos,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      policyCardId: policyCard.id,
      integrityScore,
      decayRate,
      bundleHash,
      auditHash,
      rulesVersion: M74_RULES_VERSION,
    },
  };
  emit(bundled);

  const exported: M74TelemetryPayload = {
    event: 'PACKET_EXPORTED',
    mechanic_id: 'M74',
    tick,
    runId,
    payload: {
      packetVersion: M74_PACKET_VERSION,
      packetHash: exportedPacket.hash,
      bundleHash,
      redactedHash,
      integrityScore,
    },
  };
  emit(exported);

  return {
    snapshotBundle,
    exportedPacket,
    redactedHash,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M74MLInput {
  snapshotBundle?: SnapshotBundle;
  exportedPacket?: ExportPacket;
  redactedHash?: string;
  runId: string;
  tick: number;
}

export interface M74MLOutput {
  score: number;              // 0–1
  topFactors: string[];       // max 5 plain-English factors
  recommendation: string;     // single sentence
  auditHash: string;          // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;    // 0–1, how fast this signal should decay
}

/**
 * forensicSnapshotBundlerMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function forensicSnapshotBundlerMLCompanion(
  input: M74MLInput,
): Promise<M74MLOutput> {
  const b = input.snapshotBundle;

  const base = clamp(Number(b?.integrityScore ?? 0.5), 0.01, 0.99);
  const score = clamp(base, 0.01, 0.99);

  const topFactors: string[] = [];
  if (b) {
    topFactors.push(`Integrity: ${b.integrityScore.toFixed(2)}`);
    topFactors.push(`Entries: ${b.entryCount}`);
    topFactors.push(`Regime: ${String(b.macroRegime)}`);
    if (b.inChaosWindow) topFactors.push('Chaos window');
    topFactors.push(`RedactionRules: ${b.redactionRuleCount}`);
  }

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation: score >= 0.75
      ? 'Persist export packet + bundle hash to immutable ledger.'
      : 'Increase coverage (more ledger entries) or reduce chaos/redaction to improve forensic certainty.',
    auditHash: computeHash(JSON.stringify(input) + `:${M74_RULES_VERSION}:ml:M74`),
    confidenceDecay: clamp(Number(b?.decayRate ?? 0.06), 0.01, 0.30),
  };
}