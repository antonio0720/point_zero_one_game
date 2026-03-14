// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/intelligence/dl/ConversationStateEncoder.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT DL CONVERSATION STATE ENCODER
 * FILE: pzo-web/src/engines/chat/intelligence/dl/ConversationStateEncoder.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * This module encodes the live conversation lane into a bounded, explainable,
 * replay-safe state packet that the frontend can use immediately while the
 * backend remains authoritative.
 *
 * It is intentionally not a generic "thread summarizer."
 *
 * In this repo, chat is already converging with:
 * - pressure and tick timing,
 * - helper rescue timing,
 * - hater escalation,
 * - channel-specific social dynamics,
 * - negotiation posture,
 * - collapse / comeback narrative turns,
 * - cross-mode emotional continuity.
 *
 * That means the frontend needs a real state encoder that can:
 * - summarize what the conversation currently *is*,
 * - track how it is moving,
 * - encode the likelihood of rescue / escalation / silence / negotiation,
 * - produce a semantic vector for local ranking,
 * - remain deterministic during transport loss,
 * - never pretend to be backend truth.
 *
 * This encoder therefore exists to bridge:
 * - transcript-local reality,
 * - feature extraction,
 * - intent encoding,
 * - response ranking,
 * - optimistic NPC timing,
 * - local UI interventions.
 *
 * It does NOT:
 * - replace transcript truth,
 * - replace moderation,
 * - replace backend memory,
 * - replace server response ranking,
 * - invent authoritative sequence history.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type {
  ChatLearningBridgePublicSnapshot,
} from '../ChatLearningBridge';

