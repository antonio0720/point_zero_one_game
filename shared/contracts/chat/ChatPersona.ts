/**
 * @file shared/contracts/chat/ChatPersona.ts
 * @description
 * Canonical shared contract for authored chat persona law across the Point Zero One
 * chat stack. This file is designed to be imported by frontend, backend, and server
 * lanes without bringing runtime side effects into the shared contract boundary.
 *
 * The purpose of this contract is to give the chat engine a stable, explicit, and
 * deeply typed vocabulary for:
 * - persona identity
 * - authored role and lane ownership
 * - cadence and rhetorical posture
 * - aggression/helpfulness envelopes
 * - privacy/channel fit
 * - memory/callback behavior hints
 * - interruption, rescue, witness, and deal-room traits
 * - liveops overrides and evolution anchors
 *
 * This contract is intentionally broad because the repo already has long-term chat
 * authorities under /shared/contracts/chat and phase4/persona-evolution related
 * contracts in the same directory. This file is additive and aims to bridge those
 * lanes without flattening the existing architecture.
 */

// ============================================================================
// MARK: Primitive aliases
// ============================================================================

export type ChatPersonaId = string;
export type ChatPersonaVersion = string;
export type ChatPersonaSlug = string;
export type ChatPersonaDisplayName = string;
export type ChatPersonaShortCode = string;
export type ChatActorId = string;
export type ChatNpcId = string;
export type ChatRelationshipId = string;
export type ChatMomentId = string;
export type ChatSceneId = string;
export type ChatQuoteId = string;
export type ChatCallbackId = string;
export type ChatChannelId = string;
export type ChatRunId = string;
export type ChatSessionId = string;
export type ChatPlayerId = string;
export type ChatWorldEventId = string;
export type ChatTimestampIso = string;
export type ChatLocaleCode = string;
export type ChatLabel = string;
export type ChatTag = string;
export type ChatTraitKey = string;
export type ChatTraitValue = number;
export type ChatBudgetKey = string;
export type ChatPersonaNumericScore = number;
export type ChatPersonaArchetypeWeight = number;
export type ChatPersonaVectorDimension = number;
export type ChatPersonaToken = string;
export type ChatPersonaLexeme = string;
export type ChatPersonaSignatureLine = string;
export type ChatPersonaConditionKey = string;
export type ChatPersonaOverrideId = string;
export type ChatPersonaRuleId = string;
export type ChatPersonaClusterId = string;
export type ChatPersonaFamilyId = string;
export type ChatPersonaNote = string;

// ============================================================================
// MARK: JSON-safe support
// ============================================================================

export type ChatPersonaJsonPrimitive = string | number | boolean | null;
export type ChatPersonaJsonValue =
  | ChatPersonaJsonPrimitive
  | ChatPersonaJsonValue[]
  | { readonly [key: string]: ChatPersonaJsonValue };

export interface ChatPersonaAuditStamp {
  readonly createdAt: ChatTimestampIso;
  readonly updatedAt: ChatTimestampIso;
  readonly createdBy?: string;
  readonly updatedBy?: string;
  readonly source?: string;
  readonly reason?: string;
}

// ============================================================================
// MARK: Enumerations / unions
// ============================================================================

export type ChatPersonaRole =
  | 'PLAYER_PROXY'
  | 'SYSTEM'
  | 'RIVAL'
  | 'HELPER'
  | 'DEAL_AGENT'
  | 'SPECTATOR'
  | 'NARRATOR'
  | 'MODERATOR'
  | 'FACTION_VOICE'
  | 'WORLD_EVENT_VOICE'
  | 'BOSS'
  | 'AMBIENT_CROWD'
  | 'WHISPER'
  | 'UNKNOWN';

export type ChatPersonaLane =
  | 'GLOBAL'
  | 'SYNDICATE'
  | 'DEAL_ROOM'
  | 'DIRECT'
  | 'SPECTATOR'
  | 'SYSTEM'
  | 'WORLD_EVENT'
  | 'SHADOW'
  | 'MULTI';

export type ChatPersonaVisibility =
  | 'PUBLIC'
  | 'PRIVATE'
  | 'SEMI_PRIVATE'
  | 'SHADOW_ONLY'
  | 'SYSTEM_ONLY';

export type ChatPersonaCadenceClass =
  | 'STACCATO'
  | 'TACTICAL'
  | 'MEASURED'
  | 'ORNATE'
  | 'LURKING'
  | 'CHOPPY'
  | 'VERBOSE'
  | 'CINEMATIC'
  | 'CEREMONIAL'
  | 'COLD'
  | 'ERRATIC';

export type ChatPersonaAggressionStyle =
  | 'NONE'
  | 'DIRECT'
  | 'SARCASTIC'
  | 'CONDESCENDING'
  | 'PREDATORY'
  | 'PSYCHOLOGICAL'
  | 'CEREMONIAL'
  | 'DOGPILE'
  | 'WHISPER_POISON'
  | 'PUBLIC_SHAME'
  | 'RELENTLESS'
  | 'CHAOTIC';

export type ChatPersonaSupportStyle =
  | 'NONE'
  | 'COACHING'
  | 'TACTICAL'
  | 'CALMING'
  | 'RITUAL'
  | 'EMERGENCY'
  | 'TENDER'
  | 'BLUNT'
  | 'ANALYTIC'
  | 'PROTECTIVE'
  | 'CONFIDENCE_RESTORE'
  | 'TRIAGE';

export type ChatPersonaEvidenceMode =
  | 'NONE'
  | 'PROOF_FORWARD'
  | 'QUOTE_FORWARD'
  | 'RECEIPT_FORWARD'
  | 'MEMORY_FORWARD'
  | 'SOCIAL_FORWARD'
  | 'WORLD_FORWARD'
  | 'RUN_FORWARD';

export type ChatPersonaReplyRisk =
  | 'LOW'
  | 'LOW_MEDIUM'
  | 'MEDIUM'
  | 'MEDIUM_HIGH'
  | 'HIGH'
  | 'SEVERE';

export type ChatPersonaEmotionBand =
  | 'FLAT'
  | 'COOL'
  | 'LOW_HEAT'
  | 'ACTIVE'
  | 'HOT'
  | 'VOLATILE'
  | 'BREATHLESS'
  | 'DISSOCIATED'
  | 'TRIUMPHANT'
  | 'FUNEREAL';

export type ChatPersonaTriggerClass =
  | 'RUN_START'
  | 'RUN_END'
  | 'BANKRUPTCY'
  | 'SHIELD_BREAK'
  | 'PRESSURE_SPIKE'
  | 'TIME_CRISIS'
  | 'COME_BACK'
  | 'SOVEREIGNTY'
  | 'DEAL_SIGNAL'
  | 'BLUFF_EXPOSURE'
  | 'RESCUE_WINDOW'
  | 'WORLD_EVENT'
  | 'WITNESS_EVENT'
  | 'QUOTE_CALLBACK'
  | 'LEGEND_MOMENT'
  | 'CHANNEL_SHIFT'
  | 'ALT_TAB_SUSPECT'
  | 'UNKNOWN';

export type ChatPersonaInterruptMode =
  | 'NEVER'
  | 'RARE'
  | 'CONDITIONAL'
  | 'WILLING'
  | 'AGGRESSIVE'
  | 'DOMINANT';

export type ChatPersonaReadPattern =
  | 'INSTANT'
  | 'QUICK'
  | 'DELAYED'
  | 'STRATEGIC_DELAY'
  | 'SEEN_BAIT'
  | 'GHOST'
  | 'SCHEDULED'
  | 'UNREAD_PRESSURE';

export type ChatPersonaTypingPattern =
  | 'NONE'
  | 'SHORT'
  | 'LONG'
  | 'BURST'
  | 'FAKE_START_STOP'
  | 'THEATRICAL'
  | 'STEADY'
  | 'HEAVY_THINKER';

export type ChatPersonaChannelPreference =
  | 'GLOBAL_PRIMARY'
  | 'SYNDICATE_PRIMARY'
  | 'DEAL_ROOM_PRIMARY'
  | 'DIRECT_PRIMARY'
  | 'SPECTATOR_PRIMARY'
  | 'SHADOW_PRIMARY'
  | 'CONTEXTUAL';

export type ChatPersonaWitnessStyle =
  | 'LOUD'
  | 'QUIET'
  | 'CLIPPED'
  | 'CHORAL'
  | 'MOCKING'
  | 'REVERENT'
  | 'NEUTRAL'
  | 'SUSPICIOUS'
  | 'PREDATORY';

export type ChatPersonaDealPosture =
  | 'AVOIDANT'
  | 'PASSIVE'
  | 'WATCHFUL'
  | 'PREDATORY'
  | 'FORMAL'
  | 'BLUFF_HEAVY'
  | 'MERCENARY'
  | 'PROBE_AND_WAIT';

export type ChatPersonaMemoryOrientation =
  | 'SHORT'
  | 'MID'
  | 'LONG'
  | 'LEGENDARY'
  | 'QUOTE_HUNTER'
  | 'RECEIPT_HUNTER'
  | 'FORGIVING'
  | 'OBSESSIVE';

export type ChatPersonaSceneWeight =
  | 'BACKGROUND'
  | 'LIGHT'
  | 'MEDIUM'
  | 'HEAVY'
  | 'ANCHOR'
  | 'DOMINANT';

export type ChatPersonaSilencePreference =
  | 'TALKS_EARLY'
  | 'WAITS_FOR_BEAT'
  | 'LETS_OTHERS_BURN'
  | 'TACTICAL_SILENCE'
  | 'RESCUE_DELAY'
  | 'POST_EVENT_SILENCE';

export type ChatPersonaRecoveryPosture =
  | 'NONE'
  | 'DEESCALATE'
  | 'STABILIZE'
  | 'REFRAME'
  | 'REBUILD_CONFIDENCE'
  | 'GUIDE_TO_ACTION'
  | 'ABSORB_SHAME';

