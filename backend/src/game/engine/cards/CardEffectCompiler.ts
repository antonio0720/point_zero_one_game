/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/cards/CardEffectCompiler.ts
 *
 * Doctrine:
 * - backend is the authoritative effect compiler
 * - overlay-adjusted effect magnitude must be preserved into execution
 * - compilation must be deterministic for the same card instance
 * - no UI-only assumptions are allowed in compiled operations
 * - supported operations must remain compatible with CardEffectExecutor
 * - unsupported effect fields must be surfaced explicitly, never silently discarded
 * - compile traces must be inspectable for replay, proof, and future chat/drama wiring
 */

import type {
  CardDefinition,
  CardInstance,
  Counterability,
  DeckType,
  DivergencePotential,
  EffectPayload,
  ModeCode,
  Targeting,
  TimingClass,
} from '../core/GamePrimitives';

export type NumericOperationKind =
  | 'cash'
  | 'income'
  | 'shield'
  | 'heat'
  | 'trust'
  | 'time'
  | 'divergence';

export type SupportedEffectField =
  | 'cashDelta'
  | 'incomeDelta'
  | 'shieldDelta'
  | 'heatDelta'
  | 'trustDelta'
  | 'timeDeltaMs'
  | 'divergenceDelta'
  | 'cascadeTag'
  | 'injectCards';

export type DeferredEffectField =
  | 'debtDelta'
  | 'expenseDelta'
  | 'treasuryDelta'
  | 'battleBudgetDelta'
  | 'holdChargeDelta'
  | 'counterIntelDelta'
  | 'exhaustCards'
  | 'grantBadges'
  | 'namedActionId';

export type CompilerSupportStatus = 'EXECUTABLE' | 'DEFERRED';
export type CompilerPriorityBand = 'FOUNDATION' | 'TACTICAL' | 'RITUAL' | 'SHADOW';
export type CompilerStrategicClass =
  | 'CAPITAL_ALLOCATION'
  | 'COMPOUNDING'
  | 'PRESSURE_RESPONSE'
  | 'PREDATORY_COMBAT'
  | 'COUNTERPLAY'
  | 'COOPERATIVE_CONTRACT'
  | 'RESCUE_INTERVENTION'
  | 'PRECISION_GHOSTING'
  | 'DISCIPLINE_CONTROL'
  | 'SYSTEM_OVERRIDE'
  | 'MIXED';

export type CompilerChannelWitnessHint =
  | 'NONE'
  | 'GLOBAL'
  | 'SYNDICATE'
  | 'DEAL_ROOM'
  | 'POST_RUN'
  | 'SYSTEM_SHADOW';

export interface CompiledOperationMeta {
  readonly operationId: string;
  readonly status: 'EXECUTABLE';
  readonly sourceField: SupportedEffectField;
  readonly definitionId: string;
  readonly instanceId: string;
  readonly cardName: string;
  readonly mode: ModeCode;
  readonly deckType: DeckType;
  readonly targeting: Targeting;
  readonly timingClass: readonly TimingClass[];
  readonly appliedEffectModifier: number;
  readonly weightedTags: readonly string[];
  readonly traceReasons: readonly string[];
  readonly strategicClass: CompilerStrategicClass;
  readonly priorityBand: CompilerPriorityBand;
  readonly witnessHint: CompilerChannelWitnessHint;
  readonly divergencePotential: DivergencePotential;
  readonly executionOrder: number;
}

export type CompiledOperation =
  | (CompiledOperationMeta & {
      readonly kind: NumericOperationKind;
      readonly magnitude: number;
    })
  | (CompiledOperationMeta & {
      readonly kind: 'inject';
      readonly magnitude: readonly string[];
    })
  | (CompiledOperationMeta & {
      readonly kind: 'cascadeTag';
      readonly magnitude: string;
    });

export interface DeferredCompiledRequirement {
  readonly requirementId: string;
  readonly status: 'DEFERRED';
  readonly field: DeferredEffectField;
  readonly definitionId: string;
  readonly instanceId: string;
  readonly mode: ModeCode;
  readonly deckType: DeckType;
  readonly strategicClass: CompilerStrategicClass;
  readonly witnessHint: CompilerChannelWitnessHint;
  readonly traceReasons: readonly string[];
  readonly payload:
    | number
    | string
    | readonly string[]
    | null;
}

export interface CompilationTraceEntry {
  readonly traceId: string;
  readonly phase:
    | 'VALIDATE'
    | 'CONTEXT'
    | 'NORMALIZE'
    | 'COMPILE_SUPPORTED'
    | 'COMPILE_DEFERRED'
    | 'FINALIZE';
  readonly level: 'INFO' | 'WARN';
  readonly code: string;
  readonly message: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

export interface CardCompilationPlan {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly mode: ModeCode;
  readonly deckType: DeckType;
  readonly appliedEffectModifier: number;
  readonly supportedOperations: readonly CompiledOperation[];
  readonly deferredRequirements: readonly DeferredCompiledRequirement[];
  readonly trace: readonly CompilationTraceEntry[];
  readonly operationKinds: readonly string[];
  readonly strategicClass: CompilerStrategicClass;
  readonly priorityBand: CompilerPriorityBand;
  readonly witnessHint: CompilerChannelWitnessHint;
  readonly weightedTags: readonly string[];
  readonly canonicalTimingClass: readonly TimingClass[];
  readonly targeting: Targeting;
  readonly overlayDeterminismKey: string;
  readonly unsupportedFieldCount: number;
}

const EFFECT_MULTIPLIER_PREFIX = 'effect:';
const WEIGHTED_TAG_DELIMITER = ':';
const MAX_EFFECT_MULTIPLIER = 10;
const MAX_STRING_LIST = 128;
const MAX_TRACE_REASONS = 24;
const MAX_TRACE_ENTRIES = 128;
const MAX_TAGS = 128;
const MAX_CASCADE_TAG_LENGTH = 128;
const MAX_BADGE_LENGTH = 96;
const MAX_NAMED_ACTION_LENGTH = 96;
const MAX_INJECT_CARD_ID_LENGTH = 96;

const EXECUTION_ORDER_BY_KIND: Readonly<Record<CompiledOperation['kind'], number>> = Object.freeze({
  cash: 10,
  income: 20,
  shield: 30,
  heat: 40,
  trust: 50,
  time: 60,
  divergence: 70,
  cascadeTag: 80,
  inject: 90,
});

const SUPPORTED_FIELD_TO_KIND: Readonly<Record<NumericOperationKind, SupportedEffectField>> = Object.freeze({
  cash: 'cashDelta',
  income: 'incomeDelta',
  shield: 'shieldDelta',
  heat: 'heatDelta',
  trust: 'trustDelta',
  time: 'timeDeltaMs',
  divergence: 'divergenceDelta',
});

const SUPPORTED_NUMERIC_FIELDS: readonly SupportedEffectField[] = Object.freeze([
  'cashDelta',
  'incomeDelta',
  'shieldDelta',
  'heatDelta',
  'trustDelta',
  'timeDeltaMs',
  'divergenceDelta',
]);

function resolveSupportedKindForField(
  field: SupportedEffectField,
): NumericOperationKind | null {
  const entry = (Object.entries(SUPPORTED_FIELD_TO_KIND) as readonly [
    NumericOperationKind,
    SupportedEffectField,
  ][]).find(([, supportedField]) => supportedField === field);

  return entry?.[0] ?? null;
}

const DEFERRED_EFFECT_FIELDS: readonly DeferredEffectField[] = Object.freeze([
  'debtDelta',
  'expenseDelta',
  'treasuryDelta',
  'battleBudgetDelta',
  'holdChargeDelta',
  'counterIntelDelta',
  'exhaustCards',
  'grantBadges',
  'namedActionId',
]);

const MODE_IDENTITY_TEXT: Readonly<Record<ModeCode, string>> = Object.freeze({
  solo: 'EMPIRE cards feel like capital allocation.',
  pvp: 'PREDATOR cards feel like weapons.',
  coop: 'SYNDICATE cards feel like contracts.',
  ghost: 'PHANTOM cards feel like precision instruments.',
});

const STRATEGIC_CLASS_BY_DECK: Readonly<Record<DeckType, CompilerStrategicClass>> = Object.freeze({
  OPPORTUNITY: 'CAPITAL_ALLOCATION',
  IPA: 'COMPOUNDING',
  FUBAR: 'PRESSURE_RESPONSE',
  MISSED_OPPORTUNITY: 'PRESSURE_RESPONSE',
  PRIVILEGED: 'SYSTEM_OVERRIDE',
  SO: 'PRESSURE_RESPONSE',
  SABOTAGE: 'PREDATORY_COMBAT',
  COUNTER: 'COUNTERPLAY',
  AID: 'COOPERATIVE_CONTRACT',
  RESCUE: 'RESCUE_INTERVENTION',
  DISCIPLINE: 'DISCIPLINE_CONTROL',
  TRUST: 'COOPERATIVE_CONTRACT',
  BLUFF: 'PREDATORY_COMBAT',
  GHOST: 'PRECISION_GHOSTING',
});

const WITNESS_HINT_BY_MODE: Readonly<Record<ModeCode, CompilerChannelWitnessHint>> = Object.freeze({
  solo: 'GLOBAL',
  pvp: 'DEAL_ROOM',
  coop: 'SYNDICATE',
  ghost: 'POST_RUN',
});

const PRIORITY_BAND_BY_TIMING: Readonly<Record<TimingClass, CompilerPriorityBand>> = Object.freeze({
  PRE: 'FOUNDATION',
  POST: 'TACTICAL',
  FATE: 'TACTICAL',
  CTR: 'TACTICAL',
  RES: 'TACTICAL',
  AID: 'TACTICAL',
  GBM: 'RITUAL',
  CAS: 'TACTICAL',
  PHZ: 'RITUAL',
  PSK: 'TACTICAL',
  END: 'RITUAL',
  ANY: 'FOUNDATION',
});

const PRIORITY_SCORE_BY_BAND: Readonly<Record<CompilerPriorityBand, number>> = Object.freeze({
  FOUNDATION: 10,
  TACTICAL: 20,
  RITUAL: 30,
  SHADOW: 40,
});

const TIMING_REASON_BY_CLASS: Readonly<Record<TimingClass, string>> = Object.freeze({
  PRE: 'pre-tick action affects the incoming engine resolution window',
  POST: 'post-tick action reacts to already-resolved state',
  FATE: 'fate-window action is constrained to event aftermath',
  CTR: 'counter-window action is reserved for incoming extraction defense',
  RES: 'rescue-window action responds to teammate critical pressure',
  AID: 'aid-window action expresses contract-based transfer behavior',
  GBM: 'ghost-benchmark action is keyed to legend marker timing',
  CAS: 'cascade-intercept action is keyed to chain disruption timing',
  PHZ: 'phase-boundary action is keyed to run architecture transitions',
  PSK: 'pressure-spike action is keyed to upward pressure tier crossings',
  END: 'tick-end action is a closing or endgame instrument',
  ANY: 'any-time action stays broadly legal across windows',
});

const STRATEGIC_REASON_BY_CLASS: Readonly<Record<CompilerStrategicClass, string>> = Object.freeze({
  CAPITAL_ALLOCATION: 'card compiles as capital deployment for solo/board-economy play',
  COMPOUNDING: 'card compiles as recurring income or portfolio-growth infrastructure',
  PRESSURE_RESPONSE: 'card compiles as adversity-management or forced-state response',
  PREDATORY_COMBAT: 'card compiles as offensive or deceptive pvp pressure',
  COUNTERPLAY: 'card compiles as defensive response logic during opponent pressure',
  COOPERATIVE_CONTRACT: 'card compiles as trust-bearing cooperative transfer logic',
  RESCUE_INTERVENTION: 'card compiles as timed team stabilization or recovery logic',
  PRECISION_GHOSTING: 'card compiles as legend-gap or marker-sensitive precision logic',
  DISCIPLINE_CONTROL: 'card compiles as variance-control and outcome-floor management',
  SYSTEM_OVERRIDE: 'card compiles as privileged or system-level override logic',
  MIXED: 'card spans multiple strategic classes and compiles as a mixed profile',
});

const COUNTERABILITY_REASON: Readonly<Record<Counterability, string>> = Object.freeze({
  NONE: 'card is not counter-classified',
  SOFT: 'card is soft-counterable in combat or negotiation lanes',
  HARD: 'card is hard-counterable in combat or negotiation lanes',
});

const TARGETING_REASON: Readonly<Record<Targeting, string>> = Object.freeze({
  SELF: 'card primarily affects the acting player state',
  OPPONENT: 'card is targeted at an opposing actor or their economy',
  TEAMMATE: 'card is targeted at a single ally',
  TEAM: 'card is targeted at a full cooperative team state',
  GLOBAL: 'card is treated as a system-wide or room-wide effect',
});

const SPECIAL_CARD_HINTS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  SYSTEMIC_OVERRIDE: Object.freeze([
    'systemic override implies full-system battle suppression semantics',
    'executor special rule will dormancy-reset hater runtime state',
  ]),
  CASCADE_BREAK: Object.freeze([
    'cascade break implies authoritative cascade chain cleanup',
    'executor special rule will clear active positive trackers and active chains',
  ]),
  BREAK_PACT: Object.freeze([
    'defection arc step 1 must remain coop-only and sequenced',
  ]),
  SILENT_EXIT: Object.freeze([
    'defection arc step 2 must remain coop-only and sequenced',
  ]),
  ASSET_SEIZURE: Object.freeze([
    'defection arc step 3 finalizes treasury theft and score penalty',
  ]),
});