import type {
  ChatAffectSnapshot,
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

export const CHAT_CONVERSATION_STATE_ENCODER_MODULE_NAME =
  'PZO_CHAT_CONVERSATION_STATE_ENCODER' as const;

export const CHAT_CONVERSATION_STATE_ENCODER_VERSION =
  '2026.03.13-conversation-state-encoder.v1' as const;

export const CHAT_CONVERSATION_STATE_ENCODER_RUNTIME_LAWS = Object.freeze([
  'Conversation state is advisory, fast, and explainable.',
  'State encoding must remain useful when backend inference is unavailable.',
  'Channels are social climates, not just tabs.',
  'Silence, hesitation, rescue, and negotiation pressure are first-class state.',
  'No single message may define the entire conversation unless it is truly singular.',
  'State output must be bounded and replay-safe.',
  'State vectors may support local ranking, but never become transcript truth.',
  'Escalation and rescue are both valid state outcomes and must be modeled simultaneously.',
] as const);

export const CHAT_CONVERSATION_STATE_ENCODER_DEFAULTS = Object.freeze({
  maxRecentMessages: 20,
  primaryWindowMessages: 8,
  volatilityWindowMessages: 6,
  intentWindowMessages: 6,
  maxSummaryChars: 3_200,
  maxTagCount: 18,
  maxSecondaryPhases: 4,
  vectorDimensions: 192,
  embeddingWeight: 0.34,
  lexicalWeight: 0.28,
  contextWeight: 0.24,
  affectWeight: 0.14,
  strongSignalThreshold: 0.68,
  mediumSignalThreshold: 0.52,
  weakSignalThreshold: 0.35,
  rescuePhaseThreshold: 0.62,
  negotiationPhaseThreshold: 0.57,
  climaxPhaseThreshold: 0.71,
  silencePhaseThreshold: 0.66,
  postRunPhaseThreshold: 0.58,
  escalationThreshold: 0.61,
  coherenceFloor: 0.18,
  roleDiversityWeight: 0.14,
  channelStabilityWeight: 0.12,
  messageCadenceWeight: 0.18,
  affectTurbulenceWeight: 0.20,
  intentDominanceWeight: 0.20,
  repetitionPenaltyWeight: 0.16,
  textPreviewChars: 220,
} as const);

/* ========================================================================== */
/* MARK: Public contracts                                                     */
/* ========================================================================== */

export type ChatConversationPhase =
  | 'OPENING'
  | 'SETTLING'
  | 'BUILDING'
  | 'ESCALATING'
  | 'NEGOTIATION'
  | 'RESCUE'
  | 'CLIMAX'
  | 'COOLDOWN'
  | 'POST_RUN'
  | 'DORMANT';

export type ChatConversationTemperature =
  | 'COLD'
  | 'WARM'
  | 'HOT'
  | 'CRITICAL';

export type ChatConversationPressureTier =
  | 'LOW'
  | 'RISING'
  | 'HIGH'
  | 'EXTREME';

export type ChatConversationStateTag =
  | 'HELPER_READY'
  | 'HELPER_OVERDUE'
  | 'HATER_BAIT'
  | 'HATER_ESCALATION'
  | 'NEGOTIATION_ACTIVE'
  | 'NEGOTIATION_BLUFF'
  | 'SILENCE_MEANINGFUL'
  | 'SILENCE_DANGEROUS'
  | 'CROWD_SWARM'
  | 'EMBARRASSMENT_SPIKE'
  | 'CONFIDENCE_SURGE'
  | 'FRUSTRATION_LOOP'
  | 'RECOVERY_WINDOW'
  | 'POST_COLLAPSE'
  | 'POST_COMEBACK'
  | 'DEALROOM_TENSION'
  | 'CHANNEL_DRIFT'
  | 'MODE_TRANSITION'
  | 'READ_PRESSURE'
  | 'TYPING_STALL';

export interface ChatConversationStateTelemetryPort {
  emit(event: string, payload: JsonObject): void;
}

export interface ChatConversationStateEncodingInput {
  readonly requestId?: string;
  readonly now?: UnixMs | number;
  readonly activeChannel?: ChatVisibleChannel;
  readonly visibleChannel?: ChatVisibleChannel;
  readonly messages?: readonly ChatMessage[];
  readonly recentMessages?: readonly ChatMessage[];
  readonly featureSnapshot?: Nullable<ChatFeatureSnapshot>;
  readonly learningProfile?: Nullable<ChatLearningProfile>;
  readonly bridgeSnapshot?: Nullable<ChatLearningBridgePublicSnapshot>;
  readonly affectSnapshot?: Nullable<ChatAffectSnapshot>;
  readonly currentIntent?: Nullable<ChatDialogueIntentEncodingResult>;
  readonly recentEventNames?: readonly string[];
  readonly currentModeId?: string;
  readonly previousState?: Nullable<ChatConversationStateEncodingResult>;
  readonly sessionId?: string;
  readonly runId?: string;
  readonly roomId?: string;
  readonly playerUserId?: string;
  readonly forcePhase?: Nullable<ChatConversationPhase>;
  readonly forceTags?: readonly ChatConversationStateTag[];
  readonly source?:
    | 'LIVE'
    | 'PREVIEW'
    | 'REPLAY'
    | 'RESUME'
    | 'SYSTEM_RECONCILIATION';
  readonly metadata?: JsonObject;
}

export interface ChatConversationStateScores {
  readonly coherence01: Score01;
  readonly volatility01: Score01;
  readonly silenceWeight01: Score01;
  readonly rescueNeed01: Score01;
  readonly haterBait01: Score01;
  readonly negotiationPressure01: Score01;
  readonly crowdHeat01: Score01;
  readonly embarrassment01: Score01;
  readonly confidence01: Score01;
  readonly frustration01: Score01;
  readonly recoveryWindow01: Score01;
  readonly climax01: Score01;
  readonly postRunWeight01: Score01;
  readonly channelLock01: Score01;
  readonly roleDiversity01: Score01;
  readonly semanticDensity01: Score01;
  readonly repetitionPenalty01: Score01;
}

export interface ChatConversationStateBreakdown {
  readonly lexicalSignals: Readonly<Record<string, Score01>>;
  readonly roleSignals: Readonly<Record<string, Score01>>;
  readonly channelSignals: Readonly<Record<string, Score01>>;
  readonly affectSignals: Readonly<Record<string, Score01>>;
  readonly eventSignals: Readonly<Record<string, Score01>>;
  readonly phaseSignals: Readonly<Record<ChatConversationPhase, Score01>>;
  readonly topReasons: readonly string[];
}

export interface ChatConversationStateChannelProfile {
  readonly channel: ChatVisibleChannel;
  readonly suitability01: Score01;
  readonly volatility01: Score01;
  readonly rescueFit01: Score01;
  readonly negotiationFit01: Score01;
  readonly escalationFit01: Score01;
  readonly explanation: string;
}

export interface ChatConversationStateEncodingResult {
  readonly requestId: string;
  readonly encodedAtMs: UnixMs;
  readonly source:
    | 'LIVE'
    | 'PREVIEW'
    | 'REPLAY'
    | 'RESUME'
    | 'SYSTEM_RECONCILIATION';
  readonly activeChannel: ChatVisibleChannel;
  readonly phase: ChatConversationPhase;
  readonly secondaryPhases: readonly ChatConversationPhase[];
  readonly temperature: ChatConversationTemperature;
  readonly pressureTier: ChatConversationPressureTier;
  readonly messageCount: number;
  readonly roleCount: number;
  readonly dominantIntent: ChatDialogueIntent;
  readonly supportingIntents: readonly ChatDialogueIntent[];
  readonly tags: readonly ChatConversationStateTag[];
  readonly scores: ChatConversationStateScores;
  readonly channels: readonly ChatConversationStateChannelProfile[];
  readonly stateSummary: string;
  readonly transcriptSummary: string;
  readonly semanticVector: readonly number[];
  readonly semanticVectorRecord: ChatEmbeddingVectorRecord;
  readonly latestIntent: ChatDialogueIntentEncodingResult;
  readonly breakdown: ChatConversationStateBreakdown;
  readonly diagnostics: Readonly<{
    recentEventNames: readonly string[];
    roleHistogram: Readonly<Record<string, number>>;
    channelHistogram: Readonly<Record<string, number>>;
    lexicalSummary: string;
    modeId?: string;
    runId?: string;
    roomId?: string;
    metadata?: JsonObject;
  }>;
}

export interface ChatConversationStateEncoderOptions {
  readonly defaults?: Partial<typeof CHAT_CONVERSATION_STATE_ENCODER_DEFAULTS>;
  readonly embeddingClient?: ChatEmbeddingClientPort;
  readonly intentEncoder?: DialogueIntentEncoder;
  readonly telemetry?: ChatConversationStateTelemetryPort;
  readonly embeddingTelemetry?: ChatEmbeddingTelemetryPort;
}

export interface ChatConversationStateEncoderPort {
  encode(
    input: ChatConversationStateEncodingInput,
  ): Promise<ChatConversationStateEncodingResult>;
  compare(
    lhs: ChatConversationStateEncodingResult,
    rhs: ChatConversationStateEncodingResult,
  ): Readonly<{
    similarity01: Score01;
    phaseAgreement01: Score01;
    channelAgreement01: Score01;
    temperatureAgreement01: Score01;
  }>;
  getPublicSnapshot(): Readonly<{
    moduleName: string;
    moduleVersion: string;
    totals: Readonly<{
      encodes: number;
      deterministicFallbacks: number;
      intentEncodes: number;
    }>;
  }>;
}

/* ========================================================================== */
/* MARK: Internal constants                                                   */
/* ========================================================================== */

const DEFAULT_CHANNEL: ChatVisibleChannel = 'GLOBAL';

const SYSTEM_ROLE_KEYS = Object.freeze([
  'SYSTEM',
  'MODERATOR',
  'ADMIN',
  'GAME',
] as const);

const HATER_ROLE_KEYS = Object.freeze([
  'HATER',
  'RIVAL',
  'ENEMY',
  'BOT_HATER',
] as const);

const HELPER_ROLE_KEYS = Object.freeze([
  'HELPER',
  'ALLY',
  'MENTOR',
  'BOT_HELPER',
] as const);

const NEGOTIATION_WORDS = Object.freeze([
  'deal', 'offer', 'counter', 'price', 'terms', 'trade', 'buy', 'sell',
  'bid', 'bluff', 'leverage', 'stake', 'split', 'contract', 'discount',
  'premium', 'closing', 'counteroffer', 'margin', 'liquidity',
] as const);

const RESCUE_WORDS = Object.freeze([
  'help', 'stuck', 'lost', 'cant', "can't", 'recover', 'save', 'rescue',
  'what now', 'fix', 'panic', 'falling apart', 'collapsed', 'done',
] as const);

const ESCALATION_WORDS = Object.freeze([
  'weak', 'fraud', 'owned', 'washed', 'finished', 'broke', 'bankrupt',
  'collapse', 'destroy', 'crush', 'embarrassing', 'clown', 'bait',
  'pressure', 'hunted', 'liquidated',
] as const);

const COMEBACK_WORDS = Object.freeze([
  'comeback', 'recovering', 'back', 'rebound', 'clean exit', 'stabilized',
  'survived', 'still here', 'turned it', 'held', 'bounce', 'clutched',
] as const);

const POST_RUN_WORDS = Object.freeze([
  'gg', 'good run', 'postmortem', 'debrief', 'what happened', 'turning point',
  'next run', 'again', 'reset', 'restart', 'run over', 'match over',
] as const);

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

function safeAverage(values: readonly number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function truncateText(value: string, max = 160): string {
  const normalized = `${value ?? ''}`.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function normalizeText(value: string | null | undefined): string {
  return `${value ?? ''}`
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(value: string | null | undefined): string {
  return normalizeText(value).toUpperCase();
}

function countWordHits(text: string, words: readonly string[]): number {
  const normalized = text.toLowerCase();
  let total = 0;
  for (const word of words) {
    if (normalized.includes(word)) {
      total += 1;
    }
  }
  return total;
}

function boundedRatio(numerator: number, denominator: number): Score01 {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0 as Score01;
  }
  return clamp01(numerator / denominator);
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return Object.freeze(result);
}

function sortRecordDesc(record: Readonly<Record<string, number>>): readonly [string, number][] {
  return Object.freeze(
    Object.entries(record)
      .sort((a, b) => Number(b[1]) - Number(a[1])),
  );
}

function inferMessageRole(message: ChatMessage): string {
  const candidateKeys = [
    (message as any).senderRole,
    (message as any).role,
    (message as any).sourceType,
    (message as any).source,
    (message as any).speakerRole,
    (message as any).speakerType,
  ];

  for (const candidate of candidateKeys) {
    const key = normalizeKey(candidate);
    if (key) {
      return key;
    }
  }

  return 'UNKNOWN';
}

function inferMessageChannel(
  message: ChatMessage,
  fallback: ChatVisibleChannel,
): ChatVisibleChannel {
  const candidate = normalizeKey(
    (message as any).channel ??
    (message as any).channelId ??
    (message as any).roomChannel ??
    fallback,
  );

  switch (candidate) {
    case 'GLOBAL':
    case 'SYNDICATE':
    case 'DEAL_ROOM':
    case 'LOBBY':
      return candidate as ChatVisibleChannel;
    default:
      return fallback;
  }
}

function extractMessageText(message: ChatMessage): string {
  const candidates = [
    (message as any).content,
    (message as any).text,
    (message as any).body,
    (message as any).message,
    (message as any).plainText,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

function extractMessageTimeMs(message: ChatMessage, fallbackIndex: number): number {
  const candidates = [
    (message as any).createdAtMs,
    (message as any).createdAt,
    (message as any).timestampMs,
    (message as any).timestamp,
    (message as any).sentAtMs,
    (message as any).sentAt,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  return fallbackIndex;
}

function buildChannelHistogram(
  messages: readonly ChatMessage[],
  fallback: ChatVisibleChannel,
): Readonly<Record<string, number>> {
  const histogram: Record<string, number> = Object.create(null);
  for (const message of messages) {
    const key = inferMessageChannel(message, fallback);
    histogram[key] = (histogram[key] ?? 0) + 1;
  }
  return Object.freeze({ ...histogram });
}

function buildRoleHistogram(
  messages: readonly ChatMessage[],
): Readonly<Record<string, number>> {
  const histogram: Record<string, number> = Object.create(null);
  for (const message of messages) {
    const key = inferMessageRole(message);
    histogram[key] = (histogram[key] ?? 0) + 1;
  }
  return Object.freeze({ ...histogram });
}

function detectPrimaryRoleClass(roleHistogram: Readonly<Record<string, number>>): string {
  const top = sortRecordDesc(roleHistogram)[0];
  return top?.[0] ?? 'UNKNOWN';
}

function extractAffectFromFeatureSnapshot(
  featureSnapshot?: Nullable<ChatFeatureSnapshot>,
): Nullable<ChatAffectSnapshot> {
  const candidate =
    (featureSnapshot as any)?.affectSnapshot ??
    (featureSnapshot as any)?.affect ??
    (featureSnapshot as any)?.emotion ??
    null;

  if (candidate && typeof candidate === 'object') {
    return candidate as ChatAffectSnapshot;
  }

  return null;
}

function affectValue(candidate: any, keys: readonly string[]): number {
  if (!candidate || typeof candidate !== 'object') {
    return 0;
  }

  for (const key of keys) {
    const direct = candidate[key];
    if (typeof direct === 'number' && Number.isFinite(direct)) {
      return clamp01(direct);
    }

    const lower = candidate[key.toLowerCase()];
    if (typeof lower === 'number' && Number.isFinite(lower)) {
      return clamp01(lower);
    }
  }

  return 0;
}

function summarizeRecentMessages(messages: readonly ChatMessage[]): string {
  if (!messages.length) {
    return 'No recent messages.';
  }

  const parts: string[] = [];

  for (const message of messages.slice(-6)) {
    const role = inferMessageRole(message);
    const channel = inferMessageChannel(message, DEFAULT_CHANNEL);
    const text = truncateText(extractMessageText(message), 120);
    parts.push(`[${channel}|${role}] ${text || '(empty)'}`);
  }

  return parts.join(' || ');
}

function buildStateSummarySentence(
  phase: ChatConversationPhase,
  temperature: ChatConversationTemperature,
  channel: ChatVisibleChannel,
  scores: ChatConversationStateScores,
  dominantIntent: ChatDialogueIntent,
  tags: readonly ChatConversationStateTag[],
): string {
  const tagPhrase = tags.slice(0, 4).join(', ') || 'NO_TAGS';
  return [
    `phase=${phase}`,
    `temp=${temperature}`,
    `channel=${channel}`,
    `intent=${dominantIntent}`,
    `rescue=${stableRound(scores.rescueNeed01, 3)}`,
    `bait=${stableRound(scores.haterBait01, 3)}`,
    `negotiation=${stableRound(scores.negotiationPressure01, 3)}`,
    `silence=${stableRound(scores.silenceWeight01, 3)}`,
    `tags=${tagPhrase}`,
  ].join(' | ');
}

function buildTranscriptSummary(
  messages: readonly ChatMessage[],
  maxChars: number,
): string {
  const raw = summarizeRecentMessages(messages);
  return truncateText(raw, maxChars);
}

function buildStateEmbeddingInput(
  summary: string,
  input: ChatConversationStateEncodingInput,
  phase: ChatConversationPhase,
  tags: readonly ChatConversationStateTag[],
): ChatEmbeddingInput {
  return Object.freeze({
    purpose: 'STATE',
    text: [
      summary,
      `phase:${phase}`,
      `channel:${input.activeChannel ?? input.visibleChannel ?? DEFAULT_CHANNEL}`,
      `mode:${input.currentModeId ?? 'UNKNOWN'}`,
      `tags:${tags.join(',')}`,
    ].join(' | '),
    activeChannel: input.activeChannel ?? input.visibleChannel ?? DEFAULT_CHANNEL,
    metadata: Object.freeze({
      requestId: input.requestId,
      roomId: input.roomId,
      runId: input.runId,
      source: input.source ?? 'LIVE',
      recentEventNames: input.recentEventNames ?? [],
    }),
  } as any);
}

function ngrams(text: string, gram = 3): readonly string[] {
  const value = normalizeText(text).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ');
  if (!value) {
    return Object.freeze([]);
  }

  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= gram) {
    return Object.freeze([compact]);
  }

  const result: string[] = [];
  for (let index = 0; index <= compact.length - gram; index += 1) {
    const slice = compact.slice(index, index + gram).trim();
    if (slice) {
      result.push(slice);
    }
  }

  return Object.freeze(uniqueStrings(result));
}

function jaccardSimilarity(lhs: readonly string[], rhs: readonly string[]): Score01 {
  if (!lhs.length || !rhs.length) {
    return 0 as Score01;
  }

  const left = new Set(lhs);
  const right = new Set(rhs);

  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) {
      intersection += 1;
    }
  }

  const union = new Set([...left, ...right]).size;
  return union > 0 ? clamp01(intersection / union) : (0 as Score01);
}

function phaseScoreMap(): Record<ChatConversationPhase, number> {
  return {
    OPENING: 0,
    SETTLING: 0,
    BUILDING: 0,
    ESCALATING: 0,
    NEGOTIATION: 0,
    RESCUE: 0,
    CLIMAX: 0,
    COOLDOWN: 0,
    POST_RUN: 0,
    DORMANT: 0,
  };
}

function zeroScoreRecord(keys: readonly string[]): Readonly<Record<string, Score01>> {
  const output: Record<string, Score01> = Object.create(null);
  for (const key of keys) {
    output[key] = 0 as Score01;
  }
  return output;
}

/* ========================================================================== */
/* MARK: Derivation helpers                                                   */
/* ========================================================================== */

function deriveMessageCadence(messages: readonly ChatMessage[]): Score01 {
  if (messages.length <= 1) {
    return 0 as Score01;
  }

  const sorted = [...messages]
    .map((message, index) => ({
      timeMs: extractMessageTimeMs(message, index),
    }))
    .sort((a, b) => a.timeMs - b.timeMs);

  const gaps: number[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    gaps.push(Math.max(0, sorted[index].timeMs - sorted[index - 1].timeMs));
  }

  const avgGap = safeAverage(gaps);
  if (avgGap <= 0) {
    return 1 as Score01;
  }

  if (avgGap <= 2_500) {
    return 1 as Score01;
  }

  if (avgGap <= 8_000) {
    return clamp01(0.82 - ((avgGap - 2_500) / 5_500) * 0.22);
  }

  if (avgGap <= 22_000) {
    return clamp01(0.60 - ((avgGap - 8_000) / 14_000) * 0.28);
  }

  return clamp01(0.28 - Math.min(0.22, (avgGap - 22_000) / 120_000));
}

function deriveRepetitionPenalty(messages: readonly ChatMessage[]): Score01 {
  if (messages.length <= 1) {
    return 0 as Score01;
  }

  const texts = messages
    .map((message) => extractMessageText(message))
    .filter(Boolean);

  if (texts.length <= 1) {
    return 0 as Score01;
  }

  const grams = texts.map((text) => ngrams(text, 4));
  const pairScores: number[] = [];

  for (let left = 0; left < grams.length; left += 1) {
    for (let right = left + 1; right < grams.length; right += 1) {
      pairScores.push(jaccardSimilarity(grams[left], grams[right]));
    }
  }

  return clamp01(safeAverage(pairScores));
}

function deriveRoleDiversity(roleHistogram: Readonly<Record<string, number>>): Score01 {
  const total = Object.values(roleHistogram).reduce((sum, value) => sum + value, 0);
  const unique = Object.keys(roleHistogram).length;
  if (total <= 0) {
    return 0 as Score01;
  }

  return clamp01(unique / Math.min(6, total));
}

function deriveChannelLock(
  channelHistogram: Readonly<Record<string, number>>,
  activeChannel: ChatVisibleChannel,
): Score01 {
  const total = Object.values(channelHistogram).reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return 0 as Score01;
  }

  return clamp01((channelHistogram[activeChannel] ?? 0) / total);
}

function deriveLexicalSignals(
  text: string,
): Readonly<Record<string, Score01>> {
  const totalLen = Math.max(1, text.length / 18);

  const negotiationHits = countWordHits(text, NEGOTIATION_WORDS);
  const rescueHits = countWordHits(text, RESCUE_WORDS);
  const escalationHits = countWordHits(text, ESCALATION_WORDS);
  const comebackHits = countWordHits(text, COMEBACK_WORDS);
  const postRunHits = countWordHits(text, POST_RUN_WORDS);

  const shameHints = countWordHits(text, Object.freeze([
    'embarrassing', 'humiliated', 'stupid', 'fool', 'cant believe',
    'everyone saw', 'laughed at', 'looked bad',
  ] as const));

  const confidenceHints = countWordHits(text, Object.freeze([
    'i got this', 'easy', 'watch me', 'i know', 'locked in', 'clean',
    'calm', 'under control', 'i am back',
  ] as const));

  const signals = {
    negotiation01: clamp01(negotiationHits / totalLen),
    rescue01: clamp01(rescueHits / totalLen),
    escalation01: clamp01(escalationHits / totalLen),
    comeback01: clamp01(comebackHits / totalLen),
    postRun01: clamp01(postRunHits / totalLen),
    embarrassment01: clamp01(shameHints / totalLen),
    confidence01: clamp01(confidenceHints / totalLen),
  };

  return Object.freeze(signals);
}

function deriveEventSignals(
  recentEventNames: readonly string[],
): Readonly<Record<string, Score01>> {
  const normalized = recentEventNames.map((value) => normalizeKey(value));
  const total = Math.max(1, normalized.length);

  const scoreFor = (...keys: string[]): Score01 => {
    let hits = 0;
    for (const value of normalized) {
      if (keys.some((key) => value.includes(key))) {
        hits += 1;
      }
    }
    return clamp01(hits / total);
  };

  return Object.freeze({
    rescue01: scoreFor('RESCUE', 'SAVE', 'RECOVERY'),
    escalation01: scoreFor('ATTACK', 'SABOTAGE', 'BREACH', 'HATER'),
    negotiation01: scoreFor('DEAL', 'TRADE', 'OFFER'),
    postRun01: scoreFor('RUN_END', 'MATCH_END', 'DEBRIEF', 'AFTER_ACTION'),
    comeback01: scoreFor('RECOVERED', 'COMEBACK', 'STABILIZED'),
    collapse01: scoreFor('BANKRUPT', 'COLLAPSE', 'BROKE', 'ELIMINATED'),
  });
}

function deriveAffectSignals(
  affectSnapshot: Nullable<ChatAffectSnapshot>,
  featureSnapshot: Nullable<ChatFeatureSnapshot>,
): Readonly<Record<string, Score01>> {
  const candidate = affectSnapshot ?? extractAffectFromFeatureSnapshot(featureSnapshot);

  const intimidation01 = affectValue(candidate as any, ['intimidation', 'fear']);
  const confidence01 = affectValue(candidate as any, ['confidence', 'dominance']);
  const frustration01 = affectValue(candidate as any, ['frustration', 'anger']);
  const embarrassment01 = affectValue(candidate as any, ['embarrassment', 'shame']);
  const relief01 = affectValue(candidate as any, ['relief']);
  const trust01 = affectValue(candidate as any, ['trust', 'attachment']);

  return Object.freeze({
    intimidation01,
    confidence01,
    frustration01,
    embarrassment01,
    relief01,
    trust01,
  });
}

function deriveBridgeRescueNeed(
  bridgeSnapshot: Nullable<ChatLearningBridgePublicSnapshot>,
  featureSnapshot: Nullable<ChatFeatureSnapshot>,
): Score01 {
  const candidates = [
    (bridgeSnapshot as any)?.inference?.rescueNeed01,
    (bridgeSnapshot as any)?.rescueNeed01,
    (featureSnapshot as any)?.dropOffSignals?.rescueNeed01,
    (featureSnapshot as any)?.rescueNeed01,
    (featureSnapshot as any)?.helperNeed01,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return clamp01(candidate);
    }
  }

  return 0 as Score01;
}

function deriveBridgeHaterBait(
  bridgeSnapshot: Nullable<ChatLearningBridgePublicSnapshot>,
  featureSnapshot: Nullable<ChatFeatureSnapshot>,
): Score01 {
  const candidates = [
    (bridgeSnapshot as any)?.inference?.haterTolerance01,
    (bridgeSnapshot as any)?.haterTolerance01,
    (featureSnapshot as any)?.haterTolerance01,
    (featureSnapshot as any)?.toxicityRisk01,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return clamp01(candidate);
    }
  }

  return 0 as Score01;
}

