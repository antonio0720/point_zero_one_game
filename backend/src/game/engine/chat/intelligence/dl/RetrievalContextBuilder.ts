/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT RETRIEVAL CONTEXT BUILDER
 * FILE: backend/src/game/engine/chat/intelligence/dl/RetrievalContextBuilder.ts
 * VERSION: 2026.03.21-retrieval-continuity.v2
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Deterministic context builder that turns ranked memory retrieval into
 * authored response context for backend chat.
 *
 * This file does not choose final text.
 * This file does not generate LLM prompts as a black box.
 * This file builds the continuity packet that upstream directors can use for:
 * - rival callbacks,
 * - helper rescue references,
 * - post-run interpretation,
 * - deal-room negotiation memory,
 * - scene planning,
 * - liveops memory overlays,
 * - emotional continuity / restraint decisions.
 *
 * Design doctrine
 * ---------------
 * - Retrieval must be explainable.
 * - Context must preserve why each memory was selected.
 * - Prompt-like output is optional and deterministic.
 * - The builder should remain useful even with no vector lane attached.
 * - Shared contract imports are canonical and must remain aligned with
 *   shared/contracts/chat/learning/*.
 * ============================================================================
 */

import type {
  MemoryAnchor,
  MemoryAnchorId,
  MemoryAnchorMatch,
  MemoryAnchorPreview,
  MemoryAnchorQueryIntent,
} from '../../../../../../../shared/contracts/chat/learning/MemoryAnchors';
import type {
  ConversationEmbeddingDocument,
  EmbeddingSearchMatch,
} from '../../../../../../../shared/contracts/chat/learning/ConversationEmbeddings';
import type {
  MemoryAnchorStoreApi,
  MemoryAnchorStoreQueryRequest,
  MemoryAnchorQueryResponse,
} from './MemoryAnchorStore';

export const RETRIEVAL_CONTEXT_BUILDER_VERSION =
  '2026.03.21-retrieval-continuity.v2' as const;

export const RETRIEVAL_CONTEXT_BUILDER_DEFAULTS = Object.freeze({
  maxPromptLines: 48,
  maxMemoryLines: 8,
  maxCallbackPhrases: 6,
  maxDebugLines: 24,
  maxAnchorTags: 6,
  maxPromptBlocks: 12,
  maxDocuments: 6,
  maxWhySelected: 5,
  maxReasonsPerDocument: 4,
  maxRecentFacts: 4,
  maxRecentTranscriptLines: 3,
  maxPreviewTags: 6,
  defaultLinkedDocumentScore: 0.42,
  defaultEmbeddingMatchScore: 0.5,
  maxDocumentPreviewLength: 120,
  maxSummaryLength: 160,
  maxCurrentMessageLength: 180,
  maxQueryLength: 180,
  maxTranscriptPreviewLength: 100,
});

export interface RetrievalContextBuildRequest extends MemoryAnchorStoreQueryRequest {
  readonly responseIntent:
    | 'BOT_RESPONSE'
    | 'HELPER_INTERVENTION'
    | 'HATER_TAUNT'
    | 'DEALROOM_COUNTER'
    | 'POSTRUN_NARRATION'
    | 'SCENE_PLANNING'
    | 'LIVEOPS_OVERLAY';
  readonly currentMessageText?: string;
  readonly recentTranscriptLines?: readonly string[];
  readonly recentSystemFacts?: readonly string[];
  readonly currentPressureTier?: string;
  readonly currentEmotionBand?: string;
  readonly currentAudienceHeat?: string;
  readonly currentRelationshipState?: string;
  readonly documents?: readonly ConversationEmbeddingDocument[];
  readonly rawEmbeddingMatches?: readonly EmbeddingSearchMatch[];
}

export interface RetrievalContextAnchorItem {
  readonly rank: number;
  readonly anchorId: MemoryAnchorId;
  readonly kind: string;
  readonly headline: string;
  readonly summary: string;
  readonly score: number;
  readonly retrievalScore: number;
  readonly finalSalience: number;
  readonly stabilityClass: string;
  readonly priority: string;
  readonly callbackPhrases: readonly string[];
  readonly relationshipRefs: readonly string[];
  readonly quoteRefs: readonly string[];
  readonly emotions: readonly string[];
  readonly tags: readonly string[];
  readonly preview: MemoryAnchorPreview;
  readonly whySelected: readonly string[];
}

