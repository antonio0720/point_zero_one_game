/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT MESSAGE EMBEDDING CLIENT
 * FILE: backend/src/game/engine/chat/dl/MessageEmbeddingClient.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Backend-authoritative deterministic / hybrid embedding surface for chat text,
 * chat scenes, channel state, and short transcript windows.
 *
 * Why this file exists in backend chat
 * -----------------------------------
 * Point Zero One chat is not a generic social SDK. Its transcript is part of:
 * - social pressure,
 * - helper intervention timing,
 * - hater escalation,
 * - deal-room psychology,
 * - proof / replay context,
 * - and learning-state persistence.
 *
 * That means the backend needs a durable, explainable embedding surface that
 * can:
 * 1. encode accepted transcript truth,
 * 2. preserve channel / room / pressure / mode semantics,
 * 3. remain deterministic enough for replay audit,
 * 4. support fast similarity for retrieval / ranking / memory anchors,
 * 5. and avoid turning frontend-local guesses into final authority.
 *
 * This file therefore does not:
 * - mutate transcript truth,
 * - decide moderation law,
 * - decide helper / hater final outputs,
 * - or bypass backend orchestration.
 *
 * It does:
 * - encode accepted messages and transcript windows,
 * - enrich them with backend context tokens,
 * - pool multi-signal semantic vectors,
 * - produce retrieval-safe fingerprints,
 * - and emit explanation surfaces useful for proof, telemetry, and replay.
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  clamp100,
  type ChatMessageId,
  type ChatRoomId,
  type ChatRoomKind,
  type ChatSessionId,
  type ChatSignalEnvelope,
  type ChatUserId,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type PressureTier,
  type Score01,
  type Score100,
  type UnixMs,
} from '../types';
import {
  DEFAULT_BACKEND_CHAT_RUNTIME,
  mergeRuntimeConfig,
} from '../ChatRuntimeConfig';

// ============================================================================
// MARK: Module constants
// ============================================================================

export const CHAT_MESSAGE_EMBEDDING_CLIENT_MODULE_NAME =
  'PZO_BACKEND_CHAT_MESSAGE_EMBEDDING_CLIENT' as const;

export const CHAT_MESSAGE_EMBEDDING_CLIENT_VERSION =
  '2026.03.14-message-embedding-client.v1' as const;

export const CHAT_MESSAGE_EMBEDDING_RUNTIME_LAWS = Object.freeze([
  'Embeddings are produced from accepted backend truth, not raw client hope.',
  'Channel, room, mode, pressure, and source semantics alter representation.',
  'Deal-room language is not encoded the same way as global-stage language.',
  'Silence, timing, and structured system notices can meaningfully affect scene embeddings.',
  'The encoder must stay deterministic enough for replay audit and proof traces.',
  'The backend can enrich the vector with scene-state tokens unavailable to the client.',
  'Embeddings are advisory to ranking / retrieval / memory, never transcript authority.',
  'The explanation surface must reveal which semantic families dominated the vector.',
] as const);

export const CHAT_MESSAGE_EMBEDDING_DEFAULTS = Object.freeze({
  dimensions: 192,
  charGramMin: 3,
  charGramMax: 5,
  tokenHashPrimeA: 31,
  tokenHashPrimeB: 131,
  tokenHashPrimeC: 1319,
  tokenHashPrimeD: 8191,
  tokenWeightBase01: 0.08,
  punctuationWeight01: 0.03,
  emphasisBonus01: 0.05,
  repeatedTokenPenalty01: 0.18,
  noveltyBoost01: 0.08,
  contextBlend01: 0.22,
  sceneBlend01: 0.18,
  channelBlend01: 0.12,
  pressureBlend01: 0.08,
  signalBlend01: 0.14,
  timeDecayHalfLifeMs: 75_000,
  maxTranscriptMessages: 32,
  maxSegments: 12,
  sparseContributionFloor01: 0.025,
  dominantContributionCount: 16,
  normalizeVector: true,
  cacheCapacity: 4_096,
  minTokenLength: 1,
  maxTokenLength: 48,
  maxCharacters: 2_500,
  maxBatchSize: 512,
  semanticFamilyWeight01: 0.14,
  sentimentFamilyWeight01: 0.10,
  channelBiasGlobal01: 0.04,
  channelBiasSyndicate01: 0.06,
  channelBiasDealRoom01: 0.10,
  channelBiasLobby01: 0.03,
  roomBiasBattle01: 0.06,
  roomBiasDealRoom01: 0.10,
  roomBiasSyndicate01: 0.06,
  roomBiasLobby01: 0.02,
  pressureBiasHigh01: 0.04,
  pressureBiasMax01: 0.07,
  timeUrgencyWeight01: 0.08,
  sequencePositionWeight01: 0.05,
  similarityClipFloor01: -1,
  similarityClipCeiling01: 1,
  transcriptPoolingDecayFloor01: 0.20,
} as const);

// ============================================================================
// MARK: Domain lexicons
// ============================================================================

const CHAT_EMBEDDING_ATTACK_TOKENS = Object.freeze([
  'attack', 'attacking', 'pressure', 'pressuring', 'crush', 'break', 'destroy',
  'kill', 'wipe', 'ruin', 'bleed', 'expose', 'cook', 'rip', 'smoke', 'fragile',
  'weak', 'soft', 'loser', 'collapse', 'bankrupt', 'poor', 'trash', 'clown',
  'fraud', 'fake', 'easy', 'finished', 'dead', 'ended', 'delete', 'bury',
  'dominate', 'outplay', 'punish', 'humiliate', 'shatter', 'crack', 'submit',
] as const);

const CHAT_EMBEDDING_DEFENSE_TOKENS = Object.freeze([
  'hold', 'stabilize', 'steady', 'recover', 'recovering', 'reset', 'shield',
  'guard', 'protect', 'restore', 'repair', 'save', 'survive', 'breathe',
  'calm', 'patient', 'disciplined', 'focus', 'rebuild', 'compose', 'balance',
  'recoverable', 'not over', 'resist', 'counter', 'answer', 'pivot', 'settle',
] as const);

const CHAT_EMBEDDING_HELPER_TOKENS = Object.freeze([
  'help', 'assist', 'advice', 'listen', 'breathe', 'slow', 'guide', 'step',
  'option', 'path', 'recover', 'safe', 'reset', 'learn', 'coach', 'clarify',
  'support', 'save', 'protect', 'stabilize', 'calm', 'trust', 'follow',
  'consider', 'recommended', 'suggest', 'window', 'exit', 'hold', 'wait',
] as const);