function deriveCrowdHeat(
  featureSnapshot: Nullable<ChatFeatureSnapshot>,
): Score01 {
  const candidates = [
    (featureSnapshot as any)?.audienceHeat?.heat01,
    (featureSnapshot as any)?.audienceHeat01,
    (featureSnapshot as any)?.crowdHeat01,
    (featureSnapshot as any)?.socialPressure01,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return clamp01(candidate);
    }
  }

  return 0 as Score01;
}

function deriveSemanticDensity(messages: readonly ChatMessage[]): Score01 {
  const texts = messages.map((message) => extractMessageText(message)).filter(Boolean);
  if (!texts.length) {
    return 0 as Score01;
  }

  const uniqueTerms = new Set<string>();
  let totalTerms = 0;

  for (const text of texts) {
    const parts = text
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    totalTerms += parts.length;
    for (const part of parts) {
      uniqueTerms.add(part);
    }
  }

  if (totalTerms <= 0) {
    return 0 as Score01;
  }

  return clamp01(uniqueTerms.size / Math.min(80, totalTerms));
}

function derivePhaseSignals(
  lexical: Readonly<Record<string, Score01>>,
  events: Readonly<Record<string, Score01>>,
  affect: Readonly<Record<string, Score01>>,
  rescueNeed01: Score01,
  haterBait01: Score01,
  crowdHeat01: Score01,
  cadence01: Score01,
  silenceWeight01: Score01,
): Readonly<Record<ChatConversationPhase, Score01>> {
  const output = phaseScoreMap();

  output.OPENING += clamp01((1 - cadence01) * 0.34 + (1 - crowdHeat01) * 0.16);
  output.SETTLING += clamp01((1 - haterBait01) * 0.20 + (1 - lexical.escalation01) * 0.18);
  output.BUILDING += clamp01(cadence01 * 0.28 + lexical.confidence01 * 0.14);
  output.ESCALATING += clamp01(lexical.escalation01 * 0.44 + haterBait01 * 0.28 + crowdHeat01 * 0.12);
  output.NEGOTIATION += clamp01(lexical.negotiation01 * 0.52 + events.negotiation01 * 0.20);
  output.RESCUE += clamp01(rescueNeed01 * 0.46 + affect.frustration01 * 0.16 + lexical.rescue01 * 0.14);
  output.CLIMAX += clamp01(output.ESCALATING * 0.50 + lexical.comeback01 * 0.10 + crowdHeat01 * 0.12);
  output.COOLDOWN += clamp01(affect.relief01 * 0.26 + silenceWeight01 * 0.18);
  output.POST_RUN += clamp01(lexical.postRun01 * 0.52 + events.postRun01 * 0.22);
  output.DORMANT += clamp01(silenceWeight01 * 0.32 + (1 - cadence01) * 0.18);

  return Object.freeze({
    OPENING: clamp01(output.OPENING),
    SETTLING: clamp01(output.SETTLING),
    BUILDING: clamp01(output.BUILDING),
    ESCALATING: clamp01(output.ESCALATING),
    NEGOTIATION: clamp01(output.NEGOTIATION),
    RESCUE: clamp01(output.RESCUE),
    CLIMAX: clamp01(output.CLIMAX),
    COOLDOWN: clamp01(output.COOLDOWN),
    POST_RUN: clamp01(output.POST_RUN),
    DORMANT: clamp01(output.DORMANT),
  });
}