export interface RetrievalContextDocumentItem {
  readonly documentId: string;
  readonly score: number;
  readonly sourceKind?: string;
  readonly purpose?: string;
  readonly preview?: string;
  readonly whySelected: readonly string[];
}

export interface RetrievalPromptBlock {
  readonly key:
    | 'ROLE'
    | 'INTENT'
    | 'CURRENT_STATE'
    | 'MEMORY_RECALL'
    | 'CALLBACK_OPTIONS'
    | 'RESTRAINTS'
    | 'TACTICAL_NOTES'
    | 'DEBUG';
  readonly title: string;
  readonly lines: readonly string[];
}

export interface RetrievalContextPacket {
  readonly version: typeof RETRIEVAL_CONTEXT_BUILDER_VERSION;
  readonly generatedAtMs: number;
  readonly responseIntent: RetrievalContextBuildRequest['responseIntent'];
  readonly memoryIntent: MemoryAnchorQueryIntent;
  readonly queryResponse: MemoryAnchorQueryResponse;
  readonly anchors: readonly RetrievalContextAnchorItem[];
  readonly anchorPreviews: readonly MemoryAnchorPreview[];
  readonly documents: readonly RetrievalContextDocumentItem[];
  readonly callbackPhrases: readonly string[];
  readonly restraintFlags: readonly string[];
  readonly tacticalNotes: readonly string[];
  readonly promptBlocks: readonly RetrievalPromptBlock[];
  readonly debugNotes: readonly string[];
}

export interface RetrievalContextBuilderOptions {
  readonly now?: () => number;
}

export interface RetrievalContextBuilderApi {
  readonly version: typeof RETRIEVAL_CONTEXT_BUILDER_VERSION;
  build(request: RetrievalContextBuildRequest): RetrievalContextPacket;
  toPrompt(packet: RetrievalContextPacket): string;
}

interface RetrievalBuildScratchInput {
  readonly request: RetrievalContextBuildRequest;
  readonly queryResponse: MemoryAnchorQueryResponse;
}

interface RetrievalBuildScratch {
  readonly anchors: readonly RetrievalContextAnchorItem[];
  readonly anchorPreviews: readonly MemoryAnchorPreview[];
  readonly documents: readonly RetrievalContextDocumentItem[];
  readonly callbackPhrases: readonly string[];
  readonly restraintFlags: readonly string[];
  readonly tacticalNotes: readonly string[];
  readonly debugNotes: readonly string[];
  readonly promptBlocks: readonly RetrievalPromptBlock[];
}

interface AnchorTraceComponent {
  readonly key: string;
  readonly value: number;
  readonly note?: string;
}

interface PromptBlockBuildInput {
  readonly request: RetrievalContextBuildRequest;
  readonly queryResponse: MemoryAnchorQueryResponse;
  readonly anchors: readonly RetrievalContextAnchorItem[];
  readonly anchorPreviews: readonly MemoryAnchorPreview[];
  readonly documents: readonly RetrievalContextDocumentItem[];
  readonly callbackPhrases: readonly string[];
  readonly restraintFlags: readonly string[];
  readonly tacticalNotes: readonly string[];
  readonly debugNotes: readonly string[];
}

export function createRetrievalContextBuilder(
  store: MemoryAnchorStoreApi,
  options: RetrievalContextBuilderOptions = {},
): RetrievalContextBuilderApi {
  const now = (): number => normalizeNow(options.now?.());

  const api: RetrievalContextBuilderApi = {
    version: RETRIEVAL_CONTEXT_BUILDER_VERSION,

    build(request: RetrievalContextBuildRequest): RetrievalContextPacket {
      const queryResponse = store.query(request);
      const scratch = buildScratch({ request, queryResponse });

      return Object.freeze({
        version: RETRIEVAL_CONTEXT_BUILDER_VERSION,
        generatedAtMs: now(),
        responseIntent: request.responseIntent,
        memoryIntent: queryResponse.query.intent,
        queryResponse,
        anchors: scratch.anchors,
        anchorPreviews: scratch.anchorPreviews,
        documents: scratch.documents,
        callbackPhrases: scratch.callbackPhrases,
        restraintFlags: scratch.restraintFlags,
        tacticalNotes: scratch.tacticalNotes,
        promptBlocks: scratch.promptBlocks,
        debugNotes: scratch.debugNotes,
      });
    },

    toPrompt(packet: RetrievalContextPacket): string {
      return packet.promptBlocks
        .slice(0, RETRIEVAL_CONTEXT_BUILDER_DEFAULTS.maxPromptBlocks)
        .map((block) => {
          const title = `[${block.key}] ${block.title}`;
          const lines = block.lines.map((line) => `- ${line}`).join('\n');
          return `${title}\n${lines}`;
        })
        .join('\n\n');
    },
  };

  return Object.freeze(api);
}

