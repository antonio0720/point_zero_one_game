/* eslint-disable max-lines */
/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT SEMANTIC SIMILARITY CONTRACTS
 * FILE: shared/contracts/chat/semantic-similarity.ts
 * VERSION: 2026.03.21-sovereign.depth.v2
 * AUTHORSHIP: Antonio T. Smith Jr. — Density6 LLC
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared contract surface for deterministic semantic similarity,
 * novelty scoring, rhetorical form classification, anti-repetition guard
 * logic, explainability metadata, actor/channel/mode federation policy, and
 * training/export manifests used across:
 *
 *   - backend/src/game/engine/chat/intelligence/ChatSemanticSimilarityIndex.ts
 *   - pzo-web/src/engines/chat/intelligence (future frontend mirror)
 *   - pzo-server/src/chat (novelty guard at transport edge)
 *
 * Design doctrine
 * ---------------
 * 1. Shared contracts remain the single law surface for semantic similarity.
 * 2. This file is allowed to include deterministic helper utilities because the
 *    backend index already consumes shared clamp/resolve helpers and the goal
 *    is to prevent drift, not multiply local implementations.
 * 3. All helpers must remain side-effect free, synchronous, and deterministic.
 * 4. All novelty, fatigue, and explainability scores use explicit 01 suffixes
 *    when the value is normalized into the inclusive [0, 1] band.
 * 5. This contract intentionally models more than search. It models pressure,
 *    witness, rescue, negotiation, callback, federation, decay, and replay
 *    concerns so the backend index can remain high-depth without inventing its
 *    own shadow type system.
 * 6. Runtime engines may extend behavior, but they may not contradict the
 *    canonical law surfaces and constants defined here.
 *
 * Canonical authority roots
 * -------------------------
 * - /shared/contracts/chat
 * - /backend/src/game/engine/chat/intelligence
 * - /pzo-web/src/engines/chat/intelligence
 * ============================================================================
 */

import type {
  Brand,
  ChatChannelId,
  ChatNpcId,
  Score01,
  UnixMs,
} from './ChatChannels';

import {
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_VERSION,
} from './ChatChannels';

// ============================================================================
// MARK: Version and authority stamps
// ============================================================================

export const CHAT_SEMANTIC_SIMILARITY_CONTRACT_VERSION =
  '2026.03.21-sovereign.depth.v2' as const;

export const CHAT_SEMANTIC_SIMILARITY_PUBLIC_API_VERSION =
  '2.0.0' as const;

export const CHAT_SEMANTIC_SIMILARITY_CONTRACT_AUTHORITY = Object.freeze({
  owner: 'backend-intelligence',
  sourceContractRoot: '/shared/contracts/chat',
  contractVersion: CHAT_SEMANTIC_SIMILARITY_CONTRACT_VERSION,
  publicApiVersion: CHAT_SEMANTIC_SIMILARITY_PUBLIC_API_VERSION,
  sharedContractVersion: CHAT_CONTRACT_VERSION,
  authorities: CHAT_CONTRACT_AUTHORITIES,
  semanticContractPurpose:
    'Deterministic semantic similarity, novelty guard, explainability, training, and federation law.',
  canonicalBackendIndex:
    '/backend/src/game/engine/chat/intelligence/ChatSemanticSimilarityIndex.ts',
  canonicalFrontendMirror:
    '/pzo-web/src/engines/chat/intelligence',
  canonicalTransportConsumers:
    '/pzo-server/src/chat',
} as const);

// ============================================================================
// MARK: Branded identifiers
// ============================================================================

export type ChatSemanticDocumentId = Brand<string, 'ChatSemanticDocumentId'>;
export type ChatSemanticClusterId = Brand<string, 'ChatSemanticClusterId'>;
export type ChatSemanticQueryId = Brand<string, 'ChatSemanticQueryId'>;
export type ChatSemanticRequestId = Brand<string, 'ChatSemanticRequestId'>;
export type ChatSemanticIndexId = Brand<string, 'ChatSemanticIndexId'>;
export type ChatSemanticMotifId = Brand<string, 'ChatSemanticMotifId'>;
export type ChatSemanticCallbackSourceId =
  Brand<string, 'ChatSemanticCallbackSourceId'>;
export type ChatSemanticFederationKey =
  Brand<string, 'ChatSemanticFederationKey'>;
export type ChatSemanticRuleId = Brand<string, 'ChatSemanticRuleId'>;
export type ChatSemanticBatchId = Brand<string, 'ChatSemanticBatchId'>;
export type ChatSemanticHydrationId = Brand<string, 'ChatSemanticHydrationId'>;
export type ChatSemanticTelemetryId = Brand<string, 'ChatSemanticTelemetryId'>;
export type ChatSemanticManifestId = Brand<string, 'ChatSemanticManifestId'>;
export type ChatSemanticCueBankId = Brand<string, 'ChatSemanticCueBankId'>;
export type ChatSemanticPatternId = Brand<string, 'ChatSemanticPatternId'>;
export type ChatSemanticAuditId = Brand<string, 'ChatSemanticAuditId'>;
export type ChatSemanticNarrativeBeatId =
  Brand<string, 'ChatSemanticNarrativeBeatId'>;
export type ChatSemanticWindowId = Brand<string, 'ChatSemanticWindowId'>;
export type ChatSemanticLineageId = Brand<string, 'ChatSemanticLineageId'>;
export type ChatSemanticPolicyId = Brand<string, 'ChatSemanticPolicyId'>;
export type ChatSemanticTrainingRowId =
  Brand<string, 'ChatSemanticTrainingRowId'>;
export type ChatSemanticNeighborId = Brand<string, 'ChatSemanticNeighborId'>;
export type ChatSemanticRoleProfileId =
  Brand<string, 'ChatSemanticRoleProfileId'>;
export type ChatSemanticDictionaryTermId =
  Brand<string, 'ChatSemanticDictionaryTermId'>;
export type ChatSemanticExplainabilityId =
  Brand<string, 'ChatSemanticExplainabilityId'>;
export type ChatSemanticSnapshotVersion =
  Brand<string, 'ChatSemanticSnapshotVersion'>;
export type ChatSemanticRecoveryEnvelopeId =
  Brand<string, 'ChatSemanticRecoveryEnvelopeId'>;
export type ChatSemanticRoomScopeId =
  Brand<string, 'ChatSemanticRoomScopeId'>;
export type ChatSemanticChannelScopeId =
  Brand<string, 'ChatSemanticChannelScopeId'>;

// ============================================================================
// MARK: Primitive unions and supporting vocabularies
// ============================================================================

export const CHAT_SEMANTIC_BOOLEAN_WORDS = [
  'yes',
  'no',
  'true',
  'false',
  'never',
  'always',
  'none',
  'all',
] as const;

export const CHAT_SEMANTIC_DECISION_STANCES = [
  'ASSERTIVE',
  'PROBING',
  'CAUTIOUS',
  'HOSTILE',
  'STABILIZING',
  'WITNESSING',
  'SILENT',
  'SYSTEMIC',
  'AMBIGUOUS',
] as const;

export type ChatSemanticDecisionStance =
  (typeof CHAT_SEMANTIC_DECISION_STANCES)[number];

export const CHAT_SEMANTIC_TEXT_REGISTERS = [
  'CASUAL',
  'FORMAL',
  'BUREAUCRATIC',
  'PREDATORY',
  'MENTORIAL',
  'LEDGER',
  'SPECTATOR',
  'RITUAL',
  'SYSTEM',
  'UNKNOWN',
] as const;

export type ChatSemanticTextRegister =
  (typeof CHAT_SEMANTIC_TEXT_REGISTERS)[number];

export const CHAT_SEMANTIC_CADENCE_CLASSES = [
  'BURST',
  'MEASURED',
  'DELAYED',
  'CEREMONIAL',
  'CUTTING',
  'RECOVERY',
  'RUMOR',
  'SYSTEMIC',
] as const;

export type ChatSemanticCadenceClass =
  (typeof CHAT_SEMANTIC_CADENCE_CLASSES)[number];

export const CHAT_SEMANTIC_SOURCE_KINDS = [
  'AUTHORED_CANONICAL',
  'SYSTEM_GENERATED',
  'LIVEOPS_OVERLAY',
  'PLAYER_QUOTE',
  'CALLBACK_REWRITE',
  'RESCUE_INJECTION',
  'NEGOTIATION_LOG',
  'REPLAY_RECOVERY',
  'PROOF_CHAIN_ATTESTATION',
  'TRAINING_ECHO',
] as const;

export type ChatSemanticSourceKind =
  (typeof CHAT_SEMANTIC_SOURCE_KINDS)[number];

export const CHAT_SEMANTIC_ACTOR_CLASSES = [
  'HATER',
  'HELPER',
  'AMBIENT',
  'LIVEOPS',
  'SYSTEM',
  'PLAYER',
  'UNKNOWN',
] as const;

export type ChatSemanticActorClass =
  (typeof CHAT_SEMANTIC_ACTOR_CLASSES)[number];

export const CHAT_SEMANTIC_QUERY_STRATEGIES = [
  'NEAREST_NEIGHBOR',
  'NOVELTY_GUARD',
  'CALLBACK_SEARCH',
  'ACTOR_LOCAL',
  'CHANNEL_LOCAL',
  'ROOM_LOCAL',
  'CROSS_FEDERATION',
  'PROOF_AUDIT',
  'TRAINING_EXPORT',
] as const;

export type ChatSemanticQueryStrategy =
  (typeof CHAT_SEMANTIC_QUERY_STRATEGIES)[number];

export const CHAT_SEMANTIC_EXPLAINABILITY_SIGNALS = [
  'TOKEN_OVERLAP',
  'BIGRAM_OVERLAP',
  'CHARGRAM_OVERLAP',
  'RHETORICAL_MATCH',
  'CLUSTER_COLLISION',
  'CALLBACK_CONTINUITY',
  'CHANNEL_ZONE_ALIGNMENT',
  'MODE_POLICY_ALIGNMENT',
  'PRESSURE_ALIGNMENT',
  'ACTOR_CLASS_ALIGNMENT',
  'RECENCY_DECAY',
  'EXACT_TEXT_HIT',
  'PUNCTUATION_SHAPE',
  'NEGOTIATION_SIGNAL',
  'WITNESS_SIGNAL',
  'RESCUE_SIGNAL',
] as const;

export type ChatSemanticExplainabilitySignal =
  (typeof CHAT_SEMANTIC_EXPLAINABILITY_SIGNALS)[number];

// ============================================================================
// MARK: Rhetorical form taxonomy
// ============================================================================

/**
 * ChatSemanticRhetoricalForm
 *
 * The rhetorical form classifies the structural and dramatic shape of a
 * dialogue line — not the topic, but the mode of speech act. Every form maps
 * to specific NPC archetypes and emotional functions in the PZO chat system.
 *
 * These forms are the semantic fingerprint that prevents the same emotional
 * move from firing twice in a row, regardless of surface-level word variation.
 */
export const CHAT_SEMANTIC_RHETORICAL_FORMS = [
  'THREAT_DECLARATIVE',
  'REPRICING_DECLARATIVE',
  'PROCEDURAL_DELAY',
  'PREDICTIVE_PROFILE',
  'SYSTEMIC_INEVITABILITY',
  'STRUCTURAL_ASYMMETRY',
  'SURVEILLANCE_SIGNAL',
  'EXTRACTION_NOTICE',
  'BLUFF_EXPOSURE',
  'CALLBACK_WOUND',
  'WITNESS_JUDGMENT',
  'HUMILIATION_RECEIPT',
  'RIVALRY_PRESSURE',
  'RESCUE_STABILIZER',
  'TACTICAL_REDIRECT',
  'SURVIVOR_TESTIMONY',
  'INSIDER_SIGNAL',
  'ARCHIVIST_RECORD',
  'MENTOR_ANCHOR',
  'RIVAL_DARE',
  'CROWD_REACTION',
  'DEAL_ROOM_LOG',
  'LOBBY_RUMOR',
  'MARKET_WITNESS_NOTE',
  'SILENCE_MARKER',
  'SYSTEM_NOTICE',
  'PROOF_STAMP',
  'LIVEOPS_SIGNAL',
  'LEVERAGE_CLAIM',
  'OFFER_FRAME',
  'COUNTER_PROBE',
  'BLUFF_DEPLOY',
  'SILENCE_WEAPON',
  'UNKNOWN',
] as const;

export type ChatSemanticRhetoricalForm =
  (typeof CHAT_SEMANTIC_RHETORICAL_FORMS)[number];

export const CHAT_SEMANTIC_RHETORICAL_FAMILIES = [
  'HOSTILITY',
  'WEIGHT',
  'HELPER',
  'AMBIENT',
  'SYSTEM',
  'NEGOTIATION',
  'FALLBACK',
] as const;

export type ChatSemanticRhetoricalFamily =
  (typeof CHAT_SEMANTIC_RHETORICAL_FAMILIES)[number];

export interface ChatSemanticRhetoricalDescriptor {
  readonly form: ChatSemanticRhetoricalForm;
  readonly family: ChatSemanticRhetoricalFamily;
  readonly defaultActorClass: ChatSemanticActorClass;
  readonly summary: string;
  readonly threatBias01: Score01;
  readonly repetitionSensitivity01: Score01;
  readonly preferredChannels: readonly ChatChannelId[];
  readonly lexemeCues: readonly string[];
  readonly defaultRegister: ChatSemanticTextRegister;
  readonly defaultCadence: ChatSemanticCadenceClass;
  readonly allowsCallbackPrivilege: boolean;
  readonly favorsShortLines: boolean;
  readonly witnessWeighted: boolean;
  readonly negotiationWeighted: boolean;
}

export const CHAT_SEMANTIC_RHETORICAL_DESCRIPTORS: Readonly<
  Record<ChatSemanticRhetoricalForm, ChatSemanticRhetoricalDescriptor>