export type ChatPersonaLiveOpsMode =
  | 'NONE'
  | 'BOOSTED'
  | 'MUTED'
  | 'OVERRIDDEN'
  | 'EVENT_SKINNED'
  | 'SEASONAL';

export type ChatPersonaValidationIssueCode =
  | 'EMPTY_ID'
  | 'EMPTY_NAME'
  | 'OUT_OF_RANGE'
  | 'DUPLICATE_TAG'
  | 'INVALID_WEIGHT'
  | 'INVALID_CHANNEL'
  | 'INVALID_THRESHOLD'
  | 'INVALID_OVERRIDE'
  | 'INVALID_SIGNATURE'
  | 'UNKNOWN';

// ============================================================================
// MARK: Core trait groups
// ============================================================================

export interface ChatPersonaIntensityEnvelope {
  readonly minimum: number;
  readonly baseline: number;
  readonly preferred: number;
  readonly peak: number;
  readonly decayPerBeat: number;
}

export interface ChatPersonaLatencyEnvelope {
  readonly minDelayMs: number;
  readonly softDelayMs: number;
  readonly typicalDelayMs: number;
  readonly hardDelayMs: number;
  readonly maxDelayMs: number;
}

export interface ChatPersonaSentenceEnvelope {
  readonly minWords: number;
  readonly preferredWords: number;
  readonly maxWords: number;
  readonly sentenceCountFloor: number;
  readonly sentenceCountCeiling: number;
}

export interface ChatPersonaPunctuationProfile {
  readonly periodBias: number;
  readonly commaBias: number;
  readonly ellipsisBias: number;
  readonly dashBias: number;
  readonly exclamationBias: number;
  readonly questionBias: number;
  readonly lowercaseBias: number;
  readonly uppercaseBias: number;
  readonly noPunctuationBias: number;
  readonly doublePunctuationBias: number;
  readonly emojiBias: number;
}

export interface ChatPersonaLexiconRule {
  readonly key: ChatTraitKey;
  readonly weight: number;
  readonly allowed: readonly ChatPersonaLexeme[];
  readonly preferred?: readonly ChatPersonaLexeme[];
  readonly forbidden?: readonly ChatPersonaLexeme[];
  readonly examples?: readonly string[];
}

export interface ChatPersonaOpeningRule {
  readonly weight: number;
  readonly style: 'NONE' | 'NAME_CALL' | 'QUOTE' | 'SYSTEM_TAG' | 'RITUAL' | 'DIRECT_HIT' | 'WHISPER';
  readonly templates: readonly string[];
}

export interface ChatPersonaClosingRule {
  readonly weight: number;
  readonly style: 'NONE' | 'STING' | 'GUIDANCE' | 'CHALLENGE' | 'RITUAL' | 'THREAT' | 'ECHO';
  readonly templates: readonly string[];
}

export interface ChatPersonaEvidencePolicy {
  readonly mode: ChatPersonaEvidenceMode;
  readonly quoteBias: number;
  readonly callbackBias: number;
  readonly proofBias: number;
  readonly memoryBias: number;
  readonly witnessBias: number;
  readonly replayBias: number;
}

export interface ChatPersonaInterruptionPolicy {
  readonly mode: ChatPersonaInterruptMode;
  readonly priorityBias: number;
  readonly rescueOverrideBias: number;
  readonly rivalryOverrideBias: number;
  readonly worldEventOverrideBias: number;
  readonly publicEmbarrassmentBias: number;
  readonly cooldownMs: number;
}

export interface ChatPersonaVisibilityPolicy {
  readonly visibility: ChatPersonaVisibility;
  readonly preferredChannels: readonly ChatChannelId[];
  readonly disallowedChannels: readonly ChatChannelId[];
  readonly shadowBias: number;
  readonly dmBias: number;
  readonly publicBias: number;
  readonly syndicateBias: number;
  readonly dealRoomBias: number;
}

export interface ChatPersonaWitnessPolicy {
  readonly witnessStyle: ChatPersonaWitnessStyle;
  readonly witnessAggressionBias: number;
  readonly witnessMercyBias: number;
  readonly witnessCeremonyBias: number;
  readonly crowdEchoBias: number;
  readonly pileOnBias: number;
}

export interface ChatPersonaDealPolicy {
  readonly posture: ChatPersonaDealPosture;
  readonly bluffExposureBias: number;
  readonly patienceBias: number;
  readonly overpayPunishBias: number;
  readonly leakToPublicBias: number;
  readonly privatePressureBias: number;
  readonly formalToneBias: number;
}

export interface ChatPersonaRecoveryPolicy {
  readonly posture: ChatPersonaRecoveryPosture;
  readonly patience: number;
  readonly softness: number;
  readonly bluntness: number;
  readonly nextActionBias: number;
  readonly breathRoomBias: number;
  readonly publicShieldingBias: number;
}

export interface ChatPersonaMemoryPolicy {
  readonly orientation: ChatPersonaMemoryOrientation;
  readonly quoteCaptureBias: number;
  readonly callbackReuseBias: number;
  readonly forgivenessBias: number;
  readonly obsessionBias: number;
  readonly salienceThreshold: number;
  readonly expiryFavorShortTerm: number;
}

export interface ChatPersonaScenePolicy {
  readonly sceneWeight: ChatPersonaSceneWeight;
  readonly silencePreference: ChatPersonaSilencePreference;
  readonly miniSceneBias: number;
  readonly backgroundCommentBias: number;
  readonly anchorSceneBias: number;
  readonly aftermathBias: number;
}

export interface ChatPersonaHeatPolicy {
  readonly globalHeatBias: number;
  readonly syndicateHeatBias: number;
  readonly dealRoomHeatBias: number;
  readonly spectatorHeatBias: number;
  readonly embarrassmentSensitivity: number;
  readonly crowdActivationThreshold: number;
  readonly dogpileRiskBias: number;
}

export interface ChatPersonaRelationshipBias {
  readonly trustBias: number;
  readonly fearBias: number;
  readonly contemptBias: number;
  readonly fascinationBias: number;
  readonly respectBias: number;
  readonly rescueDebtBias: number;
  readonly rivalryBias: number;
  readonly familiarityBias: number;
}

export interface ChatPersonaTriggerRule {
  readonly id: ChatPersonaRuleId;
  readonly trigger: ChatPersonaTriggerClass;
  readonly weight: number;
  readonly channelBias?: Partial<Record<ChatChannelId, number>>;
  readonly minimumHeat?: number;
  readonly minimumReputationShock?: number;
  readonly requiresProof?: boolean;
  readonly requiresQuote?: boolean;
  readonly requiresRelationshipAnchor?: boolean;
  readonly notes?: readonly string[];
}

export interface ChatPersonaOverride {
  readonly id: ChatPersonaOverrideId;
  readonly liveOpsMode: ChatPersonaLiveOpsMode;
  readonly activeFrom?: ChatTimestampIso;
  readonly activeUntil?: ChatTimestampIso;
  readonly worldEventId?: ChatWorldEventId;
  readonly labels?: readonly ChatLabel[];
  readonly patch: Partial<ChatPersonaDefinition>;
}

export interface ChatPersonaArchetypeWeights {
  readonly predator: ChatPersonaArchetypeWeight;
  readonly mentor: ChatPersonaArchetypeWeight;
  readonly rival: ChatPersonaArchetypeWeight;
  readonly witness: ChatPersonaArchetypeWeight;
  readonly merchant: ChatPersonaArchetypeWeight;
  readonly narrator: ChatPersonaArchetypeWeight;
  readonly whisperer: ChatPersonaArchetypeWeight;
  readonly executioner: ChatPersonaArchetypeWeight;
  readonly rescuer: ChatPersonaArchetypeWeight;
  readonly mystic: ChatPersonaArchetypeWeight;
}

// ============================================================================
// MARK: Core persona definition
// ============================================================================

export interface ChatPersonaDefinition {
  readonly id: ChatPersonaId;
  readonly version: ChatPersonaVersion;
  readonly slug: ChatPersonaSlug;
  readonly displayName: ChatPersonaDisplayName;
  readonly shortCode?: ChatPersonaShortCode;
  readonly role: ChatPersonaRole;
  readonly primaryLane: ChatPersonaLane;
  readonly channelPreference: ChatPersonaChannelPreference;
  readonly locale?: ChatLocaleCode;
  readonly familyId?: ChatPersonaFamilyId;
  readonly clusterId?: ChatPersonaClusterId;
  readonly actorId?: ChatActorId;
  readonly npcId?: ChatNpcId;
  readonly labels: readonly ChatLabel[];
  readonly tags: readonly ChatTag[];
  readonly description: string;
  readonly authoredIntent: string;
  readonly cadence: ChatPersonaCadenceClass;
  readonly aggressionStyle: ChatPersonaAggressionStyle;
  readonly supportStyle: ChatPersonaSupportStyle;
  readonly evidencePolicy: ChatPersonaEvidencePolicy;
  readonly interruptionPolicy: ChatPersonaInterruptionPolicy;
  readonly visibilityPolicy: ChatPersonaVisibilityPolicy;
  readonly witnessPolicy: ChatPersonaWitnessPolicy;
  readonly dealPolicy: ChatPersonaDealPolicy;
  readonly recoveryPolicy: ChatPersonaRecoveryPolicy;
  readonly memoryPolicy: ChatPersonaMemoryPolicy;
  readonly scenePolicy: ChatPersonaScenePolicy;
  readonly heatPolicy: ChatPersonaHeatPolicy;
  readonly relationshipBias: ChatPersonaRelationshipBias;
  readonly emotionBand: ChatPersonaEmotionBand;
  readonly readPattern: ChatPersonaReadPattern;
  readonly typingPattern: ChatPersonaTypingPattern;
  readonly intensity: ChatPersonaIntensityEnvelope;
  readonly latency: ChatPersonaLatencyEnvelope;
  readonly sentenceEnvelope: ChatPersonaSentenceEnvelope;
  readonly punctuation: ChatPersonaPunctuationProfile;
  readonly lexiconRules: readonly ChatPersonaLexiconRule[];
  readonly openingRules: readonly ChatPersonaOpeningRule[];
  readonly closingRules: readonly ChatPersonaClosingRule[];
  readonly triggerRules: readonly ChatPersonaTriggerRule[];
  readonly archetypeWeights: ChatPersonaArchetypeWeights;
  readonly signatureLines: readonly ChatPersonaSignatureLine[];
  readonly antiSignatureLines: readonly ChatPersonaSignatureLine[];
  readonly quotas?: Readonly<Record<ChatBudgetKey, number>>;
  readonly notes?: readonly ChatPersonaNote[];
  readonly audit?: ChatPersonaAuditStamp;
  readonly overrides?: readonly ChatPersonaOverride[];
  readonly custom?: Readonly<Record<string, ChatPersonaJsonValue>>;
}

