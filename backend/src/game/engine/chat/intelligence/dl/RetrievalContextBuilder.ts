/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT RETRIEVAL CONTEXT BUILDER
 * FILE: backend/src/game/engine/chat/intelligence/dl/RetrievalContextBuilder.ts
 * VERSION: 2026.03.22-retrieval-continuity.v15
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
  '2026.03.22-retrieval-continuity.v15' as const;

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






/**
 * ============================================================================
 * Retrieval Context Supplemental Diagnostics & Selection Helpers
 * These utilities are deterministic and side-effect free. They are intentionally
 * colocated with the builder so directors, tests, replay tools, and analytics
 * lanes can reuse identical logic without importing UI or orchestration code.
 * ============================================================================
 */

export const RETRIEVAL_CONTEXT_ANALYZER_VERSION =
  '2026.03.22-retrieval-analyzers.v1' as const;

export interface RetrievalContextSummary {
  readonly responseIntent: RetrievalContextPacket['responseIntent'];
  readonly memoryIntent: RetrievalContextPacket['memoryIntent'];
  readonly topAnchorId?: MemoryAnchorId;
  readonly topAnchorHeadline?: string;
  readonly topDocumentId?: string;
  readonly callbackCount: number;
  readonly restraintCount: number;
  readonly tacticalCount: number;
  readonly promptBlockCount: number;
  readonly debugCount: number;
}

export function summarizeRetrievalContextPacket(
  packet: RetrievalContextPacket,
): RetrievalContextSummary {
  return Object.freeze({
    responseIntent: packet.responseIntent,
    memoryIntent: packet.memoryIntent,
    topAnchorId: packet.anchors[0]?.anchorId,
    topAnchorHeadline: packet.anchors[0]?.headline,
    topDocumentId: packet.documents[0]?.documentId,
    callbackCount: packet.callbackPhrases.length,
    restraintCount: packet.restraintFlags.length,
    tacticalCount: packet.tacticalNotes.length,
    promptBlockCount: packet.promptBlocks.length,
    debugCount: packet.debugNotes.length,
  });
}

export function hasAnyAnchors(packet: RetrievalContextPacket): boolean {
  return packet.anchors.length > 0;
}

export function hasAnyDocuments(packet: RetrievalContextPacket): boolean {
  return packet.documents.length > 0;
}

export function hasAnyCallbacks(packet: RetrievalContextPacket): boolean {
  return packet.callbackPhrases.length > 0;
}

export function hasAnyRestraints(packet: RetrievalContextPacket): boolean {
  return packet.restraintFlags.length > 0;
}

export function hasAnyTacticalNotes(packet: RetrievalContextPacket): boolean {
  return packet.tacticalNotes.length > 0;
}

export function getTopAnchor(
  packet: RetrievalContextPacket,
): RetrievalContextAnchorItem | null {
  return packet.anchors[0] ?? null;
}

export function getTopDocument(
  packet: RetrievalContextPacket,
): RetrievalContextDocumentItem | null {
  return packet.documents[0] ?? null;
}

export function getTopCallback(
  packet: RetrievalContextPacket,
): string | null {
  return packet.callbackPhrases[0] ?? null;
}

export function getTopPromptBlock(
  packet: RetrievalContextPacket,
): RetrievalPromptBlock | null {
  return packet.promptBlocks[0] ?? null;
}

export function retrievalContextIsBotResponse(
  packet: RetrievalContextPacket,
): boolean {
  return packet.responseIntent === 'BOT_RESPONSE';
}

export function requestIsBotResponse(
  request: RetrievalContextBuildRequest,
): boolean {
  return request.responseIntent === 'BOT_RESPONSE';
}

export function retrievalContextIsHelperIntervention(
  packet: RetrievalContextPacket,
): boolean {
  return packet.responseIntent === 'HELPER_INTERVENTION';
}

export function requestIsHelperIntervention(
  request: RetrievalContextBuildRequest,
): boolean {
  return request.responseIntent === 'HELPER_INTERVENTION';
}

export function retrievalContextIsHaterTaunt(
  packet: RetrievalContextPacket,
): boolean {
  return packet.responseIntent === 'HATER_TAUNT';
}

export function requestIsHaterTaunt(
  request: RetrievalContextBuildRequest,
): boolean {
  return request.responseIntent === 'HATER_TAUNT';
}

export function retrievalContextIsDealroomCounter(
  packet: RetrievalContextPacket,
): boolean {
  return packet.responseIntent === 'DEALROOM_COUNTER';
}

export function requestIsDealroomCounter(
  request: RetrievalContextBuildRequest,
): boolean {
  return request.responseIntent === 'DEALROOM_COUNTER';
}

export function retrievalContextIsPostrunNarration(
  packet: RetrievalContextPacket,
): boolean {
  return packet.responseIntent === 'POSTRUN_NARRATION';
}

export function requestIsPostrunNarration(
  request: RetrievalContextBuildRequest,
): boolean {
  return request.responseIntent === 'POSTRUN_NARRATION';
}

export function retrievalContextIsScenePlanning(
  packet: RetrievalContextPacket,
): boolean {
  return packet.responseIntent === 'SCENE_PLANNING';
}

export function requestIsScenePlanning(
  request: RetrievalContextBuildRequest,
): boolean {
  return request.responseIntent === 'SCENE_PLANNING';
}

export function retrievalContextIsLiveopsOverlay(
  packet: RetrievalContextPacket,
): boolean {
  return packet.responseIntent === 'LIVEOPS_OVERLAY';
}

export function requestIsLiveopsOverlay(
  request: RetrievalContextBuildRequest,
): boolean {
  return request.responseIntent === 'LIVEOPS_OVERLAY';
}

export function packetHasRescueAnchor(
  packet: RetrievalContextPacket,
): boolean {
  return packet.anchors.some((anchor) => anchor.kind === 'RESCUE');
}

export function anchorIsRescue(
  anchor: RetrievalContextAnchorItem,
): boolean {
  return anchor.kind === 'RESCUE';
}

export function packetHasLegendAnchor(
  packet: RetrievalContextPacket,
): boolean {
  return packet.anchors.some((anchor) => anchor.kind === 'LEGEND');
}

export function anchorIsLegend(
  anchor: RetrievalContextAnchorItem,
): boolean {
  return anchor.kind === 'LEGEND';
}

export function packetHasQuoteReversalAnchor(
  packet: RetrievalContextPacket,
): boolean {
  return packet.anchors.some((anchor) => anchor.kind === 'QUOTE_REVERSAL');
}

