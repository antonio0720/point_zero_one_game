// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m129_creator_packs_caption_templates_sound_stingers.ts
//
// Mechanic : M129 — Creator Packs: Caption Templates + Sound Stingers
// Family   : cosmetics   Layer: ui_component   Priority: 3   Batch: 3
// ML Pair  : m129a
// Deps     : M23, M126
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
 * Keeps all shared imports “live” + directly reachable for debugging/tests.
 */
export const M129_IMPORTED_SYMBOLS = {
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
 * Prevents type-import drift and keeps the full surface area reachable.
 */
export type M129_ImportedTypesAnchor = {
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

// ── Local creator-pack domain types (M129-only; intentionally not in ./types) ─

export type CreatorPackKind = 'CAPTION' | 'STINGER' | 'CAPTION_AND_STINGER';

export interface CreatorPack {
  packId: string;
  kind: CreatorPackKind;
  name: string;

  /** Deterministic list of caption templates for this pack. */
  templates: string[];

  /** Deterministic stinger ids for this pack (mapped by UI/audio layer). */
  stingers: string[];

  /** Optional pack salt to keep daily/weekly variants stable. */
  salt?: string;
}

export interface CreatorPackSelection {
  packId?: string;
  kind?: CreatorPackKind;
  templateIndex?: number;
  stingerIndex?: number;
}

export interface CaptionTemplate {
  template: string; // supports placeholders: {{moment}}, {{tick}}, {{regime}}, {{phase}}, {{pressure}}
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M129Input {
  creatorPackSelection?: unknown;
  momentEvent?: MomentEvent;
  captionTemplate?: unknown;
}

export interface M129Output {
  captionGenerated: string;
  stingerPlayed: boolean;
  packConsumed: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M129Event = 'CREATOR_PACK_USED' | 'CAPTION_GENERATED' | 'STINGER_TRIGGERED';

export interface M129TelemetryPayload extends MechanicTelemetryPayload {
  event: M129Event;
  mechanic_id: 'M129';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M129_BOUNDS = {
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

  // creator pack caps
  MAX_TEMPLATE_LEN: 140,
  MAX_TEMPLATES: 32,
  MAX_STINGERS: 16,
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────

const M129_RULES_VERSION = 'M129:v1';

function asString(v: unknown): string {
  return String(v ?? '').trim();
}

function toFiniteInt(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clampIndex(i: number, len: number): number {
  if (len <= 0) return 0;
  return clamp(i, 0, len - 1);
}

function parseSelection(v: unknown): CreatorPackSelection {
  if (!v || typeof v !== 'object') return {};
  const o = v as any;
  return {
    packId: asString(o.packId) || undefined,
    kind: (asString(o.kind) as CreatorPackKind) || undefined,
    templateIndex: Number.isFinite(Number(o.templateIndex)) ? Math.trunc(Number(o.templateIndex)) : undefined,
    stingerIndex: Number.isFinite(Number(o.stingerIndex)) ? Math.trunc(Number(o.stingerIndex)) : undefined,
  };
}

function parseCaptionTemplate(v: unknown): CaptionTemplate | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') {
    const t = v.trim();
    return t ? { template: t.slice(0, M129_BOUNDS.MAX_TEMPLATE_LEN) } : undefined;
  }
  if (typeof v === 'object') {
    const o = v as any;
    const t = asString(o.template);
    return t ? { template: t.slice(0, M129_BOUNDS.MAX_TEMPLATE_LEN) } : undefined;
  }
  return undefined;
}

function deriveRunPhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  if (t < RUN_TOTAL_TICKS / 3) return 'EARLY';
  if (t < (RUN_TOTAL_TICKS * 2) / 3) return 'MID';
  return 'LATE';
}

function deriveMacroRegime(tick: number, schedule: MacroEvent[]): MacroRegime {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const sorted = [...schedule].sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if ((ev.tick ?? 0) > t) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function inChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  for (const w of windows) {
    if (t >= w.startTick && t <= w.endTick) return true;
  }
  return false;
}

function derivePressureTier(runPhase: RunPhase, regime: MacroRegime, chaos: boolean): PressureTier {
  if (chaos) return 'CRITICAL';
  if (regime === 'CRISIS') return runPhase === 'EARLY' ? 'HIGH' : 'CRITICAL';
  if (regime === 'BEAR') return runPhase === 'LATE' ? 'HIGH' : 'MEDIUM';
  if (regime === 'BULL') return runPhase === 'EARLY' ? 'LOW' : 'MEDIUM';
  return runPhase === 'EARLY' ? 'LOW' : 'MEDIUM';
}

function deriveTickTier(pressureTier: PressureTier): TickTier {
  if (pressureTier === 'CRITICAL') return 'CRITICAL';
  if (pressureTier === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function sanitizeTemplates(templates: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of templates) {
    const s = asString(t).slice(0, M129_BOUNDS.MAX_TEMPLATE_LEN);
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= M129_BOUNDS.MAX_TEMPLATES) break;
  }
  return out;
}

function sanitizeStingers(stingers: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s0 of stingers) {
    const s = asString(s0);
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= M129_BOUNDS.MAX_STINGERS) break;
  }
  return out;
}

function buildDefaultPack(seed: string): CreatorPack {
  // Deterministic template/stinger set. UI/audio layer maps stinger ids -> actual sound.
  const baseTemplates = [
    'No drift. Just proof. {{moment}}',
    'Clock is loud. {{phase}}/{{regime}}.',
    'I chose pressure. It chose me. {{pressure}}',
    'Receipt or it didn’t happen. Tick {{tick}}.',
    'This run has teeth. {{moment}}',
  ];

  const baseStingers = [
    'STINGER_TICK',
    'STINGER_PROOF',
    'STINGER_PULSE',
    'STINGER_LOCK',
  ];

  const templates = seededShuffle(sanitizeTemplates(baseTemplates), seed + ':templates');
  const stingers = seededShuffle(sanitizeStingers(baseStingers), seed + ':stingers');

  return {
    packId: computeHash(`${seed}:pack:${M129_RULES_VERSION}`).slice(0, 16),
    kind: 'CAPTION_AND_STINGER',
    name: 'Default Creator Pack',
    templates,
    stingers,
    salt: 'default',
  };
}

function renderTemplate(tpl: string, ctx: {
  tick: number;
  moment: string;
  regime: MacroRegime;
  phase: RunPhase;
  pressure: PressureTier;
}): string {
  const safe = tpl.slice(0, M129_BOUNDS.MAX_TEMPLATE_LEN);
  return safe
    .replaceAll('{{tick}}', String(ctx.tick))
    .replaceAll('{{moment}}', ctx.moment)
    .replaceAll('{{regime}}', String(ctx.regime))
    .replaceAll('{{phase}}', String(ctx.phase))
    .replaceAll('{{pressure}}', String(ctx.pressure));
}

function momentToString(m?: MomentEvent): string {
  if (!m) return 'Moment captured';
  // Minimal and deterministic: never assume unknown fields exist.
  const anyM = m as any;
  const kind = asString(anyM.type || anyM.event || anyM.kind) || 'Moment';
  const detail = asString(anyM.label || anyM.name || anyM.reason) || '';
  return detail ? `${kind}: ${detail}` : kind;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * creatorPackApplier
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function creatorPackApplier(input: M129Input, emit: MechanicEmitter): M129Output {
  const selection = parseSelection(input.creatorPackSelection);
  const tplOverride = parseCaptionTemplate(input.captionTemplate);
  const momentEvent = input.momentEvent;

  // Deterministic seed for this invocation (binds to moment + selection + rules version).
  const seed = computeHash(
    JSON.stringify({
      mid: 'M129',
      v: M129_RULES_VERSION,
      selection,
      moment: momentEvent ? computeHash(JSON.stringify(momentEvent)) : null,
      tpl: tplOverride?.template ?? null,
    }),
  );

  // Macro fabric (keeps shared imports live; gives “season texture” to captions/stingers).
  const tick = 0;
  const macroSchedule = buildMacroSchedule(seed + ':macro', MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed + ':chaos', CHAOS_WINDOWS_PER_RUN);

  const runPhase = deriveRunPhase(tick);
  const macroRegime = deriveMacroRegime(tick, macroSchedule);
  const chaos = inChaosWindow(tick, chaosWindows);

  const pressureTier = derivePressureTier(runPhase, macroRegime, chaos);
  const tickTier = deriveTickTier(pressureTier);

  const decay = computeDecayRate(macroRegime, M129_BOUNDS.BASE_DECAY_RATE);
  const pulseMult = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  // Keep pools live: deck + weighted pool + opportunity pool.
  const deckOrder = seededShuffle(DEFAULT_CARD_IDS, seed + ':deck');
  const deckHintTop = deckOrder[0] ?? DEFAULT_CARD.id;

  const opportunityHint = OPPORTUNITY_POOL[seededIndex(seed + ':opp', tick, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const weightedPool = buildWeightedPool(seed + ':pool', pressureW * phaseW, regimeW);
  const weightedPick = weightedPool[seededIndex(seed + ':weightedPick', tick + 7, Math.max(1, weightedPool.length))] ?? DEFAULT_CARD;

  // Determine pack (for now: default pack; caller can swap with inventory-driven packs later).
  const pack = buildDefaultPack(seed + ':' + (selection.packId ?? 'default'));

  // Determine caption template: override > selected index > deterministic pick.
  const templates = pack.templates.length ? pack.templates : ['{{moment}}'];
  const templateIndex =
    selection.templateIndex != null
      ? clampIndex(selection.templateIndex, templates.length)
      : seededIndex(seed + ':tpl', tick + 3, templates.length);

  const rawTemplate = tplOverride?.template ?? templates[templateIndex] ?? '{{moment}}';

  const momentStr = momentToString(momentEvent);

  const captionGenerated = renderTemplate(rawTemplate, {
    tick,
    moment: momentStr,
    regime: macroRegime,
    phase: runPhase,
    pressure: pressureTier,
  });

  // Determine stinger choice.
  const stingers = pack.stingers.length ? pack.stingers : ['STINGER_TICK'];
  const stingerIndex =
    selection.stingerIndex != null
      ? clampIndex(selection.stingerIndex, stingers.length)
      : seededIndex(seed + ':stinger', tick + 5, stingers.length);

  const chosenStingerId = stingers[stingerIndex] ?? stingers[0] ?? 'STINGER_TICK';

  // Decide whether stinger plays (based on pack kind + deterministic pressure gating).
  const packKind: CreatorPackKind = (selection.kind ?? pack.kind) as CreatorPackKind;
  const stingerAllowedByKind = packKind === 'STINGER' || packKind === 'CAPTION_AND_STINGER';
  const stingerPlayed = stingerAllowedByKind && (PRESSURE_WEIGHTS[pressureTier] ?? 1.0) >= 1.0;

  // Pack consumed: deterministic (always true if any pack selection present; else true for default pack usage).
  const packConsumed = true;

  const runId = computeHash(`M129:run:${seed}`);

  const auditHash = computeHash(
    JSON.stringify({
      mid: 'M129',
      v: M129_RULES_VERSION,
      seed,
      runId,
      selection,
      packId: pack.packId,
      packKind,
      templateIndex,
      stingerIndex,
      chosenStingerId,
      captionGenerated,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      decay,
      pulseMult,
      regimeMult,
      deckHintTop,
      opportunityHintId: opportunityHint.id,
      weightedPickId: weightedPick.id,
    }),
  );

  // ── Telemetry (deterministic) ───────────────────────────────────────────

  emit({
    event: 'CREATOR_PACK_USED',
    mechanic_id: 'M129',
    tick,
    runId,
    payload: {
      packId: pack.packId,
      packKind,
      packConsumed,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      decay,
      pulseMult,
      regimeMult,
      deckHintTop,
      opportunityHintId: opportunityHint.id,
      weightedPickId: weightedPick.id,
      auditHash,
    },
  });

  emit({
    event: 'CAPTION_GENERATED',
    mechanic_id: 'M129',
    tick,
    runId,
    payload: {
      captionGenerated,
      templateIndex,
      macroRegime,
      runPhase,
      pressureTier,
      // include a small moment preview for UI
      momentPreview: momentStr.slice(0, 64),
      auditHash,
    },
  });

  if (stingerPlayed) {
    emit({
      event: 'STINGER_TRIGGERED',
      mechanic_id: 'M129',
      tick,
      runId,
      payload: {
        stingerId: chosenStingerId,
        stingerIndex,
        // bind to macro texture to keep audio/UX coherent
        macroRegime,
        pressureTier,
        auditHash,
      },
    });
  }

  return {
    captionGenerated,
    stingerPlayed,
    packConsumed,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M129MLInput {
  captionGenerated?: string;
  stingerPlayed?: boolean;
  packConsumed?: boolean;
  runId: string;
  tick: number;
}

export interface M129MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * creatorPackApplierMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function creatorPackApplierMLCompanion(input: M129MLInput): Promise<M129MLOutput> {
  const tick = clamp(typeof input.tick === 'number' ? input.tick : Number(input.tick), 0, RUN_TOTAL_TICKS);

  const caption = asString(input.captionGenerated);
  const hasCaption = caption.length > 0;
  const stingerPlayed = Boolean(input.stingerPlayed);
  const packConsumed = Boolean(input.packConsumed);

  const captionScore = hasCaption ? clamp(caption.length / 80, 0, 1) * 0.45 : 0.0;
  const stingerScore = stingerPlayed ? 0.20 : 0.0;
  const consumedScore = packConsumed ? 0.15 : 0.0;

  const score = clamp(0.05 + captionScore + stingerScore + consumedScore, 0.01, 0.99);

  const topFactors: string[] = [];
  topFactors.push(hasCaption ? 'Caption generated' : 'No caption');
  topFactors.push(`Caption length: ${caption.length}`);
  topFactors.push(stingerPlayed ? 'Stinger played' : 'No stinger');
  topFactors.push(packConsumed ? 'Pack consumed' : 'Pack not consumed');
  topFactors.push(`Tick: ${tick}`);

  const recommendation =
    hasCaption
      ? 'Persist caption + stinger id in moment metadata for share/export pipelines.'
      : 'Block export until caption is generated.';

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + `:ml:M129:${tick}:${M129_RULES_VERSION}`),
    confidenceDecay: 0.05,
  };
}