/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT DIALOGUE INTENT ENCODER
 * FILE: backend/src/game/engine/chat/dl/DialogueIntentEncoder.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Backend-authoritative encoder that turns accepted chat truth into structured
 * intent surfaces for response ranking, helper timing, hater escalation,
 * negotiation reading, memory anchoring, and scene-state continuity.
 *
 * This is not a UI classifier.
 * This is not a transport parser.
 * This is not transcript authority.
 *
 * This file exists because Point Zero One chat is not merely “text.”
 * A message may simultaneously be:
 * - a bluff,
 * - a taunt,
 * - a cry for help,
 * - a public performance,
 * - a concealed retreat,
 * - a counterpunch,
 * - an invitation,
 * - a bait line,
 * - or a sovereignty signal.
 *
 * The encoder therefore has to read:
 * - lexical surface,
 * - embedding shape,
 * - scene context,
 * - pressure regime,
 * - channel semantics,
 * - crowd witness value,
 * - sequence position,
 * - recency of surrounding turns,
 * - and simple dialogue memory.
 *
 * The outcome is a structured, explainable intent package that downstream
 * systems can consume without turning this encoder into final policy or truth.
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
import {
  CHAT_MESSAGE_EMBEDDING_CLIENT_VERSION,
  type EmbeddingInputKind,
  type EmbeddingMessageInput,
  type EmbeddingSceneContext,
  type EmbeddingSemanticFamily,
  type EmbeddingVector,
  type SimilarityResult,
  MessageEmbeddingClient,
  createMessageEmbeddingClient,
} from './MessageEmbeddingClient';

// ============================================================================
// MARK: Module constants
// ============================================================================

export const CHAT_DIALOGUE_INTENT_ENCODER_MODULE_NAME =
  'PZO_BACKEND_CHAT_DIALOGUE_INTENT_ENCODER' as const;

export const CHAT_DIALOGUE_INTENT_ENCODER_VERSION =
  '2026.03.14-dialogue-intent-encoder.v1' as const;

export const CHAT_DIALOGUE_INTENT_RUNTIME_LAWS = Object.freeze([
  'Intent is inferred from accepted transcript truth plus backend context.',
  'One message can carry multiple simultaneous intents.',
  'Channel semantics alter interpretation, especially in deal-room and global-stage contexts.',
  'High pressure changes how silence, short replies, and directness are interpreted.',
  'The encoder recommends structure; it does not decide final helper / hater action.',
  'Sequence history matters: identical text can mean different things in different scenes.',
  'Intent packages must remain explainable enough for replay, proof, and audit.',
  'The encoder may privilege coherence over certainty when evidence is mixed.',
] as const);

export const CHAT_DIALOGUE_INTENT_DEFAULTS = Object.freeze({
  lowEvidenceFallback01: 0.18,
  dimensionsBlend01: 0.20,
  lexicalBlend01: 0.30,
  sceneBlend01: 0.18,
  sequenceBlend01: 0.18,
  pressureBlend01: 0.08,
  heatBlend01: 0.06,
  dominantIntentFloor01: 0.18,
  secondaryIntentFloor01: 0.12,
  maxTopIntents: 6,
  maxExplanationFactors: 16,
  maxMemoryTurns: 8,
  aggressionBiasGlobal01: 0.06,
  intimacyBiasSyndicate01: 0.08,
  predationBiasDealRoom01: 0.12,
  loosenessBiasLobby01: 0.04,
  distressBiasHighPressure01: 0.10,
  spectacleBiasWitnessed01: 0.09,
  tacticalSilenceBiasDealRoom01: 0.12,
  helperAppealBiasQuestion01: 0.08,
  bluffBiasCounterLanguage01: 0.10,
  dominanceBiasSovereignty01: 0.10,
  sequenceEchoWeight01: 0.15,
  contradictionPenalty01: 0.12,
  confidenceThreshold01: 0.55,
  uncertaintyThreshold01: 0.42,
  aggressionThreshold01: 0.58,
  helperNeedThreshold01: 0.56,
  negotiationThreshold01: 0.48,
  publicPerformanceThreshold01: 0.54,
  similarityMemoryThreshold01: 0.72,
  coldReadFloor01: 0.22,
} as const);

// ============================================================================
// MARK: Intent taxonomy
// ============================================================================

export type DialogueIntentKind =
  | 'ATTACK'
  | 'TAUNT'
  | 'BLUFF'
  | 'NEGOTIATE'
  | 'COUNTER'
  | 'DEFEND'
  | 'WITHDRAW'
  | 'CALL_FOR_HELP'
  | 'ASK_FOR_CLARITY'
  | 'TEACH'
  | 'GUIDE'
  | 'REASSURE'
  | 'CELEBRATE'
  | 'WITNESS'
  | 'PUBLIC_PERFORMANCE'
  | 'STATUS_SIGNAL'
  | 'SOVEREIGNTY_SIGNAL'
  | 'INTIMIDATE'
  | 'EMBARRASS'
  | 'PROBE'
  | 'STALL'
  | 'COMMIT'
  | 'INVITE'
  | 'BOND'
  | 'WARN'
  | 'SYSTEM_SIGNAL'
  | 'UNKNOWN';

export type DialogueToneBand =
  | 'COLD'
  | 'STEADY'
  | 'WARM'
  | 'HOT'
  | 'VOLATILE'
  | 'UNKNOWN';

export type DialogueRiskBand =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export type DialogueSocialPosture =
  | 'PRIVATE'
  | 'PUBLIC'
  | 'THEATRICAL'
  | 'TACTICAL'
  | 'PREDATORY'
  | 'SUPPORTIVE'
  | 'UNKNOWN';

const INTENT_ATTACK_LEXICON = Object.freeze([
  'attack', 'break', 'destroy', 'crush', 'smoke', 'delete', 'finished',
  'dead', 'bury', 'wipe', 'ruin', 'collapse', 'soft', 'weak', 'fragile',
  'punish', 'humiliate', 'cook', 'rip', 'bleed',
] as const);

const INTENT_TAUNT_LEXICON = Object.freeze([
  'clown', 'trash', 'fraud', 'easy', 'look at you', 'pathetic', 'lmao',
  'lol', 'embarrassing', 'public', 'everyone saw', 'soft', 'fake', 'weak',
] as const);

const INTENT_BLUFF_LEXICON = Object.freeze([
  'final offer', 'best price', 'last chance', 'i can walk', 'i dont need',
  'i do not need', 'take it or leave it', 'plenty', 'other buyers', 'other sellers',
  'not urgent', 'i can wait', 'small position', 'minor risk', 'fine either way',
] as const);

const INTENT_NEGOTIATION_LEXICON = Object.freeze([
  'offer', 'counter', 'price', 'cost', 'deal', 'terms', 'spread', 'value',
  'discount', 'premium', 'bid', 'ask', 'counteroffer', 'accept', 'decline',
  'liquidity', 'position', 'inventory', 'concession', 'close',
] as const);

const INTENT_HELP_LEXICON = Object.freeze([
  'help', 'please', 'stuck', 'what do i do', 'how do i', 'lost', 'confused',
  'need advice', 'guide me', 'can you help', 'support', 'save', 'rescue',
  'breathe', 'not sure', 'unclear', 'explain',
] as const);

const INTENT_GUIDE_LEXICON = Object.freeze([
  'do this', 'start with', 'next step', 'watch', 'take', 'hold', 'wait',
  'route', 'consider', 'follow', 'move slowly', 'reset', 'stabilize', 'breathe',
  'one step', 'option', 'path', 'window',
] as const);

const INTENT_CELEBRATE_LEXICON = Object.freeze([
  'win', 'won', 'legend', 'massive', 'clean', 'beautiful', 'clutch', 'strong',
  'huge', 'excellent', 'elite', 'incredible', 'respect', 'lets go', 'lets fucking go',
] as const);

const INTENT_PROBE_LEXICON = Object.freeze([
  'why', 'how', 'what', 'when', 'where', 'who', 'which', 'explain', 'clarify',
  'are you', 'can you', 'could you', 'would you', 'should i', 'should we',
] as const);

const INTENT_WITHDRAW_LEXICON = Object.freeze([
  'done', 'quit', 'leave', 'walk away', 'not doing this', 'forget it', 'enough',
  'im out', 'i am out', 'stop', 'mute', 'leave room', 'backing off',
] as const);

const INTENT_COMMIT_LEXICON = Object.freeze([
  'im in', 'i am in', 'do it', 'commit', 'send', 'buy', 'sell', 'hold here',
  'lets lock', 'lock it', 'yes', 'agreed', 'accepted', 'done deal',
] as const);

const INTENT_BOND_LEXICON = Object.freeze([
  'trust', 'respect', 'with you', 'together', 'we can', 'stay with me', 'ally',
  'partner', 'understand', 'i hear you', 'got you', 'im here', 'i am here',
] as const);

const INTENT_WARN_LEXICON = Object.freeze([
  'warning', 'careful', 'dont', 'do not', 'watch out', 'trap', 'danger',
  'bad idea', 'risky', 'overheat', 'collapse', 'breach', 'panic', 'dont push',
] as const);

