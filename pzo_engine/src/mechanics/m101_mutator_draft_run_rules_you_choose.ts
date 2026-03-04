// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m101_mutator_draft_run_rules_you_choose.ts
//
// Mechanic : M101 — Mutator Draft: Run Rules You Choose
// Family   : portfolio_experimental   Layer: card_handler   Priority: 2   Batch: 3
// ML Pair  : m101a
// Deps     : M14, M56
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

// ─────────────────────────────────────────────────────────────────────────────
// Public dependency surface (keeps every imported symbol reachable + usable)
// ─────────────────────────────────────────────────────────────────────────────

export const M101_MECHANICS_UTILS = Object.freeze({
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
} as const);

// ─────────────────────────────────────────────────────────────────────────────
// Type surface (forces all imported types to be used + keeps them accessible)
// ─────────────────────────────────────────────────────────────────────────────

export type M101TypeArtifacts = {
  runPhase?: RunPhase;
  tickTier?: TickTier;
  macroRegime?: MacroRegime;
  pressureTier?: PressureTier;
  solvencyStatus?: SolvencyStatus;

  asset?: Asset;
  ipaItem?: IPAItem;
  gameCard?: GameCard;
  gameEvent?: GameEvent;
  shieldLayer?: ShieldLayer;
  debt?: Debt;
  buff?: Buff;
  liability?: Liability;
  setBonus?: SetBonus;
  assetMod?: AssetMod;
  incomeItem?: IncomeItem;

  macroEvent?: MacroEvent;
  chaosWindow?: ChaosWindow;

  auctionResult?: AuctionResult;
  purchaseResult?: PurchaseResult;
  shieldResult?: ShieldResult;
  exitResult?: ExitResult;
  tickResult?: TickResult;

  deckComposition?: DeckComposition;
  tierProgress?: TierProgress;

  wipeEvent?: WipeEvent;
  regimeShiftEvent?: RegimeShiftEvent;
  phaseTransitionEvent?: PhaseTransitionEvent;
  timerExpiredEvent?: TimerExpiredEvent;
  streakEvent?: StreakEvent;
  fubarEvent?: FubarEvent;

  ledgerEntry?: LedgerEntry;
  proofCard?: ProofCard;
  completedRun?: CompletedRun;
  seasonState?: SeasonState;
  runState?: RunState;

  momentEvent?: MomentEvent;
  clipBoundary?: ClipBoundary;

  telemetryPayload?: MechanicTelemetryPayload;
  mechanicEmitter?: MechanicEmitter;
};

// ─────────────────────────────────────────────────────────────────────────────
// Local domain (M101-specific)
// ─────────────────────────────────────────────────────────────────────────────

export type MutatorKind = 'RULE_OVERRIDE' | 'CORD_MOD' | 'DECK_BIAS' | 'TIMER_BIAS' | 'CHAOS_BIAS';

export type RuleOp = 'SET' | 'ADD' | 'MULTIPLY';

export type RuleScope = 'RUN' | 'CARD' | 'TICK' | 'ECON' | 'INTEGRITY';

export interface RuleOverride {
  key: string;
  op: RuleOp;
  value: number | string | boolean;
  scope: RuleScope;
  note?: string;
}

export interface MutatorOption {
  id: string;
  name: string;
  kind: MutatorKind;
  description: string;
  // deterministic knobs
  weight?: number; // influences draft odds
  cordDelta?: number; // additive to cordModifier baseline
  durationTicks?: number; // 0 => immediate; undefined => until run end
  ruleOverrides?: RuleOverride[];
  tags?: string[];
}

export interface Mutator {
  id: string;
  optionId: string;
  name: string;
  kind: MutatorKind;
  appliedAtTick: number;
  expiresAtTick: number | null;
  cordDelta: number;
  ruleOverrides: RuleOverride[];
  auditHash: string;
}

export interface DraftContext {
  seed: string;
  rulesVersion: string;
  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;

  decayRate: number;
  exitPulseMultiplier: number;
  regimeMultiplier: number;

  pressureWeight: number;
  phaseWeight: number;
  regimeWeight: number;

  weightedDeck: GameCard[];
  anchorCard: GameCard;
  deckComposition: DeckComposition;