> = Object.freeze({
  THREAT_DECLARATIVE: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'THREAT_DECLARATIVE',
    family: 'HOSTILITY',
    defaultActorClass: 'HATER',
    summary: 'High-certainty threat or domination move.',
    threatBias01: 0.94 as Score01,
    repetitionSensitivity01: 0.16 as Score01,
    preferredChannels: Object.freeze(['GLOBAL', 'DEAL_ROOM']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['threat', 'pass', 'finish', 'end', 'bury', 'break']),
    defaultRegister: 'PREDATORY',
    defaultCadence: 'CUTTING',
    allowsCallbackPrivilege: false,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: false,
  }),
  REPRICING_DECLARATIVE: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'REPRICING_DECLARATIVE',
    family: 'HOSTILITY',
    defaultActorClass: 'HATER',
    summary: 'Frames the player as distressed inventory or collapsing value.',
    threatBias01: 0.91 as Score01,
    repetitionSensitivity01: 0.14 as Score01,
    preferredChannels: Object.freeze(['GLOBAL', 'DEAL_ROOM']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['distressed', 'repriced', 'discount', 'value', 'liquidate', 'margin']),
    defaultRegister: 'PREDATORY',
    defaultCadence: 'CUTTING',
    allowsCallbackPrivilege: false,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: false,
  }),
  PROCEDURAL_DELAY: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'PROCEDURAL_DELAY',
    family: 'HOSTILITY',
    defaultActorClass: 'HATER',
    summary: 'Weaponizes bureaucracy, review, waiting, or file friction.',
    threatBias01: 0.72 as Score01,
    repetitionSensitivity01: 0.11 as Score01,
    preferredChannels: Object.freeze(['GLOBAL', 'SYNDICATE']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['review', 'pending', 'file', 'queue', 'processing', 'delayed']),
    defaultRegister: 'PREDATORY',
    defaultCadence: 'CUTTING',
    allowsCallbackPrivilege: false,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: false,
  }),
  PREDICTIVE_PROFILE: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'PREDICTIVE_PROFILE',
    family: 'HOSTILITY',
    defaultActorClass: 'HATER',
    summary: "Claims foreknowledge of the player's next move or collapse path.",
    threatBias01: 0.82 as Score01,
    repetitionSensitivity01: 0.12 as Score01,
    preferredChannels: Object.freeze(['GLOBAL', 'DEAL_ROOM']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['predict', 'modeled', 'already know', 'next move', 'profile', 'forecast']),
    defaultRegister: 'PREDATORY',
    defaultCadence: 'CUTTING',
    allowsCallbackPrivilege: false,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: false,
  }),
  SYSTEMIC_INEVITABILITY: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'SYSTEMIC_INEVITABILITY',
    family: 'HOSTILITY',
    defaultActorClass: 'HATER',
    summary: 'Macro-inevitability framing; the system always corrects.',
    threatBias01: 0.85 as Score01,
    repetitionSensitivity01: 0.12 as Score01,
    preferredChannels: Object.freeze(['GLOBAL', 'LOBBY']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['cycle', 'always', 'inevitable', 'corrects', 'gravity', 'system']),
    defaultRegister: 'PREDATORY',
    defaultCadence: 'CUTTING',
    allowsCallbackPrivilege: false,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: false,
  }),
  STRUCTURAL_ASYMMETRY: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'STRUCTURAL_ASYMMETRY',
    family: 'HOSTILITY',
    defaultActorClass: 'HATER',
    summary: 'Claims inherited or structural advantage over the player.',
    threatBias01: 0.78 as Score01,
    repetitionSensitivity01: 0.11 as Score01,
    preferredChannels: Object.freeze(['GLOBAL', 'SYNDICATE']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['born with', 'inherit', 'structural', 'class', 'legacy', 'advantage']),
    defaultRegister: 'PREDATORY',
    defaultCadence: 'CUTTING',
    allowsCallbackPrivilege: false,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: false,
  }),
  SURVEILLANCE_SIGNAL: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'SURVEILLANCE_SIGNAL',
    family: 'HOSTILITY',
    defaultActorClass: 'HATER',
    summary: 'Indicates the actor is watching, tracking, or observing.',
    threatBias01: 0.69 as Score01,
    repetitionSensitivity01: 0.09 as Score01,
    preferredChannels: Object.freeze(['GLOBAL', 'LOBBY']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['noticed', 'watching', 'saw that', 'recorded', 'tracking', 'observed']),
    defaultRegister: 'PREDATORY',
    defaultCadence: 'CUTTING',
    allowsCallbackPrivilege: false,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: false,
  }),
  EXTRACTION_NOTICE: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'EXTRACTION_NOTICE',
    family: 'HOSTILITY',
    defaultActorClass: 'HATER',
    summary: 'Announces that value will be extracted or redirected.',
    threatBias01: 0.83 as Score01,
    repetitionSensitivity01: 0.13 as Score01,
    preferredChannels: Object.freeze(['DEAL_ROOM', 'GLOBAL']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['redirecting', 'extract', 'take', 'skim', 'collect', 'drain']),
    defaultRegister: 'PREDATORY',
    defaultCadence: 'CUTTING',
    allowsCallbackPrivilege: false,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: true,
  }),
  BLUFF_EXPOSURE: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'BLUFF_EXPOSURE',
    family: 'HOSTILITY',
    defaultActorClass: 'HATER',
    summary: 'Calls a bluff, false frame, or transparent trick.',
    threatBias01: 0.88 as Score01,
    repetitionSensitivity01: 0.15 as Score01,
    preferredChannels: Object.freeze(['DEAL_ROOM', 'GLOBAL']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['bluff', 'card', 'not working', 'transparent', 'fake', 'cap']),
    defaultRegister: 'PREDATORY',
    defaultCadence: 'CUTTING',
    allowsCallbackPrivilege: true,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: true,
  }),
  CALLBACK_WOUND: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'CALLBACK_WOUND',
    family: 'WEIGHT',
    defaultActorClass: 'HATER',
    summary: 'Uses memory or prior failure as an emotional weapon.',
    threatBias01: 0.81 as Score01,
    repetitionSensitivity01: 0.17 as Score01,
    preferredChannels: Object.freeze(['GLOBAL', 'SYNDICATE']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['remember', 'last time', 'again', 'still', 'that hesitation', 'receipt']),
    defaultRegister: 'PREDATORY',
    defaultCadence: 'MEASURED',
    allowsCallbackPrivilege: true,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: false,
  }),
  WITNESS_JUDGMENT: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'WITNESS_JUDGMENT',
    family: 'WEIGHT',
    defaultActorClass: 'AMBIENT',
    summary: 'Public room judgment with spectator framing.',
    threatBias01: 0.74 as Score01,
    repetitionSensitivity01: 0.15 as Score01,
    preferredChannels: Object.freeze(['GLOBAL', 'LOBBY']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['the room', 'everyone saw', 'witness', 'saw that', 'all of us', 'public']),
    defaultRegister: 'SPECTATOR',
    defaultCadence: 'MEASURED',
    allowsCallbackPrivilege: true,
    favorsShortLines: false,
    witnessWeighted: true,
    negotiationWeighted: false,
  }),
  HUMILIATION_RECEIPT: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'HUMILIATION_RECEIPT',
    family: 'WEIGHT',
    defaultActorClass: 'AMBIENT',
    summary: 'Transforms a failure into a future receipt.',
    threatBias01: 0.84 as Score01,
    repetitionSensitivity01: 0.19 as Score01,
    preferredChannels: Object.freeze(['GLOBAL', 'LOBBY']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['receipt', 'remembered', 'archived', 'saved that', 'clipped', 'bookmark']),
    defaultRegister: 'SPECTATOR',
    defaultCadence: 'MEASURED',
    allowsCallbackPrivilege: true,
    favorsShortLines: false,
    witnessWeighted: true,
    negotiationWeighted: false,
  }),
  RIVALRY_PRESSURE: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'RIVALRY_PRESSURE',
    family: 'WEIGHT',
    defaultActorClass: 'HATER',
    summary: 'Competitive heat, gap widening, or keep-up pressure.',
    threatBias01: 0.77 as Score01,
    repetitionSensitivity01: 0.12 as Score01,
    preferredChannels: Object.freeze(['GLOBAL', 'SYNDICATE']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['ahead', 'catch up', 'gap', 'stay ahead', 'distance', 'tempo']),
    defaultRegister: 'PREDATORY',
    defaultCadence: 'MEASURED',
    allowsCallbackPrivilege: true,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: false,
  }),
  RESCUE_STABILIZER: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'RESCUE_STABILIZER',
    family: 'HELPER',
    defaultActorClass: 'HELPER',
    summary: 'Stabilizing helper line that slows panic and narrows choice.',
    threatBias01: 0.28 as Score01,
    repetitionSensitivity01: 0.04 as Score01,
    preferredChannels: Object.freeze(['SYNDICATE', 'GLOBAL']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['breathe', 'one move', 'steady', 'reset', 'focus', 'right now']),
    defaultRegister: 'MENTORIAL',
    defaultCadence: 'RECOVERY',
    allowsCallbackPrivilege: true,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: false,
  }),
  TACTICAL_REDIRECT: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'TACTICAL_REDIRECT',
    family: 'HELPER',
    defaultActorClass: 'HELPER',
    summary: 'Reorients toward a more tactical line of play.',
    threatBias01: 0.31 as Score01,
    repetitionSensitivity01: 0.05 as Score01,
    preferredChannels: Object.freeze(['SYNDICATE', 'DEAL_ROOM']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['instead', 'pivot', 'cut', 'reroute', 'redirect', 'trade this']),
    defaultRegister: 'MENTORIAL',
    defaultCadence: 'RECOVERY',
    allowsCallbackPrivilege: true,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: false,
  }),
  SURVIVOR_TESTIMONY: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'SURVIVOR_TESTIMONY',
    family: 'HELPER',
    defaultActorClass: 'HELPER',
    summary: 'Personal survival story as proof of possibility.',
    threatBias01: 0.33 as Score01,
    repetitionSensitivity01: 0.06 as Score01,
    preferredChannels: Object.freeze(['SYNDICATE', 'GLOBAL']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(["i've been", 'i was there', 'same place', 'survived', 'came back', 'made it out']),
    defaultRegister: 'MENTORIAL',
    defaultCadence: 'RECOVERY',
    allowsCallbackPrivilege: true,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: false,
  }),
  INSIDER_SIGNAL: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'INSIDER_SIGNAL',
    family: 'HELPER',
    defaultActorClass: 'HELPER',
    summary: 'Reveals hidden mechanic, asymmetry, or timing edge.',
    threatBias01: 0.36 as Score01,
    repetitionSensitivity01: 0.05 as Score01,
    preferredChannels: Object.freeze(['SYNDICATE', 'DEAL_ROOM']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['hidden', 'synergy', 'window', 'tech', 'edge', 'interaction']),
    defaultRegister: 'MENTORIAL',
    defaultCadence: 'RECOVERY',
    allowsCallbackPrivilege: true,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: false,
  }),
  ARCHIVIST_RECORD: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'ARCHIVIST_RECORD',
    family: 'HELPER',
    defaultActorClass: 'HELPER',
    summary: 'Cites data, archive, or precedent to ground a line.',
    threatBias01: 0.27 as Score01,
    repetitionSensitivity01: 0.04 as Score01,
    preferredChannels: Object.freeze(['SYNDICATE', 'GLOBAL']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['historically', 'archive', 'record', 'precedent', 'dataset', 'logged']),
    defaultRegister: 'MENTORIAL',
    defaultCadence: 'RECOVERY',
    allowsCallbackPrivilege: true,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: false,
  }),
  MENTOR_ANCHOR: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'MENTOR_ANCHOR',
    family: 'HELPER',
    defaultActorClass: 'HELPER',
    summary: 'Returns attention to fundamentals and longer horizon.',
    threatBias01: 0.24 as Score01,
    repetitionSensitivity01: 0.04 as Score01,
    preferredChannels: Object.freeze(['SYNDICATE', 'GLOBAL']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['fundamentals', 'anchor', 'base', 'principles', 'discipline', 'ground']),
    defaultRegister: 'MENTORIAL',
    defaultCadence: 'RECOVERY',
    allowsCallbackPrivilege: true,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: false,
  }),
  RIVAL_DARE: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'RIVAL_DARE',
    family: 'HELPER',
    defaultActorClass: 'HELPER',
    summary: 'Constructive competitive challenge from a rival/helper.',
    threatBias01: 0.48 as Score01,
    repetitionSensitivity01: 0.07 as Score01,
    preferredChannels: Object.freeze(['GLOBAL', 'SYNDICATE']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['beat me', 'top this', '30 ticks ago', 'dare', 'can you', 'prove it']),
    defaultRegister: 'MENTORIAL',
    defaultCadence: 'RECOVERY',
    allowsCallbackPrivilege: true,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: false,
  }),
  CROWD_REACTION: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'CROWD_REACTION',
    family: 'AMBIENT',
    defaultActorClass: 'AMBIENT',
    summary: 'Ambient crowd texture or floor reaction.',
    threatBias01: 0.54 as Score01,
    repetitionSensitivity01: 0.10 as Score01,
    preferredChannels: Object.freeze(['GLOBAL', 'LOBBY']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['floor', 'crowd', 'chat moving', "they're reacting", 'buzz', 'noise']),
    defaultRegister: 'SPECTATOR',
    defaultCadence: 'MEASURED',
    allowsCallbackPrivilege: false,
    favorsShortLines: false,
    witnessWeighted: true,
    negotiationWeighted: false,
  }),
  DEAL_ROOM_LOG: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'DEAL_ROOM_LOG',
    family: 'AMBIENT',
    defaultActorClass: 'SYSTEM',
    summary: 'Ledger-like acknowledgement in negotiation space.',
    threatBias01: 0.41 as Score01,
    repetitionSensitivity01: 0.05 as Score01,
    preferredChannels: Object.freeze(['DEAL_ROOM']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['logged', 'counter pending', 'offer', 'recorded', 'filed', 'booked']),
    defaultRegister: 'LEDGER',
    defaultCadence: 'MEASURED',
    allowsCallbackPrivilege: false,
    favorsShortLines: true,
    witnessWeighted: false,
    negotiationWeighted: true,
  }),
  LOBBY_RUMOR: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'LOBBY_RUMOR',
    family: 'AMBIENT',
    defaultActorClass: 'AMBIENT',
    summary: 'Speculative rumor, hearsay, or lobby whisper.',
    threatBias01: 0.46 as Score01,
    repetitionSensitivity01: 0.09 as Score01,
    preferredChannels: Object.freeze(['LOBBY', 'GLOBAL']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['heard', 'someone said', 'rumor', 'word is', 'apparently', 'they say']),
    defaultRegister: 'SPECTATOR',
    defaultCadence: 'BURST',
    allowsCallbackPrivilege: false,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: false,
  }),
  MARKET_WITNESS_NOTE: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'MARKET_WITNESS_NOTE',
    family: 'AMBIENT',
    defaultActorClass: 'AMBIENT',
    summary: 'Detached public record of what just happened.',
    threatBias01: 0.51 as Score01,
    repetitionSensitivity01: 0.08 as Score01,
    preferredChannels: Object.freeze(['GLOBAL', 'DEAL_ROOM']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['marked', 'noted', 'for the archive', 'witness note', 'logged', 'public record']),
    defaultRegister: 'SPECTATOR',
    defaultCadence: 'MEASURED',
    allowsCallbackPrivilege: false,
    favorsShortLines: false,
    witnessWeighted: true,
    negotiationWeighted: false,
  }),
  SILENCE_MARKER: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'SILENCE_MARKER',
    family: 'SYSTEM',
    defaultActorClass: 'SYSTEM',
    summary: 'A small intentional pause, punctuation, or breath marker.',
    threatBias01: 0.18 as Score01,
    repetitionSensitivity01: 0.02 as Score01,
    preferredChannels: Object.freeze(['GLOBAL', 'DEAL_ROOM']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['...', '—', 'hmm', 'wait', '.', '!']),
    defaultRegister: 'SYSTEM',
    defaultCadence: 'CEREMONIAL',
    allowsCallbackPrivilege: false,
    favorsShortLines: true,
    witnessWeighted: false,
    negotiationWeighted: false,
  }),
  SYSTEM_NOTICE: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'SYSTEM_NOTICE',
    family: 'SYSTEM',
    defaultActorClass: 'SYSTEM',
    summary: 'System-authored engine notice or state declaration.',
    threatBias01: 0.22 as Score01,
    repetitionSensitivity01: 0.02 as Score01,
    preferredChannels: Object.freeze(['GLOBAL', 'SYSTEM_SHADOW']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['registered', 'detected', 'engine', 'system', 'notice', 'warning']),
    defaultRegister: 'SYSTEM',
    defaultCadence: 'CEREMONIAL',
    allowsCallbackPrivilege: false,
    favorsShortLines: true,
    witnessWeighted: false,
    negotiationWeighted: false,
  }),
  PROOF_STAMP: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'PROOF_STAMP',
    family: 'SYSTEM',
    defaultActorClass: 'SYSTEM',
    summary: 'Proof-bearing, verification-flavored declaration.',
    threatBias01: 0.29 as Score01,
    repetitionSensitivity01: 0.03 as Score01,
    preferredChannels: Object.freeze(['GLOBAL', 'SYSTEM_SHADOW']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['verified', 'hash', 'proof', 'sealed', 'attested', 'proof']),
    defaultRegister: 'SYSTEM',
    defaultCadence: 'CEREMONIAL',
    allowsCallbackPrivilege: false,
    favorsShortLines: true,
    witnessWeighted: true,
    negotiationWeighted: false,
  }),
  LIVEOPS_SIGNAL: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'LIVEOPS_SIGNAL',
    family: 'SYSTEM',
    defaultActorClass: 'LIVEOPS',
    summary: 'Live operations overlay or seasonal activation line.',
    threatBias01: 0.26 as Score01,
    repetitionSensitivity01: 0.03 as Score01,
    preferredChannels: Object.freeze(['GLOBAL', 'LIVEOPS_SHADOW']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['season', 'event active', 'liveops', 'overlay', 'challenge', 'boost']),
    defaultRegister: 'SYSTEM',
    defaultCadence: 'CEREMONIAL',
    allowsCallbackPrivilege: false,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: false,
  }),
  LEVERAGE_CLAIM: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'LEVERAGE_CLAIM',
    family: 'NEGOTIATION',
    defaultActorClass: 'HATER',
    summary: 'Negotiation position claim or power assertion.',
    threatBias01: 0.71 as Score01,
    repetitionSensitivity01: 0.11 as Score01,
    preferredChannels: Object.freeze(['DEAL_ROOM']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['need', 'have what you need', 'leverage', 'position', 'terms', 'control']),
    defaultRegister: 'PREDATORY',
    defaultCadence: 'DELAYED',
    allowsCallbackPrivilege: false,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: true,
  }),
  OFFER_FRAME: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'OFFER_FRAME',
    family: 'NEGOTIATION',
    defaultActorClass: 'HATER',
    summary: 'Structures the shape and boundaries of an offer.',
    threatBias01: 0.62 as Score01,
    repetitionSensitivity01: 0.08 as Score01,
    preferredChannels: Object.freeze(['DEAL_ROOM']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(["here's what", 'proposal', 'offer', 'terms', 'deal', 'package']),
    defaultRegister: 'PREDATORY',
    defaultCadence: 'DELAYED',
    allowsCallbackPrivilege: false,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: true,
  }),
  COUNTER_PROBE: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'COUNTER_PROBE',
    family: 'NEGOTIATION',
    defaultActorClass: 'HATER',
    summary: 'Tests for intent, weakness, or hidden reservation point.',
    threatBias01: 0.67 as Score01,
    repetitionSensitivity01: 0.10 as Score01,
    preferredChannels: Object.freeze(['DEAL_ROOM']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['real number', 'hesitated', "what's the number", 'counter', 'probe', 'where are you']),
    defaultRegister: 'PREDATORY',
    defaultCadence: 'DELAYED',
    allowsCallbackPrivilege: true,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: true,
  }),
  BLUFF_DEPLOY: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'BLUFF_DEPLOY',
    family: 'NEGOTIATION',
    defaultActorClass: 'HATER',
    summary: 'Deploys a bluff signal inside a negotiation chamber.',
    threatBias01: 0.76 as Score01,
    repetitionSensitivity01: 0.14 as Score01,
    preferredChannels: Object.freeze(['DEAL_ROOM']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['already talking', 'another party', 'elsewhere', 'other offers', 'walk away', 'backup']),
    defaultRegister: 'PREDATORY',
    defaultCadence: 'DELAYED',
    allowsCallbackPrivilege: false,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: true,
  }),
  SILENCE_WEAPON: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'SILENCE_WEAPON',
    family: 'NEGOTIATION',
    defaultActorClass: 'HATER',
    summary: 'Uses silence as a strategic pressure instrument.',
    threatBias01: 0.58 as Score01,
    repetitionSensitivity01: 0.12 as Score01,
    preferredChannels: Object.freeze(['DEAL_ROOM']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze(['...', 'seen', 'waiting', 'no response', 'left you there', 'silence']),
    defaultRegister: 'PREDATORY',
    defaultCadence: 'DELAYED',
    allowsCallbackPrivilege: false,
    favorsShortLines: true,
    witnessWeighted: false,
    negotiationWeighted: true,
  }),
  UNKNOWN: Object.freeze<ChatSemanticRhetoricalDescriptor>({
    form: 'UNKNOWN',
    family: 'FALLBACK',
    defaultActorClass: 'UNKNOWN',
    summary: 'Fallback rhetorical class when no stronger law applies.',
    threatBias01: 0.50 as Score01,
    repetitionSensitivity01: 0.01 as Score01,
    preferredChannels: Object.freeze(['GLOBAL']) as readonly ChatChannelId[],
    lexemeCues: Object.freeze([]),
    defaultRegister: 'UNKNOWN',
    defaultCadence: 'MEASURED',
    allowsCallbackPrivilege: false,
    favorsShortLines: false,
    witnessWeighted: false,
    negotiationWeighted: false,
  }),
});

export const CHAT_SEMANTIC_RHETORICAL_FORM_ORDER = Object.freeze(
  CHAT_SEMANTIC_RHETORICAL_FORMS.map((form, index) =>
    Object.freeze({
      form,
      ordinal: index,
      family: CHAT_SEMANTIC_RHETORICAL_DESCRIPTORS[form].family,
    }),
  ),
);

export interface ChatSemanticCuePattern {
  readonly patternId: ChatSemanticPatternId;
  readonly rhetoricalForm: ChatSemanticRhetoricalForm;
  readonly label: string;
  readonly literalCues: readonly string[];
  readonly prefersLineStart: boolean;
  readonly prefersQuestionShape: boolean;
  readonly requiresWitnessContext: boolean;
  readonly requiresNegotiationContext: boolean;
  readonly scoreBoost01: Score01;
}

