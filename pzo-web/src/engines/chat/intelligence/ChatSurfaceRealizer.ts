/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT SURFACE REALIZER
 * FILE: backend/src/game/engine/chat/intelligence/ChatSurfaceRealizer.ts
 * VERSION: 2026.03.21-surface-realizer-depth.v15
 * ============================================================================
 *
 * Backend-authoritative realization lane for canonical authored lines.
 *
 * Goals
 * -----
 * - Keep the shared contract untouched.
 * - Stay deterministic from line + context.
 * - Deepen transform planning and phrase shaping without importing frontend UI.
 * - Produce richer strategy / rhetorical / semantic / tag surfaces for backend
 *   ranking, auditing, memory, explainability, and replay.
 * ============================================================================
 */

import type {
  SharedCanonicalChatLine,
  SharedChatRealizationContext,
  SharedChatRealizationResult,
  SharedChatRealizationTransform,
} from '../../../../../../shared/contracts/chat/surface-realization';

export const CHAT_SURFACE_REALIZER_VERSION = '2026.03.21-surface-realizer-depth.v15' as const;

type InternalTone = 'ICE' | 'COLD' | 'CONTROLLED' | 'HOT' | 'RITUAL';
type InternalHeatBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type InternalCadence = 'TIGHT' | 'BALANCED' | 'EXPANSIVE';
type InternalPublicness = 'PRIVATE' | 'HYBRID' | 'PUBLIC';

interface SignalVector {
  respect: number;
  contempt: number;
  fear: number;
  fascination: number;
  tone: InternalTone;
  heatBand: InternalHeatBand;
  cadence: InternalCadence;
  publicness: InternalPublicness;
  callbackWeight: number;
}

interface RealizationPlan {
  seed: number;
  explicitTransforms: readonly SharedChatRealizationTransform[];
  inferredTransforms: readonly SharedChatRealizationTransform[];
  transforms: readonly SharedChatRealizationTransform[];
  signals: SignalVector;
  motifCluster: string;
  rhetoricalBase: string;
  openingLead: string | null;
  closingEcho: string | null;
}

interface TransformRuntime {
  line: SharedCanonicalChatLine;
  context: SharedChatRealizationContext;
  plan: RealizationPlan;
}

const EMPTY_TAGS: readonly string[] = Object.freeze([]);

const PRIORITY: Readonly<Record<SharedChatRealizationTransform, number>> = Object.freeze({
  MORE_PRE_EVENT: 10,
  MORE_POST_EVENT: 10,
  MORE_PUBLIC: 20,
  PERSONAL_HISTORY_REWRITE: 30,
  CALLBACK_REWRITE: 40,
  PRESSURE_REWRITE: 50,
  MORE_INTIMATE: 60,
  MORE_DIRECT: 70,
  MORE_MOCKING: 80,
  SHORTER_COLDER: 90,
  LONGER_CEREMONIAL: 100,
});

const STOPWORDS = new Set<string>([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'if',
  'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'our', 'that', 'the', 'their',
  'there', 'this', 'to', 'was', 'we', 'were', 'with', 'you', 'your',
]);

const RITUAL_LEADS = Object.freeze({
  LOW: Object.freeze(['For the record,', 'Let the room note this,']),
  MEDIUM: Object.freeze(['Let the room hear this plainly,', 'Mark the exchange,']),
  HIGH: Object.freeze(['Witness this clearly,', 'The room records this without mercy,']),
  CRITICAL: Object.freeze(['This enters the ledger under full pressure,', 'The room will remember this exactly,']),
});

const CONTROLLED_LEADS = Object.freeze({
  LOW: Object.freeze(['Plainly,', 'Quietly,']),
  MEDIUM: Object.freeze(['Look again,', 'Observe the structure,']),
  HIGH: Object.freeze(['This is the part players misread,', 'Your timing is visible,']),
  CRITICAL: Object.freeze(['The window is collapsing,', 'This has stopped being interpretive,']),
});

const HOT_LEADS = Object.freeze({
  LOW: Object.freeze(['The room felt that,', 'You are being noticed,']),
  MEDIUM: Object.freeze(['The room is leaning in now,', 'Everyone heard that choice,']),
  HIGH: Object.freeze(['The room is feeding on this,', 'The crowd has decided this matters,']),
  CRITICAL: Object.freeze(['This has become blood in the water,', 'Every witness in the room is awake now,']),
});