function buildScratch(input: RetrievalBuildScratchInput): RetrievalBuildScratch {
  const { request, queryResponse } = input;

  const anchors = Object.freeze(
    queryResponse.ranked.map((entry, index) =>
      toAnchorItem(
        index + 1,
        entry.anchor,
        entry.score,
        entry.projection,
        entry.trace.components as readonly AnchorTraceComponent[],
        queryResponse.previews[index],
      ),
    ),
  );

  const anchorPreviews = Object.freeze(
    anchors.map((anchor) => anchor.preview),
  );

  const documents = Object.freeze(
    selectDocumentsForAnchors({
      anchors,
      documents: request.documents,
      rawMatches: request.rawEmbeddingMatches,
      queryText: request.queryText,
    }),
  );

  const callbackPhrases = Object.freeze(
    anchors
      .flatMap((anchor) => anchor.callbackPhrases)
      .filter(unique)
      .filter((phrase) => !isAlreadyUsedCallback(phrase, request.alreadyUsedCallbackPhrases))
      .slice(0, RETRIEVAL_CONTEXT_BUILDER_DEFAULTS.maxCallbackPhrases),
  );

  const restraintFlags = Object.freeze(buildRestraintFlags(request, anchors));
  const tacticalNotes = Object.freeze(
    buildTacticalNotes(request, anchors, anchorPreviews, documents),
  );
  const debugNotes = Object.freeze(
    buildDebugNotes(queryResponse, anchorPreviews, documents, restraintFlags),
  );
  const promptBlocks = Object.freeze(
    buildPromptBlocks({
      request,
      queryResponse,
      anchors,
      anchorPreviews,
      documents,
      callbackPhrases,
      restraintFlags,
      tacticalNotes,
      debugNotes,
    }),
  );

  return Object.freeze({
    anchors,
    anchorPreviews,
    documents,
    callbackPhrases,
    restraintFlags,
    tacticalNotes,
    debugNotes,
    promptBlocks,
  });
}

function toAnchorItem(
  rank: number,
  anchor: MemoryAnchor,
  score: number,
  projection: MemoryAnchorMatch,
  components: readonly AnchorTraceComponent[],
  providedPreview?: MemoryAnchorPreview,
): RetrievalContextAnchorItem {
  const preview = providedPreview ?? createAnchorPreview(anchor, projection);

  return Object.freeze({
    rank,
    anchorId: anchor.id,
    kind: anchor.kind,
    headline: preview.title || anchor.payload.headline,
    summary: preview.summary || anchor.payload.summary,
    score: round4(score),
    retrievalScore: round4(projection.retrievalScore ?? score),
    finalSalience: round4(projection.finalSalience ?? anchor.salience.final),
    stabilityClass: anchor.stabilityClass,
    priority: anchor.retrieval.priority,
    callbackPhrases: Object.freeze(anchor.payload.callbackPhrases.slice(0, 6)),
    relationshipRefs: Object.freeze([...anchor.relationshipRefs]),
    quoteRefs: Object.freeze([...anchor.quoteRefs]),
    emotions: Object.freeze([...anchor.payload.emotions]),
    tags: Object.freeze(
      [
        ...preview.tags,
        ...anchor.payload.tags,
        ...anchor.payload.relationshipTags,
        ...anchor.payload.emotions,
      ]
        .map(normalizeTag)
        .filter(isNonEmptyString)
        .filter(unique)
        .slice(0, RETRIEVAL_CONTEXT_BUILDER_DEFAULTS.maxAnchorTags),
    ),
    preview,
    whySelected: Object.freeze(
      components
        .filter((component) => component.value > 0)
        .slice(0, RETRIEVAL_CONTEXT_BUILDER_DEFAULTS.maxWhySelected)
        .map((component) =>
          component.note
            ? `${component.key}=${round4(component.value)} (${component.note})`
            : `${component.key}=${round4(component.value)}`,
        ),
    ),
  });
}