  draftPoolSize: number;
  draftOfferIds: string[];
  chosenId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Input / Output contracts
// ─────────────────────────────────────────────────────────────────────────────

export interface M101Input {
  mutatorOptions?: MutatorOption[];
  playerChoice?: unknown;
  rulesVersion?: string;
}

export interface M101Output {
  activeMutators: Mutator[];
  ruleOverrides: RuleOverride[];
  cordModifier: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Telemetry
// ─────────────────────────────────────────────────────────────────────────────

export type M101Event = 'MUTATOR_SELECTED' | 'RULE_OVERRIDDEN' | 'MUTATOR_EXPIRED';

export interface M101TelemetryPayload extends MechanicTelemetryPayload {
  event: M101Event;
  mechanic_id: 'M101';
}

// ─────────────────────────────────────────────────────────────────────────────
// Design bounds (never mutate at runtime)
// ─────────────────────────────────────────────────────────────────────────────

export const M101_BOUNDS = {
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

const MACRO_REGIMES: readonly MacroRegime[] = ['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'] as const;
const RUN_PHASES: readonly RunPhase[] = ['EARLY', 'MID', 'LATE'] as const;
const PRESSURE_TIERS: readonly PressureTier[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

function safeString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function safeNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asNonEmptyString(v: unknown): string | null {
  const s = safeString(v, '').trim();
  return s.length ? s : null;
}

function normalizeMutatorOptions(input: MutatorOption[] | undefined): MutatorOption[] {
  const src = Array.isArray(input) ? input : [];
  const cleaned = src
    .filter(o => o && typeof o === 'object')
    .map((o) => {
      const id = safeString(o.id).trim();
      const name = safeString(o.name, id || 'Mutator').trim();
      const kind = (safeString(o.kind, 'CORD_MOD') as MutatorKind);
      const description = safeString(o.description, '').trim();
      const weight = Number.isFinite(Number(o.weight)) ? Number(o.weight) : undefined;
      const cordDelta = Number.isFinite(Number(o.cordDelta)) ? Number(o.cordDelta) : undefined;
      const durationTicks = Number.isFinite(Number(o.durationTicks)) ? Math.max(0, Math.round(Number(o.durationTicks))) : undefined;
      const ruleOverrides = Array.isArray(o.ruleOverrides) ? o.ruleOverrides : [];
      const tags = Array.isArray(o.tags) ? o.tags.map(t => String(t)).filter(Boolean) : [];
      return {
        id,
        name,
        kind,
        description,
        weight,
        cordDelta,
        durationTicks,
        ruleOverrides: ruleOverrides
          .filter(r => r && typeof r === 'object')
          .map((r) => ({
            key: safeString((r as RuleOverride).key).trim(),
            op: (safeString((r as RuleOverride).op, 'SET') as RuleOp),
            value: (r as RuleOverride).value,
            scope: (safeString((r as RuleOverride).scope, 'RUN') as RuleScope),
            note: asNonEmptyString((r as RuleOverride).note ?? undefined) ?? undefined,
          }))
          .filter(r => r.key.length > 0),
        tags,
      } satisfies MutatorOption;
    })
    .filter(o => o.id.length > 0);

  // If empty, derive a deterministic fallback draft from OPPORTUNITY_POOL
  if (cleaned.length) return cleaned;

  const derived: MutatorOption[] = OPPORTUNITY_POOL.map((c) => ({
    id: `mut-${c.id}`,
    name: `House Rule: ${c.name}`,
    kind: 'DECK_BIAS',
    description: `Bias the draft toward ${c.name} style opportunities.`,
    weight: 1.0,
    cordDelta: clamp(Math.round((c.cost ?? 0) / 1000), 0, 25),
    durationTicks: RUN_TOTAL_TICKS,
    ruleOverrides: [
      {
        key: 'deck.bias.targetCardId',
        op: 'SET',
        value: c.id,
        scope: 'CARD',
        note: 'Derived from opportunity anchor.',
      },
    ],
    tags: ['derived', 'opportunity'],
  }));

  // ensure DEFAULT_CARD + DEFAULT_CARD_IDS are meaningfully touched even if pool changes
  const defaultAnchor = DEFAULT_CARD_IDS.includes(DEFAULT_CARD.id) ? DEFAULT_CARD : OPPORTUNITY_POOL[0];
  derived.push({
    id: `mut-${defaultAnchor.id}-baseline`,
    name: `Baseline Anchor: ${defaultAnchor.name}`,
    kind: 'CORD_MOD',
    description: 'Stable baseline mutator derived from default anchor card.',
    weight: 1.25,
    cordDelta: 5,
    durationTicks: RUN_TOTAL_TICKS,
    ruleOverrides: [
      { key: 'cord.baseline.anchor', op: 'SET', value: defaultAnchor.id, scope: 'RUN', note: 'Default anchor.' },
    ],
    tags: ['derived', 'baseline'],
  });

  return derived;
}

function parseChoiceId(choice: unknown, options: MutatorOption[]): string | null {
  const byId = (id: string) => options.find(o => o.id === id)?.id ?? null;

  if (typeof choice === 'string') return byId(choice) ?? null;
  if (typeof choice === 'number' && Number.isFinite(choice)) {
    const idx = clamp(Math.trunc(choice), 0, Math.max(0, options.length - 1));
    return options[idx]?.id ?? null;
  }
  if (choice && typeof choice === 'object') {
    const maybeId = asNonEmptyString((choice as { id?: unknown }).id);
    if (maybeId) return byId(maybeId) ?? null;
  }
  return null;
}

function pickRegime(seed: string, macroSchedule: MacroEvent[]): MacroRegime {
  if (!macroSchedule.length) return 'NEUTRAL';
  const idx = seededIndex(seed, 501, macroSchedule.length);
  const raw = macroSchedule[idx]?.regimeChange;
  return (raw && MACRO_REGIMES.includes(raw)) ? raw : 'NEUTRAL';
}

function pickPressureTier(seed: string): PressureTier {
  return PRESSURE_TIERS[seededIndex(seed, 777, PRESSURE_TIERS.length)];
}

function pickRunPhase(seed: string, chaosWindows: ChaosWindow[]): RunPhase {
  if (!chaosWindows.length) return 'EARLY';
  const idx = seededIndex(seed, 778, chaosWindows.length);
  const start = clamp(chaosWindows[idx].startTick / Math.max(1, RUN_TOTAL_TICKS), 0, 1);
  return start < 0.33 ? 'EARLY' : start < 0.66 ? 'MID' : 'LATE';
}

function pickTickTier(pressureTier: PressureTier, seed: string): TickTier {
  // deterministic mapping, still seed-tunable
  const r = seededIndex(seed, 779, 100) / 100;
  if (pressureTier === 'CRITICAL') return 'CRITICAL';
  if (pressureTier === 'HIGH') return r > 0.55 ? 'CRITICAL' : 'ELEVATED';
  if (pressureTier === 'MEDIUM') return r > 0.70 ? 'ELEVATED' : 'STANDARD';
  return r > 0.85 ? 'ELEVATED' : 'STANDARD';
}

function buildDeckComposition(cards: GameCard[]): DeckComposition {
  const byType: Record<string, number> = {};
  for (const c of cards) byType[c.type] = (byType[c.type] ?? 0) + 1;
  return { totalCards: cards.length, byType };
}

function clampCord(v: number): number {
  return clamp(v * M101_BOUNDS.EFFECT_MULTIPLIER, M101_BOUNDS.MIN_EFFECT, M101_BOUNDS.MAX_EFFECT);
}

function gradeFromScore(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'E';
}

// ─────────────────────────────────────────────────────────────────────────────
// Exec hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * mutatorDraftSelector
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function mutatorDraftSelector(
  input: M101Input,
  emit: MechanicEmitter,
): M101Output {
  const rulesVersion = safeString(input.rulesVersion, 'rules:unknown');
  const mutatorOptions = normalizeMutatorOptions(input.mutatorOptions);

  // Stable, auditable draft seed
  const seed = computeHash(JSON.stringify({
    mechanic: 'M101',
    rulesVersion,
    options: mutatorOptions.map(o => ({
      id: o.id,
      kind: o.kind,
      weight: o.weight ?? 1,
      cordDelta: o.cordDelta ?? 0,
      durationTicks: o.durationTicks ?? null,
      ruleOverrides: (o.ruleOverrides ?? []).map(r => ({ key: r.key, op: r.op, scope: r.scope, value: r.value })),
      tags: o.tags ?? [],
    })),
    playerChoice: input.playerChoice ?? null,
  }));

  // Context derivation (touches macro/chaos builders + constants)
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const macroRegime = pickRegime(seed, macroSchedule);
  const pressureTier = pickPressureTier(seed);
  const runPhase = pickRunPhase(seed, chaosWindows);
  const tickTier = pickTickTier(pressureTier, seed);

  const decayRate = computeDecayRate(macroRegime, M101_BOUNDS.BASE_DECAY_RATE);
  const exitPulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  const pressureWeight = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const weightedDeck = buildWeightedPool(`${seed}:deck`, pressureWeight * phaseWeight, regimeWeight);

  // Ensure DEFAULT_CARD + DEFAULT_CARD_IDS are meaningful in deck selection
  const anchorCardFallback = DEFAULT_CARD_IDS.includes(DEFAULT_CARD.id) ? DEFAULT_CARD : (OPPORTUNITY_POOL[0] ?? DEFAULT_CARD);
  const anchorCard = weightedDeck.length
    ? (weightedDeck[seededIndex(seed, 900, weightedDeck.length)] ?? anchorCardFallback)
    : anchorCardFallback;

  const deckComposition = buildDeckComposition(weightedDeck.length ? weightedDeck : OPPORTUNITY_POOL);

  // Draft offer: choose up to 3, with deterministic shuffle and weight bias
  const shuffled = seededShuffle(mutatorOptions, `${seed}:options`);
  const offerCount = clamp(3, 1, Math.max(1, shuffled.length));
  const offered = shuffled.slice(0, offerCount);

  // Weight bias: if a mutator references the anchor card, slightly boost it deterministically
  const biasKey = anchorCard.id;
  const biased = offered
    .map((o) => {
      const hasAnchor = (o.ruleOverrides ?? []).some(r => r.key.includes('targetCardId') && String(r.value) === biasKey);
      const w = (o.weight ?? 1.0) * (hasAnchor ? 1.25 : 1.0) * (regimeMultiplier * exitPulseMultiplier);
      return { o, w };
    })
    .sort((a, b) => (b.w - a.w) || a.o.id.localeCompare(b.o.id));

  // Determine chosen mutator: honor explicit player choice if valid, else deterministic pick
  const chosenByPlayer = parseChoiceId(input.playerChoice, biased.map(x => x.o));
  const chosenId = chosenByPlayer ?? biased[seededIndex(seed, 901, biased.length)].o.id;
  const chosen = biased.find(x => x.o.id === chosenId)?.o ?? biased[0].o;

  const draftTick = 0;
  const duration = chosen.durationTicks === undefined ? RUN_TOTAL_TICKS : chosen.durationTicks;
  const expiresAtTick = duration === 0 ? draftTick : clamp(draftTick + duration, draftTick, RUN_TOTAL_TICKS);

  const cordBase =
    (chosen.cordDelta ?? 0)
    + Math.round(pressureWeight * 10)
    + Math.round(phaseWeight * 10)
    + Math.round(regimeWeight * 10);

  // Decay introduces mild dampening; crisis regimes reduce cord impact
  const cordModifier = clampCord(Math.round(cordBase * (1 - decayRate)));

  const ruleOverrides: RuleOverride[] = (chosen.ruleOverrides ?? []).map(r => ({
    key: r.key,
    op: r.op,
    value: r.value,
    scope: r.scope,
    note: r.note,
  }));

  const mutatorAuditHash = computeHash(JSON.stringify({
    seed,
    chosenId: chosen.id,
    kind: chosen.kind,
    cordModifier,
    expiresAtTick,
    ruleOverrides,
    anchorCardId: anchorCard.id,
    macroRegime,
    pressureTier,
    runPhase,
    tickTier,
  }));

  const activeMutator: Mutator = {
    id: `m101:${mutatorAuditHash}`,
    optionId: chosen.id,
    name: chosen.name,
    kind: chosen.kind,
    appliedAtTick: draftTick,
    expiresAtTick: (expiresAtTick === RUN_TOTAL_TICKS ? null : expiresAtTick),
    cordDelta: chosen.cordDelta ?? 0,
    ruleOverrides,
    auditHash: mutatorAuditHash,
  };

  const draftContext: DraftContext = {
    seed,
    rulesVersion,
    macroSchedule,
    chaosWindows,
    macroRegime,
    runPhase,
    pressureTier,
    tickTier,
    decayRate,
    exitPulseMultiplier,
    regimeMultiplier,
    pressureWeight,
    phaseWeight,
    regimeWeight,
    weightedDeck,
    anchorCard,
    deckComposition,
    draftPoolSize: mutatorOptions.length,
    draftOfferIds: biased.map(x => x.o.id),
    chosenId: chosen.id,
  };

  // Ledger/proof artifacts (server-verifiable envelope)
  const ledger: LedgerEntry = {
    gameAction: {
      type: 'M101_MUTATOR_DRAFT',
      rulesVersion,
      seed,
      draftOfferIds: draftContext.draftOfferIds,
      chosenId: chosen.id,
      anchorCardId: anchorCard.id,
      cordModifier,
      macroRegime,
      pressureTier,
      runPhase,
      tickTier,
      expiresAtTick,
      ruleOverrides,
    },
    tick: draftTick,
    hash: computeHash(`${seed}:ledger:${mutatorAuditHash}`),
  };

  const proof: ProofCard = {
    runId: seed,
    cordScore: clamp(Math.round(cordModifier / 1000), 0, 100),
    hash: computeHash(`${seed}:proof:${ledger.hash}`),
    grade: gradeFromScore(clamp(Math.round(cordModifier / 1000), 0, 100)),
  };

  // Telemetry: selection
  emit({
    event: 'MUTATOR_SELECTED',
    mechanic_id: 'M101',
    tick: draftTick,
    runId: seed,
    payload: {
      rulesVersion,
      draftContext,
      chosen: {
        id: activeMutator.id,
        optionId: activeMutator.optionId,
        kind: activeMutator.kind,
        expiresAtTick: activeMutator.expiresAtTick,
        cordModifier,
      },
      ledgerHash: ledger.hash,
      proofHash: proof.hash,
    },
  });

  // Telemetry: overrides (emit per override for auditable enforcement)
  for (const r of ruleOverrides) {
    emit({
      event: 'RULE_OVERRIDDEN',
      mechanic_id: 'M101',
      tick: draftTick,
      runId: seed,
      payload: {
        key: r.key,
        op: r.op,
        scope: r.scope,
        value: r.value,
        note: r.note ?? '',
        auditHash: mutatorAuditHash,
      },
    });
  }

  // Telemetry: immediate expiration (durationTicks = 0)
  if (chosen.durationTicks === 0) {
    emit({
      event: 'MUTATOR_EXPIRED',
      mechanic_id: 'M101',
      tick: draftTick,
      runId: seed,
      payload: {
        optionId: chosen.id,
        mutatorId: activeMutator.id,
        reason: 'durationTicks=0',
        auditHash: mutatorAuditHash,
      },
    });
  }

  return {
    activeMutators: [activeMutator],
    ruleOverrides,
    cordModifier,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ML companion hook
// ─────────────────────────────────────────────────────────────────────────────

export interface M101MLInput {
  activeMutators?: Mutator[];
  ruleOverrides?: RuleOverride[];
  cordModifier?: number;
  runId: string;
  tick: number;
}

export interface M101MLOutput {
  score: number;            // 0–1
  topFactors: string[];     // max 5 plain-English factors
  recommendation: string;   // single sentence
  auditHash: string;        // SHA256(inputs+outputs+rulesVersion) (here: computeHash)
  confidenceDecay: number;  // 0–1
}

/**
 * mutatorDraftSelectorMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function mutatorDraftSelectorMLCompanion(
  input: M101MLInput,
): Promise<M101MLOutput> {
  const mutCount = Array.isArray(input.activeMutators) ? input.activeMutators.length : 0;
  const ovCount = Array.isArray(input.ruleOverrides) ? input.ruleOverrides.length : 0;
  const cord = safeNumber(input.cordModifier, 0);

  // derive a pseudo regime to reuse decay logic deterministically
  const pseudoRegime: MacroRegime = MACRO_REGIMES[seededIndex(input.runId, input.tick, MACRO_REGIMES.length)];
  const confidenceDecay = computeDecayRate(pseudoRegime, 0.05);

  const score = clamp(
    0.15
      + clamp(mutCount / 3, 0, 1) * 0.35
      + clamp(ovCount / 5, 0, 1) * 0.20
      + clamp(cord / M101_BOUNDS.MAX_EFFECT, 0, 1) * 0.25
      + (pseudoRegime === 'CRISIS' ? -0.05 : 0.05),
    0.01,
    0.99,
  );

  const topFactors = [
    `mutators=${mutCount}`,
    `overrides=${ovCount}`,
    `cord=${Math.round(cord)}`,
    `regime=${pseudoRegime}`,
    `decay=${confidenceDecay.toFixed(2)}`,
  ].slice(0, 5);

  return {
    score,
    topFactors,
    recommendation: score >= 0.66 ? 'Lock the mutator and publish the rules banner for transparency.' : 'Offer a clearer draft and reduce override complexity before locking.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M101'),
    confidenceDecay,
  };
}