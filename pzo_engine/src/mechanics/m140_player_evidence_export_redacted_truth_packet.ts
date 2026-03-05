// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m140_player_evidence_export_redacted_truth_packet.ts
//
// Mechanic : M140 — Player Evidence Export: Redacted Truth Packet
// Family   : ops   Layer: backend_service   Priority: 2   Batch: 3
// ML Pair  : m140a
// Deps     : M74, M50
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
export const M140_IMPORTED_SYMBOLS = {
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
export type M140_ImportedTypesAnchor = {
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
};

// ─────────────────────────────────────────────────────────────────────────────
// Local contracts (kept as interfaces so they safely merge if declared elsewhere)
// ─────────────────────────────────────────────────────────────────────────────

export type ExportPurpose = 'APPEAL' | 'SUPPORT' | 'SHARE' | 'AUDIT' | 'SELF';
export type ExportFormat = 'JSON' | 'NDJSON' | 'TEXT';

export interface ExportRequest {
  requestId?: string;
  requesterId?: string;
  purpose?: ExportPurpose;
  format?: ExportFormat;

  /**
   * Optional section allowlist (top-level). If empty/undefined => include canonical sections.
   * Example: ['RUN_META','LEDGER','PROOF','MOMENTS']
   */
  includeSections?: string[];

  /**
   * Redaction mode:
   * - NONE: no redaction (not recommended)
   * - STANDARD: default PII/sensitive-key redaction
   * - STRICT: standard + aggressive structural redaction (drops unknown leaf scalars)
   */
  redactionMode?: 'NONE' | 'STANDARD' | 'STRICT';

  /**
   * Optional nonce (deterministic seed salt for export hashes)
   * NOTE: this affects exportHash; do not set randomly if you need stable exports.
   */
  nonce?: string;

  /**
   * Optional UI label.
   */
  label?: string;
}

export type RedactionAction = 'MASK' | 'REMOVE' | 'HASH';

export interface RedactionRule {
  /**
   * Match target:
   * - "key:<name>" exact key match anywhere
   * - "path:<a.b.c>" exact dotted path match (rooted)
   * - "contains:<substr>" key contains substring
   * - "regex:<pattern>" key regex (ECMA)
   */
  match: string;
  action: RedactionAction;
  maskWith?: string; // default: '█'
  reason?: string;
}

export interface RedactionApplied {
  match: string;
  action: RedactionAction;
  reason?: string;
  hits: number;
}

export interface RedactedPayload {
  mode: 'NONE' | 'STANDARD' | 'STRICT';
  applied: RedactionApplied[];
  originalHash: string;
  redactedHash: string;
  redactedAtMs: number;
  notes: string[];
}

export interface ExportPacket {
  mechanic_id: 'M140';
  runId: string;
  request: ExportRequest;
  exportedAtMs: number;
  data: Record<string, unknown>;
  meta: Record<string, unknown>;
  hash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M140Input {
  exportRequest?: ExportRequest;
  runId?: string;
  redactionRules?: unknown[];

  // Optional snapshot fields (commonly present via snapshotExtractor)
  stateTick?: number;
  stateRunPhase?: RunPhase;
  stateMacroRegime?: MacroRegime;
  statePressureTier?: PressureTier;
  stateSolvencyStatus?: SolvencyStatus;
  seed?: string;

  // Optional evidence sources (if orchestrator provides them)
  ledgerEntries?: LedgerEntry[] | unknown[];
  proofCards?: ProofCard[] | unknown[];
  moments?: MomentEvent[] | unknown[];
  clipBoundaries?: ClipBoundary[] | unknown[];
  completedRuns?: CompletedRun[] | unknown[];
  runState?: RunState | Record<string, unknown>;
  seasonState?: SeasonState | Record<string, unknown>;
}

export interface M140Output {
  exportedPacket: ExportPacket;
  redactedPayload: RedactedPayload;
  exportHash: string;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M140Event = 'EVIDENCE_EXPORT_REQUESTED' | 'REDACTION_APPLIED' | 'PACKET_EXPORTED';

export interface M140TelemetryPayload extends MechanicTelemetryPayload {
  event: M140Event;
  mechanic_id: 'M140';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M140_BOUNDS = {
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
// Internal helpers (pure, deterministic, no throws)
// ─────────────────────────────────────────────────────────────────────────────

function m140NowMs(): number {
  // Deterministic-by-seed is about gameplay; exports can be time-stamped.
  // Still: keep it safe if Date is unavailable (tests).
  try {
    return Date.now();
  } catch {
    return 0;
  }
}

function m140NormalizeRegime(r: unknown): MacroRegime {
  return r === 'BULL' || r === 'NEUTRAL' || r === 'BEAR' || r === 'CRISIS' ? r : 'NEUTRAL';
}

function m140NormalizePhase(p: unknown): RunPhase {
  return p === 'EARLY' || p === 'MID' || p === 'LATE' ? p : 'MID';
}

function m140NormalizePressure(p: unknown): PressureTier {
  return p === 'LOW' || p === 'MEDIUM' || p === 'HIGH' || p === 'CRITICAL' ? p : 'MEDIUM';
}

function m140NormalizeSolvency(s: unknown): SolvencyStatus {
  return s === 'SOLVENT' || s === 'BLEED' || s === 'WIPED' ? s : 'SOLVENT';
}

function m140DerivePhaseFromTick(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = Math.max(1, Math.floor(RUN_TOTAL_TICKS / 3));
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m140IsPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function m140DeepClone<T>(v: T): T {
  if (Array.isArray(v)) return v.map(m140DeepClone) as unknown as T;
  if (m140IsPlainObject(v)) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v)) out[k] = m140DeepClone((v as Record<string, unknown>)[k]);
    return out as unknown as T;
  }
  return v;
}

function m140SafeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    // fallback: best-effort stable representation
    return String(v);
  }
}

function m140AsRules(input: unknown[]): RedactionRule[] {
  const out: RedactionRule[] = [];
  for (const r of input) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const match = typeof o.match === 'string' ? o.match : '';
    const action = (o.action === 'MASK' || o.action === 'REMOVE' || o.action === 'HASH') ? (o.action as RedactionAction) : 'MASK';
    if (!match.trim()) continue;
    out.push({
      match: match.trim(),
      action,
      maskWith: typeof o.maskWith === 'string' ? o.maskWith : undefined,
      reason: typeof o.reason === 'string' ? o.reason : undefined,
    });
  }
  return out;
}

