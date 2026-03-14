// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/intelligence/dl/ResponseRankerClient.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT DL RESPONSE RANKER CLIENT
 * FILE: pzo-web/src/engines/chat/intelligence/dl/ResponseRankerClient.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * This module ranks candidate responses for the frontend chat runtime using the
 * same doctrine as the rest of the unified chat intelligence lane:
 *
 * - frontend ranks instantly,
 * - backend remains authoritative,
 * - ranking is local-first and replay-safe,
 * - helper / hater / system / negotiation candidates are not flattened into
 *   one generic chatbot scoring path,
 * - channel fit, phase fit, rescue timing, social pressure, and semantic fit
 *   are all first-class ranking signals.
 *
 * The ranker exists so the frontend can:
 * - preview likely responses,
 * - choose optimistic helper / hater / ambient lines,
 * - keep NPC pacing smooth while transport is in flight,
 * - preserve mode and channel personality,
 * - remain deterministic when the backend or model transport is unavailable.
 *
 * It does NOT:
 * - become final transcript authority,
 * - become moderation authority,
 * - replace backend ranking,
 * - overwrite server policy,
 * - ignore the canonical chat architecture split.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type {
  ChatLearningBridgePublicSnapshot,
} from '../ChatLearningBridge';

import type {
  ChatFeatureSnapshot,
  ChatLearningProfile,
  ChatMessage,
  ChatVisibleChannel,
  JsonObject,
  Nullable,
  Score01,
  UnixMs,
} from '../../types';

import {
  MessageEmbeddingClient,
  type ChatEmbeddingClientPort,
  type ChatEmbeddingInput,
  type ChatEmbeddingTelemetryPort,
  type ChatEmbeddingVectorRecord,
  buildDeterministicMessageEmbedding,
  compareEmbeddingVectors,
  createMessageEmbeddingClient,
} from './MessageEmbeddingClient';

import {
  ConversationStateEncoder,
  type ChatConversationPhase,
  type ChatConversationStateEncoderOptions,
  type ChatConversationStateEncodingInput,
  type ChatConversationStateEncodingResult,
  createConversationStateEncoder,
} from './ConversationStateEncoder';

import {
  DialogueIntentEncoder,
  type ChatDialogueIntent,
  type ChatDialogueIntentEncoderOptions,
  type ChatDialogueIntentEncodingInput,
  type ChatDialogueIntentEncodingResult,
  createDialogueIntentEncoder,
} from './DialogueIntentEncoder';

/* ========================================================================== */
/* MARK: Module constants                                                     */
/* ========================================================================== */

export const CHAT_RESPONSE_RANKER_CLIENT_MODULE_NAME =
  'PZO_CHAT_RESPONSE_RANKER_CLIENT' as const;

export const CHAT_RESPONSE_RANKER_CLIENT_VERSION =
  '2026.03.13-response-ranker-client.v1' as const;

export const CHAT_RESPONSE_RANKER_CLIENT_RUNTIME_LAWS = Object.freeze([
  'Response ranking is advisory and latency-first.',
  'Semantic similarity alone is insufficient.',
  'Channel fit and conversation phase fit are mandatory.',
  'Helper rescue lines and hater escalation lines must score through different gates.',
  'Repetition and overuse must be penalized.',
  'Ranking should remain deterministic when transport is unavailable.',
  'Frontend picks likely lines; backend may still override with truth-aware ranking.',
  'Every rank should remain explainable enough to debug.',
] as const);

export const CHAT_RESPONSE_RANKER_CLIENT_DEFAULTS = Object.freeze({
  maxCandidates: 64,
  maxRerankBatchSize: 24,
  vectorDimensions: 192,
  semanticWeight: 0.26,
  intentWeight: 0.20,
  phaseWeight: 0.15,
  channelWeight: 0.14,
  roleWeight: 0.08,
  rescueWeight: 0.07,
  escalationWeight: 0.05,
  noveltyWeight: 0.05,
  repetitionPenaltyWeight: 0.06,
  coherenceWeight: 0.04,
  deterministicChoiceTemperature: 0,
  minimumAcceptedScore01: 0.24,
  helperRescueBoost: 0.14,
  haterEscalationBoost: 0.12,
  negotiationBoost: 0.12,
  postRunReflectionBoost: 0.11,
  ambientSuppressionPenalty: 0.08,
  textPreviewChars: 200,
} as const);

/* ========================================================================== */
/* MARK: Public contracts                                                     */
/* ========================================================================== */

export type ChatRankableResponseRole =
  | 'HELPER'
  | 'HATER'
  | 'SYSTEM'
  | 'AMBIENT'
  | 'DEALMAKER'
  | 'ALLY'
  | 'RIVAL'
  | 'NARRATOR';