function selectConversationPhase(
  signals: Readonly<Record<ChatConversationPhase, Score01>>,
  forced?: Nullable<ChatConversationPhase>,
): ChatConversationPhase {
  if (forced) {
    return forced;
  }

  const top = (Object.entries(signals) as [ChatConversationPhase, Score01][])
    .sort((a, b) => Number(b[1]) - Number(a[1]))[0];

  return top?.[0] ?? 'DORMANT';
}

function secondaryPhasesFromSignals(
  signals: Readonly<Record<ChatConversationPhase, Score01>>,
  primary: ChatConversationPhase,
  maxCount: number,
): readonly ChatConversationPhase[] {
  return Object.freeze(
    (Object.entries(signals) as [ChatConversationPhase, Score01][])
      .filter(([phase]) => phase !== primary)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, maxCount)
      .filter(([, value]) => Number(value) > 0.18)
      .map(([phase]) => phase),
  );
}

function deriveTemperature(
  climax01: Score01,
  crowdHeat01: Score01,
  rescueNeed01: Score01,
  escalation01: Score01,
): ChatConversationTemperature {
  const weighted =
    climax01 * 0.36 +
    crowdHeat01 * 0.22 +
    rescueNeed01 * 0.20 +
    escalation01 * 0.22;

  if (weighted >= 0.74) {
    return 'CRITICAL';
  }
  if (weighted >= 0.54) {
    return 'HOT';
  }
  if (weighted >= 0.28) {
    return 'WARM';
  }
  return 'COLD';
}