export function anchorIsQuoteReversal(
  anchor: RetrievalContextAnchorItem,
): boolean {
  return anchor.kind === 'QUOTE_REVERSAL';
}

export function packetHasDealroomExposureAnchor(
  packet: RetrievalContextPacket,
): boolean {
  return packet.anchors.some((anchor) => anchor.kind === 'DEALROOM_EXPOSURE');
}

export function anchorIsDealroomExposure(
  anchor: RetrievalContextAnchorItem,
): boolean {
  return anchor.kind === 'DEALROOM_EXPOSURE';
}

export function packetHasWorldEventAnchor(
  packet: RetrievalContextPacket,
): boolean {
  return packet.anchors.some((anchor) => anchor.kind === 'WORLD_EVENT');
}

export function anchorIsWorldEvent(
  anchor: RetrievalContextAnchorItem,
): boolean {
  return anchor.kind === 'WORLD_EVENT';
}

export function packetHasPromiseAnchor(
  packet: RetrievalContextPacket,
): boolean {
  return packet.anchors.some((anchor) => anchor.kind === 'PROMISE');
}

export function anchorIsPromise(
  anchor: RetrievalContextAnchorItem,
): boolean {
  return anchor.kind === 'PROMISE';
}

export function packetHasBetrayalAnchor(
  packet: RetrievalContextPacket,
): boolean {
  return packet.anchors.some((anchor) => anchor.kind === 'BETRAYAL');
}

export function anchorIsBetrayal(
  anchor: RetrievalContextAnchorItem,
): boolean {
  return anchor.kind === 'BETRAYAL';
}

export function packetHasComebackAnchor(
  packet: RetrievalContextPacket,
): boolean {
  return packet.anchors.some((anchor) => anchor.kind === 'COMEBACK');
}

export function anchorIsComeback(
  anchor: RetrievalContextAnchorItem,
): boolean {
  return anchor.kind === 'COMEBACK';
}

export function packetHasCollapseAnchor(
  packet: RetrievalContextPacket,
): boolean {
  return packet.anchors.some((anchor) => anchor.kind === 'COLLAPSE');
}

export function anchorIsCollapse(
  anchor: RetrievalContextAnchorItem,
): boolean {
  return anchor.kind === 'COLLAPSE';
}

export function packetHasHumiliationAnchor(
  packet: RetrievalContextPacket,
): boolean {
  return packet.anchors.some((anchor) => anchor.kind === 'HUMILIATION');
}

export function anchorIsHumiliation(
  anchor: RetrievalContextAnchorItem,
): boolean {
  return anchor.kind === 'HUMILIATION';
}

export function packetHasHypeAnchor(
  packet: RetrievalContextPacket,
): boolean {
  return packet.anchors.some((anchor) => anchor.kind === 'HYPE');
}

export function anchorIsHype(
  anchor: RetrievalContextAnchorItem,
): boolean {
  return anchor.kind === 'HYPE';
}

export function packetHasThreatAnchor(
  packet: RetrievalContextPacket,
): boolean {
  return packet.anchors.some((anchor) => anchor.kind === 'THREAT');
}

export function anchorIsThreat(
  anchor: RetrievalContextAnchorItem,
): boolean {
  return anchor.kind === 'THREAT';
}

export function packetHasClutchAnchor(
  packet: RetrievalContextPacket,
): boolean {
  return packet.anchors.some((anchor) => anchor.kind === 'CLUTCH');
}

export function anchorIsClutch(
  anchor: RetrievalContextAnchorItem,
): boolean {
  return anchor.kind === 'CLUTCH';
}

export function packetHasWarningAnchor(
  packet: RetrievalContextPacket,
): boolean {
  return packet.anchors.some((anchor) => anchor.kind === 'WARNING');
}

export function anchorIsWarning(
  anchor: RetrievalContextAnchorItem,
): boolean {
  return anchor.kind === 'WARNING';
}

export function packetHasReceiptAnchor(
  packet: RetrievalContextPacket,
): boolean {
  return packet.anchors.some((anchor) => anchor.kind === 'RECEIPT');
}

export function anchorIsReceipt(
  anchor: RetrievalContextAnchorItem,
): boolean {
  return anchor.kind === 'RECEIPT';
}

export function packetHasRivalryAnchor(
  packet: RetrievalContextPacket,
): boolean {
  return packet.anchors.some((anchor) => anchor.kind === 'RIVALRY');
}

export function anchorIsRivalry(
  anchor: RetrievalContextAnchorItem,
): boolean {
  return anchor.kind === 'RIVALRY';
}

export function packetHasNegotiationAnchor(
  packet: RetrievalContextPacket,
): boolean {
  return packet.anchors.some((anchor) => anchor.kind === 'NEGOTIATION');
}

export function anchorIsNegotiation(
  anchor: RetrievalContextAnchorItem,
): boolean {
  return anchor.kind === 'NEGOTIATION';
}

export function packetHasVowAnchor(
  packet: RetrievalContextPacket,
): boolean {
  return packet.anchors.some((anchor) => anchor.kind === 'VOW');
}

export function anchorIsVow(
  anchor: RetrievalContextAnchorItem,
): boolean {
  return anchor.kind === 'VOW';
}

export function packetHasAllianceAnchor(
  packet: RetrievalContextPacket,
): boolean {
  return packet.anchors.some((anchor) => anchor.kind === 'ALLIANCE');
}

export function anchorIsAlliance(
  anchor: RetrievalContextAnchorItem,
): boolean {
  return anchor.kind === 'ALLIANCE';
}

export function packetHasSystemMarkerAnchor(
  packet: RetrievalContextPacket,
): boolean {
  return packet.anchors.some((anchor) => anchor.kind === 'SYSTEM_MARKER');
}

export function anchorIsSystemMarker(
  anchor: RetrievalContextAnchorItem,
): boolean {
  return anchor.kind === 'SYSTEM_MARKER';
}

export function requestMatchesPressureCritical(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentPressureTier;
  return typeof source === 'string' && /critical/i.test(source);
}

export function requestMatchesPressureBreakpoint(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentPressureTier;
  return typeof source === 'string' && /breakpoint/i.test(source);
}

export function requestMatchesPressureCollapse(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentPressureTier;
  return typeof source === 'string' && /collapse/i.test(source);
}

export function requestMatchesPressureHigh(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentPressureTier;
  return typeof source === 'string' && /high/i.test(source);
}