const CHAT_EMBEDDING_NEGOTIATION_TOKENS = Object.freeze([
  'offer', 'deal', 'counter', 'price', 'value', 'cost', 'buy', 'sell', 'trade',
  'bluff', 'bid', 'ask', 'spread', 'margin', 'terms', 'agreement', 'urgent',
  'patience', 'overpay', 'discount', 'premium', 'inventory', 'liquidity',
  'position', 'concession', 'walk', 'close', 'counteroffer', 'accept', 'decline',
] as const);

const CHAT_EMBEDDING_CROWD_TOKENS = Object.freeze([
  'everyone', 'crowd', 'chat', 'watching', 'seen', 'global', 'stage', 'public',
  'laughing', 'cheering', 'booing', 'swarm', 'heat', 'room', 'spectators',
  'all eyes', 'witness', 'moment', 'legend', 'embarrassing', 'publicly',
  'broadcast', 'visible', 'trend', 'viral', 'status', 'reputation',
] as const);

const CHAT_EMBEDDING_SOVEREIGNTY_TOKENS = Object.freeze([
  'sovereignty', 'ascend', 'dominion', 'control', 'mastery', 'ownership',
  'inevitable', 'command', 'authority', 'crown', 'reign', 'king', 'rule',
  'signal', 'fifth', 'proof', 'apex', 'victory', 'arrival', 'destiny', 'claim',
] as const);

const CHAT_EMBEDDING_DISTRESS_TOKENS = Object.freeze([
  'panic', 'scared', 'afraid', 'fear', 'help', 'please', 'stuck', 'lost',
  'rage', 'quit', 'done', 'cannot', 'cant', 'frustrated', 'embarrassed',
  'overwhelmed', 'failing', 'losing', 'broke', 'bankrupt', 'shaken', 'collapse',
  'spiral', 'no idea', 'confused', 'i quit', 'unfair', 'broken',
] as const);

const CHAT_EMBEDDING_SYSTEM_TOKENS = Object.freeze([
  'system', 'notice', 'alert', 'warning', 'event', 'tick', 'pressure', 'shield',
  'invasion', 'collapse', 'surge', 'breach', 'sovereignty', 'economy', 'room',
  'presence', 'typing', 'read', 'replay', 'proof', 'telemetry', 'signal',
] as const);

const CHAT_EMBEDDING_POSITIVE_TOKENS = Object.freeze([
  'good', 'great', 'strong', 'smart', 'clean', 'solid', 'excellent', 'win',
  'winning', 'better', 'best', 'love', 'respect', 'trust', 'impressive',
  'legend', 'clutch', 'massive', 'beautiful', 'precise', 'disciplined',
  'calculated', 'surgical', 'elite', 'nice', 'valid', 'credible',
] as const);

const CHAT_EMBEDDING_NEGATIVE_TOKENS = Object.freeze([
  'bad', 'terrible', 'awful', 'trash', 'weak', 'soft', 'fraud', 'fake', 'panic',
  'coward', 'embarrassing', 'clown', 'pathetic', 'ugly', 'broke', 'dead',
  'stupid', 'useless', 'horrible', 'chaos', 'mess', 'garbage', 'lame',
] as const);

const CHAT_EMBEDDING_QUESTION_TOKENS = Object.freeze([
  'what', 'why', 'how', 'when', 'where', 'who', 'which', 'can', 'could',
  'would', 'should', 'do', 'does', 'did', 'is', 'are', 'am', 'explain',
  'clarify', 'meaning', 'question', 'unknown', 'wonder', 'maybe',
] as const);

const CHAT_EMBEDDING_CALL_TO_ACTION_TOKENS = Object.freeze([
  'now', 'move', 'go', 'answer', 'decide', 'pick', 'choose', 'commit', 'send',
  'buy', 'sell', 'hold', 'wait', 'block', 'mute', 'speak', 'stop', 'start',
  'join', 'leave', 'watch', 'counter', 'save', 'protect', 'route', 'switch',
] as const);

const CHAT_EMBEDDING_EMBARRASSMENT_TOKENS = Object.freeze([
  'embarrassing', 'everyone saw', 'all saw', 'public', 'laughed', 'mocked',
  'ridicule', 'shame', 'cringe', 'exposed', 'caught', 'seen', 'witnessed',
  'humiliated', 'silent', 'look at you', 'global', 'on stage',
] as const);

// ============================================================================
// MARK: Ports and options
// ============================================================================

export interface MessageEmbeddingClientLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface MessageEmbeddingClientClockPort {
  now(): UnixMs;
}

export interface MessageEmbeddingClientOptions {
  readonly logger?: MessageEmbeddingClientLoggerPort;
  readonly clock?: MessageEmbeddingClientClockPort;
  readonly defaults?: Partial<typeof CHAT_MESSAGE_EMBEDDING_DEFAULTS>;
}

export type EmbeddingSourceKind =
  | 'PLAYER'
  | 'HELPER'
  | 'HATER'
  | 'SYSTEM'
  | 'AMBIENT'
  | 'UNKNOWN';

export type EmbeddingInputKind =
  | 'MESSAGE'
  | 'TRANSCRIPT_WINDOW'
  | 'SCENE'
  | 'SUMMARY'
  | 'SYSTEM_EVENT';

export type EmbeddingSemanticFamily =
  | 'ATTACK'
  | 'DEFENSE'
  | 'HELPER'
  | 'NEGOTIATION'
  | 'CROWD'
  | 'SOVEREIGNTY'
  | 'DISTRESS'
  | 'SYSTEM'
  | 'POSITIVE'
  | 'NEGATIVE'
  | 'QUESTION'
  | 'CALL_TO_ACTION'
  | 'EMBARRASSMENT'
  | 'UNKNOWN';