export interface ChatPersonaPatch {
  readonly displayName?: ChatPersonaDisplayName;
  readonly description?: string;
  readonly authoredIntent?: string;
  readonly cadence?: ChatPersonaCadenceClass;
  readonly aggressionStyle?: ChatPersonaAggressionStyle;
  readonly supportStyle?: ChatPersonaSupportStyle;
  readonly evidencePolicy?: Partial<ChatPersonaEvidencePolicy>;
  readonly interruptionPolicy?: Partial<ChatPersonaInterruptionPolicy>;
  readonly visibilityPolicy?: Partial<ChatPersonaVisibilityPolicy>;
  readonly witnessPolicy?: Partial<ChatPersonaWitnessPolicy>;
  readonly dealPolicy?: Partial<ChatPersonaDealPolicy>;
  readonly recoveryPolicy?: Partial<ChatPersonaRecoveryPolicy>;
  readonly memoryPolicy?: Partial<ChatPersonaMemoryPolicy>;
  readonly scenePolicy?: Partial<ChatPersonaScenePolicy>;
  readonly heatPolicy?: Partial<ChatPersonaHeatPolicy>;
  readonly relationshipBias?: Partial<ChatPersonaRelationshipBias>;
  readonly emotionBand?: ChatPersonaEmotionBand;
  readonly readPattern?: ChatPersonaReadPattern;
  readonly typingPattern?: ChatPersonaTypingPattern;
  readonly intensity?: Partial<ChatPersonaIntensityEnvelope>;
  readonly latency?: Partial<ChatPersonaLatencyEnvelope>;
  readonly sentenceEnvelope?: Partial<ChatPersonaSentenceEnvelope>;
  readonly punctuation?: Partial<ChatPersonaPunctuationProfile>;
  readonly lexiconRules?: readonly ChatPersonaLexiconRule[];
  readonly openingRules?: readonly ChatPersonaOpeningRule[];
  readonly closingRules?: readonly ChatPersonaClosingRule[];
  readonly triggerRules?: readonly ChatPersonaTriggerRule[];
  readonly archetypeWeights?: Partial<ChatPersonaArchetypeWeights>;
  readonly signatureLines?: readonly ChatPersonaSignatureLine[];
  readonly antiSignatureLines?: readonly ChatPersonaSignatureLine[];
  readonly labels?: readonly ChatLabel[];
  readonly tags?: readonly ChatTag[];
  readonly custom?: Readonly<Record<string, ChatPersonaJsonValue>>;
}

export interface ChatPersonaRegistryEntry {
  readonly persona: ChatPersonaDefinition;
  readonly active: boolean;
  readonly deprecated?: boolean;
  readonly replacedByPersonaId?: ChatPersonaId;
  readonly loadedFrom?: string;
  readonly checksum?: string;
}

export interface ChatPersonaValidationIssue {
  readonly code: ChatPersonaValidationIssueCode;
  readonly path: string;
  readonly message: string;
  readonly severity: 'INFO' | 'WARN' | 'ERROR';
}

export interface ChatPersonaValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ChatPersonaValidationIssue[];
}

export interface ChatPersonaSummary {
  readonly id: ChatPersonaId;
  readonly version: ChatPersonaVersion;
  readonly displayName: ChatPersonaDisplayName;
  readonly role: ChatPersonaRole;
  readonly primaryLane: ChatPersonaLane;
  readonly cadence: ChatPersonaCadenceClass;
  readonly aggressionStyle: ChatPersonaAggressionStyle;
  readonly supportStyle: ChatPersonaSupportStyle;
  readonly emotionBand: ChatPersonaEmotionBand;
  readonly channelPreference: ChatPersonaChannelPreference;
  readonly labels: readonly ChatLabel[];
  readonly tags: readonly ChatTag[];
}

export interface ChatPersonaLookup {
  readonly byId: Readonly<Record<ChatPersonaId, ChatPersonaRegistryEntry>>;
  readonly byRole: Readonly<Record<ChatPersonaRole, readonly ChatPersonaId[]>>;
  readonly byLane: Readonly<Record<ChatPersonaLane, readonly ChatPersonaId[]>>;
  readonly byTag: Readonly<Record<ChatTag, readonly ChatPersonaId[]>>;
}

export interface ChatPersonaSelectionEnvelope {
  readonly preferred: readonly ChatPersonaId[];
  readonly avoided: readonly ChatPersonaId[];
  readonly weights: Readonly<Record<ChatPersonaId, number>>;
  readonly reason?: string;
}

export interface ChatPersonaRuntimeHint {
  readonly personaId: ChatPersonaId;
  readonly channelId?: ChatChannelId;
  readonly runId?: ChatRunId;
  readonly sessionId?: ChatSessionId;
  readonly playerId?: ChatPlayerId;
  readonly relationshipId?: ChatRelationshipId;
  readonly quoteId?: ChatQuoteId;
  readonly callbackId?: ChatCallbackId;
  readonly momentId?: ChatMomentId;
  readonly sceneId?: ChatSceneId;
  readonly trigger?: ChatPersonaTriggerClass;
  readonly heat?: number;
  readonly embarrassment?: number;
  readonly trust?: number;
  readonly rivalry?: number;
  readonly rescueDebt?: number;
  readonly evidenceAvailable?: boolean;
  readonly isShadowPath?: boolean;
  readonly allowMiniScene?: boolean;
  readonly allowInterruption?: boolean;
  readonly worldEventId?: ChatWorldEventId;
}

// ============================================================================
// MARK: Defaults
// ============================================================================

export const DEFAULT_CHAT_PERSONA_INTENSITY: Readonly<ChatPersonaIntensityEnvelope> = {
  minimum: 0,
  baseline: 0.35,
  preferred: 0.5,
  peak: 0.9,
  decayPerBeat: 0.12,
};

export const DEFAULT_CHAT_PERSONA_LATENCY: Readonly<ChatPersonaLatencyEnvelope> = {
  minDelayMs: 0,
  softDelayMs: 450,
  typicalDelayMs: 1100,
  hardDelayMs: 3200,
  maxDelayMs: 7000,
};

export const DEFAULT_CHAT_PERSONA_SENTENCE_ENVELOPE: Readonly<ChatPersonaSentenceEnvelope> = {
  minWords: 2,
  preferredWords: 12,
  maxWords: 28,
  sentenceCountFloor: 1,
  sentenceCountCeiling: 3,
};

export const DEFAULT_CHAT_PERSONA_PUNCTUATION: Readonly<ChatPersonaPunctuationProfile> = {
  periodBias: 0.6,
  commaBias: 0.55,
  ellipsisBias: 0.1,
  dashBias: 0.15,
  exclamationBias: 0.08,
  questionBias: 0.15,
  lowercaseBias: 0.25,
  uppercaseBias: 0.02,
  noPunctuationBias: 0.05,
  doublePunctuationBias: 0.01,
  emojiBias: 0,
};

export const DEFAULT_CHAT_PERSONA_EVIDENCE_POLICY: Readonly<ChatPersonaEvidencePolicy> = {
  mode: 'NONE',
  quoteBias: 0,
  callbackBias: 0,
  proofBias: 0,
  memoryBias: 0,
  witnessBias: 0,
  replayBias: 0,
};

export const DEFAULT_CHAT_PERSONA_INTERRUPTION_POLICY: Readonly<ChatPersonaInterruptionPolicy> = {
  mode: 'CONDITIONAL',
  priorityBias: 0.5,
  rescueOverrideBias: 0.7,
  rivalryOverrideBias: 0.65,
  worldEventOverrideBias: 0.8,
  publicEmbarrassmentBias: 0.55,
  cooldownMs: 800,
};

export const DEFAULT_CHAT_PERSONA_VISIBILITY_POLICY: Readonly<ChatPersonaVisibilityPolicy> = {
  visibility: 'PUBLIC',
  preferredChannels: [],
  disallowedChannels: [],
  shadowBias: 0,
  dmBias: 0.25,
  publicBias: 0.75,
  syndicateBias: 0.45,
  dealRoomBias: 0.25,
};

export const DEFAULT_CHAT_PERSONA_WITNESS_POLICY: Readonly<ChatPersonaWitnessPolicy> = {
  witnessStyle: 'NEUTRAL',
  witnessAggressionBias: 0.2,
  witnessMercyBias: 0.2,
  witnessCeremonyBias: 0.1,
  crowdEchoBias: 0.3,
  pileOnBias: 0.25,
};

export const DEFAULT_CHAT_PERSONA_DEAL_POLICY: Readonly<ChatPersonaDealPolicy> = {
  posture: 'WATCHFUL',
  bluffExposureBias: 0.35,
  patienceBias: 0.5,
  overpayPunishBias: 0.4,
  leakToPublicBias: 0.15,
  privatePressureBias: 0.25,
  formalToneBias: 0.4,
};

export const DEFAULT_CHAT_PERSONA_RECOVERY_POLICY: Readonly<ChatPersonaRecoveryPolicy> = {
  posture: 'NONE',
  patience: 0.4,
  softness: 0.2,
  bluntness: 0.2,
  nextActionBias: 0.4,
  breathRoomBias: 0.35,
  publicShieldingBias: 0.15,
};

