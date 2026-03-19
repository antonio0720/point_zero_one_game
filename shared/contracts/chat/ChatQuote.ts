/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT QUOTE CONTRACTS
 * FILE: shared/contracts/chat/ChatQuote.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared contract surface for quote extraction, proof-aware recall,
 * redaction-safe excerpting, callback-ready quote reuse, transcript-grounded
 * receipts, and long-arc authored memory across frontend, backend, and
 * transport lanes.
 * ============================================================================
 */

import type {
  Brand,
  ChatChannelId,
  ChatMemoryAnchorId,
  ChatNpcId,
  ChatProofHash,
  ChatRelationshipId,
  ChatReplayId,
  ChatRequestId,
  ChatRoomId,
  ChatUserId,
  ChatQuoteId,
  JsonObject,
  Score01,
  UnixMs,
} from './ChatChannels';

import {
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_VERSION,
} from './ChatChannels';

import type {
  ChatActorKind,
  ChatMessageId,
} from './ChatChannels';

import type {
  ChatPressureTier,
} from './ChatEvents';

import type {
  ChatMessageToneBand,
  ChatQuoteReference,
} from './ChatMessage';

import type { EpisodicMemoryEventType } from './memory';
import type {
  ChatRelationshipCounterpartKind,
  ChatRelationshipObjective,
  ChatRelationshipStance,
} from './relationship';
import type {
  SharedChatMomentType,
  SharedChatSceneArchetype,
  SharedChatSceneRole,
} from './scene';

// ============================================================================
// MARK: Branded identifiers local to quote contracts
// ============================================================================
export type ChatQuoteFingerprint = Brand<string, 'ChatQuoteFingerprint'>;
export type ChatQuoteRangeId = Brand<string, 'ChatQuoteRangeId'>;
export type ChatQuoteLedgerId = Brand<string, 'ChatQuoteLedgerId'>;
export type ChatQuoteClusterId = Brand<string, 'ChatQuoteClusterId'>;
export type ChatQuoteExcerptId = Brand<string, 'ChatQuoteExcerptId'>;
export type ChatQuoteTemplateId = Brand<string, 'ChatQuoteTemplateId'>;
export type ChatQuoteSelectorId = Brand<string, 'ChatQuoteSelectorId'>;
export type ChatQuoteRecallId = Brand<string, 'ChatQuoteRecallId'>;
export type ChatQuoteRequestId = Brand<string, 'ChatQuoteRequestId'>;
export type ChatQuotePolicyTag = Brand<string, 'ChatQuotePolicyTag'>;

// ============================================================================
// MARK: Core vocabularies
// ============================================================================
export const CHAT_QUOTE_SOURCE_KINDS = [
  'MESSAGE',
  'TRANSCRIPT_WINDOW',
  'SCENE_ARCHIVE',
  'MEMORY_RECORD',
  'PLAYER_DRAFT',
  'REPLAY',
  'SYSTEM_SUMMARY',
] as const;
export const CHAT_QUOTE_AUDIENCE_CLASSES = [
  'PUBLIC',
  'PRIVATE',
  'SYNDICATE',
  'DEAL_ROOM',
  'HELPER_ONLY',
  'RIVAL_ONLY',
  'SYSTEM_ONLY',
  'SHADOW',
] as const;
export const CHAT_QUOTE_VISIBILITY_STATES = [
  'VISIBLE',
  'LIMITED',
  'SHADOW_ONLY',
  'REDACTED',
  'WITHHELD',
] as const;
export const CHAT_QUOTE_LIFECYCLE_STATES = [
  'CAPTURED',
  'INDEXED',
  'ELIGIBLE',
  'COOLDOWN',
  'SPENT',
  'ARCHIVED',
  'REDACTED',
] as const;
export const CHAT_QUOTE_EXTRACTION_METHODS = [
  'VERBATIM',
  'TRIMMED',
  'WINDOWED',
  'ELLIPSIZED',
  'NORMALIZED',
  'FOCUS_SPAN',
  'REDACTION_AWARE',
] as const;
export const CHAT_QUOTE_USE_INTENTS = [
  'HUMILIATION',
  'RECEIPT',
  'RESCUE',
  'GUIDANCE',
  'WITNESS',
  'DEAL_ROOM_PRESSURE',
  'RIVALRY_ESCALATION',
  'TRUST_REPAIR',
  'POST_RUN_RECKONING',
  'LEGEND_ARCHIVE',
  'SCENE_REVEAL',
  'PRE_EVENT_WARNING',
] as const;
export const CHAT_QUOTE_TONE_CLASSES = [
  'COLD',
  'MOCKING',
  'PREDATORY',
  'HELPFUL',
  'INTIMATE',
  'CEREMONIAL',
  'CLINICAL',
  'MOURNFUL',
  'TRIUMPHANT',
  'CAUTIONARY',
] as const;
export const CHAT_QUOTE_REDACTION_REASONS = [
  'NONE',
  'MODERATION',
  'SPOILER',
  'PRIVACY',
  'SYSTEM_ONLY',
  'NEGOTIATION_SEAL',
  'POST_RUN_LOCK',
] as const;
export const CHAT_QUOTE_CALLBACK_ELIGIBILITY = [
  'DISABLED',
  'HELPER_ONLY',
  'RIVAL_ONLY',
  'PUBLIC_ONLY',
  'ALL_AUTHORED',
] as const;
export const CHAT_QUOTE_CONTEXT_TAGS = [
  'PUBLIC_WITNESS',
  'PRIVATE_CONFESSION',
  'PRESSURE_SURGE',
  'BREACH',
  'RESCUE',
  'NEGOTIATION',
  'COMEBACK',
  'COLLAPSE',
  'SOVEREIGNTY',
  'LEGEND',
  'POST_RUN',
] as const;
export type ChatQuoteSourceKind = (typeof CHAT_QUOTE_SOURCE_KINDS)[number];
export type ChatQuoteAudienceClass = (typeof CHAT_QUOTE_AUDIENCE_CLASSES)[number];
export type ChatQuoteVisibilityState = (typeof CHAT_QUOTE_VISIBILITY_STATES)[number];
export type ChatQuoteLifecycleState = (typeof CHAT_QUOTE_LIFECYCLE_STATES)[number];
export type ChatQuoteExtractionMethod = (typeof CHAT_QUOTE_EXTRACTION_METHODS)[number];
export type ChatQuoteUseIntent = (typeof CHAT_QUOTE_USE_INTENTS)[number];
export type ChatQuoteToneClass = (typeof CHAT_QUOTE_TONE_CLASSES)[number];
export type ChatQuoteRedactionReason = (typeof CHAT_QUOTE_REDACTION_REASONS)[number];
export type ChatQuoteCallbackEligibility = (typeof CHAT_QUOTE_CALLBACK_ELIGIBILITY)[number];
export type ChatQuoteContextTag = (typeof CHAT_QUOTE_CONTEXT_TAGS)[number];

