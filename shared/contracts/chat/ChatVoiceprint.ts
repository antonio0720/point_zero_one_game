/**
 * @file shared/contracts/chat/ChatVoiceprint.ts
 * @description
 * Canonical shared contract for authored chat voiceprints across the Point Zero One
 * chat stack. This file complements ChatPersona.ts by defining the low-level,
 * recognizable textual, rhythmic, punctuation, timing, and evidence-forward traits
 * that make one actor feel authored and distinct before any intelligence layer
 * ranks or emits a line.
 */

// ============================================================================
// MARK: Primitive aliases
// ============================================================================

export type ChatVoiceprintId = string;
export type ChatVoiceprintVersion = string;
export type ChatVoiceprintSlug = string;
export type ChatVoiceprintFamilyId = string;
export type ChatVoiceprintSampleId = string;
export type ChatVoiceprintPatternId = string;
export type ChatVoiceprintRuleId = string;
export type ChatVoiceprintPersonaId = string;
export type ChatVoiceprintActorId = string;
export type ChatVoiceprintChannelId = string;
export type ChatVoiceprintLocaleCode = string;
export type ChatVoiceprintTag = string;
export type ChatVoiceprintLabel = string;
export type ChatVoiceprintTimestampIso = string;
export type ChatVoiceprintToken = string;
export type ChatVoiceprintLexeme = string;
export type ChatVoiceprintTemplate = string;
export type ChatVoiceprintJsonPrimitive = string | number | boolean | null;
export type ChatVoiceprintJsonValue =
  | ChatVoiceprintJsonPrimitive
  | readonly ChatVoiceprintJsonValue[]
  | { readonly [key: string]: ChatVoiceprintJsonValue };

// ============================================================================
// MARK: Core unions
// ============================================================================

export type ChatVoiceprintRegister =
  | 'FORMAL'
  | 'TACTICAL'
  | 'STREET'
  | 'COLD'
  | 'RITUAL'
  | 'PROFESSIONAL'
  | 'AMBIENT'
  | 'ABRASIVE'
  | 'INTIMATE'
  | 'CEREMONIAL'
  | 'MECHANICAL';

export type ChatVoiceprintTempo =
  | 'STACCATO'
  | 'SHORT_BURST'
  | 'MEASURED'
  | 'WIDE_BREATH'
  | 'LURK_THEN_STRIKE'
  | 'SURGE'
  | 'DRIP'
  | 'FLOOD'
  | 'DELIBERATE';

export type ChatVoiceprintSyntaxMode =
  | 'FRAGMENTS'
  | 'CLEAN_SENTENCES'
  | 'RUN_ON'
  | 'STACKED_CLAUSES'
  | 'SPARSE'
  | 'PRESSURE_CUT'
  | 'COMMAND_HEAVY'
  | 'OBSERVATIONAL'
  | 'RITUALIZED';

export type ChatVoiceprintPunctuationMode =
  | 'MINIMAL'
  | 'BALANCED'
  | 'ELLIPSIS_HEAVY'
  | 'DASH_HEAVY'
  | 'QUESTION_HEAVY'
  | 'EXCLAMATION_HEAVY'
  | 'PERIOD_HEAVY'
  | 'LOWERCASE_DRIFT'
  | 'RIGID';

export type ChatVoiceprintCapitalizationMode =
  | 'STANDARD'
  | 'LOWERCASE'
  | 'UPPERCASE_SPIKES'
  | 'TITLE_STRIKES'
  | 'SENTENCE_CASE_ONLY';

export type ChatVoiceprintOpeningMode =
  | 'NONE'
  | 'NAME_LEAD'
  | 'QUOTE_LEAD'
  | 'COMMAND_LEAD'
  | 'QUESTION_LEAD'
  | 'RITUAL_LEAD'
  | 'MOCK_LEAD'
  | 'SYSTEM_LEAD'
  | 'WITNESS_LEAD';

export type ChatVoiceprintClosingMode =
  | 'NONE'
  | 'STING'
  | 'THREAT'
  | 'CHALLENGE'
  | 'ECHO'
  | 'RITUAL'
  | 'GUIDANCE'
  | 'CUT_TO_SILENCE'
  | 'RECEIPT';

export type ChatVoiceprintQuestionStyle =
  | 'NONE'
  | 'PROBING'
  | 'BAITING'
  | 'LEADING'
  | 'CLINICAL'
  | 'SARDONIC'
  | 'CARETAKING';

export type ChatVoiceprintMockeryStyle =
  | 'NONE'
  | 'LIGHT'
  | 'SARCASTIC'
  | 'CONDESCENDING'
  | 'PUBLIC_SHAME'
  | 'KNIFE_TWIST'
  | 'HUNGER';

export type ChatVoiceprintTendernessStyle =
  | 'NONE'
  | 'QUIET'
  | 'SOFT'
  | 'FIRM_KINDNESS'
  | 'TRIAGE_KINDNESS'
  | 'RITUAL_COMFORT';

export type ChatVoiceprintEvidenceHookMode =
  | 'NONE'
  | 'QUOTE'
  | 'CALLBACK'
  | 'PROOF'
  | 'WITNESS'
  | 'DEAL_RECEIPT'
  | 'RUN_MEMORY'
  | 'LEGEND';

export type ChatVoiceprintReadEffect =
  | 'UNREAD_PRESSURE'
  | 'SEEN_AND_WAIT'
  | 'IMMEDIATE_READ'
  | 'TACTICAL_HIDE'
  | 'PUBLIC_SEEN'
  | 'PRIVATE_SEEN';

export type ChatVoiceprintTypingEffect =
  | 'NO_TYPING'
  | 'SHORT_TYPING'
  | 'LONG_TYPING'
  | 'FAKE_START_STOP'
  | 'RAPID_BURST'
  | 'HEAVY_PAUSE'
  | 'THEATRICAL';

export type ChatVoiceprintValidationIssueCode =
  | 'EMPTY_ID'
  | 'EMPTY_NAME'
  | 'INVALID_WEIGHT'
  | 'INVALID_RANGE'
  | 'DUPLICATE_TEMPLATE'
  | 'DUPLICATE_TOKEN'
  | 'EMPTY_SAMPLE'
  | 'UNKNOWN';

// ============================================================================
// MARK: Structural types
// ============================================================================

export interface ChatVoiceprintAuditStamp {
  readonly createdAt: ChatVoiceprintTimestampIso;
  readonly updatedAt: ChatVoiceprintTimestampIso;
  readonly createdBy?: string;
  readonly updatedBy?: string;
  readonly source?: string;
  readonly reason?: string;
}

export interface ChatVoiceprintWordEnvelope {
  readonly minWords: number;
  readonly preferredWords: number;
  readonly maxWords: number;
  readonly shortBurstThreshold: number;
  readonly longFormThreshold: number;
}

export interface ChatVoiceprintSentenceEnvelope {
  readonly minSentences: number;
  readonly preferredSentences: number;
  readonly maxSentences: number;
  readonly fragmentBias: number;
  readonly clauseStackBias: number;
}

export interface ChatVoiceprintRhythmProfile {
  readonly tempo: ChatVoiceprintTempo;
  readonly pauseBias: number;
  readonly interruptBias: number;
  readonly beatHoldBias: number;
  readonly repeatBias: number;
  readonly burstBias: number;
  readonly driftBias: number;
}

export interface ChatVoiceprintPunctuationProfile {
  readonly mode: ChatVoiceprintPunctuationMode;
  readonly periods: number;
  readonly commas: number;
  readonly ellipses: number;
  readonly dashes: number;
  readonly questions: number;
  readonly exclamations: number;
  readonly semicolons: number;
  readonly colons: number;
  readonly doubleMarks: number;
}