export const DEFAULT_CHAT_PERSONA_MEMORY_POLICY: Readonly<ChatPersonaMemoryPolicy> = {
  orientation: 'MID',
  quoteCaptureBias: 0.35,
  callbackReuseBias: 0.25,
  forgivenessBias: 0.2,
  obsessionBias: 0.15,
  salienceThreshold: 0.5,
  expiryFavorShortTerm: 0.55,
};

export const DEFAULT_CHAT_PERSONA_SCENE_POLICY: Readonly<ChatPersonaScenePolicy> = {
  sceneWeight: 'MEDIUM',
  silencePreference: 'WAITS_FOR_BEAT',
  miniSceneBias: 0.35,
  backgroundCommentBias: 0.45,
  anchorSceneBias: 0.25,
  aftermathBias: 0.4,
};

export const DEFAULT_CHAT_PERSONA_HEAT_POLICY: Readonly<ChatPersonaHeatPolicy> = {
  globalHeatBias: 0.5,
  syndicateHeatBias: 0.45,
  dealRoomHeatBias: 0.3,
  spectatorHeatBias: 0.35,
  embarrassmentSensitivity: 0.5,
  crowdActivationThreshold: 0.45,
  dogpileRiskBias: 0.4,
};

export const DEFAULT_CHAT_PERSONA_RELATIONSHIP_BIAS: Readonly<ChatPersonaRelationshipBias> = {
  trustBias: 0,
  fearBias: 0,
  contemptBias: 0,
  fascinationBias: 0,
  respectBias: 0,
  rescueDebtBias: 0,
  rivalryBias: 0,
  familiarityBias: 0,
};

export const DEFAULT_CHAT_PERSONA_ARCHETYPE_WEIGHTS: Readonly<ChatPersonaArchetypeWeights> = {
  predator: 0,
  mentor: 0,
  rival: 0,
  witness: 0,
  merchant: 0,
  narrator: 0,
  whisperer: 0,
  executioner: 0,
  rescuer: 0,
  mystic: 0,
};

// ============================================================================
// MARK: Utility helpers
// ============================================================================

export function clampPersonaUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function clampPersonaSigned(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < -1) return -1;
  if (value > 1) return 1;
  return value;
}

export function normalizeLabels(values: readonly string[] | undefined): readonly string[] {
  if (!values?.length) return [];
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort();
}

export function normalizeTemplates(values: readonly string[] | undefined): readonly string[] {
  if (!values?.length) return [];
  return values.map((value) => value.trim()).filter(Boolean);
}

export function createDefaultPersonaDefinition(
  id: ChatPersonaId,
  displayName: ChatPersonaDisplayName,
): ChatPersonaDefinition {
  return {
    id,
    version: '1.0.0',
    slug: displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    displayName,
    role: 'UNKNOWN',
    primaryLane: 'MULTI',
    channelPreference: 'CONTEXTUAL',
    labels: [],
    tags: [],
    description: '',
    authoredIntent: '',
    cadence: 'MEASURED',
    aggressionStyle: 'NONE',
    supportStyle: 'NONE',
    evidencePolicy: DEFAULT_CHAT_PERSONA_EVIDENCE_POLICY,
    interruptionPolicy: DEFAULT_CHAT_PERSONA_INTERRUPTION_POLICY,
    visibilityPolicy: DEFAULT_CHAT_PERSONA_VISIBILITY_POLICY,
    witnessPolicy: DEFAULT_CHAT_PERSONA_WITNESS_POLICY,
    dealPolicy: DEFAULT_CHAT_PERSONA_DEAL_POLICY,
    recoveryPolicy: DEFAULT_CHAT_PERSONA_RECOVERY_POLICY,
    memoryPolicy: DEFAULT_CHAT_PERSONA_MEMORY_POLICY,
    scenePolicy: DEFAULT_CHAT_PERSONA_SCENE_POLICY,
    heatPolicy: DEFAULT_CHAT_PERSONA_HEAT_POLICY,
    relationshipBias: DEFAULT_CHAT_PERSONA_RELATIONSHIP_BIAS,
    emotionBand: 'COOL',
    readPattern: 'QUICK',
    typingPattern: 'SHORT',
    intensity: DEFAULT_CHAT_PERSONA_INTENSITY,
    latency: DEFAULT_CHAT_PERSONA_LATENCY,
    sentenceEnvelope: DEFAULT_CHAT_PERSONA_SENTENCE_ENVELOPE,
    punctuation: DEFAULT_CHAT_PERSONA_PUNCTUATION,
    lexiconRules: [],
    openingRules: [],
    closingRules: [],
    triggerRules: [],
    archetypeWeights: DEFAULT_CHAT_PERSONA_ARCHETYPE_WEIGHTS,
    signatureLines: [],
    antiSignatureLines: [],
  };
}

export function applyPersonaPatch(
  persona: ChatPersonaDefinition,
  patch: ChatPersonaPatch,
): ChatPersonaDefinition {
  return {
    ...persona,
    displayName: patch.displayName ?? persona.displayName,
    description: patch.description ?? persona.description,
    authoredIntent: patch.authoredIntent ?? persona.authoredIntent,
    cadence: patch.cadence ?? persona.cadence,
    aggressionStyle: patch.aggressionStyle ?? persona.aggressionStyle,
    supportStyle: patch.supportStyle ?? persona.supportStyle,
    evidencePolicy: { ...persona.evidencePolicy, ...patch.evidencePolicy },
    interruptionPolicy: { ...persona.interruptionPolicy, ...patch.interruptionPolicy },
    visibilityPolicy: { ...persona.visibilityPolicy, ...patch.visibilityPolicy },
    witnessPolicy: { ...persona.witnessPolicy, ...patch.witnessPolicy },
    dealPolicy: { ...persona.dealPolicy, ...patch.dealPolicy },
    recoveryPolicy: { ...persona.recoveryPolicy, ...patch.recoveryPolicy },
    memoryPolicy: { ...persona.memoryPolicy, ...patch.memoryPolicy },
    scenePolicy: { ...persona.scenePolicy, ...patch.scenePolicy },
    heatPolicy: { ...persona.heatPolicy, ...patch.heatPolicy },
    relationshipBias: { ...persona.relationshipBias, ...patch.relationshipBias },
    emotionBand: patch.emotionBand ?? persona.emotionBand,
    readPattern: patch.readPattern ?? persona.readPattern,
    typingPattern: patch.typingPattern ?? persona.typingPattern,
    intensity: { ...persona.intensity, ...patch.intensity },
    latency: { ...persona.latency, ...patch.latency },
    sentenceEnvelope: { ...persona.sentenceEnvelope, ...patch.sentenceEnvelope },
    punctuation: { ...persona.punctuation, ...patch.punctuation },
    lexiconRules: patch.lexiconRules ?? persona.lexiconRules,
    openingRules: patch.openingRules ?? persona.openingRules,
    closingRules: patch.closingRules ?? persona.closingRules,
    triggerRules: patch.triggerRules ?? persona.triggerRules,
    archetypeWeights: { ...persona.archetypeWeights, ...patch.archetypeWeights },
    signatureLines: patch.signatureLines ?? persona.signatureLines,
    antiSignatureLines: patch.antiSignatureLines ?? persona.antiSignatureLines,
    labels: normalizeLabels(patch.labels ?? persona.labels),
    tags: normalizeLabels(patch.tags ?? persona.tags),
    custom: patch.custom ?? persona.custom,
  };
}

export function summarizePersona(persona: ChatPersonaDefinition): ChatPersonaSummary {
  return {
    id: persona.id,
    version: persona.version,
    displayName: persona.displayName,
    role: persona.role,
    primaryLane: persona.primaryLane,
    cadence: persona.cadence,
    aggressionStyle: persona.aggressionStyle,
    supportStyle: persona.supportStyle,
    emotionBand: persona.emotionBand,
    channelPreference: persona.channelPreference,
    labels: persona.labels,
    tags: persona.tags,
  };
}

export function personaSupportsTrigger(
  persona: ChatPersonaDefinition,
  trigger: ChatPersonaTriggerClass,
): boolean {
  return persona.triggerRules.some((rule) => rule.trigger === trigger && rule.weight > 0);
}

export function personaPrefersChannel(
  persona: ChatPersonaDefinition,
  channelId: ChatChannelId,
): boolean {
  if (persona.visibilityPolicy.disallowedChannels.includes(channelId)) return false;
  if (persona.visibilityPolicy.preferredChannels.length === 0) return true;
  return persona.visibilityPolicy.preferredChannels.includes(channelId);
}

export function personaCanInterrupt(
  persona: ChatPersonaDefinition,
  hint?: ChatPersonaRuntimeHint,
): boolean {
  if (persona.interruptionPolicy.mode === 'NEVER') return false;
  if (hint?.allowInterruption === false) return false;
  return true;
}

export function personaHeatScore(
  persona: ChatPersonaDefinition,
  channelId: ChatChannelId,
): number {
  switch (channelId) {
    case 'GLOBAL':
      return persona.heatPolicy.globalHeatBias;
    case 'SYNDICATE':
      return persona.heatPolicy.syndicateHeatBias;
    case 'DEAL_ROOM':
      return persona.heatPolicy.dealRoomHeatBias;
    case 'SPECTATOR':
      return persona.heatPolicy.spectatorHeatBias;
    default:
      return (
        persona.heatPolicy.globalHeatBias +
        persona.heatPolicy.syndicateHeatBias +
        persona.heatPolicy.dealRoomHeatBias +
        persona.heatPolicy.spectatorHeatBias
      ) / 4;
  }
}

