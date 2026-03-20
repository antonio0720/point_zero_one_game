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
}