function createAnchorPreview(
  anchor: MemoryAnchor,
  projection: MemoryAnchorMatch,
): MemoryAnchorPreview {
  return Object.freeze({
    id: (`cmp_${normalizeAnchorPreviewSeed(anchor.id)}`) as MemoryAnchorPreview['id'],
    anchorId: anchor.id,
    title: anchor.payload.headline,
    subtitle: [
      anchor.kind,
      anchor.stabilityClass,
      anchor.retrieval.priority,
      projection.matchedTags?.length ? `tags:${projection.matchedTags.length}` : '',
    ]
      .filter(isNonEmptyString)
      .join(' · '),
    summary: truncate(anchor.payload.summary, RETRIEVAL_CONTEXT_BUILDER_DEFAULTS.maxSummaryLength),
    tags: Object.freeze(
      [
        ...anchor.payload.tags,
        ...anchor.payload.relationshipTags,
        ...anchor.payload.emotions,
      ]
        .map(normalizeTag)
        .filter(isNonEmptyString)
        .filter(unique)
        .slice(0, RETRIEVAL_CONTEXT_BUILDER_DEFAULTS.maxPreviewTags),
    ),
    finalSalience: round4(projection.finalSalience ?? anchor.salience.final),
    retrievalPriority: anchor.retrieval.priority,
    stabilityClass: anchor.stabilityClass,
  });
}

function selectDocumentsForAnchors(input: {
  readonly anchors: readonly RetrievalContextAnchorItem[];
  readonly documents?: readonly ConversationEmbeddingDocument[];
  readonly rawMatches?: readonly EmbeddingSearchMatch[];
  readonly queryText?: string;
}): readonly RetrievalContextDocumentItem[] {
  const { anchors, documents, rawMatches, queryText } = input;

  if (!documents?.length && !rawMatches?.length) {
    return Object.freeze([]);
  }

  const anchorDocumentIds = collectAnchorDocumentIds(anchors);
  const explicitMatches = Object.freeze(
    (rawMatches ?? [])
      .map((match) => toDocumentItem(match, queryText))
      .filter(isDocumentItem),
  );

  const explicitMap = new Map<string, RetrievalContextDocumentItem>(
    explicitMatches.map((item) => [item.documentId, item] as const),
  );

  const documentItems: RetrievalContextDocumentItem[] = [];

  for (const document of documents ?? []) {
    const docId = readDocumentId(document);
    if (!docId) {
      continue;
    }

    if (
      anchorDocumentIds.size &&
      !anchorDocumentIds.has(docId) &&
      !explicitMap.has(docId)
    ) {
      continue;
    }

    documentItems.push(
      explicitMap.get(docId) ??
        Object.freeze({
          documentId: docId,
          score: scoreLinkedDocument(document, anchors, queryText),
          sourceKind: readDocumentSourceKind(document),
          purpose: readDocumentPurpose(document),
          preview: readDocumentPreview(document),
          whySelected: Object.freeze(
            buildLinkedDocumentReasons(document, anchors, queryText),
          ),
        }),
    );
  }

  for (const item of explicitMatches) {
    if (!documentItems.some((existing) => existing.documentId === item.documentId)) {
      documentItems.push(item);
    }
  }

  return Object.freeze(
    documentItems
      .sort(compareDocumentItems)
      .slice(0, RETRIEVAL_CONTEXT_BUILDER_DEFAULTS.maxDocuments),
  );
}

function collectAnchorDocumentIds(
  anchors: readonly RetrievalContextAnchorItem[],
): Set<string> {
  const ids = new Set<string>();

  for (const anchor of anchors) {
    for (const tag of anchor.tags) {
      if (looksLikeDocumentId(tag)) {
        ids.add(tag);
      }
    }
  }

  return ids;
}