export function personaArchetypePeak(
  persona: ChatPersonaDefinition,
): keyof ChatPersonaArchetypeWeights {
  let bestKey: keyof ChatPersonaArchetypeWeights = 'predator';
  let bestValue = -Infinity;
  const entries = Object.entries(persona.archetypeWeights) as Array<
    [keyof ChatPersonaArchetypeWeights, number]
  >;
  for (const [key, value] of entries) {
    if (value > bestValue) {
      bestValue = value;
      bestKey = key;
    }
  }
  return bestKey;
}

export function validatePersonaDefinition(
  persona: ChatPersonaDefinition,
): ChatPersonaValidationResult {
  const issues: ChatPersonaValidationIssue[] = [];
  if (!persona.id.trim()) {
    issues.push({
      code: 'EMPTY_ID',
      path: 'id',
      message: 'Persona id cannot be empty.',
      severity: 'ERROR',
    });
  }
  if (!persona.displayName.trim()) {
    issues.push({
      code: 'EMPTY_NAME',
      path: 'displayName',
      message: 'Persona displayName cannot be empty.',
      severity: 'ERROR',
    });
  }
  const numericChecks: Array<[string, number]> = [
    ['intensity.minimum', persona.intensity.minimum],
    ['intensity.baseline', persona.intensity.baseline],
    ['intensity.preferred', persona.intensity.preferred],
    ['intensity.peak', persona.intensity.peak],
    ['punctuation.periodBias', persona.punctuation.periodBias],
    ['punctuation.commaBias', persona.punctuation.commaBias],
    ['punctuation.ellipsisBias', persona.punctuation.ellipsisBias],
    ['punctuation.dashBias', persona.punctuation.dashBias],
    ['punctuation.exclamationBias', persona.punctuation.exclamationBias],
    ['punctuation.questionBias', persona.punctuation.questionBias],
    ['punctuation.lowercaseBias', persona.punctuation.lowercaseBias],
    ['punctuation.uppercaseBias', persona.punctuation.uppercaseBias],
    ['punctuation.noPunctuationBias', persona.punctuation.noPunctuationBias],
    ['punctuation.doublePunctuationBias', persona.punctuation.doublePunctuationBias],
    ['punctuation.emojiBias', persona.punctuation.emojiBias],
  ];
  for (const [path, value] of numericChecks) {
    if (!Number.isFinite(value)) {
      issues.push({
        code: 'OUT_OF_RANGE',
        path,
        message: `${path} must be finite.`,
        severity: 'ERROR',
      });
    }
  }
  const seenTags = new Set<string>();
  for (const tag of persona.tags) {
    if (seenTags.has(tag)) {
      issues.push({
        code: 'DUPLICATE_TAG',
        path: 'tags',
        message: `Duplicate tag detected: ${tag}`,
        severity: 'WARN',
      });
    }
    seenTags.add(tag);
  }
  if (persona.signatureLines.some((line) => !line.trim())) {
    issues.push({
      code: 'INVALID_SIGNATURE',
      path: 'signatureLines',
      message: 'Signature lines must be non-empty.',
      severity: 'WARN',
    });
  }
  return { ok: !issues.some((issue) => issue.severity === 'ERROR'), issues };
}

export function buildPersonaLookup(
  entries: readonly ChatPersonaRegistryEntry[],
): ChatPersonaLookup {
  const byId: Record<ChatPersonaId, ChatPersonaRegistryEntry> = {};
  const byRole: Record<ChatPersonaRole, ChatPersonaId[]> = {
    PLAYER_PROXY: [],
    SYSTEM: [],
    RIVAL: [],
    HELPER: [],
    DEAL_AGENT: [],
    SPECTATOR: [],
    NARRATOR: [],
    MODERATOR: [],
    FACTION_VOICE: [],
    WORLD_EVENT_VOICE: [],
    BOSS: [],
    AMBIENT_CROWD: [],
    WHISPER: [],
    UNKNOWN: [],
  };
  const byLane: Record<ChatPersonaLane, ChatPersonaId[]> = {
    GLOBAL: [],
    SYNDICATE: [],
    DEAL_ROOM: [],
    DIRECT: [],
    SPECTATOR: [],
    SYSTEM: [],
    WORLD_EVENT: [],
    SHADOW: [],
    MULTI: [],
  };
  const byTag: Record<ChatTag, ChatPersonaId[]> = {};
  for (const entry of entries) {
    byId[entry.persona.id] = entry;
    byRole[entry.persona.role].push(entry.persona.id);
    byLane[entry.persona.primaryLane].push(entry.persona.id);
    for (const tag of entry.persona.tags) {
      (byTag[tag] ??= []).push(entry.persona.id);
    }
  }
  return { byId, byRole, byLane, byTag };
}

// ============================================================================
// MARK: Derived profile helpers
// ============================================================================

export interface ChatPersonaToneProjection {
  readonly sharpness: number;
  readonly warmth: number;
  readonly patience: number;
  readonly theatricality: number;
  readonly menace: number;
  readonly helpfulness: number;
  readonly formality: number;
  readonly volatility: number;
}

export function deriveToneProjection(persona: ChatPersonaDefinition): ChatPersonaToneProjection {
  const aggression =
    persona.aggressionStyle === 'NONE'
      ? 0
      : persona.aggressionStyle === 'DIRECT'
        ? 0.55
        : persona.aggressionStyle === 'SARCASTIC'
          ? 0.5
          : persona.aggressionStyle === 'CONDESCENDING'
            ? 0.62
            : persona.aggressionStyle === 'PREDATORY'
              ? 0.74
              : persona.aggressionStyle === 'PSYCHOLOGICAL'
                ? 0.7
                : persona.aggressionStyle === 'CEREMONIAL'
                  ? 0.42
                  : persona.aggressionStyle === 'DOGPILE'
                    ? 0.8
                    : persona.aggressionStyle === 'WHISPER_POISON'
                      ? 0.67
                      : persona.aggressionStyle === 'PUBLIC_SHAME'
                        ? 0.78
                        : persona.aggressionStyle === 'RELENTLESS'
                          ? 0.85
                          : 0.72;

  const support =
    persona.supportStyle === 'NONE'
      ? 0
      : persona.supportStyle === 'COACHING'
        ? 0.66
        : persona.supportStyle === 'TACTICAL'
          ? 0.58
          : persona.supportStyle === 'CALMING'
            ? 0.72
            : persona.supportStyle === 'RITUAL'
              ? 0.44
              : persona.supportStyle === 'EMERGENCY'
                ? 0.63
                : persona.supportStyle === 'TENDER'
                  ? 0.81
                  : persona.supportStyle === 'BLUNT'
                    ? 0.41
                    : persona.supportStyle === 'ANALYTIC'
                      ? 0.46
                      : persona.supportStyle === 'PROTECTIVE'
                        ? 0.69
                        : 0.75;

  const formalTone =
    persona.dealPolicy.formalToneBias * 0.6 +
    (persona.witnessPolicy.witnessStyle === 'REVERENT' ? 0.25 : 0) +
    (persona.cadence === 'CEREMONIAL' ? 0.2 : 0);

  return {
    sharpness: clampPersonaUnit(aggression * 0.75 + persona.interruptionPolicy.priorityBias * 0.25),
    warmth: clampPersonaUnit(support * 0.7 + persona.recoveryPolicy.softness * 0.3),
    patience: clampPersonaUnit(
      persona.dealPolicy.patienceBias * 0.45 +
        persona.recoveryPolicy.patience * 0.35 +
        (persona.readPattern === 'STRATEGIC_DELAY' ? 0.2 : 0),
    ),
    theatricality: clampPersonaUnit(
      persona.scenePolicy.miniSceneBias * 0.4 +
        persona.witnessPolicy.witnessCeremonyBias * 0.35 +
        (persona.typingPattern === 'THEATRICAL' ? 0.25 : 0),
    ),
    menace: clampPersonaUnit(aggression * 0.8 + persona.relationshipBias.fearBias * 0.2),
    helpfulness: clampPersonaUnit(support * 0.8 + persona.relationshipBias.trustBias * 0.2),
    formality: clampPersonaUnit(formalTone),
    volatility: clampPersonaUnit(
      persona.heatPolicy.dogpileRiskBias * 0.35 +
        persona.intensity.peak * 0.35 +
        (persona.emotionBand === 'VOLATILE' ? 0.3 : 0),
    ),
  };
}

export interface ChatPersonaSelectionScoreBreakdown {
  readonly personaId: ChatPersonaId;
  readonly channelFit: number;
  readonly triggerFit: number;
  readonly heatFit: number;
  readonly evidenceFit: number;
  readonly relationshipFit: number;
  readonly sceneFit: number;
  readonly total: number;
}

export function scorePersonaForHint(
  persona: ChatPersonaDefinition,
  hint: ChatPersonaRuntimeHint,
): ChatPersonaSelectionScoreBreakdown {
  const channelFit = hint.channelId ? (personaPrefersChannel(persona, hint.channelId) ? 1 : 0) : 0.5;
  const triggerFit = hint.trigger ? (personaSupportsTrigger(persona, hint.trigger) ? 1 : 0.25) : 0.5;
  const heatFit = hint.channelId ? 1 - Math.abs(personaHeatScore(persona, hint.channelId) - clampPersonaUnit(hint.heat ?? 0.5)) : 0.5;
  const evidenceFit = hint.evidenceAvailable
    ? clampPersonaUnit(
        persona.evidencePolicy.proofBias * 0.35 +
          persona.evidencePolicy.quoteBias * 0.25 +
          persona.evidencePolicy.callbackBias * 0.2 +
          persona.evidencePolicy.memoryBias * 0.2,
      )
    : 0.3;
  const relationshipFit = clampPersonaUnit(
    Math.abs(persona.relationshipBias.trustBias - clampPersonaSigned(hint.trust ?? 0)) * -0.4 +
      Math.abs(persona.relationshipBias.rivalryBias - clampPersonaSigned(hint.rivalry ?? 0)) * -0.4 +
      Math.abs(persona.relationshipBias.rescueDebtBias - clampPersonaSigned(hint.rescueDebt ?? 0)) * -0.2 +
      1,
  );
  const sceneFit = clampPersonaUnit(
    persona.scenePolicy.miniSceneBias * (hint.allowMiniScene ? 0.5 : 0.15) +
      persona.scenePolicy.anchorSceneBias * 0.25 +
      persona.scenePolicy.aftermathBias * 0.25,
  );
  const total = clampPersonaUnit(
    channelFit * 0.16 +
      triggerFit * 0.18 +
      heatFit * 0.16 +
      evidenceFit * 0.16 +
      relationshipFit * 0.16 +
      sceneFit * 0.18,
  );
  return {
    personaId: persona.id,
    channelFit,
    triggerFit,
    heatFit,
    evidenceFit,
    relationshipFit,
    sceneFit,
    total,
  };
}