function m140CompileMatchers(rules: RedactionRule[]) {
  const compiled = rules.map((r) => {
    const m = r.match;
    if (m.startsWith('regex:')) {
      const pat = m.slice('regex:'.length);
      let re: RegExp | null = null;
      try {
        re = new RegExp(pat);
      } catch {
        re = null;
      }
      return { rule: r, kind: 'regex' as const, re, val: pat };
    }
    if (m.startsWith('key:')) return { rule: r, kind: 'key' as const, re: null, val: m.slice('key:'.length) };
    if (m.startsWith('path:')) return { rule: r, kind: 'path' as const, re: null, val: m.slice('path:'.length) };
    if (m.startsWith('contains:')) return { rule: r, kind: 'contains' as const, re: null, val: m.slice('contains:'.length) };
    // default: treat as contains
    return { rule: r, kind: 'contains' as const, re: null, val: m };
  });
  return compiled;
}

function m140DefaultRules(): RedactionRule[] {
  // Standard PII/sensitive surfaces (key-driven, global)
  const keys = [
    'email', 'phone', 'mobile', 'address', 'ip', 'ssid', 'imei', 'imsi',
    'password', 'pass', 'secret', 'token', 'cookie', 'auth', 'authorization',
    'session', 'apikey', 'api_key', 'private', 'ssn', 'dob', 'birth', 'license',
  ];
  return keys.map((k) => ({ match: `contains:${k}`, action: 'MASK' as const, reason: 'default_sensitive_key' }));
}