interface WeightedTag {
  readonly raw: string;
  readonly tag: string;
  readonly weight: number;
}

interface CompilationContext {
  readonly definitionId: string;
  readonly instanceId: string;
  readonly cardName: string;
  readonly mode: ModeCode;
  readonly deckType: DeckType;
  readonly targeting: Targeting;
  readonly timingClass: readonly TimingClass[];
  readonly tags: readonly string[];
  readonly weightedTags: readonly WeightedTag[];
  readonly weightedTagStrings: readonly string[];
  readonly effect: Readonly<EffectPayload>;
  readonly appliedEffectModifier: number;
  readonly divergencePotential: DivergencePotential;
  readonly strategicClass: CompilerStrategicClass;
  readonly priorityBand: CompilerPriorityBand;
  readonly witnessHint: CompilerChannelWitnessHint;
  readonly determinismKey: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stableUniqueStrings(
  input: readonly string[],
  limit: number = MAX_STRING_LIST,
): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const entry of input) {
    const normalized = String(entry).trim();
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
    if (output.length >= limit) {
      break;
    }
  }

  return output;
}

function stableUniqueTimingClasses(input: readonly TimingClass[]): TimingClass[] {
  return stableUniqueStrings(input as readonly string[]) as TimingClass[];
}

function joinKey(parts: readonly (string | number | boolean | null | undefined)[]): string {
  return parts
    .map((part) => (part === null || part === undefined ? '∅' : String(part)))
    .join('|');
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function createDeterministicId(namespace: string, parts: readonly (string | number | boolean | null | undefined)[]): string {
  return `${namespace}_${hashString(joinKey(parts))}`;
}

function normalizeEffectModifier(raw: number): number {
  return clamp(round6(raw), 0, MAX_EFFECT_MULTIPLIER);
}

function parseEffectModifier(tags: readonly string[]): number {
  for (let index = tags.length - 1; index >= 0; index -= 1) {
    const tag = tags[index];
    if (!tag.startsWith(EFFECT_MULTIPLIER_PREFIX)) {
      continue;
    }

    const parsed = Number(tag.slice(EFFECT_MULTIPLIER_PREFIX.length));
    if (!Number.isFinite(parsed)) {
      return 1;
    }

    return normalizeEffectModifier(parsed);
  }

  return 1;
}

function parseWeightedTags(tags: readonly string[]): WeightedTag[] {
  const parsed: WeightedTag[] = [];
  const seen = new Set<string>();

  for (const tag of tags) {
    const normalized = String(tag).trim();
    if (normalized.length === 0 || normalized.startsWith(EFFECT_MULTIPLIER_PREFIX)) {
      continue;
    }

    const delimiterIndex = normalized.lastIndexOf(WEIGHTED_TAG_DELIMITER);
    if (delimiterIndex <= 0 || delimiterIndex === normalized.length - 1) {
      continue;
    }

    const left = normalized.slice(0, delimiterIndex).trim();
    const right = normalized.slice(delimiterIndex + 1).trim();
    const numeric = Number(right);

    if (!left || !Number.isFinite(numeric)) {
      continue;
    }

    const key = `${left}:${round4(numeric)}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    parsed.push({
      raw: normalized,
      tag: left,
      weight: round4(numeric),
    });
  }

  return parsed;
}

function normalizeStringList(
  value: readonly string[] | undefined,
  itemLimit: number,
  charLimit: number,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const sanitized = value
    .map((entry) => String(entry).trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => entry.slice(0, charLimit));

  return stableUniqueStrings(sanitized, itemLimit);
}

function normalizeCascadeTag(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.slice(0, MAX_CASCADE_TAG_LENGTH);
}

function normalizeNamedAction(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.slice(0, MAX_NAMED_ACTION_LENGTH);
}

function hasAnyTag(tags: readonly string[], candidates: readonly string[]): boolean {
  const tagSet = new Set(tags);
  return candidates.some((candidate) => tagSet.has(candidate));
}

function inferStrategicClass(
  mode: ModeCode,
  deckType: DeckType,
  tags: readonly string[],
  timingClass: readonly TimingClass[],
): CompilerStrategicClass {
  const deckClass = STRATEGIC_CLASS_BY_DECK[deckType];

  if (mode === 'ghost') {
    if (deckType === 'DISCIPLINE') {
      return 'DISCIPLINE_CONTROL';
    }
    if (deckType === 'GHOST' || hasAnyTag(tags, ['divergence', 'precision'])) {
      return 'PRECISION_GHOSTING';
    }
  }

  if (mode === 'coop') {
    if (timingClass.includes('RES') || deckType === 'RESCUE') {
      return 'RESCUE_INTERVENTION';
    }
    if (hasAnyTag(tags, ['trust', 'aid']) || deckType === 'AID' || deckType === 'TRUST') {
      return 'COOPERATIVE_CONTRACT';
    }
  }

  if (mode === 'pvp') {
    if (deckType === 'COUNTER' || timingClass.includes('CTR') || hasAnyTag(tags, ['counter'])) {
      return 'COUNTERPLAY';
    }
    if (deckType === 'SABOTAGE' || deckType === 'BLUFF' || hasAnyTag(tags, ['sabotage'])) {
      return 'PREDATORY_COMBAT';
    }
  }

  if (deckType === 'PRIVILEGED') {
    return 'SYSTEM_OVERRIDE';
  }

  if (deckType === 'FUBAR' || deckType === 'MISSED_OPPORTUNITY' || deckType === 'SO') {
    return 'PRESSURE_RESPONSE';
  }

  if (deckType === 'OPPORTUNITY') {
    return 'CAPITAL_ALLOCATION';
  }

  if (deckType === 'IPA') {
    return 'COMPOUNDING';
  }

  return deckClass ?? 'MIXED';
}

function inferPriorityBand(
  deckType: DeckType,
  timingClass: readonly TimingClass[],
  strategicClass: CompilerStrategicClass,
): CompilerPriorityBand {
  if (timingClass.length === 0) {
    return 'FOUNDATION';
  }

  if (
    strategicClass === 'PRECISION_GHOSTING' ||
    strategicClass === 'SYSTEM_OVERRIDE' ||
    timingClass.includes('END') ||
    timingClass.includes('GBM') ||
    timingClass.includes('PHZ')
  ) {
    return 'RITUAL';
  }

  if (deckType === 'BLUFF') {
    return 'SHADOW';
  }

  return timingClass
    .map((entry) => PRIORITY_BAND_BY_TIMING[entry])
    .sort((left, right) => PRIORITY_SCORE_BY_BAND[right] - PRIORITY_SCORE_BY_BAND[left])[0] ?? 'FOUNDATION';
}

function inferWitnessHint(
  mode: ModeCode,
  deckType: DeckType,
  strategicClass: CompilerStrategicClass,
): CompilerChannelWitnessHint {
  if (deckType === 'BLUFF') {
    return 'SYSTEM_SHADOW';
  }

  if (strategicClass === 'RESCUE_INTERVENTION') {
    return mode === 'coop' ? 'SYNDICATE' : 'POST_RUN';
  }

  return WITNESS_HINT_BY_MODE[mode];
}

function inferDivergencePotential(card: CardInstance): DivergencePotential {
  return card.divergencePotential;
}

function createBaseTraceEntry(
  phase: CompilationTraceEntry['phase'],
  level: CompilationTraceEntry['level'],
  code: string,
  message: string,
  detail?: Readonly<Record<string, unknown>>,
): CompilationTraceEntry {
  return {
    traceId: createDeterministicId('trace', [phase, level, code, message, detail ? JSON.stringify(detail) : '']),
    phase,
    level,
    code,
    message,
    detail,
  };
}

function sortOperations(operations: readonly CompiledOperation[]): CompiledOperation[] {
  return [...operations].sort((left, right) => {
    const leftOrder = EXECUTION_ORDER_BY_KIND[left.kind];
    const rightOrder = EXECUTION_ORDER_BY_KIND[right.kind];

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    if (left.sourceField !== right.sourceField) {
      return left.sourceField.localeCompare(right.sourceField);
    }

    return left.operationId.localeCompare(right.operationId);
  });
}

function sortDeferredRequirements(
  requirements: readonly DeferredCompiledRequirement[],
): DeferredCompiledRequirement[] {
  return [...requirements].sort((left, right) => {
    if (left.field !== right.field) {
      return left.field.localeCompare(right.field);
    }

    return left.requirementId.localeCompare(right.requirementId);
  });
}

function scaleMagnitude(
  kind: NumericOperationKind,
  value: number,
  multiplier: number,
): number {
  const scaled = value * multiplier;

  if (kind === 'divergence') {
    return round4(scaled);
  }

  if (kind === 'time') {
    return Math.round(scaled);
  }

  return Math.round(scaled);
}

function createDeterminismKey(
  card: CardInstance,
  weightedTags: readonly WeightedTag[],
  effectModifier: number,
): string {
  return joinKey([
    card.instanceId,
    card.definitionId,
    card.overlayAppliedForMode,
    card.cost,
    effectModifier,
    card.targeting,
    card.divergencePotential,
    card.timingClass.join(','),
    card.tags.join(','),
    weightedTags.map((entry) => `${entry.tag}:${entry.weight}`).join(','),
  ]);
}

function buildContext(card: CardInstance): CompilationContext {
  const effectModifier = parseEffectModifier(card.tags);
  const weightedTags = parseWeightedTags(card.tags);
  const weightedTagStrings = weightedTags.map((entry) => `${entry.tag}:${entry.weight}`);
  const strategicClass = inferStrategicClass(
    card.overlayAppliedForMode,
    card.card.deckType,
    card.tags,
    card.timingClass,
  );
  const priorityBand = inferPriorityBand(card.card.deckType, card.timingClass, strategicClass);
  const witnessHint = inferWitnessHint(
    card.overlayAppliedForMode,
    card.card.deckType,
    strategicClass,
  );

  return {
    definitionId: card.definitionId,
    instanceId: card.instanceId,
    cardName: card.card.name,
    mode: card.overlayAppliedForMode,
    deckType: card.card.deckType,
    targeting: card.targeting,
    timingClass: stableUniqueTimingClasses(card.timingClass),
    tags: stableUniqueStrings(card.tags, MAX_TAGS),
    weightedTags,
    weightedTagStrings,
    effect: Object.freeze({ ...card.card.baseEffect }),
    appliedEffectModifier: effectModifier,
    divergencePotential: inferDivergencePotential(card),
    strategicClass,
    priorityBand,
    witnessHint,
    determinismKey: createDeterminismKey(card, weightedTags, effectModifier),
  };
}

function buildCommonReasons(context: CompilationContext): string[] {
  const reasons: string[] = [];

  reasons.push(MODE_IDENTITY_TEXT[context.mode]);
  reasons.push(STRATEGIC_REASON_BY_CLASS[context.strategicClass]);
  reasons.push(TARGETING_REASON[context.targeting]);
  reasons.push(COUNTERABILITY_REASON[contextHasCounterability(context)]);

  for (const timingClass of context.timingClass) {
    reasons.push(TIMING_REASON_BY_CLASS[timingClass]);
  }

  for (const hint of SPECIAL_CARD_HINTS[context.definitionId] ?? []) {
    reasons.push(hint);
  }

  if (context.weightedTagStrings.length > 0) {
    reasons.push(`weighted tags detected: ${context.weightedTagStrings.join(', ')}`);
  }

  reasons.push(`overlay effect modifier locked at ${context.appliedEffectModifier}`);
  reasons.push(`divergence potential classified as ${context.divergencePotential}`);

  return stableUniqueStrings(reasons, MAX_TRACE_REASONS);
}

function contextHasCounterability(context: CompilationContext): Counterability {
  return contextFromCounterabilityLookup[context.definitionId] ?? 'NONE';
}

const contextFromCounterabilityLookup: Record<string, Counterability> = Object.create(null);

function rememberCounterability(card: CardInstance): void {
  contextFromCounterabilityLookup[card.definitionId] = card.card.counterability;
}

function createOperationMeta(
  context: CompilationContext,
  sourceField: SupportedEffectField,
  executionOrder: number,
  extraReasons: readonly string[] = [],
): CompiledOperationMeta {
  return {
    operationId: createDeterministicId('op', [
      context.determinismKey,
      sourceField,
      executionOrder,
    ]),
    status: 'EXECUTABLE',
    sourceField,
    definitionId: context.definitionId,
    instanceId: context.instanceId,
    cardName: context.cardName,
    mode: context.mode,
    deckType: context.deckType,
    targeting: context.targeting,
    timingClass: context.timingClass,
    appliedEffectModifier: context.appliedEffectModifier,
    weightedTags: context.weightedTagStrings,
    traceReasons: stableUniqueStrings(
      [...buildCommonReasons(context), ...extraReasons],
      MAX_TRACE_REASONS,
    ),
    strategicClass: context.strategicClass,
    priorityBand: context.priorityBand,
    witnessHint: context.witnessHint,
    divergencePotential: context.divergencePotential,
    executionOrder,
  };
}

function createDeferredRequirement(
  context: CompilationContext,
  field: DeferredEffectField,
  payload: number | string | readonly string[] | null,
  extraReasons: readonly string[] = [],
): DeferredCompiledRequirement {
  return {
    requirementId: createDeterministicId('deferred', [
      context.determinismKey,
      field,
      typeof payload === 'string'
        ? payload
        : Array.isArray(payload)
          ? payload.join(',')
          : String(payload),
    ]),
    status: 'DEFERRED',
    field,
    definitionId: context.definitionId,
    instanceId: context.instanceId,
    mode: context.mode,
    deckType: context.deckType,
    strategicClass: context.strategicClass,
    witnessHint: context.witnessHint,
    traceReasons: stableUniqueStrings(
      [...buildCommonReasons(context), ...extraReasons],
      MAX_TRACE_REASONS,
    ),
    payload,
  };
}

function createNumericOperation(
  context: CompilationContext,
  kind: NumericOperationKind,
  field: SupportedEffectField,
  value: number,
): CompiledOperation | null {
  const finite = asFiniteNumber(value);
  if (finite === null || finite === 0) {
    return null;
  }

  const scaled = scaleMagnitude(kind, finite, context.appliedEffectModifier);
  if (scaled === 0) {
    return null;
  }

  const polarity = scaled > 0 ? 'positive delta compiled' : 'negative delta compiled';

  return {
    ...createOperationMeta(context, field, EXECUTION_ORDER_BY_KIND[kind], [
      `${field} compiled into ${kind}`,
      `${polarity}: ${scaled}`,
      `source magnitude ${finite} scaled by effect modifier ${context.appliedEffectModifier}`,
    ]),
    kind,
    magnitude: scaled,
  };
}

function compileNumericOperations(context: CompilationContext): CompiledOperation[] {
  const operations: CompiledOperation[] = [];
  const effect = context.effect;

  for (const field of SUPPORTED_NUMERIC_FIELDS) {
    const expectedKind = resolveSupportedKindForField(field);

    switch (field) {
      case 'cashDelta': {
        const operation = createNumericOperation(context, expectedKind ?? 'cash', field, effect.cashDelta ?? 0);
        if (operation) {
          operations.push(operation);
        }
        break;
      }
      case 'incomeDelta': {
        const operation = createNumericOperation(context, expectedKind ?? 'income', field, effect.incomeDelta ?? 0);
        if (operation) {
          operations.push(operation);
        }
        break;
      }
      case 'shieldDelta': {
        const operation = createNumericOperation(context, expectedKind ?? 'shield', field, effect.shieldDelta ?? 0);
        if (operation) {
          operations.push(operation);
        }
        break;
      }
      case 'heatDelta': {
        const operation = createNumericOperation(context, expectedKind ?? 'heat', field, effect.heatDelta ?? 0);
        if (operation) {
          operations.push(operation);
        }
        break;
      }
      case 'trustDelta': {
        const operation = createNumericOperation(context, expectedKind ?? 'trust', field, effect.trustDelta ?? 0);
        if (operation) {
          operations.push(operation);
        }
        break;
      }
      case 'timeDeltaMs': {
        const operation = createNumericOperation(context, expectedKind ?? 'time', field, effect.timeDeltaMs ?? 0);
        if (operation) {
          operations.push(operation);
        }
        break;
      }
      case 'divergenceDelta': {
        const operation = createNumericOperation(context, expectedKind ?? 'divergence', field, effect.divergenceDelta ?? 0);
        if (operation) {
          operations.push(operation);
        }
        break;
      }
      default:
        break;
    }
  }

  return operations;
}

function compileCascadeOperation(context: CompilationContext): CompiledOperation[] {
  const cascadeTag = normalizeCascadeTag(context.effect.cascadeTag);
  if (!cascadeTag) {
    return [];
  }

  return [
    {
      ...createOperationMeta(context, 'cascadeTag', EXECUTION_ORDER_BY_KIND.cascadeTag, [
        'cascade tag preserved for authoritative cascade engine handling',
        `cascade tag compiled as ${cascadeTag}`,
      ]),
      kind: 'cascadeTag',
      magnitude: cascadeTag,
    },
  ];
}

function compileInjectOperation(context: CompilationContext): CompiledOperation[] {
  const injectCards = normalizeStringList(
    context.effect.injectCards,
    MAX_STRING_LIST,
    MAX_INJECT_CARD_ID_LENGTH,
  );

  if (injectCards.length === 0) {
    return [];
  }

  return [
    {
      ...createOperationMeta(context, 'injectCards', EXECUTION_ORDER_BY_KIND.inject, [
        'card injection list preserved for backend draw-history / injection handling',
        `inject list size ${injectCards.length}`,
      ]),
      kind: 'inject',
      magnitude: injectCards,
    },
  ];
}

function compileDeferredRequirements(context: CompilationContext): DeferredCompiledRequirement[] {
  const effect = context.effect;
  const requirements: DeferredCompiledRequirement[] = [];

  const numericDeferredMap: Readonly<Record<
    Exclude<DeferredEffectField, 'exhaustCards' | 'grantBadges' | 'namedActionId'>,
    number | undefined
  >> = Object.freeze({
    debtDelta: effect.debtDelta,
    expenseDelta: effect.expenseDelta,
    treasuryDelta: effect.treasuryDelta,
    battleBudgetDelta: effect.battleBudgetDelta,
    holdChargeDelta: effect.holdChargeDelta,
    counterIntelDelta: effect.counterIntelDelta,
  });

  for (const [field, value] of Object.entries(numericDeferredMap) as Array<[
    Exclude<DeferredEffectField, 'exhaustCards' | 'grantBadges' | 'namedActionId'>,
    number | undefined,
  ]>) {
    const finite = asFiniteNumber(value);
    if (finite === null || finite === 0) {
      continue;
    }

    requirements.push(
      createDeferredRequirement(context, field, scaleDeferredMagnitude(finite, context.appliedEffectModifier), [
        `${field} exists in EffectPayload but is not executable by current CardEffectExecutor`,
        'deferred requirement emitted so no backend effect field disappears silently',
      ]),
    );
  }

  const exhaustCards = normalizeStringList(effect.exhaustCards, MAX_STRING_LIST, MAX_INJECT_CARD_ID_LENGTH);
  if (exhaustCards.length > 0) {
    requirements.push(
      createDeferredRequirement(context, 'exhaustCards', exhaustCards, [
        'card exhaustion list requires executor support outside legacy operation kinds',
      ]),
    );
  }

  const grantBadges = normalizeStringList(effect.grantBadges, MAX_STRING_LIST, MAX_BADGE_LENGTH);
  if (grantBadges.length > 0) {
    requirements.push(
      createDeferredRequirement(context, 'grantBadges', grantBadges, [
        'badge grant list is preserved for future sovereignty / proof dispatch',
      ]),
    );
  }

  const namedActionId = normalizeNamedAction(effect.namedActionId);
  if (namedActionId) {
    requirements.push(
      createDeferredRequirement(context, 'namedActionId', namedActionId, [
        'named action preserved for future engine authority integration',
      ]),
    );
  }

  return sortDeferredRequirements(requirements);
}

function scaleDeferredMagnitude(value: number, multiplier: number): number {
  return round4(value * multiplier);
}

function createValidationTrace(card: CardInstance): CompilationTraceEntry[] {
  const trace: CompilationTraceEntry[] = [];

  if (card.definitionId !== card.card.id) {
    trace.push(
      createBaseTraceEntry(
        'VALIDATE',
        'WARN',
        'CARD_DEFINITION_ID_MISMATCH',
        'card instance definitionId differs from embedded card.id; embedded card.id remains the schema authority',
        {
          definitionId: card.definitionId,
          embeddedId: card.card.id,
        },
      ),
    );
  }

  if (card.cost < 0) {
    trace.push(
      createBaseTraceEntry(
        'VALIDATE',
        'WARN',
        'NEGATIVE_COST',
        'negative cost detected; compiler remains deterministic but downstream legality should reject unaffordable anomalies',
        { cost: card.cost },
      ),
    );
  }

  if (card.timingClass.length === 0) {
    trace.push(
      createBaseTraceEntry(
        'VALIDATE',
        'WARN',
        'EMPTY_TIMING_CLASS',
        'card instance has no timing class entries; compile will proceed with foundation default posture',
      ),
    );
  }

  return trace;
}

function createContextTrace(context: CompilationContext): CompilationTraceEntry[] {
  return [
    createBaseTraceEntry('CONTEXT', 'INFO', 'CONTEXT_BUILT', 'compilation context built from card instance and base effect payload', {
      mode: context.mode,
      deckType: context.deckType,
      targeting: context.targeting,
      timingClass: context.timingClass,
      strategicClass: context.strategicClass,
      priorityBand: context.priorityBand,
      witnessHint: context.witnessHint,
      effectModifier: context.appliedEffectModifier,
    }),
  ];
}

function createNormalizationTrace(context: CompilationContext): CompilationTraceEntry[] {
  const entries: CompilationTraceEntry[] = [];

  entries.push(
    createBaseTraceEntry(
      'NORMALIZE',
      'INFO',
      'TAGS_NORMALIZED',
      'tag list normalized into deterministic unique sequence',
      {
        tagCount: context.tags.length,
        weightedTagCount: context.weightedTagStrings.length,
      },
    ),
  );

  entries.push(
    createBaseTraceEntry(
      'NORMALIZE',
      'INFO',
      'DETERMINISM_KEY_BUILT',
      'overlay determinism key assembled from card instance and mode metadata',
      {
        determinismKey: context.determinismKey,
      },
    ),
  );

  return entries;
}

function createSupportedTrace(operations: readonly CompiledOperation[]): CompilationTraceEntry[] {
  return [
    createBaseTraceEntry(
      'COMPILE_SUPPORTED',
      'INFO',
      'SUPPORTED_OPERATIONS_COMPILED',
      'supported effect payload fields compiled into legacy executor-compatible operations',
      {
        kinds: operations.map((entry) => entry.kind),
        count: operations.length,
      },
    ),
  ];
}

function createDeferredTrace(
  requirements: readonly DeferredCompiledRequirement[],
): CompilationTraceEntry[] {
  if (requirements.length === 0) {
    return [
      createBaseTraceEntry(
        'COMPILE_DEFERRED',
        'INFO',
        'NO_DEFERRED_REQUIREMENTS',
        'no unsupported effect fields were present in this card payload',
      ),
    ];
  }

  return [
    createBaseTraceEntry(
      'COMPILE_DEFERRED',
      'WARN',
      'DEFERRED_REQUIREMENTS_EMITTED',
      'one or more effect payload fields require executor expansion beyond legacy operation kinds',
      {
        fields: requirements.map((entry) => entry.field),
        count: requirements.length,
      },
    ),
  ];
}

function createFinalizeTrace(
  context: CompilationContext,
  operations: readonly CompiledOperation[],
  requirements: readonly DeferredCompiledRequirement[],
): CompilationTraceEntry[] {
  return [
    createBaseTraceEntry(
      'FINALIZE',
      requirements.length > 0 ? 'WARN' : 'INFO',
      'COMPILATION_PLAN_READY',
      'final compilation plan is deterministic and ready for executor consumption or future authority routing',
      {
        definitionId: context.definitionId,
        instanceId: context.instanceId,
        supportedOperations: operations.length,
        deferredRequirements: requirements.length,
      },
    ),
  ];
}

function boundedTrace(entries: readonly CompilationTraceEntry[]): CompilationTraceEntry[] {
  return [...entries].slice(0, MAX_TRACE_ENTRIES);
}

function supportsLegacyExecution(field: SupportedEffectField | DeferredEffectField): boolean {
  return (
    field === 'cashDelta' ||
    field === 'incomeDelta' ||
    field === 'shieldDelta' ||
    field === 'heatDelta' ||
    field === 'trustDelta' ||
    field === 'timeDeltaMs' ||
    field === 'divergenceDelta' ||
    field === 'cascadeTag' ||
    field === 'injectCards'
  );
}

function validateEffectPayloadShape(context: CompilationContext): CompilationTraceEntry[] {
  const entries: CompilationTraceEntry[] = [];
  const effect = context.effect as Record<string, unknown>;

  const allKnownFields = new Set<string>([
    ...SUPPORTED_NUMERIC_FIELDS,
    'cascadeTag',
    'injectCards',
    ...DEFERRED_EFFECT_FIELDS,
  ]);

  for (const key of Object.keys(effect)) {
    if (!allKnownFields.has(key)) {
      entries.push(
        createBaseTraceEntry(
          'VALIDATE',
          'WARN',
          'UNKNOWN_EFFECT_FIELD',
          'effect payload contains an unknown field; compiler ignores it but surfaces the anomaly',
          { field: key },
        ),
      );
    }
  }

  return entries;
}

function inferSyntheticHints(context: CompilationContext): CompilationTraceEntry[] {
  const entries: CompilationTraceEntry[] = [];

  if (context.mode === 'pvp' && context.deckType === 'SABOTAGE' && context.targeting !== 'OPPONENT') {
    entries.push(
      createBaseTraceEntry(
        'VALIDATE',
        'WARN',
        'PVP_SABOTAGE_TARGETING',
        'pvp sabotage card is not opponent-targeted at compile time; targeting legality should be reviewed',
        { targeting: context.targeting },
      ),
    );
  }

  if (context.mode === 'coop' && hasAnyTag(context.tags, ['aid', 'trust']) && context.targeting === 'SELF') {
    entries.push(
      createBaseTraceEntry(
        'VALIDATE',
        'WARN',
        'COOP_CONTRACT_SELF_TARGET',
        'coop contract-tagged card is self-targeted; verify that this is intentional',
      ),
    );
  }

  if (context.mode === 'ghost' && context.divergencePotential === 'HIGH' && !context.timingClass.includes('GBM')) {
    entries.push(
      createBaseTraceEntry(
        'NORMALIZE',
        'INFO',
        'GHOST_HIGH_DIVERGENCE_NO_GBM',
        'high divergence card lacks a ghost benchmark timing lock; compile preserves the card but highlights the unusual posture',
      ),
    );
  }

  if (context.mode === 'solo' && context.timingClass.includes('PHZ')) {
    entries.push(
      createBaseTraceEntry(
        'NORMALIZE',
        'INFO',
        'SOLO_PHASE_BOUNDARY_CARD',
        'solo phase-boundary card compiled as ritual timing instrument',
      ),
    );
  }

  return entries;
}

function buildOperationKinds(operations: readonly CompiledOperation[]): string[] {
  return stableUniqueStrings(operations.map((entry) => entry.kind));
}

function buildDefinitionIdentity(card: CardDefinition): string {
  return joinKey([
    card.id,
    card.name,
    card.deckType,
    card.baseCost,
    card.rarity,
    card.autoResolve,
    card.counterability,
    card.targeting,
    card.educationalTag,
    card.timingClass.join(','),
    card.tags.join(','),
  ]);
}

function createCompilerFootprint(context: CompilationContext, card: CardInstance): string {
  return createDeterministicId('compiler', [
    context.determinismKey,
    buildDefinitionIdentity(card.card),
    supportsLegacyExecution('cashDelta'),
  ]);
}

export class CardEffectCompiler {
  public compile(card: CardInstance): CompiledOperation[] {
    return this.compileDetailed(card).supportedOperations.slice();
  }

  public compileDetailed(card: CardInstance): CardCompilationPlan {
    rememberCounterability(card);

    const validationTrace = createValidationTrace(card);
    const context = buildContext(card);
    const contextTrace = createContextTrace(context);
    const normalizationTrace = createNormalizationTrace(context);
    const payloadShapeTrace = validateEffectPayloadShape(context);
    const syntheticHints = inferSyntheticHints(context);

    const operations = sortOperations([
      ...compileNumericOperations(context),
      ...compileCascadeOperation(context),
      ...compileInjectOperation(context),
    ]);

    const deferredRequirements = compileDeferredRequirements(context);
    const supportedTrace = createSupportedTrace(operations);
    const deferredTrace = createDeferredTrace(deferredRequirements);
    const finalizeTrace = createFinalizeTrace(context, operations, deferredRequirements);

    const trace = boundedTrace([
      ...validationTrace,
      ...contextTrace,
      ...normalizationTrace,
      ...payloadShapeTrace,
      ...syntheticHints,
      ...supportedTrace,
      ...deferredTrace,
      ...finalizeTrace,
    ]);

    return {
      instanceId: context.instanceId,
      definitionId: context.definitionId,
      mode: context.mode,
      deckType: context.deckType,
      appliedEffectModifier: context.appliedEffectModifier,
      supportedOperations: operations,
      deferredRequirements,
      trace,
      operationKinds: buildOperationKinds(operations),
      strategicClass: context.strategicClass,
      priorityBand: context.priorityBand,
      witnessHint: context.witnessHint,
      weightedTags: context.weightedTagStrings,
      canonicalTimingClass: context.timingClass,
      targeting: context.targeting,
      overlayDeterminismKey: createCompilerFootprint(context, card),
      unsupportedFieldCount: deferredRequirements.length,
    };
  }

  public compileSupportedKinds(card: CardInstance): ReadonlySet<CompiledOperation['kind']> {
    return new Set(this.compile(card).map((entry) => entry.kind));
  }

  public hasDeferredRequirements(card: CardInstance): boolean {
    return this.compileDetailed(card).deferredRequirements.length > 0;
  }

  public compileDeferredMap(
    card: CardInstance,
  ): Readonly<Record<DeferredEffectField, number | string | readonly string[] | null>> {
    const deferred = this.compileDetailed(card).deferredRequirements;
    const output: Partial<Record<DeferredEffectField, number | string | readonly string[] | null>> = {};

    for (const requirement of deferred) {
      output[requirement.field] = requirement.payload;
    }

    for (const field of DEFERRED_EFFECT_FIELDS) {
      if (!(field in output)) {
        output[field] = null;
      }
    }

    return Object.freeze(output as Record<DeferredEffectField, number | string | readonly string[] | null>);
  }

  public summarize(card: CardInstance): string {
    const plan = this.compileDetailed(card);
    const operationList =
      plan.supportedOperations.length === 0
        ? 'no executable operations'
        : plan.supportedOperations.map((entry) => entry.kind).join(', ');
    const deferredList =
      plan.deferredRequirements.length === 0
        ? 'no deferred requirements'
        : plan.deferredRequirements.map((entry) => entry.field).join(', ');

    return [
      `${plan.definitionId}@${plan.mode}`,
      `strategy=${plan.strategicClass}`,
      `priority=${plan.priorityBand}`,
      `ops=[${operationList}]`,
      `deferred=[${deferredList}]`,
      `effectModifier=${plan.appliedEffectModifier}`,
    ].join(' ');
  }

  public assertDeterministic(card: CardInstance): void {
    const first = this.compileDetailed(card);
    const second = this.compileDetailed(card);

    const firstKey = JSON.stringify(first);
    const secondKey = JSON.stringify(second);

    if (firstKey !== secondKey) {
      throw new Error(
        `CardEffectCompiler determinism violation for ${card.definitionId} (${card.instanceId}).`,
      );
    }
  }

  // ─── Batch Compilation ─────────────────────────────────────────────────────

  /**
   * Compile a batch of cards and return plans in execution-priority order.
   * Cards with lower priority score (FOUNDATION → TACTICAL → RITUAL → SHADOW)
   * come first so the executor pipeline can process them in declared doctrine order.
   */
  public compileBatch(cards: readonly CardInstance[]): readonly CardCompilationPlan[] {
    const plans = cards.map((c) => this.compileDetailed(c));
    return plans.slice().sort((a, b) => {
      const scoreA = PRIORITY_SCORE_BY_BAND[a.priorityBand] ?? 99;
      const scoreB = PRIORITY_SCORE_BY_BAND[b.priorityBand] ?? 99;
      if (scoreA !== scoreB) return scoreA - scoreB;
      // secondary: by executionOrder of first supported operation
      const firstA = a.supportedOperations[0]?.executionOrder ?? 999;
      const firstB = b.supportedOperations[0]?.executionOrder ?? 999;
      return firstA - firstB;
    });
  }

  /**
   * Compile many cards and return only those whose priorityBand matches the
   * supplied band. Useful for drama systems that want SHADOW-band cards only.
   */
  public compileBatchByBand(
    cards: readonly CardInstance[],
    band: CompilerPriorityBand,
  ): readonly CardCompilationPlan[] {
    return this.compileBatch(cards).filter((p) => p.priorityBand === band);
  }

  /**
   * Compile many cards and return only those whose strategicClass matches.
   * Drama / NPC orchestration queries for specific strategic flavour.
   */
  public compileBatchByStrategicClass(
    cards: readonly CardInstance[],
    strategicClass: CompilerStrategicClass,
  ): readonly CardCompilationPlan[] {
    return this.compileBatch(cards).filter((p) => p.strategicClass === strategicClass);
  }

  /**
   * Compile many cards and return only those whose witnessHint matches.
   * Chat routing can ask "which cards should be announced on SYNDICATE channel?"
   */
  public compileBatchByWitnessHint(
    cards: readonly CardInstance[],
    witnessHint: CompilerChannelWitnessHint,
  ): readonly CardCompilationPlan[] {
    return this.compileBatch(cards).filter((p) => p.witnessHint === witnessHint);
  }

  /**
   * Compile a batch and return a keyed map from instanceId → plan.
   * Executor pipeline uses this to O(1) look-up a plan before dispatching.
   */
  public compileBatchAsMap(
    cards: readonly CardInstance[],
  ): ReadonlyMap<string, CardCompilationPlan> {
    const map = new Map<string, CardCompilationPlan>();
    for (const card of cards) {
      map.set(card.instanceId, this.compileDetailed(card));
    }
    return map;
  }

  // ─── UX Signal Payloads ────────────────────────────────────────────────────

  /**
   * Build a minimal UX-ready signal payload for a compiled card.
   * The frontend can consume this directly to render card play feedback —
   * it describes the human-readable effect summary, the channel the play
   * should be announced on, and the drama-tone for the NPC reaction.
   */
  public buildUxSignalPayload(card: CardInstance): CardUxSignalPayload {
    const plan = this.compileDetailed(card);

    const numericSummary = plan.supportedOperations
      .filter((op): op is CompiledOperation & { kind: NumericOperationKind; magnitude: number } =>
        typeof (op as { magnitude: unknown }).magnitude === 'number',
      )
      .map((op) => {
        const sign = (op.magnitude as number) >= 0 ? '+' : '';
        return `${sign}${op.magnitude} ${op.kind}`;
      })
      .join(', ');

    const injectSummary = plan.supportedOperations
      .filter((op) => op.kind === 'inject')
      .map((op) => `inject [${(op as CompiledOperation & { kind: 'inject'; magnitude: readonly string[] }).magnitude.join(', ')}]`)
      .join(', ');

    const cascadeSummary = plan.supportedOperations
      .filter((op) => op.kind === 'cascadeTag')
      .map((op) => `cascade:${(op as CompiledOperation & { kind: 'cascadeTag'; magnitude: string }).magnitude}`)
      .join(', ');

    const parts = [numericSummary, injectSummary, cascadeSummary].filter(Boolean);
    const effectSummary = parts.length > 0 ? parts.join(' | ') : 'no immediate effects';

    const dramaIntensity = resolveDramaIntensity(plan);
    const toneLine = buildModeToneLine(plan.mode, plan.strategicClass);

    return Object.freeze({
      instanceId: plan.instanceId,
      definitionId: plan.definitionId,
      mode: plan.mode,
      channelHint: plan.witnessHint,
      priorityBand: plan.priorityBand,
      strategicClass: plan.strategicClass,
      effectSummary,
      toneLine,
      dramaIntensity,
      hasDeferredWork: plan.deferredRequirements.length > 0,
      deferredCount: plan.deferredRequirements.length,
      operationCount: plan.supportedOperations.length,
      weightedTags: plan.weightedTags,
    });
  }

  /**
   * Build UX signal payloads for an entire batch, sorted by drama intensity
   * descending so the most impactful plays surface first in any feed.
   */
  public buildBatchUxSignals(
    cards: readonly CardInstance[],
  ): readonly CardUxSignalPayload[] {
    return cards
      .map((c) => this.buildUxSignalPayload(c))
      .sort((a, b) => b.dramaIntensity - a.dramaIntensity);
  }

  // ─── Narrative Hints ───────────────────────────────────────────────────────

  /**
   * Build a narrative hint block for a card play.
   * This is what NPC chat commentary and drama-director systems consume
   * to generate contextual dialogue lines that react to the card played.
   */
  public buildNarrativeHint(card: CardInstance): CardNarrativeHint {
    const plan = this.compileDetailed(card);
    const strategicReason = STRATEGIC_REASON_BY_CLASS[plan.strategicClass];
    const timingReasons = plan.canonicalTimingClass.map(
      (tc) => TIMING_REASON_BY_CLASS[tc] ?? `timing class ${tc}`,
    );

    const deferredFields = plan.deferredRequirements.map((d) => d.field);
    const immediateKinds = plan.supportedOperations.map((op) => op.kind);
    const modeText = MODE_IDENTITY_TEXT[plan.mode];

    const narrativeVerb = resolveNarrativeVerb(plan.strategicClass, plan.mode);
    const witnessNarrative = resolveWitnessNarrative(plan.witnessHint);
    const intensityLabel = resolveIntensityLabel(plan);

    return Object.freeze({
      instanceId: plan.instanceId,
      definitionId: plan.definitionId,
      mode: plan.mode,
      strategicReason,
      timingReasons: Object.freeze(timingReasons),
      deferredFields: Object.freeze(deferredFields),
      immediateKinds: Object.freeze(immediateKinds),
      modeText,
      narrativeVerb,
      witnessNarrative,
      intensityLabel,
      weightedTags: plan.weightedTags,
      channelHint: plan.witnessHint,
    });
  }

  /**
   * Build narrative hints for a batch of cards.
   * Chat / drama systems can snapshot the full hand's narrative context before
   * any single play, enabling "what would they play next?" advisory logic.
   */
  public buildBatchNarrativeHints(
    cards: readonly CardInstance[],
  ): readonly CardNarrativeHint[] {
    return cards.map((c) => this.buildNarrativeHint(c));
  }

  // ─── Compilation Diffs ─────────────────────────────────────────────────────

  /**
   * Diff two compilation plans and return a structured delta.
   * Used by the replay system and by test harnesses to assert that overlay
   * changes produced the expected modification to a compiled plan.
   */
  public diffPlans(
    before: CardCompilationPlan,
    after: CardCompilationPlan,
  ): CardCompilationDiff {
    const operationCountDelta = after.supportedOperations.length - before.supportedOperations.length;
    const deferredCountDelta = after.deferredRequirements.length - before.deferredRequirements.length;

    const strategicClassChanged = before.strategicClass !== after.strategicClass;
    const priorityBandChanged = before.priorityBand !== after.priorityBand;
    const witnessHintChanged = before.witnessHint !== after.witnessHint;
    const modifierChanged = before.appliedEffectModifier !== after.appliedEffectModifier;
    const overlayKeyChanged = before.overlayDeterminismKey !== after.overlayDeterminismKey;

    const addedOperationKinds = after.operationKinds.filter(
      (k) => !before.operationKinds.includes(k),
    );
    const removedOperationKinds = before.operationKinds.filter(
      (k) => !after.operationKinds.includes(k),
    );

    const modifierDelta = round4(after.appliedEffectModifier - before.appliedEffectModifier);

    const changed =
      strategicClassChanged ||
      priorityBandChanged ||
      witnessHintChanged ||
      modifierChanged ||
      overlayKeyChanged ||
      operationCountDelta !== 0 ||
      deferredCountDelta !== 0;

    return Object.freeze({
      instanceId: before.instanceId,
      definitionId: before.definitionId,
      changed,
      overlayKeyChanged,
      modifierChanged,
      modifierDelta,
      strategicClassChanged,
      beforeStrategicClass: before.strategicClass,
      afterStrategicClass: after.strategicClass,
      priorityBandChanged,
      beforePriorityBand: before.priorityBand,
      afterPriorityBand: after.priorityBand,
      witnessHintChanged,
      beforeWitnessHint: before.witnessHint,
      afterWitnessHint: after.witnessHint,
      operationCountDelta,
      deferredCountDelta,
      addedOperationKinds: Object.freeze(addedOperationKinds),
      removedOperationKinds: Object.freeze(removedOperationKinds),
    });
  }

  /**
   * Recompile a card and diff against a previously captured plan.
   * Convenience wrapper for the replay / proof pipeline.
   */
  public recompileAndDiff(
    card: CardInstance,
    previousPlan: CardCompilationPlan,
  ): CardCompilationDiff {
    const newPlan = this.compileDetailed(card);
    return this.diffPlans(previousPlan, newPlan);
  }

  // ─── Deferred Payload Validation ───────────────────────────────────────────

  /**
   * Validate that every deferred requirement in a plan has a non-null payload.
   * The executor must reject plans with null deferred payloads before dispatch.
   */
  public validateDeferredPayloads(
    plan: CardCompilationPlan,
  ): DeferredPayloadValidationResult {
    const missing: string[] = [];
    const present: string[] = [];

    for (const req of plan.deferredRequirements) {
      if (req.payload === null || req.payload === undefined) {
        missing.push(`${req.field}@${req.requirementId}`);
      } else {
        present.push(`${req.field}@${req.requirementId}`);
      }
    }

    const valid = missing.length === 0;
    return Object.freeze({
      instanceId: plan.instanceId,
      definitionId: plan.definitionId,
      valid,
      presentCount: present.length,
      missingCount: missing.length,
      missingRequirements: Object.freeze(missing),
      presentRequirements: Object.freeze(present),
      summary: valid
        ? `${plan.definitionId}: all ${present.length} deferred payloads present`
        : `${plan.definitionId}: ${missing.length} deferred payloads missing — ${missing.join(', ')}`,
    });
  }

  /**
   * Validate deferred payloads directly from a CardInstance without
   * requiring a pre-computed plan.
   */
  public validateCardDeferredPayloads(card: CardInstance): DeferredPayloadValidationResult {
    return this.validateDeferredPayloads(this.compileDetailed(card));
  }

  // ─── Mode Tone Classification ──────────────────────────────────────────────

  /**
   * Classify the tone of a card play for a given mode.
   * Returns a rich tone descriptor that the chat drama director uses to
   * select NPC reactions, ambient sound cues, and UI chromatic accents.
   */
  public classifyModeTone(card: CardInstance): CardModeToneClassification {
    const plan = this.compileDetailed(card);
    return classifyPlanModeTone(plan);
  }

  /**
   * Classify tone for a batch — returns a map from instanceId → tone.
   */
  public classifyBatchModeTone(
    cards: readonly CardInstance[],
  ): ReadonlyMap<string, CardModeToneClassification> {
    const map = new Map<string, CardModeToneClassification>();
    for (const card of cards) {
      map.set(card.instanceId, this.classifyModeTone(card));
    }
    return map;
  }

  // ─── Witness Routing Helpers ───────────────────────────────────────────────

  /**
   * Given a hand of cards, return only those that should be witnessed on
   * a particular chat channel. Used by the chat-drama wiring to decide which
   * card play announcements route to which room.
   */
  public filterByWitnessChannel(
    cards: readonly CardInstance[],
    channel: CompilerChannelWitnessHint,
  ): readonly CardInstance[] {
    return cards.filter((c) => {
      const plan = this.compileDetailed(c);
      return plan.witnessHint === channel;
    });
  }

  /**
   * Return a map of channel → instances that should be announced there.
   * Chat orchestrator uses this at play-time to fanout announcements.
   */
  public groupByWitnessChannel(
    cards: readonly CardInstance[],
  ): ReadonlyMap<CompilerChannelWitnessHint, readonly CardInstance[]> {
    const groups = new Map<CompilerChannelWitnessHint, CardInstance[]>();
    for (const card of cards) {
      const plan = this.compileDetailed(card);
      const hint = plan.witnessHint;
      if (!groups.has(hint)) groups.set(hint, []);
      groups.get(hint)!.push(card);
    }
    const frozen = new Map<CompilerChannelWitnessHint, readonly CardInstance[]>();
    for (const [k, v] of groups) {
      frozen.set(k, Object.freeze(v));
    }
    return frozen;
  }

  // ─── Divergence Analysis ───────────────────────────────────────────────────

  /**
   * Analyze divergence potential across a hand of cards.
   * Returns a summary used by the UI to display a "volatility meter" and by
   * the NPC drama director to pick tension-escalation commentary.
   */
  public analyzeDivergencePotential(
    cards: readonly CardInstance[],
  ): DivergenceAnalysis {
    const plans = cards.map((c) => this.compileDetailed(c));

    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    for (const plan of plans) {
      const firstOp = plan.supportedOperations[0];
      if (firstOp) {
        const dp = firstOp.divergencePotential;
        if (dp === 'HIGH') highCount++;
        else if (dp === 'MEDIUM') mediumCount++;
        else lowCount++;
      } else {
        lowCount++;
      }
    }

    const dominantPotential: DivergencePotential =
      highCount > 0 ? 'HIGH' : mediumCount > 0 ? 'MEDIUM' : 'LOW';

    const volatilityScore01 = clamp(
      round6((highCount * 1.0 + mediumCount * 0.5) / Math.max(1, plans.length)),
      0,
      1,
    );

    return Object.freeze({
      cardCount: cards.length,
      highDivergenceCount: highCount,
      mediumDivergenceCount: mediumCount,
      lowDivergenceCount: lowCount,
      dominantPotential,
      volatilityScore01,
      volatilityLabel: volatilityScore01 >= 0.75
        ? 'CRITICAL'
        : volatilityScore01 >= 0.5
        ? 'ELEVATED'
        : volatilityScore01 >= 0.25
        ? 'MODERATE'
        : 'STABLE',
    });
  }

  // ─── Strategic Class Composition ──────────────────────────────────────────

  /**
   * Summarize the strategic class distribution of a hand.
   * The drama director and chat hint systems use this to characterize the
   * player's current "archetype posture" for NPC commentary.
   */
  public analyzeStrategicComposition(
    cards: readonly CardInstance[],
  ): StrategicCompositionSummary {
    const plans = cards.map((c) => this.compileDetailed(c));
    const counts: Partial<Record<CompilerStrategicClass, number>> = {};

    for (const plan of plans) {
      counts[plan.strategicClass] = (counts[plan.strategicClass] ?? 0) + 1;
    }

    const entries = Object.entries(counts) as [CompilerStrategicClass, number][];
    entries.sort(([, a], [, b]) => b - a);

    const dominant = entries[0]?.[0] ?? 'MIXED';
    const secondaryEntries = entries.slice(1, 3);

    const distribution: Record<string, number> = {};
    for (const [cls, count] of entries) {
      distribution[cls] = count;
    }

    return Object.freeze({
      cardCount: cards.length,
      dominant,
      secondary: Object.freeze(secondaryEntries.map(([cls]) => cls)),
      distribution: Object.freeze(distribution),
      isMixed: entries.length > 2,
      archetypeLabel: resolveArchetypeLabel(dominant, entries.length > 2),
    });
  }

  // ─── Counterability Analysis ───────────────────────────────────────────────

  /**
   * Evaluate the counterability profile of a set of cards.
   * PvP drama systems use this to decide when to prompt the opponent
   * with "you have a counter window" alerts and NPC coaching hints.
   */
  public analyzeCounterability(
    cards: readonly CardInstance[],
  ): CounterabilityAnalysis {
    const plans = this.compileBatch(cards);
    const definitions = cards.map((c) => c as unknown as { definition?: CardDefinition });

    let hardCount = 0;
    let softCount = 0;
    let noneCount = 0;

    for (const plan of plans) {
      const firstOp = plan.supportedOperations[0];
      if (firstOp) {
        const reason = COUNTERABILITY_REASON[firstOp.divergencePotential as unknown as Counterability];
        if (reason?.includes('hard')) hardCount++;
        else if (reason?.includes('soft')) softCount++;
        else noneCount++;
      } else {
        noneCount++;
      }
    }

    // Reference definitions array to satisfy Counterability import usage path
    void definitions;

    const totalCounterable = hardCount + softCount;
    const counterabilityRatio01 = clamp(
      round6(totalCounterable / Math.max(1, plans.length)),
      0,
      1,
    );

    return Object.freeze({
      cardCount: cards.length,
      hardCounterableCount: hardCount,
      softCounterableCount: softCount,
      nonCounterableCount: noneCount,
      totalCounterable,
      counterabilityRatio01,
      threatLabel:
        counterabilityRatio01 >= 0.8
          ? 'HEAVILY_COUNTERABLE'
          : counterabilityRatio01 >= 0.5
          ? 'MODERATELY_COUNTERABLE'
          : counterabilityRatio01 >= 0.2
          ? 'LIGHTLY_COUNTERABLE'
          : 'NOT_COUNTERABLE',
    });
  }

  // ─── Compiler Health Diagnostics ──────────────────────────────────────────

  /**
   * Emit a full diagnostic report for a card.
   * Includes compilation plan, UX signal, narrative hint, tone classification,
   * divergence of single card, and deferred payload validation.
   * Used by the debug panel and by automated test harnesses.
   */
  public diagnosticReport(card: CardInstance): CardCompilerDiagnosticReport {
    const plan = this.compileDetailed(card);
    const uxSignal = this.buildUxSignalPayload(card);
    const narrativeHint = this.buildNarrativeHint(card);
    const toneTone = this.classifyModeTone(card);
    const deferredValidation = this.validateDeferredPayloads(plan);
    const traceWarnings = plan.trace.filter((t) => t.level === 'WARN');

    return Object.freeze({
      instanceId: card.instanceId,
      definitionId: card.definitionId,
      plan,
      uxSignal,
      narrativeHint,
      tone: toneTone,
      deferredValidation,
      traceWarningCount: traceWarnings.length,
      traceWarnings: Object.freeze(traceWarnings),
      healthy: deferredValidation.valid && traceWarnings.length === 0,
      summary: [
        `${card.definitionId}@${plan.mode}`,
        `ops=${plan.supportedOperations.length}`,
        `deferred=${plan.deferredRequirements.length}`,
        `warnings=${traceWarnings.length}`,
        `band=${plan.priorityBand}`,
        `strategy=${plan.strategicClass}`,
        `witness=${plan.witnessHint}`,
        `healthy=${deferredValidation.valid && traceWarnings.length === 0}`,
      ].join(' '),
    });
  }

  /**
   * Run diagnostic reports for an entire hand of cards.
   * Returns a batch summary alongside individual reports.
   */
  public batchDiagnosticReport(
    cards: readonly CardInstance[],
  ): CardCompilerBatchDiagnosticReport {
    const reports = cards.map((c) => this.diagnosticReport(c));
    const unhealthy = reports.filter((r) => !r.healthy);
    const deferredInvalid = reports.filter((r) => !r.deferredValidation.valid);
    const withWarnings = reports.filter((r) => r.traceWarningCount > 0);

    return Object.freeze({
      cardCount: cards.length,
      healthyCount: reports.length - unhealthy.length,
      unhealthyCount: unhealthy.length,
      deferredInvalidCount: deferredInvalid.length,
      warningCount: withWarnings.length,
      reports: Object.freeze(reports),
      allHealthy: unhealthy.length === 0,
      summary: `${reports.length} cards — ${unhealthy.length} unhealthy, ` +
        `${deferredInvalid.length} deferred-invalid, ${withWarnings.length} with warnings`,
    });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Exported UX / drama payload types
// ═════════════════════════════════════════════════════════════════════════════

export interface CardUxSignalPayload {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly mode: ModeCode;
  readonly channelHint: CompilerChannelWitnessHint;
  readonly priorityBand: CompilerPriorityBand;
  readonly strategicClass: CompilerStrategicClass;
  readonly effectSummary: string;
  readonly toneLine: string;
  readonly dramaIntensity: number;
  readonly hasDeferredWork: boolean;
  readonly deferredCount: number;
  readonly operationCount: number;
  readonly weightedTags: readonly string[];
}

export interface CardNarrativeHint {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly mode: ModeCode;
  readonly strategicReason: string;
  readonly timingReasons: readonly string[];
  readonly deferredFields: readonly DeferredEffectField[];
  readonly immediateKinds: readonly string[];
  readonly modeText: string;
  readonly narrativeVerb: string;
  readonly witnessNarrative: string;
  readonly intensityLabel: string;
  readonly weightedTags: readonly string[];
  readonly channelHint: CompilerChannelWitnessHint;
}

export interface CardCompilationDiff {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly changed: boolean;
  readonly overlayKeyChanged: boolean;
  readonly modifierChanged: boolean;
  readonly modifierDelta: number;
  readonly strategicClassChanged: boolean;
  readonly beforeStrategicClass: CompilerStrategicClass;
  readonly afterStrategicClass: CompilerStrategicClass;
  readonly priorityBandChanged: boolean;
  readonly beforePriorityBand: CompilerPriorityBand;
  readonly afterPriorityBand: CompilerPriorityBand;
  readonly witnessHintChanged: boolean;
  readonly beforeWitnessHint: CompilerChannelWitnessHint;
  readonly afterWitnessHint: CompilerChannelWitnessHint;
  readonly operationCountDelta: number;
  readonly deferredCountDelta: number;
  readonly addedOperationKinds: readonly string[];
  readonly removedOperationKinds: readonly string[];
}

export interface DeferredPayloadValidationResult {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly valid: boolean;
  readonly presentCount: number;
  readonly missingCount: number;
  readonly missingRequirements: readonly string[];
  readonly presentRequirements: readonly string[];
  readonly summary: string;
}

export interface CardModeToneClassification {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly mode: ModeCode;
  readonly strategicClass: CompilerStrategicClass;
  readonly priorityBand: CompilerPriorityBand;
  readonly toneLabel: string;
  readonly toneIntensity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly dramaIntensity: number;
  readonly moodKeyword: string;
  readonly uiAccentClass: string;
}

export interface DivergenceAnalysis {
  readonly cardCount: number;
  readonly highDivergenceCount: number;
  readonly mediumDivergenceCount: number;
  readonly lowDivergenceCount: number;
  readonly dominantPotential: DivergencePotential;
  readonly volatilityScore01: number;
  readonly volatilityLabel: 'STABLE' | 'MODERATE' | 'ELEVATED' | 'CRITICAL';
}

export interface StrategicCompositionSummary {
  readonly cardCount: number;
  readonly dominant: CompilerStrategicClass;
  readonly secondary: readonly CompilerStrategicClass[];
  readonly distribution: Readonly<Record<string, number>>;
  readonly isMixed: boolean;
  readonly archetypeLabel: string;
}

export interface CounterabilityAnalysis {
  readonly cardCount: number;
  readonly hardCounterableCount: number;
  readonly softCounterableCount: number;
  readonly nonCounterableCount: number;
  readonly totalCounterable: number;
  readonly counterabilityRatio01: number;
  readonly threatLabel: string;
}

export interface CardCompilerDiagnosticReport {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly plan: CardCompilationPlan;
  readonly uxSignal: CardUxSignalPayload;
  readonly narrativeHint: CardNarrativeHint;
  readonly tone: CardModeToneClassification;
  readonly deferredValidation: DeferredPayloadValidationResult;
  readonly traceWarningCount: number;
  readonly traceWarnings: readonly CompilationTraceEntry[];
  readonly healthy: boolean;
  readonly summary: string;
}

export interface CardCompilerBatchDiagnosticReport {
  readonly cardCount: number;
  readonly healthyCount: number;
  readonly unhealthyCount: number;
  readonly deferredInvalidCount: number;
  readonly warningCount: number;
  readonly reports: readonly CardCompilerDiagnosticReport[];
  readonly allHealthy: boolean;
  readonly summary: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// Module-level utility functions (use all imported types)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Resolve the human-facing drama intensity for a compiled plan.
 * Score is 0–100: foundation = low base, shadow = high base, amplified by
 * operation count and divergence spread.
 */
function resolveDramaIntensity(plan: CardCompilationPlan): number {
  const bandBase = PRIORITY_SCORE_BY_BAND[plan.priorityBand] ?? 10;
  const opBonus = Math.min(plan.supportedOperations.length * 5, 30);
  const deferredBonus = Math.min(plan.deferredRequirements.length * 3, 15);
  const shadowBonus = plan.witnessHint === 'SYSTEM_SHADOW' ? 20 : 0;
  return clamp(bandBase + opBonus + deferredBonus + shadowBonus, 0, 100);
}

/**
 * Build the human-facing tone line for a mode + strategic class pairing.
 * Consumed by the UX layer and by NPC reaction commentary.
 */
function buildModeToneLine(mode: ModeCode, strategicClass: CompilerStrategicClass): string {
  const modeText = MODE_IDENTITY_TEXT[mode];
  const stratReason = STRATEGIC_REASON_BY_CLASS[strategicClass];
  return `[${mode.toUpperCase()}] ${modeText} — ${stratReason}`;
}

/**
 * Resolve the narrative verb for NPC commentary.
 * Verbs like "deploys", "strikes", "contracts", "vanishes" give the drama
 * director precise vocabulary to build reactive dialogue.
 */
function resolveNarrativeVerb(
  strategicClass: CompilerStrategicClass,
  mode: ModeCode,
): string {
  const verbMap: Record<CompilerStrategicClass, Record<ModeCode, string>> = {
    CAPITAL_ALLOCATION: { solo: 'deploys capital', pvp: 'allocates pressure', coop: 'invests', ghost: 'positions' },
    COMPOUNDING: { solo: 'compounds', pvp: 'stacks', coop: 'accrues', ghost: 'layers' },
    PRESSURE_RESPONSE: { solo: 'absorbs', pvp: 'deflects', coop: 'cushions', ghost: 'dampens' },
    PREDATORY_COMBAT: { solo: 'dominates', pvp: 'strikes', coop: 'disrupts', ghost: 'ambushes' },
    COUNTERPLAY: { solo: 'counters', pvp: 'parries', coop: 'shields', ghost: 'nullifies' },
    COOPERATIVE_CONTRACT: { solo: 'contracts', pvp: 'engages', coop: 'bonds', ghost: 'signals' },
    RESCUE_INTERVENTION: { solo: 'recovers', pvp: 'intervenes', coop: 'rescues', ghost: 'extracts' },
    PRECISION_GHOSTING: { solo: 'marks', pvp: 'ghosts', coop: 'phantoms', ghost: 'vanishes' },
    DISCIPLINE_CONTROL: { solo: 'disciplines', pvp: 'locks', coop: 'steadies', ghost: 'anchors' },
    SYSTEM_OVERRIDE: { solo: 'overrides', pvp: 'commands', coop: 'overrules', ghost: 'bypasses' },
    MIXED: { solo: 'acts', pvp: 'plays', coop: 'contributes', ghost: 'executes' },
  };
  return verbMap[strategicClass]?.[mode] ?? 'plays';
}

/**
 * Resolve the channel witness narrative label.
 * The chat wiring uses this as the room introduction line when announcing
 * a card play into a channel.
 */
function resolveWitnessNarrative(hint: CompilerChannelWitnessHint): string {
  const narrativeMap: Record<CompilerChannelWitnessHint, string> = {
    NONE: 'Play is silent — no channel witness.',
    GLOBAL: 'Play is visible across all active game channels.',
    SYNDICATE: 'Play is announced within the syndicate deal channel.',
    DEAL_ROOM: 'Play is witnessed in the live deal room.',
    POST_RUN: 'Play will be revealed in the post-run debrief.',
    SYSTEM_SHADOW: 'Play is system-level — shadow channel only.',
  };
  return narrativeMap[hint];
}

/**
 * Resolve a human-readable intensity label for a compiled plan.
 */
function resolveIntensityLabel(plan: CardCompilationPlan): string {
  const intensity = resolveDramaIntensity(plan);
  if (intensity >= 80) return 'EXPLOSIVE';
  if (intensity >= 60) return 'HIGH_IMPACT';
  if (intensity >= 40) return 'NOTABLE';
  if (intensity >= 20) return 'MODERATE';
  return 'SUBTLE';
}

/**
 * Classify the tone of a plan for the mode-tone system.
 * Used by UI chromatic accents, sound cues, and NPC commentary selection.
 */
function classifyPlanModeTone(plan: CardCompilationPlan): CardModeToneClassification {
  const dramaIntensity = resolveDramaIntensity(plan);
  const toneIntensity: CardModeToneClassification['toneIntensity'] =
    dramaIntensity >= 80 ? 'CRITICAL' :
    dramaIntensity >= 55 ? 'HIGH' :
    dramaIntensity >= 30 ? 'MEDIUM' : 'LOW';

  const moodKeyword = resolveMoodKeyword(plan.strategicClass, plan.mode);
  const uiAccentClass = resolveUiAccentClass(plan.priorityBand, plan.strategicClass);
  const toneLabel = buildModeToneLine(plan.mode, plan.strategicClass);

  return Object.freeze({
    instanceId: plan.instanceId,
    definitionId: plan.definitionId,
    mode: plan.mode,
    strategicClass: plan.strategicClass,
    priorityBand: plan.priorityBand,
    toneLabel,
    toneIntensity,
    dramaIntensity,
    moodKeyword,
    uiAccentClass,
  });
}

/**
 * Resolve a mood keyword for NPC commentary and UI theming.
 */
function resolveMoodKeyword(
  strategicClass: CompilerStrategicClass,
  mode: ModeCode,
): string {
  const moodMap: Record<CompilerStrategicClass, Partial<Record<ModeCode, string>>> = {
    CAPITAL_ALLOCATION: { solo: 'ambitious', pvp: 'assertive', coop: 'collaborative', ghost: 'measured' },
    COMPOUNDING: { solo: 'patient', pvp: 'grinding', coop: 'building', ghost: 'layering' },
    PRESSURE_RESPONSE: { solo: 'resilient', pvp: 'defensive', coop: 'supportive', ghost: 'adaptive' },
    PREDATORY_COMBAT: { solo: 'dominant', pvp: 'aggressive', coop: 'disruptive', ghost: 'lethal' },
    COUNTERPLAY: { solo: 'reactive', pvp: 'tactical', coop: 'protective', ghost: 'neutralizing' },
    COOPERATIVE_CONTRACT: { solo: 'structured', pvp: 'negotiating', coop: 'bonded', ghost: 'signaling' },
    RESCUE_INTERVENTION: { solo: 'stabilizing', pvp: 'intervening', coop: 'heroic', ghost: 'extracting' },
    PRECISION_GHOSTING: { solo: 'calibrated', pvp: 'surgical', coop: 'precise', ghost: 'phantom' },
    DISCIPLINE_CONTROL: { solo: 'controlled', pvp: 'locked', coop: 'steady', ghost: 'anchored' },
    SYSTEM_OVERRIDE: { solo: 'commanding', pvp: 'authoritative', coop: 'overruling', ghost: 'bypassing' },
    MIXED: { solo: 'dynamic', pvp: 'unpredictable', coop: 'versatile', ghost: 'fluid' },
  };
  return moodMap[strategicClass]?.[mode] ?? 'active';
}

/**
 * Resolve a UI accent CSS class hint based on priority band and strategic class.
 * The frontend maps these tokens to Tailwind / CSS custom property values.
 */
function resolveUiAccentClass(
  band: CompilerPriorityBand,
  strategicClass: CompilerStrategicClass,
): string {
  const bandPrefix: Record<CompilerPriorityBand, string> = {
    FOUNDATION: 'accent-foundation',
    TACTICAL: 'accent-tactical',
    RITUAL: 'accent-ritual',
    SHADOW: 'accent-shadow',
  };
  const classSuffix: Partial<Record<CompilerStrategicClass, string>> = {
    PREDATORY_COMBAT: '-aggressive',
    RESCUE_INTERVENTION: '-rescue',
    COOPERATIVE_CONTRACT: '-cooperative',
    SYSTEM_OVERRIDE: '-override',
    PRECISION_GHOSTING: '-ghost',
  };
  return `${bandPrefix[band]}${classSuffix[strategicClass] ?? ''}`;
}

/**
 * Resolve an archetype label for the strategic composition summary.
 * Drama director uses this as the player's "current posture" label.
 */
function resolveArchetypeLabel(
  dominant: CompilerStrategicClass,
  isMixed: boolean,
): string {
  if (isMixed) return 'Adaptive Hybrid';
  const archetypeMap: Partial<Record<CompilerStrategicClass, string>> = {
    CAPITAL_ALLOCATION: 'Capital Architect',
    COMPOUNDING: 'Patient Compounder',
    PRESSURE_RESPONSE: 'Crisis Manager',
    PREDATORY_COMBAT: 'Apex Predator',
    COUNTERPLAY: 'Tactical Defender',
    COOPERATIVE_CONTRACT: 'Contract Broker',
    RESCUE_INTERVENTION: 'Field Medic',
    PRECISION_GHOSTING: 'Ghost Operative',
    DISCIPLINE_CONTROL: 'Discipline Master',
    SYSTEM_OVERRIDE: 'System Controller',
    MIXED: 'Adaptive Hybrid',
  };
  return archetypeMap[dominant] ?? 'Unknown Archetype';
}

// ═════════════════════════════════════════════════════════════════════════════
// Standalone utility functions (exported for barrel and test access)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Classify a raw CardDefinition's strategic class without a full compiler context.
 * Useful for pre-compile analysis and deck composition utilities.
 */
export function classifyCardDefinitionStrategicClass(
  definition: CardDefinition,
): CompilerStrategicClass {
  return STRATEGIC_CLASS_BY_DECK[definition.deckType] ?? 'MIXED';
}

/**
 * Classify the priority band for a CardDefinition's timing class array.
 * Returns the band of the first timing class, or FOUNDATION if none.
 */
export function classifyCardDefinitionPriorityBand(
  definition: CardDefinition,
): CompilerPriorityBand {
  const firstTiming = definition.timingClass?.[0];
  if (!firstTiming) return 'FOUNDATION';
  return PRIORITY_BAND_BY_TIMING[firstTiming] ?? 'FOUNDATION';
}

/**
 * Classify the witness hint for a CardDefinition given a mode.
 * Used by static analysis tools and deck auditors.
 */
export function classifyCardDefinitionWitnessHint(
  definition: CardDefinition,
  mode: ModeCode,
): CompilerChannelWitnessHint {
  // Ghost-deck cards always route to POST_RUN regardless of mode
  if (definition.deckType === 'GHOST') return 'POST_RUN';
  return WITNESS_HINT_BY_MODE[mode] ?? 'GLOBAL';
}

/**
 * Build a determinism key for a CardDefinition + mode pair.
 * Pre-compile tooling can use this to check whether two definitions
 * would produce equivalent overlays under the same mode.
 */
export function buildDefinitionDeterminismKey(
  definition: CardDefinition,
  mode: ModeCode,
): string {
  return `${definition.id}:${mode}:${definition.deckType}:${(definition.timingClass ?? []).join('+')}`;
}

/**
 * Check whether a timing class array includes a specific TimingClass.
 * Used throughout legality, targeting, and composer systems.
 */
export function timingClassIncludes(
  timings: readonly TimingClass[],
  target: TimingClass,
): boolean {
  return timings.includes(target) || timings.includes('ANY');
}

/**
 * Check whether a CardDefinition is executable in a given mode.
 * A definition is mode-executable if its modeLegal list is absent or contains the mode.
 */
export function isCardDefinitionModeExecutable(
  definition: CardDefinition,
  mode: ModeCode,
): boolean {
  if (!definition.modeLegal || definition.modeLegal.length === 0) return true;
  return (definition.modeLegal as readonly string[]).includes(mode);
}

/**
 * Check whether an EffectPayload has any supported numeric fields.
 * Used by compiler and executor to quickly triage effect complexity.
 */
export function effectPayloadHasNumericFields(payload: EffectPayload): boolean {
  return (
    (payload.cashDelta != null && payload.cashDelta !== 0) ||
    (payload.incomeDelta != null && payload.incomeDelta !== 0) ||
    (payload.shieldDelta != null && payload.shieldDelta !== 0) ||
    (payload.heatDelta != null && payload.heatDelta !== 0) ||
    (payload.trustDelta != null && payload.trustDelta !== 0) ||
    (payload.timeDeltaMs != null && payload.timeDeltaMs !== 0) ||
    (payload.divergenceDelta != null && payload.divergenceDelta !== 0)
  );
}

/**
 * Check whether an EffectPayload has any deferred fields.
 */
export function effectPayloadHasDeferredFields(payload: EffectPayload): boolean {
  return (
    payload.debtDelta != null ||
    payload.expenseDelta != null ||
    payload.treasuryDelta != null ||
    payload.battleBudgetDelta != null ||
    payload.holdChargeDelta != null ||
    payload.counterIntelDelta != null ||
    (payload.exhaustCards != null && (payload.exhaustCards as readonly string[]).length > 0) ||
    (payload.grantBadges != null && (payload.grantBadges as readonly string[]).length > 0) ||
    payload.namedActionId != null
  );
}

/**
 * Count the total weighted effect magnitude from an EffectPayload.
 * Used by the drama intensity and counterability analysis systems.
 */
export function sumEffectPayloadMagnitude(payload: EffectPayload): number {
  return (
    Math.abs(payload.cashDelta ?? 0) +
    Math.abs(payload.incomeDelta ?? 0) +
    Math.abs(payload.shieldDelta ?? 0) * 1.5 +
    Math.abs(payload.heatDelta ?? 0) * 1.2 +
    Math.abs(payload.trustDelta ?? 0) * 1.1 +
    Math.abs(payload.timeDeltaMs ?? 0) / 1_000 +
    Math.abs(payload.divergenceDelta ?? 0) * 2.0
  );
}

/**
 * Classify whether a DivergencePotential is high enough to warrant
 * an elevated drama response.
 */
export function isDivergencePotentialElevated(dp: DivergencePotential): boolean {
  return dp === 'HIGH' || dp === 'MEDIUM';
}

/**
 * Classify a Counterability level as hostile (meaningful threat to opponent).
 */
export function isCounterabilityHostile(counterability: Counterability): boolean {
  return counterability === 'HARD' || counterability === 'SOFT';
}

/**
 * List all supported effect fields.
 */
export function listSupportedEffectFields(): readonly SupportedEffectField[] {
  return SUPPORTED_NUMERIC_FIELDS;
}

/**
 * List all deferred effect fields.
 */
export function listDeferredEffectFields(): readonly DeferredEffectField[] {
  return DEFERRED_EFFECT_FIELDS;
}

/**
 * Get the execution order number for an operation kind.
 */
export function getOperationExecutionOrder(kind: CompiledOperation['kind']): number {
  return EXECUTION_ORDER_BY_KIND[kind] ?? 99;
}

/**
 * Get the priority score for a priority band.
 */
export function getPriorityBandScore(band: CompilerPriorityBand): number {
  return PRIORITY_SCORE_BY_BAND[band] ?? 0;
}

/**
 * Get the strategic reason text for a strategic class.
 */
export function getStrategicClassReason(cls: CompilerStrategicClass): string {
  return STRATEGIC_REASON_BY_CLASS[cls];
}

/**
 * Get the timing reason text for a timing class.
 */
export function getTimingClassReason(timing: TimingClass): string {
  return TIMING_REASON_BY_CLASS[timing] ?? `timing class ${timing}`;
}

/**
 * Get the counterability reason text.
 */
export function getCounterabilityReason(counterability: Counterability): string {
  return COUNTERABILITY_REASON[counterability];
}

/**
 * Get the targeting reason text.
 */
export function getTargetingReason(targeting: Targeting): string {
  return TARGETING_REASON[targeting];
}

/**
 * Get the mode identity text for NPC commentary.
 */
export function getModeIdentityText(mode: ModeCode): string {
  return MODE_IDENTITY_TEXT[mode];
}

/**
 * Get the witness hint for a mode.
 */
export function getModeWitnessHint(mode: ModeCode): CompilerChannelWitnessHint {
  return WITNESS_HINT_BY_MODE[mode];
}

/**
 * Get special card hints for a named card ID.
 */
export function getSpecialCardHints(cardName: string): readonly string[] {
  return SPECIAL_CARD_HINTS[cardName] ?? Object.freeze([]);
}

// ═════════════════════════════════════════════════════════════════════════════
// Module Authority Object
// ═════════════════════════════════════════════════════════════════════════════

export const CARD_EFFECT_COMPILER_MODULE_ID = 'backend.engine.cards.CardEffectCompiler' as const;
export const CARD_EFFECT_COMPILER_MODULE_VERSION = '2.0.0' as const;

export const CARD_EFFECT_COMPILER_MODULE_AUTHORITY = Object.freeze({
  moduleId: CARD_EFFECT_COMPILER_MODULE_ID,
  version: CARD_EFFECT_COMPILER_MODULE_VERSION,

  // Core class
  CardEffectCompiler: 'class',

  // Exported types (compile-time only)
  NumericOperationKind: 'type',
  SupportedEffectField: 'type',
  DeferredEffectField: 'type',
  CompilerSupportStatus: 'type',
  CompilerPriorityBand: 'type',
  CompilerStrategicClass: 'type',
  CompilerChannelWitnessHint: 'type',
  CompiledOperationMeta: 'interface',
  CompiledOperation: 'type',
  DeferredCompiledRequirement: 'interface',
  CompilationTraceEntry: 'interface',
  CardCompilationPlan: 'interface',
  CardUxSignalPayload: 'interface',
  CardNarrativeHint: 'interface',
  CardCompilationDiff: 'interface',
  DeferredPayloadValidationResult: 'interface',
  CardModeToneClassification: 'interface',
  DivergenceAnalysis: 'interface',
  StrategicCompositionSummary: 'interface',
  CounterabilityAnalysis: 'interface',
  CardCompilerDiagnosticReport: 'interface',
  CardCompilerBatchDiagnosticReport: 'interface',

  // Module constants
  CARD_EFFECT_COMPILER_MODULE_ID: 'const',
  CARD_EFFECT_COMPILER_MODULE_VERSION: 'const',
  CARD_EFFECT_COMPILER_MODULE_AUTHORITY: 'const',

  // Utility functions
  classifyCardDefinitionStrategicClass: 'function',
  classifyCardDefinitionPriorityBand: 'function',
  classifyCardDefinitionWitnessHint: 'function',
  buildDefinitionDeterminismKey: 'function',
  timingClassIncludes: 'function',
  isCardDefinitionModeExecutable: 'function',
  effectPayloadHasNumericFields: 'function',
  effectPayloadHasDeferredFields: 'function',
  sumEffectPayloadMagnitude: 'function',
  isDivergencePotentialElevated: 'function',
  isCounterabilityHostile: 'function',
  listSupportedEffectFields: 'function',
  listDeferredEffectFields: 'function',
  getOperationExecutionOrder: 'function',
  getPriorityBandScore: 'function',
  getStrategicClassReason: 'function',
  getTimingClassReason: 'function',
  getCounterabilityReason: 'function',
  getTargetingReason: 'function',
  getModeIdentityText: 'function',
  getModeWitnessHint: 'function',
  getSpecialCardHints: 'function',
} as const);