export interface EmbeddingSceneContext {
  readonly roomId?: Nullable<ChatRoomId>;
  readonly sessionId?: Nullable<ChatSessionId>;
  readonly userId?: Nullable<ChatUserId>;
  readonly channel?: Nullable<ChatVisibleChannel>;
  readonly roomKind?: Nullable<ChatRoomKind>;
  readonly modeId?: Nullable<string>;
  readonly pressureTier?: Nullable<PressureTier>;
  readonly tickTier?: Nullable<string>;
  readonly sourceKind?: Nullable<EmbeddingSourceKind>;
  readonly messageId?: Nullable<ChatMessageId>;
  readonly createdAtMs?: Nullable<UnixMs>;
  readonly sequenceIndex?: Nullable<number>;
  readonly sequenceLength?: Nullable<number>;
  readonly sceneRole?: Nullable<string>;
  readonly isSystemNotice?: Nullable<boolean>;
  readonly isReply?: Nullable<boolean>;
  readonly isShadow?: Nullable<boolean>;
  readonly witnessCount?: Nullable<number>;
  readonly heat01?: Nullable<number>;
  readonly signalEnvelope?: Nullable<ChatSignalEnvelope>;
  readonly tags?: ReadonlyArray<string>;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface EmbeddingMessageInput {
  readonly inputKind?: Nullable<EmbeddingInputKind>;
  readonly messageId?: Nullable<ChatMessageId>;
  readonly text: string;
  readonly createdAtMs?: Nullable<UnixMs>;
  readonly sourceKind?: Nullable<EmbeddingSourceKind>;
  readonly channel?: Nullable<ChatVisibleChannel>;
  readonly roomKind?: Nullable<ChatRoomKind>;
  readonly pressureTier?: Nullable<PressureTier>;
  readonly modeId?: Nullable<string>;
  readonly speakerId?: Nullable<string>;
  readonly botId?: Nullable<string>;
  readonly signalEnvelope?: Nullable<ChatSignalEnvelope>;
  readonly tags?: ReadonlyArray<string>;
  readonly sceneContext?: Nullable<EmbeddingSceneContext>;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface TranscriptWindowInput {
  readonly inputKind?: Nullable<EmbeddingInputKind>;
  readonly windowId?: Nullable<string>;
  readonly label?: Nullable<string>;
  readonly messages: ReadonlyArray<EmbeddingMessageInput>;
  readonly sceneContext?: Nullable<EmbeddingSceneContext>;
  readonly signalEnvelope?: Nullable<ChatSignalEnvelope>;
  readonly anchorCreatedAtMs?: Nullable<UnixMs>;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface EmbeddingContribution {
  readonly family: EmbeddingSemanticFamily;
  readonly token: string;
  readonly weight01: Score01;
  readonly dimension: number;
  readonly signedWeight: number;
}

export interface EmbeddingExplanation {
  readonly dominantFamilies: ReadonlyArray<EmbeddingSemanticFamily>;
  readonly dominantTokens: ReadonlyArray<string>;
  readonly contributions: ReadonlyArray<EmbeddingContribution>;
  readonly channelBias: number;
  readonly roomBias: number;
  readonly pressureBias: number;
  readonly timeDecay01: Score01;
  readonly novelty01: Score01;
}

export interface EmbeddingVector {
  readonly version: string;
  readonly dimensions: number;
  readonly vector: ReadonlyArray<number>;
  readonly norm01: Score01;
  readonly magnitude100: Score100;
  readonly sparseDensity01: Score01;
  readonly fingerprint: string;
  readonly inputKind: EmbeddingInputKind;
  readonly sourceKind: EmbeddingSourceKind;
  readonly channel?: Nullable<ChatVisibleChannel>;
  readonly roomKind?: Nullable<ChatRoomKind>;
  readonly pressureTier?: Nullable<PressureTier>;
  readonly modeId?: Nullable<string>;
  readonly createdAtMs?: Nullable<UnixMs>;
  readonly explanation: EmbeddingExplanation;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface EmbeddingBatchResult {
  readonly vectors: ReadonlyArray<EmbeddingVector>;
  readonly truncatedCount: number;
  readonly droppedCount: number;
}

export interface SimilarityResult {
  readonly cosine: number;
  readonly dot: number;
  readonly overlap01: Score01;
  readonly clipped01: Score01;
}

export interface NearestNeighborCandidate<TMeta extends JsonValue = JsonValue> {
  readonly id: string;
  readonly embedding: EmbeddingVector;
  readonly metadata?: TMeta;
}

export interface NearestNeighborMatch<TMeta extends JsonValue = JsonValue> {
  readonly id: string;
  readonly similarity: SimilarityResult;
  readonly embedding: EmbeddingVector;
  readonly metadata?: TMeta;
}

// ============================================================================
// MARK: Internal structures
// ============================================================================

interface NormalizedToken {
  readonly raw: string;
  readonly normalized: string;
  readonly position: number;
  readonly family: EmbeddingSemanticFamily;
  readonly emphasis01: Score01;
  readonly repeatPenalty01: Score01;
  readonly novelty01: Score01;
}

interface MutableEmbeddingState {
  readonly values: Float64Array;
  dominantFamilies: Set<EmbeddingSemanticFamily>;
  dominantTokens: Set<string>;
  contributions: EmbeddingContribution[];
}

interface CacheEntry {
  readonly key: string;
  readonly value: EmbeddingVector;
  touchedAtMs: UnixMs;
}

// ============================================================================
// MARK: Utility functions
// ============================================================================

function createNoopLogger(): MessageEmbeddingClientLoggerPort {
  return {
    debug: () => void 0,
    info: () => void 0,
    warn: () => void 0,
    error: () => void 0,
  };
}

function createSystemClock(): MessageEmbeddingClientClockPort {
  return {
    now: () => asUnixMs(Date.now()),
  };
}

function stringOrEmpty(value: Nullable<string> | undefined): string {
  return typeof value === 'string' ? value : '';
}

function booleanToNumber(value: Nullable<boolean> | undefined): number {
  return value ? 1 : 0;
}

function numberOr(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function lower(value: string): string {
  return value.toLocaleLowerCase();
}

function safeSliceText(value: string, maxCharacters: number): string {
  if (value.length <= maxCharacters) {
    return value;
  }
  return value.slice(0, maxCharacters);
}

function hashString(input: string, salt: number): number {
  let hash = salt | 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
    hash |= 0;
  }
  return hash >>> 0;
}

function uniquePush(target: string[], seen: Set<string>, value: string): void {
  if (!value || seen.has(value)) {
    return;
  }
  seen.add(value);
  target.push(value);
}

function clipSimilarity(
  value: number,
  floor: number,
  ceiling: number,
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(floor, Math.min(ceiling, value));
}

function inferSemanticFamily(token: string): EmbeddingSemanticFamily {
  const normalized = lower(token);
  if (CHAT_EMBEDDING_ATTACK_TOKENS.includes(normalized as never)) return 'ATTACK';
  if (CHAT_EMBEDDING_DEFENSE_TOKENS.includes(normalized as never)) return 'DEFENSE';
  if (CHAT_EMBEDDING_HELPER_TOKENS.includes(normalized as never)) return 'HELPER';
  if (CHAT_EMBEDDING_NEGOTIATION_TOKENS.includes(normalized as never)) return 'NEGOTIATION';
  if (CHAT_EMBEDDING_CROWD_TOKENS.includes(normalized as never)) return 'CROWD';
  if (CHAT_EMBEDDING_SOVEREIGNTY_TOKENS.includes(normalized as never)) return 'SOVEREIGNTY';
  if (CHAT_EMBEDDING_DISTRESS_TOKENS.includes(normalized as never)) return 'DISTRESS';
  if (CHAT_EMBEDDING_SYSTEM_TOKENS.includes(normalized as never)) return 'SYSTEM';
  if (CHAT_EMBEDDING_POSITIVE_TOKENS.includes(normalized as never)) return 'POSITIVE';
  if (CHAT_EMBEDDING_NEGATIVE_TOKENS.includes(normalized as never)) return 'NEGATIVE';
  if (CHAT_EMBEDDING_QUESTION_TOKENS.includes(normalized as never)) return 'QUESTION';
  if (CHAT_EMBEDDING_CALL_TO_ACTION_TOKENS.includes(normalized as never)) return 'CALL_TO_ACTION';
  if (CHAT_EMBEDDING_EMBARRASSMENT_TOKENS.includes(normalized as never)) return 'EMBARRASSMENT';
  return 'UNKNOWN';
}

function pressureBiasValue(
  pressureTier: Nullable<PressureTier> | undefined,
  defaults: typeof CHAT_MESSAGE_EMBEDDING_DEFAULTS,
): number {
  switch (pressureTier) {
    case 'HIGH':
      return defaults.pressureBiasHigh01;
    case 'CRITICAL':
      return defaults.pressureBiasMax01;
    default:
      return 0;
  }
}

function channelBiasValue(
  channel: Nullable<ChatVisibleChannel> | undefined,
  defaults: typeof CHAT_MESSAGE_EMBEDDING_DEFAULTS,
): number {
  switch (channel) {
    case 'GLOBAL':
      return defaults.channelBiasGlobal01;
    case 'SYNDICATE':
      return defaults.channelBiasSyndicate01;
    case 'DEAL_ROOM':
      return defaults.channelBiasDealRoom01;
    case 'LOBBY':
      return defaults.channelBiasLobby01;
    default:
      return 0;
  }
}

function roomBiasValue(
  roomKind: Nullable<ChatRoomKind> | undefined,
  defaults: typeof CHAT_MESSAGE_EMBEDDING_DEFAULTS,
): number {
  switch (roomKind as string) {
    case 'BATTLE':
      return defaults.roomBiasBattle01;
    case 'DEAL_ROOM':
      return defaults.roomBiasDealRoom01;
    case 'SYNDICATE':
      return defaults.roomBiasSyndicate01;
    case 'LOBBY':
      return defaults.roomBiasLobby01;
    case 'GLOBAL':
      return defaults.channelBiasGlobal01;
    default:
      return 0;
  }
}

function buildVectorFingerprint(values: ReadonlyArray<number>): string {
  const rounded = values.map((value) => value.toFixed(6)).join('|');
  const hashA = hashString(rounded, 17).toString(16);
  const hashB = hashString(rounded, 131).toString(16);
  return `${hashA}${hashB}`;
}

// ============================================================================
// MARK: MessageEmbeddingClient
// ============================================================================

export class MessageEmbeddingClient {
  private readonly logger: MessageEmbeddingClientLoggerPort;
  private readonly clock: MessageEmbeddingClientClockPort;
  private readonly defaults: typeof CHAT_MESSAGE_EMBEDDING_DEFAULTS;
  private readonly runtime = mergeRuntimeConfig(DEFAULT_BACKEND_CHAT_RUNTIME, {});
  private readonly cache = new Map<string, CacheEntry>();

  public constructor(options: MessageEmbeddingClientOptions = {}) {
    this.logger = options.logger ?? createNoopLogger();
    this.clock = options.clock ?? createSystemClock();
    this.defaults = Object.freeze({
      ...CHAT_MESSAGE_EMBEDDING_DEFAULTS,
      ...(options.defaults ?? {}),
    });
  }

  // ==========================================================================
  // MARK: Public API
  // ==========================================================================

  public embedMessage(input: EmbeddingMessageInput): EmbeddingVector {
    const cacheKey = this.createMessageCacheKey(input);
    const cached = this.getCache(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const text = safeSliceText(stringOrEmpty(input.text), this.defaults.maxCharacters);
    const normalizedTokens = this.normalizeTokens(text);
    const state = this.createMutableState();
    const now = this.clock.now();

    const context = this.resolveSceneContextFromMessage(input);
    const contextTokens = this.buildContextTokens(context, input.signalEnvelope);
    const charGrams = this.buildCharacterGrams(text);
    const timeDecay01 = this.computeTimeDecay01(input.createdAtMs ?? context.createdAtMs ?? now, now);

    for (const token of normalizedTokens) {
      this.applyTokenContribution(state, token, context, timeDecay01);
    }

    for (const gram of charGrams) {
      this.applyCharGramContribution(state, gram, context, timeDecay01);
    }

    for (const token of contextTokens) {
      this.applyContextTokenContribution(state, token, context);
    }

    this.applySignalEnvelopeContribution(state, input.signalEnvelope, context);
    this.applySceneFieldContribution(state, context);

    const vector = this.finalizeVector({
      inputKind: input.inputKind ?? 'MESSAGE',
      sourceKind: input.sourceKind ?? context.sourceKind ?? 'UNKNOWN',
      channel: input.channel ?? context.channel ?? null,
      roomKind: input.roomKind ?? context.roomKind ?? null,
      pressureTier: input.pressureTier ?? context.pressureTier ?? null,
      modeId: input.modeId ?? context.modeId ?? null,
      createdAtMs: input.createdAtMs ?? context.createdAtMs ?? null,
      state,
      timeDecay01,
      context,
      metadata: input.metadata,
    });

    this.setCache(cacheKey, vector);
    return vector;
  }

  public embedTranscriptWindow(input: TranscriptWindowInput): EmbeddingVector {
    const messages = input.messages.slice(0, this.defaults.maxTranscriptMessages);
    const context = input.sceneContext ?? null;
    const now = this.clock.now();

    if (messages.length === 0) {
      return this.embedMessage({
        inputKind: input.inputKind ?? 'TRANSCRIPT_WINDOW',
        text: '',
        createdAtMs: input.anchorCreatedAtMs ?? now,
        sceneContext: context,
        signalEnvelope: input.signalEnvelope,
        sourceKind: context?.sourceKind ?? 'UNKNOWN',
        metadata: input.metadata,
      });
    }

    const vectors = messages.map((message, index) =>
      this.embedMessage({
        ...message,
        sceneContext: {
          ...(message.sceneContext ?? {}),
          ...(context ?? {}),
          sequenceIndex: index,
          sequenceLength: messages.length,
        },
      }),
    );

    const pooled = new Float64Array(this.defaults.dimensions);
    const createdAtMs = input.anchorCreatedAtMs ?? messages[messages.length - 1]?.createdAtMs ?? now;

    for (let index = 0; index < vectors.length; index += 1) {
      const vector = vectors[index];
      const recency01 = this.computeTimeDecay01(vector.createdAtMs ?? createdAtMs, createdAtMs);
      const position01 = clamp01((index + 1) / Math.max(1, vectors.length));
      const weight = Math.max(
        this.defaults.transcriptPoolingDecayFloor01,
        recency01 * (0.65 + position01 * this.defaults.sequencePositionWeight01),
      );
      for (let dimension = 0; dimension < pooled.length; dimension += 1) {
        pooled[dimension] += vector.vector[dimension]! * weight;
      }
    }

    const state = this.createMutableState();
    for (let dimension = 0; dimension < pooled.length; dimension += 1) {
      state.values[dimension] = pooled[dimension]!;
    }

    const dominantFamilySet = new Set<EmbeddingSemanticFamily>();
    const dominantTokenSet = new Set<string>();
    const contributions: EmbeddingContribution[] = [];

    for (const vector of vectors) {
      for (const family of vector.explanation.dominantFamilies) {
        dominantFamilySet.add(family);
      }
      for (const token of vector.explanation.dominantTokens) {
        dominantTokenSet.add(token);
      }
      for (const contribution of vector.explanation.contributions.slice(0, 4)) {
        contributions.push(contribution);
      }
    }

    state.dominantFamilies = dominantFamilySet;
    state.dominantTokens = dominantTokenSet;
    state.contributions = contributions
      .sort((left, right) => Math.abs(right.signedWeight) - Math.abs(left.signedWeight))
      .slice(0, this.defaults.dominantContributionCount);

    return this.finalizeVector({
      inputKind: input.inputKind ?? 'TRANSCRIPT_WINDOW',
      sourceKind: context?.sourceKind ?? messages[messages.length - 1]?.sourceKind ?? 'UNKNOWN',
      channel: context?.channel ?? messages[messages.length - 1]?.channel ?? null,
      roomKind: context?.roomKind ?? messages[messages.length - 1]?.roomKind ?? null,
      pressureTier: context?.pressureTier ?? messages[messages.length - 1]?.pressureTier ?? null,
      modeId: context?.modeId ?? messages[messages.length - 1]?.modeId ?? null,
      createdAtMs,
      state,
      timeDecay01: this.computeTimeDecay01(createdAtMs, now),
      context,
      metadata: input.metadata,
    });
  }

  public embedBatch(inputs: ReadonlyArray<EmbeddingMessageInput>): EmbeddingBatchResult {
    const safeInputs = inputs.slice(0, this.defaults.maxBatchSize);
    const vectors: EmbeddingVector[] = [];

    for (const input of safeInputs) {
      vectors.push(this.embedMessage(input));
    }

    return {
      vectors,
      truncatedCount: Math.max(0, inputs.length - safeInputs.length),
      droppedCount: 0,
    };
  }

  public cosineSimilarity(left: EmbeddingVector, right: EmbeddingVector): SimilarityResult {
    const dot = this.dotProduct(left.vector, right.vector);
    const denom = Math.sqrt(this.dotProduct(left.vector, left.vector) * this.dotProduct(right.vector, right.vector));
    const cosine = denom > 0 ? dot / denom : 0;
    const overlap01 = clamp01((cosine + 1) / 2);
    return {
      dot,
      cosine,
      overlap01,
      clipped01: clamp01((clipSimilarity(
        cosine,
        this.defaults.similarityClipFloor01,
        this.defaults.similarityClipCeiling01,
      ) + 1) / 2),
    };
  }

  public centroid(vectors: ReadonlyArray<EmbeddingVector>): EmbeddingVector {
    if (vectors.length === 0) {
      return this.embedMessage({ text: '' });
    }

    const pooled = new Float64Array(this.defaults.dimensions);
    for (const vector of vectors) {
      for (let index = 0; index < pooled.length; index += 1) {
        pooled[index] += vector.vector[index]!;
      }
    }
    for (let index = 0; index < pooled.length; index += 1) {
      pooled[index] /= vectors.length;
    }

    const state = this.createMutableState();
    for (let index = 0; index < pooled.length; index += 1) {
      state.values[index] = pooled[index]!;
    }

    const families = new Set<EmbeddingSemanticFamily>();
    const tokens = new Set<string>();
    const contributions: EmbeddingContribution[] = [];

    for (const vector of vectors) {
      vector.explanation.dominantFamilies.forEach((family) => families.add(family));
      vector.explanation.dominantTokens.forEach((token) => tokens.add(token));
      contributions.push(...vector.explanation.contributions.slice(0, 3));
    }

    state.dominantFamilies = families;
    state.dominantTokens = tokens;
    state.contributions = contributions
      .sort((left, right) => Math.abs(right.signedWeight) - Math.abs(left.signedWeight))
      .slice(0, this.defaults.dominantContributionCount);

    return this.finalizeVector({
      inputKind: 'SUMMARY',
      sourceKind: vectors[0]?.sourceKind ?? 'UNKNOWN',
      channel: vectors[0]?.channel ?? null,
      roomKind: vectors[0]?.roomKind ?? null,
      pressureTier: vectors[0]?.pressureTier ?? null,
      modeId: vectors[0]?.modeId ?? null,
      createdAtMs: vectors[vectors.length - 1]?.createdAtMs ?? this.clock.now(),
      state,
      timeDecay01: clamp01(0.92),
      context: null,
      metadata: undefined,
    });
  }

  public nearestNeighbors<TMeta extends JsonValue = JsonValue>(
    probe: EmbeddingVector,
    candidates: ReadonlyArray<NearestNeighborCandidate<TMeta>>,
    limit = 8,
  ): ReadonlyArray<NearestNeighborMatch<TMeta>> {
    return candidates
      .map((candidate) => ({
        id: candidate.id,
        similarity: this.cosineSimilarity(probe, candidate.embedding),
        embedding: candidate.embedding,
        metadata: candidate.metadata,
      }))
      .sort((left, right) => right.similarity.cosine - left.similarity.cosine)
      .slice(0, Math.max(1, limit));
  }

  public exportCacheSnapshot(): ReadonlyArray<Readonly<Record<string, JsonValue>>> {
    const rows: Array<Readonly<Record<string, JsonValue>>> = [];
    for (const entry of this.cache.values()) {
      rows.push(
        Object.freeze({
          key: entry.key,
          touchedAtMs: entry.touchedAtMs,
          fingerprint: entry.value.fingerprint,
          sourceKind: entry.value.sourceKind,
          inputKind: entry.value.inputKind,
          channel: entry.value.channel ?? null,
          roomKind: entry.value.roomKind ?? null,
          pressureTier: entry.value.pressureTier ?? null,
          dimensions: entry.value.dimensions,
        }),
      );
    }
    return rows;
  }

  // ==========================================================================
  // MARK: Core embedding pipeline
  // ==========================================================================

  private createMessageCacheKey(input: EmbeddingMessageInput): string {
    const context = this.resolveSceneContextFromMessage(input);
    const seed = [
      input.messageId ?? '',
      input.text,
      input.createdAtMs ?? '',
      input.sourceKind ?? context.sourceKind ?? '',
      input.channel ?? context.channel ?? '',
      input.roomKind ?? context.roomKind ?? '',
      input.pressureTier ?? context.pressureTier ?? '',
      input.modeId ?? context.modeId ?? '',
      JSON.stringify(input.tags ?? []),
      JSON.stringify(input.signalEnvelope ?? {}),
      JSON.stringify(input.metadata ?? {}),
    ].join('|');
    return buildVectorFingerprint([hashString(seed, 17), hashString(seed, 131), hashString(seed, 991)]);
  }

  private resolveSceneContextFromMessage(
    input: EmbeddingMessageInput,
  ): EmbeddingSceneContext {
    return {
      ...(input.sceneContext ?? {}),
      sourceKind: input.sourceKind ?? input.sceneContext?.sourceKind ?? 'UNKNOWN',
      channel: input.channel ?? input.sceneContext?.channel ?? null,
      roomKind: input.roomKind ?? input.sceneContext?.roomKind ?? null,
      pressureTier: input.pressureTier ?? input.sceneContext?.pressureTier ?? null,
      modeId: input.modeId ?? input.sceneContext?.modeId ?? null,
      createdAtMs: input.createdAtMs ?? input.sceneContext?.createdAtMs ?? null,
      messageId: input.messageId ?? input.sceneContext?.messageId ?? null,
      signalEnvelope: input.signalEnvelope ?? input.sceneContext?.signalEnvelope ?? null,
    };
  }

  private normalizeTokens(text: string): ReadonlyArray<NormalizedToken> {
    const prepared = safeSliceText(text, this.defaults.maxCharacters)
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\s+/g, ' ')
      .trim();

    if (prepared.length === 0) {
      return [];
    }

    const rawTokens = prepared
      .split(/[\s/|\\]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0);

    const counts = new Map<string, number>();
    for (const raw of rawTokens) {
      const normalized = lower(raw.replace(/[^a-zA-Z0-9_!?$:%.-]/g, ''));
      if (!normalized) continue;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }

    const seen = new Set<string>();
    const normalizedTokens: NormalizedToken[] = [];

    for (let index = 0; index < rawTokens.length; index += 1) {
      const raw = rawTokens[index]!;
      const normalized = lower(raw.replace(/[^a-zA-Z0-9_!?$:%.-]/g, '')).slice(
        0,
        this.defaults.maxTokenLength,
      );
      if (normalized.length < this.defaults.minTokenLength) {
        continue;
      }

      const family = inferSemanticFamily(normalized);
      const exclamations = (raw.match(/!/g) ?? []).length;
      const questions = (raw.match(/\?/g) ?? []).length;
      const caps = raw.replace(/[^A-Z]/g, '').length;
      const emphasis01 = clamp01(
        exclamations * 0.2 +
          questions * 0.08 +
          Math.min(1, caps / Math.max(1, raw.length)),
      );

      const repeatCount = counts.get(normalized) ?? 1;
      const repeatPenalty01 = clamp01((repeatCount - 1) * this.defaults.repeatedTokenPenalty01 * 0.18);
      const novelty01 = clamp01(seen.has(normalized) ? 0.12 : 1);
      seen.add(normalized);

      normalizedTokens.push({
        raw,
        normalized,
        position: index,
        family,
        emphasis01,
        repeatPenalty01,
        novelty01,
      });
    }

    return normalizedTokens;
  }

  private buildCharacterGrams(text: string): ReadonlyArray<string> {
    const prepared = safeSliceText(lower(text), this.defaults.maxCharacters)
      .replace(/[^a-z0-9!?$:%._ -]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (prepared.length === 0) {
      return [];
    }

    const grams: string[] = [];
    const seen = new Set<string>();

    for (let size = this.defaults.charGramMin; size <= this.defaults.charGramMax; size += 1) {
      for (let index = 0; index <= prepared.length - size; index += 1) {
        const gram = prepared.slice(index, index + size);
        if (gram.trim().length === 0) {
          continue;
        }
        uniquePush(grams, seen, gram);
      }
    }

    return grams.slice(0, 256);
  }

  private buildContextTokens(
    context: Nullable<EmbeddingSceneContext>,
    signalEnvelope: Nullable<ChatSignalEnvelope> | undefined,
  ): ReadonlyArray<string> {
    const tokens: string[] = [];
    const seen = new Set<string>();

    if (context?.channel) uniquePush(tokens, seen, `channel:${lower(context.channel)}`);
    if (context?.roomKind) uniquePush(tokens, seen, `room:${lower(context.roomKind)}`);
    if (context?.pressureTier) uniquePush(tokens, seen, `pressure:${lower(context.pressureTier)}`);
    if (context?.modeId) uniquePush(tokens, seen, `mode:${lower(context.modeId)}`);
    if (context?.sourceKind) uniquePush(tokens, seen, `source:${lower(context.sourceKind)}`);
    if (context?.sceneRole) uniquePush(tokens, seen, `scene:${lower(context.sceneRole)}`);
    if (context?.isSystemNotice) uniquePush(tokens, seen, 'flag:system_notice');
    if (context?.isReply) uniquePush(tokens, seen, 'flag:reply');
    if (context?.isShadow) uniquePush(tokens, seen, 'flag:shadow');
    if ((context?.witnessCount ?? 0) > 0) uniquePush(tokens, seen, 'flag:witnessed');

    const heat01 = numberOr(context?.heat01 ?? null, 0);
    if (heat01 >= 0.8) uniquePush(tokens, seen, 'heat:overheat');
    else if (heat01 >= 0.55) uniquePush(tokens, seen, 'heat:hot');
    else if (heat01 >= 0.25) uniquePush(tokens, seen, 'heat:warm');
    else uniquePush(tokens, seen, 'heat:cold');

    if (signalEnvelope && typeof signalEnvelope === 'object') {
      const kind = stringOrEmpty(((signalEnvelope as unknown) as Record<string, unknown>).kind as Nullable<string>);
      const type = stringOrEmpty(((signalEnvelope as unknown) as Record<string, unknown>).type as Nullable<string>);
      const event = stringOrEmpty(((signalEnvelope as unknown) as Record<string, unknown>).event as Nullable<string>);
      if (kind) uniquePush(tokens, seen, `signal_kind:${lower(kind)}`);
      if (type) uniquePush(tokens, seen, `signal_type:${lower(type)}`);
      if (event) uniquePush(tokens, seen, `signal_event:${lower(event)}`);
    }

    return tokens;
  }

  private createMutableState(): MutableEmbeddingState {
    return {
      values: new Float64Array(this.defaults.dimensions),
      dominantFamilies: new Set<EmbeddingSemanticFamily>(),
      dominantTokens: new Set<string>(),
      contributions: [],
    };
  }

  private computeTimeDecay01(createdAtMs: Nullable<UnixMs> | undefined, now: UnixMs): Score01 {
    if (!createdAtMs) {
      return clamp01(1);
    }
    const ageMs = Math.max(0, now - createdAtMs);
    const decay = Math.pow(0.5, ageMs / this.defaults.timeDecayHalfLifeMs);
    return clamp01(decay);
  }

  private applyTokenContribution(
    state: MutableEmbeddingState,
    token: NormalizedToken,
    context: Nullable<EmbeddingSceneContext>,
    timeDecay01: Score01,
  ): void {
    const familyHash = hashString(token.family, this.defaults.tokenHashPrimeB);
    const tokenHash = hashString(token.normalized, this.defaults.tokenHashPrimeA);
    const dimension = (tokenHash ^ familyHash) % this.defaults.dimensions;
    const signed = this.signedHashWeight(token.normalized, token.family);
    const semanticWeight = this.semanticFamilyWeight(token.family);
    const contextWeight =
      1 +
      channelBiasValue(context?.channel, this.defaults) +
      roomBiasValue(context?.roomKind, this.defaults) +
      pressureBiasValue(context?.pressureTier, this.defaults);

    const weight =
      this.defaults.tokenWeightBase01 *
      (1 + semanticWeight + token.emphasis01 * this.defaults.emphasisBonus01) *
      (1 - token.repeatPenalty01 * this.defaults.repeatedTokenPenalty01) *
      (1 + token.novelty01 * this.defaults.noveltyBoost01) *
      timeDecay01 *
      contextWeight;

    state.values[dimension] += signed * weight;
    state.dominantFamilies.add(token.family);
    state.dominantTokens.add(token.normalized);

    if (Math.abs(weight) >= this.defaults.sparseContributionFloor01) {
      state.contributions.push({
        family: token.family,
        token: token.normalized,
        weight01: clamp01(Math.abs(weight)),
        dimension,
        signedWeight: signed * weight,
      });
    }
  }

  private applyCharGramContribution(
    state: MutableEmbeddingState,
    gram: string,
    context: Nullable<EmbeddingSceneContext>,
    timeDecay01: Score01,
  ): void {
    const dimension = hashString(gram, this.defaults.tokenHashPrimeC) % this.defaults.dimensions;
    const signed = this.signedHashWeight(gram, 'UNKNOWN');
    const weight =
      this.defaults.tokenWeightBase01 *
      0.28 *
      timeDecay01 *
      (1 + channelBiasValue(context?.channel, this.defaults) * 0.5);

    state.values[dimension] += signed * weight;
  }

  private applyContextTokenContribution(
    state: MutableEmbeddingState,
    token: string,
    context: Nullable<EmbeddingSceneContext>,
  ): void {
    const dimension = hashString(token, this.defaults.tokenHashPrimeD) % this.defaults.dimensions;
    const signed = this.signedHashWeight(token, 'SYSTEM');
    const weight =
      this.defaults.contextBlend01 *
      (1 +
        channelBiasValue(context?.channel, this.defaults) +
        roomBiasValue(context?.roomKind, this.defaults) +
        pressureBiasValue(context?.pressureTier, this.defaults));

    state.values[dimension] += signed * weight;
    if (token.startsWith('signal_') || token.startsWith('channel:') || token.startsWith('room:')) {
      state.dominantFamilies.add('SYSTEM');
      state.dominantTokens.add(token);
      state.contributions.push({
        family: 'SYSTEM',
        token,
        weight01: clamp01(Math.abs(weight)),
        dimension,
        signedWeight: signed * weight,
      });
    }
  }

  private applySignalEnvelopeContribution(
    state: MutableEmbeddingState,
    signalEnvelope: Nullable<ChatSignalEnvelope> | undefined,
    context: Nullable<EmbeddingSceneContext>,
  ): void {
    if (!signalEnvelope || typeof signalEnvelope !== 'object') {
      return;
    }

    const entries = Object.entries((signalEnvelope as unknown) as Record<string, unknown>).slice(0, 24);
    for (const [key, value] of entries) {
      const descriptor = `${key}:${typeof value === 'string' ? lower(value) : String(value)}`;
      const dimension = hashString(descriptor, this.defaults.tokenHashPrimeA ^ this.defaults.tokenHashPrimeD) %
        this.defaults.dimensions;
      const signed = this.signedHashWeight(descriptor, 'SYSTEM');
      const weight =
        this.defaults.signalBlend01 *
        (1 + pressureBiasValue(context?.pressureTier, this.defaults)) *
        (typeof value === 'number' ? Math.min(1.4, Math.abs(value) / 10) : 1);

      state.values[dimension] += signed * weight;
      if (key.includes('pressure') || key.includes('shield') || key.includes('invasion')) {
        state.dominantFamilies.add('SYSTEM');
        state.dominantTokens.add(key);
      }
    }
  }

  private applySceneFieldContribution(
    state: MutableEmbeddingState,
    context: Nullable<EmbeddingSceneContext>,
  ): void {
    if (!context) {
      return;
    }

    const witnessCount = numberOr(context.witnessCount ?? null, 0);
    if (witnessCount > 0) {
      const dimension = hashString(`witness:${witnessCount}`, 211) % this.defaults.dimensions;
      const weight = this.defaults.sceneBlend01 * Math.min(1.2, witnessCount / 6);
      state.values[dimension] += weight;
      state.dominantFamilies.add('CROWD');
      state.dominantTokens.add('witness');
    }

    const heat01 = numberOr(context.heat01 ?? null, 0);
    if (heat01 > 0) {
      const dimension = hashString(`heat:${heat01.toFixed(2)}`, 977) % this.defaults.dimensions;
      const signed = heat01 >= 0.5 ? 1 : -1;
      const weight = this.defaults.sceneBlend01 * heat01;
      state.values[dimension] += signed * weight;
      state.dominantFamilies.add('CROWD');
      state.dominantTokens.add('heat');
    }
  }

  private finalizeVector(input: {
    readonly inputKind: EmbeddingInputKind;
    readonly sourceKind: EmbeddingSourceKind;
    readonly channel?: Nullable<ChatVisibleChannel>;
    readonly roomKind?: Nullable<ChatRoomKind>;
    readonly pressureTier?: Nullable<PressureTier>;
    readonly modeId?: Nullable<string>;
    readonly createdAtMs?: Nullable<UnixMs>;
    readonly state: MutableEmbeddingState;
    readonly timeDecay01: Score01;
    readonly context: Nullable<EmbeddingSceneContext>;
    readonly metadata?: Readonly<Record<string, JsonValue>>;
  }): EmbeddingVector {
    const { state } = input;
    const values = Array.from(state.values);
    const norm = Math.sqrt(this.dotProduct(values, values));
    const normalizedValues =
      this.defaults.normalizeVector && norm > 0
        ? values.map((value) => value / norm)
        : values;

    const channelBias = channelBiasValue(input.channel, this.defaults);
    const roomBias = roomBiasValue(input.roomKind, this.defaults);
    const pressureBias = pressureBiasValue(input.pressureTier, this.defaults);

    const contributions = state.contributions
      .sort((left, right) => Math.abs(right.signedWeight) - Math.abs(left.signedWeight))
      .slice(0, this.defaults.dominantContributionCount);

    const dominantFamilies = Array.from(state.dominantFamilies).slice(0, 8);
    const dominantTokens = Array.from(state.dominantTokens).slice(0, 16);

    const nonZeroCount = normalizedValues.reduce(
      (count, value) => count + (Math.abs(value) > 0.0000001 ? 1 : 0),
      0,
    );
    const sparseDensity01 = clamp01(nonZeroCount / Math.max(1, normalizedValues.length));

    return Object.freeze({
      version: CHAT_MESSAGE_EMBEDDING_CLIENT_VERSION,
      dimensions: normalizedValues.length,
      vector: Object.freeze(normalizedValues),
      norm01: clamp01(norm > 1 ? 1 : norm),
      magnitude100: clamp100(norm * 100),
      sparseDensity01,
      fingerprint: buildVectorFingerprint(normalizedValues),
      inputKind: input.inputKind,
      sourceKind: input.sourceKind,
      channel: input.channel ?? null,
      roomKind: input.roomKind ?? null,
      pressureTier: input.pressureTier ?? null,
      modeId: input.modeId ?? null,
      createdAtMs: input.createdAtMs ?? null,
      explanation: Object.freeze({
        dominantFamilies: Object.freeze(dominantFamilies),
        dominantTokens: Object.freeze(dominantTokens),
        contributions: Object.freeze(contributions),
        channelBias,
        roomBias,
        pressureBias,
        timeDecay01: input.timeDecay01,
        novelty01: this.estimateNovelty01(dominantTokens),
      }),
      metadata: input.metadata,
    });
  }

  // ==========================================================================
  // MARK: Cache
  // ==========================================================================

  private getCache(key: string): EmbeddingVector | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    entry.touchedAtMs = this.clock.now();
    return entry.value;
  }

  private setCache(key: string, value: EmbeddingVector): void {
    this.cache.set(key, {
      key,
      value,
      touchedAtMs: this.clock.now(),
    });
    this.enforceCacheCapacity();
  }

  private enforceCacheCapacity(): void {
    if (this.cache.size <= this.defaults.cacheCapacity) {
      return;
    }

    const entries = Array.from(this.cache.values()).sort(
      (left, right) => left.touchedAtMs - right.touchedAtMs,
    );
    const overage = this.cache.size - this.defaults.cacheCapacity;
    for (let index = 0; index < overage; index += 1) {
      this.cache.delete(entries[index]!.key);
    }
  }

  // ==========================================================================
  // MARK: Math helpers
  // ==========================================================================

  private semanticFamilyWeight(family: EmbeddingSemanticFamily): number {
    switch (family) {
      case 'ATTACK':
      case 'DEFENSE':
      case 'HELPER':
      case 'NEGOTIATION':
      case 'CROWD':
      case 'SOVEREIGNTY':
      case 'DISTRESS':
      case 'SYSTEM':
        return this.defaults.semanticFamilyWeight01;
      case 'POSITIVE':
      case 'NEGATIVE':
      case 'QUESTION':
      case 'CALL_TO_ACTION':
      case 'EMBARRASSMENT':
        return this.defaults.sentimentFamilyWeight01;
      default:
        return 0;
    }
  }

  private signedHashWeight(token: string, family: EmbeddingSemanticFamily): number {
    const seed = hashString(`${family}:${token}`, 73);
    return seed % 2 === 0 ? 1 : -1;
  }

  private dotProduct(left: ReadonlyArray<number>, right: ReadonlyArray<number>): number {
    const length = Math.min(left.length, right.length);
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += (left[index] ?? 0) * (right[index] ?? 0);
    }
    return sum;
  }

  private estimateNovelty01(tokens: ReadonlyArray<string>): Score01 {
    if (tokens.length === 0) {
      return clamp01(0);
    }

    const noveltySignals = tokens.reduce((sum, token) => {
      const family = inferSemanticFamily(token);
      if (family === 'UNKNOWN') return sum + 1;
      return sum + 0.65;
    }, 0);

    return clamp01(noveltySignals / tokens.length);
  }
}

// ============================================================================
// MARK: Convenience helpers
// ============================================================================

export function createMessageEmbeddingClient(
  options: MessageEmbeddingClientOptions = {},
): MessageEmbeddingClient {
  return new MessageEmbeddingClient(options);
}

export function embedAuthoritativeChatMessage(
  client: MessageEmbeddingClient,
  input: EmbeddingMessageInput,
): EmbeddingVector {
  return client.embedMessage(input);
}

export function embedAuthoritativeTranscriptWindow(
  client: MessageEmbeddingClient,
  input: TranscriptWindowInput,
): EmbeddingVector {
  return client.embedTranscriptWindow(input);
}

export function computeEmbeddingSimilarity(
  client: MessageEmbeddingClient,
  left: EmbeddingVector,
  right: EmbeddingVector,
): SimilarityResult {
  return client.cosineSimilarity(left, right);
}

// ============================================================================
// MARK: Export surface
// ============================================================================

export default MessageEmbeddingClient;