function derivePressureTier(
  rescueNeed01: Score01,
  escalation01: Score01,
  silenceWeight01: Score01,
  negotiationPressure01: Score01,
): ChatConversationPressureTier {
  const weighted =
    rescueNeed01 * 0.36 +
    escalation01 * 0.28 +
    silenceWeight01 * 0.16 +
    negotiationPressure01 * 0.20;

  if (weighted >= 0.74) {
    return 'EXTREME';
  }
  if (weighted >= 0.50) {
    return 'HIGH';
  }
  if (weighted >= 0.26) {
    return 'RISING';
  }
  return 'LOW';
}

function deriveStateTags(
  phase: ChatConversationPhase,
  scores: ChatConversationStateScores,
  activeChannel: ChatVisibleChannel,
  recentEventNames: readonly string[],
  forceTags?: readonly ChatConversationStateTag[],
): readonly ChatConversationStateTag[] {
  const tags: ChatConversationStateTag[] = [];

  if (scores.rescueNeed01 >= 0.58) {
    tags.push('HELPER_READY');
  }
  if (scores.rescueNeed01 >= 0.72) {
    tags.push('HELPER_OVERDUE');
  }
  if (scores.haterBait01 >= 0.56) {
    tags.push('HATER_BAIT');
  }
  if (scores.haterBait01 >= 0.72 || phase === 'ESCALATING' || phase === 'CLIMAX') {
    tags.push('HATER_ESCALATION');
  }
  if (scores.negotiationPressure01 >= 0.52) {
    tags.push('NEGOTIATION_ACTIVE');
  }
  if (scores.negotiationPressure01 >= 0.66) {
    tags.push('NEGOTIATION_BLUFF');
  }
  if (scores.silenceWeight01 >= 0.48) {
    tags.push('SILENCE_MEANINGFUL');
  }
  if (scores.silenceWeight01 >= 0.72 && scores.rescueNeed01 >= 0.48) {
    tags.push('SILENCE_DANGEROUS');
  }
  if (scores.crowdHeat01 >= 0.58) {
    tags.push('CROWD_SWARM');
  }
  if (scores.embarrassment01 >= 0.52) {
    tags.push('EMBARRASSMENT_SPIKE');
  }
  if (scores.confidence01 >= 0.62) {
    tags.push('CONFIDENCE_SURGE');
  }
  if (scores.frustration01 >= 0.58) {
    tags.push('FRUSTRATION_LOOP');
  }
  if (scores.recoveryWindow01 >= 0.54) {
    tags.push('RECOVERY_WINDOW');
  }
  if (recentEventNames.some((value) => normalizeKey(value).includes('COLLAPSE'))) {
    tags.push('POST_COLLAPSE');
  }
  if (recentEventNames.some((value) => normalizeKey(value).includes('COMEBACK'))) {
    tags.push('POST_COMEBACK');
  }
  if (activeChannel === 'DEAL_ROOM') {
    tags.push('DEALROOM_TENSION');
  }
  if (scores.channelLock01 <= 0.38) {
    tags.push('CHANNEL_DRIFT');
  }
  if (recentEventNames.some((value) => normalizeKey(value).includes('MODE'))) {
    tags.push('MODE_TRANSITION');
  }
  if (scores.silenceWeight01 >= 0.60 && scores.negotiationPressure01 >= 0.46) {
    tags.push('READ_PRESSURE');
  }
  if (scores.volatility01 <= 0.24 && scores.silenceWeight01 >= 0.62) {
    tags.push('TYPING_STALL');
  }

  if (forceTags?.length) {
    tags.push(...forceTags);
  }

  return Object.freeze(uniqueStrings(tags).slice(0, CHAT_CONVERSATION_STATE_ENCODER_DEFAULTS.maxTagCount) as ChatConversationStateTag[]);
}