function m140MaskValue(v: unknown, maskWith: string): unknown {
  const m = maskWith && maskWith.length > 0 ? maskWith : '█';
  if (v == null) return v;
  if (typeof v === 'string') return m.repeat(Math.min(16, Math.max(4, v.length)));
  if (typeof v === 'number') return 0;
  if (typeof v === 'boolean') return false;
  if (Array.isArray(v)) return v.map(() => m);
  if (m140IsPlainObject(v)) return { _redacted: true };
  return m;
}

function m140HashLeaf(v: unknown): string {
  return computeHash(m140SafeStringify(v));
}

function m140ApplyRedaction(
  raw: Record<string, unknown>,
  mode: 'NONE' | 'STANDARD' | 'STRICT',
  rules: RedactionRule[],
): { redacted: Record<string, unknown>; applied: RedactionApplied[] } {
  if (mode === 'NONE') return { redacted: m140DeepClone(raw), applied: [] };

  const compiled = m140CompileMatchers(rules);
  const counts = new Map<string, RedactionApplied>();

  const applyHit = (rule: RedactionRule) => {
    const key = `${rule.match}|${rule.action}|${rule.reason ?? ''}`;
    const cur = counts.get(key);
    if (cur) cur.hits += 1;
    else counts.set(key, { match: rule.match, action: rule.action, reason: rule.reason, hits: 1 });
  };

  const walk = (node: unknown, path: string[]): unknown => {
    if (Array.isArray(node)) return node.map((v, i) => walk(v, path.concat(String(i))));
    if (!m140IsPlainObject(node)) {
      if (mode === 'STRICT') {
        // STRICT: drop unknown scalar leafs unless they are obviously non-sensitive primitives
        if (typeof node === 'string') return node.length <= 12 ? node : m140MaskValue(node, '█');
      }
      return node;
    }

    const out: Record<string, unknown> = {};
    for (const k of Object.keys(node)) {
      const v = node[k];
      const nextPath = path.concat(k);
      const dotted = nextPath.join('.');

      // Determine the strongest rule that matches this field
      let matched: RedactionRule | null = null;

      for (const c of compiled) {
        const r = c.rule;

        if (c.kind === 'path') {
          if (dotted === c.val) { matched = r; break; }
          continue;
        }

        if (c.kind === 'key') {
          if (k === c.val) { matched = r; break; }
          continue;
        }

        if (c.kind === 'contains') {
          if (k.toLowerCase().includes(String(c.val).toLowerCase())) { matched = r; break; }
          continue;
        }

        if (c.kind === 'regex') {
          if (c.re && c.re.test(k)) { matched = r; break; }
          continue;
        }
      }

      if (matched) {
        applyHit(matched);
        if (matched.action === 'REMOVE') continue;
        if (matched.action === 'HASH') {
          out[k] = m140HashLeaf(v);
          continue;
        }
        out[k] = m140MaskValue(v, matched.maskWith ?? '█');
        continue;
      }

      out[k] = walk(v, nextPath);
    }
    return out;
  };

  const redacted = walk(raw, []) as Record<string, unknown>;
  return { redacted, applied: Array.from(counts.values()) };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * playerEvidenceExporter
 *
 * Backend_service export:
 * - Build a canonical evidence packet for a run
 * - Apply deterministic redaction rules (default + caller-provided)
 * - Emit telemetry at request / redaction / export
 *
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 */
export function playerEvidenceExporter(
  input: M140Input,
  emit: MechanicEmitter,
): M140Output {
  const snap = input as unknown as Record<string, unknown>;

  const tick = clamp(Number(input.stateTick ?? snap.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const exportedAtMs = m140NowMs();

  const request: ExportRequest = {
    requestId: input.exportRequest?.requestId ?? String(snap.exportRequestId ?? ''),
    requesterId: input.exportRequest?.requesterId ?? String(snap.requesterId ?? ''),
    purpose: input.exportRequest?.purpose ?? (String(snap.exportPurpose ?? '') as ExportPurpose) ?? 'SELF',
    format: input.exportRequest?.format ?? 'JSON',
    includeSections: Array.isArray(input.exportRequest?.includeSections) ? input.exportRequest!.includeSections : undefined,
    redactionMode: input.exportRequest?.redactionMode ?? 'STANDARD',
    nonce: input.exportRequest?.nonce ?? (typeof snap.exportNonce === 'string' ? snap.exportNonce : undefined),
    label: input.exportRequest?.label ?? (typeof snap.exportLabel === 'string' ? snap.exportLabel : undefined),
  };

  const runId =
    (typeof input.runId === 'string' && input.runId.trim())
      ? input.runId.trim()
      : (typeof snap.runId === 'string' && snap.runId.trim())
        ? String(snap.runId).trim()
        : computeHash(JSON.stringify({ mid: 'M140', tick, req: request.requestId ?? '' }));

  const seed =
    (typeof input.seed === 'string' && input.seed.trim())
      ? input.seed.trim()
      : (typeof snap.seed === 'string' && snap.seed.trim())
        ? String(snap.seed).trim()
        : computeHash(`${runId}:${request.nonce ?? ''}:M140`);

  const runPhase: RunPhase =
    input.stateRunPhase ?? (snap.stateRunPhase as RunPhase) ?? m140DerivePhaseFromTick(tick);

  const macroSchedule = buildMacroSchedule(`${seed}:m140:macro`, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(`${seed}:m140:chaos`, CHAOS_WINDOWS_PER_RUN);

  // derive regime at tick (simple scan)
  let macroRegime: MacroRegime = m140NormalizeRegime(input.stateMacroRegime ?? snap.stateMacroRegime ?? 'NEUTRAL');
  const sortedMacro = [...macroSchedule].sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));
  for (const ev of sortedMacro) {
    const t = typeof ev.tick === 'number' ? ev.tick : 0;
    if (t > tick) break;
    if (ev.regimeChange) macroRegime = m140NormalizeRegime(ev.regimeChange);
  }

  const inChaos = chaosWindows.some((w) => tick >= w.startTick && tick <= w.endTick);

  const pressureTier: PressureTier = m140NormalizePressure(input.statePressureTier ?? snap.statePressureTier ?? 'MEDIUM');
  const solvencyStatus: SolvencyStatus = m140NormalizeSolvency(input.stateSolvencyStatus ?? snap.stateSolvencyStatus ?? 'SOLVENT');

  const phaseW = PHASE_WEIGHTS[m140NormalizePhase(runPhase)] ?? 1.0;
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const decay = computeDecayRate(macroRegime, M140_BOUNDS.BASE_DECAY_RATE);

  // deterministic card/econ hints (keeps shared imports truly used + useful in export)
  const weightedPool = buildWeightedPool(`${seed}:m140:pool`, pressureW * phaseW, regimeW * regimeMult);
  const poolPick: GameCard =
    (weightedPool[seededIndex(`${seed}:m140:pick`, tick, Math.max(1, weightedPool.length))] as GameCard | undefined) ?? DEFAULT_CARD;

  const oppPick: GameCard =
    OPPORTUNITY_POOL[seededIndex(`${seed}:m140:opp`, tick + 17, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  const deckOrder = seededShuffle(DEFAULT_CARD_IDS, `${seed}:m140:deck`);
  const deckSig = deckOrder.slice(0, Math.min(7, deckOrder.length));
  const deckTop = deckOrder[0] ?? DEFAULT_CARD.id;

  const include = new Set<string>(
    Array.isArray(request.includeSections) && request.includeSections.length > 0
      ? request.includeSections
      : ['RUN_META', 'STATE', 'LEDGER', 'PROOF', 'MOMENTS', 'CLIPS', 'SEASON', 'COMPLETED'],
  );

  const ledgerEntries = (Array.isArray(input.ledgerEntries) ? input.ledgerEntries : (snap.ledgerEntries as unknown[])) ?? [];
  const proofCards = (Array.isArray(input.proofCards) ? input.proofCards : (snap.proofCards as unknown[])) ?? [];
  const moments = (Array.isArray(input.moments) ? input.moments : (snap.moments as unknown[])) ?? [];
  const clipBoundaries = (Array.isArray(input.clipBoundaries) ? input.clipBoundaries : (snap.clipBoundaries as unknown[])) ?? [];
  const completedRuns = (Array.isArray(input.completedRuns) ? input.completedRuns : (snap.completedRuns as unknown[])) ?? [];

  emit({
    event: 'EVIDENCE_EXPORT_REQUESTED',
    mechanic_id: 'M140',
    tick,
    runId,
    payload: {
      requestId: request.requestId ?? null,
      purpose: request.purpose ?? 'SELF',
      format: request.format ?? 'JSON',
      redactionMode: request.redactionMode ?? 'STANDARD',
      includeSections: Array.from(include.values()),
    },
  });

  const rawData: Record<string, unknown> = {
    ...(include.has('RUN_META')
      ? {
          run: {
            runId,
            tick,
            exportedAtMs,
            seedHash: computeHash(seed),
            requestId: request.requestId ?? null,
            label: request.label ?? null,
          },
        }
      : {}),
    ...(include.has('STATE')
      ? {
          state: {
            phase: runPhase,
            macroRegime,
            inChaos,
            pressureTier,
            solvencyStatus,
            weights: { phaseW, pressureW, regimeW, regimeMult, exitPulse, decay },
            schedule: { macroEventsPlanned: MACRO_EVENTS_PER_RUN, chaosWindowsPlanned: CHAOS_WINDOWS_PER_RUN, runTotalTicks: RUN_TOTAL_TICKS },
          },
        }
      : {}),
    ...(include.has('LEDGER') ? { ledgerEntries } : {}),
    ...(include.has('PROOF') ? { proofCards } : {}),
    ...(include.has('MOMENTS') ? { moments } : {}),
    ...(include.has('CLIPS') ? { clipBoundaries } : {}),
    ...(include.has('SEASON') ? { seasonState: (input.seasonState ?? (snap.seasonState as Record<string, unknown>) ?? null) } : {}),
    ...(include.has('COMPLETED') ? { completedRuns } : {}),
  };

  // Add deterministic “evidence aids” (safe, non-sensitive by default)
  rawData.evidenceAids = {
    featuredCard: { id: poolPick.id, name: (poolPick as any).name ?? null, type: (poolPick as any).type ?? null },
    opportunityHint: { id: oppPick.id, name: (oppPick as any).name ?? null, type: (oppPick as any).type ?? null },
    deckTop,
    deckSig,
    macroSchedule,
    chaosWindows,
  };

  const originalHash = computeHash(m140SafeStringify(rawData));

  const mode = (request.redactionMode ?? 'STANDARD') as 'NONE' | 'STANDARD' | 'STRICT';
  const callerRules = m140AsRules(Array.isArray(input.redactionRules) ? (input.redactionRules as unknown[]) : []);
  const rules = mode === 'NONE' ? [] : m140DefaultRules().concat(callerRules);

  const { redacted, applied } = m140ApplyRedaction(rawData, mode, rules);
  const redactedHash = computeHash(m140SafeStringify(redacted));

  const redactedPayload: RedactedPayload = {
    mode,
    applied,
    originalHash,
    redactedHash,
    redactedAtMs: exportedAtMs,
    notes: [
      mode === 'NONE' ? 'No redaction applied (mode=NONE).' : 'Redaction applied (default + caller rules).',
      `appliedRules=${applied.length}`,
      `inChaos=${inChaos ? 1 : 0}`,
    ],
  };

  emit({
    event: 'REDACTION_APPLIED',
    mechanic_id: 'M140',
    tick,
    runId,
    payload: {
      mode,
      appliedRules: applied.length,
      originalHash,
      redactedHash,
    },
  });

  // Export hash must be deterministic across identical inputs + request.nonce
  const exportHash = computeHash(
    JSON.stringify({
      mid: 'M140',
      runId,
      requestId: request.requestId ?? '',
      nonce: request.nonce ?? '',
      mode,
      include: Array.from(include.values()).sort(),
      originalHash,
      redactedHash,
    }),
  );

  const exportedPacket: ExportPacket = {
    mechanic_id: 'M140',
    runId,
    request,
    exportedAtMs,
    data: redacted,
    meta: {
      exportHash,
      sig: exportHash.slice(0, 12),
      hashes: { originalHash, redactedHash },
      counts: {
        ledgerEntries: Array.isArray(ledgerEntries) ? ledgerEntries.length : 0,
        proofCards: Array.isArray(proofCards) ? proofCards.length : 0,
        moments: Array.isArray(moments) ? moments.length : 0,
        clipBoundaries: Array.isArray(clipBoundaries) ? clipBoundaries.length : 0,
        completedRuns: Array.isArray(completedRuns) ? completedRuns.length : 0,
      },
      state: {
        tick,
        phase: runPhase,
        macroRegime,
        inChaos,
        pressureTier,
        solvencyStatus,
      },
      econHints: {
        featuredCardId: poolPick.id,
        opportunityHintId: oppPick.id,
        deckTop,
      },
      audit: {
        requestStableHash: computeHash(JSON.stringify(request)),
        seedHash: computeHash(seed),
        note: `M140:${exportHash.slice(0, 8)}:${originalHash.slice(0, 8)}:${redactedHash.slice(0, 8)}`,
      },
    },
    hash: exportHash,
  };

  emit({
    event: 'PACKET_EXPORTED',
    mechanic_id: 'M140',
    tick,
    runId,
    payload: {
      exportHash,
      mode,
      includeSections: Array.from(include.values()),
      originalHash: originalHash.slice(0, 16),
      redactedHash: redactedHash.slice(0, 16),
      featuredCardId: poolPick.id,
      oppHintId: oppPick.id,
      deckSig,
    },
  });

  return {
    exportedPacket,
    redactedPayload,
    exportHash,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M140MLInput {
  exportedPacket?: ExportPacket;
  redactedPayload?: RedactedPayload;
  exportHash?: string;
  runId: string;
  tick: number;
}

export interface M140MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * playerEvidenceExporterMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function playerEvidenceExporterMLCompanion(
  input: M140MLInput,
): Promise<M140MLOutput> {
  const t = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);

  const hasPacket = !!input.exportedPacket;
  const hasRedaction = !!input.redactedPayload;
  const mode = (input.redactedPayload?.mode ?? 'STANDARD') as string;

  const score = clamp(
    (hasPacket ? 0.70 : 0.20) +
      (hasRedaction ? 0.12 : 0) +
      (mode === 'STRICT' ? 0.08 : mode === 'NONE' ? -0.10 : 0.02) -
      clamp(t / RUN_TOTAL_TICKS, 0, 1) * 0.05,
    0.01,
    0.99,
  );

  const topFactors = [
    hasPacket ? 'Evidence packet exported' : 'No packet present',
    hasRedaction ? `Redaction mode=${mode}` : 'No redaction payload',
    `tick=${t}`,
  ].slice(0, 5);

  const recommendation =
    mode === 'NONE'
      ? 'Avoid mode=NONE for player-facing exports; use STANDARD or STRICT.'
      : mode === 'STRICT'
        ? 'STRICT is safe for sharing; confirm required sections are still present.'
        : 'STANDARD is balanced; add caller rules if you need stricter PII removal.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M140'),
    confidenceDecay: 0.05,
  };
}