function toDocumentItem(
  match: EmbeddingSearchMatch,
  queryText?: string,
): RetrievalContextDocumentItem | null {
  const record = match as unknown as Record<string, unknown>;
  const documentId = readString(record, 'documentId', 'document_id', 'id');
  if (!documentId) {
    return null;
  }

  const baseScore = round4(
    readNumber(record, 'score', 'similarity', 'rankScore') ??
      RETRIEVAL_CONTEXT_BUILDER_DEFAULTS.defaultEmbeddingMatchScore,
  );
  const preview = readString(record, 'preview', 'excerpt', 'text');
  const kind = readString(record, 'kind', 'matchKind');
  const reasons = [
    `embedding.match=${baseScore}`,
    kind ? `match.kind=${kind}` : 'match.kind=unknown',
  ];

  if (queryText && preview) {
    const queryOverlap = lexicalOverlapScore(queryText, preview);
    if (queryOverlap > 0) {
      reasons.push(`query.overlap=${round4(queryOverlap)}`);
    }
  }

  return Object.freeze({
    documentId,
    score: baseScore,
    sourceKind: readString(record, 'sourceKind', 'source_kind'),
    purpose: readString(record, 'purpose'),
    preview,
    whySelected: Object.freeze(
      reasons.slice(0, RETRIEVAL_CONTEXT_BUILDER_DEFAULTS.maxReasonsPerDocument),
    ),
  });
}

function buildLinkedDocumentReasons(
  document: ConversationEmbeddingDocument,
  anchors: readonly RetrievalContextAnchorItem[],
  queryText?: string,
): readonly string[] {
  const docId = readDocumentId(document);
  const preview = readDocumentPreview(document);
  const reasons: string[] = [];

  if (docId && anchors.some((anchor) => anchor.tags.includes(docId))) {
    reasons.push('document.linked_to_selected_anchor');
  }

  const previewTagHits = countMatchingAnchorPreviewTags(anchors, preview);
  if (previewTagHits > 0) {
    reasons.push(`anchor.tag_overlap=${previewTagHits}`);
  }

  if (queryText && preview) {
    const overlap = lexicalOverlapScore(queryText, preview);
    if (overlap > 0) {
      reasons.push(`query.overlap=${round4(overlap)}`);
    }
  }

  const purpose = readDocumentPurpose(document);
  if (purpose) {
    reasons.push(`document.purpose=${purpose}`);
  }

  return Object.freeze(
    reasons
      .filter(isNonEmptyString)
      .filter(unique)
      .slice(0, RETRIEVAL_CONTEXT_BUILDER_DEFAULTS.maxReasonsPerDocument),
  );
}

function scoreLinkedDocument(
  document: ConversationEmbeddingDocument,
  anchors: readonly RetrievalContextAnchorItem[],
  queryText?: string,
): number {
  const docId = readDocumentId(document);
  const preview = readDocumentPreview(document) ?? '';

  let score = RETRIEVAL_CONTEXT_BUILDER_DEFAULTS.defaultLinkedDocumentScore;

  if (docId && anchors.some((anchor) => anchor.tags.includes(docId))) {
    score += 0.18;
  }

  score += Math.min(0.18, countMatchingAnchorPreviewTags(anchors, preview) * 0.03);

  if (queryText) {
    score += lexicalOverlapScore(queryText, preview) * 0.14;
  }

  return round4(clampUnit(score));
}

function countMatchingAnchorPreviewTags(
  anchors: readonly RetrievalContextAnchorItem[],
  text: string | undefined,
): number {
  if (!text) {
    return 0;
  }

  const tokens = new Set(tokenize(text));
  let count = 0;

  for (const anchor of anchors) {
    for (const tag of anchor.preview.tags) {
      if (tokens.has(tag.toLowerCase())) {
        count += 1;
      }
    }
  }

  return count;
}