function buildChannelProfiles(
  activeChannel: ChatVisibleChannel,
  scores: ChatConversationStateScores,
  phase: ChatConversationPhase,
): readonly ChatConversationStateChannelProfile[] {
  const channels: ChatVisibleChannel[] = ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'];

  const profiles = channels.map((channel) => {
    let suitability01 = 0.34;
    let rescueFit01 = 0.25;
    let negotiationFit01 = 0.18;
    let escalationFit01 = 0.18;

    switch (channel) {
      case 'GLOBAL':
        suitability01 += scores.crowdHeat01 * 0.24 + scores.confidence01 * 0.12;
        escalationFit01 += scores.haterBait01 * 0.20 + scores.climax01 * 0.16;
        break;
      case 'SYNDICATE':
        suitability01 += scores.coherence01 * 0.18 + scores.recoveryWindow01 * 0.12;
        rescueFit01 += scores.rescueNeed01 * 0.20 + scores.embarrassment01 * 0.10;
        break;
      case 'DEAL_ROOM':
        suitability01 += scores.negotiationPressure01 * 0.30 + scores.silenceWeight01 * 0.08;
        negotiationFit01 += scores.negotiationPressure01 * 0.34 + scores.coherence01 * 0.10;
        break;
      case 'LOBBY':
        suitability01 += (1 - scores.volatility01) * 0.16 + (phase === 'OPENING' ? 0.14 : 0);
        rescueFit01 += scores.recoveryWindow01 * 0.08;
        break;
      default:
        break;
    }

    if (channel === activeChannel) {
      suitability01 += 0.14;
    }

    if (phase === 'RESCUE' && channel === 'SYNDICATE') {
      suitability01 += 0.12;
      rescueFit01 += 0.14;
    }

    if (phase === 'NEGOTIATION' && channel === 'DEAL_ROOM') {
      suitability01 += 0.18;
      negotiationFit01 += 0.16;
    }

    if ((phase === 'ESCALATING' || phase === 'CLIMAX') && channel === 'GLOBAL') {
      suitability01 += 0.14;
      escalationFit01 += 0.16;
    }

    const explanation = [
      `channel=${channel}`,
      `phase=${phase}`,
      `fit=${stableRound(suitability01, 3)}`,
      `rescue=${stableRound(rescueFit01, 3)}`,
      `negotiation=${stableRound(negotiationFit01, 3)}`,
      `escalation=${stableRound(escalationFit01, 3)}`,
    ].join(' | ');

    return Object.freeze({
      channel,
      suitability01: clamp01(suitability01),
      volatility01: scores.volatility01,
      rescueFit01: clamp01(rescueFit01),
      negotiationFit01: clamp01(negotiationFit01),
      escalationFit01: clamp01(escalationFit01),
      explanation,
    });
  });

  return Object.freeze(
    profiles.sort((a, b) => Number(b.suitability01) - Number(a.suitability01)),
  );
}

function chooseDominantIntent(
  latestIntent: ChatDialogueIntentEncodingResult,
  lexical: Readonly<Record<string, Score01>>,
  phase: ChatConversationPhase,
): ChatDialogueIntent {
  if (phase === 'NEGOTIATION' && latestIntent.intentScores.NEGOTIATE <= 0.22) {
    return 'NEGOTIATE';
  }
  if (phase === 'RESCUE' && latestIntent.intentScores.SEEK_HELP <= 0.22) {
    return 'SEEK_HELP';
  }
  if ((phase === 'ESCALATING' || phase === 'CLIMAX') && latestIntent.intentScores.TAUNT <= 0.22) {
    return lexical.escalation01 >= 0.40 ? 'TAUNT' : latestIntent.primaryIntent;
  }
  if (phase === 'POST_RUN' && latestIntent.intentScores.REFLECT <= 0.22) {
    return 'REFLECT';
  }

  return latestIntent.primaryIntent;
}

function chooseSupportingIntents(
  latestIntent: ChatDialogueIntentEncodingResult,
  dominantIntent: ChatDialogueIntent,
): readonly ChatDialogueIntent[] {
  const entries = Object.entries(latestIntent.intentScores) as [ChatDialogueIntent, Score01][];
  return Object.freeze(
    entries
      .filter(([intent]) => intent !== dominantIntent)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 4)
      .filter(([, score]) => Number(score) >= 0.18)
      .map(([intent]) => intent),
  );
}

/* ========================================================================== */
/* MARK: Encoder                                                              */
/* ========================================================================== */

export class ConversationStateEncoder implements ChatConversationStateEncoderPort {
  private readonly defaults = Object.freeze({
    ...CHAT_CONVERSATION_STATE_ENCODER_DEFAULTS,
    ...(this.options.defaults ?? {}),
  });

  private readonly embeddingClient: ChatEmbeddingClientPort;
  private readonly intentEncoder: DialogueIntentEncoder;
  private requestCounter = 0;
  private readonly requestPrefix: string;
  private totals = {
    encodes: 0,
    deterministicFallbacks: 0,
    intentEncodes: 0,
  };

  constructor(
    private readonly options: ChatConversationStateEncoderOptions = {},
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

    this.requestPrefix =
      `${CHAT_CONVERSATION_STATE_ENCODER_MODULE_NAME}:${Math.random().toString(36).slice(2, 9)}`;
  }