export interface ChatQuoteSourcePointer {
  readonly sourceKind: ChatQuoteSourceKind;
  readonly roomId?: ChatRoomId | null;
  readonly channelId?: ChatChannelId | null;
  readonly messageId?: ChatMessageId | null;
  readonly replayId?: ChatReplayId | null;
  readonly sceneId?: string | null;
  readonly memoryAnchorId?: ChatMemoryAnchorId | null;
  readonly transcriptWindowId?: string | null;
  readonly sourceSummary?: string;
}

export interface ChatQuoteRange {
  readonly rangeId: ChatQuoteRangeId;
  readonly sourceMessageId?: ChatMessageId | null;
  readonly charStart: number;
  readonly charEnd: number;
  readonly tokenApprox: number;
  readonly lineStart?: number;
  readonly lineEnd?: number;
  readonly focusedText: string;
  readonly leftContext?: string;
  readonly rightContext?: string;
  readonly extractionMethod: ChatQuoteExtractionMethod;
}

export interface ChatQuoteSpeakerSnapshot {
  readonly actorId: string;
  readonly actorKind: ChatActorKind | ChatRelationshipCounterpartKind;
  readonly displayName: string;
  readonly senderUserId?: ChatUserId | null;
  readonly senderNpcId?: ChatNpcId | null;
  readonly stanceHint?: ChatRelationshipStance | null;
  readonly objectiveHint?: ChatRelationshipObjective | null;
  readonly toneBand?: ChatMessageToneBand | null;
  readonly pressureTier?: ChatPressureTier | null;
}

export interface ChatQuoteContextSnapshot {
  readonly roomId?: ChatRoomId | null;
  readonly channelId?: ChatChannelId | null;
  readonly pressureTier?: ChatPressureTier | null;
  readonly sceneArchetype?: SharedChatSceneArchetype | null;
  readonly sceneRole?: SharedChatSceneRole | null;
  readonly momentType?: SharedChatMomentType | null;
  readonly memoryEventType?: EpisodicMemoryEventType | null;
  readonly relationshipId?: ChatRelationshipId | null;
  readonly counterpartId?: string | null;
  readonly counterpartKind?: ChatRelationshipCounterpartKind | null;
  readonly witnessClass: ChatQuoteAudienceClass;
  readonly publicWitness01: number;
  readonly embarrassmentRisk01: number;
  readonly rescueWeight01: number;
  readonly tags: readonly ChatQuoteContextTag[];
  readonly summary: string;
}

export interface ChatQuoteExcerpt {
  readonly excerptId: ChatQuoteExcerptId;
  readonly plainText: string;
  readonly normalizedText: string;
  readonly excerptText: string;
  readonly excerptLength: number;
  readonly beginsMidSentence: boolean;
  readonly endsMidSentence: boolean;
  readonly containsRedaction: boolean;
  readonly containsProfanity: boolean;
  readonly containsSpoilerRisk: boolean;
  readonly isQuestion: boolean;
  readonly isTaunt: boolean;
  readonly isConfession: boolean;
  readonly isReceiptWorthy: boolean;
}

export interface ChatQuoteProofEnvelope {
  readonly proofState: 'NONE' | 'PENDING' | 'ATTACHED' | 'CHAINED' | 'REDACTED';
  readonly proofHash?: ChatProofHash | null;
  readonly proofChainDepth?: number;
  readonly proofSummary?: string;
  readonly proofAnchorMessageId?: ChatMessageId | null;
  readonly proofAnchorRoomId?: ChatRoomId | null;
}

export interface ChatQuoteRedactionPolicy {
  readonly visibilityState: ChatQuoteVisibilityState;
  readonly reason: ChatQuoteRedactionReason;
  readonly allowPublicReuse: boolean;
  readonly allowPrivateReuse: boolean;
  readonly allowHelperReuse: boolean;
  readonly allowRivalReuse: boolean;
  readonly replacementExcerpt?: string;
  readonly notes: readonly string[];
}

export interface ChatQuoteReuseBudget {
  readonly maxLifetimeUses: number;
  readonly maxPublicUses: number;
  readonly maxPrivateUses: number;
  readonly cooldownMs: number;
  readonly allowSameSceneEcho: boolean;
  readonly allowCrossModeCarryover: boolean;
}

export interface ChatQuoteUseHistoryEntry {
  readonly usedAt: UnixMs;
  readonly useIntent: ChatQuoteUseIntent;
  readonly actorId?: string | null;
  readonly actorKind?: ChatActorKind | ChatRelationshipCounterpartKind | null;
  readonly roomId?: ChatRoomId | null;
  readonly channelId?: ChatChannelId | null;
  readonly sceneId?: string | null;
  readonly generatedMessageId?: ChatMessageId | null;
  readonly callbackPlanId?: string | null;
  readonly notes: readonly string[];
}

export interface ChatQuoteCallbackHint {
  readonly callbackId: string;
  readonly intent: ChatQuoteUseIntent;
  readonly toneClass: ChatQuoteToneClass;
  readonly templateId?: ChatQuoteTemplateId | null;
  readonly preferredAudience: ChatQuoteAudienceClass;
  readonly score01: Score01;
  readonly notes: readonly string[];
}

export interface ChatQuoteSemanticMarkers {
  readonly intimidation01: number;
  readonly confidence01: number;
  readonly embarrassment01: number;
  readonly desperation01: number;
  readonly curiosity01: number;
  readonly grief01: number;
  readonly dominance01: number;
  readonly trustSignal01: number;
  readonly sarcasm01: number;
  readonly bluffSignal01: number;
  readonly ritualWeight01: number;
  readonly callbackWorthiness01: number;
}