export function requestMatchesPressureElevated(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentPressureTier;
  return typeof source === 'string' && /elevated/i.test(source);
}

export function requestMatchesPressureVolatile(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentPressureTier;
  return typeof source === 'string' && /volatile/i.test(source);
}

export function requestMatchesPressureReset(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentPressureTier;
  return typeof source === 'string' && /reset/i.test(source);
}

export function requestMatchesPressureCalm(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentPressureTier;
  return typeof source === 'string' && /calm/i.test(source);
}

export function requestMatchesEmotionFrustrated(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentEmotionBand;
  return typeof source === 'string' && /frustrated/i.test(source);
}

export function requestMatchesEmotionDesperate(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentEmotionBand;
  return typeof source === 'string' && /desperate/i.test(source);
}

export function requestMatchesEmotionEmbarrassed(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentEmotionBand;
  return typeof source === 'string' && /embarrassed/i.test(source);
}

export function requestMatchesEmotionAngry(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentEmotionBand;
  return typeof source === 'string' && /angry/i.test(source);
}

export function requestMatchesEmotionAnxious(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentEmotionBand;
  return typeof source === 'string' && /anxious/i.test(source);
}

export function requestMatchesEmotionHaunted(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentEmotionBand;
  return typeof source === 'string' && /haunted/i.test(source);
}

export function requestMatchesEmotionHopeful(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentEmotionBand;
  return typeof source === 'string' && /hopeful/i.test(source);
}

export function requestMatchesEmotionTriumphant(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentEmotionBand;
  return typeof source === 'string' && /triumphant/i.test(source);
}

export function requestMatchesEmotionCold(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentEmotionBand;
  return typeof source === 'string' && /cold/i.test(source);
}

export function requestMatchesEmotionCalm(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentEmotionBand;
  return typeof source === 'string' && /calm/i.test(source);
}

export function requestMatchesAudienceHigh(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentAudienceHeat;
  return typeof source === 'string' && /high/i.test(source);
}

export function requestMatchesAudienceCritical(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentAudienceHeat;
  return typeof source === 'string' && /critical/i.test(source);
}

export function requestMatchesAudienceMob(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentAudienceHeat;
  return typeof source === 'string' && /mob/i.test(source);
}

export function requestMatchesAudienceVolatile(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentAudienceHeat;
  return typeof source === 'string' && /volatile/i.test(source);
}

export function requestMatchesAudienceHot(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentAudienceHeat;
  return typeof source === 'string' && /hot/i.test(source);
}

export function requestMatchesAudienceCalm(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentAudienceHeat;
  return typeof source === 'string' && /calm/i.test(source);
}

export function requestMatchesRelationshipAlly(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentRelationshipState;
  return typeof source === 'string' && /ally/i.test(source);
}

export function requestMatchesRelationshipRival(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentRelationshipState;
  return typeof source === 'string' && /rival/i.test(source);
}

export function requestMatchesRelationshipDistrust(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentRelationshipState;
  return typeof source === 'string' && /distrust/i.test(source);
}

export function requestMatchesRelationshipMentor(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentRelationshipState;
  return typeof source === 'string' && /mentor/i.test(source);
}

export function requestMatchesRelationshipHunted(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentRelationshipState;
  return typeof source === 'string' && /hunted/i.test(source);
}

export function requestMatchesRelationshipFascinated(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentRelationshipState;
  return typeof source === 'string' && /fascinated/i.test(source);
}

export function requestMatchesRelationshipBroken(
  request: RetrievalContextBuildRequest,
): boolean {
  const source =
    request.currentRelationshipState;
  return typeof source === 'string' && /broken/i.test(source);
}

export function getRetrievalContextAnchorIds(
  packet: RetrievalContextPacket,
): readonly any[] {
  return Object.freeze(packet.anchors.map((anchor) => anchor.anchorId));
}

export function getRetrievalContextAnchorKinds(
  packet: RetrievalContextPacket,
): readonly any[] {
  return Object.freeze(packet.anchors.map((anchor) => anchor.kind));
}

export function getRetrievalContextAnchorHeadlines(
  packet: RetrievalContextPacket,
): readonly any[] {
  return Object.freeze(packet.anchors.map((anchor) => anchor.headline));
}

export function getRetrievalContextAnchorScores(
  packet: RetrievalContextPacket,
): readonly any[] {
  return Object.freeze(packet.anchors.map((anchor) => anchor.score));
}

export function getRetrievalContextAnchorSalience(
  packet: RetrievalContextPacket,
): readonly any[] {
  return Object.freeze(packet.anchors.map((anchor) => anchor.finalSalience));
}

export function getRetrievalContextDocumentIds(
  packet: RetrievalContextPacket,
): readonly any[] {
  return Object.freeze(packet.documents.map((document) => document.documentId));
}

export function getRetrievalContextDocumentScores(
  packet: RetrievalContextPacket,
): readonly any[] {
  return Object.freeze(packet.documents.map((document) => document.score));
}

export function getRetrievalContextCallbackPhrases(
  packet: RetrievalContextPacket,
): readonly any[] {
  return Object.freeze(packet.callbackPhrases);
}

export function getRetrievalContextRestraintFlags(
  packet: RetrievalContextPacket,
): readonly any[] {
  return Object.freeze(packet.restraintFlags);
}

export function getRetrievalContextTacticalNotes(
  packet: RetrievalContextPacket,
): readonly any[] {
  return Object.freeze(packet.tacticalNotes);
}

export function getRetrievalContextDebugNotes(
  packet: RetrievalContextPacket,
): readonly any[] {
  return Object.freeze(packet.debugNotes);
}

export function getAnchorById(
  packet: RetrievalContextPacket,
  anchorId: MemoryAnchorId,
): RetrievalContextAnchorItem | null {
  return packet.anchors.find((anchor) => anchor.anchorId === anchorId) ?? null;
}

export function getDocumentById(
  packet: RetrievalContextPacket,
  documentId: string,
): RetrievalContextDocumentItem | null {
  return packet.documents.find((document) => document.documentId === documentId) ?? null;
}

export function getPromptBlockByKey(
  packet: RetrievalContextPacket,
  key: RetrievalPromptBlock['key'],
): RetrievalPromptBlock | null {
  return packet.promptBlocks.find((block) => block.key === key) ?? null;
}

export function listPromptBlockKeys(
  packet: RetrievalContextPacket,
): readonly RetrievalPromptBlock['key'][] {
  return Object.freeze(packet.promptBlocks.map((block) => block.key));
}