export const CHAT_SEMANTIC_CUE_PATTERNS: readonly ChatSemanticCuePattern[] =
  Object.freeze([
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-001' as ChatSemanticPatternId,
      rhetoricalForm: 'THREAT_DECLARATIVE',
      label: 'threat-declarative',
      literalCues: Object.freeze(['threat', 'pass', 'finish', 'end', 'bury', 'break']),
      prefersLineStart: true,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: false,
      scoreBoost01: 0.66 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-002' as ChatSemanticPatternId,
      rhetoricalForm: 'REPRICING_DECLARATIVE',
      label: 'repricing-declarative',
      literalCues: Object.freeze(['distressed', 'repriced', 'discount', 'value', 'liquidate', 'margin']),
      prefersLineStart: true,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: false,
      scoreBoost01: 0.64 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-003' as ChatSemanticPatternId,
      rhetoricalForm: 'PROCEDURAL_DELAY',
      label: 'procedural-delay',
      literalCues: Object.freeze(['review', 'pending', 'file', 'queue', 'processing', 'delayed']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: false,
      scoreBoost01: 0.61 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-004' as ChatSemanticPatternId,
      rhetoricalForm: 'PREDICTIVE_PROFILE',
      label: 'predictive-profile',
      literalCues: Object.freeze(['predict', 'modeled', 'already know', 'next move', 'profile', 'forecast']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: false,
      scoreBoost01: 0.62 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-005' as ChatSemanticPatternId,
      rhetoricalForm: 'SYSTEMIC_INEVITABILITY',
      label: 'systemic-inevitability',
      literalCues: Object.freeze(['cycle', 'always', 'inevitable', 'corrects', 'gravity', 'system']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: false,
      scoreBoost01: 0.62 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-006' as ChatSemanticPatternId,
      rhetoricalForm: 'STRUCTURAL_ASYMMETRY',
      label: 'structural-asymmetry',
      literalCues: Object.freeze(['born with', 'inherit', 'structural', 'class', 'legacy', 'advantage']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: false,
      scoreBoost01: 0.61 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-007' as ChatSemanticPatternId,
      rhetoricalForm: 'SURVEILLANCE_SIGNAL',
      label: 'surveillance-signal',
      literalCues: Object.freeze(['noticed', 'watching', 'saw that', 'recorded', 'tracking', 'observed']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: false,
      scoreBoost01: 0.59 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-008' as ChatSemanticPatternId,
      rhetoricalForm: 'EXTRACTION_NOTICE',
      label: 'extraction-notice',
      literalCues: Object.freeze(['redirecting', 'extract', 'take', 'skim', 'collect', 'drain']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: false,
      scoreBoost01: 0.63 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-009' as ChatSemanticPatternId,
      rhetoricalForm: 'BLUFF_EXPOSURE',
      label: 'bluff-exposure',
      literalCues: Object.freeze(['bluff', 'card', 'not working', 'transparent', 'fake', 'cap']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: true,
      scoreBoost01: 0.65 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-010' as ChatSemanticPatternId,
      rhetoricalForm: 'CALLBACK_WOUND',
      label: 'callback-wound',
      literalCues: Object.freeze(['remember', 'last time', 'again', 'still', 'that hesitation', 'receipt']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: false,
      scoreBoost01: 0.67 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-011' as ChatSemanticPatternId,
      rhetoricalForm: 'WITNESS_JUDGMENT',
      label: 'witness-judgment',
      literalCues: Object.freeze(['the room', 'everyone saw', 'witness', 'saw that', 'all of us', 'public']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: true,
      requiresNegotiationContext: false,
      scoreBoost01: 0.65 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-012' as ChatSemanticPatternId,
      rhetoricalForm: 'HUMILIATION_RECEIPT',
      label: 'humiliation-receipt',
      literalCues: Object.freeze(['receipt', 'remembered', 'archived', 'saved that', 'clipped', 'bookmark']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: true,
      requiresNegotiationContext: false,
      scoreBoost01: 0.69 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-013' as ChatSemanticPatternId,
      rhetoricalForm: 'RIVALRY_PRESSURE',
      label: 'rivalry-pressure',
      literalCues: Object.freeze(['ahead', 'catch up', 'gap', 'stay ahead', 'distance', 'tempo']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: false,
      scoreBoost01: 0.62 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-014' as ChatSemanticPatternId,
      rhetoricalForm: 'RESCUE_STABILIZER',
      label: 'rescue-stabilizer',
      literalCues: Object.freeze(['breathe', 'one move', 'steady', 'reset', 'focus', 'right now']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: false,
      scoreBoost01: 0.54 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-015' as ChatSemanticPatternId,
      rhetoricalForm: 'TACTICAL_REDIRECT',
      label: 'tactical-redirect',
      literalCues: Object.freeze(['instead', 'pivot', 'cut', 'reroute', 'redirect', 'trade this']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: false,
      scoreBoost01: 0.55 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-016' as ChatSemanticPatternId,
      rhetoricalForm: 'SURVIVOR_TESTIMONY',
      label: 'survivor-testimony',
      literalCues: Object.freeze(["i've been", 'i was there', 'same place', 'survived', 'came back', 'made it out']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: false,
      scoreBoost01: 0.56 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-017' as ChatSemanticPatternId,
      rhetoricalForm: 'INSIDER_SIGNAL',
      label: 'insider-signal',
      literalCues: Object.freeze(['hidden', 'synergy', 'window', 'tech', 'edge', 'interaction']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: false,
      scoreBoost01: 0.55 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-018' as ChatSemanticPatternId,
      rhetoricalForm: 'ARCHIVIST_RECORD',
      label: 'archivist-record',
      literalCues: Object.freeze(['historically', 'archive', 'record', 'precedent', 'dataset', 'logged']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: false,
      scoreBoost01: 0.54 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-019' as ChatSemanticPatternId,
      rhetoricalForm: 'MENTOR_ANCHOR',
      label: 'mentor-anchor',
      literalCues: Object.freeze(['fundamentals', 'anchor', 'base', 'principles', 'discipline', 'ground']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: false,
      scoreBoost01: 0.54 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-020' as ChatSemanticPatternId,
      rhetoricalForm: 'RIVAL_DARE',
      label: 'rival-dare',
      literalCues: Object.freeze(['beat me', 'top this', '30 ticks ago', 'dare', 'can you', 'prove it']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: false,
      scoreBoost01: 0.57 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-021' as ChatSemanticPatternId,
      rhetoricalForm: 'CROWD_REACTION',
      label: 'crowd-reaction',
      literalCues: Object.freeze(['floor', 'crowd', 'chat moving', "they're reacting", 'buzz', 'noise']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: true,
      requiresNegotiationContext: false,
      scoreBoost01: 0.60 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-022' as ChatSemanticPatternId,
      rhetoricalForm: 'DEAL_ROOM_LOG',
      label: 'deal-room-log',
      literalCues: Object.freeze(['logged', 'counter pending', 'offer', 'recorded', 'filed', 'booked']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: true,
      scoreBoost01: 0.55 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-023' as ChatSemanticPatternId,
      rhetoricalForm: 'LOBBY_RUMOR',
      label: 'lobby-rumor',
      literalCues: Object.freeze(['heard', 'someone said', 'rumor', 'word is', 'apparently', 'they say']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: false,
      scoreBoost01: 0.59 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-024' as ChatSemanticPatternId,
      rhetoricalForm: 'MARKET_WITNESS_NOTE',
      label: 'market-witness-note',
      literalCues: Object.freeze(['marked', 'noted', 'for the archive', 'witness note', 'logged', 'public record']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: true,
      requiresNegotiationContext: false,
      scoreBoost01: 0.58 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-025' as ChatSemanticPatternId,
      rhetoricalForm: 'SILENCE_MARKER',
      label: 'silence-marker',
      literalCues: Object.freeze(['...', '—', 'hmm', 'wait', '.', '!']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: false,
      scoreBoost01: 0.52 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-026' as ChatSemanticPatternId,
      rhetoricalForm: 'SYSTEM_NOTICE',
      label: 'system-notice',
      literalCues: Object.freeze(['registered', 'detected', 'engine', 'system', 'notice', 'warning']),
      prefersLineStart: true,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: false,
      scoreBoost01: 0.52 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-027' as ChatSemanticPatternId,
      rhetoricalForm: 'PROOF_STAMP',
      label: 'proof-stamp',
      literalCues: Object.freeze(['verified', 'hash', 'proof', 'sealed', 'attested', 'proof']),
      prefersLineStart: true,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: false,
      scoreBoost01: 0.53 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-028' as ChatSemanticPatternId,
      rhetoricalForm: 'LIVEOPS_SIGNAL',
      label: 'liveops-signal',
      literalCues: Object.freeze(['season', 'event active', 'liveops', 'overlay', 'challenge', 'boost']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: false,
      scoreBoost01: 0.53 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-029' as ChatSemanticPatternId,
      rhetoricalForm: 'LEVERAGE_CLAIM',
      label: 'leverage-claim',
      literalCues: Object.freeze(['need', 'have what you need', 'leverage', 'position', 'terms', 'control']),
      prefersLineStart: true,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: true,
      scoreBoost01: 0.61 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-030' as ChatSemanticPatternId,
      rhetoricalForm: 'OFFER_FRAME',
      label: 'offer-frame',
      literalCues: Object.freeze(["here's what", 'proposal', 'offer', 'terms', 'deal', 'package']),
      prefersLineStart: true,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: true,
      scoreBoost01: 0.58 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-031' as ChatSemanticPatternId,
      rhetoricalForm: 'COUNTER_PROBE',
      label: 'counter-probe',
      literalCues: Object.freeze(['real number', 'hesitated', "what's the number", 'counter', 'probe', 'where are you']),
      prefersLineStart: false,
      prefersQuestionShape: true,
      requiresWitnessContext: false,
      requiresNegotiationContext: true,
      scoreBoost01: 0.60 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-032' as ChatSemanticPatternId,
      rhetoricalForm: 'BLUFF_DEPLOY',
      label: 'bluff-deploy',
      literalCues: Object.freeze(['already talking', 'another party', 'elsewhere', 'other offers', 'walk away', 'backup']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: true,
      scoreBoost01: 0.64 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-033' as ChatSemanticPatternId,
      rhetoricalForm: 'SILENCE_WEAPON',
      label: 'silence-weapon',
      literalCues: Object.freeze(['...', 'seen', 'waiting', 'no response', 'left you there', 'silence']),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: true,
      scoreBoost01: 0.62 as Score01,
    }),
    Object.freeze<ChatSemanticCuePattern>({
      patternId: 'chat-semantic-pattern-034' as ChatSemanticPatternId,
      rhetoricalForm: 'UNKNOWN',
      label: 'unknown',
      literalCues: Object.freeze([]),
      prefersLineStart: false,
      prefersQuestionShape: false,
      requiresWitnessContext: false,
      requiresNegotiationContext: false,
      scoreBoost01: 0.51 as Score01,
    }),
  ]);

// ============================================================================
// MARK: Pressure band alignment
// ============================================================================

export const CHAT_SEMANTIC_PRESSURE_BANDS = [
  'CALM',
  'BUILDING',
  'ELEVATED',
  'HIGH',
  'CRITICAL',
] as const;

export type ChatSemanticPressureBand =
  (typeof CHAT_SEMANTIC_PRESSURE_BANDS)[number];

export interface ChatSemanticPressureThresholds {
  readonly pressureBand: ChatSemanticPressureBand;
  readonly maxSimilarityToRecent01: Score01;
  readonly maxRecentClusterReuses: number;
  readonly fatigueScoreCap01: Score01;
  readonly exactRepeatWindow: number;
  readonly rhetoricalFatigueWindow: number;
  readonly callbackPrivilegeBoost01: Score01;
  readonly witnessRelaxation01: Score01;
  readonly silenceAllowance01: Score01;
  readonly negotiationAmplifier: number;
}

export const CHAT_SEMANTIC_PRESSURE_THRESHOLDS: Readonly<
  Record<ChatSemanticPressureBand, ChatSemanticPressureThresholds>
> = Object.freeze({
  CALM: Object.freeze<ChatSemanticPressureThresholds>({
    pressureBand: 'CALM',
    maxSimilarityToRecent01: 0.74 as Score01,
    maxRecentClusterReuses: 4,
    fatigueScoreCap01: 0.88 as Score01,
    exactRepeatWindow: 30,
    rhetoricalFatigueWindow: 12,
    callbackPrivilegeBoost01: 0.08 as Score01,
    witnessRelaxation01: 0.10 as Score01,
    silenceAllowance01: 0.24 as Score01,
    negotiationAmplifier: 0.85,
  }),
  BUILDING: Object.freeze<ChatSemanticPressureThresholds>({
    pressureBand: 'BUILDING',
    maxSimilarityToRecent01: 0.70 as Score01,
    maxRecentClusterReuses: 3,
    fatigueScoreCap01: 0.90 as Score01,
    exactRepeatWindow: 24,
    rhetoricalFatigueWindow: 10,
    callbackPrivilegeBoost01: 0.07 as Score01,
    witnessRelaxation01: 0.08 as Score01,
    silenceAllowance01: 0.20 as Score01,
    negotiationAmplifier: 0.95,
  }),
  ELEVATED: Object.freeze<ChatSemanticPressureThresholds>({
    pressureBand: 'ELEVATED',
    maxSimilarityToRecent01: 0.64 as Score01,
    maxRecentClusterReuses: 3,
    fatigueScoreCap01: 0.93 as Score01,
    exactRepeatWindow: 18,
    rhetoricalFatigueWindow: 8,
    callbackPrivilegeBoost01: 0.06 as Score01,
    witnessRelaxation01: 0.06 as Score01,
    silenceAllowance01: 0.16 as Score01,
    negotiationAmplifier: 1.0,
  }),
  HIGH: Object.freeze<ChatSemanticPressureThresholds>({
    pressureBand: 'HIGH',
    maxSimilarityToRecent01: 0.58 as Score01,
    maxRecentClusterReuses: 2,
    fatigueScoreCap01: 0.96 as Score01,
    exactRepeatWindow: 12,
    rhetoricalFatigueWindow: 6,
    callbackPrivilegeBoost01: 0.05 as Score01,
    witnessRelaxation01: 0.04 as Score01,
    silenceAllowance01: 0.12 as Score01,
    negotiationAmplifier: 1.15,
  }),
  CRITICAL: Object.freeze<ChatSemanticPressureThresholds>({
    pressureBand: 'CRITICAL',
    maxSimilarityToRecent01: 0.50 as Score01,
    maxRecentClusterReuses: 1,
    fatigueScoreCap01: 0.99 as Score01,
    exactRepeatWindow: 8,
    rhetoricalFatigueWindow: 4,
    callbackPrivilegeBoost01: 0.03 as Score01,
    witnessRelaxation01: 0.02 as Score01,
    silenceAllowance01: 0.08 as Score01,
    negotiationAmplifier: 1.30,
  }),
});

// ============================================================================
// MARK: Semantic party-mode scopes
// ============================================================================

export const CHAT_SEMANTIC_MODE_SCOPES = [
  'GO_ALONE',
  'HEAD_TO_HEAD',
  'TEAM_UP',
  'CHASE_A_LEGEND',
] as const;

export type ChatSemanticModeScope =
  (typeof CHAT_SEMANTIC_MODE_SCOPES)[number];

export interface ChatSemanticModePolicy {
  readonly modeScope: ChatSemanticModeScope;
  readonly maxSimilarityToRecent01: Score01;
  readonly maxRecentClusterReuses: number;
  readonly rhetoricalPenaltyMultiplier: number;
  readonly callbackBoostAllowed: boolean;
  readonly silenceMarkerPassthrough: boolean;
  readonly ghostAwareFiltering: boolean;
  readonly trustWeightedDiversity: boolean;
  readonly dealRoomPressureAmplified: boolean;
  readonly recentWindowSize: number;
  readonly actorDiversityFloor: number;
  readonly witnessRoomRelaxation01: Score01;
  readonly negotiationDriftPenalty01: Score01;
  readonly helperInterventionBoost01: Score01;
  readonly crowdTextureAllowance01: Score01;
}

export const CHAT_SEMANTIC_MODE_POLICIES: Readonly<
  Record<ChatSemanticModeScope, ChatSemanticModePolicy>
> = Object.freeze({
  GO_ALONE: Object.freeze<ChatSemanticModePolicy>({
    modeScope: 'GO_ALONE',
    maxSimilarityToRecent01: 0.68 as Score01,
    maxRecentClusterReuses: 3,
    rhetoricalPenaltyMultiplier: 1.0,
    callbackBoostAllowed: true,
    silenceMarkerPassthrough: true,
    ghostAwareFiltering: false,
    trustWeightedDiversity: false,
    dealRoomPressureAmplified: false,
    recentWindowSize: 20,
    actorDiversityFloor: 2,
    witnessRoomRelaxation01: 0.04 as Score01,
    negotiationDriftPenalty01: 0.05 as Score01,
    helperInterventionBoost01: 0.06 as Score01,
    crowdTextureAllowance01: 0.08 as Score01,
  }),
  HEAD_TO_HEAD: Object.freeze<ChatSemanticModePolicy>({
    modeScope: 'HEAD_TO_HEAD',
    maxSimilarityToRecent01: 0.58 as Score01,
    maxRecentClusterReuses: 2,
    rhetoricalPenaltyMultiplier: 1.4,
    callbackBoostAllowed: true,
    silenceMarkerPassthrough: true,
    ghostAwareFiltering: false,
    trustWeightedDiversity: false,
    dealRoomPressureAmplified: true,
    recentWindowSize: 16,
    actorDiversityFloor: 2,
    witnessRoomRelaxation01: 0.03 as Score01,
    negotiationDriftPenalty01: 0.10 as Score01,
    helperInterventionBoost01: 0.03 as Score01,
    crowdTextureAllowance01: 0.05 as Score01,
  }),
  TEAM_UP: Object.freeze<ChatSemanticModePolicy>({
    modeScope: 'TEAM_UP',
    maxSimilarityToRecent01: 0.65 as Score01,
    maxRecentClusterReuses: 3,
    rhetoricalPenaltyMultiplier: 1.2,
    callbackBoostAllowed: true,
    silenceMarkerPassthrough: false,
    ghostAwareFiltering: false,
    trustWeightedDiversity: true,
    dealRoomPressureAmplified: false,
    recentWindowSize: 18,
    actorDiversityFloor: 3,
    witnessRoomRelaxation01: 0.06 as Score01,
    negotiationDriftPenalty01: 0.04 as Score01,
    helperInterventionBoost01: 0.09 as Score01,
    crowdTextureAllowance01: 0.11 as Score01,
  }),
  CHASE_A_LEGEND: Object.freeze<ChatSemanticModePolicy>({
    modeScope: 'CHASE_A_LEGEND',
    maxSimilarityToRecent01: 0.55 as Score01,
    maxRecentClusterReuses: 2,
    rhetoricalPenaltyMultiplier: 1.6,
    callbackBoostAllowed: true,
    silenceMarkerPassthrough: true,
    ghostAwareFiltering: true,
    trustWeightedDiversity: false,
    dealRoomPressureAmplified: false,
    recentWindowSize: 14,
    actorDiversityFloor: 2,
    witnessRoomRelaxation01: 0.02 as Score01,
    negotiationDriftPenalty01: 0.07 as Score01,
    helperInterventionBoost01: 0.04 as Score01,
    crowdTextureAllowance01: 0.05 as Score01,
  }),
});

// ============================================================================
// MARK: Channel policy matrix
// ============================================================================

export interface ChatSemanticChannelPolicy {
  readonly channelId: ChatChannelId;
  readonly witnessWeight01: Score01;
  readonly negotiationWeight01: Score01;
  readonly rescueBias01: Score01;
  readonly systemNoticeBias01: Score01;
  readonly crowdTextureBias01: Score01;
  readonly silenceTolerance01: Score01;
  readonly callbackPrivilege01: Score01;
  readonly preferredFamilies: readonly ChatSemanticRhetoricalFamily[];
  readonly discouragedFamilies: readonly ChatSemanticRhetoricalFamily[];
  readonly dominantRegister: ChatSemanticTextRegister;
  readonly dominantCadence: ChatSemanticCadenceClass;
  readonly visibleByDefault: boolean;
  readonly federatedLocalWindowSize: number;
}

export const CHAT_SEMANTIC_CHANNEL_POLICIES: Readonly<
  Record<ChatChannelId, ChatSemanticChannelPolicy>
> = Object.freeze({
  GLOBAL: Object.freeze<ChatSemanticChannelPolicy>({
    channelId: 'GLOBAL',
    witnessWeight01: 0.84 as Score01,
    negotiationWeight01: 0.22 as Score01,
    rescueBias01: 0.42 as Score01,
    systemNoticeBias01: 0.36 as Score01,
    crowdTextureBias01: 0.78 as Score01,
    silenceTolerance01: 0.30 as Score01,
    callbackPrivilege01: 0.44 as Score01,
    preferredFamilies: Object.freeze(['HOSTILITY', 'WEIGHT', 'AMBIENT', 'HELPER']),
    discouragedFamilies: Object.freeze(['FALLBACK']),
    dominantRegister: 'SPECTATOR',
    dominantCadence: 'MEASURED',
    visibleByDefault: true,
    federatedLocalWindowSize: 28,
  }),
  SYNDICATE: Object.freeze<ChatSemanticChannelPolicy>({
    channelId: 'SYNDICATE',
    witnessWeight01: 0.38 as Score01,
    negotiationWeight01: 0.36 as Score01,
    rescueBias01: 0.86 as Score01,
    systemNoticeBias01: 0.18 as Score01,
    crowdTextureBias01: 0.20 as Score01,
    silenceTolerance01: 0.36 as Score01,
    callbackPrivilege01: 0.66 as Score01,
    preferredFamilies: Object.freeze(['HELPER', 'WEIGHT', 'NEGOTIATION']),
    discouragedFamilies: Object.freeze(['AMBIENT']),
    dominantRegister: 'MENTORIAL',
    dominantCadence: 'RECOVERY',
    visibleByDefault: true,
    federatedLocalWindowSize: 24,
  }),
  DEAL_ROOM: Object.freeze<ChatSemanticChannelPolicy>({
    channelId: 'DEAL_ROOM',
    witnessWeight01: 0.24 as Score01,
    negotiationWeight01: 0.94 as Score01,
    rescueBias01: 0.18 as Score01,
    systemNoticeBias01: 0.24 as Score01,
    crowdTextureBias01: 0.10 as Score01,
    silenceTolerance01: 0.82 as Score01,
    callbackPrivilege01: 0.32 as Score01,
    preferredFamilies: Object.freeze(['NEGOTIATION', 'HOSTILITY', 'SYSTEM']),
    discouragedFamilies: Object.freeze(['AMBIENT']),
    dominantRegister: 'LEDGER',
    dominantCadence: 'DELAYED',
    visibleByDefault: true,
    federatedLocalWindowSize: 20,
  }),
  LOBBY: Object.freeze<ChatSemanticChannelPolicy>({
    channelId: 'LOBBY',
    witnessWeight01: 0.62 as Score01,
    negotiationWeight01: 0.12 as Score01,
    rescueBias01: 0.28 as Score01,
    systemNoticeBias01: 0.20 as Score01,
    crowdTextureBias01: 0.88 as Score01,
    silenceTolerance01: 0.24 as Score01,
    callbackPrivilege01: 0.30 as Score01,
    preferredFamilies: Object.freeze(['AMBIENT', 'WEIGHT', 'HOSTILITY']),
    discouragedFamilies: Object.freeze(['NEGOTIATION']),
    dominantRegister: 'CASUAL',
    dominantCadence: 'BURST',
    visibleByDefault: true,
    federatedLocalWindowSize: 22,
  }),
  SYSTEM_SHADOW: Object.freeze<ChatSemanticChannelPolicy>({
    channelId: 'SYSTEM_SHADOW',
    witnessWeight01: 0.08 as Score01,
    negotiationWeight01: 0.08 as Score01,
    rescueBias01: 0.18 as Score01,
    systemNoticeBias01: 0.94 as Score01,
    crowdTextureBias01: 0.02 as Score01,
    silenceTolerance01: 0.90 as Score01,
    callbackPrivilege01: 0.22 as Score01,
    preferredFamilies: Object.freeze(['SYSTEM']) as readonly ChatSemanticRhetoricalFamily[],
    discouragedFamilies: Object.freeze(['AMBIENT']),
    dominantRegister: 'SYSTEM',
    dominantCadence: 'CEREMONIAL',
    visibleByDefault: false,
    federatedLocalWindowSize: 18,
  }),
  NPC_SHADOW: Object.freeze<ChatSemanticChannelPolicy>({
    channelId: 'NPC_SHADOW',
    witnessWeight01: 0.12 as Score01,
    negotiationWeight01: 0.16 as Score01,
    rescueBias01: 0.28 as Score01,
    systemNoticeBias01: 0.12 as Score01,
    crowdTextureBias01: 0.04 as Score01,
    silenceTolerance01: 0.78 as Score01,
    callbackPrivilege01: 0.54 as Score01,
    preferredFamilies: Object.freeze(['HOSTILITY', 'HELPER', 'WEIGHT']),
    discouragedFamilies: Object.freeze(['SYSTEM']),
    dominantRegister: 'PREDATORY',
    dominantCadence: 'MEASURED',
    visibleByDefault: false,
    federatedLocalWindowSize: 26,
  }),
  RIVALRY_SHADOW: Object.freeze<ChatSemanticChannelPolicy>({
    channelId: 'RIVALRY_SHADOW',
    witnessWeight01: 0.30 as Score01,
    negotiationWeight01: 0.18 as Score01,
    rescueBias01: 0.10 as Score01,
    systemNoticeBias01: 0.08 as Score01,
    crowdTextureBias01: 0.18 as Score01,
    silenceTolerance01: 0.56 as Score01,
    callbackPrivilege01: 0.62 as Score01,
    preferredFamilies: Object.freeze(['WEIGHT', 'HOSTILITY']),
    discouragedFamilies: Object.freeze(['SYSTEM']),
    dominantRegister: 'PREDATORY',
    dominantCadence: 'CUTTING',
    visibleByDefault: false,
    federatedLocalWindowSize: 18,
  }),
  RESCUE_SHADOW: Object.freeze<ChatSemanticChannelPolicy>({
    channelId: 'RESCUE_SHADOW',
    witnessWeight01: 0.06 as Score01,
    negotiationWeight01: 0.02 as Score01,
    rescueBias01: 0.98 as Score01,
    systemNoticeBias01: 0.16 as Score01,
    crowdTextureBias01: 0.02 as Score01,
    silenceTolerance01: 0.72 as Score01,
    callbackPrivilege01: 0.58 as Score01,
    preferredFamilies: Object.freeze(['HELPER', 'SYSTEM']),
    discouragedFamilies: Object.freeze(['HOSTILITY']),
    dominantRegister: 'MENTORIAL',
    dominantCadence: 'RECOVERY',
    visibleByDefault: false,
    federatedLocalWindowSize: 18,
  }),
  LIVEOPS_SHADOW: Object.freeze<ChatSemanticChannelPolicy>({
    channelId: 'LIVEOPS_SHADOW',
    witnessWeight01: 0.20 as Score01,
    negotiationWeight01: 0.04 as Score01,
    rescueBias01: 0.10 as Score01,
    systemNoticeBias01: 0.84 as Score01,
    crowdTextureBias01: 0.12 as Score01,
    silenceTolerance01: 0.68 as Score01,
    callbackPrivilege01: 0.26 as Score01,
    preferredFamilies: Object.freeze(['SYSTEM', 'AMBIENT']) as readonly ChatSemanticRhetoricalFamily[],
    discouragedFamilies: Object.freeze(['NEGOTIATION']),
    dominantRegister: 'RITUAL',
    dominantCadence: 'CEREMONIAL',
    visibleByDefault: false,
    federatedLocalWindowSize: 18,
  }),
});

export interface ChatSemanticActorClassPolicy {
  readonly actorClass: ChatSemanticActorClass;
  readonly hostilityBias01: Score01;
  readonly rescueBias01: Score01;
  readonly witnessBias01: Score01;
  readonly negotiationBias01: Score01;
  readonly systemBias01: Score01;
  readonly preferredFamilies: readonly ChatSemanticRhetoricalFamily[];
}

export const CHAT_SEMANTIC_ACTOR_CLASS_POLICIES: Readonly<
  Record<ChatSemanticActorClass, ChatSemanticActorClassPolicy>
> = Object.freeze({
  HATER: Object.freeze({
    actorClass: 'HATER',
    hostilityBias01: 0.94 as Score01,
    rescueBias01: 0.02 as Score01,
    witnessBias01: 0.18 as Score01,
    negotiationBias01: 0.62 as Score01,
    systemBias01: 0.04 as Score01,
    preferredFamilies: Object.freeze(['HOSTILITY', 'WEIGHT', 'NEGOTIATION']) as readonly ChatSemanticRhetoricalFamily[],
  }),
  HELPER: Object.freeze({
    actorClass: 'HELPER',
    hostilityBias01: 0.10 as Score01,
    rescueBias01: 0.94 as Score01,
    witnessBias01: 0.20 as Score01,
    negotiationBias01: 0.18 as Score01,
    systemBias01: 0.06 as Score01,
    preferredFamilies: Object.freeze(['HELPER', 'WEIGHT']) as readonly ChatSemanticRhetoricalFamily[],
  }),
  AMBIENT: Object.freeze({
    actorClass: 'AMBIENT',
    hostilityBias01: 0.18 as Score01,
    rescueBias01: 0.16 as Score01,
    witnessBias01: 0.88 as Score01,
    negotiationBias01: 0.10 as Score01,
    systemBias01: 0.06 as Score01,
    preferredFamilies: Object.freeze(['AMBIENT', 'WEIGHT']) as readonly ChatSemanticRhetoricalFamily[],
  }),
  LIVEOPS: Object.freeze({
    actorClass: 'LIVEOPS',
    hostilityBias01: 0.10 as Score01,
    rescueBias01: 0.10 as Score01,
    witnessBias01: 0.36 as Score01,
    negotiationBias01: 0.04 as Score01,
    systemBias01: 0.86 as Score01,
    preferredFamilies: Object.freeze(['SYSTEM', 'AMBIENT']) as readonly ChatSemanticRhetoricalFamily[],
  }),
  SYSTEM: Object.freeze({
    actorClass: 'SYSTEM',
    hostilityBias01: 0.04 as Score01,
    rescueBias01: 0.12 as Score01,
    witnessBias01: 0.18 as Score01,
    negotiationBias01: 0.04 as Score01,
    systemBias01: 0.98 as Score01,
    preferredFamilies: Object.freeze(['SYSTEM']) as readonly ChatSemanticRhetoricalFamily[],
  }),
  PLAYER: Object.freeze({
    actorClass: 'PLAYER',
    hostilityBias01: 0.24 as Score01,
    rescueBias01: 0.16 as Score01,
    witnessBias01: 0.30 as Score01,
    negotiationBias01: 0.26 as Score01,
    systemBias01: 0.02 as Score01,
    preferredFamilies: Object.freeze(['NEGOTIATION', 'WEIGHT', 'HELPER']) as readonly ChatSemanticRhetoricalFamily[],
  }),
  UNKNOWN: Object.freeze({
    actorClass: 'UNKNOWN',
    hostilityBias01: 0.24 as Score01,
    rescueBias01: 0.24 as Score01,
    witnessBias01: 0.24 as Score01,
    negotiationBias01: 0.24 as Score01,
    systemBias01: 0.24 as Score01,
    preferredFamilies: Object.freeze(['FALLBACK']) as readonly ChatSemanticRhetoricalFamily[],
  }),
});

// ============================================================================
// MARK: Tokenization, vector, and similarity configuration contracts
// ============================================================================

export interface ChatSemanticStopwordPolicy {
  readonly stopwords: readonly string[];
  readonly permitNumericTokens: boolean;
  readonly permitSingleCharacterTokens: boolean;
  readonly preserveContractions: boolean;
  readonly preserveLedgerNumerics: boolean;
  readonly preserveProofHashes: boolean;
}

export const DEFAULT_CHAT_SEMANTIC_STOPWORD_POLICY: ChatSemanticStopwordPolicy =
  Object.freeze({
    stopwords: Object.freeze([
      'a',
      'an',
      'and',
      'are',
      'as',
      'at',
      'be',
      'by',
      'for',
      'from',
      'if',
      'in',
      'into',
      'is',
      'it',
      'of',
      'on',
      'or',
      'that',
      'the',
      'their',
      'this',
      'to',
      'was',
      'were',
      'will',
      'with',
      'you',
      'your',
    ]),
    permitNumericTokens: true,
    permitSingleCharacterTokens: false,
    preserveContractions: true,
    preserveLedgerNumerics: true,
    preserveProofHashes: true,
  });

export interface ChatSemanticVectorizationConfig {
  readonly dimensions: number;
  readonly maxTokenCount: number;
  readonly maxBigramCount: number;
  readonly charGramSize: number;
  readonly maxCharGramCount: number;
  readonly topTermsForCluster: number;
  readonly lexemeCueWeight: number;
  readonly punctuationShapeWeight: number;
  readonly rhetoricalCueWeight: number;
  readonly bigramWeight: number;
  readonly charGramWeight: number;
  readonly tagWeight: number;
  readonly motifWeight: number;
  readonly callbackWeight: number;
  readonly sourceKindWeight: number;
  readonly proofWeight: number;
  readonly witnessWeight: number;
}

export const DEFAULT_CHAT_SEMANTIC_VECTORIZATION_CONFIG:
  ChatSemanticVectorizationConfig = Object.freeze({
    dimensions: 192,
    maxTokenCount: 72,
    maxBigramCount: 72,
    charGramSize: 3,
    maxCharGramCount: 144,
    topTermsForCluster: 6,
    lexemeCueWeight: 1.45,
    punctuationShapeWeight: 0.82,
    rhetoricalCueWeight: 1.20,
    bigramWeight: 0.88,
    charGramWeight: 0.54,
    tagWeight: 0.46,
    motifWeight: 0.52,
    callbackWeight: 0.60,
    sourceKindWeight: 0.22,
    proofWeight: 0.36,
    witnessWeight: 0.34,
  });

export interface ChatSemanticDictionaryTerm {
  readonly termId: ChatSemanticDictionaryTermId;
  readonly value: string;
  readonly weight: number;
  readonly families: readonly ChatSemanticRhetoricalFamily[];
  readonly actorClasses: readonly ChatSemanticActorClass[];
  readonly channels: readonly ChatChannelId[];
  readonly registers: readonly ChatSemanticTextRegister[];
  readonly tags: readonly string[];
}

export const CHAT_SEMANTIC_DICTIONARY_TERMS: readonly ChatSemanticDictionaryTerm[] =
  Object.freeze([
    Object.freeze({
      termId: 'semantic-term-001' as ChatSemanticDictionaryTermId,
      value: 'receipt',
      weight: 1.18,
      families: Object.freeze(['WEIGHT', 'AMBIENT']) as readonly ChatSemanticRhetoricalFamily[],
      actorClasses: Object.freeze(['AMBIENT', 'HATER']) as readonly ChatSemanticActorClass[],
      channels: Object.freeze(['GLOBAL', 'LOBBY']) as readonly ChatChannelId[],
      registers: Object.freeze(['SPECTATOR', 'LEDGER']) as readonly ChatSemanticTextRegister[],
      tags: Object.freeze(['memory', 'witness']),
    }),
    Object.freeze({
      termId: 'semantic-term-002' as ChatSemanticDictionaryTermId,
      value: 'bluff',
      weight: 1.26,
      families: Object.freeze(['HOSTILITY', 'NEGOTIATION']) as readonly ChatSemanticRhetoricalFamily[],
      actorClasses: Object.freeze(['HATER', 'PLAYER']) as readonly ChatSemanticActorClass[],
      channels: Object.freeze(['DEAL_ROOM', 'GLOBAL']) as readonly ChatChannelId[],
      registers: Object.freeze(['PREDATORY', 'LEDGER']) as readonly ChatSemanticTextRegister[],
      tags: Object.freeze(['negotiation', 'pressure']),
    }),
    Object.freeze({
      termId: 'semantic-term-003' as ChatSemanticDictionaryTermId,
      value: 'breathe',
      weight: 0.94,
      families: Object.freeze(['HELPER']) as readonly ChatSemanticRhetoricalFamily[],
      actorClasses: Object.freeze(['HELPER']) as readonly ChatSemanticActorClass[],
      channels: Object.freeze(['SYNDICATE', 'RESCUE_SHADOW']) as readonly ChatChannelId[],
      registers: Object.freeze(['MENTORIAL']) as readonly ChatSemanticTextRegister[],
      tags: Object.freeze(['rescue', 'stabilize']),
    }),
    Object.freeze({
      termId: 'semantic-term-004' as ChatSemanticDictionaryTermId,
      value: 'verified',
      weight: 1.04,
      families: Object.freeze(['SYSTEM']) as readonly ChatSemanticRhetoricalFamily[],
      actorClasses: Object.freeze(['SYSTEM', 'LIVEOPS']) as readonly ChatSemanticActorClass[],
      channels: Object.freeze(['GLOBAL', 'SYSTEM_SHADOW']) as readonly ChatChannelId[],
      registers: Object.freeze(['SYSTEM', 'RITUAL']) as readonly ChatSemanticTextRegister[],
      tags: Object.freeze(['proof', 'attestation']),
    }),
    Object.freeze({
      termId: 'semantic-term-005' as ChatSemanticDictionaryTermId,
      value: 'archive',
      weight: 0.92,
      families: Object.freeze(['WEIGHT', 'HELPER', 'AMBIENT']) as readonly ChatSemanticRhetoricalFamily[],
      actorClasses: Object.freeze(['HELPER', 'AMBIENT', 'SYSTEM']) as readonly ChatSemanticActorClass[],
      channels: Object.freeze(['GLOBAL', 'SYNDICATE', 'SYSTEM_SHADOW']) as readonly ChatChannelId[],
      registers: Object.freeze(['LEDGER', 'SPECTATOR', 'MENTORIAL']) as readonly ChatSemanticTextRegister[],
      tags: Object.freeze(['memory', 'record']),
    }),
    Object.freeze({
      termId: 'semantic-term-006' as ChatSemanticDictionaryTermId,
      value: 'terms',
      weight: 1.12,
      families: Object.freeze(['NEGOTIATION']) as readonly ChatSemanticRhetoricalFamily[],
      actorClasses: Object.freeze(['HATER', 'PLAYER']) as readonly ChatSemanticActorClass[],
      channels: Object.freeze(['DEAL_ROOM']) as readonly ChatChannelId[],
      registers: Object.freeze(['LEDGER', 'PREDATORY']) as readonly ChatSemanticTextRegister[],
      tags: Object.freeze(['dealroom', 'offer']),
    }),
    Object.freeze({
      termId: 'semantic-term-007' as ChatSemanticDictionaryTermId,
      value: 'fundamentals',
      weight: 0.88,
      families: Object.freeze(['HELPER']) as readonly ChatSemanticRhetoricalFamily[],
      actorClasses: Object.freeze(['HELPER']) as readonly ChatSemanticActorClass[],
      channels: Object.freeze(['SYNDICATE', 'GLOBAL']) as readonly ChatChannelId[],
      registers: Object.freeze(['MENTORIAL']) as readonly ChatSemanticTextRegister[],
      tags: Object.freeze(['anchor', 'discipline']),
    }),
    Object.freeze({
      termId: 'semantic-term-008' as ChatSemanticDictionaryTermId,
      value: 'witness',
      weight: 0.98,
      families: Object.freeze(['WEIGHT', 'AMBIENT']) as readonly ChatSemanticRhetoricalFamily[],
      actorClasses: Object.freeze(['AMBIENT', 'SYSTEM']) as readonly ChatSemanticActorClass[],
      channels: Object.freeze(['GLOBAL', 'LOBBY']) as readonly ChatChannelId[],
      registers: Object.freeze(['SPECTATOR', 'SYSTEM']) as readonly ChatSemanticTextRegister[],
      tags: Object.freeze(['crowd', 'public']),
    }),
  ]);

export interface ChatSemanticSimilarityWeights {
  readonly tokenOverlapWeight: number;
  readonly bigramOverlapWeight: number;
  readonly charGramOverlapWeight: number;
  readonly rhetoricalMatchWeight: number;
  readonly clusterMatchWeight: number;
  readonly tagOverlapWeight: number;
  readonly motifOverlapWeight: number;
  readonly callbackOverlapWeight: number;
  readonly actorMatchWeight: number;
  readonly channelAlignmentWeight: number;
  readonly modeAlignmentWeight: number;
  readonly pressureAlignmentWeight: number;
  readonly sourceKindWeight: number;
  readonly witnessShapeWeight: number;
  readonly silenceShapeWeight: number;
}

export const DEFAULT_CHAT_SEMANTIC_SIMILARITY_WEIGHTS:
  ChatSemanticSimilarityWeights = Object.freeze({
    tokenOverlapWeight: 0.26,
    bigramOverlapWeight: 0.12,
    charGramOverlapWeight: 0.08,
    rhetoricalMatchWeight: 0.14,
    clusterMatchWeight: 0.10,
    tagOverlapWeight: 0.06,
    motifOverlapWeight: 0.04,
    callbackOverlapWeight: 0.06,
    actorMatchWeight: 0.04,
    channelAlignmentWeight: 0.04,
    modeAlignmentWeight: 0.03,
    pressureAlignmentWeight: 0.02,
    sourceKindWeight: 0.01,
    witnessShapeWeight: 0.02,
    silenceShapeWeight: 0.02,
  });

// ============================================================================
// MARK: Document, provenance, and explainability contracts
// ============================================================================

export interface ChatSemanticDocumentFlags {
  readonly isShadowChannel: boolean;
  readonly isSystemAuthored: boolean;
  readonly isCallbackCandidate: boolean;
  readonly isNegotiationCritical: boolean;
  readonly isProofBearing: boolean;
  readonly isLiveopsInjected: boolean;
  readonly isRescueEligible: boolean;
  readonly isWitnessLine: boolean;
  readonly isSilenceMove: boolean;
  readonly isCrowdTexture: boolean;
}

export interface ChatSemanticProvenance {
  readonly sourceKind: ChatSemanticSourceKind;
  readonly sourcePath?: string;
  readonly sourceVersion?: string;
  readonly sourceAuthority?: string;
  readonly createdByRuntime?: string;
  readonly migrationTag?: string;
  readonly lineOriginNote?: string;
}

export interface ChatSemanticNarrativeRole {
  readonly roleId: ChatSemanticRoleProfileId;
  readonly label: string;
  readonly description: string;
  readonly witnessBias01: Score01;
  readonly rescueBias01: Score01;
  readonly hostilityBias01: Score01;
  readonly negotiationBias01: Score01;
}

export const CHAT_SEMANTIC_NARRATIVE_ROLES: readonly ChatSemanticNarrativeRole[] =
  Object.freeze([
    Object.freeze({
      roleId: 'semantic-role-001' as ChatSemanticRoleProfileId,
      label: 'OPENER',
      description: 'Starts a scene and establishes the first emotional footing.',
      witnessBias01: 0.28 as Score01,
      rescueBias01: 0.10 as Score01,
      hostilityBias01: 0.34 as Score01,
      negotiationBias01: 0.18 as Score01,
    }),
    Object.freeze({
      roleId: 'semantic-role-002' as ChatSemanticRoleProfileId,
      label: 'PRESSURE_ESCALATOR',
      description: 'Raises stakes and intensifies perceived threat.',
      witnessBias01: 0.20 as Score01,
      rescueBias01: 0.02 as Score01,
      hostilityBias01: 0.88 as Score01,
      negotiationBias01: 0.42 as Score01,
    }),
    Object.freeze({
      roleId: 'semantic-role-003' as ChatSemanticRoleProfileId,
      label: 'CROWD_WITNESS',
      description: 'Externalizes the room and validates that the moment was seen.',
      witnessBias01: 0.96 as Score01,
      rescueBias01: 0.04 as Score01,
      hostilityBias01: 0.16 as Score01,
      negotiationBias01: 0.08 as Score01,
    }),
    Object.freeze({
      roleId: 'semantic-role-004' as ChatSemanticRoleProfileId,
      label: 'HELPER_INTERCEPTOR',
      description: 'Interrupts momentum to stabilize or redirect.',
      witnessBias01: 0.10 as Score01,
      rescueBias01: 0.94 as Score01,
      hostilityBias01: 0.06 as Score01,
      negotiationBias01: 0.10 as Score01,
    }),
    Object.freeze({
      roleId: 'semantic-role-005' as ChatSemanticRoleProfileId,
      label: 'CLOSER',
      description: 'Locks meaning onto a scene and determines what the player remembers.',
      witnessBias01: 0.62 as Score01,
      rescueBias01: 0.22 as Score01,
      hostilityBias01: 0.28 as Score01,
      negotiationBias01: 0.16 as Score01,
    }),
    Object.freeze({
      roleId: 'semantic-role-006' as ChatSemanticRoleProfileId,
      label: 'SHADOW_MARKER',
      description: 'Invisible or semi-visible line that changes downstream meaning without overt spectacle.',
      witnessBias01: 0.06 as Score01,
      rescueBias01: 0.12 as Score01,
      hostilityBias01: 0.34 as Score01,
      negotiationBias01: 0.22 as Score01,
    }),
  ]);

export interface ChatSemanticDocumentInput {
  readonly documentId: string;
  readonly canonicalLineId?: string;
  readonly actorId?: string;
  readonly npcId?: ChatNpcId;
  readonly botId?: string;
  readonly text: string;
  readonly tags?: readonly string[];
  readonly motifIds?: readonly string[];
  readonly sceneRoles?: readonly string[];
  readonly callbackSourceIds?: readonly string[];
  readonly pressureBand?: ChatSemanticPressureBand;
  readonly channelId?: ChatChannelId;
  readonly modeScope?: ChatSemanticModeScope;
  readonly actorClass?: ChatSemanticActorClass;
  readonly sourceKind?: ChatSemanticSourceKind;
  readonly cadenceClass?: ChatSemanticCadenceClass;
  readonly textRegister?: ChatSemanticTextRegister;
  readonly audienceHeat01?: Score01;
  readonly trustScore01?: Score01;
  readonly leverageScore01?: Score01;
  readonly proofWeight01?: Score01;
  readonly negotiationRisk01?: Score01;
  readonly flags?: Partial<ChatSemanticDocumentFlags>;
  readonly provenance?: ChatSemanticProvenance;
  readonly lineageId?: ChatSemanticLineageId;
  readonly roomScopeId?: ChatSemanticRoomScopeId;
  readonly channelScopeId?: ChatSemanticChannelScopeId;
  readonly createdAt: UnixMs | number;
}

export interface ChatSemanticSparseVectorEntry {
  readonly dimension: number;
  readonly value: number;
}

export interface ChatSemanticExplainabilityTerm {
  readonly signal: ChatSemanticExplainabilitySignal;
  readonly label: string;
  readonly score01: Score01;
  readonly supportingTokens: readonly string[];
  readonly notes: readonly string[];
}

export interface ChatSemanticIndexedDocument {
  readonly documentId: string;
  readonly canonicalLineId: string | undefined;
  readonly actorId: string | null;
  readonly npcId: ChatNpcId | undefined;
  readonly botId: string | null;
  readonly actorClass: ChatSemanticActorClass;
  readonly text: string;
  readonly normalizedText: string;
  readonly tokens: readonly string[];
  readonly bigrams: readonly string[];
  readonly charGrams: readonly string[];
  readonly weightedTerms: Readonly<Record<string, number>>;
  readonly rhetoricalForm: ChatSemanticRhetoricalForm;
  readonly rhetoricalFamily: ChatSemanticRhetoricalFamily;
  readonly rhetoricalFingerprint: string;
  readonly semanticClusterId: string;
  readonly sparseVector: readonly ChatSemanticSparseVectorEntry[];
  readonly vectorNorm: number;
  readonly tags: readonly string[];
  readonly motifIds: readonly string[];
  readonly sceneRoles: readonly string[];
  readonly callbackSourceIds: readonly string[];
  readonly pressureBand: ChatSemanticPressureBand | undefined;
  readonly channelId: ChatChannelId | undefined;
  readonly modeScope: ChatSemanticModeScope | undefined;
  readonly sourceKind: ChatSemanticSourceKind;
  readonly cadenceClass: ChatSemanticCadenceClass;
  readonly textRegister: ChatSemanticTextRegister;
  readonly flags: ChatSemanticDocumentFlags;
  readonly provenance: Readonly<ChatSemanticProvenance>;
  readonly audienceHeat01: Score01 | undefined;
  readonly trustScore01: Score01 | undefined;
  readonly leverageScore01: Score01 | undefined;
  readonly proofWeight01: Score01 | undefined;
  readonly negotiationRisk01: Score01 | undefined;
  readonly lineageId: ChatSemanticLineageId | undefined;
  readonly roomScopeId: ChatSemanticRoomScopeId | undefined;
  readonly channelScopeId: ChatSemanticChannelScopeId | undefined;
  readonly explainabilityTerms: readonly ChatSemanticExplainabilityTerm[];
  readonly createdAt: UnixMs | number;
}

// ============================================================================
// MARK: Neighbor, query, ranking, and decision contracts
// ============================================================================

export interface ChatSemanticNeighbor {
  readonly documentId: string;
  readonly canonicalLineId: string | undefined;
  readonly similarity01: Score01;
  readonly semanticClusterId: string;
  readonly rhetoricalForm: ChatSemanticRhetoricalForm;
  readonly rhetoricalFamily: ChatSemanticRhetoricalFamily;
  readonly overlapTokens: readonly string[];
  readonly tags: readonly string[];
  readonly notes: readonly string[];
  readonly explainability: readonly ChatSemanticExplainabilityTerm[];
}

export interface ChatSemanticQueryFilters {
  readonly actorIds?: readonly string[];
  readonly npcIds?: readonly ChatNpcId[];
  readonly actorClasses?: readonly ChatSemanticActorClass[];
  readonly channels?: readonly ChatChannelId[];
  readonly modeScopes?: readonly ChatSemanticModeScope[];
  readonly pressureBands?: readonly ChatSemanticPressureBand[];
  readonly rhetoricalForms?: readonly ChatSemanticRhetoricalForm[];
  readonly rhetoricalFamilies?: readonly ChatSemanticRhetoricalFamily[];
  readonly sourceKinds?: readonly ChatSemanticSourceKind[];
  readonly tags?: readonly string[];
  readonly motifIds?: readonly string[];
  readonly lineageIds?: readonly ChatSemanticLineageId[];
  readonly createdAfter?: UnixMs | number;
  readonly createdBefore?: UnixMs | number;
}

export interface ChatSemanticQuery {
  readonly queryId: string;
  readonly text: string;
  readonly sceneRoles?: readonly string[];
  readonly pressureBand?: ChatSemanticPressureBand;
  readonly channelId?: ChatChannelId;
  readonly modeScope?: ChatSemanticModeScope;
  readonly preferredTags?: readonly string[];
  readonly excludedDocumentIds?: readonly string[];
  readonly minSimilarity01?: Score01;
  readonly maxResults?: number;
  readonly actorFilter?: string;
  readonly botIdFilter?: string;
  readonly strategy?: ChatSemanticQueryStrategy;
  readonly filters?: ChatSemanticQueryFilters;
  readonly now: UnixMs | number;
}

export interface ChatSemanticQueryResult {
  readonly queryId: string;
  readonly computedAt: UnixMs | number;
  readonly strategy: ChatSemanticQueryStrategy;
  readonly queryDocument: ChatSemanticIndexedDocument;
  readonly neighbors: readonly ChatSemanticNeighbor[];
  readonly explainability: readonly ChatSemanticExplainabilityTerm[];
}

export interface ChatSemanticNoveltyGuardConfig {
  readonly maxSimilarityToRecent01: Score01;
  readonly maxRecentClusterReuses: number;
  readonly exactTextPenalty01: Score01;
  readonly clusterPenalty01: Score01;
  readonly rhetoricalPenalty01: Score01;
  readonly fatigueScoreCap01: Score01;
  readonly witnessRelaxation01: Score01;
  readonly callbackBoost01: Score01;
  readonly silencePassthroughBoost01: Score01;
  readonly helperInterventionBoost01: Score01;
  readonly negotiationDriftPenalty01: Score01;
  readonly actorMonotonyPenalty01: Score01;
  readonly channelMonotonyPenalty01: Score01;
}

export const DEFAULT_CHAT_SEMANTIC_NOVELTY_GUARD:
  ChatSemanticNoveltyGuardConfig = Object.freeze({
    maxSimilarityToRecent01: 0.68 as Score01,
    maxRecentClusterReuses: 3,
    exactTextPenalty01: 1.00 as Score01,
    clusterPenalty01: 0.35 as Score01,
    rhetoricalPenalty01: 0.18 as Score01,
    fatigueScoreCap01: 0.98 as Score01,
    witnessRelaxation01: 0.06 as Score01,
    callbackBoost01: 0.06 as Score01,
    silencePassthroughBoost01: 0.08 as Score01,
    helperInterventionBoost01: 0.08 as Score01,
    negotiationDriftPenalty01: 0.10 as Score01,
    actorMonotonyPenalty01: 0.12 as Score01,
    channelMonotonyPenalty01: 0.09 as Score01,
  });

export interface ChatSemanticNoveltyWindowStats {
  readonly recentDocumentCount: number;
  readonly exactRepeatHits: number;
  readonly clusterRepeatHits: number;
  readonly rhetoricalRepeatHits: number;
  readonly actorRepeatHits: number;
  readonly channelRepeatHits: number;
  readonly silenceRepeatHits: number;
  readonly witnessRepeatHits: number;
  readonly negotiationRepeatHits: number;
}

export interface ChatSemanticNoveltyGuardRequest {
  readonly requestId: string;
  readonly candidate: ChatSemanticDocumentInput;
  readonly recentDocuments: readonly ChatSemanticIndexedDocument[];
  readonly config?: Partial<ChatSemanticNoveltyGuardConfig>;
  readonly pressureBand?: ChatSemanticPressureBand;
  readonly modeScope?: ChatSemanticModeScope;
  readonly channelId?: ChatChannelId;
  readonly now: UnixMs | number;
}

export interface ChatSemanticNoveltyDecision {
  readonly requestId: string;
  readonly computedAt: UnixMs | number;
  readonly candidateDocument: ChatSemanticIndexedDocument;
  readonly allowed: boolean;
  readonly noveltyScore01: Score01;
  readonly fatigueScore01: Score01;
  readonly highestSimilarity01: Score01;
  readonly repeatedClusterCount: number;
  readonly repeatedRhetoricalCount: number;
  readonly repeatedActorCount: number;
  readonly repeatedChannelCount: number;
  readonly nearestNeighbors: readonly ChatSemanticNeighbor[];
  readonly blockedReasons: readonly string[];
  readonly explainability: readonly ChatSemanticExplainabilityTerm[];
  readonly windowStats: ChatSemanticNoveltyWindowStats;
  readonly appliedPressureThreshold?: ChatSemanticPressureThresholds;
  readonly appliedModePolicy?: ChatSemanticModePolicy;
  readonly appliedChannelPolicy?: ChatSemanticChannelPolicy;
}

// ============================================================================
// MARK: Federation, decay, snapshot, hydration, migration
// ============================================================================

export interface ChatSemanticActorIndexSlot {
  readonly actorId: string;
  readonly npcId: ChatNpcId | undefined;
  readonly npcClass: 'HATER' | 'HELPER' | 'AMBIENT' | 'SYSTEM' | 'UNKNOWN';
  readonly documentCount: number;
  readonly clusterCount: number;
  readonly lastIndexedAt: UnixMs | number;
}

export const CHAT_SEMANTIC_FEDERATION_SCOPES = [
  'GLOBAL',
  'ROOM',
  'ACTOR',
  'CHANNEL',
] as const;

export type ChatSemanticFederationScope =
  (typeof CHAT_SEMANTIC_FEDERATION_SCOPES)[number];

export interface ChatSemanticFederationSlotDescriptor {
  readonly scope: ChatSemanticFederationScope;
  readonly key: ChatSemanticFederationKey;
  readonly roomScopeId?: ChatSemanticRoomScopeId;
  readonly actorId?: string;
  readonly channelId?: ChatChannelId;
  readonly documentCount: number;
  readonly clusterCount: number;
  readonly lastUpdatedAt: UnixMs | number;
  readonly preferredWindowSize: number;
  readonly supportsNoveltyGuard: boolean;
  readonly supportsTrainingExport: boolean;
}

export interface ChatSemanticDecayCurve {
  readonly halfLifeTicks: number;
  readonly floorDecayFactor01: Score01;
  readonly ceilDecayFactor01: Score01;
  readonly pressureBandAccelerator: Readonly<Record<ChatSemanticPressureBand, number>>;
  readonly witnessBandSlowdown: number;
  readonly silenceBandSlowdown: number;
  readonly callbackBandSlowdown: number;
  readonly negotiationBandSpeedup: number;
}

export const DEFAULT_CHAT_SEMANTIC_DECAY_CURVE: ChatSemanticDecayCurve =
  Object.freeze({
    halfLifeTicks: 15,
    floorDecayFactor01: 0.12 as Score01,
    ceilDecayFactor01: 1.00 as Score01,
    pressureBandAccelerator: Object.freeze({
      CALM: 0.7,
      BUILDING: 0.85,
      ELEVATED: 1.0,
      HIGH: 1.2,
      CRITICAL: 1.5,
    }),
    witnessBandSlowdown: 0.88,
    silenceBandSlowdown: 0.82,
    callbackBandSlowdown: 0.76,
    negotiationBandSpeedup: 1.18,
  });

export interface ChatSemanticIndexSnapshot {
  readonly createdAt: UnixMs | number;
  readonly updatedAt: UnixMs | number;
  readonly dimensions: number;
  readonly documents: readonly ChatSemanticIndexedDocument[];
  readonly clusterMembership: Readonly<Record<string, readonly string[]>>;
  readonly actorSlots?: Readonly<Record<string, ChatSemanticActorIndexSlot>>;
  readonly federationSlots?: readonly ChatSemanticFederationSlotDescriptor[];
  readonly snapshotVersion?: string;
  readonly manifestId?: ChatSemanticManifestId;
}

export interface ChatSemanticHydrationEnvelope {
  readonly hydrationId: ChatSemanticHydrationId;
  readonly snapshot: ChatSemanticIndexSnapshot;
  readonly importedAt: UnixMs | number;
  readonly importedBy: string;
  readonly migrationNotes: readonly string[];
  readonly manifestVersion: string;
}

export interface ChatSemanticRecoveryEnvelope {
  readonly envelopeId: ChatSemanticRecoveryEnvelopeId;
  readonly roomScopeId?: ChatSemanticRoomScopeId;
  readonly channelScopeId?: ChatSemanticChannelScopeId;
  readonly snapshotVersion: string;
  readonly restoredAt: UnixMs | number;
  readonly restoredDocumentCount: number;
  readonly warnings: readonly string[];
}

export interface ChatSemanticMigrationPlan {
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly requiredTransforms: readonly string[];
  readonly optionalTransforms: readonly string[];
  readonly blockingIssues: readonly string[];
}

// ============================================================================
// MARK: Training, telemetry, audit, and export contracts
// ============================================================================

export interface ChatSemanticTrainingRow {
  readonly rowId: string;
  readonly candidateDocumentId: string;
  readonly nearestNeighborId: string;
  readonly similarity01: Score01;
  readonly noveltyScore01: Score01;
  readonly fatigueScore01: Score01;
  readonly allowed: boolean;
  readonly blockedReasons: readonly string[];
  readonly pressureBand: ChatSemanticPressureBand | undefined;
  readonly modeScope: ChatSemanticModeScope | undefined;
  readonly channelId: ChatChannelId | undefined;
  readonly tickNumber: number | undefined;
  readonly actorClass: ChatSemanticActorClass | undefined;
  readonly rhetoricalForm: ChatSemanticRhetoricalForm | undefined;
  readonly capturedAt: UnixMs | number;
}

export interface ChatSemanticTelemetryRecord {
  readonly telemetryId: string;
  readonly eventType:
    | 'DOCUMENT_INDEXED'
    | 'NOVELTY_GUARD_ALLOWED'
    | 'NOVELTY_GUARD_BLOCKED'
    | 'QUERY_EXECUTED'
    | 'SNAPSHOT_CREATED'
    | 'HYDRATION_COMPLETED'
    | 'BATCH_INDEXED'
    | 'ACTOR_SLOT_CREATED'
    | 'CLUSTER_EVICTED'
    | 'DECAY_APPLIED'
    | 'CHANNEL_POLICY_RESOLVED'
    | 'MODE_POLICY_RESOLVED'
    | 'TRAINING_ROW_EMITTED'
    | 'RECOVERY_ENVELOPE_CREATED';
  readonly documentId?: string;
  readonly clusterId?: string;
  readonly actorId?: string;
  readonly noveltyScore01?: Score01;
  readonly fatigueScore01?: Score01;
  readonly pressureBand?: ChatSemanticPressureBand;
  readonly modeScope?: ChatSemanticModeScope;
  readonly channelId?: ChatChannelId;
  readonly durationMs?: number;
  readonly capturedAt: UnixMs | number;
}

export interface ChatSemanticAuditReceipt {
  readonly auditId: ChatSemanticAuditId;
  readonly action:
    | 'INDEX'
    | 'QUERY'
    | 'GUARD'
    | 'SNAPSHOT'
    | 'HYDRATE'
    | 'EXPORT'
    | 'RECOVER';
  readonly success: boolean;
  readonly notes: readonly string[];
  readonly receiptHashInput: readonly string[];
  readonly createdAt: UnixMs | number;
}

export interface ChatSemanticExportManifest {
  readonly manifestId: ChatSemanticManifestId;
  readonly createdAt: UnixMs | number;
  readonly documentCount: number;
  readonly clusterCount: number;
  readonly actorSlotCount: number;
  readonly federationSlotCount: number;
  readonly trainingRowCount: number;
  readonly telemetryRecordCount: number;
  readonly snapshotVersion: string;
  readonly contractVersion: string;
}

// ============================================================================
// MARK: Deterministic helper utilities
// ============================================================================

export function clamp01(value: number): Score01 {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return 0 as Score01;
  }
  if (value <= 0) return 0 as Score01;
  if (value >= 1) return 1 as Score01;
  return value as Score01;
}

export function isChatSemanticRhetoricalForm(
  value: string,
): value is ChatSemanticRhetoricalForm {
  return (CHAT_SEMANTIC_RHETORICAL_FORMS as readonly string[]).includes(value);
}

export function isChatSemanticPressureBand(
  value: string,
): value is ChatSemanticPressureBand {
  return (CHAT_SEMANTIC_PRESSURE_BANDS as readonly string[]).includes(value);
}

export function isChatSemanticModeScope(
  value: string,
): value is ChatSemanticModeScope {
  return (CHAT_SEMANTIC_MODE_SCOPES as readonly string[]).includes(value);
}

export function isChatSemanticActorClass(
  value: string,
): value is ChatSemanticActorClass {
  return (CHAT_SEMANTIC_ACTOR_CLASSES as readonly string[]).includes(value);
}

export function isChatSemanticSourceKind(
  value: string,
): value is ChatSemanticSourceKind {
  return (CHAT_SEMANTIC_SOURCE_KINDS as readonly string[]).includes(value);
}

export function isChatSemanticDecisionStance(
  value: string,
): value is ChatSemanticDecisionStance {
  return (CHAT_SEMANTIC_DECISION_STANCES as readonly string[]).includes(value);
}

export function resolvePressureThresholds(
  band: ChatSemanticPressureBand | undefined,
): ChatSemanticPressureThresholds {
  if (!band || !(band in CHAT_SEMANTIC_PRESSURE_THRESHOLDS)) {
    return CHAT_SEMANTIC_PRESSURE_THRESHOLDS.ELEVATED;
  }
  return CHAT_SEMANTIC_PRESSURE_THRESHOLDS[band];
}

export function resolveModePolicy(
  modeScope: ChatSemanticModeScope | undefined,
): ChatSemanticModePolicy {
  if (!modeScope || !(modeScope in CHAT_SEMANTIC_MODE_POLICIES)) {
    return CHAT_SEMANTIC_MODE_POLICIES.GO_ALONE;
  }
  return CHAT_SEMANTIC_MODE_POLICIES[modeScope];
}

export function resolveChannelPolicy(
  channelId: ChatChannelId | undefined,
): ChatSemanticChannelPolicy {
  if (!channelId || !(channelId in CHAT_SEMANTIC_CHANNEL_POLICIES)) {
    return CHAT_SEMANTIC_CHANNEL_POLICIES.GLOBAL;
  }
  return CHAT_SEMANTIC_CHANNEL_POLICIES[channelId];
}

export function resolveActorClassPolicy(
  actorClass: ChatSemanticActorClass | undefined,
): ChatSemanticActorClassPolicy {
  if (!actorClass || !(actorClass in CHAT_SEMANTIC_ACTOR_CLASS_POLICIES)) {
    return CHAT_SEMANTIC_ACTOR_CLASS_POLICIES.UNKNOWN;
  }
  return CHAT_SEMANTIC_ACTOR_CLASS_POLICIES[actorClass];
}

export function resolveRhetoricalDescriptor(
  form: ChatSemanticRhetoricalForm | undefined,
): ChatSemanticRhetoricalDescriptor {
  if (!form || !(form in CHAT_SEMANTIC_RHETORICAL_DESCRIPTORS)) {
    return CHAT_SEMANTIC_RHETORICAL_DESCRIPTORS.UNKNOWN;
  }
  return CHAT_SEMANTIC_RHETORICAL_DESCRIPTORS[form];
}

export function mergeNoveltyGuardConfig(
  override: Partial<ChatSemanticNoveltyGuardConfig> | undefined,
): ChatSemanticNoveltyGuardConfig {
  return Object.freeze({
    ...DEFAULT_CHAT_SEMANTIC_NOVELTY_GUARD,
    ...override,
  });
}

export function createDefaultDocumentFlags(
  partial: Partial<ChatSemanticDocumentFlags> | undefined,
  channelId: ChatChannelId | undefined,
  sourceKind: ChatSemanticSourceKind | undefined,
  rhetoricalForm: ChatSemanticRhetoricalForm | undefined,
): ChatSemanticDocumentFlags {
  const isShadowChannel =
    typeof channelId === 'string' && channelId.endsWith('_SHADOW');
  const resolvedForm = rhetoricalForm ?? 'UNKNOWN';
  const resolvedSource = sourceKind ?? 'AUTHORED_CANONICAL';
  return Object.freeze({
    isShadowChannel,
    isSystemAuthored:
      resolvedSource === 'SYSTEM_GENERATED' ||
      resolvedSource === 'PROOF_CHAIN_ATTESTATION',
    isCallbackCandidate:
      resolvedForm === 'CALLBACK_WOUND' ||
      resolvedForm === 'ARCHIVIST_RECORD' ||
      resolvedForm === 'MARKET_WITNESS_NOTE',
    isNegotiationCritical:
      resolvedForm === 'LEVERAGE_CLAIM' ||
      resolvedForm === 'OFFER_FRAME' ||
      resolvedForm === 'COUNTER_PROBE' ||
      resolvedForm === 'BLUFF_DEPLOY' ||
      resolvedForm === 'SILENCE_WEAPON',
    isProofBearing:
      resolvedForm === 'PROOF_STAMP' ||
      resolvedSource === 'PROOF_CHAIN_ATTESTATION',
    isLiveopsInjected: resolvedSource === 'LIVEOPS_OVERLAY',
    isRescueEligible:
      resolvedForm === 'RESCUE_STABILIZER' ||
      resolvedForm === 'TACTICAL_REDIRECT' ||
      resolvedForm === 'SURVIVOR_TESTIMONY' ||
      resolvedForm === 'MENTOR_ANCHOR',
    isWitnessLine:
      resolvedForm === 'WITNESS_JUDGMENT' ||
      resolvedForm === 'HUMILIATION_RECEIPT' ||
      resolvedForm === 'CROWD_REACTION' ||
      resolvedForm === 'MARKET_WITNESS_NOTE',
    isSilenceMove:
      resolvedForm === 'SILENCE_MARKER' ||
      resolvedForm === 'SILENCE_WEAPON',
    isCrowdTexture:
      resolvedForm === 'CROWD_REACTION' ||
      resolvedForm === 'LOBBY_RUMOR' ||
      resolvedForm === 'MARKET_WITNESS_NOTE',
    ...partial,
  });
}

export function createDefaultProvenance(
  provenance: ChatSemanticProvenance | undefined,
): Readonly<ChatSemanticProvenance> {
  return Object.freeze({
    sourceKind: provenance?.sourceKind ?? 'AUTHORED_CANONICAL',
    sourcePath: provenance?.sourcePath,
    sourceVersion: provenance?.sourceVersion,
    sourceAuthority: provenance?.sourceAuthority,
    createdByRuntime: provenance?.createdByRuntime,
    migrationTag: provenance?.migrationTag,
    lineOriginNote: provenance?.lineOriginNote,
  });
}

export function deriveRhetoricalFamily(
  form: ChatSemanticRhetoricalForm,
): ChatSemanticRhetoricalFamily {
  return resolveRhetoricalDescriptor(form).family;
}

export function deriveDecisionStance(
  form: ChatSemanticRhetoricalForm,
): ChatSemanticDecisionStance {
  switch (resolveRhetoricalDescriptor(form).family) {
    case 'HOSTILITY':
      return 'HOSTILE';
    case 'WEIGHT':
      return 'WITNESSING';
    case 'HELPER':
      return 'STABILIZING';
    case 'AMBIENT':
      return 'WITNESSING';
    case 'SYSTEM':
      return 'SYSTEMIC';
    case 'NEGOTIATION':
      return 'PROBING';
    default:
      return 'AMBIGUOUS';
  }
}

export function computeEffectiveSimilarityCap(
  pressureBand: ChatSemanticPressureBand | undefined,
  modeScope: ChatSemanticModeScope | undefined,
  channelId: ChatChannelId | undefined,
  config: Partial<ChatSemanticNoveltyGuardConfig> | undefined,
): Score01 {
  const thresholds = resolvePressureThresholds(pressureBand);
  const modePolicy = resolveModePolicy(modeScope);
  const channelPolicy = resolveChannelPolicy(channelId);
  const merged = mergeNoveltyGuardConfig(config);

  const relaxed =
    Number(thresholds.maxSimilarityToRecent01) +
    Number(thresholds.witnessRelaxation01) +
    Number(modePolicy.witnessRoomRelaxation01) +
    Number(channelPolicy.callbackPrivilege01) * 0.10;

  const tightened =
    relaxed
    - Number(modePolicy.negotiationDriftPenalty01)
    - Number(merged.negotiationDriftPenalty01) *
        Number(channelPolicy.negotiationWeight01);

  const bounded = Math.min(
    Number(merged.maxSimilarityToRecent01),
    Math.max(0.05, tightened),
  );

  return clamp01(bounded);
}

export function computeExactRepeatPenalty(
  candidate: ChatSemanticIndexedDocument | ChatSemanticDocumentInput,
  channelId: ChatChannelId | undefined,
  config: Partial<ChatSemanticNoveltyGuardConfig> | undefined,
): Score01 {
  const merged = mergeNoveltyGuardConfig(config);
  const resolvedChannel = channelId ?? candidate.channelId;
  const channelPolicy = resolveChannelPolicy(resolvedChannel);
  const base = Number(merged.exactTextPenalty01);
  const lowered =
    base
    - Number(channelPolicy.callbackPrivilege01) * 0.08
    - Number(channelPolicy.silenceTolerance01) * 0.03;
  return clamp01(lowered);
}

export function createSemanticQueryId(
  seed: string,
): ChatSemanticQueryId {
  return `semantic-query:${seed}` as ChatSemanticQueryId;
}

export function createSemanticRequestId(
  seed: string,
): ChatSemanticRequestId {
  return `semantic-request:${seed}` as ChatSemanticRequestId;
}

export function createSemanticClusterId(
  seed: string,
): ChatSemanticClusterId {
  return `semantic-cluster:${seed}` as ChatSemanticClusterId;
}

export function createSemanticDocumentId(
  seed: string,
): ChatSemanticDocumentId {
  return `semantic-document:${seed}` as ChatSemanticDocumentId;
}

// ============================================================================
// MARK: Deterministic rhetorical cue inspection helpers
// ============================================================================

export interface ChatSemanticCueMatch {
  readonly rhetoricalForm: ChatSemanticRhetoricalForm;
  readonly score01: Score01;
  readonly matchedCues: readonly string[];
  readonly matchedPatternIds: readonly ChatSemanticPatternId[];
  readonly notes: readonly string[];
}

export function normalizeSemanticText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9\s'\-.,!?#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeSemanticText(value: string): string[] {
  return normalizeSemanticText(value)
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export function inferLineRhetoricalForm(
  text: string,
  hints?: {
    readonly channelId?: ChatChannelId;
    readonly actorClass?: ChatSemanticActorClass;
    readonly sourceKind?: ChatSemanticSourceKind;
  },
): ChatSemanticRhetoricalForm {
  const normalized = normalizeSemanticText(text);
  const matches = scoreCuePatterns(normalized, hints);
  if (matches.length === 0) {
    if (normalized === '...' || normalized === '.' || normalized === '—') {
      return hints?.channelId === 'DEAL_ROOM'
        ? 'SILENCE_WEAPON'
        : 'SILENCE_MARKER';
    }
    if (hints?.sourceKind === 'LIVEOPS_OVERLAY') {
      return 'LIVEOPS_SIGNAL';
    }
    if (hints?.sourceKind === 'PROOF_CHAIN_ATTESTATION') {
      return 'PROOF_STAMP';
    }
    return 'UNKNOWN';
  }
  return matches[0].rhetoricalForm;
}

export function scoreCuePatterns(
  normalizedText: string,
  hints?: {
    readonly channelId?: ChatChannelId;
    readonly actorClass?: ChatSemanticActorClass;
    readonly sourceKind?: ChatSemanticSourceKind;
  },
): readonly ChatSemanticCueMatch[] {
  const text = normalizeSemanticText(normalizedText);
  const out: ChatSemanticCueMatch[] = [];
  for (const pattern of CHAT_SEMANTIC_CUE_PATTERNS) {
    let score = 0;
    const matchedCues: string[] = [];
    const notes: string[] = [];
    for (const cue of pattern.literalCues) {
      if (cue.length === 0) continue;
      if (text.includes(cue)) {
        score +=
          Number(pattern.scoreBoost01) /
          Math.max(1, pattern.literalCues.length);
        matchedCues.push(cue);
      }
    }
    if (
      pattern.prefersLineStart &&
      matchedCues.some((cue) => text.startsWith(cue))
    ) {
      score += 0.08;
      notes.push('line-start-cue');
    }
    if (pattern.prefersQuestionShape && text.includes('?')) {
      score += 0.06;
      notes.push('question-shape');
    }
    if (pattern.requiresNegotiationContext && hints?.channelId === 'DEAL_ROOM') {
      score += 0.08;
      notes.push('deal-room-context');
    }
    if (pattern.requiresWitnessContext && hints?.channelId === 'GLOBAL') {
      score += 0.06;
      notes.push('global-witness-context');
    }
    const actorPolicy = resolveActorClassPolicy(hints?.actorClass);
    const descriptor = resolveRhetoricalDescriptor(pattern.rhetoricalForm);
    if (actorPolicy.preferredFamilies.includes(descriptor.family)) {
      score += 0.05;
      notes.push('actor-class-family-alignment');
    }
    if (
      hints?.sourceKind === 'LIVEOPS_OVERLAY' &&
      pattern.rhetoricalForm === 'LIVEOPS_SIGNAL'
    ) {
      score += 0.10;
      notes.push('liveops-source-alignment');
    }
    if (
      hints?.sourceKind === 'PROOF_CHAIN_ATTESTATION' &&
      pattern.rhetoricalForm === 'PROOF_STAMP'
    ) {
      score += 0.10;
      notes.push('proof-source-alignment');
    }
    if (score > 0) {
      out.push({
        rhetoricalForm: pattern.rhetoricalForm,
        score01: clamp01(score),
        matchedCues: Object.freeze(matchedCues),
        matchedPatternIds: Object.freeze([pattern.patternId]),
        notes: Object.freeze(notes),
      });
    }
  }

  return Object.freeze(
    out.sort(
      (a, b) =>
        Number(b.score01) - Number(a.score01) ||
        Number(resolveRhetoricalDescriptor(b.rhetoricalForm).threatBias01) -
          Number(resolveRhetoricalDescriptor(a.rhetoricalForm).threatBias01),
    ),
  );
}

export function buildExplainabilityTermsForForm(
  form: ChatSemanticRhetoricalForm,
): readonly ChatSemanticExplainabilityTerm[] {
  const descriptor = resolveRhetoricalDescriptor(form);
  return Object.freeze([
    Object.freeze({
      signal: 'RHETORICAL_MATCH',
      label: `${descriptor.family.toLowerCase()}-form`,
      score01: descriptor.repetitionSensitivity01,
      supportingTokens: descriptor.lexemeCues,
      notes: Object.freeze([descriptor.summary]),
    }),
    Object.freeze({
      signal: descriptor.negotiationWeighted
        ? 'NEGOTIATION_SIGNAL'
        : descriptor.witnessWeighted
        ? 'WITNESS_SIGNAL'
        : descriptor.family === 'HELPER'
        ? 'RESCUE_SIGNAL'
        : 'TOKEN_OVERLAP',
      label: descriptor.defaultRegister.toLowerCase(),
      score01: descriptor.threatBias01,
      supportingTokens: descriptor.lexemeCues.slice(0, 3),
      notes: Object.freeze([
        `cadence:${descriptor.defaultCadence.toLowerCase()}`,
        `register:${descriptor.defaultRegister.toLowerCase()}`,
      ]),
    }),
  ]);
}

// ============================================================================
// MARK: Mode-by-channel semantic behavior matrix
// ============================================================================

export interface ChatSemanticModeChannelBehavior {
  readonly modeScope: ChatSemanticModeScope;
  readonly channelId: ChatChannelId;
  readonly preferredFamilies: readonly ChatSemanticRhetoricalFamily[];
  readonly discouragedFamilies: readonly ChatSemanticRhetoricalFamily[];
  readonly similarityCap01: Score01;
  readonly callbackPrivilege01: Score01;
  readonly rescueAllowance01: Score01;
  readonly crowdTextureAllowance01: Score01;
  readonly silenceAllowance01: Score01;
  readonly notes: readonly string[];
}

export const CHAT_SEMANTIC_MODE_CHANNEL_BEHAVIORS: readonly ChatSemanticModeChannelBehavior[] =
  Object.freeze([
    Object.freeze<ChatSemanticModeChannelBehavior>({
      modeScope: 'GO_ALONE',
      channelId: 'GLOBAL',
      preferredFamilies: Object.freeze(['HOSTILITY', 'WEIGHT', 'AMBIENT']),
      discouragedFamilies: Object.freeze(['NEGOTIATION']),
      similarityCap01: 0.64 as Score01,
      callbackPrivilege01: 0.40 as Score01,
      rescueAllowance01: 0.24 as Score01,
      crowdTextureAllowance01: 0.22 as Score01,
      silenceAllowance01: 0.12 as Score01,
      notes: Object.freeze(['single-player witness bias', 'allow pressure narration']),
    }),
    Object.freeze<ChatSemanticModeChannelBehavior>({
      modeScope: 'GO_ALONE',
      channelId: 'SYNDICATE',
      preferredFamilies: Object.freeze(['HELPER', 'WEIGHT']) as readonly ChatSemanticRhetoricalFamily[],
      discouragedFamilies: Object.freeze(['HOSTILITY']),
      similarityCap01: 0.60 as Score01,
      callbackPrivilege01: 0.56 as Score01,
      rescueAllowance01: 0.86 as Score01,
      crowdTextureAllowance01: 0.06 as Score01,
      silenceAllowance01: 0.18 as Score01,
      notes: Object.freeze(['support lane', 'private stabilizer']),
    }),
    Object.freeze<ChatSemanticModeChannelBehavior>({
      modeScope: 'GO_ALONE',
      channelId: 'DEAL_ROOM',
      preferredFamilies: Object.freeze(['NEGOTIATION', 'HOSTILITY']),
      discouragedFamilies: Object.freeze(['AMBIENT']),
      similarityCap01: 0.58 as Score01,
      callbackPrivilege01: 0.26 as Score01,
      rescueAllowance01: 0.08 as Score01,
      crowdTextureAllowance01: 0.02 as Score01,
      silenceAllowance01: 0.84 as Score01,
      notes: Object.freeze(['tight negotiation novelty', 'silence is strategic']),
    }),
    Object.freeze<ChatSemanticModeChannelBehavior>({
      modeScope: 'GO_ALONE',
      channelId: 'LOBBY',
      preferredFamilies: Object.freeze(['AMBIENT', 'WEIGHT']) as readonly ChatSemanticRhetoricalFamily[],
      discouragedFamilies: Object.freeze(['NEGOTIATION']),
      similarityCap01: 0.66 as Score01,
      callbackPrivilege01: 0.28 as Score01,
      rescueAllowance01: 0.20 as Score01,
      crowdTextureAllowance01: 0.88 as Score01,
      silenceAllowance01: 0.10 as Score01,
      notes: Object.freeze(['ambient bustle', 'warmup witness field']),
    }),
    Object.freeze<ChatSemanticModeChannelBehavior>({
      modeScope: 'HEAD_TO_HEAD',
      channelId: 'GLOBAL',
      preferredFamilies: Object.freeze(['HOSTILITY', 'WEIGHT']),
      discouragedFamilies: Object.freeze(['HELPER']),
      similarityCap01: 0.56 as Score01,
      callbackPrivilege01: 0.34 as Score01,
      rescueAllowance01: 0.14 as Score01,
      crowdTextureAllowance01: 0.18 as Score01,
      silenceAllowance01: 0.10 as Score01,
      notes: Object.freeze(['public duel spectacle']),
    }),
    Object.freeze<ChatSemanticModeChannelBehavior>({
      modeScope: 'HEAD_TO_HEAD',
      channelId: 'SYNDICATE',
      preferredFamilies: Object.freeze(['HELPER', 'WEIGHT']) as readonly ChatSemanticRhetoricalFamily[],
      discouragedFamilies: Object.freeze(['AMBIENT']),
      similarityCap01: 0.58 as Score01,
      callbackPrivilege01: 0.52 as Score01,
      rescueAllowance01: 0.54 as Score01,
      crowdTextureAllowance01: 0.04 as Score01,
      silenceAllowance01: 0.12 as Score01,
      notes: Object.freeze(['selective helper intervention']),
    }),
    Object.freeze<ChatSemanticModeChannelBehavior>({
      modeScope: 'HEAD_TO_HEAD',
      channelId: 'DEAL_ROOM',
      preferredFamilies: Object.freeze(['NEGOTIATION', 'HOSTILITY', 'SYSTEM']),
      discouragedFamilies: Object.freeze(['AMBIENT']),
      similarityCap01: 0.50 as Score01,
      callbackPrivilege01: 0.20 as Score01,
      rescueAllowance01: 0.06 as Score01,
      crowdTextureAllowance01: 0.02 as Score01,
      silenceAllowance01: 0.90 as Score01,
      notes: Object.freeze(['hard anti-repetition', 'deal chamber pressure']),
    }),
    Object.freeze<ChatSemanticModeChannelBehavior>({
      modeScope: 'HEAD_TO_HEAD',
      channelId: 'LOBBY',
      preferredFamilies: Object.freeze(['AMBIENT', 'WEIGHT', 'HOSTILITY']),
      discouragedFamilies: Object.freeze(['NEGOTIATION']),
      similarityCap01: 0.62 as Score01,
      callbackPrivilege01: 0.24 as Score01,
      rescueAllowance01: 0.10 as Score01,
      crowdTextureAllowance01: 0.82 as Score01,
      silenceAllowance01: 0.08 as Score01,
      notes: Object.freeze(['hype but not crowd spam']),
    }),
    Object.freeze<ChatSemanticModeChannelBehavior>({
      modeScope: 'TEAM_UP',
      channelId: 'GLOBAL',
      preferredFamilies: Object.freeze(['AMBIENT', 'WEIGHT', 'HELPER']),
      discouragedFamilies: Object.freeze(['NEGOTIATION']),
      similarityCap01: 0.62 as Score01,
      callbackPrivilege01: 0.42 as Score01,
      rescueAllowance01: 0.30 as Score01,
      crowdTextureAllowance01: 0.28 as Score01,
      silenceAllowance01: 0.10 as Score01,
      notes: Object.freeze(['team witness with moderation']),
    }),
    Object.freeze<ChatSemanticModeChannelBehavior>({
      modeScope: 'TEAM_UP',
      channelId: 'SYNDICATE',
      preferredFamilies: Object.freeze(['HELPER', 'WEIGHT', 'NEGOTIATION']),
      discouragedFamilies: Object.freeze(['HOSTILITY']),
      similarityCap01: 0.64 as Score01,
      callbackPrivilege01: 0.68 as Score01,
      rescueAllowance01: 0.92 as Score01,
      crowdTextureAllowance01: 0.05 as Score01,
      silenceAllowance01: 0.14 as Score01,
      notes: Object.freeze(['trust architecture lane']),
    }),
    Object.freeze<ChatSemanticModeChannelBehavior>({
      modeScope: 'TEAM_UP',
      channelId: 'DEAL_ROOM',
      preferredFamilies: Object.freeze(['NEGOTIATION', 'HELPER']),
      discouragedFamilies: Object.freeze(['AMBIENT']),
      similarityCap01: 0.56 as Score01,
      callbackPrivilege01: 0.26 as Score01,
      rescueAllowance01: 0.16 as Score01,
      crowdTextureAllowance01: 0.02 as Score01,
      silenceAllowance01: 0.76 as Score01,
      notes: Object.freeze(['coordinated negotiation']),
    }),
    Object.freeze<ChatSemanticModeChannelBehavior>({
      modeScope: 'TEAM_UP',
      channelId: 'LOBBY',
      preferredFamilies: Object.freeze(['AMBIENT', 'HELPER']),
      discouragedFamilies: Object.freeze(['NEGOTIATION']),
      similarityCap01: 0.64 as Score01,
      callbackPrivilege01: 0.26 as Score01,
      rescueAllowance01: 0.20 as Score01,
      crowdTextureAllowance01: 0.90 as Score01,
      silenceAllowance01: 0.08 as Score01,
      notes: Object.freeze(['social preheat']),
    }),
    Object.freeze<ChatSemanticModeChannelBehavior>({
      modeScope: 'CHASE_A_LEGEND',
      channelId: 'GLOBAL',
      preferredFamilies: Object.freeze(['WEIGHT', 'AMBIENT', 'SYSTEM']),
      discouragedFamilies: Object.freeze(['HELPER']),
      similarityCap01: 0.54 as Score01,
      callbackPrivilege01: 0.36 as Score01,
      rescueAllowance01: 0.16 as Score01,
      crowdTextureAllowance01: 0.18 as Score01,
      silenceAllowance01: 0.18 as Score01,
      notes: Object.freeze(['ghost-aware witness layer']),
    }),
    Object.freeze<ChatSemanticModeChannelBehavior>({
      modeScope: 'CHASE_A_LEGEND',
      channelId: 'SYNDICATE',
      preferredFamilies: Object.freeze(['HELPER', 'SYSTEM', 'WEIGHT']),
      discouragedFamilies: Object.freeze(['AMBIENT']),
      similarityCap01: 0.58 as Score01,
      callbackPrivilege01: 0.50 as Score01,
      rescueAllowance01: 0.40 as Score01,
      crowdTextureAllowance01: 0.03 as Score01,
      silenceAllowance01: 0.18 as Score01,
      notes: Object.freeze(['quiet advisory lane']),
    }),
    Object.freeze<ChatSemanticModeChannelBehavior>({
      modeScope: 'CHASE_A_LEGEND',
      channelId: 'DEAL_ROOM',
      preferredFamilies: Object.freeze(['NEGOTIATION', 'SYSTEM']),
      discouragedFamilies: Object.freeze(['AMBIENT']),
      similarityCap01: 0.48 as Score01,
      callbackPrivilege01: 0.18 as Score01,
      rescueAllowance01: 0.04 as Score01,
      crowdTextureAllowance01: 0.02 as Score01,
      silenceAllowance01: 0.88 as Score01,
      notes: Object.freeze(['legend chase terms are sparse and sharp']),
    }),
    Object.freeze<ChatSemanticModeChannelBehavior>({
      modeScope: 'CHASE_A_LEGEND',
      channelId: 'LOBBY',
      preferredFamilies: Object.freeze(['AMBIENT', 'WEIGHT', 'SYSTEM']),
      discouragedFamilies: Object.freeze(['NEGOTIATION']),
      similarityCap01: 0.60 as Score01,
      callbackPrivilege01: 0.24 as Score01,
      rescueAllowance01: 0.10 as Score01,
      crowdTextureAllowance01: 0.76 as Score01,
      silenceAllowance01: 0.12 as Score01,
      notes: Object.freeze(['haunted warmup room']),
    }),
  ]);

export function findModeChannelBehavior(
  modeScope: ChatSemanticModeScope | undefined,
  channelId: ChatChannelId | undefined,
): ChatSemanticModeChannelBehavior | undefined {
  if (!modeScope || !channelId) return undefined;
  return CHAT_SEMANTIC_MODE_CHANNEL_BEHAVIORS.find(
    (entry) => entry.modeScope === modeScope && entry.channelId === channelId,
  );
}

// ============================================================================
// MARK: Explainability, scoring breakdowns, and diagnostics
// ============================================================================

export interface ChatSemanticSimilarityBreakdown {
  readonly tokenOverlap01: Score01;
  readonly bigramOverlap01: Score01;
  readonly charGramOverlap01: Score01;
  readonly rhetoricalMatch01: Score01;
  readonly clusterMatch01: Score01;
  readonly tagOverlap01: Score01;
  readonly motifOverlap01: Score01;
  readonly callbackOverlap01: Score01;
  readonly actorMatch01: Score01;
  readonly channelAlignment01: Score01;
  readonly modeAlignment01: Score01;
  readonly pressureAlignment01: Score01;
  readonly sourceKindAlignment01: Score01;
  readonly witnessShape01: Score01;
  readonly silenceShape01: Score01;
  readonly combinedSimilarity01: Score01;
}

export interface ChatSemanticDecisionBreakdown {
  readonly similarityCap01: Score01;
  readonly exactRepeatPenalty01: Score01;
  readonly clusterPenalty01: Score01;
  readonly rhetoricalPenalty01: Score01;
  readonly callbackBoost01: Score01;
  readonly witnessRelaxation01: Score01;
  readonly helperInterventionBoost01: Score01;
  readonly negotiationDriftPenalty01: Score01;
  readonly actorMonotonyPenalty01: Score01;
  readonly channelMonotonyPenalty01: Score01;
  readonly finalNoveltyScore01: Score01;
  readonly finalFatigueScore01: Score01;
}

export interface ChatSemanticDiagnosticReport {
  readonly reportId: ChatSemanticExplainabilityId;
  readonly createdAt: UnixMs | number;
  readonly queryId?: ChatSemanticQueryId;
  readonly requestId?: ChatSemanticRequestId;
  readonly candidateDocumentId?: ChatSemanticDocumentId;
  readonly topSignals: readonly ChatSemanticExplainabilityTerm[];
  readonly similarityBreakdowns?: readonly ChatSemanticSimilarityBreakdown[];
  readonly decisionBreakdown?: ChatSemanticDecisionBreakdown;
  readonly notes: readonly string[];
}

export interface ChatSemanticWindowDigest {
  readonly windowId: ChatSemanticWindowId;
  readonly channelId?: ChatChannelId;
  readonly modeScope?: ChatSemanticModeScope;
  readonly actorId?: string;
  readonly documentCount: number;
  readonly uniqueClusterCount: number;
  readonly uniqueRhetoricalFormCount: number;
  readonly uniqueActorCount: number;
  readonly witnessLineCount: number;
  readonly rescueLineCount: number;
  readonly negotiationLineCount: number;
  readonly proofLineCount: number;
  readonly silenceMoveCount: number;
  readonly createdAt: UnixMs | number;
}

// ============================================================================
// MARK: Public contract manifests
// ============================================================================

export const CHAT_SEMANTIC_POLICY_IDS = Object.freeze({
  noveltyGuardDefault:
    'semantic-policy:novelty-guard-default' as ChatSemanticPolicyId,
  decayCurveDefault:
    'semantic-policy:decay-curve-default' as ChatSemanticPolicyId,
  vectorizationDefault:
    'semantic-policy:vectorization-default' as ChatSemanticPolicyId,
  similarityWeightsDefault:
    'semantic-policy:similarity-weights-default' as ChatSemanticPolicyId,
});

export const CHAT_SEMANTIC_CUE_BANK_IDS = Object.freeze({
  rhetoricalForms:
    'semantic-cue-bank:rhetorical-forms' as ChatSemanticCueBankId,
  dictionary:
    'semantic-cue-bank:dictionary' as ChatSemanticCueBankId,
  narrativeRoles:
    'semantic-cue-bank:narrative-roles' as ChatSemanticCueBankId,
});

export const CHAT_SEMANTIC_SIMILARITY_CONTRACT = Object.freeze({
  version: CHAT_SEMANTIC_SIMILARITY_CONTRACT_VERSION,
  publicApiVersion: CHAT_SEMANTIC_SIMILARITY_PUBLIC_API_VERSION,
  authority: CHAT_SEMANTIC_SIMILARITY_CONTRACT_AUTHORITY,
  rhetoricalForms: CHAT_SEMANTIC_RHETORICAL_FORMS,
  rhetoricalDescriptors: CHAT_SEMANTIC_RHETORICAL_DESCRIPTORS,
  cuePatterns: CHAT_SEMANTIC_CUE_PATTERNS,
  modeScopes: CHAT_SEMANTIC_MODE_SCOPES,
  pressureBands: CHAT_SEMANTIC_PRESSURE_BANDS,
  sourceKinds: CHAT_SEMANTIC_SOURCE_KINDS,
  actorClasses: CHAT_SEMANTIC_ACTOR_CLASSES,
  queryStrategies: CHAT_SEMANTIC_QUERY_STRATEGIES,
  explainabilitySignals: CHAT_SEMANTIC_EXPLAINABILITY_SIGNALS,
  pressureThresholds: CHAT_SEMANTIC_PRESSURE_THRESHOLDS,
  modePolicies: CHAT_SEMANTIC_MODE_POLICIES,
  channelPolicies: CHAT_SEMANTIC_CHANNEL_POLICIES,
  actorClassPolicies: CHAT_SEMANTIC_ACTOR_CLASS_POLICIES,
  modeChannelBehaviors: CHAT_SEMANTIC_MODE_CHANNEL_BEHAVIORS,
  narrativeRoles: CHAT_SEMANTIC_NARRATIVE_ROLES,
  dictionaryTerms: CHAT_SEMANTIC_DICTIONARY_TERMS,
  defaultNoveltyGuard: DEFAULT_CHAT_SEMANTIC_NOVELTY_GUARD,
  defaultDecayCurve: DEFAULT_CHAT_SEMANTIC_DECAY_CURVE,
  defaultStopwordPolicy: DEFAULT_CHAT_SEMANTIC_STOPWORD_POLICY,
  defaultVectorizationConfig: DEFAULT_CHAT_SEMANTIC_VECTORIZATION_CONFIG,
  defaultSimilarityWeights: DEFAULT_CHAT_SEMANTIC_SIMILARITY_WEIGHTS,
  federationScopes: CHAT_SEMANTIC_FEDERATION_SCOPES,
  policyIds: CHAT_SEMANTIC_POLICY_IDS,
  cueBankIds: CHAT_SEMANTIC_CUE_BANK_IDS,
});

// ============================================================================
// MARK: Form-to-form interaction law surfaces
// ============================================================================

export interface ChatSemanticInteractionLaw {
  readonly sourceForm: ChatSemanticRhetoricalForm;
  readonly targetForm: ChatSemanticRhetoricalForm;
  readonly fatiguePenalty01: Score01;
  readonly noveltyCredit01: Score01;
  readonly notes: readonly string[];
}

export const CHAT_SEMANTIC_INTERACTION_LAWS: readonly ChatSemanticInteractionLaw[] =
  Object.freeze([
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'THREAT_DECLARATIVE',
      targetForm: 'THREAT_DECLARATIVE',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'THREAT_DECLARATIVE',
      targetForm: 'OFFER_FRAME',
      fatiguePenalty01: 0.04 as Score01,
      noveltyCredit01: 0.12 as Score01,
      notes: Object.freeze(['negotiation escalation sequence']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'THREAT_DECLARATIVE',
      targetForm: 'COUNTER_PROBE',
      fatiguePenalty01: 0.04 as Score01,
      noveltyCredit01: 0.12 as Score01,
      notes: Object.freeze(['negotiation escalation sequence']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'THREAT_DECLARATIVE',
      targetForm: 'SILENCE_WEAPON',
      fatiguePenalty01: 0.04 as Score01,
      noveltyCredit01: 0.12 as Score01,
      notes: Object.freeze(['negotiation escalation sequence']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'REPRICING_DECLARATIVE',
      targetForm: 'REPRICING_DECLARATIVE',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'PROCEDURAL_DELAY',
      targetForm: 'PROCEDURAL_DELAY',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'PREDICTIVE_PROFILE',
      targetForm: 'PREDICTIVE_PROFILE',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'SYSTEMIC_INEVITABILITY',
      targetForm: 'SYSTEMIC_INEVITABILITY',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'STRUCTURAL_ASYMMETRY',
      targetForm: 'STRUCTURAL_ASYMMETRY',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'SURVEILLANCE_SIGNAL',
      targetForm: 'SURVEILLANCE_SIGNAL',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'EXTRACTION_NOTICE',
      targetForm: 'EXTRACTION_NOTICE',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'BLUFF_EXPOSURE',
      targetForm: 'BLUFF_EXPOSURE',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'BLUFF_EXPOSURE',
      targetForm: 'OFFER_FRAME',
      fatiguePenalty01: 0.04 as Score01,
      noveltyCredit01: 0.12 as Score01,
      notes: Object.freeze(['negotiation escalation sequence']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'BLUFF_EXPOSURE',
      targetForm: 'COUNTER_PROBE',
      fatiguePenalty01: 0.04 as Score01,
      noveltyCredit01: 0.12 as Score01,
      notes: Object.freeze(['negotiation escalation sequence']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'BLUFF_EXPOSURE',
      targetForm: 'SILENCE_WEAPON',
      fatiguePenalty01: 0.04 as Score01,
      noveltyCredit01: 0.12 as Score01,
      notes: Object.freeze(['negotiation escalation sequence']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'CALLBACK_WOUND',
      targetForm: 'CALLBACK_WOUND',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'WITNESS_JUDGMENT',
      targetForm: 'WITNESS_JUDGMENT',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'HUMILIATION_RECEIPT',
      targetForm: 'HUMILIATION_RECEIPT',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'RIVALRY_PRESSURE',
      targetForm: 'RIVALRY_PRESSURE',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'RESCUE_STABILIZER',
      targetForm: 'THREAT_DECLARATIVE',
      fatiguePenalty01: 0.02 as Score01,
      noveltyCredit01: 0.18 as Score01,
      notes: Object.freeze(['rescue breaks hostility loop']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'RESCUE_STABILIZER',
      targetForm: 'BLUFF_EXPOSURE',
      fatiguePenalty01: 0.02 as Score01,
      noveltyCredit01: 0.18 as Score01,
      notes: Object.freeze(['rescue breaks hostility loop']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'RESCUE_STABILIZER',
      targetForm: 'HUMILIATION_RECEIPT',
      fatiguePenalty01: 0.02 as Score01,
      noveltyCredit01: 0.18 as Score01,
      notes: Object.freeze(['rescue breaks hostility loop']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'RESCUE_STABILIZER',
      targetForm: 'RESCUE_STABILIZER',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'TACTICAL_REDIRECT',
      targetForm: 'THREAT_DECLARATIVE',
      fatiguePenalty01: 0.02 as Score01,
      noveltyCredit01: 0.18 as Score01,
      notes: Object.freeze(['rescue breaks hostility loop']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'TACTICAL_REDIRECT',
      targetForm: 'BLUFF_EXPOSURE',
      fatiguePenalty01: 0.02 as Score01,
      noveltyCredit01: 0.18 as Score01,
      notes: Object.freeze(['rescue breaks hostility loop']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'TACTICAL_REDIRECT',
      targetForm: 'HUMILIATION_RECEIPT',
      fatiguePenalty01: 0.02 as Score01,
      noveltyCredit01: 0.18 as Score01,
      notes: Object.freeze(['rescue breaks hostility loop']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'TACTICAL_REDIRECT',
      targetForm: 'TACTICAL_REDIRECT',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'SURVIVOR_TESTIMONY',
      targetForm: 'SURVIVOR_TESTIMONY',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'INSIDER_SIGNAL',
      targetForm: 'INSIDER_SIGNAL',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'ARCHIVIST_RECORD',
      targetForm: 'ARCHIVIST_RECORD',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'MENTOR_ANCHOR',
      targetForm: 'THREAT_DECLARATIVE',
      fatiguePenalty01: 0.02 as Score01,
      noveltyCredit01: 0.18 as Score01,
      notes: Object.freeze(['rescue breaks hostility loop']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'MENTOR_ANCHOR',
      targetForm: 'BLUFF_EXPOSURE',
      fatiguePenalty01: 0.02 as Score01,
      noveltyCredit01: 0.18 as Score01,
      notes: Object.freeze(['rescue breaks hostility loop']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'MENTOR_ANCHOR',
      targetForm: 'HUMILIATION_RECEIPT',
      fatiguePenalty01: 0.02 as Score01,
      noveltyCredit01: 0.18 as Score01,
      notes: Object.freeze(['rescue breaks hostility loop']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'MENTOR_ANCHOR',
      targetForm: 'MENTOR_ANCHOR',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'RIVAL_DARE',
      targetForm: 'RIVAL_DARE',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'CROWD_REACTION',
      targetForm: 'WITNESS_JUDGMENT',
      fatiguePenalty01: 0.03 as Score01,
      noveltyCredit01: 0.10 as Score01,
      notes: Object.freeze(['witness layering allowed']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'CROWD_REACTION',
      targetForm: 'HUMILIATION_RECEIPT',
      fatiguePenalty01: 0.03 as Score01,
      noveltyCredit01: 0.10 as Score01,
      notes: Object.freeze(['witness layering allowed']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'CROWD_REACTION',
      targetForm: 'RIVALRY_PRESSURE',
      fatiguePenalty01: 0.03 as Score01,
      noveltyCredit01: 0.10 as Score01,
      notes: Object.freeze(['witness layering allowed']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'CROWD_REACTION',
      targetForm: 'CROWD_REACTION',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'DEAL_ROOM_LOG',
      targetForm: 'DEAL_ROOM_LOG',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'LOBBY_RUMOR',
      targetForm: 'WITNESS_JUDGMENT',
      fatiguePenalty01: 0.03 as Score01,
      noveltyCredit01: 0.10 as Score01,
      notes: Object.freeze(['witness layering allowed']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'LOBBY_RUMOR',
      targetForm: 'HUMILIATION_RECEIPT',
      fatiguePenalty01: 0.03 as Score01,
      noveltyCredit01: 0.10 as Score01,
      notes: Object.freeze(['witness layering allowed']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'LOBBY_RUMOR',
      targetForm: 'RIVALRY_PRESSURE',
      fatiguePenalty01: 0.03 as Score01,
      noveltyCredit01: 0.10 as Score01,
      notes: Object.freeze(['witness layering allowed']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'LOBBY_RUMOR',
      targetForm: 'LOBBY_RUMOR',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'MARKET_WITNESS_NOTE',
      targetForm: 'WITNESS_JUDGMENT',
      fatiguePenalty01: 0.03 as Score01,
      noveltyCredit01: 0.10 as Score01,
      notes: Object.freeze(['witness layering allowed']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'MARKET_WITNESS_NOTE',
      targetForm: 'HUMILIATION_RECEIPT',
      fatiguePenalty01: 0.03 as Score01,
      noveltyCredit01: 0.10 as Score01,
      notes: Object.freeze(['witness layering allowed']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'MARKET_WITNESS_NOTE',
      targetForm: 'RIVALRY_PRESSURE',
      fatiguePenalty01: 0.03 as Score01,
      noveltyCredit01: 0.10 as Score01,
      notes: Object.freeze(['witness layering allowed']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'MARKET_WITNESS_NOTE',
      targetForm: 'MARKET_WITNESS_NOTE',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'SILENCE_MARKER',
      targetForm: 'SILENCE_MARKER',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'SYSTEM_NOTICE',
      targetForm: 'SYSTEM_NOTICE',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'PROOF_STAMP',
      targetForm: 'PROOF_STAMP',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'LIVEOPS_SIGNAL',
      targetForm: 'LIVEOPS_SIGNAL',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'LEVERAGE_CLAIM',
      targetForm: 'LEVERAGE_CLAIM',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'LEVERAGE_CLAIM',
      targetForm: 'OFFER_FRAME',
      fatiguePenalty01: 0.04 as Score01,
      noveltyCredit01: 0.12 as Score01,
      notes: Object.freeze(['negotiation escalation sequence']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'LEVERAGE_CLAIM',
      targetForm: 'COUNTER_PROBE',
      fatiguePenalty01: 0.04 as Score01,
      noveltyCredit01: 0.12 as Score01,
      notes: Object.freeze(['negotiation escalation sequence']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'LEVERAGE_CLAIM',
      targetForm: 'SILENCE_WEAPON',
      fatiguePenalty01: 0.04 as Score01,
      noveltyCredit01: 0.12 as Score01,
      notes: Object.freeze(['negotiation escalation sequence']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'OFFER_FRAME',
      targetForm: 'OFFER_FRAME',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'COUNTER_PROBE',
      targetForm: 'COUNTER_PROBE',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'BLUFF_DEPLOY',
      targetForm: 'BLUFF_DEPLOY',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'SILENCE_WEAPON',
      targetForm: 'SILENCE_WEAPON',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
    Object.freeze<ChatSemanticInteractionLaw>({
      sourceForm: 'UNKNOWN',
      targetForm: 'UNKNOWN',
      fatiguePenalty01: 0.24 as Score01,
      noveltyCredit01: 0.00 as Score01,
      notes: Object.freeze(['same-form repetition']),
    }),
  ]);

export function findInteractionLaw(
  sourceForm: ChatSemanticRhetoricalForm,
  targetForm: ChatSemanticRhetoricalForm,
): ChatSemanticInteractionLaw | undefined {
  return CHAT_SEMANTIC_INTERACTION_LAWS.find(
    (law) => law.sourceForm === sourceForm && law.targetForm === targetForm,
  );
}

// ============================================================================
// MARK: Per-form runtime guidance profiles
// ============================================================================

export interface ChatSemanticRuntimeGuidanceProfile {
  readonly form: ChatSemanticRhetoricalForm;
  readonly defaultModeScopes: readonly ChatSemanticModeScope[];
  readonly defaultChannels: readonly ChatChannelId[];
  readonly preferredActorClasses: readonly ChatSemanticActorClass[];
  readonly preferredPressureBands: readonly ChatSemanticPressureBand[];
  readonly idealLengthBand: readonly [number, number];
  readonly callbackEligible: boolean;
  readonly proofEligible: boolean;
  readonly rescueEligible: boolean;
  readonly witnessEligible: boolean;
  readonly negotiationEligible: boolean;
  readonly notes: readonly string[];
}

export const CHAT_SEMANTIC_RUNTIME_GUIDANCE_PROFILES: readonly ChatSemanticRuntimeGuidanceProfile[] =
  Object.freeze([
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'THREAT_DECLARATIVE',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['GLOBAL', 'DEAL_ROOM']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['HATER']),
      preferredPressureBands: Object.freeze(['ELEVATED', 'HIGH', 'CRITICAL']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: false,
      negotiationEligible: false,
      notes: Object.freeze(['High-certainty threat or domination move.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'REPRICING_DECLARATIVE',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['GLOBAL', 'DEAL_ROOM']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['HATER']),
      preferredPressureBands: Object.freeze(['ELEVATED', 'HIGH', 'CRITICAL']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: false,
      negotiationEligible: false,
      notes: Object.freeze(['Frames the player as distressed inventory or collapsing value.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'PROCEDURAL_DELAY',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['GLOBAL', 'SYNDICATE']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['HATER']),
      preferredPressureBands: Object.freeze(['ELEVATED', 'HIGH', 'CRITICAL']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: false,
      negotiationEligible: false,
      notes: Object.freeze(['Weaponizes bureaucracy, review, waiting, or file friction.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'PREDICTIVE_PROFILE',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['GLOBAL', 'DEAL_ROOM']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['HATER']),
      preferredPressureBands: Object.freeze(['ELEVATED', 'HIGH', 'CRITICAL']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: false,
      negotiationEligible: false,
      notes: Object.freeze(["Claims foreknowledge of the player's next move or collapse path."]),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'SYSTEMIC_INEVITABILITY',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['GLOBAL', 'LOBBY']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['HATER']),
      preferredPressureBands: Object.freeze(['ELEVATED', 'HIGH', 'CRITICAL']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: false,
      negotiationEligible: false,
      notes: Object.freeze(['Macro-inevitability framing; the system always corrects.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'STRUCTURAL_ASYMMETRY',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['GLOBAL', 'SYNDICATE']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['HATER']),
      preferredPressureBands: Object.freeze(['ELEVATED', 'HIGH', 'CRITICAL']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: false,
      negotiationEligible: false,
      notes: Object.freeze(['Claims inherited or structural advantage over the player.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'SURVEILLANCE_SIGNAL',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['GLOBAL', 'LOBBY']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['HATER']),
      preferredPressureBands: Object.freeze(['ELEVATED', 'HIGH', 'CRITICAL']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: false,
      negotiationEligible: false,
      notes: Object.freeze(['Indicates the actor is watching, tracking, or observing.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'EXTRACTION_NOTICE',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['DEAL_ROOM', 'GLOBAL']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['HATER']),
      preferredPressureBands: Object.freeze(['ELEVATED', 'HIGH', 'CRITICAL']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: false,
      negotiationEligible: true,
      notes: Object.freeze(['Announces that value will be extracted or redirected.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'BLUFF_EXPOSURE',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['DEAL_ROOM', 'GLOBAL']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['HATER']),
      preferredPressureBands: Object.freeze(['ELEVATED', 'HIGH', 'CRITICAL']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: false,
      negotiationEligible: true,
      notes: Object.freeze(['Calls a bluff, false frame, or transparent trick.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'CALLBACK_WOUND',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['GLOBAL', 'SYNDICATE']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['HATER']),
      preferredPressureBands: Object.freeze(['ELEVATED', 'HIGH', 'CRITICAL']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: true,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: false,
      negotiationEligible: false,
      notes: Object.freeze(['Uses memory or prior failure as an emotional weapon.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'WITNESS_JUDGMENT',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['GLOBAL', 'LOBBY']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['AMBIENT']),
      preferredPressureBands: Object.freeze(['ELEVATED', 'HIGH', 'CRITICAL']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: true,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: true,
      negotiationEligible: false,
      notes: Object.freeze(['Public room judgment with spectator framing.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'HUMILIATION_RECEIPT',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['GLOBAL', 'LOBBY']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['AMBIENT']),
      preferredPressureBands: Object.freeze(['ELEVATED', 'HIGH', 'CRITICAL']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: true,
      negotiationEligible: false,
      notes: Object.freeze(['Transforms a failure into a future receipt.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'RIVALRY_PRESSURE',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['GLOBAL', 'SYNDICATE']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['HATER']),
      preferredPressureBands: Object.freeze(['ELEVATED', 'HIGH', 'CRITICAL']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: true,
      negotiationEligible: false,
      notes: Object.freeze(['Competitive heat, gap widening, or keep-up pressure.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'RESCUE_STABILIZER',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['SYNDICATE', 'GLOBAL']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['HELPER']),
      preferredPressureBands: Object.freeze(['CALM', 'BUILDING', 'ELEVATED']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: true,
      witnessEligible: false,
      negotiationEligible: false,
      notes: Object.freeze(['Stabilizing helper line that slows panic and narrows choice.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'TACTICAL_REDIRECT',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['SYNDICATE', 'DEAL_ROOM']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['HELPER']),
      preferredPressureBands: Object.freeze(['CALM', 'BUILDING', 'ELEVATED']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: true,
      witnessEligible: false,
      negotiationEligible: false,
      notes: Object.freeze(['Reorients toward a more tactical line of play.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'SURVIVOR_TESTIMONY',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['SYNDICATE', 'GLOBAL']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['HELPER']),
      preferredPressureBands: Object.freeze(['CALM', 'BUILDING', 'ELEVATED']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: true,
      proofEligible: false,
      rescueEligible: true,
      witnessEligible: false,
      negotiationEligible: false,
      notes: Object.freeze(['Personal survival story as proof of possibility.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'INSIDER_SIGNAL',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['SYNDICATE', 'DEAL_ROOM']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['HELPER']),
      preferredPressureBands: Object.freeze(['CALM', 'BUILDING', 'ELEVATED']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: true,
      witnessEligible: false,
      negotiationEligible: false,
      notes: Object.freeze(['Reveals hidden mechanic, asymmetry, or timing edge.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'ARCHIVIST_RECORD',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['SYNDICATE', 'GLOBAL']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['HELPER']),
      preferredPressureBands: Object.freeze(['CALM', 'BUILDING', 'ELEVATED']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: true,
      proofEligible: false,
      rescueEligible: true,
      witnessEligible: false,
      negotiationEligible: false,
      notes: Object.freeze(['Cites data, archive, or precedent to ground a line.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'MENTOR_ANCHOR',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['SYNDICATE', 'GLOBAL']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['HELPER']),
      preferredPressureBands: Object.freeze(['CALM', 'BUILDING', 'ELEVATED']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: true,
      witnessEligible: false,
      negotiationEligible: false,
      notes: Object.freeze(['Returns attention to fundamentals and longer horizon.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'RIVAL_DARE',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['GLOBAL', 'SYNDICATE']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['HELPER']),
      preferredPressureBands: Object.freeze(['CALM', 'BUILDING', 'ELEVATED']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: true,
      witnessEligible: false,
      negotiationEligible: false,
      notes: Object.freeze(['Constructive competitive challenge from a rival/helper.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'CROWD_REACTION',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['GLOBAL', 'LOBBY']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['AMBIENT']),
      preferredPressureBands: Object.freeze(['CALM', 'BUILDING', 'ELEVATED']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: true,
      negotiationEligible: false,
      notes: Object.freeze(['Ambient crowd texture or floor reaction.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'DEAL_ROOM_LOG',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['DEAL_ROOM']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['SYSTEM']),
      preferredPressureBands: Object.freeze(['CALM', 'BUILDING', 'ELEVATED']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: false,
      negotiationEligible: true,
      notes: Object.freeze(['Ledger-like acknowledgement in negotiation space.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'LOBBY_RUMOR',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['LOBBY', 'GLOBAL']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['AMBIENT']),
      preferredPressureBands: Object.freeze(['CALM', 'BUILDING', 'ELEVATED']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: false,
      negotiationEligible: false,
      notes: Object.freeze(['Speculative rumor, hearsay, or lobby whisper.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'MARKET_WITNESS_NOTE',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['GLOBAL', 'DEAL_ROOM']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['AMBIENT']),
      preferredPressureBands: Object.freeze(['CALM', 'BUILDING', 'ELEVATED']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: true,
      proofEligible: true,
      rescueEligible: false,
      witnessEligible: true,
      negotiationEligible: false,
      notes: Object.freeze(['Detached public record of what just happened.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'SILENCE_MARKER',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['GLOBAL', 'DEAL_ROOM']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['SYSTEM', 'LIVEOPS']),
      preferredPressureBands: Object.freeze(['ELEVATED', 'HIGH', 'CRITICAL']),
      idealLengthBand: Object.freeze([1, 6]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: false,
      negotiationEligible: false,
      notes: Object.freeze(['A small intentional pause, punctuation, or breath marker.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'SYSTEM_NOTICE',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['GLOBAL', 'SYSTEM_SHADOW']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['SYSTEM', 'LIVEOPS']),
      preferredPressureBands: Object.freeze(['ELEVATED', 'HIGH', 'CRITICAL']),
      idealLengthBand: Object.freeze([8, 48]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: true,
      rescueEligible: false,
      witnessEligible: false,
      negotiationEligible: false,
      notes: Object.freeze(['System-authored engine notice or state declaration.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'PROOF_STAMP',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['GLOBAL', 'SYSTEM_SHADOW']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['SYSTEM', 'LIVEOPS']),
      preferredPressureBands: Object.freeze(['ELEVATED', 'HIGH', 'CRITICAL']),
      idealLengthBand: Object.freeze([8, 48]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: true,
      rescueEligible: false,
      witnessEligible: false,
      negotiationEligible: false,
      notes: Object.freeze(['Proof-bearing, verification-flavored declaration.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'LIVEOPS_SIGNAL',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['GLOBAL', 'LIVEOPS_SHADOW']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['LIVEOPS']),
      preferredPressureBands: Object.freeze(['ELEVATED', 'HIGH', 'CRITICAL']),
      idealLengthBand: Object.freeze([8, 48]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: false,
      negotiationEligible: false,
      notes: Object.freeze(['Live operations overlay or seasonal activation line.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'LEVERAGE_CLAIM',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['DEAL_ROOM']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['HATER']),
      preferredPressureBands: Object.freeze(['ELEVATED', 'HIGH', 'CRITICAL']),
      idealLengthBand: Object.freeze([12, 72]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: false,
      negotiationEligible: true,
      notes: Object.freeze(['Negotiation position claim or power assertion.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'OFFER_FRAME',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['DEAL_ROOM']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['HATER']),
      preferredPressureBands: Object.freeze(['ELEVATED', 'HIGH', 'CRITICAL']),
      idealLengthBand: Object.freeze([12, 72]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: false,
      negotiationEligible: true,
      notes: Object.freeze(['Structures the shape and boundaries of an offer.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'COUNTER_PROBE',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['DEAL_ROOM']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['HATER']),
      preferredPressureBands: Object.freeze(['ELEVATED', 'HIGH', 'CRITICAL']),
      idealLengthBand: Object.freeze([12, 72]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: false,
      negotiationEligible: true,
      notes: Object.freeze(['Tests for intent, weakness, or hidden reservation point.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'BLUFF_DEPLOY',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['DEAL_ROOM']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['HATER']),
      preferredPressureBands: Object.freeze(['ELEVATED', 'HIGH', 'CRITICAL']),
      idealLengthBand: Object.freeze([12, 72]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: false,
      negotiationEligible: true,
      notes: Object.freeze(['Deploys a bluff signal inside a negotiation chamber.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'SILENCE_WEAPON',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['DEAL_ROOM']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['HATER']),
      preferredPressureBands: Object.freeze(['ELEVATED', 'HIGH', 'CRITICAL']),
      idealLengthBand: Object.freeze([1, 6]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: false,
      negotiationEligible: true,
      notes: Object.freeze(['Uses silence as a strategic pressure instrument.']),
    }),
    Object.freeze<ChatSemanticRuntimeGuidanceProfile>({
      form: 'UNKNOWN',
      defaultModeScopes: Object.freeze(['GO_ALONE', 'HEAD_TO_HEAD', 'TEAM_UP', 'CHASE_A_LEGEND']),
      defaultChannels: Object.freeze(['GLOBAL']) as readonly ChatChannelId[],
      preferredActorClasses: Object.freeze(['UNKNOWN']),
      preferredPressureBands: Object.freeze(['ELEVATED', 'HIGH', 'CRITICAL']),
      idealLengthBand: Object.freeze([10, 96]) as readonly [number, number],
      callbackEligible: false,
      proofEligible: false,
      rescueEligible: false,
      witnessEligible: false,
      negotiationEligible: false,
      notes: Object.freeze(['Fallback rhetorical class when no stronger law applies.']),
    }),
  ]);