export interface ChatQuoteRecord {
  readonly quoteId: ChatQuoteId;
  readonly fingerprint: ChatQuoteFingerprint;
  readonly createdAt: UnixMs;
  readonly updatedAt: UnixMs;
  readonly lifecycleState: ChatQuoteLifecycleState;
  readonly source: ChatQuoteSourcePointer;
  readonly speaker: ChatQuoteSpeakerSnapshot;
  readonly context: ChatQuoteContextSnapshot;
  readonly range: ChatQuoteRange;
  readonly excerpt: ChatQuoteExcerpt;
  readonly proof: ChatQuoteProofEnvelope;
  readonly redaction: ChatQuoteRedactionPolicy;
  readonly callbackEligibility: ChatQuoteCallbackEligibility;
  readonly semanticMarkers: ChatQuoteSemanticMarkers;
  readonly useBudget: ChatQuoteReuseBudget;
  readonly useHistory: readonly ChatQuoteUseHistoryEntry[];
  readonly callbackHints: readonly ChatQuoteCallbackHint[];
  readonly linkedMessageIds: readonly ChatMessageId[];
  readonly linkedRelationshipIds: readonly ChatRelationshipId[];
  readonly linkedMemoryAnchorIds: readonly ChatMemoryAnchorId[];
  readonly clusterIds: readonly ChatQuoteClusterId[];
  readonly tags: readonly string[];
  readonly customData?: JsonObject;
}

export interface ChatQuoteLegacyProjection {
  readonly quoteId: ChatQuoteId;
  readonly quotedMessageId?: ChatMessageId | null;
  readonly quotedSenderName: string;
  readonly quotedExcerpt: string;
  readonly quotedAt?: UnixMs;
}

export interface ChatQuoteLedgerSnapshot {
  readonly ledgerId: ChatQuoteLedgerId;
  readonly createdAt: UnixMs;
  readonly updatedAt: UnixMs;
  readonly roomId?: ChatRoomId | null;
  readonly playerId?: ChatUserId | null;
  readonly quotes: readonly ChatQuoteRecord[];
  readonly quoteIdsByMessageId: Readonly<Record<string, readonly ChatQuoteId[]>>;
  readonly clusterMembership: Readonly<Record<string, readonly ChatQuoteId[]>>;
  readonly countsByIntent: Readonly<Record<ChatQuoteUseIntent, number>>;
  readonly countsByVisibility: Readonly<Record<ChatQuoteVisibilityState, number>>;
}

export interface ChatQuoteSearchQuery {
  readonly requestId: ChatQuoteRequestId;
  readonly roomId?: ChatRoomId | null;
  readonly channelId?: ChatChannelId | null;
  readonly playerId?: ChatUserId | null;
  readonly actorId?: string | null;
  readonly actorKind?: ChatActorKind | ChatRelationshipCounterpartKind | null;
  readonly counterpartId?: string | null;
  readonly sourceMessageId?: ChatMessageId | null;
  readonly relatedMemoryAnchorId?: ChatMemoryAnchorId | null;
  readonly intents?: readonly ChatQuoteUseIntent[];
  readonly toneClasses?: readonly ChatQuoteToneClass[];
  readonly audienceClasses?: readonly ChatQuoteAudienceClass[];
  readonly tags?: readonly string[];
  readonly searchText?: string;
  readonly minScore01?: number;
  readonly includeRedacted?: boolean;
  readonly includeSpent?: boolean;
  readonly limit?: number;
}

export interface ChatQuoteSearchHit {
  readonly quote: ChatQuoteRecord;
  readonly legacy: ChatQuoteLegacyProjection;
  readonly score01: Score01;
  readonly reasons: readonly string[];
}

export interface ChatQuoteSelectionContext {
  readonly requestId: ChatQuoteRequestId;
  readonly createdAt: UnixMs;
  readonly roomId?: ChatRoomId | null;
  readonly channelId?: ChatChannelId | null;
  readonly targetAudience: ChatQuoteAudienceClass;
  readonly useIntent: ChatQuoteUseIntent;
  readonly requestingActorId?: string | null;
  readonly requestingActorKind?: ChatActorKind | ChatRelationshipCounterpartKind | null;
  readonly sceneId?: string | null;
  readonly sceneRole?: SharedChatSceneRole | null;
  readonly pressureTier?: ChatPressureTier | null;
  readonly preferredToneClasses?: readonly ChatQuoteToneClass[];
  readonly maxResults?: number;
}

export interface ChatQuoteSelectionCandidate {
  readonly quoteId: ChatQuoteId;
  readonly score01: Score01;
  readonly visibilityState: ChatQuoteVisibilityState;
  readonly intent: ChatQuoteUseIntent;
  readonly toneClass: ChatQuoteToneClass;
  readonly excerpt: string;
  readonly notes: readonly string[];
}

export interface ChatQuoteSelectionResponse {
  readonly requestId: ChatQuoteRequestId;
  readonly createdAt: UnixMs;
  readonly candidates: readonly ChatQuoteSelectionCandidate[];
}

export interface ChatQuoteTransportEnvelope {
  readonly envelopeType: 'CHAT_QUOTE_LEDGER';
  readonly schemaVersion: typeof CHAT_CONTRACT_VERSION;
  readonly authorities: typeof CHAT_CONTRACT_AUTHORITIES;
  readonly snapshot: ChatQuoteLedgerSnapshot;
}

export interface ChatQuoteReferenceBundle {
  readonly record: ChatQuoteRecord;
  readonly reference: ChatQuoteReference;
  readonly legacy: ChatQuoteLegacyProjection;
}

export const CHAT_QUOTE_MODULE_MANIFEST = Object.freeze({
  module: 'ChatQuote',
  schemaVersion: CHAT_CONTRACT_VERSION,
  authorities: CHAT_CONTRACT_AUTHORITIES,
  primaryExports: [
    'ChatQuoteRecord',
    'ChatQuoteLedgerSnapshot',
    'ChatQuoteSearchQuery',
    'ChatQuoteSelectionContext',
    'ChatQuoteReferenceBundle',
  ],
} as const);

export interface CreateChatQuoteRecordInput {
  readonly quoteId?: ChatQuoteId;
  readonly createdAt?: UnixMs;
  readonly updatedAt?: UnixMs;
  readonly source: ChatQuoteSourcePointer;
  readonly speaker: ChatQuoteSpeakerSnapshot;
  readonly context: ChatQuoteContextSnapshot;
  readonly range: ChatQuoteRange;
  readonly excerptText: string;
  readonly normalizedText?: string;
  readonly visibilityState?: ChatQuoteVisibilityState;
  readonly callbackEligibility?: ChatQuoteCallbackEligibility;
  readonly proof?: Partial<ChatQuoteProofEnvelope>;
  readonly redaction?: Partial<ChatQuoteRedactionPolicy>;
  readonly semanticMarkers?: Partial<ChatQuoteSemanticMarkers>;
  readonly callbackHints?: readonly ChatQuoteCallbackHint[];
  readonly linkedMessageIds?: readonly ChatMessageId[];
  readonly linkedRelationshipIds?: readonly ChatRelationshipId[];
  readonly linkedMemoryAnchorIds?: readonly ChatMemoryAnchorId[];
  readonly clusterIds?: readonly ChatQuoteClusterId[];
  readonly tags?: readonly string[];
  readonly customData?: JsonObject;
}