export function flattenPromptBlockLines(
  packet: RetrievalContextPacket,
): readonly string[] {
  return Object.freeze(packet.promptBlocks.flatMap((block) => block.lines));
}

export function renderPromptBlock(
  block: RetrievalPromptBlock,
): string {
  return [`[${block.key}] ${block.title}`, ...block.lines.map((line) => `- ${line}`)].join('\n');
}

export function renderPromptBlocks(
  packet: RetrievalContextPacket,
): string {
  return packet.promptBlocks.map(renderPromptBlock).join('\n\n');
}

export function collectAllAnchorTags(
  packet: RetrievalContextPacket,
): readonly string[] {
  return Object.freeze(
    packet.anchors.flatMap((anchor) => anchor.tags).filter(unique),
  );
}

export function collectAllAnchorEmotions(
  packet: RetrievalContextPacket,
): readonly string[] {
  return Object.freeze(
    packet.anchors.flatMap((anchor) => anchor.emotions).filter(unique),
  );
}

export function collectAllRelationshipRefs(
  packet: RetrievalContextPacket,
): readonly string[] {
  return Object.freeze(
    packet.anchors.flatMap((anchor) => anchor.relationshipRefs).filter(unique),
  );
}

export function collectAllQuoteRefs(
  packet: RetrievalContextPacket,
): readonly string[] {
  return Object.freeze(
    packet.anchors.flatMap((anchor) => anchor.quoteRefs).filter(unique),
  );
}

export function averageAnchorScore(
  packet: RetrievalContextPacket,
): number {
  if (!packet.anchors.length) {
    return 0;
  }

  return round4(
    packet.anchors.reduce((sum, anchor) => sum + anchor.score, 0) / packet.anchors.length,
  );
}

export function averageAnchorSalience(
  packet: RetrievalContextPacket,
): number {
  if (!packet.anchors.length) {
    return 0;
  }

  return round4(
    packet.anchors.reduce((sum, anchor) => sum + anchor.finalSalience, 0) /
      packet.anchors.length,
  );
}

export function averageDocumentScore(
  packet: RetrievalContextPacket,
): number {
  if (!packet.documents.length) {
    return 0;
  }

  return round4(
    packet.documents.reduce((sum, document) => sum + document.score, 0) /
      packet.documents.length,
  );
}

export function highestAnchorScore(
  packet: RetrievalContextPacket,
): number {
  return round4(
    Math.max(0, ...packet.anchors.map((anchor) => anchor.score)),
  );
}

export function highestDocumentScore(
  packet: RetrievalContextPacket,
): number {
  return round4(
    Math.max(0, ...packet.documents.map((document) => document.score)),
  );
}

export function countAnchorsByKind(
  packet: RetrievalContextPacket,
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};

  for (const anchor of packet.anchors) {
    counts[anchor.kind] = (counts[anchor.kind] ?? 0) + 1;
  }

  return Object.freeze({ ...counts });
}

export function countPromptBlocksByKey(
  packet: RetrievalContextPacket,
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};

  for (const block of packet.promptBlocks) {
    counts[block.key] = (counts[block.key] ?? 0) + 1;
  }

  return Object.freeze({ ...counts });
}

export function countDocumentsBySourceKind(
  packet: RetrievalContextPacket,
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};

  for (const document of packet.documents) {
    const key = document.sourceKind ?? 'UNKNOWN';
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return Object.freeze({ ...counts });
}

export function selectAnchorsByMinimumScore(
  packet: RetrievalContextPacket,
  minimumScore: number,
): readonly RetrievalContextAnchorItem[] {
  return Object.freeze(
    packet.anchors.filter((anchor) => anchor.score >= minimumScore),
  );
}

export function selectDocumentsByMinimumScore(
  packet: RetrievalContextPacket,
  minimumScore: number,
): readonly RetrievalContextDocumentItem[] {
  return Object.freeze(
    packet.documents.filter((document) => document.score >= minimumScore),
  );
}

export function selectAnchorsByPriority(
  packet: RetrievalContextPacket,
  priority: string,
): readonly RetrievalContextAnchorItem[] {
  return Object.freeze(
    packet.anchors.filter((anchor) => anchor.priority === priority),
  );
}

export function selectAnchorsByStabilityClass(
  packet: RetrievalContextPacket,
  stabilityClass: string,
): readonly RetrievalContextAnchorItem[] {
  return Object.freeze(
    packet.anchors.filter((anchor) => anchor.stabilityClass === stabilityClass),
  );
}

export function selectDocumentsByPurpose(
  packet: RetrievalContextPacket,
  purpose: string,
): readonly RetrievalContextDocumentItem[] {
  return Object.freeze(
    packet.documents.filter((document) => document.purpose === purpose),
  );
}

export function selectAnchorsByTag(
  packet: RetrievalContextPacket,
  tag: string,
): readonly RetrievalContextAnchorItem[] {
  const normalized = tag.trim().toLowerCase();
  return Object.freeze(
    packet.anchors.filter((anchor) =>
      anchor.tags.some((value) => value.trim().toLowerCase() === normalized),
    ),
  );
}

export function selectAnchorsByEmotion(
  packet: RetrievalContextPacket,
  emotion: string,
): readonly RetrievalContextAnchorItem[] {
  const normalized = emotion.trim().toLowerCase();
  return Object.freeze(
    packet.anchors.filter((anchor) =>
      anchor.emotions.some((value) => value.trim().toLowerCase() === normalized),
    ),
  );
}

export function selectAnchorsByRelationshipRef(
  packet: RetrievalContextPacket,
  relationshipRef: string,
): readonly RetrievalContextAnchorItem[] {
  const normalized = relationshipRef.trim().toLowerCase();
  return Object.freeze(
    packet.anchors.filter((anchor) =>
      anchor.relationshipRefs.some((value) => value.trim().toLowerCase() === normalized),
    ),
  );
}

export function selectAnchorsByQuoteRef(
  packet: RetrievalContextPacket,
  quoteRef: string,
): readonly RetrievalContextAnchorItem[] {
  const normalized = quoteRef.trim().toLowerCase();
  return Object.freeze(
    packet.anchors.filter((anchor) =>
      anchor.quoteRefs.some((value) => value.trim().toLowerCase() === normalized),
    ),
  );
}