const PUBLIC_LEADS = Object.freeze({
  LOW: Object.freeze(['The room saw it.', 'That did not stay private.']),
  MEDIUM: Object.freeze(['That entered public memory immediately.', 'No one is pretending they missed that.']),
  HIGH: Object.freeze(['This is fully public now.', 'The room is reading you in real time.']),
  CRITICAL: Object.freeze(['Nothing about this remained contained.', 'Public memory just hardened around that choice.']),
});

const PRIVATE_LEADS = Object.freeze({
  LOW: Object.freeze(['Between us,', 'Quietly,']),
  MEDIUM: Object.freeze(['Away from the room,', 'Without the crowd in the way,']),
  HIGH: Object.freeze(['In the quieter chamber,', 'Without audience distortion,']),
  CRITICAL: Object.freeze(['In private, the structure is harsher,', 'Without witnesses to soften it,']),
});

const HISTORY_LEADS = Object.freeze({
  LOW: Object.freeze(['This is not our first unfinished exchange.', 'There is already context under this.']),
  MEDIUM: Object.freeze(['You repeat patterns more clearly than you intend.', 'This lands against previous behavior.']),
  HIGH: Object.freeze(['Your history is leaning forward inside this sentence.', 'The pattern is old enough now to have edges.']),
  CRITICAL: Object.freeze(['The past has become active pressure here.', 'This is history closing its hand around the present.']),
});

const CALLBACK_LEADS = Object.freeze({
  LOW: Object.freeze(['You left a thread hanging.', 'Your earlier line still has weight.']),
  MEDIUM: Object.freeze(['The room did not forget your earlier language.', 'That earlier claim stayed active.']),
  HIGH: Object.freeze(['Your own language is back to collect from you.', 'Your earlier words matured into leverage.']),
  CRITICAL: Object.freeze(['Your previous sentence has become evidence.', 'The callback is no longer decorative.']),
});

const PRE_EVENT_LEADS = Object.freeze({
  LOW: Object.freeze(['Before this goes any further,', 'Before the room decides for you,']),
  MEDIUM: Object.freeze(['Before this opens beneath you,', 'While the moment is still reversible,']),
  HIGH: Object.freeze(['Before the structure closes,', 'Before the room sharpens around your choice,']),
  CRITICAL: Object.freeze(['Before collapse becomes grammar,', 'While there is still a narrow exit,']),
});

const POST_EVENT_LEADS = Object.freeze({
  LOW: Object.freeze(['After that,', 'Now that the move has landed,']),
  MEDIUM: Object.freeze(['After what just settled into the room,', 'With the impact still warm,']),
  HIGH: Object.freeze(['After what just broke open,', 'With the consequences already visible,']),
  CRITICAL: Object.freeze(['After the structure gave way,', 'With the event still cutting through the air,']),
});

const COLD_CLOSERS = Object.freeze([
  'That was enough.',
  'Read it once and keep it.',
  'No extra explanation is required.',
]);

const RITUAL_CLOSERS = Object.freeze([
  'That is now part of the record.',
  'The room will keep the shape of that sentence.',
  'This enters memory exactly as spoken.',
]);

const DIRECT_REPLACEMENTS: ReadonlyArray<readonly [RegExp, readonly string[]]> = Object.freeze([
  [/\bYou are not\b/g, Object.freeze(['You are no longer'])],
  [/\bI think\b/g, Object.freeze(['I know'])],
  [/\bmaybe\b/gi, Object.freeze(['clearly'])],
  [/\bperhaps\b/gi, Object.freeze(['plainly'])],
]);

const MOCKING_REPLACEMENTS: ReadonlyArray<readonly [RegExp, readonly string[]]> = Object.freeze([
  [/\bInteresting\./g, Object.freeze(['Cute.', 'Predictable.', 'Convenient.'])],
  [/\bVery well\./g, Object.freeze(['Sure.', 'Of course.', 'Fine.'])],
  [/\bI see\./g, Object.freeze(['I noticed.', 'I clocked that.', 'I saw enough.'])],
]);