export function selectBestPersona(
  entries: readonly ChatPersonaRegistryEntry[],
  hint: ChatPersonaRuntimeHint,
): ChatPersonaSelectionEnvelope {
  const scored = entries
    .filter((entry) => entry.active)
    .map((entry) => scorePersonaForHint(entry.persona, hint))
    .sort((left, right) => right.total - left.total);

  return {
    preferred: scored.slice(0, 5).map((item) => item.personaId),
    avoided: scored.slice(-5).map((item) => item.personaId),
    weights: Object.fromEntries(scored.map((item) => [item.personaId, item.total])),
    reason: hint.trigger
      ? `Selection favored personas with trigger support for ${hint.trigger}.`
      : 'Selection favored general-fit personas.',
  };
}

// ============================================================================
// MARK: Serialization helpers
// ============================================================================

export function personaToJson(persona: ChatPersonaDefinition): ChatPersonaJsonValue {
  return persona as unknown as ChatPersonaJsonValue;
}

export function personaRegistryEntryToJson(entry: ChatPersonaRegistryEntry): ChatPersonaJsonValue {
  return entry as unknown as ChatPersonaJsonValue;
}

export function personaSummaryToJson(summary: ChatPersonaSummary): ChatPersonaJsonValue {
  return summary as unknown as ChatPersonaJsonValue;
}

// ============================================================================
// MARK: Export bundles
// ============================================================================

export interface ChatPersonaContractBundle {
  readonly persona: ChatPersonaDefinition;
  readonly summary: ChatPersonaSummary;
  readonly validation: ChatPersonaValidationResult;
  readonly tone: ChatPersonaToneProjection;
}

export function buildPersonaContractBundle(
  persona: ChatPersonaDefinition,
): ChatPersonaContractBundle {
  return {
    persona,
    summary: summarizePersona(persona),
    validation: validatePersonaDefinition(persona),
    tone: deriveToneProjection(persona),
  };
}

// ============================================================================
// MARK: Preset SYSTEM_ARBITER
// ============================================================================

export function createPresetSYSTEM_ARBITERPersona(id: ChatPersonaId, displayName = 'System Arbiter'): ChatPersonaDefinition {
  return applyPersonaPatch(createDefaultPersonaDefinition(id, displayName), {
    cadence: 'MEASURED',
    aggressionStyle: 'NONE',
    supportStyle: 'ANALYTIC',
    emotionBand: 'COOL',
    readPattern: 'INSTANT',
    typingPattern: 'STEADY',
    labels: ['preset', 'system', 'system'],
    tags: ['system_arbiter', 'system', 'system'],
    description: 'Generated preset contract for SYSTEM_ARBITER.',
    authoredIntent: 'Provide an authored baseline for SYSTEM_ARBITER.',
    evidencePolicy: {
      ...DEFAULT_CHAT_PERSONA_EVIDENCE_POLICY,
      mode: 'PROOF_FORWARD',
      quoteBias: 0.35,
      callbackBias: 0.25,
      proofBias: 0.85,
      memoryBias: 0.4,
      witnessBias: 0.25,
      replayBias: 0.55,
    },
    relationshipBias: {
      ...DEFAULT_CHAT_PERSONA_RELATIONSHIP_BIAS,
      trustBias: 0.75,
      fearBias: 0.15,
      contemptBias: 0.1,
      fascinationBias: 0.15,
      respectBias: 0.55,
      rescueDebtBias: 0.08,
      rivalryBias: 0.1,
      familiarityBias: 0.33,
    },
    archetypeWeights: {
      predator: 0.05,
      mentor: 0.04,
      rival: 0.08,
      witness: 0.1,
      merchant: 0.06,
      narrator: 0.88,
      whisperer: 0.08,
      executioner: 0.04,
      rescuer: 0.9,
      mystic: 0.05,
    },
    triggerRules: [
      {
        id: 'system_arbiter-run-start',
        trigger: 'RUN_START',
        weight: 0.25,
      },
      {
        id: 'system_arbiter-pressure-spike',
        trigger: 'PRESSURE_SPIKE',
        weight: 0.44,
        minimumHeat: 0.35,
      },
      {
        id: 'system_arbiter-come-back',
        trigger: 'COME_BACK',
        weight: 0.72,
      },
      {
        id: 'system_arbiter-quote-callback',
        trigger: 'QUOTE_CALLBACK',
        weight: 0.63,
        requiresQuote: true,
      },
      {
        id: 'system_arbiter-rescue-window',
        trigger: 'RESCUE_WINDOW',
        weight: 0.94,
      },
    ],
    signatureLines: [
      ''.trim(),
    ].filter(Boolean),
  });
}


// ============================================================================
// MARK: Preset GLOBAL_HATER
// ============================================================================

export function createPresetGLOBAL_HATERPersona(id: ChatPersonaId, displayName = 'Global Hater'): ChatPersonaDefinition {
  return applyPersonaPatch(createDefaultPersonaDefinition(id, displayName), {
    cadence: 'STACCATO',
    aggressionStyle: 'PUBLIC_SHAME',
    supportStyle: 'NONE',
    emotionBand: 'HOT',
    readPattern: 'QUICK',
    typingPattern: 'BURST',
    labels: ['preset', 'rival', 'global'],
    tags: ['global_hater', 'rival', 'global'],
    description: 'Generated preset contract for GLOBAL_HATER.',
    authoredIntent: 'Provide an authored baseline for GLOBAL_HATER.',
    evidencePolicy: {
      ...DEFAULT_CHAT_PERSONA_EVIDENCE_POLICY,
      mode: 'QUOTE_FORWARD',
      quoteBias: 0.8,
      callbackBias: 0.72,
      proofBias: 0.3,
      memoryBias: 0.4,
      witnessBias: 0.25,
      replayBias: 0.2,
    },
    relationshipBias: {
      ...DEFAULT_CHAT_PERSONA_RELATIONSHIP_BIAS,
      trustBias: 0,
      fearBias: 0.82,
      contemptBias: 0.7,
      fascinationBias: 0.15,
      respectBias: 0.22,
      rescueDebtBias: 0.08,
      rivalryBias: 0.88,
      familiarityBias: 0.33,
    },
    archetypeWeights: {
      predator: 0.95,
      mentor: 0.04,
      rival: 0.94,
      witness: 0.1,
      merchant: 0.06,
      narrator: 0.05,
      whisperer: 0.08,
      executioner: 0.04,
      rescuer: 0.06,
      mystic: 0.05,
    },
    triggerRules: [
      {
        id: 'global_hater-run-start',
        trigger: 'RUN_START',
        weight: 0.25,
      },
      {
        id: 'global_hater-pressure-spike',
        trigger: 'PRESSURE_SPIKE',
        weight: 0.82,
        minimumHeat: 0.35,
      },
      {
        id: 'global_hater-come-back',
        trigger: 'COME_BACK',
        weight: 0.38,
      },
      {
        id: 'global_hater-quote-callback',
        trigger: 'QUOTE_CALLBACK',
        weight: 0.9,
        requiresQuote: true,
      },
      {
        id: 'global_hater-rescue-window',
        trigger: 'RESCUE_WINDOW',
        weight: 0.12,
      },
    ],
    signatureLines: [
      ''.trim(),
    ].filter(Boolean),
  });
}


// ============================================================================
// MARK: Preset SYNDICATE_FIXER
// ============================================================================

export function createPresetSYNDICATE_FIXERPersona(id: ChatPersonaId, displayName = 'Syndicate Fixer'): ChatPersonaDefinition {
  return applyPersonaPatch(createDefaultPersonaDefinition(id, displayName), {
    cadence: 'TACTICAL',
    aggressionStyle: 'NONE',
    supportStyle: 'TACTICAL',
    emotionBand: 'COOL',
    readPattern: 'QUICK',
    typingPattern: 'STEADY',
    labels: ['preset', 'helper', 'syndicate'],
    tags: ['syndicate_fixer', 'helper', 'syndicate'],
    description: 'Generated preset contract for SYNDICATE_FIXER.',
    authoredIntent: 'Provide an authored baseline for SYNDICATE_FIXER.',
    evidencePolicy: {
      ...DEFAULT_CHAT_PERSONA_EVIDENCE_POLICY,
      mode: 'MEMORY_FORWARD',
      quoteBias: 0.35,
      callbackBias: 0.72,
      proofBias: 0.3,
      memoryBias: 0.7,
      witnessBias: 0.25,
      replayBias: 0.2,
    },
    relationshipBias: {
      ...DEFAULT_CHAT_PERSONA_RELATIONSHIP_BIAS,
      trustBias: 0.75,
      fearBias: 0.15,
      contemptBias: 0.1,
      fascinationBias: 0.15,
      respectBias: 0.55,
      rescueDebtBias: 0.08,
      rivalryBias: 0.1,
      familiarityBias: 0.33,
    },
    archetypeWeights: {
      predator: 0.05,
      mentor: 0.82,
      rival: 0.08,
      witness: 0.1,
      merchant: 0.06,
      narrator: 0.05,
      whisperer: 0.85,
      executioner: 0.04,
      rescuer: 0.9,
      mystic: 0.05,
    },
    triggerRules: [
      {
        id: 'syndicate_fixer-run-start',
        trigger: 'RUN_START',
        weight: 0.25,
      },
      {
        id: 'syndicate_fixer-pressure-spike',
        trigger: 'PRESSURE_SPIKE',
        weight: 0.44,
        minimumHeat: 0.35,
      },
      {
        id: 'syndicate_fixer-come-back',
        trigger: 'COME_BACK',
        weight: 0.72,
      },
      {
        id: 'syndicate_fixer-quote-callback',
        trigger: 'QUOTE_CALLBACK',
        weight: 0.63,
        requiresQuote: true,
      },
      {
        id: 'syndicate_fixer-rescue-window',
        trigger: 'RESCUE_WINDOW',
        weight: 0.94,
      },
    ],
    signatureLines: [
      ''.trim(),
    ].filter(Boolean),
  });
}


