// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m132_case_files_run_post_mortems_as_narrative_dossiers.ts
//
// Mechanic : M132 — Case Files: Run Post-Mortems as Narrative Dossiers
// Family   : narrative   Layer: ui_component   Priority: 2   Batch: 3
// ML Pair  : m132a
// Deps     : M46, M74, M50
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

export const M132_EXPORT_ANCHORS = {
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
export type M132_ALL_IMPORTED_TYPES =
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
// Local dossier types (kept local: types.ts intentionally stays minimal & shared)
// ─────────────────────────────────────────────────────────────────────────────

export type CaseVerdict = 'PASS' | 'WARN' | 'FAIL';

export interface EvidenceItem {
  tick: number;
  ledgerHash: string;
  actionHash: string;
  label: string;
}

export interface DecisionEntry {
  tick: number;
  label: string;
  ledgerHash: string;
  actionHash: string;
  severity: number; // 0..1
}

export interface CaseFile {
  dossierId: string;
  runId: string;
  title: string;
  subtitle: string;
  verdict: CaseVerdict;

  cordScore: number; // 0..1 normalized (computed from CompletedRun.cordScore)
  outcome: string;
  ticks: number;

  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;

  decayRate: number; // 0..1
  pulseMultiplier: number;
  intensity: number; // 0..1

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  highlightCard: GameCard;

  keyFindings: string[];
  evidence: EvidenceItem[];

  exportHash: string;
}

export interface AlternateScenarioFork {
  forkId: string;
  title: string;
  cardId: string;
  projectedCordDelta: number; // -1..1 (advisory)
  auditHash: string;
}

export interface AlternateScenarioBundle {
  mode: 'DETERMINISTIC_COUNTERFACTUALS';
  forks: AlternateScenarioFork[];
  auditHash: string;
}

/**
 * MLCompanionOutput
 * Kept local for M132 input wiring. (M132 ML hook returns the same shape.)
 */
export interface MLCompanionOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5
  recommendation: string; // one sentence
  auditHash: string;
  confidenceDecay: number; // 0–1
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M132Input {
  completedRun?: CompletedRun;
  m132MLOutput?: MLCompanionOutput;
  ledgerEntries?: LedgerEntry[];
}

export interface M132Output {
  caseFile: CaseFile;
  decisionTimeline: DecisionEntry[];
  alternateScenariosRendered: unknown;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M132Event = 'CASE_FILE_GENERATED' | 'ALTERNATE_TIMELINE_COMPUTED' | 'DOSSIER_EXPORTED';

export interface M132TelemetryPayload extends MechanicTelemetryPayload {
  event: M132Event;
  mechanic_id: 'M132';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M132_BOUNDS = {
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

const REGIMES: readonly MacroRegime[] = ['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'] as const;
const PHASES: readonly RunPhase[] = ['EARLY', 'MID', 'LATE'] as const;
const PRESSURES: readonly PressureTier[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v ?? null);
  } catch {
    return '"[UNSERIALIZABLE]"';
  }
}

function normalizeCordScore(raw: number): number {
  // CompletedRun.cordScore scale is not enforced in types.ts; normalize conservatively.
  // If already 0..1, keep it; if 0..100-ish, divide; otherwise clamp.
  if (!Number.isFinite(raw)) return 0;
  const abs = Math.abs(raw);
  if (abs <= 1.0) return clamp(raw, 0, 1);
  if (abs <= 1000) return clamp(raw / 100, 0, 1);
  return clamp(raw / 10_000, 0, 1);
}

function deriveRunPhaseFromTicks(ticks: number): RunPhase {
  const t = clamp(ticks, 0, RUN_TOTAL_TICKS);
  if (t <= RUN_TOTAL_TICKS / 3) return 'EARLY';
  if (t <= (RUN_TOTAL_TICKS * 2) / 3) return 'MID';
  return 'LATE';
}

function derivePressureTier(seed: string, cord01: number, ledgerCount: number, ticks: number): PressureTier {
  const density = clamp(ledgerCount / Math.max(1, ticks), 0, 2);
  const adversity = clamp(1 - cord01, 0, 1);
  const jitter = seededIndex(seed, 9, 1000) / 1000; // 0..0.999
  const score = clamp(density * 0.55 + adversity * 0.40 + jitter * 0.05, 0, 1);

  if (score >= 0.78) return 'CRITICAL';
  if (score >= 0.55) return 'HIGH';
  if (score >= 0.28) return 'MEDIUM';
  return 'LOW';
}

function deriveMacroRegime(seed: string, cord01: number): MacroRegime {
  // Favor higher adversity for harsher regimes, still deterministic.
  const harshness = clamp(1 - cord01, 0, 1);
  const idx = clamp(Math.floor(harshness * (REGIMES.length - 1)), 0, REGIMES.length - 1);
  const salt = seededIndex(seed, 7, 10);
  return REGIMES[clamp((idx + (salt % 2)) as any, 0, REGIMES.length - 1)];
}

function deriveTickTier(intensity: number): TickTier {
  if (intensity >= 0.75) return 'CRITICAL';
  if (intensity >= 0.45) return 'ELEVATED';
  return 'STANDARD';
}

function safeCardFromPool(card: GameCard | undefined | null): GameCard {
  const c = card ?? DEFAULT_CARD;
  if (DEFAULT_CARD_IDS.includes(c.id)) return c;
  if (OPPORTUNITY_POOL.some(x => x.id === c.id)) return c;
  return DEFAULT_CARD;
}

function buildEvidence(seed: string, ledgerEntries: LedgerEntry[], max = 24): EvidenceItem[] {
  const sorted = [...ledgerEntries].sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0) || String(a.hash).localeCompare(String(b.hash)));
  const sliced = sorted.slice(0, max);

  return sliced.map((e, i) => {
    const tick = typeof e.tick === 'number' ? e.tick : 0;
    const ledgerHash = String(e.hash ?? '');
    const actionHash = computeHash(safeJson(e.gameAction) + `:i:${i}:t:${tick}`);
    const label = `T${tick} • ${actionHash.slice(0, 6)} • ${ledgerHash.slice(0, 6)}`;
    return { tick, ledgerHash, actionHash, label };
  });
}