  public async encode(
    input: ChatConversationStateEncodingInput,
  ): Promise<ChatConversationStateEncodingResult> {
    const encodedAtMs = asUnixMs(input.now ?? Date.now());
    const requestId = input.requestId ?? this.nextRequestId();
    const activeChannel = input.activeChannel ?? input.visibleChannel ?? DEFAULT_CHANNEL;
    const source = input.source ?? 'LIVE';
    const recentMessages = this.selectMessages(input);
    const roleHistogram = buildRoleHistogram(recentMessages);
    const channelHistogram = buildChannelHistogram(recentMessages, activeChannel);
    const transcriptText = recentMessages.map((message) => extractMessageText(message)).join(' ');
    const lexical = deriveLexicalSignals(transcriptText);
    const events = deriveEventSignals(input.recentEventNames ?? []);
    const affect = deriveAffectSignals(
      input.affectSnapshot ?? null,
      input.featureSnapshot ?? null,
    );

    const cadence01 = deriveMessageCadence(recentMessages);
    const repetitionPenalty01 = deriveRepetitionPenalty(recentMessages);
    const roleDiversity01 = deriveRoleDiversity(roleHistogram);
    const channelLock01 = deriveChannelLock(channelHistogram, activeChannel);
    const semanticDensity01 = deriveSemanticDensity(recentMessages);
    const silenceWeight01 = clamp01(
      (1 - cadence01) * 0.58 +
      affect.embarrassment01 * 0.14 +
      boundedRatio(countWordHits(transcriptText, ['...', 'hm', 'wait', 'hold on', 'uh']), 6) * 0.12,
    );

    const rescueNeed01 = clamp01(
      deriveBridgeRescueNeed(input.bridgeSnapshot ?? null, input.featureSnapshot ?? null) * 0.54 +
      lexical.rescue01 * 0.18 +
      affect.frustration01 * 0.12 +
      affect.embarrassment01 * 0.10 +
      silenceWeight01 * 0.06,
    );

    const haterBait01 = clamp01(
      deriveBridgeHaterBait(input.bridgeSnapshot ?? null, input.featureSnapshot ?? null) * 0.46 +
      lexical.escalation01 * 0.18 +
      affect.confidence01 * 0.10 +
      boundedRatio(countWordHits(transcriptText, ['you', 'coward', 'weak', 'try me', 'come on']), 8) * 0.12 +
      (activeChannel === 'GLOBAL' ? 0.08 : 0),
    );

    const crowdHeat01 = clamp01(
      deriveCrowdHeat(input.featureSnapshot ?? null) * 0.52 +
      lexical.escalation01 * 0.10 +
      lexical.comeback01 * 0.08 +
      affect.confidence01 * 0.06 +
      (activeChannel === 'GLOBAL' ? 0.12 : 0),
    );

    const negotiationPressure01 = clamp01(
      lexical.negotiation01 * 0.46 +
      events.negotiation01 * 0.16 +
      (activeChannel === 'DEAL_ROOM' ? 0.18 : 0) +
      silenceWeight01 * 0.08 +
      channelLock01 * 0.06,
    );

    const recoveryWindow01 = clamp01(
      lexical.comeback01 * 0.28 +
      affect.relief01 * 0.16 +
      rescueNeed01 * 0.18 +
      (1 - affect.frustration01) * 0.10 +
      events.comeback01 * 0.16,
    );

    const volatility01 = clamp01(
      lexical.escalation01 * 0.18 +
      affect.frustration01 * 0.16 +
      affect.embarrassment01 * 0.10 +
      crowdHeat01 * 0.12 +
      (1 - channelLock01) * 0.12 +
      cadence01 * 0.10 +
      repetitionPenalty01 * 0.10 +
      events.collapse01 * 0.12,
    );

    const coherence01 = clamp01(
      this.defaults.coherenceFloor +
      semanticDensity01 * 0.20 +
      channelLock01 * this.defaults.channelStabilityWeight +
      roleDiversity01 * this.defaults.roleDiversityWeight +
      cadence01 * this.defaults.messageCadenceWeight +
      (1 - volatility01) * 0.18 +
      (1 - repetitionPenalty01) * (this.defaults.repetitionPenaltyWeight as number),
    );

    const phaseSignals = derivePhaseSignals(
      lexical,
      events,
      affect,
      rescueNeed01,
      haterBait01,
      crowdHeat01,
      cadence01,
      silenceWeight01,
    );

    const phase = selectConversationPhase(phaseSignals, input.forcePhase);
    const secondaryPhases = secondaryPhasesFromSignals(
      phaseSignals,
      phase,
      this.defaults.maxSecondaryPhases,
    );

    const intentInput = this.createIntentInput(requestId, input, recentMessages, activeChannel);
    const latestIntent =
      input.currentIntent ??
      await this.intentEncoder.encode(intentInput);

    if (!input.currentIntent) {
      this.totals.intentEncodes += 1;
    }

    const dominantIntent = chooseDominantIntent(latestIntent, lexical, phase);
    const supportingIntents = chooseSupportingIntents(latestIntent, dominantIntent);
    const climax01 = clamp01(
      phaseSignals.CLIMAX * 0.54 +
      crowdHeat01 * 0.10 +
      haterBait01 * 0.12 +
      recoveryWindow01 * 0.10 +
      lexical.comeback01 * 0.14,
    );

    const postRunWeight01 = clamp01(
      phaseSignals.POST_RUN * 0.72 +
      lexical.postRun01 * 0.14 +
      events.postRun01 * 0.14,
    );

    const scores: ChatConversationStateScores = Object.freeze({
      coherence01,
      volatility01,
      silenceWeight01,
      rescueNeed01,
      haterBait01,
      negotiationPressure01,
      crowdHeat01,
      embarrassment01: affect.embarrassment01,
      confidence01: affect.confidence01,
      frustration01: affect.frustration01,
      recoveryWindow01,
      climax01,
      postRunWeight01,
      channelLock01,
      roleDiversity01,
      semanticDensity01,
      repetitionPenalty01,
    });

    const tags = deriveStateTags(
      phase,
      scores,
      activeChannel,
      input.recentEventNames ?? [],
      input.forceTags,
    );

    const stateSummary = buildStateSummarySentence(
      phase,
      deriveTemperature(climax01, crowdHeat01, rescueNeed01, lexical.escalation01),
      activeChannel,
      scores,
      dominantIntent,
      tags,
    );

    const transcriptSummary = buildTranscriptSummary(
      recentMessages,
      this.defaults.maxSummaryChars,
    );

    const semanticVectorRecord = await this.embedState(
      requestId,
      input,
      phase,
      tags,
      `${stateSummary} || ${transcriptSummary}`,
    );

    const channels = buildChannelProfiles(activeChannel, scores, phase);
    const temperature = deriveTemperature(
      climax01,
      crowdHeat01,
      rescueNeed01,
      lexical.escalation01,
    );
    const pressureTier = derivePressureTier(
      rescueNeed01,
      lexical.escalation01,
      silenceWeight01,
      negotiationPressure01,
    );

    const breakdown: ChatConversationStateBreakdown = Object.freeze({
      lexicalSignals: Object.freeze({
        negotiation01: lexical.negotiation01,
        rescue01: lexical.rescue01,
        escalation01: lexical.escalation01,
        comeback01: lexical.comeback01,
        postRun01: lexical.postRun01,
        embarrassment01: lexical.embarrassment01,
        confidence01: lexical.confidence01,
      }),
      roleSignals: Object.freeze(
        Object.fromEntries(
          Object.entries(roleHistogram).map(([key, value]) => [key, clamp01(value / Math.max(1, recentMessages.length))]),
        ),
      ),
      channelSignals: Object.freeze(
        Object.fromEntries(
          Object.entries(channelHistogram).map(([key, value]) => [key, clamp01(value / Math.max(1, recentMessages.length))]),
        ),
      ),
      affectSignals: Object.freeze(affect),
      eventSignals: events,
      phaseSignals: phaseSignals,
      topReasons: Object.freeze(this.buildTopReasons(
        phase,
        scores,
        channels,
        dominantIntent,
        tags,
      )),
    });

    const result: ChatConversationStateEncodingResult = Object.freeze({
      requestId,
      encodedAtMs,
      source,
      activeChannel,
      phase,
      secondaryPhases,
      temperature,
      pressureTier,
      messageCount: recentMessages.length,
      roleCount: Object.keys(roleHistogram).length,
      dominantIntent,
      supportingIntents,
      tags,
      scores,
      channels,
      stateSummary,
      transcriptSummary,
      semanticVector: semanticVectorRecord.vector,
      semanticVectorRecord,
      latestIntent,
      breakdown,
      diagnostics: Object.freeze({
        recentEventNames: Object.freeze([...(input.recentEventNames ?? [])]),
        roleHistogram,
        channelHistogram,
        lexicalSummary: truncateText(transcriptText, this.defaults.textPreviewChars),
        modeId: input.currentModeId,
        runId: input.runId,
        roomId: input.roomId,
        metadata: input.metadata,
      }),
    });

    this.totals.encodes += 1;
    this.emitTelemetry('chat_conversation_state_encoded', {
      requestId,
      phase,
      dominantIntent,
      activeChannel,
      temperature,
      pressureTier,
      tags: [...tags],
      summary: stateSummary,
      messageCount: recentMessages.length,
    });

    return result;
  }

  public compare(
    lhs: ChatConversationStateEncodingResult,
    rhs: ChatConversationStateEncodingResult,
  ): Readonly<{
    similarity01: Score01;
    phaseAgreement01: Score01;
    channelAgreement01: Score01;
    temperatureAgreement01: Score01;
  }> {
    const similarity01 = compareEmbeddingVectors(
      lhs.semanticVector,
      rhs.semanticVector,
    ).similarity01;

    const phaseAgreement01 =
      lhs.phase === rhs.phase
        ? (1 as Score01)
        : lhs.secondaryPhases.includes(rhs.phase) || rhs.secondaryPhases.includes(lhs.phase)
          ? (0.66 as Score01)
          : (0 as Score01);

    const channelAgreement01 =
      lhs.activeChannel === rhs.activeChannel
        ? (1 as Score01)
        : lhs.channels[0]?.channel === rhs.channels[0]?.channel
          ? (0.60 as Score01)
          : (0 as Score01);

    const temperatureAgreement01 =
      lhs.temperature === rhs.temperature
        ? (1 as Score01)
        : (lhs.temperature === 'HOT' && rhs.temperature === 'CRITICAL') ||
          (lhs.temperature === 'CRITICAL' && rhs.temperature === 'HOT') ||
          (lhs.temperature === 'WARM' && rhs.temperature === 'HOT') ||
          (lhs.temperature === 'HOT' && rhs.temperature === 'WARM')
          ? (0.60 as Score01)
          : (0 as Score01);

    return Object.freeze({
      similarity01,
      phaseAgreement01,
      channelAgreement01,
      temperatureAgreement01,
    });
  }

  public getPublicSnapshot(): Readonly<{
    moduleName: string;
    moduleVersion: string;
    totals: Readonly<{
      encodes: number;
      deterministicFallbacks: number;
      intentEncodes: number;
    }>;
  }> {
    return Object.freeze({
      moduleName: CHAT_CONVERSATION_STATE_ENCODER_MODULE_NAME,
      moduleVersion: CHAT_CONVERSATION_STATE_ENCODER_VERSION,
      totals: Object.freeze({
        encodes: this.totals.encodes,
        deterministicFallbacks: this.totals.deterministicFallbacks,
        intentEncodes: this.totals.intentEncodes,
      }),
    });
  }