export interface ChatVoiceprintCapitalizationProfile {
  readonly mode: ChatVoiceprintCapitalizationMode;
  readonly lowercaseBias: number;
  readonly uppercaseSpikeBias: number;
  readonly titleStrikeBias: number;
  readonly rigidSentenceCaseBias: number;
}

export interface ChatVoiceprintLexiconProfile {
  readonly favored: readonly ChatVoiceprintLexeme[];
  readonly allowed: readonly ChatVoiceprintLexeme[];
  readonly forbidden: readonly ChatVoiceprintLexeme[];
  readonly phrasebook: readonly ChatVoiceprintTemplate[];
  readonly intensifiers: readonly ChatVoiceprintToken[];
  readonly softeners: readonly ChatVoiceprintToken[];
  readonly sarcasmMarkers: readonly ChatVoiceprintToken[];
}

export interface ChatVoiceprintOpeningProfile {
  readonly mode: ChatVoiceprintOpeningMode;
  readonly templates: readonly ChatVoiceprintTemplate[];
  readonly weight: number;
}

export interface ChatVoiceprintClosingProfile {
  readonly mode: ChatVoiceprintClosingMode;
  readonly templates: readonly ChatVoiceprintTemplate[];
  readonly weight: number;
}

export interface ChatVoiceprintQuestionProfile {
  readonly style: ChatVoiceprintQuestionStyle;
  readonly weight: number;
  readonly templates: readonly ChatVoiceprintTemplate[];
}

export interface ChatVoiceprintMockeryProfile {
  readonly style: ChatVoiceprintMockeryStyle;
  readonly weight: number;
  readonly templates: readonly ChatVoiceprintTemplate[];
}

export interface ChatVoiceprintTendernessProfile {
  readonly style: ChatVoiceprintTendernessStyle;
  readonly weight: number;
  readonly templates: readonly ChatVoiceprintTemplate[];
}

export interface ChatVoiceprintEvidenceHookProfile {
  readonly mode: ChatVoiceprintEvidenceHookMode;
  readonly quoteBias: number;
  readonly callbackBias: number;
  readonly proofBias: number;
  readonly witnessBias: number;
  readonly memoryBias: number;
  readonly legendBias: number;
}

export interface ChatVoiceprintTimingProfile {
  readonly readEffect: ChatVoiceprintReadEffect;
  readonly typingEffect: ChatVoiceprintTypingEffect;
  readonly minDelayMs: number;
  readonly preferredDelayMs: number;
  readonly maxDelayMs: number;
  readonly seenHoldMs: number;
  readonly typingLeadMs: number;
}

export interface ChatVoiceprintSample {
  readonly id: ChatVoiceprintSampleId;
  readonly weight: number;
  readonly contextLabel?: string;
  readonly text: string;
}

export interface ChatVoiceprintContextRule {
  readonly id: ChatVoiceprintRuleId;
  readonly channelIds: readonly ChatVoiceprintChannelId[];
  readonly minHeat?: number;
  readonly maxHeat?: number;
  readonly publicBias?: number;
  readonly privateBias?: number;
  readonly dealBias?: number;
  readonly evidenceRequired?: boolean;
  readonly labels?: readonly ChatVoiceprintLabel[];
}

export interface ChatVoiceprintSignaturePacket {
  readonly opener: readonly string[];
  readonly closer: readonly string[];
  readonly interstitial: readonly string[];
  readonly quoteHooks: readonly string[];
  readonly pressureHooks: readonly string[];
  readonly mercyHooks: readonly string[];
  readonly victoryHooks: readonly string[];
  readonly lossHooks: readonly string[];
}

export interface ChatVoiceprintDefinition {
  readonly id: ChatVoiceprintId;
  readonly version: ChatVoiceprintVersion;
  readonly slug: ChatVoiceprintSlug;
  readonly displayName: string;
  readonly register: ChatVoiceprintRegister;
  readonly personaId?: ChatVoiceprintPersonaId;
  readonly actorId?: ChatVoiceprintActorId;
  readonly familyId?: ChatVoiceprintFamilyId;
  readonly locale?: ChatVoiceprintLocaleCode;
  readonly labels: readonly ChatVoiceprintLabel[];
  readonly tags: readonly ChatVoiceprintTag[];
  readonly description: string;
  readonly authoredIntent: string;
  readonly syntaxMode: ChatVoiceprintSyntaxMode;
  readonly wordEnvelope: ChatVoiceprintWordEnvelope;
  readonly sentenceEnvelope: ChatVoiceprintSentenceEnvelope;
  readonly rhythm: ChatVoiceprintRhythmProfile;
  readonly punctuation: ChatVoiceprintPunctuationProfile;
  readonly capitalization: ChatVoiceprintCapitalizationProfile;
  readonly lexicon: ChatVoiceprintLexiconProfile;
  readonly opening: ChatVoiceprintOpeningProfile;
  readonly closing: ChatVoiceprintClosingProfile;
  readonly questioning: ChatVoiceprintQuestionProfile;
  readonly mockery: ChatVoiceprintMockeryProfile;
  readonly tenderness: ChatVoiceprintTendernessProfile;
  readonly evidenceHooks: ChatVoiceprintEvidenceHookProfile;
  readonly timing: ChatVoiceprintTimingProfile;
  readonly signatures: ChatVoiceprintSignaturePacket;
  readonly contextRules: readonly ChatVoiceprintContextRule[];
  readonly samples: readonly ChatVoiceprintSample[];
  readonly custom?: Readonly<Record<string, ChatVoiceprintJsonValue>>;
  readonly audit?: ChatVoiceprintAuditStamp;
}

export interface ChatVoiceprintPatch {
  readonly displayName?: string;
  readonly register?: ChatVoiceprintRegister;
  readonly description?: string;
  readonly authoredIntent?: string;
  readonly syntaxMode?: ChatVoiceprintSyntaxMode;
  readonly wordEnvelope?: Partial<ChatVoiceprintWordEnvelope>;
  readonly sentenceEnvelope?: Partial<ChatVoiceprintSentenceEnvelope>;
  readonly rhythm?: Partial<ChatVoiceprintRhythmProfile>;
  readonly punctuation?: Partial<ChatVoiceprintPunctuationProfile>;
  readonly capitalization?: Partial<ChatVoiceprintCapitalizationProfile>;
  readonly lexicon?: Partial<ChatVoiceprintLexiconProfile>;
  readonly opening?: Partial<ChatVoiceprintOpeningProfile>;
  readonly closing?: Partial<ChatVoiceprintClosingProfile>;
  readonly questioning?: Partial<ChatVoiceprintQuestionProfile>;
  readonly mockery?: Partial<ChatVoiceprintMockeryProfile>;
  readonly tenderness?: Partial<ChatVoiceprintTendernessProfile>;
  readonly evidenceHooks?: Partial<ChatVoiceprintEvidenceHookProfile>;
  readonly timing?: Partial<ChatVoiceprintTimingProfile>;
  readonly signatures?: Partial<ChatVoiceprintSignaturePacket>;
  readonly contextRules?: readonly ChatVoiceprintContextRule[];
  readonly samples?: readonly ChatVoiceprintSample[];
  readonly labels?: readonly ChatVoiceprintLabel[];
  readonly tags?: readonly ChatVoiceprintTag[];
  readonly custom?: Readonly<Record<string, ChatVoiceprintJsonValue>>;
}

export interface ChatVoiceprintValidationIssue {
  readonly code: ChatVoiceprintValidationIssueCode;
  readonly path: string;
  readonly message: string;
  readonly severity: 'INFO' | 'WARN' | 'ERROR';
}

export interface ChatVoiceprintValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ChatVoiceprintValidationIssue[];
}