export type ChatRankableResponseStyle =
  | 'DIRECT'
  | 'SOFT'
  | 'TAUNT'
  | 'ESCALATORY'
  | 'TACTICAL'
  | 'RESCUE'
  | 'REFLECTIVE'
  | 'AMBIENT'
  | 'NEGOTIATION'
  | 'SILENT_PRESSURE';

export interface ChatRankerTelemetryPort {
  emit(event: string, payload: JsonObject): void;
}

export interface ChatRankableResponseCandidate {
  readonly candidateId: string;
  readonly text: string;
  readonly role: ChatRankableResponseRole;
  readonly style?: ChatRankableResponseStyle;
  readonly channel?: ChatVisibleChannel;
  readonly personaId?: string;
  readonly sourceId?: string;
  readonly tags?: readonly string[];
  readonly priorityBias01?: number;
  readonly cooldownPenalty01?: number;
  readonly noveltyHint01?: number;
  readonly safetyPenalty01?: number;
  readonly intentHints?: readonly ChatDialogueIntent[];
  readonly phaseHints?: readonly ChatConversationPhase[];
  readonly metadata?: JsonObject;
}

export interface ChatResponseRankerInput {
  readonly requestId?: string;
  readonly now?: UnixMs | number;
  readonly activeChannel?: ChatVisibleChannel;
  readonly candidates: readonly ChatRankableResponseCandidate[];
  readonly messages?: readonly ChatMessage[];
  readonly recentMessages?: readonly ChatMessage[];
  readonly featureSnapshot?: Nullable<ChatFeatureSnapshot>;
  readonly learningProfile?: Nullable<ChatLearningProfile>;
  readonly bridgeSnapshot?: Nullable<ChatLearningBridgePublicSnapshot>;
  readonly recentEventNames?: readonly string[];
  readonly currentModeId?: string;
  readonly roomId?: string;
  readonly runId?: string;
  readonly currentIntent?: Nullable<ChatDialogueIntentEncodingResult>;
  readonly conversationState?: Nullable<ChatConversationStateEncodingResult>;
  readonly playerUserId?: string;
  readonly metadata?: JsonObject;
  readonly source?: 'LIVE' | 'PREVIEW' | 'REPLAY' | 'SUGGESTION';
}

export interface ChatResponseRankBreakdown {
  readonly semanticFit01: Score01;
  readonly intentFit01: Score01;
  readonly phaseFit01: Score01;
  readonly channelFit01: Score01;
  readonly roleFit01: Score01;
  readonly rescueBoost01: Score01;
  readonly escalationBoost01: Score01;
  readonly noveltyBoost01: Score01;
  readonly coherenceBoost01: Score01;
  readonly repetitionPenalty01: Score01;
  readonly safetyPenalty01: Score01;
  readonly priorityBias01: Score01;
  readonly topReasons: readonly string[];
}

export interface ChatRankedResponse {
  readonly candidate: ChatRankableResponseCandidate;
  readonly score01: Score01;
  readonly rank: number;
  readonly chosen: boolean;
  readonly semanticVectorRecord: ChatEmbeddingVectorRecord;
  readonly breakdown: ChatResponseRankBreakdown;
}

export interface ChatResponseRankerResult {
  readonly requestId: string;
  readonly ranked: readonly ChatRankedResponse[];
  readonly chosen: Nullable<ChatRankedResponse>;
  readonly encodedAtMs: UnixMs;
  readonly activeChannel: ChatVisibleChannel;
  readonly conversationState: ChatConversationStateEncodingResult;
  readonly currentIntent: ChatDialogueIntentEncodingResult;
  readonly diagnostics: Readonly<{
    candidateCount: number;
    truncatedCount: number;
    lexicalPromptSummary: string;
    messageCount: number;
    modeId?: string;
    runId?: string;
    roomId?: string;
    metadata?: JsonObject;
  }>;
}

export interface ChatResponseRankerClientOptions {
  readonly defaults?: Partial<typeof CHAT_RESPONSE_RANKER_CLIENT_DEFAULTS>;
  readonly embeddingClient?: ChatEmbeddingClientPort;
  readonly conversationStateEncoder?: ConversationStateEncoder;
  readonly intentEncoder?: DialogueIntentEncoder;
  readonly telemetry?: ChatRankerTelemetryPort;
  readonly embeddingTelemetry?: ChatEmbeddingTelemetryPort;
}

export interface ChatResponseRankerClientPort {
  rank(
    input: ChatResponseRankerInput,
  ): Promise<ChatResponseRankerResult>;
  rankOne(
    input: ChatResponseRankerInput,
  ): Promise<Nullable<ChatRankedResponse>>;
  getPublicSnapshot(): Readonly<{
    moduleName: string;
    moduleVersion: string;
    totals: Readonly<{
      ranks: number;
      candidatesScored: number;
      deterministicFallbacks: number;
      conversationEncodes: number;
      intentEncodes: number;
    }>;
  }>;
}