  private selectMessages(
    input: ChatConversationStateEncodingInput,
  ): readonly ChatMessage[] {
    const messages =
      input.recentMessages ??
      input.messages ??
      [];

    return Object.freeze(messages.slice(-this.defaults.maxRecentMessages));
  }

  private createIntentInput(
    requestId: string,
    input: ChatConversationStateEncodingInput,
    recentMessages: readonly ChatMessage[],
    activeChannel: ChatVisibleChannel,
  ): ChatDialogueIntentEncodingInput {
    const latest = recentMessages[recentMessages.length - 1];
    const text = latest ? extractMessageText(latest) : buildTranscriptSummary(recentMessages, 480);

    return Object.freeze({
      requestId: `${requestId}:intent`,
      text,
      activeChannel,
      recentMessages: recentMessages.slice(-this.defaults.intentWindowMessages),
      featureSnapshot: input.featureSnapshot ?? null,
      learningProfile: input.learningProfile ?? null,
      bridgeSnapshot: input.bridgeSnapshot ?? null,
      recentEventNames: input.recentEventNames ?? [],
      currentModeId: input.currentModeId,
      metadata: input.metadata,
    } as any);
  }

  private async embedState(
    requestId: string,
    input: ChatConversationStateEncodingInput,
    phase: ChatConversationPhase,
    tags: readonly ChatConversationStateTag[],
    summary: string,
  ): Promise<ChatEmbeddingVectorRecord> {
    const embeddingInput = buildStateEmbeddingInput(summary, input, phase, tags);

    try {
      return await this.embeddingClient.embed(embeddingInput);
    } catch (error) {
      this.totals.deterministicFallbacks += 1;
      const vector = buildDeterministicMessageEmbedding(
        embeddingInput,
        this.defaults.vectorDimensions,
      );

      return Object.freeze({
        requestId: `${requestId}:state:fallback`,
        cacheKey: `fallback:${summary.length}:${phase}:${input.activeChannel ?? DEFAULT_CHANNEL}`,
        source: 'LOCAL_DETERMINISTIC',
        model: 'pzo-conversation-state-local',
        purpose: 'STATE',
        dimensions: vector.length,
        vector,
        magnitude: 1,
        normalized: true,
        createdAtMs: asUnixMs(Date.now()),
        durationMs: 0,
        previewText: truncateText(summary, this.defaults.textPreviewChars),
        contextSummary: truncateText(summary, 320),
        diagnostics: Object.freeze({
          fallbackReason: error instanceof Error ? error.message : 'Unknown embedding failure',
          phase,
          tags,
        }),
      });
    }
  }

  private buildTopReasons(
    phase: ChatConversationPhase,
    scores: ChatConversationStateScores,
    channels: readonly ChatConversationStateChannelProfile[],
    dominantIntent: ChatDialogueIntent,
    tags: readonly ChatConversationStateTag[],
  ): readonly string[] {
    const reasons = [
      `Phase resolved to ${phase}.`,
      `Dominant intent resolved to ${dominantIntent}.`,
      `Top channel fit is ${channels[0]?.channel ?? 'GLOBAL'} at ${stableRound(channels[0]?.suitability01 ?? 0, 3)}.`,
      `Rescue need is ${stableRound(scores.rescueNeed01, 3)} and hater bait is ${stableRound(scores.haterBait01, 3)}.`,
      `Silence weight is ${stableRound(scores.silenceWeight01, 3)} and crowd heat is ${stableRound(scores.crowdHeat01, 3)}.`,
      `Tags: ${tags.slice(0, 6).join(', ') || 'NONE'}.`,
    ];

    return Object.freeze(reasons);
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

export function createConversationStateEncoder(
  options: ChatConversationStateEncoderOptions = {},
): ConversationStateEncoder {
  return new ConversationStateEncoder(options);
}

export function createConversationStateInput(
  input: ChatConversationStateEncodingInput,
): ChatConversationStateEncodingInput {
  return Object.freeze({ ...input });
}

export function deriveConversationPhaseLexically(
  text: string,
): Readonly<Record<ChatConversationPhase, Score01>> {
  const lexical = deriveLexicalSignals(text);
  return derivePhaseSignals(
    lexical,
    deriveEventSignals([]),
    deriveAffectSignals(null, null),
    0 as Score01,
    lexical.escalation01,
    0 as Score01,
    0.5 as Score01,
    0.2 as Score01,
  );
}

export async function encodeConversationStateWithDeterministicEmbedding(
  input: ChatConversationStateEncodingInput,
  options: Partial<ChatConversationStateEncoderOptions> = {},
): Promise<ChatConversationStateEncodingResult> {
  const encoder = createConversationStateEncoder({
    ...options,
    embeddingClient: {
      embed: async (embeddingInput: ChatEmbeddingInput): Promise<ChatEmbeddingVectorRecord> => {
        const vector = buildDeterministicMessageEmbedding(
          embeddingInput,
          CHAT_CONVERSATION_STATE_ENCODER_DEFAULTS.vectorDimensions,
        );

        return Object.freeze({
          requestId: input.requestId ?? 'deterministic-conversation-state',
          cacheKey: `deterministic:${(embeddingInput.text ?? '').length}`,
          source: 'LOCAL_DETERMINISTIC',
          model: 'deterministic-conversation-state-local',
          purpose: 'STATE',
          dimensions: vector.length,
          vector,
          magnitude: 1,
          normalized: true,
          createdAtMs: asUnixMs(Date.now()),
          durationMs: 0,
          previewText: truncateText(embeddingInput.text ?? '', 140),
          contextSummary: truncateText(embeddingInput.text ?? '', 220),
          diagnostics: Object.freeze({ path: 'deterministic-helper' }),
        });
      },
      embedBatch: async (): Promise<any> => {
        throw new Error('embedBatch is not implemented in deterministic helper.');
      },
      similarity: compareEmbeddingVectors,
      getPublicSnapshot: (): any => Object.freeze({
        moduleName: 'deterministic-conversation-state-client',
        moduleVersion: '1',
        model: 'deterministic-conversation-state-local',
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
    },
  });

  return encoder.encode(input);
}

/* ========================================================================== */
/* MARK: Manifest                                                             */
/* ========================================================================== */

export const CHAT_CONVERSATION_STATE_ENCODER_MANIFEST = Object.freeze({
  moduleName: CHAT_CONVERSATION_STATE_ENCODER_MODULE_NAME,
  version: CHAT_CONVERSATION_STATE_ENCODER_VERSION,
  defaults: CHAT_CONVERSATION_STATE_ENCODER_DEFAULTS,
  runtimeLaws: CHAT_CONVERSATION_STATE_ENCODER_RUNTIME_LAWS,
  capabilities: Object.freeze({
    transcriptSummarization: true,
    phaseEncoding: true,
    channelFitProfiles: true,
    semanticStateVectors: true,
    deterministicFallback: true,
    intentAware: true,
    rescueAware: true,
    escalationAware: true,
    silenceAware: true,
  }),
} as const);

export const ChatConversationState = Object.freeze({
  ConversationStateEncoder,
  createConversationStateEncoder,
  createConversationStateInput,
  deriveConversationPhaseLexically,
  encodeConversationStateWithDeterministicEmbedding,
  manifest: CHAT_CONVERSATION_STATE_ENCODER_MANIFEST,
} as const);

export type ChatConversationStateEncoderManifest =
  typeof CHAT_CONVERSATION_STATE_ENCODER_MANIFEST;