export interface ChatVoiceprintSummary {
  readonly id: ChatVoiceprintId;
  readonly version: ChatVoiceprintVersion;
  readonly displayName: string;
  readonly register: ChatVoiceprintRegister;
  readonly syntaxMode: ChatVoiceprintSyntaxMode;
  readonly tempo: ChatVoiceprintTempo;
  readonly punctuationMode: ChatVoiceprintPunctuationMode;
  readonly capitalizationMode: ChatVoiceprintCapitalizationMode;
  readonly evidenceMode: ChatVoiceprintEvidenceHookMode;
  readonly labels: readonly ChatVoiceprintLabel[];
  readonly tags: readonly ChatVoiceprintTag[];
}

// ============================================================================
// MARK: Defaults
// ============================================================================

export const DEFAULT_CHAT_VOICEPRINT_WORD_ENVELOPE: Readonly<ChatVoiceprintWordEnvelope> = {
  minWords: 2,
  preferredWords: 12,
  maxWords: 28,
  shortBurstThreshold: 6,
  longFormThreshold: 22,
};

export const DEFAULT_CHAT_VOICEPRINT_SENTENCE_ENVELOPE: Readonly<ChatVoiceprintSentenceEnvelope> = {
  minSentences: 1,
  preferredSentences: 2,
  maxSentences: 4,
  fragmentBias: 0.2,
  clauseStackBias: 0.2,
};

export const DEFAULT_CHAT_VOICEPRINT_RHYTHM: Readonly<ChatVoiceprintRhythmProfile> = {
  tempo: 'MEASURED',
  pauseBias: 0.3,
  interruptBias: 0.25,
  beatHoldBias: 0.3,
  repeatBias: 0.15,
  burstBias: 0.22,
  driftBias: 0.18,
};

export const DEFAULT_CHAT_VOICEPRINT_PUNCTUATION: Readonly<ChatVoiceprintPunctuationProfile> = {
  mode: 'BALANCED',
  periods: 0.6,
  commas: 0.45,
  ellipses: 0.1,
  dashes: 0.12,
  questions: 0.15,
  exclamations: 0.08,
  semicolons: 0.02,
  colons: 0.03,
  doubleMarks: 0.01,
};

export const DEFAULT_CHAT_VOICEPRINT_CAPITALIZATION: Readonly<ChatVoiceprintCapitalizationProfile> = {
  mode: 'STANDARD',
  lowercaseBias: 0.2,
  uppercaseSpikeBias: 0.02,
  titleStrikeBias: 0.01,
  rigidSentenceCaseBias: 0.8,
};

export const DEFAULT_CHAT_VOICEPRINT_LEXICON: Readonly<ChatVoiceprintLexiconProfile> = {
  favored: [],
  allowed: [],
  forbidden: [],
  phrasebook: [],
  intensifiers: [],
  softeners: [],
  sarcasmMarkers: [],
};

export const DEFAULT_CHAT_VOICEPRINT_OPENING: Readonly<ChatVoiceprintOpeningProfile> = {
  mode: 'NONE',
  templates: [],
  weight: 0,
};

export const DEFAULT_CHAT_VOICEPRINT_CLOSING: Readonly<ChatVoiceprintClosingProfile> = {
  mode: 'NONE',
  templates: [],
  weight: 0,
};

export const DEFAULT_CHAT_VOICEPRINT_QUESTIONING: Readonly<ChatVoiceprintQuestionProfile> = {
  style: 'NONE',
  weight: 0,
  templates: [],
};

export const DEFAULT_CHAT_VOICEPRINT_MOCKERY: Readonly<ChatVoiceprintMockeryProfile> = {
  style: 'NONE',
  weight: 0,
  templates: [],
};

export const DEFAULT_CHAT_VOICEPRINT_TENDERNESS: Readonly<ChatVoiceprintTendernessProfile> = {
  style: 'NONE',
  weight: 0,
  templates: [],
};

export const DEFAULT_CHAT_VOICEPRINT_EVIDENCE_HOOKS: Readonly<ChatVoiceprintEvidenceHookProfile> = {
  mode: 'NONE',
  quoteBias: 0,
  callbackBias: 0,
  proofBias: 0,
  witnessBias: 0,
  memoryBias: 0,
  legendBias: 0,
};

export const DEFAULT_CHAT_VOICEPRINT_TIMING: Readonly<ChatVoiceprintTimingProfile> = {
  readEffect: 'IMMEDIATE_READ',
  typingEffect: 'SHORT_TYPING',
  minDelayMs: 0,
  preferredDelayMs: 900,
  maxDelayMs: 4500,
  seenHoldMs: 0,
  typingLeadMs: 400,
};

export const DEFAULT_CHAT_VOICEPRINT_SIGNATURE_PACKET: Readonly<ChatVoiceprintSignaturePacket> = {
  opener: [],
  closer: [],
  interstitial: [],
  quoteHooks: [],
  pressureHooks: [],
  mercyHooks: [],
  victoryHooks: [],
  lossHooks: [],
};

// ============================================================================
// MARK: Utility
// ============================================================================