export function packetUsesCallbackPhrase(
  packet: RetrievalContextPacket,
  callbackPhrase: string,
): boolean {
  const normalized = callbackPhrase.trim().toLowerCase();
  return packet.callbackPhrases.some((phrase) => phrase.trim().toLowerCase() === normalized);
}

export function packetUsesRestraintFlag(
  packet: RetrievalContextPacket,
  restraintFlag: string,
): boolean {
  const normalized = restraintFlag.trim().toLowerCase();
  return packet.restraintFlags.some((flag) => flag.trim().toLowerCase() === normalized);
}

export function packetUsesTacticalNote(
  packet: RetrievalContextPacket,
  tacticalNote: string,
): boolean {
  const normalized = tacticalNote.trim().toLowerCase();
  return packet.tacticalNotes.some((note) => note.trim().toLowerCase() === normalized);
}

export function packetHasPromptBlockKey(
  packet: RetrievalContextPacket,
  key: RetrievalPromptBlock['key'],
): boolean {
  return packet.promptBlocks.some((block) => block.key === key);
}

export function packetHasDiagnosticPrefix(
  packet: RetrievalContextPacket,
  prefix: string,
): boolean {
  return packet.debugNotes.some((note) => note.startsWith(prefix));
}

export function summarizeAnchor(
  anchor: RetrievalContextAnchorItem,
): string {
  return [
    `rank=${anchor.rank}`,
    `id=${anchor.anchorId}`,
    `kind=${anchor.kind}`,
    `score=${round4(anchor.score)}`,
    `salience=${round4(anchor.finalSalience)}`,
    anchor.headline,
  ].join(' | ');
}

export function summarizeDocument(
  document: RetrievalContextDocumentItem,
): string {
  return [
    `id=${document.documentId}`,
    `score=${round4(document.score)}`,
    document.sourceKind ?? 'UNKNOWN',
    document.preview ?? 'no_preview',
  ].join(' | ');
}

export function summarizePacketTopline(
  packet: RetrievalContextPacket,
): string {
  return [
    `responseIntent=${packet.responseIntent}`,
    `memoryIntent=${packet.memoryIntent}`,
    `anchorCount=${packet.anchors.length}`,
    `documentCount=${packet.documents.length}`,
    `callbackCount=${packet.callbackPhrases.length}`,
    `restraintCount=${packet.restraintFlags.length}`,
  ].join(' | ');
}

export function selectMostActionableCallback(
  packet: RetrievalContextPacket,
): string | null {
  const helperBias = retrievalContextIsHelperIntervention(packet);
  const dealroomBias = retrievalContextIsDealroomCounter(packet);

  const sorted = [...packet.callbackPhrases].sort((left, right) => {
    const leftScore = computeCallbackActionability(left, helperBias, dealroomBias);
    const rightScore = computeCallbackActionability(right, helperBias, dealroomBias);
    return rightScore - leftScore;
  });

  return sorted[0] ?? null;
}

export function computeCallbackActionability(
  callbackPhrase: string,
  helperBias = false,
  dealroomBias = false,
): number {
  const normalized = callbackPhrase.trim().toLowerCase();
  let score = normalized.length > 10 ? 0.2 : 0;
  score += /you|your|remember|last|again/.test(normalized) ? 0.2 : 0;
  score += /offer|price|deal|counter|terms|leverage/.test(normalized) ? 0.2 : 0;
  score += /calm|steady|breathe|focus|hold|stop/.test(normalized) ? 0.15 : 0;
  score += /proof|receipt|said|promised|told/.test(normalized) ? 0.15 : 0;
  score += helperBias && /calm|steady|focus|hold/.test(normalized) ? 0.1 : 0;
  score += dealroomBias && /offer|deal|counter|terms|price/.test(normalized) ? 0.1 : 0;
  return round4(clampUnit(score));
}

export function getRescueAnchors(
  packet: RetrievalContextPacket,
): readonly RetrievalContextAnchorItem[] {
  return Object.freeze(
    packet.anchors.filter((anchor) => anchor.kind === 'RESCUE'),
  );
}

export function countRescueAnchors(
  packet: RetrievalContextPacket,
): number {
  return getRescueAnchors(packet).length;
}

export function getLegendAnchors(
  packet: RetrievalContextPacket,
): readonly RetrievalContextAnchorItem[] {
  return Object.freeze(
    packet.anchors.filter((anchor) => anchor.kind === 'LEGEND'),
  );
}

export function countLegendAnchors(
  packet: RetrievalContextPacket,
): number {
  return getLegendAnchors(packet).length;
}

export function getQuoteReversalAnchors(
  packet: RetrievalContextPacket,
): readonly RetrievalContextAnchorItem[] {
  return Object.freeze(
    packet.anchors.filter((anchor) => anchor.kind === 'QUOTE_REVERSAL'),
  );
}

export function countQuoteReversalAnchors(
  packet: RetrievalContextPacket,
): number {
  return getQuoteReversalAnchors(packet).length;
}

export function getDealroomExposureAnchors(
  packet: RetrievalContextPacket,
): readonly RetrievalContextAnchorItem[] {
  return Object.freeze(
    packet.anchors.filter((anchor) => anchor.kind === 'DEALROOM_EXPOSURE'),
  );
}

export function countDealroomExposureAnchors(
  packet: RetrievalContextPacket,
): number {
  return getDealroomExposureAnchors(packet).length;
}

export function getWorldEventAnchors(
  packet: RetrievalContextPacket,
): readonly RetrievalContextAnchorItem[] {
  return Object.freeze(
    packet.anchors.filter((anchor) => anchor.kind === 'WORLD_EVENT'),
  );
}

export function countWorldEventAnchors(
  packet: RetrievalContextPacket,
): number {
  return getWorldEventAnchors(packet).length;
}

export function getPromiseAnchors(
  packet: RetrievalContextPacket,
): readonly RetrievalContextAnchorItem[] {
  return Object.freeze(
    packet.anchors.filter((anchor) => anchor.kind === 'PROMISE'),
  );
}

export function countPromiseAnchors(
  packet: RetrievalContextPacket,
): number {
  return getPromiseAnchors(packet).length;
}

export function getBetrayalAnchors(
  packet: RetrievalContextPacket,
): readonly RetrievalContextAnchorItem[] {
  return Object.freeze(
    packet.anchors.filter((anchor) => anchor.kind === 'BETRAYAL'),
  );
}

export function countBetrayalAnchors(
  packet: RetrievalContextPacket,
): number {
  return getBetrayalAnchors(packet).length;
}