function buildRestraintFlags(
  request: RetrievalContextBuildRequest,
  anchors: readonly RetrievalContextAnchorItem[],
): readonly string[] {
  const flags: string[] = [];

  if (request.responseIntent === 'HELPER_INTERVENTION') {
    flags.push('prioritize_stabilizing_language');
    flags.push('avoid_piling_social_pressure');
  }

  if (request.responseIntent === 'HATER_TAUNT') {
    flags.push('taunt_must_be_personal_not_generic');
    flags.push('avoid_repeating_recent_callback_phrase');
  }

  if (request.responseIntent === 'DEALROOM_COUNTER') {
    flags.push('dealroom_lines_should_be_compact_and_leveraged');
    flags.push('avoid_public-channel phrasing'.replace(' ', '_'));
  }

  if (anchors.some((anchor) => anchor.kind === 'RESCUE')) {
    flags.push('preserve_rescue_continuity');
  }

  if (anchors.some((anchor) => anchor.kind === 'LEGEND')) {
    flags.push('do_not_flatten_prestige_moment');
  }

  if (request.currentPressureTier && /critical|breakpoint|collapse/i.test(request.currentPressureTier)) {
    flags.push('keep_line_count_tight_under_pressure');
  }

  if (request.currentEmotionBand && /frustrated|desperate|embarrassed/i.test(request.currentEmotionBand)) {
    flags.push('avoid_mocking_without_tactical_value');
  }

  if (request.currentAudienceHeat && /high|critical|mob|volatile/i.test(request.currentAudienceHeat)) {
    flags.push('acknowledge_room_heat_without_losing_clarity');
  }

  if (request.alreadyUsedCallbackPhrases?.length) {
    flags.push('avoid_already_used_callbacks');
  }

  return Object.freeze(flags.filter(unique));
}

function buildTacticalNotes(
  request: RetrievalContextBuildRequest,
  anchors: readonly RetrievalContextAnchorItem[],
  previews: readonly MemoryAnchorPreview[],
  documents: readonly RetrievalContextDocumentItem[],
): readonly string[] {
  const notes: string[] = [];

  if (request.currentAudienceHeat) {
    notes.push(`audience_heat=${request.currentAudienceHeat}`);
  }

  if (request.currentRelationshipState) {
    notes.push(`relationship_state=${request.currentRelationshipState}`);
  }

  if (request.currentPressureTier) {
    notes.push(`pressure_tier=${request.currentPressureTier}`);
  }

  if (request.currentEmotionBand) {
    notes.push(`emotion_band=${request.currentEmotionBand}`);
  }

  if (request.currentModeId) {
    notes.push(`mode=${request.currentModeId}`);
  }

  if (anchors.length) {
    notes.push(`top_anchor=${anchors[0].headline}`);
    notes.push(`top_anchor_kind=${anchors[0].kind}`);
    notes.push(`top_anchor_priority=${anchors[0].priority}`);
  }

  if (previews.length) {
    notes.push(`preview_titles=${previews.map((preview) => preview.title).slice(0, 3).join(' | ')}`);
  }

  if (anchors.some((anchor) => anchor.kind === 'QUOTE_REVERSAL')) {
    notes.push('prefer_quote_reversal_if_voice_allows');
  }

  if (anchors.some((anchor) => anchor.kind === 'DEALROOM_EXPOSURE')) {
    notes.push('deal_room_should_sound_predatory_and_precise');
  }

  if (documents.length) {
    notes.push(`documents_attached=${documents.length}`);
  }

  if (request.queryText) {
    notes.push(`query_text_present=${request.queryText.trim().length > 0}`);
  }

  return Object.freeze(notes.filter(unique));
}

function buildDebugNotes(
  queryResponse: MemoryAnchorQueryResponse,
  previews: readonly MemoryAnchorPreview[],
  documents: readonly RetrievalContextDocumentItem[],
  restraintFlags: readonly string[],
): readonly string[] {
  return Object.freeze([
    `intent=${queryResponse.query.intent}`,
    `candidateCount=${queryResponse.receipt.candidateCount}`,
    `returnedCount=${queryResponse.receipt.returnedCount}`,
    `previewCount=${previews.length}`,
    `documentCount=${documents.length}`,
    `restraintCount=${restraintFlags.length}`,
    `shadowCount=${queryResponse.shadowMatches.length}`,
    ...queryResponse.receipt.debugNotes,
    ...queryResponse.debugNotes,
  ]);
}