export function createChatQuoteReference(record: ChatQuoteRecord): ChatQuoteReference {
  return {
    quoteId: record.quoteId,
    quotedMessageId: coalesceMessageId(record),
    quotedSenderName: record.speaker.displayName,
    quotedExcerpt: record.excerpt.excerptText,
    quotedAt: record.createdAt,
  };
}

export function createChatQuoteLegacyProjection(record: ChatQuoteRecord): ChatQuoteLegacyProjection {
  return {
    quoteId: record.quoteId,
    quotedMessageId: coalesceMessageId(record),
    quotedSenderName: record.speaker.displayName,
    quotedExcerpt: record.excerpt.excerptText,
    quotedAt: record.createdAt,
  };
}

export function createChatQuoteReferenceBundle(record: ChatQuoteRecord): ChatQuoteReferenceBundle {
  return {
    record,
    reference: createChatQuoteReference(record),
    legacy: createChatQuoteLegacyProjection(record),
  };
}

export function createChatQuoteRecord(input: CreateChatQuoteRecordInput): ChatQuoteRecord {
  const createdAt = input.createdAt ?? asUnixMs(Date.now());
  const updatedAt = input.updatedAt ?? createdAt;
  const normalizedText = normalizeQuoteText(input.normalizedText ?? input.excerptText);
  const excerptText = createQuoteExcerptText(input.excerptText, input.range.extractionMethod);
  const quoteId =
    input.quoteId ??
    asChatQuoteId(
      `quote:${stableFragment(
        `${input.source.messageId ?? input.source.replayId ?? 'unknown'}|${input.speaker.displayName}|${normalizedText}`,
      )}`,
    );

  const excerpt: ChatQuoteExcerpt = {
    excerptId: asChatQuoteExcerptId(`quote_excerpt:${stableFragment(normalizedText)}`),
    plainText: input.excerptText,
    normalizedText,
    excerptText,
    excerptLength: excerptText.length,
    beginsMidSentence: beginsMidSentence(input.range.leftContext, input.excerptText),
    endsMidSentence: endsMidSentence(input.range.rightContext, input.excerptText),
    containsRedaction: /\[redacted\]/i.test(excerptText),
    containsProfanity: detectProfanity(excerptText),
    containsSpoilerRisk: /\bspoiler\b/i.test(excerptText),
    isQuestion: excerptText.trim().endsWith('?'),
    isTaunt: detectTaunt(excerptText),
    isConfession: detectConfession(excerptText),
    isReceiptWorthy: detectReceiptWorthiness(excerptText),
  };

  const proof: ChatQuoteProofEnvelope = {
    proofState: input.proof?.proofState ?? 'NONE',
    proofHash: input.proof?.proofHash ?? null,
    proofChainDepth: input.proof?.proofChainDepth,
    proofSummary: input.proof?.proofSummary,
    proofAnchorMessageId: input.proof?.proofAnchorMessageId ?? coalesceMessageIdFromSource(input.source),
    proofAnchorRoomId: input.proof?.proofAnchorRoomId ?? input.source.roomId ?? null,
  };

  const visibilityState = input.visibilityState ?? 'VISIBLE';
  const redaction: ChatQuoteRedactionPolicy = {
    visibilityState: input.redaction?.visibilityState ?? visibilityState,
    reason: input.redaction?.reason ?? 'NONE',
    allowPublicReuse: input.redaction?.allowPublicReuse ?? visibilityState === 'VISIBLE',
    allowPrivateReuse: input.redaction?.allowPrivateReuse ?? visibilityState !== 'WITHHELD',
    allowHelperReuse: input.redaction?.allowHelperReuse ?? visibilityState !== 'WITHHELD',
    allowRivalReuse: input.redaction?.allowRivalReuse ?? visibilityState === 'VISIBLE',
    replacementExcerpt: input.redaction?.replacementExcerpt,
    notes: input.redaction?.notes ?? [],
  };

  const semanticMarkers: ChatQuoteSemanticMarkers = {
    intimidation01: clamp01(input.semanticMarkers?.intimidation01 ?? scoreIntimidation(excerptText)),
    confidence01: clamp01(input.semanticMarkers?.confidence01 ?? scoreConfidence(excerptText)),
    embarrassment01: clamp01(input.semanticMarkers?.embarrassment01 ?? scoreEmbarrassment(excerptText)),
    desperation01: clamp01(input.semanticMarkers?.desperation01 ?? scoreDesperation(excerptText)),
    curiosity01: clamp01(input.semanticMarkers?.curiosity01 ?? scoreCuriosity(excerptText)),
    grief01: clamp01(input.semanticMarkers?.grief01 ?? scoreGrief(excerptText)),
    dominance01: clamp01(input.semanticMarkers?.dominance01 ?? scoreDominance(excerptText)),
    trustSignal01: clamp01(input.semanticMarkers?.trustSignal01 ?? scoreTrustSignal(excerptText)),
    sarcasm01: clamp01(input.semanticMarkers?.sarcasm01 ?? scoreSarcasm(excerptText)),
    bluffSignal01: clamp01(input.semanticMarkers?.bluffSignal01 ?? scoreBluff(excerptText)),
    ritualWeight01: clamp01(input.semanticMarkers?.ritualWeight01 ?? scoreRitualWeight(excerptText)),
    callbackWorthiness01: clamp01(
      input.semanticMarkers?.callbackWorthiness01 ?? scoreCallbackWorthiness(excerptText, input.context),
    ),
  };

  return {
    quoteId,
    fingerprint: asChatQuoteFingerprint(stableFragment(`${quoteId}|${normalizedText}`)),
    createdAt,
    updatedAt,
    lifecycleState: 'CAPTURED',
    source: input.source,
    speaker: input.speaker,
    context: input.context,
    range: input.range,
    excerpt,
    proof,
    redaction,
    callbackEligibility: input.callbackEligibility ?? deriveCallbackEligibility(input.context, redaction),
    semanticMarkers,
    useBudget: {
      maxLifetimeUses: visibilityState === 'VISIBLE' ? 8 : 4,
      maxPublicUses: visibilityState === 'VISIBLE' ? 4 : 0,
      maxPrivateUses: 8,
      cooldownMs: 15000,
      allowSameSceneEcho: false,
      allowCrossModeCarryover: true,
    },
    useHistory: [],
    callbackHints: input.callbackHints ?? deriveDefaultCallbackHints(excerptText, input.context, semanticMarkers),
    linkedMessageIds: input.linkedMessageIds ?? compactMessageIds([coalesceMessageIdFromSource(input.source)]),
    linkedRelationshipIds: input.linkedRelationshipIds ?? [],
    linkedMemoryAnchorIds: input.linkedMemoryAnchorIds ?? compactMemoryAnchorIds([input.source.memoryAnchorId ?? null]),
    clusterIds: input.clusterIds ?? [],
    tags: input.tags ?? deriveDefaultQuoteTags(input.context, semanticMarkers, excerpt),
    customData: input.customData,
  };
}