export function clampVoiceprintUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function normalizeVoiceprintStrings(values: readonly string[] | undefined): readonly string[] {
  if (!values?.length) return [];
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function createDefaultVoiceprintDefinition(
  id: ChatVoiceprintId,
  displayName: string,
): ChatVoiceprintDefinition {
  return {
    id,
    version: '1.0.0',
    slug: displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    displayName,
    register: 'TACTICAL',
    labels: [],
    tags: [],
    description: '',
    authoredIntent: '',
    syntaxMode: 'CLEAN_SENTENCES',
    wordEnvelope: DEFAULT_CHAT_VOICEPRINT_WORD_ENVELOPE,
    sentenceEnvelope: DEFAULT_CHAT_VOICEPRINT_SENTENCE_ENVELOPE,
    rhythm: DEFAULT_CHAT_VOICEPRINT_RHYTHM,
    punctuation: DEFAULT_CHAT_VOICEPRINT_PUNCTUATION,
    capitalization: DEFAULT_CHAT_VOICEPRINT_CAPITALIZATION,
    lexicon: DEFAULT_CHAT_VOICEPRINT_LEXICON,
    opening: DEFAULT_CHAT_VOICEPRINT_OPENING,
    closing: DEFAULT_CHAT_VOICEPRINT_CLOSING,
    questioning: DEFAULT_CHAT_VOICEPRINT_QUESTIONING,
    mockery: DEFAULT_CHAT_VOICEPRINT_MOCKERY,
    tenderness: DEFAULT_CHAT_VOICEPRINT_TENDERNESS,
    evidenceHooks: DEFAULT_CHAT_VOICEPRINT_EVIDENCE_HOOKS,
    timing: DEFAULT_CHAT_VOICEPRINT_TIMING,
    signatures: DEFAULT_CHAT_VOICEPRINT_SIGNATURE_PACKET,
    contextRules: [],
    samples: [],
  };
}

export function applyVoiceprintPatch(
  voiceprint: ChatVoiceprintDefinition,
  patch: ChatVoiceprintPatch,
): ChatVoiceprintDefinition {
  return {
    ...voiceprint,
    displayName: patch.displayName ?? voiceprint.displayName,
    register: patch.register ?? voiceprint.register,
    description: patch.description ?? voiceprint.description,
    authoredIntent: patch.authoredIntent ?? voiceprint.authoredIntent,
    syntaxMode: patch.syntaxMode ?? voiceprint.syntaxMode,
    wordEnvelope: { ...voiceprint.wordEnvelope, ...patch.wordEnvelope },
    sentenceEnvelope: { ...voiceprint.sentenceEnvelope, ...patch.sentenceEnvelope },
    rhythm: { ...voiceprint.rhythm, ...patch.rhythm },
    punctuation: { ...voiceprint.punctuation, ...patch.punctuation },
    capitalization: { ...voiceprint.capitalization, ...patch.capitalization },
    lexicon: { ...voiceprint.lexicon, ...patch.lexicon },
    opening: { ...voiceprint.opening, ...patch.opening },
    closing: { ...voiceprint.closing, ...patch.closing },
    questioning: { ...voiceprint.questioning, ...patch.questioning },
    mockery: { ...voiceprint.mockery, ...patch.mockery },
    tenderness: { ...voiceprint.tenderness, ...patch.tenderness },
    evidenceHooks: { ...voiceprint.evidenceHooks, ...patch.evidenceHooks },
    timing: { ...voiceprint.timing, ...patch.timing },
    signatures: { ...voiceprint.signatures, ...patch.signatures },
    contextRules: patch.contextRules ?? voiceprint.contextRules,
    samples: patch.samples ?? voiceprint.samples,
    labels: normalizeVoiceprintStrings(patch.labels ?? voiceprint.labels),
    tags: normalizeVoiceprintStrings(patch.tags ?? voiceprint.tags),
    custom: patch.custom ?? voiceprint.custom,
  };
}

export function summarizeVoiceprint(voiceprint: ChatVoiceprintDefinition): ChatVoiceprintSummary {
  return {
    id: voiceprint.id,
    version: voiceprint.version,
    displayName: voiceprint.displayName,
    register: voiceprint.register,
    syntaxMode: voiceprint.syntaxMode,
    tempo: voiceprint.rhythm.tempo,
    punctuationMode: voiceprint.punctuation.mode,
    capitalizationMode: voiceprint.capitalization.mode,
    evidenceMode: voiceprint.evidenceHooks.mode,
    labels: voiceprint.labels,
    tags: voiceprint.tags,
  };
}

export function validateVoiceprintDefinition(
  voiceprint: ChatVoiceprintDefinition,
): ChatVoiceprintValidationResult {
  const issues: ChatVoiceprintValidationIssue[] = [];
  if (!voiceprint.id.trim()) {
    issues.push({ code: 'EMPTY_ID', path: 'id', message: 'Voiceprint id cannot be empty.', severity: 'ERROR' });
  }
  if (!voiceprint.displayName.trim()) {
    issues.push({ code: 'EMPTY_NAME', path: 'displayName', message: 'Voiceprint displayName cannot be empty.', severity: 'ERROR' });
  }
  const numericFields: Array<[string, number]> = [
    ['wordEnvelope.minWords', voiceprint.wordEnvelope.minWords],
    ['wordEnvelope.preferredWords', voiceprint.wordEnvelope.preferredWords],
    ['wordEnvelope.maxWords', voiceprint.wordEnvelope.maxWords],
    ['sentenceEnvelope.minSentences', voiceprint.sentenceEnvelope.minSentences],
    ['sentenceEnvelope.preferredSentences', voiceprint.sentenceEnvelope.preferredSentences],
    ['sentenceEnvelope.maxSentences', voiceprint.sentenceEnvelope.maxSentences],
    ['timing.minDelayMs', voiceprint.timing.minDelayMs],
    ['timing.preferredDelayMs', voiceprint.timing.preferredDelayMs],
    ['timing.maxDelayMs', voiceprint.timing.maxDelayMs],
  ];
  for (const [path, value] of numericFields) {
    if (!Number.isFinite(value)) {
      issues.push({ code: 'INVALID_RANGE', path, message: `${path} must be finite.`, severity: 'ERROR' });
    }
  }
  const seen = new Set<string>();
  for (const sample of voiceprint.samples) {
    if (!sample.text.trim()) {
      issues.push({ code: 'EMPTY_SAMPLE', path: 'samples', message: `Sample ${sample.id} is empty.`, severity: 'WARN' });
    }
    if (seen.has(sample.text)) {
      issues.push({ code: 'DUPLICATE_TEMPLATE', path: 'samples', message: `Duplicate sample text detected.`, severity: 'WARN' });
    }
    seen.add(sample.text);
  }
  return { ok: !issues.some((i) => i.severity === 'ERROR'), issues };
}

// ============================================================================
// MARK: Projection helpers
// ============================================================================

export interface ChatVoiceprintProjection {
  readonly bite: number;
  readonly softness: number;
  readonly formality: number;
  readonly theatricality: number;
  readonly questionPressure: number;
  readonly evidencePressure: number;
  readonly rhythmTightness: number;
}

export function deriveVoiceprintProjection(
  voiceprint: ChatVoiceprintDefinition,
): ChatVoiceprintProjection {
  const bite =
    clampVoiceprintUnit(
      voiceprint.mockery.weight * 0.35 +
        voiceprint.questioning.weight * 0.12 +
        voiceprint.evidenceHooks.quoteBias * 0.15 +
        voiceprint.evidenceHooks.callbackBias * 0.12 +
        voiceprint.rhythm.interruptBias * 0.14 +
        (voiceprint.syntaxMode === 'PRESSURE_CUT' ? 0.12 : 0),
    );

  const softness =
    clampVoiceprintUnit(
      voiceprint.tenderness.weight * 0.5 +
        voiceprint.evidenceHooks.memoryBias * 0.12 +
        voiceprint.rhythm.pauseBias * 0.1 +
        (voiceprint.register === 'INTIMATE' ? 0.18 : 0),
    );

  const formality =
    clampVoiceprintUnit(
      (voiceprint.register === 'FORMAL' ? 0.55 : 0) +
        (voiceprint.register === 'PROFESSIONAL' ? 0.42 : 0) +
        voiceprint.capitalization.rigidSentenceCaseBias * 0.12 +
        voiceprint.punctuation.colons * 0.08 +
        voiceprint.punctuation.semicolons * 0.08,
    );

  const theatricality =
    clampVoiceprintUnit(
      voiceprint.rhythm.beatHoldBias * 0.2 +
        voiceprint.rhythm.driftBias * 0.1 +
        voiceprint.punctuation.ellipses * 0.18 +
        (voiceprint.timing.typingEffect === 'THEATRICAL' ? 0.28 : 0) +
        (voiceprint.opening.mode === 'RITUAL_LEAD' ? 0.12 : 0) +
        (voiceprint.closing.mode === 'RITUAL' ? 0.12 : 0),
    );

  const questionPressure =
    clampVoiceprintUnit(
      voiceprint.questioning.weight * 0.5 +
        voiceprint.punctuation.questions * 0.22 +
        (voiceprint.questioning.style === 'BAITING' ? 0.18 : 0),
    );

  const evidencePressure =
    clampVoiceprintUnit(
      voiceprint.evidenceHooks.quoteBias * 0.18 +
        voiceprint.evidenceHooks.callbackBias * 0.18 +
        voiceprint.evidenceHooks.proofBias * 0.18 +
        voiceprint.evidenceHooks.witnessBias * 0.14 +
        voiceprint.evidenceHooks.legendBias * 0.12,
    );

  const rhythmTightness =
    clampVoiceprintUnit(
      voiceprint.rhythm.interruptBias * 0.22 +
        voiceprint.rhythm.burstBias * 0.15 +
        (voiceprint.rhythm.tempo === 'STACCATO' ? 0.2 : 0) +
        (voiceprint.rhythm.tempo === 'SHORT_BURST' ? 0.15 : 0),
    );

  return {
    bite,
    softness,
    formality,
    theatricality,
    questionPressure,
    evidencePressure,
    rhythmTightness,
  };
}

// ============================================================================
// MARK: Preset SYSTEM_RIGID
// ============================================================================

export function createPresetSYSTEM_RIGIDVoiceprint(
  id: ChatVoiceprintId,
  displayName = 'System Rigid',
): ChatVoiceprintDefinition {
  return applyVoiceprintPatch(createDefaultVoiceprintDefinition(id, displayName), {
    register: 'FORMAL',
    syntaxMode: 'CLEAN_SENTENCES',
    description: 'Generated preset voiceprint for SYSTEM_RIGID.',
    authoredIntent: 'Provide authored voice rhythm for SYSTEM_RIGID.',
    punctuation: {
      ...DEFAULT_CHAT_VOICEPRINT_PUNCTUATION,
      mode: 'PERIOD_HEAVY',
      periods: 0.8,
      commas: 0.45,
      ellipses: 0.08,
      dashes: 0.12,
      questions: 0.12,
      exclamations: 0.05,
    },
    opening: {
      mode: 'SYSTEM_LEAD',
      weight: 0.72,
      templates: ['template:system_rigid:open:1', 'template:system_rigid:open:2'],
    },
    closing: {
      mode: 'CUT_TO_SILENCE',
      weight: 0.75,
      templates: ['template:system_rigid:close:1', 'template:system_rigid:close:2'],
    },
    questioning: {
      style: 'NONE',
      weight: 0.1,
      templates: ['template:system_rigid:question:1'],
    },
    mockery: {
      style: 'NONE',
      weight: 0.05,
      templates: ['template:system_rigid:mock:1', 'template:system_rigid:mock:2'],
    },
    tenderness: {
      style: 'NONE',
      weight: 0,
      templates: ['template:system_rigid:care:1'],
    },
    evidenceHooks: {
      ...DEFAULT_CHAT_VOICEPRINT_EVIDENCE_HOOKS,
      mode: 'PROOF',
      quoteBias: 0.22,
      callbackBias: 0.3,
      proofBias: 0.84,
      witnessBias: 0.2,
      memoryBias: 0.28,
      legendBias: 0.7,
    },
    timing: {
      ...DEFAULT_CHAT_VOICEPRINT_TIMING,
      readEffect: 'IMMEDIATE_READ',
      typingEffect: 'SHORT_TYPING',
      preferredDelayMs: 320,
      maxDelayMs: 2000,
      seenHoldMs: 0,
    },
    labels: ['preset', 'formal', 'system_rigid'],
    tags: ['system_rigid', 'formal', 'clean_sentences'],
    samples: [
      { id: 'system_rigid-sample-1', weight: 1, text: 'sample:system_rigid:1' },
      { id: 'system_rigid-sample-2', weight: 0.75, text: 'sample:system_rigid:2' },
      { id: 'system_rigid-sample-3', weight: 0.5, text: 'sample:system_rigid:3' },
    ],
    signatures: {
      opener: ['sig:system_rigid:open:1'],
      closer: ['sig:system_rigid:close:1'],
      interstitial: ['sig:system_rigid:inter:1'],
      quoteHooks: ['sig:system_rigid:quote:1'],
      pressureHooks: ['sig:system_rigid:pressure:1'],
      mercyHooks: ['sig:system_rigid:mercy:1'],
      victoryHooks: ['sig:system_rigid:victory:1'],
      lossHooks: ['sig:system_rigid:loss:1'],
    },
  });
}


// ============================================================================
// MARK: Preset HATER_KNIFE
// ============================================================================

export function createPresetHATER_KNIFEVoiceprint(
  id: ChatVoiceprintId,
  displayName = 'Hater Knife',
): ChatVoiceprintDefinition {
  return applyVoiceprintPatch(createDefaultVoiceprintDefinition(id, displayName), {
    register: 'ABRASIVE',
    syntaxMode: 'PRESSURE_CUT',
    description: 'Generated preset voiceprint for HATER_KNIFE.',
    authoredIntent: 'Provide authored voice rhythm for HATER_KNIFE.',
    punctuation: {
      ...DEFAULT_CHAT_VOICEPRINT_PUNCTUATION,
      mode: 'DASH_HEAVY',
      periods: 0.5,
      commas: 0.45,
      ellipses: 0.08,
      dashes: 0.65,
      questions: 0.6,
      exclamations: 0.05,
    },
    opening: {
      mode: 'MOCK_LEAD',
      weight: 0.72,
      templates: ['template:hater_knife:open:1', 'template:hater_knife:open:2'],
    },
    closing: {
      mode: 'STING',
      weight: 0.75,
      templates: ['template:hater_knife:close:1', 'template:hater_knife:close:2'],
    },
    questioning: {
      style: 'BAITING',
      weight: 0.7,
      templates: ['template:hater_knife:question:1'],
    },
    mockery: {
      style: 'KNIFE_TWIST',
      weight: 0.85,
      templates: ['template:hater_knife:mock:1', 'template:hater_knife:mock:2'],
    },
    tenderness: {
      style: 'NONE',
      weight: 0,
      templates: ['template:hater_knife:care:1'],
    },
    evidenceHooks: {
      ...DEFAULT_CHAT_VOICEPRINT_EVIDENCE_HOOKS,
      mode: 'QUOTE',
      quoteBias: 0.82,
      callbackBias: 0.3,
      proofBias: 0.25,
      witnessBias: 0.2,
      memoryBias: 0.28,
      legendBias: 0.18,
    },
    timing: {
      ...DEFAULT_CHAT_VOICEPRINT_TIMING,
      readEffect: 'TACTICAL_HIDE',
      typingEffect: 'RAPID_BURST',
      preferredDelayMs: 650,
      maxDelayMs: 3600,
      seenHoldMs: 0,
    },
    labels: ['preset', 'abrasive', 'hater_knife'],
    tags: ['hater_knife', 'abrasive', 'pressure_cut'],
    samples: [
      { id: 'hater_knife-sample-1', weight: 1, text: 'sample:hater_knife:1' },
      { id: 'hater_knife-sample-2', weight: 0.75, text: 'sample:hater_knife:2' },
      { id: 'hater_knife-sample-3', weight: 0.5, text: 'sample:hater_knife:3' },
    ],
    signatures: {
      opener: ['sig:hater_knife:open:1'],
      closer: ['sig:hater_knife:close:1'],
      interstitial: ['sig:hater_knife:inter:1'],
      quoteHooks: ['sig:hater_knife:quote:1'],
      pressureHooks: ['sig:hater_knife:pressure:1'],
      mercyHooks: ['sig:hater_knife:mercy:1'],
      victoryHooks: ['sig:hater_knife:victory:1'],
      lossHooks: ['sig:hater_knife:loss:1'],
    },
  });
}


// ============================================================================
// MARK: Preset HELPER_STEADY
// ============================================================================

export function createPresetHELPER_STEADYVoiceprint(
  id: ChatVoiceprintId,
  displayName = 'Helper Steady',
): ChatVoiceprintDefinition {
  return applyVoiceprintPatch(createDefaultVoiceprintDefinition(id, displayName), {
    register: 'TACTICAL',
    syntaxMode: 'CLEAN_SENTENCES',
    description: 'Generated preset voiceprint for HELPER_STEADY.',
    authoredIntent: 'Provide authored voice rhythm for HELPER_STEADY.',
    punctuation: {
      ...DEFAULT_CHAT_VOICEPRINT_PUNCTUATION,
      mode: 'BALANCED',
      periods: 0.5,
      commas: 0.45,
      ellipses: 0.08,
      dashes: 0.12,
      questions: 0.6,
      exclamations: 0.05,
    },
    opening: {
      mode: 'NONE',
      weight: 0.72,
      templates: ['template:helper_steady:open:1', 'template:helper_steady:open:2'],
    },
    closing: {
      mode: 'GUIDANCE',
      weight: 0.75,
      templates: ['template:helper_steady:close:1', 'template:helper_steady:close:2'],
    },
    questioning: {
      style: 'PROBING',
      weight: 0.7,
      templates: ['template:helper_steady:question:1'],
    },
    mockery: {
      style: 'NONE',
      weight: 0.05,
      templates: ['template:helper_steady:mock:1', 'template:helper_steady:mock:2'],
    },
    tenderness: {
      style: 'FIRM_KINDNESS',
      weight: 0.68,
      templates: ['template:helper_steady:care:1'],
    },
    evidenceHooks: {
      ...DEFAULT_CHAT_VOICEPRINT_EVIDENCE_HOOKS,
      mode: 'CALLBACK',
      quoteBias: 0.22,
      callbackBias: 0.74,
      proofBias: 0.25,
      witnessBias: 0.2,
      memoryBias: 0.7,
      legendBias: 0.18,
    },
    timing: {
      ...DEFAULT_CHAT_VOICEPRINT_TIMING,
      readEffect: 'TACTICAL_HIDE',
      typingEffect: 'SHORT_TYPING',
      preferredDelayMs: 900,
      maxDelayMs: 3600,
      seenHoldMs: 0,
    },
    labels: ['preset', 'tactical', 'helper_steady'],
    tags: ['helper_steady', 'tactical', 'clean_sentences'],
    samples: [
      { id: 'helper_steady-sample-1', weight: 1, text: 'sample:helper_steady:1' },
      { id: 'helper_steady-sample-2', weight: 0.75, text: 'sample:helper_steady:2' },
      { id: 'helper_steady-sample-3', weight: 0.5, text: 'sample:helper_steady:3' },
    ],
    signatures: {
      opener: ['sig:helper_steady:open:1'],
      closer: ['sig:helper_steady:close:1'],
      interstitial: ['sig:helper_steady:inter:1'],
      quoteHooks: ['sig:helper_steady:quote:1'],
      pressureHooks: ['sig:helper_steady:pressure:1'],
      mercyHooks: ['sig:helper_steady:mercy:1'],
      victoryHooks: ['sig:helper_steady:victory:1'],
      lossHooks: ['sig:helper_steady:loss:1'],
    },
  });
}


// ============================================================================
// MARK: Preset WHISPER_DRIP
// ============================================================================

export function createPresetWHISPER_DRIPVoiceprint(
  id: ChatVoiceprintId,
  displayName = 'Whisper Drip',
): ChatVoiceprintDefinition {
  return applyVoiceprintPatch(createDefaultVoiceprintDefinition(id, displayName), {
    register: 'INTIMATE',
    syntaxMode: 'SPARSE',
    description: 'Generated preset voiceprint for WHISPER_DRIP.',
    authoredIntent: 'Provide authored voice rhythm for WHISPER_DRIP.',
    punctuation: {
      ...DEFAULT_CHAT_VOICEPRINT_PUNCTUATION,
      mode: 'ELLIPSIS_HEAVY',
      periods: 0.5,
      commas: 0.45,
      ellipses: 0.55,
      dashes: 0.12,
      questions: 0.6,
      exclamations: 0.05,
    },
    opening: {
      mode: 'QUOTE_LEAD',
      weight: 0.72,
      templates: ['template:whisper_drip:open:1', 'template:whisper_drip:open:2'],
    },
    closing: {
      mode: 'ECHO',
      weight: 0.75,
      templates: ['template:whisper_drip:close:1', 'template:whisper_drip:close:2'],
    },
    questioning: {
      style: 'LEADING',
      weight: 0.7,
      templates: ['template:whisper_drip:question:1'],
    },
    mockery: {
      style: 'SARCASTIC',
      weight: 0.25,
      templates: ['template:whisper_drip:mock:1', 'template:whisper_drip:mock:2'],
    },
    tenderness: {
      style: 'NONE',
      weight: 0,
      templates: ['template:whisper_drip:care:1'],
    },
    evidenceHooks: {
      ...DEFAULT_CHAT_VOICEPRINT_EVIDENCE_HOOKS,
      mode: 'WITNESS',
      quoteBias: 0.22,
      callbackBias: 0.3,
      proofBias: 0.25,
      witnessBias: 0.8,
      memoryBias: 0.28,
      legendBias: 0.18,
    },
    timing: {
      ...DEFAULT_CHAT_VOICEPRINT_TIMING,
      readEffect: 'SEEN_AND_WAIT',
      typingEffect: 'FAKE_START_STOP',
      preferredDelayMs: 1300,
      maxDelayMs: 5200,
      seenHoldMs: 1200,
    },
    labels: ['preset', 'intimate', 'whisper_drip'],
    tags: ['whisper_drip', 'intimate', 'sparse'],
    samples: [
      { id: 'whisper_drip-sample-1', weight: 1, text: 'sample:whisper_drip:1' },
      { id: 'whisper_drip-sample-2', weight: 0.75, text: 'sample:whisper_drip:2' },
      { id: 'whisper_drip-sample-3', weight: 0.5, text: 'sample:whisper_drip:3' },
    ],
    signatures: {
      opener: ['sig:whisper_drip:open:1'],
      closer: ['sig:whisper_drip:close:1'],
      interstitial: ['sig:whisper_drip:inter:1'],
      quoteHooks: ['sig:whisper_drip:quote:1'],
      pressureHooks: ['sig:whisper_drip:pressure:1'],
      mercyHooks: ['sig:whisper_drip:mercy:1'],
      victoryHooks: ['sig:whisper_drip:victory:1'],
      lossHooks: ['sig:whisper_drip:loss:1'],
    },
  });
}


// ============================================================================
// MARK: Preset DEAL_SHARK
// ============================================================================

export function createPresetDEAL_SHARKVoiceprint(
  id: ChatVoiceprintId,
  displayName = 'Deal Shark',
): ChatVoiceprintDefinition {
  return applyVoiceprintPatch(createDefaultVoiceprintDefinition(id, displayName), {
    register: 'PROFESSIONAL',
    syntaxMode: 'COMMAND_HEAVY',
    description: 'Generated preset voiceprint for DEAL_SHARK.',
    authoredIntent: 'Provide authored voice rhythm for DEAL_SHARK.',
    punctuation: {
      ...DEFAULT_CHAT_VOICEPRINT_PUNCTUATION,
      mode: 'RIGID',
      periods: 0.5,
      commas: 0.45,
      ellipses: 0.08,
      dashes: 0.12,
      questions: 0.6,
      exclamations: 0.05,
    },
    opening: {
      mode: 'QUESTION_LEAD',
      weight: 0.72,
      templates: ['template:deal_shark:open:1', 'template:deal_shark:open:2'],
    },
    closing: {
      mode: 'RECEIPT',
      weight: 0.75,
      templates: ['template:deal_shark:close:1', 'template:deal_shark:close:2'],
    },
    questioning: {
      style: 'CLINICAL',
      weight: 0.7,
      templates: ['template:deal_shark:question:1'],
    },
    mockery: {
      style: 'LIGHT',
      weight: 0.25,
      templates: ['template:deal_shark:mock:1', 'template:deal_shark:mock:2'],
    },
    tenderness: {
      style: 'NONE',
      weight: 0,
      templates: ['template:deal_shark:care:1'],
    },
    evidenceHooks: {
      ...DEFAULT_CHAT_VOICEPRINT_EVIDENCE_HOOKS,
      mode: 'PROOF',
      quoteBias: 0.22,
      callbackBias: 0.3,
      proofBias: 0.84,
      witnessBias: 0.2,
      memoryBias: 0.28,
      legendBias: 0.18,
    },
    timing: {
      ...DEFAULT_CHAT_VOICEPRINT_TIMING,
      readEffect: 'SEEN_AND_WAIT',
      typingEffect: 'SHORT_TYPING',
      preferredDelayMs: 1300,
      maxDelayMs: 3600,
      seenHoldMs: 1200,
    },
    labels: ['preset', 'professional', 'deal_shark'],
    tags: ['deal_shark', 'professional', 'command_heavy'],
    samples: [
      { id: 'deal_shark-sample-1', weight: 1, text: 'sample:deal_shark:1' },
      { id: 'deal_shark-sample-2', weight: 0.75, text: 'sample:deal_shark:2' },
      { id: 'deal_shark-sample-3', weight: 0.5, text: 'sample:deal_shark:3' },
    ],
    signatures: {
      opener: ['sig:deal_shark:open:1'],
      closer: ['sig:deal_shark:close:1'],
      interstitial: ['sig:deal_shark:inter:1'],
      quoteHooks: ['sig:deal_shark:quote:1'],
      pressureHooks: ['sig:deal_shark:pressure:1'],
      mercyHooks: ['sig:deal_shark:mercy:1'],
      victoryHooks: ['sig:deal_shark:victory:1'],
      lossHooks: ['sig:deal_shark:loss:1'],
    },
  });
}


// ============================================================================
// MARK: Preset RITUAL_MONK
// ============================================================================

export function createPresetRITUAL_MONKVoiceprint(
  id: ChatVoiceprintId,
  displayName = 'Ritual Monk',
): ChatVoiceprintDefinition {
  return applyVoiceprintPatch(createDefaultVoiceprintDefinition(id, displayName), {
    register: 'CEREMONIAL',
    syntaxMode: 'RITUALIZED',
    description: 'Generated preset voiceprint for RITUAL_MONK.',
    authoredIntent: 'Provide authored voice rhythm for RITUAL_MONK.',
    punctuation: {
      ...DEFAULT_CHAT_VOICEPRINT_PUNCTUATION,
      mode: 'PERIOD_HEAVY',
      periods: 0.8,
      commas: 0.45,
      ellipses: 0.08,
      dashes: 0.12,
      questions: 0.12,
      exclamations: 0.05,
    },
    opening: {
      mode: 'RITUAL_LEAD',
      weight: 0.72,
      templates: ['template:ritual_monk:open:1', 'template:ritual_monk:open:2'],
    },
    closing: {
      mode: 'RITUAL',
      weight: 0.75,
      templates: ['template:ritual_monk:close:1', 'template:ritual_monk:close:2'],
    },
    questioning: {
      style: 'NONE',
      weight: 0.1,
      templates: ['template:ritual_monk:question:1'],
    },
    mockery: {
      style: 'NONE',
      weight: 0.05,
      templates: ['template:ritual_monk:mock:1', 'template:ritual_monk:mock:2'],
    },
    tenderness: {
      style: 'NONE',
      weight: 0,
      templates: ['template:ritual_monk:care:1'],
    },
    evidenceHooks: {
      ...DEFAULT_CHAT_VOICEPRINT_EVIDENCE_HOOKS,
      mode: 'WITNESS',
      quoteBias: 0.22,
      callbackBias: 0.3,
      proofBias: 0.25,
      witnessBias: 0.2,
      memoryBias: 0.7,
      legendBias: 0.18,
    },
    timing: {
      ...DEFAULT_CHAT_VOICEPRINT_TIMING,
      readEffect: 'TACTICAL_HIDE',
      typingEffect: 'THEATRICAL',
      preferredDelayMs: 650,
      maxDelayMs: 3600,
      seenHoldMs: 0,
    },
    labels: ['preset', 'ceremonial', 'ritual_monk'],
    tags: ['ritual_monk', 'ceremonial', 'ritualized'],
    samples: [
      { id: 'ritual_monk-sample-1', weight: 1, text: 'sample:ritual_monk:1' },
      { id: 'ritual_monk-sample-2', weight: 0.75, text: 'sample:ritual_monk:2' },
      { id: 'ritual_monk-sample-3', weight: 0.5, text: 'sample:ritual_monk:3' },
    ],
    signatures: {
      opener: ['sig:ritual_monk:open:1'],
      closer: ['sig:ritual_monk:close:1'],
      interstitial: ['sig:ritual_monk:inter:1'],
      quoteHooks: ['sig:ritual_monk:quote:1'],
      pressureHooks: ['sig:ritual_monk:pressure:1'],
      mercyHooks: ['sig:ritual_monk:mercy:1'],
      victoryHooks: ['sig:ritual_monk:victory:1'],
      lossHooks: ['sig:ritual_monk:loss:1'],
    },
  });
}


// ============================================================================
// MARK: Preset CROWD_DOGPILE
// ============================================================================

export function createPresetCROWD_DOGPILEVoiceprint(
  id: ChatVoiceprintId,
  displayName = 'Crowd Dogpile',
): ChatVoiceprintDefinition {
  return applyVoiceprintPatch(createDefaultVoiceprintDefinition(id, displayName), {
    register: 'STREET',
    syntaxMode: 'FRAGMENTS',
    description: 'Generated preset voiceprint for CROWD_DOGPILE.',
    authoredIntent: 'Provide authored voice rhythm for CROWD_DOGPILE.',
    punctuation: {
      ...DEFAULT_CHAT_VOICEPRINT_PUNCTUATION,
      mode: 'EXCLAMATION_HEAVY',
      periods: 0.5,
      commas: 0.2,
      ellipses: 0.08,
      dashes: 0.12,
      questions: 0.6,
      exclamations: 0.72,
    },
    opening: {
      mode: 'WITNESS_LEAD',
      weight: 0.72,
      templates: ['template:crowd_dogpile:open:1', 'template:crowd_dogpile:open:2'],
    },
    closing: {
      mode: 'STING',
      weight: 0.75,
      templates: ['template:crowd_dogpile:close:1', 'template:crowd_dogpile:close:2'],
    },
    questioning: {
      style: 'BAITING',
      weight: 0.7,
      templates: ['template:crowd_dogpile:question:1'],
    },
    mockery: {
      style: 'PUBLIC_SHAME',
      weight: 0.85,
      templates: ['template:crowd_dogpile:mock:1', 'template:crowd_dogpile:mock:2'],
    },
    tenderness: {
      style: 'NONE',
      weight: 0,
      templates: ['template:crowd_dogpile:care:1'],
    },
    evidenceHooks: {
      ...DEFAULT_CHAT_VOICEPRINT_EVIDENCE_HOOKS,
      mode: 'WITNESS',
      quoteBias: 0.22,
      callbackBias: 0.3,
      proofBias: 0.25,
      witnessBias: 0.8,
      memoryBias: 0.28,
      legendBias: 0.18,
    },
    timing: {
      ...DEFAULT_CHAT_VOICEPRINT_TIMING,
      readEffect: 'UNREAD_PRESSURE',
      typingEffect: 'RAPID_BURST',
      preferredDelayMs: 650,
      maxDelayMs: 3600,
      seenHoldMs: 0,
    },
    labels: ['preset', 'street', 'crowd_dogpile'],
    tags: ['crowd_dogpile', 'street', 'fragments'],
    samples: [
      { id: 'crowd_dogpile-sample-1', weight: 1, text: 'sample:crowd_dogpile:1' },
      { id: 'crowd_dogpile-sample-2', weight: 0.75, text: 'sample:crowd_dogpile:2' },
      { id: 'crowd_dogpile-sample-3', weight: 0.5, text: 'sample:crowd_dogpile:3' },
    ],
    signatures: {
      opener: ['sig:crowd_dogpile:open:1'],
      closer: ['sig:crowd_dogpile:close:1'],
      interstitial: ['sig:crowd_dogpile:inter:1'],
      quoteHooks: ['sig:crowd_dogpile:quote:1'],
      pressureHooks: ['sig:crowd_dogpile:pressure:1'],
      mercyHooks: ['sig:crowd_dogpile:mercy:1'],
      victoryHooks: ['sig:crowd_dogpile:victory:1'],
      lossHooks: ['sig:crowd_dogpile:loss:1'],
    },
  });
}


// ============================================================================
// MARK: Preset BOSS_CINEMATIC
// ============================================================================

export function createPresetBOSS_CINEMATICVoiceprint(
  id: ChatVoiceprintId,
  displayName = 'Boss Cinematic',
): ChatVoiceprintDefinition {
  return applyVoiceprintPatch(createDefaultVoiceprintDefinition(id, displayName), {
    register: 'COLD',
    syntaxMode: 'STACKED_CLAUSES',
    description: 'Generated preset voiceprint for BOSS_CINEMATIC.',
    authoredIntent: 'Provide authored voice rhythm for BOSS_CINEMATIC.',
    punctuation: {
      ...DEFAULT_CHAT_VOICEPRINT_PUNCTUATION,
      mode: 'DASH_HEAVY',
      periods: 0.5,
      commas: 0.45,
      ellipses: 0.08,
      dashes: 0.65,
      questions: 0.6,
      exclamations: 0.05,
    },
    opening: {
      mode: 'COMMAND_LEAD',
      weight: 0.72,
      templates: ['template:boss_cinematic:open:1', 'template:boss_cinematic:open:2'],
    },
    closing: {
      mode: 'THREAT',
      weight: 0.75,
      templates: ['template:boss_cinematic:close:1', 'template:boss_cinematic:close:2'],
    },
    questioning: {
      style: 'LEADING',
      weight: 0.7,
      templates: ['template:boss_cinematic:question:1'],
    },
    mockery: {
      style: 'HUNGER',
      weight: 0.85,
      templates: ['template:boss_cinematic:mock:1', 'template:boss_cinematic:mock:2'],
    },
    tenderness: {
      style: 'NONE',
      weight: 0,
      templates: ['template:boss_cinematic:care:1'],
    },
    evidenceHooks: {
      ...DEFAULT_CHAT_VOICEPRINT_EVIDENCE_HOOKS,
      mode: 'QUOTE',
      quoteBias: 0.82,
      callbackBias: 0.3,
      proofBias: 0.25,
      witnessBias: 0.2,
      memoryBias: 0.28,
      legendBias: 0.7,
    },
    timing: {
      ...DEFAULT_CHAT_VOICEPRINT_TIMING,
      readEffect: 'IMMEDIATE_READ',
      typingEffect: 'THEATRICAL',
      preferredDelayMs: 650,
      maxDelayMs: 3600,
      seenHoldMs: 0,
    },
    labels: ['preset', 'cold', 'boss_cinematic'],
    tags: ['boss_cinematic', 'cold', 'stacked_clauses'],
    samples: [
      { id: 'boss_cinematic-sample-1', weight: 1, text: 'sample:boss_cinematic:1' },
      { id: 'boss_cinematic-sample-2', weight: 0.75, text: 'sample:boss_cinematic:2' },
      { id: 'boss_cinematic-sample-3', weight: 0.5, text: 'sample:boss_cinematic:3' },
    ],
    signatures: {
      opener: ['sig:boss_cinematic:open:1'],
      closer: ['sig:boss_cinematic:close:1'],
      interstitial: ['sig:boss_cinematic:inter:1'],
      quoteHooks: ['sig:boss_cinematic:quote:1'],
      pressureHooks: ['sig:boss_cinematic:pressure:1'],
      mercyHooks: ['sig:boss_cinematic:mercy:1'],
      victoryHooks: ['sig:boss_cinematic:victory:1'],
      lossHooks: ['sig:boss_cinematic:loss:1'],
    },
  });
}


// ============================================================================
// MARK: Registry + diagnostics
// ============================================================================

export const CHAT_VOICEPRINT_PRESET_FACTORY_REGISTRY = {
  createPresetSYSTEM_RIGIDVoiceprint,
  createPresetHATER_KNIFEVoiceprint,
  createPresetHELPER_STEADYVoiceprint,
  createPresetWHISPER_DRIPVoiceprint,
  createPresetDEAL_SHARKVoiceprint,
  createPresetRITUAL_MONKVoiceprint,
  createPresetCROWD_DOGPILEVoiceprint,
  createPresetBOSS_CINEMATICVoiceprint,
} as const;

export type ChatVoiceprintPresetFactoryName = keyof typeof CHAT_VOICEPRINT_PRESET_FACTORY_REGISTRY;

export function createPresetVoiceprint(
  name: ChatVoiceprintPresetFactoryName,
  id: ChatVoiceprintId,
  displayName?: string,
): ChatVoiceprintDefinition {
  return CHAT_VOICEPRINT_PRESET_FACTORY_REGISTRY[name](id, displayName);
}

export function createDefaultVoiceprintRegistry(): readonly ChatVoiceprintDefinition[] {
  return [
    createPresetSYSTEM_RIGIDVoiceprint('system-rigid', 'System Rigid'),
    createPresetHATER_KNIFEVoiceprint('hater-knife', 'Hater Knife'),
    createPresetHELPER_STEADYVoiceprint('helper-steady', 'Helper Steady'),
    createPresetWHISPER_DRIPVoiceprint('whisper-drip', 'Whisper Drip'),
    createPresetDEAL_SHARKVoiceprint('deal-shark', 'Deal Shark'),
    createPresetRITUAL_MONKVoiceprint('ritual-monk', 'Ritual Monk'),
    createPresetCROWD_DOGPILEVoiceprint('crowd-dogpile', 'Crowd Dogpile'),
    createPresetBOSS_CINEMATICVoiceprint('boss-cinematic', 'Boss Cinematic'),
  ];
}

export interface ChatVoiceprintDiagnostics {
  readonly count: number;
  readonly registers: Readonly<Record<ChatVoiceprintRegister, number>>;
  readonly syntaxModes: Readonly<Record<ChatVoiceprintSyntaxMode, number>>;
  readonly hottestQuestioners: readonly ChatVoiceprintId[];
  readonly sharpestMockers: readonly ChatVoiceprintId[];
  readonly softestCarers: readonly ChatVoiceprintId[];
}

export function diagnoseVoiceprints(
  voiceprints: readonly ChatVoiceprintDefinition[],
): ChatVoiceprintDiagnostics {
  const registers: Record<ChatVoiceprintRegister, number> = {
    FORMAL: 0,
    TACTICAL: 0,
    STREET: 0,
    COLD: 0,
    RITUAL: 0,
    PROFESSIONAL: 0,
    AMBIENT: 0,
    ABRASIVE: 0,
    INTIMATE: 0,
    CEREMONIAL: 0,
    MECHANICAL: 0,
  };
  const syntaxModes: Record<ChatVoiceprintSyntaxMode, number> = {
    FRAGMENTS: 0,
    CLEAN_SENTENCES: 0,
    RUN_ON: 0,
    STACKED_CLAUSES: 0,
    SPARSE: 0,
    PRESSURE_CUT: 0,
    COMMAND_HEAVY: 0,
    OBSERVATIONAL: 0,
    RITUALIZED: 0,
  };
  for (const voiceprint of voiceprints) {
    registers[voiceprint.register] += 1;
    syntaxModes[voiceprint.syntaxMode] += 1;
  }
  const projected = voiceprints.map((voiceprint) => ({
    id: voiceprint.id,
    projection: deriveVoiceprintProjection(voiceprint),
  }));
  return {
    count: voiceprints.length,
    registers,
    syntaxModes,
    hottestQuestioners: projected
      .slice()
      .sort((a, b) => b.projection.questionPressure - a.projection.questionPressure)
      .slice(0, 5)
      .map((item) => item.id),
    sharpestMockers: projected
      .slice()
      .sort((a, b) => b.projection.bite - a.projection.bite)
      .slice(0, 5)
      .map((item) => item.id),
    softestCarers: projected
      .slice()
      .sort((a, b) => b.projection.softness - a.projection.softness)
      .slice(0, 5)
      .map((item) => item.id),
  };
}

export function voiceprintToJson(
  voiceprint: ChatVoiceprintDefinition,
): ChatVoiceprintJsonValue {
  return voiceprint as unknown as ChatVoiceprintJsonValue;
}

export function voiceprintSummaryToJson(
  summary: ChatVoiceprintSummary,
): ChatVoiceprintJsonValue {
  return summary as unknown as ChatVoiceprintJsonValue;
}