function buildPromptBlocks(input: PromptBlockBuildInput): readonly RetrievalPromptBlock[] {
  const roleTitle = describeResponseIntent(input.request.responseIntent);
  const blocks: RetrievalPromptBlock[] = [];

  blocks.push(
    block('ROLE', 'Response lane', [
      `authoring_role=${roleTitle}`,
      `memory_intent=${input.queryResponse.query.intent}`,
      `channel=${input.queryResponse.query.channelId ?? 'UNSCOPED'}`,
      `room=${input.queryResponse.query.roomId ?? 'UNSCOPED'}`,
      `mode=${input.request.currentModeId ?? 'UNSCOPED'}`,
    ]),
  );

  blocks.push(
    block('INTENT', 'Current situation', [
      input.request.currentMessageText
        ? `current_message="${truncate(input.request.currentMessageText, RETRIEVAL_CONTEXT_BUILDER_DEFAULTS.maxCurrentMessageLength)}"`
        : 'current_message=none',
      input.request.queryText
        ? `retrieval_query="${truncate(input.request.queryText, RETRIEVAL_CONTEXT_BUILDER_DEFAULTS.maxQueryLength)}"`
        : 'retrieval_query=implicit',
      input.request.currentPressureTier
        ? `pressure=${input.request.currentPressureTier}`
        : 'pressure=unknown',
      input.request.currentEmotionBand
        ? `emotion_band=${input.request.currentEmotionBand}`
        : 'emotion_band=unknown',
    ]),
  );

  blocks.push(
    block('CURRENT_STATE', 'Immediate state cues', [
      input.request.currentAudienceHeat
        ? `audience_heat=${input.request.currentAudienceHeat}`
        : 'audience_heat=unspecified',
      input.request.currentRelationshipState
        ? `relationship_state=${input.request.currentRelationshipState}`
        : 'relationship_state=unspecified',
      input.request.recentSystemFacts?.length
        ? `recent_system_facts=${input.request.recentSystemFacts.slice(0, RETRIEVAL_CONTEXT_BUILDER_DEFAULTS.maxRecentFacts).join(' | ')}`
        : 'recent_system_facts=none',
      input.request.recentTranscriptLines?.length
        ? `recent_transcript=${input.request.recentTranscriptLines
            .slice(-RETRIEVAL_CONTEXT_BUILDER_DEFAULTS.maxRecentTranscriptLines)
            .map((line) => truncate(line, RETRIEVAL_CONTEXT_BUILDER_DEFAULTS.maxTranscriptPreviewLength))
            .join(' | ')}`
        : 'recent_transcript=none',
    ]),
  );

  const memoryLines = input.anchors
    .slice(0, RETRIEVAL_CONTEXT_BUILDER_DEFAULTS.maxMemoryLines)
    .map(
      (anchor) =>
        `${anchor.rank}. ${anchor.headline} [${anchor.kind}] score=${round4(anchor.score)} salience=${anchor.finalSalience} :: ${truncate(anchor.summary, RETRIEVAL_CONTEXT_BUILDER_DEFAULTS.maxSummaryLength)} :: why=${anchor.whySelected.join('; ')}`,
    );

  if (memoryLines.length) {
    blocks.push(block('MEMORY_RECALL', 'Selected memory anchors', memoryLines));
  }

  if (input.callbackPhrases.length) {
    blocks.push(
      block(
        'CALLBACK_OPTIONS',
        'Available callback phrases',
        input.callbackPhrases.map(
          (phrase, index) => `${index + 1}. ${truncate(phrase, 120)}`,
        ),
      ),
    );
  }

  if (input.documents.length) {
    blocks.push(
      block(
        'TACTICAL_NOTES',
        'Retrieved document support',
        input.documents.map(
          (document, index) =>
            `${index + 1}. ${document.documentId} score=${round4(document.score)} :: ${truncate(document.preview ?? 'no_preview', RETRIEVAL_CONTEXT_BUILDER_DEFAULTS.maxDocumentPreviewLength)} :: why=${document.whySelected.join('; ')}`,
        ),
      ),
    );
  }

  if (input.restraintFlags.length) {
    blocks.push(
      block('RESTRAINTS', 'Guardrails', input.restraintFlags.map((flag) => flag)),
    );
  }

  if (input.tacticalNotes.length) {
    blocks.push(
      block('TACTICAL_NOTES', 'Tactical notes', input.tacticalNotes.map((note) => note)),
    );
  }

  blocks.push(
    block(
      'DEBUG',
      'Retrieval diagnostics',
      input.debugNotes.slice(0, RETRIEVAL_CONTEXT_BUILDER_DEFAULTS.maxDebugLines),
    ),
  );

  return Object.freeze(blocks.slice(0, RETRIEVAL_CONTEXT_BUILDER_DEFAULTS.maxPromptBlocks));
}