export function createEmptyChatQuoteLedgerSnapshot(ledgerId: ChatQuoteLedgerId): ChatQuoteLedgerSnapshot {
  return {
    ledgerId,
    createdAt: asUnixMs(Date.now()),
    updatedAt: asUnixMs(Date.now()),
    roomId: null,
    playerId: null,
    quotes: [],
    quoteIdsByMessageId: {},
    clusterMembership: {},
    countsByIntent: createQuoteIntentCountSeed(),
    countsByVisibility: createQuoteVisibilityCountSeed(),
  };
}

export function matchChatQuoteSearchQuery(record: ChatQuoteRecord, query: ChatQuoteSearchQuery): boolean {
  if (query.roomId && record.source.roomId !== query.roomId) return false;
  if (query.channelId && record.source.channelId !== query.channelId) return false;
  if (query.actorId && record.speaker.actorId !== query.actorId) return false;
  if (query.actorKind && record.speaker.actorKind !== query.actorKind) return false;
  if (query.counterpartId && record.context.counterpartId !== query.counterpartId) return false;
  if (query.sourceMessageId && coalesceMessageId(record) !== query.sourceMessageId) return false;
  if (query.relatedMemoryAnchorId && !record.linkedMemoryAnchorIds.includes(query.relatedMemoryAnchorId)) return false;
  if (query.intents?.length) {
    const allowed = new Set(query.intents);
    if (!record.callbackHints.some((hint) => allowed.has(hint.intent))) return false;
  }
  if (query.toneClasses?.length) {
    const allowed = new Set(query.toneClasses);
    if (!record.callbackHints.some((hint) => allowed.has(hint.toneClass))) return false;
  }
  if (query.audienceClasses?.length && !query.audienceClasses.includes(record.context.witnessClass)) return false;
  if (query.tags?.length) {
    for (const tag of query.tags) if (!record.tags.includes(tag)) return false;
  }
  if (!query.includeRedacted && record.redaction.visibilityState === 'REDACTED') return false;
  if (!query.includeSpent && record.lifecycleState === 'SPENT') return false;
  if (query.searchText) {
    const needle = normalizeQuoteText(query.searchText);
    const haystack = `${record.excerpt.normalizedText} ${record.context.summary.toLowerCase()} ${record.tags.join(' ').toLowerCase()}`;
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

export function scoreChatQuoteForQuery(record: ChatQuoteRecord, query: ChatQuoteSearchQuery): Score01 {
  let score = 0.15;
  if (query.channelId && record.source.channelId === query.channelId) score += 0.1;
  if (query.actorId && record.speaker.actorId === query.actorId) score += 0.1;
  if (query.counterpartId && record.context.counterpartId === query.counterpartId) score += 0.08;
  if (query.searchText) {
    const needle = normalizeQuoteText(query.searchText);
    if (record.excerpt.normalizedText.includes(needle)) score += 0.2;
    if (record.context.summary.toLowerCase().includes(needle)) score += 0.07;
  }
  score += record.semanticMarkers.callbackWorthiness01 * 0.16;
  score += record.semanticMarkers.embarrassment01 * 0.06;
  score += record.semanticMarkers.trustSignal01 * 0.04;
  if (record.redaction.allowPublicReuse) score += 0.03;
  if (record.lifecycleState === 'ELIGIBLE' || record.lifecycleState === 'CAPTURED') score += 0.04;
  if (record.context.witnessClass === 'PUBLIC') score += 0.04;
  return asScore01(clamp01(score));
}

export function createChatQuoteSearchHits(
  quotes: readonly ChatQuoteRecord[],
  query: ChatQuoteSearchQuery,
): readonly ChatQuoteSearchHit[] {
  return quotes
    .filter((record) => matchChatQuoteSearchQuery(record, query))
    .map((record) => ({
      quote: record,
      legacy: createChatQuoteLegacyProjection(record),
      score01: scoreChatQuoteForQuery(record, query),
      reasons: explainQuoteSearchScore(record, query),
    }))
    .sort((a, b) => Number(b.score01) - Number(a.score01))
    .slice(0, query.limit ?? 25);
}

export function canReuseQuoteInContext(record: ChatQuoteRecord, context: ChatQuoteSelectionContext): boolean {
  if (record.lifecycleState === 'REDACTED' || record.lifecycleState === 'ARCHIVED') return false;
  if (record.redaction.visibilityState === 'WITHHELD') return false;
  switch (context.targetAudience) {
    case 'PUBLIC':
      if (!record.redaction.allowPublicReuse) return false;
      break;
    case 'PRIVATE':
    case 'DEAL_ROOM':
    case 'SYNDICATE':
      if (!record.redaction.allowPrivateReuse) return false;
      break;
    case 'HELPER_ONLY':
      if (!record.redaction.allowHelperReuse) return false;
      break;
    case 'RIVAL_ONLY':
      if (!record.redaction.allowRivalReuse) return false;
      break;
    case 'SYSTEM_ONLY':
    case 'SHADOW':
      break;
  }
  if (record.callbackEligibility === 'DISABLED') return false;
  if (record.callbackEligibility === 'HELPER_ONLY' && context.targetAudience !== 'HELPER_ONLY') return false;
  if (record.callbackEligibility === 'RIVAL_ONLY' && context.targetAudience !== 'RIVAL_ONLY') return false;
  if (record.callbackEligibility === 'PUBLIC_ONLY' && context.targetAudience !== 'PUBLIC') return false;

  const publicUses = record.useHistory.filter((entry) => entry.channelId === 'GLOBAL' || entry.channelId === 'LOBBY').length;
  if (context.targetAudience === 'PUBLIC' && publicUses >= record.useBudget.maxPublicUses) return false;
  if (record.useHistory.length >= record.useBudget.maxLifetimeUses) return false;
  const lastUse = record.useHistory[record.useHistory.length - 1];
  if (lastUse && context.createdAt - lastUse.usedAt < record.useBudget.cooldownMs) return false;
  if (!record.useBudget.allowSameSceneEcho && lastUse?.callbackPlanId === context.sceneId) return false;
  return true;
}

export function scoreQuoteSelection(record: ChatQuoteRecord, context: ChatQuoteSelectionContext): Score01 {
  let score = 0.2;
  if (record.context.witnessClass === context.targetAudience) score += 0.18;
  if (record.context.sceneRole && record.context.sceneRole === context.sceneRole) score += 0.07;
  if (record.context.pressureTier && record.context.pressureTier === context.pressureTier) score += 0.08;

  switch (context.useIntent) {
    case 'HUMILIATION':
    case 'RECEIPT':
      score += record.semanticMarkers.embarrassment01 * 0.23;
      score += record.semanticMarkers.sarcasm01 * 0.08;
      break;
    case 'RESCUE':
    case 'GUIDANCE':
      score += record.semanticMarkers.trustSignal01 * 0.18;
      score += record.semanticMarkers.desperation01 * 0.06;
      break;
    case 'RIVALRY_ESCALATION':
      score += record.semanticMarkers.dominance01 * 0.13;
      score += record.semanticMarkers.intimidation01 * 0.12;
      break;
    case 'POST_RUN_RECKONING':
      score += record.semanticMarkers.grief01 * 0.06;
      score += record.semanticMarkers.callbackWorthiness01 * 0.16;
      break;
    default:
      score += record.semanticMarkers.callbackWorthiness01 * 0.16;
      break;
  }

  if (record.redaction.allowPublicReuse && context.targetAudience === 'PUBLIC') score += 0.03;
  if (record.lifecycleState === 'CAPTURED' || record.lifecycleState === 'ELIGIBLE') score += 0.04;
  return asScore01(clamp01(score));
}

export function bestIntentForQuote(record: ChatQuoteRecord, requestedIntent: ChatQuoteUseIntent): ChatQuoteUseIntent {
  const hit = record.callbackHints.find((hint) => hint.intent === requestedIntent);
  return hit?.intent ?? record.callbackHints[0]?.intent ?? requestedIntent;
}

export function bestToneForQuote(
  record: ChatQuoteRecord,
  preferred?: readonly ChatQuoteToneClass[],
): ChatQuoteToneClass {
  if (preferred?.length) {
    const allowed = new Set(preferred);
    const hit = record.callbackHints.find((hint) => allowed.has(hint.toneClass));
    if (hit) return hit.toneClass;
  }
  return record.callbackHints[0]?.toneClass ?? 'COLD';
}

export function selectChatQuoteCandidates(
  quotes: readonly ChatQuoteRecord[],
  context: ChatQuoteSelectionContext,
): ChatQuoteSelectionResponse {
  const candidates = quotes
    .filter((record) => canReuseQuoteInContext(record, context))
    .map((record) => ({
      quoteId: record.quoteId,
      score01: scoreQuoteSelection(record, context),
      visibilityState: record.redaction.visibilityState,
      intent: bestIntentForQuote(record, context.useIntent),
      toneClass: bestToneForQuote(record, context.preferredToneClasses),
      excerpt: record.excerpt.excerptText,
      notes: explainQuoteSelection(record, context),
    }))
    .sort((a, b) => Number(b.score01) - Number(a.score01))
    .slice(0, context.maxResults ?? 5);

  return {
    requestId: context.requestId,
    createdAt: context.createdAt,
    candidates,
  };
}

export function createQuoteIntentCountSeed(): Readonly<Record<ChatQuoteUseIntent, number>> {
  return {
    HUMILIATION: 0,
    RECEIPT: 0,
    RESCUE: 0,
    GUIDANCE: 0,
    WITNESS: 0,
    DEAL_ROOM_PRESSURE: 0,
    RIVALRY_ESCALATION: 0,
    TRUST_REPAIR: 0,
    POST_RUN_RECKONING: 0,
    LEGEND_ARCHIVE: 0,
    SCENE_REVEAL: 0,
    PRE_EVENT_WARNING: 0,
  };
}

export function createQuoteVisibilityCountSeed(): Readonly<Record<ChatQuoteVisibilityState, number>> {
  return {
    VISIBLE: 0,
    LIMITED: 0,
    SHADOW_ONLY: 0,
    REDACTED: 0,
    WITHHELD: 0,
  };
}

export function countQuotesByIntent(quotes: readonly ChatQuoteRecord[]): Readonly<Record<ChatQuoteUseIntent, number>> {
  const out: Record<ChatQuoteUseIntent, number> = { ...createQuoteIntentCountSeed() };
  for (const quote of quotes) {
    const intent = quote.callbackHints[0]?.intent ?? 'WITNESS';
    out[intent] += 1;
  }
  return out;
}

export function countQuotesByVisibility(
  quotes: readonly ChatQuoteRecord[],
): Readonly<Record<ChatQuoteVisibilityState, number>> {
  const out: Record<ChatQuoteVisibilityState, number> = { ...createQuoteVisibilityCountSeed() };
  for (const quote of quotes) out[quote.redaction.visibilityState] += 1;
  return out;
}

export function buildQuoteIdsByMessageId(
  quotes: readonly ChatQuoteRecord[],
): Readonly<Record<string, readonly ChatQuoteId[]>> {
  const out: Record<string, ChatQuoteId[]> = {};
  for (const quote of quotes) {
    const messageId = coalesceMessageId(quote);
    if (!messageId) continue;
    out[messageId] ??= [];
    out[messageId].push(quote.quoteId);
  }
  return out;
}

export function buildQuoteClusterMembership(
  quotes: readonly ChatQuoteRecord[],
): Readonly<Record<string, readonly ChatQuoteId[]>> {
  const out: Record<string, ChatQuoteId[]> = {};
  for (const quote of quotes) {
    for (const clusterId of quote.clusterIds) {
      out[clusterId] ??= [];
      out[clusterId].push(quote.quoteId);
    }
  }
  return out;
}

export function buildQuoteLedgerSnapshot(
  ledgerId: ChatQuoteLedgerId,
  quotes: readonly ChatQuoteRecord[],
  roomId?: ChatRoomId | null,
  playerId?: ChatUserId | null,
): ChatQuoteLedgerSnapshot {
  return {
    ledgerId,
    createdAt: quotes[0]?.createdAt ?? asUnixMs(Date.now()),
    updatedAt: asUnixMs(Date.now()),
    roomId: roomId ?? null,
    playerId: playerId ?? null,
    quotes,
    quoteIdsByMessageId: buildQuoteIdsByMessageId(quotes),
    clusterMembership: buildQuoteClusterMembership(quotes),
    countsByIntent: countQuotesByIntent(quotes),
    countsByVisibility: countQuotesByVisibility(quotes),
  };
}

export function isChatQuoteRecord(value: unknown): value is ChatQuoteRecord {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<ChatQuoteRecord>;
  return (
    typeof v.quoteId === 'string' &&
    typeof v.createdAt === 'number' &&
    typeof v.updatedAt === 'number' &&
    !!v.source &&
    !!v.speaker &&
    !!v.context &&
    !!v.range &&
    !!v.excerpt &&
    !!v.proof &&
    !!v.redaction
  );
}

export function deriveCallbackEligibility(
  context: ChatQuoteContextSnapshot,
  redaction: ChatQuoteRedactionPolicy,
): ChatQuoteCallbackEligibility {
  if (redaction.visibilityState === 'WITHHELD') return 'DISABLED';
  if (context.witnessClass === 'HELPER_ONLY') return 'HELPER_ONLY';
  if (context.witnessClass === 'RIVAL_ONLY') return 'RIVAL_ONLY';
  if (context.witnessClass === 'PUBLIC') return 'PUBLIC_ONLY';
  return 'ALL_AUTHORED';
}

export function deriveDefaultCallbackHints(
  text: string,
  context: ChatQuoteContextSnapshot,
  semanticMarkers: ChatQuoteSemanticMarkers,
): readonly ChatQuoteCallbackHint[] {
  const hints: ChatQuoteCallbackHint[] = [];

  if (semanticMarkers.embarrassment01 >= 0.65) {
    hints.push({
      callbackId: `callback:${stableFragment(`receipt|${text}`)}`,
      intent: 'RECEIPT',
      toneClass: 'MOCKING',
      templateId: asChatQuoteTemplateId('quote-template:receipt'),
      preferredAudience: context.witnessClass === 'PUBLIC' ? 'PUBLIC' : 'RIVAL_ONLY',
      score01: asScore01(clamp01(0.55 + semanticMarkers.embarrassment01 * 0.35)),
      notes: ['embarrassment-detected'],
    });
  }
  if (semanticMarkers.trustSignal01 >= 0.55 || semanticMarkers.desperation01 >= 0.6) {
    hints.push({
      callbackId: `callback:${stableFragment(`rescue|${text}`)}`,
      intent: 'RESCUE',
      toneClass: 'HELPFUL',
      templateId: asChatQuoteTemplateId('quote-template:rescue'),
      preferredAudience: 'HELPER_ONLY',
      score01: asScore01(clamp01(0.4 + semanticMarkers.trustSignal01 * 0.3 + semanticMarkers.desperation01 * 0.2)),
      notes: ['rescue-viable'],
    });
  }
  if (semanticMarkers.dominance01 >= 0.55 || semanticMarkers.intimidation01 >= 0.55) {
    hints.push({
      callbackId: `callback:${stableFragment(`rivalry|${text}`)}`,
      intent: 'RIVALRY_ESCALATION',
      toneClass: 'PREDATORY',
      templateId: asChatQuoteTemplateId('quote-template:rivalry'),
      preferredAudience: 'RIVAL_ONLY',
      score01: asScore01(clamp01(0.35 + semanticMarkers.dominance01 * 0.3 + semanticMarkers.intimidation01 * 0.2)),
      notes: ['rivalry-viable'],
    });
  }
  if (semanticMarkers.callbackWorthiness01 >= 0.6) {
    hints.push({
      callbackId: `callback:${stableFragment(`witness|${text}`)}`,
      intent: 'WITNESS',
      toneClass: 'CLINICAL',
      templateId: asChatQuoteTemplateId('quote-template:witness'),
      preferredAudience: context.witnessClass,
      score01: asScore01(semanticMarkers.callbackWorthiness01),
      notes: ['baseline-witness'],
    });
  }

  return hints.length
    ? hints
    : [{
        callbackId: `callback:${stableFragment(`default|${text}`)}`,
        intent: 'WITNESS',
        toneClass: 'COLD',
        templateId: asChatQuoteTemplateId('quote-template:default'),
        preferredAudience: context.witnessClass,
        score01: asScore01(0.35),
        notes: ['default'],
      }];
}

export function deriveDefaultQuoteTags(
  context: ChatQuoteContextSnapshot,
  semanticMarkers: ChatQuoteSemanticMarkers,
  excerpt: ChatQuoteExcerpt,
): readonly string[] {
  const tags = new Set<string>(context.tags);
  if (excerpt.isQuestion) tags.add('QUESTION');
  if (excerpt.isTaunt) tags.add('TAUNT');
  if (excerpt.isConfession) tags.add('CONFESSION');
  if (excerpt.isReceiptWorthy) tags.add('RECEIPT');
  if (semanticMarkers.embarrassment01 >= 0.7) tags.add('HIGH_EMBARRASSMENT');
  if (semanticMarkers.trustSignal01 >= 0.7) tags.add('TRUST_SIGNAL');
  if (semanticMarkers.dominance01 >= 0.7) tags.add('DOMINANCE');
  if (semanticMarkers.desperation01 >= 0.7) tags.add('DESPERATION');
  if (semanticMarkers.callbackWorthiness01 >= 0.8) tags.add('CALLBACK_HIGH');
  return [...tags];
}

export function explainQuoteSearchScore(
  record: ChatQuoteRecord,
  query: ChatQuoteSearchQuery,
): readonly string[] {
  const notes: string[] = [];
  if (query.channelId && record.source.channelId === query.channelId) notes.push('channel-match');
  if (query.actorId && record.speaker.actorId === query.actorId) notes.push('actor-match');
  if (query.counterpartId && record.context.counterpartId === query.counterpartId) notes.push('counterpart-match');
  if (query.searchText) {
    const needle = normalizeQuoteText(query.searchText);
    if (record.excerpt.normalizedText.includes(needle)) notes.push('excerpt-match');
    if (record.context.summary.toLowerCase().includes(needle)) notes.push('summary-match');
  }
  if (record.semanticMarkers.callbackWorthiness01 >= 0.7) notes.push('high-callback-worthiness');
  if (record.redaction.allowPublicReuse) notes.push('public-eligible');
  return notes;
}

export function explainQuoteSelection(
  record: ChatQuoteRecord,
  context: ChatQuoteSelectionContext,
): readonly string[] {
  const notes: string[] = [];
  if (record.context.witnessClass === context.targetAudience) notes.push('audience-direct-hit');
  if (record.context.sceneRole === context.sceneRole) notes.push('scene-role-aligned');
  if (record.context.pressureTier && record.context.pressureTier === context.pressureTier) notes.push('pressure-aligned');
  if (record.semanticMarkers.embarrassment01 >= 0.75 && context.useIntent === 'HUMILIATION') notes.push('embarrassment-high');
  if (record.semanticMarkers.trustSignal01 >= 0.7 && context.useIntent === 'RESCUE') notes.push('trust-signal');
  if (record.semanticMarkers.callbackWorthiness01 >= 0.8) notes.push('callback-worthiness-high');
  return notes;
}

export function normalizeQuoteText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function createQuoteExcerptText(text: string, method: ChatQuoteExtractionMethod): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  switch (method) {
    case 'ELLIPSIZED':
      return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
    default:
      return trimmed;
  }
}

export function beginsMidSentence(leftContext: string | undefined, text: string): boolean {
  const left = (leftContext ?? '').trim();
  if (!left) return false;
  return !/[.!?]\s*$/.test(left) && /^[a-z0-9]/.test(text.trim());
}

export function endsMidSentence(rightContext: string | undefined, text: string): boolean {
  const right = (rightContext ?? '').trim();
  if (!right) return false;
  return !/[.!?]["')\]]?$/.test(text.trim()) && /^[a-z0-9]/i.test(right);
}

export function detectProfanity(text: string): boolean {
  return /\b(damn|hell|shit|ass)\b/i.test(text);
}

export function detectTaunt(text: string): boolean {
  return /\b(too easy|told you|you missed|that's it\?|weak|pathetic)\b/i.test(text);
}

export function detectConfession(text: string): boolean {
  return /\b(i thought|i was wrong|i panicked|i didn't know|i shouldn't have)\b/i.test(text);
}

export function detectReceiptWorthiness(text: string): boolean {
  return /\b(always|never|easy|guaranteed|can't lose|trust me|watch this)\b/i.test(text);
}

export function keywordScore(text: string, keywords: readonly string[], denominator: number): number {
  const hay = text.toLowerCase();
  let hits = 0;
  for (const keyword of keywords) if (hay.includes(keyword.toLowerCase())) hits += 1;
  return clamp01(hits / Math.max(1, denominator));
}
export function scoreIntimidation(text: string): number {
  return keywordScore(text, ['hunt', 'break', 'bleed', 'bury', 'finish', 'corner'], 6);
}
export function scoreConfidence(text: string): number {
  return keywordScore(text, ['easy', 'sure', 'win', 'locked', 'certain', 'control'], 6);
}
export function scoreEmbarrassment(text: string): number {
  return keywordScore(text, ['missed', 'failed', 'wrong', 'folded', 'panic', 'hesitated'], 6);
}
export function scoreDesperation(text: string): number {
  return keywordScore(text, ['please', 'need', 'help', 'can\'t', 'stuck', 'save'], 6);
}
export function scoreCuriosity(text: string): number {
  return keywordScore(text, ['why', 'how', 'what if', 'explain', 'show me', 'where'], 6);
}
export function scoreGrief(text: string): number {
  return keywordScore(text, ['lost', 'gone', 'sorry', 'regret', 'mourn', 'ended'], 6);
}
export function scoreDominance(text: string): number {
  return keywordScore(text, ['kneel', 'submit', 'mine', 'dominate', 'own', 'crush'], 6);
}
export function scoreTrustSignal(text: string): number {
  return keywordScore(text, ['listen', 'stay with me', 'breathe', 'follow', 'trust', 'steady'], 6);
}
export function scoreSarcasm(text: string): number {
  return keywordScore(text, ['sure', 'right', 'obviously', 'brilliant', 'amazing'], 5);
}
export function scoreBluff(text: string): number {
  return keywordScore(text, ['all in', 'final offer', 'last chance', 'i know you', 'no risk'], 5);
}
export function scoreRitualWeight(text: string): number {
  return keywordScore(text, ['remember this', 'witness', 'ritual', 'oath', 'mark this', 'named'], 6);
}
export function scoreCallbackWorthiness(text: string, context: ChatQuoteContextSnapshot): number {
  let score = 0.2;
  score += scoreEmbarrassment(text) * 0.18;
  score += scoreTrustSignal(text) * 0.12;
  score += scoreDominance(text) * 0.08;
  score += scoreRitualWeight(text) * 0.08;
  if (context.witnessClass === 'PUBLIC') score += 0.08;
  if (context.memoryEventType === 'COMEBACK' || context.memoryEventType === 'COLLAPSE') score += 0.08;
  return clamp01(score);
}

export function stableFragment(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(16).padStart(8, '0');
}

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

export function asScore01(value: number): Score01 {
  return clamp01(value) as Score01;
}

export function asUnixMs(value: number): UnixMs {
  return Math.trunc(value) as UnixMs;
}

export function asChatQuoteId(value: string): ChatQuoteId {
  return value as ChatQuoteId;
}

export function asChatQuoteFingerprint(value: string): ChatQuoteFingerprint {
  return value as ChatQuoteFingerprint;
}

export function asChatQuoteExcerptId(value: string): ChatQuoteExcerptId {
  return value as ChatQuoteExcerptId;
}

export function asChatQuoteTemplateId(value: string): ChatQuoteTemplateId {
  return value as ChatQuoteTemplateId;
}

export function coalesceMessageId(record: ChatQuoteRecord): ChatMessageId {
  return (
    record.range.sourceMessageId ??
    coalesceMessageIdFromSource(record.source) ??
    ('quote:synthetic-root' as ChatMessageId)
  );
}

export function coalesceMessageIdFromSource(source: ChatQuoteSourcePointer): ChatMessageId | null {
  return source.messageId ?? null;
}

export function compactMessageIds(
  ids: readonly (ChatMessageId | null | undefined)[],
): readonly ChatMessageId[] {
  return ids.filter((id): id is ChatMessageId => typeof id === 'string');
}

export function compactMemoryAnchorIds(
  ids: readonly (ChatMemoryAnchorId | null | undefined)[],
): readonly ChatMemoryAnchorId[] {
  return ids.filter((id): id is ChatMemoryAnchorId => typeof id === 'string');
}