/* ========================================================================== */
/* MARK: Small helpers                                                        */
/* ========================================================================== */

function asUnixMs(value: number): UnixMs {
  return Math.max(0, Math.round(value)) as UnixMs;
}

function clamp01(value: number): Score01 {
  if (!Number.isFinite(value)) {
    return 0 as Score01;
  }
  if (value <= 0) {
    return 0 as Score01;
  }
  if (value >= 1) {
    return 1 as Score01;
  }
  return value as Score01;
}

function stableRound(value: number, digits = 4): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function normalizeText(value: string | null | undefined): string {
  return `${value ?? ''}`
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value: string, max = 180): string {
  const normalized = normalizeText(value);
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function inferActiveChannel(input: ChatResponseRankerInput): ChatVisibleChannel {
  const candidate = `${input.activeChannel ?? ''}`.toUpperCase();
  switch (candidate) {
    case 'GLOBAL':
    case 'SYNDICATE':
    case 'DEAL_ROOM':
    case 'LOBBY':
      return candidate as ChatVisibleChannel;
    default:
      return 'GLOBAL';
  }
}

function extractPromptText(input: ChatResponseRankerInput): string {
  const messages = input.recentMessages ?? input.messages ?? [];
  const text = messages
    .slice(-5)
    .map((message) => {
      const candidate =
        (message as any).content ??
        (message as any).text ??
        (message as any).body ??
        '';
      return normalizeText(candidate);
    })
    .filter(Boolean)
    .join(' || ');

  return truncateText(text, 360);
}

function channelFitForCandidate(
  activeChannel: ChatVisibleChannel,
  candidate: ChatRankableResponseCandidate,
  conversationState: ChatConversationStateEncodingResult,
): Score01 {
  const candidateChannel = candidate.channel ?? activeChannel;
  const direct =
    candidateChannel === activeChannel
      ? 0.74
      : candidateChannel === conversationState.channels[0]?.channel
        ? 0.60
        : 0.24;

  const profile = conversationState.channels.find(
    (item) => item.channel === candidateChannel,
  );

  return clamp01(direct * 0.52 + (profile?.suitability01 ?? 0.18) * 0.48);
}

function phaseFitForCandidate(
  candidate: ChatRankableResponseCandidate,
  conversationState: ChatConversationStateEncodingResult,
): Score01 {
  const hints = candidate.phaseHints ?? [];
  if (!hints.length) {
    return 0.46 as Score01;
  }

  if (hints.includes(conversationState.phase)) {
    return 1 as Score01;
  }

  if (conversationState.secondaryPhases.some((phase) => hints.includes(phase))) {
    return 0.68 as Score01;
  }

  if (
    conversationState.phase === 'CLIMAX' &&
    hints.includes('ESCALATING')
  ) {
    return 0.66 as Score01;
  }

  if (
    conversationState.phase === 'RESCUE' &&
    hints.includes('COOLDOWN')
  ) {
    return 0.58 as Score01;
  }

  return 0 as Score01;
}

function roleFitForCandidate(
  candidate: ChatRankableResponseCandidate,
  conversationState: ChatConversationStateEncodingResult,
): Score01 {
  const phase = conversationState.phase;
  const role = candidate.role;

  switch (role) {
    case 'HELPER':
    case 'ALLY':
      if (phase === 'RESCUE' || conversationState.scores.rescueNeed01 >= 0.54) {
        return 1 as Score01;
      }
      if (phase === 'POST_RUN') {
        return 0.68 as Score01;
      }
      return 0.54 as Score01;
    case 'HATER':
    case 'RIVAL':
      if (phase === 'ESCALATING' || phase === 'CLIMAX') {
        return 1 as Score01;
      }
      if (conversationState.scores.haterBait01 >= 0.54) {
        return 0.78 as Score01;
      }
      return 0.40 as Score01;
    case 'DEALMAKER':
      if (phase === 'NEGOTIATION' || conversationState.scores.negotiationPressure01 >= 0.50) {
        return 1 as Score01;
      }
      return 0.28 as Score01;
    case 'SYSTEM':
      if (phase === 'OPENING' || phase === 'POST_RUN') {
        return 0.74 as Score01;
      }
      return 0.52 as Score01;
    case 'NARRATOR':
      if (phase === 'POST_RUN' || phase === 'COOLDOWN') {
        return 0.86 as Score01;
      }
      return 0.44 as Score01;
    case 'AMBIENT':
      if (phase === 'COOLDOWN' || phase === 'DORMANT') {
        return 0.76 as Score01;
      }
      return 0.22 as Score01;
    default:
      return 0.38 as Score01;
  }
}

function intentFitForCandidate(
  candidate: ChatRankableResponseCandidate,
  currentIntent: ChatDialogueIntentEncodingResult,
  conversationState: ChatConversationStateEncodingResult,
): Score01 {
  const hints = candidate.intentHints ?? [];
  if (!hints.length) {
    return 0.42 as Score01;
  }

  const primary = currentIntent.primaryIntent;
  if (hints.includes(primary)) {
    return 1 as Score01;
  }

  if (currentIntent.secondaryIntents?.some((value) => hints.includes(value.intent))) {
    return 0.72 as Score01;
  }

  if (
    hints.includes('SEEK_HELP') &&
    conversationState.scores.rescueNeed01 >= 0.58
  ) {
    return 0.68 as Score01;
  }

  if (
    hints.includes('NEGOTIATE') &&
    conversationState.scores.negotiationPressure01 >= 0.54
  ) {
    return 0.68 as Score01;
  }

  if (
    hints.includes('TAUNT') &&
    conversationState.scores.haterBait01 >= 0.54
  ) {
    return 0.62 as Score01;
  }

  return 0.10 as Score01;
}

function roleStyleRepetitionPenalty(
  candidate: ChatRankableResponseCandidate,
  messages: readonly ChatMessage[],
): Score01 {
  if (!messages.length) {
    return 0 as Score01;
  }

  const normalizedText = normalizeText(candidate.text).toLowerCase();
  const snippets = messages.slice(-8).map((message) =>
    normalizeText(
      (message as any).content ??
      (message as any).text ??
      (message as any).body ??
      '',
    ).toLowerCase(),
  );

  let maxPenalty = 0;

  for (const snippet of snippets) {
    if (!snippet) {
      continue;
    }

    if (snippet === normalizedText) {
      maxPenalty = Math.max(maxPenalty, 1);
      continue;
    }

    const sharedWords = normalizedText
      .split(/\s+/)
      .filter(Boolean)
      .filter((word) => snippet.includes(word))
      .length;

    const denominator = Math.max(1, normalizedText.split(/\s+/).filter(Boolean).length);
    maxPenalty = Math.max(maxPenalty, sharedWords / denominator);
  }

  return clamp01(maxPenalty);
}

function noveltyBoostForCandidate(
  candidate: ChatRankableResponseCandidate,
  conversationState: ChatConversationStateEncodingResult,
): Score01 {
  const base =
    (candidate.noveltyHint01 ?? 0.5) * 0.52 +
    (1 - conversationState.scores.repetitionPenalty01) * 0.48;

  if (candidate.style === 'AMBIENT' && conversationState.phase !== 'COOLDOWN') {
    return clamp01(base - 0.12);
  }

  return clamp01(base);
}

function rescueBoostForCandidate(
  candidate: ChatRankableResponseCandidate,
  conversationState: ChatConversationStateEncodingResult,
  defaults: typeof CHAT_RESPONSE_RANKER_CLIENT_DEFAULTS,
): Score01 {
  const helperRole =
    candidate.role === 'HELPER' ||
    candidate.role === 'ALLY';

  if (!helperRole) {
    return 0 as Score01;
  }

  const text = normalizeText(candidate.text).toLowerCase();
  const helperLexical =
    Number(text.includes('breathe')) * 0.08 +
    Number(text.includes('recover')) * 0.10 +
    Number(text.includes('exit')) * 0.06 +
    Number(text.includes('hold')) * 0.04 +
    Number(text.includes('one step')) * 0.06;

  return clamp01(
    conversationState.scores.rescueNeed01 * 0.72 +
    helperLexical +
    defaults.helperRescueBoost,
  );
}

function escalationBoostForCandidate(
  candidate: ChatRankableResponseCandidate,
  conversationState: ChatConversationStateEncodingResult,
  defaults: typeof CHAT_RESPONSE_RANKER_CLIENT_DEFAULTS,
): Score01 {
  const hostileRole =
    candidate.role === 'HATER' ||
    candidate.role === 'RIVAL';

  if (!hostileRole) {
    return 0 as Score01;
  }

  const text = normalizeText(candidate.text).toLowerCase();
  const aggressionLexical =
    Number(text.includes('weak')) * 0.10 +
    Number(text.includes('finished')) * 0.10 +
    Number(text.includes('collapse')) * 0.06 +
    Number(text.includes('watch')) * 0.04;

  return clamp01(
    conversationState.scores.haterBait01 * 0.68 +
    aggressionLexical +
    defaults.haterEscalationBoost,
  );
}

function coherenceBoostForCandidate(
  candidate: ChatRankableResponseCandidate,
  conversationState: ChatConversationStateEncodingResult,
): Score01 {
  const style = candidate.style ?? 'DIRECT';

  let fit = 0.36;
  if (style === 'RESCUE' && conversationState.phase === 'RESCUE') {
    fit += 0.28;
  }
  if (style === 'NEGOTIATION' && conversationState.phase === 'NEGOTIATION') {
    fit += 0.28;
  }
  if (style === 'TAUNT' && (conversationState.phase === 'ESCALATING' || conversationState.phase === 'CLIMAX')) {
    fit += 0.24;
  }
  if (style === 'REFLECTIVE' && conversationState.phase === 'POST_RUN') {
    fit += 0.30;
  }
  if (style === 'AMBIENT' && (conversationState.phase === 'COOLDOWN' || conversationState.phase === 'DORMANT')) {
    fit += 0.18;
  }

  return clamp01(fit * 0.56 + conversationState.scores.coherence01 * 0.44);
}

function semanticInputForCandidate(
  candidate: ChatRankableResponseCandidate,
  input: ChatResponseRankerInput,
  conversationState: ChatConversationStateEncodingResult,
): ChatEmbeddingInput {
  return Object.freeze({
    purpose: 'RANKING',
    text: [
      candidate.text,
      `role:${candidate.role}`,
      `style:${candidate.style ?? 'DIRECT'}`,
      `channel:${candidate.channel ?? input.activeChannel ?? 'GLOBAL'}`,
      `phase:${conversationState.phase}`,
      `intentHints:${(candidate.intentHints ?? []).join(',')}`,
      `tags:${(candidate.tags ?? []).join(',')}`,
    ].join(' | '),
    activeChannel: candidate.channel ?? input.activeChannel ?? 'GLOBAL',
    metadata: Object.freeze({
      candidateId: candidate.candidateId,
      personaId: candidate.personaId,
      sourceId: candidate.sourceId,
      roomId: input.roomId,
      runId: input.runId,
    }),
  } as any);
}

function fallbackVectorRecord(
  candidate: ChatRankableResponseCandidate,
  input: ChatResponseRankerInput,
  conversationState: ChatConversationStateEncodingResult,
  vectorDimensions: number,
): ChatEmbeddingVectorRecord {
  const embeddingInput = semanticInputForCandidate(candidate, input, conversationState);
  const vector = buildDeterministicMessageEmbedding(embeddingInput, vectorDimensions);

  return Object.freeze({
    requestId: `${candidate.candidateId}:fallback`,
    cacheKey: `fallback:${candidate.candidateId}:${candidate.text.length}`,
    source: 'LOCAL_DETERMINISTIC',
    model: 'pzo-response-ranker-local',
    purpose: 'RANKING',
    dimensions: vector.length,
    vector,
    magnitude: 1,
    normalized: true,
    createdAtMs: asUnixMs(Date.now()),
    durationMs: 0,
    previewText: truncateText(candidate.text, 120),
    contextSummary: truncateText(conversationState.stateSummary, 220),
    diagnostics: Object.freeze({
      role: candidate.role,
      style: candidate.style,
      phase: conversationState.phase,
    }),
  });
}

function weightedScore(parts: readonly [number, number][]): Score01 {
  let numerator = 0;
  let denominator = 0;

  for (const [value, weight] of parts) {
    numerator += value * weight;
    denominator += weight;
  }

  if (denominator <= 0) {
    return 0 as Score01;
  }

  return clamp01(numerator / denominator);
}

/* ========================================================================== */
/* MARK: Ranker                                                               */
/* ========================================================================== */

export class ResponseRankerClient implements ChatResponseRankerClientPort {
  private readonly defaults = Object.freeze({
    ...CHAT_RESPONSE_RANKER_CLIENT_DEFAULTS,
    ...(this.options.defaults ?? {}),
  });

  private readonly embeddingClient: ChatEmbeddingClientPort;
  private readonly conversationStateEncoder: ConversationStateEncoder;
  private readonly intentEncoder: DialogueIntentEncoder;
  private requestCounter = 0;
  private readonly requestPrefix: string;
  private totals = {
    ranks: 0,
    candidatesScored: 0,
    deterministicFallbacks: 0,
    conversationEncodes: 0,
    intentEncodes: 0,
  };

  constructor(
    private readonly options: ChatResponseRankerClientOptions = {},
  ) {
    this.embeddingClient =
      options.embeddingClient ??
      createMessageEmbeddingClient({
        telemetry: options.embeddingTelemetry,
      });

    this.intentEncoder =
      options.intentEncoder ??
      createDialogueIntentEncoder({
        embeddingClient: this.embeddingClient,
      } satisfies ChatDialogueIntentEncoderOptions);

    this.conversationStateEncoder =
      options.conversationStateEncoder ??
      createConversationStateEncoder({
        embeddingClient: this.embeddingClient,
        intentEncoder: this.intentEncoder,
      } satisfies ChatConversationStateEncoderOptions);

    this.requestPrefix =
      `${CHAT_RESPONSE_RANKER_CLIENT_MODULE_NAME}:${Math.random().toString(36).slice(2, 9)}`;
  }

  public async rank(
    input: ChatResponseRankerInput,
  ): Promise<ChatResponseRankerResult> {
    const requestId = input.requestId ?? this.nextRequestId();
    const activeChannel = inferActiveChannel(input);
    const encodedAtMs = asUnixMs(input.now ?? Date.now());
    const candidates = Object.freeze(
      input.candidates.slice(0, this.defaults.maxCandidates),
    );
    const truncatedCount = Math.max(0, input.candidates.length - candidates.length);

    const currentIntent =
      input.currentIntent ??
      await this.intentEncoder.encode(this.createIntentInput(requestId, input, activeChannel));

    if (!input.currentIntent) {
      this.totals.intentEncodes += 1;
    }

    const conversationState =
      input.conversationState ??
      await this.conversationStateEncoder.encode(
        this.createConversationStateInput(requestId, input, activeChannel, currentIntent),
      );

    if (!input.conversationState) {
      this.totals.conversationEncodes += 1;
    }

    const conversationVector = conversationState.semanticVector;

    const ranked: ChatRankedResponse[] = [];
    for (const candidate of candidates) {
      const vectorRecord = await this.embedCandidate(candidate, input, conversationState);
      const semanticFit01 = compareEmbeddingVectors(
        conversationVector,
        vectorRecord.vector,
      ).similarity01;

      const intentFit01 = intentFitForCandidate(candidate, currentIntent, conversationState);
      const phaseFit01 = phaseFitForCandidate(candidate, conversationState);
      const channelFit01 = channelFitForCandidate(activeChannel, candidate, conversationState);
      const roleFit01 = roleFitForCandidate(candidate, conversationState);
      const rescueBoost01 = rescueBoostForCandidate(candidate, conversationState, this.defaults);
      const escalationBoost01 = escalationBoostForCandidate(candidate, conversationState, this.defaults);
      const noveltyBoost01 = noveltyBoostForCandidate(candidate, conversationState);
      const coherenceBoost01 = coherenceBoostForCandidate(candidate, conversationState);
      const repetitionPenalty01 = roleStyleRepetitionPenalty(
        candidate,
        input.recentMessages ?? input.messages ?? [],
      );
      const safetyPenalty01 = clamp01(
        (candidate.safetyPenalty01 ?? 0) * 0.72 +
        (candidate.cooldownPenalty01 ?? 0) * 0.28,
      );
      const priorityBias01 = clamp01(candidate.priorityBias01 ?? 0);

      let score01 = weightedScore([
        [semanticFit01, this.defaults.semanticWeight],
        [intentFit01, this.defaults.intentWeight],
        [phaseFit01, this.defaults.phaseWeight],
        [channelFit01, this.defaults.channelWeight],
        [roleFit01, this.defaults.roleWeight],
        [rescueBoost01, this.defaults.rescueWeight],
        [escalationBoost01, this.defaults.escalationWeight],
        [noveltyBoost01, this.defaults.noveltyWeight],
        [coherenceBoost01, this.defaults.coherenceWeight],
        [priorityBias01, 0.04],
      ]);

      if (candidate.style === 'NEGOTIATION' && conversationState.phase === 'NEGOTIATION') {
        score01 = clamp01(score01 + this.defaults.negotiationBoost);
      }
      if (candidate.style === 'REFLECTIVE' && conversationState.phase === 'POST_RUN') {
        score01 = clamp01(score01 + this.defaults.postRunReflectionBoost);
      }
      if (candidate.role === 'AMBIENT' && conversationState.phase !== 'COOLDOWN') {
        score01 = clamp01(score01 - this.defaults.ambientSuppressionPenalty);
      }

      score01 = clamp01(
        score01 -
        repetitionPenalty01 * this.defaults.repetitionPenaltyWeight -
        safetyPenalty01,
      );

      const reasons = [
        `semantic=${stableRound(semanticFit01, 3)}`,
        `intent=${stableRound(intentFit01, 3)}`,
        `phase=${stableRound(phaseFit01, 3)}`,
        `channel=${stableRound(channelFit01, 3)}`,
        `role=${stableRound(roleFit01, 3)}`,
        `rescue=${stableRound(rescueBoost01, 3)}`,
        `escalation=${stableRound(escalationBoost01, 3)}`,
        `novelty=${stableRound(noveltyBoost01, 3)}`,
        `coherence=${stableRound(coherenceBoost01, 3)}`,
        `repetitionPenalty=${stableRound(repetitionPenalty01, 3)}`,
        `safetyPenalty=${stableRound(safetyPenalty01, 3)}`,
      ];

      ranked.push(Object.freeze({
        candidate,
        score01,
        rank: 0,
        chosen: false,
        semanticVectorRecord: vectorRecord,
        breakdown: Object.freeze({
          semanticFit01,
          intentFit01,
          phaseFit01,
          channelFit01,
          roleFit01,
          rescueBoost01,
          escalationBoost01,
          noveltyBoost01,
          coherenceBoost01,
          repetitionPenalty01,
          safetyPenalty01,
          priorityBias01,
          topReasons: Object.freeze(reasons),
        }),
      }));

      this.totals.candidatesScored += 1;
    }

    ranked.sort((left, right) => {
      if (right.score01 !== left.score01) {
        return Number(right.score01) - Number(left.score01);
      }

      return left.candidate.candidateId.localeCompare(right.candidate.candidateId);
    });

    const finalRanked = Object.freeze(
      ranked.map((item, index) =>
        Object.freeze({
          ...item,
          rank: index + 1,
          chosen:
            index === 0 &&
            Number(item.score01) >= this.defaults.minimumAcceptedScore01,
        }),
      ),
    );

    const chosen = finalRanked.find((item) => item.chosen) ?? null;

    const result: ChatResponseRankerResult = Object.freeze({
      requestId,
      ranked: finalRanked,
      chosen,
      encodedAtMs,
      activeChannel,
      conversationState,
      currentIntent,
      diagnostics: Object.freeze({
        candidateCount: input.candidates.length,
        truncatedCount,
        lexicalPromptSummary: extractPromptText(input),
        messageCount: (input.recentMessages ?? input.messages ?? []).length,
        modeId: input.currentModeId,
        runId: input.runId,
        roomId: input.roomId,
        metadata: input.metadata,
      }),
    });

    this.totals.ranks += 1;
    this.emitTelemetry('chat_response_ranked', {
      requestId,
      candidateCount: input.candidates.length,
      truncatedCount,
      chosenId: chosen?.candidate.candidateId ?? null,
      chosenScore01: chosen?.score01 ?? null,
      phase: conversationState.phase,
      dominantIntent: currentIntent.primaryIntent,
      activeChannel,
    });

    return result;
  }

  public async rankOne(
    input: ChatResponseRankerInput,
  ): Promise<Nullable<ChatRankedResponse>> {
    const result = await this.rank(input);
    return result.chosen;
  }

  public getPublicSnapshot(): Readonly<{
    moduleName: string;
    moduleVersion: string;
    totals: Readonly<{
      ranks: number;
      candidatesScored: number;
      deterministicFallbacks: number;
      conversationEncodes: number;
      intentEncodes: number;
    }>;
  }> {
    return Object.freeze({
      moduleName: CHAT_RESPONSE_RANKER_CLIENT_MODULE_NAME,
      moduleVersion: CHAT_RESPONSE_RANKER_CLIENT_VERSION,
      totals: Object.freeze({ ...this.totals }),
    });
  }

  private createIntentInput(
    requestId: string,
    input: ChatResponseRankerInput,
    activeChannel: ChatVisibleChannel,
  ): ChatDialogueIntentEncodingInput {
    return Object.freeze({
      requestId: `${requestId}:intent`,
      activeChannel,
      recentMessages: input.recentMessages ?? input.messages ?? [],
      featureSnapshot: input.featureSnapshot ?? null,
      learningProfile: input.learningProfile ?? null,
      bridgeSnapshot: input.bridgeSnapshot ?? null,
      recentEventNames: input.recentEventNames ?? [],
      currentModeId: input.currentModeId,
      metadata: input.metadata,
    } as any);
  }

  private createConversationStateInput(
    requestId: string,
    input: ChatResponseRankerInput,
    activeChannel: ChatVisibleChannel,
    currentIntent: ChatDialogueIntentEncodingResult,
  ): ChatConversationStateEncodingInput {
    return Object.freeze({
      requestId: `${requestId}:state`,
      activeChannel,
      recentMessages: input.recentMessages ?? input.messages ?? [],
      featureSnapshot: input.featureSnapshot ?? null,
      learningProfile: input.learningProfile ?? null,
      bridgeSnapshot: input.bridgeSnapshot ?? null,
      recentEventNames: input.recentEventNames ?? [],
      currentModeId: input.currentModeId,
      roomId: input.roomId,
      runId: input.runId,
      playerUserId: input.playerUserId,
      currentIntent,
      source: input.source === 'REPLAY' ? 'REPLAY' : 'LIVE',
      metadata: input.metadata,
    });
  }

  private async embedCandidate(
    candidate: ChatRankableResponseCandidate,
    input: ChatResponseRankerInput,
    conversationState: ChatConversationStateEncodingResult,
  ): Promise<ChatEmbeddingVectorRecord> {
    try {
      return await this.embeddingClient.embed(
        semanticInputForCandidate(candidate, input, conversationState),
      );
    } catch {
      this.totals.deterministicFallbacks += 1;
      return fallbackVectorRecord(
        candidate,
        input,
        conversationState,
        this.defaults.vectorDimensions,
      );
    }
  }

  private emitTelemetry(event: string, payload: JsonObject): void {
    this.options.telemetry?.emit(event, payload);
  }

  private nextRequestId(): string {
    this.requestCounter += 1;
    return `${this.requestPrefix}:${this.requestCounter}`;
  }
}

/* ========================================================================== */
/* MARK: Free helpers                                                         */
/* ========================================================================== */

export function createResponseRankerClient(
  options: ChatResponseRankerClientOptions = {},
): ResponseRankerClient {
  return new ResponseRankerClient(options);
}

export function createRankableResponseCandidate(
  candidate: ChatRankableResponseCandidate,
): ChatRankableResponseCandidate {
  return Object.freeze({
    ...candidate,
    text: normalizeText(candidate.text),
  });
}

export async function rankResponsesWithDeterministicEmbeddings(
  input: ChatResponseRankerInput,
  options: Partial<ChatResponseRankerClientOptions> = {},
): Promise<ChatResponseRankerResult> {
  const embeddingClient: ChatEmbeddingClientPort = {
    embed: async (embeddingInput: ChatEmbeddingInput): Promise<ChatEmbeddingVectorRecord> => {
      const vector = buildDeterministicMessageEmbedding(
        embeddingInput,
        CHAT_RESPONSE_RANKER_CLIENT_DEFAULTS.vectorDimensions,
      );

      return Object.freeze({
        requestId: 'deterministic-response-ranker',
        cacheKey: `deterministic:${(embeddingInput.text ?? '').length}`,
        source: 'LOCAL_DETERMINISTIC',
        model: 'deterministic-response-ranker-local',
        purpose: 'RANKING',
        dimensions: vector.length,
        vector,
        magnitude: 1,
        normalized: true,
        createdAtMs: asUnixMs(Date.now()),
        durationMs: 0,
        previewText: truncateText(embeddingInput.text ?? '', 140),
        contextSummary: truncateText(embeddingInput.text ?? '', 220),
        diagnostics: Object.freeze({ path: 'deterministic' }),
      });
    },
    embedBatch: async (): Promise<any> => {
      throw new Error('embedBatch is not implemented in deterministic helper.');
    },
    similarity: compareEmbeddingVectors,
    getPublicSnapshot: (): any => Object.freeze({
      moduleName: 'deterministic-response-ranker-client',
      moduleVersion: '1',
      model: 'deterministic-response-ranker-local',
      queueDepth: 0,
      cacheSize: 0,
      coalescedInflightCount: 0,
      totals: Object.freeze({
        requests: 0,
        batches: 0,
        cacheHits: 0,
        remoteCalls: 0,
        remoteFailures: 0,
        fallbackCalls: 1,
      }),
    }),
  };

  const ranker = createResponseRankerClient({
    ...options,
    embeddingClient,
  });

  return ranker.rank(input);
}

/* ========================================================================== */
/* MARK: Manifest                                                             */
/* ========================================================================== */

export const CHAT_RESPONSE_RANKER_CLIENT_MANIFEST = Object.freeze({
  moduleName: CHAT_RESPONSE_RANKER_CLIENT_MODULE_NAME,
  version: CHAT_RESPONSE_RANKER_CLIENT_VERSION,
  defaults: CHAT_RESPONSE_RANKER_CLIENT_DEFAULTS,
  runtimeLaws: CHAT_RESPONSE_RANKER_CLIENT_RUNTIME_LAWS,
  capabilities: Object.freeze({
    semanticRanking: true,
    intentAwareRanking: true,
    phaseAwareRanking: true,
    channelAwareRanking: true,
    helperVsHaterDifferentiation: true,
    deterministicFallback: true,
    localFirst: true,
    explainableBreakdowns: true,
  }),
} as const);

export const ChatResponseRanker = Object.freeze({
  ResponseRankerClient,
  createResponseRankerClient,
  createRankableResponseCandidate,
  rankResponsesWithDeterministicEmbeddings,
  manifest: CHAT_RESPONSE_RANKER_CLIENT_MANIFEST,
} as const);

export type ChatResponseRankerClientManifest =
  typeof CHAT_RESPONSE_RANKER_CLIENT_MANIFEST;