function block(
  key: RetrievalPromptBlock['key'],
  title: string,
  lines: readonly string[],
): RetrievalPromptBlock {
  return Object.freeze({
    key,
    title,
    lines: Object.freeze(
      lines
        .filter(isNonEmptyString)
        .slice(0, RETRIEVAL_CONTEXT_BUILDER_DEFAULTS.maxPromptLines),
    ),
  });
}

function describeResponseIntent(
  intent: RetrievalContextBuildRequest['responseIntent'],
): string {
  switch (intent) {
    case 'BOT_RESPONSE':
      return 'general_chat_response';
    case 'HELPER_INTERVENTION':
      return 'helper_rescue_or_guidance';
    case 'HATER_TAUNT':
      return 'personalized_rival_pressure';
    case 'DEALROOM_COUNTER':
      return 'dealroom_negotiation_counter';
    case 'POSTRUN_NARRATION':
      return 'postrun_interpretive_narration';
    case 'SCENE_PLANNING':
      return 'scene_beat_planning';
    case 'LIVEOPS_OVERLAY':
      return 'world_event_overlay';
    default:
      return 'unknown';
  }
}

function readDocumentId(document: ConversationEmbeddingDocument): string | undefined {
  const record = document as unknown as Record<string, unknown>;
  return readString(record, 'id', 'documentId', 'document_id');
}

function readDocumentSourceKind(
  document: ConversationEmbeddingDocument,
): string | undefined {
  const record = document as unknown as Record<string, unknown>;
  return readString(record, 'sourceKind', 'source_kind');
}

function readDocumentPurpose(document: ConversationEmbeddingDocument): string | undefined {
  const record = document as unknown as Record<string, unknown>;
  return readString(record, 'purpose');
}

function readDocumentPreview(document: ConversationEmbeddingDocument): string | undefined {
  const record = document as unknown as Record<string, unknown>;
  return readString(record, 'preview', 'summary', 'text', 'content');
}

function readString(
  record: Record<string, unknown>,
  ...keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function readNumber(
  record: Record<string, unknown>,
  ...keys: readonly string[]
): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function normalizeNow(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : Date.now();
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function normalizeAnchorPreviewSeed(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 96) || 'unknown';
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase();
}

function tokenize(value: string): readonly string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .map((token) => token.trim())
    .filter(isNonEmptyString);
}

function lexicalOverlapScore(left: string, right: string): number {
  const leftTokens = tokenize(left);
  const rightTokenSet = new Set(tokenize(right));

  if (!leftTokens.length || !rightTokenSet.size) {
    return 0;
  }

  let hits = 0;
  for (const token of leftTokens) {
    if (rightTokenSet.has(token)) {
      hits += 1;
    }
  }

  return clampUnit(hits / Math.max(1, leftTokens.length));
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function looksLikeDocumentId(value: string): boolean {
  return /^(ced_|doc_|emb_|document_)/i.test(value.trim());
}

function isAlreadyUsedCallback(
  phrase: string,
  alreadyUsed?: readonly string[],
): boolean {
  if (!alreadyUsed?.length) {
    return false;
  }

  const normalized = phrase.trim().toLowerCase();
  return alreadyUsed.some((entry) => entry.trim().toLowerCase() === normalized);
}

function compareDocumentItems(
  left: RetrievalContextDocumentItem,
  right: RetrievalContextDocumentItem,
): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }
  return left.documentId.localeCompare(right.documentId);
}

function isNonEmptyString(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDocumentItem(
  value: RetrievalContextDocumentItem | null,
): value is RetrievalContextDocumentItem {
  return Boolean(value);
}

function unique<T>(value: T, index: number, values: readonly T[]): boolean {
  return values.indexOf(value) === index;
}