export function getComebackAnchors(
  packet: RetrievalContextPacket,
): readonly RetrievalContextAnchorItem[] {
  return Object.freeze(
    packet.anchors.filter((anchor) => anchor.kind === 'COMEBACK'),
  );
}

export function countComebackAnchors(
  packet: RetrievalContextPacket,
): number {
  return getComebackAnchors(packet).length;
}

export function getCollapseAnchors(
  packet: RetrievalContextPacket,
): readonly RetrievalContextAnchorItem[] {
  return Object.freeze(
    packet.anchors.filter((anchor) => anchor.kind === 'COLLAPSE'),
  );
}

export function countCollapseAnchors(
  packet: RetrievalContextPacket,
): number {
  return getCollapseAnchors(packet).length;
}

export function getHumiliationAnchors(
  packet: RetrievalContextPacket,
): readonly RetrievalContextAnchorItem[] {
  return Object.freeze(
    packet.anchors.filter((anchor) => anchor.kind === 'HUMILIATION'),
  );
}

export function countHumiliationAnchors(
  packet: RetrievalContextPacket,
): number {
  return getHumiliationAnchors(packet).length;
}

export function getHypeAnchors(
  packet: RetrievalContextPacket,
): readonly RetrievalContextAnchorItem[] {
  return Object.freeze(
    packet.anchors.filter((anchor) => anchor.kind === 'HYPE'),
  );
}

export function countHypeAnchors(
  packet: RetrievalContextPacket,
): number {
  return getHypeAnchors(packet).length;
}

export function getThreatAnchors(
  packet: RetrievalContextPacket,
): readonly RetrievalContextAnchorItem[] {
  return Object.freeze(
    packet.anchors.filter((anchor) => anchor.kind === 'THREAT'),
  );
}

export function countThreatAnchors(
  packet: RetrievalContextPacket,
): number {
  return getThreatAnchors(packet).length;
}

export function getClutchAnchors(
  packet: RetrievalContextPacket,
): readonly RetrievalContextAnchorItem[] {
  return Object.freeze(
    packet.anchors.filter((anchor) => anchor.kind === 'CLUTCH'),
  );
}

export function countClutchAnchors(
  packet: RetrievalContextPacket,
): number {
  return getClutchAnchors(packet).length;
}

export function getWarningAnchors(
  packet: RetrievalContextPacket,
): readonly RetrievalContextAnchorItem[] {
  return Object.freeze(
    packet.anchors.filter((anchor) => anchor.kind === 'WARNING'),
  );
}

export function countWarningAnchors(
  packet: RetrievalContextPacket,
): number {
  return getWarningAnchors(packet).length;
}

export function getReceiptAnchors(
  packet: RetrievalContextPacket,
): readonly RetrievalContextAnchorItem[] {
  return Object.freeze(
    packet.anchors.filter((anchor) => anchor.kind === 'RECEIPT'),
  );
}

export function countReceiptAnchors(
  packet: RetrievalContextPacket,
): number {
  return getReceiptAnchors(packet).length;
}

export function getRivalryAnchors(
  packet: RetrievalContextPacket,
): readonly RetrievalContextAnchorItem[] {
  return Object.freeze(
    packet.anchors.filter((anchor) => anchor.kind === 'RIVALRY'),
  );
}

export function countRivalryAnchors(
  packet: RetrievalContextPacket,
): number {
  return getRivalryAnchors(packet).length;
}

export function getNegotiationAnchors(
  packet: RetrievalContextPacket,
): readonly RetrievalContextAnchorItem[] {
  return Object.freeze(
    packet.anchors.filter((anchor) => anchor.kind === 'NEGOTIATION'),
  );
}

export function countNegotiationAnchors(
  packet: RetrievalContextPacket,
): number {
  return getNegotiationAnchors(packet).length;
}

export function getVowAnchors(
  packet: RetrievalContextPacket,
): readonly RetrievalContextAnchorItem[] {
  return Object.freeze(
    packet.anchors.filter((anchor) => anchor.kind === 'VOW'),
  );
}

export function countVowAnchors(
  packet: RetrievalContextPacket,
): number {
  return getVowAnchors(packet).length;
}

export function getAllianceAnchors(
  packet: RetrievalContextPacket,
): readonly RetrievalContextAnchorItem[] {
  return Object.freeze(
    packet.anchors.filter((anchor) => anchor.kind === 'ALLIANCE'),
  );
}

export function countAllianceAnchors(
  packet: RetrievalContextPacket,
): number {
  return getAllianceAnchors(packet).length;
}

export function getSystemMarkerAnchors(
  packet: RetrievalContextPacket,
): readonly RetrievalContextAnchorItem[] {
  return Object.freeze(
    packet.anchors.filter((anchor) => anchor.kind === 'SYSTEM_MARKER'),
  );
}

export function countSystemMarkerAnchors(
  packet: RetrievalContextPacket,
): number {
  return getSystemMarkerAnchors(packet).length;
}

export function packetSuggestsPressureCritical(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /critical/i.test(note)) ||
    packet.tacticalNotes.some((note) => /critical/i.test(note)) ||
    packet.restraintFlags.some((flag) => /critical/i.test(flag));
}

export function requestSuggestsPressureCritical(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentPressureTier;
  return typeof value === 'string' && /critical/i.test(value);
}

export function packetSuggestsPressureBreakpoint(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /breakpoint/i.test(note)) ||
    packet.tacticalNotes.some((note) => /breakpoint/i.test(note)) ||
    packet.restraintFlags.some((flag) => /breakpoint/i.test(flag));
}

export function requestSuggestsPressureBreakpoint(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentPressureTier;
  return typeof value === 'string' && /breakpoint/i.test(value);
}

export function packetSuggestsPressureCollapse(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /collapse/i.test(note)) ||
    packet.tacticalNotes.some((note) => /collapse/i.test(note)) ||
    packet.restraintFlags.some((flag) => /collapse/i.test(flag));
}

export function requestSuggestsPressureCollapse(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentPressureTier;
  return typeof value === 'string' && /collapse/i.test(value);
}

export function packetSuggestsPressureHigh(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /high/i.test(note)) ||
    packet.tacticalNotes.some((note) => /high/i.test(note)) ||
    packet.restraintFlags.some((flag) => /high/i.test(flag));
}

export function requestSuggestsPressureHigh(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentPressureTier;
  return typeof value === 'string' && /high/i.test(value);
}