// ============================================================================
// MARK: Ports and options
// ============================================================================

export interface DialogueIntentEncoderLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface DialogueIntentEncoderClockPort {
  now(): UnixMs;
}

export interface DialogueIntentEncoderOptions {
  readonly logger?: DialogueIntentEncoderLoggerPort;
  readonly clock?: DialogueIntentEncoderClockPort;
  readonly defaults?: Partial<typeof CHAT_DIALOGUE_INTENT_DEFAULTS>;
  readonly embeddingClient?: MessageEmbeddingClient;
}

// ============================================================================
// MARK: Public contracts
// ============================================================================

export interface DialogueIntentTurnInput {
  readonly message: EmbeddingMessageInput;
  readonly previousMessages?: ReadonlyArray<EmbeddingMessageInput>;
  readonly sceneContext?: Nullable<EmbeddingSceneContext>;
  readonly signalEnvelope?: Nullable<ChatSignalEnvelope>;
  readonly speakerProfile?: Readonly<Record<string, JsonValue>>;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface DialogueIntentSequenceInput {
  readonly sequenceId?: Nullable<string>;
  readonly turns: ReadonlyArray<EmbeddingMessageInput>;
  readonly sceneContext?: Nullable<EmbeddingSceneContext>;
  readonly signalEnvelope?: Nullable<ChatSignalEnvelope>;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface DialogueIntentScore {
  readonly kind: DialogueIntentKind;
  readonly score01: Score01;
  readonly evidence: ReadonlyArray<string>;
}

export interface DialogueIntentExplanationFactor {
  readonly label: string;
  readonly weight01: Score01;
  readonly detail: string;
}

export interface DialogueIntentSocialRead {
  readonly posture: DialogueSocialPosture;
  readonly tone: DialogueToneBand;
  readonly risk: DialogueRiskBand;
  readonly aggression01: Score01;
  readonly helperNeed01: Score01;
  readonly negotiation01: Score01;
  readonly publicPerformance01: Score01;
  readonly distress01: Score01;
  readonly confidence01: Score01;
}

export interface DialogueIntentResult {
  readonly version: string;
  readonly messageId?: Nullable<ChatMessageId>;
  readonly roomId?: Nullable<ChatRoomId>;
  readonly sessionId?: Nullable<ChatSessionId>;
  readonly userId?: Nullable<ChatUserId>;
  readonly createdAtMs?: Nullable<UnixMs>;
  readonly embeddingVersion: string;
  readonly embedding: EmbeddingVector;
  readonly primaryIntent: DialogueIntentKind;
  readonly secondaryIntents: ReadonlyArray<DialogueIntentScore>;
  readonly allIntentScores: ReadonlyArray<DialogueIntentScore>;
  readonly socialRead: DialogueIntentSocialRead;
  readonly contradiction01: Score01;
  readonly coherence01: Score01;
  readonly confidence01: Score01;
  readonly explanation: ReadonlyArray<DialogueIntentExplanationFactor>;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface DialogueIntentSequenceResult {
  readonly version: string;
  readonly sequenceId?: Nullable<string>;
  readonly turnResults: ReadonlyArray<DialogueIntentResult>;
  readonly sequenceEmbedding: EmbeddingVector;
  readonly dominantSequenceIntent: DialogueIntentKind;
  readonly aggregateSocialRead: DialogueIntentSocialRead;
  readonly explanation: ReadonlyArray<DialogueIntentExplanationFactor>;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

// ============================================================================
// MARK: Internal contracts
// ============================================================================

interface IntentAccumulator {
  readonly map: Map<DialogueIntentKind, number>;
  readonly evidence: Map<DialogueIntentKind, Set<string>>;
  readonly explanation: DialogueIntentExplanationFactor[];
}

interface SequenceMemory {
  readonly priorIntents: ReadonlyArray<DialogueIntentKind>;
  readonly repeatedTokens: ReadonlySet<string>;
  readonly pressureTier?: Nullable<PressureTier>;
  readonly channel?: Nullable<ChatVisibleChannel>;
  readonly roomKind?: Nullable<ChatRoomKind>;
  readonly witnessCount: number;
  readonly heat01: number;
}


interface RuntimeCalibration {
  readonly visibleChannels: ReadonlySet<ChatVisibleChannel>;
  readonly replayAwareMemoryTurns: number;
  readonly maxCharactersPerMessage: number;
  readonly similarityThreshold100: Score100;
  readonly crowdBias100: Score100;
  readonly negotiationBias01: Score01;
  readonly helperBias01: Score01;
  readonly replayBias01: Score01;
  readonly systemBias01: Score01;
}

interface SimilarityMemoryRead {
  readonly dominantInputKind: EmbeddingInputKind;
  readonly candidateCount: number;
  readonly bestMatchId: Nullable<ChatMessageId>;
  readonly bestSimilarity: SimilarityResult;
  readonly averageCosine01: Score01;
  readonly overlapPressure01: Score01;
  readonly similarityPressure100: Score100;
}

// ============================================================================
// MARK: Utilities
// ============================================================================

function createNoopLogger(): DialogueIntentEncoderLoggerPort {
  return {
    debug: () => void 0,
    info: () => void 0,
    warn: () => void 0,
    error: () => void 0,
  };
}

function createSystemClock(): DialogueIntentEncoderClockPort {
  return {
    now: () => asUnixMs(Date.now()),
  };
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function includesLexicon(text: string, lexicon: ReadonlyArray<string>): number {
  const normalized = normalizeText(text);
  let hits = 0;
  for (const phrase of lexicon) {
    if (normalized.includes(phrase)) {
      hits += 1;
    }
  }
  return hits;
}

function booleanToNumber(value: Nullable<boolean> | undefined): number {
  return value ? 1 : 0;
}

function pushExplanation(
  target: DialogueIntentExplanationFactor[],
  label: string,
  weight01: number,
  detail: string,
): void {
  target.push({
    label,
    weight01: clamp01(weight01),
    detail,
  });
}

function addIntentScore(
  accumulator: IntentAccumulator,
  kind: DialogueIntentKind,
  value: number,
  evidence: string,
): void {
  accumulator.map.set(kind, (accumulator.map.get(kind) ?? 0) + value);
  if (!accumulator.evidence.has(kind)) {
    accumulator.evidence.set(kind, new Set<string>());
  }
  accumulator.evidence.get(kind)!.add(evidence);
}

function riskBand(value01: number): DialogueRiskBand {
  if (value01 >= 0.82) return 'CRITICAL';
  if (value01 >= 0.60) return 'HIGH';
  if (value01 >= 0.35) return 'MEDIUM';
  return 'LOW';
}

function toneBand(
  aggression01: number,
  distress01: number,
  confidence01: number,
): DialogueToneBand {
  const volatility = aggression01 * 0.45 + distress01 * 0.45 + Math.max(0, 0.5 - confidence01) * 0.25;
  if (volatility >= 0.82) return 'VOLATILE';
  if (volatility >= 0.62) return 'HOT';
  if (confidence01 >= 0.58 && distress01 <= 0.28) return 'STEADY';
  if (confidence01 >= 0.72 && aggression01 <= 0.28) return 'WARM';
  if (confidence01 <= 0.38 && aggression01 <= 0.38) return 'COLD';
  return 'UNKNOWN';
}


function average(values: ReadonlyArray<number>): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function createEmptySimilarityResult(): SimilarityResult {
  return Object.freeze({
    cosine: 0,
    dot: 0,
    overlap01: clamp01(0),
    clipped01: clamp01(0),
  });
}

// ============================================================================
// MARK: DialogueIntentEncoder
// ============================================================================

export class DialogueIntentEncoder {
  private readonly logger: DialogueIntentEncoderLoggerPort;
  private readonly clock: DialogueIntentEncoderClockPort;
  private readonly defaults: typeof CHAT_DIALOGUE_INTENT_DEFAULTS;
  private readonly runtime: typeof DEFAULT_BACKEND_CHAT_RUNTIME;
  private readonly runtimeCalibration: RuntimeCalibration;
  private readonly embeddingClient: MessageEmbeddingClient;

  public constructor(options: DialogueIntentEncoderOptions = {}) {
    this.logger = options.logger ?? createNoopLogger();
    this.clock = options.clock ?? createSystemClock();
    this.defaults = Object.freeze({
      ...CHAT_DIALOGUE_INTENT_DEFAULTS,
      ...(options.defaults ?? {}),
    });
    this.runtime = mergeRuntimeConfig(DEFAULT_BACKEND_CHAT_RUNTIME, {});
    this.runtimeCalibration = this.calibrateRuntime(this.runtime);
    this.embeddingClient =
      options.embeddingClient ??
      createMessageEmbeddingClient({
        logger: {
          debug: (message, payload) => this.logger.debug(message, payload),
          info: (message, payload) => this.logger.info(message, payload),
          warn: (message, payload) => this.logger.warn(message, payload),
          error: (message, payload) => this.logger.error(message, payload),
        },
        clock: {
          now: () => this.clock.now(),
        },
      });
  }

  // ==========================================================================
  // MARK: Public API
  // ==========================================================================

  public encodeTurn(input: DialogueIntentTurnInput): DialogueIntentResult {
    const message = this.prepareMessageInput(input.message, input.sceneContext ?? null, input.signalEnvelope ?? null);
    const embedding = this.embeddingClient.embedMessage(message);
    const memory = this.buildSequenceMemory(input.previousMessages ?? [], message.sceneContext ?? null);
    const similarityRead = this.buildSimilarityMemoryRead(
      embedding,
      input.previousMessages ?? [],
      message.sceneContext ?? null,
    );
    const accumulator = this.createAccumulator();
    const explanation: DialogueIntentExplanationFactor[] = [];

    this.scoreLexicalFamilies(accumulator, message, explanation);
    this.scoreEmbeddingFamilies(accumulator, embedding, explanation);
    this.scoreSceneBias(accumulator, embedding, message, explanation);
    this.scoreInputKindBias(accumulator, message, explanation);
    this.scoreRuntimeBias(accumulator, embedding, message, explanation);
    this.scoreSignalEnvelope(accumulator, message.signalEnvelope ?? null, explanation);
    this.scoreSequenceEcho(accumulator, memory, message, embedding, explanation);
    this.scoreSimilarityMemory(accumulator, similarityRead, explanation);
    this.scorePressureRead(accumulator, embedding, message, explanation);
    this.scoreIntentConflicts(accumulator, message, embedding, explanation);

    const ranked = this.finalizeIntentScores(accumulator);
    const socialRead = this.buildSocialRead(ranked, embedding, message, memory, explanation);
    const contradiction01 = this.computeContradiction01(ranked);
    const coherence01 = this.computeCoherence01(ranked, contradiction01);
    const confidence01 = this.computeConfidence01(ranked, coherence01, contradiction01);

    const primaryIntent = ranked[0]?.kind ?? 'UNKNOWN';
    const secondaryIntents = ranked
      .filter((entry) => entry.kind !== primaryIntent && entry.score01 >= this.defaults.secondaryIntentFloor01)
      .slice(0, this.defaults.maxTopIntents - 1);

    const metadata = this.buildResultMetadata(
      input.metadata,
      message,
      embedding,
      memory,
      similarityRead,
      socialRead,
      primaryIntent,
      confidence01,
    );

    return Object.freeze({
      version: CHAT_DIALOGUE_INTENT_ENCODER_VERSION,
      messageId: message.messageId ?? message.sceneContext?.messageId ?? null,
      roomId: message.sceneContext?.roomId ?? null,
      sessionId: message.sceneContext?.sessionId ?? null,
      userId: message.sceneContext?.userId ?? null,
      createdAtMs: message.createdAtMs ?? message.sceneContext?.createdAtMs ?? null,
      embeddingVersion: CHAT_MESSAGE_EMBEDDING_CLIENT_VERSION,
      embedding,
      primaryIntent,
      secondaryIntents: Object.freeze(secondaryIntents),
      allIntentScores: Object.freeze(ranked),
      socialRead,
      contradiction01,
      coherence01,
      confidence01,
      explanation: Object.freeze(
        explanation
          .sort((left, right) => right.weight01 - left.weight01)
          .slice(0, this.defaults.maxExplanationFactors),
      ),
      metadata,
    });
  }

  public encodeSequence(input: DialogueIntentSequenceInput): DialogueIntentSequenceResult {
    const turns = input.turns.slice(0, this.runtimeCalibration.replayAwareMemoryTurns);
    const turnResults: DialogueIntentResult[] = [];

    for (let index = 0; index < turns.length; index += 1) {
      const turn = turns[index]!;
      const previousMessages = turns.slice(Math.max(0, index - this.runtimeCalibration.replayAwareMemoryTurns), index);
      turnResults.push(
        this.encodeTurn({
          message: turn,
          previousMessages,
          sceneContext: input.sceneContext ?? turn.sceneContext ?? null,
          signalEnvelope: input.signalEnvelope ?? turn.signalEnvelope,
          metadata: input.metadata,
        }),
      );
    }

    const sequenceEmbedding = this.embeddingClient.embedTranscriptWindow({
      windowId: input.sequenceId ?? null,
      label: input.sequenceId ?? null,
      inputKind: 'SCENE',
      messages: turns,
      sceneContext: input.sceneContext ?? null,
      signalEnvelope: input.signalEnvelope ?? null,
      metadata: input.metadata,
    });

    const intentCounts = new Map<DialogueIntentKind, number>();
    for (const result of turnResults) {
      intentCounts.set(result.primaryIntent, (intentCounts.get(result.primaryIntent) ?? 0) + 1);
    }

    const dominantSequenceIntent =
      Array.from(intentCounts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'UNKNOWN';

    const aggregateSocialRead = this.aggregateSocialReads(turnResults);
    const explanation: DialogueIntentExplanationFactor[] = [];

    pushExplanation(
      explanation,
      'sequence_turn_count',
      clamp01(turnResults.length / Math.max(1, this.runtimeCalibration.replayAwareMemoryTurns)),
      `Sequence evaluated across ${turnResults.length} turn(s).`,
    );

    pushExplanation(
      explanation,
      'dominant_sequence_intent',
      clamp01((intentCounts.get(dominantSequenceIntent) ?? 0) / Math.max(1, turnResults.length)),
      `Dominant sequence intent resolved to ${dominantSequenceIntent}.`,
    );

    pushExplanation(
      explanation,
      'sequence_social_posture',
      clamp01(
        aggregateSocialRead.publicPerformance01 * 0.35 +
          aggregateSocialRead.negotiation01 * 0.25 +
          aggregateSocialRead.helperNeed01 * 0.20 +
          aggregateSocialRead.aggression01 * 0.20,
      ),
      `Aggregate posture resolved as ${aggregateSocialRead.posture}.`,
    );

    return Object.freeze({
      version: CHAT_DIALOGUE_INTENT_ENCODER_VERSION,
      windowId: input.sequenceId ?? null,
      label: input.sequenceId ?? null,
      turnResults: Object.freeze(turnResults),
      sequenceEmbedding,
      dominantSequenceIntent,
      aggregateSocialRead,
      explanation: Object.freeze(
        explanation
          .sort((left, right) => right.weight01 - left.weight01)
          .slice(0, this.defaults.maxExplanationFactors),
      ),
      metadata: input.metadata,
    });
  }

  // ==========================================================================
  // MARK: Runtime preparation and diagnostics
  // ==========================================================================

  private calibrateRuntime(runtime: typeof DEFAULT_BACKEND_CHAT_RUNTIME): RuntimeCalibration {
    const replayAwareMemoryTurns = Math.max(
      this.defaults.maxMemoryTurns,
      Math.min(16, Math.round(runtime.replayPolicy.maxMessagesPerRoom / 800)),
    );
    const similarityThreshold100: Score100 = clamp100(this.defaults.similarityMemoryThreshold01 * 100);
    const crowdBias100: Score100 = clamp100(
      (runtime.invasionPolicy.enabled ? 58 : 28) +
        (runtime.learningPolicy.emitInferenceSnapshots ? 14 : 0) +
        (runtime.proofPolicy.enabled ? 8 : 0),
    );

    return Object.freeze({
      visibleChannels: new Set(runtime.allowVisibleChannels),
      replayAwareMemoryTurns,
      maxCharactersPerMessage: Math.max(64, runtime.moderationPolicy.maxCharactersPerMessage),
      similarityThreshold100,
      crowdBias100,
      negotiationBias01: clamp01(runtime.allowVisibleChannels.includes('DEAL_ROOM') ? 0.08 : 0.02),
      helperBias01: clamp01(runtime.allowVisibleChannels.includes('SYNDICATE') ? 0.07 : 0.03),
      replayBias01: clamp01(runtime.replayPolicy.enabled ? 0.07 : 0.02),
      systemBias01: clamp01(runtime.proofPolicy.enabled ? 0.06 : 0.02),
    });
  }

  private prepareMessageInput(
    message: EmbeddingMessageInput,
    sceneContext: Nullable<EmbeddingSceneContext>,
    signalEnvelope: Nullable<ChatSignalEnvelope>,
  ): EmbeddingMessageInput {
    const mergedSceneContext: EmbeddingSceneContext = Object.freeze({
      ...(sceneContext ?? {}),
      ...(message.sceneContext ?? {}),
      channel: this.resolveAllowedChannel(
        message.sceneContext?.channel ??
          sceneContext?.channel ??
          message.channel ??
          (((sceneContext?.signalEnvelope?.type ?? null) === 'LIVEOPS') ? 'GLOBAL' : null),
      ),
      roomKind: message.sceneContext?.roomKind ?? sceneContext?.roomKind ?? message.roomKind ?? null,
      pressureTier: message.sceneContext?.pressureTier ?? sceneContext?.pressureTier ?? message.pressureTier ?? null,
      signalEnvelope: signalEnvelope ?? message.signalEnvelope ?? message.sceneContext?.signalEnvelope ?? sceneContext?.signalEnvelope ?? null,
      witnessCount: Number(message.sceneContext?.witnessCount ?? sceneContext?.witnessCount ?? 0),
      heat01: clamp01(Number(message.sceneContext?.heat01 ?? sceneContext?.heat01 ?? 0)),
      createdAtMs: message.sceneContext?.createdAtMs ?? sceneContext?.createdAtMs ?? message.createdAtMs ?? this.clock.now(),
      messageId: message.sceneContext?.messageId ?? sceneContext?.messageId ?? message.messageId ?? null,
      sessionId: message.sceneContext?.sessionId ?? sceneContext?.sessionId ?? null,
      roomId: message.sceneContext?.roomId ?? sceneContext?.roomId ?? null,
      userId: message.sceneContext?.userId ?? sceneContext?.userId ?? null,
    });

    return Object.freeze({
      ...message,
      inputKind: this.resolveInputKind(message, mergedSceneContext),
      createdAtMs: message.createdAtMs ?? mergedSceneContext.createdAtMs ?? this.clock.now(),
      channel: mergedSceneContext.channel ?? message.channel ?? null,
      roomKind: mergedSceneContext.roomKind ?? message.roomKind ?? null,
      pressureTier: mergedSceneContext.pressureTier ?? message.pressureTier ?? null,
      signalEnvelope: mergedSceneContext.signalEnvelope ?? message.signalEnvelope ?? null,
      sceneContext: mergedSceneContext,
    });
  }

  private resolveInputKind(
    message: EmbeddingMessageInput,
    sceneContext: Nullable<EmbeddingSceneContext>,
  ): EmbeddingInputKind {
    if (message.inputKind != null) {
      return message.inputKind;
    }
    if (sceneContext?.isSystemNotice) {
      return 'SYSTEM_EVENT';
    }
    if ((sceneContext?.sequenceLength ?? 0) > 1 && (sceneContext?.sceneRole ?? null) != null) {
      return 'SCENE';
    }
    if (message.text.length === 0 && (sceneContext?.signalEnvelope?.type ?? null) != null) {
      return 'SUMMARY';
    }
    return 'MESSAGE';
  }

  private resolveAllowedChannel(channel: Nullable<ChatVisibleChannel>): Nullable<ChatVisibleChannel> {
    if (channel != null && this.runtimeCalibration.visibleChannels.has(channel)) {
      return channel;
    }
    return this.runtime.allowVisibleChannels[0] ?? null;
  }

  private buildSimilarityMemoryRead(
    probe: EmbeddingVector,
    previousMessages: ReadonlyArray<EmbeddingMessageInput>,
    sceneContext: Nullable<EmbeddingSceneContext>,
  ): SimilarityMemoryRead {
    const limit = Math.max(1, Math.min(this.runtimeCalibration.replayAwareMemoryTurns, previousMessages.length));
    const candidates = previousMessages
      .slice(-limit)
      .map((message, index) => {
        const prepared = this.prepareMessageInput(message, sceneContext ?? message.sceneContext ?? null, message.signalEnvelope ?? null);
        return {
          id: `hist:${index}:${prepared.messageId ?? 'none'}`,
          embedding: this.embeddingClient.embedMessage(prepared),
          metadata: {
            messageId: prepared.messageId ?? null,
            inputKind: prepared.inputKind ?? 'MESSAGE',
          } as const,
        };
      });

    if (candidates.length === 0) {
      return Object.freeze({
        dominantInputKind: 'MESSAGE',
        candidateCount: 0,
        bestMatchId: null,
        bestSimilarity: createEmptySimilarityResult(),
        averageCosine01: clamp01(0),
        overlapPressure01: clamp01(0),
        similarityPressure100: clamp100(0),
      });
    }

    const neighbors = this.embeddingClient.nearestNeighbors(probe, candidates, Math.min(4, candidates.length));
    const best = neighbors[0]?.similarity ?? createEmptySimilarityResult();
    const averageCosine01 = clamp01(
      average(neighbors.map((neighbor) => (neighbor.similarity.cosine + 1) / 2)),
    );
    const overlapPressure01 = clamp01(average(neighbors.map((neighbor) => neighbor.similarity.overlap01)));
    const similarityPressure100 = clamp100(
      ((best.clipped01 + averageCosine01 + overlapPressure01) / 3) * 100,
    );

    return Object.freeze({
      dominantInputKind: neighbors[0]?.metadata?.inputKind ?? 'MESSAGE',
      candidateCount: candidates.length,
      bestMatchId: neighbors[0]?.metadata?.messageId ?? null,
      bestSimilarity: best,
      averageCosine01,
      overlapPressure01,
      similarityPressure100,
    });
  }

  private buildResultMetadata(
    baseMetadata: Readonly<Record<string, JsonValue>> | undefined,
    message: EmbeddingMessageInput,
    embedding: EmbeddingVector,
    memory: SequenceMemory,
    similarityRead: SimilarityMemoryRead,
    socialRead: DialogueIntentSocialRead,
    primaryIntent: DialogueIntentKind,
    confidence01: Score01,
  ): Readonly<Record<string, JsonValue>> {
    const characterLoad100: Score100 = clamp100(
      (message.text.length / Math.max(1, this.runtimeCalibration.maxCharactersPerMessage)) * 100,
    );
    const confidence100: Score100 = clamp100(confidence01 * 100);
    const aggression100: Score100 = clamp100(socialRead.aggression01 * 100);
    const helperNeed100: Score100 = clamp100(socialRead.helperNeed01 * 100);
    const publicPerformance100: Score100 = clamp100(socialRead.publicPerformance01 * 100);

    return Object.freeze({
      ...(baseMetadata ?? {}),
      encoderInputKind: message.inputKind ?? 'MESSAGE',
      encoderPrimaryIntent: primaryIntent,
      encoderCharacterLoad100: characterLoad100,
      encoderConfidence100: confidence100,
      encoderAggression100: aggression100,
      encoderHelperNeed100: helperNeed100,
      encoderPublicPerformance100: publicPerformance100,
      encoderMemorySimilarity100: similarityRead.similarityPressure100,
      encoderMemoryBestMatchId: similarityRead.bestMatchId ?? null,
      encoderMemoryCandidateCount: similarityRead.candidateCount,
      encoderRuntimeReplayEnabled: this.runtime.replayPolicy.enabled,
      encoderRuntimeLearningEnabled: this.runtime.learningPolicy.enabled,
      encoderRuntimeAllowedChannels: Array.from(this.runtimeCalibration.visibleChannels),
      encoderRuntimeCrowdBias100: this.runtimeCalibration.crowdBias100,
      encoderMemoryWitnessCount: memory.witnessCount,
      encoderMemoryHeat01: memory.heat01,
      encoderEmbeddingMagnitude100: embedding.magnitude100,
      encoderCreatedAtMs: message.createdAtMs ?? null,
    });
  }

  // ==========================================================================
  // MARK: Scoring layers
  // ==========================================================================

  private createAccumulator(): IntentAccumulator {
    return {
      map: new Map<DialogueIntentKind, number>(),
      evidence: new Map<DialogueIntentKind, Set<string>>(),
      explanation: [],
    };
  }

  private scoreLexicalFamilies(
    accumulator: IntentAccumulator,
    message: EmbeddingMessageInput,
    explanation: DialogueIntentExplanationFactor[],
  ): void {
    const text = normalizeText(message.text);

    const attackHits = includesLexicon(text, INTENT_ATTACK_LEXICON);
    const tauntHits = includesLexicon(text, INTENT_TAUNT_LEXICON);
    const bluffHits = includesLexicon(text, INTENT_BLUFF_LEXICON);
    const negotiationHits = includesLexicon(text, INTENT_NEGOTIATION_LEXICON);
    const helpHits = includesLexicon(text, INTENT_HELP_LEXICON);
    const guideHits = includesLexicon(text, INTENT_GUIDE_LEXICON);
    const celebrateHits = includesLexicon(text, INTENT_CELEBRATE_LEXICON);
    const probeHits = includesLexicon(text, INTENT_PROBE_LEXICON);
    const withdrawHits = includesLexicon(text, INTENT_WITHDRAW_LEXICON);
    const commitHits = includesLexicon(text, INTENT_COMMIT_LEXICON);
    const bondHits = includesLexicon(text, INTENT_BOND_LEXICON);
    const warnHits = includesLexicon(text, INTENT_WARN_LEXICON);

    if (attackHits > 0) addIntentScore(accumulator, 'ATTACK', attackHits * 0.18, 'attack lexicon');
    if (attackHits > 0) addIntentScore(accumulator, 'INTIMIDATE', attackHits * 0.10, 'attack lexicon');
    if (tauntHits > 0) addIntentScore(accumulator, 'TAUNT', tauntHits * 0.22, 'taunt lexicon');
    if (tauntHits > 0) addIntentScore(accumulator, 'EMBARRASS', tauntHits * 0.12, 'taunt lexicon');
    if (bluffHits > 0) addIntentScore(accumulator, 'BLUFF', bluffHits * 0.22, 'bluff lexicon');
    if (negotiationHits > 0) addIntentScore(accumulator, 'NEGOTIATE', negotiationHits * 0.16, 'negotiation lexicon');
    if (helpHits > 0) addIntentScore(accumulator, 'CALL_FOR_HELP', helpHits * 0.22, 'help lexicon');
    if (helpHits > 0) addIntentScore(accumulator, 'ASK_FOR_CLARITY', helpHits * 0.08, 'help lexicon');
    if (guideHits > 0) addIntentScore(accumulator, 'GUIDE', guideHits * 0.18, 'guide lexicon');
    if (guideHits > 0) addIntentScore(accumulator, 'TEACH', guideHits * 0.12, 'guide lexicon');
    if (celebrateHits > 0) addIntentScore(accumulator, 'CELEBRATE', celebrateHits * 0.20, 'celebration lexicon');
    if (probeHits > 0) addIntentScore(accumulator, 'PROBE', probeHits * 0.16, 'question / probe lexicon');
    if (probeHits > 0) addIntentScore(accumulator, 'ASK_FOR_CLARITY', probeHits * 0.10, 'question / probe lexicon');
    if (withdrawHits > 0) addIntentScore(accumulator, 'WITHDRAW', withdrawHits * 0.24, 'withdraw lexicon');
    if (commitHits > 0) addIntentScore(accumulator, 'COMMIT', commitHits * 0.20, 'commit lexicon');
    if (bondHits > 0) addIntentScore(accumulator, 'BOND', bondHits * 0.16, 'bond lexicon');
    if (warnHits > 0) addIntentScore(accumulator, 'WARN', warnHits * 0.16, 'warning lexicon');

    if (text.includes('?')) {
      addIntentScore(accumulator, 'ASK_FOR_CLARITY', 0.12, 'question punctuation');
      addIntentScore(accumulator, 'PROBE', 0.08, 'question punctuation');
    }
    if (text.includes('!')) {
      addIntentScore(accumulator, 'PUBLIC_PERFORMANCE', 0.06, 'emphatic punctuation');
    }
    if (text.includes('$') || text.includes('%')) {
      addIntentScore(accumulator, 'NEGOTIATE', 0.08, 'pricing punctuation');
      addIntentScore(accumulator, 'STATUS_SIGNAL', 0.05, 'pricing punctuation');
    }

    pushExplanation(
      explanation,
      'lexical_surface',
      clamp01(
        attackHits * 0.08 +
          tauntHits * 0.10 +
          bluffHits * 0.10 +
          negotiationHits * 0.08 +
          helpHits * 0.10 +
          celebrateHits * 0.06,
      ),
      'Lexical surface contributed to intent scoring.',
    );
  }

  private scoreEmbeddingFamilies(
    accumulator: IntentAccumulator,
    embedding: EmbeddingVector,
    explanation: DialogueIntentExplanationFactor[],
  ): void {
    const families = new Set<EmbeddingSemanticFamily>(embedding.explanation.dominantFamilies);

    if (families.has('ATTACK')) addIntentScore(accumulator, 'ATTACK', 0.16, 'embedding family attack');
    if (families.has('ATTACK')) addIntentScore(accumulator, 'INTIMIDATE', 0.08, 'embedding family attack');
    if (families.has('DEFENSE')) addIntentScore(accumulator, 'DEFEND', 0.14, 'embedding family defense');
    if (families.has('HELPER')) addIntentScore(accumulator, 'GUIDE', 0.14, 'embedding family helper');
    if (families.has('NEGOTIATION')) addIntentScore(accumulator, 'NEGOTIATE', 0.18, 'embedding family negotiation');
    if (families.has('CROWD')) addIntentScore(accumulator, 'PUBLIC_PERFORMANCE', 0.14, 'embedding family crowd');
    if (families.has('CROWD')) addIntentScore(accumulator, 'WITNESS', 0.10, 'embedding family crowd');
    if (families.has('SOVEREIGNTY')) addIntentScore(accumulator, 'SOVEREIGNTY_SIGNAL', 0.18, 'embedding family sovereignty');
    if (families.has('DISTRESS')) addIntentScore(accumulator, 'CALL_FOR_HELP', 0.18, 'embedding family distress');
    if (families.has('DISTRESS')) addIntentScore(accumulator, 'WITHDRAW', 0.08, 'embedding family distress');
    if (families.has('SYSTEM')) addIntentScore(accumulator, 'SYSTEM_SIGNAL', 0.14, 'embedding family system');
    if (families.has('POSITIVE')) addIntentScore(accumulator, 'REASSURE', 0.10, 'embedding family positive');
    if (families.has('NEGATIVE')) addIntentScore(accumulator, 'WARN', 0.08, 'embedding family negative');
    if (families.has('QUESTION')) addIntentScore(accumulator, 'PROBE', 0.12, 'embedding family question');
    if (families.has('CALL_TO_ACTION')) addIntentScore(accumulator, 'COMMIT', 0.10, 'embedding family CTA');
    if (families.has('EMBARRASSMENT')) addIntentScore(accumulator, 'EMBARRASS', 0.16, 'embedding family embarrassment');

    pushExplanation(
      explanation,
      'embedding_families',
      clamp01(families.size * 0.08),
      `Embedding families observed: ${Array.from(families).join(', ') || 'none'}.`,
    );
  }

  private scoreSceneBias(
    accumulator: IntentAccumulator,
    embedding: EmbeddingVector,
    message: EmbeddingMessageInput,
    explanation: DialogueIntentExplanationFactor[],
  ): void {
    const context = message.sceneContext;
    const channel = embedding.channel ?? context?.channel ?? null;
    const roomKind = embedding.roomKind ?? context?.roomKind ?? null;
    const pressureTier = embedding.pressureTier ?? context?.pressureTier ?? null;
    const witnessCount = Number(context?.witnessCount ?? 0);
    const heat01 = Number(context?.heat01 ?? 0);

    switch (channel) {
      case 'GLOBAL':
        addIntentScore(accumulator, 'PUBLIC_PERFORMANCE', this.defaults.aggressionBiasGlobal01, 'global channel bias');
        addIntentScore(accumulator, 'WITNESS', this.defaults.spectacleBiasWitnessed01 * (witnessCount > 0 ? 1 : 0.5), 'global witness bias');
        break;
      case 'SYNDICATE':
        addIntentScore(accumulator, 'BOND', this.defaults.intimacyBiasSyndicate01, 'syndicate intimacy bias');
        addIntentScore(accumulator, 'WARN', 0.04, 'syndicate discretion bias');
        break;
      case 'DEAL_ROOM':
        addIntentScore(accumulator, 'NEGOTIATE', this.defaults.predationBiasDealRoom01, 'deal-room predation bias');
        addIntentScore(accumulator, 'BLUFF', this.defaults.tacticalSilenceBiasDealRoom01, 'deal-room tactical bias');
        addIntentScore(accumulator, 'STALL', 0.06, 'deal-room tactical bias');
        break;
      case 'LOBBY':
        addIntentScore(accumulator, 'INVITE', this.defaults.loosenessBiasLobby01, 'lobby looseness bias');
        addIntentScore(accumulator, 'BOND', 0.05, 'lobby social bias');
        break;
      default:
        break;
    }

    switch (roomKind as string) {
      case 'BATTLE':
        addIntentScore(accumulator, 'COUNTER', 0.08, 'battle room bias');
        addIntentScore(accumulator, 'ATTACK', 0.08, 'battle room bias');
        break;
      case 'DEAL_ROOM':
        addIntentScore(accumulator, 'NEGOTIATE', 0.08, 'deal-room room-kind bias');
        addIntentScore(accumulator, 'STALL', 0.05, 'deal-room room-kind bias');
        break;
      default:
        break;
    }

    if (pressureTier === 'HIGH' || pressureTier === 'CRITICAL') {
      addIntentScore(accumulator, 'WARN', this.defaults.distressBiasHighPressure01 * 0.55, 'high-pressure bias');
      addIntentScore(accumulator, 'CALL_FOR_HELP', this.defaults.distressBiasHighPressure01 * 0.45, 'high-pressure bias');
    }

    if (witnessCount > 0) {
      addIntentScore(accumulator, 'PUBLIC_PERFORMANCE', this.defaults.spectacleBiasWitnessed01 * clamp01(witnessCount / 6), 'witness count');
      addIntentScore(accumulator, 'STATUS_SIGNAL', 0.06 * clamp01(witnessCount / 6), 'witness count');
    }

    if (heat01 >= 0.72) {
      addIntentScore(accumulator, 'PUBLIC_PERFORMANCE', 0.08, 'crowd heat');
      addIntentScore(accumulator, 'TAUNT', 0.04, 'crowd heat');
    }

    if (booleanToNumber(context?.isSystemNotice) > 0) {
      addIntentScore(accumulator, 'SYSTEM_SIGNAL', 0.18, 'system notice');
    }

    pushExplanation(
      explanation,
      'scene_bias',
      clamp01(
        (channel === 'DEAL_ROOM' ? 0.10 : 0) +
          (channel === 'GLOBAL' ? 0.08 : 0) +
          (pressureTier === 'HIGH' || pressureTier === 'CRITICAL' ? 0.10 : 0) +
          (witnessCount > 0 ? 0.08 : 0),
      ),
      `Scene bias resolved from channel=${channel ?? 'n/a'}, room=${roomKind ?? 'n/a'}, pressure=${pressureTier ?? 'n/a'}.`,
    );
  }

  private scoreInputKindBias(
    accumulator: IntentAccumulator,
    message: EmbeddingMessageInput,
    explanation: DialogueIntentExplanationFactor[],
  ): void {
    const inputKind = message.inputKind ?? 'MESSAGE';

    switch (inputKind) {
      case 'SYSTEM_EVENT':
        addIntentScore(accumulator, 'SYSTEM_SIGNAL', 0.18, 'system-event input kind');
        addIntentScore(accumulator, 'STATUS_SIGNAL', 0.08, 'system-event input kind');
        break;
      case 'SCENE':
        addIntentScore(accumulator, 'WITNESS', 0.10, 'scene input kind');
        addIntentScore(accumulator, 'PUBLIC_PERFORMANCE', 0.08, 'scene input kind');
        break;
      case 'TRANSCRIPT_WINDOW':
        addIntentScore(accumulator, 'WITNESS', 0.08, 'transcript-window input kind');
        addIntentScore(accumulator, 'STATUS_SIGNAL', 0.06, 'transcript-window input kind');
        break;
      case 'SUMMARY':
        addIntentScore(accumulator, 'GUIDE', 0.06, 'summary input kind');
        addIntentScore(accumulator, 'TEACH', 0.06, 'summary input kind');
        break;
      case 'MESSAGE':
      default:
        addIntentScore(accumulator, 'UNKNOWN', 0.01, 'message input kind baseline');
        break;
    }

    pushExplanation(
      explanation,
      'input_kind_bias',
      clamp01(
        inputKind === 'SYSTEM_EVENT'
          ? 0.14
          : inputKind === 'SCENE'
            ? 0.10
            : inputKind === 'TRANSCRIPT_WINDOW'
              ? 0.08
              : inputKind === 'SUMMARY'
                ? 0.06
                : 0.02,
      ),
      `Input kind bias resolved from ${inputKind}.`,
    );
  }

  private scoreRuntimeBias(
    accumulator: IntentAccumulator,
    embedding: EmbeddingVector,
    message: EmbeddingMessageInput,
    explanation: DialogueIntentExplanationFactor[],
  ): void {
    const channel = embedding.channel ?? message.sceneContext?.channel ?? message.channel ?? null;

    if (channel === 'DEAL_ROOM') {
      addIntentScore(accumulator, 'NEGOTIATE', this.runtimeCalibration.negotiationBias01, 'runtime channel support');
      addIntentScore(accumulator, 'STALL', this.runtimeCalibration.replayBias01 * 0.5, 'runtime channel support');
    }

    if (channel === 'SYNDICATE') {
      addIntentScore(accumulator, 'GUIDE', this.runtimeCalibration.helperBias01 * 0.55, 'runtime helper support');
      addIntentScore(accumulator, 'BOND', this.runtimeCalibration.helperBias01 * 0.45, 'runtime helper support');
    }

    if (this.runtime.proofPolicy.enabled && message.sceneContext?.isSystemNotice) {
      addIntentScore(accumulator, 'SYSTEM_SIGNAL', this.runtimeCalibration.systemBias01, 'runtime proof support');
    }

    if (this.runtime.invasionPolicy.enabled && (message.signalEnvelope?.type ?? null) === 'LIVEOPS') {
      addIntentScore(accumulator, 'PUBLIC_PERFORMANCE', clamp01(this.runtimeCalibration.crowdBias100 / 100 * 0.10), 'runtime invasion support');
      addIntentScore(accumulator, 'WARN', 0.05, 'runtime invasion support');
    }

    if (!this.runtime.learningPolicy.enabled) {
      addIntentScore(accumulator, 'STATUS_SIGNAL', 0.02, 'runtime learning disabled');
    }

    pushExplanation(
      explanation,
      'runtime_bias',
      clamp01(
        (channel === 'DEAL_ROOM' ? this.runtimeCalibration.negotiationBias01 : 0) +
          (channel === 'SYNDICATE' ? this.runtimeCalibration.helperBias01 : 0) +
          (this.runtime.invasionPolicy.enabled ? 0.04 : 0) +
          (this.runtime.proofPolicy.enabled ? 0.04 : 0),
      ),
      `Runtime bias evaluated for channel=${channel ?? 'n/a'} under runtime version ${this.runtime.version}.`,
    );
  }

  private scoreSignalEnvelope(
    accumulator: IntentAccumulator,
    signalEnvelope: Nullable<ChatSignalEnvelope>,
    explanation: DialogueIntentExplanationFactor[],
  ): void {
    if (signalEnvelope == null) {
      return;
    }

    switch (signalEnvelope.type) {
      case 'BATTLE':
        addIntentScore(accumulator, 'ATTACK', 0.10, 'battle signal envelope');
        addIntentScore(accumulator, 'COUNTER', 0.08, 'battle signal envelope');
        break;
      case 'RUN':
        addIntentScore(accumulator, 'STATUS_SIGNAL', 0.10, 'run signal envelope');
        addIntentScore(accumulator, 'COMMIT', 0.04, 'run signal envelope');
        break;
      case 'MULTIPLAYER':
        addIntentScore(accumulator, 'WITNESS', 0.10, 'multiplayer signal envelope');
        addIntentScore(accumulator, 'PUBLIC_PERFORMANCE', 0.08, 'multiplayer signal envelope');
        break;
      case 'ECONOMY':
        addIntentScore(accumulator, 'NEGOTIATE', 0.12, 'economy signal envelope');
        addIntentScore(accumulator, 'STATUS_SIGNAL', 0.06, 'economy signal envelope');
        break;
      case 'LIVEOPS':
        addIntentScore(accumulator, 'SYSTEM_SIGNAL', 0.16, 'liveops signal envelope');
        addIntentScore(accumulator, 'WARN', 0.06, 'liveops signal envelope');
        break;
      default:
        break;
    }

    pushExplanation(
      explanation,
      'signal_envelope',
      clamp01((signalEnvelope.metadata != null ? 0.04 : 0.02) + 0.08),
      `Signal envelope type ${signalEnvelope.type} influenced intent scoring.`,
    );
  }

  private scoreSimilarityMemory(
    accumulator: IntentAccumulator,
    similarityRead: SimilarityMemoryRead,
    explanation: DialogueIntentExplanationFactor[],
  ): void {
    if (similarityRead.candidateCount === 0) {
      return;
    }

    if (similarityRead.bestSimilarity.clipped01 >= this.runtimeCalibration.similarityThreshold100 / 100) {
      addIntentScore(accumulator, 'STATUS_SIGNAL', 0.08, 'high similarity memory echo');
      addIntentScore(accumulator, 'PUBLIC_PERFORMANCE', 0.04, 'high similarity memory echo');
    }

    if (similarityRead.dominantInputKind === 'SYSTEM_EVENT') {
      addIntentScore(accumulator, 'SYSTEM_SIGNAL', 0.06, 'system-event similarity echo');
    }

    if (similarityRead.overlapPressure01 >= 0.55) {
      addIntentScore(accumulator, 'STALL', 0.04, 'overlap pressure echo');
      addIntentScore(accumulator, 'BLUFF', 0.03, 'overlap pressure echo');
    }

    pushExplanation(
      explanation,
      'memory_similarity',
      clamp01(similarityRead.similarityPressure100 / 100),
      `Similarity memory read used ${similarityRead.candidateCount} candidate(s); best cosine=${similarityRead.bestSimilarity.cosine.toFixed(3)}.`,
    );
  }

  private scoreSequenceEcho(
    accumulator: IntentAccumulator,
    memory: SequenceMemory,
    message: EmbeddingMessageInput,
    embedding: EmbeddingVector,
    explanation: DialogueIntentExplanationFactor[],
  ): void {
    const normalized = normalizeText(message.text);

    if (memory.priorIntents.includes('NEGOTIATE') && includesLexicon(normalized, INTENT_NEGOTIATION_LEXICON) > 0) {
      addIntentScore(accumulator, 'NEGOTIATE', this.defaults.sequenceEchoWeight01, 'sequence echo negotiation');
    }
    if (memory.priorIntents.includes('CALL_FOR_HELP') && includesLexicon(normalized, INTENT_HELP_LEXICON) > 0) {
      addIntentScore(accumulator, 'CALL_FOR_HELP', this.defaults.sequenceEchoWeight01, 'sequence echo help');
    }
    if (memory.priorIntents.includes('ATTACK') && embedding.explanation.dominantFamilies.includes('ATTACK')) {
      addIntentScore(accumulator, 'ATTACK', this.defaults.sequenceEchoWeight01 * 0.85, 'sequence echo attack');
    }
    if (memory.priorIntents.includes('TAUNT') && embedding.explanation.dominantFamilies.includes('EMBARRASSMENT')) {
      addIntentScore(accumulator, 'EMBARRASS', this.defaults.sequenceEchoWeight01 * 0.65, 'sequence echo embarrassment');
    }

    let tokenEchoHits = 0;
    for (const token of embedding.explanation.dominantTokens) {
      if (memory.repeatedTokens.has(token)) {
        tokenEchoHits += 1;
      }
    }

    if (tokenEchoHits > 0) {
      addIntentScore(accumulator, 'STATUS_SIGNAL', clamp01(tokenEchoHits * 0.04), 'token echo');
      addIntentScore(accumulator, 'PUBLIC_PERFORMANCE', clamp01(tokenEchoHits * 0.03), 'token echo');
    }

    pushExplanation(
      explanation,
      'sequence_echo',
      clamp01(tokenEchoHits * 0.05 + memory.priorIntents.length * 0.03),
      'Prior turn echo adjusted current intent scoring.',
    );
  }

  private scorePressureRead(
    accumulator: IntentAccumulator,
    embedding: EmbeddingVector,
    message: EmbeddingMessageInput,
    explanation: DialogueIntentExplanationFactor[],
  ): void {
    const pressureTier = embedding.pressureTier ?? message.sceneContext?.pressureTier ?? null;
    const text = normalizeText(message.text);

    const shortReply = text.length <= 14;
    const questionMark = text.includes('?');
    const exclamation = text.includes('!');
    const containsSovereignty = embedding.explanation.dominantFamilies.includes('SOVEREIGNTY');

    if ((pressureTier === 'HIGH' || pressureTier === 'CRITICAL') && shortReply) {
      addIntentScore(accumulator, 'STALL', 0.08, 'high-pressure short reply');
      addIntentScore(accumulator, 'COUNTER', 0.05, 'high-pressure short reply');
    }

    if ((pressureTier === 'HIGH' || pressureTier === 'CRITICAL') && questionMark) {
      addIntentScore(accumulator, 'CALL_FOR_HELP', 0.08, 'high-pressure question');
      addIntentScore(accumulator, 'ASK_FOR_CLARITY', 0.08, 'high-pressure question');
    }

    if (containsSovereignty) {
      addIntentScore(accumulator, 'SOVEREIGNTY_SIGNAL', this.defaults.dominanceBiasSovereignty01, 'sovereignty family');
      addIntentScore(accumulator, 'STATUS_SIGNAL', 0.06, 'sovereignty family');
    }

    if (exclamation && embedding.explanation.dominantFamilies.includes('CROWD')) {
      addIntentScore(accumulator, 'PUBLIC_PERFORMANCE', 0.08, 'crowd + exclamation');
    }

    pushExplanation(
      explanation,
      'pressure_read',
      clamp01(
        (pressureTier === 'HIGH' || pressureTier === 'CRITICAL' ? 0.10 : 0) +
          (containsSovereignty ? 0.08 : 0),
      ),
      `Pressure read evaluated under pressure=${pressureTier ?? 'n/a'}.`,
    );
  }

  private scoreIntentConflicts(
    accumulator: IntentAccumulator,
    message: EmbeddingMessageInput,
    embedding: EmbeddingVector,
    explanation: DialogueIntentExplanationFactor[],
  ): void {
    const text = normalizeText(message.text);
    const hasAttack = includesLexicon(text, INTENT_ATTACK_LEXICON) > 0 || embedding.explanation.dominantFamilies.includes('ATTACK');
    const hasHelp = includesLexicon(text, INTENT_HELP_LEXICON) > 0 || embedding.explanation.dominantFamilies.includes('DISTRESS');
    const hasNegotiation =
      includesLexicon(text, INTENT_NEGOTIATION_LEXICON) > 0 || embedding.explanation.dominantFamilies.includes('NEGOTIATION');
    const hasWarmth =
      includesLexicon(text, INTENT_BOND_LEXICON) > 0 || embedding.explanation.dominantFamilies.includes('POSITIVE');

    if (hasAttack && hasHelp) {
      addIntentScore(accumulator, 'PROBE', 0.06, 'attack/help conflict');
      addIntentScore(accumulator, 'STALL', 0.05, 'attack/help conflict');
      pushExplanation(explanation, 'conflict_attack_help', 0.10, 'Mixed aggression and help signals detected.');
    }

    if (hasNegotiation && hasWarmth) {
      addIntentScore(accumulator, 'BOND', 0.05, 'negotiation/warmth blend');
      addIntentScore(accumulator, 'INVITE', 0.04, 'negotiation/warmth blend');
      pushExplanation(explanation, 'blend_negotiation_warmth', 0.07, 'Negotiation language blended with warmth signals.');
    }

    if (hasAttack && hasNegotiation) {
      addIntentScore(accumulator, 'BLUFF', 0.06, 'attack/negotiation blend');
      addIntentScore(accumulator, 'INTIMIDATE', 0.05, 'attack/negotiation blend');
      pushExplanation(explanation, 'blend_attack_negotiation', 0.08, 'Attack language blended with negotiation language.');
    }
  }

  // ==========================================================================
  // MARK: Finalization
  // ==========================================================================

  private finalizeIntentScores(accumulator: IntentAccumulator): ReadonlyArray<DialogueIntentScore> {
    const rows: DialogueIntentScore[] = [];

    const maxScore = Math.max(this.defaults.lowEvidenceFallback01, ...Array.from(accumulator.map.values()), 0);

    const knownKinds: DialogueIntentKind[] = [
      'ATTACK',
      'TAUNT',
      'BLUFF',
      'NEGOTIATE',
      'COUNTER',
      'DEFEND',
      'WITHDRAW',
      'CALL_FOR_HELP',
      'ASK_FOR_CLARITY',
      'TEACH',
      'GUIDE',
      'REASSURE',
      'CELEBRATE',
      'WITNESS',
      'PUBLIC_PERFORMANCE',
      'STATUS_SIGNAL',
      'SOVEREIGNTY_SIGNAL',
      'INTIMIDATE',
      'EMBARRASS',
      'PROBE',
      'STALL',
      'COMMIT',
      'INVITE',
      'BOND',
      'WARN',
      'SYSTEM_SIGNAL',
      'UNKNOWN',
    ];

    for (const kind of knownKinds) {
      const raw = accumulator.map.get(kind) ?? 0;
      const normalized = clamp01(raw / Math.max(this.defaults.lowEvidenceFallback01, maxScore));
      rows.push({
        kind,
        score01: normalized,
        evidence: Object.freeze(Array.from(accumulator.evidence.get(kind) ?? [])),
      });
    }

    return Object.freeze(
      rows
        .filter((row) => row.score01 >= this.defaults.dominantIntentFloor01 || row.kind === 'UNKNOWN')
        .sort((left, right) => right.score01 - left.score01)
        .slice(0, this.defaults.maxTopIntents),
    );
  }

  private buildSocialRead(
    ranked: ReadonlyArray<DialogueIntentScore>,
    embedding: EmbeddingVector,
    message: EmbeddingMessageInput,
    memory: SequenceMemory,
    explanation: DialogueIntentExplanationFactor[],
  ): DialogueIntentSocialRead {
    const score = (kind: DialogueIntentKind): number =>
      ranked.find((row) => row.kind === kind)?.score01 ?? 0;

    const aggression01 = clamp01(
      score('ATTACK') * 0.40 +
        score('TAUNT') * 0.20 +
        score('INTIMIDATE') * 0.20 +
        score('EMBARRASS') * 0.20,
    );

    const helperNeed01 = clamp01(
      score('CALL_FOR_HELP') * 0.48 +
        score('ASK_FOR_CLARITY') * 0.22 +
        score('WITHDRAW') * 0.18 +
        score('WARN') * 0.12,
    );

    const negotiation01 = clamp01(
      score('NEGOTIATE') * 0.42 +
        score('BLUFF') * 0.28 +
        score('STALL') * 0.16 +
        score('COMMIT') * 0.14,
    );

    const publicPerformance01 = clamp01(
      score('PUBLIC_PERFORMANCE') * 0.38 +
        score('WITNESS') * 0.22 +
        score('STATUS_SIGNAL') * 0.20 +
        score('CELEBRATE') * 0.10 +
        score('EMBARRASS') * 0.10,
    );

    const distress01 = clamp01(
      helperNeed01 * 0.52 +
        score('WITHDRAW') * 0.20 +
        (embedding.explanation.dominantFamilies.includes('DISTRESS') ? 0.16 : 0) +
        (message.text.length <= 12 && (message.sceneContext?.pressureTier === 'HIGH' || message.sceneContext?.pressureTier === 'CRITICAL') ? 0.12 : 0),
    );

    const confidence01 = clamp01(
      score('COMMIT') * 0.18 +
        score('COUNTER') * 0.16 +
        score('DEFEND') * 0.12 +
        score('SOVEREIGNTY_SIGNAL') * 0.18 +
        score('CELEBRATE') * 0.10 +
        Math.max(0, 1 - distress01) * 0.26,
    );

    const memoryWeightedPerformance01 = clamp01(
      publicPerformance01 + clamp01(memory.witnessCount / 8) * 0.08 + memory.heat01 * 0.10,
    );
    const memoryWeightedNegotiation01 = clamp01(
      negotiation01 + (memory.channel === 'DEAL_ROOM' ? 0.06 : 0) + (memory.roomKind === 'DEAL_ROOM' ? 0.04 : 0),
    );
    const memoryWeightedHelper01 = clamp01(
      helperNeed01 + (memory.channel === 'SYNDICATE' ? 0.04 : 0) + (memory.pressureTier === 'CRITICAL' ? 0.05 : 0),
    );

    let posture: DialogueSocialPosture = 'UNKNOWN';
    if (memoryWeightedNegotiation01 >= this.defaults.negotiationThreshold01) posture = 'PREDATORY';
    else if (memoryWeightedPerformance01 >= this.defaults.publicPerformanceThreshold01) posture = 'THEATRICAL';
    else if (memoryWeightedHelper01 >= this.defaults.helperNeedThreshold01) posture = 'SUPPORTIVE';
    else if ((embedding.channel ?? message.sceneContext?.channel ?? memory.channel) === 'SYNDICATE') posture = 'PRIVATE';
    else if ((embedding.channel ?? message.sceneContext?.channel ?? memory.channel) === 'DEAL_ROOM') posture = 'TACTICAL';
    else if ((embedding.channel ?? message.sceneContext?.channel ?? memory.channel) === 'GLOBAL') posture = 'PUBLIC';

    const tone = toneBand(aggression01, distress01, confidence01);
    const risk = riskBand(
      aggression01 * 0.35 +
        memoryWeightedHelper01 * 0.25 +
        memoryWeightedNegotiation01 * 0.15 +
        memoryWeightedPerformance01 * 0.10 +
        Math.max(0, 0.5 - confidence01) * 0.20 +
        (memory.pressureTier === 'CRITICAL' ? 0.08 : memory.pressureTier === 'HIGH' ? 0.04 : 0),
    );

    pushExplanation(
      explanation,
      'social_read',
      clamp01(
        aggression01 * 0.18 +
          memoryWeightedHelper01 * 0.18 +
          memoryWeightedNegotiation01 * 0.14 +
          memoryWeightedPerformance01 * 0.14 +
          distress01 * 0.16 +
          confidence01 * 0.12 +
          memory.heat01 * 0.08,
      ),
      `Social read posture=${posture}, tone=${tone}, risk=${risk}.`,
    );

    return Object.freeze({
      posture,
      tone,
      risk,
      aggression01,
      helperNeed01,
      negotiation01,
      publicPerformance01,
      distress01,
      confidence01,
    });
  }

  private computeContradiction01(ranked: ReadonlyArray<DialogueIntentScore>): Score01 {
    const score = (kind: DialogueIntentKind): number =>
      ranked.find((row) => row.kind === kind)?.score01 ?? 0;

    const attackVsHelp = Math.min(score('ATTACK'), score('CALL_FOR_HELP'));
    const celebrateVsWithdraw = Math.min(score('CELEBRATE'), score('WITHDRAW'));
    const commitVsStall = Math.min(score('COMMIT'), score('STALL'));
    const bluffVsBond = Math.min(score('BLUFF'), score('BOND'));

    return clamp01(
      attackVsHelp * 0.34 +
        celebrateVsWithdraw * 0.24 +
        commitVsStall * 0.22 +
        bluffVsBond * 0.20,
    );
  }

  private computeCoherence01(
    ranked: ReadonlyArray<DialogueIntentScore>,
    contradiction01: Score01,
  ): Score01 {
    const top = ranked[0]?.score01 ?? 0;
    const second = ranked[1]?.score01 ?? 0;
    return clamp01(Math.max(0, top - second * 0.55) * (1 - contradiction01 * this.defaults.contradictionPenalty01));
  }

  private computeConfidence01(
    ranked: ReadonlyArray<DialogueIntentScore>,
    coherence01: Score01,
    contradiction01: Score01,
  ): Score01 {
    const top = ranked[0]?.score01 ?? 0;
    return clamp01(top * 0.58 + coherence01 * 0.30 + Math.max(0, 1 - contradiction01) * 0.12);
  }

  private aggregateSocialReads(turnResults: ReadonlyArray<DialogueIntentResult>): DialogueIntentSocialRead {
    if (turnResults.length === 0) {
      return Object.freeze({
        posture: 'UNKNOWN',
        tone: 'UNKNOWN',
        risk: 'LOW',
        aggression01: clamp01(0),
        helperNeed01: clamp01(0),
        negotiation01: clamp01(0),
        publicPerformance01: clamp01(0),
        distress01: clamp01(0),
        confidence01: clamp01(0),
      });
    }

    const sums = turnResults.reduce(
      (acc, result) => {
        acc.aggression01 += result.socialRead.aggression01;
        acc.helperNeed01 += result.socialRead.helperNeed01;
        acc.negotiation01 += result.socialRead.negotiation01;
        acc.publicPerformance01 += result.socialRead.publicPerformance01;
        acc.distress01 += result.socialRead.distress01;
        acc.confidence01 += result.socialRead.confidence01;
        return acc;
      },
      {
        aggression01: 0,
        helperNeed01: 0,
        negotiation01: 0,
        publicPerformance01: 0,
        distress01: 0,
        confidence01: 0,
      },
    );

    const divisor = turnResults.length;
    const aggression01 = clamp01(sums.aggression01 / divisor);
    const helperNeed01 = clamp01(sums.helperNeed01 / divisor);
    const negotiation01 = clamp01(sums.negotiation01 / divisor);
    const publicPerformance01 = clamp01(sums.publicPerformance01 / divisor);
    const distress01 = clamp01(sums.distress01 / divisor);
    const confidence01 = clamp01(sums.confidence01 / divisor);

    let posture: DialogueSocialPosture = 'UNKNOWN';
    if (negotiation01 >= this.defaults.negotiationThreshold01) posture = 'PREDATORY';
    else if (publicPerformance01 >= this.defaults.publicPerformanceThreshold01) posture = 'THEATRICAL';
    else if (helperNeed01 >= this.defaults.helperNeedThreshold01) posture = 'SUPPORTIVE';
    else posture = 'TACTICAL';

    const tone = toneBand(aggression01, distress01, confidence01);
    const risk = riskBand(
      aggression01 * 0.35 +
        helperNeed01 * 0.30 +
        negotiation01 * 0.15 +
        publicPerformance01 * 0.10 +
        Math.max(0, 0.5 - confidence01) * 0.20,
    );

    return Object.freeze({
      posture,
      tone,
      risk,
      aggression01,
      helperNeed01,
      negotiation01,
      publicPerformance01,
      distress01,
      confidence01,
    });
  }

  // ==========================================================================
  // MARK: Memory
  // ==========================================================================

  private buildSequenceMemory(
    previousMessages: ReadonlyArray<EmbeddingMessageInput>,
    sceneContext: Nullable<EmbeddingSceneContext>,
  ): SequenceMemory {
    const priorResults = previousMessages
      .slice(-this.runtimeCalibration.replayAwareMemoryTurns)
      .map((message) =>
        this.encodeTurn({
          message,
          previousMessages: [],
          sceneContext: sceneContext ?? message.sceneContext ?? null,
        }),
      );

    const priorIntents = priorResults.map((result) => result.primaryIntent);
    const repeatedTokens = new Set<string>();

    for (const result of priorResults) {
      for (const token of result.embedding.explanation.dominantTokens) {
        repeatedTokens.add(token);
      }
    }

    return {
      priorIntents,
      repeatedTokens,
      pressureTier: sceneContext?.pressureTier ?? null,
      channel: sceneContext?.channel ?? null,
      roomKind: sceneContext?.roomKind ?? null,
      witnessCount: Number(sceneContext?.witnessCount ?? 0),
      heat01: Number(sceneContext?.heat01 ?? 0),
    };
  }
}

// ============================================================================
// MARK: Convenience helpers
// ============================================================================

export function createDialogueIntentEncoder(
  options: DialogueIntentEncoderOptions = {},
): DialogueIntentEncoder {
  return new DialogueIntentEncoder(options);
}

export function encodeDialogueIntentTurn(
  encoder: DialogueIntentEncoder,
  input: DialogueIntentTurnInput,
): DialogueIntentResult {
  return encoder.encodeTurn(input);
}

export function encodeDialogueIntentSequence(
  encoder: DialogueIntentEncoder,
  input: DialogueIntentSequenceInput,
): DialogueIntentSequenceResult {
  return encoder.encodeSequence(input);
}

export default DialogueIntentEncoder;