function buildDecisionTimeline(seed: string, ledgerEntries: LedgerEntry[], macroRegime: MacroRegime, runPhase: RunPhase, pressureTier: PressureTier): DecisionEntry[] {
  const wPressure = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const wPhase = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const wRegime = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const base = clamp(wPressure * wPhase * wRegime, 0.25, 3.0);

  const sorted = [...ledgerEntries].sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0) || String(a.hash).localeCompare(String(b.hash)));

  return sorted.map((e, i) => {
    const tick = typeof e.tick === 'number' ? e.tick : 0;
    const ledgerHash = String(e.hash ?? '');
    const actionHash = computeHash(safeJson(e.gameAction) + `:tl:${i}:t:${tick}`);
    const jitter = seededIndex(seed, i + 1000, 1000) / 1000; // 0..0.999
    const severity = clamp((base - 0.25) / 2.75 + jitter * 0.12, 0, 1);
    const label = `Decision @ T${tick} • ${actionHash.slice(0, 8)}`;
    return { tick, label, ledgerHash, actionHash, severity };
  });
}

function buildAlternateScenarios(
  seed: string,
  macroRegime: MacroRegime,
  runPhase: RunPhase,
  pressureTier: PressureTier,
  highlightCard: GameCard,
): AlternateScenarioBundle {
  const pressurePhaseWeight = (PRESSURE_WEIGHTS[pressureTier] ?? 1.0) * (PHASE_WEIGHTS[runPhase] ?? 1.0);
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const pool = buildWeightedPool(`${seed}:M132:alts`, pressurePhaseWeight * 1.05, regimeWeight * 0.95);
  const shuffled = seededShuffle([...pool, highlightCard], `${seed}:M132:alts:shuffle`);

  const forks = shuffled
    .filter(Boolean)
    .slice(0, 3)
    .map((c, i) => {
      const card = safeCardFromPool(c);
      const forkId = computeHash(`${seed}:fork:${i}:${card.id}`);
      const roll = seededIndex(seed, i + 200, 2000) - 1000; // -1000..999
      const projectedCordDelta = clamp(roll / 1000, -1, 1) * 0.18; // advisory only
      const title = `Counterfactual #${i + 1}: ${card.name}`;
      const auditHash = computeHash(`${seed}:${forkId}:${card.id}:${projectedCordDelta.toFixed(4)}`);
      return { forkId, title, cardId: card.id, projectedCordDelta, auditHash };
    });

  const auditHash = computeHash(`${seed}:M132:alts:${forks.map(f => f.auditHash).join('|')}`);

  return {
    mode: 'DETERMINISTIC_COUNTERFACTUALS',
    forks,
    auditHash,
  };
}