// ============================================================================
// MARK: Preset DEAL_ROOM_SHARK
// ============================================================================

export function createPresetDEAL_ROOM_SHARKPersona(id: ChatPersonaId, displayName = 'Deal Room Shark'): ChatPersonaDefinition {
  return applyPersonaPatch(createDefaultPersonaDefinition(id, displayName), {
    cadence: 'COLD',
    aggressionStyle: 'PREDATORY',
    supportStyle: 'NONE',
    emotionBand: 'HOT',
    readPattern: 'QUICK',
    typingPattern: 'BURST',
    labels: ['preset', 'deal_agent', 'deal_room'],
    tags: ['deal_room_shark', 'deal_agent', 'deal_room'],
    description: 'Generated preset contract for DEAL_ROOM_SHARK.',
    authoredIntent: 'Provide an authored baseline for DEAL_ROOM_SHARK.',
    evidencePolicy: {
      ...DEFAULT_CHAT_PERSONA_EVIDENCE_POLICY,
      mode: 'PROOF_FORWARD',
      quoteBias: 0.35,
      callbackBias: 0.25,
      proofBias: 0.85,
      memoryBias: 0.4,
      witnessBias: 0.25,
      replayBias: 0.2,
    },
    relationshipBias: {
      ...DEFAULT_CHAT_PERSONA_RELATIONSHIP_BIAS,
      trustBias: 0,
      fearBias: 0.82,
      contemptBias: 0.1,
      fascinationBias: 0.15,
      respectBias: 0.55,
      rescueDebtBias: 0.08,
      rivalryBias: 0.1,
      familiarityBias: 0.33,
    },
    archetypeWeights: {
      predator: 0.95,
      mentor: 0.04,
      rival: 0.08,
      witness: 0.1,
      merchant: 0.92,
      narrator: 0.05,
      whisperer: 0.08,
      executioner: 0.04,
      rescuer: 0.06,
      mystic: 0.05,
    },
    triggerRules: [
      {
        id: 'deal_room_shark-run-start',
        trigger: 'RUN_START',
        weight: 0.25,
      },
      {
        id: 'deal_room_shark-pressure-spike',
        trigger: 'PRESSURE_SPIKE',
        weight: 0.82,
        minimumHeat: 0.35,
      },
      {
        id: 'deal_room_shark-come-back',
        trigger: 'COME_BACK',
        weight: 0.38,
      },
      {
        id: 'deal_room_shark-quote-callback',
        trigger: 'QUOTE_CALLBACK',
        weight: 0.9,
        requiresQuote: true,
      },
      {
        id: 'deal_room_shark-rescue-window',
        trigger: 'RESCUE_WINDOW',
        weight: 0.12,
      },
    ],
    signatureLines: [
      ''.trim(),
    ].filter(Boolean),
  });
}


// ============================================================================
// MARK: Preset CROWD_CHORUS
// ============================================================================

export function createPresetCROWD_CHORUSPersona(id: ChatPersonaId, displayName = 'Crowd Chorus'): ChatPersonaDefinition {
  return applyPersonaPatch(createDefaultPersonaDefinition(id, displayName), {
    cadence: 'VERBOSE',
    aggressionStyle: 'DOGPILE',
    supportStyle: 'NONE',
    emotionBand: 'HOT',
    readPattern: 'QUICK',
    typingPattern: 'BURST',
    labels: ['preset', 'ambient_crowd', 'global'],
    tags: ['crowd_chorus', 'ambient_crowd', 'global'],
    description: 'Generated preset contract for CROWD_CHORUS.',
    authoredIntent: 'Provide an authored baseline for CROWD_CHORUS.',
    evidencePolicy: {
      ...DEFAULT_CHAT_PERSONA_EVIDENCE_POLICY,
      mode: 'MEMORY_FORWARD',
      quoteBias: 0.35,
      callbackBias: 0.25,
      proofBias: 0.3,
      memoryBias: 0.4,
      witnessBias: 0.75,
      replayBias: 0.2,
    },
    relationshipBias: {
      ...DEFAULT_CHAT_PERSONA_RELATIONSHIP_BIAS,
      trustBias: 0,
      fearBias: 0.15,
      contemptBias: 0.1,
      fascinationBias: 0.15,
      respectBias: 0.22,
      rescueDebtBias: 0.08,
      rivalryBias: 0.1,
      familiarityBias: 0.33,
    },
    archetypeWeights: {
      predator: 0.05,
      mentor: 0.04,
      rival: 0.08,
      witness: 0.9,
      merchant: 0.06,
      narrator: 0.05,
      whisperer: 0.08,
      executioner: 0.04,
      rescuer: 0.06,
      mystic: 0.05,
    },
    triggerRules: [
      {
        id: 'crowd_chorus-run-start',
        trigger: 'RUN_START',
        weight: 0.25,
      },
      {
        id: 'crowd_chorus-pressure-spike',
        trigger: 'PRESSURE_SPIKE',
        weight: 0.82,
        minimumHeat: 0.35,
      },
      {
        id: 'crowd_chorus-come-back',
        trigger: 'COME_BACK',
        weight: 0.38,
      },
      {
        id: 'crowd_chorus-quote-callback',
        trigger: 'QUOTE_CALLBACK',
        weight: 0.9,
        requiresQuote: true,
      },
      {
        id: 'crowd_chorus-rescue-window',
        trigger: 'RESCUE_WINDOW',
        weight: 0.12,
      },
    ],
    signatureLines: [
      ''.trim(),
    ].filter(Boolean),
  });
}


// ============================================================================
// MARK: Preset WITNESS_MONK
// ============================================================================

export function createPresetWITNESS_MONKPersona(id: ChatPersonaId, displayName = 'Witness Monk'): ChatPersonaDefinition {
  return applyPersonaPatch(createDefaultPersonaDefinition(id, displayName), {
    cadence: 'CEREMONIAL',
    aggressionStyle: 'NONE',
    supportStyle: 'RITUAL',
    emotionBand: 'COOL',
    readPattern: 'QUICK',
    typingPattern: 'BURST',
    labels: ['preset', 'spectator', 'spectator'],
    tags: ['witness_monk', 'spectator', 'spectator'],
    description: 'Generated preset contract for WITNESS_MONK.',
    authoredIntent: 'Provide an authored baseline for WITNESS_MONK.',
    evidencePolicy: {
      ...DEFAULT_CHAT_PERSONA_EVIDENCE_POLICY,
      mode: 'MEMORY_FORWARD',
      quoteBias: 0.35,
      callbackBias: 0.25,
      proofBias: 0.3,
      memoryBias: 0.7,
      witnessBias: 0.75,
      replayBias: 0.2,
    },
    relationshipBias: {
      ...DEFAULT_CHAT_PERSONA_RELATIONSHIP_BIAS,
      trustBias: 0.75,
      fearBias: 0.15,
      contemptBias: 0.1,
      fascinationBias: 0.45,
      respectBias: 0.22,
      rescueDebtBias: 0.08,
      rivalryBias: 0.1,
      familiarityBias: 0.33,
    },
    archetypeWeights: {
      predator: 0.05,
      mentor: 0.04,
      rival: 0.08,
      witness: 0.9,
      merchant: 0.06,
      narrator: 0.05,
      whisperer: 0.08,
      executioner: 0.04,
      rescuer: 0.9,
      mystic: 0.65,
    },
    triggerRules: [
      {
        id: 'witness_monk-run-start',
        trigger: 'RUN_START',
        weight: 0.25,
      },
      {
        id: 'witness_monk-pressure-spike',
        trigger: 'PRESSURE_SPIKE',
        weight: 0.44,
        minimumHeat: 0.35,
      },
      {
        id: 'witness_monk-come-back',
        trigger: 'COME_BACK',
        weight: 0.72,
      },
      {
        id: 'witness_monk-quote-callback',
        trigger: 'QUOTE_CALLBACK',
        weight: 0.63,
        requiresQuote: true,
      },
      {
        id: 'witness_monk-rescue-window',
        trigger: 'RESCUE_WINDOW',
        weight: 0.94,
      },
    ],
    signatureLines: [
      ''.trim(),
    ].filter(Boolean),
  });
}


// ============================================================================
// MARK: Preset DIRECT_RESCUER
// ============================================================================