const INTIMACY_RULES = Object.freeze([
  { pattern: /\bYou are\b/g, apply: (alias: string) => `${alias} is` },
  { pattern: /\bYou were\b/g, apply: (alias: string) => `${alias} was` },
  { pattern: /\bYou have\b/g, apply: (alias: string) => `${alias} has` },
  { pattern: /\bYou\b/g, apply: (alias: string) => alias },
  { pattern: /\byour\b/g, apply: (alias: string) => `${alias}'s` },
]);

function clamp01(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if ((value as number) <= 0) {
    return 0;
  }
  if ((value as number) >= 1) {
    return 1;
  }
  return value as number;
}

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizePunctuation(value: string): string {
  return normalizeSpace(
    value
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/([,.;:!?])(\S)/g, '$1 $2')
      .replace(/\s{2,}/g, ' '),
  );
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededIndex(length: number, seed: number): number {
  if (length <= 0) {
    return 0;
  }
  return Math.abs(seed) % length;
}

function chooseSeeded<T>(items: readonly T[], seed: number): T {
  return items[seededIndex(items.length, seed)];
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function hasText(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function toSlug(value: string): string {
  return normalizeSpace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function tokenize(value: string): string[] {
  return normalizeSpace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function topTokens(value: string, limit: number): string[] {
  const counts = new Map<string, number>();
  for (const token of tokenize(value)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([token]) => token);
}

function prependLead(text: string, lead: string): string {
  const normalizedLead = normalizeSpace(lead);
  if (!normalizedLead) {
    return text;
  }
  return normalizePunctuation(`${normalizedLead}${normalizedLead.endsWith('.') || normalizedLead.endsWith(',') ? '' : ' '}${text}`);
}

function appendTail(text: string, tail: string): string {
  const normalizedTail = normalizeSpace(tail);
  if (!normalizedTail) {
    return text;
  }
  const base = /[.?!]$/.test(text) ? text : `${text}.`;
  return normalizePunctuation(`${base} ${normalizedTail}`);
}

function phraseFromBand(
  bank: Readonly<Record<InternalHeatBand, readonly string[]>>,
  band: InternalHeatBand,
  seed: number,
): string {
  return chooseSeeded(bank[band], seed);
}

function computeTone(respect: number, contempt: number, fear: number, fascination: number): InternalTone {
  if (respect >= 0.74 && contempt <= 0.28) {
    return 'RITUAL';
  }
  if (contempt >= 0.78 || fear >= 0.78) {
    return 'ICE';
  }
  if (contempt >= 0.58) {
    return 'COLD';
  }
  if (fear >= 0.6 || fascination >= 0.74) {
    return 'HOT';
  }
  return 'CONTROLLED';
}

function computeHeatBand(respect: number, contempt: number, fear: number, fascination: number): InternalHeatBand {
  const score = (contempt * 0.38) + (fear * 0.31) + (fascination * 0.18) + (respect * 0.13);
  if (score >= 0.86) {
    return 'CRITICAL';
  }
  if (score >= 0.64) {
    return 'HIGH';
  }
  if (score >= 0.34) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function computeCadence(tone: InternalTone, heatBand: InternalHeatBand): InternalCadence {
  if (tone === 'RITUAL') {
    return 'EXPANSIVE';
  }
  if (tone === 'ICE' || heatBand === 'CRITICAL') {
    return 'TIGHT';
  }
  return 'BALANCED';
}

function computePublicness(context: SharedChatRealizationContext): InternalPublicness {
  if (context.publicFacing === true) {
    return 'PUBLIC';
  }
  if (context.publicFacing === false) {
    return 'PRIVATE';
  }
  return 'HYBRID';
}

function buildSignals(context: SharedChatRealizationContext): SignalVector {
  const respect = clamp01(context.respect);
  const contempt = clamp01(context.contempt);
  const fear = clamp01(context.fear);
  const fascination = clamp01(context.fascination);
  const tone = computeTone(respect, contempt, fear, fascination);
  const heatBand = computeHeatBand(respect, contempt, fear, fascination);
  const cadence = computeCadence(tone, heatBand);
  const publicness = computePublicness(context);
  const callbackWeight = hasText(context.callbackText)
    ? Math.max(fascination, contempt * 0.7, respect * 0.55)
    : 0;

  return {
    respect,
    contempt,
    fear,
    fascination,
    tone,
    heatBand,
    cadence,
    publicness,
    callbackWeight,
  };
}

function inferTransforms(
  line: SharedCanonicalChatLine,
  context: SharedChatRealizationContext,
  signals: SignalVector,
): SharedChatRealizationTransform[] {
  const inferred: SharedChatRealizationTransform[] = [];

  if (signals.publicness === 'PUBLIC') {
    inferred.push('MORE_PUBLIC');
  }
  if (hasText(context.callbackText) && signals.callbackWeight >= 0.24) {
    inferred.push('CALLBACK_REWRITE');
  }
  if ((signals.contempt >= 0.48 || signals.fear >= 0.56) && !/calm/i.test(context.pressureBand ?? '')) {
    inferred.push('PRESSURE_REWRITE');
  }
  if (hasText(context.playerAlias) && (signals.respect >= 0.2 || signals.fascination >= 0.22)) {
    inferred.push('MORE_INTIMATE');
  }
  if (signals.tone === 'ICE' || signals.cadence === 'TIGHT') {
    inferred.push('SHORTER_COLDER', 'MORE_DIRECT');
  }
  if (signals.tone === 'RITUAL') {
    inferred.push('LONGER_CEREMONIAL');
  }
  if (signals.contempt >= 0.72) {
    inferred.push('MORE_MOCKING');
  }
  if (hasText(context.callbackAnchorId) && (signals.respect + signals.fascination >= 0.95)) {
    inferred.push('PERSONAL_HISTORY_REWRITE');
  }
  if (/pre|open|warning|telegraph|setup/i.test(context.sceneArchetype ?? '')) {
    inferred.push('MORE_PRE_EVENT');
  }
  if (/post|after|aftermath|recovery|fallout|summary/i.test(context.sceneArchetype ?? '')) {
    inferred.push('MORE_POST_EVENT');
  }
  if ((line.sceneRoles ?? EMPTY_TAGS).some((role) => /witness|crowd|public/i.test(role))) {
    inferred.push('MORE_PUBLIC');
  }

  return inferred;
}

function sortTransforms(values: readonly SharedChatRealizationTransform[]): SharedChatRealizationTransform[] {
  return [...values].sort((left, right) => {
    const byPriority = PRIORITY[left] - PRIORITY[right];
    if (byPriority !== 0) {
      return byPriority;
    }
    return left.localeCompare(right);
  });
}

function computeMotifCluster(line: SharedCanonicalChatLine): string {
  if (hasText(line.motifId)) {
    return line.motifId;
  }
  const lex = topTokens(line.text, 2);
  if (lex.length > 0) {
    return `motif:${lex.join('-')}`;
  }
  return `category:${toSlug(line.category) || 'generic'}`;
}

function computeRhetoricalBase(line: SharedCanonicalChatLine, signals: SignalVector): string {
  if (hasText(line.rhetoricalForm)) {
    return line.rhetoricalForm;
  }
  if (signals.tone === 'RITUAL') {
    return 'ritual-pronouncement';
  }
  if (signals.contempt >= 0.62) {
    return 'cutting-assertion';
  }
  if (signals.fear >= 0.58) {
    return 'pressure-escalation';
  }
  if (signals.fascination >= 0.56) {
    return 'controlled-observation';
  }
  return 'authored-base';
}

function computeOpeningLead(
  line: SharedCanonicalChatLine,
  context: SharedChatRealizationContext,
  signals: SignalVector,
  seed: number,
): string | null {
  const candidates: string[] = [];

  if (signals.tone === 'RITUAL') {
    candidates.push(phraseFromBand(RITUAL_LEADS, signals.heatBand, seed ^ 101));
  } else if (signals.tone === 'HOT') {
    candidates.push(phraseFromBand(HOT_LEADS, signals.heatBand, seed ^ 102));
  } else {
    candidates.push(phraseFromBand(CONTROLLED_LEADS, signals.heatBand, seed ^ 103));
  }

  if (signals.publicness === 'PUBLIC') {
    candidates.push(phraseFromBand(PUBLIC_LEADS, signals.heatBand, seed ^ 104));
  }
  if (signals.publicness === 'PRIVATE') {
    candidates.push(phraseFromBand(PRIVATE_LEADS, signals.heatBand, seed ^ 105));
  }
  if (hasText(context.callbackText)) {
    candidates.push(phraseFromBand(CALLBACK_LEADS, signals.heatBand, seed ^ 106));
  }
  if (hasText(context.callbackAnchorId)) {
    candidates.push(phraseFromBand(HISTORY_LEADS, signals.heatBand, seed ^ 107));
  }
  if ((line.tags ?? EMPTY_TAGS).some((tag) => /warning|telegraph|setup|pre/i.test(tag))) {
    candidates.push(phraseFromBand(PRE_EVENT_LEADS, signals.heatBand, seed ^ 108));
  }
  if ((line.tags ?? EMPTY_TAGS).some((tag) => /fallout|aftermath|post|witness|result/i.test(tag))) {
    candidates.push(phraseFromBand(POST_EVENT_LEADS, signals.heatBand, seed ^ 109));
  }

  const resolved = unique(candidates.filter(Boolean));
  if (resolved.length === 0) {
    return null;
  }
  return resolved[seededIndex(resolved.length, seed ^ 110)] ?? null;
}

function computeClosingEcho(signals: SignalVector, line: SharedCanonicalChatLine, seed: number): string | null {
  if ((line.tags ?? EMPTY_TAGS).some((tag) => /record|ledger|proof|witness/i.test(tag)) || signals.tone === 'RITUAL') {
    return chooseSeeded(RITUAL_CLOSERS, seed ^ 201);
  }
  if (signals.tone === 'ICE' || signals.cadence === 'TIGHT') {
    return chooseSeeded(COLD_CLOSERS, seed ^ 202);
  }
  return null;
}

function buildPlan(line: SharedCanonicalChatLine, context: SharedChatRealizationContext): RealizationPlan {
  const seed = hashSeed([
    line.canonicalLineId,
    line.botId,
    line.category,
    line.text,
    context.sceneId ?? '',
    context.sceneArchetype ?? '',
    context.sceneRole ?? '',
    context.pressureBand ?? '',
    context.relationshipEscalationTier ?? '',
    context.callbackAnchorId ?? '',
    context.playerAlias ?? '',
    `${context.now}`,
  ].join('|'));

  const signals = buildSignals(context);
  const explicitTransforms = unique(context.transforms ?? []);
  const inferredTransforms = unique(inferTransforms(line, context, signals));
  const transforms = sortTransforms(unique([...explicitTransforms, ...inferredTransforms]));

  return {
    seed,
    explicitTransforms,
    inferredTransforms: sortTransforms(inferredTransforms),
    transforms,
    signals,
    motifCluster: computeMotifCluster(line),
    rhetoricalBase: computeRhetoricalBase(line, signals),
    openingLead: computeOpeningLead(line, context, signals, seed),
    closingEcho: computeClosingEcho(signals, line, seed),
  };
}

function replacePersonalPronouns(text: string, alias: string): string {
  let output = text;
  for (const rule of INTIMACY_RULES) {
    output = output.replace(rule.pattern, rule.apply(alias));
  }
  return output;
}

function applySeededReplacements(
  text: string,
  replacements: ReadonlyArray<readonly [RegExp, readonly string[]]>,
  seed: number,
): string {
  let output = text;
  for (const [pattern, options] of replacements) {
    output = output.replace(pattern, chooseSeeded(options, seed ^ hashSeed(pattern.source)));
  }
  return output;
}

function realizeCallback(text: string, runtime: TransformRuntime): string {
  const callback = normalizePunctuation(runtime.context.callbackText ?? '');
  if (!callback) {
    return text;
  }

  const lead = phraseFromBand(CALLBACK_LEADS, runtime.plan.signals.heatBand, runtime.plan.seed ^ 301);
  const tail = chooseSeeded([
    `You said "${callback}." The room kept that.`,
    `Your earlier words — "${callback}." — remained active.`,
    `The callback is simple: "${callback}." It never left the room.`,
  ], runtime.plan.seed ^ 302);

  return appendTail(prependLead(text, lead), tail);
}

function realizePressure(text: string, runtime: TransformRuntime): string {
  const band = normalizeSpace(runtime.context.pressureBand ?? '').toUpperCase() || runtime.plan.signals.heatBand;
  const lead = chooseSeeded([
    `Pressure tier ${band}.`,
    'The structure is tightening.',
    'Nothing in the room is relaxing around this choice.',
  ], runtime.plan.seed ^ 401);

  const tail = runtime.plan.signals.heatBand === 'HIGH' || runtime.plan.signals.heatBand === 'CRITICAL'
    ? chooseSeeded([
      'Every witness is adjusting for consequence now.',
      'The sentence should be read with less optimism than it first invites.',
      'The room is already repricing what this means.',
    ], runtime.plan.seed ^ 402)
    : '';

  return tail ? appendTail(prependLead(text, lead), tail) : prependLead(text, lead);
}

function realizeHistory(text: string, runtime: TransformRuntime): string {
  const lead = phraseFromBand(HISTORY_LEADS, runtime.plan.signals.heatBand, runtime.plan.seed ^ 501);
  const tail = chooseSeeded([
    'This lands against previous contact, not empty air.',
    'History removes the luxury of pretending this is isolated.',
    'The past is doing some of the speaking here.',
  ], runtime.plan.seed ^ 502);

  return appendTail(prependLead(text, lead), tail);
}

function realizePublic(text: string, runtime: TransformRuntime): string {
  return prependLead(text, phraseFromBand(PUBLIC_LEADS, runtime.plan.signals.heatBand, runtime.plan.seed ^ 601));
}

function realizePreEvent(text: string, runtime: TransformRuntime): string {
  return prependLead(text, phraseFromBand(PRE_EVENT_LEADS, runtime.plan.signals.heatBand, runtime.plan.seed ^ 701));
}

function realizePostEvent(text: string, runtime: TransformRuntime): string {
  return prependLead(text, phraseFromBand(POST_EVENT_LEADS, runtime.plan.signals.heatBand, runtime.plan.seed ^ 702));
}

function realizeDirect(text: string, runtime: TransformRuntime): string {
  return applySeededReplacements(text, DIRECT_REPLACEMENTS, runtime.plan.seed ^ 801);
}

function realizeMocking(text: string, runtime: TransformRuntime): string {
  const output = applySeededReplacements(text, MOCKING_REPLACEMENTS, runtime.plan.seed ^ 901);
  return /[.?!]$/.test(output) ? output : `${output}.`;
}

function realizeIntimate(text: string, runtime: TransformRuntime): string {
  const alias = normalizeSpace(runtime.context.playerAlias ?? '');
  return alias ? replacePersonalPronouns(text, alias) : text;
}

function realizeShorterColder(text: string, runtime: TransformRuntime): string {
  const fragments = normalizePunctuation(text)
    .split(/(?<=[.?!])\s+/)
    .map((fragment) => normalizeSpace(fragment))
    .filter(Boolean);

  let selected = fragments;
  if (fragments.length >= 3) {
    selected = [fragments[0], fragments[fragments.length - 1]];
  } else if (fragments.length === 2 && runtime.plan.signals.heatBand !== 'LOW') {
    selected = [fragments[1]];
  }

  let output = normalizePunctuation(selected.join(' '));
  output = output
    .replace(/\bVery well\.\s*/gi, '')
    .replace(/\bInteresting\.\s*/gi, '')
    .replace(/\bFor the record,\s*/gi, '')
    .replace(/\bLet the room hear this plainly,\s*/gi, '');

  output = normalizePunctuation(output);
  return /[.?!]$/.test(output) ? output : `${output}.`;
}

function realizeLongerCeremonial(text: string, runtime: TransformRuntime): string {
  const lead = phraseFromBand(RITUAL_LEADS, runtime.plan.signals.heatBand, runtime.plan.seed ^ 1001);
  const tail = chooseSeeded(RITUAL_CLOSERS, runtime.plan.seed ^ 1002);
  return appendTail(prependLead(text, lead), tail);
}

function applyTransform(transform: SharedChatRealizationTransform, text: string, runtime: TransformRuntime): string {
  switch (transform) {
    case 'MORE_PUBLIC':
      return realizePublic(text, runtime);
    case 'CALLBACK_REWRITE':
      return realizeCallback(text, runtime);
    case 'PRESSURE_REWRITE':
      return realizePressure(text, runtime);
    case 'MORE_DIRECT':
      return realizeDirect(text, runtime);
    case 'MORE_MOCKING':
      return realizeMocking(text, runtime);
    case 'PERSONAL_HISTORY_REWRITE':
      return realizeHistory(text, runtime);
    case 'SHORTER_COLDER':
      return realizeShorterColder(text, runtime);
    case 'LONGER_CEREMONIAL':
      return realizeLongerCeremonial(text, runtime);
    case 'MORE_INTIMATE':
      return realizeIntimate(text, runtime);
    case 'MORE_POST_EVENT':
      return realizePostEvent(text, runtime);
    case 'MORE_PRE_EVENT':
      return realizePreEvent(text, runtime);
    default:
      return text;
  }
}

function finalizeText(text: string, line: SharedCanonicalChatLine, plan: RealizationPlan): string {
  let output = normalizePunctuation(text);

  if (plan.transforms.length === 0 && plan.openingLead && (plan.signals.publicness !== 'HYBRID' || plan.signals.tone === 'RITUAL')) {
    output = prependLead(output, plan.openingLead);
  }

  if (plan.closingEcho) {
    const witness = (line.tags ?? EMPTY_TAGS).some((tag) => /record|ledger|proof|witness/i.test(tag));
    if (witness || plan.signals.tone === 'RITUAL') {
      output = appendTail(output, plan.closingEcho);
    }
  }

  if (!/[.?!]$/.test(output)) {
    output = `${output}.`;
  }

  return normalizePunctuation(output);
}

function strategyString(line: SharedCanonicalChatLine, context: SharedChatRealizationContext, plan: RealizationPlan): string {
  return [
    `arch:${toSlug(context.sceneArchetype ?? 'freeplay') || 'freeplay'}`,
    `role:${toSlug(context.sceneRole ?? 'line') || 'line'}`,
    `pressure:${toSlug(context.pressureBand ?? 'calm') || 'calm'}`,
    `escalation:${toSlug(context.relationshipEscalationTier ?? 'none') || 'none'}`,
    `tone:${plan.signals.tone.toLowerCase()}`,
    `heat:${plan.signals.heatBand.toLowerCase()}`,
    `cadence:${plan.signals.cadence.toLowerCase()}`,
    `public:${plan.signals.publicness.toLowerCase()}`,
    `motif:${toSlug(plan.motifCluster) || 'generic'}`,
    `category:${toSlug(line.category) || 'generic'}`,
  ].join('|');
}

function rhetoricalIds(
  line: SharedCanonicalChatLine,
  context: SharedChatRealizationContext,
  plan: RealizationPlan,
): string[] {
  const ids: string[] = [
    plan.rhetoricalBase,
    `tone:${plan.signals.tone.toLowerCase()}`,
    `cadence:${plan.signals.cadence.toLowerCase()}`,
    `heat:${plan.signals.heatBand.toLowerCase()}`,
  ];

  if (hasText(context.sceneRole)) {
    ids.push(`scene-role:${toSlug(context.sceneRole ?? '')}`);
  }
  if (hasText(context.sceneArchetype)) {
    ids.push(`scene-archetype:${toSlug(context.sceneArchetype ?? '')}`);
  }
  for (const transform of plan.transforms) {
    ids.push(`transform:${transform.toLowerCase()}`);
  }
  for (const role of line.sceneRoles ?? EMPTY_TAGS) {
    ids.push(`line-scene-role:${toSlug(role)}`);
  }

  return unique(ids.filter(Boolean));
}

function semanticIds(
  line: SharedCanonicalChatLine,
  context: SharedChatRealizationContext,
  plan: RealizationPlan,
  realizedText: string,
): string[] {
  const ids: string[] = [
    plan.motifCluster,
    hasText(context.sceneArchetype) ? context.sceneArchetype! : 'scene-generic',
    hasText(context.sceneRole) ? context.sceneRole! : 'role-generic',
    `bot:${toSlug(line.botId) || 'unknown'}`,
    `category:${toSlug(line.category) || 'generic'}`,
    `tone:${plan.signals.tone.toLowerCase()}`,
  ];

  for (const token of topTokens(realizedText, 4)) {
    ids.push(`lex:${token}`);
  }
  if (hasText(line.targetPlayerTrait)) {
    ids.push(`trait:${toSlug(line.targetPlayerTrait ?? '')}`);
  }
  if (hasText(line.botObjective)) {
    ids.push(`objective:${toSlug(line.botObjective ?? '')}`);
  }
  if (hasText(line.emotionPayload)) {
    ids.push(`emotion:${toSlug(line.emotionPayload ?? '')}`);
  }

  return unique(ids.filter(Boolean));
}

function resultTags(
  line: SharedCanonicalChatLine,
  context: SharedChatRealizationContext,
  plan: RealizationPlan,
): string[] {
  const tags: string[] = [...(line.tags ?? EMPTY_TAGS)];
  tags.push(
    `surface-realizer:${CHAT_SURFACE_REALIZER_VERSION}`,
    `tone:${plan.signals.tone.toLowerCase()}`,
    `heat:${plan.signals.heatBand.toLowerCase()}`,
    `cadence:${plan.signals.cadence.toLowerCase()}`,
    `publicness:${plan.signals.publicness.toLowerCase()}`,
  );

  if (hasText(context.pressureBand)) {
    tags.push(`pressure:${toSlug(context.pressureBand ?? '')}`);
  }
  if (hasText(context.relationshipEscalationTier)) {
    tags.push(`relationship-escalation:${toSlug(context.relationshipEscalationTier ?? '')}`);
  }
  if (hasText(context.sceneArchetype)) {
    tags.push(`scene-archetype:${toSlug(context.sceneArchetype ?? '')}`);
  }
  if (hasText(context.sceneRole)) {
    tags.push(`scene-role:${toSlug(context.sceneRole ?? '')}`);
  }
  if (hasText(context.playerAlias)) {
    tags.push('player-alias-bound');
  }
  if (hasText(context.callbackText)) {
    tags.push('callback-active');
  }
  if (hasText(context.callbackAnchorId)) {
    tags.push('callback-anchor-bound');
  }
  for (const transform of plan.transforms) {
    tags.push(`transform-applied:${transform.toLowerCase()}`);
  }

  return unique(tags.filter(Boolean));
}

function surfaceVariantId(
  line: SharedCanonicalChatLine,
  strategy: string,
  realizedText: string,
  plan: RealizationPlan,
  context: SharedChatRealizationContext,
): string {
  const signature = [
    line.canonicalLineId,
    line.botId,
    strategy,
    realizedText,
    `${context.now}`,
    `${plan.seed}`,
  ].join('|');

  return `${line.canonicalLineId}:${hashSeed(signature).toString(16)}`;
}

export class ChatSurfaceRealizer {
  public readonly version = CHAT_SURFACE_REALIZER_VERSION;

  public realize(
    line: SharedCanonicalChatLine,
    context: SharedChatRealizationContext,
  ): SharedChatRealizationResult {
    const plan = buildPlan(line, context);
    const runtime: TransformRuntime = { line, context, plan };

    let text = normalizePunctuation(normalizeSpace(line.text));
    for (const transform of plan.transforms) {
      text = normalizePunctuation(applyTransform(transform, text, runtime));
    }
    text = finalizeText(text, line, plan);

    const strategy = strategyString(line, context, plan);
    const rhetoricalTemplateIds = rhetoricalIds(line, context, plan);
    const semanticClusterIds = semanticIds(line, context, plan, text);
    const tags = resultTags(line, context, plan);

    return {
      canonicalLineId: line.canonicalLineId,
      surfaceVariantId: surfaceVariantId(line, strategy, text, plan, context),
      strategy,
      realizedText: text,
      transformsApplied: plan.transforms,
      rhetoricalTemplateIds,
      semanticClusterIds,
      tags,
    };
  }

  public realizeMany(
    lines: readonly SharedCanonicalChatLine[],
    context: SharedChatRealizationContext,
  ): SharedChatRealizationResult[] {
    return lines.map((line) => this.realize(line, context));
  }

  public planTransforms(
    line: SharedCanonicalChatLine,
    context: SharedChatRealizationContext,
  ): readonly SharedChatRealizationTransform[] {
    return buildPlan(line, context).transforms;
  }

  public previewStrategy(
    line: SharedCanonicalChatLine,
    context: SharedChatRealizationContext,
  ): string {
    return strategyString(line, context, buildPlan(line, context));
  }
}

export function createChatSurfaceRealizer(): ChatSurfaceRealizer {
  return new ChatSurfaceRealizer();
}