export function packetSuggestsPressureElevated(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /elevated/i.test(note)) ||
    packet.tacticalNotes.some((note) => /elevated/i.test(note)) ||
    packet.restraintFlags.some((flag) => /elevated/i.test(flag));
}

export function requestSuggestsPressureElevated(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentPressureTier;
  return typeof value === 'string' && /elevated/i.test(value);
}

export function packetSuggestsPressureVolatile(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /volatile/i.test(note)) ||
    packet.tacticalNotes.some((note) => /volatile/i.test(note)) ||
    packet.restraintFlags.some((flag) => /volatile/i.test(flag));
}

export function requestSuggestsPressureVolatile(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentPressureTier;
  return typeof value === 'string' && /volatile/i.test(value);
}

export function packetSuggestsPressureReset(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /reset/i.test(note)) ||
    packet.tacticalNotes.some((note) => /reset/i.test(note)) ||
    packet.restraintFlags.some((flag) => /reset/i.test(flag));
}

export function requestSuggestsPressureReset(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentPressureTier;
  return typeof value === 'string' && /reset/i.test(value);
}

export function packetSuggestsPressureCalm(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /calm/i.test(note)) ||
    packet.tacticalNotes.some((note) => /calm/i.test(note)) ||
    packet.restraintFlags.some((flag) => /calm/i.test(flag));
}

export function requestSuggestsPressureCalm(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentPressureTier;
  return typeof value === 'string' && /calm/i.test(value);
}

export function packetSuggestsEmotionFrustrated(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /frustrated/i.test(note)) ||
    packet.tacticalNotes.some((note) => /frustrated/i.test(note)) ||
    packet.restraintFlags.some((flag) => /frustrated/i.test(flag));
}

export function requestSuggestsEmotionFrustrated(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentEmotionBand;
  return typeof value === 'string' && /frustrated/i.test(value);
}

export function packetSuggestsEmotionDesperate(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /desperate/i.test(note)) ||
    packet.tacticalNotes.some((note) => /desperate/i.test(note)) ||
    packet.restraintFlags.some((flag) => /desperate/i.test(flag));
}

export function requestSuggestsEmotionDesperate(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentEmotionBand;
  return typeof value === 'string' && /desperate/i.test(value);
}

export function packetSuggestsEmotionEmbarrassed(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /embarrassed/i.test(note)) ||
    packet.tacticalNotes.some((note) => /embarrassed/i.test(note)) ||
    packet.restraintFlags.some((flag) => /embarrassed/i.test(flag));
}

export function requestSuggestsEmotionEmbarrassed(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentEmotionBand;
  return typeof value === 'string' && /embarrassed/i.test(value);
}

export function packetSuggestsEmotionAngry(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /angry/i.test(note)) ||
    packet.tacticalNotes.some((note) => /angry/i.test(note)) ||
    packet.restraintFlags.some((flag) => /angry/i.test(flag));
}

export function requestSuggestsEmotionAngry(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentEmotionBand;
  return typeof value === 'string' && /angry/i.test(value);
}

export function packetSuggestsEmotionAnxious(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /anxious/i.test(note)) ||
    packet.tacticalNotes.some((note) => /anxious/i.test(note)) ||
    packet.restraintFlags.some((flag) => /anxious/i.test(flag));
}

export function requestSuggestsEmotionAnxious(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentEmotionBand;
  return typeof value === 'string' && /anxious/i.test(value);
}

export function packetSuggestsEmotionHaunted(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /haunted/i.test(note)) ||
    packet.tacticalNotes.some((note) => /haunted/i.test(note)) ||
    packet.restraintFlags.some((flag) => /haunted/i.test(flag));
}

export function requestSuggestsEmotionHaunted(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentEmotionBand;
  return typeof value === 'string' && /haunted/i.test(value);
}

export function packetSuggestsEmotionHopeful(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /hopeful/i.test(note)) ||
    packet.tacticalNotes.some((note) => /hopeful/i.test(note)) ||
    packet.restraintFlags.some((flag) => /hopeful/i.test(flag));
}

export function requestSuggestsEmotionHopeful(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentEmotionBand;
  return typeof value === 'string' && /hopeful/i.test(value);
}

export function packetSuggestsEmotionTriumphant(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /triumphant/i.test(note)) ||
    packet.tacticalNotes.some((note) => /triumphant/i.test(note)) ||
    packet.restraintFlags.some((flag) => /triumphant/i.test(flag));
}

export function requestSuggestsEmotionTriumphant(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentEmotionBand;
  return typeof value === 'string' && /triumphant/i.test(value);
}

export function packetSuggestsEmotionCold(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /cold/i.test(note)) ||
    packet.tacticalNotes.some((note) => /cold/i.test(note)) ||
    packet.restraintFlags.some((flag) => /cold/i.test(flag));
}

export function requestSuggestsEmotionCold(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentEmotionBand;
  return typeof value === 'string' && /cold/i.test(value);
}

export function packetSuggestsEmotionCalm(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /calm/i.test(note)) ||
    packet.tacticalNotes.some((note) => /calm/i.test(note)) ||
    packet.restraintFlags.some((flag) => /calm/i.test(flag));
}

export function requestSuggestsEmotionCalm(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentEmotionBand;
  return typeof value === 'string' && /calm/i.test(value);
}

export function packetSuggestsAudienceHigh(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /high/i.test(note)) ||
    packet.tacticalNotes.some((note) => /high/i.test(note)) ||
    packet.restraintFlags.some((flag) => /high/i.test(flag));
}

export function requestSuggestsAudienceHigh(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentAudienceHeat;
  return typeof value === 'string' && /high/i.test(value);
}

export function packetSuggestsAudienceCritical(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /critical/i.test(note)) ||
    packet.tacticalNotes.some((note) => /critical/i.test(note)) ||
    packet.restraintFlags.some((flag) => /critical/i.test(flag));
}

export function requestSuggestsAudienceCritical(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentAudienceHeat;
  return typeof value === 'string' && /critical/i.test(value);
}

export function packetSuggestsAudienceMob(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /mob/i.test(note)) ||
    packet.tacticalNotes.some((note) => /mob/i.test(note)) ||
    packet.restraintFlags.some((flag) => /mob/i.test(flag));
}

export function requestSuggestsAudienceMob(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentAudienceHeat;
  return typeof value === 'string' && /mob/i.test(value);
}

export function packetSuggestsAudienceVolatile(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /volatile/i.test(note)) ||
    packet.tacticalNotes.some((note) => /volatile/i.test(note)) ||
    packet.restraintFlags.some((flag) => /volatile/i.test(flag));
}