function buildKeyFindings(seed: string, completedRun: CompletedRun, macroRegime: MacroRegime, runPhase: RunPhase, pressureTier: PressureTier, intensity: number, highlightCard: GameCard, ledgerCount: number): string[] {
  const cord01 = normalizeCordScore(Number(completedRun.cordScore ?? 0));
  const ticks = Number.isFinite(completedRun.ticks) ? Math.max(0, Math.floor(completedRun.ticks)) : 0;

  const candidates: string[] = [
    `Cord score normalized: ${(cord01 * 100).toFixed(1)}%`,
    `Outcome: ${String(completedRun.outcome ?? 'UNKNOWN')}`,
    `Regime context: ${macroRegime} (mult=${(REGIME_MULTIPLIERS[macroRegime] ?? 1).toFixed(2)})`,
    `Phase context: ${runPhase} (phaseW=${(PHASE_WEIGHTS[runPhase] ?? 1).toFixed(2)})`,
    `Pressure tier: ${pressureTier} (pressureW=${(PRESSURE_WEIGHTS[pressureTier] ?? 1).toFixed(2)})`,
    `Dossier intensity: ${(intensity * 100).toFixed(1)}%`,
    `Ledger entries analyzed: ${ledgerCount}`,
    `Run ticks recorded: ${ticks} (cap=${RUN_TOTAL_TICKS})`,
    `Highlight opportunity: ${highlightCard.id} • ${highlightCard.name}`,
    `Macro events scheduled: ${MACRO_EVENTS_PER_RUN} (per mechanicsUtils)`,
    `Chaos windows scheduled: ${CHAOS_WINDOWS_PER_RUN} (per mechanicsUtils)`,
  ];

  return seededShuffle(candidates, `${seed}:M132:findings`).slice(0, 7);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * caseFileDossierGenerator
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function caseFileDossierGenerator(input: M132Input, emit: MechanicEmitter): M132Output {
  const completedRun: CompletedRun = input.completedRun ?? {
    runId: computeHash('M132:missing:runId'),
    userId: 'UNKNOWN',
    cordScore: 0,
    outcome: 'UNKNOWN',
    ticks: 0,
  };

  const ledgerEntries: LedgerEntry[] = Array.isArray(input.ledgerEntries) ? (input.ledgerEntries as LedgerEntry[]) : [];

  const cord01 = normalizeCordScore(Number(completedRun.cordScore ?? 0));
  const ticks = Number.isFinite(completedRun.ticks) ? Math.max(0, Math.floor(completedRun.ticks)) : 0;

  const seed = computeHash(
    safeJson({
      mechanic: 'M132',
      runId: completedRun.runId,
      userId: completedRun.userId,
      cordScore: completedRun.cordScore,
      outcome: completedRun.outcome,
      ticks,
      ledgerHash: computeHash(safeJson(ledgerEntries.map(e => ({ t: e.tick, h: e.hash })))),
    }),
  );

  const runId = String(completedRun.runId ?? seed);
  const tailTick = ledgerEntries.length ? Math.max(0, ...ledgerEntries.map(e => (typeof e.tick === 'number' ? e.tick : 0))) : 0;
  const tick = clamp(tailTick, 0, RUN_TOTAL_TICKS);

  const runPhase = deriveRunPhaseFromTicks(ticks);
  const macroRegime = deriveMacroRegime(seed, cord01);
  const pressureTier = derivePressureTier(seed, cord01, ledgerEntries.length, Math.max(1, ticks));

  const macroSchedule = buildMacroSchedule(`${seed}:M132:macro`, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(`${seed}:M132:chaos`, CHAOS_WINDOWS_PER_RUN);

  const decayRate = computeDecayRate(macroRegime, M132_BOUNDS.BASE_DECAY_RATE);
  const pulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const intensity = clamp(decayRate * pulseMultiplier * (REGIME_MULTIPLIERS[macroRegime] ?? 1.0), 0.01, 0.99);
  const tickTier = deriveTickTier(intensity);

  const pressurePhaseWeight = (PRESSURE_WEIGHTS[pressureTier] ?? 1.0) * (PHASE_WEIGHTS[runPhase] ?? 1.0);
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const weightedPool = buildWeightedPool(`${seed}:M132:pool`, pressurePhaseWeight, regimeWeight);
  const highlightIdx = seededIndex(seed, tick, Math.max(1, weightedPool.length));
  const highlightCard = safeCardFromPool(weightedPool[highlightIdx]);

  const evidence = buildEvidence(seed, ledgerEntries);
  const decisionTimeline = buildDecisionTimeline(seed, ledgerEntries, macroRegime, runPhase, pressureTier);

  const verdict: CaseVerdict = cord01 >= 0.72 ? 'PASS' : cord01 >= 0.45 ? 'WARN' : 'FAIL';

  const dossierId = computeHash(`M132:${seed}:dossier:${runId}`);
  const title = `CASE FILE // ${runId.slice(0, 10)} // ${String(completedRun.outcome ?? 'UNKNOWN')}`;
  const subtitle = `REGIME ${macroRegime} • PHASE ${runPhase} • PRESSURE ${pressureTier} • TIER ${tickTier}`;

  const keyFindings = buildKeyFindings(seed, completedRun, macroRegime, runPhase, pressureTier, intensity, highlightCard, ledgerEntries.length);

  const exportHash = computeHash(
    safeJson({
      dossierId,
      runId,
      verdict,
      cord01: Number(cord01.toFixed(6)),
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      intensity: Number(intensity.toFixed(6)),
      highlightCardId: highlightCard.id,
      evidenceHash: computeHash(safeJson(evidence.map(x => ({ t: x.tick, lh: x.ledgerHash, ah: x.actionHash })))),
      macroHash: computeHash(safeJson(macroSchedule)),
      chaosHash: computeHash(safeJson(chaosWindows)),
    }),
  );

  const caseFile: CaseFile = {
    dossierId,
    runId,
    title,
    subtitle,
    verdict,

    cordScore: cord01,
    outcome: String(completedRun.outcome ?? 'UNKNOWN'),
    ticks,

    macroRegime,
    runPhase,
    pressureTier,
    tickTier,

    decayRate,
    pulseMultiplier,
    intensity,

    macroSchedule,
    chaosWindows,

    highlightCard,

    keyFindings,
    evidence,

    exportHash,
  };

  const alternateBundle = buildAlternateScenarios(seed, macroRegime, runPhase, pressureTier, highlightCard);

  // ── Telemetry (server can ledger-verify by recomputing exportHash) ────────

  emit({
    event: 'CASE_FILE_GENERATED',
    mechanic_id: 'M132',
    tick,
    runId,
    payload: {
      dossierId,
      verdict,
      cordScore01: Number(cord01.toFixed(6)),
      outcome: caseFile.outcome,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      highlightCardId: highlightCard.id,
      exportHash,
      ledgerEntries: ledgerEntries.length,
    },
  });

  emit({
    event: 'ALTERNATE_TIMELINE_COMPUTED',
    mechanic_id: 'M132',
    tick,
    runId,
    payload: {
      forks: alternateBundle.forks.length,
      auditHash: alternateBundle.auditHash,
      forkIds: alternateBundle.forks.map(f => f.forkId),
    },
  });

  emit({
    event: 'DOSSIER_EXPORTED',
    mechanic_id: 'M132',
    tick,
    runId,
    payload: {
      exportHash,
      dossierId,
      mode: alternateBundle.mode,
    },
  });

  return {
    caseFile,
    decisionTimeline,
    alternateScenariosRendered: alternateBundle as unknown,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M132MLInput {
  caseFile?: CaseFile;
  decisionTimeline?: DecisionEntry[];
  alternateScenariosRendered?: unknown;
  runId: string;
  tick: number;
}

export interface M132MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // deterministic hash (non-crypto)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * caseFileDossierGeneratorMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function caseFileDossierGeneratorMLCompanion(input: M132MLInput): Promise<M132MLOutput> {
  const runId = String(input.runId ?? '');
  const tick = Math.max(0, Math.floor(Number(input.tick ?? 0)));

  const cf = input.caseFile;
  const intensity = typeof cf?.intensity === 'number' ? clamp(cf.intensity, 0.01, 0.99) : 0.35;

  const regime: MacroRegime = (cf?.macroRegime as MacroRegime) ?? REGIMES[seededIndex(runId, 1, REGIMES.length)];
  const decay = computeDecayRate(regime, M132_BOUNDS.BASE_DECAY_RATE);
  const pulse = tick > 0 && tick % M132_BOUNDS.PULSE_CYCLE === 0 ? (EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0) : 1.0;

  const timelineCount = Array.isArray(input.decisionTimeline) ? input.decisionTimeline.length : 0;
  const hasAlts = typeof input.alternateScenariosRendered !== 'undefined' && input.alternateScenariosRendered !== null;

  const score = clamp(
    0.20 +
      intensity * 0.55 +
      clamp(timelineCount / 64, 0, 1) * 0.15 +
      (hasAlts ? 0.08 : 0) +
      clamp((pulse - 1.0) * 0.10, -0.08, 0.08),
    0.01,
    0.99,
  );

  const factors = seededShuffle(
    [
      `Regime context: ${regime}`,
      `Dossier intensity: ${(intensity * 100).toFixed(1)}%`,
      `Timeline entries: ${timelineCount}`,
      hasAlts ? 'Counterfactuals present' : 'Counterfactuals absent',
      `Decay shaping: ${decay.toFixed(3)}`,
    ],
    `${runId}:M132:ml:factors:${tick}`,
  ).slice(0, 5);

  const recommendation =
    score >= 0.70
      ? 'Export the case file and review the highest-severity decisions first.'
      : 'Increase ledger coverage and ensure post-run dossier is generated every run.';

  return {
    score,
    topFactors: factors,
    recommendation,
    auditHash: computeHash(safeJson(input) + ':ml:M132:v1'),
    confidenceDecay: clamp(decay, 0.01, 0.25),
  };
}