export function createPresetDIRECT_RESCUERPersona(id: ChatPersonaId, displayName = 'Direct Rescuer'): ChatPersonaDefinition {
  return applyPersonaPatch(createDefaultPersonaDefinition(id, displayName), {
    cadence: 'MEASURED',
    aggressionStyle: 'NONE',
    supportStyle: 'EMERGENCY',
    emotionBand: 'COOL',
    readPattern: 'QUICK',
    typingPattern: 'STEADY',
    labels: ['preset', 'helper', 'direct'],
    tags: ['direct_rescuer', 'helper', 'direct'],
    description: 'Generated preset contract for DIRECT_RESCUER.',
    authoredIntent: 'Provide an authored baseline for DIRECT_RESCUER.',
    evidencePolicy: {
      ...DEFAULT_CHAT_PERSONA_EVIDENCE_POLICY,
      mode: 'MEMORY_FORWARD',
      quoteBias: 0.35,
      callbackBias: 0.72,
      proofBias: 0.3,
      memoryBias: 0.7,
      witnessBias: 0.25,
      replayBias: 0.2,
    },
    relationshipBias: {
      ...DEFAULT_CHAT_PERSONA_RELATIONSHIP_BIAS,
      trustBias: 0.75,
      fearBias: 0.15,
      contemptBias: 0.1,
      fascinationBias: 0.15,
      respectBias: 0.55,
      rescueDebtBias: 0.7,
      rivalryBias: 0.1,
      familiarityBias: 0.33,
    },
    archetypeWeights: {
      predator: 0.05,
      mentor: 0.82,
      rival: 0.08,
      witness: 0.1,
      merchant: 0.06,
      narrator: 0.05,
      whisperer: 0.85,
      executioner: 0.04,
      rescuer: 0.9,
      mystic: 0.05,
    },
    triggerRules: [
      {
        id: 'direct_rescuer-run-start',
        trigger: 'RUN_START',
        weight: 0.25,
      },
      {
        id: 'direct_rescuer-pressure-spike',
        trigger: 'PRESSURE_SPIKE',
        weight: 0.44,
        minimumHeat: 0.35,
      },
      {
        id: 'direct_rescuer-come-back',
        trigger: 'COME_BACK',
        weight: 0.72,
      },
      {
        id: 'direct_rescuer-quote-callback',
        trigger: 'QUOTE_CALLBACK',
        weight: 0.63,
        requiresQuote: true,
      },
      {
        id: 'direct_rescuer-rescue-window',
        trigger: 'RESCUE_WINDOW',
        weight: 0.94,
      },
    ],
    signatureLines: [
      ''.trim(),
    ].filter(Boolean),
  });
}


// ============================================================================
// MARK: Preset BOSS_EXECUTOR
// ============================================================================

export function createPresetBOSS_EXECUTORPersona(id: ChatPersonaId, displayName = 'Boss Executor'): ChatPersonaDefinition {
  return applyPersonaPatch(createDefaultPersonaDefinition(id, displayName), {
    cadence: 'CINEMATIC',
    aggressionStyle: 'RELENTLESS',
    supportStyle: 'NONE',
    emotionBand: 'HOT',
    readPattern: 'INSTANT',
    typingPattern: 'BURST',
    labels: ['preset', 'boss', 'multi'],
    tags: ['boss_executor', 'boss', 'multi'],
    description: 'Generated preset contract for BOSS_EXECUTOR.',
    authoredIntent: 'Provide an authored baseline for BOSS_EXECUTOR.',
    evidencePolicy: {
      ...DEFAULT_CHAT_PERSONA_EVIDENCE_POLICY,
      mode: 'QUOTE_FORWARD',
      quoteBias: 0.8,
      callbackBias: 0.72,
      proofBias: 0.3,
      memoryBias: 0.4,
      witnessBias: 0.25,
      replayBias: 0.55,
    },
    relationshipBias: {
      ...DEFAULT_CHAT_PERSONA_RELATIONSHIP_BIAS,
      trustBias: 0,
      fearBias: 0.82,
      contemptBias: 0.1,
      fascinationBias: 0.45,
      respectBias: 0.22,
      rescueDebtBias: 0.08,
      rivalryBias: 0.88,
      familiarityBias: 0.33,
    },
    archetypeWeights: {
      predator: 0.95,
      mentor: 0.04,
      rival: 0.94,
      witness: 0.1,
      merchant: 0.06,
      narrator: 0.05,
      whisperer: 0.08,
      executioner: 0.86,
      rescuer: 0.06,
      mystic: 0.05,
    },
    triggerRules: [
      {
        id: 'boss_executor-run-start',
        trigger: 'RUN_START',
        weight: 0.25,
      },
      {
        id: 'boss_executor-pressure-spike',
        trigger: 'PRESSURE_SPIKE',
        weight: 0.82,
        minimumHeat: 0.35,
      },
      {
        id: 'boss_executor-come-back',
        trigger: 'COME_BACK',
        weight: 0.38,
      },
      {
        id: 'boss_executor-quote-callback',
        trigger: 'QUOTE_CALLBACK',
        weight: 0.9,
        requiresQuote: true,
      },
      {
        id: 'boss_executor-rescue-window',
        trigger: 'RESCUE_WINDOW',
        weight: 0.12,
      },
    ],
    signatureLines: [
      ''.trim(),
    ].filter(Boolean),
  });
}


// ============================================================================
// MARK: Bulk registry presets
// ============================================================================

export const CHAT_PERSONA_PRESET_FACTORY_REGISTRY = {
  createPresetSYSTEM_ARBITERPersona,
  createPresetGLOBAL_HATERPersona,
  createPresetSYNDICATE_FIXERPersona,
  createPresetDEAL_ROOM_SHARKPersona,
  createPresetCROWD_CHORUSPersona,
  createPresetWITNESS_MONKPersona,
  createPresetDIRECT_RESCUERPersona,
  createPresetBOSS_EXECUTORPersona,
} as const;

export type ChatPersonaPresetFactoryName = keyof typeof CHAT_PERSONA_PRESET_FACTORY_REGISTRY;

export function createPresetPersona(
  name: ChatPersonaPresetFactoryName,
  id: ChatPersonaId,
  displayName?: string,
): ChatPersonaDefinition {
  return CHAT_PERSONA_PRESET_FACTORY_REGISTRY[name](id, displayName);
}

export function createDefaultPresetRegistry(): readonly ChatPersonaRegistryEntry[] {
  return [
    {
      persona: createPresetSYSTEM_ARBITERPersona('system-arbiter', 'System Arbiter'),
      active: true,
      loadedFrom: 'shared/contracts/chat/ChatPersona.ts',
    },
    {
      persona: createPresetGLOBAL_HATERPersona('global-hater', 'Global Hater'),
      active: true,
      loadedFrom: 'shared/contracts/chat/ChatPersona.ts',
    },
    {
      persona: createPresetSYNDICATE_FIXERPersona('syndicate-fixer', 'Syndicate Fixer'),
      active: true,
      loadedFrom: 'shared/contracts/chat/ChatPersona.ts',
    },
    {
      persona: createPresetDEAL_ROOM_SHARKPersona('deal-room-shark', 'Deal Room Shark'),
      active: true,
      loadedFrom: 'shared/contracts/chat/ChatPersona.ts',
    },
    {
      persona: createPresetCROWD_CHORUSPersona('crowd-chorus', 'Crowd Chorus'),
      active: true,
      loadedFrom: 'shared/contracts/chat/ChatPersona.ts',
    },
    {
      persona: createPresetWITNESS_MONKPersona('witness-monk', 'Witness Monk'),
      active: true,
      loadedFrom: 'shared/contracts/chat/ChatPersona.ts',
    },
    {
      persona: createPresetDIRECT_RESCUERPersona('direct-rescuer', 'Direct Rescuer'),
      active: true,
      loadedFrom: 'shared/contracts/chat/ChatPersona.ts',
    },
    {
      persona: createPresetBOSS_EXECUTORPersona('boss-executor', 'Boss Executor'),
      active: true,
      loadedFrom: 'shared/contracts/chat/ChatPersona.ts',
    },
  ];
}

// ============================================================================
// MARK: Diagnostics
// ============================================================================

export interface ChatPersonaDiagnostics {
  readonly entryCount: number;
  readonly activeCount: number;
  readonly deprecatedCount: number;
  readonly roles: Readonly<Record<ChatPersonaRole, number>>;
  readonly lanes: Readonly<Record<ChatPersonaLane, number>>;
  readonly hottestAverage: number;
  readonly mostAggressiveIds: readonly ChatPersonaId[];
  readonly mostHelpfulIds: readonly ChatPersonaId[];
}

export function diagnosePersonaRegistry(
  entries: readonly ChatPersonaRegistryEntry[],
): ChatPersonaDiagnostics {
  const roles: Record<ChatPersonaRole, number> = {
    PLAYER_PROXY: 0,
    SYSTEM: 0,
    RIVAL: 0,
    HELPER: 0,
    DEAL_AGENT: 0,
    SPECTATOR: 0,
    NARRATOR: 0,
    MODERATOR: 0,
    FACTION_VOICE: 0,
    WORLD_EVENT_VOICE: 0,
    BOSS: 0,
    AMBIENT_CROWD: 0,
    WHISPER: 0,
    UNKNOWN: 0,
  };
  const lanes: Record<ChatPersonaLane, number> = {
    GLOBAL: 0,
    SYNDICATE: 0,
    DEAL_ROOM: 0,
    DIRECT: 0,
    SPECTATOR: 0,
    SYSTEM: 0,
    WORLD_EVENT: 0,
    SHADOW: 0,
    MULTI: 0,
  };
  let totalHeat = 0;
  const aggressive = [...entries]
    .sort((a, b) => deriveToneProjection(b.persona).menace - deriveToneProjection(a.persona).menace)
    .slice(0, 5)
    .map((entry) => entry.persona.id);
  const helpful = [...entries]
    .sort((a, b) => deriveToneProjection(b.persona).helpfulness - deriveToneProjection(a.persona).helpfulness)
    .slice(0, 5)
    .map((entry) => entry.persona.id);

  for (const entry of entries) {
    roles[entry.persona.role] += 1;
    lanes[entry.persona.primaryLane] += 1;
    totalHeat +=
      entry.persona.heatPolicy.globalHeatBias +
      entry.persona.heatPolicy.syndicateHeatBias +
      entry.persona.heatPolicy.dealRoomHeatBias +
      entry.persona.heatPolicy.spectatorHeatBias;
  }

  return {
    entryCount: entries.length,
    activeCount: entries.filter((entry) => entry.active).length,
    deprecatedCount: entries.filter((entry) => entry.deprecated).length,
    roles,
    lanes,
    hottestAverage: entries.length ? totalHeat / (entries.length * 4) : 0,
    mostAggressiveIds: aggressive,
    mostHelpfulIds: helpful,
  };
}