export function requestSuggestsAudienceVolatile(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentAudienceHeat;
  return typeof value === 'string' && /volatile/i.test(value);
}

export function packetSuggestsAudienceHot(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /hot/i.test(note)) ||
    packet.tacticalNotes.some((note) => /hot/i.test(note)) ||
    packet.restraintFlags.some((flag) => /hot/i.test(flag));
}

export function requestSuggestsAudienceHot(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentAudienceHeat;
  return typeof value === 'string' && /hot/i.test(value);
}

export function packetSuggestsAudienceCalm(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /calm/i.test(note)) ||
    packet.tacticalNotes.some((note) => /calm/i.test(note)) ||
    packet.restraintFlags.some((flag) => /calm/i.test(flag));
}

export function requestSuggestsAudienceCalm(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentAudienceHeat;
  return typeof value === 'string' && /calm/i.test(value);
}

export function packetSuggestsRelationshipAlly(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /ally/i.test(note)) ||
    packet.tacticalNotes.some((note) => /ally/i.test(note)) ||
    packet.restraintFlags.some((flag) => /ally/i.test(flag));
}

export function requestSuggestsRelationshipAlly(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentRelationshipState;
  return typeof value === 'string' && /ally/i.test(value);
}

export function packetSuggestsRelationshipRival(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /rival/i.test(note)) ||
    packet.tacticalNotes.some((note) => /rival/i.test(note)) ||
    packet.restraintFlags.some((flag) => /rival/i.test(flag));
}

export function requestSuggestsRelationshipRival(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentRelationshipState;
  return typeof value === 'string' && /rival/i.test(value);
}

export function packetSuggestsRelationshipDistrust(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /distrust/i.test(note)) ||
    packet.tacticalNotes.some((note) => /distrust/i.test(note)) ||
    packet.restraintFlags.some((flag) => /distrust/i.test(flag));
}

export function requestSuggestsRelationshipDistrust(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentRelationshipState;
  return typeof value === 'string' && /distrust/i.test(value);
}

export function packetSuggestsRelationshipMentor(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /mentor/i.test(note)) ||
    packet.tacticalNotes.some((note) => /mentor/i.test(note)) ||
    packet.restraintFlags.some((flag) => /mentor/i.test(flag));
}

export function requestSuggestsRelationshipMentor(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentRelationshipState;
  return typeof value === 'string' && /mentor/i.test(value);
}

export function packetSuggestsRelationshipHunted(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /hunted/i.test(note)) ||
    packet.tacticalNotes.some((note) => /hunted/i.test(note)) ||
    packet.restraintFlags.some((flag) => /hunted/i.test(flag));
}

export function requestSuggestsRelationshipHunted(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentRelationshipState;
  return typeof value === 'string' && /hunted/i.test(value);
}

export function packetSuggestsRelationshipFascinated(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /fascinated/i.test(note)) ||
    packet.tacticalNotes.some((note) => /fascinated/i.test(note)) ||
    packet.restraintFlags.some((flag) => /fascinated/i.test(flag));
}

export function requestSuggestsRelationshipFascinated(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentRelationshipState;
  return typeof value === 'string' && /fascinated/i.test(value);
}

export function packetSuggestsRelationshipBroken(
  packet: RetrievalContextPacket,
): boolean {
  return packet.debugNotes.some((note) => /broken/i.test(note)) ||
    packet.tacticalNotes.some((note) => /broken/i.test(note)) ||
    packet.restraintFlags.some((flag) => /broken/i.test(flag));
}

export function requestSuggestsRelationshipBroken(
  request: RetrievalContextBuildRequest,
): boolean {
  const value = request.currentRelationshipState;
  return typeof value === 'string' && /broken/i.test(value);
}

export function packetScoreProfile(
  packet: RetrievalContextPacket,
): Readonly<Record<string, number>> {
  return Object.freeze({
    averageAnchorScore: averageAnchorScore(packet),
    averageAnchorSalience: averageAnchorSalience(packet),
    averageDocumentScore: averageDocumentScore(packet),
    highestAnchorScore: highestAnchorScore(packet),
    highestDocumentScore: highestDocumentScore(packet),
  });
}

export function packetDensityProfile(
  packet: RetrievalContextPacket,
): Readonly<Record<string, number>> {
  return Object.freeze({
    anchors: packet.anchors.length,
    documents: packet.documents.length,
    callbacks: packet.callbackPhrases.length,
    restraints: packet.restraintFlags.length,
    tactical: packet.tacticalNotes.length,
    promptBlocks: packet.promptBlocks.length,
    debugNotes: packet.debugNotes.length,
  });
}

export function packetQualityGate(
  packet: RetrievalContextPacket,
): Readonly<Record<string, boolean>> {
  return Object.freeze({
    hasAnchors: hasAnyAnchors(packet),
    hasPromptBlocks: packet.promptBlocks.length > 0,
    hasRoleBlock: packetHasPromptBlockKey(packet, 'ROLE'),
    hasIntentBlock: packetHasPromptBlockKey(packet, 'INTENT'),
    hasStateBlock: packetHasPromptBlockKey(packet, 'CURRENT_STATE'),
    hasDiagnostics: packet.debugNotes.length > 0,
    hasRetrievalReceipt: Boolean(packet.queryResponse.receipt.id),
    hasCandidateIds: packet.queryResponse.candidateIds.length > 0,
  });
}

export function packetNarrativeProfile(
  packet: RetrievalContextPacket,
): Readonly<Record<string, boolean>> {
  return Object.freeze({
    rescue: packetHasRescueAnchor(packet),
    legend: packetHasLegendAnchor(packet),
    threat: packetHasThreatAnchor(packet),
    receipt: packetHasReceiptAnchor(packet),
    rivalry: packetHasRivalryAnchor(packet),
    negotiation: packetHasNegotiationAnchor(packet) || packetHasDealroomExposureAnchor(packet),
    comeback: packetHasComebackAnchor(packet),
    collapse: packetHasCollapseAnchor(packet),
    humiliation: packetHasHumiliationAnchor(packet),
    worldEvent: packetHasWorldEventAnchor(packet),
  });
}

export function packetSortingView(
  packet: RetrievalContextPacket,
): readonly string[] {
  return Object.freeze([
    ...packet.anchors.map((anchor) => `anchor:${summarizeAnchor(anchor)}`),
    ...packet.documents.map((document) => `document:${summarizeDocument(document)}`),
  ]);
}
